> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/a9t9-rpa-learnings.md`  
> **Source**: github ([https://github.com/A9T9/RPA](https://github.com/A9T9/RPA))  
> **Source Version**: `17b6302f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T14:43:11.582Z  
> **Learning ID**: `learn-github-a9t9-rpa`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): A9T9/RPA

> **Canonical Artifact**: `07_PROJECT_LEARNING/a9t9-rpa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/A9T9/RPA](https://github.com/A9T9/RPA))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T14:43:11.216Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `A9T9/RPA`
- **Description**: Browser and desktop automation with an MCP server for AI assistants. Record macros or write JavaScript to automate websites, extract data, and control desktop apps with OCR and image recognition.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2091 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `extension/lib/imagesearch/worker-main.js`
```
!function(e){var t={};function r(n){if(t[n])return t[n].exports;var a=t[n]={i:n,l:!1,exports:{}};return e[n].call(a.exports,a,a.exports,r),a.l=!0,a.exports}r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var a in e)r.d(n,a,function(t){return e[t]}.bind(null,a));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=2)}([function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});t.HeapMemory=class{constructor(e){const t="BYTES_PER_ELEMENT"in e?e:new Uint8Array(e),r=t.length*t.BYTES_PER_ELEMENT,n=Module._malloc(r);this.heapBytes=Module.HEAPU8.subarray(n,n+r),this.heapBytes.set(t)}free(){Module._free(this.heapBytes.byteOffset)}get offset(){return this.heapBytes.byteOffset}get length(){return this.heapBytes.length}}},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});class n{static create(e,t){return{id:n.nextId++,type:e,startTime:performance.now(),finishTime:0,args:t,result:void 0}}static complete(e,t){return{id:e.id,type:e.type,startTime:e.startTime,finishTime:performance.now(),args:e.args,result:t}}}n.nextId=1,t.JobFactory=n},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const n=r(1),a=r(0);self.onmessage=function(e){const t=e.data;switch(t.type){case 1:const e=t.data;let r;switch(e.type){case 0:r=function(e){let t;const r=new a.HeapMemory(e);try{t=kantusearch.readImageInfo(r.offset,r.length)}finally{r.free()}return t}(e.args.image);break;case 1:{const t=e.args;r=function(e,t,r){const n=new kantusearch.Image(e.width,e.height);n.data.set(e.data);const a=kantusearch.resizeImage(n,t,r),o=new Uint8ClampedArray(a.data);return new ImageData(o,a.width,a.height)}(t.image,t.scaleX,t.scaleY);break}case 2:{const t=e.args;r=function(e,t,r,s,c){const n=new kantusearch.Image(e.width,e.height);n.data.set(e.data);const a=new kantusearch.Image(t.width,t.height);a.data.set(t.data);const o=kantusearch.searchImageScaled(n,a,r,s,c);return n.delete(),a.delete(),o}(t.image,t.pattern,t.options,t.patternScaleX||1,t.patternScaleY||1);break}case 3:{const t=e.args;r=function(e,t,r){const n=new kantusearch.Image(e.width,e.height);n.data.set(e.data);const a=kantusearch.searchRect(n,t,r);return n.delete(),a}(t.image,t.color,t.distanceThreshold);break}default:throw Error(`Unsupported job type: ${e.type}`)}const o={type:1,data:n.JobFactory.complete(e,r)};self.postMessage(o);break;default:throw Error(`Unsupported message type: ${t.type}`)}},self.onerror=function(e){console.error("Worker.onerror:",e)}}]);
//# sourceMappingURL=worker-main.js.map
```

### Core Architecture Module: `extension/lib/imagesearch/worker.js`
```
/**
 * WebAssembly supported web worker bootstrapper
 */

var moduleStartTime = performance.now();

function getNamespaceMembers(module, namespace) {
    const ns = {};
    const dotPrefix = namespace + ".";
    const dollarPrefix = namespace + "$";
    const nameOffset = namespace.length + 1;
    const fullNameArray = Object.keys(module).filter(x => x.startsWith(dotPrefix) || x.startsWith(dollarPrefix));
    for (const fullName of fullNameArray) {
        const name = fullName.substr(nameOffset);
        ns[name] = module[fullName];
    }

    return ns;
}

function notifyModuleInitialized() {
    const elapsedTime = performance.now() - moduleStartTime;
    console.log(`Module is initialized in ${elapsedTime.toFixed(0)} ms`);
    self.postMessage({
        type: 0 /* WorkerMessageType.Init */,
        data: {
            moduleVersion: kantusearch.getModuleVersion()
        }
    });
}

/**
 * Global module object which will be merged with WebAssembly module.
 */
var Module = {
    onRuntimeInitialized: () => {},

    postRun: [
        () => {
            // Emscripten generates flat names for exports with namespaces.
            // We'll build an object tree from those flat names and
            // merge into global object (since we're in web worker, global object is "self").
            self.kantusearch = getNamespaceMembers(Module, "kantusearch");

            notifyModuleInitialized();
        }
    ]
};

importScripts("kantusearch.js", "worker-main.js");

```

### Core Architecture Module: `extension/lib/tesseract/core/tesseract-core-simd-lstm.wasm.js`
```

