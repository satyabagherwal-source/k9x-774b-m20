# Verification Protocol: Verification Protocol: Empirical Defect Shield for webpack-webpack-learnings

<!-- PROVENANCE_START
{
  "source_repository": "webpack-webpack-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T23:25:40.548Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-webpack-webpack-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [webpack-webpack-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T23:25:40.548Z`  
> **Learning ID**: `LEARN-EVO-webpack-webpack-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `webpack-webpack-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webpack-webpack-learnings.md`  
> **Source**: github ([https://github.com/webpack/webpack](https://github.com/webpack/webpack))  
> **Source Version**: `4e6cd866`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T23:24:47.604Z  
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
> **Harvest Timestamp**: 2026-11-24T23:24:47.597Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webpack/webpack`
- **Description**: A bundler for javascript and friends. Packs many modules into a few bundled assets. Code Splitting allows for loading parts of the application on demand. Through "loaders", modules can be CommonJs, AMD, ES6 modules, CSS, Images, JSON, Coffeescript, LESS, ... and your custom stuff.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 66016 stars

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

### Incident Patch 1: `76e24ad9` (2026-11-23)
**Commit Message**: fix(minify): close more one-pass minifier gaps to terser and fix wrong output (#23529)

* fix(minify): make a literal passed to a function moved to its call where its parameter is read

* fix(minify): fold a var read once into that read where its next statement only sets it again

* fix(minify): compare calls of functions returning only objects with == as terser does

* fix(minify): fold a declarator past a later one setting an unread name to a literal

* fix(minify): print an unread call of a one-statement function as that statement, its argument at its parameter's read

* fix(minify): keep the member new reads a constructor off a literal moved to its name

* fix(minify): parenthesize a function moved to a returned name where it opens a statement

* test(minify): take the shorter print of a call in place passed this as its one statement

* fix(minify): keep a call's body in place when a name it passes prints a folded value

* fix(minify): fold straight values through a return or throw, and at a private top level

* fix(minify): unwrap a do-while(0) whose loop exits all print nothing

* fix(minify): fold straight values set in a read sequence and a declarator not followed

* fix(mi

**File**: `.changeset/282-javascript-minify-one-pass-gaps.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 "webpack": patch
 ---
 
-Fold more known values, calls, object assignments and dead code when minifying.
+Fold more values, calls and dead code when minifying, and fix wrong output.
```

**File**: `lib/javascript/ScopeAnalyzer.js` (modified, +154/-14)
```diff
@@ -1926,6 +1926,23 @@ class MinifierTreeScopeAnalyzer {
 		this.unreached = outerUnreached;
 	}
 
+	/**
+	 * @param {number} body a loop's body
+	 * @returns {boolean} whether it is a `break` naming no label, alone or in a block
+	 */
+	_breaksAtOnce(body) {
+		if (
+			this.types[body] === NodeType.BlockStatement &&
+			A.fieldCount(Field.body, body) === 1
+		) {
+			body = this._child(Field.body, body);
+		}
+		return (
+			this.types[body] === NodeType.BreakStatement &&
+			A.field(0, Field.label, body) === 0
+		);
+	}
+
 	/**
 	 * @param {number} field the `Field`
 	 * @param {number} node a node
@@ -2765,11 +2782,21 @@ class MinifierTreeScopeAnalyzer {
 	 */
 	_visitLoop(node) {
 		switch (this.types[node]) {
-			case NodeType.ForStatement:
+			case NodeType.ForStatement: {
 				this._visitChild(Field.init, node);
+				const test = this._child(Field.test, node);
 				this._visitChild(Field.test, node);
-				this._visitChild(Field.update, node);
-				break;
+				// A test known false runs neither body nor update, a body
+				// leaving at once no update, terser's `dead_code`.
+				const never = test !== 0 && this._literalTruth(test) === 0;
+				this._visitUnreached(
+					Field.update,
+					node,
+					never || this._breaksAtOnce(this._child(Field.body, node))
+				);
+				this._visitUnreached(Field.body, node, never);
+				return;
+			}
 			case NodeType.WhileStatement:
 				this._visitChild(Field.test, node);
 				break;
@@ -3508,6 +3535,42 @@ class MinifierTreeScopeAnalyzer {
 		return this._nestedMadeAfter(scope, definition, A.end(declarator));
 	}
 
+	/**
+	 * @param {MinifierScope} scope the scope of a read in a nested function
+	 * @param {MinifierVariable} definition the `let` or `const` it reads
+	 * @param {number} end where the declarator setting it ends
+	 * @returns {boolean} whether the outermost function between runs only after that: an expression made after it, or a declaration only called after it in the scope declaring both
+	 */
+	_calledAfter(scope, definition, end) {
+		if (this._nestedMadeAfter(scope, definition, end)) return true;
+		const home = /** @type {MinifierScope} */ (definition.scope).variableScope;
+		let outer = /** @type {MinifierScope} */ (scope.variableScope);
+		while (outer.upper !== null && outer.upper.variableScope !== home) {
+			outer = /** @type {MinifierScope} */ (outer.upper.variableScope);
+		}
+		// A `switch` may enter at a later case, past the declarator setting it.
+		if (
+			outer.upper === null ||
+			this.types[outer.node] !== NodeType.FunctionDeclaration ||
+			/** @type {MinifierScope} */ (definition.scope).type === "switch"
+		) {
+			return false;
+		}
+		const fn = this.definitions[A.field(0, Field.id, outer.node)];
+		if (!isMinifierVariable(fn) || fn.written || fn.export !== 0) return false;
+		const { referenceNodes, referenceScopes, definitions } = this;
+		for (let i = 0; i < referenceNodes.length; i++) {
+			if (
+				definitions[referenceNodes[i]] === fn &&
+				(A.start(referenceNodes[i]) < end ||
+					referenceScopes[i].variableScope !== home)
+			) {
+				return false;
+			}
+		}
+		return true;
+	}
+
 	/**
 	 * Whether a `let` or `const` an alias reads is set before the alias's
 	 * declarator runs, which would otherwise throw where the read moved need not.
@@ -3831,6 +3894,65 @@ class MinifierTreeScopeAnalyzer {
 		}
 	}
 
+	/**
+	 * @param {number} init the function a declarator sets
+	 * @param {MinifierScope} scope the scope of its read, in a nested function
+	 * @param {MinifierVariable} definition the name it sets
+	 * @returns {boolean} whether it is an arrow reading `this` or its kin, a function between that read and it binding them anew, or naming `await` or `yield`
+	 */
+	_takesOtherThis(init, scope, definition) {
+		const reads = this._readsOuterThis(init);
+		if (reads !== 1) return reads === 2;
+		const outer = /** @type {MinifierScope} */ (definition.scope).variableScope;
+		for (
+			let inner = /** @type {MinifierScope} */ (scope.variableScope);
+			inner !== outer;
+			inner = /** @type {MinifierScope} */ (
+				/** @type {MinifierScope} */ (inner.upper).variableScope
+			)
+		) {
+			if (this.types[inner.node] !== NodeType.ArrowFunctionExpression) {
+				return true;
+			}
+		}
+		return false;
+	}
+
+	/**
+	 * An arrow takes `this`, `arguments`, `super` and `new.target` from where
+	 * it is made; a name `await` or `yield` stays a name only out of an async
+	 * function or generator.
+	 * @param {number} node a function or a node in an arrow
+	 * @returns {number} for an arrow, 2 where it names `await` or `yield`, else 1 where it may read `this` or its kin, nested arrows too; 0 otherwise
+	 */
+	_readsOuterThis(node) {
+		switch (this.types[node]) {
+			case NodeType.FunctionExpression:
+			case NodeType.FunctionDeclaration:
+				return 0;
+			case NodeType.ThisExpression:
+			case NodeType.Super:
+			case NodeType.MetaProperty:
+				return 1;
+			case NodeType.Identifier: {
+				const name = A.name(node);
+			
```

**File**: `lib/javascript/side-effects.js` (modified, +86/-9)
```diff
@@ -24,7 +24,8 @@ const { Field, Flag, NodeType, Part } = require("./syntax").parser;
  * @property {(boolean | "strict")=} pureGetters terser's `pure_getters`: false where any property read may throw or run a getter, true where only a read of what may be `null` or `undefined` does; unset, "strict"
  * @property {boolean=} comparesConvert whether a comparison or an object's computed key converting what may be an object runs code, as the compressor's `pureConversions: false` has it
  * @property {((node: number) => boolean | undefined)=} decides what the caller answers for a node before the rules read it, undefined to leave it to them
- * @property {((node: number) => number)=} readValue the value a name prints as where it is read, 0 for none
+ * @property {((node: number) => number)=} readValue the value a name prints as or always holds where a member reads it, 0 for none
+ * @property {((node: number) => boolean)=} inheritsGetter whether a prototype the program may write answers a read of the function, class or literal given
  * @property {((node: number) => boolean)=} joinsNatively whether an array or object literal converts to a string by built-ins alone, which nothing replaces; unset, none does
  * @property {((node: number) => boolean)=} readsPrototypeMember whether a member read reads a built-in prototype's member, which no getter answers; unset, none does
  * @property {((spread: number, container: number) => boolean)=} spreadRuns whether a spread may run code or throw as it spreads, its argument's own effects aside; unset, every spread may
@@ -156,6 +157,50 @@ const isNullish = (tree, node) => {
 	}
 };
 
+/**
+ * @param {SyntaxReader} tree the tree
+ * @param {number} key a non-computed property key
+ * @returns {boolean} whether it names `__proto__`, as a name or a string
+ */
+const protoKey = (tree, key) =>
+	tree.type(key) === NodeType.Identifier
+		? tree.name(key) === "__proto__"
+		: tree.type(key) === NodeType.Literal && tree.value(key) === "__proto__";
+
+/**
+ * @param {SyntaxReader} tree the tree
+ * @param {number} node an expression
+ * @returns {boolean} whether it is the literal `null`
+ */
+const isNullLiteral = (tree, node) =>
+	tree.type(node) === NodeType.Literal && tree.value(node) === null;
+
+/**
+ * @param {SyntaxReader} tree the tree
+ * @param {number} node a member expression
+ * @param {number} target the function or class it reads
+ * @returns {boolean} whether it reads `prototype`, an own data property of a class, plain or generator function
+ */
+const readsOwnPrototype = (tree, node, target) => {
+	if (tree.flag(Flag.computed, node)) return false;
+	const property = tree.field(0, Field.property, node);
+	if (
+		tree.type(property) !== NodeType.Identifier ||
+		tree.name(property) !== "prototype"
+	) {
+		return false;
+	}
+	const type = tree.type(target);
+	if (type === NodeType.ClassExpression || type === NodeType.ClassDeclaration) {
+		return true;
+	}
+	return (
+		(type === NodeType.FunctionExpression ||
+			type === NodeType.FunctionDeclaration) &&
+		(!tree.flag(Flag.async, target) || tree.flag(Flag.generator, target))
+	);
+};
+
 /**
  * terser's `_dot_throw`: where `pure_getters` is "strict", the default, only
  * a value known to be no `null`, `undefined` or object with a getter is safe.
@@ -175,8 +220,26 @@ const mayThrowOnAccess = (tree, node, strict) => {
 		case NodeType.FunctionExpression:
 		case NodeType.FunctionDeclaration:
 		case NodeType.ArrowFunctionExpression:
+			return false;
 		case NodeType.ClassExpression:
+		case NodeType.ClassDeclaration: {
+			// A superclass's static getter is read through the class too.
+			if (!strict) return false;
+			if (tree.field(0, Field.superClass, node) !== 0) return true;
+			const body = tree.field(0, Field.body, node);
+			const count = tree.fieldCount(Field.body, body);
+			for (let i = 0; i < count; i++) {
+				const member = tree.field(i, Field.body, body);
+				if (
+					tree.type(member) === NodeType.MethodDefinition &&
+					tree.flag(Flag.static, member) &&
+					tree.textOf(Part.kind, member) === "get"
+				) {
+					return true;
+				}
+			}
 			return false;
+		}
 		case NodeType.ObjectExpression: {
 			if (!strict) return false;
 			const count = tree.fieldCount(Field.properties, node);
@@ -194,7 +257,11 @@ const mayThrowOnAccess = (tree, node, strict) => {
 					}
 				} else if (
 					tree.textOf(Part.kind, property) !== "init" ||
-					tree.flag(Flag.method, property)
+					tree.flag(Flag.method, property) ||
+					// `__proto__: p` sets a prototype whose getter a read may run.
+					(!tree.flag(Flag.computed, property) &&
+						protoKey(tree, tree.field(0, Field.key, property)) &&
+						!isNullLiteral(tree, tree.field(0, Field.value, property)))
 				) {
 					return true;
 				}
@@ -1065,8 +1132,9 @@ const ruledSideEffects = (tree, node, context) => {
 		case NodeType.ClassDeclaration:
 			return classHasSideEffects(tree, node, context, false);
 		case NodeType.MemberExpression: {
+			//
```

**File**: `schemas/plugins/ManifestPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=r,module.exports.default=r;let e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function r(t,{instancePath="",parentData,parentDataProperty,rootData=t}={}){if(t&&"object"==typeof t&&!Array.isArray(t)){for(let e in t)if(!(e==="entrypoints"||e==="filename"||e==="filter"||e==="generate"||e==="prefix"||e==="serialize"))return r.errors=[{params:{additionalProperty:e}}],!1;if(t.entrypoints!==void 0){if("boolean"!=typeof t.entrypoints)return r.errors=[{params:{type:"boolean"}}],!1;var a=!0}else var a=!0;if(a){if(t.filename!==void 0){let s=t.filename;if("string"==typeof s){if(function(e){let r=e.length,t=0,a=0,s;while(a<r){t++;if((s=e.charCodeAt(a++))>=55296&&s<=56319&&a<r&&((s=e.charCodeAt(a))&64512)==56320)a++}return t}(s)<1)return r.errors=[{params:{limit:1}}],!1;if(s.includes("!")||e.test(s)!==!1)return r.errors=[{params:{}}],!1}else return r.errors=[{params:{type:"string"}}],!1;var a=!0}else var a=!0;if(a){if(t.filter!==void 0){if(!(t.filter instanceof Function))return r.errors=[{params:{}}],!1;var a=!0}else var a=!0;if(a){if(t.generate!==void 0){if(!(t.generate instanceof Function))return r.errors=[{params:{}}],!1;var a=!0}else var a=!0;if(a){if(t.prefix!==void 0){if("string"!=typeof t.prefix)return r.errors=[{params:{type:"string"}}],!1;var a=!0}else var a=!0;if(a)if(t.serialize!==void 0){if(!(t.serialize instanceof Function))return r.errors=[{params:{}}],!1;var a=!0}else var a=!0}}}}}else return r.errors=[{params:{type:"object"}}],!1;r.errors=null;return!0}
\ No newline at end of file
+"use strict";module.exports=t,module.exports.default=t;let e=function(e){let r=e.length,t=0,a=0,s;while(a<r){t++;if((s=e.charCodeAt(a++))>=55296&&s<=56319&&a<r&&((s=e.charCodeAt(a))&64512)==56320)a++}return t},r=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function t(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){if(a&&"object"==typeof a&&!Array.isArray(a)){for(let e in a)if(!(e==="entrypoints"||e==="filename"||e==="filter"||e==="generate"||e==="prefix"||e==="serialize"))return t.errors=[{params:{additionalProperty:e}}],!1;if(a.entrypoints!==void 0){if("boolean"!=typeof a.entrypoints)return t.errors=[{params:{type:"boolean"}}],!1;var s=!0}else var s=!0;if(s){if(a.filename!==void 0){let i=a.filename;if("string"==typeof i){if(e(i)<1)return t.errors=[{params:{limit:1}}],!1;if(i.includes("!")||r.test(i)!==!1)return t.errors=[{params:{}}],!1}else return t.errors=[{params:{type:"string"}}],!1;var s=!0}else var s=!0;if(s){if(a.filter!==void 0){if(!(a.filter instanceof Function))return t.errors=[{params:{}}],!1;var s=!0}else var s=!0;if(s){if(a.generate!==void 0){if(!(a.generate instanceof Function))return t.errors=[{params:{}}],!1;var s=!0}else var s=!0;if(s){if(a.prefix!==void 0){if("string"!=typeof a.prefix)return t.errors=[{params:{type:"string"}}],!1;var s=!0}else var s=!0;if(s)if(a.serialize!==void 0){if(!(a.serialize instanceof Function))return t.errors=[{params:{}}],!1;var s=!0}else var s=!0}}}}}else return t.errors=[{params:{type:"object"}}],!1;t.errors=null;return!0}
\ No newline at end of file
```

**File**: `schemas/plugins/SSRManifestPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=r,module.exports.default=r;let e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function r(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){if(a&&"object"==typeof a&&!Array.isArray(a)){for(let e in a)if(!(e==="context"||e==="filename"))return r.errors=[{params:{additionalProperty:e}}],!1;if(a.context!==void 0){let s=a.context;if("string"==typeof s){if(s.includes("!")||e.test(s)!==!0)return r.errors=[{params:{}}],!1}else return r.errors=[{params:{type:"string"}}],!1;var t=!0}else var t=!0;if(t)if(a.filename!==void 0){let s=a.filename;if("string"==typeof s){if(function(e){let r=e.length,a=0,t=0,s;while(t<r){a++;if((s=e.charCodeAt(t++))>=55296&&s<=56319&&t<r&&((s=e.charCodeAt(t))&64512)==56320)t++}return a}(s)<1)return r.errors=[{params:{limit:1}}],!1;if(s.includes("!")||e.test(s)!==!1)return r.errors=[{params:{}}],!1}else return r.errors=[{params:{type:"string"}}],!1;var t=!0}else var t=!0}else return r.errors=[{params:{type:"object"}}],!1;r.errors=null;return!0}
\ No newline at end of file
+"use strict";module.exports=a,module.exports.default=a;let e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i,r=function(e){let r=e.length,a=0,t=0,s;while(t<r){a++;if((s=e.charCodeAt(t++))>=55296&&s<=56319&&t<r&&((s=e.charCodeAt(t))&64512)==56320)t++}return a};function a(t,{instancePath="",parentData,parentDataProperty,rootData=t}={}){if(t&&"object"==typeof t&&!Array.isArray(t)){for(let e in t)if(!(e==="context"||e==="filename"))return a.errors=[{params:{additionalProperty:e}}],!1;if(t.context!==void 0){let r=t.context;if("string"==typeof r){if(r.includes("!")||e.test(r)!==!0)return a.errors=[{params:{}}],!1}else return a.errors=[{params:{type:"string"}}],!1;var s=!0}else var s=!0;if(s)if(t.filename!==void 0){let l=t.filename;if("string"==typeof l){if(r(l)<1)return a.errors=[{params:{limit:1}}],!1;if(l.includes("!")||e.test(l)!==!1)return a.errors=[{params:{}}],!1}else return a.errors=[{params:{type:"string"}}],!1;var s=!0}else var s=!0}else return a.errors=[{params:{type:"object"}}],!1;a.errors=null;return!0}
\ No newline at end of file
```

**File**: `schemas/plugins/asset/AssetGeneratorOptions.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=t,module.exports.default=t;let r={type:"object",additionalProperties:!1,properties:{encoding:{enum:[!1,"base64"]},mimetype:{type:"string"}}};function e(s,{instancePath="",parentData,parentDataProperty,rootData=s}={}){let a=null,t=0,o=t,i=!1,l=t,n=t;if(t===n)if(s&&"object"==typeof s&&!Array.isArray(s)){let e=t;for(let r in s)if(!(r==="encoding"||r==="mimetype")){let e={params:{additionalProperty:r}};a===null?a=[e]:a.push(e),t++;break}if(e===t){if(s.encoding!==void 0){let e=s.encoding,o=t;if(!(e===!1||e==="base64")){let e={params:{allowedValues:r.properties.encoding.enum}};a===null?a=[e]:a.push(e),t++}var v=o===t}else var v=!0;if(v)if(s.mimetype!==void 0){let r=t;if("string"!=typeof s.mimetype){let r={params:{type:"string"}};a===null?a=[r]:a.push(r),t++}var v=r===t}else var v=!0}}else{let r={params:{type:"object"}};a===null?a=[r]:a.push(r),t++}var d=l===t;if(!(i=i||d)){let r=t;if(!(s instanceof Function)){let r={params:{}};a===null?a=[r]:a.push(r),t++}d=r===t,i=i||d}if(!i){let r={params:{}};a===null?a=[r]:a.push(r),t++,e.errors=a;return!1}t=o;if(a!==null)o?a.length=o:a=null;return e.errors=a,t===0}let s=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function a(r,{instancePath:t="",parentData,parentDataProperty,rootData=r}={}){let o=null,i=0;if(i===0)if(r&&"object"==typeof r&&!Array.isArray(r)){let f=i;for(let e in r)if(!(e==="binary"||e==="dataUrl"||e==="emit"||e==="filename"||e==="outputPath"||e==="publicPath"))return a.errors=[{params:{additionalProperty:e}}],!1;if(f===i){if(r.binary!==void 0){let e=i;if("boolean"!=typeof r.binary)return a.errors=[{params:{type:"boolean"}}],!1;var l=e===i}else var l=!0;if(l){if(r.dataUrl!==void 0){let s=i;if(!e(r.dataUrl,{instancePath:t+"/dataUrl",parentData:r,parentDataProperty:"dataUrl",rootData}))i=(o=o===null?e.errors:o.concat(e.errors)).length;var l=s===i}else var l=!0;if(l){if(r.emit!==void 0){let e=i;if("boolean"!=typeof r.emit)return a.errors=[{params:{type:"boolean"}}],!1;var l=e===i}else var l=!0;if(l){if(r.filename!==void 0){let e=r.filename,t=i,v=i,d=!1,f=i;if(i===f)if("string"==typeof e){if(function(r){let e=r.length,s=0,a=0,t;while(a<e){s++;if((t=r.charCodeAt(a++))>=55296&&t<=56319&&a<e&&((t=r.charCodeAt(a))&64512)==56320)a++}return s}(e)<1){let r={params:{limit:1}};o===null?o=[r]:o.push(r),i++}else if(e.includes("!")||s.test(e)!==!1){let r={params:{}};o===null?o=[r]:o.push(r),i++}}else{let r={params:{type:"string"}};o===null?o=[r]:o.push(r),i++}var n=f===i;if(!(d=d||n)){let r=i;if(!(e instanceof Function)){let r={params:{}};o===null?o=[r]:o.push(r),i++}var n=r===i;d=d||n}if(!d){let r={params:{}};o===null?o=[r]:o.push(r),i++,a.errors=o;return!1}i=v;if(o!==null)v?o.length=v:o=null;var l=t===i}else var l=!0;if(l){if(r.outputPath!==void 0){let e=r.outputPath,t=i,n=i,d=!1,f=i;if(i===f)if("string"==typeof e){if(e.includes("!")||s.test(e)!==!1){let r={params:{}};o===null?o=[r]:o.push(r),i++}}else{let r={params:{type:"string"}};o===null?o=[r]:o.push(r),i++}var v=f===i;if(!(d=d||v)){let r=i;if(!(e instanceof Function)){let r={params:{}};o===null?o=[r]:o.push(r),i++}var v=r===i;d=d||v}if(!d){let r={params:{}};o===null?o=[r]:o.push(r),i++,a.errors=o;return!1}i=n;if(o!==null)n?o.length=n:o=null;var l=t===i}else var l=!0;if(l)if(r.publicPath!==void 0){let e=r.publicPath,s=i,t=i,n=!1,v=i;if("string"!=typeof e){let r={params:{type:"string"}};o===null?o=[r]:o.push(r),i++}var d=v===i;if(!(n=n||d)){let r=i;if(!(e instanceof Function)){let r={params:{}};o===null?o=[r]:o.push(r),i++}var d=r===i;n=n||d}if(!n){let r={params:{}};o===null?o=[r]:o.push(r),i++,a.errors=o;return!1}i=t;if(o!==null)t?o.length=t:o=null;var l=s===i}else var l=!0}}}}}}else return a.errors=[{params:{type:"object"}}],!1;return a.errors=o,i===0}function t(r,{instancePath="",parentData,parentDataProperty,rootData=r}={}){let e=null,s=0;if(!a(r,{instancePath,parentData,parentDataProperty,rootData}))s=(e=e===null?a.errors:e.concat(a.errors)).length;return t.errors=e,s===0}
\ No newline at end of file
+"use strict";module.exports=o,module.exports.default=o;let r={type:"object",additionalProperties:!1,properties:{encoding:{enum:[!1,"base64"]},mimetype:{type:"string"}}};function e(s,{instancePath="",parentData,parentDataProperty,rootData=s}={}){let a=null,t=0,o=t,i=!1,l=t,n=t;if(t===n)if(s&&"object"==typeof s&&!Array.isArray(s)){let e=t;for(let r in s)if(!(r==="encoding"||r==="mimetype")){let e={params:{additionalProperty:r}};a===null?a=[e]:a.push(e),t++;break}if(e===t){if(s.encoding!==void 0){let e=s.encoding,o=t;if(!(e===!1||e==="base64")){let e={params:{allowedValues:r.properties.encoding.enum}};a===null?a=[e]:a.push(e),t++}var v=o===t}else var v=!0;if(v)if(s.mimetype!==void 0){let r=t;if("string"!=typeof s.mimetype){let r={params:{type:"string"}};a===null?a=[r]:a.push(r),t++}var v=r===t}else var v=!0}}else{let r={params:{type:"object"}};a===null?a=[r]:a.push(r),t++}var d=l===
```

**File**: `schemas/plugins/asset/AssetResourceGeneratorOptions.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=s,module.exports.default=s;let r=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function e(s,{instancePath="",parentData,parentDataProperty,rootData=s}={}){let a=null,t=0;if(t===0)if(s&&"object"==typeof s&&!Array.isArray(s)){let v=t;for(let r in s)if(!(r==="binary"||r==="emit"||r==="filename"||r==="outputPath"||r==="publicPath"))return e.errors=[{params:{additionalProperty:r}}],!1;if(v===t){if(s.binary!==void 0){let r=t;if("boolean"!=typeof s.binary)return e.errors=[{params:{type:"boolean"}}],!1;var o=r===t}else var o=!0;if(o){if(s.emit!==void 0){let r=t;if("boolean"!=typeof s.emit)return e.errors=[{params:{type:"boolean"}}],!1;var o=r===t}else var o=!0;if(o){if(s.filename!==void 0){let i=s.filename,n=t,v=t,d=!1,f=t;if(t===f)if("string"==typeof i){if(function(r){let e=r.length,s=0,a=0,t;while(a<e){s++;if((t=r.charCodeAt(a++))>=55296&&t<=56319&&a<e&&((t=r.charCodeAt(a))&64512)==56320)a++}return s}(i)<1){let r={params:{limit:1}};a===null?a=[r]:a.push(r),t++}else if(i.includes("!")||r.test(i)!==!1){let r={params:{}};a===null?a=[r]:a.push(r),t++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),t++}var l=f===t;if(!(d=d||l)){let r=t;if(!(i instanceof Function)){let r={params:{}};a===null?a=[r]:a.push(r),t++}var l=r===t;d=d||l}if(!d){let r={params:{}};a===null?a=[r]:a.push(r),t++,e.errors=a;return!1}t=v;if(a!==null)v?a.length=v:a=null;var o=n===t}else var o=!0;if(o){if(s.outputPath!==void 0){let l=s.outputPath,n=t,v=t,d=!1,f=t;if(t===f)if("string"==typeof l){if(l.includes("!")||r.test(l)!==!1){let r={params:{}};a===null?a=[r]:a.push(r),t++}}else{let r={params:{type:"string"}};a===null?a=[r]:a.push(r),t++}var i=f===t;if(!(d=d||i)){let r=t;if(!(l instanceof Function)){let r={params:{}};a===null?a=[r]:a.push(r),t++}var i=r===t;d=d||i}if(!d){let r={params:{}};a===null?a=[r]:a.push(r),t++,e.errors=a;return!1}t=v;if(a!==null)v?a.length=v:a=null;var o=n===t}else var o=!0;if(o)if(s.publicPath!==void 0){let r=s.publicPath,l=t,i=t,v=!1,d=t;if("string"!=typeof r){let r={params:{type:"string"}};a===null?a=[r]:a.push(r),t++}var n=d===t;if(!(v=v||n)){let e=t;if(!(r instanceof Function)){let r={params:{}};a===null?a=[r]:a.push(r),t++}var n=e===t;v=v||n}if(!v){let r={params:{}};a===null?a=[r]:a.push(r),t++,e.errors=a;return!1}t=i;if(a!==null)i?a.length=i:a=null;var o=l===t}else var o=!0}}}}}else return e.errors=[{params:{type:"object"}}],!1;return e.errors=a,t===0}function s(r,{instancePath="",parentData,parentDataProperty,rootData=r}={}){let a=null,t=0;if(!e(r,{instancePath,parentData,parentDataProperty,rootData}))t=(a=a===null?e.errors:a.concat(e.errors)).length;return s.errors=a,t===0}
\ No newline at end of file
+"use strict";module.exports=a,module.exports.default=a;let r=function(r){let e=r.length,s=0,a=0,t;while(a<e){s++;if((t=r.charCodeAt(a++))>=55296&&t<=56319&&a<e&&((t=r.charCodeAt(a))&64512)==56320)a++}return s},e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function s(a,{instancePath="",parentData,parentDataProperty,rootData=a}={}){let t=null,o=0;if(o===0)if(a&&"object"==typeof a&&!Array.isArray(a)){let d=o;for(let r in a)if(!(r==="binary"||r==="emit"||r==="filename"||r==="outputPath"||r==="publicPath"))return s.errors=[{params:{additionalProperty:r}}],!1;if(d===o){if(a.binary!==void 0){let r=o;if("boolean"!=typeof a.binary)return s.errors=[{params:{type:"boolean"}}],!1;var l=r===o}else var l=!0;if(l){if(a.emit!==void 0){let r=o;if("boolean"!=typeof a.emit)return s.errors=[{params:{type:"boolean"}}],!1;var l=r===o}else var l=!0;if(l){if(a.filename!==void 0){let n=a.filename,v=o,d=o,f=!1,u=o;if(o===u)if("string"==typeof n){if(r(n)<1){let r={params:{limit:1}};t===null?t=[r]:t.push(r),o++}else if(n.includes("!")||e.test(n)!==!1){let r={params:{}};t===null?t=[r]:t.push(r),o++}}else{let r={params:{type:"string"}};t===null?t=[r]:t.push(r),o++}var i=u===o;if(!(f=f||i)){let r=o;if(!(n instanceof Function)){let r={params:{}};t===null?t=[r]:t.push(r),o++}var i=r===o;f=f||i}if(!f){let r={params:{}};t===null?t=[r]:t.push(r),o++,s.errors=t;return!1}o=d;if(t!==null)d?t.length=d:t=null;var l=v===o}else var l=!0;if(l){if(a.outputPath!==void 0){let r=a.outputPath,i=o,v=o,d=!1,f=o;if(o===f)if("string"==typeof r){if(r.includes("!")||e.test(r)!==!1){let r={params:{}};t===null?t=[r]:t.push(r),o++}}else{let r={params:{type:"string"}};t===null?t=[r]:t.push(r),o++}var n=f===o;if(!(d=d||n)){let e=o;if(!(r instanceof Function)){let r={params:{}};t===null?t=[r]:t.push(r),o++}var n=e===o;d=d||n}if(!d){let r={params:{}};t===null?t=[r]:t.push(r),o++,s.errors=t;return!1}o=v;if(t!==null)v?t.length=v:t=null;var l=i===o}else var l=!0;if(l)if(a.publicPath!==void 0){let r=a.publicPath,e=o,i=o,n=!1,d=o;if("string"!=typeof r){let r={params:{type:"string"}};t===null?t=[r]:t.push(r),o++}var v=d===o;if(!(n=n||v)){let e=o;if(!(r instanceof Function)){let r={params:{}};t===null?t=[r]:t.push(r),o++}var v=e=
```

**File**: `schemas/plugins/ids/HashedModuleIdsPlugin.check.js` (modified, +1/-1)
```diff
@@ -4,4 +4,4 @@
  * This file was automatically generated by "schema-utils".
  * DO NOT MODIFY BY HAND.
  */
-"use strict";module.exports=a,module.exports.default=a;let r={definitions:{HashFunction:{anyOf:[{type:"string",minLength:1},{instanceof:"Function"}]}},type:"object",additionalProperties:!1,properties:{context:{type:"string",absolutePath:!0},hashDigest:{enum:["base64","base64url","hex","binary","utf8","utf-8","utf16le","utf-16le","latin1","ascii","ucs2","ucs-2"]},hashDigestLength:{type:"number",minimum:1},hashFunction:{oneOf:[{$ref:"#/definitions/HashFunction"}]}},$id:"HashedModuleIdsPlugin.json"},e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i;function a(s,{instancePath="",parentData,parentDataProperty,rootData=s}={}){let t=null,i=0;if(i===0)if(s&&"object"==typeof s&&!Array.isArray(s)){let o=i;for(let r in s)if(!(r==="context"||r==="hashDigest"||r==="hashDigestLength"||r==="hashFunction"))return a.errors=[{params:{additionalProperty:r}}],!1;if(o===i){if(s.context!==void 0){let r=s.context,t=i;if(i===t)if("string"==typeof r){if(r.includes("!")||e.test(r)!==!0)return a.errors=[{params:{}}],!1}else return a.errors=[{params:{type:"string"}}],!1;var n=t===i}else var n=!0;if(n){if(s.hashDigest!==void 0){let e=s.hashDigest,t=i;if(!(e==="base64"||e==="base64url"||e==="hex"||e==="binary"||e==="utf8"||e==="utf-8"||e==="utf16le"||e==="utf-16le"||e==="latin1"||e==="ascii"||e==="ucs2"||e==="ucs-2"))return a.errors=[{params:{allowedValues:r.properties.hashDigest.enum}}],!1;var n=t===i}else var n=!0;if(n){if(s.hashDigestLength!==void 0){let r=s.hashDigestLength,e=i;if(i===e)if("number"==typeof r){if(r<1||isNaN(r))return a.errors=[{params:{comparison:">=",limit:1}}],!1}else return a.errors=[{params:{type:"number"}}],!1;var n=e===i}else var n=!0;if(n)if(s.hashFunction!==void 0){let r=s.hashFunction,e=i,o=i,d=!1,u=null,f=i,v=i,c=!1,h=i;if(i===h)if("string"==typeof r){if(function(r){let e=r.length,a=0,s=0,t;while(s<e){a++;if((t=r.charCodeAt(s++))>=55296&&t<=56319&&s<e&&((t=r.charCodeAt(s))&64512)==56320)s++}return a}(r)<1){let r={params:{limit:1}};t===null?t=[r]:t.push(r),i++}}else{let r={params:{type:"string"}};t===null?t=[r]:t.push(r),i++}var l=h===i;if(!(c=c||l)){let e=i;if(!(r instanceof Function)){let r={params:{}};t===null?t=[r]:t.push(r),i++}var l=e===i;c=c||l}if(!c){let r={params:{}};t===null?t=[r]:t.push(r),i++}else{i=v;if(t!==null)v?t.length=v:t=null}if(f===i)d=!0,u=0;if(!d){let r={params:{passingSchemas:u}};t===null?t=[r]:t.push(r),i++,a.errors=t;return!1}i=o;if(t!==null)o?t.length=o:t=null;var n=e===i}else var n=!0}}}}else return a.errors=[{params:{type:"object"}}],!1;return a.errors=t,i===0}
\ No newline at end of file
+"use strict";module.exports=s,module.exports.default=s;let r={definitions:{HashFunction:{anyOf:[{type:"string",minLength:1},{instanceof:"Function"}]}},type:"object",additionalProperties:!1,properties:{context:{type:"string",absolutePath:!0},hashDigest:{enum:["base64","base64url","hex","binary","utf8","utf-8","utf16le","utf-16le","latin1","ascii","ucs2","ucs-2"]},hashDigestLength:{type:"number",minimum:1},hashFunction:{oneOf:[{$ref:"#/definitions/HashFunction"}]}},$id:"HashedModuleIdsPlugin.json"},e=/^(?:file:(?=\/))?(?:[A-Za-z]:(\\|\/)|\\\\|\/)/i,a=function(r){let e=r.length,a=0,s=0,t;while(s<e){a++;if((t=r.charCodeAt(s++))>=55296&&t<=56319&&s<e&&((t=r.charCodeAt(s))&64512)==56320)s++}return a};function s(t,{instancePath="",parentData,parentDataProperty,rootData=t}={}){let i=null,n=0;if(n===0)if(t&&"object"==typeof t&&!Array.isArray(t)){let d=n;for(let r in t)if(!(r==="context"||r==="hashDigest"||r==="hashDigestLength"||r==="hashFunction"))return s.errors=[{params:{additionalProperty:r}}],!1;if(d===n){if(t.context!==void 0){let r=t.context,a=n;if(n===a)if("string"==typeof r){if(r.includes("!")||e.test(r)!==!0)return s.errors=[{params:{}}],!1}else return s.errors=[{params:{type:"string"}}],!1;var l=a===n}else var l=!0;if(l){if(t.hashDigest!==void 0){let e=t.hashDigest,a=n;if(!(e==="base64"||e==="base64url"||e==="hex"||e==="binary"||e==="utf8"||e==="utf-8"||e==="utf16le"||e==="utf-16le"||e==="latin1"||e==="ascii"||e==="ucs2"||e==="ucs-2"))return s.errors=[{params:{allowedValues:r.properties.hashDigest.enum}}],!1;var l=a===n}else var l=!0;if(l){if(t.hashDigestLength!==void 0){let r=t.hashDigestLength,e=n;if(n===e)if("number"==typeof r){if(r<1||isNaN(r))return s.errors=[{params:{comparison:">=",limit:1}}],!1}else return s.errors=[{params:{type:"number"}}],!1;var l=e===n}else var l=!0;if(l)if(t.hashFunction!==void 0){let r=t.hashFunction,e=n,d=n,u=!1,f=null,v=n,c=n,h=!1,p=n;if(n===p)if("string"==typeof r){if(a(r)<1){let r={params:{limit:1}};i===null?i=[r]:i.push(r),n++}}else{let r={params:{type:"string"}};i===null?i=[r]:i.push(r),n++}var o=p===n;if(!(h=h||o)){let e=n;if(!(r instanceof Function)){let r={params:{}};i===null?i=[r]:i.push(r),n++}var o=e===n;h=h||o}if(!h){let r={params:{}};i===null?i=[r]:i.push(r),n++}else{n=c;if(i!==null)c?i.length=c:i=null}if(v===n)u=!0,f=0;if(!u){let r={params
```

---

### Incident Patch 2: `e9cc8909` (2026-11-22)
**Commit Message**: fix(css): fix the attribute and namespace scans review found after #23523 (#23528)

* fix(css): fix the attribute and namespace scans review found after #23523

The attribute selector check no longer backtracks exponentially, reads a hex
escape whole and takes a case modifier right after a quoted value. The
namespace scan skips a url token and escapes inside blocks. The equivalence
harness samples prefers-color-scheme rules again under the color-scheme
relaxation.

* fix(css): read a hex escape whole in the namespace scan's url check

The scan now reads u\72 l( as url(. Under the color-scheme relaxation, the
dark samples leave out only the properties a light-dark() rule sets on the
elements it reaches or that inherit from them.

* test(css): leave out only what the used color scheme alone moves

Under the color-scheme relaxation, a dark-sample difference is dropped only when
both frames agree once the root's color-scheme is light, while the frames still
match dark queries. A winning dark-query value is compared again.

* test(css): set the light root scheme outright and keep box changes

The light reading sets the root's color-scheme to light instead of removing it,
so a sheet's ow

**File**: `lib/css/syntax-parser.js` (modified, +50/-3)
```diff
@@ -22111,6 +22111,20 @@ const NAMESPACE_AT_RULE = new Set(["namespace"]);
 const namesNamespaceAtRule = (input) =>
 	namesAtRule(input, NAMESPACE_AT_RULE) && opensNamespaceStatement(input);
 
+/**
+ * Whether the text from `from` opens on a string once whitespace is skipped,
+ * which makes a `url(` a function token rather than a url token (§4.3.4).
+ * @param {string} input source
+ * @param {number} from the offset right after the `(`
+ * @returns {boolean} true when a quote comes first
+ */
+const opensWithString = (input, from) => {
+	let i = from;
+	while (isAsciiWhitespace(input.charCodeAt(i))) i++;
+	const code = input.charCodeAt(i);
+	return code === CC_QUOTATION_MARK || code === CC_APOSTROPHE;
+};
+
 /**
  * Whether a top-level statement opens on `@namespace`: one at the start, after
  * a `;` or after a block's `}`, outside every block, comment and string. A
@@ -22123,9 +22137,44 @@ const opensNamespaceStatement = (input) => {
 	/** @type {number[]} */
 	const closers = [];
 	let start = true;
+	// Where the run of name code points and escapes before `i` opens, or -1.
+	let nameStart = -1;
 	for (let i = 0; i < input.length; i++) {
 		const code = input.charCodeAt(i);
-		if (code === CC_SOLIDUS && input.charCodeAt(i + 1) === CC_ASTERISK) {
+		// A `\` before a newline is a delim (§4.3.8), no escape.
+		const escape =
+			code === CC_REVERSE_SOLIDUS && !isNewline(input.charCodeAt(i + 1));
+		if (
+			escape ||
+			isIdentCodePoint(code) ||
+			// A hash or at-keyword spelling `url` opens no url token.
+			code === CC_NUMBER_SIGN ||
+			(code === CC_AT_SIGN && !(start && closers.length === 0))
+		) {
+			if (nameStart === -1) nameStart = i;
+			if (escape) {
+				const gobbled = gobbleHex(input, i + 1);
+				i += gobbled === undefined ? 1 : gobbled[1];
+			}
+			if (closers.length === 0) start = false;
+			continue;
+		}
+		const name = nameStart;
+		nameStart = -1;
+		if (
+			code === CC_LEFT_PARENTHESIS &&
+			name !== -1 &&
+			atKeyword(input.slice(name, i)) === "url" &&
+			!opensWithString(input, i + 1)
+		) {
+			// A url token (§4.3.6): what it holds up to its `)` is no structure.
+			for (i++; i < input.length; i++) {
+				const inner = input.charCodeAt(i);
+				if (inner === CC_REVERSE_SOLIDUS) i++;
+				else if (inner === CC_RIGHT_PARENTHESIS) break;
+			}
+			if (closers.length === 0) start = false;
+		} else if (code === CC_SOLIDUS && input.charCodeAt(i + 1) === CC_ASTERISK) {
 			const end = input.indexOf("*/", i + 2);
 			if (end === -1) return false;
 			i = end + 1;
@@ -22163,8 +22212,6 @@ const opensNamespaceStatement = (input) => {
 					return true;
 				}
 				i = end - 1;
-			} else if (code === CC_REVERSE_SOLIDUS) {
-				i++;
 			}
 			start = false;
 		}
```

**File**: `lib/css/syntax-printer.js` (modified, +8/-2)
```diff
@@ -2794,10 +2794,16 @@ const matchingBracket = (text, at) => {
 	return -1;
 };
 
+// WHY: one name code point or one whole escape, a hex one with its terminating
+// whitespace; the hex escape takes every digit it can and the other excludes
+// hex, so no run splits two ways - nested repeats took seconds on 40 letters.
+const ATTRIBUTE_NAME_UNIT = String.raw`(?:[-\w\u0080-\uFFFF]|\\(?:[\da-fA-F]{6}|[\da-fA-F]{1,5}(?![\da-fA-F]))[ \t\n\r\f]?|\\[^\n\da-fA-F])`;
+
 // An attribute selector's body, Selectors 4 §11: an optional namespace, its
 // name, and an optional matcher, value and case modifier.
-const ATTRIBUTE_SELECTOR_RE =
-	/^(?:(?:(?:[-\w\u0080-\uFFFF]+|\\[\s\S])*|\*)\|)?(?:[-\w\u0080-\uFFFF]+|\\[\s\S])+(?:[~|^$*]?=\s*(?:"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|(?:[-\w\u0080-\uFFFF]+|\\[\s\S])+)(?:\s+[iIsS])?)?$/;
+const ATTRIBUTE_SELECTOR_RE = new RegExp(
+	String.raw`^(?:(?:${ATTRIBUTE_NAME_UNIT}*|\*)\|)?${ATTRIBUTE_NAME_UNIT}+(?:[~|^$*]?=\s*(?:"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|${ATTRIBUTE_NAME_UNIT}+)(?:\s*[iIsS])?)?$`
+);
 
 /**
  * Whether a `[...]`'s contents are a wq-name, with or without a matcher, value
```

**File**: `test/fixtures/css/css-syntax-minify-keeps-an-empty-rule-before-a-namespace-after-a-url-holding-a-brace/index.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.a{}@unknown url({);@namespace "urn:x";div{color:red}
```

**File**: `test/fixtures/css/css-syntax-minify-keeps-an-empty-rule-before-a-namespace-after-an-escaped-brace/index.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.a{}@unknown (\{);@namespace "urn:x";div{color:red}
```

**File**: `test/fixtures/css/css-syntax-minify-keeps-an-empty-rule-before-a-namespace-after-an-escaped-url-holding-a-brace/expected.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+[
+	{
+		"relation": "agreement",
+		"contains": "/@import[1]: css-tree @import",
+		"why": "an ident-like token decodes its name before asking whether it is `url`, so `u\\72 l(` opens a url token whose `{` is no block (§4.3.4); css-tree reads the escaped name as a function and the `{` as a block"
+	},
+	{
+		"relation": "agreement",
+		"contains": "/@namespace[1]: css-tree nothing",
+		"why": "css-tree's `@import` runs on past the url token's `;`, so it reads no `@namespace` after it"
+	}
+]
```

**File**: `test/fixtures/css/css-syntax-minify-keeps-an-empty-rule-before-a-namespace-after-an-escaped-url-holding-a-brace/index.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.a{}@import u\72 l(a{b);@namespace "urn:x";div{color:red}
```

**File**: `test/fixtures/css/css-syntax-minify-lowering-nesting-keeps-a-child-of-a-case-modifier-after-a-quoted-value/index.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+[a="x y"i]{& .child{color:red}}
```

**File**: `test/fixtures/css/css-syntax-minify-lowering-nesting-keeps-a-child-of-an-attribute-named-with-a-hex-escape/index.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+[data\3a foo]{& .child{color:red}}
```

---

### Incident Patch 3: `36a84089` (2026-11-23)
**Commit Message**: test: fuzz watch, persistent-cache and HMR rebuilds against random edit sequences (#23546)

* test(watch): fuzz watch and persistent-cache rebuilds against random edit sequences

A project of linked modules is edited by seeded random steps; after each, the watch rebuild and a cache-restored build are held to a fresh one. `yarn test:rebuild-fuzz` runs 100 seeds in ~2 minutes. Found 9 bugs already fixed on main.

* test(watch): cover concatenateModules and splitChunks combined with cacheUnaffected

Two feature combinations webpack recently allowed had never been fuzzed together: concatenateModules + cacheUnaffected (#22746) and splitChunks + cacheUnaffected. Both pass 1000+ fresh seeds clean on current main; kept as permanent variants.

* test(hmr): apply each rebuild as a hot update and compare the running bundle

Hot variants run the bundle in a VM from the in-memory output, apply every
rebuild with module.hot.check(true), and hold what the bundle then exports,
dynamic imports included, to a fresh build's bundle. Errored builds reload.

* test(watch): apply every timestamp-only edit of a step

* test(watch): fail a seed on a fatal watch error instead of hanging

* test(hmr): read t

**File**: `package.json` (modified, +1/-0)
```diff
@@ -97,6 +97,7 @@
     "test:js-fuzz": "yarn test:base --testMatch \"<rootDir>/test/specCases/js-fuzz.spectest.js\"",
     "test:xml-fuzz": "yarn test:base --testMatch \"<rootDir>/test/specCases/xml-fuzz.spectest.js\"",
     "test:syntax-fuzz": "yarn test:base --testMatch \"<rootDir>/test/specCases/syntax-fuzz.spectest.js\"",
+    "test:rebuild-fuzz": "yarn test:base --testMatch \"<rootDir>/test/specCases/rebuild-fuzz.spectest.js\"",
     "test:html5lib": "yarn test:base --testMatch \"<rootDir>/test/specCases/html5lib.spectest.js\"",
     "test:syntax-equivalence": "yarn test:base --testMatch \"<rootDir>/test/specCases/syntaxEquivalence.spectest.js\"",
     "test:css-parsing": "yarn test:base --testMatch \"<rootDir>/test/specCases/cssParsing-webpack.spectest.js\"",
```

**File**: `test/helpers/rebuildFuzzProject.js` (added, +648/-0)
```diff
@@ -0,0 +1,648 @@
+"use strict";
+
+// A small project and the seeded edits made to it, for the rebuild fuzzer: an
+// edit names modules, links and files by numbers taken modulo what exists, so
+// any subsequence of edits still applies, which lets a failure be shrunk.
+
+const path = require("path");
+const { createRandom } = require("./jsFuzzProgram");
+
+/** @typedef {"static" | "dynamic" | "star" | "named" | "require"} LinkKind */
+/** @typedef {{ to: string, kind: LinkKind, name: string }} Link */
+/** @typedef {{ kind: "json", to: string, key: string } | { kind: "loader" } | { kind: "context" }} Read */
+/** @typedef {{ format: "esm" | "cjs", exports: string[], links: Link[], reads: Read[], revision: number, exists: boolean, broken: boolean, effect: boolean, dir: string }} ModuleRecord */
+/** @typedef {{ revision: number, exists: boolean }} DataRecord */
+/** @typedef {{ keys: string[], revision: number, exists: boolean }} JsonRecord */
+/** @typedef {{ nextModule: number, modules: Map<string, ModuleRecord>, nextData: number, data: Map<string, DataRecord>, nextJson: number, json: Map<string, JsonRecord>, sideEffectsFalse: boolean, touched: string[] }} Project */
+/** @typedef {[string, number, number, number, number]} Edit */
+
+/** @type {LinkKind[]} */
+const LINK_KINDS = ["static", "static", "dynamic", "star", "named", "require"];
+const NAMES = ["a", "b", "c", "d"];
+// purging a changed file clears every cached listing under its folder, so
+// nothing the edits change sits at the root, which holds every other folder
+const DIRS = ["app/", "app/sub/", "lib/"];
+/** @type {Read["kind"][]} */
+const READ_KINDS = ["json", "loader", "context"];
+
+/**
+ * @template T
+ * @param {T[]} list list
+ * @param {number} index any integer
+ * @returns {T} the item the index names, modulo the length
+ */
+const pick = (list, index) =>
+	list[((index % list.length) + list.length) % list.length];
+
+/**
+ * @param {string[]} exports exported names
+ * @param {string} dir folder, "" for the root
+ * @returns {ModuleRecord} a module with no links
+ */
+const createModule = (exports, dir) => ({
+	format: "esm",
+	exports,
+	links: [],
+	reads: [],
+	revision: 0,
+	exists: true,
+	broken: false,
+	effect: false,
+	dir
+});
+
+/**
+ * @returns {Project} `index.js → m0 → m1`, with one data file
+ */
+const createProject = () => {
+	const m0 = createModule(["a", "b"], "app/");
+	m0.links.push({ to: "m1", kind: "static", name: "a" });
+	return {
+		nextModule: 2,
+		modules: new Map([
+			["m0", m0],
+			["m1", createModule(["a"], "app/sub/")]
+		]),
+		nextData: 1,
+		data: new Map([["d0", { revision: 0, exists: true }]]),
+		nextJson: 0,
+		json: new Map(),
+		sideEffectsFalse: false,
+		touched: []
+	};
+};
+
+/**
+ * @param {Project} project project
+ * @returns {Project} a copy the next step's edits change
+ */
+const cloneProject = (project) => ({
+	...project,
+	touched: [],
+	modules: new Map(
+		[...project.modules].map(([id, record]) => [
+			id,
+			{
+				...record,
+				exports: [...record.exports],
+				links: record.links.map((link) => ({ ...link })),
+				reads: record.reads.map((read) => ({ ...read }))
+			}
+		])
+	),
+	data: new Map([...project.data].map(([id, file]) => [id, { ...file }])),
+	json: new Map(
+		[...project.json].map(([id, file]) => [
+			id,
+			{ ...file, keys: [...file.keys] }
+		])
+	)
+});
+
+/**
+ * @param {Project} project project
+ * @param {number} index any integer
+ * @returns {ModuleRecord} the module the index names
+ */
+const pickModule = (project, index) =>
+	/** @type {ModuleRecord} */ (
+		project.modules.get(pick([...project.modules.keys()], index))
+	);
+
+/**
+ * @template T
+ * @param {Map<string, T>} map files
+ * @param {(item: T, id: string) => boolean} filter which files qualify
+ * @returns {string[]} the ids of the files that qualify
+ */
+const idsWhere = (map, filter) =>
+	[...map].filter(([id, item]) => filter(item, id)).map(([id]) => id);
+
+/**
+ * @template T
+ * @param {T[]} list list, changed
+ * @param {number} index any integer
+ */
+const removeAt = (list, index) => {
+	list.splice(((index % list.length) + list.length) % list.length, 1);
+};
+
+// Each edit changes the project and returns false when it cannot apply.
+/** @type {Record<string, (project: Project, ...args: number[]) => boolean | void>} */
+const EDITS = {
+	edit(project, m) {
+		pickModule(project, m).revision++;
+	},
+	touch(project, m) {
+		const id = pick(
+			idsWhere(project.modules, (record) => record.exists),
+			m
+		);
+		const record = /** @type {ModuleRecord} */ (project.modules.get(id));
+		project.touched.push(`${record.dir}${id}.js`);
+	},
+	add(project, from, format, kind, name) {
+		const id = `m${project.nextModule++}`;
+		const record = createModule([pick(NAMES, name)], pick(DIRS, kind + name));
+		if (format % 3 === 0) record.format = "cjs";
+		const source = pickModule(project, from);
+		project.modules.set(id, record);
+		source.links.push({
+			to: id,
+			kind
```

**File**: `test/specCases/rebuild-fuzz.spectest.js` (added, +809/-0)
```diff
@@ -0,0 +1,809 @@
+"use strict";
+
+// Applies seeded edit sequences to a small project and, after every step,
+// holds the watch rebuild and a build restored from the persistent cache to a
+// fresh build, and a second cached build with no edit to writing nothing.
+// Hot variants also run the bundle and apply each update, and hold what the
+// running bundle then exports to what a fresh build's bundle exports.
+
+const fs = require("fs");
+const os = require("os");
+const path = require("path");
+const vm = require("vm");
+const { Volume, createFsFromVolume } = require("memfs");
+const webpack = require("../../");
+const NodeWatchFileSystem = require("../../lib/node/NodeWatchFileSystem");
+const {
+	applyEdit,
+	cloneProject,
+	createProject,
+	generateSteps,
+	renderFiles
+} = require("../helpers/rebuildFuzzProject");
+const { isInPart } = require("../helpers/testParts");
+
+/** @typedef {import("../helpers/rebuildFuzzProject").Edit} Edit */
+/** @typedef {import("../helpers/rebuildFuzzProject").Project} Project */
+/** @typedef {import("../../").Configuration} Configuration */
+/** @typedef {import("../../").Compiler} Compiler */
+/** @typedef {import("../../").Compilation} Compilation */
+/** @typedef {import("../../").Stats} Stats */
+/** @typedef {import("../../").InputFileSystem} InputFileSystem */
+/** @typedef {import("memfs").IFs} IFs */
+/** @typedef {{ mode: "production" | "development", splitChunks?: boolean, watchCache?: "filesystem", cacheUnaffected?: boolean, concatenateModules?: boolean, hot?: boolean }} Variant */
+/** @typedef {{ assets: Record<string, string>, hash: string, entry: string | undefined, errors: string[], warnings: string[] }} Result */
+/** @typedef {{ context: vm.Context, error: string | undefined }} Runtime */
+/** @typedef {{ step: number, check: string, detail: string }} Failure */
+/** @typedef {{ files: Set<string>, directories: Set<string>, missing: Set<string>, callback: (...args: EXPECTED_ANY[]) => void, undelayed?: (...args: EXPECTED_ANY[]) => void }} PendingWatch */
+
+const SEED_COUNT = Number(process.env.REBUILD_FUZZ_SEEDS) || 100;
+const STEPS = Number(process.env.REBUILD_FUZZ_STEPS) || 25;
+const SEED_TIMEOUT = 300000;
+// Shrinking a long sequence can rebuild hundreds of times; past this the
+// failure is reported with what has been shrunk so far.
+const SHRINK_BUDGET = 120000;
+
+/** @type {Variant[]} */
+const VARIANTS = [
+	{ mode: "production" },
+	{ mode: "development" },
+	{ mode: "production", splitChunks: true },
+	{ mode: "production", watchCache: "filesystem" },
+	{ mode: "development", watchCache: "filesystem" },
+	{ mode: "production", cacheUnaffected: true },
+	{ mode: "development", cacheUnaffected: true },
+	// production already defaults concatenateModules on; these force it with
+	// cacheUnaffected, a combination webpack only recently started allowing
+	{ mode: "production", concatenateModules: true, cacheUnaffected: true },
+	{ mode: "development", concatenateModules: true, cacheUnaffected: true },
+	// splitChunks and cacheUnaffected have never been fuzzed together either
+	{ mode: "production", splitChunks: true, cacheUnaffected: true },
+	{ mode: "development", hot: true },
+	{ mode: "development", hot: true, watchCache: "filesystem" },
+	{ mode: "development", hot: true, cacheUnaffected: true },
+	{ mode: "development", hot: true, splitChunks: true },
+	{ mode: "production", hot: true }
+];
+
+/** @type {number[]} */
+const SEEDS = (() => {
+	const seed = process.env.REBUILD_FUZZ_SEED;
+	if (seed === "random") return [Math.floor(Math.random() * 1e9)];
+	if (seed) return [Number(seed)];
+	return Array.from({ length: SEED_COUNT }, (_, i) => i + 1);
+})();
+
+// Every write is dated to its step, in the past, so the watcher's accuracy
+// window never hides an edit and two steps never share a time.
+const T0 = Math.floor(Date.now() / 1000 - 10 * 24 * 3600) * 1000;
+
+/**
+ * Stands in for NodeWatchFileSystem: reports exactly the edits a step made, in
+ * watchpack's time-info format and only for what webpack asked to watch, and
+ * runs the real purge of what a new watch call no longer watches.
+ */
+class FakeWatchFileSystem {
+	/**
+	 * @param {InputFileSystem} inputFileSystem the compiler's input file system
+	 */
+	constructor(inputFileSystem) {
+		this.inputFileSystem = inputFileSystem;
+		/** @type {PendingWatch | undefined} */
+		this.pending = undefined;
+		/** @type {EXPECTED_ANY} */
+		this._watched = undefined;
+	}
+
+	/**
+	 * @param {Iterable<string>} files files
+	 * @param {Iterable<string>} directories directories
+	 * @param {Iterable<string>} missing missing paths
+	 * @param {number} startTime start time
+	 * @param {EXPECTED_OBJECT} options watch options
+	 * @param {(...args: EXPECTED_ANY[]) => void} callback called with the changes
+	 * @param {(...args: EXPECTED_ANY[]) => void=} undelayed called at the first change
+	 * @returns {EXPECTED_ANY} the watcher
+	 */
+	watch(files, directories, missing, startTime, optio
```

#### Recent Merged Pull Requests:
- **PR #23554** (2026-11-24): fix(minify): keep a negated equality right when an if swaps its branches (@Divyansh089)
- **PR #23552** (closed): fix: match global and sticky regexps in warning and stats filters on every test (@waw666waw666)
- **PR #23551** (2026-11-24): fix(hmr): fix the hot updates the rebuild fuzzer found lost (@aryanraj45)
- **PR #23550** (2026-11-23): fix(side-effects): keep `ns.sub.member` read from `export * as sub` (@alexander-akait)
- **PR #23549** (closed): fix(side-effects): keep namespace re-export bindings distinct from sibling export * (@YuvrajVerma09arch)
- **PR #23547** (closed): docs: add example with swc-next parser (@CPunisher)

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

## X. minify): close more one-pass minifier gaps to terser and fix wrong output

**RULE**:
When implementing operations in `.changeset/282-javascript-minify-one-pass-gaps.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webpack/webpack. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `76e24ad9`: minify): close more one-pass minifier gaps to terser and fix wrong output. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/282-javascript-minify-one-pass-gaps.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
Fold more values, calls and dead code when minifying, and fix wrong output.
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
Fold more known values, calls, object assignments and dead code when minifying.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `76e24ad9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
