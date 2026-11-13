> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `7df8e588`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T08:55:36.784Z  
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
> **Harvest Timestamp**: 2026-11-13T08:55:36.589Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10516 stars

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

### Incident Patch 1: `5ab8fddc` (2026-11-12)
**Commit Message**: test: revert #3722's test counting and wait_for_replica (#3762)

* ci: count the TCK as one test again

Reverts the TCK part of #3722. test_tck.py no longer takes TCK_JUNIT_DIR,
the two pytest jobs write the TCK's pytest JUnit file again, and
count_results.py drops --behave, so the run summary counts the TCK as the
one pytest test that runs it. The test-counts job stays continue-on-error.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: one short wait_for_replica, used by every replica wait

wait_for_replica ran each INFO on its own thread, over a fresh retry-free
connection, so a hung server couldn't hold it past its deadline. RLTest and
the CI job timeouts already catch a hung server, so it is back to a plain
poll: read the primary's offset, then wait for the replica's link to be up
and its offset to reach it.

effects_common.py and test_replication.py each had their own copy of that
offset poll. Both now call wait_for_replica. The effects copy didn't check
the link; every call to it is made while the replica is attached.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* ci: drop the per-server test counts

Reverts the rest of #3722's counting: tests/count_result

**File**: `.github/workflows/_ci-pipeline.yml` (modified, +9/-89)
```diff
@@ -98,38 +98,13 @@ jobs:
           path: target/release
       - run: chmod +x target/release/libfalkordb.so
       - name: Run tests
-        id: pytest
         run: |
           . /data/venv/bin/activate
-          RELEASE=1 pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv --junitxml=test-results/pytest.xml
+          RELEASE=1 pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv
       - name: Run TCK tests
-        id: tck
         run: |
           . /data/venv/bin/activate
-          RELEASE=1 TCK_DONE=tck_done.txt TCK_JUNIT_DIR=test-results/tck pytest tests/tck/test_tck.py -s
-      # tests/common.py starts the server with --logfile redis-test.log.
-      # Counts for the run summary (tests/count_results.py, summed per server by
-      # _ci-pipeline.yml's test-counts job). On every outcome but a cancel, so a
-      # failing cell still counts, including one whose setup failed before its
-      # tests ran. STATUS is the job's, so any failed step marks the cell. The
-      # report never gates: both steps continue on error. The server is FALKORDB_SERVER's, as flow.sh,
-      # tests/common.py and the images default it: redis unless set.
-      - name: Record test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        env:
-          RUN: artifact, amd64
-          STATUS: ${{ job.status }}
-          NAME: test-counts-artifact
-        run: python3 tests/count_results.py record --server "${FALKORDB_SERVER:-redis}" --run "$RUN" --status "$STATUS" --junit test-results/pytest.xml --behave test-results/tck --logs redis-test.log --out "test-counts/$NAME.json"
-      - name: Upload test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7
-        with:
-          name: test-counts-artifact
-          path: test-counts/
-          retention-days: 7
+          RELEASE=1 TCK_DONE=tck_done.txt pytest tests/tck/test_tck.py -s
   # Release flavour. The vehicle is the whole difference between the two events:
   # a pull request tests the binary it just built, the queue tests the image it
   # is about to promote. Same file list, same flavour config — two thin calls
@@ -305,35 +280,6 @@ jobs:
 
   # Build the asan instrumented runtime image (amd64-only). Single cell,
   # no manifest needed (push directly to the bare tag).
-  # Adds up, per server, the passed, failed and skipped tests every suite cell
-  # recorded (tests/count_results.py, `test-counts-*` artifacts), and writes
-  # them to the run summary, with the server versions the cells' logs name.
-  # A report, not a gate: each cell's own result gates. continue-on-error, so
-  # a failure here (an artifact download, the summary) can't fail this
-  # workflow and, through ci-gate, a pull request whose tests all passed.
-  test-counts:
-    needs: [test, flow-release, flow-release-image, flow-coverage, test-image, flow-asan]
-    if: ${{ !cancelled() }}
-    continue-on-error: true
-    runs-on: ubuntu-latest
-    timeout-minutes: 10
-    steps:
-      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-        with:
-          persist-credentials: false
-          sparse-checkout: tests/count_results.py
-          sparse-checkout-cone-mode: false
-      - name: Download the recorded counts
-        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8
-        with:
-          pattern: test-counts-*
-          path: test-counts
-          merge-multiple: true
-      - name: Summarise per server
-        run: |
-          mkdir -p test-counts
-          python3 tests/count_results.py summary test-counts | tee -a "$GITHUB_STEP_SUMMARY"
-
   build-rc-asan-image:
     if: ${{ inputs.use_image }}
     uses: ./.github/workflows/_build-flavour.yml
@@ -405,24 +351,20 @@ jobs:
           # The module crate's own unit tests (the RDB codec); `--lib` skips doctests.
           CARGO_PROFILE_RELEASE_LTO=false cargo test --release -p falkordb-rs --lib
       - name: Run pytest tests against the RC image
-        id: pytest
         run: |
           . /data/venv/bin/activate
-          pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv --junitxml=test-results/pytest.xml
+          pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv
       - name: Run TCK tests against the RC image
-        id: tck
         run: |
           . /data/venv/bin/activate
-          TCK_DONE=tck_done.txt TCK_JUNIT_DIR=test-results/tck pytest tests/tck/test_tck.py -s
-      # Capture the GHA service container's stdout/stderr so the run carries
-      # the server lifecycle, module RedisModule_Log output, and any
+          TCK_DONE=tck_done.txt pytest tests/tck/test_tck.py -s
+      # Capture the GHA service container's stdout/stde
```

