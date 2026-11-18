> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `aafdc4ae`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T04:29:06.648Z  
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
> **Harvest Timestamp**: 2026-11-18T04:29:06.641Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10508 stars

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

### Incident Patch 1: `27951021` (2026-11-17)
**Commit Message**: fix: a cascaded edge of a new type no longer panics compact replies or opens a replica id gap (#3447) (#3461)

* fix: register the type of a cascaded pending relationship at commit (#3447)

A relationship of a new type whose endpoint a DETACH DELETE removes in the
same segment is cascaded into `cancelled_relationships`, and its emptied
`created_rels_by_type` group is dropped, so `Pending::commit` never
registered the type. Two symptoms followed:

- the compact reply of the snapshotted edge called
  `get_type_id(..).unwrap()` on the unregistered name and panicked the
  server (src/reply.rs:260);
- `digest_cancelled` skipped the cancelled edge's CREATE_EDGE/DELETE_EDGE
  pair, leaving a hole in the replica's relationship id space that
  `IdSpace::verify` refuses with a forced full resync.

`Pending::commit` now registers the type of every cancelled relationship,
so every type a segment named is in the dictionary after commit, as in C.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: count cancelled entities in Pending::effects_count so a cancellation-only commit emits its schema additions (#3447)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: build against mai

**File**: `graph/src/effects/v3/emit.rs` (modified, +4/-7)
```diff
@@ -445,13 +445,10 @@ fn digest_cancelled(
     }
     let mut pairs: Vec<(u32, IdList, IdList, IdList)> = Vec::with_capacity(by_type.len());
     for (type_name, mut rels) in by_type {
-        // A type whose every edge was cancelled was never registered on this
-        // graph — nothing of it reached `create_relationships_bulk` — so there
-        // is no id to state and no `ADD_SCHEMA` announcing one. Skipped rather
-        // than invented: a made-up id would index the pair under some other
-        // type. The reservation those ids came from is still the master's, so
-        // this case leaves the two relationship bounds apart. It cannot be
-        // closed with the records this format has.
+        // `Pending::commit` registers the type of every cancelled edge, so the
+        // id is there and `emit_schema_additions` has announced it. Skipped
+        // rather than invented if it ever is not: a made-up id would index the
+        // pair under some other type.
         let Some(relation_id) = graph.get_type_id(&type_name).map(|t| schema_id(t.0)) else {
             continue;
         };
```

**File**: `graph/src/runtime/pending.rs` (modified, +20/-5)
```diff
@@ -926,11 +926,9 @@ impl Pending {
             self.created_rel_types.remove(&rel_id);
             if let Some(entries) = self.created_rels_by_type.get_mut(&type_name) {
                 entries.retain(|(rid, _, _)| *rid != rel_id);
-                // And drop the group once it is empty. A type whose every edge
-                // was cascaded away was never registered on the graph — nothing
-                // of that type reached `create_relationships_bulk` — so leaving
-                // the key behind hands the effects emitter a type name it
-                // cannot resolve.
+                // And drop the group once it is empty, so commit creates no
+                // edges for it. The type itself is still registered at commit,
+                // from `cancelled_relationships`.
                 if entries.is_empty() {
                     self.created_rels_by_type.remove(&type_name);
                 }
@@ -1366,6 +1364,18 @@ impl Pending {
                     .map_err(|e| e.to_string())?;
             }
         }
+        // A type whose every edge a cascade cancelled never reached the loop
+        // above, yet it was named by this segment: the snapshot a reply reads
+        // states it by id, and so does the cancelled pair the effects carry to
+        // the replica. Register it, as C does when the edge is created.
+        // Once per type: a bulk cascade cancels many edges of the same few
+        // types, and each lookup scans the schema.
+        let mut cancelled_types: FxHashSet<&Arc<String>> = FxHashSet::default();
+        for r in &self.cancelled_relationships {
+            if cancelled_types.insert(&r.type_name) {
+                g.get_type_id_mut(&r.type_name);
+            }
+        }
         if !self.set_labels.is_empty() {
             let (rows, cols) = flatten_label_map(&self.set_labels);
             // Pairs for nodes created in this transaction cannot already be
@@ -1969,6 +1979,11 @@ impl Pending {
             + self.created_rel_types.len() as u64
             + self.deleted_nodes.len()
             + self.deleted_relationships.len()
+            // A cancelled entity is emitted as a create and a delete, and its
+            // type (registered at commit) as a schema addition: a commit holding
+            // nothing else must still build its buffer.
+            + 2 * self.cancelled_nodes.len()
+            + 2 * self.cancelled_relationships.len() as u64
             + self.new_nodes_attrs.len() as u64
             + self.existing_nodes_attrs.len() as u64
             + self.new_relationships_attrs.len() as u64
```

**File**: `proofs/FINDINGS.md` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ A triage of every open `type:Bug label:rust` issue (live on Rust main 9d3869aa8
 ### Open reports #3442–#3454 (gkorland, 2026-10-22)
 Of the twelve Rust bugs filed on 2026-10-21 and reproduced against main b84473a7f and C, these are still open. #3446 (GRAPH.EFFECT expands a compressed id range eagerly) is a memory cost outside what the proofs can express. Common causes: operators modelled over the committed graph only (pending deletes and staged labels invisible to MERGE/ExpandInto/IncludePending/UDFs), label sets modelled as only growing (REMOVE), and replies or effect streams proven for shape only, with the panicking lookups taken as total.
 
-- #3447 (store/effects→replica): `remove_pending_relationships_for_node` (pending.rs:839-896) drops a type's `created_rels_by_type` group once empty, so `Pending::commit` (pending.rs:1239-1253) never registers a type whose only edges were cascaded; `digest_cancelled` (emit.rs:457) skips that cancelled edge id and the replica's relationship id space has a hole that `IdSpace::verify` (id_space.rs:737-790) refuses. Lean bug3447_cancelled_edge_id_gap, bug3447_cascade_drops_type_key; property RelIdsCovered / CancelledTypeRegistered; fix relIdsCovered_of_registered.
+- #3447 (store/effects→replica): `remove_pending_relationships_for_node` (pending.rs:839-896) drops a type's `created_rels_by_type` group once empty, so `Pending::commit` (pending.rs:1239-1253) never registers a type whose only edges were cascaded; `digest_cancelled` (emit.rs:457) skips that cancelled edge id and the replica's relationship id space has a hole that `IdSpace::verify` (id_space.rs:737-790) refuses. Lean bug3447_cancelled_edge_id_gap, bug3447_cascade_drops_type_key; property RelIdsCovered / CancelledTypeRegistered; fix relIdsCovered_of_registered. **Fixed by #3461** (f203972c5): `Pending::commit` registers every cancelled relationship's type (pending.rs:1360-1371); Lean relIdsCovered_after_commit, fixed3447_cancelled_edge_id_gap, pending_commit PC.stCancelTypes_registers; old counterexample kept as pre3461_bug3447_cancelled_edge_id_gap. #3461 also makes `effects_count` (pending.rs:1970) count cancelled entities, fixing the cancelled half of W2-effects-1 (gate_ships_of_cancelled; history pre3461_gate_drops_cancelled, pre3461_cancelled_edge_attr_dropped); schema-only writes are still dropped (gate_drops_schema_only).
 - #3447 (srv/reply, compact part): a pending edge of a new type that a DETACH DELETE cascades away is snapshotted with its type name. Its type is never registered, because Pending::commit registers only surviving groups (pending.rs:872-873, :1242-1251). The compact reply's `get_type_id(..).unwrap()` (reply.rs:260) then panics; the verbose reply renders the edge. Lean bug3447_compact_cancelled_new_type_panics; property RegisteredTypes ⇒ ReplyTotal (replyTotal_of_registered).
 - #3448 (store/effects): `remove_node_labels` (pending.rs:699-711) also stages labels that were only staged, and `delete_pending_node` (:788) never clears `remove_labels`; `emit_v3` digests `remove_labels` (emit.rs:372) before `digest_cancelled` (:376), so `CREATE (n:Foo) REMOVE n:Foo DELETE n` emits `RemoveLabels [0]` before `CreateNode [0]` and the replica's `require_live` (apply.rs:359-360) refuses it. Lean bug3448_removeLabels_before_create_refused, bug3448_remove_of_staged_label, bug3448_cancelled_node_keeps_remL; property ReplayApplies / RemLCommitted / RemLLive.
 - #3450 (binder REMOVE/WITH labels): `bind_ir` QueryIR::Remove (binder.rs:477-482) leaves `node_labels` alone; `bind_projection` copies the parent's labels to the WITH child (:1132-1141/:1159-1168) and `update_all_node_labels` (:122-134) stamps them on the next MATCH, so `MATCH (a:A) REMOVE a:A WITH a MATCH (a)-[:R]->(b)` scans `(a:A)` (Rust 0 rows, C 1). Lean bug3450_remove_label_kept_across_with; property StampedLabelsHeld.
```

**File**: `proofs/effects_emit_apply/COVERAGE.tsv` (modified, +11/-11)
```diff
@@ -5,15 +5,15 @@ graph/src/effects/v3/emit.rs	build_constraint_buffer	110	PROVEN	EmitDDL.buildCon
 graph/src/effects/v3/emit.rs	encode_all	186	PROVEN	EmitDDL.encodeAll: encodeAll_ok, encodeAll_failed
 graph/src/effects/v3/emit.rs	index_field_flags	204	PROVEN	EmitDDL.indexFieldFlags: indexFieldFlags_spec
 graph/src/effects/v3/emit.rs	build_index_buffer	226	PROVEN	EmitDDL.buildIndexRec/resolveRefs + encodeAll: buildIndexRec_verifies, encodeAll_ok
-graph/src/effects/v3/emit.rs	for_each_record	323	PROVEN	Emit.gate_zero_stream, Emit.commitShips_eq_iff (record-opcode granularity); emit-then-apply with cancellation (CancelGap): RemoveLabels for a created/cancelled node precedes its CREATE_NODE and the replica refuses it, ReplayApplies refuted: bug3448_removeLabels_before_create_refused (BUG #3448; control agree3448_without_stale_remL); when every allocated relationship type is registered, relIdsCovered_of_registered proves each id reaches a CREATE_EDGE; bug3447_cancelled_edge_id_gap refutes this on main (BUG #3447)
-graph/src/effects/v3/emit.rs	digest_cancelled	395	PROVEN	Digests.digestCancelledF: digestCancelled_pairs; Emit.digestCancelled (gate); digestCancelled_pairs only covers cancelled edges of registered types: a type whose every edge was cascaded away has no id, the pair is skipped and the replica IdSpace has a hole: RelIdsCovered refuted by CancelGap.bug3447_cancelled_edge_id_gap (BUG #3447), fix property relIdsCovered_of_registered
-graph/src/effects/v3/emit.rs	digest_created_nodes	497	PROVEN	Basic.memoGroup_eq_groupBy, Basic.sortDedup_set_eq, Basic.groupBy_flat, Basic.groupBy_keyed (+ proofs/replication emit/apply roundtrip over groupBy)
-graph/src/effects/v3/emit.rs	digest_created_edges	574	PROVEN	Digests.digestCreatedEdges/mkEdgeRec: digestCreatedEdges_perm, digestCreatedEdges_keyed, mkEdgeRec_shape (FxHashMap order abstracted; theorems order-insensitive)
-graph/src/effects/v3/emit.rs	digest_deleted_edges	634	PROVEN	Digests.digestDeletedEdges: digestDeletedEdges_perm
-graph/src/effects/v3/emit.rs	digest_updates	685	PROVEN	Digests.digestUpdates/updKey: digestUpdates_perm, digestUpdates_shape
-graph/src/effects/v3/emit.rs	digest_deleted_nodes	790	PROVEN	Basic.memoGroup_eq_groupBy, Basic.sortDedup_set_eq (the ascending cursor walk over deleted_node_labels is not modelled)
-graph/src/effects/v3/emit.rs	digest_labels	852	PROVEN	Digests.digestLabels: digestLabels_perm, digestLabels_nonempty; called with skip=None for remove_labels (emit.rs:370), so a stale remove_labels entry of a cancelled node ships before its CREATE_NODE: CancelGap.bug3448_removeLabels_before_create_refused (BUG #3448)
-graph/src/effects/v3/emit.rs	gather_rows	920	PROVEN	Emit.mergeRow_eq_lookup, Emit.gatherRows_length (+ unsorted counterexample example)
+graph/src/effects/v3/emit.rs	for_each_record	323	PROVEN	Emit.gate_zero_stream, Emit.commitShips_eq_iff (record-opcode granularity); emit-then-apply with cancellation (CancelGap): RemoveLabels for a created/cancelled node precedes its CREATE_NODE and the replica refuses it, ReplayApplies refuted: bug3448_removeLabels_before_create_refused (BUG #3448; control agree3448_without_stale_remL); when every allocated relationship type is registered, relIdsCovered_of_registered proves each id reaches a CREATE_EDGE; since #3461 commit registers every cancelled type: relIdsCovered_after_commit (BUG #3447 fixed; history pre3461_bug3447_cancelled_edge_id_gap)
+graph/src/effects/v3/emit.rs	digest_cancelled	395	PROVEN	Digests.digestCancelledF: digestCancelled_pairs; Emit.digestCancelled (gate); digestCancelled_pairs only covers cancelled edges of registered types; since #3461 Pending::commit registers every cancelled type (CancelGap.typesAfterCommit), so RelIdsCovered holds: CancelGap.relIdsCovered_after_commit, fixed3447_cancelled_edge_id_gap (BUG #3447 fixed; history pre3461_bug3447_cancelled_edge_id_gap), via relIdsCovered_of_registered
+graph/src/effects/v3/emit.rs	digest_created_nodes	494	PROVEN	Basic.memoGroup_eq_groupBy, Basic.sortDedup_set_eq, Basic.groupBy_flat, Basic.groupBy_keyed (+ proofs/replication emit/apply roundtrip over groupBy)
+graph/src/effects/v3/emit.rs	digest_created_edges	571	PROVEN	Digests.digestCreatedEdges/mkEdgeRec: digestCreatedEdges_perm, digestCreatedEdges_keyed, mkEdgeRec_shape (FxHashMap order abstracted; theorems order-insensitive)
+graph/src/effects/v3/emit.rs	digest_deleted_edges	631	PROVEN	Digests.digestDeletedEdges: digestDeletedEdges_perm
+graph/src/effects/v3/emit.rs	digest_updates	682	PROVEN	Digests.digestUpdates/updKey: digestUpdates_perm, digestUpdates_shape
+graph/src/effects/v3/emit.rs	digest_deleted_nodes	787	PROVEN	Basic.memoGroup_eq_groupBy, Basic.sortDedup_set_eq (the ascending cursor walk over deleted_node_labels is not modelled)
+graph/src/effects/v3/emit.rs	digest_labels	849	PROVEN	Digests.digestLabels: digestLabels_perm, digestLabels_nonempty; called with skip=None for remove_labels (emit.rs:370), so a stale remove_labels entry of a cancelled node s
```

**File**: `proofs/effects_emit_apply/FalkorEffectsEmitApply.lean` (modified, +10/-6)
```diff
@@ -27,7 +27,7 @@ Builds with `lake build`; no `sorry`, `admit` or `axiom`.
 | `Emit.schemaAdditions`                 | `emit_schema_additions`, `emit.rs:60`                       |
 | `Emit.digestCancelled`                 | `digest_cancelled`, `emit.rs:395`                           |
 | `Emit.forEachRecord`                   | `for_each_record`, `emit.rs:323` (opcode granularity)       |
-| `Emit.effectsCount`                    | `Pending::effects_count`, `pending.rs:1958`                 |
+| `Emit.effectsCount`                    | `Pending::effects_count`, `pending.rs:1970` (#3461: +2 per cancelled entity) |
 | `Emit.commitShips`                     | `if estimated > 0 { buf.build(..) }`, `commit.rs:108`       |
 | `Emit.applyAddName`                    | `apply_add_schema` + `verify_id`, `apply.rs:532,552`        |
 | `Apply.createOne`                      | `Record::CreateNode` arm, `apply.rs:210`                    |
@@ -61,8 +61,10 @@ Builds with `lake build`; no `sorry`, `admit` or `axiom`.
   `wf_updateNode_live`, `wf_setLabels_live` — with a liveness check each node
   arm preserves well-formedness (the fix, proved).
 * Counterexamples (all by `decide`, all reproduced in Rust):
-  `gate_drops_cancelled`, `gate_drops_schema_only`, `next_payload_refused`,
-  `cancelled_edge_attr_dropped`. The ones fixed by #3022 (`18fc277b9`) were removed after 17ccc5412, the last commit that holds them.
+  `gate_drops_schema_only`, `next_payload_refused`. `gate_drops_cancelled` and
+  `cancelled_edge_attr_dropped` were fixed by #3461 (f203972c5, `effects_count`
+  counts cancelled entities): kept as `pre3461_*` over `effectsCountPre3461`; the fix
+  is `gate_ships_of_cancelled`, `gate_ships_cancelled`, `cancelled_edge_attr_ships`. The ones fixed by #3022 (`18fc277b9`) were removed after 17ccc5412, the last commit that holds them.
 
 ## #3022 (`Liveness.lean`): every record that acts on an entity checks it is live
 
@@ -196,7 +198,7 @@ node) — refused since #3298 (`createNode_repeat_refused`).
 * ~~The documented `rel_bound` gap (`emit.rs:448-454`)~~ — **confirmed as #3447**
   (2026-10-22): when the same segment also creates a surviving edge above the
   cancelled id, the replica's relationship `IdSpace::verify` refuses the hole and
-  forces a full resync. Proven in `CancelGap.lean` (`bug3447_cancelled_edge_id_gap`).
+  forces a full resync. Proven in `CancelGap.lean` (`pre3461_bug3447_cancelled_edge_id_gap`); fixed by #3461.
 * C master (`bin/macos-arm64v8-release/falkordb.so`, Redis 8.6.2) aborts on
   `OPTIONAL MATCH (n:Nope) SET n:L6` (`blocked.c:346 'server.also_propagate.numops
   == 0'`), with or without a replica. C-side; not investigated further.
@@ -210,13 +212,15 @@ master's pre-segment state accepts. Two properties, both refuted on b84473a7f:
 | Lean | Rust (b84473a7f) |
 | --- | --- |
 | `CancelGap.verifyRange` | `IdSpace::verify`'s hole check (id_space.rs:737-790) |
-| `CancelGap.typesAfterCommit` | `Pending::commit` → `create_relationships_bulk` → `get_type_id_mut` (pending.rs:1236-1249, graph.rs:2610/:1265): only `created_rels_by_type` keys are registered |
+| `CancelGap.typesAfterCommit` | `Pending::commit` (pending.rs:1345-1371, #3461): `created_rels_by_type` keys via `create_relationships_bulk`, then every `cancelled_relationships` type via `get_type_id_mut` (`typesAfterCommitPre3461`: the keys only, before #3461) |
 | `CancelGap.toLive` | opcode records → `apply_record` arms (`RemoveLabels` `require_live`, apply.rs:359-360) |
 
 * **#3447** (property `RelIdsCovered`: every relationship id allocated in the
   segment reaches a `CREATE_EDGE`): `digest_cancelled` skips a cancelled edge
   whose type has no id (emit.rs:455), and a type whose only edges were cascaded
-  is never registered. `bug3447_cancelled_edge_id_gap` (live repro `CREATE
+  is never registered. **Fixed by #3461** (f203972c5: commit registers every
+  cancelled type): `relIdsCovered_after_commit` (for every `Pending`),
+  `fixed3447_cancelled_edge_id_gap`; history `pre3461_bug3447_cancelled_edge_id_gap` (live repro `CREATE
   (a)-[r1:NEW_TYPE]->(b), (c)-[r2:EXISTING]->(d) DETACH DELETE a`): payload has
   `CreateEdge [2]` and nothing for 1; master's id space verifies, replica's has a
   hole. Fix property `relIdsCovered_of_registered` (holds for every `Pending`
```

**File**: `proofs/effects_emit_apply/FalkorEffectsEmitApply/CancelGap.lean` (modified, +72/-8)
```diff
@@ -17,7 +17,8 @@ pre-segment state* accepts. Two properties, both refuted on main:
   (`Pending::commit` registers only `created_rels_by_type` keys via
   `create_relationships_bulk` → `get_type_id_mut`, pending.rs:1236-1249,
   graph.rs:2610/:1265; proofs/pending_commit `bug3447_cascade_drops_type_key`).
-  `bug3447_cancelled_edge_id_gap`: live repro `CREATE ()-[:EXISTING]->()` then
+  `pre3461_bug3447_cancelled_edge_id_gap` (fixed by #3461, which registers every
+  cancelled type at commit: `relIdsCovered_after_commit`): live repro `CREATE ()-[:EXISTING]->()` then
   `CREATE (a)-[r1:NEW_TYPE]->(b), (c)-[r2:EXISTING]->(d) DETACH DELETE a`; the
   payload carries `CreateEdge{ids:[2]}` and nothing for 1, the replica's verify
   refuses (`verifyRange`), the master's passes. `relIdsCovered_of_registered`:
@@ -58,11 +59,22 @@ def allocated (p : Pending) : List Nat := p.createdRelTypes.flatMap (·.2) ++ p.
 /-- **Property `RelIdsCovered`**. -/
 def RelIdsCovered (p : Pending) (g : Schema) : Prop := ∀ i ∈ allocated p, i ∈ edgeIds (forEachRecord p g)
 
-/-- The relationship-type dictionary after `Pending::commit`: each
-`created_rels_by_type` key is get-or-created (pending.rs:1236-1249); cancelled
-types are not looked at. -/
+/-- Get-or-create of one name (`get_type_id_mut`, graph.rs). -/
+def regName (ts : List Name) (n : Name) : List Name := if n ∈ ts then ts else ts ++ [n]
+
+/-- The relationship-type dictionary after `Pending::commit` before #3461:
+each `created_rels_by_type` key is get-or-created (pending.rs:1236-1249 on
+343e077f2); cancelled types are not looked at. -/
+def typesAfterCommitPre3461 (base : List Name) (p : Pending) : List Name :=
+  p.createdRelTypes.foldl (fun ts q => regName ts q.1) base
+
+/-- The relationship-type dictionary after `Pending::commit` (pending.rs:1345-1371,
+#3461): each `created_rels_by_type` key is get-or-created by
+`create_relationships_bulk`, then the type of every `cancelled_relationships`
+entry by `get_type_id_mut` (the `FxHashSet` only skips repeats, which
+get-or-create ignores anyway). -/
 def typesAfterCommit (base : List Name) (p : Pending) : List Name :=
-  p.createdRelTypes.foldl (fun ts q => if q.1 ∈ ts then ts else ts ++ [q.1]) base
+  p.cancelledRels.foldl (fun ts q => regName ts q.1) (typesAfterCommitPre3461 base p)
 
 /-- `CREATE (a)-[r1:NEW_TYPE]->(b), (c)-[r2:EXISTING]->(d) DETACH DELETE a` after
 `CREATE ()-[:EXISTING]->()` (nodes 0,1 and edge 0 committed): `a` = 2 is
@@ -74,14 +86,15 @@ def pGap : Pending :=
     setLabels := [], removeLabels := [], cancelledNodes := [2], cancelledRels := [("NEW_TYPE", 1)],
     baseline := ⟨[], ["EXISTING"], []⟩ }
 
-def gGap : Schema := ⟨[], typesAfterCommit ["EXISTING"] pGap, []⟩
+def gGap : Schema := ⟨[], typesAfterCommitPre3461 ["EXISTING"] pGap, []⟩
 
-/-- **#3447**: `NEW_TYPE` is never registered, so the cancelled edge 1 is not
+/-- History (fixed by #3461, f203972c5; now `relIdsCovered_after_commit`).
+**#3447**: `NEW_TYPE` is never registered, so the cancelled edge 1 is not
 in the payload; the master's relationship id space `{0, 1, 2}` (entry bound 1)
 verifies, the replica's `{0} ∪ {2}` has a hole and is refused
 (live: "effects buffer allocated relationship ids 1..=2 but created only 1 of
 them … forced full resync"; C stays in sync). -/
-theorem bug3447_cancelled_edge_id_gap :
+theorem pre3461_bug3447_cancelled_edge_id_gap :
     gGap.types = ["EXISTING"] ∧
     forEachRecord pGap gGap = [.createNode [3, 4, 5] [], .createEdge [2] 0, .createNode [2] [], .deleteNode [2] []] ∧
     ¬ RelIdsCovered pGap gGap ∧
@@ -151,6 +164,57 @@ theorem relIdsCovered_of_registered (p : Pending) (g : Schema)
     simp only [List.mem_append]
     simp [hmem]
 
+theorem regName_mem (ts : List Name) (n : Name) : n ∈ regName ts n := by
+  unfold regName; split
+  · assumption
+  · simp
+
+theorem regName_mono (ts : List Name) (n m : Name) (h : m ∈ ts) : m ∈ regName ts n := by
+  unfold regName; split
+  · exact h
+  · simp [h]
+
+theorem foldl_regName_mono {α} (f : α → Name) (l : List α) (ts : List Name) (m : Name) (h : m ∈ ts) :
+    m ∈ l.foldl (fun ts q => regName ts (f q)) ts := by
+  induction l generalizing ts with
+  | nil => exact h
+  | cons x xs ih => exact ih _ (regName_mono _ _ _ h)
+
+theorem foldl_regName_mem {α} (f : α → Name) (l : List α) (ts : List Name) (q : α) (hq : q ∈ l) :
+    f q ∈ l.foldl (fun ts q => regName ts (f q)) ts := by
+  induction l generalizing ts with
+  | nil => cases hq
+  | cons x xs ih =>
+    rcases List.mem_cons.mp hq with rfl | hq
+    · exact foldl_regName_mono f xs _ _ (regName_mem _ _)
+    · exact ih _ hq
+
+theorem idxOf_isSome_of_mem (l : List Name) (n : Name) (h : n ∈ l) : (idxOf l n).isSome := by
+  unfold idxOf
+  have : (l.findIdx? (· == n)).isSome := by
+    rw [List.findIdx?_isSome, List.any_eq_true]; exact ⟨n, h, by simp⟩
+  revert this; cases l.findIdx? (· == n) <;> simp
+
+/-- **#3461 fix of #3447 (`RelIdsCovered`)**: with the dictionary `Pending::commit`
+now leaves, e
```

**File**: `proofs/effects_emit_apply/FalkorEffectsEmitApply/Emit.lean` (modified, +56/-8)
```diff
@@ -230,10 +230,22 @@ structure Pending where
   baseline          : Schema
 deriving Repr
 
-/-- `Pending::effects_count` (`runtime/pending.rs:1958-1977`), term for term.
-    Note what is **not** summed: `cancelled_nodes`, `cancelled_relationships`,
-    and the schema registered since `baseline`. -/
+/-- `Pending::effects_count` (`runtime/pending.rs:1970-1993`), term for term.
+    Since #3461 (f203972c5) a cancelled node or relationship counts twice (its
+    create and its delete). Note what is still **not** summed: the schema
+    registered since `baseline`. -/
 def effectsCount (p : Pending) : Nat :=
+  p.createdNodes.length + p.createdRelTypes.length + p.deletedNodes.length
+  + p.deletedRels.length
+  + 2 * p.cancelledNodes.length + 2 * p.cancelledRels.length
+  + p.newNodesAttrs.length + p.existingNodesAttrs.length
+  + p.newRelsAttrs.length + p.existingRelsAttrs.length
+  + (p.setLabels.map (fun q => q.2.length)).sum
+  + (p.removeLabels.map (fun q => q.2.length)).sum
+
+/-- `effects_count` before #3461 (pending.rs:1958-1977 on 343e077f2): the
+    cancelled sets were not summed. History for the `pre3461_*` theorems. -/
+def effectsCountPre3461 (p : Pending) : Nat :=
   p.createdNodes.length + p.createdRelTypes.length + p.deletedNodes.length
   + p.deletedRels.length + p.newNodesAttrs.length + p.existingNodesAttrs.length
   + p.newRelsAttrs.length + p.existingRelsAttrs.length
@@ -290,6 +302,10 @@ def forEachRecord (p : Pending) (g : Schema) : List Rec :=
 def commitShips (p : Pending) (g : Schema) : List Rec :=
   if effectsCount p > 0 then forEachRecord p g else []
 
+/-- The gate before #3461, over `effectsCountPre3461`. -/
+def commitShipsPre3461 (p : Pending) (g : Schema) : List Rec :=
+  if effectsCountPre3461 p > 0 then forEachRecord p g else []
+
 /-! ## What the gate drops -/
 
 theorem sum_zero_nil : ∀ l : List (Nat × List Nat),
@@ -320,6 +336,8 @@ theorem gate_zero_stream (p : Pending) (g : Schema) (h : effectsCount p = 0) :
   have h2 : p.createdRelTypes = [] := List.eq_nil_of_length_eq_zero (by omega)
   have h3 : p.deletedNodes = [] := List.eq_nil_of_length_eq_zero (by omega)
   have h4 : p.deletedRels = [] := List.eq_nil_of_length_eq_zero (by omega)
+  have h11 : p.cancelledNodes = [] := List.eq_nil_of_length_eq_zero (by omega)
+  have h12 : p.cancelledRels = [] := List.eq_nil_of_length_eq_zero (by omega)
   have h6 : p.existingNodesAttrs = [] := List.eq_nil_of_length_eq_zero (by omega)
   have h8 : p.existingRelsAttrs = [] := List.eq_nil_of_length_eq_zero (by omega)
   have h9 := sum_zero_nil p.setLabels (by omega)
@@ -358,14 +376,34 @@ def pCancelled : Pending :=
 
 def gCancelled : Schema := ⟨["A"], [], ["p"]⟩
 
-theorem gate_drops_cancelled :
-    effectsCount pCancelled = 0 ∧
+/-- History: before #3461 the gate dropped a fully cancelled write (fixed by
+    #3461, f203972c5; now `gate_ships_cancelled`). -/
+theorem pre3461_gate_drops_cancelled :
+    effectsCountPre3461 pCancelled = 0 ∧
     forEachRecord pCancelled gCancelled =
       [.addLabel 0 "A", .addAttribute 0 "p", .createNode [0] [], .deleteNode [0] []] ∧
-    commitShips pCancelled gCancelled = [] := by
+    commitShipsPre3461 pCancelled gCancelled = [] := by
   refine ⟨rfl, ?_, rfl⟩
   decide
 
+/-- **#3461**: the same write now ships its whole stream. -/
+theorem gate_ships_cancelled :
+    effectsCount pCancelled = 2 ∧
+    commitShips pCancelled gCancelled =
+      [.addLabel 0 "A", .addAttribute 0 "p", .createNode [0] [], .deleteNode [0] []] := by
+  decide
+
+/-- **#3461**: any segment that cancelled a node or a relationship passes the
+    gate, so its cancelled pairs (and the schema it registered) ship. -/
+theorem gate_ships_of_cancelled (p : Pending) (g : Schema)
+    (h : p.cancelledNodes ≠ [] ∨ p.cancelledRels ≠ []) : commitShips p g = forEachRecord p g := by
+  have hpos : effectsCount p > 0 := by
+    unfold effectsCount
+    rcases h with h | h
+    · have := List.length_pos_iff.mpr h; omega
+    · have := List.length_pos_iff.mpr h; omega
+  simp [commitShips, hpos]
+
 /-- `OPTIONAL MATCH (n:Nope) SET n:L6`: `L6` registered, nothing else. -/
 def pSchemaOnly : Pending := { pCancelled with cancelledNodes := [] }
 def gSchemaOnly : Schema := ⟨["L6"], [], []⟩
@@ -402,12 +440,22 @@ theorem next_payload_refused :
     (`cancelled_edge_attribute_is_a_silent_dictionary_divergence`). Here even an
     un-gated emitter would say nothing about `T1`'s edges, since the type has no
     id (`emit.rs:448-454`), but it would still announce `p4`. -/
-theorem cancelled_edge_attr_dropped :
+theorem pre3461_cancelled_edge_attr_dropped :
     let p : Pending := { pCancelled with cancelledNodes := [0, 1], cancelledRels := [("T1", 0)] }
     let g : Schema := ⟨[], [], ["p4"]⟩
-    effectsCount p = 0 ∧ commitShips p g = [] ∧
+    effectsCountPre3461 p = 0 ∧ commitShipsPre3461 p g = [] ∧
     forEachRecord p g = [.addAttribute 0 "p4", .createNode [0, 1] [], .deleteNode [0, 1] []] := by
   refine ⟨rfl, rfl, ?_⟩
   decide
 
+/
```

**File**: `proofs/effects_emit_apply/README.md` (modified, +5/-5)
```diff
@@ -22,10 +22,10 @@ The full Lean↔Rust mapping is in the header of [`FalkorEffectsEmitApply.lean`]
 
 The counterexamples are concrete queries:
 
-- `CREATE (a:A {p:1}) DELETE a` registers label `A` and attribute `p` on the master and ships nothing (`gate_drops_cancelled`);
+- `CREATE (a:A {p:1}) DELETE a` registered label `A` and attribute `p` on the master and shipped nothing before #3461 (`pre3461_gate_drops_cancelled`; now `gate_ships_cancelled`);
 - `OPTIONAL MATCH (n:Nope) SET n:L6` registers `L6` and ships nothing (`gate_drops_schema_only`);
 - the next write's `ADD_SCHEMA 1 "K6"` is then refused by the replica, which would assign id 0 (`next_payload_refused`). That forces a full resync, and during AOF load the server exits;
-- `CREATE (a)-[:T1 {p4:1}]->(b) DELETE a, b` is worse: no error at all, but the replica's attribute dictionary is missing `p4` (`cancelled_edge_attr_dropped`).
+- `CREATE (a)-[:T1 {p4:1}]->(b) DELETE a, b` is worse: no error at all, but the replica's attribute dictionary is missing `p4` (`pre3461_cancelled_edge_attr_dropped`; fixed by #3461, `cancelled_edge_attr_ships`).
 
 **2. Can a payload that the replica accepts leave its graph broken?**
 
@@ -82,11 +82,11 @@ All four were reproduced in Rust and against a live server (see [`../FINDINGS.md
 
 | # | Theorem (counterexample) | What it means | Status |
 |---|---|---|---|
-| W2-effects-1 | `gate_drops_cancelled`, `gate_drops_schema_only`, `next_payload_refused`, `cancelled_edge_attr_dropped` | A write that only registers a name or only cancels entities ships nothing. The next payload is refused (full resync; AOF load exits), or the replica silently misses an attribute name. 134 of 200 random seeds diverge | **Open**: the gate at `commit.rs:107-108` is unchanged on 1d15bf713; no issue or PR yet |
+| W2-effects-1 | `pre3461_gate_drops_cancelled`, `gate_drops_schema_only`, `next_payload_refused`, `pre3461_cancelled_edge_attr_dropped` | A write that only registers a name or only cancels entities ships nothing. The next payload is refused (full resync; AOF load exits), or the replica silently misses an attribute name. 134 of 200 random seeds diverge | Cancelled half **fixed by #3461** (`effects_count` counts cancelled entities: `gate_ships_of_cancelled`, `gate_ships_cancelled`, `cancelled_edge_attr_ships`); schema-only writes still dropped (`gate_drops_schema_only`) |
 | W2-effects-2 | removed (17ccc5412) | `UPDATE_NODE`/`UPDATE_EDGE`/`SET_LABELS`/`REMOVE_LABELS` on a dead id were accepted; the next node to recycle the id inherited the property or label | Fixed by #3022 (`wf_updateNode_live`, `wf_setLabels_live`, `apply_wf`) |
 | W2-effects-3 | removed (17ccc5412) | `DELETE_NODE` of a node with edges was accepted; the edge dangled and the next node with that id inherited it | Fixed by #3022 (`wf_deleteNode`, `apply_wf`) |
 | #3247 | removed (17ccc5412) | A `CREATE_NODE` naming the same id twice (`[2, 3, 2]`) applied: the id set created one node where the record named two, and the repeated id's row had no node of its own | Fixed by #3298 (`2bb51088b`): `createNode_repeat_refused`, `createNode_ok_nodup`, `a_repeated_node_id_in_one_create_is_refused` |
-| #3447 | `bug3447_cancelled_edge_id_gap` (property `RelIdsCovered`) | An edge of a new type cascaded away by `DETACH DELETE` never registers its type, so `digest_cancelled` drops its id. With a surviving edge above it in the same segment the replica's relationship id space has a hole: `IdSpace::verify` refuses and forces a full resync. C stays in sync | **Open** (#3447) |
+| #3447 | `pre3461_bug3447_cancelled_edge_id_gap` (property `RelIdsCovered`) | An edge of a new type cascaded away by `DETACH DELETE` never registers its type, so `digest_cancelled` drops its id. With a surviving edge above it in the same segment the replica's relationship id space has a hole: `IdSpace::verify` refuses and forces a full resync. C stays in sync | **Fixed by #3461** (`relIdsCovered_after_commit`, `fixed3447_cancelled_edge_id_gap`) |
 | #3448 | `bug3448_removeLabels_before_create_refused` (property `ReplayApplies`) | `CREATE (n:Foo) REMOVE n:Foo DELETE n` leaves `n` in `remove_labels`; the stream emits `RemoveLabels [0]` before the cancelled pair's `CreateNode [0]`, and the replica refuses node 0 as not live (full resync). C stays in sync | **Open** (#3448) |
 | W2-effects-4 | none (the model has no indexes) | A refused buffer's `CREATE_INDEX` is not rolled back, because the `Indexer` is shared by `Arc` across versions | **Open** (PR #3235) |
 
@@ -130,7 +130,7 @@ Every row is PROVEN. For `effects_count` and the gate, "PROVEN" means the model
 - **Indexes and rollback.** W2-effects-4 is outside the model.
 - **Index and constraint DDL apply** is checked only by a live Rust-vs-C differential (18 steps, all agree), not by a theorem.
 - **`IdSpace` and `first_node_with_relationships`** are specs here, proven in `id_space` and `graph_queries`.
-- The `rel_bound` gap documented at `emit.rs:448-454` is no long
```

---

### Incident Patch 2: `b9b99e33` (2026-11-17)
**Commit Message**: fix: a refused fulltext CREATE INDEX no longer leaks the RediSearch options block (#3274)

* fix: a refused fulltext CREATE INDEX no longer leaks the RediSearch options block

create_rs_index allocated the index options before its fallible CString
conversions and returned early on them (and on an unsupported language)
without freeing the block. Convert first, and free the options on the
language error.

Closes #3273

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: say why the refused CREATE FULLTEXT INDEX error is ignored

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* refactor: do not shadow c_stopwords in create_rs_index

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test: the leak test checks the refusal it expects and always deletes its graph

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: update the Lean proofs for this change (proof-impact bot)

Verified patch of the proof-impact run https://github.com/FalkorDB/FalkorDB/actions/runs/43749173381
at 683bf60fc66ec8180690579d1bf137599f35da5b, applied on request of AviAvni (held items reviewed).

Proof-Bot-Run: https://github.com/FalkorDB/FalkorDB/actions/runs/43749173381

* ci: run CI on 

**File**: `graph/src/index/mod.rs` (modified, +26/-19)
```diff
@@ -1108,6 +1108,27 @@ impl Index {
         stopwords: Option<&Vec<Arc<String>>>,
         language: Option<&Arc<String>>,
     ) -> Result<(), String> {
+        // Every fallible conversion runs before the options block is
+        // allocated, so an early return cannot leak it.
+        let c_stopwords: Option<Vec<CString>> = stopwords
+            .map(|words| {
+                words
+                    .iter()
+                    .map(|s| CString::new(s.as_str()).map_err(|e| e.to_string()))
+                    .collect::<Result<Vec<_>, _>>()
+            })
+            .transpose()?;
+        // `RediSearch_IndexOptionsSetLanguage` only stores the raw pointer
+        // (`options->lang = lang`); `_CreateIndex` later reads it via
+        // `RSLanguage_Find` to convert to an enum, so this `CString` must
+        // outlive that call.
+        // (Bug uncovered by ASAN: heap-use-after-free in `RSLanguage_Find`
+        // when the inner `c_lang` was dropped at end of its if-let block.)
+        let c_lang: Option<CString> = language
+            .map(|lang| CString::new(lang.as_str()).map_err(|e| e.to_string()))
+            .transpose()?;
+        let clabel = CString::new(label.as_str()).map_err(|e| e.to_string())?;
+
         unsafe {
             // Requires the global lock (the host's module GIL):
             // `RediSearch_CreateIndex` registers a GC timer in the host event loop
@@ -1120,13 +1141,9 @@ impl Index {
             // `RediSearch_IndexOptionsSetStopwords` deep-copies via
             // `rm_strdup`, so our CStrings can drop as soon as the call
             // returns.
-            if let Some(stop_words) = stopwords {
-                let c_stopwords: Vec<CString> = stop_words
-                    .iter()
-                    .map(|s| CString::new(s.as_str()).map_err(|e| e.to_string()))
-                    .collect::<Result<Vec<_>, _>>()?;
+            if let Some(stopword_cstrs) = &c_stopwords {
                 let mut ptrs: Vec<*const c_char> =
-                    c_stopwords.iter().map(|cs| cs.as_ptr()).collect();
+                    stopword_cstrs.iter().map(|cs| cs.as_ptr()).collect();
                 RediSearch_IndexOptionsSetStopwords(
                     options,
                     ptrs.as_mut_ptr(),
@@ -1136,24 +1153,14 @@ impl Index {
                 RediSearch_IndexOptionsSetStopwords(options, null_mut(), 0);
             }
 
-            // `RediSearch_IndexOptionsSetLanguage`, in contrast, only stores
-            // the raw pointer (`options->lang = lang`); `_CreateIndex` later
-            // reads it via `RSLanguage_Find` to convert to an enum, so the
-            // backing `CString` must outlive that call.
-            // (Bug uncovered by ASAN: heap-use-after-free in `RSLanguage_Find`
-            // when the inner `c_lang` was dropped at end of its if-let block.)
-            let _language_owner: Option<CString> = if let Some(lang) = language {
-                let c_lang = CString::new(lang.as_str()).map_err(|e| e.to_string())?;
+            if let (Some(lang), Some(c_lang)) = (language, &c_lang) {
                 if RediSearch_IndexOptionsSetLanguage(options, c_lang.as_ptr()) != 0 {
+                    RediSearch_FreeIndexOptions(options);
                     return Err(format!("Language is not supported: {lang}"));
                 }
-                Some(c_lang)
             } else {
                 RediSearch_IndexOptionsSetLanguage(options, null_mut());
-                None
-            };
-
-            let clabel = CString::new(label.as_str()).map_err(|e| e.to_string())?;
+            }
 
             // GIL is already held at the top of this unsafe block, covering
             // CreateIndex's transitive RM_CreateTimer call.
```

**File**: `proofs/index_layer/COVERAGE.tsv` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ graph/src/index/mod.rs	bump_id	1053	PROVEN	Slots.bump; bump_total, bump_fresh, o
 graph/src/index/mod.rs	clone_for_update	1072	PROVEN	Meta.Idx.cloneForUpdate_eq
 graph/src/index/mod.rs	has_rs_index	1092	PROVEN	Meta.Idx.hasRsIndex_spec
 graph/src/index/mod.rs	rs_ptr	1099	PROVEN	Meta.Idx.hasRsIndex_spec (rsPtr)
-graph/src/index/mod.rs	create_rs_index	1105	PROVEN	Meta.Idx.createRsIndex_ok, createRsIndex_lang_err (FFI create = fresh handle); #3166 gap: records the spec's stopword list as Idx.rsStop (IndexGaps.createRsIndex_stop)
+graph/src/index/mod.rs	create_rs_index	1105	PROVEN	Meta.Idx.createRsIndex_ok, createRsIndex_lang_err_cleanLabel (FFI create = fresh handle; #3274 counterexample createRsIndex_lang_err_fails: label NUL now reported before unsupported language); #3166 gap: records the spec's stopword list as Idx.rsStop (IndexGaps.createRsIndex_stop)
 graph/src/index/mod.rs	register_fields	1185	PROVEN	Meta.Idx.registerOne_range/_text/_vector_err, registerAll_ok, registerFields_ok, metricOf_ok; never changes the spec's stopwords (IndexGaps.registerFields_stop); fulltext phonetic flag = TextOpts.phoneticEnabled since #3514 (a0ba12950): registerOne_text
 graph/src/index/text_index_options.rs	phonetic_enabled	48	PROVEN	Meta.TextOpts.phoneticEnabled: phoneticEnabled_off_spellings, phoneticEnabled_code, phoneticEnabled_iff_ne_no; fixed3514_phonetic_no_is_off (#3514)
 graph/src/index/mod.rs	value_to_numeric	1361	PROVEN	valueToNumeric; equal_exact, numRange_exact
```

**File**: `proofs/index_layer/FalkorIndexLayer.lean` (modified, +6/-0)
```diff
@@ -189,6 +189,12 @@ every range query on `n.s` is built against the fulltext field `s` instead of `r
 (live, ports 18850 Rust / 18851 C). Fix: pick the field with `ty == IndexType::Range`.
 Suspected, unconfirmed: `create_rs_index` returns `Err` on a NUL in a stopword/language/label
 after `RediSearch_CreateIndexOptions` without `RediSearch_FreeIndexOptions` (leak only).
+#3274 fixes that leak by running every `CString::new` (stopwords, language, label) before
+the options block is allocated and freeing it on the unsupported-language return. Side
+effect: the label NUL check now precedes the unsupported-language check, so
+`createRsIndex_lang_err` is false on the new code (`createRsIndex_lang_err_fails`; label
+``L\0`` with `language: 'x'` reports the NUL error instead of `Language is not supported: x`);
+`createRsIndex_lang_err_cleanLabel` proves the message for NUL-free labels.
 
 ## Re-target to 49f698d22 (#3087)
 `Document::set` now adds a `VecF32` only if
```

**File**: `proofs/index_layer/FalkorIndexLayer/IndexM.lean` (modified, +31/-11)
```diff
@@ -68,17 +68,18 @@ def rsPtr (x : Idx) : Option Nat := x.spec
 
 def hasNul (s : String) : Bool := s.toList.contains (Char.ofNat 0)
 
-/-- `create_rs_index` (`mod.rs:1101`). Error order as in Rust: stopwords
-`CString::new` (1108), language `CString::new`/unsupported (1129-1133), label
-`CString::new` (1140). On success the spec is fresh and carries only
-`NONE_INDEXABLE_FIELDS` (1155-1163), and (#3166 gap) is created with the stopword
-list `stop` (`mod.rs:1119-1133`), recorded as `rsStop`. -/
+/-- `create_rs_index` (`mod.rs:1105`). Error order as in Rust (#3274): stopwords
+`CString::new` (1113-1120), language `CString::new` (1127-1129), label
+`CString::new` (1130), all before the options block is allocated; then
+unsupported language (1156-1160). On success the spec is fresh and carries only
+`NONE_INDEXABLE_FIELDS` (1175-1186), and (#3166 gap) is created with the stopword
+list `stop` (`mod.rs:1144-1154`), recorded as `rsStop`. -/
 def createRsIndex (x : Idx) (label : String) (stop : Option (List String)) (lang : Option String)
     (langOk : String → Bool) (fresh : Nat) : Except String Idx :=
   if (stop.getD []).any hasNul then .error "nul" else
   match lang with
-  | some l => if hasNul l then .error "nul" else if !langOk l then .error s!"Language is not supported: {l}"
-              else if hasNul label then .error "nul"
+  | some l => if hasNul l then .error "nul" else if hasNul label then .error "nul"
+              else if !langOk l then .error s!"Language is not supported: {l}"
               else .ok { x with spec := some fresh, rs := [⟨"NONE_INDEXABLE_FIELDS", .noneTag⟩], rsStop := stop }
   | none => if hasNul label then .error "nul"
             else .ok { x with spec := some fresh, rs := [⟨"NONE_INDEXABLE_FIELDS", .noneTag⟩], rsStop := stop }
@@ -210,11 +211,30 @@ theorem createRsIndex_ok (x : Idx) (label : String) (stop : Option (List String)
   · split at h; · cases h
     cases h; simp
 
-theorem createRsIndex_lang_err (x : Idx) (label : String) (stop : Option (List String)) (l : String)
-    (langOk : String → Bool) (fresh : Nat) (h1 : (stop.getD []).any hasNul = false)
-    (h2 : hasNul l = false) (h3 : langOk l = false) :
+/-- The pre-#3274 statement of `createRsIndex_lang_err`: with NUL-free stopwords
+and language, an unsupported language is always reported, whatever the label. -/
+def LangErrSpec (x : Idx) : Prop :=
+  ∀ (label : String) (stop : Option (List String)) (l : String)
+    (langOk : String → Bool) (fresh : Nat), (stop.getD []).any hasNul = false →
+    hasNul l = false → langOk l = false →
+    createRsIndex x label stop (some l) langOk fresh = .error s!"Language is not supported: {l}"
+
+/-- Counterexample (#3274): the label `CString::new` now runs before the language
+check, so a label with a NUL byte and an unsupported language `x` reports the NUL
+error, not `Language is not supported: x`. -/
+theorem createRsIndex_lang_err_fails (x : Idx) : ¬ LangErrSpec x := by
+  intro h
+  have := h "L\x00" none "x" (fun _ => false) 0 rfl (by decide) rfl
+  simp [createRsIndex, hasNul] at this
+  exact absurd this (by decide)
+
+/-- What still holds on the new code: an unsupported language is reported when
+the stopwords, language and label are all NUL-free. -/
+theorem createRsIndex_lang_err_cleanLabel (x : Idx) (label : String) (stop : Option (List String))
+    (l : String) (langOk : String → Bool) (fresh : Nat) (h1 : (stop.getD []).any hasNul = false)
+    (h2 : hasNul l = false) (h4 : hasNul label = false) (h3 : langOk l = false) :
     createRsIndex x label stop (some l) langOk fresh = .error s!"Language is not supported: {l}" := by
-  simp [createRsIndex, h1, h2, h3]
+  simp [createRsIndex, h1, h2, h3, h4]
 
 theorem metricOf_ok (sim : Option String) (m : String) (h : metricOf sim = .ok m) :
     sim.getD "euclidean" ∈ ["euclidean", "ip", "cosine"] := by
```

**File**: `tests/flow/test_index_create.py` (modified, +36/-0)
```diff
@@ -870,6 +870,42 @@ def test16_index_creation_stats(self):
         self.env.assertEqual(result.indices_created, 1)
         self.env.assertEqual(result.labels_added, 1)
 
+    def test20_failed_fulltext_create_does_not_leak(self):
+        # A fulltext CREATE refused while building the RediSearch index
+        # (unsupported language, NUL byte in a stopword) must free the
+        # options block it allocated: ~56 bytes per statement leaked before.
+        conn = self.env.getConnection()
+        graph = self.db.select_graph("failed_fulltext_create_leak")
+        try:
+            graph.query("CREATE (:L {s:'a'})")
+            n = 10000
+            cases = [
+                ("CREATE FULLTEXT INDEX FOR (n:L) ON (n.s) OPTIONS {language:'klingon'}",
+                 "Language is not supported"),
+                ("CREATE FULLTEXT INDEX FOR (n:L) ON (n.s) OPTIONS {stopwords:['a\\u0000b']}",
+                 "nul byte"),
+            ]
+            for q, expected in cases:
+                def run(times):
+                    for _ in range(times):
+                        try:
+                            graph.query(q)
+                            self.env.assertTrue(False, message=q)
+                        except ResponseError as e:
+                            # Refused by design; only what the refusal leaves
+                            # behind is measured, and it must be this refusal.
+                            if expected not in str(e):
+                                self.env.assertTrue(False, message=f"{q}: {e}")
+                                return
+                run(100)  # warm up
+                before = conn.info('memory')['used_memory']
+                run(n)
+                grown = conn.info('memory')['used_memory'] - before
+                # the leak alone was ~560 KB here; allow for allocator noise
+                self.env.assertLess(grown, 200_000, message=q)
+        finally:
+            graph.delete()
+
     def test19_index_options_validation(self):
         # index OPTIONS are validated like C: a vector index needs a dimension
         # and a similarity function (matched case-insensitively), and a
```

---

### Incident Patch 3: `e0d9c218` (2026-11-17)
**Commit Message**: fix: never reissue an id the same query freed (CALL {} DELETE then CREATE corrupts the graph) (#3641)

* fix(planner): a UNION branch of a CALL body that imports nothing keeps its own labels

Each UNION branch of a CALL body is bound by its own binder, whose scope
ids restart at 0. The outer binder then applied its accumulated labels to
the whole body, matching a branch's inner (scope, id) keys against the
outer query's entries, so `MATCH (a:N) CALL { RETURN 0 AS x UNION CREATE
(:New) RETURN 1 AS x }` created the node as :N. The branches are already
labelled by their own binders, so skip the outer pass for a UNION body.

Part of #3164.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: never reissue an id the same query freed (#3164)

A write query is several commit segments over one MVCC version: a CALL body
commits once per input row, and a WITH after a write commits too. A segment's
DELETE freed its ids into the recycle bin, and the next segment's CREATE took
them back, while later rows (or later clauses) still held the old entity. Their
DELETE/SET then hit the NEW node: lost nodes, a corrupted graph, stats counting
each id several times.

IdSpace now keeps what earlier

**File**: `graph/src/graph/graph.rs` (modified, +30/-3)
```diff
@@ -1067,13 +1067,28 @@ impl Graph {
         }
     }
 
+    /// Everything a version does once, after its last mutation and before it is
+    /// published. Called once at MVCC commit; add new end-of-version cleanups
+    /// here rather than at the call site.
+    pub fn finish_version(&mut self) {
+        self.trim_attr_stores();
+        self.end_id_quarantine();
+    }
+
     /// Reclaim attribute-arena growth slop on blocks touched by this version.
-    /// Called once at MVCC commit.
-    pub fn trim_attr_stores(&mut self) {
+    fn trim_attr_stores(&mut self) {
         self.node_attrs.trim();
         self.relationship_attrs.trim();
     }
 
+    /// The query that owned this version is done: ids it freed may be handed out
+    /// again by the next one, and the set that held them back is not carried
+    /// into a published version. Called once at MVCC commit.
+    fn end_id_quarantine(&mut self) {
+        self.node_ids.end_quarantine();
+        self.relationship_ids.end_quarantine();
+    }
+
     #[must_use]
     pub fn new_version(&self) -> Self {
         // One dictionary clone per version instead of the two the split tables cost.
@@ -1591,6 +1606,17 @@ impl Graph {
         Ok(())
     }
 
+    /// Test stand-in for one whole query starting: open its batch and let
+    /// what an earlier query freed be reissued, as `MvccGraph` does when it
+    /// publishes. Not folded into [`Self::open_id_batches`]: that also runs
+    /// mid-query (via [`Self::roll_id_batches`]), where ending the quarantine
+    /// would let the same query reuse an id it freed.
+    #[cfg(test)]
+    fn begin_query_ids(&mut self) {
+        self.open_id_batches().expect("a consistent space");
+        self.end_id_quarantine();
+    }
+
     /// Close the open batch and begin the next one where it left the boundary.
     ///
     /// A batch is not a scope: the write path's batch ends and the next begins
@@ -5532,7 +5558,7 @@ mod reservation_tests {
     impl Query {
         /// Opening a query opens the graph's batch, exactly as `Commit` does.
         fn new(g: &mut Graph) -> Self {
-            g.open_id_batches().expect("a consistent space");
+            g.begin_query_ids();
             Self {
                 created: RoaringTreemap::new(),
                 cancelled: RoaringTreemap::new(),
@@ -5765,6 +5791,7 @@ mod reservation_tests {
         // One in the bin, two live, so three ids handed out.
         // A fresh batch, so nothing is outstanding: the first one committed.
         g.open_id_batches().expect("a consistent space");
+        g.end_id_quarantine();
         let ids = g
             .relationship_id_space()
             .reserve(2, &RoaringTreemap::new())
```

**File**: `graph/src/graph/graph/falkordb_index_tests.rs` (modified, +2/-1)
```diff
@@ -52,7 +52,8 @@ fn reserve_nodes(
     g: &mut Graph,
     n: usize,
 ) -> Vec<u64> {
-    g.open_id_batches().expect("a consistent space");
+    // Each call stands for a query of its own.
+    g.begin_query_ids();
     g.node_id_space()
         .reserve(n, &RoaringTreemap::new())
         .expect("reserved")
```

**File**: `graph/src/graph/id_space.rs` (modified, +101/-3)
```diff
@@ -205,6 +205,18 @@ pub struct IdSpace {
     /// id an earlier record of the same batch freed. Cleared with `taken`, for
     /// the same reason.
     released: RoaringTreemap,
+    /// Every id *earlier batches of this version* released: freed, but not yet
+    /// to be handed out again.
+    ///
+    /// A write query is many batches (one per commit segment) over one MVCC
+    /// version, and a row it is still carrying may name an entity an earlier
+    /// segment deleted — a `CALL {}` body commits once per input row, so row 2
+    /// still holds the node row 1's body deleted. Reissuing that id to a node
+    /// the next invocation creates makes row 2's `DELETE` remove the new node
+    /// (#3164). So [`Self::reserve`] skips these until the version is dropped:
+    /// [`Self::new_version`] starts empty, and the ids are ordinary free ids
+    /// to the next query. Accumulated by [`Self::open_batch`] from `released`.
+    quarantined: RoaringTreemap,
 }
 
 /// Append up to `count` ids from `pool` that `held` does not already hold, to
@@ -245,10 +257,12 @@ fn reclaim_ids(
     pool: &RoaringTreemap,
     taken: &RoaringTreemap,
     issued: &RoaringTreemap,
+    quarantined: &RoaringTreemap,
     count: u64,
     out: &mut Vec<u64>,
 ) -> u64 {
-    let free = pool - taken - issued;
+    let mut free = pool - taken - issued;
+    free -= quarantined;
     let before = out.len();
     out.extend(free.iter().take(count as usize));
     (out.len() - before) as u64
@@ -270,6 +284,7 @@ impl IdSpace {
             entry_bound: 0,
             taken: RoaringTreemap::new(),
             released: RoaringTreemap::new(),
+            quarantined: RoaringTreemap::new(),
         }
     }
 
@@ -288,6 +303,7 @@ impl IdSpace {
             entry_bound,
             taken: RoaringTreemap::new(),
             released: RoaringTreemap::new(),
+            quarantined: RoaringTreemap::new(),
         }
     }
 
@@ -357,6 +373,12 @@ impl IdSpace {
         self.bound() - 1
     }
 
+    /// Forget what earlier batches freed: the version's query is over, so those
+    /// ids are ordinary free ids to whoever reserves next.
+    pub fn end_quarantine(&mut self) {
+        self.quarantined = RoaringTreemap::new();
+    }
+
     /// The same id space in a new MVCC version, with a fresh batch.
     ///
     /// A version is where a batch begins, so neither `taken` nor `released` is
@@ -384,6 +406,7 @@ impl IdSpace {
             entry_bound,
             taken,
             released: RoaringTreemap::new(),
+            quarantined: RoaringTreemap::new(),
         }
     }
 
@@ -447,7 +470,17 @@ impl IdSpace {
     pub fn open_batch(&mut self) -> Result<(), IdSpaceError> {
         self.checked()?;
         self.entry_bound = self.bound();
+        // What this batch freed stays unavailable for the rest of the version.
+        // So does an id it took and handed back ([`Self::cancel`]): a creation
+        // cancelled before it committed is just as stale to a reference the
+        // query still holds, and it sits in `recycled` without being `released`.
+        self.released |= &self.taken & &self.recycled;
         self.taken.clear();
+        if self.quarantined.is_empty() {
+            std::mem::swap(&mut self.quarantined, &mut self.released);
+        } else {
+            self.quarantined |= std::mem::take(&mut self.released);
+        }
         self.released.clear();
         Ok(())
     }
@@ -495,7 +528,14 @@ impl IdSpace {
         // — `GRAPH.BULK`, or anything reserving one id at a time — would
         // otherwise have to hand its own creations back to the thing that
         // recorded them.
-        let reclaimed = reclaim_ids(&self.recycled, &self.taken, issued, count, &mut ids);
+        let reclaimed = reclaim_ids(
+            &self.recycled,
+            &self.taken,
+            issued,
+            &self.quarantined,
+            count,
+            &mut ids,
+        );
 
         // Above every id ever handed out. `entry_bound` accounts for everything
         // issued before this batch; the ids issued *by* it that sit at or above
@@ -1025,6 +1065,56 @@ mod tests {
         assert_eq!(next, vec![1], "not 0 again, even though it is free");
     }
 
+    /// #3164: a later segment of the same version must not be handed an id an
+    /// earlier segment freed, since a row can still carry the old entity.
+    #[test]
+    fn an_id_released_by_an_earlier_batch_is_not_reissued_in_the_version() {
+        let mut space = IdSpace::restored(3, RoaringTreemap::new());
+        space.open_batch().expect("a consistent space");
+        space.release(&ids(&[0]), &ids(&[0])).expect("0 is live");
+
+        // Same batch: delete is committed after the reservations, nothing to see.
+        space.open_batch().expect("a consistent space");
+        let next = space.reserve(1, &RoaringTreemap::new()).expect("reserved");
+        assert_eq!(next, vec![3], "fresh, not the freed 0");
+
+        space.create(&ids
```

**File**: `graph/src/graph/mvcc_graph.rs` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ impl MvccGraph {
             new_graph.schema_version += 1;
         }
 
-        new_graph.trim_attr_stores();
+        new_graph.finish_version();
 
         // Fold away any delta that has grown comparable to its base, then
         // materialize every committed base before publishing. The transaction
```

**File**: `graph/src/planner/binder.rs` (modified, +11/-1)
```diff
@@ -827,7 +827,17 @@ impl Binder {
         // 2b. Apply node labels to the inner body NOW, before the inner
         // scopes are popped.  This prevents scope_id reuse in the outer
         // query from overwriting the inner body's label entries.
-        self.update_all_node_labels(&mut bound_body);
+        //
+        // A UNION body is the exception: each branch is bound by its own binder
+        // (scope ids restart at 0) and was labelled from that binder's own
+        // `node_labels` already. Applying this binder's labels on top would
+        // match the branch's inner `(scope, id)` keys against the OUTER
+        // query's entries and relabel a branch node that imports nothing —
+        // `MATCH (a:N) CALL { RETURN 0 AS x UNION CREATE (:New) RETURN 1 AS x }`
+        // created the node as `:N`.
+        if !matches!(bound_body, QueryIR::Union { .. }) {
+            self.update_all_node_labels(&mut bound_body);
+        }
 
         // 2c. Remove inner-scope entries from node_labels so that a
         // subsequent CALL body (which reuses the same scope_id range)
```

**File**: `graph/src/runtime/pending.rs` (modified, +7/-0)
```diff
@@ -944,6 +944,13 @@ impl Pending {
             // The graph's half of the same event. Paired here so a caller cannot
             // unwind the pending side and leave the id unreturned.
             g.cancel_relationship_id(rel_id)?;
+            // The id stays held back for the rest of the query, so a later
+            // relationship takes the next one. The replica is told about the
+            // cancelled id as a create/delete pair of its type, which needs the
+            // type to exist: a type whose every edge was cancelled would
+            // otherwise never be registered and the pair skipped, leaving a
+            // hole before the next id that the replica refuses.
+            g.get_type_id_mut(&type_name);
             // The one durable record that this id was ever handed out, the same
             // role `cancelled_nodes` plays for the node above.
             self.cancelled_relationships.push(CancelledRelationship {
```

**File**: `proofs/graph_queries/COVERAGE.tsv` (modified, +3/-1)
```diff
@@ -15,7 +15,7 @@ graph/src/graph/graph.rs	grow_cap	860	PROVEN	Schema.growCap/growStep: growCap_ge
 graph/src/graph/graph.rs	new	876	PROVEN	Ids.newG_spec
 graph/src/graph/graph.rs	restore	921	PROVEN	Ids.restore_ids, restoreCap_covers, clampTiers_mono, restore_LInv, fillEndpoints_spec
 graph/src/graph/graph.rs	rebuild_derived_matrices	1034	PROVEN	Ids.rebuildRelType_complete (tensor rebuild_backward = GraphBLAS transpose); #3250 node half Ids.rebuildNodeMs (node_cap = max(node_cap, saved)): rebuild_never_shrinks, rebuild_keeps_entries (tensor dims not on Ten; Tensor::resize in versioned_matrix)
-graph/src/graph/graph.rs	trim_attr_stores	1072	PROVEN	Ids.trimAttrStores_id
+graph/src/graph/graph.rs	trim_attr_stores	1079	PROVEN	Ids.trimAttrStores_id
 graph/src/graph/graph.rs	new_version	1078	PROVEN	Ids.newVersion_spec (fresh batch per version)
 graph/src/graph/graph.rs	name	1140	PROVEN	Accessors (field projection; newVersion_spec keeps it)
 graph/src/graph/graph.rs	node_count	1145	PROVEN	Ids.markNodesLive_spec / nodeBound_eq (IdSpace::live) || IdSpaceContract discharged: IdRust.rustIdOps_contract (instances in IdRustUse)
@@ -201,3 +201,5 @@ graph/src/graph/graph.rs	edge_has_type_id	1332	PROVEN	Schema.edgeHasTypeId_iff (
 # Online index build (#2355): fns the background builder added, not modelled yet.
 graph/src/graph/graph.rs	Graph::add_native_build	4510	NOT COVERED	online index build (#2355): not modelled yet
 graph/src/graph/graph.rs	Graph::native_build_total	4546	NOT COVERED	online index build (#2355): not modelled yet
+graph/src/graph/graph.rs	end_id_quarantine	1087	NOT COVERED	(#3164): not modelled yet
+graph/src/graph/graph.rs	finish_version	1073	NOT COVERED	(#3164): end-of-version tail calling trim_attr_stores and end_id_quarantine; the quarantine half is not modelled yet
```

**File**: `proofs/id_space/COVERAGE.tsv` (modified, +4/-3)
```diff
@@ -10,16 +10,17 @@ graph/src/graph/id_space.rs	IdSpace::taken	311	PROVEN	IdSpace.takenSet: takenSet
 graph/src/graph/id_space.rs	IdSpace::released	317	PROVEN	IdSpace.releasedSet: releasedSet_eq, released_new/restored/newVersion, openBatch_clears, release_records, create/cancel_keeps_released, Inv.relOk (#3022)
 graph/src/graph/id_space.rs	IdSpace::recycled_count	323	PROVEN	IdSpace.recycledCount (= sLen recycled): release_succeeds bound arithmetic
 graph/src/graph/id_space.rs	IdSpace::is_free	329	PROVEN	IdSpace.isFree (= recycled id): cancel_succeeds (free iff below boundary)
-graph/src/graph/id_space.rs	IdSpace::bound	343	PROVEN	IdSpace.bound: checked_ok_iff, release_succeeds (unchanged by release), roll_inv
+graph/src/graph/id_space.rs	IdSpace::bound	361	PROVEN	IdSpace.bound: checked_ok_iff, release_succeeds (unchanged by release), roll_inv
 graph/src/graph/id_space.rs	IdSpace::max_id	353	PROVEN	IdSpace.maxId: maxId_spec (bound - 1 cannot underflow when live != 0)
 graph/src/graph/id_space.rs	IdSpace::new_version	367	PROVEN	IdSpace.newVersion: newVersion_spec, openBatch_eq_newVersion, roll_inv, released_newVersion (released not carried, #3022)
 graph/src/graph/id_space.rs	IdSpace::checked	403	PROVEN	IdSpace.checked: checked_ok_iff (checked_add, expected == bound), Inv.checked
-graph/src/graph/id_space.rs	IdSpace::open_batch	447	PROVEN	IdSpace.openBatch: openBatch_spec, openBatch_ok, openBatch_eq_newVersion, roll_inv, openBatch_clears (taken and released emptied, #3022)
+graph/src/graph/id_space.rs	IdSpace::open_batch	472	NOT COVERED	(#3164): open_batch now also quarantines the ids freed or cancelled in the segment (end_quarantine), which the model does not carry. Was PROVEN: IdSpace.openBatch: openBatch_spec, openBatch_ok, openBatch_eq_newVersion, roll_inv, openBatch_clears (taken and released emptied, #3022)
 graph/src/graph/id_space.rs	IdSpace::reserve	483	PROVEN	IdSpace.reserve: reserve_spec (exact and unconditional, total: reclaimed prefix ++ fresh run whose u64 end wraps in release), reserve_spec_nowrap, reserve_wraps/reserve_wraps_example (the overflow case: restored(u64::MAX) + 1 id gives none), reserve_length (when the run's end fits in a u64), reserve_alloc_fail (unconditional). Corollaries reserve_fresh/reserve_then_cancel/lifecycle_fresh (ids fresh, then cancellable) take caller-state hypotheses hdense (taken/issued ids at or above eb lie below start; maintained by the batch's own create/cancel) and id != u64::MAX; not needed for the spec
 graph/src/graph/id_space.rs	IdSpace::cancel	529	PROVEN	IdSpace.cancel: cancel_taken, cancel_fresh (unconditional, total). Corollary cancel_succeeds (Ok + Inv kept) takes caller hypotheses id != u64::MAX (cancel does not check it) and id fresh below eb iff recycled; reserve_then_cancel discharges the latter for ids from reserve
 graph/src/graph/id_space.rs	IdSpace::refuse_recycled	550	PROVEN	IdSpace.refuseRecycled: refuseRecycled_ok, refuseRecycled_err
-graph/src/graph/id_space.rs	IdSpace::create	581	PROVEN	IdSpace.create/idLimit: create_spec (all or nothing), create_out_of_range (max >= ID_LIMIT refused, #2911), create_expect_unreachable, create_succeeds, create_preserves
+graph/src/graph/id_space.rs	IdSpace::create	623	PROVEN	IdSpace.create/idLimit: create_spec (all or nothing), create_out_of_range (max >= ID_LIMIT refused, #2911), create_expect_unreachable, create_succeeds, create_preserves
 graph/src/graph/id_space.rs	IdSpace::refuse_undeletable	637	PROVEN	IdSpace.refuseUndeletable: refuseUndeletable_ok, refuseUndeletable_err
 graph/src/graph/id_space.rs	IdSpace::refuse_not_live	675	PROVEN	IdSpace.refuseNotLive: refuseNotLive_ok, refuseNotLive_err, refuseNotLive_live (accepts exactly live ids), refuseNotLive_minus_released, freed_earlier_refused (#3022)
 graph/src/graph/id_space.rs	IdSpace::release	699	CONDITIONAL	IdSpace.release: release_spec, release_refused, release_records describe the model, whose afterRelease subtracts with Nat (saturating at 0); Rust does `self.live -= freed.len()` on u64 (id_space.rs:716: panics in debug, wraps in release). The two agree only under the caller contract freed ⊆ requested (hsub) with Inv, which Rust checks only by debug_assert! (id_space.rs:711) and which no proof discharges for the callers (graph.rs delete paths): undischarged hypothesis. Given it, release_no_underflow (|freed| ≤ live) and release_succeeds hold.
 graph/src/graph/id_space.rs	IdSpace::verify	733	PROVEN	IdSpace.holeCheck/verify: holeCheck_eq, noHole_iff, verify_ok_iff (checked + taken>=eb = [eb, eb+created)), verify_hole, verify_no_underflow
+graph/src/graph/id_space.rs	IdSpace::end_quarantine	380	NOT COVERED	(#3164): not modelled yet
```

#### Recent Merged Pull Requests:
- **PR #3853** (closed): fix: a queued write an inline write overtook re-runs as a writer, so a stream of them cannot starve it (@AviAvni)
- **PR #3839** (2026-11-16): fix(fuzz): initialise RediSearch in the fuzz harnesses so index queries don't crash (@AviAvni)
- **PR #3837** (2026-11-17): chore(proofs): Lean v4.36.0; retire the PR review projects (@AviAvni)
- **PR #3833** (2026-11-16): ci: /proofs apply commits a held proof patch whose gates passed (@AviAvni)
- **PR #3825** (2026-11-15): chore(deps): bump the cargo-deps group across 1 directory with 4 updates (@dependabot[bot])
- **PR #3824** (2026-11-15): fix: AUTH on Valkey crashes the server in RediSearch's slot migration handler (@DvirDukhan)

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

## X. a cascaded edge of a new type no longer panics compact replies or opens a replic

**RULE**:
When implementing operations in `graph/src/effects/v3/emit.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `27951021`: a cascaded edge of a new type no longer panics compact replies or opens a replica id gap. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `graph/src/effects/v3/emit.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // `Pending::commit` registers the type of every cancelled edge, so the
        // id is there and `emit_schema_additions` has announced it. Skipped
        // rather than invented if it ever is not: a made-up id would index the
        // pair under some other type.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        // A type whose every edge was cancelled was never registered on this
        // graph — nothing of it reached `create_relationships_bulk` — so there
        // is no id to state and no `ADD_SCHEMA` announcing one. Skipped rather
        // than invented: a made-up id would index the pair under some other
        // type. The reservation those ids came from is still the master's, so
        // this case leaves the two relationship bounds apart. It cannot be
        // closed with the records this format has.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `27951021` are properly handled with clean fallback behavior.
