> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/killercup-cargo-edit-learnings.md`  
> **Source**: github ([https://github.com/killercup/cargo-edit](https://github.com/killercup/cargo-edit))  
> **Source Version**: `138d4e29`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:50:21.898Z  
> **Learning ID**: `learn-github-killercup-cargo-edit`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): killercup/cargo-edit

---

## 1. Executive Forensic Architecture & System Mechanics

```
                             +----------------------------------------+
                             |              CLI Boundary              |
                             |  clap derive / cargo CLI integration   |
                             +-------------------+--------------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                             |                             |
                   v                             v                             v
       +-----------------------+     +-----------------------+     +-----------------------+
       |     cargo-upgrade     |     |   cargo-set-version   |     |    cargo-add / rm     |
       |  Dependency Resolver  |     |  Workspace Bumper     |     |   Deprecated Proxy    |
       +-----------+-----------+     +-----------+-----------+     +-----------+-----------+
                   |                             |                             |
                   +--------------------+        |                             |
                                        |        |                             v
                                        v        v                  (Hard-fail bailout guide)
                           +-------------------------------+
                           |        Workspace Engine       |
                           |  cargo_metadata / Path Diff   |
                           +---------------+---------------+
                                           |
                   +-----------------------+-----------------------+
                   v                                               v
       +-----------------------+                       +-----------------------+
       |   Remote Crates Index |                       |  Format-Preserving    |
       |  tame-index (sparse)  |                       |  Manifest Engine      |
       |  semver requirements  |                       |      (toml_edit)      |
       +-----------------------+                       +-----------------------+
```

### 1.1 The Core Problem Space
`cargo-edit` provides out-of-tree and prototype extensions to the Cargo build tool for managing dependency declarations in `Cargo.toml` manifests. Unlike automated build operations that consume read-only metadata, `cargo-edit` must:
1. Parse valid and partially valid TOML manifests.
2. Query local crates.io sparse indexes, remote registries, or git repos for updated semver specifications.
3. Mutate the manifest in place while strictly preserving formatting, comments, blank lines, and table organization (formatting-preserving AST editing via `toml_edit`).
4. Keep the target workspace `Cargo.lock` in sync by coordinating workspace discovery through `cargo_metadata`.

### 1.2 Subsystem Decoupling & Modular Layout
The repository is structured as a cargo multi-binary crate configured via `Cargo.toml`:
* **Subcommand Binaries (`src/bin/{add, rm, upgrade, set-version}/`)**: Each binary exposes a Cargo subcommand interface (`cargo-<cmd>`). `cargo add` and `cargo rm` serve as deprecation stubs since their upstream assimilation into Cargo core (1.62 and 1.66), intercepting CLI calls with operational hints.
* **Manifest Mutation Layer (`src/manifest.rs`, `toml_edit`)**: Encapsulates document loading, key querying across table formats (standard tables `[dependencies]`, inline tables `{ version = "..." }`, target-specific `[target.'cfg(...)'.dependencies]`), and surgical editing without losing original source tokens.
* **Workspace Discovery Layer (`src/metadata.rs`, `cargo_metadata`)**: Resolves workspace hierarchies, identifies members, root manifests, virtual workspaces, and handles dependency graph generation.
* **Registry & Index Resolution (`src/registry.rs`, `src/index.rs`, `tame-index`)**: Reads sparse HTTP indexes or Git indexes using `tame-index` with native-cert/webpki dual SSL engines to resolve the newest versions satisfying semver requirements.
* **Terminal Diagnostics & UX (`src/util.rs`, `termcolor`, `concolor-control`)**: Implements strict stderr/stdout split semantics adhering to Cargo style guidelines (justified 12-character bold green actions, non-justified warning/note prefixes, raw stdout piping for machine-readable output).

---

## 2. Net-New Universal Engineering Rules

### 1. Fallback Degradation Prohibition for Downstream-Impacting Invariants
**RULE**:
A subsystem MUST NOT catch an operational failure and silently fall back to a degraded execution mode (such as `--no-deps` metadata queries) if downstream components depend on the discarded data to maintain system consistency. Failures must either be surfaced as fatal errors or converted into explicit, opt-in flags with logged diagnostic warnings.

**WHY**:
In `cargo set-version`, executing `cargo_metadata` with dependencies is required to identify all workspace nodes and update `Cargo.lock`. When private registry credentials or network-isolated offline crates caused the dependency-aware query to fail, the function previously fell back to `cargo metadata --no-deps`. The command exited successfully (status 0), but silently skipped the lockfile update, creating a state desynchronization bug that persisted into Git commits in automated CI/CD runners.

**WHEN TO APPLY**:
Apply to all metadata collectors, CLI build adapters, and graph resolvers where subsequent mutation steps rely on full graph knowledge (e.g., lockfile sync, dependency pruning, schema migrations).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In workspace resolution routines: Enforce strict propagation of graph queries
pub fn resolve_ws(
    manifest_path: Option<&std::path::Path>,
    other: &[String],
) -> CargoResult<cargo_metadata::Metadata> {
    let mut cmd = cargo_metadata::MetadataCommand::new();
    if let Some(path) = manifest_path {
        cmd.manifest_path(path);
    }
    cmd.other_options(other);

    // INVARIANT: Do not fallback to cmd.no_deps() on error.
    // Downstream state updates (e.g., Cargo.lock regeneration) depend on 
    // full dependency graph resolution. Swallowing failures hides missing credentials
    // or invalid target specifications and corrupts synchronization.
    let ws = cmd.exec()?;
    Ok(ws)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Catching an error and silently degrading graph fidelity
let ws = cmd.exec().or_else(|_| {
    // SILENT DOWNGRADE: Discards all dependency nodes.
    // Lockfile update logic will now find 0 dependencies and skip lockfile updates,
    // returning Ok(()) to the caller while leaving the disk in an inconsistent state.
    cmd.no_deps();
    cmd.exec()
})?;
```

