> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source**: github ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Source Version**: `91e7e3b1`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T10:28:47.121Z  
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
> **Harvest Timestamp**: 2026-10-19T10:28:47.113Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96299 stars

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
- **Issue #45733** (2026-10-19): **bun check: false TS2321 "Excessive stack depth" with --threads >= 2, clean with --threads=1 and in tsc 7.0.2**
  *Symptoms*: ### What version of Bun is running?  1.4.3+c6da4a4d3 (also reproduces on canary 1.4.4-canary.1+5f5799ed1)  ### What platform is your computer?  Linux 6.18.40.1-microsoft-standard-WSL2 x86_64 (16 cores)  ### What steps can reproduce the bug?  Save the script below as `repro.sh` and run `bash repro.sh ./repro` (creates a 10-file project, installs `@sinclair/typebox@0.34.38` and `typescript@7.0.2`, runs both checkers).  ```bash #!/usr/bin/env bash set -euo pipefail dir="${1:?usage: repro.sh <empty-dir>}" mkdir -p "$dir/src/e" && cd "$dir"  cat > package.json <<'EOF' { "name": "bun-check-threads-repro", "private": true, "type": "module" } EOF  cat > tsconfig.json <<'EOF' {   "compilerOptions": {     "target": "ES2023",     "module": "es2022",     "moduleResolution": "Bundler",     "strict": true,     "skipLibCheck": true,     "noEmit": true,     "types": []   },   "include": ["src"] } EOF  cat > src/a.ts <<'EOF' import './c.js'; EOF  cat > src/b.ts <<'EOF' import { Type } from '@sinclair/typebox'; import { KindSchema } from './d-schema.js';  export function routes(register: (schema: unknown) => void) {   register({     query: Type.Object({       kind: Type.Exclude(KindSchema, Type.Literal('default')),     }),   }); } EOF  cat > src/c.ts <<'EOF' import { Type } from '@sinclair/typebox'; import { KindSchema } from './d-schema.js'; import './f.js';  export function routes(register: (schema: unknown) => void) {   register({     body: Type.Object({       kind: Type.Optional(Type.Exclu

- **Issue #45643** (2026-10-17): **bun wont exit**
  *Symptoms*: ### What version of Bun is running?  1.4,.3 (1.4+)  ### What platform is your computer?  Microsoft Windows NT 10.0.26300.0 x64  ### What steps can reproduce the bug?  ### bun.exe --version   ### What is the expected behavior?  show version (1.4.3) and exit   ### What do you see instead?  shows 1.4.3 and freezes  ### Additional information  same for --help or other commands. The command gets executed but bun wont terminate.  because of this even install wont run (shows 100% and freezes)  
  **Post-Mortem & Fix Analysis**:
  > okay it is related to Comodo-Firewall.  Looks like even when it is (HIPS) deaktivated it tries to inject code.  so far I didn't found a workaround for this.

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

