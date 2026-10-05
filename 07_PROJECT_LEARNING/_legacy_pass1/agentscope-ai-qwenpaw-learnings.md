# Forensic Learning Record (Deep Inspection): agentscope-ai/QwenPaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentscope-ai-qwenpaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentscope-ai/QwenPaw](https://github.com/agentscope-ai/QwenPaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:15:27.072Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentscope-ai/QwenPaw`
- **Description**: Your Personal AI Assistant; easy to install, deploy on your own machine or on the cloud; supports multiple chat apps with easily extensible capabilities.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 35387 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `console/eslint.config.js`
```
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);

```

### Core Architecture Module: `console/scripts/precompress-assets.mjs`
```
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const outputDirectory = new URL("../dist/", import.meta.url);
const compressibleExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".wasm",
]);
const minimumSize = 1024;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return files.flat();
}

async function compress(path) {
  if (!compressibleExtensions.has(extname(path))) return false;
  if ((await stat(path)).size < minimumSize) return false;
  const source = await readFile(path);
  const [brotli, gzipped] = await Promise.all([
    compressBrotli(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 6,
      },
    }),
    compressGzip(source, { level: 6 }),
  ]);
  await Promise.all([
    writeFile(`${path}.br`, brotli),
    writeFile(`${path}.gz`, gzipped),
  ]);
  return true;
}

const outputPath = fileURLToPath(outputDirectory);
const files = await walk(outputPath);
const results = await Promise.all(files.map(compress));
const count = results.filter(Boolean).length;
console.log(`Precompressed ${count} Console assets.`);

```

### Core Architecture Module: `console/scripts/verify-initial-bundle.mjs`
```
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(scriptDirectory, "..", "dist");
const indexPath = join(outputDirectory, "index.html");
const maximumRawBytes = 10 * 1024 * 1024;
const maximumBrotliBytes = 3 * 1024 * 1024;

const html = await readFile(indexPath, "utf-8");
const assets = new Set(
  [...html.matchAll(/\/assets\/[^"' ]+\.(?:css|js)/g)].map(([asset]) => asset),
);

const initialJavaScriptAssets = [...assets].filter((asset) =>
  asset.endsWith(".js"),
);
const initialJavaScriptNames = new Set(
  initialJavaScriptAssets.map((asset) => asset.split("/").at(-1)),
);
const importGraph = new Map();

for (const asset of initialJavaScriptAssets) {
  const source = await readFile(join(outputDirectory, asset), "utf-8");
  const dependencies = new Set(
    [...source.matchAll(/\b(?:from|import)\s*\(?["']\.\/([^"']+\.js)["']/g)]
      .map((match) => match[1])
      .filter((dependency) => initialJavaScriptNames.has(dependency)),
  );
  importGraph.set(asset.split("/").at(-1), dependencies);
}

const visited = new Set();
const active = new Set();
const stack = [];

function findImportCycle(asset) {
  if (active.has(asset)) {
    return [...stack.slice(stack.indexOf(asset)), asset];
  }
  if (visited.has(asset)) {
    return null;
  }

  visited.add(asset);
  active.add(asset);
  stack.push(asset);
  for (const dependency of importGraph.get(asset) ?? []) {
    const cycle = findImportCycle(dependency);
    if (cycle) {
      return cycle;
    }
  }
  stack.pop();
  active.delete(asset);
  return null;
}

for (const asset of initialJavaScriptNames) {
  const cycle = findImportCycle(asset);
  if (cycle) {
    throw new Error(`Initial JavaScript import cycle: ${cycle.join(" -> ")}`);
  }
}

let rawBytes = 0;
let brotliBytes = 0;
for (const asset of assets) {
  const path = join(outputDirectory, asset);
  const rawSize = (await stat(path)).size;
  rawBytes += rawSize;
  try {
    brotliBytes += (await stat(`${path}.br`)).size;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    brotliBytes += rawSize;
  }
}

const toMiB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(
  `Initial bundle: ${toMiB(rawBytes)} MiB raw, ` +
    `${toMiB(brotliBytes)} MiB Brotli across ${assets.size} assets.`,
);

if (rawBytes > maximumRawBytes) {
  throw new Error(`Initial raw bundle exceeds ${toMiB(maximumRawBytes)} MiB.`);
}
if (brotliBytes > maximumBrotliBytes) {
  throw new Error(
    `Initial Brotli bundle exceeds ${toMiB(maximumBrotliBytes)} MiB.`,
  );
}

```

### Core Architecture Module: `console/scripts/verify-monaco-css.mjs`
```
#!/usr/bin/env node
/**
 * Build guard: assert the console bundle still ships Monaco's stylesheet.
 *
 * Monaco keeps a hidden `<textarea class="inputarea">` for keyboard / IME
 * input. Without `monaco-editor`'s CSS that textarea renders with browser
 * default styles (a large white box floating over the code) and the editor
 * loses its input-layer positioning, so clicks no longer land on the caret
 * (issue #6547). That is exactly what happens when node_modules CSS is
 * stubbed out during a real build, so fail loudly instead of shipping a
 * broken Coding Mode editor.
 *
 * Usage: node scripts/verify-monaco-css.mjs [outDir]   (default: dist)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Substrings that only exist in monaco-editor's stylesheet. Deliberately not
// tied to hashed file names or minified whitespace.
const MARKERS = ["inputarea", "overflow-guard"];

function collectCssFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectCssFiles(full));
    } else if (entry.name.endsWith(".css")) {
      found.push(full);
    }
  }
  return found;
}

const outDir = process.argv[2] ?? "dist";
let cssFiles;
try {
  cssFiles = collectCssFiles(outDir);
} catch (err) {
  console.error(`[verify-monaco-css] cannot read build output "${outDir}"`);
  throw err;
}

const missing = MARKERS.filter(
  (marker) =>
    !cssFiles.some((file) => readFileSync(file, "utf8").includes(marker)),
);

if (cssFiles.length === 0 || missing.length > 0) {
  console.error(
    `[verify-monaco-css] Monaco stylesheet missing from ${outDir}: ` +
      `${missing.join(", ") || "no CSS emitted at all"}.\n` +
      "The Coding Mode editor will show a floating white textarea and " +
      "misplaced cursor. Check that no plugin stubs node_modules CSS " +
      "during builds (console/vite.config.ts).",
  );
  process.exit(1);
}

console.log(
  `[verify-monaco-css] OK - Monaco stylesheet present in ${cssFiles.length} CSS file(s).`,
);

```

### Core Architecture Module: `console/src-tauri/src/backend.rs`
```
//! Backend sidecar lifecycle for the Tauri desktop app.

use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};

use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::watch;
use uuid::Uuid;

mod command;
mod events;

/// Path of the desktop-only graceful shutdown endpoint on the backend.
const DESKTOP_SHUTDOWN_PATH: &str = "/api/desktop/shutdown";
const DESKTOP_SHUTDOWN_TOKEN_ENV: &str = "QWENPAW_DESKTOP_SHUTDOWN_TOKEN";
const DESKTOP_SHUTDOWN_TOKEN_HEADER: &str = "X-QwenPaw-Desktop-Shutdown-Token";
/// Upper bound for the shutdown HTTP request. The endpoint just flips
/// uvicorn's `should_exit` and returns immediately, so the request is
/// milliseconds in the happy path; this is only a fallback so a wedged
/// backend never blocks quit. uvicorn's own `timeout_graceful_shutdown`
/// bounds the sidecar's internal drain independently.
const GRACEFUL_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(3);
const GRACEFUL_SHUTDOWN_EXIT_TIMEOUT: Duration = Duration::from_secs(60);
const FORCED_SHUTDOWN_EXIT_TIMEOUT: Duration = Duration::from_secs(5);

/// Shared sidecar process state managed by Tauri.
#[derive(Default)]
pub(crate) struct BackendState {
    inner: Mutex<BackendInner>,
    generation: AtomicU64,
}

#[derive(Default)]
struct BackendInner {
    child: Option<CommandChild>,
    port: Option<u16>,
    shutdown_token: Option<String>,
    terminated: Option<watch::Receiver<bool>>,
    stopping: bool,
    error: Option<String>,
}

enum StopPlan {
    NoProcess,
    Wait(watch::Receiver<bool>),
    Request {
        pid: u32,
        port: Option<u16>,
        shutdown_token: Option<String>,
        terminated: watch::Receiver<bool>,
    },
}

impl BackendState {
    fn with_inner<R>(&self, f: impl FnOnce(&mut BackendInner) -> R) -> R {
        let mut inner = self.inner.lock().expect("backend state poisoned");
        f(&mut inner)
    }

    fn next_generation(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn is_current(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
    }

    fn port(&self) -> Option<u16> {
        self.with_inner(|inner| inner.port)
    }

    fn error(&self) -> Option<String> {
        self.with_inner(|inner| inner.error.clone())
    }

    fn set_error(&self, message: String) {
        self.with_inner(|inner| {
            inner.error = Some(message);
        });
    }

    fn set_error_if_current(&self, generation: u64, message: String) {
        if self.is_current(generation) {
            self.set_error(message);
        }
    }

    fn set_port_if_current(&self, generation: u64, port: u16) {
        if self.is_current(generation) {
            self.with_inner(|inner| {
                inner.port = Some(port);
                inner.error = None;
            });
        }
    }

    fn clear_startup_state(&self) {
        self.with_inner(|inner| {
            inner.port = None;
            inner.shutdown_token = None;
            inner.terminated = None;
            inner.stopping = false;
            inner.error = None;
        });
    }

    fn clear_child_if_current(&self, generation: u64) {
        if self.is_current(generation) {
            self.with_inner(|inner| {
                inner.child.take();
                inner.shutdown_token = None;
                inner.terminated = None;
                inner.stopping = false;
            });
        }
    }

    fn begin_stop(&self) -> StopPlan {
        self.with_inner(|inner| {
            let Some(terminated) = &inner.terminated else {
                return StopPlan::NoProcess;
            };
            if *terminated.borrow() {
                inner.child.take();
                inner.port = None;
                inner.shutdown_token = None;
                inner.terminated = None;
                inner.stopping = false;
                return StopPlan::NoProcess;
            }

            let terminated = terminated.clone();
            if inner.stopping {
                return StopPlan::Wait(terminated);
            }
            let Some(child) = &inner.child else {
                return StopPlan::Wait(terminated);
            };

            self.next_generation();
            inner.stopping = true;
            StopPlan::Request {
                pid: child.pid(),
                port: inner.port,
                shutdown_token: inner.shutdown_token.clone(),
                terminated,
            }
        })
    }

    fn force_kill(&self) {
        let child = self.with_inner(|inner| inner.child.take());
        let Some(child) = child else {
            return;
        };

        let pid = child.pid();
        if let Err(err) = child.kill() {
            log::warn!("[backend] failed to stop process pid={pid}: {err}");
        }
    }

    fn finish_stop(&self) {
        self.with_inner(|inner| {
            inner.child.take();
            inner.port = None;
            inner.shutdown_token = None;
            inner.terminated = None;
            inner.stopping = false;
        });
    }

    async fn request_stop(&self, pid: u32, port: Option<u16>, shutdown_token: Option<String>) {
        log::info!("[backend] stopping process pid={pid}");

        if let (Some(port), Some(shutdown_token)) = (port, shutdown_token) {
            match request_graceful_shutdown(port, &shutdown_token).await {
                Ok(()) => {
                    log::info!("[backend] graceful shutdown requested pid={pid}");
                    return;
                }
                Err(err) => {
                    log::warn!(
                        "[backend] graceful shutdown failed pid={pid}: {err}; killing process"
                    );
                }
            }
        } else {
            log::warn!("[backend] no shutdown credentials for pid={pid}; killing process");
        }

        self.force_kill();
    }

    async fn stop_and_wait(&self) -> Result<(), String> {
        let terminated = match self.begin_stop() {
            StopPlan::NoProcess => return Ok(()),
            StopPlan::Wait(terminated) => terminated,
            StopPlan::Request {
                pid,
                port,
                shutdown_token,
                terminated,
            } => {
                self.request_stop(pid, port, shutdown_token).await;
                terminated
            }
        };

        match wait_for_termination(terminated.clone(), GRACEFUL_SHUTDOWN_EXIT_TIMEOUT).await {
            Ok(()) => {
                self.finish_stop();
                Ok(())
            }
            Err(err) => {
                log::warn!("[backend] {err}; forcing sidecar termination");
                self.force_kill();
                match wait_for_termination(terminated, FORCED_SHUTDOWN_EXIT_TIMEOUT).await {
                    Ok(()) => {
                        log::warn!("[backend] sidecar force-terminated after graceful shutdown failure");
                        self.finish_stop();
                        Ok(())
                    }
                    Err(force_err) => {
                        self.finish_stop();
                        Err(format!(
                            "{err}; failed to confirm forced backend termination: {force_err}"
                        ))
                    }
                }
            }
        }
    }
}

/// Requests a graceful shutdown from the desktop-only backend endpoint.
///
/// The endpoint sets uvicorn's `should_exit`, letting the sidecar run its
/// normal lifespan shutdown instead of being force-killed.
async fn request_graceful_shutdown(port: u16, shutdown_token: &str) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{port}{DESKTOP_SHUTDOWN_PATH}");
    let client = reqwest::Client::builder()
        .timeout(GRACEFUL_SHUTDOWN_TIMEOUT)
        .build()
        .map_err(|err| format!("f
```