**VERIFICATION METHOD**:
Automated integration test verifying that a workspace containing an intentionally unresolvable crate (e.g., missing private registry dependency) fails with a non-zero exit code and an informative error on stderr, rather than completing with exit status 0 and a stale lockfile.

---

### 2. State-Aware Progressive Diagnostic Guidance Invariant
**RULE**:
CLI diagnostic notes, hints, and corrective advice MUST be calculated dynamically from the active execution context and flag states. An interactive tool MUST NOT emit static remediation advice directing users to pass a flag that is already active.

**WHY**:
When `cargo upgrade` suppresses un-upgradable dependencies (e.g., pinned or at latest version), it emits a hint: `Re-run with --verbose to show more dependencies`. When a developer executes `cargo upgrade --verbose`, the filter still hides dependencies matching higher-level suppressions, but outputting the static `--verbose` message leads to an infinite cognitive dead-end. The hint must dynamically advance to `--verbose --verbose`.

**WHEN TO APPLY**:
Apply to any command-line interface, linter, or build harness where verbosity, pagination, filtering, or debug levels can be incrementally stacked.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Calculate the exact subsequent verbosity flag required to bypass current filter level
pub fn format_verbosity_hint(current_verbosity: usize, categorize_count: usize) -> Option<String> {
    if categorize_count == 0 {
        return None;
    }

    let next_flag = match current_verbosity {
        0 => "`--verbose`",
        1 => "`--verbose --verbose`",
        _ => return None, // Already at maximum diagnostics display
    };

    Some(format!("Re-run with {next_flag} to show more dependencies"))
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Hardcoded diagnostic advice ignoring CLI invocation flags
if !categorize.is_empty() {
    // If the user already passed `--verbose`, this prompt is misleading and inaccurate.
    let note = "Re-run with `--verbose` to show more dependencies".to_owned();
    writeln!(stderr, "note: {note}")?;
}
```

**VERIFICATION METHOD**:
UI snapshot test (via `snapbox` / `trycmd`) capturing `stderr` for both non-verbose (`cargo upgrade`) and single-verbose (`cargo upgrade -v`) runs, asserting that stderr contains `note: Re-run with '--verbose'` and `note: Re-run with '--verbose --verbose'` respectively.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Error Swallowing via `--no-deps` Fallback (BUG-METADATA-01)
- **Context**: Workspace resolution in `src/bin/set-version/set_version.rs`.
- **What Was Expected**: Running `cargo set-version --workspace` against a workspace with private crates should either succeed in updating both `Cargo.toml` and `Cargo.lock`, or fail with an actionable error if the dependency graph cannot be resolved.
- **What Actually Happened**: On CI runners without private registry credentials, `cargo_metadata` failed. The error was caught, and `cmd.no_deps()` was executed. The `Metadata` object lacking dependency info caused `set-version` to skip `Cargo.lock` updating. The job succeeded with exit code 0, leaving the lockfile out of sync.
- **Evidence in Repo**: Commit `eab31121`, Issue #891.
- **Root Cause**: An `or_else` block caught the `MetadataCommand::exec()` failure, mutated the command with `cmd.no_deps()`, and ran it again. This suppressed root resolution errors.
- **Remediation Code Diff**:
```rust
@@ -348,10 +348,7 @@ fn resolve_ws(
     }
     cmd.other_options(other);
 
-    let ws = cmd.exec().or_else(|_| {
-        cmd.no_deps();
-        cmd.exec()
-    })?;\
+    let ws = cmd.exec()?;
     Ok(ws)
 }
