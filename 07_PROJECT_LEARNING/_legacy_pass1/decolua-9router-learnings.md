# Forensic Learning Record (Deep Inspection): decolua/9router

> **Canonical Artifact**: `07_PROJECT_LEARNING/decolua-9router-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/decolua/9router](https://github.com/decolua/9router))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:23:44.918Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `decolua/9router`
- **Description**: Unlimited FREE AI coding. Connect Claude Code, Codex, Cursor, Cline, Copilot, Antigravity to FREE Claude/GPT/Gemini via 40+ providers. Auto-fallback, RTK -40% tokens, never hit limits.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 30099 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/cli.js`
```
#!/usr/bin/env node

const { spawn, exec, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const net = require("net");
const os = require("os");

// Poll until the server accepts TCP connections on port, or timeout — avoids blind fixed waits.
function waitServerReady(port, { timeoutMs = 15000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tryConnect = () => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(tryConnect, intervalMs);
      });
    };
    tryConnect();
  });
}

// Native spinner - no external dependency
function createSpinner(text) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let interval = null;
  let currentText = text;
  return {
    start() {
      if (process.stdout.isTTY) {
        process.stdout.write(`\r${frames[0]} ${currentText}`);
        interval = setInterval(() => {
          process.stdout.write(`\r${frames[i++ % frames.length]} ${currentText}`);
        }, 80);
      }
      return this;
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (process.stdout.isTTY) {
        process.stdout.write("\r\x1b[K");
      }
    },
    succeed(msg) {
      this.stop();
      console.log(`✅ ${msg}`);
    },
    fail(msg) {
      this.stop();
      console.log(`❌ ${msg}`);
    }
  };
}

const pkg = require("./package.json");
const { ensureSqliteRuntime, buildEnvWithRuntime } = require("./hooks/sqliteRuntime");
const { ensureTrayRuntime } = require("./hooks/trayRuntime");
const args = process.argv.slice(2);

// Subcommands (`9router xai video …`) run against an already-running gateway
// and bypass the launcher flow (no runtime self-heal, no server spawn).
if (args[0] === "xai" && args[1] === "video") {
  const { run } = require("./src/cli/commands/xaiVideo");
  run(args.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`❌ ${err?.message || err}`);
      process.exit(1);
    });
  return;
}

// Self-heal SQLite runtime deps (sql.js + better-sqlite3) into ~/.9router/runtime
// so the server can resolve them via NODE_PATH. Best-effort — sql.js is required,
// better-sqlite3 is optional. Logs to stderr only on failure.
try { ensureSqliteRuntime({ silent: true }); } catch {}

// Self-heal tray runtime (systray for macOS/Linux only). Windows skipped.
try { ensureTrayRuntime({ silent: true }); } catch {}

// Configuration constants
const APP_NAME = pkg.name; // Use from package.json
const INSTALL_CMD_LATEST = `npm i -g ${APP_NAME}@latest --prefer-online`;

const DEFAULT_PORT = 20128;
const DEFAULT_HOST = "0.0.0.0";

// First non-internal IPv4 — the address remote peers actually reach when bound to 0.0.0.0.
function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return null;
}

// Local URL stays "localhost"; warn separately when bound to all interfaces (network-exposed).
function getDisplayHost() {
  return host === DEFAULT_HOST ? "localhost" : host;
}
const MAX_PORT_ATTEMPTS = 10;
// Identifiers for killAllAppProcesses - only kill 9router specifically
const PROCESS_IDENTIFIERS = [
  '9router'  // Only package name - avoid killing other apps
];

// Parse arguments
let port = DEFAULT_PORT;
let host = DEFAULT_HOST;
let noBrowser = false;
let skipUpdate = false;
let showLog = false;
let trayMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") {
    port = parseInt(args[i + 1], 10) || DEFAULT_PORT;
    i++;
  } else if (args[i] === "--host" || args[i] === "-H") {
    host = args[i + 1] || DEFAULT_HOST;
    i++;
  } else if (args[i] === "--no-browser" || args[i] === "-n") {
    noBrowser = true;
  } else if (args[i] === "--log" || args[i] === "-l") {
    showLog = true;
  } else if (args[i] === "--skip-update") {
    skipUpdate = true;
  } else if (args[i] === "--tray" || args[i] === "-t") {
    trayMode = true;
    process.env.TRAY_MODE = "1";
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Usage: ${APP_NAME} [options]

Options:
  -p, --port <port>   Port to run the server (default: ${DEFAULT_PORT})
  -H, --host <host>   Host to bind (default: ${DEFAULT_HOST})
  -n, --no-browser    Don't open browser automatically
  -l, --log           Show server logs (default: hidden)
  -t, --tray          Run in system tray mode (background)
  --skip-update       Skip auto-update check
  -h, --help          Show this help message
  -v, --version       Show version

Commands:
  xai video --prompt "..." --output video.mp4
                      Generate a Grok Imagine video via the running gateway
                      (see: ${APP_NAME} xai video --help)
`);
    process.exit(0);
  } else if (args[i] === "--version" || args[i] === "-v") {
    console.log(pkg.version);
    process.exit(0);
  }
}

// Auto-relaunch after update: detached process has no TTY → fallback to tray
if (skipUpdate && !trayMode && !process.stdin.isTTY) {
  trayMode = true;
  process.env.TRAY_MODE = "1";
}

// Always use Node.js runtime with absolute path
const RUNTIME = process.execPath;

// Compare semver versions: returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a, b) {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }
  return 0;
}

// Get app data dir (matches app/src/lib/dataDir.js convention)
function getAppDataDir() {
  return process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "9router")
    : path.join(os.homedir(), ".9router");
}

// Kill PID from file (best-effort, removes file after)
function killByPidFile(pidFile) {
  try {
    if (!fs.existsSync(pidFile)) return;
    const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    if (!pid) return;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", windowsHide: true, timeout: 3000 });
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch { }
    try { fs.unlinkSync(pidFile); } catch { }
  } catch { }
}

// Kill tunnel processes (cloudflared/tailscale) by their PID files
function killTunnelByPidFile() {
  const tunnelDir = path.join(getAppDataDir(), "tunnel");
  killByPidFile(path.join(tunnelDir, "cloudflared.pid"));
  killByPidFile(path.join(tunnelDir, "tailscale.pid"));
}

// Kill cloudflared whose --url targets this app's port (covers stale PID file case)
function killCloudflaredByAppPort(appPort) {
  if (!appPort) return [];
  const portMatchers = [`localhost:${appPort}`, `127.0.0.1:${appPort}`];
  const pids = [];
  try {
    if (process.platform === "win32") {
      const psCmd = `powershell -NonInteractive -WindowStyle Hidden -Command "Get-WmiObject Win32_Process -Filter 'Name=\\"cloudflared.exe\\"' | Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`;
      const output = execSync(psCmd, { encoding: "utf8", windowsHide: true, timeout: 5000 });
      const lines = output.split("\n").slice(1).filter(l => l.trim());
      lines.forEach(line => {
        if (portMatchers.some(m => line.includes(m))) {
          const match = line.match(/^"(\d+)"/);
          if (match && match[1]) pids.push(match[1]);
        }
      });
    } else {
      const output = execSync("ps -eo pid,command 2>/dev/null", { encoding: "utf8", timeout: 5000 });
      output.split("\n").forEach(line => {
        if (line.includes("
```

### Core Architecture Module: `cli/hooks/postinstall.js`
```
#!/usr/bin/env node

// Postinstall: warm-up SQLite deps into ~/.9router/runtime so the first
// `9router` start doesn't need network. Failure here is non-fatal —
// cli.js will retry at runtime if anything is missing.
const { ensureSqliteRuntime } = require("./sqliteRuntime");
const { ensureTrayRuntime } = require("./trayRuntime");

try {
  ensureSqliteRuntime({ silent: false });
  console.log("[9router] runtime SQLite deps ready");
} catch (e) {
  console.warn(`[9router] runtime warm-up skipped: ${e.message}`);
}

try {
  ensureTrayRuntime({ silent: false });
} catch (e) {
  console.warn(`[9router] tray runtime skipped: ${e.message}`);
}

process.exit(0);

```

### Core Architecture Module: `cli/hooks/sqliteRuntime.js`
```
// Ensure better-sqlite3 is installed in USER_DATA_DIR/runtime/node_modules
// (user-writable, avoids Windows EBUSY locks during npm i -g updates).
// sql.js is bundled in bin/app already; node:sqlite / bun:sqlite are built-in.
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Gate the pinned version by Node major, mirroring src/lib/db/driver.js gating
// style: 13.x is N-API and ships per-platform prebuilds inside the package, so
// it needs no ABI-specific download. It requires Node >= 22; older runtimes stay
// on 12.6.2, which fetches an ABI-specific binary via prebuild-install.
const [NODE_MAJOR] = process.versions.node.split(".").map(Number);
const USE_NAPI_BUILD = NODE_MAJOR >= 22;
const BETTER_SQLITE3_VERSION = USE_NAPI_BUILD ? "13.0.3" : "12.6.2";
const SQL_JS_VERSION = "1.14.1";

function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return process.platform === "win32"
    ? path.join(process.env.APPDATA || os.homedir(), "9router")
    : path.join(os.homedir(), ".9router");
}

function getRuntimeDir() {
  return path.join(getDataDir(), "runtime");
}

function getRuntimeNodeModules() {
  return path.join(getRuntimeDir(), "node_modules");
}

function ensureRuntimeDir() {
  const dir = getRuntimeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Minimal package.json so npm treats it as a project root
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: "9router-runtime",
      version: "1.0.0",
      private: true,
      description: "User-writable runtime deps for 9router (better-sqlite3 native binary)",
    }, null, 2));
  }
  return dir;
}

function hasModule(name) {
  return fs.existsSync(path.join(getRuntimeNodeModules(), name, "package.json"));
}

function isGlibcRuntime() {
  try { return Boolean(process.report?.getReport()?.header?.glibcVersionRuntime); } catch { return true; }
}

// 12.x compiles/downloads into build/Release; 13.x ships prebuilds/<platform>-<arch>.node.
function getBetterSqliteBinary() {
  const root = path.join(getRuntimeNodeModules(), "better-sqlite3");
  const platform = process.platform === "linux" && !isGlibcRuntime() ? "linuxmusl" : process.platform;
  return [
    path.join(root, "build", "Release", "better_sqlite3.node"),
    path.join(root, "prebuilds", `${platform}-${process.arch}.node`),
  ].find((file) => fs.existsSync(file));
}

function isBetterSqliteBinaryValid() {
  const binary = getBetterSqliteBinary();
  if (!binary) return false;
  try {
    const fd = fs.openSync(binary, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.toString("hex");
    if (process.platform === "linux") return magic.startsWith("7f454c46");
    if (process.platform === "darwin") return magic.startsWith("cffaedfe") || magic.startsWith("cefaedfe");
    if (process.platform === "win32") return magic.startsWith("4d5a");
    return true;
  } catch { return false; }
}

// Extract a short, user-friendly reason from npm stderr.
function summarizeNpmError(stderr = "") {
  const text = String(stderr);
  if (/ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|getaddrinfo/i.test(text)) return "No internet connection or registry unreachable";
  if (/EACCES|EPERM|permission denied/i.test(text)) return "Permission denied (check folder permissions)";
  if (/ENOSPC|no space/i.test(text)) return "Not enough disk space";
  if (/node-gyp|gyp ERR|python|MSBuild|Visual Studio|Xcode/i.test(text)) return "Missing build tools (Xcode CLT / Python / VS Build Tools)";
  if (/ETARGET|version.*not found/i.test(text)) return "Package version not found on registry";
  const m = text.match(/npm ERR! (.+)/);
  if (m) return m[1].slice(0, 200);
  const lastLine = text.trim().split(/\r?\n/).filter(Boolean).pop();
  return lastLine ? lastLine.slice(0, 200) : "Unknown error";
}

function runNpmInstall({ cwd, pkgs, extraArgs = [], timeout = 180000 }) {
  const args = ["install", ...pkgs, "--no-audit", "--no-fund", "--prefer-online", ...extraArgs];
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const res = spawnSync(npmCmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  return { ok: res.status === 0, code: res.status, stderr: res.stderr || "", stdout: res.stdout || "" };
}

function npmInstall(pkgs, opts = {}) {
  const cwd = ensureRuntimeDir();
  const extra = opts.optional ? ["--no-save"] : [];
  if (opts.ignoreScripts) extra.push("--ignore-scripts");
  if (!opts.silent) console.log("⏳ Installing SQLite engine (first run)...");
  const res = runNpmInstall({ cwd, pkgs, extraArgs: extra, timeout: opts.timeout || 180000 });
  if (!res.ok && !opts.silent) {
    const reason = summarizeNpmError(res.stderr);
    console.warn("⚠️  SQLite engine install failed — using fallback");
    console.warn(`   Reason: ${reason}`);
    console.warn(`   Retry:  cd "${cwd}" && npm install ${pkgs.join(" ")}`);
  }
  return res.ok;
}

// Public: ensure better-sqlite3 native module is installed in user-writable
// runtime dir. sql.js may be bundled in bin/app, but npm publish strips .wasm
// from nested node_modules — verify and reinstall if missing. node:sqlite is
// built-in. This is purely a *speed optimization* — app works without
// better-sqlite3 via fallbacks.
function isSqlJsWasmValid() {
  const bundledWasm = path.join(__dirname, "..", "app", "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  if (fs.existsSync(bundledWasm)) return true;
  const runtimeWasm = path.join(getRuntimeNodeModules(), "sql.js", "dist", "sql-wasm.wasm");
  return fs.existsSync(runtimeWasm);
}

function ensureSqliteRuntime({ silent = false } = {}) {
  ensureRuntimeDir();

  let sqlJsOk = isSqlJsWasmValid();
  if (!sqlJsOk) {
    sqlJsOk = npmInstall([`sql.js@${SQL_JS_VERSION}`], { silent });
    if (sqlJsOk) sqlJsOk = isSqlJsWasmValid();
  }

  const needBetterSqlite = !hasModule("better-sqlite3") || !isBetterSqliteBinaryValid();
  if (!needBetterSqlite) {
    if (!silent) console.log("✅ SQLite engine ready");
    return { betterSqlite: true, sqlJs: sqlJsOk };
  }

  // npm injects an implicit `node-gyp rebuild` for any package carrying a
  // binding.gyp, which would demand build tools even though 13.x already bundles
  // the binary — skip scripts so the bundled prebuild is used as-is.
  const ok = npmInstall([`better-sqlite3@${BETTER_SQLITE3_VERSION}`], { optional: true, silent, ignoreScripts: USE_NAPI_BUILD });
  return {
    betterSqlite: ok && hasModule("better-sqlite3") && isBetterSqliteBinaryValid(),
    sqlJs: sqlJsOk,
  };
}

// Inject runtime + bundled node_modules into NODE_PATH so child Node processes
// resolve sql.js (bundled in bin/app/node_modules) and better-sqlite3 (runtime).
function buildEnvWithRuntime(baseEnv = process.env) {
  const runtimeNm = getRuntimeNodeModules();
  const bundledNm = path.join(__dirname, "..", "app", "node_modules");
  const existing = baseEnv.NODE_PATH || "";
  const NODE_PATH = [runtimeNm, bundledNm, existing].filter(Boolean).join(path.delimiter);
  return { ...baseEnv, NODE_PATH };
}

module.exports = {
  ensureSqliteRuntime,
  buildEnvWithRuntime,
  getRuntimeDir,
  getRuntimeNodeModules,
  runNpmInstall,
  summarizeNpmError,
};

```

### Core Architecture Module: `cli/hooks/trayRuntime.js`
```
// Lazy install systray2 for macOS/Linux into USER_DATA_DIR/runtime/node_modules.
// Windows uses PowerShell NotifyIcon (no binary) → no systray needed.
// This keeps the published npm tarball free of unsigned Go binaries that
// trigger antivirus false positives (e.g. Kaspersky flagging tray_windows.exe).
//
// We use the maintained `systray2` fork. The original `systray@1.0.5` package
// bundles a 2017 x86_64 Go binary whose Mach-O headers are rejected by modern
// dyld (macOS 14+), so it fails to load at all.
//
// Note that systray2 is NOT an Apple Silicon fix: like its predecessor it ships
// only an x86_64 `tray_darwin_release`, and picks it by process.platform with no
// process.arch branch, so there is no native slice to select. On arm64 macOS the
// tray therefore needs Rosetta 2 and dies with EBADARCH without it. We overlay
// our own arm64 build of the same upstream source on top — see ensureArm64TrayBin.
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getRuntimeDir, getRuntimeNodeModules, runNpmInstall, summarizeNpmError } = require("./sqliteRuntime");

const SYSTRAY_PKG = "systray2";
const SYSTRAY_VERSION = "2.1.4";
const LEGACY_SYSTRAY_PKG = "systray";

// Pinned `tray-binaries` release rather than `latest`, so the URL is stable and
// the artifact can only change by a deliberate re-upload. The workflow's publish
// step re-derives this repo from the literal below and refuses to upload
// anywhere else, so the integrity gate can't drift from what clients fetch.
//
// The asset is built by .github/workflows/tray-binaries.yml on a macos-15 runner.
// cgo compiles AppKit against the runner's SDK, so this value tracks that image:
// when GitHub updates it the sha changes, the workflow refuses to publish, and
// this constant must be bumped in the same change as the re-upload.
const ARM64_TRAY_URL = "https://github.com/decolua/9router/releases/download/tray-binaries/tray_darwin_arm64";
const ARM64_TRAY_SHA256 = "487e3c365aaa1eb6ad295bf3989711e975b52cee07505bf641c8559954881c81";
const ARM64_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function hasSystray() {
  return fs.existsSync(path.join(getRuntimeNodeModules(), SYSTRAY_PKG, "package.json"));
}

// Remove the legacy `systray` package from all known locations.
// On Windows it was an AV false-positive risk; on macOS/Linux its bundled
// binary is broken on modern OS versions.
function cleanupLegacySystray({ silent = false } = {}) {
  // 1) Runtime dir: ~/.9router/runtime/node_modules/systray (or %APPDATA% on Win)
  // 2) npm global nested: <npm_prefix>/node_modules/9router/node_modules/systray
  //    __dirname here = <pkg root>/hooks → up 1 = pkg root
  const targets = [
    path.join(getRuntimeNodeModules(), LEGACY_SYSTRAY_PKG),
    path.join(__dirname, "..", "node_modules", LEGACY_SYSTRAY_PKG)
  ];
  for (const dir of targets) {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        if (!silent) console.log(`[9router][runtime] removed legacy systray: ${dir}`);
      } catch (e) {
        if (!silent) console.warn(`[9router][runtime] failed to remove ${dir}: ${e.message}`);
      }
    }
  }
}

// systray2's npm tarball sometimes ships the bundled Go binary without the
// executable bit set on macOS, causing spawn() to fail with EACCES. Set +x
// best-effort so the tray actually starts.
function chmodSystrayBin({ silent = false } = {}) {
  if (process.platform === "win32") return;
  const binName = process.platform === "darwin" ? "tray_darwin_release" : "tray_linux_release";
  const binPath = path.join(getRuntimeNodeModules(), SYSTRAY_PKG, "traybin", binName);
  if (!fs.existsSync(binPath)) return;
  try {
    fs.chmodSync(binPath, 0o755);
  } catch (e) {
    if (!silent) console.warn(`[9router][runtime] chmod tray bin failed: ${e.message}`);
  }
}

function ensureRuntimeDir() {
  const dir = getRuntimeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: "9router-runtime",
      version: "1.0.0",
      private: true
    }, null, 2));
  }
  return dir;
}