### Core Architecture Module: `console/src-tauri/src/backend/command.rs`
```
//! Backend command construction for development and packaged builds.

use std::path::{Path, PathBuf};
#[cfg(debug_assertions)]
use std::process::{Command as StdCommand, Stdio};

#[cfg(not(debug_assertions))]
use tauri::Manager;
use tauri_plugin_shell::{process::Command, ShellExt};

/// Builds the command used to start the Python backend sidecar.
#[cfg(debug_assertions)]
pub(super) fn create(app: &tauri::AppHandle) -> Result<Command, String> {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let source_path = repo_root.join("src");
    let command = if command_exists("uv") {
        log::info!(
            "[backend] dev command: uv run python -m qwenpaw.tauri.entry cwd={}",
            repo_root.display(),
        );
        app.shell()
            .command("uv")
            .args(["run", "python", "-m", "qwenpaw.tauri.entry"])
            .current_dir(repo_root)
            .env("PYTHONPATH", source_path.display().to_string())
    } else {
        let (python, prefix_args) = python_command(&repo_root);
        let mut args = prefix_args;
        args.extend(["-m", "qwenpaw.tauri.entry"]);
        log::info!(
            "[backend] dev command: {} {} cwd={}",
            python,
            args.join(" "),
            repo_root.display(),
        );
        app.shell()
            .command(python)
            .args(args)
            .current_dir(repo_root)
            .env("PYTHONPATH", source_path.display().to_string())
    };
    Ok(apply_contributed_environment(app, command))
}

/// Builds the command used to start the packaged Python backend sidecar.
#[cfg(not(debug_assertions))]
pub(super) fn create(app: &tauri::AppHandle) -> Result<Command, String> {
    let backend = packaged_backend_executable(app)?;
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("failed to resolve resource directory: {err}"))?;
    let backend_dir = backend
        .parent()
        .ok_or_else(|| format!("backend executable has no parent: {}", backend.display()))?
        .to_path_buf();
    log::info!(
        "[backend] packaged command: {} cwd={}",
        backend.display(),
        backend_dir.display(),
    );
    let command = app
        .shell()
        .command(backend)
        .current_dir(&backend_dir)
        .env(path_env_key(), path_with_backend_dir(&backend_dir)?)
        .env(
            "QWENPAW_TAURI_RESOURCE_DIR",
            resource_dir.to_string_lossy().to_string(),
        );
    let mut command = apply_contributed_environment(app, command);
    // A complete Playwright Chromium payload exceeds the practical NSIS
    // installer mapping limit on Windows. The sidecar downloads the exact
    // driver-matched revision into the user's QwenPaw data directory instead.
    if cfg!(windows) {
        command = command.env("QWENPAW_DESKTOP_MANAGED_PLAYWRIGHT", "1");
    }
    // Bundled standalone Python used by the backend to install third-party
    // plugin dependencies (sys.executable is the frozen backend, not Python).
    if let Some(python) = packaged_python_runtime(app) {
        log::info!("[backend] bundled python runtime: {}", python.display());
        command = command.env(
            "QWENPAW_DESKTOP_PY_RUNTIME",
            python.to_string_lossy().to_string(),
        );
    } else {
        log::warn!(
            "[backend] bundled python runtime not found; plugin dependency \
             installation will be unavailable"
        );
    }
    if let Some(node_runtime) = packaged_node_runtime(app) {
        log::info!("[backend] bundled node runtime: {}", node_runtime.display());
        command = command.env(
            "QWENPAW_DESKTOP_NODE_RUNTIME",
            node_runtime.to_string_lossy().to_string(),
        );
    } else {
        log::warn!("[backend] bundled node runtime not found");
    }
    Ok(command)
}

#[cfg(not(debug_assertions))]
fn packaged_python_runtime(app: &tauri::AppHandle) -> Option<PathBuf> {
    let base = app
        .path()
        .resource_dir()
        .ok()?
        .join("binaries")
        .join("python-runtime")
        .join("python");
    let candidates = if cfg!(windows) {
        vec![base.join("python.exe")]
    } else {
        vec![
            base.join("bin").join("python3"),
            base.join("bin").join("python"),
        ]
    };
    candidates.into_iter().find(|path| path.is_file())
}

/// Add the variables desktop features contribute to the backend's environment.
///
/// The set comes from [`crate::runtime_env`], so this stays independent of which
/// feature needs what.
fn apply_contributed_environment(app: &tauri::AppHandle, mut command: Command) -> Command {
    for (key, value) in crate::runtime_env::collect(app) {
        command = command.env(key, value);
    }
    command
}

#[cfg(not(debug_assertions))]
fn packaged_node_runtime(app: &tauri::AppHandle) -> Option<PathBuf> {
    let root = app
        .path()
        .resource_dir()
        .ok()?
        .join("binaries")
        .join("node-runtime");
    let node = if cfg!(windows) {
        root.join("node.exe")
    } else {
        root.join("bin").join("node")
    };
    node.is_file().then_some(root)
}

#[cfg(not(debug_assertions))]
fn packaged_backend_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let executable_name = if cfg!(windows) {
        "qwenpaw-backend.exe"
    } else {
        "qwenpaw-backend"
    };
    let path = app
        .path()
        .resource_dir()
        .map_err(|err| format!("failed to resolve resource directory: {err}"))?
        .join("binaries")
        .join("qwenpaw-backend")
        .join(executable_name);

    if path.is_file() {
        Ok(path)
    } else {
        Err(format!(
            "backend executable not found at {}",
            path.display()
        ))
    }
}

#[cfg(not(debug_assertions))]
fn path_with_backend_dir(backend_dir: &Path) -> Result<String, String> {
    let mut paths = vec![backend_dir.to_path_buf()];
    if let Some(existing) = std::env::var_os(path_env_key()) {
        paths.extend(std::env::split_paths(&existing));
    }

    std::env::join_paths(paths)
        .map_err(|err| format!("failed to join backend PATH entries: {err}"))?
        .into_string()
        .map_err(|_| "backend PATH contains non-Unicode data".to_string())
}

#[cfg(all(not(debug_assertions), windows))]
fn path_env_key() -> &'static str {
    "Path"
}

#[cfg(all(not(debug_assertions), not(windows)))]
fn path_env_key() -> &'static str {
    "PATH"
}

#[cfg(debug_assertions)]
fn command_exists(command: &str) -> bool {
    StdCommand::new(command)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

#[cfg(debug_assertions)]
fn local_python(repo_root: &Path) -> Option<String> {
    let candidates = if cfg!(windows) {
        vec![
            repo_root.join(".venv/Scripts/python.exe"),
            repo_root.join("venv/Scripts/python.exe"),
        ]
    } else {
        vec![
            repo_root.join(".venv/bin/python"),
            repo_root.join("venv/bin/python"),
        ]
    };

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .map(|path| path.display().to_string())
}

#[cfg(debug_assertions)]
fn python_command(repo_root: &Path) -> (String, Vec<&'static str>) {
    if let Some(local) = local_python(repo_root) {
        return (local, vec![]);
    }
    #[cfg(windows)]
    {
        if command_exists("py") {
            return ("py".to_string(), vec!["-3"]);
        }
    }
    if command_exists("python3") {
        ("python3".to_string(), vec![])
    } else {
        ("python".to_string(), vec![])
    }
}

```

### Core Architecture Module: `console/src-tauri/src/backend/events.rs`
```
//! Sidecar process event handling and stderr capture.

use serde::Deserialize;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandEvent, TerminatedPayload};
use tokio::sync::watch;

use super::BackendState;

const MAX_CAPTURED_STDERR_CHARS: usize = 4000;
const STDERR_TRUNCATION_MARKER: &str = "\n[...stderr truncated...]\n";
const BACKEND_READY_PREFIX: &str = "QWENPAW_BACKEND_READY ";

#[derive(Deserialize)]
struct BackendReadyPayload {
    port: u16,
}

/// Watches sidecar output and reports failures for the current process generation.
pub(super) fn watch(
    app: tauri::AppHandle,
    generation: u64,
    mut rx: tauri::async_runtime::Receiver<CommandEvent>,
    terminated: watch::Sender<bool>,
) {
    tauri::async_runtime::spawn(async move {
        let mut last_stderr = String::new();
        log::info!("[backend] watching process generation={generation}");
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    log::info!("[backend:{generation}] stdout: {}", text.trim_end());
                    if let Some(port) = ready_port_from_stdout(&text) {
                        log::info!("[backend:{generation}] ready port={port}");
                        app.state::<BackendState>()
                            .set_port_if_current(generation, port);
                    }
                }
                CommandEvent::Stderr(line) => {
                    record_stderr(generation, &mut last_stderr, &line);
                }
                CommandEvent::Error(message) => {
                    log::error!("[backend:{generation}] process event error: {message}");
                    app.state::<BackendState>().set_error_if_current(
                        generation,
                        format!("backend process error: {message}"),
                    );
                }
                CommandEvent::Terminated(payload) => {
                    let message = termination_message(payload, &last_stderr);
                    let state = app.state::<BackendState>();
                    let stopping = !state.is_current(generation);
                    terminated.send_replace(true);
                    if stopping {
                        log::info!(
                            "[backend:{generation}] process terminated after shutdown request"
                        );
                    } else {
                        log::warn!("[backend:{generation}] {message}");
                        state.set_error_if_current(generation, message);
                    }
                }
                _ => {}
            }
        }

        log::warn!("[backend:{generation}] process event stream closed");
        app.state::<BackendState>()
            .clear_child_if_current(generation);
    });
}

fn ready_port_from_stdout(text: &str) -> Option<u16> {
    text.lines().find_map(|line| {
        let payload = line.trim().strip_prefix(BACKEND_READY_PREFIX)?;
        serde_json::from_str::<BackendReadyPayload>(payload)
            .ok()
            .map(|ready| ready.port)
    })
}

fn record_stderr(generation: u64, buffer: &mut String, line: &[u8]) {
    let text = String::from_utf8_lossy(line).to_string();
    log::error!("[backend:{generation}] stderr: {text}");
    buffer.push_str(&text);
    trim_captured_stderr(buffer);
}

fn trim_captured_stderr(text: &mut String) {
    let total = text.chars().count();
    if total <= MAX_CAPTURED_STDERR_CHARS {
        return;
    }

    let marker_len = STDERR_TRUNCATION_MARKER.chars().count();
    let keep_chars = MAX_CAPTURED_STDERR_CHARS.saturating_sub(marker_len);
    let head_chars = keep_chars / 2;
    let tail_chars = keep_chars - head_chars;
    let head = first_chars(text, head_chars);
    let tail = last_chars(text, tail_chars);
    *text = format!("{head}{STDERR_TRUNCATION_MARKER}{tail}");
}

fn first_chars(text: &str, count: usize) -> String {
    text.chars().take(count).collect()
}

fn last_chars(text: &str, count: usize) -> String {
    let mut chars = text.chars().rev().take(count).collect::<Vec<_>>();
    chars.reverse();
    chars.into_iter().collect()
}

fn termination_message(payload: TerminatedPayload, last_stderr: &str) -> String {
    let mut message = match (payload.code, payload.signal) {
        (Some(code), _) => format!("backend process exited unexpectedly with code {code}"),
        (_, Some(signal)) => format!("backend process exited unexpectedly by signal {signal}"),
        _ => "backend process exited unexpectedly".to_string(),
    };

    let stderr = last_stderr.trim();
    if !stderr.is_empty() {
        message.push_str("\n\nLast stderr:\n");
        message.push_str(stderr);
    }

    message
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trim_captured_stderr_preserves_head_and_tail() {
        let mut text = format!("{}middle{}", "head".repeat(1200), "tail".repeat(1200));

        trim_captured_stderr(&mut text);

        assert!(text.chars().count() <= MAX_CAPTURED_STDERR_CHARS);
        assert!(text.starts_with("head"));
        assert!(text.contains(STDERR_TRUNCATION_MARKER));
        assert!(text.ends_with("tail"));
        assert!(!text.contains("middle"));
    }

    #[test]
    fn ready_port_from_stdout_parses_protocol_line() {
        let text = "INFO before\nQWENPAW_BACKEND_READY {\"port\":54321}\n";

        assert_eq!(ready_port_from_stdout(text), Some(54321));
    }

    #[test]
    fn ready_port_from_stdout_ignores_other_output() {
        assert_eq!(ready_port_from_stdout("QWENPAW_BACKEND_READY nope"), None);
        assert_eq!(ready_port_from_stdout("ordinary stdout"), None);
    }
}

```

### Core Architecture Module: `console/src-tauri/src/backend_download.rs`
```
//! Native downloads for files served by the bundled local backend.

use std::{collections::HashMap, net::IpAddr, path::PathBuf, time::Duration};

use futures_util::TryStreamExt;
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    Url,
};
use serde::Deserialize;
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncWriteExt, BufWriter},
};

const BACKEND_DOWNLOAD_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const BACKEND_DOWNLOAD_TOTAL_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadBackendFileRequest {
    url: String,
    file_path: String,
    headers: Option<HashMap<String, String>>,
}

/// Stream a local backend response to the user-selected file path without using system proxies.
#[tauri::command]
pub(crate) async fn download_backend_file(
    request: DownloadBackendFileRequest,
) -> Result<(), String> {
    let url = parse_local_backend_url(&request.url)?;
    let file_path = parse_file_path(&request.file_path)?;
    let headers = parse_headers(request.headers.unwrap_or_default())?;

    let response = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(BACKEND_DOWNLOAD_CONNECT_TIMEOUT)
        .timeout(BACKEND_DOWNLOAD_TOTAL_TIMEOUT)
        .build()
        .map_err(|err| format!("failed to create download client: {err}"))?
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|err| format!("download request failed: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "download request failed with status code {}",
            response.status()
        ));
    }

    let mut file = BufWriter::new(
        File::create(&file_path)
            .await
            .map_err(|err| format!("failed to create file: {err}"))?,
    );
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream
        .try_next()
        .await
        .map_err(|err| format!("failed to read response stream: {err}"))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|err| format!("failed to write file: {err}"))?;
    }

    file.flush()
        .await
        .map_err(|err| format!("failed to flush file: {err}"))
}

fn parse_local_backend_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url).map_err(|err| format!("invalid download URL: {err}"))?;
    if parsed.scheme() != "http" {
        return Err("download URL protocol is not supported".into());
    }
    if !is_loopback_host(&parsed) {
        return Err("download URL must target the local backend".into());
    }
    Ok(parsed)
}

fn is_loopback_host(url: &Url) -> bool {
    match url.host_str() {
        Some(host) if host.eq_ignore_ascii_case("localhost") => true,
        Some(host) => host
            .trim_matches(['[', ']'])
            .parse::<IpAddr>()
            .map(|ip| ip.is_loopback())
            .unwrap_or(false),
        None => false,
    }
}

fn parse_file_path(file_path: &str) -> Result<PathBuf, String> {
    if file_path.trim().is_empty() {
        return Err("download file path is empty".into());
    }
    Ok(PathBuf::from(file_path))
}

fn parse_headers(headers: HashMap<String, String>) -> Result<HeaderMap, String> {
    let mut header_map = HeaderMap::new();
    for (name, value) in headers {
        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|err| format!("invalid download header name: {err}"))?;
        let header_value = HeaderValue::from_str(&value)
            .map_err(|err| format!("invalid download header value: {err}"))?;
        header_map.insert(header_name, header_value);
    }
    Ok(header_map)
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::{get_coding_directory, parse_local_backend_url};

    /// Serialize tests that mutate process environment variables.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn accepts_loopback_backend_urls() {
        assert!(parse_local_backend_url("http://127.0.0.1:54377/api/backups/id/export").is_ok());
        assert!(parse_local_backend_url("http://localhost:54377/api/workspace/download").is_ok());
        assert!(parse_local_backend_url("http://[::1]:54377/api/workspace/download").is_ok());
    }

    #[test]
    fn rejects_remote_download_urls() {
        assert!(parse_local_backend_url("https://example.com/file.zip").is_err());
        assert!(parse_local_backend_url("http://192.168.1.20/file.zip").is_err());
    }

    #[test]
    fn rejects_non_http_download_urls() {
        assert!(parse_local_backend_url("file:///C:/tmp/backup.zip").is_err());
        assert!(parse_local_backend_url("mailto:support@example.com").is_err());
    }

    #[test]
    fn coding_directory_prefers_agent_json_project_dir() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let working_dir = temp.path();

        // Root config.json only contains the profile reference.
        std::fs::write(
            working_dir.join("config.json"),
            serde_json::json!({
                "agents": {
                    "active_agent": "test-agent",
                    "profiles": {
                        "test-agent": {
                            "id": "test-agent",
                            "workspace_dir": working_dir.join("workspaces/test-agent").to_str().unwrap(),
                            "enabled": true,
                        }
                    }
                }
            })
            .to_string(),
        )
        .unwrap();

        // Full agent config with a custom coding project dir.
        let workspace_dir = working_dir.join("workspaces/test-agent");
        std::fs::create_dir_all(&workspace_dir).unwrap();
        let project_dir = working_dir.join("custom-project");
        std::fs::create_dir_all(&project_dir).unwrap();
        std::fs::write(
            workspace_dir.join("agent.json"),
            serde_json::json!({
                "id": "test-agent",
                "workspace_dir": workspace_dir.to_str().unwrap(),
                "coding_mode": {
                    "enabled": true,
                    "project_dir": project_dir.to_str().unwrap(),
                }
            })
            .to_string(),
        )
        .unwrap();

        std::env::set_var("QWENPAW_WORKING_DIR", working_dir);
        let result = get_coding_directory(Some("test-agent")).unwrap();
        std::env::remove_var("QWENPAW_WORKING_DIR");

        assert_eq!(result, project_dir);
    }

    #[test]
    fn coding_directory_falls_back_to_workspace_dir() {
        let _guard = ENV_LOCK.lock().unwrap();
        let temp = tempfile::tempdir().unwrap();
        let working_dir = temp.path();

        std::fs::write(
            working_dir.join("config.json"),
            serde_json::json!({
                "agents": {
                    "active_agent": "test-agent",
                    "profiles": {
                        "test-agent": {
                            "id": "test-agent",
                            "workspace_dir": working_dir.join("workspaces/test-agent").to_str().unwrap(),
                            "enabled": true,
                        }
                    }
                }
            })
            .to_string(),
        )
        .unwrap();

        let workspace_dir = working_dir.join("workspaces/test-agent");
        std::fs::create_dir_all(&workspace_dir).unwrap();

        std::env::set_var("QWENPAW_WORKING_DIR", working_dir);
        let result = get_coding_directory(Some("test-agent")).unwrap();
        std::env::remove_var("QWENPAW_WORKING_DIR");

        assert_eq!(result, workspace_dir);
    }
}

// ---------------------------------------------------------------------------
// Local file reading for offline binary file preview
// ---------------------------------------------------------------------------

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7994** (2026-09-27): **[Bug]: 上下文显示状态信息不及时更新和不压缩**
  *Symptoms*: ## QwenPaw Version win10,desktop，2.2.3b bug1：上下文显示的那个圈，经常不随着对话切换更新，新建对话，还是显示旧对话的数据，必须退出程序，重新进才更新。 bug2：明明「上下文窗口 外圈 · 91.7K / 131.1K」，点击压缩，就只会说少于3个对话了，然后不压缩，我设置了上下文压缩阈值比例调到0.5，这91k明显超过了，也不给我压缩。
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  </div>  Hi @xiaohushi512,  This issue has been **automatically closed** because you currently have more than **10 open issues** in this repository.  > **Why this happened** > Our [contribution policy](https://github.com/agentscope-ai/QwenPaw/issues/4333) asks contributors to maintain a manageable number of active issues to ensure fair use of maintainer resources. A high volume of simultaneous open issues — especially those that are AI-generated and submitted without personal verification — places a significant burden on maintainers.  **What you can do:** 1. Review your open issues and close any that are no longer relevant, duplicated, or have not been personally verified. 2. Once you have fewer than 10 open issues, you are welcome to reopen this issue or file a new one. 3. Please ensure every issue you file has been **personally repr

- **Issue #7947** (2026-09-23): **[Bug]: send_file_to_user never renders its file card in the Console (artifact guard tests a JSON string, not a block array)**
  *Symptoms*: ### QwenPaw Version  v2.2.2-beta.3 (Windows desktop build; Console bundle `index-CZnxaxad.js`, artifact chunk `HostBubbles-BPBPozeU.js`)  ### Description  Files delivered with `send_file_to_user` get **no file card at all** in the Console — there is no visible or clickable entry point for the delivered file (the file name does not appear anywhere in the UI). The artifact-card machinery itself is fine: in the same conversation, `write_file` outputs render cards normally.  Root cause is a contract mismatch on one guard in the artifact collector (`console/src/features/files-workspace/ResponseArtifactList.tsx`): it requires the tool result's `output` to be a block **array**, but what the Console actually receives from `GET /api/chats/<chat_id>` is a **JSON string**. So the branch is never taken, and the entry is silently skipped with `continue` — no warning, nothing rendered.  **Security considerations:** none (read-only rendering path; no auth or config exposure).  ### Component(s) Affected  - [x] Console (frontend web UI) - [ ] Core / Backend (app, agents, config, providers, utils, local_models) - [ ] Channels, Skills, CLI, Documentation, Tests, CI/CD, Scripts / Deploy  ### Environment  - **QwenPaw version:** v2.2.2-beta.3 (Console shows `2.2.2b3`) - **OS:** Windows 10 (AMD64) - **Install method:** desktop app (Windows build) - **Channel:** `console` / agent `default`; backend on `127.0.0.1` only - **Upstream reference:** `agentscope-ai/QwenPaw` @ main — `ResponseArtifactList.t
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @makeryuan-MK, this is your 3rd issue.  We'll review your issue soon. Thank you for supporting QwenPaw!  
  > I'd like to take this. I'll reproduce the Console artifact behavior with the JSON-serialized `output` shape returned by chat history, then make the focused frontend fix and keep the missing-DataBlock control covered. I'll verify the relevant Console checks and reference the existing artifact behavior from #7750. 
  > **Reporter's correction — the original report overstated one point, and my follow-up hypothesis was wrong.**  Two corrections, since this report is now the reference for a merged fix (#7949):  **1. "no file card ... the delivered file name never appears in the UI" was too strong.**  The `send_file_to_user` tool card *does* render — it is built from the tool call's arguments, not from `output` — but it sits inside the default-collapsed "已完成 N 个步骤 / Completed N steps" group. On the same install I later captured a turn that delivered three documents: three file cards, all inside an expanded "Completed 16 steps" group, with nothing rendered outside it. So the accurate statement of the defect is narrower than what I wrote:  > A delivered file produces **no entry in the response artifact grid**, so its only entry point stays inside the collapsed step group and is invisible unless the user expands it.  Same root cause (`hasDeliveredFile` receiving a JSON string), correct impact description. T

