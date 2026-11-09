> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fabio-rovai-open-ontologies-learnings.md`  
> **Source**: github ([https://github.com/fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies))  
> **Source Version**: `9d2e25ea`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T21:31:45.687Z  
> **Learning ID**: `learn-github-fabio-rovai-open-ontologies`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): fabio-rovai/open-ontologies

---

## 1. Executive Forensic Architecture & System Mechanics

`open-ontologies` is an AI-native Description Logic (DL) knowledge-graph reasoning engine, Model Context Protocol (MCP) server, and CLI written in Rust. It eliminates the traditional dependence on heavyweight JVM-based reasoning infrastructure (e.g., HermiT, Pellet, Openllet) while enforcing formal sound proof certificates verified via Lean 4 and Aeneas.

```
                   +-------------------------------------------------------------+
                   |                 MCP / CLI / HTTP Interface                  |
                   |      (axum HTTP, rmcp server, JSON-RPC, stdio / SSE)        |
                   +------------------------------+------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
         +-------------------------------+                 +-------------------------------+
         |    Oxigraph RDF In-Memory     |                 |       SQLite State Vault      |
         |    Graph Store (SPARQL 1.1)   |                 |    (Migrations, Buffer Vault, |
         +---------------+---------------+                 |     HNSW Fingerprints, Plan)  |
                         |                                 +---------------+---------------+
                         v                                                 |
         +-------------------------------+                                 |
         |      DL Tableau Reasoner      |                                 |
         |    (SHIQ Tableau, Horn SAT,   |<--------------------------------+
         |     Clash Detection Engine)   |
         +---------------+---------------+
                         |
                         v
         +-------------------------------+
         |    Boundary Core (Aeneas)     |
         |  Zero-alloc, byte-only slice  |
         |   invariant serialization     |
         +---------------+---------------+
                         |
                         v
         +-------------------------------+
         |   Lean 4 Formal Verification  |
         |   Kernel (Cert Soundness)     |
         +-------------------------------+