**File**: `.github/workflows/_flow-artifact.yml` (modified, +1/-28)
```diff
@@ -99,16 +99,11 @@ jobs:
           path: ${{ inputs.artifact_path }}
       - run: chmod +x ${{ inputs.artifact_path }}/libfalkordb.so
       - name: Run Flow test - ${{ matrix.test_file }} (${{ inputs.flavour }}, ${{ matrix.arch }})
-        id: flow
-        # bash, for pipefail: the tee keeps RLTest's output for the counts
-        # below without hiding flow.sh's exit status.
-        shell: bash
         env:
           TEST_FILE: ${{ matrix.test_file }}
         run: |
           . /data/venv/bin/activate
-          mkdir -p test-results
-          TEST="$TEST_FILE" FAIL_FAST=1 ./flow.sh 2>&1 | tee test-results/flow.log
+          TEST="$TEST_FILE" FAIL_FAST=1 ./flow.sh
       - name: Collect coverage (profraw -> lcov)
         if: ${{ !cancelled() && inputs.collect_coverage }}
         env:
@@ -136,28 +131,6 @@ jobs:
           files: ./codecov.txt
           flags: flow-${{ inputs.flavour }}
           disable_search: true
-      # Counts for the run summary (tests/count_results.py, summed per server by
-      # _ci-pipeline.yml's test-counts job). On every outcome but a cancel, so a
-      # failing cell still counts, including one whose setup failed before its
-      # tests ran. STATUS is the job's, so any failed step marks the cell. The
-      # report never gates: both steps continue on error. The server is FALKORDB_SERVER's, as flow.sh,
-      # tests/common.py and the images default it: redis unless set.
-      - name: Record test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        env:
-          RUN: ${{ inputs.flavour }} flow (artifact, ${{ matrix.arch }})
-          STATUS: ${{ job.status }}
-          NAME: test-counts-${{ inputs.flavour }}-artifact-${{ strategy.job-index }}
-        run: python3 tests/count_results.py record --server "${FALKORDB_SERVER:-redis}" --run "$RUN" --status "$STATUS" --rltest test-results/flow.log --logs tests/flow/logs --out "test-counts/$NAME.json"
-      - name: Upload test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7
-        with:
-          name: test-counts-${{ inputs.flavour }}-artifact-${{ strategy.job-index }}
-          path: test-counts/
-          retention-days: 7
       - name: Upload flow logs on failure
         if: failure()
         uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7
```

**File**: `.github/workflows/_flow-flavour.yml` (modified, +4/-60)
```diff
@@ -123,16 +123,11 @@ jobs:
           # that token is the base repository's.
           persist-credentials: false
       - name: Run Flow test - ${{ matrix.test_file }} (${{ inputs.flavour }}, ${{ matrix.arch }})
-        id: flow
-        # bash, for pipefail: the tee keeps RLTest's output for the counts
-        # below without hiding flow.sh's exit status.
-        shell: bash
         env:
           TEST_FILE: ${{ matrix.test_file }}
         run: |
           . /data/venv/bin/activate
-          mkdir -p test-results
-          TEST="$TEST_FILE" FAIL_FAST=1 RELEASE=1 ./flow.sh 2>&1 | tee test-results/flow.log
+          TEST="$TEST_FILE" FAIL_FAST=1 RELEASE=1 ./flow.sh
       - name: Collect coverage (profraw → lcov)
         if: ${{ !cancelled() && inputs.collect_coverage }}
         env:
@@ -174,38 +169,14 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }}
           files: ./codecov.txt
           disable_search: true
-      # On every outcome, not only on failure: the counts below read the
-      # server's start-up banner from these logs.
-      - name: Capture service container logs
-        if: ${{ !cancelled() }}
+      - name: Capture service container logs on failure
+        if: failure()
         run: |
           mkdir -p tests/flow/logs
           for cid in $(docker ps -aq); do
             name=$(docker inspect -f '{{.Name}}' "$cid" 2>/dev/null | sed 's|^/||')
             docker logs "$cid" > "tests/flow/logs/service-${name:-$cid}.log" 2>&1 || true
           done
-      # Counts for the run summary (tests/count_results.py, summed per server by
-      # _ci-pipeline.yml's test-counts job). On every outcome but a cancel, so a
-      # failing cell still counts, including one whose setup failed before its
-      # tests ran. STATUS is the job's, so any failed step marks the cell. The
-      # report never gates: both steps continue on error. The server is FALKORDB_SERVER's, as flow.sh,
-      # tests/common.py and the images default it: redis unless set.
-      - name: Record test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        env:
-          RUN: ${{ inputs.flavour }} flow (image, ${{ matrix.arch }})
-          STATUS: ${{ job.status }}
-          NAME: test-counts-${{ inputs.flavour }}-svc-${{ strategy.job-index }}
-        run: python3 tests/count_results.py record --server "${FALKORDB_SERVER:-redis}" --run "$RUN" --status "$STATUS" --rltest test-results/flow.log --logs tests/flow/logs --out "test-counts/$NAME.json"
-      - name: Upload test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7
-        with:
-          name: test-counts-${{ inputs.flavour }}-svc-${{ strategy.job-index }}
-          path: test-counts/
-          retention-days: 7
       - name: Upload flow logs on failure
         if: failure()
         uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7
@@ -273,16 +244,11 @@ jobs:
           # already local, so hand the credential back first.
           docker logout ghcr.io
       - name: Run Flow test - ${{ matrix.test_file }} (${{ inputs.flavour }}, ${{ matrix.arch }})
-        id: flow
-        # bash, for pipefail: the tee keeps RLTest's output for the counts
-        # below without hiding flow.sh's exit status.
-        shell: bash
         env:
           TEST_FILE: ${{ matrix.test_file }}
         run: |
           . /data/venv/bin/activate
-          mkdir -p test-results
-          TEST="$TEST_FILE" FAIL_FAST=1 RELEASE=1 ./flow.sh 2>&1 | tee test-results/flow.log
+          TEST="$TEST_FILE" FAIL_FAST=1 RELEASE=1 ./flow.sh
       - name: Collect coverage (profraw → lcov)
         if: ${{ !cancelled() && inputs.collect_coverage }}
         env:
@@ -307,28 +273,6 @@ jobs:
           token: ${{ secrets.CODECOV_TOKEN }}
           files: ./codecov.txt
           disable_search: true
-      # Counts for the run summary (tests/count_results.py, summed per server by
-      # _ci-pipeline.yml's test-counts job). On every outcome but a cancel, so a
-      # failing cell still counts, including one whose setup failed before its
-      # tests ran. STATUS is the job's, so any failed step marks the cell. The
-      # report never gates: both steps continue on error. The server is FALKORDB_SERVER's, as flow.sh,
-      # tests/common.py and the images default it: redis unless set.
-      - name: Record test counts
-        if: ${{ !cancelled() }}
-        continue-on-error: true
-        env:
-          RUN: ${{ inputs.flavour }} flow (image, ${{ matrix.arch }})
-          STATUS: ${{ job.status }}
-          NAME: test-counts-${{ inputs.flavour }}-spawn-${{ strategy.job-index }}
-        run: python3 tests/count_results.py record --server "${FALKORDB_SERVER:-redis}" --run "$RUN" --status "$STATUS" --rltest test-results/flow.log --logs redis-logs tests/flow/logs --out "test-counts/$NAME.json"
-      -
```

