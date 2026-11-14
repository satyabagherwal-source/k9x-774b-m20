# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in oven-sh-bun-learnings

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh-bun-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T17:03:54.104Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oven-sh-bun-learnings",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh-bun-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T17:03:54.104Z`  
> **Learning ID**: `LEARN-EVO-oven-sh-bun-learnings`


## Status
**ACCEPTED** (Empirically verified from oven-sh-bun-learnings)

## Context
During deep inspection of oven-sh-bun-learnings, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source**: github ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Source Version**: `9098897a`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T17:03:05.597Z  
> **Learning ID**: `learn-github-oven-sh-bun`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): oven-sh/bun

> **Canonical Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-14T17:03:05.496Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96693 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/post-edit-format.js`
```
#!/usr/bin/env bun
import { extname } from "path";
import { spawnSync } from "child_process";

const input = await Bun.stdin.json();

const toolName = input.tool_name;
const toolInput = input.tool_input || {};
const filePath = toolInput.file_path;

// Only process Write, Edit, and MultiEdit tools
if (!["Write", "Edit", "MultiEdit"].includes(toolName)) {
  process.exit(0);
}

const ext = extname(filePath);

// Only format known files
if (!filePath) {
  process.exit(0);
}

function formatTypeScriptFile() {
  try {
    // Format only — NO organize-imports plugin. That plugin strips imports
    // it thinks are unused, which breaks split edits (add import → use it
    // in next edit). CI's `bun run prettier` runs the plugin, so imports
    // still get cleaned up before merge.
    const result = spawnSync("./node_modules/.bin/prettier", ["--config", ".prettierrc", "--write", filePath], {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      encoding: "utf-8",
    });
  } catch (error) {}
}

if (
  [
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsonc",
    ".jsx",
    ".less",
    ".mjs",
    ".pcss",
    ".postcss",
    ".sass",
    ".scss",
    ".styl",
    ".stylus",
    ".toml",
    ".ts",
    ".tsx",
    ".yaml",
  ].includes(ext)
) {
  formatTypeScriptFile();
}

process.exit(0);

```

### Core Architecture Module: `.claude/hooks/pre-bash-guard.js`
```
#!/usr/bin/env bun
import { basename, extname } from "path";

const input = await Bun.stdin.json();

const toolName = input.tool_name;
const toolInput = input.tool_input || {};
const command = toolInput.command || "";
const timeout = toolInput.timeout;
const cwd = input.cwd || "";

// Get environment variables from the hook context
// Note: We check process.env directly as env vars are inherited
let useSystemBun = process.env.USE_SYSTEM_BUN;

if (toolName !== "Bash" || !command) {
  process.exit(0);
}