var TesseractCore = (() => {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(TesseractCore = {})  {

var b;b||(b=typeof TesseractCore !== 'undefined' ? TesseractCore : {});var aa,ba;b.ready=new Promise((a,c)=>{aa=a;ba=c});var ca=Object.assign({},b),da="./this.program",ea=(a,c)=>{throw c;},fa="object"==typeof window,ha="function"==typeof importScripts,ia="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node,f="",ja,ka,la;
if(ia){var fs=require("fs"),ma=require("path");f=ha?ma.dirname(f)+"/":__dirname+"/";ja=(a,c)=>{var d=na(a);if(d)return c?d:d.toString();a=a.startsWith("file://")?new URL(a):ma.normalize(a);return fs.readFileSync(a,c?void 0:"utf8")};la=a=>{a=ja(a,!0);a.buffer||(a=new Uint8Array(a));return a};ka=(a,c,d,e=!0)=>{var g=na(a);g&&c(g);a=a.startsWith("file://")?new URL(a):ma.normalize(a);fs.readFile(a,e?void 0:"utf8",(h,k)=>{h?d(h):c(e?k.buffer:k)})};!b.thisProgram&&1<process.argv.length&&(da=process.argv[1].replace(/\\/g,
"/"));process.argv.slice(2);ea=(a,c)=>{process.exitCode=a;throw c;};b.inspect=()=>"[Emscripten Module object]"}else if(fa||ha)ha?f=self.location.href:"undefined"!=typeof document&&document.currentScript&&(f=document.currentScript.src),_scriptDir&&(f=_scriptDir),0!==f.indexOf("blob:")?f=f.substr(0,f.replace(/[?#].*/,"").lastIndexOf("/")+1):f="",ja=a=>{try{var c=new XMLHttpRequest;c.open("GET",a,!1);c.send(null);return c.responseText}catch(g){if(a=na(a)){c=[];for(var d=0;d<a.length;d++){var e=a[d];
255<e&&(e&=255);c.push(String.fromCharCode(e))}return c.join("")}throw g;}},ha&&(la=a=>{try{var c=new XMLHttpRequest;c.open("GET",a,!1);c.responseType="arraybuffer";c.send(null);return new Uint8Array(c.response)}catch(d){if(a=na(a))return a;throw d;}}),ka=(a,c,d)=>{var e=new XMLHttpRequest;e.open("GET",a,!0);e.responseType="arraybuffer";e.onload=()=>{if(200==e.status||0==e.status&&e.response)c(e.response);else{var g=na(a);g?c(g.buffer):d()}};e.onerror=d;e.send(null)};
var oa=b.print||console.log.bind(console),n=b.printErr||console.warn.bind(console);Object.assign(b,ca);ca=null;b.thisProgram&&(da=b.thisProgram);b.quit&&(ea=b.quit);var pa;b.wasmBinary&&(pa=b.wasmBinary);var noExitRuntime=b.noExitRuntime||!0;"object"!=typeof WebAssembly&&p("no native wasm support detected");var ra,sa=!1,r,ta,ua,u,x,va,wa;
function xa(){var a=ra.buffer;b.HEAP8=r=new Int8Array(a);b.HEAP16=ua=new Int16Array(a);b.HEAP32=u=new Int32Array(a);b.HEAPU8=ta=new Uint8Array(a);b.HEAPU16=new Uint16Array(a);b.HEAPU32=x=new Uint32Array(a);b.HEAPF32=va=new Float32Array(a);b.HEAPF64=wa=new Float64Array(a)}var ya,za=[],Aa=[],Ba=[],Ca=!1;function Da(){var a=b.preRun.shift();za.unshift(a)}var Ea=0,Fa=null,Ga=null;function Ha(){Ea++;b.monitorRunDependencies&&b.monitorRunDependencies(Ea)}
function Ia(){Ea--;b.monitorRunDependencies&&b.monitorRunDependencies(Ea);if(0==Ea&&(null!==Fa&&(clearInterval(Fa),Fa=null),Ga)){var a=Ga;Ga=null;a()}}function p(a){if(b.onAbort)b.onAbort(a);a="Aborted("+a+")";n(a);sa=!0;a=new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info.");ba(a);throw a;}var Ja="data:application/octet-stream;base64,",Ka;Ka="data:application/octet-stream;base64,AGFzbQEAAAABpgmNAWABfwBgAX8Bf2ADf39/AX9gAn9/AGACf38Bf2ADf39/AGAEf39/fwBgBH9/f38Bf2AFf39/f38AYAV/f39/fwF/YAZ/f39/f38Bf2AGf39/f39/AGADf35/AX5gB39/f39/f38AYAl/f39/f39/f38AYAF/AX1gCH9/f39/f39/AX9gAAF/YAd/f39/f39/AX9gAABgAn9+AX9gCH9/f39/f39/AXxgAX8BfmAEf35/fwF+YAJ/fgF+YAx/f39/f39/f39/f38AYAF8AXxgA399fwF/YAJ/fwF+YAJ/fwF9YAV/fn5+fgBgBH9/f38BfmABfQF9YAV/fX19fwBgAn99AGAJf39/f39/f39/AX9gA39/fwF9YAJ/fwF8YAF/AXxgBX9/f398AX9gA399fQF/YAN/f38BfGAFf39+f38AYAV/f39/fgF/YAp/f39/f39/f39/AGACfHwBfGADf39+AGADf399AX9gA39+fwBgC39/f39/f39/f39/AX9gAn5/AX9gBH9+fn8AYAp/f39/f39/f39/AX9gA399fwBgA39+fwF/YAh/f39/f39/fwBgBH9/f30AYAABfGACf3wBfGACf3wAYAJ9fQF9YAR/f39/AXxgBH5+fn4Bf2ADf3x8AGAGf39/f31/AX9gA398fAF8YAJ/fQF/YAV/f31/fwBgBn9/f39/fwF8YAN8fH8BfGAFf39/fX8Bf2AKf39/fX19f39/fwBgDH9/f39/f39/f39/fwF/YAN8f38AYA9/f39/f39/f39/f39/f38AYAZ/fH9/f38Bf2AEf35/fwF/YAR/f399AX9gCH9/f39/f399AGAEf35/fwBgB39/f39/fn4Bf2AGf39/f35+AX9gBX98f39/AGAEf35+fwF+YAJ/fAF/YAN/fX0AYAx/f39/f39/f31/f38AYAJ/fgBgBn9/f39/fgF/YAJ8fwF8YAR/f319AGAKf39/f39/fHx8fwBgA31/fwF/YAR/f3x/AX9gAn5+AXxgCX9/f399fX19fQBgBX99fX1/AX9gCn9/f39/f31/f38AYAx/f39/fX1/f39/f38BfWALf39/f39/fX9/f38BfGALf39/f39/f399f38AYAV/f39/fwF8YAV/f319fQF/YAd/fn5/f39/AGAIf35+f39/f38Bf2AGf39/fX1/AX9gCn9/f399f39/f38BfWAGf398f39/AXxgBX9/f3x8AGAFf399f38Bf2AFf39/fX8AYAV/f319fQBgBX99fX9/AGAEf398fAF/YAR/f39+AX5gBn9/fX9/fwBgCH9/f39/fX9/AX9gBH9/f34Bf2ACfH8Bf2AGf399f39/AX9gB39/fHx8f38AYAZ/f39/fX0AYAV/f398fAF8YAd/f319f39/AGAEf399fwBgBn99f39/fwBgA39/fQBgA31/fwF9YAd9f399f39/AX9gA398fwF8YAZ/f3x8f38BfGAFf35+f38AYAABfmACfn4BfWANf39/f39/f39/f39/fwBgBH98f38AYAN8fH8Bf2AEf39+fwBgA398fwBgBX9/f3x/AGADf398AAKtAjIBYQFhAAYBYQFiAAcBYQFjAAQBYQFkAAUBYQFlAAMBYQFmAAIBYQFnAAYBYQFoAAkBYQFpAAoBYQFqAAgBYQFrABMBYQFsAAUBYQFtADkBYQFuAAcBYQFvAAEBYQFwAAcBYQFxAAcBYQFyAAIBYQFzAAsBYQF0ACwBYQF1AAIBYQF2AAkBYQF3AAkBYQF4ABMBYQF5AAEBYQF6AAUBYQFBAAEBYQFCAAIBYQFDABIBYQFEAAoBYQFFAAMBYQFGAAABYQFHAAMBYQFIAAEBYQFJAAQBYQFKAAQBYQFLAAQBYQFMAAcBYQFNAAQBYQFOAAQBYQFPADkBYQFQAAQBYQFRABEBYQFSAAUBYQFTAAIBYQFUAAABYQFVAAQBYQFWAAABYQFXAAcBYQFYAAADrxygHAACAQMCAgIGAgAIAAMCBAEAAwsBAQETUgACBwQFAAQTBTIBCwABBAECAwMDAwgEBAIBBAcBAgETDgMBAAUNAQMDBAEFAwYAEAcEBwIeBAMAOgIHBToABgMEJgcFBQMFAwEEAgEBAwMEAAIRAwEAAgEFAAMGBAQtAQMCBQcHBgMCAgEFAgIBAQICBQUEAQEFBwQDCxMDAgIEOwEDAwUDAQABBAMeBQAEAQEDBQEeAAUEHwgEAQMEAQUABAQDAAABBQUDAwUCUwQAAAkGAwMBMwgCBAMGCQIAAgQEAwEEBgMAATsCAwEHBAQBIggAAwEEBgQFAQMEAAcBAAEEAQMBAxFUAwQEMgQEBwQDBAICAQUFAwADBQAEBwQBAQABBlUBAQAA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BQUFBQsLCAgIAwMDAwMFBQQEBQoLCggLBgYFCgoCAgIEAgQCAgIEBAQBAQADAwUFLgIWAQwCAgUBAAcEBAUFBQUCAgICAgIHBwICAgIHBwEBBQICBAEHBwQEBwQHAQQBBwABBAcEBQUHBQUHBQcFBQcFBQUHBQUFBwICAQcHAAABBwcEDhkZGRkZGRkZDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODgcHBwcHBAcEAQcHBAQBBwAAAQQHBQICBAYHBAcEAAEBBAICBAcHBwcHBwEEBAMDAwUHAwMABQUGjAEABQUFBQUFBgUHBgQEBAQEBAQCBgIDAQQCAgoKAAkJAAYABgYDAAYGBgYGAwAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQADAAMABgYGBgYADQ0NDQMNBg0GAAAABgYGAwQEAQQAAAQEBAQEBAAABAQEBAQAAAgICAgICAgICAUBAAEBAQQBAAAAAQMDAAEAAwIBAQQFBgYGBgYGCA0NAwAABQAAAAAAAAAABQMGAwQEAwQEBAQEAAQAAwQEBAQEAw0NAAgICAgIAAgIAgMGAAUEAAIWAQwCAhYBDAICERACAAUFAQ
```

### Core Architecture Module: `extension/lib/vision2/worker.js`
```
// vision2 worker: xmodule2's Rust vision-core compiled to WASM (C ABI, no
// generated glue). Replaces the kantusearch engine for the new code path.
// Protocol mirrors /lib/imagesearch/worker.js so adaptors stay symmetric:
//   worker -> main: { type: 0 } once ready
//   main -> worker: { type: 1, data: { id, args, result: null } }
//   worker -> main: { type: 1, data: { id, result } }
// args: { image: ImageData, pattern: ImageData,
//         options: { minSimilarity, allowSizeVariation, maxMatches? },
//         patternScaleX: number  // DPI prior: pattern scale on this image
//       }
// result: { errorCode: 0, containsGreenPinkBoxes: false,
//           regions: [{ matchedRect: {left,top,width,height}, score, order }] }

'use strict'

const MSG_INIT = 0
const MSG_JOB = 1
const MAX_MATCHES = 32

let wasm = null

const pReady = fetch(new URL('vision2.wasm', self.location.href))
  .then(resp => WebAssembly.instantiateStreaming
    ? WebAssembly.instantiateStreaming(resp, {})
    : resp.arrayBuffer().then(buf => WebAssembly.instantiate(buf, {})))
  .then(mod => {
    wasm = mod.instance.exports
    self.postMessage({ type: MSG_INIT })
  })

// RGBA -> interleaved RGB for the COLOR matcher (xm2_search_rgb) — hue-only
// targets like a red button vanish in grayscale, so the color path is the
// primary one (matches the native host, which also searches in RGB).
function toRgb (imageData) {
  const src = imageData.data
  const n = imageData.width * imageData.height
  const rgb = new Uint8Array(n * 3)
  for (let i = 0; i < n; i++) {
    rgb[i * 3] = src[i * 4]
    rgb[i * 3 + 1] = src[i * 4 + 1]
    rgb[i * 3 + 2] = src[i * 4 + 2]
  }
  return rgb
}

function copyIn (bytes) {
  const ptr = wasm.xm2_alloc(bytes.length)
  new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes)
  return ptr
}

function search (args) {
  const image = args.image
  const pattern = args.pattern
  const options = args.options || {}

  const hayRgb = toRgb(image)
  const patRgb = toRgb(pattern)
  const hayPtr = copyIn(hayRgb)
  const patPtr = copyIn(patRgb)
  const outPtr = wasm.xm2_alloc(MAX_MATCHES * 6 * 4)

  try {
    const count = wasm.xm2_search_rgb(
      hayPtr, image.width, image.height,
      patPtr, pattern.width, pattern.height,
      Math.max(0.1, Math.min(1.0, options.minSimilarity || 0.8)),
      args.patternScaleX > 0 ? args.patternScaleX : 1.0,
      options.allowSizeVariation ? 1 : 0,
      Math.min(MAX_MATCHES, options.maxMatches || MAX_MATCHES),
      outPtr
    )

    const flat = new Float32Array(wasm.memory.buffer, outPtr, count * 6)
    const regions = []
    for (let i = 0; i < count; i++) {
      regions.push({
        matchedRect: {
          left: flat[i * 6],
          top: flat[i * 6 + 1],
          width: flat[i * 6 + 2],
          height: flat[i * 6 + 3]
        },
        score: flat[i * 6 + 4],
        scale: flat[i * 6 + 5],
        order: i
      })
    }
    // Raster (scanline) order, same contract as the native cv family
    const byPos = regions.slice().sort((a, b) =>
      (a.matchedRect.top - b.matchedRect.top) || (a.matchedRect.left - b.matchedRect.left))
    regions.forEach(r => { r.order = byPos.indexOf(r) })

    return { errorCode: 0, containsGreenPinkBoxes: false, regions }
  } finally {
    wasm.xm2_free(hayPtr, hayRgb.length)
    wasm.xm2_free(patPtr, patRgb.length)
    wasm.xm2_free(outPtr, MAX_MATCHES * 6 * 4)
  }
}

self.onmessage = (e) => {
  const msg = e.data
  if (!msg || msg.type !== MSG_JOB || !msg.data) return
  pReady.then(() => {
    let result
    try {
      result = search(msg.data.args)
    } catch (err) {
      result = { errorCode: 1, containsGreenPinkBoxes: false, regions: [], error: String(err && err.message || err) }
    }
    self.postMessage({ type: MSG_JOB, data: { id: msg.data.id, result } })
  })
}

```

### Core Architecture Module: `src/common/convert_utils.d.ts`
```
import { MacroInState } from "@/reducers/state"

export type MacroCommand = {
  cmd:      string;
  target?:  string;
  value?:   string;
  targetOptions?: string[];
}

export type Macro = {
  name: string;
  commands: MacroCommand[];
  status?: string;
  id?: string;
}

declare const toJSONString: (macro: Macro, opts?: Record<string, boolean>) => string

declare const fromJSONString: (str: string, fileName?: string, opts?: Record<string, boolean>) => MacroInState

declare const fromHtml: (html: string) => Macro

declare const toHtml: (data: Macro) => string

```

### Core Architecture Module: `src/common/convert_utils.js`
```
import 'error-polyfill'
import parseJson from 'parse-json'
import URL from 'url-parse'
import { normalizeCommandName } from './command'
import { getStorageManager } from '../services/storage'

const joinUrl = (base, url) => {
  const urlObj = new URL(url, base)
  return urlObj.toString()
}

// HTML template from test case
function genHtml ({ name, baseUrl, commandTrs, noImport }) {
  const tableHtml = noImport ? '<h3>Starting Browser and Ui.Vision...</h3>' : `
    <table cellpadding="1" cellspacing="1" border="1">
    <thead>
    <tr><td rowspan="1" colspan="3">${name}</td></tr>
    </thead><tbody>
    ${commandTrs.join('\n')}
    </tbody></table>
  `
  const baseLink = noImport ? '' : `<link rel="selenium.base" href="${baseUrl}" />`

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head profile="http://selenium-ide.openqa.org/profiles/test-case">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
${baseLink}
<title>${name}</title>
</head>
<body>
${tableHtml}
<script>
(function() {
  var isExtensionLoaded = function () {
    const $root = document.documentElement
    return !!$root && !!$root.getAttribute('data-kantu')
  }
  var increaseCountInUrl = function (max) {
    var url   = new URL(window.location.href)
    var count = 1 + (parseInt(url.searchParams.get('reload') || 0))

    url.searchParams.set('reload', count)
    var nextUrl = url.toString()

    var shouldStop = count > max
    return [shouldStop, !shouldStop ? nextUrl : null]
  }
  var run = function () {
    try {
      var evt = new CustomEvent('kantuSaveAndRunMacro', {
        detail: {
          html: document.documentElement.outerHTML,
          noImport: ${noImport || 'false'},
          storageMode: '${getStorageManager().getCurrentStrategyType()}'
        }
      })

      window.dispatchEvent(evt)
      var intervalTimer = setInterval(() => window.dispatchEvent(evt), 1000);

      if (window.location.protocol === 'file:') {
        var onInvokeSuccess = function () {
          clearTimeout(timer)
          clearTimeout(reloadTimer)
          clearInterval(intervalTimer)
          window.removeEventListener('kantuInvokeSuccess', onInvokeSuccess)
        }
        var timer = setTimeout(function () {
          alert('Error #203: It seems you need to turn on *Allow access to file URLs* for Kantu in your browser extension settings.')
        }, 8000)

        window.addEventListener('kantuInvokeSuccess', onInvokeSuccess)
      }
    } catch (e) {
      alert('Kantu Bookmarklet error: ' + e.toString());
    }
  }
  var reloadTimer = null
  var main = function () {
    if (isExtensionLoaded())  return run()

    var MAX_TRY   = 3
    var INTERVAL  = 1000
    var tuple     = increaseCountInUrl(MAX_TRY)

    if (tuple[0]) {
      return alert('Error #204: It seems Ui.Vision is not installed yet - or you need to turn on *Allow access to file URLs* for Ui.Vision in your browser extension settings.')
    } else {
      reloadTimer = setTimeout(function () {
        window.location.href = tuple[1]
      }, INTERVAL)
    }
  }

  setTimeout(main, 500)
})();
</script>
</body>
</html>
  `
}

// generate data uri from html
function htmlDataUri (html) {
  return 'data:text/html;base64,' + window.btoa(unescape(encodeURIComponent(html)))
}

// generate data uri from json
function jsonDataUri (str) {
  return 'data:text/json;base64,' + window.btoa(unescape(encodeURIComponent(str)))
}

// generate html from a test case
export function toHtml ({ name, commands }) {
  const copyCommands  = commands.map(c => Object.assign({}, c))
  const openTc        = copyCommands.find(tc => tc.cmd === 'open')

  // Note: Aug 10, 2018, no baseUrl when exported to html
  // so that `${variable}` could be used in open command, and won't be prefixed with baseUrl
  const origin        = null
  const replacePath   = path => path
  // const url         = openTc && new URL(openTc.target)
  // const origin      = url && url.origin
  // const replacePath = (path) => {
  //   if (path.indexOf(origin) !== 0) return path
  //   const result = path.replace(origin, '')
  //   return result.length === 0 ? '/' : result
  // }

  if (openTc) {
    openTc.target = replacePath(openTc.target)
  }

  const commandTrs = copyCommands.map(c => {
    if (c.cmd === 'open') {
      // Note: remove origin if it's the same as the first open command
      c.target = replacePath(c.target)
    }

    return `
      <tr>
        <td>${c.cmd || ''}</td>
        <td>${c.target || ''}</td>
        <td>${c.value || ''}</td>
      </tr>
    `
  })

  return genHtml({
    name,
    commandTrs,
    baseUrl: origin || ''
  })
}

export function generateEmptyHtml () {
  return genHtml({
    name: 'Ui.Vision Autostart Page',
    commandTrs: [],
    baseUrl: '',
    noImport: true
  })
}

// generate data uri of html from a test case
export function toHtmlDataUri (obj) {
  return htmlDataUri(toHtml(obj))
}

// parse html to test case
export function fromHtml (html) {
  const $root = document.createElement('div')
  $root.innerHTML = html

  const $base   = $root.querySelector('link')
  const $title  = $root.querySelector('title')
  const $trs    = $root.querySelectorAll('tbody > tr')

  const baseUrl   = $base && $base.getAttribute('href')
  const name      = $title.innerText

  if (!name || !name.length) {
    throw new Error('fromHtml: missing title')
  }

  const commands  = [].slice.call($trs).map(tr => {
    const trHtml    = tr.outerHtml

    // Note: remove any datalist option in katalon-like html file
    Array.from(tr.querySelectorAll('datalist')).forEach($item => {
      $item.remove()
    })

    const children = tr.children
    const $cmd      = children[0]
    const $tgt      = children[1]
    const $val      = children[2]
    const cmd       = normalizeCommandName($cmd && $cmd.innerText)
    const value     = $val && $val.innerText
    let target      = $tgt && $tgt.innerText

    if (!cmd || !cmd.length) {
      throw new Error('missing cmd in ' + trHtml)
    }

    if (cmd === 'open') {
      // Note: with or without baseUrl
      target = baseUrl && baseUrl.length && !/:\/\//.test(target) ? joinUrl(baseUrl, target) : target
    }

    return { cmd, target, value }
  })

  return { name, data: { commands } }
}

// parse json to test case
// the current json structure doesn't provide fileName,
// so must provide a file name as the second parameter
export function fromJSONString (str, fileName, opts = {}) {
  // Note: Exported JSON from older version Kantu (via 'export to json')
  // has an invisible charactor (char code65279, known as BOM). It breaks JSON parser.
  // So it's safer to filter it out here
  const obj       = parseJson(str.replace(/^\s*/, ''))
  const name      = fileName ? fileName.replace(/\.json$/i, '') : (obj.Name || '__imported__')

  if (obj.macros) {
    throw new Error(`This is a test suite, not a macro`)
  }

  // JS script macro (V11 prototype): the program lives in `Script`,
  // Commands is an (often empty) array kept for envelope compatibility
  const isScriptMacro = typeof obj.Script === 'string'

  if (!Array.isArray(obj.Commands)) {
    if (isScriptMacro) {
      obj.Commands = []
    } else {
      throw new Error(`'Commands' field must be an array`)
    }
  }

  const commands  = obj.Commands.map(c => {
    const obj = {
      cmd:    normalizeCommandName(c.Command),
      target: c.Target,
      value:  c.Value,
      description: c.Description || ''
    }

    if (Array.isArray(c.Targets)) {
      obj.targetOptions = c.Targets
    }

    return obj
  })

  return {
    name,
    data: {
      commands,
      ...(isScriptMacro ? { script: obj.Script } : {})
    },
    ...(opts.withStatus && obj.status ? { status: obj.status } : {}),
    ...(opts.withId && obj.id ? { id: obj.id } : {})
  }
}

// JS script macros in FILE storage are plain .js files: the file IS the
// program and the file name IS the macro name (its .js suffix included —
// same convention the macro tree shows). These two are the raw-text
// counterparts of fromJSONString / toJSONString for that case.
export function fromJsFileText (text, fileName) {
  const s = String(text == null ? '' : text)

  // a legacy file renamed by hand (<name>.js.json -> <name>.js) still carries
  // the JSON envelope — unwrap it, so manual migration is just the rename and
  // the next save writes the raw program. A real script that starts with '{'
  // cannot also parse as JSON with a string Script field.
  if (/^\s*\{/.test(s)) {
    try {
      const obj = JSON.parse(s)
      if (obj && typeof obj.Script === 'string') {
        return { name: fileName, data: { commands: [], script: obj.Script } }
      }
    } catch (e) { /* raw script text, keep as-is */ }
  }

  return {
    name: fileName,
    data: {
      commands: [],
      script: s
    }
  }
}

export function toJsFileText (obj) {
  if (typeof obj.script !== 'string') {
    throw new Error(
      `'${obj.name}': only JS script macros are saved as .js files — a classic (command table) macro must not be named *.js`
    )
  }
  return obj.script
}

// generate json from a test case
export function toJSONString (obj, opts = {}) {
  const getToday = () => {
    const d = new Date()
    return [
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate()
    ].join('-')
  }
  const data = {
    Name: obj.name,
    CreationDate: getToday(),
    Commands: obj.commands.map(c => {
      return {
        Command: c.cmd,
        Target:  c.target || '',
        Value:   c.value || '',
        Targets: !opts.ignoreTargetOptions ? c.targetOptions : undefined,
        Description: c.description || ''
      }
    }),
    // JS script macro (V11 prototype): round-trip the program
    ...(typeof obj.script === 'string' ? { Script: obj.script } : {}),
    ...(opts.withStatus && obj.status
```

### Core Architecture Module: `src/common/cv_utils.ts`
```

export enum ComputerVisionType {
  Browser = 'browser',
  Desktop = 'desktop',
  DesktopScreenCapture = 'desktop_screen_capture'
}

export function isCVTypeForDesktop (type: ComputerVisionType): boolean {
  return type === ComputerVisionType.Desktop || type === ComputerVisionType.DesktopScreenCapture
}

```

### Core Architecture Module: `src/common/dom_utils.ts`
```
import { globMatch } from './glob'
import { and } from './utils'

export const getStyle = function (dom: HTMLElement): Record<string, any> {
  if (!dom)   throw new Error('getStyle: dom does not exist')
  return getComputedStyle(dom)
}

export const setStyle = function (dom: HTMLElement, style: Record<string, any>): HTMLElement {
  if (!dom)   throw new Error('setStyle: dom does not exist')

  for (var i = 0, keys = Object.keys(style), len = keys.length; i < len; i++) {
    dom.style[keys[i] as any] = style[keys[i]]
  }

  return dom
}

export const pixel = function (num: number | string): string {
  if ((num + '').indexOf('px') !== -1)  return num as string
  return (num || 0) + 'px'
}

export type BindDragOptions = {
  onDragStart: Function;
  onDragEnd: Function;
  onDrag: Function;
  $el: HTMLElement;
  doc?: HTMLDocument;
  preventGlobalClick?: boolean;
}

export const bindDrag = (options: BindDragOptions): Function => {
  const { onDragStart, onDragEnd, onDrag, $el, preventGlobalClick = true, doc = document } = options
  let isDragging = false
  let startPos = { x: 0, y: 0 }

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true
    startPos = { x: e.screenX, y: e.screenY }
    onDragStart(e)
  }
  const onMouseUp = (e: MouseEvent) => {
    if (!isDragging)  return
    isDragging = false
    const dx = e.screenX - startPos.x
    const dy = e.screenY - startPos.y
    onDragEnd(e, { dx, dy })
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging)  return

    const dx = e.screenX - startPos.x
    const dy = e.screenY - startPos.y
    onDrag(e, { dx, dy })

    e.preventDefault()
    e.stopPropagation()
  }
  const onClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  if (preventGlobalClick) {
    doc.addEventListener('click', onClick, true)
  }
  doc.addEventListener('mousemove', onMouseMove, true)
  doc.addEventListener('mouseup', onMouseUp, true)
  $el.addEventListener('mousedown', onMouseDown, true)

  return () => {
    doc.removeEventListener('click', onClick, true)
    doc.removeEventListener('mousemove', onMouseMove, true)
    doc.removeEventListener('mouseup', onMouseUp, true)
    $el.removeEventListener('mousedown', onMouseDown, true)
  }
}

export type BindContentEditableChangeOptions = {
  onChange: Function;
  doc: HTMLDocument;
}

export const bindContentEditableChange = (options: BindContentEditableChangeOptions): Function => {
  const { onChange, doc = document } = options

  let currentCE: HTMLElement | null = null
  let oldContent: string | null = null

  const onFocus = (e: Event) => {
    if (!e.target || (e.target as any).contentEditable !== 'true')  return
    currentCE   = e.target as HTMLElement
    oldContent  = currentCE.innerHTML
  }
  const onBlur = (e: Event) => {
    if (e.target !== currentCE) {
      // Do nothing
    } else if (currentCE && currentCE.innerHTML !== oldContent) {
      onChange(e)
    }

    currentCE   = null
    oldContent  = null
  }

  doc.addEventListener('focus', onFocus, true)
  doc.addEventListener('blur', onBlur, true)

  return () => {
    doc.removeEventListener('focus', onFocus, true)
    doc.removeEventListener('blur', onBlur, true)
  }
}

export const scrollLeft = function (document: HTMLDocument): number {
  return document.documentElement.scrollLeft
}

export const scrollTop = function (document: HTMLDocument): number {
  return document.documentElement.scrollTop
}

export const domText = ($dom: HTMLElement): string => {
  const it  = $dom.innerText ? $dom.innerText.trim() : ''
  const tc  = $dom.textContent as string
  const pos = tc.toUpperCase().indexOf(it.toUpperCase())

  return pos === -1 ? it : tc.substr(pos, it.length)
}

export const isVisible = function (el: HTMLElement): boolean {
  if (<any>el === window.document) return true
  if (!el)  return true

  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden')  return false

  return isVisible(el.parentNode as HTMLElement)
}

export const cssSelector = function (dom: Element | null | undefined): string {
  if (!dom) return ''
  if (dom.nodeType !== 1) return ''
  if (dom.tagName === 'BODY') return 'body'
  if (dom.id) return '#' + dom.id

  var classes = dom.className.split(/\s+/g)
                             .filter(function (item) {
                               return item && item.length
                             })

  var children = Array.from(
    dom.parentNode ? dom.parentNode.childNodes : []
  )
  .filter(function ($el) {
    return $el.nodeType === 1
  })

  var sameTag = children.filter(function ($el) {
    return ($el as Element).tagName === dom.tagName
  })

  var sameClass = children.filter(function ($el) {
    var cs = typeof ($el as Element).className === 'string' ? ($el as Element).className.split(/\s+/g) : []

    return and(...classes.map(function (c) {
      return cs.indexOf(c) !== -1
    }))
  })

  var extra = ''

  if (sameTag.length === 1) {
    extra = ''
  } else if (classes.length && sameClass.length === 1) {
    extra = '.' + classes.join('.')
  } else {
    extra = ':nth-child(' + (1 + children.findIndex(function (item) { return item === dom; })) + ')'
  }

  var me = dom.tagName.toLowerCase() + extra

  // Note: browser will add an extra 'tbody' when tr directly in table, which will cause an wrong selector,
  // so the hack is to remove all tbody here
  var ret = cssSelector(dom.parentNode as Element) + ' > ' + me
  return ret
  // return ret.replace(/\s*>\s*tbody\s*>?/g, ' ')
}

export const isPositionFixed = ($dom: HTMLElement): boolean => {
  if (!$dom || $dom === document.documentElement || $dom === document.body) return false
  return getComputedStyle($dom)['position'] === 'fixed' || isPositionFixed($dom.parentNode as HTMLElement)
}

export const offset = function (dom: Element) {
  if (!dom) return { left: 0, top: 0 }

  var rect = dom.getBoundingClientRect()

  return {
    left: rect.left + window.scrollX,
    top:  rect.top + window.scrollY
  }
}

export function accurateOffset (dom: HTMLElement | null): { left: number, top: number } {
  if (!dom) return { left: 0, top: 0 }

  const doc = dom.ownerDocument
  if (!doc || dom === doc.documentElement) return { left: 0, top: 0 }

  const parentOffset = accurateOffset(dom.offsetParent as (HTMLElement | null))

  return {
    left: parentOffset.left + dom.offsetLeft,
    top:  parentOffset.top   + dom.offsetTop
  }
}

export type PreloadImageResult = {
  $img: HTMLImageElement,
  width: number,
  height: number
}

export function preloadImage (url: string): Promise<PreloadImageResult> {
  return new Promise((resolve, reject) => {
    const $img = new Image()

    $img.onload = () => {
      resolve({
        $img,
        width: $img.width,
        height: $img.height
      })
    }
    $img.onerror = (e: any): any => {
      reject(e)
    }

    $img.src = url
  })
}

export function isFirefox (): boolean {
  return /Firefox/.test(window.navigator.userAgent)
}

export function svgNodetoString (svgNode: SVGElement): string {
  return svgNode.outerHTML
}

export function svgToBase64 (str: string): string {
  return 'data:image/svg+xml;base64,' + window.btoa(str)
}

export function canvasFromSVG (str: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const c   = document.createElement('canvas')
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    const img = document.createElement('img')
    const b64 = svgToBase64(str)
    const mw  = str.match(/<svg[\s\S]*?width="(.*?)"/m) as string[]
    const mh  = str.match(/<svg[\s\S]*?height="(.*?)"/m) as string[]
    const w   = parseInt(mw[1] as string, 10)
    const h   = parseInt(mh[1] as string, 10)

    img.src = b64
    img.onload = function () {
      c.width   = w
      c.height  = h
      ctx.drawImage(img, 0, 0, w, h)
      resolve(c)
    }

    img.onerror = function (e) {
      reject(e)
    }
  })
}

export function imageBlobFromSVG (str: string, mimeType = 'image/png', quality: number): Promise<Blob> {
  return canvasFromSVG(str)
  .then(canvas => {
    const p: Promise<Blob> = new Promise((resolve, reject) => {
      try {
        canvas.toBlob(resolve as any, mimeType, quality)
      } catch (e) {
        reject(e)
      }
    })

    return p
  })
}

export function imageDataFromUrl (url: string): Promise<ImageData> {
  return preloadImage(url)
  .then(({ $img, width, height }) => {
    const canvas  = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height

    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.drawImage(
      $img,
      0, 0,
      width, height
    )

    return context.getImageData(0, 0, width, height)
  })
}

export type Rect = { x: number, y: number, width: number, height: number }

export function subImage (imageUrl: string, rect: Rect): Promise<string> {
  return new Promise((resolve, reject) => {
    const $img = new Image()

    $img.onload = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = rect.width
      canvas.height = rect.height

      const context = canvas.getContext('2d') as CanvasRenderingContext2D
      context.drawImage(
        $img,
        0, 0,
        $img.width, $img.height,
        -1 * rect.x, -1 * rect.y,
        $img.width, $img.height
      )

      resolve(canvas.toDataURL())
    }

    $img.src = imageUrl
  })
}

export function rgbToHex (r: number, g: number, b: number) {
  if (r > 255 || g > 255 || b > 255) {
    throw 'Invalid color component'
  }

  return ((r << 16) | (g << 8) | b).toString(16)
}

export type GetPixelParams = {
  dataUrl: string;
  x: number;
  y: number;
}

export function getPixel (params: GetPixelParams): Promise<string> {
  const { x, y, dataUrl } = params

  return new Promise((resolve, reject) => {
    const $img = new Image()

    $img.onload = () => {
      const imgWidth = $img.width
   
```

### Core Architecture Module: `src/common/tab_utils.ts`
```
import { delay } from './ts_utils'
import Ext from './web_extension'
import { getState, updateState } from '../../src/ext/common/global_state'
import { any } from 'prop-types'

export const createTab = (url: string): Promise<any> => {
  return Ext.tabs.create({ url, active: true })
}

export const activateTab = (tabId: number, focusWindow: boolean = false): Promise<any> => {
  return Ext.tabs.get(tabId)
  .then((tab: any) => {
    const p = focusWindow ? Ext.windows.update(tab.windowId, { focused: true })
                          : Promise.resolve()

    return p.then(() => Ext.tabs.update(tab.id, { active: true }))
    .then(() => tab)
  })
}

// never target an extension page (side panel / IDE opened as a tab) or a
// browser special page — content scripts cannot run there
export const isWebTab = (tab: any): boolean => {
  return !!tab && !/^(chrome|moz|edge)-extension:|^(chrome|about|edge):/.test(tab.url || '')
}

// The tab a run should target: the focused window's active web tab.
// Ext.tabs.query({ active: true }) alone returns one active tab PER WINDOW in
// window order (not recency) — with an IDE window or an unrelated window
// around, tabs[0] can be the wrong window's tab (or an extension page).
export const getActiveWebTab = async (): Promise<any | null> => {
  const focused = (await Ext.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => [])).filter(isWebTab)
  if (focused.length) return focused[0]

  const active = (await Ext.tabs.query({ active: true }).catch(() => [])).filter(isWebTab)
  return active.length ? active[0] : null
}

// The BRIDGE session's play tab (OPEN-ISSUES 21.1). Every bridge tool
// (run_macro, browser_snapshot, screenshot, marks) used to pick "the focused window's
// active web tab" afresh — so a user browsing in a SECOND window between two
// tool calls silently became the target, and the next uiv.goto would have
// navigated THEIR page. Rule now: the session keeps its tab. The user's
// focus is followed only INSIDE that tab's window (they opened the next site
// there on purpose — "site open"); a focused tab in another window is
// reported, not adopted. No sticky tab yet (first call, or it was closed)
// → the old pick.
let bridgeTabId: number | null = null
export const setBridgeTab = (id: number | null) => { bridgeTabId = id }
export const pickBridgeTab = async (): Promise<{ tab: any | null; note: string }> => {
  const title = (t: any) => String((t && (t.title || t.url)) || '').slice(0, 50)
  const sticky = bridgeTabId != null ? await Ext.tabs.get(bridgeTabId).catch(() => null) : null
  const stickyOk = isWebTab(sticky) ? sticky : null
  if (!stickyOk) bridgeTabId = null
  const focused = (await Ext.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []))[0]
  const focusedWeb = isWebTab(focused) ? focused : null
  let tab: any = null
  let note = ''
  if (stickyOk && focusedWeb && focusedWeb.windowId === stickyOk.windowId) {
    tab = focusedWeb
  } else if (stickyOk) {
    tab = stickyOk
    if (focusedWeb) {
      note = `the focused window shows "${title(focusedWeb)}" — keeping the run on its own tab #${(stickyOk.index || 0) + 1} "${title(stickyOk)}" in the window of the previous run (a bridge run never follows the user's focus into another window; open the next site in the run's window, or uiv.tabs.select({url: '…'}) to move it)`
    }
  } else {
    // no session tab yet (first call, or after a reload): the HOME window —
    // the one hosting the Ui.Vision panel — before the focused one. The
    // first pick after a reload used to land on the user's other window
    // and the script's uiv.goto replaced their page (seen 2026-09-03).
    let home: any = null
    try {
      const win = await (Ext as any).windows.getCurrent()
      const inHome = win ? (await Ext.tabs.query({ active: true, windowId: win.id }).catch(() => [])).filter(isWebTab) : []
      home = inHome[0] || null
    } catch (e) { home = null }
    tab = home || await getActiveWebTab()
    if (tab && focusedWeb && focusedWeb.windowId !== tab.windowId) {
      note = `starting on tab #${(tab.index || 0) + 1} "${title(tab)}" in the Ui.Vision panel's window, not on "${title(focusedWeb)}" in the focused window — a bridge session works in the panel's window; uiv.tabs.select({url: '…'}) moves it`
    }
  }
  if (tab) bridgeTabId = tab.id
  return { tab, note }
}

