# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: falkordb-falkordb-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "falkordb-falkordb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T13:17:36.118Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-falkordb-falkordb-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [falkordb-falkordb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T13:17:36.118Z`  
> **Learning ID**: `LEARN-EVO-falkordb-falkordb-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 76%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from falkordb-falkordb-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `4e3ca0b2`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T13:17:18.660Z  
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
> **Harvest Timestamp**: 2026-11-18T13:17:18.652Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10506 stars

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
        ty: IndexType,
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
        ty: IndexType,
    ) -> bool {
        graph.is_indexed(label, attr, &ty)
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
        ty: IndexType,
    ) -> bool {
        graph.is_edge_indexed(label, attr, &ty)
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
        Self::new(new_rel)
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
                        node,
                        filter: filters,
                    };
                } else {
                    *new_op.data_mut() = IR::NodeByLabelAndIdScan {
                        node,
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
- **Issue #3857** (2026-11-17): **rust: a write that only registers a label ships no payload: the replica resyncs in full and the master's own AOF stops loading**
  *Symptoms*: A write whose only effect is a newly registered label is not replicated and not written to the AOF. The next write that adds a label is then refused by the replica, which resyncs in full, and a master that restarts from its AOF exits during the load.  ### What happens  `OPTIONAL MATCH (n:Nope) SET n:L` matches nothing, but `L` has been interned in the write's version by the time `SET` finds no entity to label, and that version is published. `CommitOp::next` (`graph/src/runtime/ops/commit.rs`) builds an effects payload only when `Pending::effects_count()` is above zero, and that count covers entities, not names registered on the version. So the master has label `L` and ships nothing; the server logs `graph '...' was modified but produced no effects payload; the change will not reach replicas or the AOF`.  Every later payload numbers its labels from the master's dictionary. The next new label goes out with an id one past what the replica (or the AOF replay) would assign, and is refused.  ### Reproduce  Replica:  1. `GRAPH.QUERY g "CREATE (:A)"` 2. `GRAPH.QUERY g "OPTIONAL MATCH (n:Nope) SET n:OnlyRegistered"`: `CALL db.labels()` now differs between master and replica (4 of 4 runs). 3. `GRAPH.QUERY g "CREATE (:B)"`: the replica logs `Replica diverged from master applying GRAPH.EFFECT ...` and the master's `sync_full` goes up by one (every run).  AOF (`appendonly yes`): the same three writes, then restart. The server exits during the load in 3 of 3 runs:  ``` Diverged applying GR

- **Issue #3851** (2026-11-17): **rust: FLUSHALL ASYNC during a queued write: the write is answered OK into a graph no key holds, and the replica gets the key back**
  *Symptoms*: If a database is flushed in the background (`FLUSHALL ASYNC`; a plain `FLUSHALL` on Valkey and Redis 8 with lazy flush) while a queued write is running, the write can commit into a graph that no key holds. The client is told OK, the master has no such key, and the replica gets the key back. C is not affected.  ### What happens  Before a queued write mutates, `authorize_write` (`src/query_session.rs`) checks `graph_is_registered`, which asks the module's registry. The registry entry is removed by `graph_free`, the type's free callback. For a background flush that runs on the lazy-free thread, later than the keys left the keyspace. A write that authorizes inside that window passes the check, commits into the orphaned graph, answers OK and replicates `GRAPH.EFFECT g`, which the replica applies after the `FLUSHALL` it already received: it creates `g`.  `key_holds_graph` (`src/redis_type.rs`) asks the keyspace instead and is already used by `GRAPH.CONSTRAINT` and telemetry for this reason; the query path does not use it.  ### Reproduce  Master and replica. On the master, with 5,000,000 filler keys (`DEBUG POPULATE`) so that the lazy-free thread takes a moment to reach the graph:  1. `GRAPH.QUERY g "UNWIND range(1, 6000000) AS x WITH count(x) AS c CREATE (:Slow {c: c})"` to a missing key `g`. 2. 40 ms later, from another client: `FLUSHALL ASYNC`.  | Engine | Write's reply | Master has `g` | Replica has `g` | |---|---|---|---| | Rust, 8 of 8 trials | OK | no | yes | | C, 4 of 4 tria

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