- **Issue #7942** (2026-09-22): **Windows sandbox writes an inheritable ACL on workspace_dir — a drive-root workspace can strip permissions from the whole volume**
  *Symptoms*: ### Summary On Windows the first `execute_shell_command` builds the sandbox and writes ACLs on `config.workspace_dir`. Nothing rejects a drive root, so setting the workspace to `C:\` makes the entire volume the grant root.  ### Code (main @ 79f8e7d3) - `sandbox/windows_appcontainer_sandbox.py` `_apply_all_acls()` calls   `_set_path_ace(config.workspace_dir, psid, _ACL_FULL_ACCESS, _WC.SET_ACCESS)`. - `sandbox/windows_unelevated_sandbox.py` `_set_path_ace()` calls `SetNamedSecurityInfoW`   with `CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE`. Windows re-propagates inheritable ACEs   to every existing child: children first drop their INHERITED ACEs, then re-copy from the   current parent. A drive root has no parent, so the subtree copies whatever the root now holds. - The same function never checks `p_dacl == NULL`. With `SetEntriesInAclW(OldAcl=NULL)` the   result is a DACL containing only the sandbox ACE. - `windows_elevated_sandbox.py` cleanup falls back to `icacls <path> /reset`, which is fatal   when the path is a drive root.  ### Observed On an internal fork sharing this code, using a disposable `E:` whose root DACL had been pre-set to NULL, a single sandboxed `cmd /c echo hello` left `E:\` unusable: `icacls E:\` returned access denied even for an elevated Administrator, and Explorer refused to open the drive. The NULL root DACL was seeded on purpose, so this is not a clean-system repro.  ### Why it matters Windows 10 Pro 20H2 has public reports where editing a single ACE on
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @hxnan, this is your 2nd issue.  ### 📋 About Bug Report Template  We noticed your issue seems to be bug-related, but doesn't use the Bug Report template. To help us reproduce and fix the issue faster, please make sure your bug report includes:  - ✅ **QwenPaw Version** (use `qwenpaw --version`) - ✅ **Operating System** (macOS/Linux/Windows and version) - ✅ **Steps to Reproduce** (detailed steps) - ✅ **Actual vs Expected Behavior** - ✅ **Logs or Screenshots**  You can edit your issue to add this information. Missing information may require us to ask follow-up questions, which can delay the fix.  We'll review your issue soon. Thank you for supporting QwenPaw!  

- **Issue #7908** (2026-09-22): **[Bug] Windows: child Console Ctrl event from execute_shell_command can terminate the QwenPaw host**
  *Symptoms*: ## QwenPaw Version  v2.2.1  ## Description  On Windows, a child process launched through QwenPaw's `execute_shell_command` can emit a Console Ctrl event that propagates to the QwenPaw host process itself.  Instead of only failing the individual shell/tool call, the entire QwenPaw / Uvicorn server receives `KeyboardInterrupt` and shuts down.  In my real-world case, an Agent-generated Python process used:  ```python os.kill(pid, 0) ```  as a PID liveness probe.  This is itself an application-level bug on Windows, because `os.kill()` has special Console Control Event behavior there.  However, the QwenPaw robustness issue is that the resulting child-process Console Ctrl event is able to escape the `execute_shell_command` execution boundary and terminate the entire QwenPaw host.  I did not manually press `Ctrl+C` during any of the reproduced occurrences.  **Related PR(s):** N/A  **Security considerations:** No credential, authentication, or configuration exposure has been observed.  The main concern is availability and execution isolation: a faulty child process launched by `execute_shell_command` can terminate the whole QwenPaw host instead of only failing the current tool call.  ## Component(s) Affected  * [x] Core / Backend (app, agents, config, providers, utils, local_models) * [ ] Console (frontend web UI) * [ ] Channels (DingTalk, Feishu, QQ, Discord, iMessage, etc.) * [ ] Skills * [ ] CLI * [ ] Documentation (website) * [x] Tests * [ ] CI/CD * [ ] Scripts / Deploy  ## Envir
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## 欢迎来到 QwenPaw! 🐾 Welcome to QwenPaw!  </div>  你好 @PanXXHH，感谢你提交的第一个 issue！ Hi @PanXXHH, thank you for your first issue!  ### 📋 关于 Bug Report 模板 / About Bug Report Template  我们注意到你的 issue 似乎与 bug 相关，但没有使用 Bug Report 模板。为了帮助我们更快地定位和修复问题，请确保你的 bug report 包含以下信息： We noticed your issue seems to be bug-related, but doesn't use the Bug Report template. To help us reproduce and fix the issue faster, please make sure your bug report includes:  - ✅ **QwenPaw 版本 / Version** (使用 `qwenpaw --version` 查看) - ✅ **操作系统 / OS** (macOS/Linux/Windows 及版本) - ✅ **复现步骤 / Steps to Reproduce** (详细的步骤) - ✅ **实际结果 vs 预期结果 / Actual vs Expected** - ✅ **日志或截图 / Logs or Screenshots**  你可以编辑 issue 来补充这些信息。如果你的 issue 缺少这些信息，维护者可能需要额外时间来询问细节。 You can edit your issue to add this information. Missing information may require maintainers to ask follow-up questions.  我们

- **Issue #7907** (2026-09-21): **[Bug] Responses API 工具 schema 清洗移除 nullable，叠加隐式 strict 导致 recall_history 可选日期参数无法省略**
  *Symptoms*: ### 环境 QwenPaw `2.2.1`，AgentScope `2.0.7.post1`，OpenAI SDK `2.33.0`，Python `3.11.2`。使用 `OpenAIResponseModel`，经 codex2api 中转。  ### 问题 调用 `recall_history` 时，即使不需要日期筛选，模型仍填入：  ```json {"created_on":"","created_from":"","created_to":""} ```  导致检索前报错：  ```text ValueError: created_on cannot be combined with created_from/created_to ```  ### 源码定位 `openai_response_provider.py` 的 `_format_tools()` 调用通用 `_sanitize_tool_schemas()`，其中 `_sanitize_nullable_schemas()` 将可选字段：  ```json {"anyOf":[{"type":"string"},{"type":"null"}],"default":null} ```  转换为：  ```json {"type":"string","default":null} ```  这移除了合法的 `null` 类型，同时 Responses 工具未显式设置 `strict`。结合 Responses 默认尝试严格规范化的行为，可能造成可选字段被要求提供、却不能填 `null` 的冲突。  已在本地复现 nullable 被移除；严格规范化具体发生在中转还是上游，尚未确认。  ### 修复结果 在 Responses 格式化后的函数工具上默认设置 `strict: false`、保留显式配置后，问题消失。未修改 Chat Completions 链路。
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## 欢迎来到 QwenPaw! 🐾 Welcome to QwenPaw!  </div>  你好 @bertram-wei，感谢你提交的第一个 issue！ Hi @bertram-wei, thank you for your first issue!  ### 📋 关于 Bug Report 模板 / About Bug Report Template  我们注意到你的 issue 似乎与 bug 相关，但没有使用 Bug Report 模板。为了帮助我们更快地定位和修复问题，请确保你的 bug report 包含以下信息： We noticed your issue seems to be bug-related, but doesn't use the Bug Report template. To help us reproduce and fix the issue faster, please make sure your bug report includes:  - ✅ **QwenPaw 版本 / Version** (使用 `qwenpaw --version` 查看) - ✅ **操作系统 / OS** (macOS/Linux/Windows 及版本) - ✅ **复现步骤 / Steps to Reproduce** (详细的步骤) - ✅ **实际结果 vs 预期结果 / Actual vs Expected** - ✅ **日志或截图 / Logs or Screenshots**  你可以编辑 issue 来补充这些信息。如果你的 issue 缺少这些信息，维护者可能需要额外时间来询问细节。 You can edit your issue to add this information. Missing information may require maintainers to ask follow-up questi

- **Issue #7905** (2026-09-21): **[Bug]: DoomLoopGate escalates to TERMINATE on a text-only round without new tool-call evidence**
  *Symptoms*:  ## QwenPaw Version  Reported environment: `2.2.2b1`, commit `1d5021a4`. Source review and isolated reproduction target commit `1d5021a4`. As checked on 2026-09-20, `main`'s `src/qwenpaw/loop/gates/doom_loop.py` was byte-identical to that file at the pinned commit.  ## Description  `DoomLoopGate.check(ctx)` increments `consecutive_hits` whenever its retained history window matches, even if the current check recorded no new tool call. Consequently, after a warning at 3 hits, a text-only response with `has_tool_calls=False` can escalate to `TERMINATE` at 4 hits. This occurs even when the latest context message has also been replaced with the text-only response.  Expected: a previously evaluated window must not count as new repetition evidence. A new text-only round should not cause escalation of a tool-repetition detector.  A related sampling issue is that `_auto_record_from_ctx()` takes only the last tool call from the last context message. Its deduplication key is the iteration number, not the message/call identity. If iteration advances while the same message remains at the tail, the same call is appended again. The isolated reproduction demonstrates this condition, but does not establish that a concurrent tool batch alone causes these iteration/context transitions in the real scheduler.  **Related reports:** #5906 (closed report of false repetition detection); #7420 (open report involving re-dispatch/tool-result behavior). These are related symptoms, not established identic
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @mikew221, thank you for your first issue!  We'll review your issue soon. Thank you for supporting QwenPaw!  
  > ## Additional production evidence  I obtained the complete production session artifact and its matching log after filing this issue. They confirm that the reported false positive occurred on the real scheduler path, rather than only in the isolated gate-level reproduction.  ### Environment and artifacts  - QwenPaw: `2.2.2b1`, commit `1d5021a4` - Model: `kimi-k3` - Session: `~/.copaw/workspaces/default/sessions/console/<session-id>.json `  ### What the model was doing  The user asked how QwenPaw persists messages in SQLite and assembles messages for LLM calls. In one assistant message, the model issued 11 distinct `execute_shell_command` calls that progressively inspected different files and line ranges:  1. Listed `agents/context/scroll/` and searched for `conversation_history`. 2. Searched for `history.db` references. 3. Read `history.py` lines 1-140. 4. Read `history.py` lines 140-260. 5. Read `history.py` lines 260-470. 6. Read `history.py` lines 470-620. 7. Listed classes and funct
  > Thanks for your feedback, I will fix it.

- **Issue #7856** (2026-09-23): **[Bug]: qwenpaw-pet 0.1.1 breaks QwenPaw 2.2.2b2 tool approvals by dropping the `actor` argument**
  *Symptoms*: # [Bug]: qwenpaw-pet 0.1.1 breaks QwenPaw 2.2.2b2 tool approvals by dropping the `actor` argument  ## QwenPaw Version  - QwenPaw Desktop: `2.2.2-beta.2` - QwenPaw Backend: `QwenPaw, version 2.2.2b2` - Plugin: `qwenpaw-pet 0.1.1`  ## Description  When `qwenpaw-pet 0.1.1` is enabled with QwenPaw Desktop `2.2.2-beta.2`, every Console tool approval fails after the user clicks **Approve**.  The issue is caused by the plugin monkey-patching `ApprovalService.resolve_request`. The plugin wrapper does not accept the keyword-only `actor` argument required by the current QwenPaw approval API and does not forward it to the original method.  As a result, the approval endpoint returns HTTP 500 before the pending tool call can be resolved.  **Related PR(s):** N/A  **Security considerations:** No credential exposure was observed. The bug prevents users from completing protected tool actions and may lead users to disable approval safeguards as a workaround.  ## Component(s) Affected  - [x] Core / Backend (app, agents, config, providers, utils, local_models) - [ ] Console (frontend web UI) - [ ] Channels (DingTalk, Feishu, QQ, Discord, iMessage, etc.) - [x] Plugins - [ ] Skills - [ ] CLI - [ ] Documentation (website) - [ ] Tests - [ ] CI/CD - [ ] Scripts / Deploy  ## Environment  - **QwenPaw version:** Desktop `2.2.2-beta.2`; backend `2.2.2b2` - **Plugin version:** `qwenpaw-pet 0.1.1` - **OS:** Windows 10 AMD64 - **Install method:** QwenPaw Desktop plus installed `qwenpaw-pet` plugin - **Pytho
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## Welcome to QwenPaw! 🐾  </div>  Hi @samluoabc, this is your 5th issue.  We'll review your issue soon. Thank you for supporting QwenPaw!  
  > Thanks for your feedback! We will fix it asap
  > > Qwenpaw-pet 0.1.1 breaking QwenPaw tool approvals by dropping the actor argument opens an authority gap before tool effects. Approvals without actor binding cannot attribute or enforce correctly. Are you restoring the actor field on approval payloads and failing closed when it is missing?  fixed in PR：https://github.com/agentscope-ai/QwenPaw/pull/7933