```

### Architectural Subsystem Boundaries
1. **The Pure Boundary Core (`src/boundary_core.rs`)**:
   - Implements zero-allocation, byte-slice-only (`&[u8]`, `u8`, `usize`) predicates and writers.
   - Specifically constrained so that the [Aeneas](https://github.com/AeneasVerif/aeneas) translation toolchain can translate safe Rust directly into pure functional models in Lean 4 without running into unsupported constructs (such as heap-allocating `String`, complex formatting macros, or external crate types like `oxrdf::NamedNode`).
2. **Tableau DL Reasoner Subsystem (`src/tableaux.rs`)**:
   - Executes tableau algorithms over TBox (terminological box: classes, properties) and ABox (assertional box: individuals, relations) theories.
   - Enforces three-valued logic (`true`, `false`, `null`/`unknown`) for consistency and satisfiability checks under strict compute and axiom-coverage budgets.
3. **State & Persistence Vault (`src/state.rs`, `src/borderline_loop.rs`)**:
   - SQLite backed via `rusqlite` with embedded migrations. Maintains plan diffs, lineage tracking, embedding vectors with configuration fingerprints (`model_fp`), HNSW index caches, and human-in-the-loop borderline candidate partitions.
4. **Tauri Studio & Sidecar Orchestration (`studio/src-tauri/src/engine.rs`)**:
   - Manages subprocess lifecycle, port collision resolution via OS socket tables (`netstat` / `lsof`), and stderr-driven readiness handshake over IPC.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Incomplete Domain Proof Invalidation Rule
**RULE**:
When an inference, verification, or constraint-checking engine executes over a strict subset of declared axioms (e.g., unsupported/unmodelled language constructs or partial AST projections), the engine **MUST NOT** report a positive universal property (such as `consistent: true`, `valid: true`, or `sound: true`). If no violation or clash is discovered, the headline verdict **MUST** evaluate to `null` / `unknown`. A negative refutation (e.g., a clash or invariant violation proving `consistent: false`) **MAY** still be reported if and only if the omitted axioms cannot repair or contradict the identified clash.

**WHY**:
In formal logics and static analysis, satisfaction is monotonic with respect to axiom deletion: dropping axioms weakens the theory. Finding a model for a weakened theory ($\mathcal{T}' \subset \mathcal{T}$) only proves that $\mathcal{T}'$ is consistent; it provides zero theoretical guarantee that the full theory $\mathcal{T}$ is consistent. Emitting `consistent: true` when constructs are ignored leads downstream systems (e.g., automated migration agents, schema registries, medical ontologies) to deploy contradictory, corrupt, or logically unsound states.

**WHEN TO APPLY**:
Apply to any constraint solver, SAT/SMT reasoner, type checker, schema validator (JSON Schema, SHACL), or policy evaluator where the input spec contains syntax or semantics not fully modelled by the execution profile.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern derived from src/tableaux.rs
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Satisfiable,
    Unsatisfiable,
    Unknown,
}

pub struct ReasonerReport {
    pub consistent: Option<bool>,
    pub complete: bool,
    pub unmodelled_constructs: Vec<String>,
}

pub fn evaluate_consistency(
    tbox_verdict: Verdict,
    abox_consistent: bool,
    abox_undecided: bool,
    unmodelled: &[String],
) -> ReasonerReport {
    // Proving inconsistency requires only one valid clash.
    // However, proving consistency requires exhaustive axiom evaluation.
    let consistent = if tbox_verdict == Verdict::Unsatisfiable || !abox_consistent {
        Some(false)
    } else if tbox_verdict == Verdict::Unknown || abox_undecided || !unmodelled.is_empty() {
        // INVARIANT: Omitted axioms or exhausted search budgets degrade truth to Unknown (null)
        None
    } else {
        Some(true)
    };

    ReasonerReport {
        consistent,
        complete: unmodelled.is_empty() && !abox_undecided && tbox_verdict != Verdict::Unknown,
        unmodelled_constructs: unmodelled.to_vec(),
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Emitting positive verdict based solely on the absence of clashes
// in a partial/truncated search space.
pub fn evaluate_consistency_flawed(
    tbox_verdict: Verdict,
    abox_consistent: bool,
    unmodelled: &[String],
) -> Option<bool> {
    if !abox_consistent || tbox_verdict == Verdict::Unsatisfiable {
        Some(false)
    } else {
        // FORBIDDEN: Ignores unmodelled constructs! An unmodelled property chain
        // or restriction could introduce a lethal clash.
        Some(true) 
    }
}
```

**VERIFICATION METHOD**:
Enforce via automated property-based test feeding ASTs containing synthetic unsupported constructs. Assert that `consistent` is `None` (JSON `null`) whenever unsupported axioms exist, unless a clash is independently proved:
```rust
#[test]
fn unmodelled_construct_forces_null_consistency_unless_clash() {
    let report = evaluate_consistency(Verdict::Satisfiable, true, false, &["owl:propertyChainAxiom".into()]);
    assert_eq!(report.consistent, None);
    assert!(!report.complete);
}
```

---

### 2. Aeneas-Verification Pure Core Isolation Invariant
**RULE**:
Any module intended to serve as the Trusted Computing Base (TCB) for formal translation via Aeneas into Lean 4/Coq/F* **MUST** operate exclusively over primitive byte slices (`&[u8]`, `u8`, `usize`, `bool`) and simple fieldless or pure product enums. It **MUST NOT** import heap-allocated string types (`String`, `str`), format strings (`format!`, `writeln!`), standard formatting traits (`std::fmt::Display`), dynamic allocations (`Box<dyn Error>`), or third-party semantic AST nodes.

**WHY**:
Formal translation verification tools like Aeneas translate safe Rust into monadic functional programs in interactive theorem provers. High-level runtime types (`std::fmt::Formatter`, `oxrdf::NamedNode`) have massive state spaces and deep standard-library dependency graphs. Introducing a single `format!` macro or `&str` into the boundary module forces the formal verification engine to verify the memory safety and semantics of Rust's UTF-8 validation and formatting engine, causing symbolic execution explosion and breaking automated model extraction.