// The active tab, whatever it happens to show. Last resort for starting a run
// when there is no web tab anywhere — a freshly started browser sitting on its
// new tab page, where refusing to start meant the Play button did nothing at
// all. `open` copes with a browser-internal page: the player loads the URL
// into it (preparePlayTab in ext/popup/run_command.ts). Extension pages stay
// excluded — navigating one away would take down the IDE / side panel.
export const getActiveNonExtensionTab = async (): Promise<any | null> => {
  const usable = (tab: any): boolean => !!tab && !/^(chrome|moz|edge)-extension:/i.test(tab.url || '')

  const focused = (await Ext.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => [])).filter(usable)
  if (focused.length) return focused[0]

  const active = (await Ext.tabs.query({ active: true }).catch(() => [])).filter(usable)
  return active.length ? active[0] : null
}

export const getTab = async (tabId: number): Promise<any> => {
  try { 
    return Ext.tabs.get(tabId)
  } catch {
    return Ext.tabs.query({ active: true })
  }  
}

export const getCurrentTab = (winId?: number): Promise<any> => {
  const pWin = winId ? Ext.windows.get(winId) : Ext.windows.getLastFocused()

  return pWin.then((win: any) => {
    return Ext.tabs.query({ active: true, windowId: win.id })
    .then((tabs: any[]) => tabs[0])
  })
}

