> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `543357f1`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T22:19:18.925Z  
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
> **Harvest Timestamp**: 2026-11-16T22:19:18.917Z  
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
- **Issue #3822** (2026-11-16): **Rust engine times out on multi-hop query with inline id map + WHERE on end node (C: ~5 ms)**
  *Symptoms*: ## Summary  On the Rust engine (`edge-rs` and `edge-rs-redis` images), the Pokec baseline benchmark query `aggregate_expansion_3_with_filter`, and its 2- and 4-hop variants, hits the server `Query timed out` error after 20–60 s. C 4.22.1 answers the same query in milliseconds. The Valkey and Redis hosts behave the same, and the same happens through `redis-cli`, so this is an engine problem, not a client or protocol issue.  Under benchmark concurrency (parallel=8, pool size 8, 20 s timeout), these stuck queries tie up the pool's connections, and the timeouts cascade to other queries.  ## Repro  Graph: Pokec medium (~100k `User` nodes, ~1.77M edges) with an index on `User(id)`.  ```cypher MATCH (s:User {id: $id})-->()-->()-->(n:User) WHERE n.age >= 18 RETURN DISTINCT n.id ```  | Engine | Result | |---|---| | C (master / 4.22.1) | 5–80 ms | | Rust (main) | `Query timed out` |  ## Cause  The Rust engine starts the query from the wrong node:  ``` Distinct     Project         Filter             Conditional Traverse | (_anon_1)<-(s:User)                 Conditional Traverse | (_anon_3)<-(_anon_1)                     Conditional Traverse | (n)<-(_anon_3)                         Filter                             Node By Label Scan | (n:User) ```  Instead of looking up `s` through the index, it scans every `User` as `n` and walks three hops backwards.  In `select_scan_node`, `s` (inline `{id: …}`) and `n` (`WHERE n.age >= 18`) get the same score. The `filter_runs_late` tiebreak then p

- **Issue #3781** (2026-11-16): **[Rust] A write or GRAPH.CONSTRAINT freezes the whole server while a read runs on the same graph**
  *Symptoms*: ### Summary  On the Rust engine, a write query or a `GRAPH.CONSTRAINT CREATE`/`DROP` on a graph waits for every read running on that graph, and the whole server stops answering, PING included, until those reads finish. The C engine keeps answering in the same situation: writes since #3422, constraint commands since #3763. Index builds don't freeze the server on either engine.  ### Reproduce  `falkordb/falkordb-server:edge` at `sha256:61dca508…` (main 7df8e5887), started with `redis-server --loadmodule /var/lib/falkordb/bin/falkordb.so` and `GRAPH.CONFIG SET TIMEOUT 0`.  1. On graph `q`: `UNWIND range(0, 999999) AS i CREATE (:N {v: i})`. For the constraint rows, also `CREATE INDEX FOR (n:N) ON (n.v)`, wait until it is `OPERATIONAL`, and for DROP create the constraint first and wait until it is `OPERATIONAL`. 2. Client A runs a long read: `GRAPH.RO_QUERY q "MATCH (n:N) WITH n LIMIT 2000 UNWIND range(1, 200000) AS x RETURN count(x)"`. 3. One second later, client B sends the command in the table to `q`. 4. Client C sends `PING` every 10 ms throughout.  Both engines on the same machine (GCE n4-standard-16), each on a fresh server. C is `falkordb/falkordb-server:edge-c` at `sha256:2364d41f…` (master a61fbb67a). The read takes about 9 s on Rust and 23 s on C, so each engine's PING column compares with its own control row.  | Client B, during the read | Rust: B replied after | Rust: worst PING | C: B replied after | C: worst PING | |---|---|---|---|---| | nothing (control) | – | 0.5 

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

### Incident Patch 1: `dd1c68a0` (2026-11-15)
**Commit Message**: chore: fix all pedantic/nursery/cargo clippy warnings (#3787)

* chore: fix all pedantic/nursery/cargo clippy warnings

Clean under the strict set the repo's .vscode/settings.json runs:

  cargo clippy --workspace --all-targets -- -W clippy::pedantic \
    -W clippy::nursery -W clippy::cargo -A clippy::missing-errors-doc \
    -A clippy::missing-panics-doc -A clippy::doc-markdown

375 unique warnings -> 0. Most are clippy's own rewrites (use_self,
redundant_clone, redundant_pub_crate, map_or, const fn, ...). Hand-made:

- 1-byte IndexType/EntityType passed by value instead of by reference.
- apply_pow, apply_one and add_argument_to_leaves borrow instead of
  taking ownership; drops two Value clones in pow().
- telemetry shutdown no longer holds FIELD_NAME_STRINGS' mutex while it
  frees every name.
- assert!(x.is_empty()) -> assert_eq!(x, []) so failures print the value.
- `const` items hoisted above statements; long first doc paragraphs split.

Where the lint is wrong or the shape is deliberate, a scoped
#[allow(..., reason = "...")] says why (11 sites), e.g. QuerySession is
taken by value because dropping it releases the locks, and the CASE
null-semantics matches keep their per-a

**File**: `.claude/skills/build/SKILL.md` (modified, +13/-4)
```diff
@@ -58,23 +58,32 @@ cargo build --release  # release build -> target/release/libfalkordb.{so,dylib}
 
 ```bash
 cargo fmt --all -- --check
-CXX=clang++ cargo clippy --all-targets
+CXX=clang++ cargo clippy --workspace --all-targets -- -D warnings
+CXX=clang++ cargo clippy -p falkordb-rs -p graph --all-targets --features index-falkordb -- -D warnings
+cargo clippy --all-targets --manifest-path native-deps/Cargo.toml -- -D warnings
 ```
 
+- The lint set is strict: pedantic, nursery and cargo, from `[workspace.lints]`
+  in `Cargo.toml` (and `[lints]` in `native-deps/Cargo.toml`), so a plain
+  `cargo clippy` shows what CI fails on. The `index-falkordb` run lints the
+  native index, which the default build does not compile.
+- In `native-deps`, `src/recipes/`, `src/toolchain.rs` and `src/util.rs` feed
+  the dependency cache key: a style edit there rebuilds all three native deps
+  everywhere. Allow their lints on the `mod` line in `src/lib.rs` instead.
+
 - `CXX=clang++` is required for clippy (and any build invoking the GraphBLAS
   FFI bindings under `graph/src/graph/graphblas/`, whose bindgen output is
   `graphblas/mod.rs`) — without it, clippy fails trying to compile the C shims.
 - Format check uses the project's `rustfmt.toml` (vertical function-parameter
   layout). Run `cargo fmt --all` (no `--check`) to auto-fix.
 - Run format + build + clippy together, in that order, for a full check —
   fail fast on formatting before spending time on a full compile.
-- For a stricter, opt-in clippy pass (pedantic/nursery/cargo lints, plus an
-  auto-fix mode) see the `lint` skill.
+- To auto-fix clippy warnings, see the `lint` skill.
 
 ## Notes
 
 - CI (`.github/workflows/rust-pr.yml`) runs the same `cargo fmt --all --check`
-  and `CXX=clang++ cargo clippy --all-targets` (pinned to a specific
+  and the clippy commands above (pinned to a specific
   `clang++` version in CI containers; any reasonably recent local `clang++`
   works).
 - Cross-platform release *artifacts* (Linux `.so`, macOS `.dylib`) and
```

**File**: `.claude/skills/lint/SKILL.md` (modified, +36/-25)
```diff
@@ -1,40 +1,51 @@
 ---
 name: lint
-description: Run FalkorDB's stricter opt-in Clippy pass (pedantic/nursery/cargo lints) beyond the basic CI gate, optionally auto-fixing. Use when asked for a deep/strict lint pass or to auto-fix clippy warnings; for the standard fmt+clippy CI gate use the build skill.
+description: Auto-fix FalkorDB's strict Clippy lints (pedantic/nursery/cargo, enforced by CI with -D warnings) and resolve what --fix cannot. Use when asked to fix clippy warnings or when CI's Lint job fails; for the plain fmt+clippy check use the build skill.
 allowed-tools: Bash
 ---
 
-# Lint (advanced)
+# Lint (auto-fix)
 
-The `build` skill runs the CI gate (`cargo fmt --all -- --check` +
-`CXX=clang++ cargo clippy --all-targets`). This skill is the stricter,
-opt-in pass: pedantic + nursery + cargo lints, and an optional auto-fix.
+CI fails on any clippy warning. The lint set (pedantic, nursery, cargo, minus
+`missing_errors_doc`, `missing_panics_doc` and `doc_markdown`) lives in
+`[workspace.lints]` in `Cargo.toml` and `[lints]` in `native-deps/Cargo.toml`,
+so plain `cargo clippy` shows exactly what CI checks. The `build` skill has
+the check commands.
 
-## Deep clippy pass
+## Auto-fix
 
 ```bash
-CXX=clang++ cargo clippy --all-targets -- \
-  -W clippy::pedantic -W clippy::nursery -W clippy::cargo \
-  -A clippy::missing-errors-doc -A clippy::missing-panics-doc
+CXX=${CXX:-clang++} cargo clippy --fix --allow-dirty --workspace --all-targets
+CXX=${CXX:-clang++} cargo clippy --fix --allow-dirty -p falkordb-rs -p graph --all-targets --features index-falkordb
+cargo clippy --fix --allow-dirty --all-targets --manifest-path native-deps/Cargo.toml
+cargo fmt --all
+cargo fmt --all --manifest-path native-deps/Cargo.toml
 ```
 
-## Auto-fix where possible
+`--fix` rewrites source in place; review the diff (its `map_or` rewrites can
+delete comments inside match arms). Run it for both feature sets: code under
+`index-falkordb` is only seen by the second run.
 
-```bash
-CXX=clang++ cargo clippy --all-targets --fix --allow-dirty --allow-staged -- \
-  -W clippy::pedantic -W clippy::nursery -W clippy::cargo \
-  -A clippy::missing-errors-doc -A clippy::missing-panics-doc
-```
-`--fix` rewrites your source in place — review the diff afterward.
+## When --fix rolls back ("errors present after applying fixes")
+
+One suggestion did not compile, so cargo reverted the whole crate. Rerun with
+`--broken-code` to keep the fixes, then repair the few that broke. Known cases:
+
+- `redundant_closure_for_method_calls`: `|r| r.string()` → `Reader::string`
+  loses a closure that must work for any borrow lifetime. Keep the closure.
+- `missing_const_for_fn`: a fn made `const` in one feature set may call
+  non-const code under the other (`#[cfg(feature = ...)]` bodies).
+- `wildcard_imports`: the expanded list differs per feature set. Keep `*`.
+- `redundant_clone` on a `Range` drops the clone but not the need for `mut`.
 
