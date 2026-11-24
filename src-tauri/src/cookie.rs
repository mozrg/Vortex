use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::path::PathBuf;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

use crate::state::AppState;

/// The path where the encrypted .ROBLOSECURITY cookie is stored.
fn cookie_file_path(profile: Option<&str>) -> Option<PathBuf> {
    let root = AppState::user_data_dir();
    match profile {
        None | Some("default") => Some(root.join("rbx-presence.bin")),
        Some(id) if id.len() == 32 && id.bytes().all(|c| c.is_ascii_hexdigit()) => {
            Some(root.join("accounts").join(id.to_ascii_lowercase()).join("rbx-presence.bin"))
        }
        _ => None,
    }
}

/// Encrypt a string using Windows DPAPI for local credential storage.
pub fn encrypt_string(plain: &str) -> Result<Vec<u8>, String> {
    dpapi_protect(plain.as_bytes())
}

fn dpapi_protect(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() > u32::MAX as usize {
        return Err("Data is too large".to_string());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(
            &input,
            PCWSTR::null(),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    }
    .map_err(|error| format!("DPAPI encryption failed: {error}"))?;
    copy_and_free_blob(output)
}

/// Decrypt either a native Windows DPAPI blob or a migrated Electron `v10` OSCrypt blob.
pub fn decrypt_string(cipher: &[u8]) -> Result<String, String> {
    let bytes = if cipher.starts_with(b"v10") {
        decrypt_electron_v10(cipher)?
    } else {
        dpapi_unprotect(cipher)?
    };
    String::from_utf8(bytes).map_err(|e| format!("UTF-8 error: {e}"))
}

fn dpapi_unprotect(cipher: &[u8]) -> Result<Vec<u8>, String> {
    if cipher.is_empty() || cipher.len() > u32::MAX as usize {
        return Err("Invalid encrypted data".to_string());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: cipher.len() as u32,
        pbData: cipher.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    }
    .map_err(|error| format!("DPAPI decryption failed: {error}"))?;
    copy_and_free_blob(output)
}

/// Electron 44's Windows safeStorage format uses Chromium OSCrypt: `v10`, a
/// 12-byte nonce, then AES-256-GCM ciphertext; its key is DPAPI-wrapped in
/// Electron's Local State file.
fn decrypt_electron_v10(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    const PREFIX_BYTES: usize = 3;
    const NONCE_BYTES: usize = 12;
    const TAG_BYTES: usize = 16;
    if ciphertext.len() < PREFIX_BYTES + NONCE_BYTES + TAG_BYTES {
        return Err("Invalid Electron encrypted data".to_string());
    }

    let local_state_path = AppState::user_data_dir().join("Local State");
    let local_state: serde_json::Value = serde_json::from_slice(
        &std::fs::read(&local_state_path)
            .map_err(|error| format!("Could not read Electron Local State: {error}"))?,
    )
    .map_err(|error| format!("Could not parse Electron Local State: {error}"))?;
    let encoded_key = local_state
        .get("os_crypt")
        .and_then(|value| value.get("encrypted_key"))
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Electron encryption key is missing".to_string())?;
    let wrapped_key = BASE64_STANDARD
        .decode(encoded_key)
        .map_err(|error| format!("Electron encryption key is invalid: {error}"))?;
    let wrapped_key = wrapped_key
        .strip_prefix(b"DPAPI")
        .ok_or_else(|| "Electron encryption key has an unknown prefix".to_string())?;
    let key = dpapi_unprotect(wrapped_key)?;
    if key.len() != 32 {
        return Err("Electron encryption key has an invalid size".to_string());
    }

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| "Could not initialize Electron cookie decryption".to_string())?;
    let nonce_start = PREFIX_BYTES;
    let payload_start = PREFIX_BYTES + NONCE_BYTES;
    cipher
        .decrypt(
            Nonce::from_slice(&ciphertext[nonce_start..payload_start]),
            &ciphertext[payload_start..],
        )
        .map_err(|_| "Could not decrypt the Electron cookie".to_string())
}

fn copy_and_free_blob(blob: CRYPT_INTEGER_BLOB) -> Result<Vec<u8>, String> {
    if blob.cbData > 0 && blob.pbData.is_null() {
        return Err("DPAPI returned an invalid data buffer".to_string());
    }
    let bytes = if blob.cbData == 0 {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(blob.pbData, blob.cbData as usize) }.to_vec()
    };
    if !blob.pbData.is_null() {
        unsafe {
            LocalFree(HLOCAL(blob.pbData.cast()));
        }
    }
    Ok(bytes)
}

/// Load the stored cookie from disk and decrypt it. Legacy Electron `v10` blobs
/// are transparently re-encrypted into native Windows DPAPI on first load.
pub fn load_cookie(profile: Option<&str>) -> String {
    let Some(path) = cookie_file_path(profile) else { return String::new() };
    match std::fs::read(&path) {
        Ok(cipher) => {
            if cipher.is_empty() {
                return String::new();
            }
            let is_legacy_v10 = cipher.starts_with(b"v10");
            match decrypt_string(&cipher) {
                Ok(plain) => {
                    if is_legacy_v10 && !plain.is_empty() {
                        let _ = save_cookie(&plain, profile);
                    }
                    plain
                }
                Err(_) => String::new(),
            }
        }
        Err(_) => String::new(),
    }
}

/// Encrypt and persist the cookie to disk.
pub fn save_cookie(cookie: &str, profile: Option<&str>) -> bool {
    let Some(path) = cookie_file_path(profile) else { return false };
    if cookie.is_empty() {
        return match std::fs::remove_file(path) {
            Ok(()) => true,
            Err(error) => error.kind() == std::io::ErrorKind::NotFound,
        };
    }
    match encrypt_string(cookie) {
        Ok(cipher) => {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(&path, cipher).is_ok()
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dpapi_roundtrip_works_and_plaintext_prefix_is_rejected() {
        let encrypted = encrypt_string("sample-cookie-value").expect("dpapi encrypt");
        assert_eq!(
            decrypt_string(&encrypted).expect("dpapi decrypt"),
            "sample-cookie-value"
        );
        let mut fake_plain = vec![0u8, 0, 0, 0];
        fake_plain.extend_from_slice(b"plaintext-cookie");
        assert!(decrypt_string(&fake_plain).is_err());
    }
}
