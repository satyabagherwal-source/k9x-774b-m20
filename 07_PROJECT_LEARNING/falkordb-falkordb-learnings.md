> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `1c0e6c8d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T11:52:33.996Z  
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
> **Harvest Timestamp**: 2026-10-29T11:47:31.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10499 stars

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

### Core Architecture Module: `src/graph_core.rs`
```
//! Core graph execution and concurrency primitives.
//!
//! This module owns the execution model used by Redis command handlers.
//!
//! ## Concurrency model
//! ```text
//! Client query
//!    |
//!    v
//! query_mut -> threadpool worker
//!    |
//!    +--> execute_query() detects write IR?
//!            |
//!            +-- no --> run on MVCC read snapshot (parallel reads)
//!            |
//!            +-- yes -> enqueue blocked client + query
//!                        |
//!                        v
//!                  process_write_queued_query()
//!                        |
//!                        +--> single writer loop
//!                              +--> execute_query_write()
//!                              +--> commit() on success / rollback() on error
//! ```
//!
//! The key design goal is predictable write ordering with high read throughput.
//! Reads are lock-light and concurrent; writes are serialized through an explicit
//! queue guarded by `write_loop`. Every query runs under a
//! [`crate::query_session::QuerySession`], which owns its locks and documents the
//! reader→writer protocol.

use crate::{
    config::{
        CONFIGURATION_IMPORT_FOLDER, MAX_QUEUED_QUERIES, QUERY_MEM_CAPACITY, RESULTSET_SIZE,
        TIMEOUT, TIMEOUT_DEFAULT, TIMEOUT_MAX,
    },
    reply::{reply_compact, reply_verbose},
    slow_log::SlowLog,
    telemetry,
};
use atomic_refcell::AtomicRefCell;
use crossfire::{
    MTx, Rx,
    mpsc::{List, unbounded_blocking},
};
use graph::{
    effects::payload::take_effects_buffer,
    effects::{EffectsBuffer, ReplicationSink},
    graph::{
        graph::{Graph, Plan},
        mvcc_graph::MvccGraph,
    },
    planner::IR,
    runtime::runtime::{QueryStatistics, Runtime},
    threadpool::{QueueSlot, spawn},
};
use orx_tree::{Collection, Dfs, DynTree, NodeRef};
use parking_lot::RwLock;
use redis_module::{Context, ContextFlags, RedisResult, RedisString, RedisValue, raw};
use std::{
    collections::HashMap,
    os::raw::{c_char, c_void},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Instant,
};

use crate::allocator::{
    current_thread_usage, disable_tracking, enable_tracking, net_thread_usage, reset_counter,
};
use crate::dispatch::must_run_inline;
use crate::divergence_guard;
use crate::query_session::QuerySession;

/// The prefix of `s` before its first NUL byte, or all of `s` if it holds none.
///
/// This is the whole of C's NUL handling, in one place. C reads both the graph name and
/// the query text out of a `RedisModuleString` with the length discarded
/// (`RM_StringPtrLen(x, NULL)`) and treats what it gets as a C string from there on, so
/// a NUL simply ends the value: the query `RETURN 1\0<anything>` runs as `RETURN 1`, and
/// a graph addressed as `a\0b` is named `a`. Truncating the same way is what keeps the
/// two engines answering alike, and it is also what keeps a NUL out of the `CString`
/// conversions that used to abort the process (#2490).
#[must_use]
pub fn up_to_nul(s: &str) -> &str {
    match s.find('\0') {
        Some(end) => &s[..end],
        None => s,
    }
}

/// The graph name the C engine would see for `key`: [`up_to_nul`] of its bytes.
///
/// C `rm_strdup`s this name into the `GraphContext`, and everything downstream sees only
/// it — the registry, the `telemetry{%s}` stream name, and every reply that names a
/// graph or a schema.
///
/// Note that this is the *name*, not the key the command addressed: C looks a graph up
/// by the full key bytes and only rebuilds a key from the name when it creates one.
/// See [`c_graph_key`].
#[must_use]
pub fn c_graph_name(key: &RedisString) -> String {
    up_to_nul(&key.to_string_lossy()).to_owned()
}

/// The Redis key C stores a *newly created* graph under: [`c_graph_name`], rebuilt into
/// a key name. Identical to `key` unless it holds a NUL.
///
/// This is `GraphContext_SetKey`, which opens
/// `RM_CreateString(gc->graph_name, strlen(gc->graph_name))` rather than the key the
/// command named. C is genuinely asymmetric here — it looks a graph up by the full key
/// bytes but stores a new one under the truncated name — so a graph asked for as
/// `a\0b` lands at key `a`, is not found by a later lookup of `a\0b`, and is replaced
/// by whatever the next create under that name produces. Reproduced deliberately: the
/// point of this path is that both engines answer the same thing.
#[must_use]
pub fn c_graph_key(
    ctx: &Context,
    key: &RedisString,
) -> RedisString {
    // Built from the bytes, not from `c_graph_name`: a Redis key name is binary and
    // need not be UTF-8 (`test_binary_key_name_scan_skip` keeps a graph under
    // `\xc3\x28...`), so rebuilding it through a lossy `String` would replace those
    // bytes and store the graph under a key nobody can address. Truncation is the only
    // difference this is allowed to make.
    let bytes = key.as_slice();
    let end = bytes.iter().position(|b| *b == 0).unwrap_or(bytes.len());
    RedisString::create_from_slice(ctx.get_raw(), &bytes[..end])
}

/// Global registry of all live graph instances.
/// Used by the pthread_atfork prepare handler to sync all GraphBLAS matrices
/// before fork, preventing deadlocks in the BGSAVE child process.
pub static GRAPH_REGISTRY: std::sync::LazyLock<
    parking_lot::Mutex<HashMap<String, Arc<RwLock<ThreadedGraph>>>>,
> = std::sync::LazyLock::new(|| parking_lot::Mutex::new(HashMap::new()));

pub fn register_graph(
    name: String,
    arc: Arc<RwLock<ThreadedGraph>>,
) {
    // Invariant: every registered name must have been removed from the
    // registry before being re-inserted. `graph_free` removes entries on
    // Redis key delete/overwrite/expire, and the RDB multi-key load path
    // mutates the placeholder Arc in place rather than rebinding the name.
    // If this assert fires, a caller is leaking the previously-registered
    // Arc and likely racing index/teardown shutdown.
    let displaced = GRAPH_REGISTRY.lock().insert(name, arc);
    debug_assert!(
        displaced.is_none(),
        "register_graph: name already registered; missing graph_free or placeholder swap"
    );
    // Drop any displaced graph off the main Redis thread. Index::drop ->
    // RediSearch_DropIndex queues a destroyCallback to RediSearch's GC
    // thread pool when its timer can't be stopped synchronously; that
    // callback asserts gc->stopped == 1 and aborts under the resulting
    // race. Moving the drop to a background thread also routes Index::drop
    // through the GIL-acquiring path, which the synchronous main-thread
    // drop intentionally skips.
    if let Some(displaced) = displaced {
        std::thread::spawn(move || drop(displaced));
    }
}

/// True if `arc` is still the graph registered under some Redis key.
///
/// A query that has just escalated to writer mode checks this before mutating, and
/// **aborts** if it fails — mirroring C's `QueryCtx_AcquireWriteLock`, which re-opens
/// the key under WRITE and raises a runtime exception when the key is empty, is not a
/// graph, or holds a *different* value than the one the query started on (our
/// `data_ptr` comparison is that third check).
///
/// Aborting rather than committing-and-discarding is required, not just tidy: the
/// write would still be replicated, and a replica's `GRAPH.EFFECT` handler *creates* a
/// graph when the key is missing, so it would resurrect a key the primary no longer
/// has — a diverged replica.
///
/// One check is enough. The exposed window is exactly [release read lock → take GIL],
/// because every path that removes a key (`GRAPH.DELETE`, `FLUSHALL`, overwrite,
/// expiry) runs inline on the main thread, which cannot execute a command callback
/// while this query holds the GIL.
///
/// The scan compares `data_ptr` rather than looking the name up: `rename_graph`
/// re-keys the registry without updating `Graph::name()`, so an O(1) by-name lookup
/// would wrongly abort after a `RENAME`.
pub fn graph_is_registered(arc: &Arc<RwLock<ThreadedGraph>>) -> bool {
    let target = arc.data_ptr() as usize;
    GRAPH_REGISTRY
        .lock()
        .values()
        .any(|registered| registered.data_ptr() as usize == target)
}

/// Re-key a registry entry when a Redis RENAME moves a graph to a new key.
///
/// `graph_free` only runs for the *overwritten destination* value, so without
/// this the old name keeps a stale entry: the next `register_graph` under
/// that name (e.g. a concurrent write query re-creating the key) displaces
/// it and trips the invariant assert above.
pub fn rename_graph(
    old_name: &str,
    new_name: &str,
) {
    let displaced = {
        let mut reg = GRAPH_REGISTRY.lock();
        reg.remove(old_name)
            .and_then(|arc| reg.insert(new_name.to_string(), arc))
    };
    // The destination entry is normally already removed (overwriting the key
    // ran `graph_free` synchronously), but under lazy free that removal is
    // deferred, so we may displace it here. Drop off the main Redis thread
    // (see `register_graph` for the rationale).
    if let Some(displaced) = displaced {
        std::thread::spawn(move || drop(displaced));
    }
}

