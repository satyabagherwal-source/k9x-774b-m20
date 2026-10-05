# Forensic Learning Record (Deep Inspection): mksglu/context-mode

> **Canonical Artifact**: `07_PROJECT_LEARNING/mksglu-context-mode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mksglu/context-mode](https://github.com/mksglu/context-mode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:28:54.850Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mksglu/context-mode`
- **Description**: Context window optimization for AI coding agents. Sandboxes tool output (98% reduction), persists session memory, and   enforces routing across 17 platforms via MCP + hooks.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 24413 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.openclaw-plugin/index.ts`
```
/**
 * OpenClaw plugin entry point for context-mode.
 *
 * This thin wrapper delegates to the compiled plugin logic.
 * OpenClaw loads this file via jiti (TypeScript runtime) when
 * discovering plugins from the .openclaw-plugin/ directory.
 *
 * The actual plugin definition (object form with id, name, configSchema,
 * register) lives in src/adapters/openclaw/plugin.ts, compiled to
 * build/adapters/openclaw/plugin.js.
 */
export { default } from "../build/adapters/openclaw/plugin.js";

```

### Core Architecture Module: `.pi/extensions/context-mode/index.ts`
```
export { default } from "../../../build/adapters/pi/extension.js";

```

### Core Architecture Module: `bin/statusline.mjs`
```
#!/usr/bin/env node
/**
 * context-mode status line — Claude Code statusLine integration.
 *
 * Reads stats DIRECTLY from SessionDB (`session_events` + `session_resume`),
 * mirroring the `ctx_stats` MCP handler at src/server.ts:2807-2891 so the
 * statusline and ctx_stats never drift. The legacy per-PID sidecar JSON
 * (`stats-pid-*.json`) is no longer the source of truth — sidecars were
 * eventually-consistent (500ms+30s throttles) and PID-scoped (multiple
 * Claude sessions colliding on the same shell ppid).
 *
 * Discipline (Datadog / Stripe / Vercel pattern):
 *   - "context-mode" full brand label, never abbreviated
 *   - ONE chromatic accent (status dot ●), everything else monochrome
 *   - Bold for KPI numbers ($, %), dim for context
 *   - No counts (calls / tokens / events) — only $ and % pass the
 *     value-per-pixel test
 *
 * Wire it up in ~/.claude/settings.json:
 *   {
 *     "statusLine": {
 *       "type": "command",
 *       "command": "context-mode statusline"
 *     }
 *   }
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import {
  ensureWritableStorageDir,
  resolveDefaultSessionDir,
  resolveSessionStorageDir,
} from "../hooks/session-db.bundle.mjs";

// ── Analytics import — resolved relative to this script ─────────────────
// statusline.mjs ships in `bin/`; the compiled analytics module lives in
// `build/session/analytics.js`. Import lazily so a missing build doesn't
// crash the renderer — degrade to the substantiated headline instead.
//
// The dynamic import target MUST be a `file://` URL on Windows. Node's
// ESM loader rejects absolute drive-letter paths (`C:\...`) with
// ERR_UNSUPPORTED_ESM_URL_SCHEME — which the catch below silently
// swallows, leaving `_analytics = null` and rendering the empty-state
// headline forever. Convert to a file URL so Windows accepts it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ANALYTICS_PATH = resolve(__dirname, "..", "build", "session", "analytics.js");
const ANALYTICS_URL = pathToFileURL(ANALYTICS_PATH).href;

let _analytics = null;
async function loadAnalytics() {
  if (_analytics) return _analytics;
  try {
    _analytics = await import(ANALYTICS_URL);
  } catch {
    _analytics = null;
  }
  return _analytics;
}

// Test seams — keep production behaviour identical when env vars unset.
//   CTX_TEST_PLATFORM — override process.platform for cross-OS resolver tests
//   CTX_TEST_PROC_DIR — override /proc base dir for Linux PID-walk tests
const TEST_PLATFORM = process.env.CTX_TEST_PLATFORM;
const PROC_DIR = process.env.CTX_TEST_PROC_DIR || "/proc";
function platform() {
  return TEST_PLATFORM || process.platform;
}

// Single-shot stderr warning latch — keep noise out of Claude Code's
// statusline output even when our parent runs us repeatedly per session.
const __warnedKeys = new Set();
function warnOnce(key, msg) {
  if (__warnedKeys.has(key)) return;
  __warnedKeys.add(key);
  try { process.stderr.write(`context-mode statusline: ${msg}\n`); } catch { /* ignore */ }
}

// ── ANSI palette (single chromatic accent on the status dot) ────────────
const NO_COLOR = process.env.NO_COLOR || !process.stdout.isTTY;
const ansi = (code, text) => (NO_COLOR ? text : `\x1b[${code}m${text}\x1b[0m`);
const brand = (t) => ansi("1;36", t);   // bold cyan — brand presence
const bold = (t) => ansi("1", t);        // bold default fg — KPI numbers
const dim = (t) => ansi("2", t);         // dim default fg — context
const green = (t) => ansi("32", t);      // healthy dot
const yellow = (t) => ansi("33", t);     // degraded dot
const red = (t) => ansi("31", t);        // stale dot
const SEP = dim("·");

// ── Stdin drain ─────────────────────────────────────────────────────────
function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf-8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch (err) {
    // The payload is load-bearing — it carries session_id, which resolves the
    // per-session KPI. Empty stdin (normal first render) returned above and
    // stays silent; a non-empty payload that fails to parse is a real anomaly
    // worth one latched stderr line (never pollutes the statusline's stdout).
    warnOnce("stdin-parse", `failed to parse statusline stdin JSON: ${err?.message ?? err}`);
    return {};
  }
}

function resolveSessionDir() {
  return ensureWritableStorageDir(
    resolveSessionStorageDir(() => resolveDefaultSessionDir({
      configDir: ".claude",
      configDirEnv: "CLAUDE_CONFIG_DIR",
      legacySessionDirEnv: "CONTEXT_MODE_SESSION_DIR",
      onLegacySessionDir: () => {
        warnOnce(
          "legacy-session-dir",
          "CONTEXT_MODE_SESSION_DIR is deprecated; set CONTEXT_MODE_DIR to the parent context-mode root.",
        );
      },
    })),
  );
}

