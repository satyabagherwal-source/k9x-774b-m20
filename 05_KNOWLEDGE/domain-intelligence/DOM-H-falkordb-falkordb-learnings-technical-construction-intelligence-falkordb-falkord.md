# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: falkordb-falkordb-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "falkordb-falkordb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T22:06:35.404Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-falkordb-falkordb-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [falkordb-falkordb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T22:06:35.404Z`  
> **Learning ID**: `LEARN-EVO-falkordb-falkordb-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from falkordb-falkordb-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `41d2f20c`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T22:06:19.335Z  
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
> **Harvest Timestamp**: 2026-11-22T22:06:19.326Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10501 stars

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
        && var.key() == node_alias.key()
        && !subtree_references_variable(&filter.child(1), node_alias.key())
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
        && var.key() == node_alias.key()
        && !subtree_references_variable(&filter.child(0), node_alias.key())
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

### Core Architecture Module: `proofs/runtime_core/repro_limit.py`
```
"""Live repro for runtime_core B1/B2 (Budget.hard_cap_unsound_*): `record_cap` used as a hard stop.

Usage: python repro_limit.py PORT   (server with the Rust module, then again with the C module)
Re-run on main 256ab4d3f: Rust [] / [] / [], C [[2]] / [[30]] / [[20]].
"""
import sys, redis
r = redis.Redis(port=int(sys.argv[1]))
q = lambda s: r.execute_command("GRAPH.QUERY", "g", s)
r.delete("g")
q("CREATE (a1:A {id:1}), (b1:B {id:10}), (a2:A {id:2}), (b2:B {id:20}), (a1)-[:R]->(b1), (a2)-[:R]->(b2), (b2)-[:R]->(a2)")
print("B1a", q("MATCH (a:A)-[:R]->(b)-[:R]->(a) RETURN a.id LIMIT 1")[1])
r.delete("g")
q("CREATE (a1:A {id:1}), (b1:B {id:10}), (a2:A {id:2}), (b2:B {id:20}), (c:C {id:30}), (a1)-[:R]->(b1), (a2)-[:R]->(b2), (b2)-[:R]->(c)")
print("B1b", q("MATCH (a:A)-[:R]->(b)-[:R]->(c) RETURN c.id LIMIT 1")[1])
r.delete("g")
q("CREATE (a1:A {id:1}), (b1:B {id:10}), (a2:A {id:2}), (b2:B {id:20}), (a1)-[:R]->(b1), (a2)-[:R]->(b2)")
print("B2", q("MATCH (a:A)-[:R]->(b) WITH b SKIP 0 RETURN b.id SKIP 1 LIMIT 1")[1])

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
- **Issue #3880** (2026-11-19): **[Rust] Binder: CALL {} leaves its body's variable-length relationship marks behind**
  *Symptoms*: When a `CALL {}` body closes, the binder removes the body's scopes from `node_labels` and `match_rel_vars` (`graph/src/planner/binder.rs:864-874` on main 98e05a415). It does not remove them from `varlen_rel_var_ids`, which is keyed the same way, by `(scope_id, id)`. The outer query's next `WITH` reuses the body's scope ids.  That set decides whether `x.prop` binds on a Path-typed variable (`binder.rs:2176`). It binds for a variable-length relationship (`[r*]`) and is rejected for a named path. So a named path that lands on the `(scope_id, id)` of a body's `[r*]` is taken for a variable-length relationship, and the type check is skipped.  Repro. Rust: main 98e05a415. C: `falkordb/falkordb-server:edge-c` `sha256:2364d41f605a443eb8c89b76dcfc76abdc5e7c99d35b7f5e56d2b67fcc3529c0`.      GRAPH.QUERY g "CREATE (:N {name:'a'})-[:R {name:'r1'}]->(:N {name:'b'})-[:R {name:'r2'}]->(:N {name:'c'})"     GRAPH.QUERY g "CALL { UNWIND [1] AS u MATCH (a)-[r*]->(b) RETURN count(*) AS c } WITH c MATCH p = ()-->() RETURN CASE WHEN false THEN p.name END AS x"  - Rust: two rows, `null` and `null`. - C: `Type mismatch: expected Map, Node, Edge, Datetime, Date, Time, Duration, Null, or Point but was Path`.  In the body, `u` is id 0 and `r` is id 1 of scope 1. After the body, `WITH c` opens scope 1 again with `c` as id 0, so `p` is id 1 of scope 1, which the set still holds. Without `UNWIND [1] AS u`, `r` is id 0, nothing collides, and Rust raises the same error as C. 

- **Issue #3861** (2026-11-18): **[Rust] size()/head()/last() on a list variable is O(len) per call, so per-row use is quadratic**
  *Symptoms*: Rust engine: a function taking a `List<Any>` argument (`size`, `head`, `last`, ...) is O(len) per call, so using one large list variable per row is quadratic. The C engine is O(1) here.  Repro (`collect` then `size(ns)` per row):  ``` MATCH (a:T) WITH collect(a) AS ns UNWIND range(0, size(ns) - 1) AS i RETURN count(i % size(ns)) ```  | nodes | Rust (main) | C | |---|---|---| | 5k | 34-54 ms | 1-2 ms | | 10k | 150-217 ms | 2-4 ms | | 20k | 600-900 ms | 3-4 ms |  `head(ns)` and `last(ns)` show the same curve; `ns[i]`, `ns[i..i+1]` and `i IN ns` are flat. A real edge-creation query using `size(ns)` per row took 6.5 s on Rust against 38 ms on C. Found by the soak test.  Root cause (sampled the worker thread): all on-CPU time is in `GraphFn::validate_args_type` -> `ValueTypeOf::value_of_type` (graph/src/runtime/value.rs). For `Type::List(ty)` it walks every element and recurses even when `ty` is `Any`, which accepts everything. The variable read itself is an `Arc` clone and `size` is `v.len()`, both O(1). 

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

### Incident Patch 1: `d070f1f9` (2026-11-22)
**Commit Message**: fix: GRAPH.DELETE of indexed graphs corrupts RediSearch's shared N/A key (#3483) (#3511)

* fix: GRAPH.DELETE of indexed graphs corrupts RediSearch's shared N/A key (#3483)