pub struct WriteMessage {
    pub bc: BlockedClient,
    pub query: Arc<str>,
    pub compact: bool,
    pub cached: bool,
    pub key_name: Arc<str>,
    pub timeout: Option<i64>,
    pub received_at: i64,
    pub enqueue_instant: Instant,
    pub waiting_id: u64,
    /// The query's admission slot, released when the drainer dequeues it — so
    /// writes waiting here count against `MAX_QUEUED_QUERIES` exactly like jobs
    /// waiting in the pool queue. Dropped with the message on every other path
    /// (a failed send, a graph freed with writes still queued).
    pub slot: Option<QueueSlot>,
    /// True if this is a GRAPH.PROFILE write: execute with profiling enabled and
    /// reply with the profile tree instead of the result set. Otherwise handled
    /// exactly like a GRA
```

### Core Architecture Module: `bench/pmc_tool.c`
```
// PMU counter tool for Apple Silicon using private kperf/kperfdata frameworks.
// Requires root. Counts system-wide events (all CPUs) across a time window.
// Usage:
//   pmc_tool list [filter]
//   pmc_tool window
//
// `window` programs the counters, prints `READY`, and then blocks until it
// reads a line on stdin; the counter delta it prints covers everything that
// happened in between, on every CPU. The caller runs whatever it wants to
// measure during that gap:
//
//     p = Popen([pmc, "window"], stdin=PIPE, stdout=PIPE, text=True)
//     p.stdout.readline()          # "READY"
//     subprocess.run(cmd)          # measured, run by the caller
//     out, _ = p.communicate("\n") # counter deltas
//
// This deliberately does NOT run the command itself. The binary is deployed
// setuid-root so it can program the PMU, and a setuid binary that execs a
// caller-supplied command is a local privilege escalation waiting to happen —
// the previous version did exactly that and had to drop groups, gid and uid by
// hand before the exec to stay safe. Not exec'ing at all removes that whole
// class of bug: the privileged process now takes no caller-controlled input,
// and the measured command runs as the unprivileged caller because the caller
// is the one that spawns it. The counters are system-wide, so bracketing the
// command in time is all that was ever needed.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
// strcasestr is not declared by <string.h> under strict feature sets; it is
// declared in <strings.h> on macOS and needs _GNU_SOURCE on glibc.
#include <strings.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include <sys/sysctl.h>
#include <sys/time.h>

typedef uint64_t kpc_config_t;
typedef struct kpep_db kpep_db;
typedef struct kpep_config kpep_config;
typedef struct kpep_event {
    const char *name;
    const char *description;
    const char *errata;
    const char *alias;
    const char *fallback;
    uint32_t mask;
    uint8_t number;
    uint8_t umask;
    uint8_t reserved;
    uint8_t is_fixed;
} kpep_event;

// kperfdata.framework
extern int kpep_db_create(const char *name, kpep_db **db);
extern int kpep_db_events_count(kpep_db *db, size_t *count);
extern int kpep_db_events(kpep_db *db, kpep_event **buf, size_t buf_size);
extern int kpep_db_event(kpep_db *db, const char *name, kpep_event **ev);
extern int kpep_config_create(kpep_db *db, kpep_config **cfg);
extern int kpep_config_force_counters(kpep_config *cfg);
extern int kpep_config_add_event(kpep_config *cfg, kpep_event **ev, uint32_t flag, uint32_t *err);
extern int kpep_config_kpc(kpep_config *cfg, kpc_config_t *buf, size_t buf_size);
extern int kpep_config_kpc_count(kpep_config *cfg, size_t *count);
extern int kpep_config_kpc_classes(kpep_config *cfg, uint32_t *classes);
extern int kpep_config_kpc_map(kpep_config *cfg, size_t *buf, size_t buf_size);

// kperf.framework
extern int kpc_force_all_ctrs_set(int val);
extern int kpc_set_config(uint32_t classes, kpc_config_t *config);
extern int kpc_set_counting(uint32_t classes);
extern uint32_t kpc_get_counter_count(uint32_t classes);
extern int kpc_get_cpu_counters(bool all_cpus, uint32_t classes, int *curcpu, uint64_t *buf);

#define KPC_MAX_COUNTERS 32
#define MAX_EVENTS 8

static const char *event_names[] = {
    "FIXED_CYCLES",
    "FIXED_INSTRUCTIONS",
    "INST_BRANCH",
    "BRANCH_MISPRED_NONSPEC",
    "L1D_CACHE_MISS_LD",
    "L1D_CACHE_MISS_ST",
};
static const int n_events = sizeof(event_names) / sizeof(event_names[0]);

static int get_ncpu(void) {
    int ncpu = 0;
    size_t sz = sizeof(ncpu);
    sysctlbyname("hw.ncpu", &ncpu, &sz, NULL, 0);
    return ncpu;
}

// Upper bound on CPUs the counter buffer is sized for. kpc_get_cpu_counters
// fills one counter_count-wide row per CPU, so the buffer must cover every CPU
// the kernel reports or it writes past the end.
#define KPC_MAX_CPUS 256

static void read_counters(uint32_t classes, int ncpu, uint32_t counter_count, uint64_t *sums) {
    static uint64_t buf[KPC_MAX_CPUS * KPC_MAX_COUNTERS];
    if (ncpu > KPC_MAX_CPUS || counter_count > KPC_MAX_COUNTERS) {
        // Refuse rather than truncate: a short read would silently under-count
        // and the numbers would still look plausible.
        fprintf(stderr,
                "pmc_tool: ncpu=%d counter_count=%u exceeds buffer (%d x %d)\n",
                ncpu, counter_count, KPC_MAX_CPUS, KPC_MAX_COUNTERS);
        exit(1);
    }
    int ret = kpc_get_cpu_counters(true, classes, NULL, buf);
    if (ret != 0) {
        fprintf(stderr, "kpc_get_cpu_counters failed: %d\n", ret);
        exit(1);
    }
    memset(sums, 0, KPC_MAX_COUNTERS * sizeof(uint64_t));
    for (int c = 0; c < ncpu; c++)
        for (uint32_t i = 0; i < counter_count; i++)
            sums[i] += buf[c * counter_count + i];
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s list [filter] | window\n", argv[0]);
        return 1;
    }

    kpep_db *db = NULL;
    int ret = kpep_db_create(NULL, &db);
    if (ret != 0) {
        fprintf(stderr, "kpep_db_create failed: %d\n", ret);
        return 1;
    }

    if (strcmp(argv[1], "list") == 0) {
        size_t count = 0;
        kpep_db_events_count(db, &count);
        kpep_event **evs = malloc(count * sizeof(void *));
        kpep_db_events(db, evs, count * sizeof(void *));
        const char *filter = argc > 2 ? argv[2] : NULL;
        for (size_t i = 0; i < count; i++) {
            if (filter && !strcasestr(evs[i]->name, filter)) continue;
            printf("%-40s %s\n", evs[i]->name, evs[i]->description ? evs[i]->description : "");
        }
        return 0;
    }

    if (strcmp(argv[1], "window") != 0) {
        fprintf(stderr, "usage: %s list [filter] | window\n", argv[0]);
        return 1;
    }

    kpep_config *cfg = NULL;
    if (kpep_config_create(db, &cfg) != 0) { fprintf(stderr, "config_create failed\n"); return 1; }
    if (kpep_config_force_counters(cfg) != 0) { fprintf(stderr, "force_counters failed\n"); return 1; }

    for (int i = 0; i < n_events; i++) {
        kpep_event *ev = NULL;
        if (kpep_db_event(db, event_names[i], &ev) != 0) {
            fprintf(stderr, "event not found: %s (use 'list' to see names)\n", event_names[i]);
            return 1;
        }
        if (kpep_config_add_event(cfg, &ev, 0, NULL) != 0) {
            fprintf(stderr, "add_event failed: %s\n", event_names[i]);
            return 1;
        }
    }

    uint32_t classes = 0;
    size_t reg_count = 0;
    size_t counter_map[KPC_MAX_COUNTERS] = {0};
    kpc_config_t regs[KPC_MAX_COUNTERS] = {0};
    kpep_config_kpc_classes(cfg, &classes);
    kpep_config_kpc_count(cfg, &reg_count);
    kpep_config_kpc_map(cfg, counter_map, sizeof(counter_map));
    kpep_config_kpc(cfg, regs, sizeof(regs));

    if (kpc_force_all_ctrs_set(1) != 0) {
        fprintf(stderr, "kpc_force_all_ctrs_set failed (need root)\n");
        return 1;
    }
    if ((classes & 2 /*configurable*/) && reg_count) {
        if (kpc_set_config(classes, regs) != 0) {
            fprintf(stderr, "kpc_set_config failed\n");
            return 1;
        }
    }
    if (kpc_set_counting(classes) != 0) {
        fprintf(stderr, "kpc_set_counting failed\n");
        return 1;
    }

    int ncpu = get_ncpu();
    uint32_t counter_count = kpc_get_counter_count(classes);
    uint64_t before[KPC_MAX_COUNTERS], after[KPC_MAX_COUNTERS];

    struct timeval t0, t1;
    read_counters(classes, ncpu, counter_count, before);
    gettimeofday(&t0, NULL);

    /* Hand the window to the caller: announce readiness, then block until it
     * tells us the measured command has finished. stdout is a pipe in normal
     * use, so it must be flushed explicitly or READY sits in the buffer and
     * the caller deadlocks waiting for it. */
    printf("READY\n");
    fflush(stdout);

    int wait_failed = 0;
    {
        char line[64];
        if (fgets(line, sizeof(line), stdin) == NULL) {
            /* EOF without a line means the caller died or closed the pipe
             * early. Report it rather than printing a window that ended at an
             * arbitrary point and looks like a real measurement. */
            wait_failed = 1;
        }
    }

    gettimeofday(&t1, NULL);
    read_counters(classes, ncpu, counter_count, after);

    kpc_set_counting(0);
    kpc_force_all_ctrs_set(0);

    if (wait_failed) {
        fprintf(stderr, "pmc_tool: stdin closed before the window was ended\n");
        return 1;
    }

    double elapsed = (t1.tv_sec - t0.tv_sec) + (t1.tv_usec - t0.tv_usec) / 1e6;
    printf("ELAPSED %.6f\n", elapsed);
    for (int i = 0; i < n_events; i++) {
        uint64_t a = after[counter_map[i]], b = before[counter_map[i]];
        // The counters are free-running and monotonic, so after < before means
        // something reprogrammed or wrapped them mid-window. Refuse rather than
        // print the underflowed difference, which would be an enormous number
        // that still looks like a measurement.
        if (a < b) {
            fprintf(stderr, "pmc_tool: counter %s went backwards (%llu -> %llu)\n",
                    event_names[i], (unsigned long long)b, (unsigned long long)a);
            return 1;
        }
        printf("EVENT %s %llu\n", event_names[i], (unsigned long long)(a - b));
    }
    fflush(stdout);
    return 0;
}

```

### Core Architecture Module: `bench/src/falkorbench/__init__.py`
```
"""Per-query performance harness for FalkorDB.

Layered so that each piece can be tested without a running server:

  model      value types (Query, Metric) — no I/O
  queries    the canonical query set and graph setup — data only
  metrics    CSV parsing, ratios, thresholds, normalisation — pure functions
  client     the falkordb-py control plane: server lifecycle, setup, probes
  counters   per-process instruction/cycle backends (rusage / perf / none)
  measure    the full-set measurement loop
  callgrind  deterministic instruction counts by differencing two runs
  compare    local regression gate      } both on `metrics`, so a local verdict
  report     the CI markdown comment    } and the CI comment cannot disagree
  profile    samply profile of one query
  flow       per-flow-test-file measurement

The measurement boundary is deliberate and load-bearing: anything *inside* a
counter window is a C binary (`redis-benchmark`, or `redis-cli -r N` under
callgrind), because the counters either window on a subprocess lifetime or are
system-wide and would otherwise absorb this process's own work. `client` is
only ever used *outside* a measurement window.
"""

```

### Core Architecture Module: `bench/src/falkorbench/callgrind.py`
```
"""Deterministic per-query instruction counts via callgrind.

Why this exists: no hosted CI runner exposes a PMU. Measured, not assumed — GCE
rejects `--performance-monitoring-unit` on the v1 and beta APIs alike, `perf`
there reports `<not supported>`, macOS runners return 0 for `proc_pid_rusage`'s
ri_instructions, and kperf inside a macOS runner fails with
`kpep_db_create failed: 7`. Hardware counters are simply unavailable.

Callgrind counts instructions in *software*, so it needs no PMU and no
privileges, and its counts are near-deterministic.

## How a query is isolated: differencing, not windowing

Callgrind reports one total when the process exits. The obvious approach is to
window with `callgrind_control --instr=on/off --dump` around each query, and
that is what the first version did. **It does not work in a container.**
`callgrind_control` reaches the process through vgdb FIFOs in /tmp, and
reproduced locally in `debian:trixie-slim` (valgrind 3.24.0, the CI version):

    ==236== open fifo /tmp/vgdb-pipe-from-vgdb-to-236-by-???-on-???
    ==236== valgrind: fatal error: vgdb FIFO cannot be opened.

The server dies on the first control command, so every dump silently never
arrives and every query reports nothing. Setting USER/LOGNAME does not help;
`--vgdb-prefix` makes `callgrind_control` hang instead.

So each query is measured by **differencing two complete runs** of the same
query at different repeat counts:

    T(n2) = startup + setup + compile + n2 * exec
    T(n1) = startup + setup + compile + n1 * exec
    exec  = (T(n2) - T(n1)) / (n2 - n1)

Startup, graph setup and one-time plan compilation appear identically in both
runs and cancel *exactly* — not approximately — because the counts are
deterministic. The price is two valgrind runs per query, each paying setup,
which is why CG_SETUP is deliberately small.

## Precision, and why the span is chosen per query

With the module loaded, CI measured per-run drift of ~300-600k instructions on a
~236M baseline. At a fixed span of 100 that is 3-6k instr/exec of error —
nothing for a 7M-instruction query, but **6.7% for `RETURN 1`**, which is how
the control row once read 1.0673x on two builds whose Rust was byte-identical.
The error is *absolute*, so "treat sub-1% as noise" is wrong in both directions.

The span is therefore chosen per query as `drift / (TARGET_REL * cost)`, holding
the *differenced work* constant instead of the span. Cheap queries get a wide
span (still cheap: `RETURN 1` at span ~3300 is ~300M instructions), expensive
ones keep the default.

## Not comparable to the full measurement set

CG_SETUP builds a 1,000-node graph, not the 10,000-node one, and skips the
vector/fulltext indexes, constraints, UDFs and DEBUG RELOAD. Absolute numbers
here are *not* comparable to `measure` rows — only PR-vs-base ratios are, where
both sides run this identical setup.
"""

from __future__ import annotations

import glob
import math
import shutil
import subprocess
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from falkorbench.model import Query

