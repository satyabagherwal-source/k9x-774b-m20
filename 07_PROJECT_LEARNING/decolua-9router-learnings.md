# Forensic Learning Record (Deep Inspection): decolua/9router

> **Canonical Artifact**: `07_PROJECT_LEARNING/decolua-9router-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/decolua/9router](https://github.com/decolua/9router))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:20:47.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `decolua/9router`
- **Description**: Unlimited FREE AI coding. Connect Claude Code, Codex, Cursor, Cline, Copilot, Antigravity to FREE Claude/GPT/Gemini via 40+ providers. Auto-fallback, RTK -40% tokens, never hit limits.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 30324 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/hooks/postinstall.js`
```
#!/usr/bin/env node

// Postinstall: warm-up SQLite deps into ~/.9router/runtime so the first
// `9router` start doesn't need network. Failure here is non-fatal —
// cli.js will retry at runtime if anything is missing.
// `npx 9router …` (npm_command=exec) is typically a one-shot `connect` — skip
// the runtime warm-up; cli.js self-heals it if the server is started later.
if (process.env.npm_command === "exec") process.exit(0);

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

  const binPath = path.join(getRuntimeNodeModules(), SYSTRAY_PKG, "traybin", "tray_darwin_release");
  if (!fs.existsSync(binPath)) return { skipped: true };
  if (isArm64MachO(binPath)) return { native: true };
  if (recentlyAttemptedArm64()) return { deferred: true };

  markArm64Attempt();
  console.log("⏳ Downloading native Apple Silicon tray binary...");
  // pid-scoped: two concurrent starts (postinstall racing cli.js, or two
  // terminals) would otherwise interleave writes to one file, fail each other's
  // checksum, and delete each other's in-flight download from the catch below.
  const tmp = `${binPath}.arm64.${process.pid}.tmp`;
  try {
    downloadFile(ARM64_TRAY_URL, tmp, 30);
    const sum = sha256File(tmp);
    // Integrity matters more than usual: this is an executable that runs on
    // every Apple Silicon user's machine.
    if (sum !== ARM64_TRAY_SHA256) throw new Error(`checksum mismatch (got ${sum.slice(0, 12)}…)`);
    if (!isArm64MachO(tmp)) throw new Error("downloaded file is not an arm64 Mach-O");
    fs.chmodSync(tmp, 0o755);
    fs.renameSync(tmp, binPath);
    bustSystrayCopyCache();
    clearArm64Attempt();
    console.log("✅ Native Apple Silicon tray installed");
    return { native: true, installed: true };
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    console.warn("⚠️  Native tray download failed — falling back to the Intel binary");
    console.warn(`   Reason: ${e.message}`);
    console.warn("   The Intel tray needs Rosetta 2: softwareupdate --install-rosetta --agree-to-license");
    return { native: false, error: e.message };
  }
}

function npmInstall(pkgs, { silent = false } = {}) {
  const cwd = ensureRuntimeDir();
  if (!silent) console.log("⏳ Installing system tray (first run)...");
  const res = runNpmInstall({ cwd, pkgs, extraArgs: ["--no-save"], timeout: 120000 });
  if (!res.ok && !silent) {
    const reason = summarizeNpmError(res.stderr);
    console.warn("⚠️  System tray install failed — tray disabled");
    console.warn(`   Reason: ${reason}`);
   
```

### Core Architecture Module: `cli/src/cli/utils/clipboard.js`
```
const { execSync } = require("child_process");

/**
 * Copy text to clipboard based on OS
 * @param {string} text - Text to copy
 * @returns {boolean} Success status
 */
function copyToClipboard(text) {
  try {
    const platform = process.platform;
    
    if (platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else if (platform === "win32") {
      execSync("clip", { input: text });
    } else {
      // Linux - try xclip first, then xsel
      try {
        execSync("xclip -selection clipboard", { input: text });
      } catch {
        execSync("xsel --clipboard --input", { input: text });
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { copyToClipboard };

```

### Core Architecture Module: `cli/src/cli/utils/display.js`
```
const { formatNumber } = require("./format");

// ANSI color codes
const COLORS = {
  reset: "\x1b[0m",
  success: "\x1b[32m",
  error: "\x1b[31m",
  warning: "\x1b[33m",
  info: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m"
};

// Box drawing characters
const BOX_CHARS = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│"
};

/**
 * Draw a box with border around content
 * @param {string} title - Box title
 * @param {string} content - Content to display inside box
 * @param {number} [width=60] - Box width
 */
function showBox(title, content, width = 60) {
  const innerWidth = width - 4;
  const lines = content.split("\n");

  // Top border with title
  const topBorder = BOX_CHARS.topLeft + BOX_CHARS.horizontal.repeat(2) + 
    ` ${title} ` + 
    BOX_CHARS.horizontal.repeat(Math.max(0, innerWidth - title.length - 3)) + 
    BOX_CHARS.topRight;

  console.log(topBorder);

  // Content lines
  lines.forEach(line => {
    const paddedLine = line.padEnd(innerWidth);
    console.log(`${BOX_CHARS.vertical} ${paddedLine} ${BOX_CHARS.vertical}`);
  });

  // Bottom border
  const bottomBorder = BOX_CHARS.bottomLeft + 
    BOX_CHARS.horizontal.repeat(innerWidth + 2) + 
    BOX_CHARS.bottomRight;

  console.log(bottomBorder);
}

/**
 * Display a menu with numbered items
 * @param {string} title - Menu title
 * @param {string[]} items - Array of menu items
 * @param {string} [footer] - Optional footer text
 */
function showMenu(title, items, footer) {
  console.log(`\n${COLORS.bold}${title}${COLORS.reset}`);
  console.log(COLORS.dim + "─".repeat(title.length) + COLORS.reset);

  items.forEach((item, index) => {
    console.log(`  ${COLORS.info}${index + 1}.${COLORS.reset} ${item}`);
  });

  if (footer) {
    console.log(`\n${COLORS.dim}${footer}${COLORS.reset}`);
  }
  console.log();
}

/**
 * Display data in table format
 * @param {string[]} headers - Array of column headers
 * @param {Array<Array<string|number>>} rows - Array of row data
 */
function showTable(headers, rows) {
  if (!headers.length || !rows.length) {
    return;
  }

  // Calculate column widths
  const colWidths = headers.map((header, i) => {
    const maxDataWidth = Math.max(...rows.map(row => String(row[i] || "").length));
    return Math.max(header.length, maxDataWidth);
  });

  // Print header
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(" │ ");
  console.log(COLORS.bold + headerRow + COLORS.reset);

  // Print separator
  const separator = colWidths.map(w => "─".repeat(w)).join("─┼─");
  console.log(COLORS.dim + separator + COLORS.reset);

  // Print rows
  rows.forEach(row => {
    const rowStr = row.map((cell, i) => String(cell || "").padEnd(colWidths[i])).join(" │ ");
    console.log(rowStr);
  });
}

/**
 * Show colored status message
 * @param {string} message - Message to display
 * @param {string} [type="info"] - Status type: success, error, warning, info
 */
function showStatus(message, type = "info") {
  const symbols = {
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ"
  };

  const color = COLORS[type] || COLORS.info;
  const symbol = symbols[type] || symbols.info;

  console.log(`${color}${symbol} ${message}${COLORS.reset}`);
}

/**
 * Clear the terminal screen
 */
function clearScreen() {
  console.clear();
}

/**
 * Show menu header with title and subtitle
 * @param {string} title - Main title
 * @param {string} subtitle - Optional subtitle
 */
function showHeader(title, subtitle) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${COLORS.bright}${COLORS.cyan}${title}${COLORS.reset}`);
  if (subtitle) {
    console.log(`  ${COLORS.dim}${subtitle}${COLORS.reset}`);
  }
  console.log(`${"=".repeat(60)}\n`);
}

module.exports = {
  showBox,
  showMenu,
  showTable,
  showStatus,
  clearScreen,
  showHeader
};

```

### Core Architecture Module: `cli/src/cli/utils/endpoint.js`
```
const api = require("../api/client");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m"
};

/**
 * Get endpoint URL based on tunnel status
 * @param {number} port - Local server port
 * @returns {Promise<{endpoint: string, tunnelEnabled: boolean}>}
 */
async function getEndpoint(port) {
  const result = await api.getTunnelStatus();
  const tunnelEnabled = result.success && result.data?.enabled === true;
  const publicUrl = result.success ? result.data?.publicUrl : "";
  
  const endpoint = tunnelEnabled && publicUrl ? `${publicUrl}/v1` : `http://localhost:${port}/v1`;
  return { endpoint, tunnelEnabled };
}

/**
 * Get endpoint with color formatting
 * @param {number} port - Local server port
 * @returns {Promise<string>} Colored endpoint string
 */
async function getEndpointColored(port) {
  const { endpoint, tunnelEnabled } = await getEndpoint(port);
  return tunnelEnabled ? `${COLORS.green}${endpoint}${COLORS.reset}` : endpoint;
}

module.exports = { getEndpoint, getEndpointColored };

```

### Core Architecture Module: `cli/src/cli/utils/format.js`
```
/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Mask API key showing only first and last characters
 * @param {string} key - API key to mask
 * @returns {string} Masked key
 */
function maskKey(key) {
  if (!key || key.length < 8) {
    return "***";
  }
  const firstChars = key.substring(0, 4);
  const lastChars = key.substring(key.length - 4);
  return `${firstChars}${"*".repeat(key.length - 8)}${lastChars}`;
}

/**
 * Format date to readable string
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (typeof num !== "number" || isNaN(num)) {
    return "0";
  }
  return num.toLocaleString("en-US");
}

/**
 * Format bytes to human readable size
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Get relative time string
 * @param {Date|string|number} date - Date to compare
 * @returns {string} Relative time string
 */
function getRelativeTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) {
    return "just now";
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  } else if (diffDay < 30) {
    return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  } else if (diffMonth < 12) {
    return `${diffMonth} month${diffMonth > 1 ? "s" : ""} ago`;
  } else {
    return `${diffYear} year${diffYear > 1 ? "s" : ""} ago`;
  }
}

module.exports = {
  truncate,
  maskKey,
  formatDate,
  formatNumber,
  formatBytes,
  getRelativeTime
};

```

### Core Architecture Module: `cli/src/cli/utils/input.js`
```
const readline = require("readline");

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underline: "\x1b[4m",
  reverse: "\x1b[7m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
  black: "\x1b[30m",
  terracotta: "\x1b[38;2;217;119;87m",
  bgTerracotta: "\x1b[48;2;217;119;87m"
};

// Prime stdin once globally. Toggling raw mode between menus adds latency on
// macOS, so we keep raw mode on for the whole TUI session.
let rawPrimed = false;
function primeRawOnce() {
  if (rawPrimed || !process.stdin.isTTY) return;
  try {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    rawPrimed = true;
  } catch {}
}

function suspendRawFor(fn) {
  // Temporarily drop raw mode so readline.question can buffer line input.
  const wasPrimed = rawPrimed;
  if (wasPrimed && process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch {}
  }
  return fn().finally(() => {
    if (wasPrimed && process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch {}
      process.stdin.resume();
    }
  });
}

async function prompt(question) {
  return suspendRawFor(() => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || "").trim());
    });
  }));
}

async function select(question, options) {
  console.log(question);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
  while (true) {
    const answer = await prompt("\nSelect option (number): ");
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) return num - 1;
    console.log(`Invalid selection. Please enter a number between 1 and ${options.length}`);
  }
}

async function confirm(question) {
  while (true) {
    const answer = await prompt(`${question} (y/n): `);
    const lower = answer.toLowerCase();
    if (lower === "y" || lower === "yes") return true;
    if (lower === "n" || lower === "no") return false;
    console.log("Please answer 'y' or 'n'");
  }
}

async function pause(message = "Press Enter to continue...") {
  return suspendRawFor(() => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => { rl.close(); resolve(); });
  }));
}

/**
 * Interactive arrow-key menu. Renders ★/☆ icons; selected line uses reverse+bright
 * (no underline). Uses readline keypress + raw 'data' fallback to prevent
 * arrow-key escape sequence leaks on macOS.
 */
async function selectMenu(title, items, defaultIndex = 0, subtitle = "", headerContent = "", breadcrumb = []) {
  return new Promise((resolve) => {
    let selectedIndex = defaultIndex;
    let isActive = true;

    primeRawOnce();
    if (!process.stdin.isTTY) { resolve(-1); return; }

    const renderMenu = () => {
      if (!isActive) return;
      process.stdout.write("\x1b[2J\x1b[H");
      const width = Math.min(process.stdout.columns || 40, 40);
      console.log(`\n${COLORS.terracotta}${"=".repeat(width)}${COLORS.reset}`);
      console.log(`  ${COLORS.bright}${COLORS.terracotta}${title}${COLORS.reset}`);
      if (subtitle) console.log(`  ${COLORS.dim}${subtitle}${COLORS.reset}`);
      console.log(`${COLORS.terracotta}${"=".repeat(width)}${COLORS.reset}`);
      if (breadcrumb.length > 0) console.log(`  ${COLORS.dim}${breadcrumb.join(" > ")}${COLORS.reset}`);
      console.log();
      if (headerContent) { console.log(headerContent); console.log(); }

      const isWin = process.platform === "win32";
      items.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const icon = isSelected ? (isWin ? ">" : "★") : (isWin ? " " : "☆");
        if (isSelected) {
          console.log(` ${COLORS.reverse}${COLORS.bright}${icon} ${item.label}${COLORS.reset}`);
        } else {
          console.log(`  ${icon} ${item.label}`);
        }
      });
    };

    const cleanup = () => {
      if (!isActive) return;
      isActive = false;
      process.stdin.removeListener("keypress", onKeypress);
    };

    const move = (delta) => {
      selectedIndex = (selectedIndex + delta + items.length) % items.length;
      renderMenu();
    };

    const onKeypress = (_str, key) => {
      if (!isActive || !key) return;
      if (key.name === "up") return move(-1);
      if (key.name === "down") return move(1);
      if (key.name === "return") { cleanup(); resolve(selectedIndex); return; }
      if (key.name === "escape") { cleanup(); resolve(-1); return; }
      if (key.ctrl && key.name === "c") { cleanup(); process.exit(0); }
    };

    process.stdin.on("keypress", onKeypress);
    renderMenu();
  });
}

module.exports = {
  prompt,
  select,
  confirm,
  pause,
  selectMenu,
  COLORS
};

```

### Core Architecture Module: `cli/src/cli/utils/menuHelper.js`
```
const { selectMenu } = require("./input");

/**
 * Show a menu with back button at top and handle selection
 * @param {Object} config - Menu configuration
 * @param {string} config.title - Menu title
 * @param {string} config.headerContent - Optional header content
 * @param {Array<{label: string, action: Function}>} config.items - Menu items with actions
 * @param {string} config.backLabel - Back button label (default: "← Back")
 * @param {number} config.defaultIndex - Default selected index (default: 0)
 * @param {Function} config.refresh - Optional refresh function to call after each action
 * @param {Array<string>} config.breadcrumb - Optional breadcrumb path
 * @returns {Promise<void>}
 */
async function showMenuWithBack(config) {
  const {
    title,
    headerContent = "",
    items,
    backLabel = "← Back",
    defaultIndex = 0,
    refresh = null,
    breadcrumb = []
  } = config;

  while (true) {
    // Call refresh if provided
    let refreshedData = null;
    if (refresh) {
      refreshedData = await refresh();
      if (refreshedData === null) {
        // Refresh failed, exit menu
        return;
      }
    }

    // Build menu items with back at top
    const menuItems = [
      { label: backLabel, icon: "☆" },
      ...items.map(item => ({
        label: typeof item.label === "function" ? item.label(refreshedData) : item.label,
        icon: "☆"
      }))
    ];

    // Resolve headerContent if it's a function
    const resolvedHeader = typeof headerContent === "function" 
      ? await headerContent(refreshedData) 
      : headerContent;

    const selected = await selectMenu(
      title,
      menuItems,
      defaultIndex,
      "",
      resolvedHeader,
      breadcrumb
    );

    // Back or ESC
    if (selected === -1 || selected === 0) {
      return;
    }

    // Execute action for selected item
    const actionIndex = selected - 1;
    const item = items[actionIndex];
    
    if (item && item.action) {
      const shouldContinue = await item.action(refreshedData);
      // If action returns false, exit menu
      if (shouldContinue === false) {
        return;
      }
    }
  }
}

/**
 * Show a list menu where items are fetched dynamically
 * @param {Object} config - Menu configuration
 * @param {string} config.title - Menu title
 * @param {string} config.headerContent - Optional header content
 * @param {Function} config.fetchItems - Async function to fetch items array
 * @param {Function} config.formatItem - Function to format each item to {label, data}
 * @param {Function} config.onSelect - Action when item is selected
 * @param {Object} config.createAction - Optional create action {label, action}
 * @param {string} config.backLabel - Back button label
 * @param {Array<string>} config.breadcrumb - Optional breadcrumb path
 * @returns {Promise<void>}
 */
async function showListMenu(config) {
  const {
    title,
    headerContent = "",
    fetchItems,
    formatItem,
    onSelect,
    createAction = null,
    backLabel = "← Back",
    breadcrumb = []
  } = config;

  while (true) {
    // Fetch items
    const result = await fetchItems();
    if (!result) {
      return;
    }

    const items = result.items || [];
    const metadata = result.metadata || {};

    // Build menu items
    const menuItems = [{ label: backLabel, icon: "☆" }];
    
    if (createAction) {
      menuItems.push({ label: createAction.label, icon: "☆" });
    }

    items.forEach(item => {
      const formatted = formatItem(item);
      menuItems.push({ label: formatted, icon: "☆" });
    });

    const header = typeof headerContent === "function" 
      ? await headerContent(metadata) 
      : headerContent;

    const selected = await selectMenu(title, menuItems, 0, "", header, breadcrumb);

    // Back or ESC
    if (selected === -1 || selected === 0) {
      return;
    }

    // Create action
    if (createAction && selected === 1) {
      await createAction.action();
      continue;
    }

    // Select item
    const offset = createAction ? 2 : 1;
    const itemIndex = selected - offset;
    
    if (itemIndex >= 0 && itemIndex < items.length) {
      await onSelect(items[itemIndex]);
    }
  }
}

module.exports = {
  showMenuWithBack,
  showListMenu
};

```

### Core Architecture Module: `cli/src/cli/utils/modelSelector.js`
```
const api = require("../api/client");
const { prompt } = require("./input");
const { clearScreen } = require("./display");

// Provider alias order: OAuth first, then Free, then API Key
const PROVIDER_ALIAS_ORDER = [
  "cc", "ag", "cx", "if", "qw", "gc", "gh", "kr", "oc",
  "openrouter", "glm", "kimi", "minimax", "openai", "anthropic", "gemini"
];

// Alias to display name mapping
const PROVIDER_ALIAS_NAMES = {
  cc: "Claude Code",
  ag: "Antigravity",
  cx: "OpenAI Codex",
  if: "iFlow AI",
  qw: "Qwen Code",
  gc: "Gemini CLI",
  gh: "GitHub Copilot",
  kr: "Kiro AI",
  oc: "OpenCode Free",
  opencode: "OpenCode Free",
  openrouter: "OpenRouter",
  glm: "Zai GLM Coding",
  kimi: "Kimi Coding",
  minimax: "Minimax Coding",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini"
};

const PROVIDER_ID_TO_ALIAS = {
  claude: "cc",
  codex: "cx",
  "gemini-cli": "gc",
  github: "gh",
  antigravity: "ag",
  iflow: "if",
  qwen: "qw",
  kiro: "kr",
  cursor: "cu",
  cline: "cline",
  clinepass: "clinepass",
  qoder: "qd",
  "qoder-cn": "qd",
  gitlab: "gitlab",
  "codebuddy-cn": "cb",
  "codebuddy-intl": "cbai",
  kimchi: "kimchi",
  "grok-cli": "grok-cli",
  trae: "trae",
  windsurf: "windsurf",
  zed: "zed",
  opencode: "oc",
  "opencode-go": "ocg",
  "opencode-zen": "ocz",
};

// Providers usable without stored credentials
const NO_AUTH_PROVIDERS = new Set(["opencode", "oc"]);

/**
 * Get all available models grouped by provider + combos (filtered by active connections)
 * @returns {Promise<{combos: Array, groups: Object}>}
 */
