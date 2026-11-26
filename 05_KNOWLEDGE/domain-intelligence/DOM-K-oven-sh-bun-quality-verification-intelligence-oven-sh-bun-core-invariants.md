# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: oven-sh/bun Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh/bun",
  "source_url": "https://github.com/oven-sh/bun",
  "source_version": "e13b16bc",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T09:47:54.212Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oven-sh-bun",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh/bun](https://github.com/oven-sh/bun) (Revision: `e13b16bc`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T09:47:54.212Z`  
> **Learning ID**: `learn-github-oven-sh-bun`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), F (Design Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from oven-sh/bun:

# Forensic Learning Record (Deep Inspection): oven-sh/bun

> **Canonical Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T09:47:50.957Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96982 stars

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
- **Issue #49611** (2026-11-26): **macOS arm64: terminating or closing a Worker leaks 1 kqueue fd and 540,672 bytes (528 KiB) per Worker**
  *Symptoms*: ### What version of Bun is running? 1.3.14+0d9b296af  ### What platform is your computer? Darwin 25.5.0 arm64 arm (macOS Apple Silicon)  ### What steps can reproduce the bug? 1. Create a minimal file-backed worker `worker.js`: ```js self.onmessage = () => postMessage(1); ``` 2. Spawn and terminate (or self-close) N Workers sequentially in a single Bun process, then inspect the live process with `lsof -p <pid> | grep KQUEUE` and `heap -s <pid>`: ```js // repro.js const workerUrl = new URL("./worker.js", import.meta.url).href; for (let i = 0; i < 50; i++) {   const w = new Worker(workerUrl);   await new Promise(resolve => {     w.onmessage = resolve;     w.postMessage(0);   });   w.terminate(); } Bun.gc(true); await Bun.sleep(15000); ``` 3. Run `bun repro.js` and measure `KQUEUE` fds and `DefaultMallocZone` 528 KB blocks while sleeping.  ### What is the expected behavior? After a `Worker` finishes (via `worker.terminate()` or `self.close()` + `close` event + GC), its OS thread, `kqueue` fd, and event-loop allocation are all reclaimed. Both `KQUEUE` count and native heap size should return to baseline (or remain bounded).  ### What do you see instead? The OS thread exits, but **every single `Worker` permanently leaks exactly 1 `KQUEUE` fd and one 540,672-byte (528 KiB) allocation in `DefaultMallocZone`**. The leak grows linearly with total Workers created and is not reclaimed by `self.close()`, awaiting the `close` event, repeated `Bun.gc(true)`, or waiting several seconds. In l

- **Issue #49610** (2026-11-26): **bun:test: expect(p).rejects / .resolves on a promise that never settles spins at 100% CPU and ignores the test timeout**
  *Symptoms*: ### What version of Bun is running?  1.4.5 (a7733435c), also 1.4.4  ### What platform is your computer?  Darwin 25.4.0 arm64  ### What steps can reproduce the bug?  ```ts // repro.test.ts import { test, expect } from "bun:test";  test("never-settling promise", () => {   expect(new Promise(() => {})).rejects.toThrow(); }, 2000); ```  ```sh bun test ./repro.test.ts ```  ### What is the expected behavior?  The test fails after its 2 s timeout, like any other test whose promise never settles.  ### What do you see instead?  `bun test` never finishes and uses ~100% of a CPU core (98–99% in `ps`) until it is killed. The 2 s timeout never fires.  Same result with:  - `await expect(new Promise(() => {})).rejects.toThrow()` in an `async` test - `expect(new Promise(() => {})).resolves.toBe(1)`  For comparison, `await new Promise(() => {})` alone in a test with a 2000 ms timeout correctly fails with "this test timed out after 2000ms".  ### Additional information  It looks like the matcher waits for the promise synchronously in a busy loop, and the per-test timeout isn't checked inside that loop.  This hurt us in practice: a test whose code under test was half-written (a promise that never settled) spun for 11 hours of CPU before anyone noticed.  Related, closed issues that cover other cases of the same matcher: #14670 (Bun shell promise), #40949 (Promise subclass with an overridden `then`), #36828 and #46506 (NAPI promises). This one is a plain `Promise` that simply never settles.  (Opus

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

### Incident Patch 1: `2e321d89` (2026-11-25)
**Commit Message**: dns, core: do not panic when the OS has no random bytes to give (#49568)

### What does this PR do?

Bun panicked when `getrandom()` was refused (Linux before 3.17, a
seccomp filter) and `/dev/urandom` could not be opened, for example with
no file descriptor left. `os_entropy()` now returns whether it got the
bytes, on all platforms, and its two callers go on:

- A DNS query fails with `ECONNREFUSED`, as it does when it gets no
socket. The resolver is a caller since oven-sh/bun#49429.
- `fast_random()` (temporary names, the bundler's chunk key, retry
jitter) uses the clock for that call. `Bun.build()` and `cc()` reach it.

A failed `open` is no longer remembered, so both recover once a
descriptor is free.

Other sources of random bytes, in BoringSSL and WebKit, are not changed.

### How did you verify your code works?

- New tests in `node-dns.test.js` and `bundler/cli.test.ts` preload a
shim that refuses `getrandom()`. Three of the four cases fail on the
previous build. The fourth is the case that was there already.
- `cargo test -p bun_dns_client`: 233 tests, 100% of lines and branches.
- By hand under a seccomp filter (`ENOSYS`, `EPERM`): errors while no
descriptor is free, answ

**File**: `src/bun_core/util.rs` (modified, +29/-29)
```diff
@@ -2352,7 +2352,9 @@ pub fn is_writable(fd: Fd) -> Pollable {
 // thread-local PRNG once per thread. Prefer `bun_boringssl_sys::rand_bytes`
 // (userspace DRBG, no syscall per call) unless the bytes are asked for in
 // batches.
-pub fn os_entropy(bytes: &mut [u8]) {
+/// Returns whether the system filled `bytes`.
+#[must_use]
+pub fn os_entropy(bytes: &mut [u8]) -> bool {
     #[cfg(any(target_os = "linux", target_os = "android"))]
     {
         let mut filled = 0usize;
@@ -2365,34 +2367,31 @@ pub fn os_entropy(bytes: &mut [u8]) {
                     0,
                 )
             };
-            if rc < 0 {
-                let err = crate::ffi::errno();
-                if err == libc::EINTR {
+            if rc <= 0 {
+                if rc < 0 && crate::ffi::errno() == libc::EINTR {
                     continue;
                 }
                 // Linux before 3.17 returns ENOSYS, and a seccomp filter can return EPERM.
                 use std::io::Read;
                 // It stays open: there may be no descriptor left the next time.
-                static URANDOM: Once<std::io::Result<std::fs::File>> = Once::new();
-                let file = URANDOM.get_or_init(|| std::fs::File::open("/dev/urandom"));
-                if !(file.as_ref()).is_ok_and(|mut f| f.read_exact(&mut bytes[filled..]).is_ok()) {
-                    panic!("getrandom failed: errno {err}");
-                }
-                return;
+                static URANDOM: Once<std::fs::File> = Once::new();
+                let file = URANDOM.get().or_else(|| {
+                    let file = std::fs::File::open("/dev/urandom").ok()?;
+                    Some(URANDOM.get_or_init(|| file))
+                });
+                return file.is_some_and(|mut f| f.read_exact(&mut bytes[filled..]).is_ok());
             }
             filled += rc as usize;
         }
+        true
     }
     #[cfg(any(target_os = "macos", target_os = "ios", target_os = "freebsd"))]
     {
         // getentropy caps at 256 bytes per call.
-        for chunk in bytes.chunks_mut(256) {
+        bytes.chunks_mut(256).all(|chunk| {
             // SAFETY: chunk is a valid writable slice ≤ 256 bytes.
-            let rc = unsafe { libc::getentropy(chunk.as_mut_ptr().cast(), chunk.len()) };
-            if rc != 0 {
-                panic!("getentropy failed");
-            }
-        }
+            unsafe { libc::getentropy(chunk.as_mut_ptr().cast(), chunk.len()) == 0 }
+        })
     }
     #[cfg(windows)]
     {
@@ -2401,13 +2400,10 @@ pub fn os_entropy(bytes: &mut [u8]) {
             #[link_name = "SystemFunction036"]
             fn RtlGenRandom(buf: *mut u8, len: u32) -> u8;
         }
-        for chunk in bytes.chunks_mut(u32::MAX as usize) {
+        bytes.chunks_mut(u32::MAX as usize).all(|chunk| {
             // SAFETY: chunk fits in u32; RtlGenRandom writes exactly that many bytes.
-            let ok = unsafe { RtlGenRandom(chunk.as_mut_ptr(), chunk.len() as u32) };
-            if ok == 0 {
-                panic!("RtlGenRandom failed");
-            }
-        }
+            unsafe { RtlGenRandom(chunk.as_mut_ptr(), chunk.len() as u32) != 0 }
+        })
     }
 }
 
@@ -3105,11 +3101,12 @@ pub mod rand {
 
 /// Port of `bun.fastRandom()`. Thread-local xoshiro256++ seeded once per
 /// process from the OS CSPRNG (or `BUN_DEBUG_HASH_RANDOM_SEED` in debug).
+/// The clock stands in for as long as the OS has no seed to give.
 pub fn fast_random() -> u64 {
     use core::cell::Cell;
     use core::sync::atomic::{AtomicU64, Ordering as O};
     static SEED: AtomicU64 = AtomicU64::new(0);
-    fn random_seed() -> u64 {
+    fn random_seed() -> Option<u64> {
         let mut v = SEED.load(O::Relaxed);
         while v == 0 {
             // Should also apply to canary builds, but bun_core has no `canary`
@@ -3118,23 +3115,26 @@ pub fn fast_random() -> u64 {
             #[cfg(debug_assertions)]
             if let Some(n) = crate::env_var::BUN_DEBUG_HASH_RANDOM_SEED.get() {
                 SEED.store(n, O::Relaxed);
-                return n;
+                return Some(n);
             }
             let mut buf = [0u8; 8];
-            os_entropy(&mut buf);
-            v = u64::from_ne_bytes(buf);
+            v = os_entropy(&mut buf).then(|| u64::from_ne_bytes(buf))?;
             SEED.store(v, O::Relaxed);
             v = SEED.load(O::Relaxed);
         }
-        v
+        Some(v)
     }
     thread_local! {
         static PRNG: Cell<Option<rand::DefaultPrng>> = const { Cell::new(None) };
     }
     PRNG.with(|p| {
-        let mut prng = p
+        let prng = p
             .take()
-            .unwrap_or_else(|| rand::DefaultPrng::init(random_seed()));
+            .or_else(|| random_seed().map(rand::DefaultPrng::init));
+        let Some(mut prng) = prng else {
+            let now = crate::time::nano_timestamp() as u64;
+            return rand::DefaultPrng::init(now ^ (u64::from(std::process::id()) << 32)).next_u64();
+ 
```

**File**: `src/dns/client/client.rs` (modified, +2/-1)
```diff
@@ -88,7 +88,8 @@ impl<S: System, R> Client<S, R> {
         config.timeout = timeout.map(|timeout| timeout.max(MIN_TIMEOUT));
         let mut servers = Servers::default();
         servers.replace(core::mem::take(&mut config.servers).into_iter());
-        let seed = (0..4).fold(0, |seed, _| seed << 16 | u64::from(system.random()));
+        let seed = (0..4).try_fold(0, |seed, _| Some(seed << 16 | u64::from(system.random()?)));
+        let seed = seed.unwrap_or_else(|| system.now().as_nanos() as u64);
         Self {
             system,
             config,
```

**File**: `src/dns/client/system.rs` (modified, +2/-2)
```diff
@@ -83,8 +83,8 @@ pub trait System: Sized {
     /// Seconds since the Unix epoch.
     fn wall_clock(&self) -> i64;
 
-    /// Nobody else can predict it.
-    fn random(&mut self) -> u16;
+    /// Nobody else can predict it. `None` if the system has none to give.
+    fn random(&mut self) -> Option<u16>;
 
     fn connect(
         &mut self,
```

**File**: `src/dns/client/tests/client/machine.rs` (modified, +5/-3)
```diff
@@ -64,6 +64,8 @@ pub(crate) struct World {
     /// Once they are used up, the numbers are odd and take long to repeat.
     pub(crate) randoms: VecDeque<u16>,
     last_random: u16,
+    /// But for those in `randoms`.
+    pub(crate) has_no_randoms: bool,
     pub(crate) files: BTreeMap<Vec<u8>, (Option<Vec<u8>>, FileStamp)>,
     pub(crate) has_no_stamps: bool,
     pub(crate) hosts_reads: usize,
@@ -180,11 +182,11 @@ impl System for Machine {
         self.world.borrow().wall_clock
     }
 
-    fn random(&mut self) -> u16 {
+    fn random(&mut self) -> Option<u16> {
         let world = &mut *self.world.borrow_mut();
-        world.randoms.pop_front().unwrap_or_else(|| {
+        world.randoms.pop_front().or_else(|| {
             world.last_random = world.last_random.wrapping_add(10) | 1;
-            world.last_random
+            (!world.has_no_randoms).then_some(world.last_random)
         })
     }
 
```

**File**: `src/dns/client/tests/client/transport.rs` (modified, +31/-0)
```diff
@@ -68,6 +68,37 @@ fn ids_on_a_socket_differ() {
     assert_eq!(ids, [7, 8, 9]);
 }
 
+#[test]
+fn no_random_numbers() {
+    for mut setup in [one_server(), over_tcp(), resolv_conf("options rotate")] {
+        setup.world.has_no_randoms = true;
+        let mut test = setup.start();
+        assert_eq!(test.resolve(RecordType::A, "a.test"), ["ECONNREFUSED"]);
+        assert!(test.is_idle() && test.sent().is_empty());
+
+        test.world().has_no_randoms = false;
+        let query = test.ask("b.test");
+        test.world().has_no_randoms = true;
+        assert_eq!(test.resolve(RecordType::A, "c.test"), ["3: ECONNREFUSED"]);
+        assert_eq!(test.deliver(&query, &good(&query)), ["2: 1.1.1.1/60"]);
+        assert!(test.is_idle());
+    }
+}
+
+#[test]
+fn random_numbers_run_out() {
+    let mut test = one_server().start();
+    test.ask("a.test");
+    test.world().has_no_randoms = true;
+    test.world().randoms.push_back(8);
+    assert_eq!(test.wait(2000), NOTHING);
+    assert_eq!(test.sent_one().id(), 8);
+    assert_eq!(test.resolve(RecordType::A, "b.test"), ["2: ECONNREFUSED"]);
+    assert_eq!(test.wait(3999), NOTHING);
+    assert_eq!(test.wait(1), ["ECONNREFUSED"]);
+    assert!(test.is_idle());
+}
+
 #[test]
 fn half_of_the_ids_fill_a_socket() {
     for setup in [one_server(), over_tcp()] {
```

**File**: `src/dns/client/transport.rs` (modified, +11/-4)
```diff
@@ -406,7 +406,9 @@ impl<S: System, R> Client<S, R> {
                 last_error: Error::ETIMEOUT,
             }),
         };
-        if self.servers.any_failed() && self.system.random().is_multiple_of(PROBE_ODDS) {
+        if self.servers.any_failed()
+            && (self.system.random()).is_some_and(|it| it.is_multiple_of(PROBE_ODDS))
+        {
             self.probe(&question, self.config.transport);
         }
         self.send(question, None);
@@ -481,7 +483,7 @@ impl<S: System, R> Client<S, R> {
         let mut query = find(&mut self.queries, &question);
         let (server, transport) = match (&mut query, probed) {
             (Some(query), _) => {
-                let random = self.config.rotate.then(|| self.system.random());
+                let random = self.config.rotate.then(|| self.system.random()).flatten();
                 let out_of_turn = query.last_error == Error::ECONNREFUSED;
                 let server = self.servers.choose(random, &mut query.avoided, out_of_turn);
                 (server, query.transport)
@@ -554,7 +556,12 @@ impl<S: System, R> Client<S, R> {
         let id = match late_tries.copied().find(is_ours) {
             Some((_, id)) => id,
             None => loop {
-                let id = self.system.random();
+                let Some(id) = self.system.random() else {
+                    self.connections.idle.push(socket);
+                    let end = Step::End(question, Err(Error::ECONNREFUSED));
+                    self.steps.push_back(end);
+                    return Ok(());
+                };
                 if !connection.tries.contains_key(&id) {
                     break id;
                 }
@@ -983,7 +990,7 @@ fn back_off(
     let doubled = (timeout.as_millis() as u64).saturating_mul(2u64.saturating_pow(rounds as u32));
     let doubled = Duration::from_millis(doubled).min(max.unwrap_or(Duration::MAX));
     let doubled = doubled.as_millis() as u64;
-    let jitter = f32::from(system.random()) / f32::from(u16::MAX) * 0.5;
+    let jitter = f32::from(system.random().unwrap_or(0)) / f32::from(u16::MAX) * 0.5;
     timeout.max(Duration::from_millis(
         doubled - (doubled as f32 * jitter) as u64,
     ))
```

**File**: `src/dns/os.rs` (modified, +12/-9)
```diff
@@ -109,6 +109,12 @@ impl<P: Poll> Os<P> {
             randoms: Default::default(),
         }
     }
+
+    fn renew_randoms(&mut self) -> Option<()> {
+        let mut randoms = [[0; 2]; _];
+        bun_core::util::os_entropy(randoms.as_flattened_mut())
+            .then(|| self.randoms = randoms.into_iter())
+    }
 }
 
 impl<P: Poll> System for Os<P> {
@@ -127,15 +133,11 @@ impl<P: Poll> System for Os<P> {
         bun_core::time::timestamp()
     }
 
-    fn random(&mut self) -> u16 {
-        loop {
-            if let Some(random) = self.randoms.next() {
-                return u16::from_ne_bytes(random);
-            }
-            let mut randoms = [[0; 2]; _];
-            bun_core::util::os_entropy(randoms.as_flattened_mut());
-            self.randoms = randoms.into_iter();
+    fn random(&mut self) -> Option<u16> {
+        if self.randoms.len() == 0 {
+            self.renew_randoms()?;
         }
+        self.randoms.next().map(u16::from_ne_bytes)
     }
 
     fn connect(
@@ -144,7 +146,8 @@ impl<P: Poll> System for Os<P> {
         server: SocketAddr,
         local: Option<IpAddr>,
     ) -> Option<Socket<P>> {
-        self.randoms = Default::default();
+        // First: it may take a descriptor, which it needs only once.
+        self.renew_randoms()?;
         let mut address = Address::from_ip(server.ip(), server.port());
         if let SocketAddr::V6(server) = server {
             address.set_scope_id(server.scope_id());
```

**File**: `test/bundler/cli.test.ts` (modified, +36/-0)
```diff
@@ -1232,3 +1232,39 @@ describe.concurrent("diagnostic markup", () => {
     expect(stderr).not.toContain("\x1b[");
   });
 });
+
+const cc = Bun.which("cc") || Bun.which("gcc") || Bun.which("clang");
+test.skipIf(!isLinux || !cc)("bun build works without getrandom() and /dev/urandom", async () => {
+  using dir = tempDir("build-no-getrandom", {
+    "index.js": `console.log(1);`,
+    "shim.c": `
+      #define _GNU_SOURCE
+      #include <dlfcn.h>
+      #include <errno.h>
+      #include <string.h>
+      #include <unistd.h>
+      long getrandom(void) { return errno = ENOSYS, -1; }
+      static int refuse(const char *name, const char *path, int flags, int mode) {
+        if (strcmp(path, "/dev/urandom")) return ((int (*)(const char *, int, ...))dlsym(RTLD_NEXT, name))(path, flags, mode);
+        write(2, "refused\\n", 8);
+        return errno = EMFILE, -1;
+      }
+      int open(const char *path, int flags, int mode) { return refuse("open", path, flags, mode); }
+      int open64(const char *path, int flags, int mode) { return refuse("open64", path, flags, mode); }
+    `,
+  });
+  const shim = join(String(dir), "shim.so");
+  await Bun.$`${cc} -shared -fPIC -o ${shim} ${join(String(dir), "shim.c")} -ldl`.env(bunEnv).quiet();
+  await using proc = Bun.spawn({
+    cmd: [bunExe(), "build", "index.js"],
+    env: { ...bunEnv, LD_PRELOAD: [shim, bunEnv.LD_PRELOAD].filter(Boolean).join(":") },
+    cwd: String(dir),
+    stderr: "pipe",
+  });
+  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+  expect({ stdout, stderr, exitCode }).toEqual({
+    stdout: "// index.js\nconsole.log(1);\n",
+    stderr: expect.stringMatching(/^(refused\n)+$/),
+    exitCode: 0,
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #49587** (closed): node:path: answer from the operands' own code units (@robobun)
- **PR #49582** (closed): dns: read the system config again after the fallback server refuses (@robobun)
- **PR #49578** (2026-11-26): Bun.diff: compare a Latin-1 text with a UTF-16 text without a copy (@alii)
- **PR #49577** (2026-11-25): redis: deprecate getBuffer() (@alii)
- **PR #49573** (2026-11-25): Bun.diff: whole words in more scripts, and throw for unsupported options (@alii)
- **PR #49568** (2026-11-25): dns, core: do not panic when the OS has no random bytes to give (@dylan-conway)

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

## X. dns, core: do not panic when the OS has no random bytes to give

**RULE**:
When implementing operations in `src/bun_core/util.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2e321d89`: dns, core: do not panic when the OS has no random bytes to give. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/bun_core/util.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Returns whether the system filled `bytes`.
#[must_use]
pub fn os_entropy(bytes: &mut [u8]) -> bool {
            if rc <= 0 {
                if rc < 0 && crate::ffi::errno() == libc::EINTR {
                static URANDOM: Once<std::fs::File> = Once::new();
                let file = URANDOM.get().or_else(|| {
                    let file = std::fs::File::open("/dev/urandom").ok()?;
                    Some(URANDOM.get_or_init(|| file))
                });
                return file.is_some_and(|mut f| f.read_exact(&mut bytes[filled..]).is_ok());
        true
        bytes.chunks_mut(256).all(|chunk| {
            unsafe { libc::getentropy(chunk.as_mut_ptr().cast(), chunk.len()) == 0 }
        })
        bytes.chunks_mut(u32::MAX as usize).all(|chunk| {
            unsafe { RtlGenRandom(chunk.as_mut_ptr(), chunk.len() as u32) != 0 }
        })
/// The clock stands in for as long as the OS has no seed to give.
    fn random_seed() -> Option<u64> {
                return Some(n);
            v = os_entropy(&mut buf).then(|| u64::from_ne_bytes(buf))?;
        Some(v)
        let prng = p
            .or_else(|| random_seed().map(rand::DefaultPrng::init));
        let Some(mut pr
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
pub fn os_entropy(bytes: &mut [u8]) {
            if rc < 0 {
                let err = crate::ffi::errno();
                if err == libc::EINTR {
                static URANDOM: Once<std::io::Result<std::fs::File>> = Once::new();
                let file = URANDOM.get_or_init(|| std::fs::File::open("/dev/urandom"));
                if !(file.as_ref()).is_ok_and(|mut f| f.read_exact(&mut bytes[filled..]).is_ok()) {
                    panic!("getrandom failed: errno {err}");
                }
                return;
        for chunk in bytes.chunks_mut(256) {
            let rc = unsafe { libc::getentropy(chunk.as_mut_ptr().cast(), chunk.len()) };
            if rc != 0 {
                panic!("getentropy failed");
            }
        }
        for chunk in bytes.chunks_mut(u32::MAX as usize) {
            let ok = unsafe { RtlGenRandom(chunk.as_mut_ptr(), chunk.len() as u32) };
            if ok == 0 {
                panic!("RtlGenRandom failed");
            }
        }
    fn random_seed() -> u64 {
                return n;
            os_entropy(&mut buf);
            v = u64::from_ne_bytes(buf);
        v
        let mut prng = p
            .unwrap_or_else(|| rand::Def
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2e321d89` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