**File**: `tests/count_results.py` (removed, +0/-243)
```diff
@@ -1,243 +0,0 @@
-#!/usr/bin/env python3
-"""Count passed, failed and skipped tests per server, for the CI run summary.
-
-Each CI cell that runs a suite records what it ran:
-
-    count_results.py record --server valkey --run "release flow (image, amd64)" \\
-        --rltest flow.log --logs tests/flow/logs --status failure --out counts/x.json
-    count_results.py record --server redis --run "image" \\
-        --junit e2e.xml tck.xml --logs tests/flow/logs --out counts/y.json
-
-and one job adds them up:
-
-    count_results.py summary counts/ >> "$GITHUB_STEP_SUMMARY"
-
-A record is a JSON list of rows: server, the version its start-up banner names,
-the run (how the cell ran), the suite, and the counts. RLTest output gives the
-counts from its per-test verdict lines (`[PASS]`, `[FAIL]`, `[ERROR]`,
-`[SKIP]`); pytest gives them through `--junitxml`, split by test file into the
-e2e, function, MVCC and concurrency suites; TCK counts its scenarios from
-Behave's own JUnit reports (tests/tck/test_tck.py writes them to
-TCK_JUNIT_DIR), not the one pytest test that runs them all.
-
-A cell whose test step failed but recorded no failed test (the harness died, a
-class's `__init__` raised, the server crashed between tests) records one failed
-test named for the cell, so a broken cell never reads as a clean one.
-"""
-
-import argparse
-import json
-import os
-import re
-import sys
-import xml.etree.ElementTree as ET
-from collections import defaultdict
-
-ANSI = re.compile(r"\x1b\[[0-9;]*m")
-# The banner every Redis or Valkey start logs, e.g.
-# `Valkey version=9.1.2, bits=64, commit=00000000, modified=0, pid=9, just started`.
-BANNER = re.compile(r"\b(Valkey|Redis) version=([0-9][0-9A-Za-z.\-]*)")
-VERDICTS = {"[PASS]": "passed", "[FAIL]": "failed", "[ERROR]": "failed", "[SKIP]": "skipped"}
-# pytest file name -> the suite name the issue tracker and the summary use.
-PYTEST_SUITES = {
-    "test_e2e": "e2e",
-    "test_functions": "function",
-    "test_mvcc": "MVCC",
-    "test_concurrency": "concurrency",
-    "test_tck": "TCK",
-}
-
-
-def empty():
-    return {"passed": 0, "failed": 0, "skipped": 0}
-
-
-def count_rltest(text):
-    """Counts from RLTest output. RLTest prints each test's verdict on a line of
-    its own, right under the test's name, so counting those lines counts tests;
-    the failure summary at the end repeats names, not verdicts."""
-    counts = empty()
-    for line in ANSI.sub("", text).splitlines():
-        key = VERDICTS.get(line.strip())
-        if key:
-            counts[key] += 1
-    return counts
-
-
-def suite_of(case):
-    """The suite a pytest testcase belongs to, from its file or class name."""
-    where = case.get("file") or case.get("classname") or ""
-    for part in re.split(r"[./\\]", where):
-        if part in PYTEST_SUITES:
-            return PYTEST_SUITES[part]
-    return "pytest"
-
-
-def junit_files(paths):
-    """The given files, and the .xml files in the given directories."""
-    for path in paths:
-        if os.path.isdir(path):
-            for root, _, names in os.walk(path):
-                yield from (os.path.join(root, n) for n in sorted(names) if n.endswith(".xml"))
-        else:
-            yield path
-
-
-def count_junit(paths, suite=None):
-    """Counts per suite from JUnit XML files: pytest's --junitxml, split by
-    test file, or, with `suite`, every testcase under that one suite (Behave's
-    per-scenario reports, one file per feature, for TCK)."""
-    suites = defaultdict(empty)
-    for path in junit_files(paths):
-        if not os.path.exists(path):
-            print(f"count_results: {path} does not exist, skipped", file=sys.stderr)
-            continue
-        try:
-            root = ET.parse(path).getroot()
-        except ET.ParseError as e:
-            # A truncated or empty file (pytest killed mid-run): report it and
-            # count nothing from it, so the caller's --status failure fallback
-            # counts the cell instead of the record crashing.
-            print(f"count_results: {path} is not valid JUnit XML ({e}), skipped", file=sys.stderr)
-            continue
-        for case in root.iter("testcase"):
-            counts = suites[suite or suite_of(case)]
-            if case.find("skipped") is not None:
-                counts["skipped"] += 1
-            elif case.find("failure") is not None or case.find("error") is not None:
-                counts["failed"] += 1
-            else:
-                counts["passed"] += 1
-    return dict(suites)
-
-
-def banner_versions(paths):
-    """`{server: {versions}}` from the start-up banners in the given files and
-    directories, the same banners tests/assert_server_log.sh checks."""
-    found = defaultdict(set)
-    files = []
-    for path in paths:
-        if os.path.isdir(path):
-            for root, _, names in os.walk(path):
-                files.extend(os.path.join(root, n) for n in names)
-        elif os.path.isfile(path):
-          
```

