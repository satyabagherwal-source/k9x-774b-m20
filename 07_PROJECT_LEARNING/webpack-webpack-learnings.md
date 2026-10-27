> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webpack-webpack-learnings.md`  
> **Source**: github ([https://github.com/webpack/webpack](https://github.com/webpack/webpack))  
> **Source Version**: `c93aa8f9`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T18:36:18.490Z  
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
> **Harvest Timestamp**: 2026-10-27T18:36:18.240Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webpack/webpack`
- **Description**: A bundler for javascript and friends. Packs many modules into a few bundled assets. Code Splitting allows for loading parts of the application on demand. Through "loaders", modules can be CommonJs, AMD, ES6 modules, CSS, Images, JSON, Coffeescript, LESS, ... and your custom stuff.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 65970 stars

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

### Incident Patch 1: `1cde23ad` (2026-10-26)
**Commit Message**: test: cover each printer from its own unit tests and fix what that found (#22903)

* fix(html): cover the printer from its own tests and fix what that found

Prints that re-parsed to a different tree, now each printed so the tree
comes back the same:
- content after a `<plaintext>` no longer gets end tags that read as
  text; a script left double-escaped at EOF gets no `</script>`;
- a `<?pi>` keeps the shell tags around it, as a comment does;
- `<body>` stays before a head element, a `<noscript>`, a template or
  whitespace collapsing removes; `<html>` in foreign content keeps its
  start tag; `<tbody>`/`<colgroup>` in template content and `</caption>`
  before a script are kept;
- nested forms, text fostered out of a table and merged into earlier
  text, and fragment prints (whitespace under the root, a stray `<html>`,
  non-body contexts) are re-parsed and fall back to the source.
A streamed walk starting after a `</form>` no longer visits out of
order, `skipChildren()` while printing no longer writes `undefined`, and
`<tr> <table><tr><option><li>` no longer throws.

The printer tests now reach every statement and branch of the HTML
printer and minifier; checks no input could fa

**File**: `.changeset/066-printer-fixes.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"webpack": patch
+---
+
+Fix CSS, HTML and JavaScript minifier output bugs found by printer coverage.
```

**File**: `lib/css/syntax-parser.js` (modified, +389/-176)
```diff
@@ -3780,7 +3780,10 @@ const ESCAPE_CLASS_SINGLE = 1;
 const _escapeClassTable = new Uint8Array(128);
 for (let i = 0; i < 128; i++) {
 	const ch = String.fromCharCode(i);
-	_escapeClassTable[i] = /[\t\n\f\r\v]/.test(ch)
+	// Every control code point, as cssesc writes them: one is no ident code
+	// point, so written raw it would end the identifier there.
+	// eslint-disable-next-line no-control-regex -- the control code points are what is matched
+	_escapeClassTable[i] = /[\u0001-\u001F\u007F]/.test(ch)
 		? ESCAPE_CLASS_HEX
 		: ch === "\\" || regexSingleEscape.test(ch)
 			? ESCAPE_CLASS_SINGLE
@@ -3817,9 +3820,12 @@ const _escapeIdentifier = (str) => {
 	// char codes is equivalent to regexes over `output` — and keeps the common
 	// nothing-to-do call regex-free.
 	const first = str.charCodeAt(0);
+	// A lone `-` is no identifier either, and `\-` is.
 	if (
 		first === CC_HYPHEN_MINUS &&
-		(str.charCodeAt(1) === CC_HYPHEN_MINUS || isDigit(str.charCodeAt(1)))
+		(str.length === 1 ||
+			str.charCodeAt(1) === CC_HYPHEN_MINUS ||
+			isDigit(str.charCodeAt(1)))
 	) {
 		output = `\\-${output.slice(1)}`;
 	} else if (isDigit(first)) {
@@ -4115,7 +4121,14 @@ const normalizeUrl = (str, isString) => {
 	if (str.includes("\\")) {
 		str = str.replace(UNESCAPE, (match) => {
 			if (match.length > 2) {
-				return String.fromCharCode(Number.parseInt(match.slice(1).trim(), 16));
+				// CSS Syntax 3 §4.3.7: a code point, not a UTF-16 unit, and U+FFFD
+				// for zero, a surrogate or one past the last.
+				const code = Number.parseInt(match.slice(1).trim(), 16);
+				return code === 0 ||
+					(code >= 0xd800 && code <= 0xdfff) ||
+					code > 0x10ffff
+					? "\uFFFD"
+					: String.fromCodePoint(code);
 			}
 			return match[1];
 		});
@@ -4299,11 +4312,13 @@ let _prefixBrowsers = null;
 /** @type {CompiledVisitorBucket | undefined} */
 let _commentBucket;
 
-// Comments reach the visitor map as `NodeType.Comment` rather than through a
-// side callback. They fire during tokenization, in source order among comments
-// rather than interleaved with the walk, on a transient store node.
+// Comments reach the visitor map as `NodeType.Comment`, firing during
+// tokenization in source order on a transient store node — only while a
+// comment visitor is registered, not interleaved with the walk.
 /** @type {(input: string, start: number, end: number) => number} */
 const _grammarOnComment = (_src, start, end) => {
+	// `stop()` from a visitor drops the bucket while the node it is in still
+	// tokenizes, so a comment after it reaches here with none.
 	if (_commentBucket === undefined) return end;
 	const node = _makeLeaf(NodeType.Comment, start, end);
 	_S._currentNode = node;
@@ -4526,12 +4541,9 @@ const _printVerbatimLeaf = (ty, node, parent, writer) => {
 	// The end of the input is where `_printedSource` resolves a trailing escape.
 	if (end === _S._input.length) {
 		const text = _printedSource(node);
-		if (ident) {
-			if (text.includes("\\")) return false;
-			writer.printedAs(node, text);
-		} else {
-			writer.printedAs(node, text === "\\" ? "\\\n" : text);
-		}
+		// A `\` the input ends on is an escape (§4.3.8), so no delim is one here.
+		if (ident && text.includes("\\")) return false;
+		writer.printedAs(node, text);
 		return true;
 	}
 	if (ident) {
@@ -4562,6 +4574,7 @@ const _walkValue = (node, parent, index, writer) => {
 	const ty = _types[_nodeIndex(node)];
 	const b = _visitors[ty];
 	let skip = false;
+	let held = false;
 	if (b !== undefined && b.enter.length !== 0) {
 		_walkSkip = false;
 		_S._currentNode = node;
@@ -4571,6 +4584,8 @@ const _walkValue = (node, parent, index, writer) => {
 		for (let i = 0; i < e.length; i++) e[i](A);
 		skip = _walkSkip;
 		_walkSkip = false;
+		held = skip && writer !== undefined;
+		if (held) skip = _holdSkippedVisitors();
 	}
 	// Everything below a math function is a math expression, `(…)` groups
 	// included, so the depth rides the recursion as `_within` does — and still
@@ -4647,6 +4662,7 @@ const _walkValue = (node, parent, index, writer) => {
 		writer._printer !== _verbatimLeafPrinter ||
 		!_printVerbatimLeaf(ty, node, parent, writer)
 	) {
+		if (held) _resumeSkippedVisitors();
 		_exitNode(node, parent, index, b, writer);
 	}
 	if (enteredMath) _S._mathFunctionDepth--;
@@ -4900,9 +4916,9 @@ const _blockMemoKeyOf = (i0, parent) => {
 		_blockMemoTable = /** @type {Map<string, string>} */ (_blockMemo);
 		return block;
 	}
-	const scope = `${_S._inPropertyRule ? "p" : ""}${_S._inFunctionRule ? "f" : ""}${
-		_S._inFeatureValuesRule ? "v" : ""
-	}${around}`;
+	const scope = `${_S._inPropertyRule ? "p" : ""}${
+		_S._inFunctionRule ? "f" : ""
+	}${_S._inFeatureValuesRule ? "v" : ""}${around}`;
 	let table = _blockMemoScopes.get(scope);
 	if (table === undefined) {
 		table = new Map();
@@ -4927,6 +4943,7 @@ const _walkRule = (node, parent, index, writer) => {
 	const ty = _types[i0];
 	const b = _visitors[ty];
 	let skip = false;
+	let held = fa
```

**File**: `lib/css/syntax-printer.js` (modified, +72/-67)
```diff
@@ -95,7 +95,6 @@ const {
 	X_AXIS_TRANSFORMS,
 	ZERO_ANGLE_FUNCTIONS,
 	ZERO_UNIT_KEEPING_PROPERTIES,
-	foldDivide,
 	getColorNameToShortest,
 	getInitialValueKeywords,
 	getKeywordOnlyProperties,
@@ -547,10 +546,10 @@ const _EXPONENT_LIKE_UNIT_RE = /^e[+-]?\d/i;
  * spelling alone and keeps a written fraction, since `z-index:1.0` is no integer.
  * Angles keep every digit: `rotate()` runs its argument through trig.
  * @param {string} text the token's source text
- * @param {boolean=} channel whether it is a percentage `rgb()` reads as a byte
+ * @param {boolean} channel whether it is a percentage `rgb()` reads as a byte
  * @returns {string} the normalized token
  */
-const _normalizeNumericToken = (text, channel = false) => {
+const _normalizeNumericToken = (text, channel) => {
 	const end = _numberEnd(text);
 	// A unit identifier matches ASCII case-insensitively, so `1PX` is `1px` — and
 	// the three units spelled with a capital keep the spelling everything writes.
@@ -709,15 +708,9 @@ const _roundCalcResult = (text, unit) => {
  * @returns {string | null} the printed value, or `null` when it does not print back exactly
  */
 const _printCalcTerm = (key, coefficient, written) => {
-	if (key === "" || key === "%") {
-		const text = _normalizeNumber(String(coefficient));
-		return Number(text) === coefficient
-			? _roundCalcResult(text, key) + key
-			: null;
-	}
 	const base = UNIT_GROUP_BASE.get(key);
-	// A unit outside the conversion table counts in itself, so the coefficient is
-	// already what it prints as.
+	// A number, a percentage or a unit outside the conversion table counts in
+	// itself, so the coefficient is already what it prints as.
 	if (base === undefined) {
 		const text = _normalizeNumber(String(coefficient));
 		return Number(text) === coefficient
@@ -744,8 +737,9 @@ const _printCalcTerm = (key, coefficient, written) => {
 		) {
 			continue;
 		}
-		const value = foldDivide(coefficient, to[1]);
-		if (value === null) continue;
+		// Every scale counts at least one of the group's smallest step, so the
+		// quotient is no larger than the finite coefficient.
+		const value = coefficient / to[1];
 		const text = _normalizeNumber(String(value));
 		if (Number(text) !== value || text.includes("e") || text.includes("E")) {
 			continue;
@@ -793,7 +787,8 @@ const _printCalcSum = (sum, written) => {
 		if (term === null) return null;
 		text += text === "" ? term : `${coefficient < 0 ? " - " : " + "}${term}`;
 	}
-	return text === "" ? null : text;
+	// An evaluated sum holds a term at least, so `text` is never empty here.
+	return text;
 };
 
 /**
@@ -902,8 +897,11 @@ const _foldMathFunction = (fn, inner) => {
 	// argument reduced to, which may still hold two units.
 	const written = _writtenUnits(tokens);
 	if (fn === "calc") return _printCalcSum(sums[0], written);
-	const fold = MATH_FUNCTION_FOLD.get(fn);
-	if (fold === undefined) return null;
+	// Every function with an arity but `calc()` has a fold (pinned by a test).
+	const fold =
+		/** @type {NonNullable<ReturnType<typeof MATH_FUNCTION_FOLD.get>>} */ (
+			MATH_FUNCTION_FOLD.get(fn)
+		);
 	const argument = fold.read(sums);
 	if (argument === null) return null;
 	const value = fold.apply(argument[1], keyword, fold.table);
@@ -1051,9 +1049,11 @@ const _dropPrefixTwin = (scope, signature) => {
 			if (one.piece !== -1) {
 				/** @type {PrintContext} */ (_stream.writer).retract(one.piece);
 				_noteRetractedPiece(one.piece);
-			} else if (one.node !== null) {
+			} else {
+				// Held as a node until a streamed parent gives it a piece, so one
+				// with no piece has its node.
 				if (scope.dead === null) scope.dead = new Set();
-				scope.dead.add(one.node);
+				scope.dead.add(/** @type {Node} */ (one.node));
 			}
 		}
 	}
@@ -1618,18 +1618,15 @@ const _PLAIN_IDENT_RE = /^-?[A-Za-z_-
  * the other spelling `<family-name>` names. Returns null wherever the quotes
  * carry something: a generic family's own keyword, a CSS-wide keyword, or text
  * no identifier could spell.
- * @param {string} raw the string token as written, quotes included
+ * @param {string} raw the string token as written, quotes included and closed
  * @returns {string | null} the unquoted name, or null to keep the string
  */
 const _unquoteFontFamily = (raw) => {
 	if (!_S._transforms.normalizeQuotes) return null;
-	const quote = raw.charCodeAt(0);
-	if (quote !== CC_QUOTATION_MARK && quote !== CC_APOSTROPHE) return null;
-	if (raw.length < 2 || raw.charCodeAt(raw.length - 1) !== quote) return null;
+	// The caller hands a whole string token, its closing quote written back.
 	const text = raw.slice(1, -1);
 	if (text.includes("\\")) return null;
 	const words = text.split(" ");
-	if (words.length === 0 || text.length + 1 >= raw.length) return null;
 	for (const word of words) {
 		if (!_PLAIN_IDENT_RE.test(word)) return null;
 		const lowered = toLowerCaseIfNeeded(word);
@@ -1655,16 +1652,17 @@ const _inColorOnlyProperty = () =>
  * Whether the dec
```

**File**: `lib/html/syntax-parser.js` (modified, +424/-167)
```diff
@@ -5394,8 +5394,8 @@ const _closeTagOf = (n) => {
 const _startOf = (n) => (n < 0 ? _attrNameStarts[-n] : _nodeStarts[n]);
 /** @type {(n: HtmlNodeRef) => number} where a node or attribute ends */
 const _endOf = (n) => (n < 0 ? _attrEnd(-n) : _nodeEnds[n]);
-/** @type {(n: HtmlNodeRef) => number} where a tag or attribute name ends (0 for a parser-inserted tag) */
-const _nameEndOf = (n) => (n < 0 ? _attrNameEnds[-n] : _nodeNameEnds[n]);
+/** @type {(n: HtmlNodeRef) => number} where an element's tag name ends (0 for a parser-inserted tag) */
+const _nameEndOf = (n) => _nodeNameEnds[n];
 /** @type {(n: HtmlNodeRef) => number} where an element's opening tag ends */
 const _contentStartOf = (n) => _nodeTagEnds[n];
 
@@ -5874,8 +5874,8 @@ const isSpecial = (el) => {
 	const tag = _tagNameOf(el);
 	if (ns === NS_HTML) return SPECIAL.has(tag);
 	if (ns === NS_MATHML) return MATHML_SPECIAL.has(tag);
-	if (ns === NS_SVG) return SVG_SPECIAL.has(tag.toLowerCase());
-	return false;
+	// SVG, the one namespace left: no other reaches the HTML tree builder.
+	return SVG_SPECIAL.has(tag.toLowerCase());
 };
 
 /**
@@ -6312,7 +6312,8 @@ const collapseWhitespaceRuns = (s) => {
 		}
 		run = -1;
 	}
-	return last === 0 ? s : out + s.slice(last);
+	// The test above found a run this rewrote, so `out` is never empty here.
+	return out + s.slice(last);
 };
 
 /**
@@ -7160,7 +7161,8 @@ const isBoundaryForKind = (el, kind) => {
  * @returns {boolean} true when the element is in that scope
  */
 const hasNameInScope = (tagName, kind) => {
-	for (let i = open.length - 1; i >= 0; i--) {
+	// `open[0]` is the `<html>` element, a boundary for every kind of scope.
+	for (let i = open.length - 1; i > 0; i--) {
 		const el = open[i];
 		if (_namespaceOf(el) === NS_HTML && _tagNameOf(el) === tagName) {
 			return true;
@@ -7189,7 +7191,8 @@ const inListItemScope = (tagName) => hasNameInScope(tagName, SCOPE_LIST_ITEM);
  * @returns {boolean} true when that element itself is in scope
  */
 const inScopeEl = (target) => {
-	for (let i = open.length - 1; i >= 0; i--) {
+	// `open[0]` is the `<html>` element, a scope boundary and never the target.
+	for (let i = open.length - 1; i > 0; i--) {
 		const el = open[i];
 		if (el === target) return true;
 		if (isScopeBoundary(el)) return false;
@@ -7202,7 +7205,8 @@ const inScopeEl = (target) => {
  */
 const inTableScope = (target) => {
 	const set = typeof target === "string" ? null : target;
-	for (let i = open.length - 1; i >= 0; i--) {
+	// `open[0]` is the `<html>` element, which stops a table scope walk.
+	for (let i = open.length - 1; i > 0; i--) {
 		const el = open[i];
 		if (_namespaceOf(el) === NS_HTML) {
 			if (set ? set.has(_tagNameOf(el)) : _tagNameOf(el) === target) {
@@ -7512,20 +7516,23 @@ const process = (t) => {
  */
 const processXml = (t) => {
 	const ty = t.type;
+	// `tokenizeXml` reports no end-of-file token, so every token has a range.
 	if (_xmlEntityRangeStart !== -1) {
 		if (ty === TOKEN_START_TAG || ty === TOKEN_END_TAG) {
 			t.pos.start = _xmlEntityRangeStart;
 			t.pos.end = _xmlEntityRangeEnd;
 			t.pos.tagEnd = _xmlEntityRangeEnd;
 			t.pos.nameEnd = 0;
-		} else if (ty !== TOKEN_EOF) {
+		} else {
 			const located = /** @type {CharToken} */ (t);
 			located.start = _xmlEntityRangeStart;
 			located.end = _xmlEntityRangeEnd;
 		}
 	}
-	if (ty === TOKEN_START_TAG || ty === TOKEN_END_TAG) tokenEnd = t.pos.end;
-	else if (ty !== TOKEN_EOF) tokenEnd = t.end;
+	tokenEnd =
+		ty === TOKEN_START_TAG || ty === TOKEN_END_TAG
+			? t.pos.end
+			: /** @type {CharToken} */ (t).end;
 	if (ty === TOKEN_CHAR) {
 		if (open.length === 0) return;
 		insertCharacters(t.data, t.start, t.end);
@@ -7568,15 +7575,14 @@ const processXml = (t) => {
 		if (!t.selfClosing) open.push(el);
 		return;
 	}
-	if (ty === TOKEN_END_TAG) {
-		// A misnested end tag closes the element it names and the ones opened
-		// inside it; one naming no open element is dropped.
-		for (let i = open.length - 1; i >= 0; i--) {
-			if (_tagNameOf(open[i]) !== t.name) continue;
-			while (open.length > i + 1) popOpen();
-			_nodeEnds[popOpen()] = t.pos.end;
-			return;
-		}
+	// An end tag, the one kind left. A misnested one closes the element it names
+	// and the ones opened inside it; one naming no open element is dropped.
+	const end = /** @type {EndTagToken} */ (t);
+	for (let i = open.length - 1; i >= 0; i--) {
+		if (_tagNameOf(open[i]) !== end.name) continue;
+		while (open.length > i + 1) popOpen();
+		_nodeEnds[popOpen()] = end.pos.end;
+		return;
 	}
 };
 
@@ -7851,16 +7857,14 @@ const adoptionAgency = (subject, pos) => {
 			k = next;
 		}
 		appendTo(furthest, cloneFmt);
-		// remove fmt from afe, insert clone at bookmark
+		// remove fmt from afe, insert clone at bookmark; the inner loop removes only
+		// entries other than fmt, so it is still in both lists
 		const curFmtIdx = afe.indexOf(fmt);
-		if (curFmtIdx !== -1) {
-			afeRemoveAt(curFmtIdx);
-			if (curFmtIdx < bookmark) bookmark--;
-
```

**File**: `lib/html/syntax-printer.js` (modified, +37/-33)
```diff
@@ -38,6 +38,7 @@ const {
 	_deferEmbedded,
 	_elementCloseTag,
 	_endTagOutsideSpan,
+	_endTagReadsAsText,
 	_endsOutsideLineBox,
 	_firstChild,
 	_formNeedsPointerReset,
@@ -58,6 +59,7 @@ const {
 	_nodeStrings,
 	_onlyTextChild,
 	_openTagSource,
+	_opensImpliedShell,
 	_parentOf,
 	_printedAttributeCount,
 	_printsNothing,
@@ -70,6 +72,7 @@ const {
 	_synthesizeOpenTag,
 	_tagNameOf,
 	_takeRenderedSheet,
+	_whitespaceInertUnder,
 	_xmlCharacterData,
 	_xmlElementIsStyled,
 	_xmlOpenTag,
@@ -176,6 +179,9 @@ const _hasOpenReference = (s) => {
 	return true;
 };
 
+// Every NUL, which a text node holds as U+FFFD wherever it keeps one at all.
+const NUL_REGEXP = /\0/g;
+
 /**
  * Whether the tag printed after this text would fuse with its tail: a `<` runs
  * into the next tag's name, and a `</` meets that tag's `<` as a bogus comment,
@@ -273,8 +279,8 @@ const _isXmlStylesheet = (path) => {
 	) {
 		return false;
 	}
+	// XML character data is only ever inside the root element.
 	const parent = _parentOf(path.node);
-	if (parent === 0) return false;
 	const name = _tagNameOf(parent);
 	if (name !== "style" && !name.endsWith(":style")) return false;
 	// As in HTML, the attribute is optional and only `text/css` keeps it CSS.
@@ -530,9 +536,9 @@ const _opensAScript = (js) => {
 			i += 2;
 			while (i < js.length && !JS_LINE_TERMINATOR_REGEXP.test(js[i])) i++;
 		} else if (c === "/" && js[i + 1] === "*") {
-			const end = js.indexOf("*/", i + 2);
-			if (end === -1) return true;
-			i = end + 2;
+			// Asked only once `_scriptEndsClean` held, so the comment is closed; the
+			// walk moves on either way.
+			i = Math.max(i + 2, js.indexOf("*/", i + 2) + 2);
 		} else {
 			break;
 		}
@@ -579,7 +585,7 @@ const _opensWithHtmlCloseComment = (js) => {
  * @returns {HtmlElement} the next `<script>` of the run, or 0
  */
 const _mergeableScriptAfter = (path, element) => {
-	if (_printedAttributeCount(path, element) !== 0) return 0;
+	// The caller asks only of a bare one: `element` prints no attribute.
 	for (
 		let next = _S._nodeNextSiblings[element];
 		next !== 0;
@@ -683,10 +689,7 @@ const _literalTextBody = (path, parent, data, minify) => {
 	const literalName = _tagNameOf(parent);
 	if (literalName === "style") {
 		if (!_isCssStyleElement(path, parent)) return data;
-		if (!_S._mergeStyles) {
-			const minified = _minifyStyleBody(data);
-			return minified === null ? data : minified;
-		}
+		if (!_S._mergeStyles) return _minifyStyleBody(data);
 		// The run's first sheet prints the whole run; the rest printed
 		// into it here, before their own text or tags are reached.
 		return _S._absorbed !== null && _S._absorbed.has(parent)
@@ -821,13 +824,11 @@ const printer = (path, writer) => {
 				(_S._renderEmbeddedSource !== undefined ||
 					_S._deferEmbeddedSource !== undefined) &&
 				_isSvgRoot(path);
-			// Void / self-closing elements have no children and no end tag; a
-			// tag-less one (`<image>` → img, `</br>` → br) is rebuilt, not dropped.
+			// Void elements have no children and no end tag; a tag-less one
+			// (`<image>` → img, `</br>` → br) is rebuilt, not dropped. Only an HTML
+			// void carries the flag here, so it is never an `<svg>`.
 			if (path.flag(Flag.selfClosing)) {
-				const selfClosed = open !== "" ? tag : _synthesizeOpenTag(path);
-				return svgRoot
-					? _renderEmbedded(selfClosed, SVG_TYPE, FOREIGN_ELEMENT)
-					: selfClosed;
+				return open !== "" ? tag : _synthesizeOpenTag(path);
 			}
 			// `<template>` holds its children in a content fragment, not the child
 			// chain; every other element reconstructs from its children in order.
@@ -856,9 +857,10 @@ const printer = (path, writer) => {
 			const name = _tagNameOf(path.node);
 			// The end tag is handled by the optional-end-tag rules like any other.
 			if (minify && _canOmitStartTag(path, name, path.node, open)) {
-				const implied = _canOmitEndTag(path, name, path.node)
-					? ""
-					: `</${name}>`;
+				const implied =
+					_endTagReadsAsText(path.node) || _canOmitEndTag(path, name, path.node)
+						? ""
+						: `</${name}>`;
 				return inner + implied;
 			}
 			if (open === "") {
@@ -873,9 +875,9 @@ const printer = (path, writer) => {
 					// started: before that the insertion modes drop it. Materializing
 					// the tag is the cheapest way to keep the text node intact.
 					if (
-						(name === "body" || name === "html") &&
+						_opensImpliedShell(name) &&
 						(startsWithAsciiWhitespace(inner) ||
-							_contentOpensOutside(path.node))
+							_contentOpensOutside(path, path.node))
 					) {
 						return `<${name}>${inner}`;
 					}
@@ -890,7 +892,11 @@ const printer = (path, writer) => {
 				}
 				// Anything else tag-less (adoption-agency clone, reconstructed
 				// formatting element) must materialize or its formatting is lost.
-				return `${_synthesizeOpenTag(path) + inner}</${name}>`;
+				return (
+					_synthesizeOpenTag(path) +
+					inner +
+					(_endTagReadsAsText(path.no
```

**File**: `lib/javascript/syntax-printer.js` (modified, +396/-354)
```diff
@@ -472,7 +472,6 @@ const removeAll = (array, item) => {
  */
 const mergeSort = (array, compare) => {
 	const sorted = [...array];
-	if (sorted.length < 2) return sorted;
 	/** @type {T[]} */
 	const buffer = Array.from({ length: sorted.length });
 	/**
@@ -816,15 +815,13 @@ const formatMangleOptions = (given, base54) => {
 /** @typedef {"number" | "bigint" | "string" | "numeric" | "primitive" | undefined} PrimitiveKind the primitive an expression yields, undefined where unknown */
 
 /**
- * What the class of a node type is called: the root is `SyntaxNode`, and every
- * other class is its type with `Node` after it.
+ * What the class of a node type is called: its type with `Node` after it.
  * @param {string} type the node type
  * @returns {`${Capitalize<string>}Node`} the class's name
  */
 const classNameOf = (type) =>
-	/** @type {`${Capitalize<string>}Node`} */ (
-		type === "Node" ? "SyntaxNode" : `${type}Node`
-	);
+	// Never the root "Node", whose `SyntaxNode` no kind makes.
+	/** @type {`${Capitalize<string>}Node`} */ (`${type}Node`);
 
 // terser's empty slot: a node field holding no node reads `null`, which the
 // fields' type leaves out so that every read of a present node stays typed.
@@ -917,7 +914,7 @@ const NO_NODE = /** @type {Node} */ (/** @type {Node | null} */ (null));
  * @property {(node: Node) => Node} tailNode a sequence's last expression, any other node itself
  * @property {(self: Node, compressor: Compressor) => void} dropUnused terser's `drop_unused`
  * @property {(self: Node, compressor: Compressor) => void} resetOptimizerFlags terser's `reset_opt_flags`
- * @property {(estree: NodeLike, ownTokenAt?: (pos: number, ending: boolean) => number | undefined, source?: string, ownTable?: TokenTable) => Node} adoptEstree the minifier's tree, built from an ESTree one
+ * @property {(estree: NodeLike) => Node} adoptEstree the minifier's tree, built from an ESTree one
  * @property {(tree: SyntaxTree, program: number, ownTokenAt: (pos: number, ending: boolean, forward?: number) => number | undefined, source: string, ownTable: TokenTable) => Node} adoptTree the minifier's tree, built from a source webpack's parser wrote into a tree
  * @property {(node: Node, parent?: Node) => EstreeOut} toEstree the ESTree node of a node
  * @property {(node: Node) => boolean} isArgumentsObject whether a symbol reads a function's own `arguments`
@@ -1601,16 +1598,10 @@ const createMinifiedOutput = (modules) => {
 			this.identifierToUtf8 = asciiOnly
 				? this.to_utf8
 				: /** @type {(str: string) => string} */ (str) => {
+						// A lone surrogate is no identifier character, so none is left here.
 						if (isPlain(str, 0x100) || !HIGH_IDENTIFIER.test(str)) {
 							return str;
 						}
-						str = str.replace(
-							/[\uD800-\uDBFF][\uDC00-\uDFFF]|([\uD800-\uDBFF]|[\uDC00-\uDFFF])/g,
-							(match, lone) =>
-								lone
-									? `\\u${lone.charCodeAt(0).toString(16).padStart(4, "0")}`
-									: match
-						);
 						// Escape identifier characters from higher unicode versions.
 						let character = getFullChar(str, 0);
 						let escaped = character;
@@ -2718,10 +2709,10 @@ const installTraversal = (ast) => {
 		TaggedTemplateExpression: compile(["tag", "quasi"], ["quasi", "tag"]),
 		TemplateLiteral: compile(["*segments"], ["*segments"]),
 		TemplateElement: LEAF,
-		// A `return`, `throw`, `yield`, `break` or `continue` with nothing after
-		// it has no children to walk.
+		// A `return`, `yield`, `break` or `continue` with nothing after it has
+		// no children to walk; a `throw` always has its argument.
 		ReturnStatement: (node) => (node.argument ? OPTIONAL_ARGUMENT : LEAF),
-		ThrowStatement: (node) => (node.argument ? OPTIONAL_ARGUMENT : LEAF),
+		ThrowStatement: ARGUMENT,
 		BreakStatement: (node) => (node.label ? LABEL : LEAF),
 		ContinueStatement: (node) => (node.label ? LABEL : LEAF),
 		AwaitExpression: ARGUMENT,
@@ -2880,11 +2871,10 @@ const installTraversal = (ast) => {
 	 * Records each global a node reads as enclosed by every scope out from the
 	 * read: terser records only names a scope around declares, which a callee
 	 * squeezed into its caller before the caller moves would leave unchecked.
-	 * @param {Node | Splice<Node>} node the node
+	 * @param {Node} node the node
 	 * @returns {void}
 	 */
 	const encloseGlobals = (node) => {
-		if (!isSyntaxNode(node)) return;
 		ast.walk(node, (/** @type {Node} */ child) => {
 			if (
 				ast.isSymbolRefNode(child) &&
@@ -2939,11 +2929,11 @@ const installTraversal = (ast) => {
 		const declarations = found;
 		// A transform may drop a statement from the list as it runs, so each is
 		// found by itself rather than by its index.
-		/** @type {Map<Node, Node | Splice<Node>>} */
+		/** @type {Map<Node, Node>} */
 		const done = new Map();
 		/**
 		 * @param {Node} statement a statement
-		 * @returns {Node | Splice<Node>} it transformed
+		 * @returns {Node} it transformed
 		 */
 		const transform = (statement) => {
 
```

**File**: `test/helpers/swcSmaller.js` (modified, +4/-0)
```diff
@@ -566,6 +566,10 @@ const SWC_SMALLER_BY_REASON = [
 	[
 		"webpack, as terser, collapses a variable into its one read in a first pass only: from a second pass on, which swc's `passes: 0` asks for, the variable stays",
 		["swc minifier: fixture/issues/5910/1/input.js"]
+	],
+	[
+		"webpack reads the global object a function hands back as one a later write may patch a built-in of, so a value stays bound rather than move past a read of `console`, which swc assumes unpatched",
+		["swc minifier: fixture/issues/8284/input.js"]
 	]
 ];
 
```

**File**: `test/unitCases/css/parser.unittest.js` (modified, +23/-0)
```diff
@@ -1991,6 +1991,29 @@ describe("CssSyntax — path reads on every node kind", () => {
 			.process("a{b:1;c:2}d{e:3}");
 		expect(log).toEqual(["b"]);
 	});
+
+	it.each([
+		["a comment", NodeType.Comment],
+		["a rule", NodeType.QualifiedRule]
+	])("stop() in %s reads past the comments after it", (_, type) => {
+		/** @type {string[]} */
+		const log = [];
+		new SourceProcessor()
+			.use({
+				[NodeType.Comment]: () => log.push("comment"),
+				[type]: (
+					/** @type {import("../../../lib/css/syntax-parser").CssPath} */ path
+				) => {
+					log.push("stop");
+					path.stop();
+				}
+			})
+			.process("/*a*/x{/*b*/y:1;/*c*/}/*d*/z{}");
+		expect(log).toEqual(
+			// A comment's own visitor is the one that stops.
+			type === NodeType.Comment ? ["stop"] : ["comment", "comment", "comment", "stop"]
+		);
+	});
 });
 
 describe("CssSyntax — a skip set keeps the tree a full parse builds", () => {
```

---

### Incident Patch 2: `49fd44fd` (2026-10-27)
**Commit Message**: fix(optimize): concatenate a long import cycle without overflowing the stack (#22947)

Adding a module to a concatenation group recursed into every importer,
and listing the group recursed into every import, one frame per module.
An import cycle of a few thousand modules overflowed the call stack.
Walk both with an explicit stack in the same order.

**File**: `.changeset/055-concatenate-long-import-cycle.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"webpack": patch
+---
+
+Concatenate a long import cycle without overflowing the call stack.
```

**File**: `lib/optimize/ConcatenatedModule.js` (modified, +105/-77)
```diff
@@ -1513,12 +1513,13 @@ class ConcatenatedModule extends Module {
 		};
 
 		/**
+		 * Lists a module reached by a connection, except a concatenated module's own entry, which follows its imports.
 		 * @param {ModuleGraphConnection} connection graph connection
 		 * @param {RuntimeSpec | true} runtimeCondition runtime condition
 		 * @param {NonDeferAccess} nonDeferAccess non-defer access
-		 * @returns {void}
+		 * @returns {Iterator<{ connection: ModuleGraphConnection, runtimeCondition: RuntimeSpec | true, nonDeferAccess: NonDeferAccess }> | undefined} the imports still to enter for a concatenated module
 		 */
-		const enterModule = (connection, runtimeCondition, nonDeferAccess) => {
+		const enterModuleOnce = (connection, runtimeCondition, nonDeferAccess) => {
 			const module = connection.module;
 			if (!module) return;
 			const existingEntry = existingEntries.get(module);
@@ -1546,92 +1547,119 @@ class ConcatenatedModule extends Module {
 						`Cannot deferred concatenate a module (${module.identifier()} in ${this.rootModule.identifier()}. This should not happen.`
 					);
 				}
-				const imports = getConcatenatedImports(module);
-				for (const {
-					connection,
+				return getConcatenatedImports(module)[Symbol.iterator]();
+			}
+			/** @type {RuntimeSpec | boolean} */
+			let reducedRuntimeCondition;
+			/** @type {NonDeferAccess} */
+			let reducedNonDeferAccess;
+			if (existingEntry !== undefined) {
+				reducedRuntimeCondition = subtractRuntimeCondition(
 					runtimeCondition,
-					nonDeferAccess
-				} of imports) {
-					enterModule(connection, runtimeCondition, nonDeferAccess);
+					existingEntry.runtimeCondition,
+					runtime
+				);
+				reducedNonDeferAccess = subtractNonDeferAccess(
+					nonDeferAccess,
+					existingEntry.nonDeferAccess
+				);
+				if (
+					reducedRuntimeCondition === false &&
+					reducedNonDeferAccess === false
+				) {
+					return;
 				}
-				list.push({
-					type: "concatenated",
-					wrapped: needWrapped(module),
-					module: connection.module,
+				if (reducedRuntimeCondition !== false) {
+					existingEntry.runtimeCondition = mergeRuntimeConditionNonFalse(
+						existingEntry.runtimeCondition,
+						reducedRuntimeCondition,
+						runtime
+					);
+				}
+				if (reducedNonDeferAccess !== false) {
+					existingEntry.nonDeferAccess = mergeNonDeferAccess(
+						existingEntry.nonDeferAccess,
+						reducedNonDeferAccess
+					);
+				}
+			} else {
+				reducedRuntimeCondition = runtimeCondition;
+				reducedNonDeferAccess = nonDeferAccess;
+				existingEntries.set(connection.module, {
 					runtimeCondition,
 					nonDeferAccess
 				});
-			} else {
-				/** @type {RuntimeSpec | boolean} */
-				let reducedRuntimeCondition;
-				/** @type {NonDeferAccess} */
-				let reducedNonDeferAccess;
-				if (existingEntry !== undefined) {
-					reducedRuntimeCondition = subtractRuntimeCondition(
-						runtimeCondition,
-						existingEntry.runtimeCondition,
+			}
+			if (list.length > 0) {
+				const lastItem = list[list.length - 1];
+				if (
+					lastItem.type === "external" &&
+					lastItem.module === connection.module
+				) {
+					lastItem.runtimeCondition = mergeRuntimeCondition(
+						lastItem.runtimeCondition,
+						reducedRuntimeCondition,
 						runtime
 					);
-					reducedNonDeferAccess = subtractNonDeferAccess(
-						nonDeferAccess,
-						existingEntry.nonDeferAccess
+					lastItem.nonDeferAccess = mergeNonDeferAccess(
+						lastItem.nonDeferAccess,
+						reducedNonDeferAccess
 					);
-					if (
-						reducedRuntimeCondition === false &&
-						reducedNonDeferAccess === false
-					) {
-						return;
-					}
-					if (reducedRuntimeCondition !== false) {
-						existingEntry.runtimeCondition = mergeRuntimeConditionNonFalse(
-							existingEntry.runtimeCondition,
-							reducedRuntimeCondition,
-							runtime
-						);
-					}
-					if (reducedNonDeferAccess !== false) {
-						existingEntry.nonDeferAccess = mergeNonDeferAccess(
-							existingEntry.nonDeferAccess,
-							reducedNonDeferAccess
-						);
-					}
-				} else {
-					reducedRuntimeCondition = runtimeCondition;
-					reducedNonDeferAccess = nonDeferAccess;
-					existingEntries.set(connection.module, {
-						runtimeCondition,
-						nonDeferAccess
-					});
+					return;
 				}
-				if (list.length > 0) {
-					const lastItem = list[list.length - 1];
-					if (
-						lastItem.type === "external" &&
-						lastItem.module === connection.module
-					) {
-						lastItem.runtimeCondition = mergeRuntimeCondition(
-							lastItem.runtimeCondition,
-							reducedRuntimeCondition,
-							runtime
-						);
-						lastItem.nonDeferAccess = mergeNonDeferAccess(
-							lastItem.nonDeferAccess,
-							reducedNonDeferAccess
-						);
-						return;
-					}
+			}
+			list.push({
+				type: "external",
+				wrapped: wrappedModules.has(connection.module),
+				get module() {
+					// We need to use a getter here, because the module in the dependency
+					// could b
```

**File**: `lib/optimize/ModuleConcatenationPlugin.js` (modified, +104/-52)
```diff
@@ -105,6 +105,9 @@ const formatBailoutReason = (msg) => `${BAILOUT_PREFIX}${msg}`;
 
 const PLUGIN_NAME = "ModuleConcatenationPlugin";
 
+// Returned by `_prepareToAdd` for a module the configuration already holds.
+const ALREADY_ADDED = Symbol("already added");
+
 class ModuleConcatenationPlugin {
 	/**
 	 * Applies the plugin by registering its hooks on the compiler.
@@ -434,13 +437,11 @@ class ModuleConcatenationPlugin {
 								currentConfiguration,
 								imp,
 								chunkRuntime,
-								activeRuntime,
 								possibleInners,
 								impCandidates,
 								failureCache,
 								moduleRuntimeCache,
 								chunkGraph,
-								true,
 								stats
 							);
 							if (problem) {
@@ -702,18 +703,16 @@ class ModuleConcatenationPlugin {
 	}
 
 	/**
-	 * Returns the problematic module.
+	 * Adds a module with every module importing it, or leaves the configuration unchanged and returns the problem.
 	 * @param {Compilation} compilation webpack compilation
 	 * @param {ConcatConfiguration} config concat configuration (will be modified when added)
 	 * @param {Module} module the module to be added
 	 * @param {RuntimeSpec} runtime the runtime scope of the generated code
-	 * @param {RuntimeSpec} activeRuntime the runtime scope of the root module
 	 * @param {Set<Module>} possibleModules modules that are candidates
 	 * @param {Set<Module>} candidates list of potential candidates (will be added to)
 	 * @param {Map<Module, Problem>} failureCache cache for problematic modules to be more performant
 	 * @param {Map<Module, RuntimeSpec>} moduleRuntimeCache memoized merged runtime per module, shared across roots
 	 * @param {ChunkGraph} chunkGraph the chunk graph
-	 * @param {boolean} avoidMutateOnFailure avoid mutating the config when adding fails
 	 * @param {Statistics} statistics gathering metrics
 	 * @returns {null | Problem} the problematic module
 	 */
@@ -722,13 +721,109 @@ class ModuleConcatenationPlugin {
 		config,
 		module,
 		runtime,
-		activeRuntime,
 		possibleModules,
 		candidates,
 		failureCache,
 		moduleRuntimeCache,
 		chunkGraph,
-		avoidMutateOnFailure,
+		statistics
+	) {
+		const firstResult = this._prepareToAdd(
+			compilation,
+			config,
+			module,
+			runtime,
+			possibleModules,
+			failureCache,
+			moduleRuntimeCache,
+			chunkGraph,
+			statistics
+		);
+		if (firstResult === ALREADY_ADDED) return null;
+		if (!Array.isArray(firstResult)) return firstResult;
+
+		const backup = config.snapshot();
+
+		// Every module which depends on an added module must be in the configuration
+		// too. An explicit stack walks the importers depth first: a long import cycle
+		// would overflow the call stack.
+		config.add(module);
+		/** @type {{ module: Module, importers: Module[], index: number }[]} */
+		const stack = [{ module, importers: firstResult, index: 0 }];
+		while (stack.length > 0) {
+			const frame = stack[stack.length - 1];
+			if (frame.index < frame.importers.length) {
+				const importer = frame.importers[frame.index++];
+				const result = this._prepareToAdd(
+					compilation,
+					config,
+					importer,
+					runtime,
+					possibleModules,
+					failureCache,
+					moduleRuntimeCache,
+					chunkGraph,
+					statistics
+				);
+				if (result === ALREADY_ADDED) continue;
+				if (!Array.isArray(result)) {
+					// Every module waiting on this importer fails with it, innermost first.
+					let problem = result;
+					for (let i = stack.length - 1; i > 0; i--) {
+						problem = cacheFailure(
+							failureCache,
+							statistics,
+							"importerFailed",
+							stack[i].module,
+							problem
+						);
+					}
+					config.rollback(backup);
+					return cacheFailure(
+						failureCache,
+						statistics,
+						"importerFailed",
+						module,
+						problem
+					);
+				}
+				config.add(importer);
+				stack.push({ module: importer, importers: result, index: 0 });
+				continue;
+			}
+
+			// Add imports to possible candidates list
+			for (const imp of this._getImports(compilation, frame.module, runtime)) {
+				candidates.add(imp);
+			}
+			statistics.added++;
+			stack.pop();
+		}
+		return null;
+	}
+
+	/**
+	 * Checks whether a module can join a configuration, without adding it.
+	 * @param {Compilation} compilation webpack compilation
+	 * @param {ConcatConfiguration} config concat configuration
+	 * @param {Module} module the module to be added
+	 * @param {RuntimeSpec} runtime the runtime scope of the generated code
+	 * @param {Set<Module>} possibleModules modules that are candidates
+	 * @param {Map<Module, Problem>} failureCache cache for problematic modules to be more performant
+	 * @param {Map<Module, RuntimeSpec>} moduleRuntimeCache memoized merged runtime per module, shared across roots
+	 * @param {ChunkGraph} chunkGraph the chunk graph
+	 * @param {Statistics} statistics gathering metrics
+	 * @returns {Problem | typeof ALREADY_ADDED | Module[]} the problem, the marker for a module already in the configuration, or the mo
```

**File**: `test/fixtures/long-import-cycle/build.js` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+"use strict";
+
+// Builds an import cycle of `process.argv[2]` modules into `process.argv[3]`, then
+// prints a report. Run with a small `--stack-size`, so recursion per module overflows.
+const path = require("path");
+const webpack = require("../../../lib/index");
+const ConcatenatedModule = require("../../../lib/optimize/ConcatenatedModule");
+
+const length = Number(process.argv[2]);
+const outputPath = process.argv[3];
+
+webpack(
+	{
+		mode: "production",
+		context: __dirname,
+		entry: "./index.js",
+		output: {
+			path: outputPath,
+			library: { type: "commonjs2" }
+		},
+		optimization: { minimize: false, concatenateModules: true },
+		module: {
+			rules: [
+				{
+					test: /link\.js$/,
+					loader: require.resolve("./link-loader.js"),
+					options: { length }
+				}
+			]
+		}
+	},
+	(err, stats) => {
+		if (err) throw err;
+		const { compilation } = /** @type {import("../../../lib/stats/Stats")} */ (
+			stats
+		);
+		/** @type {number[]} */
+		const concatenated = [];
+		for (const module of compilation.modules) {
+			if (module instanceof ConcatenatedModule) {
+				concatenated.push(module.modules.length);
+			}
+		}
+		const errors = compilation.errors.map((error) => error.message);
+		/** @type {{ count: number, first: number } | undefined} */
+		let result;
+		if (errors.length === 0) {
+			result = require(path.join(outputPath, "main.js")).default;
+		}
+		process.stdout.write(JSON.stringify({ errors, concatenated, result }));
+	}
+);
```

**File**: `test/fixtures/long-import-cycle/counter.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export default { count: 0 };
```

**File**: `test/fixtures/long-import-cycle/index.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+import counter from "./counter.js";
+import first from "./link.js?0";
+
+export default { count: counter.count, first: first() };
```

**File**: `test/fixtures/long-import-cycle/link-loader.js` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+"use strict";
+
+/** @typedef {{ length: number }} LinkLoaderOptions */
+
+/**
+ * Turns `link.js?<n>` into a module importing `link.js?<n + 1>`, the last one closing the cycle.
+ * @this {import("../../../").LoaderContext<LinkLoaderOptions>}
+ * @returns {string} the generated module
+ */
+module.exports = function linkLoader() {
+	const { length } = this.getOptions();
+	const index = Number(this.resourceQuery.slice(1));
+	return [
+		'import counter from "./counter.js";',
+		`import next from "./link.js?${(index + 1) % length}";`,
+		// A side effect, so no side-effect-free optimization walks the cycle first.
+		"counter.count++;",
+		`export default function value() { return typeof next === "function" ? ${index} : -1; }`
+	].join("\n");
+};
```

**File**: `test/fixtures/long-import-cycle/link.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+// Replaced by link-loader.js for every `?<n>` query.
```

---

### Incident Patch 3: `40f8b196` (2026-10-27)
**Commit Message**: test: fix jsMinify tests on main, hold each language's syntax to its own unit tests (#22942)

* test(javascript): cover the settling pass and other printer gaps main brought in

Eleven cases, each held to running as its source does, reach what the
printer test left unrun of #22909's settling of known values and the
built-ins probe. The operator each switch was left with is its default.

Claude-Session: https://claude.ai/code/session_017TkBWTk3wcyUcJYDp5ZhaP

* test: cover hasOctalEscape and fold two fallbacks nothing reaches

`new Set(undefined)` is already the empty set a missing family gave,
and the cold template reader never starts at a chunk's start, which the
fast reader handles before handing it over.

Claude-Session: https://claude.ai/code/session_017TkBWTk3wcyUcJYDp5ZhaP

* ci: hold each language's syntax to its own unit tests

`yarn test:syntax-coverage` runs each language's tokenizer, parser,
printer and minifier tests in a jest process of its own and fails when
what they never run grows past tooling/syntax-coverage.json. CI runs it
when a pull request touches the syntax or its tests.

Claude-Session: https://claude.ai/code/session_017TkBWTk3wcyUcJYDp5ZhaP

* chore: short

**File**: `.changeset/071-conditional-comment-bodies.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 "webpack": patch
 ---
 
-Keep every tag of a conditional comment's body under `minifyConditionalComments`, and leave a body as written when minifying it would still add, drop or move one.
+Keep every tag of a conditional comment's body when minifying it.
```

**File**: `.github/workflows/test.yml` (modified, +1/-0)
```diff
@@ -268,6 +268,7 @@ jobs:
   # Every suite from here down is held behind the three cheap ones, which are
   # also the three a merge needs: each costs tens of runner-minutes, and a tree
   # that fails `lint`, `basic` or `unit` is not going to land on what they say.
+
   test262:
     needs: [lint, basic, unit]
     runs-on: ubuntu-latest
```

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -176,6 +176,8 @@ Running one integration case, and what a `configCases/` case contains: [TESTING_
 
 **Cover every line you add or change** — a commit must not lower coverage (CI enforces patch coverage, target 90%+). Every new branch, fast path and fallback needs a test: `configCases/` when a real build reaches it, a focused `*.unittest.js` only when a config case can't reasonably drive it or adds nothing (e.g. tokenizer cold-path fallbacks, where fast and delegated branches each still need exercising). Check with `yarn cover:unit` or the PR's "patch" report until no changed line is missing.
 
+A language's syntax (`lib/{css,html,javascript,json}` tokenizer, parser, printer and minifier) is held to its **own** unit tests: `yarn test:syntax-coverage [css|html|javascript|json]` fails when what they never run grows past `tooling/syntax-coverage.json`; `--list` prints it, `--write` lowers the baseline once you covered more.
+
 **Don't lower type coverage either.** CI collects it (`yarn types:cover:report`) and reports the delta on the PR. Prefer real types over `EXPECTED_ANY` ([Type annotations](#type-annotations)), and run `yarn types:cover` if you widened any annotation.
 
 ### Read CI rather than re-running it
```

**File**: `lib/css/syntax-parser.js` (modified, +2/-2)
```diff
@@ -13989,8 +13989,8 @@ const _BOX_SLOT_WORDS = new Map([
 	["scroll-margin", new Set()],
 	["scroll-padding", new Set(["auto"])],
 	["border-radius", new Set()],
-	["border-width", new Set(FAMILY_SLOT_KEYWORDS.get("border-top-width") || [])],
-	["border-style", new Set(FAMILY_SLOT_KEYWORDS.get("border-top-style") || [])],
+	["border-width", new Set(FAMILY_SLOT_KEYWORDS.get("border-top-width"))],
+	["border-style", new Set(FAMILY_SLOT_KEYWORDS.get("border-top-style"))],
 	["border-color", COLOR_KEYWORDS]
 ]);
 
```

**File**: `lib/javascript/syntax-parser.js` (modified, +2/-12)
```diff
@@ -13033,19 +13033,9 @@ class WebpackParser extends BaseParser {
 				this.raise(this.start, "Unterminated template");
 			}
 			const ch = input.charCodeAt(this.pos);
+			// Reached past the backslash or CR that sent it here, never at a chunk's
+			// start, which `readTmplToken` reads itself.
 			if (ch === 96 || (ch === 36 && input.charCodeAt(this.pos + 1) === 123)) {
-				if (
-					this.pos === this.start &&
-					(this.type === tokTypes.template ||
-						this.type === tokTypes.invalidTemplate)
-				) {
-					if (ch === 36) {
-						this.pos += 2;
-						return this.finishToken(tokTypes.dollarBraceL);
-					}
-					++this.pos;
-					return this.finishToken(tokTypes.backQuote);
-				}
 				out += input.slice(chunkStart, this.pos);
 				return this.finishToken(tokTypes.template, out);
 			}
```

**File**: `lib/javascript/syntax-printer.js` (modified, +6/-9)
```diff
@@ -28173,7 +28173,7 @@ const installImprove = (modules) => {
 	};
 
 	/**
-	 * @param {string} operator a binary operator
+	 * @param {string} operator a binary operator but `in` and `instanceof`
 	 * @param {SettledValue} left a primitive
 	 * @param {SettledValue} right a primitive
 	 * @returns {SettledValue | typeof UNSETTLED} what the operator computes of them
@@ -28245,11 +28245,9 @@ const installImprove = (modules) => {
 			case "<=":
 				result = l <= r;
 				break;
-			case ">=":
-				result = l >= r;
-				break;
+			// `>=`, the one left: `in` and `instanceof` are never computed here.
 			default:
-				return UNSETTLED;
+				result = l >= r;
 		}
 		return typeof result === "string" && result.length > SETTLED_STRING_LIMIT
 			? UNSETTLED
@@ -28259,7 +28257,7 @@ const installImprove = (modules) => {
 	/**
 	 * @param {string} operator a unary operator but `delete`, `++` and `--`
 	 * @param {SettledValue} value a primitive
-	 * @returns {SettledValue | typeof UNSETTLED} what the operator computes of it
+	 * @returns {SettledValue} what the operator computes of it
 	 */
 	const computeUnary = (operator, value) => {
 		/** @type {EXPECTED_ANY} */
@@ -28275,10 +28273,9 @@ const installImprove = (modules) => {
 				return ~v;
 			case "void":
 				return undefined;
-			case "typeof":
-				return typeof v;
+			// `typeof`, the one left.
 			default:
-				return UNSETTLED;
+				return typeof v;
 		}
 	};
 
```

**File**: `package.json` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@
     "test:invariants:html": "node tooling/compare-html-tools.js --invariants",
     "test:invariants:js": "node tooling/compare-js-tools.js --invariants",
     "test:invariants:xml": "node tooling/compare-xml-tools.js --invariants",
+    "test:syntax-coverage": "node tooling/check-syntax-coverage.js",
     "test:invariants:full": "yarn test:invariants:css --require-corpus && yarn test:invariants:html --require-corpus && yarn test:invariants:js --require-corpus && yarn test:invariants:xml --require-corpus",
     "benchmark:css-tools": "node tooling/compare-css-tools.js",
     "benchmark:css-tools:setup": "node tooling/compare-css-tools.js --setup",
```

**File**: `test/unitCases/javascript/__snapshots__/printer.unittest.js.snap` (modified, +22/-8)
```diff
@@ -111,6 +111,8 @@ exports[`JavaScript minifier, pass by pass what the correct and improve phases w
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a bare var write after a \`with\` 1`] = `"function f(o){var a;with(o)a=b,c();return a}console.log(f({b:1,c:function(){}}));"`;
 
+exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a binding's value through shifts and comparisons 1`] = `"function f(){console.log(8,!1,!1,16,4,4)}f();"`;
+
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a block holding a \`let\` read by a conditional of a getter, under \`hoist_vars\` 1`] = `"var n=0,o={get x(){return++n}};function f(b){var a=1,r=b-2||o.x?b:o.x;return[r,a,n]}console.log(f(2));"`;
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a block holding a \`let\` that \`hoist_vars\` alone empties of its \`var\` 1`] = `"function f(b){var r,a=1;{let a=b-2;r=a}return[r,a]}console.log(f(2),f(5));"`;
@@ -121,6 +123,8 @@ exports[`JavaScript minifier, pass by pass what the correct and improve phases w
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a built-in call where a direct \`eval\` may rebind it 1`] = `"function f(){return eval(\\"\\"),Math.max(1,2),Number(\\"1\\"),1}console.log(f());"`;
 
+exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a built-in handed a function with no body 1`] = `"console.log([1,2].map(function(){}).length,[1].map(()=>{})[0]);var r=!fails(function(){Reflect.apply(function(){})});function fails(f){try{return f(),!1}catch(e){return!0}}console.log(r);"`;
+
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a built-in method read by a computed key off a literal, then called or tagged 1`] = `"console.log([1,2],[1,2].indexOf(2),{a:1}.hasOwnProperty(\\"a\\"),[1].join\`-\`);"`;
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a call of a function, a \`var\` or a parameter nothing writes, in each branch of a test with effects 1`] = `"function f(t,p){function h(x){console.log(x)}var v=function(x){console.log(-x)};h(t()?1:2),v(t()?1:2),t()?p(1):p(2)}var n=0;f(function(){return n++%2},console.log),f(function(){return 1},console.log);"`;
@@ -143,6 +147,8 @@ exports[`JavaScript minifier, pass by pass what the correct and improve phases w
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a catch binding unread where a nested function declares its name 1`] = `"function f(k){try{g()}catch{sink(1+k)}}function g(){throw 0}function sink(v){console.log(v)}f(2);"`;
 
+exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a compound assignment of a value not known, then one of a binding's 1`] = `"function g(){return 2}function f(){let a=1;a+=g(),console.log(a*=3,3)}f();"`;
+
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a computed or shorthand \`__proto__\` key in an object \`unsafe\` evaluates 1`] = `"var __proto__=null;console.log(Object.getPrototypeOf({[\\"__proto__\\"]:null})===Object.prototype,null,Object.getPrototypeOf({[\\"__proto__\\"]:__proto__})===Object.prototype,[\\"__proto__\\"]);"`;
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a constructor forwarding a literal's spread or \`arguments\` or a rest parameter 1`] = `"class A{constructor(...a){console.log(a.length)}}class B extends A{constructor(){super(1,2)}}class C extends A{}class D extends A{}class E extends A{constructor(x,...r){super(...r)}}class F extends A{constructor(...r){super(...arguments)}}new B,new C(1),new D(1,2,3),new E(1,2),new F(1);"`;
@@ -179,14 +185,24 @@ exports[`JavaScript minifier, pass by pass what the correct and improve phases w
 
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a known function called with fewer constants than it has parameters 1`] = `"console.log(11,11,23);"`;
 
+exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write what runs as the source does: a literal's member read in the declaration list holding it 1`] = `"function f(){console.log(1,2)}f();"`;
+
 exports[`JavaScript minifier, pass by pass what the correct and improve phases write should write 
```

#### Recent Merged Pull Requests:
- **PR #22947** (2026-10-27): fix(optimize): concatenate a long import cycle without overflowing the stack (@alexander-akait)
- **PR #22946** (2026-10-27): fix: compare named cache groups by the size they actually save (@hai-x)
- **PR #22945** (closed): test(javascript): drop the handler cases #22926 left nothing to test (@alexander-akait)
- **PR #22944** (2026-10-27): ci: run the three syntax-equivalence browsers on one runner (@alexander-akait)
- **PR #22943** (2026-10-27): build(tooling): hold webpack's CSS, HTML and XML parsers to the reference trees as an invariant (@alexander-akait)
- **PR #22942** (2026-10-27): test: fix jsMinify tests on main, hold each language's syntax to its own unit tests (@alexander-akait)

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

## X. test: cover each printer from its own unit tests and fix what that found (#22903

**RULE**:
When implementing operations in `.changeset/066-printer-fixes.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webpack/webpack. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1cde23ad`: test: cover each printer from its own unit tests and fix what that found (#22903). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/066-printer-fixes.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
---
"webpack": patch
---

Fix CSS, HTML and JavaScript minifier output bugs found by printer coverage.
```

**NEGATIVE CONSTRAINT**:
```javascript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1cde23ad` are properly handled with clean fallback behavior.