# Per-run drift in the whole-process total, measured in CI with the module
# loaded. Divided by the span this becomes the per-execution error, so it is an
# *absolute* budget, not a relative one.
DRIFT_INSTR = 600_000

# Per-execution precision to aim for. span = drift / (TARGET_REL * cost), so the
# differenced work is drift/TARGET_REL = 300M instructions regardless of how
# cheap the query is — a few seconds under valgrind.
TARGET_REL = 0.002
MAX_SPAN = 4000

# Widest per-execution error bar still worth reporting. A row that cannot be
# resolved better than this on the host it ran on is dropped rather than
# printed: a number nobody can reproduce is worse than a gap, because it still
# lands in the table looking like a measurement.
MAX_REL_ERR = 0.02

# A small graph that supports the cg-flagged subset. Deliberately not the full
# SETUP: that builds 10k nodes, 20k edges, vector and fulltext indexes,
# constraints, UDFs and a DEBUG RELOAD, and every one of those instructions
# would be paid twice per measured query under instrumentation.
#
# The Person index is created before the ring so the ring build is index-driven
# rather than a 1000x1000 nested scan.
CG_SETUP: tuple[str, ...] = (
    (
        "UNWIND range(0, 999) AS i "
        "CREATE (:Person {id: i, name: 'p' + toString(i), age: i % 80, score: i * 1.5})"
    ),
    "CREATE INDEX FOR (p:Person) ON (p.id)",
    (
        "UNWIND range(0, 999) AS i "
        "MATCH (a:Person {id: i}) MATCH (b:Person {id: (i + 1) % 1000}) "
        "CREATE (a)-[:KNOWS]->(b)"
    ),
    # `delete node` deletes one :Tmp per execution, so there must be more of them
    # than the highest repeat count — MAX_SPAN plus n1, since a cheap delete
    # query gets its span widened. Running dry would not fail loudly: the
    # remaining executions would measure a no-op delete and quietly halve the
    # reported cost.
    "UNWIND range(0, 4999) AS i CREATE (:Tmp {x: i})",
)


@dataclass
class Measurement:
    query: str
    instr: float
    span: int
    rel_err: float
    drift: float
    seconds: float
    widened_from: int | None = None


class Skipped(Exception):
    """This query produced no usable number, with the reason as the message."""


def parse_total(path: str) -> int | None:
    """Instruction count from a callgrind output file.

    Callgrind writes `totals:` (and `summary:`) with the first field being
    instruction reads. None when neither is present, which happens for a file
    still being written.
    """
    try:
        with open(path, errors="replace") as f:
            for line in f:
                if line.startswith(("totals:", "summary:")):
                    parts = line.split(":", 1)[1].split()
                    if parts:
                        return int(parts[0])
    except OSError:
        return None
    return None


@dataclass
class Runner:
    """Runs one instrumented server lifecycle and reads its instruction total.

    `bare` runs a plain redis-server with no module and no graph setup. That is
    not a toy mode: valgrind on arm64 cannot execute this module at all
    (`unhandled instruction 0xB8BFC108` — an ARMv8.1 LSE atomic in RediSearch's
    slots_tracker, valgrind's limitation rather than a module bug), so the
    differencing arithmetic above can only be validated against bare redis on
    that architecture. It used to require editing two module-level constants;
    making it a flag is what lets the arm64 validation run in CI or locally
    without a patched checkout.
    """

    module: Path | None
    port: int
    outdir: Path
    module_args: Sequence[str] = ()
    bare: bool = False

    @property
    def setup(self) -> tuple[str, ...]:
        return () if self.bare else CG_SETUP

    def total(self, cypher: str, reps: int, also_run: Sequence[str] = ()) -> int:
        """One instrumented lifecycle; returns its whole-process instruction total."""
        shutil.rmtree(self.outdir, ignore_errors=True)
        self.outdir.mkdir(parents=True, exist_ok=True)

        argv = [
            "valgrind",
            "--tool=callgrind",
            f"--callgrind-out-file={self.outdir}/callgrind.out.%p",
            "redis-server",
            "--port",
            str(self.port),
            "--save",
            "",
            # serverCron does work proportional to how long the process lives, and
            # the two runs being differenced live for different durations — so
            # cron lands in the subtraction as drift. Measured at the default
            # hz=10 it is ~240k instr per second of life, which swamped a PING
            # (~20k) and made two (n1,n2) pairs disagree by 44%. hz=1 is the
            # lowest redis accepts and cuts it 10x.
            "--hz",
            "1",
        ]
        if self.module is not None and not self.bare:
            argv += ["--loadmodule", str(self.module), *self.module_args]

        server = subprocess.Popen(argv, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            self._wait_ready(server)
            for stmt in self.setup:
                self._cli(*self._graph_cmd(stmt))
            for extra in also_run:
                self._cli(*self._graph_cmd(extra), check=False)
            if reps:
                # One redis-cli with -r, not `reps` of them: a fresh connection
                # per execution would put accept/handshake/teardown into the
                # measurement, and the extra wall time feeds the cron drift.
                self._cli("-r", str(reps), *self._graph_cmd(cypher))
            self._cli("shutdown", "nosave", check=False)
            server.wait(timeout=600)
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=120)
                except subprocess.TimeoutExpired:
                    server.kill()

        # Redis forks and valgrind profiles the child too; the child's total is
        # tiny, so the server's own run is the maximum.
        totals = [
            t
            for t in (parse_total(p) for p in glob.glob(str(self.outdir / "callgrind.out.*")))
            if t is not None
        ]
        if not totals:
            raise Skipped(f"no parseable callgrind output in {self.outdir}")
        return max(totals)

    def _graph_cmd(self, cypher: str) -> tuple[str, ...]:
        # In bare mode there is no module, so the payload is a plain PING-ish
        # command the differencing can still be validated against.
        return (cypher,) if self.bare else ("GRAPH.QUERY", "bench", cypher)

    def _wait_ready(self, server: subprocess.Popen) -> None:
        for _ in range(1200):  # instrumented startup is far slower than native
            if server.poll() is not None:
                raise Skipped("server exited during startup under callgrind")
            if self.
```

### Core Architecture Module: `bench/src/falkorbench/cli.py`
```
"""The `bench` command.

One entry point with subcommands, rather than four scripts that each re-declared
--module/--port/--out and one shell script that needed a different one of them to
have been run first. The shared options are defined once, in `common_options`.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import click

from falkorbench import callgrind as cg
from falkorbench import client as client_mod
from falkorbench import compare as compare_mod
from falkorbench import coverage as coverage_mod
from falkorbench import flow as flow_mod
from falkorbench import measure as measure_mod
from falkorbench import metrics
from falkorbench import profile as profile_mod
from falkorbench import queries as query_set
from falkorbench import report as report_mod
from falkorbench.counters import select_backend

# bench/ is the project root; the repo is its parent.
BENCH_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BENCH_DIR.parent
RESULTS = BENCH_DIR / "results"


def _select(names: tuple[str, ...], *, cg_only: bool = False):
    """Resolve query names to Query objects, erroring on an unknown name."""
    pool = [q for q in query_set.QUERIES if q.cg] if cg_only else list(query_set.QUERIES)
    if not names:
        return pool
    wanted = set(names)
    chosen = [q for q in pool if q.name in wanted]
    missing = wanted - {q.name for q in chosen}
    if missing:
        raise click.ClickException(f"unknown queries: {sorted(missing)}")
    # Pull in whatever the chosen rows depend on, transitively. A row that
    # measures against a graph an earlier row builds is meaningless without it,
    # and silently so -- it reports a plausible number for the wrong graph.
    by_name = {q.name: q for q in pool}
    while True:
        need = {n for q in chosen for n in q.needs} - {q.name for q in chosen}
        if not need:
            break
        unknown = need - by_name.keys()
        if unknown:
            raise click.ClickException(f"unknown prerequisite queries: {sorted(unknown)}")
        chosen += [by_name[n] for n in need]
    # Back into suite order: a prerequisite has to run before its dependent.
    order = {q.name: i for i, q in enumerate(pool)}
    return sorted(chosen, key=lambda q: order[q.name])


def common_options(fn):
    """--module/--port, shared by every subcommand that starts a server."""
    fn = click.option(
        "--module",
        default=None,
        help="module to load (default: this repo's target/release build)",
    )(fn)
    fn = click.option("--port", default=6399, show_default=True, type=int)(fn)
    return fn


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def cli() -> None:
    """Per-query performance harness for FalkorDB."""


# --- measure -----------------------------------------------------------------


@cli.command()
@common_options
@click.option("--out", default=None, type=click.Path(), help="CSV output path")
@click.option("--n", "reps", default=1000, show_default=True, help="requests per query")
@click.option("--once", is_flag=True, help="run each query once, unmeasured (coverage)")
@click.option("--keep-server", is_flag=True, help="leave the server running afterwards")
@click.option("--reuse", is_flag=True, help="attach to a server already on --port")
@click.option("--setup/--no-setup", default=None, help="build the graph (implied unless --reuse)")
@click.option("--c-compat", is_flag=True, help="measuring the C engine: skip what it cannot do")
@click.argument("names", nargs=-1)
def measure(module, port, out, reps, once, keep_server, reuse, setup, c_compat, names):
    """Measure queries and write a CSV.

    Named queries are merged into an existing CSV, so a subset re-run patches
    only those rows.
    """
    queries = _select(names)
    out_path = Path(out) if out else RESULTS / "current.csv"
    module_path = client_mod.find_module(module, REPO_ROOT)
    # --reuse means "do not start a server". It must NOT silently also mean "do
    # not build the graph", or the harness measures an empty database and reports
    # numbers that look real. CI reuses a server from a published image and so
    # needs setup; default to building unless explicitly told not to.
    do_setup = (not reuse) if setup is None else setup

    server = client_mod.Server(port=port)
    if reuse:
        if not client_mod.is_server_up(port):
            raise click.ClickException(f"--reuse given but nothing answers on :{port}")
    else:
        if client_mod.is_server_up(port):
            raise click.ClickException(f"port {port} already in use; use --reuse or another --port")
        if not module_path.exists():
            raise click.ClickException(f"module not found: {module_path}")
        client_mod.write_csv_fixtures(Path(query_set.IMPORT_DIR), query_set.CSV_FILES)
        server = client_mod.start_server(
            module_path,
            port,
            RESULTS / "server_dir",
            Path(query_set.IMPORT_DIR),
            appendonly=once,
        )

    exit_code = 0
    try:
        bench = client_mod.connect(server)
        if do_setup:
            click.echo(f"server up on :{port}, building graph...")
            client_mod.build_graph(
                bench,
                query_set.SETUP,
                query_set.SETUP_COMMANDS,
                c_compat=c_compat,
            )

        if once:
            fails = measure_mod.run_once(
                bench,
                queries,
                query_set.ERROR_QUERIES,
                include_errors=not names,
                echo=click.echo,
            )
            if server.proc is not None and not keep_server:
                bench.shutdown()  # graceful: flushes .profraw
            raise SystemExit(1 if fails else 0)

        backend = counter_backend()
        rows, failures = measure_mod.measure_queries(
            bench,
            backend,
            queries,
            default_reps=reps,
            c_compat=c_compat,
            echo=click.echo,
        )
        measure_mod.merge_into_csv(out_path, rows)
        click.echo(f"wrote {out_path}")
        if failures:
            # A query in the set that does not answer is a real problem, and the
            # CSV is now missing that row rather than carrying a wrong one.
            click.echo(f"\n{len(failures)} query(ies) failed and were not measured:")
            for name, why in failures:
                click.echo(f"  {name}: {why}")
            exit_code = 1
    except client_mod.SetupFailed as e:
        raise click.ClickException(str(e)) from e
    finally:
        if server.proc is not None and not keep_server:
            server.stop()
        elif server.proc is not None:
            click.echo(f"server left running on :{port} (pid {server.proc.pid})")

    if exit_code:
        raise SystemExit(exit_code)


def counter_backend():
    """The counter backend, with pmc_tool picked up if it has been built.

    Without pmc_tool the branch/L1D columns stay empty, which is fine — the
    regression-gating columns are instructions and allocated bytes.
    """
    pmc = BENCH_DIR / "pmc_tool"
    backend = select_backend(str(pmc) if pmc.exists() else None)
    if pmc.exists() and getattr(backend, "pmc", None) is None:
        click.echo("pmc_tool present but not usable — branches/L1D columns stay empty")
    return backend


# --- callgrind ---------------------------------------------------------------


@cli.command()
@common_options
@click.option("--out", default=None, type=click.Path())
@click.option("--n1", default=20, show_default=True, help="low repeat count")
@click.option("--n2", default=120, show_default=True, help="high repeat count")
@click.option("--shard", default=None, help="measure only shard I/N (1-based, round-robin)")
@click.option("--job-total", default=None, type=int, help="cross-check N against the CI matrix")
@click.option("--module-args", multiple=True, help="extra --loadmodule args, e.g. THREAD_COUNT 1")
@click.option(
    "--bare",
    is_flag=True,
    help="no module, no graph: validates the differencing maths where valgrind "
    "cannot run this module (arm64)",
)
@click.argument("names", nargs=-1)
def callgrind(module, port, out, n1, n2, shard, job_total, module_args, bare, names):
    """Deterministic instruction counts, by differencing two runs."""
    if n2 <= n1:
        raise click.ClickException(f"--n2 ({n2}) must exceed --n1 ({n1})")
    cg.require_tools()

    module_path = cg.resolve_module(module, bare)
    if bare:
        # Refuse rather than ignore. --bare measures one fixed payload, so a
        # shard or a name list cannot be honoured — and silently dropping a flag
        # that changes what gets measured is the failure mode this harness exists
        # to avoid.
        conflicting = [n for n, v in (("--shard", shard), ("NAMES", names)) if v]
        if conflicting:
            raise click.ClickException(
                f"--bare measures a single fixed payload, so {', '.join(conflicting)} "
                f"cannot apply. Drop it, or drop --bare."
            )
        queries = [cg.bare_payload()]
    else:
        queries = _select(names, cg_only=True)
        if shard:
            try:
                queries = cg.shard(queries, shard, job_total)
            except ValueError as e:
                raise click.ClickException(str(e)) from e
            click.echo(f"shard {shard}: {len(queries)} queries")
            if not queries:
                return

    runner = cg.Runner(
        module=module_path,
        port=port,
        outdir=cg.default_outdir(BENCH_DIR),
        module_args=list(module_args),
        bare=bare,
    )

    if not bare:
        # GraphBLAS compiles kernels on first use and caches them on disk, so the
        # first server lifecycle in a job pays for that and no later one does.
        # Measured: the first run came in ~30M instructions above its pair, which
        # made T(n2) < T(
```

### Core Architecture Module: `bench/src/falkorbench/client.py`
```
"""Server lifecycle and the control plane, over falkordb-py.

