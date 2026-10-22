> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `b84473a7`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T19:03:14.366Z  
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
> **Harvest Timestamp**: 2026-10-22T19:03:13.795Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10498 stars

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
- **Issue #3429** (2026-10-22): **server process dies (SIGSEGV) when a non-boolean list predicate is followed by a further stage**
  *Symptoms*: ## Summary  A 42-byte query terminates the FalkorDB server process:  ```cypher MATCH () WHERE [1, 2] WITH 1 AS x RETURN x ```  The module crashes: the client loses the connection and the container exits with code **139 (SIGSEGV)**, `OOMKilled=false`.  The predicate `[1, 2]` is a list, not a boolean. The engine returns a proper `ResponseError` for the same predicate when the query ends at that stage (`... RETURN 1`); when the query continues into a later stage (`WITH`, `MERGE`), the process is terminated instead of producing an error.  **Scope of the trigger.** The table below shows every shape that was tested. It establishes that the tested list-predicate shapes crash when a further stage follows; it does **not** establish that a list is *necessary* — only a few predicate kinds were tried.  ## Environment  - image: `falkordb/falkordb:v4.18.11` - standalone container, no compose file, no mounted data - client: `redis-py` 6.x over the Redis protocol; `socket_timeout` is a **client-side** read timeout, no server-side configuration is involved - host: Ubuntu 24.04, 48 cores, 125 GB RAM, no memory limit on the container  ## Reproduce  ```bash docker run -d --name fk-repro \   -p 6383:6379 \   -e REDIS_ARGS="--requirepass password" \   falkordb/falkordb:v4.18.11 sleep 10 python - <<'PY' import redis r = redis.Redis(host="127.0.0.1", port=6383, password="password", socket_timeout=15) print(r.ping())                       # True: the instance is healthy r.execute_command("GRAPH.QUERY

- **Issue #3427** (2026-10-21): **[C engine] Redis crashes on a two-hop variable-length path query**
  *Symptoms*:   ## Environment  - Image: `falkordb/falkordb:edge-c` - Tested image digest: `sha256:9d1333f0b545329f3a5929ee0cf501327c855e239af914f97f35e73ef5dcccab` - Run each attempt in a fresh container  ## Reproduction  Create this graph:  ```cypher CREATE (a:l7:l8:l10)-[:rt0]->(b:mid)-[:rt0]->(c:l4:l1:l11 {k11:"o", k2:534057338}) ```  Then run:  ```cypher MATCH p=(a:l7:l8:l10)-[*2]-(c:l4:l1:l11 {k11:'o', k2:534057338}) RETURN count(p) ```  ## Expected behavior  The query returns `count(p) = 1`, and the Redis server remains available.  ## Actual behavior  The Redis process exits with code `139` while executing the query. The client reports that the server closed the connection. Docker reports `OOMKilled=false`.  This reproduced in 4 of 4 fresh-container runs.  ## Control  Replacing the variable-length pattern with an equivalent fixed-length pattern returns `count(p) = 1` and leaves the server running:  ```cypher MATCH p=(a:l7:l8:l10)-[:rt0]->(b:mid)-[:rt0]->(c:l4:l1:l11 {k11:'o', k2:534057338}) RETURN count(p) ```

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

