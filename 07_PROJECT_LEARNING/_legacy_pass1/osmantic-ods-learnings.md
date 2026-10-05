# Forensic Learning Record (Deep Inspection): Osmantic/ODS

> **Canonical Artifact**: `07_PROJECT_LEARNING/osmantic-ods-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Osmantic/ODS](https://github.com/Osmantic/ODS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:09:47.043Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Osmantic/ODS`
- **Description**: ODS V3 Pre-Release: Public testing and refinement ahead of the official V3 launch. Turn your PC, Mac, or Linux box into a private AI server.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6908 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `installer/postcss.config.js`
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### Core Architecture Module: `installer/src-tauri/src/commands.rs`
```
use crate::state::{GpuInfo, InstallPhase, InstallState};
use crate::{docker, gpu, installer, platform};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

const ALLOWED_FEATURES: &[&str] = &["voice", "workflows", "rag", "image_gen", "all"];

static INSTALL_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

struct InstallPermit;

impl Drop for InstallPermit {
    fn drop(&mut self) {
        INSTALL_IN_PROGRESS.store(false, Ordering::Release);
    }
}

fn acquire_install_permit() -> Result<InstallPermit, String> {
    INSTALL_IN_PROGRESS
        .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
        .map(|_| InstallPermit)
        .map_err(|_| "An ODS installation is already in progress.".into())
}

// ---- System Check ----

#[derive(Serialize)]
pub struct SystemCheckResult {
    pub system: platform::SystemInfo,
    pub requirements: Vec<platform::RequirementCheck>,
    pub docker: docker::DockerStatus,
}

#[tauri::command]
pub fn check_system() -> SystemCheckResult {
    let system = platform::check_system();
    let requirements = platform::check_requirements(&system);
    let docker = docker::check();

    SystemCheckResult {
        system,
        requirements,
        docker,
    }
}

// ---- Prerequisites ----

#[derive(Serialize)]
pub struct PrerequisiteStatus {
    pub git_installed: bool,
    pub docker_installed: bool,
    pub docker_running: bool,
    pub wsl2_needed: bool,
    pub wsl2_installed: bool,
    pub all_met: bool,
}

#[tauri::command]
pub fn check_prerequisites() -> PrerequisiteStatus {
    let git = which::which("git").is_ok();
    let docker_status = docker::check();
    let wsl2_needed = cfg!(target_os = "windows");
    let wsl2_installed = if wsl2_needed {
        std::process::Command::new("wsl")
            .args(["--status"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    } else {
        true
    };

    let all_met = git
        && docker_status.installed
        && docker_status.running
        && docker_status.compose_installed
        && (!wsl2_needed || wsl2_installed);

    PrerequisiteStatus {
        git_installed: git,
        docker_installed: docker_status.installed,
        docker_running: docker_status.running,
        wsl2_needed,
        wsl2_installed,
        all_met,
    }
}

// ---- Install Prerequisites ----

#[derive(Serialize)]
pub struct InstallPrereqResult {
    pub success: bool,
    pub message: String,
    pub reboot_required: bool,
}

#[tauri::command]
pub async fn install_prerequisites(component: String) -> InstallPrereqResult {
    match component.as_str() {
        "docker" => match docker::install_docker().await {
            Ok(msg) => InstallPrereqResult {
                success: true,
                message: msg,
                reboot_required: false,
            },
            Err(msg) => InstallPrereqResult {
                success: false,
                message: msg,
                reboot_required: false,
            },
        },
        #[cfg(target_os = "windows")]
        "wsl2" => match crate::platform::windows::install_wsl2() {
            Ok(needs_reboot) => InstallPrereqResult {
                success: true,
                message: if needs_reboot {
                    "WSL2 installed. A restart is required to complete setup.".into()
                } else {
                    "WSL2 is ready.".into()
                },
                reboot_required: needs_reboot,
            },
            Err(msg) => InstallPrereqResult {
                success: false,
                message: msg,
                reboot_required: false,
            },
        },
        _ => InstallPrereqResult {
            success: false,
            message: format!("Unknown component: {}", component),
            reboot_required: false,
        },
    }
}

// ---- GPU Detection ----

#[derive(Serialize)]
pub struct GpuResult {
    pub gpu: GpuInfo,
    pub recommended_tier: u8,
    pub tier_description: String,
}

#[tauri::command]
pub fn detect_gpu() -> GpuResult {
    let gpu = gpu::detect();
    let tier = gpu::recommend_tier(&gpu);
    let desc = tier_description(tier);

    GpuResult {
        gpu,
        recommended_tier: tier,
        tier_description: desc,
    }
}

fn tier_description(tier: u8) -> String {
    match tier {
        0 => "Cloud Mode — No local GPU detected. Uses cloud AI providers.".into(),
        1 => "Tier 1 — Qwen3-8B (8GB VRAM). Great for chat, code help, and general tasks.".into(),
        2 => "Tier 2 — Qwen3-14B (12GB+ VRAM). Stronger reasoning and longer context.".into(),
        3 => "Tier 3 — Qwen3-32B (24GB+ VRAM). Professional-grade for complex tasks.".into(),
        4 => "Tier 4 — Qwen3-72B (48GB+ VRAM). Enterprise-level, best quality.".into(),
        _ => "Unknown tier".into(),
    }
}

// ---- Installation ----

#[tauri::command]
pub async fn start_install(
    tier: u8,
    features: Vec<String>,
    install_dir: Option<String>,
) -> Result<String, String> {
    validate_install_request(tier, &features)?;
    // The installer mutates a shared checkout and its Docker project. A single
    // process-wide permit prevents duplicate UI requests from racing those
    // side effects and leaving a half-applied installation behind.
    let permit = acquire_install_permit()?;

    let dir = install_dir
        .map(std::path::PathBuf::from)
        .unwrap_or_else(installer::default_install_dir);

    let state = std::sync::Arc::new(Mutex::new(InstallState {
        phase: InstallPhase::Installing,
        install_dir: Some(dir.to_string_lossy().to_string()),
        selected_tier: Some(tier),
        selected_features: features.clone(),
        ..Default::default()
    }));

    let state_clone = state.clone();

    // Run installation in a blocking thread
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        installer::run_install(state_clone, dir, tier, features)
    })
        .await
        .map_err(|e| format!("Install task failed: {}", e))?
        .map(|_| "Installation complete!".to_string())
}

fn validate_install_request(tier: u8, features: &[String]) -> Result<(), String> {
    if tier > 4 {
        return Err(format!("Unsupported install tier: {}", tier));
    }

    for feature in features {
        if !ALLOWED_FEATURES.contains(&feature.as_str()) {
            return Err(format!("Unsupported feature: {}", feature));
        }
    }

    Ok(())
}

// ---- Progress ----

#[tauri::command]
pub fn get_install_progress() -> ProgressInfo {
    // Read from persisted state
    let state_path = state_file_path();
    if let Ok(data) = std::fs::read_to_string(&state_path) {
        if let Ok(state) = serde_json::from_str::<InstallState>(&data) {
            return ProgressInfo {
                phase: format!("{:?}", state.phase),
                percent: state.progress_pct,
                message: state.progress_message,
                error: state.error,
            };
        }
    }

    ProgressInfo {
        phase: "unknown".into(),
        percent: 0,
        message: "Waiting for installer...".into(),
        error: None,
    }
}

#[derive(Serialize)]
pub struct ProgressInfo {
    pub phase: String,
    pub percent: u8,
    pub message: String,
    pub error: Option<String>,
}

// ---- State ----

#[tauri::command]
pub fn get_install_state() -> InstallState {
    let state_path = state_file_path();
    if let Ok(data) = std::fs::read_to_string(&state_path) {
        if let Ok(state) = serde_json::from_str::<InstallState>(&data) {
            return state;
        }
    }
    InstallState::default()
}

// ---- Open ODS ----

#[tauri::command]
pub fn open_ods() -> Result<(), String> {
    let url = "http://localhost:3000";
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", url])
            .spawn()
            .map_err(|e| format!("Fail
```

### Core Architecture Module: `installer/src-tauri/src/docker.rs`
```
use std::process::Command;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DockerStatus {
    pub installed: bool,
    pub running: bool,
    pub version: Option<String>,
    pub compose_installed: bool,
    pub compose_version: Option<String>,
}

/// Check if Docker is installed and running.
pub fn check() -> DockerStatus {
    let version = get_docker_version();
    let installed = version.is_some();
    let running = if installed { is_docker_running() } else { false };
    let compose_version = get_compose_version();
    let compose_installed = compose_version.is_some();

    DockerStatus { installed, running, version, compose_installed, compose_version }
}

fn get_docker_version() -> Option<String> {
    let out = Command::new("docker").args(["--version"]).output().ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        None
    }
}

fn is_docker_running() -> bool {
    Command::new("docker")
        .args(["info"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn get_compose_version() -> Option<String> {
    // Try "docker compose" (v2 plugin) first
    let out = Command::new("docker")
        .args(["compose", "version", "--short"])
        .output()
        .ok()?;

    if out.status.success() {
        return Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }

    // Fallback: docker-compose (standalone v1)
    let out = Command::new("docker-compose")
        .args(["--version"])
        .output()
        .ok()?;

    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        None
    }
}

/// Get the Docker Desktop download URL for the current platform.
pub fn download_url() -> &'static str {
    #[cfg(target_os = "windows")]
    { "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" }
    #[cfg(target_os = "macos")]
    {
        if cfg!(target_arch = "aarch64") {
            "https://desktop.docker.com/mac/main/arm64/Docker.dmg"
        } else {
            "https://desktop.docker.com/mac/main/amd64/Docker.dmg"
        }
    }
    #[cfg(target_os = "linux")]
    { "https://docs.docker.com/engine/install/" }
}

/// Return Docker installation guidance.
///
/// The desktop installer intentionally does not execute Docker's Linux
/// convenience script or downloaded Docker Desktop installers. Docker has
/// host-level privileges, so users should install it through a visible,
/// verifiable flow and then rerun prerequisite checks.
pub async fn install_docker() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        Err(format!(
            "For safety, the desktop installer does not run Docker's convenience script automatically.\n\nInstall Docker Engine using the official instructions, then rerun prerequisite checks:\n{}\n\nYou can also run ODS's shell installer from a terminal if you want the guided prerequisite flow.",
            download_url()
        ))
    }

    #[cfg(target_os = "windows")]
    {
        Err(format!(
            "For safety, the desktop installer does not download or run Docker Desktop automatically.\n\nInstall Docker Desktop manually, verify the installer publisher, then rerun prerequisite checks:\n{}",
            download_url()
        ))
    }

    #[cfg(target_os = "macos")]
    {
        Err(format!(
            "For safety, the desktop installer does not install Docker Desktop automatically.\n\nInstall Docker Desktop manually, then open it once from Applications before rerunning prerequisite checks:\n{}",
            download_url()
        ))
    }
}

```