/**
 * Walk up the parent process chain to find the Claude Code PID.
 *
 * Claude Code spawns the status line through a shell, so process.ppid is
 * the intermediate shell, not Claude Code itself. We walk up until we find
 * a process whose name matches /claude/i.
 *
 * Per-OS resolver:
 *   - linux: read PPid + Name from /proc/<pid>/status
 *   - darwin: ps -o ppid=,comm= -p <pid> (BSD ps; works without /proc)
 *   - win32: degraded — process.ppid only, with a one-shot stderr warning
 *
 * Without this walk, multiple concurrent Claude sessions all see the same
 * shell ppid and collide on per-PID stats lookup.
 */
function findClaudePid() {
  const plat = platform();
  if (plat === "linux") return findClaudePidLinux();
  if (plat === "darwin") return findClaudePidDarwin();
  if (plat === "win32") {
    warnOnce(
      "win",
      "Windows process-tree walk unsupported; multiple concurrent Claude sessions may collide. Set CLAUDE_SESSION_ID for deterministic resolution.",
    );
    return process.ppid;
  }
  return process.ppid;
}

function findClaudePidLinux() {
  let pid = process.ppid;
  for (let i = 0; i < 8 && pid && pid > 1; i++) {
    try {
      const status = readFileSync(`${PROC_DIR}/${pid}/status`, "utf-8");
      const nameMatch = status.match(/^Name:\s+(.+)$/m);
      const ppidMatch = status.match(/^PPid:\s+(\d+)/m);
      const name = nameMatch?.[1]?.trim() ?? "";
      if (/claude/i.test(name)) return pid;
      pid = ppidMatch ? Number(ppidMatch[1]) : 0;
    } catch {
      return process.ppid;
    }
  }
  return process.ppid;
}

