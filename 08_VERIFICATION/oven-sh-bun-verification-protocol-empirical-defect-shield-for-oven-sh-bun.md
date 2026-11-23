# Verification Protocol: Verification Protocol: Empirical Defect Shield for oven-sh/bun

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh/bun",
  "source_url": "https://github.com/oven-sh/bun",
  "source_version": "26f8a967",
  "license": "NOASSERTION",
  "timestamp": "2026-11-23T23:48:44.202Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oven-sh-bun",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh/bun](https://github.com/oven-sh/bun) (Revision: `26f8a967`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-23T23:48:44.202Z`  
> **Learning ID**: `learn-github-oven-sh-bun`


## 1. Scope & Verification Target
- **Target Repository**: `oven-sh/bun` (Commit: `26f8a967`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): oven-sh/bun

> **Canonical Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T23:48:42.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96858 stars

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
             * read as errno 8 (ENOEXEC) in the JS error path. */
            const int error = !!(events & EPOLLERR);
            /* A read
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
- **Issue #49421** (2026-11-22): **bun:test: setImmediate is starved while awaiting expect().rejects/.resolves when a Worker is alive (1.4.5)**
  *Symptoms*: ### What version of Bun is running?  1.4.5 (a7733435c). Also checked 1.3.10 (30e609e0), which does not show the problem to the same degree.  ### What platform is your computer?  `Darwin 27.2.0 arm64 arm`  ### What steps can reproduce the bug?  In `bun test`, while a test awaits `expect(p).rejects` (or `.resolves`) and any `Worker` is alive in the process, `setImmediate` callbacks are only dispatched about once per 100 to 1000 ms. A promise that settles from `setImmediate` therefore takes about a second per `await expect(...)`. Awaiting the same promise directly is not affected. The worker does not need to be used by the test.  `echo-worker.ts` ```ts declare var self: Worker; self.onmessage = (e) => postMessage(e.data); ```  `with-worker.test.ts` ```ts import { test, expect, afterAll } from "bun:test";  // One idle worker, alive for the whole file. It is never used by the tests below. const worker = new Worker(new URL("./echo-worker.ts", import.meta.url).href); afterAll(() => worker.terminate());  const viaImmediate = () =>   new Promise<never>((_, reject) => setImmediate(() => reject(new Error("x"))));  const ROUNDS = 10;  test("A: expect(p).rejects x10", async () => {   const start = performance.now();   for (let i = 0; i < ROUNDS; i++) {     await expect(viaImmediate()).rejects.toThrow("x");   }   console.log(`A: ${(performance.now() - start).toFixed(0)} ms`); });  test("B: plain await x10", async () => {   const start = performance.now();   for (let i = 0; i < ROUNDS; i++)

- **Issue #49373** (2026-11-21): **bun test --retry: a timed-out attempt that settles late passes the retried test**
  *Symptoms*: ### What happens  With `--retry`, if one attempt of a test times out and its promise resolves (or its `done()` fires) later, bun gives that late result to the attempt that's running at that point. The retried test is then marked **passed**.  ```ts import { test } from "bun:test"; let n = 0; test("times out, resolves late", () => {   n++; console.log("attempt", n);   return new Promise<void>((r) => setTimeout(r, 150)); }, 100); test("filler", async () => { await new Promise((r) => setTimeout(r, 300)); }); ```  - `bun test repro.test.ts` gives 1 pass, 1 fail. That's correct. - `bun test --retry=2 repro.test.ts` gives 2 pass, 0 fail. That's wrong: attempt 1 resolves late, and that result counts for attempt 2. - A late `done()` does the same thing. - Attempt 2 can hang forever and the test still passes. - Nothing logs a timeout, and the JUnit testcase reads as passed.  ### Versions  - Broken: 1.4.4 (38afee6c8), 1.4.5 (a7733435c) - Fixed: 1.4.6-canary.1 (98eae327f)  PR #38876 described this same bug and was closed without merging.  ### Expected  Each attempt settles by itself. A timed-out attempt stays failed, and only the attempt that's running decides the result.  ### Ask  1. Can you confirm the fix ships in 1.4.6? 2. Can the fix come with a regression test? It should cover a late resolve, a late `done`, and a late reject, each counted against the next attempt. 

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

### Incident Patch 1: `476428f3` (2026-11-23)
**Commit Message**: ipc: fifteen fixes to re-entry, handles and the lifetime of the channel (#49324)

### What does this PR do?

Replaces part of #49156. One commit for each fix.

| Before | After | Test |
| --- | --- | --- |
| `send()` ran an `Array.prototype` setter: use-after-free | no script |
"setter" |
| Flush recursed: stack overflow | loops | "long backlog" |
| Nested loop repeated messages or panicked | position in the buffer |
"are buffered" |
| Nested loop overwrote an advanced read | rest copied first | "nothing
is buffered" |
| Buffers restored under a borrow | after it | "are restored" |
| `Subprocess` collected during a read | held | "nothing else keeps" |
| ... a write: use-after-free | held | "write completes" |
| ... the close: no `onDisconnect` | held | "close is reported" |
| Close during cluster replay: use-after-free | replay stops | "replays"
|
| Rejected dgram descriptor closed twice | once | "dgram.Native" |
| Unclaimed cluster descriptor leaked | closed | "is closed by" |
| Close during serialization leaked the handle | released | "releases a"
|
| Worker exit in the listener closed twice | once | "Worker that
receives" |
| Socket of a rejected message leaked | closed | "seria

**File**: `src/js/builtins/Ipc.ts` (modified, +4/-12)
```diff
@@ -52,9 +52,7 @@ export function serialize(message: unknown, handle: unknown, options: unknown) {
 }
 /**
  * @param {Serialized} serialized
- * @param {unknown} handle
- * @param {(handle: Handle) => void} emit
- * @returns {void}
+ * @returns {(() => void) | undefined} what delivers the message now, once the caller has let go of `fd`
  */
 export function parseHandle(target: $Bindgen.Subprocess | null, serialized: $Node.SerializedIPCHandle, fd: number) {
   const emit: (target: $Bindgen.Subprocess | null, message: unknown, handle: object) => void = $bindgen(
@@ -74,22 +72,16 @@ export function parseHandle(target: $Bindgen.Subprocess | null, serialized: $Nod
     case "net.Socket": {
       const socket = new net.Socket({ readable: true, writable: true });
       socket.connect({ fd, fdIsRawSocket: true });
-      emit(target, serialized.msg, socket);
-      return;
+      return () => emit(target, serialized.msg, socket);
     }
     case "dgram.Native": {
       // A non-reading UDP handle (cluster-shared dgram socket): wrap the
       // received descriptor so the cluster child can adopt it.
       const { UDP } = require("internal/dgram");
       const wrap = new UDP();
       const err = wrap.open(fd);
-      if (err) {
-        // The wrap only owns the descriptor on success; don't leak it.
-        require("node:fs").closeSync(fd);
-        throw new Error(`failed to open received dgram handle: ${err}`);
-      }
-      emit(target, serialized.msg, wrap);
-      return;
+      if (err) throw new Error(`failed to open received dgram handle: ${err}`);
+      return () => emit(target, serialized.msg, wrap);
     }
     case "dgram.Socket": {
       // https://github.com/nodejs/node/blob/v26.3.0/lib/internal/child_process.js handleConversion['dgram.Socket'].got
```

**File**: `src/runtime/ipc.rs` (modified, +186/-207)
```diff
@@ -1,12 +1,15 @@
 use core::cell::Cell;
 use core::ffi::{c_int, c_void};
 use core::mem::size_of;
+use std::collections::VecDeque;
 
 use bun_jsc::JsCell;
 use bun_ptr::{Attached, Detach, RefPtr};
 
 use crate::json_line_buffer::JSONLineBuffer;
-use bun_collections::{ByteVecExt, VecExt};
+#[cfg(windows)]
+use bun_collections::ByteVecExt;
+use bun_collections::VecExt;
 use bun_core::{Output, handle_oom};
 use bun_core::{String as BunString, StringView, strings};
 use bun_io::KeepAlive;
@@ -72,93 +75,32 @@ impl InternalMsgHolder {
             .push(bun_jsc::StrongOptional::create(message, global));
     }
 
-    pub(crate) fn dispatch(
-        &mut self,
-        message: JSValue,
-        handle: JSValue,
-        global: &JSGlobalObject,
-    ) -> JsResult<()> {
-        if !self.is_ready() {
-            // Queued messages drop their handle; the cluster listener is
-            // installed before any handle-bearing reply can arrive.
-            self.enqueue(message, global);
-            return Ok(());
-        }
-        self.dispatch_unsafe(message, handle, global)
-    }
-
-    fn dispatch_unsafe(
-        &mut self,
-        message: JSValue,
-        handle: JSValue,
-        global: &JSGlobalObject,
-    ) -> JsResult<()> {
-        let cb = self.cb.get().unwrap();
-        let worker = self.worker.get().unwrap();
-
-        let event_loop = global.bun_vm().event_loop();
-
-        event_loop.run_callback(
-            bun_event_loop::ContextId::NONE,
-            cb,
-            global,
-            worker,
-            &[message, handle],
-        );
-        Ok(())
-    }
-
-    pub(crate) fn flush(&mut self, global: &JSGlobalObject) -> JsResult<()> {
-        debug_assert!(self.is_ready());
-        let messages = core::mem::take(&mut self.messages);
-        // `&mut self` carries LLVM `noalias`, but
-        // `dispatch_unsafe` → `event_loop.run_callback` runs the JS IPC
-        // listener which can re-enter via a fresh `&mut Self` from the
-        // owner's JS wrapper and write `self.cb` / `self.worker` /
-        // `self.callbacks`. With the loop body inlined, LLVM was hoisting the
-        // `self.cb`/`self.worker` reads (at the top of `dispatch_unsafe`) out
-        // of the loop — ASM-verified PROVEN_CACHED. Launder so each iteration
-        // re-reads through an opaque pointer.
-        let this: *mut Self = core::hint::black_box(core::ptr::from_mut(self));
-        for strong in messages {
-            if let Some(message) = strong.get() {
-                // SAFETY: `this` is still live across re-entry — the IPC
-                // dispatcher is owned by the Subprocess/Worker which outlives
-                // this `flush` frame; `&mut *this` is the unique mutable view
-                // for this call.
-                unsafe { &mut *this }.dispatch_unsafe(message, JSValue::NULL, global)?;
-            }
-            // strong drops here (== `strong.deinit()`)
-        }
-        // messages Vec drops here (== `messages.deinit(bun.default_allocator)`)
-        Ok(())
-    }
-
     // `deinit` body only freed owned fields (Strongs, map, Vec). All of those impl Drop in
     // Rust, so no explicit Drop body is needed.
 }
 
 bun_core::define_scoped_log!(log, IPC, visible);
 
-/// Union type that switches between simple Vec<u8> (for advanced mode)
+/// Union type that switches between StreamBuffer (for advanced mode)
 /// and JSONLineBuffer (for JSON mode with optimized newline tracking).
 enum IncomingBuffer {
-    /// For advanced mode - uses length-prefix, no scanning needed
-    Advanced(Vec<u8>),
+    /// For advanced mode - uses length-prefix, no scanning needed.
+    /// The cursor is not a local of the reader: a handler can run the event loop, which reads on from it.
+    Advanced(StreamBuffer),
     /// For JSON mode - tracks newline positions to avoid O(n²) scanning
     Json(JSONLineBuffer),
 }
 
 impl IncomingBuffer {
     fn init(mode: Mode) -> IncomingBuffer {
         match mode {
-            Mode::Advanced => IncomingBuffer::Advanced(Vec::<u8>::default()),
+            Mode::Advanced => IncomingBuffer::Advanced(StreamBuffer::default()),
             Mode::Json => IncomingBuffer::Json(JSONLineBuffer::new(json::max_line_len())),
         }
     }
 }
 
-// deinit: Vec<u8>/JSONLineBuffer own their storage and Drop frees it.
+// deinit: StreamBuffer/JSONLineBuffer own their storage and Drop frees it.
 
 #[derive(Copy, Clone, Eq, PartialEq)]
 pub(crate) enum IsInternal {
@@ -211,7 +153,25 @@ pub(crate) enum DecodedIPCMessage {
 
 pub(crate) struct DecodeIPCMessageResult {
     pub(crate) bytes_consumed: u32,
-    pub(crate) message: DecodedIPCMessage,
+    pub(crate) message: Unrestored,
+}
+
+pub(crate) enum Unrestored {
+    Plain(DecodedIPCMessage),
+    /// A `[message, buffers]` envelope.
+    WithBuffers(JSValue),
+}
+
+impl Unrestored {
+    /// Can run script, so nothing that was read can be borrowed.
+    fn restore(self, global: &JSGlobalObject) -> JsRe
```

**File**: `src/runtime/ipc_host.rs` (modified, +4/-3)
```diff
@@ -272,10 +272,11 @@ pub(crate) fn do_send(
     }
 
     if status == SerializeAndSendResult::Failure {
-        close_detached(global_object, pause_target)?;
         // The serializer rejected the message (cyclic JSON, uncloneable value): that is the error.
-        if global_object.has_exception() {
-            return Err(bun_jsc::JsError::Thrown);
+        let rejected = global_object.try_take_exception();
+        close_detached(global_object, pause_target)?;
+        if let Some(rejected) = rejected {
+            return Err(global_object.throw_value(rejected));
         }
         let ex = global_object.create_type_error_instance(format_args!("process.send() failed"));
         ex.put(
```

**File**: `src/runtime/node/node_cluster_binding.rs` (modified, +33/-8)
```diff
@@ -23,8 +23,8 @@ bun_output::declare_scope!(IPC, visible);
 
 // ArrayHashMap::new() is not const, so the global is lazily seeded on first
 // access via `child_singleton()`.
-// PORTING.md §Global mutable state: JS-thread-only singleton with `!Sync`
-// fields (`Strong`). RacyCell — single-thread access is the contract.
+// One for each JS thread: a `Strong` belongs to the VM that made it.
+#[thread_local]
 pub(crate) static CHILD_SINGLETON: bun_core::RacyCell<Option<InternalMsgHolder>> =
     bun_core::RacyCell::new(None);
 
@@ -36,10 +36,8 @@ pub(crate) static CHILD_SINGLETON: bun_core::RacyCell<Option<InternalMsgHolder>>
 /// must not hold the borrow across a re-entrant `child_singleton()` call.
 #[inline]
 fn child_singleton<'a>() -> &'a mut InternalMsgHolder {
-    // SAFETY: only called on the single JS thread.
-    // `RacyCell::get` returns `*mut Option<_>`; the `Option` lives in
-    // `'static` storage so the returned `&mut` is valid for any caller-chosen
-    // `'a`. Aliasing: each of the three callers borrows for a single
+    // SAFETY: `RacyCell::get` returns `*mut Option<_>` into this thread's
+    // storage, which outlives every caller on this thread. Aliasing: each of the three callers borrows for a single
     // statement/block with no nested call to this fn.
     unsafe { (*CHILD_SINGLETON.get()).get_or_insert_with(Default::default) }
 }
@@ -55,7 +53,19 @@ pub(crate) fn on_internal_message_child<'a>(
     // TODO: we should not create two jsc.Strong.Optional here. If absolutely necessary, a single Array. should be all we use.
     singleton.worker = StrongOptional::create(worker.to_js(), global);
     singleton.cb = StrongOptional::create(callback.to_js(), global);
-    singleton.flush(global)
+    for message in core::mem::take(&mut singleton.messages) {
+        if !is_child_listening() {
+            break; // the channel closed
+        }
+        if let Some(message) = message.get() {
+            handle_internal_message_child(global, message, JSValue::NULL)?;
+        }
+    }
+    Ok(())
+}
+
+pub(crate) fn is_child_listening() -> bool {
+    child_singleton().is_ready()
 }
 
 pub(crate) fn handle_internal_message_child(
@@ -65,7 +75,22 @@ pub(crate) fn handle_internal_message_child(
 ) -> JsResult<()> {
     bun_output::scoped_log!(IPC, "handleInternalMessageChild");
 
-    child_singleton().dispatch(message, handle, global)
+    // The listener can close the channel, which drops the singleton.
+    let singleton = child_singleton();
+    let Some((cb, worker)) = singleton.cb.get().zip(singleton.worker.get()) else {
+        // Queued messages drop their handle; the cluster listener is
+        // installed before any handle-bearing reply can arrive.
+        singleton.enqueue(message, global);
+        return Ok(());
+    };
+    global.bun_vm().event_loop().run_callback(
+        bun_event_loop::ContextId::NONE,
+        cb,
+        global,
+        worker,
+        &[message, handle],
+    );
+    Ok(())
 }
 
 pub(crate) fn send_helper_primary<'a>(
```

**File**: `test/js/bun/spawn/spawn.ipc.test.ts` (modified, +585/-1)
```diff
@@ -1,6 +1,6 @@
 import { spawn } from "bun";
 import { describe, expect, it } from "bun:test";
-import { bunEnv, bunExe, gcTick, isLinux, isWindows, tempDir } from "harness";
+import { bunEnv, bunExe, gcTick, isDebug, isLinux, isWindows, tempDir } from "harness";
 import path from "path";
 
 // The receiver rejects a JSON line that's longer than the UTF-8 encoding of a max-length string can be.
@@ -597,3 +597,587 @@ it.skipIf(isWindows)("advanced serialization advertises wire format version 2",
   expect(JSON.parse(stdout.trim())).toEqual([1, 2, 0, 0, 0]);
   expect(exitCode).toBe(0);
 });
+
+/** Runs parent.js next to child.js. Both have the helpers below. */
+async function runPair(parent: string, child: string, env: Record<string, string> = {}, prelude = "") {
+  const helpers = `
+    const fs = require("node:fs");
+    // So that a child does not outlive a test that timed out.
+    const deadline = Date.now() + 120_000;
+    function until(file) {
+      while (!fs.existsSync(file)) {
+        if (Date.now() > deadline) throw new Error("gave up waiting for " + file);
+        Bun.sleepSync(1);
+      }
+    }
+    function retry(syscall) {
+      for (;;) {
+        try {
+          return syscall();
+        } catch (e) {
+          if (e.code !== "EAGAIN" || Date.now() > deadline) throw e;
+          Bun.sleepSync(1);
+        }
+      }
+    }
+    function write(bytes) {
+      bytes = Buffer.from(bytes);
+      for (let offset = 0; offset < bytes.length; ) offset += retry(() => fs.writeSync(3, bytes, offset));
+    }
+    function advancedFrame(message) {
+      const body = Buffer.from(require("bun:jsc").serialize(message));
+      const header = Buffer.from([2, 0, 0, 0, 0]);
+      header.writeUInt32LE(body.length, 1);
+      return Buffer.concat([header, body]);
+    }
+    const spawnChild = options =>
+      Bun.spawn({
+        cmd: [process.execPath, "child.js"],
+        env: { ...process.env, BUN_JSC_gcMaxHeapSize: undefined },
+        stdio: ["ignore", "inherit", "inherit"],
+        serialization: "json",
+        ipc() {},
+        onExit: (_, code, signal) => void (code === 0 || console.log("child failed", code, signal)),
+        ...options,
+      });
+    const listen = () =>
+      new Promise((resolve, reject) => {
+        const server = require("node:net").createServer().once("error", reject);
+        server.listen(0, "127.0.0.1", () => resolve(server));
+      });
+    const turn = () => new Promise(resolve => setImmediate(resolve));
+    const openFds = () => fs.readdirSync("/proc/self/fd").length;
+    // Bun.build() runs the event loop until the setup() of a plugin has settled.
+    const runEventLoopUntil = promise =>
+      void Bun.build({ entrypoints: ["./empty.js"], plugins: [{ name: "wait", setup: () => promise.then(() => {}) }] });
+  `;
+  using dir = tempDir("ipc-pair", {
+    "parent.js": prelude + helpers + parent,
+    "child.js": helpers + child,
+    "empty.js": "",
+  });
+  await using proc = Bun.spawn({
+    cmd: [bunExe(), "--no-orphans", "parent.js"],
+    env: { ...bunEnv, ...env },
+    cwd: String(dir),
+    stdout: "pipe",
+    stderr: "pipe",
+  });
+  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+  return { stdout: stdout.split("\n").filter(Boolean), stderr, exitCode };
+}
+
+describe.concurrent("the send queue", () => {
+  it("does not run a setter on Array.prototype to store a callback", async () => {
+    const result = await runPair(
+      `
+        const server = await listen();
+        const child = spawnChild();
+        // Nothing follows a handle until it is acked, so the next three are joined.
+        child.send("handle", server);
+        child.send("a", () => console.log("a"));
+        child.send("b", () => console.log("b"));
+        Object.defineProperty(Array.prototype, 2, {
+          configurable: true,
+          set() {
+            delete Array.prototype[2];
+            console.log("setter");
+            for (let i = 0; i < 16; i++) child.send("handle", server);
+          },
+        });
+        child.send("c", () => console.log("c"));
+        delete Array.prototype[2];
+        child.send("last");
+        await child.exited;
+        server.close();
+      `,
+      `
+        process.on("message", (message, handle) => {
+          handle?.close();
+          if (message === "last") process.disconnect();
+        });
+      `,
+    );
+    expect(result).toEqual({ stdout: ["a", "b", "c"], stderr: "", exitCode: 0 });
+  });
+
+  // The child uses descriptor 3 directly. Windows frames what goes through its pipe.
+  it.skipIf(isWindows)("writes a long backlog of replies without overflowing the stack", async () => {
+    const count = isDebug ? 4_000 : 100_000;
+    const result = await runPair(
+      `await spawnChild({ ipc: () => fs.writeFileSync("queued", "") }).exited;`,
+      `
+        // Each announces a handle that does not come, and is answered 
```

**File**: `test/js/node/cluster.test.ts` (modified, +70/-0)
```diff
@@ -11,7 +11,10 @@ import {
   tempDirWithFiles,
   tls as tlsCerts,
 } from "harness";
+import { spawn } from "node:child_process";
+import { once } from "node:events";
 import net from "node:net";
+import { text } from "node:stream/consumers";
 
 test.concurrent("cloneable and transferable equals", async () => {
   const dir = tempDirWithFiles("bun-test", {
@@ -1532,3 +1535,70 @@ test.concurrent("require('cluster') does not throw when NODE_UNIQUE_ID is set af
   expect({ stdout, stderr }).toEqual({ stdout: "loaded\n", stderr: "" });
   expect(exitCode).toBe(0);
 });
+
+// The test writes the wire format of a POSIX socket to the channel. Windows frames what goes through its pipe.
+test.concurrent.skipIf(isWindows)("the channel closes while a worker replays the messages it queued", async () => {
+  using dir = tempDir("cluster-close-in-replay", {
+    "empty.js": "",
+    "index.js": `
+      process.on("message", () => {
+        process.on("internalMessage", ({ act }) => {
+          console.log(act);
+          if (act !== "second") return;
+          const { promise, resolve } = Promise.withResolvers();
+          process.once("disconnect", resolve);
+          // Bun.build() runs the event loop until the setup() of a plugin has settled.
+          Bun.build({ entrypoints: ["./empty.js"], plugins: [{ name: "wait", setup: () => promise }] });
+        });
+        require("node:cluster");
+        console.log("replayed");
+      });
+    `,
+  });
+  const proc = spawn(bunExe(), ["index.js"], {
+    env: { ...bunEnv, NODE_CHANNEL_FD: "3", NODE_CHANNEL_SERIALIZATION_MODE: "json", NODE_UNIQUE_ID: "1" },
+    cwd: String(dir),
+    stdio: ["ignore", "pipe", "pipe", "pipe"],
+  });
+  try {
+    const channel = proc.stdio[3] as net.Socket;
+    // ECONNRESET if the worker crashes, which its output says better.
+    channel.on("error", () => {}).resume();
+    channel.write('\x02{"act":"disconnect"}\n\x02{"act":"second"}\n\x02{"act":"third"}\n"load node:cluster"\n');
+    const [stdout, stderr, exit] = await Promise.all([text(proc.stdout!), text(proc.stderr!), once(proc, "exit")]);
+    expect({ stdout, stderr }).toEqual({ stdout: "disconnect\nsecond\nreplayed\n", stderr: "" });
+    expect(exit).toEqual([0, null]);
+  } finally {
+    proc.kill();
+  }
+});
+
+test.concurrent("a Worker thread that sets up node:cluster does not take the messages of its process", async () => {
+  using dir = tempDir("cluster-in-worker-thread", {
+    "index.js": `
+      const { Worker, isMainThread } = require("node:worker_threads");
+      const cluster = require("node:cluster");
+      if (!isMainThread) {
+        cluster._setupWorker();
+      } else if (cluster.isPrimary) {
+        const worker = cluster.fork();
+        worker.on("listening", () => worker.disconnect());
+        worker.on("exit", (code, signal) => console.log("exit", code, signal));
+      } else {
+        new Worker(__filename, { env: { ...process.env, NODE_UNIQUE_ID: "1" } }).on("exit", () => {
+          require("node:net").createServer().listen(0, "127.0.0.1", () => console.log("listening"));
+        });
+      }
+    `,
+  });
+  await using proc = Bun.spawn({
+    cmd: [bunExe(), "--no-orphans", "index.js"],
+    env: bunEnv,
+    cwd: String(dir),
+    stdout: "pipe",
+    stderr: "pipe",
+  });
+  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+  expect({ stdout, stderr }).toEqual({ stdout: "listening\nexit 0 null\n", stderr: "" });
+  expect(exitCode).toBe(0);
+});
```

---

### Incident Patch 2: `08763cdd` (2026-11-23)
**Commit Message**: redis: fix lost and corrupted arguments, add increx() (#49207)

### What does this PR do?

Fixes #23219. Fixes #44472. Part of #33070. Takes part of #37574.
Replaces #48332, #48427, #48459, #48513, most of #41640 and the Redis
part of #46673.

| call | before | after |
| --- | --- | --- |
| `set(k, v, undefined, "NX")`, `set(k, v, undefined, 0, "NX")` | `NX`
dropped, lock overwritten | throws when an option behind a nullish
argument would be dropped; otherwise sends what it sent |
| a nullish ahead of another argument in `mget`, `hmget`, `zmscore` |
replies shift or are cut short | throws; a trailing nullish is still
left out |
| `hset`, `hmset`, and key or field of `hincrby`, `hincrbyfloat`, with a
buffer or Blob | 4 bytes stored as 8, `"7,255"`, `"[object Blob]"` | the
bytes |
| `hset(k, buffer, v)` | buffer read as a record | buffer is the field |
| `hset(undefined, f, v)`, `hset(k, null, v)` | key `"undefined"`, field
`"null"` | throws |
| `set(k, Bun.file(p))`, an S3 file, `new Blob([file])` | sends `""` |
throws |
| `publish(ch, buffer)` (also Blob, number) | throws | sends it |
| `increx(k, ...options)` | missing | `[value, increment]` |
| types: number values, buffers in `s

**File**: `docs/runtime/redis.mdx` (modified, +9/-1)
```diff
@@ -126,6 +126,9 @@ await redis.set("counter", "0");
 // Increment by 1
 await redis.incr("counter");
 
+// Redis 8.8 or Valkey 9.2: increment and set the expiration in one command
+const [value, increment] = await redis.increx("counter", "BYINT", 5, "EX", 60);
+
 // Decrement by 1
 await redis.decr("counter");
 ```
@@ -249,6 +252,9 @@ Publish messages with the `publish()` method:
 
 ```typescript redis.ts icon="/icons/typescript.svg"
 await client.publish(channelName, message);
+
+// A buffer is sent as its bytes
+await client.publish(channelName, new Uint8Array([0xff, 0xfe]));
 ```
 
 ### Subscriptions
@@ -288,7 +294,7 @@ const client = new RedisClient("redis://localhost:6379", {
 
 ### Raw Commands
 
-Use the `send` method to run any Redis command, including ones without a dedicated method. The first argument is the command name, and the second is an array of string arguments.
+Use the `send` method to run any Redis command, including ones without a dedicated method. The first argument is the command name. The second is an array of strings, numbers, buffers or in-memory `Blob`s. `Bun.file()` and `S3File` throw here and in every other method: pass `await file.bytes()`.
 
 ```ts redis.ts icon="/icons/typescript.svg"
 // Run any Redis command
@@ -301,6 +307,8 @@ await redis.send("LPUSH", ["mylist", "value1", "value2"]);
 const list = await redis.send("LRANGE", ["mylist", "0", "-1"]);
 ```
 
+A `null` or `undefined` argument throws where it would shift or drop another one, as in `mget(a, undefined, c)` or `set(key, value, undefined, "NX")`. After `MULTI`, catch such errors and send `DISCARD`, or later commands stay queued.
+
 ### Connection Events
 
 You can register handlers for connection events:
```

**File**: `packages/bun-types/redis.d.ts` (modified, +257/-118)
```diff
@@ -70,7 +70,7 @@ declare module "bun" {
      * console.log(await redis.get("hello"));
      * ```
      */
-    constructor(url?: string, options?: RedisOptions);
+    constructor(url?: string | URL, options?: RedisOptions);
 
     /**
      * Whether the client is connected to the Redis server
@@ -111,7 +111,12 @@ declare module "bun" {
     /**
      * Send a raw command to the Redis server
      * @param command The command to send
-     * @param args The arguments to the command
+     * @param args The arguments to the command. Bun sends each element as one argument and does not change the array.
+     * - A string is sent as UTF-8.
+     * - A number is sent as the string that `String(value)` returns.
+     * - A typed array, a `DataView`, an `ArrayBuffer` or a `SharedArrayBuffer` is sent as its bytes.
+     * - A `Blob` whose bytes are in memory is sent as its bytes. `Bun.file()` and an `S3File` throw: pass
+     *   `await file.bytes()`.
      * @returns A promise that resolves with the command result
      *
      * The reply is converted as follows. See the type conversion section in
@@ -127,7 +132,10 @@ declare module "bun" {
      * - A map becomes a plain object with a null prototype.
      * - An error reply (`-` or `!`) rejects the promise with code ERR_REDIS_SERVER_ERROR.
      */
-    send(command: string, args: string[]): Promise<any>;
+    send(
+      command: string,
+      args: readonly (string | number | NodeJS.TypedArray | DataView<ArrayBufferLike> | ArrayBufferLike | Blob)[],
+    ): Promise<any>;
 
     /**
      * Get the value of a key
@@ -146,102 +154,131 @@ declare module "bun" {
     /**
      * Set key to hold the string value
      * @param key The key to set
-     * @param value The value to set
+     * @param value The value to set. A number is sent as the string that `String(value)` returns.
      * @returns Promise that resolves with "OK" on success
      */
-    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike): Promise<"OK">;
+    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike | number): Promise<"OK">;
 
     /**
      * Set key to hold the string value with expiration
      * @param key The key to set
-     * @param value The value to set
+     * @param value The value to set. A number is sent as the string that `String(value)` returns.
      * @param ex Set the specified expire time, in seconds
      * @returns Promise that resolves with "OK" on success
      */
-    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike, ex: "EX", seconds: number): Promise<"OK">;
+    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike | number, ex: "EX", seconds: number): Promise<"OK">;
 
     /**
      * Set key to hold the string value with expiration
      * @param key The key to set
-     * @param value The value to set
+     * @param value The value to set. A number is sent as the string that `String(value)` returns.
      * @param px Set the specified expire time, in milliseconds
      * @returns Promise that resolves with "OK" on success
      */
-    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike, px: "PX", milliseconds: number): Promise<"OK">;
+    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike | number, px: "PX", milliseconds: number): Promise<"OK">;
 
     /**
      * Set key to hold the string value with expiration at a specific Unix
      * timestamp
      * @param key The key to set
-     * @param value The value to set
+     * @param value The value to set. A number is sent as the string that `String(value)` returns.
      * @param exat Set the specified Unix time at which the key will expire, in
      * seconds
      * @returns Promise that resolves with "OK" on success
      */
-    set(key: RedisClient.KeyLike, value: RedisClient.KeyLike, exat: "EXAT", timestampSeconds: number): Promise<"OK">;
+    set(
+      key: RedisClient.KeyLike,
+      value: RedisClient.KeyLike | number,
+      exat: "EXAT",
+      timestampSeconds: number,
+    ): Promise<"OK">;
 
     /**
      * Set key to hold the string value with expiration at a specific Unix timestamp
      * @param key The key to set
-     * @param value The value to set
+     * @param value The value to set. A number is sent as the string that `String(value)` returns.
      * @param pxat Set the specified Unix time at which the key will expire, in milliseconds
      * @returns Promise that resolves with "OK" on success
      */
     set(
       key: RedisClient.KeyLike,
-      value: RedisClient.KeyLike,
+      value: RedisClient.KeyLike | number,
       pxat: "PXAT",
       timestampMilliseconds: number,
     ): Promise<"OK">;
 
     /**
      * Set key to hold the string value only if key does not exist
      * @param key The key to set
-     * @param value The value to set
+     * @param value The value to set. A number is sent as the string that `String(value)` returns.
      * @param nx Only set the key if it does not already exist
      * @returns Promise that r
```

**File**: `src/runtime/node.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ pub(crate) mod assert {
 #[path = "node/types.rs"]
 pub(crate) mod types;
 pub(crate) use types::{
-    BlobOrStringOrBuffer, Dirent, Encoding, FileBlobs, PathLike, PathOrBlob, PathOrFileDescriptor,
+    BlobOrStringOrBuffer, Dirent, Encoding, PathLike, PathOrBlob, PathOrFileDescriptor,
     StringObjects, StringOrBuffer, ThreadIsolated,
 };
 
```

**File**: `src/runtime/node/types.rs` (modified, +2/-21)
```diff
@@ -80,17 +80,6 @@ pub(crate) enum StringObjects {
     Reject,
 }
 
-/// What [`BlobOrStringOrBuffer`] parsing does with a file-backed `Blob`
-/// (`Bun.file(..)`). Nothing here reads the file: an allowed one is returned
-/// as [`BlobOrStringOrBuffer::Blob`] like an in-memory blob, and its `slice()`
-/// is empty.
-#[derive(Copy, Clone, PartialEq, Eq)]
-pub(crate) enum FileBlobs {
-    Allow,
-    /// Throws "File blob cannot be used here".
-    Reject,
-}
-
 // ──────────────────────────────────────────────────────────────────────────
 
 pub(crate) enum BlobOrStringOrBuffer {
@@ -112,10 +101,9 @@ impl BlobOrStringOrBuffer {
         }
     }
 
-    pub(crate) fn from_js_maybe_file(
+    pub(crate) fn from_js(
         global: &JSGlobalObject,
         value: JSValue,
-        file_blobs: FileBlobs,
     ) -> JsResult<Option<BlobOrStringOrBuffer>> {
         // Check StringOrBuffer first because it's more common and cheaper.
         if let Some(str) = StringOrBuffer::from_js(global, value)? {
@@ -124,21 +112,14 @@ impl BlobOrStringOrBuffer {
         let Some(blob) = value.as_class_ref::<Blob>() else {
             return Ok(None);
         };
-        if file_blobs == FileBlobs::Reject && blob.needs_to_read_file() {
+        if blob.needs_to_read_file() {
             return Err(
                 global.throw_invalid_arguments(format_args!("File blob cannot be used here"))
             );
         }
         Ok(Some(Self::Blob(Box::new(blob.dupe()))))
     }
 
-    pub(crate) fn from_js(
-        global: &JSGlobalObject,
-        value: JSValue,
-    ) -> JsResult<Option<BlobOrStringOrBuffer>> {
-        Self::from_js_maybe_file(global, value, FileBlobs::Reject)
-    }
-
     pub(crate) fn from_js_with_encoding_value_allow_request_response(
         global: &JSGlobalObject,
         value: JSValue,
```

**File**: `src/runtime/valkey_jsc/js_valkey_functions.rs` (modified, +154/-48)
```diff
@@ -1,6 +1,8 @@
-use crate::node::{BlobOrStringOrBuffer as JSArgument, FileBlobs, StringOrBuffer};
+use crate::node::{BlobOrStringOrBuffer as JSArgument, StringOrBuffer};
+use crate::webcore::Blob;
 use bun_collections::VecExt as _;
 use bun_collections::smallvec::SmallVec;
+use bun_core::Utf8Bytes;
 use bun_jsc::bindgen::{JsLocal, JsScope, JsWrapper};
 use bun_jsc::{
     self as jsc, ErrorCode, JSGlobalObject, JSPromise, JSPropertyIterator, JSValue, JsResult,
@@ -51,14 +53,18 @@ fn require_subscriber(this: &JSValkeyClient, function_name: &str) -> JsResult<()
 }
 
 fn from_js(global: &JSGlobalObject, value: JSValue) -> JsResult<Option<JSArgument>> {
+    if value.is_string_literal() {
+        return JSArgument::from_js(global, value);
+    }
+
     if value.is_undefined_or_null() {
         return Ok(None);
     }
 
     if value.is_number() {
         // Allow numbers to be passed as strings.
         let str = value.to_js_string(global)?;
-        return JSArgument::from_js_maybe_file(global, str.to_js(), FileBlobs::Reject);
+        return JSArgument::from_js(global, str.to_js());
     }
 
     // Copy the bytes. A later argument's `toString()` can detach this buffer before the command is serialized.
@@ -71,7 +77,76 @@ fn from_js(global: &JSGlobalObject, value: JSValue) -> JsResult<Option<JSArgumen
         ))));
     }
 
-    JSArgument::from_js_maybe_file(global, value, FileBlobs::Allow)
+    match JSArgument::from_js(global, value) {
+        Ok(Some(JSArgument::Blob(blob))) if blob.is_s3() => {
+            Err(global.throw_invalid_arguments(format_args!("S3 blob cannot be used here")))
+        }
+        arg => arg,
+    }
+}
+
+/// An argument of a hash write: buffers and Blobs as bytes, anything else as `String(value)`.
+#[inline(always)]
+fn bytes_or_text(global: &JSGlobalObject, value: JSValue) -> JsResult<Utf8Bytes<'static>> {
+    if value.is_object() {
+        return object_bytes_or_text(global, value);
+    }
+    value.to_utf8(global)
+}
+
+#[inline(always)]
+fn required_bytes_or_text(
+    global: &JSGlobalObject,
+    value: JSValue,
+    method: &'static str,
+    field: &'static str,
+    expected: &'static str,
+) -> JsResult<Utf8Bytes<'static>> {
+    if value.is_undefined_or_null() {
+        return Err(global.throw_invalid_argument_type(method, field, expected));
+    }
+    bytes_or_text(global, value)
+}
+
+#[inline(never)]
+fn object_bytes_or_text(global: &JSGlobalObject, value: JSValue) -> JsResult<Utf8Bytes<'static>> {
+    let ty = value.js_type();
+    let typed_array = ty.is_typed_array_or_array_buffer() && ty != jsc::JSType::ArrayBuffer;
+    match from_js(global, value)? {
+        // `String(value)` throws for one that is detached or out of bounds.
+        Some(arg) if typed_array && arg.slice().is_empty() => value.to_utf8(global),
+        Some(JSArgument::StringOrBuffer(StringOrBuffer::Utf8(bytes))) => Ok(bytes),
+        Some(arg) => Ok(Utf8Bytes::Owned(arg.slice().to_vec())),
+        None => value.to_utf8(global),
+    }
+}
+
+/// What follows a nullish option is not sent. That is fine for the `ttl` of `ttl ? "EX" : undefined, ttl`.
+#[cold]
+fn refuse_to_drop_set_option(global: &JSGlobalObject, dropped: &[JSValue]) -> JsResult<()> {
+    const OPTIONS: [&[u8]; 12] = [
+        b"NX", b"XX", b"GET", b"KEEPTTL", b"EX", b"PX", b"EXAT", b"PXAT", b"IFEQ", b"IFNE",
+        b"IFDEQ", b"IFDNE",
+    ];
+    for arg in dropped.iter().filter(|arg| arg.is_string_literal()) {
+        let text = arg.to_utf8(global)?;
+        if let Some(option) = OPTIONS.iter().find(|it| it.eq_ignore_ascii_case(&text)) {
+            return Err(global.throw_invalid_arguments(format_args!(
+                "set() cannot send {} after a null or undefined argument",
+                bstr::BStr::new(option)
+            )));
+        }
+    }
+    Ok(())
+}
+
+fn trim_nullish_end(mut values: &[JSValue]) -> &[JSValue] {
+    while let [rest @ .., last] = values
+        && last.is_undefined_or_null()
+    {
+        values = rest;
+    }
+    values
 }
 
 // ──────────────────────────────────────────────────────────────────────────
@@ -99,6 +174,8 @@ enum Varargs {
     Strict,
     /// `null` and `undefined` are left out, after a required first argument of this name.
     KeyThenSkipNullish(&'static str),
+    /// The same first argument. `null` and `undefined` are left out at the end and throw ahead of another argument.
+    KeyThenTrimNullish(&'static str),
 }
 
 /// The arguments after a key, without `null` and `undefined`.
@@ -158,18 +235,23 @@ impl JSValkeyClient {
         command: &Command<Varargs>,
         values: &[JsLocal<'_>],
     ) -> JsResult<JSValue> {
-        let values = JsLocal::to_js_slice(values);
+        let mut values = JsLocal::to_js_slice(values);
         command.check_state(self)?;
 
-        if let Varargs::KeyThenSkipNullish(name) = command.args
+        if let Varargs::KeyThenSkipNullish(name) | Varargs::KeyThenTrimNullish(name) = command.args
             && 
```

**File**: `src/runtime/valkey_jsc/valkey.bind.ts` (modified, +1/-0)
```diff
@@ -81,6 +81,7 @@ const commands: Record<string, readonly [args: readonly string[], length: number
   incr: [["key"], 1],
   incrby: [["key", "increment"], 2],
   incrbyfloat: [["key", "increment"], 2],
+  increx: [["...args"], 1],
   info: [["...args"], 0],
   keys: [["pattern"], 0],
   lastsave: [[], 0],
```

**File**: `test/integration/bun-types/fixture/redis.ts` (modified, +176/-0)
```diff
@@ -1,7 +1,16 @@
+import { spyOn } from "bun:test";
 import { expectType } from "./utilities";
 
 expectType(Bun.redis.publish("hello", "world")).is<Promise<number>>();
 
+// The constructor takes the URL as a string or as a `URL` object.
+expectType(new Bun.RedisClient("redis://localhost:6379")).is<Bun.RedisClient>();
+expectType(new Bun.RedisClient(new URL("redis://localhost:6379"))).is<Bun.RedisClient>();
+expectType(new Bun.RedisClient(new URL("rediss://localhost:6380/2"), { maxRetries: 5 })).is<Bun.RedisClient>();
+expectType(new Bun.RedisClient(undefined, { autoReconnect: false })).is<Bun.RedisClient>();
+// @ts-expect-error - a number is not a URL
+new Bun.RedisClient(6379);
+
 const copy = await Bun.redis.duplicate();
 expectType(copy.connected).is<boolean>();
 expectType(copy).is<Bun.RedisClient>();
@@ -34,6 +43,7 @@ const redis = Bun.redis;
 const buf = Buffer.from("key");
 
 // Bitmap
+expectType(redis.spublish("channel", 1)).is<Promise<number>>();
 expectType(redis.bitop("NOT", "dest", "k1")).is<Promise<number>>();
 expectType(redis.bitop("not", "dest", buf)).is<Promise<number>>();
 expectType(redis.bitop("AND", "dest", "k1")).is<Promise<number>>();
@@ -105,6 +115,71 @@ expectType(redis.config("GET", "maxmemory")).is<Promise<any>>();
 expectType(redis.debug("OBJECT", "k")).is<Promise<any>>();
 expectType(redis.command("COUNT")).is<Promise<any>>();
 
+// Raw commands: `send` takes each kind of argument that the client sends, in an array that it only reads.
+expectType(redis.send("PING", [])).is<Promise<any>>();
+redis.send("SET", ["k", "v"]);
+redis.send("SET", ["k", 0, "EX", 60]);
+redis.send("SET", [buf, new Uint8Array(1)]);
+redis.send("VSIM", ["docs", "FP32", new Float32Array(3), "COUNT", 5]);
+redis.send("SET", ["k", new DataView(new ArrayBuffer(1))]);
+redis.send("SET", ["k", new ArrayBuffer(1)]);
+redis.send("SET", ["k", new SharedArrayBuffer(1)]);
+redis.send("SET", ["k", new Blob(["v"])]);
+// A value that the other methods take as `RedisClient.KeyLike` is also an element of `args`.
+declare const keyLike: Bun.RedisClient.KeyLike;
+redis.send("DEL", [keyLike]);
+const readonlyArgs: readonly string[] = ["k", "v"];
+redis.send("SET", readonlyArgs);
+const tupleArgs = ["k", 0, "EX", 60] as const;
+redis.send("SET", tupleArgs);
+redis.send("SET", Object.freeze(["k", "v"]));
+// `send` has one signature, so code typed from its parameter sees each kind that the client sends.
+expectType<Parameters<Bun.RedisClient["send"]>[1]>().is<
+  readonly (string | number | NodeJS.TypedArray | DataView<ArrayBufferLike> | ArrayBufferLike | Blob)[]
+>();
+// A fake, an override and a bun:test mock of `send` can keep `string[]` for the arguments that they read.
+const fakeSend: Pick<Bun.RedisClient, "send"> = { send: async (command, args: string[]) => args.join(" ") };
+class StringSender extends Bun.RedisClient {
+  override send(command: string, args: string[]): Promise<any> {
+    return super.send(command, args);
+  }
+}
+spyOn(redis, "send").mockImplementation(async (command, args: string[]) => args.join(" "));
+// @ts-expect-error - a bigint throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", 10n]);
+// @ts-expect-error - a boolean throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", true]);
+// @ts-expect-error - null throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", null]);
+// @ts-expect-error - undefined throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", undefined]);
+// @ts-expect-error - a nested array throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", ["v"]]);
+// @ts-expect-error - a plain object throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", {}]);
+// @ts-expect-error - an object with the members of the lib `ArrayBufferView` throws ERR_INVALID_ARG_TYPE
+redis.send("SET", ["k", { buffer: new ArrayBuffer(1), byteLength: 1, byteOffset: 0 }]);
+// @ts-expect-error - a Set throws "Arguments must be an array"
+redis.send("SET", new Set(["k", "v"]));
+// @ts-expect-error - a string throws "Arguments must be an array"
+redis.send("SET", "k");
+// @ts-expect-error - a call with no `args` throws "Arguments must be an array"
+redis.send("PING");
+
+expectType(redis.publish("ch", 1)).is<Promise<number>>();
+expectType(redis.publish("ch", buf)).is<Promise<number>>();
+expectType(redis.publish("ch", new ArrayBuffer(1))).is<Promise<number>>();
+// @ts-expect-error - the channel is a string
+redis.publish(buf, "m");
+expectType(redis.hincrby("k", buf, 1)).is<Promise<number>>();
+expectType(redis.hincrbyfloat("k", buf, 1.5)).is<Promise<string>>();
+expectType(redis.increx("k")).is<Promise<[number, number]>>();
+expectType(redis.increx("k", "BYINT", 5, "EX", 60)).is<Promise<[number, number]>>();
+expectType(redis.zrange("z", 0, -1, "REV")).is<Promise<string[]>>();
+expectType(redis.zrange("z", 0, -1, "REV", "WITHSCORES")).is<Promise<[string, number][]>>();
+expectType(redis.zrangebyscore("z", 0, 9, "LIMIT", 0, 5, "WITHSCORES")).is<Promise<[string, number][]>>();
+expectType(redis.zrevrangebyscore(
```

**File**: `test/js/valkey/reliability/error-handling.test.ts` (modified, +124/-7)
```diff
@@ -1,4 +1,4 @@
-import { randomUUIDv7, RedisClient } from "bun";
+import { randomUUIDv7, RedisClient, S3Client } from "bun";
 import { beforeEach, describe, expect, test } from "bun:test";
 import { ConnectionType, createClient, ctx, isEnabled, readCommands } from "../test-utils";
 
@@ -285,18 +285,19 @@ describe.skipIf(!isEnabled)("Valkey: Error Handling", () => {
 
 describe("Valkey: Command Arguments", () => {
   type Call = [method: string, ...args: unknown[]];
-  const show = (arg: unknown) => (arg instanceof String ? `new String("${arg}")` : Bun.inspect(arg));
+  const show = (arg: unknown) => (arg instanceof String ? `new String("${arg}")` : Bun.inspect(arg, { compact: true }));
   const title = ([method, ...args]: Call) => `${method}(${args.map(show).join(", ")})`;
   const run = (client: RedisClient, [method, ...args]: Call) => (client as any)[method](...args);
 
-  /** A client of a server that acknowledges SUBSCRIBE, answers GET with "v" and anything else with 1. */
-  async function connect() {
+  /** A client of a server that acknowledges SUBSCRIBE, has the replies below and answers anything else with 1. */
+  async function connect(url = (port: number): string | URL => `redis://127.0.0.1:${port}`) {
     const received: string[][] = [];
     const state = { buffer: Buffer.alloc(0) };
     const replies: Record<string, string> = {
       HELLO: "+OK\r\n",
       SUBSCRIBE: ">3\r\n$9\r\nsubscribe\r\n$2\r\nch\r\n:1\r\n",
       GET: "$1\r\nv\r\n",
+      SELECT: "+OK\r\n",
     };
     const server = Bun.listen({
       hostname: "127.0.0.1",
@@ -311,10 +312,11 @@ describe("Valkey: Command Arguments", () => {
         },
       },
     });
-    const client = new RedisClient(`redis://127.0.0.1:${server.port}`);
+    const client = new RedisClient(url(server.port));
     await client.connect();
     return {
       client,
+      received,
       lastReceived: () => received.at(-1),
       [Symbol.dispose]() {
         client.close();
@@ -341,12 +343,61 @@ describe("Valkey: Command Arguments", () => {
     { call: ["lpush", "k", "a", undefined, "b"], sends: ["LPUSH", "k", "a", "b"], resolves: 1 },
     { call: ["del", "a", null, "b"], sends: ["DEL", "a", "b"], resolves: 1 },
     { call: ["sadd", "k", "a", null, "b"], sends: ["SADD", "k", "a", "b"], resolves: 1 },
+    { call: ["srem", "k", "a", "b"], sends: ["SREM", "k", "a", "b"], resolves: 1 },
     { call: ["srem", "k", undefined, "a", "b"], sends: ["SREM", "k", "a", "b"], resolves: 1 },
     { call: ["spop", "k"], sends: ["SPOP", "k"], resolves: 1 },
     { call: ["srandmember", "k", 2, 3], sends: ["SRANDMEMBER", "k", "2"], resolves: 1 },
     { call: ["hincrby", "k", false, new Number(2)], sends: ["HINCRBY", "k", "false", "2"], resolves: 1 },
     { call: ["hincrbyfloat", "k", "f", 1.5], sends: ["HINCRBYFLOAT", "k", "f", "1.5"], resolves: 1 },
     { call: ["publish", new String("ch"), "m"], sends: ["PUBLISH", "ch", "m"], resolves: 1 },
+    { call: ["publish", "ch", Buffer.of(0xff, 0)], sends: ["PUBLISH", "ch", "\xff\0"], resolves: 1 },
+    { call: ["publish", "ch", new Blob(["m"])], sends: ["PUBLISH", "ch", "m"], resolves: 1 },
+    { call: ["publish", "ch", 1], sends: ["PUBLISH", "ch", "1"], resolves: 1 },
+    { call: ["set", "k", "v", "NX", undefined, null], sends: ["SET", "k", "v", "NX"], resolves: 1 },
+    { call: ["set", "k", new Blob(["v"])], sends: ["SET", "k", "v"], resolves: 1 },
+    { call: ["set", "k", new Blob([])], sends: ["SET", "k", ""], resolves: 1 },
+    { call: ["hmget", "k", "a", "b", undefined], sends: ["HMGET", "k", "a", "b"], resolves: 1 },
+    { call: ["mget", "a", "b", null, undefined], sends: ["MGET", "a", "b"], resolves: 1 },
+    { call: ["zmscore", "k", "a", undefined], sends: ["ZMSCORE", "k", "a"], resolves: 1 },
+    { call: ["set", "k", "v", undefined, "0"], sends: ["SET", "k", "v"], resolves: 1 },
+    { call: ["set", "k", "v", undefined, ""], sends: ["SET", "k", "v"], resolves: 1 },
+    { call: ["set", "k", "v", "EX", 60, null, "old value"], sends: ["SET", "k", "v", "EX", "60"], resolves: 1 },
+    { call: ["hincrby", "k", "f", Uint8Array.of(5)], sends: ["HINCRBY", "k", "f", "5"], resolves: 1 },
+    { call: ["set", "k", "v", undefined, 0], sends: ["SET", "k", "v"], resolves: 1 },
+    { call: ["set", "k", "v", undefined, false], sends: ["SET", "k", "v"], resolves: 1 },
+    { call: ["set", "k", "v", undefined, NaN], sends: ["SET", "k", "v"], resolves: 1 },
+    { call: ["hscan", "k", 0, undefined, null, "COUNT", 9], sends: ["HSCAN", "k", "0", "COUNT", "9"], resolves: 1 },
+    { call: ["zrank", "k", "a", undefined, "WITHSCORE"], sends: ["ZRANK", "k", "a", "WITHSCORE"], resolves: 1 },
+    { call: ["zrevrank", "k", "a", undefined, "WITHSCORE"], sends: ["ZREVRANK", "k", "a", "WITHSCORE"], resolves: 1 },
+    { call: ["hrandfield", "k", undefined, 2], sends: ["HRANDFIELD", "k", "2"], resolves: 1 },
+    { call: ["zrandmember", "k", undefined, 2], sends: ["ZRANDMEMBER", "k", "2"], resolves: 1 },
+    {
```

---

### Incident Patch 3: `f19207c6` (2026-11-23)
**Commit Message**: blob: five fixes to Bun.file() reads, Bun.write() and file copies (#49316)

Last of five that replace #49167.

Fixes #44387.

### What does this PR do?

| | before | after | test |
| --- | --- | --- | --- |
| Linux: write to a pipe whose reader left | errno 0 | `EPIPE` |
`bun-write` |
| empty slice of a silent pipe by descriptor, or of a terminal | waits |
resolves | `bun-file-fd-read` |
| Linux: `Bun.write(fd)` over 1 KiB, `O_APPEND` | NUL bytes before the
data | appends (+1 `fcntl`) | `bun-write` |
| cancelled read of `/dev/zero` | runs to its end | stops |
`module-graph-io` (`dispose()` only) |

Seen only with injected system call results: a copy from a file with a
negative `st_size` does not abort, and a failed `F_GETFL` is not taken
for flags.

#49146 fixed the copy to a 4,096-byte path. Its test is here.

Also: `BUN_DEBUG_loop` is `BUN_DEBUG_FdWait` for this thread. #37852 and
#47375 (both closed) fixed the first two in deleted functions.

**Kept as is**

- A write to a full, non-blocking, never stat'ed pipe spins (#35953
fixed it, and is closed).
- Closing a descriptor during a wait never settles.
- Two waits on one descriptor: epoll rejects the second, kqueue forgets
the fi

**File**: `src/io/fd_wait.rs` (modified, +33/-15)
```diff
@@ -15,7 +15,7 @@ use tests::{epoll_ctl, epoll_del};
 
 use crate::Waker;
 
-bun_core::define_scoped_log!(log, Loop, visible);
+bun_core::define_scoped_log!(log, FdWait, hidden);
 
 #[derive(Clone, Copy, Debug)]
 pub enum Interest {
@@ -147,6 +147,14 @@ impl<J: Waiter> Parking<J> {
             poller.send(NonNull::from(self));
         }
     }
+
+    #[inline]
+    pub fn check_cancelled(&self, wait: &FdWait) -> sys::Result<()> {
+        match self.armed.is_closed() {
+            true => Err(wait.interest.cancelled()),
+            false => Ok(()),
+        }
+    }
 }
 
 /// Has the poller while the job is in its table. The event and the cancel both want to end the
@@ -269,10 +277,7 @@ impl<J: Waiter> LazyPoller<J> {
     /// Pool thread. Refuses a job that is cancelled.
     pub fn admit(&self, parking: &Parking<J>, wait: &FdWait) -> sys::Result<&'static Poller<J>> {
         let poller = (self.running.get().copied()).map_or_else(|| self.start(), Ok)?;
-        match parking.armed.is_closed() {
-            true => Err(wait.interest.cancelled()),
-            false => Ok(poller),
-        }
+        parking.check_cancelled(wait).map(|()| poller)
     }
 
     /// If it fails, the next call retries.
@@ -328,7 +333,7 @@ impl<J: Waiter> IoThread<J> {
                     let added = self.kernel.add(job.wait(), key);
                     self.armed.insert(key, job);
                     if let Err(err) = added {
-                        self.fire(key, Err(err));
+                        self.fire(key, |_| Err(err));
                     }
                 }
                 Request::Disarm(armed) => {
@@ -344,11 +349,13 @@ impl<J: Waiter> IoThread<J> {
     }
 
     /// The kernel reported `key`. If `cancel` was faster, its request ends the wait.
-    fn fire(&mut self, key: Key, outcome: sys::Result<()>) {
+    fn fire(&mut self, key: Key, outcome: impl FnOnce(&FdWait) -> sys::Result<()>) {
         if let hash_map::Entry::Occupied(found) = self.armed.entry(key)
             && found.get().parking().armed.take(self.poller)
         {
-            Self::wake(found.remove(), outcome);
+            let mut job = found.remove();
+            let outcome = outcome(job.wait());
+            Self::wake(job, outcome);
         }
     }
 
@@ -472,17 +479,28 @@ impl<J: Waiter> IoThread<J> {
                 e => bun_core::Output::panic(format_args!("epoll_wait: {:?}", e)),
             }
             for event in &events[..rc as usize] {
-                // EPOLLERR carries no errno, and reading SO_ERROR would clear it on the caller's socket.
-                let outcome = match event.events & EPOLL::ERR {
+                self.fire(Key(event.u64), |wait| match event.events & EPOLL::ERR {
                     0 => Ok(()),
-                    _ => Err(sys::Error::from_code(E::SUCCESS, sys::Tag::epoll_ctl)),
-                };
-                self.fire(Key(event.u64), outcome);
+                    _ => Err(pending_error(wait)),
+                });
             }
         }
     }
 }
 
+/// EPOLLERR carries no errno, and reading SO_ERROR would clear it on the caller's socket.
+#[cfg(any(all(not(test), target_os = "linux"), target_os = "android"))]
+#[cold]
+fn pending_error(wait: &FdWait) -> sys::Error {
+    if matches!(wait.interest, Interest::Writable)
+        && sys::fstat(wait.fd()).is_ok_and(|stat| sys::S::ISFIFO(stat.st_mode as _))
+    {
+        sys::Error::from_code(E::EPIPE, sys::Tag::write)
+    } else {
+        sys::Error::from_code(E::SUCCESS, sys::Tag::epoll_ctl)
+    }
+}
+
 // ─── kqueue ──────────────────────────────────────────────────────────────────
 
 #[cfg(target_os = "freebsd")]
@@ -601,7 +619,7 @@ impl<J: Waiter> IoThread<J> {
                     0 => Ok(()),
                     _ => Err(sys::Error::from_code_int(event.data as _, sys::Tag::kevent)),
                 };
-                self.fire(Key(event.udata as u64), outcome);
+                self.fire(Key(event.udata as u64), |_| outcome);
             }
         }
     }
@@ -694,7 +712,7 @@ mod tests {
     }
 
     fn fire(key: Key, outcome: sys::Result<()>) {
-        on_io_thread(|thread| thread.fire(key, outcome));
+        on_io_thread(|thread| thread.fire(key, |_| outcome));
     }
 
     fn ready(fd: i32) {
```

**File**: `src/runtime/webcore/blob/copy_file.rs` (modified, +3/-4)
```diff
@@ -213,7 +213,7 @@ impl CopyFile {
         let mut max_length = self.max_length;
         // BSD fstat on a pipe reports bytes currently buffered in st_size;
         // only a regular-file st_size is a length.
-        if stat.st_size != 0 && bun_sys::S::ISREG(mode) {
+        if stat.st_size > 0 && bun_sys::S::ISREG(mode) {
             max_length = (size_of_file(stat).min(max_length)).saturating_sub(self.offset);
             if max_length == 0 {
                 return Ok(0);
@@ -348,14 +348,13 @@ impl CopyFile {
 
 #[cfg(not(windows))]
 fn size_of_file(stat: &Stat) -> SizeType {
-    SizeType::try_from(stat.st_size).expect("int cast")
+    stat.st_size.max(0) as SizeType
 }
 
 /// Whether it was set.
 #[cfg(any(target_os = "linux", target_os = "android"))]
 fn clear_append(fd: Fd) -> bool {
-    // SAFETY: F_GETFL takes no pointer.
-    let flags = unsafe { libc::fcntl(fd.native(), libc::F_GETFL, 0) };
+    let flags = bun_sys::get_fcntl_flags(fd).unwrap_or(0) as i32;
     if flags & bun_sys::O::APPEND == 0 {
         return false;
     }
```

**File**: `src/runtime/webcore/blob/fd_job.rs` (modified, +16/-8)
```diff
@@ -15,6 +15,8 @@ pub(crate) enum Step {
     Done,
     /// Call again when the descriptor is ready.
     Wait,
+    /// Call again now, unless the job was cancelled.
+    Again,
 }
 
 pub(crate) trait FdOp: Send + Sized + 'static {
@@ -87,14 +89,20 @@ impl<Op: FdOp> FdJob<Op> {
         Job::<Self>::schedule(cx, Self { op, result: Ok(()) }, js);
     }
 
-    fn advance(job: Running<Self>, wait: FdWait, step: Result<Step, Box<SystemError>>) {
-        let result = match step {
-            Ok(Step::Done) => Ok(()),
-            Ok(Step::Wait) => match POLLER.admit(job.shared(), &wait) {
-                Ok(poller) => return poller.park(Parked(job.suspend((wait, Ok(()))))),
-                Err(err) => Err(err.into()),
-            },
-            Err(err) => Err(err),
+    fn advance(mut job: Running<Self>, wait: FdWait, mut step: Result<Step, Box<SystemError>>) {
+        let result = loop {
+            step = match step {
+                Ok(Step::Done) => break Ok(()),
+                Ok(Step::Wait) => match POLLER.admit(job.shared(), &wait) {
+                    Ok(poller) => return poller.park(Parked(job.suspend((wait, Ok(()))))),
+                    Err(err) => break Err(err.into()),
+                },
+                Ok(Step::Again) => match job.shared().check_cancelled(&wait) {
+                    Ok(()) => job.off().op.step(wait.fd(), false),
+                    Err(err) => break Err(err.into()),
+                },
+                Err(err) => break Err(err),
+            };
         };
         drop(wait);
         Self::finish(job, result);
```

**File**: `src/runtime/webcore/blob/read_file.rs` (modified, +14/-5)
```diff
@@ -257,8 +257,12 @@ impl FdOp for ReadFile {
         if expected == 0 && bun_sys::is_regular_file(self.cached_mode) {
             return Ok((fd, Step::Done));
         }
-        // An empty read waits like any other.
-        if self.max_length == 0 && self.must_wait(fd.get()) {
+        // Opening a FIFO lets its writer go on, and closing it at once would break that pipe.
+        if self.max_length == 0
+            && matches!(fd, JobFd::Opened(_))
+            && bun_sys::S::ISFIFO(stat.st_mode as _)
+            && self.must_wait(fd.get())
+        {
             return Ok((fd, Step::Wait));
         }
         if !self.could_block || expected > 0 {
@@ -271,26 +275,31 @@ impl FdOp for ReadFile {
         Ok((fd, step))
     }
 
-    fn step(&mut self, fd: Fd, mut ready: bool) -> Result<Step, Box<SystemError>> {
+    fn step(&mut self, fd: Fd, ready: bool) -> Result<Step, Box<SystemError>> {
         let mut stack_buffer = [const { MaybeUninit::uninit() }; 64 * 1024];
         loop {
             let max = (self.max_length as usize).saturating_sub(self.buffer.len());
             if max == 0 {
                 break;
             }
-            if !core::mem::take(&mut ready) && self.must_wait(fd) {
+            if !ready && self.must_wait(fd) {
                 return Ok(Step::Wait);
             }
             match self.read_some(fd, max, &mut stack_buffer) {
                 Ok(0) => break,
+                // It may never end.
+                Ok(_) if self.could_block => return Ok(Step::Again),
                 Ok(_) => {}
                 Err(err) if err.get_errno() != bun_sys::E::EAGAIN => {
                     self.buffer = Vec::new();
                     let mut err = Box::<SystemError>::from(err);
                     err.path = self.path_for_error();
                     return Err(err);
                 }
-                Err(_) => self.could_block = true,
+                Err(_) => {
+                    self.could_block = true;
+                    return Ok(Step::Again);
+                }
             }
         }
         if self.buffer.len() + 16_000 < self.buffer.capacity() {
```

**File**: `src/runtime/webcore/blob/write_file.rs` (modified, +7/-1)
```diff
@@ -77,7 +77,13 @@ impl FdOp for WriteFile {
 
         #[cfg(any(target_os = "linux", target_os = "android"))]
         if !self.could_block && self.range.len() > 1024 {
-            let _ = sys::preallocate_file(fd.get().native(), 0, self.range.len() as i64);
+            // Preallocating grows the file, and O_APPEND writes after its end.
+            let appends = pathlike.is_fd()
+                && sys::get_fcntl_flags(fd.get())
+                    .is_ok_and(|flags| flags as i32 & sys::O::APPEND != 0);
+            if !appends {
+                let _ = sys::preallocate_file(fd.get().native(), 0, self.range.len() as i64);
+            }
         }
         let step = self.step(fd.get(), false)?;
         Ok((fd, step))
```

**File**: `test/js/bun/io/bun-write.test.js` (modified, +56/-0)
```diff
@@ -1818,6 +1818,33 @@ it.skipIf(isWindows)("Bun.write() goes on each time a pipe has room", async () =
   expect(drained + drain(fifo.reader)).toBe(9 * room);
 });
 
+it.skipIf(isWindows).each([
+  ["a Blob", new Blob([Buffer.alloc(2000, "a")]), 2000],
+  ["a large Buffer", Buffer.alloc(300 * 1024, "a"), 300 * 1024],
+])("Bun.write(Bun.file(fd), %s) appends right after the end of a file opened with O_APPEND", async (_, data, size) => {
+  using dir = tempDir("bun-write-append", { log: "first\n" });
+  const log = join(String(dir), "log");
+  const fd = fs.openSync(log, "a");
+  try {
+    expect(await Bun.write(Bun.file(fd), data)).toBe(size);
+  } finally {
+    fs.closeSync(fd);
+  }
+  const written = fs.readFileSync(log);
+  expect({ size: written.length, firstNul: written.indexOf(0) }).toEqual({ size: 6 + size, firstNul: -1 });
+});
+
+it.skipIf(!isLinux).each([true, false])(
+  "a copy to a path of 4096 bytes is ENAMETOOLONG, createPath: %p",
+  async createPath => {
+    using dir = tempDir("bun-write-long-path", { from: "hello" });
+    const to = (String(dir) + Buffer.alloc(3800, "/" + "a".repeat(99)).toString() + "/").padEnd(4096, "b");
+    const destination = await (await fetch("file://" + to)).blob();
+    const error = await Bun.write(destination, Bun.file(join(String(dir), "from")), { createPath }).catch(e => e);
+    expect({ code: error.code, path: error.path }).toEqual({ code: "ENAMETOOLONG", path: to });
+  },
+);
+
 describe.skipIf(!isLinux).concurrent("Bun.write() to a pipe that is full", () => {
   const data = new Blob([Buffer.alloc(1 << 20, "a")]);
   /** `.size` makes the file find out that it is not a regular one. */
@@ -1827,6 +1854,35 @@ describe.skipIf(!isLinux).concurrent("Bun.write() to a pipe that is full", () =>
     return file;
   }
 
+  // EPOLLERR
+  it("rejects with EPIPE when the reader leaves", async () => {
+    using dir = tempDir("bun-write-pipe", {});
+    using fifo = openFifo(String(dir));
+    const write = Bun.write(knownPipe(fifo.writer), data).catch(({ code, syscall }) => ({ code, syscall }));
+    await untilWatched(fifo.writer);
+    fifo.close(fifo.reader);
+    expect(await write).toEqual({ code: "EPIPE", syscall: "write" });
+  });
+
+  it("rejects with EPIPE when the reader leaves after it has read some", async () => {
+    using dir = tempDir("bun-write-pipe", {});
+    using fifo = openFifo(String(dir));
+    const write = Bun.write(knownPipe(fifo.writer), data).catch(({ code, syscall }) => ({ code, syscall }));
+    await untilWatched(fifo.writer);
+    const page = Buffer.alloc(65536);
+    for (let read = 0; read < 3 * page.length;) {
+      try {
+        read += fs.readSync(fifo.reader, page);
+      } catch (error) {
+        if (error.code !== "EAGAIN") throw error;
+        await Bun.sleep(1);
+      }
+    }
+    await untilWatched(fifo.writer);
+    fifo.close(fifo.reader);
+    expect(await write).toEqual({ code: "EPIPE", syscall: "write" });
+  });
+
   // The capacity of a pipe is fixed on Linux.
   it("waits for room after the last byte", async () => {
     using dir = tempDir("bun-write-pipe", {});
```

**File**: `test/js/bun/module-graph/module-graph-io.test.ts` (modified, +21/-1)
```diff
@@ -2,7 +2,7 @@
 // for timers and I/O: what its code opens belongs to it, and dispose() closes all of it.
 import { afterAll, describe, expect, test } from "bun:test";
 import fs, { rmSync, writeFileSync } from "fs";
-import { bunEnv, bunExe, tempDir, tls } from "harness";
+import { bunEnv, bunExe, isLinux, tempDir, tls } from "harness";
 import { AsyncLocalStorage } from "node:async_hooks";
 import net from "node:net";
 import nodeTls from "node:tls";
@@ -1235,3 +1235,23 @@ describe.concurrent("ModuleGraph: a request through an Agent of the host's is st
     },
   );
 });
+
+// /proc/self/io counts what was read.
+test.skipIf(!isLinux)("dispose() stops a read of a device that always has more", async () => {
+  const size = 256 * 1024 * 1024;
+  const script = `
+    const { readFileSync } = require("node:fs");
+    const bytesRead = () => Number(/rchar: (\\d+)/.exec(readFileSync("/proc/self/io", "utf8"))[1]);
+    const graph = new Bun.ModuleGraph();
+    graph.run(() => void Bun.file("/dev/zero").slice(0, ${size}).bytes());
+    graph.dispose();
+    const before = bytesRead();
+    process.on("beforeExit", () => console.log(bytesRead() - before));
+  `;
+  await using proc = Bun.spawn({ cmd: [bunExe(), "-e", script], env: bunEnv, stdout: "pipe", stderr: "inherit" });
+  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);
+  expect(stdout).toMatch(/^\d+\n$/);
+  // One read() can be under way. The buffer doubles, so it is for half of the bytes at most.
+  expect(Number(stdout)).toBeLessThan(size * 0.75);
+  expect(exitCode).toBe(0);
+});
```

**File**: `test/js/bun/util/bun-file-fd-read.test.ts` (modified, +11/-1)
```diff
@@ -1,6 +1,6 @@
 import { dlopen, ptr } from "bun:ffi";
 import { describe, expect, test } from "bun:test";
-import { closeSync, openSync, readSync, renameSync, writeSync } from "fs";
+import { closeSync, existsSync, openSync, readSync, renameSync, writeSync } from "fs";
 import { bunEnv, bunExe, isLinux, isWindows, libcPathForDlopen, tempDir } from "harness";
 import { constants } from "os";
 import { join } from "path";
@@ -53,6 +53,16 @@ describe.skipIf(isWindows)("Bun.file(fd) read", () => {
   });
 });
 
+test.skipIf(isWindows)("an empty slice of a pipe that nobody writes to resolves", async () => {
+  using dir = tempDir("bun-file-fd-read", {});
+  using fifo = openFifo(String(dir));
+  expect(await Bun.file(fifo.reader).slice(0, 0).text()).toBe("");
+});
+
+test.skipIf(!isLinux || !existsSync("/dev/ptmx"))("an empty slice of a silent terminal resolves", async () => {
+  expect(await Bun.file("/dev/ptmx").slice(0, 0).text()).toBe("");
+});
+
 test.skipIf(!isLinux)("an empty read of a FIFO by path stays open until its writer has written", async () => {
   using dir = tempDir("bun-file-fd-read", {});
   using fifo = openFifo(String(dir));
```

#### Recent Merged Pull Requests:
- **PR #49521** (2026-11-23): Bun.diff: add ignoreCase, ignoreWhitespace and stripTrailingCr, and harden util.diff and bun pm diff (@alii)
- **PR #49517** (2026-11-23): Bun.diff.parsePatch: fix a throw for commit messages with a line of = or * (@alii)
- **PR #49504** (closed): install: use the dependency id sentinel for dependency ids (@robobun)
- **PR #49486** (2026-11-23): Bump WebKit: keep the cell state of an array that map() widens under --aot (@dylan-conway)
- **PR #49482** (2026-11-23): blob: a job that waits is a typed handle, and the IO thread keeps it by key (@alii)
- **PR #49480** (2026-11-23): Faster diffs: Bun.diff, bun pm diff, bun lint, expect, util.diff and node:assert (@alii)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. ipc: fifteen fixes to re-entry, handles and the lifetime of the channel

**RULE**:
When implementing operations in `src/js/builtins/Ipc.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `476428f3`: ipc: fifteen fixes to re-entry, handles and the lifetime of the channel. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/js/builtins/Ipc.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
 * @returns {(() => void) | undefined} what delivers the message now, once the caller has let go of `fd`
      return () => emit(target, serialized.msg, socket);
      if (err) throw new Error(`failed to open received dgram handle: ${err}`);
      return () => emit(target, serialized.msg, wrap);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
 * @param {unknown} handle
 * @param {(handle: Handle) => void} emit
 * @returns {void}
      emit(target, serialized.msg, socket);
      return;
      if (err) {
        // The wrap only owns the descriptor on success; don't leak it.
        require("node:fs").closeSync(fd);
        throw new Error(`failed to open received dgram handle: ${err}`);
      }
      emit(target, serialized.msg, wrap);
      return;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `476428f3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
