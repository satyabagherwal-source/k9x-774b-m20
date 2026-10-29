> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fabio-rovai-open-ontologies-learnings.md`  
> **Source**: github ([https://github.com/fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies))  
> **Source Version**: `2ecb50c2`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-29T11:01:46.608Z  
> **Learning ID**: `learn-github-fabio-rovai-open-ontologies`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): fabio-rovai/open-ontologies

---

## 1. Executive Forensic Architecture & System Mechanics

`open-ontologies` is a high-assurance, native ontology reasoning engine, CLI, and Model Context Protocol (MCP) server written in Rust. It eliminates reliance on Java Virtual Machine (JVM) stacks (such as Apache Jena or Protégé/HermiT) while delivering formal semantics, Description Logic tableaux reasoning ($\mathcal{SHIQ}$), W3C SHACL validation, SPARQL query engines (backed by Oxigraph), and certified reasoning via verifiable proof certificates emitted to Lean 4 and Isabelle formal checkers.

### Subsystem Boundaries & Invariant Contracts

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │                  Orchestration / UX                    │
                                  │   Tauri Studio Desktop GUI  /  MCP JSON-RPC Server     │
                                  └───────────┬────────────────────────────────┬───────────┘
                                              │                                │
                                              ▼                                ▼
                       ┌───────────────────────────────┐              ┌─────────────────────────────────┐
                       │   CLI / Batch Execution       │              │  Human-in-the-Loop Review       │
                       │   (Subcommand Dispatch / IPC) │              │  (borderline_loop: SQLite DB)   │
                       └──────────────┬────────────────┘              └────────────────┬────────────────┘
                                      │                                                │
                                      ▼                                                ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                    Core Engine Pipeline (Rust)                                      │
  │                                                                                                     │
  │  ┌────────────────────────┐    ┌───────────────────────────┐    ┌────────────────────────────────┐  │
  │  │  GraphStore (Oxigraph) │───▶│   Plan & Semantic Diff    │───▶│ SHACL Evaluator & Compilers    │  │
  │  │  RDF Triples / Quads   │    │   Conservativity & Logic  │    │ 3-State Verdict Engine         │  │
  │  └────────────────────────┘    └─────────────┬─────────────┘    └────────────────┬───────────────┘  │
  │                                              │                                   │                  │
  │                                              ▼                                   ▼                  │
  │                                ┌───────────────────────────┐    ┌────────────────────────────────┐  │
  │                                │  SHIQ Tableaux Reasoner   │    │ Defects Auditor                │  │
  │                                │  Clash & Consistency Tree │    │ TBox Structural Hygiene Rules  │  │
  │                                └─────────────┬─────────────┘    └────────────────────────────────┘  │
  │                                              │                                                      │
  └──────────────────────────────────────────────┼──────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                   ┌────────────────────────────────────────────────────────┐
                   │    Trusted Computing Base (TCB) Boundary Core          │
                   │    (Pure &[u8] Byte Operations, Zero Heap Formats)     │
                   └─────────────────────────────┬──────────────────────────┘
                                                 │
                                                 ▼ (Transpiled via Aeneas)
                   ┌────────────────────────────────────────────────────────┐
                   │               Lean 4 Proof Verification                │
                   │               OOCert.certificate_sound                 │
                   └────────────────────────────────────────────────────────┘
```

1. **Storage and Ingestion Subsystem (`GraphStore`, Oxigraph, `pyoxigraph` Lite)**:
   - Maintains an in-memory or RocksDB-backed RDF graph. Implements SPARQL 1.1 query evaluation, Turtle, N-Triples, N-Quads, RDF/XML, and JSON-LD parsers/serializers.
   - Enforces transactional isolation across reads and mutations.