function findClaudePidDarwin() {
  let pid = process.ppid;
  for (let i = 0; i < 8 && pid && pid > 1; i++) {
    try {
      const out = execFileSync(
        "ps",
        ["-o", "ppid=,comm=", "-p", String(pid)],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (!out) return process.ppid;
      const m = out.match(/^\s*(\d+)\s+(.+)$/);
      if (!m) return process.ppid;
      const parentPid = Number(m[1]);
      const comm = m[2].trim();
      const base = comm.split("/").pop() || comm;
      if (/claude/i.test(base)) return pid;
      pid = parentPid;
    } catch {
      return process.ppid;
    }
  }
  return process.ppid;
}

function resolveSessionId(payload) {
  // PRIMARY: the session_id Claude Code delivers in the statusLine stdin
  // payload. This is the SAME id the recording hooks key session_events by,
  // so it's the only source that reliably matches stored per-session data.
  //
  // Claude Code does NOT export a CLAUDE_SESSION_ID env var — session_id is
  // delivered only in the stdin JSON (statusline.md "Available data"). And the
  // /proc PID walk yields `pid-<n>`, which never matches a UUID-keyed session.
  // So without reading the payload, the per-session KPI is unreachable and the
  // bar falls back to the global lifetime aggregate — identical in every
  // session and seemingly "frozen".
  const fromPayload = payload?.session_id;
  if (typeof fromPayload =
```

### Core Architecture Module: `cli.bundle.mjs`
```
#!/usr/bin/env node
var eO=Object.create;var Ad=Object.defineProperty;var tO=Object.getOwnPropertyDescriptor;var nO=Object.getOwnPropertyNames;var rO=Object.getPrototypeOf,oO=Object.prototype.hasOwnProperty;var x=(t,e)=>()=>(t&&(e=t(t=0)),e);var L=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports),_e=(t,e)=>{for(var n in e)Ad(t,n,{get:e[n],enumerable:!0})},sO=(t,e,n,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of nO(e))!oO.call(t,o)&&o!==n&&Ad(t,o,{get:()=>e[o],enumerable:!(r=tO(e,o))||r.enumerable});return t};var Si=(t,e,n)=>(n=t!=null?eO(rO(t)):{},sO(e||!t||!t.__esModule?Ad(n,"default",{value:t,enumerable:!0}):n,t));var Ld=L((A9,Zb)=>{"use strict";var jd={to(t,e){return e?`\x1B[${e+1};${t+1}H`:`\x1B[${t+1}G`},move(t,e){let n="";return t<0?n+=`\x1B[${-t}D`:t>0&&(n+=`\x1B[${t}C`),e<0?n+=`\x1B[${-e}A`:e>0&&(n+=`\x1B[${e}B`),n},up:(t=1)=>`\x1B[${t}A`,down:(t=1)=>`\x1B[${t}B`,forward:(t=1)=>`\x1B[${t}C`,backward:(t=1)=>`\x1B[${t}D`,nextLine:(t=1)=>"\x1B[E".repeat(t),prevLine:(t=1)=>"\x1B[F".repeat(t),left:"\x1B[G",hide:"\x1B[?25l",show:"\x1B[?25h",save:"\x1B7",restore:"\x1B8"},bO={up:(t=1)=>"\x1B[S".repeat(t),down:(t=1)=>"\x1B[T".repeat(t)},xO={screen:"\x1B[2J",up:(t=1)=>"\x1B[1J".repeat(t),down:(t=1)=>"\x1B[J".repeat(t),line:"\x1B[2K",lineEnd:"\x1B[K",lineStart:"\x1B[1K",lines(t){let e="";for(let n=0;n<t;n++)e+=this.line+(n<t-1?jd.up():"");return t&&(e+=jd.left),e}};Zb.exports={cursor:jd,scroll:bO,erase:xO,beep:"\x07"}});var Xb=L((bV,Zd)=>{var yc=process||{},Gb=yc.argv||[],gc=yc.env||{},qO=!(gc.NO_COLOR||Gb.includes("--no-color"))&&(!!gc.FORCE_COLOR||Gb.includes("--color")||yc.platform==="win32"||(yc.stdout||{}).isTTY&&gc.TERM!=="dumb"||!!gc.CI),VO=(t,e,n=t)=>r=>{let o=""+r,s=o.indexOf(e,t.length);return~s?t+WO(o,e,n,s)+e:t+o+e},WO=(t,e,n,r)=>{let o="",s=0;do o+=t.substring(s,r)+n,s=r+e.length,r=t.indexOf(e,s);while(~r);return o+t.substring(s)},Jb=(t=qO)=>{let e=t?VO:()=>String;return{isColorSupported:t,reset:e("\x1B[0m","\x1B[0m"),bold:e("\x1B[1m","\x1B[22m","\x1B[22m\x1B[1m"),dim:e("\x1B[2m","\x1B[22m","\x1B[22m\x1B[2m"),italic:e("\x1B[3m","\x1B[23m"),underline:e("\x1B[4m","\x1B[24m"),inverse:e("\x1B[7m","\x1B[27m"),hidden:e("\x1B[8m","\x1B[28m"),strikethrough:e("\x1B[9m","\x1B[29m"),black:e("\x1B[30m","\x1B[39m"),red:e("\x1B[31m","\x1B[39m"),green:e("\x1B[32m","\x1B[39m"),yellow:e("\x1B[33m","\x1B[39m"),blue:e("\x1B[34m","\x1B[39m"),magenta:e("\x1B[35m","\x1B[39m"),cyan:e("\x1B[36m","\x1B[39m"),white:e("\x1B[37m","\x1B[39m"),gray:e("\x1B[90m","\x1B[39m"),bgBlack:e("\x1B[40m","\x1B[49m"),bgRed:e("\x1B[41m","\x1B[49m"),bgGreen:e("\x1B[42m","\x1B[49m"),bgYellow:e("\x1B[43m","\x1B[49m"),bgBlue:e("\x1B[44m","\x1B[49m"),bgMagenta:e("\x1B[45m","\x1B[49m"),bgCyan:e("\x1B[46m","\x1B[49m"),bgWhite:e("\x1B[47m","\x1B[49m"),blackBright:e("\x1B[90m","\x1B[39m"),redBright:e("\x1B[91m","\x1B[39m"),greenBright:e("\x1B[92m","\x1B[39m"),yellowBright:e("\x1B[93m","\x1B[39m"),blueBright:e("\x1B[94m","\x1B[39m"),magentaBright:e("\x1B[95m","\x1B[39m"),cyanBright:e("\x1B[96m","\x1B[39m"),whiteBright:e("\x1B[97m","\x1B[39m"),bgBlackBright:e("\x1B[100m","\x1B[49m"),bgRedBright:e("\x1B[101m","\x1B[49m"),bgGreenBright:e("\x1B[102m","\x1B[49m"),bgYellowBright:e("\x1B[103m","\x1B[49m"),bgBlueBright:e("\x1B[104m","\x1B[49m"),bgMagentaBright:e("\x1B[105m","\x1B[49m"),bgCyanBright:e("\x1B[106m","\x1B[49m"),bgWhiteBright:e("\x1B[107m","\x1B[49m")}};Zd.exports=Jb();Zd.exports.createColors=Jb});function wi(t,e){let n=process.execPath.replace(/\\/g,"/");if(Jr(e?.platform)){let o=n.split("/").pop().replace(/\.exe$/i,"");qd.has(o)||(n=e?.jsRuntime?.replace(/\\/g,"/")??"node")}let r=t.replace(/\\/g,"/");return`"${n}" "${r}"`}function qe(t,e){if(Jr(e?.platform))return wi(t,e);let r=Vd().path.replace(/\\/g,"/"),o=t.replace(/\\/g,"/");return`"${r}" "${o}"`}function _c(t){if(typeof t!="string"||t.length===0)return null;let e=t.match(/^"([^"]+)"\s+"([^"]+)"\s*$/);return e?{nodePath:e[1],scriptPath:e[2]}:null}function Jr(t){return!!t&&KO.has(t)}var qd,KO,Rn=x(()=>{"use strict";Yo();qd=new Set(["node","bun","deno"]),KO=new Set(["opencode","kilo"])});var ox={};_e(ox,{buildCommand:()=>Xd,detectRuntimes:()=>Xr,getAvailableLanguages:()=>$i,getRuntimeSummary:()=>Ti,hasBunRuntime:()=>mr,isAllowlistedShell:()=>Qb,resetHookRuntimeCache:()=>eI,resolveHookRuntime:()=>Vd,resolveJavascriptRuntime:()=>rx});import{execFileSync as Gd,execSync as Qo}from"node:child_process";import{existsSync as es}from"node:fs";function Kd(t){let e=t.split(/[\\/]/);return e[e.length-1]??t}function Qb(t){return GO.test(Kd(t))}function JO(t){let e=t.toLowerCase().replace(/\//g,"\\");return/\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(e)||/\\microsoft\\windowsapps\\bash\.exe$/.test(e)}function XO(t){let e=t.toLowerCase().replace(/\//g,"\\");return/\\windows\\(?:system32|sysnative)\\cmd\.exe$/.test(e)}function Ke(t){try{let e=Ei?`where ${t}`:`command -v ${t}`;return Qo(e,{stdio:"pipe"}),!0}catch{return!1}}function Wd(t){if(Ei)try{let n=Qo(`where ${t}`,{encoding:"utf-8",stdio:"pipe"}).trim().split(/\r?\n/).map(o=>o.trim()).filter(Boolean);if(n.length===0||n.filter(o=>!/\\Microsoft\\WindowsApps\\/i.test(o)).length===0)return!1}catch{return!1}else if(!Ke(t))return!1;try{return Ei?Qo(`"${t}" --version`,{stdio:"pipe",timeout:5e3}):Gd(t,["--version"],{stdio:"pipe",timeout:1500}),!0}catch{return!1}}function Jd(){if(Ke("bun"))return!0;for(let t of tx())if(es(t))return!0;return!1}function ex(){for(let e of tx())if(es(e))return e;if(Ke("bun"))return"bun";let t=process.env.HOME??process.env.USERPROFILE??"";return Ei?`${t}\\.bun\\bin\\bun.exe`:`${t}/.bun/bin/bun`}function tx(){let t=process.env.HOME??process.env.USERPROFILE??"";if(Ei){let e=process.env.LOCALAPPDATA??"",n=process.env.APPDATA??"";return[...t?[`${t}\\.bun\\bin\\bun.exe`]:[],...e?[`${e}\\bun\\bin\\bun.exe`]:[],...n?[`${n}\\npm\\node_modules\\bun\\bin\\bun.exe`]:[]]}return t?[`${t}/.bun/bin/bun`]:[]}function nx(){let t;try{t=Qo("where bash",{encoding:"utf-8",stdio:"pipe"}).trim().split(/\r?\n/).map(n=>n.trim()).filter(Boolean)}catch{return null}for(let e of t){let n=e.toLowerCase();if(!(n.includes("system32")||n.includes("windowsapps"))){for(let r of YO)if(es(r))return r;return e}}return null}function QO(t=nx()){return t??(Ke("sh")?"sh":Ke("pwsh")?"pwsh":Ke("powershell")?"powershell":"cmd.exe")}function Wt(t,e=["--version"]){try{if(process.platform==="win32"){let n=[t,...e].map(r=>/[\s"&|<>^()%!]/.test(r)?JSON.stringify(r):r).join(" ");return Qo(n,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3}).trim().split(/\r?\n/)[0]}else return Gd(t,e,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3}).trim().split(/\r?\n/)[0]}catch{return"unknown"}}function rx(t,e={}){if(t)return t;let n=e.execPath??process.execPath,r=e.commandExists??Ke,o=n.split(/[\\/]/).pop().replace(/\.exe$/i,"");return qd.has(o)&&es(n)?n:r("node")?"node":null}function Xr(){let e=Jd()?ex():null,n=process.env.SHELL,r=process.platform==="win32",o=r?nx():null,s=n&&es(n)&&Qb(n)&&!(r&&JO(n))&&!(r&&o&&XO(n))?n:null;return{javascript:rx(e),typescript:e||(Ke("tsx")?"tsx":Ke("ts-node")?"ts-node":null),python:Wd("python3")?"python3":Wd("python")?"python":Wd("py")?"py":null,shell:s??(r?QO(o):Ke("bash")?"bash":"sh"),ruby:Ke("ruby")?"ruby":null,go:Ke("go")?"go":null,rust:Ke("rustc")?"rustc":null,php:Ke("php")?"php":null,perl:Ke("perl")?"perl":null,r:Ke("Rscript")?"Rscript":Ke("r")?"r":null,elixir:Ke("elixir")?"elixir":null,csharp:Ke("dotnet-script")?"dotnet-script":null}}function mr(){return Jd()}function eI(){Ht=null}function tI(t){let e=t.trim(),n=/^(\d+)\.(\d+)\.(\d+)/.exec(e);if(!n)return!1;let r=Number(n[1]);return Number.isFinite(r)&&r>=1}function nI(){return es(process.execPath)?{path:process.execPath,isBun:!1}:Ke("node")?{path:"node",isBun:!1}:{path:process.execPath,isBun:!1}}function Vd(){if(Ht)return Ht;let t=nI();try{if(!Jd())return Ht=t,Ht;let e=ex(),n;try{if(process.platform==="win32"){let r=Qo(`"${e}" --version`,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3
```

### Core Architecture Module: `hooks/antigravity-cli/payload.mjs`
```
/**
 * Shared Antigravity CLI (`agy`) hook payload normalization.
 *
 * The only refs-backed field is the working directory: the upstream hook example
 * (refs/platforms/antigravity-cli/examples/title/title.sh:10, README.md:11)
 * reads it from `workspace.current_dir` (an OBJECT field). We read that FIRST.
 *
 * The remaining fields below are empirically-derived/UNVERIFIED — no upstream
 * agy doc or example confirms this shape; they are best-effort assumptions:
 *   { conversationId, stepIdx, toolCall: { name, args }, error,
 *     workspacePaths: [..], transcriptPath, artifactDirectoryPath }
 *
 * The shared context-mode capture/routing code expects Claude-shaped fields, so
 * keep this mapping in one place for PreToolUse/PostToolUse/Stop.
 */

export function parseAgyPayload(raw) {
  try {
    const cleaned = String(raw ?? "").replace(/^\uFEFF/, "").trim();
    return cleaned ? JSON.parse(cleaned) : {};
  } catch {
    return {};
  }
}

export function getAgyProjectDir(payload) {
  // Refs-backed FIRST: workspace.current_dir is the only upstream-documented
  // field (examples/title/title.sh:10). `workspacePaths[0]` is an unverified
  // fallback kept defensively.
  const workspace = payload?.workspace;
  if (workspace && typeof workspace === "object" && typeof workspace.current_dir === "string" && workspace.current_dir) {
    return workspace.current_dir;
  }
  return Array.isArray(payload?.workspacePaths) && payload.workspacePaths.length > 0
    ? String(payload.workspacePaths[0])
    : undefined;
}

// agy native tool-name -> canonical map. Keep in sync with the two other copies:
// hooks/core/routing.mjs (TOOL_ALIASES) and src/session/extract.ts
// (TOOL_NAME_NORMALIZE). Three layers normalize independently; adding a new agy
// tool means updating all three (a single shared table is a follow-up cleanup).
function normalizeAgyToolName(name) {
  switch (name) {
    case "run_command":
      return "Bash";
    case "view_file":
      return "Read";
    case "grep_search":
      return "Grep";
    case "list_dir":
      return "LS";
    case "web_fetch":
    case "read_url_content":
      return "WebFetch";
    case "search_web":
      return "WebSearch";
    default:
      return name;
  }
}

function normalizeAgyToolInput(toolName, args) {
  const input = args && typeof args === "object" ? { ...args } : {};
  const canonical = normalizeAgyToolName(toolName);
  if (canonical === "Bash" && typeof input.CommandLine === "string" && typeof input.command !== "string") {
    input.command = input.CommandLine;
  }
  if (canonical === "WebFetch") {
    const url = input.url ?? input.URL ?? input.Url;
    if (typeof url === "string" && typeof input.url !== "string") input.url = url;
  }
  if (canonical === "Read") {
    const filePath = input.file_path ?? input.path ?? input.AbsolutePath ?? input.FilePath;
    if (typeof filePath === "string" && typeof input.file_path !== "string") input.file_path = filePath;
  }
  if (canonical === "Grep") {
    const pattern = input.pattern ?? input.Pattern ?? input.query ?? input.Query;
    if (typeof pattern === "string" && typeof input.pattern !== "string") input.pattern = pattern;
  }
  return input;
}

export function fromAgy(payload) {
  const toolCall = payload?.toolCall ?? {};
  const rawToolName = toolCall?.name ?? "";
  return {
    session_id: payload?.conversationId,
    transcript_path: payload?.transcriptPath,
    cwd: getAgyProjectDir(payload),
    tool_name: normalizeAgyToolName(rawToolName),
    tool_input: normalizeAgyToolInput(rawToolName, toolCall?.args),
    tool_response: typeof payload?.error === "string" ? payload.error : "",
    tool_output: {
      isError: typeof payload?.error === "string" && payload.error.length > 0,
    },
  };
}

```

### Core Architecture Module: `hooks/antigravity-cli/posttooluse.mjs`
```
#!/usr/bin/env node
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Antigravity CLI (`agy`) PostToolUse hook — session event capture.
 *
 * agy fires hooks from a config at ~/.gemini/config/hooks.json (or via an
 * installed agy plugin's hooks/hooks.json) and pipes a payload whose shape
 * differs from the Claude-Code/Codex wire format this pipeline expects:
 *
 *   { conversationId, stepIdx, toolCall: { name, args }, error,
 *     workspacePaths: [..], transcriptPath, artifactDirectoryPath }
 *
 * The event name arrives as argv (set in hooks.json), NOT in the payload, and
 * the hook CWD is ~/.gemini/config — so the project dir MUST come from
 * workspacePaths[0], never process.cwd(). We translate agy's payload into the
 * Claude-shaped `input` the shared extractor/attribution pipeline consumes,
 * then reuse it unchanged. This hook is capture-only and emits no stdout.
 */

import {
  readStdin,
  getSessionId,
  getSessionDBPath,
  getInputProjectDir,
  ANTIGRAVITY_CLI_OPTS,
} from "../session-helpers.mjs";
import { createSessionLoaders, attributeAndInsertEvents } from "../session-loaders.mjs";
import { readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { fromAgy, parseAgyPayload } from "./payload.mjs";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB, loadExtract, loadProjectAttribution } = createSessionLoaders(HOOK_DIR);
const OPTS = ANTIGRAVITY_CLI_OPTS;

try {
  const input = fromAgy(parseAgyPayload(await readStdin()));

  if (input.tool_name) {
    const projectDir = getInputProjectDir(input, OPTS);

    const { extractEvents } = await loadExtract();
    const { resolveProjectAttributions } = await loadProjectAttribution();
    const { SessionDB } = await loadSessionDB();

    const dbPath = getSessionDBPath(OPTS, projectDir);
    const db = new SessionDB({ dbPath });
    const sessionId = getSessionId(input, OPTS);

    db.ensureSession(sessionId, projectDir);

    const normalizedInput = {
      tool_name: input.tool_name,
      tool_input: input.tool_input ?? {},
      tool_response: input.tool_response ?? "",
      tool_output: input.tool_output,
    };

    const events = extractEvents(normalizedInput);
    attributeAndInsertEvents(db, sessionId, events, input, projectDir, "PostToolUse", resolveProjectAttributions);

    try {
      const rejectedPath = resolve(tmpdir(), `context-mode-rejected-${sessionId}.txt`);
      let rejectedData;
      try {
        rejectedData = readFileSync(rejectedPath, "utf-8").trim();
        unlinkSync(rejectedPath);
      } catch { /* no marker */ }
      if (rejectedData) {
        const colonIdx = rejectedData.indexOf(":");
        const rejTool = colonIdx > 0 ? rejectedData.slice(0, colonIdx) : rejectedData;
        const rejReason = colonIdx > 0 ? rejectedData.slice(colonIdx + 1) : "denied";
        attributeAndInsertEvents(
          db,
          sessionId,
          [{
            type: "rejected",
            category: "rejected-approach",
            data: `${rejTool}: ${rejReason}`,
            priority: 2,
          }],
          input,
          projectDir,
          "PreToolUse",
          resolveProjectAttributions,
        );
      }
    } catch { /* best-effort */ }

    try {
      const redirectPath = resolve(tmpdir(), `context-mode-redirect-${sessionId}.txt`);
      let redirectData;
      try {
        redirectData = readFileSync(redirectPath, "utf-8").trim();
        unlinkSync(redirectPath);
      } catch { /* no marker */ }

      if (redirectData) {
        const i1 = redirectData.indexOf(":");
        const i2 = i1 >= 0 ? redirectData.indexOf(":", i1 + 1) : -1;
        const i3 = i2 >= 0 ? redirectData.indexOf(":", i2 + 1) : -1;
        if (i1 > 0 && i2 > i1 && i3 > i2) {
          const tool = redirectData.slice(0, i1);
          const type = redirectData.slice(i1 + 1, i2);
          const bytesRaw = redirectData.slice(i2 + 1, i3);
          const summary = redirectData.slice(i3 + 1);
          const bytesAvoided = Number.parseInt(bytesRaw, 10);
          if (Number.isFinite(bytesAvoided) && bytesAvoided > 0) {
            attributeAndInsertEvents(
              db,
              sessionId,
              [{
                type,
                category: "redirect",
                data: `${tool}: ${summary}`,
                priority: 2,
                bytes_avoided: bytesAvoided,
              }],
              input,
              projectDir,
              "PreToolUse",
              resolveProjectAttributions,
            );
          }
        }
      }
    } catch { /* best-effort */ }

    db.close();
  }
} catch {
  // Swallow errors — a hook must never fail the host agent.
}

// Capture-only hook: emit nothing.

```

### Core Architecture Module: `hooks/antigravity-cli/pretooluse.mjs`
```
#!/usr/bin/env node
import "../suppress-stderr.mjs";
/**
 * Antigravity CLI (`agy`) PreToolUse hook — bounded routing enforcement.
 *
 * agy honors top-level `{ decision: "deny" | "ask", reason }` responses for
 * PreToolUse. It does not honor additionalContext, so mapped context guidance is
 * emitted as a deny-and-retry instruction. We register only tools with existing
 * core routing branches (Bash/Read/Grep/WebFetch), not LS/search_web.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readStdin } from "../core/stdin.mjs";
import { routePreToolUse, initSecurity } from "../core/routing.mjs";
import { formatDecision } from "../core/formatters.mjs";
import { fromAgy, getAgyProjectDir, parseAgyPayload } from "./payload.mjs";
import { getSessionId, ANTIGRAVITY_CLI_OPTS } from "../session-helpers.mjs";

const __hookDir = dirname(fileURLToPath(import.meta.url));

try {
  await initSecurity(resolve(__hookDir, "..", "..", "build"));

  const payload = parseAgyPayload(await readStdin());
  const input = fromAgy(payload);

  const decision = routePreToolUse(
    String(input.tool_name ?? ""),
    input.tool_input ?? {},
    getAgyProjectDir(payload),
    "antigravity-cli",
    input.session_id,
  );
  const response = formatDecision("antigravity-cli", decision);

  if (decision && input.tool_name) {
    // Key markers on the SAME id posttooluse.mjs reads. getSessionId prefers the
    // transcript UUID over conversationId, so deriving it any other way here
    // (e.g. input.session_id) would miss the handoff whenever agy's transcript
    // is <uuid>.jsonl and silently drop the rejected/redirect analytics.
    const sessionId = getSessionId(input, ANTIGRAVITY_CLI_OPTS);
    const formattedDeny = response && typeof response === "object" && response.decision === "deny";
    if (formattedDeny || decision.action === "deny" || decision.action === "modify") {
      try {
        const reason = formattedDeny
          ? (response.reason || "denied")
          : decision.action === "deny"
            ? (decision.reason || "denied")
            : "Redirected to context-mode sandbox";
        writeFileSync(
          resolve(tmpdir(), `context-mode-rejected-${sessionId}.txt`),
          `${input.tool_name}:${reason}`,
          "utf-8",
        );
      } catch { /* best-effort */ }
    }
    if (decision.redirectMeta) {
      try {
        const meta = decision.redirectMeta;
        const summary = String(meta.commandSummary ?? "").slice(0, 200);
        writeFileSync(
          resolve(tmpdir(), `context-mode-redirect-${sessionId}.txt`),
          `${meta.tool}:${meta.type}:${meta.bytesAvoided}:${summary}`,
          "utf-8",
        );
      } catch { /* best-effort */ }
    }
  }

  if (response !== null) {
    process.stdout.write(JSON.stringify(response) + "\n");
  }
} catch {
  // Fail OPEN. Empty stdout + exit 0 lets agy continue the tool call.
}

