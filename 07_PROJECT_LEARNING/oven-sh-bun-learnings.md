> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source**: github ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Source Version**: `73b53109`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T22:14:01.176Z  
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
> **Harvest Timestamp**: 2026-10-28T22:14:01.171Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96453 stars

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
- **Issue #47214** (2026-10-28): **`bun fmt`: keeps trailing whitespace in Markdown code blocks, where Prettier strips it**
  *Symptoms*: ### What version of Bun is running?  1.4.4+38afee6c8  ### What platform is your computer?  Darwin 27.0.0 arm64 arm  ### What steps can reproduce the bug?  In an empty directory, with no Prettier or Bun config:  ```sh printf '```\nA\n   \nB\n```\n' > x.md bun fmt --check x.md; echo "exit=$?" bunx prettier@3.9.10 --check x.md; echo "exit=$?" ```  The third line of the code block holds three spaces and nothing else.  ### What is the expected behavior?  The same result as Prettier, which the docs promise ("The same output as Prettier"). Prettier 3.9.10, the current `latest`, flags the file and, when it writes, empties the whitespace-only line. 4.0.0-alpha.13 (`next`) does the same.  ``` $ bunx prettier@3.9.10 --check x.md Checking formatting... [warn] x.md [warn] Code style issues found in the above file. Run Prettier with --write to fix. exit=1  $ bunx prettier@3.9.10 x.md | od -c 0000000    `   `   `  \n   A  \n  \n   B  \n   `   `   `  \n ```  ### What do you see instead?  `bun fmt --check` passes the file, and `bun fmt` leaves the three spaces in place:  ``` $ bun fmt --check x.md; echo "exit=$?" 1 file is formatted. exit=0  $ bun fmt x.md && od -c x.md Formatted 0 files, 1 unchanged [9.14ms] 0000000    `   `   `  \n   A  \n              \n   B  \n   `   `   `  \n ```  ### Additional information  The same happens to trailing whitespace on any line. In a code block that neither tool formats as a language, Prettier strips it from every line and `bun fmt` keeps it. A fenced `js`

- **Issue #47090** (2026-10-28): **`execFileSync` / `spawnSync` with `timeout` sometimes never kills the child under gVisor: returns `ETIMEDOUT` with `signal: null` after the child exits on its own**
  *Symptoms*: ### What version of Bun is running?  1.3.14+0d9b296af  ### What platform is your computer?  Linux 4.19.0-gvisor x86_64 (a gVisor sandbox; `uname -srvm` prints `Linux 4.19.0-gvisor #1 SMP Sun Jan 10 15:06:54 PST 2016 x86_64`), 2 vCPUs.  ### What steps can reproduce the bug?  Save as `repro.js` and run `bun repro.js`:  ```js // The child is `sleep 5`; the timeout is 1000 ms with SIGKILL. import { execFileSync } from "node:child_process"; for (let i = 0; i < 10; i++) {   let t = Date.now();   const r = Bun.spawnSync(["sleep", "5"], { timeout: 1000, killSignal: "SIGKILL" });   const a = `spawnSync     ${Date.now() - t} ms signalCode=${r.signalCode} exitCode=${r.exitCode} exitedDueToTimeout=${r.exitedDueToTimeout}`;   t = Date.now();   let e = {};   try { execFileSync("sleep", ["5"], { timeout: 1000, killSignal: "SIGKILL" }); } catch (err) { e = err; }   console.log(a + ` | execFileSync ${Date.now() - t} ms code=${e.code} signal=${e.signal}`); } ```  ### What is the expected behavior?  Every call returns after about 1000 ms, with the child killed by SIGKILL (`signalCode=SIGKILL`, `signal=SIGKILL`). Node.js v24.21.0 in the same sandbox does this 10 times out of 10 for the `execFileSync` half (`node repro.mjs` with the `Bun.spawnSync` lines removed).  ### What do you see instead?  Some calls wait for the child to exit on its own, about 5000 ms, and report the timeout without having sent any signal:  ``` spawnSync     1064 ms signalCode=SIGKILL exitCode=null exitedDueToTimeout=true |

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