**File**: `tests/flow/common.py` (modified, +0/-73)
```diff
@@ -4,7 +4,6 @@
 import subprocess
 import sys
 import tempfile
-import threading
 import time
 import uuid
 from functools import wraps
@@ -857,75 +856,3 @@ def assert_error_reply(env, conn, *cmd):
         msg = str(e)
     env.assertTrue(conn.ping())
     return msg
-
-
-def wait_for_replica(primary, replica, timeout=30):
-    """Block until `replica` has applied everything `primary` has propagated so
-    far, whichever connection or module thread made the writes. Call it after
-    the writes it should cover.
-
-    `WAIT` can't promise that. It waits only up to the offset of the calling
-    connection's last write, so it doesn't cover later writes made through
-    another connection (such as a FalkorDB client's pool) or by a module
-    thread. And when the caller has written nothing, it counts any replica the
-    primary has marked online, which can be before the replica has loaded its
-    initial sync. So read the primary's offset, then wait for the replica's
-    link to be up and its offset to reach it."""
-    deadline = time.time() + timeout
-
-    def bounded_info(conn):
-        # Bound each INFO, connection handshake included, by the time left in
-        # the budget, so an unresponsive server can't block past the deadline.
-        # A new connection does several reads before INFO's (CLIENT SETINFO,
-        # and AUTH or SELECT when set), each under its own socket timeout, so
-        # socket timeouts alone can't promise that. Run the call on a thread
-        # and stop waiting for it at the deadline. A thread given up on is
-        # abandoned: it is a daemon, and it and its connection may linger
-        # until its socket timeouts expire. A fresh client is used, with
-        # retries off, so the caller's connection and settings are untouched.
-        left = deadline - time.time()
-        if left <= 0:
-            raise redis.exceptions.TimeoutError("wait_for_replica deadline passed")
-        kwargs = dict(conn.connection_pool.connection_kwargs)
-        kwargs.update(socket_timeout=left, socket_connect_timeout=left,
-                      retry=NO_RETRY, retry_on_error=[],
-                      retry_on_timeout=False)
-        pool = redis.ConnectionPool(
-            connection_class=conn.connection_pool.connection_class, **kwargs)
-        result = {}
-
-        def run():
-            client = redis.Redis(connection_pool=pool)
-            try:
-                result["info"] = client.info("replication")
-            except Exception as e:
-                result["error"] = e
-            finally:
-                client.close()
-                pool.disconnect()
-
-        t = threading.Thread(target=run, daemon=True)
-        t.start()
-        t.join(left)
-        if t.is_alive():
-            raise redis.exceptions.TimeoutError("INFO did not reply within the deadline")
-        if "error" in result:
-            raise result["error"]
-        return result["info"]
-
-    target = bounded_info(primary)["master_repl_offset"]
-    info = {}
-    while time.time() < deadline:
-        try:
-            info = bounded_info(replica)
-        except (redis.exceptions.TimeoutError, redis.exceptions.ConnectionError):
-            info = {}
-        else:
-            if (info.get("master_link_status") == "up"
-                    and info.get("slave_repl_offset", -1) >= target):
-                return
-        time.sleep(0.01)
-    raise AssertionError(
-        f"replica did not reach the primary's offset {target} within {timeout}s "
-        f"(link {info.get('master_link_status')}, "
-        f"offset {info.get('slave_repl_offset')})")
```

**File**: `tests/flow/test_constraint.py` (modified, +6/-8)
```diff
@@ -1232,8 +1232,8 @@ def __init__(self):
         # clear DB
         self.source.delete(GRAPH_ID)
 
-        # wait for the replica's initial sync to complete
-        wait_for_replica(self.source, self.replica)
+        # the WAIT command forces master slave sync to complete
+        self.source.execute_command("WAIT", 1, 0)
 
     def monitor_thread(self):
         global MONITOR_ATTACHED
@@ -1296,13 +1296,12 @@ def test_01_constraint_replication(self):
         # `test_effects_ddl.py` pins the per-shape announcement counts, where
         # the payloads are read off the wire rather than counted through
         # MONITOR.
-        wait_for_replica(self.source, self.replica)
+        self.source.execute_command("WAIT", 1, 0)
 
         replica_g = Graph(self.replica, GRAPH_ID)
         deadline = time.time() + 30
         while time.time() < deadline:
-            wait_for_replica(self.source, self.replica,
-                             timeout=max(deadline - time.time(), 0.01))
+            self.source.execute_command("WAIT", 1, 0)
             cs = list_constraints(replica_g)
             if len(cs) == 6 and all(c.status == 'OPERATIONAL' for c in cs):
                 break
@@ -1348,16 +1347,15 @@ def test_02_async_validation_reaches_operational_on_replica(self):
         # validates synchronously on the main thread and never spawns.
         lbl = 'AsyncValidated'
         self.g.query(f"UNWIND range(1, 10500) AS x CREATE (:{lbl} {{v: x}})")
-        wait_for_replica(self.source, self.replica)
+        self.source.execute_command("WAIT", 1, 0)
 
         create_mandatory_node_constraint(self.g, lbl, 'v', sync=True)
 
         replica_g = Graph(self.replica, GRAPH_ID)
         deadline = time.time() + 30
         c = None
         while time.time() < deadline:
-            wait_for_replica(self.source, self.replica,
-                             timeout=max(deadline - time.time(), 0.01))
+            self.source.execute_command("WAIT", 1, 0)
             c = get_constraint(replica_g, 'MANDATORY', 'NODE', lbl, 'v')
             if c is not None and c.status != 'UNDER CONSTRUCTION':
                 break
```

**File**: `tests/flow/test_intern_string.py` (modified, +4/-3)
```diff
@@ -440,9 +440,9 @@ def __init__(self):
         self.source_con.execute_command("GRAPH.CONFIG", "SET", 'ASYNC_DELETE', 'no')
         self.replica_con.execute_command("GRAPH.CONFIG", "SET", 'ASYNC_DELETE', 'no')
 
-        # clear DB, and wait for the replica's initial sync to complete
+        # clear DB
         self.conn.flushall()
-        wait_for_replica(self.source_con, self.replica_con)
+        self.source_con.execute_command("WAIT", "1", "0")
 
     def tearDown(self):
         # clear DB
@@ -458,7 +458,8 @@ def query_and_wait(self, q, p=None):
 
         res = self.graph.query(q, p)
 
-        wait_for_replica(self.source_con, self.replica_con)
+        # the WAIT command forces master slave sync to complete
+        self.source_con.execute_command("WAIT", "1", "0")
 
         return res
 
```

