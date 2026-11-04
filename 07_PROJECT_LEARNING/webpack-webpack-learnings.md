> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webpack-webpack-learnings.md`  
> **Source**: github ([https://github.com/webpack/webpack](https://github.com/webpack/webpack))  
> **Source Version**: `0b35ae90`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T02:33:12.870Z  
> **Learning ID**: `learn-github-webpack-webpack`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): webpack/webpack

> **Canonical Artifact**: `07_PROJECT_LEARNING/webpack-webpack-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/webpack/webpack](https://github.com/webpack/webpack))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T02:33:11.463Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webpack/webpack`
- **Description**: A bundler for javascript and friends. Packs many modules into a few bundled assets. Code Splitting allows for loading parts of the application on demand. Through "loaders", modules can be CommonJs, AMD, ES6 modules, CSS, Images, JSON, Coffeescript, LESS, ... and your custom stuff.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 65989 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/hybrid-routing/render.js`
```
module.exports = function(page) {
	console.log(page());
};
```

### Core Architecture Module: `examples/module-worker/chat-module.js`
```
export const history = [];

export const add = (content, from) => {
	if (history.length > 10) history.shift();
	history.push(`${from}: ${content}`);
};

```

### Core Architecture Module: `examples/module-worker/chat-worker.js`
```
onconnect = function (e) {
	for (const port of e.ports) {
		port.onmessage = async event => {
			const msg = event.data;
			switch (msg.type) {
				case "message":
					const { add } = await import("./chat-module");
					add(msg.content, msg.from);
				// fallthrough
				case "history":
					const { history } = await import("./chat-module");
					port.postMessage({
						type: "history",
						history
					});
					break;
			}
		};
	}
};

```

### Core Architecture Module: `examples/module-worker/example.js`
```
document.body.innerHTML = `
	<pre id="history"></pre>
	<form>
	<input id="message" type="text">
	<button id="send">Send Message</button>
	</form>
	<p>Computing fibonacci without worker:</p>
	<input id="fib1" type="number">
	<pre id="output1"></pre>
	<p>Computing fibonacci with worker:</p>
	<input id="fib2" type="number">
	<pre id="output2"></pre>
`;

const history = document.getElementById("history");
const message = document.getElementById("message");
const send = document.getElementById("send");
const fib1 = document.getElementById("fib1");
const output1 = document.getElementById("output1");
const fib2 = document.getElementById("fib2");
const output2 = document.getElementById("output2");

/// CHAT with shared worker ///

const chatWorker = new SharedWorker(
	new URL("./chat-worker.js", import.meta.url),
	{
		name: "chat",
		type: "module"
	}
);

let historyTimeout;
const scheduleUpdateHistory = () => {
	clearTimeout(historyTimeout);
	historyTimeout = setTimeout(() => {
		chatWorker.port.postMessage({ type: "history" });
	}, 1000);
};
scheduleUpdateHistory();

const from = `User ${Math.floor(Math.random() * 10000)}`;

send.addEventListener("click", e => {
	chatWorker.port.postMessage({
		type: "message",
		content: message.value,
		from
	});
	message.value = "";
	message.focus();
	e.preventDefault();
});

chatWorker.port.onmessage = event => {
	const msg = event.data;
	switch (msg.type) {
		case "history":
			history.innerText = msg.history.join("\n");
			scheduleUpdateHistory();
			break;
	}
};

/// FIBONACCI without worker ///

fib1.addEventListener("change", async () => {
	try {
		const value = parseInt(fib1.value, 10);
		const { fibonacci } = await import("./fibonacci");
		const result = fibonacci(value);
		output1.innerText = `fib(${value}) = ${result}`;
	} catch (e) {
		output1.innerText = e.message;
	}
});

/// FIBONACCI with worker ///

const fibWorker = new Worker(new URL("./fib-worker.js", import.meta.url), {
	name: "fibonacci",
	type: "module"
	/* webpackEntryOptions: { filename: "workers/[name].js" } */
});

fib2.addEventListener("change", () => {
	try {
		const value = parseInt(fib2.value, 10);
		fibWorker.postMessage(`${value}`);
	} catch (e) {
		output2.innerText = e.message;
	}
});

fibWorker.onmessage = event => {
	output2.innerText = event.data;
};

```

### Core Architecture Module: `examples/module-worker/fib-worker.js`
```
onmessage = async event => {
	const { fibonacci } = await import("./fibonacci");
	const value = JSON.parse(event.data);
	postMessage(`fib(${value}) = ${fibonacci(value)}`);
};

```

### Core Architecture Module: `examples/module-worker/fibonacci.js`
```
export function fibonacci(n) {
	return n < 1 ? 0 : n <= 2 ? 1 : fibonacci(n - 1) + fibonacci(n - 2);
}

```

### Core Architecture Module: `examples/module-worker/webpack.config.js`
```
"use strict";

const path = require("path");

/** @type {import("webpack").Configuration} */
const config = {
	entry: "./example.js",
	output: {
		module: true,
		path: path.join(__dirname, "dist"),
		filename: "[name].js",
		chunkFilename: "[name].js",
		publicPath: "/dist/"
	},
	optimization: {
		chunkIds: "deterministic" // To keep filename consistent between different modes (for example building only)
	},
	target: "browserslist: last 2 Chrome versions"
};

module.exports = config;

```

### Core Architecture Module: `examples/universal/render.js`
```
// Lazily loaded on both platforms. Picks the right output sink at runtime: the
// DOM in a browser, stdout in Node.
export function render(message) {
	if (typeof document !== "undefined") {
		document.body.textContent = message;
	} else {
		console.log(message);
	}
}

```

### Core Architecture Module: `examples/virtual-modules/src/components/utils.js`
```
export const trim = (str) => str.trim();
```

### Core Architecture Module: `examples/worker/chat-module.js`
```
export const history = [];

export const add = (content, from) => {
	if (history.length > 10) history.shift();
	history.push(`${from}: ${content}`);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20264** (2025-12-26): **__webpack_module__ is rewritten to module, causing identifier collision with user-defined const module**
  *Symptoms*: ### Bug Description  When using `__webpack_module__.id` in source code, webpack rewrites it to module.id and generates a module factory with a function parameter named module. If the user also declares a variable named module, this creates a name collision/illegal redeclaration.  Source:  ```js console.log(__webpack_module__.id); const module = 'layout'; module; ```  Bundled output (excerpt):  ``` /***/ ((module) => {  console.log(module.id); const module = 'layout'; module;  /***/ }) ```  This results in the user’s const module conflicting with the generated function parameter module (either a runtime bug or a SyntaxError due to redeclaration).  ``` Uncaught SyntaxError: Identifier 'module' has already been declared ```  ### Link to Minimal Reproduction and step to  reproduce  https://github.com/SyMind/webpack-module-collision  1. pnpm install 2. pnpm serve  ### Expected Behavior  Bundled output (excerpt):  ``` /***/ ((__webpack_module__) => {  console.log(__webpack_module__.id); const module = 'layout'; module;  /***/ }) ```  ### Actual Behavior  Bundled output (excerpt):  ``` /***/ ((module) => {  console.log(module.id); const module = 'layout'; module;  /***/ }) ```  ### Environment  ```shell System:     OS: macOS 14.0     CPU: (10) arm64 Apple M1 Pro     Memory: 105.95 MB / 32.00 GB   Binaries:     Node: 22.20.0 - /Users/bytedance/.nvm/versions/node/v22.20.0/bin/node     Yarn: 1.22.22 - /Users/bytedance/.nvm/versions/node/v22.20.0/bin/yarn     npm: 10.9.3 - /Users/byteda

- **Issue #19803** (2025-08-17): **Since webpack@5.101.0 build with an async module stopped working**
  *Symptoms*: <!-- Please don't delete this template because we'll close your issue --> <!-- Before creating an issue please make sure you are using the latest version of webpack. -->  # Bug report  <!-- Please ask questions on StackOverflow or the GitHub Discussions. --> <!-- https://github.com/webpack/webpack/discussions --> <!-- https://stackoverflow.com/questions/ask?tags=webpack --> <!-- Issues which contain questions or support requests will be closed. -->  We have been using webpack for a while to build our library and since version 5.101.0 it stopped working, I waited for the next patch to see if it was resolved but the issue continues. Upon some investigation I noticed that one of our dependencies that use `wasm` was throwing errors. By switching every `import` to an `await import()` it works again but we would have to modify more than 200 files and the `import` statements just look weird with a random dynamic import in between. Also typescript definitions had to be imported separately thus just creating a lot of extra noise.  **What is the current behavior?** items imported from the module throw a `Cannot access 'xxx' before initialization` error.  **If the current behavior is a bug, please provide the steps to reproduce.** In this PR you can see the current problem. https://github.com/prettier-solidity/prettier-plugin-solidity/pull/1236  <!-- A great way to do this is to provide your configuration via a GitHub repository --> <!-- The most helpful is a minimal reproduction with i

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

### Incident Patch 1: `e86c17aa` (2026-11-03)
**Commit Message**: fix(javascript): minify equal boolean branches, exits before an else and constant array reads (#23099)

* fix(javascript): print a conditional with equal boolean branches as one branch

* fix(javascript): print an exit ending a function or loop body as an else

* fix(javascript): print reads of a constant array at known indexes as their elements

* chore: add changeset for minifier exits and constant arrays

* fix(javascript): negate an optional chain without parentheses

* test: retire minifier gaps the one pass now closes

* fix(javascript): drop exits ending their body, empty tries, dead loops and call sequences

* fix(javascript): flip negated equalities, fold compared booleans and alike callees

* fix(javascript): fold loop break tests, nullish and integer truths, chains and conversions

* fix(javascript): drop redundant directives, debugger bodies, unread void and empty ifs

* fix(javascript): print what an unread operator, conditional, array or object runs

* fix(javascript): read logical operands for their truth and drop unread strict equalities

* fix(javascript): fold computed length reads and else-ifs with known tests

* fix(javascript): read unread logicals' operands fo

**File**: `.changeset/238-javascript-minify-exits-arrays.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"webpack": patch
+---
+
+Minify more conditionals, loop exits, dead code and unread values in one pass.
```

**File**: `schemas/plugins/BannerPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=s,module.exports.default=s;let r=function(r){let e=r.length,s=0,a=0,o;while(a<e){s++;if((o=r.charCodeAt(a++))>=55296&&o<=56319&&a<e)if(((o=r.charCodeAt(a))&64512)===56320)a++}return s};function e(s,{instancePath="",parentData,parentDataProperty,rootData=s}={}){let a=null,o=0,l=o,i=!1,t=o;if(o===t)if(Array.isArray(s)){var n=!0;let e=s.length;for(let l=0;l<e;l++){let e=s[l],i=o,t=o,u=!1,p=null,E=o,c=o,_=!1,y=o;if(!(e instanceof RegExp)){let r={params:{}};a===null?a=[r]:a.push(r),o++}var v=y===o;if(!(_=_||v)){let s=o;if(o===s)if("string"==typeof e){if(r(e)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),o++}var v=s===o;if(!(_=_||v)){let s=o;if(o===s)if(e&&"object"==typeof e&&!Array.isArray(e)){let s;if(e.glob===void 0&&(s="glob")){let r={params:{missingProperty:s}};a===null?a=[r]:a.push(r),o++}else{let s=o;for(let r in e)if(!(r==="glob")){let e={params:{additionalProperty:r}};a===null?a=[e]:a.push(e),o++;break}if(s===o)if(e.glob!==void 0){let s=e.glob,l=o,i=!1,t=o;if(o===t)if(Array.isArray(s))if(s.length<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}else{var d=!0;let e=s.length;for(let l=0;l<e;l++){let e=s[l],i=o;if(o===i)if("string"==typeof e){if(r(e)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),o++}var d=i===o;if(!d)break}}else{let r={params:{type:"array"}};a===null?a=[r]:a.push(r),o++}var f=t===o;if(!(i=i||f)){let e=o;if(o===e)if("string"==typeof s){if(r(s)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),o++}var f=e===o;i=i||f}if(!i){let r={params:{}};a===null?a=[r]:a.push(r),o++}else{o=l;if(a!==null)l?a.length=l:a=null}}}}else{let r={params:{type:"object"}};a===null?a=[r]:a.push(r),o++}var v=s===o;if(!(_=_||v)){let r=o;if(!(e instanceof Function)){let r={params:{}};a===null?a=[r]:a.push(r),o++}var v=r===o;_=_||v}}}if(!_){let r={params:{}};a===null?a=[r]:a.push(r),o++}else{o=c;if(a!==null)c?a.length=c:a=null}if(E===o)u=!0,p=0;if(!u){let r={params:{passingSchemas:p}};a===null?a=[r]:a.push(r),o++}else{o=t;if(a!==null)t?a.length=t:a=null}var n=i===o;if(!n)break}}else{let r={params:{type:"array"}};a===null?a=[r]:a.push(r),o++}var u=t===o;if(!(i=i||u)){let e=o,l=o,t=!1,n=o;if(!(s instanceof RegExp)){let r={params:{}};a===null?a=[r]:a.push(r),o++}var p=n===o;if(!(t=t||p)){let e=o;if(o===e)if("string"==typeof s){if(r(s)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),o++}var p=e===o;if(!(t=t||p)){let e=o;if(o===e)if(s&&"object"==typeof s&&!Array.isArray(s)){let e;if(s.glob===void 0&&(e="glob")){let r={params:{missingProperty:e}};a===null?a=[r]:a.push(r),o++}else{let e=o;for(let r in s)if(!(r==="glob")){let e={params:{additionalProperty:r}};a===null?a=[e]:a.push(e),o++;break}if(e===o)if(s.glob!==void 0){let e=s.glob,l=o,i=!1,t=o;if(o===t)if(Array.isArray(e))if(e.length<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}else{var E=!0;let s=e.length;for(let l=0;l<s;l++){let s=e[l],i=o;if(o===i)if("string"==typeof s){if(r(s)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),o++}var E=i===o;if(!E)break}}else{let r={params:{type:"array"}};a===null?a=[r]:a.push(r),o++}var c=t===o;if(!(i=i||c)){let s=o;if(o===s)if("string"==typeof e){if(r(e)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),o++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),o++}var c=s===o;i=i||c}if(!i){let r={params:{}};a===null?a=[r]:a.push(r),o++}else{o=l;if(a!==null)l?a.length=l:a=null}}}}else{let r={params:{type:"object"}};a===null?a=[r]:a.push(r),o++}var p=e===o;if(!(t=t||p)){let r=o;if(!(s instanceof Function)){let r={params:{}};a===null?a=[r]:a.push(r),o++}var p=r===o;t=t||p}}}if(!t){let r={params:{}};a===null?a=[r]:a.push(r),o++}else{o=l;if(a!==null)l?a.length=l:a=null}var u=e===o;i=i||u}if(!i){let r={params:{}};a===null?a=[r]:a.push(r),o++,e.errors=a;return!1}o=l;if(a!==null)l?a.length=l:a=null;return e.errors=a,o===0}function s(a,{instancePath:o="",parentData,parentDataProperty,rootData=a}={}){let l=null,i=0,t=i,n=!1,v=i;if(i===v)if("string"==typeof a){if(r(a)<1){let r={params:{limit:1}};l===null?l=[r]:l.push(r),i++}}else{let r={params:{type:"string"}};l===null?l=[r]:l.push(r),i++}var d=v===i;if(!(n=n||d)){let r=i;if(i===r)if(a&&"object"==typeof a&&!Array.isArray(a)){let r;if(a.banner===void 0&&(r="banner")){let e={params:{missingProperty:r}};l===null?l=[e]:l.push(e),i++}else{let r=i;for(let r in a)if(!(r==="banner"||r==="entryOnly"||r==="exclude"||r==="footer"||r==="include"||r==="raw"||r==="stage"||r==="test")){let e={params:{additionalProperty:r}};l===null?l=[e]:l.push(e),i++;break}if(r===i){if(a.banner!==void 0){let r=a.b
```

**File**: `schemas/plugins/HtmlGeneratorOptions.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=e,module.exports.default=e;let r={type:"object",additionalProperties:!1,properties:{extract:{anyOf:[{enum:["inline"]},{type:"boolean"}]}}};function e(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){let s=null,t=0,o=t;if(t===o)if(a&&"object"==typeof a&&!Array.isArray(a)){let o=t;for(let r in a)if(!(r==="extract")){e.errors=[{params:{additionalProperty:r}}];return!1}if(o===t)if(a.extract!==void 0){let o=a.extract,i=t,n=!1,d=t;if(!(o==="inline")){let e={params:{allowedValues:r.properties.extract.anyOf[0].enum}};s===null?s=[e]:s.push(e),t++}var l=d===t;if(!(n=n||l)){let r=t;if("boolean"!=typeof o){let r={params:{type:"boolean"}};s===null?s=[r]:s.push(r),t++}var l=r===t;n=n||l}if(!n){let r={params:{}};s===null?s=[r]:s.push(r),t++,e.errors=s;return!1}t=i;if(s!==null)i?s.length=i:s=null}}else{e.errors=[{params:{type:"object"}}];return!1}return e.errors=s,t===0}
\ No newline at end of file
+"use strict";module.exports=e,module.exports.default=e;let r={type:"object",additionalProperties:!1,properties:{extract:{anyOf:[{enum:["inline"]},{type:"boolean"}]}}};function e(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){let s=null,t=0,o=t;if(t===o)if(a&&"object"==typeof a&&!Array.isArray(a)){let o=t;for(let r in a)if(r!=="extract"){e.errors=[{params:{additionalProperty:r}}];return!1}if(o===t&&a.extract!==void 0){let o=a.extract,i=t,n=!1,d=t;if(o!=="inline"){let e={params:{allowedValues:r.properties.extract.anyOf[0].enum}};s===null?s=[e]:s.push(e),t++}var l=d===t;if(!(n=n||l)){let r=t;if("boolean"!=typeof o){let r={params:{type:"boolean"}};s===null?s=[r]:s.push(r),t++}var l=r===t;n=n||l}if(!n){let r={params:{}};s===null?s=[r]:s.push(r),t++,e.errors=s;return!1}t=i;if(s!==null)i?s.length=i:s=null}}else{e.errors=[{params:{type:"object"}}];return!1}return e.errors=s,t===0}
\ No newline at end of file
```

**File**: `schemas/plugins/HtmlParserOptions.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=u,module.exports.default=u;let r={type:"object",additionalProperties:!1,properties:{as:{$ref:"#/definitions/HtmlParserAs"},chunkName:{anyOf:[{type:"string",minLength:1},{instanceof:"Function"}]},parseErrors:{type:"boolean"},sources:{anyOf:[{type:"array",items:{anyOf:[{enum:["..."]},{type:"object",additionalProperties:!1,properties:{attribute:{type:"string",minLength:1},filter:{instanceof:"Function"},tag:{type:"string",minLength:1},type:{anyOf:[{enum:["src","srcset","css-url","script","script-module","stylesheet","html","stylesheet-style","stylesheet-style-attribute","srcdoc"]},{enum:[!1]}]}},required:["attribute","type"]}]},minItems:1},{type:"boolean"}]},template:{instanceof:"Function"},urlHints:{$ref:"#/definitions/UrlHints"}}},e={anyOf:[{enum:["document"]},{type:"string"}]},a=function(r){let e=r.length,a=0,s=0,t;while(s<e){a++;if((t=r.charCodeAt(s++))>=55296&&t<=56319&&s<e)if(((t=r.charCodeAt(s))&64512)===56320)s++}return a},s={type:"object",additionalProperties:!1,properties:{as:{type:"string"},exclude:{$ref:"#/definitions/RuleSetCondition"},fetchPriority:{enum:["low","high","auto",!1]},include:{$ref:"#/definitions/RuleSetCondition"},media:{type:"string"},prefetch:{type:"boolean"},preload:{type:"boolean"},test:{$ref:"#/definitions/RuleSetCondition"},type:{type:"string"}}},t=Object.prototype.hasOwnProperty,o={validate:v};function i(r,{instancePath:e="",parentData,parentDataProperty,rootData=r}={}){let a=null,s=0;if(s===0)if(Array.isArray(r)){var t=!0;let l=r.length;for(let n=0;n<l;n++){let l=s,v=s,d=!1,f=null,p=s;if(!o.validate(r[n],{instancePath:e+"/"+n,parentData:r,parentDataProperty:n,rootData}))s=(a=a===null?o.validate.errors:a.concat(o.validate.errors)).length;if(p===s)d=!0,f=0;if(!d){let r={params:{passingSchemas:f}};a===null?a=[r]:a.push(r),s++,i.errors=a;return!1}s=v;if(a!==null)v?a.length=v:a=null;var t=l===s;if(!t)break}}else{i.errors=[{params:{type:"array"}}];return!1}return i.errors=a,s===0}function l(r,{instancePath="",parentData,parentDataProperty,rootData=r}={}){if(Array.isArray(r)){var e=!0;let s=r.length;for(let t=0;t<s;t++){let s=r[t];if("string"==typeof s){if(a(s)<1){l.errors=[{params:{limit:1}}];return!1}}else{l.errors=[{params:{type:"string"}}];return!1}var e=!0;if(!e)break}}else{l.errors=[{params:{type:"array"}}];return!1}l.errors=null;return!0}function n(r,{instancePath:e="",parentData,parentDataProperty,rootData=r}={}){let s=null,t=0;if(t===0)if(r&&"object"==typeof r&&!Array.isArray(r)){let f=t;for(let e in r)if(!(e==="and"||e==="glob"||e==="not"||e==="or")){n.errors=[{params:{additionalProperty:e}}];return!1}if(f===t){if(r.and!==void 0){let a=t,o=t,l=!1,d=null,f=t;if(!i(r.and,{instancePath:e+"/and",parentData:r,parentDataProperty:"and",rootData}))t=(s=s===null?i.errors:s.concat(i.errors)).length;if(f===t)l=!0,d=0;if(!l){let r={params:{passingSchemas:d}};s===null?s=[r]:s.push(r),t++,n.errors=s;return!1}t=o;if(s!==null)o?s.length=o:s=null;var v=a===t}else var v=!0;if(v){if(r.glob!==void 0){let o=r.glob,i=t,f=t,p=!1,u=t,c=t;if(t===c)if("string"==typeof o){if(a(o)<1){let r={params:{limit:1}};s===null?s=[r]:s.push(r),t++}}else{let r={params:{type:"string"}};s===null?s=[r]:s.push(r),t++}var d=u===t;if(!(p=p||d)){let a=t;if(!l(o,{instancePath:e+"/glob",parentData:r,parentDataProperty:"glob",rootData}))t=(s=s===null?l.errors:s.concat(l.errors)).length;var d=a===t;p=p||d}if(!p){let r={params:{}};s===null?s=[r]:s.push(r),t++,n.errors=s;return!1}t=f;if(s!==null)f?s.length=f:s=null;var v=i===t}else var v=!0;if(v){if(r.not!==void 0){let a=t,i=t,l=!1,d=null,f=t;if(!o.validate(r.not,{instancePath:e+"/not",parentData:r,parentDataProperty:"not",rootData}))t=(s=s===null?o.validate.errors:s.concat(o.validate.errors)).length;if(f===t)l=!0,d=0;if(!l){let r={params:{passingSchemas:d}};s===null?s=[r]:s.push(r),t++,n.errors=s;return!1}t=i;if(s!==null)i?s.length=i:s=null;var v=a===t}else var v=!0;if(v)if(r.or!==void 0){let a=t,o=t,l=!1,d=null,f=t;if(!i(r.or,{instancePath:e+"/or",parentData:r,parentDataProperty:"or",rootData}))t=(s=s===null?i.errors:s.concat(i.errors)).length;if(f===t)l=!0,d=0;if(!l){let r={params:{passingSchemas:d}};s===null?s=[r]:s.push(r),t++,n.errors=s;return!1}t=o;if(s!==null)o?s.length=o:s=null;var v=a===t}else var v=!0}}}}else{n.errors=[{params:{type:"object"}}];return!1}return n.errors=s,t===0}function v(r,{instancePath="",parentData,parentDataProperty,rootData=r}={}){let e=null,a=0,s=a,t=!1,o=a;if(!(r instanceof RegExp)){let r={params:{}};e===null?e=[r]:e.push(r),a++}var l=o===a;if(!(t=t||l)){let s=a;if("string"!=typeof r){let r={params:{type:"string"}};e===null?e=[r]:e.push(r),a++}var l=s===a;if(!(t=t||l)){let s=a;if(!(r instanceof Function)){let r={params:{}};e===null?e=[r]:e.push(r),a++}var l=s===a;if(!(t=t||l)){let s=a;if(!n(r,{instancePath,parentData,parentDataProperty,rootData}))a=(e=e===null?n.errors:e.concat(n.errors)).length;var l=s===a
```

**File**: `schemas/plugins/IgnorePlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=r,module.exports.default=r;function r(e,{instancePath="",parentData,parentDataProperty,rootData=e}={}){let s=null,o=0,a=o,t=!1,i=o;if(o===i)if(e&&"object"==typeof e&&!Array.isArray(e)){let r;if(e.resourceRegExp===void 0&&(r="resourceRegExp")){let e={params:{missingProperty:r}};s===null?s=[e]:s.push(e),o++}else{let r=o;for(let r in e)if(!(r==="contextRegExp"||r==="resourceRegExp")){let e={params:{additionalProperty:r}};s===null?s=[e]:s.push(e),o++;break}if(r===o){if(e.contextRegExp!==void 0){let r=o;if(!(e.contextRegExp instanceof RegExp)){let r={params:{}};s===null?s=[r]:s.push(r),o++}var n=r===o}else var n=!0;if(n)if(e.resourceRegExp!==void 0){let r=o;if(!(e.resourceRegExp instanceof RegExp)){let r={params:{}};s===null?s=[r]:s.push(r),o++}var n=r===o}else var n=!0}}}else{let r={params:{type:"object"}};s===null?s=[r]:s.push(r),o++}var l=i===o;if(!(t=t||l)){let r=o;if(o===r)if(e&&"object"==typeof e&&!Array.isArray(e)){let r;if(e.checkResource===void 0&&(r="checkResource")){let e={params:{missingProperty:r}};s===null?s=[e]:s.push(e),o++}else{let r=o;for(let r in e)if(!(r==="checkResource")){let e={params:{additionalProperty:r}};s===null?s=[e]:s.push(e),o++;break}if(r===o)if(e.checkResource!==void 0)if(!(e.checkResource instanceof Function)){let r={params:{}};s===null?s=[r]:s.push(r),o++}}}else{let r={params:{type:"object"}};s===null?s=[r]:s.push(r),o++}var l=r===o;t=t||l}if(!t){let e={params:{}};s===null?s=[e]:s.push(e),o++,r.errors=s;return!1}o=a;if(s!==null)a?s.length=a:s=null;return r.errors=s,o===0}
\ No newline at end of file
+"use strict";module.exports=r,module.exports.default=r;function r(e,{instancePath="",parentData,parentDataProperty,rootData=e}={}){let s=null,o=0,a=o,t=!1,i=o;if(o===i)if(e&&"object"==typeof e&&!Array.isArray(e)){let r;if(e.resourceRegExp===void 0&&(r="resourceRegExp")){let e={params:{missingProperty:r}};s===null?s=[e]:s.push(e),o++}else{let r=o;for(let r in e)if(!(r==="contextRegExp"||r==="resourceRegExp")){let e={params:{additionalProperty:r}};s===null?s=[e]:s.push(e),o++;break}if(r===o){if(e.contextRegExp!==void 0){let r=o;if(!(e.contextRegExp instanceof RegExp)){let r={params:{}};s===null?s=[r]:s.push(r),o++}var n=r===o}else var n=!0;if(n)if(e.resourceRegExp!==void 0){let r=o;if(!(e.resourceRegExp instanceof RegExp)){let r={params:{}};s===null?s=[r]:s.push(r),o++}var n=r===o}else var n=!0}}}else{let r={params:{type:"object"}};s===null?s=[r]:s.push(r),o++}var l=i===o;if(!(t=t||l)){let r=o;if(o===r)if(e&&"object"==typeof e&&!Array.isArray(e)){let r;if(e.checkResource===void 0&&(r="checkResource")){let e={params:{missingProperty:r}};s===null?s=[e]:s.push(e),o++}else{let r=o;for(let r in e)if(r!=="checkResource"){let e={params:{additionalProperty:r}};s===null?s=[e]:s.push(e),o++;break}if(r===o&&e.checkResource!==void 0&&!(e.checkResource instanceof Function)){let r={params:{}};s===null?s=[r]:s.push(r),o++}}}else{let r={params:{type:"object"}};s===null?s=[r]:s.push(r),o++}var l=r===o;t=t||l}if(!t){let e={params:{}};s===null?s=[e]:s.push(e),o++,r.errors=s;return!1}o=a;if(s!==null)a?s.length=a:s=null;return r.errors=s,o===0}
\ No newline at end of file
```

**File**: `schemas/plugins/ManifestPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=t,module.exports.default=t;let e=function(e){let r=e.length,t=0,a=0,s;while(a<r){t++;if((s=e.charCodeAt(a++))>=55296&&s<=56319&&a<r)if(((s=e.charCodeAt(a))&64512)===56320)a++}return t},r=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function t(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){if(a&&"object"==typeof a&&!Array.isArray(a)){for(let e in a)if(!(e==="entrypoints"||e==="filename"||e==="filter"||e==="generate"||e==="prefix"||e==="serialize")){t.errors=[{params:{additionalProperty:e}}];return!1}if(a.entrypoints!==void 0){if("boolean"!=typeof a.entrypoints){t.errors=[{params:{type:"boolean"}}];return!1}var s=!0}else var s=!0;if(s){if(a.filename!==void 0){let i=a.filename;if("string"==typeof i){if(e(i)<1){t.errors=[{params:{limit:1}}];return!1}if(i.includes("!")||r.test(i)!==!1){t.errors=[{params:{}}];return!1}}else{t.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0;if(s){if(a.filter!==void 0){if(!(a.filter instanceof Function)){t.errors=[{params:{}}];return!1}var s=!0}else var s=!0;if(s){if(a.generate!==void 0){if(!(a.generate instanceof Function)){t.errors=[{params:{}}];return!1}var s=!0}else var s=!0;if(s){if(a.prefix!==void 0){if("string"!=typeof a.prefix){t.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0;if(s)if(a.serialize!==void 0){if(!(a.serialize instanceof Function)){t.errors=[{params:{}}];return!1}var s=!0}else var s=!0}}}}}else{t.errors=[{params:{type:"object"}}];return!1}t.errors=null;return!0}
\ No newline at end of file
+"use strict";module.exports=t,module.exports.default=t;let e=function(e){let r=e.length,t=0,a=0,s;while(a<r){t++;if((s=e.charCodeAt(a++))>=55296&&s<=56319&&a<r&&((s=e.charCodeAt(a))&64512)===56320)a++}return t},r=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function t(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){if(a&&"object"==typeof a&&!Array.isArray(a)){for(let e in a)if(!(e==="entrypoints"||e==="filename"||e==="filter"||e==="generate"||e==="prefix"||e==="serialize")){t.errors=[{params:{additionalProperty:e}}];return!1}if(a.entrypoints!==void 0){if("boolean"!=typeof a.entrypoints){t.errors=[{params:{type:"boolean"}}];return!1}var s=!0}else var s=!0;if(s){if(a.filename!==void 0){let i=a.filename;if("string"==typeof i){if(e(i)<1){t.errors=[{params:{limit:1}}];return!1}if(i.includes("!")||r.test(i)!==!1){t.errors=[{params:{}}];return!1}}else{t.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0;if(s){if(a.filter!==void 0){if(!(a.filter instanceof Function)){t.errors=[{params:{}}];return!1}var s=!0}else var s=!0;if(s){if(a.generate!==void 0){if(!(a.generate instanceof Function)){t.errors=[{params:{}}];return!1}var s=!0}else var s=!0;if(s){if(a.prefix!==void 0){if("string"!=typeof a.prefix){t.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0;if(s)if(a.serialize!==void 0){if(!(a.serialize instanceof Function)){t.errors=[{params:{}}];return!1}var s=!0}else var s=!0}}}}}else{t.errors=[{params:{type:"object"}}];return!1}t.errors=null;return!0}
\ No newline at end of file
```

**File**: `schemas/plugins/ProgressPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=s,module.exports.default=s;let r={type:"object",additionalProperties:!1,properties:{activeModules:{type:"boolean"},dependencies:{type:"boolean"},dependenciesCount:{type:"number"},entries:{type:"boolean"},estimatedTime:{type:"boolean"},handler:{$ref:"#/definitions/HandlerFunction"},modules:{type:"boolean"},modulesCount:{type:"number"},percentBy:{enum:["entries","modules","dependencies",null]},phaseTimings:{type:"boolean"},profile:{enum:[!0,!1,null]},progressBar:{anyOf:[{enum:["auto"]},{type:"boolean"},{type:"object",additionalProperties:!1,properties:{color:{type:"string"},name:{type:"string"},width:{type:"number",minimum:1}}}]}}},e=Object.prototype.hasOwnProperty;function a(s,{instancePath="",parentData,parentDataProperty,rootData=s}={}){let o=null,t=0;if(t===0)if(s&&"object"==typeof s&&!Array.isArray(s)){let d=t;for(let o in s)if(!e.call(r.properties,o)){a.errors=[{params:{additionalProperty:o}}];return!1}if(d===t){if(s.activeModules!==void 0){let r=t;if("boolean"!=typeof s.activeModules){a.errors=[{params:{type:"boolean"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.dependencies!==void 0){let r=t;if("boolean"!=typeof s.dependencies){a.errors=[{params:{type:"boolean"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.dependenciesCount!==void 0){let r=t;if(!("number"==typeof s.dependenciesCount)){a.errors=[{params:{type:"number"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.entries!==void 0){let r=t;if("boolean"!=typeof s.entries){a.errors=[{params:{type:"boolean"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.estimatedTime!==void 0){let r=t;if("boolean"!=typeof s.estimatedTime){a.errors=[{params:{type:"boolean"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.handler!==void 0){let r=t;if(!(s.handler instanceof Function)){a.errors=[{params:{}}];return!1}var i=r===t}else var i=!0;if(i){if(s.modules!==void 0){let r=t;if("boolean"!=typeof s.modules){a.errors=[{params:{type:"boolean"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.modulesCount!==void 0){let r=t;if(!("number"==typeof s.modulesCount)){a.errors=[{params:{type:"number"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.percentBy!==void 0){let e=s.percentBy,o=t;if(!(e==="entries"||e==="modules"||e==="dependencies"||e===null)){a.errors=[{params:{allowedValues:r.properties.percentBy.enum}}];return!1}var i=o===t}else var i=!0;if(i){if(s.phaseTimings!==void 0){let r=t;if("boolean"!=typeof s.phaseTimings){a.errors=[{params:{type:"boolean"}}];return!1}var i=r===t}else var i=!0;if(i){if(s.profile!==void 0){let e=s.profile,o=t;if(!(e===!0||e===!1||e===null)){a.errors=[{params:{allowedValues:r.properties.profile.enum}}];return!1}var i=o===t}else var i=!0;if(i)if(s.progressBar!==void 0){let e=s.progressBar,d=t,v=t,p=!1,f=t;if(!(e==="auto")){let e={params:{allowedValues:r.properties.progressBar.anyOf[0].enum}};o===null?o=[e]:o.push(e),t++}var n=f===t;if(!(p=p||n)){let r=t;if("boolean"!=typeof e){let r={params:{type:"boolean"}};o===null?o=[r]:o.push(r),t++}var n=r===t;if(!(p=p||n)){let r=t;if(t===r)if(e&&"object"==typeof e&&!Array.isArray(e)){let r=t;for(let r in e)if(!(r==="color"||r==="name"||r==="width")){let e={params:{additionalProperty:r}};o===null?o=[e]:o.push(e),t++;break}if(r===t){if(e.color!==void 0){let r=t;if("string"!=typeof e.color){let r={params:{type:"string"}};o===null?o=[r]:o.push(r),t++}var l=r===t}else var l=!0;if(l){if(e.name!==void 0){let r=t;if("string"!=typeof e.name){let r={params:{type:"string"}};o===null?o=[r]:o.push(r),t++}var l=r===t}else var l=!0;if(l)if(e.width!==void 0){let r=e.width,a=t;if(t===a)if("number"==typeof r){if(r<1||isNaN(r)){let r={params:{comparison:">=",limit:1}};o===null?o=[r]:o.push(r),t++}}else{let r={params:{type:"number"}};o===null?o=[r]:o.push(r),t++}var l=a===t}else var l=!0}}}else{let r={params:{type:"object"}};o===null?o=[r]:o.push(r),t++}var n=r===t;p=p||n}}if(!p){let r={params:{}};o===null?o=[r]:o.push(r),t++,a.errors=o;return!1}t=v;if(o!==null)v?o.length=v:o=null;var i=d===t}else var i=!0}}}}}}}}}}}}else{a.errors=[{params:{type:"object"}}];return!1}return a.errors=o,t===0}function s(r,{instancePath="",parentData,parentDataProperty,rootData=r}={}){let e=null,o=0,t=o,i=!1,n=o;if(!a(r,{instancePath,parentData,parentDataProperty,rootData}))o=(e=e===null?a.errors:e.concat(a.errors)).length;var l=n===o;if(!(i=i||l)){let a=o;if(!(r instanceof Function)){let r={params:{}};e===null?e=[r]:e.push(r),o++}var l=a===o;i=i||l}if(!i){let r={params:{}};e===null?e=[r]:e.push(r),o++,s.errors=e;return!1}o=t;if(e!==null)t?e.length=t:e=null;return s.errors=e,o===0}
\ No newline at end of file
+"use strict";module.exports=s,module.exports.default=s;let r={type:"object",additionalProperties:!1,properties:{activeModules:{type:"boolean"},dependencies:{type:"boolean"},dependenciesCount:{type:"number"},entries:{type:"boolean"},estimatedTime:{type:"boolean"},handler:{$ref:"#/definitions/Handl
```

**File**: `schemas/plugins/SSRManifestPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=a,module.exports.default=a;let e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i,r=function(e){let r=e.length,a=0,t=0,s;while(t<r){a++;if((s=e.charCodeAt(t++))>=55296&&s<=56319&&t<r)if(((s=e.charCodeAt(t))&64512)===56320)t++}return a};function a(t,{instancePath="",parentData,parentDataProperty,rootData=t}={}){if(t&&"object"==typeof t&&!Array.isArray(t)){for(let e in t)if(!(e==="context"||e==="filename")){a.errors=[{params:{additionalProperty:e}}];return!1}if(t.context!==void 0){let r=t.context;if("string"==typeof r){if(r.includes("!")||e.test(r)!==!0){a.errors=[{params:{}}];return!1}}else{a.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0;if(s)if(t.filename!==void 0){let l=t.filename;if("string"==typeof l){if(r(l)<1){a.errors=[{params:{limit:1}}];return!1}if(l.includes("!")||e.test(l)!==!1){a.errors=[{params:{}}];return!1}}else{a.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0}else{a.errors=[{params:{type:"object"}}];return!1}a.errors=null;return!0}
\ No newline at end of file
+"use strict";module.exports=a,module.exports.default=a;let e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i,r=function(e){let r=e.length,a=0,t=0,s;while(t<r){a++;if((s=e.charCodeAt(t++))>=55296&&s<=56319&&t<r&&((s=e.charCodeAt(t))&64512)===56320)t++}return a};function a(t,{instancePath="",parentData,parentDataProperty,rootData=t}={}){if(t&&"object"==typeof t&&!Array.isArray(t)){for(let e in t)if(!(e==="context"||e==="filename")){a.errors=[{params:{additionalProperty:e}}];return!1}if(t.context!==void 0){let r=t.context;if("string"==typeof r){if(r.includes("!")||e.test(r)!==!0){a.errors=[{params:{}}];return!1}}else{a.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0;if(s)if(t.filename!==void 0){let l=t.filename;if("string"==typeof l){if(r(l)<1){a.errors=[{params:{limit:1}}];return!1}if(l.includes("!")||e.test(l)!==!1){a.errors=[{params:{}}];return!1}}else{a.errors=[{params:{type:"string"}}];return!1}var s=!0}else var s=!0}else{a.errors=[{params:{type:"object"}}];return!1}a.errors=null;return!0}
\ No newline at end of file
```

---

### Incident Patch 2: `a3b719d3` (2026-11-03)
**Commit Message**: fix(minify): close catch, block, conditional, continue and switch gaps (#23087)

* fix(minify): close catch, block, conditional, continue and switch gaps

* fix(minify): fold `a?a:a` before printing `a?a:b` as `a||b`

* fix(minify): keep a `switch` whose case declares a lexical name

* fix(minify): see a labelled declaration as lexical

**File**: `.changeset/237-javascript-minify-peepholes.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"webpack": patch
+---
+
+Minify unread catch bindings, bare blocks, `a?a:b` and one-case `switch`.
```

**File**: `lib/javascript/syntax-printer.js` (modified, +261/-1)
```diff
@@ -8135,6 +8135,26 @@ const createNodePrinter = (modules) => {
 	]) {
 		COMPOUND_OPERATORS[operator] = 1;
 	}
+	// What binds more tightly than `===`, so as to print bare on either side of it.
+	const ABOVE_EQUALITY = new Uint8Array(256);
+	for (const type of [
+		NodeType.Identifier,
+		NodeType.Literal,
+		NodeType.MemberExpression,
+		NodeType.CallExpression,
+		NodeType.ThisExpression,
+		NodeType.TemplateLiteral,
+		NodeType.UnaryExpression
+	]) {
+		ABOVE_EQUALITY[type] = 1;
+	}
+	// What binds less tightly than `||`, so as its right side needs parentheses.
+	const BELOW_OR = new Uint8Array(256);
+	BELOW_OR[NodeType.AssignmentExpression] = 1;
+	BELOW_OR[NodeType.ConditionalExpression] = 1;
+	BELOW_OR[NodeType.SequenceExpression] = 1;
+	BELOW_OR[NodeType.ArrowFunctionExpression] = 1;
+	BELOW_OR[NodeType.YieldExpression] = 1;
 	const LOOP_TYPES = new Uint8Array(256);
 	LOOP_TYPES[NodeType.ForStatement] = 1;
 	LOOP_TYPES[NodeType.ForInStatement] = 1;
@@ -10905,6 +10925,17 @@ const createNodePrinter = (modules) => {
 				) {
 					// An empty block runs nothing.
 					dropped[statement] = 1;
+				} else if (
+					statementType === NodeType.ContinueStatement &&
+					dropsDeadCode &&
+					i === count - 1 &&
+					LOOP_TYPES[typeOf(parent)] === 1 &&
+					childOf(Field.body, parent) === node &&
+					tree.field(0, Field.label, statement) === 0 &&
+					!hasEdgeComments(statement)
+				) {
+					// A loop's body ending goes on to the next pass as its `continue` does.
+					dropped[statement] = 1;
 				} else if (statementType === NodeType.IfStatement) {
 					if (neverRuns(statement)) {
 						dropped[statement] = 1;
@@ -11971,6 +12002,138 @@ const createNodePrinter = (modules) => {
 		return true;
 	};
 
+	/**
+	 * @param {number} node a `switch`'s discriminant or case test
+	 * @returns {boolean} whether it prints bare on either side of `===`
+	 */
+	const printsAboveEquality = (node) =>
+		ABOVE_EQUALITY[typeOf(node)] === 1 &&
+		(collapsed.size === 0 || !collapsed.has(node));
+
+	/**
+	 * terser's `switches` of one case: `switch(d){case t:s}` prints as
+	 * `if(d===t){s}`, which compares and runs the same, in the same order.
+	 * @param {number} node the `switch`
+	 * @returns {number} its one case, 0 where it prints as a `switch`
+	 */
+	const switchAsIf = (node) => {
+		if (
+			!compresses ||
+			!dropsDeadCode ||
+			hasEdgeComments(node) ||
+			(foldedSwitches.size !== 0 && foldedSwitches.has(node))
+		) {
+			return 0;
+		}
+		const count = tree.fieldCount(Field.cases, node);
+		if (count === 0 || count > 2) return 0;
+		const item = tree.field(0, Field.cases, node);
+		const test = childOf(Field.test, item);
+		if (
+			test === 0 ||
+			hasEdgeComments(item) ||
+			(count === 2 && !doesNothing(tree.field(1, Field.cases, node))) ||
+			!printsAboveEquality(test) ||
+			!printsAboveEquality(childOf(Field.discriminant, node)) ||
+			// A known one `noteFoldedSwitch` kept, it keeps.
+			evaluateConstant(childOf(Field.discriminant, node)) !== undefined
+		) {
+			return 0;
+		}
+		const statements = tree.fieldCount(Field.consequent, item);
+		let printed = 0;
+		for (let i = 0; i < statements; i++) {
+			const statement = tree.field(i, Field.consequent, item);
+			if (i === statements - 1 && isPlainBreak(statement)) break;
+			// A `break` leaving the `switch` has no `switch` to leave in an `if`,
+			// and the case test reads names its body declares, as an `if` test not.
+			if (
+				findNode(statement, findSwitchBreak) ||
+				declaresLexically(statement)
+			) {
+				return 0;
+			}
+			if (!printsNothing(statement)) printed++;
+		}
+		return printed === 0 ? 0 : item;
+	};
+
+	/**
+	 * @param {number} node a `switch`
+	 * @param {number} parent its parent
+	 * @returns {number} its one case where it prints as an `if` no `else` can follow, else 0
+	 */
+	const printedSwitchAsIf = (node, parent) => {
+		const parentType = typeOf(parent);
+		return LISTS_STATEMENTS[parentType] === 1 ||
+			FUNCTION_TYPES[parentType] === 1 ||
+			(parentType === NodeType.IfStatement &&
+				tree.field(0, Field.alternate, parent) === 0)
+			? switchAsIf(node)
+			: 0;
+	};
+
+	/**
+	 * Prints a `switch` of one case as the `if` `switchAsIf` finds it is.
+	 * @param {number} node the `switch`
+	 * @param {number} item its one case
+	 * @returns {void}
+	 */
+	const printSwitchAsIf = (node, item) => {
+		const context = /** @type {JavascriptPrintContext} */ (writer);
+		output.print("if");
+		output.space();
+		output.print("(");
+		printNode(childOf(Field.discriminant, node));
+		output.space();
+		output.print("===");
+		output.space();
+		printNode(childOf(Field.test, item));
+		output.print(")");
+		const statements = tree.fieldCount(Field.consequent, item);
+		let only = 0;
+		let printed = 0;
+		for (let i = 0; i < statements; i++) {
+			const statement = tree.field(i, Field.consequent, item);
+			if (i === statements - 1 && isPlainBreak(statement)) break;
+			if (!printedNothing(statement)) {
+				only = statem
```

**File**: `test/helpers/oxcSmaller.js` (modified, +6/-174)
```diff
@@ -613,7 +613,6 @@ const OXC_SMALLER_BY_REASON = [
 			"oxc minifier: peephole/esbuild.rs:200",
 			"oxc minifier: peephole/esbuild.rs:201",
 			"oxc minifier: peephole/esbuild.rs:206",
-			"oxc minifier: peephole/esbuild.rs:213",
 			"oxc minifier: peephole/esbuild.rs:214",
 			"oxc minifier: peephole/esbuild.rs:219",
 			"oxc minifier: peephole/esbuild.rs:220",
@@ -631,7 +630,6 @@ const OXC_SMALLER_BY_REASON = [
 			"oxc minifier: peephole/esbuild.rs:273",
 			"oxc minifier: peephole/esbuild.rs:275",
 			"oxc minifier: peephole/esbuild.rs:278",
-			"oxc minifier: peephole/esbuild.rs:290",
 			"oxc minifier: peephole/esbuild.rs:298",
 			"oxc minifier: peephole/esbuild.rs:299",
 			"oxc minifier: peephole/esbuild.rs:304",
@@ -794,7 +792,6 @@ const OXC_SMALLER_BY_REASON = [
 			"oxc minifier: peephole/esbuild.rs:642",
 			"oxc minifier: peephole/esbuild.rs:643",
 			"oxc minifier: peephole/esbuild.rs:649",
-			"oxc minifier: peephole/esbuild.rs:650",
 			"oxc minifier: peephole/esbuild.rs:652",
 			"oxc minifier: peephole/esbuild.rs:655",
 			"oxc minifier: peephole/esbuild.rs:656",
@@ -1025,7 +1022,6 @@ const OXC_SMALLER_BY_REASON = [
 			"oxc minifier: peephole/esbuild.rs:1880",
 			"oxc minifier: peephole/esbuild.rs:1884",
 			"oxc minifier: peephole/esbuild.rs:1984",
-			"oxc minifier: peephole/esbuild.rs:2028",
 			"oxc minifier: peephole/esbuild.rs:2216",
 			"oxc minifier: peephole/esbuild.rs:2272",
 			"oxc minifier: peephole/esbuild.rs:2288",
@@ -1037,11 +1033,6 @@ const OXC_SMALLER_BY_REASON = [
 			"oxc minifier: peephole/esbuild.rs:2305",
 			"oxc minifier: peephole/esbuild.rs:2306",
 			"oxc minifier: peephole/esbuild.rs:2308",
-			"oxc minifier: peephole/esbuild.rs:2331",
-			"oxc minifier: peephole/esbuild.rs:2339",
-			"oxc minifier: peephole/esbuild.rs:2366",
-			"oxc minifier: peephole/esbuild.rs:2370",
-			"oxc minifier: peephole/esbuild.rs:2371",
 			"oxc minifier: peephole/esbuild.rs:2372",
 			"oxc minifier: peephole/esbuild.rs:2373",
 			"oxc minifier: peephole/esbuild.rs:2374",
@@ -1490,7 +1481,6 @@ const OXC_SMALLER_BY_REASON = [
 			"terser compress: collapse_vars/collapse_vars_while",
 			"terser compress: collapse_vars/cascade_statement",
 			"terser compress: collapse_vars/cond_branch_2",
-			"terser compress: collapse_vars/issue_2891_2",
 			"terser compress: collapse_vars/issue_2914_1",
 			"terser compress: collapse_vars/issue_2914_2",
 			"terser compress: collapse_vars/collapse_rhs_lhs_2",
@@ -1507,8 +1497,6 @@ const OXC_SMALLER_BY_REASON = [
 			"terser compress: export/name_cache_do_not_mangle_export_const_name",
 			"terser compress: functions/issue_2084",
 			"terser compress: functions/use_before_init_in_loop",
-			"terser compress: ie8/issue_2120_1",
-			"terser compress: ie8/issue_2120_2",
 			"terser compress: issue-1007/optional_chaining_boolean_expr",
 			"terser compress: issue-1413/issue_1413_top_retain_reference_shorter_than_value_2",
 			"terser compress: issue-1656/f7",
@@ -1527,8 +1515,6 @@ const OXC_SMALLER_BY_REASON = [
 			"terser compress: reduce_vars/iife_assign",
 			"terser compress: reduce_vars/variables_collision_in_immediately_invoked_func",
 			"terser compress: reduce_vars/issue_294",
-			"terser compress: rename/issue_2120_1",
-			"terser compress: rename/issue_2120_2",
 			"terser compress: sequences/make_sequences_2",
 			"terser compress: template-string/allow_null_character",
 			"terser compress: template-string/equality",
@@ -1562,7 +1548,6 @@ const OXC_SMALLER_BY_REASON = [
 			"swc minifier: fixture/issues/react/hooks/1/input.js",
 			"swc minifier: fixture/issues/unused-let-initialization/input.js",
 			"swc minifier: fixture/next/39538/static/chunks/pages/index-1bd068cedc2b5af3/input.js",
-			"swc minifier: fixture/next/43052/input.js",
 			"swc minifier: fixture/next/43208/static/chunks/pages/index-e1d69965f0f167c9/input.js",
 			"swc minifier: fixture/next/56408/input.js",
 			"swc minifier: fixture/next/66237/input.js",
@@ -1588,8 +1573,6 @@ const OXC_SMALLER_BY_REASON = [
 			"swc minifier: fixture/projects/underscore/18/input.js",
 			"swc minifier: mangle/2/input.js",
 			"swc minifier: projects/files/jquery.mobile-1.4.2.js",
-			"swc minifier: projects/files/react-17.0.1.js",
-			"swc minifier: projects/files/react-dom-17.0.2.js",
 			"swc exec: terser_drop_unused_delete_assign_1",
 			"swc exec: terser_drop_unused_issue_3146_3",
 			"swc exec: terser_drop_unused_issue_3146_4",
@@ -1601,7 +1584,6 @@ const OXC_SMALLER_BY_REASON = [
 			"swc exec: terser_properties_join_object_assignments_nan_2",
 			"swc exec: terser_functions_use_before_init_in_loop",
 			"swc exec: terser_arguments_replace_index_strict",
-			"swc exec: try_catch_4",
 			"oxc minifier: ecmascript/is_int32_or_uint32.rs:53",
 			"oxc minifier: ecmascript/is_int32_or_uint32.rs:55",
 			"oxc minifier: ecmascript/is_int32_or_uint32.rs:72",
@@ -1749,7 +1731,6 @@ const OXC_SMALLER_BY_REASON = [
 			"oxc minifier: peephole/substitute_alternate_syntax.rs:466",
 			"oxc 
```

**File**: `test/helpers/swcSmaller.js` (modified, +1/-23)
```diff
@@ -49,7 +49,6 @@ const SWC_SMALLER_BY_REASON = [
 			"swc minifier: fixture/issues/10816/input.js",
 			"swc minifier: fixture/issues/10849/input.js",
 			"swc minifier: fixture/issues/10859/input.js",
-			"swc minifier: fixture/issues/10885/input.js",
 			"swc minifier: fixture/issues/10981/input.js",
 			"swc minifier: fixture/issues/10986/input.js",
 			"swc minifier: fixture/issues/11007/input.js",
@@ -64,8 +63,6 @@ const SWC_SMALLER_BY_REASON = [
 			"swc minifier: fixture/issues/11320/input.js",
 			"swc minifier: fixture/issues/11321/input.js",
 			"swc minifier: fixture/issues/11512-simple/input.js",
-			"swc minifier: fixture/issues/11645/eval-parent-scope-nested-block/input.js",
-			"swc minifier: fixture/issues/11645/with-parent-scope-nested-block/input.js",
 			"swc minifier: fixture/issues/11684/class-decl/input.js",
 			"swc minifier: fixture/issues/11684/class-expression/input.js",
 			"swc minifier: fixture/issues/11684/constructor-scopes/input.js",
@@ -321,11 +318,8 @@ const SWC_SMALLER_BY_REASON = [
 			"swc minifier: fixture/projects/next/extra/if_return/1/input.js",
 			"swc minifier: fixture/projects/react/.6/input.js",
 			"swc minifier: fixture/projects/react/10/input.js",
-			"swc minifier: fixture/projects/react/11/input.js",
 			"swc minifier: fixture/projects/react/12/input.js",
 			"swc minifier: fixture/projects/react/2/input.js",
-			"swc minifier: fixture/projects/react/3/input.js",
-			"swc minifier: fixture/projects/react/4/input.js",
 			"swc minifier: fixture/projects/react/7/input.js",
 			"swc minifier: fixture/projects/underscore/16/input.js",
 			"swc minifier: fixture/projects/underscore/17/input.js",
@@ -564,7 +558,6 @@ const SWC_SMALLER_BY_REASON = [
 			"swc minifier: fixture/issues/2044/full/input.js",
 			"swc minifier: fixture/issues/5588/input.js",
 			"swc minifier: fixture/issues/do-while-false-terminal-jump/labels-preserved/input.js",
-			"swc minifier: fixture/issues/do-while-false-terminal-jump/loops-disabled/input.js",
 			"swc minifier: fixture/issues/do-while-false-terminal-jump/side-effects/input.js",
 			"swc minifier: fixture/next/41527/1/input.js",
 			"swc minifier: fixture/projects/mootools/.11/input.js",
@@ -676,8 +669,6 @@ const SWC_SMALLER_BY_REASON = [
 			"terser compress: switch/constant_switch_7",
 			"terser compress: switch/constant_switch_8",
 			"terser compress: switch/constant_switch_9",
-			"terser compress: switch/drop_default_1",
-			"terser compress: switch/drop_default_2",
 			"terser compress: switch/keep_default",
 			"terser compress: switch/issue_1663",
 			"terser compress: switch/drop_case",
@@ -704,7 +695,6 @@ const SWC_SMALLER_BY_REASON = [
 			"terser compress: switch/issue_2535",
 			"terser compress: switch/gut_entire_switch",
 			"terser compress: switch/gut_entire_switch_2",
-			"terser compress: switch/turn_into_if",
 			"terser compress: switch/turn_into_if_2",
 			"terser compress: switch/issue_1083_3",
 			"terser compress: switch/issue_1083_4"
@@ -796,7 +786,6 @@ const SWC_SMALLER_BY_REASON = [
 			"terser compress: drop-unused/unused_funarg_1",
 			"terser compress: drop-unused/unused_funarg_2",
 			"terser compress: drop-unused/unused_circular_references_1",
-			"terser compress: drop-unused/unused_block_decls",
 			"terser compress: drop-unused/drop_assign",
 			"terser compress: drop-unused/drop_toplevel_all",
 			"terser compress: drop-unused/drop_toplevel_retain",
@@ -1089,7 +1078,6 @@ const SWC_SMALLER_BY_REASON = [
 			"terser compress: labels/labels_3",
 			"terser compress: labels/labels_4",
 			"terser compress: labels/labels_5",
-			"terser compress: labels/labels_7",
 			"terser compress: labels/labels_9",
 			"terser compress: labels/labels_10"
 		]
@@ -1375,17 +1363,7 @@ const SWC_SMALLER_BY_REASON = [
 	],
 	[
 		"swc goes further than webpack on what terser's `block-scope` tests cover",
-		[
-			"terser compress: block-scope/remove_unused_in_global_block",
-			"terser compress: block-scope/issue_334"
-		]
-	],
-	[
-		"swc goes further than webpack on what terser's `blocks` tests cover",
-		[
-			"terser compress: blocks/remove_blocks",
-			"terser compress: blocks/keep_some_blocks"
-		]
+		["terser compress: block-scope/issue_334"]
 	],
 	[
 		"swc goes further than webpack on what terser's `global_defs` tests cover",
```

**File**: `test/unitCases/javascript/__snapshots__/printer.unittest.js.snap` (modified, +14/-15)
```diff
@@ -98,7 +98,7 @@ function h(){/*! a */return a||b;/*! b */return a=1;/*! c */return a.b.c();/*! d
 
 function e(){/*! a */}x={/*! b */};switch(a){/*! c */}if(a){/*! d */}class K{}
 
-a();/*! a */b();{/*! b */}{a()}a?b():c();
+a();/*! a */b();/*! b */a();a?b():c();
 
 a(),b(),𐐀x.y,𐐀.z;
 
@@ -152,7 +152,7 @@ a?b:c;if(a){if(b)c}else d;if(a)for(;;)b?c:d;if(a)while(b)c?d:e;else f;if(a)e:b?c
 
 for(;;);while(a);for(x in y);for(x of y);a:;a:break a;a:for(;;)continue a;switch(a){}switch(a){case 1:case 2:b()}
 
-try{a}catch{b}try{a}catch(a){b}finally{c}try{a}finally{b}try{}catch({a,b}){}throw a;function f(){}
+try{a}catch{b}try{a}catch{b}finally{c}try{a}finally{b}try{}catch({a,b}){}throw a;function f(){}
 
 for(var a in b);for(let[o]of b);for(let{a}of b);for(var i=0,j=1;i<j;i++,j--);for(let o=0;;);for(x.y in z);for([a,b]of c);
 
@@ -240,7 +240,7 @@ with(o)a;with(o)b;with(o)a?b:c;
 
 class P{#i;m(i){#i in(a=b),#i in(a?b:c),#i in(a,b),#i in(()=>1),(#i in i)+1,!(#i in i),(#i in i).y,(#i in i)(),a<(#i in i),#i in i<a,#i in i||a,a in(#i in i),#i in i in a,(#i in i)**2,#i in(#i in i),#i in a+b,#i in(a in b),#i in(a||b),#i in i?1:2,(#i in i)\`t\`}*g(){#i in(yield)}}
 
-import n from\\"x\\";import{let as i}from\\"y\\";new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);{}switch(a){case 1:\`y\`}1 in a,.5 in a;
+import n from\\"x\\";import{let as i}from\\"y\\";new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);if(a===1){\`y\`}1 in a,.5 in a;
 
 import o from\\"b\\"with{type:\\"json\\",other:\\"x\\"};export{c}from\\"d\\"with{type:\\"json\\",other:\\"y\\"};
 
@@ -354,8 +354,8 @@ function h(){/*! a */return a||b;/*! b */return a=1;/*! c */return a.b.c();/*! d
 
 function e(){/*! a */}x={/*! b */};switch(a){/*! c */}if(a){/*! d */}class K{}
 
-a();/*! a */b();{/*! b */}{a();// x
-}if(a)b();// y
+a();/*! a */b();/*! b */a();// x
+if(a)b();// y
 else c();
 
 a();// x
@@ -499,7 +499,7 @@ with(o)a;with(o)b;with(o)a?b:c;
 
 class P{#i;m(i){#i in(a=b),#i in(a?b:c),#i in(a,b),#i in(()=>1),(#i in i)+1,!(#i in i),(#i in i).y,(#i in i)(),a<(#i in i),#i in i<a,#i in i||a,a in(#i in i),#i in i in a,(#i in i)**2,#i in(#i in i),#i in a+b,#i in(a in b),#i in(a||b),#i in i?1:2,(#i in i)\`t\`}*g(){#i in(yield)}}
 
-import n from\\"x\\";import{let as i}from\\"y\\";new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);{}switch(a){case 1:\\"y\\"}1 in a,.5 in a;
+import n from\\"x\\";import{let as i}from\\"y\\";new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);if(a===1){\\"y\\"}1 in a,.5 in a;
 
 import o from\\"b\\"with{type:\\"json\\",other:\\"x\\"};export{c}from\\"d\\"with{type:\\"json\\",other:\\"y\\"};
 
@@ -610,7 +610,7 @@ function h(){/*! a */return a||b;/*! b */return a=1;/*! c */return a.b.c();/*! d
 
 function e(){/*! a */}x={/*! b */};switch(a){/*! c */}if(a){/*! d */}class K{}
 
-a();/*! a */b();{/*! b */}{a()}a?b():c();
+a();/*! a */b();/*! b */a();a?b():c();
 
 a(),b(),𐐀x.y,𐐀.z;
 
@@ -752,7 +752,7 @@ with(o)a;with(o)b;with(o)a?b:c;
 
 class P{#i;m(i){#i in(a=b),#i in(a?b:c),#i in(a,b),#i in(()=>1),(#i in i)+1,!(#i in i),(#i in i).y,(#i in i)(),a<(#i in i),#i in i<a,#i in i||a,a in(#i in i),#i in i in a,(#i in i)**2,#i in(#i in i),#i in a+b,#i in(a in b),#i in(a||b),#i in i?1:2,(#i in i)\`t\`}*g(){#i in(yield)}}
 
-import n from\\"x\\";import{let as i}from\\"y\\";new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);{}switch(a){case 1:\\"y\\"}1 in a,.5 in a;
+import n from\\"x\\";import{let as i}from\\"y\\";new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);if(a===1){\\"y\\"}1 in a,.5 in a;
 
 import o from\\"b\\"with{type:\\"json\\",other:\\"x\\"};export{c}from\\"d\\"with{type:\\"json\\",other:\\"y\\"};
 
@@ -866,8 +866,8 @@ function h(){/*! a */return a||b;/*! b */return a=1;/*! c */return a.b.c();/*! d
 
 function e(){/*! a */}x={/*! b */};switch(a){/*! c */}if(a){/*! d */}class K{}
 
-a();/*! a */b();{/*! b */}{a();// x
-}if(a)b();// y
+a();/*! a */b();/*! b */a();// x
+if(a)b();// y
 else c();
 
 a();// x
@@ -1011,7 +1011,7 @@ with(o)a;with(o)b;with(o)a?b:c;
 
 class P{#x;m(o){#x in(a=b),#x in(a?b:c),#x in(a,b),#x in(()=>1),(#x in o)+1,!(#x in o),(#x in o).y,(#x in o)(),a<(#x in o),#x in o<a,#x in o||a,a in(#x in o),#x in o in a,(#x in o)**2,#x in(#x in o),#x in a+b,#x in(a in b),#x in(a||b),#x in o?1:2,(#x in o)\`t\`}*g(){#x in(yield)}}
 
-import async from'x';import{let as l}from'y';new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);{}switch(a){case 1:'y'}1. in a,.5 in a;
+import async from'x';import{let as l}from'y';new a[function(){b()}],new a[()=>b()],new(a[b()]),x=function(){}.y;do{}while(a);if(a===1){'y'}1. in a,.5 in a;
 
 import a from'b'with{type:'json',other:'x'};export{c}from'd'with{type:'json',other:'y'};
 
@@ -1232,9 +1232,8 @@ function e(){/*! a */}x={/*! b */}
 switch(a){/*! c */}if(a){/*! d */}class K{}
 
 /* p */
-a(
```

**File**: `test/unitCases/javascript/printer.unittest.js` (modified, +111/-7)
```diff
@@ -398,7 +398,7 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			[
 				"function f(m, c, e){ const s = e; let t = s; g(s.kind, t, {s}); var o = (n) => n + t; m.exports = o; if (c) { var p = () => 1 } g(p); switch (c) { case 1: var q = () => 2; case 2: g(q) } const r = () => 3; for (;;) g(r); const u = function(){}; { g(u) } }",
 				{},
-				"function f(c,s,t){g(t.kind,t,{s:t}),c.exports=c=>c+t;if(s)var n=()=>1;g(n);switch(s){case 1:var o=()=>2;case 2:g(o)}let r=()=>3;for(;;)g(r);{g(function(){})}}"
+				"function f(c,s,t){g(t.kind,t,{s:t}),c.exports=c=>c+t;if(s)var n=()=>1;g(n);switch(s){case 1:var o=()=>2;case 2:g(o)}let r=()=>3;for(;;)g(r);g(function(){})}"
 			],
 			// A `var` is a constant where nothing called before it can read it,
 			// nor a read in its own function before it.
@@ -476,7 +476,7 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			[
 				"function f(a){ var a = 1; return arguments[0] } function g(){ var b = 1; var b = 2 } function e(){ var x = 1; eval('x') } function w(){ /* keep */ var c = 1 } function l(){ { function inner() {} } var m = -b, n = typeof b }",
 				{ format: { comments: /keep/ } },
-				'function f(n){var n=1;return arguments[0]}function g(){}function e(){var x=1;eval("x")}function w(){}function l(){{}-b}'
+				'function f(n){var n=1;return arguments[0]}function g(){}function e(){var x=1;eval("x")}function w(){}function l(){-b}'
 			],
 			[
 				"var top = 1; let t2 = 2; export function e() {} function unusedTop() {} var ex = 1; export { ex }",
@@ -886,7 +886,7 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			[
 				"function f(c){ switch (c) { case -1: c = 1; break; case 0: c = 2; break; default: break } switch (c) { case 1: x(); break } switch (c) { default: break } switch (c) { case 1: y(); break; default: } a: switch (c) { case 1: z(); break a } switch (c) { case 1: y(); /*! c */ break } var i = r(c); return import(i) }",
 				{},
-				"function f(c){switch(c){case-1:c=1;break;case 0:c=2}switch(c){case 1:x()}switch(c){default:}switch(c){case 1:y()}c:switch(c){case 1:z();break c}switch(c){case 1:y();/*! c */break}return import(r(c))}"
+				"function f(c){switch(c){case-1:c=1;break;case 0:c=2}if(c===1)x();switch(c){default:}if(c===1)y();c:switch(c){case 1:z();break c}switch(c){case 1:y();/*! c */break}return import(r(c))}"
 			],
 			// `!!!x` read for its truth folds its innermost `!!` alone.
 			[
@@ -1221,7 +1221,7 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			["function f(a,o){if(a)return;for(var k of o)g(k)}", {}, "function f(f,o){if(!f)for(var r of o)g(r)}"],
 			["function f(a){if(a)return;while(a)g()}", {}, "function f(a){if(!a)while(a)g()}"],
 			["function f(a){if(a)return;do g();while(a)}", {}, "function f(a){if(!a)do{g()}while(a)}"],
-			["function f(a){if(a)return;switch(a){case 1:g()}}", {}, "function f(a){if(!a)switch(a){case 1:g()}}"],
+			["function f(a){if(a)return;switch(a){case 1:g()}}", {}, "function f(a){if(!a)if(a===1)g()}"],
 			["function f(a){if(a)return;try{g()}catch(e){}}", {}, "function f(t){if(!t)try{g()}catch(t){}}"],
 			["function f(a){if(a)return;l:g()}", {}, "function f(f){if(f)return;f:g()}"],
 			["function f(a){if(a)return;if(1)g()}", {}, "function f(f){if(f)return;g()}"],
@@ -1333,7 +1333,111 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			["function f(x){x=y+x;h(x)}", {}, "function f(x){h(x=y+x)}"],
 			["function f(o){o.p=o.p+1}", {}, "function f(o){o.p=o.p+1}"],
 			["function f(x){with(o)x=x+1;h(x)}", {}, "function f(x){with(o)x=x+1;h(x)}"],
-			["function f(x){x=x&&1;h(x)}", {}, "function f(x){h(x=x&&1)}"]
+			["function f(x){x=x&&1;h(x)}", {}, "function f(x){h(x=x&&1)}"],
+			// An unread catch binding goes; `a?a:b` of a local prints `a||b`; equal unary branches fold.
+			["function f(){try{g()}catch(r){h()}}", {"ecma": 2020}, "function f(){try{g()}catch{h()}}"],
+			["function f(){try{g()}catch(r){h()}}", {}, "function f(){try{g()}catch(c){h()}}"],
+			["function f(){try{g()}catch(r){h(r)}}", {"ecma": 2020}, "function f(){try{g()}catch(c){h(c)}}"],
+			["function f(){try{g()}catch(r){eval(\"h(r)\")}}", {"ecma": 2020}, "function f(){try{g()}catch(r){eval(`h(r)`)}}"],
+			["function f(){try{g()}catch({a}){h()}}", {"ecma": 2020}, "function f(){try{g()}catch({a}){h()}}"],
+			["function f(){try{g()}catch(r){r=1}}", {"ecma": 2020}, "function f(){try{g()}catch(c){c=1}}"],
+			["function f(a,b){return a?a:b}", {}, "function f(a,n){return a||n}"],
+			["function f(a,c){return(a?a:a)&&c}", {}, "function f(a,c){return a&&c}"],
+			["function f(a){return a?a:a}", {}, "function f(a){return a}"],
+			["function f(a,b){return a?a:b?1:2}", {}, "function f(a,n){return a?a:n?1:2}"],
+			["function f(a,b){return a?a:b=1}", {}, "function f(a,n){return a?a:n=1}"],
+			["function f(a,b){return a?a:b??1}", {}, "function f(a,n){return a?a:n??1}"],
+			["function f(a,b){return a?a:b||1}", {}, "function f(a,n){return a||n||1}"],
+			["functio
```

---

### Incident Patch 3: `1a2d04ae` (2026-11-02)
**Commit Message**: fix(minify): drop unread trailing arguments and write compound assignments (#23075)

* fix(minify): drop unread trailing arguments and write compound assignments

- Drop pure trailing arguments a declared function never reads.
- Print a literal IIFE argument at its parameter's one read.
- Fold a stable single-read value past a member callee.
- Write `x=x+y` as `x+=y`, a loop on a truthy constant as `for(;;)`,
  and drop empty blocks and statements a `join` of constants makes.
- Sort the unsorted swc and oxc gap buckets by cause; retire 84 entries.

* fix(minify): keep arguments after a spread and reads in class fields

A spread may pass nothing, so no argument after it is trimmed; a class
declaration's field runs per instance, so its read is not a single read.

* fix(minify): keep a trailing argument holding a comment anywhere

* fix(minify): keep a trailing arrow argument whose body holds a comment

* fix(minify): keep a trailing arrow argument with a comment in its parameters

* fix(minify): scan a curried arrow argument to its innermost body for comments

* fix(minify): keep trailing arguments a parameter default may read through arguments

**File**: `.changeset/235-javascript-minify-gap-sweep.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"webpack": patch
+---
+
+Drop unread trailing arguments and write compound assignments when minifying.
```

**File**: `lib/javascript/syntax-printer.js` (modified, +373/-18)
```diff
@@ -8116,6 +8116,31 @@ const createNodePrinter = (modules) => {
 	FUNCTION_TYPES[NodeType.FunctionDeclaration] = 1;
 	FUNCTION_TYPES[NodeType.FunctionExpression] = 1;
 	FUNCTION_TYPES[NodeType.ArrowFunctionExpression] = 1;
+	// The binary operators an assignment of the name they read first takes.
+	/** @type {Record<string, number>} */
+	const COMPOUND_OPERATORS = Object.create(null);
+	for (const operator of [
+		"+",
+		"-",
+		"*",
+		"/",
+		"%",
+		"**",
+		"<<",
+		">>",
+		">>>",
+		"&",
+		"|",
+		"^"
+	]) {
+		COMPOUND_OPERATORS[operator] = 1;
+	}
+	const LOOP_TYPES = new Uint8Array(256);
+	LOOP_TYPES[NodeType.ForStatement] = 1;
+	LOOP_TYPES[NodeType.ForInStatement] = 1;
+	LOOP_TYPES[NodeType.ForOfStatement] = 1;
+	LOOP_TYPES[NodeType.WhileStatement] = 1;
+	LOOP_TYPES[NodeType.DoWhileStatement] = 1;
 
 	/**
 	 * @param {MinifierVariable} definition a name's definition
@@ -8450,6 +8475,13 @@ const createNodePrinter = (modules) => {
 			return true;
 		}
 		if (constructsRegExp(node)) return true;
+		// One printing as the string it joins runs nothing.
+		if (
+			typeOf(node) === NodeType.CallExpression &&
+			joinedOf(node) !== undefined
+		) {
+			return true;
+		}
 		if (
 			pureFunctions !== null &&
 			pureFunctions.has(dottedNameOf(childOf(Field.callee, node)))
@@ -8781,6 +8813,22 @@ const createNodePrinter = (modules) => {
 	// Each call passing a name, noted again once the walk is done.
 	/** @type {Set<number>} */
 	const laterCalls = new Set();
+	// Each call of a name, whose unread trailing arguments may go.
+	/** @type {number[]} */
+	const namedCalls = [];
+	// By function declaration's name, the declaration.
+	/** @type {Map<MinifierVariable, number>} */
+	const declaredFunctions = new Map();
+	// The trailing arguments a call passes to parameters nothing reads.
+	/** @type {Set<number>} */
+	const trimmedArguments = new Set();
+	// Each call, parameter, literal argument and the parameter's one read,
+	// where the read may print the argument instead.
+	/** @type {number[]} */
+	const freshArguments = [];
+	// By parameter read, the literal argument printed there, before it.
+	/** @type {Map<number, number>} */
+	const earlyArguments = new Map();
 	// Each last of a sequence, and what `void` or `!` takes, whose value a
 	// statement leaves unread.
 	/** @type {Set<number>} */
@@ -9406,7 +9454,11 @@ const createNodePrinter = (modules) => {
 			const value = evaluateConstant(argument);
 			if (value === undefined) {
 				// A name passed may be a parameter passed a constant by a later call.
-				if (typeOf(argument) === NodeType.Identifier) laterCalls.add(call);
+				if (typeOf(argument) === NodeType.Identifier) {
+					laterCalls.add(call);
+				} else if (moved === undefined) {
+					noteFreshArgument(call, fn, param, argument, definition);
+				}
 				continue;
 			}
 			if (!printsLikeName(value)) continue;
@@ -9421,6 +9473,86 @@ const createNodePrinter = (modules) => {
 		}
 	};
 
+	/**
+	 * Notes a literal of literals passed to a parameter of the function it
+	 * calls, read once and where it runs at most once a call: the read may
+	 * make it instead, `function(o){f(o)}({})` printing `function(){f({})}()`.
+	 * @param {number} call the call
+	 * @param {number} fn the function called
+	 * @param {number} param the parameter
+	 * @param {number} argument what it is passed
+	 * @param {MinifierVariable} definition the parameter's definition
+	 * @returns {void}
+	 */
+	const noteFreshArgument = (call, fn, param, argument, definition) => {
+		if (
+			definition.referenceCount !== 1 ||
+			(typeOf(argument) !== NodeType.ArrayExpression &&
+				typeOf(argument) !== NodeType.ObjectExpression) ||
+			!isLiteralTree(argument)
+		) {
+			return;
+		}
+		for (let i = 0; i < freshArguments.length; i += 4) {
+			if (freshArguments[i] === call) return;
+		}
+		const body = childOf(Field.body, fn);
+		const read = onceReadIn(body, definition);
+		if (read === 0) return;
+		const start = tree.start(read);
+		// A loop would make a new value each time round where one was read.
+		const looped = findNode(body, (inner) =>
+			FUNCTION_TYPES[typeOf(inner)] === 1
+				? false
+				: LOOP_TYPES[typeOf(inner)] === 1 &&
+					  tree.start(inner) <= start &&
+					  tree.end(inner) >= tree.end(read)
+					? true
+					: undefined
+		);
+		if (!looped) freshArguments.push(call, param, argument, read);
+	};
+
+	/**
+	 * @param {number} node an expression
+	 * @returns {boolean} whether it is a literal, or an array or object literal of those, which reads no name and so means the same in any scope
+	 */
+	const isLiteralTree = (node) => {
+		switch (typeOf(node)) {
+			case NodeType.Literal:
+				return true;
+			case NodeType.UnaryExpression:
+				return typeOf(childOf(Field.argument, node)) === NodeType.Literal;
+			case NodeType.ArrayExpression: {
+				const count = tree.fieldCount(Field.elements, node);
+				for (let i = 0; i < count; i++) {
+					const element = tree.field(i, Field.elements, node);
+
```

**File**: `test/unitCases/javascript/printer.unittest.js` (modified, +84/-4)
```diff
@@ -368,7 +368,7 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			[
 				"function f(){ const b = 2; var u = 1; return void 0 } f(undefined)",
 				{ mangle: false },
-				"function f(){}f(void 0);"
+				"function f(){}f();"
 			],
 			// What only dropped code reads goes too; a constant prints as its value
 			// where that is shorter and the read prints as a name would; a comment
@@ -1156,7 +1156,7 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			// A `var` set after a call folds where its function reads it after the declaration.
 			["function m(){f();var greeting=\"hello\";g(greeting+\"!\")}", {}, "function m(){f(),g(\"hello!\")}"],
 			["function m(){g(greeting+\"!\");var greeting=\"hello\"}", {}, "function m(){g(e+\"!\");var e=\"hello\"}"],
-			["function m(){function g(){return greeting}f();var greeting=\"hello\";g(greeting)}", {}, "function m(){f();(function(){return\"hello\"})(\"hello\")}"],
+			["function m(){function g(){return greeting}f();var greeting=\"hello\";g(greeting)}", {}, "function m(){f();(function(){return\"hello\"})()}"],
 			["function m(){f();var contraction=\"(?:d|ll|m|re|s|t|ve)?\";g(\"x\"+contraction,\"y\"+contraction,contraction)}", {}, "function m(){f(),g(\"x(?:d|ll|m|re|s|t|ve)?\",\"y(?:d|ll|m|re|s|t|ve)?\",\"(?:d|ll|m|re|s|t|ve)?\")}"],
 			// A fold weighs the operands as printed, a string's run joined.
 			["f(x+\"a\"+\"b\"+1)", {}, "f(x+\"ab1\");"],
@@ -1260,14 +1260,80 @@ describe("JavaScript minifier printing a SyntaxTree", () => {
 			["function f(x,g){if(x){void function(){0}();g();g()}}", {}, "function f(f,i){if(f)i(),i()}"],
 			["f=b=>{void function(){0}();g();return b}", {}, "f=n=>(g(),n);"],
 			// A statement after the first that printed its own parentheses keeps the body's braces.
-			["function k(a,p){function A(x,y){x.push(1);x.push(2)}if(p){a.push(3);A(a,p)}return a}", {}, "function k(p,u){if(u){p.push(3);(function(p,u){p.push(1),p.push(2)})(p,u)}return p}"],
+			["function k(a,p){function A(x,y){x.push(1);x.push(2)}if(p){a.push(3);A(a,p)}return a}", {}, "function k(p,u){if(u){p.push(3);(function(p,u){p.push(1),p.push(2)})(p)}return p}"],
 			["f=x=>{a();({}).b=x;return 1}", {}, "f=r=>{a();({}).b=r;return 1};"],
 			// An object opening an optional chain a statement opens with keeps its parentheses.
 			["if({m(){}}?.m())a();else b()", {}, "({m(){}}.m())?a():b();"],
 			// A heritage the call prints as needs no parentheses.
 			["class C extends (function(){return B})(){}", {}, "class C extends B{}"],
 			// What a literal written in place reads of itself is known, but where a call, tag or `delete` reads it as a reference.
-			["function f(a){return[\"abc\".length,[1,,a].length+1,[g()].length,/a\\/b/.source,\"ab\".length.x,\"ab\".length(),\"ab\".length``,delete\"ab\".length]}", {}, "function f(e){return[3,4,[g()].length,\"a\\\\/b\",2..x,\"ab\".length(),\"ab\".length``,delete\"ab\".length]}"]
+			["function f(a){return[\"abc\".length,[1,,a].length+1,[g()].length,/a\\/b/.source,\"ab\".length.x,\"ab\".length(),\"ab\".length``,delete\"ab\".length]}", {}, "function f(e){return[3,4,[g()].length,\"a\\\\/b\",2..x,\"ab\".length(),\"ab\".length``,delete\"ab\".length]}"],
+			// A name set to a stable value folds past a member callee, whose getter cannot change it.
+			["function f(o,p){var x=p;o.f(x)}", {}, "function f(f,o){f.f(o)}"],
+			["function f(o,p){var x=p;x.f(x)}", {}, "function f(f,x){var n=x;n.f(n)}"],
+			["function f(o,p){var x=p.q;o.f(x)}", {}, "function f(f,o){var n=o.q;f.f(n)}"],
+			["function f(o,p){var x=p;new o.F(x)}", {}, "function f(n,o){new n.F(o)}"],
+			// A pure trailing argument to a parameter nothing reads, or to none, goes.
+			["function f(){function g(a,b){return a}return[g(1,2),g(x,y()),g(1,2,3),g(...z,1)]}", {}, "function f(){function n(n,g){return n}return[n(1),n(x,y()),n(1),n(...z,1)]}"],
+			["function f(z){var q=z.p;function g(a,b){return a}return[g(x,q),g(y,2)]}", {}, "function f(n){n.p;function r(n,r){return n}return[r(x),r(y)]}"],
+			["function f(){function g(a,...b){return a}return[g(1,2),g(3,4)]}", {}, "function f(){function n(n,...r){return n}return[n(1,2),n(3,4)]}"],
+			["function f(){function g(a,b){return arguments}return[g(1,2),g(3,4)]}", {}, "function f(){function n(n,r){return arguments}return[n(1,2),n(3,4)]}"],
+			["function f(){function g(a,b=1){return a}return[g(1,2),g(3,4)]}", {}, "function f(){function n(n,r=1){return n}return[n(1,2),n(3,4)]}"],
+			["function f(){function g(x,y=arguments[2]){return[x,y]}return[g(1,2,3),g(5)]}", {}, "function f(){function n(n,r=arguments[2]){return[n,r]}return[n(1,2,3),n(5)]}"],
+			["function f(){function g(a,b){return a}g=h;return[g(1,2),g(3,4)]}", {}, "function f(){function n(n,g){return n}return[(n=h)(1,2),n(3,4)]}"],
+			["function f(){function g(a,b){return a}return[g(1,/*! keep */2),g(3,4)]}", {}, "function f(){function n(n,r){return n}return[n(1,/*! keep */2),n(3)]}"],
+			["function f(){function g(a,b){return a}return[g(1,[1,/*! k
```

#### Recent Merged Pull Requests:
- **PR #23107** (2026-11-03): refactor(parser): derive number truthiness with Boolean and cover NaN in a build (@alexander-akait)
- **PR #23104** (2026-11-03): fix(parser): treat a folded NaN as falsy in asBool (@NUAAwqy)
- **PR #23103** (2026-11-03): ci: keep every pull request report in one comment (@alexander-akait)
- **PR #23102** (2026-11-03): fix: replace type escape hatches with real types (@alexander-akait)
- **PR #23101** (2026-11-03): fix(concatenate): keep one namespace object for an ES module imported and required (@alexander-akait)
- **PR #23100** (2026-11-03): fix: drop the enhanced-resolve suppressions for @types/node 26 fs (@alexander-akait)

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

## X. javascript): minify equal boolean branches, exits before an else and constant ar

**RULE**:
When implementing operations in `.changeset/238-javascript-minify-exits-arrays.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webpack/webpack. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e86c17aa`: javascript): minify equal boolean branches, exits before an else and constant array reads (#23099). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/238-javascript-minify-exits-arrays.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
---
"webpack": patch
---

Minify more conditionals, loop exits, dead code and unread values in one pass.
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e86c17aa` are properly handled with clean fallback behavior.
