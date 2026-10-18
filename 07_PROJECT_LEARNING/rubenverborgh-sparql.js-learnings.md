> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rubenverborgh-sparql.js-learnings.md`  
> **Source**: github ([https://github.com/RubenVerborgh/SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js))  
> **Source Version**: `91cbd01b`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:33:54.963Z  
> **Learning ID**: `learn-github-rubenverborgh-sparql-js`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): RubenVerborgh/SPARQL.js

---

## 1. Executive Forensic Architecture & System Mechanics

```
               +-------------------------------------------------------+
               |                    SPARQL Query String                 |
               +-------------------------------------------------------+
                                          |
                                          v
               +-------------------------------------------------------+
               |        Lexical Analyzer (Jison / Flex Lexer Rules)    |
               |  - Macro expanders: IRIREF, PN_LOCAL, SPACES_COMMENTS |
               |  - Case-insensitive keyword tokenization              |
               |  - Surrogate pair & escape validation                 |
               +-------------------------------------------------------+
                                          |
                                          v
               +-------------------------------------------------------+
               |    Parser Core (lib/sparql.jison - SLR(1) Grammar)    |
               |  - State: Parser.base, Parser.prefixes, Parser.factory|
               |  - Property path recursion (ObjectList vs Path)       |
               |  - Semantic guards: ensureNoVariables, ensureNoBnodes |
               +-------------------------------------------------------+
                                          |
                                          v
               +-------------------------------------------------------+
               |             AST Representation (JSON / RDF/JS)        |
               |  - Query: SELECT, CONSTRUCT, ASK, DESCRIBE            |
               |  - Update: INSERT DATA, DELETE DATA, MODIFY, GraphOps |
               |  - Term Primitives: NamedNode, BlankNode, Literal,    |
               |    Variable, Quad (SPARQL*), Wildcard Singleton       |
               +-------------------------------------------------------+
                                          |
                                          v
               +-------------------------------------------------------+
               |        Generator Core (lib/SparqlGenerator.js)        |
               |  - Triples compression (';', ',' grouping)            |
               |  - Prefix extraction via reverse regex matching       |
               |  - Expression precedence & operator unparsing         |
               +-------------------------------------------------------+
                                          |
                                          v
               +-------------------------------------------------------+
               |             Canonical SPARQL 1.1 / Star Query         |
               +-------------------------------------------------------+
