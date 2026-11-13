# Verification Protocol: Verification Protocol: Empirical Defect Shield for falkordb/falkordb

<!-- PROVENANCE_START
{
  "source_repository": "falkordb/falkordb",
  "source_url": "https://github.com/falkordb/falkordb",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [falkordb/falkordb](https://github.com/falkordb/falkordb) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `falkordb/falkordb` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `eaa238ef`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T16:35:43.507Z  
> **Learning ID**: `learn-github-falkordb-falkordb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): FalkorDB/FalkorDB

> **Canonical Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T16:35:43.276Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10511 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `graph/src/planner/optimizer/utilize_index.rs`
```
//! Index utilization optimizer pass.
//!
//! Scans the execution plan for `NodeByLabelScan` operators that sit below a
//! `Filter` on an indexed property, and replaces the pair with a single
//! `NodeByIndexScan` that pushes the predicate into the index engine.
//!
//! ## Supported Patterns
//!
//! **Single comparison filter:**
//!
//! ```text
//! Before:                       After:
//!
//! Filter(n.age = 30)            NodeByIndexScan(:Person, age, Equal(30))
//!   |
//!   v
//! NodeByLabelScan(:Person)
//! ```
//!
//! **AND filter with multiple indexed conjuncts:**
//!
//! When a Filter contains `AND(n.year >= 1980, n.year < 1990)`, the pass
//! merges both conjuncts into a single `Range` index query:
//!
//! ```text
//! Before:                         After:
//!
//! Filter(AND(year>=1980,          NodeByIndexScan(:Movie, year,
//!            year<1990))            Range{min:1980, max:1990})
//!   |
//!   v
//! NodeByLabelScan(:Movie)
//! ```
//!
//! If only some AND conjuncts are indexable, the indexable ones are merged
//! into the scan and the remaining conjuncts stay as a reduced Filter.
//!
//! **Inline node attributes** (e.g. `(n:Person {name: 'Alice'})`) need no path
//! of their own: the planner lowers them to an `IR::Filter` like any other
//! predicate, so they reach an index through the rewrite above.
//!
//! ## Supported operators and index types
//!
//! - Equality (`=`), less-than (`<`, `<=`), greater-than (`>`, `>=`)
//! - `distance()` function for point indexes
//! - Range indexes only (fulltext indexes are handled separately)

use std::sync::Arc;

use orx_tree::{Bfs, Dyn, DynTree, NodeIdx, NodeRef};

use crate::{
    graph::graph::Graph,
    index::{
        Index,
        indexer::{IndexQuery, IndexType},
    },
    parser::ast::{ExprIR, QueryExpr, QueryNode, Variable},
    runtime::functions::{FnType, get_functions},
    tree,
};

use super::super::IR;
use super::references::index_query_references_variable;

use crate::parser::ast::QueryRelationship;
use crate::runtime::orderset::OrderSet;
use crate::runtime::value::Value;

/// Build a `hasLabels(variable, [label1, label2, ...])` filter expression.
fn build_has_labels_filter(
    var: &Variable,
    labels: impl Iterator<Item = Arc<String>>,
) -> QueryExpr<Variable> {
    let has_labels_fn = get_functions()
        .get("hasLabels", &FnType::Function)
        .expect("hasLabels function must exist");
    Arc::new(tree!(
        ExprIR::FuncInvocation(has_labels_fn),
        tree!(ExprIR::Variable(var.clone())),
        tree!(ExprIR::List; labels.map(|l| tree!(ExprIR::Constant(Value::String(l)))))
    ))
}

/// Result of a single-predicate index-scan attempt: the pattern
/// subject (node or relationship), the label/type the index lives on,
/// and the query pushed into the index engine.
type Scan<T> = Option<(T, Arc<String>, IndexQuery<QueryExpr<Variable>>)>;

/// Shared interface for the two pattern kinds that can back an index
/// scan (node labels and relationship types). Every kind-specific
/// decision in the utilization passes — which IR variant to match,
/// which IR variant to emit, which indexer to query, and whether
/// function-based predicates like `distance()` are supported — lives
/// here so the passes themselves are uniform.
trait IndexSubject: Clone {
    /// Kind-specific metadata threaded through a rewrite: `()` for
    /// nodes, `bool` (the `transposed` flag) for edges.
    type Metadata: Copy;

    fn alias(&self) -> &Variable;

    /// All labels/types on the pattern — iterated to find an indexed
    /// label/type match.
    fn all_labels(&self) -> Box<dyn Iterator<Item = &Arc<String>> + '_>;

    /// Look up the appropriate indexer (node vs edge) on the graph.
    fn is_indexed(
        graph: &Graph,
        label: &Arc<String>,
        attr: &Arc<String>,
        ty: &IndexType,
    ) -> bool;

    /// Subject-specific hook for function-based predicates. Node impl
    /// delegates to `try_distance_index_scan`; edge impl returns `None`
    /// (no edge-distance path is exercised today).
    fn try_func_scan(
        subject: &Self,
        attr: &Arc<String>,
        filter: &DynTree<ExprIR<Variable>>,
        attr_side: NodeIdx<Dyn<ExprIR<Variable>>>,
        constant_node: DynTree<ExprIR<Variable>>,
        label: Arc<String>,
    ) -> Scan<Self>;

    /// Recognize the IR variant that's a candidate for an index scan
    /// (`NodeByLabelScan` for nodes, `CondTraverse` for edges). Returns
    /// `None` if the variant doesn't match or if `labels` / `types` is
    /// empty (no scan target to push the filter into).
    fn match_scan_source(ir: &IR) -> Option<(Self, Self::Metadata)>;

    /// Build the replacement IR after a successful pushdown
    /// (`NodeByIndexScan` or `EdgeByIndexScan`).
    fn build_scan_ir(
        self,
        index: Arc<String>,
        query: Arc<IndexQuery<QueryExpr<Variable>>>,
        metadata: Self::Metadata,
    ) -> IR;

    /// Returns a copy of the subject whose labels/types list places
    /// `label` first. The runtime index-scan ops treat `labels[0]` /
    /// `types[0]` as the index key and post-filter the rest.
    fn with_primary_label(
        &self,
        label: &Arc<String>,
    ) -> Self;
}

impl IndexSubject for Arc<QueryNode<Arc<String>, Variable>> {
    type Metadata = ();

    fn alias(&self) -> &Variable {
        &self.alias
    }
    fn all_labels(&self) -> Box<dyn Iterator<Item = &Arc<String>> + '_> {
        Box::new(self.labels.iter())
    }
    fn is_indexed(
        graph: &Graph,
        label: &Arc<String>,
        attr: &Arc<String>,
        ty: &IndexType,
    ) -> bool {
        graph.is_indexed(label, attr, ty)
    }
    fn try_func_scan(
        subject: &Self,
        attr: &Arc<String>,
        filter: &DynTree<ExprIR<Variable>>,
        attr_side: NodeIdx<Dyn<ExprIR<Variable>>>,
        constant_node: DynTree<ExprIR<Variable>>,
        label: Arc<String>,
    ) -> Scan<Self> {
        try_distance_index_scan(subject, attr, filter, attr_side, constant_node, label)
    }
    fn match_scan_source(ir: &IR) -> Option<(Self, Self::Metadata)> {
        let IR::NodeByLabelScan { node } = ir else {
            return None;
        };
        if node.labels.is_empty() {
            return None;
        }
        Some((node.clone(), ()))
    }
    fn build_scan_ir(
        self,
        index: Arc<String>,
        query: Arc<IndexQuery<QueryExpr<Variable>>>,
        _metadata: (),
    ) -> IR {
        IR::NodeByIndexScan {
            node: self,
            index,
            query,
        }
    }
    fn with_primary_label(
        &self,
        label: &Arc<String>,
    ) -> Self {
        let mut reordered = OrderSet::default();
        reordered.insert(label.clone());
        for l in self.labels.iter() {
            if l != label {
                reordered.insert(l.clone());
            }
        }
        Self::new(QueryNode::new(
            self.alias.clone(),
            reordered,
            self.attrs.clone(),
        ))
    }
}

impl IndexSubject for Arc<QueryRelationship<Arc<String>, Arc<String>, Variable>> {
    type Metadata = bool; // transposed

    fn alias(&self) -> &Variable {
        &self.alias
    }
    fn all_labels(&self) -> Box<dyn Iterator<Item = &Arc<String>> + '_> {
        Box::new(self.types.iter())
    }
    fn is_indexed(
        graph: &Graph,
        label: &Arc<String>,
        attr: &Arc<String>,
        ty: &IndexType,
    ) -> bool {
        graph.is_edge_indexed(label, attr, ty)
    }
    fn try_func_scan(
        _subject: &Self,
        _attr: &Arc<String>,
        _filter: &DynTree<ExprIR<Variable>>,
        _attr_side: NodeIdx<Dyn<ExprIR<Variable>>>,
        _constant_node: DynTree<ExprIR<Variable>>,
        _label: Arc<String>,
    ) -> Scan<Self> {
        None
    }
    fn match_scan_source(ir: &IR) -> Option<(Self, Self::Metadata)> {
        let IR::CondTraverse {
            relationship,
            transposed,
            sibling_edges,
            ..
        } = ir
        else {
            return None;
        };
        // EdgeByIndexScan can only faithfully replace CondTraverse when
        // the pattern has exactly one relationship type — matches
        // FalkorDB C's `utilize_indices.c:reduce_cond_op` gate
        // (`QGEdge_RelationCount(e) != 1`). A multi-type `[:A|B]`
        // pattern would require a UNION over two separate indexes
        // which this operator doesn't implement.
        if relationship.types.len() != 1 {
            return None;
        }
        // `sibling_edges` always includes the edge's own alias for
        // named edges; a real uniqueness constraint means at least one
        // sibling alias that *isn't* this edge's own alias. When that
        // constraint is present, CondTraverseOp enforces it — our op
        // doesn't, so bail.
        if sibling_edges.iter().any(|&id| id != relationship.alias.id) {
            return None;
        }
        Some((relationship.clone(), *transposed))
    }
    fn build_scan_ir(
        self,
        _index: Arc<String>,
        query: Arc<IndexQuery<QueryExpr<Variable>>>,
        transposed: bool,
    ) -> IR {
        IR::EdgeByIndexScan {
            relationship: self,
            query,
            transposed,
        }
    }
    fn with_primary_label(
        &self,
        label: &Arc<String>,
    ) -> Self {
        let mut reordered = Vec::with_capacity(self.types.len());
        reordered.push(label.clone());
        for t in &self.types {
            if t != label {
                reordered.push(t.clone());
            }
        }
        let mut new_rel = QueryRelationship::new(
            self.alias.clone(),
            reordered,
            self.attrs.clone(),
            self.from.clone(),
            self.to.clone(),
            self.bidirectional,
            self.min_hops,
            self.max_hops,
        );
        new_rel.all_shortest_paths = self.all_shortest_paths;
        Self::new(new_rel
```

### Core Architecture Module: `graph/src/planner/optimizer/utilize_node_by_id.rs`
```
//! Node-by-ID optimization pass.
//!
//! Replaces a label scan (or all-node scan) paired with an `id()` filter by a
//! direct ID lookup operator, avoiding a full scan of the label matrix.
//!
//! ## Transformations
//!
//! **Labeled node with ID filter:**
//!
//! ```text
//! Before:                          After:
//!
//! Filter(id(n) = 42)               NodeByLabelAndIdScan(:Person, id=42)
//!   |
//!   v
//! NodeByLabelScan(:Person)
//! ```
//!
//! **Unlabeled node with ID filter:**
//!
//! ```text
//! Before:                          After:
//!
//! Filter(id(n) = 42)               NodeByIdSeek(id=42)
//!   |
//!   v
//! AllNodeScan
//! ```
//!
//! **AND filter with multiple ID predicates:**
//!
//! When the filter is an AND of several `id()` comparisons (e.g.
//! `id(n) >= 10 AND id(n) < 20`), all conjuncts are collected into the
//! lookup operator's filter list. If any AND conjunct is not an `id()`
//! comparison the optimization is skipped entirely.
//!
//! ## Supported operators
//!
//! The `id()` comparison may use `=`, `<`, `<=`, `>`, or `>=`. When the
//! `id()` call appears on the right-hand side, the comparison is flipped
//! so the operator always describes "id <op> value".

use std::sync::Arc;

use orx_tree::{Bfs, DynNode, DynTree, NodeRef};

use crate::parser::ast::{ExprIR, QueryExpr, Variable};

use super::super::IR;
use super::references::subtree_references_variable;

fn get_id_filter(
    filter: &DynNode<ExprIR<Variable>>,
    node_alias: &Variable,
) -> Option<(QueryExpr<Variable>, ExprIR<Variable>)> {
    if matches!(
        filter.data(),
        ExprIR::Eq | ExprIR::Gt | ExprIR::Ge | ExprIR::Lt | ExprIR::Le
    ) && let ExprIR::FuncInvocation(inner_func) = filter.child(0).data()
        && inner_func.name == "id"
        && let ExprIR::Variable(var) = filter.child(0).child(0).data()
        && var.id == node_alias.id
        && var.scope_id == node_alias.scope_id
        && !subtree_references_variable(&filter.child(1), node_alias.id, node_alias.scope_id)
    {
        Some((
            Arc::new(filter.child(1).clone_as_tree()),
            filter.data().clone(),
        ))
    } else if matches!(
        filter.data(),
        ExprIR::Eq | ExprIR::Gt | ExprIR::Ge | ExprIR::Lt | ExprIR::Le
    ) && let ExprIR::FuncInvocation(inner_func) = filter.child(1).data()
        && inner_func.name == "id"
        && let ExprIR::Variable(var) = filter.child(1).child(0).data()
        && var.id == node_alias.id
        && var.scope_id == node_alias.scope_id
        && !subtree_references_variable(&filter.child(0), node_alias.id, node_alias.scope_id)
    {
        let op = match filter.data() {
            ExprIR::Eq => ExprIR::Eq,
            ExprIR::Gt => ExprIR::Lt,
            ExprIR::Ge => ExprIR::Le,
            ExprIR::Lt => ExprIR::Gt,
            ExprIR::Le => ExprIR::Ge,
            _ => unreachable!(),
        };
        Some((Arc::new(filter.child(0).clone_as_tree()), op))
    } else {
        None
    }
}

/// Replaces label scan + ID filter with direct node ID lookup.
pub(super) fn utilize_node_by_id(optimized_plan: &mut DynTree<IR>) {
    loop {
        let mut changed = false;
        let indices = optimized_plan.root().indices::<Bfs>().collect::<Vec<_>>();

        for idx in indices {
            let mut filters = vec![];
            let node = match optimized_plan.node(idx).data() {
                IR::NodeByLabelScan { node } | IR::AllNodeScan(node) => node.clone(),
                _ => continue,
            };
            if let IR::Filter(filter) = optimized_plan.node(idx).parent().unwrap().data() {
                if let Some((id, op)) = get_id_filter(&filter.root(), &node.alias) {
                    filters.push((id, op));
                } else if matches!(filter.root().data(), ExprIR::And) {
                    for child in filter.root().children() {
                        if let Some((id, op)) = get_id_filter(&child, &node.alias) {
                            filters.push((id, op));
                        } else {
                            filters.clear();
                            break;
                        }
                    }
                }
            }
            if !filters.is_empty() {
                let mut new_op = optimized_plan.node_mut(idx);
                if node.labels.is_empty() {
                    *new_op.data_mut() = IR::NodeByIdSeek {
                        node: node.clone(),
                        filter: filters,
                    };
                } else {
                    *new_op.data_mut() = IR::NodeByLabelAndIdScan {
                        node: node.clone(),
                        filter: filters,
                    };
                }
                new_op.parent_mut().unwrap().take_out();
                changed = true;
                break; // Restart traversal after structural modification
            }
        }

        if !changed {
            break;
        }
    }
}

```

### Core Architecture Module: `native-deps/src/util.rs`
```
//! Filesystem, process and platform helpers.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs;
use std::os::fd::AsFd;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{Error, Result};
use crate::hash::collect_files;
use crate::{bail, err};

/// Run a command, streaming its output, and fail if it exits non-zero.
pub fn run(
    program: &str,
    args: &[&OsStr],
    cwd: &Path,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    spawn(program, args, cwd, env, false)
}

/// [`run`] for a recipe: without the variables Cargo sets for a build script
/// or reads to steer a build (see [`is_cargo_build_var`]).
///
/// Recipes run inside `graph/build.rs`. Inherited, those variables reach
/// RediSearch's own Cargo build -- an instrumented outer build's
/// `CARGO_ENCODED_RUSTFLAGS`, say -- and change its output without changing
/// the key it is published under.
pub fn run_isolated(
    program: &str,
    args: &[&OsStr],
    cwd: &Path,
    env: &BTreeMap<String, String>,
) -> Result<()> {
    spawn(program, args, cwd, env, true)
}

/// A variable Cargo sets for build scripts, or that steers a Cargo build.
/// Network and registry configuration is kept: it changes how crates are
/// fetched, not what they build into.
#[must_use]
pub fn is_cargo_build_var(name: &str) -> bool {
    const KEEP: [&str; 5] = [
        "CARGO_HOME",
        "CARGO_NET_",
        "CARGO_HTTP_",
        "CARGO_REGISTRIES_",
        "CARGO_REGISTRY_",
    ];
    const EXACT: [&str; 13] = [
        "CARGO",
        "RUSTFLAGS",
        "RUSTDOCFLAGS",
        "RUSTC",
        "RUSTDOC",
        "RUSTC_WRAPPER",
        "RUSTC_WORKSPACE_WRAPPER",
        "RUSTC_LINKER",
        "TARGET",
        "HOST",
        "OUT_DIR",
        "NUM_JOBS",
        "OPT_LEVEL",
    ];
    if KEEP.iter().any(|k| name.starts_with(k)) {
        return false;
    }
    name.starts_with("CARGO_") || name.starts_with("DEP_") || EXACT.contains(&name)
}

fn spawn(
    program: &str,
    args: &[&OsStr],
    cwd: &Path,
    env: &BTreeMap<String, String>,
    isolated: bool,
) -> Result<()> {
    let rendered = render_cmd(program, args);
    log(&format!("$ {rendered}"));

    let mut cmd = Command::new(program);
    cmd.args(args).current_dir(cwd);
    if isolated {
        for (name, _) in std::env::vars_os() {
            if name.to_str().is_some_and(is_cargo_build_var) {
                cmd.env_remove(&name);
            }
        }
    }
    for (k, v) in env {
        cmd.env(k, v);
    }
    // Send the child's stdout to *our* stderr. When this crate runs inside
    // `graph/build.rs`, cargo reads the build script's stdout looking for
    // `cargo:` directives, and a cmake log has no business in that stream.
    if let Ok(stderr) = std::io::stderr().as_fd().try_clone_to_owned() {
        cmd.stdout(std::process::Stdio::from(stderr));
    }
    let status = cmd
        .status()
        .map_err(|e| err!("failed to spawn `{rendered}`: {e}"))?;
    if !status.success() {
        bail!("`{rendered}` failed with {status}");
    }
    Ok(())
}

/// Run a command and capture stdout. Non-zero exit is an error.
pub fn capture(
    program: &str,
    args: &[&str],
    cwd: Option<&Path>,
) -> Result<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let out = cmd
        .output()
        .map_err(|e| err!("failed to spawn `{program}`: {e}"))?;
    if !out.status.success() {
        bail!(
            "`{} {}` failed: {}",
            program,
            args.join(" "),
            String::from_utf8_lossy(&out.stderr).trim()
        );
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Like [`capture`] but returns `None` instead of an error when the program is
/// missing or fails. Used for best-effort probes that feed the cache key.
pub fn capture_opt(
    program: &str,
    args: &[&str],
) -> Option<String> {
    capture(program, args, None).ok()
}

fn render_cmd(
    program: &str,
    args: &[&OsStr],
) -> String {
    let mut s = program.to_owned();
    for a in args {
        s.push(' ');
        s.push_str(&a.to_string_lossy());
    }
    s
}

/// Progress output. Goes to stderr so `native-deps key --json` stdout stays
/// machine-readable, and so a build script's stdout is never polluted with
/// anything cargo would try to interpret as a directive.
pub fn log(msg: &str) {
    eprintln!("native-deps: {msg}");
}

/// Copy a single file, creating the destination's parent directory.
pub fn copy_file(
    src: &Path,
    dst: &Path,
) -> Result<()> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    // Remove first: `fs::copy` onto an existing read-only file (cmake installs
    // some headers 0444) fails with EACCES.
    let _ = fs::remove_file(dst);
    fs::copy(src, dst)
        .map_err(|e| err!("cannot copy {} -> {}: {e}", src.display(), dst.display()))?;
    Ok(())
}

/// Recursively collect every `.a` archive under `dir`, sorted so link order is
/// deterministic. An unreadable directory is an error, not "no archives": an
/// entry stamped from a partial listing would fail later, at link time.
pub fn find_archives(dir: &Path) -> Result<Vec<PathBuf>> {
    let mut out = collect_files(dir).map_err(|e| err!("cannot list {}: {e}", dir.display()))?;
    out.retain(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("a")));
    out.sort();
    Ok(out)
}

/// Parallelism for `cmake --build -j`. Honours `JOBS` for parity with the shell
/// scripts this crate replaced.
pub fn jobs() -> usize {
    if let Ok(j) = std::env::var("JOBS")
        && let Ok(n) = j.trim().parse::<usize>()
        && n > 0
    {
        return n;
    }
    std::thread::available_parallelism().map_or(2, std::num::NonZeroUsize::get)
}

/// The host target triple.
///
/// Build scripts get `TARGET` for free. The standalone binary has to ask rustc,
/// and falls back to `uname` so a machine without rustc on PATH still produces a
/// stable (if less precise) key rather than failing outright.
pub fn host_triple() -> String {
    if let Ok(t) = std::env::var("TARGET") {
        return t;
    }
    if let Some(out) = capture_opt("rustc", &["-vV"])
        && let Some(host) = out
            .lines()
            .find_map(|l| l.strip_prefix("host: "))
            .map(str::trim)
        && !host.is_empty()
    {
        return host.to_owned();
    }
    let arch = capture_opt("uname", &["-m"]).unwrap_or_default();
    let os = capture_opt("uname", &["-s"]).unwrap_or_default();
    format!("{}-{}", arch.trim(), os.trim().to_lowercase())
}

/// First line of `<program> --version`, the compiler-identity component of the
/// cache key. `None` when the program cannot be run at all.
pub fn version_line(program: &str) -> Option<String> {
    let out = capture_opt(program, &["--version"])?;
    out.lines()
        .next()
        .map(|l| l.trim().to_owned())
        .filter(|l| !l.is_empty())
}

/// Seconds since the Unix epoch.
pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// Walk up from `start` looking for the FalkorDB checkout root, identified by
/// `deps/native-deps.lock`.
///
/// `FALKORDB_REPO_ROOT` short-circuits this, which is how the Docker dep stages
/// point at their minimal context.
pub fn find_repo_root(start: &Path) -> Result<PathBuf> {
    if let Ok(explicit) = std::env::var("FALKORDB_REPO_ROOT") {
        let p = PathBuf::from(explicit);
        if p.join("deps/native-deps.lock").is_file() {
            return Ok(p);
        }
        bail!(
            "FALKORDB_REPO_ROOT={} does not contain deps/native-deps.lock",
            p.display()
        );
    }
    let mut dir: Option<&Path> = Some(start);
    while let Some(d) = dir {
        if d.join("deps/native-deps.lock").is_file() {
            return Ok(d.to_path_buf());
        }
        dir = d.parent();
    }
    Err(Error(format!(
        "could not find deps/native-deps.lock walking up from {}; \
         set FALKORDB_REPO_ROOT to the FalkorDB checkout",
        start.display()
    )))
}

/// `true` when the environment variable is set to something other than `0`,
/// `false`, `no`, `off` or the empty string.
pub fn env_flag(name: &str) -> bool {
    std::env::var(name).is_ok_and(|v| {
        let v = v.trim().to_ascii_lowercase();
        !matches!(v.as_str(), "" | "0" | "false" | "no" | "off")
    })
}

/// Non-empty environment variable, or `None`.
pub fn env_opt(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
}

/// Is `path` one of the vendored GraphBLAS PreJIT kernels?
///
/// SHARED ON PURPOSE. Two callers must agree on this exactly:
///   * `key::KeyContext::manifest`, which hashes the kernel set into the
///     GraphBLAS cache key, and
///   * `recipes::graphblas::vendor_prejit`, which copies that set into the
///     source tree before the build.
///
/// If the two predicates drifted, the key would stop covering what is actually
/// baked into libgraphblas.a -- i.e. a stale-ABI cache hit, the exact failure
/// this cache exists to prevent. One definition makes that drift impossible.
#[must_use]
pub fn is_prejit_kernel(path: &Path) -> bool {
    path.extension().is_some_and(|e| e == "c")
        && path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with("GB_jit_"))
}

#[cfg(test)]
mod tests {
    use super::is_cargo_build_var;

    #[test]
    fn cargo_build_vars_are_recognised() {
        for v in [
            "CARGO_ENCODED_RUSTFLAGS",
            "CARGO_MANIFEST_DIR",
            "CARGO_FEATURE_PREJIT_HARVEST",
            "CARGO_TARGET_DIR",
            "RUSTFLAGS",
            "RUSTC_WRAPPER",
            "TARGET",
            "OUT_DIR",
            "DEP_Z_INCLUD
```

### Core Architecture Module: `proofs/runtime_core/repro_3439.py`
```
"""Live repro for #3439 (RuntimeCore.Proto.writer_reply_race, pre-existing on main).

Usage: python repro_3439.py PORT SECONDS N_QUEUED_WRITERS N_INLINE_FAILING_WRITERS N_READERS
Setup first: GRAPH.QUERY g "CREATE INDEX FOR (n:L) ON (n.v)".
`repro_3439.py P 60 2 1 0` crashes the Rust server ("already immutably borrowed" in
Pending::resync_published_indexes); C survives. `repro_3439.py P 60 0 2 6` exercises
resync against PR #3436 read guards (no panic expected).
"""
import sys, threading, time, redis
port = int(sys.argv[1]); dur = float(sys.argv[2])
stop = time.time() + dur
stats = {"w1": 0, "w2": 0, "rd": 0, "err": [], "w1_bad": 0}
lock = threading.Lock()
def note(k, e=None):
    with lock:
        if e is None: stats[k] += 1
        else:
            if len(stats["err"]) < 20: stats["err"].append(f"{k}: {e!r}"[:300])
def w1():
    r = redis.Redis(port=port, socket_timeout=30)
    while time.time() < stop:
        try:
            res = r.execute_command("GRAPH.QUERY", "g", "CREATE (x:Q {p0:0, p1:1, p2:2, p3:3, p4:4, p5:5, p6:6, p7:7, p8:8, p9:9, p10:10, p11:11, p12:12, p13:13, p14:14, p15:15, p16:16, p17:17, p18:18, p19:19, p20:20, p21:21, p22:22, p23:23, p24:24, p25:25, p26:26, p27:27, p28:28, p29:29, p30:30, p31:31, p32:32, p33:33, p34:34, p35:35, p36:36, p37:37, p38:38, p39:39, p40:40, p41:41, p42:42, p43:43, p44:44, p45:45, p46:46, p47:47, p48:48, p49:49, p50:50, p51:51, p52:52, p53:53, p54:54, p55:55, p56:56, p57:57, p58:58, p59:59, p60:60, p61:61, p62:62, p63:63, p64:64, p65:65, p66:66, p67:67, p68:68, p69:69, p70:70, p71:71, p72:72, p73:73, p74:74, p75:75, p76:76, p77:77, p78:78, p79:79, p80:80, p81:81, p82:82, p83:83, p84:84, p85:85, p86:86, p87:87, p88:88, p89:89, p90:90, p91:91, p92:92, p93:93, p94:94, p95:95, p96:96, p97:97, p98:98, p99:99, p100:100, p101:101, p102:102, p103:103, p104:104, p105:105, p106:106, p107:107, p108:108, p109:109, p110:110, p111:111, p112:112, p113:113, p114:114, p115:115, p116:116, p117:117, p118:118, p119:119, p120:120, p121:121, p122:122, p123:123, p124:124, p125:125, p126:126, p127:127, p128:128, p129:129, p130:130, p131:131, p132:132, p133:133, p134:134, p135:135, p136:136, p137:137, p138:138, p139:139, p140:140, p141:141, p142:142, p143:143, p144:144, p145:145, p146:146, p147:147, p148:148, p149:149, p150:150, p151:151, p152:152, p153:153, p154:154, p155:155, p156:156, p157:157, p158:158, p159:159, p160:160, p161:161, p162:162, p163:163, p164:164, p165:165, p166:166, p167:167, p168:168, p169:169, p170:170, p171:171, p172:172, p173:173, p174:174, p175:175, p176:176, p177:177, p178:178, p179:179, p180:180, p181:181, p182:182, p183:183, p184:184, p185:185, p186:186, p187:187, p188:188, p189:189, p190:190, p191:191, p192:192, p193:193, p194:194, p195:195, p196:196, p197:197, p198:198, p199:199, p200:200, p201:201, p202:202, p203:203, p204:204, p205:205, p206:206, p207:207, p208:208, p209:209, p210:210, p211:211, p212:212, p213:213, p214:214, p215:215, p216:216, p217:217, p218:218, p219:219, p220:220, p221:221, p222:222, p223:223, p224:224, p225:225, p226:226, p227:227, p228:228, p229:229, p230:230, p231:231, p232:232, p233:233, p234:234, p235:235, p236:236, p237:237, p238:238, p239:239, p240:240, p241:241, p242:242, p243:243, p244:244, p245:245, p246:246, p247:247, p248:248, p249:249, p250:250, p251:251, p252:252, p253:253, p254:254, p255:255, p256:256, p257:257, p258:258, p259:259, p260:260, p261:261, p262:262, p263:263, p264:264, p265:265, p266:266, p267:267, p268:268, p269:269, p270:270, p271:271, p272:272, p273:273, p274:274, p275:275, p276:276, p277:277, p278:278, p279:279, p280:280, p281:281, p282:282, p283:283, p284:284, p285:285, p286:286, p287:287, p288:288, p289:289, p290:290, p291:291, p292:292, p293:293, p294:294, p295:295, p296:296, p297:297, p298:298, p299:299}) WITH x UNWIND range(1,3000) AS i RETURN x")
            note("w1")
        except Exception as e:
            note("w1_err", e); stats["w1_bad"] += 1
def w2():
    r = redis.Redis(port=port, socket_timeout=30)
    i = 0
    while time.time() < stop:
        i += 1
        try:
            p = r.pipeline(transaction=True)
            p.execute_command("GRAPH.QUERY", "g", f"CREATE (n:L {{v: {i}}}) WITH n RETURN 1/0")
            res = p.execute(raise_on_error=False)
            if isinstance(res[0], Exception) and "Division by zero" in str(res[0]): note("w2")
            else: note("w2_err", res[0])
        except redis.ResponseError as e:
            if "Division by zero" in str(e): note("w2")
            else: note("w2_err", e)
        except Exception as e:
            note("w2_err", e)
def rd():
    r = redis.Redis(port=port, socket_timeout=30)
    while time.time() < stop:
        try:
            r.execute_command("GRAPH.RO_QUERY", "g", "MATCH (n:L) WHERE n.v > 0 RETURN count(n)")
            r.execute_command("GRAPH.RO_QUERY", "g", "MATCH (x:Q) RETURN x.p, labels(x) LIMIT 2000")
            note("rd")
        except Exception as e:
            note("rd_err", e)
ts = [threading.Thread(target=w1) for _ in range(int(sys.argv[3]))] + [threading.Thread(target=w2) for _ in range(int(sys.argv[4]))] + [threading.Thread(target=rd) for _ in range(int(sys.argv[5]))]
for t in ts: t.start()
for t in ts: t.join()
print(stats)
try: print("ping", redis.Redis(port=port, socket_timeout=5).ping())
except Exception as e: print("ping failed", e)

```

### Core Architecture Module: `proofs/search_concurrency/repro/flood.py`
```
# Flood one graph with N concurrent writes (one per connection), then probe liveness.
import asyncio, sys, time, redis
port=int(sys.argv[1]); N=int(sys.argv[2]); Q=sys.argv[3] if len(sys.argv)>3 else "UNWIND range(1,20000) AS x CREATE (:N)"
def enc(*a):
    s=f"*{len(a)}\r\n"
    for x in a:
        b=x.encode(); s+=f"${len(b)}\r\n"+x+"\r\n"
    return s.encode()
done=0; errs={}
async def one(i):
    global done
    w=None
    try:
        r,w=await asyncio.open_connection('127.0.0.1',port)
        w.write(enc("GRAPH.QUERY","fl",Q)); await w.drain()
        line=await r.readline()
        if line==b'': errs[b'EOF without a reply']=errs.get(b'EOF without a reply',0)+1
        elif line.startswith(b'-'): errs[line[:80]]=errs.get(line[:80],0)+1
    except Exception as e:
        k=repr(e)[:80].encode(); errs[k]=errs.get(k,0)+1
    finally:
        done+=1           # one per task, whatever happened
        if w is not None: w.close()
async def main():
    tasks=[asyncio.create_task(one(i)) for i in range(N)]
    t0=time.time()
    deadline=float(sys.argv[4]) if len(sys.argv)>4 else 60.0
    while time.time()-t0<deadline:
        await asyncio.sleep(2)
        def probe():
            try: return redis.Redis(port=port,socket_timeout=2).ping()
            except Exception as e: return repr(e)[:60]
        ok=await asyncio.to_thread(probe)   # off the loop thread: reads and `done` keep moving
        print(f"t={time.time()-t0:.0f}s done={done}/{N} ping={ok} errs={errs}",flush=True)
        if done==N: break
    for t in tasks: t.cancel()
asyncio.run(main())

```

### Core Architecture Module: `proofs/search_concurrency/repro/flood2.py`
```
# N concurrent writes spread over G graphs (each graph gets < 1024 writes), then probe liveness.
import asyncio, sys, time
port=int(sys.argv[1]); N=int(sys.argv[2]); G=int(sys.argv[3]); Q=sys.argv[4]; DUR=float(sys.argv[5])
def enc(*a):
    s=f"*{len(a)}\r\n"
    for x in a: s+=f"${len(x.encode())}\r\n"+x+"\r\n"
    return s.encode()
done=0; errs={}
async def one(i):
    global done
    w=None
    try:
        r,w=await asyncio.open_connection('127.0.0.1',port)
        w.write(enc("GRAPH.QUERY",f"g{i%G}",Q)); await w.drain()
        line=await r.readline()
        if line==b'': errs[b'EOF without a reply']=errs.get(b'EOF without a reply',0)+1
        elif line.startswith(b'-'): errs[line[:60]]=errs.get(line[:60],0)+1
    except Exception as e:
        k=repr(e)[:60].encode(); errs[k]=errs.get(k,0)+1
    finally:
        done+=1           # one per task, whatever happened
        if w is not None: w.close()
async def ping():
    async def go():
        r,w=await asyncio.open_connection('127.0.0.1',port)
        try:
            w.write(b"PING\r\n"); await w.drain()
            return (await r.readline()).strip()
        finally: w.close()
    try: return await asyncio.wait_for(go(),2)   # connect, write and read all inside the 2 s
    except Exception as e: return repr(e)[:30] or 'TimeoutError'
async def main():
    tasks=[asyncio.create_task(one(i)) for i in range(N)]
    t0=time.time()
    while time.time()-t0<DUR:
        await asyncio.sleep(3)
        print(f"t={time.time()-t0:.0f}s done={done}/{N} ping={await ping()} errs={errs}",flush=True)
        if done==N: break
asyncio.run(main())

```

### Core Architecture Module: `proofs/search_concurrency/repro/multi_race.py`
```
import redis, threading, time, sys
port = int(sys.argv[1])
r = redis.Redis(port=port, socket_timeout=60)
r.execute_command("GRAPH.DELETE", "mr") if r.exists("mr") else None
r.execute_command("GRAPH.QUERY", "mr", "CREATE (:Seed)")
res = {}
def slow():
    t=time.time()
    try:
        out = r2.execute_command("GRAPH.QUERY", "mr", "UNWIND range(1,4000000) AS x WITH count(x) AS c CREATE (:N {c:c})")
        res['slow'] = out[1] if len(out) > 1 else out[0]   # no RETURN: the reply is [stats] only
    except Exception as e:
        res['slow'] = 'ERR ' + str(e)
    res['slow_t'] = time.time()-t
    res['slow_end'] = time.time()
r2 = redis.Redis(port=port, socket_timeout=60)
th = threading.Thread(target=slow); th.start()
time.sleep(0.05)
t_multi = time.time()
p = r.pipeline(transaction=True)
p.execute_command("GRAPH.QUERY", "mr", "CREATE (:M)")
try:
    out = p.execute(raise_on_error=False)
    res['multi'] = [str(x)[:120] for x in out]
except Exception as e:
    res['multi'] = 'ERR ' + str(e)
res['multi_end'] = time.time()
th.join()
# The race needs the MULTI to return while the slow write is still running; say so, or the
# 'multi' line below proves nothing (a fixed 50 ms sleep does not guarantee it).
res['overlap'] = res['multi_end'] < res.get('slow_end', float('inf'))
res['multi_t'] = round(res['multi_end'] - t_multi, 3)
res['slow_t'] = round(res.get('slow_t', -1), 3)
del res['multi_end'], res['slow_end']
if not res['overlap']:
    print("WARNING: the MULTI finished after the slow write; this run did not exercise the race", file=sys.stderr)
res['count'] = r.execute_command("GRAPH.QUERY", "mr", "MATCH (n) RETURN labels(n)[0], count(n) ORDER BY labels(n)[0]")[1]
print(port, res)

```

### Core Architecture Module: `proofs/search_concurrency/repro/poprace.py`
```
# Index population vs concurrent writer: after quiescence the index must agree with a scan.
import redis, threading, time, sys, random
from redis.retry import Retry
from redis.backoff import NoBackoff
port=int(sys.argv[1]); N=int(sys.argv[2]); ROUNDS=int(sys.argv[3])
def conn(): return redis.Redis(port=port, socket_timeout=300, retry=Retry(NoBackoff(),0))
r=conn()
if r.exists("pr"): r.execute_command("GRAPH.DELETE","pr")
r.execute_command("GRAPH.QUERY","pr",f"UNWIND range(0,{N-1}) AS x CREATE (:L {{k:x, v:0}})")
bad=0
for rnd in range(ROUNDS):
    stop=False
    wfail=[]
    def w():
        try:
            c=conn(); i=0
            while not stop:
                m=random.randrange(50)
                c.execute_command("GRAPH.QUERY","pr",f"MATCH (n:L) WHERE n.k % 50 = {m} SET n.v = n.v + 1"); i+=1
        except Exception as e:
            wfail.append(repr(e)[:80])
    # daemon: if this round raises, the writer must not keep the process alive
    t=threading.Thread(target=w, daemon=True); t.start()
    time.sleep(0.05)
    r.execute_command("GRAPH.QUERY","pr","CREATE INDEX FOR (n:L) ON (n.v)")
    # wait for population
    while True:
        st=r.execute_command("GRAPH.QUERY","pr","CALL db.indexes() YIELD status RETURN status")[1]
        if st and st[0][0]==b'OPERATIONAL': break
        time.sleep(0.01)
    time.sleep(0.2); stop=True; t.join()
    if wfail:   # the writer died: this round did not race the index build
        print(f"round {rnd}: WRITER FAILED {wfail[0]}", flush=True); bad+=1
        r.execute_command("GRAPH.QUERY","pr","DROP INDEX FOR (n:L) ON (n.v)"); continue
    vals=r.execute_command("GRAPH.QUERY","pr","MATCH (n:L) RETURN n.v, count(n) ORDER BY n.v")[1]
    mism=[]
    for v,c in vals:
        ci=r.execute_command("GRAPH.QUERY","pr",f"MATCH (n:L) WHERE n.v = {v} RETURN count(n)")[1][0][0]
        if ci!=c: mism.append((v,c,ci))
    # also: index hits whose actual value differs. Not vacuous: `n.v = q` is served by the
    # index (Node By Index Scan in GRAPH.EXPLAIN), and the `WITH ... WHERE n.v <> q` filter after
    # the WITH re-reads the node's stored property, so a stale index entry shows up here.
    wrong=r.execute_command("GRAPH.QUERY","pr","UNWIND range(0,200) AS q MATCH (n:L) WHERE n.v = q WITH q, n WHERE n.v <> q RETURN count(n)")[1][0][0]
    print(f"round {rnd}: distinct v={len(vals)} mismatches={mism[:5]} n_mism={len(mism)} wrong_hits={wrong}", flush=True)
    bad+=len(mism)>0 or wrong>0
    r.execute_command("GRAPH.QUERY","pr","DROP INDEX FOR (n:L) ON (n.v)")
print("BAD ROUNDS", bad)

```

### Core Architecture Module: `proofs/search_concurrency/repro/repro_search.py`
```
# Search-layer repros, Rust vs C.  usage: python3 repro_search.py RUST_PORT C_PORT
# Each case prints both engines' answer. Cases are regression checks: Rust and C should agree now (case 1 fixed by #3087, case 4 by #3088); on a pre-#3088 Rust, case 4 aborts the server, so run on throwaway servers.
import sys, time, redis

rp, cp = int(sys.argv[1]), int(sys.argv[2])
R = {"rust": redis.Redis(port=rp, socket_timeout=30), "c": redis.Redis(port=cp, socket_timeout=30)}

def q(r, g, s):
    try:
        out = r.execute_command("GRAPH.QUERY", g, s)
        # [header, rows, stats] with a RETURN; a query without one replies with [stats] only,
        # whose timing lines differ per run, so drop them to keep Rust and C comparable
        if len(out) > 1:
            return out[1]
        return [s for s in out[0] if not s.startswith((b"Query internal execution time", b"Cached execution"))]
    except Exception as e:
        return "ERR " + str(e)[:90]

def case(name, g, setup, probe):
    print("##", name)
    for eng, r in R.items():
        try:
            r.execute_command("GRAPH.DELETE", g)
        except Exception:
            pass
        for s in setup:
            q(r, g, s)
        time.sleep(0.3)
        print(f"  {eng:4}: {q(r, g, probe)}")

# 1. historical regression (fixed by #3087): a wrong-dimension vector used to drop the node from every other index on its label; Rust must now agree with C
case("1 vector dim mismatch hides range index", "h1",
     ["CREATE INDEX FOR (n:L) ON (n.name)",
      "CREATE VECTOR INDEX FOR (n:L) ON (n.v) OPTIONS {dimension:2, similarityFunction:'euclidean'}",
      "CREATE (:L {name:'a', v:vecf32([1,2,3])})"],
     "MATCH (n:L) WHERE n.name = 'a' RETURN n.name")

# 2. second range index created while the first populates is never populated
N = 300000
case("2 second index lost during population", "ti",
     [f"UNWIND range(0,{N-1}) AS x CREATE (:L {{a:x, b:x}})",
      "CREATE INDEX FOR (n:L) ON (n.a)", "CREATE INDEX FOR (n:L) ON (n.b)"],
     "CALL db.indexes() YIELD status RETURN status")
for eng, r in R.items():
    for _ in range(300):
        st = q(r, "ti", "CALL db.indexes() YIELD status RETURN status")
        if st and all(row[0] == b"OPERATIONAL" for row in st):   # every index, not just the first
            break
        time.sleep(0.1)
    print(f"  {eng:4}: count via index on b = {q(r, 'ti', f'MATCH (n:L) WHERE n.b < {N} RETURN count(n)')} (expect {N})")

# 3. vector index option validation regression checks (these option maps should agree with C)
for opts in ["{similarityFunction:'euclidean'}", "{dimension:2}",
             "{dimension:2, similarityFunction:'Euclidean'}"]:
    case("3 vector options " + opts, "vo", [], f"CREATE VECTOR INDEX FOR (n:L) ON (n.v) OPTIONS {opts}")

# 4. huge k: aborted the Rust server before #3088 (clamp); now Rust must return like C (keep last)
case("4 huge k", "vk",
     ["CREATE VECTOR INDEX FOR (n:L) ON (n.v) OPTIONS {dimension:2, similarityFunction:'euclidean'}",
      "CREATE (:L {v:vecf32([1,2])})"],
     "CALL db.idx.vector.queryNodes('L','v',1000000000000000,vecf32([1,2])) YIELD node RETURN count(node)")
for eng, r in R.items():
    try:
        print(f"  {eng:4} alive after: {r.ping()}")
    except Exception as e:
        print(f"  {eng:4} alive after: {e}")

```

### Core Architecture Module: `proofs/search_concurrency/repro/stress.py`
```
# Concurrent readers + writers + GRAPH.DELETE + BGSAVE stress, checking the model's properties.
import redis, threading, time, sys, random, collections
port=int(sys.argv[1]); DUR=float(sys.argv[2]) if len(sys.argv)>2 else 30
stop=False; lock=threading.Lock()
stats=collections.Counter(); violations=[]
from redis.retry import Retry
from redis.backoff import NoBackoff
def conn(): return redis.Redis(port=port, socket_timeout=120, retry=Retry(NoBackoff(),0), retry_on_error=[])
def q(r,g,s,ro=False):
    return r.execute_command("GRAPH.RO_QUERY" if ro else "GRAPH.QUERY", g, s)
def note(k,v=1):
    with lock: stats[k]+=v
def viol(m):
    with lock: violations.append(m)
acked={}  # writer id -> list of seq acked
def writer(wid, g="s"):
    r=conn(); seq=0; acked[wid]=[]
    while not stop:
        try:
            # advance only after the CREATE is acked: a failed write must not leave a gap
            q(r,g,f"CREATE (:A {{w:{wid}, s:{seq+1}}}), (:B {{w:{wid}, s:{seq+1}}})")
            seq+=1; acked[wid].append(seq); note('w_ok')
        except Exception as e: note('w_err:'+str(e)[:50])
def reader(rid, g="s"):
    r=conn(); last={}
    while not stop:
        try:
            res=q(r,g,"MATCH (a:A) WITH a.w AS w, count(a) AS ca, max(a.s) AS ma, count(DISTINCT a.s) AS da OPTIONAL MATCH (b:B {w:w}) RETURN w, ca, ma, da, count(b)",ro=True)[1]
            if not res: note('r_empty'); continue
            for w,ca,ma,da,cb in res:
                if ca!=cb: viol(f"reader{rid}: partial commit w{w} ca={ca} cb={cb}")
                if ma<last.get(w,0): viol(f"reader{rid}: time went back w{w} {last[w]}->{ma}")
                if not (ca==ma==da): viol(f"reader{rid}: gap/dup w{w}: count {ca} distinct {da} max {ma}")
                last[w]=ma
            note('r_ok')
        except Exception as e: note('r_err:'+str(e)[:50])
def deleter():
    r=conn()
    while not stop:
        try:
            q(r,"d","UNWIND range(1,200) AS x CREATE (:X {v:x})")
            def rd():
                rr=conn()
                try: q(rr,"d","MATCH (x:X) WITH x, range(1,50) AS l UNWIND l AS y RETURN count(*)",ro=True); note('d_read_ok')
                except Exception as e: note('d_read_err:'+str(e)[:40])
            def wr():
                rr=conn()
                try: q(rr,"d","MATCH (x:X) WITH count(x) AS c UNWIND range(1,20000) AS y WITH c, y WHERE y % 1000 = 0 CREATE (:Y {c:c})"); note('d_write_ok')
                except Exception as e: note('d_write_err:'+str(e)[:60])
            ts=[threading.Thread(target=f) for f in (rd,rd,wr,wr)]
            for t in ts: t.start()
            time.sleep(random.random()*0.02)
            r.execute_command("GRAPH.DELETE","d"); note('deletes')
            for t in ts: t.join()
            if r.exists("d"):
                cnt=q(r,"d","MATCH (n:X) RETURN count(n)")[1]
                note('d_resurrected')
                if cnt and cnt[0][0]>0: viol(f"deleted graph content survived: X={cnt}"); r.execute_command("GRAPH.DELETE","d")
        except Exception as e: note('del_err:'+str(e)[:60])
def saver():
    r=conn()
    while not stop:
        try:
            info=r.info('persistence')
            if not info['rdb_bgsave_in_progress']:
                r.bgsave(); note('bgsave')
            if info.get('rdb_last_bgsave_status')!='ok': viol('bgsave failed: '+str(info.get('rdb_last_bgsave_status')))
        except Exception as e: note('save_err:'+str(e)[:50])
        time.sleep(0.3)
th=[threading.Thread(target=writer,args=(i,)) for i in range(3)]+[threading.Thread(target=reader,args=(i,)) for i in range(6)]+[threading.Thread(target=deleter),threading.Thread(target=saver)]
for t in th: t.start()
t0=time.time()
while time.time()-t0<DUR:
    time.sleep(5)
    try: alive=conn().ping()
    except Exception as e: alive=repr(e)[:40]
    print(f"t={time.time()-t0:.0f} alive={alive} {dict(stats)} viol={len(violations)}",flush=True)
stop=True
# worker sockets time out after 120 s, so wait longer than that; a worker still inside a
# query would make the final-state checks below race with it, so fail instead
for t in th: t.join(timeout=150)
if any(t.is_alive() for t in th):
    viol("workers still running after stop: final-state checks are unreliable")
r=conn()
res=q(r,"s","MATCH (a:A) RETURN a.w, count(a), max(a.s)")[1]
for w,c,m in res:
    if c!=len(acked[w]): viol(f"lost/extra writes w{w}: in graph {c}, acked {len(acked[w])}")
print("FINAL", dict(stats)); print("VIOLATIONS", violations[:6], len(violations)); print([v for v in violations if "lost" in v])
print("dups", q(r,"s","MATCH (a:A) WITH a.w AS w, a.s AS s, count(a) AS c WHERE c>1 RETURN w, s, c ORDER BY w, s LIMIT 20")[1])
print("bgsave status", r.info('persistence')['rdb_last_bgsave_status'])

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3556** (2026-10-28): **[Rust] Variables named _anon* are treated as anonymous, and * projections drop variables starting with _**
  *Symptoms*: ### Summary  User variables whose names start with `_anon` are treated as anonymous, so they can't be referenced: a later use gets a new, unbound variable. Separately, `*` projections drop every variable whose name starts with `_`.  ### Reproduction (release build, `main` @ c652e505e)  Graph: `CREATE (:Person {name:'Alice', age: 40})-[:KNOWS]->(:Person {name:'Bob', age: 35})`  | query | C (`edge-c`) | Rust | |---|---|---| | `MATCH (_anon_x:Person) RETURN _anon_x.name` | `'Alice', 'Bob'` | `Variable _anon_x not found` | | `MATCH (_anonymous:Person) RETURN _anonymous.name` | `'Alice', 'Bob'` | `Variable _anonymous not found` | | `UNWIND [1,2] AS _anon_v RETURN _anon_v` | `1, 2` | **`null, null`** | | `MATCH (_x:Person) WITH * RETURN _x.name` | `'Alice', 'Bob'` | `'_x' not defined` | | `MATCH (_x:Person) RETURN *` | column `_x`, 2 rows | `RETURN * is not allowed when there are no variables in scope` |  ### Mechanism  The parser names unnamed nodes and relationships `_anon_N` ([cypher.rs:3027](https://github.com/FalkorDB/FalkorDB/blob/c652e505e7be43f9948263fd64afc56e72253501/graph/src/parser/cypher.rs#L3027), [3063](https://github.com/FalkorDB/FalkorDB/blob/c652e505e7be43f9948263fd64afc56e72253501/graph/src/parser/cypher.rs#L3063), [3140](https://github.com/FalkorDB/FalkorDB/blob/c652e505e7be43f9948263fd64afc56e72253501/graph/src/parser/cypher.rs#L3140)), and later stages recognise an anonymous entity by that name prefix, not by a flag:  - `define_name_in_scope` never reuses a na

- **Issue #3554** (2026-10-28): **[Rust] A variable read only by a WITH's ORDER BY stays in scope after the WITH**
  *Symptoms*: ### Summary  A `WITH`'s `ORDER BY` may read variables from before the projection. To allow that, the binder copies such a variable into the new scope, but it never removes the copy, so the variable stays visible to every later clause. Copies made for the `WITH`'s `WHERE`, `SKIP` and `LIMIT` are removed.  ### Reproduction (release build, `main` @ c652e505e)  Graph: `CREATE (:Person {name:'Alice', age: 40})-[:KNOWS]->(:Person {name:'Bob', age: 35})`  | query | C (`edge-c`) | Rust | |---|---|---| | `MATCH (n:Person) WITH n.name AS name ORDER BY n.age RETURN n.name, name` | `'n' not defined` | **`['Bob','Bob'], ['Alice','Alice']`** | | `MATCH (n:Person) WITH n.name AS name ORDER BY n.age RETURN *` | columns: `name` | **columns: `n`, `name`** | | `MATCH (n:Person) WITH n.name AS name WHERE n.age > 0 RETURN n.name, name` | `'n' not defined` | `'n' not defined` |  ### Mechanism  While a projection's `ORDER BY`/`WHERE`/`SKIP`/`LIMIT` is bound, `resolve_name` resolves a name the new scope lacks from the parent scope and inserts a copy into the new scope's env, recording it in `copy_from_parent` ([binder.rs:2234-2248](https://github.com/FalkorDB/FalkorDB/blob/c652e505e7be43f9948263fd64afc56e72253501/graph/src/planner/binder.rs#L2234-L2248)).  `bind_projection` removes those copies again ([binder.rs:1257-1268](https://github.com/FalkorDB/FalkorDB/blob/c652e505e7be43f9948263fd64afc56e72253501/graph/src/planner/binder.rs#L1257-L1268)), but only keys missing from `env_keys_before_filter`, 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #3005.

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

### Incident Patch 1: `874b6d87` (2026-11-11)
**Commit Message**: fix(module): load on Valkey by repairing environ under RTLD_DEEPBIND (#3494)

* fix(module): repair environ under RTLD_DEEPBIND so the module loads on Valkey

Valkey dlopen()s modules with RTLD_DEEPBIND. When valkey-server
copy-relocates environ (e.g. Ubuntu's package), the module and libomp
bind to libc's original environ, which stays NULL, and libomp
segfaults in omp_init_lock during GxB_init. Sync the module's environ
with the executable's before GraphBLAS starts libomp; a no-op on Redis.

Closes #3493

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* ci: smoke-test the engine under Ubuntu's valkey-server

Loads the built module into a real valkey-server, runs queries, an
index and BGSAVE, and fails on a crash. Ubuntu's package is used
because it copy-relocates environ; the official valkey images do not
and would not catch #3493.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* fix(module): address review on Valkey environ fix and smoke test

- Gate sync_deepbind_environ to Linux; macOS dylibs must not reference
  environ directly and RTLD_DEEPBIND is glibc-only.
- valkey-cli -e so server error replies fail the smoke test.
- Fail if BGSAVE is still in progress after polling.


**File**: `graph/src/env_snapshot.rs` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+//! Owned, process-lifetime copies of a C `environ` array.
+//!
+//! The module repairs libc's `environ` when a server loads it with
+//! `RTLD_DEEPBIND` and copy-relocates `environ` (issue #3493); see
+//! `sync_deepbind_environ` in the module crate. The copy lives here, apart
+//! from the loader-specific lookup, so it can be unit-tested on any platform.
+
+use std::ffi::{CStr, c_char};
+
+/// Deep-copy a NULL-terminated `char **` environment and leak the copy.
+///
+/// Both the pointer array and every string are fresh allocations that are
+/// never freed, so the result stays valid whatever later happens to `src`: a
+/// `setenv` that `realloc`s the array, or a `putenv` caller freeing its buffer
+/// after `unsetenv`. A NULL `src` yields an empty environment (a lone NULL).
+///
+/// # Safety
+///
+/// `src` must be NULL or point to a NULL-terminated array of pointers to
+/// NUL-terminated strings, none of which is modified or freed during the call.
+#[must_use]
+pub unsafe fn leak_deep_copy(src: *const *mut c_char) -> *mut *mut c_char {
+    let mut len = 0;
+    // SAFETY: the caller guarantees `src` is NULL or NULL-terminated.
+    while !src.is_null() && unsafe { !(*src.add(len)).is_null() } {
+        len += 1;
+    }
+    let mut copy: Vec<*mut c_char> = Vec::with_capacity(len + 1);
+    for i in 0..len {
+        // SAFETY: `i < len`, so the entry is a non-NULL pointer to a
+        // NUL-terminated string, per the caller's contract.
+        let entry = unsafe { CStr::from_ptr(*src.add(i)) };
+        copy.push(entry.to_owned().into_raw());
+    }
+    copy.push(std::ptr::null_mut());
+    Box::leak(copy.into_boxed_slice()).as_mut_ptr()
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use std::ffi::CString;
+
+    /// Read a NULL-terminated `char **` back into owned strings.
+    unsafe fn read(env: *mut *mut c_char) -> Vec<String> {
+        let mut out = Vec::new();
+        let mut i = 0;
+        // SAFETY: `env` came from `leak_deep_copy`, which NULL-terminates it.
+        while unsafe { !(*env.add(i)).is_null() } {
+            out.push(
+                unsafe { CStr::from_ptr(*env.add(i)) }
+                    .to_str()
+                    .unwrap()
+                    .to_owned(),
+            );
+            i += 1;
+        }
+        out
+    }
+
+    #[test]
+    fn null_source_is_empty() {
+        let copy = unsafe { leak_deep_copy(std::ptr::null()) };
+        assert!(unsafe { read(copy) }.is_empty());
+    }
+
+    #[test]
+    fn empty_source_is_empty() {
+        let src = [std::ptr::null_mut::<c_char>()];
+        let copy = unsafe { leak_deep_copy(src.as_ptr()) };
+        assert!(unsafe { read(copy) }.is_empty());
+    }
+
+    #[test]
+    fn copies_entries_in_order() {
+        let a = CString::new("A=1").unwrap();
+        let b = CString::new("KMP_BLOCKTIME=0").unwrap();
+        let src = [
+            a.as_ptr().cast_mut(),
+            b.as_ptr().cast_mut(),
+            std::ptr::null_mut(),
+        ];
+        let copy = unsafe { leak_deep_copy(src.as_ptr()) };
+        assert_eq!(unsafe { read(copy) }, ["A=1", "KMP_BLOCKTIME=0"]);
+    }
+
+    /// The copy owns its strings and array: freeing or overwriting the
+    /// source afterwards (as `unsetenv` + `free` of a `putenv` buffer, or a
+    /// `setenv` realloc, would) must not change what the copy reads.
+    #[test]
+    fn survives_source_being_freed_and_overwritten() {
+        let a = CString::new("PUTENV_OWNED=yes").unwrap().into_raw();
+        let b = CString::new("B=2").unwrap();
+        let mut src = vec![a, b.as_ptr().cast_mut(), std::ptr::null_mut()];
+        let copy = unsafe { leak_deep_copy(src.as_ptr()) };
+        assert_ne!(unsafe { *copy }, a, "strings must be copied, not borrowed");
+        assert_ne!(copy, src.as_mut_ptr(), "the array must be copied");
+        drop(unsafe { CString::from_raw(a) });
+        src[0] = std::ptr::null_mut();
+        drop(src);
+        assert_eq!(unsafe { read(copy) }, ["PUTENV_OWNED=yes", "B=2"]);
+    }
+}
```

**File**: `graph/src/lib.rs` (modified, +2/-0)
```diff
@@ -66,12 +66,14 @@
 //! - [`storage`]: Shared storage seam (per-store backend registry; an in-memory
 //!   backend by default, an alternate backend swapped in by a statically-linked add-on)
 //! - [`entity_type`]: Node and relationship entity type discriminator
+//! - [`env_snapshot`]: Owned copies of a C `environ` array (Valkey `RTLD_DEEPBIND` repair)
 //! - [`identifier_limits`]: Maximum accepted length of an identifier
 //! - [`threadpool`]: Thread pool for parallel query execution
 //! - [`udf`]: User-defined function registration and dispatch
 
 pub mod effects;
 pub mod entity_type;
+pub mod env_snapshot;
 pub mod graph;
 pub mod identifier_limits;
 pub mod index;
```

**File**: `proofs/redis_layer/COVERAGE.tsv` (modified, +13/-11)
```diff
@@ -163,17 +163,19 @@ src/query_session.rs	Gil::acquire	502	PROVEN	QuerySession.gilAcquire: gil_nested
 src/query_session.rs	Gil::drop	525	PROVEN	QuerySession.gilDrop: gil_stack, gil_out_of_order
 src/query_session.rs	lock_gil	546	AXIOMATISED	RM_ThreadSafeContextLock/Unlock + FreeThreadSafeContext (Redis API); QuerySession.Ev.gilLock/gilUnlock
 src/query_session.rs	release_gil	559	AXIOMATISED	RM_ThreadSafeContextLock/Unlock + FreeThreadSafeContext (Redis API); QuerySession.Ev.gilLock/gilUnlock
-src/module_init.rs	pthread_atfork	91	AXIOMATISED	libc pthread_atfork declaration
-src/module_init.rs	on_fork_child	118	PROVEN	ModuleInit.forkChildAborts: fork_gc_never_aborts, fork_all_synced
-src/module_init.rs	graph_init	139	PROVEN	ModuleInit.graphInitArgs (args → apply_module_args; Err ⇒ Status::Err): graphInitArgs_refuses; LoadArgs.rust_c_same_accept; table_defaults_in_range; historical pre3328_* (W4-redis-3 / #3268, fixed by #3328)
-src/module_init.rs	info_func	423	PROVEN	ModuleInit.infoSections: info_normal
-src/module_init.rs	on_flush	438	PROVEN	ModuleInit.onFlush: onFlush_id
-src/module_init.rs	on_shutdown	465	PROVEN	ModuleInit.onShutdown: onShutdown_flusher_first, onShutdown_no_teardown_under_a_left_worker, onShutdown_without_native_index
-src/module_init.rs	on_role_change	466	PROVEN	ModuleInit.onRoleChange: onRoleChange_promote, onRoleChange_demote
-src/module_init.rs	enforce_pending_constraints_after_promotion	496	PROVEN	ModuleInit.pendingPerGraph: pending_only_uc
-src/module_init.rs	on_replica_change	564	PROVEN	ModuleInit.onReplicaChange: onReplicaChange_latches
-src/module_init.rs	on_loading	576	PROVEN	ModuleInit.onLoading: onLoading_only_end
-src/module_init.rs	on_keyspace_event	597	PROVEN	ModuleInit.onKeyspace: rename_pair, rename_to_alone, other_event
+src/module_init.rs	pthread_atfork	97	AXIOMATISED	libc pthread_atfork declaration
+src/module_init.rs	on_fork_child	124	PROVEN	ModuleInit.forkChildAborts: fork_gc_never_aborts, fork_all_synced
+src/module_init.rs	sync_deepbind_environ	160	NOT COVERED	Linux-only; not modelled. Bound to ld.so/libc: dlopen(NULL) + dlsym("environ"), then points libc's own environ at graph::env_snapshot::leak_deep_copy of that array. CI reaches only its no-op return; the snapshot path runs only under a valkey-server that copy-relocates environ (#3493).
+graph/src/env_snapshot.rs	leak_deep_copy	22	NOT COVERED	Not modelled. Deep-copies a NULL-terminated char** (array and strings) and leaks it; unit-tested in env_snapshot::tests (NULL, empty, order, source freed after copy)
+src/module_init.rs	graph_init	205	PROVEN	ModuleInit.graphInitArgs (args → apply_module_args; Err ⇒ Status::Err): graphInitArgs_refuses; LoadArgs.rust_c_same_accept; table_defaults_in_range; historical pre3328_* (W4-redis-3 / #3268, fixed by #3328)
+src/module_init.rs	info_func	502	PROVEN	ModuleInit.infoSections: info_normal
+src/module_init.rs	on_flush	517	PROVEN	ModuleInit.onFlush: onFlush_id
+src/module_init.rs	on_shutdown	530	PROVEN	ModuleInit.onShutdown: onShutdown_flusher_first, onShutdown_no_teardown_under_a_left_worker, onShutdown_without_native_index
+src/module_init.rs	on_role_change	554	PROVEN	ModuleInit.onRoleChange: onRoleChange_promote, onRoleChange_demote
+src/module_init.rs	enforce_pending_constraints_after_promotion	584	PROVEN	ModuleInit.pendingPerGraph: pending_only_uc
+src/module_init.rs	on_replica_change	651	PROVEN	ModuleInit.onReplicaChange: onReplicaChange_latches
+src/module_init.rs	on_loading	663	PROVEN	ModuleInit.onLoading: onLoading_only_end
+src/module_init.rs	on_keyspace_event	684	PROVEN	ModuleInit.onKeyspace: rename_pair, rename_to_alone, other_event
 src/telemetry.rs	truncate	34	PROVEN	Telemetry.truncate: truncate_short, truncate_len, truncate_prefix
 src/telemetry.rs	truncate_arc	50	PROVEN	Telemetry.truncateArc: truncateArc_eq
 src/telemetry.rs	stream_name	66	PROVEN	Telemetry.streamName: streamName_key_name, streamName_inj, streamName_nul, stream_same_slot, stream_other_slot
```

**File**: `src/module_init.rs` (modified, +65/-0)
```diff
@@ -141,6 +141,67 @@ unsafe extern "C" fn on_fork_child() {
     }
 }
 
+/// Point this module's view of `environ` at a snapshot of the live environment.
+///
+/// Valkey `dlopen`s modules with `RTLD_DEEPBIND`, so the module and its
+/// dependencies (notably libomp) bind `environ` to libc's own definition
+/// before the global scope. When the server executable copy-relocates
+/// `environ` (Ubuntu's valkey-server package does), libc's startup code and
+/// `setenv` only ever update that copy, leaving libc's original NULL. libomp
+/// iterates `environ` directly during its first initialization and segfaults
+/// on the NULL.
+///
+/// When both views are already the same object (Redis, or a valkey-server
+/// without the copy relocation) this is a no-op. Valkey passes
+/// `RTLD_DEEPBIND` only on glibc and FreeBSD (musl ignores it), and macOS
+/// dylibs must not reference `environ` directly. FalkorDB ships only for
+/// Linux and macOS, so the helper exists only on Linux.
+#[cfg(target_os = "linux")]
+unsafe fn sync_deepbind_environ() {
+    unsafe extern "C" {
+        static mut environ: *mut *mut libc::c_char;
+    }
+    unsafe {
+        // `dlopen(NULL)` searches the global scope starting at the executable,
+        // which yields the copy-relocated `environ` that libc keeps updated.
+        let main = libc::dlopen(std::ptr::null(), libc::RTLD_NOW | libc::RTLD_NOLOAD);
+        if main.is_null() {
+            return;
+        }
+        let live = libc::dlsym(main, c"environ".as_ptr()).cast::<*mut *mut libc::c_char>();
+        libc::dlclose(main);
+        let ours = &raw mut environ;
+        if live.is_null() || live == ours {
+            return;
+        }
+        // Install an owned, leaked snapshot rather than aliasing `*live`: the
+        // live array is typically the one glibc's `setenv` allocated, so a
+        // later `setenv` (e.g. libomp registering itself) may `realloc` it and
+        // leave `*ours` dangling. Copy the strings too: a `putenv` caller owns
+        // its buffer and may free it after `unsetenv`, so borrowing it could
+        // leave the snapshot pointing at freed memory.
+        let snapshot = graph::env_snapshot::leak_deep_copy(*live);
+        // The snapshot is a point-in-time view: a later `setenv` updates only
+        // the executable's copy, so code that scans `environ` directly (e.g.
+        // `std::env::vars()`) will not see it. That includes every other
+        // module the server loaded with `RTLD_DEEPBIND`, since they share
+        // libc's `environ`; they saw NULL before, so this is still an
+        // improvement. `getenv`/`std::env::var` go through libc and are
+        // unaffected. libomp only needs it once, at init.
+        //
+        // SAFETY: `ours` points to libc's `char **environ`; this runs on the
+        // main thread during module load. At startup no other thread reads
+        // it. Under a runtime `MODULE LOAD`, a thread of an earlier
+        // DEEPBIND-loaded module could read it concurrently; that is a single
+        // aligned pointer store, so it sees either the old or the new array,
+        // both NULL-terminated. `*live` and its strings are only read here.
+        // The snapshot owns both the pointer array and every string, all
+        // leaked, so it stays valid for the life of the process whatever a
+        // later `setenv`, `putenv` or `unsetenv` does to the live environment.
+        *ours = snapshot;
+    }
+}
+
 pub fn graph_init(
     ctx: &Context,
     args: &[redis_module::RedisString],
@@ -209,6 +270,10 @@ pub fn graph_init(
         if RediSearch_SetDefaultScorer(c"TFIDF".as_ptr()) != REDISMODULE_OK as c_int {
             ctx.log_warning("Failed to set RediSearch default scorer to TFIDF");
         }
+        // Must run after the `KMP_*` `set_var` calls above and before
+        // GraphBLAS starts libomp, which reads `environ` once at init.
+        #[cfg(target_os = "linux")]
+        sync_deepbind_environ();
         if let Err(err) = init(
             RedisModule_Alloc,
             RedisModule_Calloc,
```

---

### Incident Patch 2: `7472d6a8` (2026-11-10)
**Commit Message**: feat(index): CREATE INDEX returns before the index is built; a background builder fills it (#3585)

* fix(threadpool): a bounded shutdown keeps the workers it left behind

`ThreadPool::shutdown_within` detached a worker still running a job when
the time ran out, so a second call found no workers and reported that
every one had exited. It now keeps them: a later call waits for them
again, reports them while their jobs run, and joins them once the jobs
return.

The index builder (#2355) stops its pool this way at shutdown, and calls
it again when the pool restarts.

* feat(index): a background builder runs each Building index's batches

The builder runs the indexer batches of every `Building` index, in every
graph, on a pool of its own (`online_build`). It keeps one chain of turns
per index, so no two batches ever run on one index, and indexes build side
by side. A turn takes one batch on a new build version of the published
one with no lock held, then publishes it through the graph's host with
`commit_indexer_batch`, which decides how it goes in. The chain goes on
until the index is `Ready`.

A host registers a `BuildHost` with each graph. `read` gives the
published version, loaded 

**File**: `graph/src/graph/graph.rs` (modified, +77/-0)
```diff
@@ -4184,13 +4184,23 @@ impl Graph {
         }
     }
 
+    /// Whether the planner may answer `label.field` from an index of `index_type`.
+    ///
+    /// Under `index-falkordb` a Range lookup is the native column's alone, and the column is part
+    /// of this version: it serves once its build is done. RediSearch's readiness lives in its
+    /// index map, which every version shares, so it says nothing about this version's column, and
+    /// a version without the column must not plan a lookup it cannot answer.
     #[must_use]
     pub fn is_indexed(
         &self,
         label: &Arc<String>,
         field: &Arc<String>,
         index_type: &IndexType,
     ) -> bool {
+        #[cfg(feature = "index-falkordb")]
+        if *index_type == IndexType::Range {
+            return self.falkordb_index.is_ready(EntityType::Node, label, field);
+        }
         self.node_indexer.is_label_indexed(label, field, index_type)
     }
 
@@ -4281,13 +4291,20 @@ impl Graph {
             .is_some_and(|value| scan_filter.matches(&value))
     }
 
+    /// The relationship counterpart of [`Self::is_indexed`].
     #[must_use]
     pub fn is_edge_indexed(
         &self,
         label: &Arc<String>,
         field: &Arc<String>,
         index_type: &IndexType,
     ) -> bool {
+        #[cfg(feature = "index-falkordb")]
+        if *index_type == IndexType::Range {
+            return self
+                .falkordb_index
+                .is_ready(EntityType::Relationship, label, field);
+        }
         self.edge_indexer.is_label_indexed(label, field, index_type)
     }
 
@@ -4475,15 +4492,75 @@ impl Graph {
         let mut infos = self.node_indexer.index_info();
         for info in &mut infos {
             info.entity_type = String::from("NODE");
+            #[cfg(feature = "index-falkordb")]
+            self.add_native_build(EntityType::Node, info);
         }
         let mut edge_infos = self.edge_indexer.index_info();
         for info in &mut edge_infos {
             info.entity_type = String::from("RELATIONSHIP");
+            #[cfg(feature = "index-falkordb")]
+            self.add_native_build(EntityType::Relationship, info);
         }
         infos.extend(edge_infos);
         infos
     }
 
+    /// Under `index-falkordb`, `info`'s label is under construction while any of its Range
+    /// attributes' native columns is `Building` in this version: each such column counts as
+    /// pending. The progress shown is the label's build as a whole, out of the label's or type's
+    /// entities, as C shows it: the least any of those columns has read, or what RediSearch has
+    /// populated of another of the label's fields (a fulltext or vector one) if that is less. The
+    /// label's or type's entities are counted once, and only while one of its columns builds.
+    #[cfg(feature = "index-falkordb")]
+    fn add_native_build(
+        &self,
+        entity: EntityType,
+        info: &mut IndexInfo,
+    ) {
+        let mut building: Option<(i32, u64)> = None;
+        for attr in &info.field_order {
+            let range = info
+                .fields
+                .get(attr)
+                .is_some_and(|fields| fields.iter().any(|f| f.ty == IndexType::Range));
+            if range
+                && let Some(read) = self.falkordb_index.building_read(entity, &info.label, attr)
+            {
+                building = Some(
+                    building.map_or((1, read), |(columns, least)| (columns + 1, least.min(read))),
+                );
+            }
+        }
+        let Some((columns, least)) = building else {
+            return;
+        };
+        let total = self.native_build_total(entity, &info.label);
+        let done = least.min(total);
+        // RediSearch reports what it has populated while it has a field pending.
+        info.progress = if info.pending > 0 {
+            done.min(info.progress)
+        } else {
+            done
+        };
+        info.pending += columns;
+        info.total = total;
+    }
+
+    /// The entities of `label`, or of relationship type `label`: what a build's progress is out of.
+    #[cfg(feature = "index-falkordb")]
+    fn native_build_total(
+        &self,
+        entity: EntityType,
+        label: &Arc<String>,
+    ) -> u64 {
+        match entity {
+            EntityType::Node => self.get_label_matrix(label).map_or(0, |lm| lm.nvals()),
+            EntityType::Relationship => self
+                .get_relationship_matrix(label)
+                .map_or(0, |t| t.edge_count()),
+        }
+    }
+
     // ── Constraint management ─────────────────────────────────────────
 
     #[must_use]
```

**File**: `graph/src/graph/graph/falkordb_index_tests.rs` (modified, +1268/-21)
```diff
@@ -2,26 +2,37 @@
 //! and checks the index column it should have changed. The build's tests drive indexer batches
 //! between writes.
 
-use super::{Graph, NodeId, RelationshipId};
+use super::{Graph, NodeId, Plan, RelationshipId};
 use crate::entity_type::EntityType;
 use crate::graph::mvcc_graph::{CommitError, MvccGraph};
 use crate::index::Field;
 use crate::index::falkordb::encode::encode_numeric;
 use crate::index::falkordb::falkordb_index::{BuildCursor, IndexColumn, IndexKey};
 use crate::index::falkordb::graph_writes;
+use crate::index::falkordb::online_build::{
+    self, BuildHost, Builder, Job, LocalHost, Sizing, Step,
+};
 use crate::index::falkordb::versioned::{
     BuildState, CatchUp, Discarded, IndexId, IndexerCommit, PreparedBatch, REFRESH_COST,
     VersionedIndex,
 };
 use crate::index::index_docs::IndexDocs;
-use crate::index::{IndexQuery, IndexType};
+use crate::index::{IndexInfo, IndexQuery, IndexType};
+use crate::locks::WriteEscalation;
+use crate::planner::IR;
+use crate::runtime::functions::init_functions;
 use crate::runtime::orderset::OrderSet;
+use crate::runtime::runtime::Runtime;
 use crate::runtime::value::Value;
+use orx_tree::{Dfs, NodeRef};
 use roaring::RoaringTreemap;
 use rustc_hash::FxHashMap;
 use std::collections::{BTreeMap, BTreeSet, HashMap};
 use std::ffi::CString;
-use std::sync::Arc;
+use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
+use std::sync::{Arc, Weak, mpsc};
+use std::thread;
+use std::time::{Duration, Instant};
 
 /// Run one graph write with its own [`IndexDocs`] and apply its native-index changes straight
 /// away, the way each write call changed the index before they were batched. Tests that check
@@ -125,15 +136,13 @@ fn new_version_isolates_the_falkordb_index() {
     assert_eq!(writer.version, committed.version + 1);
 }
 
-/// CREATE INDEX builds the column from real graph state: three
-/// `:Person {age}` nodes, then a range scan returns the right ids in
-/// `(value, id)` order. The column is built by one indexer batch over every node
-/// (its `get_label_matrix` → `get_node_attribute_by_idx` reads), so it is
-/// `Ready` and serves reads when CREATE INDEX returns. Drives the native half of
-/// `Graph::create_index` directly, bypassing the RediSearch FFI (uninitialised
-/// in a unit test).
+/// CREATE INDEX leaves the column `Building`, its cursor at the start, for the background builder:
+/// the planner does not use it, and a read that reaches it is told to scan. Once indexer batches
+/// have built it from real graph state (three `:Person {age}` nodes), it is `Ready`, the planner
+/// uses it, and a range scan returns the right ids in `(value, id)` order. Drives the native half
+/// of `Graph::create_index` directly, bypassing the RediSearch FFI (uninitialised in a unit test).
 #[test]
-fn create_index_builds_the_column_from_live_nodes() {
+fn create_index_leaves_the_node_column_to_its_batches() {
     ensure_graphblas();
     let mut g = Graph::new(64, 64, 10, 1, "t");
     let label = Arc::new("Person".to_string());
@@ -166,19 +175,38 @@ fn create_index_builds_the_column_from_live_nodes() {
     }
     applied!(g, |w| g.set_nodes_attributes(&attrs, &mut w)).unwrap();
 
-    // Build the index numeric column from the live nodes.
     graph_writes::create_index(
         &mut g,
         &IndexType::Range,
         EntityType::Node,
         &label,
         std::slice::from_ref(&attr),
     );
+    assert_eq!(
+        cursor(&g, EntityType::Node, &label, &attr),
+        Some(BuildCursor::new(EntityType::Node)),
+        "CREATE INDEX takes no batch"
+    );
+    assert!(
+        !g.is_indexed(&label, &attr, &IndexType::Range),
+        "the planner does not use a Building column"
+    );
+    assert!(
+        matches!(
+            g.falkordb_index
+                .query_numeric(EntityType::Node, &label, &eq(&attr, 20)),
+            Some(Err(_))
+        ),
+        "a read that reaches a Building column scans"
+    );
+
+    assert_eq!(build_to_end(&mut g, 2), 2, "two batches of two nodes");
     assert_eq!(
         g.falkordb_index
             .column_state(EntityType::Node, &label, &attr),
         Some(BuildState::Ready)
     );
+    assert!(g.is_indexed(&label, &attr, &IndexType::Range));
     assert!(
         matches!(
             g.falkordb_index
@@ -242,11 +270,11 @@ fn rdb_load_populate_builds_each_column() {
     );
 }
 
-/// The edge counterpart: CREATE INDEX on a relationship type builds its column from the live
-/// edges, a multi-edge pair included, in one indexer batch dispatched to the edge column, so it is
-/// `Ready` and serves reads when CREATE INDEX returns, and holds what a one-pass build does.
+/// The edge counterpart: CREATE INDEX on a relationship type leaves its column `Building`, and
+/// indexer batches dispatched to the edge column build it from the live edges, a multi-edge pair
+/// included, into what a one-pass build holds. Until then the planner does not use it.
 #[test]
-fn create
```

**File**: `graph/src/graph/mvcc_graph.rs` (modified, +33/-14)
```diff
@@ -72,6 +72,8 @@ use thiserror::Error;
 
 use crate::graph::graph::{Graph, NodeOpError};
 #[cfg(feature = "index-falkordb")]
+use crate::index::falkordb::online_build;
+#[cfg(feature = "index-falkordb")]
 use crate::index::falkordb::versioned::{IndexerCommit, PreparedBatch};
 
 /// MVCC coordinator for concurrent graph access.
@@ -106,17 +108,17 @@ impl MvccGraph {
         e: u64,
         cache_size: usize,
         name: &str,
-    ) -> Self {
+    ) -> Arc<Self> {
         Self::from_graph(Graph::new(n, e, cache_size, 0, name))
     }
 
     /// Create an `MvccGraph` from an already-constructed `Graph`.
     /// Used by the RDB load path.
     #[must_use]
-    pub fn from_graph(graph: Graph) -> Self {
-        Self {
+    pub fn from_graph(graph: Graph) -> Arc<Self> {
+        Arc::new(Self {
             graph: ArcSwap::from_pointee(graph),
-        }
+        })
     }
 
     /// The published version. Takes no lock.
@@ -188,10 +190,11 @@ impl MvccGraph {
     /// A refusal needs no cleanup: nothing was taken, and the refused version
     /// is dropped.
     ///
-    /// Takes `&self`: publishing is a compare-and-swap of the published
+    /// Takes a shared reference: publishing is a compare-and-swap of the published
     /// pointer. The caller holds the host's global lock, which keeps commits
     /// apart and the swap out of the way of the host forking (#452); it needs no
-    /// per-graph lock.
+    /// per-graph lock. It takes the `Arc` the graph lives in so that it can hand each background
+    /// index build it starts a weak handle to it ([`Arc::downgrade`]).
     ///
     /// # Errors
     ///
@@ -200,12 +203,23 @@ impl MvccGraph {
     /// a host publishing without the global lock lets that happen),
     /// [`CommitError::Invalid`] if [`Graph::validate`] refuses it.
     pub fn commit(
-        &self,
+        self: &Arc<Self>,
         mut fork: Graph,
     ) -> Result<Arc<Graph>, CommitError> {
         let published = self.graph.load_full();
         Self::prepare(&published, &mut fork, true)?;
-        self.publish(&published, Arc::new(fork))
+        // The indexes to build, asked of the version this one replaces before it is replaced.
+        #[cfg(feature = "index-falkordb")]
+        let to_build = fork.indexes_to_build_since(&published);
+        let version = self.publish(&published, Arc::new(fork))?;
+        // Each `Building` index this version brings in, new or created again, starts its build: a
+        // job per generation, started only by the commit that brings it in, so a commit made during
+        // the build, an indexer batch's included, starts nothing.
+        #[cfg(feature = "index-falkordb")]
+        for (id, generation) in to_build {
+            online_build::enqueue(Arc::downgrade(self), id, generation);
+        }
+        Ok(version)
     }
 
     /// Commit an indexer batch. `prepared` is a build version of a published one
@@ -220,27 +234,32 @@ impl MvccGraph {
     ///   `prepared`'s copy, or the batch, without them, is inserted into the published copy. The
     ///   result goes into a new build version of the published one, which is published
     ///   ([`Graph::caught_up_onto`]);
+    /// - writers, and catching up would do more than `batch`'s limit allows
+    ///   ([`PreparedBatch::limit_catch_up`]): nothing is published
+    ///   ([`CatchUpTooLarge`](crate::index::falkordb::versioned::Discarded::CatchUpTooLarge)), and
+    ///   the index's next batch starts from its published cursor;
     /// - `batch`'s index was dropped or created again, or another batch committed on the same
     ///   index: nothing is published, and the index's next batch starts from its published cursor.
-    ///   Another batch on the index is a bug in the builder's one chain per index
-    ///   ([`AnotherBatch`](crate::index::falkordb::versioned::Discarded::AnotherBatch)), which the
-    ///   caller reports.
+    ///   Another batch on the index is a bug in the builder's one job per generation
+    ///   ([`AnotherBatch`](crate::index::falkordb::versioned::Discarded::AnotherBatch)), which
+    ///   leaves nothing wrong.
     ///
     /// The commit changes no graph data and keeps the data version, so it does not make a writer's
     /// fork stale ([`Self::is_stale`]).
     ///
     /// The caller holds the host's global lock, as a writer does to publish; it needs no
     /// per-graph lock. The fit is made against the published version this commit loads, and the
-    /// version is published over that one: a batch that writers overtook is caught up, not
-    /// refused.
+    /// version is published over that one: a batch that writers overtook is caught up, or, if that
+    /// would do more than its limit allows, discarded; it is never refused as stale
+    /// ([`CommitError::Stale`]) for being overtaken.
     ///
     /// # Errors
     ///
     /// [`CommitError::Invalid`] if [`Graph::validate`] refuses the version, [`CommitError::Stale`]
     /// if another
```

**File**: `graph/src/index/falkordb/falkordb_index.rs` (modified, +36/-5)
```diff
@@ -318,7 +318,7 @@ impl VersionedIndex for IndexColumn {
         place: impl Fn(u64) -> Option<BuildCursor>,
         (removes, adds): &mut (EncodedTuples, EncodedTuples),
     ) {
-        if let BuildState::Building { next, written } = state {
+        if let BuildState::Building { next, written, .. } = state {
             written.by_this_version.extend(log.iter().map(|w| w.id));
             let next = *next;
             // A batch reads an entity at or above the cursor when it reaches it, so its
@@ -640,8 +640,8 @@ impl FalkorDbIndex {
 
     /// Create an empty numeric column in the `Building` state, its cursor at the start, replacing
     /// any existing one. Indexer batches fill it from the start, live writes keep the part below
-    /// the cursor current, and reads fall through to RediSearch until the last batch flips it
-    /// `Ready`.
+    /// the cursor current, and a read it would serve scans instead ([`ScanFilter`]) until the last
+    /// batch flips it `Ready`.
     pub fn create_building(
         &mut self,
         entity: EntityType,
@@ -768,6 +768,33 @@ impl FalkorDbIndex {
             .contains_key(&(label.clone(), attr.clone()))
     }
 
+    /// Whether column `(entity, label, attr)` exists and is `Ready`: whether this version's index
+    /// serves reads on it. A `Building` column answers with a [`ScanFilter`] instead.
+    #[must_use]
+    pub fn is_ready(
+        &self,
+        entity: EntityType,
+        label: &Arc<String>,
+        attr: &Arc<String>,
+    ) -> bool {
+        self.entry(entity, label, attr)
+            .is_some_and(|entry| !entry.is_building())
+    }
+
+    /// How many entities column `(entity, label, attr)`'s batches have read
+    /// ([`BuildState::Building`]), or `None` if the column is `Ready` or does not exist.
+    pub(crate) fn building_read(
+        &self,
+        entity: EntityType,
+        label: &Arc<String>,
+        attr: &Arc<String>,
+    ) -> Option<u64> {
+        match self.entry(entity, label, attr)?.state {
+            BuildState::Building { read, .. } => Some(read),
+            BuildState::Ready => None,
+        }
+    }
+
     /// Ready this version to be published: each index's sets of written entities are settled
     /// ([`IndexEntry::publish`]).
     pub(crate) fn publish(&mut self) {
@@ -988,8 +1015,8 @@ impl FalkorDbIndex {
         })
     }
 
-    /// Whether any column is still `Building`.
-    #[cfg(test)]
+    /// Whether any column is still `Building`. Walks the columns' states without hashing a name,
+    /// so a per-write check that only matters during a build costs next to nothing outside one.
     #[must_use]
     pub(crate) fn has_building_columns(&self) -> bool {
         self.node_columns
@@ -1185,6 +1212,8 @@ mod tests {
                 name: (Node, column.clone()),
                 work: tuples,
                 next,
+                read: 3,
+                catch_up_limit: None,
             }
         };
         let next = BuildCursor::Node(NodeId::from(3));
@@ -1704,6 +1733,8 @@ mod tests {
             name: (Node, (label.clone(), attr.clone())),
             work,
             next: Some(BuildCursor::Node(NodeId::from(11))),
+            read: 11,
+            catch_up_limit: None,
         }));
         assert_eq!(
             idx.numeric(Node, &label, &attr)
```

**File**: `graph/src/index/falkordb/graph_writes.rs` (modified, +16/-14)
```diff
@@ -382,17 +382,15 @@ pub fn edges_deleted(
 
 // ---- Index DDL ----
 
-/// CREATE INDEX: build each attribute's column from the live graph, so the index serves reads as
-/// soon as CREATE INDEX returns. Only a Range index has native columns; any other type does
-/// nothing.
+/// CREATE INDEX: create each attribute's column `Building`, its cursor at the start, and leave it to
+/// the background builder ([`online_build`](super::online_build)), which the commit that publishes
+/// the column hands it to. Until its last batch flips it `Ready`, the column serves no reads: the
+/// planner does not use it ([`Graph::is_indexed`]), and `db.indexes()` reports the index under
+/// construction. Only a Range index has native columns; any other type does nothing.
 ///
-/// Each column is created `Building` and filled by one indexer batch with no limit on its size
-/// ([`Graph::indexer_prepare`]), which reaches the end and flips it `Ready`. A batch into an empty
-/// column bulk-builds its tree, so this costs what building the column in one pass does.
-///
-/// Built here on the write thread, with the graph borrowed. It is never built through the
-/// RediSearch populate, which reaches the graph through the `Indexer`'s back-pointer. This index
-/// is part of the graph version, and keeping that reference out is the point.
+/// The column is never built through the RediSearch populate, which reaches the graph through the
+/// `Indexer`'s back-pointer. This index is part of the graph version, and keeping that reference
+/// out is the point.
 pub fn create_index(
     g: &mut Graph,
     index_type: &IndexType,
@@ -402,13 +400,15 @@ pub fn create_index(
 ) {
     if *index_type == IndexType::Range {
         for attr in attrs {
-            build_in_one_batch(g, entity, label, attr);
+            g.falkordb_index.create_building(entity, label, attr);
         }
     }
 }
 
 /// Create column `(entity, label, attr)` `Building`, replacing any column there, and fill it with
-/// one indexer batch with no limit on its size, which reaches the end and flips it `Ready`.
+/// one indexer batch with no limit on its size, which reaches the end and flips it `Ready`. A batch
+/// into an empty column bulk-builds its tree, so this costs what building the column in one pass
+/// does.
 fn build_in_one_batch(
     g: &mut Graph,
     entity: EntityType,
@@ -485,8 +485,10 @@ pub(crate) fn entity_tuples(
 }
 
 /// Index population after an RDB load: build every column that a population snapshot of
-/// `label` covers, as CREATE INDEX does ([`create_index`]). `fields` maps each attribute to its
-/// index fields, and an attribute has a native column when one of its fields is a Range field.
+/// `label` covers, before the loaded graph is published, in one indexer batch each. `fields` maps
+/// each attribute to its index fields, and an attribute has a native column when one of its fields
+/// is a Range field. Unlike CREATE INDEX ([`create_index`]), the column is `Ready` when this
+/// returns: the RDB holds no record of which indexes were still building.
 pub fn populate(
     g: &mut Graph,
     entity: EntityType,
```

**File**: `graph/src/index/falkordb/mod.rs` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ pub mod graph_writes;
 #[cfg(feature = "index-falkordb")]
 pub mod numeric;
 
+#[cfg(feature = "index-falkordb")]
+pub mod online_build;
+
 #[cfg(feature = "index-falkordb")]
 pub mod pending_writes;
 
```

**File**: `graph/src/index/falkordb/numeric.rs` (modified, +11/-0)
```diff
@@ -526,6 +526,17 @@ impl NumericIndex {
     pub fn tuples(&self) -> Vec<(u64, u64)> {
         self.tree.range_tuples(0, u64::MAX).collect()
     }
+
+    /// The column's leaf pages, shared with every version that holds them: for a test of when they
+    /// are freed.
+    #[cfg(test)]
+    pub(crate) fn pages(&self) -> Vec<Arc<[u8]>> {
+        self.tree
+            .leaves()
+            .into_iter()
+            .map(|(_, page)| page)
+            .collect()
+    }
 }
 
 #[cfg(test)]
```

**File**: `graph/src/index/falkordb/online_build.rs` (added, +566/-0)
```diff
@@ -0,0 +1,566 @@
+//! The background index builder: builds every `Building` index, in every graph, in batches, on a
+//! pool of its own.
+//!
+//! A commit that brings in a `Building` index starts a [`Job`] for it ([`MvccGraph::commit`]). A
+//! job builds one generation of one index ([`IndexEntry::generation`]): it runs one batch on the
+//! pool, and submits itself again while that generation is `Building`, unless the batch's version
+//! was refused ([`Step::Failed`]). An index dropped, or dropped and created again, is another
+//! generation, so its job ends, and the commit that created the new one started a job of its own.
+//! Each generation is started once, so no two jobs build one index. A job holds its graph weakly:
+//! once the graph is gone, so is the job. Nothing here knows about Redis: a batch publishes
+//! through the builder's [`BuildHost`].
+//!
+//! **A batch holds no lock while it reads.** It reads on a new build version of the published one
+//! ([`Graph::new_build_version`]), which only it holds, and then publishes through the host
+//! ([`MvccGraph::commit_indexer_batch`]). What committed meanwhile decides how the batch goes in;
+//! the rules writers and batches follow so that every published version stays correct, in whatever
+//! order they commit, are on [`BuildState`](super::versioned::BuildState). A batch's commit keeps
+//! the data version, so it never makes a writer's fork stale.
+//!
+//! **Stopping.** Only the Redis shutdown handler stops the builder, and only where the server tears
+//! its modules down (`RS_GLOBAL_DTORS`: the sanitizer runs). [`stop`] waits a bounded time for the
+//! pool's workers, since one may be waiting for the GIL, which the shutdown handler holds, and says
+//! whether they all exited: the handler tears GraphBLAS down only then, so a worker left behind may
+//! still free what it holds. A batch checks for the stop before it reads and again once it holds
+//! what publishing needs: after the stop, one that has not started reading does not, and one that
+//! waited to publish publishes nothing. One already reading goes on, inside the stop's wait or
+//! left behind by it. The stop is for good.
+//!
+//! [`IndexEntry::generation`]: super::versioned::IndexEntry::generation
+//! [`MvccGraph::commit`]: crate::graph::mvcc_graph::MvccGraph::commit
+//! [`MvccGraph::commit_indexer_batch`]: crate::graph::mvcc_graph::MvccGraph::commit_indexer_batch
+
+use std::sync::atomic::{AtomicBool, Ordering};
+use std::sync::{Arc, OnceLock, Weak};
+use std::time::Duration;
+
+use super::versioned::{Discarded, IndexId, IndexerCommit, PreparedBatch};
+use crate::graph::graph::Graph;
+use crate::graph::mvcc_graph::{CommitError, MvccGraph};
+use crate::threadpool::ThreadPool;
+#[cfg(test)]
+use parking_lot::{FairMutex, FairMutexGuard, Mutex};
+
+/// What the builder needs of the host its graphs live in: one for every graph, given to the builder
+/// as it starts ([`start`]). The Redis module's takes the GIL; this crate's tests have one of
+/// their own.
+pub trait BuildHost: Send + Sync {
+    /// Run `f`, which publishes a batch, holding what a writer holds to publish a version: the
+    /// host's global lock.
+    fn publish(
+        &self,
+        f: &mut dyn FnMut(),
+    );
+
+    /// Report what an operator should see: a batch whose version was refused, after which its
+    /// index's build stops. The default writes to stderr; the Redis host logs it.
+    fn warn(
+        &self,
+        message: &str,
+    ) {
+        eprintln!("{message}");
+    }
+}
+
+/// The host of this crate's tests, without Redis: its global lock is a mutex of its own, in the
+/// place of the GIL. A writer holds it to commit ([`Self::lock`]), and a batch publishes holding
+/// it. Fair, so that writers committing back to back do not keep a batch out. Only tests use it,
+/// until the crate runs on its own somewhere.
+#[cfg(test)]
+#[derive(Default)]
+pub(crate) struct LocalHost {
+    global: FairMutex<()>,
+}
+
+#[cfg(test)]
+impl LocalHost {
+    /// The global lock, which a writer holds to commit.
+    pub(crate) fn lock(&self) -> FairMutexGuard<'_, ()> {
+        self.global.lock()
+    }
+}
+
+#[cfg(test)]
+impl BuildHost for LocalHost {
+    fn publish(
+        &self,
+        f: &mut dyn FnMut(),
+    ) {
+        let _global = self.lock();
+        f();
+    }
+}
+
+/// How a job sizes its batches ([`Sizing::batch`]).
+///
+/// A build goes in batches, not in one pass, because it runs while writers write. Each batch's
+/// commit catches up, under the host's global lock, on what writers changed in its index while it
+/// read, and holds what it read in memory until then: a batch bounds both. A job's batches grow:
+/// each reads as many entities as the index's batches have read so far, between `floor` and the
+/// job's limit ([`Job::limit`]). With no writers they go 10,000, 10,000, 20,000, 40,000, ...,
+/// doubling, and reach the 4M cap on the 11th, once 5.12M entities are
```

---

### Incident Patch 3: `2b690221` (2026-11-10)
**Commit Message**: perf: SAVE no longer re-walks attributes per key or rebuilds edge matrices (#3438)

* perf: SAVE no longer re-walks attributes per key or rebuilds edge matrices (#3433, #3434)

- `AttributeStore::encode_with_range` jumps to the first entity of its
  slice (`nth_live_id`: binary search on `deleted.rank`) and steps over
  deleted ids in order, instead of walking from id 0 with a `contains`
  per id for every virtual key: quadratic in the graph size.
- The deleted-ids encoder seeks to its start the same way.
- `Encode for Tensor` writes the committed base directly when no delta
  is pending and no pair holds several edges, as `VersionedMatrix`
  already does and as C does, instead of copying every edge out and
  building a second matrix.
- `Matrix::encode` unloads a private `dup()` instead of the shared
  matrix, which read queries may be traversing lock-free during a
  foreground SAVE / DUMP / GRAPH.COPY (#3434).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: guard the source matrix during encode and the sliced treemap encode

Copilot / cubic review: a Writer holding a shallow clone reads the matrix from
inside write_buffer (fails when encode unloads the shared matrix i

**File**: `graph/src/graph/attribute_store.rs` (modified, +110/-9)
```diff
@@ -1430,15 +1430,27 @@ impl AttributeStore {
         count: u64,
         offset: u64,
     ) {
-        let mut skipped = 0u64;
-        let mut encoded = 0u64;
+        if count == 0 {
+            return;
+        }
+        // Seek straight to the `offset`-th live id. Walking from id 0 and skipping
+        // `offset` live ids one by one made a multi-key save quadratic: each of the
+        // ~N / VKEY_MAX_ENTITY_COUNT virtual keys re-walked every id before its
+        // slice, which for a 117M-edge graph was ~90% of a 90 s SAVE.
+        let Some(start) = nth_live_id(deleted, max_id, offset) else {
+            return;
+        };
 
-        for id in 0..=max_id {
-            if deleted.contains(id) {
-                continue;
-            }
-            if skipped < offset {
-                skipped += 1;
+        // Deleted ids are visited in order alongside the id walk, rather than
+        // probed with `contains` for every id.
+        let mut deleted_iter = deleted.iter();
+        deleted_iter.advance_to(start);
+        let mut next_deleted = deleted_iter.next();
+
+        let mut encoded = 0u64;
+        for id in start..=max_id {
+            if next_deleted == Some(id) {
+                next_deleted = deleted_iter.next();
                 continue;
             }
 
@@ -1462,6 +1474,35 @@ impl AttributeStore {
     }
 }
 
+/// The `n`-th (0-based) id in `0..=max_id` that is not in `deleted`, or `None`
+/// when there are not that many.
+///
+/// The number of live ids in `0..=x` is `x + 1 - deleted.rank(x)`, which is
+/// monotone in `x`, so the answer is the smallest `x` where it exceeds `n` —
+/// found by binary search in `O(log max_id)` rank queries.
+fn nth_live_id(
+    deleted: &RoaringTreemap,
+    max_id: u64,
+    n: u64,
+) -> Option<u64> {
+    // `rank(x) <= x + 1`, so this neither underflows nor overflows in u128.
+    let live_through = |x: u64| u128::from(x) + 1 - u128::from(deleted.rank(x));
+    let n128 = u128::from(n);
+    if live_through(max_id) <= n128 {
+        return None;
+    }
+    let (mut lo, mut hi) = (n, max_id);
+    while lo < hi {
+        let mid = lo + (hi - lo) / 2;
+        if live_through(mid) > n128 {
+            hi = mid;
+        } else {
+            lo = mid + 1;
+        }
+    }
+    Some(lo)
+}
+
 impl Decode<19> for AttributeStore {
     fn decode(_r: &mut dyn Reader) -> Result<Self, String> {
         unimplemented!("use decode_with_count for AttributeStore")
@@ -1974,7 +2015,7 @@ mod tests {
         ops: Vec<Op>,
     }
 
-    #[derive(Clone)]
+    #[derive(Clone, Debug, PartialEq)]
     enum Op {
         Unsigned(u64),
         Signed(i64),
@@ -2220,4 +2261,64 @@ mod tests {
             "only the in-range attribute should have been stored"
         );
     }
+
+    /// A store split across virtual keys is encoded one `(count, offset)` slice
+    /// at a time. However the live ids are sliced — deleted ids at the start, in
+    /// runs, at the end, slices wider than what is left — the slices must
+    /// concatenate to exactly the walk over every live id in order.
+    #[test]
+    fn encode_slices_concatenate_to_the_full_walk() {
+        let max_id = 60u64;
+        let deleted: RoaringTreemap = [0u64, 1, 7, 8, 9, 23, 40, 59, 60].into_iter().collect();
+        let mut store = AttributeStore::default();
+        // Every third id has an attribute, so spans and empty entities interleave.
+        let mut data: Vec<(u64, Vec<(u16, Value)>)> = (0..=max_id)
+            .filter(|id| id % 3 == 0 && !deleted.contains(*id))
+            .map(|id| (id, vec![(0, Value::Int(id as i64))]))
+            .collect();
+        store.import_attrs_resolved(&mut data);
+
+        let mut expected = Recorder::default();
+        let live: Vec<u64> = (0..=max_id).filter(|id| !deleted.contains(*id)).collect();
+        for &id in &live {
+            expected.write_unsigned(id);
+            if id % 3 == 0 {
+                expected.write_unsigned(1);
+                expected.write_unsigned(0);
+                Value::Int(id as i64).encode(&mut expected);
+            } else {
+                expected.write_unsigned(0);
+            }
+        }
+
+        let total = live.len() as u64;
+        for slice in [1u64, 2, 5, 13, total, total + 7] {
+            let mut got = Recorder::default();
+            let mut offset = 0;
+            while offset < total {
+                let count = slice.min(total - offset);
+                store.encode_with_range(&mut got, &deleted, max_id, count, offset);
+                offset += count;
+            }
+            assert_eq!(got.ops, expected.ops, "slices of {slice} disagree");
+        }
+
+        // An offset past the last live id writes nothing.
+        let mut past = Recorder::default();
+        store.encode_with_range(&mut past, &deleted, max_id, 5, total);
+        assert!(past.ops.is_empty());
+    }
+
+    #[test]
+    fn nth_live_id_skips_deleted_ids() {
+        let deleted: RoaringT
```

**File**: `graph/src/graph/graphblas/matrix.rs` (modified, +58/-4)
```diff
@@ -529,6 +529,11 @@ impl<T> Encode<19> for Matrix<T> {
         &self,
         w: &mut dyn Writer,
     ) {
+        // Unloading empties the matrix it is applied to, and a foreground SAVE,
+        // DUMP or GRAPH.COPY encodes the published version while read queries
+        // traverse it lock-free. So unload a private copy — a memcpy of the
+        // arrays — and free it with the container, never touching `self`.
+        let copy = self.dup();
         unsafe {
             let mut container: MaybeUninit<super::GxB_Container> = MaybeUninit::uninit();
             let info = GxB_Container_new(container.as_mut_ptr());
@@ -539,7 +544,7 @@ impl<T> Encode<19> for Matrix<T> {
             );
             let container = container.assume_init();
 
-            let info = GxB_unload_Matrix_into_Container(self.inner(), container, null_mut());
+            let info = GxB_unload_Matrix_into_Container(copy.inner(), container, null_mut());
             debug_assert_eq!(info, GrB_Info::GrB_SUCCESS);
 
             // Write container struct bytes. Its pointer fields are heap
@@ -568,9 +573,7 @@ impl<T> Encode<19> for Matrix<T> {
             ManuallyDrop::new(Vector::<bool>::from((*container).i)).encode(w);
             ManuallyDrop::new(Vector::<bool>::from((*container).b)).encode(w);
 
-            let info = GxB_load_Matrix_from_Container(self.inner(), container, null_mut());
-            debug_assert_eq!(info, GrB_Info::GrB_SUCCESS);
-
+            // Frees the copy's arrays with the container; `copy` is left empty.
             let mut c = container;
             let info = GxB_Container_free(&raw mut c);
             debug_assert_eq!(info, GrB_Info::GrB_SUCCESS);
@@ -2268,4 +2271,55 @@ mod tests {
         // encoding unloads and reloads the matrix; it must be intact
         assert_eq!(m.get(1, 2), Some(true));
     }
+
+    /// A foreground SAVE / DUMP / GRAPH.COPY encodes a matrix that read queries
+    /// share (a shallow clone) while they traverse it. The source must stay
+    /// readable for the whole encode, not only after it returns: a Writer
+    /// holding a clone reads the entries from inside `write_buffer`.
+    #[test]
+    fn source_matrix_stays_readable_while_encoding() {
+        struct ReadsSource {
+            reader: Matrix<bool>,
+            seen: usize,
+        }
+        impl super::Writer for ReadsSource {
+            fn write_unsigned(
+                &mut self,
+                _: u64,
+            ) {
+            }
+            fn write_signed(
+                &mut self,
+                _: i64,
+            ) {
+            }
+            fn write_double(
+                &mut self,
+                _: f64,
+            ) {
+            }
+            fn write_buffer(
+                &mut self,
+                _: &[u8],
+            ) {
+                assert_eq!(self.reader.get(1, 2), Some(true));
+                assert_eq!(self.reader.get(5, 6), Some(true));
+                assert_eq!(self.reader.get(3, 3), None);
+                self.seen += 1;
+            }
+        }
+
+        ensure_init();
+        let mut m = Matrix::<bool>::new(8, 8);
+        m.set(1, 2, true);
+        m.set(5, 6, true);
+        m.wait();
+        let mut w = ReadsSource {
+            reader: m.clone(),
+            seen: 0,
+        };
+        super::Encode::encode(&m, &mut w);
+        assert!(w.seen > 0, "the writer never ran");
+        assert_eq!(m.get(1, 2), Some(true));
+    }
 }
```

**File**: `graph/src/graph/graphblas/serialization.rs` (modified, +68/-2)
```diff
@@ -184,8 +184,14 @@ impl Encode<19> for RoaringTreemap {
         offset: u64,
     ) {
         let mut buf = Vec::with_capacity(count as usize * 8);
-        for id in self.iter().skip(offset as usize).take(count as usize) {
-            buf.extend_from_slice(&id.to_le_bytes());
+        // Seek to the `offset`-th id instead of skipping up to it, so a save split
+        // across many virtual keys does not re-walk every earlier id per key.
+        if let Some(first) = self.select(offset) {
+            let mut iter = self.iter();
+            iter.advance_to(first);
+            for id in iter.take(count as usize) {
+                buf.extend_from_slice(&id.to_le_bytes());
+            }
         }
         w.write_buffer(&buf);
     }
@@ -266,6 +272,66 @@ mod tests {
         }
     }
 
+    struct Collect(Vec<u8>);
+
+    impl Writer for Collect {
+        fn write_unsigned(
+            &mut self,
+            _: u64,
+        ) {
+        }
+        fn write_signed(
+            &mut self,
+            _: i64,
+        ) {
+        }
+        fn write_double(
+            &mut self,
+            _: f64,
+        ) {
+        }
+        fn write_buffer(
+            &mut self,
+            d: &[u8],
+        ) {
+            self.0.extend_from_slice(d);
+        }
+    }
+
+    /// A save split across virtual keys encodes the ids in slices; the slices,
+    /// seeked to a nonzero offset, must concatenate to the whole encode, including
+    /// ids spread over several 32-bit buckets and a slice past the end.
+    #[test]
+    fn deleted_entities_slices_concatenate_to_the_full_encode() {
+        let ids = [
+            0u64,
+            3,
+            4,
+            70_000,
+            70_001,
+            1 << 32,
+            (1 << 32) + 9,
+            (3 << 32) + 5,
+            u64::MAX,
+        ];
+        let bitmap: RoaringTreemap = ids.iter().copied().collect();
+        let mut whole = Collect(Vec::new());
+        bitmap.encode(&mut whole);
+        assert_eq!(whole.0.len(), ids.len() * 8);
+        for step in [1u64, 2, 4, 100] {
+            let mut sliced = Collect(Vec::new());
+            let mut offset = 0;
+            while offset < bitmap.len() {
+                bitmap.encode_with_range(&mut sliced, step, offset);
+                offset += step;
+            }
+            assert_eq!(sliced.0, whole.0, "slices of {step}");
+        }
+        let mut past = Collect(Vec::new());
+        bitmap.encode_with_range(&mut past, 5, bitmap.len());
+        assert!(past.0.is_empty());
+    }
+
     /// `count * 8` used to wrap for a payload count of `2^61`, match an empty
     /// buffer and index past its end.
     #[test]
```

**File**: `graph/src/graph/graphblas/tensor.rs` (modified, +90/-29)
```diff
@@ -1482,39 +1482,54 @@ impl Encode<19> for Tensor {
         // inline state. Single-edge pairs store the edge id directly; multi-edge
         // pairs (inline value == MULTI_EDGE) store `(edge_count | MSB)` and push
         // their full id list from `me` into the tensor section below.
-        let mut f_rows: Vec<u64> = Vec::new();
-        let mut f_cols: Vec<u64> = Vec::new();
-        let mut f_vals: Vec<u64> = Vec::new();
+        //
+        // When there is nothing pending in the deltas and no pair holds more than
+        // one edge, the base `m` already *is* that matrix — every value an edge
+        // id with the MSB clear — so it is written as is, the way
+        // `VersionedMatrix::encode` writes its base. Rebuilding it through an
+        // iterator and `build` costs three `u64` per edge in scratch vectors plus
+        // a second matrix (gigabytes, and most of a SAVE, at 10^8 edges).
+        self.wait_fwd();
         let mut multi: Vec<(u64, u64, Vec<u64>)> = Vec::new();
-        for (src, dst, inline) in self.fwd_iter(0, u64::MAX) {
-            f_rows.push(src);
-            f_cols.push(dst);
-            if inline == MULTI_EDGE {
-                let (block, key) = compound_key(src, dst);
-                let ids: Vec<u64> = self
-                    .me_block(block)
-                    .map(|me| me.iter(key, key).map(|(_, id)| id).collect())
-                    .unwrap_or_default();
-                f_vals.push(ids.len() as u64 | MSB_MASK);
-                multi.push((src, dst, ids));
-            } else {
-                f_vals.push(inline);
+        if self.dp.nvals() == 0 && self.dm.nvals() == 0 && !self.has_multi_edge() {
+            let empty = Matrix::<u64>::new(nrows, ncols);
+            self.m.encode(w);
+            empty.encode(w); // delta-plus
+            empty.encode(w); // delta-minus
+        } else {
+            let mut f_rows: Vec<u64> = Vec::new();
+            let mut f_cols: Vec<u64> = Vec::new();
+            let mut f_vals: Vec<u64> = Vec::new();
+            for (src, dst, inline) in self.fwd_iter(0, u64::MAX) {
+                f_rows.push(src);
+                f_cols.push(dst);
+                if inline == MULTI_EDGE {
+                    let (block, key) = compound_key(src, dst);
+                    let ids: Vec<u64> = self
+                        .me_block(block)
+                        .map(|me| me.iter(key, key).map(|(_, id)| id).collect())
+                        .unwrap_or_default();
+                    f_vals.push(ids.len() as u64 | MSB_MASK);
+                    multi.push((src, dst, ids));
+                } else {
+                    f_vals.push(inline);
+                }
             }
-        }
 
-        // Forward VersionedMatrix layout: base (effective), empty delta-plus,
-        // empty delta-minus. Folding dp into the base keeps the on-disk form
-        // canonical and matches what decode expects.
-        let empty = Matrix::<u64>::new(nrows, ncols);
-        if f_rows.is_empty() {
-            empty.encode(w);
-        } else {
-            let mut fm = Matrix::<u64>::new(nrows, ncols);
-            fm.build(&f_rows, &f_cols, &f_vals);
-            fm.encode(w);
+            // Forward VersionedMatrix layout: base (effective), empty delta-plus,
+            // empty delta-minus. Folding dp into the base keeps the on-disk form
+            // canonical and matches what decode expects.
+            let empty = Matrix::<u64>::new(nrows, ncols);
+            if f_rows.is_empty() {
+                empty.encode(w);
+            } else {
+                let mut fm = Matrix::<u64>::new(nrows, ncols);
+                fm.build(&f_rows, &f_cols, &f_vals);
+                fm.encode(w);
+            }
+            empty.encode(w); // delta-plus
+            empty.encode(w); // delta-minus
         }
-        empty.encode(w); // delta-plus
-        empty.encode(w); // delta-minus
 
         let total = self.edge_count();
         w.write_unsigned(total);
@@ -2493,6 +2508,52 @@ mod tests {
         }
     }
 
+    /// A single-edge tensor with nothing pending in its deltas is written
+    /// straight from its base matrix; one with pending deltas is rebuilt from
+    /// the effective view. Both must decode to the same edges.
+    #[test]
+    fn encode_decode_round_trips_with_and_without_pending_deltas() {
+        ensure_init();
+        let round_trip = |t: &Tensor| {
+            let mut tape = Tape::default();
+            t.encode(&mut tape);
+            let mut back = Tensor::decode(&mut tape).expect("decode");
+            assert!(tape.ops.is_empty(), "decode left part of the stream");
+            back.rebuild_backward();
+            back.wait();
+            back
+        };
+        let edges = |t: &Tensor| {
+            let mut e: Vec<(u64, u64, u64)> = t.fwd_iter(0, u64::MAX).collect();
+            e.sort_unstable();
+            e
+        };
+
+        let t = Tensor::new(16, 16);
+        let mut t = t.
```

#### Recent Merged Pull Requests:
- **PR #3758** (closed): ci: count passed, failed and skipped tests per server in the run summary (@dudizimber)
- **PR #3749** (2026-11-11): refactor(index): the Range column reaches its kind only through RangeKind (@DvirDukhan)
- **PR #3748** (2026-11-10): proofs: re-line Dup::dup's PROVEN rows instead of axiomatising it (@AviAvni)
- **PR #3745** (2026-11-10): proofs: re-line #3438's rows so the coverage gate passes on main (@AviAvni)
- **PR #3736** (2026-11-11): refactor(index): a Range column that answers with a Selection (@AviAvni)
- **PR #3722** (2026-11-11): test: make four flow tests pass on Valkey as well as Redis (@DvirDukhan)

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

## X. module): load on Valkey by repairing environ under RTLD_DEEPBIND (#3494)

**RULE**:
When implementing operations in `graph/src/env_snapshot.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `874b6d87`: module): load on Valkey by repairing environ under RTLD_DEEPBIND (#3494). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `graph/src/env_snapshot.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! Owned, process-lifetime copies of a C `environ` array.
//!
//! The module repairs libc's `environ` when a server loads it with
//! `RTLD_DEEPBIND` and copy-relocates `environ` (issue #3493); see
//! `sync_deepbind_environ` in the module crate. The copy lives here, apart
//! from the loader-specific lookup, so it can be unit-tested on any platform.

use std::ffi::{CStr, c_char};

/// Deep-copy a NULL-terminated `char **` environment and leak the copy.
///
/// Both the pointer array and every string are fresh allocations that are
/// never freed, so the result stays valid whatever later happens to `src`: a
/// `setenv` that `realloc`s the array, or a `putenv` caller freeing its buffer
/// after `unsetenv`. A NULL `src` yields an empty environment (a lone NULL).
///
/// # Safety
///
/// `src` must be NULL or point to a NULL-terminated array of pointers to
/// NUL-terminated strings, none of which is modified or freed during the call.
#[must_use]
pub unsafe fn leak_deep_copy(src: *const *mut c_char) -> *mut *mut c_char {
    let mut len = 0;
    // SAFETY: the caller guarantees `src` is NULL or NULL-terminated.
    while !src.is_null() && unsafe { !(*src.add(len)).is_null() } {
   
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `874b6d87` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