```

### Core Architecture Module: `hooks/antigravity-cli/stop.mjs`
```
#!/usr/bin/env node
import "../suppress-stderr.mjs";
import "../ensure-deps.mjs";
/**
 * Antigravity CLI (`agy`) Stop hook — session-end capture.
 *
 * agy's verified hook list exposes `Stop` ("when agent tries to exit") and no
 * separate SessionEnd hook, so this records a single session_end marker when
 * agy emits it. `agy -p` probes have not emitted Stop, so registration is
 * best-effort. The hook is capture-only and emits no stdout.
 */

import {
  readStdin,
  getSessionId,
  getSessionDBPath,
  getInputProjectDir,
  ANTIGRAVITY_CLI_OPTS,
} from "../session-helpers.mjs";
import { createSessionLoaders } from "../session-loaders.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fromAgy, parseAgyPayload } from "./payload.mjs";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB } = createSessionLoaders(HOOK_DIR);
const OPTS = ANTIGRAVITY_CLI_OPTS;

try {
  const payload = parseAgyPayload(await readStdin());
  const input = fromAgy(payload);
  const projectDir = getInputProjectDir(input, OPTS);

  const { SessionDB } = await loadSessionDB();
  const dbPath = getSessionDBPath(OPTS, projectDir);
  const db = new SessionDB({ dbPath });
  const sessionId = getSessionId(input, OPTS);

  db.ensureSession(sessionId, projectDir);
  db.insertEvent(
    sessionId,
    {
      type: "session_end",
      category: "session",
      priority: 1,
      data: JSON.stringify({
        status: payload?.status ?? "stopped",
        stepIdx: payload?.stepIdx ?? null,
        transcriptPath: payload?.transcriptPath ?? null,
      }),
    },
    "Stop",
  );

  db.close();
} catch {
  // A hook must never fail the host agent.
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1203** (2026-09-28): **Is this project abandoned?**
  *Symptoms*: ### Platform  OpenCode  ### context-mode version  NA  ### Debug script output (REQUIRED)  ```json I do not see any commits since few months (Last release) and only automated commits. ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text opencode v2 support not being there ```  ### Full error output (REQUIRED)  ```text NA ```  ### Steps to reproduce (REQUIRED)  NA  ### What have you tried to fix it?  Pinged the maintainer on a separate thread https://github.com/mksglu/context-mode/issues/1199#issuecomment-5818717370  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  Linux (Other)  ### JS Runtime  _No response_
  **Post-Mortem & Fix Analysis**:
  > I noticed a `-next` branch with the commits pushed last month, was mistaken.. closing this.
  > @manorit2001 last commit was more than 1 month ago https://github.com/mksglu/context-mode/commits/next/  author does not reply to issues nor reviewing incoming prs. seems he lost interest in the project (or maybe life circumstances)
  > I can keep it open incase he wants to reply or has a different maintainance strategy with this being not the most priority

- **Issue #868** (2026-06-23): **[Bug]: Very intrusive message do not allow to type**
  *Symptoms*: ### Platform  Pi  ### context-mode version  1.0.165  ### Debug script output (REQUIRED)  ```json none ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text Appears doing nothing ```  ### Full error output (REQUIRED)  ```text No error ```  ### Steps to reproduce (REQUIRED)  Suddendly this message appears in the editor box and do not allow to type  [mcp-bridge] [context-mode] idle MCP bridge child self-shutdown after 180000ms with no activity (#854)  ### What have you tried to fix it?  No  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  macOS (Apple Silicon)  ### JS Runtime  _No response_
  **Post-Mortem & Fix Analysis**:
  > Same thing happened on Pi coding agent (Windows 11, WSL 2)
  > Fixed in **v1.0.166**.  Two coupled fixes:  1. **The line no longer reaches your editor.** context-mode runs in-process under Pi, and its MCP bridge was writing diagnostics to `process.stderr` — which is Pi's raw-mode TUI terminal, so the text rendered straight into the prompt box. All Pi-adapter diagnostics now route to `pi.logger` (Pi's rotating log under `~/.omp/logs/`), the documented channel for in-process extensions — never the terminal. (Your keystrokes were actually still being read underneath; it was the *display* that got corrupted — but either way it's gone now.)  2. **The helper no longer shuts down on you.** The underlying event — `idle MCP bridge child self-shutdown` — was the idle reaper releasing the **active** session's helper after 3 minutes of inactivity. That reaper exists to stop *abandoned sub-agent* helpers from piling up, but it shouldn't touch the foreground session. It now keeps the interactive session's helper alive; only sub-agent / non-interactive helpers a

- **Issue #852** (2026-06-22): **[Bug]: Agents immediatly learn and than love to use context_mode:ctx_execute* to escape from harness sandbox and premission controls.**
  *Symptoms*: ### Platform  Claude Code  ### context-mode version  1.0.162  ### Debug script output (REQUIRED)  ```json {   "version": "2.0.0",   "generated": "2026-06-21T17:23:14Z",   "sections": {     "1. System Info": {       "checks": [],       "info": {         "OS type": "linux",         "uname -a": "Linux archlinux 7.0.5-arch1-1-g14 #1 SMP PREEMPT_DYNAMIC Wed, 13 May 2026 18:07:58 +0000 x86_64 GNU/Linux",         "Architecture": "x86_64",         "Distro": "Arch Linux",         "Shell": "/usr/bin/zsh",         "Bash version": "5.3.15(1)-release",         "Locale": "LANG=en_US.UTF-8, LC_ALL=unset"       },       "configs": [],       "warnings": [],       "details": []     },     "2. Runtime Versions": {       "checks": [],       "info": {         "Node.js": "v26.2.0",         "node path": "/usr/bin/node",         "execPath": "/usr/bin/node",         "Node install method": "unknown",         "Bun": "1.3.14",         "bun path": "/usr/bin/bun",         "Python": "Python 3.14.6",         "Ruby": "ruby 3.4.8 (2025-12-17 revision 995b59f666) +PRISM [x86_64-linux]",         "npm": "11.16.0",         "npm global root": "/usr/lib/node_modules"       },       "configs": [],       "warnings": [],       "details": []     },     "3. context-mode Installation": {       "checks": [         {           "pass": false,           "label": "build/ directory exists"         },         {           "pass": true,           "label": "hooks/pretooluse.mjs exists"         },         {           "pass": true, 
  **Post-Mortem & Fix Analysis**:
  > Fixed on `next` (`d1ae5625`, ships in the next release). Thank you for the careful report and repro, @Project579.  **What's fixed — your exact repro is closed.** `ctx_execute_file` now enforces **project-boundary containment**: an absolute or `../`-escaping path outside the project root is refused (symlink-canonical escapes closed too). The opt-in escape hatch is the host's **existing `permissions.allow` `Read(...)` rules** — reused exactly as Claude Code honors them, so there's no bespoke context-mode env to learn. The `ctx_execute`/`ctx_execute_file` tool **titles now announce code execution**, which is the one field the host permission prompt surfaces (we verified against Claude Code source that the prompt already renders all MCP args — the gap was readability, and there is no host 'sandbox-active' signal we could auto-detect).  **Honest scope.** This fully closes the reported file-read vector. The broader concern you raised — `ctx_execute`/`ctx_batch_execute` running **arbitrary co

- **Issue #847** (2026-06-19): **[Bug]: Seems to be suggesting claude related recommendations when installed in pi.dev**
  *Symptoms*: ### Platform  Pi  ### context-mode version  latest  ### Debug script output (REQUIRED)  ```json bash: scripts/ctx-debug.sh: No such file or directory ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text /skill:ctx-insight ```  ### Full error output (REQUIRED)  ```text /skill:ctx-insight ```  ### Steps to reproduce (REQUIRED)  <img width="618" height="309" alt="Image" src="https://github.com/user-attachments/assets/7ff786dd-96ca-4b18-913a-0d9e085a665a" />  ### What have you tried to fix it?  reading docs  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  macOS (Apple Silicon)  ### JS Runtime  _No response_

- **Issue #824** (2026-06-21): **[Bug]: pi install hangs indefinitely — context-mode MCP server spawned but never cleaned up**
  *Symptoms*: ### Platform  OpenClaw (Pi Agent)  ### context-mode version  latest as of 2026-06-12  ### Debug script output (REQUIRED)  ```json Active handles: 6   Handle 0: Socket fd=1 (stdout)          ← normal   Handle 1: Socket fd=2 (stderr)          ← normal   Handle 2: Socket fd=26                  ← MCP bridge pipe   Handle 3: Socket fd=28                  ← MCP bridge pipe   Handle 4: Socket fd=30                  ← MCP bridge pipe   Handle 5: ChildProcess pid=126705       ← THE CULPRIT     args=["/usr/bin/node",".../context-mode/server.bundle.mjs"]     closesNeeded=3  === DETECTED: Spawning server.bundle.mjs ===   command: /usr/bin/node   args: /home/chagwood/.pi/agent/npm/node_modules/context-mode/server.bundle.mjs   argv[2]: install   isPiShortCircuitArgv would return: false  pi version: 0.79.2 OS: Linux (x86_64) Node.js: /usr/bin/node ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text pi install npm:pi-subagents ```  ### Full error output (REQUIRED)  ```text The command prints:  Installing npm:pi-subagents... ... Installed npm:pi-subagents   ...and then the terminal hangs indefinitely. Ctrl+C is required to exit.  Root cause: The Pi extension in build/adapters/pi/extension.js has a short-circuit guard (PI_SHORT_CIRCUIT_TOKENS) that skips spawning the MCP server for --help and --version, but install/uninstall/remove/update/list/config are NOT in the short-circuit set.  The MCP bridge spawns server.bundle.mjs as a child process with piped stdio:   this.child = spawn
  **Post-Mortem & Fix Analysis**:
  > I also encountered this; using your fix for now locally worked
  > Fixed on `next` by #813 (5c18c673). Root cause: the MCP-bridge bootstrap ran **eagerly during Pi extension discovery on every `pi` invocation** — including non-agent CLI subcommands (install / list / update) — so the spawned server never had an agent turn to attach to and the command hung. #813 makes the bridge bootstrap **lazy** (only on actual agent turns), so plain CLI subcommands return immediately. Shipping in the next release. Closing as resolved — please reopen if you still hit it after upgrading. Thanks for the detailed report. 🙏

- **Issue #809** (2026-06-11): **[Bug]: Pi: After installing terminal hangs when running any pi command like pi list**
  *Symptoms*: ### Platform  Pi  ### context-mode version  1.0.162  ### Debug script output (REQUIRED)  ```json bash scripts/ctx-debug.sh  Command does not exists ```  ### Exact prompt that triggered the bug (REQUIRED)  ```text pi install npm:context-mode ```  ### Full error output (REQUIRED)  ```text No ouput. Hangs. ```  ### Steps to reproduce (REQUIRED)  1.  npm install -g --ignore-scripts @earendil-works/pi-coding-agent or      bun add -g --ignore-scripts @earendil-works/pi-coding-agent  2. pi install npm:context-mode 3. pi list ( Here hangs. The only way to terminate it is with ctrl-c )  ### What have you tried to fix it?  - Yes, Installed context-mode in a fresh Pi installation and the problem persists  - When hangs is using this files:  ~/.pi/context-mode/sessions/404d1027beb84920.db ~/.pi/context-mode/sessions/404d1027beb84920.db-wal ~/.pi/context-mode/sessions/404d1027beb84920.db-shm  ### Pre-submission checklist  - [x] I have run the debug script and pasted the output above - [x] I am using the latest version of context-mode - [x] I have searched existing issues for duplicates - [x] I have included steps to reproduce the issue  ### Operating System  macOS (Apple Silicon)  ### JS Runtime  Node 26.3.0, Bun 1.3.14 and pnpm 11.5.3
  **Post-Mortem & Fix Analysis**:
  > Hitting the same issue, I opened https://github.com/mksglu/context-mode/pull/813 as a fix.

- **Issue #805** (2026-06-10): **fix(server): canonicalize cacheRoot in healCacheMidSession via realpathSync for symlinked ~/.claude (#795)**
  *Symptoms*: ## Summary  Fix `healCacheMidSession` in `server.ts` to canonicalize `cacheRoot` via `realpathSync` before the path traversal guard, so the mid-session cache heal works when `~/.claude` is a symlink to another volume.  ## Why  When `~/.claude` is a symlink (e.g. macOS users relocating to an external SSD), `path.resolve()` returns the symlink path (`/Users/me/.claude/plugins/cache`) but the plugin registry stores `installPath` as the physical target (`/Volumes/SSD/claude-code/plugins/cache/...`). The `startsWith` guard at `server.ts:808` compares these mismatched paths and rejects every entry — the heal meant to repair a broken path after an auto-update never fires for these users.  `cli.ts` already uses `realpathSync(cacheRoot)` for the same comparison in `upgrade()` and `statuslineForward()`. This fix brings `healCacheMidSession` to parity.  ## What's covered  - **Source-level regression guard**: the test reads `src/server.ts` and asserts that `realpathSync(cacheRoot)` appears inside `healCacheMidSession` and that the traversal guard uses `cacheRootCanon + sep`. This fails immediately if the fix is reverted. - **Algorithmic symmetry test**: creates a sandbox with a symlinked `dot-claude` → `real-claude-root`, then proves that the lexical comparison rejects a physical `installPath` (old buggy behavior) while the canonical comparison accepts it (fixed behavior).  ## Test plan  - [x] `npx vitest run tests/core/cli.test.ts -t "#795"` — 2 passed (GREEN) - [x] `npx vitest run test
  **Post-Mortem & Fix Analysis**:
  > Hi @ousamabenyounes ci error

- **Issue #803** (2026-06-09): **fix(runtime): add liveness guard to resolveJavascriptRuntime for Homebrew Cellar ENOENT (#800)**
  *Symptoms*: ## Summary  `resolveJavascriptRuntime()` no longer blindly returns `process.execPath` when the file no longer exists on disk. On Homebrew, `process.execPath` is a versioned Cellar path (`/opt/homebrew/Cellar/node/26.0.0/bin/node`). After `brew upgrade` + `brew cleanup`, the old Cellar is deleted, leaving the in-process execPath dangling. The `existsSync` liveness guard falls through to PATH-resolved `node` instead.  ## Why  `ctx_fetch_and_index` (and any `ctx_execute` with `language: "javascript"`) spawns its worker via the JS runtime resolved by `detectRuntimes()` → `resolveJavascriptRuntime()`. That function gates on the `JS_RUNTIMES` allowlist (basename `node`, `bun`, `deno`), and when the basename matches, returns `process.execPath` with no existence check. On Homebrew, this is the Cellar snapshot — once `brew cleanup` deletes it mid-session (or before the next MCP boot), every subsequent `ctx_fetch_and_index` call fails with `spawn ... ENOENT`.  The existing cache-heal in `hooks/cache-heal-utils.mjs` only repairs the `settings.json` hook command — it does not touch the in-process fetch-worker spawn path. This change adds the defense directly at runtime resolution time.  ## Changes  - **`src/runtime.ts`**: In `resolveJavascriptRuntime()`, after confirming the execPath basename is a known JS runtime, add an `existsSync(execPath)` check. If the file does not exist (deleted Cellar, corrupted install, uninstall while process alive), fall through to PATH-resolved `node`. - **`

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

### Incident Patch 1: `2d98ac01` (2026-09-30)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "621k+",
+  "message": "621.4k+",
   "color": "brightgreen",
   "npm": "580k+",
-  "marketplace": "41k+"
+  "marketplace": "41.4k+"
 }