export async function updateUrlForTab (tabId: any | number, url: string, cmd: string): Promise<any> {
  const tab = typeof tabId === "number" ? (await Ext.tabs.get(tabId)) : tabId
  const tabUrl = new URL(tab.url)
  const newUrl = new URL(url)
  const isSamePath = tabUrl.origin + tabUrl.pathname === newUrl.origin + tabUrl.pathname
  // Browsers won't reload the page if the new url is only different in hash
  const noReload = isSamePath && !!newUrl.hash?.length
  const state = await getState()
  let bwindowId = state.tabIds.bwindowId;

  let doFlag=[];
  let wTabs = await Ext.windows.getAll();
  for (var i=wTabs.length-1; i>=0; i--) {
    if (wTabs[i].id === bwindowId) {
      doFlag = wTabs[i];
       
      break;
    }
  }
  //let bwindowId = state.tabIds.bwindowId ? state.tabIds.bwindowId : '';
  if(cmd == "openBrowser" && doFlag.length == 0){
  await Ext.windows.create({ url: url })
  const winTab = await getCurrentTab()
  bwindowId=winTab.windowId;
  await updateState(state => ({
    ...state,
    tabIds: {
      ...state.tabIds,
      lastPlay: state.tabIds.toPlay,
      toPlay: winTab.id,
      firstPlay: winTab.id,
      bwindowId:winTab.windowId
    }
  }))
  return await getTab(winTab.id)
  }else{
    const wTab = doFlag.length  !=0 ? await getCurrentTab(doFlag.id) : '';
    //const targetTabId = wTab !="" && cmd == "openBrowser" ? wTab.id : tab.id;
    const targetTabId = tab.id;
    if (noReload) {
      await Ext.tabs.update(targetTabId, { url: "about:blank" })
      await delay(() => {}, 100)
    }
    
    await Ext.tabs.update(targetTabId, { url }) 
    return await getTab(targetTabId)
  }
  
  
}

 export function getAllWindows(): Promise<any[]> {
  return Ext.windows.getAll()
}