- **Issue #7799** (2026-09-16): **[Bug]: v2.2.1 Console 仍不显示 Agent 用 send_file_to_user 发送的图片（流式期间短暂可见后消失，疑似 #5320 复发）**
  *Symptoms*: ## QwenPaw Version  `2.2.1`（Windows 桌面版：`D:\Programs\QwenPaw\qwenpaw-desktop.exe` 的 FileVersion / ProductVersion 均为 2.2.1）  ## Description  Agent 调用内置工具 `send_file_to_user` 发送图片给用户时，Console **只在流式输出期间短暂显示该图片**；本轮回答结束后（以及刷新页面、切换会话再切回），**图片消失**，位置上只剩一段文件路径文本。  **期望**：`send_file_to_user` 发出的图片应当像用户上传的图片一样，在**对话历史中稳定渲染**（或至少给出可点击的预览/下载入口），刷新后依然存在。  **实际**：渲染后的对话 DOM 中完全没有对应的 `<img>` 元素，也没有下载链接，只剩路径文本。  用户原话（2.2.1 实测）："思考过程中看到图片了，然后没了"、"过程完了以后就变成路径了"；此前版本"直接贴图，或者我也可以点击查看"都正常。  **后端没有丢数据**：会话 JSON 中 `tool_result.output` 保存的是完整的 base64 图片块（见证据 1），问题出在前端没有渲染这个块。  **Related PR(s):** 无  **Security considerations:** 无（本 issue 仅为前端渲染问题）。若修复方案拟新增"工作区文件 http 读取端点"，请务必带鉴权 + 目录白名单，避免任意绝对路径读取。  ## Component(s) Affected  - [ ] Core / Backend (app, agents, config, providers, utils, local_models) - [x] Console (frontend web UI) - [ ] Channels (DingTalk, Feishu, QQ, Discord, iMessage, etc.) - [ ] Skills - [ ] CLI - [ ] Documentation (website) - [ ] Tests - [ ] CI/CD - [ ] Scripts / Deploy  ## Environment  - **QwenPaw version:** 2.2.1 - **OS:** Windows 10 (AMD64) - **Install method:** Desktop installer（NSIS 安装到 `D:\Programs\QwenPaw`，内置打包后端） - **Python version (if applicable):** 内置运行时（打包版）  ## Steps to Reproduce  1. 启动 QwenPaw Desktop 2.2.1，打开 Console 通道的任意会话 2. 让 Agent 调用 `send_file_to_user`，参数为本地图片绝对路径，例如 `{"file_path": "C:\\Users\\<user>\\.qwenpaw\\workspaces\\default\\knowledge\\fanglei_icons\\总览_防雷接地图标.png"}` 3. 观察：流式阶段图片可见；本轮回答结束后图片消失，只剩路径文本 4. 刷新页面（F5）或切换到别的会话再切回 —— 图片依旧不显示  ## Actual vs Exp
  **Post-Mortem & Fix Analysis**:
  > <div align="center">  <img src="https://img.alicdn.com/imgextra/i2/O1CN01eSmIfy1hJImze8NN8_!!6000000004256-2-tps-1858-1858.png" width="80" height="80" />  ## 欢迎来到 QwenPaw! 🐾 Welcome to QwenPaw!  </div>  你好 @makeryuan-MK，感谢你提交的第一个 issue！ Hi @makeryuan-MK, thank you for your first issue!  我们会尽快查看你的 issue。感谢你对 QwenPaw 的支持！ We'll review your issue soon. Thank you for supporting QwenPaw!  ---  > **🌍 关于国际化 / About Internationalization** >  > QwenPaw 是一个国际化的开源社区。我们建议使用英文提交 issue，这样可以让更多的开发者参与讨论和贡献。 >  > QwenPaw is an international open-source community. We recommend using English for issues so that more developers worldwide can participate in discussions and contributions.  > [!TIP] > **⭐ 如果你觉得 QwenPaw 有帮助，请给我们一个 Star！** >  > **⭐ If you find QwenPaw useful, please give us a Star!** >  > <div align="center"> >  > <a href="https://github.com/agentscope-ai/QwenPaw"><img src="https://img.alicdn.com/imgextra/i1/O1CN01V8HYv61By0HYcIDaq_!!6000000000013-1-tps-1698-954.gif" alt="Star QwenPaw" width=
  > **English summary** (added per the repo's recommendation to file issues in English — the original report above is in Chinese).  **Environment:** QwenPaw Desktop **2.2.1**, Windows 10 (AMD64), NSIS install under `D:\Programs\QwenPaw` (bundled backend runtime), Console channel. Front-end origin: `http://127.0.0.1:35373`.  ### Symptom When the agent calls the built-in tool `send_file_to_user` with a local image, the Console renders the image **only while the response is streaming**. Once the turn ends — and again after F5 or after switching to another session and back — the image is gone and only a plain file-path text remains in the history. The rendered conversation DOM contains **no** `<img>` for it and no download link.  Expected: an image sent with `send_file_to_user` should render in the conversation history as stably as a user-uploaded image (or at least expose a clickable preview/download), and survive a refresh.  ### It is not a backend data-loss problem The session JSON keeps th
  > **Correction / follow-up after re-testing** (same machine, same 2.2.1 install). I have to withdraw the root cause I proposed above — re-testing shows the Console *does* render these images, and the "disappearing" is a presentation issue, not a missing render branch.  ### 1. Images from `tool_result` DO render — verified on screen  Two purpose-made probe images were sent through both tools (large text baked into the PNG, so the *pixel content* can be detected with OCR on a screenshot of the client window):  | tool | tool card in the client | probe text found on screen | | --- | --- | --- | | `view_image` | `查看图片 probe_big_text.png` | ✅ OCR finds `PROBE2` rendered under the card | | `send_file_to_user` | `发送 probe_send_big.png` | ✅ OCR finds `SENDF3` rendered under the card |  At the same moment the backend access log shows the Console resolving and fetching the file:  ``` INFO: 127.0.0.1:27789 - "GET /api/files/preview/C%3A/...%2Fprobe_big_text.png HTTP/1.1" 200 OK ```  So the front end

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

### Incident Patch 1: `80e412da` (2026-09-30)
**Commit Message**: fix(e2e): stop stalled session cleanup (#8041)

**File**: `e2e/pages/chat_page.py` (modified, +41/-25)
```diff
@@ -38,8 +38,14 @@ class ChatPage(BasePage):
     # ========== Selector definitions ==========
     # Page components use the qwenpaw- CSS prefix
 
-    # Navigation and new chat (compatible with both spark-icon and anticon icon sets)
-    NEW_CHAT_BTN = 'button:has(.spark-icon-spark-newChat-fill), button:has(.anticon-plus), button:has([class*="newChat"])'
+    # Sidebar.tsx exposes the current action through its translated accessible
+    # name. ``:visible`` excludes the duplicate compact/expanded surface.
+    NEW_CHAT_BTN = (
+        'button[aria-label="New task"]:visible, '
+        'button[aria-label="新建任务"]:visible, '
+        'button:has-text("New task"):visible, '
+        'button:has-text("新建任务"):visible'
+    )
     # Conversation-history disclosure button in the sidebar.
     #
     # The previous value ended with a very broad ``button:has([class*="history"])``
@@ -125,25 +131,25 @@ class ChatPage(BasePage):
         '[class*="sessionItem-module__name"], '
         '[class*=chatSessionItem] [class*=name]'
     )
-    # SessionItem actions now live behind a "more" button (SparkMoreLine)
-    # that opens an antd Dropdown menu (Pin / Rename / Archive / Delete).
+    # SessionItem actions live behind a "more" button. The current console
+    # renders a custom Popover menu with role-based action buttons.
     SESSION_MORE_BTN = '[class*=moreBtn]'
     # ``:text-is`` is exact so "Pin" does not also match "Unpin".
     SESSION_MENU_PIN = (
-        '.qwenpaw-dropdown-menu-item:has-text("Pin"), '
-        '.qwenpaw-dropdown-menu-item:has-text("置顶")'
+        'div[role="menu"] button[role="menuitem"]:text-is("Pin"), '
+        'div[role="menu"] button[role="menuitem"]:text-is("置顶")'
     )
     SESSION_MENU_UNPIN = (
-        '.qwenpaw-dropdown-menu-item:has-text("Unpin"), '
-        '.qwenpaw-dropdown-menu-item:has-text("取消置顶")'
+        'div[role="menu"] button[role="menuitem"]:text-is("Unpin"), '
+        'div[role="menu"] button[role="menuitem"]:text-is("取消置顶")'
     )
     SESSION_MENU_RENAME = (
-        '.qwenpaw-dropdown-menu-item:has-text("Rename"), '
-        '.qwenpaw-dropdown-menu-item:has-text("重命名")'
+        'div[role="menu"] button[role="menuitem"]:has-text("Rename"), '
+        'div[role="menu"] button[role="menuitem"]:has-text("重命名")'
     )
     SESSION_MENU_DELETE = (
-        '.qwenpaw-dropdown-menu-item:has-text("Delete"), '
-        '.qwenpaw-dropdown-menu-item:has-text("删除")'
+        'div[role="menu"] button[role="menuitem"]:has-text("Delete"), '
+        'div[role="menu"] button[role="menuitem"]:has-text("删除")'
     )
     # Inline rename input rendered when a SessionItem enters edit mode.
     SESSION_RENAME_INPUT = 'input[class*=renameInput]'
@@ -357,12 +363,20 @@ def create_new_chat(self) -> "ChatPage":
             del self._has_sent_message
         self._ai_count_before_send = 0
         
-        new_chat_btn = self.find(self.NEW_CHAT_BTN)
-        if new_chat_btn.count() > 0:
-            new_chat_btn.click()
-            # Wait for page navigation and full load
-            self.page.wait_for_load_state("networkidle")
-            self.page.locator(self.CHAT_INPUT).wait_for(state="visible", timeout=10000)
+        new_chat_btn = self.find(self.NEW_CHAT_BTN).first
+        expect(new_chat_btn).to_be_visible(timeout=self.timeout)
+        new_chat_btn.click()
+        # The chat page keeps an SSE connection open, so ``networkidle`` is
+        # not a useful completion signal. The new-task event is complete once
+        # the previous transcript is gone and the composer is interactive.
+        expect(self.page.locator(self.MESSAGE_CONTAINER)).to_have_count(
+            0,
+            timeout=self.timeout,
+        )
+        self.page.locator(self.CHAT_INPUT).first.wait_for(
+            state="visible",
+            timeout=self.timeout,
+        )
         self.step_shot("create_new_chat_done")
         return self
     
@@ -1074,12 +1088,7 @@ def _open_session_menu(self, index: int
```

**File**: `e2e/pages/inbox_page.py` (modified, +9/-38)
```diff
@@ -66,44 +66,15 @@ class InboxPage(BasePage):
     MESSAGE_CARD = '[class*="messageCard"]'
     UNREAD_DOT_IN_CARD = '[class*="unreadDot"]'
 
-    # Sidebar unread dot.
-    #
-    # The value this replaces anchored on an antd Badge:
-    #   li.qwenpaw-menu-item:has(span.qwenpaw-menu-title-content:has-text("Inbox")) .qwenpaw-badge-dot
-    # Upstream #7502 dropped antd's ``Badge`` from the sidebar completely (a
-    # case-sensitive search for ``Badge`` in ``layouts/Sidebar.tsx`` now returns
-    # nothing), and the menu entries are no longer ``li.qwenpaw-menu-item`` —
-    # they are plain ``<button>`` elements. Every part of the old selector is
-    # therefore gone at once.
-    #
-    # In the expanded sidebar the dot is now
-    #   <button class="...inboxItem...">
-    #     <span class="...inboxIcon">
-    #       <span class="...inboxUnreadDot" style="background: ..." />
-    #     </span>
-    #     <span>Inbox</span>
-    #   </button>
-    # Both ``inboxItem`` and ``inboxUnreadDot`` are defined once, in
-    # ``layouts/index.module.less``, so with the build's
-    # ``generateScopedName: "[name]__[local]__[hash:base64:5]"`` they render as
-    # ``index-module__inboxItem__<hash>`` / ``index-module__inboxUnreadDot__<hash>``.
-    # The dot's own scoped class is the anchor. It is deliberately *not* combined
-    # with an ancestor or label variant: ``inboxUnreadDot`` is already the
-    # broadest form, so any narrower alternative in the same comma-separated
-    # union could never add a match — a dead branch, and exactly the rot that
-    # made the old ``chatSessionItem`` fallback useless for years without anyone
-    # noticing. If upstream renames the class the right fix is to update this
-    # line, not to stack unreachable fallbacks.
-    #
-    # ⚠️ Known coverage gap, stated rather than papered over: in the *collapsed*
-    # sidebar the dot is a plain ``<span>`` with only inline styles
-    # (``decorateInboxIcon`` in ``Sidebar.tsx``) and no class name at all, so
-    # there is no stable handle for it. The collapsed form cannot be anchored
-    # without upstream adding a class or data attribute. E2E runs at a 1920-wide
-    # viewport (``config.browser.viewport_width``), which is outside the
-    # ``MOBILE_SIDEBAR_QUERY`` breakpoint, so the sidebar is expanded and the
-    # expanded anchor below is the one that applies here.
-    SIDEBAR_INBOX_BADGE = '[class*="inboxUnreadDot"]'
+    # NotificationBell renders the same badge inside both compact and expanded
+    # Inbox navigation buttons. Scope it to the translated accessible name so
+    # unrelated notification counters cannot satisfy the assertion.
+    SIDEBAR_INBOX_BADGE = (
+        'button[aria-label="Inbox"] '
+        '[class*="NotificationBell-module__badge"], '
+        'button[aria-label="收件箱"] '
+        '[class*="NotificationBell-module__badge"]'
+    )
 
     # Detail modal
     DETAIL_MODAL = '.qwenpaw-modal'
```

**File**: `e2e/pages/memory_page.py` (modified, +74/-31)
```diff
@@ -17,9 +17,10 @@
 from __future__ import annotations
 
 import logging
+import time
 from typing import Optional
 
-from playwright.sync_api import Page, expect, TimeoutError
+from playwright.sync_api import Page, TimeoutError
 
 from pages.base_page import BasePage
 from config.settings import config
@@ -36,45 +37,69 @@ class MemoryPage(BasePage):
 
     # ========== Selectors ==========
 
-    # Long-term Memory tab on /agent-config
+    # Memory group tab rendered by RuntimeWorkbench on /agent-config.
     MEMORY_TAB = (
-        '.qwenpaw-tabs-tab:has-text("Long-term Memory"), '
-        '.qwenpaw-tabs-tab:has-text("长期记忆")'
+        '[role="tab"]:has-text("Memory"), '
+        '[role="tab"]:has-text("记忆与检索")'
+    )
+    MEMORY_CARD_HEADING = (
+        'h3:has-text("Long-term memory hub"), '
+        'h3:has-text("长期记忆中心")'
     )
-    # Switches and inputs use stable form-item names (Form.Item name=[...]).
-    # The dream_cron input is unique to this card and serves as a
-    # reliable "card content rendered" signal.
     DREAM_CRON_INPUT = (
-        'input[id$="reme_light_memory_config_dream_cron"]'
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("Dream Schedule") '
+        'input[aria-label="Cron expression"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("梦境定时") input[aria-label="Cron 表达式"]'
     )
-    # --- Long-term Memory card fields (ReMeLightMemoryCard.tsx) ---
     AUTO_MEMORY_INTERVAL_INPUT = (
-        'input[id$="reme_light_memory_config_auto_memory_interval"]'
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("Auto-memory")) input[role="spinbutton"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("自动记忆")) input[role="spinbutton"]'
+    )
+    AUTO_MEMORY_ENABLED_SWITCH = (
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("Auto-memory")) '
+        'button[role="switch"][aria-label="Enable conversation memory"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has(h3:has-text("自动记忆")) '
+        'button[role="switch"][aria-label="启用对话记忆"]'
     )
     DREAM_CRON_ENABLED_SWITCH = (
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("Dream Schedule") '
         'button[role="switch"]'
-        '[id$="reme_light_memory_config_dream_cron_enabled"]'
+        '[aria-label="Enable scheduled organization"], '
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("梦境定时") '
+        'button[role="switch"][aria-label="启用梦境整理"]'
     )
-    # Auto Memory Search collapse (forceRender: children always in DOM,
-    # visible only once the panel is expanded).
-    AUTO_SEARCH_COLLAPSE_HEADER = (
-        '.qwenpaw-collapse-header:has-text("Auto Memory Search"), '
-        '.qwenpaw-collapse-header:has-text("自动记忆搜索")'
+    DREAM_ADVANCED_OPTION = (
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("Dream Schedule") label:has-text("Advanced"), '
+        'section[class*="memoryConfigPanel"]:'
+        'has-text("梦境定时") label:has-text("高级")'
     )
     AUTO_SEARCH_SWITCH = (
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("Memory search")) '
+        'div[class*="memoryToggleRow"]:'
+        'has(strong:has-text("Enable automatic memory search")) '
+        'button[role="switch"], '
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("记忆搜索")) '
+        'div[class*="memoryToggleRow"]:'
+        'has(strong:has-text("启用自动记忆搜索")) '
         'button[role="switch"]'
-        '[id$="auto_memory_search_config_enabled"]'
     )
     AUTO_SEARCH_MAX_RESULTS_INPUT = (
-        'input[id$="auto_memory_search_config_max_results"]'
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("Memory search")) input[role="spinbutton"], '
+        'section[class*="memoryRecallPanel"]:'
+        'has(h3:has-text("记忆搜索")) input[role="spinbutton"]'
     )
-    # --- Save footer + toast ---
-    SAVE_BTN
```

**File**: `e2e/pages/skill_pool_page.py` (modified, +31/-21)
```diff
@@ -18,7 +18,7 @@
 import logging
 from typing import List, Optional
 
-from playwright.sync_api import Page, Locator
+from playwright.sync_api import Page, Locator, TimeoutError
 
 from pages.base_page import BasePage
 from config.settings import config
@@ -36,39 +36,45 @@ class SkillPoolPage(BasePage):
     # Page + card grid (SkillPool/index.module.less, PoolSkillCard.tsx)
     PAGE_CONTAINER = '[class*="skillsPage"]'
     SKILL_GRID = '[class*="skillsGrid"]'
-    SKILL_CARD = '[class*="skillCard"]'
-    SKILL_TITLE = '[class*="skillTitle"]'
-    # Sync status badge (rendered for every card) + its colored dot.
+    SKILL_CARD = '[class*="PoolSkillCard-module__card"]'
+    SKILL_TITLE = '[class*="PoolSkillCard-module__title"]'
+    SEARCH_INPUT = (
+        'input[aria-label="Filter by name"], '
+        'input[aria-label="按名称筛选"]'
+    )
+    # Sync status badge rendered for every card.
     STATUS_BADGE = '[class*="statusBadge"]'
-    STATUS_DOT = '[class*="statusDot"]'
-    # Automation chip in the title row (Auto Sync, Auto Update, or both).
-    AUTOMATION_TAG = '[class*="automationTag"]'
+    AUTOMATION_TAG = (
+        'button[data-testid^="skill-automation-"][aria-pressed="true"]'
+    )
     BUILTIN_TAG = '[class*="builtinTag"]'
     CUSTOM_TAG = '[class*="customTag"]'
     # Card footer is only mounted on hover / batch / mobile; the single
     # automation quick action (SyncOutlined) lives inside it.
-    CARD_FOOTER = '[class*="cardFooter"]'
-    AUTOMATION_BUTTON = '[class*="automationButton"]'
-
-    # Edit drawer (PoolSkillDrawer.tsx)
-    DRAWER = '.qwenpaw-drawer'
-    DRAWER_TITLE = '.qwenpaw-drawer-title'
-    AUTO_SYNC_SWITCH = '.qwenpaw-drawer [data-testid="auto-sync-switch"]'
+    CARD_FOOTER = '[class*="PoolSkillCard-module__footer"]'
+    AUTOMATION_BUTTON = 'button[data-testid^="skill-automation-"]'
+
+    # PoolSkillDrawer uses SettingsDrawer, which renders a SharedModal on
+    # desktop. Anchor the editor on its edit-only Auto Sync control so other
+    # dialogs cannot satisfy these selectors.
+    DRAWER = '[role="dialog"]:has([data-testid="auto-sync-switch"])'
+    DRAWER_TITLE = f'{DRAWER} .qwenpaw-modal-title'
+    AUTO_SYNC_SWITCH = f'{DRAWER} [data-testid="auto-sync-switch"]'
     # Target-agent multi-select is rendered ONLY after the switch is ON; anchor
     # on its placeholder text (unique) so we don't match other selects.
     TARGET_SELECT_PLACEHOLDER = (
-        '.qwenpaw-drawer [class*="select-selection-placeholder"]'
+        f'{DRAWER} [class*="select-selection-placeholder"]'
         ':has-text("All agents that have this skill"), '
-        '.qwenpaw-drawer [class*="select-selection-placeholder"]'
+        f'{DRAWER} [class*="select-selection-placeholder"]'
         ':has-text("所有已安装该技能的智能体")'
     )
     SAVE_BTN = (
-        '.qwenpaw-drawer button:has-text("Save"), '
-        '.qwenpaw-drawer button:has-text("保存")'
+        f'{DRAWER} .qwenpaw-modal-footer button.qwenpaw-btn-primary'
     )
     CANCEL_BTN = (
-        '.qwenpaw-drawer button:has-text("Cancel"), '
-        '.qwenpaw-drawer button:has-text("取消")'
+        f'{DRAWER} button:has-text("Cancel"), '
+        f'{DRAWER} button:has-text("取消"), '
+        f'{DRAWER} button:has-text("取 消")'
     )
 
     # ========== Initialization ==========
@@ -103,7 +109,11 @@ def find_card_by_name(self, name: str) -> Optional[Locator]:
         card = self.page.locator(
             f'{self.SKILL_CARD}:has-text("{name}")'
         ).first
-        return card if card.count() > 0 else None
+        try:
+            card.wait_for(state="visible", timeout=self.timeout)
+        except TimeoutError:
+            return None
+        return card
 
     def hover_card(self, card: Locator) -> "SkillPoolPage":
         """Hover a card so its footer automation action is mounted."""
```

**File**: `e2e/pages/skills_page.py` (modified, +4/-1)
```diff
@@ -44,7 +44,10 @@ class SkillsPage(BasePage):
     SWITCH_SELECTOR = '.qwenpaw-switch'
 
     # Search input
-    SEARCH_INPUT = 'input[placeholder*="搜索"], input[placeholder*="Search"], .ant-input-search input, .qwenpaw-input-search input'
+    SEARCH_INPUT = (
+        'input[aria-label="Search skills across platforms"], '
+        'input[aria-label="在多平台中搜索技能"]'
+    )
 
     # ========== Navigation methods ==========
 
```

---

### Incident Patch 2: `b944e1d5` (2026-09-30)
**Commit Message**: fix(ci): change permission (#8043)

**File**: `.github/workflows/pr-size.yml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ on:
     types: [opened, synchronize, reopened, edited]
 
 permissions:
-  pull-requests: read
+  pull-requests: write
   issues: write
 
 # Serialize updates for each PR. Each run reads the latest diff statistics.
```

---

### Incident Patch 3: `3ef7d377` (2026-09-30)
**Commit Message**: fix(hub): close database connections after transactions (#8038)

**File**: `src/qwenpaw/hub/database.py` (modified, +32/-6)
```diff
@@ -8,26 +8,52 @@
 import sqlite3
 from datetime import datetime, timezone
 from pathlib import Path
-from typing import Any
+from types import TracebackType
+from typing import Any, Literal
 
 from .config_migration import migrate_hub_settings
 
 _SCHEMA_GENERATION = "hub-v1"
 _JSON_DEFAULT = '{"schema_version":1}'
 
 
+class _HubConnection(sqlite3.Connection):
+    """Close the database handle after committing or rolling back."""
+
+    def __exit__(
+        self,
+        exc_type: type[BaseException] | None,
+        exc_value: BaseException | None,
+        traceback: TracebackType | None,
+    ) -> Literal[False]:
+        try:
+            return super().__exit__(exc_type, exc_value, traceback)
+        finally:
+            self.close()
+
+
 def utc_now() -> str:
     """Return one sortable UTC timestamp."""
     return datetime.now(timezone.utc).isoformat()
 
 
 def connect_hub_database(database_path: Path) -> sqlite3.Connection:
     """Open a consistently configured Hub database connection."""
-    connection = sqlite3.connect(database_path, timeout=5)
-    connection.row_factory = sqlite3.Row
-    connection.execute("PRAGMA foreign_keys = ON")
-    connection.execute("PRAGMA busy_timeout = 5000")
-    return connection
+    connection = sqlite3.connect(
+        database_path,
+        timeout=5,
+        factory=_HubConnection,
+    )
+    configured = False
+    try:
+        connection.row_factory = sqlite3.Row
+        connection.execute("PRAGMA foreign_keys = ON")
+        connection.execute("PRAGMA busy_timeout = 5000")
+        configured = True
+        return connection
+    finally:
+        if not configured:
+            connection.close()
 
 
 def initialize_hub_database(database_path: Path) -> None:
```

**File**: `tests/unit/hub/test_control_app.py` (modified, +19/-15)
```diff
@@ -3,6 +3,7 @@
 
 from collections.abc import AsyncIterator, Iterator, Mapping
 import asyncio
+from contextlib import closing
 from dataclasses import replace
 from datetime import datetime, timedelta, timezone
 import gzip
@@ -1538,11 +1539,12 @@ def test_deleted_runtime_owner_returns_no_username(tmp_path: Path) -> None:
             json={"runtime_id": "orphaned-runtime"},
             headers=_headers(member_token),
         )
-        with sqlite3.connect(auth.database_path) as connection:
-            connection.execute(
-                "UPDATE hub_users SET deleted_at = ? WHERE user_id = ?",
-                ("2026-01-01T00:00:00Z", member.user_id),
-            )
+        with closing(sqlite3.connect(auth.database_path)) as connection:
+            with connection:
+                connection.execute(
+                    "UPDATE hub_users SET deleted_at = ? WHERE user_id = ?",
+                    ("2026-01-01T00:00:00Z", member.user_id),
+                )
         runtimes = client.get(
             "/api/hub/runtimes?q=orphaned-runtime",
             headers=_headers(admin_token),
@@ -1695,11 +1697,12 @@ def test_invitation_failures_map_to_distinct_statuses(
     with _client(tmp_path, hub_config=config) as client:
         admin_token = _register(client, "owner")
         database = tmp_path / "control.db"
-        with sqlite3.connect(database) as connection:
-            connection.execute(
-                "UPDATE hub_settings SET value_json = ? WHERE key = ?",
-                ('"invite"', "registration_mode"),
-            )
+        with closing(sqlite3.connect(database)) as connection:
+            with connection:
+                connection.execute(
+                    "UPDATE hub_settings SET value_json = ? WHERE key = ?",
+                    ('"invite"', "registration_mode"),
+                )
         invitations = InvitationService(
             GovernanceStore(database),
             client.app.state.auth_service,
@@ -1752,11 +1755,12 @@ def attempt(username: str, code: str):
 
         expired_batch = issue()
         past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
-        with sqlite3.connect(database) as connection:
-            connection.execute(
-                "UPDATE hub_invites SET expires_at = ? WHERE id = ?",
-                (past, expired_batch["codes"][0]["id"]),
-            )
+        with closing(sqlite3.connect(database)) as connection:
+            with connection:
+                connection.execute(
+                    "UPDATE hub_invites SET expires_at = ? WHERE id = ?",
+                    (past, expired_batch["codes"][0]["id"]),
+                )
         expired = attempt(
             "u-expired",
             expired_batch["codes"][0]["code"],
```

**File**: `tests/unit/hub/test_database.py` (modified, +58/-0)
```diff
@@ -2,12 +2,16 @@
 """Tests for the stable QwenPaw Hub database shape."""
 
 import sqlite3
+from contextlib import closing
 from pathlib import Path
+from unittest.mock import MagicMock
 
 import pytest
 
+from qwenpaw.hub import database as database_module
 from qwenpaw.hub.database import (
     HubExtensionStore,
+    connect_hub_database,
     initialize_hub_database,
 )
 from qwenpaw.hub.registry import RuntimeRegistry
@@ -20,6 +24,60 @@ def _columns(database: Path, table: str) -> set[str]:
     return {str(row[1]) for row in rows}
 
 
+def _assert_closed(connection: sqlite3.Connection) -> None:
+    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
+        connection.execute("SELECT 1")
+
+
+def test_connection_context_commits_and_closes(tmp_path: Path) -> None:
+    database = tmp_path / "control.db"
+    connection = connect_hub_database(database)
+
+    with connection:
+        connection.execute("CREATE TABLE example(value TEXT)")
+        connection.execute("INSERT INTO example VALUES ('committed')")
+
+    _assert_closed(connection)
+    with closing(sqlite3.connect(database)) as probe:
+        rows = probe.execute("SELECT value FROM example").fetchall()
+    assert rows == [("committed",)]
+
+
+def test_connection_context_rolls_back_and_closes(tmp_path: Path) -> None:
+    database = tmp_path / "control.db"
+    with connect_hub_database(database) as setup:
+        setup.execute("CREATE TABLE example(value TEXT)")
+    connection = connect_hub_database(database)
+
+    with pytest.raises(RuntimeError, match="rollback"):
+        with connection:
+            connection.execute("INSERT INTO example VALUES ('discarded')")
+            raise RuntimeError("rollback")
+
+    _assert_closed(connection)
+    with closing(sqlite3.connect(database)) as probe:
+        rows = probe.execute("SELECT value FROM example").fetchall()
+    assert rows == []
+
+
+def test_connection_closes_when_configuration_fails(
+    tmp_path: Path,
+    monkeypatch,
+) -> None:
+    connection = MagicMock()
+    connection.execute.side_effect = sqlite3.OperationalError("pragma failed")
+    monkeypatch.setattr(
+        database_module.sqlite3,
+        "connect",
+        MagicMock(return_value=connection),
+    )
+
+    with pytest.raises(sqlite3.OperationalError, match="pragma failed"):
+        connect_hub_database(tmp_path / "control.db")
+
+    connection.close.assert_called_once_with()
+
+
 def test_runtime_schema_uses_versioned_documents_for_variable_data(
     tmp_path: Path,
 ) -> None:
```

---

### Incident Patch 4: `99b2711d` (2026-09-30)
**Commit Message**: fix(ci): correct first-time PR detection and add automatic size labels (#8039)

**File**: `.github/workflows/first-time-contributor-welcome.yml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
             const body = [
               `## Welcome to QwenPaw! :tada:`,
               ``,
-              `Thank you @${author} for your first contribution! Your PR has been merged. :rocket:`,
+              `Thank you @${author}! Your first pull request has been merged. :rocket:`,
               ``,
               `We'd love to give you a shout-out in our release notes! If you're comfortable sharing, ` +
               `please reply to this comment with your social media handles using the format below:`,
```

**File**: `.github/workflows/pr-size.yml` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+name: PR Size Label
+
+on:
+  pull_request_target:
+    types: [opened, synchronize, reopened, edited]
+
+permissions:
+  pull-requests: read
+  issues: write
+
+# Serialize updates for each PR. Each run reads the latest diff statistics.
+concurrency:
+  group: pr-size-${{ github.event.pull_request.number }}
+  cancel-in-progress: false
+
+jobs:
+  label:
+    # An edited event only changes the diff when the base branch changes.
+    if: >-
+      github.event.action != 'edited' ||
+      github.event.changes.base.ref != null
+    runs-on: ubuntu-latest
+    steps:
+      # This privileged workflow only reads API metadata; never run PR code.
+      - name: Update size label
+        uses: actions/github-script@v7
+        with:
+          script: |
+            const { owner, repo } = context.repo;
+            const issue_number = context.payload.pull_request.number;
+            const { data: pr } = await github.rest.pulls.get({
+              owner,
+              repo,
+              pull_number: issue_number,
+            });
+
+            if (pr.state !== 'open') {
+              core.info(`PR #${issue_number} is no longer open; skipping`);
+              return;
+            }
+
+            // Use the entire diff, including docs, generated files and lockfiles.
+            // A replaced line counts as one deletion plus one addition.
+            // Binary-only changes and pure renames may have zero changed lines.
+            if (!Number.isSafeInteger(pr.additions) || pr.additions < 0 ||
+                !Number.isSafeInteger(pr.deletions) || pr.deletions < 0) {
+              throw new Error('PR diff statistics are unavailable; keeping existing labels');
+            }
+            const changedLines = pr.additions + pr.deletions;
+            const sizes = [
+              { name: 'size/XS', max: 49, color: '3CBF00', range: '0-49' },
+              { name: 'size/S', max: 199, color: '5D9801', range: '50-199' },
+              { name: 'size/M', max: 499, color: '7F7203', range: '200-499' },
+              { name: 'size/L', max: 999, color: 'A14C05', range: '500-999' },
+              { name: 'size/XL', max: 1999, color: 'C32607', range: '1000-1999' },
+              { name: 'size/XXL', max: 3999, color: 'E50009', range: '2000-3999' },
+              { name: 'size/XXXL', max: Infinity, color: 'B60205', range: '4000+' },
+            ];
+            const target = sizes.find(size => changedLines <= size.max);
+
+            // Create each size label on first use. Another PR may create it
+            // concurrently, so verify existence after a creation conflict.
+            try {
+              await github.rest.issues.getLabel({ owner, repo, name: target.name });
+            } catch (error) {
+              if (error.status !== 404) throw error;
+              try {
+                await github.rest.issues.createLabel({
+                  owner,
+                  repo,
+                  name: target.name,
+                  color: target.color,
+                  description: `${target.range} changed lines (additions + deletions)`,
+                });
+              } catch (createError) {
+                if (createError.status !== 422) throw createError;
+                await github.rest.issues.getLabel({ owner, repo, name: target.name });
+              }
+            }
+
+            const labels = await github.paginate(github.rest.issues.listLabelsOnIssue, {
+              owner, repo, issue_number, per_page: 100,
+            });
+            const managedNames = new Set(sizes.map(size => size.name));
+
+            // Add first so an API failure never leaves the PR without a size.
+            // Only mutate our seven size labels, preserving all other labels.
+            if (!labels.some(label => label.name === target.name)) {
+              await github.rest.issues.addLabels({
+                owner, repo, issue_number, labels: [target.name],
+              });
+            }
+     
```

**File**: `.github/workflows/pr-welcome.yml` (modified, +29/-29)
```diff
@@ -156,44 +156,44 @@ jobs:
               return 'th';
             }
 
-            // Count user's total PRs in this repo using search API
+            // Count submissions, regardless of open/closed/merged state.
+            // List by creator to avoid Search API indexing delays. Issues are
+            // returned too, so only count entries with a pull_request field.
             let prCount = 0;
             let hasValidPRCount = false;
             try {
-              const { data: searchResult } = await github.rest.search.issuesAndPullRequests({
-                q: `repo:${context.repo.owner}/${context.repo.repo} type:pr author:${author}`,
-              });
-              prCount = searchResult.total_count;
+              const submissions = await github.paginate(
+                github.rest.issues.listForRepo,
+                {
+                  owner: context.repo.owner,
+                  repo: context.repo.repo,
+                  creator: author,
+                  state: 'all',
+                  sort: 'created',
+                  direction: 'asc',
+                  per_page: 100,
+                },
+              );
+              // Add the event PR explicitly, even if it is not listed yet.
+              // Exclude later PRs so delayed runs retain this PR's ordinal.
+              prCount = 1 + submissions.filter(issue =>
+                issue.pull_request && issue.number < prNumber
+              ).length;
               hasValidPRCount = true;
             } catch (err) {
               console.log(`Could not get PR count for ${author}, will skip count display`);
-              hasValidPRCount = false;
             }
 
-            // Check if this is user's first PR (for labeling)
-            let isFirstPR = false;
-            try {
-              const { data: searchResult } = await github.rest.search.issuesAndPullRequests({
-                q: `repo:${context.repo.owner}/${context.repo.repo} type:pr author:${author} is:closed`,
+            // Use the same submission count for both the label and greeting.
+            const isFirstPR = hasValidPRCount && prCount === 1;
+            if (isFirstPR) {
+              await github.rest.issues.addLabels({
+                owner: context.repo.owner,
+                repo: context.repo.repo,
+                issue_number: prNumber,
+                labels: ['first-time-contributor'],
               });
-              isFirstPR = searchResult.total_count === 0;
-
-              // Add first-time-contributor label only for first PR
-              if (isFirstPR) {
-                await github.rest.issues.addLabels({
-                  owner: context.repo.owner,
-                  repo: context.repo.repo,
-                  issue_number: prNumber,
-                  labels: ['first-time-contributor'],
-                });
-                console.log(`Labeled PR #${prNumber} as first-time-contributor`);
-              }
-            } catch (err) {
-              if (err.status === 422 && err.message && err.message.includes('cannot be searched')) {
-                console.log(`Search API cannot look up author ${author}, continuing without label`);
-              } else {
-                throw err;
-              }
+              console.log(`Labeled PR #${prNumber} as first-time-contributor`);
             }
 
             // Check if user has starred the repo by listing user's starred
```

---

### Incident Patch 5: `c17f1b2b` (2026-09-30)
**Commit Message**: fix(memory): restore runtime after backend rollback (#7893)

**File**: `src/qwenpaw/app/routers/workspace.py` (modified, +30/-0)
```diff
@@ -2057,6 +2057,36 @@ def rollback_config(current_config: BaseModel) -> None:
                                 "failed for agent '%s'",
                                 sanitize_log_value(workspace.agent_id),
                             )
+                        else:
+                            # The failed reload may have left a newer candidate
+                            # running with the rejected backend while the
+                            # persisted config is restored. Schedule a fresh
+                            # reload after the rollback so runtime and disk
+                            # converge. This also bumps the config generation,
+                            # invalidating candidates still being built from
+                            # the rejected configuration.
+                            try:
+                                runtime_restore_scheduled = (
+                                    schedule_agent_reload(
+                                        request,
+                                        workspace.agent_id,
+                                    )
+                                )
+                            except Exception:
+                                logger.exception(
+                                    "Backend config rolled back for agent "
+                                    "'%s' but runtime restore scheduling "
+                                    "failed",
+                                    sanitize_log_value(workspace.agent_id),
+                                )
+                            else:
+                                if not runtime_restore_scheduled:
+                                    logger.error(
+                                        "Backend config rolled back for agent "
+                                        "'%s' but runtime restore could not "
+                                        "be scheduled",
+                                        sanitize_log_value(workspace.agent_id),
+                                    )
                 finally:
                     selection_lease.release()
 
```

**File**: `tests/unit/app/routers/test_workspace_router.py` (modified, +13/-2)
```diff
@@ -457,7 +457,9 @@ def schedule_reload(_request, _agent_id, *, on_complete=None):
 
 
 @pytest.mark.asyncio
-async def test_failed_plugin_backend_reload_rolls_back_selection(tmp_path):
+async def test_failed_plugin_backend_reload_rolls_back_and_restores_runtime(
+    tmp_path,
+):
     owner = "selection-rollback-plugin"
     backend_id = "selection-rollback-memory"
     memory_registry.register_backend(
@@ -480,10 +482,17 @@ async def test_failed_plugin_backend_reload_rolls_back_selection(tmp_path):
         workspace_dir=tmp_path,
     )
     completion: Any = None
+    scheduled_backends: list[str] = []
+    scheduled_completions: list[Any] = []
 
     def schedule_reload(_request, _agent_id, *, on_complete=None):
         nonlocal completion
-        completion = on_complete
+        scheduled_backends.append(
+            agent_config.running.memory_manager_backend,
+        )
+        scheduled_completions.append(on_complete)
+        if on_complete is not None:
+            completion = on_complete
         return True
 
     try:
@@ -507,6 +516,8 @@ def schedule_reload(_request, _agent_id, *, on_complete=None):
             await completion(False)  # pylint: disable=not-callable
 
         assert agent_config.running.memory_manager_backend == "none"
+        assert scheduled_backends == [backend_id, "none"]
+        assert scheduled_completions == [completion, None]
         assert memory_registry.begin_owner_unload(owner) == []
     finally:
         memory_registry.cancel_owner_unload(owner)
```

---

### Incident Patch 6: `c3e572c1` (2026-09-30)
**Commit Message**: fix(e2e): align tests with redesigned console (#8037)

**File**: `e2e/pages/acp_page.py` (modified, +6/-3)
```diff
@@ -47,16 +47,19 @@ class ACPPage(BasePage):
     TAB_CUSTOM = '[class*="tab"]:has-text("Custom"), [class*="tab"]:has-text("自定义"), .qwenpaw-segmented-item:has-text("Custom")'
 
     # Create button
-    CREATE_BUTTON = 'button:has-text("Create"), button:has-text("创建"), button:has-text("Add"), button:has-text("添加")'
+    CREATE_BUTTON = (
+        'button:has-text("Add ACP integration"), '
+        'button:has-text("添加 ACP 接入")'
+    )
 
     # ACP card list
-    ACP_CARD = '[class*="acpCard"], [class*="ACPCard"], .qwenpaw-card'
+    ACP_CARD = '[class*="channelsGrid"] [class*="card"]'
     ACP_CARD_TITLE = '[class*="agentKey"], [class*="title"], .qwenpaw-card-meta-title'
     ACP_CARD_TAG = '.qwenpaw-tag'
     ACP_CARD_SWITCH = '.qwenpaw-switch'
 
     # ACP drawer (create/edit)
-    DRAWER = '.qwenpaw-drawer'
+    DRAWER = '[role="dialog"]:visible'
     DRAWER_TITLE = '.qwenpaw-drawer-title'
     DRAWER_CLOSE = '.qwenpaw-drawer-close'
 
```

**File**: `e2e/pages/agents_page.py` (modified, +32/-21)
```diff
@@ -42,28 +42,31 @@ class AgentsPage(BasePage):
     PAGE_HEADER = 'button:has-text("Create Agent"), span[class*="breadcrumbCurrent"]:has-text("智能体")'
     BREADCRUMB = 'span[class*="breadcrumbCurrent"]:has-text("智能体")'
 
-    # Agent list (table structure)
-    AGENT_TABLE = '.qwenpaw-table'
-    AGENT_LIST = '.qwenpaw-table-tbody'
-    AGENT_ITEM = '.qwenpaw-table-tbody tr.qwenpaw-table-row'
+    # Agent gallery. The settings redesign replaced the table with cards.
+    AGENT_TABLE = 'div[class*="grid"]'
+    AGENT_LIST = AGENT_TABLE
+    AGENT_ITEM = 'div[class*="grid"] article[class*="card"]'
     # Column order: drag handle (1) | Name (2) | ID (3) | Backend (4) |
     # Description (5) | Workspace (6) | Model (7) | Actions (8). Upstream
     # #6397 inserted the Backend column after ID, shifting everything to
     # its right. Actions is declared ``fixed: "right"``, so anchor it on
     # the fixed-column class instead of a position that keeps drifting.
-    AGENT_NAME_CELL = 'td.qwenpaw-table-cell:nth-child(2)'
-    AGENT_ID_CELL = 'td.qwenpaw-table-cell:nth-child(3)'
-    AGENT_DESC_CELL = 'td.qwenpaw-table-cell:nth-child(5)'
-    AGENT_WORKSPACE_CELL = 'td.qwenpaw-table-cell:nth-child(6)'
-    AGENT_MODEL_CELL = 'td.qwenpaw-table-cell:nth-child(7)'
-    AGENT_ACTIONS_CELL = 'td.qwenpaw-table-cell-fix-right'
+    AGENT_NAME_CELL = 'button[class*="open"] strong'
+    AGENT_ID_CELL = 'span[class*="identity"] code'
+    AGENT_DESC_CELL = 'div[class*="description"]'
+    AGENT_WORKSPACE_CELL = 'span[class*="identity"]'
+    AGENT_MODEL_CELL = 'button[class*="open"] > span:not([class])'
+    AGENT_ACTIONS_CELL = 'div[class*="quickActions"]'
     # Post-#6198 the name cell shows an AgentStatusIndicator dot exposing a
     # ``data-status`` attribute (disabled/pending/starting/running/failed)
     # instead of a "Disabled" Tag.
     AGENT_STATUS = '[data-status]'
 
     # Action buttons
-    CREATE_AGENT_BTN = 'button:has-text("创建智能体"), button:has-text("Create Agent"), .qwenpaw-btn-primary'
+    CREATE_AGENT_BTN = (
+        'button:has-text("创建智能体"), '
+        'button:has-text("Create Agent")'
+    )
     # Inline action buttons in a table row. Post v2.0.1 (#6262 added a Copy
     # button at position 3) the actions are 5 icon buttons in order:
     # Pin | Edit | Copy | Toggle | Delete. Anchor on icon semantics only —
@@ -73,10 +76,13 @@ class AgentsPage(BasePage):
     #   Copy   = antd CopyOutlined    -> .anticon-copy   (do not match)
     #   Toggle = lucide Eye/EyeOff    -> svg.lucide-eye / svg.lucide-eye-off
     #   Delete = antd DeleteOutlined  -> .anticon-delete (danger button)
-    EDIT_BTN = 'button:has(.anticon-edit)'
-    TOGGLE_BTN = 'button:has(svg.lucide-eye-off), button:has(svg.lucide-eye)'
-    DELETE_BTN = 'button.qwenpaw-btn-dangerous, button:has(.anticon-delete)'
-    ENABLE_TOGGLE = 'button:has(svg.lucide-eye-off), button:has(svg.lucide-eye)'
+    EDIT_BTN = 'button[aria-label="Edit"], button[aria-label="编辑"]'
+    TOGGLE_BTN = (
+        'button[aria-label="Enable"], button[aria-label="Disable"], '
+        'button[aria-label="启用"], button[aria-label="禁用"]'
+    )
+    DELETE_BTN = 'button:has-text("Delete"), button:has-text("删除")'
+    ENABLE_TOGGLE = TOGGLE_BTN
     REFRESH_BTN = 'button:has(.anticon-reload), button:has(.spark-icon-spark-refresh-line)'
 
     # Create/edit form
@@ -150,7 +156,7 @@ def get_agent_list(self) -> List[Dict]:
                 name_text = name_cell.inner_text() if name_cell.is_visible() else ""
                 # Post-#6198 status is an AgentStatusIndicator dot exposing a
                 # ``data-status`` attribute (no visible text) — read the attribute.
-                status_dot = name_cell.locator(self.AGENT_STATUS).first
+                status_dot = row.locator(self.AGENT_STATUS).first
                 status = (
                     (status_dot.get_attribute("data-status") or "").strip()
                     if status_dot.count() > 0 else ""
@@ -161,7 +167,11 @@ def
```

**File**: `e2e/pages/channels_page.py` (modified, +23/-31)
```diff
@@ -46,7 +46,9 @@ class ChannelsPage(BasePage):
     # `[class*=availableItem]` would match one tile three times. The tile
     # container is a <div>; the name/action are <span>. Anchor on
     # `div[class*=availableItem]` to count each tile exactly once.
-    PAGE_LOAD_INDICATOR = '[class*=channelCard], div[class*=availableItem]'
+    PAGE_LOAD_INDICATOR = (
+        '[class*=channelCard], button[class*=availableItem]'
+    )
 
     # Filter buttons (UI text is Chinese; use button[class*=filterTab] to match the button rather than the parent container)
     FILTER_ALL_BTN = 'button[class*=filterTab]:has-text("全部"), button:has-text("All")'
@@ -60,9 +62,12 @@ class ChannelsPage(BasePage):
     # `find_channel_card` / `get_channel_card_count` operate on the union.
     # `div[class*=availableItem]` (not the bare substring) avoids triple
     # matching on the item's name/action spans.
-    CHANNEL_CARD = '[class*=channelCard], div[class*=availableItem]'
-    CHANNEL_CARD_ENABLED = '[class*=channelCard][class*=enabled]'
-    CHANNEL_CARD_DISABLED = 'div[class*=availableItem]'
+    CHANNEL_CARD = (
+        'div.qwenpaw-card[class*=channelCard], '
+        'button[class*=availableItem]'
+    )
+    CHANNEL_CARD_ENABLED = 'div.qwenpaw-card[class*=channelCard]'
+    CHANNEL_CARD_DISABLED = 'button[class*=availableItem]'
 
     # Channel card content
     CHANNEL_ICON = '[class*=channelCard] [class*=icon]'
@@ -74,9 +79,9 @@ class ChannelsPage(BasePage):
     CHANNEL_BOT_PREFIX = '[class*=channelCard] [class*=botPrefix]'
 
     # Edit drawer (match only the visible drawer to avoid strict mode violations)
-    CHANNEL_DRAWER = '.qwenpaw-drawer:visible, .ant-drawer:visible'
-    DRAWER_TITLE = '.qwenpaw-drawer-title, .ant-drawer-title'
-    DRAWER_CLOSE_BTN = '.qwenpaw-drawer-close, .ant-drawer-close'
+    CHANNEL_DRAWER = '[role="dialog"]:visible'
+    DRAWER_TITLE = '[role="dialog"] .qwenpaw-modal-title'
+    DRAWER_CLOSE_BTN = '[role="dialog"] .qwenpaw-modal-close'
 
     # Form fields
     FORM_ITEM = '.ant-form-item, .qwenpaw-form-item'
@@ -321,7 +326,9 @@ def wait_for_drawer_open(self, timeout: Optional[int] = None) -> bool:
         timeout = timeout or self.timeout
         logger.info("Waiting for drawer to open")
         try:
-            self.page.locator('.qwenpaw-drawer, .ant-drawer').first.wait_for(state="visible", timeout=timeout)
+            self.page.locator(self.CHANNEL_DRAWER).first.wait_for(
+                state="visible", timeout=timeout
+            )
             return True
         except Exception:
             return False
@@ -374,7 +381,7 @@ def toggle_enable(self, enable: bool = True) -> "ChannelsPage":
         """
         logger.info(f"Toggling enable to: {enable}")
         # Locate the switch inside the drawer
-        drawer = self.page.locator('.qwenpaw-drawer, .ant-drawer')
+        drawer = self.page.locator(self.CHANNEL_DRAWER)
         switch = drawer.locator('.qwenpaw-switch, .ant-switch').first
 
         # Read the current state
@@ -407,24 +414,9 @@ def fill_form_field(self, field_name: str, value: str) -> "ChannelsPage":
         return self
 
     def save_channel_config(self) -> "ChannelsPage":
-        """Save the channel configuration (the drawer does not close automatically after saving)."""
-        logger.info("Saving channel configuration")
-        submit_btn = self.page.locator(self.FORM_SUBMIT_BTN).first
-        # Wait for the save API request to complete via expect_response
-        try:
-            with self.page.expect_response(
-                lambda resp: '/api/config/channel' in resp.url and resp.request.method in ('PUT', 'POST', 'PATCH'),
-                timeout=10000
-            ) as response_info:
-                submit_btn.click()
-            response = response_info.value
-            logger.info(f"Save API response: status={response.status}")
-            if not response.ok:
-                logger.warning(f"Save API returned non-OK status: {response.status}"
```

**File**: `e2e/pages/cronjobs_page.py` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ class CronJobsPage(BasePage):
     EXECUTE_NOW_BTN = 'button:has-text("Execute Now"), button:has-text("Run"), button:has-text("立即执行"), button:has-text("执行")'
 
     # Drawer / dialog
-    DRAWER = ".ant-drawer, .qwenpaw-drawer, [class*=drawer]"
+    DRAWER = '[role="dialog"]:visible'
     DRAWER_TITLE = ".ant-drawer-title, .qwenpaw-drawer-title"
     DRAWER_SAVE_BTN = '.ant-drawer .ant-btn-primary:has-text("Save"), .ant-drawer button:has-text("OK"), [class*=drawer] button:has-text("Save"), [class*=drawer] button:has-text("OK"), [class*=drawer] button:has-text("保存"), [class*=drawer] button:has-text("保 存"), [class*=drawer] button:has-text("确定"), [class*=drawer] .qwenpaw-btn-primary'
     DRAWER_CANCEL_BTN = '.ant-drawer .ant-btn:has-text("Cancel"), [class*=drawer] button:has-text("取消"), [class*=drawer] button:has-text("取 消")'
```

**File**: `e2e/pages/heartbeat_page.py` (modified, +55/-72)
```diff
@@ -36,24 +36,31 @@ class HeartbeatPage(BasePage):
     
     # ========== Selector definitions ==========
 
-    # Page load indicator (no h1 on the page; use a switch or input instead)
-    PAGE_LOAD_INDICATOR = '.ant-switch, .qwenpaw-switch, input'
+    PAGE_LOAD_INDICATOR = '[role="switch"][aria-label]'
 
     # Configuration card
     CONFIG_CARD = ".ant-card, .qwenpaw-card, [class*=card]"
     CONFIG_FORM = ".ant-form, .qwenpaw-form"
 
-    # Enabled switch (match id="enabled" exactly to avoid the "active hours" switch)
-    ENABLED_SWITCH = '#enabled'
+    ENABLED_SWITCH = (
+        '[role="switch"][aria-label="Enable heartbeat"], '
+        '[role="switch"][aria-label="开启心跳"]'
+    )
     ENABLED_LABEL = '.ant-form-item:has-text("Enable"), .ant-form-item:has-text("启用"), .qwenpaw-form-item:has-text("启用"), .qwenpaw-form-item:has-text("开启")'
 
     # Interval configuration.
     # v2.0.0 (PR #5557) added a sibling `#timeoutSeconds` InputNumber to the
     # same page, so the previous broad selector matched two elements and
     # Playwright strict-mode `.fill()` failed. Anchor on `#everyNumber` —
     # the id emitted by the frontend Form.Item name="everyNumber".
-    INTERVAL_INPUT = 'input#everyNumber'
-    INTERVAL_UNIT_SELECT = '.qwenpaw-select:has(#everyUnit), .ant-select:has(#everyUnit), .ant-select:has-text("seconds"), .ant-select:has-text("minutes"), .ant-select:has-text("hours"), .qwenpaw-select:has-text("秒"), .qwenpaw-select:has-text("分钟"), .qwenpaw-select:has-text("小时")'
+    INTERVAL_INPUT = (
+        '[role="spinbutton"][aria-label="Hours"], '
+        '[role="spinbutton"][aria-label="小时"]'
+    )
+    INTERVAL_UNIT_SELECT = (
+        '[role="spinbutton"][aria-label="Minutes"], '
+        '[role="spinbutton"][aria-label="分钟"]'
+    )
 
     # Scheduled time
     TIME_PICKER = '.ant-picker-input > input, .qwenpaw-picker-input > input'
@@ -62,8 +69,8 @@ class HeartbeatPage(BasePage):
     # Skill configuration
     SKILL_SELECT = '.ant-select[data-placeholder*="Skill" i], .ant-select:has-text("skill"), .qwenpaw-select[data-placeholder*="技能" i], .qwenpaw-select:has-text("技能")'
 
-    # Save button (the actual UI may render "保 存" with a space)
-    SAVE_BTN = 'button:has-text("Save"), button:has-text("保存"), button:has-text("保 存")'
+    # The redesigned form persists changes through useAutoSave.
+    SAVE_BTN = 'form[class*="schedule"]'
 
     # Status indicator
     STATUS_INDICATOR = '.ant-badge-status, .qwenpaw-badge-status, .status-indicator'
@@ -106,28 +113,11 @@ def is_heartbeat_enabled(self) -> bool:
     
     def get_interval(self) -> Dict[str, Any]:
         """Return the heartbeat interval configuration."""
-        interval_input = self.page.locator(self.INTERVAL_INPUT)
-        unit_select = self.page.locator(self.INTERVAL_UNIT_SELECT)
-
-        result = {"value": None, "unit": None}
-
-        if interval_input.count() > 0:
-            result["value"] = interval_input.first.input_value()
-
-        if unit_select.count() > 0:
-            # Prefer the title attribute, falling back to inner_text
-            selection_item = unit_select.first.locator('.qwenpaw-select-selection-item, .ant-select-selection-item')
-            if selection_item.count() > 0:
-                unit_text = selection_item.get_attribute('title') or selection_item.inner_text().strip()
-                result["unit"] = unit_text if unit_text else None
-            else:
-                # Fallback: take the container text and clean it up
-                raw_text = unit_select.first.inner_text().strip()
-                # Strip label text, keep only the selected value
-                if raw_text:
-                    result["unit"] = raw_text.split('\n')[0].strip() if '\n' in raw_text else raw_text
-
-        return result
+        hours = self.page.locator(self.INTERVAL_INPUT).first
+        minutes = self.page.locator(self.INTERVAL_UNIT_SELECT).first
+        hour_value = int(hours.get_attribute("aria-valuenow") or 0)
+ 
```

---

### Incident Patch 7: `b6229ec3` (2026-09-30)
**Commit Message**: fix(terminal): support high posix descriptors (#8032)

**File**: `src/qwenpaw/services/terminal_posix.py` (modified, +7/-14)
```diff
@@ -11,7 +11,7 @@
 import threading
 
 
-IO_POLL_INTERVAL = 0.1
+IO_POLL_TIMEOUT_MS = 100
 
 
 class PosixPty:
@@ -25,6 +25,10 @@ def __init__(self, process, master):
         self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
         self.closing = threading.Event()
         os.set_blocking(master, False)
+        self.reader_poll = select.poll()
+        self.reader_poll.register(master, select.POLLIN)
+        self.writer_poll = select.poll()
+        self.writer_poll.register(master, select.POLLOUT)
 
     @classmethod
     def spawn(cls, command, cwd, env, dimensions):
@@ -70,13 +74,7 @@ def spawn(cls, command, cwd, env, dimensions):
     def read(self, size):
         """Decode output incrementally, tolerating arbitrary program bytes."""
         while not self.closing.is_set():
-            readable, _, _ = select.select(
-                [self.fd],
-                [],
-                [],
-                IO_POLL_INTERVAL,
-            )
-            if not readable:
+            if not self.reader_poll.poll(IO_POLL_TIMEOUT_MS):
                 continue
             try:
                 data = os.read(self.fd, size)
@@ -96,12 +94,7 @@ def write(self, text):
             try:
                 count = os.write(self.fd, data)
             except BlockingIOError:
-                select.select(
-                    [],
-                    [self.fd],
-                    [],
-                    IO_POLL_INTERVAL,
-                )
+                self.writer_poll.poll(IO_POLL_TIMEOUT_MS)
                 continue
             data = data[count:]
 
```

---

### Incident Patch 8: `77744172` (2026-09-29)
**Commit Message**: fix(desktop): disable NSIS solid compression (#8025)

**File**: `.github/workflows/fork-verify-desktop.yml` (modified, +1/-0)
```diff
@@ -161,6 +161,7 @@ jobs:
           New-Item -ItemType Directory -Force -Path dist | Out-Null
           Copy-Item -Force $installer.FullName $target
           Write-Host "Staged: $target"
+          Write-Host "Installer size: $($installer.Length) bytes ($([Math]::Round($installer.Length / 1MB, 2)) MiB)"
 
       - name: Verify desktop (Tauri Windows)
         timeout-minutes: 10
```

**File**: `console/src-tauri/nsis/tauri-installer.nsi` (added, +981/-0)
```diff
@@ -0,0 +1,981 @@
+; Vendored from Tauri v2.11.4:
+; crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi
+; Local change: use per-file compression instead of /SOLID to reduce the
+; uncompressed temporary datablock size during packaging.
+Unicode true
+ManifestDPIAware true
+; Add in `dpiAwareness` `PerMonitorV2` to manifest for Windows 10 1607+ (note this should not affect lower versions since they should be able to ignore this and pick up `dpiAware` `true` set by `ManifestDPIAware true`)
+; Currently undocumented on NSIS's website but is in the Docs folder of source tree, see
+; https://github.com/kichik/nsis/blob/5fc0b87b819a9eec006df4967d08e522ddd651c9/Docs/src/attributes.but#L286-L300
+; https://github.com/tauri-apps/tauri/pull/10106
+ManifestDPIAwareness PerMonitorV2
+
+!if "{{compression}}" == "none"
+  SetCompress off
+!else
+  ; Set the compression algorithm. We default to LZMA.
+  SetCompressor "{{compression}}"
+!endif
+
+; Keep above !include to stay ahead of any plugin command
+; see https://github.com/tauri-apps/tauri/pull/15422#discussion_r3289239624
+{{#if signed_plugins_path}}
+!addplugindir "{{signed_plugins_path}}"
+{{/if}}
+
+!include MUI2.nsh
+!include FileFunc.nsh
+!include x64.nsh
+!include WordFunc.nsh
+!include "utils.nsh"
+!include "FileAssociation.nsh"
+!include "Win\COM.nsh"
+!include "Win\Propkey.nsh"
+!include "StrFunc.nsh"
+${StrCase}
+${StrLoc}
+
+{{#if installer_hooks}}
+!include "{{installer_hooks}}"
+{{/if}}
+
+!define WEBVIEW2APPGUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
+
+!define MANUFACTURER "{{manufacturer}}"
+!define PRODUCTNAME "{{product_name}}"
+!define VERSION "{{version}}"
+!define VERSIONWITHBUILD "{{version_with_build}}"
+!define HOMEPAGE "{{homepage}}"
+!define INSTALLMODE "{{install_mode}}"
+!define LICENSE "{{license}}"
+!define INSTALLERICON "{{installer_icon}}"
+!define SIDEBARIMAGE "{{sidebar_image}}"
+!define HEADERIMAGE "{{header_image}}"
+!define UNINSTALLERICON "{{uninstaller_icon}}"
+!define UNINSTALLERHEADERIMAGE "{{uninstaller_header_image}}"
+!define MAINBINARYNAME "{{main_binary_name}}"
+!define MAINBINARYSRCPATH "{{main_binary_path}}"
+!define BUNDLEID "{{bundle_id}}"
+!define COPYRIGHT "{{copyright}}"
+!define OUTFILE "{{out_file}}"
+!define ARCH "{{arch}}"
+!define ADDITIONALPLUGINSPATH "{{additional_plugins_path}}"
+!define ALLOWDOWNGRADES "{{allow_downgrades}}"
+!define DISPLAYLANGUAGESELECTOR "{{display_language_selector}}"
+!define INSTALLWEBVIEW2MODE "{{install_webview2_mode}}"
+!define WEBVIEW2INSTALLERARGS "{{webview2_installer_args}}"
+!define WEBVIEW2BOOTSTRAPPERPATH "{{webview2_bootstrapper_path}}"
+!define WEBVIEW2INSTALLERPATH "{{webview2_installer_path}}"
+!define MINIMUMWEBVIEW2VERSION "{{minimum_webview2_version}}"
+!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
+!define MANUKEY "Software\${MANUFACTURER}"
+!define MANUPRODUCTKEY "${MANUKEY}\${PRODUCTNAME}"
+!define UNINSTALLERSIGNCOMMAND "{{uninstaller_sign_cmd}}"
+!define ESTIMATEDSIZE "{{estimated_size}}"
+!define STARTMENUFOLDER "{{start_menu_folder}}"
+
+Var PassiveMode
+Var UpdateMode
+Var NoShortcutMode
+Var WixMode
+Var OldMainBinaryName
+
+Name "${PRODUCTNAME}"
+BrandingText "${COPYRIGHT}"
+OutFile "${OUTFILE}"
+
+; We don't actually use this value as default install path,
+; it's just for nsis to append the product name folder in the directory selector
+; https://nsis.sourceforge.io/Reference/InstallDir
+!define PLACEHOLDER_INSTALL_DIR "placeholder\${PRODUCTNAME}"
+InstallDir "${PLACEHOLDER_INSTALL_DIR}"
+
+VIProductVersion "${VERSIONWITHBUILD}"
+VIAddVersionKey "ProductName" "${PRODUCTNAME}"
+VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
+VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
+VIAddVersionKey "FileVersion" "${VERSION}"
+VIAddVersionKey "ProductVersion" "${VERSION}"
+
+# additional plugins
+!addplugindir "${ADDITIONALPLUGINSPATH}"
+
+; Uninstaller signing command
+!if "${UNINSTALLERSIGNCOMMAND}" != ""
+  !uninstfinalize '${U
```

**File**: `console/src-tauri/tauri.conf.json` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@
         "silent": true
       },
       "nsis": {
+        "template": "nsis/tauri-installer.nsi",
         "installerIcon": "../../scripts/pack/assets/icon.ico",
         "uninstallerIcon": "../../scripts/pack/assets/icon.ico",
         "installerHooks": "nsis-hooks.nsh",
```

**File**: `tests/unit/tauri/test_desktop_workflows.py` (modified, +29/-0)
```diff
@@ -1,6 +1,7 @@
 # -*- coding: utf-8 -*-
 """Regression tests for desktop packaging workflows."""
 
+import json
 from pathlib import Path
 import tomllib
 
@@ -110,3 +111,31 @@ def test_download_helper_resolves_verifier_from_its_own_checkout() -> None:
 
     assert 'script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"' in script
     assert 'python3 "$script_dir/verify_desktop_artifacts.py"' in script
+
+
+def test_nsis_template_avoids_solid_compression() -> None:
+    """Large desktop payloads must not use NSIS solid compression."""
+    config = json.loads(
+        (REPO_ROOT / "console/src-tauri/tauri.conf.json").read_text(
+            encoding="utf-8",
+        ),
+    )
+    package_lock = json.loads(
+        (REPO_ROOT / "console/package-lock.json").read_text(
+            encoding="utf-8",
+        ),
+    )
+    nsis = config["bundle"]["windows"]["nsis"]
+    template = (REPO_ROOT / "console/src-tauri" / nsis["template"]).read_text(
+        encoding="utf-8",
+    )
+    tauri_cli_version = package_lock["packages"][
+        "node_modules/@tauri-apps/cli"
+    ]["version"]
+
+    assert nsis["compression"] == "zlib"
+    # This is a version-sync reminder, not an upstream content check.
+    # When upgrading the CLI, compare the template with that release.
+    assert f"Vendored from Tauri v{tauri_cli_version}" in template
+    assert 'SetCompressor "{{compression}}"' in template
+    assert "SetCompressor /SOLID" not in template
```

---

### Incident Patch 9: `df3055c2` (2026-09-29)
**Commit Message**: fix(ci): address cross-platform paths, sandbox cleanup, and Windows terminal interrupts (#8026)

**File**: `src/qwenpaw/portability/providers/qoder_schedules.py` (modified, +2/-2)
```diff
@@ -708,11 +708,11 @@ def _parse_aware_datetime(value: Any) -> datetime | None:
 
 
 def _load_timezone(value: str) -> ZoneInfo | None:
-    if not value:
+    if not value.strip():
         return None
     try:
         return ZoneInfo(value)
-    except (ValueError, ZoneInfoNotFoundError):
+    except (ValueError, ZoneInfoNotFoundError, OSError):
         return None
 
 
```

**File**: `src/qwenpaw/services/terminal_windows.py` (modified, +11/-15)
```diff
@@ -5,35 +5,30 @@
 import ctypes
 import importlib
 import multiprocessing
+import sys
 import threading
 import time
 
 import psutil
 
 
-def interrupt_console(pid):
-    """Send Ctrl+C only from the isolated worker to its shell's console."""
+def enable_ctrl_c():
+    """Clear inherited Ctrl+C suppression in the isolated PTY worker."""
+    if sys.platform != "win32":
+        return
+    # Console Ctrl+C ignore state is inherited, including by ConPTY children.
+    # Reset it before spawning the shell; writing ETX cannot override it.
     kernel = ctypes.WinDLL("kernel32", use_last_error=True)
-    kernel.FreeConsole()
-    if not kernel.AttachConsole(pid):
+    if not kernel.SetConsoleCtrlHandler(None, False):
         raise ctypes.WinError(ctypes.get_last_error())
-    try:
-        if not kernel.SetConsoleCtrlHandler(None, True):
-            raise ctypes.WinError(ctypes.get_last_error())
-        if not kernel.GenerateConsoleCtrlEvent(0, 0):
-            raise ctypes.WinError(ctypes.get_last_error())
-        # Control handlers run asynchronously; stay attached for delivery.
-        time.sleep(0.1)
-    finally:
-        kernel.FreeConsole()
 
 
 def write_input(process, data):
-    """Preserve text order while translating ETX into a console event."""
+    """Send interrupts through the owned PTY, preserving input order."""
     parts = data.split("\x03")
     for index, part in enumerate(parts):
         if index:
-            interrupt_console(process.pid)
+            process.sendintr()
         if part:
             process.write(part)
 
@@ -64,6 +59,7 @@ def pty_worker(control, output, command, cwd, env, dimensions):
     """Own one native PTY; process exit releases its OS handles as well."""
     try:
         native = importlib.import_module("winpty").PtyProcess
+        enable_ctrl_c()
         process = native.spawn(
             command,
             cwd=cwd,
```

**File**: `tests/unit/portability/test_qoder_schedules_mapping.py` (modified, +16/-0)
```diff
@@ -596,6 +596,22 @@ def test_timezone_loading_accepts_known_zones() -> None:
     assert zone.key == "Asia/Shanghai"
 
 
+def test_timezone_loading_rejects_whitespace_before_lookup(monkeypatch):
+    def unexpected_lookup(_value):
+        pytest.fail("Whitespace must not reach the timezone filesystem lookup")
+
+    monkeypatch.setattr(qoder_schedules, "ZoneInfo", unexpected_lookup)
+    assert qoder_schedules._load_timezone("   ") is None
+
+
+def test_timezone_loading_handles_unreadable_zone(monkeypatch):
+    def unreadable(_value):
+        raise PermissionError("timezone resource is unreadable")
+
+    monkeypatch.setattr(qoder_schedules, "ZoneInfo", unreadable)
+    assert qoder_schedules._load_timezone("Asia/Shanghai") is None
+
+
 @pytest.mark.parametrize(
     ("value", "expected"),
     [
```

**File**: `tests/unit/services/test_terminal_windows.py` (modified, +11/-3)
```diff
@@ -7,7 +7,7 @@
 import subprocess
 import sys
 import threading
-from unittest.mock import MagicMock
+from unittest.mock import MagicMock, call
 
 import psutil
 import pytest
@@ -22,6 +22,9 @@ def test_worker_protocol_and_eof(monkeypatch):
     process.fileobj.recv.return_value = b""
     process.isalive.return_value = False
     process.exitstatus = 7
+    startup = MagicMock()
+    startup.attach_mock(native.PtyProcess.spawn, "spawn")
+    monkeypatch.setattr(windows, "enable_ctrl_c", startup.enable_ctrl_c)
     monkeypatch.setattr(windows.importlib, "import_module", lambda _: native)
     control, child_control = multiprocessing.Pipe()
     output, child_output = multiprocessing.Pipe(duplex=False)
@@ -34,6 +37,10 @@ def test_worker_protocol_and_eof(monkeypatch):
     try:
         assert control.poll(3)
         assert control.recv() == (True, 123)
+        assert startup.mock_calls[:2] == [
+            call.enable_ctrl_c(),
+            call.spawn([], cwd=".", env={}, dimensions=(24, 80)),
+        ]
         for request_id, (operation, args, expected) in enumerate(
             [
                 ("write", ("hello",), None),
@@ -47,8 +54,9 @@ def test_worker_protocol_and_eof(monkeypatch):
             assert control.recv() == (request_id, True, expected)
         process.write.assert_called_once_with("hello")
         process.setwinsize.assert_called_once_with(30, 100)
-        assert output.poll(3)
-        with pytest.raises(EOFError):
+        # Windows may report the closed pipe from poll(), before recv().
+        with pytest.raises((EOFError, BrokenPipeError)):
+            assert output.poll(3)
             output.recv()
     finally:
         control.close()
```

**File**: `tests/unit/services/test_terminal_windows_control.py` (modified, +63/-65)
```diff
@@ -1,20 +1,38 @@
 # -*- coding: utf-8 -*-
-"""Console event routing contracts and a Windows-only native smoke test."""
+"""PTY interrupt contracts and a Windows-only native smoke test."""
 
 import ctypes
 import os
 import sys
 import time
+from types import SimpleNamespace
 from unittest.mock import MagicMock, call
 
 import pytest
 
 from qwenpaw.services import terminal_windows as windows
 
 
+def worker_ignoring_ctrl_c(*args):
+    """Reproduce a launcher that passes Ctrl+C suppression to its children."""
+    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
+    if not kernel.SetConsoleCtrlHandler(None, True):
+        raise ctypes.WinError(ctypes.get_last_error())
+    windows.pty_worker(*args)
+
+
 @pytest.mark.skipif(sys.platform != "win32", reason="Real Windows console")
-def test_native_ping_interrupt_and_host_cleanup(tmp_path):
+@pytest.mark.parametrize("inherited_ignore", [False, True])
+def test_native_ping_interrupt_and_host_cleanup(
+    tmp_path,
+    monkeypatch,
+    inherited_ignore,
+):
     pytest.importorskip("winpty")
+    if inherited_ignore:
+        # multiprocessing spawn imports this module afresh in the worker,
+        # where windows.pty_worker still refers to the production function.
+        monkeypatch.setattr(windows, "pty_worker", worker_ignoring_ctrl_c)
     adapter = windows.WindowsPty.spawn(
         ["powershell.exe", "-NoLogo", "-NoProfile"],
         str(tmp_path),
@@ -31,9 +49,12 @@ def until(marker):
         assert marker in output, output
 
     try:
+        adapter.write("function prompt { 'QWENPAW_' + 'READY>' }; \r")
+        until("QWENPAW_READY>")
         adapter.write("ping -n 30 127.0.0.1\r")
         until("TTL=")
         adapter.write("\x03")
+        until("QWENPAW_READY>")
         adapter.write("echo ('QWENPAW_' + 'INTERRUPT_OK')\r")
         until("QWENPAW_INTERRUPT_OK")
         owned = adapter.owner.children(recursive=True)
@@ -42,45 +63,11 @@ def until(marker):
     assert all(not process.is_running() for process in owned)
 
 
-def test_control_c_uses_console_event_and_preserves_text_order(monkeypatch):
-    process = MagicMock(pid=123)
-    events = MagicMock()
-    process.write = events.write
-    monkeypatch.setattr(windows, "interrupt_console", events.interrupt)
-    windows.write_input(process, "before\x03after\x03")
-    assert events.mock_calls == [
-        call.write("before"),
-        call.interrupt(123),
-        call.write("after"),
-        call.interrupt(123),
-    ]
-
-
-def test_interrupt_attaches_only_to_owned_shell(monkeypatch):
-    kernel = MagicMock()
-    kernel.AttachConsole.return_value = True
-    kernel.SetConsoleCtrlHandler.return_value = True
-    kernel.GenerateConsoleCtrlEvent.return_value = True
-    monkeypatch.setattr(
-        ctypes,
-        "WinDLL",
-        lambda *_a, **_kw: kernel,
-        raising=False,
-    )
-    monkeypatch.setattr(windows.time, "sleep", lambda _: None)
-    windows.interrupt_console(123)
-    assert kernel.mock_calls == [
-        call.FreeConsole(),
-        call.AttachConsole(123),
-        call.SetConsoleCtrlHandler(None, True),
-        call.GenerateConsoleCtrlEvent(0, 0),
-        call.FreeConsole(),
-    ]
-
-
-def test_failed_attach_never_signals_another_console(monkeypatch):
+@pytest.mark.parametrize("success", [True, False])
+def test_enable_ctrl_c_clears_inherited_ignore(monkeypatch, success):
     kernel = MagicMock()
-    kernel.AttachConsole.return_value = False
+    kernel.SetConsoleCtrlHandler.return_value = success
+    monkeypatch.setattr(windows, "sys", SimpleNamespace(platform="win32"))
     monkeypatch.setattr(
         ctypes,
         "WinDLL",
@@ -91,32 +78,43 @@ def test_failed_attach_never_signals_another_console(monkeypatch):
     monkeypatch.setattr(
         ctypes,
         "WinError",
-        lambda _: OSError("attach failed"),
+        lambda _: OSError("reset failed"),
         raising=False,
     )
-    with pytest.raises(OSError, match="attach failed"):
-
```

---

### Incident Patch 10: `e793f6b0` (2026-09-29)
**Commit Message**: fix(chat): restore compact copy action icons (#8021)

**File**: `console/src/pages/Chat/index.module.less` (modified, +4/-10)
```diff
@@ -112,20 +112,14 @@
       font-size: var(--app-icon-default) !important;
     }
 
-    [class$="-bubble-footer-actions-item"]:has(svg) {
-      display: inline-flex;
-      min-width: var(--app-icon-button);
-      min-height: var(--app-icon-button);
-      align-items: center;
-      justify-content: center;
-
+    [class$="-bubble-footer-actions"] button:has(svg) {
       [data-spark-icon] {
-        font-size: var(--app-icon-md) !important;
+        font-size: var(--app-icon-sm) !important;
       }
 
       svg {
-        width: var(--app-icon-md);
-        height: var(--app-icon-md);
+        width: var(--app-icon-sm);
+        height: var(--app-icon-sm);
       }
     }
   }
```

**File**: `console/src/pages/Chat/index.tsx` (modified, +4/-6)
```diff
@@ -35,11 +35,9 @@ import { useAppMessage } from "../../hooks/useAppMessage";
 import { useIsMobile } from "../../hooks/useIsMobile";
 import {
   CircleAlert as ExclamationCircleOutlined,
-  Settings as SettingOutlined,
-} from "lucide-react";
-import {
+  Copy,
   Paperclip as SparkAttachmentLine,
-  Copy as SparkCopyLine,
+  Settings as SettingOutlined,
 } from "lucide-react";
 import { usePlugins } from "../../plugins/PluginContext";
 import { useTranslation } from "react-i18next";
@@ -4438,7 +4436,7 @@ export default function ChatPage() {
           {
             icon: (
               <span title={t("common.copy")}>
-                <SparkCopyLine size="1em" />
+                <Copy />
               </span>
             ),
             onClick: ({ data }: { data: CopyableResponse }) => {
@@ -4477,7 +4475,7 @@ export default function ChatPage() {
             },
           },
           {
-            icon: <SparkCopyLine size="1em" />,
+            icon: <Copy />,
             onClick: ({ data }: { data: { input?: unknown[] } }) => {
               const text = (data?.input || [])
                 .map(extractUserMessageText)
```

**File**: `console/src/styles/uiFontSizeCoverage.test.ts` (modified, +12/-4)
```diff
@@ -37,6 +37,7 @@ const artifactStyles = readSource(
 );
 const layoutStyles = readSource("src/layouts/index.module.less");
 const chatStyles = readSource("src/pages/Chat/index.module.less");
+const chatSource = readSource("src/pages/Chat/index.tsx");
 const filesWorkspaceStyles = readSource(
   "src/features/files-workspace/FilesWorkspace.module.less",
 );
@@ -601,9 +602,16 @@ describe("console font-size coverage", () => {
     expect(workspaceButtonRule).toContain("var(--app-icon-md)");
     expect(workspaceButtonRule).toContain("font-size: var(--app-icon-md)");
 
-    expect(chatStyles).toContain('[class$="-bubble-footer-actions-item"]');
-    expect(chatStyles).toContain("min-width: var(--app-icon-button)");
-    expect(chatStyles).toContain("width: var(--app-icon-md)");
-    expect(chatStyles).toContain("[data-spark-icon]");
+    expect(chatStyles).toContain(
+      '[class$="-bubble-footer-actions"] button:has(svg)',
+    );
+    expect(chatStyles).toMatch(
+      /-bubble-footer-actions[\s\S]*?font-size: var\(--app-icon-sm\) !important;[\s\S]*?width: var\(--app-icon-sm\);[\s\S]*?height: var\(--app-icon-sm\);/,
+    );
+    expect(chatSource).toMatch(
+      /import \{[\s\S]*?Copy,[\s\S]*?\} from "lucide-react"/,
+    );
+    expect(chatSource).toContain("<Copy />");
+    expect(chatSource).not.toContain("SparkCopyLine");
   });
 });
```

#### Recent Merged Pull Requests:
- **PR #8056** (closed): fix(config): surface config write failures with a clear message (@BeiMu-new)
- **PR #8049** (closed): fix(chats): resolve the process timezone per timestamp so naive Msg timestamps keep their instant across DST (@passionworkeer)
- **PR #8045** (closed): test again (@cuiyuebing)
- **PR #8044** (closed): test (@cuiyuebing)
- **PR #8043** (2026-09-30): fix(ci): change permission (@cuiyuebing)
- **PR #8041** (2026-09-30): fix(e2e): stop stalled session cleanup (@zhijianma)
- **PR #8039** (2026-09-30): fix(ci): correct first-time PR detection and add automatic size labels (@cuiyuebing)
- **PR #8038** (2026-09-30): fix(hub): close database connections after transactions (@zhijianma)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