**WHEN TO APPLY**:
Apply to boundary parsers, certificate serializers, cryptographic assertion verifiers, and micro-kernel components whose correct execution is verified by external theorem provers (Lean 4, Coq, Isabelle, HOL4).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern derived from src/boundary_core.rs
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Position {
    Subject,
    Predicate,
    Object,
}

#[inline(always)]
pub fn starts_with_byte(s: &[u8], b: u8) -> bool {
    !s.is_empty() && s[0] == b
}

pub fn field_fits_the_format(f: &[u8]) -> bool {
    if f.is_empty() {
        return false;
    }
    let mut i = 0;
    while i < f.len() {
        let b = f[i];
        if b == b'\t' || b == b'\n' || b == b'\r' {
            return false;
        }
        i += 1;
    }
    true
}

// Atomically check all terms prior to mutating output buffer
pub fn push_asserted_line_bytes(
    out: &mut Vec<u8>,
    s: &[u8],
    p: &[u8],
    o: &[u8],
) -> Result<(), Position> {
    if !field_fits_the_format(s) { return Err(Position::Subject); }
    if !field_fits_the_format(p) { return Err(Position::Predicate); }
    if !field_fits_the_format(o) { return Err(Position::Object); }
    
    out.extend_from_slice(s);
    out.push(b'\t');
    out.extend_from_slice(p);
    out.push(b'\t');
    out.extend_from_slice(o);
    out.push(b'\n');
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Polluting verification core with high-level strings and fmt macros
pub fn push_asserted_line_polluted(out: &mut String, s: &str, p: &str, o: &str) -> Result<(), String> {
    // FORBIDDEN in Aeneas TCB: String allocation, format! macro introduces
    // deep core::fmt dependency trees that destroy Aeneas Lean translation.
    if s.is_empty() {
        return Err(format!("Subject error: {}", s)); 
    }
    out.push_str(&format!("{s}\t{p}\t{o}\n"));
    Ok(())
}
```

**VERIFICATION METHOD**:
Implement a CI linter check verifying that `boundary_core.rs` contains zero occurrences of `String`, `&str`, `format!`, or `core::fmt`:
```bash
! grep -E "(&str|String|format!|std::fmt|core::fmt)" src/boundary_core.rs
```

---

### 3. Model Configuration Drift Fingerprinting Rule
**RULE**:
Persisted vector embeddings and vector index caches (HNSW, IVFPQ) **MUST** store an immutable, cryptographic configuration fingerprint (`model_fp`) alongside the vector payloads. The fingerprint must incorporate the provider, model name, pooling strategy, precision, and normalization flags. On cache load, the system **MUST** verify the equality of `model_fp` before querying or reusing cached indices. The system **MUST NOT** rely solely on embedding dimensionality (`dim == stored_dim`) or record counts to validate cache freshness.

**WHY**:
Two different embedding models (or versions of the same model) frequently output vectors with identical dimensionality (e.g., 768, 1024, or 1536 float32 values). If a system changes models without altering vector dimensions, byte hashes of the entries and dimensionality checks will pass completely, but the vector space geometry will be totally corrupted. Querying an old index with new model embeddings produces near-random distance metrics, silently destroying recall without raising runtime errors.

**WHEN TO APPLY**:
Apply to any semantic search, RAG pipeline, knowledge-graph embedding store, or vector database caching layer.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern derived from src/state.rs and src/embed_fingerprint.rs
use sha2::{Digest, Sha256};

pub struct EmbeddingConfig<'a> {
    pub provider: &'a str,
    pub model_name: &'a str,
    pub dimension: usize,
    pub normalize: bool,
}

impl<'a> EmbeddingConfig<'a> {
    pub fn compute_fingerprint(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.provider.as_bytes());
        hasher.update(b":");
        hasher.update(self.model_name.as_bytes());
        hasher.update(b":");
        hasher.update(&self.dimension.to_le_bytes());
        hasher.update(if self.normalize { b":norm:1" } else { b":norm:0" });
        format!("{:x}", hasher.finalize())
    }
}

pub fn validate_cached_hnsw_index(
    cached_model_fp: Option<&str>,
    current_config: &EmbeddingConfig,
) -> Result<(), &'static str> {
    let current_fp = current_config.compute_fingerprint();
    match cached_model_fp {
        Some(fp) if fp == current_fp => Ok(()),
        Some(_) => Err("HNSW cache invalidated: embedding model configuration swapped"),
        None => Err("HNSW cache invalidated: legacy index lacks model fingerprint"),
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Verifying index validity solely by dimension match and row count
pub fn validate_hnsw_naive(cached_dim: usize, runtime_dim: usize, count_match: bool) -> bool {
    // FORBIDDEN: Swapping text-embedding-ada-002 with text-embedding-3-small (both 1536 dim)
    // passes this check, poisoning all cosine distance calculations!
    cached_dim == runtime_dim && count_match
}
```

**VERIFICATION METHOD**:
Automated integration test simulating a model change while keeping the vector dimension constant:
```rust
#[test]
fn test_model_swap_invalidates_cache_even_with_same_dim() {
    let cfg1 = EmbeddingConfig { provider: "hf", model_name: "bge-base-en-v1.5", dimension: 768, normalize: true };
    let cfg2 = EmbeddingConfig { provider: "hf", model_name: "nomic-embed-text-v1", dimension: 768, normalize: true };
    
    let fp1 = cfg1.compute_fingerprint();
    assert!(validate_cached_hnsw_index(Some(&fp1), &cfg2).is_err());
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Consistency Assertion on Unmodelled Constructs (BUG-DL-UNMODELLED-01)
- **Context**: DL Tableau Reasoner Subsystem (`src/tableaux.rs`)
- **What Was Expected**: Running `reason --profile owl-dl` on an ontology utilizing DL constructs not yet implemented in the tableau reasoner (e.g., `owl:propertyChainAxiom`) must report consistency as undetermined (`null`), since an omitted axiom could introduce an unsatisfiable clash.
- **What Actually Happened**: The reasoner reported `consistent: true` even though `complete: false` was set and the unmodelled construct was listed under `constructs_not_modelled`. A downstream consumer reading the headline `consistent` boolean operated on a false clean guarantee.
- **Evidence in Repo**: Commit `9d2e25ea` (PR #366), Issue #356. Tests in `tests/reason_undecided_headline_test.rs`.
- **Root Cause**: The headline consistency resolution logic only checked whether the TBox was explicitly unsat or the ABox phase was undecided/inconsistent. When the tableau ran to exhaustion over the recognized axioms without identifying a clash, it fell through to `Some(true)`, ignoring `!unmodelled.is_empty()`.
- **Remediation Code Diff**:
```rust
@@ -4346,9 +4346,12 @@ impl DlReasoner {
             Verdict::Unsatisfiable => Some(false),
             Verdict::Unknown => None,
         };
+        let unmodelled = DlReasoner::unmodelled_constructs(graph);
+        // A finished search over a weaker axiom set cannot prove whole-graph
+        // consistency: an unmodelled construct may carry the missed clash.
         let consistent: Option<bool> = if tbox_verdict.is_unsat() || !abox_result.consistent {
             Some(false)
-        } else if tbox_verdict.is_unknown() || abox_result.undecided {
+        } else if tbox_verdict.is_unknown() || abox_result.undecided || !unmodelled.is_empty() {
             None
         } else {
             Some(true)
```
- **Lesson**: The absence of a counterexample in a partial abstraction cannot prove correctness; positive verdicts require exhaustive completeness across all input constraints.

---

### Incident 2: False-Clean Headline Consistency on ABox Phase Budget Exhaustion (BUG-DL-TIMEOUT-02)
- **Context**: ABox Tableau Search Engine (`src/tableaux.rs`)
- **What Was Expected**: If the ABox tableau search runs out of execution budget (e.g., `tableaux_test_timeout_ms` triggers), the system must degrade the headline consistency to `null`.
- **What Actually Happened**: On synthetic graphs with 3,000 classes and an individual with a deliberate clash placed at the boundary, hitting the budget timeout resulted in `abox: {"consistent": true, "undecided": true}`, which caused the root output to emit `consistent: true`.
- **Evidence in Repo**: Issue #355, addressed prior to commit `9d2e25ea`.
- **Root Cause**: The ABox engine initialized `consistent = true` by default and set `undecided = true` upon budget exhaustion, but the aggregator read `abox.consistent` without factoring in `abox.undecided`.
- **Remediation Code Diff**:
```rust
// In aggregator logic:
- let consistent = if !abox_result.consistent { Some(false) } else { Some(true) };
+ let consistent = if !abox_result.consistent {
+     Some(false)
+ } else if abox_result.undecided {
+     None // Search terminated prematurely; cannot prove absence of clash
+ } else {
+     Some(true)
+ };
```
- **Lesson**: Timeout mechanisms must never default to a optimistic success state. Early exit due to resource bounds must return the bottom/unknown element of the lattice.

---

### Incident 3: Evaluation Asymmetry in Benchmark Normalization & Aggregation (BUG-BENCH-METRIC-03)
- **Context**: OntoAxiom benchmark evaluation suite (`benchmark/ontoaxiom/score_condition_d.py`, `score_all_conditions.py`)
- **What Was Expected**: Comparing LLM ontology generation across Condition A (name lists) and Condition D (raw OWL) required identical token normalizers and identical statistical aggregation functions.
- **What Actually Happened**: Published results claimed "raw OWL hurts performance" (F1 dropping from 0.431 to 0.323). This was an artifact of evaluation bugs: Condition A used camelCase splitting and reported Macro F1; Condition D only lowercased (failing to match QNames/URIs) and reported Micro F1 dominated by a single large entity class (Pizza).
- **Evidence in Repo**: `benchmark/ontoaxiom/score_condition_d.py`, `benchmark/ontoaxiom/score_all_conditions.py`.
- **Root Cause**: Three structural evaluation discrepancies:
  1. String normalizer asymmetry (`legacy_pair` lowercased only, while Condition A stripped prefixes and split camelCase).
  2. Aggregation mismatch: Condition A computed arithmetic mean across cells (Macro), while Condition D pooled global TP/FP/FN (Micro).
  3. Relational pair inversion: Condition D flipped relation pairs on all axiom types, while ground truth only permitted flipping on symmetric domain/range relations.
- **Remediation Code Diff**:
```python
@@ -45,10 +45,12 @@
- def legacy_pair(pair):
-     return tuple(s.strip().lower() for s in pair)
+ from run_bare_llm_ablation import normalize_pair
...
- allow_flip = True
+ allow_flip = atype in FLIP_TYPES # domain, range only
...
- micro = f1_of(grand_tp, grand_fp, grand_fn)
- # Reported only micro F1 as headline
+ macro = sum(macro_cells) / len(macro_cells) if macro_cells else 0.0
+ micro = f1_of(grand_tp, grand_fp, grand_fn)
+ # Report both side-by-side under the exact same evaluator
```
- **Lesson**: An empirical benchmark comparison across heterogeneous pipelines is invalid unless evaluation functions are shared across identical normalized representations.

---

### Incident 4: Missing Runtime Shared Libraries in Multi-Stage Distroless Build (BUG-DOCKER-ABI-04)
- **Context**: Container Packaging Pipeline (`Dockerfile`)
- **What Was Expected**: The final `gcr.io/distroless/cc-debian12` container running `open-ontologies serve` starts cleanly with PostgreSQL (`libpq`) and OpenSSL dependencies.
- **What Actually Happened**: Binary failed on execution with missing dynamic library linker errors (`libz.so.1 cannot open shared object file`), breaking production HTTP and MCP servers in Issue #59.
- **Evidence in Repo**: `Dockerfile` comments referencing issue #59 and RUSTSEC-2026-0435.
- **Root Cause**: Hand-curated `COPY --from=builder /usr/lib/...` directives failed to capture transitive dependencies pulled in by `libpq-dev` (such as `libz.so.1`).
- **Remediation Code Diff**:
```dockerfile
@@ -20,6 +20,13 @@
- COPY --from=builder /usr/lib/x86_64-linux-gnu/libpq.so.5 /usr/lib/
- COPY --from=builder /usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/
+ # Recursively resolve transitive shared libraries using ldd and copy them preserving paths
+ RUN mkdir -p /deps && \
+     ldd target/release/open-ontologies \
+       | awk '/=> \// {print $3} /^\t\// {print $1}' \
+       | grep -Ev '/(ld-linux[^/]*|libc|libm|libdl|libpthread|librt|libresolv|libgcc_s|libstdc\+\+)\.so' \
+       | sort -u \
+       | xargs -I{} cp -v --parents -L {} /deps/
...
+ COPY --from=builder /deps/ /
```
- **Lesson**: Never manually enumerate shared libraries for stripped minimal containers. Parse `ldd` transitive trees deterministically during the build stage.

---

### Incident 5: Database Migration Error-Swallowing Masking Corruption (BUG-SQLITE-MIG-05)
- **Context**: State Persistence Engine (`src/state.rs`)
- **What Was Expected**: Incremental schema upgrades must apply alter table statements safely and fail visibly if database corruption, lock contention, or I/O failure occurs.
- **What Actually Happened**: Legacy code ran `let _ = conn.execute_batch("ALTER TABLE ...")` to add columns. If a table was locked or the page was corrupt, the error was silently swallowed under the assumption that it was merely a "duplicate column name" error.
- **Evidence in Repo**: `src/state.rs` comments and implementation of `column_exists`.
- **Root Cause**: Conflation of expected idempotency errors (column already exists) with fatal system errors (disk failure, lock timeouts, corruption).
- **Remediation Code Diff**:
```rust
@@ -190,6 +190,20 @@
- // Old pattern swallowed all errors
- let _ = conn.execute("ALTER TABLE monitor_watchers ADD COLUMN webhook_url TEXT", []);
+ fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
+     let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
+     let mut rows = stmt.query([])?;
+     while let Some(row) = rows.next()? {
+         let name: String = row.get(1)?;
+         if name == column {
+             return Ok(true);
+         }
+     }
+     Ok(false)
+ }
+ // In migration runner:
+ if !column_exists(conn, col.table, col.column)? {
+     conn.execute(col.ddl, [])?;
+ }
```
- **Lesson**: Never use error-swallowing for schema idempotency. Inspect metadata schemas (`PRAGMA table_info`, `information_schema`) explicitly prior to mutation.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Byte-Level String Discrimination**: In `src/boundary_core.rs`, RDF terms are inspected via byte slices rather than UTF-8 string decoders:
  ```rust
  pub fn starts_with_byte(s: &[u8], b: u8) -> bool {
      !s.is_empty() && s[0] == b
  }
  ```
  `s[0] == b'<'` guarantees an IRI; `s[0] == b'"'` guarantees a literal; `s.len() > 1 && s[0] == b'_' && s[1] == b':'` guarantees a blank node. No multi-byte UTF-8 sequence can emit an ASCII byte ($< 128$) anywhere in subsequent continuation bytes ($128..=191$).
- **Atomic Buffer Construction**: When writing serialized lines to byte buffers (`push_asserted_line_bytes`), every term is fully validated *before* the first byte is pushed:
  ```rust
  if !term_fits_the_format(s) { return Err(Position::Subject); }
  if !term_fits_the_format(p) { return Err(Position::Predicate); }
  if !term_fits_the_format(o) { return Err(Position::Object); }
  out.extend_from_slice(s);
  ```
  This prevents "half-line" buffer pollution if an invalid object term follows valid subject/predicate terms.

### 2. Infinite Loop & Recursion Guards
- **Finite Horizon Tableaux**: Tableau expansion can easily loop indefinitely on recursive existential quantification ($\exists R.C$). `src/tableaux.rs` applies subset blocking / pairwise-equality blocking and caps expansion steps.
- **Deterministic Loop Termination Invariant**:
  ```rust
  // Invariant proof on field_fits_the_format
  let mut i = 0;
  while i < f.len() {
      // Loop variable strictly increases by 1 per iteration
      // Bounds: 0 <= i < f.len(), terminates in exactly f.len() steps.
      if f[i] == b'\t' || f[i] == b'\n' || f[i] == b'\r' {
          return false;
      }
      i += 1;
  }
  true
  ```

### 3. UI & UX Micro-Mechanics (Tauri / Studio Engine)
- **Port Collision Annihilation**: `studio/src-tauri/src/engine.rs` avoids assuming a chosen TCP port (default `8137`) is available. Before spawning, it inspects active listening sockets and terminates stale processes holding the port:
  ```rust
  // Windows: netstat -ano -p tcp | findstr :PORT -> taskkill /F /PID
  // Unix: lsof -ti tcp:PORT -> kill -9
  clear_stale_port(port);
  std::thread::sleep(std::time::Duration::from_millis(300));
  ```
- **Dual-Handshake Ready Signaling**: To prevent GUI race conditions during backend boot, the frontend receives `engine-ready` via two independent paths:
  1. Real-time stream parsing: Asynchronously reading the engine's `stderr` for `"listening"` / `":8137"` and emitting `engine-ready`.
  2. Fallback timer: A background thread sleeping 2 seconds before emitting `engine-ready` to handle quiet daemon modes.

### 4. Backend Concurrency & Memory Safety
- **Deadlock-Free State Vault Locks**: The SQLite connection in `StateDb` is wrapped in `Arc<Mutex<Connection>>`. To prevent lock poisoning and connection pool starvation during long reasoning runs:
  - Long-running reasoning calculations run over read-only Oxigraph graph clones in memory (`rayon` threads).
  - The SQLite database is touched solely during distinct, microsecond transactions (`record_verdict`, `latest_verdict`).
- **TOCTOU Guard in Port Binding**: Port parsing falls back to `DEFAULT_ENGINE_PORT` if invalid or zero, preventing unbound dynamic port allocation race conditions.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Non-Swallowing PRAGMA Schema Probes**:
  `column_exists` uses `PRAGMA table_info` rather than catching runtime DDL errors, avoiding masked table locks or file corruption.
- **Strict Format Encodings**: `python/src/open_ontologies_lite/engine.py` explicitly normalizes format keys (`json-ld`, `jsonld`, `ttl`, `turtle`) before interacting with Oxigraph C-bindings to avoid runtime panics.

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
The system decouples formal reasoning from the I/O interface using an asynchronous hex-architecture:
- Core reasoning runs purely over immutable memory graphs.
- Proof certificates are output in verified TSV formats (`asserted.tsv`, `derivations.tsv`, `horn.tsv`).
- The storage layer relies on SQLite for persistent lineage, plans, and caching.

### Dimension 2: Core Abstractions
- `DlReasoner`: Encapsulates SHIQ Description Logic rules, nominals, and existential restrictions.
- `StateDb`: Manages persistence with strictly ordered schema migrations.
- `Candidate` & `PartitionReport`: Power the human-in-the-loop borderline partition loop.
- `Position`: Three-element error enum (`Subject`, `Predicate`, `Object`) maintaining pure verification safety.

### Dimension 3: Error Handling
- Structured errors with `thiserror` in internal libraries; `anyhow` used strictly at CLI/MCP boundaries.
- Formal TCB boundary uses raw enums (`Position`) to prevent pulling `std::fmt` allocations into verification pipelines.
- Partial reasoning returns three-valued `Option<bool>` (`None` = unknown), never guessing or coercing errors to boolean false.

### Dimension 4: Testing
- High-level property testing validates that byte-level TCB predicates match high-level Unicode char predicates (`tcb_wrappers_agree_with_the_char_level_predicates`).
- Aeneas extraction to Lean 4 proofs validates format safety across all byte slice lengths.
- Real-world regression suites (e.g., ORE 2015 ontology test cases) verify HermiT parity.

### Dimension 5: Security
- **Memory Safety**: Pure safe Rust core; minimal dependencies