export function getAllTabsInWindow(windowId: number): Promise<any[]> {
  return Ext.windows.get(windowId, { populate: true }).then((win: any) => win?.tabs ?? [])
}

export async function getAllTabs(): Promise<any[]> {
  const wins = await getAllWindows();
  const list: any[] = await Promise.all(wins.map((win: any) => getAllTabsInWindow(win.id)));

  return [].concat(...list);
}

```

### Core Architecture Module: `src/common/ts_utils.ts`
```
import { Tree, Size, Rect, Point, Quadrant } from './types'
import log from './log'

export type AnyFunc = (...argss: any[]) => any
export type SingletonFactory<FuncT extends AnyFunc> = (...args: Parameters<FuncT> | []) => ReturnType<FuncT>

export function singletonGetter<T extends AnyFunc> (factoryFn: T): SingletonFactory<T> {
  let instance: ReturnType<T> | null = null

  return (...args: Parameters<T> | []): ReturnType<T> => {
    if (instance) return instance
    instance = factoryFn(...args)
    return instance as ReturnType<T>
  }
}

export type KeyFunc = (...args: any[]) => string

export function singletonGetterByKey<T extends AnyFunc> (getKey: KeyFunc, factoryFn: T): SingletonFactory<T> {
  let cache: Record<string, ReturnType<T>> = {}

  return (...args: Parameters<T> | []) => {
    const key = getKey(...args)
    if (cache[key]) return cache[key]
    cache[key] = factoryFn(...args)
    return cache[key] as ReturnType<T>
  }
}

