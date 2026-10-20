> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source**: github ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Source Version**: `ea6a2c7b`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T19:17:07.775Z  
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
> **Harvest Timestamp**: 2026-10-20T19:17:07.766Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96320 stars

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
- **Issue #45831** (2026-10-19): **minimumReleaseAge is not enforced when the package manifest is already in the install cache**
  *Symptoms*: ### What version of Bun is running?  1.4.3 (also reproduces on 1.4.1)  ### What platform is your computer?  Darwin 25.2.0 arm64  ### What steps can reproduce the bug?  `install.minimumReleaseAge` is not enforced when the package's manifest is already in the install cache. It is enforced with `--no-cache` or a cold cache.  ```sh export BUN_INSTALL_CACHE_DIR="$(mktemp -d)" mkdir a b c for d in a b c; do echo '{ "name": "repro", "private": true, "dependencies": { "happy-dom": "21.0.3" } }' > $d/package.json; done printf '[install]\nminimumReleaseAge = 604800\n' > b/bunfig.toml cp b/bunfig.toml c/  (cd a && bun install)              # warms the cache; no age setting here (cd b && bun install)              # age setting on, warm cache (cd c && bun install --no-cache)   # age setting on, cache bypassed ```  happy-dom 21.0.3 was published 2026-10-15T23:32:07Z, less than 7 days before the run (2026-10-18).  ### What is the expected behavior?  Step `b` fails the same way as step `c`:  ``` error: No version matching "happy-dom" found for specifier "21.0.3" (blocked by minimum-release-age: 604800 seconds) error: happy-dom@21.0.3 failed to resolve ```  ### What do you see instead?  Step `b` installs the version the setting should block:  ``` + happy-dom@21.0.3 9 packages installed [657.00ms] ```  Step `c`, and step `b` with an empty cache, both block it as expected.  ### Additional information  `minimumReleaseAge` is a supply-chain safeguard, so a warm cache that silently bypasses it def

- **Issue #45733** (2026-10-19): **bun check: false TS2321 "Excessive stack depth" with --threads >= 2, clean with --threads=1 and in tsc 7.0.2**
  *Symptoms*: ### What version of Bun is running?  1.4.3+c6da4a4d3 (also reproduces on canary 1.4.4-canary.1+5f5799ed1)  ### What platform is your computer?  Linux 6.18.40.1-microsoft-standard-WSL2 x86_64 (16 cores)  ### What steps can reproduce the bug?  Save the script below as `repro.sh` and run `bash repro.sh ./repro` (creates a 10-file project, installs `@sinclair/typebox@0.34.38` and `typescript@7.0.2`, runs both checkers).  ```bash #!/usr/bin/env bash set -euo pipefail dir="${1:?usage: repro.sh <empty-dir>}" mkdir -p "$dir/src/e" && cd "$dir"  cat > package.json <<'EOF' { "name": "bun-check-threads-repro", "private": true, "type": "module" } EOF  cat > tsconfig.json <<'EOF' {   "compilerOptions": {     "target": "ES2023",     "module": "es2022",     "moduleResolution": "Bundler",     "strict": true,     "skipLibCheck": true,     "noEmit": true,     "types": []   },   "include": ["src"] } EOF  cat > src/a.ts <<'EOF' import './c.js'; EOF  cat > src/b.ts <<'EOF' import { Type } from '@sinclair/typebox'; import { KindSchema } from './d-schema.js';  export function routes(register: (schema: unknown) => void) {   register({     query: Type.Object({       kind: Type.Exclude(KindSchema, Type.Literal('default')),     }),   }); } EOF  cat > src/c.ts <<'EOF' import { Type } from '@sinclair/typebox'; import { KindSchema } from './d-schema.js'; import './f.js';  export function routes(register: (schema: unknown) => void) {   register({     body: Type.Object({       kind: Type.Optional(Type.Exclu

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