-## Notes
+## What --fix leaves
 
-- `CXX=clang++` is required for clippy (GraphBLAS FFI), same reason as the
-  `build` skill.
-- `missing-errors-doc` / `missing-panics-doc` are deliberately allowed
-  (`-A`) to avoid noise on every fallible/panicking function.
-- These settings are stricter than CI's gate and `nursery` lints are
-  experimental (occasional false positives) — treat this as a cleanup aid,
-  not a merge blocker.
+Fix it by hand, or put a scoped `#[allow(clippy::<lint>, reason = "...")]` on
+the narrowest item it covers (a bench/test module at most), never crate-wide.
+Changing a signature (`&T` → `T`, `Vec` → slice, dropping a `Result` that
+cannot fail) also means updating its callers.
 
-If any lints fail, report the errors clearly and help fix them.
+In `native-deps`, do not edit `src/recipes/`, `src/toolchain.rs` or
+`src/util.rs` for a lint: they feed the dependency cache key, so any edit
+rebuilds GraphBLAS, LAGraph and RediSearch for everyone. Allow the lint on the
+`mod` line in `src/lib.rs`.
```

**File**: `.github/workflows/rust-pr.yml` (modified, +6/-3)
```diff
@@ -266,12 +266,15 @@ jobs:
       - name: Format
         run: cargo fmt --all --check
       - name: Lint
+        # The lint set (pedantic, nursery, cargo) is Cargo.toml's
+        # [workspace.lints]; -D warnings fails the job on any of them.
+        # --workspace, so graph's tests and build script are linted too.
         run: |
-          CXX=clang++-23 cargo clippy --all-targets
+          CXX=clang++-23 cargo clippy --workspace --all-targets -- -D warnings
       - name: Format (native-deps)
         run: cargo fmt --all --check --manifest-path native-deps/Cargo.toml
       - name: Lint (native-deps)
-        run: cargo clippy --all-targets --manifest-path native-deps/Cargo.toml
+        run: cargo clippy --all-targets --manifest-path native-deps/Cargo.toml -- -D warnings
       - name: deps/native-deps.lock is in step with the gitlinks
         # `lock --check` reads the gitlinks with `git ls-files`. This job runs in
         # a container whose user differs from the checkout's owner, so git refuses
@@ -305,7 +308,7 @@ jobs:
         # package's targets, and graph's tests are where most of the index's
         # code under the flag lives.
         run: |
-          CXX=clang++-23 cargo clippy -p falkordb-rs -p graph --all-targets --features index-falkordb
+          CXX=clang++-23 cargo clippy -p falkordb-rs -p graph --all-targets --features index-falkordb -- -D warnings
       - name: Unit tests
         # The doctests link GraphBLAS's bundled zstd and the zstd-sys crate together, and
         # both define the zstd error helpers: the same link flag `coverage` and `fuzz` pass.
```

**File**: `.vscode/settings.json` (modified, +1/-2)
```diff
@@ -1,9 +1,8 @@
 {
     "rust-analyzer.check.command": "clippy",
-    "rust-analyzer.check.extraArgs": ["--", "-W", "clippy::pedantic", "-W", "clippy::nursery", "-W", "clippy::cargo", "-A", "clippy::missing-errors-doc", "-A", "clippy::missing-panics-doc", "-A", "clippy::doc-markdown"],
     "python.testing.pytestArgs": [
         "tests"
     ],
     "python.testing.unittestEnabled": false,
     "python.testing.pytestEnabled": true
-}
\ No newline at end of file
+}
```

**File**: `CLAUDE.md` (modified, +12/-0)
```diff
@@ -214,6 +214,18 @@ Cypher Query String
   (see `src/commands/explain.rs`)
 - The parser (`cypher.rs`) is hand-written, not generated from Cypher.g4 grammar file
 - GraphBLAS FFI bindings are in `graph/src/graph/GraphBLAS.rs` (auto-generated, do not edit)
+- Keep clippy clean under the strict set: pedantic, nursery and cargo, from
+  `[workspace.lints]` in `Cargo.toml`, which CI enforces with `-D warnings`.
+  Check it before every commit, in both feature sets:
+  ```bash
+  CXX=${CXX:-clang++} cargo clippy --workspace --all-targets -- -D warnings
+  CXX=${CXX:-clang++} cargo clippy -p falkordb-rs -p graph --all-targets --features index-falkordb -- -D warnings
+  cargo clippy --all-targets --manifest-path native-deps/Cargo.toml -- -D warnings
+  ```
+  Fix every warning. Where a lint is wrong or the shape is deliberate, put a
+  scoped `#[allow(clippy::<lint>, reason = "...")]` on the narrowest item it
+  covers (a bench/test module at most), never a crate-wide allow. Review
+  `--fix` output: its `map_or` rewrites can delete comments inside match arms.
 
 ## Configuration
 