### Core Architecture Module: `installer/src-tauri/src/gpu.rs`
```
use crate::state::{GpuInfo, GpuVendor};
use std::process::Command;

/// Detect the primary GPU on this system.
pub fn detect() -> GpuInfo {
    #[cfg(target_os = "windows")]
    {
        detect_windows()
    }
    #[cfg(target_os = "macos")]
    {
        detect_macos()
    }
    #[cfg(target_os = "linux")]
    {
        detect_linux()
    }
}

/// Recommend a ODS tier based on detected GPU VRAM.
pub fn recommend_tier(gpu: &GpuInfo) -> u8 {
    match gpu.vram_mb {
        0 => 0,                    // CPU-only / cloud
        v if v < 8192 => 1,       // < 8GB
        v if v < 12288 => 1,      // 8GB — Tier 1
        v if v < 24576 => 2,      // 12-24GB — Tier 2
        v if v < 49152 => 3,      // 24-48GB — Tier 3
        _ => 4,                    // 48GB+ — Tier 4
    }
}

// ---------------------------------------------------------------------------
// Windows: try nvidia-smi first, then fall back to WMIC/PowerShell
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn detect_windows() -> GpuInfo {
    // Try NVIDIA first
    if let Some(gpu) = try_nvidia_smi() {
        return gpu;
    }

    // Fall back to PowerShell WMI query for any GPU
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM, DriverVersion | ConvertTo-Json",
        ])
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
            let name = val["Name"].as_str().unwrap_or("Unknown GPU").to_string();
            let vram = val["AdapterRAM"].as_u64().unwrap_or(0) / (1024 * 1024);
            let driver = val["DriverVersion"].as_str().map(String::from);
            let vendor = classify_vendor(&name);
            return GpuInfo { vendor, name, vram_mb: vram, driver_version: driver };
        }
    }

    GpuInfo { vendor: GpuVendor::None, name: "No GPU detected".into(), vram_mb: 0, driver_version: None }
}

// ---------------------------------------------------------------------------
// macOS: system_profiler
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
fn detect_macos() -> GpuInfo {
    let output = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(displays) = val["SPDisplaysDataType"].as_array() {
                if let Some(gpu) = displays.first() {
                    let name = gpu["sppci_model"].as_str().unwrap_or("Apple GPU").to_string();
                    // Apple Silicon reports unified memory; estimate GPU-available portion
                    let vram_str = gpu["spdisplays_vram"].as_str().unwrap_or("0");
                    let vram = parse_vram_string(vram_str);
                    return GpuInfo {
                        vendor: GpuVendor::Apple,
                        name,
                        vram_mb: vram,
                        driver_version: None,
                    };
                }
            }
        }
    }

    // Fallback: assume Apple Silicon with unified memory via sysctl
    let mem_output = Command::new("sysctl").args(["-n", "hw.memsize"]).output();
    if let Ok(out) = mem_output {
        let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if let Ok(bytes) = text.parse::<u64>() {
            // Apple Silicon shares ~75% of unified memory with GPU
            let gpu_share_mb = (bytes / (1024 * 1024)) * 3 / 4;
            return GpuInfo {
                vendor: GpuVendor::Apple,
                name: "Apple Silicon".into(),
                vram_mb: gpu_share_mb,
                driver_version: None,
            };
        }
    }

    GpuInfo { vendor: GpuVendor::None, name: "No GPU detected".into(), vram_mb: 0, driver_version: None }
}

// ---------------------------------------------------------------------------
// Linux: nvidia-smi, rocm-smi, or lspci fallback
// ---------------------------------------------------------------------------

#[cfg(target_os = "linux")]
fn detect_linux() -> GpuInfo {
    if let Some(gpu) = try_nvidia_smi() {
        return gpu;
    }

    // Try AMD ROCm
    let output = Command::new("rocm-smi")
        .args(["--showmeminfo", "vram", "--json"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                // Parse first card's VRAM
                if let Some(obj) = val.as_object() {
                    for (_key, card) in obj {
                        if let Some(total) = card["VRAM Total Memory (B)"].as_str() {
                            let bytes: u64 = total.parse().unwrap_or(0);
                            let vram_mb = bytes / (1024 * 1024);
                            // Get card name from rocm-smi --showproductname
                            let name = get_amd_name().unwrap_or_else(|| "AMD GPU".into());
                            return GpuInfo {
                                vendor: GpuVendor::Amd,
                                name,
                                vram_mb,
                                driver_version: None,
                            };
                        }
                    }
                }
            }
        }
    }

    // Fallback: lspci
    let output = Command::new("lspci").output();
    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            let lower = line.to_lowercase();
            if lower.contains("vga") || lower.contains("3d") || lower.contains("display") {
                let vendor = classify_vendor(line);
                if vendor != GpuVendor::None {
                    return GpuInfo {
                        vendor,
                        name: line.to_string(),
                        vram_mb: 0, // Can't determine from lspci
                        driver_version: None,
                    };
                }
            }
        }
    }

    GpuInfo { vendor: GpuVendor::None, name: "No GPU detected".into(), vram_mb: 0, driver_version: None }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn try_nvidia_smi() -> Option<GpuInfo> {
    let output = Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next()?;
    let parts: Vec<&str> = line.split(", ").collect();

    if parts.len() >= 3 {
        let name = parts[0].trim().to_string();
        let vram_mb: u64 = parts[1].trim().parse().unwrap_or(0);
        let driver = parts[2].trim().to_string();
        Some(GpuInfo {
            vendor: GpuVendor::Nvidia,
            name,
            vram_mb,
            driver_version: Some(driver),
        })
    } else {
        None
    }
}

#[cfg(target_os = "linux")]
fn get_amd_name() -> Option<String> {
    let out = Command::new("rocm-smi")
        .args(["--showproductname"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        if line.contains("Card series:") {
            return Some(line.split(':').nth(1)?.trim().to_string());
        }
    }
    None
}

fn classify_vendor(name:
```

### Core Architecture Module: `installer/src-tauri/src/installer.rs`
```
use crate::state::{InstallPhase, InstallState};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

const DEFAULT_REPO_URL: &str = "https://github.com/Osmantic/ODS.git";
const DEFAULT_INSTALL_REF: &str = "main";
const TRANSFERRED_REPO_URL_BYTES: &[u8] = &[
    104, 116, 116, 112, 115, 58, 47, 47, 103, 105, 116, 104, 117, 98, 46, 99, 111, 109, 47, 76,
    105, 103, 104, 116, 45, 72, 101, 97, 114, 116, 45, 76, 97, 98, 115, 47, 79, 68, 83, 46, 103,
    105, 116,
];

fn repo_url() -> &'static str {
    option_env!("ODS_REPO_URL").unwrap_or(DEFAULT_REPO_URL)
}

fn install_ref() -> &'static str {
    option_env!("ODS_INSTALL_REF").unwrap_or(DEFAULT_INSTALL_REF)
}

#[derive(Debug, Clone, Serialize)]
pub struct ProgressEvent {
    pub phase: String,
    pub percent: u8,
    pub message: String,
}

/// Run the full ODS installation.
/// This clones the repo and delegates to the existing install-core.sh.
pub fn run_install(
    state: Arc<Mutex<InstallState>>,
    install_dir: PathBuf,
    tier: u8,
    features: Vec<String>,
) -> Result<(), String> {
    // Phase 1: Clone the repo
    update_progress(&state, "Downloading ODS", 5);

    ensure_checkout(&install_dir)?;

    update_progress(&state, "Configuring installation", 15);

    // Phase 2: Build installer arguments
    let ods_dir = install_dir.join("ods");
    let mut args = vec!["--tier".to_string(), tier.to_string()];

    if features.contains(&"voice".to_string()) {
        args.push("--voice".into());
    }
    if features.contains(&"workflows".to_string()) {
        args.push("--workflows".into());
    }
    if features.contains(&"rag".to_string()) {
        args.push("--rag".into());
    }
    if features.contains(&"image_gen".to_string()) {
        args.push("--image-gen".into());
    }
    if features.contains(&"all".to_string()) {
        args.push("--all".into());
    }

    // Phase 3: Run the installer with progress parsing
    update_progress(&state, "Running installer", 20);

    let install_script = ods_dir.join("install.sh");
    let install_ps1 = install_dir.join("install.ps1");

    // Make sure the script is executable
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("chmod")
            .args(["+x", &install_script.to_string_lossy()])
            .output();
    }

    let mut child = if cfg!(target_os = "windows") {
        let mut ps_args = vec![
            "-NoProfile".to_string(),
            "-ExecutionPolicy".to_string(),
            "Bypass".to_string(),
            "-File".to_string(),
            install_ps1.to_string_lossy().to_string(),
            "-NonInteractive".to_string(),
            "-Tier".to_string(),
            tier.to_string(),
        ];

        for feature in &features {
            match feature.as_str() {
                "voice" => ps_args.push("-Voice".into()),
                "workflows" => ps_args.push("-Workflows".into()),
                "rag" => ps_args.push("-Rag".into()),
                "image_gen" => ps_args.push("-Comfyui".into()),
                "all" => ps_args.push("-All".into()),
                _ => {}
            }
        }

        Command::new("powershell.exe")
            .args(&ps_args)
            .current_dir(&install_dir)
            .env("ODS_INSTALLER_GUI", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Windows installer: {}", e))?
    } else {
        Command::new(&install_script)
            .args(&args)
            .current_dir(&ods_dir)
            .env("ODS_INSTALLER_GUI", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start installer: {}", e))?
    };

    let stderr_handle = child.stderr.take().map(|stderr| {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            reader
                .lines()
                .map_while(Result::ok)
                .collect::<Vec<String>>()
        })
    });

    // Parse stdout for progress updates
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if let Some(progress) = parse_progress_line(&line) {
                    update_progress(&state, &progress.message, progress.percent);
                }
            }
        }
    }

    let output = child
        .wait()
        .map_err(|e| format!("Installer process error: {}", e))?;
    let stderr_lines = stderr_handle
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default();

    if output.success() {
        update_progress(&state, "Installation complete!", 100);
        let mut s = state.lock().unwrap();
        s.phase = InstallPhase::Complete;
        let _ = s.save();
        Ok(())
    } else {
        let detail = stderr_lines
            .iter()
            .rev()
            .take(10)
            .cloned()
            .collect::<Vec<String>>()
            .into_iter()
            .rev()
            .collect::<Vec<String>>()
            .join("\n");
        if detail.is_empty() {
            Err("Installation failed. Check logs for details.".into())
        } else {
            Err(format!("Installation failed:\n{}", detail))
        }
    }
}

fn ensure_checkout(install_dir: &Path) -> Result<(), String> {
    if install_dir.join("ods").exists() {
        return validate_checkout(install_dir);
    }

    if install_dir.exists()
        && install_dir
            .read_dir()
            .map_err(|e| e.to_string())?
            .next()
            .is_some()
    {
        return Err(format!(
            "{} already exists but is not an ODS checkout. Choose an empty directory or the existing ODS install directory.",
            install_dir.display()
        ));
    }

    let clone = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            "--branch",
            install_ref(),
            repo_url(),
        ])
        .arg(install_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to clone repository: {}", e))?;

    if !clone.status.success() {
        let err = String::from_utf8_lossy(&clone.stderr);
        return Err(format!(
            "Git clone failed for ODS ref '{}': {}",
            install_ref(),
            err
        ));
    }

    validate_checkout(install_dir)
}

fn validate_checkout(install_dir: &Path) -> Result<(), String> {
    if !install_dir.join(".git").exists() {
        return Err(format!(
            "{} contains an ods directory but is not a git checkout. Refusing to run installer scripts from an unverified directory.",
            install_dir.display()
        ));
    }

    let is_work_tree = run_git(install_dir, &["rev-parse", "--is-inside-work-tree"])?;
    if is_work_tree.trim() != "true" {
        return Err(format!(
            "{} is not a valid git worktree.",
            install_dir.display()
        ));
    }

    let origin = run_git(install_dir, &["remote", "get-url", "origin"])?;
    if !repo_urls_identify_same_repository(&origin, repo_url()) {
        return Err(format!(
            "{} is not an ODS checkout from {}.",
            install_dir.display(),
            repo_url()
        ));
    }

    Ok(())
}

fn run_git(install_dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(install_dir)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
      
```

### Core Architecture Module: `installer/src-tauri/src/main.rs`
```
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod docker;
mod gpu;
mod installer;
mod platform;
mod state;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::check_system,
            commands::check_prerequisites,
            commands::install_prerequisites,
            commands::detect_gpu,
            commands::start_install,
            commands::get_install_progress,
            commands::get_install_state,
            commands::open_ods,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

```

### Core Architecture Module: `installer/src-tauri/src/platform/linux.rs`
```
use super::SystemInfo;
use std::process::Command;

pub fn check_system() -> SystemInfo {
    let os_version = get_os_version();
    let ram_gb = get_ram_gb();
    let disk_free_gb = get_disk_free_gb();
    let hostname = std::fs::read_to_string("/etc/hostname")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "unknown".into());

    SystemInfo {
        os: "Linux".into(),
        os_version,
        arch: std::env::consts::ARCH.into(),
        ram_gb,
        disk_free_gb,
        hostname,
        wsl2_available: None,
        wsl2_installed: None,
    }
}

fn get_os_version() -> String {
    // Try /etc/os-release first
    if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
        for line in content.lines() {
            if line.starts_with("PRETTY_NAME=") {
                return line
                    .trim_start_matches("PRETTY_NAME=")
                    .trim_matches('"')
                    .to_string();
            }
        }
    }

    let out = Command::new("uname").args(["-sr"]).output();
    match out {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        _ => "Linux (unknown version)".into(),
    }
}

fn get_ram_gb() -> f64 {
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            if line.starts_with("MemTotal:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let kb: f64 = parts[1].parse().unwrap_or(0.0);
                    return kb / (1024.0 * 1024.0);
                }
            }
        }
    }
    0.0
}

fn get_disk_free_gb() -> f64 {
    let out = Command::new("df")
        .args(["--output=avail", "-BG", "/"])
        .output();
    match out {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            if let Some(line) = text.lines().nth(1) {
                return line.trim().trim_end_matches('G').parse().unwrap_or(0.0);
            }
            0.0
        }
        _ => 0.0,
    }
}

```

