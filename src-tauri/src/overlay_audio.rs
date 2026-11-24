//! Per-process mute control for Roblox via WASAPI (`ISimpleAudioVolume`).
//!
//! Mutes or unmutes only `RobloxPlayerBeta.exe` / `Windows10Universal.exe`
//! audio sessions without affecting system volume or other applications.
use std::collections::HashSet;
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use windows::core::GUID;

static LAST_MUTED: AtomicBool = AtomicBool::new(false);

const CLSID_MMDEVICE_ENUMERATOR: GUID = GUID::from_u128(0xbcde0395_e52f_467c_8e3d_c4579291692e);
const IID_IMMDEVICE_ENUMERATOR: GUID = GUID::from_u128(0xa95664d2_9614_4f35_a746_de8db63617e6);
const IID_IAUDIO_SESSION_MANAGER2: GUID = GUID::from_u128(0x77aa99a0_1bd6_484f_8bc7_2c654c9a9b6f);
const IID_IAUDIO_SESSION_CONTROL2: GUID = GUID::from_u128(0xbfb7ff88_7239_4fc9_8fa2_07c950be9c6d);
const IID_ISIMPLE_AUDIO_VOLUME: GUID = GUID::from_u128(0x87ce5498_68d6_44e5_9215_6da47ef883d8);
const CLSCTX_ALL: u32 = 23;
const COINIT_MULTITHREADED: u32 = 0;
const S_OK: i32 = 0;
const S_FALSE: i32 = 1;

#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(reserved: *const c_void, coinit: u32) -> i32;
    fn CoUninitialize();
    fn CoTaskMemFree(pv: *mut c_void);
    fn CoCreateInstance(
        rclsid: *const GUID,
        outer: *mut c_void,
        context: u32,
        riid: *const GUID,
        result: *mut *mut c_void,
    ) -> i32;
}

struct ComGuard(bool);

impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.0 {
            unsafe {
                CoUninitialize();
            }
        }
    }
}

unsafe fn read_device_id(device: &ComPtr) -> Option<String> {
    // IMMDevice vtable: 0=QI, 1=AddRef, 2=Release, 3=Activate, 4=OpenPropertyStore, 5=GetId
    let get_id: unsafe extern "system" fn(*mut c_void, *mut *mut u16) -> i32 =
        std::mem::transmute(*device.vtable().add(5));
    let mut id_ptr: *mut u16 = std::ptr::null_mut();
    if get_id(device.0, &mut id_ptr) < 0 || id_ptr.is_null() {
        return None;
    }
    let mut len = 0usize;
    while len < 1024 && *id_ptr.add(len) != 0 {
        len += 1;
    }
    let slice = std::slice::from_raw_parts(id_ptr, len);
    let id = String::from_utf16_lossy(slice);
    CoTaskMemFree(id_ptr.cast());
    Some(id)
}

struct ComPtr(*mut c_void);

impl ComPtr {
    unsafe fn vtable(&self) -> *const usize {
        *(self.0 as *const *const usize)
    }

    unsafe fn query_interface(&self, iid: &GUID) -> Option<ComPtr> {
        let qi: unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> i32 =
            std::mem::transmute(*self.vtable().add(0));
        let mut out = std::ptr::null_mut();
        (qi(self.0, iid, &mut out) >= 0 && !out.is_null()).then_some(ComPtr(out))
    }
}

impl Drop for ComPtr {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                let release: unsafe extern "system" fn(*mut c_void) -> u32 =
                    std::mem::transmute(*self.vtable().add(2));
                release(self.0);
            }
        }
    }
}

