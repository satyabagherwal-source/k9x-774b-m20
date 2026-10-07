# Forensic Learning Record (Deep Inspection): oven-sh/bun

> **Canonical Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:19:41.943Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96145 stars

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

### Core Architecture Module: `packages/bun-usockets/src/internal/loop_data.h`
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

#ifndef LOOP_DATA_H
#define LOOP_DATA_H

#include <stdint.h>

#if defined(__APPLE__)
#include <os/lock.h>
typedef os_unfair_lock zig_mutex_t;
#elif defined(__linux__) || defined(__FreeBSD__)
typedef uint32_t zig_mutex_t;
#elif defined(_WIN32)
// SRWLOCK
typedef void* zig_mutex_t;
#else
#error "Unsupported platform"
#endif

// IMPORTANT: When changing this, don't forget to update the Rust mirror in src/uws_sys/InternalLoopData.rs as well!
struct us_quic_socket_context_s;
struct us_nq_driver_s;

struct us_internal_loop_data_t {
#ifdef LIBUS_USE_LIBUV
    struct us_timer_t *sweep_timer;
#else
    /* Absolute monotonic ns of the next sweep, or -1. Folded into the poll
     * timeout — no timerfd, no EVFILT_TIMER. */
    long long sweep_next_tick_ns;
#endif
    int sweep_timer_count;
    struct us_internal_async *wakeup_async;
    struct us_socket_group_t *head;
    /* QUIC engines on this loop. us_quic_loop_process walks the list from
     * loop_post / drainMicrotasks; the lazy fallthrough timer only wakes the
     * loop for lsquic's time-driven state (RTO, ACK delay) — its callback
     * just calls us_quic_loop_process. */
    struct us_quic_socket_context_s *quic_head;
    /* µs until lsquic next wants process_conns (min earliest_adv_tick
     * across engines), or -1 for "no deadline". Written by
     * us_quic_loop_process from loop_post; read by Bun's getTimeout() to
     * bound the epoll_pwait2 timeout. No timerfd, no scheduling syscall —
     * the gap between loop_post and getTimeout is sub-µs so storing the
     * relative diff is precise enough. */
    long long quic_next_tick_us;
    /* node:quic endpoints on this loop. us_nq_loop_flush_if_pending walks it
     * from loop_pre/loop_post and the microtask drain, running each endpoint's
     * full process pass only when it flagged pending work -- one engine pass
     * per loop turn instead of one per native call. */
    struct us_nq_driver_s *nq_head;
#ifdef LIBUS_USE_LIBUV
    /* A fallthrough us_timer_t armed to quic_next_tick_us so the uv loop wakes
     * for lsquic's time-driven state. POSIX folds the deadline into the
     * epoll_pwait2 timeout via getTimeout() instead. */
    struct us_timer_t *quic_timer;
#endif
    struct us_socket_group_t *iterator;
    char *recv_buf;
    char *send_buf;
    void *ssl_data;
    void (*pre_cb)(struct us_loop_t *);
    void (*post_cb)(struct us_loop_t *);
    struct us_udp_socket_t *closed_udp_head;
    struct us_socket_t *closed_head;
    struct us_socket_t *low_prio_head;
    struct us_socket_t *low_prio_iterator;
    int low_prio_budget;
    struct us_connecting_socket_t *dns_ready_head;
    struct us_connecting_socket_t *closed_connecting_head;
    zig_mutex_t mutex;
    void *parent_ptr;
    char parent_tag;
    /* We do not care if this flips or not, it doesn't matter */
    size_t iteration_nr;
    void* jsc_vm;
    /* Reentrancy depth of us_loop_run_bun_tick. When >1, we are inside a
     * nested tick (e.g. waitForPromise from a poll callback). Freeing closed
     * sockets must be deferred to the outermost tick so the outer dispatch
     * doesn't read a freed poll. */
    int tick_depth;
};

#endif // LOOP_DATA_H

```

### Core Architecture Module: `packages/bun-usockets/src/loop.c`
```
/*
 * Authored by Alex Hultman, 2018-2021.
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
// clang-format off
#include "libusockets.h"
#include "internal/internal.h"
#include "quic.h"
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#ifndef WIN32
#include <fcntl.h>
#include <sys/ioctl.h>
#include <unistd.h>
#endif
#ifdef __linux__
#include <netinet/in.h>
#include <linux/errqueue.h>
#endif

#if __has_include("wtf/Platform.h")
#include "wtf/Platform.h"
#elif !defined(ASSERT_ENABLED)
#if defined(BUN_DEBUG) || defined(__has_feature) && __has_feature(address_sanitizer) || defined(__SANITIZE_ADDRESS__)
#define ASSERT_ENABLED 1
#else
#define ASSERT_ENABLED 0
#endif
#endif

#if ASSERT_ENABLED
extern const size_t Bun__lock__size;
#endif

extern void Bun__internal_ensureDateHeaderTimerIsEnabled(struct us_loop_t *loop);

#ifdef LIBUS_USE_LIBUV

void sweep_timer_cb(struct us_internal_callback_t *cb);

// when the sweep timer is disabled, we don't need to do anything
void sweep_timer_noop(struct us_timer_t *timer) {}

void us_internal_enable_sweep_timer(struct us_loop_t *loop) {
    loop->data.sweep_timer_count++;
    if (loop->data.sweep_timer_count == 1) {
        us_timer_set(loop->data.sweep_timer, (void (*)(struct us_timer_t *)) sweep_timer_cb, LIBUS_TIMEOUT_GRANULARITY * 1000, LIBUS_TIMEOUT_GRANULARITY * 1000);
        Bun__internal_ensureDateHeaderTimerIsEnabled(loop);
    }
}

void us_internal_disable_sweep_timer(struct us_loop_t *loop) {
    loop->data.sweep_timer_count--;
    if (loop->data.sweep_timer_count == 0) {
        us_timer_set(loop->data.sweep_timer, (void (*)(struct us_timer_t *)) sweep_timer_noop, 0, 0);
    }
}

#else

#define LIBUS_TIMEOUT_GRANULARITY_NS ((long long) LIBUS_TIMEOUT_GRANULARITY * 1000000000LL)

uint64_t us_internal_monotonic_ns(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t) ts.tv_sec * 1000000000ULL + (uint64_t) ts.tv_nsec;
}

void us_internal_enable_sweep_timer(struct us_loop_t *loop) {
    loop->data.sweep_timer_count++;
    if (loop->data.sweep_timer_count == 1) {
        loop->data.sweep_next_tick_ns = (long long) us_internal_monotonic_ns() + LIBUS_TIMEOUT_GRANULARITY_NS;
        Bun__internal_ensureDateHeaderTimerIsEnabled(loop);
    }
}

void us_internal_disable_sweep_timer(struct us_loop_t *loop) {
    loop->data.sweep_timer_count--;
    if (loop->data.sweep_timer_count == 0) {
        loop->data.sweep_next_tick_ns = -1;
    }
}

long long us_internal_sweep_timeout_ns(struct us_loop_t *loop) {
    if (loop->data.sweep_next_tick_ns < 0) {
        return -1;
    }
    /* Its own reading, deliberately: this bounds the poll so the sweep is not
     * starved, and a caller's older reading would round the deadline up. */
    long long diff = loop->data.sweep_next_tick_ns - (long long) us_internal_monotonic_ns();
    return diff > 0 ? diff : 0;
}

void us_internal_sweep_if_due(struct us_loop_t *loop) {
    if (loop->data.sweep_next_tick_ns < 0) {
        return;
    }
    long long now = (long long) us_internal_monotonic_ns();
    if (now < loop->data.sweep_next_tick_ns) {
        return;
    }
    /* Re-arm first: a timeout handler may unlink the last socket and disarm. */
    loop->data.sweep_next_tick_ns = now + LIBUS_TIMEOUT_GRANULARITY_NS;
    us_internal_timer_sweep(loop);
}

#endif


/* -1 if the wakeup async cannot be created; nothing is left allocated in loop->data. */
int us_internal_loop_data_init(struct us_loop_t *loop, void (*wakeup_cb)(struct us_loop_t *loop),
    void (*pre_cb)(struct us_loop_t *loop), void (*post_cb)(struct us_loop_t *loop)) {
    // We allocate with calloc, so we only need to initialize the specific fields in use.
#ifdef LIBUS_USE_LIBUV
    loop->data.sweep_timer = us_create_timer(loop, 1, 0);
#else
    loop->data.sweep_next_tick_ns = -1;
#endif
    loop->data.sweep_timer_count = 0;
    loop->data.recv_buf = us_malloc(LIBUS_RECV_BUFFER_LENGTH + LIBUS_RECV_BUFFER_PADDING * 2);
    loop->data.send_buf = us_malloc(LIBUS_SEND_BUFFER_LENGTH);
    /* Every read on this loop writes into recv_buf; a NULL here makes each one
     * fail with EFAULT for the life of the process. */
    if (!loop->data.recv_buf || !loop->data.send_buf) Bun__outOfMemory();
    loop->data.pre_cb = pre_cb;
    loop->data.post_cb = post_cb;
    loop->data.wakeup_async = us_internal_create_async(loop, 1, 0);
    if (!loop->data.wakeup_async) {
        us_free(loop->data.recv_buf);
        us_free(loop->data.send_buf);
#ifdef LIBUS_USE_LIBUV
        us_timer_close(loop->data.sweep_timer, 0);
#endif
        return -1;
    }
    us_internal_async_set(loop->data.wakeup_async, (void (*)(struct us_internal_async *)) wakeup_cb);
#if ASSERT_ENABLED
    if (Bun__lock__size != sizeof(loop->data.mutex)) {
        BUN_PANIC("The size of the mutex must match the size of the lock");
    }
#endif
    return 0;
}

void us_internal_loop_data_free(struct us_loop_t *loop) {
#ifndef LIBUS_NO_SSL
    us_internal_free_loop_ssl_data(loop);
#endif

    us_free(loop->data.recv_buf);
    us_free(loop->data.send_buf);

#ifdef LIBUS_USE_LIBUV
    us_timer_close(loop->data.sweep_timer, 0);
    if (loop->data.quic_timer) us_timer_close(loop->data.quic_timer, 0);
#endif
    us_internal_async_close(loop->data.wakeup_async);
}

__attribute__((always_inline)) void us_wakeup_loop(struct us_loop_t *loop) {
#ifndef LIBUS_USE_LIBUV
    __atomic_fetch_add(&loop->pending_wakeups, 1, __ATOMIC_RELEASE);
#endif
    us_internal_async_wakeup(loop->data.wakeup_async);
}

void us_internal_loop_link_group(struct us_loop_t *loop, struct us_socket_group_t *group) {
    /* Insert this group as the head of loop */
    group->next = loop->data.head;
    group->prev = 0;
    if (loop->data.head) {
        loop->data.head->prev = group;
    }
    loop->data.head = group;
}

/* Unlink is called before the embedding owner frees its storage */
void us_internal_loop_unlink_group(struct us_loop_t *loop, struct us_socket_group_t *group) {
    /* If a timeout callback in us_internal_timer_sweep deinits the current group,
     * advance the sweep iterator before group->next is cleared — otherwise the sweep
     * walks into freed storage and skips active groups. */
    if (group == loop->data.iterator) {
        loop->data.iterator = group->next;
    }
    if (loop->data.head == group) {
        loop->data.head = group->next;
        if (loop->data.head) {
            loop->data.head->prev = 0;
        }
    } else {
        group->prev->next = group->next;
        if (group->next) {
            group->next->prev = group->prev;
        }
    }
}

/* Teardown helper: close every socket in every group currently linked to this
 * loop. Covers Listener/uWS-App-owned groups that the Zig RareData group list
 * doesn't know about — without this, an accepted us_socket_t whose group is
 * embedded in a still-live Listener leaks at process.exit() (LSAN: 88-byte
 * us_create_poll from loop.c:375). closeAll may unlink the group it's called
 * on, so cache `next` before each call. Returns 1 if anything was linked. */
int us_loop_close_all_groups(struct us_loop_t *loop) {
    struct us_socket_group_t *g = loop->data.head;
    int any = 0;
    while (g) {
        struct us_socket_group_t *next = g->next;
        /* Only connecting/connected sockets are stranded here. Listen sockets are
         * 1:1 owned by a Listener / uWS App that holds a raw pointer to them; the
         * runtime's stop phase has already stopped those owners before this sweep,
         * and closing a listen socket from under one that was not would be a UAF. */
        if (g->head_sockets || g->head_connecting_sockets || g->low_prio_count) {
            us_socket_group_close_all_ex(g, /* also_listeners */ 0);
            any = 1;
        }
        /* close_all → unlink may have spliced our cached `next` out too (an
         * on_close handler closing a different group's last socket); re-read
         * from the loop head if `next` is no longer linked. */
        if (next && !next->linked) next = loop->data.head;
        g = next;
    }
    return any;
}

