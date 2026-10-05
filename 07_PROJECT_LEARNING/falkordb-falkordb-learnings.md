# Forensic Learning Record (Deep Inspection): FalkorDB/FalkorDB

> **Canonical Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:43:07.662Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 7414 stars

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
//! **Inline node attributes:**
//!
//! Also converts `NodeByLabelScan` nodes that carry inline property attributes
//! (e.g. `(n:Person {name: 'Alice'})`) into `NodeByIndexScan` when the
//! attribute is indexed.
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

    /// Inline property attributes (e.g. `{age: 30}` on the pattern).
    fn inline_attrs(&self) -> &DynTree<ExprIR<Variable>>;

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
    fn inline_attrs(&self) -> &DynTree<ExprIR<Variable>> {
        &self.attrs
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
    fn inline_attrs(&self) -> &DynTree<ExprIR<Variable>> {
        &self.attrs
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
        && var == node_alias
        && !references_var(&filter.child(1), node_alias)
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
        && var == node_alias
        && !references_var(&filter.child(0), node_alias)
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

/// Returns true if the expression tree references the given variable.
fn references_var(
    expr: &DynNode<ExprIR<Variable>>,
    var: &Variable,
) -> bool {
    for node in expr.walk::<Bfs>() {
        if let ExprIR::Variable(v) = node
            && v == var
        {
            return true;
        }
    }
    false
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
    mpsc::{Array, bounded_blocking},
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
    threadpool::{pending_count, spawn},
};
use orx_tree::{Collection, Dfs, NodeRef};
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
    /// True if this is a GRAPH.PROFILE write: execute with profiling enabled and
    /// reply with the profile tree instead of the result set. Otherwise handled
    /// exactly like a GRAPH.QUERY write — same locking, commit and effects
    /// replication, so a profiled write does not diverge from replicas.
    pub profile: bool,
}

/// What `commit_and_replicate` needs to publish a finished write.
struct WriteQueryOk {
    graph: Arc<AtomicRefCell<Graph>>,
    effects_buffer: Option<EffectsBuffer>,
    modified: bool,
}

im
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
# SETUP: that builds 10k nodes, 10k edges, vector and fulltext indexes,
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

### Core Architecture Module: `bench/src/falkorbench/counters.py`
```
"""Per-process instruction/cycle counters, by platform.

Three backends, chosen by what the host actually provides:

  rusage  macOS. `proc_pid_rusage` gives a running total for any pid with no
          privileges, so a window is read-before / read-after.
  perf    Linux. There is no rusage equivalent; the PMU is reached through
          `perf stat -p <pid> -- <cmd>`, which measures the process for exactly
          as long as `cmd` runs. That is a window measurement rather than a
          running total, which is why the two cannot share one code path.
  null    Neither available. instr/cycles are then reported as *absent*, never
          substituted with wall-clock: a time-based stand-in would turn the
          regression gate into a noise detector while still looking like a
          measurement.

`cmd` is always an external process. That is not incidental — the perf backend
defines its counting window by that process's lifetime, and `pmc_tool`'s
counters are system-wide, so a Python-side loop would put this interpreter's own
work into the numbers. Whatever drives the measured queries stays a C binary.
"""

from __future__ import annotations

import ctypes
import shutil
import subprocess
import sys
import time
from collections.abc import Sequence
from typing import NamedTuple

from falkorbench.model import Metric


class Reading(NamedTuple):
    """One measurement window."""

    instr: Metric
    cycles: Metric
    elapsed: float
    events: dict[str, float]


class Rusage(NamedTuple):
    """The three `proc_pid_rusage` fields this harness uses."""

    instructions: int
    cycles: int
    peak_footprint: int


# --- macOS: proc_pid_rusage ---------------------------------------------------

_RUSAGE_INFO_V4 = 4


def read_rusage(pid: int) -> Rusage | None:
    """Running instruction/cycle/peak-footprint totals for `pid`, or None.

    Shared by the measure loop and the flow-test harness; it used to be copied
    into both. None (rather than raising) when the pid is gone, because the flow
    harness polls pids that come and go.
    """
    if sys.platform != "darwin":
        raise RuntimeError("proc_pid_rusage is macOS-only")
    libproc = ctypes.CDLL("/usr/lib/libproc.dylib")
    buf = ctypes.create_string_buffer(1024)
    if libproc.proc_pid_rusage(ctypes.c_int(pid), ctypes.c_int(_RUSAGE_INFO_V4), buf) != 0:
        return None
    u64 = (ctypes.c_uint64 * 40).from_buffer_copy(buf.raw[16:336])
    # ri_instructions, ri_cycles, ri_lifetime_max_phys_footprint
    return Rusage(u64[29], u64[30], u64[28])


class PmcTool:
    """Optional Apple-silicon PMU counters (branches / branch-misses / L1D).

    `pmc_tool` deliberately does not run the measured command itself: it is
    installed setuid-root, and a setuid binary that execs a caller-supplied
    command is a local privilege escalation (put your own `redis-benchmark`
    earlier in `$PATH` and you have root). It opens a counter window, prints
    READY and waits on stdin; the caller runs the command unprivileged in that
    gap and then closes the window. The counters are system-wide, so bracketing
    in time was always sufficient.
    """

    def __init__(self, path: str) -> None:
        self.path = path

    def works(self) -> bool:
        return self.window(["true"])[0] is not None

    def window(self, cmd: Sequence[str]) -> tuple[dict[str, float] | None, float]:
        """Run `cmd` inside a counter window; return (events, elapsed)."""
        proc = subprocess.Popen(
            [self.path, "window"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            if (proc.stdout.readline() or "").strip() != "READY":  # type: ignore[union-attr]
                proc.kill()
                return None, 0.0
            subprocess.run(cmd, capture_output=True)
            out, _ = proc.communicate("\n", timeout=60)
        except (OSError, subprocess.SubprocessError):
            proc.kill()
            return None, 0.0
        if "EVENT" not in out:
            return None, 0.0
        events: dict[str, float] = {}
        elapsed = 0.0
        for line in out.splitlines():
            parts = line.split()
            if not parts:
                continue
            if parts[0] == "ELAPSED":
                elapsed = float(parts[1])
            elif parts[0] == "EVENT":
                events[parts[1]] = float(parts[2])
        return events, elapsed


class RusageBackend:
    name = "rusage"

    def __init__(self, pmc: PmcTool | None = None) -> None:
        self.pmc = pmc

    def run_and_count(self, pid: int, cmd: Sequence[str]) -> Reading:
        before = read_rusage(pid)
        if self.pmc is not None:
            events, elapsed = self.pmc.window(cmd)
            events = events or {}
        else:
            events = {}
            t0 = time.time()
            subprocess.run(cmd, capture_output=True)
            elapsed = time.time() - t0
        after = read_rusage(pid)
        if before is None or after is None:
            raise OSError(f"proc_pid_rusage failed for pid {pid} (process gone?)")
        return Reading(
            after.instructions - before.instructions,
            after.cycles - before.cycles,
            elapsed,
            events,
        )


# --- Linux: perf -------------------------------------------------------------


class PerfBackend:
    name = "perf"

    def __init__(self, perf: str) -> None:
        self.perf = perf

    def run_and_count(self, pid: int, cmd: Sequence[str]) -> Reading:
        """instructions/cycles for `pid` while `cmd` runs, plus elapsed seconds.

        `perf stat -p PID -- CMD` attaches to PID, runs CMD, and stops counting
        when CMD exits, so the counters cover exactly the benchmark window.
        `-x,` gives machine-readable `value,unit,event,...` lines on stderr.
        """
        t0 = time.time()
        out = subprocess.run(
            [self.perf, "stat", "-x,", "-e", "instructions,cycles", "-p", str(pid), "--", *cmd],
            capture_output=True,
            text=True,
        )
        elapsed = time.time() - t0
        vals = _parse_perf(out.stderr)
        if "instructions" not in vals or "cycles" not in vals:
            raise OSError(
                "perf stat returned no instructions/cycles. Needs PMU access: "
                "kernel.perf_event_paranoid <= 0 (or CAP_PERFMON), and a host that "
                "exposes the PMU (bare metal or a VM with vPMU enabled). "
                f"stderr: {out.stderr.strip()[:300]}"
            )
        return Reading(vals["instructions"], vals["cycles"], elapsed, {})


def _parse_perf(stderr: str) -> dict[str, float]:
    """`value,unit,event,...` lines -> {event: value}, skipping unavailable ones.

    "<not supported>" / "<not counted>" arrive in the value column and are
    dropped, which is what lets `perf_counters_work` below tell a real PMU from
    a perf binary that runs fine and measures nothing.
    """
    vals: dict[str, float] = {}
    for line in stderr.splitlines():
        parts = line.split(",")
        if len(parts) >= 3:
            try:
                vals[parts[2].strip()] = float(parts[0].strip())
            except ValueError:
                continue
    return vals


def perf_counters_work(perf: str | None) -> bool:
    """True only if perf actually returns counter values.

    The binary being on PATH is not enough: without PMU access (a VM without
    vPMU, or a strict `kernel.perf_event_paranoid`) perf runs fine and reports
    `<not supported>` for every event. Selecting the backend on `which perf`
    alone made the availability check lie, so the graceful-degradation path
    never engaged and a run died on its first measurement instead of reporting
    instr/cycles as absent.
    """
    if not perf:
        return False
    try:
        out = subprocess.run(
            [perf, "stat", "-x,", "-e", "instructions,cycles", "--", "true"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return bool(_parse_perf(out.stderr))


# --- no counters -------------------------------------------------------------


class NullBackend:
    name = "none"

    def run_and_count(self, pid: int, cmd: Sequence[str]) -> Reading:
        t0 = time.time()
        subprocess.run(cmd, capture_output=True)
        return Reading(None, None, time.time() - t0, {})


Backend = RusageBackend | PerfBackend | NullBackend


def select_backend(pmc_path: str | None = None) -> Backend:
    """Pick the counter backend this host can actually support."""
    if sys.platform == "darwin":
        pmc = PmcTool(pmc_path) if pmc_path else None
        if pmc is not None and not pmc.works():
            pmc = None
        return RusageBackend(pmc)
    perf = shutil.which("perf")
    if perf_counters_work(perf):
        return PerfBackend(perf)  # type: ignore[arg-type]
    return NullBackend()

```

### Core Architecture Module: `bench/src/falkorbench/coverage.py`
```
"""How much of the graph crate the query set actually reaches.

Builds an instrumented debug module, runs every query once, and reports line
coverage of `graph/src` (excluding the generated GraphBLAS FFI).

This is a **validator of the query set**, not a coverage gate: it reports a
percentage and enforces no floor. What it does enforce is that every query still
runs — the once-pass exits non-zero if any of them stops working, which is the
part worth failing CI over.

Was `bench/coverage.sh`. The report parsing in particular was two `awk`
one-liners indexing `$8`/`$9` out of llvm-cov's table with nothing explaining
where those numbers came from; here the column layout is named once and covered
by tests.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# `llvm-cov report` emits a fixed, whitespace-separated table:
#
#   Filename Regions Missed_Regions Cover Functions Missed_Functions Executed \
#   Lines Missed_Lines Cover Branches ...
#
# so index 7 is total lines and index 8 is missed lines. The shell version
# hardcoded these as awk's $8/$9 with no note of what they were.
_LINES = 7
_MISSED_LINES = 8

# The FFI bindings are generated, and vendored/toolchain sources are not ours.
IGNORE_RE = r"(GraphBLAS\.rs|graphblas/mod\.rs|\.cargo|rustc)"


@dataclass
class FileCoverage:
    path: str
    lines: int
    missed: int

    @property
    def covered(self) -> int:
        return self.lines - self.missed

    @property
    def percent(self) -> float:
        return 100.0 * self.covered / self.lines if self.lines else 0.0


@dataclass
class Coverage:
    files: list[FileCoverage]

    @property
    def lines(self) -> int:
        return sum(f.lines for f in self.files)

    @property
    def missed(self) -> int:
        return sum(f.missed for f in self.files)

    @property
    def covered(self) -> int:
        return self.lines - self.missed

    @property
    def percent(self) -> float:
        return 100.0 * self.covered / self.lines if self.lines else 0.0

    def least_covered(self, min_lines: int = 200, limit: int = 15) -> list[FileCoverage]:
        big = [f for f in self.files if f.lines > min_lines]
        return sorted(big, key=lambda f: f.percent)[:limit]


def parse_report(text: str, prefix: str = "graph/src") -> Coverage:
    """Pull per-file line counts for `prefix` out of an `llvm-cov report` table.

    Rows whose filename does not contain `prefix` are skipped, as are the TOTAL
    row and any row too short to carry line columns — llvm-cov wraps long paths
    onto their own line, which would otherwise be read as a data row.
    """
    files: list[FileCoverage] = []
    for line in text.splitlines():
        if prefix not in line:
            continue
        parts = line.split()
        if len(parts) <= _MISSED_LINES:
            continue
        try:
            lines, missed = int(parts[_LINES]), int(parts[_MISSED_LINES])
        except ValueError:
            continue
        files.append(FileCoverage(path=parts[0], lines=lines, missed=missed))
    return Coverage(files=files)


def _llvm_tool(name: str) -> Path:
    """Locate an llvm-tools binary belonging to the *rust toolchain*.

    The toolchain's copy is required, not merely preferred: LLVM's instrumentation
    profile format is versioned and coupled to the rustc that emitted the
    `.profraw`. A system LLVM (Homebrew's, say) is usually a different major
    version and fails with "unsupported instrumentation profile format version".
    So `~/.rustup/toolchains` is searched first and `PATH` is only a fallback —
    getting this backwards is easy, because on a dev machine `shutil.which` finds
    a perfectly real llvm-profdata that cannot read these profiles.

    These binaries are not on PATH by default: they ship in the
    `llvm-tools-preview` component, which is not installed by default. The shell
    version globbed `~/.rustup` and, when it found nothing, silently built the
    path `./llvm-profdata` and failed with a confusing "No such file or
    directory" — hence the explicit error below.
    """
    roots = [Path.home() / ".rustup/toolchains"]
    rustc = shutil.which("rustc")
    if rustc:
        # rustup shims resolve to ~/.rustup/toolchains/<tc>/bin/rustc, so the
        # sibling lib/ tree is where a non-default RUSTUP_HOME keeps them.
        roots.append(Path(rustc).resolve().parent.parent / "lib")
    for root in roots:
        if not root.exists():
            continue
        for found in sorted(root.rglob(name)):
            if found.is_file() and os.access(found, os.X_OK):
                return found

    on_path = shutil.which(name)
    if on_path:
        return Path(on_path)
    raise RuntimeError(
        f"{name} not found. Install it with: rustup component add llvm-tools-preview"
    )


def module_extension() -> str:
    return "dylib" if sys.platform == "darwin" else "so"


def build_flags() -> tuple[str, dict[str, str]]:
    """RUSTFLAGS and extra env for an instrumented build."""
    flags = "-C instrument-coverage"
    env: dict[str, str] = {}
    if sys.platform != "darwin":
        # Required on Linux (and so in CI): the embedded RediSearch static libs
        # otherwise fail to link with duplicate-symbol errors. macOS's linker
        # neither takes the flag nor needs it.
        flags += " -C link-arg=-Wl,--allow-multiple-definition"
        # graph/build.rs compiles C++ shims; the toolchain image has no default.
        env["CXX"] = os.environ.get("CXX", "clang++")
    return flags, env


def run(root: Path, bench_dir: Path, *, port: int, echo=print) -> Coverage:
    """The whole loop: instrumented build, one pass over the query set, report."""
    covdir = bench_dir / "results/cov"
    shutil.rmtree(covdir, ignore_errors=True)
    covdir.mkdir(parents=True)

    flags, extra_env = build_flags()
    env = {**os.environ, "RUSTFLAGS": flags, **extra_env}

    echo("== instrumented debug build ==")
    subprocess.run(["cargo", "build"], cwd=root, env=env, check=True)

    module = root / f"target/debug/libfalkordb.{module_extension()}"
    if not module.exists():
        raise RuntimeError(f"instrumented module not found at {module}")

    echo("== running the query set once each ==")
    # A subprocess, deliberately: the instrumented server inherits
    # LLVM_PROFILE_FILE from it, and keeping the measured run in its own process
    # means this command's own imports never land in the profile.
    once_env = {**os.environ, "LLVM_PROFILE_FILE": str(covdir / "cov-%p.profraw")}
    once = subprocess.run(
        [
            sys.executable,
            "-m",
            "falkorbench.cli",
            "measure",
            "--once",
            "--port",
            str(port),
            "--module",
            str(module),
        ],
        cwd=root,
        env=once_env,
    )

    profraws = sorted(covdir.glob("*.profraw"))
    if not profraws:
        raise RuntimeError(
            "no .profraw written — the instrumented server never flushed. It must "
            "be shut down gracefully (SHUTDOWN NOSAVE), not killed."
        )

    profdata = covdir / "cov.profdata"
    subprocess.run(
        [
            str(_llvm_tool("llvm-profdata")),
            "merge",
            "--sparse",
            *map(str, profraws),
            "-o",
            str(profdata),
        ],
        check=True,
    )
    report = subprocess.run(
        [
            str(_llvm_tool("llvm-cov")),
            "report",
            "--instr-profile",
            str(profdata),
            str(module),
            f"--ignore-filename-regex={IGNORE_RE}",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    (covdir / "report.txt").write_text(report)

    cov = parse_report(report)
    echo("")
    echo("== graph crate coverage (excluding the generated GraphBLAS FFI) ==")
    echo(f"lines: {cov.covered}/{cov.lines} = {cov.percent:.1f}%")
    echo("")
    echo("== least-covered graph/src files (>200 lines) ==")
    for f in cov.least_covered():
        echo(f"{f.percent:7.1f}%  {f.lines:6d} lines  {f.path}")
    echo("")
    echo(f"full report: {covdir / 'report.txt'}")

    # The once-pass exit code is the part that matters for CI: a query that
    # stopped working is a real failure, whereas the percentage is informational.
    if once.returncode != 0:
        raise RuntimeError(
            f"the query set did not run clean (exit {once.returncode}) — see the "
            f"FAIL lines above. Coverage numbers above are still valid."
        )
    return cov

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3091** (2026-10-04): **[Rust] Index OPTIONS validation diverges from C (missing vector dimension/similarityFunction accepted, 'Euclidean' rejected, unknown fulltext keys ignored)**
  *Symptoms*: ### Summary  Index `OPTIONS` validation differs from C in several ways. All come from one cause: `map_to_index_options` treats required vector options as optional and does not check fulltext option keys.  ### Reproduction (release build, `main` @ 55204c94b)  | Query | Rust | C | |---|---|---| | `CREATE VECTOR INDEX FOR (n:A) ON (n.v)` (no OPTIONS) | `field type 0x0010 and the options block disagree about the vector half` | `Invalid vector index configuration` | | `... OPTIONS {}` | accepted (dimension 0) | `Invalid vector index configuration` | | `... OPTIONS {similarityFunction:'euclidean'}` (no dimension) | accepted (dimension 0: no vector can ever be indexed) | `Invalid vector index configuration` | | `... OPTIONS {dimension:2}` (no similarityFunction) | accepted | `Invalid vector index configuration` | | `... OPTIONS {dimension:2, similarityFunction:'Euclidean'}` / `'COSINE'` | `Unknown similarity function 'Euclidean'` | accepted (`strcasecmp`) | | `CREATE FULLTEXT INDEX ... OPTIONS {foo:1}` | accepted, `foo` silently ignored | `invlaid index configuration` |  ### Mechanism  `graph/src/runtime/runtime.rs` `map_to_index_options`: - `dimension` defaults to `0` and `similarityFunction` to `None` when absent. C (`src/index/index_vector_create.c` `_parseOptions`) requires both. - `similarityFunction` is compared case-sensitively later on (`graph/src/index/mod.rs:1265`). C uses `strcasecmp`. - The fulltext branch reads only the keys it knows and ignores the rest. C's `_validate
  **Post-Mortem & Fix Analysis**:
  > ﻿There is a second half to the `similarityFunction` story that this issue does not name, and it is not a parser-layer problem - so it probably does not belong in this issue's fix, but it should not be lost.  This issue's mechanism section points at `runtime.rs: map_to_index_options` and the engine-layer check. Both are real. What neither mentions is the **wire codec**, where the writer and the reader disagree about the same closed set:  `graph/src/effects/v3/records.rs:190-198`, encoding:  ```rust put_opt(buf, v.similarity_function.as_ref(), |b, s| {     b.u64(if s.eq_ignore_ascii_case("ip") {         1     } else if s.eq_ignore_ascii_case("cosine") {         2     } else {         0     }); }); ```  `graph/src/effects/v3/records.rs:244-251`, decoding:  ```rust similarity_function: take_opt(r, |r| r.u64())?     .map(|s| match s {         1 => Ok("ip".to_owned()),         2 => Ok("cosine".to_owned()),         0 => Ok("euclidean".to_owned()),         other => Err(DecodeError::BadSimilari

- **Issue #3085** (2026-10-05): **[Rust] Huge k in db.idx.vector.queryNodes crashes the server (Vec::with_capacity(k))**
  *Symptoms*: ### Summary  A very large `k` in `db.idx.vector.queryNodes` / `queryRelationships` crashes the server. A `k` near `i64::MAX` returns no rows. C returns all matching rows in both cases.  ### Reproduction (release build, `main` @ 55204c94b)  ``` GRAPH.QUERY hk "CREATE VECTOR INDEX FOR (n:L) ON (n.v) OPTIONS {dimension:2, similarityFunction:'euclidean'}" GRAPH.QUERY hk "CREATE (:L {v:vecf32([1,2])})" GRAPH.QUERY hk "CALL db.idx.vector.queryNodes('L','v',1000000000000000,vecf32([1,2])) YIELD node RETURN count(node)" Rust: Error: Server closed the connection        C: 1 ```  After fixing the allocation, `k = 9223372036854775807` returns `0` rows (C: `1`).  ### Mechanism  - `Graph::vector_query_nodes` / `vector_query_edges` (`graph/src/graph/graph.rs:3744,3799`) call `Vec::with_capacity(k)` with the user's `k`. That aborts on allocation failure, which kills the server. - The unclamped `k` also goes to `RediSearch_CreateVecSimNode`. For `k` near `i64::MAX` the KNN iterator yields nothing.  ### Expected  Same as C: the call returns every indexed entity when `k` is at least the index size.  ### Suggested fix  Size the output by the number of results rather than by `k`, and clamp `k` to the entity count, which is an upper bound on the index size, before building the KNN query.  ### Found by  Lean 4 model `proofs/search_concurrency` (`Search.huge_k_kills_server`, fix: `Search.capped_capacity_ok`). 

- **Issue #3075** (2026-10-05): **[Rust] A vector of the wrong dimension removes the entity from all indexes on its label**
  *Symptoms*: ### Summary  When an entity's vector has a different dimension from the label's vector index, the entity drops out of **every** index on that label, including unrelated range and fulltext indexes. Index scans then miss it. C skips only the vector field and keeps the entity in the other indexes.  ### Reproduction (release build, `main` @ 55204c94b)  ``` GRAPH.QUERY vd "CREATE INDEX FOR (n:L) ON (n.name)" GRAPH.QUERY vd "CREATE VECTOR INDEX FOR (n:L) ON (n.v) OPTIONS {dimension:2, similarityFunction:'euclidean'}" GRAPH.QUERY vd "CREATE (:L {name:'a', v:vecf32([1,2,3])})" GRAPH.QUERY vd "MATCH (n:L) WHERE n.name='a' RETURN n.name" Rust: (empty)       C: a ```  The same happens when the entity is indexed by background population, and when a later `SET` writes a wrong-dimension vector.  ### Mechanism  `Document::set` (`graph/src/index/mod.rs:720-731`) adds every `VecF32` value to the vector field without checking the index's dimension. RediSearch rejects the whole document (all fields of the label share one spec and one document), so the entity is removed from every index on the label. C checks the dimension first and skips the vector field (`src/index/index.c:470-476`, "vector dimension mis-match, can't index this vector").  ### Expected  Same as C: a vector of the wrong dimension is not added to the vector index, and the entity stays in the other indexes.  ### Suggested fix  In `Document::set`, skip the vector field when `vec.len() != vector_options.dimension`.  ### Found by  Le

- **Issue #3057** (2026-10-04): **[Rust] Parser accepts invalid syntax (NOT NOT x → x, SET [n).x, f(1,), MATCH MATCH, LOAD CSV WITH FROM) and rejects x IS NULL IN [..]**
  *Symptoms*: ### Summary  The hand-written parser accepts several inputs outside the openCypher grammar, some of which then run with a changed meaning. It also rejects one input the grammar allows. Each case is a small local slip in `graph/src/parser/cypher.rs`. C matches the grammar in every case below.  ### Reproduction (release build, `main` @ 55204c94b)  | # | Query | Rust | C | |---|---|---|---| | 1 | `RETURN NOT NOT 1` | `1` | `Type mismatch: expected Boolean or Null but was Integer` | | 2 | `MATCH (n:N) SET [n).x = 5 RETURN n.x` | `5` (runs as `SET n.x = 5`) | `Invalid input ')' …` | | 2 | `MATCH (n) REMOVE [n).x` | runs as `REMOVE n.x` | syntax error | | 3 | `RETURN 1 IS NULL IN [false]` | `Unexpected clause following RETURN … pos 16` | `true` | | 3 | `RETURN 'a' IS NULL STARTS WITH 'a'` | same syntax error | parses (then a type error) | | 4 | `RETURN abs(-1,)` | `1` | `Invalid input ')' …` | | 5 | `MATCH MATCH (n) RETURN n` | `[]` | `Invalid input '(': expected '='` | | 6 | `LOAD CSV WITH FROM 'x' AS r RETURN r` | parses (fails later on the file path) | `Invalid input 'F': expected WITH HEADERS` |  ### Mechanism  1. **`NOT NOT x` → `x`** (`cypher.rs:2193`): the NOT prefix keeps only the parity of the count, so an even run disappears. NOT type-checks its operand, so the check is lost with it. 2. **`SET`/`REMOVE` target** (`3225-3229`, `3291-3295`): `parse_primary_expr` returns `recurse = true` for both `(` and an open list `[`. The target code treats both as `(`: it drops the list

- **Issue #3052** (2026-10-04): **[Rust] GRAPH.MEMORY rejects SAMPLES 0; GRAPH.CONSTRAINT accepts LABEL/EDGE and +1/01 property counts (C rejects)**
  *Symptoms*: ### Summary  Two small argument-parsing divergences from C in admin commands.  ### Reproduction (release build, `main` @ 55204c94b; C = `master`)  | command | Rust | C | |---|---|---| | `GRAPH.MEMORY USAGE g SAMPLES 0` | `ERR SAMPLES count must be a positive integer` | report (0 is clamped to 1 sample) | | `GRAPH.MEMORY USAGE g SAMPLES -20` | `ERR SAMPLES count must be a positive integer` | `SAMPLES must be a non-negative integer` | | `GRAPH.CONSTRAINT CREATE g MANDATORY NODE L PROPERTIES +1 q` (also `01`) | `PENDING` (constraint created) | `Number of properties must be an integer between 1 and 255` | | `GRAPH.CONSTRAINT CREATE g MANDATORY LABEL L PROPERTIES 1 z` (also `EDGE`) | `PENDING` (constraint created) | `Invalid constraint entity type` |  ### Mechanism  - `src/commands/memory.rs:205-229` rejects a count of 0; C (`cmd_memory.c`) reads any non-negative count with `RedisModule_StringToULongLong` and clamps it to `1..=10000` (Rust already clamps in `Graph::memory_usage_report`). - `src/commands/constraint.rs:427-430` accepts `LABEL`/`EDGE` as aliases; C's `Constraint_Parse` accepts only `NODE`/`RELATIONSHIP`. The property count is read with `str::parse` (accepts `+1`, `01`); C uses `RedisModule_StringToLongLong` (`string2ll`). Keywords are folded with Unicode `to_uppercase` rather than ASCII (`strcasecmp`).  ### Expected  Match C.  ### Found by  Lean 4 model of the Redis layer (`proofs/redis_layer`, header "Confirmed divergences" 7); live repro `proofs/redis_layer/repro_l

- **Issue #3020** (2026-10-05): **[Rust] GRAPH.CONFIG accepts values/arity C rejects (VKEY_MAX_ENTITY_COUNT -5, CMD_INFO 1, JS_HEAP_SIZE 5, GET x extra, Unicode name folding); ASYNC_DELETE reports 0**
  *Symptoms*: ### Summary  `GRAPH.CONFIG` accepts several requests that C rejects, and reports `ASYNC_DELETE` differently.  ### Reproduction (release build, `main` @ 55204c94b; C = `master`)  | command | Rust | C | |---|---|---| | `GRAPH.CONFIG SET VKEY_MAX_ENTITY_COUNT -5` | `OK` (then read back as `-5`, used `as u64`) | `Failed to set config value VKEY_MAX_ENTITY_COUNT to -5` | | `GRAPH.CONFIG SET CMD_INFO 1` (also `true`, `0`, `false`; same for `ASYNC_DELETE`, `DELAY_INDEXING`) | `OK` | `Failed to set config value CMD_INFO to 1` | | `GRAPH.CONFIG SET JS_HEAP_SIZE 5` (also `0`; same for `JS_STACK_SIZE`) | `OK` | `JS_HEAP_SIZE must be at least 1MB (1048576)` | | `GRAPH.CONFIG GET TIMEOUT extra` | `[TIMEOUT, 0]` | wrong number of arguments | | `GRAPH.CONFIG SET TIMEOUT` | `Missing value for configuration parameter` | wrong number of arguments | | `GRAPH.CONFIG GET tımeout` (dotless `ı`) | `[TIMEOUT, 0]` | `Unknown configuration field` | | `GRAPH.CONFIG GET ASYNC_DELETE` (default) | `0` | `1` |  ### Mechanism (`src/commands/config_cmd.rs`)  - `validate_config_set`: `VKEY_MAX_ENTITY_COUNT` has no lower bound; booleans accept `1/0/true/false` besides `yes/no` (C `_Config_ParseYesNo` takes only `yes`/`no`); `JS_HEAP_SIZE`/`JS_STACK_SIZE` only require `>= 0` (C: positive and `>= 1048576`). - `graph_config`: no arity check (C: `GET` needs exactly 3 args, `SET` an even count `>= 4`); names are folded with `str::to_uppercase`, which is Unicode-aware (`ı` → `I`), where C uses ASCII `strcasecmp`. - 

- **Issue #3009** (2026-10-05): **[Rust] Query command flag parsing diverges from C: non-UTF-8 arg ends parsing, TIMEOUT/version accept +10/010/-5, RO_QUERY/PROFILE/EXPLAIN ignore bad flags, no arity cap**
  *Symptoms*: ### Summary  `GRAPH.QUERY`, `GRAPH.RO_QUERY`, `GRAPH.PROFILE` and `GRAPH.EXPLAIN` each parse their trailing flags with their own ad-hoc loop, and all of them diverge from C's single dispatcher (`_validate_command_arity` + `_read_flags`, `cmd_dispatcher.c`).  ### Reproduction (release build, `main` @ 55204c94b; C = `master`)  | command | Rust | C | |---|---|---| | `GRAPH.QUERY g "RETURN 1" "\xff" --compact` | verbose reply (`--compact` dropped) | compact reply | | `GRAPH.QUERY g "RETURN 1" TIMEOUT -5` / `+10` / `010` | runs | `Failed to parse query timeout value` | | `GRAPH.QUERY g "RETURN 1" TIMEOUT abc` | `invalid digit found in string` | `Failed to parse query timeout value` | | `GRAPH.RO_QUERY g "RETURN 1" TIMEOUT abc` (or missing value) | runs, timeout silently dropped | `Failed to parse query timeout value` | | `GRAPH.PROFILE g "RETURN 1" TIMEOUT abc` | runs | `Failed to parse query timeout value` | | `GRAPH.EXPLAIN g "RETURN 1" TIMEOUT abc` | runs (flags never read) | `Failed to parse query timeout value` | | `GRAPH.QUERY g "RETURN 1" version 4294967296` | accepted, then version mismatch | `Failed to parse graph version value` | | `GRAPH.QUERY g "RETURN 1" version x` | `invalid digit found in string` | `Failed to parse graph version value` | | `GRAPH.QUERY g "RETURN 1" a b c d e f` (9 args) | runs | `wrong number of arguments for 'graph.QUERY' command` |  ### Mechanism  - `src/commands/query.rs:61` (`while let Ok(arg) = args.next_str()`) — the first non-UTF-8 argument e

- **Issue #2956** (2026-10-05): **[Rust] coalesce() with zero arguments is accepted (C: expected at least 1)**
  *Symptoms*: ### Summary  `coalesce()` with no arguments is accepted and returns `null`. C rejects it at compile time.  ### Reproduction (release build, `main` @ 2363723ac)  ``` GRAPH.QUERY g "RETURN coalesce()" -- Rust: null -- C:    Received 0 arguments to function 'coalesce', expected at least 1 ```  ### Mechanism  `coalesce` is registered as `var_arg` (`graph/src/runtime/functions/math.rs:314`). `GraphFn::validate` (`graph/src/runtime/functions/mod.rs:787`) does no arity check for `FnArguments::VarLength`. The other built-in variadics, `indegree`/`outdegree`, check `args.is_empty()` themselves at runtime (`entity.rs:310`).  ### Expected  Every built-in variadic function needs at least one argument (true of `coalesce`, `indegree` and `outdegree` in C). Reject zero arguments in `validate` for non-UDF `VarLength` functions, using C's message. UDFs stay unconstrained.  ### Found by  Lean 4 model (`proofs/value_math`, theorem `coalesce_zero_args_accepted`, TypeCheck.lean); Rust repro `graph/tests/lean_value_math.rs::bug_coalesce_accepts_zero_arguments`. 

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

### Incident Patch 1: `694f0c16` (2026-10-05)
**Commit Message**: test(var-len): cover fixed-length path multiplicity (#2471)

A fixed-length variable-length traversal used to collapse distinct paths,
behaving as if DISTINCT had been applied, and merely binding a path variable
changed the result because it selected a different traversal strategy.

Add test18_fixed_length_path_multiplicity, which builds a diamond with two
distinct 2-hop paths and asserts the destination is returned twice, that the
result is identical with and without a bound path variable, that it matches
the equivalent explicit two-hop pattern, and that the two paths remain
distinguishable by their intermediate node.

Closes #73
Closes #354
Closes #1450

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `tests/flow/test_variable_length_traversals.py` (modified, +58/-0)
```diff
@@ -572,3 +572,61 @@ def test17_var_len_planner_alias_consistency(self):
 
         result = self.graph.query(q)
         self.env.assertEqual(result.result_set, [])
+
+    def test18_fixed_length_path_multiplicity(self):
+        # a fixed-length variable-length traversal must emit one row per
+        # distinct path, and must not depend on whether a path variable
+        # happens to be bound
+        self.graph.delete()
+
+        # a diamond: two distinct 2-hop paths lead from n0 to n000
+        #   (n0)-[:LIKES]->(n00)-[:LIKES]->(n000)
+        #   (n0)-[:LIKES]->(n01)-[:LIKES]->(n000)
+        q = """CREATE (n0:A {name: 'n0'}),
+                      (n00:B {name: 'n00'}),
+                      (n01:B {name: 'n01'}),
+                      (n000:C {name: 'n000'}),
+                      (n0)-[:LIKES]->(n00),
+                      (n0)-[:LIKES]->(n01),
+                      (n00)-[:LIKES]->(n000),
+                      (n01)-[:LIKES]->(n000)"""
+        self.graph.query(q)
+
+        # the destination is reachable by two distinct paths, so it must be
+        # returned twice, without an implicit DISTINCT being applied
+        q = """MATCH (a:A)-[:LIKES*2]->(c)
+               WHERE a.name = 'n0'
+               RETURN c.name"""
+        res = self.graph.query(q).result_set
+        self.env.assertEqual(res, [['n000'], ['n000']])
+
+        # binding a path variable must not change the result
+        q = """MATCH p = (a:A)-[:LIKES*2]->(c)
+               WHERE a.name = 'n0'
+               RETURN c.name"""
+        self.env.assertEqual(self.graph.query(q).result_set, res)
+
+        # neither must the equivalent explicit two-hop pattern
+        q = """MATCH (a:A)-[:LIKES]->(m)-[:LIKES]->(c)
+               WHERE a.name = 'n0'
+               RETURN c.name"""
+        self.env.assertEqual(self.graph.query(q).result_set, res)
+
+        # the two paths are distinguishable by their intermediate node
+        q = """MATCH p = (a:A)-[:LIKES*2]->(c)
+               WHERE a.name = 'n0'
+               RETURN nodes(p)[1].name AS via
+               ORDER BY via"""
+        res = self.graph.query(q).result_set
+        self.env.assertEqual(res, [['n00'], ['n01']])
+
+        # a bounded range must stay consistent with and without a path
+        # variable as well
+        q = """MATCH (a:A)-[:LIKES*1..2]->(c) RETURN count(*)"""
+        without_path = self.graph.query(q).result_set
+
+        q = """MATCH p = (a:A)-[:LIKES*1..2]->(c) RETURN count(*)"""
+        with_path = self.graph.query(q).result_set
+
+        self.env.assertEqual(without_path, [[4]])
+        self.env.assertEqual(with_path, without_path)
```

---

### Incident Patch 2: `30b4fb7d` (2026-10-05)
**Commit Message**: fix: GRAPH.CONFIG validates values, arity and names as C does (#3021)

* fix: GRAPH.CONFIG validates values, arity and names as C does (#3020)

VKEY_MAX_ENTITY_COUNT must be non-negative, booleans take yes/no only,
JS_HEAP_SIZE/JS_STACK_SIZE must be at least 1MB, GET/SET arity is checked,
names fold ASCII-only, ASYNC_DELETE defaults to 1 and the unknown-field
error matches C.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* test: describe GRAPH.CONFIG validation without referring to the C engine

Address review: rename test14_c_validation to test14_config_validation
and drop the C-engine references from the test comments.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/commands/config_cmd.rs` (modified, +40/-21)
```diff
@@ -47,6 +47,12 @@ use crate::config::{
 use redis_module::{Context, NextArg, RedisResult, RedisString, RedisValue};
 use std::sync::atomic::Ordering;
 
+/// C's reply for a name it does not know, in GET and SET alike.
+const UNKNOWN_FIELD: &str = "Unknown configuration field";
+
+/// Smallest `JS_HEAP_SIZE` / `JS_STACK_SIZE` C accepts: 1MB.
+const JS_MIN_SIZE: i64 = 1_048_576;
+
 /// Get a single config value by name.
 fn config_get_one(
     ctx: &Context,
@@ -96,7 +102,7 @@ fn config_get_one(
         "TEMP_FOLDER" => RedisValue::BulkString((*CONFIGURATION_TEMP_FOLDER.lock(ctx)).clone()),
         "JS_HEAP_SIZE" => RedisValue::Integer(*CONFIGURATION_JS_HEAP_SIZE.lock(ctx)),
         "JS_STACK_SIZE" => RedisValue::Integer(*CONFIGURATION_JS_STACK_SIZE.lock(ctx)),
-        _ => return Err(format!("Unknown configuration field '{name}'")),
+        _ => return Err(UNKNOWN_FIELD.to_string()),
     };
     Ok(RedisValue::Array(vec![
         RedisValue::BulkString(name.to_string()),
@@ -127,12 +133,15 @@ fn validate_config_set(
             Ok(ConfigValue::Int(v))
         }
 
-        // Runtime-settable boolean configs
+        // Runtime-settable boolean configs: `yes` / `no` only, as C's
+        // `_Config_ParseYesNo`
         "ASYNC_DELETE" | "CMD_INFO" | "DELAY_INDEXING" => {
-            let v = match value.to_lowercase().as_str() {
-                "yes" | "1" | "true" => 1i64,
-                "no" | "0" | "false" => 0i64,
-                _ => return Err(format!("Failed to set config value {name} to {value}")),
+            let v = if value.eq_ignore_ascii_case("yes") {
+                1i64
+            } else if value.eq_ignore_ascii_case("no") {
+                0i64
+            } else {
+                return Err(format!("Failed to set config value {name} to {value}"));
             };
             Ok(ConfigValue::Int(v))
         }
@@ -156,6 +165,9 @@ fn validate_config_set(
             let v: i64 = value
                 .parse()
                 .map_err(|_| format!("Failed to set config value {name} to {value}"))?;
+            if v < 0 {
+                return Err(format!("Failed to set config value {name} to {value}"));
+            }
             Ok(ConfigValue::Int(v))
         }
         "MAX_INFO_QUERIES" => {
@@ -169,17 +181,11 @@ fn validate_config_set(
             // accepted and reported back as the cap
             Ok(ConfigValue::Int(v.min(MAX_INFO_QUERIES_CAP)))
         }
-        "JS_HEAP_SIZE" | "JS_STACK_SIZE" => {
-            let v: i64 = value
-                .parse()
-                .map_err(|_| format!("Failed to set config value {name} to {value}"))?;
-            if v < 0 {
-                return Err(format!(
-                    "Failed to set config value {name} to {value} - value must be non-negative"
-                ));
-            }
-            Ok(ConfigValue::Int(v))
-        }
+        // C: a positive integer of at least 1MB, same message for any bad value
+        "JS_HEAP_SIZE" | "JS_STACK_SIZE" => match value.parse::<i64>() {
+            Ok(v) if v >= JS_MIN_SIZE => Ok(ConfigValue::Int(v)),
+            _ => Err(format!("{name} must be at least 1MB ({JS_MIN_SIZE})")),
+        },
         // Read-only configs
         "THREAD_COUNT"
         | "INDEX_WORKER_THREADS"
@@ -191,7 +197,7 @@ fn validate_config_set(
         | "TEMP_FOLDER" => {
             Err("This configuration parameter cannot be set at run-time".to_string())
         }
-        _ => Err(format!("Unknown configuration field '{name}'")),
+        _ => Err(UNKNOWN_FIELD.to_string()),
     }
 }
 
@@ -303,11 +309,21 @@ pub fn graph_config(
     ctx: &Context,
     args: Vec<RedisString>,
 ) -> RedisResult {
+    // Arity as C's `Graph_Config`: `GET <name>` exactly, `SET` with name/value pairs.
+    if args.len() < 3 {
+        return Err(redis_module::RedisError::WrongArity);
+    }
+    let argc = args.len();
     let mut args = args.into_iter().skip(1);
     let sub_command = args.next_str()?;
 
-    match sub_command.to_uppercase().as_str() {
+    // Names are ASCII case-insensitive (C's `strcasecmp`); full Unicode case
+    // folding would map e.g. a dotless `ı` onto `I`.
+    match sub_command.to_ascii_uppercase().as_str() {
         "GET" => {
+            if argc != 3 {
+                return Err(redis_module::RedisError::WrongArity);
+            }
             let name = args.next_str()?;
             if name == "*" {
                 // Return all configs in order.
@@ -319,15 +335,18 @@ pub fn graph_config(
                 }
                 Ok(RedisValue::Array(result))
             } else {
-                let upper = name.to_uppercase();
+                let upper = name.to_ascii_uppercase();
                 config_get_one(ctx, &upper).map_err(redis_module::RedisError::String)
             }
         }
         "SET" => {
+            if argc < 4 || argc % 2 == 1 {
+                return Err(redis_module::RedisError::WrongArity);
+            }
             // Colle
```

**File**: `src/config.rs` (modified, +2/-2)
```diff
@@ -106,8 +106,8 @@ pub static CONFIGURATION_CMD_INFO: AtomicBool = AtomicBool::new(true);
 pub static MAX_INFO_QUERIES: AtomicI64 = AtomicI64::new(MAX_INFO_QUERIES_CAP);
 /// Whether graph teardown may happen off the calling thread. Settable at run-time as
 /// in C, but not yet read: this engine always frees off-thread (see
-/// `graph_core::graph_free`).
-pub static ASYNC_DELETE: AtomicI64 = AtomicI64::new(0);
+/// `graph_core::graph_free`), so it defaults to 1 — C's default, and what happens.
+pub static ASYNC_DELETE: AtomicI64 = AtomicI64::new(1);
 
 // ── Read-only runtime configs ──
 
```

**File**: `tests/flow/test_config.py` (modified, +46/-9)
```diff
@@ -349,19 +349,21 @@ def test11_set_get_node_creation_buffer(self):
         self.env.assertEqual(creation_buffer_size, expected_response)
 
     def test12_set_get_runtime_booleans(self):
-        """CMD_INFO and DELAY_INDEXING are settable at run-time, as in C"""
+        """CMD_INFO and DELAY_INDEXING are settable at run-time"""
 
         for config_name in ["CMD_INFO", "DELAY_INDEXING"]:
-            for value, expected in [("no", 0), ("yes", 1), ("0", 0), ("1", 1)]:
+            for value, expected in [("no", 0), ("yes", 1), ("NO", 0), ("Yes", 1)]:
                 self.env.assertEqual(self.db.config_set(config_name, value), "OK")
                 self.env.assertEqual(self.db.config_get(config_name), expected)
 
-            # a non-boolean value is rejected, leaving the config as it was
-            try:
-                self.db.config_set(config_name, "maybe")
-                assert(False)
-            except redis.ResponseError as e:
-                assert(("Failed to set config value %s to maybe" % config_name) in str(e))
+            # anything but yes/no is rejected,
+            # leaving the config as it was
+            for value in ["maybe", "1", "0", "true", "false"]:
+                try:
+                    self.db.config_set(config_name, value)
+                    assert(False)
+                except redis.ResponseError as e:
+                    assert(("Failed to set config value %s to %s" % (config_name, value)) in str(e))
             self.env.assertEqual(self.db.config_get(config_name), 1)
 
         # restore defaults for the tests that follow
@@ -373,7 +375,7 @@ def test13_set_get_max_info_queries(self):
         self.env.assertEqual(self.db.config_set("MAX_INFO_QUERIES", 42), "OK")
         self.env.assertEqual(self.db.config_get("MAX_INFO_QUERIES"), 42)
 
-        # above the cap the value is clamped, not rejected - as C's setter does
+        # above the cap the value is clamped, not rejected
         self.env.assertEqual(self.db.config_set("MAX_INFO_QUERIES", 99999), "OK")
         self.env.assertEqual(self.db.config_get("MAX_INFO_QUERIES"), 1000)
 
@@ -385,6 +387,41 @@ def test13_set_get_max_info_queries(self):
                 assert(("Failed to set config value MAX_INFO_QUERIES to %s" % invalid) in str(e))
         self.env.assertEqual(self.db.config_get("MAX_INFO_QUERIES"), 1000)
 
+    def test14_config_validation(self):
+        """GRAPH.CONFIG validates values, arity and names"""
+
+        # ASYNC_DELETE defaults to yes
+        self.env.assertEqual(self.db.config_get("ASYNC_DELETE"), 1)
+
+        prev_conf = self.redis_con.execute_command("GRAPH.CONFIG GET *")
+
+        def expect_error(args, err):
+            try:
+                self.redis_con.execute_command("GRAPH.CONFIG", *args)
+                self.env.assertTrue(False, message=str(args))
+            except redis.ResponseError as e:
+                self.env.assertContains(err, str(e))
+
+        expect_error(("SET", "VKEY_MAX_ENTITY_COUNT", "-5"),
+                     "Failed to set config value VKEY_MAX_ENTITY_COUNT to -5")
+        for name in ["JS_HEAP_SIZE", "JS_STACK_SIZE"]:
+            for value in ["5", "0", "-1", "1048575", "x"]:
+                expect_error(("SET", name, value), f"{name} must be at least 1MB (1048576)")
+
+        # arity: GET takes exactly one name, SET name/value pairs
+        expect_error(("GET", "TIMEOUT", "extra"), "wrong number of arguments")
+        expect_error(("SET", "TIMEOUT"), "wrong number of arguments")
+        expect_error(("SET", "TIMEOUT", "0", "RESULTSET_SIZE"), "wrong number of arguments")
+        expect_error(("GET",), "wrong number of arguments")
+
+        # names are ASCII case-insensitive only: a dotless i does not fold to I
+        expect_error(("GET", "tımeout"), "Unknown configuration field")
+        expect_error(("SET", "tımeout", "0"), "Unknown configuration field")
+        self.env.assertEqual(self.db.config_get("timeout"), self.db.config_get("TIMEOUT"))
+
+        # nothing changed
+        self.env.assertEqual(self.redis_con.execute_command("GRAPH.CONFIG GET *"), prev_conf)
+
 import stat
 import shutil
 import tempfile
```

---

### Incident Patch 3: `07e71294` (2026-10-05)
**Commit Message**: fix: clamp list.remove's span end instead of overflowing on a huge count (#2952)

normalized + count overflowed i64 for count near i64::MAX: a debug panic,
and a release result that was right only by accident of the wrap.
Saturate the add; the end is clamped to the list length anyway.

Closes #2926

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/runtime/functions/list.rs` (modified, +36/-8)
```diff
@@ -34,6 +34,25 @@ use crate::runtime::{
 use std::sync::Arc;
 use thin_vec::{ThinVec, thin_vec};
 
+/// The `start..end` span `list.remove(list, idx, count)` drops from a list of
+/// `len` elements: a negative `idx` counts from the end, and the span is
+/// clamped to the list. `None` (nothing removed) when `idx` is out of range
+/// or `count` is not positive.
+fn remove_span(
+    len: usize,
+    idx: i64,
+    count: i64,
+) -> Option<(usize, usize)> {
+    let len_i = len as i64;
+    let normalized = if idx < 0 { len_i + idx } else { idx };
+    if normalized < 0 || normalized >= len_i || count <= 0 {
+        return None;
+    }
+    // `normalized + count` can exceed `i64::MAX` for a huge `count`.
+    let end = (normalized.saturating_add(count) as usize).min(len);
+    Some((normalized as usize, end))
+}
+
 pub fn register(funcs: &mut Functions) {
     cypher_fn!(funcs, "size",
         args: [Type::union([
@@ -157,15 +176,9 @@ pub fn register(funcs: &mut Functions) {
                         None => 1,
                         _ => return Ok(Value::Null),
                     };
-                    let len = vs.len() as i64;
-                    // Normalize negative index
-                    let normalized = if idx < 0 { len + idx } else { idx };
-                    // Out of range or non-positive count: return original
-                    if normalized < 0 || normalized >= len || count <= 0 {
+                    let Some((start, end)) = remove_span(vs.len(), idx, count) else {
                         return Ok(Value::List(Arc::clone(vs)));
-                    }
-                    let start = normalized as usize;
-                    let end = ((normalized + count) as usize).min(vs.len());
+                    };
                     let mut result = ThinVec::with_capacity(vs.len() - (end - start));
                     result.extend_from_slice(&vs[..start]);
                     result.extend_from_slice(&vs[end..]);
@@ -342,3 +355,18 @@ pub fn register(funcs: &mut Functions) {
         }
     );
 }
+
+#[cfg(test)]
+mod tests {
+    use super::remove_span;
+
+    #[test]
+    fn remove_span_clamps_huge_count() {
+        assert_eq!(remove_span(3, 1, i64::MAX), Some((1, 3)));
+        assert_eq!(remove_span(3, -1, i64::MAX), Some((2, 3)));
+        assert_eq!(remove_span(3, 0, 2), Some((0, 2)));
+        assert_eq!(remove_span(3, 3, 1), None);
+        assert_eq!(remove_span(3, i64::MIN, 1), None);
+        assert_eq!(remove_span(3, 1, 0), None);
+    }
+}
```

---

### Incident Patch 4: `da6f808c` (2026-10-05)
**Commit Message**: build: replace graphblas.sh/redisearch.sh with a native-deps crate (#2695)

* build: replace graphblas.sh/redisearch.sh with a native-deps crate

GraphBLAS and LAGraph were not tracked by git at all -- graphblas.sh cloned
them at build time from a GRAPHBLAS_VERSION string, so nothing tied a build to
a reviewable commit and gen_prejit.sh had to grep the script to learn the
version. Add both as submodules alongside deps/RediSearch, so all three pins
are gitlinks, and replace both shell scripts with a native-deps crate that owns
the recipes and a content-addressed artifact cache.

The cache key covers everything the artifacts are ABI-tied to: the submodule
revision, the GB_control patch, the vendored PreJIT kernels, the recipe
sources, $CC/$CXX --version, the target triple and the OpenMP/sanitizer
flavour. Two consequences fall out of that:

  * graph/build.rs no longer sniffs RUSTFLAGS to guess whether an ASAN build is
    in progress. The sanitizer flavour is a key input, so the prefix it is
    handed is already the right one -- the variant-dir scan and pick(asan_build)
    heuristic are gone.
  * a compiler bump cannot silently reuse stale-ABI archives, which the old
    hashFiles

**File**: `.claude/skills/build/SKILL.md` (modified, +29/-8)
```diff
@@ -14,17 +14,38 @@ libraries (GraphBLAS and RediSearch) that must be compiled and installed
 
 Only needed once per machine/container (skip if `cargo build` already works).
 
+On macOS, point the build at Homebrew clang first: the system clang has no
+OpenMP, and GraphBLAS would build single-threaded without saying so.
+
 ```bash
-./graphblas.sh    # clones, builds (static, PIC) and installs GraphBLAS v10.5.0 + LAGraph
-git submodule update --init --recursive   # populates deps/RediSearch (git owns it)
-./redisearch.sh   # builds that checkout (static) into deps/RediSearch/bin
+export CC=$(brew --prefix llvm)/bin/clang
+export CXX=$(brew --prefix llvm)/bin/clang++
 ```
 
-If a script fails, read it before retrying by hand — `graphblas.sh` documents
-the exact `cmake` flags it uses (`-DGRAPHBLAS_COMPACT=OFF`,
-`-DCMAKE_POSITION_INDEPENDENT_CODE=ON`, static build, shared install prefix)
-and has a `--skip-graphblas` flag to reuse an already-installed
-`libgraphblas.a` while iterating on the LAGraph step.
+```bash
+git submodule update --init --recursive   # populates deps/{GraphBLAS,LAGraph,RediSearch}
+cargo build                               # graph/build.rs builds them via native-deps
+```
+
+`cargo build` builds whatever is missing, so this is usually all you need. To
+build them ahead of time, or to see what is happening:
+
+```bash
+cargo run --manifest-path native-deps/Cargo.toml
+```
+
+Results are cached at
+`${XDG_CACHE_HOME:-$HOME/.cache}/falkordb/native-deps/<dep>/<key>/`
+(`$FALKORDB_DEPS_CACHE` overrides the root), keyed on the submodule revision,
+the GB_control patch, the vendored PreJIT kernels, the recipe sources,
+`$CC`/`$CXX --version`, the target triple and the OpenMP/sanitizer flavour.
+
+If a build fails, `native-deps/src/recipes/<dep>.rs` documents the exact cmake
+flags (`-DGRAPHBLAS_COMPACT=OFF`, `-DCMAKE_POSITION_INDEPENDENT_CODE=ON`, static
+build). To build one dep only, name it, e.g. `... -- graphblas`; add
+`FALKORDB_NATIVE_DEPS_FORCE=1` to rebuild it even on a cache hit. A cache miss
+is diffable: each entry's
+`.stamp` records the full key manifest after a `--- manifest ---` marker.
 
 ## 2. Build
 
```

**File**: `.devcontainer/Dockerfile` (modified, +23/-18)
```diff
@@ -57,25 +57,30 @@ RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
 # Set working directory for build scripts
 WORKDIR /data
 
-# Copy build scripts, and the RediSearch submodule they build (git owns the pin;
-# redisearch.sh only builds what is checked out, so the source must be present)
-COPY graphblas.sh redisearch.sh /data/
-COPY deps/RediSearch /data/deps/RediSearch
-
-# Build and install GraphBLAS using project script
-RUN chmod +x graphblas.sh && \
-    CC=clang-23 CXX=clang++-23 ./graphblas.sh
+# Prebuild the three native deps so a fresh container can `cargo build` without
+# a 12-minute wait. native-deps owns the recipes and caches the results under
+# $HOME/.cache/falkordb/native-deps, keyed on the submodule revisions, the
+# GB_control patch, the vendored PreJIT kernels, $CC/$CXX and the OpenMP
+# flavour. CC/CXX are ENV rather than per-RUN because they are key inputs: the
+# key `cargo build` computes inside the container must match what is baked here.
+ENV CC=clang-23
+ENV CXX=clang++-23
+COPY native-deps           /data/native-deps
+COPY deps/native-deps.lock /data/deps/native-deps.lock
+COPY build/graphblas       /data/build/graphblas
+COPY deps/GraphBLAS        /data/deps/GraphBLAS
+COPY deps/LAGraph          /data/deps/LAGraph
+COPY deps/RediSearch       /data/deps/RediSearch
+RUN cd /data && \
+    FALKORDB_DEPS_CACHE=/opt/falkordb-deps \
+    cargo run --locked --manifest-path native-deps/Cargo.toml && \
+    rm -rf /data/native-deps /data/build /data/deps
 
-# Build and install RediSearch using project script
-# Build in /data so output lands at /data/deps/RediSearch/bin/, which is one of
-# graph/build.rs's absolute fallbacks -- no symlink needed.
-# RediSearch's redisearch_rs build scripts find their source root by walking up
-# for a `.git` entry (build_utils::git_root; existence check only, never invokes
-# git). All git metadata is .dockerignore'd, so create an empty marker -- see
-# .dockerignore for why this is a marker rather than the real gitlink.
-RUN mkdir -p /data/deps/RediSearch/.git && \
-    chmod +x redisearch.sh && \
-    ./redisearch.sh
+# Expose the baked deps as a read-only root, apart from the writable cache: the
+# developer's bind-mounted checkout resolves against them, so an untouched dep
+# is never rebuilt, and anything it does build goes to the default cache
+# instead of mutating what the image shipped.
+ENV FALKORDB_NATIVE_DEPS_PREBUILT=/opt/falkordb-deps
 
 WORKDIR /workspace
 
```

**File**: `.devcontainer/README.md` (modified, +4/-3)
```diff
@@ -9,9 +9,10 @@ The development container includes:
 - **Ubuntu 24.04** as the base image
 - **Redis server** installed via apt
 - **Rust toolchain** with all necessary components
-- **LLVM 21** with clang, clang++, llvm-cov, and llvm-profdata for building and code coverage
-- **GraphBLAS** (v10.5.0) compiled and installed using `graphblas.sh`
-- **RediSearch** with vector similarity support, built using `redisearch.sh`
+- **LLVM 23** with clang, clang++, llvm-cov, and llvm-profdata for building and code coverage
+- **GraphBLAS**, **LAGraph** and **RediSearch** (with vector
+  similarity support) prebuilt by the `native-deps` crate into its artifact
+  cache, so `cargo build` in the container links them without recompiling
 - **Python 3 virtual environment** at `/data/venv` with all test dependencies
 
 ## Usage
```

**File**: `.dockerignore` (modified, +15/-11)
```diff
@@ -1,13 +1,13 @@
 target/
-# Host-built native dep outputs that would shadow the build image's prebuilt versions
-# (graph/build.rs's link-search adds ../lagraph_lib and deps/RediSearch/... before /data paths).
-#
-# Only the OUTPUT is a hazard, not the source: deps/RediSearch/bin is ~2.2GB of
-# host-arch archives that a Linux image build must never link, while the source
-# it is built from is ~60MB and is exactly what the images now COPY in (git owns
-# the submodule; redisearch.sh no longer clones it).
-lagraph_lib/
+# Host-built native dep OUTPUT that a Linux image build must never link.
+# Only the output is a hazard, not the source: deps/RediSearch/bin is ~2.2GB of
+# host-arch archives, while the ~60MB source it is built from is exactly what
+# the dep stages COPY in (git owns the submodule; nothing clones it any more).
 deps/RediSearch/bin/
+deps/RediSearch/.install/
+# Trees the old graphblas.sh/redisearch.sh left in checkouts that predate the
+# submodules: never inputs, but a stale one would be sent with `COPY . .`.
+lagraph_lib/
 redisearch/
 # All git metadata, at any depth. A submodule's `.git` is normally a small
 # `gitdir:` pointer file, but one bootstrapped by an older redisearch.sh is a
@@ -18,9 +18,10 @@ redisearch/
 # RediSearch's redisearch_rs build scripts do need a `.git` ENTRY to exist:
 # build_utils::git_root walks up for one to locate the source root (an existence
 # check -- it never invokes git), and without it the ffi build script panics with
-# "Could not find git root". The Dockerfiles that build RediSearch create an
-# empty marker directory for that, which keeps it explicit and identical
-# everywhere instead of depending on what got copied in.
+# "Could not find git root". native-deps handles that itself in
+# recipes::ensure_git_root: it drops an empty marker directory for the duration
+# of the build and removes it afterwards, so every environment (Docker, CI and a
+# local checkout) behaves identically without the Dockerfiles knowing about it.
 .git/
 **/.git
 .github/
@@ -35,3 +36,6 @@ tests/flow/logs/
 *.profdata
 codecov.txt*
 .DS_Store
+
+# A stale restore journal names host paths; replaying it in a build would fail.
+deps/.native-deps/
```

**File**: `.github/codeql/codeql-config.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ queries:
   - uses: security-extended
 
 paths-ignore:
-  # Autogenerated by `gen_prejit.sh`, which harvests whatever SuiteSparse's
+  # Autogenerated by `native-deps prejit`, which harvests whatever SuiteSparse's
   # runtime JIT emitted inside the Linux toolchain image. CLAUDE.md forbids
   # hand-editing these files: a local edit desynchronises the kernel from the
   # `_query` hash GraphBLAS checks at load time, which makes GraphBLAS
```

**File**: `.github/workflows/_build-artifacts-macos.yml` (removed, +0/-158)
```diff
@@ -1,158 +0,0 @@
-# Reusable workflow: build the falkordb shared library natively on macOS arm64
-# and upload it as `falkordb-<suffix>.so`. Separate from _build-artifacts.yml
-# because hosted macOS runners have no Docker — this is a native cargo build,
-# not a `docker build --target artifact`. The produced Mach-O dylib is renamed
-# to the C-parity `.so` name (Redis loads modules by path, extension-agnostic).
-#
-# The build mirrors the proven native-macOS setup from #551 (brew toolchain +
-# the CC/CXX-driven graphblas.sh / redisearch.sh + static Homebrew libomp), but
-# only the artifact-producing steps — no test suites.
-
-name: Build artifacts macOS (reusable)
-
-on:
-  workflow_call:
-    inputs:
-      revision:
-        description: "Git revision (commit SHA) to check out and build"
-        required: true
-        type: string
-      trusted_revision:
-        description: >-
-          Whether `revision` is already-reviewed code (release tags, the default
-          branch, a maintainer dispatch). Defaults to FALSE — a caller must opt
-          in — so a caller that forwards a pull-request head is untrusted by
-          construction. Untrusted builds never WRITE a cache, which is what keeps
-          a PR build from poisoning the native deps / Rust artefacts a later
-          release build restores.
-        required: false
-        type: boolean
-        default: false
-      suffix:
-        description: "Asset suffix → falkordb-<suffix>.so"
-        required: false
-        type: string
-        default: "macos-arm64v8"
-
-jobs:
-  build:
-    runs-on: macos-14
-    timeout-minutes: 90
-    permissions:
-      contents: read
-    env:
-      # Static-link Homebrew libomp.a (keeps the .so self-contained for OpenMP,
-      # matching the Linux single-.so contract). graph/build.rs links static
-      # when ${LIBOMP_PREFIX}/lib/libomp.a exists.
-      LIBOMP_PREFIX: /opt/homebrew/opt/libomp
-      # Workspace-local GraphBLAS install (no sudo; cacheable). graphblas.sh
-      # reads GRAPHBLAS_INSTALL_PREFIX; build.rs reads GRAPHBLAS_LIB_DIR.
-      GRAPHBLAS_INSTALL_PREFIX: ${{ github.workspace }}/.deps/graphblas
-      GRAPHBLAS_LIB_DIR: ${{ github.workspace }}/.deps/graphblas/lib
-    steps:
-      # This job compiles caller-supplied code that may come from a pull request.
-      # `persist-credentials: false` keeps no GITHUB_TOKEN on disk, `permissions`
-      # is read-only, callers pass no secrets, and every cache WRITE below is
-      # gated on `trusted_revision` so an untrusted build cannot seed artefacts
-      # that a later release build restores.
-      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-        with:
-          # redisearch.sh builds the deps/RediSearch submodule and no longer
-          # clones it, so it must be checked out here.
-          submodules: recursive
-          ref: ${{ inputs.revision }}
-          persist-credentials: false
-
-      - name: Install Homebrew build deps
-        run: brew install cmake llvm libomp openssl@3
-
-      - name: Export Homebrew LLVM into PATH/CC/CXX
-        run: |
-          set -euo pipefail
-          LLVM_PREFIX="$(brew --prefix llvm)"
-          echo "${LLVM_PREFIX}/bin"             >> "$GITHUB_PATH"
-          echo "CC=${LLVM_PREFIX}/bin/clang"    >> "$GITHUB_ENV"
-          echo "CXX=${LLVM_PREFIX}/bin/clang++" >> "$GITHUB_ENV"
-          # Bust the native-deps cache when Homebrew LLVM moves (the C artefacts
-          # are ABI-tied to it).
-          echo "BREW_LLVM_VERSION=$(brew list --versions llvm | awk '{print $2}')" >> "$GITHUB_ENV"
-
-      - name: Install Rust stable
-        run: rustup default stable
-
-      - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
-        with:
-          shared-key: "macos-artifact-release"
-          # Untrusted revisions restore the cache but never save it.
-          save-if: ${{ inputs.trusted_revision }}
-
-      # Hosted macOS has no Docker toolchain image, so rebuild GraphBLAS +
-      # LAGraph + RediSearch from source and cache them (keyed on the build
-      # scripts + vendored PreJIT + the exact Homebrew LLVM version).
-      # The RediSearch pin used to ride along in hashFiles('redisearch.sh')
-      # (REDISEARCH_REF lived there). It is now only the submodule gitlink, which
-      # hashFiles cannot see and which hashing the 60MB checkout would be a silly
-      # way to reach -- so read the SHA and put it in the key directly.
-      - name: Resolve the deps/RediSearch pin
-        id: rs-pin
-        run: echo "sha=$(git rev-parse HEAD:deps/RediSearch)" >> "$GITHUB_OUTPUT"
-
-      - name: Restore GraphBLAS + RediSearch native builds
-        id: native-cache
-        uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v5
-        with:
-          path: |
-            .deps/graphblas
-            lagraph_lib
-            deps/RediSearch/bin
-          key: macos-native-deps-${{ runner.os
```

**File**: `.github/workflows/_build-artifacts.yml` (modified, +2/-2)
```diff
@@ -63,8 +63,8 @@ jobs:
       # on `cache-to` below.
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
-          # redisearch.sh builds the deps/RediSearch submodule and no longer
-          # clones it, and the Dockerfile COPYs that source in, so the build
+          # native-deps builds the submodules in-place and never clones them,
+          # and the Dockerfile COPYs that source in, so the build
           # context must carry it.
           submodules: recursive
           ref: ${{ inputs.revision }}
```

**File**: `.github/workflows/_build-flavour.yml` (modified, +2/-2)
```diff
@@ -97,8 +97,8 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
-          # redisearch.sh builds the deps/RediSearch submodule and no longer
-          # clones it, and the Dockerfile COPYs that source in, so the build
+          # native-deps builds the submodules in-place and never clones them,
+          # and the Dockerfile COPYs that source in, so the build
           # context must carry it.
           submodules: recursive
           ref: ${{ inputs.commit_sha }}
```

---

### Incident Patch 5: `557f1886` (2026-10-05)
**Commit Message**: fix: one C-compatible flag parser for QUERY/RO_QUERY/PROFILE/EXPLAIN (#3009) (#3010)

Arity 3..8, flags matched on the C string (non-UTF-8 is an unknown flag),
TIMEOUT/version read with string2ll and C's error messages; RO_QUERY,
PROFILE and EXPLAIN no longer ignore a bad or missing timeout.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/commands/explain.rs` (modified, +3/-1)
```diff
@@ -21,7 +21,7 @@
 use crate::dispatch::must_run_inline;
 use crate::query_session::QuerySession;
 use crate::{
-    commands::EMPTY_KEY_ERR,
+    commands::{EMPTY_KEY_ERR, query_args::parse_query_flags},
     graph_core::{BlockedClient, ThreadedGraph, ffi, up_to_nul},
     redis_type::GRAPH_TYPE,
 };
@@ -61,6 +61,8 @@ pub fn graph_explain(
     ctx: &Context,
     args: Vec<RedisString>,
 ) -> RedisResult {
+    // Flags are validated as C does; EXPLAIN itself reads none of them.
+    parse_query_flags(&args)?;
     let mut args = args.into_iter().skip(1);
     let key = args.next_arg()?;
     // C ends the query at its first NUL byte; see `up_to_nul`.
```

**File**: `src/commands/mod.rs` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ pub mod list;
 pub mod memory;
 pub mod profile;
 pub mod query;
+pub mod query_args;
 pub mod record;
 pub mod restore;
 pub mod ro_query;
```

**File**: `src/commands/profile.rs` (modified, +2/-10)
```diff
@@ -4,6 +4,7 @@
 //! per-operator statistics (records produced, execution time).
 
 use crate::{
+    commands::query_args::{QueryFlags, parse_query_flags},
     config::CONFIGURATION_CACHE_SIZE,
     graph_core::{
         ThreadedGraph, c_graph_key, c_graph_name, profile_mut, register_graph, up_to_nul,
@@ -18,20 +19,11 @@ pub fn graph_profile(
     ctx: &Context,
     args: Vec<RedisString>,
 ) -> RedisResult {
+    let QueryFlags { timeout, .. } = parse_query_flags(&args)?;
     let mut args = args.into_iter().skip(1);
     let key_str = args.next_arg()?;
     // C ends the query at its first NUL byte; see `up_to_nul`.
     let query = up_to_nul(args.next_str()?);
-    let mut timeout: Option<i64> = None;
-    while let Ok(arg) = args.next_str() {
-        // Matched case-insensitively, as the C dispatcher does with strcasecmp:
-        // `TIMEOUT` is the documented spelling.
-        if arg.eq_ignore_ascii_case("timeout")
-            && let Ok(t_str) = args.next_str()
-        {
-            timeout = t_str.parse::<i64>().ok();
-        }
-    }
 
     // The key the graph lives at, not C's name for it — see `graph_query`.
     let key_name: Arc<str> = Arc::from(key_str.to_string());
```

**File**: `src/commands/query.rs` (modified, +7/-20)
```diff
@@ -19,6 +19,7 @@
 //! `graph_core`.
 
 use crate::{
+    commands::query_args::{QueryFlags, parse_query_flags},
     config::CONFIGURATION_CACHE_SIZE,
     graph_core::{
         ThreadedGraph, c_graph_key, c_graph_name, query_mut, register_graph,
@@ -42,6 +43,12 @@ pub fn graph_query(
     ctx: &Context,
     args: Vec<RedisString>,
 ) -> RedisResult {
+    let QueryFlags {
+        compact,
+        track_memory,
+        timeout,
+        version: version_check,
+    } = parse_query_flags(&args)?;
     let mut args = args.into_iter().skip(1);
     let key_str = args.next_arg()?;
     // C ends the query at its first NUL byte; see `up_to_nul`.
@@ -54,26 +61,6 @@ pub fn graph_query(
         file.write_all(query.as_bytes())?;
     }
 
-    let mut compact = false;
-    let mut track_memory = false;
-    let mut version_check: Option<u64> = None;
-    let mut timeout: Option<i64> = None;
-    while let Ok(arg) = args.next_str() {
-        // Matched case-insensitively, as the C dispatcher does with strcasecmp:
-        // `TIMEOUT` is the documented spelling.
-        if arg.eq_ignore_ascii_case("--compact") {
-            compact = true;
-        } else if arg.eq_ignore_ascii_case("--track-memory") {
-            track_memory = true;
-        } else if arg.eq_ignore_ascii_case("version") {
-            let ver_str = args.next_str()?;
-            version_check = Some(ver_str.parse::<u64>()?);
-        } else if arg.eq_ignore_ascii_case("timeout") {
-            let t_str = args.next_str()?;
-            timeout = Some(t_str.parse::<i64>()?);
-        }
-    }
-
     // Try read-only key access first to avoid triggering WATCH on existing graphs.
     //
     // `key_name` is the *key* the graph lives at, not C's name for it: replication,
```

**File**: `src/commands/query_args.rs` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+//! Argument parsing shared by `GRAPH.QUERY`, `GRAPH.RO_QUERY`, `GRAPH.PROFILE` and
+//! `GRAPH.EXPLAIN`.
+//!
+//! ```text
+//! GRAPH.<CMD> key query [--compact] [TIMEOUT ms] [version v] [--track-memory]
+//! ```
+//!
+//! Mirrors C's `_validate_command_arity` + `_read_flags` (`cmd_dispatcher.c`), which
+//! all four commands go through:
+//! - 3 to 8 arguments (command name included), otherwise a wrong-arity error;
+//! - flags are matched ASCII case-insensitively on the bytes up to the first NUL
+//!   (C's `strcasecmp` on the C string), so a non-UTF-8 argument is just an
+//!   unknown flag, and unknown flags are skipped;
+//! - `TIMEOUT` and `version` values are read with Redis's `string2ll`: canonical
+//!   decimal only (no `+`, no leading zeros, no spaces). A missing, non-numeric or
+//!   negative timeout, or a version outside `0..=u32::MAX`, is an error.
+//!
+//! `--track-memory` is Rust-only.
+
+use crate::config::TIMEOUT_MAX;
+use redis_module::{RedisError, RedisString};
+use std::sync::atomic::Ordering;
+
+/// C's `_validate_command_arity` upper bound for the query commands.
+const MAX_ARGS: usize = 8;
+
+const TIMEOUT_ERR: &str = "Failed to parse query timeout value";
+const VERSION_ERR: &str = "Failed to parse graph version value";
+const TIMEOUT_MAX_ERR: &str =
+    "The query TIMEOUT parameter value cannot exceed the TIMEOUT_MAX configuration parameter value";
+
+/// Flags that follow the key and the query.
+#[derive(Default)]
+pub struct QueryFlags {
+    pub compact: bool,
+    pub track_memory: bool,
+    pub timeout: Option<i64>,
+    pub version: Option<u64>,
+}
+
+/// Checks the arity of a query command and parses its flags (`args[3..]`).
+///
+/// `args` is the full argument vector, command name included.
+pub fn parse_query_flags(args: &[RedisString]) -> Result<QueryFlags, RedisError> {
+    if args.len() < 3 || args.len() > MAX_ARGS {
+        return Err(RedisError::WrongArity);
+    }
+    let mut flags = QueryFlags::default();
+    let mut rest = args[3..].iter();
+    while let Some(arg) = rest.next() {
+        let arg = up_to_nul(arg.as_slice());
+        if arg.eq_ignore_ascii_case(b"--compact") {
+            flags.compact = true;
+        } else if arg.eq_ignore_ascii_case(b"--track-memory") {
+            flags.track_memory = true;
+        } else if arg.eq_ignore_ascii_case(b"timeout") {
+            let t = rest
+                .next()
+                .and_then(|v| v.parse_integer().ok())
+                .ok_or(RedisError::Str(TIMEOUT_ERR))?;
+            let max = TIMEOUT_MAX.load(Ordering::Relaxed);
+            if max > 0 && t > max {
+                return Err(RedisError::Str(TIMEOUT_MAX_ERR));
+            }
+            if t < 0 {
+                return Err(RedisError::Str(TIMEOUT_ERR));
+            }
+            flags.timeout = Some(t);
+        } else if arg.eq_ignore_ascii_case(b"version") {
+            let v = rest
+                .next()
+                .and_then(|v| v.parse_integer().ok())
+                .and_then(|v| u32::try_from(v).ok())
+                .ok_or(RedisError::Str(VERSION_ERR))?;
+            flags.version = Some(u64::from(v));
+        }
+    }
+    Ok(flags)
+}
+
+/// The bytes a C string built from `s` would hold.
+fn up_to_nul(s: &[u8]) -> &[u8] {
+    s.iter().position(|&b| b == 0).map_or(s, |end| &s[..end])
+}
```

**File**: `src/commands/ro_query.rs` (modified, +10/-21)
```diff
@@ -16,7 +16,10 @@
 //! non-mutating behavior.
 
 use crate::{
-    commands::EMPTY_KEY_ERR,
+    commands::{
+        EMPTY_KEY_ERR,
+        query_args::{QueryFlags, parse_query_flags},
+    },
     graph_core::{ThreadedGraph, query_mut, up_to_nul},
     redis_type::GRAPH_TYPE,
 };
@@ -28,30 +31,16 @@ pub fn graph_ro_query(
     ctx: &Context,
     args: Vec<RedisString>,
 ) -> RedisResult {
+    let QueryFlags {
+        compact,
+        track_memory,
+        timeout,
+        version: version_check,
+    } = parse_query_flags(&args)?;
     let mut args = args.into_iter().skip(1);
     let key = args.next_arg()?;
     // C ends the query at its first NUL byte; see `up_to_nul`.
     let query = up_to_nul(args.next_str()?);
-    let mut compact = false;
-    let mut track_memory = false;
-    let mut version_check: Option<u64> = None;
-    let mut timeout: Option<i64> = None;
-    while let Ok(arg) = args.next_str() {
-        // Matched case-insensitively, as the C dispatcher does with strcasecmp:
-        // `TIMEOUT` is the documented spelling.
-        if arg.eq_ignore_ascii_case("--compact") {
-            compact = true;
-        } else if arg.eq_ignore_ascii_case("--track-memory") {
-            track_memory = true;
-        } else if arg.eq_ignore_ascii_case("version") {
-            let ver_str = args.next_str()?;
-            version_check = Some(ver_str.parse::<u64>()?);
-        } else if arg.eq_ignore_ascii_case("timeout")
-            && let Ok(t_str) = args.next_str()
-        {
-            timeout = t_str.parse::<i64>().ok();
-        }
-    }
 
     // The key the graph lives at, not C's name for it — see `graph_query`. A read-only
     // query never creates one, so it is always the key the command named.
```

**File**: `tests/flow/test_query_validation.py` (modified, +33/-0)
```diff
@@ -199,6 +199,39 @@ def test17_query_arity(self):
             assert("wrong number of arguments" in str(e))
             pass
 
+    # QUERY, RO_QUERY, PROFILE and EXPLAIN share C's flag parser
+    def test17b_query_flags(self):
+        cmds = ["GRAPH.QUERY", "GRAPH.RO_QUERY", "GRAPH.PROFILE", "GRAPH.EXPLAIN"]
+        bad = [
+            (("TIMEOUT", "-5"), "Failed to parse query timeout value"),
+            (("TIMEOUT", "+10"), "Failed to parse query timeout value"),
+            (("TIMEOUT", "010"), "Failed to parse query timeout value"),
+            (("TIMEOUT", "abc"), "Failed to parse query timeout value"),
+            (("TIMEOUT",), "Failed to parse query timeout value"),
+            (("version", "4294967296"), "Failed to parse graph version value"),
+            (("version", "-1"), "Failed to parse graph version value"),
+            (("version",), "Failed to parse graph version value"),
+            # at most 8 arguments, command name included
+            (("a", "b", "c", "d", "e", "f"), "wrong number of arguments"),
+        ]
+        for cmd in cmds:
+            for flags, err in bad:
+                try:
+                    self.redis_con.execute_command(cmd, GRAPH_ID, "RETURN 1", *flags)
+                    self.env.assertTrue(False, message=f"{cmd} {flags}")
+                except redis.ResponseError as e:
+                    self.env.assertContains(err, str(e))
+
+            # valid flags, unknown ones skipped
+            for flags in [("TIMEOUT", "0"), ("timeout", "10"), ("a", "b", "c", "d", "e")]:
+                self.redis_con.execute_command(cmd, GRAPH_ID, "RETURN 1", *flags)
+
+        # a non-UTF-8 argument is an unknown flag, not the end of the flags
+        for cmd in ["GRAPH.QUERY", "GRAPH.RO_QUERY"]:
+            res = self.redis_con.execute_command(cmd, GRAPH_ID, "RETURN 1", b"\xff", "--compact")
+            # compact header: [[type, name]]
+            self.env.assertEqual(res[0], [[1, "1"]])
+
     # Run queries in which compile-time variables are accessed but not defined.
     def test18_undefined_variable_access(self):
         try:
```

---

### Incident Patch 6: `648b41c5` (2026-10-05)
**Commit Message**: fix: reject coalesce() with zero arguments like C (#2956) (#2990)

GraphFn::validate did no arity check for variadic functions. Built-in
variadics (coalesce, indegree, outdegree) now need at least one
argument, with C's message; UDFs are unchanged.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/runtime/functions/mod.rs` (modified, +8/-0)
```diff
@@ -810,6 +810,14 @@ impl GraphFn {
                     ));
                 }
             }
+            // Every built-in variadic (coalesce, indegree, outdegree) needs at
+            // least one argument, as in C; UDFs take any number.
+            FnArguments::VarLength(_) if args == 0 && !matches!(self.fn_type, FnType::Udf) => {
+                return Err(format!(
+                    "Received 0 arguments to function '{}', expected at least 1",
+                    self.name
+                ));
+            }
             FnArguments::VarLength(_) => {}
         }
         Ok(())
```

**File**: `tests/flow/test_function_calls.py` (modified, +7/-0)
```diff
@@ -2104,6 +2104,13 @@ def test82_Coalesce(self):
         }
         for query, expected_result in query_to_expected_result.items():
             self.get_res_and_assertEquals(query, expected_result)
+
+        # coalesce needs at least one argument, as in C
+        try:
+            self.graph.query("RETURN coalesce()")
+            self.env.assertFalse(True)
+        except ResponseError as e:
+            self.env.assertIn("Received 0 arguments to function 'coalesce', expected at least 1", str(e))
     
     def test83_Replace(self):
         query_to_expected_result = {
```

---

### Incident Patch 7: `ac5c27b7` (2026-10-05)
**Commit Message**: fix: toInteger of an integer string below i64::MIN is null, not i64::MIN (#2955) (#2989)

A plain integer string that fails the i64 parse was retried as f64,
where everything in [-2^63-1024, -2^63-1] rounds to exactly -2^63 and
passed the strict range check. Return null for out-of-range integer
strings, like C; fractional/exponent strings keep the float path.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/runtime/functions/conversion.rs` (modified, +7/-0)
```diff
@@ -50,6 +50,13 @@ pub fn register(funcs: &mut Functions) {
                     if let Ok(i) = s.parse::<i64>() {
                         return Ok(Value::Int(i));
                     }
+                    // A plain integer that didn't parse is out of i64 range. Don't
+                    // retry it as f64: everything in [-2^63-1024, -2^63-1] rounds
+                    // to exactly -2^63 and would pass the range check below.
+                    let digits = s.strip_prefix(['-', '+']).unwrap_or(s);
+                    if !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) {
+                        return Ok(Value::Null);
+                    }
                     match s.parse::<f64>() {
                         Ok(f) if f.is_finite() => {
                             let floored = f.floor();
```

**File**: `tests/flow/test_function_calls.py` (modified, +5/-0)
```diff
@@ -698,6 +698,11 @@ def test23_toInteger(self):
             """RETURN toInteger('')""",
             """RETURN toInteger('18446744073709551616')""",
             """RETURN toInteger('-18446744073709551616')""",
+            # just below i64::MIN: the f64 fallback used to round these to -2^63
+            """RETURN toInteger('-9223372036854775809')""",
+            """RETURN toInteger('-9223372036854776832')""",
+            """RETURN toInteger('9223372036854775808')""",
+            """RETURN toIntegerList(['-9223372036854775809'])[0]""",
         ]
         for query in queries:
             actual_result = self.graph.query(query)
```

---

### Incident Patch 8: `89d68334` (2026-10-05)
**Commit Message**: fix: clamp k in vector KNN queries instead of allocating k entries (#3088)

* fix: clamp k in vector KNN queries instead of allocating k entries (#3085)

vector_query_nodes/vector_query_edges sized their output with
Vec::with_capacity(k) from the user-supplied k, which aborted the server
for huge k, and passed k unclamped to the KNN query, which returned no
rows near i64::MAX. Size the output by the results and clamp k to the
entity count, an upper bound on the index size.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix: use node_count()/relationship_count() after merging main

#2846 made the entity counters on Graph methods backed by IdSpace; the
merge with main left the KNN k clamp reading the old fields.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/graph/graph.rs` (modified, +12/-4)
```diff
@@ -3875,20 +3875,25 @@ impl Graph {
         }
         let metric = self.node_indexer.get_vector_metric(label, &attr);
         let query_vec = Arc::clone(&vector);
+        // `k` is user input. The index cannot hold more documents than there are
+        // nodes, and a `k` far beyond that makes the KNN query return nothing.
+        let k = k.min(self.node_count().max(1) as usize);
         let raw_iter = self.node_indexer.vector_query(label, field, vector, k)?;
 
         // Resolve the attribute name to its numeric slot once, rather than
         // re-hashing the attribute string for every KNN result. If the
         // attribute is unknown there are no vectors to score.
-        let mut out: Vec<(NodeId, f64)> = Vec::with_capacity(k);
         let Some(attr_idx) = self.get_node_attribute_id(&attr).map(|i| i as u16) else {
-            return Ok(out.into_iter());
+            return Ok(Vec::new().into_iter());
         };
         // Collect the candidate ids first, then fetch their vectors in one
         // fused batch pass. This amortizes the per-shard read lock and gives
         // the attribute cache sequential access instead of one isolated
         // lookup per KNN result.
         let node_ids: Vec<NodeId> = raw_iter.map(|(id, _score)| NodeId(id)).collect();
+        // Sized by the results, not by `k`: `k` is user input and may be far
+        // larger than the index (an allocation of `k` entries aborts the server).
+        let mut out: Vec<(NodeId, f64)> = Vec::with_capacity(node_ids.len());
         let mut vecs: Vec<Value> = Vec::with_capacity(node_ids.len());
         self.get_node_attributes_by_idx(&node_ids, attr_idx, &Value::Null, &mut vecs);
         for (node_id, entity) in node_ids.into_iter().zip(vecs) {
@@ -3930,21 +3935,24 @@ impl Graph {
         }
         let metric = self.edge_indexer.get_vector_metric(label, &attr);
         let query_vec = Arc::clone(&vector);
+        // Clamp the user-supplied `k` to the index's capacity (see `vector_query_nodes`).
+        let k = k.min(self.relationship_count().max(1) as usize);
         let raw_iter = self
             .edge_indexer
             .vector_query_edges(label, field, vector, k)?;
 
         // Resolve the attribute slot once instead of per KNN result.
-        let mut out: Vec<(NodeId, NodeId, RelationshipId, f64)> = Vec::with_capacity(k);
         let Some(attr_idx) = self.get_relationship_attribute_id(&attr).map(|i| i as u16) else {
-            return Ok(out.into_iter());
+            return Ok(Vec::new().into_iter());
         };
         // Collect candidate triples first, then fetch their vectors in one
         // fused batch pass (see `vector_query_nodes`).
         let triples: Vec<(NodeId, NodeId, RelationshipId)> = raw_iter
             .map(|(src, dst, eid, _score)| (NodeId(src), NodeId(dst), RelationshipId(eid)))
             .collect();
         let edge_ids: Vec<RelationshipId> = triples.iter().map(|&(_, _, eid)| eid).collect();
+        // Sized by the results, not by the user-supplied `k` (see `vector_query_nodes`).
+        let mut out: Vec<(NodeId, NodeId, RelationshipId, f64)> = Vec::with_capacity(triples.len());
         let mut vecs: Vec<Value> = Vec::with_capacity(edge_ids.len());
         self.get_relationship_attributes_by_idx(&edge_ids, attr_idx, &Value::Null, &mut vecs);
         for ((src, dst, edge_id), entity) in triples.into_iter().zip(vecs) {
```

**File**: `tests/flow/test_vecsim.py` (modified, +10/-0)
```diff
@@ -344,3 +344,13 @@ def test11_vector_index_without_dimension_keeps_other_indexes(self):
             self.env.assertIn("Node By Index Scan", str(g.explain(q, {'name': name})))
             res = g.ro_query(q, {'name': name}).result_set
             self.env.assertEqual(res, [[name]])
+
+    def test12_huge_k_is_clamped(self):
+        # regression: k far larger than the index used to size an allocation by
+        # k (crashing the server) or make the KNN query return nothing.
+        for k in [1000000000000000, 9223372036854775807]:
+            res = query_node_vector_index(self.graph, "Person", "embeddings", k, [50, 50])
+            self.env.assertEqual(len(res.result_set), 1001)
+            res = query_edge_vector_index(self.graph, "Points", "embeddings", k, [50, 50])
+            self.env.assertGreater(len(res.result_set), 0)
+        self.env.assertTrue(self.conn.ping())
```

---

### Incident Patch 9: `49f698d2` (2026-10-05)
**Commit Message**: fix: a wrong-dimension vector no longer drops the entity from every index on its label (#3087)

* fix: skip a wrong-dimension vector instead of dropping the entity from every index (#3075)

Document::set added any VecF32 to a vector field regardless of the
index's dimension. RediSearch rejects the whole document then, so the
entity vanished from the label's range and fulltext indexes too. Skip
the vector field on a dimension mismatch, as C does.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix: skip the vector when the field's dimension is unknown (#3075)

A vector field without vector options (CREATE VECTOR INDEX with no
OPTIONS) or with dimension 0 is created in RediSearch without vector
params. The guard let a vector through in that case, and RediSearch
rejected the whole document, dropping the entity from the label's range
index too. Require known, non-zero, matching options before adding the
vector.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/index/mod.rs` (modified, +14/-2)
```diff
@@ -719,9 +719,21 @@ impl Document {
         value: &Value,
     ) {
         unsafe {
-            // Vector fields only accept VecF32 values; skip everything else.
+            // Vector fields only accept VecF32 values of the index's dimension;
+            // skip everything else, including a field whose dimension is unknown
+            // (no vector options, or dimension 0): such a field is created in
+            // RediSearch without vector params. RediSearch rejects a whole
+            // document whose vector it cannot index, so adding it would drop the
+            // entity from every other index on the label too (C skips it the
+            // same way: `index.c` "vector dimension mis-match, can't index this
+            // vector").
             if field.ty == IndexType::Vector {
-                if let Value::VecF32(vec) = value {
+                if let Value::VecF32(vec) = value
+                    && field
+                        .vector_options
+                        .as_ref()
+                        .is_some_and(|o| o.dimension != 0 && o.dimension == vec.len() as u64)
+                {
                     RediSearch_DocumentAddFieldVector(
                         self.rs_doc,
                         field.name.as_ptr().cast::<c_char>(),
```

**File**: `tests/flow/test_vecsim.py` (modified, +52/-0)
```diff
@@ -292,3 +292,55 @@ def knn_tags(q, k=1):
         g.query("CREATE (:DUser {tag: 'B', emb: vecf32($v)})", params={'v': v})
         self.env.assertEqual(knn_tags(v), ['B'])
 
+
+    def test10_wrong_dimension_vector_keeps_other_indexes(self):
+        # regression: a vector whose dimension differs from the index's is not
+        # indexed, but the entity must stay in every other index on its label
+        # (RediSearch rejects the whole document if the vector is added).
+        g = Graph(self.conn, "vecsim_wrong_dim")
+
+        # pre-existing entity, indexed by background population
+        g.query("CREATE (:WUser {name: 'old', emb: vecf32([1,2,3])})")
+        create_node_range_index(g, "WUser", "name")
+        g.create_node_vector_index("WUser", "emb", dim=2,
+                                   similarity_function="euclidean")
+        wait_for_indices_to_sync(g)
+
+        # entities indexed on write: wrong dimension, then a good one
+        g.query("CREATE (:WUser {name: 'new', emb: vecf32([1,2,3])})")
+        g.query("CREATE (:WUser {name: 'good', emb: vecf32([1,2])})")
+        # updating the wrong-dimension vector re-indexes the entity
+        g.query("MATCH (u:WUser {name: 'old'}) SET u.emb = vecf32([4,5,6])")
+
+        for name in ['old', 'new', 'good']:
+            q = "MATCH (u:WUser) WHERE u.name = $name RETURN u.name"
+            self.env.assertIn("Node By Index Scan", str(g.explain(q, {'name': name})))
+            res = g.ro_query(q, {'name': name}).result_set
+            self.env.assertEqual(res, [[name]])
+
+        # only the vector of the index's dimension is in the vector index
+        res = query_node_vector_index(g, "WUser", "emb", 10, [1, 2]).result_set
+        self.env.assertEqual([row[0].properties['name'] for row in res], ['good'])
+
+    def test11_vector_index_without_dimension_keeps_other_indexes(self):
+        # regression: a vector field created without a dimension has no vector
+        # params in RediSearch; adding a vector to it must not drop the entity
+        # from the label's other indexes.
+        g = Graph(self.conn, "vecsim_no_dim")
+
+        g.query("CREATE (:NUser {name: 'old', emb: vecf32([1,2,3])})")
+        create_node_range_index(g, "NUser", "name")
+        try:
+            # may be refused (no dimension); what matters is the range index
+            g.query("CREATE VECTOR INDEX FOR (n:NUser) ON (n.emb)")
+        except ResponseError:
+            pass
+        wait_for_indices_to_sync(g)
+
+        g.query("CREATE (:NUser {name: 'new', emb: vecf32([1,2,3])})")
+
+        for name in ['old', 'new']:
+            q = "MATCH (u:NUser) WHERE u.name = $name RETURN u.name"
+            self.env.assertIn("Node By Index Scan", str(g.explain(q, {'name': name})))
+            res = g.ro_query(q, {'name': name}).result_set
+            self.env.assertEqual(res, [[name]])
```

---

### Incident Patch 10: `fe619ac5` (2026-10-04)
**Commit Message**: fix: refuse GRAPH.EFFECT ids no matrix can hold before sizing to them (#2911)

`IdSpace::record_created` only refused `u64::MAX`, and the create it guards
sizes every matrix to the id before `verify` can call it a hole. A client
`GRAPH.EFFECT` creating node or edge id 2^60 - 1 or above failed an assert in
`GrB_Matrix_new` and killed the server; `u64::MAX - 1` wrapped `grow_cap` into
an infinite loop.

`record_created` now refuses any id at or above `GrB_INDEX_MAX`, for nodes and
relationships alike, and `grow_cap` uses checked arithmetic and stops at
`GrB_INDEX_MAX` instead of wrapping.

Closes #2892

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/graph/graph.rs` (modified, +39/-3)
```diff
@@ -90,7 +90,7 @@ use crate::{
         graphblas::{
             matrix::{Descriptor, Dup, Matrix},
             serialization::{Encode, EncodeState, PayloadEntry, Writer},
-            tensor::Tensor,
+            tensor::{GrB_INDEX_MAX, Tensor},
             versioned_matrix::{self, VersionedMatrix},
         },
         id_space::{IdSpace, IdSpaceError},
@@ -762,13 +762,23 @@ pub static NODE_CREATION_BUFFER: AtomicU64 = AtomicU64::new(DEFAULT_NODE_CREATIO
 /// bounds that slop while keeping resizes rare: each resize triggers
 /// GraphBLAS format conversions costing O(entries), so smaller growth
 /// steps measurably slow bulk inserts.
+///
+/// Never past `GrB_INDEX_MAX`, the largest dimension GraphBLAS accepts. The
+/// step is checked rather than wrapped: near the top of `u64` the unchecked
+/// `cap + cap / 4` wrapped, and because `cap` stays a multiple of the chunk it
+/// never reached `needed` again — an infinite loop in release. Ids that large
+/// are refused before they get here (`IdSpace::create`), so the clamp
+/// is what keeps a caller that forgets from hanging instead of failing. #2892.
 fn grow_cap(
     mut cap: u64,
     needed: u64,
 ) -> u64 {
     let chunk = NODE_CREATION_BUFFER.load(Ordering::Relaxed);
-    while needed > cap {
-        cap = (cap + (cap / 4).max(chunk)).next_multiple_of(chunk);
+    while needed > cap && cap < GrB_INDEX_MAX {
+        cap = cap
+            .checked_add((cap / 4).max(chunk))
+            .and_then(|c| c.checked_next_multiple_of(chunk))
+            .map_or(GrB_INDEX_MAX, |c| c.min(GrB_INDEX_MAX));
     }
     cap
 }
@@ -5302,3 +5312,29 @@ mod adjacency_cascade_tests {
         assert!(adjacency_entries(&g).is_empty());
     }
 }
+
+#[cfg(test)]
+mod grow_cap_tests {
+    use super::*;
+
+    /// #2892. Near the top of `u64` the unchecked step wrapped, and since the
+    /// capacity stays a multiple of the chunk it never reached `needed` — the
+    /// loop spun forever in release. It now stops at the largest dimension
+    /// GraphBLAS accepts.
+    #[test]
+    fn growth_stops_at_the_largest_graphblas_dimension() {
+        let chunk = NODE_CREATION_BUFFER.load(Ordering::Relaxed);
+        assert_eq!(grow_cap(chunk, u64::MAX - 1), GrB_INDEX_MAX);
+        assert_eq!(grow_cap(chunk, GrB_INDEX_MAX), GrB_INDEX_MAX);
+        assert_eq!(grow_cap(GrB_INDEX_MAX - 1, GrB_INDEX_MAX), GrB_INDEX_MAX);
+    }
+
+    #[test]
+    fn ordinary_growth_is_unchanged() {
+        let chunk = NODE_CREATION_BUFFER.load(Ordering::Relaxed);
+        assert_eq!(grow_cap(chunk, chunk), chunk);
+        assert_eq!(grow_cap(chunk, chunk + 1), 2 * chunk);
+        let cap = 100 * chunk;
+        assert_eq!(grow_cap(cap, cap + 1), cap + cap / 4);
+    }
+}
```

**File**: `graph/src/graph/id_space.rs` (modified, +52/-7)
```diff
@@ -82,6 +82,18 @@
 use roaring::RoaringTreemap;
 use thiserror::Error;
 
+use crate::graph::graphblas::tensor::GrB_INDEX_MAX;
+
+/// One past the highest id a batch may create.
+///
+/// Every id is a row of the graph's matrices, and GraphBLAS refuses a dimension
+/// past `GrB_INDEX_MAX`: creating id `n` sizes them to at least `n + 1` rows, so
+/// the highest creatable id is one below it. Refused by [`IdSpace::create`],
+/// because the caller sizes the matrices before [`IdSpace::verify`] ever runs —
+/// an id past this used to fail an `assert` inside `GrB_Matrix_new` and take the
+/// process with it, and `u64::MAX - 1` looped forever in `grow_cap`. #2892.
+pub(crate) const ID_LIMIT: u64 = GrB_INDEX_MAX;
+
 /// Why a batch of ids does not describe a possible id space.
 #[derive(Debug, Clone, PartialEq, Eq, Error)]
 pub enum IdSpaceError {
@@ -132,7 +144,7 @@ pub enum IdSpaceError {
     #[error("{0} was already taken by this batch")]
     AlreadyTaken(u64),
 
-    /// A batch named `u64::MAX`, which has no boundary above it.
+    /// A batch named an id at or above [`ID_LIMIT`], which no matrix can hold.
     #[error("{0} is past the end of the id space")]
     IdOutOfRange(u64),
 }
@@ -526,15 +538,16 @@ impl IdSpace {
     /// [`IdSpaceError::AlreadyLive`] for the lowest id that is already live —
     /// either handed out before the batch, or claimed earlier within it.
     ///
-    /// [`IdSpaceError::IdOutOfRange`] for `u64::MAX`. Nothing can be allocated
-    /// above it, and letting it through would wrap the arithmetic in
-    /// [`Self::verify`].
+    /// [`IdSpaceError::IdOutOfRange`] for the highest id at or above
+    /// [`ID_LIMIT`]. No matrix can be sized to hold it, and the caller sizes
+    /// them as soon as this returns, so it has to be refused here rather than
+    /// left to [`Self::verify`] to call a hole.
     pub fn create(
         &mut self,
         nodes: &RoaringTreemap,
     ) -> Result<(), IdSpaceError> {
-        if nodes.contains(u64::MAX) {
-            return Err(IdSpaceError::IdOutOfRange(u64::MAX));
+        if let Some(id) = nodes.max().filter(|&id| id >= ID_LIMIT) {
+            return Err(IdSpaceError::IdOutOfRange(id));
         }
 
         // What is not free: the only ids either check can object to.
@@ -712,7 +725,7 @@ impl IdSpace {
 }
 #[cfg(test)]
 mod tests {
-    use super::{IdSpace, IdSpaceError};
+    use super::{ID_LIMIT, IdSpace, IdSpaceError};
     use crate::graph::graph::{Graph, NodeOpError};
     use crate::graph::graphblas::test_init::ensure_init;
     use roaring::RoaringTreemap;
@@ -1059,6 +1072,38 @@ mod tests {
         );
     }
 
+    /// #2892. Every id at or above `ID_LIMIT` is refused before the create
+    /// sizes a matrix to it, and leaves the graph as it was. `2^60 - 1` and up
+    /// used to fail an assert in `GrB_Matrix_new`, and `u64::MAX - 1` looped
+    /// forever in `grow_cap`.
+    #[test]
+    fn an_id_no_matrix_can_hold_is_refused_before_anything_is_sized() {
+        for id in [ID_LIMIT, ID_LIMIT + 1, 1 << 61, u64::MAX - 1] {
+            let mut g = graph();
+            g.roll_id_batches().expect("a consistent space");
+            let err = create(&mut g, &ids(&[0, id])).expect_err("not creatable");
+            assert_eq!(err, NodeOpError::node(IdSpaceError::IdOutOfRange(id)));
+            assert_eq!(g.node_count(), 0, "a refused create must record nothing");
+        }
+    }
+
+    /// The other side of the boundary: the highest id a matrix can hold a row
+    /// for gets as far as `verify`, which calls it the hole it is.
+    #[test]
+    fn the_highest_creatable_id_reaches_verify() {
+        let mut g = graph();
+        g.roll_id_batches().expect("a consistent space");
+        create(&mut g, &ids(&[ID_LIMIT - 1])).expect("a matrix can hold it");
+        assert_eq!(
+            g.node_id_space().verify(),
+            Err(IdSpaceError::Hole {
+                entry_bound: 0,
+                highest: ID_LIMIT - 1,
+                created: 1,
+            })
+        );
+    }
+
     /// `release` frees what the caller resolved, not what it was handed. The
     /// two sets differ on the relationship side, where `delete_relationships`
     /// skips ids it cannot resolve to a type and both endpoints.
```

**File**: `tests/flow/test_effects_wire.py` (modified, +63/-0)
```diff
@@ -258,6 +258,69 @@ def test07_a_client_cannot_send_an_effect_to_a_replica_at_all(self):
         except ResponseError as e:
             self.env.assertContains("read only replica", str(e))
 
+    @staticmethod
+    def _single_id_list(id):
+        """An `IdList` of one id: `u32 n_segments · Range{base: id, len: 1}`.
+
+        Header `0x0c` is kind Range, an 8-byte value and a 1-byte count, so any
+        u64 fits without working out its narrowest width."""
+        return (b"\x01\x00\x00\x00" + b"\x0c"
+                + int(id).to_bytes(8, "little") + b"\x01")
+
+    @classmethod
+    def _create_node_record(cls, id):
+        """`3 CREATE_NODE` — `count · LabelSet · AttrIds · IdList · AttrValues`,
+        with no labels and no attributes."""
+        return (b"\x03\x00\x00\x00" + b"\x01\x00\x00\x00"  # opcode, count 1
+                + b"\x00\x00" + b"\x00\x00"                # no labels, no attrs
+                + cls._single_id_list(id))
+
+    @classmethod
+    def _create_edge_record(cls, id, relation_id, src, dst):
+        """`4 CREATE_EDGE` — `count · RelType · AttrIds · IdList · IdList(src)
+        · IdList(dst) · AttrValues`, with no attributes."""
+        return (b"\x04\x00\x00\x00" + b"\x01\x00\x00\x00"  # opcode, count 1
+                + int(relation_id).to_bytes(4, "little")
+                + b"\x00\x00"                              # no attrs
+                + cls._single_id_list(id)
+                + cls._single_id_list(src)
+                + cls._single_id_list(dst))
+
+    def test08_an_id_past_the_end_of_the_id_space_is_refused(self):
+        # #2892. These ids used to be admitted by `IdSpace::create` and sized
+        # into the matrices before `verify` could call them a hole: 2^60 - 1
+        # and up failed an assert in `GrB_Matrix_new` and killed the server,
+        # and u64::MAX - 1 wrapped `grow_cap` into an infinite loop. The
+        # boundary is GrB_INDEX_MAX = 2^60 - 1: creating id n sizes the
+        # matrices to n + 1 rows, and no matrix can have more than that.
+        key = "effects_huge_ids"
+        g = Graph(self.master, key)
+        g.query("CREATE (:A)-[:R]->(:A)")
+        self.wait_for_replica_offset()
+        full_before = self.master.info()["sync_full"]
+
+        huge = [(1 << 60) - 1, 1 << 60, 1 << 61, (1 << 64) - 2, (1 << 64) - 1]
+        for id in huge:
+            msg = self._refused(b"\x03\x00" + self._create_node_record(id),
+                                f"a node with id {id}", key)
+            self.env.assertContains("past the end of the id space", msg)
+            # `R` is relationship type 0, and nodes 0 and 1 exist, so the
+            # edge id is the only thing wrong with this record.
+            msg = self._refused(
+                b"\x03\x00" + self._create_edge_record(id, 0, 0, 1),
+                f"an edge with id {id}", key)
+            self.env.assertContains("past the end of the id space", msg)
+
+        self._still_healthy(full_before)
+        # Nothing was applied, and the graph still takes a write.
+        self.env.assertEqual(
+            g.ro_query("MATCH (n) RETURN count(n)").result_set, [[2]])
+        self.env.assertEqual(
+            g.ro_query("MATCH ()-[r]->() RETURN count(r)").result_set, [[1]])
+        g.query("MATCH (a:A) CREATE (a)-[:R]->(:A)")
+        self.env.assertEqual(
+            g.ro_query("MATCH ()-[r]->() RETURN count(r)").result_set, [[3]])
+
 
 #-----------------------------------------------------------------------------
 # 6. compression must be transparent
```

---

### Incident Patch 11: `bb62bb07` (2026-10-04)
**Commit Message**: chore(deps): update rltest requirement (#3130)

Updates the requirements on [rltest](https://github.com/RedisLabsModules/RLTest) to permit the latest version.

Updates `rltest` to 0.7.29
- [Release notes](https://github.com/RedisLabsModules/RLTest/releases)
- [Commits](https://github.com/RedisLabsModules/RLTest/compare/v0.7.28...v0.7.29)

---
updated-dependencies:
- dependency-name: rltest
  dependency-version: 0.7.29
  dependency-type: direct:production
  dependency-group: python-test-deps
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Dvir Dukhan <[REDACTED_EMAIL]>

**File**: `tests/requirements.txt` (modified, +1/-1)
```diff
@@ -16,4 +16,4 @@ hypothesis
 pytest
 textual
 textual-dev
-RLTest>=0.7.28
\ No newline at end of file
+RLTest>=0.7.29
\ No newline at end of file
```

---

### Incident Patch 12: `6dea6e7b` (2026-10-04)
**Commit Message**: fix: GRAPH.MEMORY accepts SAMPLES 0; GRAPH.CONSTRAINT parses entity type and count as C (#3052) (#3053)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `src/commands/constraint.rs` (modified, +8/-9)
```diff
@@ -424,7 +424,7 @@ pub fn graph_constraint(
 
     // Operation: CREATE or DROP
     let op_str = args.next_str()?;
-    let is_create = match op_str.to_uppercase().as_str() {
+    let is_create = match op_str.to_ascii_uppercase().as_str() {
         "CREATE" => true,
         "DROP" => false,
         _ => {
@@ -439,7 +439,7 @@ pub fn graph_constraint(
 
     // Constraint type
     let ct_str = args.next_str()?;
-    let ct = match ct_str.to_uppercase().as_str() {
+    let ct = match ct_str.to_ascii_uppercase().as_str() {
         "UNIQUE" => ConstraintType::Unique,
         "MANDATORY" => ConstraintType::Mandatory,
         _ => {
@@ -451,9 +451,9 @@ pub fn graph_constraint(
 
     // Entity type
     let et_str = args.next_str()?;
-    let entity_type = match et_str.to_uppercase().as_str() {
-        "NODE" | "LABEL" => EntityType::Node,
-        "RELATIONSHIP" | "EDGE" => EntityType::Relationship,
+    let entity_type = match et_str.to_ascii_uppercase().as_str() {
+        "NODE" => EntityType::Node,
+        "RELATIONSHIP" => EntityType::Relationship,
         _ => {
             return Err(redis_module::RedisError::String(
                 "Invalid constraint entity type".into(),
@@ -473,15 +473,14 @@ pub fn graph_constraint(
 
     // PROPERTIES keyword
     let props_kw = args.next_str()?;
-    if props_kw.to_uppercase() != "PROPERTIES" {
+    if !props_kw.eq_ignore_ascii_case("PROPERTIES") {
         return Err(redis_module::RedisError::String(
             "Expected PROPERTIES keyword".into(),
         ));
     }
 
-    // Property count
-    let prop_count_str = args.next_str()?;
-    let prop_count: i64 = prop_count_str.parse().map_err(|_| {
+    // Property count: Redis `string2ll` as in C (canonical decimal, no `+1` / `01`)
+    let prop_count: i64 = args.next_arg()?.parse_integer().map_err(|_| {
         redis_module::RedisError::String(
             "Number of properties must be an integer between 1 and 255".into(),
         )
```

**File**: `src/commands/memory.rs` (modified, +9/-16)
```diff
@@ -208,23 +208,16 @@ pub fn graph_memory(
         if !samples_kw.to_string_lossy().eq_ignore_ascii_case("SAMPLES") {
             return Err(RedisError::Str("ERR expected SAMPLES keyword"));
         }
+        // Any non-negative count, as C's `RedisModule_StringToULongLong`; 0 is
+        // accepted and, like any count, clamped to 1..=10000 by
+        // `memory_usage_report`.
         let count_str = args.next_arg()?;
-        let count_s = count_str.to_string_lossy();
-        // Reject negative values (starts with '-')
-        if count_s.starts_with('-') {
-            return Err(RedisError::Str(
-                "ERR SAMPLES count must be a positive integer",
-            ));
-        }
-        let count = count_s
-            .parse::<usize>()
-            .map_err(|_| RedisError::Str("ERR SAMPLES count must be a positive integer"))?;
-        if count == 0 {
-            return Err(RedisError::Str(
-                "ERR SAMPLES count must be a positive integer",
-            ));
-        }
-        count
+        count_str
+            .to_string_lossy()
+            .parse::<u64>()
+            .map_err(|_| RedisError::Str("ERR SAMPLES must be a non-negative integer"))?
+            .try_into()
+            .unwrap_or(usize::MAX)
     } else {
         100
     };
```

**File**: `tests/flow/test_constraint.py` (modified, +20/-0)
```diff
@@ -390,6 +390,26 @@ def test04_invalid_constraint_command(self):
         except ResponseError as e:
             self.env.assertContains("Number of properties must be an integer between 1 and 255", str(e))
 
+        #-----------------------------------------------------------------------
+        # property count is read as C's string2ll: no sign, no leading zeros
+        #-----------------------------------------------------------------------
+        for count in ["+1", "01", " 1", "1x"]:
+            try:
+                self.con.execute_command("GRAPH.CONSTRAINT", "CREATE", GRAPH_ID, "MANDATORY", "NODE", "label", "PROPERTIES", count, "New_Attr")
+                self.env.assertTrue(False)
+            except ResponseError as e:
+                self.env.assertContains("Number of properties must be an integer between 1 and 255", str(e))
+
+        #-----------------------------------------------------------------------
+        # the entity type is NODE or RELATIONSHIP, as in C
+        #-----------------------------------------------------------------------
+        for entity in ["LABEL", "EDGE"]:
+            try:
+                self.con.execute_command("GRAPH.CONSTRAINT", "CREATE", GRAPH_ID, "MANDATORY", entity, "New_Label", "PROPERTIES", 1, "New_Attr")
+                self.env.assertTrue(False)
+            except ResponseError as e:
+                self.env.assertContains("Invalid constraint entity type", str(e))
+
         #-----------------------------------------------------------------------
         # del constraint on non exsisting label
         #-----------------------------------------------------------------------
```

**File**: `tests/flow/test_memory_usage.py` (modified, +6/-2)
```diff
@@ -136,8 +136,12 @@ def test_invalid_call(self):
         try:
             res = self.conn.execute_command(cmd)
             self.env.assertTrue(False)
-        except:
-            pass
+        except ResponseError as e:
+            self.env.assertContains("SAMPLES must be a non-negative integer", str(e))
+
+        # zero samples is accepted, as in C (clamped to one sample)
+        res = self.conn.execute_command(f"GRAPH.MEMORY USAGE {GRAPH_ID} SAMPLES 0")
+        self.env.assertTrue(len(res) > 0)
 
         self.conn.set("x", 2)
 
```

---

### Incident Patch 13: `b84ff6de` (2026-10-04)
**Commit Message**: fix: parser accepts invalid / rejects valid syntax (#3057) (#3060)

- NOT NOT x keeps NOT's type check: a run of NOTs folds to one or two by
  parity instead of to none (RETURN NOT NOT 1 is a type error, as in C).
- SET/REMOVE target opened by `[` is rejected instead of read as `(`.
- String/list/null predicates may follow IS [NOT] NULL, per the grammar.
- A trailing comma in a call's argument list is an error.
- MATCH MATCH and LOAD CSV WITH FROM (no HEADERS) are rejected.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/parser/cypher.rs` (modified, +98/-16)
```diff
@@ -921,7 +921,6 @@ impl<'a> Parser<'a> {
                 ..
             } => {
                 self.lexer.next();
-                optional_match_token!(self.lexer => Match);
                 self.parse_match_clause(false)
             }
             Token::IdentifierOrKeyword {
@@ -937,8 +936,10 @@ impl<'a> Parser<'a> {
             } => {
                 self.lexer.next();
                 match_token!(self.lexer => Csv);
-                let headers = optional_match_token!(self.lexer => With)
-                    && optional_match_token!(self.lexer => Headers);
+                let headers = optional_match_token!(self.lexer => With);
+                if headers {
+                    match_token!(self.lexer => Headers);
+                }
                 match_token!(self.lexer => From);
                 let file_path = Arc::new(self.parse_expr(false)?);
                 match_token!(self.lexer => As);
@@ -2190,12 +2191,16 @@ impl<'a> Parser<'a> {
                         self.lexer.next();
                         not_count += 1;
                     }
-                    let (res, height) = if not_count % 2 == 1 {
-                        (Some(tree!(ExprIR::Not)), 1)
+                    // NOT type-checks its operand, so `NOT NOT x` is not `x`.
+                    // A longer run still folds, keeping its parity: to one
+                    // NOT, or to two that the operand is placed under.
+                    if not_count == 0 {
+                        stack.push((current, None, 0));
                     } else {
-                        (None, 0)
-                    };
-                    stack.push((current, res, height));
+                        for _ in 0..(2 - not_count % 2) {
+                            stack.push((current, Some(tree!(ExprIR::Not)), 1));
+                        }
+                    }
                     stack.push((current + 1, None, 0));
                 } else if current == 9 {
                     // unary add or subtract
@@ -2402,7 +2407,9 @@ impl<'a> Parser<'a> {
                                     res
                                 );
                             }
-                            parse_expr_return!(self, stack, res, height);
+                            // More predicates may follow, e.g.
+                            // `x IS NULL IN [false]`: come back to this level.
+                            stack.push((current, Some(res), height));
                             continue;
                         }
                         // Negated predicates: peek after NOT to decide
@@ -2719,11 +2726,15 @@ impl<'a> Parser<'a> {
         allow_pattern_predicate: bool,
     ) -> Result<Vec<DynTree<ExprIR<Arc<String>>>>, String> {
         let mut exprs = Vec::new();
-        while !expression_list_type.is_end_token(&self.lexer.current()?) {
-            exprs.push(self.parse_expr(allow_pattern_predicate)?);
-            match self.lexer.current()? {
-                Token::Comma => self.lexer.next(),
-                _ => break,
+        // Only an empty list may end at once: after a `,` an expression must
+        // follow, so `f(1,)` is an error.
+        if !expression_list_type.is_end_token(&self.lexer.current()?) {
+            loop {
+                exprs.push(self.parse_expr(allow_pattern_predicate)?);
+                match self.lexer.current()? {
+                    Token::Comma => self.lexer.next(),
+                    _ => break,
+                }
             }
         }
 
@@ -3224,6 +3235,7 @@ impl<'a> Parser<'a> {
         loop {
             let (mut expr, recurse) = self.parse_primary_expr(false)?;
             if recurse {
+                self.reject_unparenthesized_target(&expr)?;
                 expr = self.parse_expr(false)?;
                 match_token!(self.lexer, RParen);
             }
@@ -3271,6 +3283,20 @@ impl<'a> Parser<'a> {
         }
     }
 
+    /// A `SET`/`REMOVE` target that opens a nested expression may only open
+    /// it with `(`: an open list literal would otherwise be dropped and its
+    /// first element read as the target, so `SET [n).x = 5` set `n.x`.
+    fn reject_unparenthesized_target(
+        &self,
+        expr: &DynTree<ExprIR<Arc<String>>>,
+    ) -> Result<(), String> {
+        if matches!(expr.root().data(), ExprIR::Paren) {
+            Ok(())
+        } else {
+            Err(self.lexer.format_error("Invalid input '[': expected '('"))
+        }
+    }
+
     fn parse_remove_clause(&mut self) -> Result<QueryIR<Arc<String>>, String> {
         let mut remove_items = vec![];
         self.parse_remove_items(&mut remove_items)?;
@@ -3290,6 +3316,7 @@ impl<'a> Parser<'a> {
         loop {
             let (mut expr, recurse) = self.parse_primary_expr(false)?;
             if recurse {
+                self.reject_unparenthesized_target(&expr)?;
                 expr = self.parse_expr(false)?;
                 match_token!(self.lexer, RParen);
             }
@@ -3633,8 +3660,8 @@ m
```

**File**: `tests/test_e2e.py` (modified, +25/-0)
```diff
@@ -1693,6 +1693,31 @@ def test_list_comprehension():
 
 
 @pytest.mark.extra
+def test_syntax_outside_the_grammar_is_rejected():
+    # Each of these used to parse and run.
+    query_exception("RETURN abs(-1,)", "Invalid input")
+    query_exception("MATCH MATCH (n) RETURN n", "Invalid input")
+    query_exception("LOAD CSV WITH FROM 'file://x.csv' AS r RETURN r", "Invalid input")
+    query("CREATE (:SetBracket {x: 1})", write=True)
+    query_exception("MATCH (n:SetBracket) SET [n).x = 5", "Invalid input")
+    query_exception("MATCH (n:SetBracket) REMOVE [n).x", "Invalid input")
+    res = query("MATCH (n:SetBracket) RETURN n.x")
+    assert res.result_set == [[1]]
+    query("MATCH (n:SetBracket) DELETE n", write=True)
+
+
+def test_predicates_after_is_null():
+    res = query("RETURN 1 IS NULL IN [false], 1 IS NOT NULL = true, null IS NULL IS NOT NULL")
+    assert res.result_set == [[True, True, True]]
+
+
+def test_not_not_type_checks_its_operand():
+    query_exception("RETURN NOT NOT 1", "Type mismatch")
+    query_exception("RETURN NOT NOT NOT NOT 1", "Type mismatch")
+    res = query("RETURN NOT NOT true, NOT NOT NOT true, NOT NOT null")
+    assert res.result_set == [[True, False, None]]
+
+
 def test_parentheses():
     lparen = "(" * 10000
     rparen = ")" * 10000
```

---

### Incident Patch 14: `af9325e1` (2026-10-04)
**Commit Message**: fix: validate index OPTIONS like C (#3091) (#3094)

A vector index now requires dimension and similarityFunction (error
prefix "Invalid vector index configuration", also for a missing
OPTIONS block), the similarity function is matched case-insensitively
and stored lowercase, and a fulltext index rejects unknown option keys.
Unknown fulltext languages stay rejected (C accepts and crashes, #2448)
and 'ip' stays supported.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/runtime/index_ddl.rs` (modified, +5/-0)
```diff
@@ -58,6 +58,11 @@ pub(crate) fn create_index<'a>(
         Some(Value::Map(map)) => map_to_index_options(index_type, map)?,
         _ => None,
     };
+    // A vector index needs its dimension and similarity function (C rejects a
+    // missing OPTIONS block the same way).
+    if *index_type == IndexType::Vector && index_options.is_none() {
+        return Err("Invalid vector index configuration".into());
+    }
     // Index DDL mutates the shared, non-MVCC index directly (not via `pending`)
     // and calls host FFI that needs the global lock, so become a writer first —
     // same contract as `CommitOp`.
```

**File**: `graph/src/runtime/runtime.rs` (modified, +30/-8)
```diff
@@ -1889,6 +1889,18 @@ pub fn map_to_index_options(
     };
     match index_type {
         IndexType::Fulltext => {
+            // Reject keys this engine does not know, as C does: a misspelt
+            // option would otherwise be silently ignored.
+            const FULLTEXT_OPTIONS: [&str; 5] =
+                ["weight", "nostem", "phonetic", "language", "stopwords"];
+            if let Some((key, _)) = kv_map
+                .iter()
+                .find(|(k, _)| !FULLTEXT_OPTIONS.contains(&k.as_str()))
+            {
+                return Err(format!(
+                    "Invalid fulltext index configuration: unknown option '{key}'"
+                ));
+            }
             let weight = match get("weight") {
                 Some(Value::Float(f)) => Some(*f),
                 Some(Value::Int(i)) => Some(*i as f64),
@@ -1966,22 +1978,32 @@ pub fn map_to_index_options(
                     }
                     *n as u64
                 }
-                None => 0,
+                // Required, as in C: without it no vector can be indexed.
+                None => {
+                    return Err("Invalid vector index configuration: dimension is required".into());
+                }
                 _ => {
                     return Err(
                         "Invalid vector index configuration: dimension must be an integer".into(),
                     );
                 }
             };
-            let similarity_function =
-                match get("similarityFunction") {
-                    Some(Value::String(s)) => Some(s.to_string()),
-                    None => None,
-                    _ => return Err(
+            // Required and case-insensitive, as in C (`strcasecmp`); stored
+            // lowercase, the form the rest of the engine matches on.
+            let similarity_function = match get("similarityFunction") {
+                Some(Value::String(s)) => Some(s.to_ascii_lowercase()),
+                None => {
+                    return Err(
+                        "Invalid vector index configuration: similarityFunction is required".into(),
+                    );
+                }
+                _ => {
+                    return Err(
                         "Invalid vector index configuration: similarityFunction must be a string"
                             .into(),
-                    ),
-                };
+                    );
+                }
+            };
             let m = match get("M") {
                 Some(Value::Int(n)) if *n < 0 => {
                     return Err(
```

**File**: `tests/flow/test_index_create.py` (modified, +38/-0)
```diff
@@ -866,6 +866,44 @@ def test16_index_creation_stats(self):
         self.env.assertEqual(result.indices_created, 1)
         self.env.assertEqual(result.labels_added, 1)
 
+    def test19_index_options_validation(self):
+        # index OPTIONS are validated like C: a vector index needs a dimension
+        # and a similarity function (matched case-insensitively), and a
+        # fulltext index refuses option keys it does not know
+        graph = self.db.select_graph("index_options_validation")
+
+        invalid = [
+            ("CREATE VECTOR INDEX FOR (n:A) ON (n.v)",
+             "Invalid vector index configuration"),
+            ("CREATE VECTOR INDEX FOR (n:A) ON (n.v) OPTIONS {}",
+             "Invalid vector index configuration"),
+            ("CREATE VECTOR INDEX FOR (n:A) ON (n.v) OPTIONS {similarityFunction:'euclidean'}",
+             "Invalid vector index configuration"),
+            ("CREATE VECTOR INDEX FOR (n:A) ON (n.v) OPTIONS {dimension:2}",
+             "Invalid vector index configuration"),
+            ("CREATE FULLTEXT INDEX FOR (n:A) ON (n.t) OPTIONS {foo:1}",
+             "unknown option 'foo'"),
+            ("CREATE FULLTEXT INDEX FOR (n:A) ON (n.t) OPTIONS {weight:1, foo:1}",
+             "unknown option 'foo'"),
+        ]
+        for q, msg in invalid:
+            try:
+                graph.query(q)
+                self.env.assertTrue(False, message=q)
+            except ResponseError as e:
+                self.env.assertContains(msg, str(e))
+
+        res = graph.query("CREATE VECTOR INDEX FOR (n:B) ON (n.v) OPTIONS {dimension:2, similarityFunction:'Euclidean'}")
+        self.env.assertEqual(res.indices_created, 1)
+        res = graph.query("CREATE VECTOR INDEX FOR (n:C) ON (n.v) OPTIONS {dimension:2, similarityFunction:'COSINE'}")
+        self.env.assertEqual(res.indices_created, 1)
+        res = graph.query("CREATE FULLTEXT INDEX FOR (n:D) ON (n.t) OPTIONS {weight:2, nostem:true}")
+        self.env.assertEqual(res.indices_created, 1)
+
+        # the similarity function is stored normalized
+        res = graph.query("CALL db.indexes() YIELD label, options WHERE label = 'B' RETURN options")
+        self.env.assertEqual(res.result_set[0][0]['v']['similarityFunction'], 'euclidean')
+
     def test17_index_catalog_response(self):
         graph_name = "index_catalog_response"
         graph = self.db.select_graph(graph_name)
```

---

### Incident Patch 15: `2c874022` (2026-10-04)
**Commit Message**: fix: refuse effect records the v3 reader would reject at encode time (#2916)

`Record::encode` wrote whatever `rows` it was handed, but `AttrValues` has no
length on the wire: the reader takes `count x attr_ids.len()` values, so an
extra value was read back as the next record's opcode. `write_header` also
wrote a zero count, which `read_record` refuses as `EmptyRecord`.

Both are now `EncodeError`s raised before the header is written, so a refused
record leaves the buffer untouched, as `check_endpoint_columns` already does
for misaligned endpoint columns.

Closes #2914

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/effects/error.rs` (modified, +21/-0)
```diff
@@ -35,6 +35,27 @@ pub enum EncodeError {
         got: usize,
     },
 
+    /// A record whose `AttrValues` block is not one value per entity per
+    /// attribute.
+    ///
+    /// The block has no length on the wire: the reader takes `count ×
+    /// attr_ids.len()` values. Any other number shifts the record boundary, so
+    /// the reader either refuses the buffer or reads the next record from the
+    /// wrong place.
+    #[error("{got} attribute values for {entities} entities of {attrs} attributes each")]
+    RowShapeMismatch {
+        entities: usize,
+        attrs: usize,
+        got: usize,
+    },
+
+    /// A batchable record covering no entities.
+    ///
+    /// The reader refuses one at the header, so writing it produces a buffer
+    /// this engine cannot read back.
+    #[error("record with opcode {opcode} covers no entities")]
+    EmptyRecord { opcode: u32 },
+
     /// A `CREATE_INDEX` whose options do not match the field type they are
     /// gated by.
     ///
```

**File**: `graph/src/effects/v3/records.rs` (modified, +159/-0)
```diff
@@ -28,6 +28,15 @@ fn write_header<W: EffectWrite + ?Sized>(
             opcode: opcode as u32,
         });
     }
+    // The reader refuses a record covering no entities (`read_record`), so the
+    // writer must not produce one: it would be a buffer this engine cannot read
+    // back. Checked here because this is the first byte of every record, so a
+    // refusal leaves the buffer as it was.
+    if count == Some(0) {
+        return Err(EncodeError::EmptyRecord {
+            opcode: opcode as u32,
+        });
+    }
     buf.u32(opcode as u32);
     if let Some(count) = count {
         buf.u32(count);
@@ -843,6 +852,30 @@ fn check_endpoint_columns(
     Ok(())
 }
 
+/// One value per entity per attribute, or refuse the record.
+///
+/// `AttrValues` carries no length of its own: the reader takes
+/// `count × attr_ids.len()` values, from the header and the `AttrIds` block. A
+/// block with more values than that leaves the rest to be read as the next
+/// record's opcode, and one with fewer takes the next record's bytes as values.
+/// Either way the reader refuses the buffer, or worse, misreads it.
+///
+/// Checked before the header, so a refusal leaves the buffer as it was.
+fn check_row_shape(
+    ids: &IdList,
+    attr_ids: &[u16],
+    rows: &[Value],
+) -> Result<(), EncodeError> {
+    if ids.len().checked_mul(attr_ids.len()) != Some(rows.len()) {
+        return Err(EncodeError::RowShapeMismatch {
+            entities: ids.len(),
+            attrs: attr_ids.len(),
+            got: rows.len(),
+        });
+    }
+    Ok(())
+}
+
 /// The label, name and property list both constraint records end with.
 ///
 /// Shared so the create and the drop cannot drift: they differ only in the
@@ -918,6 +951,7 @@ impl EffectEncode<3> for Record {
                 attr_ids,
                 rows,
             } => {
+                check_row_shape(ids, attr_ids, rows)?;
                 write_header(buf, Opcode::CreateNode, Some(ids.count()))?;
                 LabelSet(labels.as_slice()).encode(buf)?;
                 AttrIds(attr_ids.as_slice()).encode(buf)?;
@@ -940,6 +974,7 @@ impl EffectEncode<3> for Record {
                 rows,
             } => {
                 check_endpoint_columns(ids, src, dst)?;
+                check_row_shape(ids, attr_ids, rows)?;
                 write_header(buf, Opcode::CreateEdge, Some(ids.count()))?;
                 RelType(*relation_id).encode(buf)?;
                 AttrIds(attr_ids.as_slice()).encode(buf)?;
@@ -973,6 +1008,7 @@ impl EffectEncode<3> for Record {
                 attr_ids,
                 rows,
             } => {
+                check_row_shape(ids, attr_ids, rows)?;
                 write_header(buf, Opcode::UpdateNode, Some(ids.count()))?;
                 LabelSet(labels.as_slice()).encode(buf)?;
                 AttrIds(attr_ids.as_slice()).encode(buf)?;
@@ -986,6 +1022,7 @@ impl EffectEncode<3> for Record {
                 attr_ids,
                 rows,
             } => {
+                check_row_shape(ids, attr_ids, rows)?;
                 write_header(buf, Opcode::UpdateEdge, Some(ids.count()))?;
                 // No `expect` here any more: the type carries the relationship
                 // type, so an edge update cannot be built without one.
@@ -1966,6 +2003,128 @@ mod tests {
         assert_eq!(buf, new_buffer(), "a refused record wrote bytes anyway");
     }
 
+    /// The encoder is held to what `read_record` accepts: a value block that is
+    /// not `count × attr_ids.len()` values, or a record covering no entities,
+    /// used to be written and then refused by this engine's own reader. A block
+    /// one value too long left that value to be read as the next record's
+    /// opcode.
+    #[test]
+    fn a_record_its_own_reader_would_refuse_is_not_written() {
+        let one = || (7..8).collect::<IdList>();
+        let two = || (7..9).collect::<IdList>();
+        let v = |n: i64| (0..n).map(Value::Int).collect::<Vec<_>>();
+        let shape = |entities, attrs, got| {
+            Err(EncodeError::RowShapeMismatch {
+                entities,
+                attrs,
+                got,
+            })
+        };
+
+        let mut buf = new_buffer();
+        let cases = [
+            // One value too many.
+            (
+                Record::CreateNode {
+                    ids: one(),
+                    labels: vec![],
+                    attr_ids: vec![0],
+                    rows: v(2),
+                },
+                shape(1, 1, 2),
+            ),
+            // One value too few.
+            (
+                Record::CreateEdge {
+                    ids: two(),
+                    relation_id: 0,
+                    src: two(),
+                    dst: two(),
+                    attr_ids: vec![0, 1],
+                    rows: v(3),
+                },
+                shape(2, 2, 3),
+            ),
+            // Values under no attributes at all.
+            (
```

#### Recent Merged Pull Requests:
- **PR #3163** (2026-10-04): ci: move the toolchain to LLVM 23 (@AviAvni)
- **PR #3161** (2026-10-04): fix(rdb): save virtual keys as graphmeta so C keeps graphs in GRAPH.LIST (@AviAvni)
- **PR #3156** (2026-10-01): [6.0] Batch backport (2 commits) (@github-actions[bot])
- **PR #3153** (2026-10-01): ci(images): rebuild the OS-package stages on every image build (@DvirDukhan)
- **PR #3139** (2026-09-28): Fix crash when a clause errors mid plan-build (#250) (@swilly22)
- **PR #3131** (2026-10-04): chore(deps): bump the cargo-deps group across 1 directory with 9 updates (@dependabot[bot])
- **PR #3130** (2026-10-04): chore(deps): update rltest requirement from >=0.7.28 to >=0.7.29 in /tests in the python-test-deps group (@dependabot[bot])
- **PR #3116** (2026-09-26): Fix crash on MERGE following a wrong-arity function call (#239) (@swilly22)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