2. **Semantic Planning Subsystem (`Planner`, `src/batch.rs`, `src/plan.rs`)**:
   - Treats ontology lifecycles like Infrastructure as Code (analogous to Terraform). Computes semantic delta (`added`, `removed`, `unchanged`), blast radius, Horn-rule conservativity (proving whether new axioms alter existing term semantics), and logic defect evaluation (detecting unsatisfiable classes or ABox clashes introduced by a changeset).
3. **Formal Reasoning Subsystem (`src/reason.rs`, `src/tableaux.rs`)**:
   - Executes tableau algorithms over $\mathcal{SHIQ}$ description logics with bounded budgets (`tableaux_test_timeout_ms`, `classify_timeout_ms`).
   - Generates derivation trees and proof certificates (`asserted.tsv`, `derivations.tsv`, `horn.tsv`).
4. **TCB Certificate Boundary (`src/boundary_core.rs`)**:
   - Operates on primitive byte slices (`&[u8]`) and ASCII tokens. Deliberately excludes string formatting (`core::fmt`), dynamic allocations, and third-party crates to enable automated translation via **Aeneas** into Lean 4 for formal machine verification (`aeneas/lean/OOBoundary.lean`).
5. **Validation Subsystem (`src/shacl.rs`)**:
   - Implements W3C SHACL core and property constraints. Implements a mandatory three-state verdict architecture (`Conforming`, `Violation`, `Undetermined`/`Refused`) to prevent unpreservable store datatypes from collapsing into false cleans.
6. **Active Learning & Boundary Scoring Subsystem (`src/borderline_loop.rs`, SQLite)**:
   - Implements tri-band active learning partitions (`auto_accept`, `borderline`, `auto_reject`) with persistent verdict tracking in SQLite for human-in-the-loop and sub-agent ontology alignments.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Three-State Verification Invariant on Indistinguishable Value Domains
**RULE**:
When an underlying storage, parsing, or serialization layer wide-casts or collapses distinct domain datatypes into a single coarse representation (e.g., store converts `xsd:nonNegativeInteger` to `xsd:integer`, or string-escaped numbers to generic floats), the validator MUST NOT evaluate constraints over those datatypes as either `true` or `false`. It MUST refuse evaluation, transition the verdict to an explicit ternary state (`Undetermined` / `Refused` / `Skipped`), record the unpreserved constraint in audit metadata, and suppress binary verdict assertion.

**WHY**:
Evaluating a shape or constraint against a store that widened or dropped domain precision yields catastrophic false-positive cleans or false-positive violations:
1. In positive disjunctions (`sh:or`), a value widened to `xsd:integer` fails to match `xsd:nonNegativeInteger`, causing an erroneous violation against conforming data.
2. In negative constraints (`sh:not`), widened values fail the negated target shape and incorrectly evaluate to `conforms: true` (a silent defect escaping to production).
3. In cardinality-qualified shapes (`sh:qualifiedValueShape`), valid values fail type assertions, triggering erroneous `minCount` violations.

**WHEN TO APPLY**:
Apply to all validation pipelines, semantic rule engines, schema parsers, or deserialization boundaries where the underlying storage layer loses type granularity (e.g., JSON parsers reading 64-bit integers as `f64`, RDF engines coercing sub-datatypes to root types, dynamic SQL query layers mapping precision decimals to generic doubles).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Pure validation guard preventing verdict collapse on widened storage types.
pub fn evaluate_datatype_clause(
    store_indistinguishable: bool,
    target_datatype: &str,
    property_key: &str,
    alternatives: &mut std::collections::HashMap<String, Vec<String>>,
    unpreserved: &mut std::collections::HashMap<String, String>,
) -> Option<String> {
    if store_indistinguishable {
        // MUST NOT evaluate. Mark property as unpreserved and withhold binary judgement.
        unpreserved.insert(property_key.to_string(), target_datatype.to_string());
        return None;
    }
    Some(format!("DATATYPE(?val) = <{}>", target_datatype))
}