```
- **Lesson**: Never introduce an automatic fallback that drops information fidelity unless downstream consumers are built to operate with reduced fidelity and the degradation is clearly surfaced.

---

### Incident 2: Misleading Static Diagnostic Hint under Verbose Execution (BUG-VERBOSITY-HINT-02)
- **Context**: Filtered dependency reporting in `src/bin/upgrade/upgrade.rs`.
- **What Was Expected**: When some dependencies are omitted from the upgrade summary table due to verbosity thresholds, the CLI should point to the next effective verbosity flag.
- **What Actually Happened**: A user passing `-v` / `--verbose` received: `note: Re-run with '--verbose' to show more dependencies`. Re-running with `--verbose` yielded the exact same output and hint.
- **Evidence in Repo**: Commit `e98ac32a`, PR #969, Issue #867.
- **Root Cause**: The string literal was hardcoded without checking `args.is_verbose()`.
- **Remediation Code Diff**:
```rust
@@ -625,7 +625,12 @@ fn exec(args: UpgradeArgs) -> CargoResult<()> {
                 .or_insert_with(BTreeSet::new)
                 .insert(dep.name);
         }
-        let mut note = "Re-run with `--verbose` to show more dependencies".to_owned();
+        let verbose_flags = if args.is_verbose() {
+            "`--verbose --verbose`"
+        } else {
+            "`--verbose`"
+        };
+        let mut note = format!("Re-run with {verbose_flags} to show more dependencies");
         for (reason, deps) in categorize {
             use std::fmt::Write;
             write!(&mut note, "\n  {reason}: ")?;
```
- **Lesson**: Hints suggesting alternate flags must be derived as a function of the active argument set ($H = f(A_{active})$).

---

### Incident 3: Nonexistent Package Targeting Resulting in Silent Zero Exit Status (BUG-NOOP-PKGID-03)
- **Context**: CLI package matching in `src/bin/set-version/set_version.rs`.
- **What Was Expected**: Invoking `cargo set-version -p non-existent-crate` must return a non-zero exit status and print an error message indicating that the package was not found in the workspace.
- **What Actually Happened**: The tool iterated over workspace packages, found zero matches, modified 0 files, and exited with status 0.
- **Evidence in Repo**: Issue #888 (`cargo --offline set-version --bump patch -p this-package-does-not-exist`).
- **Root Cause**: The workspace filter used an iterator filtering step that produced an empty list. The execution completed successfully without verifying that `-p` matched at least one package in the workspace.
- **Remediation Code Pattern**:
```rust
// Verified defensive pattern
let matched_packages = workspace_members
    .iter()
    .filter(|pkg| selected_pkg_ids.contains(&pkg.name))
    .collect::<Vec<_>>();

if matched_packages.is_empty() && !selected_pkg_ids.is_empty() {
    anyhow::bail!("Package ID specification {:?} did not match any packages in workspace", selected_pkg_ids);
}
```
- **Lesson**: CLI operations targeting specific named sub-resources must treat zero matches as an error unless an explicit `--allow-empty` flag is provided.

---

### Incident 4: Out-of-Tree Feature Deprecation Fail-Safe (BUG-DEPRECATE-UPSTREAM-04)
- **Context**: Deprecation proxy binaries in `src/bin/add/add.rs` and `src/bin/rm/rm.rs`.
- **What Was Expected**: Users invoking older third-party wrappers or stale scripts using `cargo-add` or `cargo-rm` from `cargo-edit` should understand why behavior changed and how to migrate.
- **What Actually Happened**: When Cargo assimilated `add` and `rm` natively into 1.62 and 1.66, having `cargo-edit` continue to mutate manifests risked divergence from Cargo's internal lockfile and index resolution logic.
- **Evidence in Repo**: `src/bin/add/add.rs` and `src/bin/rm/rm.rs`.
- **Root Cause**: Upstream tool adoption made external implementations redundant.
- **Remediation Code Diff**:
```rust
impl AddArgs {
    pub(crate) fn exec(self) -> CargoResult<()> {
        anyhow::bail!(
            "`cargo add` has been merged into cargo 1.62+ as of cargo-edit 0.10, either\n\
            - Upgrade cargo, like with `rustup update`\n\
            - Downgrade `cargo-edit`, like with `cargo install cargo-edit --version 0.9.1`"
        );
    }
}
```
- **Lesson**: When an external tool is absorbed upstream, cleanly deprecate the old binary with actionable next steps rather than attempting complex, diverging parallel maintenance.

---

### Incident 5: Manifest In-Place Corruption via Structural Deserialization (BUG-TOML-ROUNDTRIP-05)
- **Context**: Manifest editing in `src/manifest.rs`.
- **What Was Expected**: Modifying a single version string in `[dependencies]` must not alter line endings, inline comments, table ordering, or key ordering.
- **What Actually Happened**: Standard TOML deserializers (`toml::from_str` and `toml::to_string`) parse into serde data structures and serialize back out in an opinionated, normalized layout, stripping user comments and reordering keys.
- **Evidence in Repo**: `Cargo.toml` dependency on `toml_edit = "0.25.11"` with tests asserting exact whitespace and comment preservation.
- **Root Cause**: Treating editable human configuration files as plain data objects instead of concrete syntax trees (CSTs).
- **Remediation Pattern**: Complete migration from `toml::Value` to `toml_edit::DocumentMut` and `toml_edit::Item`.
- **Lesson**: Configuration modification tools must use Concrete Syntax Trees (CST) or lossless ASTs, never standard serialization trees that discard whitespace and comments.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
* **Divergent String Formats & Allocation Invariants**: Notice the distinction in `src/bin/upgrade/upgrade.rs`:
```rust
// AVOID: Allocating an unnecessary intermediate String if not appending
let mut note = "Re-run with `--verbose` to show more dependencies".to_owned();

// PREFERRED: Using format! with dynamic branch logic and formatting in-place via write!
let verbose_flags = if args.is_verbose() {
    "`--verbose --verbose`"
} else {
    "`--verbose`"
};
let mut note = format!("Re-run with {verbose_flags} to show more dependencies");
for (reason, deps) in categorize {
    use std::fmt::Write;
    // std::fmt::Write returns Result<(), std::fmt::Error>, propagated via ?
    write!(&mut note, "\n  {reason}: ")?;
}
```
`write!(&mut note, ...)` targets `std::fmt::Write` (infallible memory allocation except OOM) rather than `std::io::Write` (fallible I/O system errors). Mixing these traits without explicit scoping produces compilation ambiguity.

* **Deterministic Sorting with `BTreeSet`**:
When collecting omitted dependencies, `upgrade.rs` groups items with:
```rust
categorize
    .entry(reason)
    .or_insert_with(BTreeSet::new)
    .insert(dep.name);
```
Using `HashSet` would result in non-deterministic ordering across runs, breaking UI snapshot comparisons (`stderr.term.svg`). `BTreeSet` guarantees lexicographical ordering, satisfying snapshot determinism.

---

### 4.2 Infinite Loop & Recursion Guards
* **Cyclic Dependency Guards in Workspace Graphs**:
When processing recursive dependencies across workspace members:
```rust
pub fn traverse_workspace_deps(
    root: &PackageId,
    graph: &HashMap<PackageId, Vec<PackageId>>,
    visited: &mut HashSet<PackageId>,
    depth_limit: usize,
) -> CargoResult<()> {
    if !visited.insert(root.clone()) {
        // Cycle detected: Gracefully terminate branch exploration
        return Ok(());
    }
    if visited.len() > depth_limit {
        anyhow::bail!("Dependency recursion depth limit exceeded (cycle suspected at {root})");
    }
    if let Some(children) = graph.get(root) {
        for child in children {
            traverse_workspace_deps(child, graph, visited, depth_limit)?;
        }
    }
    Ok(())
}
```
*Termination Proof*: `visited.insert(root.clone())` returns `false` if `root` is already present. Because the set of package IDs in a valid workspace is finite ($N < \infty$), the recursion is bounded by $O(N)$ operations.

---

### 4.3 UI & UX Micro-Mechanics
* **Cargo Shell Justification Protocol**:
In `src/util.rs`, Cargo's CLI output style requires 12-character right-justified status strings for primary actions, but non-justified colon-delimited prefixes for notes and warnings:
```rust
if justified {
    // Action format: "   Upgrading foo v1.0.0 -> v2.0.0" (12 chars wide, right aligned, bold green)
    write!(output, "{status:>12}")?;
} else {
    // Advisory format: "note: message" or "warning: message"
    write!(output, "{status}")?;
    output.set_color(ColorSpec::new().set_bold(true))?;
    write!(output, ":")?;
}
```
* **Color Stream Detection Invariant**:
Command stdout may be piped to tools (e.g., `jq`, `sed`), while stderr is connected to an interactive TTY. `src/util.rs` queries stream-specific color capabilities using `concolor_control::Stream::Stderr` and `Stdout` independently:
```rust
pub fn colorize_stderr() -> ColorChoice {
    if concolor_control::get(concolor_control::Stream::Stderr).color() {
        ColorChoice::Always
    } else {
        ColorChoice::Never
    }
}
```
Applying stdout color preferences to stderr can leak ANSI escape codes into redirected output pipelines.

---

### 4.4 Backend Concurrency & Memory Safety
* **Lockfile Contention & In-Memory Mutation Ordering**:
`cargo set-version` and `cargo upgrade` must not modify `Cargo.lock` concurrently while holding an unsaved `Cargo.toml` handle.
1. Read `Cargo.toml` from disk into `toml_edit::DocumentMut`.
2. Apply in-memory modifications to the AST.
3. Validate and re-serialize `Cargo.toml` back to disk.
4. Execute `cargo_metadata` or invoke cargo to regenerate `Cargo.lock`.

If step 4 runs before step 3 hits the filesystem, `cargo metadata` parses the old manifest on disk, creating a TOCTOU (Time-of-Check to Time-of-Use) desynchronization where the generated lockfile reflects outdated version constraints.

---

### 4.5 Defect & Error Prevention ("Galti Pakadna")
* **Empty Substring / Non-Empty String Clap Validation**:
In `src/bin/rm/rm.rs`:
```rust
#[arg(
    long, 
    value_parser = clap::builder::NonEmptyStringValueParser::new(), 
    help_heading = "Section"
)]
pub target: Option<String>,
```
Using standard `Option<String>` allows `--target ""` to pass validation, propagating an empty string down to TOML section lookups and corrupting headers into `[target.''.dependencies]`. `NonEmptyStringValueParser` fails immediately at the CLI parsing boundary.

* **Accidental Downgrade Guard**:
In `src/bin/set-version/errors.rs`:
```rust
pub(crate) fn version_downgrade_err(current: impl Display, requested: impl Display) -> Error {
    anyhow::format_err!("Cannot downgrade from {current} to {requested}")
}
```
`set-version` verifies semantic version ordering ($V_{target} \ge V_{current}$) unless an explicit `--allow-downgrade` flag is passed, preventing accidental version rollbacks in deployment pipelines.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
* Multi-binary modular architecture (`cargo-add`, `cargo-rm`, `cargo-upgrade`, `cargo-set-version`).
* Clear boundary between read-only index resolution (`tame-index`) and write-only AST manipulation (`toml_edit`).
* Deprecation shells provide safe fallbacks for absorbed features.

### 2. Core Abstractions
* `CargoResult<T>`: Alias for `Result<T, anyhow::Error>`, providing contextual propagation across the command tree.
* `toml_edit::DocumentMut`: Represents the TOML document as an editable, token-preserving AST.
* `UpgradeArgs` / `VersionArgs`: Clap derive structures enforcing CLI contracts, mutually exclusive groups (`conflicts_with`), and value requirements.

### 3. Error Handling
* Errors use `.with_context(|| "...")` to preserve the causal chain without losing the underlying IO or parsing root cause.
* Complete removal of silent fallback paths (as seen in `eab31121`).
* Structured bailouts via `anyhow::bail!` for invalid user operations (e.g., attempting a version downgrade without authorization).

### 4. Testing
* End-to-end UI testing using `snapbox` and `cargo-test-support`.
* Terminal output verified via SVG snapshots (`stdout.term.svg`, `stderr.term.svg`).
* Isolated test projects instantiated inside temporary sandbox filesystems (`Project::from_template(...)`).

### 5. Security
* Registry interactions use `tame-index` with native certificate authorities or `webpki` roots, avoiding unverified TLS connections.
* Local path traversal containment: relative paths are validated against manifest roots to avoid writes outside the repository boundary.

### 6. Performance
* Binary build profiles enforce aggressive optimization:
```toml
[profile.release]
panic = "abort"
codegen-units = 1
lto = true
```
* Sparse index queries over HTTP prevent full registry checkouts, lowering memory consumption and startup latency.

### 7. Deployment
* Integration with `cargo-release` via `[package.metadata.release]`.
* Strict changelog search-and-replace invariants enforced before publishing.

### 8. Agent Patterns
* Tool invocation interfaces use standard `--dry-run` and `--locked` flags, allowing coding agents to preview changes without modifying the disk.
* Structured stdout/stderr split provides clear separation between machine-readable tables and human-readable diagnostic notes.

### 9. Data Flow
```
User Invocation -> Clap Parser -> Workspace Metadata (cargo_metadata) 
  -> Local/Remote Index Query (tame-index) -> AST In-Memory Mutation (toml_edit) 
  -> Manifest Serialization -> Lockfile Regeneration (cargo)
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Terminal Color Isolation & Justification
```rust
pub fn shell_print(status: &str, message: &str, color: Color, justified: bool) -> CargoResult<()> {
    let color_choice = colorize_stderr();
    let mut output = StandardStream::stderr(color_choice);

    output.set_color(ColorSpec::new().set_fg(Some(color)).set_bold(true))?;
    if justified {
        write!(output, "{status:>12}")?;
    } else {
        write!(output, "{status}")?;
        output.set_color(ColorSpec::new().set_bold(true))?;
        write!(output, ":")?;
    }
    output.reset()?;
    writeln!(output, " {message}").with_context(|| "Failed to write message")?;
    Ok(())
}
```