### Core Architecture Module: `installer/src-tauri/src/platform/macos.rs`
```
use super::SystemInfo;
use std::process::Command;

pub fn check_system() -> SystemInfo {
    let os_version = get_os_version();
    let ram_gb = get_ram_gb();
    let disk_free_gb = get_disk_free_gb();
    let hostname = Command::new("hostname")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".into());

    SystemInfo {
        os: "macOS".into(),
        os_version,
        arch: std::env::consts::ARCH.into(),
        ram_gb,
        disk_free_gb,
        hostname,
        wsl2_available: None,
        wsl2_installed: None,
    }
}

fn get_os_version() -> String {
    let out = Command::new("sw_vers").args(["-productVersion"]).output();
    match out {
        Ok(o) if o.status.success() => {
            format!("macOS {}", String::from_utf8_lossy(&o.stdout).trim())
        }
        _ => "macOS (unknown version)".into(),
    }
}

fn get_ram_gb() -> f64 {
    let out = Command::new("sysctl").args(["-n", "hw.memsize"]).output();
    match out {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
            text.parse::<f64>().unwrap_or(0.0) / (1024.0 * 1024.0 * 1024.0)
        }
        _ => 0.0,
    }
}

fn get_disk_free_gb() -> f64 {
    let out = Command::new("df").args(["-g", "/"]).output();
    match out {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            // df -g output: Filesystem 1G-blocks Used Available ...
            if let Some(line) = text.lines().nth(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    return parts[3].parse().unwrap_or(0.0);
                }
            }
            0.0
        }
        _ => 0.0,
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3140** (2026-09-04): **Guide dashboard setup failed with "Failed to mark setup complete"**
  *Symptoms*: ### Description  I accessed the URL http://localhost:3001 and followed up the guided process.  No matters which option I choose I always get:  `ods-dashboard  | 192.168.16.1 - - [24/Aug/2026:19:56:27 +0000] "POST /api/setup/complete HTTP/1.1" 500 21 "http://localhost:3001/" "Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0" "-" `  <img width="1198" height="1475" alt="Image" src="https://github.com/user-attachments/assets/dae54c68-3431-4b0b-b0f1-69fbb4cdaefa" />   and from the dashboard-api logs:  ``` ods-dashboard-api  | INFO:     192.168.16.10:38096 - "GET /health HTTP/1.1" 200 OK ods-dashboard-api  | Failed to read .env for model info: [Errno 13] Permission denied: '/ods/.env' ods-dashboard-api  | INFO:     192.168.16.17:47420 - "GET /api/status HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47426 - "GET /api/external-links HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47442 - "GET /api/service-tokens HTTP/1.1" 200 OK ods-dashboard-api  | Failed to read .env for model info: [Errno 13] Permission denied: '/ods/.env' ods-dashboard-api  | INFO:     192.168.16.17:47470 - "GET /api/setup/status HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47440 - "GET /api/auth/verify-session HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47468 - "GET /api/version HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47452 - "GET /api/status HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:4

- **Issue #2988** (2026-08-22): **linux-install-preflight.sh hard-fails Podman as unsupported, contradicting installer support added in #2804**
  *Symptoms*: ### Description  ## Description  `scripts/linux-install-preflight.sh` detects when the Docker CLI is actually a Podman-compatible shim and deliberately fails three checks (`DOCKER_ENGINE`, `DOCKER_DAEMON`, `COMPOSE_CLI`), instructing the user to "remove podman-docker or put Docker Engine first in PATH."  It also skips real daemon/Compose probing entirely once Podman is detected, so a Podman user gets no diagnostic information at all — just three canned failures.  This directly contradicts `installers/phases/05-docker.sh`, which as of PR #2804 (merged 2026-08-21) actively detects and configures Podman:  - It sources `installers/lib/podman-registries.sh` to fix Podman's short-name image resolution. - It calls `_runtime_is_podman()` to branch installer behavior. - Its own error text at line 143 reads "Install Docker or Podman first, then re-run ODS." - `installers/lib/sudo.sh:68` likewise says "Core ODS runs rootless via Docker/Podman."  So the installer phases treat Podman as supported; the preflight script that runs before them still treats it as a hard blocker.  A user following the documented `./scripts/linux-install-preflight.sh` pre-check will be told to abandon their working Podman setup, even though the actual installer would proceed.  This matches the community-reported issue #2933-adjacent behavior: issue #2932 ("install script incompatible with podman") reports the installer dying with an error under Podman on Fedora, though that report has no logs attached, so I can'
  **Post-Mortem & Fix Analysis**:
  > same root cause as test-linux-install-preflight.sh and test-podman-rootless-contracts.sh assert opposite Podman support contracts  #2977

- **Issue #2977** (2026-09-04): **test-linux-install-preflight.sh and test-podman-rootless-contracts.sh assert opposite Podman support contracts**
  *Symptoms*: ### Description    PR #2804 (merged 2026-08-21) added rootless Podman support to the Linux installer through:  - `installers/lib/podman-registries.sh` - Podman detection in `installers/phases/05-docker.sh` - `tests/test-podman-rootless-contracts.sh`  However, the existing `tests/test-linux-install-preflight.sh` was not updated and still asserts the opposite behavior: that a Podman-backed Docker CLI must fail preflight as an unsupported runtime.  Both tests run as part of the same CI suite, so the test suite currently encodes two contradictory contracts for Podman support on Linux.    ### Steps to Reproduce      1. Check out `main` at commit `6ff9b4fc` or later. 2. Open `tests/test-linux-install-preflight.sh`, lines 83–124. 3. Observe that the test expects the following for a Docker CLI reporting itself as Podman:    - `checks["DOCKER_ENGINE"]["status"] == "fail"`    - `checks["DOCKER_DAEMON"]["status"] == "fail"`    - `checks["COMPOSE_CLI"]["status"] == "fail"`    - `report["summary"]["exit_ok"] is False` 4. Open `tests/test-podman-rootless-contracts.sh`, added by PR #2804. 5. Open `installers/phases/05-docker.sh`, lines 390–406, and inspect `_runtime_is_podman` and `_ensure_podman_dockerhub_search`. 6. Compare the two contracts:    - `test-linux-install-preflight.sh` expects Podman to fail.    - `test-podman-rootless-contracts.sh` exists to verify that Podman works.    ### Expected Behavior    The test suite should have one consistent contract for whether ODS supports Podman

- **Issue #2623** (2026-09-05): **ods-uninstall.sh echoes sudo password to terminal**
  *Symptoms*: ### Description  Running ./ods-uninstall.sh --force ``` ╔══════════════════════════════════════════════════╗ ║         ODS UNINSTALLER                ║ ╚══════════════════════════════════════════════════╝  [INFO] Install directory: /home/XXXX/ods  [INFO] Stopping Docker containers... [INFO] Removing ODS containers... ods-model-router ods-llama-server [OK] Docker cleanup complete [INFO] Removing systemd user services... [INFO] Reaping any orphan host-managed processes... [sudo] password for XXXXX: YYYYYYYYY ````  The YYYYYY above would be the echoed password.  ### Steps to Reproduce  1. Run ./ods-uninstall.sh --force 2. If your account uses sudo, it'll echo your sudo password  ### Expected Behavior  No echo of sudo password  ### Actual Behavior  Sudo password shown  ### Operating System  Debian 13 (Trixie)  ### GPU  None  ### Docker Version  Docker 29.7.2  ### VRAM  0  ### Logs  ```shell  ```  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report — I'm trying to narrow this down, and a few details from your run would help. These are just questions; I don't want to assume the cause.  1. Between the `Reaping any orphan host-managed processes...` line and the `[sudo] password` prompt appearing, was there a silent pause — and if so, roughly how long (a few seconds, ~20–30 seconds, longer)? 2. Did you start typing, or paste your password, before the `[sudo] password` prompt actually appeared on screen? 3. Were the characters you typed visible on screen as you typed them?  For context, the uninstaller wraps its first `sudo` call in `timeout` (`ods-uninstall.sh:289`), and there may be an interaction there worth checking — your answers would help confirm or rule that out. 
  > 1. I'm not sure tbh.  I'll need to run through it again.  Right now I'm just trying to get it to run... 2. No 3. Yes

- **Issue #2617** (2026-08-21): **[Bug] Hardware detection script writes unquoted multi-line strings to .env, breaking source commands**
  *Symptoms*: ### Description  ### Describe the bug When ODS automatically detects hardware to assign a recommended local LLM model, it appends data to `$HOME/ods/.env`. However, the string generated for `MODEL_RECOMMENDATION_REASON` spans multiple unquoted lines and includes special characters (parentheses).   Because the string is not enclosed in double quotes, standard Bash sourcing (`set -a; source .env; set +a`) throws severe syntax errors and attempts to execute the multi-line text blocks as terminal commands.    ### Temporary Workaround Applied Manually wrapping the entire string block in double quotes `"` or commenting out the stray multi-line outputs using `#`.  Commenting out MODEL_PERFORMANCE_LABEL and MODEL_PERFORMANCE_LABEL  ### Suggested Fix Update the ODS deployment/setup script that writes to `.env` to ensure all long string metadata outputs are systematically enclosed in double quotes: `MODEL_RECOMMENDATION_REASON="%s"`  ### Steps to Reproduce  ### Steps to Reproduce 1. Run the ODS model recommendation/setup flow on an arm64 NV_ULTRA Spark-class NVIDIA host. 2. Open the generated `$HOME/ods/.env` file. 3. Observe `MODEL_RECOMMENDATION_REASON` written as a raw, unquoted text block across lines 56–58. 4. Attempt to run: `set -a; source $HOME/ods/.env; set +a`   ### Expected Behavior  It should set the variables and make them available. Especially the API keys  ### Actual Behavior  ### Error Logs ```bash bash: /home/snknitin/ods/.env: line 56: syntax error near unexpected tok

- **Issue #2336** (2026-09-04): **ODSTokenSpyCallback leaks httpx.AsyncClient connections on LiteLLM worker restart**
  *Symptoms*: ### Description    `ODSTokenSpyCallback._run()` creates a new `httpx.AsyncClient` inside an `async with` block each time the background worker task is recreated. If the task is cancelled (e.g. during a LiteLLM model swap, gunicorn worker recycle, or an asyncio shutdown race), the `AsyncClient.__aexit__` may never be awaited, leaving TCP sockets and file descriptors open. A new client is created on the next inference event, compounding the leak with every restart cycle.   ### Steps to Reproduce    1. Install ODS with Token Spy enabled (`TOKEN_SPY_URL` and `TOKEN_SPY_API_KEY` set). 2. Make the Token Spy endpoint temporarily unreachable to trigger `httpx.HTTPError`. 3. Simultaneously trigger a LiteLLM model swap or worker restart. 4. Repeat steps 2–3 several times under load. 5. Check the open file descriptors on the LiteLLM container:  ```bash ls -la /proc/<pid>/fd | wc -l ```   ### Expected Behavior    The `httpx.AsyncClient` is properly closed when the background worker task exits or is cancelled, releasing all TCP connections and file descriptors.   ### Actual Behavior    Each worker task restart leaves the previous `httpx.AsyncClient` unclosed. Open TCP connections and file descriptors accumulate over time. Under sustained load, this can exhaust the process file descriptor limit and result in:  ```text OSError: [Errno 24] Too many open files ```   ### Operating System  Any (Linux / macOS / Windows — affects all platforms running LiteLLM with Token Spy)  ### GPU  Not applica

- **Issue #2171** (2026-07-27): **Pinned Hermes Agent image tag no longer exists on Docker Hub**
  *Symptoms*: ### Description  ## Description  During a fresh Dream Server installation, the installer attempts to pull a pinned Hermes Agent image that is no longer available on Docker Hub.  The image referenced by the installer is:  ```text nousresearch/hermes-agent:sha-dd0923bb89ed2dd56f82cb63656a1323f6f42e6f ```  The pull fails with:  ```text Error response from daemon: failed to resolve reference "docker.io/nousresearch/hermes-agent:sha-dd0923bb89ed2dd56f82cb63656a1323f6f42e6f": docker.io/nousresearch/hermes-agent:sha-dd0923bb89ed2dd56f82cb63656a1323f6f42e6f: not found ```  I verified that this is reproducible outside the installer:  ```bash docker pull nousresearch/hermes-agent:sha-dd0923bb89ed2dd56f82cb63656a1323f6f42e6f ```  which returns the same `not found` error.  However, pulling the latest image succeeds:  ```bash docker pull nousresearch/hermes-agent:latest ```  The pinned SHA tag is currently referenced in multiple places:  - `dream-server/extensions/services/hermes/compose.yaml` - `dream-server/installers/phases/08-images.sh` - `dream-server/config/dependency-lock.json`  Because this image cannot be resolved, the installation eventually fails while launching services, even though the root cause is the missing Docker image.  Could you verify whether this SHA-pinned image was removed or whether the installer should reference a different published tag?  ### Steps to Reproduce  1. Clone the Dream Server repository.  2. Run the installer:  ```bash ./install.sh ```  3. Wait until
  **Post-Mortem & Fix Analysis**:
  > Good news — this appears to be already fixed on current main, so it looks like a duplicate of #1544.  The `sha-dd0923bb...` tag was replaced with the stable version tag `nousresearch/hermes-agent:v2026.5.16` across the pin sites I checked (`extensions/services/hermes/compose.yaml`, `installers/phases/08-images.sh`, `config/dependency-lock.json`, `.env.example`, `.env.schema.json`), and there is now a regression guard in `tests/test-linux-cloud-mode.sh` asserting no `sha-` pin can come back. `v2026.5.16` currently resolves on Docker Hub, so a fresh install from current main should not hit this.  @TeamLider9141 which version/ref did you install from? If it was a tagged release or older checkout rather than current main, that would explain the stale pin. See #1544 for the original tracking. 