pub fn finalize_constraint_evaluation(
    alternatives: &mut std::collections::HashMap<String, Vec<String>>,
    unpreserved: &std::collections::HashMap<String, String>,
    skipped: &mut Vec<serde_json::Value>,
    shape_iri: &str,
    constraint_name: &str,
) {
    for (prop, dt) in unpreserved {
        // Strip out the alternative so it never generates a false-positive or false-negative SPARQL clause
        alternatives.remove(prop);
        skipped.push(serde_json::json!({
            "shape": shape_iri,
            "constraint": constraint_name,
            "property": prop,
            "unpreserved_datatype": dt,
            "reason": "store widens derived type; cannot decide without false clean or false violation"
        }));
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Attempting to evaluate despite store widening.
// Causes `sh:not [ sh:datatype xsd:nonNegativeInteger ]` to return conforms: true
// on values that are strictly non-negative integers!
if row.contains_key("datatype") {
    let dt = &row["datatype"];
    // DANGEROUS: If store widens `xsd:nonNegativeInteger` to `xsd:integer`,
    // `DATATYPE(?val)` will evaluate to `xsd:integer`, failing the equality check
    // even when the original payload was valid.
    clauses.push(format!("DATATYPE(?val) = <{}>", dt));
}
```

**VERIFICATION METHOD**:
Run property and boundary test suites verifying that schemas with unpreserved datatypes yield `conforms: null`, zero spurious violations, and non-empty `skipped_constraints`:
```rust
#[test]
fn unpreserved_datatype_returns_null_verdict_and_audit_entry() {
    let report = run_shacl_validation(
        "ex:s a sh:NodeShape ; sh:property [ sh:path ex:p ; sh:datatype xsd:nonNegativeInteger ] .",
        "ex:inst ex:p 42 ."
    );
    assert!(report["conforms"].is_null(), "Verdict must be undetermined");
    assert_eq!(report["violation_count"], 0);
    assert!(report["skipped_constraints"].as_array().unwrap().iter().any(|s| s["constraint"] == "sh:datatype"));
}
```

---

### 2. Formal Proof Boundary Byte-Purity Invariant (TCB Isolation)
**RULE**:
The Trusted Computing Base (TCB) core responsible for generating formal proof certificates, proof terms, or state transitions destined for interactive theorem provers (Lean 4, Isabelle, Coq, or formal SMT boundary proofs) MUST operate strictly on byte slices (`&[u8]`) and fixed-width primitives. It MUST NOT perform heap allocations via strings, MUST NOT invoke string-formatting machinery (`core::fmt`, `format!`), and MUST NOT import high-level domain abstractions or third-party crates.

**WHY**:
Formal code extraction frameworks (such as Aeneas for Lean 4, or bounded model checkers like Kani/CBMC) verify algorithms by compiling ASTs directly into functional definitions. Importing `core::fmt`, dynamic heap-allocated strings, or external parsing crates forces the formal verification tool to recursively ingest and model the entire standard library formatting architecture, memory allocators, and Unicode tables. This explodes verification search spaces, invalidates formal proof obligations, and breaks automated translation.

**WHEN TO APPLY**:
Apply to all cryptographic commitment boundaries, proof certificate emitters, AST serializers for formal verifiers, or security-critical validation cores where correctness must be mathematically proved in Lean, Coq, or Kani.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Bare-metal Trusted Computing Base (TCB) boundary function.
/// Compatible with Aeneas -> Lean 4 formal extraction.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CertificatePosition {
    Subject,
    Predicate,
    Object,
}

#[inline(always)]
pub fn is_ascii_whitespace_or_delimiter(b: u8) -> bool {
    b == b'\t' || b == b'\n' || b == b'\r' || b == b' '
}

pub fn field_is_verifiable_ascii(field: &[u8]) -> bool {
    if field.is_empty() {
        return false;
    }
    let mut i = 0;
    while i < field.len() {
        if is_ascii_whitespace_or_delimiter(field[i]) {
            return false;
        }
        i += 1;
    }
    true
}

/// Appends a structured certificate line atomically.
/// Guarantees all-or-nothing: if any token is invalid, buffer remains intact.
pub fn append_certificate_triple(
    buffer: &mut Vec<u8>,
    sub: &[u8],
    pred: &[u8],
    obj: &[u8],
) -> Result<(), CertificatePosition> {
    if !field_is_verifiable_ascii(sub) {
        return Err(CertificatePosition::Subject);
    }
    if !field_is_verifiable_ascii(pred) {
        return Err(CertificatePosition::Predicate);
    }
    if !field_is_verifiable_ascii(obj) {
        return Err(CertificatePosition::Object);
    }

    buffer.extend_from_slice(sub);
    buffer.push(b'\t');
    buffer.extend_from_slice(pred);
    buffer.push(b'\t');
    buffer.extend_from_slice(obj);
    buffer.push(b'\n');
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Calling format! or returning dynamic heap error types in a TCB module.
// This completely kills formal verification tools (Aeneas, Kani, CBMC) by pulling in
// core::fmt, dynamic formatting tables, and complex allocator logic.
pub fn append_certificate_line_polluted(out: &mut String, s: &str, p: &str, o: &str) -> anyhow::Result<()> {
    if s.contains('\t') {
        // Pulls formatting strings and heap allocations into the formal boundary!
        anyhow::bail!("Invalid subject token format: {}", s);
    }
    out.push_str(&format!("{}\t{}\t{}\n", s, p, o));
    Ok(())
}
```

**VERIFICATION METHOD**:
Implement Aeneas extraction harnesses in CI alongside property tests verifying byte-level checks exactly equal character-level checks on all UTF-8 inputs:
```rust
#[test]
fn tcb_byte_validator_matches_char_validator() {
    let test_inputs: &[&[u8]] = &[b"<http://example.org/a>", b"\"hello world\"", b"bad\ttoken\n"];
    for input in test_inputs {
        let byte_res = field_is_verifiable_ascii(input);
        let str_res = std::str::from_utf8(input).map(|s| !s.chars().any(|c| c.is_ascii_whitespace())).unwrap_or(false);
        assert_eq!(byte_res, str_res, "Byte and char predicates diverged on {:?}", input);
    }
}
```

---

### 3. Isolation of Schema-Only vs Instance-Loaded Execution Stores
**RULE**:
When an operational command or audit API (e.g., `defects`, `lint`, `validate`) evaluates an isolated input file, it MUST instantiate an independent, clean, in-memory store for that file's lifecycle. It MUST NOT execute the check within the ambient persistent or shared state store.

**WHY**:
Running an isolated file check inside a persistent database or long-lived shared graph pollutes the main state with temporary triples from the file being inspected. Furthermore, the check judges the file not in isolation, but combined with whatever legacy triples previously existed in the database, yielding non-reproducible defect findings and subtle data leaks across requests.

**WHEN TO APPLY**:
Apply to all multi-tenant services, CLI utilities with daemon proxies, and background lint/defect auditors where commands can target either specific file paths or ambient system state.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn execute_defect_check(
    ambient_graph: &std::sync::Arc<GraphStore>,
    file_path: Option<&str>,
    limit: usize,
) -> Result<serde_json::Value, EngineError> {
    let target_graph = match file_path {
        None => {
            // Ambient check requested: evaluate shared graph
            ambient_graph.clone()
        }
        Some(path) => {
            // File-isolated check: allocate a completely fresh, isolated store
            let content = GraphStore::read_as_turtle(path)?;
            let isolated_store = std::sync::Arc::new(GraphStore::new());
            isolated_store.load_turtle(&content, None)?;
            isolated_store
        }
    };

    Defects::check_with_limit(&target_graph, limit)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Loading target file directly into ambient persistent graph.
// Result: Leaves file's triples behind in persistent storage and contaminates subsequent queries!
pub fn execute_defect_check_leaky(
    ambient_graph: &std::sync::Arc<GraphStore>,
    file_path: Option<&str>,
) -> Result<serde_json::Value, EngineError> {
    if let Some(path) = file_path {
        let content = std::fs::read_to_string(path)?;
        // CRITICAL BUG: Contaminates ambient persistent store!
        ambient_graph.load_turtle(&content, None)?;
    }
    Defects::check(ambient_graph)
}
```

**VERIFICATION METHOD**:
Write a state-leak regression test ensuring ambient store triple counts are identical before and after executing a file-targeted defect check:
```rust
#[test]
fn file_targeted_defect_check_does_not_mutate_ambient_store() {
    let ambient = Arc::new(GraphStore::new());
    ambient.load_turtle("ex:root ex:pred ex:obj .", None).unwrap();
    let initial_count = ambient.len();

    let temp_file = "test_target.ttl";
    std::fs::write(temp_file, "ex:temp ex:a ex:b .").unwrap();

    let _ = execute_defect_check(&ambient, Some(temp_file), 50).unwrap();
    assert_eq!(ambient.len(), initial_count, "Ambient store was contaminated by file check!");
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: False-Clean Validation Escapes via Widened SHACL Member Datatypes (BUG-SHACL-WIDEN-01)
- **Context**: SHACL validation engine (`src/shacl.rs`), specifically within `sh:or`, `sh:not`, and `sh:qualifiedValueShape` evaluator branches.
- **What Was Expected**: The SHACL validator was designed to verify datatypes strictly according to W3C specifications. When validating integer-derived types like `xsd:nonNegativeInteger`, `xsd:int`, or `xsd:dateTimeStamp`, non-conforming data should fail, and conforming data should pass.
- **What Actually Happened**: Oxigraph's underlying RDF store automatically widens derived integer types (e.g. `xsd:nonNegativeInteger`, `xsd:int`, `xsd:unsignedLong`) to generic `xsd:integer`. Direct `sh:datatype` checks previously implemented a guard to refuse such decisions. However, when an unpreserved datatype appeared as an inner member of `sh:or`, `sh:not`, or `sh:qualifiedValueShape`, the compiler did not consult the guard. In `sh:not [ sh:datatype xsd:nonNegativeInteger ]`, a value of `42` was loaded as `xsd:integer`, failed to match the inner type `xsd:nonNegativeInteger`, and thus satisfied the negation, producing a catastrophic **false-clean** (`conforms: true`). In `sh:or` and qualified value shapes, valid values were marked as non-conforming, generating false violations.
- **Evidence in Repo**: Commit `24bbf065` and `01d3bec7`, PR `fix/333-335-shacl-terms`, `src/shacl.rs`, `tests/shacl_datatype_indistinguishable_test.rs`.
- **Root Cause**: The query generator emitted SPARQL clauses comparing raw data datatypes without checking `datatype_is_indistinguishable_in_store(&dt)`. If true, the store's canonicalization broke the mathematical assumptions of member shape evaluation.
- **Remediation Code Diff**:
```rust
// In src/shacl.rs:
@@ -835,7 +839,12 @@ impl ShaclValidator {
                 let clause = if let Some(dt) = row.get("datatype") {
-                    datatype_conforms(&strip_angle_brackets(dt), "val")
+                    let dt = strip_angle_brackets(dt);
+                    if datatype_is_indistinguishable_in_store(&dt) {
+                        or_unpreserved.insert(p, dt);
+                        continue;
+                    }
+                    datatype_conforms(&dt, "val")
                 } else if let Some(c) = row.get("class") {
...
+            for (p, dt) in &or_unpreserved {
+                or_alternatives.remove(p);
+                if !or_unsupported.contains(p) {
+                    let path = or_paths.get(p).cloned().unwrap_or_default();
+                    skipped.push(unpreserved_datatype_skip(&shape_iri, "sh:or", &path, dt));
+                }
+            }
```
- **Lesson**: Validation rules nested within algebraic combinators (`OR`, `NOT`, `QUALIFIED`) must inherit the identical capability guards and domain refuse-rules as direct, top-level assertions.

---

### Incident 2: High-Risk Semantic Breakage Scored as Low Risk in Lifecycle Plans (BUG-PLAN-RISK-02)
- **Context**: Lifecycle planning and change management subsystem (`src/plan.rs`, `src/batch.rs`, `src/inputs.rs`, `docs/lifecycle.md`).
- **What Was Expected**: Running `plan` against proposed ontology changes should accurately compute the change's blast radius and risk score. Inconsistent ABoxes or unsatisfiable classes should raise a `high` risk score.
- **What Actually Happened**: The planner derived `risk_score` exclusively from triple removal counts. A proposed change that introduced an ontological contradiction without deleting any triples—such as making an existing class disjoint with its parent ($Manager \sqsubseteq Person \sqsubseteq Agent$ and $Manager \sqsubseteq \neg Agent$), or asserting an individual into disjoint classes ($Machine \sqsubseteq \neg Person$, $alice \in Machine \cap Person$)—scored `risk_score: low`. CI/CD pipelines gating on risk scores allowed broken ontology changes to deploy automatically to production.
- **Evidence in Repo**: Commit `a3a9dd8f`, Issue `#336`, `docs/lifecycle.md`, `src/batch.rs`.
- **Root Cause**: Metric myopia: blast radius was measured strictly syntactically ($\Delta_{removals}$) rather than semantically via consistency verification ($\mathcal{SHIQ}$ tableaux clash detection) and TBox structural defects.
- **Remediation Code Diff**:
```rust
// In src/batch.rs & src/plan.rs:
@@ -960,7 +1006,12 @@ impl BatchRunner {
-                let result = planner.plan_checked(&turtle, opts)
+                let checks = crate::plan::PlanChecks {
+                    conservativity: opts,
+                    logic: !args.iter().any(|a| a == "--no-logic-check"),
+                };
+                let result = planner.plan_with(&turtle, checks)
                     .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e));
```
- **Lesson**: Architectural "diff" engines must never compute risk solely from syntactic deltas; changes in axiomatic semantics must execute semantic satisfiability checks to establish true risk.

---

### Incident 3: Vacuous Passing of Transitive Paths via Premature Spelling Disjunction (BUG-SHACL-LEAN-03)
- **Context**: Formally verified Lean 4 SHACL compiler (`lean/Shacl/Compile.lean:237`).
- **What Was Expected**: Transitive path expressions (`sh:zeroOrMorePath` or `sh:oneOrMorePath`) are deliberately unhandled in the Lean kernel because they represent infinite closures over the data graph. The compiler was specified to reject them explicitly, returning Exit Code 3 (`UNDETERMINED`).
- **What Actually Happened**: A path node formulated as a named IRI carrying `sh:zeroOrMorePath` was evaluated by `compilePath`. Before inspecting the path operator attributes, the compiler tested `if isIriSpelling node then .ok (.pred node)`. Because the node had an IRI spelling, it was compiled as a standard atomic predicate! The transitive constraint was completely bypassed, returning exit code 0 and `conforms: true`.
- **Evidence in Repo**: GitHub Issue `#205`, `lean/Shacl/Compile.lean`, `lean/ShaclMain.lean`.
- **Root Cause**: Control-flow order-of-operations bug: an IRI-format check preceded the AST construct-type check, incorrectly assuming that any named IRI node could only represent a direct predicate.
- **Remediation Diff**:
```lean
-- In lean/Shacl/Compile.lean:
- if isIriSpelling node then .ok (.pred node)
- else match getPathConstruct node with ...
+ match getPathConstruct node with
+ | .zeroOrMore _ => .error .unsupportedTransitivePath
+ | .oneOrMore _  => .error .unsupportedTransitivePath
+ | .none => if isIriSpelling node then .ok (.pred node) else .error .invalidPath
```
- **Lesson**: Syntactic form checks (e.g. "is this an IRI?") must never take precedence over semantic construct dispatch (e.g. "does this node declare path operator predicates?").

---

### Incident 4: Cross-Command State Contamination in Local Defects CLI (BUG-STATE-POLLUTE-04)
- **Context**: Main entrypoint and batch execution harness (`src/main.rs`, `src/batch.rs`).
- **What Was Expected**: Executing `open-ontologies defects <file.ttl>` should evaluate the ontology file independently and exit cleanly without modifying local persistent storage.
- **What Actually Happened**: When running against persistent local storage (`open-ontologies.db` / RocksDB), `Commands::Defects` loaded the file into the ambient application store (`setup(&cli.data_dir)`). As a result, the target file's triples were permanently persisted into the local database, and any subsequent queries or checks evaluated the file mixed with prior dirty state.
- **Evidence in Repo**: Commit `a3a9dd8f`, `src/main.rs:2887-2905`.
- **Root Cause**: Reusing ambient application bootstrap handles (`setup(&cli.data_dir)`) instead of spinning up an ephemeral, decoupled `Arc<GraphStore>` for ad-hoc inspection commands.
- **Remediation Code Diff**:
```rust
// In src/main.rs:
@@ -2864,9 +2887,14 @@ async fn async_main() -> anyhow::Result<()> {
-        Commands::Defects { input } => {
-            let (_db, graph) = setup(&cli.data_dir)?;
+        Commands::Defects { input, limit } => {
+            use open_ontologies::defects::Defects;
+            let graph = std::sync::Arc::new(GraphStore::new());
```
- **Lesson**: Diagnostic and inspection CLI subcommands that accept an arbitrary input file must operate on fresh, isolated, in-memory state containers to guarantee hermetic execution.

---

### Incident 5: Evaluation Asymmetry and Normalizer Bias in Axiom Extraction (BUG-BENCH-BIAS-05)
- **Context**: Benchmark and evaluation harness (`benchmark/ontoaxiom/score_condition_d.py`, `score_all_conditions.py`).
- **What Was Expected**: Benchmarking bare LLMs against tool-assisted LLMs (MCP) on ontology extraction tasks should use identical normalization rules and evaluation metrics across all experimental conditions.
- **What Actually Happened**: The benchmark script for Condition D (raw OWL) only lowercased tokens during evaluation, whereas Condition A (name lists) split camelCase and stripped namespace prefixes. Because models reading raw OWL emit QNames (e.g., `foaf:Person`) or `rdfs:label` strings, Condition D scored artificially low (F1 = 0.323), erroneously supporting the paper's claim that "raw OWL hurts LLMs." Furthermore, Condition D reported micro-averaged F1 (dominated by 785 Pizza disjointness axioms), whereas Condition A reported macro-averaged F1.
- **Evidence in Repo**: `benchmark/ontoaxiom/score_condition_d.py`, `benchmark/ontoaxiom/score_all_conditions.py`, `rescore_from_predictions.py`.
- **Root Cause**: Independent evolution of evaluation scripts leading to asymmetric token normalization, dissimilar averaging metrics (micro vs. macro), and uncontrolled pair-flipping policies.
- **Remediation Code Diff**:
```python
# In benchmark/ontoaxiom/score_condition_d.py:
- def legacy_pair(pair):
-     return tuple(s.strip().lower() for s in pair)
+ from run_bare_llm_ablation import normalize_pair
...
- allow_flip = True
+ allow_flip = atype in FLIP_TYPES # domain, range only; not symmetric pairs
```
- **Lesson**: In comparative AI agent benchmarks, token normalization and metric calculation pipelines must be unified into a single shared, deterministic evaluator module.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Angle Bracket Stripping & IRI Delimitation**: In `src/shacl.rs`, SPARQL variable bindings return IRIs with enclosing angle brackets (`<http://...>`). Passing these directly into downstream formatters causes double-wrapping (`<<http://...>>`), which crashes Oxigraph's SPARQL parser.
  ```rust
  #[inline(always)]
  pub fn strip_angle_brackets(s: &str) -> String {
      let trimmed = s.trim();
      if trimmed.starts_with('<') && trimmed.ends_with('>') && trimmed.len() >= 2 {
          trimmed[1..trimmed.len() - 1].to_string()
      } else {
          trimmed.to_string()
      }
  }
  ```
- **Byte-Level Delimiter Guards in `boundary_core.rs`**: Proof boundaries must reject control characters (`\t`, `\n`, `\r`) that break TSV line schemas. The check must be performed via ASCII byte comparisons rather than `char` iteration to prevent multi-byte UTF-8 decoding overhead and permit Aeneas formal verification.
  ```rust
  pub fn name_is_safe_bytes(name: &[u8]) -> bool {
      if name.is_empty() { return false; }
      let mut i = 0;
      while i < name.len() {
          let b = name[i];
          if b == b' ' || b == b'\t' || b == b'\n' || b == b'\r' {
              return false;
          }
          i += 1;
      }
      true
  }
  ```
- **Exact Numeric Conversion in CLI Flags**: When parsing limits from CLI flag vectors in `src/batch.rs`, avoid string matching that defaults errors to 0:
  ```rust
  let limit = match Self::flag_value(args, "--limit") {
      None => Defects::MAX_PER_KIND,
      Some(v) => match v.parse::<usize>() {
          Ok(n) => n,
          // CRITICAL: Return explicit error JSON; DO NOT default to 0, which means "unlimited"
          Err(_) => return json!({"error": format!("--limit takes a whole number, got '{v}'")}),
      },
  };
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Fuel Metering and Reasoner Timeout Budgets**: The description logic tableaux algorithm (`src/tableaux.rs`) implements state expansion over existential quantifiers ($\exists R.C$), which can run indefinitely if cyclic dependencies exist without blocking. Expansion loops must enforce strict timeouts and recursion depth caps:
  ```rust
  pub struct ReasonerBudget {
      pub start_time: std::time::Instant,
      pub timeout: std::time::Duration,
      pub max_steps: usize,
      pub current_steps: usize,
  }

  impl ReasonerBudget {
      #[inline(always)]
      pub fn tick(&mut self) -> Result<(), ReasonerError> {
          self.current_steps += 1;
          if self.current_steps > self.max_steps {
              return Err(ReasonerError::StepLimitExceeded(self.max_steps));
          }
          if self.start_time.elapsed() > self.timeout {
              return Err(ReasonerError::Timeout(self.timeout));
          }
          Ok(())
      }
  }
  ```
- **Subclass Transitivity Cycle Breakers**: Computing class subsumption closures over `rdfs:subClassOf*` via property paths can loop infinitely when ontologies contain cycles ($A \sqsubseteq B \sqsubseteq A$). SPARQL queries within the defect checker detect these cycles directly via:
  ```sparql
  SELECT ?class WHERE {
      ?class <http://www.w3.org/2000/01/rdf-schema#subClassOf>+ ?class .
  }
  ```

---

### 3. UI & UX Micro-Mechanics (Tauri Studio Desktop)
- **Port Conflict & Zombie Process Elimination (`studio/src-tauri/src/engine.rs`)**:
  When spawning the background engine process, stale zombie processes occupying port `8137` must be forcefully terminated using platform-specific commands before attempting to bind:
  ```rust
  fn clear_stale_port(port: u16) {
      for pid in stale_pids_on_port(port) {
          kill_process(pid);
      }
  }
  ```
  On Windows, `taskkill /F /PID <pid>` is invoked; on Unix, `kill -9 <pid>`. A mandatory 300ms sleep allows the OS kernel