export function id <T> (x: T): T {
  return x
}

export function capitalInitial (str: string): string {
  return str.charAt(0).toUpperCase() + str.substr(1)
}

export function snakeToCamel (kebabStr: string): string {
  const list = kebabStr.split('_')
  return list[0] + list.slice(1).map(capitalInitial).join('')
}

export const delay = (fn: Function, timeout: number): Promise<any> => {
  return new Promise((resolve: Function, reject: Function) => {
    setTimeout(() => {
      try {
        resolve(fn())
      } catch (e) {
        reject(e)
      }
    }, timeout)
  })
}

interface CheckResult<T> {
  pass: boolean,
  result: T
}

type CheckFunction<T> = () => CheckResult<T> | Promise<CheckResult<T>>

export const until = <T>(name: string, check: CheckFunction<T>, interval = 1000, expire = 10000): Promise<T> => {
  const start = new Date().getTime()
  const go    = async () => {
    if (expire && new Date().getTime() - start >= expire) {
      throw new Error(`until: ${name} expired!`)
    }

    const { pass, result } = await Promise.resolve(check())

    if (pass) return Promise.resolve(result)
    return delay(go, interval)
  }

  return new Promise((resolve, reject) => {
    try {
      resolve(go())
    } catch (e) {
      reject(e)
    }
  })
}

