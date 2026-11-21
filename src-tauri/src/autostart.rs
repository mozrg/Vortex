use std::io;
use std::path::Path;
use winreg::{enums::*, RegKey};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE: &str = "Vortex Launcher";

fn registered(run: &RegKey) -> io::Result<bool> {
    match run.get_value::<String, _>(VALUE) {
        Ok(command) => Ok(!command.trim().is_empty()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

fn write_entry(run: &RegKey, enabled: bool, executable: &Path) -> io::Result<()> {
    if enabled {
        let command = format!("\"{}\"", executable.display());
        if command.encode_utf16().count() >= 260 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Startup path is too long",
            ));
        }
        run.set_value(VALUE, &command)
    } else {
        match run.delete_value(VALUE) {
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            result => result,
        }
    }
}

#[tauri::command]
pub fn windows_autostart_status() -> Result<bool, String> {
    match RegKey::predef(HKEY_CURRENT_USER).open_subkey(RUN_KEY) {
        Ok(run) => registered(&run).map_err(|error| error.to_string()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn windows_autostart_set(window: tauri::WebviewWindow, enabled: bool) -> Result<bool, String> {
    if window.label() != "main" {
        return Err("Autostart is available in the main window".into());
    }
    let current_user = RegKey::predef(HKEY_CURRENT_USER);
    let run = if enabled {
        current_user.create_subkey(RUN_KEY).map(|(key, _)| key)
    } else {
        current_user.open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
    };
    let run = match run {
        Ok(run) => run,
        Err(error) if !enabled && error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.to_string()),
    };
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    write_entry(&run, enabled, &exe).map_err(|error| error.to_string())?;
    windows_autostart_status()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_a_quoted_executable_and_removes_only_its_own_value() {
        let user = RegKey::predef(HKEY_CURRENT_USER);
        let path = format!(r"Software\Vortex-autostart-test-{}", uuid::Uuid::new_v4());
        let (key, _) = user.create_subkey(&path).unwrap();
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert!(!registered(&key).unwrap());
            key.set_value("Other", &"keep").unwrap();
            let exe = Path::new(r"C:\Programs\Vortex Launcher\vortex-launcher.exe");
            write_entry(&key, true, exe).unwrap();
            assert!(registered(&key).unwrap());
            assert_eq!(
                key.get_value::<String, _>(VALUE).unwrap(),
                format!("\"{}\"", exe.display())
            );
            write_entry(&key, false, exe).unwrap();
            write_entry(&key, false, exe).unwrap();
            assert!(!registered(&key).unwrap());
            assert_eq!(key.get_value::<String, _>("Other").unwrap(), "keep");
        }));
        drop(key);
        user.delete_subkey(&path).unwrap();
        if let Err(payload) = result {
            std::panic::resume_unwind(payload);
        }
    }
}