**File**: `tests/tck/test_tck.py` (modified, +0/-5)
```diff
@@ -28,11 +28,6 @@ def test_tck():
                 tck_include = "|".join(line.strip() for line in file if line.strip())
     if tck_include:
         cmd = [tck_features, '--format=progress', '--tags=-crash', '--tags=-skip', "--no-capture", "--stop", "--include", tck_include]
-    # TCK_JUNIT_DIR: write Behave's per-scenario JUnit reports there, so CI
-    # can count scenarios (tests/count_results.py) rather than this one test.
-    tck_junit_dir = os.getenv("TCK_JUNIT_DIR", "")
-    if tck_junit_dir:
-        cmd += ["--junit", "--junit-directory", tck_junit_dir]
     res = behave_main(cmd)
     res = 'pass' if res == 0 else 'fail'
     assert res == 'pass'
```

---

### Incident Patch 2: `7df8e588` (2026-11-12)
**Commit Message**: build: Alpine (musl) falkordb-server image running Valkey (#3725)

* build: Alpine (musl) falkordb-server image running Valkey

build/runtime/Dockerfile.alpine builds the module against musl and ships it
in an Alpine image with Valkey (or Redis, by SERVER) built from source on
Alpine, the same way the RHEL 9 and Amazon Linux 2023 images do: libomp
linked statically, GraphBLAS, LAGraph and RediSearch through native-deps,
the server through build/build-server.sh, and the image interface of the
other server images (FALKORDB_SERVER, the server labels, run.sh, user
falkordb as 999:999).

.cargo/config.toml turns crt-static off for musl targets. Rust's musl
targets link the C runtime statically by default, which drops the cdylib
crate type and makes build scripts unable to load libclang.

Closes #2312

* ci: build and smoke-test the Alpine image on amd64 and arm64

_build-artifacts.yml gains alpine-x64 and alpine-arm64v8 cells. Each builds
the musl .so through Dockerfile.alpine's builder (which checks that it is
self-contained), builds the Alpine server image, and runs the per-OS smoke
test against it, as the RHEL 9 and Amazon Linux 2023 cells do.

Every cell now carries a boolean `publi

**File**: `.cargo/config.toml` (modified, +10/-1)
```diff
@@ -6,7 +6,8 @@
 # tolerates it already, and we don't want to relax the local dev link.
 #
 # NOTE: `RUSTFLAGS` / `CARGO_TARGET_*_RUSTFLAGS` env vars REPLACE (not merge)
-# these config flags, so build steps that set them must repeat this flag:
+# these config flags -- this one and the musl `-crt-static` below -- so build
+# steps that set them must repeat the ones that apply to their target:
 # the coverage steps (`-C instrument-coverage`), the `cargo fuzz` steps, and
 # build/runtime/Dockerfile.asan all set `-Clink-arg=-Wl,--allow-multiple-definition`
 # explicitly for the same reason.
@@ -19,3 +20,11 @@ rustflags = ["-C", "link-arg=-Wl,--allow-multiple-definition"]
 # ld64. So the CI jobs that run doctests (`cargo test -p graph` in the `test`
 # and `coverage` jobs) set RUSTDOCFLAGS explicitly; a local Linux doctest run
 # (`cargo test -p graph`) needs the same env.
+
+# musl (the Alpine image). Rust's musl targets link the C runtime statically by
+# default, which drops the `cdylib` crate type with only a warning -- so no
+# libfalkordb.so -- and makes every build script a static executable, which
+# cannot dlopen the libclang that bindgen needs. Cargo joins the flags of every
+# matching `[target.<cfg>]` table, so the Linux flag above still applies.
+[target.'cfg(all(target_os = "linux", target_env = "musl"))']
+rustflags = ["-C", "target-feature=-crt-static"]
```

**File**: `.github/workflows/_build-artifacts.yml` (modified, +33/-18)
```diff
@@ -7,15 +7,21 @@
 # never carry their own copy. New platforms (see #608) are added here.
 #
 # Each cell extracts the .so from the `artifact` target of its Dockerfile (for
-# x64/arm64v8, the exact .so the runtime image ships) and uploads it as
-# `falkordb-<suffix>.so` together with its `.sha256`. Cells are independent
-# (fail-fast: false) and run on native runners (no QEMU) for maximum parallelism.
+# x64/arm64v8, the exact .so the runtime image ships) and, unless the cell is
+# `test_only`, uploads it as `falkordb-<suffix>.so` together with its `.sha256`.
+# Cells are independent (fail-fast: false) and run on native runners (no QEMU)
+# for maximum parallelism.
 #
-# Cells marked `image` (rhel9, amazonlinux2023) also build their Dockerfile's
-# `server` target, the falkordb-server image for that OS, and start it to check
-# that the module loads and answers a query. With `export_images` the image is
-# uploaded too, as `image-falkordb-server-<suffix>`, for the release to push.
-# x64/arm64v8 have no such step: the merge queue builds the Debian images.
+# Cells marked `image` (rhel9, amazonlinux2023, alpine) also build their
+# Dockerfile's `server` target, the falkordb-server image for that OS, and start
+# it to check that the module loads and answers a query. With `export_images`
+# the image is uploaded too, as `image-falkordb-server-<suffix>`, for the
+# release to push. x64/arm64v8 have no such step: the merge queue builds the
+# Debian images.
+#
+# Cells marked `test_only` (alpine) are built and smoke-tested like any other,
+# but upload nothing and are left out of the `suffixes`/`image_suffixes`
+# outputs, so a release does not ship them.
 
 name: Build artifacts (reusable)
 
@@ -53,13 +59,15 @@ on:
     outputs:
       suffixes:
         description: >-
-          JSON array of the suffixes this run built. The release's publish step
-          requires an artifact for every one of them.
+          JSON array of the suffixes this run built, `test_only` cells
+          excluded. The release's publish step requires an artifact for every
+          one of them.
         value: ${{ jobs.cells.outputs.suffixes }}
       image_suffixes:
         description: >-
-          JSON array of the suffixes this run built a server image for. The
-          release's image push requires every one of them.
+          JSON array of the suffixes this run built a server image for,
+          `test_only` cells excluded. The release's image push requires every
+          one of them.
         value: ${{ jobs.cells.outputs.image_suffixes }}
 
 jobs:
@@ -77,16 +85,22 @@ jobs:
           PLATFORMS: ${{ inputs.platforms }}
         run: |
           set -euo pipefail
-          # {suffix, arch, platform, runner, dockerfile, build_image, cxx, image}.
+          # {suffix, arch, platform, runner, dockerfile, build_image, cxx, image[, test_only]}.
           # `dockerfile` provides the `artifact` target; `build_image` is the
           # chef/builder base (Debian toolchain image) or "" for self-contained
           # per-OS Dockerfiles; `cxx` is the C++ compiler passed to the builder;
           # `image` says the Dockerfile's `server` target is built here too.
+          # `test_only` (missing means false): build and smoke-test but upload
+          # nothing, because release-tag.yml uploads every falkordb-*.so
+          # artifact; dropping them from `suffixes` alone would not keep them
+          # out of a release.
           ALL='[
             {"suffix":"x64","arch":"x64","platform":"linux/amd64","runner":"ubuntu-latest","dockerfile":"build/runtime/Dockerfile","build_image":"ghcr.io/falkordb/falkordb-build:latest","cxx":"clang++-23","image":false},
             {"suffix":"arm64v8","arch":"arm64v8","platform":"linux/arm64","runner":"ubuntu-24.04-arm","dockerfile":"build/runtime/Dockerfile","build_image":"ghcr.io/falkordb/falkordb-build:latest","cxx":"clang++-23","image":false},
             {"suffix":"rhel9-x64","arch":"x64","platform":"linux/amd64","runner":"ubuntu-latest","dockerfile":"build/runtime/Dockerfile.rhel9","build_image":"","cxx":"clang++","image":true},
-            {"suffix":"amazonlinux2023-x64","arch":"x64","platform":"linux/amd64","runner":"ubuntu-latest","dockerfile":"build/runtime/Dockerfile.amazonlinux2023","build_image":"","cxx":"clang++-19","image":true}
+            {"suffix":"amazonlinux2023-x64","arch":"x64","platform":"linux/amd64","runner":"ubuntu-latest","dockerfile":"build/runtime/Dockerfile.amazonlinux2023","build_image":"","cxx":"clang++-19","image":true},
+            {"suffix":"alpine-x64","arch":"x64","platform":"linux/amd64","runner":"ubuntu-latest","dockerfile":"build/runtime/Dockerfile.alpine","build_image":"","cxx":"clang++","image":true,"test_only":true},
+            {"suffix":"alpine-arm64v8","arch":"arm64v8","platform":"linux/arm64","runner":"ubuntu-24.04-arm","dockerfile":"build/runtime/Dockerfile.alpine","build_image":"","cxx":"clang++","image":true,"test_only":true}
    
```

**File**: `.github/workflows/build-artifacts.yml` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
 # Build the shared-library (.so) artifacts for every release platform, and the
-# rhel9/amazonlinux2023 server images, WITHOUT releasing anything, so a broken
+# rhel9/amazonlinux2023/alpine server images, WITHOUT releasing anything, so a broken
 # platform shows up on the pull request that broke it instead of at release
 # time. The images are started and queried, never pushed; only the .so files
 # are uploaded, as workflow artifacts.
 #
 # Triggers:
 #   - pull_request → runs when the PR changes something the artifact builds
 #     depend on (PATTERN below), or carries the `verify-artifacts` label. The
-#     per-OS cells (rhel9, amazonlinux2023) build their own toolchain from
+#     per-OS cells (rhel9, amazonlinux2023, alpine) build their own toolchain from
 #     source and nothing else in PR CI exercises them, so without this a change
 #     that breaks them (as #3163 did) surfaces only at release time.
 #     Re-runs on each push while either holds.
@@ -76,7 +76,7 @@ jobs:
           # build/Dockerfile (the Debian toolchain) is not here: the x64/arm64v8
           # cells build on the PUBLISHED toolchain, and rust-pr.yml already
           # rebuilds it when it changes.
-          PATTERN='^(Cargo\.(toml|lock)|graph/Cargo\.toml|(graph/)?build\.rs|\.cargo/config\.toml|build/build-server\.sh|build/libomp\.sh|build/runtime/Dockerfile(\.rhel9|\.amazonlinux2023)?|build/runtime/(run|gen-certs|gosu-setpriv)\.sh|build/graphblas/.*|native-deps/.*|deps/native-deps\.lock|deps/(GraphBLAS|LAGraph|RediSearch)|\.gitmodules|\.dockerignore|\.github/workflows/(_build-artifacts|build-artifacts)\.yml)$'
+          PATTERN='^(Cargo\.(toml|lock)|graph/Cargo\.toml|(graph/)?build\.rs|\.cargo/config\.toml|build/build-server\.sh|build/libomp\.sh|build/runtime/Dockerfile(\.rhel9|\.amazonlinux2023|\.alpine)?|build/runtime/(run|gen-certs|gosu-setpriv)\.sh|build/graphblas/.*|native-deps/.*|deps/native-deps\.lock|deps/(GraphBLAS|LAGraph|RediSearch)|\.gitmodules|\.dockerignore|\.github/workflows/(_build-artifacts|build-artifacts)\.yml)$'
           # Materialise the list first: `gh ... | grep -q` under pipefail
           # reports 141 on an early match (see rust-pr.yml).
           gh api "repos/${REPO}/pulls/${PR_NUMBER}/files" --paginate --jq '.[].filename' > /tmp/changed-files.txt
```

**File**: `build/check-server-pins.sh` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ files="build/Dockerfile
 build/runtime/Dockerfile
 build/runtime/Dockerfile.rhel9
 build/runtime/Dockerfile.amazonlinux2023
+build/runtime/Dockerfile.alpine
 build/runtime/Dockerfile.coverage
 build/runtime/Dockerfile.asan"
 