// A thin (non-fat) 64-bit Mach-O stores its magic then cputype, both LE.
// CPU_TYPE_ARM64 is CPU_TYPE_ARM | CPU_ARCH_ABI64. Fat/universal binaries use a
// different magic and are reported as "not arm64" here, which is fine: we only
// ever overlay a thin arm64 build and only need to tell it apart from x86_64.
function isArm64MachO(file) {
  let fd = null;
  try {
    fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    if (buf.readUInt32LE(0) !== 0xfeedfacf) return false;
    return buf.readUInt32LE(4) === 0x0100000c;
  } catch {
    return false;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch {}
  }
}

// systray2 is constructed with copyDir:true, so what actually executes is
// ~/.cache/node-systray/<version>/tray_darwin_release, and index.js only re-copies
// when that path is absent. An overlaid binary stays invisible until this is cleared.
// Scoped to our systray2 version: the parent dir is machine-global and shared
// with any other node-systray consumer.
function bustSystrayCopyCache() {
  try {
    fs.rmSync(path.join(os.homedir(), ".cache", "node-systray", SYSTRAY_VERSION), { recursive: true, force: true });
  } catch {}
}

function arm64AttemptMarker() {
  return path.join(getRuntimeDir(), ".tray-arm64-attempt");
}

// ensureTrayRuntime runs synchronously on every `9router` start (cli.js), so a
// failed download must not re-block the next launch. Retry at most daily.
function recentlyAttemptedArm64() {
  try {
    const at = Number(fs.readFileSync(arm64AttemptMarker(), "utf8").trim());
    return Number.isFinite(at) && Date.now() - at < ARM64_RETRY_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markArm64Attempt() {
  try { fs.writeFileSync(arm64AttemptMarker(), String(Date.now())); } catch {}
}

// Cleared on success so the cooldown only ever throttles *failures*. Without
// this, anything that restores systray2's x86_64 binary later — notably a
// globally installed 9router older than this change, which shares the same
// ~/.9router/runtime — would leave the user waiting out the cooldown.
function clearArm64Attempt() {
  try { fs.rmSync(arm64AttemptMarker(), { force: true }); } catch {}
}

// Throws on any failure so the caller has a single error path.
function downloadFile(url, dest, timeoutSec) {
  // darwin-only path, and curl ships with macOS, so this needs no extra dep and
  // keeps the caller synchronous.
  const res = spawnSync("curl", ["-fsSL", "--max-time", String(timeoutSec), "-o", dest, url], {
    encoding: "utf8",
    timeout: (timeoutSec + 5) * 1000
  });
  if (res.status === 0 && fs.existsSync(dest)) return;
  const detail = (res.stderr || res.error?.message || `curl exit ${res.status}`).trim().split("\n").pop();
  throw new Error(detail || "download failed");
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Replace systray2's x86_64 macOS binary with a native arm64 build so Apple
// Silicon users get a tray without installing Rosetta 2. Any failure leaves the
// Intel binary untouched, which still works under Rosetta.
//
// Takes no `silent` flag on purpose: cli.js calls ensureTrayRuntime({silent:true})
// synchronously on every start, and a stalled curl would otherwise freeze the
// launch for up to 30s with no output at all. These lines print at most once per
// 24h on failure and once ever on success, so they are worth more than the quiet.
function ensureArm64TrayBin() {
  if (process.platform !== "darwin" || process.arch !== "arm64") return { skipped: true };

  const binPath = path.join(getRuntimeNodeModules(), SYSTRAY_PK
```

### Core Architecture Module: `cli/src/cli/api/client.js`
```
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { machineIdSync } = require("node-machine-id");

// Default configuration
const DEFAULT_CONFIG = {
  host: "localhost",
  port: 20128,
  protocol: "http:",
};

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";
const APP_NAME = "9router";

function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), APP_NAME);
  }
  return path.join(os.homedir(), `.${APP_NAME}`);
}

const MACHINE_ID_FILE = path.join(getDataDir(), "machine-id");
const AUTH_DIR = path.join(getDataDir(), "auth");
const CLI_SECRET_FILE = path.join(AUTH_DIR, "cli-secret");

let config = { ...DEFAULT_CONFIG };
let cachedCliToken = null;
let cachedCliSecret = null;

// Read raw machineId from shared file (written by server) → guarantees token match
function loadRawMachineId() {
  try {
    const raw = fs.readFileSync(MACHINE_ID_FILE, "utf8").trim();
    if (raw) return raw;
  } catch {}
  try { return machineIdSync(); } catch { return ""; }
}

// Random secret shared with server via file → token unpredictable from machineId alone.
function loadCliSecret() {
  if (cachedCliSecret) return cachedCliSecret;
  try {
    cachedCliSecret = fs.readFileSync(CLI_SECRET_FILE, "utf8").trim();
    if (cachedCliSecret) return cachedCliSecret;
  } catch {}
  cachedCliSecret = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    fs.writeFileSync(CLI_SECRET_FILE, cachedCliSecret, { mode: 0o600 });
  } catch {}
  return cachedCliSecret;
}

function getCliToken() {
  if (cachedCliToken !== null) return cachedCliToken;
  const raw = loadRawMachineId();
  const secret = loadCliSecret();
  cachedCliToken = raw ? crypto.createHash("sha256").update(raw + CLI_TOKEN_SALT + secret).digest("hex").substring(0, 16) : "";
  return cachedCliToken;
}

/**
 * Configure API client
 * @param {Object} options - Configuration options
 * @param {string} options.host - API host
 * @param {number} options.port - API port
 * @param {string} options.protocol - Protocol (http: or https:)
 */
function configure(options = {}) {
  config = { ...config, ...options };
}

/**
 * Make HTTP request to API
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} body - Request body (optional)
 * @returns {Promise<Object>} Response with { success, data/error }
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const httpModule = config.protocol === "https:" ? https : http;
    
    const options = {
      hostname: config.host,
      port: config.port,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        [CLI_TOKEN_HEADER]: getCliToken(),
      },
    };

    // Add Content-Length for POST/PUT requests
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      const bodyString = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyString);
    }

    const req = httpModule.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          
          // Check if response indicates error
          if (res.statusCode >= 400 || parsed.error) {
            resolve({
              success: false,
              error: parsed.error || `HTTP ${res.statusCode}`,
              statusCode: res.statusCode,
            });
          } else {
            resolve({
              success: true,
              data: parsed,
              statusCode: res.statusCode,
            });
          }
        } catch (err) {
          resolve({
            success: false,
            error: `Failed to parse response: ${err.message}`,
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        success: false,
        error: `Network error: ${err.message}`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: "Request timeout",
      });
    });

    // Set timeout (30 seconds)
    req.setTimeout(30000);

    // Write body if present
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================================================
// PROVIDERS API
// ============================================================================

/**
 * Get all providers
 * @returns {Promise<Object>} { success, data: { connections } }
 */
async function getProviders() {
  return makeRequest("GET", "/api/providers");
}

/**
 * Get provider by ID
 * @param {string} id - Provider ID
 * @returns {Promise<Object>} { success, data: { connection } }
 */
async function getProviderById(id) {
  return makeRequest("GET", `/api/providers/${id}`);
}

/**
 * Test provider connection
 * @param {string} id - Provider ID
 * @returns {Promise<Object>} { success, data: { valid, error } }
 */
async function testProvider(id) {
  return makeRequest("POST", `/api/providers/${id}/test`);
}

/**
 * Delete provider
 * @param {string} id - Provider ID
 * @returns {Promise<Object>} { success, data: { message } }
 */
async function deleteProvider(id) {
  return makeRequest("DELETE", `/api/providers/${id}`);
}

/**
 * Get provider models
 * @param {string} id - Provider ID
 * @returns {Promise<Object>} { success, data: { provider, connectionId, models } }
 */
async function getProviderModels(id) {
  return makeRequest("GET", `/api/providers/${id}/models`);
}

// ============================================================================
// OAUTH API
// ============================================================================

/**
 * Get OAuth authorization URL
 * @param {string} provider - Provider ID
 * @returns {Promise<Object>} { success, data: { authUrl, codeVerifier, state, redirectUri } }
 */
async function getOAuthAuthUrl(provider) {
  // Codex requires fixed port 1455 and path /auth/callback
  const redirectUri = provider === "codex" 
    ? "http://localhost:1455/auth/callback"
    : "http://localhost:20128/callback";
  return makeRequest("GET", `/api/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`);
}

/**
 * Exchange OAuth authorization code for token
 * @param {string} provider - Provider ID
 * @param {Object} data - { code, redirectUri, codeVerifier, state }
 * @returns {Promise<Object>} { success, data }
 */
async function exchangeOAuthCode(provider, data) {
  return makeRequest("POST", `/api/oauth/${provider}/exchange`, data);
}

/**
 * Get OAuth device code
 * @param {string} provider - Provider ID
 * @returns {Promise<Object>} { success, data: { device_code, user_code, verification_uri, verification_uri_complete, codeVerifier, extraData } }
 */
async function getOAuthDeviceCode(provider) {
  return makeRequest("GET", `/api/oauth/${provider}/device-code`);
}

/**
 * Poll OAuth token using device code
 * @param {string} provider - Provider ID
 * @param {Object} data - { deviceCode, codeVerifier, extraData }
 * @returns {Promise<Object>} { success, data: { pending } }
 */
async function pollOAuthToken(provider, data) {
  return makeRequest("POST", `/api/oauth/${provider}/poll`, data);
}

/**
 * Create API key provider connection
 * @param {Object} data - { provider, name, apiKey }
 * @returns {Promise<Object>} { success, data }
 */
async function createApiKeyProvider(data) {
  return makeRequest("POST", "/api/providers", data);
}

