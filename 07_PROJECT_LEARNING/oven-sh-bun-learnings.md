> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source**: github ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Source Version**: `9b8347a2`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T19:13:37.906Z  
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
> **Harvest Timestamp**: 2026-10-27T19:13:36.857Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96438 stars

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
    return CLEAR_POINTER_TAG(us_malloc(sizeof(struct us_poll_t) + ext_size));
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
    struct us_loop_t *loop = (struct us_loop_t *) us_calloc(1, sizeof(struct us_loop_t) + ext_size);
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
             * read as errno
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
- **Issue #47006** (2026-10-26): **bun install prints a [0.02ms] ".env" trace line whenever a .env exists, and no flag or env var silences it**
  *Symptoms*: ### What version of Bun is running?  1.4.4+38afee6c8  ### What platform is your computer?  Linux 7.2.11-arch1-1 x86_64  ### What steps can reproduce the bug?  ``` // package.json { "name": "repro", "version": "1.0.0" }  // .env FOO=bar ```  ```sh bun install ```  ### What is the expected behavior?  `bun install` prints its usual output only, and nothing for a `.env` file it loads. At least one of `--silent` or `--quiet` should remove such a line.  ### What do you see instead?  ``` [0.03ms] ".env" bun install v1.4.4 (38afee6c8) No packages! Deleted empty lockfile  [0.00ms] done ```  With a real dependency (`bun add is-odd`) the first line is still there: `[0.02ms] ".env"`.  Variants tried:  - Without a `.env` file: the `[0.03ms] ".env"` line is gone. - `bun install --silent`: still prints `[0.02ms] ".env"`. - `bun install --quiet` with `NO_COLOR=1 CI=1 BUN_DEBUG_QUIET_LOGS=1`: still prints it. - `BUN_QUIET`, `BUN_DEBUG_ALL=0`, `BUN_DEBUG=0` and `BUN_CONFIG_VERBOSE_FETCH=0`: still print it. - `bun install --no-env-file`: no line, but see below. - Canary 1.4.4-canary.1+a8fcd319b (npm `bun@1.4.4-canary.20261026.1`): same output. - `bun run a.ts` in the same folder does not print the line.  ### Additional information  A CLI that runs `bun install` with inherited stdio as one step of a larger command shows these lines among its own output, so the user sees a trace line that means nothing to them and `--quiet` modes of that CLI cannot keep their output clean.  `--no-env-file` is not

- **Issue #46971** (2026-10-26): **bun lint: JS plugin nodes have no start/end in TypeScript files**
  *Symptoms*: ### What version of Bun is running?  1.4.4-canary.1+a8fcd319b  ### What platform is your computer?  Darwin 27.2.0 arm64  ### What steps can reproduce the bug?  `bun lint` gives JS plugin rules `node.start` and `node.end` when linting `.js`/`.mjs` files, but not when linting `.ts` files. There, nodes only have `node.range`.  `plugin.mjs`:  ```js export default {   meta: { name: "probe" },   rules: {     positions: {       create(context) {         return {           Identifier(node) {             context.report({               node,               message: JSON.stringify({ start: node.start, end: node.end, range: node.range }),             });           },         };       },     },   }, }; ```  `index.ts`:  ```ts const answer = 42; ```  `bunfig.toml`:  ```toml [lint] plugins = ["./plugin.mjs"]  [lint.rules] "probe/positions" = "error" ```  Then:  ```sh bun lint -f unix ```  ### What is the expected behavior?  Every node has `start` and `end`, whatever the file type, the same as Oxlint's JS plugins:  ``` index.ts:1:7: {"start":6,"end":12,"range":[6,12]} [Error/probe/positions] ```  ### What do you see instead?  ``` index.ts:1:7: {"range":[6,12]} [Error/probe/positions] plugin.mjs:2:3: {"start":19,"end":23,"range":[19,23]} [Error/probe/positions] ```  The `.mjs` file has `start`/`end`. The `.ts` file doesn't.  ### Additional information  Oxlint plugins written against `@oxlint/plugins` use `node.start`/`node.end` a lot. For example, [dmmulroy/anti-slop](https://github.com/dmmulr

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