/// Toggle mute on all active Roblox audio sessions, or set an explicit state
/// when `explicit` is `Some(muted)`. Returns `(new_mute_state, sessions_found)`.
pub fn set_or_toggle_roblox_mute(explicit: Option<bool>) -> Result<(bool, usize), String> {
    unsafe {
        // Declared first so all ComPtr instances release before CoUninitialize runs.
        let co_hr = CoInitializeEx(std::ptr::null(), COINIT_MULTITHREADED);
        let _com_guard = ComGuard(co_hr == S_OK || co_hr == S_FALSE);
        let mut enumerator_raw = std::ptr::null_mut();
        let hr = CoCreateInstance(
            &CLSID_MMDEVICE_ENUMERATOR,
            std::ptr::null_mut(),
            CLSCTX_ALL,
            &IID_IMMDEVICE_ENUMERATOR,
            &mut enumerator_raw,
        );
        if hr < 0 || enumerator_raw.is_null() {
            return Err("Could not initialize Windows audio device enumerator".into());
        }
        let enumerator = ComPtr(enumerator_raw);
        let get_default_endpoint: unsafe extern "system" fn(
            *mut c_void,
            i32,
            i32,
            *mut *mut c_void,
        ) -> i32 = std::mem::transmute(*enumerator.vtable().add(4));

        let mut volumes: Vec<ComPtr> = Vec::new();
        let mut seen_devices: HashSet<String> = HashSet::new();
        let mut any_unmuted = false;

        // Check both eConsole (0) and eMultimedia (1) render endpoints, deduplicating
        // when both roles point to the same default audio device.
        for role in [0i32, 1i32] {
            let mut device_raw = std::ptr::null_mut();
            if get_default_endpoint(enumerator.0, 0, role, &mut device_raw) < 0
                || device_raw.is_null()
            {
                continue;
            }
            let device = ComPtr(device_raw);
            if let Some(device_id) = read_device_id(&device) {
                if !seen_devices.insert(device_id) {
                    continue;
                }
            }
            let activate: unsafe extern "system" fn(
                *mut c_void,
                *const GUID,
                u32,
                *const c_void,
                *mut *mut c_void,
            ) -> i32 = std::mem::transmute(*device.vtable().add(3));
            let mut manager_raw = std::ptr::null_mut();
            if activate(
                device.0,
                &IID_IAUDIO_SESSION_MANAGER2,
                CLSCTX_ALL,
                std::ptr::null(),
                &mut manager_raw,
            ) < 0
                || manager_raw.is_null()
            {
                continue;
            }
            let manager = ComPtr(manager_raw);
            let get_session_enum: unsafe extern "system" fn(
                *mut c_void,
                *mut *mut c_void,
            ) -> i32 = std::mem::transmute(*manager.vtable().add(5));
            let mut session_enum_raw = std::ptr::null_mut();
            if get_session_enum(manager.0, &mut session_enum_raw) < 0
                || session_enum_raw.is_null()
            {
                continue;
            }
            let session_enum = ComPtr(session_enum_raw);
            let get_count: unsafe extern "system" fn(*mut c_void, *mut i32) -> i32 =
                std::mem::transmute(*session_enum.vtable().add(3));
            let get_session: unsafe extern "system" fn(
                *mut c_void,
                i32,
                *mut *mut c_void,
            ) -> i32 = std::mem::transmute(*session_enum.vtable().add(4));
            let mut count = 0i32;
            if get_count(session_enum.0, &mut count) < 0 || count <= 0 {
                continue;
            }
            for index in 0..count {
                let mut control_raw = std::ptr::null_mut();
                if get_session(session_enum.0, index, &mut control_raw) < 0
                    || control_raw.is_null()
                {
                    continue;
                }
                let control = ComPtr(control_raw);
                let Some(control2) = control.query_interface(&IID_IAUDIO_SESSION_CONTROL2) else {
                    continue;
                };
                let get_pid: unsafe extern "system" fn(*mut c_void, *mut u32) -> i32 =
                    std::mem::transmute(*control2.vtable().add(14));
                let mut pid = 0u32;
                if get_pid(control2.0, &mut pid) < 0 || pid == 0 {
                    continue;
                }
                if !crate::runtime::is_player_pid(pid) {
                    continue;
                }
                let Some(volume) = control.query_interface(&IID_ISIMPLE_AUDIO_VOLUME) else {
                    continue;
                };
                let get_mute: unsafe extern "system" fn(*mut c_void, *mut i32) -> i32 =
                    std::mem::transmute(*volume.vtable().add(6));
                let mut muted = 0i32;
                if get_mute(volume.0, &mut muted) >= 0 && muted == 0 {
                    any_unmuted = true;
                }
                volumes.push(volume);
            }
        }

        let target_mute = match explicit {
            Some(value) => value,
            None if !volumes.is_empty() => any_unmuted,
            None => !LAST_MUTED.load(Ordering::Relaxed),
        };
        let found = volumes.len();
        for volume in &volumes {
            let set_mute: unsafe extern "system" fn(*mut c_void, i32, *const GUID) -> i32 =
                std::mem::transmute(*volume.vtable().add(5));
            let _ = set_mute(volume.0, i32::from(target_mute), std::ptr::null());
        }
        LAST_MUTED.store(target_mute, Ordering::Relaxed);
        Ok((target_mute, found))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enumerates_audio_sessions_without_error() {
        let result = set_or_toggle_roblox_mute(Some(false));
        assert!(result.is_ok(), "WASAPI session scan failed: {result:?}");
    }
}