function denyWithReason(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

// Parse the command to extract argv0 and positional args
let tokens;
try {
  // Simple shell parsing - split on spaces but respect quotes (both single and double)
  tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(t => t.replace(/^['"]|['"]$/g, "")) || [];
} catch {
  process.exit(0);
}

if (tokens.length === 0) {
  process.exit(0);
}

// Strip inline environment variable assignments (e.g., FOO=1 bun test)
const inlineEnv = new Map();
let commandStart = 0;
while (
  commandStart < tokens.length &&
  /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[commandStart]) &&
  !tokens[commandStart].includes("/")
) {
  const [name, value = ""] = tokens[commandStart].split("=", 2);
  inlineEnv.set(name, value);
  commandStart++;
}
if (commandStart >= tokens.length) {
  process.exit(0);
}
tokens = tokens.slice(commandStart);
useSystemBun = inlineEnv.get("USE_SYSTEM_BUN") ?? useSystemBun;

// Get the executable name (argv0)
const argv0 = basename(tokens[0], extname(tokens[0]));


// Disallow direct `rustfmt`: it doesn't read the workspace edition from
// Cargo.toml the way `cargo fmt` does, so its output can disagree with CI's
// Format job (`cargo fmt --all --check`).
if (argv0 === "rustfmt") {
  denyWithReason("error: Don't run `rustfmt` directly. Run `cargo fmt --all` — it's what CI checks.");
}

// Check if argv0 is timeout and the command is "bun bd"
if (argv0 === "timeout") {
  // Find the actual command after timeout and its arguments
  const timeoutArgEndIndex = tokens.slice(1).findIndex(t => !t.startsWith("-") && !/^\d/.test(t));
  if (timeoutArgEndIndex === -1) {
    process.exit(0);
  }

  const actualCommandIndex = timeoutArgEndIndex + 1;
  if (actualCommandIndex >= tokens.length) {
    process.exit(0);
  }

  const actualCommand = basename(tokens[actualCommandIndex]);
  const restArgs = tokens.slice(actualCommandIndex + 1);

  // Check if it's "bun bd" or "bun-debug bd" without other positional args
  if (actualCommand === "bun" || actualCommand.includes("bun-debug")) {
    // Claude is a sneaky fucker
    let positionalArgs = restArgs.filter(arg => !arg.startsWith("-"));
    const redirectStderrToStdoutIndex = positionalArgs.findIndex(arg => arg === "2>&1");
    if (redirectStderrToStdoutIndex !== -1) {
      positionalArgs.splice(redirectStderrToStdoutIndex, 1);
    }
    const redirectStdoutToStderrIndex = positionalArgs.findIndex(arg => arg === "1>&2");
    if (redirectStdoutToStderrIndex !== -1) {
      positionalArgs.splice(redirectStdoutToStderrIndex, 1);
    }

    const redirectToFileIndex = positionalArgs.findIndex(arg => arg === ">");
    if (redirectToFileIndex !== -1) {
      positionalArgs.splice(redirectToFileIndex, 2);
    }

    const redirectToFileAppendIndex = positionalArgs.findIndex(arg => arg === ">>");
    if (redirectToFileAppendIndex !== -1) {
      positionalArgs.splice(redirectToFileAppendIndex, 2);
    }

    const redirectTOFileInlineIndex = positionalArgs.findIndex(arg => arg.startsWith(">"));
    if (redirectTOFileInlineIndex !== -1) {
      positionalArgs.splice(redirectTOFileInlineIndex, 1);
    }

    const pipeIndex = positionalArgs.findIndex(arg => arg === "|");
    if (pipeIndex !== -1) {
      positionalArgs = positionalArgs.slice(0, pipeIndex);
    }

    positionalArgs = positionalArgs.map(arg => arg.trim()).filter(Boolean);

    if (positionalArgs.length === 1 && positionalArgs[0] === "bd") {
      denyWithReason("error: Run `bun bd` without a timeout");
    }
  }
}

// Check if command is "bun .* test" or "bun-debug test" with -u/--update-snapshots AND -t/--test-name-pattern
if (argv0 === "bun" || argv0.includes("bun-debug")) {
  const allArgs = tokens.slice(1);

  // Check if "test" is in positional args or "bd" followed by "test"
  const positionalArgs = allArgs.filter(arg => !arg.startsWith("-"));
  const hasTest = positionalArgs.includes("test") || (positionalArgs[0] === "bd" && positionalArgs[1] === "test");

  if (hasTest) {
    const hasUpdateSnapshots = allArgs.some(arg => arg === "-u" || arg === "--update-snapshots");
    const hasTestNamePattern = allArgs.some(arg => arg === "-t" || arg === "--test-name-pattern");

    if (hasUpdateSnapshots && hasTestNamePattern) {
      denyWithReason("error: Cannot use -u/--update-snapshots with -t/--test-name-pattern");
    }
  }
}

// Check if timeout option is set for "bun bd" command
if (timeout !== undefined && (argv0 === "bun" || argv0.includes("bun-debug"))) {
  const positionalArgs = tokens.slice(1).filter(arg => !arg.startsWith("-"));
  if (positionalArgs.length === 1 && positionalArgs[0] === "bd") {
    denyWithReason("error: Run `bun bd` without a timeout");
  }
}

// Check if running "bun test <file>" without USE_SYSTEM_BUN=1
if ((argv0 === "bun" || argv0.includes("bun-debug")) && useSystemBun !== "1") {
  const allArgs = tokens.slice(1);
  const positionalArgs = allArgs.filter(arg => !arg.startsWith("-"));

  // Check if it's "test" (not "bd test")
  if (positionalArgs.length >= 1 && positionalArgs[0] === "test" && positionalArgs[0] !== "bd") {
    denyWithReason(
      "error: In development, use `bun bd test <file>` to test your changes. If you meant to use a release version, set USE_SYSTEM_BUN=1",
    );
  }
}

// Check if running "bun bd test" from bun repo root or test folder without a file path
if (argv0 === "bun" || argv0.includes("bun-debug")) {
  const allArgs = tokens.slice(1);
  const positionalArgs = allArgs.filter(arg => !arg.startsWith("-"));

  // Check if it's "bd test"
  if (positionalArgs.length >= 2 && positionalArgs[0] === "bd" && positionalArgs[1] === "test") {
    // Check if cwd is the bun repo root or test folder
    const isBunRepoRoot = cwd === "/workspace/bun" || cwd.endsWith("/bun");
    const isTestFolder = cwd.endsWith("/bun/test");

    if (isBunRepoRoot || isTestFolder) {
      // Check if there's a file path argument (looks like a path: contains / or has test extension)
      const hasFilePath = positionalArgs
        .slice(2)
        .some(
          arg =>
            arg.includes("/") ||
            arg.endsWith(".test.ts") ||
            arg.endsWith(".test.js") ||
            arg.endsWith(".test.tsx") ||
            arg.endsWith(".test.jsx"),
        );

      if (!hasFilePath) {
        denyWithReason(
          "error: `bun bd test` from repo root or test folder will run all tests. Use `bun bd test <path>` with a specific test file.",
        );
      }
    }
  }
}

// Allow the command to proceed
process.exit(0);

```

### Core Architecture Module: `bench/copyfile/fallback-rw-loop.mjs`
```
// Cold-cache benchmark of NodeFS::copy_file_using_read_write_loop via Bun.write(file, file).
// blob/copy_file.rs routes there directly when BUN_CONFIG_DISABLE_COPY_FILE_RANGE=1; usage:
//   BUN_CONFIG_DISABLE_COPY_FILE_RANGE=1 bun bench/copyfile/fallback-rw-loop.mjs
import fs from "node:fs";
import { dlopen, FFIType } from "bun:ffi";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.platform !== "linux") {
  console.error("this bench targets the Linux read/write fallback; skipping");
  process.exit(0);
}

const libc = dlopen("libc.so.6", {
  posix_fadvise: {
    args: [FFIType.i32, FFIType.i64, FFIType.i64, FFIType.i32],
    returns: FFIType.i32,
  },
  fdatasync: { args: [FFIType.i32], returns: FFIType.i32 },
});
const POSIX_FADV_DONTNEED = 4;

function evict(path) {
  let fd;
  try {
    fd = fs.openSync(path, "r+");
  } catch {
    return;
  }
  try {
    if (libc.symbols.fdatasync(fd) !== 0 || libc.symbols.posix_fadvise(fd, 0n, 0n, POSIX_FADV_DONTNEED) !== 0) {
      throw new Error(`page-cache eviction failed for ${path}; results would be warm-cache`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

if (!process.env.BUN_CONFIG_DISABLE_COPY_FILE_RANGE) {
  console.error("note: BUN_CONFIG_DISABLE_COPY_FILE_RANGE not set; fast paths will be used");
}

for (const mb of [1, 64, 512]) {
  const src = join(tmpdir(), `cp-fallback-src-${mb}m.bin`);
  const dst = join(tmpdir(), `cp-fallback-dst-${mb}m.bin`);
  try {
    {
      const chunk = Buffer.allocUnsafe(1048576);
      for (let i = 0; i < chunk.length; i++) chunk[i] = i & 0xff;
      const fd = fs.openSync(src, "w");
      for (let i = 0; i < mb; i++) fs.writeSync(fd, chunk);
      fs.closeSync(fd);
    }

    const iters = 8;
    const times = [];
    for (let i = 0; i < iters; i++) {
      evict(src);
      evict(dst);
      fs.rmSync(dst, { force: true });
      const t0 = performance.now();
      await Bun.write(Bun.file(dst), Bun.file(src));
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    times.sort((a, b) => a - b);
    const min = times[0];
    const med = times[iters >> 1];
    console.log(
      `${mb} MiB: min=${min.toFixed(2)}ms med=${med.toFixed(2)}ms (${(mb / (min / 1000)).toFixed(0)} MiB/s peak)`,
    );
  } finally {
    fs.rmSync(src, { force: true });
    fs.rmSync(dst, { force: true });
  }
}

```

### Core Architecture Module: `bench/react-hello-world/react-hello-world.workerd.js`
```
// MessageChannel polyfill for workerd
if (typeof MessageChannel === 'undefined') {
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      this.port1 = { onmessage: null, postMessage: () => {} };
      this.port2 = {
        postMessage: (msg) => {
          if (this.port1.onmessage) {
            queueMicrotask(() => this.port1.onmessage({ data: msg }));
          }
        }
      };
    }
  };
}
var iC=Object.create;var{getPrototypeOf:tC,defineProperty:XE,getOwnPropertyNames:JC}=Object;var VC=Object.prototype.hasOwnProperty;var Dc=(f,u,c)=>{c=f!=null?iC(tC(f)):{};let y=u||!f||!f.__esModule?XE(c,"default",{value:f,enumerable:!0}):c;for(let _ of JC(f))if(!VC.call(y,_))XE(y,_,{get:()=>f[_],enumerable:!0});return y};var wx=(f,u)=>()=>(u||f((u={exports:{}}).exports,u),u.exports);var BE=(f,u)=>{for(var c in u)XE(f,c,{get:u[c],enumerable:!0,configurable:!0,set:(y)=>u[c]=()=>y})};var SC=(f,u)=>()=>(f&&(u=f(f=0)),u);var Dy=wx((_R)=>{var ZE=Symbol.for("react.transitional.element"),FC=Symbol.for("react.portal"),KC=Symbol.for("react.fragment"),kC=Symbol.for("react.strict_mode"),dC=Symbol.for("react.profiler"),lC=Symbol.for("react.consumer"),bC=Symbol.for("react.context"),pC=Symbol.for("react.forward_ref"),qC=Symbol.for("react.suspense"),oC=Symbol.for("react.memo"),Ux=Symbol.for("react.lazy"),eC=Symbol.for("react.activity"),mx=Symbol.iterator;function aC(f){if(f===null||typeof f!=="object")return null;return f=mx&&f[mx]||f["@@iterator"],typeof f==="function"?f:null}var rx={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},Lx=Object.assign,Yx={};function zc(f,u,c){this.props=f,this.context=u,this.refs=Yx,this.updater=c||rx}zc.prototype.isReactComponent={};zc.prototype.setState=function(f,u){if(typeof f!=="object"&&typeof f!=="function"&&f!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,f,u,"setState")};zc.prototype.forceUpdate=function(f){this.updater.enqueueForceUpdate(this,f,"forceUpdate")};function Nx(){}Nx.prototype=zc.prototype;function hE(f,u,c){this.props=f,this.context=u,this.refs=Yx,this.updater=c||rx}var iE=hE.prototype=new Nx;iE.constructor=hE;Lx(iE,zc.prototype);iE.isPureReactComponent=!0;var Mx=Array.isArray;function QE(){}var K={H:null,A:null,T:null,S:null},Dx=Object.prototype.hasOwnProperty;function tE(f,u,c){var y=c.ref;return{$$typeof:ZE,type:f,key:u,ref:y!==void 0?y:null,props:c}}function sC(f,u){return tE(f.type,u,f.props)}function JE(f){return typeof f==="object"&&f!==null&&f.$$typeof===ZE}function fR(f){var u={"=":"=0",":":"=2"};return"$"+f.replace(/[=:]/g,function(c){return u[c]})}var Hx=/\/+/g;function PE(f,u){return typeof f==="object"&&f!==null&&f.key!=null?fR(""+f.key):u.toString(36)}function uR(f){switch(f.status){case"fulfilled":return f.value;case"rejected":throw f.reason;default:switch(typeof f.status==="string"?f.then(QE,QE):(f.status="pending",f.then(function(u){f.status==="pending"&&(f.status="fulfilled",f.value=u)},function(u){f.status==="pending"&&(f.status="rejected",f.reason=u)})),f.status){case"fulfilled":return f.value;case"rejected":throw f.reason}}throw f}function $c(f,u,c,y,_){var E=typeof f;if(E==="undefined"||E==="boolean")f=null;var v=!1;if(f===null)v=!0;else switch(E){case"bigint":case"string":case"number":v=!0;break;case"object":switch(f.$$typeof){case ZE:case FC:v=!0;break;case Ux:return v=f._init,$c(v(f._payload),u,c,y,_)}}if(v)return _=_(f),v=y===""?"."+PE(f,0):y,Mx(_)?(c="",v!=null&&(c=v.replace(Hx,"$&/")+"/"),$c(_,u,c,"",function(g){return g})):_!=null&&(JE(_)&&(_=sC(_,c+(_.key==null||f&&f.key===_.key?"":(""+_.key).replace(Hx,"$&/")+"/")+v)),u.push(_)),1;v=0;var T=y===""?".":y+":";if(Mx(f))for(var x=0;x<f.length;x++)y=f[x],E=T+PE(y,x),v+=$c(y,u,c,E,_);else if(x=aC(f),typeof x==="function")for(f=x.call(f),x=0;!(y=f.next()).done;)y=y.value,E=T+PE(y,x++),v+=$c(y,u,c,E,_);else if(E==="object"){if(typeof f.then==="function")return $c(uR(f),u,c,y,_);throw u=String(f),Error("Objects are not valid as a React child (found: "+(u==="[object Object]"?"object with keys {"+Object.keys(f).join(", ")+"}":u)+"). If you meant to render a collection of children, use an array instead.")}return v}function g_(f,u,c){if(f==null)return f;var y=[],_=0;return $c(f,y,"","",function(E){return u.call(c,E,_++)}),y}function cR(f){if(f._status===-1){var u=f._result;u=u(),u.then(function(c){if(f._status===0||f._status===-1)f._status=1,f._result=c},function(c){if(f._status===0||f._status===-1)f._status=2,f._result=c}),f._status===-1&&(f._status=0,f._result=u)}if(f._status===1)return f._result.default;throw f._result}var Ix=typeof reportError==="function"?reportError:function(f){if(typeof window==="object"&&typeof window.ErrorEvent==="function"){var u=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof f==="object"&&f!==null&&typeof f.message==="string"?String(f.message):String(f),error:f});if(!window.dispatchEvent(u))return}else if(typeof process==="object"&&typeof process.emit==="function"){process.emit("uncaughtException",f);return}console.error(f)},yR={map:g_,forEach:function(f,u,c){g_(f,function(){u.apply(this,arguments)},c)},count:function(f){var u=0;return g_(f,function(){u++}),u},toArray:function(f){return g_(f,function(u){return u})||[]},only:function(f){if(!JE(f))throw Error("React.Children.only expected to receive a single React element child.");return f}};_R.Activity=eC;_R.Children=yR;_R.Component=zc;_R.Fragment=KC;_R.Profiler=dC;_R.PureComponent=hE;_R.StrictMode=kC;_R.Suspense=qC;_R.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=K;_R.__COMPILER_RUNTIME={__proto__:null,c:function(f){return K.H.useMemoCache(f)}};_R.cache=function(f){return function(){return f.apply(null,arguments)}};_R.cacheSignal=function(){return null};_R.cloneElement=function(f,u,c){if(f===null||f===void 0)throw Error("The argument must be a React element, but you passed "+f+".");var y=Lx({},f.props),_=f.key;if(u!=null)for(E in u.key!==void 0&&(_=""+u.key),u)!Dx.call(u,E)||E==="key"||E==="__self"||E==="__source"||E==="ref"&&u.ref===void 0||(y[E]=u[E]);var E=arguments.length-2;if(E===1)y.children=c;else if(1<E){for(var v=Array(E),T=0;T<E;T++)v[T]=arguments[T+2];y.children=v}return tE(f.type,_,y)};_R.createContext=function(f){return f={$$typeof:bC,_currentValue:f,_currentValue2:f,_threadCount:0,Provider:null,Consumer:null},f.Provider=f,f.Consumer={$$typeof:lC,_context:f},f};_R.createElement=function(f,u,c){var y,_={},E=null;if(u!=null)for(y in u.key!==void 0&&(E=""+u.key),u)Dx.call(u,y)&&y!=="key"&&y!=="__self"&&y!=="__source"&&(_[y]=u[y]);var v=arguments.length-2;if(v===1)_.children=c;else if(1<v){for(var T=Array(v),x=0;x<v;x++)T[x]=arguments[x+2];_.children=T}if(f&&f.defaultProps)for(y in v=f.defaultProps,v)_[y]===void 0&&(_[y]=v[y]);return tE(f,E,_)};_R.createRef=function(){return{current:null}};_R.forwardRef=function(f){return{$$typeof:pC,render:f}};_R.isValidElement=JE;_R.lazy=function(f){return{$$typeof:Ux,_payload:{_status:-1,_result:f},_init:cR}};_R.memo=function(f,u){return{$$typeof:oC,type:f,compare:u===void 0?null:u}};_R.startTransition=function(f){var u=K.T,c={};K.T=c;try{var y=f(),_=K.S;_!==null&&_(c,y),typeof y==="object"&&y!==null&&typeof y.then==="function"&&y.then(QE,Ix)}catch(E){Ix(E)}finally{u!==null&&c.types!==null&&(u.types=c.types),K.T=u}};_R.unstable_useCacheRefresh=function(){return K.H.useCacheRefresh()};_R.use=function(f){return K.H.use(f)};_R.useActionState=function(f,u,c){return K.H.useActionState(f,u,c)};_R.useCallback=function(f,u){return K.H.useCallback(f,u)};_R.useContext=function(f){return K.H.useContext(f)};_R.useDebugValue=function(){};_R.useDeferredValue=function(f,u){return K.H.useDeferredValue(f,u)};_R.useEffect=function(f,u){return K.H.useEffect(f,u)};_R.useEffectEvent=function(f){return K.H.useEffectEvent(f)};_R.useId=function(){return K.H.useId()};_R.useImperativeHandle=function(f,u,c){return K.H.useImperativeHandle(f,u,c)};_R.useInsertionEffect=function(f,u){return K.H.useInsertionEffect(f,u)};_R.useLayoutEffect=function(f,u){return K.H.useLayoutEffect(f,u)};_R.useMemo=function(f,u){return K.H.useMemo(f,u)};_R.useOptimistic=function(f,u){return K.H.useOptimistic(f,u)};_R.useReducer=function(f,u,c){return K.H.useReducer(f,u,c)};_R.useRef=function(f){return K.H.useRef(f)};_R.useState=function(f){return K.H.useState(f)};_R.useSyncExternalStore=function(f,u,c){return K.H.useSyncExternalStore(f,u,c)};_R.useTransition=function(){return K.H.useTransition()};_R.version="19.2.0"});var VE={};BE(VE,{version:()=>Sx,useFormStatus:()=>Vx,useFormState:()=>Jx,unstable_batchedUpdates:()=>tx,requestFormReset:()=>ix,preloadModule:()=>hx,preload:()=>Zx,preinitModule:()=>Qx,preinit:()=>Px,prefetchDNS:()=>Bx,preconnect:()=>Xx,flushSync:()=>Gx,createPortal:()=>jx,__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:()=>Wx});function zx(f){var u="https://react.dev/errors/"+f;if(1<arguments.length){u+="?args[]="+encodeURIComponent(arguments[1]);for(var c=2;c<arguments.length;c++)u+="&args[]="+encodeURIComponent(arguments[c])}return"Minified React error #"+f+"; visit "+u+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function Ku(){}function pR(f,u,c){var y=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:bR,key:y==null?null:""+y,children:f,containerInfo:u,implementation:c}}function C_(f,u){if(f==="font")return"";if(typeof u==="string")return u==="use-credentials"?u:""}var $x,zf,bR,$y,Wx,jx=function(f,u){var c=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!u||u.nodeType!==1&&u.nodeType!==9&&u.nodeType!==11)throw Error(zx(299));return pR(f,u,null,c)},Gx=function(f){var u=$y.T,c=zf.p;try{if($y.T=null,zf.p=2,f)return f()}finally{$y.T=u,zf.p=c,zf.d.f()}},Xx=function(f,u){typeof f==="string"&&(u?(u=u.crossOrigin,u=typeof u==="string"?u==="use-credentials"?u:
```

### Core Architecture Module: `bench/react-hello-world/react-hello-world.workerd.jsx`
```
// Cloudflare Workers version with export default fetch
// Run with: workerd serve react-hello-world.workerd.config.capnp

// Polyfill MessageChannel for workerd
if (typeof MessageChannel === 'undefined') {
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      this.port1 = { onmessage: null, postMessage: () => {} };
      this.port2 = {
        postMessage: (msg) => {
          if (this.port1.onmessage) {
            queueMicrotask(() => this.port1.onmessage({ data: msg }));
          }
        }
      };
    }
  };
}

import React from "react";
import { renderToReadableStream } from "react-dom/server";

const headers = {
  "Content-Type": "text/html",
};

const App = () => (
  <html>
    <body>
      <h1>Hello World</h1>
      <p>This is an example.</p>
    </body>
  </html>
);

export default {
  async fetch(request) {
    return new Response(await renderToReadableStream(<App />), { headers });
  },
};

```

### Core Architecture Module: `bench/snippets/react-dom-render.bun.js`
```
import { renderToReadableStream as renderToReadableStreamBun } from "react-dom/server";
import { renderToReadableStream } from "react-dom/server.browser";
import { bench, group, run } from "../runner.mjs";

const App = () => (
  <div>
    <h1>Hello, world!</h1>
    <p>This is a React component This is a React component This is a React component This is a React component.</p>
    <p>This is a React component This is a React component This is a React component This is a React component.</p>
    <p>This is a React component This is a React component This is a React component This is a React component.</p>
    <p>This is a React component This is a React component This is a React component This is a React component.</p>
    <p>This is a React component This is a React component This is a React component This is a React component.</p>
  </div>
);

group("new Response(stream).text()", () => {
  bench("react-dom/server.browser", async () => await new Response(await renderToReadableStream(<App />)).text());
  bench("react-dom/server.bun", async () => await new Response(await renderToReadableStreamBun(<App />)).text());
});

group("new Response(stream).arrayBuffer()", () => {
  bench(
    "react-dom/server.browser",
    async () => await new Response(await renderToReadableStream(<App />)).arrayBuffer(),
  );
  bench("react-dom/server.bun", async () => await new Response(await renderToReadableStreamBun(<App />)).arrayBuffer());
});

group("new Response(stream).bytes()", () => {
  bench("react-dom/server.browser", async () => await new Response(await renderToReadableStream(<App />)).bytes());
  bench("react-dom/server.bun", async () => await new Response(await renderToReadableStreamBun(<App />)).bytes());
});

group("new Response(stream).blob()", () => {
  bench("react-dom/server.browser", async () => await new Response(await renderToReadableStream(<App />)).blob());
  bench("react-dom/server.bun", async () => await new Response(await renderToReadableStreamBun(<App />)).blob());
});

await run();

```

### Core Architecture Module: `bench/snippets/render.js`
```
import ReactDOMServer from "react-dom/server.browser";
import decoding from "./jsx-entity-decoding";

console.log(ReactDOMServer.renderToString(decoding));

```

### Core Architecture Module: `bench/snippets/util-deprecate.mjs`
```
import { bench, run } from "../runner.mjs";
function deprecateUsingClosure(fn, msg, code) {
  if (process.noDeprecation === true) {
    return fn;
  }

  var realFn = fn;
  var wrapper = () => {
    return fnToWrap.apply(this, arguments);
  };

  var deprecater = () => {
    if (process.throwDeprecation) {
      var err = new Error(msg);
      if (code) err.code = code;
      throw err;
    } else if (process.traceDeprecation) {
      console.trace(msg);
    } else {
      console.error(msg);
    }

    fnToWrap = realFn;
    return realFn.apply(this, arguments);
  };
  var fnToWrap = deprecater;

  return wrapper;
}

function deprecateOriginal(fn, msg) {
  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }
  return deprecated;
}

const deprecatedy = deprecateUsingClosure(() => {}, "This is deprecated", "DEP0001");
const deprecatedy2 = deprecateOriginal(() => {}, "This is deprecated");

bench("deprecateUsingClosure", () => {
  deprecatedy(Math.random() + 1);
});

bench("deprecateOriginal", () => {
  deprecatedy2(Math.random() + 1);
});

await run();

```

### Core Architecture Module: `packages/bun-usockets/src/eventing/epoll_kqueue.c`
```
/*
 * Authored by Alex Hultman, 2018-2019.
 * Intellectual property of third-party.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "libusockets.h"
#include "internal/internal.h"
#include "internal/fault_inject.h"
#include <limits.h>
#include <stdlib.h>
#include <time.h>
#if defined(LIBUS_USE_EPOLL) || defined(LIBUS_USE_KQUEUE)

void Bun__internal_dispatch_ready_poll(void* loop, void* poll);
// void Bun__internal_dispatch_ready_poll(void* loop, void* poll) {}

#ifndef WIN32
/* Cannot include this one on Windows */
#include <unistd.h>
#include <stdint.h>
#include <errno.h>
#include <string.h> // memset
#include <mimalloc.h>
#endif

void us_loop_run_bun_tick(struct us_loop_t *loop, const struct timespec* timeout, uint64_t now_ns);

/* Pointer tags are used to indicate a Bun pointer versus a uSockets pointer */
#define UNSET_BITS_49_UNTIL_64 0x0000FFFFFFFFFFFF
#define CLEAR_POINTER_TAG(p) ((void *) ((uintptr_t) (p) & UNSET_BITS_49_UNTIL_64))
#define LIKELY(cond) __builtin_expect((_Bool)(cond), 1)
#define UNLIKELY(cond) __builtin_expect((_Bool)(cond), 0)

#ifdef LIBUS_USE_EPOLL
#define GET_READY_POLL(loop, index) (struct us_poll_t *) loop->ready_polls[index].data.ptr
#define SET_READY_POLL(loop, index, poll) loop->ready_polls[index].data.ptr = (void*)poll
#else
#define GET_READY_POLL(loop, index) (struct us_poll_t *) loop->ready_polls[index].udata
#if defined(__FreeBSD__)
#define SET_READY_POLL(loop, index, poll) loop->ready_polls[index].udata = (void*)poll
#else
#define SET_READY_POLL(loop, index, poll) loop->ready_polls[index].udata = (uint64_t)poll
#endif
#endif

/* Loop */
void us_loop_free(struct us_loop_t *loop) {
    us_internal_loop_data_free(loop);
    close(loop->fd);
    us_free(loop);
}

/* Poll */
struct us_poll_t *us_create_poll(struct us_loop_t *loop, int fallthrough, unsigned int ext_size) {
    if (!fallthrough) {
        loop->num_polls++;
    }
    return CLEAR_POINTER_TAG(us_xmalloc(sizeof(struct us_poll_t) + ext_size));
}

/* Todo: this one should be us_internal_poll_free */
void us_poll_free(struct us_poll_t *p, struct us_loop_t *loop) {
    loop->num_polls--;
    us_free(p);
}

/* Todo: why have us_poll_create AND us_poll_init!? libuv legacy! */
void us_poll_init(struct us_poll_t *p, LIBUS_SOCKET_DESCRIPTOR fd, int poll_type) {
    p->state.fd = fd;
    p->state.poll_type = poll_type;
}

__attribute__((always_inline)) int us_poll_events(struct us_poll_t *p) {
    return ((p->state.poll_type & POLL_TYPE_POLLING_IN) ? LIBUS_SOCKET_READABLE : 0) | ((p->state.poll_type & POLL_TYPE_POLLING_OUT) ? LIBUS_SOCKET_WRITABLE : 0);
}

__attribute__((always_inline)) LIBUS_SOCKET_DESCRIPTOR us_poll_fd(struct us_poll_t *p) {
    return p->state.fd;
}

/* Returns any of listen socket, socket, shut down socket or callback */
int us_internal_poll_type(struct us_poll_t *p) {
    return p->state.poll_type & POLL_TYPE_KIND_MASK;
}

/* Bug: doesn't really SET, rather read and change, so needs to be inited first! */
void us_internal_poll_set_type(struct us_poll_t *p, int poll_type) {
    p->state.poll_type = poll_type | (p->state.poll_type & POLL_TYPE_POLLING_MASK);
}

#if defined(LIBUS_USE_EPOLL)

#include <sys/syscall.h>
#include <signal.h>
#include <errno.h>
#include <limits.h>

static int has_epoll_pwait2 = -1;

#ifndef SYS_epoll_pwait2
// It's consistent on multiple architectures
// https://github.com/torvalds/linux/blob/9d1ddab261f3e2af7c384dc02238784ce0cf9f98/include/uapi/asm-generic/unistd.h#L795
// https://github.com/google/gvisor/blob/master/test/syscalls/linux/epoll.cc#L48C1-L50C7
#define SYS_epoll_pwait2 441
#endif

extern ssize_t sys_epoll_pwait2(int epfd, struct epoll_event* events, int maxevents,
                              const struct timespec* timeout, const sigset_t* sigmask);


static int bun_epoll_pwait2(int epfd, struct epoll_event *events, int maxevents, const struct timespec *timeout) {
    int ret;
    sigset_t mask;
    sigemptyset(&mask);

    /* For a finite non-zero timeout, track an absolute monotonic deadline so
     * EINTR retries wait for the remaining time (signal(7): epoll_*wait is
     * never restarted by SA_RESTART). NULL and {0,0} are idempotent on retry. */
    uint64_t deadline_ns = 0;
    const int has_deadline = timeout && (timeout->tv_sec | timeout->tv_nsec);
    if (has_deadline) {
        deadline_ns = us_internal_monotonic_ns()
                    + (uint64_t) timeout->tv_sec * 1000000000ULL
                    + (uint64_t) timeout->tv_nsec;
    }

    if (has_epoll_pwait2 != 0) {
        struct timespec remaining_ts;
        const struct timespec *remaining = timeout;
        for (;;) {
            ret = sys_epoll_pwait2(epfd, events, maxevents, remaining, &mask);
            if (LIKELY(ret != -EINTR)) break;
            if (!has_deadline) continue;
            uint64_t now = us_internal_monotonic_ns();
            if (now >= deadline_ns) return 0;
            uint64_t left = deadline_ns - now;
            remaining_ts.tv_sec  = (time_t) (left / 1000000000ULL);
            remaining_ts.tv_nsec = (long)   (left % 1000000000ULL);
            remaining = &remaining_ts;
        }

        if (LIKELY(ret != -ENOSYS && ret != -EPERM && ret != -EOPNOTSUPP && ret != -EACCES && ret != -EFAULT)) {
            return ret;
        }

        has_epoll_pwait2 = 0;
    }

    /* epoll_pwait(2) takes an int millisecond timeout; epoll_pwait2(2) takes a
     * timespec (since Linux 5.11). Round the ns remainder UP so a sub-ms delta
     * waits 1 ms instead of truncating to 0 and busy-spinning. */
    int timeoutMs;
    if (!timeout) {
        timeoutMs = -1;
    } else {
        uint64_t ns = (uint64_t) timeout->tv_sec * 1000000000ULL + (uint64_t) timeout->tv_nsec;
        uint64_t ms = (ns + 999999ULL) / 1000000ULL;
        timeoutMs = ms > (uint64_t) INT_MAX ? INT_MAX : (int) ms;
    }

    for (;;) {
        ret = epoll_pwait(epfd, events, maxevents, timeoutMs, &mask);
        if (!IS_EINTR(ret)) break;
        if (!has_deadline) continue;
        uint64_t now = us_internal_monotonic_ns();
        if (now >= deadline_ns) return 0;
        uint64_t left_ns = deadline_ns - now;
        uint64_t left_ms = (left_ns + 999999ULL) / 1000000ULL;
        timeoutMs = left_ms > (uint64_t) INT_MAX ? INT_MAX : (int) left_ms;
    }

    return ret;
}

extern int Bun__isEpollPwait2SupportedOnLinuxKernel();

#else

/* kevent(2) returns EINTR when a signal is caught (XNU kqueue_scan returns
 * EINTR on THREAD_INTERRUPTED; FreeBSD kqueue_scan maps ERESTART->EINTR), so
 * retry with the remaining time against an absolute monotonic deadline. */
static int bun_kevent64_wait(int kqfd, struct kevent64_s *eventlist, int nevents, unsigned int flags, const struct timespec *timeout) {
    int ret;
    uint64_t deadline_ns = 0;
    const int has_deadline = timeout && (timeout->tv_sec | timeout->tv_nsec);
    if (has_deadline) {
        deadline_ns = us_internal_monotonic_ns()
                    + (uint64_t) timeout->tv_sec * 1000000000ULL
                    + (uint64_t) timeout->tv_nsec;
    }

    struct timespec remaining_ts;
    const struct timespec *remaining = timeout;
    for (;;) {
        ret = kevent64(kqfd, NULL, 0, eventlist, nevents, flags, remaining);
        if (!IS_EINTR(ret)) return ret;
        if (!has_deadline) continue;
        uint64_t now = us_internal_monotonic_ns();
        if (now >= deadline_ns) return 0;
        uint64_t left = deadline_ns - now;
        remaining_ts.tv_sec  = (time_t) (left / 1000000000ULL);
        remaining_ts.tv_nsec = (long)   (left % 1000000000ULL);
        remaining = &remaining_ts;
    }
}

#endif

/* Loop */
struct us_loop_t *us_create_loop(void *hint, void (*wakeup_cb)(struct us_loop_t *loop), void (*pre_cb)(struct us_loop_t *loop), void (*post_cb)(struct us_loop_t *loop), unsigned int ext_size) {
    struct us_loop_t *loop = (struct us_loop_t *) us_xcalloc(1, sizeof(struct us_loop_t) + ext_size);
    loop->num_polls = 0;
    /* These could be accessed if we close a poll before starting the loop */
    loop->num_ready_polls = 0;
    loop->current_ready_poll = 0;

    loop->bun_polls = 0;

#ifdef LIBUS_USE_EPOLL
    loop->fd = epoll_create1(EPOLL_CLOEXEC);

    if (has_epoll_pwait2 == -1) {
        if (Bun__isEpollPwait2SupportedOnLinuxKernel() == 0) {
            has_epoll_pwait2 = 0;
        }
    }

#else
    loop->fd = kqueue();
#endif
    /* EMFILE/ENFILE: the caller decides whether this is fatal. */
    if (loop->fd == -1) {
        us_free(loop);
        return NULL;
    }

    if (us_internal_loop_data_init(loop, wakeup_cb, pre_cb, post_cb) != 0) {
        close(loop->fd);
        us_free(loop);
        return NULL;
    }
    return loop;
}

/* Shared dispatch loop for both us_loop_run and us_loop_run_bun_tick */
static void us_internal_dispatch_ready_polls(struct us_loop_t *loop) {
#ifdef LIBUS_USE_EPOLL
    for (loop->current_ready_poll = 0; loop->current_ready_poll < loop->num_ready_polls; loop->current_ready_poll++) {
        struct us_poll_t *poll = GET_READY_POLL(loop, loop->current_ready_poll);
        if (LIKELY(poll)) {
            if (CLEAR_POINTER_TAG(poll) != poll) {
                Bun__internal_dispatch_ready_poll(loop, poll);
                continue;
            }
            int events = loop->ready_polls[loop->current_ready_poll].events;
            /* Normalize to 0/1 like the kqueue path's EV_ERROR: the value is
             * forwarded as a libus close code, and a raw EPOLLERR (8) would
             * read as err
```

### Core Architecture Module: `packages/bun-usockets/src/internal/eventing/epoll_kqueue.h`
```
/*
 * Authored by Alex Hultman, 2018-2019.
 * Intellectual property of third-party.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef EPOLL_KQUEUE_H
#define EPOLL_KQUEUE_H

#include "internal/loop_data.h"

#ifdef LIBUS_USE_EPOLL
#include <sys/epoll.h>
#include <sys/eventfd.h>
#define LIBUS_SOCKET_READABLE EPOLLIN
#define LIBUS_SOCKET_WRITABLE EPOLLOUT
#else
#include <sys/event.h>
/* Kqueue's EVFILT_ is NOT a bitfield, you cannot OR together them.
 * We therefore have our own bitfield we then translate in every call */
#define LIBUS_SOCKET_READABLE 1
#define LIBUS_SOCKET_WRITABLE 2

#if defined(__APPLE__)
#include <mach/mach.h>
#elif defined(__FreeBSD__)
/* FreeBSD has plain kevent(2) only — no kevent64. Shim the Darwin names so
 * the kqueue path in epoll_kqueue.c stays a single body. udata is void* on
 * FreeBSD (vs uint64_t on Darwin), and ext[2] doesn't exist (the trailing
 * macro args are dropped). */
#include <stdint.h>
#include <time.h>
#define kevent64_s kevent
#define EV_SET64(kevp, a, b, c, d, e, f, g, h) \
    EV_SET((kevp), (a), (b), (c), (d), (e), ((void *)(uintptr_t)(f)))
/* Darwin-only kevent64 flags. Kept as bits so callers OR them as before;
 * the inline shim below translates each. */
#ifndef KEVENT_FLAG_ERROR_EVENTS
#define KEVENT_FLAG_ERROR_EVENTS 0x1u
#endif
#ifndef KEVENT_FLAG_IMMEDIATE
#define KEVENT_FLAG_IMMEDIATE 0x2u
#endif
static inline int kevent64(int kq, const struct kevent64_s *changelist, int nchanges,
                           struct kevent64_s *eventlist, int nevents, unsigned int flags,
                           const struct timespec *timeout) {
    /* KEVENT_FLAG_ERROR_EVENTS: Darwin restricts the eventlist to per-change
     * errors. FreeBSD's kevent has no equivalent and would otherwise pop and
     * lose unrelated ready events here. Registration paths only need syscall
     * success, so suppress eventlist harvesting entirely. */
    if (flags & KEVENT_FLAG_ERROR_EVENTS) {
        eventlist = NULL;
        nevents = 0;
    }
    /* KEVENT_FLAG_IMMEDIATE: Darwin's non-blocking poll. On FreeBSD that's
     * a zero timespec. Some callers pass the flag with timeout=NULL (which
     * would block forever here). */
    static const struct timespec zero_ts = {0, 0};
    if ((flags & KEVENT_FLAG_IMMEDIATE) && timeout == NULL) {
        timeout = &zero_ts;
    }
    return kevent(kq, (const struct kevent *)changelist, nchanges,
                  (struct kevent *)eventlist, nevents, timeout);
}
#endif
#endif

struct us_loop_t {
    alignas(LIBUS_EXT_ALIGNMENT) struct us_internal_loop_data_t data;

    /* Number of non-fallthrough polls in the loop */
    int num_polls;

    /* Number of ready polls this iteration */
    int num_ready_polls;

    /* Current index in list of ready polls */
    int current_ready_poll;

    /* Loop's own file descriptor */
    int fd;

    /* Number of polls owned by bun */
    unsigned int bun_polls;

    /* Incremented atomically by wakeup(), swapped to 0 before epoll/kqueue.
     * If non-zero, the event loop will return immediately so we can skip the GC safepoint. */
    unsigned int pending_wakeups;

    /* The list of ready polls */
#ifdef LIBUS_USE_EPOLL
    alignas(LIBUS_EXT_ALIGNMENT) struct epoll_event ready_polls[1024];
#else
    alignas(LIBUS_EXT_ALIGNMENT) struct kevent64_s ready_polls[1024];
#endif
};

struct us_poll_t {
    alignas(LIBUS_EXT_ALIGNMENT) struct {
        signed int fd : 27; // we could have this unsigned if we wanted to, -1 should never be used
        unsigned int poll_type : 5;
    } state;
};

#endif // EPOLL_KQUEUE_H

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #48765** (2026-11-12): **error: Unexpected token: /**
  *Symptoms*: ### What version of Bun is running?  1.4.4+38afee6c8  ### What platform is your computer?  macos  ### What steps can reproduce the bug?  ``` echo "@supports (content:counter(line) / '') {}" > /tmp/bun-css-test.css bun build /tmp/bun-css-test.css --outdir /tmp/bun-css-test ```  ### What is the expected behavior?  _No response_  ### What do you see instead?  _No response_  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > This is fixed on `main` by #47025 (commit 7942008688a, merged 2026-10-27). The fix is not in a release yet. Bun 1.4.4 (tag `bun-v1.4.4` = 38afee6c8, the version in the report) is from before that commit.  **Root cause:** `Parser::expect_no_error_token` in `src/css/css_parser.rs` returned right after it scanned a nested block (a function or a parenthesis group). Any token after the nested block in an `@supports` declaration condition then failed the "input is exhausted" check. `counter(line)` is the nested block here, and `/` is the token after it. The same failure hit `@supports (transform: translate(1px) rotate(1deg))` and `@import ... supports(...)`. #47025 removed that early return and added tests for it (`test/js/bun/css/css.test.ts`, "Tokens after a nested block"). See also #38552.  **Bun version:** `1.4.3` (release) and `1.4.4-debug` (main, 8aa496e1df5) on `linux x64`  **Attempt 1:** The report's steps on the released Bun 1.4.3 (same code path as 1.4.4). ```console $ echo "@suppo

- **Issue #48450** (2026-11-10): **AOT regression since 1.4.4-canary.20261108.1: build plugin modules are added as entry points**
  *Symptoms*: ### What version of Bun is running?  1.4.4-canary.1+98cda0d8b  ### What platform is your computer?  Darwin 25.6.0 x86_64 i386  ### What steps can reproduce the bug?  This is a canary regression. The same project and the same source build on one canary and fail on the next. A standalone, framework-free reproduction repository is public: [TiBianMod/bun-aot-build-plugin-entry-point](https://github.com/TiBianMod/bun-aot-build-plugin-entry-point).  ```sh git clone https://github.com/TiBianMod/bun-aot-build-plugin-entry-point.git cd bun-aot-build-plugin-entry-point ./repro.sh ```  **1. Canary bisect**  | canary                    | revision                   | result         | | ------------------------- | -------------------------- | -------------- | | `1.4.4-canary.20261107.1` | `1.4.4-canary.1+7ca0042d3` | build succeeds | | `1.4.4-canary.20261108.1` | `1.4.4-canary.1+2596ac5`   | build fails    |  ```sh npx -y bun@1.4.4-canary.20261107.1 build.ts   # succeeds npx -y bun@1.4.4-canary.20261108.1 build.ts   # fails ```  Only one commit is between them: **#47942 — “AOT: the Bun side of the rewritten ahead-of-time compiler”**.  **2. Reproduction files**  A single entry point is passed to `Bun.build`. It loads a build plugin module through a helper that takes the module path as a parameter and calls `import(entry)`:  ```ts // entry.tsx import { load } from "./loader.js";  export const pluginFactory = load("./plugins/tsx.ts"); ```  ```ts // loader.ts export async function load(entry: 

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

### Incident Patch 1: `4cf6d10b` (2026-11-14)
**Commit Message**: event loop: give the uws loop its lifetime and share the mini loop (#48885)

### What does this PR do?

Gives the event loops under the VM the lifetime and the sharing they
really have. Three commits, 55 `unsafe` blocks and 2 `unsafe impl`
fewer.

**The uws loop.** `Loop::get()` returned a raw pointer to a loop that
lives as long as its thread runs, and every user dereferenced it again.
It returns `&'static ThreadLoop`, and what keeps the loop (socket
groups, UDP, QUIC, timers) asks for `'static`. `ThreadLoop` has the two
methods that need uWS's `LoopData`, so they cannot be called on the loop
of `spawnSync`.

**The mini loop.** What a tick runs reaches the loop again and other
threads post to it, yet `tick*` took `&mut self`. `MiniEventLoop` and
`AnyEventLoop` take `&self`. Bundler and install workers no longer form
a `&mut` to post or to wake. `AnyEventLoop::tick` is one turn, and
`sleep_until` lends the manager to its callback instead of passing a raw
pointer through a trampoline.

- **Became `unsafe`**, because they end a `'static` loop early:
`free_thread_loop`, `close_thread_loop` and `SpawnSyncEventLoop::init`.
Three other `unsafe fn` are gone.
- **Still raw**: the libuv loo

**File**: `Cargo.lock` (modified, +0/-1)
```diff
@@ -643,7 +643,6 @@ dependencies = [
  "bun_dispatch",
  "bun_dotenv",
  "bun_io",
- "bun_paths",
  "bun_ptr",
  "bun_sys",
  "bun_threading",
```

**File**: `src/bundler/DeferredBatchTask.rs` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ impl DeferredBatchTask {
         }
         let this: *mut Self = self;
         let bv2 = self.get_bundle_v2();
-        match bv2.any_loop_mut() {
+        match bv2.any_loop() {
             // bake: the plugins run on the loop that runs the bundle; already there.
             bun_event_loop::AnyEventLoop::Js { .. } => bv2.decrement_scan_counter(),
             bun_event_loop::AnyEventLoop::Mini(mini) => {
```

**File**: `src/bundler/LinkerContext.rs` (modified, +4/-18)
```diff
@@ -258,25 +258,11 @@ impl<'a> LinkerContext<'a> {
             .get()
     }
 
-    /// Mutable projection of the `r#loop` BACKREF for `AnyEventLoop` dispatch
-    /// (`enqueue_task_concurrent*`, `tick`). Centralises the raw `NonNull`
-    /// deref so the three callers (`BundleV2::any_loop_mut`, `ParseTask` /
-    /// `ServerComponentParseTask` completion) are safe.
-    ///
-    /// `&self` receiver (not `&mut self`): the loop storage is **disjoint**
-    /// from `LinkerContext` (it lives in the `BundleThread` / runtime arena —
-    /// see [`EventLoop`]), and worker-thread completions reach this through a
-    /// `BackRef<BundleV2>` (`&` only).
+    /// The loop that runs this bundle pass. Other threads only post to it.
     #[inline]
-    #[allow(clippy::mut_from_ref)]
-    pub(crate) fn any_loop_mut(&self) -> Option<&mut bun_event_loop::AnyEventLoop> {
-        // SAFETY: BACKREF — set once in `BundleV2::init` from a loop that
-        // outlives the bundle pass; the pointee is disjoint from `*self`.
-        // Exclusivity: `Js { owner }.enqueue_task_concurrent` is `&self`
-        // (MPSC), and `Mini.enqueue_task_concurrent_with_extra_ctx` only
-        // pushes to an MPSC queue + writes the caller-owned intrusive task
-        // node, so concurrent worker completions do not alias loop state.
-        self.r#loop.map(|p| unsafe { &mut *p.as_ptr() })
+    pub(crate) fn any_loop(&self) -> Option<&bun_event_loop::AnyEventLoop> {
+        // SAFETY: BACKREF — set once in `BundleV2::init` from a loop that outlives the bundle pass.
+        self.r#loop.map(|p| unsafe { p.as_ref() })
     }
 
     /// Shared-read accessor for the bundler log.
```

**File**: `src/bundler/ParseTask.rs` (modified, +2/-2)
```diff
@@ -2876,7 +2876,7 @@ pub mod parse_worker {
         drop(core::mem::take(&mut this.jsx));
 
         // `worker.ctx` is a `BackRef<BundleV2>` (safe `Deref`); the BACKREF deref
-        // of `linker.r#loop` is centralised in `LinkerContext::any_loop_mut`.
+        // of `linker.r#loop` is centralised in `LinkerContext::any_loop`.
         //
         // The loop is effectively non-optional — `BundleV2::init`
         // always sets `linker.r#loop` before scheduling any ParseTask. Running
@@ -2886,7 +2886,7 @@ pub mod parse_worker {
         match worker
             .ctx
             .linker
-            .any_loop_mut()
+            .any_loop()
             .expect("BundleV2.linker.loop must be set before scheduling ParseTask")
         {
             bun_event_loop::AnyEventLoop::Js { .. } => {
```

**File**: `src/bundler/ServerComponentParseTask.rs` (modified, +2/-2)
```diff
@@ -105,7 +105,7 @@ fn task_callback_wrap(thread_pool_task: *mut ThreadPoolTask) {
     let result = bun_core::heap::into_raw(result);
 
     // `worker.ctx` is a `BackRef<BundleV2>` (safe `Deref`); the BACKREF deref
-    // of `linker.r#loop` is centralised in `LinkerContext::any_loop_mut`.
+    // of `linker.r#loop` is centralised in `LinkerContext::any_loop`.
     //
     // The loop is effectively non-optional — `BundleV2::init`
     // always sets `linker.r#loop` before scheduling any ServerComponentParseTask.
@@ -115,7 +115,7 @@ fn task_callback_wrap(thread_pool_task: *mut ThreadPoolTask) {
     match worker
         .ctx
         .linker
-        .any_loop_mut()
+        .any_loop()
         .expect("BundleV2.linker.loop must be set before scheduling ServerComponentParseTask")
     {
         bun_event_loop::AnyEventLoop::Js { .. } => {
```

**File**: `src/bundler/aot/page_bundles.rs` (modified, +2/-2)
```diff
@@ -53,15 +53,15 @@ fn create_page_outputs(
         let mut page_log = Log::init();
         let transpiler = create_page_transpiler(context, heap, &raw mut page_log);
         let transpiler_pointer: *mut Transpiler<'_> = transpiler;
-        let mut any_loop = AnyEventLoop::default();
+        let any_loop = AnyEventLoop::default();
         let carrier = context.bundle();
 
         let result = BundleV2::init(
             // SAFETY: `transpiler_pointer` is the unique slot `heap.alloc` returned, and it lives in `heap`.
             unsafe { &mut *transpiler_pointer },
             None,
             heap,
-            Some(NonNull::from(&mut any_loop)),
+            Some(NonNull::from(&any_loop)),
             false,
             NonNull::new(carrier.graph.pool().worker_pool),
             heap,
```

**File**: `src/bundler/aot/services.rs` (modified, +2/-2)
```diff
@@ -193,7 +193,7 @@ pub(crate) fn with_test_context<R>(
     static OUTPUT: std::sync::Once = std::sync::Once::new();
     OUTPUT.call_once(bun_core::output::stdio::init);
     let mut log = Log::init();
-    let mut event_loop = bun_event_loop::AnyEventLoop::default();
+    let event_loop = bun_event_loop::AnyEventLoop::default();
     let arena = Arena::new();
     let transform_options = crate::options::TransformOptions {
         absolute_working_dir: Some(Box::from(&b"/project"[..])),
@@ -209,7 +209,7 @@ pub(crate) fn with_test_context<R>(
         transpiler,
         None,
         &arena,
-        Some(NonNull::from(&mut event_loop)),
+        Some(NonNull::from(&event_loop)),
         false,
         None,
         &arena,
```

**File**: `src/bundler/aot/testing.rs` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@ pub fn with_front_end_inputs<R>(
 ) -> Option<R> {
     // A build fills the loader it is handed, so each has its own, as in `Bun.build`.
     let mut environment = Loader::init();
-    let mut event_loop = bun_event_loop::AnyEventLoop::default();
+    let event_loop = bun_event_loop::AnyEventLoop::default();
     let arena = Arena::new();
     let transform_options = crate::options::TransformOptions {
         absolute_working_dir: Some(Box::from(inputs.working_directory)),
@@ -93,7 +93,7 @@ pub fn with_front_end_inputs<R>(
         .opts
         .root_dir
         .clone_from(&transpiler.options.root_dir);
-    let event_loop = Some(NonNull::from(&mut event_loop));
+    let event_loop = Some(NonNull::from(&event_loop));
     let started = BundleV2::init_without_starting_threads(
         transpiler, None, &arena, event_loop, false, None, &arena,
     );
```

---

### Incident Patch 2: `e67258f3` (2026-11-13)
**Commit Message**: css: give the AST the lifetime of its arena (#48819)

### What does this PR do?

The CSS AST stored arena and source slices as `*const [u8]` or `&'static
[u8]`, and most callers cast their arena to `'static`. It now carries
the lifetime of the arena, from `Parser` up to `StyleSheet` and the
bundler's chunk types, so the borrow checker proves in `src/css` what
the `SAFETY` comments claimed. The bundler's worker tasks still fill
that lifetime in with `'static` (`ParseTask`, `Worker::arena`), and
`shared_block_edges` is one more user of that accessor.

Removes 62 `unsafe` blocks, 3 `unsafe fn` and 2 `unsafe impl`. Three
blocks are left in `src/css` (the `Log` pointer in `ParserOptions`).
Most of the diff is `<'bump>`. By commit:

1. **Dead code**: `dependencies.rs` and `Url.loc`
(`analyze_dependencies` is never set),
`CssModule.{exports_by_source_index, references}`,
`ErrorLocation.filename` and the fields that fed it, three
`MinifyErrorKind` variants.
2. **Arena lifetime**: deletes `arena_str`, `src_str`, `arena_static`,
`bump_static`, `decl_*_static`, `BasicParseError`, `HTMLImportManifest`,
`EscapedJson`. `IdentOrRef` is an enum, not a pointer packed in a
`u128`.
3. **Import record

**File**: `Cargo.lock` (modified, +0/-2)
```diff
@@ -558,7 +558,6 @@ dependencies = [
  "bun_css_derive",
  "bun_io",
  "bun_paths",
- "bun_ptr",
  "bun_wyhash",
  "strum",
  "thiserror",
@@ -583,7 +582,6 @@ dependencies = [
  "bun_core",
  "bun_css",
  "bun_jsc",
- "bun_ptr",
 ]
 
 [[package]]
```

**File**: `src/ast/lib.rs` (modified, +1/-8)
```diff
@@ -200,18 +200,11 @@ impl Ref {
     /// Represents a null state without using an extra bit.
     pub const NONE: Ref = Ref(0); // tag=Invalid, inner=0, src=0
 
-    /// Raw 64-bit representation **including** user bits. For round-tripping
-    /// through external pointer-packed storage (e.g. css `IdentOrRef`). Differs
-    /// from [`Self::as_u64`], which masks user bits for hashing/equality.
+    /// Raw 64-bit representation **including** user bits, which [`Self::as_u64`] masks.
     #[inline]
     pub const fn to_raw_bits(self) -> u64 {
         self.0
     }
-    /// Reconstruct from a value previously returned by [`Self::to_raw_bits`].
-    #[inline]
-    pub const fn from_raw_bits(bits: u64) -> Ref {
-        Ref(bits)
-    }
 
     /// General constructor exposing all three packed fields. Prefer `init` for
     /// the common source-contents/allocated-name case; this exists for callers
```

**File**: `src/bun_alloc/stack_fallback.rs` (modified, +16/-47)
```diff
@@ -1,64 +1,33 @@
-// ── ArenaPtr ─────────────────────────────────────────────────────────────
-//
-// `*const MimallocArena` as an [`Allocator`]. Exists so callers can borrow a
-// caller-owned `MimallocArena` without a lifetime parameter:
-// `ASTMemoryAllocator` is published into raw thread-locals and may outlive any
-// nameable `'a`, so `&'a MimallocArena` (which already implements `Allocator`)
-// cannot be used directly. The caller guarantees the pointee outlives every
-// allocation — same invariant the `ast_alloc` install/uninstall protocol
-// already requires.
-//
-// `arena == null` routes to global `mi_malloc`/`mi_free`, matching
-// [`crate::ast_alloc::AstAlloc`] when no AST scope is active.
-
 use core::alloc::{AllocError, Allocator, Layout};
-use core::ptr::{self, NonNull};
+use core::ptr::NonNull;
 
 use crate::{MimallocArena, alloc_result, mimalloc};
 
-/// Borrowed `*const MimallocArena` as an [`Allocator`]. See section doc above.
+/// A borrowed arena, or the global heap, as an [`Allocator`].
 #[derive(Clone, Copy)]
-pub struct ArenaPtr {
-    arena: *const MimallocArena,
+pub struct ArenaPtr<'a> {
+    arena: Option<&'a MimallocArena>,
 }
 
-impl ArenaPtr {
-    /// Wrap a live `MimallocArena`. The caller guarantees `arena` is not moved,
-    /// `reset()`, or dropped while any allocation made through this ref is
-    /// live.
+impl<'a> ArenaPtr<'a> {
     #[inline]
-    pub const fn new(arena: *const MimallocArena) -> Self {
-        Self { arena }
+    pub const fn new(arena: &'a MimallocArena) -> Self {
+        Self { arena: Some(arena) }
     }
-    /// Null arena → process-global `mi_malloc`/`mi_free`.
+    /// Process-global `mi_malloc`/`mi_free`.
     #[inline]
     pub const fn global() -> Self {
-        Self { arena: ptr::null() }
-    }
-    /// Shared borrow of the wrapped arena, or `None` for the global path.
-    ///
-    /// Single backref-deref site for the `arena: *const MimallocArena` field;
-    /// the [`Allocator`] impl below branches on the result instead of
-    /// open-coding the null-check + raw-pointer deref at every method.
-    #[inline]
-    fn arena_ref(&self) -> Option<&MimallocArena> {
-        // SAFETY: `arena` is either null (→ `None`) or, per [`ArenaPtr::new`]'s
-        // contract, a live `MimallocArena` that is not moved/reset/dropped
-        // while any allocation made through this ref is live — i.e. it
-        // outlives `&self`. Backref invariant: pointee outlives holder.
-        unsafe { self.arena.as_ref() }
+        Self { arena: None }
     }
 }
 
-// SAFETY: when `arena` is non-null this forwards to `&MimallocArena: Allocator`
-// (whose contract is documented on that impl); when null it is the global
-// mimalloc path (`mi_malloc`/`mi_free`/`mi_realloc_aligned`), identical to
-// `BunAllocator` / `AstAlloc`'s null branch. The caller upholds the
-// non-dangling invariant on `arena` (see [`ArenaPtr::new`]).
-unsafe impl Allocator for ArenaPtr {
+// SAFETY: `Some` forwards to `&MimallocArena: Allocator` (whose contract is
+// documented on that impl); `None` is the global mimalloc path
+// (`mi_malloc`/`mi_free`/`mi_realloc_aligned`).
+unsafe impl Allocator for ArenaPtr<'_> {
     #[inline]
     fn allocate(&self, layout: Layout) -> Result<NonNull<[u8]>, AllocError> {
-        match self.arena_ref() {
+        match self.arena {
             Some(a) => a.allocate(layout),
             None => {
                 let p = mimalloc::mi_malloc_auto_align(layout.size(), layout.align());
@@ -75,7 +44,7 @@ unsafe impl Allocator for ArenaPtr {
         // so the `Some` arm is correct even if `ptr` was allocated under a
         // different arena and later grown here.
         unsafe {
-            match self.arena_ref() {
+            match self.arena {
                 Some(a) => a.deallocate(ptr, layout),
                 None => mimalloc::mi_free(ptr.as_ptr().cast()),
             }
@@ -92,7 +61,7 @@ unsafe impl Allocator for ArenaPtr {
         // SAFETY: `ptr` is a live mimalloc block returned by this allocator
         // (caller contract); both arms forward it to the matching realloc.
         unsafe {
-            match self.arena_ref() {
+            match self.arena {
                 Some(a) => a.grow(ptr, old, new),
                 None => alloc_result(
                     mimalloc::mi_realloc_aligned(ptr.as_ptr().cast(), new.size(), new.align()),
```

**File**: `src/bundler/Chunk.rs` (modified, +22/-33)
```diff
@@ -778,15 +778,12 @@ impl IntermediateOutput {
                                 }
 
                                 QueryKind::HtmlImport => {
-                                    count += bun_core::fmt::count(format_args!(
-                                        "{}",
-                                        HTMLImportManifest::format_escaped_json(
-                                            piece.query.index(),
-                                            graph,
-                                            chunks,
-                                            linker_graph,
-                                        )
-                                    ));
+                                    count += HTMLImportManifest::count_escaped_json(
+                                        piece.query.index(),
+                                        graph,
+                                        linker_graph,
+                                        chunks,
+                                    );
                                     continue;
                                 }
                                 QueryKind::None | QueryKind::ChunkId => unreachable!(),
@@ -1345,7 +1342,7 @@ pub struct CssChunk<'a> {
     ///
     /// When we go through the `prepareCssAstsForChunk()` step, each import will
     /// create a shallow copy of the file's AST (just dereferencing the pointer).
-    pub(crate) asts: Box<[bun_css::BundlerStyleSheet]>,
+    pub(crate) asts: Box<[bun_css::BundlerStyleSheet<'a>]>,
 }
 
 impl Drop for CssChunk<'_> {
@@ -1361,7 +1358,7 @@ impl Drop for CssChunk<'_> {
 }
 
 pub struct CssImportOrder<'a> {
-    pub(crate) conditions: Vec<bun_css::ImportConditions>,
+    pub(crate) conditions: Vec<bun_css::ImportConditions<'a>>,
     pub(crate) condition_import_records: Vec<ImportRecord<'a>>,
 
     pub(crate) kind: CssImportOrderKind<'a>,
@@ -1388,7 +1385,7 @@ pub enum CssImportOrderKind<'a> {
     /// BUT, the imports may include layers.
     /// We'll just print layer name declarations so that the original ordering is preserved.
     #[strum(serialize = "layers")]
-    Layers(Layers),
+    Layers(Layers<'a>),
     #[strum(serialize = "external_path")]
     ExternalPath(bun_fs::Path<'a>),
     #[strum(serialize = "source_index")]
@@ -1400,15 +1397,15 @@ pub enum CssImportOrderKind<'a> {
 // is a hand-rolled Cow: a tag + raw pointer for the borrowed
 // arm. LayerName payload allocations live in the arena, so dropping the owned
 // arm is a shallow free and `to_owned` deep-clones element-wise.
-pub enum Layers {
+pub enum Layers<'a> {
     /// Borrowed from another `CssImportOrder`'s `Layers` or the parsed stylesheet.
-    Borrowed(bun_ptr::BackRef<Vec<bun_css::LayerName>>),
-    Owned(Vec<bun_css::LayerName>),
+    Borrowed(bun_ptr::BackRef<Vec<bun_css::LayerName<'a>>>),
+    Owned(Vec<bun_css::LayerName<'a>>),
 }
 
-impl Layers {
+impl<'a> Layers<'a> {
     #[inline]
-    pub(crate) fn inner(&self) -> &Vec<bun_css::LayerName> {
+    pub(crate) fn inner(&self) -> &Vec<bun_css::LayerName<'a>> {
         match self {
             Layers::Borrowed(p) => p.get(),
             Layers::Owned(b) => b,
@@ -1421,13 +1418,13 @@ impl Layers {
     /// (see the lifetime note on `Chunk`); `BackRef` encapsulates that
     /// invariant so `inner()`/`to_owned()` deref sites are safe.
     #[inline]
-    pub(crate) fn borrow(p: &Vec<bun_css::LayerName>) -> Self {
+    pub(crate) fn borrow(p: &Vec<bun_css::LayerName<'a>>) -> Self {
         Layers::Borrowed(bun_ptr::BackRef::new(p))
     }
 
     /// If borrowed, deep-clone into an owned
     /// list and return `&mut` to it; if already owned, return as-is.
-    pub(crate) fn to_owned(&mut self) -> &mut Vec<bun_css::LayerName> {
+    pub(crate) fn to_owned(&mut self) -> &mut Vec<bun_css::LayerName<'a>> {
         if let Layers::Borrowed(p) = *self {
             *self = Layers::Owned(p.deep_clone_with(|l| l.clone()));
         }
@@ -1438,7 +1435,7 @@ impl Layers {
     }
 }
 
-impl CssImportOrder<'_> {
+impl<'a> CssImportOrder<'a> {
     pub(crate) fn hash<H: bun_core::Hasher + ?Sized>(&self, hasher: &mut H) {
         // Not an identity: it leaves out the conditions. `css_chunk_key` compares on a hit.
 
@@ -1472,27 +1469,19 @@ impl CssImportOrder<'_> {
     }
 
     #[cfg(debug_assertions)]
-    pub(crate) fn fmt<'a, 'ctx>(
-        &'a self,
-        ctx: &'a LinkerContext<'ctx>,
-    ) -> CssImportOrderDebug<'a, 'ctx> {
+    pub(crate) fn fmt<'r>(&'r self, ctx: &'r LinkerContext<'a>) -> CssImportOrderDebug<'r, 'a> {
         CssImportOrderDebug { inner: self, ctx }
     }
 }
 
 #[cfg(debug_assertions)]
-pub(crate) struct CssImportOrderDebug<'a, 'ctx> {
-    inner: &'a CssImportOrder<'a>,
-    // Note: split lifetimes — `LinkerContext<'ctx>` is invariant over `'ctx`,
-    // so coupling the borrow lifetime to the struct param (`&'a LinkerContext<'a>`)
-    // forces every caller's `&CssImportOrder` and `&LinkerContext` to share one
-    // region. The Display i
```

**File**: `src/bundler/HTMLImportManifest.rs` (modified, +9/-66)
```diff
@@ -34,13 +34,12 @@
 //! that gets embedded directly into the JavaScript output.
 
 use crate::mal_prelude::*;
-use core::fmt;
 
 use bun_ast::Source;
 use bun_collections::AutoBitSet;
 use bun_collections::VecExt;
 use bun_core::strings;
-use bun_io::{FmtAdapter, Write};
+use bun_io::Write;
 use bun_js_printer::Encoding;
 use bun_paths::resolve_path::{platform, platform_to_posix_in_place, relative_normalized};
 use bun_resolver::fs::FileSystem;
@@ -51,30 +50,6 @@ use crate::options::{Loader, OutputFile, OutputKind};
 use crate::options_impl::LoaderExt as _;
 use crate::{BundleV2, Chunk, LinkerGraph};
 
-#[derive(Clone, Copy)]
-pub struct HTMLImportManifest<'a> {
-    pub(crate) index: u32,
-    pub(crate) graph: &'a Graph<'a>,
-    pub(crate) chunks: &'a [Chunk<'a>],
-    pub(crate) linker_graph: &'a LinkerGraph<'a>,
-}
-
-impl<'a> fmt::Display for HTMLImportManifest<'a> {
-    fn fmt(&self, writer: &mut fmt::Formatter<'_>) -> fmt::Result {
-        let mut adapter = FmtAdapter::new(writer);
-        match write(
-            self.index,
-            self.graph,
-            self.linker_graph,
-            self.chunks,
-            &mut adapter,
-        ) {
-            Ok(()) => Ok(()),
-            Err(_) => Err(fmt::Error),
-        }
-    }
-}
-
 fn write_entry_item<W: Write + ?Sized>(
     writer: &mut W,
     input: &[u8],
@@ -142,31 +117,6 @@ pub(crate) fn write_escaped_json<W: Write + ?Sized>(
     Ok(())
 }
 
-/// Newtype wrapper produced by [`HTMLImportManifest::format_escaped_json`].
-pub struct EscapedJson<'a>(pub HTMLImportManifest<'a>);
-
-impl<'a> fmt::Display for EscapedJson<'a> {
-    fn fmt(&self, writer: &mut fmt::Formatter<'_>) -> fmt::Result {
-        let mut adapter = FmtAdapter::new(writer);
-        match write_escaped_json(
-            self.0.index,
-            self.0.graph,
-            self.0.linker_graph,
-            self.0.chunks,
-            &mut adapter,
-        ) {
-            Ok(()) => Ok(()),
-            Err(_) => Err(fmt::Error),
-        }
-    }
-}
-
-impl<'a> HTMLImportManifest<'a> {
-    pub(crate) fn format_escaped_json(self) -> EscapedJson<'a> {
-        EscapedJson(self)
-    }
-}
-
 pub(crate) fn write<W: Write + ?Sized>(
     index: u32,
     graph: &Graph,
@@ -383,22 +333,15 @@ pub mod html_import_manifest {
     use crate::Graph::Graph;
     use crate::{LinkerGraph, chunk::Chunk};
 
-    pub use super::{EscapedJson, HTMLImportManifest};
-
-    #[inline]
-    pub(crate) fn format_escaped_json<'a>(
+    pub(crate) fn count_escaped_json(
         index: u32,
-        graph: &'a Graph,
-        chunks: &'a [Chunk],
-        linker_graph: &'a LinkerGraph,
-    ) -> EscapedJson<'a> {
-        super::HTMLImportManifest {
-            index,
-            graph,
-            chunks,
-            linker_graph,
-        }
-        .format_escaped_json()
+        graph: &Graph,
+        linker_graph: &LinkerGraph<'_>,
+        chunks: &[Chunk],
+    ) -> usize {
+        let mut counter = bun_io::DiscardingWriter::new();
+        let _ = super::write_escaped_json(index, graph, linker_graph, chunks, &mut counter);
+        counter.count
     }
 
     pub(crate) fn write_escaped_json(
```

**File**: `src/bundler/LinkerContext.rs` (modified, +1/-1)
```diff
@@ -2734,7 +2734,7 @@ pub(crate) struct TreeShakeCtx<'a, 'r> {
     pub(crate) parts_live: &'r mut [bun_collections::AutoBitSet],
     pub(crate) import_records: &'r [bun_ast::import_record::List<'a>],
     pub(crate) entry_point_kinds: &'r [EntryPoint::Kind],
-    pub(crate) css_reprs: &'r [crate::bundled_ast::CssCol],
+    pub(crate) css_reprs: &'r [crate::bundled_ast::CssCol<'a>],
     pub(crate) worklist: Vec<TreeShakeWork>,
 }
 
```

**File**: `src/bundler/bundle_v2.rs` (modified, +3/-3)
```diff
@@ -2067,10 +2067,10 @@ pub mod bv2_impl {
         }
     }
 
-    pub(crate) struct ReachableFileVisitor<'a> {
+    pub(crate) struct ReachableFileVisitor<'a, 'bump> {
         pub(crate) reachable: Vec<Index>,
         pub(crate) visited: DynamicBitSet,
-        pub(crate) all_import_records: &'a mut [import_record::List<'a>],
+        pub(crate) all_import_records: &'a mut [import_record::List<'bump>],
         pub(crate) all_loaders: &'a [Loader],
         pub(crate) all_urls_for_css: &'a [&'a [u8]],
         pub(crate) redirects: &'a [u32],
@@ -2102,7 +2102,7 @@ pub mod bv2_impl {
         },
     }
 
-    impl<'a> ReachableFileVisitor<'a> {
+    impl ReachableFileVisitor<'_, '_> {
         const MAX_REDIRECTS: usize = 64;
 
         // Find all files reachable from all entry points. This order should be
```

**File**: `src/bundler/bundled_ast.rs` (modified, +5/-12)
```diff
@@ -13,19 +13,12 @@ pub use bun_css::BundlerStyleSheet;
 
 /// Arena-owned handle to a parsed CSS stylesheet.
 ///
-/// The pointee lives in a per-file `Bump` whose ownership is held by
-/// `Graph.heap` (bumps are `Pin<Box<Bump>>` owned by the
-/// graph and outlive every `BundledAst` row by struct drop order). No `'arena`
-/// lifetime is threaded — N files imply N distinct per-worker bumps with no
-/// single common lifetime — so the invariant is enforced by drop order, not
-/// the type system. `StoreRef`'s `Deref`/`DerefMut` encapsulate the single
-/// documented `unsafe` deref justified by that invariant; callers use `&*r`
-/// (or `Option::as_deref`) instead of open-coded `unsafe { &*ptr }`.
-pub(crate) type CssAstRef = bun_ast::StoreRef<BundlerStyleSheet>;
+/// It lives in a `Worker.heap`, so `deinit_without_freeing_arena` drops it before the workers.
+pub(crate) type CssAstRef<'arena> = bun_ast::StoreRef<BundlerStyleSheet<'arena>>;
 
 /// Element type of the `css` SoA column (`items_css()`). Exposed so bundler
 /// call sites can name the column without re-spelling the pointer shape.
-pub(crate) type CssCol = Option<CssAstRef>;
+pub(crate) type CssCol<'arena> = Option<CssAstRef<'arena>>;
 
 use bun_ast::import_record;
 use bun_core::strings;
@@ -67,7 +60,7 @@ pub struct BundledAst<'arena> {
     pub(crate) parts: part::List<'arena>,
     // See `CssAstRef` doc for the arena drop-order invariant that backs the
     // safe `Deref`.
-    pub(crate) css: CssCol,
+    pub(crate) css: CssCol<'arena>,
     pub(crate) url_for_css: &'arena [u8],
     pub(crate) symbols: symbol::List<'arena>,
     pub(crate) module_scope: Scope,
@@ -115,7 +108,7 @@ bun_collections::multi_array_columns! {
         hashbang: StoreStr,
         export_default_alias_of_import: Ref,
         parts: part::List<'arena>,
-        css: CssCol,
+        css: CssCol<'arena>,
         url_for_css: &'arena [u8],
         symbols: symbol::List<'arena>,
         module_scope: Scope,
```

---

### Incident Patch 3: `33cf0a0a` (2026-11-13)
**Commit Message**: event loop: share the loop instead of borrowing it exclusively (#48866)

### What does this PR do?

What a tick runs reaches the `EventLoop` again, and other threads post
to it, yet its methods took `&mut self`. Safe code got that borrow from
a `&VirtualMachine` (`event_loop_mut`, `event_loop_ref`), the rest
dereferenced a raw pointer.

Every method but `deinit` now takes `&self`, and
`VirtualMachine::event_loop` returns `&EventLoop`. Removes 51 `unsafe`
blocks and 3 `unsafe fn` (the new unit test adds 2 of each).

- **Bug fix**: `&mut self` lets the optimizer keep fields across a
callback. In release builds `DeferredTaskQueue::run` read the map's keys
through a pointer loaded before the callback, which frees them if it
posts a task and the map grows.
- The enter guards borrow the loop, so `enter_scope` is safe.
- A loop is made with its VM, so `virtual_machine` is not an `Option`.
The pointer fields that safe methods trust are private, but for
`imminent_gc_timer`.
- Still `unsafe`: the task queues, borrowed in blocks in which no task
runs.
- Deleted: `event_loop_mut`, `event_loop_ref`, `event_loop_shared`, four
`black_box` calls that hid the aliasing, `EventLoopSqlExt`,
`ThreadSaf

**File**: `scripts/rust-miri.ts` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ const MIRI_CRATES = [
   "bun_clap",
   "bun_dispatch",
   "bun_errno",
+  "bun_event_loop",
   "bun_http_types",
   "bun_md",
   "bun_pod",
```

**File**: `src/event_loop/DeferredTaskQueue.rs` (modified, +62/-13)
```diff
@@ -35,6 +35,7 @@
 //! buffer to its own fd or socket, so relative order within a pass has no correctness effect, and
 //! anything a pass skips runs on the next one.
 
+use core::cell::UnsafeCell;
 use core::ffi::c_void;
 use core::ptr::NonNull;
 
@@ -49,14 +50,17 @@ pub type DeferredRepeatingTask = unsafe extern "C" fn(*mut c_void) -> bool;
 
 #[derive(Default)]
 pub struct DeferredTaskQueue {
-    pub(crate) map: ArrayHashMap<Option<NonNull<c_void>>, DeferredRepeatingTask>,
+    /// No borrow spans a callback, which reaches this queue again.
+    map: UnsafeCell<ArrayHashMap<Option<NonNull<c_void>>, DeferredRepeatingTask>>,
 }
 
 impl DeferredTaskQueue {
-    pub fn post_task(&mut self, ctx: Option<NonNull<c_void>>, task: DeferredRepeatingTask) -> bool {
+    pub fn post_task(&self, ctx: Option<NonNull<c_void>>, task: DeferredRepeatingTask) -> bool {
+        // SAFETY: no callback runs in this borrow, and `run` holds none while it calls one.
+        let map = unsafe { &mut *self.map.get() };
         // `ArrayHashMap` is currently aliased to std `HashMap`; the entry API
         // gives insert-if-absent + report-existing semantics.
-        match self.map.entry(ctx) {
+        match map.entry(ctx) {
             bun_collections::hash_map::Entry::Occupied(_) => true,
             bun_collections::hash_map::Entry::Vacant(v) => {
                 v.insert(task);
@@ -65,39 +69,84 @@ impl DeferredTaskQueue {
         }
     }
 
-    pub fn unregister_task(&mut self, ctx: Option<NonNull<c_void>>) -> bool {
+    pub fn unregister_task(&self, ctx: Option<NonNull<c_void>>) -> bool {
         // Order is irrelevant for this map's contract (see file doc), so
         // swap-remove is fine and O(1).
-        self.map.swap_remove(&ctx)
+        // SAFETY: no callback runs in this borrow, and `run` holds none while it calls one.
+        unsafe { &mut *self.map.get() }.swap_remove(&ctx)
     }
 
-    pub fn run(&mut self) {
+    pub fn run(&self) {
         // Callbacks may re-entrantly mutate `self.map` (see the re-entrancy
         // note in the file doc), so re-read `len()` every iteration and
         // re-check slot `i` after each callback. `remaining` is a livelock bound.
         let mut i: usize = 0;
-        let mut remaining = self.map.len();
-        while remaining > 0 && i < self.map.len() {
+        // SAFETY: the borrow ends before the callback below, after which `map` is borrowed anew.
+        let mut map = unsafe { &mut *self.map.get() };
+        let mut remaining = map.len();
+        while remaining > 0 && i < map.len() {
             remaining -= 1;
-            let key = self.map.keys()[i];
+            let key = map.keys()[i];
             let Some(nn) = key else {
-                self.map.swap_remove_at(i);
+                map.swap_remove_at(i);
                 continue;
             };
 
-            let task = self.map.values()[i];
+            let task = map.values()[i];
             // SAFETY: `nn` is the live `*mut T` registered by the caller; the
             // callback contract (`HasAutoFlusher::on_auto_flush`) is that
             // `task` may be invoked with exactly that pointer until it returns
             // `false` or is explicitly unregistered.
             let keep = unsafe { task(nn.as_ptr()) };
+            // SAFETY: the callback has returned; the borrow ends before the next one.
+            map = unsafe { &mut *self.map.get() };
             if !keep {
                 // `key` may already be gone (callback unregistered it) or may
                 // have moved; remove by key, not index.
-                self.map.swap_remove(&key);
-            } else if self.map.keys().get(i) == Some(&key) {
+                map.swap_remove(&key);
+            } else if map.keys().get(i) == Some(&key) {
                 i += 1;
             }
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use core::cell::Cell;
+
+    #[derive(Default)]
+    struct Fixture {
+        queue: DeferredTaskQueue,
+        grow_calls: Cell<u32>,
+        calls: Box<[Cell<u32>; 32]>,
+    }
+
+    unsafe extern "C" fn count(ctx: *mut c_void) -> bool {
+        // SAFETY: posted with an element of `Fixture::calls`, which outlives `run`.
+        unsafe { &*ctx.cast::<Cell<u32>>() }.update(|n| n + 1);
+        false
+    }
+
+    unsafe extern "C" fn grow(ctx: *mut c_void) -> bool {
+        // SAFETY: posted with the `Fixture`, which outlives `run`.
+        let fixture = unsafe { &*ctx.cast::<Fixture>() };
+        fixture.grow_calls.update(|n| n + 1);
+        for calls in fixture.calls.iter() {
+            let ctx = NonNull::from(calls).cast();
+            fixture.queue.post_task(Some(ctx), count);
+        }
+        true
+    }
+
+    #[test]
+    fn a_task_that_grows_the_queue_does_not_take_the_turn_of_the_next() {
+        let fixture = Fixture::default();
+        let queue = &fixture.queue;
+        queue.post_task(Some(NonNull::from(&fixture).cast()), grow);
+     
```

**File**: `src/event_loop/README.md` (modified, +7/-7)
```diff
@@ -16,8 +16,8 @@ A tagged pointer union containing various async task types (file I/O, network re
 
 Two separate queues for `setImmediate()`:
 
-- **`immediate_tasks`**: Tasks to run on the current tick
-- **`next_immediate_tasks`**: Tasks to run on the next tick
+- **`immediate_tasks`**: What `setImmediate` pushes to, and the next tick takes
+- **`next_immediate_tasks`**: The empty buffer that replaces it then
 
 This prevents infinite loops when `setImmediate` is called within a `setImmediate` callback.
 
@@ -319,16 +319,16 @@ This is because:
 The event loop uses a counter to track when to drain microtasks:
 
 ```rust
-pub fn enter(&mut self) {
-    self.entered_event_loop_count += 1;
+pub fn enter(&self) {
+    self.entered_event_loop_count.update(|count| count + 1);
 }
 
-pub fn exit(&mut self) {
-    let count = self.entered_event_loop_count;
+pub fn exit(&self) {
+    let count = self.entered_event_loop_count.get();
     if count == 1 && !self.vm_ref().is_inside_deferred_task_queue.get() {
         let _ = self.drain_microtasks();
     }
-    self.entered_event_loop_count -= 1;
+    self.entered_event_loop_count.update(|count| count - 1);
 }
 ```
 
```

**File**: `src/event_loop/SpawnSyncEventLoop.rs` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ unsafe extern "Rust" {
     /// on `uws_loop`. Returns erased `*mut jsc::EventLoop`.
     safe fn __bun_spawn_sync_create_event_loop(vm: *mut (), uws_loop: *mut uws::Loop) -> *mut ();
     safe fn __bun_spawn_sync_destroy_event_loop(el: *mut ());
-    /// Re-bind `event_loop.{global, virtual_machine}` to `vm` (prepare path).
+    /// Re-bind `event_loop.global` to `vm`'s (prepare path).
     safe fn __bun_spawn_sync_event_loop_set_vm(el: *mut (), vm: *mut ());
     safe fn __bun_spawn_sync_event_loop_tick_tasks_only(el: *mut ());
     #[cfg(windows)]
```

**File**: `src/js_parser_jsc/Macro.rs` (modified, +5/-6)
```diff
@@ -227,8 +227,8 @@ impl MacroContext {
         // `vm` is the per-thread VM (BackRef invariant: outlives this guard).
         // Enables macro mode now; disables on scope exit.
         let _mode_guard = MacroModeGuard::new(vm);
-        // SAFETY: `event_loop()` returns a self-pointer into `*vm`.
-        unsafe { (*(*vm).event_loop()).ensure_waker() };
+        // SAFETY: `vm` is the live per-thread VM.
+        unsafe { &*vm }.event_loop().ensure_waker();
 
         let javascript_object = self.javascript_object;
         // Lazy-init the backing arena now that a macro is actually being
@@ -457,8 +457,8 @@ impl Macro {
         // exit (success, `?`, Rejected) so depth/state can't leak; the caller's
         // own `MacroModeGuard` re-enables for the actual macro call.
         let _init_guard = MacroModeGuard::new(vm);
-        // SAFETY: `vm` is the per-thread VM; uniquely accessed here.
-        unsafe { (*(*vm).event_loop()).ensure_waker() };
+        // SAFETY: `vm` is the live per-thread VM.
+        unsafe { &*vm }.event_loop().ensure_waker();
         if is_new_vm {
             // SAFETY: `vm` is the freshly-allocated per-thread VM.
             unsafe { (*vm).transpiler.configure_defines()? };
@@ -899,8 +899,7 @@ impl<'a> Run<'a> {
                 let _ = self.macro_.vm();
                 let vm = VirtualMachine::get();
                 // The VM stopped before the macro's promise settled: throw its termination and unwind.
-                vm.as_mut()
-                    .wait_for_promise(promise)
+                vm.wait_for_promise(promise)
                     .map_err(|stopped| MacroError::Js(stopped.throw(self.global)))?;
 
                 let promise_result = promise.result(vm.jsc_vm());
```

**File**: `src/jsc/AbortSignal.rs` (modified, +0/-3)
```diff
@@ -382,9 +382,6 @@ impl Timeout {
     fn dispatch(vm: *mut VirtualMachine, signal_ptr: *mut AbortSignal) {
         let _ = vm;
         let vm = VirtualMachine::get();
-        // RAII guard `exit`s on
-        // drop even if `signal` unwinds, and holds the raw VM-owned pointer so
-        // borrowck doesn't see two live `&mut EventLoop` across re-entrant JS.
         let _guard = vm.enter_event_loop_scope();
         // `AbortSignal` is an `opaque_ffi!` ZST handle; `opaque_ref` is the
         // centralised non-null deref proof. `signalAbort()` takes
```

**File**: `src/jsc/CppTask.rs` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ extern "C" fn ConcurrentCppTask__createAndRun(
 ) {
     crate::mark_binding!();
     let vm = global.bun_vm();
-    vm.event_loop_shared().ref_keep_alive();
+    vm.event_loop().ref_keep_alive();
     let ticket = vm.ticket();
     WorkPool::schedule_new(ConcurrentCppTask {
         cpp_task,
```

**File**: `src/jsc/Debugger.rs` (modified, +9/-9)
```diff
@@ -320,15 +320,15 @@ impl Debugger {
             if wait == Wait::Off {
                 break;
             }
-            this.event_loop_mut().tick();
+            this.event_loop().tick();
             // Re-read after `tick()` — `Debugger__didConnect` may have flipped it.
             let wait = match this.debugger.as_deref() {
                 Some(d) => d.wait_for_connection,
                 None => break,
             };
             match wait {
                 Wait::Forever => {
-                    this.event_loop_mut().auto_tick_active();
+                    this.event_loop().auto_tick_active();
 
                     if bun_core::Environment::ENABLE_LOGS {
                         bun_core::scoped_log!(
@@ -440,7 +440,7 @@ impl Debugger {
                 .map_err(|_| crate::CrateError::ThreadSpawnFailed)?;
             // The `JoinHandle` is dropped here, detaching the thread.
         }
-        this_ref.event_loop_mut().ensure_waker();
+        this_ref.event_loop().ensure_waker();
 
         // Re-borrow after `ensure_waker` (which may touch `*this`).
         let dbg = this_ref.debugger_mut().unwrap();
@@ -480,7 +480,7 @@ impl Debugger {
         // `init` installs the freshly-boxed VM as this thread's singleton.
         let vm = VirtualMachine::get().as_mut();
         vm.is_main_thread = false;
-        vm.event_loop_mut().ensure_waker();
+        vm.event_loop().ensure_waker();
 
         extern "C" fn start_trampoline(ctx: *mut c_void) {
             // SAFETY: `ctx` is `&mut slot` below; `hold_api_lock` calls this
@@ -543,8 +543,8 @@ impl Debugger {
         debuggee.wake();
         // `vm.event_loop` may have flipped between `regular_event_loop` and
         // `macro_event_loop` inside the re-entrant JS above;
-        // `event_loop_mut()` re-reads the slot.
-        this.event_loop_mut().tick();
+        // `event_loop()` re-reads the slot.
+        this.event_loop().tick();
         debuggee.wake();
 
         loop {
@@ -553,9 +553,9 @@ impl Debugger {
             // call `VirtualMachine::get()` without aliasing.
             while this.is_event_loop_alive() {
                 this.as_mut().tick();
-                this.event_loop_mut().auto_tick_active();
+                this.event_loop().auto_tick_active();
             }
-            this.event_loop_mut().tick_possibly_forever();
+            this.event_loop().tick_possibly_forever();
         }
     }
 }
@@ -675,7 +675,7 @@ pub fn did_connect() {
     if dbg.wait_for_connection != Wait::Off {
         dbg.wait_for_connection = Wait::Off;
         dbg.poll_ref.unref(get_vm_ctx(AllocatorType::Js));
-        this.event_loop_mut().wakeup();
+        this.event_loop().wakeup();
     }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #48943** (closed): DO NOT MERGE: the tests of #48914 without its libuv patch (@robobun)
- **PR #48922** (closed): ci: regenerate the shard weights from measured runs, and rewrite test/expected-durations.json in place (@robobun)
- **PR #48902** (closed): test(hot): probe for the windows 11 aarch64 timeout of the entry-point promise test (not for merge) (@robobun)
- **PR #48893** (2026-11-14): spawn, io: share Process and KeepAlive instead of borrowing them exclusively (@dylan-conway)
- **PR #48889** (2026-11-14): shell: environments and their strings are owned (@dylan-conway)
- **PR #48888** (2026-11-14): tar: match npm more closely in npm mode (@dylan-conway)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