Replaces two hand-rolled `redis-cli` subprocess wrappers that had drifted apart
— one carried a timeout, the other carried server-log diagnostics, and both
detected success by looking for the substring `"execution time"` in stdout,
because `redis-cli` exits 0 even when the reply is an error. `Graph.query`
raises `ResponseError` instead, so failure is an exception rather than a string
that happens not to match.

Everything here runs *outside* measurement windows. The measured workload stays
`redis-benchmark` (and `redis-cli -r N` under callgrind) for the reasons in
`counters`.
"""

from __future__ import annotations

import contextlib
import os
import re
import shutil
import signal
import subprocess
import time
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

from falkordb import FalkorDB
from falkordb import Graph
from redis.exceptions import RedisError
from redis.exceptions import ResponseError

from falkorbench.model import Metric

GRAPH_NAME = "bench"

# Panic/crash markers worth surfacing from a server log. When the module panics,
# redis prints the panic and backtrace to its log and dies, and every later
# command fails with the useless "Server closed the connection" — which was all
# CI ever reported before the log was kept.
_DEATH_MARKERS = (
    "panicked at",
    "FalkorDB panic",
    "Redis crashed",
    "signal:",
    "=== REDIS BUG REPORT",
)


def _jemalloc_table_columns(header: str) -> dict[str, tuple[int, int]]:
    """Map each column label in a jemalloc `bins:`/`large:` header to the
    `(start, end)` character range of its field.

    **jemalloc's stats tables cannot be split on whitespace.** Every value is
    right-aligned in a fixed-width field, and the `(#/sec)` rate fields are only
    8 characters wide, so a rate of 10,000,000/sec or more fills its field
    exactly and no space is left between it and the `nmalloc` before it:

    ```text
    nmalloc (#/sec)      ndalloc (#/sec)     <- header
        1379247  689623      1355704  677852 <- fine, rates are 6 digits
    21949879 10974939 21947904 10973952      <- fused: 8-digit rates
    ```

    `line.split()` turns that second row into `['21949879109749392194790410973952']`
    -- a 16-digit garbage `nmalloc` -- and shifts every later column left by
    one, so `ndalloc` reads the fused ndalloc+rate too. The parsed cumulative
    total jumps by ~7e16 bytes the moment a hot size class crosses 10M
    allocations/sec, and drops back when it cools. Because `measure` reports
    *deltas* between two snapshots, that surfaced as per-query allocation
    figures in the petabytes and, when the fusion cleared between snapshots,
    as negative ones. It read as a 30,000x memory regression in whichever
    queries happened to straddle the transition.

    Slicing by the header's own column ranges is immune: overflow in a
    right-aligned field spills *left*, so a field read up to its own end column
    is still correct, and only its left neighbour (a rate we do not use) is
    damaged.

    A field therefore runs from the *previous* column's end to its own, not from
    its own label's start -- values are commonly wider than their label
    (`size` labels a 5-digit 49152), and anchoring on the label's start would
    shear the leading digits off.
    """
    cols: dict[str, tuple[int, int]] = {}
    prev_end = 0
    for m in re.finditer(r"\S+", header):
        label = m.group()
        # `(#/sec)` repeats after every counter, and the leading `bins:`/`large:`
        # is a row label rather than a column; both still advance the boundary.
        # First occurrence wins, which is all we need for named counters.
        if label not in ("bins:", "large:") and label not in cols:
            cols[label] = (prev_end, m.end())
        prev_end = m.end()
    return cols


def _jemalloc_row(
    line: str,
    cols: dict[str, tuple[int, int]],
    wanted: Sequence[str],
) -> dict[str, int] | None:
    """Read `wanted` integer fields out of one jemalloc table row, or None if
    this is not a data row (a `total:`/`---` separator, or a short line).

    Fields are located by the header's column ranges rather than by whitespace
    position; see [`_jemalloc_table_columns`].
    """
    out: dict[str, int] = {}
    for name in wanted:
        span = cols.get(name)
        if span is None:
            return None
        text = line[span[0] : span[1]].strip()
        if not text.isdigit():
            return None
        out[name] = int(text)
    return out


class SetupFailed(RuntimeError):
    """Graph setup did not complete, so nothing measured afterwards is valid."""


@dataclass
class Server:
    """A redis-server this harness started, or one it attached to.

    `proc` and `log_path` are None when attached (`--reuse`): the process is
    someone else's and its log is not ours to read.
    """

    port: int
    proc: subprocess.Popen | None = None
    log_path: Path | None = None
    work_dir: Path | None = None

    def death_details(self) -> str:
        """Panic/crash lines from the log, for when a command failed because the
        server is gone. Empty string when there is nothing to add."""
        if self.log_path is None or not self.log_path.exists():
            return ""
        try:
            lines = self.log_path.read_text(errors="replace").splitlines()
        except OSError:
            return ""
        marked = [ln.rstrip() for ln in lines if any(m in ln for m in _DEATH_MARKERS)]
        tail = marked[:6] or [ln.rstrip() for ln in lines[-6:]]
        return "\n  server log: " + "\n              ".join(tail)

    def stop(self) -> None:
        if self.proc is None:
            return
        self.proc.send_signal(signal.SIGTERM)
        self.proc.wait()
        self.proc = None


@dataclass
class BenchClient:
    """The control plane for one server: setup, probes, allocation snapshots."""

    db: FalkorDB
    server: Server
    graph_name: str = GRAPH_NAME
    _graph: Graph | None = field(default=None, repr=False)

    @property
    def graph(self) -> Graph:
        if self._graph is None:
            self._graph = self.db.select_graph(self.graph_name)
        return self._graph

    # --- queries -------------------------------------------------------------

    def run(self, cypher: str, write: bool = True) -> None:
        """Execute one statement, raising ResponseError on an error reply."""
        if write:
            self.graph.query(cypher)
        else:
            self.graph.ro_query(cypher)

    def command(self, *args: object) -> object:
        """A raw redis command, for what the graph API does not cover:
        DEBUG RELOAD, GRAPH.CONSTRAINT, GRAPH.UDF, MEMORY MALLOC-STATS."""
        return self.db.execute_command(*args)

    # --- probes --------------------------------------------------------------

    @property
    def pid(self) -> int:
        """The server's own pid, from a parsed INFO map.

        Was recovered by string surgery on redis-cli output
        (`out.split("process_id:")[1].split()[0]`) in two different files.
        """
        return int(self.db.connection.info("server")["process_id"])

    def jemalloc_totals(self) -> tuple[Metric, Metric]:
        """Cumulative (allocated, deallocated) bytes from jemalloc's merged-arena
        stats, or (None, None) if the server is not jemalloc-built.

        Sums size*nmalloc / size*ndalloc over the `bins:` and `large:`
        size-class tables, reading each field by the character columns of its
        own table header — see [`_jemalloc_table_columns`] for why splitting
        those rows on whitespace does not work.
        """
        try:
            out = str(self.command("MEMORY", "MALLOC-STATS"))
        except RedisError:
            return None, None
        if "Merged arenas stats:" not in out:
            return None, None

        alloc = dealloc = 0
        in_merged = False
        cols: dict[str, tuple[int, int]] | None = None
        for line in out.splitlines():
            if line.startswith("Merged arenas stats:"):
                in_merged = True
            elif line.startswith("arenas["):
                break
            elif in_merged:
                head = line.split(maxsplit=1)
                if not head:
                    continue
                label = head[0]
                if label in ("bins:", "large:") and " size " in line:
                    cols = _jemalloc_table_columns(line)
                elif label == "extents:":
                    # A different table with different columns, and no
                    # nmalloc/ndalloc to contribute.
                    cols = None
                elif cols is not None:
                    row = _jemalloc_row(line, cols, ("size", "nmalloc", "ndalloc"))
                    if row is None:
                        continue
                    alloc += row["size"] * row["nmalloc"]
                    dealloc += row["size"] * row["ndalloc"]
        return alloc, dealloc

    def shutdown(self) -> None:
        """Graceful SHUTDOWN NOSAVE — which also flushes .profraw under
        coverage instrumentation, so it must not be replaced by SIGKILL."""
        # The server closing the connection mid-command is the success case here.
        with contextlib.suppress(RedisError):
            self.db.connection.shutdown(nosave=True)
        if self.server.proc is not None:
            self.server.proc.wait()
            self.server.proc = None


# --- lifecycle ---------------------------------------------------------------


def is_server_up(port: int) -> bool:
    """True when something answers on `port`."""
    try:
        FalkorDB(host="localhost", port=port).connection.ping()
        return True
    except RedisError:
        return False


def start_server(
    module: Path,
    port: int,
    work_dir: Path,
    import_dir: Path,
    *,
    a
```

### Core Architecture Module: `bench/src/falkorbench/compare.py`
```
"""Local regression gate: one measurement CSV against a baseline CSV.

Shares `metrics` with `report`, which is the point. This gate used to have its
own parsing, its own ratio function and its own thresholds, and consequently its
own answer: it compared raw wall-clock at 1.25x, which across two hosts is a
noise detector — the very thing the rest of the harness refuses to do. It now
inherits the control-row normalisation and the non-positive-baseline guard that
only the CI reporter had.

Baselines are not committed (bench/.gitignore ignores baseline/): a checked-in
baseline goes stale the moment anything lands and then reports phantom
regressions for everyone. Produce your own from a base build.