async function getAvailableModelsGrouped() {
  const [modelsResult, providersResult] = await Promise.all([
    api.getAvailableModels(),
    api.getProviders()
  ]);

  if (!modelsResult.success) return { combos: [], groups: {} };

  const connections = providersResult.success ? (providersResult.data?.connections || []) : [];
  const activeAliases = new Set(NO_AUTH_PROVIDERS);

  connections.forEach(conn => {
    if (conn.isActive === false) return;
    const p = conn.provider;
    if (!p) return;
    activeAliases.add(p);
    const alias = conn.providerSpecificData?.prefix || PROVIDER_ID_TO_ALIAS[p] || p;
    activeAliases.add(alias);
  });

  const models = modelsResult.data?.data || [];
  const combos = [];
  const groups = {};

  models.forEach(m => {
    if (m.owned_by === "combo") {
      combos.push(m.id);
    } else {
      const provider = m.owned_by;
      // Only keep connected providers or noAuth providers
      if (!activeAliases.has(provider)) return;
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(m.id);
    }
  });

  return { combos, groups };
}

/**
 * Display model list and prompt for selection with provider grouping & search
 * @param {string} title - Title to display
 * @param {string} currentValue - Current selected value (optional)
 * @param {Object} options - { excludeCombos?: boolean }
 * @returns {Promise<string|null>} Selected model ID or null if cancelled
 */
async function selectModelFromList(title, currentValue = "", options = {}) {
  const { excludeCombos = false } = options;
  const { combos: rawCombos, groups } = await getAvailableModelsGrouped();
  const combos = excludeCombos ? [] : rawCombos;

  const totalModels = combos.length + Object.values(groups).flat().length;
  if (totalModels === 0) {
    clearScreen();
    console.log(`\n🎯 ${title}`);
    console.log("=".repeat(50));
    console.log("\n  No connected providers found.");
    console.log("  Please connect a provider in Providers menu first.\n");
    console.log("  m. ✍️  Enter custom model ID");
    console.log("  0. Cancel\n");
    const act = await prompt("Select option (m/0): ");
    const trimmed = act.trim();
    if (trimmed.toLowerCase() === "m") {
      const custom = await prompt("Enter custom model ID: ");
      return custom.trim() || null;
    }
    return null;
  }

  // All models for flat search
  const allModelsList = [
    ...combos,
    ...Object.values(groups).flat()
  ];

  // Build category list
  const categories = [];
  if (combos.length > 0) {
    categories.push({
      id: "combos",
      name: "[Combos]",
      models: combos
    });
  }

  const sortedProviders = Object.keys(groups).sort((a, b) => {
    const idxA = PROVIDER_ALIAS_ORDER.indexOf(a);
    const idxB = PROVIDER_ALIAS_ORDER.indexOf(b);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  sortedProviders.forEach((provider) => {
    const providerName = PROVIDER_ALIAS_NAMES[provider] || provider;
    categories.push({
      id: provider,
      name: providerName,
      models: groups[provider]
    });
  });

  let filterQuery = null;

  while (true) {
    clearScreen();
    console.log(`\n🎯 ${title}`);
    console.log("=".repeat(50));
    if (currentValue) {
      console.log(`Current: ${currentValue}\n`);
    } else {
      console.log();
    }

    // Active search view
    if (filterQuery !== null) {
      const q = filterQuery.toLowerCase().trim();
      const matched = allModelsList.filter((m) => m.toLowerCase().includes(q));

      console.log(`🔍 Search results for "${filterQuery}": (${matched.length} found)\n`);
      if (matched.length === 0) {
        console.log("  No matching models found.\n");
        console.log("  0. ← Back to providers");
        console.log("  s. Search again\n");
        const act = await prompt("Select option: ");
        if (act.toLowerCase() === "s") {
          const newQ = await prompt("Enter search keyword: ");
          filterQuery = newQ.trim() || null;
        } else {
          filterQuery = null;
        }
        continue;
      }

      matched.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m}`);
      });
      console.log("\n  0. ← Back to providers");
      console.log("  s. Search again\n");

      const input = await prompt("Enter number to select (or 0/s): ");
      if (input.toLowerCase() === "s") {
        const newQ = await prompt("Enter search keyword: ");
        filterQuery = newQ.trim() || null;
        continue;
      }
      const num = parseInt(input, 10);
      if (isNaN(num) || num === 0) {
        filterQuery = null;
        continue;
      }
      if (num > 0 && num <= matched.length) {
        return matched[num - 1];
      }
      continue;
    }

    // If only 1 category exists, jump straight into its model list
    if (categories.length === 1) {
      const singleCategory = categories[0];
      console.log(`[${singleCategory.name}]`);
      singleCategory.models.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m}`);
      });
      console.log();
      console.log("  s. 🔍 Search models");
      console.log("  m. ✍️  Enter custom model ID");
      console.log("  0. Cancel\n");

      const input = await prompt("Enter choice (number / s / m / 0): ");
      const trimmed = input.trim();
      if (!trimmed || trimmed === "0") return null;

      const lower = trimmed.toLowerCase();
      if (lower === "s") {
        const q = await prompt("Enter search keyword: ");
        if (q.trim()) filterQuery = q.trim();
        continue;
      }
      if (lower === "m") {
        const customModel = await prompt("Enter custom model ID: ");
        if (customModel.trim()) return customModel.trim();
        continue;
      }

      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0 && num <= singleCategory.models.length) {
        return singleCategory.models[num - 1];
      }
      filterQuery = trimmed;
      continue;
    }

    // Multiple categories view
    console.log("[Providers & Groups]");
    categories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat.name} (${cat.models.length} models)`);
    });

    console.log();
    console.log("  s. 🔍 Search models");
    console.log("  m. ✍️  Enter custom model ID");
    console.log("  0. Cancel\n");

    const input = await prompt("Enter choice (number / keyword / s / m): ");
    const trimmed = input.trim();

    if (!trimmed || trimmed === "0") {
      return null;
    }

    const lower = trimmed.toLowerCase();
    if (lower === "s") {
      const q = await prompt("Enter search keyword: ");
      if (q.trim()) {
        filterQuery = q.trim();
      }
      continue;
    }

    if (lower === "m") {
      const customModel = await prompt("Enter custom model ID: ");
      if (customModel.trim()) {
        return customModel.trim();
      }
      continue;
    }

    const num = parseInt(trimmed, 10);
    // Selected a category
    if (!isNaN(num) && num > 0 && num <= categories.length) {
      const selectedCategory = categories[num - 1];

      while (true) {
        clearScreen();
        console.log(`\n🎯 ${title} > ${selectedCategory.name}`);
        console.log("=".repeat(50));
        if (currentValue) {
          console.log(`Current: ${currentValue}\n`);
        } else {
          console.log();
        }

        selectedCategory.models.forEach((m, i) => {
          console.log(`  ${i + 1}. ${m}`);
        });
        console.log("\n  0. ← Back\n");

        const modelChoice = await prompt("Enter number to select (0 to back): ");
        const modelNum = parseInt(modelChoice, 10);
        if (isNaN(modelNum) || modelNum === 0) {
          break;
        }
        if (modelNum > 0 && modelNum <= selectedCategory.models.length) {
          return selectedCategory.models[modelNum - 1];
        }
      }
      continue;
    }

    // User typed text directly -> treat as search query
    filterQuery = trimmed;
  }
}

module.exports = {
  selectModelFromList,
  getAvailableModelsGrouped,
  PROVIDER_ALIAS_ORDER,
  PROVIDER_ALIAS_NAMES
};

```