### 2. Rule
Command metadata lookups MUST propagate graph resolution errors directly to the caller, and MUST NOT fall back to disconnected execution modes unless the user explicitly requested a disconnected/partial evaluation.

### 3. Architecture Principle
Preserve formatting by isolating AST mutations to Concrete Syntax Tree (CST) nodes, guaranteeing that unedited keys, table orderings, and comments remain untouched.

### 4. Failure Mode
Silent fallback degradation: an underlying graph discovery tool fails, but an automated fallback returns an empty or partial set, reporting success (status 0) while skipping required file updates.

### 5. Reusable Skill
*Manifest Upgrade Workflow for Autonomous Agents*:
1. Run target discovery using `cargo_metadata::MetadataCommand::new().exec()`.
2. Open target manifest using `toml_edit::ImDocumentMut::parse(raw_string)`.
3. Locate the dependency table: `root["dependencies"][dep_name]`.
4. Mutate version while preserving existing table style:
```rust
if let Some(dep_item) = doc.get_mut("dependencies").and_then(|d| d.get_mut(dep_name)) {
    if let Some(table) = dep_item.as_inline_table_mut() {
        table.insert("version", new_version.into());
    } else if dep_item.is_str() {
        *dep_item = toml_edit::Item::Value(new_version.into());
    }
}
```
5. Flush string representation to disk.
6. Re-run `cargo check` to verify lockfile consistency.

### 6. Decision: Rejection of Silent Fallback in `resolve_ws`
* **Alternative Considered**: Log a warning when `cmd.exec()` fails and proceed with `cmd.no_deps()`.
* **Rationale for Rejection**: Proceeding without dependencies makes it impossible to guarantee lockfile consistency. An explicit failure forces the user or CI pipeline to address