Caveat worth knowing before trusting a verdict: the baseline is a single file,
so after switching branches this compares against numbers measured somewhere
else, silently. And a baseline from another machine is not comparable at all —
per-host speed differences alone measured 1.46x.
"""

from __future__ import annotations

from dataclasses import dataclass

from falkorbench.metrics import GATED_BY_DEFAULT
from falkorbench.metrics import MS_THRESHOLD
from falkorbench.metrics import THRESHOLDS
from falkorbench.metrics import Row
from falkorbench.metrics import has_data
from falkorbench.metrics import normalise_ms
from falkorbench.metrics import ratio


@dataclass
class Regression:
    query: str
    metric: str
    ratio: float
    base: float
    current: float
    threshold: float


@dataclass
class Comparison:
    metrics: list[str]
    skipped: list[str]
    regressions: list[Regression]
    missing: list[str]
    added: list[str]
    ratios: dict[str, dict[str, float | None]]
    ms_offset: float | None


def compare(
    current: dict[str, Row],
    baseline: dict[str, Row],
    *,
    metrics: list[str] | None = None,
    threshold: float | None = None,
) -> Comparison:
    """Compare two measurement sets. Pure — no printing, so it is testable.

    `metrics=None` gates the deterministic columns only. Naming `ms` explicitly
    opts into gating on wall-clock, which is not something to do casually.
    """
    wanted = list(metrics) if metrics else list(GATED_BY_DEFAULT)
    # Displayed regardless of whether it gates, so a reader can see the column.
    shown = list(dict.fromkeys([*wanted, "ms"]))
    limits = {m: (threshold if threshold is not None else THRESHOLDS[m]) for m in shown}
    gated = set(wanted)

    # A metric absent from either side is skipped rather than gated. Gating a
    # metric that no row carries silently gates on nothing.
    present = [m for m in shown if has_data(baseline.values(), m) and has_data(current.values(), m)]
    skipped = [m for m in shown if m not in present]

    # Wall-clock only means something once the per-host offset is cancelled.
    ms_offset = normalise_ms(current, baseline)

    ratios: dict[str, dict[str, float | None]] = {}
    regressions: list[Regression] = []
    for name, base_row in baseline.items():
        cur_row = current.get(name)
        if cur_row is None:
            continue
        per_metric: dict[str, float | None] = {}
        for m in present:
            r = ratio(base_row, cur_row, m)
            if r is not None and m == "ms":
                if ms_offset is None:
                    # No control row: report nothing rather than an uncorrected
                    # cross-host ratio.
                    r = None
                else:
                    r /= ms_offset
            per_metric[m] = r
            if r is None or m not in gated:
                continue
            limit = MS_THRESHOLD + 1.0 if m == "ms" else limits[m]
            if r > limit:
                regressions.append(
                    Regression(
                        query=name,
                        metric=m,
                        ratio=r,
                        base=base_row[m],  # type: ignore[arg-type]
                        current=cur_row[m],  # type: ignore[arg-type]
                        threshold=limit,
                    )
                )
        ratios[name] = per_metric

    return Comparison(
        metrics=present,
        skipped=skipped,
        regressions=regressions,
        missing=[n for n in baseline if n not in current],
        added=[n for n in current if n not in baseline],
        ratios=ratios,
        ms_offset=ms_offset,
    )


def render(cmp: Comparison) -> list[str]:
    """The comparison as printable lines."""
    widths = {m: max(8, len(m) + 2) for m in cmp.metrics}
    header = f"{'query':<24} " + "".join(f"{m:>{widths[m]}}" for m in cmp.metrics)
    out = [header, "-" * len(header)]

    flagged = {(r.query, r.metric) for r in cmp.regressions}
    for name, per_metric in cmp.ratios.items():
        cells = "".join(
            f"{per_metric[m]:>{widths[m]}.2f}"
            if per_metric.get(m) is not None
            else f"{'-':>{widths[m]}}"
            for m in cmp.metrics
        )
        hits = [m for m in cmp.metrics if (name, m) in flagged]
        suffix = "  <-- REGRESSION: " + ",".join(hits) if hits else ""
        out.append(f"{name:<24} {cells}{suffix}")

    for name in cmp.missing:
        out.append(f"{name:<24} MISSING from current")
    for name in cmp.added:
        out.append(f"{name:<24} NEW (not in baseline)")

    out.append("")
    gated = [m for m in cmp.metrics if m != "ms"]
    out.append("gated: " + ", ".join(f"{m} {THRESHOLDS[m]:.0%}" for m in gated))
    if "ms" in cmp.metrics:
        out.append(
            "ms is shown but NOT gated: wall-clock is never the gate here. Most "
            "queries cost 0.02-0.3 ms, so a ratio's denominator is process "
            "scheduling. Pass --metrics ms to gate on it anyway."
        )
    if cmp.ms_offset is not None and "ms" in cmp.metrics:
        out.append(
            f"ms ratios are normalised by the control row ({cmp.ms_offset:.2f}x); "
            f"raw wall-clock across two hosts is not comparable."
        )
    if cmp.skipped:
        out.append("no data in both CSVs (skipped): " + ", ".join(cmp.skipped))

    if cmp.regressions:
        out.append("")
        out.append(f"{len(cmp.regressions)} regression(s):")
        for r in sorted(cmp.regressions, key=lambda x: -x.ratio):
            out.append(
                f"  {r.query} [{r.metric}]: {r.ratio:.2f}x  "
                f"({r.base:,.0f} -> {r.current:,.0f}, threshold {r.threshold:.2f}x)"
            )
    else:
        out.append("")
        out.append("no regressions")
    return out

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

### Incident Patch 1: `d1a73f65` (2026-10-28)
**Commit Message**: feat(index): a column's build state, and indexer batches that fill it (#2351)

* feat(index): a column's build state, and build steps that fill it

A native index column is now `Building { next }` or `Ready`. A build step
reads the next batch of the label's nodes, or the type's edges, from the
cursor `next` at their current values, adds them to the column, and moves
the cursor past them. The step that reaches the end flips the column
`Ready`. An edge step finishes the multi-edge pair it stops in, so a pair
is never split between steps. While a column is `Building`,
`query_numeric` returns `None` and the read falls through to RediSearch.
Live writes maintain a `Building` column as they do a `Ready` one.

`CREATE INDEX` creates the column `Building` and takes one step with no
limit on its batch, so the column is `Ready` when it returns, as before. A
step into an empty column bulk-builds its tree, as the one-pass build did.
The RDB-load populate is unchanged.

Tuples now move as `EncodedTuples`, split by `KeySpace`, through one seam,
`IndexColumn::push_encoded`. Only the scalar half is filled.

The step tests compare against the RDB-load populate, which shares no code
with the steps: 

**File**: `graph/src/graph/graph.rs` (modified, +44/-6)
```diff
@@ -83,7 +83,7 @@ use thiserror::Error;
 
 #[cfg(feature = "index-falkordb")]
 use crate::index::falkordb::{
-    falkordb_index::FalkorDbIndex,
+    falkordb_index::{BuildCursor, FalkorDbIndex, IndexKey},
     graph_writes::{self, index_only_writes},
 };
 use crate::index::index_docs::IndexDocs;
@@ -445,8 +445,8 @@ pub struct Graph {
     /// forks them copy-on-write and the committed-version swap publishes graph +
     /// index atomically.
     ///
-    /// `pub(crate)` for `index::falkordb`: `graph_writes` reads it to stage changes, and
-    /// `FalkorDbIndex::apply` updates it.
+    /// `pub(crate)` for `index::falkordb`: `graph_writes` reads it to stage changes and to read
+    /// build batches, and `FalkorDbIndex::apply` updates it.
     #[cfg(feature = "index-falkordb")]
     pub(crate) falkordb_index: FalkorDbIndex,
 }
@@ -3782,6 +3782,20 @@ impl Graph {
         )
     }
 
+    /// One indexer batch on this version: read the next entities of column `key` of `entity` at
+    /// the values this version holds, at most `entities` nodes or edges, add it to the column and
+    /// move the column's cursor. `false`, changing nothing, if the column is not `Building`.
+    #[cfg(feature = "index-falkordb")]
+    pub(crate) fn index_batch(
+        &mut self,
+        entity: EntityType,
+        key: &IndexKey,
+        entities: usize,
+    ) -> bool {
+        graph_writes::read_indexer_batch_of(self, entity, key, entities)
+            .is_some_and(|batch| self.falkordb_index.apply_indexer_batch(batch))
+    }
+
     /// Apply a unit of work's staged native-index changes (`docs.native`) to this version's index.
     /// A no-op without the `index-falkordb` feature, which has no native index. `self` must be the
     /// private version the changes were staged against.
@@ -3790,7 +3804,21 @@ impl Graph {
         docs: &mut IndexDocs,
     ) {
         #[cfg(feature = "index-falkordb")]
-        self.falkordb_index.apply(&mut docs.native);
+        {
+            // A `Building` column asks where a written entity sits in build order: a node by its
+            // id, an edge by its endpoints, which an edge this unit deleted no longer has.
+            let endpoints = &self.edge_endpoints;
+            self.falkordb_index
+                .apply(&mut docs.native, |entity, id| match entity {
+                    EntityType::Node => Some(BuildCursor::Node(NodeId::from(id))),
+                    EntityType::Relationship => {
+                        endpoints.get(id).map(|(src, dst)| BuildCursor::Edge {
+                            src: NodeId::from(src),
+                            dst: NodeId::from(dst),
+                        })
+                    }
+                });
+        }
         #[cfg(not(feature = "index-falkordb"))]
         let _ = docs;
     }
@@ -4085,7 +4113,7 @@ impl Graph {
     }
 
     /// Node ids for `query` from the index numeric column, or `None` to fall through to RediSearch
-    /// (non-numeric / composite / missing column). Wraps
+    /// (non-numeric / composite / missing or `Building` column). Wraps
     /// [`FalkorDbIndex::query_numeric`], mapping raw ids to `NodeId`. `use<>` keeps the returned
     /// iterator free of the `&self` borrow — it owns its tree snapshot, so it outlives this
     /// borrow.
@@ -4105,7 +4133,7 @@ impl Graph {
     /// index (`endpoints_for_edge`), like RediSearch's edge read (which instead reads them from its
     /// 24-byte key). Endpoints are resolved eagerly into an owned iterator because the edge scan op
     /// only holds a temporary graph borrow, so the result must not borrow `self`. `None` (fall back to
-    /// RediSearch) for non-numeric/composite predicates or a missing column.
+    /// RediSearch) for non-numeric/composite predicates or a missing or `Building` column.
     #[cfg(feature = "index-falkordb")]
     pub fn query_index_numeric_edges(
         &self,
@@ -5043,6 +5071,16 @@ impl Graph {
     pub fn build_global_attrs(&self) -> Vec<Arc<String>> {
         self.attrs_name.iter().cloned().collect()
     }
+
+    /// [`Self::index_batch`] of the first `Building` column. For tests of one column.
+    #[cfg(all(test, feature = "index-falkordb"))]
+    pub(crate) fn index_next_batch(
+        &mut self,
+        entities: usize,
+    ) -> bool {
+        graph_writes::read_indexer_batch(self, entities)
+            .is_some_and(|batch| self.falkordb_index.apply_indexer_batch(batch))
+    }
 }
 
 #[cfg(test)]
```

**File**: `graph/src/graph/graph/falkordb_index_tests.rs` (modified, +798/-8)
```diff
@@ -1,14 +1,20 @@
 //! The native index as the graph maintains it: each test drives a real `Graph` write path
-//! and checks the index column it should have changed.
+//! and checks the index column it should have changed. The build's tests drive indexer batches
+//! between writes.
 
-use super::Graph;
+use super::{Graph, NodeId, RelationshipId};
 use crate::entity_type::EntityType;
-use crate::index::IndexType;
+use crate::index::Field;
+use crate::index::falkordb::encode::encode_numeric;
+use crate::index::falkordb::falkordb_index::{BuildCursor, ColumnState};
 use crate::index::falkordb::graph_writes;
 use crate::index::index_docs::IndexDocs;
+use crate::index::{IndexQuery, IndexType};
 use crate::runtime::value::Value;
 use roaring::RoaringTreemap;
 use rustc_hash::FxHashMap;
+use std::collections::HashMap;
+use std::ffi::CString;
 use std::sync::Arc;
 
 /// Run one graph write with its own [`IndexDocs`] and apply its native-index changes straight
@@ -35,6 +41,32 @@ fn reserve_nodes(
         .expect("reserved")
 }
 
+/// Run indexer batches of at most `entities` nodes or edges on `g` itself until no column is
+/// `Building`. Returns how many batches it took.
+fn build_to_end(
+    g: &mut Graph,
+    entities: usize,
+) -> usize {
+    let mut batches = 0;
+    while g.falkordb_index.has_building_columns() {
+        graph_writes::run_indexer_batch(g, entities);
+        batches += 1;
+        assert!(batches < 100_000, "the build never finishes");
+    }
+    batches
+}
+
+/// `attr = v`, as the read path asks it.
+fn eq(
+    attr: &Arc<String>,
+    v: i64,
+) -> IndexQuery<Value> {
+    IndexQuery::Equal {
+        key: attr.clone(),
+        value: Value::Int(v),
+    }
+}
+
 /// `Graph::new` builds GraphBLAS matrices, which need GraphBLAS initialized
 /// first (done at Redis module-load in production, never from a bare unit
 /// test).
@@ -87,12 +119,13 @@ fn new_version_isolates_the_falkordb_index() {
     assert_eq!(writer.version, committed.version + 1);
 }
 
-/// CREATE INDEX bulk-builds the column from real graph state: three
+/// CREATE INDEX builds the column from real graph state: three
 /// `:Person {age}` nodes, then a range scan returns the right ids in
-/// `(value, id)` order. Drives the native half of `Graph::create_index`
-/// (`graph_writes::create_index` and its `get_label_matrix` →
-/// `get_node_attribute_by_idx` reads) directly, bypassing the RediSearch FFI
-/// (uninitialised in a unit test).
+/// `(value, id)` order. The column is built by one indexer batch over every node
+/// (its `get_label_matrix` → `get_node_attribute_by_idx` reads), so it is
+/// `Ready` and serves reads when CREATE INDEX returns. Drives the native half of
+/// `Graph::create_index` directly, bypassing the RediSearch FFI (uninitialised
+/// in a unit test).
 #[test]
 fn create_index_builds_the_column_from_live_nodes() {
     ensure_graphblas();
@@ -135,6 +168,17 @@ fn create_index_builds_the_column_from_live_nodes() {
         &label,
         std::slice::from_ref(&attr),
     );
+    assert_eq!(
+        g.falkordb_index
+            .column_state(EntityType::Node, &label, &attr),
+        Some(ColumnState::Ready)
+    );
+    assert!(
+        g.falkordb_index
+            .query_numeric(EntityType::Node, &label, &eq(&attr, 20))
+            .is_some(),
+        "a Ready column serves reads"
+    );
 
     let scan = |lo: Option<i64>, hi: Option<i64>| -> Vec<u64> {
         let lo = lo.map(Value::Int);
@@ -151,6 +195,45 @@ fn create_index_builds_the_column_from_live_nodes() {
     assert_eq!(scan(None, None), vec![ids[0], ids[1], ids[2]]);
 }
 
+/// RDB load creates each native column empty and `Ready`, and its populate rebuilds the column
+/// once every entity is in. Afterwards each column is `Ready` and holds what the graph's values
+/// say, for nodes and for edges.
+#[test]
+fn rdb_load_populate_builds_each_column() {
+    let (mut g, label, v, ty, w) = scan_fixture();
+    let range = |attr: &Arc<String>| -> HashMap<Arc<String>, Vec<Arc<Field>>> {
+        let field = Field::new(CString::new(attr.as_str()).unwrap(), IndexType::Range, None);
+        HashMap::from([(attr.clone(), vec![Arc::new(field)])])
+    };
+    for (entity, l, a) in [
+        (EntityType::Node, &label, &v),
+        (EntityType::Relationship, &ty, &w),
+    ] {
+        g.falkordb_index
+            .create_unpopulated(&IndexType::Range, entity, l, std::slice::from_ref(a));
+        graph_writes::populate(&mut g, entity, l, &range(a));
+        assert_eq!(
+            g.falkordb_index.column_state(entity, l, a),
+            Some(ColumnState::Ready),
+            "{entity:?}"
+        );
+    }
+    let node_values: Vec<i64> = (0..10).map(|i| i * 10).collect();
+    let nodes = one_pass(&g, EntityType::Node, &label, &v, &node_values);
+    assert_eq!(nodes.1.len(), 9, "ten nodes, one deleted");
+    assert_eq!(
+        contents(&g, EntityType::Node, &label, &v, &node_values),
+        nodes
+    );
+    let edge_valu
```

**File**: `graph/src/index/falkordb/falkordb_index.rs` (modified, +389/-42)
```diff
@@ -13,11 +13,12 @@ use std::collections::HashMap;
 use std::sync::Arc;
 
 use crate::entity_type::EntityType;
+use crate::graph::graph::NodeId;
 use crate::index::{IndexQuery, IndexType};
 use crate::runtime::value::Value;
 
 use super::encode::encode_numeric;
-use super::numeric::{DocIter, NumericIndex};
+use super::numeric::{DocIter, EncodedTuples, NumericIndex};
 use super::pending_writes::{IndexWrite, PendingIndexWrites, last_write_wins};
 
 /// Identifies one index column: `(label, attribute)`.
@@ -97,23 +98,37 @@ impl IndexColumn {
         }
     }
 
-    /// Add already-encoded tuples (a unit of work's collapsed adds).
+    /// Append the tuple `(value, id)` takes in *this* column to `out`, if the kind indexes
+    /// `value`. The one place a value becomes a column's tuples, so a kind that gives
+    /// a value several keys changes only this.
+    pub fn push_encoded(
+        &self,
+        value: &Value,
+        id: u64,
+        out: &mut EncodedTuples,
+    ) {
+        if let Some(key) = self.encode_value(value) {
+            out.scalar.push((key, id));
+        }
+    }
+
+    /// Add already-encoded tuples (a unit of work's collapsed adds, or an indexer batch).
     pub fn add_encoded(
         &mut self,
-        pairs: &mut [(u64, u64)],
+        tuples: &mut EncodedTuples,
     ) {
         match self {
-            Self::Numeric(idx) => idx.add_encoded(pairs),
+            Self::Numeric(idx) => idx.add_encoded(tuples),
         }
     }
 
     /// Remove already-encoded tuples (a unit of work's collapsed removes).
     pub fn remove_encoded(
         &mut self,
-        pairs: &mut [(u64, u64)],
+        tuples: &mut EncodedTuples,
     ) {
         match self {
-            Self::Numeric(idx) => idx.remove_encoded(pairs),
+            Self::Numeric(idx) => idx.remove_encoded(tuples),
         }
     }
 
@@ -126,20 +141,103 @@ impl IndexColumn {
     }
 }
 
-/// One column's index.
+/// Build state of a column.
+///
+/// A column is filled by indexer batches. Each reads the label's next entities from the cursor at
+/// the values they hold *then*
+/// ([`graph_writes::read_indexer_batch_of`](super::graph_writes::read_indexer_batch_of)), adds
+/// them, and moves the cursor past them
+/// ([`apply_indexer_batch`](FalkorDbIndex::apply_indexer_batch)). The batch that reaches the end
+/// flips the column [`Ready`](Self::Ready). While [`Building`](Self::Building), the read path
+/// returns `None` and falls through to RediSearch. `CREATE INDEX` takes one batch over every
+/// entity, so its column is `Ready` when it returns.
+///
+/// A `Building` column holds exactly the current tuples of the entities below its cursor, and
+/// nothing at or above it. Live writes keep that true ([`FalkorDbIndex::apply`]). An addition for
+/// an entity below the cursor is applied, and one for an entity at or above it is not, since the
+/// batch that reaches the entity reads its value then. Every removal is applied, because an id's
+/// place can move past the cursor within one unit of work: an edge behind it is deleted and its
+/// id reused by an edge ahead of it, so the place no longer tells whether the column holds the
+/// deleted edge's tuples. Removing a tuple the column does not hold changes nothing. Additions are
+/// dropped before a unit's changes collapse to the last per tuple, so a tuple the unit removed and
+/// added back, as the reused id's new edge can, is still removed. This is how C populates an index
+/// (`src/index/index_construct.c`), in batches interleaved with writes.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub(crate) enum ColumnState {
+    /// Some of the label's entities are not indexed yet — reads fall through to RediSearch. `next`
+    /// is where the next indexer batch resumes.
+    Building { next: BuildCursor },
+    /// Every entity is indexed — the column serves reads.
+    Ready,
+}
+
+/// Where a building column's next indexer batch resumes: the first entity no batch has indexed
+/// yet. Also an entity's place in that order, to compare with it ([`Self::precedes`]).
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub(crate) enum BuildCursor {
+    /// A node column's next node.
+    Node(NodeId),
+    /// An edge column's next `(src, dst)` pair, so a source with more edges than one batch reads
+    /// can be resumed partway, as C does. A batch always finishes the multi-edge pair it stops in,
+    /// so every edge of an earlier pair is indexed.
+    Edge { src: NodeId, dst: NodeId },
+}
+
+impl BuildCursor {
+    /// Whether this entity's place comes before `next`, a column's cursor: whether a batch has
+    /// indexed it. A node by its id; an edge by its `(src, dst)` pair, the order batches read
+    /// edges in.
+    pub(crate) fn precedes(
+        self,
+        next: Self,
+    ) -> bool {
+        match (self, next) {
+            (Self::Node(at), Self::Node(next)) => u64::from(at) < u64::from(next),
+            (
+                Self::Edge { src, 
```

**File**: `graph/src/index/falkordb/graph_writes.rs` (modified, +189/-54)
```diff
@@ -34,6 +34,8 @@ use crate::graph::graph::{Graph, LabelId, NodeId, RelationshipId, TypeId};
 use crate::index::{Field, IndexType};
 use crate::runtime::value::Value;
 
+use super::falkordb_index::{BuildCursor, ColumnState, IndexColumn, IndexKey, IndexerBatch};
+use super::numeric::EncodedTuples;
 use super::pending_writes::IndexChanges;
 
 /// Measurement gate: `true` when `FALKORDB_INDEX_ONLY=1`. The native index then maintains node
@@ -398,6 +400,10 @@ pub fn edges_deleted(
 /// soon as CREATE INDEX returns. Only a Range index has native columns; any other type does
 /// nothing.
 ///
+/// Each column is created `Building` and filled by one indexer batch with no limit on its size
+/// ([`read_indexer_batch_of`]), which reaches the end and flips it `Ready`. A batch into an empty
+/// column bulk-builds its tree, so this costs what building the column in one pass does.
+///
 /// Built here on the write thread, with the graph borrowed. It is never built through the
 /// RediSearch populate, which reaches the graph through the `Indexer`'s back-pointer. This index
 /// is part of the graph version, and keeping that reference out is the point.
@@ -410,14 +416,69 @@ pub fn create_index(
 ) {
     if *index_type == IndexType::Range {
         for attr in attrs {
-            build_column(g, entity, label, attr);
+            build_in_one_batch(g, entity, label, attr);
         }
     }
 }
 
+/// Create column `(entity, label, attr)` `Building`, replacing any column there, and fill it with
+/// one indexer batch with no limit on its size, which reaches the end and flips it `Ready`.
+fn build_in_one_batch(
+    g: &mut Graph,
+    entity: EntityType,
+    label: &Arc<String>,
+    attr: &Arc<String>,
+) {
+    g.falkordb_index.create_building(entity, label, attr);
+    g.index_batch(entity, &(label.clone(), attr.clone()), usize::MAX);
+}
+
+// ---- Indexer batches ----
+//
+// A `Building` column is filled by indexer batches. Each reads the label's next entities from the
+// cursor, at their values in a version, and adds them to the column in that same version. See
+// `ColumnState`.
+
+/// Read an indexer batch of column `key` of `entity` from `g`: its next `entities` nodes or edges,
+/// at their values in `g`, encoded and sorted. `None` if the column is not `Building`. The batch
+/// is added to `g` itself (`Graph::index_batch`).
+pub(crate) fn read_indexer_batch_of(
+    g: &Graph,
+    entity: EntityType,
+    key: &IndexKey,
+    entities: usize,
+) -> Option<IndexerBatch> {
+    let ColumnState::Building { next } = g.falkordb_index.column_state(entity, &key.0, &key.1)?
+    else {
+        return None;
+    };
+    Some(read_batch(g, entity, key.clone(), next, entities))
+}
+
+/// The batch of column `key` of `entity` from cursor `from` on.
+fn read_batch(
+    g: &Graph,
+    entity: EntityType,
+    key: IndexKey,
+    from: BuildCursor,
+    entities: usize,
+) -> IndexerBatch {
+    let column = g
+        .falkordb_index
+        .column(entity, &key.0, &key.1)
+        .expect("a Building column exists");
+    let (tuples, next) = scan(g, &key.0, &key.1, from, entities, column);
+    IndexerBatch {
+        entity,
+        key,
+        tuples,
+        next,
+    }
+}
+
 /// Index population after an RDB load: build every column that a population snapshot of
-/// `label` covers. `fields` maps each attribute to its index fields, and an attribute has a
-/// native column when one of its fields is a Range field.
+/// `label` covers, as CREATE INDEX does ([`create_index`]). `fields` maps each attribute to its
+/// index fields, and an attribute has a native column when one of its fields is a Range field.
 pub fn populate(
     g: &mut Graph,
     entity: EntityType,
@@ -426,7 +487,7 @@ pub fn populate(
 ) {
     for (attr, attr_fields) in fields {
         if attr_fields.iter().any(|f| f.ty == IndexType::Range) {
-            build_column(g, entity, label, attr);
+            build_in_one_batch(g, entity, label, attr);
         }
     }
 }
@@ -460,25 +521,6 @@ fn remove_node_under_label(
     }
 }
 
-/// Build the column for `(entity, label, attr)` from the live graph, replacing any existing one.
-///
-/// One attribute at a time: the `(value, id)` pairs live only until their column is built.
-/// Collecting every attribute first would hold one `Value` per entity per attribute at once,
-/// multiplying the peak for no benefit.
-fn build_column(
-    g: &mut Graph,
-    entity: EntityType,
-    label: &Arc<String>,
-    attr: &Arc<String>,
-) {
-    let pairs = match entity {
-        EntityType::Node => collect_node_entries(g, label, attr),
-        EntityType::Relationship => collect_edge_entries(g, label, attr),
-    };
-    g.falkordb_index
-        .build_numeric(entity, label, attr, pairs.iter().map(|(v, id)| (v, *id)));
-}
-
 /// The node's label ids, reusing `out`'s allocation across nodes.
 ///
 /// Exists so a call resolves labels **once per node**. [`Graph::get_node_label_ids`] walks the
@@ -5
```

**File**: `graph/src/index/falkordb/numeric.rs` (modified, +72/-27)
```diff
@@ -88,6 +88,45 @@ impl Iterator for UnionIter {
     }
 }
 
+/// Encoded `(key, doc)` tuples for one column: what everything that moves a column's tuples in
+/// encoded form carries (a unit of work's collapsed adds and removes, an indexer batch).
+#[derive(Default, Debug, Clone, PartialEq, Eq)]
+pub struct EncodedTuples {
+    pub scalar: Vec<(u64, u64)>,
+}
+
+impl EncodedTuples {
+    /// Tuples of scalar values.
+    #[must_use]
+    pub fn scalars(scalar: Vec<(u64, u64)>) -> Self {
+        Self { scalar }
+    }
+
+    /// Whether there are no tuples.
+    #[must_use]
+    pub fn is_empty(&self) -> bool {
+        self.scalar.is_empty()
+    }
+
+    /// How many tuples there are.
+    #[must_use]
+    pub fn len(&self) -> usize {
+        self.scalar.len()
+    }
+
+    /// Empty the tuples, keeping their capacity for reuse.
+    pub fn clear(&mut self) {
+        self.scalar.clear();
+    }
+
+    /// Sort the tuples ascending and drop duplicates: the **sorted and unique** shape a tree's
+    /// bulk build requires.
+    pub fn sort_dedup(&mut self) {
+        self.scalar.sort_unstable();
+        self.scalar.dedup();
+    }
+}
+
 /// A numeric property index over one `(label, attribute)`: entity ids keyed by
 /// the order-preserving encoding of their value, so `n.x <predicate> v` is a
 /// tree range scan. Non-numeric and `NaN` values are not indexed (parity with
@@ -108,23 +147,6 @@ impl NumericIndex {
         Self::default()
     }
 
-    /// Bulk-build from `(value, id)` pairs in any order. Non-numeric / `NaN`
-    /// values are dropped. Far cheaper than repeated [`add`](Self::add) for
-    /// initial population — one sort + bottom-up page build, no per-item
-    /// traversal.
-    #[must_use]
-    pub fn from_entries<'a>(entries: impl IntoIterator<Item = (&'a Value, u64)>) -> Self {
-        let mut pairs: Vec<(u64, u64)> = entries
-            .into_iter()
-            .filter_map(|(v, id)| encode_numeric(v).map(|k| (k, id)))
-            .collect();
-        pairs.sort_unstable();
-        pairs.dedup();
-        Self {
-            tree: Tree::from_sorted(&pairs),
-        }
-    }
-
     /// Index `id` under `value`. A no-op for non-numeric / `NaN` values and
     /// idempotent for an already-present `(value, id)`.
     pub fn add(
@@ -197,24 +219,29 @@ impl NumericIndex {
         out.extend(entries.filter_map(|(v, id)| encode_numeric(&v).map(|k| (k, id))));
     }
 
-    /// Add already-encoded tuples — the adds a unit of work's staged writes collapsed to. Tuples
-    /// are never re-encoded: re-encoding a decoded key would be a second trip through a
-    /// many-to-one map.
+    /// Add already-encoded tuples: the adds a unit of work's staged writes collapsed to, or an
+    /// indexer batch. Tuples are never re-encoded: re-encoding a decoded key would be a second trip
+    /// through a many-to-one map. Into an empty index the tuples are bulk-built, bottom-up from
+    /// the sorted tuples, rather than merged in.
     pub fn add_encoded(
         &mut self,
-        pairs: &mut [(u64, u64)],
+        tuples: &mut EncodedTuples,
     ) {
-        pairs.sort_unstable();
-        self.tree.insert_batch(pairs);
+        tuples.sort_dedup();
+        if self.tree.is_empty() {
+            self.tree = Tree::from_sorted(&tuples.scalar);
+        } else {
+            self.tree.insert_batch(&tuples.scalar);
+        }
     }
 
-    /// Remove already-encoded tuples — the removes a unit of work's staged writes collapsed to.
+    /// Remove already-encoded tuples: the removes a unit of work's staged writes collapsed to.
     pub fn remove_encoded(
         &mut self,
-        pairs: &mut [(u64, u64)],
+        tuples: &mut EncodedTuples,
     ) {
-        pairs.sort_unstable();
-        self.tree.remove_batch(pairs);
+        tuples.sort_dedup();
+        self.tree.remove_batch(&tuples.scalar);
     }
 
     /// Whether the index holds no tuples.
@@ -397,6 +424,24 @@ impl NumericIndex {
     fn empty(&self) -> DocIter {
         DocIter::One(self.tree.range(1, 0))
     }
+
+    /// Bulk-build from `(value, id)` pairs in any order. Non-numeric / `NaN`
+    /// values are dropped. Far cheaper than repeated [`add`](Self::add) for
+    /// initial population — one sort + bottom-up page build, no per-item
+    /// traversal. The tree's tests compare it with incremental adds.
+    #[cfg(test)]
+    #[must_use]
+    pub fn from_entries<'a>(entries: impl IntoIterator<Item = (&'a Value, u64)>) -> Self {
+        let mut pairs: Vec<(u64, u64)> = entries
+            .into_iter()
+            .filter_map(|(v, id)| encode_numeric(v).map(|k| (k, id)))
+            .collect();
+        pairs.sort_unstable();
+        pairs.dedup();
+        Self {
+            tree: Tree::from_sorted(&pairs),
+        }
+    }
 }
 
 #[cfg(test)]
```

**File**: `graph/src/index/falkordb/pending_writes.rs` (modified, +28/-0)
```diff
@@ -209,6 +209,34 @@ mod tests {
         assert_eq!(adds, vec![(1, 7)]);
     }
 
+    /// Long runs of changes to the same tuples, interleaved with each other and with tuples changed
+    /// once: each tuple must end at its last change, which only a sort that keeps the order of
+    /// equal elements guarantees. Short logs are sorted by insertion either way, so this one is
+    /// long.
+    #[test]
+    fn the_last_change_wins_in_a_long_log() {
+        let (mut removes, mut adds) = (Vec::new(), Vec::new());
+        let mut log = Vec::new();
+        for round in 0..40 {
+            for tuple in 0..10 {
+                log.push(w(tuple, 7, (round + tuple) % 2 == 0));
+            }
+            log.push(w(100 + round, 8, true));
+        }
+        last_write_wins(&mut log, &mut removes, &mut adds);
+        // Round 39 is the last: tuple t ends added when 39 + t is even.
+        let ends = |added: bool| -> Vec<(u64, u64)> {
+            (0..10)
+                .filter(|t| ((39 + t) % 2 == 0) == added)
+                .map(|t| (t, 7))
+                .collect()
+        };
+        assert_eq!(removes, ends(false));
+        let mut want = ends(true);
+        want.extend((0..40).map(|round| (100 + round, 8)));
+        assert_eq!(adds, want);
+    }
+
     #[test]
     fn untouched_tuples_pass_through_sorted() {
         let (mut removes, mut adds) = (vec![(9, 9)], vec![(9, 9)]);
```

---

### Incident Patch 2: `a299692a` (2026-10-28)
**Commit Message**: fix(index): hand the indexer lock over fairly between population batches (#3548) (#3550)

parking_lot 0.13 (#3487) removed automatic eventual fairness: an unlock
no longer hands the lock to a thread parked on it. Index population holds
the indexer mutex for each 10,000-entity batch and the next batch takes
it again at once, so a CREATE INDEX or DROP INDEX parked on it waited
out the whole population instead of one batch, while holding the graph's
write lock and Redis's GIL. Populations the DDL had made stale ran to the
end, and test_index_create's test12_multi_index_creation failed at :701.

End each batch with MutexGuard::unlock_fair, which hands the mutex to a
parked waiter if there is one. parking_lot stays at 0.13.

Closes #3548

**File**: `graph/src/graph/graph.rs` (modified, +5/-1)
```diff
@@ -741,7 +741,11 @@ fn populate_index_batch(
                 } else {
                     do_recurse = true;
                 }
-                // guard dropped here
+                // Hand the lock to a waiter, if any. The next batch re-takes it at once,
+                // and parking_lot (0.13+) lets a plain unlock's next locker barge ahead of
+                // a parked CREATE/DROP INDEX or index commit, which then waits out the
+                // whole population (#3548).
+                MutexGuard::unlock_fair(guard);
             }
 
             if do_recurse {
```

---

### Incident Patch 3: `1c0e6c8d` (2026-10-29)
**Commit Message**: fix: UDF node objects see a node deleted in the same query as the runtime does (#3454) (#3464)

* fix: UDF node objects see a node deleted in the same query as the runtime does (#3454)

create_js_node took only the committed graph, so a node deleted earlier
in the query reached a UDF with no labels and no attributes, while
labels(n) / n.name in the same row read the delete-time snapshot. The
same held for an edge's source/target and a path's nodes.

create_js_node now takes the runtime, like create_js_edge, and reads
labels and attributes through Runtime::get_node_labels/get_node_attrs
when it has one. value_to_js, create_js_edge and create_js_path pass
theirs through; the traversal helpers that run on the committed graph
pass None as before.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* perf: UDF node objects read the committed graph unless the runtime differs (#3454)

Reading every node through Runtime::get_node_labels/get_node_attrs
built an OrderSet and an OrderMap per node, about 12% on a 100k-node
UDF scan. create_js_node now takes the runtime path only when it can
change the answer: the node is in the deleted snapshot or has staged
label/attribute changes. Runtime::

**File**: `graph/src/runtime/pending.rs` (modified, +22/-0)
```diff
@@ -752,6 +752,28 @@ impl Pending {
         None
     }
 
+    /// Whether this query has staged a label or attribute change for node
+    /// `id`, i.e. whether [`Self::update_node_labels`] or
+    /// [`Self::update_node_attrs`] would change what the committed graph says.
+    /// O(1): an empty map is skipped before hashing.
+    #[must_use]
+    pub fn node_has_changes(
+        &self,
+        id: NodeId,
+    ) -> bool {
+        fn has<V>(
+            m: &FxHashMap<u64, V>,
+            id: u64,
+        ) -> bool {
+            !m.is_empty() && m.contains_key(&id)
+        }
+        let raw_id: u64 = id.into();
+        has(&self.set_labels, raw_id)
+            || has(&self.remove_labels, raw_id)
+            || has(&self.new_nodes_attrs, raw_id)
+            || has(&self.existing_nodes_attrs, raw_id)
+    }
+
     /// Overlay this query's staged label changes onto `labels`.
     ///
     /// Adds are applied before removals, but the two sets are disjoint per node
```

**File**: `graph/src/runtime/runtime.rs` (modified, +15/-0)
```diff
@@ -1769,6 +1769,21 @@ impl<'a> Runtime<'a> {
         values
     }
 
+    /// Whether node `id` reads differently through this runtime than from the
+    /// committed graph: it was deleted earlier in the query (answered from the
+    /// snapshot) or has staged label/attribute changes. When it does not, a
+    /// caller can read the committed graph directly and skip building the
+    /// [`Self::get_node_labels`] / [`Self::get_node_attrs`] copies.
+    #[must_use]
+    pub fn node_differs_from_committed(
+        &self,
+        id: NodeId,
+    ) -> bool {
+        let deleted = self.deleted_nodes.borrow();
+        (!deleted.is_empty() && deleted.contains_key(&id))
+            || self.pending.borrow().node_has_changes(id)
+    }
+
     pub fn get_node_labels(
         &self,
         id: NodeId,
```

**File**: `graph/src/udf/js_classes.rs` (modified, +71/-38)
```diff
@@ -126,14 +126,19 @@ fn collect_edges(
 }
 
 /// Create a JS Node object with id, labels, attributes properties and getNeighbors() method.
+///
+/// Labels and attributes are read through the runtime when one is given, so a
+/// node created, updated or deleted earlier in the same query looks the same
+/// to the UDF as it does to `labels(n)` / `n.prop`; otherwise from the
+/// committed graph.
 pub fn create_js_node<'js>(
     ctx: &Ctx<'js>,
     node_id: u64,
     graph: &Arc<AtomicRefCell<Graph>>,
+    runtime: Option<&Runtime<'_>>,
 ) -> Result<JsValue<'js>, String> {
     let obj = Object::new(ctx.clone()).map_err(|e| format!("JS object error: {e}"))?;
 
-    let g = graph.borrow();
     let nid = NodeId::from(node_id);
 
     // Hidden type markers
@@ -146,37 +151,22 @@ pub fn create_js_node<'js>(
     obj.set("id", node_id)
         .map_err(|e| format!("JS set error: {e}"))?;
 
-    // .labels - array of label strings
-    let labels_arr = Array::new(ctx.clone()).map_err(|e| format!("JS array error: {e}"))?;
-    for (i, label_name) in g.get_node_labels(nid).enumerate() {
-        labels_arr
-            .set(i, label_name.as_str())
-            .map_err(|e| format!("JS set error: {e}"))?;
-    }
-    obj.set("labels", labels_arr)
-        .map_err(|e| format!("JS set error: {e}"))?;
-
-    // .attributes - object with all node properties
-    let attrs_obj = Object::new(ctx.clone()).map_err(|e| format!("JS object error: {e}"))?;
-    for (attr_name, value) in g.get_node_all_attrs(nid) {
-        let js_val = type_convert::value_to_js(ctx, &value, graph, None)?;
-        // Also expose the property directly on the node (node.name), unless it
-        // would shadow a reserved field.
-        let name = attr_name.as_str();
-        if !matches!(name, "id" | "labels" | "attributes" | "getNeighbors")
-            && !name.starts_with("__falkor")
-        {
-            obj.set(name, js_val.clone())
-                .map_err(|e| format!("JS set error: {e}"))?;
-        }
-        attrs_obj
-            .set(name, js_val)
-            .map_err(|e| format!("JS set error: {e}"))?;
+    // .labels and .attributes: through the runtime only when it can change
+    // the answer, otherwise straight from the committed graph.
+    if let Some(rt) = runtime.filter(|rt| rt.node_differs_from_committed(nid)) {
+        set_node_labels(ctx, &obj, rt.get_node_labels(nid).into_iter())?;
+        set_node_attrs(
+            ctx,
+            &obj,
+            rt.get_node_attrs(nid).into_iter(),
+            graph,
+            runtime,
+        )?;
+    } else {
+        let g = graph.borrow();
+        set_node_labels(ctx, &obj, g.get_node_labels(nid))?;
+        set_node_attrs(ctx, &obj, g.get_node_all_attrs(nid), graph, None)?;
     }
-    obj.set("attributes", attrs_obj)
-        .map_err(|e| format!("JS set error: {e}"))?;
-
-    drop(g);
 
     // .getNeighbors(config?) method. A single shared JS function reads the
     // node id from `this.__falkor_node_id`; it is eval'd ONCE per context —
@@ -209,6 +199,49 @@ pub fn create_js_node<'js>(
     Ok(obj.into_value())
 }
 
+/// Set a JS node's `.labels` array.
+fn set_node_labels<'js>(
+    ctx: &Ctx<'js>,
+    obj: &Object<'js>,
+    labels: impl Iterator<Item = Arc<String>>,
+) -> Result<(), String> {
+    let labels_arr = Array::new(ctx.clone()).map_err(|e| format!("JS array error: {e}"))?;
+    for (i, label_name) in labels.enumerate() {
+        labels_arr
+            .set(i, label_name.as_str())
+            .map_err(|e| format!("JS set error: {e}"))?;
+    }
+    obj.set("labels", labels_arr)
+        .map_err(|e| format!("JS set error: {e}"))
+}
+
+/// Set a JS node's `.attributes` object, and each property directly on the
+/// node (node.name) unless it would shadow a reserved field.
+fn set_node_attrs<'js>(
+    ctx: &Ctx<'js>,
+    obj: &Object<'js>,
+    attrs: impl Iterator<Item = (Arc<String>, Value)>,
+    graph: &Arc<AtomicRefCell<Graph>>,
+    runtime: Option<&Runtime<'_>>,
+) -> Result<(), String> {
+    let attrs_obj = Object::new(ctx.clone()).map_err(|e| format!("JS object error: {e}"))?;
+    for (attr_name, value) in attrs {
+        let js_val = type_convert::value_to_js(ctx, &value, graph, runtime)?;
+        let name = attr_name.as_str();
+        if !matches!(name, "id" | "labels" | "attributes" | "getNeighbors")
+            && !name.starts_with("__falkor")
+        {
+            obj.set(name, js_val.clone())
+                .map_err(|e| format!("JS set error: {e}"))?;
+        }
+        attrs_obj
+            .set(name, js_val)
+            .map_err(|e| format!("JS set error: {e}"))?;
+    }
+    obj.set("attributes", attrs_obj)
+        .map_err(|e| format!("JS set error: {e}"))
+}
+
 /// Create a JS Edge object with id, type, source, target, attributes.
 pub fn create_js_edge<'js>(
     ctx: &Ctx<'js>,
@@ -254,8 +287,8 @@ pub fn create_js_edge<'js>(
         .map_err(|e| format!("JS set error: {e}"))?;
 
     // .source and .tar
```

**File**: `graph/src/udf/type_convert.rs` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ fn value_to_js_level<'js>(
             Ok(obj.into_value())
         }
         Value::Node(node_id) => {
-            crate::udf::js_classes::create_js_node(ctx, (*node_id).into(), graph)
+            crate::udf::js_classes::create_js_node(ctx, (*node_id).into(), graph, runtime)
         }
         Value::Relationship(rel_id) => {
             let (src, dst) = runtime.map_or_else(
```

**File**: `tests/flow/test_udf.py` (modified, +21/-0)
```diff
@@ -1061,6 +1061,27 @@ def test_edge_object(self):
         self.env.assertEqual(res["attributes"]["id"], "edge_custom_id")
         self.env.assertEqual(res["attributes"]["role"], "dev")
 
+    def test_deleted_entities_seen_as_runtime_sees_them(self):
+        # Regression for #3454: a node deleted earlier in the same query must
+        # look the same to a UDF as it does to labels(n) / n.name, both when
+        # passed directly and as an edge endpoint (e.source).
+        script = """
+        function inspect_node(n) { return [n.labels, n.attributes.name]; }
+        function inspect_src(e) { return [e.source.labels, e.source.attributes.name]; }
+        falkor.register('inspect_node', inspect_node);
+        falkor.register('inspect_src', inspect_src);
+        """
+        self.db.udf_load("deleted", script, True)
+
+        self.graph.query("CREATE (:P {name: 'A'})-[:R]->(:Q {name: 'B'})")
+
+        q = """MATCH (n:P)-[r:R]->()
+               DETACH DELETE n
+               RETURN labels(n), n.name, deleted.inspect_node(n), deleted.inspect_src(r)"""
+        res = self.graph.query(q)
+        self.env.assertEqual(res.nodes_deleted, 1)
+        self.env.assertEqual(res.result_set, [[['P'], 'A', [['P'], 'A'], [['P'], 'A']]])
+
     def test_load_invalid_invocations(self):
         """
         Test invalid invocations of GRAPH.UDF LOAD:
```

#### Recent Merged Pull Requests:
- **PR #3586** (2026-10-29): fix: algo.MSF sizes its id mapping by active nodes, not the highest node id (#3444) (@AviAvni)
- **PR #3552** (2026-10-29): ci: a C release moves :latest only when GitHub marks it latest (@DvirDukhan)
- **PR #3550** (2026-10-28): fix(index): hand the indexer lock over fairly between population batches (@DvirDukhan)
- **PR #3549** (closed): fix(deps): pin parking_lot to 0.12.5; Dependabot skips 0.13 (@DvirDukhan)
- **PR #3543** (2026-10-28): 4.22.3 (@DvirDukhan)
- **PR #3539** (2026-10-28): fix(traverse-order): score fixed multi-hop edges as variable length (@DvirDukhan)

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

## X. index): a column's build state, and indexer batches that fill it (#2351)

**RULE**:
When implementing operations in `graph/src/graph/graph.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1a73f65`: index): a column's build state, and indexer batches that fill it (#2351). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `graph/src/graph/graph.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    falkordb_index::{BuildCursor, FalkorDbIndex, IndexKey},
    /// `pub(crate)` for `index::falkordb`: `graph_writes` reads it to stage changes and to read
    /// build batches, and `FalkorDbIndex::apply` updates it.
    /// One indexer batch on this version: read the next entities of column `key` of `entity` at
    /// the values this version holds, at most `entities` nodes or edges, add it to the column and
    /// move the column's cursor. `false`, changing nothing, if the column is not `Building`.
    #[cfg(feature = "index-falkordb")]
    pub(crate) fn index_batch(
        &mut self,
        entity: EntityType,
        key: &IndexKey,
        entities: usize,
    ) -> bool {
        graph_writes::read_indexer_batch_of(self, entity, key, entities)
            .is_some_and(|batch| self.falkordb_index.apply_indexer_batch(batch))
    }

        {
            // A `Building` column asks where a written entity sits in build order: a node by its
            // id, an edge by its endpoints, which an edge this unit deleted no longer has.
            let endpoints = &self.edge_endpoints;
            self.falkordb_index
                .apply(&mut docs.native, |entity, id| match entity
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    falkordb_index::FalkorDbIndex,
    /// `pub(crate)` for `index::falkordb`: `graph_writes` reads it to stage changes, and
    /// `FalkorDbIndex::apply` updates it.
        self.falkordb_index.apply(&mut docs.native);
    /// (non-numeric / composite / missing column). Wraps
    /// RediSearch) for non-numeric/composite predicates or a missing column.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1a73f65` are properly handled with clean fallback behavior.