### Core Architecture Module: `gitbook/utils/markdown.js`
```
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { BookOpen, Rocket, Terminal, Monitor, FolderOpen, HelpCircle, MessageCircle, Mouse, Folder, Lock, Zap, Smartphone, Lightbulb, AlertTriangle, CheckCircle, ArrowRight, Layers, Plug, Cloud, Wallet, Gift, GitBranch, BarChart3, Code2, Sparkles, Server, PartyPopper, Siren, Link2, Target, Heart, Check, Home, Package, Wrench, OctagonX, Search, Globe, Container } from "lucide-react";

const PAGE_ICONS = {
  "Welcome to 9Router": BookOpen,
  "Introduction": BookOpen,
  "Getting Started": Rocket,
  "Quick Start": Rocket,
  "Installation": Terminal,
  "Providers": Layers,
  "Subscription (Maximize)": Sparkles,
  "Cheap (Backup)": Wallet,
  "Free (Fallback)": Gift,
  "Features": Zap,
  "Smart Routing": GitBranch,
  "Combos & Fallback": Layers,
  "Quota Tracking": BarChart3,
  "Integration": Plug,
  "Claude Code": Code2,
  "OpenAI Codex": Code2,
  "Cursor": Code2,
  "Cline": Code2,
  "Roo": Code2,
  "Continue": Code2,
  "Other Tools": Plug,
  "Deployment": Cloud,
  "Localhost": Monitor,
  "Cloud (VPS/Docker)": Server,
  "Troubleshooting": HelpCircle,
  "FAQ": MessageCircle,
  "Frequently Asked Questions": MessageCircle
};

const ICON_MAP = {
  "terminal": Terminal,
  "monitor": Monitor,
  "mouse": Mouse,
  "folder": Folder,
  "lock": Lock,
  "zap": Zap,
  "smartphone": Smartphone,
  "lightbulb": Lightbulb,
  "alert-triangle": AlertTriangle,
  "check-circle": CheckCircle,
  "arrow-right": ArrowRight,
};

// Emoji to lucide icon mapping (auto-converted in markdown)
const EMOJI_ICON_MAP = {
  "✅": { Icon: CheckCircle, color: "text-green-600" },
  "✓": { Icon: Check, color: "text-green-600" },
  "❌": { Icon: AlertTriangle, color: "text-red-500" },
  "⚠️": { Icon: AlertTriangle, color: "text-yellow-600" },
  "⚠": { Icon: AlertTriangle, color: "text-yellow-600" },
  "🚨": { Icon: Siren, color: "text-red-500" },
  "🛑": { Icon: OctagonX, color: "text-red-500" },
  "💡": { Icon: Lightbulb, color: "text-yellow-500" },
  "🔄": { Icon: GitBranch, color: "text-[#E68A6E]" },
  "🚀": { Icon: Rocket, color: "text-[#E68A6E]" },
  "⚡": { Icon: Zap, color: "text-yellow-500" },
  "🔌": { Icon: Plug, color: "text-[#E68A6E]" },
  "☁️": { Icon: Cloud, color: "text-blue-500" },
  "☁": { Icon: Cloud, color: "text-blue-500" },
  "📦": { Icon: Package, color: "text-[#E68A6E]" },
  "💰": { Icon: Wallet, color: "text-green-600" },
  "🎁": { Icon: Gift, color: "text-pink-500" },
  "📊": { Icon: BarChart3, color: "text-[#E68A6E]" },
  "💻": { Icon: Code2, color: "text-gray-700" },
  "✨": { Icon: Sparkles, color: "text-[#E68A6E]" },
  "🖥️": { Icon: Server, color: "text-gray-700" },
  "🖥": { Icon: Server, color: "text-gray-700" },
  "📖": { Icon: BookOpen, color: "text-[#E68A6E]" },
  "🔒": { Icon: Lock, color: "text-gray-700" },
  "➡️": { Icon: ArrowRight, color: "text-[#E68A6E]" },
  "📱": { Icon: Smartphone, color: "text-[#E68A6E]" },
  "📂": { Icon: Folder, color: "text-[#E68A6E]" },
  "📁": { Icon: Folder, color: "text-[#E68A6E]" },
  "🖱️": { Icon: Mouse, color: "text-[#E68A6E]" },
  "🎉": { Icon: PartyPopper, color: "text-pink-500" },
  "🔗": { Icon: Link2, color: "text-blue-500" },
  "🎯": { Icon: Target, color: "text-red-500" },
  "❤": { Icon: Heart, color: "text-red-500" },
  "❤️": { Icon: Heart, color: "text-red-500" },
  "🏠": { Icon: Home, color: "text-[#E68A6E]" },
  "🔧": { Icon: Wrench, color: "text-gray-700" },
  "🔍": { Icon: Search, color: "text-gray-700" },
  "🌐": { Icon: Globe, color: "text-blue-500" },
  "🐳": { Icon: Container, color: "text-blue-500" }
};

const EMOJI_REGEX = new RegExp(`^(${Object.keys(EMOJI_ICON_MAP).map(e => e.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|")})\\s*`);

export function parseMarkdown(content) {
  return content;
}

// Unicode-aware slugify: keeps letters/numbers from any language (Vietnamese, Chinese, Japanese, etc.)
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/^-+|-+$/g, "");
}

// Extract leading emoji from heading children and replace with lucide icon
function renderHeadingWithEmoji(tag, children, props) {
  const Tag = tag;
  const text = (Array.isArray(children) ? children : [children])
    .map(c => (typeof c === "string" ? c : ""))
    .join("");
  const emojiMatch = text.match(EMOJI_REGEX);
  const textForId = emojiMatch ? text.slice(emojiMatch[0].length).trim() : text;
  const id = slugify(textForId);
  if (emojiMatch) {
    const { Icon, color } = EMOJI_ICON_MAP[emojiMatch[1]];
    const rest = text.slice(emojiMatch[0].length);
    return (
      <Tag id={id} {...props}>
        <Icon className={`inline-block mr-2 align-[-0.15em] w-[1em] h-[1em] ${color}`} />
        {rest}
      </Tag>
    );
  }
  return <Tag id={id} {...props}>{children}</Tag>;
}

export function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="markdown-content"
      components={{
        h1: ({ node, children, ...props }) => {
          const text = children?.toString() || "";
          const IconComponent = PAGE_ICONS[text];
          const id = slugify(text);
          
          return (
            <h1 id={id} {...props}>
              {IconComponent && <IconComponent className="inline-block mr-3" />}
              {children}
            </h1>
          );
        },
        h2: ({ node, children, ...props }) => renderHeadingWithEmoji("h2", children, props),
        h3: ({ node, children, ...props }) => renderHeadingWithEmoji("h3", children, props),
        li: ({ node, children, ...props }) => {
          // Extract text from children (handle React elements)
          const extractText = (child) => {
            if (typeof child === 'string') return child;
            if (Array.isArray(child)) return child.map(extractText).join('');
            if (child?.props?.children) return extractText(child.props.children);
            return '';
          };
          
          const text = extractText(children);
          const iconMatch = text.match(/^\[icon:([a-z-]+)\]\s*(.*)$/);
          
          if (iconMatch) {
            const iconName = iconMatch[1];
            const restText = iconMatch[2];
            const IconComponent = ICON_MAP[iconName];
            
            return (
              <li {...props}>
                {IconComponent && <IconComponent className="inline-block mr-2 w-4 h-4 text-[#E68A6E]" />}
                {restText}
              </li>
            );
          }

          // Auto-convert leading emoji to lucide icon
          const emojiMatch = text.match(EMOJI_REGEX);
          if (emojiMatch) {
            const { Icon, color } = EMOJI_ICON_MAP[emojiMatch[1]];
            const restText = text.slice(emojiMatch[0].length);
            return (
              <li {...props}>
                <Icon className={`inline-block mr-2 w-4 h-4 ${color}`} />
                {restText}
              </li>
            );
          }
          
          return <li {...props}>{children}</li>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function extractHeadings(content) {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(EMOJI_REGEX, "").trim();
    const id = slugify(text);
    
    headings.push({
      level,
      text,
      id
    });
  }

  return headings;
}

```

### Core Architecture Module: `open-sse/handlers/chatCore.js`
```
import { detectFormat, getTargetFormat, resolveTransport } from "../services/provider.js";
import { translateRequest } from "../translator/index.js";
import { applyThinking, extractThinking, stripThinkingSuffix } from "../translator/concerns/thinkingUnified.js";
import { FORMATS } from "../translator/formats.js";
import { normalizeClaudePassthrough, anchorClaudeCache } from "../translator/formats/claude.js";
import { createStreamController } from "../utils/streamHandler.js";
import { refreshWithRetry } from "../services/tokenRefresh.js";
import { createRequestLogger } from "../utils/requestLogger.js";
import { getModelTargetFormat, getModelSupportedFormats, getModelStrip, getModelUpstreamId, getModelType, PROVIDER_ID_TO_ALIAS } from "../config/providerModels.js";
import { PROVIDERS } from "../config/providers.js";
import { createErrorResult, parseUpstreamError, formatProviderError } from "../utils/error.js";
import { upstreamResponseHeaders } from "../utils/upstreamHeaders.js";
import { HTTP_STATUS, TOKEN_SAVER_HEADER } from "../config/runtimeConfig.js";
import { handleBypassRequest } from "../utils/bypassHandler.js";
import { trackPendingRequest, appendRequestLog, saveRequestDetail } from "@/lib/usageDb.js";
import { getExecutor } from "../executors/index.js";
import { supportsGrokCliReasoningEffort } from "../config/grokCli.js";
import { buildRequestDetail, extractRequestConfig } from "./chatCore/requestDetail.js";
import { handleForcedSSEToJson } from "./chatCore/sseToJsonHandler.js";
import { handleNonStreamingResponse } from "./chatCore/nonStreamingHandler.js";
import { handleStreamingResponse, buildOnStreamComplete } from "./chatCore/streamingHandler.js";
import { detectClientTool, isNativePassthrough } from "../utils/clientDetector.js";
import { dedupeTools } from "../utils/toolDeduper.js";
import { takeRenamedToolNames } from "../utils/opencodeFingerprint.js";
import { injectCaveman } from "../rtk/caveman.js";
import { injectPonytail } from "../rtk/ponytail.js";
import { compressMessages, formatRtkLog } from "../rtk/index.js";
import { compressWithHeadroom, formatHeadroomLog, formatHeadroomSizeLog, isHeadroomPhantomSavings } from "../rtk/headroom.js";
import { compressWithPxpipe } from "../rtk/pxpipe.js";
import { getCapabilitiesForModel } from "../providers/capabilities.js";
import { stripUnsupportedModalities } from "../translator/concerns/modality.js";
import { prefetchRemoteImages } from "../translator/concerns/prefetch.js";
import { defaultClaudeToolType, shouldDefaultClaudeToolType } from "../translator/concerns/toolCall.js";
import { resolveSessionId } from "../utils/sessionManager.js";

/**
 * Core chat handler - shared between SSE and Worker
 * @param {object} options.body - Request body
 * @param {object} options.modelInfo - { provider, model }
 * @param {object} options.credentials - Provider credentials
 * @param {string} options.sourceFormatOverride - Override detected source format (e.g. "openai-responses")
 */
/**
 * Remove translator-internal continuity fields from the outbound upstream
 * body. The Responses→Chat request translator stashes reasoning
 * `encrypted_content` on assistant messages so a later openai→responses
 * round-trip can restore the store=false continuity blob; that stash must
 * never reach an upstream provider. Chat-native proxies reject the unknown
 * assistant-message field and answer every turn with a literal "400" body
 * (observed with multi-turn Codex sessions via OpenAI-compatible nodes).
 */
export function stripContinuityFields(body) {
  if (!body || !Array.isArray(body.messages)) return body;
  for (const msg of body.messages) {
    if (msg && typeof msg === "object") {
      delete msg.encrypted_content;
      delete msg.reasoning_encrypted_content;
    }
  }
  return body;
}

export async function handleChatCore({ body, modelInfo, credentials, log, onCredentialsRefreshed, onRequestSuccess, onDisconnect, clientRawRequest, connectionId, userAgent, apiKey, ccFilterNaming, rtkEnabled, headroomEnabled, headroomUrl, headroomCompressUserMessages, headroomTimeoutMs, cavemanEnabled, cavemanLevel, ponytailEnabled, ponytailLevel, pxpipeEnabled, pxpipeMinChars, pxpipeTimeoutMs, pxpipeTransform, onPxpipeEvent, sourceFormatOverride, providerThinking, providerOverrides }) {
  const { provider, model } = modelInfo;
  const requestStartTime = Date.now();
  // Stable per-session color so all lines of one CLI conversation share a tag
  const sessionSeed = (() => {
    try {
      return resolveSessionId({ headers: clientRawRequest?.headers, body, connectionId, scope: provider });
    } catch {
      return connectionId || "";
    }
  })();
  const reqTag = log?.tagForSession ? log.tagForSession(sessionSeed) : (log?.nextTag ? log.nextTag() : "");

  const sourceFormat = sourceFormatOverride || detectFormat(body);

  // Check for bypass patterns (warmup, skip, cc naming)
  const bypassResponse = handleBypassRequest(body, model, userAgent, ccFilterNaming);
  if (bypassResponse) return bypassResponse;

  const alias = PROVIDER_ID_TO_ALIAS[provider] || provider;
  const modelTargetFormat = getModelTargetFormat(alias, model);
  // Multi-endpoint providers: pick transport matching sourceFormat → zero translation.
  // Per-model guard: only use the transport when the model declares support for that
  // sourceFormat — opencode-go models differ in endpoint support (kimi/glm only do
  // /chat/completions), so without this guard a claude-format request would wrongly
  // route kimi to /messages.
  const modelSupportedFormats = getModelSupportedFormats(alias, model);
  const runtimeTransport = resolveTransport(provider, sourceFormat);
  // Per-model guard: when a model declares supportedFormats, only use the
  // sourceFormat-matched transport if that format is declared (opencode-go models
  // differ — kimi/glm only do /chat/completions). Undeclared models keep the
  // upstream default (use the transport), preserving behavior for glm/deepseek/...
  const useTransport = (!modelSupportedFormats || modelSupportedFormats.includes(sourceFormat)) ? runtimeTransport : null;
  // A source-format-matched endpoint keeps the request lossless. Prefer it
  // over a model-level targetFormat, which is only the fallback for clients
  // whose wire format has no supported transport (for example MiniMax-M3:
  // OpenAI clients should stay on /chat/completions; other clients can fall
  // back to its declared Claude target).
  const targetFormat = useTransport?.format || modelTargetFormat || getTargetFormat(provider, credentials);
  if (useTransport && credentials) credentials.runtimeTransport = useTransport;
  const stripList = getModelStrip(alias, model);
  const upstreamModel = getModelUpstreamId(alias, model);

  // Inject provider-level thinking config override (only if client hasn't set)
  // on/off → extended type (body.thinking), none/low/medium/high → effort type (body.reasoning_effort)
  if (providerThinking?.mode && providerThinking.mode !== "auto") {
    const mode = providerThinking.mode;
    if (mode === "on" && !body.thinking) {
      console.log("Injecting provider-level thinking config override: on");
      body = { ...body, thinking: { type: "enabled", budget_tokens: 10000 } };
    } else if (mode === "off" && !body.thinking) {
      body = { ...body, thinking: { type: "disabled" } };
    } else if (!body.reasoning_effort) {
      body = { ...body, reasoning_effort: mode };
    }
  }

  // Per-request opt-out: client can bypass all token savers via header
  const tokenSaverEnabled = clientRawRequest?.headers?.[TOKEN_SAVER_HEADER]?.toLowerCase() !== "off";

  // Cursor's translator rewrites tool_result into user text, so RTK must run on
  // the source body before translation. Every other pair translates the tool
  // shapes 1:1 — keep the post-translate pass there so those providers are
  // untouched (and a retry never re-compresses an already-compressed body).
  const preTranslateRtk = provider === "cursor"
    ? compressMessages(body, tokenSaverEnabled && rtkEnabled)
    : null;
  const preTranslateRtkLine = formatRtkLog(preTranslateRtk);
  if (preTranslateRtkLine) console.log(preTranslateRtkLine);

  const clientRequestedStreaming = body.stream === true || sourceFormat === FORMATS.ANTIGRAVITY || sourceFormat === FORMATS.GEMINI || sourceFormat === FORMATS.GEMINI_CLI;
  const providerRequiresStreaming = PROVIDERS[provider]?.forceStream === true;
  let stream = providerRequiresStreaming ? true : (body.stream !== false);

  // Image generation models require non-streaming (Google v1internal:generateContent)
  const modelType = getModelType(alias, model);
  const isImageGenModel = modelType === "imageGen" || /image|imagen|image-generation/i.test(model);
  if (isImageGenModel && (provider === "antigravity" || provider === "gemini-cli")) {
    stream = false;
  }

  // DeepSeek-TUI: interactive TUI panel sends stream:true and needs SSE.
  // Non-interactive mode (-p flag) sends without stream and can't parse SSE.
  // Only force non-streaming when client didn't explicitly request it.
  const detectedTool = detectClientTool(clientRawRequest?.headers || {}, body);
  if (detectedTool === "deepseek-tui" && body.stream !== true) stream = false;

  // Check client Accept header preference for non-streaming requests
  // This fixes AI SDK compatibility where clients send Accept: application/json
  const acceptHeader = clientRawRequest?.headers?.accept || "";
  const clientPrefersJson = acceptHeader.includes("application/json");
  const clientPrefersSSE = acceptHeader.includes("text/event-stream");
  if (clientPrefersJson && !clientPrefersSSE && body.stream !== true && !providerRequiresStreaming) {
    stream = false;
  }

  const reqLogger = await createRequestLogger(sourceFormat, targetFormat, model);
  if (clientRawRequest) reqLogger.logClientRawRequest(clientRawRequest.endpoint, clientRawRequest.body, clientRawRequest.headers);
  reqLogger.logRawRequest(body);
  log?.debug?.("FORMAT", `$
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4599** (2026-10-05): **fix(claude): correct Opus 5.5 capabilities and pricing**
  *Symptoms*: ## Summary  Correct Claude Opus 5.5 metadata and request normalization.  - Set official Opus 5.5 pricing: $4 input / $20 output / $0.20 cache read / $5 5m cache write per MTok. - Mark Opus 5.5 thinking as always on and normalize unsupported forced tool choice, preventing upstream 400 responses. - Map internal `minimal` clamp to Claude-supported `low` effort. - Add focused unit coverage for registry, capabilities, pricing, thinking levels, forced tool normalization, and OpenAI-to-Claude translation.  ## Evidence  Official Anthropic docs: https://platform.claude.com/docs/en/models/opus-5-5/overview  `npx vitest run unit/claude-opus-5-5.test.js`: 9 passed.  `unit/capabilities.test.js` passed. `translator/thinking-unified.test.js` has an existing unrelated GLM-5.2 failure on upstream/master (`reasoning_effort` undefined); no changed Opus test fails.  Complements #4566; this PR fixes canonical Claude metadata used by Antigravity model IDs after #4566 lands.

- **Issue #4595** (2026-10-05): **[Bug] Codex Desktop / CLI subagent tools (`spawn_agent`) not exposed or forwarded, causing model fallback to terminal tools (herdr/claude/codex CLI)**
  *Symptoms*: ### Environment - **9Router Version:** Latest (0.4.x / master) - **Client:** Codex Desktop / Codex CLI - **Connection Mode:** Codex Desktop adapter via local proxy (`http://localhost:20128/v1`) - **Upstream Provider/Model:** OpenAI Responses API / Claude / Custom Combos  ---  ### Summary When connecting Codex Desktop to 9Router via the Codex adapter, the model is completely unaware of the native Codex Subagent harness. When prompted to delegate tasks or spawn a subagent, the agent attempts to run terminal-based multi-agent multiplexers (e.g., executing `herdr`, launching `claude`, or spawning background `codex` processes via bash) instead of invoking native subagent tools.  ### Root Cause Analysis Codex multi-agent / subagent orchestration does not rely solely on system prompt instructions. It requires explicit tool injection over the Responses API: 1. **Tool Definition Negotiation:** Codex expects the proxy/runtime to expose and negotiate `multi_agent_v2` capabilities (such as `spawn_agent`, `send_message`, `wait_agent`, `close_agent`). If 9Router does not return or pass through model metadata (`multi_agent_version: "v2"`), Codex disables subagent tools for the session. 2. **Custom / Encrypted Tool Schema:** When `multi_agent_v2` is active, parameter schemas like `spawn_agent.message` may contain non-standard attributes (e.g., `"encrypted": true`) and emit `custom_tool_call`. 9Router currently strips or misparses these schemas during format normalization. 3. **Agent Behavior

- **Issue #4592** (2026-10-05): **fix(grok): avoid inferring exhausted quota from zero spending cap**
  *Symptoms*: Zero spending cap treated as unknown allocation, not synthetic depleted or unlimited quota. Explicit prepaid and positive-cap exhausted usage retained. Existing Grok usage and four new regression cases validated: 19 tests passed, exit 0; git diff --check passed. CodeRabbit unavailable due reviewer sandbox CLI restrictions.

- **Issue #4590** (2026-10-05): **fix(grok): serialize tool calls for ordered workflows**
  *Symptoms*: ## Summary Force sequential tool execution for Grok CLI requests so shell and other side-effecting workflows retain their order. Remove parallel_tool_calls when no valid tools remain. Preserve upstream request normalization.  ## Validation - Targeted Vitest suite: 7 tests passed. - git diff --check passed. - CodeRabbit review attempted but reviewer sandbox rejected the CLI; no review result available.  No Cursor integration or production configuration changes.  Made with [Cursor](https://cursor.com)

- **Issue #4556** (2026-10-03): **[perf] requestDetails stores full request/response blobs per request and is never pruned (10 GB/year)**
  *Symptoms*: ## Summary  `requestDetails` stores the full request+response payload for every request (measured average **11,454 bytes**, max **25,324 bytes** on my install) and is **never pruned**. `usageHistory` also grows unbounded. Projected at 2,594 requests/day: **28.3 MB/day → 10.1 GB/year**.  The cost does not land on LLM request latency (writes stay sub-millisecond). It lands on:  1. Database file size, which inflates WAL checkpoint and copy/backup time. 2. The Usage dashboard queries, which get more expensive as the tables grow. 3. `VACUUM` / backup / file-copy operations on a multi-GB file.  ## Measured data  My install (`DATA_DIR=E:\project\database\9router`, `db/data.sqlite`):  | Table | Rows | Average size | |---|---|---| | `requestDetails.data` | 8,779 | **11,454 B** (max 25,324) | | `usageHistory` (whole row) | 20,142 | ~222 B | | `usageDaily` (per day) | 61 | 7,478 → 8,041 B |  Total file: **115.6 MB**.  ## Root cause  `internal/handlers/chat/usage.go:182-201` persists the whole request (20 messages x 500 chars) plus the whole response (10,000 chars) as one JSON blob:  ```go reqData, err := json.Marshal(map[string]any{ 	... 	"request":  map[string]any{"messages": reqMsgs}, 	"response": map[string]any{"content": respContent}, }) ... if err := h.Repo.InsertRequestDetail(reqID, info.Provider, info.Model, info.ConnectionID, "success", string(reqData)); err != nil { ```  The bounds are in `internal/constants/constants.go:58-60`:  ```go MaxResponseContentLen = 10000 MaxMessageCo
  **Post-Mortem & Fix Analysis**:
  > Posted to the wrong repository. These findings are against the Go implementation (`internal/db/usage.go`, `internal/handlers/chat/usage.go`), which lives at github.com/luqman-v1/9router-go — the file paths and code excerpts above do not exist in this upstream Next.js codebase. Closing here and re-filing at the correct repo.

- **Issue #4540** (2026-10-02): **New files from Fly.io Launch**
  *Symptoms*: 

- **Issue #4530** (2026-10-01): **feat(routing): add in-flight awareness and per-tab session isolation …**
  *Symptoms*: ### Summary Fixes stream interruptions and account collision when running parallel clients or multiple Claude Code tabs using Antigravity (Google) provider.  ### Problem 1. When multiple tabs send requests simultaneously, 9router routes them to the same account due to sticky round-robin / fill-first, triggering rate limits or stream dropouts. 2. Shared session seed causes Antigravity upstream to disconnect ongoing streams when a new tab connects.  ### Solution 1. **In-Flight Tracker (`src/sse/services/auth.js`)**: Prioritize idle connections (`inFlight === 0`) during account selection. Bypass sticky count if the current account is streaming. 2. **Session Isolation (`open-sse/executors/antigravity.js` & `chatCore.js`)**: Forward `x-claude-code-session-id` into `clientSessionId` and `buildIdeRequestId` so upstream treats each tab as an independent conversation. 3. **Lifecycle Cleanup (`open-sse/utils/streamHandler.js` & `nonStreamingHandler.js`)**: Decrement pending in-flight counter immediately on stream end / disconnect.

- **Issue #4508** (2026-10-01): **Grok CLI (Grok Build) error**
  *Symptoms*: HTTP 426: [426]: {"error":"Your Grok CLI version (0.2.99) is outdated. Please update to version 1.0.13 or later via `grok update` or the installation documentation."}

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

### Incident Patch 1: `fbcaa282` (2026-10-01)
**Commit Message**: fix(responses): bound the deferred completion wait with a 3s watchdog

A chat->responses stream defers response.completed waiting for a usage
trailer (PR #4476). A broken upstream that stalls after finish_reason —
no trailer, no [DONE], connection held open — made that wait unbounded.
Flush the pending completion after 3s instead. Normal paths (usage
trailer, [DONE], connection close) flush immediately and clear the
watchdog, so only a stalled stream ever pays the delay.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `open-sse/utils/stream.js` (modified, +34/-9)
```diff
@@ -22,6 +22,11 @@ const STREAM_MODE = {
   PASSTHROUGH: "passthrough" // No translation, normalize output, extract usage
 };
 
+// Upper bound on the deferred response.completed wait: a chat->responses stream
+// that saw finish_reason without usage must not hold the client's terminal event
+// forever when the upstream stalls with no usage trailer and no [DONE].
+const PENDING_COMPLETION_FLUSH_MS = 3000;
+
 /**
  * Create unified SSE transform stream
  * @param {object} options
@@ -83,10 +88,12 @@ export function createSSEStream(options = {}) {
   let openAIResponsesDoneSent = false;
   let streamDoneSent = false;  // track duplicate [DONE] across transform + flush
   let finalized = false;
+  let completionFlushTimer = null;
 
   // Usage/logging tail, callable from transform() as well as flush(): a client that
   // closes right after the terminal event cancels the reader, and flush() never runs.
   const finalizeStream = () => {
+    if (completionFlushTimer) { clearTimeout(completionFlushTimer); completionFlushTimer = null; }
     if (finalized) return;
     finalized = true;
 
@@ -112,6 +119,20 @@ export function createSSEStream(options = {}) {
     }
   };
 
+  // Emit the deferred response.completed now — at [DONE], or when the watchdog
+  // below gives up on a usage trailer that never arrives.
+  const flushPendingCompletion = (controller) => {
+    const completed = translateResponse(targetFormat, sourceFormat, null, state);
+    for (const item of completed || []) {
+      if (item === null || item === undefined) continue;
+      const output = formatSSE(item, sourceFormat);
+      reqLogger?.appendConvertedChunk?.(output);
+      controller.enqueue(sharedEncoder.encode(output));
+      sseEmittedCount++;
+    }
+    finalizeStream();
+  };
+
   return new TransformStream({
     transform(chunk, controller) {
       if (!ttftAt) ttftAt = Date.now();
@@ -271,15 +292,7 @@ export function createSSEStream(options = {}) {
           // if the upstream keeps the HTTP connection open, so finish now.
           if (targetFormat === FORMATS.OPENAI && sourceFormat === FORMATS.OPENAI_RESPONSES &&
               state.completionPending && !state.completedSent) {
-            const completed = translateResponse(targetFormat, sourceFormat, null, state);
-            for (const item of completed || []) {
-              if (item === null || item === undefined) continue;
-              const output = formatSSE(item, sourceFormat);
-              reqLogger?.appendConvertedChunk?.(output);
-              controller.enqueue(sharedEncoder.encode(output));
-              sseEmittedCount++;
-            }
-            finalizeStream();
+            flushPendingCompletion(controller);
           }
 
           // Synthesize response.failed if the Responses stream never sent a terminal event
@@ -393,6 +406,18 @@ export function createSSEStream(options = {}) {
             sseEmittedCount++;
           }
         }
+
+        // The completion deferral can outlive the upstream: a broken chat upstream
+        // may stall after finish_reason with no usage trailer and no [DONE], holding
+        // the connection open. Bound the wait so the client still gets a terminal event.
+        if (targetFormat === FORMATS.OPENAI && sourceFormat === FORMATS.OPENAI_RESPONSES &&
+            state?.completionPending && !state?.completedSent && !completionFlushTimer) {
+          completionFlushTimer = setTimeout(() => {
+            completionFlushTimer = null;
+            if (state?.completedSent) return;
+            try { flushPendingCompletion(controller); } catch { /* controller already closed */ }
+          }, PENDING_COMPLETION_FLUSH_MS);
+        }
       }
     },
 
```

**File**: `tests/unit/openai-responses-completion-watchdog.test.js` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { FORMATS } from "../../open-sse/translator/formats.js";
+import { createSSETransformStreamWithLogger } from "../../open-sse/utils/stream.js";
+
+// A chat->responses stream defers response.completed when finish_reason arrives
+// without usage (PR #4476). If the upstream then stalls — no usage trailer, no
+// [DONE], connection held open — that deferral must not wait forever: the
+// watchdog flushes the terminal event after PENDING_COMPLETION_FLUSH_MS.
+const encoder = new TextEncoder();
+
+const FINISH_CHUNK = {
+  id: "chatcmpl-1",
+  choices: [{ index: 0, delta: { content: "hi" }, finish_reason: "stop" }],
+};
+
+const USAGE_TRAILER = { id: "chatcmpl-1", choices: [], usage: { prompt_tokens: 120, completion_tokens: 30 } };
+
+function completedResponses(text) {
+  return text
+    .split("\n")
+    .filter((l) => l.startsWith("data: ") && l.includes('"type":"response.completed"'))
+    .map((l) => JSON.parse(l.slice(6)).response);
+}
+
+async function readAll(reader) {
+  const decoder = new TextDecoder();
+  let text = "";
+  while (true) {
+    const { value, done } = await reader.read();
+    if (done) break;
+    text += decoder.decode(value, { stream: true });
+  }
+  return text + decoder.decode();
+}
+
+async function pipe() {
+  let source;
+  const input = new ReadableStream({ start(c) { source = c; } });
+  const output = input.pipeThrough(
+    createSSETransformStreamWithLogger(FORMATS.OPENAI, FORMATS.OPENAI_RESPONSES, "test", null, null, "gpt-test"),
+  );
+  return { source, reader: output.getReader() };
+}
+
+describe("pending response.completed watchdog", () => {
+  it("flushes the deferred completion when the upstream stalls after finish_reason", async () => {
+    vi.useFakeTimers();
+    try {
+      const { source, reader } = await pipe();
+      source.enqueue(encoder.encode(`data: ${JSON.stringify(FINISH_CHUNK)}\n\n`));
+      await vi.advanceTimersByTimeAsync(20);
+
+      // No trailer, no [DONE] — only the watchdog can close this out.
+      await vi.advanceTimersByTimeAsync(3000);
+      source.close();
+
+      const completed = completedResponses(await readAll(reader));
+      expect(completed.length, "exactly one response.completed").toBe(1);
+      expect(completed[0].status).toBe("completed");
+      expect(completed[0].usage, "no usage was ever reported").toBeUndefined();
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+
+  it("does not fire after the real usage trailer already completed the stream", async () => {
+    vi.useFakeTimers();
+    try {
+      const { source, reader } = await pipe();
+      source.enqueue(encoder.encode(`data: ${JSON.stringify(FINISH_CHUNK)}\n\n`));
+      await vi.advanceTimersByTimeAsync(20);
+      source.enqueue(encoder.encode(`data: ${JSON.stringify(USAGE_TRAILER)}\n\n`));
+      await vi.advanceTimersByTimeAsync(20);
+
+      // Well past the watchdog window: nothing more may be emitted.
+      await vi.advanceTimersByTimeAsync(10000);
+      source.close();
+
+      const completed = completedResponses(await readAll(reader));
+      expect(completed.length, "exactly one response.completed").toBe(1);
+      expect(completed[0].usage).toMatchObject({ input_tokens: 120, output_tokens: 30 });
+    } finally {
+      vi.useRealTimers();
+    }
+  });
+});
```

---

### Incident Patch 2: `7111db35` (2026-10-01)
**Commit Message**: fix(responses): wait for real usage before emitting response.completed

**File**: `open-sse/translator/index.js` (modified, +5/-0)
```diff
@@ -287,6 +287,11 @@ export function initState(sourceFormat) {
       funcArgsDone: {},
       funcItemDone: {},
       customToolNames: new Set(),
+      // Chat Completions usage for response.completed. Not state.usage: other translators in
+      // the same pipeline overwrite that in their own shapes.
+      responsesUsage: null,
+      // finish_reason arrived before usage; response.completed waits for the usage chunk.
+      completionPending: false,
       completedSent: false
     };
   }
```

**File**: `open-sse/translator/response/openai-responses.js` (modified, +20/-13)
```diff
@@ -27,17 +27,22 @@ import { ROLE, OPENAI_BLOCK, RESPONSES_ITEM, OPENAI_FINISH, MODEL_FALLBACK } fro
 function toResponsesUsage(usage) {
   if (!usage || typeof usage !== "object") return null;
 
-  const inputTokens = [usage.input_tokens, usage.prompt_tokens].find(Number.isFinite) ?? 0;
-  const outputTokens = [usage.output_tokens, usage.completion_tokens].find(Number.isFinite) ?? 0;
+  const inputTokens = [usage.input_tokens, usage.prompt_tokens].find(Number.isInteger);
+  const outputTokens = [usage.output_tokens, usage.completion_tokens].find(Number.isInteger);
+  // Some upstreams attach zeroed placeholders to every chunk. Wait for real counts
+  // so response.completed cannot freeze the placeholder before the usage trailer.
+  if (inputTokens === undefined || outputTokens === undefined || inputTokens + outputTokens <= 0) {
+    return null;
+  }
   const responseUsage = {
     input_tokens: inputTokens,
     output_tokens: outputTokens,
-    total_tokens: Number.isFinite(usage.total_tokens) ? usage.total_tokens : inputTokens + outputTokens
+    total_tokens: inputTokens + outputTokens
   };
-  const cachedTokens = [usage.input_tokens_details?.cached_tokens, usage.prompt_tokens_details?.cached_tokens].find(Number.isFinite);
-  const reasoningTokens = [usage.output_tokens_details?.reasoning_tokens, usage.completion_tokens_details?.reasoning_tokens].find(Number.isFinite);
-  if (Number.isFinite(cachedTokens)) responseUsage.input_tokens_details = { cached_tokens: cachedTokens };
-  if (Number.isFinite(reasoningTokens)) responseUsage.output_tokens_details = { reasoning_tokens: reasoningTokens };
+  const cachedTokens = [usage.input_tokens_details?.cached_tokens, usage.prompt_tokens_details?.cached_tokens].find(Number.isInteger);
+  const reasoningTokens = [usage.output_tokens_details?.reasoning_tokens, usage.completion_tokens_details?.reasoning_tokens].find(Number.isInteger);
+  if (Number.isInteger(cachedTokens)) responseUsage.input_tokens_details = { cached_tokens: cachedTokens };
+  if (Number.isInteger(reasoningTokens)) responseUsage.output_tokens_details = { reasoning_tokens: reasoningTokens };
 
   return responseUsage;
 }
@@ -47,13 +52,14 @@ export function openaiToOpenAIResponsesResponse(chunk, state) {
     return flushEvents(state);
   }
 
-  // Capture upstream usage BEFORE the choices guard below: the last OpenAI chunk
-  // may carry usage together with an empty choices array, and it must not be dropped.
-  if (chunk.usage) {
-    state.responsesUsage = toResponsesUsage(chunk.usage);
-  }
+  // Capture usage before the choices guard: OpenAI may send it in a trailer
+  // whose choices array is empty.
+  const responseUsage = toResponsesUsage(chunk.usage);
+  if (responseUsage) state.responsesUsage = responseUsage;
 
-  if (!chunk.choices?.length) return [];
+  if (!chunk.choices?.length) {
+    return state.completionPending && state.responsesUsage ? flushEvents(state) : [];
+  }
 
   const events = [];
   const nextSeq = () => ++state.seq;
@@ -163,6 +169,7 @@ export function openaiToOpenAIResponsesResponse(chunk, state) {
     // would swallow the terminal event entirely. Keep the old behaviour there.
     const flushReachesUs = state.targetFormat === FORMATS.OPENAI;
     if (state.responsesUsage || !flushReachesUs) sendCompleted(state, emit);
+    else state.completionPending = true;
   }
 
   return events;
```

**File**: `open-sse/utils/stream.js` (modified, +16/-0)
```diff
@@ -266,6 +266,22 @@ export function createSSEStream(options = {}) {
         // For Ollama: done=true is the final chunk with finish_reason/usage, must translate
         // For other formats: done=true is the [DONE] sentinel, skip
         if (parsed && parsed.done && targetFormat !== FORMATS.OLLAMA) {
+          // A direct Chat-to-Responses translation can defer response.completed
+          // while waiting for a usage trailer. [DONE] ends that opportunity even
+          // if the upstream keeps the HTTP connection open, so finish now.
+          if (targetFormat === FORMATS.OPENAI && sourceFormat === FORMATS.OPENAI_RESPONSES &&
+              state.completionPending && !state.completedSent) {
+            const completed = translateResponse(targetFormat, sourceFormat, null, state);
+            for (const item of completed || []) {
+              if (item === null || item === undefined) continue;
+              const output = formatSSE(item, sourceFormat);
+              reqLogger?.appendConvertedChunk?.(output);
+              controller.enqueue(sharedEncoder.encode(output));
+              sseEmittedCount++;
+            }
+            finalizeStream();
+          }
+
           // Synthesize response.failed if the Responses stream never sent a terminal event
           if (keepsOpenAIResponsesFormat && !openAIResponsesTerminalSeen) {
             const failedOutput = formatIncompleteOpenAIResponsesStreamFailure();
```

**File**: `tests/unit/openai-responses-completed-usage.test.js` (added, +219/-0)
```diff
@@ -0,0 +1,219 @@
+import { describe, expect, it } from "vitest";
+
+import { FORMATS } from "../../open-sse/translator/formats.js";
+import { createSSETransformStreamWithLogger } from "../../open-sse/utils/stream.js";
+
+// Codex compacts its history only from the token usage reported on `response.completed`
+// (sess.get_total_token_usage). Without it Codex never compacts and eventually sends a
+// prompt larger than the model's context window.
+
+async function runTransform(targetFormat, lines) {
+  const encoder = new TextEncoder();
+  const stream = new ReadableStream({
+    start(controller) {
+      controller.enqueue(encoder.encode(lines.join("\n")));
+      controller.close();
+    },
+  });
+
+  const output = stream.pipeThrough(
+    createSSETransformStreamWithLogger(targetFormat, FORMATS.OPENAI_RESPONSES, "test", null, null, "test-model"),
+  );
+
+  const reader = output.getReader();
+  const decoder = new TextDecoder();
+  let text = "";
+  while (true) {
+    const { value, done } = await reader.read();
+    if (done) break;
+    text += decoder.decode(value, { stream: true });
+  }
+  return text + decoder.decode();
+}
+
+// Parse the client-facing SSE into [{ event, data }], skipping the [DONE] sentinel.
+function parseEvents(text) {
+  return text
+    .split("\n\n")
+    .map((block) => {
+      const event = block.match(/^event: (.+)$/m)?.[1];
+      const data = block.match(/^data: (.+)$/m)?.[1];
+      if (!event || !data || data === "[DONE]") return null;
+      return { event, data: JSON.parse(data) };
+    })
+    .filter(Boolean);
+}
+
+const sse = (data) => [`data: ${JSON.stringify(data)}`, ""];
+const claudeSse = (data) => [`event: ${data.type}`, `data: ${JSON.stringify(data)}`, ""];
+
+// Mirrors ResponseCompletedUsage in codex-rs/codex-api/src/sse/responses.rs. The three totals
+// are required i64s and the details are optional, but each detail field is a required i64
+// when present. Any deviation fails Codex's parse of the whole event, killing the turn.
+function expectCodexUsageShape(usage) {
+  for (const field of ["input_tokens", "output_tokens", "total_tokens"]) {
+    expect(Number.isInteger(usage[field]), field).toBe(true);
+  }
+  if (usage.input_tokens_details) {
+    expect(Number.isInteger(usage.input_tokens_details.cached_tokens)).toBe(true);
+  }
+  if (usage.output_tokens_details) {
+    expect(Number.isInteger(usage.output_tokens_details.reasoning_tokens)).toBe(true);
+  }
+}
+
+describe("Responses response.completed reports token usage", () => {
+  it("reports Claude upstream usage to a Codex client, counting cached prompt tokens", async () => {
+    const events = parseEvents(await runTransform(FORMATS.CLAUDE, [
+      ...claudeSse({
+        type: "message_start",
+        message: {
+          id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5", content: [],
+          usage: { input_tokens: 1000, cache_read_input_tokens: 200, cache_creation_input_tokens: 0, output_tokens: 1 },
+        },
+      }),
+      ...claudeSse({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
+      ...claudeSse({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } }),
+      ...claudeSse({ type: "content_block_stop", index: 0 }),
+      ...claudeSse({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 50 } }),
+      ...claudeSse({ type: "message_stop" }),
+    ]));
+
+    const completed = events.filter((e) => e.event === "response.completed");
+    expect(completed).toHaveLength(1);
+
+    const usage = completed[0].data.response.usage;
+    expectCodexUsageShape(usage);
+    expect(usage).toMatchObject({
+      input_tokens: 1200,
+      output_tokens: 50,
+      total_tokens: 1250,
+      input_tokens_details: { cached_tokens: 200 },
+    });
+  });
+
+  it("waits for a trailing usage-only chunk instead of completing on finish_reason", async () => {
+    const events = parseEvents(await runTransform(FORMATS.OPENAI, [
+      ...sse({ id: "c1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: "Hi" } }] }),
+      ...sse({ id: "c1", object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
+      ...sse({
+        id: "c1", object: "chat.completion.chunk", choices: [],
+        usage: {
+          prompt_tokens: 300, completion_tokens: 20, total_tokens: 320,
+          prompt_tokens_details: { cached_tokens: 100 },
+          completion_tokens_details: { reasoning_tokens: 5 },
+        },
+      }),
+      "data: [DONE]",
+      "",
+    ]));
+
+    const completed = events.filter((e) => e.event === "response.completed");
+    expect(completed).toHaveLength(1);
+    // Terminal event last: Codex stops reading at response.completed.
+    expect(events.at(-1).event).toBe("response.completed");
+
+    const usage = completed[0].data.response.usage;
+    expectCodexUsageShape(usage);

```

**File**: `tests/unit/openai-responses-usage-pivot.test.js` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+import { describe, expect, it } from "vitest";
+
+import { FORMATS } from "../../open-sse/translator/formats.js";
+import { createSSETransformStreamWithLogger } from "../../open-sse/utils/stream.js";
+
+/**
+ * Usage must survive the PIVOT, not just the direct openai:openai-responses route.
+ *
+ * Codex talks the Responses API, so routing it at a Claude connection runs
+ * claude -> openai -> openai-responses. The converter that attaches usage to
+ * response.completed is the second hop, and it only ever sees the intermediate
+ * OpenAI chunk — so whether Codex learns its context size depends on the first
+ * hop putting usage on that intermediate chunk.
+ *
+ * Signature is (targetFormat, sourceFormat, ...) — targetFormat is what the
+ * UPSTREAM speaks, sourceFormat is what the CLIENT speaks.
+ */
+async function runTransform(chunks, targetFormat, provider) {
+  const encoder = new TextEncoder();
+  const input = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("");
+
+  const stream = new ReadableStream({
+    start(controller) {
+      controller.enqueue(encoder.encode(input));
+      controller.close();
+    },
+  });
+
+  const output = stream.pipeThrough(
+    createSSETransformStreamWithLogger(
+      targetFormat,
+      FORMATS.OPENAI_RESPONSES,
+      provider,
+      null,
+      null,
+      "claude-sonnet-5",
+    ),
+  );
+
+  const reader = output.getReader();
+  const decoder = new TextDecoder();
+  let text = "";
+
+  while (true) {
+    const { value, done } = await reader.read();
+    if (done) break;
+    text += decoder.decode(value, { stream: true });
+  }
+
+  text += decoder.decode();
+  return text;
+}
+
+function completedResponse(output) {
+  const lines = output
+    .split("\n")
+    .filter((l) => l.startsWith("data: ") && l.includes('"type":"response.completed"'));
+  expect(lines.length, "expected exactly one response.completed").toBe(1);
+  return JSON.parse(lines[0].slice(6)).response;
+}
+
+// Anthropic splits the counts across two events: message_start carries the whole
+// prompt side (input + both cache buckets), message_delta carries only the output
+// side. Neither event alone is the total, which is why the claude converter merges
+// them into state before emitting the intermediate chunk.
+const CLAUDE_CHUNKS_WITH_USAGE = [
+  {
+    type: "message_start",
+    message: {
+      id: "msg_01CfUtmFqMv3Gc5s66ehaTK",
+      model: "claude-sonnet-5",
+      usage: {
+        input_tokens: 1500,
+        cache_read_input_tokens: 12000,
+        cache_creation_input_tokens: 300,
+        output_tokens: 1,
+      },
+    },
+  },
+  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
+  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hi" } },
+  { type: "content_block_stop", index: 0 },
+  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 42 } },
+  { type: "message_stop" },
+];
+
+describe("OpenAI Responses usage across the pivot", () => {
+  // The reported failure: a Codex session on a Claude connection grew unbounded
+  // (101 -> 503 -> 631 messages) until Anthropic rejected it with
+  // "prompt is too long: 1676806 tokens > 1000000 maximum", because every
+  // token_count event Codex recorded had info: null.
+  it("reports claude usage on response.completed so Codex can auto-compact", async () => {
+    const output = await runTransform(CLAUDE_CHUNKS_WITH_USAGE, FORMATS.CLAUDE, "claude");
+
+    // prompt side = input + cache_read + cache_creation = 1500 + 12000 + 300.
+    expect(completedResponse(output).usage).toEqual({
+      input_tokens: 13800,
+      output_tokens: 42,
+      total_tokens: 13842,
+      input_tokens_details: { cached_tokens: 12000 },
+    });
+  });
+
+  // Codex deserializes usage into a struct whose three top-level counts are all
+  // required, so dropping any one of them discards the whole object and leaves the
+  // context gauge empty — the same end state as reporting nothing.
+  it("always reports all three top-level counts", async () => {
+    const output = await runTransform(CLAUDE_CHUNKS_WITH_USAGE, FORMATS.CLAUDE, "claude");
+    const usage = completedResponse(output).usage;
+
+    for (const field of ["input_tokens", "output_tokens", "total_tokens"]) {
+      expect(usage, `missing ${field}`).toHaveProperty(field);
+      expect(Number.isFinite(usage[field]), `${field} must be a number`).toBe(true);
+    }
+  });
+});
```

---

### Incident Patch 3: `5e9bd464` (2026-10-01)
**Commit Message**: fix(claude): preserve intentional prefill from non-messages[] source formats

translateRequest detected the client's terminal role only from messages[],
so a Gemini contents[] or Responses input[] body ending on an explicit
model/assistant turn (real prefill) read as undefined and got the
"Continue." restoration appended, clobbering the prefill. Map the trailing
role per source shape; only model/assistant counts as prefill — every other
tail stays undefined so the emptied-turn fix still applies.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `open-sse/translator/index.js` (modified, +16/-1)
```diff
@@ -9,6 +9,7 @@ import { applyThinking, captureThinking } from "./concerns/thinkingUnified.js";
 import { captureSessionId } from "../utils/sessionManager.js";
 import { AntigravityExecutor } from "../executors/antigravity.js";
 import { PROVIDERS } from "../providers/index.js";
+import { ROLE, GEMINI_ROLE } from "./schema/roles.js";
 
 // Registry for translators. Lazy-init guards against circular-import order:
 // translator modules call register() (side-effect) before this module's body runs.
@@ -49,12 +50,26 @@ function stripContentTypes(body, stripList = []) {
   }
 }
 
+// Role the client's conversation actually ended on, in the source format's own
+// shape — not every source uses messages[] (Gemini/Antigravity: contents[],
+// Responses/Codex: input[]). Only an explicit trailing model/assistant turn is
+// real prefill and must reach ensureTrailingUserTurn as ROLE.ASSISTANT; every
+// other tail (including no role, e.g. a function output) stays undefined so
+// the emptied-turn fix still applies.
+function detectClientLastRole(body) {
+  if (Array.isArray(body?.messages)) return body.messages[body.messages.length - 1]?.role;
+  const items = Array.isArray(body?.contents) ? body.contents : Array.isArray(body?.input) ? body.input : null;
+  if (!items) return undefined;
+  const role = items[items.length - 1]?.role;
+  return role === ROLE.ASSISTANT || role === GEMINI_ROLE.MODEL ? ROLE.ASSISTANT : undefined;
+}
+
 // Translate request: source -> openai -> target
 export function translateRequest(sourceFormat, targetFormat, model, body, stream = true, credentials = null, provider = null, reqLogger = null, stripList = [], connectionId = null, clientTool = null) {
   ensureInitialized();
   let result = body;
   // Role the client actually ended on, before any translator drops an emptied turn.
-  const clientLastRole = Array.isArray(body?.messages) ? body.messages[body.messages.length - 1]?.role : undefined;
+  const clientLastRole = detectClientLastRole(body);
 
   // Strip explicit content types (opt-in via strip[] in PROVIDER_MODELS entry)
   stripContentTypes(result, stripList);
```

**File**: `tests/unit/claude-trailing-user-turn-source-formats.test.js` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+// Non-messages[] sources (Gemini contents[], Responses input[]) carry the client's
+// terminal role in their own shape. An explicit trailing model/assistant turn is real
+// prefill and must survive translation to Claude; an emptied trailing user turn must
+// still get the "Continue." restoration.
+import { describe, it, expect } from "vitest";
+import { translateRequest } from "../../open-sse/translator/index.js";
+
+const roles = (body) => body.messages.map((m) => m.role);
+
+describe("trailing user turn: non-messages[] source formats", () => {
+  it("keeps a Gemini trailing model turn (real prefill)", () => {
+    const out = translateRequest("gemini", "claude", "claude-sonnet-4-5", {
+      contents: [
+        { role: "user", parts: [{ text: "hi" }] },
+        { role: "model", parts: [{ text: "The answer is" }] },
+      ],
+    }, false);
+    expect(roles(out)).toEqual(["user", "assistant"]);
+  });
+
+  it("keeps a Responses trailing assistant message (real prefill)", () => {
+    const out = translateRequest("openai-responses", "claude", "claude-sonnet-4-5", {
+      model: "claude-sonnet-4-5",
+      input: [
+        { role: "user", content: "hi" },
+        { role: "assistant", content: "The answer is" },
+      ],
+    }, false);
+    expect(roles(out)).toEqual(["user", "assistant"]);
+  });
+
+  it("still restores a user turn when a Gemini trailing user turn is emptied", () => {
+    const out = translateRequest("gemini", "claude", "claude-sonnet-4-5", {
+      contents: [
+        { role: "user", parts: [{ text: "hi" }] },
+        { role: "model", parts: [{ text: "hello" }] },
+        { role: "user", parts: [] },
+      ],
+    }, false);
+    expect(roles(out)).toEqual(["user", "assistant", "user"]);
+  });
+});
```

---

### Incident Patch 4: `75834e96` (2026-10-01)
**Commit Message**: fix(claude): keep a trailing user turn so cleanup never yields assistant prefill

Newer Claude models reject a body that ends on an assistant turn. The
empty-message cleanups in prepareClaudeRequest and normalizeClaudePassthrough
protect a trailing assistant but not a trailing user turn, so an emptied last
user turn silently made the previous assistant turn the last one.
ensureTrailingUserTurn appends a minimal user turn ("Continue.") only when the
client did not itself end on assistant, in both cleanup paths and in
translateRequest against the role the client actually sent.

**File**: `open-sse/translator/formats/claude.js` (modified, +18/-0)
```diff
@@ -226,6 +226,8 @@ export function normalizeClaudePassthrough(body, model = "") {
     if (Object.keys(body.output_config).length === 0) delete body.output_config;
   }
 
+  const originalLastRole = Array.isArray(body.messages) ? body.messages[body.messages.length - 1]?.role : undefined;
+
   // 3. Wrap bare content-block objects as one-element arrays before folding.
   // Some clients send content: {block} instead of content: [{block}]; the
   // mid-conversation-system fold below assumes the array shape, so it must
@@ -327,11 +329,25 @@ export function normalizeClaudePassthrough(body, model = "") {
         !(block?.type === CLAUDE_BLOCK.TEXT && !String(block.text ?? "").trim()));
       return msg.content.length > 0;
     });
+    body.messages = ensureTrailingUserTurn(body.messages, originalLastRole);
   }
 
   return body;
 }
 
+// Newer Claude models reject a body that ends on an assistant turn ("does not
+// support assistant message prefill"). Cleanup passes delete messages left empty,
+// so a trailing user turn that was empty (or held only dropped blocks) silently
+// turns the previous assistant turn into the last one. Restore a user turn only
+// when the client did not itself end on assistant (real prefill is its choice).
+const TRAILING_USER_PLACEHOLDER = "Continue.";
+
+export function ensureTrailingUserTurn(messages, originalLastRole) {
+  if (!Array.isArray(messages) || originalLastRole === ROLE.ASSISTANT) return messages;
+  if (messages[messages.length - 1]?.role !== ROLE.ASSISTANT) return messages;
+  return [...messages, { role: ROLE.USER, content: [{ type: CLAUDE_BLOCK.TEXT, text: TRAILING_USER_PLACEHOLDER }] }];
+}
+
 // Put a 5m breakpoint on the last cache-eligible block of a message.
 // thinking/redacted_thinking blocks do not accept cache_control.
 function markLastCacheableBlock(msg) {
@@ -524,6 +540,7 @@ export function prepareClaudeRequest(body, provider = null, apiKey = null, conne
   // 2. Messages: process in optimized passes
   if (body.messages && Array.isArray(body.messages)) {
     const len = body.messages.length;
+    const originalLastRole = body.messages[len - 1]?.role;
     let filtered = [];
 
     // Pass 1: remove cache_control + filter empty messages
@@ -548,6 +565,7 @@ export function prepareClaudeRequest(body, provider = null, apiKey = null, conne
     // Pass 1.5: Fix tool_use/tool_result ordering
     // Each tool_use must have tool_result in the NEXT message (not same message with other content)
     filtered = fixToolUseOrdering(filtered);
+    filtered = ensureTrailingUserTurn(filtered, originalLastRole);
 
     body.messages = filtered;
 
```

**File**: `open-sse/translator/index.js` (modified, +4/-1)
```diff
@@ -1,6 +1,6 @@
 import { FORMATS } from "./formats.js";
 import { ensureToolCallIds, fixMissingToolResponses } from "./concerns/toolCall.js";
-import { prepareClaudeRequest } from "./formats/claude.js";
+import { prepareClaudeRequest, ensureTrailingUserTurn } from "./formats/claude.js";
 import { cloakClaudeTools, decloakStreamChunk } from "../utils/claudeCloaking.js";
 import { restoreToolNames } from "../utils/opencodeFingerprint.js";
 import { filterToOpenAIFormat } from "./formats/openai.js";
@@ -53,6 +53,8 @@ function stripContentTypes(body, stripList = []) {
 export function translateRequest(sourceFormat, targetFormat, model, body, stream = true, credentials = null, provider = null, reqLogger = null, stripList = [], connectionId = null, clientTool = null) {
   ensureInitialized();
   let result = body;
+  // Role the client actually ended on, before any translator drops an emptied turn.
+  const clientLastRole = Array.isArray(body?.messages) ? body.messages[body.messages.length - 1]?.role : undefined;
 
   // Strip explicit content types (opt-in via strip[] in PROVIDER_MODELS entry)
   stripContentTypes(result, stripList);
@@ -132,6 +134,7 @@ export function translateRequest(sourceFormat, targetFormat, model, body, stream
   if (targetFormat === FORMATS.CLAUDE) {
     const apiKey = credentials?.accessToken || credentials?.apiKey || null;
     result = prepareClaudeRequest(result, provider, apiKey, connectionId, credentials?.rawHeaders, clientSessionId);
+    if (Array.isArray(result?.messages)) result.messages = ensureTrailingUserTurn(result.messages, clientLastRole);
   }
 
   // Claude cloaking: rename client tools with CLAUDE_TOOL_SUFFIX (anti-ban)
```

**File**: `tests/unit/claude-trailing-user-turn.test.js` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+// Anthropic rejects a body ending on an assistant turn ("This model does not support
+// assistant message prefill"). Cleanup passes delete emptied messages, so an emptied
+// trailing user turn used to leave the previous assistant turn last.
+import { describe, it, expect } from "vitest";
+import { normalizeClaudePassthrough, prepareClaudeRequest } from "../../open-sse/translator/formats/claude.js";
+import { translateRequest } from "../../open-sse/translator/index.js";
+
+const roles = (body) => body.messages.map((m) => m.role);
+const history = (last) => [
+  { role: "user", content: "hi" },
+  { role: "assistant", content: [{ type: "text", text: "hello" }] },
+  last,
+];
+
+const emptyLastTurns = {
+  "empty string": { role: "user", content: "" },
+  "blank text block": { role: "user", content: [{ type: "text", text: "  " }] },
+  "empty content array": { role: "user", content: [] },
+  "unsupported block only": { role: "user", content: [{ type: "search_result", source: "x", title: "t", content: [] }] },
+};
+
+describe("trailing user turn survives empty-message cleanup", () => {
+  for (const [name, last] of Object.entries(emptyLastTurns)) {
+    it(`prepareClaudeRequest: ${name}`, () => {
+      const out = prepareClaudeRequest({ model: "claude-opus-4-5", max_tokens: 100, messages: history(last) }, "claude");
+      expect(roles(out)).toEqual(["user", "assistant", "user"]);
+    });
+    it(`normalizeClaudePassthrough: ${name}`, () => {
+      const out = normalizeClaudePassthrough({ model: "claude-opus-4-5", messages: history(last) }, "claude-opus-4-5");
+      expect(roles(out)).toEqual(["user", "assistant", "user"]);
+    });
+  }
+
+  it("passthrough: tool_result of a dropped foreign server_tool_use no longer empties the last turn into prefill", () => {
+    const out = normalizeClaudePassthrough({
+      model: "claude-opus-4-5",
+      messages: [
+        { role: "user", content: "analyze" },
+        { role: "assistant", content: [{ type: "server_tool_use", id: "call_abc", name: "analyze_image", input: {} }, { type: "text", text: "done" }] },
+        { role: "user", content: [{ type: "web_search_tool_result", tool_use_id: "call_abc", content: [] }] },
+      ],
+    }, "claude-opus-4-5");
+    expect(roles(out)).toEqual(["user", "assistant", "user"]);
+  });
+
+  it("full pipeline: OpenAI client with an empty last user message", () => {
+    const out = translateRequest("openai", "claude", "claude-opus-4-5", {
+      model: "x", max_tokens: 100,
+      messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }, { role: "user", content: "" }],
+    }, true, null, "claude");
+    expect(out.messages.at(-1).role).toBe("user");
+  });
+
+  it("full pipeline: Claude client with a blank last user block", () => {
+    const out = translateRequest("claude", "claude", "claude-opus-4-5", {
+      model: "x", max_tokens: 100, messages: history({ role: "user", content: [{ type: "text", text: "" }] }),
+    }, true, null, "claude");
+    expect(out.messages.at(-1).role).toBe("user");
+  });
+
+  it("leaves intentional client prefill (last turn is assistant) untouched", () => {
+    const body = { model: "claude-opus-4-5", max_tokens: 100, messages: [
+      { role: "user", content: "hi" },
+      { role: "assistant", content: [{ type: "text", text: "Sure:" }] },
+    ] };
+    expect(roles(prepareClaudeRequest(structuredClone(body), "claude"))).toEqual(["user", "assistant"]);
+    expect(roles(normalizeClaudePassthrough(structuredClone(body), "claude-opus-4-5"))).toEqual(["user", "assistant"]);
+  });
+
+  it("does not append anything when the last user turn has content", () => {
+    const out = prepareClaudeRequest({ model: "claude-opus-4-5", max_tokens: 100, messages: history({ role: "user", content: "next" }) }, "claude");
+    expect(roles(out)).toEqual(["user", "assistant", "user"]);
+    expect(out.messages.at(-1).content[0].text).toBe("next");
+  });
+});
```

---

### Incident Patch 5: `89ffac5a` (2026-10-01)
**Commit Message**: fix(capabilities): publish real GPT-6/GPT-5.4+ context windows and combo token limits

**File**: `open-sse/providers/capabilities.js` (modified, +40/-7)
```diff
@@ -6,15 +6,18 @@
 //   3. PATTERN_CAPABILITIES                     — glob match, ordered specific -> generic
 //   4. DEFAULT_CAPABILITIES                     — safe floor (always returned)
 //
-// Two extra layers then refine the result, and neither can override the hand
-// written tables above (steps 1-2 short-circuit before they are consulted):
+// Two extra layers then refine the result:
 //   • the synced catalog — modalities keyed by model, limits keyed by provider
 //     + model, refreshed from models.dev in the background. It reads a file, so
 //     the server installs it via setCatalogSource(); this module stays free of
 //     node:fs because the dashboard bundles it into the browser too.
 //   • visionPatterns.js — name-based vision detection, last resort so a model
 //     nobody has catalogued yet still accepts images.
-// Both only ever turn a capability ON.
+// Modalities only ever turn a capability ON. Limits from the catalog overlay
+// the canonical exact entry (step 2) so a gateway-specific models.dev delta
+// (Copilot's 32k Claude output, etc.) actually publishes. Step 1 still
+// short-circuits: a hand-written PROVIDER_CAPABILITIES truncation is the
+// gateway's own number and must not be overwritten.
 //
 // ── HOW TO ADD / UPDATE A MODEL ──────────────────────────────────────
 // Authoritative data source: https://models.dev/api.json (145 providers, 4000+
@@ -165,6 +168,11 @@ const CODEX_GPT_56_SOL_CAPS  = { vision: true, reasoning: true, search: true, th
 const CODEX_GPT_56_DEFAULT_CAPS = { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 272000, maxOutput: 128000 };
 const CODEX_EXTENDED_CAPS = { ...CODEX_GPT_56_DEFAULT_CAPS, contextWindow: 872000 };
 
+// Devin CLI's registry declares a 200k context window for these GPT variants.
+// Keep the GPT feature/output fields because provider overrides short-circuit
+// the generic pattern rather than merging with it.
+const DEVIN_CLI_GPT_CAPS = { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 200000, maxOutput: 128000 };
+
 /**
  * Provider-specific capability overrides. Keyed by provider alias/id.
  */
@@ -215,6 +223,15 @@ export const PROVIDER_CAPABILITIES = {
     "gpt-5.6-terra-thinking-agentic": KIRO_GPT_5_6_CAPABILITIES,
     "gpt-5.6-luna-thinking-agentic": KIRO_GPT_5_6_CAPABILITIES,
   },
+  "devin-cli": {
+    "gpt-5.4-high": DEVIN_CLI_GPT_CAPS,
+    "gpt-5.4-medium": DEVIN_CLI_GPT_CAPS,
+    "gpt-5.4-low": DEVIN_CLI_GPT_CAPS,
+    "gpt-5.5-xhigh": DEVIN_CLI_GPT_CAPS,
+    "gpt-5.5-high": DEVIN_CLI_GPT_CAPS,
+    "gpt-5.5-medium": DEVIN_CLI_GPT_CAPS,
+    "gpt-5.5-low": DEVIN_CLI_GPT_CAPS,
+  },
   // CodeBuddy.cn — authoritative per-model metadata from the gateway's model
   // config (contextWindow=maxInputTokens, maxOutput=maxOutputTokens, vision=
   // supportsImages). Every model reasons via OpenAI-style reasoning_effort
@@ -278,6 +295,8 @@ export const PROVIDER_CAPABILITIES = {
 // the intl Qoder capability table verbatim (vision/reasoning/contextWindow).
 PROVIDER_CAPABILITIES["qoder-cn"] = PROVIDER_CAPABILITIES["qoder"];
 PROVIDER_CAPABILITIES.cx = PROVIDER_CAPABILITIES.codex;
+PROVIDER_CAPABILITIES.dv = PROVIDER_CAPABILITIES["devin-cli"];
+PROVIDER_CAPABILITIES.devin = PROVIDER_CAPABILITIES["devin-cli"];
 
 /**
  * Pattern fallback — glob (* = wildcard), matched case-insensitively and
@@ -315,11 +334,24 @@ export const PATTERN_CAPABILITIES = [
   { pattern: "*nanobanana*",    caps: { vision: true, imageOutput: true } },
 
   // ── OpenAI GPT-6.x (vision + thinking + web search) ──────────────
-  { pattern: "*gpt-6*",         caps: { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 272000, maxOutput: 128000 } },
+  // 1.05M is the API window for the whole gpt-6 family (astra, luna, sol alike).
+  // A gateway that truncates lower records its own number in
+  // PROVIDER_CAPABILITIES, which wins over this pattern — Kiro at 272k, Codex
+  // OAuth at 272k/372k (see CODEX_GPT_56_* above). This entry used to carry
+  // Kiro's 272k, so every other provider's gpt-6 models inherited one gateway's
+  // limit and were published at 3.9x under their real window.
+  { pattern: "*gpt-6*",         caps: { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 1050000, maxOutput: 128000 } },
 
   // ── OpenAI GPT-5.x (vision + thinking + web search) ──────────────
   { pattern: "*gpt-5*image*",   caps: { imageOutput: true } },
   { pattern: "*gpt-5*codex*",   caps: { reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 400000, maxOutput: 128000 } },
+  // gpt-5.4 is where the 1.05M window starts, but the mini and nano tiers stayed
+  // at 400k — first match wins, so those two have to be listed ahead of it.
+  { pattern: "*gpt-5.4-mini*",  caps: { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 400000, maxOutput: 128000 } },
+  { p
```

**File**: `src/app/api/v1/models/route.js` (modified, +70/-5)
```diff
@@ -1,5 +1,6 @@
 import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS, getModelKind } from "@/shared/constants/models";
 import {
+  ALIAS_TO_ID,
   AI_PROVIDERS,
   getProviderAlias,
   isAnthropicCompatibleProvider,
@@ -40,6 +41,22 @@ async function resolveQoderLiveModels(conn, provider) {
   return { models: models.map((m) => ({ id: m.id, name: m.name })) };
 }
 
+// Combo seats use UI aliases; the model registry also has transport aliases.
+// Capability overrides and catalog limits are keyed by provider id.
+const ALIAS_TO_PROVIDER_ID = {
+  ...Object.fromEntries(
+    Object.entries(PROVIDER_ID_TO_ALIAS).map(([id, alias]) => [alias, id])
+  ),
+  ...ALIAS_TO_ID,
+};
+
+function comboSeatCapabilities(seat) {
+  const slash = seat.indexOf("/");
+  if (slash <= 0) return null;
+  const alias = seat.slice(0, slash);
+  return getCapabilitiesForModel(ALIAS_TO_PROVIDER_ID[alias] || alias, seat.slice(slash + 1));
+}
+
 // Per-provider live model resolvers. Each receives a connection record and
 // returns { models: [{ id, name? }, ...] } | null on failure.
 // Adding a provider here makes /v1/models prefer the live catalog for it.
@@ -254,6 +271,47 @@ function comboMatchesKinds(combo, kindFilter) {
   return kindFilter.includes(kind);
 }
 
+// Nested combo names are valid seats — the model selector exposes them and
+// chat routing resolves them recursively — but a no-slash seat is otherwise
+// treated as a literal model and publishes the 200k floor. Expand nested
+// names (cycle-guarded) so the published window is the true min across the
+// whole chain.
+function comboSeatLimits(combo, combosByName, visiting = new Set()) {
+  const name = typeof combo?.name === "string" ? combo.name : null;
+  if (name) {
+    if (visiting.has(name)) return { contextWindow: undefined, maxOutput: undefined };
+    visiting.add(name);
+  }
+
+  let contextWindow = Infinity;
+  let maxOutput = Infinity;
+  try {
+    for (const seat of Array.isArray(combo?.models) ? combo.models : []) {
+      if (typeof seat !== "string") continue;
+      const slash = seat.indexOf("/");
+      if (slash <= 0) {
+        const nested = combosByName.get(seat);
+        if (nested) {
+          const nestedLimits = comboSeatLimits(nested, combosByName, visiting);
+          if (Number.isFinite(nestedLimits.contextWindow)) contextWindow = Math.min(contextWindow, nestedLimits.contextWindow);
+          if (Number.isFinite(nestedLimits.maxOutput)) maxOutput = Math.min(maxOutput, nestedLimits.maxOutput);
+          continue;
+        }
+      }
+      const caps = comboSeatCapabilities(seat) || getCapabilitiesForModel(null, seat);
+      if (Number.isFinite(caps?.contextWindow)) contextWindow = Math.min(contextWindow, caps.contextWindow);
+      if (Number.isFinite(caps?.maxOutput)) maxOutput = Math.min(maxOutput, caps.maxOutput);
+    }
+  } finally {
+    if (name) visiting.delete(name);
+  }
+
+  return {
+    contextWindow: Number.isFinite(contextWindow) ? contextWindow : undefined,
+    maxOutput: Number.isFinite(maxOutput) ? maxOutput : undefined,
+  };
+}
+
 /**
  * Build OpenAI-format models list filtered by service kinds.
  * @param {string[]} kindFilter - List of service kinds to include (e.g. ["llm"], ["webSearch","webFetch"]).
@@ -308,6 +366,9 @@ export async function buildModelsList(kindFilter, options = {}) {
   }
 
   const models = [];
+  const combosByName = new Map(
+    combos.filter((c) => typeof c?.name === "string").map((c) => [c.name, c]),
+  );
 
   // Lookup map so aggregateComboCapabilities can recursively resolve nested combos
   const comboByName = Object.fromEntries(combos.map((c) => [c.name, c.models]));
@@ -323,19 +384,23 @@ export async function buildModelsList(kindFilter, options = {}) {
     if (combo.kind === "webSearch" || combo.kind === "webFetch") {
       entry.kind = combo.kind;
     } else {
-      const comboCaps = aggregateComboCapabilities(combo.models, comboByName);
+      const comboCaps = aggregateComboCapabilities(combo.models, comboByName, comboSeatCapabilities);
       if (comboCaps) entry.capabilities = comboCaps;
+      // Any seat can serve the request, so the only window a combo can promise is
+      // its smallest. Combo entries were the only models on this endpoint that
+      // published no limits at all, which leaves a client to guess from the name —
+      // and it guesses high (see the snake_case note on the per-provider path).
+      const { contextWindow, maxOutput } = comboSeatLimits(combo, combosByName);
+      if (Number.isFinite(contextWindow)) entry.context_length = contextWindow;
+      if (Number.isFinite(maxOutput)) entry.max_completion_tokens = maxOutput;
     }
     models.push(entry);
   }
 
   if (connections.length === 0) {
     // DB unavailable -> return static models, filtered by per-model kind
-    const aliasToProviderId = Object.fromEntries(
-      Object.entries(PROVIDER_ID_TO_ALIAS).map(([id, alias]) => [alias, id])
-    );
     for (const [alias, providerModels] of 
```

**File**: `src/lib/modelCatalog/sync.js` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ const LIMIT_TOLERANCE = 0.1;
 // while building rather than on every lookup. Providers absent here keep whatever
 // the local pattern table resolves; names that already match need no entry.
 export const PROVIDER_ALIASES = {
+  "github": "github-copilot",
   "glm": "zai",
   "glm-cn": "zhipuai",
   "claude": "anthropic",
```

**File**: `tests/unit/gpt-6-context-window.test.js` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+import { describe, expect, it } from "vitest";
+
+import { getCapabilitiesForModel, setCatalogSource } from "../../open-sse/providers/capabilities.js";
+import { PROVIDER_ALIASES, build } from "../../src/lib/modelCatalog/sync.js";
+
+// The gpt-6 family's API window is 1.05M. The pattern table published 272,000 for
+// it — Kiro's own truncation, copied into the global glob — so every other
+// provider's gpt-6 models were advertised at 3.9x under their real window, and a
+// client reading context_length compacted (or refused) far too early.
+const API_WINDOW = 1050000;
+const LEGACY_GPT5_WINDOW = 400000;
+
+describe("gpt-6 / gpt-5.4+ context windows", () => {
+  it("reports the 1.05M API window for gpt-6 models on ordinary providers", () => {
+    for (const [provider, model] of [
+      ["github", "gpt-6-luna"],
+      ["azure", "gpt-6-luna"],
+      ["openai", "gpt-6-luna"],
+      ["github", "gpt-6-sol"],
+      ["openai", "gpt-6-astra"],
+    ]) {
+      expect(getCapabilitiesForModel(provider, model).contextWindow, `${provider}/${model}`).toBe(API_WINDOW);
+    }
+  });
+
+  // These two gateways really do truncate below the API, and their numbers live in
+  // PROVIDER_CAPABILITIES, which outranks the pattern. Correcting the pattern must
+  // leave them alone — that split is the whole point of the layering.
+  it("leaves the gateways that truncate lower on their own numbers", () => {
+    expect(getCapabilitiesForModel("kiro", "gpt-5.6-luna").contextWindow).toBe(272000);
+    expect(getCapabilitiesForModel("kiro", "gpt-5.6-luna-thinking-agentic").contextWindow).toBe(272000);
+    expect(getCapabilitiesForModel("codex", "gpt-5.6-luna").contextWindow).toBe(272000);
+    expect(getCapabilitiesForModel("codex", "gpt-5.6-sol").contextWindow).toBe(372000);
+    expect(getCapabilitiesForModel("codex", "gpt-6-astra").contextWindow).toBe(272000);
+  });
+
+  it("keeps Devin CLI's seven GPT-5.4/5.5 variants at the gateway's 200k limit", () => {
+    for (const model of [
+      "gpt-5.4-high", "gpt-5.4-medium", "gpt-5.4-low",
+      "gpt-5.5-xhigh", "gpt-5.5-high", "gpt-5.5-medium", "gpt-5.5-low",
+    ]) {
+      expect(getCapabilitiesForModel("devin-cli", model), model).toMatchObject({
+        contextWindow: 200000,
+        maxOutput: 128000,
+        vision: true,
+        reasoning: true,
+        thinkingFormat: "openai",
+      });
+    }
+    expect(getCapabilitiesForModel("dv", "gpt-5.5-high").contextWindow).toBe(200000);
+    expect(getCapabilitiesForModel("devin", "gpt-5.5-high").contextWindow).toBe(200000);
+  });
+
+  // gpt-5.4 is where the 1.05M window starts and the mini/nano tiers are the
+  // exception that stayed at 400k. Pattern resolution is first-match-wins, so this
+  // is really a guard on the ORDER of the entries: move the tier patterns above
+  // the mini/nano ones and both tiers silently report 1.05M.
+  it("splits the 1.05M tiers from the 400k ones", () => {
+    for (const model of [
+      "gpt-5.4", "gpt-5.4-pro", "gpt-5.5", "gpt-5.5-pro", "gpt-5.6", "gpt-5.6-luna", "gpt-5.6-terra",
+    ]) {
+      expect(getCapabilitiesForModel("openai", model).contextWindow, model).toBe(API_WINDOW);
+    }
+    for (const model of ["gpt-5.4-mini", "gpt-5.4-nano", "gpt-5", "gpt-5.1", "gpt-5.2", "gpt-5.3-codex"]) {
+      expect(getCapabilitiesForModel("openai", model).contextWindow, model).toBe(LEGACY_GPT5_WINDOW);
+    }
+  });
+});
+
+// Copilot is "github" locally and "github-copilot" upstream. Without that mapping
+// build() resolved no upstream provider for it and skipped every Copilot model, so
+// the daily models.dev sync could never correct a stale hand-written number — which
+// is how the gpt-6 window stayed 3.9x wrong without anything noticing.
+describe("models.dev sync reaches GitHub Copilot", () => {
+  it("maps the local github id onto the upstream github-copilot id", () => {
+    expect(PROVIDER_ALIASES.github).toBe("github-copilot");
+  });
+
+  it("records a Copilot limit that disagrees with the local tables", () => {
+    // Copilot caps Claude output at 32k where the local floor assumes 64k.
+    const upstream = {
+      "github-copilot": {
+        models: { "claude-sonnet-4.6": { limit: { context: 200000, output: 32000 } } },
+      },
+    };
+    const entries = [
+      { provider: "github", model: "claude-sonnet-4.6", current: { contextWindow: 200000, maxOutput: 64000 } },
+    ];
+
+    // Context agrees, so only the output delta is recorded — and it is filed under
+    // the local id, which is what the reader looks up.
+    expect(build(upstream, entries).providers.github).toEqual({
+      "claude-sonnet-4.6": { maxOutput: 32000 },
+    });
+  });
+
+  it("applies those Copilot deltas to an exact MODEL_CAPABILITIES id", () => {
+    // claude-sonnet-4.6 is canonical-exact (128k). Without refine() on that
+    // path the 32k Copilot delta from build() would never be read.
+    setCatalogSource({
+      getModalities: () => null,
+      ge
```

**File**: `tests/unit/v1-models-combo-context.test.js` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { describe, expect, it, vi } from "vitest";
+import { setCatalogSource } from "../../open-sse/providers/capabilities.js";
+
+const db = vi.hoisted(() => ({
+  getProviderConnections: vi.fn(),
+  getCombos: vi.fn(),
+  getCustomModels: vi.fn(async () => []),
+  getModelAliases: vi.fn(async () => ({})),
+}));
+
+vi.mock("@/lib/localDb", () => db);
+vi.mock("@/lib/disabledModelsDb", () => ({
+  getDisabledModels: vi.fn(async () => ({})),
+}));
+
+const { buildModelsList } = await import("../../src/app/api/v1/models/route.js");
+
+const syncedLimits = { contextWindow: 180000, maxOutput: 16000 };
+
+async function modelsWithCombo(providerId, modelId, combos) {
+  db.getProviderConnections.mockResolvedValue([{
+    id: 1,
+    provider: providerId,
+    isActive: true,
+    providerSpecificData: { enabledModels: [modelId] },
+  }]);
+  db.getCombos.mockResolvedValue(combos);
+  setCatalogSource({
+    getModalities: () => null,
+    getLimits: (provider, model) =>
+      provider === providerId && model === modelId ? syncedLimits : null,
+  });
+  try {
+    return await buildModelsList(["llm"]);
+  } finally {
+    setCatalogSource(null);
+  }
+}
+
+describe("/v1/models combo limits", () => {
+  it.each([
+    ["ocg", "opencode-go", "mimo-v2.5"],
+    ["xmtp", "xiaomi-tokenplan", "mimo-v2.5"],
+    ["ps", "poolside", "custom-model"],
+    ["ds", "deepseek", "deepseek-chat"],
+  ])("uses the real provider for a %s UI-alias seat", async (uiAlias, providerId, modelId) => {
+    const combo = { name: "ui-alias-combo", models: [`${uiAlias}/${modelId}`] };
+    const models = await modelsWithCombo(providerId, modelId, [combo]);
+    const published = models.find((model) => model.id === combo.name);
+
+    expect(published).toMatchObject({
+      context_length: 180000,
+      max_completion_tokens: 16000,
+      capabilities: { contextWindow: 180000, maxOutput: 16000 },
+    });
+  });
+
+  it("carries provider-scoped limits through a nested combo", async () => {
+    const models = await modelsWithCombo("opencode-go", "mimo-v2.5", [
+      { name: "inner-combo", models: ["ocg/mimo-v2.5"] },
+      { name: "outer-combo", models: ["inner-combo"] },
+    ]);
+    const outer = models.find((model) => model.id === "outer-combo");
+
+    expect(outer).toMatchObject({
+      context_length: 180000,
+      max_completion_tokens: 16000,
+      capabilities: { contextWindow: 180000, maxOutput: 16000 },
+    });
+  });
+
+  it("publishes Devin CLI's 200k limit for a dv combo seat", async () => {
+    const models = await modelsWithCombo("devin-cli", "gpt-5.5-high", [
+      { name: "devin-combo", models: ["dv/gpt-5.5-high"] },
+    ]);
+    const combo = models.find((model) => model.id === "devin-combo");
+
+    expect(combo).toMatchObject({
+      context_length: 200000,
+      capabilities: { contextWindow: 200000 },
+    });
+  });
+});
```

---

### Incident Patch 6: `49c761cd` (2026-10-01)
**Commit Message**: fix(claude): cache a tool loop's final tool results with the 4th breakpoint

A tool loop's request ends with the results of the last assistant
turn's tool calls -- after that turn's breakpoint, so they are billed
as uncached input and written to cache only by the next request.
When the final user turn carries tool_result blocks and the 4-marker
budget has room, markFinalToolResults puts a 5m breakpoint on its
last cacheable block, in both prepareClaudeRequest and
anchorClaudeCache. Never exceeds 4 markers; requests ending with a
typed user message are unchanged.

**File**: `open-sse/translator/formats/claude.js` (modified, +21/-0)
```diff
@@ -346,6 +346,21 @@ function markLastCacheableBlock(msg) {
   return false;
 }
 
+// In an agent's tool loop, a request ends with the results of the last
+// assistant turn's tool calls -- after that turn's breakpoint. They go at the
+// full input price, and the next request (which appends to them) writes them
+// into the cache. When the 4-marker budget has room, a 5m breakpoint on that
+// final user turn caches them now, and the next request reads them.
+function markFinalToolResults(body) {
+  const messages = body?.messages;
+  const last = Array.isArray(messages) ? messages[messages.length - 1] : null;
+  if (last?.role !== ROLE.USER || !Array.isArray(last.content)) return false;
+  if (!last.content.some((block) => block?.type === CLAUDE_BLOCK.TOOL_RESULT)) return false;
+  if (last.content.some((block) => block?.cache_control)) return false;
+  if (countCacheControlBlocks(body) >= 4) return false;
+  return markLastCacheableBlock(last);
+}
+
 // Re-anchor cache breakpoints on a Claude passthrough body (same policy as
 // prepareClaudeRequest): last tool + last system block at 1h, last assistant at 5m.
 // The client's own markers point at pre-normalization offsets, so they are dropped.
@@ -415,6 +430,9 @@ export function anchorClaudeCache(body) {
         anchored = markLastCacheableBlock(body.messages[i]);
       }
     }
+
+    // ...and a tool loop's final tool results, so the next step reads them.
+    markFinalToolResults(body);
   }
 
   return body;
@@ -672,6 +690,9 @@ export function prepareClaudeRequest(body, provider = null, apiKey = null, conne
     body = hoistToolResultImages(body);
   }
 
+  // A tool loop's final tool results: cached now, so the next step reads them.
+  markFinalToolResults(body);
+
   // Apply cloaking for OAuth tokens (billing header + fake user ID)
   // session_id in user_id must match X-Claude-Code-Session-Id for fingerprint consistency
   if ((provider === "claude" || provider?.startsWith("anthropic-compatible")) && apiKey) {
```

**File**: `tests/translator/__snapshots__/golden-request.test.js.snap` (modified, +3/-0)
```diff
@@ -40,6 +40,9 @@ exports[`GOLDEN request: OpenAI → Claude > full body (system/image/tool/tool_r
     {
       "content": [
         {
+          "cache_control": {
+            "type": "ephemeral",
+          },
           "content": "sunny",
           "tool_use_id": "call_1",
           "type": "tool_result",
```

**File**: `tests/unit/claude-cache-final-tool-results.test.js` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+// A tool loop's request ends with the last assistant turn's tool results, after that turn's
+// breakpoint: without a 4th breakpoint on them they go at the full input price, and are written
+// into the cache only by the next request, which appends to them.
+import { describe, it, expect } from "vitest";
+import { anchorClaudeCache, prepareClaudeRequest } from "../../open-sse/translator/formats/claude.js";
+
+const CC = { type: "ephemeral" };
+const text = (t, extra = {}) => ({ type: "text", text: t, ...extra });
+const tool = (name, extra = {}) => ({ name, description: "d", input_schema: { type: "object", properties: {} }, ...extra });
+const use = (id) => ({ role: "assistant", content: [text("Reading."), { type: "tool_use", id, name: "read_file", input: { path: "a" } }] });
+const result = (id, content = "file") => ({ type: "tool_result", tool_use_id: id, content });
+
+function markers(body) {
+  const out = [];
+  (body.system || []).forEach((b, i) => b?.cache_control && out.push(`system[${i}]`));
+  (body.tools || []).forEach((t, i) => t?.cache_control && out.push(`tools[${i}]`));
+  (body.messages || []).forEach((m, i) => Array.isArray(m?.content) && m.content.forEach((b, j) => b?.cache_control && out.push(`messages[${i}].${j}`)));
+  return out;
+}
+
+const loop = () => ({
+  model: "claude-sonnet-4-5",
+  max_tokens: 1024,
+  system: [text("You are an agent.")],
+  tools: [tool("read_file"), tool("run_command")],
+  messages: [
+    { role: "user", content: [text("Fix the bug.")] },
+    use("t1"),
+    { role: "user", content: [result("t1")] },
+    use("t2"),
+    { role: "user", content: [result("t2", "a"), result("t2b", "b")] },
+  ],
+});
+
+describe("prepareClaudeRequest: a tool loop's final tool results", () => {
+  it("get the 4th breakpoint, after the last assistant turn's", () => {
+    const out = prepareClaudeRequest(loop(), "claude");
+    expect(markers(out)).toEqual(["system[0]", "tools[1]", "messages[3].1", "messages[4].1"]);
+    expect(out.messages[4].content[1].cache_control).toEqual({ type: "ephemeral" });
+  });
+
+  it("leave a request that ends with a typed message as it was", () => {
+    const body = loop();
+    body.messages.push({ role: "assistant", content: [text("Done.")] }, { role: "user", content: [text("Thanks, and the tests?")] });
+    const out = prepareClaudeRequest(body, "claude");
+    expect(markers(out)).toEqual(["system[0]", "tools[1]", "messages[5].0"]);
+  });
+
+  it("need no tools array to be marked", () => {
+    const body = loop();
+    delete body.tools;
+    const out = prepareClaudeRequest(body, "claude");
+    expect(markers(out)).toEqual(["system[0]", "messages[3].1", "messages[4].1"]);
+  });
+
+  it("never take the request past four markers", () => {
+    const body = loop();
+    body.system = [text("a", { cache_control: CC }), text("b", { cache_control: CC })];
+    body.tools = body.tools.map((t) => ({ ...t, cache_control: CC }));
+    body.messages.forEach((m) => m.content.forEach((b) => (b.cache_control = CC)));
+    const out = prepareClaudeRequest(body, "claude");
+    expect(markers(out).length).toBeLessThanOrEqual(4);
+    expect(out.messages[4].content.at(-1).cache_control).toBeTruthy();
+  });
+});
+
+describe("anchorClaudeCache: a passthrough tool loop's final tool results", () => {
+  it("are re-anchored with the last assistant turn", () => {
+    const out = anchorClaudeCache(loop());
+    expect(markers(out)).toEqual(["system[0]", "tools[1]", "messages[3].1", "messages[4].1"]);
+  });
+
+  it("keep a client's own full budget as it is", () => {
+    const body = loop();
+    body.messages[0].content[0].cache_control = CC;
+    body.messages[2].content[0].cache_control = CC;
+    const out = anchorClaudeCache(body);
+    expect(markers(out).length).toBeLessThanOrEqual(4);
+  });
+});
```

---

### Incident Patch 7: `ca6e8407` (2026-10-01)
**Commit Message**: fix(codex): refresh CLI identity for GPT-6.1 Sol

Bump CODEX_CLI_VERSION 0.155.0 → 0.159.0 (npm stable) so OpenAI stops
rejecting gpt-6.1-sol on connected ChatGPT accounts. Update transport
header assertions and assert the User-Agent identity.

Fixes #4471

**File**: `open-sse/providers/registry/codex.js` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import { withCodexReviewModels } from "../models/helpers.js";
 
 // Codex CLI version seen by OpenAI's backend — single source for the Version /
 // User-Agent identity headers. Bump when the installed codex CLI is upgraded.
-const CODEX_CLI_VERSION = "0.155.0";
+const CODEX_CLI_VERSION = "0.159.0";
 const GPT_6_LITE_THINKING_LEVELS = ["low", "medium", "high", "xhigh", "max"];
 
 export default {
```

**File**: `tests/unit/codex-gpt6-lite.test.js` (modified, +2/-1)
```diff
@@ -190,7 +190,8 @@ describe("Codex GPT-6 Sol/Luna transport", () => {
     const body = JSON.parse(options.body);
     expect(url).toBe("https://chatgpt.com/backend-api/codex/responses");
     expect(options.headers["x-openai-internal-codex-responses-lite"]).toBe("true");
-    expect(options.headers.version).toBe("0.155.0");
+    expect(options.headers.version).toBe("0.159.0");
+    expect(options.headers["User-Agent"]).toBe("codex_cli_rs/0.159.0");
     expect(body.model).toBe("gpt-6-luna");
     expect(body.instructions).toBe("");
     expect(body.input[0].type).toBe("additional_tools");
```

---

### Incident Patch 8: `ccd0677d` (2026-10-01)
**Commit Message**: fix(claude): resolve Sonnet 5.x to adaptive thinking so no forged thinking placeholders are sent

**File**: `open-sse/providers/capabilities.js` (modified, +1/-0)
```diff
@@ -286,6 +286,7 @@ PROVIDER_CAPABILITIES.cx = PROVIDER_CAPABILITIES.codex;
 export const PATTERN_CAPABILITIES = [
   // ── Claude (4.6+ = adaptive thinking; older/haiku = budget) ──────
   { pattern: "*claude*opus-5*",     caps: { vision: true, reasoning: true, search: true, thinkingFormat: "claude-adaptive", contextWindow: 1000000, maxOutput: 128000 } },
+  { pattern: "*claude*sonnet-5*",   caps: { vision: true, reasoning: true, search: true, thinkingFormat: "claude-adaptive", contextWindow: 1000000, maxOutput: 128000 } },
   { pattern: "*claude*opus-4.6*",   caps: { vision: true, reasoning: true, search: true, thinkingFormat: "claude-adaptive" } },
   { pattern: "*claude*opus-4.7*",   caps: { vision: true, reasoning: true, search: true, thinkingFormat: "claude-adaptive" } },
   { pattern: "*claude*opus-4.8*",   caps: { vision: true, reasoning: true, search: true, thinkingFormat: "claude-adaptive" } },
```

**File**: `tests/unit/capabilities-sonnet-5-5.test.js` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { describe, expect, it } from "vitest";
+
+import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
+
+// claude-sonnet-5-5 has no exact entry and matched only the generic *claude*sonnet*
+// pattern (claude-budget). That sent thinking.type "enabled" and made the translator
+// forge signed thinking placeholders on every tool_use turn; Sonnet 5.5 answered
+// large Codex conversations with stop_reason "refusal". It must resolve like the
+// rest of the 5.x family: adaptive thinking, 1M context.
+describe("Claude Sonnet 5.5 capabilities", () => {
+  for (const model of ["claude-sonnet-5-5", "claude-sonnet-5.5", "anthropic/claude-sonnet-5-5"]) {
+    it(`${model} resolves to adaptive thinking + 1M context`, () => {
+      expect(getCapabilitiesForModel("claude", model)).toMatchObject({
+        thinkingFormat: "claude-adaptive",
+        contextWindow: 1000000,
+        maxOutput: 128000,
+        reasoning: true,
+      });
+    });
+  }
+});
```

---

### Incident Patch 9: `7894f3d3` (2026-10-01)
**Commit Message**: fix(thinking): add xhigh to claude-adaptive thinking levels

Expose xhigh in the level picker for claude-adaptive models (Opus 4.7+,
Sonnet 5, Opus 5/5.5, Fable) and make the wire actually send it instead
of silently clamping to high:

- thinkingLevels: claude-adaptive now uses the budgetX set; Opus/Sonnet
  4.6 keep low..max (both Anthropic and Kiro reject xhigh there)
- thinkingUnified: pass xhigh through when the model advertises it,
  clamp to high otherwise
- kiroConstants: pass xhigh/max through per Kiro docs + live
  additionalModelRequestFieldsSchema tiers; 4.6 models clamp xhigh to
  high (max stays valid). Fixes max being a silent no-op on Kiro.

Kimi stays on levelMax.

**File**: `open-sse/config/kiroConstants.js` (modified, +24/-10)
```diff
@@ -171,15 +171,31 @@ export function resolveKiroThinkingBudget(body, headers, model) {
   return null;
 }
 
-export function extractKiroEffortLevel(body) {
+function parseClaudeVersion(model) {
+  if (typeof model !== "string") return null;
+  const normalized = model.toLowerCase().replace(/-/g, ".");
+  const match = normalized.match(/(?:^|[/.])claude(?:[/.][a-z]+)*[/.](\d+)(?:[/.](\d+))?(?:[/.]|$)/);
+  if (!match) return null;
+  return { major: Number(match[1]), minor: match[2] === undefined ? null : Number(match[2]) };
+}
+
+// Kiro effort tiers per model (kiro.dev docs + live additionalModelRequestFieldsSchema):
+// 4.6 Claude models cap at low|medium|high|max; 4.7+ add xhigh. Unknown models stay conservative.
+function kiroModelLacksXhigh(model) {
+  const v = parseClaudeVersion(model);
+  return !v || (v.major === 4 && v.minor !== null && v.minor <= 6);
+}
+
+export function extractKiroEffortLevel(body, model) {
   const effort =
     body?.output_config?.effort ??
     body?.reasoning_effort ??
     (typeof body?.reasoning === "object" ? body.reasoning?.effort : null);
   if (typeof effort !== "string") return null;
   const normalized = effort.toLowerCase();
   if (normalized === "none" || normalized === "off" || normalized === "disabled") return null;
-  if (normalized === "xhigh" || normalized === "max") return "high";
+  if (normalized === "xhigh") return kiroModelLacksXhigh(model) ? "high" : "xhigh";
+  if (normalized === "max") return "max";
   if (["low", "medium", "high"].includes(normalized)) return normalized;
   return null;
 }
@@ -199,10 +215,10 @@ function extractKiroGptEffortLevel(body) {
   return null;
 }
 
-export function buildKiroAdditionalModelRequestFields(body, effortPath = "output_config") {
+export function buildKiroAdditionalModelRequestFields(body, effortPath = "output_config", model) {
   const effort = effortPath === "reasoning"
     ? extractKiroGptEffortLevel(body)
-    : extractKiroEffortLevel(body);
+    : extractKiroEffortLevel(body, model);
   if (!effort) return undefined;
   if (effortPath === "reasoning") {
     // Mirrors Kiro CLI/KAS buildEffortRequestFields("reasoning") for GPT.
@@ -222,11 +238,9 @@ export function resolveKiroEffortPath(model) {
     return "reasoning";
   }
   if (!normalized.includes("claude")) return null;
-  const match = normalized.match(/(?:^|[/.])claude(?:[/.][a-z]+)*[/.](\d+)(?:[/.](\d+))?(?:[/.]|$)/);
-  if (!match) return null;
-  const [, majorText, minorText] = match;
-  const major = Number(majorText);
-  const minor = minorText === undefined ? null : Number(minorText);
+  const v = parseClaudeVersion(model);
+  if (!v) return null;
+  const { major, minor } = v;
   const dateSuffixMinor = minor !== null && minor >= 1000;
   // Kiro rejected additionalModelRequestFields on legacy 4.5 models in live smoke.
   // Default future Claude/Kiro models to supported so new model releases do not
@@ -248,7 +262,7 @@ export function usesKiroNativeGptEffort(body, model) {
 export function buildKiroAdditionalModelRequestFieldsForModel(body, model) {
   const effortPath = resolveKiroEffortPath(model);
   if (!effortPath) return undefined;
-  return buildKiroAdditionalModelRequestFields(body, effortPath);
+  return buildKiroAdditionalModelRequestFields(body, effortPath, model);
 }
 
 /**
```

**File**: `open-sse/providers/thinkingLevels.js` (modified, +8/-3)
```diff
@@ -10,16 +10,16 @@ const L = {
   base: ["none", "low", "medium", "high"],                          // qwen, step, hunyuan, gemini-budget
   onOff: ["none", "thinking"],                                      // zai (binary), minimax (adaptive)
   openai: ["none", "minimal", "low", "medium", "high", "xhigh"],    // GPT-5.x / o-series (no "max")
-  levelMax: ["none", "low", "medium", "high", "max"],               // claude-adaptive, kimi
-  budgetX: ["none", "low", "medium", "high", "xhigh", "max"],       // claude-budget
+  levelMax: ["none", "low", "medium", "high", "max"],               // kimi
+  budgetX: ["none", "low", "medium", "high", "xhigh", "max"],       // claude-budget, claude-adaptive
   gemini: ["minimal", "low", "medium", "high"],                     // gemini-3 thinkingLevel (no disable)
   hiMax: ["none", "high", "max"],                                   // deepseek (low/med→high, xhigh→max)
 };
 
 // thinkingFormat → valid selectable levels (source of truth for UI options).
 const FORMAT_LEVELS = {
   openai: L.openai,
-  "claude-adaptive": L.levelMax,
+  "claude-adaptive": L.budgetX,
   "claude-budget": L.budgetX,
   "gemini-level": L.gemini,
   "gemini-budget": L.base,
@@ -35,8 +35,13 @@ const FORMAT_LEVELS = {
 
 const CODEX_GPT_5_6_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
 
+// Opus/Sonnet 4.6 lack xhigh (Anthropic + Kiro docs) — keep the 4-level+max set.
+const CLAUDE_NO_XHIGH = ["none", "low", "medium", "high", "max"];
+
 // Model-name pattern overrides (glob, first match wins) — more precise than format default.
 const PATTERN_THINKING = [
+  { pattern: "*claude*4.6*", levels: CLAUDE_NO_XHIGH },
+  { pattern: "*claude*4-6*", levels: CLAUDE_NO_XHIGH },
   { provider: "codex", pattern: "*gpt-6*", levels: CODEX_GPT_5_6_LEVELS },
   { provider: "codex", pattern: "*gpt-5.6-sol*", levels: [...CODEX_GPT_5_6_LEVELS, "ultra"] },
   { provider: "codex", pattern: "*gpt-5.6-terra*", levels: [...CODEX_GPT_5_6_LEVELS, "ultra"] },
```

**File**: `open-sse/translator/concerns/thinkingUnified.js` (modified, +3/-1)
```diff
@@ -271,7 +271,9 @@ function applyFormat(fmt, body, cfg, caps, supportedLevels, display) {
       if (canDisable) body.thinking = { type: "adaptive", ...(display ? { display } : {}) };
       else delete body.thinking;
       const level = toLevel(eff);
-      body.output_config = { effort: level === "xhigh" || level === "auto" ? "high" : level };
+      // xhigh is model-gated (Opus/Sonnet 4.6 reject it) — clamp when not advertised.
+      body.output_config = { effort: level === "auto" ? "high"
+        : level === "xhigh" && !supportedLevels?.includes("xhigh") ? "high" : level };
       break;
     }
     case "claude-budget": {
```

**File**: `tests/unit/thinking-levels-kiro.test.js` (modified, +21/-0)
```diff
@@ -1,5 +1,7 @@
 import { describe, it, expect } from "vitest";
 import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
+import { buildKiroAdditionalModelRequestFieldsForModel } from "../../open-sse/config/kiroConstants.js";
+import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";
 
 describe("getThinkingLevels for Kiro", () => {
   it("does not advertise native intensity for legacy Kiro models", () => {
@@ -9,6 +11,25 @@ describe("getThinkingLevels for Kiro", () => {
 
   it("advertises native levels for supported Kiro models", () => {
     expect(getThinkingLevels("kiro", "claude-sonnet-5")).toContain("high");
+    expect(getThinkingLevels("kiro", "claude-sonnet-5")).toContain("xhigh");
+    expect(getThinkingLevels("kiro", "claude-sonnet-5")).toContain("max");
     expect(getThinkingLevels("kiro", "gpt-5.6-sol")).toContain("xhigh");
   });
+
+  it("omits xhigh on 4.6 models (upstream rejects it there)", () => {
+    for (const model of ["claude-opus-4.6", "claude-opus-4-6", "claude-sonnet-4.6"]) {
+      expect(getThinkingLevels("kiro", model)).not.toContain("xhigh");
+      expect(getThinkingLevels("kiro", model)).toContain("max");
+    }
+  });
+
+  it("passes xhigh/max through on the wire for 4.7+, clamps xhigh on 4.6", () => {
+    const xhigh = { output_config: { effort: "xhigh" } };
+    expect(buildKiroAdditionalModelRequestFieldsForModel(xhigh, "claude-sonnet-5")?.output_config?.effort).toBe("xhigh");
+    expect(buildKiroAdditionalModelRequestFieldsForModel({ output_config: { effort: "max" } }, "claude-opus-4.6")?.output_config?.effort).toBe("max");
+    expect(buildKiroAdditionalModelRequestFieldsForModel(xhigh, "claude-opus-4.6")?.output_config?.effort).toBe("high");
+    // Anthropic-wire path: suffix override sends real xhigh on 4.7+, high on 4.6.
+    expect(applyThinking("claude", "claude-opus-5.5(xhigh)", { messages: [] }, "claude").output_config?.effort).toBe("xhigh");
+    expect(applyThinking("claude", "claude-opus-4.6(xhigh)", { messages: [] }, "claude").output_config?.effort).toBe("high");
+  });
 });
```

---

### Incident Patch 10: `6b9dc54d` (2026-10-01)
**Commit Message**: fix(grok-cli): send Grok CLI 1.0.44 so proxy stops returning HTTP 426

**File**: `open-sse/config/grokCli.js` (modified, +4/-1)
```diff
@@ -1,8 +1,11 @@
-export const GROK_CLI_VERSION = "0.2.99";
+// cli-chat-proxy rejects older identities with HTTP 426. Keep this on a
+// current @xai-official/grok release (1.0.44 as of 2026-10-01; minimum 1.0.13).
+export const GROK_CLI_VERSION = "1.0.44";
 export const GROK_CLI_MODEL = "grok-build";
 export const GROK_CLI_BASE_URL = "https://cli-chat-proxy.grok.com/v1";
 export const GROK_CLI_CLIENT_IDENTIFIER = "grok-shell";
 export const GROK_CLI_USER_AGENT = `grok-shell/${GROK_CLI_VERSION} (linux; x86_64)`;
+export const GROK_CLI_PAGER_USER_AGENT = `grok-pager/${GROK_CLI_VERSION} grok-shell/${GROK_CLI_VERSION} (linux; x86_64)`;
 
 export function supportsGrokCliReasoningEffort(model) {
   // ponytail: unknown models omit effort until live metadata reaches dispatch.
```

**File**: `open-sse/providers/registry/grok-cli.js` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 /**
  * Grok CLI / Grok Build (cli-chat-proxy.grok.com)
  *
- * Source of truth: wire capture of official @xai-official/grok 0.2.99
+ * Source of truth: wire capture of official @xai-official/grok 1.0.44
  * talking to https://cli-chat-proxy.grok.com (OpenAI Responses API).
  *
  * Distinct from:
```

**File**: `src/app/api/providers/[id]/test/testUtils.js` (modified, +3/-2)
```diff
@@ -5,6 +5,7 @@ import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/sha
 import { getDefaultModel } from "open-sse/config/providerModels.js";
 import { resolveOllamaLocalHost, PROVIDERS } from "open-sse/config/providers.js";
 import { CODEX_CLI_VERSION } from "open-sse/config/appConstants.js";
+import { GROK_CLI_PAGER_USER_AGENT, GROK_CLI_VERSION } from "open-sse/config/grokCli.js";
 import {
   refreshProviderCredentials,
   shouldRefreshCredentials,
@@ -123,10 +124,10 @@ const OAUTH_TEST_CONFIG = {
     extraHeaders: {
       Accept: "application/json",
       ...(PROVIDERS["grok-cli"]?.headers || {
-        "User-Agent": "grok-pager/0.2.93 grok-shell/0.2.93 (linux; x86_64)",
+        "User-Agent": GROK_CLI_PAGER_USER_AGENT,
         "x-xai-token-auth": "xai-grok-cli",
         "x-grok-client-identifier": "grok-pager",
-        "x-grok-client-version": "0.2.93",
+        "x-grok-client-version": GROK_CLI_VERSION,
       }),
     },
     refreshable: true,
```

**File**: `src/lib/oauth/providers/grok-cli.js` (modified, +5/-4)
```diff
@@ -1,3 +1,4 @@
+import { GROK_CLI_PAGER_USER_AGENT, GROK_CLI_VERSION } from "open-sse/config/grokCli.js";
 import { GROK_CLI_CONFIG } from "../constants/oauth.js";
 import { decodeXaiIdTokenEmail, extractEmailFromAccessToken } from "../providerHelpers.js";
 
@@ -18,7 +19,7 @@ const grokCli = {
       headers: {
         "Content-Type": "application/x-www-form-urlencoded",
         Accept: "application/json",
-        "User-Agent": "grok-pager/0.2.93 grok-shell/0.2.93 (linux; x86_64)",
+        "User-Agent": GROK_CLI_PAGER_USER_AGENT,
       },
       body,
     });
@@ -36,7 +37,7 @@ const grokCli = {
       headers: {
         "Content-Type": "application/x-www-form-urlencoded",
         Accept: "application/json",
-        "User-Agent": "grok-pager/0.2.93 grok-shell/0.2.93 (linux; x86_64)",
+        "User-Agent": GROK_CLI_PAGER_USER_AGENT,
       },
       body: new URLSearchParams({
         grant_type: "urn:ietf:params:oauth:grant-type:device_code",
@@ -69,9 +70,9 @@ const grokCli = {
         headers: {
           Authorization: `Bearer ${tokens.access_token}`,
           Accept: "application/json",
-          "User-Agent": "grok-pager/0.2.93 grok-shell/0.2.93 (linux; x86_64)",
+          "User-Agent": GROK_CLI_PAGER_USER_AGENT,
           "x-xai-token-auth": "xai-grok-cli",
-          "x-grok-client-version": "0.2.93",
+          "x-grok-client-version": GROK_CLI_VERSION,
         },
       });
       if (res.ok) return { user: await res.json() };
```

**File**: `tests/__baseline__/providers-baseline.json` (modified, +3/-3)
```diff
@@ -417,13 +417,13 @@
     "modelsUrl": "https://cli-chat-proxy.grok.com/v1/models",
     "userUrl": "https://cli-chat-proxy.grok.com/v1/user",
     "billingUrl": "https://cli-chat-proxy.grok.com/v1/billing",
-    "clientVersion": "0.2.99",
+    "clientVersion": "1.0.44",
     "clientIdentifier": "grok-shell",
     "tokenAuth": "xai-grok-cli",
     "headers": {
-      "User-Agent": "grok-shell/0.2.99 (linux; x86_64)",
+      "User-Agent": "grok-shell/1.0.44 (linux; x86_64)",
       "x-grok-client-identifier": "grok-shell",
-      "x-grok-client-version": "0.2.99"
+      "x-grok-client-version": "1.0.44"
     },
     "usage": {
       "url": "https://cli-chat-proxy.grok.com/v1/billing?format=credits",
```

**File**: `tests/unit/grok-cli-executor.test.js` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ describe("GrokCliExecutor", () => {
     expect(headers.Accept).toBe("text/event-stream");
     expect(headers["x-xai-token-auth"]).toBeUndefined();
     expect(headers["x-grok-client-identifier"]).toBe("grok-shell");
-    expect(headers["x-grok-client-version"]).toBe("0.2.99");
+    expect(headers["x-grok-client-version"]).toBe("1.0.44");
     expect(headers["x-grok-session-id"]).toBe("sess-abc");
     expect(headers["x-grok-conv-id"]).toBe("sess-abc");
     expect(headers["x-grok-req-id"]).toBe("req-xyz");
```

**File**: `tests/unit/grok-cli-models.test.js` (modified, +1/-1)
```diff
@@ -75,6 +75,6 @@ describe("Grok CLI live models", () => {
     expect(fetchFn).toHaveBeenCalledTimes(2);
     expect(fetchFn.mock.calls[0][2]).toBe(proxyOptions);
     expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe("Bearer new-token");
-    expect(fetchFn.mock.calls[1][1].headers["x-grok-client-version"]).toBe("0.2.99");
+    expect(fetchFn.mock.calls[1][1].headers["x-grok-client-version"]).toBe("1.0.44");
   });
 });
```

**File**: `tests/unit/grok-cli-usage.test.js` (modified, +1/-1)
```diff
@@ -272,7 +272,7 @@ describe("getUsageForProvider(grok-cli)", () => {
     expect(billingCall[0]).toContain("/v1/billing");
     expect(billingCall[1].headers.Authorization).toBe("Bearer test-token");
     expect(billingCall[1].headers["x-xai-token-auth"]).toBe("xai-grok-cli");
-    expect(billingCall[1].headers["x-grok-client-version"]).toBe("0.2.99");
+    expect(billingCall[1].headers["x-grok-client-version"]).toBe("1.0.44");
     expect(billingCall[1].headers["x-grok-client-identifier"]).toBe("grok-shell");
     expect(billingCall[1].headers["x-userid"]).toBe(
       "d84768dd-224d-4052-ba49-0d336fa9160c",
```

---

### Incident Patch 11: `0bc7f86e` (2026-09-28)
**Commit Message**: fix(codex): stop refresh-token reuse that logs accounts out on auto-ping

OpenAI rotates the refresh token on every refresh and revokes the whole
session on reuse. A 5-day refreshLeadMs (access tokens live ~1h) rotated
the token on every call, and three refresh writers (usage poll, auto-ping
tick, 5-min background refresher) each held stale snapshots — auto-ping
firing at reset time reliably triggered reuse and logged the account out.

- registry: refreshLeadMs 5d -> 10min (refresh only near actual expiry)
- refreshAndUpdateCredentials: re-read connection from DB before refresh;
  throw on unrecoverable refresh instead of continuing with a dead token
- checkAndRefreshToken: adopt newer DB tokens before refreshing

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `open-sse/providers/registry/codex.js` (modified, +3/-1)
```diff
@@ -103,7 +103,9 @@ export default {
       codex_cli_simplified_flow: "true",
       originator: "codex_cli_rs",
     },
-    refreshLeadMs: 432000000,
+    // Access tokens live ~1h; a 5d lead rotated the refresh token on EVERY call —
+    // reuse of a rotated token revokes the whole OpenAI session (account logout).
+    refreshLeadMs: 600000,
     refresh: {
       encoding: "form",
       scope: "openid profile email offline_access",
```

**File**: `src/app/api/usage/[connectionId]/route.js` (modified, +11/-0)
```diff
@@ -3,6 +3,7 @@ import "open-sse/index.js";
 
 import { getProviderConnectionById, updateProviderConnection } from "@/lib/localDb";
 import { getUsageForProvider } from "open-sse/services/usage.js";
+import { isUnrecoverableRefreshError } from "open-sse/services/tokenRefresh.js";
 import { getExecutor } from "open-sse/executors/index.js";
 import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
 import { USAGE_APIKEY_PROVIDERS } from "@/shared/constants/providers";
@@ -21,6 +22,11 @@ function isAuthExpiredMessage(usage) {
  * @returns Promise<{ connection, refreshed: boolean }>
  */
 export async function refreshAndUpdateCredentials(connection, force = false, proxyOptions = null) {
+  // Re-read latest tokens: OpenAI rotates the refresh token on every refresh, and
+  // refreshing with a stale snapshot (reuse) revokes the whole session → account logout.
+  const latest = connection.id ? await getProviderConnectionById(connection.id) : null;
+  if (latest) connection = latest;
+
   const executor = getExecutor(connection.provider);
 
   // Build credentials object from connection
@@ -47,6 +53,11 @@ export async function refreshAndUpdateCredentials(connection, force = false, pro
   // Use executor's refreshCredentials method (with optional proxy)
   const refreshResult = await executor.refreshCredentials(credentials, console, proxyOptions);
 
+  // Refresh token reused/invalidated — token family is revoked; do not continue with the dead token.
+  if (refreshResult && isUnrecoverableRefreshError(refreshResult)) {
+    throw new Error("Refresh token invalid or reused. Please re-authorize the connection.");
+  }
+
   if (!refreshResult) {
     // Refresh failed but we still have an accessToken — try with existing token
     if (connection.accessToken) {
```

**File**: `src/sse/services/tokenRefresh.js` (modified, +20/-1)
```diff
@@ -1,6 +1,6 @@
 // Re-export from open-sse with local logger
 import * as log from "../utils/logger.js";
-import { updateProviderConnection } from "../../lib/localDb.js";
+import { getProviderConnectionById, updateProviderConnection } from "../../lib/localDb.js";
 import {
   getProjectIdForConnection,
   invalidateProjectId,
@@ -227,6 +227,25 @@ export async function checkAndRefreshToken(provider, credentials, options = {})
     creds.connectionId = creds.id;
   }
 
+  // Adopt latest DB tokens: OpenAI rotates the refresh token on every refresh, and
+  // refreshing with a stale snapshot (reuse) revokes the whole session → account logout.
+  if (creds.connectionId) {
+    const latest = await getProviderConnectionById(creds.connectionId).catch(() => null);
+    const latestRefreshMs = Date.parse(latest?.lastRefreshAt || "");
+    const credsRefreshMs = Date.parse(creds.lastRefreshAt || "");
+    const dbIsNewer = Number.isFinite(latestRefreshMs)
+      && (!Number.isFinite(credsRefreshMs) || latestRefreshMs > credsRefreshMs);
+    if (dbIsNewer && latest.refreshToken && latest.refreshToken !== creds.refreshToken) {
+      creds = {
+        ...creds,
+        refreshToken: latest.refreshToken,
+        accessToken: latest.accessToken || creds.accessToken,
+        expiresAt: latest.expiresAt || latest.tokenExpiresAt || creds.expiresAt,
+        lastRefreshAt: latest.lastRefreshAt || creds.lastRefreshAt,
+      };
+    }
+  }
+
   const force = options?.force === true;
 
   // ── 1. Regular access-token expiry ────────────────────────────────────────
```

---

### Incident Patch 12: `92c7bdd5` (2026-09-28)
**Commit Message**: fix(codex): add GPT-6 Sol/Luna capabilities and official pricing

Add explicit capability entries for gpt-6-sol and gpt-6-luna (vision,
reasoning, search, 272k context, 128k max output) and update GPT-6
pricing to OpenAI's official standard short-context rates.

**File**: `open-sse/providers/capabilities.js` (modified, +2/-0)
```diff
@@ -183,6 +183,8 @@ export const PROVIDER_CAPABILITIES = {
   },
   "codex": {
     "gpt-6-astra":               { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 272000, maxOutput: 128000 },
+    "gpt-6-sol":                 { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 272000, maxOutput: 128000 },
+    "gpt-6-luna":                { vision: true, reasoning: true, search: true, thinkingFormat: "openai", contextWindow: 272000, maxOutput: 128000 },
     "gpt-5.6-sol":               CODEX_GPT_56_SOL_CAPS,
     "gpt-5.6-sol-review":        CODEX_GPT_56_SOL_CAPS,
     "gpt-5.6-terra":             CODEX_GPT_56_DEFAULT_CAPS,
```

**File**: `open-sse/providers/pricing.js` (modified, +5/-1)
```diff
@@ -73,7 +73,11 @@ export const MODEL_PRICING = {
   "gpt-5.6-luna":                 { input: 1.00,  output: 6.00,  cached: 0.10,  reasoning: 6.00,   cache_creation: 1.00  },
   "gpt-5.6-terra":                { input: 2.50,  output: 15.00, cached: 0.25,  reasoning: 15.00,  cache_creation: 2.50  },
   "gpt-5.6-sol":                  { input: 5.00,  output: 30.00, cached: 0.50,  reasoning: 30.00,  cache_creation: 5.00  },
-  "gpt-6-astra":                  { input: 5.00,  output: 30.00, cached: 0.50,  reasoning: 30.00,  cache_creation: 5.00  },
+  // OpenAI Standard short-context pricing (developers.openai.com/api/docs/pricing).
+  // Long-context pricing is higher, but this table currently stores one rate per model.
+  "gpt-6-astra":                  { input: 10.00, output: 50.00, cached: 1.00,  reasoning: 50.00,  cache_creation: 12.50 },
+  "gpt-6-sol":                    { input: 2.00,  output: 10.00, cached: 0.20,  reasoning: 10.00,  cache_creation: 2.50  },
+  "gpt-6-luna":                   { input: 0.10,  output: 0.50,  cached: 0.01,  reasoning: 0.50,   cache_creation: 0.125 },
   "o1":                           { input: 15.00, output: 60.00, cached: 7.50,  reasoning: 90.00,  cache_creation: 15.00 },
   "o1-mini":                      { input: 3.00,  output: 12.00, cached: 1.50,  reasoning: 18.00,  cache_creation: 3.00  },
 
```

**File**: `tests/unit/codex-gpt6-lite.test.js` (modified, +10/-0)
```diff
@@ -3,6 +3,7 @@ import { afterEach, describe, expect, it, vi } from "vitest";
 import { CodexExecutor } from "../../open-sse/executors/codex.js";
 import { getModelsByProviderId } from "../../open-sse/config/providerModels.js";
 import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
+import { getPricingForModel } from "../../open-sse/providers/pricing.js";
 import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
 import * as proxyFetchModule from "../../open-sse/utils/proxyFetch.js";
 
@@ -17,12 +18,21 @@ describe("Codex GPT-6 Sol/Luna transport", () => {
     expect(getCapabilitiesForModel("codex", model)).toMatchObject({
       vision: true,
       reasoning: true,
+      search: true,
       thinkingFormat: "openai",
+      contextWindow: 272000,
+      maxOutput: 128000,
     });
     expect(getThinkingLevels("codex", model)).toEqual(["low", "medium", "high", "xhigh", "max"]);
     expect(getThinkingLevels("codex", `${model}(high)`)).toEqual(entry.thinkingLevels);
   });
 
+  it("uses official OpenAI Standard pricing for GPT-6", () => {
+    expect(getPricingForModel("codex", "gpt-6-astra")).toMatchObject({ input: 10, cached: 1, cache_creation: 12.5, output: 50 });
+    expect(getPricingForModel("codex", "gpt-6-sol")).toMatchObject({ input: 2, cached: 0.2, cache_creation: 2.5, output: 10 });
+    expect(getPricingForModel("codex", "gpt-6-luna")).toMatchObject({ input: 0.1, cached: 0.01, cache_creation: 0.125, output: 0.5 });
+  });
+
   it("keeps a native Responses Lite request intact", () => {
     const executor = new CodexExecutor();
     const input = [
```

---

### Incident Patch 13: `b58bd804` (2026-09-28)
**Commit Message**: fix(proxy): auto-fallback to insecure TLS on self-signed cert errors

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

**File**: `open-sse/utils/proxyFetch.js` (modified, +48/-12)
```diff
@@ -99,6 +99,20 @@ async function tryGotScrapingFetch(url, options) {
 
 // DNS cache — use Map to avoid prototype pollution via malformed hostnames
 const DNS_CACHE = new Map();
+const TLS_CERT_ERRORS = new Set([
+  "SELF_SIGNED_CERT_IN_CHAIN",
+  "DEPTH_ZERO_SELF_SIGNED_CERT",
+  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
+  "UNABLE_TO_GET_ISSUER_CERT",
+  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
+  "CERT_HAS_EXPIRED",
+  "ERR_TLS_CERT_ALTNAME_INVALID",
+]);
+
+function isTlsCertError(err) {
+  const code = err?.cause?.code || err?.code;
+  return TLS_CERT_ERRORS.has(code);
+}
 const MITM_BYPASS_HOSTS = [
   "cloudcode-pa.googleapis.com",
   "daily-cloudcode-pa.googleapis.com",
@@ -216,20 +230,44 @@ function resolveConnectionProxyUrl(targetUrl, proxyOptions) {
 /**
  * Create proxy dispatcher lazily (undici-compatible)
  */
-async function getDispatcher(proxyUrl) {
+async function getDispatcher(proxyUrl, insecure = false) {
   const normalized = normalizeProxyUrl(proxyUrl);
-  if (!normalized) return null;
+  if (!normalized && !insecure) return null;
 
-  if (!proxyDispatchers.has(normalized)) {
+  const key = `${normalized || "direct"}::${insecure ? "insecure" : "secure"}`;
+  if (!proxyDispatchers.has(key)) {
     // Evict oldest entry if max size reached
     if (proxyDispatchers.size >= MEMORY_CONFIG.proxyDispatchersMaxSize) {
       proxyDispatchers.delete(proxyDispatchers.keys().next().value);
     }
-    const { ProxyAgent } = await import("undici");
-    proxyDispatchers.set(normalized, new ProxyAgent({ uri: normalized }));
+    const { Agent, ProxyAgent } = await import("undici");
+    const connect = insecure ? { rejectUnauthorized: false } : undefined;
+    const dispatcher = normalized
+      ? new ProxyAgent({ uri: normalized, ...(insecure ? { requestTls: connect } : {}) })
+      : new Agent({ connect });
+    proxyDispatchers.set(key, dispatcher);
   }
 
-  return proxyDispatchers.get(normalized);
+  return proxyDispatchers.get(key);
+}
+
+async function fetchWithTlsFallback(url, options, proxyUrl) {
+  try {
+    const dispatcher = proxyUrl ? await getDispatcher(proxyUrl) : undefined;
+    return await originalFetch(url, dispatcher ? { ...options, dispatcher } : options);
+  } catch (err) {
+    const isStrictSsl = process.env.STRICT_SSL === "true" || process.env.STRICT_SSL === "1";
+    if (!isStrictSsl && isTlsCertError(err)) {
+      if (options.body && typeof options.body.getReader === "function" && options.body.locked) {
+        throw err;
+      }
+      // ponytail: in-memory insecure agent fallback for self-signed MITM corporate/antivirus certs
+      console.warn(`[ProxyFetch] TLS cert verification failed (${err.cause?.code || err.code}), retrying with insecure TLS: ${url}`);
+      const insecureDispatcher = await getDispatcher(proxyUrl, true);
+      return await originalFetch(url, { ...options, dispatcher: insecureDispatcher });
+    }
+    throw err;
+  }
 }
 
 /**
@@ -318,8 +356,7 @@ export async function proxyAwareFetch(url, options = {}, proxyOptions = null) {
     if (proxyUrl) {
       // Proxy resolves DNS externally (not affected by /etc/hosts) — use proxy directly
       try {
-        const dispatcher = await getDispatcher(proxyUrl);
-        return await originalFetch(url, { ...options, dispatcher });
+        return await fetchWithTlsFallback(url, options, proxyUrl);
       } catch (proxyError) {
         if (proxyOptions?.strictProxy === true) {
           throw new Error(`[ProxyFetch] Proxy required but failed (strictProxy=true): ${proxyError.message}`);
@@ -339,15 +376,14 @@ export async function proxyAwareFetch(url, options = {}, proxyOptions = null) {
 
   if (proxyUrl) {
     try {
-      const dispatcher = await getDispatcher(proxyUrl);
-      return await originalFetch(url, { ...options, dispatcher });
+      return await fetchWithTlsFallback(url, options, proxyUrl);
     } catch (proxyError) {
       // If strictProxy is enabled, fail hard instead of falling back to direct
       if (proxyOptions?.strictProxy === true) {
         throw new Error(`[ProxyFetch] Proxy required but failed (strictProxy=true): ${proxyError.message}`);
       }
       console.warn(`[ProxyFetch] Proxy failed, falling back to direct: ${proxyError.message}`);
-      return originalFetch(url, options);
+      return fetchWithTlsFallback(url, options, null);
     }
   }
 
@@ -371,7 +407,7 @@ export async function proxyAwareFetch(url, options = {}, proxyOptions = null) {
 
   // got-scraping disabled — use native fetch directly
   // (Re-enable per-host by wrapping with tryGotScrapingFetch when needed)
-  return originalFetch(url, options);
+  return fetchWithTlsFallback(url, options, null);
 }
 
 /**
```

---

### Incident Patch 14: `aafe3002` (2026-09-28)
**Commit Message**: fix(translator): strip errorMessage and other non-standard schema keywords from Gemini tool schemas

**File**: `open-sse/translator/formats/gemini.js` (modified, +8/-1)
```diff
@@ -32,7 +32,14 @@ export const UNSUPPORTED_SCHEMA_CONSTRAINTS = [
   "title", "optional", "deprecated", "if", "then", "else", "contentMediaType", "contentEncoding",
   // UI/Styling properties (from Cursor tools - NOT JSON Schema standard)
   "cornerRadius", "fillColor", "fontFamily", "fontSize", "fontWeight",
-  "gap", "padding", "strokeColor", "strokeThickness", "textColor"
+  "gap", "padding", "strokeColor", "strokeThickness", "textColor",
+  // Non-standard annotation/error keywords used by some MCP tool schemas (#4283).
+  // Gemini's schema proto has no field for these and rejects the whole request with
+  // "Unknown name X: Cannot find field" if any nested schema node carries them.
+  "errorMessage", "errorMessages", "x-errorMessage", "x-errorMessages",
+  "markdownDescription", "x-intellij-html-description",
+  "x-taplo-info", "x-taplo", "doNotSuggest", "suggestSortText",
+  "minProperties", "maxProperties"
 ];
 
 // Default safety settings
```

**File**: `tests/unit/gemini-unknown-schema-fields.test.js` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+/**
+ * Regression test for #4283
+ *
+ * Gemini Antigravity rejects tool schemas that contain unknown JSON Schema
+ * keywords with: "Unknown name X: Cannot find field."
+ *
+ * The UNSUPPORTED_SCHEMA_CONSTRAINTS list in gemini.js did not include
+ * "errorMessage" (and similar non-standard annotation keywords used by some
+ * MCP tool schemas), causing 400 INVALID_ARGUMENT errors on tools with error
+ * documentation fields.
+ *
+ * Fix: add errorMessage, errorMessages, markdownDescription, and other
+ * non-standard annotation keywords to the strip list.
+ */
+
+import { describe, it, expect } from "vitest";
+import { cleanJSONSchemaForAntigravity, UNSUPPORTED_SCHEMA_CONSTRAINTS } from "../../open-sse/translator/formats/gemini.js";
+
+describe("UNSUPPORTED_SCHEMA_CONSTRAINTS includes non-standard annotation keywords (#4283)", () => {
+  it("includes errorMessage", () => {
+    expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain("errorMessage");
+  });
+  it("includes errorMessages", () => {
+    expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain("errorMessages");
+  });
+  it("includes markdownDescription", () => {
+    expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain("markdownDescription");
+  });
+  it("includes minProperties", () => {
+    expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain("minProperties");
+  });
+  it("includes maxProperties", () => {
+    expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain("maxProperties");
+  });
+});
+
+describe("cleanJSONSchemaForAntigravity strips errorMessage recursively (#4283)", () => {
+  it("strips top-level errorMessage", () => {
+    const schema = {
+      type: "object",
+      properties: {
+        code: { type: "integer" }
+      },
+      errorMessage: "Invalid input"
+    };
+    const result = cleanJSONSchemaForAntigravity(structuredClone(schema));
+    expect(result).not.toHaveProperty("errorMessage");
+  });
+
+  it("strips errorMessage nested inside array items", () => {
+    const schema = {
+      type: "object",
+      properties: {
+        tags: {
+          type: "array",
+          items: {
+            type: "string",
+            errorMessage: "Must be a non-empty string"
+          }
+        }
+      }
+    };
+    const result = cleanJSONSchemaForAntigravity(structuredClone(schema));
+    expect(result.properties.tags.items).not.toHaveProperty("errorMessage");
+  });
+
+  it("strips markdownDescription from nested property", () => {
+    const schema = {
+      type: "object",
+      properties: {
+        name: {
+          type: "string",
+          markdownDescription: "The **name** of the resource"
+        }
+      }
+    };
+    const result = cleanJSONSchemaForAntigravity(structuredClone(schema));
+    expect(result.properties.name).not.toHaveProperty("markdownDescription");
+  });
+
+  it("strips minProperties / maxProperties", () => {
+    const schema = {
+      type: "object",
+      minProperties: 1,
+      maxProperties: 10,
+      properties: { x: { type: "string" } }
+    };
+    const result = cleanJSONSchemaForAntigravity(structuredClone(schema));
+    expect(result).not.toHaveProperty("minProperties");
+    expect(result).not.toHaveProperty("maxProperties");
+  });
+
+  it("leaves other valid fields intact", () => {
+    const schema = {
+      type: "object",
+      description: "A valid tool",
+      properties: {
+        n: { type: "number", description: "A number" }
+      }
+    };
+    const result = cleanJSONSchemaForAntigravity(structuredClone(schema));
+    expect(result.description).toBe("A valid tool");
+    expect(result.properties.n.description).toBe("A number");
+  });
+});
\ No newline at end of file
```

---

### Incident Patch 15: `4f274c7f` (2026-09-28)
**Commit Message**: fix(translator/claude): keep a user turn whose only block is container_upload

**File**: `open-sse/translator/formats/claude.js` (modified, +21/-13)
```diff
@@ -26,24 +26,32 @@ export function lastCacheableToolIndex(tools) {
 }
 
 // Check if message has valid non-empty content
+// A block type outside this list makes the whole message count as empty and be
+// dropped by prepareClaudeRequest — so anything the caller can legitimately
+// send alone must be listed. container_upload (Files API) is one of those:
+// a user turn whose only block is a file reference is valid Anthropic input
+// (#4316), and dropping it forwarded `messages: []` to the provider.
+const CONTENTFUL_BLOCKS = new Set([
+  CLAUDE_BLOCK.TOOL_USE,
+  CLAUDE_BLOCK.TOOL_RESULT,
+  CLAUDE_BLOCK.IMAGE,
+  CLAUDE_BLOCK.DOCUMENT,
+  CLAUDE_BLOCK.CONTAINER_UPLOAD,
+]);
+
+function isContentfulBlock(block) {
+  if (!block) return false;
+  if (block.type === CLAUDE_BLOCK.TEXT) return !!block.text?.trim();
+  return CONTENTFUL_BLOCKS.has(block.type);
+}
+
 export function hasValidContent(msg) {
   if (typeof msg.content === "string" && msg.content.trim()) return true;
   if (msg.content && typeof msg.content === "object" && !Array.isArray(msg.content)) {
-    const block = msg.content;
-    return !!((block.type === CLAUDE_BLOCK.TEXT && block.text?.trim()) ||
-      block.type === CLAUDE_BLOCK.TOOL_USE ||
-      block.type === CLAUDE_BLOCK.TOOL_RESULT ||
-      block.type === CLAUDE_BLOCK.IMAGE ||
-      block.type === CLAUDE_BLOCK.DOCUMENT);
+    return isContentfulBlock(msg.content);
   }
   if (Array.isArray(msg.content)) {
-    return msg.content.some(block =>
-      (block.type === CLAUDE_BLOCK.TEXT && block.text?.trim()) ||
-      block.type === CLAUDE_BLOCK.TOOL_USE ||
-      block.type === CLAUDE_BLOCK.TOOL_RESULT ||
-      block.type === CLAUDE_BLOCK.IMAGE ||
-      block.type === CLAUDE_BLOCK.DOCUMENT
-    );
+    return msg.content.some(isContentfulBlock);
   }
   return false;
 }
```

**File**: `open-sse/translator/schema/blocks.js` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ export const CLAUDE_BLOCK = {
   DOCUMENT: "document",
   TOOL_USE: "tool_use",
   TOOL_RESULT: "tool_result",
+  CONTAINER_UPLOAD: "container_upload",
   THINKING: "thinking",
   REDACTED_THINKING: "redacted_thinking",
   SERVER_TOOL_USE: "server_tool_use",
```

**File**: `tests/unit/claude-container-upload.test.js` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+// #4316: a user message whose only content block is `container_upload`
+// (Anthropic Files API) was dropped whole, so the provider received
+// `messages: []` and the request still returned 200 with no indication that
+// the user turn had vanished.
+//
+// hasValidContent() enumerated the block types that count as content, and any
+// type outside that list made the message look empty — prepareClaudeRequest
+// then filtered it out. container_upload is valid Anthropic input on its own,
+// and on the Claude→Claude route no translation runs at all, so the block
+// should reach the provider untouched.
+import { describe, expect, it } from "vitest";
+
+import { hasValidContent, prepareClaudeRequest } from "../../open-sse/translator/formats/claude.js";
+
+const uploadBlock = { type: "container_upload", file_id: "file_abc123" };
+
+describe("container_upload keeps the user turn alive (#4316)", () => {
+  it("counts a lone container_upload block as content", () => {
+    expect(hasValidContent({ role: "user", content: [uploadBlock] })).toBe(true);
+  });
+
+  it("counts a bare container_upload object as content", () => {
+    expect(hasValidContent({ role: "user", content: uploadBlock })).toBe(true);
+  });
+
+  it("does not forward messages: [] for a container_upload-only request", () => {
+    const body = {
+      model: "claude-sonnet-4-5",
+      max_tokens: 64,
+      messages: [{ role: "user", content: [uploadBlock] }],
+    };
+    const prepared = prepareClaudeRequest(body);
+    expect(prepared.messages).toHaveLength(1);
+    expect(prepared.messages[0].role).toBe("user");
+    expect(prepared.messages[0].content).toContainEqual(expect.objectContaining({
+      type: "container_upload",
+      file_id: "file_abc123",
+    }));
+  });
+
+  it("still drops a genuinely empty message", () => {
+    expect(hasValidContent({ role: "user", content: [] })).toBe(false);
+    expect(hasValidContent({ role: "user", content: [{ type: "text", text: "   " }] })).toBe(false);
+  });
+
+  it("keeps a container_upload alongside text", () => {
+    const body = {
+      model: "claude-sonnet-4-5",
+      max_tokens: 64,
+      messages: [{ role: "user", content: [uploadBlock, { type: "text", text: "summarise this" }] }],
+    };
+    const prepared = prepareClaudeRequest(body);
+    expect(prepared.messages).toHaveLength(1);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #4599** (closed): fix(claude): correct Opus 5.5 capabilities and pricing (@mrnim94)
- **PR #4592** (closed): fix(grok): avoid inferring exhausted quota from zero spending cap (@mannnrachman)
- **PR #4590** (closed): fix(grok): serialize tool calls for ordered workflows (@mannnrachman)
- **PR #4540** (closed): New files from Fly.io Launch (@hoanpre05-stack)
- **PR #4530** (closed): feat(routing): add in-flight awareness and per-tab session isolation … (@Kazee86)
- **PR #4504** (closed): fix(grok-cli): send Grok CLI 1.0.44 so proxy stops returning HTTP 426 (@novalaryas)
- **PR #4503** (closed): fix(grok-cli): raise the spoofed CLI version past the upstream gate (@produtoramaxvision)
- **PR #4502** (closed): feat: Add ZCode oauth provider (@Feavy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