```

### The Exact Technical Problem
SPARQL.js solves bidirectional compilation between raw SPARQL 1.1 / SPARQL* strings and a lossless JSON Abstract Syntax Tree (AST), strictly complying with W3C SPARQL 1.1 Query, SPARQL 1.1 Update, and RDF/JS data model specifications. 

The domain presents four severe technical constraints:
1. **LALR(1)/SLR Grammar Ambiguities**: Natural SPARQL syntax exhibits shift/reduce conflicts around property paths (`/`, `^`, `|`), blank node patterns (`[ :p :o ]`), and multi-word token sequences (`INSERT DATA`, `DELETE WHERE`).
2. **Grammar-Level Semantic Restrictions**: SPARQL specifications prohibit certain syntactically valid constructs depending on the clause context (e.g., variables in `DELETE DATA`, blank nodes in `DELETE`, reused blank node identifiers across distinct `INSERT DATA` clauses, and ungrouped variable projection).
3. **Lexer Inability to Retain Re-entrant State in Jison**: Jison (JavaScript parser generator) historically binds lexer and parser actions to global/module scope without thread/instance isolation, risking state pollution across parse calls.
4. **Canonical Round-Trip Fidelity**: Stringifying AST back to SPARQL requires condensing subject-predicate triples into semicolon/comma shorthand lists, tracking used prefixes dynamically, and escaping terms without losing RDF/JS term conformance.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Re-entrant State Isolation for Module-Scoped Parser Generators
**RULE**:
When wrapping parsers generated by tools that use static or module-level variables for execution state (such as Jison, Bison, or PEG.js), the parser wrapper MUST fully reset, initialize, and teardown execution context inside a `try...finally` block. It MUST NOT rely on end-of-parse grammar production actions to clear static parser state.

**WHY**:
If a parser throws a syntax error midway through evaluating tokens, the terminal reduction production (`QueryOrUpdate : Prologue ( Query | Update? ) EOF`) is never reached. Any state assigned to static or closure-level variables during parsing (e.g., `Parser.base`, `Parser.prefixes`, local regex caches) remains allocated. Subsequent executions on the same worker or thread inherit corrupt, stale state from failed parses (e.g., resolving relative IRIs using the prior failed query’s Base IRI).

**WHEN TO APPLY**:
Apply to any compiler, parser, transpiler, or tokenizer in JavaScript/TypeScript where parser generator tools generate static class properties or module-scoped state variables.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Canonical wrapper pattern resolving Jison Issue #241 and state-bleed
function createParser(options = {}) {
  const parserInstance = new GeneratedParser();
  
  // Clone prefixes immutably using prototypal inheritance or Object.freeze
  const basePrefixes = Object.assign(Object.create(null), options.prefixes);
  const configuredBaseIRI = options.baseIRI || '';
  const dataFactory = options.factory || new DataFactory();

  return {
    parse(inputQuery) {
      // 1. Pre-execution initialization
      GeneratedParser.base = configuredBaseIRI;
      GeneratedParser.prefixes = Object.create(basePrefixes);
      GeneratedParser.factory = dataFactory;
      GeneratedParser.errorState = null;

      try {
        // 2. Execute parse within isolated activation frame
        const ast = GeneratedParser.prototype.parse.call(parserInstance, inputQuery);
        return ast;
      } finally {
        // 3. Mandatory teardown invariant: Guarantees no state leakage even on thrown errors
        GeneratedParser.base = '';
        GeneratedParser.prefixes = null;
        GeneratedParser.factory = null;
        if (typeof GeneratedParser._resetBlanks === 'function') {
          GeneratedParser._resetBlanks();
        }
      }
    }
  };
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: State teardown deferred to final grammatical production
// If parsing throws at line 3, EOF action never executes.
parser.parse = function (query) {
  Parser.base = this.baseIRI;
  return Parser.prototype.parse.call(this, query);
};

// Grammar file (lib/sparql.jison):
// QueryOrUpdate: Prologue Query EOF {
//   Parser.base = ''; // Fails to execute on syntax error!
// }
```

**VERIFICATION METHOD**:
Execute an automated sequence where a malformed parse containing a malicious or altered `BASE` directive is intentionally failed, immediately followed by parsing a query with a relative URI:
```javascript
it('MUST NOT retain base IRI state from an aborted prior parse', () => {
  const parser1 = new SparqlParser({ baseIRI: 'http://example.org/valid/' });
  expect(() => parser1.parse('SELECT * WHERE { <> invalid syntax')).toThrow();

  const parser2 = new SparqlParser({ baseIRI: 'http://example.org/isolated/' });
  const result = parser2.parse('SELECT * WHERE { <> ?p ?o }');
  expect(result.where[0].triples[0].subject.value).toBe('http://example.org/isolated/');
});
```

---

### 2. RDF/JS Data Model Compliance for Higher-Order Graph Structures
**RULE**:
All nested triple, quad, and quoted triple instances generated in AST trees MUST be instantiated via an `@rdfjs/types` conformant `DataFactory` implementation. Custom or ad-hoc JSON literals representing RDF Quads/Triples MUST NOT omit mandatory interface properties, specifically the `graph` term (which defaults to `DefaultGraph`).

**WHY**:
The RDF/JS specification stipulates that a `Quad` consists of `subject`, `predicate`, `object`, and `graph`. In SPARQL* (RDF-star), quoted triples embedded inside subject or object positions are formally Quads. Creating raw objects like `{ termType: "Quad", subject, predicate, object }` breaks all downstream consumers (such as Comunica, RDF-Store, or Serializers) that execute property reads on `quad.graph.termType`, producing `TypeError: Cannot read properties of undefined (reading 'termType')`.