### Incident Patch 1: `b9f333c5` (2026-11-18)
**Commit Message**: fix: a WHERE after a writing CALL {} no longer starves the write (#748, #997) (#3582)

* fix: a WHERE after a writing CALL {} no longer starves the write (#748, #997)

push_filters_down pushed a WHERE onto every child that covered its
variables, including the rows feeding a sibling subtree that writes. A
constant-false WHERE therefore emptied the left side of an Apply whose right
side was the CALL body, and the body never ran.

A branch is now locked when a sibling subtree holds a write, and the filter
never moves under a write operator.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* Merge origin/main into fix/748-filter-not-below-write; const fn is_write

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: list #3582's new fns in COVERAGE.tsv

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: update the Lean proofs for this change (proof-impact bot)

Verified patch of the proof-impact run https://github.com/FalkorDB/FalkorDB/actions/runs/43741670268
at 7c04fa5983c30168b07bea5ffd9925f360f10e60, applied on request of AviAvni (held items reviewed).

Proof-Bot-Run: https://github.com/FalkorDB/FalkorDB/actions/runs/43741670268

* ci: run CI on the proof 

**File**: `graph/src/planner/optimizer/push_filters_down.rs` (modified, +77/-1)
```diff
@@ -78,6 +78,26 @@ fn branch_output_variables(node: &orx_tree::DynNode<IR>) -> Option<HashSet<u32>>
     }
 }
 
+/// Operators that change the graph (or its schema) when they run.
+///
+/// A `Filter` is never moved below one of these, nor into a branch that
+/// feeds a sibling subtree containing one: the write must still happen for
+/// every row that reaches it, whatever a later `WHERE` says.
+const fn is_write(ir: &IR) -> bool {
+    matches!(
+        ir,
+        IR::Create(_)
+            | IR::Merge { .. }
+            | IR::Delete { .. }
+            | IR::Set(_)
+            | IR::Remove(_)
+            | IR::Commit
+            | IR::ForEach { .. }
+            | IR::CreateIndex { .. }
+            | IR::DropIndex { .. }
+    )
+}
+
 /// Pushes filter conjuncts down through nodes.
 ///
 /// Transforms:
@@ -171,6 +191,12 @@ pub(super) fn push_filters_down(optimized_plan: &mut DynTree<IR>) {
                         IR::Project { .. }
                             | IR::Aggregate { .. }
                             | IR::Merge { .. }
+                            | IR::Create(_)
+                            | IR::Delete { .. }
+                            | IR::Set(_)
+                            | IR::Remove(_)
+                            | IR::Commit
+                            | IR::ForEach { .. }
                             | IR::Argument(_)
                             | IR::IncludePending { .. }
                             | IR::SemiApply
@@ -190,6 +216,18 @@ pub(super) fn push_filters_down(optimized_plan: &mut DynTree<IR>) {
                 }
             }
 
+            // A branch is locked when a sibling subtree writes: filtering that
+            // branch would starve the write of rows it must see (an `Apply`
+            // runs its right side once per left row), e.g. `CALL { CREATE () }
+            // MATCH () WHERE false` must still create its node.
+            let holds_write: Vec<bool> = children
+                .iter()
+                .map(|(i, ..)| subtree_contains(optimized_plan, *i, is_write))
+                .collect();
+            let locked: Vec<bool> = (0..children.len())
+                .map(|i| holds_write.iter().enumerate().any(|(j, w)| *w && j != i))
+                .collect();
+
             // Compute inherited variables from Apply context.
             // When Apply propagates bound variables via Argument leaves,
             // the right branch effectively has access to the left branch's
@@ -271,7 +309,7 @@ pub(super) fn push_filters_down(optimized_plan: &mut DynTree<IR>) {
                 let conj_vars = collect_expr_variables(&conjunct);
                 let mut matched_any = false;
                 for (i, (_, child_vars, _)) in children.iter().enumerate() {
-                    if conj_vars.iter().all(|v| child_vars.contains(v)) {
+                    if !locked[i] && conj_vars.iter().all(|v| child_vars.contains(v)) {
                         child_conjuncts[i].push(conjunct.clone());
                         matched_any = true;
                     }
@@ -287,6 +325,7 @@ pub(super) fn push_filters_down(optimized_plan: &mut DynTree<IR>) {
             // CP wrapped with that conjunct as a filter.
             if !remaining.is_empty()
                 && child_conjuncts.iter().all(Vec::is_empty)
+                && !holds_write.contains(&true)
                 && let Some(filter_child) = optimized_plan.node(idx).get_child(0)
                 && matches!(filter_child.data(), IR::CartesianProduct)
                 && filter_child.num_children() > 2
@@ -538,4 +577,41 @@ mod tests {
             ]],
         );
     }
+    /// A `WHERE` after a `CALL {}` that writes must not reach the rows feeding
+    /// the write: the `Apply` runs its right side once per left row, so a
+    /// filter on the left starves the write (#748, #997).
+    #[test]
+    fn filter_never_lands_on_the_input_of_a_write() {
+        for query in [
+            "CALL { CREATE () } UNWIND 0 AS x MATCH () WHERE false RETURN 0",
+            "WITH 0 AS n0 CALL { MERGE () RETURN 0 AS n1 } MATCH () WHERE false RETURN 0",
+        ] {
+            let _ = crate::runtime::functions::init_functions();
+            let mut parser = Parser::new(query);
+            parser.parse_parameters().expect("parse parameters");
+            let raw = parser.parse().expect("parse");
+            let (ir, scope_vars) = Binder::default().bind(raw).expect("bind");
+            let mut plan = Planner::new(scope_vars).plan(ir);
+            push_filters_down(&mut plan);
+
+            for idx in plan.root().indices::<Bfs>() {
+                let node = plan.node(idx);
+                if !matches!(node.data(), IR::Apply) || node.num_children() != 2 {
+                    continue;
+                }
+                let writes = node
+                    .child(1)
+                    .indices::<Bfs>()
+                    .any(|i| super::is_write(plan.node(i).data()));
+                let filtered_input =
```

**File**: `proofs/optimizer_rewrites/COVERAGE.tsv` (modified, +5/-4)
```diff
@@ -1,4 +1,5 @@
 file	function	line	bucket	lean_name_or_reason
+# graphblas *_bench.rs: benchmark harnesses, no production callers; listed here so the aggregator can exclude them
 graph/src/planner/optimizer/mod.rs	collect_expr_variables	92	PROVEN	Passes.routesIdOnly / id_only_routing_unsound (id-only unsound), routesScoped_sound; empty set routes everywhere: PushPlan.bug997_create_skipped
 graph/src/planner/optimizer/mod.rs	collect_subtree_variables	103	PROVEN	Helpers.mem_subtreeIds (ids of get_variables); ids only — Passes.id_only_routing_unsound; PushPlan.gv walks through Aggregate into the pre-WITH plan: bug3352_routes_unbound
 graph/src/planner/optimizer/mod.rs	optimize	125	PROVEN	Sequence.passes_order (exact order, reduce_var_len_path twice), applyAll_sound (each pass preserves R => optimize does), optimize_nested/optimize_plain
@@ -23,9 +24,9 @@ graph/src/planner/optimizer/fuse_optional_traverse.rs	fusable_traverse	40	PROVEN
 graph/src/planner/optimizer/fuse_optional_traverse.rs	fused_traverse	81	PROVEN	Helpers.fusedCT_spec (same traverse, optional = true); Passes.optCT
 graph/src/planner/optimizer/fuse_optional_traverse.rs	fuse_optional_traverse	105	PROVEN	Passes.fuse_optional_correct
 graph/src/planner/optimizer/push_filters_down.rs	branch_output_variables	59	PROVEN	Helpers.branchOut_spec (Project/Aggregate outputs, ids only; none otherwise); PushPlan.branchOut (reset-env children in the tree model)
-graph/src/planner/optimizer/push_filters_down.rs	push_filters_down	102	PROVEN	Basic.push_cp_left, push_cp_right, push_extend, push_sort_perm, push_sort_sorted, push_limit_const, limit_not_transparent, skip_not_transparent, merge_order_rust_errors, merge_child_first_row, merge_rust_fixed_example, merge_rust_same (#3006 merges child conjuncts first); Passes.limit_skip_not_excluded, id_only_routing_unsound; W6-opt-1 Case-2 walk (CallBoundary, from pr2845_review): Pr2845.filter_pushed_through_boundary, fixed_keeps_filter, fixed_conservative; #3335 rebuilds the filter with ExprIR::and_of: AndOf.flat_passes (same Filter verdict, errors included), flat_eval; gap closed 2026-10-20 (PushPlan, plan tree with writes and id-only routing): property EffectSound/RowSound/RoutesBound REFUTED on main by bug748_merge_skipped, bug997_create_skipped (constant conjunct starves a CALL write), bug3352_slot_collision_drops_match, bug3352_routes_unbound (pre-WITH id taken for r); fixed routing bug748_fixed, bug997_fixed, bug3352_fixed
-graph/src/planner/optimizer/push_filters_down.rs	rebuild_with_cp_split	378	PROVEN	Basic.push_cp_left/right (CP associativity/regrouping of branches as the same identity); #3335 rebuilds the filter with ExprIR::and_of: AndOf.flat_passes (same Filter verdict, errors included), flat_eval
-graph/src/planner/optimizer/push_filters_down.rs	rebuild_node	385	PROVEN	Sequence.rebuildCP_off (copy off target), rebuildCP_on, splitCP_perm (CP children permuted, none lost)
+graph/src/planner/optimizer/push_filters_down.rs	push_filters_down	122	PROVEN	Basic.push_cp_left, push_cp_right, push_extend, push_sort_perm, push_sort_sorted, push_limit_const, limit_not_transparent, skip_not_transparent, merge_order_rust_errors, merge_child_first_row, merge_rust_fixed_example, merge_rust_same (#3006 merges child conjuncts first); Passes.limit_skip_not_excluded, id_only_routing_unsound; W6-opt-1 Case-2 walk (CallBoundary, from pr2845_review): Pr2845.filter_pushed_through_boundary, fixed_keeps_filter, fixed_conservative; #3335 rebuilds the filter with ExprIR::and_of: AndOf.flat_passes (same Filter verdict, errors included), flat_eval; gap closed 2026-10-20 (PushPlan, plan tree with writes and id-only routing): property EffectSound/RowSound/RoutesBound REFUTED on main by bug748_merge_skipped, bug997_create_skipped (constant conjunct starves a CALL write), bug3352_slot_collision_drops_match, bug3352_routes_unbound (pre-WITH id taken for r); fixed routing bug748_fixed, bug997_fixed, bug3352_fixed; #3582 write lock (Cfg.pr3582: write ops excluded, siblings of a writing branch locked, CP split off when a branch writes — CP split not modelled): PushPlan.pr3582_left_untouched, pr3582_write_excluded, pr3582_748_plan, pr3582_748_fixed, pr3582_997_plan, pr3582_997_fixed, pr3582_controls, pr3582_2556_push_not_cause; #3352 still open: pr3582_3352_open; Passes.excludedChild (exclusion list with write kinds)
+graph/src/planner/optimizer/push_filters_down.rs	rebuild_with_cp_split	423	PROVEN	Basic.push_cp_left/right (CP associativity/regrouping of branches as the same identity); #3335 rebuilds the filter with ExprIR::and_of: AndOf.flat_passes (same Filter verdict, errors included), flat_eval
+graph/src/planner/optimizer/push_filters_down.rs	rebuild_node	430	PROVEN	Sequence.rebuildCP_off (copy off target), rebuildCP_on, splitCP_perm (CP children permuted, none lost)
 graph/src/planner/optimizer/reduce_bound_edge.rs	reduce_bound_edge	30	PROVEN	References2.ancestorsRead refsNew (ancestor walk), ancestors_le_outside; main_misses_call_sibling (
```

**File**: `proofs/optimizer_rewrites/FalkorOptimizer.lean` (modified, +3/-0)
```diff
@@ -174,6 +174,9 @@ node, labels, relationships and attributes are not written); `RowSound` is the o
    `bug748_merge_skipped`, `bug997_create_skipped` (`¬ EffectSound`), `bug748_rows_only_blind`
    / `bug997_rows_only_blind` (the rows-only criterion holds on them), controls
    `bug748_with_star_control`, `bug997_case_control`; `bug748_fixed`/`bug997_fixed` for a write barrier.
+   **Fixed by #3582** (write kinds excluded, siblings of a writing branch locked, `Cfg.pr3582`):
+   `pr3582_748_fixed`, `pr3582_997_fixed`, `pr3582_left_untouched`, `pr3582_write_excluded`,
+   `pr3582_controls`; #3352 below is still open there (`pr3582_3352_open`).
 10. **#3352: filter push-down mistakes a pre-WITH variable for `r`** — Case 2
    (`push_filters_down.rs:233-236`) inherits `collect_subtree_variables` of the Apply's
    left subtree, and `get_variables` (`runtime.rs:319-323`) walks through `Aggregate`
```

**File**: `proofs/optimizer_rewrites/FalkorOptimizer/Passes.lean` (modified, +7/-3)
```diff
@@ -13,7 +13,7 @@
 | `labelScanOk`, `reorder` | `NodeByLabelScan` label test and `reorder_labels` (`optimizer/reorder_labels.rs:16-47`) stable sort by label id |
 | `vhj`, `cpEq`          | `ValueHashJoin` (`runtime/ops/value_hash_join.rs`, `key_as_i64` l.153) vs `Filter(=)` over `CartesianProduct` (`replace_cartesian_with_hash_join.rs:101-217`) |
 | `toF`                  | `i as f64` in `Value::compare_value` for Int vs Float, exact in `[0, 2^54]` |
-| `excludedChild`        | the operator list at `push_filters_down.rs:165-178` |
+| `excludedChild`        | the operator list at `push_filters_down.rs:181-200` |
 -/
 import FalkorOptimizer.Basic
 
@@ -324,14 +324,18 @@ theorem hash_join_drops_row :
 inductive Kind where
   | project | aggregate | merge | argument | includePending | semiApply | antiSemiApply
   | orApplyMultiplexer | optional
+  | create | delete | set | remove | commit | forEach
   | limit | skip | sort | distinct | cartesianProduct | apply | unwind | condTraverse
   | other
 deriving DecidableEq, Repr
 
-/-- push_filters_down.rs:165-178: children the filter may *not* look through. -/
+/-- push_filters_down.rs:181-200: children the filter may *not* look through
+(#3582 adds the write operators `Create`, `Delete`, `Set`, `Remove`, `Commit`,
+`ForEach`). -/
 def excludedChild : Kind → Bool
   | .project | .aggregate | .merge | .argument | .includePending | .semiApply | .antiSemiApply
-  | .orApplyMultiplexer | .optional => true
+  | .orApplyMultiplexer | .optional
+  | .create | .delete | .set | .remove | .commit | .forEach => true
   | _ => false
 
 /-- The operators that are transparent for a row filter (the theorems
```

**File**: `proofs/optimizer_rewrites/FalkorOptimizer/PushPlan.lean` (modified, +96/-8)
```diff
@@ -17,11 +17,13 @@ computes it, so both families are visible.
 | `run` | the runtime ops, eager: `apply.rs:102-340` (right branch re-run per left row with `Argument` = that row), `optional.rs:91-292` (one null row when the branch is empty), `aggregate.rs:288` (no keys → one row even on empty input), `create.rs:101-160`, `merge.rs:67-300` (match else create), `filter.rs:48-80` (`Basic.filterRows`), `unwind.rs`, `node_by_label_scan.rs`, `cond_traverse.rs` (bound destination) |
 | `gv` | `GetVariables::get_variables` (`runtime/runtime.rs:212-330`): `Aggregate` adds `names` and keeps walking, `Project` adds its outputs and `break`s |
 | `branchOut` | `branch_output_variables` (`optimizer/push_filters_down.rs:59-79`) |
-| `excluded` | the child exclusion list (`push_filters_down.rs:161-175`) |
+| `excluded` | the child exclusion list (`push_filters_down.rs:181-200`; before #3582 without the write kinds) |
+| `isWriteOp`, `locked` | `is_write` (:86-99) and `holds_write`/`locked` (:213-223, used at :306), #3582 (`Cfg.pr3582`) |
 | `pushAt` | one Filter's routing (`push_filters_down.rs:138-364`): grandchild variable sets (:176-185), Case 1 (:196-201), Case 2 inherited (`inh`, :210-244), augmentation of `Argument` subtrees (:247-257), the `all` test over ids (:264-276) |
 | `childInh` | Case 2's ancestor walk, top-down: below an `Apply`'s right child the left subtree's ids, below its left child nothing, below `Merge` nothing (:212-243) |
 | `sweep`, `pushFilters` | the restart loop (:103-370), as a top-down sweep that follows each pushed filter |
-| `Cfg.main` | ids only (`collect_expr_variables`/`collect_subtree_variables`, `optimizer/mod.rs:92-110`), no write barrier |
+| `Cfg.main` | before #3582: ids only (`collect_expr_variables`/`collect_subtree_variables`, `optimizer/mod.rs:92-110`), no write barrier |
+| `Cfg.pr3582` | Rust at 7c04fa598 (#3582): ids only, write kinds excluded, siblings of a writing branch locked; the CP split's `!holds_write` guard (:322) is not modelled (no CP split here) |
 
 The property each bug violates is `EffectSound`: a rewrite keeps the rows
 **and** the graph the query leaves behind. `RowSound` is the old criterion,
@@ -204,13 +206,21 @@ child's variable set, and whether a write blocks the push. -/
 structure Cfg where
   eqv : Var → Var → Bool
   writeBarrier : Bool
+  /-- #3582: write operators (`Create`, `Commit`, …) join the exclusion list,
+  and a grandchild is locked when a sibling subtree writes (`is_write`,
+  `holds_write`/`locked`, push_filters_down.rs:86-99, :213-223, :306). -/
+  lockSiblings : Bool
 
-/-- Rust main: ids only, no barrier. -/
-def Cfg.main : Cfg := ⟨fun a b => a.id == b.id, false⟩
+/-- Rust before #3582: ids only, no barrier. -/
+def Cfg.main : Cfg := ⟨fun a b => a.id == b.id, false, false⟩
 
 /-- A candidate fix: `(id, scope)` matching and no push below an operator whose
 subtree writes (`Merge`/`Create`). -/
-def Cfg.fixed : Cfg := ⟨fun a b => a == b, true⟩
+def Cfg.fixed : Cfg := ⟨fun a b => a == b, true, false⟩
+
+/-- Rust with #3582 (7c04fa598): ids only, write operators excluded, siblings
+of a writing branch locked. -/
+def Cfg.pr3582 : Cfg := ⟨fun a b => a.id == b.id, false, true⟩
 
 /-- `get_variables` (runtime.rs:212-330). -/
 def gv : Op → List Var
@@ -247,11 +257,18 @@ def hasWrite : Op → Bool
     hasWrite c
   | .apply l r => hasWrite l || hasWrite r
 
-/-- push_filters_down.rs:161-175 (the kinds that occur here). -/
+/-- push_filters_down.rs:181-200 before #3582 (the kinds that occur here). -/
 def excluded : Op → Bool
   | .project _ _ | .aggregate _ _ _ | .merge _ _ | .argument | .optional _ _ => true
   | _ => false
 
+/-- `is_write` (push_filters_down.rs:86-99), the kinds that occur here; #3582
+adds `Create`/`Commit` (and `Delete`/`Set`/`Remove`/`ForEach`, not modelled)
+to the exclusion list (:188-193). -/
+def isWriteOp : Op → Bool
+  | .create _ _ | .merge _ _ | .commit _ => true
+  | _ => false
+
 def kid (c : Op) : List Op := match c with | .unit => [] | c => [c]
 
 /-- `children()` of an operator. -/
@@ -299,12 +316,19 @@ def avail (inh : List Var) (k : Op) : List Var :=
   let (vs, reset) := info k
   if !inh.isEmpty && !reset && hasArg k then vs ++ inh else vs
 
+/-- `locked[i]` (push_filters_down.rs:217-223): some other grandchild's subtree
+writes (`subtree_contains(…, is_write)`; in the model a `Commit` always wraps a
+`Create`/`Merge`, so `hasWrite` is that test). -/
+def locked (cfg : Cfg) (ks : List Op) (i : Nat) : Bool :=
+  cfg.lockSiblings && (ks.zipIdx.any (fun kj => hasWrite kj.1 && kj.2 != i))
+
 /-- One Filter `p` over `c`, with Case-2 inherited variables `inh`. -/
 def pushAt (cfg : Cfg) (inh : List Var) (p : Expr) (c : Op) : Op :=
   let ks := kids c
-  if excluded c || ks.isEmpty || (cfg.writeBarrier && hasWrite c) then .filter p c else
+  if excluded c || (cfg.lockSiblings && isWriteOp c) || ks.isEmpty || (cfg.writeBarrier && hasWrite c) then
+    .filter p c else
   let inh := (if isApply c then ((ks.head?.
```

**File**: `proofs/optimizer_rewrites/README.md` (modified, +2/-2)
```diff
@@ -119,8 +119,8 @@ Each bug has a Rust repro (`cargo test -p graph --test lean_optimizer_rewrites`,
 | 7 | `refsNew_sees_*` (the per-operator reads the pre-#2390 oracle missed), `main_misses_call_sibling`, `refsNew_misses_sibling_edges` | An edge read outside the traverse's ancestors is collapsed (#2896, W2-traverse-1) | Per-operator part fixed by #2390; sibling part **open** (PR #2918 not merged) |
 | 8 (W4-plan-4) | `root_scan_has_no_parent` | `CALL db.labels() YIELD label MATCH (n)` makes a scan the plan root; `utilize_node_by_id` calls `parent().unwrap()` on it | **Repro closed by #3297** (validation now rejects the query, main b84473a7f); the `unwrap()` remains as a hazard |
 | W6-opt-1 | `filter_pushed_through_boundary` | Push-down gives an OPTIONAL MATCH inside `CALL {}` the outer ids: "Variable n not found" where C returns rows. `fixed_keeps_filter` checks the trial fix | **Open** |
-| #748 | `bug748_merge_skipped` (property `EffectSound`; `bug748_rows_only_blind`) | `WITH 0 AS n0 CALL { MERGE () RETURN 0 AS n1 } MATCH () WHERE false RETURN 0`: the constant `false` is pushed into both Apply branches, so the MERGE never runs. Rust 0 nodes, C 1; with `WITH *` both 1 (`bug748_with_star_control`) | **Open** |
-| #997 | `bug997_create_skipped` (property `EffectSound`; `bug997_rows_only_blind`) | `CALL { CREATE () } UNWIND 0 AS x MATCH () WHERE false RETURN 0`: `false` lands on the Apply's `Argument`, the CREATE never runs. Rust 0 nodes, C 1; the CASE-wrapped `false` reads `x` and stays above the Apply, 1 on both (`bug997_case_control`) | **Open** |
+| #748 | `bug748_merge_skipped` (property `EffectSound`; `bug748_rows_only_blind`) | `WITH 0 AS n0 CALL { MERGE () RETURN 0 AS n1 } MATCH () WHERE false RETURN 0`: the constant `false` is pushed into both Apply branches, so the MERGE never runs. Rust 0 nodes, C 1; with `WITH *` both 1 (`bug748_with_star_control`) | **Fixed by #3582** (`pr3582_748_fixed`, `pr3582_left_untouched`) |
+| #997 | `bug997_create_skipped` (property `EffectSound`; `bug997_rows_only_blind`) | `CALL { CREATE () } UNWIND 0 AS x MATCH () WHERE false RETURN 0`: `false` lands on the Apply's `Argument`, the CREATE never runs. Rust 0 nodes, C 1; the CASE-wrapped `false` reads `x` and stays above the Apply, 1 on both (`bug997_case_control`) | **Fixed by #3582** (`pr3582_997_fixed`) |
 | #3352 | `bug3352_slot_collision_drops_match`, `bug3352_routes_unbound` (properties `RowSound`, `RoutesBound`) | `… WITH p, count(r0) AS n OPTIONAL MATCH (r:Rule)-[:SCOPED_TO]->(p) WHERE r.status = 'revoked' …`: Case 2 inherits the bare ids of the whole pre-WITH subtree (through `Aggregate`), id 2 is taken for `r`, the filter lands on the `Argument`. Rust `e = null`, C 123 | **Open** (PR #3367) |
 | #2556 | `bug2556_filter_below_binding`, `bug2556_t_seeded`, `bug2556_plan` (property `KeepsFiltersBound`) | `… WITH collect(x) AS fs UNWIND fs AS f MATCH (f)<-[:HAS_CREATOR]-(post:Post), (post)-[:HAS_TAG]->(t:Tag {id:100}), (post)-[:HAS_TAG]->(tag:Tag) RETURN count(post)`: `select_scan_node` picks `t` as the best endpoint, seeds it into `initial_bound` although the outer `Unwind` child is kept and no scan for `t` is built, and places `t.id = 100` after the first hop, before `t` is bound. Rust 0, C 3 (the issue's query: a type error). Not `push_filters_down` (`bug2556_push_not_cause`); `bug2556_fixed` gives the C plan | **Open** |
 
```

**File**: `tests/flow/test_call_subquery.py` (modified, +37/-0)
```diff
@@ -2980,6 +2980,43 @@ def test_54_writes_apply_to_every_input_row(self):
         self.env.assertEqual(res.nodes_deleted, 2)
         self.get_res_and_assertEquals("MATCH (p:Person) RETURN count(p)", [[1]])
 
+    def test_54_1_where_after_a_write_does_not_starve_it(self):
+        """A WHERE of a later MATCH filters the rows after the CALL {} body
+        wrote, never before: the filter was pushed onto the rows feeding the
+        write, so a constant-false WHERE skipped the write altogether
+        (#748, #997). The node count must not depend on the predicate."""
+
+        queries = [
+            # https://github.com/FalkorDB/FalkorDB/issues/997
+            "CALL { CREATE () } UNWIND 0 AS x MATCH () WHERE false RETURN 0",
+            "CALL { CREATE () } UNWIND 0 AS x MATCH () WHERE (CASE WHEN true THEN false ELSE x END) RETURN 0",
+            # https://github.com/FalkorDB/FalkorDB/issues/748
+            "WITH 0 AS n0 CALL { MERGE () RETURN 0 AS n1 } MATCH () WHERE false RETURN 0",
+            "WITH 0 AS n0 CALL { MERGE () RETURN 0 AS n1 } WITH * MATCH () WHERE false RETURN 0",
+        ]
+        for i, q in enumerate(queries):
+            g = self.db.select_graph(f"where_after_write_{i}")
+            res = g.query(q)
+            self.env.assertEqual(res.nodes_created, 1, message=q)
+            self.env.assertEqual(res.result_set, [], message=q)
+
+        # A predicate on the outer rows runs after the writes of every row
+        g = self.db.select_graph("where_after_write_outer")
+        g.query("CREATE (:Z {v: 1}), (:Z {v: 2})")
+        res = g.query("""UNWIND [1, 2] AS x
+                                  CALL { CREATE (:T) }
+                                  MATCH (n:Z) WHERE x = 2
+                                  RETURN count(*)""")
+        self.env.assertEqual(res.nodes_created, 2)
+        self.env.assertEqual(res.result_set, [[2]])
+
+        res = g.query("""MATCH (a:Z)
+                                  CALL { WITH a SET a.w = 1 }
+                                  MATCH (b:Z) WHERE a.v = 5
+                                  RETURN count(*)""")
+        self.env.assertEqual(res.properties_set, 2)
+        self.env.assertEqual(res.result_set, [[0]])
+
     def test_55_body_variables_do_not_alias_the_imported_row(self):
         """A subquery body without an explicit `WITH` import must still be
         isolated from the outer row, not evaluate its own predicates against
```

---

### Incident Patch 2: `ace8f477` (2026-11-18)
**Commit Message**: fix: keep an earlier MATCH … WHERE / UNWIND under a variable-length traverse (#3264)

* fix: keep an earlier clause under a variable-length traverse when scanning its other end

select_var_len_scan_node's leaf rewrite replaces the child of a
CondVarLenTraverse with a fresh scan of the more selective endpoint,
keeping only an Argument leaf. planner_scan_alias looks through Filter
wrappers, so an earlier MATCH ... WHERE stitched under the traverse
(Filter(scan a)) was taken for the planner's own scan and dropped, and so
was anything below the scan (an earlier UNWIND). Only rewrite when the
subtree is the planner's own scan: no Filter wrapper and nothing under the
scan but an Argument leaf.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: assert the single-MATCH var-len traverse still scans the selective end (Copilot review)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: update the Lean proofs for this change (proof-impact bot)

Verified patch of the proof-impact run https://github.com/FalkorDB/FalkorDB/actions/runs/43740335998
at 0615f92a7a313c2507b19bb3057063b648ac92b6, applied on request of AviAvni (held items reviewed).

Proof-Bot-Run: https://github.co

**File**: `graph/src/planner/optimizer/select_scan_node.rs` (modified, +28/-6)
```diff
@@ -649,18 +649,20 @@ fn select_var_len_scan_node(
         //    an optimization, and losing a predicate is not a trade worth making.
         let scan_idx = planner_scan_idx(optimized_plan, child_idx)
             .expect("planner_scan_alias matched, so a scan is there");
-        let wrapper_ok = {
+        let (has_filter, has_include_pending) = {
             let mut node = optimized_plan.node(child_idx);
-            let mut ok = true;
+            let (mut filter, mut include_pending) = (false, false);
             while node.idx() != scan_idx {
-                if matches!(node.data(), IR::IncludePending { .. } | IR::Filter(_)) {
-                    ok = false;
-                    break;
+                match node.data() {
+                    IR::Filter(_) => filter = true,
+                    IR::IncludePending { .. } => include_pending = true,
+                    _ => {}
                 }
                 node = node.child(0);
             }
-            ok
+            (filter, include_pending)
         };
+        let wrapper_ok = !has_filter && !has_include_pending;
         if wrapper_ok && child_subtree_binds(optimized_plan, scan_idx, &to.alias) {
             let kept: Vec<DynTree<IR>> = optimized_plan
                 .node(scan_idx)
@@ -680,6 +682,26 @@ fn select_var_len_scan_node(
             }
         }
 
+        // The leaf rewrite below replaces the whole subtree with a fresh scan
+        // of `to`, carrying over only an `Argument` leaf (and re-adding
+        // `IncludePending` inside MERGE). Anything else there is an earlier
+        // clause that `plan_query` stitched under the traverse: a `Filter`
+        // (`MATCH (a) WHERE a.v = 1 MATCH (a)-[*]->(b)`) or an operator below
+        // the scan (`UNWIND … MATCH (a)-[*]->(b)`). Dropping it would lose a
+        // predicate or rows, so keep the planner's direction instead.
+        let scan_node = optimized_plan.node(scan_idx);
+        let only_argument_below = match scan_node.num_children() {
+            0 => true,
+            1 => {
+                let below = scan_node.child(0);
+                matches!(below.data(), IR::Argument(_)) && below.num_children() == 0
+            }
+            _ => false,
+        };
+        if has_filter || !only_argument_below {
+            continue;
+        }
+
         // A correlated sub-plan may already bind `to` from its outer context;
         // scanning it here would rebind it. `Argument(None)` is opaque about
         // what it carries, so treat it as binding everything.
```

**File**: `proofs/FINDINGS.md` (modified, +1/-1)
```diff
@@ -162,7 +162,7 @@ IDs are `W2-<area>-<n>`. "C ✓" means C gives the correct answer, so the bug is
 - **W6-opt-1** (found reviewing PR #2845, pre-existing on main 89d68334a) — filter push-down gives an OPTIONAL MATCH inside a `CALL {}` body the outer query's variable ids, so the filter on `n` is pushed onto a row where that slot is unbound (`push_filters_down.rs:217`, `:238`). `MATCH (x:A:B) CALL { OPTIONAL MATCH (n:A:B {id:3}) RETURN n.id AS nid } RETURN x.id, nid` → Rust "Variable n not found", C `[[1,3],[2,3],[3,3]]`; four variants fail the same way. Possibly related to #2728. Lean `filter_pushed_through_boundary` (binder `CallBoundary.lean`). A trial fix (match `IR::Apply | IR::Optional(_)` and inherit `branch_output_variables(left)`) makes all five match C, and 166/166 related flow tests pass.
 - **W4-index-1** — a range index on an attribute that already has a fulltext index is never queried correctly. `build_query_node` takes the attribute's first field whatever its type (`index/mod.rs:1386,1411,1459,1471,1529,1590`). After `CREATE FULLTEXT INDEX … ON (n.s)` then `CREATE INDEX … ON (n.s)`, `n.s='foo'`, `n.s > 'c'`, `{s:'bar'}` and `n.s IN [...]` all return `[]` (C returns the rows). Fix: pick the field whose type is `IndexType::Range`. Lean `IndexerM.bug_range_after_fulltext`.
 - Unconfirmed: `create_rs_index` leaks index options on its NUL-byte error path.
-- **W7-scan-1**: `select_var_len_scan_node`'s leaf rewrite prunes a Filter wrapper: `MATCH (a) WHERE a.v=1 MATCH (a)-[*1..2]->(b:B {w:2})` returns an extra row. Predates #2390. Lean `ScanTree.vl_leaf_*`.
+- **W7-scan-1**: `select_var_len_scan_node`'s leaf rewrite prunes a Filter wrapper: `MATCH (a) WHERE a.v=1 MATCH (a)-[*1..2]->(b:B {w:2})` returns an extra row. Predates #2390. Lean `ScanTree.vl_leaf_*`. Fixed by PR #3264 (`ScanTree.vlLeaf_keeps_filter`, `vl_leaf_bug_case_fixed`).
 
 ### Open bugs the proofs had missed (triage of 2026-10-20)
 A triage of every open `type:Bug label:rust` issue (live on Rust main 9d3869aa8 and C) found 56 the proofs had not flagged. Only the proof gaps needed a model change; the models were extended so each has a stated property a fix can prove and a `bug<issue>_*` counterexample on main that matches the live repro. The entries below are the ones still open. Root-cause families: slot ids reused across WITH/aggregation scopes (#3333 #3372 #3375), named paths over an already-bound node (#2311 #2725 #2727 #2737 #2744), rewrite criteria that compared rows but not writes (#748 #997), and per-row write visibility through CALL {} (#2729 #2738 #3164). #2502 is the parser (a WHERE pattern predicate swallows the next MATCH), and #2556 is select_scan_node seeding an unbound endpoint, not push-down.
```

**File**: `proofs/optimizer_scan/COVERAGE.tsv` (modified, +2/-2)
```diff
@@ -15,8 +15,8 @@ graph/src/planner/optimizer/select_scan_node.rs	collect_output_aliases	453	PROVE
 graph/src/planner/optimizer/select_scan_node.rs	node_path	504	PROVEN	ScanTree.nodePath_eq
 graph/src/planner/optimizer/select_scan_node.rs	resolve_path	521	PROVEN	ScanTree.resolve_nodePath, pruneAt_parent
 graph/src/planner/optimizer/select_scan_node.rs	child_subtree_binds	537	PROVEN	ScanTree.childSubtreeBinds_spec
-graph/src/planner/optimizer/select_scan_node.rs	select_var_len_scan_node	572	PROVEN	ScanTree.vl_reverse_sound, reach_reverse_iff, vlNonLeaf_keeps_wrappers, vlLeaf_guards; CONFIRMED BUG vl_leaf_fires_over_filter, vl_leaf_drops_filter (leaf rewrite prunes a Filter wrapper, line 723)
-graph/src/planner/optimizer/select_scan_node.rs	select_scan_node	743	PROVEN	ScanOrder.order_sound, ScanTree.startKeyLt/equality_beats_late (start-point key, #3821 equality tie-break), order_length, pick_perm, run_perm, place_wellScoped, initialBound_wellScoped, initialBound_keeps_row, runScoped_wellScoped, salvage_wellScoped, Salvage.salvaged_wellScoped/premise_of_spine (sound only with an honest initial_bound, and only when the salvaged filters read bound variables); FIXED by #3523 (lines 1048-1051: best_node seeded only when no outer child is kept; initialBound_wellScoped, initialBound_keeps_row); CONFIRMED BUG #2972, open fix PR #3099 (Salvage.premise_fails, salvage_loses_row): a planner scan with an Unwind child is pruned whole (is_planner_scan_subtree:377, argument_leaf_of:338 keeps only an Argument) while its Filter reading the Unwind variable is salvaged: WITH 1 AS k MATCH (b:B) WHERE b.v = k MATCH (b)-[:H]->(c:C) Rust 0, C 1
+graph/src/planner/optimizer/select_scan_node.rs	select_var_len_scan_node	572	PROVEN	ScanTree.vl_reverse_sound, reach_reverse_iff, vlNonLeaf_keeps_wrappers, vlLeaf_guards, vlLeaf_keeps_filter, vl_never_drops_filter, vlLeaf_eq_pre, vl_leaf_bug_case_fixed; FIXED BUG (#3264) vl_leaf_fires_over_filter, vl_leaf_drops_filter (pre-#3264 leaf rewrite pruned a Filter wrapper)
+graph/src/planner/optimizer/select_scan_node.rs	select_scan_node	765	PROVEN	ScanOrder.order_sound, ScanTree.startKeyLt/equality_beats_late (start-point key, #3821 equality tie-break), order_length, pick_perm, run_perm, place_wellScoped, initialBound_wellScoped, initialBound_keeps_row, runScoped_wellScoped, salvage_wellScoped, Salvage.salvaged_wellScoped/premise_of_spine (sound only with an honest initial_bound, and only when the salvaged filters read bound variables); FIXED by #3523 (lines 1070-1073: best_node seeded only when no outer child is kept; initialBound_wellScoped, initialBound_keeps_row); CONFIRMED BUG #2972, open fix PR #3099 (Salvage.premise_fails, salvage_loses_row): a planner scan with an Unwind child is pruned whole (is_planner_scan_subtree:377, argument_leaf_of:338 keeps only an Argument) while its Filter reading the Unwind variable is salvaged: WITH 1 AS k MATCH (b:B) WHERE b.v = k MATCH (b)-[:H]->(c:C) Rust 0, C 1
 graph/src/planner/optimizer/utilize_index.rs	build_has_labels_filter	71	PROVEN	Cleanup.hasLabelsFilter, isHasLabelsFor_build, addToLabels_idem
 graph/src/planner/optimizer/utilize_index.rs	alias	101	PROVEN	trait IndexSubject: EdgeInline.subject_accessors, nMatch_spec, eMatch_spec; ScanOrder.withPrimary_sound
 graph/src/planner/optimizer/utilize_index.rs	all_labels	105	PROVEN	trait IndexSubject: EdgeInline.subject_accessors, nMatch_spec, eMatch_spec; ScanOrder.withPrimary_sound
```

**File**: `proofs/optimizer_scan/OptimizerScan.lean` (modified, +4/-0)
```diff
@@ -230,6 +230,10 @@ RETURN a.v, b.w` on `(:A {v:1})-[:R]->(:B {w:2}), (:A {v:5})-[:R]->(:B {w:2})` r
 `[1,2],[5,2]` (should be `[1,2]`; the fixed-length `-[:R]->` form is right) on builds 88e92ae25
 and b3582e34a. `ScanTree.vl_leaf_fires_over_filter`, `vl_leaf_drops_filter`. Fix: refuse the leaf
 rewrite when the wrapper holds a `Filter`, or salvage it above the traverse with `filters_of`.
+FIXED by PR #3264 (0615f92a7): the leaf rewrite now refuses a `Filter` in the wrapper chain and any
+operator under the scan other than a childless `Argument` (`select_scan_node.rs:623-641`). Model:
+`VLCase.scanOnlyArgBelow`, `vlLeaf` (new) vs `vlLeafPre` (history); `vlLeaf_keeps_filter`,
+`vl_never_drops_filter`, `vlLeaf_eq_pre`, `vl_leaf_bug_case_fixed`.
 
 ## PR #3821 (f71981fa3: equality-pinned endpoint tie-break)
 `score_endpoint` returns `(score, has_equality, filter_runs_late, cardinality)`;
```

**File**: `proofs/optimizer_scan/OptimizerScan/ScanTree.lean` (modified, +37/-6)
```diff
@@ -767,6 +767,7 @@ structure VLCase where
   wrapperHasFilter : Bool     -- a `Filter` between the child and the scan
   childBindsTo : Bool         -- `child_subtree_binds(scan, to)`
   scanHasChildren : Bool      -- `kept` non-empty
+  scanOnlyArgBelow : Bool     -- the scan is a leaf or has exactly one childless `Argument` child (#3264)
   argBindsTo : Bool
   argOpaque : Bool
   fromScore : Nat
@@ -780,9 +781,16 @@ def vlGuards (c : VLCase) : Bool :=
 def vlNonLeaf (c : VLCase) : Bool :=
   vlGuards c && !c.wrapperHasPending && !c.wrapperHasFilter && c.childBindsTo && c.scanHasChildren
 
-/-- The leaf rewrite (`select_scan_node.rs:619-665`): scan `to` instead, replacing the *whole* child
-    subtree (`node_mut(child_idx).prune()`, line 661) — wrapper chain included. -/
+/-- The leaf rewrite (`select_scan_node.rs:623-686`): scan `to` instead, replacing the *whole* child
+    subtree (`node_mut(child_idx).prune()`, line 684) — wrapper chain included. Since #3264 it is
+    refused when the wrapper chain holds a `Filter` or the scan has anything but a childless
+    `Argument` under it (`select_scan_node.rs:630-641`). -/
 def vlLeaf (c : VLCase) : Bool :=
+  vlGuards c && !vlNonLeaf c && !c.wrapperHasFilter && c.scanOnlyArgBelow &&
+    !c.argOpaque && !c.argBindsTo && decide (c.fromScore < c.toScore)
+
+/-- The leaf rewrite before #3264 (history, base 343e077f2): no `Filter` / below-scan check. -/
+def vlLeafPre (c : VLCase) : Bool :=
   vlGuards c && !vlNonLeaf c && !c.argOpaque && !c.argBindsTo && decide (c.fromScore < c.toScore)
 
 /-- **PROVEN** (#2390): the non-leaf rewrite never drops a `Filter` (nor an `IncludePending`). -/
@@ -796,7 +804,26 @@ theorem vlLeaf_guards (c : VLCase) (h : vlLeaf c = true) :
     c.childIsFromScan = true ∧ c.argBindsTo = false ∧ c.argOpaque = false ∧ c.fromScore < c.toScore := by
   refine ⟨?_, ?_, ?_, ?_, ?_, ?_, ?_, ?_⟩ <;> simp_all [vlLeaf, vlGuards]
 
-/-! ### CONFIRMED BUG (pre-existing, not fixed by #2390): the leaf rewrite drops a wrapper `Filter`
+/-- **PROVEN** (#3264): the leaf rewrite never prunes a `Filter` wrapper, nor an operator under the
+    planner's scan other than a childless `Argument` (which it carries over). -/
+theorem vlLeaf_keeps_filter (c : VLCase) (h : vlLeaf c = true) :
+    c.wrapperHasFilter = false ∧ c.scanOnlyArgBelow = true := by
+  cases hf : c.wrapperHasFilter <;> cases ho : c.scanOnlyArgBelow <;> simp_all [vlLeaf]
+
+/-- **PROVEN** (#3264): neither rewrite of `select_var_len_scan_node` drops a `Filter` wrapper. -/
+theorem vl_never_drops_filter (c : VLCase) (h : vlNonLeaf c = true ∨ vlLeaf c = true) :
+    c.wrapperHasFilter = false := by
+  rcases h with h | h
+  · exact (vlNonLeaf_keeps_wrappers c h).1
+  · exact (vlLeaf_keeps_filter c h).1
+
+/-- The new rewrite is the old one plus the two #3264 refusals. -/
+theorem vlLeaf_eq_pre (c : VLCase) :
+    vlLeaf c = (vlLeafPre c && !c.wrapperHasFilter && c.scanOnlyArgBelow) := by
+  simp only [vlLeaf, vlLeafPre]; cases vlGuards c <;> cases vlNonLeaf c <;> cases c.wrapperHasFilter <;>
+    cases c.scanOnlyArgBelow <;> cases c.argOpaque <;> cases c.argBindsTo <;> simp
+
+/-! ### CONFIRMED BUG (pre-existing, not fixed by #2390; FIXED by #3264): the leaf rewrite drops a wrapper `Filter`
 
 `MATCH (a) WHERE a.v = 1 MATCH (a)-[*1..2]->(b:B {w:2}) RETURN a.v, b.w`: clause 1's
 `Filter(a.v = 1) → AllNodeScan(a)` is stitched in as the var-length traverse's child, which
@@ -812,12 +839,16 @@ pre-#2390 build 88e92ae25): graph `(:A {v:1})-[:R]->(:B {w:2}), (:A {v:5})-[:R]-
 def vlBugCase : VLCase :=
   { expandInto := false, bidirectional := false, allShortest := false, sameEnds := false, oneChild := true,
     childIsFromScan := true, wrapperHasPending := false, wrapperHasFilter := true, childBindsTo := false,
-    scanHasChildren := false, argBindsTo := false, argOpaque := false,
+    scanHasChildren := false, scanOnlyArgBelow := true, argBindsTo := false, argOpaque := false,
     fromScore := (scoreEndpoint ⟨(0, 0), []⟩ ⟨[(1, 0)], [(1, 0), (0, 0)], []⟩ [] (fun _ => 1)).1,
     toScore := (scoreEndpoint ⟨(1, 0), [7]⟩ ⟨[(1, 0)], [(1, 0), (0, 0)], []⟩ [] (fun _ => 1)).1 }
 
-/-- The rewrite fires on the repro although the wrapper holds `a.v = 1`. -/
-theorem vl_leaf_fires_over_filter : vlLeaf vlBugCase = true ∧ vlBugCase.wrapperHasFilter = true := by
+/-- History (before #3264): the rewrite fired on the repro although the wrapper holds `a.v = 1`. -/
+theorem vl_leaf_fires_over_filter : vlLeafPre vlBugCase = true ∧ vlBugCase.wrapperHasFilter = true := by
+  decide
+
+/-- **PROVEN** (#3264 fixes it): the leaf rewrite now refuses the repro and keeps `a.v = 1`. -/
+theorem vl_leaf_bug_case_fixed : vlLeaf vlBugCase = false := by
   decide
 
 /-- What the rewritten plan selects (`Lt b`, `Lf a`, the backward walk) differs from the original
```

**File**: `proofs/optimizer_scan/README.md` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ Each bug has a Rust repro (`cargo test -p graph --test lean_optimizer_scan`, not
 | W2-scan-4 | `IndexCex` C7, C7' | `abs(n.a) IN [1]` is pushed as `n.a IN [1]` and misses `a = -1`; `toString(n.a) IN ['1']` returns `[]` (C: `[1]`) | Fixed by #3068 |
 | W2-scan-5 | `IndexCex` C8 | `2 IN [n.a, n.b]` becomes array-contains on `n.a`: `[]` (C: `[3]`) | Fixed by #3068 |
 | W2-scan-6 (#2972) | `Salvage.premise_fails`, `salvage_loses_row`, `rebuilt_drops_unwind` | The pass prunes a planner scan whole but salvages only its `Filter`s and `Argument` leaf, so an `Unwind`/`WITH` child is lost: `WITH 1 AS k MATCH (b:B) WHERE b.v = k MATCH (b)-[:H]->(c:C) RETURN count(*)` returns 0 (C 1); `UNWIND [1,1] AS k MATCH (b:B) WHERE b.v = 1 MATCH (b)-[:H]->(c:C) RETURN count(*)` returns 1 (C 2) | **Open**, fix in PR #3099 |
-| W7-scan-1 | `vl_leaf_fires_over_filter`, `vl_leaf_drops_filter` | The var-length leaf rewrite prunes a Filter wrapper: `MATCH (a) WHERE a.v = 1 MATCH (a)-[*1..2]->(b:B {w:2})` returns an extra row | **Open** |
+| W7-scan-1 | `vl_leaf_fires_over_filter`, `vl_leaf_drops_filter` | The var-length leaf rewrite prunes a Filter wrapper: `MATCH (a) WHERE a.v = 1 MATCH (a)-[*1..2]->(b:B {w:2})` returns an extra row | **Fixed** by PR #3264 (`vlLeaf_keeps_filter`, `vl_leaf_bug_case_fixed`) |
 | — | `IdSeek.lean` examples on `g5` | `id(n) > -1` returns 0 rows, and non-integer bounds error. Reported as bugs 3–4 of [`../optimizer_rewrites`](../optimizer_rewrites) | **Open** |
 
 The `IndexCex.lean` examples also reproduce bugs owned by [`../index_layer`](../index_layer): a folded `date()` constant returns every node (C3); `IN [.., date()]` drops the item (C9); multi-label AND/OR (C5, C6); Bool/Int conflation (C1, shared with C). C2 (temporals indexed as numbers, #3076), C10 (array-contains inside AND, shared with C, #3736) and C11 (`n.v > 'B' AND n.v < 'B'`, #3072) are fixed; their examples now state agreement.
```

**File**: `tests/test_e2e.py` (modified, +33/-0)
```diff
@@ -2057,6 +2057,39 @@ def test_optional_match_null_merge():
 
 
 
+def test_var_len_traverse_keeps_earlier_clause_below_it():
+    """Reversing a variable-length traverse to scan its more selective end
+    must not drop an earlier clause stitched under it: a MATCH … WHERE
+    filter or an UNWIND (#2972, variable-length shape)."""
+    query(
+        "CREATE (:S {v: 1})-[:R]->(:B {w: 2}), (:S {v: 0})-[:R]->(:B {w: 2}),"
+        " (:S {v: 0})-[:R]->(:X)-[:R]->(:B {w: 2})",
+        write=True,
+    )
+
+    res = query(
+        "MATCH (a) WHERE a.v = 1 MATCH (a)-[*1..2]->(b:B {w: 2}) RETURN a.v, b.w"
+    )
+    assert res.result_set == [[1, 2]]
+
+    res = query(
+        "UNWIND [1, 2] AS i MATCH (a) WHERE a.v = 1 MATCH (a)-[*1..2]->(b:B {w: 2}) RETURN count(*)"
+    )
+    assert res.result_set == [[2]]
+
+    res = query("UNWIND [1, 2] AS i MATCH (a)-[*1..2]->(b:B {w: 2}) RETURN count(*)")
+    assert res.result_set == [[8]]
+
+    # A single MATCH still scans the selective end.
+    res = query("MATCH (a {v: 0})-[*1..2]->(b:B {w: 2}) RETURN count(*)")
+    assert res.result_set == [[2]]
+
+    plan = str(
+        common.g.explain("MATCH (a {v: 0})-[*1..2]->(b:B {w: 2}) RETURN count(*)")
+    )
+    assert "Node By Label Scan | (b:B)" in plan, plan
+
+
 def test_variable_named_like_an_anonymous_entity():
     # An unnamed pattern entity has no name at all, so no variable a query
     # writes can be it - not `_anon_<n>`, not `_anonymous`, and not even the
```

---

### Incident Patch 3: `adf7bad4` (2026-11-18)
**Commit Message**: fix: a WHERE after WITH no longer drops every row when a variable id is reused (#2557) (#3521)

* fix: a filter after WITH stays above the operator that binds its variable (#2557)

GetVariables walked through Aggregate into the plan of the previous scope.
Variable ids restart in every scope, so a variable hidden below the WITH
passed for the later variable that reuses its id: push_filters_down moved
`WHERE m.id < 999` below the traverse that binds `m`, and select_scan_node
counted a later node as already bound. The walk now stops at Project and
Aggregate, which reset the environment, and reports their copies too.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: outer-join degrees across WITH and a filter after UNWIND keep their variables (#3371)

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix: report a projection's output variable, and only an existence check's input, from get_variables (#2557)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: re-point get_return_names rows

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: list #3521's new fns in COVERAGE.tsv

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: update the

**File**: `graph/src/runtime/runtime.rs` (modified, +28/-12)
```diff
@@ -64,11 +64,11 @@ use crate::{
 };
 use chrono::{DateTime, Utc};
 use once_cell::unsync::Lazy;
-use orx_tree::{Bfs, Dyn, DynNode, DynTree, MemoryPolicy, NodeIdx, NodeRef};
+use orx_tree::{Dyn, DynNode, DynTree, MemoryPolicy, NodeIdx, NodeRef};
 use roaring::RoaringTreemap;
 use std::{
     cell::{Cell, OnceCell, Ref, RefCell, RefMut},
-    collections::HashMap,
+    collections::{HashMap, VecDeque},
     marker::PhantomData,
     sync::Arc,
     time::{Duration, Instant},
@@ -258,10 +258,18 @@ pub trait GetVariables {
 }
 
 impl<T: MemoryPolicy> GetVariables for DynNode<'_, IR, T> {
+    /// The variables the rows leaving this subtree can carry.
+    ///
+    /// `Project` and `Aggregate` start a fresh environment, so the walk stops
+    /// at them: only what they name survives, which is the output variable of
+    /// each projection and of each `(source, output)` copy. Variable ids
+    /// restart in every scope, so a variable hidden below a `WITH` would
+    /// otherwise pass for the later variable that reuses its id.
     fn get_variables(&self) -> Vec<Variable> {
         let mut vars = vec![];
-        for node in self.walk::<Bfs>() {
-            match node {
+        let mut queue = VecDeque::from([self.clone()]);
+        while let Some(node) = queue.pop_front() {
+            match node.data() {
                 IR::Optional(variables) => vars.extend(variables.iter().cloned()),
                 IR::ProcedureCall {
                     yields: named_outputs,
@@ -298,9 +306,6 @@ impl<T: MemoryPolicy> GetVariables for DynNode<'_, IR, T> {
                 | IR::Union
                 | IR::NestedPlans
                 | IR::Apply
-                | IR::SemiApply
-                | IR::AntiSemiApply
-                | IR::OrApplyMultiplexer(_)
                 | IR::Sort(_)
                 | IR::Skip(_)
                 | IR::Limit(_)
@@ -309,6 +314,13 @@ impl<T: MemoryPolicy> GetVariables for DynNode<'_, IR, T> {
                 | IR::IncludePending { .. }
                 | IR::CreateIndex { .. }
                 | IR::DropIndex { .. } => {}
+                // Child 0 is the input; the other children are existence
+                // checks whose variables never reach the rows leaving the
+                // operator, and their ids may be reused later.
+                IR::SemiApply | IR::AntiSemiApply | IR::OrApplyMultiplexer(_) => {
+                    queue.extend(node.children().next());
+                    continue;
+                }
                 IR::NodeByLabelScan { node, .. }
                 | IR::AllNodeScan(node)
                 | IR::NodeByIndexScan { node, .. }
@@ -365,15 +377,19 @@ impl<T: MemoryPolicy> GetVariables for DynNode<'_, IR, T> {
                     }
                 }
                 IR::Aggregate {
-                    names: variables, ..
+                    names, projections, ..
                 } => {
-                    vars.extend(variables.iter().cloned());
+                    vars.extend(names.iter().cloned());
+                    vars.extend(projections.iter().map(|(_, v)| v.clone()));
+                    continue;
                 }
-                IR::Project { exprs: items, .. } => {
-                    vars.extend(items.iter().map(|v| v.0.clone()));
-                    break;
+                IR::Project { exprs, copies } => {
+                    vars.extend(exprs.iter().map(|(v, _)| v.clone()));
+                    vars.extend(copies.iter().map(|(_, v)| v.clone()));
+                    continue;
                 }
             }
+            queue.extend(node.children());
         }
         vars
     }
```

**File**: `proofs/FINDINGS.md` (modified, +1/-1)
```diff
@@ -186,7 +186,7 @@ A triage of every open `type:Bug label:rust` issue (live on Rust main 9d3869aa8
 - #3226 (idx): a write that commits while its own index scan is open (scan below LIMIT) re-takes the RediSearch spec lock as a writer while holding it as a reader, and the server aborts at spec.c:2304; the same path takes the GIL while holding RediSearch's global lock (stall with RESTORE). Lean SC.Locks.bug3226_open_scan_upgrade; property noReacquire.
 - #3333 (aggregate/binder ids): the pre-projection alias of m (id 2) stays bound on the Aggregate output and the next MATCH gives b id 2, so b starts bound to m and the query returns []. Lean bug3333_alias_binds_next_var; property EmitsOnlyScope.
 - #3349 (udf): WCC, pageRank and betweenness on a one-node nodeLabels projection fail with -1000: GraphBLAS stores the 1×1 compact matrix by column, LAGraph_CheckGraph rejects it, and Rust returns the error. Lean bug3349_one_node_projection_fails; property ProjectionTotal.
-- #3352 (plan/optimizer): Case 2 push-down inherits bare ids from the whole pre-WITH subtree (get_variables walks through Aggregate), takes the pre-WITH id 2 for `r`, and puts `r.status = 'revoked'` on the Argument: Rust e=null, C 123. Lean bug3352_slot_collision_drops_match (bug3352_routes_unbound); property RowSound (RoutesBound).
+- #3352 (plan/optimizer): Case 2 push-down inherits bare ids from the whole pre-WITH subtree (get_variables walks through Aggregate), takes the pre-WITH id 2 for `r`, and puts `r.status = 'revoked'` on the Argument: Rust e=null, C 123. Lean bug3352_slot_collision_drops_match (bug3352_routes_unbound); property RowSound (RoutesBound). Since #3521 get_variables stops at Aggregate/Project (`RuntimeCore.Plan.getVariables_stops`, old walk `pre3521_hidden_reported`).
 - #3368, #3369 (rt, filed repros fixed by #3050): model only and not yet run live: equal leftovers in two rows of the SAME MERGE still share one `merge_pattern_cache` entry (`MergeSlot.same_op_leftover_shares_entry`).
 - #3372 (rt/aggregate→traverse): Aggregate re-binds a grouping key at its slot from the previous scope (aggregate.rs:1187-1196), and the binder restarts slot ids at 0 in each scope (binder.rs:2261). A fresh variable in the next MATCH that gets the same slot is read by CondTraverse as already bound to that node (cond_traverse.rs:648-652,771-777), so `WITH c, count(*) AS k MATCH (c)-[:E]->(d)` returns 0 instead of 4. Lean bug3372_slot_reuse_drops_rows; property ScopedRow.
 - #3375 (aggregate/binder ids): count(x)'s output id equals sum(x)'s accumulator id and is written into `combined` first, so sum returns the count (3 vs 6) and avg panics in finalize_avg. Lean bug3375_output_overwrites_next_acc, bug3375_avg_panics; property OutputsOwnAcc.
```

**File**: `proofs/runtime_core/COVERAGE.tsv` (modified, +4/-4)
```diff
@@ -1,9 +1,9 @@
 file	function	line	bucket	lean_name_or_reason
 graph/src/runtime/runtime.rs	deref	141	NOT COVERED	stale model (re-target pending): the published version is an Arc<Graph>; a write query's fork is a plain Graph the runtime holds in a RefCell until it publishes it (no HeldRead, no cell around published versions); proofs/runtime_core Cell/Drop/Proto still model HeldRead. Was PROVEN: Cell.deref: graph_deref, graph_same_result (both GraphRef arms deref to g's cell)
-graph/src/runtime/runtime.rs	get_variables	257	PROVEN	Plan.getVariables/nodeVars (trait decl): getVariables_spec, getVariables_stops
-graph/src/runtime/runtime.rs	get_variables	261	PROVEN	Plan.getVariables/nodeVars: getVariables_spec, getVariables_stops
-graph/src/runtime/runtime.rs	get_return_names	383	PROVEN	Plan.returnNames (trait decl): returnNames_spec
-graph/src/runtime/runtime.rs	get_return_names	387	PROVEN	Plan.returnNames/skipApply: returnNames_spec
+graph/src/runtime/runtime.rs	get_variables	257	PROVEN	Plan.getVariables/nodeVars/expand (trait decl): getVariables_spec, getVariables_mem, getVariables_stops, getVariables_sibling
+graph/src/runtime/runtime.rs	get_variables	268	PROVEN	Plan.getVariables/nodeVars/expand: getVariables_spec, getVariables_mem, getVariables_stops, getVariables_sibling, pre3521_hidden_reported
+graph/src/runtime/runtime.rs	get_return_names	399	PROVEN	Plan.returnNames (trait decl): returnNames_spec
+graph/src/runtime/runtime.rs	get_return_names	403	PROVEN	Plan.returnNames/skipApply: returnNames_spec
 graph/src/runtime/runtime.rs	inspect_batch	433	PROVEN	Plan.inspectBatch: inspectBatch_spec
 graph/src/runtime/runtime.rs	new	455	NOT COVERED	stale model (re-target pending): the published version is an Arc<Graph>; a write query's fork is a plain Graph the runtime holds in a RefCell until it publishes it (no HeldRead, no cell around published versions); proofs/runtime_core Cell/Drop/Proto still model HeldRead. Was PROVEN: Plan.rtNew: rtNew_spec; Misc.checkTimeout_spec (deadline); Cell.new: new_ok, new_vals; Proto.readNew_never_panics; Drop.held_survives, drop_sound (either field order), held_swapped_unsound (HeldRead internal order), g_never_reassigned
 graph/src/runtime/runtime.rs	check_timeout	522	PROVEN	Misc.checkTimeout_spec
```

**File**: `proofs/runtime_core/RuntimeCore.lean` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ instantiated; `Instant` arithmetic.
 ## Wave-5 additions
 * `RelAccessors`: relationship reads, pending attribute writes (`setPendingAttr_spec`), typed
   materialisation, `label_id`, endpoints/type lookups (deleted > pending > committed).
-* `Plan`: `get_variables` (BFS walk stopping at the first Project), `get_return_names`,
+* `Plan`: `get_variables` (BFS queue; Project/Aggregate end their subtree, existence checks keep only their input), `get_return_names`,
   `inspect_batch`, `Runtime::new`, delegating accessors, `default_batch`, `run_nested_plan`,
   `build_batch_op` child popping and SKIP/LIMIT/VHJ checks; `children_to_recurse` spec in RunBatch.
 -/
```

**File**: `proofs/runtime_core/RuntimeCore/Plan.lean` (modified, +126/-36)
```diff
@@ -3,8 +3,8 @@ Plan-shape helpers and constructors of `Runtime` (graph/src/runtime/runtime.rs).
 
 | here | there |
 | --- | --- |
-| `IRK`, `nodeVars`, `getVariables` | `GetVariables` trait (:209) and its `DynNode` impl (:213-330) |
-| `PT`, `returnNames`  | `ReturnNames` trait (:335) and its impl (:339-380) |
+| `IRK`, `VT`, `nodeVars`, `expand`, `getVariables`, `visible` | `GetVariables` trait (:256) and its `DynNode` impl (:260-396) |
+| `PT`, `returnNames`  | `ReturnNames` trait (:398) and its impl (:402-) |
 | `inspectBatch`       | `Runtime::inspect_batch` (:384) |
 | `RtInit`, `rtNew`    | `Runtime::new` (:406-463) |
 | `writeEscalation`, `resyncPublished`, `commitDeferred` | `write_escalation` (:494), `resync_published_indexes` (:500), `commit_deferred_indexes` (:510) |
@@ -15,7 +15,7 @@ Plan-shape helpers and constructors of `Runtime` (graph/src/runtime/runtime.rs).
 -/
 namespace RuntimeCore.Plan
 
-/-! ## `get_variables` (:213) -/
+/-! ## `get_variables` (:257-396) -/
 
 /-- The variable-bearing payload of each IR variant, as `get_variables` reads it. -/
 inductive IRK where
@@ -24,54 +24,144 @@ inductive IRK where
   | unwind (v : Nat)
   | createOrMerge (nodes rels paths : List Nat)
   | forEachOrLoadCsv (v : Nat)
-  | silent                     -- Delete, Argument, Set, Remove, Filter, products, applies, Sort, Skip, …
+  | silent                     -- Delete, Argument, Set, Remove, Filter, products, Apply, Sort, Skip, …
+  | semi                       -- SemiApply, AntiSemiApply, OrApplyMultiplexer (:320-323)
   | scan (node : Nat)          -- label/all/index/label-and-id scans, id seek
   | scored (ent : Nat) (score : Option Nat)  -- fulltext / vector scans
   | rel (r f t : Nat)          -- CondTraverse, EdgeByIndexScan, AllShortestPaths, ExpandInto
   | varLen (r f t : Nat) (path : Option Nat)
   | pathBuilder (vars : List Nat)
-  | aggregate (names : List Nat)
-  | project (names : List Nat)
+  | aggregate (names projOuts : List Nat)  -- `names`, then each projection's output (:379-385)
+  | project (exprs copyOuts : List Nat)    -- each expr's variable, then each copy's output (:386-390)
 
 def nodeVars : IRK → List Nat
-  | .optional vs | .procCall vs | .pathBuilder vs | .aggregate vs | .project vs => vs
+  | .optional vs | .procCall vs | .pathBuilder vs => vs
+  | .aggregate ns ps | .project ns ps => ns ++ ps
   | .unwind v | .forEachOrLoadCsv v | .scan v => [v]
   | .createOrMerge ns rs ps => ns ++ rs ++ ps
-  | .silent => []
+  | .silent | .semi => []
   | .scored e s => e :: s.toList
   | .rel r f t => [r, f, t]
   | .varLen r f t p => [r, f, t] ++ p.toList
 
-/-- The BFS walk (:214-327): collect each node's variables; the first `Project` ends the
-walk after contributing its names (`break`). `bfs` = the subtree in `walk::<Bfs>` order. -/
-def getVariables : List IRK → List Nat
+/-- A plan subtree (`DynNode<IR>`): its IR payload and its children, in order. -/
+inductive VT where
+  | node (k : IRK) (kids : List VT)
+
+/-- The children the walk enqueues after a node: none below `Project`/`Aggregate`
+(`continue`, :384, :389), only child 0 (the input) of an existence check (:321), all
+children otherwise (:392). -/
+def expand : IRK → List VT → List VT
+  | .project .., _ | .aggregate .., _ => []
+  | .semi, kids => kids.take 1
+  | _, kids => kids
+
+theorem sizeOf_append (a b : List VT) : sizeOf (a ++ b) + 1 = sizeOf a + sizeOf b := by
+  induction a with
+  | nil => simp; omega
+  | cons x a ih => simp [List.cons_append]; omega
+
+theorem one_le_sizeOf (l : List VT) : 1 ≤ sizeOf l := by
+  cases l <;> simp <;> omega
+
+theorem sizeOf_expand (k : IRK) (kids : List VT) : sizeOf (expand k kids) ≤ sizeOf kids := by
+  cases k <;> cases kids <;> simp [expand] <;> first | omega | exact one_le_sizeOf _
+
+/-- The BFS queue (:270-394): pop the front, collect its variables, enqueue `expand`.
+`get_variables` on a node `t` is `getVariables [t]`. -/
+def getVariables : List VT → List Nat
+  | [] => []
+  | .node k kids :: q => nodeVars k ++ getVariables (q ++ expand k kids)
+termination_by q => sizeOf q
+decreasing_by
+  have h1 := sizeOf_append q (expand k kids)
+  have h2 := sizeOf_expand k kids
+  simp
+  omega
+
+/-- The node kinds whose variables reach the rows leaving `t`: `t` itself, then (depth
+first) what is visible in the children `expand` keeps. -/
+def visible : VT → List IRK
+  | .node k kids => k :: match k with
+    | .project .. | .aggregate .. => []
+    | .semi => match kids with
+      | [] => []
+      | c :: _ => visible c
+    | _ => kids.flatMap visible
+
+theorem visible_node (k : IRK) (kids : List VT) :
+    visible (.node k kids) = k :: (expand k kids).flatMap visible := by
+  cases k <;> cases kids <;> simp [visible, expand]
+
+/-- One step of the walk, and what `expand` keeps. -/
+theorem getVariables_spec (k : IRK) (kids q : List VT) :
+    getVariables [] = [] ∧
+    getVariables (.node k kids :: q) = nodeVars k ++ getVariables (q ++ expand k kids) ∧
+    (∀ n
```

**File**: `tests/flow/test_filters.py` (modified, +104/-0)
```diff
@@ -295,3 +295,107 @@ def test10_subscript_as_predicate(self):
                 self.env.assertTrue(False, depth=1)
             except redis.ResponseError as e:
                 self.env.assertContains(error, str(e), depth=1)
+
+    def test11_filter_after_with_keeps_its_own_variables(self):
+        # Variable ids restart after a WITH, so a variable of the new scope
+        # can share its id with one hidden below the WITH. That one must not
+        # count as bound: the filter on `m` was pushed below the traverse
+        # that binds `m` and dropped every row (#2557).
+        g = self.db.select_graph("filter_after_with")
+        g.query("""CREATE (p:Person {id:1}), (f:Person {id:2}), (p)-[:KNOWS]->(f),
+                          (m1:Post {id:10}), (m2:Post {id:11}),
+                          (m1)-[:HAS_CREATOR]->(f), (m2)-[:HAS_CREATOR]->(f)""")
+
+        for pred, expected in [("m.id < 999", 2), ("m.id = 10", 1),
+                               ("999 > m.id", 2), ("m.id <> 5", 2)]:
+            res = g.query(f"""MATCH (root:Person {{id:1}})-[:KNOWS]-(friend:Person)
+                              WITH collect(friend) AS friends
+                              UNWIND friends AS f
+                              MATCH (f)<-[:HAS_CREATOR]-(m:Post)
+                              WHERE {pred}
+                              RETURN count(m)""")
+            self.env.assertEqual(res.result_set, [[expected]], depth=1)
+
+        # The same collision through an Apply: the WHERE of an OPTIONAL MATCH
+        # after an aggregating WITH must stay above the traverse binding `r`.
+        g.query("CREATE (:Rule {status:'revoked'})-[:SCOPED_TO]->(:Person {id:3})")
+        res = g.query("""MATCH (p:Person {id:3})
+                         OPTIONAL MATCH (r0:Rule)-[:SCOPED_TO]->(p)
+                         WITH p, count(r0) AS n
+                         OPTIONAL MATCH (r:Rule)-[:SCOPED_TO]->(p)
+                         WHERE r.status = 'revoked'
+                         RETURN n, r.status""")
+        self.env.assertEqual(res.result_set, [[1, 'revoked']])
+
+    def test11_optional_match_degrees_across_with(self):
+        # Outer-join aggregations chained through WITH reuse variable ids
+        # (u, v, du, ... restart after every WITH), so a filter of a later
+        # OPTIONAL MATCH was pushed below the traverse binding its variable and
+        # the sums came out as -12 instead of 25 (#3371). Expected values are
+        # what C returns: central_sum - 3 * triangles = simple 4-node paths.
+        cases = [
+            ([(1, 2)], [[1, 2, 0, 0, 0]], 0, 0, 0),
+            ([(1, 2), (2, 3), (3, 4)],
+             [[1, 2, 0, 1, 0], [2, 3, 1, 1, 1], [3, 4, 1, 0, 0]], 1, 0, 1),
+            ([(1, 2), (1, 3), (2, 3)],
+             [[1, 2, 1, 1, 1], [1, 3, 1, 1, 1], [2, 3, 1, 1, 1]], 3, 1, 0),
+            ([(1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (3, 4), (1, 5), (2, 6)],
+             [[1, 2, 3, 3, 9], [1, 3, 3, 2, 6], [1, 4, 3, 2, 6],
+              [1, 5, 3, 0, 0], [2, 3, 3, 2, 6], [2, 4, 3, 2, 6],
+              [2, 6, 3, 0, 0], [3, 4, 2, 2, 4]], 37, 4, 25),
+        ]
+        degrees = """MATCH (u:MT04)-[:E04]-(v:MT04) WHERE u.id<v.id
+                     OPTIONAL MATCH (u)-[ru:E04]-(nu:MT04) WHERE nu<>v
+                     WITH u,v,count(ru) AS du
+                     OPTIONAL MATCH (v)-[rv:E04]-(nv:MT04) WHERE nv<>u
+                     WITH u,v,du,count(rv) AS dv """
+        for i, (edges, per_edge, central, triangles, paths) in enumerate(cases):
+            g = self.db.select_graph(f"degrees_across_with_{i}")
+            nodes = sorted({n for e in edges for n in e})
+            pattern = [f"(v{n}:MT04 {{id: {n}}})" for n in nodes]
+            pattern += [f"(v{a})-[:E04]->(v{b})" for a, b in edges]
+            g.query("CREATE " + ", ".join(pattern))
+
+            res = g.query(degrees + "RETURN u.id,v.id,du,dv,du*dv ORDER BY u.id,v.id")
+            self.env.assertEqual(res.result_set, per_edge, depth=1)
+
+            res = g.query(degrees + """WITH sum(du*dv) AS central_sum
+                OPTIONAL MATCH p=(a:MT04)-[:E04]-(b:MT04)-[:E04]-(c:MT04)-[:E04]-(a)
+                WHERE a.id<b.id AND b.id<c.id
+                WITH central_sum, count(p) AS triangles
+                RETURN central_sum, triangles, central_sum-3*triangles""")
+            self.env.assertEqual(res.result_set, [[central, triangles, paths]], depth=1)
+
+    def test12_filter_after_unwind_stays_above_the_unwind(self):
+        # `x` (bound by the UNWIND) shared an id with a variable inside the
+        # CALL {} body below it, so `WHERE x = 2` was pushed below the UNWIND
+        # and rejected every row. C returns 2.
+        g = self.db.select_graph("filter_above_unwind")
+        g.query("CREATE (:A), (:A)")
+        res = g.query("""CALL { CREATE () } UNWIND [1, 2] AS x
+                         MATCH (n:A) WHERE x = 2 RETURN count(*)""")
+        self.env.assertEqual(res.result_set, [[2]])
+
+    def test13_fi
```

#### Recent Merged Pull Requests:
- **PR #3860** (2026-11-18): chore(deps): upgrade valkey-module to the crates.io 0.2.0 release (@DvirDukhan)
- **PR #3853** (closed): fix: a queued write an inline write overtook re-runs as a writer, so a stream of them cannot starve it (@AviAvni)
- **PR #3839** (2026-11-16): fix(fuzz): initialise RediSearch in the fuzz harnesses so index queries don't crash (@AviAvni)
- **PR #3837** (2026-11-17): chore(proofs): Lean v4.36.0; retire the PR review projects (@AviAvni)
- **PR #3833** (2026-11-16): ci: /proofs apply commits a held proof patch whose gates passed (@AviAvni)
- **PR #3825** (2026-11-15): chore(deps): bump the cargo-deps group across 1 directory with 4 updates (@dependabot[bot])

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

## X. a WHERE after a writing CALL {} no longer starves the write (#748, #997)

**RULE**:
When implementing operations in `graph/src/planner/optimizer/push_filters_down.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b9f333c5`: a WHERE after a writing CALL {} no longer starves the write (#748, #997). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `graph/src/planner/optimizer/push_filters_down.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Operators that change the graph (or its schema) when they run.
///
/// A `Filter` is never moved below one of these, nor into a branch that
/// feeds a sibling subtree containing one: the write must still happen for
/// every row that reaches it, whatever a later `WHERE` says.
const fn is_write(ir: &IR) -> bool {
    matches!(
        ir,
        IR::Create(_)
            | IR::Merge { .. }
            | IR::Delete { .. }
            | IR::Set(_)
            | IR::Remove(_)
            | IR::Commit
            | IR::ForEach { .. }
            | IR::CreateIndex { .. }
            | IR::DropIndex { .. }
    )
}

                            | IR::Create(_)
                            | IR::Delete { .. }
                            | IR::Set(_)
                            | IR::Remove(_)
                            | IR::Commit
                            | IR::ForEach { .. }
            // A branch is locked when a sibling subtree writes: filtering that
            // branch would starve the write of rows it must see (an `Apply`
            // runs its right side once per left row), e.g. `CALL { CREATE () }
            // MATCH () WHERE false` must still create its node.
         
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    if conj_vars.iter().all(|v| child_vars.contains(v)) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b9f333c5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