- **Issue #1987** (2026-07-27): **bug(macos): pre-pull strips per-service platform pins, causing arm64 pull failures for amd64-only images**
  *Symptoms*: ### Description  The macOS installer's pre-pull step builds its image list using `docker compose config --images`, which returns image names only and drops all per-service `platform:` pins defined in the Compose files. As a result, when Docker pulls these images on Apple Silicon without a platform flag, it defaults to the host platform (`linux/arm64/v8`) and fails for amd64-only images, even though the Compose file correctly specifies `platform: linux/amd64`.  Currently, the only affected service is `extensions/services/embeddings/compose.yaml` (the TEI image, which is amd64-only), but this failure mode applies to any future extension that introduces a platform-pinned image. Because the installer treats a failed pre-pull as a fatal error, it aborts the installation instead of allowing Docker Compose to perform the pull later with the correct platform pin applied.  Root cause confirmed by @bokiko in #1958: `docker compose config --images` strips platform metadata, leaving `_macos_pull_image_with_retry` with no way to determine or pass the required `--platform` flag when iterating the image list.   ### Steps to Reproduce  ### Steps to Reproduce  1. Use any Apple Silicon Mac (M1/M2/M3/M4). 2. Clone the repository:     ```bash    git clone https://github.com/Osmantic/ODS.git    ``` 3. Change into the installer directory:     ```bash    cd ODS/ods    ``` 4. Run the installer and select **Full Stack**:     ```bash    ./install.sh    ``` 5. Observe the installation failing during th
  **Post-Mortem & Fix Analysis**:
  > Thanks for formalizing this, @IronicRayquaza. The fix for this is already open in #1985: the macOS pre-pull now carries each service's `platform:` pin through to `docker pull --platform`.  That should cover the generalized case you called out, not just the TEI image from #1958. 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `e6a9e4a0` (2026-09-30)
**Commit Message**: Merge pull request #7045 from Osmantic/fix/pixel-public-helper-umask

fix(pixel): preserve public helper traversal under restrictive umask

**File**: `ods/installers/lib/pixel-host-install.sh` (modified, +6/-0)
```diff
@@ -2458,6 +2458,10 @@ for path in (target, *target.parents):
     info = path.lstat()
     if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
         raise SystemExit("Pixel access program directory is not root protected")
+# These are public programs executed by the unprivileged gateway owner.
+# mkdir's requested mode is masked by sudo/the caller's umask, including 0077.
+# Normalize only this owned directory after validating its protected custody.
+os.chmod(target, 0o755, follow_symlinks=False)
 
 def write(path, content, mode, uid=0, gid=0):
     if path.exists() or path.is_symlink():
@@ -2490,13 +2494,15 @@ settings_package.mkdir(mode=0o755, exist_ok=True)
 info = settings_package.lstat()
 if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
     raise SystemExit("Pixel settings program directory is not root protected")
+os.chmod(settings_package, 0o755, follow_symlinks=False)
 for name in ('__init__.py', 'contract.py', 'projection.py', 'runtime.py', 'coordinator.py'):
     write(settings_package / name, (source / 'bin/pixel_settings' / name).read_bytes(), 0o644)
 provider_package = target / 'pixel_provider'
 provider_package.mkdir(mode=0o755, exist_ok=True)
 info = provider_package.lstat()
 if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
     raise SystemExit("Pixel provider program directory is not root protected")
+os.chmod(provider_package, 0o755, follow_symlinks=False)
 for name in ('__init__.py', 'config.py', 'store.py', 'activation_config.py',
              'managed_deployment.py', 'service_environment.py', 'service_activation.py',
              'runtime_custody.py', 'coordinator.py'):
```

**File**: `ods/tests/test-pixel-host-install.sh` (modified, +2/-0)
```diff
@@ -3395,5 +3395,7 @@ else
     fail "non-force reuse swallowed verifier failure"
 fi
 
+check python3 "$ROOT/tests/test_pixel_access_program_modes.py"
+
 printf '\nResults: %d passed, %d failed\n' "$PASS" "$FAIL"
 [[ "$FAIL" -eq 0 ]]
```

