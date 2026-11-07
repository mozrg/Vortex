use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

use crate::state::AppState;

/// The path where the encrypted .ROBLOSECURITY cookie is stored.
pub fn cookie_file_path() -> PathBuf {
    AppState::user_data_dir().join("rbx-presence.bin")
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

/// Decrypt either an Electron DPAPI blob or the temporary Rust placeholder format.
pub fn decrypt_string(cipher: &[u8]) -> Result<String, String> {
    // Keep cookies created by early Rust builds readable during this transition.
    if cipher.len() >= 4 && cipher[..4] == [0, 0, 0, 0] {
        return String::from_utf8(cipher[4..].to_vec()).map_err(|e| format!("UTF-8 error: {e}"));
    }
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

/// Load the stored cookie from disk and decrypt it.
pub fn load_cookie() -> String {
    let path = cookie_file_path();
    match std::fs::read(&path) {
        Ok(cipher) => {
            if cipher.is_empty() {
                return String::new();
            }
            match decrypt_string(&cipher) {
                Ok(plain) => plain,
                Err(_) => String::new(),
            }
        }
        Err(_) => String::new(),
    }
}

/// Encrypt and persist the cookie to disk.
pub fn save_cookie(cookie: &str) -> bool {
    let path = cookie_file_path();
    if cookie.is_empty() {
        let _ = std::fs::remove_file(&path);
        return true;
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

/// SHA-256 of a file's contents, returning a lowercase hex string.
pub async fn hash_file(path: &PathBuf) -> Result<String, String> {
    use tokio::io::AsyncReadExt;
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    let result = hasher.finalize();
    Ok(result
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>())
}