graph_free drops a graph on a new thread with no GIL, and SpecHandle::drop
calls RediSearch_DropIndex without it (#726). At ea1a6f4 that path frees
RediSearch's process-global NA_rstr (IndexError_Clear), while the main thread
holds it for every index it creates. The refcount is not atomic, so updates
are lost, the key is freed while indexes still point at it, and a later free
crashes the server in RM_FreeString.

Move deps/RediSearch to FalkorDB/RediSearch#29, where index errors borrow
NA_rstr instead of refcounting it and the GC stop of a dropped index runs on
the main thread. Correct the comments that said the drop thread takes the GIL.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* docs: correct comments that misstate which locks are held

Index teardown takes no GIL (SpecHandle/OwnedIndex drop); there is no GIL
lock-order assertion; ForkGC holds only the GIL across fork(); no Drop impl
consults is_main_thread; the replica CREATE INDEX path is the async one.
Found by the RediSearch LLAPI thread audit

**File**: `deps/RediSearch` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 1317b41b3f1a2f68fea81e250b0b32a57dc7d6d1
+Subproject commit 994282d3075adae126076b0aa141b1c6ac66c0bf
```

**File**: `deps/native-deps.lock` (modified, +1/-1)
```diff
@@ -24,5 +24,5 @@ pin = v1.3.x
 [redisearch]
 path = deps/RediSearch
 url = https://github.com/FalkorDB/RediSearch.git
-rev = 1317b41b3f1a2f68fea81e250b0b32a57dc7d6d1
+rev = 994282d3075adae126076b0aa141b1c6ac66c0bf
 pin = falkordb/llapi-extensions-8.6
```

**File**: `graph/src/graph/graph.rs` (modified, +2/-3)
```diff
@@ -3752,9 +3752,8 @@ impl Graph {
                     .create_index(index_type, label, attrs, len, options)?;
                 // Same bookkeeping as `create_index`: surface the
                 // indexed attr names in `db.propertyKeys()` even if no
-                // entity has yet written to them. Critical for
-                // RDB-load and EFFECT_CREATE_INDEX (replica) paths,
-                // which go through this sync variant.
+                // entity has yet written to them. Critical for the
+                // RDB-load path, which goes through this sync variant.
                 for attr in attrs {
                     self.add_node_attribute_name(attr);
                 }
```

**File**: `graph/src/index/mod.rs` (modified, +8/-5)
```diff
@@ -956,7 +956,9 @@ impl Drop for OwnedIndex {
     fn drop(&mut self) {
         // No global lock, even for the last release: `IndexSpec_Free` touches no
         // Redis timer (it asserts the temporary-index timer is already stopped, and
-        // the ForkGC timer self-terminates by not rescheduling — RediSearch `gc.c`).
+        // the ForkGC timer self-terminates by not rescheduling — RediSearch `gc.c`)
+        // and no Redis object another thread can reach (its index errors borrow the
+        // shared "N/A" key rather than refcount it: a refcount is not atomic, #3483).
         // Only index *creation* needs it, via `RM_CreateTimer`.
         //
         // That is load-bearing for #726: an index-scan iterator drops its cloned
@@ -1000,10 +1002,11 @@ impl SpecHandle {
 impl Drop for SpecHandle {
     fn drop(&mut self) {
         // No global lock, for the same reason as `OwnedIndex::drop`: nothing here
-        // stops a timer. Load-bearing too — a reader holding the per-graph read lock
-        // can be the last holder of the spec (a concurrent `drop_index_bg` swaps the
-        // index map under it), and taking the global lock there is the #726
-        // inversion.
+        // stops a timer on this thread (`RediSearch_DropIndex` hands the GC stop to
+        // the main thread) or touches a shared Redis object. Load-bearing too — a
+        // reader holding the per-graph read lock can be the last holder of the spec
+        // (a concurrent `drop_index_bg` swaps the index map under it), and taking
+        // the global lock there is the #726 inversion.
         //
         // `DropIndex` invalidates the spec *and* releases the creation ref, so pass
         // the raw pointer via `into_raw` to avoid a second release from `OwnedIndex`.
```

**File**: `graph/src/locks.rs` (modified, +3/-2)
```diff
@@ -11,8 +11,9 @@
 //! lock deadlocked the server for six hours (issue #726). That inversion is now
 //! unrepresentable here: this crate cannot take the global lock at all, so code that
 //! holds the indexer lock has nothing to invert against. Host FFI that *does* need
-//! the global lock (the RediSearch index spec lifecycle) documents it as a
-//! precondition and relies on the caller having escalated.
+//! the global lock (RediSearch index *creation*, which registers a timer) documents
+//! it as a precondition and relies on the caller having escalated. Index teardown
+//! needs no global lock (`SpecHandle::drop`).
 //!
 //! ## Two-phase locking (mirrors C's `QueryCtx_AcquireWriteLock`)
 //!
```

**File**: `graph/src/thread_id.rs` (modified, +1/-3)
```diff
@@ -19,9 +19,7 @@ pub fn set_main_thread() {
 /// Returns true if the calling thread is the recorded main thread.
 ///
 /// If `set_main_thread` has not been called yet (e.g. unit tests that build
-/// `graph` without the module shell), this returns `false` so `Drop` impls
-/// take the GIL-acquiring branch — which itself no-ops when the FFI symbols
-/// are unresolved.
+/// `graph` without the module shell), this returns `false`.
 pub fn is_main_thread() -> bool {
     MAIN_THREAD_ID
         .get()
```

**File**: `src/commands/config_cmd.rs` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@
 //!
 //! ASYNC_DELETE and DELAY_INDEXING are settable, as they are in C, but nothing in
 //! this engine reads either one yet: graph teardown is always off-thread (see
-//! `graph_core::graph_free`, which cannot free inline — `Index::drop` takes the GIL,
-//! which the main thread already holds while the free callback runs), and the
+//! `graph_core::graph_free`, which hands the free to a spawned thread so a large
+//! graph does not stall the main thread), and the
 //! decoders always build indexes eagerly. So `SET` on them records a value and
 //! changes no behaviour; C reads both.
 //!
```

**File**: `src/commands/explain.rs` (modified, +1/-2)
```diff
@@ -39,8 +39,7 @@ fn explain(
     query: &str,
 ) -> ValkeyResult {
     // L1-read for exactly the plan build, through a session: the optimizer consults
-    // the index to pick scans, and a session is what publishes the lock mode that the
-    // GIL lock-order assertion reads (#726).
+    // the index to pick scans.
     let Plan { plan, .. } = {
         let session = QuerySession::begin(graph);
         session.with_graph(|tg| tg.graph.read().get_plan(query))
```

---

### Incident Patch 2: `f4485cd1` (2026-11-22)
**Commit Message**: fix: reject an ORDER BY aggregate whose constants differ from the projection's (max(x % 4.0) vs max(x % 3)) (#3254)

* fix: match an ORDER BY aggregate to a projection only when its constants are equal (#3236)

expr_ir_eq fell back to comparing only the ExprIR variant, so any two
constants of different types (Int vs Float, Int vs String, Null vs Int)
compared equal, and so did the payloads of Quantifier, ListComprehension,
Reduce, Case, ShortestPath and CompiledRegex. ORDER BY max(n.v % 4.0) was
bound to a projected max(n.v % 3) and the query sorted by the wrong
expression instead of failing.

Compare constants by value equality, as C's AR_EXP_Equals does with
SIValue_Compare (3 still matches 3.0, as in C), and compare every payload.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: quantifiers that differ only in kind are different ORDER BY aggregates

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: compare mixed Int/Float constants exactly; test: clean up the nodes it creates

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: drop the raw_exprs_structurally_equal rows (constant comparison changed) to NOT COVERED

Co-Authored-By: Claude Opus 5.5 <

**File**: `graph/src/parser/ast.rs` (modified, +1/-1)
```diff
@@ -569,7 +569,7 @@ pub struct NestedPlanRef<TVar> {
 }
 
 /// Quantifier types for list predicates (all, any, none, single).
-#[derive(Clone, Debug)]
+#[derive(Clone, Debug, PartialEq, Eq)]
 pub enum QuantifierType {
     All,
     Any,
```

**File**: `graph/src/planner/binder.rs` (modified, +78/-6)
```diff
@@ -36,6 +36,7 @@ use crate::runtime::value::{Value, ValueTypeOf};
 use crate::tree;
 use orx_tree::{Dfs, Dyn, DynNode, DynTree, NodeRef};
 use std::collections::{HashMap, HashSet};
+use std::mem::discriminant;
 use std::sync::Arc;
 
 /// The variables of one scope.
@@ -2869,6 +2870,25 @@ fn replace_agg_subtrees(
     new_tree
 }
 
+/// 2^63: the first float above the `i64` range, and the negation of its first
+/// float below it (`i64::MIN` is exactly `-2^63`).
+const I64_RANGE_BOUND: f64 = 9_223_372_036_854_775_808.0;
+
+/// Whether two constants are the same value. An `Int` and a `Float` match
+/// only when the float is that exact integer: `Value`'s own equality rounds the
+/// integer to `f64`, which would conflate neighbours past 2^53.
+fn constants_equal(
+    a: &Value,
+    b: &Value,
+) -> bool {
+    match (a, b) {
+        (Value::Int(i), Value::Float(f)) | (Value::Float(f), Value::Int(i)) => {
+            f.fract() == 0.0 && *f >= -I64_RANGE_BOUND && *f < I64_RANGE_BOUND && *f as i64 == *i
+        }
+        _ => a == b,
+    }
+}
+
 /// Compare two raw (pre-bind) expression trees structurally, ignoring
 /// internal `__agg_order_by_placeholder__` variables that the parser
 /// appends to aggregate functions.
@@ -2915,15 +2935,44 @@ fn raw_exprs_structurally_equal(
         b: &ExprIR<Arc<String>>,
     ) -> bool {
         match (a, b) {
-            (ExprIR::Variable(va), ExprIR::Variable(vb)) => va == vb,
+            // Constants match when they are equal values, as in C
+            // (`SIValue_Compare`): `3` matches `3.0`, `null` matches only
+            // `null`, and values of unrelated types never match.
+            (ExprIR::Constant(va), ExprIR::Constant(vb)) => constants_equal(va, vb),
+            (ExprIR::Variable(va), ExprIR::Variable(vb))
+            | (ExprIR::ListComprehension(va), ExprIR::ListComprehension(vb)) => va == vb,
             (ExprIR::FuncInvocation(fa), ExprIR::FuncInvocation(fb)) => fa.name == fb.name,
-            (ExprIR::Constant(Value::String(sa)), ExprIR::Constant(Value::String(sb))) => sa == sb,
-            (ExprIR::Constant(Value::Int(ia)), ExprIR::Constant(Value::Int(ib))) => ia == ib,
-            (ExprIR::Constant(Value::Float(fa)), ExprIR::Constant(Value::Float(fb))) => fa == fb,
-            (ExprIR::Constant(Value::Bool(ba)), ExprIR::Constant(Value::Bool(bb))) => ba == bb,
             (ExprIR::Property(pa), ExprIR::Property(pb)) => pa == pb,
             (ExprIR::Parameter(pa), ExprIR::Parameter(pb)) => pa == pb,
-            _ => std::mem::discriminant(a) == std::mem::discriminant(b),
+            (ExprIR::Case { has_subject: sa }, ExprIR::Case { has_subject: sb }) => sa == sb,
+            (
+                ExprIR::Quantifier {
+                    quantifier_type: qa,
+                    var: va,
+                },
+                ExprIR::Quantifier {
+                    quantifier_type: qb,
+                    var: vb,
+                },
+            ) => qa == qb && va == vb,
+            (ExprIR::Reduce(ra), ExprIR::Reduce(rb)) => {
+                ra.accumulator == rb.accumulator && ra.iterator == rb.iterator
+            }
+            (ExprIR::ShortestPath(sa), ExprIR::ShortestPath(sb)) => {
+                sa.rel_types == sb.rel_types
+                    && sa.min_hops == sb.min_hops
+                    && sa.max_hops == sb.max_hops
+                    && sa.directed == sb.directed
+            }
+            (ExprIR::CompiledRegex(ra), ExprIR::CompiledRegex(rb)) => {
+                ra.kind == rb.kind && ra.regex.as_str() == rb.regex.as_str()
+            }
+            // The remaining variants carry no payload, except the graph
+            // patterns (`Pattern`, `PatternComprehension`, `NestedPlan`),
+            // which are not compared: their anonymous elements get a fresh
+            // name per occurrence, so two copies of the same pattern would
+            // never compare equal.
+            _ => discriminant(a) == discriminant(b),
         }
     }
 
@@ -3048,6 +3097,29 @@ mod tests {
         }
     }
 
+    /// Mixed `Int`/`Float` constants are equal only when the float is exactly
+    /// that integer, so ids past 2^53 are not conflated.
+    #[test]
+    fn constants_equal_compares_mixed_numbers_exactly() {
+        use super::constants_equal;
+        use crate::runtime::value::Value;
+
+        assert!(constants_equal(&Value::Int(3), &Value::Float(3.0)));
+        assert!(constants_equal(&Value::Float(3.0), &Value::Int(3)));
+        assert!(!constants_equal(&Value::Int(4), &Value::Float(3.0)));
+        assert!(!constants_equal(&Value::Int(3), &Value::Float(3.5)));
+        assert!(!constants_equal(
+            &Value::Int(9_007_199_254_740_993),
+            &Value::Float(9_007_199_254_740_992.0)
+        ));
+        assert!(constants_equal(
+            &Value::Int(9_007_199_254_740_992),
+            &Value::Float(9_007_199_254_740_992.0)
+        ));
+        assert!(!constants_equal(&Value::I
```

**File**: `proofs/FINDINGS.md` (modified, +0/-1)
```diff
@@ -147,7 +147,6 @@ IDs are `W2-<area>-<n>`. "C ✓" means C gives the correct answer, so the bug is
 - Minor: `point({latitude:null, longitude:1})` gives a different error message from the same map passed as a value.
 - **W4-plan-1** — `expr_to_plan` keeps null rows under `NOT` (`planner/mod.rs:1421-1427`): `NOT(complex)` is planned as AntiSemiApply, so rows where the inner predicate is null pass. `MATCH (a:N) WHERE NOT (a.v > 1 OR (a)-->()) RETURN count(a)` → Rust 2, C 1. Tests in `lean_planner_build.rs`.
 - **W4-plan-2** — a subscript is never accepted as a boolean (`binder.rs:2304-2314`): `WHERE n.flags[0]` → "Expected boolean predicate", C 1. Same for `true AND l[0]` and `true AND -null`.
-- **W4-plan-3** — ORDER BY aggregate matched to the wrong projection: `expr_ir_eq` (`binder.rs:2653`) falls back to discriminant equality, so all Int/Float/Null/Bool/String constants compare equal. `RETURN … max(n.v % 3) AS m ORDER BY max(n.v % 4.0)` sorts by `m`; C rejects the query. **PR #3011 widens this to non-aggregate ORDER BY, so fix `expr_ir_eq` before or with #3011.**
 - Minor divergences: `false AND (1+2)` → false (C type error); `date({year:2020, month:null})` treats null as absent (C errors); `WITH r WHERE r.w = 1` on a var-length `r` is rejected (C 1).
 - **W4-parse-5 (crash)** — 2000 chained `UNWIND [1] AS xN` clauses crash the server in planning or execution (parse, validate and bind succeed up to 8000); C runs 5000.
 - Lean-only, not confirmed live (the malformed-RDB path): `set_span` stores `n as u16` (`attribute_store.rs:597`, `:608`), so 65,536+ entries per entity wrap in a malformed RDB (the GRAPH.BULK side was fixed by #3063).
```

**File**: `proofs/binder/COVERAGE.tsv` (modified, +61/-60)
```diff
@@ -1,62 +1,63 @@
 file	function	line	bucket	lean_name_or_reason
-graph/src/planner/binder.rs	Scope::get	53	PROVEN	Table.Env.find? (named entries only); Env.pushUnnamed_find, Env.has_iff_find
-graph/src/planner/binder.rs	Scope::contains_key	60	PROVEN	Table.Env.has; Env.has_iff_find
-graph/src/planner/binder.rs	Scope::insert	67	PROVEN	Table.Env.insert; Env.insert_new_eq, Env.insert_new_length, Env.insert_old_length
-graph/src/planner/binder.rs	Scope::remove	75	PROVEN	Table.Env.erase; Env.erase_find, erase_length_le
-graph/src/planner/binder.rs	Scope::lookup_anon	84	NOT COVERED	(#3302): not modelled yet
-graph/src/planner/binder.rs	Scope::push_unnamed	94	PROVEN	Table.Env.pushUnnamed; Env.pushUnnamed_length, Env.pushUnnamed_find, Env.pushUnnamed_views, pushUnnamed_covers
-graph/src/planner/binder.rs	Scope::iter	102	PROVEN	Table.Env.named; Env.keys_named, Env.pushUnnamed_views
-graph/src/planner/binder.rs	Scope::keys	107	PROVEN	Table.Env.keys; Env.keys_named, Env.pushUnnamed_views
-graph/src/planner/binder.rs	Scope::values	112	PROVEN	Table.Env.values; Env.values_length, Env.pushUnnamed_views
-graph/src/planner/binder.rs	Scope::into_values	117	PROVEN	Table.Env.values; Env.values_length; Scopes.foreachRestore_covers
-graph/src/planner/binder.rs	Scope::len	121	PROVEN	Table.Env (List.length counts named + unnamed); Env.values_length, Env.pushUnnamed_length
-graph/src/planner/binder.rs	Scope::retain	126	PROVEN	Table.Env.retain; Env.retain_keeps_unnamed; Scopes.comprehension_cleanup_breaks
-graph/src/planner/binder.rs	Binder::default	171	PROVEN	Stack.default_spec (one empty scope, no parent lookup); #2981 no MATCH relationship aliases yet (BSt.default.matchRels = [])
-graph/src/planner/binder.rs	Binder::bind	197	PROVEN	mergeSV_ge, mergeSV_covers (bind merges live + retired scope_vars)
-graph/src/planner/binder.rs	Binder::scope_vars	212	PROVEN	Stack.scopeVars_lengths (one sorted table per live scope, lengths preserved); sortedScopeVars_spec
-graph/src/planner/binder.rs	Binder::update_all_node_labels	220	PROVEN	accumulate/specScanLabels: labels_agree_match_only, accumulate_bound_match_only, labels_leak_fixed, create_new_keeps_labels (#3049; pre3049_labels_leak historical); REMOVE ignored, RemoveLabels.bug3450_remove_label_kept_across_with (open #3450, property StampedLabelsHeld)
-graph/src/planner/binder.rs	Binder::update_graph_labels	258	PROVEN	Stack.updNode_replace (MATCH: accumulated set), updNode_union (OPTIONAL: own labels kept + accumulated added), updNode_none, updNode_idem
-graph/src/planner/binder.rs	Binder::current_env	337	PROVEN	Stack.BSt.current, current_setCurrent
-graph/src/planner/binder.rs	Binder::current_env_mut	343	PROVEN	Stack.current_setCurrent, setCurrent_outer (only the innermost table changes)
-graph/src/planner/binder.rs	Binder::push_scope	349	PROVEN	Stack.push_current, push_toSt (empty child table, parent = old current, p2c/cfp kept)
-graph/src/planner/binder.rs	Binder::commit_scope	354	PROVEN	Stack.commit_spec
-graph/src/planner/binder.rs	Binder::bind_ir	360	PROVEN	BindIR.bindIR (every arm) : shortestOk_iff, match_shortest_unbound, match_nonbool, match_rel_reused / match_records_rels / relReused_fresh / relReused_unnamed (#2981: a named relationship variable of an earlier MATCH is rejected; aliases are Table.Alias, unnamed ones skipped), optional_labels_restored, mergeOk_*, unwind_order, delete_nonentity, return_star_empty, yieldLoop_ok/yield_duplicate/yield_requires_entity, bindYield_alias/hidden, query_seq, union_columns/union_state; foreachRestore_covers; unionCheck_ok_iff
-graph/src/planner/binder.rs	Binder::bind_call_subquery	844	PROVEN	BindIR.bindCallSubquery: callSubquery_nonreturning, callSubquery_collision, subqueryReturns_noInternal, callSubquery_covers; Scopes.callBody_query_disjoint; #2981 pruneMatchRels_spec (the body's MATCH relationship aliases do not leak out); #3891 pruneVarlen_spec, pruneVarlen_prop_on_path (the body's [r*] marks do not leak out: a later path with the same key still rejects p.prop)
-graph/src/planner/binder.rs	Binder::bind_call_body	971	NOT COVERED	(#3302): not modelled yet
-graph/src/planner/binder.rs	Binder::build_import_projections	1132	NOT COVERED	(#3302): not modelled yet
-graph/src/planner/binder.rs	Binder::validate_import_with	1152	PROVEN	validateImport_ok, validateImport_rejects_expr
-graph/src/planner/binder.rs	Binder::bind_projection	1208	NOT COVERED	(#3302): not modelled yet
-graph/src/planner/binder.rs	Binder::bind_graph	1480	PROVEN	rustBind vs specBind: agree_on_outer_refs, node_attr_on_rel_rust_accepts, node_attr_on_own_rel_accepts, node_attr_later_rel, node_attr_later_node_rejected, foldGrow_mono, q2923_fixed, defRels_named_only (#2981 defRels: named relationship aliases defined first; Elem aliases are Table.Alias), rel_attr_forward_node, self_reference_ok; defineName_ignores_parent; merged_occurrences (endpoint shares the node's merged attrs) abstracted: Elem.node carries every occurrence's attrs
-graph/src/planner/binder.rs	Binder::bind_graph
```

**File**: `proofs/binder/FalkorBinder.lean` (modified, +7/-5)
```diff
@@ -67,7 +67,7 @@ proofs/planner_build `RemoveVerified`; the issue's CREATE/MERGE half does not re
 | `RC`, `bindIR`, `shortestOk`, `mergeOk`, `yieldLoop`, `bindYield`, `bindCallSubquery`, `importProjections`, `createCheck` (BindIR.lean) | `bind_ir` :262, `bind_call_subquery` :716, `build_import_projections` :984, `bind_graph_create` :1562 |
 | `mayBool`, `mayEntity`, `validate` (Types.lean) | `expr_may_return_boolean` :2323, `expr_may_return_entity` :2392, `validate_boolean_operands(_impl)` :2297/2301 |
 | `nodeToValue`, `collectConstArgs`, `foldCall`, `rewriteStruct`, `rewriteRegex` (Fold.lean) | `expr_tree_to_value` :2465, `collect_constant_args` :2497, folding :2124, `rewrite_struct_constructor` :2515, `rewrite_compiled_regex` :2580 |
-| `exprIrEq`, `strip`/`eqS`, `structEq`, `replaceAgg` (AggEq.lean) | `expr_ir_eq` :2682, `nodes_eq` :2652, `raw_exprs_structurally_equal` :2644, `replace_agg_subtrees` :2614 |
+| `constEq`, `exprIrEq`, `strip`/`eqS`, `structEq`, `replaceAgg` (AggEq.lean) | `constants_equal` :2843, `expr_ir_eq` :2896, `nodes_eq` :2866, `raw_exprs_structurally_equal` :2858, `replace_agg_subtrees` :2809 (#3254) |
 
 ## Proven (one line each)
 * `fresh_not_used`, `mint_new_covers`, `reinsert_covers`: minting under a new key is fresh and keeps the table covering.
@@ -93,7 +93,8 @@ proofs/planner_build `RemoveVerified`; the issue's CREATE/MERGE half does not re
   `bind_iterable_outer`; per-arm `bindIR` theorems (`shortestOk_iff`, `mergeOk_*`, `yieldLoop_ok`,
   `callSubquery_covers`, `importProjections_covers`, `createCheck_*`); `mayBool_sound_except`, `mayEntity_eq`;
   `nodeToValue_sound`/`_complete`, `foldCall_sound`, `rewriteStruct_shape`, `rewriteRegex_spec`;
-  `nodesEq_refl`/`_symm`, `exprIrEq_exact`, `replaceAgg_id`/`_root`.
+  `nodesEq_refl`/`_symm`, `exprIrEq_exact`, `replaceAgg_id`/`_root`; #3254 `exprIrEq_exact_any_kind`,
+  `const_kinds_distinguished`, `order_by_float_rejected`/`_equal` (bug 9 fixed).
 * #2845 CALL entry projection (`CallBoundary`, folded in from the retired pr2845_review):
   `Pr2845.bodyNew_entry`, `importProj_spec`, `entry_ids_below`, `body_own_unbound`,
   `body_import_value`, `union_branch_label_fixed` (#3027), `pushed_read_unbound` (W6-opt-1).
@@ -139,13 +140,14 @@ proofs/planner_build `RemoveVerified`; the issue's CREATE/MERGE half does not re
    `RETURN true AND -null` → Rust error, C `null`. Lean `getElement_rejected`, `negate_rejected`
    (`mayBool_sound_except`: sound for every other variant). Fix: move `GetElement` (and the null-capable
    unary/list forms) to the "runtime-typed → true" arm.
-9. **ORDER BY aggregate matched to the wrong projection** (NEW, `expr_ir_eq` binder.rs:2682 falls back to
+9. **ORDER BY aggregate matched to the wrong projection** (FIXED by #3254: constants compared by value,
+   quantifier kinds compared; Lean `const_kinds_distinguished`, `order_by_float_rejected`; history below; `expr_ir_eq` binder.rs:2682 falls back to
    `discriminant` equality, so every two `Constant`s of different kinds — Int vs Float, Null vs Int,
    Bool vs Int, String vs Int — and any two quantifiers compare equal): `CREATE (:N {g:1, v:3}), (:N {g:2, v:4})`,
    `MATCH (n:N) RETURN n.g AS g, max(n.v % 3) AS m ORDER BY max(n.v % 4.0)` → Rust rows `[1,0],[2,1]`
    (sorted by `m`), C `failed to map aggregation expression within ORDER BY clause, please use alias`
    (openCypher order by `max(v % 4.0)` would be `[2,1],[1,0]`); with `% 4` (Int) Rust also rejects.
-   Lean `order_by_wrong_aggregate`, `const_kinds_conflated`. Fix: compare `Constant` values with
+   Lean `pre3254_order_by_wrong_aggregate`, `pre3254_const_kinds_conflated`. Fix: compare `Constant` values with
    type-aware equality (`Value` equality, not discriminant) and compare quantifier kinds.
 
 ## Spec vs C disagreements (not Rust-vs-C bugs)
@@ -175,7 +177,7 @@ proofs/planner_build `RemoveVerified`; the issue's CREATE/MERGE half does not re
 * #3011: generalises `replace_agg_subtrees` to `replace_projected_subtrees` (non-aggregate ORDER BY
   expressions repeating a projection read its alias), guarded by `is_alias_rewritable`, which admits
   `Constant(Bool|Int|Float|String)` — exactly the kinds `expr_ir_eq` conflates with each other
-  (`const_kinds_conflated`). With it, bug 9 would extend to plain expressions, e.g.
+  (`pre3254_const_kinds_conflated`; fixed by #3254). Before #3254, bug 9 would extend to plain expressions, e.g.
   `RETURN n.v % 3 AS k ORDER BY n.v % 4.0` (sorted by `k`). Fix bug 9 first (or compare constants by value).
 
 ## Gaps
```

**File**: `proofs/binder/FalkorBinder/AggEq.lean` (modified, +170/-72)
```diff
@@ -5,29 +5,34 @@
 | --- | --- |
 | `RV`, `RD`, `RE` | raw (pre-bind) `ExprIR<Arc<String>>` payloads and trees |
 | `disc` | `std::mem::discriminant` of the `ExprIR` variant |
-| `isAggPlaceholder` | binder.rs:2631-2633 |
-| `exprIrEq` | `expr_ir_eq` binder.rs:2665-2683 |
-| `nodesEq` | `nodes_eq` binder.rs:2635-2663 |
-| `structEq` | `raw_exprs_structurally_equal` binder.rs:2627-2684 |
-| `replaceAgg` | `replace_agg_subtrees` binder.rs:2597-2622 |
-
-Floats are opaque codes compared by a parameter `feq` (f64 `==`, so NaN ≠ NaN).
-
-* `nodesEq_refl` / `nodesEq_symm`: an equivalence when `feq` is.
-* `nodesEq_sound`: equal trees are equal up to placeholders — **only** when no
-  constant pair of different kinds (Int vs Float, Null vs …) and no quantifier
-  /comprehension payloads differ; `const_kinds_conflated` is the counterexample.
-* CONFIRMED bug: `max(n.v % 3)` and `max(n.v % 4.0)` compare equal (the
-  `Constant` fallback compares only the discriminant), so
-  `RETURN n.g AS g, max(n.v % 3) AS m ORDER BY max(n.v % 4.0)` sorts by `m`.
+| `constEq` | `constants_equal` binder.rs:2843-2853 (`Value` `==` = `compare_value` value.rs:1256) |
+| `isAggPlaceholder` | binder.rs:2862-2864 |
+| `exprIrEq` | `expr_ir_eq` binder.rs:2896-2939 |
+| `nodesEq` | `nodes_eq` binder.rs:2866-2894 |
+| `structEq` | `raw_exprs_structurally_equal` binder.rs:2858-2942 |
+| `replaceAgg` | `replace_agg_subtrees` binder.rs:2809-2834 |
+
+Floats are opaque codes compared by a parameter `feq` (f64 `==`, so NaN ≠ NaN);
+`fint f = some i` says the float `f` is exactly the `i64` `i` (`fract() == 0`,
+in `[-2^63, 2^63)`, `f as i64 == i`). Other constants (lists, maps, temporals, …)
+are `other ty x`, equal per `oeq ty` within one type and never across types
+(`Value::order` is injective on types).
+
+* `nodesEq_refl` / `nodesEq_symm`: an equivalence when `feq`/`oeq` are.
+* `exprIrEq_exact`, `exprIrEq_exact_any_kind`: exact on every value-compared payload.
+* `const_kinds_distinguished`, `order_by_float_rejected`, `order_by_float_equal`:
+  #3254 fixed W4-plan-3 — `max(n.v % 3)` no longer matches `max(n.v % 4.0)`,
+  still matches `max(n.v % 3.0)`. The pre-#3254 counterexamples are kept as
+  `pre3254_const_kinds_conflated` / `pre3254_order_by_wrong_aggregate`.
+* `patterns_by_variant`: graph patterns are still compared by variant only.
 * `replaceAgg_id`: with no matching aggregate the ORDER BY tree is unchanged;
-  `replaceAgg_sound`: every replacement is justified by `structEq`.
+  `matchItem_spec`: every replacement is justified by `structEq`.
 -/
 namespace FalkorBinder.Agg
 
 /-- `Value`s that occur as constants in raw expressions. -/
 inductive RV
-  | null | bool (b : Bool) | int (i : Int) | float (f : Nat) | str (s : String) | other (tag : Nat)
+  | null | bool (b : Bool) | int (i : Int) | float (f : Nat) | str (s : String) | other (ty : Nat) (x : Nat)
   deriving DecidableEq, Repr
 
 inductive RD
@@ -38,6 +43,10 @@ inductive RD
   | param (p : String)
   | quant (kind : Nat) (v : String)
   | listComp (v : String)
+  | case (hasSubject : Bool)
+  | reduce (acc it : String)
+  | shortest (rels : List String) (minHops : Nat) (maxHops : Option Nat) (directed : Bool)
+  | regex (kind : Nat) (src : String)
   | other (tag : Nat)
   deriving DecidableEq, Repr
 
@@ -50,7 +59,8 @@ def RE.d : RE → RD | .node d _ => d
 /-- Variant discriminant: payloads are ignored. -/
 def disc : RD → Nat
   | .var _ => 0 | .func _ _ => 1 | .const _ => 2 | .prop _ => 3 | .param _ => 4
-  | .quant _ _ => 5 | .listComp _ => 6 | .other t => 7 + t
+  | .quant _ _ => 5 | .listComp _ => 6 | .case _ => 7 | .reduce _ _ => 8
+  | .shortest _ _ _ _ => 9 | .regex _ _ => 10 | .other t => 11 + t
 
 def placeholder : String := "__agg_order_by_placeholder__"
 
@@ -61,9 +71,37 @@ def isAggPlaceholder : RD → Bool
 theorem isAggPlaceholder_iff (d : RD) : isAggPlaceholder d = true ↔ d = .var placeholder := by
   cases d <;> simp [isAggPlaceholder]
 
-variable (feq : Nat → Nat → Bool)
+variable (feq : Nat → Nat → Bool) (fint : Nat → Option Int) (oeq : Nat → Nat → Nat → Bool)
+
+/-- `constants_equal`: Int/Float exact, otherwise `Value` equality. -/
+def constEq : RV → RV → Bool
+  | .int i, .float f => fint f == some i
+  | .float f, .int i => fint f == some i
+  | .null, .null => true
+  | .bool a, .bool b => a == b
+  | .int a, .int b => a == b
+  | .float a, .float b => feq a b
+  | .str a, .str b => a == b
+  | .other t a, .other u b => t == u && oeq t a b
+  | _, _ => false
 
 def exprIrEq : RD → RD → Bool
+  | .const a, .const b => constEq feq fint oeq a b
+  | .var a, .var b => a == b
+  | .listComp a, .listComp b => a == b
+  | .func a _, .func b _ => a == b
+  | .prop a, .prop b => a == b
+  | .param a, .param b => a == b
+  | .case a, .case b => a == b
+  | .quant k a, .quant l b => k == l && a == b
+  | .reduce a i, .reduce b j => a == b && i == j
+  | .shortest r mn mx d, .shortest r' mn' mx' d' => r == r' && mn == mn' && mx == mx' && d == d'
+  | .regex k s, .
```

**File**: `proofs/binder/README.md` (modified, +3/-2)
```diff
@@ -67,7 +67,8 @@ openCypher binds a pattern left to right, clause by clause.
 | `bind_paren`, `bind_andOr_paren` | `(x)` binds exactly like `x`, and nested AND/OR bind flat (since #3335) | `BindExpr.lean` |
 | `mayBool_sound_except`, `mayEntity_eq` | The boolean and entity type checks, and their exact exceptions | `Types.lean` |
 | `nodeToValue_sound`, `foldCall_sound` | Constant folding gives the same value as evaluation | `Fold.lean` |
-| `exprIrEq_exact` | `expr_ir_eq` is exact on expressions it can compare by value | `AggEq.lean` |
+| `exprIrEq_exact`, `exprIrEq_exact_any_kind` | `expr_ir_eq` is exact on expressions it can compare by value; since #3254 constants of different kinds never match | `AggEq.lean` |
+| `order_by_float_rejected`, `order_by_float_equal` | `ORDER BY max(n.v % 4.0)` no longer matches `max(n.v % 3)`; `% 3.0` still does (#3254) | `AggEq.lean` |
 | `importProj_spec`, `entry_ids_below`, `body_import_value` | A `CALL {}` body's entry projection (#2845) imports exactly the listed variables, below the body's own ids | `CallBoundary.lean` |
 
 ### How `mint_fresh_iff` and the covering lemmas fit together
@@ -92,7 +93,7 @@ Each bug has a Rust repro (`cargo test -p graph --test lean_binder`, not committ
 | W2-binder-6 | `pre3049_labels_leak`, `labels_leak_fixed` | Labels from CREATE and from pattern comprehensions tighten an earlier MATCH scan: 0 or 1 rows where C returns 3 | **Fixed by PR #3049** (`with_node_labels_rolled_back`) |
 | W2-binder-7 | `defineName_ignores_parent` | A pattern predicate in `WITH … WHERE` rebinds a parent variable as a fresh one: 3 rows where C returns 1 | **Open** (PR #3062 not merged) |
 | W4-plan-2 | `getElement_rejected`, `negate_rejected` | `WHERE n.flags[0]` → "Expected boolean predicate" (C: 1); same for `true AND l[0]` and `true AND -null` | **Open** |
-| W4-plan-3 | `order_by_wrong_aggregate`, `const_kinds_conflated` | `expr_ir_eq` treats all Int/Float/Null/Bool/String constants as equal, so `ORDER BY max(n.v % 4.0)` sorts by the alias of `max(n.v % 3)`; C rejects the query | **Open**; PR #3011 would widen it to non-aggregate ORDER BY, so fix this first |
+| W4-plan-3 | `pre3254_order_by_wrong_aggregate`, `pre3254_const_kinds_conflated` | `expr_ir_eq` treated all Int/Float/Null/Bool/String constants as equal, so `ORDER BY max(n.v % 4.0)` sorted by the alias of `max(n.v % 3)`; C rejects the query | **Fixed** by #3254 (`order_by_float_rejected`) |
 | W6-opt-1 | `pushed_read_unbound` | Filter push-down gives an OPTIONAL MATCH inside `CALL {}` the outer query's ids: "Variable n not found" where C returns rows | **Open** |
 | #1334 | `bug1334_pattern_predicate_declares_var` (property `PatternPredDeclaresNothing`) | A WHERE pattern predicate may mint a new named variable: `MATCH (n0) WITH * WHERE () -- (n1) RETURN *` binds and returns every `n0`; C rejects it (issue #1334; the C error message is not recorded here) | **Open** |
 | #3450 | `bug3450_remove_label_kept_across_with` (property `StampedLabelsHeld`, `RemoveLabels.lean`) | `REMOVE a:A` leaves `A` in the accumulated label set, which `WITH a` copies and `update_all_node_labels` stamps on the next MATCH: `MATCH (a:A) REMOVE a:A WITH a MATCH (a)-[:R]->(b)` gives 0 rows, C 1. The fixed stamp `specStamp` satisfies the property (`specStamp_held`). The issue's CREATE/MERGE back-propagation half does not reproduce | **Open** |
```

**File**: `tests/test_e2e.py` (modified, +40/-0)
```diff
@@ -2057,6 +2057,46 @@ def test_optional_match_null_merge():
 
 
 
+def test_order_by_aggregate_matches_projection_only_on_equal_constants():
+    """An ORDER BY aggregate binds to a projected aggregate only when their
+    constants are equal values, as in C (#3236): `3` matches `3.0`, but `4.0`
+    does not match `3`, and `null` does not match `7`."""
+    query("UNWIND range(1, 6) AS i CREATE (:N {g: i % 2, v: i})", write=True)
+    try:
+        for order_by in [
+            "max(n.v % 4.0)",
+            "max(coalesce(n.x, null))",
+            "max(n.v % '3')",
+        ]:
+            try:
+                common.g.query(
+                    f"MATCH (n:N) RETURN n.g AS g, max(n.v % 3) AS m, max(coalesce(n.x, 7)) AS c ORDER BY {order_by}"
+                )
+            except ResponseError as e:
+                assert "failed to map aggregation expression" in str(e), order_by
+            else:
+                assert False, f"ORDER BY {order_by} should be rejected"
+
+        for order_by in ["max(n.v % 3)", "max(n.v % 3.0)"]:
+            res = query(
+                f"MATCH (n:N) RETURN n.g AS g, max(n.v % 3) AS m ORDER BY {order_by} DESC, g"
+            )
+            assert res.result_set == [[0, 2], [1, 2]], order_by
+
+        # quantifiers that differ only in kind are different aggregates
+        projected = "max(all(x IN [1, 2] WHERE x > 1))"
+        query_exception(
+            f"MATCH (n:N) RETURN n.g AS g, {projected} AS m ORDER BY max(any(x IN [1, 2] WHERE x > 1))",
+            "failed to map aggregation expression",
+        )
+        res = query(
+            f"MATCH (n:N) RETURN n.g AS g, {projected} AS m ORDER BY {projected}, g"
+        )
+        assert res.result_set == [[0, False], [1, False]]
+    finally:
+        query("MATCH (n:N) DETACH DELETE n", write=True)
+
+
 def test_call_optional_match_filter_not_pushed_with_outer_variable_ids():
     """A filter in an OPTIONAL MATCH inside a CALL {} body must stay on the
     body's own rows: variable ids are per scope, so the body's `n` must not
```

---

### Incident Patch 3: `256ab4d3` (2026-11-22)
**Commit Message**: fix: a write that keeps losing its version runs as a writer after a bounded retry (#3559) (#3578)

* fix: a write that keeps losing its version runs as a writer after 3 retries (#3559)

A queued write matches as a reader and is retried when another writer
commits underneath it. The loop had no bound, and each retry restarted
TIMEOUT and the latency clock, so under a steady stream of inline writes
it never finished (C holds the write lock for the whole query).

After MAX_STALE_RETRIES stale runs the write runs as a writer (GIL and
write lock first, re-authorized like an escalation), which cannot be made
stale. All attempts share one clock, so TIMEOUT and the slow log count
from the first attempt.

Closes #3559

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* fix: escalate sooner after a slow stale run and bound GRAPH.BULK's retry (#3559)

Measured with 30 samples: each stale run of the starved write wastes about
39 ms, so three of them cost more than C's single pass. A stale run that
took 10 ms or more is now not retried as a reader. GRAPH.BULK's build loop
had the same unbounded retry and now falls back to a writer the same way.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED

**File**: `proofs/redis_layer/COVERAGE.tsv` (modified, +73/-72)
```diff
@@ -120,57 +120,57 @@ src/graph_core.rs	ThreadedGraph::new	603	PROVEN	GraphCore.TG.new: TG.new_idle (u
 src/graph_core.rs	ThreadedGraph::from_mvcc	620	PROVEN	GraphCore.TG.fromMvcc: TG.new_idle (unbounded write channel, #3014)
 src/graph_core.rs	execute_query	639	PROVEN	RoQuery.ro_never_writes, GraphCore.executeQuery/admissionKept: ro_write_rejected, read_releases_admission (#3014)
 src/graph_core.rs	execute_profile	721	PROVEN	GraphCore.profileDetect/admissionKept: profileDetect_write, read_releases_admission (#3014)
-src/graph_core.rs	execute_query_write	783	PROVEN	GraphCore.executeWrite (#3290 retry loop): executeWrite_first, stale_run_silent
-src/graph_core.rs	try_query_write	833	PROVEN	GraphCore.writeSteps/abandonSteps (#3657 infallible write_version, Stale on abandon; #3850/#3851 refused finish_write abandons and fails): reply_after_commit, reply_only_after_commit, failed_no_commit, unkeyed_refused, stale_run_silent, unregistered_not_stale
-src/graph_core.rs	WriteAttempt::from	822	PROVEN	GraphCore.Attempt.ofString: ofString_not_stale
-src/graph_core.rs	reply_profile	933	PROVEN	GraphCore.profileDepth/profileOps (#2390: all ops, plain depth): profileDepth_eq, profileDepth_commit_counts, profileOps_all
-src/graph_core.rs	BlockedClient::new	970	AXIOMATISED	RM_BlockClient/UnblockClient + BlockedClientMeasureTime* (Redis API)
-src/graph_core.rs	BlockedClient::drop	978	AXIOMATISED	RM_BlockClient/UnblockClient + BlockedClientMeasureTime* (Redis API)
-src/graph_core.rs	compute_effective_timeout	996	PROVEN	Args.rustTimeout: rustTimeout_write_pq, rustTimeout_rw_uniform (#2998 fixed by #3000 2e8172d76), rustTimeout_le_max, rustTimeout_pos, rustTimeout_exceeds, rustTimeout_write_ignores_pq
-src/graph_core.rs	reply_invalid_graph_version	1035	PROVEN	GraphCore.invalidVersionBytes: invalidVersion_shape
-src/graph_core.rs	admit	1049	PROVEN	GraphCore.admitQ: admit_bounded, capped (QueueSlot::try_acquire; never waits)
-src/graph_core.rs	query_mut	1060	PROVEN	GraphCore.dispatch/admitQ (#3014): stale_version, inline_uncapped, capped, admit_bounded
-src/graph_core.rs	query_sync	1264	PROVEN	GraphCore.syncOutcome/logsTelemetry (#3844 log_query): sync_err, sync_write_logs, sync_read_logs, sync_unserved_silent, sync_log_only
-src/graph_core.rs	profile_mut	1400	PROVEN	GraphCore.profileOutcome/dispatch (admitQ, #3014): profile_write_runs_as_write, profile_read_replied, capped
-src/graph_core.rs	profile_sync	1501	PROVEN	GraphCore.profileOutcome: profile_write_runs_as_write, profile_read_replied
-src/graph_core.rs	finish_write	1572	PROVEN	GraphCore.writeSteps (commit if escalated, else nothing: the version drops with the runtime, #3657; escalated: published under GraphCore.keyOfWrite's key, or refused, #3850/#3851): reply_after_commit, reply_only_after_commit, unkeyed_refused, unescalated_silent
-src/graph_core.rs	abandon_write	1607	PROVEN	GraphCore.abandonSteps (resync only if version_is_current, nothing to release, #3657): failed_no_commit, stale_run_silent
-src/graph_core.rs	commit_and_replicate	1623	PROVEN	GraphCore.commitSteps: modified_replicates_or_warns, unmodified_silent; replicated key bytes = utf8(lossy(key)): KeyName.bug2653_nonutf8_key_mangled (#2653)
-src/graph_core.rs	process_write_queued_query	1701	PROVEN	GraphCore.loopExit: loopExit_safe (no stranded message on exit); slot dropped on dequeue: SearchConcurrency Pool.paths_release_once
-src/graph_core.rs	CtxSink::replicate	1849	PROVEN	GraphCore.replicateArgv: replicateArgv_shape
-src/graph_core.rs	graph_free	1862	PROVEN	GraphCore.free: free_unregisters, free_keeps_others; Telemetry.graphFree (#3844 queues the freed keys' streams): graphFree_registry, graphFree_queues, freed_stream_stripped
+src/graph_core.rs	execute_query_write	793	PROVEN	GraphCore.executeWrite (#3290 retry loop): executeWrite_first, stale_run_silent; GraphCore.loopW/escalateNext (#3559 bounded retry): escalate_after_max, reader_before_max, loopW_readers, loopW_length, loopW_bounded, loopW_has_result, loopW_decided, loopW_not_stale, loopW_first (writer runs never stale: QuerySession.writer_never_stale)
+src/graph_core.rs	try_query_write	886	PROVEN	GraphCore.writeSteps/abandonSteps (#3657 infallible write_version, Stale on abandon; #3850/#3851 refused finish_write abandons and fails; #3559 one timeout for all runs: a run past it fails before forking, no write step): reply_after_commit, reply_only_after_commit, failed_no_commit, unkeyed_refused, stale_run_silent, unregistered_not_stale; GraphCore.resolveT/runBudget (#3559): resolveT_kept, runBudget_le, runBudget_unlimited
+src/graph_core.rs	WriteAttempt::from	864	PROVEN	GraphCore.Attempt.ofString: ofString_not_stale
+src/graph_core.rs	reply_profile	1001	PROVEN	GraphCore.profileDepth/profileOps (#2390: all ops, plain depth): profileDepth_eq, profileDepth_commit_counts, profileOps_all
+src/graph_core.rs	BlockedClient::new	1038	AXIOMATISED	RM_BlockClient/UnblockClient + BlockedClientMeasureTime* (Redis API)
+src/graph_core.rs	BlockedClient::drop	1046	AXIOMA
```

**File**: `proofs/redis_layer/RedisLayer/Commands2.lean` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ import RedisLayer.GraphCore
 | `applyCons`, `consWorker` | `apply_constraint` `:599`; `graph_constraint` pool path `:547-585` (#3819) |
 | `recordShape`             | `record.rs` `record_mut` `:44`, `graph_record` `:180` |
 | `copyOut`                 | `copy.rs` `graph_copy` `:27` (`pipe`/`fork`/`_exit`/`waitpid` are libc, AXIOMATISED) |
-| `bulkFlow`, `heldReplicate`, `heldRekey`, `bulkArgv`, `discardCreated`, `maybeYield`, `publishOps`, `edgeRecords` | `bulk_insert.rs` `:247-1125` (#3863: `discard_created_graph` `:296`, `HeldArgs::rekey` `:396`, the worker's `key_of_write` `:1026`) |
+| `bulkFlow`, `heldReplicate`, `heldRekey`, `bulkArgv`, `discardCreated`, `maybeYield`, `publishOps`, `edgeRecords` | `bulk_insert.rs` `:249-1148` (#3863: `discard_created_graph` `:298`, `HeldArgs::rekey` `:398`, the worker's `key_of_write` `:1048`; #3559 bounded stale retry escalates to `begin_writer_checked`, a refusal is the same failure path) |
 | `getNames`, `getOne`, `asI64`, `asU64` | `config_cmd.rs` `config_get_one` `:57`, `ConfigValue::as_i64/as_u64` `:294-306` |
 -/
 namespace RedisLayer.Commands
```

**File**: `proofs/redis_layer/RedisLayer/GraphCore.lean` (modified, +191/-4)
```diff
@@ -12,8 +12,10 @@ import RedisLayer.Resp
 | `invalidVersionBytes`       | `reply_invalid_graph_version` `:1038` |
 | `profileDepth`, `profileOps`| `reply_profile` `:936` (all ops, plain depth, since #2390) |
 | `isWrite`, `profileDetect`, `admissionKept` | `execute_query` `:636` / `execute_profile` `:722` write detection and `admission.take()` |
-| `writeSteps`                | `try_query_write` `:834`, `finish_write` `:1568`, `abandon_write` `:1603`, `commit_and_replicate` `:1619` |
-| `executeWrite`, `Attempt`   | `execute_query_write` `:784` (retry loop, #3290), `WriteAttempt::from` `:823` |
+| `writeSteps`                | `try_query_write` `:886`, `finish_write` `:1633`, `abandon_write` `:1668`, `commit_and_replicate` `:1684` |
+| `executeWrite`, `Attempt`   | `execute_query_write` `:793` (retry loop, #3290), `WriteAttempt::from` `:863` |
+| `WTimeout`, `resolveT`, `runBudget` | `try_query_write` `:886` one timeout for all runs (`WriteTimeout` `:870`, #3559) |
+| `loopW`, `escalateNext`, `Run` | `execute_query_write` `:793` bounded retry (#3559), `MAX_STALE_RETRIES` `:847`, `SLOW_STALE_RUN` `:854` |
 | `admitQ`, `dispatch`        | `admit` `:1052`, `query_mut` `:1063` (#3014) |
 | `syncOutcome`, `logsTelemetry` | `query_sync` `:1264` (`log_query`, #3844), `dispatch::logs_telemetry` `dispatch.rs:63`, `profile_sync` `:1501`, `profile_mut` `:1400` |
 | `loopExit`                  | `process_write_queued_query` `:1697` |
@@ -296,12 +298,13 @@ theorem unescalated_silent (k h m b : Bool) :
 
 `try_query_write` returns `WriteAttempt::Stale` only from the error arm after
 `abandon_write` when `session.is_stale()` — nothing mutated, published or replied — and the
-loop re-runs on a fresh session (`QuerySession::begin_with`). -/
+loop re-runs on a fresh session (`QuerySession::begin_with`, or `begin_writer_checked` once the
+bounded retry below escalates, #3559). -/
 
 inductive Attempt | stale | failed (e : String) | ok
   deriving DecidableEq, Repr
 
-/-- `impl From<String> for WriteAttempt` (`:823`): every other error is `Failed`. -/
+/-- `impl From<String> for WriteAttempt` (`:863`): every other error is `Failed`. -/
 def Attempt.ofString (e : String) : Attempt := .failed e
 theorem ofString_not_stale (e : String) : Attempt.ofString e ≠ .stale := by simp [Attempt.ofString]
 
@@ -323,6 +326,190 @@ nothing, and it committed and replied nothing. -/
 theorem stale_run_silent (w k m b : Bool) :
     writeSteps false w k false m b = [] := by simp [writeSteps, abandonSteps]
 
+/-! ### The bounded retry (#3559)
+
+`execute_query_write` (`:793`) counts stale runs; after `MAX_STALE_RETRIES` (`:847`) of them, or
+at once after a stale run that took `SLOW_STALE_RUN` (`:854`, 10 ms) or longer, the next run
+begins as a writer (`QuerySession::begin_writer_checked`) instead of a reader
+(`begin_with`). A run is a function of the mode it begins in; a refused
+`begin_writer_checked` is that run's `failed` outcome (`map_err(…)?`). Times are nanoseconds. -/
+
+def maxStaleRetries : Nat := 3
+def slowStaleRun : Nat := 10000000
+
+/-- `stale_runs >= MAX_STALE_RETRIES || wasted >= SLOW_STALE_RUN`, after the increment. -/
+def escalateNext (staleRuns wasted : Nat) : Bool :=
+  decide (maxStaleRetries ≤ staleRuns) || decide (slowStaleRun ≤ wasted)
+
+/-- One run's report: its outcome and how long it took. -/
+structure Run where
+  a : Attempt
+  wasted : Nat
+
+/-- The loop: `s` stale runs so far, `w` whether this run begins as a writer; `runs` the
+successive runs, each given the mode it begins in. Returns the result (`none`: still
+running) and the mode of every run taken. -/
+def loopW (s : Nat) (w : Bool) : List (Bool → Run) → Option Attempt × List Bool
+  | [] => (none, [])
+  | f :: rest =>
+    match (f w).a with
+    | .stale =>
+      let p := loopW (s + 1) (escalateNext (s + 1) (f w).wasted) rest
+      (p.1, w :: p.2)
+    | a => (some a, [w])
+
+theorem escalate_after_max (n t : Nat) (h : maxStaleRetries ≤ n) : escalateNext n t = true := by
+  simp [escalateNext, h]
+
+theorem reader_before_max (n t : Nat) (h : n < maxStaleRetries) (ht : t < slowStaleRun) :
+    escalateNext n t = false := by
+  simp [escalateNext]; omega
+
+/-- **Still the first run that was not stale** (as `executeWrite_first`), each run taken in the
+mode the loop chose for it. -/
+theorem loopW_first (s : Nat) (w : Bool) (runs : List (Bool → Run)) :
+    (loopW s w runs).1 =
+      executeWrite (List.zipWith (fun f m => (f m).a) runs (loopW s w runs).2) := by
+  induction runs generalizing s w with
+  | nil => simp [loopW, executeWrite]
+  | cons f rest ih =>
+    cases ha : (f w).a <;> simp [loopW, ha, executeWrite, ih]
+
+/-- A stale run is never the result. -/
+theorem loopW_not_stale (s : Nat) (w : Bool) (runs : List (Bool → Run)) :
+    (loopW s w runs).1 ≠ some .stale := by
+  induction runs generalizing s w with
+  | nil => simp [loopW]
+  | cons f rest ih =>
+    cases ha : (f w).a <;> simp [loopW, ha, ih]
+
+/-- **Bounded**: at most `MAX_
```

**File**: `proofs/redis_layer/RedisLayer/QuerySession.lean` (modified, +84/-9)
```diff
@@ -8,16 +8,17 @@ Redis — AXIOMATISED rows for `lock_gil`/`release_gil`, which only call
 
 | here | there |
 | --- | --- |
-| `Th`, `holdsGil`, `gilAcquire`, `gilDrop` | `holds_gil` `:681`, `Gil::acquire` `:701`, `Gil::drop` `:724`, `hold_gil` `:674`, `GIL_CTX` |
+| `Th`, `holdsGil`, `gilAcquire`, `gilDrop` | `holds_gil` `:702`, `Gil::acquire` `:722`, `Gil::drop` `:745`, `hold_gil` `:695`, `GIL_CTX` |
 | `S`, `begin`, `beginWriter`   | `QuerySession::begin` `:178`, `begin_writer` `:205` (main thread only since #3816: `debug_assert!(holds_gil())`) |
-| `beginWith`, `readPastGate`, `mayWaitAtGate` | `begin_with` `:185`, `read_past_gate` `:524`, `may_wait_at_gate` `:548`; `WriterGate::is_closed`/`close`/`wait_until_open` `:569-577` are the `gateWait`/`gateClose`/`gateOpen` events |
-| `release`                     | `release_locks` `:317`, `Drop` `:652` |
-| `withGraph`, `withGraphMut`   | `with_graph` `:334`, `with_graph_mut` `:350` |
-| `Att`, `pollLoop`, `acquireWrite` | `acquire_write` `:460` (#3816): per attempt GIL, check, `try_write_arc_for(slice)`; the gate closes after `GATE_AFTER_SLICES` = 2 misses; one blocking try when the interval is ≤ 0 or the thread already holds the GIL |
-| `authorize`, `World`          | `authorize_write` `:496`: registry, then `reauthorize_write` |
-| `escalate`, `upgrade`         | `escalate` `:399`, `upgrade_to_write` `:377` (and the trait shim `:639`) |
-| `reauthorize`                 | `reauthorize_write` `:598` |
-| `Version`, `SS`, `writeVersion`, `isStale`, `versionIsCurrent`, `checkFork`, `upgradeS`, `upgradeSt` | #3657: `enum Version` `:128`, `write_version` `:239`, `is_stale` `:255`, `version_is_current` `:263`, `is_writer` `:267`, `check_fork` `:279`, `facts` `:225` |
+| `beginWriterChecked`          | `begin_writer_checked` `:235` (#3559): `begin_with`, then `escalate`; a refusal drops the reader `escalate` re-took |
+| `beginWith`, `readPastGate`, `mayWaitAtGate` | `begin_with` `:185`, `read_past_gate` `:545`, `may_wait_at_gate` `:569`; `WriterGate::is_closed`/`close`/`wait_until_open` `:590-577` are the `gateWait`/`gateClose`/`gateOpen` events |
+| `release`                     | `release_locks` `:338`, `Drop` `:673` |
+| `withGraph`, `withGraphMut`   | `with_graph` `:355`, `with_graph_mut` `:371` |
+| `Att`, `pollLoop`, `acquireWrite` | `acquire_write` `:481` (#3816): per attempt GIL, check, `try_write_arc_for(slice)`; the gate closes after `GATE_AFTER_SLICES` = 2 misses; one blocking try when the interval is ≤ 0 or the thread already holds the GIL |
+| `authorize`, `World`          | `authorize_write` `:517`: registry, then `reauthorize_write` |
+| `escalate`, `upgrade`         | `escalate` `:420`, `upgrade_to_write` `:398` (and the trait shim `:660`) |
+| `reauthorize`                 | `reauthorize_write` `:619` |
+| `Version`, `SS`, `writeVersion`, `isStale`, `versionIsCurrent`, `checkFork`, `upgradeS`, `upgradeSt` | #3657: `enum Version` `:128`, `write_version` `:260`, `is_stale` `:276`, `version_is_current` `:284`, `is_writer` `:288`, `check_fork` `:300`, `facts` `:225` |
 | `CommitError`, `WriteAbort.ofCommit` | `From<CommitError> for WriteAbort` `:95` |
 
 **#3816 (af228a34f).** Off the main thread `escalate` waits for the write lock in
@@ -363,6 +364,72 @@ theorem release_order (t : Th) (hm : t.main = false) (hc : t.ctx = false) :
     (release (beginWriter t)).th.log = t.log ++ [.gilLock, .writeLock, .writeUnlock, .gilUnlock] := by
   simp [release, beginWriter, dropMode, gilAcquire, holdsGil, gilDrop, hm, hc]
 
+/-- `begin_writer_checked` (`:235`, #3559): `begin_with` (read lock), then `escalate` — the same
+wait (`acquire_write`, so off the main thread the GIL is given back between slices) and the same
+`authorize_write` check under the GIL hold the lock is taken under that `upgrade_to_write` makes.
+On a refusal the session is returned out of scope inside the `Err`, so it is dropped: the read
+lock `escalate` re-took goes. `none`: still waiting after the given attempts. -/
+def beginWriterChecked (t : Th) (i : Int) (ws : List World) (f : Facts) :
+    Option (Option WriteAbort × S) :=
+  (upgrade (begin t) i ws f).map fun (a, s) => (a, if a.isNone then s else release s)
+
+/-- **The same refusal escalation gives**: `begin_writer_checked` refuses exactly when, and with
+exactly the abort that, `upgrade_to_write` on a reader session refuses (the version check apart:
+this is the part of `upgrade_to_write` before `check_fork`, and a fresh writer has no fork to
+check — `writer_never_stale`). -/
+theorem beginWriterChecked_refusal (t : Th) (i : Int) (ws : List World) (f : Facts) :
+    (beginWriterChecked t i ws f).map (·.1) = (upgrade (begin t) i ws f).map (·.1) := by
+  unfold beginWriterChecked
+  cases hu : upgrade (begin t) i ws f with
+  | none => rfl
+  | some p => obtain ⟨a, s⟩ := p; rfl
+
+/-- Accepted, it is a writer holding both locks: it may mutate. -/
+theorem beginWriterChecked_ok (t : Th) (i : Int) (ws : List World) (f : Facts) (s' : 
```

**File**: `proofs/search_concurrency/COVERAGE.tsv` (modified, +37/-36)
```diff
@@ -57,45 +57,45 @@ src/graph_core.rs	new	603	PROVEN	unbounded write channel (#3014); Locks.never_st
 src/graph_core.rs	from_mvcc	620	MODELLED	as new
 src/graph_core.rs	execute_query	639	MODELLED	Mvcc Ev.read on snapshot; write detection not modelled
 src/graph_core.rs	execute_profile	721	MODELLED	as execute_query
-src/graph_core.rs	execute_query_write	783	PROVEN	Mvcc fork/checkFork (#3290/#3657): inline_write_ok, stale_then_rerun, checkFork_on_committed (retry sees the inline write) (BUG 5; counterexample removed in bbee75955; the last revision that has them is 17ccc5412)
-src/graph_core.rs	reply_profile	933	NOT COVERED	reply formatting here; PROVEN in redis_layer (GraphCore.profileOps_all, profileDepth_eq; #2390 lists every op)
-src/graph_core.rs	new	970	AXIOMATISED	RM_BlockClient FFI
-src/graph_core.rs	drop	978	AXIOMATISED	RM_UnblockClient FFI
-src/graph_core.rs	compute_effective_timeout	996	NOT COVERED	config arithmetic, not concurrency
-src/graph_core.rs	reply_invalid_graph_version	1035	NOT COVERED	reply formatting
-src/graph_core.rs	admit	1049	PROVEN	Pool.acquireLoop/acquire_bounded; Locks.succ3014 dispatch (reject, never wait): main_never_blocks, inv3014_step
-src/graph_core.rs	query_mut	1060	PROVEN	Locks.main_never_blocks/never_stuck_3014/inv3014_step (admit + unbounded spawn, #3014); drain producer (send then CAS)
-src/graph_core.rs	query_sync	1264	PROVEN	Mvcc.inline_write_ok (inline writer = escalate 0 then forkCur; never refused by a matching queued write, #3290)
-src/graph_core.rs	profile_mut	1400	PROVEN	same admission/producer protocol as query_mut: Locks.main_never_blocks, never_stuck_3014
-src/graph_core.rs	profile_sync	1501	MODELLED	as query_sync
-src/graph_core.rs	finish_write	1572	PROVEN	Mvcc Ev.commit (session in writer mode, key_of_write found its key) / Ev.abandon (never escalated: the version just drops with the runtime; or refused by key_of_write, #3850/#3851, and abandoned by the caller)
-src/graph_core.rs	abandon_write	1607	PROVEN	Mvcc Ev.abandon (the fork is dropped, nothing to roll back); index resync not modelled
-src/graph_core.rs	commit_and_replicate	1623	PROVEN	Mvcc Ev.commit requires GIL (fork_excludes_commit)
-src/graph_core.rs	process_write_queued_query	1701	PROVEN	Locks.drain_no_lost_message/explore_saturated/recheck_needed (write_loop protocol, 2 producers exhaustive)
-src/graph_core.rs	replicate	1849	AXIOMATISED	RM_Replicate FFI
-src/graph_core.rs	graph_free	1862	PROVEN	Mvcc Ev.delete (registered := false) + delete_blocks_writes
+src/graph_core.rs	execute_query_write	793	PROVEN	Mvcc fork/checkFork (#3290/#3657): inline_write_ok, stale_then_rerun, checkFork_on_committed (retry sees the inline write), stale_then_writer_rerun (#3559 escalated rerun) (BUG 5; counterexample removed in bbee75955; the last revision that has them is 17ccc5412)
+src/graph_core.rs	reply_profile	1001	NOT COVERED	reply formatting here; PROVEN in redis_layer (GraphCore.profileOps_all, profileDepth_eq; #2390 lists every op)
+src/graph_core.rs	new	1038	AXIOMATISED	RM_BlockClient FFI
+src/graph_core.rs	drop	1046	AXIOMATISED	RM_UnblockClient FFI
+src/graph_core.rs	compute_effective_timeout	1064	NOT COVERED	config arithmetic, not concurrency
+src/graph_core.rs	reply_invalid_graph_version	1103	NOT COVERED	reply formatting
+src/graph_core.rs	admit	1117	PROVEN	Pool.acquireLoop/acquire_bounded; Locks.succ3014 dispatch (reject, never wait): main_never_blocks, inv3014_step
+src/graph_core.rs	query_mut	1128	PROVEN	Locks.main_never_blocks/never_stuck_3014/inv3014_step (admit + unbounded spawn, #3014); drain producer (send then CAS)
+src/graph_core.rs	query_sync	1332	PROVEN	Mvcc.inline_write_ok (inline writer = escalate 0 then forkCur; never refused by a matching queued write, #3290)
+src/graph_core.rs	profile_mut	1468	PROVEN	same admission/producer protocol as query_mut: Locks.main_never_blocks, never_stuck_3014
+src/graph_core.rs	profile_sync	1569	MODELLED	as query_sync
+src/graph_core.rs	finish_write	1640	PROVEN	Mvcc Ev.commit (session in writer mode, key_of_write found its key) / Ev.abandon (never escalated: the version just drops with the runtime; or refused by key_of_write, #3850/#3851, and abandoned by the caller)
+src/graph_core.rs	abandon_write	1675	PROVEN	Mvcc Ev.abandon (the fork is dropped, nothing to roll back); index resync not modelled
+src/graph_core.rs	commit_and_replicate	1691	PROVEN	Mvcc Ev.commit requires GIL (fork_excludes_commit)
+src/graph_core.rs	process_write_queued_query	1769	PROVEN	Locks.drain_no_lost_message/explore_saturated/recheck_needed (write_loop protocol, 2 producers exhaustive)
+src/graph_core.rs	replicate	1917	AXIOMATISED	RM_Replicate FFI
+src/graph_core.rs	graph_free	1930	PROVEN	Mvcc Ev.delete (registered := false) + delete_blocks_writes
 src/query_session.rs	begin	178	MODELLED	reader mode (graphR acquire)
 src/query_session.rs	begin_with	185	MODELLED	Locks.gateReaderProg ordered (gate_programs_ordered, #3816 read_past_gate); reader mode
 src/query_session.rs	begin_writer	205	
```

**File**: `proofs/search_concurrency/SearchConcurrency/Locks.lean` (modified, +15/-2)
```diff
@@ -4,9 +4,10 @@
 | here | there |
 | --- | --- |
 | `Lock.gil < .graph < .indexer` | `graph/src/locks.rs:9` ordering rule; `query_session.rs:30` `Mode` |
-| `writerProg`, `pollWriterProg` | `QuerySession::escalate` (`query_session.rs:399`): release R, then `acquire_write` (`:460`): per slice GIL, timed W; since #3816 the `WriterGate` closes after two misses |
-| `gate`, `rank3816`, `gateReaderProg` | #3816: `WriterGate` (`:569-577`), `read_past_gate` (`:524`) |
+| `writerProg`, `pollWriterProg` | `QuerySession::escalate` (`query_session.rs:420`): release R, then `acquire_write` (`:481`): per slice GIL, timed W; since #3816 the `WriterGate` closes after two misses |
+| `gate`, `rank3816`, `gateReaderProg` | #3816: `WriterGate` (`:590-598`), `read_past_gate` (`:545`) |
 | `inlineWriterProg`             | `QuerySession::begin_writer` (`:205`): GIL, W |
+| `retryWriterProg`              | `QuerySession::begin_writer_checked` (`:235`, #3559) from `execute_query_write`'s / `graph_bulk_insert`'s retry: `begin_with`, then `escalate`; `authorize_write`'s registry check runs under each slice's GIL |
 | `populateProg`                 | `populate_index_batch` (`graph.rs:562`): indexer lock only |
 | `commitIndexProg`              | `Graph::commit_index` under writer mode (`graph.rs:3799`): GIL, W, indexer |
 | `forkProg`                     | `pre_fork_prepare` (`redis_type.rs:350`): GIL (main), registry mutex |
@@ -107,6 +108,15 @@ theorem all_programs_ordered :
     okProg [] writerProg ∧ okProg [] inlineWriterProg ∧ okProg [] populateProg ∧
     okProg [] dropIndexBgProg ∧ okProg [] forkProg ∧ okProg [] telemetryProg := by decide
 
+/-- #3559: a queued write that keeps going stale reruns from `begin_writer_checked` on its worker:
+`begin_with` (read lock), then `escalate` — drop the read lock, GIL, `authorize_write`'s registry
+check under that GIL hold, the write lock — then the commit's indexer lock. -/
+def retryWriterProg : List Op :=
+  [.acq graphR, .rel graphR, .acq gil, .acq registry, .rel registry, .acq graphR,
+   .acq indexer, .rel indexer, .rel graphR, .rel gil]
+
+theorem retry_writer_ordered : okProg [] retryWriterProg = true := by decide
+
 theorem bad_escalate_rejected : okProg [] badEscalateProg = false := by decide
 
 /-! ## Gap closed 2026-10-20 (#3226): the RediSearch locks an open index scan holds
@@ -221,6 +231,9 @@ theorem gate_programs_ordered :
     okProgBy rank3816 [] telemetryProg ∧ okProgBy rank3816 [] forkProg ∧
     okProgBy rank3816 [] writerClosedScanProg ∧ okProgBy rank3816 [] restoreProg := by decide
 
+/-- …and under the #3816 rank (gate first), as `escalate` with its first slice taking the lock. -/
+theorem retry_writer_ordered_3816 : okProgBy rank3816 [] retryWriterProg = true := by decide
+
 /-- A reader waiting at the closed gate holds no lock, so the gate's writer, which needs
 the GIL and the write lock, never waits on it (a gate reader cannot close a cycle). -/
 theorem gate_waiter_holds_nothing :
```

**File**: `proofs/search_concurrency/SearchConcurrency/Mvcc.lean` (modified, +15/-0)
```diff
@@ -607,6 +607,21 @@ theorem stale_then_rerun :
     ((run init rerunTrace).map (fun s => (s.pub, s.acked, s.ver))) = some ([7, 8], [7, 8], 2) := by
   decide
 
+/-- **The escalated rerun** (#3559): after its stale runs the queued write begins as a writer
+(`QuerySession::begin_writer_checked`: `begin_with`, then `escalate` — GIL, write lock — and then a
+`Current` version) instead of a reader. Nothing can commit under it, so it needs no check: `7` then
+`8`, both acknowledged, and the reader run is the only one ever found stale. This is one scenario
+for the *effect* of the escalation; *when* it happens (the stale-run count and the 10 ms rule) is
+`GraphCore.loopW` in `redis_layer`, with `loopW_bounded` and `escalate_after_max`. -/
+def escalatedRerunTrace : List Ev :=
+  inlineTrace ++ [.escalate 1, .checkFork 1, .abandon 1, .release 1,
+                  .escalate 1, .forkCur 1, .mutate 1 8, .commit 1, .swap 1, .release 1]
+
+theorem stale_then_writer_rerun :
+    ((run init escalatedRerunTrace).map (fun s => (s.pub, s.acked, s.ver, s.stale))) =
+      some ([7, 8], [7, 8], 2, [1]) := by
+  decide
+
 /-- An indexer batch between the queued write's fork and its check does not make it stale:
 the check still succeeds, and the commit goes through. -/
 theorem batch_does_not_stale :
```

**File**: `src/commands/bulk_insert.rs` (modified, +32/-9)
```diff
@@ -1,4 +1,5 @@
 use crate::dispatch::must_run_inline;
+use crate::graph_core::{MAX_STALE_RETRIES, SLOW_STALE_RUN};
 use crate::query_session::{QuerySession, WriteFacts, hold_gil};
 use crate::{
     config::CONFIGURATION_CACHE_SIZE,
@@ -21,6 +22,7 @@ use std::collections::HashMap;
 use std::ffi::CString;
 use std::ptr::null_mut;
 use std::sync::Arc;
+use std::time::Instant;
 use valkey_module::{
     Context, ContextFlags, NextArg, ValkeyError, ValkeyResult, ValkeyString, ValkeyValue, raw,
 };
@@ -985,13 +987,30 @@ pub fn graph_bulk_insert(
             // when this block ends — before the client is unblocked below.
             // A loop only to run the insert again if an inline writer commits while
             // phase 1 builds (see the escalation below); every other path breaks.
+            //
+            // The retry is bounded, like `execute_query_write`'s: after a few stale
+            // builds, or one that took long, the insert runs as a writer from the
+            // start — the GIL and write lock held for the whole build, as in C — so
+            // a steady stream of inline writes cannot starve it.
+            let mut stale_runs = 0;
+            let mut as_writer = false;
             let result: Result<(), String> = 'phase: loop {
-                let session = QuerySession::begin_with(&graph, facts);
-                // Phase 1: build the new version as a reader, GIL-free, into a private
-                // fork. Forking takes nothing, so an inline writer is never refused
-                // because this insert is building; phase 2's escalation checks whether
-                // one committed meanwhile. Every early exit below drops the fork with
-                // the session — there is nothing else to release.
+                let attempt_start = Instant::now();
+                let session = if as_writer {
+                    match QuerySession::begin_writer_checked(&graph, facts) {
+                        Ok(session) => session,
+                        Err(e) => break 'phase Err(e.to_string()),
+                    }
+                } else {
+                    QuerySession::begin_with(&graph, facts)
+                };
+                // Phase 1: build the new version into a private fork. As a reader (every
+                // run but an escalated one) that is GIL-free, and forking takes nothing,
+                // so an inline writer is never refused because this insert is building;
+                // phase 2's escalation checks whether one committed meanwhile. An
+                // escalated run is already a writer and builds under the GIL and the
+                // write lock, so there is nothing to check. Every early exit below drops
+                // the fork with the session — there is nothing else to release.
                 let mut fork = session.write_version();
                 let mut docs = IndexDocs::default();
                 let tokens: Vec<&[u8]> = token_data.iter().map(std::vec::Vec::as_slice).collect();
@@ -1014,6 +1033,9 @@ pub fn graph_bulk_insert(
                     // An inline writer committed while phase 1 built: nothing was
                     // published, so build again on top of its version.
                     if session.is_stale() {
+                        stale_runs += 1;
+                        as_writer = stale_runs >= MAX_STALE_RETRIES
+                            || attempt_start.elapsed() >= SLOW_STALE_RUN;
                         continue 'phase;
                     }
                     break 'phase Err(e.to_string());
@@ -1035,9 +1057,10 @@ pub fn graph_bulk_insert(
                 // cannot resolve against its own snapshot.
                 //
                 // Every token has succeeded by now, so nothing reaches the index for an
-                // insert that later rolls back. The cost is a GIL hold proportional to
-                // the number of indexed rows — paid only when the graph actually has an
-                // index, since `docs` is otherwise empty.
+                // insert that later rolls back. For a run that built as a reader the cost
+                // is a GIL hold proportional to the number of indexed rows — paid only
+                // when the graph actually has an index, since `docs` is otherwise empty;
+                // an escalated run holds the GIL for the whole build anyway.
                 //
                 // Validated before publishing, as on the inline path above and
                 // for the same reason: RediSearch is not MVCC, so a document
```

#### Recent Merged Pull Requests:
- **PR #3954** (2026-11-22): version 6.2.0 (@DvirDukhan)
- **PR #3953** (closed): release 6.2.0 through the merge queue (@DvirDukhan)
- **PR #3952** (2026-11-22): release 6.2.0 through the merge queue (@DvirDukhan)
- **PR #3951** (2026-11-22): proofs: re-target to main and raise coverage to 99.7% PROVEN; prune FINDINGS.md (@AviAvni)
- **PR #3950** (2026-11-22): version 6.2.0 (@DvirDukhan)
- **PR #3946** (2026-11-22): Dual-license FalkorDB under SSPLv1 and AGPLv3 (@gkorland)

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

## X. GRAPH.DELETE of indexed graphs corrupts RediSearch's shared N/A key

**RULE**:
When implementing operations in `deps/RediSearch`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d070f1f9`: GRAPH.DELETE of indexed graphs corrupts RediSearch's shared N/A key. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `deps/RediSearch`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Subproject commit 994282d3075adae126076b0aa141b1c6ac66c0bf
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
Subproject commit 1317b41b3f1a2f68fea81e250b0b32a57dc7d6d1
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d070f1f9` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
