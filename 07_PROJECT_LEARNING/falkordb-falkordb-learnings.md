> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `56d00c3d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T02:34:37.161Z  
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
> **Harvest Timestamp**: 2026-11-09T02:34:36.925Z  
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

### Incident Patch 1: `8312750b` (2026-11-08)
**Commit Message**: fix: bound SET/REMOVE property chains and nested FOREACH in the parser (#2900)

* fix: bound SET/REMOVE property chains and nested FOREACH in the parser

`SET n.a.a.a... = 1`, `REMOVE n.a.a.a...` and nested `FOREACH` were built
outside the depth guards added in #2533, so a few kilobytes of either
overflowed the stack and took the server down. The property chain is now
charged against MAX_TREE_DEPTH step by step, and a nested FOREACH goes
through `nested()` like `CALL {}`.

Closes #2895

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix: charge a SET/REMOVE target's own height even without a property chain (#2900)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `graph/src/parser/cypher.rs` (modified, +71/-25)
```diff
@@ -3338,18 +3338,8 @@ impl<'a> Parser<'a> {
         set_items: &mut Vec<SetItem<Arc<String>, Arc<String>>>,
     ) -> Result<(), String> {
         loop {
-            let (mut expr, recurse) = self.parse_primary_expr(false)?;
-            if recurse {
-                self.reject_unparenthesized_target(&expr)?;
-                expr = self.parse_expr(false)?;
-                match_token!(self.lexer, RParen);
-                self.expect_property_after_paren()?;
-            }
-            if self.lexer.current()? == Token::Dot {
-                while self.lexer.current()? == Token::Dot {
-                    self.lexer.next();
-                    expr = self.parse_property_lookup(expr)?;
-                }
+            let (expr, has_properties) = self.parse_update_target()?;
+            if has_properties {
                 match_token!(self.lexer, Equal);
                 let value = Arc::new(self.parse_expr(false)?);
                 set_items.push(SetItem::Attribute {
@@ -3389,6 +3379,37 @@ impl<'a> Parser<'a> {
         }
     }
 
+    /// Parses what a `SET` or `REMOVE` item updates: an expression followed
+    /// by an optional `.prop.prop...` chain, reporting whether a chain was
+    /// present.
+    ///
+    /// Each lookup wraps the tree before it, so the chain is charged against
+    /// [`Self::MAX_TREE_DEPTH`] step by step, as the postfix chain in
+    /// [`Self::parse_expr_inner`] is: otherwise `n.a.a.a...` builds a tree
+    /// the binder overflows its stack walking, quadratically slowly.
+    fn parse_update_target(&mut self) -> Result<(DynTree<ExprIR<Arc<String>>>, bool), String> {
+        let ((mut expr, recurse), child_height) =
+            self.with_child_height(|s| s.parse_primary_expr(false))?;
+        let mut height = child_height + Self::PRIMARY_LEVELS;
+        if recurse {
+            self.reject_unparenthesized_target(&expr)?;
+            expr = self.parse_expr(false)?;
+            height = self.expr_height;
+            match_token!(self.lexer, RParen);
+            self.expect_property_after_paren()?;
+        }
+        // The target itself may already be too tall, with no lookup to charge.
+        self.check_depth(height)?;
+        let has_properties = self.lexer.current()? == Token::Dot;
+        while self.lexer.current()? == Token::Dot {
+            self.lexer.next();
+            expr = self.parse_property_lookup(expr)?;
+            height += 1;
+            self.check_depth(height)?;
+        }
+        Ok((expr, has_properties))
+    }
+
     /// A `SET`/`REMOVE` target that opens a nested expression may only open
     /// it with `(`: an open list literal would otherwise be dropped and its
     /// first element read as the target, so `SET [n).x = 5` set `n.x`.
@@ -3434,18 +3455,8 @@ impl<'a> Parser<'a> {
         remove_items: &mut Vec<QueryExpr<Arc<String>>>,
     ) -> Result<(), String> {
         loop {
-            let (mut expr, recurse) = self.parse_primary_expr(false)?;
-            if recurse {
-                self.reject_unparenthesized_target(&expr)?;
-                expr = self.parse_expr(false)?;
-                match_token!(self.lexer, RParen);
-                self.expect_property_after_paren()?;
-            }
-            if self.lexer.current()? == Token::Dot {
-                while self.lexer.current()? == Token::Dot {
-                    self.lexer.next();
-                    expr = self.parse_property_lookup(expr)?;
-                }
+            let (mut expr, has_properties) = self.parse_update_target()?;
+            if has_properties {
                 remove_items.push(Arc::new(expr));
             } else if self.lexer.current()? == Token::Colon {
                 expr = tree!(
@@ -3524,7 +3535,9 @@ impl<'a> Parser<'a> {
                     ..
                 } => {
                     self.lexer.next();
-                    body.push(self.parse_foreach_clause()?);
+                    // A nested FOREACH recurses like `CALL {}` does, so it is
+                    // bounded the same way.
+                    body.push(self.nested(Self::parse_foreach_clause)?);
                 }
                 _ => break,
             }
@@ -3701,6 +3714,23 @@ mod tests {
                 "map projection",
                 format!("MATCH (a) RETURN {}a{{.k}}{}", "[".repeat(n), "]".repeat(n)),
             ),
+            // Clauses that build expressions or recurse outside parse_expr.
+            (
+                "set property chain",
+                format!("MATCH (n) SET n{} = 1", ".a".repeat(n)),
+            ),
+            (
+                "remove property chain",
+                format!("MATCH (n) REMOVE n{}", ".a".repeat(n)),
+            ),
+            (
+                "foreach",
+                format!(
+                    "{}CREATE (){}",
+                    "FOREACH (x IN [1] | ".repeat(n),
+                    ")".repeat(n)
+                ),
+            ),
         ];
         // The same nesting an ex
```

**File**: `tests/test_e2e.py` (modified, +14/-0)
```diff
@@ -1863,6 +1863,20 @@ def test_deep_expression_nesting_is_rejected():
     assert query("RETURN 1").result_set == [[1]]
 
 
+def test_deep_clause_nesting_is_rejected():
+    # SET/REMOVE property chains and nested FOREACH were built outside the
+    # expression parser's depth guard, so a few kilobytes of either overflowed
+    # the stack and took the server down. They must come back as errors.
+    n = 5000
+    for q in [
+        f"MATCH (n) SET n{'.a' * n} = 1",
+        f"MATCH (n) REMOVE n{'.a' * n}",
+        f"{'FOREACH (x IN [1] | ' * n}CREATE (){')' * n}",
+    ]:
+        query_exception(q, "Query nesting exceeds")
+        assert query("RETURN 1").result_set == [[1]]
+
+
 def test_index():
     res = query(
         "UNWIND range(1, 100000) AS x CREATE (n:Node {vi: x, vs: tostring(x)})",
```

---

### Incident Patch 2: `3643a301` (2026-11-08)
**Commit Message**: fix: accept a list or map subscript as a WHERE predicate (#3270)

* fix: accept a list or map subscript as a WHERE predicate

`expr_may_return_boolean` listed `GetElement` with the node kinds that can
never be boolean, so `WHERE n.flags[0]` failed with "Expected boolean
predicate". A subscript returns whatever the element is; leave it to the
runtime type check, as for properties and variables, and as C does.

Closes #3261

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: reject a non-boolean list-comprehension predicate instead of skipping it

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `graph/src/planner/binder.rs` (modified, +4/-3)
```diff
@@ -2343,19 +2343,19 @@ impl Binder {
             // that used to reach the runtime.
             ExprIR::Case { .. } => true,
 
-            // Non-boolean: literals, unary arithmetic, subscript, list comprehension
+            // Non-boolean: literals, unary arithmetic, slice, list comprehension
             ExprIR::List
             | ExprIR::Map
             | ExprIR::MapProjection
             | ExprIR::Negate
             | ExprIR::Length
-            | ExprIR::GetElement
             | ExprIR::GetElements
             | ExprIR::ListComprehension(_)
             | ExprIR::PatternComprehension(_)
             | ExprIR::NestedPlan(_) => false,
 
-            // Boolean literals, comparisons, predicates, and runtime-typed nodes
+            // Boolean literals, comparisons, predicates, and runtime-typed
+            // nodes (a subscript returns whatever the element is)
             ExprIR::Eq
             | ExprIR::Neq
             | ExprIR::Lt
@@ -2376,6 +2376,7 @@ impl Binder {
             | ExprIR::Variable(_)
             | ExprIR::Parameter(_)
             | ExprIR::Property(_)
+            | ExprIR::GetElement
             | ExprIR::ShortestPath(_)
             | ExprIR::Pattern(_) => true,
 
```

**File**: `graph/src/runtime/eval.rs` (modified, +7/-1)
```diff
@@ -1075,7 +1075,13 @@ impl<'a> ExprEval<'a> {
                             row.insert(var, value);
                             match self.eval_node(&node.child(1), Some(&row), agg_group_key)? {
                                 Value::Bool(true) => {}
-                                _ => continue,
+                                Value::Bool(false) | Value::Null => continue,
+                                value => {
+                                    return Err(format!(
+                                        "Type mismatch: expected Boolean but was {}",
+                                        value.name()
+                                    ));
+                                }
                             }
                             acc.push(self.eval_node(&node.child(2), Some(&row), agg_group_key)?);
                         }
```

**File**: `tests/flow/test_filters.py` (modified, +33/-0)
```diff
@@ -262,3 +262,36 @@ def test09_case_value_form_null_subject(self):
             "MATCH (n:K) RETURN head([CASE n.missing WHEN null THEN 'matched' ELSE 'else' END]) AS v")
         self.env.assertEqual(columnar.result_set, per_row.result_set)
         self.env.assertEqual(columnar.result_set, [['else']] * 5)
+
+    def test10_subscript_as_predicate(self):
+        # a subscript returns whatever the element is, so it is accepted as a
+        # predicate and its type is checked at runtime, as in C
+        # https://github.com/FalkorDB/FalkorDB/issues/3261
+        g = self.db.select_graph("subscript_predicate")
+        g.query("CREATE (:N {flags: [true, false]}), (:N {flags: [false]}), (:N)")
+
+        for query, expected in [
+            ("MATCH (n:N) WHERE n.flags[0] RETURN count(n)", [[1]]),
+            ("MATCH (n:N) WHERE NOT n.flags[0] RETURN count(n)", [[1]]),
+            ("WITH [true] AS l WHERE true AND l[0] RETURN 1", [[1]]),
+            ("WITH {a: true} AS m WHERE m['a'] RETURN 1", [[1]]),
+            ("WITH [null] AS l WHERE l[0] RETURN count(*)", [[0]]),
+        ]:
+            self.env.assertEqual(g.query(query).result_set, expected, depth=1)
+
+        for query, error in [
+            # a non-boolean element is a runtime type error
+            ("WITH [1] AS l WHERE l[0] RETURN 1",
+             "Type mismatch: expected Boolean but was Integer"),
+            # a comprehension's predicate is checked the same way, not skipped
+            ("WITH [[1]] AS lists RETURN [l IN lists WHERE l[0] | l]",
+             "Type mismatch: expected Boolean but was Integer"),
+            # a slice is always a list, never a predicate
+            ("WITH [true] AS l WHERE l[0..1] RETURN 1",
+             "Expected boolean predicate"),
+        ]:
+            try:
+                g.query(query)
+                self.env.assertTrue(False, depth=1)
+            except redis.ResponseError as e:
+                self.env.assertContains(error, str(e), depth=1)
```

**File**: `tests/flow/test_reduce.py` (modified, +3/-2)
```diff
@@ -158,7 +158,8 @@ def test_nested_reduction(self):
         self.env.assertEqual(self.graph.query(q).result_set, [[1]])
 
         # the shadowed form is still a non-boolean expression in a WHERE
-        # clause, so it must be rejected rather than evaluated
+        # clause, so it must be rejected; the subscript is type-checked at
+        # runtime, as in C (https://github.com/FalkorDB/FalkorDB/issues/3261)
         self.graph.query("CREATE (:Node)")
         q = """MATCH (n)
                WHERE [x IN [0] | reduce(s=0, x IN [0] | s + reduce(s=0, x IN [0] | s + 1))][0]
@@ -167,7 +168,7 @@ def test_nested_reduction(self):
             self.graph.query(q)
             self.env.assertTrue(False)
         except ResponseError as e:
-            self.env.assertContains("Expected boolean predicate", str(e))
+            self.env.assertContains("Type mismatch: expected Boolean but was Integer", str(e))
 
         # the server survived and the outer scope is uncorrupted
         self.env.assertEqual(self.graph.query("RETURN 1").result_set, [[1]])
```

---

### Incident Patch 3: `56d00c3d` (2026-11-08)
**Commit Message**: fix: parse a chained unary minus such as `RETURN - -5` (#2309) (#3525)

* fix: parse a chained unary minus such as `RETURN - -5` (#2309)

The unary level of the expression parser read one optional `+` and then one
optional `-`, so any further sign was "Invalid input Dash". It now reads the
whole run of signs and, as the NOT level does, folds it by parity to one or two
Negates, so the operand is still type-checked (`- -'a'` is a type mismatch, as
in C) and `--9223372036854775808` stays i64::MIN.

Parameter values keep C's rule of one sign at most: `CYPHER x=--1` is still
refused, now by evaluate_param.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: refuse a run of signs in a CYPHER parameter value, as before

parse_expr folds a run of signs to its parity, so the evaluate_param guard
for a negated negation missed --- and --9223372036854775808. Check the sign
run in the parameter parser instead, before it is folded.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: apply the legacy sign restriction to every level of a CYPHER parameter

Moves the check from the parameter root into the unary-sign parse, behind a
flag set while a parameter is parsed as an expressio

**File**: `graph/src/parser/cypher.rs` (modified, +81/-14)
```diff
@@ -220,6 +220,10 @@ pub struct Parser<'a> {
     /// with everything else that decides whether the attempt can succeed.
     /// See [`Parser::parse_list_literal_or_comprehension`].
     not_pattern_comprehension: HashSet<PatternComprehensionAttempt>,
+    /// Set while a `CYPHER` parameter value is parsed as an expression: a sign run
+    /// is then limited to what the grammar took before runs parsed (`+`, `-` or
+    /// `+-`), at every nesting level, since the parser folds a run to its parity.
+    legacy_signs: bool,
 }
 
 /// Where and in what context [`Parser::parse_list_literal_or_comprehension`]
@@ -283,6 +287,7 @@ impl<'a> Parser<'a> {
             max_child_height: 0,
             forbidden_pattern_comprehension: None,
             not_pattern_comprehension: HashSet::new(),
+            legacy_signs: false,
         }
     }
 
@@ -437,7 +442,12 @@ impl<'a> Parser<'a> {
             return Ok(value);
         }
         self.restore_state(state);
-        evaluate_param(&self.parse_expr(false)?.root())
+        // `parse_expr` folds a run of signs to its parity, so `---1` would come out
+        // accepted: a parameter keeps the sign grammar it had before runs parsed.
+        self.legacy_signs = true;
+        let expr = self.parse_expr(false);
+        self.legacy_signs = false;
+        evaluate_param(&expr?.root())
     }
 
     /// Reads a literal: `null`, a boolean, a number, a string, a list, a map,
@@ -2226,21 +2236,43 @@ impl<'a> Parser<'a> {
                     }
                     stack.push((current + 1, None, 0));
                 } else if current == 9 {
-                    // unary add or subtract
-                    optional_match_token!(self.lexer, Plus);
-                    let is_negate = optional_match_token!(self.lexer, Dash);
-
-                    // Handle integer overflow with negation
-                    if is_negate && let Err(err) = self.lexer.current() {
-                        return Err(err.replace("Integer overflow '", "Integer overflow '-"));
+                    // unary add or subtract, any run of them: `- -5` is 5
+                    let mut negate_count = 0;
+                    let mut plus_count = 0;
+                    loop {
+                        match self.lexer.current() {
+                            Ok(token @ (Token::Plus | Token::Dash))
+                                if self.legacy_signs
+                                    && (negate_count > 0
+                                        || plus_count > 0 && matches!(token, Token::Plus)) =>
+                            {
+                                return Err(self
+                                    .lexer
+                                    .format_error(&format!("Invalid input {token:?}")));
+                            }
+                            Ok(Token::Plus) => plus_count += 1,
+                            Ok(Token::Dash) => negate_count += 1,
+                            // Handle integer overflow with negation
+                            Err(err) if negate_count > 0 => {
+                                return Err(
+                                    err.replace("Integer overflow '", "Integer overflow '-")
+                                );
+                            }
+                            _ => break,
+                        }
+                        self.lexer.next();
                     }
 
-                    let (res, height) = if is_negate {
-                        (Some(tree!(ExprIR::Negate)), 1)
+                    // Negate type-checks its operand, so `- -x` is not `x`.
+                    // A longer run still folds, keeping its parity, as NOT's
+                    // does: to one Negate, or to two the operand is placed under.
+                    if negate_count == 0 {
+                        stack.push((current, None, 0));
                     } else {
-                        (None, 0)
-                    };
-                    stack.push((current, res, height));
+                        for _ in 0..(2 - negate_count % 2) {
+                            stack.push((current, Some(tree!(ExprIR::Negate)), 1));
+                        }
+                    }
                     stack.push((current + 1, None, 0));
                 } else {
                     // primary expression
@@ -4024,6 +4056,27 @@ mod tests {
         }
     }
 
+    // Regression (#2309): a run of signs parsed only its first `+` and `-`, so
+    // `- -5` was "Invalid input Dash". It folds to one or two Negates by parity.
+    #[test]
+    fn chained_unary_signs_parse() {
+        with_functions();
+        for query in [
+            "RETURN - -5",
+            "RETURN --5",
+            "RETURN - - -5",
+            "RETURN -+5",
+            "RETURN +-+-5",
+            "RETURN --9223372036854775808",
+        ] {
+            assert!(Parser::new(query).parse().is_ok(), "{query}");
+        }
+        let err = Parser::new("RETURN - -99999999999999999999")
+ 
```

**File**: `tests/test_overflow_crashes.py` (modified, +15/-0)
```diff
@@ -80,6 +80,21 @@ def test_unary_minus_normal_values_still_work():
     assert res.result_set == [[-5, 7, -1.25, None]]
 
 
+def test_chained_unary_minus():
+    # Regression (#2309): a sign applied to an already-signed operand was
+    # rejected with "Invalid input Dash". C folds any run of signs.
+    res = common.g.query(
+        "RETURN - -5, --5, - - -5, -+5, +-5, ++5, - -1.5, - -NULL")
+    assert res.result_set == [[5, 5, -5, -5, -5, 5, 1.5, None]]
+    res = common.g.query("RETURN --9223372036854775808, - - 9223372036854775807")
+    assert res.result_set == [[-9223372036854775808, 9223372036854775807]]
+    res = common.g.query("UNWIND [0, 1, 2] AS x WITH x WHERE x > - -1 RETURN x")
+    assert res.result_set == [[2]]
+    # Two negations still type-check the operand, as one does.
+    with pytest.raises(ResponseError, match="Type mismatch"):
+        common.g.query("RETURN - -'a'")
+
+
 def test_range_normal_values_still_work():
     res = common.g.query("RETURN range(1, 5)")
     assert res.result_set == [[[1, 2, 3, 4, 5]]]
```

#### Recent Merged Pull Requests:
- **PR #3689** (2026-11-08): chore(deps): bump the cargo-deps group with 2 updates (@dependabot[bot])
- **PR #3688** (2026-11-08): chore(deps): bump the github-actions group with 3 updates (@dependabot[bot])
- **PR #3685** (2026-11-06): fix(writer-gate): engage the gate lazily to recover mixed read/write throughput (@swilly22)
- **PR #3682** (2026-11-05): [6.0] Batch backport (74 commits) (@github-actions[bot])
- **PR #3673** (closed): feat(index): an edge batch resumes anywhere, and reads exactly its size (@DvirDukhan)
- **PR #3670** (closed): chore(deps): bump the github-actions-master group with 4 updates (@dependabot[bot])

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

## X. bound SET/REMOVE property chains and nested FOREACH in the parser (#2900)

**RULE**:
When implementing operations in `graph/src/parser/cypher.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8312750b`: bound SET/REMOVE property chains and nested FOREACH in the parser (#2900). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `graph/src/parser/cypher.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            let (expr, has_properties) = self.parse_update_target()?;
            if has_properties {
    /// Parses what a `SET` or `REMOVE` item updates: an expression followed
    /// by an optional `.prop.prop...` chain, reporting whether a chain was
    /// present.
    ///
    /// Each lookup wraps the tree before it, so the chain is charged against
    /// [`Self::MAX_TREE_DEPTH`] step by step, as the postfix chain in
    /// [`Self::parse_expr_inner`] is: otherwise `n.a.a.a...` builds a tree
    /// the binder overflows its stack walking, quadratically slowly.
    fn parse_update_target(&mut self) -> Result<(DynTree<ExprIR<Arc<String>>>, bool), String> {
        let ((mut expr, recurse), child_height) =
            self.with_child_height(|s| s.parse_primary_expr(false))?;
        let mut height = child_height + Self::PRIMARY_LEVELS;
        if recurse {
            self.reject_unparenthesized_target(&expr)?;
            expr = self.parse_expr(false)?;
            height = self.expr_height;
            match_token!(self.lexer, RParen);
            self.expect_property_after_paren()?;
        }
        // The target itself may already be too tall, with no lookup to charge.
  
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            let (mut expr, recurse) = self.parse_primary_expr(false)?;
            if recurse {
                self.reject_unparenthesized_target(&expr)?;
                expr = self.parse_expr(false)?;
                match_token!(self.lexer, RParen);
                self.expect_property_after_paren()?;
            }
            if self.lexer.current()? == Token::Dot {
                while self.lexer.current()? == Token::Dot {
                    self.lexer.next();
                    expr = self.parse_property_lookup(expr)?;
                }
            let (mut expr, recurse) = self.parse_primary_expr(false)?;
            if recurse {
                self.reject_unparenthesized_target(&expr)?;
                expr = self.parse_expr(false)?;
                match_token!(self.lexer, RParen);
                self.expect_property_after_paren()?;
            }
            if self.lexer.current()? == Token::Dot {
                while self.lexer.current()? == Token::Dot {
                    self.lexer.next();
                    expr = self.parse_property_lookup(expr)?;
                }
                    body.push(self.parse_foreach_clause()?);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8312750b` are properly handled with clean fallback behavior.