**File**: `ods/tests/test_pixel_access_program_modes.py` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+"""Exercise the installer's public-directory blocks with a restrictive umask."""
+import ast
+import os
+from pathlib import Path
+import stat
+from types import SimpleNamespace
+from unittest.mock import patch
+
+import tempfile
+import unittest
+
+
+SOURCE = Path(__file__).resolve().parents[1] / 'installers/lib/pixel-host-install.sh'
+
+
+def directory_code():
+    text = SOURCE.read_text().split('_ods_pixel_install_access_service() {', 1)[1]
+    body = text.split("<<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
+    tree = ast.parse(body)
+    blocks = []
+    active = False
+    for node in tree.body:
+        if isinstance(node, ast.Assign):
+            name = getattr(node.targets[0], 'id', '')
+            if name in ('target', 'settings_package', 'provider_package'):
+                active = True
+                if name == 'target':
+                    continue  # Supply an isolated fixture root, not /usr/local.
+            elif name in ('host', 'config_dir'):
+                active = False
+        if isinstance(node, ast.FunctionDef):
+            active = False
+        if active:
+            # The program-copy loops are unrelated to directory permissions.
+            if isinstance(node, ast.For) and getattr(node.target, 'id', '') == 'name':
+                active = False
+                continue
+            blocks.append(node)
+    return compile(ast.fix_missing_locations(ast.Module(body=blocks, type_ignores=[])),
+                   str(SOURCE), 'exec')
+
+
+def run_install(target, *, bad_owner=None):
+    real_lstat = Path.lstat
+    ancestors = set(target.parents)
+
+    def root_fixture_lstat(path, *args, **kwargs):
+        value = real_lstat(path, *args, **kwargs)
+        # The test directory lives beneath pytest's private /tmp tree. Model
+        # the already-protected system ancestors and root ownership, retaining
+        # actual filesystem modes/types for every owned program directory.
+        mode = stat.S_IFDIR | 0o755 if path in ancestors else value.st_mode
+        return SimpleNamespace(st_mode=mode, st_uid=12345 if path == bad_owner else 0)
+
+    previous = os.umask(0o077)
+    try:
+        with patch.object(Path, 'lstat', root_fixture_lstat):
+            exec(directory_code(), {'target': target, 'os': os, 'stat': stat})
+    finally:
+        os.umask(previous)
+
+
+class ProgramModesTests(unittest.TestCase):
+    def test_public_directories_are_traversable_under_private_umask(self):
+        for existing in (False, True):
+            with self.subTest(existing=existing), tempfile.TemporaryDirectory() as tmp:
+                tmp_path = Path(tmp)
+                target = tmp_path / 'programs'
+                if existing:
+                    for path in (target, target / 'pixel_settings', target / 'pixel_provider'):
+                        path.mkdir(mode=0o700)
+                state = tmp_path / 'private-state'
+                state.mkdir(mode=0o700)
+                secret = state / 'key'
+                secret.write_text('fixture only')
+                secret.chmod(0o600)
+                run_install(target)
+                for path in (target, target / 'pixel_settings', target / 'pixel_provider'):
+                    assert stat.S_IMODE(path.stat().st_mode) == 0o755
+                assert stat.S_IMODE(state.stat().st_mode) == 0o700
+                assert stat.S_IMODE(secret.stat().st_mode) == 0o600
+
+    def test_unsafe_directory_is_rejected_before_chmod(self):
+        for component in ('', 'pixel_settings', 'pixel_provider'):
+            for unsafe in ('symlink', 'writable', 'owner'):
+                with self.subTest(component=component, unsafe=unsafe), tempfile.TemporaryDirectory() as tmp:
+                    tmp_path = Path(tmp)
+                    target = tmp_path / 'programs'
+                    target.mkdir(mode=0o755)
+                    path = target / component if component else target
+                    if component:
+              
```

---

### Incident Patch 2: `49677c10` (2026-09-30)
**Commit Message**: fix(pixel): preserve public helper traversal under restrictive umask

**File**: `ods/installers/lib/pixel-host-install.sh` (modified, +6/-0)
```diff
@@ -2458,6 +2458,10 @@ for path in (target, *target.parents):
     info = path.lstat()
     if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
         raise SystemExit("Pixel access program directory is not root protected")
+# These are public programs executed by the unprivileged gateway owner.
+# mkdir's requested mode is masked by sudo/the caller's umask, including 0077.
+# Normalize only this owned directory after validating its protected custody.
+os.chmod(target, 0o755, follow_symlinks=False)
 
 def write(path, content, mode, uid=0, gid=0):
     if path.exists() or path.is_symlink():
@@ -2490,13 +2494,15 @@ settings_package.mkdir(mode=0o755, exist_ok=True)
 info = settings_package.lstat()
 if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
     raise SystemExit("Pixel settings program directory is not root protected")
+os.chmod(settings_package, 0o755, follow_symlinks=False)
 for name in ('__init__.py', 'contract.py', 'projection.py', 'runtime.py', 'coordinator.py'):
     write(settings_package / name, (source / 'bin/pixel_settings' / name).read_bytes(), 0o644)
 provider_package = target / 'pixel_provider'
 provider_package.mkdir(mode=0o755, exist_ok=True)
 info = provider_package.lstat()
 if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
     raise SystemExit("Pixel provider program directory is not root protected")
+os.chmod(provider_package, 0o755, follow_symlinks=False)
 for name in ('__init__.py', 'config.py', 'store.py', 'activation_config.py',
              'managed_deployment.py', 'service_environment.py', 'service_activation.py',
              'runtime_custody.py', 'coordinator.py'):
```

**File**: `ods/tests/test-pixel-host-install.sh` (modified, +2/-0)
```diff
@@ -3395,5 +3395,7 @@ else
     fail "non-force reuse swallowed verifier failure"
 fi
 
+check python3 "$ROOT/tests/test_pixel_access_program_modes.py"
+
 printf '\nResults: %d passed, %d failed\n' "$PASS" "$FAIL"
 [[ "$FAIL" -eq 0 ]]
```

**File**: `ods/tests/test_pixel_access_program_modes.py` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+"""Exercise the installer's public-directory blocks with a restrictive umask."""
+import ast
+import os
+from pathlib import Path
+import stat
+from types import SimpleNamespace
+from unittest.mock import patch
+
+import tempfile
+import unittest
+
+
+SOURCE = Path(__file__).resolve().parents[1] / 'installers/lib/pixel-host-install.sh'
+
+
+def directory_code():
+    text = SOURCE.read_text().split('_ods_pixel_install_access_service() {', 1)[1]
+    body = text.split("<<'PY'\n", 1)[1].split('\nPY\n', 1)[0]
+    tree = ast.parse(body)
+    blocks = []
+    active = False
+    for node in tree.body:
+        if isinstance(node, ast.Assign):
+            name = getattr(node.targets[0], 'id', '')
+            if name in ('target', 'settings_package', 'provider_package'):
+                active = True
+                if name == 'target':
+                    continue  # Supply an isolated fixture root, not /usr/local.
+            elif name in ('host', 'config_dir'):
+                active = False
+        if isinstance(node, ast.FunctionDef):
+            active = False
+        if active:
+            # The program-copy loops are unrelated to directory permissions.
+            if isinstance(node, ast.For) and getattr(node.target, 'id', '') == 'name':
+                active = False
+                continue
+            blocks.append(node)
+    return compile(ast.fix_missing_locations(ast.Module(body=blocks, type_ignores=[])),
+                   str(SOURCE), 'exec')
+
+
+def run_install(target, *, bad_owner=None):
+    real_lstat = Path.lstat
+    ancestors = set(target.parents)
+
+    def root_fixture_lstat(path, *args, **kwargs):
+        value = real_lstat(path, *args, **kwargs)
+        # The test directory lives beneath pytest's private /tmp tree. Model
+        # the already-protected system ancestors and root ownership, retaining
+        # actual filesystem modes/types for every owned program directory.
+        mode = stat.S_IFDIR | 0o755 if path in ancestors else value.st_mode
+        return SimpleNamespace(st_mode=mode, st_uid=12345 if path == bad_owner else 0)
+
+    previous = os.umask(0o077)
+    try:
+        with patch.object(Path, 'lstat', root_fixture_lstat):
+            exec(directory_code(), {'target': target, 'os': os, 'stat': stat})
+    finally:
+        os.umask(previous)
+
+
+class ProgramModesTests(unittest.TestCase):
+    def test_public_directories_are_traversable_under_private_umask(self):
+        for existing in (False, True):
+            with self.subTest(existing=existing), tempfile.TemporaryDirectory() as tmp:
+                tmp_path = Path(tmp)
+                target = tmp_path / 'programs'
+                if existing:
+                    for path in (target, target / 'pixel_settings', target / 'pixel_provider'):
+                        path.mkdir(mode=0o700)
+                state = tmp_path / 'private-state'
+                state.mkdir(mode=0o700)
+                secret = state / 'key'
+                secret.write_text('fixture only')
+                secret.chmod(0o600)
+                run_install(target)
+                for path in (target, target / 'pixel_settings', target / 'pixel_provider'):
+                    assert stat.S_IMODE(path.stat().st_mode) == 0o755
+                assert stat.S_IMODE(state.stat().st_mode) == 0o700
+                assert stat.S_IMODE(secret.stat().st_mode) == 0o600
+
+    def test_unsafe_directory_is_rejected_before_chmod(self):
+        for component in ('', 'pixel_settings', 'pixel_provider'):
+            for unsafe in ('symlink', 'writable', 'owner'):
+                with self.subTest(component=component, unsafe=unsafe), tempfile.TemporaryDirectory() as tmp:
+                    tmp_path = Path(tmp)
+                    target = tmp_path / 'programs'
+                    target.mkdir(mode=0o755)
+                    path = target / component if component else target
+                    if component:
+              
```

---

### Incident Patch 3: `fee212d0` (2026-09-30)
**Commit Message**: Merge pull request #7039 from Osmantic/fix/pixel-force-exact-contract-recovery

Recover stale Pixel sandbox during forced reinstall

**File**: `ods/installers/lib/pixel-host-install.sh` (modified, +25/-0)
```diff
@@ -4907,6 +4907,31 @@ ods_pixel_install_default_agent() {
             ai_bad "Pixel's root-custodied Operations policy does not match the ODS-managed policy."
             return 1
         fi
+        if [[ "${FORCE:-false}" == true ]]; then
+            # Forced reinstall retires an interrupted agent sandbox while
+            # the gateway is stopped, then runs the unchanged verifier.
+            if ! ods_sudo systemctl stop openclaw-gateway.service >>"$pixel_log" 2>&1; then
+                ai_bad "The ODS-managed Pixel gateway could not enter maintenance mode. See $pixel_log."
+                return 1
+            fi
+            if ! _ods_pixel_recreate_agent_sandbox "$owner" "$home" "$openclaw_bin" \
+                >>"$pixel_log" 2>&1; then
+                # Restore the previously configured service when cleanup
+                # fails; the installer still fails closed and does not claim
+                # the sandbox boundary was refreshed.
+                ods_sudo systemctl start openclaw-gateway.service >>"$pixel_log" 2>&1 || true
+                ai_bad "Pixel could not retire its stale agent sandbox during forced recovery. See $pixel_log."
+                return 1
+            fi
+            if ! ods_sudo systemctl start openclaw-gateway.service >>"$pixel_log" 2>&1; then
+                ai_bad "The ODS-managed Pixel gateway could not restart after forced sandbox recovery. See $pixel_log."
+                return 1
+            fi
+            if ! _ods_pixel_wait_gateway 60 "$pixel_gateway_port"; then
+                ai_bad "The ODS-managed Pixel gateway did not become healthy after forced sandbox recovery. See $pixel_log."
+                return 1
+            fi
+        fi
         if ! ods_pixel_run_as_owner "$owner" "$home" "$pixel_root/pixel" verify >>"$pixel_log" 2>&1; then
             ai_bad "The existing ODS-managed Pixel contract failed exact-source verification. See $pixel_log."
             return 1
```

**File**: `ods/tests/test-pixel-host-install.sh` (modified, +219/-0)
```diff
@@ -3176,5 +3176,224 @@ cleanup=text.index("# ── Phase 5b: Remove bootstrap model", reconcile)
 assert reconcile < discard < cleanup
 ' "$ROOT/scripts/bootstrap-upgrade.sh"
 
+# Behavior regression: the reuse_active branch must stay unchanged without
+# FORCE and must run the ordered sandbox recovery only when FORCE=true. The
+# production branch is extracted into a fixture (not the two branches copied)
+# so these tests exercise the real installer code paths and diagnostics.
+installer_source="$ROOT/installers/lib/pixel-host-install.sh"
+reuse_fixture="$TEST_ROOT/reuse-active-fixture.sh"
+python3 - "$installer_source" "$reuse_fixture" <<'PY'
+import pathlib, sys
+source = pathlib.Path(sys.argv[1]).read_text()
+start = source.index('if [[ "$reuse_active" == true ]]; then')
+stop = source.index('\n    else\n', source.index('ai "The exact ODS-managed Pixel contract is already active'))
+pathlib.Path(sys.argv[2]).write_text(
+    '#!/usr/bin/env bash\nset -euo pipefail\n\n# Extracted verbatim from pixel-host-install.sh.\n'
+    + source[start:stop]
+    + '\nfi\n'
+)
+PY
+
+reuse_log="$TEST_ROOT/reuse-actions.log"
+reuse_verify_log="$TEST_ROOT/reuse-verify.log"
+run_reuse_auth_branch() {
+    local force_value="$1"
+    ( set -euo pipefail
+        owner=test-owner
+        home="/home/$owner"
+        pixel_root="$TEST_ROOT/pixel-root"
+        pixel_log="$TEST_ROOT/pixel.log"
+        operations_policy="$TEST_ROOT/ops-policy"
+        answers="$TEST_ROOT/answers.json"
+        pixel_gateway_port=18789
+        openclaw_bin="$TEST_ROOT/openclaw"
+        FORCE="$force_value"
+        reuse_active=true
+        : >"$reuse_log"
+        : >"$reuse_verify_log"
+        ai() { :; }
+        ai_bad() { :; }
+        journal() { printf '%s\n' "$*" >>"$reuse_log"; }
+        ods_pixel_run_as_owner() {
+            local source_owner="$1" target_home="$2"; shift 2
+            if [[ "${2:-}" == ops-broker ]]; then
+                journal run-as-owner "$source_owner" ops-broker
+                return 0
+            fi
+            if [[ "${2:-}" == verify ]]; then
+                journal run-as-owner "$source_owner" verify
+                return 0
+            fi
+            journal run-as-owner "$source_owner" "${2:-}"
+            return 0
+        }
+        _ods_pixel_harden_operations_state_profiles() { journal harden operations; return 0; }
+        _ods_pixel_verify_operations_policy_custody() { journal verify-custody "$1" "$2"; return 0; }
+        _ods_pixel_recreate_agent_sandbox() {
+            journal recreate-sandbox "$1" "$2"
+            return 0
+        }
+        _ods_pixel_wait_gateway() { journal wait-gateway "$1" "$2"; return 0; }
+        ods_pixel_reconcile_promoted_model() { journal reconcile-model "$1" "$2"; return 0; }
+        ods_sudo() {
+            journal ods-sudo "$*"
+            return 0
+        }
+        source "$reuse_fixture"
+    ) >>"$reuse_verify_log" 2>&1
+}
+
+if run_reuse_auth_branch false; then
+    if ! grep -qE 'systemctl|recreate-sandbox|wait-gateway' "$reuse_log" \
+        && grep -q 'run-as-owner .* verify' "$reuse_log"; then
+        pass "reuse_active without FORCE verifies without sandbox recovery"
+    else
+        fail "reuse_active without FORCE ran recovery or skipped verify"
+    fi
+else
+    fail "reuse_active without FORCE rejected a valid exact contract"
+fi
+
+if run_reuse_auth_branch true; then
+    if grep -qx 'ods-sudo systemctl stop openclaw-gateway.service' "$reuse_log" \
+        && grep -qx 'recreate-sandbox test-owner /home/test-owner' "$reuse_log" \
+        && grep -qx 'ods-sudo systemctl start openclaw-gateway.service' "$reuse_log" \
+        && grep -qx 'wait-gateway 60 18789' "$reuse_log" \
+        && grep -qx 'run-as-owner test-owner verify' "$reuse_log"; then
+        stop_line="$(grep -n 'ods-sudo systemctl stop openclaw-gateway.service' "$reuse_log" | head -1 | cut -d: -f1)"
+        retire_line="$(grep -n 'recreate-sandbox' "$reuse_log" | head -1 
```

---

### Incident Patch 4: `40d53751` (2026-09-30)
**Commit Message**: Merge pull request #7037 from Osmantic/fix/external-lemonade-stale-route

Repair external Lemonade route retained from CPU fallback

**File**: `ods/installers/phases/06-directories.sh` (modified, +9/-0)
```diff
@@ -1027,6 +1027,15 @@ Fix with: sudo chown -R \$(id -u):\$(id -g) $INSTALL_DIR/config $INSTALL_DIR/dat
         OPEN_WEBUI_LLM_API_KEY_VALUE=""
     else
         LLM_API_URL_VALUE=$(_env_get LLM_API_URL "$_default_llm_api_url")
+        # A retained local route cannot serve an external Lemonade install.
+        # Preserve other existing values as operator-selected endpoints.
+        if [[ "$LEMONADE_EXTERNAL_VALUE" == "true" ]]; then
+            case "$LLM_API_URL_VALUE" in
+                http://llama-server:8080|http://llama-server:8080/v1)
+                    LLM_API_URL_VALUE="$_default_llm_api_url"
+                    ;;
+            esac
+        fi
     fi
     if [[ "$EXTERNAL_LLM_ACTIVE" != "true" && "${EXTERNAL_LLM_RESET:-false}" != "true" && "$ODS_MODEL_SWITCHBOARD_VALUE" == "enabled" ]]; then
         OPEN_WEBUI_LLM_BASE_URL_VALUE=$(_env_get OPEN_WEBUI_LLM_BASE_URL "http://litellm:4000")
```

**File**: `ods/tests/test-external-services.sh` (modified, +21/-2)
```diff
@@ -445,12 +445,31 @@ run_phase06_env_cycle() (
     grep -qx 'SKIP_MODEL_DOWNLOAD=false' "$install_dir/.env"
     grep -q 'api_base: http://llama-server:8080/v1' "$install_dir/config/litellm/local.yaml"
     ! grep -q 'host.docker.internal:11434\|openai/qwen3.5:9b' "$install_dir/config/litellm/local.yaml"
+
+    # A Windows external Lemonade reinstall can inherit the local route from
+    # an earlier CPU fallback. Recompute only that obsolete route.
+    export EXTERNAL_LLM_RESET=false
+    export LEMONADE_EXTERNAL=true
+    export LEMONADE_BASE_URL=http://localhost:13305
+    export LEMONADE_CONTAINER_BASE_URL=http://host.docker.internal:8080
+    export LEMONADE_MODEL=test-lemonade-model
+    export ODS_MODE=lemonade
+    source "$install_dir/installers/phases/06-directories.sh"
+    grep -qx 'LLM_API_URL=http://litellm:4000' "$install_dir/.env"
+
+    sed -i 's#^LLM_API_URL=.*#LLM_API_URL=http://llama-server:8080/v1#' "$install_dir/.env"
+    source "$install_dir/installers/phases/06-directories.sh"
+    grep -qx 'LLM_API_URL=http://litellm:4000' "$install_dir/.env"
+
+    sed -i 's#^LLM_API_URL=.*#LLM_API_URL=http://custom-litellm:4000#' "$install_dir/.env"
+    source "$install_dir/installers/phases/06-directories.sh"
+    grep -qx 'LLM_API_URL=http://custom-litellm:4000' "$install_dir/.env"
 )
 
 if run_phase06_env_cycle; then
-    pass "phase 06 persists external routing and restores managed inference on reset"
+    pass "phase 06 preserves external routing, restores managed inference, and repairs stale Lemonade routes"
 else
-    fail "phase 06 external routing/reset cycle"
+    fail "phase 06 external routing/reset/Lemonade cycle"
 fi
 
 run_phase06_amd_external() (
```

---

### Incident Patch 5: `554b758d` (2026-09-30)
**Commit Message**: fix(pixel): recover stale sandbox during forced exact-contract reuse

**File**: `ods/installers/lib/pixel-host-install.sh` (modified, +25/-0)
```diff
@@ -4907,6 +4907,31 @@ ods_pixel_install_default_agent() {
             ai_bad "Pixel's root-custodied Operations policy does not match the ODS-managed policy."
             return 1
         fi
+        if [[ "${FORCE:-false}" == true ]]; then
+            # Forced reinstall retires an interrupted agent sandbox while
+            # the gateway is stopped, then runs the unchanged verifier.
+            if ! ods_sudo systemctl stop openclaw-gateway.service >>"$pixel_log" 2>&1; then
+                ai_bad "The ODS-managed Pixel gateway could not enter maintenance mode. See $pixel_log."
+                return 1
+            fi
+            if ! _ods_pixel_recreate_agent_sandbox "$owner" "$home" "$openclaw_bin" \
+                >>"$pixel_log" 2>&1; then
+                # Restore the previously configured service when cleanup
+                # fails; the installer still fails closed and does not claim
+                # the sandbox boundary was refreshed.
+                ods_sudo systemctl start openclaw-gateway.service >>"$pixel_log" 2>&1 || true
+                ai_bad "Pixel could not retire its stale agent sandbox during forced recovery. See $pixel_log."
+                return 1
+            fi
+            if ! ods_sudo systemctl start openclaw-gateway.service >>"$pixel_log" 2>&1; then
+                ai_bad "The ODS-managed Pixel gateway could not restart after forced sandbox recovery. See $pixel_log."
+                return 1
+            fi
+            if ! _ods_pixel_wait_gateway 60 "$pixel_gateway_port"; then
+                ai_bad "The ODS-managed Pixel gateway did not become healthy after forced sandbox recovery. See $pixel_log."
+                return 1
+            fi
+        fi
         if ! ods_pixel_run_as_owner "$owner" "$home" "$pixel_root/pixel" verify >>"$pixel_log" 2>&1; then
             ai_bad "The existing ODS-managed Pixel contract failed exact-source verification. See $pixel_log."
             return 1
```

**File**: `ods/tests/test-pixel-host-install.sh` (modified, +219/-0)
```diff
@@ -3176,5 +3176,224 @@ cleanup=text.index("# ── Phase 5b: Remove bootstrap model", reconcile)
 assert reconcile < discard < cleanup
 ' "$ROOT/scripts/bootstrap-upgrade.sh"
 
+# Behavior regression: the reuse_active branch must stay unchanged without
+# FORCE and must run the ordered sandbox recovery only when FORCE=true. The
+# production branch is extracted into a fixture (not the two branches copied)
+# so these tests exercise the real installer code paths and diagnostics.
+installer_source="$ROOT/installers/lib/pixel-host-install.sh"
+reuse_fixture="$TEST_ROOT/reuse-active-fixture.sh"
+python3 - "$installer_source" "$reuse_fixture" <<'PY'
+import pathlib, sys
+source = pathlib.Path(sys.argv[1]).read_text()
+start = source.index('if [[ "$reuse_active" == true ]]; then')
+stop = source.index('\n    else\n', source.index('ai "The exact ODS-managed Pixel contract is already active'))
+pathlib.Path(sys.argv[2]).write_text(
+    '#!/usr/bin/env bash\nset -euo pipefail\n\n# Extracted verbatim from pixel-host-install.sh.\n'
+    + source[start:stop]
+    + '\nfi\n'
+)
+PY
+
+reuse_log="$TEST_ROOT/reuse-actions.log"
+reuse_verify_log="$TEST_ROOT/reuse-verify.log"
+run_reuse_auth_branch() {
+    local force_value="$1"
+    ( set -euo pipefail
+        owner=test-owner
+        home="/home/$owner"
+        pixel_root="$TEST_ROOT/pixel-root"
+        pixel_log="$TEST_ROOT/pixel.log"
+        operations_policy="$TEST_ROOT/ops-policy"
+        answers="$TEST_ROOT/answers.json"
+        pixel_gateway_port=18789
+        openclaw_bin="$TEST_ROOT/openclaw"
+        FORCE="$force_value"
+        reuse_active=true
+        : >"$reuse_log"
+        : >"$reuse_verify_log"
+        ai() { :; }
+        ai_bad() { :; }
+        journal() { printf '%s\n' "$*" >>"$reuse_log"; }
+        ods_pixel_run_as_owner() {
+            local source_owner="$1" target_home="$2"; shift 2
+            if [[ "${2:-}" == ops-broker ]]; then
+                journal run-as-owner "$source_owner" ops-broker
+                return 0
+            fi
+            if [[ "${2:-}" == verify ]]; then
+                journal run-as-owner "$source_owner" verify
+                return 0
+            fi
+            journal run-as-owner "$source_owner" "${2:-}"
+            return 0
+        }
+        _ods_pixel_harden_operations_state_profiles() { journal harden operations; return 0; }
+        _ods_pixel_verify_operations_policy_custody() { journal verify-custody "$1" "$2"; return 0; }
+        _ods_pixel_recreate_agent_sandbox() {
+            journal recreate-sandbox "$1" "$2"
+            return 0
+        }
+        _ods_pixel_wait_gateway() { journal wait-gateway "$1" "$2"; return 0; }
+        ods_pixel_reconcile_promoted_model() { journal reconcile-model "$1" "$2"; return 0; }
+        ods_sudo() {
+            journal ods-sudo "$*"
+            return 0
+        }
+        source "$reuse_fixture"
+    ) >>"$reuse_verify_log" 2>&1
+}
+
+if run_reuse_auth_branch false; then
+    if ! grep -qE 'systemctl|recreate-sandbox|wait-gateway' "$reuse_log" \
+        && grep -q 'run-as-owner .* verify' "$reuse_log"; then
+        pass "reuse_active without FORCE verifies without sandbox recovery"
+    else
+        fail "reuse_active without FORCE ran recovery or skipped verify"
+    fi
+else
+    fail "reuse_active without FORCE rejected a valid exact contract"
+fi
+
+if run_reuse_auth_branch true; then
+    if grep -qx 'ods-sudo systemctl stop openclaw-gateway.service' "$reuse_log" \
+        && grep -qx 'recreate-sandbox test-owner /home/test-owner' "$reuse_log" \
+        && grep -qx 'ods-sudo systemctl start openclaw-gateway.service' "$reuse_log" \
+        && grep -qx 'wait-gateway 60 18789' "$reuse_log" \
+        && grep -qx 'run-as-owner test-owner verify' "$reuse_log"; then
+        stop_line="$(grep -n 'ods-sudo systemctl stop openclaw-gateway.service' "$reuse_log" | head -1 | cut -d: -f1)"
+        retire_line="$(grep -n 'recreate-sandbox' "$reuse_log" | head -1 
```

---

### Incident Patch 6: `a72d154c` (2026-09-30)
**Commit Message**: Handle raced Lemonade process exit during Windows model stop (#7011)

**File**: `ods/installers/windows/lib/wsl-portal-amd.ps1` (modified, +13/-1)
```diff
@@ -252,7 +252,19 @@ function Stop-ODSPortalOwnedProcesses($Handles) {
     # Parents first prevent the router from launching replacement children.
     foreach ($process in $Handles) {
         if (-not $process.HasExited) {
-            try { $process.Kill() } catch [InvalidOperationException] { if (-not $process.HasExited) { throw } }
+            try { $process.Kill() } catch {
+                $cause = $_.Exception
+                while ($cause -is [System.Management.Automation.RuntimeException] -and $cause.InnerException) {
+                    $cause = $cause.InnerException
+                }
+                if ($cause -isnot [InvalidOperationException] -and
+                    $cause -isnot [System.ComponentModel.Win32Exception]) { throw }
+                # Task Scheduler may have exited this held process after HasExited
+                # but before Kill. Accept that race only if the same handle proves exit.
+                if (-not $process.WaitForExit(1000)) {
+                    throw "Could not stop owned Lemonade process $($process.Id): $($cause.Message)"
+                }
+            }
         }
     }
     foreach ($process in $Handles) {
```

**File**: `ods/tests/contracts/test-windows-portal-lemonade-restart.ps1` (modified, +15/-6)
```diff
@@ -93,7 +93,7 @@ try {
     $script:descendant = $false; $script:foreignParent = $false; $script:lookalikeDir = $false; $script:oldListener = $false
     $script:healthy = $true; $script:failConfig = $false; $script:failLoad = $false
     $script:workers = $false; $script:exitBeforeFailure = $false; $script:reusedRoot = $false
-    $script:killFailure = 0; $script:runtimeHandles = @{}
+    $script:killFailure = 0; $script:killExitRace = $false; $script:runtimeHandles = @{}
     $script:failOwnershipWrites = $false; $script:denyRecordOnFailure = $false; $script:runtimeExitCode = 0
     $script:privateWriter = ${function:Write-ODSPrivateEnvFile}
     function Write-ODSPrivateEnvFile { param($Path, $Content)
@@ -139,7 +139,11 @@ try {
         $handle = [pscustomobject]@{ Id = $Id; Handle = $Id; Path = $node.ExecutablePath
             StartTime = $node.CreationDate; HasExited = $false }
         $handle | Add-Member ScriptMethod Kill {
-            if ($script:killFailure -eq $this.Id) { throw [System.ComponentModel.Win32Exception]::new('mock cleanup denied') }
+            if ($script:killFailure -eq $this.Id) {
+                $script:calls.Add("kill-error:$($this.Id)")
+                if ($script:killExitRace) { $this.HasExited = $true }
+                throw [System.ComponentModel.Win32Exception]::new('mock cleanup denied')
+            }
             $script:calls.Add("kill:$($this.Id)"); $this.HasExited = $true
         }
         $handle | Add-Member ScriptMethod WaitForExit { param($Milliseconds) return $this.HasExited }
@@ -226,23 +230,28 @@ try {
     }
     $ownershipPath = Join-Path $runtimeDir 'process-ownership.json'
     $script:workers = $true; $script:descendant = $true
-    foreach ($failure in @('failConfig', 'failLoad', 'root-exited', 'root-pid-reused', 'ownership-write-failure', 'nonzero-root-exit', 'partial-cleanup')) {
+    foreach ($failure in @('failConfig', 'failLoad', 'root-exited', 'root-pid-reused', 'ownership-write-failure', 'nonzero-root-exit', 'partial-cleanup', 'exited-on-kill-error')) {
         $script:launched = $false; $script:calls.Clear()
         $script:failConfig = $failure -in @('failConfig', 'ownership-write-failure')
         $script:failLoad = -not $script:failConfig -and $failure -ne 'nonzero-root-exit'
         $script:denyRecordOnFailure = $failure -eq 'ownership-write-failure'
         $script:runtimeExitCode = if ($failure -eq 'nonzero-root-exit') { 7 } else { 0 }
         $script:exitBeforeFailure = $failure -in @('root-exited', 'root-pid-reused')
         $script:reusedRoot = $failure -eq 'root-pid-reused'
-        $script:killFailure = if ($failure -eq 'partial-cleanup') { 4243 } else { 0 }
+        $script:killFailure = if ($failure -in @('partial-cleanup', 'exited-on-kill-error')) { 4243 } else { 0 }
+        $script:killExitRace = $failure -eq 'exited-on-kill-error'
         $message = ''
         try { $null = Invoke-ODSPortalLemonadeRuntime $registration.Plan $registration.ReadyPath } catch { $message = $_.Exception.Message }
         Assert-Restart ($message -and -not (Test-Path -LiteralPath $registration.ReadyPath) -and
             -not $script:calls.Contains('kill:4999') -and -not $script:calls.Contains('kill:4245')) "$failure never publishes readiness or kills an unrelated process"
+        if ($failure -eq 'exited-on-kill-error') {
+            Assert-Restart ($script:calls.Contains('kill-error:4243') -and $script:runtimeHandles[4243].HasExited) 'an access error is ignored only after the same owned process handle proves exit'
+        }
         if ($failure -eq 'partial-cleanup') {
             $script:partialOwnership = Get-Content -LiteralPath $ownershipPath -Raw -Encoding UTF8
             $savedOwnership = $script:partialOwnership | ConvertFrom-Json
-            Assert-Restart ($savedOwnership.Processes.Count -eq 3 -and $script:child.HasExited -and
+            Assert-Restart ($message -match 'Could not stop owned Lemonade process 4243' -and
+             
```

---

### Incident Patch 7: `13614c08` (2026-09-30)
**Commit Message**: Fix read-only v9fs bind identity after Docker restart (#7004)

**File**: `ods/scripts/wsl-bind-recovery.py` (modified, +36/-6)
```diff
@@ -263,14 +263,45 @@ def prevalidate_binds(binds):
             raise RuntimeError(f"unsupported host filetype for {src}")
 
 
+def bind_view_matches(container_name, src, dst, read_only, host=None, seen=None):
+    host = host if host is not None else host_stat(src)
+    seen = seen if seen is not None else exec_stat(container_name, dst)
+    if (host["device"], host["inode"], host["filetype"]) == (
+            seen["device"], seen["inode"], seen["filetype"]):
+        return True
+    if (not read_only or host["inode"] != seen["inode"] or
+            host["filetype"] != seen["filetype"]):
+        return False
+
+    # Docker Desktop exposes a Windows v9fs bind through a different mount
+    # namespace. Its st_dev may change while the object inode stays the same.
+    # Keep the strict identity check for writable and native Linux binds.
+    try:
+        host_fs = run(["stat", "-f", "-c", "%T", "--", src], PROBE_TIMEOUT).stdout.strip()
+        seen_fs = run(["docker", "exec", container_name, "stat", "-f", "-c",
+                       "%T", "--", dst], PROBE_TIMEOUT).stdout.strip()
+    except subprocess.SubprocessError as exc:
+        raise RuntimeError(f"filesystem probe failed for {container_name}:{dst}: {exc}")
+    if host_fs != "v9fs" or seen_fs != "v9fs":
+        return False
+
+    container = inspect_container(container_name)
+    if not container or not isinstance(container.get("Mounts"), list):
+        raise RuntimeError(f"mount inspection failed for {container_name}:{dst}")
+    mounts = [m for m in container["Mounts"] if m.get("Destination") == dst]
+    if (len(mounts) != 1 or mounts[0].get("Type") != "bind" or
+            mounts[0].get("Source") != src or mounts[0].get("RW") is not False):
+        raise RuntimeError(f"unexpected read-only bind declaration for {container_name}:{dst}")
+    return True
+
+
 def classify_running(container_name, binds):
     prevalidate_binds(binds)
     stale_target = ""
-    for src, dst, _ro in binds:
+    for src, dst, ro in binds:
         host = host_stat(src)
         seen = exec_stat(container_name, dst)
-        if (host["device"], host["inode"], host["filetype"]) != (
-                seen["device"], seen["inode"], seen["filetype"]):
+        if not bind_view_matches(container_name, src, dst, ro, host, seen):
             stale_target = stale_target or dst
     return (True, f"stale-bind:{stale_target}") if stale_target else (False, "healthy")
 
@@ -462,11 +493,10 @@ def verify(flags, service, expected_binds):
             return False, f"state={state}"
         try:
             prevalidate_binds(expected_binds)
-            for src, dst, _ro in expected_binds:
+            for src, dst, ro in expected_binds:
                 host = host_stat(src)
                 seen = exec_stat(name, dst)
-                if (host["device"], host["inode"], host["filetype"]) != (
-                        seen["device"], seen["inode"], seen["filetype"]):
+                if not bind_view_matches(name, src, dst, ro, host, seen):
                     return False, f"stale-bind:{dst}"
         except RuntimeError as exc:
             return False, f"verify-error:{exc}"
```

**File**: `ods/tests/test-wsl-bind-recovery.py` (modified, +60/-0)
```diff
@@ -117,6 +117,66 @@ def test_healthy_when_identical(self):
         self.assertEqual(reason, "healthy")
 
 
+class TestWindowsReadonlyV9fsBind(Base):
+    def setUp(self):
+        super().setUp()
+        self.src = str(self.host)
+        self.dst = "/model-stores/windows-lemonade"
+        self.host_identity = {"device": 198, "inode": 41376821576481630, "filetype": "dir"}
+        self.container_identity = {**self.host_identity, "device": 112}
+        self.mount = {"Type": "bind", "Source": self.src,
+                      "Destination": self.dst, "RW": False}
+
+    def test_readonly_v9fs_device_drift_is_healthy_before_and_after_recreate(self):
+        container = {"State": {"Status": "running"}, "Mounts": [self.mount]}
+        with mock.patch.object(H, "host_stat", return_value=self.host_identity), \
+             mock.patch.object(H, "exec_stat", return_value=self.container_identity), \
+             mock.patch.object(H, "run", return_value=cp("v9fs\n")) as probe, \
+             mock.patch.object(H, "inspect_container", return_value=container):
+            self.assertEqual(H.classify_running("dashboard", [(self.src, self.dst, True)]),
+                             (False, "healthy"))
+            with mock.patch.object(H, "compose_ps", return_value=[
+                    {"Service": "dashboard-api", "Name": "dashboard"}]):
+                self.assertEqual(H.verify([], "dashboard-api", [(self.src, self.dst, True)]),
+                                 (True, "ok"))
+        self.assertEqual(probe.call_count, 4)
+
+    def test_v9fs_inode_drift_stays_stale(self):
+        changed = {**self.container_identity, "inode": 2}
+        with mock.patch.object(H, "host_stat", return_value=self.host_identity), \
+             mock.patch.object(H, "exec_stat", return_value=changed), \
+             mock.patch.object(H, "run") as probe:
+            self.assertEqual(H.classify_running("dashboard", [(self.src, self.dst, True)]),
+                             (True, f"stale-bind:{self.dst}"))
+        probe.assert_not_called()
+
+    def test_native_filesystem_device_drift_stays_stale(self):
+        with mock.patch.object(H, "host_stat", return_value=self.host_identity), \
+             mock.patch.object(H, "exec_stat", return_value=self.container_identity), \
+             mock.patch.object(H, "run", return_value=cp("ext2/ext3\n")), \
+             mock.patch.object(H, "inspect_container") as inspect:
+            self.assertEqual(H.classify_running("dashboard", [(self.src, self.dst, True)]),
+                             (True, f"stale-bind:{self.dst}"))
+        inspect.assert_not_called()
+
+    def test_writable_v9fs_remains_strict_and_requires_backup(self):
+        with mock.patch.object(H, "host_stat", return_value=self.host_identity), \
+             mock.patch.object(H, "exec_stat", return_value=self.container_identity), \
+             mock.patch.object(H, "run") as probe:
+            self.assertEqual(H.classify_running("dashboard", [(self.src, self.dst, False)]),
+                             (True, f"stale-bind:{self.dst}"))
+        probe.assert_not_called()
+
+    def test_mismatched_inspected_mount_fails_closed(self):
+        wrong = {**self.mount, "Source": "/unexpected/source"}
+        with mock.patch.object(H, "host_stat", return_value=self.host_identity), \
+             mock.patch.object(H, "exec_stat", return_value=self.container_identity), \
+             mock.patch.object(H, "run", return_value=cp("v9fs\n")), \
+             mock.patch.object(H, "inspect_container", return_value={"Mounts": [wrong]}):
+            with self.assertRaisesRegex(RuntimeError, "unexpected read-only bind"):
+                H.classify_running("dashboard", [(self.src, self.dst, True)])
+
+
 class TestPrevalidateAllBeforeRecreate(Base):
     def test_missing_later_source_fails_before_recreate(self):
         good = self.host
```

---

### Incident Patch 8: `3e49cb85` (2026-09-30)
**Commit Message**: fix: align Lemonade proof ownership with router config mount (#6982)

**File**: `ods/bin/model_switchboard/lemonade_transport.py` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@ def _owned_router(install_dir: Path, project: str) -> str:
         raise OSError("ODS model-router mount ownership metadata is invalid")
     root = Path(install_dir).resolve()
     for target, relative in (("/state", "data"),
-                             ("/config/endpoints.json", "config/model-router/endpoints.json")):
+                             ("/config", "config/model-router")):
         mounts = [mount for mount in all_mounts if mount.get("Destination") == target]
         if (len(mounts) != 1 or mounts[0].get("Type") != "bind"
                 or mounts[0].get("RW") is not False
```

**File**: `ods/tests/test-lemonade-container-transport.py` (modified, +9/-1)
```diff
@@ -22,13 +22,18 @@
 
 
 class OwnershipTests(unittest.TestCase):
+    def test_router_compose_mount_matches_host_agent_contract(self):
+        compose = (Path(__file__).parents[1] / "docker-compose.base.yml").read_text(encoding="utf-8")
+        self.assertIn("${ODS_CONFIG_DIR:-./config}/model-router:/config:ro", compose)
+        self.assertIn("${ODS_DATA_DIR:-./data}:/state:ro", compose)
+
     def setUp(self):
         self.root = Path(tempfile.gettempdir(), "ods-transport-fixture").resolve()
         self.info = dict(Id=CONTAINER_ID, Running=True, Project="ods", Service="model-router",
                          Mounts=[dict(Type="bind", RW=False, Destination=destination,
                                       Source=str(self.root / source))
                                  for destination, source in (("/state", "data"),
-                                     ("/config/endpoints.json", "config/model-router/endpoints.json"))])
+                                     ("/config", "config/model-router"))])
 
     def process(self, stdout=b"", code=0, stderr=b""):
         return subprocess.CompletedProcess([], code, stdout, stderr)
@@ -80,6 +85,9 @@ def test_changed_identity_labels_state_or_mounts_reject_before_exec(self):
                 changed["Mounts"][index][key] = value
                 changes.append(changed)
         changed = copy.deepcopy(self.info)
+        changed["Mounts"][1]["Destination"] = "/config/endpoints.json"
+        changes.append(changed)
+        changed = copy.deepcopy(self.info)
         changed["Mounts"].append(changed["Mounts"][0])
         changes.append(changed)
         changed = copy.deepcopy(self.info)
```

---

### Incident Patch 9: `418bf546` (2026-09-30)
**Commit Message**: Fix ODS recovery guidance for modular Compose (#6973)

* Fix recovery commands for modular ODS stack

* Use installed modern Bash for macOS ods-cli

**File**: `ods/get-ods.sh` (modified, +2/-2)
```diff
@@ -519,9 +519,9 @@ if [[ -d "$INSTALL_DIR" ]]; then
         else
             warn "ODS already installed at $INSTALL_DIR"
             echo ""
-            echo "  To start:     cd $INSTALL_DIR && docker compose up -d"
+            echo "  To start:     cd \"$INSTALL_DIR\" && ./ods-cli start"
             echo "  To reinstall: re-run this script with --force"
-            echo "  To update:    cd $INSTALL_DIR && ./ods-cli update"
+            echo "  To update:    cd \"$INSTALL_DIR\" && ./ods-cli update"
             echo ""
             exit 0
         fi
```

**File**: `ods/installers/phases/12-health.sh` (modified, +2/-2)
```diff
@@ -729,8 +729,8 @@ if [[ "$HEALTH_FAILURES" -gt 0 ]]; then
     if [[ "$EMBEDDINGS_HEALTH_FAILED" == "true" ]]; then
         ai_warn "Embeddings/RAG was selected, but the embeddings service did not become healthy."
         ai_warn "This often means text-embeddings-inference stalled while downloading its ONNX model from Hugging Face."
-        ai_warn "Recovery: docker compose logs embeddings"
-        ai_warn "Then retry after network/CDN recovery: docker compose up -d embeddings"
+        ai_warn "Recovery: cd \"$INSTALL_DIR\" && ./ods-cli logs embeddings"
+        ai_warn "Then retry after network/CDN recovery: cd \"$INSTALL_DIR\" && ./ods-cli start embeddings"
         exit 1
     fi
     if [[ "${COMPOSE_STARTED_WITH_DELAYED_HEALTH:-false}" == "true" ]]; then
```

**File**: `ods/ods-cli` (modified, +8/-0)
```diff
@@ -7,6 +7,14 @@ set -euo pipefail
 
 # Require Bash 4+ (associative arrays used by service registry and ods-cli)
 if (( BASH_VERSINFO[0] < 4 )); then
+    # macOS starts env bash with Apple's Bash 3.2 even after Homebrew installs
+    # Bash 4+. Re-exec the installed modern Bash before using associative arrays.
+    for _ods_modern_bash in /opt/homebrew/bin/bash /usr/local/bin/bash; do
+        if [[ -x "$_ods_modern_bash" ]] &&
+            "$_ods_modern_bash" -c '(( BASH_VERSINFO[0] >= 4 ))' >/dev/null 2>&1; then
+            exec "$_ods_modern_bash" "$0" "$@"
+        fi
+    done
     echo -e "\033[0;31m✗\033[0m ods-cli requires Bash 4.0+ (you have $BASH_VERSION)" >&2
     echo "  macOS ships Bash 3.2 due to licensing. Install a modern version:" >&2
     echo "    brew install bash" >&2
```

**File**: `ods/ods-preflight.sh` (modified, +2/-2)
```diff
@@ -196,7 +196,7 @@ if ods_preflight_uses_litellm; then
     LLM_ENDPOINTS=("http://${SERVICE_HOST}:${LLM_PORT}/health/readiness" "http://127.0.0.1:${LLM_PORT}/health/readiness" "http://127.0.0.1:${LLM_PORT}/v1/models")
     LLM_SERVICE_NAME="LiteLLM gateway"
     LLM_CONTAINER_MATCH="ods-litellm"
-    LLM_START_CMD="docker compose up -d litellm"
+    LLM_START_CMD="cd \"$ODS_DIR\" && ./ods-cli start litellm"
 else
     LLM_PORT="${OLLAMA_PORT:-${LLAMA_SERVER_PORT:-8080}}"
     # Also probe the actual mapped port in case docker remapped it
@@ -205,7 +205,7 @@ else
     LLM_ENDPOINTS=("http://${SERVICE_HOST}:${EXTERNAL_PORT}/health" "http://${SERVICE_HOST}:${EXTERNAL_PORT}/v1/models" "http://127.0.0.1:${EXTERNAL_PORT}/health" "http://127.0.0.1:${EXTERNAL_PORT}/v1/models" "http://127.0.0.1:${LLM_PORT}/health" "http://127.0.0.1:${LLM_PORT}/v1/models")
     LLM_SERVICE_NAME="llama-server"
     LLM_CONTAINER_MATCH="ods-llama-server"
-    LLM_START_CMD="docker compose up -d llama-server"
+    LLM_START_CMD="cd \"$ODS_DIR\" && ./ods-cli start llama-server"
 fi
 
 LLM_FOUND=false
```

**File**: `ods/ods-restore.sh` (modified, +1/-1)
```diff
@@ -680,7 +680,7 @@ do_restore() {
     echo ""
     echo "Next steps:"
     echo "  1. Review restored configuration: cat $ODS_DIR/.env"
-    echo "  2. Start services: docker compose up -d"
+    echo "  2. Start services: cd \"$ODS_DIR\" && ./ods-cli start"
     echo "  3. Check status: ./ods-preflight.sh"
 }
 
```

---

### Incident Patch 10: `21797f99` (2026-09-30)
**Commit Message**: fix: keep Extensions Library readable under restrictive umask (#6975)

Co-authored-by: Mike Bradley <259460275+Lightheartdevs@users.noreply.github.com>

**File**: `.github/workflows/test-linux.yml` (modified, +1/-0)
```diff
@@ -489,6 +489,7 @@ jobs:
           bash tests/test-gateway-only-linux.sh
           bash tests/test-linux-devtools-opt-in.sh
           bash tests/test-dashboard-data-permissions.sh
+          bash tests/test-extensions-library-copy.sh
           sudo -n python3 tests/test_dashboard_data_permissions.py
           bash tests/test-resolve-compose-resilient.sh
           bash tests/test-phase03-multigpu-tty.sh
```

**File**: `ods/installers/lib/extensions-library-copy.sh` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+#!/usr/bin/env bash
+# Copy public Extensions Library templates so the non-root Dashboard API can
+# read them even when the installer was started with a restrictive umask.
+
+ods_copy_extensions_library() {
+    local source_dir="$1" data_dir="$2" target_dir="$2/extensions-library"
+    local symlink
+
+    [[ -d "$source_dir" && ! -L "$source_dir" && -d "$data_dir" && ! -L "$data_dir" ]] || return 1
+    [[ ! -L "$target_dir" ]] || return 1
+    [[ ! -e "$target_dir" || -d "$target_dir" ]] || return 1
+    symlink="$(find -P "$source_dir" -type l -print -quit)" || return 1
+    [[ -z "$symlink" ]] || return 1
+    if [[ -d "$target_dir" ]]; then
+        symlink="$(find -P "$target_dir" -type l -print -quit)" || return 1
+        [[ -z "$symlink" ]] || return 1
+    fi
+
+    # Keep the caller's umask for secrets elsewhere in phase 06. These are
+    # product-owned public templates, and the API may have a different UID.
+    (umask 022; mkdir -p "$target_dir" && cp -r "$source_dir/." "$target_dir/") || return 1
+    # Only traversal is needed on the parent data directory; do not expose
+    # its other private child names merely to make the Library reachable.
+    chmod go+x,go-w "$data_dir" || return 1
+    chmod go+rx,go-w "$target_dir" || return 1
+
+    # Only template-derived paths get their read/traverse bits repaired. A
+    # retained custom entry outside the bundled template names is untouched.
+    find -P "$source_dir" \( -type d -o -type f \) -exec bash -c '
+        source_root=$1; target_root=$2; shift 2
+        for source_path do
+            target_path=$target_root${source_path#"$source_root"}
+            [[ ! -L "$target_path" ]] || exit 1
+            if [[ -d "$source_path" ]]; then
+                [[ -d "$target_path" ]] && chmod go+rx,go-w "$target_path" || exit 1
+            else
+                [[ -f "$target_path" ]] && chmod go+rX,go-w "$target_path" || exit 1
+            fi
+        done
+    ' _ "$source_dir" "$target_dir" {} + || return 1
+    # Preserve the prior rule that no installed Library entry is writable by
+    # another host user, including retained custom entries.
+    find -P "$target_dir" \( -type d -o -type f \) -exec chmod go-w {} +
+}
```

**File**: `ods/installers/phases/06-directories.sh` (modified, +4/-6)
```diff
@@ -27,6 +27,9 @@
 #   or change directory layout here.
 # ============================================================================
 
+# shellcheck source=installers/lib/extensions-library-copy.sh
+source "$SCRIPT_DIR/installers/lib/extensions-library-copy.sh"
+
 ods_progress 38 "directories" "Preparing installation directory"
 chapter "SETTING UP INSTALLATION"
 
@@ -500,12 +503,7 @@ Fix with: sudo chown -R \$(id -u):\$(id -g) $INSTALL_DIR/config $INSTALL_DIR/dat
         if [[ -d "$_candidate" ]]; then _ext_lib_src="$_candidate"; break; fi
     done
     if [[ -n "$_ext_lib_src" ]]; then
-        mkdir -p "$INSTALL_DIR/data/extensions-library"
-        cp -r "$_ext_lib_src/." "$INSTALL_DIR/data/extensions-library/"
-        [[ ! -L "$INSTALL_DIR/data/extensions-library" ]] \
-            || error "Installed extension library cannot be a symlink"
-        find -P "$INSTALL_DIR/data/extensions-library" \( -type d -o -type f \) \
-            -exec chmod go-w {} + \
+        ods_copy_extensions_library "$_ext_lib_src" "$INSTALL_DIR/data" \
             || error "Could not secure the installed extension library"
         ai_ok "Extensions library copied to data/extensions-library/ (from $_ext_lib_src)"
     else
```

**File**: `ods/tests/contracts/test-installer-hardening.sh` (modified, +3/-1)
```diff
@@ -690,7 +690,9 @@ assert_contains "installers/phases/06-directories.sh" 'find -P "\$_installed_cod
 assert_contains "installers/phases/06-directories.sh" '"\$INSTALL_DIR/bin"' "Linux installer does not normalize installed command modes"
 assert_contains "installers/phases/06-directories.sh" 'find -P "\$INSTALL_DIR" -maxdepth 1' "Linux installer does not normalize root executable modes"
 assert_contains "installers/phases/06-directories.sh" 'chmod go-w \{\} \+' "Linux installer leaves copied product code ambiently writable"
-assert_contains "installers/phases/06-directories.sh" 'find -P "\$INSTALL_DIR/data/extensions-library"' "Linux installer does not normalize copied extension-library modes"
+assert_contains "installers/phases/06-directories.sh" 'ods_copy_extensions_library' "Linux installer does not stage readable extension-library templates"
+assert_contains "installers/lib/extensions-library-copy.sh" 'chmod go\+rX,go-w' "Linux installer does not repair extension-library file readability"
+assert_contains "installers/lib/extensions-library-copy.sh" 'find -P "\$target_dir"' "Linux installer does not secure retained extension-library entries"
 
 echo "[contract] Windows phase 06 stages the extension library"
 win_phase06="installers/windows/phases/06-directories.ps1"
```

**File**: `ods/tests/test-extensions-library-copy.sh` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+# shellcheck source=../installers/lib/extensions-library-copy.sh
+source "$root/installers/lib/extensions-library-copy.sh"
+tmp="$(mktemp -d "${TMPDIR:-/tmp}/ods-ext-library-copy.XXXXXX")"
+trap 'rm -rf "$tmp"' EXIT
+
+source_dir="$tmp/source services"
+mkdir -p "$source_dir/sample/nested"
+printf 'template\n' >"$source_dir/sample/nested/manifest.yaml"
+printf '#!/bin/sh\nexit 0\n' >"$source_dir/sample/start.sh"
+chmod 755 "$source_dir/sample/start.sh"
+
+for mask in 022 077; do
+    data_dir="$tmp/install $mask/data"
+    (umask "$mask"; mkdir -p "$data_dir")
+    (
+        umask "$mask"
+        ods_copy_extensions_library "$source_dir" "$data_dir"
+        [[ "$(umask)" == "0$mask" ]]
+    )
+    [[ "$(stat -c %a "$data_dir")" == "$(if [[ "$mask" == 077 ]]; then printf 711; else printf 755; fi)" ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library")" == 755 ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library/sample/nested")" == 755 ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library/sample/nested/manifest.yaml")" == 644 ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library/sample/start.sh")" == 755 ]]
+
+    mkdir -p "$data_dir/extensions-library/custom"
+    printf 'private retained data\n' >"$data_dir/extensions-library/custom/private.txt"
+    chmod 700 "$data_dir/extensions-library/custom"
+    chmod 600 "$data_dir/extensions-library/custom/private.txt"
+    chmod 700 "$data_dir/extensions-library/sample/nested"
+    chmod 600 "$data_dir/extensions-library/sample/nested/manifest.yaml"
+    (umask 077; ods_copy_extensions_library "$source_dir" "$data_dir")
+    [[ "$(stat -c %a "$data_dir/extensions-library/sample/nested")" == 755 ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library/sample/nested/manifest.yaml")" == 644 ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library/custom")" == 700 ]]
+    [[ "$(stat -c %a "$data_dir/extensions-library/custom/private.txt")" == 600 ]]
+    [[ "$(cat "$data_dir/extensions-library/custom/private.txt")" == 'private retained data' ]]
+done
+
+outside="$tmp/outside"
+mkdir -p "$outside"
+printf 'unchanged\n' >"$outside/sentinel"
+symlink_data="$tmp/symlink-install/data"
+mkdir -p "$symlink_data"
+ln -s "$outside" "$symlink_data/extensions-library"
+if ods_copy_extensions_library "$source_dir" "$symlink_data"; then
+    printf 'symlink destination unexpectedly accepted\n' >&2
+    exit 1
+fi
+[[ "$(cat "$outside/sentinel")" == unchanged ]]
+[[ "$(find "$outside" -mindepth 1 -type f | wc -l)" == 1 ]]
+
+printf 'PASS: Extensions Library templates remain readable under umask 022/077 without widening custom entries\n'
```

#### Recent Merged Pull Requests:
- **PR #7045** (2026-09-30): fix(pixel): preserve public helper traversal under restrictive umask (@Lightheartdevs)
- **PR #7044** (2026-09-30): Reuse Docker layers during Linux and Windows local image builds (@Lightheartdevs)
- **PR #7043** (2026-09-30): Retain Portal pre-submission failures for exact chat recovery (@Lightheartdevs)
- **PR #7039** (2026-09-30): Recover stale Pixel sandbox during forced reinstall (@Lightheartdevs)
- **PR #7037** (2026-09-30): Repair external Lemonade route retained from CPU fallback (@Lightheartdevs)
- **PR #7032** (2026-09-30): Report Docker credential helper failures during image pulls (@Lightheartdevs)
- **PR #7028** (2026-09-30): Keep localhost dashboard open in LAN mode (@Lightheartdevs)
- **PR #7012** (2026-09-30): Make Voice add-back usable after lean install (@Lightheartdevs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