/* This functions should never run recursively */
void us_internal_timer_sweep(struct us_loop_t *loop) {
    struct us_internal_loop_data_t *loop_data = &loop->data;
    /* For all socket groups in this loop */
    loop_data->iterator = loop_data->head;
    while (loop_data->iterator) {

        struct us_socket_group_t *group = loop_data->iterator;

        /* Update this group's timestamps (this could be moved to loop and done once) */
        group->global_tick++;
        unsigned char short_ticks = group->timestamp = group->global_tick % 240;
        unsigned char long_ticks = group->long_timestamp = (group->global_tick / 15) % 240;

        /* Begin at head */
        struct us_socket_t *s = group->head_sockets;
        while (s) {
            /* Seek until end or timeout found (tightest loop) */
            while (1) {
                /* We only read from 1 random cache line here */
                if (short_ticks == s->timeout || long_ticks == s->long_timeout) {
                    break;
                }

                /* Did we reach the end without a find? */
                if ((s = s->next) == 0) {
                    goto next_group;
                }
            }

            /* Here we have a timeout to emit (slow path) */
            group->iterator = s;

            if (short_ticks == s->timeout) {
    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #44632** (2026-10-06): **node:v8 startupSnapshot.isBuildingSnapshot() throws ERR_NOT_IMPLEMENTED instead of returning false (breaks bson / mongodb / mongoose import)**
  *Symptoms*: ### What version of Bun is running?  1.3.5  ### What platform is your computer?  Darwin 25.6.0 arm64 arm  ### What steps can reproduce the bug?  1. Create a new Bun TypeScript project.  2. Install Mongoose: bun add mongoose  3. Create a TypeScript server file with the following code:  import mongoose from "mongoose";  console.log("Mongoose loaded successfully");  4. Run the application using: bun --watch src/server/server.ts  5. The application crashes during module initialization with the following error:  NotImplementedError: node:v8 isBuildingSnapshot is not yet implemented in Bun. code: "ERR_NOT_IMPLEMENTED"  6. The error originates from the BSON package used by the MongoDB Node.js driver, which is a dependency of Mongoose:  bson → mongodb → mongoose  The error occurs at: bson/lib/bson.cjs:2620  The application crashes before any MongoDB connection is attempted.  ### What is the expected behavior?  I expect Bun to successfully load the `mongoose`/`mongodb`/`bson` dependency without throwing `ERR_NOT_IMPLEMENTED`.  Specifically, when `bson` accesses the Node.js V8 API:  `startupSnapshot.isBuildingSnapshot()`  Bun should either provide a compatible implementation of this API or handle the API call in a way that allows the dependency to initialize successfully.  The expected result is that the application starts normally and reaches the MongoDB connection code without crashing during module initialization.  ### What do you see instead?  When I run the application with Bun, t
  **Post-Mortem & Fix Analysis**:
  > I encountered this issue on Bun 1.3.5 with Mongoose/MongoDB/BSON on macOS ARM64.  I can confirm that upgrading to Bun 1.4.2 resolves the issue completely. The same application now starts and imports Mongoose successfully without the `isBuildingSnapshot` error.  Posting this as an additional confirmation that the issue is resolved in Bun 1.4.2.

- **Issue #44580** (2026-10-05): **Mnemonist LRU eviction remains over 200x slower than Node on Bun 1.4.2 and canary**
  *Symptoms*: ### What version of Bun is running?  1.4.2+744846f844374847c902b5e7fd59b4342a51ef99; also 1.4.3-canary.1+b73ae471a  ### What platform is your computer?  Linux-7.2.8-locietta-WSL2-xanmod1-x86_64-with-glibc2.43; x86_64, WSL2, 16 logical CPUs.  ### What steps can reproduce the bug?  ### Reproduction  Install the exact package versions in an otherwise empty directory:  ```sh npm install --save-exact flru@1.0.2 lru.min@1.1.5 lru-cache@11.5.3 mnemonist@0.40.5 tinybench@6.2.0 mitata@1.0.34 bun tinybench.mjs node tinybench.mjs bun mitata.mjs node mitata.mjs ```  `workload.mjs`:  ```js import assert from 'node:assert/strict'; import createFlru from 'flru'; import { createLRU as createLruMin } from 'lru.min'; import { LRUCache } from 'lru-cache'; import { createRequire } from 'node:module'; const createMnemonistLruCache = createRequire(import.meta.url)('mnemonist/lru-cache');  export const maxItems = 1000; export const evictItems = 2100; const DATA = Array.from({ length: evictItems }, (_, index) => [`key${index}`, { hello: index }]); const DATA2 = Array.from({ length: evictItems }, (_, index) => [`key${index}`, { world: (index * 97) % 10000000 }]); const flru = createFlru(maxItems); const lruMin = createLruMin({ max: maxItems }); const lruCache = new LRUCache({ max: maxItems }); const mnemonistLru = new createMnemonistLruCache(maxItems); for (let i = 0; i < maxItems; i++) {   flru.set(DATA[i][0], DATA[i][1]);   lruMin.set(DATA[i][0], DATA[i][1]);   lruCache.set(DATA[i][0], DATA[i][1]);
  **Post-Mortem & Fix Analysis**:
  > Superseded by #44583, which reduces this slowdown to repeated object-property deletion/reinsertion with no library dependencies. The new report includes a tiny runnable reproduction, correctness checks, stable/canary measurements and profiling evidence. Closing this broader library report to keep one active report for the problem. The slowdown is not fixed; the original measurements remain here for context.

- **Issue #44386** (2026-10-07): **Intl.Segments.containing() includes the preceding grapheme at a leading surrogate**
  *Symptoms*: ### Bun versions  Reproduced on Linux x86_64 (kernel 6.18.44) with:  - Bun 1.3.14+0d9b296af - Bun 1.4.2+744846f84  ### Minimal reproduction  Save as `repro.mjs` and run `bun repro.mjs`. No dependencies or terminal UI library are needed.  ```js const text = 'a\u{1F600}'; // a😀, three UTF-16 code units const segments = new Intl.Segmenter('en', {   granularity: 'grapheme', }).segment(text); const summarize = ({ index, segment }) => ({ index, segment });  console.log(JSON.stringify({   iteration: [...segments].map(summarize),   atLeadingSurrogate: summarize(segments.containing(1)),   atTrailingSurrogate: summarize(segments.containing(2)), })); ```  ### Expected behavior  Iteration identifies two graphemes, `a` at index 0 and `😀` at index 1. Both UTF-16 offsets 1 and 2 are inside that same emoji grapheme, so both containing calls should return `{ "index": 1, "segment": "😀" }`.  Node v24.19.0 and Deno 2.9.0 produce:  ```json {"iteration":[{"index":0,"segment":"a"},{"index":1,"segment":"😀"}],"atLeadingSurrogate":{"index":1,"segment":"😀"},"atTrailingSurrogate":{"index":1,"segment":"😀"}} ```  ### Actual behavior  Both tested Bun versions produce:  ```json {"iteration":[{"index":0,"segment":"a"},{"index":1,"segment":"😀"}],"atLeadingSurrogate":{"index":0,"segment":"a😀"},"atTrailingSurrogate":{"index":1,"segment":"😀"}} ```  The result at the leading surrogate includes the preceding grapheme, contradicting the segmentation iterator. The trailing-surrogate lookup is correct. This 
  **Post-Mortem & Fix Analysis**:
  > Fixed by https://github.com/WebKit/WebKit/commit/3e27303e85c71c62f0685dceecafea5c657a126e

- **Issue #44372** (2026-10-01): **`spawn({ detached: true })` without `cwd` performs an internal chdir to $HOME — EPERM under home-denying sandboxes**
  *Symptoms*: ### What version of Bun is running?  744846f844374847c902b5e7fd59b4342a51ef99  ### What platform is your computer?  Darwin 25.6.0 arm64 arm  ### What steps can reproduce the bug?  - Bun standalone binary (as bundled in opencode 2), under a Seatbelt profile that does not grant $HOME. - Observed through opencode's call `spawn(command, args, { detached: true, stdio: ["ignore","ignore","pipe"], env })` with no `cwd`: the call fails with    ```   Error: EPERM: operation not permitted, getcwd '<cwd>' -> '/Users/<user>'       at chdir (unknown)   ```    i.e. the detached-spawn path performs an internal chdir to the user's home directory   and requires read access to $HOME, which least-privilege sandboxes deny.  ### What is the expected behavior?  `detached: true` should not require or mutate $HOME access. If a daemon default cwd is needed, "/" requires no grant. Passing an explicit `cwd` appears to change the chdir target (not fully isolated in my setup; a minimal `bun -e 'spawn(..., { detached: true })'` under `sandbox-exec` should isolate it).  ### What do you see instead?  _No response_  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Unable to reproduce this.  **Bun version:** `1.4.3` on `linux x64`, and a debug build of `main` (4b02e1031d). The reporter's build (744846f8, Bun 1.4.2) has the same spawn code.  **What the spawn code does.** `spawn()` without a `cwd` option adds no `chdir` action to the child. The JS binding passes an empty `cwd` when the user gives none (`src/runtime/api/bun/js_bun_spawn_bindings.rs`, `user_specified_cwd`). The spawn code skips `chdir` for an empty `cwd` (`src/spawn_sys/spawn_process.rs`, `if !options.cwd.is_empty()`). `detached: true` only sets `setsid` on the child. It does not read `$HOME`.  **Attempt 1:** `child_process.spawn` with `detached: true`, no `cwd`, and `$HOME` set to a path that does not exist.  ```js // /tmp/spawn-detached.js const { spawn } = require("node:child_process"); const child = spawn("sh", ["-c", "pwd"], { detached: true, stdio: ["ignore", "pipe", "pipe"], env: process.env }); child.stdout.on("data", d => process.stdout.write("child cwd: " + d)); child.on("e

- **Issue #44341** (2026-10-01): **Proxy settings silently ignored: UDP proxy options and fetch routing flags differ from current docs**
  *Symptoms*: ### What version of Bun is running?  Latest stable, isolated official Windows x64 release executable:  `1.4.2+744846f84` (full revision `744846f844374847c902b5e7fd59b4342a51ef99`).  Also reproduced with installed `1.4.1-canary.1+208286955` (full revision `2082869555b6122324ade0df2a95d8e6e79d2f86`). Both executables give the same results below. Each reproduction exits zero after reporting its observations; discrepancies are identified in the JSON, rather than intentionally crashing.  ### What platform is your computer?  `Microsoft Windows NT 10.0.26200.0 x64`  Windows 11 Home, OS build 26200, process architecture x64. Not tested on Linux or macOS.  ### What steps can reproduce the bug?  There are two related observations, separated here so unsupported UDP functionality is not confused with the documented fetch contract:  1. `Bun.udpSocket` accepts top-level `proxy` and nested `connect.proxy` without reading or rejecting them, and then sends directly. I understand UDP proxying is not documented or declared in bun-types. This is a request for a diagnostic for an unsupported routing option, **not a claim that HTTP CONNECT can proxy arbitrary UDP or that Bun already promises UDP/SOCKS support**. 2. Native fetch behaves differently from the current public documentation for force-direct, force-proxy, and failed CONNECT handling. These differences also reproduce on latest stable 1.4.2. They may be documentation versioning problems if the described features are intended only for a new
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. The three fetch differences are a release alignment gap, not a regression. The UDP part is a question about unknown option keys, answered below.  ## fetch: `proxy: false`, `respectNoProxy: false`, `ERR_PROXY_TUNNEL`  These three features landed on main in #42692 (commit `63a495cb46`, merged 2026-09-15). The `bun-v1.4.2` tag is from 2026-09-04 and does not contain that commit. The docs at bun.com describe main, so they are ahead of 1.4.2. The features ship in the next release (1.4.3). They are already in the 1.4.3 canary.  I ran your `http-proxy-repro.ts` unchanged (the only addition is `BUN_DEBUG_QUIET_LOGS=1` in the child env for the debug build) against the current main debug build and against the 1.4.3 canary.  **Bun version:** `1.4.3-canary.1+367d939d9` on `linux x64` (and a debug build of main at the same revision)  ```console $ bun --no-env-file http-proxy-repro.ts environment-default           expected proxy   observed proxy   true proxy-false    

- **Issue #44238** (2026-09-29): **bun build --compile: embedded native libraries (.so) are extracted to hidden  paths on every run and never unlinked (.node addons are)**
  *Symptoms*: ### What version of Bun is running?  1.3.14 (as embedded in opencode 1.18.33's `bun build --compile` binary — this is where we observed it)  ### What platform is your computer?  Linux 6.17 x86_64 (Ubuntu 25.04-ish, tmpfs /tmp)  ### What you did  A standalone binary built with `bun build --compile` that embeds **native shared libraries** (`.so` napi addons) extracts them to a *hidden, randomized* path in `$TMPDIR` on every process start and **never unlinks them**:  ``` $TMPDIR/.{content-derived hex stem}-{8-digit index}.{so,node} e.g. /tmp/.9adbdafff7edfd87-00000000.so   (13.7 MB @opentui/core)      /tmp/.bcd9d71ebc8fba3c-00000001.so  (5.6 MB fff-core)      /tmp/.5effd61ebdd3ff6b-00000002.node (small addon) ```  We caught this on a machine where `/tmp` (tmpfs) filled to 99%: ~670 files / ~6.1 GB accumulated over ~4 days, minted in bursts that match app launches. Every copy within a family is byte-identical — a fresh extraction per launch, never reused, never removed.  ### What you expected to happen  The extraction is a dlopen-then-clean dance: after `dlopen`, the temp file should be unlinked (the mapping survives via the fd/inode), so no files accumulate.  ### What actually happens  `strace -f` of the opencode TUI shows all three embedded natives being written via a dirfd-relative `openat(..., O_WRONLY|O_CREAT)` and then reopened by path (the dlopen), but only the **`.node`** addon gets cleaned up:  ```strace 1439838 openat(13, ".9adbd9bfeaedfdd7-00000000.so", O_WRONLY|O_CREA
  **Post-Mortem & Fix Analysis**:
  > **Bun version:** `1.4.3` (release) and `1.4.3-debug+367d939d9` (current main) on `linux x64`  This was fixed in Bun 1.4.0 by #29587 (issue #29585). Bun 1.3.14, the version embedded in the opencode binary, names each extracted file with a timestamp and a counter, so every run writes a new copy and nothing reuses it. Since 1.4.0 the name is a hash of the file contents (`{tmpdir}/.bun-{uid}-{hash}.{ext}`). A run reuses the file from a previous run when it exists with the right owner and size. One file per distinct library stays in `$TMPDIR` as a cache. No copy accumulates per launch.  **Repro:** a `bun build --compile` binary that loads an embedded `.so` through `bun:ffi`.  ```c // lib.c int add(int a, int b) { return a + b; } ```  ```ts // app.ts import { dlopen, FFIType } from "bun:ffi"; import libPath from "./libadd.so" with { type: "file" }; const lib = dlopen(libPath, { add: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } }); console.log("add(2,3) =", lib.symbols.add(2, 3)

- **Issue #44107** (2026-09-27): **stripTypeScriptTypes missing from node when installing bunx @deepseek-ai/dsh web**
  *Symptoms*: ### What version of Bun is running?  1.4.2  ### What platform is your computer?  Microsoft Windows NT 10.0.22621.0 x64  ### What steps can reproduce the bug?  bunx @deepseek-ai/dsh web  ### What is the expected behavior?  install it and run it.  ### What do you see instead?  stripTypeScriptTypes missing from node  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > This is a duplicate of #39971, which reports the same error from the same command (`bunx @deepseek-ai/dsh web`).  The cause is that `node:module` does not export `stripTypeScriptTypes` (a Node.js 22.13+ API). The package imports it at startup.  **Bun version:** `1.4.3` on `linux x64`  ```console $ cat strip.mjs import { stripTypeScriptTypes } from "node:module"; console.log(stripTypeScriptTypes("const a: number = 1"));  $ bun strip.mjs SyntaxError: Export named 'stripTypeScriptTypes' not found in module 'node:module'.  Bun v1.4.3-canary.1+367d939d9 (Linux x64) ```  An implementation is in progress in #35517. The Node.js compatibility page lists the function as missing: https://bun.com/docs/runtime/nodejs-compat#node-module  Please add a reaction or any extra details on #39971 so it stays in one place. 

- **Issue #44075** (2026-10-03): **macOS: dns.lookup/fetch ENOTFOUND for split-DNS names — DNSServiceGetAddrInfoEx ignores kDNSServiceAttrAllowFailover (follow-up to #40573)**
  *Symptoms*: ### What version of Bun is running?  1.4.2+744846f84  ### What platform is your computer?  Darwin 27.0.0 arm64 arm (macOS 27.0, build 26A428)  ### What steps can reproduce the bug?  Follow-up to #40573. The `kDNSServiceAttrAllowFailover` change from #40675 does not fix this on my machine, and I think I've found why.  Setup: a corporate VPN pushes split DNS for `corp.example`. iCloud Private Relay is active, so mDNSResponder's first-choice DNS service for most queries is ODoH. `scutil --dns` (sanitized):  ``` resolver #1   nameserver[0] : 2001:db8::1   nameserver[1] : 192.168.1.1   if_index : 7 (en0)   flags    : Request A records, Request AAAA records  resolver #2   domain   : corp.example   nameserver[0] : fd00::53   nameserver[1] : 10.0.0.53   flags    : Supplemental, Request A records, Request AAAA records   reach    : 0x00000002 (Reachable) ```  ```js const h = "host.corp.example"; for (const backend of [undefined, "system", "libc", "c-ares"]) {   try { console.log(backend, JSON.stringify(await Bun.dns.lookup(h, { backend }))); }   catch (e) { console.log(backend, "ERR", e.code); } } try { console.log("fetch", (await fetch(`https://${h}/`, { method: "HEAD" })).status); } catch (e) { console.log("fetch ERR", e.code); } ```  ### What is the expected behavior?  Same result as libc `getaddrinfo` (`dscacheutil -q host -a name host.corp.example`, curl, Python and Node all resolve it):  ``` libc [{"address":"fd00::10","family":6,"ttl":0},{"address":"10.0.0.10","family":4,"ttl":0
  **Post-Mortem & Fix Analysis**:
  > Same here with Claude Code 2.1.284, which bundles Bun 1.4.3, so it still happens after 1.4.2.  - macOS 27.0 (Darwin 27.0.0 arm64), Viscosity (OpenVPN) pushing split DNS; `scutil --dns` lists the VPN resolvers as `Supplemental` per domain - Claude Code HTTP MCP server on the VPN: `getaddrinfo ENOTFOUND host.corp.example`; curl, Node, Python and `dscacheutil` resolve it - `dns-sd -G v4 host.corp.example`, fresh (flags `0x2`, not from cache): `No Such Record`; same for names in a second split domain (`*.swarm.example`) - `dns-sd -i <utun index> -G v4 host.corp.example` resolves - Names in a split domain under `.local` resolve unscoped  `BUN_FEATURE_FLAG_DISABLE_DNS_CACHE_LIBINFO=1` works around it for fetch: `claude mcp get <server>` goes from `ENOTFOUND` to `Needs authentication`.

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

### Incident Patch 1: `bd599f5a` (2026-10-07)
**Commit Message**: `bun check`: fix differences from `tsc` (#44665)

Follow-up to #44361. Fixes cases where `bun check` and `tsc` 7.0.2 do
different things.

### `bun check` checks what `tsc` checks

`bun check <args>` now reports the same projects as `tsc <args>
--noEmit`.

| In a project with `references` | `tsc` | `bun check` before | `bun
check` now |
|---|---|---|---|
| no flags | its own files | its own files and every referenced project
| its own files |
| `-b` | every referenced project | every referenced project | every
referenced project |
| `--strict` and other compiler options | apply to the project | applied
to every referenced project | apply to the project |

Referenced projects are still read from their source files, so nothing
has to be built first.

Where `tsc` checks nothing, `bun check` does something useful and says
so:

| | `tsc` | `bun check` |
|---|---|---|
| a `tsconfig.json` with `"files": []` and `references`, like `create
vite` writes | checks nothing, exits 0 | follows the references and
prints a note |
| no `tsconfig.json` here or above, some below | prints its help | lists
them, with the command for one and for all |
| `bun check src/index.ts` or `bun check .` next to a

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1409,6 +1409,7 @@ dependencies = [
  "bun_sema",
  "bun_sema_baselines",
  "bun_sema_driver",
+ "bun_sys",
  "bun_threading",
  "libc",
 ]
```

**File**: `docs/runtime/check.mdx` (modified, +55/-13)
```diff
@@ -74,13 +74,13 @@ Your editor doesn't use `bun check`. It runs its own copy of TypeScript. To keep
 
 ## Replace `tsc`
 
-`bun check` reads the same `tsconfig.json` as `tsc`, so most projects only change the command.
+`bun check` reads the same `tsconfig.json` as `tsc` and checks the same files, so most projects only change the command.
 
 | Instead of                           | Run                            |
 | ------------------------------------ | ------------------------------ |
 | `tsc --noEmit`                       | `bun check`                    |
 | `tsc --noEmit -p packages/server`    | `bun check -p packages/server` |
-| `tsc -b`                             | `bun check`                    |
+| `tsc -b`                             | `bun check -b`                 |
 | `tsc --noEmit && bun src/index.ts`   | `bun --check src/index.ts`     |
 | `tsc --noEmit && bun test`           | `bun test --check`             |
 | `tsc --noEmit && bun build ./app.ts` | `bun build --check ./app.ts`   |
@@ -130,6 +130,8 @@ See [TypeScript 6 and 7](/typescript-6) for the `tsconfig.json` that Bun recomme
 
 Install your dependencies, then run `bun check`. A type error fails the job.
 
+If your projects are connected by `references`, run [`bun check -b`](#every-project) to check all of them.
+
 ### GitHub Actions
 
 ```yaml .github/workflows/typecheck.yml icon="file-code"
@@ -242,7 +244,7 @@ Bun checks each file with the same `tsconfig.json` your editor uses for it:
 - If that `tsconfig.json` does not include the file but has `references`, Bun uses the referenced project that includes the file. The `tsconfig.json` from `create vite` works this way.
 - If no project includes the file, Bun still checks it, with the options of the nearest `tsconfig.json`.
 
-A directory means the files of the project inside that directory, so `bun check .` is the same as `bun check`. If the project has no files there, Bun checks every file in the directory that `exclude` does not rule out. An example is `bun check scripts` when `include` is `["src"]`.
+A directory means the files of the project inside that directory. If the project has no files there, Bun checks every file in the directory that `exclude` does not rule out. An example is `bun check scripts` when `include` is `["src"]`.
 
 ### Without a `tsconfig.json`
 
@@ -267,25 +269,55 @@ Bun uses the compiler options that [`bun init`](/runtime/templating/init) writes
 
 ## Monorepos
 
-Run `bun check` once at the root. How Bun finds the projects depends on the root `tsconfig.json`.
+`bun check` checks the project that `tsc` checks in the same directory: the one with the nearest `tsconfig.json`.
+
+### One package
+
+Run `bun check` in the package, or name it from anywhere.
+
+```bash terminal icon="terminal"
+bun check -p packages/web
+```
+
+If the package has `references`, Bun reads the referenced projects from their source files. You don't have to build them first, and Bun does not write `.d.ts` or `.tsbuildinfo` files. Bun reports the errors of the package only. Compiler options on the command line apply to the package only.
+
+### Every project
 
-**With `references` in the root `tsconfig.json`**, `bun check` follows them, like `tsc -b`. Bun checks each project with its own options, and prints the errors one project at a time, in build order. If two projects include the same file, Bun checks it in both and prints its errors once for each project.
+Use `-b` to follow `references`, like `tsc -b`.
 
-Bun reads a referenced project from its source files. You don't have to build it first, and Bun does not write `.d.ts` or `.tsbuildinfo` files.
+```bash terminal icon="terminal"
+bun check -b
+```
 
-**Without a root `tsconfig.json`**, `bun check` checks every TypeScript file below the current directory. Bun checks each file once, with the nearest `tsconfig.json`. Files with no `tsconfig.json` get the [default compiler options](#without-a-tsconfigjson).
+Bun checks each project with its own options, and prints the errors one project at a time, in build order. If two projects include the same file, Bun checks it in both and reports its errors for both, like `tsc -b`.
 
 ```txt
 packages/web/src/index.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'.
 Found 1 error in 1 file, checked 2 files across 2 projects [21.00ms]
 ```
 
-To check one package, name it:
+### A `tsconfig.json` with nothing but `references`
 
-```bash terminal icon="terminal"
-bun check packages/web
+The `tsconfig.json` from `create vite` has `"files": []` and `references`. `tsc` without `-b` checks nothing there and succeeds. `bun check` follows the references, and says so:
+
+```txt
+note: tsconfig.json has no files of its own. Checked the projects it references, like tsc -b.
+```
+
+### No `tsconfig.json` at the root
+
+If no `tsconfig.json` is in the current directory or above it, but some are below it, `bun check` does not guess which ones you mean. It lists them and stops.
+
+```txt

```

**File**: `src/js_parser/lexer.rs` (modified, +15/-9)
```diff
@@ -1188,16 +1188,17 @@ impl<'a> Lexer<'a> {
         } else {
             what
         };
-        let what = bstr::BStr::new(what.unwrap_or_default());
         let logged_before = self.log().msgs.len();
         if kind == TypeScriptKind::Parse {
-            let _ = self.add_range_error(r, format_args!("{what}"));
+            let _ = self.add_range_error(r, format_args!(""));
         } else {
-            let text = format_args!("{what}");
-            self.log().add_range_error_fmt(Some(self.source), r, text);
+            self.log()
+                .add_range_error_fmt(Some(self.source), r, format_args!(""));
         }
         // Dropped if the previous error was at the same position.
         if let Some(msg) = self.log().msgs.get_mut(logged_before) {
+            // The bytes as they are: `Format` replaces what is not valid UTF-8.
+            msg.data.text = what.unwrap_or_default().to_vec().into();
             msg.metadata = bun_ast::Metadata::TypeScript { code, kind };
         }
     }
@@ -1641,7 +1642,8 @@ impl<'a> Lexer<'a> {
 
     /// Whether the token is the reserved word `keyword`. TypeScript's scanner returns the keyword
     /// also for a word written with an escape, so in tolerant mode the token becomes `keyword`;
-    /// `next_token` reports the escape.
+    /// `next_token` reports the escape. Only for a caller that takes the keyword if it is there:
+    /// the statement handlers leave their keyword with `next`.
     #[inline]
     pub(crate) fn is_keyword(&mut self, keyword: T) -> bool {
         if self.token == T::TEscapedKeyword
@@ -3420,17 +3422,21 @@ impl<'a> Lexer<'a> {
         Ok(res)
     }
 
-    /// `Scanner.TokenValue`
+    /// `Scanner.TokenValue`. `Scan` leaves it unchanged at a token that is no name, keyword or
+    /// literal: `previous` is the value of the last token that was one.
     #[cold]
     #[inline(never)]
-    pub(crate) fn token_value(&mut self) -> Result<Vec<u8>, Error> {
+    pub(crate) fn token_value(&mut self, previous: &[u8]) -> Result<Vec<u8>, Error> {
         Ok(match self.token {
             T::TStringLiteral => self.to_utf8_e_string()?.data.slice().to_vec(),
+            T::TNoSubstitutionTemplateLiteral | T::TTemplateHead => {
+                self.cooked_template_contents(self.string_literal_raw_content)
+            }
             T::TNumericLiteral => bun_sema::atom::number_to_string(self.number),
-            T::TBigIntegerLiteral => [self.identifier, b"n"].concat(),
+            T::TBigIntegerLiteral => bun_sema::json::bigint_token_value(self.raw()),
             T::TPrivateIdentifier => self.identifier.to_vec(),
             _ if self.is_identifier_or_keyword() => self.identifier.to_vec(),
-            _ => self.raw().to_vec(),
+            _ => previous.to_vec(),
         })
     }
 
```

**File**: `src/js_parser/parse/lists.rs` (modified, +28/-14)
```diff
@@ -195,6 +195,16 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
         true
     }
 
+    /// `GetIdentifierToken`: a reserved word also if it is written with an escape.
+    fn token(&self) -> T {
+        match self.lexer.token {
+            T::TEscapedKeyword => {
+                crate::lexer::keyword(self.lexer.identifier).unwrap_or(T::TIdentifier)
+            }
+            token => token,
+        }
+    }
+
     /// The word the current token spells (`GetIdentifierToken`) if it is an identifier, otherwise empty.
     fn word(&self) -> &'a [u8] {
         if self.lexer.token == T::TIdentifier {
@@ -419,12 +429,18 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
             | T::TTry
             | T::TDebugger
             | T::TCatch
-            | T::TFinally
-            // TypeScript scans an escaped keyword as that keyword. Let the statement parser handle it.
-            | T::TEscapedKeyword => true,
+            | T::TFinally => true,
+            T::TEscapedKeyword => {
+                self.lexer.token = self.token();
+                let starts = self.is_start_of_statement();
+                self.lexer.token = T::TEscapedKeyword;
+                starts
+            }
             T::TImport => {
                 self.is_start_of_declaration()
-                    || self.look_ahead(|p| p.step() && matches!(p.lexer.token, T::TOpenParen | T::TLessThan | T::TDot))
+                    || self.look_ahead(|p| {
+                        p.step() && matches!(p.lexer.token, T::TOpenParen | T::TLessThan | T::TDot)
+                    })
             }
             // `is_start_of_declaration` does not look ahead past this token.
             T::TConst => true,
@@ -434,7 +450,11 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                 match Modifier::find(self.word()) {
                     Some(PAccessor | PPublic | PPrivate | PProtected | PStatic | PReadonly) => {
                         self.is_start_of_declaration()
-                            || !self.look_ahead(|p| p.step() && p.is_identifier_or_keyword() && !p.lexer.has_newline_before)
+                            || !self.look_ahead(|p| {
+                                p.step()
+                                    && p.is_identifier_or_keyword()
+                                    && !p.lexer.has_newline_before
+                            })
                     }
                     // Any other identifier starts an expression.
                     _ => true,
@@ -613,7 +633,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
             | ListKind::SwitchClauseStatements => {
                 !(token == T::TSemicolon && recovering) && self.is_start_of_statement()
             }
-            ListKind::SwitchClauses => matches!(token, T::TCase | T::TDefault),
+            ListKind::SwitchClauses => matches!(self.token(), T::TCase | T::TDefault),
             ListKind::TypeMembers => self.is_type_member_start(),
             ListKind::ClassMembers => {
                 self.is_class_member_start() || token == T::TSemicolon && !recovering
@@ -691,13 +711,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
     #[cold]
     #[inline(never)]
     pub(crate) fn is_list_terminator(&self, kind: ListKind) -> bool {
-        // `GetIdentifierToken`: a reserved word also if it is written with an escape.
-        let token = match self.lexer.token {
-            T::TEscapedKeyword => {
-                crate::lexer::keyword(self.lexer.identifier).unwrap_or(T::TIdentifier)
-            }
-            token => token,
-        };
+        let token = self.token();
         if token == T::TEndOfFile {
             return true;
         }
@@ -785,7 +799,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
     fn parsing_context_error(&self, kind: ListKind) -> u32 {
         match kind {
             // 'export' expected.
-            ListKind::SourceElements if self.lexer.token == T::TDefault => 1005,
+            ListKind::SourceElements if self.token() == T::TDefault => 1005,
             ListKind::SourceElements | ListKind::BlockStatements => 1128,
             ListKind::SwitchClauses => 1130,
             ListKind::SwitchClauseStatements => 1129,
```

**File**: `src/js_parser/parse/mod.rs` (modified, +22/-10)
```diff
@@ -2681,19 +2681,20 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
             p.lexer.next()?;
         } else {
             // Any expression is accepted and never checked. `checkExternalImportOrExportDeclaration` reports 1141 unless it
-            // is missing. `checkGrammarModuleElementContext` returns first in a block or a function.
+            // is missing. `checkGrammarModuleElementContext` returns first.
             let value = p.parse_expr(Level::Lowest)?;
-            if !value.is_missing() && p.current_scope().kind == js_ast::scope::Kind::Entry {
+            if !value.is_missing() && p.is_in_appropriate_context() {
                 p.ts_checker_error(p.lexer.range_from(path.loc), 1141);
             }
             p.keep_module_specifier(None, Some(value), path.loc);
         }
 
-        // After an import, `with` can be on the next line.
-        let is_with = p.lexer.is_keyword(T::TWith);
-        if (is_with || p.lexer.is_contextual_keyword(b"assert"))
-            && (!p.lexer.has_newline_before || (is_with && !p.is_in_export_statement()))
-        {
+        // After an import, `with` can be on the next line. After an export it starts a statement
+        // there, whose handler expects `is_keyword` not to have been asked.
+        let is_on_same_line = !p.lexer.has_newline_before;
+        let is_with =
+            (is_on_same_line || !p.is_in_export_statement()) && p.lexer.is_keyword(T::TWith);
+        if is_with || (is_on_same_line && p.lexer.is_contextual_keyword(b"assert")) {
             if !is_with {
                 let range = p.lexer.range();
                 p.lexer.ts_error(range, 2880);
@@ -2826,7 +2827,14 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
             properties: G::PropertyList::from_bump_vec(properties),
             ..Default::default()
         };
-        Ok((keeps.then(|| p.new_expr(object, open_brace_loc)), mode))
+        // `finishNode`, with or without the "}".
+        let end = p.lexer.full_start();
+        let object = keeps.then(|| {
+            let mut object = p.new_expr(object, open_brace_loc);
+            p.note_end(&mut object.loc, end);
+            object
+        });
+        Ok((object, mode))
     }
 
     pub(crate) fn parse_stmts_up_to(
@@ -3230,8 +3238,12 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
         }
         let snapshot = p.parser_snapshot();
         match attempt(p) {
-            // Stack and memory exhaustion are not outcomes of the speculative parse
-            Err(err @ (Error::StackOverflow | Error::Alloc(_))) => Err(err),
+            // Stack and memory exhaustion are not outcomes of the speculative parse. Its errors are
+            // dropped all the same: it has not succeeded.
+            Err(err @ (Error::StackOverflow | Error::Alloc(_))) => {
+                p.restore_parser_snapshot(snapshot);
+                Err(err)
+            }
             Err(_) => {
                 p.restore_parser_snapshot(snapshot);
                 // Speculative parses nested in this one may have added entries of their own.
```

**File**: `src/js_parser/parse/parse_skip_typescript.rs` (modified, +14/-7)
```diff
@@ -1613,6 +1613,8 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
         let mut is_parenthesized = false;
         // `skip_import_type_qualifier` has skipped all the names.
         let mut is_import_type = false;
+        // `skip_jsdoc_prefix_type` has skipped it. "*" is kept as the keyword "any", a name.
+        let mut is_jsdoc_prefix_type = false;
         // `parsePostfixTypeOrHigher`: whether what was skipped last is its operand. The result of
         // an operator ("keyof", "infer", "|", "extends") is not.
         let mut allows_postfix = true;
@@ -2090,7 +2092,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                                 };
                                 self.lexer.expect(T::TIdentifier)?;
                                 let mut has_constraint = false;
-                                if self.lexer.token == T::TExtends {
+                                if self.lexer.is_keyword(T::TExtends) {
                                     has_constraint = self
                                         .try_skip_type_script_constraint_of_infer_type_with_backtracking(
                                             opts,
@@ -2558,6 +2560,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                                 | T::TAsteriskEquals
                         ) {
                             self.skip_jsdoc_prefix_type::<KEEP>(opts)?;
+                            is_jsdoc_prefix_type = true;
                             break;
                         }
                         self.skip_type_reference_to_any_word()?;
@@ -2761,6 +2764,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                     // `parseEntityName`: a dot only continues a name. After any other type it is
                     // not consumed.
                     if is_import_type
+                        || is_jsdoc_prefix_type
                         || KEEP
                             && self.is_tolerant()
                             && (is_parenthesized || !self.last_type_takes_qualifier())
@@ -4325,15 +4329,18 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
     ) -> Result<(bun_ast::Expr, bool), Error> {
         let (start, is_at_import) = (self.lexer.loc(), self.lexer.token == T::TImport);
         // `parseLeftHandSideExpressionOrHigher`
-        let expression = self.parse_detached(|p| p.parse_expr(Level::New))?;
+        let mut expression = self.parse_detached(|p| p.parse_expr(Level::New))?;
         let has_arguments =
             self.skip_type_arguments_of_heritage_element(is_checked, grammar_error)?;
         // The keyword `import` by itself is a missing expression.
-        if has_arguments
-            && is_at_import
-            && matches!(expression.data, bun_ast::ExprData::EMissing(_))
-        {
-            *grammar_error = Some((self.lexer.range_from(start), 1326));
+        if is_at_import && matches!(expression.data, bun_ast::ExprData::EMissing(_)) {
+            let keyword_end = bun_ast::Loc {
+                start: start.start + b"import".len() as i32,
+            };
+            self.note_end(&mut expression.loc, keyword_end);
+            if has_arguments {
+                *grammar_error = Some((self.lexer.range_from(start), 1326));
+            }
         }
         Ok((expression, has_arguments))
     }
```

**File**: `src/js_parser/parse/parse_stmt.rs` (modified, +59/-143)
```diff
@@ -6,6 +6,7 @@ use bun_core;
 
 use crate::lexer as js_lexer;
 use crate::p::P;
+use crate::parse::lists::{ListKind, ListStep};
 use bun_ast as js_ast;
 
 use js_ast::op::Level;
@@ -582,46 +583,6 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
         ))
     }
 
-    /// Error recovery at a token that is neither a clause of a `switch` (`code` 1130) nor a
-    /// statement of one (1129). `abortParsingListOrMoveToNextToken`, as far as possible without
-    /// tracking the open parsing contexts: a token that cannot start a statement is skipped, and
-    /// the list ends at any other token. `true`: the list ends here, and the token is not consumed.
-    #[cold]
-    #[inline(never)]
-    fn stray_in_switch(p: &mut Self, code: u32) -> Result<bool> {
-        match p.lexer.token {
-            // `isListTerminator`: the end of the file terminates every list.
-            T::TEndOfFile => return Ok(true),
-            // The word starts a clause, escaped or not.
-            T::TEscapedKeyword if matches!(p.lexer.identifier, b"case" | b"default") => {
-                p.lexer.unescape_keyword();
-                return Ok(false);
-            }
-            _ => {}
-        }
-        let range = p.lexer.range();
-        p.lexer.ts_error(range, code);
-        if matches!(
-            p.lexer.token,
-            // `isListElement`: during error recovery, `;` is not a statement.
-            T::TSemicolon
-                | T::TCloseParen
-                | T::TCloseBracket
-                | T::TComma
-                | T::TColon
-                | T::TEqualsGreaterThan
-                | T::TEquals
-                | T::TDot
-                | T::TQuestion
-                | T::TQuestionDot
-                | T::TDotDotDot
-        ) {
-            p.lexer.next()?;
-            return Ok(false);
-        }
-        Ok(true)
-    }
-
     #[inline(never)]
     fn t_switch(p: &mut Self, _: &mut ParseStatementOptions, loc: bun_ast::Loc) -> Result<Stmt> {
         p.lexer.next()?;
@@ -639,15 +600,22 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
             let mut cases = bun_alloc::ArenaVec::<js_ast::Case>::new_in(p.arena);
             let mut found_default = false;
             let mut said_default = false;
+            // `parseCaseBlock`
+            let saved_clauses = p.enter_list(ListKind::SwitchClauses);
             while p.lexer.token != T::TCloseBrace {
+                match p.classify_list_token(ListKind::SwitchClauses)? {
+                    ListStep::Element => {}
+                    ListStep::Skipped => continue,
+                    ListStep::Over => break,
+                }
                 let mut body = StmtList::new_in(p.arena);
                 // `value`/`stmt_opts` are reinitialized every iteration before any read, so
                 // declare per-iteration.
                 let mut value: Option<js_ast::Expr> = None;
                 let clause_start = p.lexer.loc();
                 let mut clause_loc = clause_start;
                 p.mark_comments_before(&mut clause_loc, clause_start, p.pos_for_jsdoc());
-                if p.lexer.token == T::TDefault {
+                if p.lexer.is_keyword(T::TDefault) {
                     if found_default {
                         if !p.is_tolerant() {
                             p.log().add_range_error(
@@ -658,7 +626,7 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                             return Err(crate::Error::SyntaxError);
                         }
                     }
-                    p.lexer.next()?;
+                    p.lexer.next_token()?;
                     p.lexer.expect(T::TColon)?;
                     // `checkSwitchStatement` reports the second one, once for each `switch`.
                     // `GetErrorRangeForNode`: up to its `:`.
@@ -669,65 +637,34 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                     }
                     found_default = true;
                 } else {
-                    // `parseCaseBlock`
-                    if p.lexer.token != T::TCase && p.is_tolerant() && !p.lexer.is_log_disabled {
-                        if Self::stray_in_switch(p, 1130)? {
-                            break;
-                        }
-                        continue;
-                    }
                     p.lexer.expect(T::TCase)?;
                     value = Some(p.parse_expr(Level::Lowest)?);
                     p.lexer.expect(T::TColon)?;
                 }
 
-                'case_body: loop {
-                    match p.lexer.token {
-                        T::TCloseBrace | T::TCase | T::TDefault => {
-                            break 'case_body;
-                        }
-                        // They terminate the statement list of a clause, escaped or not.
-                        T::TEscapedKeyword
-                            if p.is_tolerant()

```

**File**: `src/js_parser/parse/parse_suffix.rs` (modified, +6/-0)
```diff
@@ -60,6 +60,12 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool, const SEMA: bool>
                     p.forbid_suffix_after_as_loc = p.lexer.loc();
                     return Ok(Continuation::Done);
                 }
+                // `parseBinaryExpressionRest`: no binary operator. The transpiler goes on with a
+                // property access, as esbuild does.
+                T::TDot if SEMA => {
+                    p.forbid_suffix_after_as_loc = p.lexer.loc();
+                    return Ok(Continuation::Done);
+                }
                 _ => {}
             }
 
```

---

### Incident Patch 2: `bbdc5a51` (2026-10-06)
**Commit Message**: `bun check` - a TypeScript type checker builtin to Bun (#44361)

### What does this PR do?

This adds a TypeScript type checker to Bun.

```sh
bun check                        # type check the project
bun --check src/index.ts         # type check, then run
bun build --check src/index.ts   # type check, then bundle
bun test --check                 # type check, then run the tests
```

It's a port of the type checker in
[typescript-go](https://github.com/microsoft/typescript-go) 7.0.2. You
get the same errors as `tsc`, with the same error codes, messages, lines
and columns. If `bun check` and `tsc` 7 disagree about an error, that's
a bug in Bun.

`packages/next` in the Next.js repo, 2,881 files:

| | CPU time | Peak memory |
| --- | --- | --- |
| `tsc` 6.0.2 | 14.8 s | 2.33 GB |
| `tsc` 7.0.2 (typescript-go) | 6.9 s | 1.78 GB |
| `bun check` | 2.4 s | 0.69 GB |

(How that was measured is under Performance.)

It only type checks. It doesn't emit JavaScript, `.d.ts` files,
sourcemaps or `.tsbuildinfo`. There's no language server, so your editor
keeps using TypeScript.

Most of this description is about how we tested it. What's still wrong
is at the bottom.

## Usage

### Check a projec

**File**: `.gitattributes` (modified, +2/-0)
```diff
@@ -57,6 +57,8 @@ test/js/node/test/common linguist-vendored
 
 test/js/bun/css/files linguist-vendored
 
+test/cli/check/typescript-go/bundle.zst binary linguist-vendored linguist-generated
+
 .vscode/*.json linguist-language=JSON-with-Comments
 src/cli/init/tsconfig.default.json linguist-language=JSON-with-Comments
 
```

**File**: `Cargo.lock` (modified, +66/-0)
```diff
@@ -818,6 +818,7 @@ dependencies = [
  "bun_paths",
  "bun_ptr",
  "bun_react_compiler",
+ "bun_sema",
  "bun_url",
  "bun_wyhash",
  "bytemuck",
@@ -1286,6 +1287,8 @@ dependencies = [
  "bun_router",
  "bun_s3_signing",
  "bun_safety",
+ "bun_sema_baselines",
+ "bun_sema_driver",
  "bun_semver",
  "bun_semver_jsc",
  "bun_sha_hmac",
@@ -1347,6 +1350,69 @@ dependencies = [
  "bun_core",
 ]
 
+[[package]]
+name = "bun_sema"
+version = "0.0.0"
+dependencies = [
+ "bitflags",
+ "bstr",
+ "bun_alloc",
+ "bun_collections",
+ "bun_core",
+ "bun_paths",
+ "bun_sema_standalone",
+ "bun_semver",
+ "bun_threading",
+ "bun_wyhash",
+ "hashbrown 0.15.5",
+ "rustc-hash",
+ "smallvec",
+]
+
+[[package]]
+name = "bun_sema_baselines"
+version = "0.0.0"
+dependencies = [
+ "bstr",
+ "bun_core",
+ "bun_paths",
+ "bun_sema",
+ "bun_sema_driver",
+ "bun_sys",
+ "bun_threading",
+]
+
+[[package]]
+name = "bun_sema_driver"
+version = "0.0.0"
+dependencies = [
+ "bstr",
+ "bun_ast",
+ "bun_core",
+ "bun_js_parser",
+ "bun_parsers",
+ "bun_paths",
+ "bun_sema",
+ "bun_sys",
+ "bun_threading",
+]
+
+[[package]]
+name = "bun_sema_standalone"
+version = "0.0.0"
+dependencies = [
+ "bstr",
+ "bun_alloc",
+ "bun_core",
+ "bun_js_parser",
+ "bun_paths",
+ "bun_sema",
+ "bun_sema_baselines",
+ "bun_sema_driver",
+ "bun_threading",
+ "libc",
+]
+
 [[package]]
 name = "bun_semver"
 version = "0.0.0"
```

**File**: `Cargo.toml` (modified, +8/-1)
```diff
@@ -20,6 +20,10 @@ members = [
   "src/paths",
   "src/resolver",
   "src/safety",
+  "src/sema",
+  "src/sema/baselines",
+  "src/sema/driver",
+  "src/sema/standalone",
   "src/semver",
   "src/sourcemap",
   "src/sql",
@@ -185,7 +189,7 @@ warnings = { level = "deny", priority = -1 }
 # (`--cfg=...` + `--check-cfg=cfg(...)`) by scripts/build/rust.ts; register
 # them here so a plain `cargo build` / `cargo check` (without those flags)
 # doesn't warn.
-unexpected_cfgs = { level = "warn", check-cfg = ['cfg(bun_asan)', 'cfg(bun_debug)', 'cfg(socket_fault_injection)'] }
+unexpected_cfgs = { level = "warn", check-cfg = ['cfg(bun_asan)', 'cfg(bun_debug)', 'cfg(socket_fault_injection)', 'cfg(bun_sema_mimalloc)'] }
 # link.exe unconditionally prints "Creating library X.dll.lib and object
 # X.dll.exp" to stdout when linking each proc-macro DLL on Windows hosts;
 # there is no linker flag to suppress it. The lint already exempts itself
@@ -365,6 +369,9 @@ bun_md = { path = "src/md" }
 bun_paths = { path = "src/paths" }
 bun_resolver = { path = "src/resolver" }
 bun_safety = { path = "src/safety" }
+bun_sema = { path = "src/sema" }
+bun_sema_baselines = { path = "src/sema/baselines" }
+bun_sema_driver = { path = "src/sema/driver" }
 bun_semver = { path = "src/semver" }
 bun_sourcemap = { path = "src/sourcemap" }
 bun_sql = { path = "src/sql" }
```

**File**: `LICENSE.md` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@ Bun statically links these libraries:
 | A fork of [`uWebsockets`](https://github.com/jarred-sumner/uwebsockets) | Apache 2.0 licensed |
 | Parts of [Tigerbeetle's IO code](https://github.com/tigerbeetle/tigerbeetle/blob/532c8b70b9142c17e07737ab6d3da68d7500cbca/src/io/windows.zig#L1) | Apache 2.0 licensed |
 | `__cxa_thread_atexit` fallback from [LLVM libc++abi](https://github.com/llvm/llvm-project/blob/llvmorg-19.1.0/libcxxabi/src/cxa_thread_atexit.cpp) | Apache 2.0 with LLVM exception |
+| The type checker behind `bun check` is a port of [`typescript-go`](https://github.com/microsoft/typescript-go), and uses TypeScript's diagnostic messages and `lib.*.d.ts` files | Apache 2.0 |
 
 ## Polyfills
 
```

**File**: `completions/bun.bash` (modified, +4/-1)
```diff
@@ -89,7 +89,7 @@ _bun_completions() {
     declare -A PACKAGE_OPTIONS;
     declare -A PM_OPTIONS;
 
-    local SUBCOMMANDS="dev bun create run install add remove upgrade completions discord help init pm x test repl update audit dedupe prune outdated link unlink build";
+    local SUBCOMMANDS="dev bun create run install add remove upgrade completions discord help init pm x test repl update audit dedupe prune outdated link unlink build check";
 
     GLOBAL_OPTIONS[LONG_OPTIONS]="--use --cwd --bunfile --server-bunfile --config --disable-react-fast-refresh --disable-hmr --env-file --extension-order --jsx-factory --jsx-fragment --extension-order --jsx-factory --jsx-fragment --jsx-import-source --jsx-production --jsx-runtime --main-fields --no-summary --version --platform --public-dir --tsconfig-override --define --external --help --inject --loader --origin --port";
     GLOBAL_OPTIONS[SHORT_OPTIONS]="-c -v -d -e -h -i -l -u -p";
@@ -191,6 +191,9 @@ _bun_completions() {
         audit)
             COMPREPLY=( $(compgen -W "fix ${PACKAGE_OPTIONS[AUDIT_OPTIONS_LONG]} ${PACKAGE_OPTIONS[AUDIT_OPTIONS_SHORT]}" -- "${cur_word}") );
             return;;
+        check)
+            COMPREPLY=( $(compgen -f -W "--project --pretty --no-pretty --all --threads --timing --cwd --help -p -h" -- "${cur_word}") );
+            return;;
         create|c)
             COMPREPLY=( $(compgen -W "--force --no-install --help --no-git --verbose --no-package-json --open next react" -- "${cur_word}") );
             return;;
```

**File**: `completions/bun.fish` (modified, +9/-1)
```diff
@@ -35,7 +35,7 @@ end
 set -l bun_install_boolean_flags yarn production optional development no-save dry-run force no-cache silent verbose global
 set -l bun_install_boolean_flags_descriptions "Write a yarn.lock file (yarn v1)" "Don't install devDependencies" "Add dependency to optionalDependencies" "Add dependency to devDependencies" "Don't update package.json or save a lockfile" "Don't install anything" "Always request the latest versions from the registry & reinstall all dependencies" "Ignore manifest cache entirely" "Don't output anything" "Excessively verbose logging" "Use global folder"
 
-set -l bun_builtin_cmds_without_run dev create help bun upgrade discord install remove add update audit dedupe prune init pm x repl
+set -l bun_builtin_cmds_without_run dev create help bun upgrade discord install remove add update audit dedupe prune init pm x repl check
 set -l bun_builtin_cmds_accepting_flags create help bun upgrade discord run init link unlink pm x update
 
 function __bun_complete_bins_scripts --inherit-variable bun_builtin_cmds_without_run -d "Emit bun completions for bins and scripts"
@@ -211,6 +211,14 @@ complete -c bun -n "__fish_use_subcommand" -a "pm" -d "Additional package manage
 complete -c bun -n "__fish_use_subcommand" -a "x" -d "Execute a package binary, installing if needed" -f
 complete -c bun -n "__fish_use_subcommand" -a "outdated" -d "Display the latest versions of outdated dependencies" -f
 complete -c bun -n "__fish_use_subcommand" -a "audit" -d "Check installed packages for vulnerabilities" -f
+complete -c bun -n "__fish_use_subcommand" -a "check" -d "Type check a TypeScript project" -f
+complete -c bun -n "__fish_seen_subcommand_from check" -s "p" -l "project" -r -F -d "Path to a tsconfig.json or its directory"
+complete -c bun -n "__fish_seen_subcommand_from check" -l "pretty" -d "Show source code around each error"
+complete -c bun -n "__fish_seen_subcommand_from check" -l "no-pretty" -d "One line per error"
+complete -c bun -n "__fish_seen_subcommand_from check" -l "all" -d "Show every error"
+complete -c bun -n "__fish_seen_subcommand_from check" -l "threads" -r -d "Number of threads"
+complete -c bun -n "__fish_seen_subcommand_from check" -l "timing" -d "Print load and check times"
+complete -c bun -n "__fish_seen_subcommand_from check" -l "cwd" -r -d "Set the working directory"
 complete -c bun -n "__fish_use_subcommand" -a "dedupe" -d "Remove duplicate versions from the lockfile" -f
 complete -c bun -n "__fish_use_subcommand" -a "prune" -d "Remove packages that are not in the lockfile from node_modules" -f
 complete -c bun -n "__fish_seen_subcommand_from audit; and not __fish_seen_subcommand_from fix" -a "fix" -d "Upgrade vulnerable packages to the lowest safe version" -f
```

**File**: `completions/bun.zsh` (modified, +26/-0)
```diff
@@ -747,6 +747,23 @@ _bun_prune_completion() {
         ret=0
 }
 
+_bun_check_completion() {
+    _arguments -s -C \
+        '1: :->cmd1' \
+        '*: :_files' \
+        '--project[Path to a tsconfig.json or its directory]:project:_files' \
+        '-p[Path to a tsconfig.json or its directory]:project:_files' \
+        '--pretty[Show source code around each error]' \
+        '--no-pretty[One line per error]' \
+        '--all[Show every error]' \
+        '--threads[Number of threads]:threads' \
+        '--timing[Print load and check times]' \
+        '--cwd[Set the working directory]:cwd:_files -/' \
+        '--help[Print this help menu]' \
+        '-h[Print this help menu]' &&
+        ret=0
+}
+
 _bun_audit_completion() {
     _arguments -s -C \
         '1: :->cmd1' \
@@ -881,6 +898,7 @@ _bun() {
             'remove\:"Remove a dependency from package.json (bun rm)" '
             'update\:"Update outdated dependencies & save to package.json" '
             'audit\:"Check installed packages for vulnerabilities" '
+            'check\:"Type check a TypeScript project" '
             'dedupe\:"Remove duplicate versions from the lockfile" '
             'prune\:"Remove packages that are not in the lockfile from node_modules" '
             'outdated\:"Display the latest versions of outdated dependencies" '
@@ -967,6 +985,10 @@ _bun() {
         audit)
             _bun_audit_completion
 
+            ;;
+        check)
+            _bun_check_completion
+
             ;;
         dedupe)
             _bun_dedupe_completion
@@ -1066,6 +1088,10 @@ _bun() {
                 audit)
                     _bun_audit_completion
 
+                    ;;
+                check)
+                    _bun_check_completion
+
                     ;;
                 dedupe)
                     _bun_dedupe_completion
```

**File**: `docs/bundler/index.mdx` (modified, +34/-1)
```diff
@@ -49,7 +49,10 @@ Bundlers solve several problems:
 - **Framework features.** Frameworks rely on bundler plugins & code transformations to implement common patterns like file-system routing, client-server code co-location (think `getServerSideProps` or Remix loaders), and server components.
 - **Full-stack Applications.** Bun's bundler can handle both server and client code in a single command, enabling optimized production builds and single-file executables. With build-time HTML imports, you can bundle your entire application — frontend assets and backend server — into a single deployable unit.
 
-<Note>The Bun bundler is not intended to replace `tsc` for typechecking or generating type declarations.</Note>
+<Note>
+  `bun build` checks types only when you pass [`--check`](/runtime/check#check-before-you-run-build-or-test), or `check:
+  true` to `Bun.build`. It does not generate type declarations. Use `tsc` to produce `.d.ts` files.
+</Note>
 
 ## Basic example
 
@@ -1284,6 +1287,27 @@ Removes function calls from a bundle. For example, `--drop=console` removes all
   </Tab>
 </Tabs>
 
+### check
+
+Type checks the entry points, and everything they import, before Bun writes any output. A type error fails the build like any other build error. See [`bun check`](/runtime/check#bun-build).
+
+<Tabs>
+  <Tab title="JavaScript">
+    ```ts title="build.ts" icon="/icons/typescript.svg"
+    await Bun.build({
+      entrypoints: ['./index.tsx'],
+      outdir: './out',
+      check: true,
+    })
+    ```
+  </Tab>
+  <Tab title="CLI">
+    ```bash terminal icon="terminal"
+    bun build ./index.tsx --outdir ./out --check
+    ```
+  </Tab>
+</Tabs>
+
 ### features
 
 Enable compile-time feature flags for dead code elimination: conditionally include or exclude code paths at bundle time using `import { feature } from "bun:bundle"`.
@@ -1922,6 +1946,15 @@ interface BuildConfig {
    */
   throw?: boolean;
 
+  /**
+   * Type check the entry points and everything they import before writing any output.
+   * A type error fails the build like any other build error.
+   * Equivalent to `--check` in the CLI.
+   *
+   * @default false
+   */
+  check?: boolean;
+
   /**
    * Custom tsconfig.json file path to use for path resolution.
    * Equivalent to `--tsconfig-override` in the CLI.
```

---

### Incident Patch 3: `13a98b0d` (2026-10-05)
**Commit Message**: spawnSync: stop pointing the VM at the loop it waits on (#44581)

Fixes #34069. Fixes #37968.

- Bun.spawnSync no longer swaps vm.event_loop_handle on POSIX. What a GC finalizes during the call finds the thread's loop; what the call makes for its child names spawnSync's loop through a SpawnSync EventLoopCtx.
- A child nobody is going to wait for is ended and reaped (Process::kill_and_reap, from on_wait_pid and watch_or_reap): Bun.spawn, Bun.spawnSync, bun run --parallel/--filter, install scripts, the shell.
- Bun.spawn reports an unwatched exit before it throws, so onExit no longer takes the pending exception with it.
- What a direct stream's pull() throws is a failure whether or not it is an Error: Bun.write no longer stays pending, Bun.spawn no longer leaves its child.
- spawn_maybe_sync uses RAII types instead of scopeguard.

**File**: `src/event_loop/AnyEventLoop.rs` (modified, +1/-7)
```diff
@@ -313,13 +313,7 @@ impl EventLoopHandle {
     #[inline]
     pub fn as_event_loop_ctx(self) -> bun_io::EventLoopCtx {
         match self {
-            // SAFETY: `owner.bun_vm()` returns the owning `*mut VirtualMachine`,
-            // which is what the `EventLoopCtxKind::Js` `link_impl_EventLoopCtx!`
-            // (in `bun_jsc`) is written for. Both are per-thread singletons
-            // that outlive the ctx.
-            EventLoopHandle::Js { owner } => unsafe {
-                bun_io::EventLoopCtx::new(bun_io::EventLoopCtxKind::Js, owner.bun_vm())
-            },
+            EventLoopHandle::Js { owner } => owner.event_loop_ctx(),
             // `mini` is a `BackRef` to the live per-thread singleton (see
             // `mini_mut` doc) — valid for the ctx's lifetime.
             EventLoopHandle::Mini(mut mini) => {
```

**File**: `src/event_loop/SpawnSyncEventLoop.rs` (modified, +106/-140)
```diff
@@ -9,7 +9,9 @@
 //! Implementation approach:
 //! - Creates a separate uws.Loop instance with its own kqueue/epoll fd (POSIX) or libuv loop (Windows)
 //! - Wraps it in a full jsc.EventLoop instance whose `uws_loop` is the isolated loop
-//! - Temporarily overrides vm.event_loop_handle to point to the isolated loop
+//! - What the call makes for its child is handed that EventLoop, and so counts on the isolated loop
+//! - Nothing else can reach it: a finalizer that runs during the wait finds the thread's own loop
+//!   (Windows still overrides vm.event_loop_handle, where a libuv handle keeps the loop it was made on)
 //! - Minimal handler callbacks (wakeup/pre/post are no-ops)
 //!
 //! Similar to Node.js's approach in vendor/node/src/spawn_sync.cc but adapted for Bun's architecture.
@@ -29,9 +31,6 @@ use bun_uws as uws;
 // MOVE-IN: EventLoopHandle relocated from bun_jsc — see AnyEventLoop.rs.
 use crate::EventLoopHandle;
 
-// On POSIX this is `?*uws.Loop`, on Windows `?*libuv.Loop`.
-#[cfg(unix)]
-pub type VmEventLoopHandle = Option<NonNull<uws::Loop>>;
 #[cfg(windows)]
 pub type VmEventLoopHandle = Option<NonNull<libuv::Loop>>;
 
@@ -51,7 +50,9 @@ unsafe extern "Rust" {
     /// Re-bind `event_loop.{global, virtual_machine}` to `vm` (prepare path).
     safe fn __bun_spawn_sync_event_loop_set_vm(el: *mut (), vm: *mut ());
     safe fn __bun_spawn_sync_event_loop_tick_tasks_only(el: *mut ());
+    #[cfg(windows)]
     safe fn __bun_spawn_sync_vm_get_event_loop_handle(vm: *mut ()) -> VmEventLoopHandle;
+    #[cfg(windows)]
     safe fn __bun_spawn_sync_vm_set_event_loop_handle(vm: *mut (), h: VmEventLoopHandle);
     /// Swap `vm.suppress_microtask_drain`, return previous.
     safe fn __bun_spawn_sync_vm_swap_suppress_microtask_drain(vm: *mut (), v: bool) -> bool;
@@ -82,31 +83,25 @@ impl Drop for SuppressMicrotaskDrain {
     }
 }
 
+/// Shared borrows only once `init` is through: what a tick dispatches finds its way back here while
+/// the tick is still on the stack, so whatever changes is in a `Cell`.
 pub struct SpawnSyncEventLoop {
     /// Separate JSC EventLoop instance for this spawnSync
     /// This is a FULL event loop, not just a handle
     // SAFETY: erased `*mut jsc::EventLoop`, heap-owned via `__bun_spawn_sync_{create,destroy}_event_loop`.
     event_loop: *mut (),
 
     /// Erased `*mut jsc::VirtualMachine` backref (set in `init`/`prepare`).
-    vm: *mut (),
+    vm: Cell<*mut ()>,
 
     /// Completely separate uws.Loop instance - critical for avoiding recursive event loop execution
     // FFI-owned handle created via `uws::Loop::create`, freed in Drop via
     // `Loop::deinit`. Kept as raw because `uws::Loop` is an opaque C type and its address is
     // stored back into `internal_loop_data` (self-referential w.r.t. `event_loop`).
     uws_loop: NonNull<uws::Loop>,
 
-    /// `prepare` overrides the VM's event_loop_handle; the original, restored
-    /// by `cleanup`.
-    original_event_loop_handle: VmEventLoopHandle,
-
     #[cfg(windows)]
-    uv_timer: Option<NonNull<libuv::Timer>>,
-    // ALIASING: `Cell` because on Windows the libuv timer callback (`on_uv_timer`) writes this
-    // field re-entrantly from inside `tick_with_timeout`'s uws tick while that frame still holds
-    // `&mut self` (LLVM `noalias`). The field must be
-    // interior-mutable so the re-entrant write is sound under Stacked Borrows.
+    uv_timer: Cell<Option<NonNull<libuv::Timer>>>,
     did_timeout: Cell<bool>,
 }
 
@@ -157,12 +152,11 @@ impl SpawnSyncEventLoop {
 
         this.write(Self {
             uws_loop: loop_,
-            original_event_loop_handle: None, // overwritten in `prepare`
             #[cfg(windows)]
-            uv_timer: None,
+            uv_timer: Cell::new(None),
             did_timeout: Cell::new(false),
             event_loop,
-            vm,
+            vm: Cell::new(vm),
         });
 
         // Set up the loop's internal data to point to this isolated event loop
@@ -193,61 +187,29 @@ impl SpawnSyncEventLoop {
         self.event_loop
     }
 
-    /// Shared borrow of the isolated `uws::Loop`.
-    ///
-    /// # Safety (invariant)
-    /// `uws_loop` is set in `init` and freed only in `Drop`, so it is valid for
-    /// all of `self`'s lifetime. The loop is only mutated through `&mut self`
-    /// paths (`uws_loop_mut`), so a shared borrow tied to `&self` cannot
-    /// overlap a unique borrow.
+    /// Shared borrow of the isolated `uws::Loop`. Not to be held across a tick, which borrows it uniquely.
     #[inline]
     pub fn uws_loop(&self) -> &uws::Loop {
-        // SAFETY: see doc invariant above — non-null, owned for `self`'s lifetime,
-        // no `&mut` alias while `&self` is held.
+        // SAFETY: set in `init` and freed only in `Drop`.
         unsafe { self.uws_loop.as_ref() }
     }
 
-    /// Unique borrow of the isolated `uws::Loop`.
-    ///
-    /// Re-entrancy hazard: do **NOT** call this between the Windows
-    /// `timer.data = 
```

**File**: `src/event_loop/lib.rs` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ bun_dispatch::link_interface! {
         fn file_polls() -> *mut bun_io::file_poll::Store;
         fn put_file_poll(poll: *mut bun_io::FilePoll, was_ever_registered: bool);
         fn uws_loop() -> *mut bun_uws::Loop;
+        fn event_loop_ctx() -> bun_io::EventLoopCtx;
         fn tick();
         fn auto_tick();
         fn auto_tick_active();
```

**File**: `src/io/lib.rs` (modified, +8/-3)
```diff
@@ -312,7 +312,7 @@ pub type OpaqueCallback = unsafe extern "C" fn(*mut core::ffi::c_void);
 // `uv_loop_t` whereas the impl bodies
 // (`VirtualMachine::uws_loop` / `MiniEventLoop::loop_ptr`) hand back the wrapper.
 bun_dispatch::link_interface! {
-    pub EventLoopCtx[Js, Mini] {
+    pub EventLoopCtx[Js, Mini, SpawnSync] {
         fn platform_event_loop_ptr() -> *mut bun_uws_sys::Loop;
         fn file_polls_ptr() -> *mut Store;
         // `alloc_file_poll() -> *mut FilePoll` was removed — it
@@ -415,10 +415,15 @@ impl EventLoopCtx {
         self.file_polls_mut().get_init(value)
     }
 
+    /// What a `FilePoll` keeps of the ctx it was made with; [`get_vm_ctx`] gives that ctx back.
     #[inline]
     #[cfg(not(windows))]
-    pub(crate) fn is_js(&self) -> bool {
-        self.is(EventLoopCtxKind::Js)
+    pub(crate) fn allocator_type(&self) -> AllocatorType {
+        match self.kind {
+            EventLoopCtxKind::Js => AllocatorType::Js,
+            EventLoopCtxKind::Mini => AllocatorType::Mini,
+            EventLoopCtxKind::SpawnSync => AllocatorType::SpawnSync,
+        }
     }
     #[inline]
     pub fn loop_(&self) -> *mut bun_uws_sys::Loop {
```

**File**: `src/io/posix_event_loop.rs` (modified, +3/-1)
```diff
@@ -280,6 +280,8 @@ pub enum AllocatorType {
     #[default]
     Js,
     Mini,
+    /// The loop `Bun.spawnSync` waits on. Only what that call makes for its own child lives there.
+    SpawnSync,
 }
 
 // `FilePoll`/`Store` here are POSIX-specific (kqueue/epoll registration,
@@ -520,7 +522,7 @@ impl FilePoll {
             flags,
             owner,
             next_to_free: ptr::null_mut(),
-            allocator_type: if vm.is_js() { AllocatorType::Js } else { AllocatorType::Mini },
+            allocator_type: vm.allocator_type(),
             #[cfg(all(target_os = "macos", debug_assertions))]
             // Single-threaded event loop so `Relaxed` ordering is sufficient.
             generation_number: MAX_GENERATION_NUMBER
```

**File**: `src/jsc/event_loop.rs` (modified, +38/-3)
```diff
@@ -694,9 +694,9 @@ impl EventLoop {
     /// ports/channels/sockets on a loop that no longer ticks) so the loop is not
     /// torn down still believing something keeps it alive.
     ///
-    /// Targets `self.native_loop()`, never `vm.event_loop_handle`: `Bun.spawnSync`
-    /// points the latter at its private loop, and a GC inside it still refs
-    /// this loop (FinalizationRegistry, MessagePort).
+    /// Targets `self.native_loop()`, never `vm.event_loop_handle`: on Windows
+    /// `Bun.spawnSync` points the latter at its private loop, and a GC inside it
+    /// still refs this loop (FinalizationRegistry, MessagePort).
     pub(crate) fn apply_concurrent_ref_delta(&self) {
         let delta = self.concurrent_ref.swap(0, Ordering::SeqCst);
         // SAFETY: `native_loop()` is live for this loop's lifetime; JS thread only.
@@ -1153,6 +1153,23 @@ impl EventLoop {
         }
     }
 
+    /// The ctx whose loop is the one this `EventLoop` runs on. Windows has none for a spawnSync loop:
+    /// a libuv handle knows its loop, and the counters stay on the thread's.
+    pub fn event_loop_ctx(&self) -> Async::EventLoopCtx {
+        #[cfg(unix)]
+        if self.isolated_poster.is_some() {
+            // SAFETY: the VM owns the spawnSync loop, which outlives what the call makes on it.
+            return unsafe {
+                Async::EventLoopCtx::new(
+                    Async::EventLoopCtxKind::SpawnSync,
+                    core::ptr::from_ref(self).cast_mut(),
+                )
+            };
+        }
+        // SAFETY: the VM this loop belongs to outlives it.
+        unsafe { VirtualMachine::event_loop_ctx(self.vm()) }
+    }
+
     /// JS thread: the weak poster other threads use to reach the loop this
     /// `EventLoop` is — the VM's handle for its embedded loops, or the isolated
     /// loop's own poster for a spawnSync loop.
@@ -1507,6 +1524,7 @@ bun_event_loop::link_impl_JsEventLoop! {
             (*store).put(core::ptr::NonNull::new_unchecked(poll), ctx, was_ever_registered);
         },
         uws_loop() => (*this).usockets_loop(),
+        event_loop_ctx() => (*this).event_loop_ctx(),
         tick() => (*this).tick(),
         auto_tick() => (*this).auto_tick(),
         auto_tick_active() => (*this).auto_tick_active(),
@@ -1526,6 +1544,21 @@ bun_event_loop::link_impl_JsEventLoop! {
     }
 }
 
+// A spawnSync loop differs from its VM's in the loop alone.
+bun_io::link_impl_EventLoopCtx! {
+    SpawnSync for EventLoop => |this| {
+        platform_event_loop_ptr() => (*this).usockets_loop(),
+        file_polls_ptr() => VirtualMachine::event_loop_ctx((*this).vm()).file_polls_ptr(),
+        // The VM takes what it counts off its own loop, and nothing a spawnSync call makes asks for this.
+        increment_pending_unref_counter() => unreachable!(),
+        after_event_loop_callback() =>
+            VirtualMachine::event_loop_ctx((*this).vm()).after_event_loop_callback(),
+        set_after_event_loop_callback(cb, ctx) =>
+            VirtualMachine::event_loop_ctx((*this).vm()).set_after_event_loop_callback(cb, ctx),
+        pipe_read_scratch() => VirtualMachine::event_loop_ctx((*this).vm()).pipe_read_scratch(),
+    }
+}
+
 #[unsafe(no_mangle)]
 pub(crate) fn __bun_js_event_loop_current() -> *mut () {
     // SAFETY: `VirtualMachine::get()` panics if no VM on this thread;
@@ -1592,13 +1625,15 @@ pub(crate) fn __bun_spawn_sync_event_loop_tick_tasks_only(el: *mut ()) {
     el_ref(el).tick_tasks_only();
 }
 
+#[cfg(windows)]
 #[unsafe(no_mangle)]
 pub(crate) fn __bun_spawn_sync_vm_get_event_loop_handle(
     vm: *mut (),
 ) -> bun_event_loop::SpawnSyncEventLoop::VmEventLoopHandle {
     vm_from_ptr(vm).event_loop_handle.and_then(NonNull::new)
 }
 
+#[cfg(windows)]
 #[unsafe(no_mangle)]
 pub(crate) fn __bun_spawn_sync_vm_set_event_loop_handle(
     vm: *mut (),
```

**File**: `src/jsc/rare_data.rs` (modified, +7/-2)
```diff
@@ -832,11 +832,16 @@ impl RareData {
             .push(CleanupHook::from(global_this, ctx, func));
     }
 
+    /// The loop a first `spawn_sync_event_loop` call made.
+    pub fn existing_spawn_sync_event_loop(&self) -> Option<&SpawnSyncEventLoop> {
+        self.spawn_sync_event_loop_.as_deref()
+    }
+
     /// `None` if the loop cannot be created; nothing is cached, so a later call retries.
     pub fn spawn_sync_event_loop(
         &mut self,
         vm: &mut VirtualMachine,
-    ) -> Option<&mut SpawnSyncEventLoop> {
+    ) -> Option<&SpawnSyncEventLoop> {
         if self.spawn_sync_event_loop_.is_none() {
             // In-place out-param init: `event_loop` inside captures the
             // `self` address, so the value must not move after init; allocate
@@ -851,7 +856,7 @@ impl RareData {
             // SAFETY: `init` fully initialised the slot when it returned `true`.
             self.spawn_sync_event_loop_ = Some(unsafe { boxed.assume_init() });
         }
-        self.spawn_sync_event_loop_.as_deref_mut()
+        self.spawn_sync_event_loop_.as_deref()
     }
 
     // ── watch-mode listen sockets ─────────────────────────────────────────
```

**File**: `src/runtime/api/bun/js_bun_spawn_bindings.rs` (modified, +113/-144)
```diff
@@ -300,6 +300,39 @@ pub(crate) fn spawn_sync(
     result
 }
 
+/// The terminal a spawn made for its child, closed unless the spawn gets far enough to `take` it: the user never
+/// received it then.
+#[derive(Default)]
+struct SpawnedTerminal(Option<terminal_body::CreateResult>);
+
+impl Drop for SpawnedTerminal {
+    fn drop(&mut self) {
+        if let Some(info) = self.0.take() {
+            info.terminal.abandon_from_spawn();
+        }
+    }
+}
+
+/// Reports the exit of a child that could not be watched, once the rest of its `Subprocess` is set up. That runs
+/// `onExit`, so not with an exception pending.
+struct ReportUnwatchedExit(bun_ptr::BackRef<SubprocessT<'static>>);
+
+impl Drop for ReportUnwatchedExit {
+    fn drop(&mut self) {
+        let process = self.0.process_mut();
+        if process.has_exited() {
+            // process has already exited, we called wait4(), but we did not call onProcessExit()
+            let status = process.status.clone();
+            process.on_exit(status, &bun_core::ffi::zeroed::<Rusage>());
+        } else {
+            // It has exited and only wait4() is left to call, or it is running: then it is tried once more to watch
+            // it, and failing that it is ended and reaped.
+            // https://cs.github.com/libuv/libuv/blob/b00d1bd225b602570baee82a6152eaa823a84fa6/src/unix/process.c#L1007
+            process.wait(false);
+        }
+    }
+}
+
 fn spawn_maybe_sync(
     is_sync: bool,
     cx: &bun_jsc::JsThread<'_>,
@@ -369,26 +402,9 @@ fn spawn_maybe_sync(
     #[cfg(windows)]
     let mut windows_verbatim_arguments: bool = false;
     let mut abort_signal: Option<bun_jsc::AbortSignalRef> = None;
-    let mut terminal_info: Option<terminal_body::CreateResult> = None;
+    let mut terminal_info = SpawnedTerminal::default();
     let mut existing_terminal: Option<bun_ptr::BackRef<Terminal, bun_ptr::Mut>> = None; // Existing terminal passed by user
     let mut terminal_js_value: JSValue = JSValue::ZERO;
-    let mut defer_guard = scopeguard::guard(
-        &mut terminal_info,
-        |terminal_info: &mut Option<terminal_body::CreateResult>| {
-            // If we created a new terminal but spawn failed, close it. The
-            // writer/reader/finalize deref paths release the remaining refs.
-            // Downgrade the JSRef so the wrapper is GC-eligible, and mark
-            // finalized so onReaderDone skips the JS exit callback — the user
-            // never received this terminal (spawn threw).
-            if let Some(info) = terminal_info.take() {
-                // `abandon_from_spawn` is the spawn-side error-path teardown
-                // (downgrade JSRef, mark finalized, close_internal).
-                info.terminal.abandon_from_spawn();
-            }
-        },
-    );
-    // Note: reshaped for borrowck — re-borrow through the guard.
-    let terminal_info = &mut **defer_guard;
 
     // Owned ZBox for `cwd` held here so the `&[u8]` borrow stays valid until
     // `spawn_process` returns.
@@ -819,7 +835,7 @@ fn spawn_maybe_sync(
                         let term_options =
                             TerminalOptions::parse_from_js(cx.global(), terminal_val)?;
                         match Terminal::create_from_spawn(cx.global(), &term_options) {
-                            Ok(created) => *terminal_info = Some(created),
+                            Ok(created) => terminal_info.0 = Some(created),
                             Err(err) => {
                                 return Err(match err {
                                     TerminalInitError::OpenPtyFailed => {
@@ -852,7 +868,7 @@ fn spawn_maybe_sync(
                             existing_terminal
                                 .map(|t| t.get_slave_fd())
                                 .unwrap_or_else(|| {
-                                    terminal_info.as_ref().unwrap().terminal.get_slave_fd()
+                                    terminal_info.0.as_ref().unwrap().terminal.get_slave_fd()
                                 });
                         stdio[0] = Stdio::Fd(slave_fd);
                         stdio[1] = Stdio::Fd(slave_fd);
@@ -1019,58 +1035,39 @@ fn spawn_maybe_sync(
     // and to avoid interfering with the main event loop.
     //
     // Note: borrowck — `rare_data()` borrows `jsc_vm` mutably and the
-    // returned `&mut SpawnSyncEventLoop` keeps that borrow alive, so we cannot
-    // also pass `jsc_vm` into `spawn_sync_event_loop`/`prepare`/`cleanup` while
-    // holding it. Route through a raw `*mut VirtualMachineRef` for the duration.
+    // returned `&SpawnSyncEventLoop` keeps that borrow alive for the whole
+    // call. Route through a raw `*mut VirtualMachineRef` instead.
     let jsc_vm_ptr: *mut jsc::VirtualMachineRef = jsc_vm;
-    // For is_sync, use the isolated loop's `event_loop` (created by
-    // `SpawnSyncEventLoop::init`) so stdio readers/writers register on it
-    // instead of the main loop.
-    let e
```

---

### Incident Patch 4: `1878660b` (2026-10-04)
**Commit Message**: Bump WebKit: idle JSC threads and Atomics.wait release their free memory (#44564)

Bumps WebKit to oven-sh/WebKit#768. Nothing else is in the range.

- JSC's worker threads (wasm and JIT compilers, GC helpers) release the free memory of their mimalloc heap after 100 ms idle instead of when they exit after 10 s. Fixes #41438.
- A thread that blocks in Atomics.wait for over 100 ms does the same. It used to keep everything it had freed for the whole wait.

The wasm test is from #41449.

**File**: `scripts/build/deps/webkit.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
  * for local mode. Override via `--webkit-version=<hash>` to test a branch.
  * From https://github.com/oven-sh/WebKit releases.
  */
-export const WEBKIT_VERSION = "1600131e46b5af48bbda3559af8d8a3327230b6e";
+export const WEBKIT_VERSION = "5718a6ec579b98362ea7276a426deedcc6281ef5";
 
 /**
  * WebKit (JavaScriptCore) — the JS engine.
```

**File**: `test/js/bun/wasm/compile-rss-fixture.mjs` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+// Fixture for compile-rss.test.ts. Compiles a generated wasm module 6 times, discards each result,
+// then polls RSS until it falls below the target (argv[2], MiB) or the deadline passes. The idle
+// compiler threads exit after 10 s and release everything then, so the deadline stays well below
+// that. Prints one JSON line with the lowest RSS growth seen, relative to the RSS before the first
+// compile.
+
+class Bytes {
+  constructor() {
+    this.buf = new Uint8Array(1 << 20);
+    this.len = 0;
+  }
+  push(...bytes) {
+    for (const b of bytes) this.byte(b);
+  }
+  byte(b) {
+    if (this.len === this.buf.length) {
+      const next = new Uint8Array(this.buf.length * 2);
+      next.set(this.buf);
+      this.buf = next;
+    }
+    this.buf[this.len++] = b;
+  }
+  leb(n) {
+    do {
+      let b = n & 0x7f;
+      n >>>= 7;
+      if (n !== 0) b |= 0x80;
+      this.byte(b);
+    } while (n !== 0);
+  }
+  append(other) {
+    for (let i = 0; i < other.len; i++) this.byte(other.buf[i]);
+  }
+  section(id, payload) {
+    this.byte(id);
+    this.leb(payload.len);
+    this.append(payload);
+  }
+  bytes() {
+    return this.buf.subarray(0, this.len);
+  }
+}
+
+// A module shaped like a tree-sitter parser: a few dozen functions of 20 to 30 KB of control-flow
+// heavy code, plus one giant function. Compiling it makes each wasm compiler thread allocate and
+// free tens of MB of temporaries. Uniform modules of many small functions do not show the
+// retention: their pages end up fully free and mimalloc's scavenger purges them on its own.
+function makeModule({ functionCount = 35, opsPerFunction = 1400, giantOps = 30000 } = {}) {
+  const out = new Bytes();
+  out.push(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);
+
+  // type 0: (i32, i32) -> i32
+  const types = new Bytes();
+  types.push(1, 0x60, 2, 0x7f, 0x7f, 1, 0x7f);
+  out.section(1, types);
+
+  const funcs = new Bytes();
+  funcs.leb(functionCount);
+  for (let f = 0; f < functionCount; f++) funcs.byte(0);
+  out.section(3, funcs);
+
+  const exports = new Bytes();
+  exports.push(1, 1, 0x66, 0x00, 0); // export "f" = func 0
+  out.section(7, exports);
+
+  const code = new Bytes();
+  code.leb(functionCount);
+  for (let f = 0; f < functionCount; f++) {
+    const ops = f === 0 ? giantOps : opsPerFunction + ((f * 7919) % 400);
+    const body = new Bytes();
+    body.push(1, 1, 0x7f); // one local group: 1 x i32
+    body.push(0x20, 0); // local.get 0
+    for (let i = 0; i < ops; i++) {
+      // block
+      //   local.get 1; i32.const k; i32.add; local.tee 2
+      //   br_table {0,0,0,0} 0
+      //   local.get 2; local.get 0; call g; drop
+      // end
+      // local.get 2; i32.xor
+      body.push(0x02, 0x40, 0x20, 1, 0x41);
+      body.leb((f * 31 + i * 7) & 0x3f);
+      body.push(0x6a, 0x22, 2, 0x0e, 4, 0, 0, 0, 0, 0, 0x20, 2, 0x20, 0, 0x10);
+      body.leb((f + 1) % functionCount);
+      body.push(0x1a, 0x0b, 0x20, 2, 0x73);
+    }
+    body.byte(0x0b); // end
+    code.leb(body.len);
+    code.append(body);
+  }
+  out.section(10, code);
+  return out.bytes();
+}
+
+const targetMiB = Number(process.argv[2]);
+if (!Number.isFinite(targetMiB)) throw new Error(`expected the target in MiB as argv[2], got ${process.argv[2]}`);
+// On Darwin mimalloc returns memory with MADV_FREE_REUSABLE, which the kernel keeps counted in RSS
+// until it reuses the pages. phys_footprint drops at once, so measure that there. memoryFootprint()
+// returns undefined when task_info fails, so fall back to RSS.
+const rss = () =>
+  (process.platform === "darwin" ? Bun.unsafe.memoryFootprint?.() : undefined) ?? process.memoryUsage.rss();
+const sleep = ms => new Promise(r => setTimeout(r, ms));
+const bytes = makeModule();
+
+// Building the module leaves garbage behind. Wait until RSS stops falling before taking the
+// baseline: mimalloc hands freed memory back on its own schedule, and there is no signal for it.
+let base = Infinity;
+const baseDeadline = performance.now() + 2000;
+do {
+  Bun.gc(true);
+  await sleep(50);
+  const now = rss();
+  if (now >= base - 1048576) break;
+  base = now;
+} while (performance.now() < baseDeadline);
+// Each compile adds to what the unfixed threads keep (8 threads: 18 to 27 MiB after 3 compiles,
+// 35 to 39 MiB after 6) and costs about 20 ms. The fixed build returns to the baseline either way.
+for (let i = 0; i < 6; i++) {
+  let mod = await WebAssembly.compile(bytes);
+  mod = null;
+}
+// Read before anything is freed: the test checks that the compiles grew RSS at all.
+const peak = rss() - base;
+// Free the modules. The main thread frees their metadata into the compiler threads' pages, and only
+// those threads can hand that memory back. They do so once they have worked and gone idle again, so
+// give each of them one trivial function to compile after the modules are gone.
+Bun.gc(true);
+await WebAssembly.compile(makeModule({ functionCount: 16, opsPerFunction: 1, giantOps: 
```

**File**: `test/js/bun/wasm/compile-rss.test.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { expect, test } from "bun:test";
+import { bunEnv, bunExe, isASAN, isDebug } from "harness";
+import path from "node:path";
+
+// Unfixed, the 8 idle wasm compiler threads keep 35 to 39 MiB of freed compile temporaries until
+// they exit after 10 s. Fixed, they release it about 100 ms after the last compile and RSS returns
+// to where it started.
+const idleTargetMiB = 10;
+
+// Debug and ASAN builds link a JavaScriptCore that does not allocate through mimalloc, so the
+// per-thread retention this test checks for does not exist there.
+test.skipIf(isDebug || isASAN)(
+  "WebAssembly.compile does not retain memory in idle compiler threads (#41438)",
+  async () => {
+    await using proc = Bun.spawn({
+      cmd: [bunExe(), path.join(import.meta.dir, "compile-rss-fixture.mjs"), String(idleTargetMiB)],
+      env: {
+        ...bunEnv,
+        // The retained amount scales with the compiler thread count. Pin it so the test does not
+        // depend on the core count of the machine.
+        BUN_JSC_numberOfWasmCompilerThreads: "8",
+      },
+      stdout: "pipe",
+      stderr: "pipe",
+    });
+    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+    expect(stderr).toBe("");
+    const result = JSON.parse(stdout.trim().split("\n").at(-1)!);
+    // The whole measurement is in the object so a failure prints it. The compiles have to grow RSS
+    // well past the target first, or the idle check means nothing.
+    expect({
+      ...result,
+      grew: result.peakDeltaMiB > idleTargetMiB * 2,
+      released: result.idleDeltaMiB < idleTargetMiB,
+    }).toMatchObject({ grew: true, released: true });
+    expect(exitCode).toBe(0);
+  },
+);
```

**File**: `test/js/web/atomics.test.ts` (modified, +116/-0)
```diff
@@ -1,4 +1,5 @@
 import { describe, expect, test } from "bun:test";
+import { bunEnv, bunExe, isASAN } from "harness";
 
 describe("Atomics", () => {
   describe("basic operations", () => {
@@ -307,3 +308,118 @@ describe("Atomics", () => {
     });
   });
 });
+
+// Free blocks inside pages that are still in use belong to the thread that owns the pages. They go back to the OS
+// when that thread tells mimalloc that it is idle, which a wait that takes a while does.
+test.skipIf(isASAN /* malloc is not mimalloc */)(
+  "Atomics.wait lets mimalloc release this thread's free memory",
+  async () => {
+    await using proc = Bun.spawn({
+      cmd: [
+        bunExe(),
+        "-e",
+        `
+      const { heapStats } = require("bun:jsc");
+      const purgeCalls = () => heapStats().mimalloc.purge_calls;
+      const spin = ms => { const start = performance.now(); while (performance.now() - start < ms); };
+
+      // the characters of these strings are allocated and freed by this thread
+      let strings = [];
+      for (let i = 0; i < 100000; i++) strings.push(Buffer.alloc(900 + (i % 5) * 8, 97).toString("latin1"));
+      // (far enough apart that whole OS pages are free in between, also where those are 16 KB)
+      strings = strings.filter((_, i) => i % 64 === 0);
+      Bun.gc(true);
+
+      // what needs no idle thread settles first, without going idle
+      let before = purgeCalls();
+      for (let stable = 0, tries = 0; stable < 3 && tries < 50; tries++) {
+        spin(60);
+        const now = purgeCalls();
+        stable = now === before ? stable + 1 : 0;
+        before = now;
+      }
+
+      const view = new Int32Array(new SharedArrayBuffer(4));
+      let released = 0;
+      for (let i = 0; i < 10 && released < 500; i++) {
+        if (Atomics.wait(view, 0, 0, 250) !== "timed-out") throw new Error("unexpected result");
+        released = purgeCalls() - before;
+      }
+      console.log(released >= 500, strings.length);
+      `,
+      ],
+      env: bunEnv,
+      stderr: "pipe",
+    });
+    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+    expect({ stdout, stderr, exitCode }).toEqual({ stdout: "true 1563\n", stderr: "", exitCode: 0 });
+  },
+);
+
+// 100 ms into a wait the waiter drops the lock of the waiter list to release its memory, and takes it again.
+test.skipIf(isASAN /* malloc is not mimalloc */)(
+  "a notify that arrives while Atomics.wait releases this thread's free memory is not lost",
+  async () => {
+    await using proc = Bun.spawn({
+      cmd: [
+        bunExe(),
+        "-e",
+        `
+      const view = new Int32Array(new SharedArrayBuffer(16));
+      const [VALUE, WAITING, LAST] = [0, 1, 2];
+      const worker = new Worker(
+        URL.createObjectURL(
+          new Blob(
+            [
+              \`
+              self.onmessage = event => {
+                const view = new Int32Array(event.data);
+                const results = [];
+                for (;;) {
+                  // Free memory in between what is in use, so that the release has something to do and takes a while.
+                  let strings = [];
+                  for (let i = 0; i < 100000; i++) strings.push(Buffer.alloc(900 + (i % 5) * 8, 97).toString("latin1"));
+                  strings = strings.filter((_, i) => i % 64 === 0);
+                  Bun.gc(true);
+                  Atomics.store(view, 1, 1);
+                  // A waiter that misses its notification is off the list already: it sleeps for the whole
+                  // timeout and then still answers "ok".
+                  const start = performance.now();
+                  const result = Atomics.wait(view, 0, 0, 10000);
+                  results.push(performance.now() - start > 5000 ? "late" : result);
+                  Atomics.store(view, 0, 0);
+                  if (Atomics.load(view, 2)) return postMessage(results);
+                }
+              };
+              \`,
+            ],
+            { type: "application/javascript" },
+          ),
+        ),
+      );
+      worker.postMessage(view.buffer);
+      const results = new Promise(resolve => (worker.onmessage = event => resolve(event.data)));
+      const delays = [];
+      for (let delay = 100; delay <= 107; delay += 1) delays.push(delay);
+      for (const delay of delays) {
+        while (Atomics.load(view, WAITING) !== 1);
+        Atomics.store(view, WAITING, 0);
+        const start = performance.now();
+        while (performance.now() - start < delay);
+        if (delay === delays.at(-1)) Atomics.store(view, LAST, 1);
+        Atomics.store(view, VALUE, 1);
+        Atomics.notify(view, VALUE);
+      }
+      // ("not-equal" if the worker was held up for that long before it got to wait)
+      console.log(JSON.stringify((await results).filter(result => result !== "ok" && result !== "not-equal")), delays.length);
+      process.exit(0);
+      `,
+      ],
+ 
```

---

### Incident Patch 5: `b73ae471` (2026-10-04)
**Commit Message**: Bump mimalloc: faster heaps, less purge churn; release memory during Bun.sleepSync (#44560)

Bumps mimalloc to oven-sh/mimalloc#59.

- mi_heap_new + mi_heap_destroy (every MimallocArena) is about 7x cheaper with one allocation and 13x cheaper when unused, and no longer slows down when several threads create heaps at once.
- Purging stops doing work that is undone right away: an allocation takes resident memory before purged memory, purge_delay is a minimum age while threads are busy, and a park no longer wakes the scavenger every time.
- Memory that other threads free into the pages of a thread that stays blocked is given back after 30 s instead of when that thread wakes up.
- The event loop only hands its heaps to the scavenger on a poll that can block.
- Bun.sleepSync hands them over as well, so what the thread freed does not stay resident for the whole sleep.

**File**: `packages/bun-usockets/src/eventing/epoll_kqueue.c` (modified, +4/-3)
```diff
@@ -514,9 +514,10 @@ void us_loop_run_bun_tick(struct us_loop_t *loop, const struct timespec* timeout
     /* The scavenger sweeps our heaps while we are in the kernel. Must come after
      * Bun__JSC_onBeforeWait, which allocates: nothing may touch our heaps until the matching
      * _end. mimalloc paces the sweep itself, so this costs a compare-and-swap per tick.
-     * With no scavenger to hand off to, fall back to sweeping inline -- but only on a tick that
-     * really parks, and rate-limited, because doing it between ticks is what we are avoiding. */
-    const int handed_off = mi_on_thread_idle_start();
+     * Only on a tick that really parks: there is no time to sweep in a poll that returns at once.
+     * With no scavenger to hand off to, fall back to sweeping inline, rate-limited, because doing
+     * it between ticks is what we are avoiding. */
+    const int handed_off = will_idle_inside_event_loop && mi_on_thread_idle_start();
     if (!handed_off && will_idle_inside_event_loop) {
         static const uint64_t idle_sweep_interval_ns = 100 * 1000000ULL;
         static _Thread_local uint64_t last_idle_sweep_ns = 0;
```

**File**: `scripts/build/deps/mimalloc.ts` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 import type { Dependency, DirectBuild } from "../source.ts";
 
-const MIMALLOC_COMMIT = "eab09015a5850ae18fc43ccfaa5bbe8272992314";
+const MIMALLOC_COMMIT = "7a828c116d96bb9a66f6c2e3417c739cbbfdb23c";
 
 export const mimalloc: Dependency = {
   name: "mimalloc",
```

**File**: `src/runtime/api/BunObject.rs` (modified, +6/-0)
```diff
@@ -1025,9 +1025,15 @@ fn sleep_sync(global_object: &JSGlobalObject, callframe: &CallFrame) -> JsResult
         )));
     }
 
+    // mimalloc's scavenger sweeps this thread's heaps while it sleeps, as it does across the event loop's poll.
+    // SAFETY: nothing allocates or frees on this thread until `mi_on_thread_idle_end` below.
+    let handed_off = unsafe { bun_alloc::mimalloc::mi_on_thread_idle_start() };
     std::thread::sleep(core::time::Duration::from_millis(
         u64::try_from(milliseconds).expect("int cast"),
     ));
+    if handed_off {
+        bun_alloc::mimalloc::mi_on_thread_idle_end();
+    }
     Ok(JSValue::UNDEFINED)
 }
 
```

**File**: `test/js/bun/util/sleepSync.test.ts` (modified, +47/-0)
```diff
@@ -1,5 +1,6 @@
 import { sleepSync } from "bun";
 import { expect, it } from "bun:test";
+import { bunEnv, bunExe, isASAN } from "harness";
 
 it("sleepSync uses milliseconds", async () => {
   const start = performance.now();
@@ -28,3 +29,49 @@ it("sleepSync with negative number throws", async () => {
 it("can map with sleepSync", async () => {
   [1, 2, 3].map(sleepSync);
 });
+
+// Free blocks inside pages that are still in use belong to the thread that owns the pages. They go back to the OS
+// when that thread tells mimalloc that it is about to block.
+it.skipIf(isASAN /* malloc is not mimalloc */)(
+  "sleepSync lets mimalloc release this thread's free memory",
+  async () => {
+    await using proc = Bun.spawn({
+      cmd: [
+        bunExe(),
+        "-e",
+        `
+      const { heapStats } = require("bun:jsc");
+      const purgeCalls = () => heapStats().mimalloc.purge_calls;
+      const spin = ms => { const start = performance.now(); while (performance.now() - start < ms); };
+
+      // the characters of these strings are allocated and freed by this thread
+      let strings = [];
+      for (let i = 0; i < 100000; i++) strings.push(Buffer.alloc(900 + (i % 5) * 8, 97).toString("latin1"));
+      // (far enough apart that whole OS pages are free in between, also where those are 16 KB)
+      strings = strings.filter((_, i) => i % 64 === 0);
+      Bun.gc(true);
+
+      // what needs no idle thread settles first, without going idle
+      let before = purgeCalls();
+      for (let stable = 0, tries = 0; stable < 3 && tries < 50; tries++) {
+        spin(60);
+        const now = purgeCalls();
+        stable = now === before ? stable + 1 : 0;
+        before = now;
+      }
+
+      let released = 0;
+      for (let i = 0; i < 20 && released < 500; i++) {
+        Bun.sleepSync(100);
+        released = purgeCalls() - before;
+      }
+      console.log(released >= 500, strings.length);
+      `,
+      ],
+      env: bunEnv,
+      stderr: "pipe",
+    });
+    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+    expect({ stdout, stderr, exitCode }).toEqual({ stdout: "true 1563\n", stderr: "", exitCode: 0 });
+  },
+);
```

**File**: `test/js/web/timers/timer-gc-roots.test.ts` (modified, +3/-0)
```diff
@@ -133,6 +133,9 @@ describe.concurrent("AbortSignal.timeout is released when its wrapper is collect
           await new Promise(r => setTimeout(r, 10));
         }
       }
+      // RSS still climbs to its plateau in the first rounds
+      await round();
+      await round();
       await round();
       const before = process.memoryUsage().rss;
       await round();
```

---

### Incident Patch 6: `8f6a13a7` (2026-10-03)
**Commit Message**: bundler: fix a segfault in `bun build --sourcemap` when the link step fails (#44502)

### What does this PR do?

`bun build` with source maps on sometimes crashes when the build fails
in the link step. It should print the error and exit with code 1.

```js
// a.js
import { b } from "./b.js";
console.log(b, require("./b.js"));

// b.js
export const b = await 0;
```

```
$ bun build --sourcemap=inline a.js
panic(main thread): Segmentation fault at address 0x18
```

Expected, and what the other runs print:

```
error: This require call is not allowed because the transitive dependency "b.js" contains a top-level await
```

The crash is not tied to top-level await. `import { nope } from
"./b.js"` (`No matching export`) crashes the same way. It needs
`--sourcemap`; without it there were 0 crashes in 40 runs.

#### Cause

1. `LinkerContext::link` calls `compute_data_for_source_map`, which puts
two tasks per reachable file on the worker pool. The only waits for them
are in `generate_chunks_in_parallel`.
2. Every `?` and `return Err` in `link` after that point returns with
the tasks still on the pool. The quickest is `return
Err(ImportResolutionFailed)` in step 4 of `scan_imports_and_export

**File**: `src/bundler/BundleThread.rs` (modified, +1/-1)
```diff
@@ -298,7 +298,7 @@ impl<C: CompletionStruct> BundleThread<C> {
         // Straight-line teardown: log copy
         // runs on both paths; `completeOnBundleThread` only on success (the error
         // path's `set_result(Err)` + complete happens in `thread_main`). The
-        // `deinitWithoutFreeingArena` + wait-group drain live inside `init_and_run`
+        // `deinit_without_freeing_arena` call lives inside `init_and_run`
         // (it owns `this`).
         let mut out_log = bun_ast::Log::init();
         // SAFETY: `transpiler.log` is the arena-allocated `*mut Log` set up by
```

**File**: `src/bundler/LinkerContext.rs` (modified, +3/-3)
```diff
@@ -111,7 +111,7 @@ pub struct LinkerContext<'a> {
     /// string buffer containing prefix for each unique keys
     pub(crate) unique_key_prefix: Box<[u8]>,
 
-    pub source_maps: SourceMapData,
+    pub(crate) source_maps: SourceMapData,
 
     /// This will eventually be used for reference-counting LinkerContext
     /// to know whether or not we can free it safely.
@@ -1516,10 +1516,10 @@ pub enum LinkerOptionsMode {
 
 #[derive(Default)]
 pub struct SourceMapData {
-    pub line_offset_wait_group: WaitGroup,
+    pub(crate) line_offset_wait_group: WaitGroup,
     pub(crate) line_offset_tasks: Box<[SourceMapDataTask]>,
 
-    pub quoted_contents_wait_group: WaitGroup,
+    pub(crate) quoted_contents_wait_group: WaitGroup,
     pub(crate) quoted_contents_tasks: Box<[SourceMapDataTask]>,
 }
 
```

**File**: `src/bundler/ThreadPool.rs` (modified, +4/-0)
```diff
@@ -436,6 +436,10 @@ impl ThreadPool {
         // SAFETY: `worker` is freshly heap-allocated and exclusive on this
         // thread until published via the map (already inserted above, but no
         // other thread looks it up under a different `id`).
+        // `deinit_without_freeing_arena` reads every entry, so it must not run
+        // while a task is in here. It waits for the source map tasks itself. Its
+        // callers `wait_for_parse` first, except when `enqueue_entry_points_*`
+        // returns an error, which only a failed allocation makes it do.
         unsafe {
             worker.write(Worker {
                 // Placeholder — overwritten by `init()` immediately below.
```

**File**: `src/bundler/bundle_v2.rs` (modified, +7/-1)
```diff
@@ -5418,8 +5418,14 @@ pub mod bv2_impl {
         }
 
         pub fn deinit_without_freeing_arena(&mut self) {
+            // A build that stops between `compute_data_for_source_map` and the waits in
+            // `generate_chunks_in_parallel` gets here with those tasks still on the pool,
+            // creating `Worker`s and reading `graph`.
+            self.linker.source_maps.line_offset_wait_group.wait();
+            self.linker.source_maps.quoted_contents_wait_group.wait();
+
             {
-                // We do this first to make it harder for any dangling pointers to data to be used in there.
+                // We do this before the rest to make it harder for any dangling pointers to data to be used in there.
                 let on_parse_finalizers = core::mem::take(&mut self.finalizers);
                 for finalizer in &on_parse_finalizers {
                     finalizer.call();
```

**File**: `src/runtime/api/js_bundle_completion_task.rs` (modified, +7/-17)
```diff
@@ -1340,23 +1340,13 @@ impl CompletionStruct for JSBundleCompletionTask {
             .map(|b| &**b)
             .collect();
 
-        let run = bv2.run_from_js_in_new_thread(&entry_points);
-
-        // The AST-allocator pop lives in `generate_in_new_thread`; the
-        // source-map wait-group waits run only on the error path.
-        match run {
-            Ok(build) => {
-                self.set_result(BundleV2Result::Value(build));
-                bv2.deinit_without_freeing_arena();
-                Ok(())
-            }
-            Err(err) => {
-                bv2.linker.source_maps.line_offset_wait_group.wait();
-                bv2.linker.source_maps.quoted_contents_wait_group.wait();
-                bv2.deinit_without_freeing_arena();
-                Err(err)
-            }
-        }
+        let run = bv2
+            .run_from_js_in_new_thread(&entry_points)
+            .map(|build| self.set_result(BundleV2Result::Value(build)));
+
+        // The AST-allocator pop lives in `generate_in_new_thread`.
+        bv2.deinit_without_freeing_arena();
+        run
     }
 }
 
```

**File**: `test/bundler/esbuild/default.test.ts` (modified, +67/-2)
```diff
@@ -1,6 +1,6 @@
 import assert from "assert";
-import { describe, expect } from "bun:test";
-import { osSlashes } from "harness";
+import { describe, expect, test } from "bun:test";
+import { bunEnv, bunExe, osSlashes, tempDir } from "harness";
 import path from "path";
 import { dedent, ESBUILD_PATH, itBundled } from "../expectBundled";
 
@@ -3603,6 +3603,71 @@ describe.concurrent("bundler", () => {
       ],
     },
   });
+  const forbiddenRequireWithNamedImport = {
+    "a.js": `
+      import { b } from "./b.js";
+      console.log(b, require("./b.js"));
+    `,
+    "b.js": `export const b = await 0;`,
+  };
+  test("default/TopLevelAwaitForbiddenRequireSourceMapCLI", async () => {
+    using dir = tempDir("tla-forbidden-require-sourcemap", forbiddenRequireWithNamedImport);
+    const build = async () => {
+      await using proc = Bun.spawn({
+        cmd: [bunExe(), "build", "--sourcemap=inline", "a.js"],
+        env: bunEnv,
+        cwd: String(dir),
+        stdout: "ignore",
+        stderr: "pipe",
+      });
+      const [stderr, exitCode] = await Promise.all([proc.stderr.text(), proc.exited]);
+      return { error: stderr.match(/^error: .*$/m)?.[0], exitCode };
+    };
+    // The link error races the source map tasks: one build alone does not always show it,
+    // and many builds at once show it less often.
+    const builds: Awaited<ReturnType<typeof build>>[] = [];
+    for (let round = 0; round < 10; round++) {
+      builds.push(...(await Promise.all([build(), build(), build(), build()])));
+    }
+    expect(builds).toEqual(
+      Array(40).fill({
+        error:
+          'error: This require call is not allowed because the transitive dependency "b.js" contains a top-level await',
+        exitCode: 1,
+      }),
+    );
+  });
+  test("default/TopLevelAwaitForbiddenRequireSourceMapAPI", async () => {
+    using dir = tempDir("tla-forbidden-require-sourcemap-api", {
+      ...forbiddenRequireWithNamedImport,
+      "build.js": `
+        const messages = [];
+        for (let i = 0; i < 40; i++) {
+          const { logs } = await Bun.build({ entrypoints: ["./a.js"], sourcemap: "inline", throw: false });
+          messages.push(logs[0].message);
+        }
+        console.log(JSON.stringify(messages));
+      `,
+    });
+    await using proc = Bun.spawn({
+      cmd: [bunExe(), "build.js"],
+      env: bunEnv,
+      cwd: String(dir),
+      stdout: "pipe",
+      stderr: "pipe",
+    });
+    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+    expect({ stdout, stderr }).toEqual({
+      stdout:
+        JSON.stringify(
+          Array(40).fill(
+            'This require call is not allowed because the transitive dependency "b.js" contains a top-level await',
+          ),
+        ) + "\n",
+      stderr: "",
+    });
+    expect(exitCode).toBe(0);
+  });
   itBundled("default/TopLevelAwaitAllowedImportWithoutSplitting", {
     files: {
       "/entry.js": /* js */ `
```

---

### Incident Patch 7: `272ff435` (2026-10-03)
**Commit Message**: Resolve a module specifier once: fix a segfault in require() of an ES module, and require() with a plugin's namespace (#44473)

### What does this PR do?

A module specifier is resolved once. It was resolved up to three times,
each time from the answer before, which is harmless only when the answer
about an answer is the same answer. With a symlink, a path from
`Module._resolveFilename` or a plugin's `onResolve`, it is not.

**A segfault**

```js
// esm.mjs:  export const who = "esm";
// main.cjs:
const Module = require("node:module");
Module._resolveFilename = () => __dirname + "/./esm.mjs";   // or a symlink, "//", "/sub/../", "./esm.mjs"
console.log(require("anything").who);
```

```
panic(main thread): Segmentation fault at address 0x18
```

**An ordinary plugin that `require()` cannot use**

```js
build.onResolve({ filter: /\.virtual$/ }, ({ path }) => ({ path: "from " + basename(path), namespace: "virtual" }));
build.onLoad({ filter: /.*/, namespace: "virtual" }, ({ path }) => ({ contents: "export const from = " + JSON.stringify(path), loader: "js" }));
```

```js
require("./x.virtual");   // error: Cannot find package 'virtual:from x.virtual'
import "./x.virtual";     // wor

**File**: `docs/bundler/plugins.mdx` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ await Bun.build({
 
 `onLoad` and `onResolve` accept an optional `namespace` string.
 
-Every module has a namespace. Namespaces prefix the import in transpiled code; for example, a loader with a `filter: /\.yaml$/` and `namespace: "yaml:"` transforms an import from `./myfile.yaml` into `yaml:./myfile.yaml`.
+Every module has a namespace, which prefixes its path. For instance, when `onResolve` returns `{ path: "./myfile.yaml", namespace: "yaml" }`, the module is `yaml:./myfile.yaml`.
 
 The default namespace is `"file"` and you don't need to specify it: `import myModule from "./my-module.ts"` is the same as `import myModule from "file:./my-module.ts"`.
 
```

**File**: `docs/runtime/plugins.mdx` (modified, +3/-1)
```diff
@@ -87,7 +87,7 @@ await Bun.build({
 
 ### Namespaces
 
-`onLoad` and `onResolve` accept an optional `namespace` string. Every module has a namespace, which prefixes the import in transpiled code. For instance, a loader with a `filter: /\.yaml$/` and `namespace: "yaml:"` transforms an import from `./myfile.yaml` into `yaml:./myfile.yaml`.
+`onLoad` and `onResolve` accept an optional `namespace` string. Every module has a namespace, which prefixes its path. For instance, when `onResolve` returns `{ path: "./myfile.yaml", namespace: "yaml" }`, the module is `yaml:./myfile.yaml`.
 
 The default namespace is `"file"` and you don't need to specify it: `import myModule from "./my-module.ts"` is the same as `import myModule from "file:./my-module.ts"`.
 
@@ -177,6 +177,8 @@ The second argument to `onResolve()` is a callback that runs for each module imp
 
 The callback receives the _path_ to the matching module and can return a _new path_ for it. Bun reads the contents of the _new path_ and parses it as a module.
 
+At runtime, the callback runs once for each `import` or `require()` as it executes. A _new path_ without a `namespace` is resolved from the importing module like any other import, without running `onResolve()` callbacks on it: it can be relative, leave out its extension, or name a package. If nothing is found there, the _new path_ is used as it is when an [`onLoad()`](#onload) callback matches it, so it does not have to exist on disk.
+
 For example, redirecting all imports to `images/` to `./public/images/`:
 
 ```ts index.ts icon="/icons/typescript.svg"
```

**File**: `packages/bun-types/bun.d.ts` (modified, +5/-0)
```diff
@@ -6389,6 +6389,11 @@ declare module "bun" {
   interface OnResolveResult {
     /**
      * The destination of the import
+     *
+     * In a runtime plugin, a path without a `namespace` is resolved from the
+     * importing module like any other import, without running `onResolve`
+     * callbacks on it. If nothing is found there, it is used as it is when an
+     * `onLoad` callback matches it.
      */
     path: string;
     /**
```

**File**: `src/ast/import_record.rs` (modified, +7/-13)
```diff
@@ -80,39 +80,33 @@ bitflags::bitflags! {
         /// If true, this import can be removed if it's unused
         const IS_EXTERNAL_WITHOUT_SIDE_EFFECTS = 1 << 11;
 
-        /// Tell the printer to print the record as "foo:my-path" instead of "path"
-        /// where "foo" is the namespace
-        ///
-        /// Used to prevent running resolve plugins multiple times for the same path
-        const PRINT_NAMESPACE_IN_PATH = 1 << 12;
-
-        const WRAP_WITH_TO_ESM = 1 << 13;
-        const WRAP_WITH_TO_COMMONJS = 1 << 14;
+        const WRAP_WITH_TO_ESM = 1 << 12;
+        const WRAP_WITH_TO_COMMONJS = 1 << 13;
 
         /// "import defer * as ns from 'path'" — defer evaluation of the
         /// imported module until a property on the namespace object is
         /// accessed. Requires `CONTAINS_IMPORT_STAR`.
-        const PHASE_DEFER = 1 << 15;
+        const PHASE_DEFER = 1 << 14;
 
         /// The linker pointed `path` at another output chunk (a split
         /// `import()` / `require()`): `text` is its path, `pretty` its id; `source_index` is cleared.
-        const IMPORTS_CHUNK = 1 << 16;
+        const IMPORTS_CHUNK = 1 << 15;
 
         /// `import()` / `require()` whose value nothing reads: the linker bound
         /// every name read off it to an export, so it evaluates to `{}`.
-        const NAMESPACE_UNUSED = 1 << 17;
+        const NAMESPACE_UNUSED = 1 << 16;
 
         /// A split `require()` whose target is CommonJS at link time: the
         /// chunk's namespace is `{ default: module.exports }`, so the call
         /// reads `.default` to return `module.exports`.
-        const CROSS_CHUNK_REQUIRE_DEFAULT = 1 << 18;
+        const CROSS_CHUNK_REQUIRE_DEFAULT = 1 << 17;
 
         /// Barrel optimization deferred this record: it set `IS_UNUSED` so the
         /// target does not load until an importer requests one of its exports.
         /// Only a record with this flag can be un-deferred. The parser sets
         /// `IS_UNUSED` for its own reasons (an unused TypeScript import, a macro
         /// import), and those records must never be resolved.
-        const IS_BARREL_DEFERRED = 1 << 19;
+        const IS_BARREL_DEFERRED = 1 << 18;
     }
 }
 
```

**File**: `src/bundler/linker.rs` (modified, +30/-210)
```diff
@@ -1,7 +1,5 @@
 // This file is the old linker, used by Bun.Transpiler.
 
-use std::io::Write as _;
-
 use bun_ast::Log;
 use bun_ast::{ImportKind, ImportRecord, ImportRecordFlags, ImportRecordTag};
 use bun_paths::{self, SEP};
@@ -19,9 +17,7 @@ use bun_url::URL;
 
 use crate::options::{self, BundleOptions, ImportPathFormat};
 use crate::options_impl::Target as BundleTarget;
-use crate::transpiler::{
-    BunPluginTarget, ParseResult, PluginResolver, PluginRunner, ResolveQueue, ResolveResults,
-};
+use crate::transpiler::{ParseResult, ResolveQueue, ResolveResults};
 
 pub struct Linker {
     // arena field dropped — global mimalloc (callers pass `bun.default_allocator`)
@@ -35,8 +31,6 @@ pub struct Linker {
     pub log: *mut Log,
     pub(crate) resolve_queue: *mut ResolveQueue,
     pub(crate) resolve_results: *mut ResolveResults,
-
-    pub plugin_runner: Option<*mut dyn PluginResolver>,
 }
 
 const RUNTIME_SOURCE_PATH: &[u8] = b"bun:wrap";
@@ -123,18 +117,12 @@ pub(crate) fn dupe(src: &[u8]) -> &'static [u8] {
     // by construction.
     unsafe { ImportPathsList::append(relative_paths_list_ptr(), &src).expect("OOM") }
 }
-#[inline]
-fn intern(buf: Vec<u8>) -> &'static [u8] {
-    let r = dupe(buf.as_slice());
-    drop(buf);
-    r
-}
 impl Linker {
     // ── raw-pointer field accessors ──────────────────────────────────────
     // The pointer fields are self-referential backrefs into the owning
     // `Transpiler` (sibling fields), wired in `configure_linker*`. They are
     // briefly null between `Transpiler::init` and `configure_linker`, but the
-    // contract is that no `link()`/`generate_import_path()`/`enqueue_*` call
+    // contract is that no `link()`/`enqueue_*` call
     // happens before `configure_linker` runs. Centralize the deref + invariant
     // here so call sites are safe-Rust.
 
@@ -240,15 +228,12 @@ impl Linker {
             log,
             resolve_queue,
             resolve_results,
-            plugin_runner: None,
         }
     }
 
     /// Re-seat the self-referential back-pointers after the owning
-    /// `Transpiler` has been moved to its final address. Only re-assigns the
-    /// pointer fields; does NOT reset
-    /// `plugin_runner`. Use instead of `init` from
-    /// `Transpiler::wire_after_move`.
+    /// `Transpiler` has been moved to its final address. Use instead of `init`
+    /// from `Transpiler::wire_after_move`.
     pub(crate) fn reseat_self_refs(
         &mut self,
         log: *mut Log,
@@ -309,14 +294,12 @@ impl Linker {
         Ok(dupe(modkey.hash_name(file_path.text, &mut hash_name_buf)?))
     }
 
-    /// This modifies the Ast in-place! It resolves import records and
-    /// generates paths.
+    /// This modifies the Ast in-place! It rewrites the import records of builtins
+    /// and of the runtime.
     ///
     /// `import_path_format` is a runtime arg rather than a const generic —
     /// `options::ImportPathFormat` doesn't derive `ConstParamTy`, and the
-    /// crate doesn't enable `adt_const_params`. All callers pass a literal,
-    /// and the inner `generate_import_path` body is a single `match` either
-    /// way, so codegen is equivalent.
+    /// crate doesn't enable `adt_const_params`.
     pub fn link<const IGNORE_RUNTIME: bool, const IS_BUN: bool>(
         &mut self,
         file_path: &Fs::Path<'_>,
@@ -325,20 +308,16 @@ impl Linker {
         import_path_format: ImportPathFormat,
     ) -> crate::Result<()> {
         // Copy out the two scalar config values we read so the `&self` borrow
-        // from `options()` doesn't overlap later `&mut self` calls
-        // (`generate_import_path`, `log_mut`).
+        // from `options()` doesn't overlap the later `&mut self` call (`log_mut`).
         let (target, rewrite_jest_for_tests) = {
             let opts = self.options();
             (opts.target, opts.rewrite_jest_for_tests)
         };
 
         let source_dir = file_path.source_dir();
-        let mut externals: Vec<u32> = Vec::new();
-        let mut had_resolve_errors = false;
 
         let is_deferred = !result.pending_imports.is_empty();
 
-        // Step 1. Resolve imports & requires
         match result.loader {
             options::Loader::Jsx
             | options::Loader::Js
@@ -366,22 +345,29 @@ impl Linker {
 
                     if !IGNORE_RUNTIME {
                         if import_record.path.namespace == b"runtime" {
-                            if import_path_format == ImportPathFormat::AbsoluteUrl {
-                                import_record.path = PFs::Path::init_with_namespace(
+                            let relative_name =
+                                bun_paths::resolve_path::relative(source_dir, RUNTIME_SOURCE_PATH);
+                            import_record.path = match import_path_format {
+                                ImportPathFormat::AbsoluteUrl => PFs::Path::init_with_namespace(
                                     dupe(&origin.join_alloc(b"", b"", b"bun:
```

**File**: `src/bundler/transpiler.rs` (modified, +0/-85)
```diff
@@ -19,89 +19,6 @@ pub(crate) type ResolveResults = HashMap<u64, ()>;
 // is structurally equivalent (growable ring buffer); swap once the re-export lands.
 pub(crate) type ResolveQueue = std::collections::VecDeque<resolver::Result>;
 
-/// Defined at
-/// this tier (lowest crate that needs to name it) and re-exported from
-/// `bun_jsc::BunPluginTarget` so there is exactly one enum (no bridge between
-/// mirror types).
-#[repr(u8)]
-#[derive(Copy, Clone, Eq, PartialEq, Debug)]
-pub enum BunPluginTarget {
-    Bun = 0,
-    Node = 1,
-    Browser = 2,
-}
-
-// Crosses FFI by-value to `JSBundlerPlugin__create` / `Bun__runOn*Plugins`
-// (C++: `typedef uint8_t BunPluginTarget`, `headers-handwritten.h`). NB: the
-// C++ header's *named* constants (`BunPluginTargetBrowser = 1`, `Node = 2`)
-// disagree with the Rust enum (`Node = 1`, `Browser = 2`). The width (`u8`)
-// is what matters at the ABI.
-bun_core::assert_ffi_discr!(BunPluginTarget, u8; Bun = 0, Node = 1, Browser = 2);
-
-/// The JSC-aware resolve hook.
-///
-/// The body calls `JSGlobalObject.runOnResolvePlugins`, so it cannot be
-/// defined at this tier (`bun_jsc` depends on this crate). `bun_jsc` provides
-/// the concrete `PluginRunner { global_object: *mut JSGlobalObject }` and
-/// implements this trait; `Linker.plugin_runner` holds it as
-/// `*mut dyn PluginResolver` so the linker stays JSC-free while the body lives
-/// in exactly one place (no fn-ptr field, no `*mut c_void` erasure).
-pub trait PluginResolver {
-    fn on_resolve(
-        &self,
-        specifier: &[u8],
-        importer: &[u8],
-        log: &mut bun_ast::Log,
-        loc: bun_ast::Loc,
-        target: BunPluginTarget,
-    ) -> crate::Result<Option<bun_paths::fs::Path<'static>>>;
-}
-
-/// Namespace for the static byte-level helpers
-/// (`extractNamespace` / `couldBePlugin`). The stateful struct (with
-/// `global_object`) lives in `bun_jsc::PluginRunner` where `JSGlobalObject` is
-/// nameable; only the JSC-free helpers stay at this tier.
-pub struct PluginRunner;
-
-impl PluginRunner {
-    /// Returns the `namespace:` prefix of `specifier`, or `b""` if it has none
-    /// (Windows drive-letter prefixes are not namespaces).
-    pub fn extract_namespace(specifier: &[u8]) -> &[u8] {
-        let Some(colon) = bun_core::strings::index_of_char_usize(specifier, b':') else {
-            return b"";
-        };
-        let colon = colon as usize;
-        if cfg!(windows)
-            && colon == 1
-            && specifier.len() > 3
-            && bun_paths::resolve_path::is_sep_any(specifier[2])
-            && ((specifier[0] > b'a' && specifier[0] < b'z')
-                || (specifier[0] > b'A' && specifier[0] < b'Z'))
-        {
-            return b"";
-        }
-        &specifier[..colon]
-    }
-
-    /// Cheap pre-filter that rules
-    /// out `./` / `../` / absolute paths before hitting the resolve hook.
-    pub fn could_be_plugin(specifier: &[u8]) -> bool {
-        if let Some(last_dot) = bun_core::strings::last_index_of_char(specifier, b'.') {
-            let ext = &specifier[last_dot + 1..];
-            // '.' followed by either a letter or a non-ascii character
-            // maybe there are non-ascii file extensions?
-            // we mostly want to cheaply rule out "../" and ".." and "./"
-            if !ext.is_empty()
-                && (ext[0].is_ascii_lowercase() || ext[0].is_ascii_uppercase() || ext[0] > 127)
-            {
-                return true;
-            }
-        }
-        !bun_paths::is_absolute(specifier)
-            && bun_core::strings::index_of_char_usize(specifier, b':').is_some()
-    }
-}
-
 /// The canonical newtype lives in `bun_ast::Macro` (the lowest tier that
 /// stores it, in `MacroContext.javascript_object`); re-exported here.
 pub use js_ast::Macro::MacroJSCtx;
@@ -368,8 +285,6 @@ impl<'a> Transpiler<'a> {
         self.options.log = log;
         self.resolver.log = core::ptr::NonNull::new(log).expect("wire_after_move: log is non-null");
         self.resolver.fs = self.fs;
-        // Only reseat the back-pointers — do NOT `Linker::init` here: that
-        // would clobber `plugin_runner`, which must be preserved across the move.
         self.linker.reseat_self_refs(
             log,
             core::ptr::addr_of_mut!(self.resolve_queue),
```

**File**: `src/js_printer/lib.rs` (modified, +3/-26)
```diff
@@ -67,15 +67,6 @@ use renamer as rename;
 // revisit if profiling shows allocation pressure during link.
 pub type MangledProps = bun_collections::ArrayHashMap<Ref, Box<[u8]>>;
 
-/// The namespace the printed specifier of `record` starts with (`namespace:path`), if any.
-fn printed_namespace(record: &ImportRecord) -> Option<&'static [u8]> {
-    (record
-        .flags
-        .contains(ImportRecordFlags::PRINT_NAMESPACE_IN_PATH)
-        && !record.path.is_file())
-    .then_some(record.path.namespace)
-}
-
 /// js_printer is the sole producer of ModuleInfo records; the bundler/runtime
 /// only consume the serialized form.
 pub mod analyze_transpiled_module {
@@ -709,16 +700,6 @@ pub mod analyze_transpiled_module {
             StringID(idx)
         }
 
-        /// Interns the specifier `print_import_record_path` prints for `record`, so the
-        /// module record requests the same module as the printed source.
-        pub(crate) fn str_for_import_record(&mut self, record: &super::ImportRecord) -> StringID {
-            let path = record.path.text;
-            match super::printed_namespace(record) {
-                Some(namespace) => self.str(&[namespace, b":".as_slice(), path].concat()),
-                None => self.str(path),
-            }
-        }
-
         pub(crate) fn request_module(
             &mut self,
             import_record_path: StringID,
@@ -5621,7 +5602,7 @@ pub(crate) mod __gated_printer {
 
                     if Self::MAY_HAVE_MODULE_INFO {
                         if let Some(mi) = self.module_info() {
-                            let irp_id = mi.str_for_import_record(import_record);
+                            let irp_id = mi.str(import_record.path.text);
                             mi.request_module(
                                 irp_id,
                                 analyze_transpiled_module::FetchParameters::None,
@@ -5805,7 +5786,7 @@ pub(crate) mod __gated_printer {
                         // `name_for_symbol` (which needs `&mut self`) can run between uses.
                         let irp_id = {
                             let mi = self.module_info().expect("infallible: module_info enabled");
-                            let id = mi.str_for_import_record(import_record);
+                            let id = mi.str(import_record.path.text);
                             mi.request_module(id, analyze_transpiled_module::FetchParameters::None);
                             id
                         };
@@ -6332,7 +6313,7 @@ pub(crate) mod __gated_printer {
                         use analyze_transpiled_module::FetchParameters as FP;
                         let (irp_id, fetch_parameters) = {
                             let mi = self.module_info().expect("infallible: module_info enabled");
-                            let irp_id = mi.str_for_import_record(record);
+                            let irp_id = mi.str(record.path.text);
                             let fetch_parameters: FP = if IS_BUN_PLATFORM {
                                 if let Some(loader) = record.loader {
                                     use bun_ast::Loader;
@@ -6515,10 +6496,6 @@ pub(crate) mod __gated_printer {
 
             let quote = best_quote_char_for_string(import_record.path.text, false);
             self.print(quote);
-            if let Some(namespace) = printed_namespace(import_record) {
-                self.print_string_characters_utf8(namespace, quote);
-                self.print(b":");
-            }
             self.print_string_characters_utf8(import_record.path.text, quote);
             self.print(quote);
         }
```

**File**: `src/jsc/JSGlobalObject.rs` (modified, +41/-15)
```diff
@@ -710,12 +710,10 @@ impl JSGlobalObject {
         &self,
         namespace_: &BunString,
         path: &BunString,
-        target: BunPluginTarget,
     ) -> JsResult<Option<JSValue>> {
         crate::mark_binding();
         let ns = (namespace_.length() > 0).then_some(namespace_);
-        let result =
-            crate::from_js_host_call(self, || Bun__runOnLoadPlugins(self, ns, path, target))?;
+        let result = crate::from_js_host_call(self, || Bun__runOnLoadPlugins(self, ns, path))?;
         if result.is_undefined_or_null() {
             return Ok(None);
         }
@@ -727,19 +725,44 @@ impl JSGlobalObject {
         namespace_: &BunString,
         path: &BunString,
         source: &BunString,
-        target: BunPluginTarget,
     ) -> JsResult<Option<JSValue>> {
         crate::mark_binding();
         let ns = (namespace_.length() > 0).then_some(namespace_);
-        let result = crate::from_js_host_call(self, || {
-            Bun__runOnResolvePlugins(self, ns, path, source, target)
-        })?;
+        let result =
+            crate::from_js_host_call(self, || Bun__runOnResolvePlugins(self, ns, path, source))?;
         if result.is_undefined_or_null() {
             return Ok(None);
         }
         Ok(Some(result))
     }
 
+    /// Whether an `onResolve` or `onLoad` is registered.
+    pub fn has_plugins(&self) -> bool {
+        Bun__hasPlugins(self)
+    }
+
+    /// The key of the `build.module()` or `mock.module()` module that `specifier` names.
+    pub(crate) fn resolve_virtual_module(
+        &self,
+        specifier: &BunString,
+        importer: &BunString,
+    ) -> Option<BunString> {
+        let key = Bun__resolveVirtualModule(self, specifier, importer);
+        (!key.is_dead()).then_some(key)
+    }
+
+    /// Whether an `onLoad` would be called to load `key`.
+    pub(crate) fn has_on_load(&self, key: &[u8]) -> JsResult<bool> {
+        let Some((namespace_, path)) = crate::module_loader::plugin_namespace_and_path(key) else {
+            return Ok(false);
+        };
+        let namespace_ = BunString::from_bytes(namespace_);
+        let ns = (namespace_.length() > 0).then_some(&namespace_);
+        crate::from_js_host_call_generic(self, || {
+            Bun__hasOnLoad(self, ns, &BunString::from_bytes(path))
+        })
+    }
+
     /// `args` formatted as UTF-8. If a `Display` impl fails mid-way (e.g. a
     /// JS `Symbol.toPrimitive` threw), the pending exception is cleared and
     /// the partial message is used rather than an error about an error.
@@ -1372,12 +1395,6 @@ impl JSGlobalObject {
 // see one nominal type (the previous local duplicate diverged from lib.rs).
 pub use crate::GregorianDateTime;
 
-/// The enum is defined once in `bun_bundler::transpiler` (the lowest tier that names it,
-/// for `Linker::link`'s call into `PluginResolver::on_resolve`) and re-exported
-/// here so the C++ FFI signature and all `bun_jsc` callers share one nominal
-/// type — no mirror enum, no transmute.
-pub use bun_bundler::transpiler::BunPluginTarget;
-
 // No `Default` derive — `code` has no default (only `errno`/`name` are
 // optional). Callers must always supply `code`.
 pub struct SysErrOptions {
@@ -1498,15 +1515,24 @@ unsafe extern "C" {
         global: &JSGlobalObject,
         namespace_: Option<&BunString>,
         path: &BunString,
-        target: BunPluginTarget,
     ) -> JSValue;
     safe fn Bun__runOnResolvePlugins(
         global: &JSGlobalObject,
         namespace_: Option<&BunString>,
         path: &BunString,
         source: &BunString,
-        target: BunPluginTarget,
     ) -> JSValue;
+    safe fn Bun__hasPlugins(global: &JSGlobalObject) -> bool;
+    safe fn Bun__resolveVirtualModule(
+        global: &JSGlobalObject,
+        specifier: &BunString,
+        importer: &BunString,
+    ) -> BunString;
+    safe fn Bun__hasOnLoad(
+        global: &JSGlobalObject,
+        namespace_: Option<&BunString>,
+        path: &BunString,
+    ) -> bool;
 
     // safe: `JSGlobalObject` is an opaque `UnsafeCell`-backed ZST handle (`&` is
     // ABI-identical to non-null `*const`); `ctx` is an opaque round-trip pointer
```

---

### Incident Patch 8: `e196cd6a` (2026-10-02)
**Commit Message**: bun test: fix a segfault when an asymmetric matcher meets an array element that is not there (#44348)

### What does this PR do?

Fixes a segfault at address `0x5` in `bun test`, when an asymmetric
matcher is compared with an array element that is not there.

```js
expect({ a: [["x"]] }).toMatchObject({
  a: expect.arrayContaining([["x", expect.stringContaining("y")]]),
});
```

This is an assertion that should fail and print a diff. It ends the test
runner instead. So does `expect([,]).toEqual([expect.any(String)])`.

**Cause**

The loop over two arrays in `Bun__deepEquals` runs to the length of the
first and reads the same index of the second with
`getIndexWithoutAccessors`, which returns the empty `JSValue` for a
hole, for an index past the end, and for an index that is a getter.
`Bun__deepEquals` takes empty values, but its first step, the dispatch
to asymmetric matchers, checks only that the matcher is not empty and
hands the other value on. The empty value passes `isCell()`, so
`isString()`, `isObject()`, `cell->type()` and the rest read the type
byte of a null cell. `arrayContaining` passes the expected value first,
so there an expected array that is longer than the actual o

**File**: `src/jsc/bindings/bindings.cpp` (modified, +18/-2)
```diff
@@ -675,6 +675,11 @@ static bool canPerformFastPropertyEnumerationForIterationBun(Structure* s)
     return true;
 }
 
+static bool mayBeAsymmetricMatcher(JSValue value)
+{
+    return value.isCell() && !value.isEmpty() && value.asCell()->type() == JSC::JSType(JSDOMWrapperType);
+}
+
 JSValue getIndexWithoutAccessors(JSGlobalObject* globalObject, JSObject* obj, uint64_t i)
 {
     if (obj->canGetIndexQuickly(i)) {
@@ -821,7 +826,7 @@ bool Bun__deepEquals(JSC::JSGlobalObject* globalObject, JSValue v1, JSValue v2,
     // need to check this before primitives, asymmetric matchers
     // can match against any type of value.
     if constexpr (enableAsymmetricMatchers) {
-        if (v2.isCell() && !v2.isEmpty() && v2.asCell()->type() == JSC::JSType(JSDOMWrapperType)) {
+        if (mayBeAsymmetricMatcher(v2)) {
             switch (matchAsymmetricMatcher(globalObject, v2, v1, scope)) {
             case AsymmetricMatcherResult::FAIL:
                 return false;
@@ -832,7 +837,7 @@ bool Bun__deepEquals(JSC::JSGlobalObject* globalObject, JSValue v1, JSValue v2,
                 RETURN_IF_EXCEPTION(scope, false);
                 break;
             }
-        } else if (v1.isCell() && !v1.isEmpty() && v1.asCell()->type() == JSC::JSType(JSDOMWrapperType)) {
+        } else if (mayBeAsymmetricMatcher(v1)) {
             switch (matchAsymmetricMatcher(globalObject, v1, v2, scope)) {
             case AsymmetricMatcherResult::FAIL:
                 return false;
@@ -1007,6 +1012,17 @@ bool Bun__deepEquals(JSC::JSGlobalObject* globalObject, JSValue v1, JSValue v2,
                 }
             }
 
+            if constexpr (enableAsymmetricMatchers) {
+                // A matcher gets what reading the element gives: the value of a getter, undefined for a hole or past the end.
+                if (left.isEmpty() && mayBeAsymmetricMatcher(right)) {
+                    left = o1->getIndex(globalObject, static_cast<unsigned>(i));
+                    RETURN_IF_EXCEPTION(scope, false);
+                } else if (right.isEmpty() && mayBeAsymmetricMatcher(left)) {
+                    right = o2->getIndex(globalObject, static_cast<unsigned>(i));
+                    RETURN_IF_EXCEPTION(scope, false);
+                }
+            }
+
             auto eql = Bun__deepEquals<isStrict, enableAsymmetricMatchers, checkPrototypes, skipPrototypeIdentity>(globalObject, left, right, gcBuffer, stack, scope, true);
             RETURN_IF_EXCEPTION(scope, false);
             if (!eql) return false;
```

**File**: `test/js/bun/test/expect.test.js` (modified, +76/-0)
```diff
@@ -880,6 +880,82 @@ describe("expect()", () => {
       expect({ a: 123n }).toEqual({ a: expect.any(BigInt) });
       expect({ a: 123n }).not.toEqual({ a: expect.any(g) });
     });
+
+    it("gives a matcher undefined for an element that the other array does not have", () => {
+      const seen = [];
+      expect.extend({
+        toBeRecorded(value) {
+          seen.push(value);
+          return { pass: false, message: () => "" };
+        },
+      });
+      const matchers = [
+        expect.stringContaining("a"),
+        expect.stringMatching(/a/),
+        expect.any(String),
+        expect.any(Symbol),
+        expect.any(BigInt),
+        expect.any(Boolean),
+        expect.any(Number),
+        expect.any(Array),
+        expect.any(Object),
+        expect.any(Promise),
+        expect.any(Date),
+        expect.anything(),
+        expect.arrayContaining([1]),
+        expect.objectContaining({ a: 1 }),
+        expect.closeTo(1),
+        // @ts-expect-error
+        expect.toBeRecorded(),
+      ];
+      for (const matcher of matchers) {
+        expect([,]).not.toEqual([matcher]);
+        expect([[,]]).not.toEqual(expect.arrayContaining([[matcher]]));
+        expect({ a: [["x"]] }).not.toMatchObject({ a: expect.arrayContaining([["x", matcher]]) });
+      }
+      expect([,]).toEqual([expect.not.stringContaining("a")]);
+      expect(seen.length).toBeGreaterThan(0);
+      expect(seen.filter(value => value !== undefined)).toEqual([]);
+    });
+
+    it("gives a matcher the value of a getter at an index", () => {
+      const array = [1];
+      Object.defineProperty(array, 1, { get: () => "x", enumerable: true });
+      expect(array).toEqual([1, expect.anything()]);
+      expect(array).toEqual([1, expect.any(String)]);
+      expect(array).toEqual([1, expect.stringContaining("x")]);
+      expect(array).not.toEqual([1, expect.stringContaining("y")]);
+      expect([array]).toEqual(expect.arrayContaining([[1, expect.stringContaining("x")]]));
+    });
+
+    if (isBun) {
+      it("does not crash on an element that the other array does not have", async () => {
+        const { bunEnv, bunExe } = require("harness");
+        const src = `
+          import { expect } from "bun:test";
+          const getter = Object.defineProperty([], 0, { get: () => "x", enumerable: true });
+          for (const matcher of [expect.stringContaining("a"), expect.any(String), expect.arrayContaining([1])]) {
+            try { expect([,]).toEqual([matcher]); } catch {}
+            try { expect([]).toEqual(expect.arrayContaining([[matcher]])); } catch {}
+            try { expect(getter).toEqual([matcher]); } catch {}
+            try { expect({ a: [["x"]] }).toMatchObject({ a: expect.arrayContaining([["x", matcher]]) }); } catch {}
+          }
+          console.log("ok");
+        `;
+        await using proc = Bun.spawn({
+          cmd: [bunExe(), "-e", src],
+          env: { ...bunEnv, BUN_JSC_validateExceptionChecks: "1" },
+          stdout: "pipe",
+          stderr: "pipe",
+        });
+        const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+        expect({ stdout, stderr, exitCode, signalCode: proc.signalCode }).toMatchObject({
+          stdout: "ok\n",
+          exitCode: 0,
+          signalCode: null,
+        });
+      });
+    }
   });
 
   test("toThrow asymmetric matchers", () => {
```

---

### Incident Patch 9: `fa467dca` (2026-10-02)
**Commit Message**: bun test: fix a silent stack overflow when printing a deeply nested value (#44353)

### What does this PR do?

Fixes a stack overflow in `bun test` when it prints a deeply nested
value. The process ends with SIGSEGV and prints nothing: no panic, no
test name, no diff.

```js
let value = 1;
for (let i = 0; i < 20_000; i++) value = i % 2 ? [value] : { a: value };
expect(value).toMatchInlineSnapshot(`"x"`); // exit code 139
```

`toEqual` has it too. `Bun__deepEquals` checks the stack and throws a
`RangeError`, but its frames are smaller than the printer's, so there is
a range of depths that compare fine and then overflow in the message.

**Cause**

`console.log`'s formatter asks `StackCheck::is_safe_to_recurse()` before
it goes into a value. The one in `pretty_format.rs`, which prints values
for matcher messages, diffs and snapshots, has no stack check and no
depth limit.

**Fix**

The same check at the top of `print_as`, for every value. It throws the
`RangeError` that `toEqual` throws for a deeper value, and that Jest
ends with.

It is not tied to `can_have_circular_references()`: JSX elements and
events are not in that set and print what they hold all the same.

| `toMatchInlineSn

**File**: `src/runtime/test_runner/pretty_format.rs` (modified, +33/-25)
```diff
@@ -1041,6 +1041,10 @@ impl<'a> Formatter<'a> {
         if self.failed {
             return Ok(());
         }
+        if !bun_core::StackCheck::init().is_safe_to_recurse() {
+            self.failed = true;
+            return Err(self.global_this.throw_stack_overflow());
+        }
         // reshaped for borrowck — `WrappedWriter` borrows both writer_
         // and &mut self.estimated_line_length; we use a local wrapper and sync
         // `failed` at scope exit. estimated_line_length is unused by WrappedWriter
@@ -2613,12 +2617,25 @@ impl bun_jsc::ConsoleFormatter for Formatter<'_> {
         value: JSValue,
         cell: JSType,
     ) -> JsResult<()> {
+        let mut sink = bun_io::FmtAdapter::new(writer);
+        let global = self.global_this;
+        self.format::<_, ENABLE_ANSI_COLORS>(
+            TagResult { tag: tag.into(), cell },
+            &mut sink,
+            value,
+            global,
+        )
+    }
+}
+
+impl From<bun_jsc::FormatTag> for Tag {
+    fn from(tag: bun_jsc::FormatTag) -> Tag {
         use bun_jsc::FormatTag as Ft;
         // Map the wider `console_object::Tag` onto this file's `Tag`. Only the
         // variants the `write_format` hooks actually emit are reachable
         // (Boolean / Double / Object / Private / String); the rest collapse
         // onto `Object` so any future caller still renders something useful.
-        let local = match tag {
+        match tag {
             Ft::StringPossiblyFormatted => Tag::StringPossiblyFormatted,
             Ft::String => Tag::String,
             Ft::Undefined => Tag::Undefined,
@@ -2652,15 +2669,7 @@ impl bun_jsc::ConsoleFormatter for Formatter<'_> {
             | Ft::CustomGetterSetter
             | Ft::Proxy
             | Ft::RevokedProxy => Tag::Object,
-        };
-        let mut sink = bun_io::FmtAdapter::new(writer);
-        let global = self.global_this;
-        self.format::<_, ENABLE_ANSI_COLORS>(
-            TagResult { tag: local, cell },
-            &mut sink,
-            value,
-            global,
-        )
+        }
     }
 }
 
@@ -2676,10 +2685,10 @@ pub(crate) trait AsymmetricMatcherFormatter {
     fn amf_quote_strings(&mut self) -> &mut bool;
     /// `printAs(tag, …)` routed through the formatter's own runtime
     /// dispatcher. Only `Object` / `String` / `Array` are reached.
-    fn amf_print_as<const C: bool>(
+    fn amf_print_as<W: bun_io::Write, const C: bool>(
         &mut self,
         tag: bun_jsc::FormatTag,
-        w: &mut dyn bun_io::Write,
+        w: &mut W,
         v: JSValue,
         cell: JSType,
     ) -> JsResult<()>;
@@ -2692,18 +2701,17 @@ impl AsymmetricMatcherFormatter for Formatter<'_> {
     fn amf_global_this(&self) -> &JSGlobalObject { self.global_this }
     #[inline]
     fn amf_quote_strings(&mut self) -> &mut bool { &mut self.quote_strings }
-    fn amf_print_as<const C: bool>(
+    fn amf_print_as<W: bun_io::Write, const C: bool>(
         &mut self,
         tag: bun_jsc::FormatTag,
-        w: &mut dyn bun_io::Write,
+        w: &mut W,
         v: JSValue,
         cell: JSType,
     ) -> JsResult<()> {
-        // Reuse the `ConsoleFormatter` bridge above (FormatTag → local `Tag`
-        // mapping + `format` dispatch). `AsFmt` adapts `dyn bun_io::Write` →
-        // `core::fmt::Write` for the trait method's signature.
-        let mut bridge = AsFmt::new(w);
-        <Self as bun_jsc::ConsoleFormatter>::print_as::<_, C>(self, tag, &mut bridge, v, cell)
+        // The writer itself: an adapter around it for each matcher inside a matcher makes every
+        // write as deep as they are nested, where nothing checks the stack.
+        let global = self.global_this;
+        self.format::<W, C>(TagResult { tag: tag.into(), cell }, w, v, global)
     }
 }
 
@@ -2714,10 +2722,10 @@ impl AsymmetricMatcherFormatter for bun_jsc::console_object::Formatter<'_> {
     fn amf_global_this(&self) -> &JSGlobalObject { self.global_this }
     #[inline]
     fn amf_quote_strings(&mut self) -> &mut bool { &mut self.quote_strings }
-    fn amf_print_as<const C: bool>(
+    fn amf_print_as<W: bun_io::Write, const C: bool>(
         &mut self,
         tag: bun_jsc::FormatTag,
-        w: &mut dyn bun_io::Write,
+        w: &mut W,
         v: JSValue,
         cell: JSType,
     ) -> JsResult<()> {
@@ -2849,7 +2857,7 @@ impl JestPrettyFormat {
                 this.amf_add_for_new_line(b"ObjectContaining ".len());
                 writer.write_all(b"ObjectContaining ");
             }
-            this.amf_print_as::<ENABLE_ANSI_COLORS>(
+            this.amf_print_as::<W, ENABLE_ANSI_COLORS>(
                 bun_jsc::FormatTag::Object, &mut *writer.ctx, object_value, JSType::Object,
             )?;
         } else if let Some(matcher) = value.as_class_ref::<expect::ExpectStringContaining>() {
@@ -2868,7 +2876,7 @@ impl JestPrettyFormat {
                 this.amf_add_for_new_line(b"StringContaining ".len());
                 writer.write_all(b
```

**File**: `test/cli/test/bun-test.test.ts` (modified, +28/-0)
```diff
@@ -114,6 +114,34 @@ describe("bun test", () => {
     expect(stderr).toContain(path);
   });
 
+  test.each([
+    ["arrays and objects", "i % 2 ? [value] : { a: value }"],
+    ["instances of a class", "new (class A { a = value; })()"],
+    ["JSX children", `{ $$typeof: Symbol.for("react.element"), type: "div", props: { children: value } }`],
+    ["JSX props", `{ $$typeof: Symbol.for("react.element"), type: "div", props: { a: value } }`],
+    ["the data of events", `new MessageEvent("message", { data: value })`],
+    ["asymmetric matchers", "expect.objectContaining({ a: value })"],
+  ])("%s nested too deeply to print are a RangeError", (_, wrap) => {
+    const stderr = runTest({
+      input: `
+        import { test, expect } from "bun:test";
+        function thrownFor(depth) {
+          let value = 1;
+          for (let i = 0; i < depth; i++) value = ${wrap};
+          try {
+            expect(value).toMatchInlineSnapshot('"x"');
+          } catch (error) {
+            return error.constructor.name;
+          }
+        }
+        test("deep", () => {
+          expect([thrownFor(10), thrownFor(100_000)]).toEqual(["Error", "RangeError"]);
+        });
+      `,
+      expectExitCode: 0,
+    });
+    expect(stderr).toContain("1 pass");
+  });
   describe("when filters are provided", () => {
     let dir: string;
     beforeAll(() => {
```

---

### Incident Patch 10: `76cf78c5` (2026-10-02)
**Commit Message**: Fix a segfault when Module.runMain is not a function, and report what an override throws (#44352)

### What does this PR do?

Fixes a segfault when a preload sets `Module.runMain` to something that
is not a function, and shows the error when an override throws.

```js
// preload.cjs
require("module").runMain = {};
```

| `Module.runMain =` | 1.4.2, canary `7fe13e1b9` | this PR | Node 26.7 |
|---|---|---|---|
| `{}`, `[]`, `"a string"`, `Symbol("s")`, `10n` | segfault |
`TypeError: Object is not a function` (`Array`, `"a string"`,
`Symbol(s)`, `10`), exit 1 | `TypeError: require(...).Module.runMain is
not a function`, exit 1 |
| `() => { throw new RangeError("x") }` | `Error occurred loading entry
point: JSError`, and nothing else | `RangeError: x` with its source line
and stack, exit 1 | the same |
| `class A {}` | `Error occurred loading entry point: JSError` |
`TypeError: Cannot call a class constructor A without \|new\|` |
`TypeError: Class constructor A cannot be invoked without 'new'` |

**Cause**

The setter stores any cell. `NodeModuleModule__callOverriddenRunMain`
cast it to `JSObject` unchecked and called it with the `CallData` of a
value that cannot be called.

An excepti

**File**: `src/jsc/VirtualMachine.rs` (modified, +36/-21)
```diff
@@ -3479,25 +3479,41 @@ impl VirtualMachine {
                     bun_core::hint::cold();
                     self.set_pending_internal_promise(None);
                     let global_ref = self.global();
-                    let argv1 = bun_string_jsc::create_utf8_for_js(global_ref, MAIN_FILE_NAME)
-                        .map_err(|_| crate::CrateError::JSError)?;
-                    let ret = jsc::from_js_host_call_generic(global_ref, || {
-                        NodeModuleModule__callOverriddenRunMain(global_ref, argv1)
-                    })
-                    .map_err(|_| crate::CrateError::JSError)?;
-                    // If the override stored a promise itself, use that; otherwise
-                    // wrap its return value.
-                    if let Some(stored) = self.pending_internal_promise() {
-                        return Ok(stored);
-                    }
-                    // `Promise.resolve(ret)` reads `ret.constructor` / `ret.then`,
-                    // which may throw.
-                    let resolved = jsc::call_check_slow(global_ref, || {
-                        JSC__JSInternalPromise__resolvedPromise(global_ref, ret)
-                    })
-                    .map_err(|_| crate::CrateError::JSError)?;
-                    self.set_pending_internal_promise(Some(resolved));
-                    return Ok(resolved);
+                    let argv1 = bun_string_jsc::create_utf8_for_js(global_ref, MAIN_FILE_NAME)?;
+                    let promise: *mut JSInternalPromise =
+                        match jsc::from_js_host_call_generic(global_ref, || {
+                            NodeModuleModule__callOverriddenRunMain(global_ref, argv1)
+                        }) {
+                            Ok(ret) => {
+                                // If the override stored a promise itself, use that; otherwise
+                                // wrap its return value.
+                                if let Some(stored) = self.pending_internal_promise() {
+                                    return Ok(stored);
+                                }
+                                // `Promise.resolve(ret)` reads `ret.constructor` / `ret.then`,
+                                // which may throw.
+                                jsc::call_check_slow(global_ref, || {
+                                    JSC__JSInternalPromise__resolvedPromise(global_ref, ret)
+                                })?
+                            }
+                            Err(err) => {
+                                let rejected =
+                                    crate::JSPromise::rejected_promise_with_caught_exception(
+                                        global_ref, err,
+                                    )?;
+                                // Nobody else looks at a promise the override stored, so that stays
+                                // the entry point's, and this one is left to the rejection tracker.
+                                if let Some(stored) = self.pending_internal_promise() {
+                                    return Ok(stored);
+                                }
+                                // Whoever loads the entry point reports its promise, so, like the
+                                // loader's, it is not for the rejection tracker as well.
+                                rejected.set_handled();
+                                core::ptr::from_mut(rejected).cast()
+                            }
+                        };
+                    self.set_pending_internal_promise(Some(promise));
+                    return Ok(promise);
                 }
             }
 
@@ -3515,8 +3531,7 @@ impl VirtualMachine {
             } else {
                 let p: *mut JSInternalPromise = jsc::from_js_host_call_generic(global_ref, || {
                     Bun__loadHTMLEntryPoint(global_ref)
-                })
-                .map_err(|_| crate::CrateError::JSError)?;
+                })?;
                 if p.is_null() {
                     return Err(crate::CrateError::JSError);
                 }
```

**File**: `src/jsc/modules/NodeModuleModule.cpp` (modified, +9/-2)
```diff
@@ -832,10 +832,17 @@ JSC_DEFINE_CUSTOM_GETTER(moduleRunMain,
 extern "C" void Bun__VirtualMachine__setOverrideModuleRunMain(void* bunVM, bool isOriginal);
 extern "C" JSC::EncodedJSValue NodeModuleModule__callOverriddenRunMain(Zig::GlobalObject* global, JSValue argv1)
 {
-    auto overrideHandler = uncheckedDowncast<JSObject>(global->m_moduleRunMainFunction.get(global));
+    auto& vm = JSC::getVM(global);
+    auto scope = DECLARE_THROW_SCOPE(vm);
+    JSValue overrideHandler = global->m_moduleRunMainFunction.get(global);
+    auto callData = JSC::getCallData(overrideHandler);
+    if (callData.type == JSC::CallData::Type::None) {
+        throwException(global, scope, createNotAFunctionError(global, overrideHandler));
+        return {};
+    }
     MarkedArgumentBuffer args;
     args.append(argv1);
-    return JSC::JSValue::encode(JSC::profiledCall(global, JSC::ProfilingReason::API, overrideHandler, JSC::getCallData(overrideHandler), global, args));
+    RELEASE_AND_RETURN(scope, JSC::JSValue::encode(JSC::profiledCall(global, JSC::ProfilingReason::API, overrideHandler, callData, global, args)));
 }
 
 JSC_DEFINE_CUSTOM_SETTER(setModuleRunMain,
```

**File**: `test/js/node/module/node-module-module.test.js` (modified, +85/-1)
```diff
@@ -1,7 +1,7 @@
 import "bun:sqlite";
 import { describe, expect, test } from "bun:test";
 import fs from "fs";
-import { bunEnv, bunExe, isWindows, ospath, tempDir } from "harness";
+import { bunEnv, bunExe, isWindows, normalizeBunSnapshot, ospath, tempDir } from "harness";
 import Module, { _nodeModulePaths, builtinModules, createRequire, isBuiltin, wrap } from "module";
 import path from "path";
 
@@ -960,6 +960,90 @@ console.log("survived", require("./late.js"));`,
     expect(stdout.trim()).toBe("pass");
     expect(await proc.exited).toBe(0);
   });
+  describe.concurrent("Module.runMain set by a preload", () => {
+    const handlers = `
+      process.on("uncaughtException", error => console.log("uncaughtException: " + error.message));
+      process.on("unhandledRejection", error => console.log("unhandledRejection: " + error.message));
+    `;
+    async function run(preload, inWorker = false, main = `console.log("main ran");`) {
+      using dir = tempDir("module-run-main", {
+        "preload.cjs": preload,
+        "main.cjs": main,
+        "worker.mjs": `new Worker(import.meta.dir + "/main.cjs", { preload: [import.meta.dir + "/preload.cjs"] });`,
+      });
+      await using proc = Bun.spawn({
+        cmd: inWorker ? [bunExe(), "./worker.mjs"] : [bunExe(), "--require", "./preload.cjs", "./main.cjs"],
+        env: bunEnv,
+        cwd: String(dir),
+        stderr: "pipe",
+        stdout: "pipe",
+      });
+      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+      return { stdout, stderr: normalizeBunSnapshot(stderr, dir), exitCode };
+    }
+
+    test.each([
+      ["{}", "Object"],
+      ["[]", "Array"],
+      [`"a string"`, `"a string"`],
+      [`Symbol("s")`, "Symbol(s)"],
+      ["10n", "10"],
+    ])("to %s, which is not a function", async (value, described) => {
+      expect(await run(`require("module").runMain = ${value};`)).toEqual({
+        stdout: "",
+        stderr: `TypeError: ${described} is not a function\n\nBun v<bun-version>`,
+        exitCode: 1,
+      });
+    });
+
+    test("to a function that throws", async () => {
+      const { stdout, stderr, exitCode } = await run(
+        `require("module").runMain = () => {\n  throw new RangeError("from the override");\n};`,
+      );
+      expect(stderr).toMatchInlineSnapshot(`
+        "1 | require("module").runMain = () => {
+        2 |   throw new RangeError("from the override");
+                        ^
+        RangeError: from the override
+            at <anonymous> (file:NN:NN)
+
+        Bun v<bun-version>"
+      `);
+      expect({ stdout, exitCode }).toEqual({ stdout: "", exitCode: 1 });
+    });
+
+    test("to a function that calls the original and throws", async () => {
+      const preload = `
+        const Module = require("module");
+        const runMain = Module.runMain;
+        Module.runMain = (...args) => {
+          runMain(...args);
+          throw new Error("after the original");
+        };
+      `;
+      expect(await run(preload)).toMatchObject({ stdout: "main ran\n", exitCode: 1 });
+      expect(await run(handlers + preload)).toEqual({
+        stdout: "main ran\nunhandledRejection: after the original\n",
+        stderr: "",
+        exitCode: 0,
+      });
+      // What the main file throws is not lost for it.
+      expect(await run(handlers + preload, false, `throw new Error("from main");`)).toEqual({
+        stdout: "unhandledRejection: after the original\nuncaughtException: from main\n",
+        stderr: "",
+        exitCode: 0,
+      });
+    });
+
+    test.each([
+      ["is not a function", "{}", "Object is not a function"],
+      ["throws", `() => { throw new Error("thrown"); }`, "thrown"],
+    ])("one that %s is reported once", async (_, value, message) => {
+      const expected = { stdout: `uncaughtException: ${message}\n`, stderr: "", exitCode: 0 };
+      expect(await run(`${handlers} require("module").runMain = ${value};`)).toEqual(expected);
+      expect(await run(`${handlers} require("module").runMain = ${value};`, true)).toEqual(expected);
+    });
+  });
   test.each(["no args", "--access-early"])("children, %s", async arg => {
     await using proc = Bun.spawn({
       cmd: [bunExe(), path.join(import.meta.dir, "children-fixture/a.cjs"), arg],
```

---

### Incident Patch 11: `468efaca` (2026-10-02)
**Commit Message**: Remove the dead --dump-environment-variables flag from bun build (#44370)

Behaviour change: none

One error path differs. See Downsides.

### Problem
- `bun build --dump-environment-variables` does nothing.
`BUILD_ONLY_PARAMS` declares the flag
(`src/runtime/cli/Arguments.rs:538`), but no code reads it.
- `DebugOptions.dump_environment_variables` is always `false`, so the
branch at `src/runtime/cli/build_command.rs:604` and
`Transpiler::dump_environment_variables` cannot run.
- The completions still offer the flag, with `--dump-limits` and
`--disable-bun-js`, whose fields #36184 deleted.

### Fix
- Delete the param, the field, the branch and the function. Remove the
three names from the completions.
- Correct on current main: the parser skips an unknown long flag in
silence (`src/clap/streaming.rs:157`). The bare flag gives the same
bundle as before.
- Verified: `bun bd`, `test/bundler/cli.test.ts`, `bundler_env.test.ts`,
`test/cli/bun.test.ts`, `test/cli/run/env.test.ts`. No new test:
`REVIEW.md` says "Do not add tests to check dead code stays dead".
- Self-reviewed: 14 concerns raised, 13 addressed. Rejected: to drop the
first line. It stays because the PR adds no test.

### Bac

**File**: `completions/bun.bash` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ _bun_completions() {
 
     local SUBCOMMANDS="dev bun create run install add remove upgrade completions discord help init pm x test repl update audit dedupe prune outdated link unlink build";
 
-    GLOBAL_OPTIONS[LONG_OPTIONS]="--use --cwd --bunfile --server-bunfile --config --disable-react-fast-refresh --disable-hmr --env-file --extension-order --jsx-factory --jsx-fragment --extension-order --jsx-factory --jsx-fragment --jsx-import-source --jsx-production --jsx-runtime --main-fields --no-summary --version --platform --public-dir --tsconfig-override --define --external --help --inject --loader --origin --port --dump-environment-variables --dump-limits --disable-bun-js";
+    GLOBAL_OPTIONS[LONG_OPTIONS]="--use --cwd --bunfile --server-bunfile --config --disable-react-fast-refresh --disable-hmr --env-file --extension-order --jsx-factory --jsx-fragment --extension-order --jsx-factory --jsx-fragment --jsx-import-source --jsx-production --jsx-runtime --main-fields --no-summary --version --platform --public-dir --tsconfig-override --define --external --help --inject --loader --origin --port";
     GLOBAL_OPTIONS[SHORT_OPTIONS]="-c -v -d -e -h -i -l -u -p";
 
     PACKAGE_OPTIONS[ADD_OPTIONS_LONG]="--development --optional --peer --catalog --filter";
```

**File**: `completions/bun.zsh` (modified, +1/-3)
```diff
@@ -514,9 +514,7 @@ _bun_run_completion() {
         '-i[Automatically install dependencies and use global cache in bun'"'"'s runtime, equivalent to --install=fallback'] \
         '--prefer-offline[Skip staleness checks for packages in bun'"'"'s JavaScript runtime and resolve from disk]' \
         '--prefer-latest[Use the latest matching versions of packages in bun'"'"'s JavaScript runtime, always checking npm]' \
-        '--silent[Don'"'"'t repeat the command for bun run]' \
-        '--dump-environment-variables[Dump environment variables from .env and process as JSON and quit. Useful for debugging]' \
-        '--dump-limits[Dump system limits. Userful for debugging]' &&
+        '--silent[Don'"'"'t repeat the command for bun run]' &&
         ret=0
 
     case $state in
```

**File**: `src/bundler/transpiler.rs` (modified, +0/-31)
```diff
@@ -653,37 +653,6 @@ impl<'a> Transpiler<'a> {
     pub fn sync_resolver_opts(&mut self) {
         self.resolver.opts = resolver_bundle_options_subset(&self.options);
     }
-
-    /// Print the loaded environment variables to stdout as 2-space-indented
-    /// JSON.
-    #[cold]
-    #[inline(never)]
-    pub fn dump_environment_variables(&self) {
-        use bun_js_printer::{Encoding, write_json_string};
-        // Dump `env.map.*` as 2-space-indented JSON. `bun_dotenv::Map` doesn't
-        // impl `serde::Serialize`, so iterate and emit the object by hand.
-        // Keys and values go through `write_json_string` (the same escaper the
-        // printer uses for metafile/HTML-manifest JSON) so `"` / `\` / control
-        // bytes are escaped as standard JSON requires.
-        bun_core::Output::flush();
-        let env = self.env_mut();
-        let w = bun_core::Output::writer();
-        let _ = w.write_all(b"{\n");
-        let mut first = true;
-        let mut it = env.map.iterator();
-        while let Some(pair) = it.next() {
-            if !first {
-                let _ = w.write_all(b",\n");
-            }
-            first = false;
-            let _ = w.write_all(b"  ");
-            let _ = write_json_string::<_, { Encoding::Utf8 }>(&**pair.key_ptr, w);
-            let _ = w.write_all(b": ");
-            let _ = write_json_string::<_, { Encoding::Utf8 }>(&*pair.value_ptr.value, w);
-        }
-        let _ = w.write_all(b"\n}\n");
-        bun_core::Output::flush();
-    }
 }
 
 // ══════════════════════════════════════════════════════════════════════════
```

**File**: `src/options_types/context.rs` (modified, +0/-2)
```diff
@@ -350,7 +350,6 @@ pub fn try_get<'a>() -> Option<&'a ContextData> {
 }
 
 pub struct DebugOptions {
-    pub dump_environment_variables: bool,
     pub silent: bool,
     pub hot_reload: HotReload,
     /// `--watch-kill-signal`: signal whose JS handlers run before a `--watch`
@@ -377,7 +376,6 @@ impl Default for DebugOptions {
     #[inline(always)]
     fn default() -> Self {
         Self {
-            dump_environment_variables: false,
             silent: false,
             hot_reload: HotReload::None,
             watch_kill_signal: bun_core::SignalCode::DEFAULT,
```

**File**: `src/runtime/cli/Arguments.rs` (modified, +0/-1)
```diff
@@ -535,7 +535,6 @@ pub(crate) const BUILD_ONLY_PARAMS: &[ParamType] = concat_params!(
         parse_param!(
             "--css-chunking                   Chunk CSS files together to reduce duplicated CSS loaded in a browser. Only has an effect when multiple entrypoints import CSS"
         ),
-        parse_param!("--dump-environment-variables"),
         parse_param!("--conditions <STR>...            Pass custom conditions to resolve"),
         parse_param!(
             "--app                            (EXPERIMENTAL) Build a web app for production using Bun Bake."
```

**File**: `src/runtime/cli/build_command.rs` (modified, +0/-7)
```diff
@@ -599,13 +599,6 @@ impl BuildCommand {
         }
         let _ = client_transpiler;
 
-        // var env_loader = this_transpiler.env;
-
-        if ctx.debug.dump_environment_variables {
-            this_transpiler.dump_environment_variables();
-            return Ok(());
-        }
-
         let mut reachable_file_count: usize = 0;
         let mut minify_duration: u64 = 0;
         let mut input_code_length: u64 = 0;
```

---

### Incident Patch 12: `4b02e103` (2026-10-01)
**Commit Message**: --hot: fix a use-after-free of the entry point's promise (#44350)

### What does this PR do?

Fixes #41012

Fixes a use-after-free in `bun --hot`: it goes on reading the promise of
the entry point after the promise has been collected. What happens next
depends on what the memory is used for.

| the cell is reused by | `--hot` |
|---|---|
| a promise of the program's that was rejected and handled | prints that
error as if the entry point had thrown it |
| a promise of the program's that is pending | never reloads again |
| something that is not a promise | `panic: internal error: entered
unreachable code: invalid JSPromise status 255`, or a segfault in
`isTerminationException` under `unhandled_rejection` |

The first two reproduce every time, below. The third is 21 crash reports
on 1.4.2, 11 on macOS arm64 and 10 on Windows, every one from a process
with an HTTP server, and #41012: a segfault in the read of the status
itself, in `report_exception_in_hot_reloaded_module_if_needed`, at an
address that ends in `0x…B90`, a cell plus the `0x10` of the word below.
I could not reproduce that one, see the end of the next section.

**Cause**

`VirtualMachine::pending_internal_promise` is the

**File**: `src/jsc/VirtualMachine.rs` (modified, +34/-45)
```diff
@@ -292,8 +292,7 @@ pub struct VirtualMachine {
     pub rare_data: Option<Box<RareData>>,
     pub proxy_env_storage: crate::rare_data::ProxyEnvStorage,
     pub(crate) resolved_path_dups: Vec<Box<[u8]>>,
-    pub pending_internal_promise: Option<*mut JSInternalPromise>,
-    pub pending_internal_promise_is_protected: bool,
+    pending_internal_promise: crate::strong::Optional,
     pub pending_internal_promise_reported_at: u32,
     pub(crate) hot_reload_deferred: bool,
     pub entry_point_result: EntryPointResult,
@@ -3470,19 +3469,15 @@ impl VirtualMachine {
                     // SAFETY: hook contract.
                     let p = unsafe { (hooks.load_preloads)(self) }?;
                     if !p.is_null() {
-                        JSValue::from_cell(p).ensure_still_alive();
-                        JSValue::from_cell(p).protect();
-                        self.pending_internal_promise = Some(p);
-                        self.pending_internal_promise_is_protected = true;
+                        self.set_pending_internal_promise(Some(p));
                         return Ok(p);
                     }
                 }
 
                 // Check if Module.runMain was patched.
                 if self.has_patched_run_main {
                     bun_core::hint::cold();
-                    self.pending_internal_promise = None;
-                    self.pending_internal_promise_is_protected = false;
+                    self.set_pending_internal_promise(None);
                     let global_ref = self.global();
                     let argv1 = bun_string_jsc::create_utf8_for_js(global_ref, MAIN_FILE_NAME)
                         .map_err(|_| crate::CrateError::JSError)?;
@@ -3492,7 +3487,7 @@ impl VirtualMachine {
                     .map_err(|_| crate::CrateError::JSError)?;
                     // If the override stored a promise itself, use that; otherwise
                     // wrap its return value.
-                    if let Some(stored) = self.pending_internal_promise {
+                    if let Some(stored) = self.pending_internal_promise() {
                         return Ok(stored);
                     }
                     // `Promise.resolve(ret)` reads `ret.constructor` / `ret.then`,
@@ -3501,8 +3496,7 @@ impl VirtualMachine {
                         JSC__JSInternalPromise__resolvedPromise(global_ref, ret)
                     })
                     .map_err(|_| crate::CrateError::JSError)?;
-                    self.pending_internal_promise = Some(resolved);
-                    self.pending_internal_promise_is_protected = false;
+                    self.set_pending_internal_promise(Some(resolved));
                     return Ok(resolved);
                 }
             }
@@ -3529,9 +3523,7 @@ impl VirtualMachine {
                 p
             };
 
-            self.pending_internal_promise = Some(promise);
-            self.pending_internal_promise_is_protected = false;
-            JSValue::from_cell(promise).ensure_still_alive();
+            self.set_pending_internal_promise(Some(promise));
             Ok(promise)
         } else {
             self.entry_evaluation_started = false;
@@ -3541,9 +3533,7 @@ impl VirtualMachine {
                 jsc::JSModuleLoader::load_and_evaluate_module_ptr(global, Some(&main_str))
                     .map(NonNull::as_ptr)
                     .ok_or(crate::CrateError::JSError)?;
-            self.pending_internal_promise = Some(promise);
-            self.pending_internal_promise_is_protected = false;
-            JSValue::from_cell(promise).ensure_still_alive();
+            self.set_pending_internal_promise(Some(promise));
             Ok(promise)
         }
     }
@@ -3559,15 +3549,15 @@ impl VirtualMachine {
         // pending_internal_promise can change if hot module reloading is enabled
         if self.is_watcher_enabled() {
             loop {
-                let Some(p) = self.pending_internal_promise else {
+                let Some(p) = self.pending_internal_promise() else {
                     break;
                 };
                 // SAFETY: `p` is a live JSC heap cell tracked by the VM.
                 if crate::JSPromise::status_ptr(p) != crate::js_promise::Status::Pending {
                     break;
                 }
                 self.event_loop_mut().tick();
-                let Some(p) = self.pending_internal_promise else {
+                let Some(p) = self.pending_internal_promise() else {
                     break;
                 };
                 // SAFETY: see above.
@@ -3583,7 +3573,7 @@ impl VirtualMachine {
             let _ = self.wait_for_promise(jsc::AnyPromise::Internal(promise));
         }
 
-        Ok(self.pending_internal_promise.unwrap_or(promise))
+        Ok(self.pending_internal_promise().unwrap_or(promise))
     }
 }
 
@@ -4451,9 +4441,24 @@ impl VirtualMachine {
         (self.on_unhandled_rejection)(self, global_object, reason);
     }
 
+    /// The promise of th
```

**File**: `src/runtime/hw_exports.rs` (modified, +2/-3)
```diff
@@ -109,9 +109,8 @@ pub(crate) fn set_override_module_run_main_promise(
     vm: &mut VirtualMachine,
     promise: *mut JSInternalPromise,
 ) {
-    if vm.pending_internal_promise.is_none() {
-        vm.pending_internal_promise = Some(promise);
-        vm.pending_internal_promise_is_protected = false;
+    if vm.pending_internal_promise().is_none() {
+        vm.set_pending_internal_promise(Some(promise));
     }
 }
 
```

**File**: `src/runtime/jsc_hooks.rs` (modified, +7/-3)
```diff
@@ -820,7 +820,7 @@ unsafe fn load_preloads(vm: *mut VirtualMachine) -> bun_jsc::CrateResult<*mut JS
         };
 
         // SAFETY: per fn contract.
-        unsafe { (*vm).pending_internal_promise = Some(promise) };
+        unsafe { (*vm).set_pending_internal_promise(Some(promise)) };
         let _protected = JSValue::from_cell(promise).protected();
 
         // ── wait ────────────────────────────────────────────────────────
@@ -837,7 +837,9 @@ unsafe fn load_preloads(vm: *mut VirtualMachine) -> bun_jsc::CrateResult<*mut JS
                     // SAFETY: `pending_internal_promise` was set just above (or
                     // swapped by HMR to another live cell); `status()` is a
                     // read-only FFI call on a live JSC heap cell.
-                    let pip = unsafe { &*vm }.pending_internal_promise.unwrap_or(promise);
+                    let pip = unsafe { &*vm }
+                        .pending_internal_promise()
+                        .unwrap_or(promise);
                     // SAFETY: `pip` is a live JSC heap cell (set just above or
                     // the protected `promise` fallback).
                     if unsafe { &*pip }.status() != PromiseStatus::Pending {
@@ -846,7 +848,9 @@ unsafe fn load_preloads(vm: *mut VirtualMachine) -> bun_jsc::CrateResult<*mut JS
                     // SAFETY: `el` is the live per-thread event loop.
                     unsafe { (*el).tick() };
                     // SAFETY: per fn contract — `vm` is the live per-thread VM.
-                    let pip = unsafe { &*vm }.pending_internal_promise.unwrap_or(promise);
+                    let pip = unsafe { &*vm }
+                        .pending_internal_promise()
+                        .unwrap_or(promise);
                     // SAFETY: `pip` is a live JSC heap cell (see above).
                     if unsafe { &*pip }.status() == PromiseStatus::Pending {
                         // SAFETY: per fn contract — short-lived `&mut *vm` for the
```

**File**: `test/cli/hot/hot.test.ts` (modified, +100/-0)
```diff
@@ -828,3 +828,103 @@ it(
   },
   timeout,
 );
+
+it("holds the promise of the entry point itself, which it looks at on every tick", async () => {
+  const source = (comment: string) => `
+    globalThis.loads = (globalThis.loads ?? 0) + 1;
+    const load = globalThis.loads;
+    setTimeout(() => {
+      Bun.gc(true);
+      const { nodes, nodeClassNames, edges } = require("bun:jsc").generateHeapSnapshotForDebugging();
+      const className = new Map();
+      for (let i = 0; i < nodes.length; i += 7) className.set(nodes[i], nodeClassNames[nodes[i + 2]]);
+      let held = 0;
+      for (let i = 0; i < edges.length; i += 4)
+        if (className.get(edges[i]) === "StrongRootBlock" && className.get(edges[i + 1]) === "Promise") held++;
+      console.log("load " + load + ": " + held + " held");
+    }, 0);
+    // ${comment}
+  `;
+  using dir = tempDir("hot-entry-promise", { "main.js": source("first") });
+  await using runner = spawn({
+    cmd: [bunExe(), "--hot", "--no-clear-screen", "main.js"],
+    env: bunEnv,
+    cwd: String(dir),
+    stdout: "pipe",
+    stderr: "inherit",
+    stdin: "ignore",
+  });
+  const reader = runner.stdout.getReader();
+  let stdout = "";
+  const line = async (prefix: string) => {
+    for (;;) {
+      const found = stdout
+        .split("\n")
+        .slice(0, -1)
+        .find(line => line.startsWith(prefix));
+      if (found) return found;
+      const { value, done } = await reader.read();
+      if (done) return stdout;
+      stdout += Buffer.from(value).toString();
+    }
+  };
+  expect(await line("load 1:")).toBe("load 1: 1 held");
+  writeFileSync(join(String(dir), "main.js"), source("second"));
+  expect(await line("load 2:")).toBe("load 2: 1 held");
+});
+
+// The cell of a collected promise goes to the next promise that is made.
+it.each([
+  ["pending", `new Promise(() => {})`],
+  ["rejected and handled", `Promise.reject(new Error("not the entry point's"))`],
+])("does not take a promise of the program's, %s, for that of the entry point", async (_, promise) => {
+  using dir = tempDir("hot-entry-promise-reused", { "main.js": `console.log("first load");` });
+  await using runner = spawn({
+    cmd: [bunExe(), "--hot", "--no-clear-screen", "main.js"],
+    env: bunEnv,
+    cwd: String(dir),
+    stdout: "pipe",
+    stderr: "pipe",
+    stdin: "ignore",
+  });
+  const reader = runner.stdout.getReader();
+  let stdout = "";
+  const line = async (expected: string) => {
+    while (!stdout.split("\n").slice(0, -1).includes(expected)) {
+      const { value, done } = await reader.read();
+      if (done) break;
+      stdout += Buffer.from(value).toString();
+    }
+  };
+  await line("first load");
+  // What is left on the stack can keep it alive, and differs with where a collection starts from.
+  writeFileSync(
+    join(String(dir), "main.js"),
+    `
+      globalThis.kept = [];
+      require("fs").readFile(__filename, () => {
+        Bun.gc(true);
+        setImmediate(() => {
+          Bun.gc(true);
+          require("crypto").randomBytes(8, () => {
+            Bun.gc(true);
+            for (let i = 0; i < 20000; i++) {
+              const promise = ${promise};
+              promise.catch(() => {});
+              kept.push(promise);
+            }
+            console.log("collected");
+          });
+        });
+      });
+    `,
+  );
+  await line("collected");
+  writeFileSync(join(String(dir), "main.js"), `console.log("third load"); process.exit(0);`);
+  await line("third load");
+  const stderr = (await runner.stderr.text()).split("\n").filter(line => line && !line.startsWith("DEBUG: "));
+  expect({ stdout: stdout.split("\n"), stderr }).toEqual({
+    stdout: ["first load", "collected", "third load", ""],
+    stderr: [],
+  });
+});
```

**File**: `test/js/bun/module-graph/module-graph-isolation.test.ts` (modified, +4/-1)
```diff
@@ -1086,6 +1086,9 @@ const dir = String(
     `,
     "response-bodies-of-disposed-graphs.mjs": `
       import { heapStats } from "bun:jsc";
+      const protectedPromises = () => heapStats().protectedObjectTypeCounts.Promise ?? 0;
+      // What the process holds by itself, like the promise of this entry point.
+      const before = protectedPromises();
       // A body that never ends: a chunk per pull, the next one when the host says so.
       let release = () => {};
       const server = Bun.serve({ port: 0, fetch: request => new URL(request.url).pathname === "/turn" ? new Response("turn") : new Response(new ReadableStream({ async pull(controller) { controller.enqueue(new Uint8Array(1024)); await new Promise(resolve => (release = resolve)); } })) });
@@ -1109,7 +1112,7 @@ const dir = String(
       }
       await hostTurn();
       Bun.gc(true);
-      console.log(JSON.stringify({ text: Bun.peek.status(text), protectedPromises: heapStats().protectedObjectTypeCounts.Promise ?? 0 }));
+      console.log(JSON.stringify({ text: Bun.peek.status(text), protectedPromises: protectedPromises() - before }));
       process.exit(0);
     `,
     "errors-of-a-graph-made-by-a-graph.mjs": `
```

**File**: `test/js/web/timers/timer-gc-roots.test.ts` (modified, +3/-1)
```diff
@@ -28,6 +28,8 @@ describe.concurrent("Strong handles are backed by StrongRootBlock", () => {
       const { heapStats } = require("bun:jsc");
       const N = 5000;
       const h = [];
+      // What the process holds by itself, like the promise of this entry point.
+      const before = heapStats().objectTypeCounts.StrongRootBlock || 0;
       for (let i = 0; i < N; i++) h.push(setTimeout(() => {}, 600000));
       Bun.gc(true);
       const armed = heapStats();
@@ -41,7 +43,7 @@ describe.concurrent("Strong handles are backed by StrongRootBlock", () => {
         armedTimeout: armed.protectedObjectTypeCounts.Timeout || 0,
         armedBlocks: armed.objectTypeCounts.StrongRootBlock || 0,
         clearedTimeout: cleared.protectedObjectTypeCounts.Timeout || 0,
-        clearedBlocks: cleared.objectTypeCounts.StrongRootBlock || 0,
+        clearedBlocks: (cleared.objectTypeCounts.StrongRootBlock || 0) - before,
       }));
       process.exit(0);
     `;
```

---

### Incident Patch 13: `9d9fdbe8` (2026-10-01)
**Commit Message**: React Fast Refresh: fix a panic and invalid output for a hook call in a method (#44345)

### What does this PR do?

Fixes `panic: internal error: entered unreachable code` in the dev
server and in `bun build --react-fast-refresh`, and two kinds of wrong
output next to it.

```tsx
// app.tsx, in a project that has react installed
export class C {
  m() { return useThing(); }
}
```

Serving a page that imports this ends the dev server process. It takes a
`.tsx` file, Fast Refresh, and a call to anything named `use[A-Z]...` in
a method, getter, setter or constructor. No decorator and no tsconfig is
involved. `app.useGlobalPipes()` is such a call.

**Cause**

A function expression with a hook call in it is wrapped in its
signature: `_s(function () { ... }, "hash")`. The function of a method
is a function expression to the visitor too, so it was wrapped as well,
and a method cannot hold a call.

| | before | now |
|---|---|---|
| class statement in `.tsx` | panic: `lower_class` expects the value of
a method to be a function | unchanged method |
| class expression, or any class in `.jsx` (with `react-refresh`
installed) | `class { m: _s(function() { ... }) }`, a syntax error |
unchanged 

**File**: `src/js_parser/visit/mod.rs` (modified, +4/-3)
```diff
@@ -174,11 +174,12 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool> P<'a, TYPESCRIPT, SCAN_O
             // `ReactRefresh::hook_ctx_mut` centralises the raw-pointer deref and returns a
             // borrow detached from `self` (the storage is on the caller's stack frame), so
             // it can be held across the `&mut self` method call below.
-            let hook_ctx = self
+            // There is no storage for a method, which takes no signature.
+            if let Some(hook) = self
                 .react_refresh
                 .hook_ctx_mut()
-                .expect("caller did not init hook storage. any function can have react hooks!");
-            if let Some(hook) = hook_ctx.as_ref() {
+                .and_then(|hook_ctx| hook_ctx.as_ref())
+            {
                 // `handle_react_refresh_post_visit_function_body` does not re-enter
                 // `hook_ctx_storage` (it only touches `stmts` and unrelated `P` fields).
                 self.handle_react_refresh_post_visit_function_body(&mut stmts, hook);
```

**File**: `src/js_parser/visit/visit_expr.rs` (modified, +10/-1)
```diff
@@ -2704,7 +2704,16 @@ impl<'a, const TYPESCRIPT: bool, const SCAN_ONLY: bool> P<'a, TYPESCRIPT, SCAN_O
 
         let mut react_hook_data: Option<crate::parser::HookContext> = None;
         let prev_hook_ctx = p.react_refresh.hook_ctx_storage;
-        p.react_refresh.hook_ctx_storage = Some(core::ptr::NonNull::from(&mut react_hook_data));
+        // A method cannot be wrapped in a call. Like react-refresh/babel, ignore its hook calls.
+        let is_method = e_
+            .func
+            .flags
+            .contains(Flags::Function::IsUniqueFormalParameters);
+        p.react_refresh.hook_ctx_storage = if is_method {
+            None
+        } else {
+            Some(core::ptr::NonNull::from(&mut react_hook_data))
+        };
 
         // For function *expressions* the .function_args scope is pushed at the
         // `function` keyword loc, not at open_parens_loc. (s_function correctly
```

**File**: `test/bundler/bundler_jsx.test.ts` (modified, +93/-0)
```diff
@@ -1362,4 +1362,97 @@ describe("bundler", () => {
       },
     });
   });
+
+  describe.concurrent("a hook call in a method, with React Fast Refresh", () => {
+    const prelude = /* js */ `
+      globalThis.$RefreshSig$ = () => fn => fn;
+      globalThis.$RefreshReg$ = () => {};
+      function useThing() { return 1; }
+    `;
+    const signatures = (file: string) =>
+      file.match(/(\$RefreshSig\$|createSignatureFunctionForTransform)\(\)/g)?.length ?? 0;
+
+    for (const ext of ["tsx", "jsx"]) {
+      itBundled(`jsx/FastRefreshClassStatementMethods.${ext}`, {
+        files: {
+          [`/index.${ext}`]: /* js */ `
+            ${prelude}
+            class C {
+              constructor() { this.c = useThing(); }
+              m() { return useThing(); }
+              get g() { return useThing(); }
+              set s(v) { this.v = v + useThing(); }
+              static t() { return useThing(); }
+              #p() { return useThing(); }
+              p() { return this.#p(); }
+            }
+            const c = new C();
+            c.s = 1;
+            console.log(c.c, c.m(), c.g, c.v, C.t(), c.p());
+          `,
+        },
+        backend: "cli",
+        reactFastRefresh: true,
+        onAfterBundle(api) {
+          expect(signatures(api.readFile("out.js"))).toBe(0);
+        },
+        run: { stdout: "1 1 1 2 1 1" },
+      });
+
+      itBundled(`jsx/FastRefreshClassExpressionMethod.${ext}`, {
+        files: {
+          [`/index.${ext}`]: /* js */ `
+            ${prelude}
+            const C = class { m() { return useThing(); } };
+            console.log(new C().m());
+          `,
+        },
+        backend: "cli",
+        reactFastRefresh: true,
+        onAfterBundle(api) {
+          expect(signatures(api.readFile("out.js"))).toBe(0);
+        },
+        run: { stdout: "1" },
+      });
+
+      itBundled(`jsx/FastRefreshObjectMethodKeepsSuper.${ext}`, {
+        files: {
+          [`/index.${ext}`]: /* js */ `
+            ${prelude}
+            const o = { __proto__: { m() { return 1; } }, m() { return super.m() + useThing(); } };
+            console.log(o.m());
+          `,
+        },
+        backend: "cli",
+        reactFastRefresh: true,
+        onAfterBundle(api) {
+          expect(signatures(api.readFile("out.js"))).toBe(0);
+        },
+        run: { stdout: "2" },
+      });
+    }
+
+    // The call in the method counts for neither function. The one in the function inside it does.
+    itBundled("jsx/FastRefreshFunctionsAroundAndInsideAMethod", {
+      files: {
+        "/index.tsx": /* js */ `
+          ${prelude}
+          function Around() {
+            return { m() { useThing(); return function Inside() { return useThing(); }; } };
+          }
+          console.log(Around().m()());
+        `,
+        "/node_modules/react-refresh/runtime.js": /* js */ `
+          export const createSignatureFunctionForTransform = () => fn => fn;
+          export const register = () => {};
+        `,
+      },
+      backend: "api",
+      reactFastRefresh: true,
+      onAfterBundle(api) {
+        expect(signatures(api.readFile("out.js"))).toBe(1);
+      },
+      run: { stdout: "1" },
+    });
+  });
 });
```

**File**: `test/bundler/expectBundled.ts` (modified, +7/-0)
```diff
@@ -269,6 +269,7 @@ export interface BundlerTestInput {
   foldChunks?: boolean;
   serverComponents?: boolean;
   reactCompiler?: boolean;
+  reactFastRefresh?: boolean;
   reactCompilerOutputMode?: "client" | "ssr";
   treeShaking?: boolean;
   unsupportedCSSFeatures?: string[];
@@ -538,6 +539,7 @@ function expectBundled(
     runtimeFiles,
     serverComponents = false,
     reactCompiler = false,
+    reactFastRefresh = false,
     reactCompilerOutputMode,
     skipOnEsbuild,
     snapshotSourceMap,
@@ -699,6 +701,9 @@ function expectBundled(
   if (ESBUILD && allowUnresolved !== undefined) {
     throw new UnsupportedOptionError("allowUnresolved not possible in esbuild backend");
   }
+  if (ESBUILD && reactFastRefresh) {
+    throw new UnsupportedOptionError("reactFastRefresh not possible in esbuild backend");
+  }
   if (dryRun) {
     return testRef(id, opts);
   }
@@ -894,6 +899,7 @@ function expectBundled(
               minChunkSize !== undefined && `--min-chunk-size=${minChunkSize}`,
               serverComponents && "--server-components",
               reactCompiler && "--react-compiler",
+              reactFastRefresh && "--react-fast-refresh",
               outbase && `--root=${outbase}`,
               banner && `--banner="${banner}"`, // TODO: --banner-css=*
               footer && `--footer="${footer}"`,
@@ -1269,6 +1275,7 @@ function expectBundled(
           target,
           reactCompiler,
           reactCompilerOutputMode,
+          reactFastRefresh,
           bytecode,
           bytecodeDepth,
           publicPath,
```

---

### Incident Patch 14: `95690fc5` (2026-10-01)
**Commit Message**: FileSystemRouter: fix a panic and wrong route names for an absolute dir with '..' in it (#44342)

### What does this PR do?

Fixes `panic: range start index 123 out of range for slice of length
119` in `new Bun.FileSystemRouter()` (`RouteLoader::load`, Sentry
BUN-564Q and BUN-54X5, 7 reports on 1.4.2), and the wrong route names
the same bug gives when it does not panic.

**Trigger**

An absolute `dir` with `..` in it, which is what `import.meta.dir +
"/../pages"` is:

```ts
new Bun.FileSystemRouter({ dir: "/app/other/../pages", style: "nextjs" });
```

| file | route on canary `7fe13e1b9` | expected |
|---|---|---|
| `pages/index.tsx` | `/` | `/` |
| `pages/api/x.tsx` | panic | `/api/x` |
| `pages/a-long-directory-name/deeper/page.tsx` |
`/ng-directory-name/deeper/page` | `/a-long-directory-name/deeper/page`
|

**Cause**

A route is named by what follows the router's directory in the directory
of its file: `&entry_dir[base_dir.len() - 1..]`. The router enters each
subdirectory by a normalized path, so that is how the directory of a
nested file is spelled.

The constructor normalized a relative `dir`, by joining it to the
working directory. An absolute `dir` was used as written, wit

**File**: `src/runtime/api/filesystem_router.rs` (modified, +13/-12)
```diff
@@ -146,20 +146,21 @@ impl FileSystemRouter {
             }
             let root_dir_path_ = dir.to_utf8(global_this)?;
             if !(root_dir_path_.slice().is_empty() || root_dir_path_.slice() == b".") {
-                // resolve relative path if needed
-                let path_ = root_dir_path_.slice();
-                if path::Platform::AUTO.is_absolute(path_) {
-                    root_dir_path = root_dir_path_;
-                } else {
-                    let parts: [&[u8]; 1] = [path_];
-                    root_dir_path = Utf8Bytes::Borrowed(path::resolve_path::join_abs_string_buf::<
-                        path::platform::Auto,
-                    >(
+                // An absolute path is normalized too: a route is named by what follows this
+                // path in the resolver's spelling of its directory, which is normalized.
+                let Some(joined) =
+                    path::resolve_path::join_abs_string_buf_checked::<path::platform::Auto>(
                         Fs::FileSystem::instance().top_level_dir,
                         &mut out_buf,
-                        &parts,
-                    ));
-                }
+                        &[root_dir_path_.slice()],
+                    )
+                else {
+                    return Err(global_this.throw(format_args!(
+                        "Unable to find directory: {}",
+                        bstr::BStr::new(root_dir_path_.slice())
+                    )));
+                };
+                root_dir_path = Utf8Bytes::Borrowed(joined);
             }
         } else {
             // dir is not optional
```

**File**: `test/js/bun/util/filesystem_router.test.ts` (modified, +30/-0)
```diff
@@ -1068,3 +1068,33 @@ it.skipIf(isWindows || isMacOS)(
     expect(exitCode).toBe(0);
   },
 );
+
+it("an absolute dir with '..' in it names routes like its normalized spelling", async () => {
+  const { dir } = make([
+    `pages/index.tsx`,
+    `pages/api/x.tsx`,
+    `pages/a-long-directory-name/deeper/page.tsx`,
+    `other/keep.tsx`,
+  ]);
+  await using proc = Bun.spawn({
+    cmd: [
+      bunExe(),
+      "-e",
+      `
+      const routes = dir => Object.keys(new Bun.FileSystemRouter({ dir, style: "nextjs" }).routes).sort();
+      console.log(JSON.stringify([routes(process.argv[1] + "/pages"), routes(process.argv[1] + "/other/../pages")]));
+      `,
+      dir,
+    ],
+    env: bunEnv,
+    stdout: "pipe",
+    stderr: "pipe",
+  });
+  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+  const routes = ["/", "/a-long-directory-name/deeper/page", "/api/x"];
+  expect({ stdout, stderr, exitCode }).toEqual({
+    stdout: JSON.stringify([routes, routes]) + "\n",
+    stderr: "",
+    exitCode: 0,
+  });
+});
```

---

### Incident Patch 15: `2e677eff` (2026-10-01)
**Commit Message**: dev server: fix an index out of bounds panic when a file with an unresolved import is imported twice (#44340)

### What does this PR do?

Fixes `panic: index out of bounds: the len is 0 but the index is 0` in
the dev server (`DevServer::is_file_cached`, Sentry BUN-4QTH and
BUN-54KE, 16 reports on 1.4.2 and later).

**Trigger**

An HTML route whose first bundle has a file with an import that does not
resolve, and a second file that imports that file:

```ts
// entry.ts
import "./broken";
import "./other";
// broken.ts
import "not-installed-pkg";
export const value = 1;
// other.ts (a hop or two further down)
import { value } from "./broken";
```

**Cause**

Every file in `IncrementalGraph::bundled_files` is meant to have a bit
in `stale_files`. `insert_empty` and `insert_failure` grow the bit set
when they add a file. `insert_stale_extra` did not: it set the bit only
if the set happened to be long enough already, and left growing it to
its callers.

`get_log_for_resolution_failures` calls it in the middle of a bundle,
for the file whose import failed. With only HTML routes the bit set is
still empty during the first bundle, so when the bundler then resolves
another import of that fi

**File**: `src/runtime/bake/dev_server/incremental_graph.rs` (modified, +2/-3)
```diff
@@ -1320,9 +1320,8 @@ impl<const SIDE: bake::Side> IncrementalGraph<SIDE> {
         if !found_existing {
             self.edge_lists.push(EdgeLists::default());
         }
-        if self.stale_files.bit_length > idx {
-            self.stale_files.set(idx);
-        }
+        self.ensure_stale_bit_capacity(true)?;
+        self.stale_files.set(idx);
 
         match SIDE {
             Side::Client => {
```

**File**: `test/bake/dev/html.test.ts` (modified, +35/-0)
```diff
@@ -154,6 +154,41 @@ devTest("import then create", {
     await c.expectMessage("data");
   },
 });
+devTest("a file whose import failed to resolve is imported by a second file", {
+  files: {
+    "index.html": emptyHtmlFile({
+      scripts: ["/entry.ts"],
+    }),
+    "entry.ts": `
+      import "./broken";
+      import "./first";
+    `,
+    "broken.ts": `
+      import "not-installed-pkg";
+      export const value = "value";
+    `,
+    // broken.ts has failed by the time the bundler gets to its second importer.
+    "first.ts": `
+      import "./second";
+    `,
+    "second.ts": `
+      import "./third";
+    `,
+    "third.ts": `
+      import { value } from "./broken";
+      console.log(value);
+    `,
+  },
+  async test(dev) {
+    const c = await dev.client("/", {
+      errors: ['broken.ts:1:8: error: Could not resolve: "not-installed-pkg". Maybe you need to "bun install"?'],
+    });
+    await c.expectReload(async () => {
+      await dev.write("broken.ts", `export const value = "value";`);
+    });
+    await c.expectMessage("value");
+  },
+});
 devTest("external links", {
   files: {
     "index.html": `
```

#### Recent Merged Pull Requests:
- **PR #44665** (2026-10-07): `bun check`: fix differences from `tsc` (@Jarred-Sumner)
- **PR #44615** (2026-10-06): Upgrade WebKit to dbdca7545d (@sosukesuzuki)
- **PR #44581** (2026-10-05): spawnSync: stop pointing the VM at the loop it waits on (@Jarred-Sumner)
- **PR #44575** (2026-10-04): Bump mimalloc: upstream v3.5.3 (@Jarred-Sumner)
- **PR #44564** (2026-10-04): Bump WebKit: return free memory sooner (@Jarred-Sumner)
- **PR #44560** (2026-10-04): Bump mimalloc: faster heaps, less purge churn; release memory during Bun.sleepSync (@Jarred-Sumner)
- **PR #44529** (closed): tls: queue unsent ciphertext per connection so write() counts every sealed record (@robobun)
- **PR #44524** (2026-10-03): Bound a served device slice when the kernel refuses to poll it (@robobun)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