### Incident Patch 1: `6bb5dc19` (2026-10-19)
**Commit Message**: `bun check`: 1.4x to 7.8x faster on large projects. Fixes for `bun check`, `bun lint` and `bun fmt` (#45800)

### What does this PR do?

Makes `bun check` 1.4 to 7.8 times faster than in Bun 1.4.3 on five
large projects (one small project gets slower, see the known issues),
fixes bugs in `bun check`, `bun lint` and `bun fmt`, and fixes how the
three commands read the command line.

#### `bun check`: speed

8 threads, cold, best of 3. Both print the same number of errors on each
project.

| project | time, 1.4.3 | time, this PR | memory, 1.4.3 | memory, this
PR |
|---|---|---|---|---|
| mui (docs) | 10.28 s | 1.31 s | 11.2 GB | 1.3 GB |
| supabase (studio) | 2.84 s | 1.27 s | 1.0 GB | 1.2 GB |
| t3code (server) | 4.59 s | 1.62 s | 1.0 GB | 1.0 GB |
| mikro-orm | 3.30 s | 1.82 s | 0.9 GB | 1.1 GB |
| vscode | 4.09 s | 2.82 s | 1.6 GB | 1.9 GB |

- **No steps and no barriers.** 1.4.3 split a program into steps.
Between steps, all threads waited for each other and merged what they
had computed. Now each thread picks files from one queue, heavy files
first, and threads share results in small commits while they run. The
old plan, its options and every debugging switch are deleted, about


**File**: `docs/format/index.mdx` (modified, +7/-2)
```diff
@@ -95,6 +95,8 @@ options = { printWidth = 120 }
 
 ## Ignore files
 
+Every `.gitignore` in the repository counts, whichever directory you run `bun fmt` from. Outside a repository, those in the current directory and below it count. With a Prettier config, only the `.gitignore` in the current directory does, because that's the only one Prettier reads.
+
 To skip more than `.gitignore` does, list the files in `bunfig.toml`. A `.prettierignore` file works too.
 
 ```toml bunfig.toml icon="settings"
@@ -146,6 +148,7 @@ import { a, b, c } from "./util";
 - Each group is sorted by path, and the names in `{ }` are sorted too.
 - Two imports from the same module become one.
 - Side-effect imports like `import "./setup"` never move, and nothing moves past one.
+- A comment directly above an import moves with it. Above the first import, comments about the whole file stay at the top: `// @ts-nocheck`, `/// <reference ... />`, `/* eslint-disable */`, `// @flow`, `/** @jsxImportSource ... */`, a license.
 
 To pick your own groups, use a table. See [`format.sortImports`](/runtime/bunfig#format-sortimports).
 
@@ -281,7 +284,9 @@ bun run generate-types | bun fmt --parser typescript > types.ts
 bun fmt --staged
 ```
 
-A file with both staged and unstaged changes isn't written, because staging it again would commit the rest. Bun names the file and exits with code `2`.
+If a file has both staged and unstaged changes, Bun looks at the staged version, which is what the commit gets. It doesn't write such a file, because staging it again would commit the rest. If the staged version needs formatting, Bun names the file and exits with code `2`.
+
+Config files, such as `bunfig.toml` and `.prettierrc`, are read from disk.
 
 `--changed` formats the files that differ from your default branch. Pass a ref to compare with something else.
 
@@ -303,7 +308,7 @@ Already have a `.prettierrc` or an `.oxfmtrc.json`? `bun fmt` reads it and print
 }
 ```
 
-If `package.json` has a `fmt` script, `bun fmt` runs that script. Inside the script, `bun fmt` is the formatter.
+If `package.json` has a `fmt` script, `bun fmt` runs that script. Inside the script, `bun fmt` is the formatter. If `package.json` has `"fmt"` in it but can't be parsed, as in the middle of a merge, `bun fmt` can't tell whether that is a script: it formats nothing and exits with code 2.
 
 Writing a tool that calls Bun in projects you don't control? Pass `--no-script`: `bun fmt --no-script` is always the formatter.
 
```

**File**: `docs/guides/format/migrate-from-prettier.mdx` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ Keep `prettier` if your editor's Prettier extension uses it.
 Bun reads everything Prettier reads:
 
 - `.prettierrc` in JSON, YAML, TOML, JavaScript, or TypeScript, `prettier.config.*`, and `"prettier"` in `package.json`, with `overrides`
-- `.editorconfig`, `.prettierignore`, and `.gitignore`
+- `.editorconfig`, and the `.prettierignore` and `.gitignore` in the current directory
 - `// prettier-ignore` comments and the `@format` and `@noformat` pragmas
 - Every flag of Prettier 3 except `--file-info` and `--support-info`
 
```

**File**: `docs/lint/index.mdx` (modified, +33/-2)
```diff
@@ -46,6 +46,12 @@ To lint specific files, pass paths or globs.
 bun lint src "test/**/*.test.ts"
 ```
 
+An argument that starts with `!` leaves files out of what the other arguments select, as it does for `bun fmt`. This holds with an ESLint or oxlint config too.
+
+```bash terminal icon="terminal"
+bun lint src "!src/generated" "!**/*.test.ts"
+```
+
 The exit code is `1` if there are errors and `0` if there are only warnings.
 
 ## Fix problems
@@ -56,6 +62,8 @@ Many rules can fix what they report. `--fix` applies those fixes and writes the
 bun lint --fix
 ```
 
+`--fix` is for changes that keep what your program does and keep your comments. Where a rule's fix is known to alter behavior or drop a comment, the problem is still reported, but only `--fix-suggestions` or `--fix-dangerously` applies the fix, even if ESLint or oxlint apply it with `--fix`. Each rule's page says which flag it needs.
+
 ## Default rules
 
 With no config, `bun lint` turns on the rules that catch real bugs:
@@ -85,7 +93,7 @@ Each rule's page says what differs and how to change it.
 
 ## Configure rules
 
-Rules live in `bunfig.toml`. Every built-in rule works the same way, with nothing to install.
+Rules live in `bunfig.toml`. Every built-in rule works the same way, with nothing to install. The exceptions are the rules for [JSON and Markdown](/lint/plugins#other-languages), which need an ESLint config.
 
 ```toml bunfig.toml icon="settings"
 [lint.rules]
@@ -162,6 +170,25 @@ Use `*` as the rule name to turn off every rule of a plugin. A setting for a sin
 ignorePatterns = ["vendor/", "**/*.gen.ts"]
 ```
 
+## ES modules and CommonJS
+
+`bun lint` works out whether a file is an ES module or CommonJS from the file itself, the way Node.js does:
+
+- `.mjs` and `.mts` files are modules. `.cjs` and `.cts` files are CommonJS.
+- Any other file is a module if the nearest `package.json` has `"type": "module"`.
+- Otherwise, a file with an `import`, an `export`, `import.meta` or a top-level `await` is a module. A file with none of them is CommonJS.
+
+A CommonJS file can `return` at the top level, and it's only in strict mode if it starts with `"use strict"`.
+
+To decide for every file yourself, set `sourceType` to `"module"`, `"commonjs"` or `"script"`:
+
+```toml bunfig.toml icon="settings"
+[lint.parserOptions]
+sourceType = "commonjs"
+```
+
+Next to an `eslint.config.js`, ESLint's defaults apply instead: `.js` and `.mjs` files are modules and `.cjs` files are CommonJS, unless `languageOptions.sourceType` says otherwise.
+
 ## Disable a rule in code
 
 `bun lint` uses ESLint's comments, so existing ones keep working. oxlint's `oxlint-disable` comments mean the same, except next to an ESLint config, where they are ordinary comments as in ESLint.
@@ -235,6 +262,10 @@ With an oxlint config, `--tsconfig` does what it does in oxlint. It sets the `ts
 bun lint --staged --fix
 ```
 
+If a file has both staged and unstaged changes, Bun lints the staged version, which is what the commit gets. `--fix` doesn't write such a file, because staging it again would commit the rest. If it has something to fix, Bun names the file and exits with code `2`.
+
+The same goes for the files that a staged file imports, which the type-aware rules and the `import` rules read. A file you staged and then deleted is still linted. Config files, such as `bunfig.toml` and `eslint.config.js`, are read from disk.
+
 `--changed` lints the files that differ from your default branch. Pass a ref to compare with something else.
 
 ```bash terminal icon="terminal"
@@ -268,7 +299,7 @@ Already have an `eslint.config.js`, `.eslintrc`, or `.oxlintrc.json`? `bun lint`
 }
 ```
 
-If `package.json` has a `lint` script, `bun lint` runs that script. Inside the script, `bun lint` is the linter.
+If `package.json` has a `lint` script, `bun lint` runs that script. Inside the script, `bun lint` is the linter. If `package.json` has `"lint"` in it but can't be parsed, as in the middle of a merge, `bun lint` can't tell whether that is a script: it lints nothing and exits with code 2.
 
 Writing a tool that calls Bun in projects you don't control? Pass `--no-script`: `bun lint --no-script` is always the linter.
 
```

**File**: `docs/lint/rules/bun-test/consistent-test-it.mdx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ deprecated: false
 
 By default, a test at the top level of a file uses `test`, and a test inside a `describe` uses `it`.
 
-`--fix` renames the call if the file already imports the other name.
+`--fix` renames the call if the file imports the other name from `bun:test`, and no variable around the call has that name.
 
 {/* Generated by src/codegen/lint-rule-docs.ts. Do not edit this section. */}
 
```

**File**: `docs/lint/rules/bun-test/no-unneeded-async-expect-function.mdx` (modified, +8/-11)
```diff
@@ -12,9 +12,9 @@ typeAware: false
 deprecated: false
 ---
 
-`.rejects` and `.resolves` work on a promise, so you can pass the call itself to `expect`. An async function that only awaits the call rejects with the same error, so the wrapper is extra code.
+`.rejects` and `.resolves` work on a promise. `bun test` doesn't call a function for them, so an async function in `expect` fails with `Expected promise`. Pass the call itself.
 
-`--fix` replaces the function with the call.
+`--fix` replaces the function with the call. It leaves a function that has a comment in it alone, because the comment would be lost.
 
 {/* Generated by src/codegen/lint-rule-docs.ts. Do not edit this section. */}
 
@@ -57,20 +57,17 @@ test("rejects an empty name", async () => {
 });
 ```
 
-A function that does more than await one call isn't reported:
+Without `.rejects` or `.resolves` the function is needed, so it isn't reported. `toThrow` calls it and waits for its promise. Given the promise itself, it fails with `Expected value must be a function`:
 
 {/* good */}
 ```ts
 import { expect, test } from "bun:test";
 
-test("rejects a second save", async () => {
-  await expect(async () => {
-    await saveUser({ name: "Ada" });
-    await saveUser({ name: "Ada" });
-  }).rejects.toThrow("name is taken");
+test("rejects an empty name", () => {
+  expect(async () => {
+    await saveUser({ name: "" });
+  }).toThrow("name is required");
 });
 ```
 
-## When not to use it
-
-The two forms differ if the call can throw before it returns a promise. The async function turns that error into a rejection. Without the function, the error is thrown before `expect` runs.
+That form also catches an error that the call throws before it returns a promise. Without the function, such an error is thrown before `expect` runs.
```

**File**: `docs/lint/rules/bun-test/prefer-todo.mdx` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ A test with an empty body passes, so the summary counts a test you haven't writt
 
 A test with only a title is reported too, and so is an empty `test.skip`.
 
-`--fix` rewrites the call to `test.todo` and removes the empty function. A test with options, such as `{ timeout: 500 }`, is reported but not fixed.
+`--fix` rewrites the call to `test.todo` and removes the empty function. It leaves a call with a comment in the function alone, because the comment would be lost. A test with options, such as `{ timeout: 500 }`, is reported but not fixed.
 
 {/* Generated by src/codegen/lint-rule-docs.ts. Do not edit this section. */}
 
```

**File**: `docs/lint/rules/eslint/no-extra-boolean-cast.mdx` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ deprecated: false
 
 The test of an `if`, a loop or a `? :`, the operand of `!`, and the argument of `Boolean()` are already converted to a boolean. Writing `!!value` or `Boolean(value)` there converts twice and gives the same result.
 
-`--fix` removes the cast.
+`--fix` removes the cast. In a TypeScript file, it leaves the test of an `if` or a `? :` alone if the file shows that the value is a function, a promise or an enum member. TypeScript rejects `if (callback)` when `callback` is always defined, and `if (!!callback)` is how people tell it they mean it. `--fix-dangerously` removes those casts too.
 
 This rule is on by default.
 
```

**File**: `docs/lint/rules/eslint/no-implicit-coercion.mdx` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ deprecated: false
 
 `!!value`, `+value` and `"" + value` convert a value as a side effect of an operator. You have to know the trick to see that a conversion happens. `Boolean(value)`, `Number(value)` and `String(value)` say it by name.
 
-`--fix` rewrites `!!value` to `Boolean(value)`. For the conversions to a number or a string, the rewrite is offered as a suggestion.
+`--fix` rewrites `!!value` to `Boolean(value)`. For the conversions to a number or a string, the rewrite is offered as a suggestion. Neither is offered where a comment would be lost, as in `!!(value /* or null */)`.
 
 {/* Generated by src/codegen/lint-rule-docs.ts. Do not edit this section. */}
 
```

---

### Incident Patch 2: `c1df64b8` (2026-10-18)
**Commit Message**: install: fix regressions since 1.4.3 and resolve peer dependencies more like pnpm (#45898)

### What does this PR do?

Follow-up to #45710. It fixes five things that worked in Bun 1.4.3 and
broke on `main`, makes peer dependency resolution work more like pnpm's,
and rewrites the comments, test names and docs from #44968, #45307,
#45460 and #45710 in plain English.

None of the regressions below were ever released.

#### Regressions since 1.4.3

**Flags from npm, Yarn and pnpm no longer fail the command.** `main`
turned every unknown `--flag` into an error, so lines like `bun install
--no-package-lock`, `bun install --network-timeout 100000` or `bun add
--ignore-workspace-root-check x` stopped working in CI scripts and
Dockerfiles. `bun install`, `bun add`, `bun remove` and `bun update` now
ignore about 180 flags of those tools that Bun has no equivalent for,
like 1.4.3 did.

- A few more are translated: `--save-catalog` → `--catalog`,
`--location=global` → `--global`, `--node-linker=…` and
`--install-strategy=…` → `--linker=…`.
- A typo like `--frozen-lockfil` is still an error.
- That includes flags that Bun can't honor, like `--prefix`,
`--workspace`, `--userconfig`, `--tag`, `--

**File**: `docs/pm/cli/install.mdx` (modified, +26/-10)
```diff
@@ -174,7 +174,9 @@ For reproducible installs, use `--frozen-lockfile`. Bun installs the exact versi
 bun install --frozen-lockfile
 ```
 
-`package.json` disagrees with `bun.lock` when a dependency would resolve to a different package, and also when a dependency of the root or of a workspace was added, removed, moved to another group or given another range (`^1.0.0` to `>=1.0.0`) while every package stays as locked. The same goes for `overrides` and `catalog`. Run `bun install` and commit the updated `bun.lock` to fix it. Other edits, such as a workspace's `version`, `bin` or `scripts`, `trustedDependencies` and `patchedDependencies`, do not fail the install. If the `package.json` of a `file:` directory changed its dependencies, Bun prints a warning and installs what is locked.
+`package.json` disagrees with `bun.lock` when an edit adds a package, removes one, or changes a version. The error names the first dependency that changed. Run `bun install` and commit the updated `bun.lock` to fix it.
+
+Edits that keep every package at its locked version don't fail the install. For example, you can change `^1.0.0` to `>=1.0.0`, move a dependency to another group, or add a dependency that another workspace already has. The same goes for a workspace's `version`, `bin` and `scripts`, and for `trustedDependencies` and `patchedDependencies`. If the `package.json` of a `file:` directory changed its dependencies, Bun prints a warning and installs what's locked.
 
 Bun does not enable `--frozen-lockfile` automatically in CI; pass the flag or use `bun ci`. If there is no lockfile at all, `--frozen-lockfile` installs from `package.json` without writing one.
 
@@ -410,7 +412,7 @@ Environment variables take priority over `bunfig.toml`.
 | `BUN_CONFIG_HTTP_RETRY_COUNT`      | How often a failed request is retried (default: 5)        |
 | `BUN_CONFIG_HTTP_RETRY_BACKOFF`    | Wait before the first retry, in ms (default: 50)          |
 
-A request is retried after a connection failure or a 5xx, 429 or 408 response. The wait doubles with every retry, up to 40 times the first one, with ±20% jitter. A longer `Retry-After` header is honored, up to 60 seconds. `BUN_CONFIG_HTTP_RETRY_BACKOFF=0` retries at once. `bun info`, `bun pm whoami`, `bun pm diff` and `bun audit` follow the same rule, but give up after one timeout or a 501. `bun publish` uploads a package once and never retries the upload.
+A request is retried after a connection failure or a 5xx, 429 or 408 response. The wait doubles with every retry, up to 40 times the first one, with ±20% jitter. A longer `Retry-After` header is honored, up to 60 seconds. `BUN_CONFIG_HTTP_RETRY_BACKOFF=0` retries immediately. `bun info`, `bun pm whoami`, `bun pm diff` and `bun audit` follow the same rule, but give up after one timeout or a 501. `bun publish` uploads a package once and never retries the upload.
 
 Bun uses the fastest installation method available on the target platform: `clonefile` on macOS and `hardlink` on Linux and Windows. You can change the installation method with the `--backend` flag. When unavailable or on error, `clonefile` and `hardlink` fall back to a platform-specific implementation of copying files.
 
@@ -496,9 +498,17 @@ Each flag can be repeated, takes `*` to allow every value, and takes `!name` to
 
 ## Peer dependencies?
 
-Bun handles peer dependencies like Yarn: `bun install` installs them automatically. If the dependency is marked optional in `peerDependenciesMeta`, Bun uses an existing dependency if possible.
+`bun install` installs peer dependencies automatically, and picks versions much like pnpm does:
+
+1. If a package above the one with the peer dependency depends on that name, the peer uses that version. "Above" means its parent, its parent's parent, and so on up to your workspace and the root `package.json`. This applies even if the version is out of range: if your app depends on `react@17`, every library that it uses gets `react@17`.
+2. Otherwise, Bun picks one version that satisfies every package with a peer dependency on that name. It prefers a version that's already installed, then the newest matching version in the registry.
+3. If no version satisfies all of them, Bun doesn't install a copy for each one, because packages like `react` or `graphql` break when two copies are loaded. Each package uses an installed version that satisfies its range if there is one. Otherwise, it shares the version that the others use, which is out of its range.
+
+The isolated linker applies these rules everywhere a package is used. The hoisted linker usually installs a package once, and that copy loads whichever version of the peer is nearest to it in `node_modules`. If another version of the peer is at the top of `node_modules`, the packages that need the peer can each get their own copy of it.
 
-If nothing else depends on the peer, Bun installs the newest version that every package asking for it accepts. Otherwise the peer reuses the copy that is already ther
```

**File**: `docs/pm/cli/pm.mdx` (modified, +1/-1)
```diff
@@ -427,7 +427,7 @@ Cache: /home/user/.bun/install/cache
 - Dependencies resolve the way `bun install` resolves them, but `node_modules` is not created, lifecycle scripts do not run, and `package.json` and the lockfile are left untouched.
 - With a lockfile, only what is missing from the cache is downloaded: the tarball URLs and git commits the lockfile records.
 - In a monorepo, you only need the root `package.json` and the lockfile. Bun downloads the dependencies of every workspace in the lockfile, even if the workspace isn't on disk yet. That means a Docker layer with `COPY package.json bun.lock ./` and `RUN bun pm fetch` is only rebuilt when one of those two files changes. Also copy `bunfig.toml` and `.npmrc` if they set a registry. Cache entries are keyed by the registry's host, so without them the later `bun install` downloads everything again. The layer also needs any patch files and local tarballs in the lockfile, and any workspace that the root `package.json` depends on with `workspace:`.
-- A later `bun install` (or `bun install --offline`) installs from the cache. Without a lockfile, `--offline` cannot tell which commit a `github:` ref or which file a tarball URL stands for, so commit the lockfile if you depend on those.
+- A later `bun install` (or `bun install --offline`) installs from the cache. Without a lockfile, `--offline` can't tell which commit a `github:` ref points to or which file a tarball URL serves, so commit the lockfile if you depend on those.
 - Packages for another operating system or CPU are skipped; pass `--os` / `--cpu` to fetch them.
 - `-g` fetches the dependencies of globally installed packages.
 - `--dry-run` prints how many packages are missing from the cache and downloads none of them.
```

**File**: `docs/pm/global-cache.mdx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Configure this with the `--backend` flag, which all of Bun's package management
 - **`copyfile`**: The fallback used when any of the above fail. It is the slowest option. On macOS, it uses `fcopyfile()`; on Linux it uses `copy_file_range()`.
 - **`symlink`**: Symlinks each file instead of copying it. Only hoisted installs use it: `--backend=symlink` applies it to every package (macOS and Linux; Windows ignores the flag); without the flag, Bun uses it only for a package that depends on itself (`"pkg": "file:."`).
 
-`file:` folders, inside or outside the project directory, are hardlinked (copied where that is not possible) without their `node_modules`. `bun install` installs a folder again when a file in it was added, removed or replaced. What a folder lists in `bundleDependencies` is symlinked from its `node_modules`. A folder that a published package ships inside itself (`"dep": "file:./vendor/dep"`) is a single symlink to where it is.
+`file:` folders, inside or outside the project directory, are hardlinked (copied where that is not possible) without their `node_modules`. `bun install` installs a folder again when a file in it was added, removed or replaced. The packages that a folder lists in `bundleDependencies` are symlinked from its `node_modules`. A folder that a published package ships inside itself (`"dep": "file:./vendor/dep"`) is installed as a single symlink to that folder.
 
 If you install with `--backend=symlink`, Node.js doesn't resolve node_modules of dependencies unless each dependency has its own `node_modules` folder or you pass `--preserve-symlinks` to `node`. See [Node.js documentation on `--preserve-symlinks`](https://nodejs.org/api/cli.html#--preserve-symlinks).
 
```

**File**: `docs/pm/isolated-installs.mdx` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ If you encounter issues, you can:
    bun install --linker hoisted
    ```
 
-   Switching linkers in either direction reinstalls the existing `node_modules` from scratch. Dot-directories of other tools, like `.cache` and `.vite`, stay. Those of a package manager, like `.pnpm`, go. The previous tree is moved to `node_modules/.old_modules-<random>` and deleted once the install has succeeded. [`bun prune`](/pm/cli/prune) removes the ones a failed install or an older version of Bun left.
+   Switching linkers in either direction reinstalls the existing `node_modules` from scratch. Dot-directories of other tools, like `.cache` and `.vite`, are kept. Those of a package manager, like `.pnpm`, are removed. The previous tree is moved to `node_modules/.old_modules-<random>` and deleted once the install has succeeded. [`bun prune`](/pm/cli/prune) removes the ones that a failed install or an older version of Bun left behind.
 
    Bun installs through a `node_modules` that is a symlink (the project's or a workspace's), but clears nothing behind the link and prints a warning. Empty the folder yourself before you switch.
 
```

**File**: `docs/pm/lifecycle.mdx` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ Defining `trustedDependencies` in `package.json` **replaces** the default list r
 
 Set `trustedDependencies: []` when you want to opt out of the default allow list entirely without passing `--ignore-scripts` on every install. If you define `trustedDependencies` with an explicit list, include any packages from the [default list](https://github.com/oven-sh/bun/blob/main/src/install/default-trusted-dependencies.txt) whose lifecycle scripts you still need (for example, `sharp` or `esbuild`). Bun no longer trusts those packages implicitly.
 
-The lockfile records the list, also an empty one. In a checkout that leaves out the workspace that declares it (a Docker layer, for example), `bun install --frozen-lockfile` keeps the default list off: of its packages, only those the lockfile records run their scripts.
+The lockfile records the list, even if it's empty. In a checkout without the workspace that declares it (a Docker layer, for example), `bun install --frozen-lockfile` still ignores the default list, and only the packages that the lockfile records run their scripts.
 
 ---
 
```

**File**: `docs/pm/npmrc.mdx` (modified, +2/-2)
```diff
@@ -35,7 +35,7 @@ Bun reads up to two `.npmrc` files. Options in the later file override the earli
 1. The user-level file. This is the file `NPM_CONFIG_USERCONFIG` (npm's `userconfig` option) points at when that variable is set; otherwise `$XDG_CONFIG_HOME/.npmrc` if it exists, otherwise `$HOME/.npmrc`.
 2. The `.npmrc` next to your project's root `package.json`.
 
-Bun warns when one of these files exists but cannot be read. A command that installs or publishes packages then stops with an error. Other commands continue without its settings. A directory in the file's place gets the warning only.
+Like npm, Bun skips any of these files that it can't read.
 
 A relative `cache` or `cafile` is relative to the `.npmrc` it is written in. A relative `NPM_CONFIG_USERCONFIG` is relative to the directory you run `bun` in. In all three, a leading `~/` is your home directory.
 
@@ -80,7 +80,7 @@ The equivalent `bunfig.toml` option is to add a key in [`install.scopes`](/runti
 myorg = "http://localhost:4873/"
 ```
 
-A scope whose registry is empty uses the default registry. If `--registry` or an environment variable names another host than the config files do, a scope that has credentials of its own stays at the registry of the config files.
+A scope whose registry is empty uses the default registry. If `--registry` or an environment variable points to a different host than the config files, a scope that has its own credentials keeps using the registry from the config files.
 
 ### Configure options for a specific registry
 
```

**File**: `docs/pm/workspaces.mdx` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ Each workspace has its own `package.json`. To reference another package in the m
 
 A workspace needs a `"name"`. Bun skips a matched `package.json` that has no `"name"`, such as a test fixture containing only `{ "type": "module" }`. Bun does not link the skipped directory into `node_modules` and does not install its dependencies. If the skipped `package.json` declares dependencies, `bun install` prints a warning that names the directory.
 
-A workspace can be outside the directory of the root `package.json`, for example `"../shared"` or a symlink that leads there. Other packages can depend on it, and `bun.lock` lists it. Like npm, `bun install` does not install its dependencies or run its scripts. Reached by its own path, that directory is a project of its own: `bun install` works there unless it has `workspace:` or `catalog:` dependencies. Reached through the symlink, commands that install (`bun install`, `bun add`, `bun remove`, `bun update`) end with an error and change nothing.
+A workspace can be outside the directory of the root `package.json`, for example `"../shared"` or a symlink that points there. It works like any other workspace: other packages can depend on it, `bun.lock` lists it, and `bun install` installs its dependencies and runs its scripts. Another project may own that directory, so [`bun prune`](/pm/cli/prune) doesn't clean its `node_modules`, and switching linkers doesn't move it aside.
 
 `bun install` installs dependencies for all workspaces in the monorepo, de-duplicating packages if possible. To install dependencies for specific workspaces only, use the `--filter` flag.
 
```

**File**: `docs/runtime/auto-install.mdx` (modified, +3/-3)
```diff
@@ -15,7 +15,7 @@ foo();
 
 The first time you run this script, Bun auto-installs `"foo"` and caches it. Later runs use the cached version.
 
-Auto-install is off when a [security scanner](/runtime/bunfig#install-security-scanner) is configured in the global `.bunfig.toml`, or in a `bunfig.toml` from the working directory or the importing file up to the [project root](#project-root). It is also off when one of those files, a `.npmrc`, or a `package.json` that Bun reads to find the project root cannot be read or parsed. `-i` and `--install` do not turn it back on. The import fails and tells you to run `bun install`.
+Auto-install is off when a [security scanner](/runtime/bunfig#install-security-scanner) is configured in the global `.bunfig.toml`, or in a `bunfig.toml` from the working directory or the importing file up to the [project root](#project-root). It is also off when one of those files can't be parsed, or when a `package.json` that Bun reads to find the project root can't be read or parsed. `-i` and `--install` do not turn it back on. The import fails and tells you to run `bun install`.
 
 ---
 
@@ -64,7 +64,7 @@ The first import of a package that is not in the cache blocks the thread until t
 
 The import fails if the registry sends nothing for about 30 seconds (`BUN_CONFIG_HTTP_IDLE_TIMEOUT` changes that).
 
-When the registry answers that a package does not exist (404), Bun does not ask for it again for 5 minutes, or less if the response's `Cache-Control` says so. After any other failure of a lookup or a download, such as a 5xx or a dropped connection, Bun retries the request a few times. If the import still fails, an import in a later turn of the event loop (after a timer or I/O) asks again.
+When the registry responds that a package doesn't exist (404), Bun doesn't request it again for 5 minutes, or less if the response's `Cache-Control` says so. After any other failure of a lookup or a download, such as a 5xx or a dropped connection, Bun retries the request a few times. If the import still fails, an import in a later turn of the event loop (after a timer or I/O) sends the request again.
 
 When Bun cannot write to the cache, on a read-only file system for example, packages that are already in the cache still load. An import that needs a download throws the same error as an import of a missing package, with the reason as a note.
 
@@ -89,7 +89,7 @@ Auto-install replaces `${NAME}` with a variable from the environment of the scri
 
 Bun installs and caches packages into `<cache>/<pkg>@<version>`, so Bun can cache multiple versions of the same package at once. It also creates a symlink under `<cache>/<pkg>/<version>` to speed up looking up all cached versions of a package.
 
-A package whose tarball ships a `node_modules` folder (`bundledDependencies`) loads what is in that folder from there, and its other dependencies from the cache.
+A package whose tarball ships a `node_modules` folder (`bundledDependencies`) loads the packages in that folder from there, and its other dependencies from the cache.
 
 ---
 
```

---

### Incident Patch 3: `5667cd6c` (2026-10-18)
**Commit Message**: sql: fixes for problems found after the consolidation (#45304) (#45711)

### What does this PR do?

Follow-up fixes to #45304, and three older bugs that were found on the
way. Each is something that an ordinary program can run into.

#### Regressions of #45304

**A pool that the server refuses more connections dialed again for every
caller that had to wait.** Since #45304 a pool that lost connections
grows back: a caller that has to wait makes the pool dial, unless a dial
in flight covers it. When `max` is above the number of connections the
server has left (several processes whose `max` adds up to more than
`max_connections`), those dials are refused, nothing remembered that,
and every waiting caller cost another refused login: a forked backend
and a FATAL line in the server's log each. The client paid too: it got
through 40 % of the queries.

| A real PostgreSQL with 7 free slots, `max: 20`, a 20 ms query every 2
ms for 5 s | before #45304 | after #45304 |
|---|---|---|
| refused logins | 13 | about 1,750 |
| queries issued | about 2,310 | about 920 |

With no connection ready (none, all reserved, only dials in flight) the
pool still dials until `max`, and reads no clock and no m

**File**: `docs/runtime/sql.mdx` (modified, +22/-3)
```diff
@@ -635,7 +635,7 @@ Simple queries cannot use parameters (`${value}`). If you need parameters, split
 These rules apply to every string with several statements, also through `sql.file` and `sql.unsafe`:
 
 - On PostgreSQL and MySQL, the query resolves to an array with one result per statement.
-- On SQLite, every statement runs and the query resolves to one result. It holds the rows of the first statement if that statement returns rows. Otherwise its `count` is the number of rows that all the statements changed. Only the first statement can have parameters.
+- On SQLite, every statement runs and the query resolves to one result. It holds the rows of the first statement if that statement returns rows. Otherwise its `count` is the number of rows that all the statements changed. Only the first statement can have parameters. Bun refuses a later statement that has one when it reaches it, like any other statement that fails.
 - Only PostgreSQL runs the string as one implicit transaction. On MySQL and SQLite, the statements before a failing one stay applied. Wrap the call in [`sql.begin`](#transactions) if you need all or nothing.
 
 ### Queries in files
@@ -718,7 +718,25 @@ What `cancel()` does depends on how far the query got:
 
 ### Unhandled rejections
 
-`.then()` and `.catch()` return a promise like any other. When it rejects and nothing handles the rejection, Bun reports an unhandled rejection, which ends the process unless you listen for [`unhandledRejection`](https://nodejs.org/api/process.html#event-unhandledrejection). So does an error that your `.finally()` callback throws. A query that you only start, with `.execute()` or `.finally()`, is the exception: once it has a connection, its own failure is not reported, and the error is lost. On SQLite, `.execute()` outside a transaction does report it. Add a `.catch()` to a query that you start and do not await:
+`.then()` and `.catch()` return a promise like any other. When it rejects and nothing handles the rejection, Bun reports an unhandled rejection, which ends the process unless you listen for [`unhandledRejection`](https://nodejs.org/api/process.html#event-unhandledrejection). So does an error that your `.finally()` callback throws.
+
+A query that you only start, with `.execute()` or `.finally()`, is the exception. Its own failure is not reported, and the error is lost, when:
+
+- The query had a connection: the server refused it, or the connection was lost.
+- `close({ timeout: 0 })` closed the pool while the query waited for a connection.
+- You called `.cancel()` before you started it.
+- Its reservation was released, or its transaction or savepoint has ended.
+
+After `.execute()`, Bun does report the failure when:
+
+- It cannot connect: nothing listens, the login fails or the connection times out.
+- The pool was already closed.
+- The time of `close({ timeout })`, with a timeout above 0, runs out while the query waits for a connection.
+- You call `.cancel()` while the query waits for a connection.
+- It cannot build the query or read the file of `sql.file()`.
+- The adapter is SQLite and the query runs outside a transaction.
+
+Add a `.catch()` to a query that you start and do not await:
 
 ```ts
 sql`UPDATE stats SET hits = hits + 1`.catch(err => console.error(err));
@@ -1170,6 +1188,7 @@ The adapters differ in two ways:
 The `tx` client belongs to its transaction. Once Bun has sent `COMMIT` or `ROLLBACK`, a query on `tx` never reaches the database. It rejects with `ERR_POSTGRES_INVALID_TRANSACTION_STATE`, or the same code with `MYSQL` or `SQLITE`.
 
 Queries are lazy, so this includes a query that you create inside the callback and first await later. Await every query inside the callback, or return the queries in an array.
+`sql.begin` resolves once the database has answered `COMMIT`. If the connection is lost while `COMMIT` is unanswered, `sql.begin` rejects and nobody can know whether the transaction was committed, so check before you run it again.
 
 ```ts
 let late;
@@ -1372,7 +1391,7 @@ await Promise.all([
 - `sql.begin` and `sql.reserve` need a connection of their own, so they wait for an idle one.
 - Bun serves the callers that wait for a connection oldest first.
 - A pool that lost some of its connections opens new ones when queries have to wait.
-- When Bun cannot open a new connection, callers wait for the connections that are open. They reject with the error of that attempt only when the pool has no connection left.
+- When Bun cannot open a new connection, callers wait for the connections that are open. They reject with the error of that attempt only when the pool has no connection left. A caller that finds every open connection reserved makes Bun try again at once. While an open connection can still take queries, Bun adds at most one connection at a time for the queries that wait, and after each failed attempt it pauses before the next: a few tens of milliseconds at first, then twice as long each time, up to 1 second.
 - Bun clo
```

**File**: `packages/bun-types/sql.d.ts` (modified, +9/-2)
```diff
@@ -907,9 +907,16 @@ declare module "bun" {
      * What `then()` and `catch()` return is a promise like any other: when it
      * rejects with nothing to handle the rejection, that is reported as an
      * unhandled rejection. So is an error that a `finally()` callback throws.
+     *
      * The failure of a query that was only started, with `execute()` or
-     * `finally()`, is not reported once it has a connection. On SQLite,
-     * `execute()` outside a transaction does report it.
+     * `finally()`, is not reported once it has a connection, nor when
+     * `close({ timeout: 0 })` closes the pool while it waits for one, when it
+     * was cancelled before it started, or when its reservation, transaction or
+     * savepoint has ended. After `execute()`, a failure to connect, a pool that
+     * was already closed, a `cancel()` or the end of the time of
+     * `close({ timeout })`, with a timeout above 0, while it waits for a
+     * connection, and a query that cannot be built are reported. So is the
+     * failure of a query that SQLite runs outside a transaction.
      *
      * Bun reads the parameters when it sends the query. Leave a `Buffer`,
      * `TypedArray`, `Date` or object that you passed alone until the query
```

**File**: `src/js/bun/sql.ts` (modified, +13/-1)
```diff
@@ -102,6 +102,8 @@ class Scope implements Target {
   /// The caller's statements pass. close() and release() clear it in the call, COMMIT and ROLLBACK where they are handed over.
   accepting = true;
   finishing: Promise<any> | null = null;
+  /// The callback is over and run() waits for the answer to the end. Only that answer settles the transaction.
+  awaitingAnswer = false;
   error: Error | null = null;
   running = new Set<Query>();
   children = new Set<Scope>();
@@ -209,6 +211,10 @@ function onQueryConnected(
 ) {
   query[_waiter] = null;
   if (err) {
+    // The caller dropped it while it waited. As in onQuerySettled(): one that is only started ends no process.
+    if (this.closedAtOnce) {
+      $pokePromiseAsHandled(query);
+    }
     return query.reject(err);
   }
   pooledConnection!.bindQuery?.(query);
@@ -217,6 +223,9 @@ function onQueryConnected(
 
 function dispatchToPool(this: Client, query: Query, handle: QueryHandle) {
   const pool = this.pool;
+  if (pool.closed) {
+    return query.reject(pool.connectionClosedError());
+  }
   pool.connect((query[_waiter] = onQueryConnected.bind(pool, query, handle)));
 }
 
@@ -262,6 +271,8 @@ function dispatch(this: Scope, query: Query, handle: QueryHandle) {
     // SQLite ends a transaction inside some failing statements. What follows would run in autocommit.
     (this.kind !== Kind.reservation && this.pool.isInTransaction?.(this.connection) === false)
   ) {
+    // as in onQuerySettled()
+    $pokePromiseAsHandled(query);
     return query.reject(refusal(this));
   }
   start(this, query, handle);
@@ -396,7 +407,7 @@ function abandon(scope: Scope, err: Error | null) {
   }
   abandonChildren(scope, err);
   // savepoint() settles when its callback does.
-  if (scope.kind === Kind.transaction) {
+  if (scope.kind === Kind.transaction && !scope.awaitingAnswer) {
     const failure = scope.failure;
     settle(scope, scope.reject, failure !== null && err !== null ? withCause(err, failure.error) : refusal(scope));
   }
@@ -562,6 +573,7 @@ async function run(scope: Scope, callback: TransactionCallback) {
   }
 
   let answer: { command?: string | null } | undefined;
+  scope.awaitingAnswer = true;
   try {
     answer = await finish(scope, failure === null, undefined);
   } catch (err) {
```

**File**: `src/js/internal/sql/options.ts` (modified, +56/-22)
```diff
@@ -12,11 +12,20 @@ type AnyOptions = Bun.SQL.__internal.AnyOptions;
 type TLSOptions = Bun.SQL.TLSOptions;
 
 const ObjectDefineProperty = Object.defineProperty;
+const ObjectGetPrototypeOf = Object.getPrototypeOf;
 const ObjectHasOwn = Object.hasOwn;
+const ObjectPrototype = Object.prototype;
 const kInspectCustom = Symbol.for("nodejs.util.inspect.custom");
 const env = Bun.env;
 
+/** `Bun.env` inherits from `Object.prototype`, and what is there is no variable. */
+function envVar(name: string): string | undefined {
+  return ObjectHasOwn(env, name) ? env[name] : undefined;
+}
+
 const SQLITE_MEMORY = ":memory:";
+const REDACTED = "[REDACTED]";
+const SCHEME = /^[a-z][a-z0-9+.-]*$/i;
 const SUPPORTED_ADAPTERS = `"postgres", "sqlite", "mysql", "mariadb"`;
 
 function decodeIfValid(value: string | null | undefined): string | null {
@@ -143,7 +152,7 @@ function urlFromEnvironment(
 
     for (let i = 1; i < row.length; i++) {
       const name = row[i] as string;
-      const url = env[name];
+      const url = envVar(name);
       if (!url) continue;
 
       const tls = name.startsWith("TLS_");
@@ -220,10 +229,17 @@ const SERVER_OPTIONS = [
   "onclose",
 ];
 
+/** What somebody put on `Object.prototype` is not the caller's. What the caller's own prototypes have is. */
+function isFromObjectPrototype(object: object | null, name: string): boolean {
+  if (!ObjectHasOwn(ObjectPrototype, name)) return false;
+  while (object && object !== ObjectPrototype && !ObjectHasOwn(object, name)) object = ObjectGetPrototypeOf(object);
+  return !object || object === ObjectPrototype;
+}
+
 /** `options` has the own keys of `source` already. Every key is read once: a getter is the caller's code. */
 function readInherited(options: AnyOptions, source: AnyOptions, names: string[]) {
   for (const name of names) {
-    if (ObjectHasOwn(options, name)) continue;
+    if (ObjectHasOwn(options, name) || isFromObjectPrototype(source, name)) continue;
     const value = source[name];
     if (value !== undefined) options[name] = value;
   }
@@ -245,7 +261,7 @@ function resolveTarget(
     first = undefined;
   }
   const readsEnvironment = target === null;
-  const options: AnyOptions = { ...first, ...second };
+  const options = { __proto__: null, ...first, ...second } as unknown as AnyOptions;
   // An options object that stands alone behind a URL, or behind nothing, also gives what it inherits.
   const inherits = first ? null : second;
   if (inherits) readInherited(options, inherits, TARGET_OPTIONS);
@@ -298,7 +314,9 @@ function resolveTarget(
         ? "postgres"
         : adapterFromScheme(scheme);
     if (!adapter) {
-      throw new Error(`Unsupported protocol: ${scheme}. Supported adapters: ${SUPPORTED_ADAPTERS}`);
+      // Without a scheme, what is in front of a `://` further back can be anything.
+      const named = SCHEME.test(scheme) ? scheme : REDACTED;
+      throw new Error(`Unsupported protocol: ${named}. Supported adapters: ${SUPPORTED_ADAPTERS}`);
     }
   }
 
@@ -375,11 +393,20 @@ function parseSQLiteOptions(target: string | URL | null, options: AnyOptions): B
   const safeIntegers = options.safeIntegers ?? options.bigint;
   if (safeIntegers !== undefined) sqliteOptions.safeIntegers = safeIntegers;
 
-  if (sqliteOptions.transform != null) sqliteOptions.transform = parseTransform(sqliteOptions.transform);
+  const transform = options.transform;
+  if (transform != null) sqliteOptions.transform = parseTransform(transform);
 
   return sqliteOptions;
 }
 
+/** What an error may say of a connection URL that cannot be parsed: anything behind the scheme can be a password. */
+function withoutSecrets(value: string): string {
+  const start = value.indexOf("://") + 3;
+  // The `://` is further back, and anything can be in front of it.
+  if (!SCHEME.test(value.slice(0, start - 3))) return REDACTED;
+  return value.slice(0, start) + (value.startsWith(SQLITE_MEMORY, start) ? SQLITE_MEMORY : REDACTED);
+}
+
 function parseServerUrl(
   target: string | URL,
   adapter: Adapter,
@@ -392,7 +419,7 @@ function parseServerUrl(
     const value = target.includes("://") ? target : `${adapter}://${target}`;
     try {
       url = new URL(value);
-    } catch (e) {
+    } catch {
       // `new URL()` refuses credentials or a port without a host. libpq takes the host from elsewhere.
       const start = value.indexOf("://") + 3;
       let end = start;
@@ -403,13 +430,18 @@ function parseServerUrl(
         if (withHost) return [withHost, ""];
       }
 
+      // The error of `new URL()` has the whole string.
+      const input = withoutSecrets(value);
       if (adapterOption && value.includes("sqlite")) {
         throw new Error(
-          `Invalid URL '${value}' for ${adapterOption}. Did you mean to specify \`{ adapter: "sqlite" }\`?`,
-          { cause: e },
+          `Invalid URL '${input}' for ${adapterOption}. Did you mean to specify \`{ adapter: "sqlite" }\`?`,
         );
       }
-      throw e;
+      
```

**File**: `src/js/internal/sql/pool.ts` (modified, +41/-9)
```diff
@@ -207,7 +207,7 @@ class PooledConnection<ConnectionHandle extends NativeConnection = any> {
       return false;
     }
     // an explicit connectionTimeout of 0 disables the connect timer, and with it the retry budget
-    const connectionTimeout = adapter.connectionInfo.connectionTimeout ?? 30 * 1000;
+    const connectionTimeout = $getByIdDirect(adapter.connectionInfo, "connectionTimeout") ?? 30 * 1000;
     return connectionTimeout > 0 && monotonicNowMs() - this.connectStartedAt < connectionTimeout;
   }
 
@@ -336,7 +336,7 @@ function sameSettings(a: BaseSQLAdapter<any, any>, b: BaseSQLAdapter<any, any>):
       return false;
     }
   }
-  return x.transform?.column.from === y.transform?.column.from;
+  return $getByIdDirect(x, "transform")?.column.from === $getByIdDirect(y, "transform")?.column.from;
 }
 
 /// bun --hot only. This module and the open connections outlive a reload, the `new SQL()` of the program does not.
@@ -413,7 +413,8 @@ async function createPooledConnectionHandle<ConnectionHandle>(
     foundRows,
     channelBinding,
     transform,
-  } = options;
+    // Not what `Object.prototype` has for a key that is not set.
+  } = { __proto__: null, ...options } as unknown as typeof options;
 
   // What script of a disposed Bun.ModuleGraph starts does not start: nothing is dialed, and what
   // waits for this connection waits.
@@ -503,6 +504,11 @@ abstract class BaseSQLAdapter<ConnectionHandle extends NativeConnection, QueryHa
   public saslprep: boolean | undefined;
   /// One login is finding out which form the server has. Nothing else is dialed until it has settled.
   #dialsHeld = false;
+  /// The most connections it has had open at once since a dial last failed, when that was, and how often it has
+  /// asked for one more since the last login, see #dialForQueued().
+  #most = 0;
+  #refusedAt = -Infinity;
+  #tries = 0;
   public readonly generation: number = hotReloadGeneration();
   /// see retireUnusedPools()
   public asked: boolean = false;
@@ -553,7 +559,9 @@ abstract class BaseSQLAdapter<ConnectionHandle extends NativeConnection, QueryHa
     this.connectionInfo = connectionInfo;
     this.ownerGraphFrame = AsyncContextFrame.currentGraphFrame();
     this.callbackAsyncContext =
-      connectionInfo.onconnect || connectionInfo.onclose ? AsyncContextFrame.current() : undefined;
+      $getByIdDirect(connectionInfo, "onconnect") || $getByIdDirect(connectionInfo, "onclose")
+        ? AsyncContextFrame.current()
+        : undefined;
     if (this.generation !== -1) {
       hotPools.add(this);
     }
@@ -563,6 +571,9 @@ abstract class BaseSQLAdapter<ConnectionHandle extends NativeConnection, QueryHa
     return this.#closing !== null;
   }
 