**WHEN TO APPLY**:
Any AST transformation, grammar action, or intermediate representation layer parsing or manipulating RDF-star quoted triples or quad-based datatypes.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Production-grade quad construction in grammar semantic action
function createQuotedTriple(subject, predicate, object, factory) {
  if (predicate.type === 'path') {
    throw new Error('Nested triples cannot contain paths');
  }

  // Canonical RDF/JS Factory Quad instantiation:
  // Automatically provisions a DefaultGraph (or named graph) node
  return factory.quad(
    subject,
    predicate,
    object,
    factory.defaultGraph()
  );
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Ad-hoc pseudo-Quad object construction omitting the graph invariant
function createQuotedTriple(subject, predicate, object) {
  return {
    termType: "Quad",
    subject: subject,
    predicate: predicate,
    object: object
    // BUG: Missing `graph: { termType: "DefaultGraph", value: "" }`
  };
}
```

**VERIFICATION METHOD**:
Assert deep property completeness of all nodes within parsed nested quad ASTs using strict structural validation:
```javascript
it('MUST produce a compliant Quad with a non-null DefaultGraph term', () => {
  const parsed = parser.parse('SELECT * WHERE { << ?s ?p ?o >> ?p2 ?o2 }');
  const embeddedQuad = parsed.where[0].triples[0].subject;
  expect(embeddedQuad.termType).toBe('Quad');
  expect(embeddedQuad.graph).toBeDefined();
  expect(embeddedQuad.graph.termType).toBe('DefaultGraph');
  expect(embeddedQuad.graph.value).toBe('');
});
```

---

### 3. Comment-Tolerant Lexical Compound Tokenization Invariant
**RULE**:
When a formal language lexer combines multiple reserved words into a single semantic token (e.g., `INSERT DATA`, `DELETE WHERE`) across whitespace, the separator regex MUST mandate terminal newline characters (`\n` or `\r\n`) after single-line comment sequences (`# comment\n`). Comment sequences MUST NOT match greedily into subsequent code tokens without enforcing newline demarcation.

**WHY**:
If the whitespace macro is written as `(\s+|{COMMENT})+`, where `{COMMENT}` is `#[^\n\r]*`, the lexer can accept `INSERT # DATA\nDATA` as valid, but if `{COMMENT}` does not strictly enforce that the single line comment ends before the next matching token, it creates ambiguity where `# DATA` is either consumed as a comment or merged as part of an `INSERT DATA` macro, triggering catastrophic parse mismatches or bypassing token recognition.

**WHEN TO APPLY**:
Lexers written in Flex, Jison, ANTLR, or RegExp-based scanners parsing languages that permit single-line comments interleaved within multi-word keyword phrases.

**VERIFIED IMPLEMENTATION PATTERN**:
```lex
COMMENT               "#"[^\n\r]*
/* Enforce that any comment inside multi-word tokens is followed by an explicit newline */
SPACES_COMMENTS       (\s+|{COMMENT}\n\r?)+

%%

\s+|{COMMENT}                          /* Ignore top-level whitespace and comments */
"INSERT"{SPACES_COMMENTS}"DATA"        return 'INSERTDATA';
"DELETE"{SPACES_COMMENTS}"DATA"        return 'DELETEDATA';
"DELETE"{SPACES_COMMENTS}"WHERE"       return 'DELETEWHERE';
```

**NEGATIVE CONSTRAINT**:
```lex
/* ANTI-PATTERN: Allows comments to swallow subsequent lines or fail when 
   comments lack newlines before subsequent tokens */
COMMENT               "#"[^\n\r]*
SPACES_COMMENTS       (\s+|{COMMENT})+

%%
"INSERT"{SPACES_COMMENTS}"DATA"        return 'INSERTDATA';
```

**VERIFICATION METHOD**:
Provide test cases mixing comments and keyword tokens across multiple line-breaks:
```javascript
it('MUST distinguish comments containing keywords from actual tokens', () => {
  // Case A: Valid - Comment precedes actual keyword on new line
  const queryValid = `INSERT # DATA
  DATA { <ex:s> <ex:p> <ex:o> }`;
  expect(() => parser.parse(queryValid)).not.toThrow();

  // Case B: Invalid - DATA is commented out entirely
  const queryInvalid = `INSERT # DATA { <ex:s> <ex:p> <ex:o> }`;
  expect(() => parser.parse(queryInvalid)).toThrow(/Parse error/);
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Static Parser State Bleed Across Parsing Failures (BUG-SPARQL-01)
- **Context**: `lib/sparql.jison`, Base URI resolution logic (`resolveIRI`).
- **What Was Expected**: If parsing a query fails due to a syntax error, subsequent queries parsed by fresh `SparqlParser` instances must use their own configured `baseIRI`, or throw an error if no `baseIRI` is provided.
- **What Actually Happened**: When a query failed mid-parse, the module-level variable `base` retained the value from the previous query. The condition `if (!base)` in `resolveIRI` prevented updating `base` to `Parser.base` in future parses, causing relative IRIs in subsequent valid queries to resolve against the previous, unrelated base IRI.
- **Evidence in Repo**: Commit `d0f54f84`, PR #132, Issue #130.
- **Root Cause**: `base` was declared in the parser closure. The code executed:
  ```javascript
  if (!base) {
    base = Parser.base;
    basePath = base.replace(/[^\/:]*$/, '');
    baseRoot = base.match(/^(?:[a-z]+:\/*)?[^\/]*/)[0];
  }
  ```
  Because `base` was not cleared during abnormal parse termination, `if (!base)` evaluated to `false`, retaining stale resolution paths.
- **Remediation Code Diff**:
```diff
@@ -61,7 +61,7 @@
      return iri;
    if (!Parser.base)
      throw new Error('Cannot resolve relative IRI ' + iri + ' because no base IRI was set.');
-   if (!base) {
+   if (base !== Parser.base) {
      base = Parser.base;
      basePath = base.replace(/[^\/:]*$/, '');
      baseRoot = base.match(/^(?:[a-z]+:\/*)?[^\/]*/)[0];
@@ -536,7 +536,7 @@ QueryOrUpdate
      $2 = $2 || {};
      if (Parser.base)
        $2.base = Parser.base;
-     Parser.base = base = basePath = baseRoot = '';
+     Parser.base = '';
      $2.prefixes = Parser.prefixes;
      Parser.prefixes = null;
      return $2;
```
- **Lesson**: Do not use truthiness checks (`if (!base)`) to detect cache invalidation against global parameters. Always check for strict equality against the incoming configuration context (`if (base !== currentTarget)`).

---

### Incident 2: AST Structural Corruption in SPARQL-star Quoted Triples (BUG-SPARQL-02)
- **Context**: `lib/sparql.jison`, rule `VarTriple` handling nested `<< ?s ?p ?o >>` syntax.
- **What Was Expected**: Nested quoted triples in SPARQL-star must conform to the RDF/JS Quad interface, including a defined `graph` property representing the Default Graph.
- **What Actually Happened**: The grammar action instantiated an ad-hoc object missing the `graph` property. When consumers used `@rdfjs/types` or standard graph traversers, accessing `triple.graph.termType` caused runtime `null/undefined` crashes.
- **Evidence in Repo**: Commit `84095ad6`, PR #170, Commits `e69aed3c`.
- **Root Cause**: Hardcoded object initialization bypassed the configured `Parser.factory.quad(...)` pipeline:
  ```javascript
  return {
    termType: "Quad",
    subject,
    predicate,
    object
  }
  ```
- **Remediation Code Diff**:
```diff
@@ -161,12 +161,7 @@
      throw new Error('Nested triples cannot contain paths');
    }

-   return {
-     termType: "Quad",
-     subject,
-     predicate,
-     object
-   }
+   return Parser.factory.quad(subject, predicate, object);
  }
```
- **Lesson**: Never assemble domain AST nodes via raw object literals when an established abstract factory interface (`Parser.factory`) is already standard in the subsystem.

---

### Incident 3: Premature Rule Return in Grammar Semantic Action (BUG-SPARQL-03)
- **Context**: `lib/sparql.jison`, rule `SelectQuery`.
- **What Was Expected**: When the parser option `skipUngroupedVariableCheck` is set to `true`, semantic validation should be skipped, but the production MUST return the parsed `SelectQuery` AST node (`$1`, `$2`, etc.).
- **What Actually Happened**: The developer wrote `if (Parser.skipUngroupedVariableCheck) return;`. In Jison, returning `undefined` from a rule action results in the parent expression receiving `undefined` or dropping the subtree, breaking query parsing.
- **Evidence in Repo**: Commit `ba156dbb`, Issue #120.
- **Root Cause**: Confusion between exiting a validation function vs. exiting an LR grammar reduction semantic block. In Jison, the return value of the action block assigns the value to `$$`. Executing an early `return;` sets `$$ = undefined`.
- **Remediation Code Diff**:
```diff
@@ -642,20 +642,21 @@ SelectQuery
    | SelectClauseVars DatasetClause* WhereClause SolutionModifier
    {
      // Check for projection of ungrouped variable
-     if (Parser.skipUngroupedVariableCheck) return;
-     const counts = flatten($1.variables.map(vars => getAggregatesOfExpression(vars.expression)))
+     if (!Parser.skipUngroupedVariableCheck) {
+       const counts = flatten($1.variables.map(vars => getAggregatesOfExpression(vars.expression)))
          .some(agg => agg.aggregation === "count" && !(agg.expression instanceof Wildcard));
        if (counts || $4.group) {
          // ... perform validation loop ...
        }
+     }
    }
```
- **Lesson**: Action blocks in grammar compilers are value-producing reduction steps (`$$ = result`), not procedural functions. Early returns discard the production's AST node.

---

### Incident 4: Grammar Ambiguity on Blank Node Property Paths (BUG-SPARQL-04)
- **Context**: `lib/sparql.jison`, productions `PropertyListPathNotEmptyTail` and `ObjectList`.
- **What Was Expected**: Blank node triple patterns containing property paths (such as `[ :p "v" ; ^dbpedia-owl:starring ?movie ]`) must parse successfully in basic graph patterns.
- **What Actually Happened**: The parser threw syntax errors. `PropertyListPathNotEmptyTail` delegated directly to `ObjectList`, which only permitted standard `GraphNode` instances and rejected property path syntax (`Path`).
- **Evidence in Repo**: Commit `852e3f0e`, PR #142, Issue #99.
- **Root Cause**: Asymmetrical grammar rules between subjects and objects. Path-based property lists were permitted in subjects via `TriplesSameSubjectPath`, but the tail of the object list collapsed into a non-path-aware `ObjectList` production.
- **Remediation Code Diff**:
```diff
@@ -931,6 +931,9 @@ Verb
 ObjectList
     : (GraphNode ',')* GraphNode -> appendTo($1, $2)
     ;
+ObjectListPath
+    : (GraphNodePath ',')* GraphNodePath -> appendTo($1, $2)
+    ;
 TriplesSameSubjectPath
     : (VarOrTerm | VarTriple) PropertyListPathNotEmpty -> $2.map(function (t) { return extend(triple($1), t); })
     | TriplesNodePath PropertyListPathNotEmpty? -> !$2 ? $1.triples : appendAllTo($2.map(function (t) { return extend(triple($1.entity), t); }), $1.triples)
@@ -940,7 +943,7 @@ PropertyListPathNotEmpty
     ;
 PropertyListPathNotEmptyTail
     : ';' -> []
-    | ';' ( Path | VAR ) ObjectList -> objectListToTriples(toVar($2), $3)
+    | ';' ( Path | VAR ) ObjectListPath -> objectListToTriples(toVar($2), $3)
     ;
```
- **Lesson**: In grammars distinguishing non-path constructs (e.g., `CONSTRUCT` templates) from path-enabled constructs (e.g., `WHERE` patterns), ensure path variants of non-terminals cascade completely down every branch (`ObjectListPath` -> `GraphNodePath`).

---

### Incident 5: Generator Omission of Source Graph and SILENT Flag in Graph Management Updates (BUG-SPARQL-05)
- **Context**: `lib/SparqlGenerator.js`, method `Generator.prototype.toUpdate`.
- **What Was Expected**: SPARQL 1.1 Update operations `ADD`, `COPY`, and `MOVE` must serialize both source and destination graphs, along with the optional `SILENT` keyword (e.g., `COPY SILENT DEFAULT TO <http://example.org/named>`).
- **What Actually Happened**: The generator emitted `update.type.toUpperCase() + (update.source.default ? ' DEFAULT ' : ' ') + 'TO ' + this.toEntity(update.destination.name)`. When `update.source.default` was false, the source named graph was omitted, producing invalid syntax like `MOVE TO <http://example.com/dest>`.
- **Evidence in Repo**: Commit `2d084c36`, PR #151.
- **Root Cause**: Flawed ternary logic assuming non-default graphs required no specifier, coupled with complete omission of the `update.silent` property check.
- **Remediation Code Diff**:
```diff
@@ -384,8 +384,8 @@ Generator.prototype.toUpdate = function (update) {
    case 'add':
    case 'copy':
    case 'move':
-    return update.type.toUpperCase() + (update.source.default ? ' DEFAULT ' : ' ') +
-           'TO ' + this.toEntity(update.destination.name);
+    return update.type.toUpperCase() + ' ' + (update.silent ? 'SILENT ' : '') + 
+           (update.source.default ? 'DEFAULT' : this.toEntity(update.source.name)) +
+           ' TO ' + this.toEntity(update.destination.name);
    case 'create':
    case 'clear':
    case 'drop':
```
- **Lesson**: Do not use binary ternary flags for multi-state protocol grammar serializations. Model syntax nodes explicitly: `[OP] [SILENT] [SOURCE] TO [DEST]`.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
*   **Exact Regex Protocol Matching (`/^[a-z]+:/i`)**: Absolute IRI detection must use case-insensitive scheme matching (`/^[a-z]+:/i`). Protocols like `HTTP://` or `URI://` are valid RFC 3986 identifiers. Testing strictly with `/^[a-z]+:/` misclassifies uppercase schemes as relative URIs, appending the base URI and corrupting nodes.
*   **RegExp Meta-Character Escaping in Dynamic Prefix Maps**: When compiling prefix matchers into regex patterns, characters `\`, `/`, `(`, `)`, `*`, `+`, `?`, `.`, `$`, `^`, `[`, `]`, `{`, `}` must be escaped using:
    ```javascript
    var iriList = prefixIris.join('|').replace(/[\]\/()*+?.\\$]/g, '\\$&');
    this._prefixRegex = new RegExp('^(' + iriList + ')([a-zA-Z][\\-_a-zA-Z0-9]*)$');
    ```
    Failing to escape these in URI keys allows malicious or malformed URIs to corrupt parser regexes or cause ReDoS vulnerabilities.
*   **Surrogate Pair Codepoint Invariants**: Lexing Unicode escapes in string literals (`\uXXXX` and `\UXXXXXXXX`) requires explicit detection of uncoupled high surrogates (`[\uD800-\uDBFF]`). JavaScript's `String.fromCharCode` will produce invalid UTF-16 code units if a high surrogate lacks an adjoining low surrogate:
    ```javascript
    var partialSurrogatesWithoutEndpoint = /[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/;
    if (partialSurrogatesWithoutEndpoint.exec(string)) {
      throw new Error('Invalid unicode codepoint of surrogate pair without corresponding codepoint in ' + string);
    }
    ```

### 2. Infinite Loop & Recursion Guards
*   **AST Expression Depth and Aggregations**: Recursive AST traversals searching for projected variables must avoid falling into cyclic graph references. Using a `Set` combined with recursive visitor functions ensures termination:
    ```javascript
    function getVariablesFromExpression(expression) {
      const variables = new Set();
      const visitExpression = function (expr) {
        if (!expr) { return; }
        if (expr.termType === "Variable") {
          variables.add(expr);
        } else if (expr.type === "operation") {