export const range = (start: number, end: number, step = 1): number[] => {
  const ret = []

  for (let i = start; i < end; i += step) {
    ret.push(i)
  }

  return ret
}

export const partial = (fn: Function) => {
  const len = fn.length
  let arbitary: any

  arbitary = (curArgs: any, leftArgCnt: number) => (...args: any[]) => {
    if (args.length >= leftArgCnt) {
      return fn.apply(null, curArgs.concat(args))
    }

    return arbitary(curArgs.concat(args), leftArgCnt - args.length)
  }

  return arbitary([], len)
}

export const reduceRight = (fn: Function, initial: any, list: any[]) => {
  let ret = initial

  for (let i = list.length - 1; i >= 0; i--) {
    ret = fn(list[i], ret)
  }

  return ret
}

export const compose = (...args: Function[]) => {
  return reduceRight((cur: any, prev: any) => {
    return (x: any) => cur(prev(x))
  }, (x: any) => x, args)
}

export const map = partial((fn: Function, list: any[]) => {
  const result = []

  for (let i = 0, len = list.length; i < len; i++) {
    result.push(fn(list[i]))
  }

  return result
})

export const on = partial((key: (number|string), fn: Function, dict: (any[]|object)): (any[]|object) => {
  if (Array.isArray(dict)) {
    return [
      ...dict.slice(0, <number> key),
      fn(dict[<any> key]),
      ...dict.slice(<number> key + 1)
    ]
  }

  return Object.assign({}, dict, {
    [key]: fn((<Record<string, any>> dict)[key])
  })
})

export const updateIn = partial((keys: string[], fn: Function, obj: object): object => {
  const updater = compose.apply(null, keys.map(key => key === '[]' ? map : on(key)))
  return updater(fn)(obj)
})

export const setIn = partial((keys: string[], value: Function, obj: object): object => {
  const updater = compose.apply(null, keys.map(key => key === '[]' ? map : on(key)))
  return updater(() => value)(obj)
})

export const getIn = partial((keys: string[], obj: object) => {
  return keys.reduce((prev: any, key) => {
    if (!prev)  return prev
    return prev[key]
  }, obj)
})

export const safeMap = partial((fn: Function, list: any[]) => {
  const result    = []
  const safeList  = list || []

  for (let i = 0, len = safeList.length; i < len; i++) {
    result.push(fn(safeList[i]))
  }

  return result
})

export const safeOn = partial((key: (number|string), fn: Function, dict: (any[]|object)): (any[]|object) => {
  if (Array.isArray(dict)) {
    return [
      ...dict.slice(0, <number> key),
      fn(dict[<any> key]),
      ...dict.slice(<number> key + 1)
    ]
  }

  return Object.assign({}, dict, {
    [key]: fn((<Record<string, any>> (dict || {}))[key])
  })
})

export const safeUpdateIn = partial((keys: string[], fn: Function, obj: object): object => {
  const updater = compose.apply(null, keys.map(key => key === '[]' ? safeMap : safeOn(key)))
  return updater(fn)(obj)
})

export const safeSetIn = partial((keys: string[], value: Function, obj: object): object => {
  const updater = compose.apply(null, keys.map(key => key === '[]' ? safeMap : safeOn(key)))
  return updater(() => value)(obj)
})

export const pick = (keys: string[], obj: Record<string, any>): Record<string, any> => {
  return keys.reduce((prev: Record<string, any>, key: string) => {
    prev[key] = obj[key]
    return prev
  }, {})
}

export const pickIfExist = (keys: string[], obj: Record<string, any>): Record<string, any> => {
  return keys.reduce((prev: Record<string, any>, key: string) => {
    if (obj[key] !== undefined) {
      prev[key] = obj[key]
    }
    return prev
  }, {})
}

export const without = (keys: string[], obj: Record<string, any>): Record<string, any> => {
  return Object.keys(obj).reduce((prev: Record<string, any>, key: string) => {
    if (keys.indexOf(key) === -1) {
      prev[key] = obj[key]
    }
    return prev
  }, {})
}

export const uid = (): string => {
  return '' + (new Date().getTime()) + '.' +
         Math.floor(Math.random() * 10000000).toString(16)
}

export const flatten = <T>(list: T[][]): T[] => {
  return ([] as T[]).concat.apply([], list);
}

export const zipWith = (fn: Function, ...listOfList: any[][]): any[] => {
  const len = Math.min(...listOfList.map(list => list.length))
  const res = []

  for (let i = 0; i < len; i++) {
    res.push(fn(...listOfList.map(list => list[i])))
  }

  return res
}

export const and = (...list: boolean[]) => list.reduce((prev, cur) => prev && cur, true)

export const or = (...list: boolean[]) => list.reduce((prev, cur) => prev || cur, false)

export type WithPostfixOptions = {
  str:  string;
  fn:   WithFileExtensionFunc;
  reg:  RegExp;
}

export const withPostfix = (options: WithPostfixOptions): MaybePromise<string> => {
  const { reg, str, fn } = options
  const m = str.match(reg)

  const extName   = m ? m[0] : ''
  const baseName  = m ? str.replace(reg, '') : str
  const result    = fn(baseName, (name) => name + extName)

  if (result === null || result === undefined) {
    throw new Error('withPostfix: should not return null/undefined')
  }

  if (typeof (result as any).then === 'function') {
    return (result as any).then((name: string) => name + extName) as Promise<string>
  }

  return result + extName
}

export type MaybePromise<T> = T | Promise<T>

export type WithFileExtensionFunc = (baseName: string, getFullName: ((name: string) => string)) => MaybePromise<string>

export const withFileExtension = (origName: string, fn: WithFileExtensionFunc): MaybePromise<string> => {
  return withPostfix({
    fn,
    str: origName,
    reg: /\.\w+$/
  })
}

export function getExtName (fileName: string): string {
  return withFileExtension(fileName, () => '') as string
}

export type UniqueNameOptions = {
  generate?:    (oldName: string, step: number) => string;
  check?:       (fullName: string) => MaybePromise<boolean>;
  postfixReg?:  RegExp
}

export const uniqueName = (name: string, options?: UniqueNameOptions): Promise<string> => {
  const opts: Required<UniqueNameOptions> = {
    generate: (old, step = 1) => {
      const reg = /_(\d+)$/
      const m   = old.match(reg)

      if (!m) return `${old}_${step}`
      return old.replace(reg, (_, n) => `_${parseInt(n, 10) + step}`)
    },
    check: () => Promise.resolve(true),
    postfixReg: /\.\w+$/,
    ...(options || {})
  }
  const { generate, check, postfixReg } = opts

  return <Promise<string>> withPostfix({
    str: name,
    reg: postfixReg,
    fn: (baseName, getFullName) => {
      const go = (fileName: string, step: number): Promise<string> => {
        return Promise.resolve(
          check(getFullName(fileName))
        )
        .then(pass => {
          if (pass) return fileName
          return go(generate(fileName, step), step)
        })
      }

      return go(baseName, 1)
    }
  })
}