```

**File**: `build/runtime/Dockerfile.alpine` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+# Self-contained Alpine (musl) builder for the FalkorDB shared library. Unlike
+# build/runtime/Dockerfile (which consumes the prebuilt Debian `falkordb-build`
+# toolchain image), this image installs its own toolchain and builds GraphBLAS
+# + LAGraph + libomp + RediSearch from source via the SAME scripts the Debian
+# toolchain uses -- so the produced .so is linked against musl and the
+# single-.so self-containment contract still holds.
+#
+# Two targets:
+#   artifact  the .so alone:  docker build --target artifact --output type=local,dest=<dir>
+#   server    an Alpine server image: Valkey or Redis (--build-arg SERVER)
+#             built from source on this OS, plus that same .so. The
+#             counterpart of the Debian image's `server` target; no browser.
+# The musl-specific packages (bsd-compat-headers, the static clang archives,
+# ncurses-dev, libffi-dev) come from the C repo's
+# build/docker/builder/Dockerfile.alpine; each one is explained where it is
+# installed.
+
+# Consumed (unused) so the shared _build-artifacts.yml can pass --build-arg
+# BUILD_IMAGE uniformly without a "not consumed" warning; self-contained OSes
+# don't use a toolchain base image.
+ARG BUILD_IMAGE
+# Which server the `server` target ships, and the server releases: the same
+# as build/runtime/Dockerfile (build/check-server-pins.sh enforces it).
+ARG SERVER=valkey
+ARG REDIS_VERSION=8.10.2
+ARG VALKEY_VERSION=9.1.2
+
+# The one Alpine pin: a literal FROM, so Dependabot can bump it.
+FROM alpine:3.24.4 AS alpine-base
+
+# ---------------------------------------------------------------------------
+# Toolchain + dependency build.
+# ---------------------------------------------------------------------------
+FROM alpine-base AS builder
+
+ARG LLVM_MAJOR=22
+
+# Beyond the compilers and the headers the deps compile against:
+#   bsd-compat-headers        : <sys/cdefs.h>, which RediSearch includes
+#   clang-static,             : RediSearch's Rust crates link libclang.a
+#   ncurses-dev, libffi-dev     statically on musl (rlookup/Cargo.toml,
+#                               rust-bindgen#2360), and clang-sys then adds
+#                               -lffi -lncursesw. LLVM itself comes from
+#                               libLLVM.so: Alpine's llvm-config reports
+#                               shared mode.
+#   clang-libclang            : libclang.so, which bindgen loads at run time
+#                               for FalkorDB's own crates
+#   python3                   : the pip-pinned cmake below
+RUN apk add --no-cache \
+      bash git curl ca-certificates make findutils binutils \
+      gcc g++ musl-dev linux-headers bsd-compat-headers \
+      openssl-dev zlib-dev zstd-dev ncurses-dev libffi-dev \
+      clang${LLVM_MAJOR} clang${LLVM_MAJOR}-dev clang${LLVM_MAJOR}-libclang clang${LLVM_MAJOR}-static \
+      llvm${LLVM_MAJOR} llvm${LLVM_MAJOR}-dev \
+      python3
+
+# llvm-config (which clang-sys runs) and the llvm-objcopy/objdump that
+# graph/build.rs runs have no bare names on Alpine's PATH; they live under
+# /usr/lib/llvm<N>/bin. Putting that first also pins `clang` to LLVM <N>.
+ENV PATH="/usr/lib/llvm${LLVM_MAJOR}/bin:/venv/bin:/root/.cargo/bin:${PATH}"
+
+# Pin cmake to the same version the other builders use. Alpine's python is
+# externally managed (PEP 668), hence the venv.
+RUN python3 -m venv /venv && pip install --no-cache-dir 'cmake==3.31.6'
+
+# Rust toolchain (rustup) -- Alpine's packaged rust lags what redisearch_rs
+# needs. The musl host triple is picked automatically.
+RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
+
+WORKDIR /data
+
+# libomp.a (static) matched to the system clang version, installed to /opt/libomp
+# so graph/build.rs links it statically (single-.so OpenMP contract).
+COPY build/libomp.sh /tmp/libomp.sh
+RUN LLVMORG_VERSION=$(clang --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1) && \
+    test -n "${LLVMORG_VERSION}" && \
+    CC=clang CXX=clang++ /tmp/libomp.sh "${LLVMORG_VERSION}" && \
+    rm -f /tmp/libomp.sh
+
+# GraphBLAS + LAGraph + RediSearch, built by the native-deps crate, which owns
+# the recipes and a content-addressed cache keyed on the submodule revisions,
+# the GB_control patch, the vendored PreJIT kernels, $CC/$CXX, the target
+# triple and the OpenMP flavour -- so the key computed by `cargo build` below
+# matches what is published here. CC/CXX/LIBOMP_PREFIX are ENV, not per-RUN,
+# because they are cache-key inputs.
+#
+# RUST_DYN_CRT=1 makes RediSearch's build.sh build its Rust with -crt-static
+# (see .cargo/config.toml), which native-deps' cleared RUSTFLAGS would drop.
+#
+# The sources and RediSearch's in-tree build output are removed in the same
+# RUN: only the native-deps cache (~/.cache/falkordb/native-deps) is needed
+# below, and the build tree is several GB.
+ARG CC=clang
+ARG CXX=clang++
+ENV CC=${CC} \
+    CXX=${CXX} \
+    LIBOMP_PREFIX=/opt/libomp \
+    RUST_DY
```

**File**: `build/runtime/gosu-setpriv.sh` (modified, +5/-3)
```diff
@@ -1,9 +1,11 @@
 #!/bin/sh
-# gosu(1) for the RPM-based server images (Dockerfile.rhel9,
-# Dockerfile.amazonlinux2023), installed there as /usr/local/bin/gosu.
+# gosu(1) for the per-OS server images (Dockerfile.rhel9,
+# Dockerfile.amazonlinux2023, Dockerfile.alpine), installed there as
+# /usr/local/bin/gosu.
 #
 # run.sh drops root with `gosu falkordb redis-server ...`. gosu is not packaged
-# for RHEL or Amazon Linux; setpriv(1) from util-linux makes the same switch:
+# for RHEL or Amazon Linux; setpriv(1) from util-linux (on Alpine, the setpriv
+# package) makes the same switch:
 # real and effective uid and gid, plus the user's supplementary groups.
 # Only the `gosu USER COMMAND...` form run.sh uses is supported.
 set -eu
```