```

---

### Incident Patch 2: `ab347abd` (2026-09-30)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +3/-3)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "615.8k+",
+  "message": "621k+",
   "color": "brightgreen",
-  "npm": "574.7k+",
-  "marketplace": "41.1k+"
+  "npm": "580k+",
+  "marketplace": "41k+"
 }
```

---

### Incident Patch 3: `f2eae041` (2026-09-29)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "611.9k+",
+  "message": "615.8k+",
   "color": "brightgreen",
-  "npm": "570.8k+",
+  "npm": "574.7k+",
   "marketplace": "41.1k+"
 }
```

---

### Incident Patch 4: `c6477b6f` (2026-09-28)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "609.4k+",
+  "message": "611.9k+",
   "color": "brightgreen",
-  "npm": "568.3k+",
+  "npm": "570.8k+",
   "marketplace": "41.1k+"
 }
```

---

### Incident Patch 5: `5d13dc45` (2026-09-27)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "607k+",
+  "message": "609.4k+",
   "color": "brightgreen",
-  "npm": "565.9k+",
+  "npm": "568.3k+",
   "marketplace": "41.1k+"
 }
```

---

### Incident Patch 6: `a2fda46b` (2026-09-27)
**Commit Message**: ci: update install stats

**File**: `stats.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schemaVersion": 1,
   "label": "users",
-  "message": "602.5k+",
+  "message": "607k+",
   "color": "brightgreen",
-  "npm": "561.3k+",
+  "npm": "565.9k+",
   "marketplace": "41.1k+"
 }
```

#### Recent Merged Pull Requests:
- **PR #1195** (closed): fix(ensure-deps): stop Bun from seeding an ABI-mismatched native cache (@jgbriel-io)
- **PR #1190** (closed): fix: bundle turndown so ctx_fetch_and_index works without node_modules (Windows) (@rabbitholedotdev)
- **PR #1169** (closed): fix(opencode): support OpenCode 2 plugin API (V1/V2 dual export) (@Scratchydisk)
- **PR #1133** (closed): fix: only route curl and wget in command position (@Rithb898)
- **PR #1115** (closed): feat(omp): inject routing block into task prompts (@tahsinrahman)
- **PR #1114** (closed): feat(omp): name MCP tools as bare ctx_* (@tahsinrahman)
- **PR #1110** (closed): docs(platform): add Hermes Agent (community Python plugin) to platform docs (@akrhin)
- **PR #1108** (closed): Create SKILL.md for skill library usage (@ericx057)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