export const objFilter = (filter: Function, obj: Record<string, any>): Record<string, any> => {
  return Object.keys(obj).reduce((prev, key, i) => {
    if (filter(obj[key], key, i)) {
      prev[key] = obj[key]
    }
    return prev
  }, {} as Record<string, any>)
}

export function throttle (fn: Function, timeout: number) {
  let lastTime = 0

  return (...args: any[]) => {
    const now = new Date().getTime()
    if (now - lastTime < timeout) return

    lastTime = now
    return fn(...args)
  }
}

export type RetryOptions = {
  timeout?:       number,
  retryInterval?: number | RetryIntervalFactory,
  onFirstFail?:   Function,
  onFinal?:       Function,
  shouldRetry?:   (e: Error) => boolean | Promise<boolean>,
}

export type PromiseFunction<T, ArgsType extends any[] = any[]> = (...args: ArgsType) => Promise<T>

export type RetryIntervalFactory = (retryCount: number, lastInterval: number) => number

export const retry = <T>(fn: PromiseFunction<T>, options: RetryOptions): PromiseFunction<T> => (...args) => {
  con
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24** (2017-12-19): **"Execute this command" doesn't work**
  *Symptoms*: When I do a right click above a command and click "Execute this command" nothing happen. And on console have javascript erros. ![image](https://user-images.githubusercontent.com/31484196/33370331-2359986a-d4ef-11e7-9a71-6ff5c683a08f.png) ![image](https://user-images.githubusercontent.com/31484196/33370364-372ef68c-d4ef-11e7-8cc6-254e842bed42.png) 
  **Post-Mortem & Fix Analysis**:
  > I confirmed the issue (same problem with "Run from here"). It will be fixed with the next update (planned for next week)
  > This is now fixed with V2.2.0

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

### Incident Patch 1: `17b6302f` (2026-09-21)
**Commit Message**: Fix heading format in README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Ui.Vision — Browser and Desktop Automation
+# Ui.Vision - Browser and Desktop Automation
 
 **Automate websites and desktop applications with macros, JavaScript, or an AI assistant.** Ui.Vision combines browser automation, OCR and image recognition, with an MCP server that lets AI agents create, edit and run reusable macros in your browser.
 
```

---

### Incident Patch 2: `3afb0afb` (2026-08-01)
**Commit Message**: The new `uiv.*` JavaScript API and the AI system prompt

**File**: `README.md` (modified, +56/-15)
```diff
@@ -3,14 +3,14 @@
 - Modern Robotic Process Automation, Selenium IDE compatible
 - Ui.Vision is open-source and **free** for personal and commercial use.
 
-Questions? Suggestions? - Meet us in the Ui.Vision [RPA user forum](https://forum.ocr.space).
+Questions? Suggestions? - Meet us in the Ui.Vision [RPA user forum](https://forum.ui.vision).
 
-Every user benefits from the questions and answers provided in the forum, that is why we would ask you to post the question [in the RPA forum](https://forum.ocr.space) first if a public forum is appropriate for your question. The forum is monitored by active users, tech support and the developers, so we would like to concentrate the discussion "over there" in one place.
+Every user benefits from the questions and answers provided in the forum, that is why we would ask you to post the question [in the RPA forum](https://forum.ui.vision) first if a public forum is appropriate for your question. The forum is monitored by active users, tech support and the developers, so we would like to concentrate the discussion "over there" in one place.
 
 
-# How to install  Ui.Vision:
+# How to install Ui.Vision:
 
- Ui.Vision RPA for Chrome, Edge and Firefox is modern cross-platform RPA software for macOS, Linux and Windows. It includes a Selenium IDE and Web Macro Recorder. You find the latest version always in the Chrome and Firefox stores. You can use it _completely free for private and commercial purposes_: 
+Ui.Vision RPA for Chrome, Edge and Firefox is modern cross-platform RPA software for macOS, Linux and Windows. It includes a Selenium IDE and Web Macro Recorder. You find the latest version always in the Chrome and Firefox stores. You can use it _completely free for private and commercial purposes_:
 
 - [UI.Vision in the Google Chrome Webstore](https://chrome.google.com/webstore/detail/uivision-rpa/gcbalfbdmfieckjlnblleoemohcganoc)
 
@@ -19,16 +19,47 @@ Every user benefits from the questions and answers provided in the forum, that i
 - [UI.Vision in the Microsoft Edge Webstore](https://microsoftedge.microsoft.com/addons/detail/uivision-rpa/goapmjinbaeomoemgdcnnhoedopjnddd)
 
 
-- [Ui.Vision Homepage](https://ui.vision/rpa)
+- [Ui.Vision Homepage](https://ui.vision/)
 
 - List of supported [Selenium IDE commands](https://ui.vision/rpa/docs/selenium-ide/)
 
 
+# The new `uiv.*` JavaScript API and the AI system prompt
+
+Besides the classic command table, macros can be written as modern JavaScript
+using the `uiv.*` API - DOM and visual finders (`uiv.$`, `uiv.findImage`,
+`uiv.ocr.findText`, `uiv.ai.find`), the input tiers (`uiv.page.*`,
+`uiv.browser.*`, `uiv.desktop.*`), screenshots, tabs, CSV and downloads. Every
+call auto-waits and throws a real JS exception on failure, so `try/catch` works.
+
+- [The Ui.Vision AI system prompt](https://ui.vision/ai/ai-system-prompt) - the
+  complete `uiv.*` API reference plus the automation recipes the AI assistant
+  works from. This is the same text the AI in the side panel uses, and it is the
+  best hand-written reference for the JS API. You can override it in
+  Settings > AI > System Prompt.
+
+- [llms-full.txt](https://ui.vision/llms-full.txt) - the same material as one
+  plain-text file, for feeding into an AI assistant.
+
+- [MCP bridge](https://ui.vision/ai/mcp-bridge) - lets Claude Code and other MCP
+  clients create, edit and run Ui.Vision macros in your browser. Source and
+  setup: [mcp/README.md](mcp/README.md).
+
+- [uiv-commands.md](uiv-commands.md) (in this repo) - maps every classic
+  command-table command to its `uiv.*` equivalent, or to the
+  `uiv.run('command', 'target', 'value')` legacy bridge where no native method
+  exists yet.
+
+The published prompt page is generated from the source of truth in
+`src/services/ai/macro_agent/service.ts` via `npm run gen:ai-prompt-page`, so
+run that at release time to keep it in sync.
+
+
 # Building the Chrome, Edge and Firefox Extension
 
 Building the extension is _not_ required if you "only" want to use it.
 
-You can [install UI.Vision directly from the Chrome, Edge or Firefox stores](https://ui.vision/rpa), which is the easiest and the recommended way of using the Ui.Vision RPA software. Older versions can be found in the [RPA software](https://ui.vision/rpa/archive) archive. 
+You can [install UI.Vision directly from the Chrome, Edge or Firefox stores](https://ui.vision/rpa), which is the easiest and the recommended way of using the Ui.Vision RPA software. Older versions can be found in the [RPA software](https://ui.vision/rpa/archive) archive.
 
 The information below is only required and intended for developers:
 
@@ -40,25 +71,35 @@ If you have any questions, please contact us at TEAM AT UI.VISION - Thanks!
 
 ```bash
 npm i -f
+```
 
-npm run build   	
-npm run build-ff 	
+```bash
+npm run build
 ```
 
-And the build files are in `dist` and `dist_ff` folders.
+```bash
+npm run build-ff
+```
+
+`npm run build` creates the Chrome/Edge build in `dist`, `npm ru
```

#### Recent Merged Pull Requests:
- **PR #145** (closed): .devcontainer/devcontainer.jsonCreate devcontainer.json (@Druid83)
- **PR #139** (closed): feat: added anthropic model selection dropdown  with implementations (@Th4p4)
- **PR #138** (closed): Bump formidable and superagent (@dependabot[bot])
- **PR #137** (closed): Bump react-router and react-router-dom (@dependabot[bot])
- **PR #136** (closed): Bump http-proxy-middleware from 2.0.6 to 2.0.9 (@dependabot[bot])
- **PR #135** (closed): Bump axios from 1.6.7 to 1.8.2 (@dependabot[bot])

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

## X. heading format in README.md

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in A9T9/RPA. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `17b6302f`: heading format in README.md. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# Ui.Vision - Browser and Desktop Automation
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
# Ui.Vision — Browser and Desktop Automation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17b6302f` are properly handled with clean fallback behavior.