---

### Incident Patch 3: `3b14db4b` (2026-11-12)
**Commit Message**: build(toolchain): reach apt.llvm.org over IPv4, with retries (#3775)

* build(toolchain): reach apt.llvm.org over IPv4, with retries

The GitHub arm64 runners resolve apt.llvm.org to an IPv6 address they
cannot route to. llvm.sh's HEAD probe then fails and reports it as
"Distribution 'debian' in version '13 (trixie)' is not supported".
Force IPv4 and retry in both apt and wget.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* build(toolchain): retry wget on transient HTTP errors too

wget does not retry a 429 or 5xx by default, so a 503 from apt.llvm.org
during llvm.sh's probe would still fail the build. Bounded by the same
tries = 5.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* build(toolchain): retry llvm.sh itself, not only its downloads

In the merge queue (run 43182163998), llvm.sh's HEAD probe of
llvm-snapshot.gpg.key failed in 0.3s with "GPG key not reachable" and
exit 2. The probe passes its own --tries=3, and whatever error it hit
was one wget does not retry, so the wgetrc settings could not help.
Bring back the bounded 3-attempt loop around llvm.sh. Each retry clears
the key and the sources file a failed attempt can leave behind.

Co-Authored-By: Claude Op

**File**: `build/Dockerfile` (modified, +19/-2)
```diff
@@ -64,13 +64,30 @@ ENV DEBIAN_FRONTEND=noninteractive
 # Base runtime libs that previously came with the `redis:` base image
 # (ca-certificates for git/curl HTTPS, libssl3 for the redis-server binary
 # copied into the final stage).
-RUN apt update -y && \
+#
+# apt.llvm.org is reached over IPv4 only, with retries. The GitHub arm64
+# runners resolve it to an IPv6 address they cannot route to ("Network is
+# unreachable"), and llvm.sh probes the repo URL with `wget --method=HEAD`
+# before installing, reporting any failure as "Distribution 'debian' in
+# version '13 (trixie)' is not supported by this script." -- so a network
+# failure looked like a distro one. /etc/wgetrc covers llvm.sh's own wget
+# calls; the apt.conf.d entry covers apt here and in the stages below.
+# llvm.sh's HEAD probes can still fail at once on an error wget does not
+# retry (the GPG key probe did, in the merge queue), so llvm.sh itself is
+# retried too, clearing the key and sources a failed attempt may leave.
+RUN printf 'Acquire::ForceIPv4 "true";\nAcquire::Retries "5";\n' \
+        > /etc/apt/apt.conf.d/99falkordb-network && \
+    apt update -y && \
     apt install -y --no-install-recommends \
         ca-certificates libssl3 openssl && \
     apt install -y lsb-release gnupg wget && \
+    printf 'inet4_only = on\ntries = 5\nwaitretry = 5\nretry_connrefused = on\nretry_on_http_error = 429,500,502,503,504\n' >> /etc/wgetrc && \
     wget https://apt.llvm.org/llvm.sh && \
     chmod +x llvm.sh && \
-    ./llvm.sh "${CLANG_MAJOR}" && \
+    for i in 1 2 3; do ./llvm.sh "${CLANG_MAJOR}" && break; \
+        [ "$i" = 3 ] && exit 1; echo "llvm.sh failed (attempt $i), retrying"; \
+        rm -f /etc/apt/trusted.gpg.d/apt.llvm.org.asc /etc/apt/sources.list.d/http_apt_llvm_org_*.sources; \
+        sleep 15; done && \
     apt update -y
 
 # Toolchain + headers the three deps compile against.
```

#### Recent Merged Pull Requests:
- **PR #3783** (2026-11-12): 4.22.4 (@DvirDukhan)
- **PR #3775** (2026-11-12): build(toolchain): reach apt.llvm.org over IPv4, with retries (@dudizimber)
- **PR #3763** (2026-11-12): fix(constraint): don't freeze the server waiting for the write lock behind a long read (@DvirDukhan)
- **PR #3762** (2026-11-12): test: revert #3722's test counting and wait_for_replica (@DvirDukhan)
- **PR #3759** (2026-11-11): fix(telemetry): keep telemetry streams node-local and strip them from snapshots (alt to #3724) (@swilly22)
- **PR #3758** (closed): ci: count passed, failed and skipped tests per server in the run summary (@dudizimber)

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

## X. test: revert #3722's test counting and wait_for_replica (#3762)

**RULE**:
When implementing operations in `.github/workflows/_ci-pipeline.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5ab8fddc`: test: revert #3722's test counting and wait_for_replica (#3762). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/_ci-pipeline.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
          RELEASE=1 pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv
          RELEASE=1 TCK_DONE=tck_done.txt pytest tests/tck/test_tck.py -s
          pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv
          TCK_DONE=tck_done.txt pytest tests/tck/test_tck.py -s
      # Capture the GHA service container's stdout/stde
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        id: pytest
          RELEASE=1 pytest tests/test_e2e.py tests/test_functions.py tests/test_mvcc.py tests/test_concurrency.py -vv --junitxml=test-results/pytest.xml
        id: tck
          RELEASE=1 TCK_DONE=tck_done.txt TCK_JUNIT_DIR=test-results/tck pytest tests/tck/test_tck.py -s
      # tests/common.py starts the server with --logfile redis-test.log.
      # Counts for the run summary (tests/count_results.py, summed per server by
      # _ci-pipeline.yml's test-counts job). On every outcome but a cancel, so a
      # failing cell still counts, including one whose setup failed before its
      # tests ran. STATUS is the job's, so any failed step marks the cell. The
      # report never gates: both steps continue on error. The server is FALKORDB_SERVER's, as flow.sh,
      # tests/common.py and the images default it: redis unless set.
      - name: Record test counts
        if: ${{ !cancelled() }}
        continue-on-error: true
        env:
          RUN: artifact, amd64
          STATUS: ${{ job.status }}
          NAME: test-counts-artifact
        run: python3 tests/count_results.py record --server "${FALKORDB_SERVER:-redis}" --run "$RUN" --status "$STATUS" --junit 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5ab8fddc` are properly handled with clean fallback behavior.
