use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverDataUrlResult {
    data_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutResolution {
    target_path: String,
    arguments: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutResolutionResult {
    target_path: String,
    arguments: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchAppResult {
    pid: u32,
}

#[tauri::command]
fn resolve_shortcut(path: String) -> Result<ShortcutResolutionResult, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("shortcut path is empty".to_string());
    }

    let script = r#"
$shortcutPath = $env:SHORTCUT_PATH
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
@{
  targetPath = $shortcut.TargetPath
  arguments = $shortcut.Arguments
} | ConvertTo-Json -Compress
"#;

    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env("SHORTCUT_PATH", trimmed)
        .output()
        .map_err(|error| format!("failed to run shortcut resolution: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("failed to resolve shortcut: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("shortcut resolution returned empty output".to_string());
    }

    let parsed: ShortcutResolution =
        serde_json::from_str(&stdout).map_err(|error| format!("invalid shortcut payload: {error}"))?;

    Ok(ShortcutResolutionResult {
        target_path: parsed.target_path,
        arguments: parsed.arguments,
    })
}

#[tauri::command]
fn launch_app(path: String, args: Option<String>) -> Result<LaunchAppResult, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("path is empty".to_string());
    }

    let trimmed_args = args.unwrap_or_default().trim().to_string();
    let script = r#"
$launchPath = $env:LAUNCH_PATH
$launchArgs = $env:LAUNCH_ARGS

if ([string]::IsNullOrWhiteSpace($launchArgs)) {
  $process = Start-Process -FilePath $launchPath -PassThru
} else {
  $process = Start-Process -FilePath $launchPath -ArgumentList $launchArgs -PassThru
}

$process.Id
"#;

    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env("LAUNCH_PATH", trimmed_path)
        .env("LAUNCH_ARGS", trimmed_args)
        .output()
        .map_err(|error| format!("failed to launch app: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("failed to launch app: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let pid = stdout
        .lines()
        .last()
        .and_then(|line| line.trim().parse::<u32>().ok())
        .ok_or_else(|| "launch command did not return process id".to_string())?;

    Ok(LaunchAppResult { pid })
}

#[tauri::command]
fn is_process_running(pid: u32) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let filter = format!("PID eq {pid}");
        let output = std::process::Command::new("tasklist")
            .args(["/FI", &filter, "/FO", "CSV", "/NH"])
            .output()
            .map_err(|error| format!("failed to check process status: {error}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(format!("tasklist failed: {stderr}"));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let lowered = stdout.to_ascii_lowercase();
        Ok(!lowered.contains("no tasks are running") && !stdout.trim().is_empty())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("process checks are only supported on Windows in this build".to_string())
    }
}

#[tauri::command]
fn load_cover_data_url(path: String) -> Result<CoverDataUrlResult, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("cover path is empty".to_string());
    }

    let bytes = std::fs::read(trimmed).map_err(|error| format!("failed to read cover: {error}"))?;

    let extension = Path::new(trimmed)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_default();

    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    };

    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(CoverDataUrlResult {
        data_url: format!("data:{mime};base64,{encoded}"),
    })
}

#[tauri::command]
fn write_library_export_file(path: String, content: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("export path is empty".to_string());
    }

    std::fs::write(trimmed, content).map_err(|error| format!("failed to write export file: {error}"))
}

#[tauri::command]
fn restart_system() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("shutdown")
            .args(["/r", "/t", "0"])
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("failed to restart system: {error}"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("restart is only supported on Windows in this build".to_string())
    }
}

#[tauri::command]
fn shutdown_system() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("shutdown")
            .args(["/s", "/t", "0"])
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("failed to shut down system: {error}"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("shutdown is only supported on Windows in this build".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            launch_app,
            is_process_running,
            resolve_shortcut,
            load_cover_data_url,
            write_library_export_file,
            restart_system,
            shutdown_system
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
