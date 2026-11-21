> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/oven-sh-bun-learnings.md`  
> **Source**: github ([https://github.com/oven-sh/bun](https://github.com/oven-sh/bun))  
> **Source Version**: `98eae327`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T03:15:31.209Z  
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
> **Harvest Timestamp**: 2026-11-21T03:15:31.011Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oven-sh/bun`
- **Description**: Incredibly fast JavaScript runtime, bundler, test runner, and package manager – all in one
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 96812 stars

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
- **Issue #49355** (2026-11-20): **`S3Client.presign(method: "HEAD")` produces URLs that Cloudflare R2 rejects with 403 AccessDenied; GET presigns work**
  *Symptoms*: ### What version of Bun is running?  Bun 1.4.5  ### What platform is your computer?  Linux 6.12.86+deb13-amd64 x86_64 unknown  ### What steps can reproduce the bug?  When using with Cloudflare R2 storage. Bug report mostly written mostly by GLM 5.3.  Repro:   ```ts    import { S3Client } from "bun";     const client = new Bun.S3Client({      bucket: "my-bucket",      endpoint: "https://<account-hash>.r2.cloudflarestorage.com",      region: "auto",      accessKeyId: process.env.ACCESS_KEY_ID!,      secretAccessKey: process.env.SECRET_ACCESS_KEY!,    });     const key = "some/existing-object.txt";    await client.write(key, "hello world"); // works     // GET presign: works    const getUrl = client.presign(key, { method: "GET", expiresIn: 60 });    console.log("GET presign:", (await fetch(getUrl)).status); // 200     // HEAD presign: rejected    const headUrl = client.presign(key, { method: "HEAD", expiresIn: 60 });    console.log("HEAD presign:", (await fetch(headUrl, { method: "HEAD" })).status); // 403 AccessDenied  ```  ### What is the expected behavior?  ## Expected  SigV4 supports presigned HEAD requests; the presigned HEAD URL should be accepted by S3-compatible stores. (AWS S3 and most SigV4 implementations sign  X-Amz-SignedHeaders=host for HEAD the same as GET, so if the GET presign is accepted the HEAD presign should be too.)  ### What do you see instead?  ## Observed  - `presign(key, {method: "HEAD"})` → fetch returns 403 AccessDenied from R2, for both existing and 

- **Issue #49297** (2026-11-19): **bun fmt: without semicolons a Vue inline handler with several statements no longer compiles**
  *Symptoms*: ### What version of Bun is running?  1.4.5 (also 1.4.4)  ### What platform is your computer?  Darwin arm64  ### What steps can reproduce the bug?  `T.vue`:  ```vue <template>   <button @click="customRange = null; timeMenuOpen = false">x</button> </template> ```  ```sh bun fmt --no-config --no-semi T.vue ```  The same happens with `"semi": false` in `.prettierrc`.  ### What is the expected behavior?  The `;` between the statements of the handler stays, as it does with semicolons on:  ```vue <template>   <button     @click="       customRange = null;       timeMenuOpen = false;     "   >     x   </button> </template> ```  ### What do you see instead?  ```vue <template>   <button     @click="       customRange = null       timeMenuOpen = false     "   >     x   </button> </template> ```  This template no longer compiles. `@vue/compiler-dom` 3.5:  ``` Error parsing JavaScript expression: Unexpected token, expected "," ```  ### Additional information  Vue does not apply ASI to an inline handler. Its compiler takes a handler for several statements only when the text contains a `;` (the `v-on` transform of `compiler-core`); otherwise it wraps the text in parentheses and parses it as one expression. Statements separated by a line break alone were reported in vuejs/core#8854, which was closed as not planned, so the `;` is required syntax there whatever the JavaScript style is.  Prettier 2.8.8 and 3.10.1 print the same broken handler, so this matches Prettier byte for byte, but the out

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