### Incident Patch 1: `99ee03e0` (2026-10-27)
**Commit Message**: Replace HdrHistogram with safe Rust and fix `node:perf_hooks` histograms (#46650)

### What does this PR do?

Removes the HdrHistogram_c dependency. `createHistogram()` and
`monitorEventLoopDelay()` now count in `bun_histogram`, a new crate with
`#[forbid(unsafe_code)]` and no dependencies. It holds the 13 of the
library's 39 functions that Bun needs. The six hand-written C++ files
are replaced by three bindgen classes, so the classes stay native: every
method and getter is a method of one Rust struct.

**Now as in Node.js v26.3.0**

- `min` and `max` are bucket edges, so `max === percentile(100)`.
`add()` no longer takes a dropped value as the new `min`/`max`, and
returns `undefined`.
- `percentiles` holds numbers, not BigInts.
- Validation and error text of `record`, `percentile*`, `add`,
`createHistogram`: `record(1.5)` throws.
- `Histogram`, `RecordableHistogram` and `ELDHistogram` classes, none
constructible. `toJSON()` and `util.inspect()` output.
- `monitorEventLoopDelay()`: a new histogram per call, without
`record()`. It records the time between samples, not the lateness.
`enable()` keeps earlier data.
- `structuredClone()` and `postMessage()` share the counts across
threa

**File**: `.github/workflows/update-hdrhistogram.yml` (removed, +0/-109)
```diff
@@ -1,109 +0,0 @@
-name: Update hdrhistogram
-
-permissions:
-  contents: read
-
-on:
-  schedule:
-    - cron: "0 4 * * 0"
-  workflow_dispatch:
-
-jobs:
-  check-update:
-    if: github.repository == 'oven-sh/bun'
-    runs-on: ubuntu-latest
-    permissions:
-      contents: write
-      pull-requests: write
-
-    steps:
-      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-        with:
-          persist-credentials: false
-
-      - name: Check hdrhistogram version
-        id: check-version
-        run: |
-          set -euo pipefail
-
-          DEP_FILE=scripts/build/deps/hdrhistogram.ts
-          CURRENT_VERSION=$(sed -nE 's/^const HDRHISTOGRAM_COMMIT = "([0-9a-f]{40})";$/\1/p' "$DEP_FILE")
-
-          if [ -z "$CURRENT_VERSION" ]; then
-            echo "Error: Could not find HDRHISTOGRAM_COMMIT in $DEP_FILE"
-            exit 1
-          fi
-
-          # Validate that it looks like a git hash
-          if ! [[ $CURRENT_VERSION =~ ^[0-9a-f]{40}$ ]]; then
-            echo "Error: Invalid git hash format in $DEP_FILE"
-            echo "Found: $CURRENT_VERSION"
-            echo "Expected: 40 character hexadecimal string"
-            exit 1
-          fi
-
-          echo "current=$CURRENT_VERSION" >> $GITHUB_OUTPUT
-
-          LATEST_RELEASE=$(curl -sL https://api.github.com/repos/HdrHistogram/HdrHistogram_c/releases/latest)
-          if [ -z "$LATEST_RELEASE" ]; then
-            echo "Error: Failed to fetch latest release from GitHub API"
-            exit 1
-          fi
-
-          LATEST_TAG=$(echo "$LATEST_RELEASE" | jq -r '.tag_name')
-          if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" = "null" ]; then
-            echo "Error: Could not extract tag name from GitHub API response"
-            exit 1
-          fi
-
-          LATEST_TAG_SHA=$(curl -sL "https://api.github.com/repos/HdrHistogram/HdrHistogram_c/git/refs/tags/$LATEST_TAG" | jq -r '.object.sha')
-          if [ -z "$LATEST_TAG_SHA" ] || [ "$LATEST_TAG_SHA" = "null" ]; then
-            echo "Error: Could not fetch SHA for tag $LATEST_TAG"
-            exit 1
-          fi
-
-          # Try to get commit SHA from tag object (for annotated tags)
-          # If it fails, assume it's a lightweight tag pointing directly to commit
-          LATEST_SHA=$(curl -sL "https://api.github.com/repos/HdrHistogram/HdrHistogram_c/git/tags/$LATEST_TAG_SHA" 2>/dev/null | jq -r '.object.sha // empty')
-          if [ -z "$LATEST_SHA" ]; then
-            # Lightweight tag - SHA points directly to commit
-            LATEST_SHA="$LATEST_TAG_SHA"
-          fi
-
-          if ! [[ $LATEST_SHA =~ ^[0-9a-f]{40}$ ]]; then
-            echo "Error: Invalid SHA format received from GitHub"
-            echo "Found: $LATEST_SHA"
-            echo "Expected: 40 character hexadecimal string"
-            exit 1
-          fi
-
-          echo "latest=$LATEST_SHA" >> $GITHUB_OUTPUT
-          echo "tag=$LATEST_TAG" >> $GITHUB_OUTPUT
-
-      - name: Update version if needed
-        if: success() && steps.check-version.outputs.current != steps.check-version.outputs.latest
-        env:
-          LATEST: ${{ steps.check-version.outputs.latest }}
-        run: |
-          set -euo pipefail
-          sed -i -E 's/^(const HDRHISTOGRAM_COMMIT = ")[0-9a-f]{40}(";)$/\1'"$LATEST"'\2/' scripts/build/deps/hdrhistogram.ts
-
-      - name: Create Pull Request
-        if: success() && steps.check-version.outputs.current != steps.check-version.outputs.latest
-        uses: peter-evans/create-pull-request@5f6978faf089d4d20b00c7766989d076bb2fc7f1 # v8.1.1
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          add-paths: |
-            scripts/build/deps/hdrhistogram.ts
-          commit-message: "deps: update hdrhistogram to ${{ steps.check-version.outputs.tag }} (${{ steps.check-version.outputs.latest }})"
-          title: "deps: update hdrhistogram to ${{ steps.check-version.outputs.tag }}"
-          delete-branch: true
-          branch: deps/update-hdrhistogram
-          body: |
-            ## What does this PR do?
-
-            Updates hdrhistogram to version ${{ steps.check-version.outputs.tag }}
-
-            Compare: https://github.com/HdrHistogram/HdrHistogram_c/compare/${{ steps.check-version.outputs.current }}...${{ steps.check-version.outputs.latest }}
-
-            Auto-updated by [this workflow](https://github.com/oven-sh/bun/actions/workflows/update-hdrhistogram.yml)
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -147,7 +147,7 @@ The Rust side is a Cargo workspace of ~200 crates rooted at `Cargo.toml`. The ke
 
 #### Vendored Dependencies (`vendor/`)
 
-Third-party native libraries are vendored locally and can be read from disk (not git submodules): boringssl (TLS/crypto), brotli, cares (async DNS), hdrhistogram, highway (SIMD), libarchive (tar/zip), libdeflate, libuv (Windows event loop), lolhtml (HTML rewriter), lshpack (HTTP/2 HPACK), lsqpack + lsquic (HTTP/3), mimalloc (allocator), nodejs (headers), picohttpparser, rust-argon2 (argon2 for `Bun.password`, Rust), tinycc (FFI JIT, fork: oven-sh/tinycc), WebKit (JavaScriptCore), zlib (zlib-ng), zstd. Build configuration for these is in `scripts/build/deps/*.ts`.
+Third-party native libraries are vendored locally and can be read from disk (not git submodules): boringssl (TLS/crypto), brotli, cares (async DNS), highway (SIMD), libarchive (tar/zip), libdeflate, libuv (Windows event loop), lolhtml (HTML rewriter), lshpack (HTTP/2 HPACK), lsqpack + lsquic (HTTP/3), mimalloc (allocator), nodejs (headers), picohttpparser, rust-argon2 (argon2 for `Bun.password`, Rust), tinycc (FFI JIT, fork: oven-sh/tinycc), WebKit (JavaScriptCore), zlib (zlib-ng), zstd. Build configuration for these is in `scripts/build/deps/*.ts`.
 
 ### JavaScript Class Implementation (C++)
 
```

**File**: `Cargo.lock` (modified, +5/-0)
```diff
@@ -615,6 +615,10 @@ dependencies = [
  "bstr",
 ]
 
+[[package]]
+name = "bun_histogram"
+version = "0.0.0"
+
 [[package]]
 name = "bun_http"
 version = "0.0.0"
@@ -1492,6 +1496,7 @@ dependencies = [
  "bun_glob",
  "bun_hash",
  "bun_highway",
+ "bun_histogram",
  "bun_http",
  "bun_http_jsc",
  "bun_http_types",
```

**File**: `Cargo.toml` (modified, +2/-0)
```diff
@@ -58,6 +58,7 @@ members = [
   "src/event_loop",
   "src/exe_format",
   "src/highway",
+  "src/histogram",
   "src/http_jsc",
   "src/http_types",
   "src/ini",
@@ -425,6 +426,7 @@ bun_dotenv = { path = "src/dotenv" }
 bun_event_loop = { path = "src/event_loop" }
 bun_exe_format = { path = "src/exe_format" }
 bun_highway = { path = "src/highway" }
+bun_histogram = { path = "src/histogram" }
 bun_http_jsc = { path = "src/http_jsc" }
 bun_http_types = { path = "src/http_types" }
 bun_ini = { path = "src/ini" }
```

**File**: `docs/project/bindgen.mdx` (modified, +44/-3)
```diff
@@ -598,9 +598,10 @@ is collected, make the class [`refCounted`](#refcounted).
 | Key              | What it declares                                                                               |
 | ---------------- | ---------------------------------------------------------------------------------------------- |
 | `rustPath`       | the struct                                                                                     |
+| `extends`        | the class [inherits from another](#extends), whose struct it has instead of a `rustPath`       |
 | `refCounted`     | the struct is a separate allocation that [can outlive the object](#refcounted)                 |
 | `finalize`       | with `refCounted`: call `fn finalize(&self)` when the object is collected                      |
-| `final`          | with `refCounted`: `false` lets hand-written C++ subclass `JSName`                             |
+| `final`          | `false` lets a class with `extends`, or hand-written C++, subclass `JSName`                    |
 | `overridesToJS`  | with `refCounted`: `impl JsClass` is not generated; write it by hand with `js_Name::to_js`     |
 | `forBind`        | the receiver of every member is [a function bound to an instance](#forbind)                    |
 | `rustTraits`     | traits to bring into scope, for members that are trait methods                                 |
@@ -648,7 +649,7 @@ A property of `proto` is one of these.
 | `{ getter: T, capability, throws, passThis }` | an accessor; with `setter` it can be assigned                                              |
 | `{ getter: T, cache: true \| "field", .. }`   | an accessor that returns an [internal field](#internalfields)                              |
 | `{ internalField: "field", setter }`          | an accessor that reads the field, and with `setter` stores any value, without calling Rust |
-| `{ builtin: true, length }`                   | the export of that name in `src/js/builtins/<class name>.ts`                               |
+| `{ builtin: true, length }`                   | the export of that name in `src/js/builtins/<class name>.ts`, without the `@@` of a symbol |
 | `{ constant: 3 }`                             | a read-only integer, like a WebIDL `const`                                                 |
 | `[{ rustName, args, .. }, ..]`                | a native function with [overloads](#overloads)                                             |
 
@@ -665,7 +666,8 @@ or a constant override the class's.
 A key that starts with `@@` is a well-known symbol: `"@@dispose"` defines `prototype[Symbol.dispose]`. The function is
 writable, configurable and not enumerable, like the built-in ones, whatever the class says. Its `name` is
 `[Symbol.dispose]` and its Rust function is `dispose`. `name` overrides the function's `name`: Node's
-`Timeout.prototype[Symbol.dispose].name` is `""`. Only a function can have an `@@` key.
+`Timeout.prototype[Symbol.dispose].name` is `""`. Only a function can have an `@@` key: a native one or a builtin, which
+names itself with `$overriddenName`. `"@@inspectCustom"` is `Symbol.for("nodejs.util.inspect.custom")`.
 
 A native function throws `ERR_INVALID_THIS` when `this` is not an instance. With `invalidThis: "undefined"` it returns
 `undefined` instead, as some of Node's methods do.
@@ -684,6 +686,42 @@ Rust gets it with `js_Glob::get_constructor(global)`. In C++, the generated head
 prototype and constructor: `Bun::Bindgen::structureForClass<JSGlob>(globalObject)`, `prototypeForClass<JSGlob>` and
 `constructorForClass<JSGlob>`. `createWrapper<JSBlob>(globalObject, wrapped)` is a new instance of a `refCounted` class.
 
+### `extends`
+
+```ts
+export const Histogram = b.class({
+  rustPath: "crate::node::histogram::Histogram",
+  final: false,
+  construct: "illegal",
+  proto: { count: { getter: b.u64 } },
+});
+export const RecordableHistogram = b.class({
+  extends: Histogram,
+  construct: "illegal",
+  proto: { record: { args: { val: b.u64 } } },
+});
+```
+
+One class inherits from another as one WebIDL interface does:
+
+- `JSRecordableHistogram` is a C++ subclass of `JSHistogram`. A `RecordableHistogram` is therefore a `Histogram` wherever
+  one is taken: as `this`, as an argument, for `from_js` and for `dynamicDowncast`. A `Histogram` is not a
+  `RecordableHistogram`, and `record` throws `ERR_INVALID_THIS` for one.
+- `RecordableHistogram.prototype` inherits from `Histogram.prototype`, and `RecordableHistogram` from `Histogram`.
+- The subclass adds no fields. Its struct is the base's, so `record` is a method of `Histogram` in Rust, and no two
+  members of a class and its subclasses have the same Rust function unless a `rustName` says so.
+  `js_RecordableHistogram::from_js(value)` is the struct if `value` is an instance of the subclass.
+
+`js_RecordableHistogram::create(heap, payload)` makes an instance, and `create_wrapper(global, payload)` does for code
+that has no capability. `payload.into_js(heap)` 
```

**File**: `docs/project/license.mdx` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ Bun statically links these libraries:
 | [`libspng`](https://github.com/randy408/libspng)                                                                                                 | BSD 2-Clause (portions derived from libpng, PNG Reference Library License v2)                |
 | [`libwebp`](https://github.com/webmproject/libwebp)                                                                                              | BSD 3-Clause                                                                                 |
 | [`highway`](https://github.com/google/highway)                                                                                                   | Apache 2.0                                                                                   |
-| [`HdrHistogram_c`](https://github.com/HdrHistogram/HdrHistogram_c)                                                                               | dual-licensed under CC0 1.0 or the BSD 2-Clause License                                      |
+| Parts of [`HdrHistogram_c`](https://github.com/HdrHistogram/HdrHistogram_c), rewritten in Rust                                                   | dual-licensed under CC0 1.0 or the BSD 2-Clause License                                      |
 | [`sqlite`](https://sqlite.org) (on Linux and Windows)                                                                                            | [public domain](https://sqlite.org/copyright.html)                                           |
 | A fork of [`uWebsockets`](https://github.com/jarred-sumner/uwebsockets)                                                                          | Apache 2.0 licensed                                                                          |
 | Parts of [Tigerbeetle's IO code](https://github.com/tigerbeetle/tigerbeetle/blob/532c8b70b9142c17e07737ab6d3da68d7500cbca/src/io/windows.zig#L1) | Apache 2.0 licensed                                                                          |
```

**File**: `packages/h3blast/Makefile` (modified, +2/-3)
```diff
@@ -1,5 +1,5 @@
 # h3blast — links against Bun's already-built vendored deps so we don't
-# rebuild lsquic/BoringSSL/HdrHistogram. Run `bun run build:release` once
+# rebuild lsquic/BoringSSL. Run `bun run build:release` once
 # in the repo root first so the .o files exist.
 
 ROOT      := ../..
@@ -12,11 +12,10 @@ CC        ?= clang
 CFLAGS    := -std=c11 -O3 -g -Wall -Wextra -Wno-unused-parameter \
              -DLSXPACK_MAX_STRLEN=UINT32_MAX \
              -I$(VENDOR)/lsquic/include \
-             -I$(VENDOR)/hdrhistogram/include \
              -I$(VENDOR)/boringssl/include
 LDFLAGS   := -lstdc++ -lm -lpthread
 
-DEPS      := lsquic lsqpack lshpack boringssl hdrhistogram zlib
+DEPS      := lsquic lsqpack lshpack boringssl zlib
 DEP_DIRS  := $(addprefix $(OBJ)/,$(DEPS))
 LIBDEPS   := build/libdeps.a
 
```

**File**: `packages/h3blast/README.md` (modified, +2/-2)
```diff
@@ -30,13 +30,13 @@ Each connection keeps `--streams` HTTP/3 request streams in flight at all
 times. UDP I/O is batched with `sendmmsg`/`recvmmsg`; the lsquic timer wheel
 is driven via `epoll` + `timerfd`. The main thread samples per-worker atomic
 counters at ~10 Hz to render the live TUI, then aggregates per-worker
-HdrHistograms for the final percentile report.
+latency histograms for the final percentile report.
 
 No TLS verification by default (it's a load tester).
 
 ## Build
 
-h3blast links the **already-compiled** lsquic / BoringSSL / HdrHistogram / zlib
+h3blast links the **already-compiled** lsquic / BoringSSL / zlib
 object files from Bun's build tree, so you need a Bun release build first:
 
 ```sh
```

---

### Incident Patch 2: `8a0e49ee` (2026-10-27)
**Commit Message**: bun_core::String can no longer borrow (fixes a source-map name use-after-free) (#46825)

### What does this PR do?

Printing an Error could read a source-map file name that had just been
freed, and put the stale bytes in the printed stack. This fixes that bug
and makes the mistake behind it a compile error.

**The bug.** For a stack frame whose URL is not an absolute path,
`Lookup::display_source_url_if_needed` returned a string that borrowed
the map's own `sources` entry. The printer reads the Error's own `cause`
between remapping the frames and printing them. A `cause` getter that
loads the same file again replaces the map, which frees its names.
`require(URL.createObjectURL(Bun.file("rel.js")))` gives such a URL.

- AddressSanitizer build: `heap-use-after-free` under
`print_stack_trace`.
- Release 1.4.4: the frame prints as `(\^@\^VnO�\^B\^@:1:1)` instead of
`(orig.ts:1:1)`.
- `Bun.inspect`, `console.log`, `console.error` and an uncaught throw
are affected.

**The root cause.** `bun_core::String` is the owned type, but
`String::borrow_utf8`, `from_bytes` and `ascii` were safe functions that
took a `&[u8]` and dropped its lifetime. `StringView<'a>` already
existed for borrowing.


**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1313,6 +1313,7 @@ name = "bun_patch_jsc"
 version = "0.0.0"
 dependencies = [
  "bstr",
+ "bun_core",
  "bun_jsc",
  "bun_patch",
  "bun_sys",
```

**File**: `src/CLAUDE.md` (modified, +14/-5)
```diff
@@ -36,7 +36,7 @@ or don't match the cross-platform behavior the runtime needs.
 | `std::path::Path::join`                 | `bun_paths::resolve_path::join` / `join_string_buf`                                  |
 | `std::path::Path::parent`/`file_name`   | `bun_paths::dirname` / `bun_paths::basename`                                         |
 | `std::env::var`                         | `bun_core::env_var::*::get()` (typed + cached)                                       |
-| `String::from_utf8` for JS-visible strs | `bun_core::String::clone_utf8` / `borrow_utf8`                                       |
+| `String::from_utf8` for JS-visible strs | `bun_core::String::clone_utf8` / `StringView::borrow_utf8`                           |
 | `&str` operations on byte slices        | `bun_core::strings::*` (SIMD-backed `&[u8]` ops)                                     |
 | `eprintln!` for debug logging           | `bun_core::declare_scope!` + `scoped_log!`                                           |
 | `std::process::Command`                 | `bun_core::util::spawn_sync_inherit` (CLI helpers) or `bun_spawn_sys` (full control) |
@@ -85,17 +85,26 @@ requires a real encoder, not a cast.
 
 `String` owns one ref when WTF-backed: `Drop` derefs, `Clone` refs, it is
 not `Copy`. Borrow with `&String` (or `StringView<'_>` when a by-value borrow
-is needed). In an `extern "C"` signature a by-value `String` means ownership
+is needed). Rust cannot build a `String` that borrows: `StringView<'a>`
+wraps a `&'a [u8]` without copying. It derefs to `&String`,
+`StringView::as_strings` lends a slice of them as `&[String]`, and
+`String::clone(&view)` copies the bytes into an owned `String`. A field that
+holds either an owned `String` or borrowed bytes is a `StringOrView<'a>` (the
+`ZigException<'a>` / `ZigStackFrame<'a>` strings: C++ fills them with refs, the
+dev server with slices of a request body); it drops the ref if it has one and
+also derefs to `&String`. In an `extern "C"` signature a by-value `String` means ownership
 crosses the boundary (C++ `Bun::toStringRef` return / `transferToWTFString()`
 consumer); `&String` ⇔ `const BunString*`.
 
 ```rust
-use bun_core::{EncodedSlice, String, Utf8Bytes};   // the only import path for all three
+use bun_core::{EncodedSlice, String, StringOrView, StringView, Utf8Bytes};   // the only import path for all five
 
 let s = String::clone_utf8(utf8_bytes);    // copies into a WTFStringImpl
-let s = String::borrow_utf8(utf8_bytes);   // no copy; caller keeps slice alive
 let s = String::static_("literal");        // 'static ASCII slice, never freed
-let s = String::from_bytes(bytes);         // borrow arbitrary bytes; tags UTF-8 if non-ASCII
+let s = String::from_static_bytes(bytes);  // 'static UTF-8: ASCII is not copied, anything else is clone_utf8
+let v = StringView::borrow_utf8(utf8_bytes); // no copy; `v` cannot outlive the slice
+let v = StringView::from_bytes(bytes);       // borrow arbitrary bytes; tags UTF-8 if non-ASCII
+let f: StringOrView<'_> = StringOrView::from_bytes(bytes); // same borrow, for a field that `owned.into()` also fits
 s.eq_ascii(b"lit") / s.starts_with_ascii(b"lit")  // encoding-aware ASCII compare without transcoding
 
 let utf8: Utf8Bytes<'_>      = s.to_utf8();             // borrows `s` (ASCII/UTF-8) or transcodes; for locals
```

**File**: `src/ast_jsc/lib.rs` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ pub fn msg_from_js(global_object: &JSGlobalObject, file: Vec<u8>, err: JSValue)
     if let Some(value) = err.to_error() {
         value.to_zig_exception(global_object, zig_exception_holder.zig_exception());
     } else {
-        zig_exception_holder.zig_exception().message = err.to_bun_string(global_object)?;
+        zig_exception_holder.zig_exception().message = err.to_bun_string(global_object)?.into();
     }
 
     Ok(Msg {
```

**File**: `src/boringssl/lib.rs` (modified, +1/-1)
```diff
@@ -435,7 +435,7 @@ pub fn check_x509_server_identity(x509: &mut boring::X509, hostname: &[u8]) -> b
     let ascii_hostname;
     // CVE-2026-48618: IDNA maps "。" to ".", so a non-ASCII host is matched on its UTS #46 form, as in `tls.checkServerIdentity`.
     let hostname = if strings::first_non_ascii(hostname).is_some() {
-        let ascii = Bun__idnaToASCII(&bun_core::String::borrow_utf8(hostname));
+        let ascii = Bun__idnaToASCII(&bun_core::StringView::borrow_utf8(hostname));
         if ascii.is_dead() {
             return false;
         }
```

**File**: `src/bun_core/lib.rs` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ pub use ::bstr::{BStr, BString, ByteSlice};
 pub use string::string_joiner::StringJoiner;
 pub use string::{
     EncodedSlice, HashedString, MutableString, NodeEncoding, SmolStr, String, StringBuilder,
-    StringView, Utf8Bytes, Utf8WithString, WTFStringImpl, WTFStringImplExt, WTFStringImplStruct,
+    StringOrView, StringView, Utf8Bytes, Utf8WithString, WTFStringImpl, WTFStringImplExt,
+    WTFStringImplStruct,
 };
 pub use string::{
     STRING_ALLOCATION_LIMIT, cheap_prefix_normalizer, escape_reg_exp, identifier, lexer,
```

**File**: `src/bun_core/string/mod.rs` (modified, +85/-42)
```diff
@@ -47,8 +47,8 @@ pub use wtf::{WTFStringImpl, WTFStringImplExt, WTFStringImplStruct};
 // `String` — 6-variant tagged WTFString-or-EncodedSlice, 24 bytes on 64-bit.
 //
 // - `String`: OWNS one ref when WTF-backed. Not `Copy`. `Drop` = `deref()`,
-//   `Clone` = `ref()`; for the `EncodedSlice`/`Static`/`Empty`/`Dead`/
-//   `OutOfMemory` tags both are a tag compare and nothing else. Every +1
+//   `Clone` = `ref()`; for the `Static`/`Empty`/`Dead`/`OutOfMemory` tags
+//   both are a tag compare and nothing else. Every +1
 //   producer returns this —
 //   including `extern "C"` declarations: a by-value `String` in an FFI
 //   signature means ownership crosses (C++ `Bun::toStringRef` return, or a
@@ -170,8 +170,7 @@ impl String {
         self.tag
     }
 
-    /// Wrap `slice` under `tag`, erasing its lifetime: the caller keeps the
-    /// bytes alive for the `String`'s lifetime.
+    /// Wrap `slice` under `tag`, erasing its lifetime. Only for [`Self::static_`] and for [`StringView`] and [`StringOrView`], which keep the lifetime.
     #[inline(always)]
     fn wrap(tag: Tag, slice: EncodedSlice<'_>) -> Self {
         Self {
@@ -206,17 +205,6 @@ impl String {
         unsafe { &*self.value.wtf_string_impl }
     }
 
-    /// Borrow `s` (no copy, no refcount). Caller must keep `s` alive for the
-    /// String's lifetime.
-    #[inline]
-    pub fn borrow_utf8(s: &[u8]) -> Self {
-        Self::wrap(Tag::EncodedSlice, EncodedSlice::utf8(s))
-    }
-    #[inline]
-    pub fn ascii(s: &[u8]) -> Self {
-        Self::wrap(Tag::EncodedSlice, EncodedSlice::latin1(s))
-    }
-
     /// `'static` ASCII slice (no encoding tag, no scan); `to_utf8`/`into_utf8`
     /// borrow the bytes directly. Generic over `str`/`[u8]` so call sites may
     /// pass either `"lit"` or `b"lit"`.
@@ -225,6 +213,13 @@ impl String {
         debug_assert!(s.as_ref().is_ascii());
         Self::wrap(Tag::StaticEncodedSlice, EncodedSlice::latin1(s.as_ref()))
     }
+    /// `'static` UTF-8 of any content: ASCII is wrapped without copying, anything else is [`Self::clone_utf8`].
+    pub fn from_static_bytes(bytes: &'static [u8]) -> Self {
+        if !bytes.is_empty() && strings::is_all_ascii(bytes) {
+            return Self::create_static_external(bytes);
+        }
+        Self::clone_utf8(bytes)
+    }
     /// `clone_utf8(other)`, unless `other` is byte-equal to `self`, in which
     /// case another ref to `self`.
     #[inline]
@@ -292,7 +287,7 @@ impl String {
         }
         Self::clone_utf8(bytes)
     }
-    /// Wraps `bytes` in a `WTF::ExternalStringImpl` that calls
+    /// Wraps Latin-1 `bytes` in a `WTF::ExternalStringImpl` that calls
     /// `callback(ctx, buffer, len)` when the impl is destroyed.
     ///
     /// External strings are WTF strings whose bytes live elsewhere; `bytes` is
@@ -301,9 +296,10 @@ impl String {
     ///
     /// `Ctx` must be a pointer-sized type (raw pointer or `&T`); enforced by
     /// the const-assert below to keep the C-ABI cast sound.
-    pub fn create_external<Ctx>(
+    ///
+    /// SAFETY: the caller keeps `bytes` valid and unchanged until `callback` runs.
+    pub unsafe fn create_external<Ctx>(
         bytes: &[u8],
-        is_latin1: bool,
         ctx: Ctx,
         callback: ExternalStringImplFreeFunction<Ctx>,
     ) -> Self {
@@ -346,13 +342,7 @@ impl String {
             >(callback) });
         // SAFETY: bytes describes a valid slice; len <= max_length checked.
         let s = unsafe {
-            BunString__createExternal(
-                bytes.as_ptr(),
-                bytes.len(),
-                is_latin1,
-                ctx_erased,
-                cb_erased,
-            )
+            BunString__createExternal(bytes.as_ptr(), bytes.len(), true, ctx_erased, cb_erased)
         };
         debug_assert!(s.tag != Tag::WTFStringImpl || s.as_wtf().ref_count() == 1);
         s
@@ -367,31 +357,30 @@ impl String {
             .min(WTF_STRING_MAX_LENGTH)
     }
 
-    /// Wraps `bytes` in a `WTF::ExternalStringImpl` that will **never** be
-    /// freed. Only use for dynamically-allocated data with process lifetime.
-    pub fn create_static_external(bytes: &[u8], is_latin1: bool) -> Self {
+    /// Wraps Latin-1 `bytes` in a `WTF::ExternalStringImpl` that will **never** be
+    /// freed.
+    pub fn create_static_external(bytes: &'static [u8]) -> Self {
         debug_assert!(!bytes.is_empty());
         // SAFETY: bytes describes a valid slice; C++ side stores ptr/len
         // without copying and never frees it.
-        unsafe { BunString__createStaticExternal(bytes.as_ptr(), bytes.len(), is_latin1) }
+        unsafe { BunString__createStaticExternal(bytes.as_ptr(), bytes.len(), true) }
     }
     /// [`Self::create_static_external`] for Latin-1 bytes whose `WTF::StringImpl::hash()` is already known, so the
     /// result is thread-shareable without reading the bytes.
-    pub fn create_static_external_latin1_with_hash(bytes: &[u8], hash: u32) -> S
```

**File**: `src/bundler/OutputFile.rs` (modified, +0/-33)
```diff
@@ -1,11 +1,8 @@
-use core::ffi::c_void;
-
 use crate::options::Loader;
 // `bake::Side` / `jsc.api.BuildArtifact.OutputKind` are TYPE_ONLY move-ins;
 // the `options` module already defines them locally.
 use crate::Error;
 use crate::options::{OutputKind, Side};
-use bun_core::String as BunString;
 use bun_paths::fs;
 use bun_paths::resolve_path::{self, platform};
 use bun_sys::Fd;
@@ -124,36 +121,6 @@ impl Value {
             _ => b"",
         }
     }
-
-    /// Borrowing variant of [`Self::to_bun_string`]: wraps the buffer in a
-    /// `WTF::ExternalStringImpl` that aliases `bytes` with a **no-op** free
-    /// callback (zero-copy). Caller guarantees `self` outlives every use of the
-    /// returned string.
-    ///
-    /// `PerThread.bundled_outputs` owns the bytes for the entire prerender
-    /// phase. The consuming [`Self::to_bun_string`] cannot be used there
-    /// because the `Vec<OutputFile>` is only borrowed.
-    pub fn to_bun_string_ref(&self) -> BunString {
-        match self {
-            Value::Noop => BunString::EMPTY,
-            Value::Buffer { bytes } => {
-                if bytes.is_empty() {
-                    return BunString::EMPTY;
-                }
-                extern "C" fn noop(_: *mut c_void, _: *mut c_void, _: usize) {}
-                // latin1 = true.
-                BunString::create_external::<*mut c_void>(
-                    bytes,
-                    true,
-                    core::ptr::null_mut::<c_void>(),
-                    noop,
-                )
-            }
-            Value::Copy(_) | Value::Saved(_) => {
-                bun_core::todo_panic!("to_bun_string_ref: Copy/Saved")
-            }
-        }
-    }
 }
 
 #[derive(Default, Clone, Copy)]
```

**File**: `src/bundler/ParseTask.rs` (modified, +2/-2)
```diff
@@ -2121,10 +2121,10 @@ pub mod parse_worker {
             let namespace = if self.file_path.namespace == b"file" {
                 &bun_core::String::EMPTY
             } else {
-                namespace_str = bun_core::String::from_bytes(self.file_path.namespace);
+                namespace_str = bun_core::StringView::from_bytes(self.file_path.namespace);
                 &namespace_str
             };
-            let path_str = bun_core::String::from_bytes(self.file_path.text);
+            let path_str = bun_core::StringView::from_bytes(self.file_path.text);
             // Copy the `&Cell<i32>` out so passing it to FFI doesn't go through
             // `&mut self` after `self_ptr` is derived.
             let should_continue_running = self.should_continue_running;
```

---

### Incident Patch 3: `98a43659` (2026-10-27)
**Commit Message**: Fix use-after-free of `BuildMessage.position.file`: real lifetimes for `Source`, `Path`, `ImportRecord` and resolve results (#46834)

### What does this PR do?

Fixes a heap-use-after-free in `BuildMessage.position.file`, by removing
the false `'static` lifetimes that let it compile. `Source`, `Path`,
`ImportRecord`, the bundler's graph types and the resolver's results now
carry the lifetime of what they borrow, so the compiler checks this
whole area instead of comments.

#### The bug

```js
const url = URL.createObjectURL(new File(["["], "bad.yaml"));
const wide = ("Ā" + url).slice(1); // any specifier that is not 8-bit ASCII
await import(wide).catch(e => console.log(e.position.file)); // reads freed memory
```

`Location::init_or_null_impl` stored `Cow::Borrowed(source.path.text)`
in a `Cow<'static, [u8]>`. That compiled because `Source.path` was a
`Path<'static>`. For a virtual source the path is really a view of
`specifier.to_utf8()`, which `Bun__transpileFile` /
`Bun__transpileVirtualModule` free when they return, while
`process_fetch_log` moves the message into a `BuildMessage` that JS
keeps.

There are three ways in: a `blob:` URL of an in-memory `File`,
`/bun-vfs$$/node_mod

**File**: `src/ast/import_record.rs` (modified, +4/-8)
```diff
@@ -10,11 +10,9 @@ use bun_paths::fs::Path;
 // `bun_ast::import_record::{ImportKind, Index, Loader}` keep resolving.
 pub use crate::{ImportKind, Index, Loader};
 
-pub struct ImportRecord {
+pub struct ImportRecord<'a> {
     pub range: Range,
-    // TODO: lifetime — `bun_paths::fs::Path<'a>` borrows resolver-owned
-    // strings. Uses 'static (PORTING.md: no struct lifetime params).
-    pub path: Path<'static>,
+    pub path: Path<'a>,
     pub kind: ImportKind,
     pub tag: Tag,
     pub loader: Option<Loader>,
@@ -24,9 +22,7 @@ pub struct ImportRecord {
     /// The original import specifier as written in source code (e.g., "./foo.js").
     /// This is preserved before resolution overwrites `path` with the resolved path.
     /// Used for metafile generation.
-    // TODO: lifetime — likely a borrow into parser-owned source text; using
-    // &'static [u8] as a placeholder.
-    pub original_path: &'static [u8],
+    pub original_path: &'a [u8],
 
     /// Pack all boolean flags into 4 bytes to reduce padding overhead.
     /// Previously 15 separate bool fields caused ~14-16 bytes of padding waste.
@@ -110,7 +106,7 @@ bitflags::bitflags! {
     }
 }
 
-pub type List<'a> = bun_alloc::ArenaVec<'a, ImportRecord>;
+pub type List<'a> = bun_alloc::ArenaVec<'a, ImportRecord<'a>>;
 
 #[repr(u8)]
 #[derive(Copy, Clone, Eq, PartialEq, Debug, Default)]
```

**File**: `src/ast/lexer_log.rs` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@
 //! collapses both.
 //!
 //! The trait carries a `'s` lifetime so `source()` can hand back the lexer's
-//! stored `&'s Source` *without* borrowing `self` — that is what lets the
+//! stored `&'s Source<'s>` *without* borrowing `self` — that is what lets the
 //! provided bodies call `self.log_mut()` afterwards without a split-borrow
 //! conflict.
 
@@ -23,8 +23,8 @@ pub trait LexerLog<'s> {
 
     // ── required state accessors ────────────────────────────────────────
     fn log_mut(&mut self) -> &mut Log;
-    /// NB: returns the lexer-stored `&'s Source`, *not* a `&self`-tied borrow.
-    fn source(&self) -> &'s Source;
+    /// NB: returns the lexer-stored `&'s Source<'s>`, *not* a `&self`-tied borrow.
+    fn source(&self) -> &'s Source<'s>;
     fn prev_error_loc_mut(&mut self) -> &mut Loc;
     fn start(&self) -> usize;
     fn syntax_err() -> Self::Err;
```

**File**: `src/ast/lib.rs` (modified, +118/-435)
```diff
@@ -6,12 +6,7 @@
 // macro's `LocalKey` wrapper. All are `Cell<*mut _>` / `Cell<bool>` (no
 // destructor, const init).
 #![feature(thread_local)]
-//! TODO: OWNERSHIP — almost every byte-slice field in this module has
-//! mixed/ambiguous ownership. Strings are sometimes literals, sometimes heap
-//! copies, sometimes slices into `Source.contents` or a `StringBuilder` arena.
-//! They are kept as `&'static [u8]` to avoid lifetime params; a real ownership
-//! story (likely `bun_core::String` or a `'source` lifetime threaded through
-//! `Location`/`Data`/`Msg`) is still needed.
+//! A [`Source`] borrows for `'a`. A diagnostic owns its bytes, so a [`Log`] may outlive the `Source`.
 
 use core::fmt;
 use std::borrow::Cow;
@@ -20,18 +15,6 @@ use std::borrow::Cow;
 // infallible (`Vec::push` / `io::Write` on `Vec<u8>` cannot fail in Rust).
 use bun_core::Output;
 
-// TODO: swap to `bun_core::StringBuilder` once `clone_with_builder` is
-// reshaped to use `append_raw` (canonical's `append` borrows `&mut self`, which
-// breaks the `'static` slice pass-through this stub fakes).
-#[derive(Default)]
-pub struct StringBuilder;
-impl StringBuilder {
-    pub fn count(&mut self, s: &[u8]) {
-        let _ = s;
-    }
-    pub fn allocate(&mut self) {}
-}
-
 // Discriminants are wire-stable for serialization.
 #[repr(u8)]
 #[derive(
@@ -414,41 +397,9 @@ impl fmt::Debug for Ref {
 /// A [`Source`]'s path paired with its raw bytes (used by virtual-module
 /// injection: `BundleV2`'s `additional_files`, `Bun.build` inputs).
 #[derive(Clone, Copy)]
-pub struct PathContentsPair {
-    pub path: bun_paths::fs::Path<'static>,
-    pub contents: &'static [u8],
-}
-
-type Str = &'static [u8];
-// `Str` is a lifetime-erased byte-slice alias; see the module-level OWNERSHIP
-// note for the real ownership story.
-
-/// `[]const u8` parameter shim — accepts `&str` / `&[u8]` (any lifetime)
-/// and erases to the crate-wide `Str` (`&'static [u8]`) lie so callers in either
-/// string flavour compile against the same signatures.
-/// Removable together with `Str` once a `'source` lifetime is threaded through
-/// (see the module-level OWNERSHIP note).
-pub trait IntoStr {
-    fn into_str(self) -> Str;
-}
-impl IntoStr for &[u8] {
-    #[inline]
-    fn into_str(self) -> Str {
-        // SAFETY: lifetime erasure; see module-level OWNERSHIP note.
-        unsafe { bun_collections::detach_lifetime(self) }
-    }
-}
-impl IntoStr for &str {
-    #[inline]
-    fn into_str(self) -> Str {
-        self.as_bytes().into_str()
-    }
-}
-impl<const N: usize> IntoStr for &[u8; N] {
-    #[inline]
-    fn into_str(self) -> Str {
-        self[..].into_str()
-    }
+pub struct PathContentsPair<'a> {
+    pub path: bun_paths::fs::Path<'a>,
+    pub contents: &'a [u8],
 }
 
 /// Owned/borrowed → `Cow<'static, [u8]>` for `Data.text`. Superset of the old
@@ -624,24 +575,14 @@ impl Loc {
 // Location
 // ───────────────────────────────────────────────────────────────────────────
 
+/// Owns its bytes: a diagnostic outlives the [`Source`] it describes.
+#[derive(Clone)]
 pub struct Location {
-    // Field ordering optimized to reduce padding:
-    // - 16-byte fields first: string (ptr+len), ?string (ptr+len+null flag)
-    // - 8-byte fields next: usize
-    // - 4-byte fields last: i32
-    // This eliminates padding between differently-sized fields.
-    //
-    // `file` / `namespace` / `line_text` are `Cow` (not `Str`) because
-    // `Location::clone()` must deep-dupe them so a
-    // `BuildMessage`/`ResolveMessage` that outlives the
-    // `Source` it borrowed from doesn't read poisoned memory. The
-    // borrowed arm covers the common case where the slice points into
-    // the bundle's arena.
-    pub file: Cow<'static, [u8]>,
-    pub namespace: Cow<'static, [u8]>,
+    pub file: Box<[u8]>,
+    pub namespace: Box<[u8]>,
     /// Text on the line, avoiding the need to refetch the source code. It may be prefixed by the
     /// preceding lines, which are printed too.
-    pub line_text: Option<Cow<'static, [u8]>>,
+    pub line_text: Option<Box<[u8]>>,
     /// Number of bytes this location should highlight.
     /// 0 to just point at a single character
     pub length: usize,
@@ -658,32 +599,11 @@ pub struct Location {
     pub column: i32,
 }
 
-// NOT `#[derive(Clone)]`. `file` / `namespace` / `line_text` are
-// `Cow<'static, [u8]>` whose `Borrowed` arm may carry a lifetime-erased view
-// into a `Source` (see `init_or_null`, `css_parser.rs`, `error.rs`,
-// `JSBundler.rs`). The derived `Cow::clone` would re-borrow that pointer, so a
-// `BuildMessage` cloned via `Option<Location>::clone()` / `Vec<Data>::clone()`
-// could outlive the source buffer and read poisoned memory. Instead,
-// every `Clone` of a `Location` deep-dupes its borrowed bytes.
-impl Clone for Location {
-    fn clone(&self) -> Self {
-        Location {
-            file: Cow::Owned(self.file.to_vec()),
-            namespace: Cow::Owned(self.namespace.to_vec(
```

**File**: `src/ast/transpiler_cache.rs` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ impl Default for RuntimeTranspilerCache {
 // edge here; the jsc impl casts it back.
 bun_dispatch::link_interface! {
     pub TranspilerCacheImpl[Jsc] {
-        fn get(source: &Source, parser_options: NonNull<()>, used_jsx: bool) -> bool;
+        fn get(source: &Source<'_>, parser_options: NonNull<()>, used_jsx: bool) -> bool;
         fn put(output_code: &[u8], sourcemap: &[u8], esm_record: &[u8]);
         fn is_disabled() -> bool;
     }
```

**File**: `src/ast_jsc/lib.rs` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ pub fn msg_from_js(global_object: &JSGlobalObject, file: Vec<u8>, err: JSValue)
                     .to_owned_slice(),
             ),
             location: Some(Location {
-                file: Cow::Owned(file),
+                file: file.into(),
                 line: 0,
                 column: 0,
                 ..Default::default()
```

**File**: `src/bundler/AstBuilder.rs` (modified, +3/-3)
```diff
@@ -35,12 +35,12 @@ use bun_paths::fs::{Path as FsPath, PathName};
 
 pub(crate) struct AstBuilder<'a, 'bump> {
     pub(crate) bump: &'bump Bump,
-    pub(crate) source: &'a Source,
+    pub(crate) source: &'a Source<'a>,
     pub(crate) source_index: u32,
     pub(crate) stmts: Vec<Stmt>,
     pub(crate) scopes: Vec<*mut Scope>,
     pub(crate) symbols: Vec<Symbol>,
-    pub(crate) import_records: Vec<ImportRecord>,
+    pub(crate) import_records: Vec<ImportRecord<'bump>>,
     pub(crate) named_imports: NamedImports,
     pub(crate) named_exports: NamedExports,
     pub(crate) import_records_for_current_part: Vec<u32>,
@@ -60,7 +60,7 @@ pub(crate) struct AstBuilder<'a, 'bump> {
 impl<'a, 'bump> AstBuilder<'a, 'bump> {
     pub(crate) fn init(
         bump: &'bump Bump,
-        source: &'a Source,
+        source: &'a Source<'a>,
         hot_reloading: bool,
     ) -> Result<Self, OOM> {
         let scope: *mut Scope = bump.alloc(Scope {
```

**File**: `src/bundler/BundleThread.rs` (modified, +1/-1)
```diff
@@ -328,7 +328,7 @@ impl<C: CompletionStruct> BundleThread<C> {
         // SAFETY: `transpiler.log` is the arena-allocated `*mut Log` set up by
         // `configure_bundler`; valid for the lifetime of `heap`. Raw deref so the
         // `&'a mut Transpiler` consumed by `init_and_run` above is not reborrowed.
-        let _ = unsafe { (*(*transpiler_ptr).log).append_to_with_recycled(&mut out_log, true) }; // logger OOM-only
+        unsafe { (*(*transpiler_ptr).log).append_to(&mut out_log) };
         completion.set_log(out_log);
 
         if run.is_ok() {
```

**File**: `src/bundler/Chunk.rs` (modified, +31/-30)
```diff
@@ -37,13 +37,8 @@ pub struct ChunkImport {
     pub(crate) import_kind: ImportKind,
 }
 
-// Lifetime note: string/slice fields below conceptually borrow from the
-// bundler arena. The borrow is erased to
-// `&'static [u8]` (the arena is owned by `BundleV2` and outlives every
-// `Chunk`; see the lifetime-erasure note on `LinkerGraph::bump`) or owns a
-// `Box<[T]>` instead of threading a `'bump` lifetime through the chunk
-// pipeline.
-pub struct Chunk {
+// `'a` is the bundler arena. The keys' borrow of it is still erased (see `LinkerGraph::bump`).
+pub struct Chunk<'a> {
     /// This is a random string and is used to represent the output path of this
     /// chunk before the final output path has been computed. See OutputPiece
     /// for more info on this technique.
@@ -70,7 +65,7 @@ pub struct Chunk {
     /// For code splitting
     pub(crate) cross_chunk_imports: Vec<ChunkImport>,
 
-    pub content: Content,
+    pub content: Content<'a>,
 
     pub entry_point: EntryPoint,
 
@@ -109,7 +104,7 @@ bitflags::bitflags! {
     }
 }
 
-impl Default for Content {
+impl Default for Content<'_> {
     fn default() -> Self {
         Content::Javascript(JavaScriptChunk::default())
     }
@@ -134,7 +129,7 @@ impl Default for Content {
 // Caveat: `Renamer<'r>` still borrows `&'r mut {Number,Minify}Renamer`,
 // so the per-chunk renamer is reborrowed mutably from each part-range task;
 // the printer never writes through it, but the borrow should become `&'r`.
-unsafe impl Send for Chunk {}
+unsafe impl Send for Chunk<'_> {}
 // SAFETY: shared `&Chunk` access during the worker fan-out touches only
 // `compile_results_for_chunk` (UnsafeCell-per-slot, disjoint indices) and
 // `files_with_parts_in_chunk` atomic counters; the remaining fields are
@@ -145,7 +140,7 @@ unsafe impl Send for Chunk {}
 // the matching split-borrow in `generate_compile_result_for_js_chunk`) goes
 // away. Pre-existing; this impl mirrors `unsafe impl Send for Chunk` and
 // the single-pointer fan-out the workers use.
-unsafe impl Sync for Chunk {}
+unsafe impl Sync for Chunk<'_> {}
 
 /// Disjoint-slot output buffer for [`Chunk::compile_results_for_chunk`].
 ///
@@ -193,7 +188,7 @@ impl CompileResultSlots {
     }
 }
 
-impl Default for Chunk {
+impl Default for Chunk<'_> {
     fn default() -> Self {
         Chunk {
             unique_key: b"",
@@ -217,7 +212,7 @@ impl Default for Chunk {
     }
 }
 
-impl Chunk {
+impl<'a> Chunk<'a> {
     /// Write `result` into `compile_results_for_chunk[i]` through a raw
     /// `*mut Chunk`, for the `generate_compile_result_for_*_chunk` worker
     /// callbacks.
@@ -320,7 +315,10 @@ impl Chunk {
         }
     }
 
-    pub(crate) fn get_js_chunk_for_html<'a>(&self, chunks: &'a [Chunk]) -> Option<&'a Chunk> {
+    pub(crate) fn get_js_chunk_for_html<'c>(
+        &self,
+        chunks: &'c [Chunk<'a>],
+    ) -> Option<&'c Chunk<'a>> {
         self.get_js_chunk_index_for_html(chunks).map(|i| &chunks[i])
     }
 
@@ -336,7 +334,10 @@ impl Chunk {
         })
     }
 
-    pub(crate) fn get_css_chunk_for_html<'a>(&self, chunks: &'a [Chunk]) -> Option<&'a Chunk> {
+    pub(crate) fn get_css_chunk_for_html<'c>(
+        &self,
+        chunks: &'c [Chunk<'a>],
+    ) -> Option<&'c Chunk<'a>> {
         // Look up the CSS chunk via the JS chunk's css_chunks indices.
         // This correctly handles deduplicated CSS chunks that are shared
         // across multiple HTML entry points (see issue #23668).
@@ -1344,8 +1345,8 @@ pub struct JavaScriptChunk {
     pub(crate) module_info: Option<Box<analyze_transpiled_module::ModuleInfo>>,
 }
 
-pub struct CssChunk {
-    pub(crate) imports_in_chunk_in_order: Vec<CssImportOrder>,
+pub struct CssChunk<'a> {
+    pub(crate) imports_in_chunk_in_order: Vec<CssImportOrder<'a>>,
     /// When creating a chunk, this is to be an uninitialized slice with
     /// length of `imports_in_chunk_in_order`
     ///
@@ -1357,7 +1358,7 @@ pub struct CssChunk {
     pub(crate) asts: Box<[bun_css::BundlerStyleSheet]>,
 }
 
-impl Drop for CssChunk {
+impl Drop for CssChunk<'_> {
     fn drop(&mut self) {
         // `asts` is a slice of bitwise shallow
         // copies (see `prepareCssAstsForChunk` `ptr::read`). Multiple slots may
@@ -1369,14 +1370,14 @@ impl Drop for CssChunk {
     }
 }
 
-pub struct CssImportOrder {
+pub struct CssImportOrder<'a> {
     pub(crate) conditions: Vec<bun_css::ImportConditions>,
-    pub(crate) condition_import_records: Vec<ImportRecord>,
+    pub(crate) condition_import_records: Vec<ImportRecord<'a>>,
 
-    pub(crate) kind: CssImportOrderKind,
+    pub(crate) kind: CssImportOrderKind<'a>,
 }
 
-impl Drop for CssImportOrder {
+impl Drop for CssImportOrder<'_> {
     fn drop(&mut self) {
         // `conditions`: bitwise-shared across multiple order entries by
         // `findImportedFilesInCSSOrder` (`bitwise_copy(wrapping_conditions)`);
@@ -1391,15 +1392,15 @@ impl Drop for CssImportOrder {
 }
 
 #[derive(strum::IntoStaticStr)]
-
```

#### Recent Merged Pull Requests:
- **PR #47057** (2026-10-27): Upgrade WebKit to 191c6a41380b (@dylan-conway)
- **PR #47037** (2026-10-27): Replace bytemuck with an in-tree crate, bun_pod (@dylan-conway)
- **PR #47035** (2026-10-27): Upgrade WebKit to 982277c9dd3e (@dylan-conway)
- **PR #47008** (2026-10-26): install: print the loaded .env files only with --verbose (@robobun)
- **PR #46980** (2026-10-26): bun lint: give JS plugin nodes and tokens start and end in TypeScript files without an ESLint or oxlint config (@robobun)
- **PR #46960** (closed): resolver: park the cached directories below a busted directory until it is read again (@robobun)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