### Incident Patch 1: `b97da5a1` (2026-10-21)
**Commit Message**: fix: error replies keep UTF-8 and never panic on '一' (#3185) (#3428)

* fix: error replies keep UTF-8 and never panic on '一' (#3185)

redismodule-rs built error replies with `c as u8` per char, so a code
point whose low byte is 0 ('一' U+4E00, 'Ā' U+0100) became a NUL and
`CString::new(..).unwrap()` panicked, killing Redis; every other
non-ASCII character was truncated to a garbage byte. Point redis-module
at the fork branch that keeps the message bytes verbatim
(AviAvni/redismodule-rs#1) and add a flow test.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: move the #3185 UTF-8 error-reply test into test_query_validation

assert_error_reply (error reply + server still answers) goes to common.py
for reuse.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -253,7 +253,7 @@ dependencies = [
 [[package]]
 name = "common"
 version = "0.1.0"
-source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
+source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
 
 [[package]]
 name = "convert_case"
@@ -1191,7 +1191,7 @@ checksum = "63b8176103e19a2643978565ca18b50549f6101881c443590420e4dc998a3c69"
 [[package]]
 name = "redis-module"
 version = "99.99.99"
-source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
+source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
 dependencies = [
  "backtrace",
  "bindgen",
@@ -1213,7 +1213,7 @@ dependencies = [
 [[package]]
 name = "redis-module-macros"
 version = "99.99.99"
-source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
+source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
 dependencies = [
  "common",
  "proc-macro2",
@@ -1224,7 +1224,7 @@ dependencies = [
 [[package]]
 name = "redis-module-macros-internals"
 version = "99.99.99"
-source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
+source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
 dependencies = [
  "lazy_static",
  "proc-macro2",
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@ graph = { path = "graph", version = "0.1.0" }
 lazy_static = "1.5.0"
 libc = "0.2"
 parking_lot = { version = "0.12.5", features = ["arc_lock"] }
-redis-module = { git = "https://github.com/AviAvni/redismodule-rs", branch = "master" }
+redis-module = { git = "https://github.com/AviAvni/redismodule-rs", branch = "fix/resp-string-bytes" }
 # Pinned exactly, not caret-matched. Two engines have to serialize the same
 # ids to the same bytes (#2698), and roaring's output is not stable across
 # releases by contract: `optimize()` is path-dependent, and the container
@@ -46,7 +46,7 @@ thin-vec = "0.2.18"
 orx-tree = "2.2.0"
 
 [build-dependencies]
-redis-module-macros = { git = "https://github.com/AviAvni/redismodule-rs", branch = "master" }
+redis-module-macros = { git = "https://github.com/AviAvni/redismodule-rs", branch = "fix/resp-string-bytes" }
 
 [profile.dev]
 opt-level = 2
```

**File**: `tests/flow/common.py` (modified, +13/-0)
```diff
@@ -843,3 +843,16 @@ def wrapper(x, *args, **kwargs):
             return f(x, *args, **kwargs)
         return wrapper
     return decorate
+
+
+def assert_error_reply(env, conn, *cmd):
+    """Run `cmd`, require an error reply, and require the server to still answer
+    afterwards. Returns the error message, so callers can check its text too."""
+    try:
+        conn.execute_command(*cmd)
+        env.assertTrue(False, message=f"expected an error reply from {cmd!r}")
+        return None
+    except ResponseError as e:
+        msg = str(e)
+    env.assertTrue(conn.ping())
+    return msg
```

**File**: `tests/flow/test_query_validation.py` (modified, +14/-0)
```diff
@@ -1169,3 +1169,17 @@ def test51_pattern_comprehension_reading_a_loop_variable(self):
             self.env.assertEqual(actual, [['a', 1], ['b', 0]])
         finally:
             g.delete()
+
+    # An error reply used to be built one `char` at a time with `c as u8`, so any
+    # code point whose low byte is 0 -- '一' (U+4E00), 'Ā' (U+0100) -- became a NUL,
+    # and the `CString::new(..).unwrap()` that followed panicked and took Redis down
+    # (#3185); every other non-ASCII character came back as a garbage byte. An error
+    # reply must keep its message's UTF-8 verbatim and never take the server down.
+    def test52_error_reply_keeps_utf8_and_never_crashes(self):
+        con = self.redis_con
+        for cmd in ("GRAPH.QUERY", "GRAPH.RO_QUERY", "GRAPH.EXPLAIN"):
+            msg = assert_error_reply(self.env, con, cmd, GRAPH_ID,
+                                     "MATCH (n:Person {name:'一'}) RETURN n +")
+            self.env.assertContains("'一'", msg)
+            msg = assert_error_reply(self.env, con, cmd, GRAPH_ID, "RETURN 'Ā中文' +")
+            self.env.assertContains("Ā中文", msg)
```

---

### Incident Patch 2: `b774fdfa` (2026-10-21)
**Commit Message**: fix: validate the clauses that follow a procedure CALL (#3297)

The `Call` arm of `inner_validate` returned `Ok(())` without validating
the clauses after it, so `CALL db.labels() YIELD label MATCH (n)`
reached the planner and panicked in `utilize_node_by_id`, a trailing
UNWIND ran, and CREATE accepted two relationship types. Continue
validation like every other arm does.

Closes #3279

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `graph/src/parser/ast.rs` (modified, +2/-1)
```diff
@@ -1258,7 +1258,8 @@ impl<TVar: Eq + Hash + Display> QueryIR<TVar> {
                         "The first argument of db.idx.fulltext.drop must be a string literal",
                     ));
                 }
-                Ok(())
+                iter.next()
+                    .map_or(Ok(()), |first| first.inner_validate(iter))
             }
             Self::Match { pattern, .. } => {
                 Self::validate_inlined_properties(pattern)?;
```

**File**: `tests/flow/test_procedures.py` (modified, +34/-0)
```diff
@@ -467,3 +467,37 @@ def test12_list_functions(self):
         self.env.assertEqual(reducible, True)
         self.env.assertEqual(aggregation, False)
         self.env.assertEqual(variable_len, True)
+
+    def test13_clauses_after_call_are_validated(self):
+        # the clauses that follow a procedure call get the same checks as
+        # anywhere else; a trailing MATCH used to crash the server
+        # https://github.com/FalkorDB/FalkorDB/issues/3279
+        g = self.db.select_graph("validate_after_call")
+        g.query("CREATE (:N)")
+
+        queries = [
+            ("CALL db.labels() YIELD label MATCH (n)",
+             "Query cannot conclude with MATCH"),
+            ("CALL db.labels() YIELD label WITH label MATCH (n)",
+             "Query cannot conclude with MATCH"),
+            ("CALL db.labels() YIELD label OPTIONAL MATCH (n)",
+             "Query cannot conclude with MATCH"),
+            ("CALL db.labels() YIELD label UNWIND [1] AS x",
+             "Query cannot conclude with UNWIND"),
+            ("CALL db.labels() YIELD label CREATE (a)-[:R|S]->(b)",
+             "Exactly one relationship type must be specified for each relation in a CREATE pattern"),
+            ("CALL db.labels() YIELD label MERGE (a)-[:R|S]->(b)",
+             "Exactly one relationship type must be specified for each relation in a MERGE pattern"),
+        ]
+        for query, error in queries:
+            try:
+                g.query(query)
+                self.env.assertTrue(False, message=query)
+            except redis.ResponseError as e:
+                self.env.assertContains(error, str(e))
+
+        # nothing was created, and valid queries after a CALL still run
+        self.env.assertEqual(g.query("MATCH ()-[r]->() RETURN count(r)").result_set, [[0]])
+        result = g.query("CALL db.labels() YIELD label MATCH (n) RETURN label, labels(n)")
+        self.env.assertEqual(result.result_set, [['N', ['N']]])
+        g.delete()
```

---

### Incident Patch 3: `9212add3` (2026-10-21)
**Commit Message**: fix: an id seek on a graph without nodes no longer returns node 0 (#3353) (#3394)

`evaluate_id_filter` caps the seek range at `max_node_id()`, which is 0
both when id 0 is the only id and when no id was ever handed out. On a
graph that never had a node, `id(n) = 0`, `id(n) >= 0` and `id(n) < 3`
therefore yielded a phantom node 0, and `DELETE` on it failed with an
internal "never allocated" error. Return no range when the graph has no
live nodes.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `graph/src/runtime/runtime.rs` (modified, +6/-0)
```diff
@@ -1361,6 +1361,12 @@ impl<'a> Runtime<'a> {
                 }
             }
         }
+        // `max_node_id()` is 0 both when id 0 is the only id and when no id
+        // was ever handed out, so `min..=max` would seek a node 0 that was
+        // never created.
+        if self.g.borrow().node_count() == 0 {
+            return Ok(None);
+        }
         let mut result = RoaringTreemap::new();
         result.insert_range(min..=max);
         Ok(Some(result))
```

**File**: `tests/flow/test_node_by_id.py` (modified, +25/-0)
```diff
@@ -278,3 +278,28 @@ def test_parenthesised_id_predicates(self):
             self.env.assertNotContains("All Node Scan", plan, message=q)
             self.env.assertNotContains("Filter", plan, message=q)
             self.env.assertEqual(self.graph.query(q, params).result_set, expected, message=q)
+
+    def test_seek_on_a_graph_without_nodes(self):
+        # #3353: id 0 was sought on a graph that never had a node.
+        g = self.db.select_graph("node_by_id_empty")
+        queries = [
+            "MATCH (n) WHERE id(n) = 0 RETURN n",
+            "MATCH (n) WHERE id(n) >= 0 RETURN n",
+            "MATCH (n) WHERE id(n) < 3 RETURN n",
+            "MATCH (n) WHERE id(n) = 0 DELETE n",
+        ]
+        g.query("RETURN 1")
+        for q in queries:
+            self.env.assertContains("NodeByIdSeek", str(g.explain(q)), message=q)
+            self.env.assertEqual(g.query(q).result_set, [], message=q)
+
+        # Nor once every node it had is deleted.
+        g.query("CREATE (), ()")
+        g.query("MATCH (n) DELETE n")
+        for q in queries:
+            self.env.assertEqual(g.query(q).result_set, [], message=q)
+
+        # A node created in the same query is still found.
+        res = g.query("CREATE (a) WITH a MATCH (n) WHERE id(n) = id(a) RETURN count(n)")
+        self.env.assertEqual(res.result_set, [[1]])
+        g.delete()
```

#### Recent Merged Pull Requests:
- **PR #3474** (2026-10-22): fix(optional-traverse): guard NULL GraphBLAS vectors in CondTraverseReset (@swilly22)
- **PR #3465** (2026-10-22): [6.0] Batch backport (56 commits) (@github-actions[bot])
- **PR #3440** (2026-10-21): chore(deps): bump the cargo-deps group across 1 directory with 7 updates (@dependabot[bot])
- **PR #3428** (2026-10-21): fix: error replies keep UTF-8 and never panic on '一' (#3185) (@AviAvni)
- **PR #3422** (2026-10-21): reentrant write lock (@swilly22)
- **PR #3420** (2026-10-21): Bump GraphBLAS to 10.5.2-beta2 and regenerate PreJIT kernels (@GomezGab)

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

## X. error replies keep UTF-8 and never panic on '一' (#3185) (#3428)

**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b97da5a1`: error replies keep UTF-8 and never panic on '一' (#3185) (#3428). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
source = "git+https://github.com/AviAvni/redismodule-rs?branch=fix%2Fresp-string-bytes#324aa42bd4c0f1b2953b79fae2f3bfb373aa1903"
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
source = "git+https://github.com/AviAvni/redismodule-rs?branch=master#91a39b5dfa08dcbd18626ec4906b2f474891a03a"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b97da5a1` are properly handled with clean fallback behavior.