### Incident Patch 1: `74d8f30d` (2026-11-21)
**Commit Message**: blob: three fixes to how a job waits for a descriptor (#49337)

### What does this PR do?

Three fixes, about 50 lines in `src`. #49352 kept these bugs on purpose.
Three tests are for the fixes, the others pin what main does today.

| | before | after |
| --- | --- | --- |
| Linux: script closes a descriptor during a wait, a duplicate stays
open, the job is cancelled | use-after-free when the pipe gets ready |
epoll holds a ticket, and a stale one is ignored |
| one `EAGAIN` from a regular file | spins for ever without calling
`read()` again | `read()` is called again, or the job waits if `poll`
says not ready |
| Linux: a job has waited and every other pool thread is busy | pending
until one is free | ends on its thread, as on kqueue |

The third row removes a trip through the IO thread. Linux x64 release,
medians of 18 runs. The control is a copy of main.

| | 1.4.5 | main | control | this PR |
| --- | --- | --- | --- | --- |
| one read wakes, 6 CPUs, µs | 42.2 | 46.0 | 44.2 | 41.8 |
| same, 1 CPU | 31.4 | 31.6 | 31.6 | 21.7 |
| one write wakes, 6 CPUs, µs | 49.5 | 54.1 | 52.2 | 49.8 |
| **1,000 reads wake together, 6 CPUs, ms** | 3.46 | 3.31 | 3.22 |
**3.52** |
| same, 1 CPU | 3

**File**: `src/io/lib.rs` (modified, +42/-38)
```diff
@@ -477,7 +477,7 @@ impl IoRequestLoop {
             let epoll_fd = sys::File::from_fd(Fd::from_native(raw));
 
             {
-                // No data: `tick_epoll` skips an event without a `Poll`.
+                // No data: no `Poll` has the ticket 0.
                 let mut epoll: linux::epoll_event = bun_core::ffi::zeroed();
                 epoll.events =
                     linux::EPOLL_IN | linux::EPOLL_ET | linux::EPOLL_ERR | linux::EPOLL_HUP;
@@ -613,6 +613,7 @@ impl IoRequestLoop {
 
     #[cfg(any(target_os = "linux", target_os = "android"))]
     pub(crate) fn tick_epoll(&self) {
+        let mut tickets = Tickets::default();
         loop {
             // Process pending requests
             {
@@ -632,6 +633,7 @@ impl IoRequestLoop {
                             match readable.poll.register_for_epoll(
                                 Flags::PollReadable,
                                 readable.tag,
+                                &mut tickets,
                                 watcher_fd,
                                 true,
                                 readable.fd,
@@ -646,6 +648,7 @@ impl IoRequestLoop {
                             match writable.poll.register_for_epoll(
                                 Flags::PollWritable,
                                 writable.tag,
+                                &mut tickets,
                                 watcher_fd,
                                 true,
                                 writable.fd,
@@ -662,12 +665,8 @@ impl IoRequestLoop {
                                 close.fd,
                                 close.poll.flags.contains(Flags::Registered)
                             );
-                            // Only remove from the interest list if it was previously registered.
-                            // Otherwise, epoll gets confused.
-                            // This state can happen if polling for readable/writable previously failed.
-                            if close.poll.flags.contains(Flags::WasEverRegistered) {
-                                close.poll.unregister_with_fd(watcher_fd, close.fd);
-                            }
+                            close.poll.unregister(close.fd);
+                            tickets.armed.remove(&close.poll.ticket);
                             (close.on_done)(close.ctx);
                         }
                     }
@@ -700,12 +699,10 @@ impl IoRequestLoop {
             }
 
             for event in current_events {
-                let pollable = Pollable::from(event.u64);
-                // Null for the waker, which is edge-triggered: no need to read its counter.
-                let Some(poll) = core::ptr::NonNull::new(pollable.poll()) else {
-                    continue;
-                };
-                Poll::on_update_epoll(poll, pollable.tag(), *event);
+                // None for the waker too, which is edge-triggered: no need to read its counter.
+                if let Some((poll, tag)) = tickets.armed.remove(&{ event.u64 }) {
+                    Poll::on_update_epoll(poll, tag, *event);
+                }
             }
         }
     }
@@ -844,22 +841,6 @@ impl Request {
             scheduled: false,
         }
     }
-
-    /// Atomic-ordered store of `callback`.
-    ///
-    /// The io thread reads `callback` after popping `self` from the MPSC
-    /// queue (which already provides acquire on `next`); this SeqCst fence
-    /// guarantees the callback write is visible to that read even when the
-    /// store happens on a different thread than the one that scheduled the
-    /// request. Rust has no `AtomicFnPtr`, so we lower to a volatile write
-    /// followed by a full fence.
-    #[inline]
-    pub fn store_callback_seq_cst(&mut self, cb: for<'a> fn(&'a mut Request) -> Action<'a>) {
-        // SAFETY: `callback` is a plain pointer-sized field on `self`;
-        // volatile write prevents the compiler from reordering or eliding it.
-        unsafe { core::ptr::write_volatile(&raw mut self.callback, cb) };
-        core::sync::atomic::fence(Ordering::SeqCst);
-    }
 }
 
 /// For types that embed an intrusive `io_request: uv::fs_t` and recover the parent in
@@ -960,20 +941,20 @@ pub enum PollableTag {
 
 /// §Dispatch (PORTING.md): `bun.ptr.TaggedPointer` should normally be split
 /// into `(tag: u8, ptr: *mut ())`. Here the value must round-trip through a
-/// single `u64` (`epoll_event.data.u64` / `kevent.udata`), so we keep the
+/// single `u64` (`kevent.udata`), so we keep the
 /// packed addr:49 + tag:15 layout locally.
-#[cfg(not(windows))]
+#[cfg(any(target_os = "macos", target_os = "freebsd"))]
 #[derive(Clone, Copy)]
 struct Pollable {
     value: u64,
 }
 
-#[cfg(not(windows))]
+#[cfg(any(target_os = "macos", target_os = "freebsd"))]
 const POLLABLE_ADDR_BITS: u64 = 49;
-#[cfg(not(windows))]
+#[cfg(any(target_os = "macos", target_os = "freebsd"))]
 const POLLABLE_ADDR_MASK: u64 = (1u64 << POLLABLE_ADDR_BITS) - 1;
 
-
```

**File**: `src/runtime/webcore/blob/fd_job.rs` (modified, +3/-16)
```diff
@@ -81,8 +81,6 @@ pub(crate) struct FdJob<Op: FdOp> {
     pub(crate) io_poll: io::Poll,
     io_request: io::Request,
     io_parking: IoParking,
-    /// epoll keeps a one-shot entry that has fired, and only the IO thread removes it.
-    close_after_io: bool,
 }
 
 impl<Op: FdOp> JobContext for FdJob<Op> {
@@ -133,7 +131,6 @@ impl<Op: FdOp> FdJob<Op> {
             io_poll: io::Poll::default(),
             io_request: io::Request::new(Self::watch),
             io_parking: IoParking::new(),
-            close_after_io: false,
         };
         Job::<Self>::schedule(cx, job, js);
     }
@@ -152,26 +149,22 @@ impl<Op: FdOp> FdJob<Op> {
             },
             Err(err) => Err(err),
         };
-        if self.close_after_io {
-            self.io_request.store_callback_seq_cst(Self::unwatch);
-            IoRequestLoop::schedule(&mut self.io_request);
-        } else {
-            self.finish();
-        }
+        self.finish();
     }
 
     fn park(&mut self) -> bun_sys::Result<()> {
         IoRequestLoop::ensure_init()?;
         if !self.io_parking.park() {
             return Err(Op::INTEREST.cancelled());
         }
-        self.close_after_io = !bun_core::Environment::IS_KQUEUE;
         IoRequestLoop::schedule(&mut self.io_request);
         Ok(())
     }
 
     fn finish(&mut self) {
         if let Some((fd, done)) = self.open.take() {
+            #[cfg(any(target_os = "linux", target_os = "android"))]
+            self.io_poll.unregister(fd.get());
             drop(fd);
             done.finish();
         }
@@ -199,12 +192,6 @@ impl<Op: FdOp> FdJob<Op> {
         }
     }
 
-    /// IO thread.
-    fn unwatch(request: &mut io::Request) -> io::Action<'_> {
-        // SAFETY: as `watch`.
-        unsafe { (*from_field_ptr!(Self, io_request, &raw mut *request)).close_action() }
-    }
-
     fn close_action(&mut self) -> io::Action<'_> {
         io::Action::Close(io::CloseAction {
             // SAFETY: the `ctx` below.
```

**File**: `src/runtime/webcore/blob/read_file.rs` (modified, +1/-5)
```diff
@@ -289,11 +289,7 @@ impl FdOp for ReadFile {
                     err.path = self.path_for_error();
                     return Err(err);
                 }
-                Err(_) if self.could_block => {}
-                // Never ends: https://github.com/oven-sh/bun/pull/49337
-                Err(_) => loop {
-                    core::hint::spin_loop();
-                },
+                Err(_) => self.could_block = true,
             }
         }
         if self.buffer.len() + 16_000 < self.buffer.capacity() {
```

**File**: `test/js/bun/http/serve-file-slice-read-error.test.ts` (modified, +12/-171)
```diff
@@ -12,178 +12,11 @@
 // (rustix linux_raw backend), so LD_PRELOAD cannot intercept it.
 import { afterAll, beforeAll, expect, test } from "bun:test";
 import { bunEnv, bunExe, isLinux, tempDir } from "harness";
+import { constants } from "node:os";
 import { join } from "node:path";
 
 const cc = Bun.which("cc") || Bun.which("gcc") || Bun.which("clang");
 
-// Usage: fail-nth-read <path> <n> -- <cmd> [args...]
-// Makes the <n>th read() syscall whose fd refers to <path> return -EIO.
-const SUPERVISOR_C = /* c */ `
-#define _GNU_SOURCE
-#include <errno.h>
-#include <signal.h>
-#include <stdio.h>
-#include <stdlib.h>
-#include <string.h>
-#include <sys/ptrace.h>
-#include <sys/stat.h>
-#include <sys/types.h>
-#include <sys/user.h>
-#include <sys/wait.h>
-#include <unistd.h>
-
-#if defined(__aarch64__)
-  #include <linux/elf.h>
-  #include <sys/uio.h>
-#endif
-
-#if defined(__x86_64__)
-  #define SYS_READ_NR 0
-  typedef struct user_regs_struct regs_t;
-  static long reg_nr(regs_t *r) { return (long)r->orig_rax; }
-  static long reg_arg0(regs_t *r) { return (long)r->rdi; }
-  static void reg_set_ret(regs_t *r, long v) { r->rax = (unsigned long long)v; }
-  static int get_regs(pid_t t, regs_t *r) { return ptrace(PTRACE_GETREGS, t, 0, r); }
-  static int set_regs(pid_t t, regs_t *r) { return ptrace(PTRACE_SETREGS, t, 0, r); }
-#elif defined(__aarch64__)
-  #define SYS_READ_NR 63
-  typedef struct user_regs_struct regs_t;
-  static long reg_nr(regs_t *r) { return (long)r->regs[8]; }
-  static long reg_arg0(regs_t *r) { return (long)r->regs[0]; }
-  static void reg_set_ret(regs_t *r, long v) { r->regs[0] = (unsigned long long)v; }
-  static int get_regs(pid_t t, regs_t *r) {
-    struct iovec io = { r, sizeof(*r) };
-    return ptrace(PTRACE_GETREGSET, t, (void *)NT_PRSTATUS, &io);
-  }
-  static int set_regs(pid_t t, regs_t *r) {
-    struct iovec io = { r, sizeof(*r) };
-    return ptrace(PTRACE_SETREGSET, t, (void *)NT_PRSTATUS, &io);
-  }
-#else
-  #error unsupported arch
-#endif
-
-/* Per-tid syscall enter/exit toggle + pending-poison flag. */
-#define MAX_TIDS 256
-static pid_t tid_tab[MAX_TIDS];
-static unsigned char in_call[MAX_TIDS];
-static unsigned char poison[MAX_TIDS];
-static int slot(pid_t t) {
-  int i, free_i = -1;
-  for (i = 0; i < MAX_TIDS; i++) {
-    if (tid_tab[i] == t) return i;
-    if (tid_tab[i] == 0 && free_i < 0) free_i = i;
-  }
-  if (free_i >= 0) { tid_tab[free_i] = t; return free_i; }
-  return 0;
-}
-static void drop(pid_t t) {
-  int i;
-  for (i = 0; i < MAX_TIDS; i++) if (tid_tab[i] == t) {
-    tid_tab[i] = 0; in_call[i] = 0; poison[i] = 0;
-  }
-}
-
-int main(int argc, char **argv) {
-  if (argc < 5 || strcmp(argv[3], "--") != 0) {
-    fprintf(stderr, "usage: %s <path> <n> -- <cmd> [args...]\\n", argv[0]);
-    return 2;
-  }
-  const char *target_path = argv[1];
-  long fail_n = strtol(argv[2], NULL, 10);
-  char **cmd = &argv[4];
-
-  struct stat ts;
-  if (stat(target_path, &ts) != 0) { perror("stat target"); return 2; }
-
-  pid_t child = fork();
-  if (child < 0) { perror("fork"); return 2; }
-  if (child == 0) {
-    if (ptrace(PTRACE_TRACEME, 0, 0, 0) != 0) { perror("TRACEME"); _exit(126); }
-    raise(SIGSTOP);
-    execvp(cmd[0], cmd);
-    perror("execvp");
-    _exit(127);
-  }
-
-  int st;
-  if (waitpid(child, &st, 0) < 0) { perror("waitpid initial"); return 2; }
-  long opts = PTRACE_O_TRACESYSGOOD | PTRACE_O_TRACECLONE | PTRACE_O_TRACEFORK |
-              PTRACE_O_TRACEVFORK | PTRACE_O_TRACEEXEC | PTRACE_O_EXITKILL;
-  if (ptrace(PTRACE_SETOPTIONS, child, 0, opts) != 0) { perror("SETOPTIONS"); return 2; }
-  if (ptrace(PTRACE_SYSCALL, child, 0, 0) != 0) { perror("SYSCALL initial"); return 2; }
-
-  long match_count = 0;
-  int exit_code = -1;
-
-  for (;;) {
-    pid_t t = waitpid(-1, &st, __WALL);
-    if (t < 0) {
-      if (errno == ECHILD) break;
-      if (errno == EINTR) continue;
-      perror("waitpid"); return 2;
-    }
-    if (WIFEXITED(st) || WIFSIGNALED(st)) {
-      if (t == child) {
-        exit_code = WIFEXITED(st) ? WEXITSTATUS(st) : 128 + WTERMSIG(st);
-      }
-      drop(t);
-      continue;
-    }
-    if (!WIFSTOPPED(st)) continue;
-
-    int sig = WSTOPSIG(st);
-    unsigned ev = (unsigned)(st >> 16);
-    if (ev == PTRACE_EVENT_CLONE || ev == PTRACE_EVENT_FORK || ev == PTRACE_EVENT_VFORK) {
-      ptrace(PTRACE_SYSCALL, t, 0, 0);
-      continue;
-    }
-    if (ev == PTRACE_EVENT_EXEC) {
-      /* execve's syscall-exit-stop follows; keep the toggle consistent. */
-      in_call[slot(t)] = 1;
-      poison[slot(t)] = 0;
-      ptrace(PTRACE_SYSCALL, t, 0, 0);
-      continue;
-    }
-    if (sig == (SIGTRAP | 0x80)) {
-      int s = slot(t);
-      in_call[s] ^= 1;
-      regs_t r;
-      if (get_regs(t, &r) != 0) { ptrace(PTRACE_SYSCALL, t, 0, 0); continue; }
-
-      if (in_call[s]) { /* syscall entry */
-        if (reg_nr(&r) == SYS_READ_NR) {
-          long fd = reg_arg0(&r);
-          char linkpath[64];
-          struct stat
```

**File**: `test/js/bun/io/bun-write.test.js` (modified, +77/-0)
```diff
@@ -8,16 +8,19 @@ import {
   exampleSite,
   gcTick,
   isASAN,
+  isLinux,
   isMacOS,
   isWindows,
   tempDir,
   withoutAggressiveGC,
 } from "harness";
+import { mkfifo } from "mkfifo";
 import { once } from "node:events";
 import http from "node:http";
 import { finished } from "node:stream/promises";
 import path, { join } from "path";
 import { asyncIterableBodyShapes, settled as settledBody } from "../../web/streams/async-iterable-body-shapes";
+import { drain, fill, openFifo, untilWatched } from "./fifo-helpers";
 
 let i = 0;
 const IS_UV_FS_COPYFILE_DISABLED =
@@ -1798,3 +1801,77 @@ int posix_fadvise(int fd, off_t offset, off_t len, int advice) {
     expect(exitCode).toBe(0);
   });
 });
+
+it.skipIf(isWindows)("Bun.write() goes on each time a pipe has room", async () => {
+  using dir = tempDir("bun-write-pipe", {});
+  using fifo = openFifo(String(dir));
+  const room = fill(fifo.writer);
+  const file = Bun.file(fifo.writer);
+  file.size; // Finds out that it is not a regular file.
+  const write = Bun.write(file, new Blob([Buffer.alloc(8 * room)]));
+  let drained = 0;
+  while (Bun.peek.status(write) === "pending") {
+    await Bun.sleep(1);
+    drained += drain(fifo.reader);
+  }
+  expect(await write).toBe(8 * room);
+  expect(drained + drain(fifo.reader)).toBe(9 * room);
+});
+
+describe.skipIf(!isLinux).concurrent("Bun.write() to a pipe that is full", () => {
+  const data = new Blob([Buffer.alloc(1 << 20, "a")]);
+  /** `.size` makes the file find out that it is not a regular one. */
+  function knownPipe(fd) {
+    const file = Bun.file(fd);
+    file.size;
+    return file;
+  }
+
+  // The capacity of a pipe is fixed on Linux.
+  it("waits for room after the last byte", async () => {
+    using dir = tempDir("bun-write-pipe", {});
+    using fifo = openFifo(String(dir));
+    const room = fill(fifo.writer);
+    drain(fifo.reader);
+    const write = Bun.write(knownPipe(fifo.writer), data.slice(0, room));
+    await untilWatched(fifo.writer);
+    expect(Bun.peek.status(write)).toBe("pending");
+    expect(drain(fifo.reader)).toBe(room);
+    expect(await write).toBe(room);
+  });
+
+  it("waits when the file finds out after the call that it is a pipe", async () => {
+    using dir = tempDir("bun-write-pipe", {});
+    mkfifo(join(String(dir), "hold-1"));
+    mkfifo(join(String(dir), "hold-2"));
+    const script = `
+      import fs from "node:fs";
+      import { drain, fill, openFifo, untilWatched } from ${JSON.stringify(join(import.meta.dir, "fifo-helpers.ts"))};
+
+      // readFile() has a thread of the pool from its open(), which ends the ENXIO, until the writer is closed.
+      async function holdThread(path) {
+        fs.promises.readFile(path);
+        for (;;) {
+          try {
+            return fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK);
+          } catch (error) {
+            if (error.code !== "ENXIO") throw error;
+            await Bun.sleep(1);
+          }
+        }
+      }
+
+      using fifo = openFifo(".");
+      fill(fifo.writer);
+      const held = [await holdThread("hold-1"), await holdThread("hold-2")];
+      const file = Bun.file(fifo.writer);
+      const write = Bun.write(file, new Blob(["a"]));
+      file.size;
+      held.forEach(fd => fs.closeSync(fd));
+      await untilWatched(fifo.writer);
+      drain(fifo.reader);
+      console.log(await write);
+    `;
+    expect(await bunRun(["--cwd", String(dir), "-e", script], { UV_THREADPOOL_SIZE: "2" })).toSpawn("1");
+  });
+});
```

**File**: `test/js/bun/io/fail-nth-read.c` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+// Usage: fail-nth-read <path> <n> <errno> -- <cmd> [args...]
+// Makes the <n>th read() syscall whose fd refers to <path> return -<errno>.
+#define _GNU_SOURCE
+#include <errno.h>
+#include <signal.h>
+#include <stdio.h>
+#include <stdlib.h>
+#include <string.h>
+#include <sys/ptrace.h>
+#include <sys/stat.h>
+#include <sys/types.h>
+#include <sys/user.h>
+#include <sys/wait.h>
+#include <unistd.h>
+
+#if defined(__aarch64__)
+  #include <linux/elf.h>
+  #include <sys/uio.h>
+#endif
+
+#if defined(__x86_64__)
+  #define SYS_READ_NR 0
+  typedef struct user_regs_struct regs_t;
+  static long reg_nr(regs_t *r) { return (long)r->orig_rax; }
+  static long reg_arg0(regs_t *r) { return (long)r->rdi; }
+  static void reg_set_ret(regs_t *r, long v) { r->rax = (unsigned long long)v; }
+  static int get_regs(pid_t t, regs_t *r) { return ptrace(PTRACE_GETREGS, t, 0, r); }
+  static int set_regs(pid_t t, regs_t *r) { return ptrace(PTRACE_SETREGS, t, 0, r); }
+#elif defined(__aarch64__)
+  #define SYS_READ_NR 63
+  typedef struct user_regs_struct regs_t;
+  static long reg_nr(regs_t *r) { return (long)r->regs[8]; }
+  static long reg_arg0(regs_t *r) { return (long)r->regs[0]; }
+  static void reg_set_ret(regs_t *r, long v) { r->regs[0] = (unsigned long long)v; }
+  static int get_regs(pid_t t, regs_t *r) {
+    struct iovec io = { r, sizeof(*r) };
+    return ptrace(PTRACE_GETREGSET, t, (void *)NT_PRSTATUS, &io);
+  }
+  static int set_regs(pid_t t, regs_t *r) {
+    struct iovec io = { r, sizeof(*r) };
+    return ptrace(PTRACE_SETREGSET, t, (void *)NT_PRSTATUS, &io);
+  }
+#else
+  #error unsupported arch
+#endif
+
+/* Per-tid syscall enter/exit toggle + pending-poison flag. */
+#define MAX_TIDS 256
+static pid_t tid_tab[MAX_TIDS];
+static unsigned char in_call[MAX_TIDS];
+static unsigned char poison[MAX_TIDS];
+static int slot(pid_t t) {
+  int i, free_i = -1;
+  for (i = 0; i < MAX_TIDS; i++) {
+    if (tid_tab[i] == t) return i;
+    if (tid_tab[i] == 0 && free_i < 0) free_i = i;
+  }
+  if (free_i >= 0) { tid_tab[free_i] = t; return free_i; }
+  return 0;
+}
+static void drop(pid_t t) {
+  int i;
+  for (i = 0; i < MAX_TIDS; i++) if (tid_tab[i] == t) {
+    tid_tab[i] = 0; in_call[i] = 0; poison[i] = 0;
+  }
+}
+
+int main(int argc, char **argv) {
+  if (argc < 6 || strcmp(argv[4], "--") != 0) {
+    fprintf(stderr, "usage: %s <path> <n> <errno> -- <cmd> [args...]\n", argv[0]);
+    return 2;
+  }
+  const char *target_path = argv[1];
+  long fail_n = strtol(argv[2], NULL, 10);
+  long fail_errno = strtol(argv[3], NULL, 10);
+  char **cmd = &argv[5];
+
+  struct stat ts;
+  if (stat(target_path, &ts) != 0) { perror("stat target"); return 2; }
+
+  pid_t child = fork();
+  if (child < 0) { perror("fork"); return 2; }
+  if (child == 0) {
+    if (ptrace(PTRACE_TRACEME, 0, 0, 0) != 0) { perror("TRACEME"); _exit(126); }
+    raise(SIGSTOP);
+    execvp(cmd[0], cmd);
+    perror("execvp");
+    _exit(127);
+  }
+
+  int st;
+  if (waitpid(child, &st, 0) < 0) { perror("waitpid initial"); return 2; }
+  long opts = PTRACE_O_TRACESYSGOOD | PTRACE_O_TRACECLONE | PTRACE_O_TRACEFORK |
+              PTRACE_O_TRACEVFORK | PTRACE_O_TRACEEXEC | PTRACE_O_EXITKILL;
+  if (ptrace(PTRACE_SETOPTIONS, child, 0, opts) != 0) { perror("SETOPTIONS"); return 2; }
+  if (ptrace(PTRACE_SYSCALL, child, 0, 0) != 0) { perror("SYSCALL initial"); return 2; }
+
+  long match_count = 0;
+  int exit_code = -1;
+
+  for (;;) {
+    pid_t t = waitpid(-1, &st, __WALL);
+    if (t < 0) {
+      if (errno == ECHILD) break;
+      if (errno == EINTR) continue;
+      perror("waitpid"); return 2;
+    }
+    if (WIFEXITED(st) || WIFSIGNALED(st)) {
+      if (t == child) {
+        exit_code = WIFEXITED(st) ? WEXITSTATUS(st) : 128 + WTERMSIG(st);
+      }
+      drop(t);
+      continue;
+    }
+    if (!WIFSTOPPED(st)) continue;
+
+    int sig = WSTOPSIG(st);
+    unsigned ev = (unsigned)(st >> 16);
+    if (ev == PTRACE_EVENT_CLONE || ev == PTRACE_EVENT_FORK || ev == PTRACE_EVENT_VFORK) {
+      ptrace(PTRACE_SYSCALL, t, 0, 0);
+      continue;
+    }
+    if (ev == PTRACE_EVENT_EXEC) {
+      /* execve's syscall-exit-stop follows; keep the toggle consistent. */
+      in_call[slot(t)] = 1;
+      poison[slot(t)] = 0;
+      ptrace(PTRACE_SYSCALL, t, 0, 0);
+      continue;
+    }
+    if (sig == (SIGTRAP | 0x80)) {
+      int s = slot(t);
+      in_call[s] ^= 1;
+      regs_t r;
+      if (get_regs(t, &r) != 0) { ptrace(PTRACE_SYSCALL, t, 0, 0); continue; }
+
+      if (in_call[s]) { /* syscall entry */
+        if (reg_nr(&r) == SYS_READ_NR) {
+          long fd = reg_arg0(&r);
+          char linkpath[64];
+          struct stat fs;
+          snprintf(linkpath, sizeof linkpath, "/proc/%d/fd/%ld", (int)t, fd);
+          if (stat(linkpath, &fs) == 0 &&
+              fs.st_dev == ts.st_dev && fs.st_ino == ts.st_ino) {
+            match_count++;
+            if (match_count == fail_n) poison[s] = 1;
+          }
+        }
+     
```

**File**: `test/js/bun/io/fifo-helpers.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import { mkfifo } from "mkfifo";
+import fs from "node:fs";
+import { join } from "node:path";
+
+const { O_NONBLOCK, O_RDONLY, O_WRONLY } = fs.constants;
+
+/** Makes a FIFO in `dir` and opens both ends, non-blocking. */
+export function openFifo(dir: string) {
+  const path = join(dir, "fifo");
+  mkfifo(path);
+  const reader = fs.openSync(path, O_RDONLY | O_NONBLOCK);
+  const writer = fs.openSync(path, O_WRONLY | O_NONBLOCK);
+  const open = new Set([reader, writer]);
+  const close = (fd: number) => void (open.delete(fd) && fs.closeSync(fd));
+  return { path, reader, writer, close, [Symbol.dispose]: () => [...open].forEach(close) };
+}
+
+function untilEAGAIN(step: () => number) {
+  let total = 0;
+  try {
+    for (let n; (n = step());) total += n;
+  } catch (e: any) {
+    if (e.code !== "EAGAIN") throw e;
+  }
+  return total;
+}
+
+/** Writes until the pipe is full. Returns how much that was. */
+export function fill(writer: number) {
+  const page = Buffer.alloc(4096, "x");
+  return untilEAGAIN(() => fs.writeSync(writer, page));
+}
+
+/** Reads until the pipe is empty. Returns how much that was. */
+export function drain(reader: number) {
+  const buffer = Buffer.alloc(65536);
+  return untilEAGAIN(() => fs.readSync(reader, buffer));
+}
+
+/** Linux: resolves when this process has asked epoll to tell it when `fd` is readable or writable. */
+export async function untilWatched(fd: number) {
+  const inode = fs.fstatSync(fd).ino;
+  const deadline = Date.now() + 30_000;
+  while (Date.now() < deadline) {
+    for (const name of fs.readdirSync("/proc/self/fdinfo")) {
+      let info = "";
+      try {
+        info = fs.readFileSync("/proc/self/fdinfo/" + name, "utf8");
+      } catch {}
+      for (const [, events, ino] of info.matchAll(/^tfd:.* events:\s*([0-9a-f]+) .* ino:([0-9a-f]+)/gm)) {
+        // EPOLLIN | EPOLLOUT: a one-shot entry that has fired has neither.
+        if (parseInt(ino, 16) === inode && parseInt(events, 16) & 0b101) return;
+      }
+    }
+    await Bun.sleep(1);
+  }
+  throw new Error(`nothing waits for fd ${fd}`);
+}
```

**File**: `test/js/bun/util/bun-file-fd-read.test.ts` (modified, +244/-5)
```diff
@@ -1,11 +1,13 @@
+import { dlopen, ptr } from "bun:ffi";
 import { describe, expect, test } from "bun:test";
-import { closeSync, openSync } from "fs";
-import { isWindows, tempDir } from "harness";
+import { closeSync, openSync, readSync, renameSync, writeSync } from "fs";
+import { bunEnv, bunExe, isLinux, isWindows, libcPathForDlopen, tempDir } from "harness";
+import { constants } from "os";
 import { join } from "path";
+import { openFifo, untilWatched } from "../io/fifo-helpers";
 
 // Reading a Bun.file() backed by a file descriptor goes through
-// ReadFile.runAsync -> getFd (opened_fd already set) -> runAsyncWithFD ->
-// resolveSizeAndLastModified, which derives total_size from fstat. That
+// ReadFile::open, which derives the expected size from fstat. That
 // computation previously used @intCast to u52 guarded by a dead @truncate,
 // so an abnormal fstat size could trip integerOutOfBounds. Triggering that
 // directly requires fstat to report > 4.5 PB which is not achievable here,
@@ -36,7 +38,7 @@ describe.skipIf(isWindows)("Bun.file(fd) read", () => {
     using dir = tempDir("bun-file-fd-read", { "fd-slice.txt": "0123456789" });
     const path = join(String(dir), "fd-slice.txt");
 
-    // total_size should come from fstat (10), not from the requested slice
+    // The expected size should come from fstat (10), not from the requested slice
     // end, so the initial buffer allocation stays small.
     expect(await withFd(path, fd => Bun.file(fd).slice(0, Number.MAX_SAFE_INTEGER).text())).toBe("0123456789");
     expect(await withFd(path, fd => Bun.file(fd).slice(2, 5).text())).toBe("234");
@@ -50,3 +52,240 @@ describe.skipIf(isWindows)("Bun.file(fd) read", () => {
     expect((await withFd(path, fd => Bun.file(fd).arrayBuffer())).byteLength).toBe(0);
   });
 });
+
+test.skipIf(!isLinux)("an empty read of a FIFO by path stays open until its writer has written", async () => {
+  using dir = tempDir("bun-file-fd-read", {});
+  using fifo = openFifo(String(dir));
+  const text = Bun.file(fifo.path).slice(0, 0).text();
+  await untilWatched(fifo.reader);
+  fifo.close(fifo.reader);
+  expect(writeSync(fifo.writer, "x")).toBe(1);
+  expect(await text).toBe("");
+});
+
+test.skipIf(isWindows)("a file that was empty and is a silent FIFO now reads as empty", async () => {
+  using dir = tempDir("bun-file-fd-read", { file: "" });
+  using fifo = openFifo(String(dir));
+  const file = Bun.file(join(String(dir), "file"));
+  expect(file.size).toBe(0);
+  renameSync(fifo.path, file.name!);
+  expect(await file.text()).toBe("");
+});
+
+test.skipIf(isWindows)("a read of a pipe waits again after each chunk", async () => {
+  using dir = tempDir("bun-file-fd-read", {});
+  using fifo = openFifo(String(dir));
+  const text = Bun.file(fifo.reader).slice(0, 30).text();
+  for (let i = 0; i < 30; i++) {
+    // A writer that keeps up, and one that does not.
+    await Bun.sleep(i % 4);
+    writeSync(fifo.writer, "x");
+  }
+  expect(await text).toBe(Buffer.alloc(30, "x").toString());
+});
+
+// More than the thread that waits takes from the kernel at once.
+describe.skipIf(isWindows).concurrent("300 reads wait", () => {
+  async function run(script: string) {
+    using dir = tempDir("bun-file-fd-read", {});
+    const prelude = `
+      import { openFifo } from ${JSON.stringify(join(import.meta.dir, "..", "io", "fifo-helpers.ts"))};
+      import { closeSync, constants, mkdirSync, openSync, writeSync } from "node:fs";
+      const open = dir => (mkdirSync(dir), openFifo(dir));
+      using shared = open("shared");
+      const readers = Array.from({ length: 300 }, () => openSync(shared.path, constants.O_RDONLY | constants.O_NONBLOCK));
+      // Behind the others on the pool, so most of them wait by then.
+      const fence = () => Bun.file(${JSON.stringify(import.meta.path)}).text();
+    `;
+    await using proc = Bun.spawn({
+      cmd: [bunExe(), "-e", prelude + script],
+      cwd: String(dir),
+      env: bunEnv,
+      stderr: "pipe",
+    });
+    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
+    return { stdout, stderr, exitCode };
+  }
+
+  test("and get ready together", async () => {
+    const result = await run(`
+      const texts = readers.map(fd => Bun.file(fd).slice(0, 1).text());
+      await fence();
+      writeSync(shared.writer, Buffer.alloc(300, "x"));
+      console.log((await Promise.all(texts)).join("").length);
+    `);
+    expect(result).toEqual({ stdout: "300\n", stderr: "", exitCode: 0 });
+  });
+
+  test.each([false, true])("and are cancelled beside one that is not, fds closed: %p", async closed => {
+    const result = await run(`
+      using own = open("own");
+      const graph = new Bun.ModuleGraph();
+      for (const fd of readers) graph.run(() => void Bun.file(fd).text().catch(() => {}));
+      for (const byte of "ab") {
+        const text = Bun.file(own.reader).slice(0, 1).text();
+        await fenc
```

---

### Incident Patch 2: `b116ab7b` (2026-11-20)
**Commit Message**: Refuse --aot with --bytecode, and compiler fixes (#49336)

Two groups of changes.

**`--aot` with `--bytecode` is an error.** `bun build --compile --aot --bytecode` used to print a note and build with `--aot`. It now fails and asks for one of the two:

```
error: Cannot use both --aot and --bytecode. Choose --aot for machine code or --bytecode for bytecode
```

`bun compile --bytecode` fails the same way and names `--no-aot`. `Bun.build()` with `bytecode: true` and `compile.aot` throws. `--bytecode-depth`, `--bytecode-order` and `--no-optimize-bytecode` still only print their notes. The test harnesses that compile other suites ahead of time now leave `--bytecode` out.

**Compiler fixes.** An import of a file that was required as a path gives the file's module, an uncalled constructor with a stored prototype no longer aborts the build, and a `var` named as its catch parameter in evaluated text is a global. The programs for oven-sh/WebKit#1082's fixes are here too. These passed on Linux x64 links of a nearby tree.


Also fixed: `fs.rename` no longer looks up its source first in ordinary builds, and a compiled program lists an imported file that has the name of an entry point in `read

**File**: `docs/compiler/compatibility.mdx` (modified, +1/-0)
```diff
@@ -373,4 +373,5 @@ Check `error.name` or use `instanceof`, not `error.message`.
 | Over 256 open `JSCallback`s, if the executable can't read its own file | Make the file readable, or `close()` some                                                |
 | Over 32 GB of objects in a thread                                      | `--aot-huge-heap`                                                                        |
 | A stack under 512 KB (`ulimit -s`)                                     | Give it more. `bun run` needs less                                                       |
+| `import()` or `require()` with a `type` that isn't written out         | Write it out: `require("./a.json", { type: "file" })`                                    |
 | `with { type: "macro" }` on an import (`TS100053`)                     | Pass `--no-aot`                                                                          |
```

**File**: `docs/snippets/cli/build.mdx` (modified, +1/-1)
```diff
@@ -217,7 +217,7 @@ bun build <entry points>
 
 <ParamField path="--aot" type="boolean">
   Compile JavaScript and TypeScript to machine code at build time. Requires <code>--compile</code>.{" "}
-  <code>--format</code> and <code>--bytecode</code> have no effect with it
+  <code>--format</code> has no effect with it, and it cannot be combined with <code>--bytecode</code>
 </ParamField>
 
 <ParamField path="--explain" type="string">
```

**File**: `packages/bun-types/bun.d.ts` (modified, +1/-1)
```diff
@@ -4009,7 +4009,7 @@ declare module "bun" {
     autoloadPackageJson?: boolean;
     /**
      * Compile the program's JavaScript and TypeScript to machine code at build time.
-     * `bytecode` has no effect with it.
+     * It cannot be combined with `bytecode`.
      *
      * The executable has no JIT. Code that only exists at run time, such as a string passed to
      * `eval()` or `new Function()`, runs in the interpreter.
```

**File**: `scripts/build/deps/webkit.sha256` (modified, +78/-78)
```diff
@@ -1,78 +1,78 @@
-db35656442eb1180ec115755550684a38d17189bcba810b75ef25667d481c188  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-aot-sources.tar.gz
-7626d0192cdc1ffddf147937715d9da032a088bc0d677a84fca2548c945e9c75  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-amd64-aot.tar.gz
-ce092ffead4d04efdd65ccf83fc80944cd597564b78e9087a4c79c5cd3027007  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-amd64-debug-aot.tar.gz
-0e784f5eb0acdbd9d8ca8e2a575aa28fe5f6d6ba173405ea2966aaf885f66801  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-amd64-lto-aot.tar.gz
-8014772ed4973e7bd33250cec43f0bfa97eca466986d23091c8e217ddea9524c  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-amd64-lto.tar.gz
-21672de13905722cb4b79000cd51c640a84f929da7a4a6677db97aa9543ec2ef  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-amd64.tar.gz
-e7b6d76cc1646361bc1b0d8355fea37760f61c3d1455f04bf605668b5fa3ec12  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-arm64-aot.tar.gz
-abf10c4f11dfbab6cf217761752004510763c125edb3fbb6a1585229b25b5065  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-arm64-debug-aot.tar.gz
-eed9d70c762b7fafc081e526ec3b7de36cc503d52069288dff5b2373331a5b35  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-arm64-lto-aot.tar.gz
-0fdcf73a3c98c3c47df043df901ff974c38fb4e3731be39113543f62c35131c0  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-arm64-lto.tar.gz
-1e152e3607cd1c669c38cc18cc97b04195cc363f854d90c93f92a4e8977990b9  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-freebsd-arm64.tar.gz
-4de64596a060ae3f068ff611256b75097c1ed99133aa526333b643d75c2483a6  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-android-aot.tar.gz
-7408df346a5e66eddbff318d02ce492fbaf10360b724ce70bfed5938d2fefbda  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-android-debug-aot.tar.gz
-68ed1a1b21dcdf42ec36d0ee2f1ed9764a5361fb07edb562a46661188cbd682b  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-android-lto-aot.tar.gz
-625fd672bfe0809c12213973c813854c59b2fc9b2f51ac860708c4bc0291a810  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-android-lto.tar.gz
-e20ce5cd0aac41b73f08ec117b1d2fe5523af5df22748c18629a2444e2ea8f8e  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-android.tar.gz
-d1141d96a819a7428b9016038976182d3fccff286541800d7fd873d540c53aa6  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-aot.tar.gz
-972c2734f8eb874593ba21a028586b89745a99966aaa9ef304eef24413e09b56  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-asan-aot.tar.gz
-a8bd8f9c63a246411163f38a0b7257a534fef4af894450b992a1d9aeda36de2f  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-assertions-aot.tar.gz
-8fb858a32c8798d176e9dc2fe49cc0e25bd61785f87cc161c131a60925c5b942  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-assertions-coverage-aot.tar.gz
-79e9ca87c72b36b58b11dc9c79d005fbdf559d1046f7462ce8e26a3348f1f85a  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-coverage-aot.tar.gz
-6a9ce7ceab3cf62245f42f82a1e26700ed9278c9fa265854830a082186ea7c2b  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-debug-aot.tar.gz
-7b2fd4ee16ca733f42b0dedd8bb78f08942600ef9d254da989f5b51119292241  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-debug-asan-aot.tar.gz
-d977d2b05907d89989ebc95526ec4fd8bc10e33cf2088e2f3dc4dffba1ea8c05  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-hardened-aot.tar.gz
-13ef954934d321fd8008b0c47857b329fd53c59a51291bde83c528beec3b9aff  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-lto-aot.tar.gz
-43a06ab317ec49e98def6ce3297fb86637f64574abcbd970a798141d55a9d1ba  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-lto-hardened-aot-no-webassembly.tar.gz
-a2e0e4e0ee8f9afc05a7ca20f1998636428d7ff125387d1b02873a454e930cc2  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-lto-hardened-aot.tar.gz
-5d6e96523173517e7025b6597b2228f783f342c34f774cc3f7696c91da27cdb8  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-lto-hardened.tar.gz
-3b8f8646016b603102f037ae4201945c8fb29bde5826906d5be1568d2c11d7d5  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-lto.tar.gz
-8f1deec78ad5855df8983bf0369404a3317c81f9d270e3312b99d460be83d0d7  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-musl-aot.tar.gz
-3b11f44b3be9dd851d7c95014f1ccf9d3dda9166cc7bd85cf852da5f27aff0a4  autobuild-cbf8d973991b8a341fe00fb65b9d99c57cde303e/bun-webkit-linux-amd64-musl-debug-aot.tar.gz
-7e5d7e514703379430daaa6530e89afaeb13daf4254711b7f8483e
```

**File**: `scripts/build/deps/webkit.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
  * After changing it, run `bun run pin-webkit`: webkit.sha256 pins the sha256
  * of this version's tarballs, and a build refuses one that is not in there.
  */
-export const WEBKIT_VERSION = "cbf8d973991b8a341fe00fb65b9d99c57cde303e";
+export const WEBKIT_VERSION = "499846f18f75962fd6e2ba01065d00305ce72c4a";
 
 /**
  * WebKit (JavaScriptCore) — the JS engine, with WTF and bmalloc.
```

**File**: `src/aot/lower/call/evaluated_text.rs` (modified, +5/-10)
```diff
@@ -1,9 +1,8 @@
 use bun_sema::atom::{Atom, known};
-use bun_sema::bind::{Binding, Decl, ScopeId, ScopeKind};
+use bun_sema::bind::{Binding, BindingKind, Decl, ScopeId, ScopeKind};
 use bun_sema::fold::Constant;
 use bun_sema::hir::{
-    CallId, ExprId, ExprKind, FnKind, GlobalCode, KnownEvaluation, NodeData, PatId,
-    ReplacedEvaluation,
+    CallId, ExprId, ExprKind, FnKind, GlobalCode, KnownEvaluation, NodeData, ReplacedEvaluation,
 };
 use rustc_hash::FxHashMap;
 
@@ -111,10 +110,10 @@ impl FileLowering<'_, '_, '_, '_> {
                     Decl::Fn(function) => Some(hir[*function].start),
                     _ => None,
                 });
+                // An initializer may store into a catch parameter of that name. The variable is there all the same.
+                let is_variable = bound.binding_kind(symbol) == BindingKind::Var;
                 let of_variable = decls().find_map(|decl| match decl {
-                    Decl::Var(pattern) if self.is_global_variable(*pattern) => {
-                        Some(hir[*pattern].pos)
-                    }
+                    Decl::Var(pattern) if is_variable => Some(hir[*pattern].pos),
                     _ => None,
                 });
                 let position = of_function.or(of_variable)?;
@@ -124,10 +123,6 @@ impl FileLowering<'_, '_, '_, '_> {
         globals.sort_unstable_by_key(|it| it.0);
         globals.into_iter().map(|it| (it.1, it.2)).collect()
     }
-
-    fn is_global_variable(&self, pattern: PatId) -> bool {
-        self.bound.initialized_binding(pattern) == Binding::Free
-    }
 }
 
 impl FunctionLowering<'_, '_, '_, '_, '_> {
```

**File**: `src/aot/lower/known_call.rs` (modified, +41/-1)
```diff
@@ -1,6 +1,6 @@
 use bun_sema::atom::{Atom, known};
 use bun_sema::bind::{
-    Binding, BindingInitializer, Decl, InitialState, Parent, ScopeId, StoreKind, SymbolId,
+    Binding, BindingInitializer, Decl, FnOwner, InitialState, Parent, ScopeId, StoreKind, SymbolId,
 };
 use bun_sema::check::aot::{FunctionRef, ObjectMemberKind};
 use bun_sema::hir::{
@@ -1798,6 +1798,46 @@ fn is_lowered(file: &FileLowering<'_, '_, '_, '_>, home: FileId) -> bool {
     file.inputs.files[home.idx()].is_some()
 }
 
+/// It is never made: it stands in a file, a function or a declaration that the executable leaves out.
+pub(in crate::lower) fn is_left_out(
+    file: &FileLowering<'_, '_, '_, '_>,
+    home: FileId,
+    function: FnId,
+) -> bool {
+    if !is_lowered(file, home) {
+        return true;
+    }
+    let functions = file.inputs.library_functions;
+    let declarations = functions.left_out_declarations();
+    let bound = file.queries.files().bound(home);
+    let is_node_left_out = |node: Parent| match node {
+        Parent::FnBody(function) => functions.is_left_out(FunctionRef {
+            file: home,
+            function,
+        }),
+        Parent::Stmt(statement) => declarations.is_statement_left_out(home, statement),
+        Parent::VarInit(declarator) => declarations.is_declarator_left_out(home, declarator),
+        _ => false,
+    };
+    let mut nodes = core::iter::successors(Some(Parent::FnBody(function)), |&node| match node {
+        Parent::Expr(expression) => Some(bound.parent_of_expr(expression)),
+        Parent::Prop(property) => {
+            let literal = bound.prop_owner[property.idx()].some()?;
+            Some(bound.parent_of_expr(literal))
+        }
+        Parent::Stmt(statement) => Some(bound.parent_of_stmt(statement)),
+        Parent::VarInit(declarator) => Some(Parent::Stmt(bound.var_stmt[declarator.idx()])),
+        Parent::Case(case) => Some(Parent::Stmt(bound.case_stmt[case.idx()])),
+        Parent::FnBody(function) => match bound.fns[function.idx()].owner {
+            FnOwner::Expr(written) => Some(bound.parent_of_expr(written)),
+            FnOwner::Stmt(statement) => Some(bound.parent_of_stmt(statement)),
+            FnOwner::None | FnOwner::Member(_) | FnOwner::Type(_) => None,
+        },
+        _ => None,
+    });
+    nodes.any(is_node_left_out)
+}
+
 fn is_plain_call(file: &FileLowering<'_, '_, '_, '_>, site: Call) -> bool {
     let hir = file.hir;
     let mut arguments = hir.ids(site.args);
```

**File**: `src/aot/lower/layouts/classes.rs` (modified, +6/-2)
```diff
@@ -27,7 +27,9 @@ use crate::known_helpers::StateOwner;
 use crate::lower::class::ClassElement;
 use crate::lower::module::LibraryFunctionForm;
 use crate::lower::positions::is_made_by_its_file;
-use crate::lower::{CheckerTypeId, FileLowering, NameOfHeir, SourceKind, class, module};
+use crate::lower::{
+    CheckerTypeId, FileLowering, NameOfHeir, SourceKind, class, known_call, module,
+};
 use crate::modules::{InnerModuleKind, ModuleRef};
 
 type Supertypes = SmallVec<[LayoutId; 4]>;
@@ -751,7 +753,9 @@ impl FileLowering<'_, '_, '_, '_> {
     ) -> Option<LayoutId> {
         let layout = self.declare_constructor_function_layout(function)?;
         if function.file == self.file && !self.fragment.is_layout_defined(layout) {
-            let constructor = match self.decisions().is_dead_function(function.function) {
+            let is_never_made = self.decisions().is_dead_function(function.function)
+                || known_call::is_left_out(self, self.file, function.function);
+            let constructor = match is_never_made {
                 true => None,
                 false => Some(self.reference_function(FunctionKey::Source(function))),
             };
```

---

### Incident Patch 3: `7bb427f3` (2026-11-20)
**Commit Message**: AOT: mocks of preloads beside resets and failures, diagnostics at once, and tests of the engine's fixes (#49145)

Bun's side of fixes of the ahead-of-time compiler (`bun build --compile --aot` and `bun test
--aot`, both experimental), with their programs and test runs, and a change of the bundler. The
JavaScriptCore side is oven-sh/WebKit#1069 and oven-sh/WebKit#1071, both merged. This follows
oven-sh/bun#49108.

- `bun test --aot`: mocks that preloads, hooks and test files lay run, wait and leave as in
  `bun test`; built-in modules can be mocked by their original.
- Compiled programs: wrong answers and stopped builds around loops, classes, decorators, module
  objects, require.resolve() and files found by path.
- Bun.resolve(), Bun.resolveSync() and import.meta.resolveSync() of an absolute path answer like
  require.resolve().
- `bun build --splitting` lists the imports of each file once.
- Typed libraries keep the semantics of class fields and load what their JavaScript loads.

**File**: `scripts/build/deps/webkit.sha256` (modified, +78/-78)
```diff
@@ -1,78 +1,78 @@
-cb16866ccf8e8d10140246e4112ea5a3ac568297881dba8df227151ea196fddf  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-aot-sources.tar.gz
-36c58f7b5b5737258150fc5a595b5520ce981e131536be9769c38e0caa3c8370  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-amd64-aot.tar.gz
-512897c6246547e9e2f279db923d4b904693fd2351f1e6aea4dc464d19fbf232  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-amd64-debug-aot.tar.gz
-900b6327ffa1043c2190244621acf1e5fe06586be0699623722d916449491e7c  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-amd64-lto-aot.tar.gz
-30765439418939190f7e3315a5857fd68b315518cb6c276147c813727f340cd8  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-amd64-lto.tar.gz
-458754e348fd0f01ff91a833831e90ec34db933feeedc3a056d7c6fed8f6532c  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-amd64.tar.gz
-ad3d2d8665b5215aa2b8bce167acb30add1ff447917984adaf72c8fc8d82f0d2  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-arm64-aot.tar.gz
-5cb910fc6c33b4b5419f0fd619760c804495ac32f722e6892bcf62ca3fe5f952  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-arm64-debug-aot.tar.gz
-f95743999d20d338ae3ebe6764bbd755427214e6be1add097203fc20a5abcac3  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-arm64-lto-aot.tar.gz
-84c38c11f2a0f72858c7037ec718ac37894accbf077cd34ba51f0ab7a5f2ef82  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-arm64-lto.tar.gz
-175c81ea988de2cc5570e9c91c05e6495fdf9dd55e138206eaa672faaf011562  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-freebsd-arm64.tar.gz
-e683571a0ce3638d71f438d7b639ad64c0b70e2ee908c5fed7de833f5af1c1fd  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-android-aot.tar.gz
-2586515598e7a03c961440b152605004f00b8a187d9c74f88edb75e040c581eb  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-android-debug-aot.tar.gz
-1ad8b79d3867e0b69ed5b88df8d3d1019ad00fa714f766f65fb0b82ecc66706a  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-android-lto-aot.tar.gz
-4aeebcde1ff3827f6744d15e579233e9acc5b7fbb2c860d83fad443980b0faf4  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-android-lto.tar.gz
-28c70bf660d15e4eee8fe0c8786138e6b72e0ef7c0da97496551105e9828189c  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-android.tar.gz
-f0ef89ed9447c245617a5379bbd85fbd26d7228ec0ea4f8597f3872a381beb47  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-aot.tar.gz
-593f4299dfcd59474f92675c67476b7e297b56542b3308b5665c89a9fecc8673  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-asan-aot.tar.gz
-043e9431e623ca1d34acd512bd6035a34bafd23234f7cb54663989d77778d7d4  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-assertions-aot.tar.gz
-e00984a923e988ef8fcf09d821da9eff1a8279da6d9613dd0e2e2520a19854ca  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-assertions-coverage-aot.tar.gz
-2ca66802c9b83fbe2d9c7d10969a3453755fcdfceb7e3415337ad27c5e4d6cfd  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-coverage-aot.tar.gz
-002cab13652a71986ed6f7e16b69115bf83959c278e8b8aa4a9af747e5517815  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-debug-aot.tar.gz
-755082c11586e4da524f1eecb76a00716b14add61121702b9f01ec4efacc8a34  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-debug-asan-aot.tar.gz
-fac1ad64ad1ed8307237b6c16560f3e5fc895c7e6a59fc642aed8ac8050eb636  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-hardened-aot.tar.gz
-47b4cedc7e636f88feec44a5644cdfb8d74307d1b96c4f8e31df078a9df29653  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-lto-aot.tar.gz
-0ef71a96f424a9aef3edfd6407291fde35d49d78ddac2c93f0af910b833932d1  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-lto-hardened-aot-no-webassembly.tar.gz
-a5d21f47a6490a77ab1aa00b6a927a77f8625627f9edb4c80740cfc32d72723e  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-lto-hardened-aot.tar.gz
-e0e1e6f4a874d4d847ecf13ed395534b971e78177635f6bcdd9c183449630ed9  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-lto-hardened.tar.gz
-c2892688efdad2c0c2b060df90743eb4b26020c1c6a8eebf7685d4f47ef456f6  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-lto.tar.gz
-08558d8e42286db0c785e7bf4a8356ce2b6bbb35e9e7b0911d57369e278af3a0  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-musl-aot.tar.gz
-507c3c56d11edd2484cfc868487f18a018363d585da5a8987f8715ff3d9617ee  autobuild-0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4/bun-webkit-linux-amd64-musl-debug-aot.tar.gz
-72f766986fa791a8390a849c021d5bb81f4d70151736cc6680c094
```

**File**: `scripts/build/deps/webkit.ts` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
  * After changing it, run `bun run pin-webkit`: webkit.sha256 pins the sha256
  * of this version's tarballs, and a build refuses one that is not in there.
  */
-export const WEBKIT_VERSION = "0befb64c5f30ae5af5137f31c1ebd4f7c3f908d4";
+export const WEBKIT_VERSION = "cbf8d973991b8a341fe00fb65b9d99c57cde303e";
 
 /**
  * WebKit (JavaScriptCore) — the JS engine, with WTF and bmalloc.
```

**File**: `src/aot/builtins/resolve.rs` (modified, +0/-2)
```diff
@@ -312,7 +312,6 @@ pub struct ResolvedBuiltins {
     mentioned: Box<[BuiltinId]>,
     source_evaluator_escapes: bool,
     may_call_unnamed_evaluator: bool,
-    #[cfg(test)]
     exposed: Box<[BuiltinId]>,
     uses: RuntimeUses,
     loads_unknown_modules: bool,
@@ -582,7 +581,6 @@ impl ResolvedBuiltins {
         })
     }
 
-    #[cfg(test)]
     pub fn exposed(&self) -> &[BuiltinId] {
         &self.exposed
     }
```

**File**: `src/aot/builtins/resolve/imports.rs` (modified, +19/-3)
```diff
@@ -255,6 +255,18 @@ impl Resolver<'_, '_> {
         false
     }
 
+    fn may_take_original(&self, mock: ExprId) -> bool {
+        let hir = self.input.hir;
+        let ExprKind::Call(call) = hir[mock].kind else {
+            return false;
+        };
+        let factory = hir.ids(hir[call].args).nth(1);
+        factory.is_none_or(|it| match hir[hir.skip_type_assertions(it)].kind {
+            ExprKind::Fn(function) => hir[function].params.iter().next().is_some(),
+            _ => true,
+        })
+    }
+
     fn find_runner_that_stub_answers(&self, callee: ExprId, stub: BuiltinId) -> Option<BuiltinId> {
         if !table::stubs_global(stub) {
             return None;
@@ -276,7 +288,12 @@ impl Resolver<'_, '_> {
             }
             match site {
                 ImportSiteKind::ImportCall(call) if self.is_import_awaited_at_once(call) => {}
-                ImportSiteKind::ImportCall(_) | ImportSiteKind::ExportStar(_) => {
+                ImportSiteKind::MockModule(mock) if self.may_take_original(mock) => {
+                    self.expose(table::canonical_id(namespace));
+                }
+                ImportSiteKind::ImportCall(_) | ImportSiteKind::ExportStar(_)
+                | ImportSiteKind::ImportByTestRunner(_)
+                | ImportSiteKind::RequireByTestRunner(_) => {
                     self.expose(table::canonical_id(namespace));
                 }
                 ImportSiteKind::ExportFrom(export) => {
@@ -296,8 +313,7 @@ impl Resolver<'_, '_> {
                 | ImportSiteKind::ImportEquals(_) | ImportSiteKind::Require(_)
                 | ImportSiteKind::RequireResolve(_) | ImportSiteKind::ImportMetaRequire(_)
                 | ImportSiteKind::ImportMetaResolve(_) | ImportSiteKind::GetBuiltinModule(_)
-                | ImportSiteKind::MockModule(_) | ImportSiteKind::ImportByTestRunner(_)
-                | ImportSiteKind::RequireByTestRunner(_) => {}
+                | ImportSiteKind::MockModule(_) => {}
             }
         }
     }
```

**File**: `src/aot/builtins/resolve/resolver.rs` (modified, +0/-1)
```diff
@@ -1183,7 +1183,6 @@ impl<'a, 's> Resolver<'a, 's> {
             mentioned,
             source_evaluator_escapes,
             may_call_unnamed_evaluator,
-            #[cfg(test)]
             exposed,
             uses,
             loads_unknown_modules,
```

**File**: `src/aot/compile.rs` (modified, +4/-1)
```diff
@@ -50,7 +50,9 @@ use crate::ir::{Id, ModuleId, Program};
 use crate::known_helpers::KnownHelpers;
 use crate::link::{Leftovers, LinkedFunctions, run_beside, run_one_after_the_other};
 use crate::load::contents::ProgramContents;
-use crate::load::contents::entry_points::{join_below_root, name_from_working_directory};
+use crate::load::contents::entry_points::{
+    NameOfLoad, join_below_root, name_from_working_directory,
+};
 use crate::load::contents::worker_entries::{find_file_named_as_in_executable, source_path_of};
 use crate::load::source_provider::{PathsOfProgram, SourceProvider};
 use crate::load::{PerProject, ProjectId, Sources, host_platform};
@@ -121,6 +123,7 @@ pub(crate) struct StartedWorkers {
     pub names: Vec<EntryPointPaths>,
     pub followed_at: Vec<(Vec<u8>, u32)>,
     pub named_at: Vec<(Vec<u8>, u32)>,
+    pub names_of_loads: Vec<NameOfLoad>,
     pub names_followed: Vec<FollowedName>,
     pub names_plugin: bool,
     /// What a warning says of names that lead out of the root directory.
```

**File**: `src/aot/compile/bind_stage.rs` (modified, +1/-0)
```diff
@@ -1759,6 +1759,7 @@ impl Build<'_> {
                         view.files(),
                         view.sources,
                         &graph,
+                        &self.started_workers.names_of_loads,
                         &left_out.files,
                         &in_parallel,
                     );
```

**File**: `src/aot/compile/link_stage.rs` (modified, +8/-0)
```diff
@@ -13,6 +13,7 @@ use crate::link::{
     self, LinkInput, LinkProject, LinkUnit, Linked, LinkedFunctions, ProgramModule,
     run_steps_beside,
 };
+use crate::load::contents::load_names::is_object_handed_on;
 use crate::load::runtime_roots::{StartOfRun, builtins_used_at_start};
 use crate::load::{ProgramFile, ProjectId};
 use crate::module_keys::{path_without_form, stamp_of_file};
@@ -208,6 +209,13 @@ impl Build<'_> {
                             .method_that_hands_out_global_object_may_come_out;
                         let used_at_start =
                             used_at_start.chain(comes_out.then_some(BuiltinId::GlobalThis));
+                        let gives_loader = runs_tests
+                            && is_object_handed_on(
+                                application.loaded.files(),
+                                BuiltinId::NodeModule,
+                            );
+                        let used_at_start =
+                            used_at_start.chain(gives_loader.then_some(BuiltinId::NodeModule));
                         program.builtins_used_at_start = used_at_start
                             .map(|builtin| BuiltinUsedAtStart { builtin })
                             .collect();
```

#### Recent Merged Pull Requests:
- **PR #49357** (2026-11-21): serve: HTTP/2 and HTTP/3 callbacks keep their ref guard in release (@dylan-conway)
- **PR #49352** (2026-11-20): blob: reads and writes share one job (@alii)
- **PR #49337** (2026-11-21): blob: three fixes to how a job waits for a descriptor (@alii)
- **PR #49336** (2026-11-20): Refuse --aot with --bytecode, and compiler fixes (@Jarred-Sumner)
- **PR #49332** (closed): bun test: add --reporter=ndjson, reporter modules and <file>:<line> (@ChildishForces)
- **PR #49322** (2026-11-20): redis: the retry count lives in the states that can lead to a retry (@alii)

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

## X. blob: three fixes to how a job waits for a descriptor

**RULE**:
When implementing operations in `src/io/lib.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `74d8f30d`: blob: three fixes to how a job waits for a descriptor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/io/lib.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // No data: no `Poll` has the ticket 0.
        let mut tickets = Tickets::default();
                                &mut tickets,
                                &mut tickets,
                            close.poll.unregister(close.fd);
                            tickets.armed.remove(&close.poll.ticket);
                // None for the waker too, which is edge-triggered: no need to read its counter.
                if let Some((poll, tag)) = tickets.armed.remove(&{ event.u64 }) {
                    Poll::on_update_epoll(poll, tag, *event);
                }
/// single `u64` (`kevent.udata`), so we keep the
#[cfg(any(target_os = "macos", target_os = "freebsd"))]
#[cfg(any(target_os = "macos", target_os = "freebsd"))]
#[cfg(any(target_os = "macos", target_os = "freebsd"))]
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                // No data: `tick_epoll` skips an event without a `Poll`.
                            // Only remove from the interest list if it was previously registered.
                            // Otherwise, epoll gets confused.
                            // This state can happen if polling for readable/writable previously failed.
                            if close.poll.flags.contains(Flags::WasEverRegistered) {
                                close.poll.unregister_with_fd(watcher_fd, close.fd);
                            }
                let pollable = Pollable::from(event.u64);
                // Null for the waker, which is edge-triggered: no need to read its counter.
                let Some(poll) = core::ptr::NonNull::new(pollable.poll()) else {
                    continue;
                };
                Poll::on_update_epoll(poll, pollable.tag(), *event);

    /// Atomic-ordered store of `callback`.
    ///
    /// The io thread reads `callback` after popping `self` from the MPSC
    /// queue (which already provides acquire on `next`); this SeqCst fence
    /// guarantees the callback write is visible to that read even when the
    /// store happens on a dif
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `74d8f30d` are properly handled with clean fallback behavior.