/**
 * Update provider connection
 * @par
```

### Core Architecture Module: `cli/src/cli/commands/xaiVideo.js`
```
/**
 * `9router xai video` — generate a Grok Imagine video through the local
 * 9router gateway and save the result as an MP4 file.
 *
 * Flow: POST /v1/videos/generations → poll GET /v1/videos/{request_id}
 * until done/failed/timeout → download video.url → atomic rename.
 *
 * No OAuth tokens or Authorization headers are ever printed.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const DEFAULT_PORT = 20128;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_MODEL = "xai/grok-imagine-video";
const DEFAULT_TIMEOUT_SEC = 600;
const DEFAULT_POLL_INTERVAL_MS = 5000;

const TERMINAL_STATUSES = new Set(["done", "failed", "completed", "error", "expired", "cancelled"]);
const FAILED_STATUSES = new Set(["failed", "error", "expired", "cancelled"]);

const HELP = `
Usage: 9router xai video --prompt "..." [options]

Generate a Grok Imagine video via your local 9router gateway
(requires a connected xAI account — Grok Build OAuth or API key).

Options:
  --prompt <text>         Video description (required)
  --output <file>         Output MP4 path (default: video.mp4)
  --model <id>            Model (default: ${DEFAULT_MODEL})
  --duration <seconds>    Video duration
  --aspect-ratio <ratio>  e.g. 16:9, 9:16, 1:1
  --resolution <res>      480p | 720p | 1080p
  --image <path-or-url>   Image input for image-to-video
  --timeout <seconds>     Max wait for the job (default: ${DEFAULT_TIMEOUT_SEC})
  --port <port>           Gateway port (default: ${DEFAULT_PORT})
  --host <host>           Gateway host (default: ${DEFAULT_HOST})
  --api-key <key>         9router API key (or env NINE_ROUTER_API_KEY)
  -h, --help              Show this help
`;

function sanitizeText(text) {
  return String(text ?? "").replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]");
}

function parseArgs(argv) {
  const opts = {
    model: DEFAULT_MODEL,
    output: "video.mp4",
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
    apiKey: process.env.NINE_ROUTER_API_KEY || null,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--prompt") opts.prompt = next();
    else if (a === "--output" || a === "-o") opts.output = next();
    else if (a === "--model") opts.model = next();
    else if (a === "--duration") opts.duration = parseInt(next(), 10);
    else if (a === "--aspect-ratio") opts.aspectRatio = next();
    else if (a === "--resolution") opts.resolution = next();
    else if (a === "--image") opts.image = next();
    else if (a === "--timeout") opts.timeoutSec = parseInt(next(), 10) || DEFAULT_TIMEOUT_SEC;
    else if (a === "--port" || a === "-p") opts.port = parseInt(next(), 10) || DEFAULT_PORT;
    else if (a === "--host" || a === "-H") opts.host = next() || DEFAULT_HOST;
    else if (a === "--api-key") opts.apiKey = next();
    else if (a === "--poll-interval-ms") opts.pollIntervalMs = parseInt(next(), 10) || DEFAULT_POLL_INTERVAL_MS;
    else if (a === "-h" || a === "--help") opts.help = true;
    else {
      throw new Error(`Unknown option: ${a}`);
    }
  }
  return opts;
}

/** Local file path → base64 data URL; URLs pass through untouched. */
function imageInputToUrl(input) {
  if (/^(https?:|data:)/i.test(input)) return input;
  const buf = fs.readFileSync(input);
  const ext = path.extname(input).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/** Minimal JSON request against the local gateway. Returns { status, headers, body }. */
function gatewayRequest({ host, port, apiKey, method, reqPath, body, signal }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Accept: "application/json" };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const req = http.request({ hostname: host, port, path: reqPath, method, headers, signal }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { /* keep raw */ }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener?.("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
  });

/**
 * Poll GET /v1/videos/{id} until a terminal status or deadline.
 * @returns {Promise<object>} final poll body (status done) — throws on failed/timeout.
 */
async function pollUntilDone({ host, port, apiKey, requestId, connectionId, timeoutSec, pollIntervalMs, signal, onProgress }) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (true) {
    if (signal?.aborted) throw new Error("aborted");
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutSec}s waiting for video job ${requestId}`);
    }

    const res = await gatewayRequestWithConnection({ host, port, apiKey, requestId, connectionId, signal });
    if (res.status === 200 && res.body) {
      const status = String(res.body.status || "").toLowerCase();
      onProgress?.(status || "pending", res.body.progress);
      if (FAILED_STATUSES.has(status)) {
        const msg = res.body.error?.message || res.body.error || "video generation failed";
        throw new Error(`Job ${requestId} failed: ${sanitizeText(typeof msg === "string" ? msg : JSON.stringify(msg))}`);
      }
      if (TERMINAL_STATUSES.has(status)) return res.body;
    } else if (res.status >= 400 && res.status !== 429 && res.status !== 503) {
      throw new Error(`Polling failed (HTTP ${res.status}): ${sanitizeText(res.raw?.slice(0, 300))}`);
    }
    await sleep(pollIntervalMs, signal);
  }
}

function gatewayRequestWithConnection({ host, port, apiKey, requestId, connectionId, signal }) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (connectionId) headers["x-connection-id"] = connectionId;
    const req = http.request(
      { hostname: host, port, path: `/v1/videos/${encodeURIComponent(requestId)}`, method: "GET", headers, signal },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed = null;
          try { parsed = data ? JSON.parse(data) : null; } catch { /* keep raw */ }
          resolve({ status: res.statusCode, body: parsed, raw: data });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Download a URL to `outputPath` via a `.part` temp file with atomic rename.
 * The temp file is removed on any failure.
 */
async function downloadToFile(url, outputPath, { signal } = {}) {
  const partPath = `${outputPath}.part`;
  await new Promise((resolve, reject) => {
    const cleanupAnd = (fn) => (err) => {
      try { fs.unlinkSync(partPath); } catch { /* not created yet */ }
      fn(err);
    };
    const get = (target, redirectsLeft) => {
      const mod = target.startsWith("https:") ? https : http;
      const req = mod.get(target, { signal }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          return get(new URL(res.headers.location, target).toString(), redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return cl
```

### Core Architecture Module: `cli/src/cli/menus/apiKeys.js`
```
const api = require("../api/client");
const { prompt, confirm, pause } = require("../utils/input");
const { clearScreen, showStatus, showHeader } = require("../utils/display");
const { maskKey, formatDate, getRelativeTime } = require("../utils/format");
const { showMenuWithBack } = require("../utils/menuHelper");
const { copyToClipboard } = require("../utils/clipboard");
const { getEndpoint } = require("../utils/endpoint");

/**
 * Display API keys list with formatted output
 * @param {Array} keys - Array of API key objects
 * @param {number} port - Server port
 */
function displayApiKeys(keys, port) {
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│  🔑 API Keys Management                                 │");
  console.log("├─────────────────────────────────────────────────────────┤");
  // Note: This function is legacy, endpoint shown in menu header instead
  console.log("│                                                          │");
  
  if (keys.length === 0) {
    console.log("│  No API keys found.                                     │");
  } else {
    console.log(`│  Your API Keys (${keys.length}):${" ".repeat(42 - String(keys.length).length)}│`);
    
    keys.forEach((key, index) => {
      console.log("│                                                          │");
      console.log(`│  ${index + 1}. ${key.name}${" ".repeat(52 - String(index + 1).length - key.name.length)}│`);
      
      const maskedKey = maskKey(key.key);
      console.log(`│     Key: ${maskedKey}${" ".repeat(47 - maskedKey.length)}│`);
      
      const created = formatDate(key.createdAt);
      console.log(`│     Created: ${created}${" ".repeat(43 - created.length)}│`);
      
      if (key.lastUsedAt) {
        const lastUsed = getRelativeTime(key.lastUsedAt);
        console.log(`│     Last used: ${lastUsed}${" ".repeat(41 - lastUsed.length)}│`);
      } else {
        console.log("│     Last used: Never                                    │");
      }
    });
  }
  
  console.log("│                                                          │");
  console.log("│  Actions:                                               │");
  console.log("│  1. Create New API Key                                  │");
  console.log("│  2. View Full Key (by number)                           │");
  console.log("│  3. Copy Key to Clipboard (by number)                   │");
  console.log("│  4. Delete Key (by number)                              │");
  console.log("│  0. ← Back to Main Menu                                 │");
  console.log("└─────────────────────────────────────────────────────────┘");
}

/**
 * Handle creating new API key
 * @returns {Promise<boolean>} Success status
 */
async function handleCreateKey() {
  console.log("\n📝 Create New API Key");
  console.log("─".repeat(30));
  
  const name = await prompt("Enter key name: ");
  
  if (!name) {
    showStatus("Key name cannot be empty", "error");
    await pause();
    return false;
  }
  
  const result = await api.createApiKey(name);
  
  if (!result.success) {
    showStatus(`Failed to create key: ${result.error}`, "error");
    await pause();
    return false;
  }
  
  console.log("\n✅ API Key created successfully!");
  console.log("\n⚠️  IMPORTANT: Save this key now. You won't be able to see it again!");
  console.log(`\nKey: ${result.data.key}`);
  console.log(`Name: ${result.data.name}`);
  console.log(`ID: ${result.data.id}`);
  
  const shouldCopy = await confirm("\nCopy key to clipboard?");
  if (shouldCopy) {
    if (copyToClipboard(result.data.key)) {
      showStatus("Key copied to clipboard!", "success");
    } else {
      showStatus("Failed to copy to clipboard", "error");
    }
  }
  
  await pause();
  return true;
}

/**
 * Handle viewing full API key
 * @param {Object} key - API key object
 */
async function handleViewFullKey(key) {
  console.log("\n🔍 Full API Key");
  console.log("─".repeat(30));
  console.log(`Name: ${key.name}`);
  console.log(`Key: ${key.key}`);
  console.log(`ID: ${key.id}`);
  console.log(`Created: ${formatDate(key.createdAt)}`);
  
  if (key.lastUsedAt) {
    console.log(`Last used: ${getRelativeTime(key.lastUsedAt)}`);
  } else {
    console.log("Last used: Never");
  }
  
  await pause();
}

/**
 * Handle copying API key to clipboard
 * @param {Object} key - API key object
 */
async function handleCopyKey(key) {
  if (copyToClipboard(key.key)) {
    showStatus(`Key "${key.name}" copied to clipboard!`, "success");
  } else {
    showStatus("Failed to copy to clipboard", "error");
  }
  await pause();
}

/**
 * Handle deleting API key
 * @param {Object} key - API key object
 * @returns {Promise<boolean>} Success status
 */
async function handleDeleteKey(key) {
  console.log(`\n⚠️  Delete API Key: ${key.name}`);
  console.log("─".repeat(30));
  console.log(`Key: ${maskKey(key.key)}`);
  console.log(`Created: ${formatDate(key.createdAt)}`);
  
  const confirmed = await confirm("\nAre you sure you want to delete this key?");
  
  if (!confirmed) {
    showStatus("Deletion cancelled", "info");
    await pause();
    return false;
  }
  
  const result = await api.deleteApiKey(key.id);
  
  if (!result.success) {
    showStatus(`Failed to delete key: ${result.error}`, "error");
    await pause();
    return false;
  }
  
  showStatus("API key deleted successfully", "success");
  await pause();
  return true;
}

/**
 * Show actions for a specific key
 * @param {Object} key - API key object
 * @param {number} port - Server port
 * @param {Array<string>} breadcrumb - Breadcrumb path
 */
async function showKeyActions(key, port, breadcrumb = []) {
  const { endpoint } = await getEndpoint(port);
  await showMenuWithBack({
    title: `🔑 ${key.name}`,
    breadcrumb: [...breadcrumb, key.name],
    headerContent: `Name: ${key.name}\nKey: ${key.key}\nEndpoint: ${endpoint}`,
    items: [
      {
        label: "Copy to Clipboard",
        action: async () => {
          await handleCopyKey(key);
          return true;
        }
      },
      {
        label: "Delete Key",
        action: async () => {
          await handleDeleteKey(key);
          return false; // Exit after delete
        }
      }
    ]
  });
}

/**
 * Main API Keys menu
 * @param {number} port - Server port number
 * @param {Array<string>} breadcrumb - Breadcrumb path
 */
async function showApiKeysMenu(port, breadcrumb = []) {
  const { showListMenu } = require("../utils/menuHelper");
  
  const { endpoint } = await getEndpoint(port);
  await showListMenu({
    title: "🔑 API Keys Management",
    breadcrumb,
    headerContent: `Endpoint: ${endpoint}`,
    fetchItems: async () => {
      const result = await api.getApiKeys();
      if (!result.success) {
        clearScreen();
        showStatus(`Failed to fetch API keys: ${result.error}`, "error");
        await pause();
        return null;
      }
      return { items: result.data.keys || [] };
    },
    formatItem: (key) => `${key.name} (${maskKey(key.key)})`,
    onSelect: async (key) => {
      await showKeyActions(key, port, breadcrumb);
    },
    createAction: {
      label: "Create New API Key",
      action: async () => {
        await handleCreateKey();
      }
    }
  });
}

module.exports = {
  showApiKeysMenu
};

```

### Core Architecture Module: `cli/src/cli/menus/cliTools.js`
```
const api = require("../api/client");
const { pause, confirm } = require("../utils/input");
const { showStatus } = require("../utils/display");
const { selectModelFromList } = require("../utils/modelSelector");
const { showMenuWithBack } = require("../utils/menuHelper");
const { getEndpoint } = require("../utils/endpoint");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m"
};

// Claude model types with defaults (matching Web UI)
const CLAUDE_MODEL_TYPES = [
  { id: "sonnet", name: "Sonnet", envKey: "ANTHROPIC_DEFAULT_SONNET_MODEL", defaultValue: "cc/claude-sonnet-4-5-20250929" },
  { id: "opus",   name: "Opus",   envKey: "ANTHROPIC_DEFAULT_OPUS_MODEL",   defaultValue: "cc/claude-opus-4-5-20251101" },
  { id: "haiku",  name: "Haiku",  envKey: "ANTHROPIC_DEFAULT_HAIKU_MODEL",  defaultValue: "cc/claude-haiku-4-5-20251001" },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Get first available API key from server
 * @returns {Promise<string|null>}
 */
async function getFirstApiKey() {
  const result = await api.getApiKeys();
  const keys = result.success ? (result.data.keys || []) : [];
  return keys.length > 0 ? keys[0].key : null;
}

// ─── Claude Code ──────────────────────────────────────────────────────────────

/**
 * Build header showing current Claude config status
 * @returns {Promise<string>}
 */
async function buildClaudeHeader() {
  const result = await api.getCliToolSettings("claude");
  if (!result.success) return `  ${COLORS.red}Failed to load settings${COLORS.reset}`;

  const settings = result.data.settings;
  const currentUrl = settings?.env?.ANTHROPIC_BASE_URL;
  const currentKey = settings?.env?.ANTHROPIC_AUTH_TOKEN;
  const lines = [];

  if (currentUrl) {
    lines.push(`Status:   ${COLORS.green}✓ Configured${COLORS.reset}`);
    lines.push(`Endpoint: ${COLORS.cyan}${currentUrl}${COLORS.reset}`);
    if (currentKey) {
      lines.push(`API Key:  ${COLORS.dim}${currentKey.substring(0, 10)}...${COLORS.reset}`);
    }
  } else {
    lines.push(`Status:   ${COLORS.red}✗ Not configured${COLORS.reset}`);
    lines.push(`${COLORS.dim}Run "Quick Setup" to configure${COLORS.reset}`);
  }

  return lines.join("\n");
}

/**
 * Get current Claude model from settings
 * @param {string} envKey
 * @returns {Promise<string>}
 */
async function getClaudeModel(envKey) {
  const result = await api.getCliToolSettings("claude");
  return result.success ? (result.data.settings?.env?.[envKey] || "Not set") : "Not set";
}

/**
 * Quick setup for Claude Code — sets endpoint, key, and all default models
 * @param {number} port
 */
async function claudeQuickSetup(port) {
  const { endpoint } = await getEndpoint(port);
  const apiKey = await getFirstApiKey();

  if (!apiKey) {
    showStatus("No API keys found. Create one in API Keys menu first.", "error");
    await pause();
    return;
  }

  const env = { ANTHROPIC_BASE_URL: endpoint, ANTHROPIC_AUTH_TOKEN: apiKey, API_TIMEOUT_MS: "600000" };
  CLAUDE_MODEL_TYPES.forEach(t => { env[t.envKey] = t.defaultValue; });

  const result = await api.applyCliToolSettings("claude", { env });
  showStatus(result.success ? "Quick Setup completed!" : `Failed: ${result.error}`, result.success ? "success" : "error");
  await pause();
}

/**
 * Select and save a specific Claude model type
 * @param {Object} modelType
 * @param {number} port
 */
async function claudeSelectModel(modelType, port) {
  const current = await getClaudeModel(modelType.envKey);
  const selected = await selectModelFromList(`Select ${modelType.name} Model`, current, { excludeCombos: true });
  if (!selected) return;

  const env = { [modelType.envKey]: selected };

  // Also set base URL if not configured yet
  const settingsResult = await api.getCliToolSettings("claude");
  if (!settingsResult.data?.settings?.env?.ANTHROPIC_BASE_URL) {
    const { endpoint } = await getEndpoint(port);
    const apiKey = await getFirstApiKey();
    env.ANTHROPIC_BASE_URL = endpoint;
    env.API_TIMEOUT_MS = "600000";
    if (apiKey) env.ANTHROPIC_AUTH_TOKEN = apiKey;
  }

  const result = await api.applyCliToolSettings("claude", { env });
  showStatus(result.success ? `${modelType.name} → ${selected} saved!` : `Failed: ${result.error}`, result.success ? "success" : "error");
  await pause();
}

/**
 * Reset Claude Code settings
 */
async function claudeReset() {
  const result = await api.resetCliToolSettings("claude");
  showStatus(result.success ? "Settings reset successfully!" : `Failed: ${result.error}`, result.success ? "success" : "error");
  await pause();
}

/**
 * Claude Code submenu
 * @param {number} port
 * @param {Array<string>} breadcrumb
 */
async function showClaudeCodeMenu(port, breadcrumb = []) {
  await showMenuWithBack({
    title: "🔧 Claude Code Settings",
    breadcrumb,
    headerContent: buildClaudeHeader,
    refresh: async () => ({
      sonnet: await getClaudeModel("ANTHROPIC_DEFAULT_SONNET_MODEL"),
      opus:   await getClaudeModel("ANTHROPIC_DEFAULT_OPUS_MODEL"),
      haiku:  await getClaudeModel("ANTHROPIC_DEFAULT_HAIKU_MODEL"),
    }),
    items: [
      {
        label: "⚡ Quick Setup (recommended)",
        action: async () => { await claudeQuickSetup(port); return true; }
      },
      {
        label: (d) => `Sonnet → ${d.sonnet}`,
        action: async () => { await claudeSelectModel(CLAUDE_MODEL_TYPES[0], port); return true; }
      },
      {
        label: (d) => `Opus → ${d.opus}`,
        action: async () => { await claudeSelectModel(CLAUDE_MODEL_TYPES[1], port); return true; }
      },
      {
        label: (d) => `Haiku → ${d.haiku}`,
        action: async () => { await claudeSelectModel(CLAUDE_MODEL_TYPES[2], port); return true; }
      },
      {
        label: "Reset to Default",
        action: async () => { await claudeReset(); return true; }
      }
    ]
  });
}

// ─── Codex CLI ────────────────────────────────────────────────────────────────

/**
 * Build header showing current Codex config status
 * @returns {Promise<string>}
 */
async function buildCodexHeader() {
  const result = await api.getCliToolSettings("codex");
  if (!result.success) return `  ${COLORS.red}Failed to load settings${COLORS.reset}`;

  const { installed, has9Router, config } = result.data;
  if (!installed) return `Status:   ${COLORS.red}✗ Codex CLI not installed${COLORS.reset}`;

  if (!has9Router) {
    return [
      `Status:   ${COLORS.red}✗ Not configured${COLORS.reset}`,
      `${COLORS.dim}Run "Quick Setup" to configure${COLORS.reset}`
    ].join("\n");
  }

  // Parse base_url and model from raw TOML string
  const baseUrlMatch = config && config.match(/base_url\s*=\s*"([^"]+)"/);
  const modelMatch = config && config.match(/^model\s*=\s*"([^"]+)"/m);
  const baseUrl = baseUrlMatch ? baseUrlMatch[1] : "";
  const model = modelMatch ? modelMatch[1] : "";

  const lines = [`Status:   ${COLORS.green}✓ Configured${COLORS.reset}`];
  if (baseUrl) lines.push(`Endpoint: ${COLORS.cyan}${baseUrl}${COLORS.reset}`);
  if (model)   lines.push(`Model:    ${COLORS.dim}${model}${COLORS.reset}`);
  return lines.join("\n");
}

/**
 * Quick setup for Codex CLI
 * @param {number} port
 */
async function codexQuickSetup(port) {
  const { endpoint } = await getEndpoint(port);
  const apiKey = await getFirstApiKey();

  if (!apiKey) {
    showStatus("No API keys found. Create one in API Keys menu first.", "error");
    await pause();
    return;
  }

  // Get model selection
  const model = await selectModelFromList("Select Codex Model", "cx/claude-sonnet-4-5-20250929", { excludeCombos: true });
  if (!model) return;

  const result = await api.applyCliToolSettings("codex", { baseUrl: endpoint, apiKey, model });
  showStatus(result.success ? "Codex setup completed!" : `Failed: ${result.error}`, result.success ? "success" : "error");
  await pause();
}

/**
 * Reset Codex CLI settings
 */
async function codexReset() {
  const result = await ap
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4493** (2026-09-30): **Feat/design system dashboard shell**
  *Symptoms*: This pull request adds a comprehensive design specification for the JRouter project to the `docs/DESIGN.md` file. The new documentation details the project's visual language, including its color palette, typography, layout principles, elevation and depth cues, standardized shapes, and component styles. It also provides clear guidelines on design do's and don'ts, ensuring UI consistency and an engineering-focused aesthetic across the application.  Key additions in the design documentation:  **Design Tokens and Visual System** - Introduces a full set of design tokens for colors, typography, spacing, and border radii, establishing a consistent visual language for the project.  **Component Style Guidelines** - Defines standardized styles for core UI components such as buttons, cards, badges, tags, modals, and activity logs, including their states and variants.  **Layout and Structure** - Specifies container widths, grid systems, section framing, and spacing scales to ensure responsive and dense information presentation.  **Elevation, Depth, and Shape System** - Details the use of hairline borders, inset highlights, and a tiered corner radius system to convey depth and structure without decorative shadows.  **Best Practices and Anti-Patterns** - Outlines clear do's and don'ts for visual consistency, accessibility, and technical clarity, such as using tabular

- **Issue #4480** (2026-09-30): **stream: true responses emit the `data: [DONE]` sentinel twice**
  *Symptoms*: # `stream: true` responses emit the `data: [DONE]` sentinel twice  ## Summary  On `POST /v1/chat/completions` with `"stream": true`, 9router closes the SSE response with **two** `data: [DONE]` frames instead of one. The final `chat.completion.chunk` (with `finish_reason: "stop"`) and the full `usage` object are correct; only the terminator is duplicated.  This is the mirror image of #4356 and #4461, which report the sentinel going **missing**. Here it is emitted one time too many.  ## Environment  - 9router `0.5.91` (latest — `/api/version` reports `currentVersion: 0.5.91`, `hasUpdate: false`) - Endpoint: `POST /v1/chat/completions` - Base URL: `http://localhost:20128/v1` - OS: Android (Termux), self-hosted  ## Reproduction  ```bash curl -sN http://localhost:20128/v1/chat/completions \   -H "Authorization: Bearer <REDACTED>" \   -H "Content-Type: application/json" \   -d '{"model":"combo-auto-free","messages":[{"role":"user","content":"ok"}],"max_tokens":5,"stream":true}' ```  ## Actual  Tail of the response, with line numbers:  ```text  9: data: {"id":"...","object":"chat.completion.chunk",...,"finish_reason":"stop","usage":{...}} 10: (blank) 11: data: [DONE] 12: (blank) 13: data: [DONE] 14: (blank) ```  Two separate `data: [DONE]` SSE frames are sent after the finish chunk.  ## Scope  Not gateway-wide — it is path dependent, which points at the response translation pass rather than the stream writer:  | Model | `data: [DONE]` count | |---|---| | `combo-auto-free` | 2 | | `c
  **Post-Mortem & Fix Analysis**:
  > Withdrawn at the author's request. Please disregard.

- **Issue #4446** (2026-09-28): **fix(stream): record usage when a client closes on the finish_reason chunk**
  *Symptoms*: ## Problem Agents like Hermes close a streamed `/v1/chat/completions` answer on the `finish_reason` chunk, before the provider's trailing usage chunk and `[DONE]`. The cancel skipped `flush()`, so these requests left no usage row, no `DONE` log line, a request detail stuck on "Streaming in progress", no combo attribution (combo success % stayed empty) and no breaker success.  Seen live: combo `DeepSeekV4.1` on tokenharbor served ~20 successful Hermes turns with zero usage rows. Reproduced with a client that cancels right after `finish_reason`.  ## Fix Same shape as `d7f7d70d` (Responses terminal event): the SSE transform remembers a finish chunk reached the client and exposes `finalizeOnClientClose()`; `pipeWithDisconnect` calls it on client close, before the disconnect callbacks. A close before the finish stays an abort and records nothing.  ## Tests - `tests/unit/stream-finish-then-close.test.js` (new, red before): passthrough with/without usage, translated (openai → claude), and the close-before-finish control. - Full suite: 4479 pass, 0 fail, 79 skip; `verify-no-regression` clean. Release commit also refreshes the golden header snapshot left on `enhanced.4`.  ## Security notes No auth, credential, header or network-surface changes. The new code path only runs existing usage writers (same data as a normally-completed stream) on a client close; it is wrapped so a usage error cannot break the close.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://cl
  **Post-Mortem & Fix Analysis**:
  > Opened against upstream by mistake — meant for the fork. Sorry for the noise.

- **Issue #4443** (2026-09-28): **feat(codex): expose 1M context variants for GPT-6 and GPT-5.6**
  *Symptoms*: ## Summary  Expose `[1m]` extended-context variants for OpenAI Codex models: GPT-6 Astra, Sol, and Luna, plus GPT-5.6 Sol, Terra, and Luna.  The variants map to their existing upstream model IDs and advertise an 872,000-token context window with a 128,000-token maximum output. The signed-in Codex model catalog reports `max_context_window: 872000` for all six models.  This PR also aligns model discovery with the inference client version, respects connection-specific enabled models during account selection, and allows account fallback when Codex reports that a model is unsupported for a ChatGPT account.  ## Verification  - `node tests/unit/codex-extended-context.mjs` passed. - Production Docker build passed. - Small local requests using all six `[1m]` aliases returned HTTP 200 with successful responses and the expected upstream model IDs. - No prompt above 272,000 tokens was sent; these live checks verify routing and account access, not full extended-context capacity. 
  **Post-Mortem & Fix Analysis**:
  > Thanks @tasarren for the contribution! Reviewed and merged into master. 🙏

- **Issue #4438** (2026-09-28): **feat(codebuddy): parse 6004 rate limit error and extract resetsAtMs**
  *Symptoms*: ### Summary  Tencent CodeBuddy (`codebuddy-cn` and `codebuddy-intl`) returns an upstream application-level error payload when the sliding window rate limit is exceeded:  ```json {   "code": 6004,   "message": "当前模型超出频率限制，请于 2026-09-28 14:30:00 后重试" } ```  Currently, `CodeBuddyExecutor` and `CodeBuddyIntlExecutor` do not override `parseError()`, so: 1. Upstream 6004 errors are treated as general unexpected errors rather than rate limits (`429`). 2. The specific reset time returned in the error message is not extracted, preventing 9router's account switcher (`markAccountUnavailable`) from setting the accurate cooldown timestamp (`resetsAtMs`).  ### Changes 1. Added `parseError(response, bodyText)` in both `CodeBuddyExecutor` (`codebuddy-cn.js`) and `CodeBuddyIntlExecutor` (`codebuddy-intl.js`). 2. Maps `code: 6004` or frequency limit messages to HTTP `429`. 3. Extracts the reset datetime string and parses it into `resetsAtMs` (defaults to UTC+8 if unspecified). 4. Added unit test suite `tests/unit/codebuddy-parse-error.test.js` validating:    - `codebuddy-cn` 6004 timestamp parsing to `resetsAtMs`.    - `codebuddy-intl` frequency limit message parsing.    - Fallback to `super.parseError` for other error codes.  ### Testing - Validated error payload parsing against real upstream CodeBuddy 6004 response bodies. - Unit tests verify timezone offsets and timestamp accuracy.
  **Post-Mortem & Fix Analysis**:
  > Thanks @ZIRAN456 for the contribution! Reviewed and merged into master. 🙏

- **Issue #4436** (2026-09-28): **fix(claude): unsigned thinking placeholders for opencode-go DeepSeek /messages**
  *Symptoms*: ## Summary  DeepSeek models behind OpenCode Go's `/messages` transport carry the same thinking pass-back constraint as the official DeepSeek provider — 400 `The content[].thinking in the thinking mode must be passed back` (verified live 2026-08-15 in the #3332 discussion) — but `prepareClaudeRequest` only normalized thinking blocks for `claude` / `anthropic-compatible` / `deepseek`. Real Claude Code tool loops through opencode-go therefore 400ed whenever an assistant turn arrived without a thinking block.  This is the thinking-injection follow-up agreed in #3332. Changes:  - `prepareClaudeRequest` gate extended **model-based**: `opencode-go` + `isDeepSeekModel(body.model)` reuses the official provider's exact semantics — keep existing thinking verbatim, inject an **unsigned** placeholder on `tool_use` turns missing one while thinking is enabled. `isDeepSeekModel` moves to `providers/models/helpers.js` (shared with toolDeduper). - Why model-based rather than adding the provider to `handlesThinkingBlocks`: opencode-go serves 40 models over `/messages` (minimax, qwen included); blanket injection for models with no such constraint is unverified and unnecessary. A unit cell pins minimax as untouched. - Signature: signed placeholders were also accepted live, but unsigned mirrors the official deepseek provider exactly (the `deepseek` branch of `buildThinkingPlaceholder`). - The responses `input`-array gap (`injectReasoningContent` rewrites `body.messages` only) is explicitly marked 
  **Post-Mortem & Fix Analysis**:
  > Thanks @KiMelody for the contribution! Reviewed and merged into master (together with its base #3333). 🙏

- **Issue #4434** (2026-09-27): **Antigravity provider returning 403s**
  *Symptoms*: [18:35:11] 🟡 ✗ ERROR 403 · antigravity/gemini-3.8-flash-high · 1473ms     URL: https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse     [403]: HTTP 403 [18:35:11] ⚠️  [AUTH] XXXX@gmail.com locked modelLock_gemini-3.8-flash-high for 120s [403] ❌ antigravity [403]: [403]: HTTP 403  Didn't make any changes on my side.  Happens with both opencode and hermes.  Is there a way to debug this further?  I don't see any specific error message.
  **Post-Mortem & Fix Analysis**:
  > For those that find this - it looks like G is forcing verification through some extra steps and will disable the AG subscription until you go through them.  Run agy and it will prompt you through the flow.  Immediately after verifying, you will regain access to the AG entitlement through your account.

- **Issue #4433** (2026-09-28): **fix(codex): preserve hosted web search on GPT-6 Sol/Luna**
  *Symptoms*: ## Summary - Fixes #4432, observed after GPT-6 Sol/Luna Responses Lite support in #4266 (commit `95600db1`). Thanks to that contribution for enabling these models; this PR addresses a hosted-tool compatibility edge case. - When an explicit `web_search` tool is provided for Sol/Luna, send a regular Responses request with top-level `tools` and without the Lite header. Other Sol/Luna requests retain Lite transport. - If a caller already supplied Lite `additional_tools`, move tool definitions to the regular request without duplicate definitions or orphaned prefixes; preserve caller developer instructions and `tool_choice`.  ## Verification - RED: regression tests failed for explicit hosted search, native Lite prefix and duplicated definitions before corresponding fixes. - `npx vitest run unit/codex-gpt6-lite.test.js unit/codex-tool-normalization.test.js unit/codex-fast-capacity.test.js` — 30 passed. - `npx eslint open-sse/executors/codex.js tests/unit/codex-gpt6-lite.test.js` — passed. - `git diff --check` — passed. - Tested equivalent explicit-search bypass on deployed fork: GPT-6 Sol returned `web_search_call`; no live test against upstream branch yet.  ## Scope / security Only Codex GPT-6 Sol/Luna requests with explicit hosted `web_search` change. No credentials, logging of request bodies, or network endpoints added. For callers that place the same tool name in both locations, top-level definition takes precedence. Review compatibility with other hosted tools separately if nee
  **Post-Mortem & Fix Analysis**:
  > Thanks @emi-ran for the contribution! Reviewed and merged into master. 🙏

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

### Incident Patch 1: `c4690307` (2026-09-26)
**Commit Message**: fix(cli-tools): keep existing ANTHROPIC_AUTH_TOKEN when applying Claude settings

Only write the token when settings.json has none, so a real API key or
earlier config is never clobbered by Apply. Reset still clears it,
re-enabling key selection on the next Apply.

Co-Authored-By: Claude Code <noreply@anthropic.com>

**File**: `src/app/api/cli-tools/claude-settings/route.js` (modified, +7/-2)
```diff
@@ -151,11 +151,16 @@ export async function POST(request) {
 
     // Normalize ANTHROPIC_BASE_URL to ensure /v1 suffix
     if (env.ANTHROPIC_BASE_URL) {
-      env.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL.endsWith("/v1") 
-        ? env.ANTHROPIC_BASE_URL 
+      env.ANTHROPIC_BASE_URL = env.ANTHROPIC_BASE_URL.endsWith("/v1")
+        ? env.ANTHROPIC_BASE_URL
         : `${env.ANTHROPIC_BASE_URL}/v1`;
     }
 
+    // Keep an existing token (real key or earlier config); only add when absent — Reset clears it.
+    if (currentSettings.env?.ANTHROPIC_AUTH_TOKEN) {
+      delete env.ANTHROPIC_AUTH_TOKEN;
+    }
+
     // Merge new env with existing settings
     const newSettings = {
       ...currentSettings,
```

---

### Incident Patch 2: `b54a3f9b` (2026-09-26)
**Commit Message**: test(claude): update decloak tests for suffix-stripping fallback

**File**: `tests/translator/claude-claude-stream-decloak.test.js` (modified, +2/-2)
```diff
@@ -36,10 +36,10 @@ describe("Claude → Claude streaming passthrough (OAuth tool cloak)", () => {
     expect(outText).toBe(textChunk);
   });
 
-  it("is a no-op when no cloak map is present", () => {
+  it("falls back to suffix-stripping when no cloak map is present", () => {
     const chunk = toolUseStart(CLOAKED);
     const [out] = translateResponse(FORMATS.CLAUDE, FORMATS.CLAUDE, chunk, {});
-    expect(out).toBe(chunk);
+    expect(out.content_block.name).toBe("run_code");
   });
 
   it("tolerates the null flush chunk", () => {
```

**File**: `tests/unit/claude-cloaking.test.js` (modified, +3/-2)
```diff
@@ -117,7 +117,8 @@ describe("decloakStreamChunk", () => {
 
   it("tolerates null chunks and missing maps (stream flush path)", () => {
     expect(decloakStreamChunk(null, toolNameMap)).toBeNull();
-    expect(decloakStreamChunk(toolUseStart("run_code" + CLAUDE_TOOL_SUFFIX), null).content_block.name).toBe("run_code" + CLAUDE_TOOL_SUFFIX);
-    expect(decloakStreamChunk(toolUseStart("run_code" + CLAUDE_TOOL_SUFFIX), new Map()).content_block.name).toBe("run_code" + CLAUDE_TOOL_SUFFIX);
+    expect(decloakStreamChunk(toolUseStart("run_code" + CLAUDE_TOOL_SUFFIX), null).content_block.name).toBe("run_code");
+    expect(decloakStreamChunk(toolUseStart("run_code" + CLAUDE_TOOL_SUFFIX), new Map()).content_block.name).toBe("run_code");
+    expect(decloakStreamChunk(toolUseStart("uncloaked_tool"), null).content_block.name).toBe("uncloaked_tool");
   });
 });
```

---

### Incident Patch 3: `b65d2d0a` (2026-09-26)
**Commit Message**: fix(claude): decloak tool names when toolNameMap misses (#4342)

- Add stripCloakSuffix fallback in decloakToolNames and decloakStreamChunk
- Prevent client errors when toolNameMap is missing or lost on retry

**File**: `open-sse/utils/claudeCloaking.js` (modified, +24/-7)
```diff
@@ -104,14 +104,29 @@ export function cloakClaudeTools(body) {
   };
 }
 
+// Strip a trailing CLAUDE_TOOL_SUFFIX from a cloaked name as a last-resort
+// fallback when the name isn't in toolNameMap (e.g. map lost across a retry/
+// reconnect). Never strips decoy names — those are meant to reach the client
+// unresolved so it can see "tool unavailable" instead of silently no-oping.
+function stripCloakSuffix(name) {
+  if (typeof name !== "string" || !name.endsWith(CLAUDE_TOOL_SUFFIX)) return null;
+  if (CC_DEFAULT_TOOLS.has(name)) return null;
+  const original = name.slice(0, -CLAUDE_TOOL_SUFFIX.length);
+  return original.length > 0 ? original : null;
+}
+
 // Decloak tool_use names in non-streaming Claude response body (INPUT side)
 export function decloakToolNames(body, toolNameMap) {
-  if (!toolNameMap?.size || !Array.isArray(body?.content)) return body;
+  if (!Array.isArray(body?.content)) return body;
   const content = body.content.map(block => {
-    if (block?.type === "tool_use" && toolNameMap.has(block.name)) {
+    if (block?.type !== "tool_use") return block;
+    if (toolNameMap?.has(block.name)) {
       return { ...block, name: toolNameMap.get(block.name) };
     }
-    return block;
+    // toolNameMap missing/stale for this name — fall back to suffix stripping
+    // rather than forwarding an unresolvable "<tool>_ide" name to the client.
+    const fallback = stripCloakSuffix(block.name);
+    return fallback ? { ...block, name: fallback } : block;
   });
   return { ...body, content };
 }
@@ -126,19 +141,21 @@ export function decloakToolNames(body, toolNameMap) {
  * name appears exactly once per call — on the content_block_start event of
  * a tool_use block; argument deltas carry no name.
  *
- * Unknown names (e.g. a CC decoy tool the model called anyway) pass through
- * unchanged, matching the non-streaming decloak behavior.
+ * Falls back to stripping the literal CLAUDE_TOOL_SUFFIX when the name isn't
+ * in toolNameMap (map lost across a retry/reconnect), matching the
+ * non-streaming decloak behavior. Decoy tool names (real CC tool names) and
+ * anything else pass through unchanged.
  *
  * @param {object|null} chunk - Parsed SSE event (may be null on stream flush)
  * @param {Map|null} toolNameMap - Suffixed → original name map from cloakClaudeTools()
  * @returns {object|null} The chunk, with the tool_use name restored when cloaked
  */
 export function decloakStreamChunk(chunk, toolNameMap) {
-  if (!toolNameMap?.size || !chunk || typeof chunk !== "object") return chunk;
+  if (!chunk || typeof chunk !== "object") return chunk;
   if (chunk.type !== "content_block_start") return chunk;
   const block = chunk.content_block;
   if (block?.type !== "tool_use" || typeof block.name !== "string") return chunk;
-  const original = toolNameMap.get(block.name);
+  const original = toolNameMap?.get(block.name) || stripCloakSuffix(block.name);
   if (!original) return chunk;
   return { ...chunk, content_block: { ...block, name: original } };
 }
```

---

### Incident Patch 4: `8f20daac` (2026-09-26)
**Commit Message**: fix(cli-tools): refresh Codex settings after apply (#4347)

**File**: `src/app/(dashboard)/dashboard/cli-tools/components/BaseUrlSelect.js` (modified, +21/-9)
```diff
@@ -57,6 +57,7 @@ export default function BaseUrlSelect({
   const [mode, setMode] = useState("");
   const [customInput, setCustomInput] = useState("");
   const initializedRef = useRef(false);
+  const currentUrlRef = useRef("");
   const customInputRef = useRef("");
 
   useEffect(() => {
@@ -85,23 +86,34 @@ export default function BaseUrlSelect({
     [requiresExternalUrl, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, cloudEnabled, cloudUrl, savedPresets, withV1]
   );
 
-  // Prefer a saved preset matching the currently configured URL, else first option
+  // Sync the active config URL without replacing edits unless the config itself changes.
   useEffect(() => {
-    if (initializedRef.current) return;
     if (!presetsLoaded || options.length === 0) return;
+    const normalizeUrl = (url) => (withV1 ? ensureV1(url) : stripSlash(url));
+    const current = normalizeUrl(currentUrl);
+    if (initializedRef.current && currentUrlRef.current === current) return;
     initializedRef.current = true;
-    const current = stripSlash(currentUrl);
+    currentUrlRef.current = current;
     const matched = current
-      ? options.find((o) => o.saved && stripSlash(o.url) === current)
+      ? options.find((o) => o.value !== CUSTOM_VALUE && normalizeUrl(o.url) === current)
       : null;
-    const target = matched || options.find((o) => o.value !== CUSTOM_VALUE);
-    if (target) {
+    if (matched) {
+      setCustomInput("");
+      customInputRef.current = "";
+      setMode(matched.value);
+      onChange(matched.url);
+    } else if (current) {
+      setCustomInput(current);
+      customInputRef.current = current;
+      setMode(CUSTOM_VALUE);
+      onChange(current);
+    } else {
+      const target = options.find((o) => o.value !== CUSTOM_VALUE);
+      if (!target) return;
       setMode(target.value);
       onChange(target.url);
-    } else {
-      setMode(CUSTOM_VALUE);
     }
-  }, [presetsLoaded, options, onChange, currentUrl]);
+  }, [presetsLoaded, options, onChange, currentUrl, withV1]);
 
   const handleSelect = (e) => {
     const next = e.target.value;
```

**File**: `src/app/(dashboard)/dashboard/cli-tools/components/CodexToolCard.js` (modified, +16/-15)
```diff
@@ -7,6 +7,7 @@ import BaseUrlSelect from "./BaseUrlSelect";
 import ApiKeySelect from "./ApiKeySelect";
 import { matchKnownEndpoint } from "./cliEndpointMatch";
 import { rememberEndpoint } from "./cliEndpointPresets";
+import { getCurrentCodexProviderSettings } from "./codexConfig";
 
 export default function CodexToolCard({ tool, isExpanded, onToggle, baseUrl, apiKeys, activeProviders, cloudEnabled, initialStatus, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl }) {
   const [codexStatus, setCodexStatus] = useState(initialStatus || null);
@@ -25,10 +26,10 @@ export default function CodexToolCard({ tool, isExpanded, onToggle, baseUrl, api
   const [customBaseUrl, setCustomBaseUrl] = useState("");
 
   useEffect(() => {
-    if (apiKeys?.length > 0 && !selectedApiKey) {
+    if (apiKeys?.length > 0 && !selectedApiKey && !codexStatus?.config) {
       setSelectedApiKey(apiKeys[0].key);
     }
-  }, [apiKeys, selectedApiKey]);
+  }, [apiKeys, selectedApiKey, codexStatus?.config]);
 
   useEffect(() => {
     if (initialStatus) setCodexStatus(initialStatus);
@@ -51,24 +52,24 @@ export default function CodexToolCard({ tool, isExpanded, onToggle, baseUrl, api
     }
   };
 
-  // Parse model and subagent settings from config content
+  // Sync only when config content changes so local form edits are retained.
   useEffect(() => {
-    if (codexStatus?.config) {
-      const modelMatch = codexStatus.config.match(/^model\s*=\s*"([^"]+)"/m);
+    const config = codexStatus?.config;
+    if (config) {
+      const { baseUrl, apiKey } = getCurrentCodexProviderSettings(config);
+      setCustomBaseUrl(baseUrl);
+      setSelectedApiKey(apiKey);
+
+      const modelMatch = config.match(/^model\s*=\s*"([^"]+)"/m);
       if (modelMatch) setSelectedModel(modelMatch[1]);
 
       // Parse subagent settings
-      const subagentModelMatch = codexStatus.config.match(/^default_subagent_model\s*=\s*"([^"]+)"/m);
+      const subagentModelMatch = config.match(/^default_subagent_model\s*=\s*"([^"]+)"/m);
       if (subagentModelMatch) setSubagentModel(subagentModelMatch[1]);
     }
-  }, [codexStatus]);
-
-  const getCurrentBaseUrl = () => {
-    const parsed = codexStatus?.config?.match(/base_url\s*=\s*"([^"]+)"/);
-    return parsed ? parsed[1] : "";
-  };
+  }, [codexStatus?.config]);
 
-  const currentBaseUrl = getCurrentBaseUrl();
+  const currentBaseUrl = getCurrentCodexProviderSettings(codexStatus?.config).baseUrl;
 
   const getConfigStatus = () => {
     if (!codexStatus?.installed) return null;
@@ -79,7 +80,7 @@ export default function CodexToolCard({ tool, isExpanded, onToggle, baseUrl, api
   const configStatus = getConfigStatus();
 
   const getEffectiveBaseUrl = () => {
-    const url = customBaseUrl || `${baseUrl}/v1`;
+    const url = (customBaseUrl || `${baseUrl}/v1`).replace(/\/+$/, "");
     // Ensure URL ends with /v1
     return url.endsWith("/v1") ? url : `${url}/v1`;
   };
@@ -89,7 +90,7 @@ export default function CodexToolCard({ tool, isExpanded, onToggle, baseUrl, api
   const checkCodexStatus = async () => {
     setCheckingCodex(true);
     try {
-      const res = await fetch("/api/cli-tools/codex-settings");
+      const res = await fetch("/api/cli-tools/codex-settings", { cache: "no-store" });
       const data = await res.json();
       setCodexStatus(data);
     } catch (error) {
```

**File**: `src/app/(dashboard)/dashboard/cli-tools/components/codexConfig.js` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+const parseTomlString = (line, key) => {
+  const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(["'])([^\\n]*?)\\1\\s*(?:#.*)?$`));
+  return match ? match[2] : "";
+};
+
+// Only inspect the active provider tables so other providers cannot affect the form.
+export function getCurrentCodexProviderSettings(config) {
+  if (typeof config !== "string") return { baseUrl: "", apiKey: "" };
+
+  const lines = config.split(/\r?\n/);
+  let modelProvider = "";
+  let inRootTable = true;
+
+  for (const line of lines) {
+    if (/^\s*\[/.test(line)) {
+      inRootTable = false;
+      continue;
+    }
+    if (inRootTable) {
+      modelProvider = parseTomlString(line, "model_provider") || modelProvider;
+    }
+  }
+
+  if (!modelProvider) return { baseUrl: "", apiKey: "" };
+
+  const activeTable = `model_providers.${modelProvider}`;
+  let inActiveProviderTable = false;
+  let inActiveHeadersTable = false;
+  let baseUrl = "";
+  let apiKey = "";
+
+  for (const line of lines) {
+    const tableMatch = line.match(/^\s*\[\s*([^\]]+?)\s*\]\s*(?:#.*)?$/);
+    if (tableMatch) {
+      inActiveProviderTable = tableMatch[1] === activeTable;
+      inActiveHeadersTable = tableMatch[1] === `${activeTable}.http_headers`;
+      continue;
+    }
+    if (inActiveProviderTable) {
+      baseUrl = parseTomlString(line, "base_url") || baseUrl;
+    }
+    if (inActiveHeadersTable) {
+      const authorization = parseTomlString(line, "Authorization");
+      const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
+      apiKey = bearerMatch ? bearerMatch[1] : apiKey;
+    }
+  }
+
+  return { baseUrl, apiKey };
+}
+
+export function getCurrentCodexProviderBaseUrl(config) {
+  return getCurrentCodexProviderSettings(config).baseUrl;
+}
```

**File**: `src/app/api/cli-tools/codex-settings/route.js` (modified, +2/-2)
```diff
@@ -1,5 +1,3 @@
-"use server";
-
 import { NextResponse } from "next/server";
 import { exec } from "child_process";
 import { promisify } from "util";
@@ -8,6 +6,8 @@ import path from "path";
 import os from "os";
 import { parseTOML, stringifyTOML } from "confbox";
 
+export const dynamic = "force-dynamic";
+
 const execAsync = promisify(exec);
 
 const getCodexDir = () => path.join(os.homedir(), ".codex");
```

**File**: `tests/unit/codex-current-provider-base-url.test.js` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { describe, expect, it } from "vitest";
+import { getCurrentCodexProviderBaseUrl, getCurrentCodexProviderSettings } from "../../src/app/(dashboard)/dashboard/cli-tools/components/codexConfig.js";
+
+describe("Codex current provider base URL", () => {
+  it("uses the base URL from the configured model provider, not an earlier provider", () => {
+    const config = `model = "gpt-5"
+model_provider = "9router"
+
+[model_providers.omniroute]
+base_url = "https://omniroute.example/v1"
+
+[model_providers.9router]
+base_url = "http://127.0.0.1:20128/v1"
+`;
+
+    expect(getCurrentCodexProviderBaseUrl(config)).toBe("http://127.0.0.1:20128/v1");
+  });
+
+  it("reads the active provider URL and bearer key when another provider appears first", () => {
+    const config = `model_provider = "9router"
+
+[model_providers.omniroute]
+base_url = "https://omniroute.example/v1"
+
+[model_providers.omniroute.http_headers]
+Authorization = "Bearer placeholder-omniroute-key"
+
+[model_providers.9router]
+base_url = "https://9router.example/v1/"
+
+[model_providers.9router.http_headers]
+Authorization = "Bearer placeholder-9router-key"
+`;
+
+    expect(getCurrentCodexProviderSettings(config)).toEqual({
+      baseUrl: "https://9router.example/v1/",
+      apiKey: "placeholder-9router-key",
+    });
+  });
+
+  it("returns empty settings when no active provider is configured", () => {
+    expect(getCurrentCodexProviderSettings("model = \"gpt-5\"\n")).toEqual({ baseUrl: "", apiKey: "" });
+  });
+});
```

---

### Incident Patch 5: `fdcba3e1` (2026-09-26)
**Commit Message**: fix(capabilities): stop caching the catalog source per module copy (#4351)

**File**: `open-sse/providers/capabilities.js` (modified, +4/-4)
```diff
@@ -484,7 +484,8 @@ const MODALITY_KEYS = ["vision", "pdf", "audioInput", "videoInput"];
 // The server bundles this module into every route chunk that needs it, and each
 // copy carries its own module state, so an install landing in the copy the
 // startup hook imported stays invisible to the copy resolving requests. The slot
-// lives on globalThis instead; the local binding is the fast path.
+// lives on globalThis instead, and every read goes through it: caching it locally
+// would keep a reader alive in other copies after setCatalogSource(null).
 let catalogSource = null;
 
 /**
@@ -498,9 +499,8 @@ export function setCatalogSource(source) {
 }
 
 function getCatalogSource() {
-  if (catalogSource) return catalogSource;
-  if (typeof globalThis === "undefined") return null;
-  return (catalogSource = globalThis.__9rCatalogSource || null);
+  if (typeof globalThis === "undefined") return catalogSource;
+  return globalThis.__9rCatalogSource || null;
 }
 
 // Apply the synced catalog + name heuristic on top of a table-resolved result.
```

**File**: `tests/unit/model-catalog-scope.test.js` (modified, +16/-0)
```diff
@@ -122,6 +122,22 @@ describe("model catalog", () => {
     }
     expect(globalThis.__9rCatalogSource).toBeNull();
   });
+
+  it("detaches the source from a copy that already resolved through it", async () => {
+    capabilities.setCatalogSource({
+      getModalities: (provider) => (provider === "gateway-a" ? { vision: true } : null),
+      getLimits: () => null,
+    });
+    const other = await import("../../open-sse/providers/capabilities.js?copy=3");
+    try {
+      expect(other.getCapabilitiesForModel("gateway-a", "laguna-9-preview").vision).toBe(true);
+    } finally {
+      capabilities.setCatalogSource(null);
+    }
+    // the sync resets the source before rebuilding; a copy that has read the
+    // slot once must not keep serving the uninstalled reader
+    expect(other.getCapabilitiesForModel("gateway-a", "laguna-9-preview").vision).toBe(false);
+  });
 });
 
 describe("catalog schema", () => {
```

---

### Incident Patch 6: `7a436d20` (2026-09-26)
**Commit Message**: fix(oauth): stop Zed paste-token crash and add IDE auto-import (#4359)

- Fix Zed Connect crash by gating paste-token UI when provider has no paste-token config
- Add ZedAuthModal with local IDE keyring auto-import, browser OAuth, and manual callback paste
- Add localhost-only GET /api/oauth/zed/auto-import and POST /api/oauth/zed/import routes

**File**: `src/app/(dashboard)/dashboard/providers/[id]/page.js` (modified, +8/-1)
```diff
@@ -5,7 +5,7 @@ import { useParams, useRouter } from "next/navigation";
 import Link from "next/link";
 import Image from "next/image";
 import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";
-import { Card, Button, Badge, Input, Modal, CardSkeleton, OAuthModal, KiroOAuthWrapper, CursorAuthModal, XiaomiMimoAuthModal, IFlowCookieModal, GitLabAuthModal, Toggle, Select, EditConnectionModal, NoAuthProxyCard, ConfirmModal } from "@/shared/components";
+import { Card, Button, Badge, Input, Modal, CardSkeleton, OAuthModal, KiroOAuthWrapper, CursorAuthModal, ZedAuthModal, XiaomiMimoAuthModal, IFlowCookieModal, GitLabAuthModal, Toggle, Select, EditConnectionModal, NoAuthProxyCard, ConfirmModal } from "@/shared/components";
 import { OAUTH_PROVIDERS, APIKEY_PROVIDERS, FREE_PROVIDERS, FREE_TIER_PROVIDERS, WEB_COOKIE_PROVIDERS, getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider, AI_PROVIDERS } from "@/shared/constants/providers";
 import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
 import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";
@@ -1836,6 +1836,13 @@ export default function ProviderDetailPage() {
           onSuccess={handleOAuthSuccess}
           onClose={() => setShowOAuthModal(false)}
         />
+      ) : providerId === "zed" ? (
+        <ZedAuthModal
+          isOpen={showOAuthModal}
+          providerInfo={providerInfo}
+          onSuccess={handleOAuthSuccess}
+          onClose={() => setShowOAuthModal(false)}
+        />
       ) : providerId === "gitlab" ? (
         <GitLabAuthModal
           isOpen={showOAuthModal}
```

**File**: `src/app/api/oauth/zed/auto-import/route.js` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { NextResponse } from "next/server";
+import { readZedIdeCredentials } from "@/lib/oauth/utils/zedCredentials";
+
+/**
+ * GET /api/oauth/zed/auto-import
+ * Read the signed-in Zed IDE session from the OS keyring/keychain.
+ *
+ * Linux: secret-tool (url=https://zed.dev, label zed-github-account)
+ * macOS: Keychain internet password (server=https://zed.dev)
+ * Windows: Credential Manager target zed:url=https://zed.dev
+ *
+ * Also loads system_id from Zed's local kv_store when present.
+ */
+export async function GET() {
+  try {
+    const result = await readZedIdeCredentials();
+    if (!result.found) {
+      return NextResponse.json({
+        found: false,
+        error: result.error || "Zed IDE credentials not found",
+        credentialsUrl: result.credentialsUrl || null,
+      });
+    }
+
+    return NextResponse.json({
+      found: true,
+      userId: result.userId,
+      accessToken: result.accessToken,
+      systemId: result.systemId,
+      credentialsUrl: result.credentialsUrl,
+    });
+  } catch (error) {
+    console.log("Zed auto-import error:", error);
+    return NextResponse.json(
+      { found: false, error: error.message || "Failed to read Zed credentials" },
+      { status: 500 },
+    );
+  }
+}
```

**File**: `src/app/api/oauth/zed/import/route.js` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+import { NextResponse } from "next/server";
+import { randomUUID } from "crypto";
+import { createProviderConnection } from "@/models";
+import {
+  fetchZedAuthenticatedUser,
+  resolveZedOrganizationId,
+} from "open-sse/shared/zedAuth.js";
+
+/**
+ * POST /api/oauth/zed/import
+ * Validate + save a Zed session (typically from IDE auto-import).
+ *
+ * Body: { accessToken, userId, systemId? }
+ */
+export async function POST(request) {
+  try {
+    const body = await request.json();
+    const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
+    const userId = body?.userId != null ? String(body.userId).trim() : "";
+    const systemId =
+      (typeof body?.systemId === "string" && body.systemId.trim()) || randomUUID();
+
+    if (!accessToken) {
+      return NextResponse.json({ error: "Access token is required" }, { status: 400 });
+    }
+    if (!userId) {
+      return NextResponse.json({ error: "User id is required" }, { status: 400 });
+    }
+
+    const credentials = {
+      accessToken,
+      providerSpecificData: { userId, systemId },
+    };
+
+    let userInfo = null;
+    try {
+      userInfo = await fetchZedAuthenticatedUser(credentials);
+    } catch (err) {
+      return NextResponse.json(
+        { error: err.message || "Zed token validation failed" },
+        { status: 401 },
+      );
+    }
+
+    const organizationId = resolveZedOrganizationId(credentials, userInfo);
+    const email = userInfo?.email || null;
+    const displayName =
+      userInfo?.name || userInfo?.display_name || userInfo?.username || `Zed ${userId}`;
+
+    const connection = await createProviderConnection({
+      provider: "zed",
+      authType: "oauth",
+      accessToken,
+      refreshToken: null,
+      expiresAt: null,
+      email,
+      displayName,
+      providerSpecificData: {
+        authMethod: "imported",
+        userId,
+        systemId,
+        organizationId: organizationId || "",
+      },
+      testStatus: "active",
+    });
+
+    return NextResponse.json({
+      success: true,
+      connection: {
+        id: connection.id,
+        provider: connection.provider,
+        email: connection.email,
+        displayName: connection.displayName,
+      },
+    });
+  } catch (error) {
+    console.log("Zed import token error:", error);
+    return NextResponse.json({ error: error.message }, { status: 500 });
+  }
+}
```

**File**: `src/dashboardGuard.js` (modified, +2/-0)
```diff
@@ -45,6 +45,7 @@ const ALWAYS_PROTECTED = [
   "/api/version/update",
   "/api/oauth/cursor/auto-import",
   "/api/oauth/kiro/auto-import",
+  "/api/oauth/zed/auto-import",
 ];
 
 // Require auth, but allow through if requireLogin is disabled
@@ -81,6 +82,7 @@ const LOCAL_ONLY_PATHS = [
   "/api/tunnel/disable",
   "/api/oauth/cursor/auto-import",
   "/api/oauth/kiro/auto-import",
+  "/api/oauth/zed/auto-import",
   "/api/auth/reset-password",
   "/api/headroom/start",
   "/api/headroom/stop",
```

**File**: `src/lib/oauth/utils/zedCredentials.js` (added, +342/-0)
```diff
@@ -0,0 +1,342 @@
+import { execFile } from "child_process";
+import { promisify } from "util";
+import { access, constants, readFile } from "fs/promises";
+import { homedir } from "os";
+import { join } from "path";
+import { randomUUID } from "crypto";
+
+const execFileAsync = promisify(execFile);
+
+export const ZED_DEFAULT_CREDENTIALS_URL = "https://zed.dev";
+export const ZED_KEYRING_LABEL = "zed-github-account";
+
+/**
+ * Resolve the credential URL Zed uses as the keyring/keychain key.
+ * Defaults to https://zed.dev; honors settings.json credentials_url → server_url.
+ */
+export async function resolveZedCredentialsUrl() {
+  const settingsPaths = getZedSettingsPaths();
+  for (const settingsPath of settingsPaths) {
+    try {
+      await access(settingsPath, constants.R_OK);
+      const raw = await readFile(settingsPath, "utf8");
+      const settings = JSON.parse(raw);
+      const url =
+        (typeof settings?.credentials_url === "string" && settings.credentials_url) ||
+        (typeof settings?.server_url === "string" && settings.server_url) ||
+        null;
+      if (url) return url.replace(/\/+$/, "");
+    } catch {
+      // try next path
+    }
+  }
+  return ZED_DEFAULT_CREDENTIALS_URL;
+}
+
+function getZedSettingsPaths() {
+  const home = homedir();
+  if (process.platform === "darwin") {
+    return [join(home, "Library/Application Support/Zed/settings.json")];
+  }
+  if (process.platform === "win32") {
+    const local = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
+    return [join(local, "Zed", "settings.json")];
+  }
+  const xdg = process.env.XDG_CONFIG_HOME || join(home, ".config");
+  return [join(xdg, "zed", "settings.json")];
+}
+
+/** Candidate paths for Zed's global kv_store (holds system_id). */
+export function getZedGlobalDbPaths() {
+  const home = homedir();
+  const channels = ["0-global", "0-stable", "0-preview"];
+  if (process.platform === "darwin") {
+    const base = join(home, "Library/Application Support/Zed/db");
+    return channels.map((c) => join(base, c, "db.sqlite"));
+  }
+  if (process.platform === "win32") {
+    const local = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
+    const base = join(local, "Zed", "db");
+    return channels.map((c) => join(base, c, "db.sqlite"));
+  }
+  const xdg = process.env.XDG_DATA_HOME || join(home, ".local", "share");
+  const base = join(xdg, "zed", "db");
+  return channels.map((c) => join(base, c, "db.sqlite"));
+}
+
+/**
+ * Read system_id from Zed's local kv_store (same id the IDE sends to cloud.zed.dev).
+ */
+export async function readZedSystemId() {
+  for (const dbPath of getZedGlobalDbPaths()) {
+    try {
+      await access(dbPath, constants.R_OK);
+    } catch {
+      continue;
+    }
+    const value = await queryKvStore(dbPath, "system_id");
+    if (value) return String(value).trim();
+  }
+  return null;
+}
+
+async function queryKvStore(dbPath, key) {
+  try {
+    // eslint-disable-next-line @typescript-eslint/no-require-imports
+    const Database = require("better-sqlite3");
+    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
+    try {
+      const row = db.prepare("SELECT value FROM kv_store WHERE key = ? LIMIT 1").get(key);
+      return row?.value || null;
+    } finally {
+      db.close();
+    }
+  } catch {
+    // Fall back to sqlite3 CLI when native bindings are unavailable.
+  }
+
+  try {
+    const { stdout } = await execFileAsync(
+      "sqlite3",
+      [dbPath, `SELECT value FROM kv_store WHERE key='${key.replace(/'/g, "''")}' LIMIT 1;`],
+      { timeout: 5000, windowsHide: true },
+    );
+    const value = String(stdout || "").trim();
+    return value || null;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * Read Zed IDE session credentials from the OS secret store.
+ * @returns {Promise<{ found: boolean, userId?: string, accessToken?: string, systemId?: string, credentialsUrl?: string, error?: string }>}
+ */
+export async functio
```

---

### Incident Patch 7: `37a6b7e0` (2026-09-26)
**Commit Message**: fix(dashboard): resolve combo limits with the server's capabilities (#4360)

The combos page computed combo capabilities in the browser using
aggregateComboCapabilities, falling back to pattern defaults for models
without exact entries because the synced model catalog is server-only.

Allow callers to supply a resolveCaps callback (e.g. from useModelCaps)
merged over the local tables, preserving non-limit capability flags.

**File**: `open-sse/providers/capabilities.js` (modified, +11/-3)
```diff
@@ -425,21 +425,29 @@ export const PATTERN_CAPABILITIES = [
  *
  * @param {string[]} comboModels
  * @param {Object|null} [comboLookup] optional map of combo name → models array for nested resolution
+ * @param {Function|null} [resolveCaps] optional (fullId) → caps override. The synced model
+ *   catalog is server-only (it reads a file), so a browser-side resolution cannot see the
+ *   limits it supplies and silently falls back to the generic patterns below. Callers that
+ *   have the server's answer (/api/models, via useModelCaps) pass it here; it is merged over
+ *   the local tables, so fields it does not carry (tools, pdf, audio/video, thinking*) survive.
  * @param {number} [_depth] internal recursion depth guard
  * @returns {object|null} full capabilities object, or null for empty input
  */
-export function aggregateComboCapabilities(comboModels, comboLookup = null, _depth = 0) {
+export function aggregateComboCapabilities(comboModels, comboLookup = null, resolveCaps = null, _depth = 0) {
   if (!comboModels?.length || _depth > 6) return null;
   const allCaps = comboModels.map((fullId) => {
     // Nested combo: bare name (no slash) that exists in the lookup — recurse
     if (!fullId.includes("/") && comboLookup?.[fullId]) {
-      return aggregateComboCapabilities(comboLookup[fullId], comboLookup, _depth + 1)
+      return aggregateComboCapabilities(comboLookup[fullId], comboLookup, resolveCaps, _depth + 1)
+          ?? resolveCaps?.(fullId)
           ?? getCapabilitiesForModel(null, fullId);
     }
     const slash = fullId.indexOf("/");
     const provider = slash === -1 ? null : fullId.slice(0, slash);
     const model = slash === -1 ? fullId : fullId.slice(slash + 1);
-    return getCapabilitiesForModel(provider, model);
+    const local = getCapabilitiesForModel(provider, model);
+    const override = resolveCaps?.(fullId);
+    return override ? { ...local, ...override } : local;
   });
   const first = allCaps[0];
   return {
```

**File**: `src/app/(dashboard)/dashboard/combos/page.js` (modified, +5/-2)
```diff
@@ -568,7 +568,10 @@ function ComboCard({ combo, getCaps, comboByName = {}, activeProviders = [], cop
   const current = strategy.fallbackStrategy || "fallback";
   const judge = strategy.judgeModel || "";
   const isFusion = current === "fusion";
-  const comboCaps = aggregateComboCapabilities(combo.models, comboByName);
+  // The synced catalog is server-only, so resolving here would fall back to the
+  // generic patterns and under-report the limits. getCaps carries the server's
+  // answer for /api/models.
+  const comboCaps = aggregateComboCapabilities(combo.models, comboByName, getCaps);
 
   return (
     <Card padding="sm" className={`group ${selected ? "ring-1 ring-primary/40 bg-primary/[0.03]" : ""}`}>
@@ -598,7 +601,7 @@ function ComboCard({ combo, getCaps, comboByName = {}, activeProviders = [], cop
                     <span>{model}</span>
                     <CapacityBadges caps={
                       comboByName[model]
-                        ? aggregateComboCapabilities(comboByName[model], comboByName)
+                        ? aggregateComboCapabilities(comboByName[model], comboByName, getCaps)
                         : getCaps?.(model)
                     } />
                   </code>
```

**File**: `tests/unit/combo-caps-resolver.test.js` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import { describe, expect, it } from "vitest";
+
+import { aggregateComboCapabilities, getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
+
+// A combo's limits are the conservative aggregate of its members: ctx = min,
+// maxOutput = max. Resolving those members needs the synced model catalog, which
+// is server-only (it reads a file), so the browser bundle falls back to the
+// generic patterns. The dashboard computed its badges there and under-reported:
+// /v1/models and pi-settings (both server-side) said 1M while the badge said 200k.
+//
+// resolveCaps lets a caller hand in the server's answer. It must only override
+// what it carries — the local tables still own tools/pdf/audio/video/thinking*.
+const GLM53_FED = { vision: true, search: false, reasoning: true, contextWindow: 1_000_000, maxOutput: 131_072 };
+
+describe("aggregateComboCapabilities: resolveCaps override", () => {
+  const models = ["glm-cn/glm-5.3", "deepseek-v4.1-flash"];
+
+  it("falls back to the pattern default without a resolver", () => {
+    const caps = aggregateComboCapabilities(models);
+    // glm-5.3 has no exact entry, so the *glm-5.3* pattern gives 200k and caps the combo.
+    expect(caps.contextWindow).toBe(200_000);
+  });
+
+  it("uses the fed limits when a resolver supplies them", () => {
+    const resolver = (fullId) => (fullId === "glm-cn/glm-5.3" ? GLM53_FED : null);
+    const caps = aggregateComboCapabilities(models, null, resolver);
+    expect(caps.contextWindow).toBe(1_000_000);
+  });
+
+  it("keeps the fields the override does not carry", () => {
+    const plain = aggregateComboCapabilities(models);
+    const fed = aggregateComboCapabilities(models, null, (id) => (id === "glm-cn/glm-5.3" ? GLM53_FED : null));
+    // The override carries no tools/pdf/thinking fields, so those must be unchanged.
+    for (const field of ["tools", "pdf", "audioInput", "videoInput", "imageOutput", "audioOutput", "thinkingFormat"]) {
+      expect(fed[field]).toEqual(plain[field]);
+    }
+  });
+
+  it("still applies the conservative rule across members", () => {
+    const resolver = (fullId) => (fullId === "glm-cn/glm-5.3" ? GLM53_FED : null);
+    const caps = aggregateComboCapabilities(models, null, resolver);
+    // Only glm-5.3 was fed 1M; deepseek-v4.1-flash resolves locally to 1M, so min stays 1M.
+    // Feeding a *smaller* value for one member must pull the aggregate down.
+    const smaller = aggregateComboCapabilities(models, null, (id) => (id === "glm-cn/glm-5.3" ? { ...GLM53_FED, contextWindow: 64_000 } : null));
+    expect(smaller.contextWindow).toBe(64_000);
+    expect(caps.maxOutput).toBe(384_000); // max across members, from deepseek
+  });
+
+  it("passes the resolver into nested combos", () => {
+    const lookup = {
+      zap: ["deepseek-v4.1-flash", "glm-cn/glm-5.3-flash"],
+      "deepseek-v4.1-flash": ["cmc/deepseek/deepseek-v4.1-flash", "ocg/deepseek-v4.1-flash"],
+    };
+    const seen = [];
+    const resolver = (fullId) => { seen.push(fullId); return fullId === "glm-cn/glm-5.3-flash" ? { contextWindow: 1_000_000 } : null; };
+    aggregateComboCapabilities(lookup.zap, lookup, resolver);
+    // The nested combo's own members were resolved with the same resolver.
+    expect(seen).toContain("cmc/deepseek/deepseek-v4.1-flash");
+    expect(seen).toContain("ocg/deepseek-v4.1-flash");
+  });
+
+  it("leaves the plain two-argument call unchanged", () => {
+    const caps = aggregateComboCapabilities(["kimi/kimi-k3"], null);
+    expect(caps).toEqual(aggregateComboCapabilities(["kimi/kimi-k3"]));
+    expect(caps.contextWindow).toBe(getCapabilitiesForModel("kimi", "kimi-k3").contextWindow);
+  });
+});
```

---

### Incident Patch 8: `fe347e4e` (2026-09-26)
**Commit Message**: fix(stt): dispatch live-API-only Gemini models over the Live WebSocket transport (#4006)

Addresses #4006 by letting Gemini STT models that only exist on the Live
API transcribe instead of failing.

transcribeGemini sends audio to :generateContent and that is the only Gemini
path. A model that is realtime-only (exposed by the Live API's
bidiGenerateContent WebSocket) therefore fails outright, even though the account
can transcribe it.

open-sse/handlers/geminiLiveStt.js owns the WebSocket lifecycle: opens
:bidiGenerateContent, sends setup frame, waits for setupComplete, streams
audio as realtimeInput media chunks, and settles on turnComplete.
Dispatch is driven by transport marker 'gemini-live'. Adds custom model transport
persistence and selection on the dashboard.

**File**: `open-sse/handlers/geminiLiveStt.js` (added, +266/-0)
```diff
@@ -0,0 +1,266 @@
+import { Buffer } from "node:buffer";
+
+// Gemini Live API realtime STT transport.
+//
+// The REST generateContent path (sttCore.transcribeGemini) only transcribes
+// whole files inline. The Live API's `:bidiGenerateContent` WebSocket is the
+// streaming counterpart: audio goes up as realtimeInput mediaChunks and the
+// server pushes incremental `serverContent.inputTranscription` events back.
+// This module owns the socket lifecycle only — envelope/response shaping
+// stays in sttCore so the engine's single STT exit shape is preserved.
+//
+// Marker contract: dispatched from sttCore's format-switch when the model
+// entry carries `transport: "gemini-live"` (registry) or the caller passes a
+// transport string (custom models). Never keyed on a hardcoded model id here.
+//
+// Transport behavior:
+//   - Node >= 22 global WebSocket (undici). No new dependency.
+//   - Live API expects low-latency PCM; other containers are forwarded with
+//     their declared MIME unchanged (provider-side rejection is surfaced).
+//   - Text accumulation is append-only over inputTranscription segments and
+//     ends on serverContent.turnComplete (or graceful close with partial text).
+//   - Transcription deltas are kept per-frame (chunks[]) so sttCore can shape
+//     verbose_json segments without fabricating timestamps. goAway advisements
+//     rotate the socket once per call: setup replay + byte-offset resume.
+
+const SETUP_TIMEOUT_MS = 10_000;  // open → setupComplete
+const TURN_TIMEOUT_MS = 60_000;   // audio streamed → turnComplete
+const MAX_TIMEOUT_MS = 300_000;   // clamp ceiling for client-supplied lifecycle knobs
+const CHUNK_BYTES = 16_384;       // ~0.5s of 16-bit 16kHz mono PCM
+const GOAWAY_RECONNECTS = 1;      // socket rotations honoured per call
+
+class GeminiLiveError extends Error {
+  constructor(message, status) {
+    super(message);
+    this.name = "GeminiLiveError";
+    this.status = status || 502;
+  }
+}
+
+// REST base (https://host/v1beta/models) → Live WS base
+// (wss://host/ws/api/v1beta/models), then the bidiGenerateContent endpoint.
+function toLiveWsUrl(baseUrl, model, token) {
+  const url = new URL(baseUrl);
+  url.protocol = "wss:";
+  if (!url.pathname.startsWith("/ws/")) url.pathname = `/ws/api${url.pathname}`;
+  const base = url.toString().replace(/\/+$/, "");
+  return `${base}/${encodeURIComponent(model)}:bidiGenerateContent?key=${encodeURIComponent(token || "")}`;
+}
+
+// Bind socket events supporting BOTH handler styles: addEventListener
+// (browser WebSocket, undici) and onopen/onmessage property assignment
+// (minimal polyfills). Whichever the implementation exposes, it works.
+function bindSocket(ws, { onOpen, onMessage, onError, onClose }) {
+  if (typeof ws.addEventListener === "function") {
+    ws.addEventListener("open", onOpen);
+    ws.addEventListener("message", onMessage);
+    ws.addEventListener("error", onError);
+    ws.addEventListener("close", onClose);
+    return;
+  }
+  ws.onopen = onOpen;
+  ws.onmessage = onMessage;
+  ws.onerror = onError;
+  ws.onclose = onClose;
+}
+
+function parseFrame(data) {
+  try {
+    return JSON.parse(typeof data === "string" ? data : String(data));
+  } catch {
+    return null; // non-JSON frames carry no Live API semantics
+  }
+}
+
+function firstStringField(formData, key) {
+  const v = typeof formData?.get === "function" ? formData.get(key) : null;
+  return typeof v === "string" && v.trim() ? v.trim() : "";
+}
+
+// Lifecycle knobs the live registry entry advertises in params[]
+// (setup/turn timeouts). They ride the same formData pass-through sttCore
+// gives every transport — no sttCore change needed to reach this leaf.
+function firstNumberField(formData, key, fallback) {
+  const n = Number(firstStringField(formData, key));
+  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_TIMEOUT_MS) : fallback;
+}
+
+/**
+ * Transcribe an audio File via the Gemini Live bidirectional stream.
+ * @returns
```

**File**: `open-sse/handlers/sttCore.js` (modified, +42/-4)
```diff
@@ -1,5 +1,7 @@
 import { Buffer } from "node:buffer";
 import { createErrorResult } from "../utils/error.js";
+import { transcribeGeminiLive } from "./geminiLiveStt.js";
+import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "../config/providerModels.js";
 import { HTTP_STATUS } from "../config/runtimeConfig.js";
 
 // Build auth headers from sttConfig + token
@@ -162,11 +164,26 @@ function jsonResponse(obj) {
   };
 }
 
+// Model-level transport marker (registry models[].transport, e.g. the Gemini
+// live STT entry's "gemini-live", or a custom model's stored transport).
+// Dispatch reads the marker — never a hardcoded model id — so new realtime
+// providers extend sttCore through data, not code.
+function resolveModelTransport(provider, model) {
+  const key = PROVIDER_ID_TO_ALIAS[provider] || provider;
+  const models = PROVIDER_MODELS[key] || PROVIDER_MODELS[provider];
+  if (!Array.isArray(models)) return null;
+  const entry = models.find((m) => m && m.id === model && (m.kind || "llm") === "stt");
+  const marker = typeof entry?.transport === "string" ? entry.transport.trim() : "";
+  return marker || null;
+}
+
 /**
- * STT core handler — dispatch by sttConfig.format.
+ * STT core handler — dispatch by model transport marker, else sttConfig.format.
+ * `transport` is the caller-supplied marker override (custom models resolve
+ * it in the app layer; built-ins fall back to the registry entry marker).
  * @returns {Promise<{success, response, status?, error?}>}
  */
-export async function handleSttCore({ provider, model, formData, credentials, sttConfig }) {
+export async function handleSttCore({ provider, model, formData, credentials, sttConfig, transport }) {
   const file = formData.get("file");
   if (!file) return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: file");
 
@@ -186,8 +203,29 @@ export async function handleSttCore({ provider, model, formData, credentials, st
     return createErrorResult(HTTP_STATUS.UNAUTHORIZED, `No credentials for STT provider: ${provider}`);
   }
 
+  // Format-switch extension: an explicit caller marker wins over the registry
+  // marker; with neither, the provider-default sttConfig.format applies.
+  const marker = (typeof transport === "string" && transport.trim()) ? transport.trim() : resolveModelTransport(provider, model);
+
   try {
-    switch (cfg.format) {
+    switch (marker || cfg.format) {
+      case "gemini-live": {
+        const live = await transcribeGeminiLive({ cfg, file, model, token, formData, mimeType: resolveAudioContentType(file) });
+        // response_format parity with the OpenAI-compatible transport: default
+        // envelope stays {text}; verbose_json adds segments mapped from the
+        // Live API's incremental inputTranscription deltas. Those frames carry
+        // NO timestamps, so segments expose {id,text} only (id = delta order,
+        // Whisper-compatible 0-based) — start/end/duration are deliberately
+        // absent rather than fabricated as zeros, which would misrepresent
+        // provider data to callers diffing transports.
+        const fmt = typeof formData?.get === "function"
+          ? String(formData.get("response_format") ?? "").trim().toLowerCase()
+          : "";
+        if (fmt === "verbose_json") {
+          return jsonResponse({ text: live.text, segments: live.chunks.map((segText, id) => ({ id, text: segText })) });
+        }
+        return jsonResponse({ text: live.text });
+      }
       case "deepgram":        return await transcribeDeepgram(cfg, file, model, token, formData);
       case "assemblyai":      return await transcribeAssemblyAI(cfg, file, model, token);
       case "nvidia-asr":      return await transcribeNvidia(cfg, file, model, token);
@@ -196,6 +234,6 @@ export async function handleSttCore({ provider, model, formData, credentials, st
       default:                return await transcribeOpenAICompatible(cfg, file, model, token, formData);
     }
   } catch (err) {
- 
```

**File**: `open-sse/providers/registry/gemini.js` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ export default {
     { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", params: ["language","prompt"], kind: "stt" },
     { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite (Cheapest)", params: ["language","prompt"], kind: "stt" },
     { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", params: ["language","prompt"], kind: "stt" },
+    { id: "gemini-2.5-flash-native-audio-preview-09-17", name: "Gemini Live Transcription (Realtime)", params: ["language","prompt","system_instruction","setup_timeout_ms","turn_timeout_ms"], kind: "stt", transport: "gemini-live" },
     { id: "gemini-3.1-flash-tts-preview", name: "Gemini 3.1 Flash TTS", kind: "tts" },
     { id: "gemini-2.5-flash-preview-tts", name: "Gemini 2.5 Flash TTS", kind: "tts" },
     { id: "gemini-2.5-pro-preview-tts", name: "Gemini 2.5 Pro TTS", kind: "tts" },
```

**File**: `src/app/(dashboard)/dashboard/providers/[id]/AddCustomModelModal.js` (modified, +34/-4)
```diff
@@ -2,8 +2,8 @@
 
 import { useState, useEffect } from "react";
 import PropTypes from "prop-types";
-import { Button, Modal, Toggle } from "@/shared/components";
-import { CAPACITY_META } from "@/shared/constants/models";
+import { Button, Modal, Select, Toggle } from "@/shared/components";
+import { CAPACITY_META, STT_TRANSPORT_META, STT_TRANSPORTS } from "@/shared/constants/models";
 
 const defaultCaps = () => Object.fromEntries(Object.keys(CAPACITY_META).map((key) => [key, false]));
 
@@ -13,10 +13,12 @@ export default function AddCustomModelModal({ isOpen, providerAlias, providerDis
   const [testStatus, setTestStatus] = useState(null); // null | "testing" | "ok" | "error"
   const [testError, setTestError] = useState("");
   const [saving, setSaving] = useState(false);
+  // Realtime dispatch marker for the transport select; "" = provider default REST.
+  const [transport, setTransport] = useState("");
 
   // Reset state when modal opens
   useEffect(() => {
-    if (isOpen) { setModelId(""); setCaps(defaultCaps()); setTestStatus(null); setTestError(""); }
+    if (isOpen) { setModelId(""); setCaps(defaultCaps()); setTransport(""); setTestStatus(null); setTestError(""); }
   }, [isOpen]);
 
   // Strip provider's own alias prefix (e.g. "cc/model" -> "model" for cc provider)
@@ -50,7 +52,9 @@ export default function AddCustomModelModal({ isOpen, providerAlias, providerDis
     if (!cleanId || saving) return;
     setSaving(true);
     try {
-      await onSave(cleanId, caps);
+      // caps.stt is UI-only; the parent save flow derives the model type from
+      // it and forwards the pinned transport (null unless the caller picked one).
+      await onSave(cleanId, caps, caps.stt ? transport : null);
     } finally {
       setSaving(false);
     }
@@ -106,6 +110,32 @@ export default function AddCustomModelModal({ isOpen, providerAlias, providerDis
           </div>
         </div>
 
+        {/* STT is a model TYPE, not a chat capability: the save flow turns this
+            flag into type "stt" (the API honours a transport only on stt
+            records). The select pins the realtime dispatch marker persisted
+            with the model; the whitelist is the shared STT_TRANSPORT_META. */}
+        <div>
+          <Toggle
+            checked={!!caps.stt}
+            onChange={(v) => { setCaps((prev) => ({ ...prev, stt: v })); if (!v) setTransport(""); }}
+            label="Speech to text"
+            description="Transcribes audio via /v1/audio/transcriptions"
+            size="sm"
+          />
+          {caps.stt && (
+            <div className="mt-3">
+              <Select
+                label="Transport"
+                value={transport}
+                onChange={(e) => setTransport(e.target.value)}
+                placeholder="Provider default (REST)"
+                options={STT_TRANSPORTS.map((t) => ({ value: t, label: STT_TRANSPORT_META[t].label }))}
+                hint="Realtime transport marker for the STT dispatcher. Empty keeps the provider's REST format."
+              />
+            </div>
+          )}
+        </div>
+
         {/* Test result */}
         {testStatus === "ok" && (
           <div className="flex items-center gap-2 text-sm text-green-600">
```

**File**: `src/app/(dashboard)/dashboard/providers/[id]/page.js` (modified, +8/-4)
```diff
@@ -552,12 +552,14 @@ export default function ProviderDetailPage() {
     }
   };
 
-  const handleAddCustomModel = async (modelId, type = "llm", providerAliasOverride = providerStorageAlias, caps) => {
+  // `transport` pins a realtime STT dispatch marker (shared whitelist
+  // STT_TRANSPORT_META); the API only honours it on type "stt" records.
+  const handleAddCustomModel = async (modelId, type = "llm", providerAliasOverride = providerStorageAlias, caps, transport) => {
     try {
       const res = await fetch("/api/models/custom", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
-        body: JSON.stringify({ providerAlias: providerAliasOverride, id: modelId, type, ...(caps ? { caps } : {}) }),
+        body: JSON.stringify({ providerAlias: providerAliasOverride, id: modelId, type, ...(caps ? { caps } : {}), ...(transport ? { transport } : {}) }),
       });
       if (res.ok) {
         await fetchCustomModels();
@@ -1904,8 +1906,10 @@ export default function ProviderDetailPage() {
           isOpen={showAddCustomModel}
           providerAlias={providerStorageAlias}
           providerDisplayAlias={providerDisplayAlias}
-          onSave={async (modelId, caps) => {
-            await handleAddCustomModel(modelId, "llm", providerStorageAlias, caps);
+          onSave={async (modelId, caps, transport) => {
+            // caps.stt is a UI-only flag; the API accepts transports only on
+            // type "stt" records, so the save derives the type from it.
+            await handleAddCustomModel(modelId, caps?.stt ? "stt" : "llm", providerStorageAlias, caps, transport);
             setShowAddCustomModel(false);
           }}
           onClose={() => setShowAddCustomModel(false)}
```

---

### Incident Patch 9: `273f0c32` (2026-09-26)
**Commit Message**: fix(responses): carry the streamed output items in response.completed (#4307)

**File**: `open-sse/translator/response/openai-responses.js` (modified, +55/-18)
```diff
@@ -223,15 +223,19 @@ function closeReasoning(state, emit) {
       part: { type: RESPONSES_ITEM.SUMMARY_TEXT, text: state.reasoningBuf }
     });
 
+    const item = {
+      id: state.reasoningId,
+      type: RESPONSES_ITEM.REASONING,
+      summary: [{ type: RESPONSES_ITEM.SUMMARY_TEXT, text: state.reasoningBuf }]
+    };
+
     emit("response.output_item.done", {
       type: "response.output_item.done",
       output_index: state.reasoningIndex,
-      item: {
-        id: state.reasoningId,
-        type: RESPONSES_ITEM.REASONING,
-        summary: [{ type: RESPONSES_ITEM.SUMMARY_TEXT, text: state.reasoningBuf }]
-      }
+      item
     });
+
+    recordCompletedOutputItem(state, state.reasoningIndex, item);
   }
 }
 
@@ -295,16 +299,20 @@ function closeMessage(state, emit, idx) {
       part: { type: RESPONSES_ITEM.OUTPUT_TEXT, annotations: [], logprobs: [], text: fullText }
     });
 
+    const item = {
+      id: msgId,
+      type: RESPONSES_ITEM.MESSAGE,
+      content: [{ type: RESPONSES_ITEM.OUTPUT_TEXT, annotations: [], logprobs: [], text: fullText }],
+      role: ROLE.ASSISTANT
+    };
+
     emit("response.output_item.done", {
       type: "response.output_item.done",
       output_index: parseInt(idx),
-      item: {
-        id: msgId,
-        type: RESPONSES_ITEM.MESSAGE,
-        content: [{ type: RESPONSES_ITEM.OUTPUT_TEXT, annotations: [], logprobs: [], text: fullText }],
-        role: ROLE.ASSISTANT
-      }
+      item
     });
+
+    recordCompletedOutputItem(state, parseInt(idx), item);
   }
 }
 
@@ -398,23 +406,51 @@ function closeToolCall(state, emit, idx) {
       });
     }
 
+    const item = {
+      id: `${custom ? "ctc" : "fc"}_${callId}`,
+      type: custom ? RESPONSES_ITEM.CUSTOM_TOOL_CALL : RESPONSES_ITEM.FUNCTION_CALL,
+      ...(custom ? { input: extractCustomToolInput(args) } : { arguments: args }),
+      call_id: callId,
+      name: state.funcNames[idx] || ""
+    };
+
     emit("response.output_item.done", {
       type: "response.output_item.done",
       output_index: parseInt(idx),
-      item: {
-        id: `${custom ? "ctc" : "fc"}_${callId}`,
-        type: custom ? RESPONSES_ITEM.CUSTOM_TOOL_CALL : RESPONSES_ITEM.FUNCTION_CALL,
-        ...(custom ? { input: extractCustomToolInput(args) } : { arguments: args }),
-        call_id: callId,
-        name: state.funcNames[idx] || ""
-      }
+      item
     });
 
+    recordCompletedOutputItem(state, parseInt(idx), item);
+
     state.funcItemDone[idx] = true;
     state.funcArgsDone[idx] = true;
   }
 }
 
+// response.completed carries the finished Response object, so response.output has
+// to repeat the items already delivered in response.output_item.done. Clients that
+// build their final result from the terminal event (GitHub Copilot CLI, the OpenAI
+// SDK "final response" helpers) otherwise treat the turn as empty even though the
+// text was streamed - see issue #4307.
+//
+// Keyed by output_index so a repeated close overwrites rather than duplicating the
+// item, and ordered by output_index so response.output matches the order the items
+// were emitted in. Lazily created because stream.js can hand us a state it built
+// itself rather than one from initState().
+function recordCompletedOutputItem(state, outputIndex, item) {
+  state.completedOutputItems ??= new Map();
+  const index = Number.isInteger(outputIndex) ? outputIndex : Number.parseInt(outputIndex, 10) || 0;
+  state.completedOutputItems.set(index, item);
+}
+
+function collectCompletedOutputItems(state) {
+  const recorded = state.completedOutputItems;
+  if (!(recorded instanceof Map) || recorded.size === 0) return [];
+  return [...recorded.entries()]
+    .sort((left, right) => left[0] - right[0])
+    .map(([, item]) => item);
+}
+
 function sendCompleted(state, emit) {
   if (!state.completedSent) {
     state.completedSent = true;
@@ -427,6 +463,7 @@ function sendCompleted(state, emit) {
         status: "completed",
         background: fal
```

**File**: `tests/unit/responses-completed-output.test.js` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+import { describe, expect, it } from "vitest";
+
+import { FORMATS } from "../../open-sse/translator/formats.js";
+import { initState } from "../../open-sse/translator/index.js";
+import { openaiToOpenAIResponsesResponse } from "../../open-sse/translator/response/openai-responses.js";
+
+// targetFormat === OPENAI is the direct openai -> openai-responses route, which is
+// the only one where flush() reaches this translator (see the flushReachesUs note
+// above the finish_reason branch).
+function newState() {
+  return { ...initState(FORMATS.OPENAI_RESPONSES), targetFormat: FORMATS.OPENAI };
+}
+
+function textChunk(text, index = 0) {
+  return { id: "chatcmpl-1", choices: [{ index, delta: { content: text } }] };
+}
+
+function reasoningChunk(text, index = 0) {
+  return { id: "chatcmpl-1", choices: [{ index, delta: { reasoning_content: text } }] };
+}
+
+function finishChunk(usage) {
+  return { id: "chatcmpl-1", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage };
+}
+
+function runChunks(chunks) {
+  const state = newState();
+  const events = [];
+  for (const chunk of chunks) {
+    for (const event of openaiToOpenAIResponsesResponse(chunk, state)) events.push(event);
+  }
+  return { state, events };
+}
+
+function completedResponse(events) {
+  const completed = events.find((event) => event.event === "response.completed");
+  expect(completed, "expected a response.completed event").toBeTruthy();
+  return completed.data.response;
+}
+
+function doneItems(events) {
+  return events
+    .filter((event) => event.event === "response.output_item.done")
+    .map((event) => event.data.item);
+}
+
+describe("response.completed output (issue #4307)", () => {
+  // The regression: sendCompleted() built the response object without an `output`
+  // key at all, so response.completed arrived with no output even though the
+  // message had already been streamed. Clients that build the final result from
+  // the terminal event (GitHub Copilot CLI 1.0.89 with a BYOK provider) printed
+  // the text and then failed with "No response was returned".
+  it("repeats the streamed message in response.completed", () => {
+    const state = newState();
+    openaiToOpenAIResponsesResponse(textChunk("O"), state);
+    openaiToOpenAIResponsesResponse(textChunk("K"), state);
+    const response = completedResponse(openaiToOpenAIResponsesResponse(null, state));
+
+    expect(response.status).toBe("completed");
+    expect(Array.isArray(response.output)).toBe(true);
+    expect(response.output).toHaveLength(1);
+    expect(response.output[0]).toMatchObject({ type: "message", role: "assistant" });
+    expect(response.output[0].content[0]).toMatchObject({ type: "output_text", text: "OK" });
+  });
+
+  it("matches exactly the items already delivered in response.output_item.done", () => {
+    const { events } = runChunks([
+      textChunk("hello"),
+      finishChunk({ prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 }),
+    ]);
+    const response = completedResponse(events);
+    const streamed = doneItems(events);
+
+    expect(streamed).toHaveLength(1);
+    expect(response.output).toEqual(streamed);
+  });
+
+  it("includes a function_call item", () => {
+    const { events } = runChunks([
+      {
+        id: "chatcmpl-1",
+        choices: [
+          {
+            index: 0,
+            delta: {
+              tool_calls: [
+                { index: 0, id: "call_1", function: { name: "get_weather", arguments: '{"city":"Paris"}' } },
+              ],
+            },
+          },
+        ],
+      },
+      finishChunk({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }),
+    ]);
+    const response = completedResponse(events);
+
+    expect(response.output).toHaveLength(1);
+    expect(response.output[0]).toMatchObject({
+      type: "function_call",
+      name: "get_weather",
+      arguments: '{"city":"Paris"}',
+      call_id: "call_1",
+    });
+  });
+
+  it("orders output b
```

---

### Incident Patch 10: `c2148179` (2026-09-26)
**Commit Message**: fix(commandcode): replay raw byte chunks to preserve all NDJSON lines

**File**: `open-sse/executors/commandcode.js` (modified, +9/-25)
```diff
@@ -141,7 +141,7 @@ export async function inspectAndWrapCommandCodeResponse(originalResponse, model)
   const reader = originalResponse.body.getReader();
   const decoder = new TextDecoder();
   let buffer = "";
-  const bufferedLines = [];
+  const rawChunks = [];
   let detectedError = null;
 
   try {
@@ -155,16 +155,15 @@ export async function inspectAndWrapCommandCodeResponse(originalResponse, model)
             const parsed = JSON.parse(jsonStr);
             if (parsed?.type === "error") {
               detectedError = parsed;
-            } else {
-              bufferedLines.push(trimmed);
             }
           } catch {
-            bufferedLines.push(trimmed);
+            /* ignore */
           }
         }
         break;
       }
 
+      rawChunks.push(value);
       buffer += decoder.decode(value, { stream: true });
       const lines = buffer.split("\n");
       buffer = lines.pop() || "";
@@ -175,7 +174,6 @@ export async function inspectAndWrapCommandCodeResponse(originalResponse, model)
         if (!trimmed) continue;
         const jsonStr = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
         if (!jsonStr || jsonStr === "[DONE]") {
-          bufferedLines.push(trimmed);
           stopLoop = true;
           break;
         }
@@ -184,7 +182,6 @@ export async function inspectAndWrapCommandCodeResponse(originalResponse, model)
         try {
           event = JSON.parse(jsonStr);
         } catch {
-          bufferedLines.push(trimmed);
           continue;
         }
 
@@ -194,8 +191,6 @@ export async function inspectAndWrapCommandCodeResponse(originalResponse, model)
           break;
         }
 
-        bufferedLines.push(trimmed);
-
         if (
           event?.type === "text-delta" ||
           event?.type === "reasoning-delta" ||
@@ -238,29 +233,18 @@ export async function inspectAndWrapCommandCodeResponse(originalResponse, model)
     );
   }
 
-  const combinedStream = createReplayedStream(bufferedLines, buffer, reader);
+  const combinedStream = createRawReplayedStream(rawChunks, reader);
   return wrapNdjsonAsOpenAISse(combinedStream, model, originalResponse);
 }
 
-function createReplayedStream(bufferedLines, remainingBuffer, reader) {
-  const encoder = new TextEncoder();
-  let replayed = false;
+function createRawReplayedStream(rawChunks, reader) {
+  let chunkIndex = 0;
 
   return new ReadableStream({
     async pull(controller) {
-      if (!replayed) {
-        replayed = true;
-        let prefix = bufferedLines.join("\n");
-        if (prefix && remainingBuffer) {
-          prefix += "\n" + remainingBuffer;
-        } else if (remainingBuffer) {
-          prefix = remainingBuffer;
-        } else if (prefix) {
-          prefix += "\n";
-        }
-        if (prefix) {
-          controller.enqueue(encoder.encode(prefix));
-        }
+      if (chunkIndex < rawChunks.length) {
+        controller.enqueue(rawChunks[chunkIndex++]);
+        return;
       }
 
       try {
```

**File**: `tests/unit/commandcode-executor.test.js` (modified, +24/-0)
```diff
@@ -133,6 +133,30 @@ describe("inspectAndWrapCommandCodeResponse", () => {
     expect(text).toContain("data: [DONE]");
   });
 
+  it("preserves all lines in a multi-line packet when inspecting tool-input-start", async () => {
+    const packet = [
+      JSON.stringify({ type: "start" }),
+      JSON.stringify({ type: "start-step" }),
+      JSON.stringify({ type: "tool-input-start", id: "call_1", toolName: "terminal" }),
+      JSON.stringify({ type: "tool-input-delta", id: "call_1", delta: '{"command": "ls"}' }),
+      JSON.stringify({ type: "finish-step", finishReason: "tool-calls" }),
+      JSON.stringify({ type: "finish", finishReason: "tool-calls" }),
+    ].join("\n") + "\n";
+
+    const ndjsonBody = createNdjsonStream([packet]);
+
+    const fakeResponse = new Response(ndjsonBody, {
+      status: 200,
+      headers: { "Content-Type": "text/event-stream" },
+    });
+
+    const result = await inspectAndWrapCommandCodeResponse(fakeResponse, "cmc/deepseek/deepseek-v4.1-flash");
+    expect(result.ok).toBe(true);
+    const text = await result.text();
+    expect(text).toContain('"name":"terminal"');
+    expect(text).toContain('"arguments":"{\\"command\\": \\"ls\\"}"');
+  });
+
   it("retries when initial stream yields an error and succeeds on second attempt", async () => {
     let callCount = 0;
     const executor = new CommandCodeExecutor();
```

#### Recent Merged Pull Requests:
- **PR #4493** (closed): Feat/design system dashboard shell (@Synthever)
- **PR #4446** (closed): fix(stream): record usage when a client closes on the finish_reason chunk (@scursel)
- **PR #4443** (closed): feat(codex): expose 1M context variants for GPT-6 and GPT-5.6 (@tasarren)
- **PR #4438** (closed): feat(codebuddy): parse 6004 rate limit error and extract resetsAtMs (@ZIRAN456)
- **PR #4436** (closed): fix(claude): unsigned thinking placeholders for opencode-go DeepSeek /messages (@KiMelody)
- **PR #4433** (closed): fix(codex): preserve hosted web search on GPT-6 Sol/Luna (@emi-ran)
- **PR #4430** (closed): feat(web): add TinyFish search and fetch provider (@emi-ran)
- **PR #4425** (closed): test(providers): isolate provider-priority fixtures in a temp DATA_DIR (@claytontavaresdan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