### Incident Patch 1: `6673b8eb` (2026-10-20)
**Commit Message**: test: fix 20 flaky tests (#45873)

### What does this PR do?

Fixes 20 causes of flaky tests, found in the annotations of the last 400
CI builds. Only files under `test/` change. No limit or deadline is
raised, and no assertion is dropped except where the table says on which
platform.

Each row was first its own PR. That PR has the CI sightings, the cause
and the numbers in full.

| test file | what went wrong | what changes | write-up |
|---|---|---|---|
| `cli/install/bun-install-streaming-extract.test.ts` | the line taken
for the error could be one of the verbose extract log | those lines are
removed before the `error:` line is looked for | #45842 |
| `cli/install/bun-install-streaming-extract.test.ts` | a body that is
all there at the client's first read is not streamed, so `Streamed ` is
not printed | the fixture is larger than one read of the client holds |
#45844 |
| `js/bun/shell/yield.test.ts` | Windows keeps the working directory of
a killed process busy for a while (`EBUSY` on `rm`); the pid file exists
before the pid is in it | the pid file is named by its full path and
nothing has the directory as its cwd; the waiter waits for the file's
content | #45846 |
| `internal/

**File**: `test/cli/install/bun-install-streaming-extract.test.ts` (modified, +5/-4)
```diff
@@ -1049,8 +1049,9 @@ test.concurrent.each([
   const wideMode = Buffer.from([0x80, 0, 0, 0, 0x80, 0, 0x01, 0xed]);
   const root = "owner-repo-abc1234";
   const index = Buffer.from("module.exports = 'ok';\n");
-  // So the body spans many reads and streaming commits.
-  const bulk = incompressible(256 * 1024, 1);
+  // More than one read of the client holds (LIBUS_RECV_BUFFER_LENGTH): a body that is all there at the first read is
+  // not streamed.
+  const bulk = incompressible(1024 * 1024, 1);
   const tgz = gzipSync(
     Buffer.concat([
       tarHeader(`${root}/`, 0, "5"),
@@ -1608,8 +1609,8 @@ async function installStreamPkg(
       ...(path === "buffered" ? { BUN_FEATURE_FLAG_DISABLE_STREAMING_INSTALL: "1" } : {}),
     });
     results.push({
-      // A line of the verbose log, from another thread, can come before the end of this one.
-      error: stderr.match(/^error: .*$/m)?.[0].replace(/\[stream-pkg\] Extract .*$/, ""),
+      // What another thread writes to the verbose log can come anywhere in this line.
+      error: stderr.replace(/\[stream-pkg\] Extract .*\n(libarchive error: .*\n)?/g, "").match(/^error: .*$/m)?.[0],
       streamed: stderr.includes("Streamed "),
       installed: existsSync(join(String(dir), "node_modules", "stream-pkg")),
       cached: readdirSync(join(String(dir), ".cache")).filter(name => /^(stream-pkg@|@T@)/.test(name)).length,
```

**File**: `test/cli/run/transpiler-cache.test.ts` (modified, +2/-4)
```diff
@@ -140,7 +140,8 @@ describe("transpiler cache", () => {
     writeFileSync(join(temp_dir, "a.js"), dummyFile(50 * 1024, "1", "b"));
     writeFileSync(join(temp_dir, "b.js"), dummyFile(50 * 1024, "2", "b"));
 
-    const remover = Bun.spawn({
+    // Its working directory is temp_dir, which Windows does not let the next test remove while it is alive.
+    await using remover = Bun.spawn({
       cmd: [bunExe(), join(import.meta.dir, "transpiler-cache-aggressive-remover.js"), cache_dir],
       env,
       cwd: temp_dir,
@@ -158,7 +159,6 @@ describe("transpiler cache", () => {
             if (exitCode != 0 && !killing) {
               killing = true;
               processes.forEach(x => x.kill(9));
-              remover.kill(9);
             }
           },
         }),
@@ -169,8 +169,6 @@ describe("transpiler cache", () => {
 
     expect(!killing).toBeTrue();
 
-    remover.kill(9);
-
     for (const proc of processes) {
       expect(proc.exitCode).toBe(0);
       expect(await proc.stdout.text()).toBe("b\n");
```

**File**: `test/internal/harness-max-rss.test.ts` (modified, +5/-3)
```diff
@@ -1,5 +1,5 @@
 import { expect, test } from "bun:test";
-import { bunExe, runCommandMaxRSS } from "harness";
+import { bunExe, isLinux, runCommandMaxRSS } from "harness";
 
 const MiB = 1024 * 1024;
 
@@ -9,11 +9,13 @@ test("runCommandMaxRSS measures the command, not the test runner", async () => {
   // stays that high even if the buffer is collected.
   const ballast = Buffer.alloc(256 * MiB, 1);
   const runnerRSS = process.memoryUsage.rss();
-  expect(runnerRSS).toBeGreaterThan(ballast.length);
+  // Elsewhere a child inherits nothing, and a busy macOS machine no longer
+  // keeps all of the buffer resident by now.
+  if (isLinux) expect(runnerRSS).toBeGreaterThan(ballast.length);
 
   const idle = await runCommandMaxRSS({ cmd: [bunExe(), "-e", "0"] });
   expect(idle).toMatchObject({ stdout: "", stderr: "", exitCode: 0, signalCode: null });
-  expect(idle.maxRSS).toBeLessThan(runnerRSS);
+  if (isLinux) expect(idle.maxRSS).toBeLessThan(runnerRSS);
 
   const busy = await runCommandMaxRSS({
     cmd: [bunExe(), "-e", `console.log(Buffer.alloc(${256 * MiB}, 1).length)`],
```

**File**: `test/js/bun/gc/gc-controller-cadence.test.ts` (modified, +9/-4)
```diff
@@ -228,8 +228,9 @@ describe("idle release", () => {
             const full = resident();
             const deadline = performance.now() + 8000;
             const timer = setInterval(() => {
-              if (resident() > full - 80 && performance.now() < deadline) return;
-              console.log(JSON.stringify({ full, now: resident() }));
+              const now = resident();
+              if (now >= full - 80 && performance.now() < deadline) return;
+              console.log(JSON.stringify({ full, now }));
               process.exit(0);
             }, 100);
           };
@@ -328,8 +329,12 @@ describe("idle release", () => {
       const full = resident();
       expect(full).toBeGreaterThan(330);
       const deadline = performance.now() + 6000;
-      while (resident() > full - 250 && performance.now() < deadline) await Bun.sleep(100);
-      expect(resident()).toBeLessThan(full - 250);
+      let now = resident();
+      while (now >= full - 250 && performance.now() < deadline) {
+        await Bun.sleep(100);
+        now = resident();
+      }
+      expect(now).toBeLessThan(full - 250);
       proc.stdin.write("exit\n");
       await proc.stdin.flush();
       expect(await proc.exited).toBe(0);
```

**File**: `test/js/bun/jsc/bun-jsc.test.ts` (modified, +15/-3)
```diff
@@ -282,23 +282,35 @@ describe("bun:jsc", () => {
       return acc;
     };
 
+    // On a busy machine the sampler thread may still not get to run in that
+    // window, so profile again until it has. A profiler that no longer samples
+    // uses up the time limit, which has to be here: this never yields.
+    const deadline = performance.now() + 5000;
+    const profileUntilSampled = () => {
+      let result;
+      do {
+        result = profile(work, sampleInterval);
+      } while (result.stackTraces.traces.length === 0 && performance.now() < deadline);
+      return result;
+    };
+
     // First profile call
-    const result1 = profile(work, sampleInterval);
+    const result1 = profileUntilSampled();
     expect(result1).toBeDefined();
     expect(result1.functions).toBeDefined();
     expect(result1.stackTraces).toBeDefined();
     expect(result1.stackTraces.traces.length).toBeGreaterThan(0);
 
     // Second profile call - should work after first one completed
     // This verifies that shutdown() -> pause() fix works
-    const result2 = profile(work, sampleInterval);
+    const result2 = profileUntilSampled();
     expect(result2).toBeDefined();
     expect(result2.functions).toBeDefined();
     expect(result2.stackTraces).toBeDefined();
     expect(result2.stackTraces.traces.length).toBeGreaterThan(0);
 
     // Third profile call - verify profiler can be reused multiple times
-    const result3 = profile(work, sampleInterval);
+    const result3 = profileUntilSampled();
     expect(result3).toBeDefined();
     expect(result3.functions).toBeDefined();
     expect(result3.stackTraces).toBeDefined();
```

**File**: `test/js/bun/module-graph/module-graph-io.test.ts` (modified, +12/-8)
```diff
@@ -885,12 +885,12 @@ describe.concurrent("ModuleGraph: an error in what a graph opened is the graph's
       dropRedisConnections() {
         for (const socket of host.redisConnections.splice(0)) socket.end();
       },
-      async closedUdpPort() {
+      // Taken until close(): a socket made for sending to the port cannot be given that very port
+      // as its own, which would leave it hearing itself and never refused.
+      async udpPortToClose() {
         const s = dgram.createSocket("udp4");
         await new Promise(r => s.bind(0, "127.0.0.1", r));
-        const port = s.address().port;
-        await new Promise(r => s.close(r));
-        return port;
+        return { port: s.address().port, close: () => new Promise(r => s.close(r)) };
       },
     };
   `;
@@ -968,8 +968,11 @@ describe.concurrent("ModuleGraph: an error in what a graph opened is the graph's
           "fs.watch listener": boom => {
             const dir = path.join(import.meta.dirname, "watched");
             fs.mkdirSync(dir);
-            const w = fs.watch(dir, () => { w.close(); boom(); });
-            fs.writeFileSync(path.join(dir, "f"), "x");
+            const w = fs.watch(dir, () => { clearInterval(again); w.close(); boom(); });
+            // macOS starts watching on another thread after fs.watch() returns, and reports nothing written before that.
+            const write = () => fs.writeFileSync(path.join(dir, "f"), "x");
+            write();
+            const again = setInterval(write, 5);
           },
           "a read stream's 'data'": boom => { fs.createReadStream(import.meta.filename).on("data", boom); },
           "a zlib stream's 'data'": boom => { const z = zlib.createGzip(); z.on("data", boom); z.end("hello"); },
@@ -1052,8 +1055,9 @@ describe.concurrent("ModuleGraph: an error in what a graph opened is the graph's
         import { host } from "./host.mjs";
         const { promise, resolve } = Promise.withResolvers();
         process.on("uncaughtException", error => resolve("host: " + error.code));
-        const graph = new Bun.ModuleGraph({ globals: { closedPort: await host.closedUdpPort() }, onError: error => resolve("graph: " + error.code) });
-        const { stop } = await graph.import(import.meta.dir + "/tenant.mjs");
+        const { port, close } = await host.udpPortToClose();
+        const graph = new Bun.ModuleGraph({ globals: { closedPort: port }, onError: error => resolve("graph: " + error.code) });
+        const { stop } = await graph.import(import.meta.dir + "/tenant.mjs").finally(close);
         console.log(await promise);
         stop();
         process.exit(0);
```

**File**: `test/js/bun/shell/yield.test.ts` (modified, +8/-7)
```diff
@@ -330,17 +330,18 @@ describe("yield", async () => {
       test.concurrent("the killed member is gone after the rejection", async () => {
         using dir = tempDir("shell-failed-pipeline-pid", {});
         const bun = process.execPath;
-        const writePid = 'require("fs").writeFileSync("pid", String(process.pid)); setTimeout(() => {}, 100_000)';
-        const waitForPid =
-          'while (!require("fs").existsSync("pid")) Bun.sleepSync(5); process.stdout.write("--version")';
+        // By its full path: `dir` is nobody's working directory, which Windows does not let go of until some time
+        // after `kill(pid, 0)` stops finding the process.
+        const pidFile = join(String(dir), "pid");
+        const writePid = `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 100_000)`;
+        // For its content: the file is there before the pid is in it.
+        const waitForPid = `const pid = () => { try { return require("fs").readFileSync(${JSON.stringify(pidFile)}, "utf8"); } catch { return ""; } }; while (!pid()) Bun.sleepSync(5); process.stdout.write("--version")`;
         expect(
           await rejectionOf(
-            $`${bun} -e ${writePid} | ${bun} $(${bun} -e ${waitForPid}) > ${new Response("r")}`
-              .cwd(String(dir))
-              .quiet(),
+            $`${bun} -e ${writePid} | ${bun} $(${bun} -e ${waitForPid}) > ${new Response("r")}`.quiet(),
           ),
         ).toMatchObject({ message: "Blobs are immutable, and cannot be used for stdout/stderr" });
-        const pid = Number(await Bun.file(join(String(dir), "pid")).text());
+        const pid = Number(await Bun.file(pidFile).text());
         expect(pid).toBeGreaterThan(0);
         // The kill is sent before the promise rejects. The shell reaps the
         // child when its exit reaches the event loop, so poll for that.
```

**File**: `test/js/bun/spawn/spawn-stdin-destroy.test.ts` (modified, +2/-1)
```diff
@@ -11,7 +11,8 @@ test("stdin destroy after exit crash", async () => {
       stdin: "pipe",
     });
 
-    await Bun.sleep(80);
+    // The crash was in the first read of `child.stdin` after the exit.
+    await child.exited;
     await child.stdin.write("dylan\n");
     await child.stdin.write("999\n");
     await child.stdin.flush();
```

---

### Incident Patch 2: `b4c02f03` (2026-10-20)
**Commit Message**: test: fix bake.test.ts cleanup and the --check URL on Windows (#46135)

`test/cli/bake/bake.test.ts` fails on Windows CI on unrelated PRs, in
two ways. Both are in the tests.

- `EBUSY` when `tempDir` removes its folder, after the test passed. On
Windows `bun bake` is a manager process with a child in a job object.
Killing the manager ends the child a moment later, so the child can
still hold the folder when the manager's exit resolves. `tempDir`'s
`using` cleanup now retries on `EBUSY` on Windows, for up to 5 seconds.
It loops because `fs.rmSync` parses `maxRetries` and does not act on it.
- `ECONNRESET` or `ECONNREFUSED` in `bun bake --check starts the server
once the type errors are fixed`. The likely cause is that one save
starts the process twice on Windows, and with `--port=0` each start has
its own port, so the first URL stops working. This is inferred from the
errors; I have not reproduced it. The test now uses the last URL
printed, and tries until a deadline.

Not checked on Windows locally: Windows CI on this PR is the check.

**File**: `test/cli/bake/bake.test.ts` (modified, +12/-1)
```diff
@@ -450,7 +450,18 @@ test.concurrent.each([
   );
   const [, url] = await output.waitFor(/url: (http:\/\/\S+)/);
 
-  expect(await get(url, "/missing")).toBe("200 1");
+  // One save can start the process twice on Windows, and each start prints its own port.
+  if (!isWindows) {
+    expect(await get(url, "/missing")).toBe("200 1");
+    return;
+  }
+  const deadline = Date.now() + 10_000;
+  let response = "";
+  while (response !== "200 1" && Date.now() < deadline) {
+    const latest = [...output.text.matchAll(/url: (http:\/\/\S+)/g)].at(-1)![1];
+    response = await get(latest, "/missing").catch(String);
+  }
+  expect(response).toBe("200 1");
 });
 
 // Creating a symlink on Windows needs a privilege that CI does not have.
```

**File**: `test/harness.ts` (modified, +22/-3)
```diff
@@ -611,10 +611,29 @@ export function tempDirWithFiles(
 
 class DisposableString extends String {
   [Symbol.dispose]() {
-    fs.rmSync(this + "", { recursive: true, force: true });
+    // On Windows a process that was just killed can hold the folder for a moment: a child that a job
+    // object ends after its parent, for one. `rmSync` does not act on `maxRetries`.
+    const deadline = Date.now() + 5000;
+    while (true) {
+      try {
+        fs.rmSync(this + "", { recursive: true, force: true });
+        return;
+      } catch (error: any) {
+        if (!isWindows || error?.code !== "EBUSY" || Date.now() > deadline) throw error;
+        sleepSync(50);
+      }
+    }
   }
-  [Symbol.asyncDispose]() {
-    return fs.promises.rm(this + "", { recursive: true, force: true });
+  async [Symbol.asyncDispose]() {
+    const deadline = Date.now() + 5000;
+    while (true) {
+      try {
+        return await fs.promises.rm(this + "", { recursive: true, force: true });
+      } catch (error: any) {
+        if (!isWindows || error?.code !== "EBUSY" || Date.now() > deadline) throw error;
+        await Bun.sleep(50);
+      }
+    }
   }
 }
 
```

---

### Incident Patch 3: `eb807b77` (2026-10-20)
**Commit Message**: bun bake: require() of a built-in, and a route whose import threw (#46017)

bake: require() of a built-in returns its CommonJS export; a failed
route load no longer null-derefs

### What

Two dev server bugs, seen with `jsonwebtoken` (through `jws`) in a
page's server code.

**1. `require()` of a built-in module returned the ESM namespace.**

The dev server printed `require("stream")` as `hmr.builtin("stream")`.
That is the lowering for `import`, and it returns the module namespace
(`{ Duplex, PassThrough, Readable, ... }`), not the `Stream` function.
So `util.inherits(DataStream, require("stream"))` threw `The
"superCtor.prototype" property must be of type object`.

`require()` of a built-in now prints `hmr.requireBuiltin("stream")`,
which calls `import.meta.require(id)`: the same value Bun's `require()`
gives. `.default` of the namespace is not the same for every module (it
differs for `bun:sqlite`), so the fix does not use it. `import` of a
built-in still uses `hmr.builtin()` and still gets the namespace.

**2. After a route module failed to load, the next request threw `null
is not an object (evaluating 'pageModule.mode')`.**

When a dependency of an ES module threw while it lo

**File**: `src/js_printer/lib.rs` (modified, +1/-1)
```diff
@@ -2920,7 +2920,7 @@ pub(crate) mod __gated_printer {
                     self.print_space_before_identifier();
                     self.print_symbol(self.options.hmr_ref);
                     if record.tag == ImportRecordTag::Builtin {
-                        self.print(b".builtin(");
+                        self.print(b".requireBuiltin(");
                     } else {
                         self.print(b".require(");
                     }
```

**File**: `src/runtime/bake/hmr-module.ts` (modified, +42/-13)
```diff
@@ -252,13 +252,16 @@ export class HMRModule {
 
   declare indirectHot: any;
 
-  /** Server-only */
+  /** Server-only. Lowered from an `import` of a built-in module: the ESM namespace. */
   declare builtin: (id: string) => any;
+  /** Server-only. Lowered from a `require()` of a built-in module: what Bun's `require()` returns. */
+  declare requireBuiltin: (id: string) => any;
 }
 if (side === "server") {
   HMRModule.prototype.builtin = (id: string) =>
     // @ts-expect-error
     import.meta.bakeBuiltin(import.meta.resolve(id));
+  HMRModule.prototype.requireBuiltin = (id: string) => import.meta.require(id);
 }
 // prettier-ignore
 HMRModule.prototype.indirectHot = new Proxy({}, {
@@ -346,10 +349,23 @@ export function loadModuleSync(id: Id, isUserDynamic: boolean, importer: HMRModu
       mod.importers.add(importer);
     }
 
-    const { list: depsList } = parseEsmDependencies(mod, deps, loadModuleSync);
+    let depsList: HMRModule[];
+    try {
+      depsList = parseEsmDependencies(mod, deps, loadModuleSync).list;
+    } catch (e) {
+      // A dependency threw before this module's body ran, so the next load evaluates it again.
+      mod.state = State.Stale;
+      throw e;
+    }
     const exportsBefore = mod.exports;
     mod.imports = depsList.map(getEsmExports);
-    load(mod);
+    try {
+      load(mod);
+    } catch (e) {
+      mod.state = State.Error;
+      mod.failure = e;
+      throw e;
+    }
     mod.imports = depsList;
     if (mod.exports === exportsBefore) mod.exports = {};
     mod.cjs = null;
@@ -445,7 +461,14 @@ export function loadModuleAsync<IsUserDynamic extends boolean>(
       mod.importers.add(importer);
     }
 
-    const { list, isAsync } = parseEsmDependencies(mod, deps, loadModuleAsync<false>);
+    let list: (HMRModule | Promise<HMRModule>)[], isAsync: boolean;
+    try {
+      ({ list, isAsync } = parseEsmDependencies(mod, deps, loadModuleAsync<false>));
+    } catch (e) {
+      // A dependency threw before this module's body ran, so the next load evaluates it again.
+      mod.state = State.Stale;
+      throw e;
+    }
     DEBUG.ASSERT(
       isAsync //
         ? list.some(x => x instanceof Promise)
@@ -458,8 +481,7 @@ export function loadModuleAsync<IsUserDynamic extends boolean>(
       ? Promise.all(list).then(
           list => finishLoadModuleAsync(mod, load, list),
           e => {
-            mod.state = State.Error;
-            mod.failure = e;
+            mod.state = State.Stale;
             throw e;
           },
         )
@@ -479,13 +501,20 @@ function finishLoadModuleAsync(mod: HMRModule, load: UnloadedESM[3], modules: HM
     const p = load(mod);
     mod.imports = modules;
     if (p) {
-      return p.then(() => {
-        mod.state = State.Loaded;
-        if (mod.exports === exportsBefore) mod.exports = {};
-        mod.cjs = null;
-        if (shouldPatchImporters) patchImporters(mod);
-        return mod;
-      });
+      return p.then(
+        () => {
+          mod.state = State.Loaded;
+          if (mod.exports === exportsBefore) mod.exports = {};
+          mod.cjs = null;
+          if (shouldPatchImporters) patchImporters(mod);
+          return mod;
+        },
+        e => {
+          mod.state = State.Error;
+          mod.failure = e;
+          throw e;
+        },
+      );
     }
     if (mod.exports === exportsBefore) mod.exports = {};
     mod.cjs = null;
```

**File**: `test/bake/dev/bundle.test.ts` (modified, +107/-0)
```diff
@@ -1169,3 +1169,110 @@ devTest("a render() that does not return a Response is reported as that", {
     }).toEqual({ status: 500, saysWhatIsWrong: true, referenceError: false });
   },
 });
+devTest("require() of a built-in module in server code returns what require() returns", {
+  framework: minimalFramework,
+  files: {
+    "node_modules/cjsdep/package.json": JSON.stringify({ name: "cjsdep", main: "index.js" }),
+    "node_modules/cjsdep/index.js": `
+      var Stream = require("stream");
+      var EventEmitter = require("events");
+      var util = require("util");
+      function DataStream() {}
+      util.inherits(DataStream, Stream);
+      module.exports = {
+        stream: typeof Stream + ":" + typeof Stream.prototype,
+        events: typeof EventEmitter + ":" + typeof EventEmitter.prototype,
+        inherits: new DataStream() instanceof Stream,
+      };
+    `,
+    "routes/index.ts": `
+      import info from "cjsdep";
+      import * as streamNamespace from "stream";
+      export default function () {
+        return new Response(JSON.stringify({ ...info, importReadable: typeof streamNamespace.Readable }));
+      }
+    `,
+  },
+  async test(dev) {
+    await dev.fetch("/").equals({
+      stream: "function:object",
+      events: "function:object",
+      inherits: true,
+      importReadable: "function",
+    });
+  },
+});
+devTest("a route whose import throws on load throws that error again on the next request", {
+  framework: minimalFramework,
+  files: {
+    "dep.cjs": `throw new Error("dep.cjs failed to load");`,
+    "esm-dep.ts": `throw new Error("esm-dep.ts failed to load"); export const value = 1;`,
+    // A top-level await that rejects, after the module started.
+    "tla-dep.ts": `await Promise.resolve(); throw new Error("tla-dep.ts failed to load"); export const value = 1;`,
+    // Reached through require(), so through the synchronous loader: a body that throws, and an import that throws.
+    "sync-body.ts": `throw new Error("sync-body.ts failed to load"); export const value = 1;`,
+    "sync-body.cjs": `module.exports = require("./sync-body.ts").value;`,
+    "sync-import-dep.ts": `throw new Error("sync-import-dep.ts failed to load"); export const value = 1;`,
+    "sync-import.ts": `export { value } from "./sync-import-dep.ts";`,
+    "sync-import.cjs": `module.exports = require("./sync-import.ts").value;`,
+    "routes/index.ts": `
+      import dep from "../dep.cjs";
+      export default function () {
+        return new Response("dep: " + dep);
+      }
+    `,
+    "routes/esm.ts": `
+      import { value } from "../esm-dep.ts";
+      export default function () {
+        return new Response("esm-dep: " + value);
+      }
+    `,
+    "routes/tla.ts": `
+      import { value } from "../tla-dep.ts";
+      export default function () {
+        return new Response("tla-dep: " + value);
+      }
+    `,
+    "routes/sync-body.ts": `
+      import value from "../sync-body.cjs";
+      export default function () {
+        return new Response("sync-body: " + value);
+      }
+    `,
+    "routes/sync-import.ts": `
+      import value from "../sync-import.cjs";
+      export default function () {
+        return new Response("sync-import: " + value);
+      }
+    `,
+  },
+  async test(dev) {
+    for (const [url, message] of [
+      ["/", "dep.cjs failed to load"],
+      ["/esm", "esm-dep.ts failed to load"],
+      ["/tla", "tla-dep.ts failed to load"],
+      ["/sync-body", "sync-body.ts failed to load"],
+      ["/sync-import", "sync-import-dep.ts failed to load"],
+    ]) {
+      for (let i = 0; i < 2; i++) {
+        const response = await dev.fetch(url);
+        const text = await response.text();
+        expect({ url, status: response.status, hasMessage: text.includes(message) }).toEqual({
+          url,
+          status: 500,
+          hasMessage: true,
+        });
+      }
+    }
+    await dev.write("dep.cjs", `module.exports = "fixed";`);
+    await dev.fetch("/").equals("dep: fixed");
+    await dev.write("esm-dep.ts", `export const value = "fixed";`);
+    await dev.fetch("/esm").equals("esm-dep: fixed");
+    await dev.write("tla-dep.ts", `await Promise.resolve(); export const value = "fixed";`);
+    await dev.fetch("/tla").equals("tla-dep: fixed");
+    await dev.write("sync-body.ts", `export const value = "fixed";`);
+    await dev.fetch("/sync-body").equals("sync-body: fixed");
+    await dev.write("sync-import-dep.ts", `export const value = "fixed";`);
+    await dev.fetch("/sync-import").equals("sync-import: fixed");
+  },
+});
```

#### Recent Merged Pull Requests:
- **PR #46159** (2026-10-20): crypto: update root certificates (@Jarred-Sumner)
- **PR #46136** (closed): bun install: peers with ranges that no version satisfies share the same version whatever the packages are called (@dylan-conway)
- **PR #46135** (2026-10-20): test: fix bake.test.ts cleanup and the --check URL on Windows (@alii)
- **PR #46125** (closed): Honour inspect.custom in expect diff output (@robobun)
- **PR #46017** (2026-10-20): bun bake: require() of a built-in, and a route whose import threw (@alii)
- **PR #45996** (2026-10-20): bun bake: the framework names the server-only exports of its pages (@alii)

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

## X. test: fix 20 flaky tests (#45873)

**RULE**:
When implementing operations in `test/cli/install/bun-install-streaming-extract.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6673b8eb`: test: fix 20 flaky tests (#45873). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/cli/install/bun-install-streaming-extract.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  // More than one read of the client holds (LIBUS_RECV_BUFFER_LENGTH): a body that is all there at the first read is
  // not streamed.
  const bulk = incompressible(1024 * 1024, 1);
      // What another thread writes to the verbose log can come anywhere in this line.
      error: stderr.replace(/\[stream-pkg\] Extract .*\n(libarchive error: .*\n)?/g, "").match(/^error: .*$/m)?.[0],
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  // So the body spans many reads and streaming commits.
  const bulk = incompressible(256 * 1024, 1);
      // A line of the verbose log, from another thread, can come before the end of this one.
      error: stderr.match(/^error: .*$/m)?.[0].replace(/\[stream-pkg\] Extract .*$/, ""),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6673b8eb` are properly handled with clean fallback behavior.