+  /// close({ timeout: 0 }) was called: the caller gave up on what is queued.
+  public closedAtOnce: boolean = false;
+
   abstract array(values: any[], typeNameOrID?: number | ArrayType): SQLArrayParameter;
   abstract getDistributedTransactionCommands(name: string): TransactionCommands | null;
 
@@ -649,7 +660,9 @@ abstract class BaseSQLAdapter<ConnectionHandle extends NativeConnection, QueryHa
   }
 
   /// For the callers that wait. If no connection is ready, the pool is started: it dials until `max` is reached.
-  /// Otherwise it grows by one dial for each waiting caller that no dial in flight covers.
+  /// Otherwise it grows by one dial for each waiting caller that no dial in flight covers: back to what it has had
+  /// since a dial last failed, and by one more 20 ms after that, a pause that doubles with each such try, up to 1 s.
+  /// A login ends it.
   #dialForQueued() {
     if (this.queue.length !== 0) {
       this.#dial(this.readyConnections.size === 0);
@@ -658,15 +671,20 @@ abstract class BaseSQLAdapter<ConnectionHandle extends NativeConnection, QueryHa
 
   #dial(start: boolean) {
     const connections = this.connections;
+    const pause = Math.min(20 * 2 ** this.#tries, 1000);
+    const limit = start ? 0 : this.#most + (monotonicNowMs() - this.#refusedAt < pause ? 0 : 1);
     while (
       !this.#dialsHeld &&
       connections.length < this.connectionInfo.max &&
       this.#closing === null &&
-      (start || this.#connecting() < this.queue.length)
+      (start || (connections.length < limit && this.#connecting() < this.queue.length))
     ) {
       if (!this.#adopt()) {
         const connection = new PooledConnection(this);
         connections.push(connection);
+        if (!start && connections.length > this.#most) {
+          this.#tries++;
+        }
         connection.dial();
         if (connection.otherPassword === true && this.saslprep === undefined) {
           this.#dialsHeld = true;
@@ -736,7 +754,8 @@ abstract class BaseSQLAdapter<ConnectionHandle extends NativeConnection, QueryHa
   #serveNext(): boolean {
     const queue = this.queue;
     let reservationsAhead = 0;
-    for (let i = 0; i < queue.length; i++) {
+    // Behind as many reservations as there are connections nobody can be
```

**File**: `src/js/internal/sql/postgres.ts` (modified, +2/-2)
```diff
@@ -598,7 +598,7 @@ class ListenConnection {
               resolve(conn);
               this.#clearSweep();
               this.#sweep();
-              adapter.runUserCallback(adapter.connectionInfo.onconnect, null);
+              adapter.runUserCallback($getByIdDirect(adapter.connectionInfo, "onconnect"), null);
             }),
             adapter.ownerCallback(err => {
               err ??= adapter.connectionClosedError();
@@ -612,7 +612,7 @@ class ListenConnection {
                 for (const entry of this.#channels.values()) entry.ready = null;
                 this.#scheduleSweep();
               }
-              adapter.runUserCallback(adapter.connectionInfo.onclose, err);
+              adapter.runUserCallback($getByIdDirect(adapter.connectionInfo, "onclose"), err);
             }),
             undefined,
             login,
```

**File**: `src/js/internal/sql/query.ts` (modified, +2/-0)
```diff
@@ -129,6 +129,8 @@ class Query<T, Handle extends BaseQueryHandle<any>> extends PublicPromise<T> {
     }
 
     if (status & SQLQueryStatus.cancelled) {
+      // as in onQuerySettled()
+      $pokePromiseAsHandled(this);
       this.reject(this[_adapter].queryCancelledError());
       return;
     }
```

**File**: `src/js/internal/sql/shared.ts` (modified, +4/-2)
```diff
@@ -393,12 +393,12 @@ class QueryBuilder {
   }
 
   undefinedValue(): unknown {
-    return this.adapter.connectionInfo.transform?.undefined;
+    return $getByIdDirect(this.adapter.connectionInfo, "transform")?.undefined;
   }
 
   identifier(name: string | number): string {
     const { quote, connectionInfo } = this.adapter;
-    const to = connectionInfo.transform?.column.to;
+    const to = $getByIdDirect(connectionInfo, "transform")?.column.to;
     name = String(to === undefined ? name : to(String(name)));
     if (name.includes("\0")) {
       throw $ERR_INVALID_ARG_VALUE("name", name, "must not contain null bytes");
@@ -607,6 +607,8 @@ export interface DatabaseAdapter<Connection, ConnectionHandle, QueryHandle> exte
 
   isConnected(): boolean;
   get closed(): boolean;
+  /** close({ timeout: 0 }) was called: the caller gave up on what is queued. */
+  readonly closedAtOnce?: boolean;
 
   readonly supportsReservedConnections: boolean;
   /** `true`: `onConnected` was still queued and will never run. */
```

#### Recent Merged Pull Requests:
- **PR #45959** (2026-10-19): dev error overlay: the look of bun.com, and errors of one kind in one card (@alii)
- **PR #45957** (closed): install: refetch the manifest once when a tarball named by a cached copy fails (@robobun)
- **PR #45921** (2026-10-19): dev error overlay: scroll, show duplicate errors once, underline the whole css url() (@alii)
- **PR #45911** (2026-10-19): bun bake: getServerSideProps, getStaticProps and getStaticPaths (@alii)
- **PR #45905** (2026-10-18): bun bake: .tsx pages and frameworks in bake.config.ts (@alii)
- **PR #45902** (2026-10-18): bun bake: start again when bake.config.ts changes (@alii)

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

## X. `bun check`: 1.4x to 7.8x faster on large projects. Fixes for `bun check`, `bun 

**RULE**:
When implementing operations in `docs/format/index.mdx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6bb5dc19`: `bun check`: 1.4x to 7.8x faster on large projects. Fixes for `bun check`, `bun lint` and `bun fmt` (#45800). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/format/index.mdx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Every `.gitignore` in the repository counts, whichever directory you run `bun fmt` from. Outside a repository, those in the current directory and below it count. With a Prettier config, only the `.gitignore` in the current directory does, because that's the only one Prettier reads.

- A comment directly above an import moves with it. Above the first import, comments about the whole file stay at the top: `// @ts-nocheck`, `/// <reference ... />`, `/* eslint-disable */`, `// @flow`, `/** @jsxImportSource ... */`, a license.
If a file has both staged and unstaged changes, Bun looks at the staged version, which is what the commit gets. It doesn't write such a file, because staging it again would commit the rest. If the staged version needs formatting, Bun names the file and exits with code `2`.

Config files, such as `bunfig.toml` and `.prettierrc`, are read from disk.
If `package.json` has a `fmt` script, `bun fmt` runs that script. Inside the script, `bun fmt` is the formatter. If `package.json` has `"fmt"` in it but can't be parsed, as in the middle of a merge, `bun fmt` can't tell whether that is a script: it formats nothing and exits with code 2.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
A file with both staged and unstaged changes isn't written, because staging it again would commit the rest. Bun names the file and exits with code `2`.
If `package.json` has a `fmt` script, `bun fmt` runs that script. Inside the script, `bun fmt` is the formatter.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6bb5dc19` are properly handled with clean fallback behavior.