```

**File**: `Cargo.toml` (modified, +16/-0)
```diff
@@ -7,6 +7,19 @@ members = [
 # so it must not inherit this workspace's RUSTFLAGS/target (e.g. an ASAN build).
 exclude = ["native-deps"]
 
+# The clippy lints CI enforces (with `-D warnings`). Here, rather than in CI's
+# command line, so a plain `cargo clippy` (and rust-analyzer) checks the same set.
+[workspace.lints.clippy]
+pedantic = { level = "warn", priority = -1 }
+nursery = { level = "warn", priority = -1 }
+cargo = { level = "warn", priority = -1 }
+missing_errors_doc = "allow"
+missing_panics_doc = "allow"
+doc_markdown = "allow"
+
+[workspace.lints.rust]
+unexpected_cfgs = { level = "warn", check-cfg = ['cfg(tarpaulin)'] }
+
 [package]
 name = "falkordb-rs"
 version = "99.99.99"
@@ -18,6 +31,9 @@ readme = "README.md"
 keywords = ["graph", "database"]
 categories = ["database"]
 
+[lints]
+workspace = true
+
 [lib]
 crate-type = ["cdylib", "rlib"]
 name = "falkordb"
```

**File**: `fuzz/Cargo.toml` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ edition = "2024"
 [package.metadata]
 cargo-fuzz = true
 
+[lints]
+workspace = true
+
 [dependencies]
 libfuzzer-sys = "0.4"
 libc = "0.2.186"
```

**File**: `graph/Cargo.toml` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@ readme = "../README.md"
 keywords = ["graph", "database"]
 categories = ["data-structures", "database"]
 
-[lints.rust]
-unexpected_cfgs = { level = "warn", check-cfg = ['cfg(tarpaulin)'] }
+[lints]
+workspace = true
 
 [features]
 # See root Cargo.toml feature of the same name. Pass-through so the runtime
```

---

### Incident Patch 2: `6b708851` (2026-11-15)
**Commit Message**: revert: GraphBLAS wrappers for the CCH input (#3744) (#3818)

This reverts commit 36c5d7ad7a38575ccac087175e19370676ce6851, except for
the unit-test GraphBLAS start-up in graphblas/mod.rs.

CCH needs a redesign. #3744 added GraphBLAS wrappers for the CCH input
build (#3360): the CSR export, `Scalar<T>`, `Vector<f64>`,
`pattern_union`, `grb!` and the read-only effective matrix, and it
compiled `Matrix<f64>`, which was test-only, under `index-falkordb`.
Nothing on main calls them, and what the redesigned CCH needs from
GraphBLAS is not settled, so they come out until it is. `Matrix<f64>` is
test-only again.

The graphblas files go back to their state before #3744, and so do the
proofs COVERAGE.tsv rows that point into them. The optimizer_scan and
redis_layer rows go back to their old order; #3744 only reordered them.
proofs/native_index/COVERAGE.tsv keeps main's copy: #3744 only reordered
its rows, and #3737, written before #3744, has changed it since.

Kept from #3744: `test_init::ensure_init` starts GraphBLAS on a thread
that lives as long as the test process. With libomp linked statically,
as on Linux, the OpenMP runtime goes away when the thread that started
it exits, and every l

**File**: `graph/src/graph/graphblas/csr.rs` (removed, +0/-384)
```diff
@@ -1,384 +0,0 @@
-//! Row-major CSR export of a GraphBLAS matrix, copied into Rust `Vec`s: the
-//! result type of [`Matrix::into_csr`] and [`Matrix::into_csr_pattern`], and
-//! the copy itself.
-//!
-//! GraphBLAS's own `GrB_Matrix_export` writes the arrays Rust allocated. It
-//! finishes the matrix's pending work first, so every row comes out sorted; it
-//! converts hypersparse, bitmap and full storage in a scratch copy of its own;
-//! it widens 32-bit indices to 64; and it expands iso values. A matrix stored
-//! by column is first copied by row (`Matrix::copy_csr`), since the export's
-//! own transpose can leave rows unsorted. So a matrix needs no setting up
-//! before it is exported, and nothing GraphBLAS allocated is ever freed by Rust.
-
-use std::os::raw::c_int;
-
-use super::length;
-#[cfg(doc)]
-use super::matrix::Matrix;
-use super::matrix::grb;
-use super::{GrB_Format, GrB_Index, GrB_Info, GrB_Matrix, GrB_Matrix_exportSize};
-
-/// Row-major CSR export of a GraphBLAS matrix.
-///
-/// Row `r` owns the entries `row_offsets[r] .. row_offsets[r + 1]`: their column
-/// indices are that slice of `column_indices`, ascending and duplicate-free, and —
-/// unless `V` is `()`, the pattern alone — their values are the same slice of
-/// `values`. `row_offsets` has one entry per row plus one, and ends at the entry
-/// count.
-pub struct CsrExport<V> {
-    /// One offset into `column_indices` (and `values`, when non-empty) per
-    /// row, plus one.
-    pub row_offsets: Vec<u64>,
-    /// One column index per entry, ascending within each row.
-    pub column_indices: Vec<u64>,
-    /// One value per entry; empty for the pattern export (`V = ()`).
-    pub values: Vec<V>,
-}
-
-impl<V> CsrExport<V> {
-    /// The matrix's row count.
-    #[must_use]
-    pub fn row_count(&self) -> usize {
-        self.row_offsets.len() - 1
-    }
-}
-
-/// A typed `GrB_Matrix_export_*`: its `Ax` must be of the matrix's own type.
-pub(super) type ExportFn<V> = unsafe extern "C" fn(
-    *mut GrB_Index,
-    *mut GrB_Index,
-    *mut V,
-    *mut GrB_Index,
-    *mut GrB_Index,
-    *mut GrB_Index,
-    c_int,
-    GrB_Matrix,
-) -> GrB_Info;
-
-/// Copy `matrix` out as row-major CSR through `export`.
-///
-/// Rows come out sorted when `matrix` is stored by row: see `Matrix::copy_csr`.
-/// An `export` of another type than the matrix's is refused by GraphBLAS
-/// (`GrB_DOMAIN_MISMATCH`), which panics here.
-///
-/// # Safety
-/// `matrix` is live and nobody else uses it until this returns: the export
-/// finishes its pending work, a mutation.
-pub(super) unsafe fn copy_out_csr<V: Copy + Default>(
-    matrix: GrB_Matrix,
-    export: ExportFn<V>,
-) -> CsrExport<V> {
-    let format = GrB_Format::GrB_CSR_FORMAT as c_int;
-    let (mut offset_count, mut index_count, mut value_count) = (0, 0, 0);
-    // SAFETY: `matrix` is live (the caller's contract); the counts are locals.
-    grb!(unsafe {
-        GrB_Matrix_exportSize(
-            &raw mut offset_count,
-            &raw mut index_count,
-            &raw mut value_count,
-            format,
-            matrix,
-        )
-    });
-    let mut row_offsets = vec![0; length(offset_count)];
-    let mut column_indices = vec![0; length(index_count)];
-    let mut values = vec![V::default(); length(value_count)];
-    // SAFETY: each array holds the count `GrB_Matrix_exportSize` asked for,
-    // which the export checks against before writing; `export` matches the
-    // matrix's type (the caller's contract).
-    grb!(unsafe {
-        export(
-            row_offsets.as_mut_ptr(),
-            column_indices.as_mut_ptr(),
-            values.as_mut_ptr(),
-            &raw mut offset_count,
-            &raw mut index_count,
-            &raw mut value_count,
-            format,
-            matrix,
-        )
-    });
-    row_offsets.truncate(length(offset_count));
-    column_indices.truncate(length(index_count));
-    values.truncate(length(value_count));
-    CsrExport {
-        row_offsets,
-        column_indices,
-        values,
-    }
-}
-
-#[cfg(test)]
-mod tests {
-    use rand::rngs::SmallRng;
-    use rand::{RngExt, SeedableRng};
-
-    use std::ptr::null_mut;
-
-    use super::CsrExport;
-    use crate::graph::graphblas::matrix::{Matrix, grb};
-    use crate::graph::graphblas::{
-        GrB_Matrix_get_INT32, GrB_Matrix_set_INT32, GrB_Orientation, GxB_BITMAP, GxB_Context,
-        GxB_Context_Field, GxB_Context_disengage, GxB_Context_engage, GxB_Context_free,
-        GxB_Context_get_INT32, GxB_Context_new, GxB_Context_set_INT32, GxB_FULL, GxB_HYPERSPARSE,
-        GxB_Option_Field, test_init,
-    };
-
-    /// Run `body` with this thread's GraphBLAS calls on `threads` threads,
-    /// however many cores the machine has: a `GxB_Context` engaged on this
-    /// thread only, so other tests are not affected.
-    fn on_threads<R>(
-        threads: i32,
-        body: impl FnOnce() -> R,
-    ) -> R {
-        let nthreads = GxB_Context_
```

**File**: `graph/src/graph/graphblas/matrix.rs` (modified, +33/-385)
```diff
@@ -75,68 +75,41 @@ use crate::graph::graphblas::{
 /// Size of the `GxB_Container_struct` in bytes.
 const CONTAINER_STRUCT_SIZE: usize = std::mem::size_of::<super::GxB_Container_struct>();
 
-#[cfg(feature = "index-falkordb")]
-pub use super::csr::CsrExport;
-#[cfg(feature = "index-falkordb")]
-use super::csr::{ExportFn, copy_out_csr};
-#[cfg(any(test, feature = "index-falkordb"))]
-use super::length;
-#[cfg(feature = "index-falkordb")]
-use super::scalar::Scalar;
 use super::vector::Vector;
 use super::{
     GrB_BOOL, GrB_BinaryOp, GrB_DESC_C, GrB_DESC_CT0, GrB_DESC_CT0T1, GrB_DESC_CT1, GrB_DESC_R,
     GrB_DESC_RC, GrB_DESC_RCT0, GrB_DESC_RCT0T1, GrB_DESC_RCT1, GrB_DESC_RS, GrB_DESC_RSC,
     GrB_DESC_RSCT0, GrB_DESC_RSCT0T1, GrB_DESC_RSCT1, GrB_DESC_RST0, GrB_DESC_RST0T1,
     GrB_DESC_RST1, GrB_DESC_RT0, GrB_DESC_RT0T1, GrB_DESC_RT1, GrB_DESC_S, GrB_DESC_SC,
     GrB_DESC_SCT0, GrB_DESC_SCT0T1, GrB_DESC_SCT1, GrB_DESC_ST0, GrB_DESC_ST0T1, GrB_DESC_ST1,
-    GrB_DESC_T0, GrB_DESC_T0T1, GrB_DESC_T1, GrB_Descriptor, GrB_FP64, GrB_GLOBAL,
-    GrB_Global_set_INT32, GrB_Info, GrB_MIN_FP64, GrB_MIN_MONOID_FP64, GrB_Matrix,
-    GrB_Matrix_apply, GrB_Matrix_assign_BOOL, GrB_Matrix_build_BOOL, GrB_Matrix_build_FP64,
+    GrB_DESC_T0, GrB_DESC_T0T1, GrB_DESC_T1, GrB_Descriptor, GrB_GLOBAL, GrB_Global_set_INT32,
+    GrB_Info, GrB_Matrix, GrB_Matrix_apply, GrB_Matrix_assign_BOOL, GrB_Matrix_build_BOOL,
     GrB_Matrix_build_UINT64, GrB_Matrix_clear, GrB_Matrix_dup, GrB_Matrix_eWiseAdd_BinaryOp,
-    GrB_Matrix_eWiseMult_Semiring, GrB_Matrix_export_BOOL, GrB_Matrix_export_FP64,
-    GrB_Matrix_extractElement_BOOL, GrB_Matrix_extractElement_FP64,
-    GrB_Matrix_extractElement_UINT64, GrB_Matrix_extractTuples_FP64, GrB_Matrix_free,
-    GrB_Matrix_get_INT32, GrB_Matrix_ncols, GrB_Matrix_new, GrB_Matrix_nrows, GrB_Matrix_nvals,
-    GrB_Matrix_reduce_FP64, GrB_Matrix_removeElement, GrB_Matrix_resize, GrB_Matrix_select_INT64,
-    GrB_Matrix_select_UINT64, GrB_Matrix_set_INT32, GrB_Matrix_setElement_BOOL,
-    GrB_Matrix_setElement_FP64, GrB_Matrix_setElement_UINT64, GrB_Matrix_wait, GrB_Mode,
-    GrB_Monoid, GrB_OFFDIAG, GrB_ONEB_BOOL, GrB_Orientation, GrB_PLUS_MONOID_FP64,
-    GrB_SECOND_UINT64, GrB_Scalar, GrB_Scalar_free, GrB_Scalar_new, GrB_Scalar_setElement_BOOL,
-    GrB_Type, GrB_UINT64, GrB_VALUEEQ_UINT64, GrB_WaitMode, GrB_finalize, GrB_mxm, GrB_mxv,
-    GrB_transpose, GxB_ANY_BOOL, GxB_ANY_PAIR_BOOL, GxB_ANY_UINT64, GxB_Container_free,
-    GxB_Container_new, GxB_Global_Option_set_INT32, GxB_HYPERSPARSE, GxB_Iterator,
-    GxB_Iterator_free, GxB_Iterator_get_UINT64, GxB_Iterator_new, GxB_JIT_Control,
-    GxB_Matrix_build_Scalar, GxB_Matrix_eWiseUnion, GxB_Matrix_fprint, GxB_Matrix_isStoredElement,
-    GxB_Matrix_memoryUsage, GxB_Matrix_type, GxB_NTHREADS, GxB_ONE_BOOL, GxB_Option_Field,
-    GxB_PLUS_PAIR_UINT64, GxB_Print_Level, GxB_SPARSE, GxB_init, GxB_load_Matrix_from_Container,
-    GxB_rowIterator_attach, GxB_rowIterator_getColIndex, GxB_rowIterator_getRowIndex,
-    GxB_rowIterator_kount, GxB_rowIterator_nextCol, GxB_rowIterator_nextRow,
-    GxB_rowIterator_seekRow, GxB_unload_Matrix_into_Container,
+    GrB_Matrix_eWiseMult_Semiring, GrB_Matrix_extractElement_BOOL,
+    GrB_Matrix_extractElement_UINT64, GrB_Matrix_free, GrB_Matrix_get_INT32, GrB_Matrix_ncols,
+    GrB_Matrix_new, GrB_Matrix_nrows, GrB_Matrix_nvals, GrB_Matrix_removeElement,
+    GrB_Matrix_resize, GrB_Matrix_select_UINT64, GrB_Matrix_set_INT32, GrB_Matrix_setElement_BOOL,
+    GrB_Matrix_setElement_UINT64, GrB_Matrix_wait, GrB_Mode, GrB_Orientation, GrB_SECOND_UINT64,
+    GrB_Scalar, GrB_Scalar_free, GrB_Scalar_new, GrB_Scalar_setElement_BOOL, GrB_Type, GrB_UINT64,
+    GrB_VALUEEQ_UINT64, GrB_WaitMode, GrB_finalize, GrB_mxm, GrB_mxv, GrB_transpose, GxB_ANY_BOOL,
+    GxB_ANY_PAIR_BOOL, GxB_ANY_UINT64, GxB_Container_free, GxB_Container_new,
+    GxB_Global_Option_set_INT32, GxB_HYPERSPARSE, GxB_Iterator, GxB_Iterator_free,
+    GxB_Iterator_get_UINT64, GxB_Iterator_new, GxB_JIT_Control, GxB_Matrix_build_Scalar,
+    GxB_Matrix_fprint, GxB_Matrix_isStoredElement, GxB_Matrix_memoryUsage, GxB_Matrix_type,
+    GxB_NTHREADS, GxB_ONE_BOOL, GxB_Option_Field, GxB_PLUS_PAIR_UINT64, GxB_Print_Level,
+    GxB_SPARSE, GxB_init, GxB_load_Matrix_from_Container, GxB_rowIterator_attach,
+    GxB_rowIterator_getColIndex, GxB_rowIterator_getRowIndex, GxB_rowIterator_kount,
+    GxB_rowIterator_nextCol, GxB_rowIterator_nextRow, GxB_rowIterator_seekRow,
+    GxB_unload_Matrix_into_Container,
+};
+use super::{
+    GrB_FP64, GrB_Matrix_build_FP64, GrB_Matrix_extractTuples_FP64, GrB_Matrix_select_INT64,
+    GrB_Matrix_setElement_FP64, GrB_OFFDIAG,
 };
 use super::{
     GrB_GT_UINT64, GrB_Matrix_eWiseMult_BinaryOp, GrB_Matrix_select_BOOL, GrB_VALUEEQ_BOOL,
 };
 
-/// Check a `GrB_Info` and panic with the call's text on anything but success,
-/// in release too: for calls on data the caller built, where a failure is a
-/// bug, never bad inpu
```

**File**: `graph/src/graph/graphblas/mod.rs` (modified, +2/-18)
```diff
@@ -9,10 +9,8 @@
 //! ```text
 //! graphblas/
 //!   mod.rs                  <-- Auto-generated FFI bindings (GrB_* / GxB_* symbols)
-//!   matrix.rs               <-- Safe wrapper around GrB_Matrix
-//!   csr.rs                  <-- Row-major CSR export of a matrix
-//!   scalar.rs               <-- Safe wrapper around GrB_Scalar
-//!   vector.rs               <-- Safe wrapper around GrB_Vector
+//!   matrix.rs               <-- Safe wrapper around GrB_Matrix (boolean sparse matrix)
+//!   vector.rs               <-- Safe wrapper around GrB_Vector (boolean sparse vector)
 //!   tensor.rs               <-- 3D sparse structure for multi-edge storage
 //!   versioned_matrix.rs     <-- Copy-on-write matrix with MVCC delta tracking
 //!   lagraph_bindings.rs     <-- Auto-generated LAGraph FFI bindings
@@ -72,8 +70,6 @@
 
 #[cfg(test)]
 mod block_scaling_bench;
-#[cfg(feature = "index-falkordb")]
-mod csr;
 #[cfg(test)]
 mod degree_bench;
 #[cfg(test)]
@@ -83,8 +79,6 @@ pub mod lagraphx_bindings;
 pub mod matrix;
 #[cfg(test)]
 mod me_delta_bench;
-#[cfg(feature = "index-falkordb")]
-pub(crate) mod scalar;
 pub mod serialization;
 pub mod tensor;
 pub mod vector;
@@ -136,16 +130,6 @@ pub(crate) mod instr {
     }
 }
 
-/// A GraphBLAS count (`GrB_Index`, or a byte size) as a length.
-///
-/// # Panics
-/// If it does not fit a `usize`, which only a target narrower than 64 bits
-/// allows: GraphBLAS counts what this process holds in memory.
-#[cfg(any(test, feature = "index-falkordb"))]
-pub(crate) fn length(count: u64) -> usize {
-    usize::try_from(count).expect("a GraphBLAS count fits a usize")
-}
-
 /// Process-wide GraphBLAS initialization for unit tests. `GrB_init` may only
 /// be called once per process, so every `#[cfg(test)]` module must go through
 /// this shared guard rather than owning its own `Once`.
```

**File**: `graph/src/graph/graphblas/scalar.rs` (removed, +0/-115)
```diff
@@ -1,115 +0,0 @@
-//! [`Scalar`]: a typed `GrB_Scalar`, empty or holding one value, freed on drop.
-
-use std::marker::PhantomData;
-use std::ptr::null_mut;
-
-use super::matrix::grb;
-use super::{
-    GrB_BOOL, GrB_Info, GrB_Scalar, GrB_Scalar_free, GrB_Scalar_new, GrB_Scalar_setElement_BOOL,
-    GrB_Type,
-};
-
-/// A Rust type a [`Scalar`] holds: its GraphBLAS type and setter.
-pub(crate) trait ScalarElement: Copy {
-    /// The GraphBLAS type of a scalar holding `Self`.
-    fn grb_type() -> GrB_Type;
-
-    /// `GrB_Scalar_setElement_<T>`.
-    ///
-    /// # Safety
-    /// `scalar` is a live scalar of type [`Self::grb_type`].
-    unsafe fn set_element(
-        scalar: GrB_Scalar,
-        value: Self,
-    ) -> GrB_Info;
-}
-
-impl ScalarElement for bool {
-    fn grb_type() -> GrB_Type {
-        // SAFETY: a read of the type global `GrB_init` set.
-        unsafe { GrB_BOOL }
-    }
-
-    unsafe fn set_element(
-        scalar: GrB_Scalar,
-        value: Self,
-    ) -> GrB_Info {
-        unsafe { GrB_Scalar_setElement_BOOL(scalar, value) }
-    }
-}
-
-/// A `GrB_Scalar` of `T`, which this value owns and frees on drop.
-pub(crate) struct Scalar<T> {
-    scalar: GrB_Scalar,
-    element: PhantomData<T>,
-}
-
-impl<T: ScalarElement> Scalar<T> {
-    /// An empty scalar.
-    pub(crate) fn new() -> Self {
-        let mut scalar: GrB_Scalar = null_mut();
-        // SAFETY: `GrB_Scalar_new` writes a new scalar, which `Self` then frees.
-        grb!(unsafe { GrB_Scalar_new(&raw mut scalar, T::grb_type()) });
-        Self {
-            scalar,
-            element: PhantomData,
-        }
-    }
-
-    /// Hold `value`, replacing what the scalar held.
-    pub(crate) fn set(
-        &mut self,
-        value: T,
-    ) {
-        // SAFETY: our live scalar, of `T`'s type.
-        grb!(unsafe { T::set_element(self.scalar, value) });
-    }
-
-    /// The handle, for a GraphBLAS call. It stays this scalar's to free.
-    pub(crate) const fn ptr(&self) -> GrB_Scalar {
-        self.scalar
-    }
-}
-
-impl<T: ScalarElement> From<T> for Scalar<T> {
-    fn from(value: T) -> Self {
-        let mut scalar = Self::new();
-        scalar.set(value);
-        scalar
-    }
-}
-
-impl<T> Drop for Scalar<T> {
-    fn drop(&mut self) {
-        // SAFETY: `self.scalar` is live and ours alone.
-        let info = unsafe { GrB_Scalar_free(&raw mut self.scalar) };
-        debug_assert_eq!(info, GrB_Info::GrB_SUCCESS);
-    }
-}
-
-#[cfg(test)]
-mod tests {
-    use super::Scalar;
-    use crate::graph::graphblas::{GrB_Scalar_extractElement_BOOL, GrB_Scalar_nvals, test_init};
-
-    fn entries(scalar: &Scalar<bool>) -> u64 {
-        let mut count = 0;
-        // SAFETY: a live scalar.
-        unsafe { GrB_Scalar_nvals(&raw mut count, scalar.ptr()) };
-        count
-    }
-
-    #[test]
-    fn new_is_empty_and_set_holds_the_value() {
-        test_init::ensure_init();
-        let mut scalar = Scalar::<bool>::new();
-        assert_eq!(entries(&scalar), 0);
-        scalar.set(false);
-        assert_eq!(entries(&scalar), 1);
-        let mut value = true;
-        // SAFETY: a live scalar holding a `bool`.
-        unsafe { GrB_Scalar_extractElement_BOOL(&raw mut value, scalar.ptr()) };
-        assert!(!value);
-        assert_eq!(entries(&Scalar::from(true)), 1);
-    }
-}
```

**File**: `graph/src/graph/graphblas/tensor.rs` (modified, +0/-88)
```diff
@@ -130,8 +130,6 @@ use crate::graph::{
     graphblas::matrix::{BoolExtract, Uint64Extract},
 };
 
-#[cfg(feature = "index-falkordb")]
-use super::versioned_matrix::Effective;
 use super::{
     matrix::{Descriptor, Dup, Matrix},
     serialization::{Decode, Encode, Reader, Writer},
@@ -1051,21 +1049,6 @@ impl Tensor {
         &self.dm
     }
 
-    /// The effective forward adjacency `(m ∖ dm) ∪ dp` as one `UINT64`
-    /// matrix, `dp`'s value winning on a pair it shadows: no copy when both
-    /// deltas are empty (see [`Effective`]). A multi-edge pair holds
-    /// [`MULTI_EDGE`] here, as it does in every layer; its ids are in `me`.
-    #[cfg(feature = "index-falkordb")]
-    #[must_use]
-    pub(crate) fn effective_fwd(&self) -> Effective<'_, u64> {
-        // The deltas as every forward reader takes them (resynced, the fold
-        // decision latched), and the base's own wait, a no-op unless a resize
-        // flagged it: the merge reads it.
-        self.wait_fwd();
-        self.m.wait();
-        versioned_matrix::effective(&self.m, &self.dp, &self.dm)
-    }
-
     /// Structure-only `(src, dst)` iterator over the effective forward
     /// adjacency `(m ∖ dm) ∪ dp`, ignoring the stored edge-id values.
     #[must_use]
@@ -1878,77 +1861,6 @@ mod tests {
     use super::super::test_init::ensure_init;
     use super::*;
 
-    /// The effective forward matrix is the committed base itself when there
-    /// are no deltas, and `(m ∖ dm) ∪ dp` (with `dp`'s value) when there are,
-    /// checked pair by pair against the tensor's own iterator.
-    #[test]
-    #[cfg(feature = "index-falkordb")]
-    fn effective_fwd_is_the_base_or_the_merge() {
-        ensure_init();
-        const N: u64 = 1_000;
-        let mut t = Tensor::new(2 * N, 2 * N);
-        let srcs: Vec<u64> = (0..N).collect();
-        let dsts: Vec<u64> = (0..N).map(|i| i + 1).collect();
-        let ids: Vec<u64> = (0..N).collect();
-        t.set_all_from_slices(&srcs, &dsts, &ids);
-        t.wait();
-        let mut t = t.dup();
-        t.flush();
-        assert!(t.fwd_m().nvals() == N && t.fwd_dp().nvals() == 0);
-        let eff = t.effective_fwd();
-        assert!(eff.is_borrowed(), "no deltas, yet a copy");
-        assert_eq!(eff.inner(), t.fwd_m().inner());
-
-        // Pending: delete ten committed edges, add ten new pairs and a second
-        // edge on one committed pair (which promotes it to MULTI_EDGE).
-        // `(edge_id, src, dst)`.
-        let gone: Vec<(u64, u64, u64)> = (0..10).map(|i| (i * 7, i * 7, i * 7 + 1)).collect();
-        t.remove_all(&gone);
-        let new_srcs: Vec<u64> = (0..10).map(|i| N + i).chain([500]).collect();
-        let new_dsts: Vec<u64> = (0..10).map(|i| N + i + 2).chain([501]).collect();
-        let new_ids: Vec<u64> = (0..11).map(|i| 5 * N + i).collect();
-        t.set_all_from_slices(&new_srcs, &new_dsts, &new_ids);
-        t.wait();
-        assert!(t.fwd_dp().nvals() > 0 && t.fwd_dm().nvals() > 0);
-
-        let eff = t.effective_fwd();
-        assert!(!eff.is_borrowed());
-        let mut want: FxHashMap<(u64, u64), Vec<u64>> = FxHashMap::default();
-        for (s, d, id) in t.iter_edges() {
-            want.entry((s, d)).or_default().push(id);
-        }
-        assert_eq!(eff.nvals(), want.len() as u64);
-        for ((s, d), ids) in &want {
-            let expect = if ids.len() == 1 { ids[0] } else { MULTI_EDGE };
-            assert_eq!(eff.get(*s, *d), Some(expect), "({s}, {d})");
-        }
-        assert_eq!(eff.get(500, 501), Some(MULTI_EDGE));
-        assert_eq!(eff.get(7, 8), None);
-    }
-
-    /// `effective_fwd` reads the deltas as every other forward reader does,
-    /// through `wait_fwd`: each delta's counter pinned to its exact size and
-    /// the fold decision latched (here a delta the size of the base: fold).
-    #[test]
-    #[cfg(feature = "index-falkordb")]
-    fn effective_fwd_resyncs_and_latches_like_every_forward_reader() {
-        ensure_init();
-        const N: u64 = 1_000;
-        let mut t = Tensor::new(2 * N, 2 * N);
-        let ids: Vec<u64> = (0..N).collect();
-        t.set_all_from_slices(&ids, &ids, &ids);
-        t.wait();
-        let mut t = t.dup();
-        t.flush();
-        let srcs: Vec<u64> = (N..2 * N).collect();
-        let new_ids: Vec<u64> = (N..2 * N).collect();
-        t.set_all_from_slices(&srcs, &ids, &new_ids);
-        assert!(!t.dp.folding());
-        let _ = t.effective_fwd();
-        assert!(t.dp.folding());
-        assert_eq!(t.dp.count(), t.dp.nvals());
-    }
-
     /// Edge id 0 must survive the bool round-trips in the delta layers: the
     /// bulk `remove_all` path derives `dm` from the committed u64 matrix, and
     /// `extract` derives a bool pattern from it. Any op that *typecasts* the
```

**File**: `graph/src/graph/graphblas/vector.rs` (modified, +14/-78)
```diff
@@ -1,10 +1,8 @@
-//! Safe Rust wrapper around GraphBLAS sparse vectors.
+//! Safe Rust wrapper around GraphBLAS boolean sparse vectors.
 //!
 //! This module provides [`Vector<T>`], which wraps `GrB_Vector` from the
-//! SuiteSparse:GraphBLAS C library. Three element types are implemented:
-//! `Vector<bool>`, used to represent sets of node IDs efficiently;
-//! `Vector<u64>`, a count or an id per index; and, with the `index-falkordb` feature,
-//! `Vector<f64>`, a weight per index.
+//! SuiteSparse:GraphBLAS C library. Currently only `Vector<bool>` is
+//! implemented, used to represent sets of node IDs efficiently.
 //!
 //! ## Use Cases
 //!
@@ -48,10 +46,6 @@ use crate::graph::graphblas::{
     GrB_Vector_setElement_UINT64, GxB_Vector_build_Scalar,
 };
 
-#[cfg(feature = "index-falkordb")]
-use super::length;
-#[cfg(feature = "index-falkordb")]
-use super::matrix::grb;
 use super::serialization::{Decode, Encode, Reader, Writer};
 use super::{
     GrB_BOOL, GrB_Info, GrB_Type, GrB_Type_get_String, GrB_Vector, GrB_Vector_free, GrB_Vector_new,
@@ -62,11 +56,10 @@ use super::{
     GxB_Vector_Iterator_seek, GxB_Vector_deserialize, GxB_Vector_load, GxB_Vector_serialize,
     GxB_Vector_unload,
 };
-use super::{GrB_FP64, GrB_Vector_extractTuples_FP64, GrB_Vector_nvals};
 
 /// A sparse vector backed by GraphBLAS.
 ///
-/// Generic over element type T: `bool`, `u64` and (with `index-falkordb`) `f64`.
+/// Generic over element type T, though currently only bool is implemented.
 /// The vector automatically frees its GraphBLAS resources on drop.
 pub struct Vector<T> {
     v: GrB_Vector,
@@ -104,26 +97,12 @@ impl From<GrB_Vector> for Vector<u64> {
 }
 
 impl<T> Vector<T> {
-    #[must_use]
-    pub const fn ptr(&self) -> GrB_Vector {
-        self.v
-    }
-
     pub fn clear(&mut self) {
         unsafe {
             let info = GrB_Vector_clear(self.v);
             debug_assert_eq!(info, GrB_Info::GrB_SUCCESS);
         }
     }
-
-    /// The number of stored entries.
-    #[cfg(feature = "index-falkordb")]
-    #[must_use]
-    fn nvals(&self) -> u64 {
-        let mut nvals = 0;
-        grb!(unsafe { GrB_Vector_nvals(&raw mut nvals, self.v) });
-        nvals
-    }
 }
 
 impl Vector<bool> {
@@ -191,6 +170,11 @@ impl Vector<bool> {
         v
     }
 
+    #[must_use]
+    pub const fn ptr(&self) -> GrB_Vector {
+        self.v
+    }
+
     #[must_use]
     #[allow(clippy::iter_without_into_iter)]
     pub fn iter(&self) -> Iter<bool> {
@@ -470,39 +454,6 @@ impl Decode<19> for Vector<bool> {
     }
 }
 
-/// `FP64` vectors, as a weight per index (e.g. a minimum per row).
-#[cfg(feature = "index-falkordb")]
-impl Vector<f64> {
-    #[must_use]
-    pub(crate) fn new(nrows: u64) -> Self {
-        let mut v: GrB_Vector = null_mut();
-        grb!(unsafe { GrB_Vector_new(&raw mut v, GrB_FP64, nrows) });
-        Self {
-            v,
-            phantom: PhantomData,
-        }
-    }
-
-    /// Every stored entry as parallel index and value arrays, in index order.
-    #[must_use]
-    pub(crate) fn extract_tuples(&self) -> (Vec<u64>, Vec<f64>) {
-        let mut count = self.nvals();
-        let mut indices = vec![0; length(count)];
-        let mut values = vec![0.0; length(count)];
-        grb!(unsafe {
-            GrB_Vector_extractTuples_FP64(
-                indices.as_mut_ptr(),
-                values.as_mut_ptr(),
-                &raw mut count,
-                self.v,
-            )
-        });
-        indices.truncate(length(count));
-        values.truncate(length(count));
-        (indices, values)
-    }
-}
-
 impl Vector<u64> {
     pub fn new(nrows: u64) -> Self {
         unsafe {
@@ -537,6 +488,11 @@ impl Vector<u64> {
         Iter::new(self)
     }
 
+    #[must_use]
+    pub const fn ptr(&self) -> GrB_Vector {
+        self.v
+    }
+
     /// The sum of the stored values (`PLUS` monoid; 0 when empty).
     #[must_use]
     pub fn sum(&self) -> u64 {
@@ -860,23 +816,3 @@ mod decode_tests {
         }
     }
 }
-
-#[cfg(all(test, feature = "index-falkordb"))]
-mod fp64_tests {
-    use super::super::GrB_Vector_setElement_FP64;
-    use super::super::test_init::ensure_init;
-    use super::{Vector, grb};
-
-    /// Every entry, in index order, a stored `0.0` included; absent indices
-    /// are not reported.
-    #[test]
-    fn extract_tuples_returns_every_entry_in_index_order() {
-        ensure_init();
-        let v = Vector::<f64>::new(10);
-        assert_eq!(v.extract_tuples(), (vec![], vec![]));
-        for (i, x) in [(7, 2.5), (1, 0.0), (4, -1.0)] {
-            grb!(unsafe { GrB_Vector_setElement_FP64(v.ptr(), x, i) });
-        }
-        assert_eq!(v.extract_tuples(), (vec![1, 4, 7], vec![0.0, -1.0, 2.5]));
-    }
-}
```

**File**: `graph/src/graph/graphblas/versioned_matrix.rs` (modified, +1/-114)
```diff
@@ -69,8 +69,6 @@
 //! position), producing the effective state — sorted by `(row, col)` —
 //! without materializing a merged matrix or issuing per-entry point lookups.
 
-#[cfg(feature = "index-falkordb")]
-use std::borrow;
 use std::ops::Deref;
 use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
 
@@ -82,72 +80,9 @@ use super::{
 };
 use crate::graph::{
     cow::Cow,
-    graphblas::matrix::{BoolExtract, EWiseAdd, IterExtract, MatrixType},
+    graphblas::matrix::{BoolExtract, IterExtract, MatrixType},
 };
 
-/// The effective matrix of a base and its two delta layers, `(m ∖ dm) ∪ dp`,
-/// as [`effective`] returns it: the base itself, borrowed, when neither delta
-/// holds anything; a new matrix of its own otherwise. Read it through
-/// `Deref`, which never copies.
-///
-/// Read-only on purpose. `Matrix`'s `Clone` is shallow (a clone shares the
-/// GraphBLAS handle), so a `Cow`'s `to_mut` or `into_owned` on a borrowed
-/// base would hand out the shared base itself, and a write through it would
-/// change every version that holds it. A matrix of one's own is a `dup()`.
-#[cfg(feature = "index-falkordb")]
-pub(crate) struct Effective<'a, T>(borrow::Cow<'a, Matrix<T>>);
-
-#[cfg(feature = "index-falkordb")]
-impl<T> Effective<'_, T> {
-    /// Whether this is the base itself, not a merged copy.
-    #[cfg(test)]
-    pub(crate) fn is_borrowed(&self) -> bool {
-        matches!(self.0, borrow::Cow::Borrowed(_))
-    }
-}
-
-#[cfg(feature = "index-falkordb")]
-impl<T> Deref for Effective<'_, T> {
-    type Target = Matrix<T>;
-
-    fn deref(&self) -> &Matrix<T> {
-        &self.0
-    }
-}
-
-/// `(m ∖ dm) ∪ dp` in one GraphBLAS call: `eff<¬dm> = m ⊕ dp` (into a new matrix), with
-/// `⊕` from the element type ([`EWiseAdd`]), so on a `u64` layer a pending
-/// value in `dp` shadows the committed one; `dp ∩ dm = ∅`, so the mask never
-/// drops a pending addition. The mask is structural: a pair is deleted by
-/// being in `dm`, whatever value `dm` stores there. The delta fold writes the
-/// same union into the new base with a valued mask, which reads alike because
-/// `dm` stores only `true`; here it goes into a matrix of its own, and is
-/// skipped entirely when both deltas are empty.
-///
-/// The layers must not have pending work: reading a pending layer finishes
-/// that work, a mutation of a matrix readers may share. The callers wait
-/// first.
-#[cfg(feature = "index-falkordb")]
-pub(super) fn effective<'a, T: EWiseAdd + MatrixType>(
-    m: &'a Matrix<T>,
-    dp: &Matrix<T>,
-    dm: &Matrix<bool>,
-) -> Effective<'a, T> {
-    let (has_dp, has_dm) = (dp.nvals() != 0, dm.nvals() != 0);
-    if !has_dp && !has_dm {
-        return Effective(borrow::Cow::Borrowed(m));
-    }
-    let mut eff = T::new_matrix(m.nrows(), m.ncols());
-    let (mask, desc) = if has_dm {
-        (Some(dm), Some(matrix::Descriptor::SC))
-    } else {
-        (None, None)
-    };
-    eff.element_wise_add(mask, Some(m), Some(dp), desc);
-    eff.wait();
-    Effective(borrow::Cow::Owned(eff))
-}
-
 /// A delta layer is folded into the base once its size justifies a base
 /// rewrite. Every write transaction pays `O(|delta|)` just to touch a shared
 /// delta, while a fold costs a fixed `F` amortized over the entries the
@@ -757,21 +692,6 @@ impl<T> VersionedMatrix<T> {
         &self.dm
     }
 
-    /// The matrix a reader sees, `(m ∖ dm) ∪ dp`, as one GraphBLAS matrix
-    /// (see [`Effective`]): no copy when both deltas are empty.
-    #[cfg(feature = "index-falkordb")]
-    #[must_use]
-    pub(crate) fn effective(&self) -> Effective<'_, T>
-    where
-        T: EWiseAdd + MatrixType,
-    {
-        // As every reader: the deltas resynced and the fold decision latched;
-        // then the base, which the merge reads.
-        self.wait();
-        self.m.wait();
-        effective(&self.m, &self.dp, &self.dm)
-    }
-
     #[must_use]
     pub fn nrows(&self) -> u64 {
         self.m.nrows()
@@ -1607,43 +1527,10 @@ mod tests {
 
     use super::super::matrix::{Dup, Matrix};
     use super::super::test_init::ensure_init;
-    #[cfg(feature = "index-falkordb")]
-    use super::effective;
     use super::{
         MIN_FOLD_DELTA, READ_FOLD_K, VersionedMatrix, WRITE_FOLD_K, should_fold, should_fold_read,
     };
 
-    /// `dm` masks structurally: a pair stored in `dm` is deleted even when
-    /// the stored value is `false`. A valued mask would read that `false` as
-    /// "not deleted" and let the committed entry through. Checked with `dm`
-    /// alone and with a pending addition in `dp`.
-    #[test]
-    #[cfg(feature = "index-falkordb")]
-    fn effective_masks_dm_by_structure_not_value() {
-        ensure_init();
-        let mut m = Matrix::<u64>::new(4, 4);
-        m.set(0, 1, 10);
-        m.set(2, 3, 20);
-        m.wait();
-        let mut dm = Matrix::<bool>::new(4, 4);
-        dm.set(0, 1, false);
-        dm.wait();
-        assert_eq!(dm.get(0, 1), Some(false), "an explicit stored
```

**File**: `proofs/optimizer_scan/COVERAGE.tsv` (modified, +3/-3)
```diff
@@ -48,6 +48,7 @@ graph/src/planner/optimizer/utilize_index.rs	subtree_has_any_property	569	PROVEN
 graph/src/planner/optimizer/utilize_index.rs	list_has_nested_list	582	PROVEN	Cleanup.nestedListE_iff
 graph/src/planner/optimizer/utilize_index.rs	try_in_filter_scan	602	PROVEN	Index.trySingle inn arm; sel_inList, trySingle_spec; IndexCex C7/C8/C9 counterexamples
 graph/src/planner/optimizer/utilize_index.rs	try_single_filter_scan	658	PROVEN	Index.trySingle; trySingle_spec
+graph/src/planner/optimizer/utilize_index.rs	try_filter_pushdown	727	PROVEN	Index.tryPushdown/pushAnd/pushOr; pushAnd_spec, pushOr_spec, utilize_sound (an array-contains conjunct keeps its filter since #3736: C10 now states agreement)
 graph/src/planner/optimizer/utilize_index.rs	needs_post_filter	802	PROVEN	Index.needsPost; used in utilize_sound (¬keep ⇒ canUtilize); IndexCex C3/C4 (Date/computed constants)
 graph/src/planner/optimizer/utilize_index.rs	is_non_indexable_subexpr	855	PROVEN	Cleanup.nonIdxD_spec
 graph/src/planner/optimizer/utilize_index.rs	rewrite_until_stable	881	PROVEN	Cleanup.untilStable_preserves, untilStable_stable
@@ -60,9 +61,6 @@ graph/src/planner/optimizer/utilize_index.rs	prune_all_node_scan_child	1051	PROV
 graph/src/planner/optimizer/utilize_index.rs	add_to_labels_filter	1080	PROVEN	Cleanup.addToLabels_idem, hasLabelsSem
 graph/src/planner/optimizer/utilize_index.rs	utilize_index	1120	PROVEN	Cleanup.utilizeIndex_sound (4 passes compose), Index.utilize_sound, Cleanup.tryIndexRewrite_sound/_pending_sound, EdgeInline.edge_utilize_sound
 graph/src/planner/optimizer/utilize_index.rs	is_has_labels_for	1138	PROVEN	Cleanup.isHasLabelsFor_build, addToLabels_idem
-graph/src/planner/optimizer/utilize_index.rs	try_filter_pushdown	727	PROVEN	Index.tryPushdown/pushAnd/pushOr; pushAnd_spec, pushOr_spec, utilize_sound (an array-contains conjunct keeps its filter since #3736: C10 now states agreement)
-graph/src/planner/optimizer/utilize_index.rs	is_array_contains	791	PROVEN	Index.isArrayContains: isArrayContains_good, tp_atom, pushAnd (C10 agreement)
-graph/src/planner/optimizer/utilize_index.rs	try_filter_pushdown/array-contains	727	MODELLED	the AND branch keeping an array-contains conjunct's filter (#3736): pushAnd models it, but utilize_sound assumes goodA, which excludes array-contains (as it does the standalone branch); checked by decide only (IndexCex C10)
 graph/src/planner/optimizer/utilize_node_by_id.rs	get_id_filter	52	PROVEN	IdSeek.getIdFilter: getIdFilter_spec, getIdFilter_other_scope ((id, scope) since #2390), flip_correct, flip_flip
 graph/src/planner/optimizer/utilize_node_by_id.rs	utilize_node_by_id	95	PROVEN	IdSeek.collectFilters + seek_sound (with runtime.rs evaluate_id_filter; empty graph since #3394); counterexamples negative/float/null; hazard: parent().unwrap() at line 106 (W4-plan-4 repro rejected by validation since #3297)
 graph/src/planner/optimizer/reorder_labels.rs	reorder_labels	16	PROVEN	ScanOrder.reorderLabels_sound, sortBy_perm
@@ -73,3 +71,5 @@ graph/src/runtime/ops/node_by_index_scan.rs	new	58	PROVEN	EdgeInline.extraLabels
 graph/src/runtime/ops/node_by_index_scan.rs	can_utilize_index	253	PROVEN	EdgeInline.canUtilize_empty; Index.cu_inList, cu_merge, canUtilize_inList_eq_or (InList arm, #2383: same terms as the old Or)
 graph/src/runtime/ops/node_by_index_scan.rs	is_indexable	256	PROVEN	EdgeInline.isIndexable_spec
 graph/src/runtime/ops/node_by_index_scan.rs	next	302	PROVEN	EdgeInline.scanRow_eq_sel; Index.utilize_sound
+graph/src/planner/optimizer/utilize_index.rs	is_array_contains	791	PROVEN	Index.isArrayContains: isArrayContains_good, tp_atom, pushAnd (C10 agreement)
+graph/src/planner/optimizer/utilize_index.rs	try_filter_pushdown/array-contains	727	MODELLED	the AND branch keeping an array-contains conjunct's filter (#3736): pushAnd models it, but utilize_sound assumes goodA, which excludes array-contains (as it does the standalone branch); checked by decide only (IndexCex C10)
```

---

### Incident Patch 3: `bbabafe0` (2026-11-16)
**Commit Message**: fix(fuzz): initialise RediSearch in the fuzz harnesses so index queries don't crash (#3839)

* fix(fuzz): initialise RediSearch in the fuzz harnesses so index queries don't crash

RediSearch allocates through the RedisModule_* function pointers that Redis
fills in when it loads a module. The fuzz harnesses have no Redis, so they
were null and any index DDL (`CREATE INDEX ON :L(p)`) jumped to address 0
(rm_calloc in RediSearch_CreateIndexOptions): AFL found it as sig 11.

Add graph::fuzz_support::init_index_support (behind a new `fuzz` feature of
`graph`), shared by runtime-fuzz-target and the libFuzzer target. It points
the allocator at libc, stubs the callbacks index creation/drop/population
make (log, string handling, event subscription, thread-safe contexts),
calls RediSearch_Init(REDISEARCH_INIT_LIBRARY) and starts the one-worker
global thread pool that index population and drops are spawned on. The
commented-out setup in the libFuzzer target is replaced by the helper.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: list the fuzz harness support functions as TEST-ONLY

graph/src/fuzz_support.rs is compiled only with the `fuzz` feature, for the
fuzz targets, so it

**File**: `Cargo.lock` (modified, +10/-0)
```diff
@@ -477,6 +477,14 @@ dependencies = [
  "slab",
 ]
 
+[[package]]
+name = "fuzz-support"
+version = "0.1.0"
+dependencies = [
+ "graph",
+ "libc",
+]
+
 [[package]]
 name = "generic-array"
 version = "0.14.7"
@@ -573,6 +581,7 @@ dependencies = [
 name = "graph-fuzz"
 version = "0.0.0"
 dependencies = [
+ "fuzz-support",
  "graph",
  "libc",
  "libfuzzer-sys",
@@ -1393,6 +1402,7 @@ name = "runtime-fuzz-target"
 version = "0.1.0"
 dependencies = [
  "afl",
+ "fuzz-support",
  "graph",
 ]
 
```

**File**: `Cargo.toml` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@
 members = [
     "graph",
     "fuzz",
-    "runtime-fuzz-target", ]
+    "runtime-fuzz-target",
+    "fuzz-support", ]
 # native-deps is its own workspace: graph/build.rs uses it as a build-dependency,
 # so it must not inherit this workspace's RUSTFLAGS/target (e.g. an ASAN build).
 exclude = ["native-deps"]
```

**File**: `fuzz-support/Cargo.toml` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+[package]
+name = "fuzz-support"
+version = "0.1.0"
+edition = "2024"
+description = "Process setup the fuzz harnesses need because they run the engine without Redis"
+license = "SSPL-1.0"
+repository = "https://github.com/FalkorDB/FalkorDB"
+readme = "../README.md"
+keywords = ["graph", "database"]
+categories = ["data-structures", "database"]
+publish = false
+
+[lints]
+workspace = true
+
+[dependencies]
+libc = "0.2"
+
+[dependencies.graph]
+path = "../graph"
```

**File**: `fuzz-support/src/lib.rs` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+//! Setup shared by the fuzz harnesses (`runtime-fuzz-target`, `fuzz/`). A crate of its
+//! own, so the engine (`graph`) carries no fuzz-only code.
+//!
+//! The harnesses run the engine in-process with no Redis. RediSearch calls the
+//! `RedisModule_*` function pointers that Redis fills in when it loads a module,
+//! so without Redis they are null and the first call (e.g. `rm_calloc` in
+//! `CREATE INDEX`) jumps to address 0. [`init_index_support`] fills in the ones the
+//! library-mode paths use and initialises RediSearch as `module_init` does.
+
+// Dependency version duplicates are from transitive dependencies.
+#![allow(clippy::multiple_crate_versions)]
+
+use std::ffi::{c_char, c_int};
+use std::ptr::null_mut;
+use std::slice::from_raw_parts;
+use std::sync::atomic::{AtomicUsize, Ordering};
+
+use graph::index::redisearch::{
+    REDISEARCH_INIT_LIBRARY, RediSearch_Init,
+    redis::{
+        REDISMODULE_OK, RedisModule_Alloc, RedisModule_Calloc, RedisModule_CreateString,
+        RedisModule_CreateStringFromString, RedisModule_Free, RedisModule_FreeString,
+        RedisModule_FreeThreadSafeContext, RedisModule_GetDetachedThreadSafeContext,
+        RedisModule_HoldString, RedisModule_Log, RedisModule_Realloc, RedisModule_RetainString,
+        RedisModule_Strdup, RedisModule_StringPtrLen, RedisModule_SubscribeToServerEvent,
+        RedisModule_TrimStringAllocation, RedisModuleCtx, RedisModuleEvent,
+        RedisModuleEventCallback, RedisModuleString,
+    },
+};
+use graph::threadpool::init_thread_pool;
+
+/// A `RedisModuleString` is opaque to RediSearch; the fuzz stand-in owns its bytes and
+/// is reference counted because RediSearch retains and holds strings.
+struct FuzzString {
+    refs: AtomicUsize,
+    bytes: Box<[u8]>,
+}
+
+impl FuzzString {
+    fn alloc(bytes: Box<[u8]>) -> *mut RedisModuleString {
+        Box::into_raw(Box::new(Self {
+            refs: AtomicUsize::new(1),
+            bytes,
+        }))
+        .cast()
+    }
+}
+
+const unsafe extern "C" fn mock_get_detached_ctx(_ctx: *mut RedisModuleCtx) -> *mut RedisModuleCtx {
+    null_mut()
+}
+
+const unsafe extern "C" fn mock_free_ctx(_ctx: *mut RedisModuleCtx) {}
+
+const unsafe extern "C" fn mock_log(
+    _ctx: *mut RedisModuleCtx,
+    _level: *const c_char,
+    _fmt: *const c_char,
+) {
+}
+
+#[allow(
+    clippy::cast_possible_truncation,
+    reason = "REDISMODULE_OK is the bindgen constant 0"
+)]
+const unsafe extern "C" fn mock_subscribe(
+    _ctx: *mut RedisModuleCtx,
+    _event: RedisModuleEvent,
+    _callback: RedisModuleEventCallback,
+) -> c_int {
+    REDISMODULE_OK as c_int
+}
+
+unsafe extern "C" fn mock_create_string(
+    _ctx: *mut RedisModuleCtx,
+    ptr: *const c_char,
+    len: usize,
+) -> *mut RedisModuleString {
+    let bytes = if len == 0 {
+        Box::default()
+    } else {
+        // SAFETY: the caller passes `len` readable bytes.
+        unsafe { from_raw_parts(ptr.cast::<u8>(), len) }.into()
+    };
+    FuzzString::alloc(bytes)
+}
+
+unsafe extern "C" fn mock_create_string_from_string(
+    _ctx: *mut RedisModuleCtx,
+    s: *const RedisModuleString,
+) -> *mut RedisModuleString {
+    // SAFETY: `s` came from `mock_create_string`.
+    FuzzString::alloc(unsafe { &*s.cast::<FuzzString>() }.bytes.clone())
+}
+
+unsafe extern "C" fn mock_retain_string(
+    _ctx: *mut RedisModuleCtx,
+    s: *mut RedisModuleString,
+) {
+    // SAFETY: `s` came from a `FuzzString` constructor.
+    unsafe { &*s.cast::<FuzzString>() }
+        .refs
+        .fetch_add(1, Ordering::Relaxed);
+}
+
+unsafe extern "C" fn mock_hold_string(
+    ctx: *mut RedisModuleCtx,
+    s: *mut RedisModuleString,
+) -> *mut RedisModuleString {
+    // SAFETY: as `mock_retain_string`.
+    unsafe { mock_retain_string(ctx, s) };
+    s
+}
+
+const unsafe extern "C" fn mock_trim_string_allocation(_s: *mut RedisModuleString) {}
+
+unsafe extern "C" fn mock_string_ptr_len(
+    s: *const RedisModuleString,
+    len: *mut usize,
+) -> *const c_char {
+    // SAFETY: `s` came from `mock_create_string`; `len`, when non-null, is writable.
+    let bytes = &unsafe { &*s.cast::<FuzzString>() }.bytes;
+    if !len.is_null() {
+        unsafe { len.write(bytes.len()) };
+    }
+    bytes.as_ptr().cast()
+}
+
+unsafe extern "C" fn mock_free_string(
+    _ctx: *mut RedisModuleCtx,
+    s: *mut RedisModuleString,
+) {
+    if s.is_null() {
+        return;
+    }
+    // SAFETY: `s` came from a `FuzzString` constructor; the last owner frees it.
+    unsafe {
+        if (*s.cast::<FuzzString>())
+            .refs
+            .fetch_sub(1, Ordering::AcqRel)
+            == 1
+        {
+            drop(Box::from_raw(s.cast::<FuzzString>()));
+        }
+    }
+}
+
+/// Makes index DDL and index-backed queries work without a server.
+///
+/// Points RediSearch's allocator at libc, stubs the server callbacks it makes while
+/// indexing, initialises it in library mode, and starts the one-worker global th
```

**File**: `fuzz/Cargo.toml` (modified, +3/-0)
```diff
@@ -14,6 +14,9 @@ workspace = true
 libfuzzer-sys = "0.4"
 libc = "0.2.186"
 
+[dependencies.fuzz-support]
+path = "../fuzz-support"
+
 [dependencies.graph]
 path = "../graph"
 
```

**File**: `fuzz/fuzz_targets/fuzz_target_runtime.rs` (modified, +2/-92)
```diff
@@ -1,92 +1,16 @@
-// #![feature(c_variadic)]
 #![no_main]
 
-// use libc::{atexit, calloc, free, malloc, realloc, strdup};
-
+use fuzz_support::init_index_support;
 use graph::{
     graph::{
         graph::{Graph, Plan},
         graphblas::{GrB_Mode, GrB_init},
         mvcc_graph::MvccGraph,
     },
-    // redisearch::{
-    //     REDISEARCH_INIT_LIBRARY, RediSearch_Init,
-    //     redis::{
-    //         REDISMODULE_OK, RedisModule_Alloc, RedisModule_Calloc, RedisModule_CreateString,
-    //         RedisModule_CreateStringPrintf, RedisModule_Free, RedisModule_FreeString,
-    //         RedisModule_GetThreadSafeContext, RedisModule_Log, RedisModule_Realloc,
-    //         RedisModule_Strdup, RedisModule_StringPtrLen, RedisModule_SubscribeToServerEvent,
-    //         RedisModuleBlockedClient, RedisModuleCtx, RedisModuleEvent, RedisModuleEventCallback,
-    //         RedisModuleString,
-    //     },
-    // },
     runtime::{functions::init_functions, runtime::Runtime},
 };
 use libfuzzer_sys::{Corpus, fuzz_target};
 
-// const unsafe extern "C" fn mock_get_thread_safe_context(
-//     _bc: *mut RedisModuleBlockedClient
-// ) -> *mut RedisModuleCtx {
-//     null_mut()
-// }
-
-// unsafe extern "C" fn mock_printf(
-//     _ctx: *mut RedisModuleCtx,
-//     _fmt: *const c_char,
-//     ...
-// ) -> *mut RedisModuleString {
-//     null_mut()
-// }
-
-// unsafe extern "C" fn mock_log(
-//     _ctx: *mut RedisModuleCtx,
-//     _level: *const ::std::os::raw::c_char,
-//     _fmt: *const ::std::os::raw::c_char,
-//     ...
-// ) {
-// }
-
-// unsafe extern "C" fn mock_subscribe(
-//     _ctx: *mut RedisModuleCtx,
-//     _event: RedisModuleEvent,
-//     _callback: RedisModuleEventCallback,
-// ) -> ::std::os::raw::c_int {
-//     REDISMODULE_OK as c_int
-// }
-
-// const unsafe extern "C" fn mock_create_string(
-//     _ctx: *mut RedisModuleCtx,
-//     _ptr: *const ::std::os::raw::c_char,
-//     _len: usize,
-// ) -> *mut RedisModuleString {
-//     null_mut()
-// }
-
-// const unsafe extern "C" fn mock_string_ptr_len(
-//     _str: *const RedisModuleString,
-//     len: *mut usize,
-// ) -> *const ::std::os::raw::c_char {
-//     len.write(0);
-//     null_mut()
-// }
-
-// const unsafe extern "C" fn mock_free_string(
-//     _ctx: *mut RedisModuleCtx,
-//     _str: *mut RedisModuleString,
-// ) {
-// }
-
-// unsafe extern "C" {
-//     fn RediSearch_CleanupModule();
-// }
-
-// extern "C" fn exit() {
-//     unsafe {
-//         GrB_finalize();
-//         RediSearch_CleanupModule();
-//     }
-// }
-
 /// `WriteEscalation` for the fuzzer: there is no host and no locks, so becoming a
 /// writer always succeeds. Returning `Err` instead would reject every mutating
 /// query and starve the corpus of the write paths this target exists to exercise.
@@ -104,22 +28,8 @@ impl graph::locks::WriteEscalation for AlwaysWritable {
 fuzz_target!(init: {
         unsafe {
             GrB_init(GrB_Mode::GrB_NONBLOCKING as _);
-            // RedisModule_Alloc = Some(malloc);
-            // RedisModule_Calloc = Some(calloc);
-            // RedisModule_Realloc = Some(realloc);
-            // RedisModule_Free = Some(free);
-            // RedisModule_FreeString = Some(mock_free_string);
-            // RedisModule_GetThreadSafeContext = Some(mock_get_thread_safe_context);
-            // RedisModule_CreateStringPrintf = Some(mock_printf);
-            // RedisModule_CreateString = Some(mock_create_string);
-            // RedisModule_Log = Some(mock_log);
-            // RedisModule_Strdup = Some(strdup);
-            // RedisModule_SubscribeToServerEvent = Some(mock_subscribe);
-            // RedisModule_StringPtrLen = Some(mock_string_ptr_len);
-            // let result = RediSearch_Init(null_mut(), REDISEARCH_INIT_LIBRARY as c_int);
-            // assert!(result == REDISMODULE_OK as c_int, "Failed to initialize RediSearch library");
-            // atexit(exit);
         }
+        init_index_support();
         init_functions().expect("Failed to init functions");
     },|data: &[u8]| -> Corpus {
         let g = MvccGraph::new(1024, 1024, 25, "fuzz_test");
```

**File**: `runtime-fuzz-target/Cargo.toml` (modified, +4/-1)
```diff
@@ -16,4 +16,7 @@ workspace = true
 afl = "*"
 
 [dependencies.graph]
-path = "../graph"
\ No newline at end of file
+path = "../graph"
+
+[dependencies.fuzz-support]
+path = "../fuzz-support"
```

**File**: `runtime-fuzz-target/src/main.rs` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 // Dependency version duplicates are from transitive dependencies.
 #![allow(clippy::multiple_crate_versions)]
 
+use fuzz_support::init_index_support;
 use graph::{
     graph::{
         graph::{Graph, Plan},
@@ -31,6 +32,7 @@ fn main() {
     unsafe {
         GrB_init(GrB_Mode::GrB_NONBLOCKING as _);
     }
+    init_index_support();
     init_functions().expect("Failed to init functions");
     fuzz!(|data: &[u8]| {
         if let Ok(query) = std::str::from_utf8(data) {
```

#### Recent Merged Pull Requests:
- **PR #3839** (2026-11-16): fix(fuzz): initialise RediSearch in the fuzz harnesses so index queries don't crash (@AviAvni)
- **PR #3833** (2026-11-16): ci: /proofs apply commits a held proof patch whose gates passed (@AviAvni)
- **PR #3825** (2026-11-15): chore(deps): bump the cargo-deps group across 1 directory with 4 updates (@dependabot[bot])
- **PR #3824** (2026-11-15): fix: AUTH on Valkey crashes the server in RediSearch's slot migration handler (@DvirDukhan)
- **PR #3821** (2026-11-16): fix(planner): start a chain from an equality-pinned endpoint on score ties (@AviAvni)
- **PR #3819** (2026-11-16): fix(constraint): don't freeze the server waiting for the write lock behind a long read (@DvirDukhan)

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

## X. fix all pedantic/nursery/cargo clippy warnings

**RULE**:
When implementing operations in `.claude/skills/build/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd1c68a0`: fix all pedantic/nursery/cargo clippy warnings. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/build/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
CXX=clang++ cargo clippy --workspace --all-targets -- -D warnings
CXX=clang++ cargo clippy -p falkordb-rs -p graph --all-targets --features index-falkordb -- -D warnings
cargo clippy --all-targets --manifest-path native-deps/Cargo.toml -- -D warnings
- The lint set is strict: pedantic, nursery and cargo, from `[workspace.lints]`
  in `Cargo.toml` (and `[lints]` in `native-deps/Cargo.toml`), so a plain
  `cargo clippy` shows what CI fails on. The `index-falkordb` run lints the
  native index, which the default build does not compile.
- In `native-deps`, `src/recipes/`, `src/toolchain.rs` and `src/util.rs` feed
  the dependency cache key: a style edit there rebuilds all three native deps
  everywhere. Allow their lints on the `mod` line in `src/lib.rs` instead.

- To auto-fix clippy warnings, see the `lint` skill.
  and the clippy commands above (pinned to a specific
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
CXX=clang++ cargo clippy --all-targets
- For a stricter, opt-in clippy pass (pedantic/nursery/cargo lints, plus an
  auto-fix mode) see the `lint` skill.
  and `CXX=clang++ cargo clippy --all-targets` (pinned to a specific
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd1c68a0` are properly handled with clean fallback behavior.