### Incident Patch 1: `79420086` (2026-10-27)
**Commit Message**: css: consolidate the open CSS parser fixes (#47025)

### What does this PR do?

Consolidates the open pull requests on the CSS parser (`src/css`:
parsing, minifying, lowering, printing, CSS modules) into one.

179 open pull requests were in scope. Each was judged by one rule: **the
output must mean to a browser what the input meant.** Every claim was
run through a build of `main`, a build with the change, lightningcss
1.33 and Chromium 156 (CSSOM, computed values, painted pixels for colors
and gradients), and counted against 10,116 real stylesheets: the
published CSS of about 190 popular npm packages, plus stylesheets from
open source repositories. 107 land here, whole or in part, most of them
cut down. The source diff is net negative.

Of the 10,116, 9,509 are stylesheets that someone ships. The rest are
test fixtures of other tools (521), Tailwind v4 source that needs its
plugin (59) and SCSS, PostCSS or template source (27).

| 9,509 shipped stylesheets | `main` | this branch |
|---|---|---|
| fail to build | 71 | 35 |
| ... of those, valid CSS that Bun rejects | | 0 |
| minified output reads differently in Chromium than the input | 552 | 2
|
| CSS modules with a name that is re

**File**: `Cargo.lock` (modified, +0/-1)
```diff
@@ -464,7 +464,6 @@ dependencies = [
  "bun_paths",
  "bun_ptr",
  "bun_wyhash",
- "scopeguard",
  "strum",
  "thiserror",
 ]
```

**File**: `docs/bundler/css.mdx` (modified, +13/-63)
```diff
@@ -131,8 +131,8 @@ Relative color syntax modifies individual components of an existing color. Adjus
 
 ```css title="styles.css" icon="file-code"
 .theme-color {
-  /* Start with a base color and increase lightness by 15% */
-  --accent: lch(from purple calc(l + 15%) c h);
+  /* Start with a base color and increase lightness by 15 */
+  --accent: lch(from purple calc(l + 15) c h);
 
   /* Take our brand blue and make a desaturated version */
   --subtle-blue: oklch(from var(--brand-blue) l calc(c * 0.8) h);
@@ -143,7 +143,7 @@ Bun's CSS bundler computes these relative color modifications at build time (whe
 
 ```css
 .theme-color {
-  --accent: lch(69.32% 58.34 328.37);
+  --accent: lch(44.69% 66.83 327.11);
   --subtle-blue: oklch(60.92% 0.112 240.01);
 }
 ```
@@ -199,11 +199,11 @@ For browsers that don't support these color spaces, Bun's CSS bundler adds RGB f
 ```css title="styles.css" icon="file-code"
 .vivid-element {
   /* RGB fallback first for maximum compatibility */
-  color: #fa1a4c;
+  color: #ff1f51;
   /* Keep original for browsers that support it */
   color: color(display-p3 1 0.1 0.3);
 
-  background-color: #6a805d;
+  background-color: #6a815c;
   background-color: color(a98-rgb 0.44 0.5 0.37);
 }
 ```
@@ -303,40 +303,7 @@ The `light-dark()` function takes two colors and applies one based on the curren
 }
 ```
 
-For browsers that don't support `light-dark()`, Bun's CSS bundler converts it to CSS variables with fallbacks:
-
-```css title="styles.css" icon="file-code"
-:root {
-  --buncss-light: initial;
-  --buncss-dark: ;
-  color-scheme: light dark;
-}
-
-@media (prefers-color-scheme: dark) {
-  :root {
-    --buncss-light: ;
-    --buncss-dark: initial;
-  }
-}
-
-.light-theme {
-  --buncss-light: initial;
-  --buncss-dark: ;
-  color-scheme: light;
-}
-
-.dark-theme {
-  --buncss-light: ;
-  --buncss-dark: initial;
-  color-scheme: dark;
-}
-
-.themed-component {
-  background-color: var(--buncss-light, #ffffff) var(--buncss-dark, #121212);
-  color: var(--buncss-light, #333333) var(--buncss-dark, #eeeeee);
-  border-color: var(--buncss-light, #dddddd) var(--buncss-dark, #555555);
-}
-```
+Bun's CSS bundler keeps `light-dark()` as written. It minifies the two colors and adds fallbacks for them like for any other color.
 
 ### Logical properties
 
@@ -482,13 +449,13 @@ The `:is()` pseudo-class function (formerly `:matches()`) takes a selector list
 /* 
 .article h1,
 .article h2,
-.article h3 {
+.article .title {
   margin-top: 1.5em;
 }
 */
 
 /* You can write this */
-.article :is(h1, h2, h3) {
+.article :is(h1, h2, .title) {
   margin-top: 1.5em;
 }
 
@@ -502,37 +469,25 @@ For browsers that don't support `:is()`, Bun's CSS bundler provides fallbacks us
 
 ```css
 /* Fallback using -webkit-any */
-.article :-webkit-any(h1, h2, h3) {
-  margin-top: 1.5em;
-}
-
-/* Fallback using -moz-any */
-.article :-moz-any(h1, h2, h3) {
+.article :-webkit-any(h1, h2, .title) {
   margin-top: 1.5em;
 }
 
 /* Original preserved for modern browsers */
-.article :is(h1, h2, h3) {
+.article :is(h1, h2, .title) {
   margin-top: 1.5em;
 }
 
-/* Complex example with fallbacks */
-:-webkit-any(header, main, footer) :-webkit-any(h1, h2, .title) {
-  font-family: "Heading Font", sans-serif;
-}
-
-:-moz-any(header, main, footer) :-moz-any(h1, h2, .title) {
-  font-family: "Heading Font", sans-serif;
-}
-
+/* No fallback: the first list has only type selectors */
 :is(header, main, footer) :is(h1, h2, .title) {
   font-family: "Heading Font", sans-serif;
 }
 ```
 
 <Warning>
   The vendor-prefixed versions have limitations compared to the standardized `:is()` selector, particularly with complex
-  selectors. Bun only uses the prefixed versions when they work correctly.
+  selectors. Bun only uses the prefixed versions when they work correctly. A list of only type selectors gets none:
+  browsers give `:-webkit-any()` the specificity of a class, so the fallback would outrank the `:is()` rule.
 </Warning>
 
 ### :not() selector
@@ -575,11 +530,6 @@ button:not(:-webkit-any(.primary, .secondary)) {
   border: 1px solid #ddd;
 }
 
-button:not(:-moz-any(.primary, .secondary)) {
-  background-color: #f5f5f5;
-  border: 1px solid #ddd;
-}
-
 button:not(:is(.primary, .secondary)) {
   background-color: #f5f5f5;
   border: 1px solid #ddd;
```

**File**: `src/ast/import_record.rs` (modified, +0/-7)
```diff
@@ -128,13 +128,6 @@ pub enum Tag {
     BakeResolveToSsrGraph,
 }
 
-impl Tag {
-    #[inline]
-    pub fn is_internal(self) -> bool {
-        (self as u8) >= (Tag::Runtime as u8)
-    }
-}
-
 // NOTE: no `impl Default for ImportRecord` — `range`, `path`, `kind` have no
 // sensible defaults. Construction sites must supply required fields explicitly
 // (struct-update or a `new(range, path, kind)` helper).
```

**File**: `src/bun_core/string/immutable.rs` (modified, +0/-16)
```diff
@@ -1685,22 +1685,6 @@ pub fn trim_leading_char(slice: &[u8], char: u8) -> &[u8] {
     b""
 }
 
-/// Trim leading pattern of 2 bytes
-///
-/// e.g.
-/// `trim_leading_pattern2("abcdef", 'a', 'b') == "cdef"`
-pub fn trim_leading_pattern2(slice_: &[u8], byte1: u8, byte2: u8) -> &[u8] {
-    let mut slice = slice_;
-    while slice.len() >= 2 {
-        if slice[0] == byte1 && slice[1] == byte2 {
-            slice = &slice[2..];
-        } else {
-            break;
-        }
-    }
-    slice
-}
-
 /// prefix is of type &[u8] or &[u16]
 pub fn trim_prefix_comptime<'a, T: crate::NoUninit + Eq>(
     buffer: &'a [T],
```

**File**: `src/collections/lib.rs` (modified, +0/-4)
```diff
@@ -388,10 +388,6 @@ impl<T, const N: usize> SmallList<T, N> {
         self.0.pop()
     }
     #[inline]
-    pub fn ordered_remove(&mut self, idx: u32) -> T {
-        self.0.remove(idx as usize)
-    }
-    #[inline]
     pub fn swap_remove(&mut self, idx: u32) -> T {
         self.0.swap_remove(idx as usize)
     }
```

**File**: `src/css/Cargo.toml` (modified, +0/-1)
```diff
@@ -13,7 +13,6 @@ workspace = true
 thiserror.workspace = true
 strum.workspace = true
 bstr.workspace = true
-scopeguard.workspace = true
 bitflags.workspace = true
 bun_base64.workspace = true
 bun_alloc.workspace = true
```

**File**: `src/css/build-prefixes.js` (modified, +12/-2)
```diff
@@ -57,7 +57,8 @@ prefixes["clip-path"].browsers = prefixes["clip-path"].browsers.filter(b => {
 
 prefixes["any-pseudo"] = {
   browsers: Object.entries(mdn.css.selectors.is.__compat.support).flatMap(([key, value]) => {
-    if (Array.isArray(value)) {
+    // Firefox for Android has no release from 69 to 78: it got `:is()` in 79, Firefox in 78.
+    if (Array.isArray(value) && key !== "firefox_android") {
       key = MDN_BROWSER_MAPPING[key] || key;
       let any = value.find(v => v.alternative_name?.includes("-any"))?.version_added;
       let supported = value.find(x => x.version_added && !x.alternative_name)?.version_added;
@@ -474,11 +475,20 @@ let flags = [
   "double_position_gradients",
   "vendor_prefixes",
   "logical_properties",
+  "light_dark",
   ["selectors", ["nesting", "not_selector_list", "dir_selector", "lang_selector_list", "is_selector"]],
   ["media_queries", ["media_interval_syntax", "media_range_syntax", "custom_media_queries"]],
   [
     "colors",
-    ["color_function", "oklab_colors", "lab_colors", "p3_colors", "hex_alpha_colors", "space_separated_color_notation"],
+    [
+      "color_function",
+      "oklab_colors",
+      "lab_colors",
+      "p3_colors",
+      "hex_alpha_colors",
+      "space_separated_color_notation",
+      "light_dark",
+    ],
   ],
 ];
 
```

**File**: `src/css/context.rs` (modified, +147/-85)
```diff
@@ -8,10 +8,41 @@ use css::media_query::{MediaCondition, MediaFeature, MediaFeatureId, MediaList,
 use bun_alloc::{Arena as Bump, ArenaPtr};
 use bun_collections::ArrayHashMap;
 
+/// The declarations of a rule that is generated next to the style rule in hand.
+#[derive(Default)]
+pub struct StagedDeclarations {
+    declarations: Vec<css::Property>,
+    important_declarations: Vec<css::Property>,
+}
+
+impl StagedDeclarations {
+    fn list(&mut self, important: bool) -> &mut Vec<css::Property> {
+        if important {
+            &mut self.important_declarations
+        } else {
+            &mut self.declarations
+        }
+    }
+
+    fn is_empty(&self) -> bool {
+        self.declarations.is_empty() && self.important_declarations.is_empty()
+    }
+
+    fn clear(&mut self) {
+        self.declarations.clear();
+        self.important_declarations.clear();
+    }
+
+    pub(crate) fn append(&mut self, other: &mut Self) {
+        self.declarations.append(&mut other.declarations);
+        self.important_declarations
+            .append(&mut other.important_declarations);
+    }
+}
+
 pub struct SupportsEntry {
     pub(crate) condition: css::SupportsCondition,
-    pub(crate) declarations: Vec<css::Property>,
-    pub(crate) important_declarations: Vec<css::Property>,
+    pub(crate) declarations: StagedDeclarations,
 }
 
 // No explicit deinit — all fields own their storage and drop automatically.
@@ -30,9 +61,9 @@ pub struct PropertyHandlerContext<'a> {
     pub(crate) targets: css::targets::Targets,
     pub(crate) is_important: bool,
     pub(crate) supports: Vec<SupportsEntry>,
-    pub(crate) ltr: Vec<css::Property>,
-    pub(crate) rtl: Vec<css::Property>,
-    pub(crate) dark: Vec<css::Property>,
+    pub(crate) ltr: StagedDeclarations,
+    pub(crate) rtl: StagedDeclarations,
+    pub(crate) dark: StagedDeclarations,
     pub(crate) context: DeclarationContext,
     pub(crate) unused_symbols: &'a ArrayHashMap<Box<[u8]>, ()>,
 }
@@ -48,9 +79,9 @@ impl<'a> PropertyHandlerContext<'a> {
             targets: *targets,
             is_important: false,
             supports: Vec::new(),
-            ltr: Vec::new(),
-            rtl: Vec::new(),
-            dark: Vec::new(),
+            ltr: StagedDeclarations::default(),
+            rtl: StagedDeclarations::default(),
+            dark: StagedDeclarations::default(),
             context: DeclarationContext::None,
             unused_symbols,
         }
@@ -62,21 +93,29 @@ impl<'a> PropertyHandlerContext<'a> {
             targets: self.targets,
             is_important: false,
             supports: Vec::new(),
-            ltr: Vec::new(),
-            rtl: Vec::new(),
-            dark: Vec::new(),
+            ltr: StagedDeclarations::default(),
+            rtl: StagedDeclarations::default(),
+            dark: StagedDeclarations::default(),
             context,
             unused_symbols: self.unused_symbols,
         }
     }
 
     pub(crate) fn add_dark_rule(&mut self, property: css::Property) {
-        self.dark.push(property);
+        self.dark.list(self.is_important).push(property);
     }
 
     pub(crate) fn add_logical_rule(&mut self, ltr: css::Property, rtl: css::Property) {
-        self.ltr.push(ltr);
-        self.rtl.push(rtl);
+        self.ltr.list(self.is_important).push(ltr);
+        self.rtl.list(self.is_important).push(rtl);
+    }
+
+    /// Whether `get_supports_rules` or `get_additional_rules` would build a rule.
+    pub(crate) fn has_staged_rules(&self) -> bool {
+        !(self.supports.is_empty()
+            && self.ltr.is_empty()
+            && self.rtl.is_empty()
+            && self.dark.is_empty())
     }
 
     pub(crate) fn should_compile_logical(&self, feature: css::compat::Feature) -> bool {
@@ -116,32 +155,52 @@ impl<'a> PropertyHandlerContext<'a> {
         bun_alloc::vec_from_iter_in(list.iter().map(|p| p.deep_clone(bump)), bump)
     }
 
-    pub(crate) fn get_supports_rules<T>(
+    /// A style rule for the staged declarations, or with no selectors a nested declarations rule.
+    fn staged_rule<T>(
         &self,
-        style_rule: &css::StyleRule<T>,
-    ) -> Vec<css::CssRule<T>> {
-        if self.supports.is_empty() {
-            return Vec::new();
+        selectors: Option<css::SelectorList>,
+        staged: &StagedDeclarations,
+        loc: css::Location,
+    ) -> css::CssRule<T> {
+        let declarations = css::DeclarationBlock {
+            declarations: self.clone_decls(&staged.declarations),
+            important_declarations: self.clone_decls(&staged.important_declarations),
+        };
+        match selectors {
+            Some(selectors) => css::CssRule::Style(css::StyleRule {
+                selectors,
+                vendor_prefix: css::VendorPrefix::NONE,
+                declarations,
+                rules: css::CssRuleList::default(),
+                loc,
+            }),
+            None => {
+                css::CssRule::NestedDeclarations(css:
```

---

### Incident Patch 2: `60ca742d` (2026-10-28)
**Commit Message**: crash handler: give `CrashReason` the lifetime of its panic message (#47235)

### What does this PR do?

`CrashReason::Panic` held a `&'static [u8]`, but three of its callers
only have a borrowed message: `panic_impl(msg: &[u8])`, the Rust panic
hook (a stack buffer) and `Bun__crashHandler(ptr, len)`. Each erased the
lifetime with `detach_lifetime` in an `unsafe` block.

This gives the enum the lifetime it was missing: `CrashReason<'a>` with
`Panic(&'a [u8])`. `crash_handler` takes `CrashReason<'_>`, and
`TraceString<'a>` stores `CrashReason<'a>`. Nothing keeps a
`CrashReason` past the call that made it, so the borrow checker accepts
all three callers as they are.

The fourth `detach_lifetime` in this file, in
`CrashHandler__beginDlOpenAction`, was redundant. `ffi::cstr` turns the
raw pointer into a `&CStr` whose lifetime its caller chooses, so the
lifetime that the C++ caller's contract allows is now chosen there, in
the `unsafe` block that was needed anyway.

**4 fewer `unsafe` blocks**, no new code, no cost. The crate no longer
uses `detach_lifetime`.

`ZigError` keeps `&'static [u8]`: every caller passes a literal.

### How did you verify your code works?

Behaviour is unchange

**File**: `src/collections/lib.rs` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ pub use string_map::StringMap;
 pub use bun_ptr::tagged_pointer::{TaggedPtr, TaggedPtrUnion};
 // Lifetime-erasure helpers (RUST_PATTERNS.md §6/§18) — re-exported here so
 // crates that already depend on `bun_collections` (logger, css, js_parser,
-// crash_handler, watcher, http_types) can route the borrowck-dodge through
+// watcher, http_types) can route the borrowck-dodge through
 // one centralised `unsafe fn` instead of open-coding the lifetime cast.
 pub use bun_ptr::{RawSlice, detach_lifetime, detach_ref};
 
```

**File**: `src/crash_handler/lib.rs` (modified, +13/-24)
```diff
@@ -622,9 +622,9 @@ mod draft {
 
     /// This structure and formatter must be kept in sync with `bun.report`'s decoder implementation.
     #[derive(Clone, Copy)]
-    pub enum CrashReason {
+    pub enum CrashReason<'a> {
         /// From @panic()
-        Panic(&'static [u8]),
+        Panic(&'a [u8]),
         /// "reached unreachable code"
         Unreachable,
 
@@ -650,7 +650,7 @@ mod draft {
         OutOfMemory,
     }
 
-    impl CrashReason {
+    impl CrashReason<'_> {
         /// Signal to terminate the process with after the crash report has
         /// been printed. Signal-originated crashes re-raise the original
         /// fault so the parent process (and core-dump analyzers) see the
@@ -675,7 +675,7 @@ mod draft {
         }
     }
 
-    impl fmt::Display for CrashReason {
+    impl fmt::Display for CrashReason<'_> {
         fn fmt(&self, writer: &mut fmt::Formatter<'_>) -> fmt::Result {
             match self {
                 CrashReason::Panic(message) => write!(writer, "{}", bstr::BStr::new(message)),
@@ -816,7 +816,7 @@ mod draft {
 
     /// This function is invoked when a crash happens. A crash is classified in `CrashReason`.
     #[cold]
-    pub fn crash_handler(reason: CrashReason, seed: TraceSeed) -> ! {
+    pub fn crash_handler(reason: CrashReason<'_>, seed: TraceSeed) -> ! {
         if cfg!(debug_assertions) {
             Output::disable_scoped_debug_writer();
         }
@@ -1517,8 +1517,7 @@ mod draft {
             if msg == b"reached unreachable code" {
                 CrashReason::Unreachable
             } else {
-                // SAFETY: process is about to abort; the borrow is never invalidated.
-                CrashReason::Panic(unsafe { bun_collections::detach_lifetime(msg) })
+                CrashReason::Panic(msg)
             },
             TraceSeed::BeginAddr(begin_addr),
         );
@@ -1933,12 +1932,7 @@ mod draft {
             };
             let _ = write!(msg_buf.writer(), "{msg}");
         }
-        // SAFETY: `CrashReason::Panic` stores `&'static [u8]` (it was designed for
-        // the `-> !` path). `msg_buf` outlives every read of `reason` below — the
-        // borrow is fully consumed by the `Display`/`TraceString` writes inside
-        // this frame and never escapes.
-        let reason =
-            CrashReason::Panic(unsafe { bun_collections::detach_lifetime(msg_buf.const_slice()) });
+        let reason = CrashReason::Panic(msg_buf.const_slice());
 
         let mut trace_str_buf = BoundedArray::<u8, 1024>::default();
         {
@@ -2155,7 +2149,7 @@ mod draft {
     #[cfg(windows)]
     fn classify_exception_windows(
         record: &bun_sys::windows::EXCEPTION_RECORD,
-    ) -> Option<CrashReason> {
+    ) -> Option<CrashReason<'static>> {
         Some(match record.ExceptionCode {
             bun_sys::windows::EXCEPTION_DATATYPE_MISALIGNMENT => CrashReason::DatatypeMisalignment,
             bun_sys::windows::EXCEPTION_ACCESS_VIOLATION => {
@@ -2809,7 +2803,7 @@ mod draft {
 
     struct TraceString<'a> {
         trace: &'a StackTrace<'a>,
-        reason: CrashReason,
+        reason: CrashReason<'a>,
         action: TraceStringAction,
     }
 
@@ -3186,7 +3180,7 @@ mod draft {
     /// On POSIX this re-raises the signal that caused the crash (or SIGABRT
     /// for panics) so the parent sees the real fault and core dumps are
     /// attributed correctly.
-    fn crash(reason: CrashReason) -> ! {
+    fn crash(reason: CrashReason<'_>) -> ! {
         #[cfg(not(windows))]
         {
             let sig = reason.terminal_signal();
@@ -3885,8 +3879,6 @@ mod draft {
         }
         // SAFETY: per the caller contract above, `name` is a valid NUL-terminated C string (non-null).
         let name_bytes = unsafe { bun_core::ffi::cstr(name) }.to_bytes();
-        // PORTING.md §Forbidden: no Box::leak. We're on the noreturn path, so a stack
-        // buffer suffices — `panic_impl` erases to &'static for the abort path.
         let mut msg = BoundedArray::<u8, 256>::default();
         let _ = write!(
             msg.writer(),
@@ -3903,8 +3895,7 @@ mod draft {
         // SAFETY: caller passes a valid (ptr, len) byte slice
         let msg = unsafe { core::slice::from_raw_parts(message_ptr, message_len) };
         crash_handler(
-            // SAFETY: noreturn — see panic_impl note
-            CrashReason::Panic(unsafe { bun_collections::detach_lifetime(msg) }),
+            CrashReason::Panic(msg),
             TraceSeed::BeginAddr(debug::return_address()),
         );
     }
@@ -3916,10 +3907,8 @@ mod draft {
     unsafe extern "C" fn CrashHandler__beginDlOpenAction(
         path: *const c_char,
     ) -> *mut ActionGuard<'static> {
-        // SAFETY: path is a valid NUL-terminated C string (caller contract)
-        let s = unsafe { bun_core::ffi::cstr(path) }.to_bytes();
-        // SAFETY: the C string outlives the guard (caller contract)
-        let s: &'static [u8] = unsafe { bun_collections::detach_
```

---

### Incident Patch 3: `8d5672c5` (2026-10-27)
**Commit Message**: Compile TypeScript to machine code ahead of time: `bun build --compile --aot` (#45631)

```sh
bun build --compile --aot ./app.ts
./app
```

This adds `--aot` to `bun build --compile`. It compiles TypeScript and
JavaScript to machine code at build time. The executable starts as
machine code and has no JIT in it. `bun compile ./app.ts` is short for
the same command.

It's still JavaScript. npm packages, CommonJS, `eval`, proxies and `any`
all work. There's no new syntax and nothing to annotate. The new part is
that the compiler reads your TypeScript types and uses them.

```ts
class Vec {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}
```

A `Vec` is a 16-byte header and two raw doubles. Where the compiler can
prove that only `Vec`s reach `a.x`, the read is one load. No
hidden-class check, no inline cache, no boxed number. Where it can't
prove that, it tests once and keeps a slow path.

It's experimental, and it [loses in places](#where-it-loses). The engine
half is oven-sh/WebKit#757. The docs start at `docs/bundler/aot.mdx`.

## The TypeScript compiler, compiled

TypeScript 6 is written i

**File**: `.buildkite/ci.ts` (modified, +214/-13)
```diff
@@ -5,10 +5,26 @@
  * @link https://buildkite.com/docs/pipelines/defining-steps
  */
 
+import { spawnSync } from "node:child_process";
 import { writeFileSync } from "node:fs";
 import { join } from "node:path";
 import type { Arch, Abi as HostAbi, Os } from "../scripts/agent.ts";
 import { output, run } from "../scripts/agent.ts";
+import {
+  type AotTakes,
+  type AotTests,
+  getAotAlwaysDrawn,
+  getAotAlwaysInDrawnStep,
+  getAotExcludes,
+  getAotFileDraw,
+  getAotSample,
+  getAotShare,
+  getAotStepArguments,
+  getAotTestsOfLane,
+  getHardenedStepArguments,
+  isFileDrawn,
+  spellSample,
+} from "../scripts/aot-tests.ts";
 import {
   type BakedImage,
   type GeneratedImage,
@@ -21,6 +37,7 @@ import {
   locations,
 } from "../scripts/build/ci-images/spec.ts";
 import {
+  aotTests,
   getBuildMetadata,
   getCommit,
   getCommitMessage,
@@ -171,7 +188,7 @@ function getBuildkiteEmoji(emoji: Emoji): string {
 type Abi = Exclude<HostAbi, "gnu">;
 type Distro = "debian" | "ubuntu" | "alpine";
 type Tier = "latest" | "previous" | "oldest" | "beta";
-type Profile = "release" | "assert" | "debug" | "asan";
+type Profile = "release" | "assert" | "debug" | "asan" | "hardened";
 
 interface Target {
   os: Os;
@@ -288,6 +305,11 @@ const buildPlatforms: Platform[] = [
   { os: "windows", arch: "aarch64", crossCompile: true, distro: "debian", release: "13" },
 ];
 
+// A Bun built with --hardened=on is in no release, so nothing else would notice where its layout is lost. The build checks
+// the file that it links and the one that it strips (scripts/build/verify-binary.ts), and test/aot/hardened-*.test.ts check
+// what that Bun builds.
+const hardenedPlatform: Platform = { os: "linux", arch: "x64", profile: "hardened", distro: "debian", release: "13" };
+
 const testPlatforms: Platform[] = [
   // Darwin arm64 is targeted by `release-tier` (see getTestAgent): one job on
   // `latest` (current macOS, 26 today) and one on `previous` (anything older
@@ -586,6 +608,7 @@ function getBuildArgs(target: Target, options: PipelineOptions): string {
 
   if (baseline) args.push("--baseline=on");
   if (profile === "asan") args.push("--asan=on");
+  if (profile === "hardened") args.push("--hardened=on");
 
   // canary: options.canary can be number (revision count) or undefined
   // (default on). Old system used CANARY_REVISION as a counter; build.ts
@@ -640,7 +663,7 @@ function getBuildBunStep(platform: Platform, options: PipelineOptions): CommandS
  * Matches the naming convention in cmake/targets/BuildBun.cmake.
  */
 function getTargetTriplet(platform: Target): string {
-  const { os, arch, abi, baseline } = platform;
+  const { os, arch, abi, baseline, profile } = platform;
   let triplet = `bun-${os}-${arch}`;
   if (abi === "musl") {
     triplet += "-musl";
@@ -651,6 +674,9 @@ function getTargetTriplet(platform: Target): string {
   if (baseline) {
     triplet += "-baseline";
   }
+  if (profile === "hardened") {
+    triplet += "-hardened";
+  }
   return triplet;
 }
 
@@ -663,7 +689,7 @@ function needsBaselineVerification(platform: Platform): boolean {
   const { os, arch, abi, profile } = platform;
   // asan never ships. x64-android is emulator-only; aarch64-android keeps its
   // static LSE/SVE scan via --skip-emulation in getVerifyBaselineStep().
-  if (profile === "asan") return false;
+  if (profile === "asan" || profile === "hardened") return false;
   if (os === "linux") return (arch === "x64" && abi !== "android") || arch === "aarch64";
   if (os === "windows") return arch === "x64";
   return false;
@@ -869,20 +895,164 @@ function getTraceOrderStep(target: Target, tracePlatform: Platform, options: Pip
 interface TestOptions {
   buildId?: string | undefined;
   testFiles?: string[] | undefined;
+  aot?: AotTests | undefined;
+  /** Which of the two steps of `aot` this is. */
+  aotTakes?: AotTakes | undefined;
+  /** The Bun of `hardenedPlatform`. */
+  hardened?: boolean | undefined;
+}
+
+// Which tests of the ahead-of-time compiler a step runs: scripts/aot-tests.ts.
+const aotSources = [
+  "src/aot/",
+  "src/sema/",
+  "src/builtin_sources/",
+  "src/bundler/aot/",
+  "src/trim/",
+  "src/exe_format/",
+  "src/codegen/builtins/",
+  "src/codegen/declared-type-checks.ts",
+  "src/codegen/generate-removable-features.ts",
+  "src/codegen/removable-entry-points.ts",
+  "src/options_types/aot_options.rs",
+  "src/options_types/trim.rs",
+  "src/resolver/compiled_program.rs",
+  "src/standalone_graph/compiled_program.rs",
+  "src/standalone_graph/executable_",
+  "src/crash_handler/compiled_frames.rs",
+  "src/sql_jsc/shared/RowDecoder.rs",
+  "src/runtime/api/compile_ahead_of_time.rs",
+  "src/runtime/cli/check_command/compile_check.rs",
+  "src/runtime/cli/compile_",
+  "src/runtime/cli/run_compiled.rs",
+  "src/runtime/cli/startup_options",
+  "src/runtime/removed_feature.rs",
+  "src/jsc/compiled_program.rs",
+  "src/jsc/bindings/BunAOT",
+  "src/jsc/bindings/BunCompiled",
+  "src/jsc/bin
```

**File**: `.buildkite/hooks/post-checkout` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+#!/usr/bin/env bash
+# `git fetch` may leave `git gc --auto` packing the repository in the background
+# ("Auto packing the repository in background for optimum performance"). The
+# darwin agents copy the checkout, .git included, into a guest next, and rsync
+# exits 23 when .git/gc.pid or .git/gc.log.lock goes away under the copy: the
+# job ends with status 1 before a test has run, and nothing retries it. So the
+# packing is waited for here, five minutes at most. Never exits non-zero.
+
+git_directory="${BUILDKITE_BUILD_CHECKOUT_PATH:-.}/.git"
+for _ in $(seq 1 300); do
+  [ -e "$git_directory/gc.pid" ] || [ -e "$git_directory/gc.log.lock" ] || break
+  sleep 1
+done
+exit 0
```

**File**: `.buildkite/update-test-durations.yml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ steps:
     # The scripts read BUILDKITE_API_TOKEN. The agent that runs this step has to
     # provide it: `pipeline upload` refuses a pipeline with a secret interpolated in.
     command: |
-      node scripts/update-test-durations.mjs --builds 5
+      bun scripts/update-test-durations.mjs --builds 5
       node scripts/update-parallel-allowlist.mjs --builds 300
       buildkite-agent artifact upload test/expected-durations.json
       buildkite-agent artifact upload test/parallel-allowlist.json
```

**File**: `.claude/commands/upgrade-webkit.md` (modified, +2/-2)
```diff
@@ -17,9 +17,9 @@ To do that:
 - Preview mode: create a working branch (e.g. `bun/upgrade-to-<upstream-short-sha>`) instead of staying on main
 - git merge upstream/main
 - Fix the merge conflicts (preserve the fork's Bun-specific changes)
-- bun run jsc:build:debug — from the bun repo root, builds just JSC
+- bun run jsc:build:debug — from the bun repo root, builds just JSC (and its `jsc` shell), in bun's own build graph. File lists come from the checkout, but `scripts/build/deps/webkit.ts` restates WebKit's generator commands, compiler flags and option values by hand, and nothing checks them. Read `git diff $OLD_BASE upstream/main -- Source/cmake Source/JavaScriptCore/CMakeLists.txt Source/WTF/wtf/CMakeLists.txt Source/bmalloc/CMakeLists.txt` for changed `add_custom_command`s (→ `gen()`), compiler flags (→ `webkitFlags()`) and `WEBKIT_OPTION_*` / `SET_AND_EXPOSE_TO_BUILD` (→ `rows`), and carry them over in the bun PR
 - While it compiles, in another task review the JSC commits between $OLD_BASE and upstream/main (Source/JavaScriptCore, Source/WTF, Source/bmalloc). Write up a summary in a file called "webkit-changes.md"
-- bun run build:local — full Bun build against the local WebKit (reuses the JSC build above)
+- bun run build:local — full Bun build with the local WebKit (same build directory and objects as the JSC build above)
 - After it compiles, run some code to make sure things work: `bun run build:local -p '42'`
 - Publish the new WebKit:
   - Direct: cd vendor/WebKit, commit, `git push origin main`. The push triggers a release tagged `autobuild-<full-sha>`.
```

**File**: `.github/actions/rust-lint-setup/action.yml` (modified, +9/-2)
```diff
@@ -23,6 +23,12 @@ inputs:
   ninja-targets:
     description: "Space-separated build targets (`bun scripts/build.ts --target=…`)."
     default: "clone-lolhtml clone-rust-argon2"
+  webkit-generators-only:
+    description: >
+      "1" fetches the code generators of the prebuilt WebKit (half a megabyte)
+      in place of its tarball (440 MB). For a job whose targets compile and
+      link no C++: `codegen` reads nothing else of it.
+    default: "0"
 
 runs:
   using: composite
@@ -34,15 +40,15 @@ runs:
 
     - name: Setup system deps
       # cmake/ninja for `--configure-only`; clang for toolchain detection
-      # (configure resolves cfg.cc/cxx even though nothing here compiles C++).
+      # (configure resolves cfg.cc/cxx). `engine-test-programs` links with AddressSanitizer.
       shell: bash
       env:
         LLVM_VERSION_MAJOR: ${{ inputs.llvm-version }}
       run: |
         wget -qO- https://apt.llvm.org/llvm-snapshot.gpg.key | sudo tee /etc/apt/trusted.gpg.d/apt.llvm.org.asc > /dev/null
         echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-${LLVM_VERSION_MAJOR} main" | sudo tee /etc/apt/sources.list.d/llvm.list > /dev/null
         sudo apt-get update -qq
-        sudo apt-get install -y -qq --no-install-recommends cmake ninja-build nasm clang-${LLVM_VERSION_MAJOR} lld-${LLVM_VERSION_MAJOR} llvm-${LLVM_VERSION_MAJOR}
+        sudo apt-get install -y -qq --no-install-recommends cmake ninja-build nasm clang-${LLVM_VERSION_MAJOR} lld-${LLVM_VERSION_MAJOR} llvm-${LLVM_VERSION_MAJOR} libclang-rt-${LLVM_VERSION_MAJOR}-dev
 
     - name: Setup Rust
       if: inputs.toolchain != ''
@@ -72,6 +78,7 @@ runs:
       shell: bash
       env:
         NINJA_TARGETS: ${{ inputs.ninja-targets }}
+        BUN_WEBKIT_GENERATORS_ONLY: ${{ inputs.webkit-generators-only }}
       run: |
         bun install --frozen-lockfile
         bun scripts/build.ts $(printf -- '--target=%s ' $NINJA_TARGETS)
```

**File**: `.github/workflows/CLAUDE.md` (modified, +10/-8)
```diff
@@ -116,18 +116,20 @@ export LLVM_VERSION_MAJOR=23
 
 ## rust-lints.yml Workflow
 
-Four independent jobs over the Rust workspace. They share `.github/actions/rust-lint-setup`, a composite action that installs LLVM from apt.llvm.org (configure resolves a clang even though nothing here compiles C++), Bun, optionally a pinned Rust toolchain plus components, runs `bun install`, then `bun scripts/build.ts --configure-only` and the ninja targets a job asks for: `clone-lolhtml clone-rust-argon2` (cargo cannot resolve the workspace until the vendored `lol_html` and `rust-argon2` path dependencies exist) and, for jobs that check `bun_runtime`/`bun_jsc`/`bun_core`, `codegen` (their `include!()`d sources under `build/debug/codegen`).
+Five independent jobs over the Rust workspace. They share `.github/actions/rust-lint-setup`, a composite action that installs LLVM from apt.llvm.org (configure resolves a clang even though nothing here compiles C++), Bun, optionally a pinned Rust toolchain plus components, runs `bun install`, then `bun scripts/build.ts --configure-only` and the ninja targets a job asks for: `clone-lolhtml clone-rust-argon2` (cargo cannot resolve the workspace until the vendored `lol_html` and `rust-argon2` path dependencies exist) and, for jobs that check `bun_runtime`/`bun_jsc`/`bun_core`, `codegen` (their `include!()`d sources under `build/debug/codegen`). `codegen` reads the code generators of the prebuilt WebKit and nothing else of it: a job that links no C++ passes `webkit-generators-only: "1"`, and the build fetches the release's `bun-webkit-aot-sources.tar.gz` (half a megabyte) in place of the tarball (440 MB).
 
-| Job       | Check name            | Runs                                                                | Blocking                       |
-| --------- | --------------------- | ------------------------------------------------------------------- | ------------------------------ |
-| `clippy`  | `cargo clippy`        | `bun run rust:clippy`, then `cargo check --workspace --all-targets` | yes                            |
-| `miri`    | `cargo miri test`     | `bun run rust:miri` (`scripts/rust-miri.ts`)                        | yes                            |
-| `lolhtml` | `lol-html cargo test` | `cargo test` in `vendor/lolhtml`                                    | yes                            |
-| `mordant` | `mordant`             | `bun run rust:mordant`                                              | advisory (`continue-on-error`) |
+| Job              | Check name            | Runs                                                                                                            | Blocking                       |
+| ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------ |
+| `clippy`         | `cargo clippy`        | `bun run rust:clippy`, then `cargo check --workspace --all-targets`                                             | yes                            |
+| `miri`           | `cargo miri test`     | `bun run rust:miri` (`scripts/rust-miri.ts`)                                                                    | yes                            |
+| `lolhtml`        | `lol-html cargo test` | `cargo test` in `vendor/lolhtml`                                                                                | yes                            |
+| `aot-rust-tests` | `AoT cargo test`      | the schema's `--check` and tests, `cargo test` of the nine AoT crates                                           | yes                            |
+| `mordant`        | `mordant`             | `bun run rust:mordant`                                                                                          | advisory (`continue-on-error`) |
 
 - `clippy` lints the default targets only (lib and bin): test code was never held to the clippy lint set. Its second step, `cargo check --workspace --all-targets`, type-checks `#[cfg(test)]` code, `tests/` and `benches/` so they keep compiling. Nothing else builds them except the crates `rust:miri` runs.
-- `clippy`, `miri` and `lolhtml` pin `RUSTUP_TOOLCHAIN` at the workflow level (kept in sync with `channel` in `rust-toolchain.toml`) so rustup does not install that file's cross-target list; the action installs the toolchain with `--profile minimal` plus the components the job names (`clippy`, `miri rust-src`, none).
+- `clippy`, `miri`, `lolhtml` and `aot-rust-tests` pin `RUSTUP_TOOLCHAIN` at the workflow level (kept in sync with `channel` in `rust-toolchain.toml`) so rustup does not install that file's cross-target list; the action installs the toolchain with `--profile minimal` plus the components the job names (`clippy`, `miri rust-src`, none, none).
 - `lolhtml` exists because the vendored lol-html is a fork (oven-sh/lol-html, `bun` branch) whose own test suite is the only thing guarding the fork's invariants. It used 
```

**File**: `.github/workflows/bun-types.yml` (modified, +10/-0)
```diff
@@ -43,5 +43,15 @@ jobs:
         run: |
           bun install
           bun install --cwd test
+      - name: Fetch the engine's code generators
+        # The code generators import TypeScript of the engine. A release of WebKit has it as an asset of its own; an
+        # older one only inside its tarballs.
+        run: |
+          version=$(sed -n 's/^export const WEBKIT_VERSION = "\(.*\)";$/\1/p' scripts/build/deps/webkit.ts)
+          release="https://github.com/oven-sh/WebKit/releases/download/autobuild-${version#autobuild-}"
+          mkdir -p vendor/WebKit
+          curl -fsSL --retry 3 -o "$RUNNER_TEMP/engine.tar.gz" "$release/bun-webkit-aot-sources.tar.gz" ||
+            curl -fsSL --retry 3 -o "$RUNNER_TEMP/engine.tar.gz" "$release/bun-webkit-linux-amd64-lto.tar.gz"
+          tar -xzf "$RUNNER_TEMP/engine.tar.gz" -C vendor/WebKit --strip-components=1 --exclude=bun-webkit/Source/JavaScriptCore/aot/tests bun-webkit/Source/JavaScriptCore/aot
       - name: Check types
         run: bun test test/integration/bun-types/bun-types.test.ts
```

**File**: `.github/workflows/lint.yml` (modified, +32/-2)
```diff
@@ -34,14 +34,44 @@ jobs:
         run: |
           bun x tsc --noEmit -p scripts/build/tsconfig.json
           bun x tsc --noEmit -p scripts/tsconfig.json
+      - name: Fetch the engine's code generators
+        # The code generators and their types import TypeScript of the engine. A release of WebKit has it as an asset of its
+        # own; an older one only inside its tarballs.
+        run: |
+          version=$(sed -n 's/^export const WEBKIT_VERSION = "\(.*\)";$/\1/p' scripts/build/deps/webkit.ts)
+          release="https://github.com/oven-sh/WebKit/releases/download/autobuild-${version#autobuild-}"
+          mkdir -p vendor/WebKit
+          curl -fsSL --retry 3 -o "$RUNNER_TEMP/engine.tar.gz" "$release/bun-webkit-aot-sources.tar.gz" ||
+            curl -fsSL --retry 3 -o "$RUNNER_TEMP/engine.tar.gz" "$release/bun-webkit-linux-amd64-lto.tar.gz"
+          tar -xzf "$RUNNER_TEMP/engine.tar.gz" -C vendor/WebKit --strip-components=1 --exclude=bun-webkit/Source/JavaScriptCore/aot/tests bun-webkit/Source/JavaScriptCore/aot
       - name: Typecheck the built-in modules
         # The code generators write the types src/js/builtins.d.ts references (build/types) and the enums the dev
-        # server's sources import (src/runtime/bake/generated.ts).
+        # server's sources import (src/runtime/bake/generated.ts). A module with a second text in src/js/ahead-of-time is
+        # checked as the compiler reads it.
         run: |
           bun run build:types
-          bun x tsc --noEmit -p src/js/tsconfig.json
+          bun src/codegen/check-types-of-modules.ts
       - name: Typecheck the rest of src
         # The code generators, the class definitions and the other build-time TypeScript, then the dev server.
         run: |
           bun x tsc --noEmit -p src/tsconfig.json
           bun x tsc --noEmit -p src/runtime/bake/tsconfig.json
+      - name: Check that every name of the compiler's schema has a use
+        # The uses are in the engine's C++ and in Bun's Rust. The build looks for them only where it compiles the engine,
+        # and CI links a prebuilt one.
+        run: |
+          version=$(sed -n 's/^export const WEBKIT_VERSION = "\(.*\)";$/\1/p' scripts/build/deps/webkit.ts)
+          git init --quiet "$RUNNER_TEMP/WebKit"
+          git -C "$RUNNER_TEMP/WebKit" remote add origin https://github.com/oven-sh/WebKit.git
+          git -C "$RUNNER_TEMP/WebKit" sparse-checkout set Source/JavaScriptCore
+          git -C "$RUNNER_TEMP/WebKit" fetch --quiet --depth=1 --filter=blob:none origin "refs/tags/autobuild-${version#autobuild-}"
+          git -C "$RUNNER_TEMP/WebKit" checkout --quiet FETCH_HEAD
+          BUN_WEBKIT_PATH="$RUNNER_TEMP/WebKit" bun test test/internal/build-aot-codegen-declared-outputs.test.ts -t "finds a use for every name of the schema"
+      - name: Run the tests that read the engine's sources
+        # The machines that run test/aot have no sources of the engine, so these files skip themselves there.
+        # The step ends where grep finds no file: `bun test` without a file runs every test.
+        env:
+          AOT_REQUIRE_ENGINE_SOURCES: "1"
+        run: |
+          files=$(grep -l "harness/engine-text" test/aot/*.test.ts)
+          BUN_WEBKIT_PATH="$RUNNER_TEMP/WebKit" bun test $files
```

#### Recent Merged Pull Requests:
- **PR #47238** (2026-10-28): shell: reference-count IO objects with `Rc` instead of `Arc` (@dylan-conway)
- **PR #47235** (2026-10-28): crash handler: give `CrashReason` the lifetime of its panic message (@dylan-conway)
- **PR #47234** (closed): bun test: let the file scanner borrow its filters instead of erasing lifetimes (@dylan-conway)
- **PR #47231** (2026-10-28): uws: put `Loop`'s fields in `Cell`s so its methods take `&self` (@dylan-conway)
- **PR #47125** (2026-10-28): Upgrade WebKit to fcc1ea0973a4 (@Jarred-Sumner)
- **PR #47109** (closed): Take `&self` in VirtualMachine, EventLoop and RuntimeState: no `&mut` across re-entrant JS (@dylan-conway)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
