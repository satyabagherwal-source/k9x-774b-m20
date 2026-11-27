# Verification Protocol: Verification Protocol: Empirical Defect Shield for falkordb-falkordb-learnings

<!-- PROVENANCE_START
{
  "source_repository": "falkordb-falkordb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T16:03:11.920Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-falkordb-falkordb-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [falkordb-falkordb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T16:03:11.920Z`  
> **Learning ID**: `LEARN-EVO-falkordb-falkordb-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `falkordb-falkordb-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source**: github ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Source Version**: `3bba59f2`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T16:03:01.083Z  
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
> **Harvest Timestamp**: 2026-11-27T16:03:00.949Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 10577 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/src/falkorbench/soak/score.py`
```
"""Score soak results. usage: python score.py <results-root> [--layout full|smoke]

full layout:  <root>/<scenario>-rust/summary.json and <root>/<scenario>-c/summary.json, each once the
              runner marked it finished (.done); a finished archive <scenario>-rust@<label> stands in
              while the Rust run repeats, and a C run that did not exit 0 is no baseline (see main)
smoke layout: <root>/work/<scenario>/<run>/summary.json — the agent's largest Rust run and its C run
              are picked by meta.engine / module path heuristics (see pick_smoke).
Writes <root>/scores.json.

Rubric per scenario (100):
  correctness 40  any critical check failed -> 0; each major -8; each minor -2
  stability   25  crash markers or server dead while not intentionally killed -> 0;
                  unexpected error rate (ops not starting with "_" or "expect"/"chaos"/"bad") :
                  25 * (1 - min(1, err_rate / 0.01))
  resources   15  7.5 for RSS slope during soak (<= 1% of rss_max per hour full, >= 10%/h zero)
                  7.5 for peak RSS vs C (<= 1.0 full, >= 2.0 zero; no C -> 7.5 * 0.5)
  performance 20  10 for p99 vs C, geometric mean over shared ops (<= 1.0 full, >= 3.0 zero)
                  5 for throughput vs C on shared ops (>= 0.95 full, <= 0.5 zero)
                  5 for latency drift (worst late/early p99 ratio <= 1.5 full, >= 4 zero)
Release score = mean of scenario scores; release is BLOCKED if any critical check fails on Rust,
or a Rust run did not exit 0 (failed_runs; scored if it left a summary).
"""
import json
import math
import sys
from pathlib import Path

EXPECTED_ERR = ("_", "e1_", "e2_", "e3_", "e4_", "e5_", "e6_", "e7_", "e8_", "e9_", "expect", "chaos", "bad", "malformed", "err_", "timeout", "kill", "slow",
                "fail", "ro_write", "violat", "invalid")


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def lin(x, good, bad):
    """1 at good, 0 at bad, linear in between (works for either direction)."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return clamp((x - bad) / (good - bad))


def unexpected(op):
    return not op.lower().startswith(EXPECTED_ERR) and not any(k in op.lower() for k in EXPECTED_ERR[1:])


def pre_soak_rss(d):
    """Peak RSS before the first load phase = memory for the loaded dataset (equal data on both engines)."""
    m = d / "monitor.csv"
    if not m.exists():
        return None
    best = None
    lines = m.read_text().splitlines()[1:]
    if not any(len(l.split(",")) >= 8 and l.split(",")[7].startswith(("soak", "load")) for l in lines):
        return None  # run never reached its load phase (e.g. crashed during ingest): no equal-data point
    for l in lines:
        p = l.split(",")
        if len(p) < 8:
            continue
        if p[7].startswith(("soak", "load")):
            break
        try:
            v = float(p[2])
        except ValueError:
            continue
        if v == v:
            best = v if best is None else max(best, v)
    return best


def total_ok_ops(summ):
    return sum(d["throughput_ops_s"] for o, d in summ.get("ops", {}).items() if unexpected(o))


def score(rust, c, rdir=None, cdir=None):
    out = {"notes": []}
    checks = rust.get("checks", [])
    ov = [o for o in OVERRIDES if o["scenario"] == rust.get("meta", {}).get("scenario") and o["engine"] == "rust"]
    if ov:
        kept = []
        for x in checks:
            hit = next((o for o in ov if not x["ok"] and o.get("check_prefix") and x["name"].startswith(o["check_prefix"])), None)
            if hit:
                out["notes"].append(f"override: '{x['name']}' counted as pass. {hit['reason']}")
                x = {**x, "ok": True}
            kept.append(x)
        checks = kept
    crit = [x for x in checks if not x["ok"] and x.get("severity") == "critical"]
    major = [x for x in checks if not x["ok"] and x.get("severity") == "major"]
    minor = [x for x in checks if not x["ok"] and x.get("severity") == "minor"]
    corr = 0 if crit else max(0, 40 - 8 * len(major) - 2 * len(minor))

    ops = rust.get("ops", {})
    n = sum(d["count"] for o, d in ops.items() if unexpected(o))
    e = sum(d["errors"] for o, d in ops.items() if unexpected(o))
    er = e / n if n else 0
    crashed = bool(rust.get("server_log_crash_markers"))
    stab = 0 if crashed else 25 * (1 - min(1, er / 0.01))

    mon, cmon = rust.get("monitor", {}), (c or {}).get("monitor", {})
    rmax = mon.get("rss_max_mb") or 0
    slope = mon.get("rss_slope_mb_per_h")
    # Memory growth: workloads that add data grow on both engines, so compare used_memory growth
    # with C's on the same workload when available; else fall back to RSS slope as % of peak per hour.
    um_slope, c_um_slope = mon.get("used_mem_slope_mb_per_h"), cmon.get("used_mem_slope_mb_per_h")
    r_ops, c_ops = total_ok_ops(rust), total_ok_ops(c or {})
    if um_slope is not None and c_um_slope is not None and c_um_slope > 1 and r_ops and c_ops:
        # growth per unit of work done: engines run at different throughputs and durations
        growth_ratio = (um_slope / r_ops) / (c_um_slope / c_ops)
        s_slope = lin(growth_ratio, 1.2, 3.0)
        out["notes"].append(f"used_memory growth vs C: {growth_ratio:.2f}x")
    else:
        slope_pct = (slope / rmax * 100) if (slope is not None and rmax) else None
        s_slope = lin(slope_pct, 1, 10)
    r_pre, c_pre = (pre_soak_rss(rdir) if rdir else None), (pre_soak_rss(cdir) if cdir else None)
    if r_pre and c_pre:
        mem_ratio = r_pre / c_pre  # same dataset loaded on both
        out["notes"].append(f"RSS after ingest: Rust {r_pre:.0f} MB, C {c_pre:.0f} MB")
    else:
        mem_ratio = (rmax / cmon["rss_max_mb"]) if cmon.get("rss_max_mb") else None
    s_mem = lin(mem_ratio, 1.0, 2.0)
    res = 7.5 * (s_slope if s_slope is not None else 0.5) + 7.5 * (s_mem if s_mem is not None else 0.5)

    cops = (c or {}).get("ops", {})
    shared = [o for o in ops if o in cops and unexpected(o) and ops[o]["count"] > 50 and cops[o]["count"] > 50
              and ops[o]["p99_ms"] == ops[o]["p99_ms"] and cops[o]["p99_ms"] == cops[o]["p99_ms"]]
    p99r = {o: ops[o]["p99_ms"] / cops[o]["p99_ms"] for o in shared if cops[o]["p99_ms"] > 0}
    gm = math.exp(sum(math.log(v) for v in p99r.values()) / len(p99r)) if p99r else None
    thr = {o: ops[o]["throughput_ops_s"] / cops[o]["throughput_ops_s"] for o in shared
           if cops[o]["throughput_ops_s"] > 0}
    thr_gm = math.exp(sum(math.log(max(v, 1e-6)) for v in thr.values()) / len(thr)) if thr else None
    drifts = [d["drift"]["ratio"] for o, d in ops.items()
              if unexpected(o) and d.get("drift") and d["drift"].get("ratio")]
    worst_drift = max(drifts) if drifts else None
    s_p99, s_thr, s_drift = lin(gm, 1.0, 3.0), lin(thr_gm, 0.95, 0.5), lin(worst_drift, 1.5, 4.0)
    gw = next((o for o in OVERRIDES if o.get("growth_workload") and o["scenario"] == rust.get("meta", {}).get("scenario")), None)
    if gw:  # data grows by design: slope and drift measure the data, not the engine
        s_drift = 1.0
        res = 7.5 * 1.0 + 7.5 * (s_mem if s_mem is not None else 0.5)
        out["notes"].append("growth workload: " + gw["reason"])
    perf = (10 * (s_p99 if s_p99 is not None else 0.5) + 5 * (s_thr if s_thr is not None else 0.5)
            + 5 * (s_drift if s_drift is not None else 0.5))
    out.update({
        "correctness": corr, "stability": round(stab, 1), "resources": round(res, 1),
        "performance": round(perf, 1), "total": round(corr + stab + res + perf, 1),
        "critical_failures": crit, "major_failures": major, "minor_failures": minor,
        "unexpected_err_rate": er, "crashed": crashed, "rss_max_mb": rmax, "rss_slope_mb_h": slope,
        "rss_vs_c": mem_ratio, "p99_vs_c_gmean": gm, "p99_vs_c": p99r, "thr_vs_c_gmean": thr_gm,
        "worst_drift": worst_drift, "cpu_avg": mon.get("cpu_avg_pct"), "c_cpu_avg": cmon.get("cpu_avg_pct"),
        "c_failed_checks": [x["name"] for x in (c or {}).get("checks_failed", [])]})
    return out


OVERRIDES = []


def finished(d):
    """The runner marked the run finished (run_*.sh write .rc, then .done, whatever the exit)."""
    return (d / ".done").exists()


def exit_status(d):
    """The finished run's exit status (.rc), or None when it has none to read."""
    try:
        return int((d / ".rc").read_text().strip())
    except (OSError, ValueError):
        return None


def succeeded(d):
    return finished(d) and exit_status(d) == 0


def read_summary(p):
    """summary.json's content, or None when there is none or it does not parse (a run killed
    while it wrote the file)."""
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def rust_runs(root):
    """The Rust run to score per scenario, and the scenarios with none finished yet.

    The current <scenario>-rust counts once it finished (a run in progress has written
    summary.json only part way). While it runs again, or after run_rust_main.sh discarded
    all its contended attempts, the newest finished archive <scenario>-rust@<label> (any
    label, by .done time) stands in for it."""
    runs, running = {}, set()
    for d in sorted(root.glob("*-rust")):
        name = d.name[:-len("-rust")]
        if finished(d):
            runs[name] = d
        else:
            running.add(name)
    archives = sorted((d for d in root.glob("*-rust@*") if finished(d)),
                      key=lambda d: (d / ".done").stat().st_mtime, reverse=True)
    for d in archives:
        runs.setdefault(d.name.split("-rust@")[0], d)
    return runs, sorted(running - set(runs))


def main():
    global OVERRIDES
    root = Path(sys.argv[1])
    if (root / "overrides.json").exists():
        OVERRIDES = json.loads((root / "overrides.json").read_text())
    res = {}
    failed = {}  # scenario -> why its Rust run failed: a blocker, scored or not
    runs, pending = rust_run
```

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

use arcstr::ArcStr;
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
    labels: impl Iterator<Item = ArcStr>,
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
type Scan<T> = Option<(T, ArcStr, IndexQuery<QueryExpr<Variable>>)>;

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
    fn all_labels(&self) -> Box<dyn Iterator<Item = &ArcStr> + '_>;

    /// Look up the appropriate indexer (node vs edge) on the graph.
    fn is_indexed(
        graph: &Graph,
        label: &ArcStr,
        attr: &ArcStr,
        ty: IndexType,
    ) -> bool;

    /// Subject-specific hook for function-based predicates. Node impl
    /// delegates to `try_distance_index_scan`; edge impl returns `None`
    /// (no edge-distance path is exercised today).
    fn try_func_scan(
        subject: &Self,
        attr: &ArcStr,
        filter: &DynTree<ExprIR<Variable>>,
        attr_side: NodeIdx<Dyn<ExprIR<Variable>>>,
        constant_node: DynTree<ExprIR<Variable>>,
        label: ArcStr,
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
        index: ArcStr,
        query: Arc<IndexQuery<QueryExpr<Variable>>>,
        metadata: Self::Metadata,
    ) -> IR;

    /// Returns a copy of the subject whose labels/types list places
    /// `label` first. The runtime index-scan ops treat `labels[0]` /
    /// `types[0]` as the index key and post-filter the rest.
    fn with_primary_label(
        &self,
        label: &ArcStr,
    ) -> Self;
}

impl IndexSubject for Arc<QueryNode<ArcStr, Variable>> {
    type Metadata = ();

    fn alias(&self) -> &Variable {
        &self.alias
    }
    fn all_labels(&self) -> Box<dyn Iterator<Item = &ArcStr> + '_> {
        Box::new(self.labels.iter())
    }
    fn is_indexed(
        graph: &Graph,
        label: &ArcStr,
        attr: &ArcStr,
        ty: IndexType,
    ) -> bool {
        graph.is_indexed(label, attr, &ty)
    }
    fn try_func_scan(
        subject: &Self,
        attr: &ArcStr,
        filter: &DynTree<ExprIR<Variable>>,
        attr_side: NodeIdx<Dyn<ExprIR<Variable>>>,
        constant_node: DynTree<ExprIR<Variable>>,
        label: ArcStr,
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
        index: ArcStr,
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
        label: &ArcStr,
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

impl IndexSubject for Arc<QueryRelationship<ArcStr, ArcStr, Variable>> {
    type Metadata = bool; // transposed

    fn alias(&self) -> &Variable {
        &self.alias
    }
    fn all_labels(&self) -> Box<dyn Iterator<Item = &ArcStr> + '_> {
        Box::new(self.types.iter())
    }
    fn is_indexed(
        graph: &Graph,
        label: &ArcStr,
        attr: &ArcStr,
        ty: IndexType,
    ) -> bool {
        graph.is_edge_indexed(label, attr, &ty)
    }
    fn try_func_scan(
        _subject: &Self,
        _attr: &ArcStr,
        _filter: &DynTree<ExprIR<Variable>>,
        _attr_side: NodeIdx<Dyn<ExprIR<Variable>>>,
        _constant_node: DynTree<ExprIR<Variable>>,
        _label: ArcStr,
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
        _index: ArcStr,
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
        label: &ArcStr,
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
    }
}

/// Build an `IndexQuery` for a single comparison operator over a
/// (attr, constant) pair. Used by
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

pub(super) fn get_id_filter(
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4074** (2026-11-26): **fix(banner): wait for the output queue before each line, not after it**
  *Symptoms*: Closes #4073  `banner::tests::whole_banner_reaches_a_draining_terminal` failed at random in CI's Rust `coverage` job. The test's reader closes the pty master as soon as it has read the whole banner. On Linux that hangs up the slave at once, so when the writer was preempted between its last line and the `TIOCOUTQ` check that followed it, that check failed with `EIO`. `write_bounded` then returned false for a banner that had already arrived in full.  ## Change (`src/banner/mod.rs`)  - `write_bounded` waits for the output queue to drain **before** each line instead of after it, so nothing touches the terminal after the last line. The queue still holds at most one line, and a terminal that never drains is bounded as before. - `write_bounded` and `drained` take `impl Write + AsFd` and a `BorrowedFd`. `print()` is unchanged. - New test `whole_banner_reaches_a_terminal_that_closes_once_it_has_it`: its terminal closes the master the moment the last byte is read, which is the order CI hit. On Linux it fails every time with the old logic.   <!-- This is an auto-generated description by cubic. --> --- ## Summary by cubic Fixes the flaky `banner::tests::whole_banner_reaches_a_draining_terminal` test, which failed when the terminal closed as soon as it read the full banner: on Linux, the final output-queue check after the last line hit `EIO` and made `write_bounded` return false for a banner that had already arrived.  - Waits for the output queue to drain before each line rather than afte

- **Issue #4073** (2026-11-26): **[Flaky] banner::tests::whole_banner_reaches_a_draining_terminal fails the Rust coverage job at random**
  *Symptoms*: `banner::tests::whole_banner_reaches_a_draining_terminal` (`src/banner/mod.rs:354`, added with the logo in #3973) fails at random in CI. It runs in the Rust `coverage` job (`cargo test -p falkordb-rs --lib`), which `ci-gate` requires, so a failure fails pull request CI and merge-queue runs that changed nothing near the banner.  ``` thread 'banner::tests::whole_banner_reaches_a_draining_terminal' panicked at src/banner/mod.rs:354:9: assertion failed: write_bounded(&mut tty, &banner, Duration::from_secs(5)) test result: FAILED. 19 passed; 1 failed; ... finished in 0.05s ```  ## Where it failed  | when | run | job | | --- | --- | --- | | 25 Nov, merge queue (#3988) | [45669084732](https://github.com/FalkorDB/FalkorDB/actions/runs/45669084732) | coverage | | 25 Nov, merge queue (#3988) | [45673763066](https://github.com/FalkorDB/FalkorDB/actions/runs/45673763066) | coverage | | 26 Nov, merge queue (#4007) | [45766849139](https://github.com/FalkorDB/FalkorDB/actions/runs/45766849139) | coverage (job 139729767903) | | 26 Nov, pull request #4039 | [45847356345](https://github.com/FalkorDB/FalkorDB/actions/runs/45847356345) | coverage (job 140004870649) |  Each passed on a re-run.  ## What the test does  It opens a pty, starts a reader thread on the master side, reopens the slave side with `O_NONBLOCK` (`reopen_nonblocking`), and asserts that `write_bounded` writes the whole banner within 5 s. `write_bounded` writes one line at a time with `write_all` and waits for `TIOCOUTQ` to reac

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

### Incident Patch 1: `dc5d7837` (2026-11-26)
**Commit Message**: fix(banner): wait for the output queue before each line, not after it (#4074)

banner::tests::whole_banner_reaches_a_draining_terminal failed at random in
CI's coverage job. write_bounded waited for the output queue to drain after
every line, the last one included. The test's reader thread closes the pty
master as soon as it has read the whole banner, and on Linux that hangs up
the slave end. When the reader won that race, the final TIOCOUTQ failed with
EIO and write_bounded returned false, although every byte had arrived.

write_bounded now waits for the queue to drain before each line instead of
after it, so it does not touch the terminal after the last line. A paused
terminal, or one that nobody reads, costs no more time than before and is
left with the same queued output.

The new test whole_banner_reaches_a_terminal_that_closes_once_it_has_it
closes the master the moment the last byte is read, which forces that
order every time. With the old logic it failed 100 of 100 runs on Linux;
on macOS TIOCOUTQ still succeeds after the master closes, so it passes
there either way. Under load (builder image on arm64 Linux, --cpus 2,
8 CPU hogs), the banner tests failed 38 of 1000 runs bef

**File**: `src/banner/mod.rs` (modified, +75/-9)
```diff
@@ -21,7 +21,7 @@ use std::{
     fs::{File, OpenOptions},
     io::{IsTerminal, Write},
     os::{
-        fd::{AsRawFd, RawFd},
+        fd::{AsFd, AsRawFd, BorrowedFd, RawFd},
         unix::fs::OpenOptionsExt,
     },
     thread,
@@ -120,21 +120,25 @@ pub fn print() {
     }
 }
 
-/// Writes `text` to `tty` a line at a time, each line only once the previous
-/// one has left the output queue; stops at the first line the terminal does
-/// not take within `wait`. Returns whether all of `text` was written.
+/// Writes `text` to `tty` a line at a time. Before each line it waits up to
+/// `wait` for the output queue to empty, and it stops at the first line it
+/// cannot send. Returns whether all of `text` was written.
+///
+/// Waiting before each line rather than after it means `tty` is not touched
+/// after the last line: if the terminal closes as soon as it has read all of
+/// `text`, the result is still true.
 fn write_bounded(
-    tty: &mut File,
+    tty: &mut (impl Write + AsFd),
     text: &str,
     wait: Duration,
 ) -> bool {
     text.split_inclusive('\n')
-        .all(|line| tty.write_all(line.as_bytes()).is_ok() && drained(tty, wait))
+        .all(|line| drained(tty.as_fd(), wait) && tty.write_all(line.as_bytes()).is_ok())
 }
 
 /// Waits up to `wait` for the terminal's output queue to empty.
 fn drained(
-    tty: &File,
+    tty: BorrowedFd<'_>,
     wait: Duration,
 ) -> bool {
     let deadline = Instant::now() + wait;
@@ -177,8 +181,8 @@ fn reopen_nonblocking(fd: RawFd) -> Option<File> {
 mod tests {
     use std::{
         fs::File,
-        io::Read,
-        os::fd::{FromRawFd, OwnedFd},
+        io::{self, Read, Write},
+        os::fd::{AsFd, AsRawFd, BorrowedFd, FromRawFd, OwnedFd},
         thread,
         time::{Duration, Instant},
     };
@@ -361,6 +365,68 @@ mod tests {
         assert_eq!(String::from_utf8(got).unwrap(), banner);
     }
 
+    /// A terminal that reads every write at once and closes as soon as it has
+    /// the whole banner, before `write_bounded` returns. The reader thread in
+    /// `whole_banner_reaches_a_draining_terminal` does the same when it beats
+    /// the writer on a busy machine (#4073). On Linux, closing the master end
+    /// hangs up the slave end, and every later call on it fails with EIO. macOS
+    /// still answers TIOCOUTQ after that, so this test guards Linux only.
+    struct ClosesOnceItHasEverything {
+        tty: File,
+        master: Option<File>,
+        want: usize,
+        sent: usize,
+        got: Vec<u8>,
+    }
+
+    impl Write for ClosesOnceItHasEverything {
+        fn write(
+            &mut self,
+            buf: &[u8],
+        ) -> io::Result<usize> {
+            let master = self.master.as_mut().expect("written to after closing");
+            let n = self.tty.write(buf)?;
+            self.sent += n;
+            let mut chunk = [0u8; 4096];
+            // The pty turns each \n into \r\n on the way out.
+            while self.got.len() < self.sent {
+                let read = master.read(&mut chunk)?;
+                assert_ne!(read, 0, "pty closed");
+                self.got
+                    .extend(chunk[..read].iter().filter(|&&b| b != b'\r'));
+            }
+            if self.sent == self.want {
+                self.master = None;
+            }
+            Ok(n)
+        }
+
+        fn flush(&mut self) -> io::Result<()> {
+            self.tty.flush()
+        }
+    }
+
+    impl AsFd for ClosesOnceItHasEverything {
+        fn as_fd(&self) -> BorrowedFd<'_> {
+            self.tty.as_fd()
+        }
+    }
+
+    #[test]
+    fn whole_banner_reaches_a_terminal_that_closes_once_it_has_it() {
+        let (master, slave) = pty();
+        let banner = banner();
+        let mut tty = ClosesOnceItHasEverything {
+            tty: reopen_nonblocking(slave.as_raw_fd()).expect("reopen"),
+            master: Some(master),
+            want: banner.len(),
+            sent: 0,
+            got: Vec::new(),
+        };
+        assert!(write_bounded(&mut tty, &banner, Duration::from_secs(5)));
+        assert_eq!(String::from_utf8(tty.got).unwrap(), banner);
+    }
+
     #[test]
     fn a_paused_terminal_costs_at_most_one_wait_and_keeps_its_queue_free() {
         let (mut master, slave) = pty();
```

---

### Incident Patch 2: `ab7a330e` (2026-11-26)
**Commit Message**: ci(perf): fix the bot review findings left open on the merged perf PRs (#4070)

* test(soak): the release-soak run scripts stop only their own scenario's servers

run_rust_main.sh and run_c_rerun.sh ran `pkill -9 -f 'redis-server \*:19'`
before and after every scenario, which SIGKILLs any redis-server on a 19xxx
port: another soak, or a developer's server. Each scenario now runs in a
process group of its own (process_group.sh, sourced by both), and only that
group is killed after it, including a server the scenario left behind. The
group is also reaped when the script itself is stopped. A server this run did
not start is never touched: soakkit already refuses to start on a port that
answers.

Review thread: https://github.com/FalkorDB/FalkorDB/pull/4008#discussion_r4700963885

* test(soak): the release-soak scorer takes finished runs only, from any campaign

score.py scored every <scenario>-rust/summary.json, though a scenario writes
its summary part way through a run, and fell back to an archived run only
under the label d070f1f9b, while run_rust_main.sh archives the previous run
as <scenario>-rust@<label> for any label. A C baseline counted once it had
.done, which both runners w

**File**: `.github/workflows/_perf-vm.yml` (modified, +4/-0)
```diff
@@ -398,6 +398,8 @@ jobs:
           name: perf-result-${{ inputs.check }}
           path: out/
           if-no-files-found: warn
+          # "Re-run all jobs" uploads the name again: replace the earlier attempt's
+          overwrite: true
 
   cleanup:
     name: Delete VM
@@ -525,3 +527,5 @@ jobs:
           name: perf-result-${{ inputs.check }}
           path: out/
           if-no-files-found: warn
+          # "Re-run all jobs" uploads the name again: replace the earlier attempt's
+          overwrite: true
```

**File**: `.github/workflows/benchmark-cov.yml` (modified, +10/-2)
```diff
@@ -255,10 +255,13 @@ jobs:
           CANDIDATE: ${{ inputs.candidate_image }}
           BASELINE: ${{ inputs.baseline_image }}
           BASELINE_BELOW: ${{ inputs.baseline_below }}
-          BASE_SHA: ${{ github.event.pull_request.base.sha }}
-          BASE_REF: ${{ github.event.pull_request.base.ref }}
+          # The gate's caller runs in the merge queue, where the base is the merge group's
+          # (base_ref there is refs/heads/<branch>).
+          BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.merge_group.base_sha }}
+          BASE_REF: ${{ github.event.pull_request.base.ref || github.event.merge_group.base_ref }}
         run: |
           set -euo pipefail
+          BASE_REF=${BASE_REF#refs/heads/}
           # pin REF prints name@digest; exit 3 when the registry says REF does not
           # exist, 1 for any other failure (which must not read as "no image").
           pin() {
@@ -401,6 +404,8 @@ jobs:
           name: provenance
           path: provenance.json
           retention-days: 7
+          # "Re-run all jobs" uploads each name again: replace the earlier attempt's
+          overwrite: true
 
   # Full query set, one runner per side, all three at once.
   measure:
@@ -472,6 +477,7 @@ jobs:
             measure-${{ matrix.side }}.log
             failed-${{ matrix.side }}.json
           retention-days: 7
+          overwrite: true
 
   # Deterministic instruction counts, PR vs base.
   #
@@ -569,6 +575,7 @@ jobs:
           name: callgrind-${{ matrix.side }}-${{ matrix.shard }}
           path: cg-${{ matrix.side }}-${{ matrix.shard }}.csv
           retention-days: 7
+          overwrite: true
 
   # The one job that must build from source: coverage needs an instrumented
   # module, which no published image carries. Runs alongside the measurement jobs,
@@ -636,6 +643,7 @@ jobs:
           name: coverage
           path: coverage.txt
           retention-days: 7
+          overwrite: true
 
   # Fan-in. `!cancelled()` rather than `success()`: a side that failed should cost
   # its own column and nothing else, and the report is built from whatever CSVs
```

**File**: `.github/workflows/rust-pr.yml` (modified, +66/-4)
```diff
@@ -53,6 +53,10 @@ jobs:
       # X.Y+1.0 in the merge queue of version branch X.Y, else empty: the release
       # gate runs only when it is set (the `perf` and `perf-cov` jobs).
       perf_below: ${{ steps.key.outputs.perf_below }}
+      # 'true' when the pull request (the queued one, under merge_group) comes
+      # from this repository: the release gate runs only for those, since its
+      # VM gets compute write access.
+      same_repo: ${{ steps.fork.outputs.same_repo }}
     steps:
       - name: Checkout repository
         uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -143,16 +147,27 @@ jobs:
       # absent under merge_group, so the queued pull request is resolved from
       # the ref — gh-readonly-queue/<base>/pr-<N>-<sha> — and its head repo
       # checked. Anything unresolvable fails closed.
+      #
+      # It also says whether the code under test comes only from this
+      # repository's pull requests (same_repo): the release gate runs it on a GCE
+      # VM with compute write access, so it runs only then. In a version branch's
+      # queue that means every pull request in the merge group, since a group
+      # holds the entries queued ahead of this one too; a pull request that
+      # cannot be looked up counts as a fork.
       - name: Refuse fork changes to build or CI infrastructure
+        id: fork
         if: ${{ !cancelled() }}
         env:
           GH_TOKEN: ${{ github.token }}
           EVENT: ${{ github.event_name }}
           PR_HEAD_REPO: ${{ github.event.pull_request.head.repo.full_name }}
           REF: ${{ github.ref }}
           PATTERN: ${{ steps.check.outputs.pattern }}
+          PERF_BELOW: ${{ steps.key.outputs.perf_below }}
+          QUEUE_BASE_REF: ${{ github.event.merge_group.base_ref }}
         run: |
           set -euo pipefail
+          not_ours=""
           if [ "$EVENT" = "merge_group" ]; then
             N=$(printf '%s' "$REF" | sed -n 's|.*/pr-\([0-9]\+\)-[0-9a-f]*$|\1|p')
             if [ -z "$N" ]; then
@@ -164,6 +179,48 @@ jobs:
               echo "::error::could not resolve the head repository of queued PR #${N}"
               exit 1
             fi
+            if [ -n "$PERF_BELOW" ]; then
+              # The group's pull requests: one first-parent commit each between the
+              # base branch's tip and HEAD ("Merge pull request #N from ..." or a
+              # squash "... (#N)"). merge_group.base_sha will not do: it is the
+              # previous entry's head, so the range would hold this entry alone.
+              # Only first parents: a merged branch's own commits (cherry-picks)
+              # name other pull requests. A subject can match both forms (a squashed
+              # title that starts "Merge pull request #M", or a merged branch named
+              # "x(#M)"), and either number may be the one a fork wrote: every
+              # number it names is checked, so a spoof can only skip the gate.
+              base=${QUEUE_BASE_REF#refs/heads/}
+              merged='^Merge pull request #([0-9]+) '
+              squashed='\(#([0-9]+)\)$'
+              prs=""
+              if git fetch --no-tags --quiet origin "$base" \
+                && subjects=$(git log --first-parent --format=%s "origin/$base..HEAD"); then
+                while IFS= read -r subject; do
+                  named=""
+                  if [[ $subject =~ $merged ]]; then named="${BASH_REMATCH[1]}"; fi
+                  if [[ $subject =~ $squashed ]]; then named="$named ${BASH_REMATCH[1]}"; fi
+                  if [ -n "$named" ]; then
+                    prs="$prs $named"
+                  else
+                    not_ours="$not_ours (a commit naming no pull request: ${subject:0:60})"
+                  fi
+                done <<< "$subjects"
+              else
+                not_ours=" (the group's commits could not be listed)"
+              fi
+              for pr in $prs; do
+                repo=$(gh api "/repos/${GITHUB_REPOSITORY}/pulls/${pr}" --jq '.head.repo.full_name // empty') || repo=""
+                [ "$repo" = "$GITHUB_REPOSITORY" ] || not_ours="$not_ours #$pr"
+              done
+            fi
+          fi
+          if [ "$PR_HEAD_REPO" = "$GITHUB_REPOSITORY" ] && [ -z "$not_ours" ]; then
+            echo "same_repo=true" >> "$GITHUB_OUTPUT"
+          else
+            echo "same_repo=false" >> "$GITHUB_OUTPUT"
+            if [ -n "$PERF_BELOW" ]; then
+              echo "::warning::The release gate (perf, perf-cov) does not run: not every pull request in this merge group is known to come from this repository:${not_ours:- #${N:-?}}. A maintainer takes a fork's branch over to have the gate run."
+            fi
           fi
           if [ "$PR_HEAD_REPO" = "$GITHUB_REPOSITORY" ]; then
             echo "same-repository change; infrastructure paths are allowed"
@@ -499,9 +556,13 @@ jobs:
   # (@main) and carries only these jobs and ci-gate's rule. An infrastructur
```

**File**: `bench/src/falkorbench/fuzz/checks.py` (modified, +15/-6)
```diff
@@ -58,6 +58,7 @@
     "constraint_error",
     "events_died",
     "bgsave_error",
+    "bgsave_stuck",
     "violation_odd_error",
     "indexes_stuck",
     "events_stuck",
@@ -143,11 +144,14 @@ def add(self, g, keys, oc):
             else:
                 bucket[g][k[0]].add((k[1], k[2]))
 
-    def check(self, r) -> list[tuple[str, str]]:
+    def check(self, r, problems=None) -> list[tuple[str, str]]:
+        """(kind, message) per problem, appended to `problems` as found: the caller's list
+        keeps them when a later query raises."""
+
         def one(q):
             return r.execute_command("GRAPH.RO_QUERY", graph, q)[1][0][0]
 
-        problems = []
+        problems = [] if problems is None else problems
         for g, n in enumerate(self.n0):
             graph = gname(g)
             for label in model.UPSERT_LABELS:
@@ -444,20 +448,25 @@ def wait_bound(g, send, reply):
     by_kind = collections.defaultdict(list)
     for kind, msg in ledger_problems:
         by_kind[kind].append(msg)
-    # "harness": the end-of-epoch queries themselves failed, so nothing was counted (pass None)
+    # "harness": the end-of-epoch queries failed part way, so what was not counted is unknown
+    # (pass None); a problem counted before the failure still fails its check
     unknown = by_kind["harness"]
+
+    def counted(found):
+        return False if found else (None if unknown else True)
+
     # a duplicated key is wrong whether or not a constraint is installed, so it counts here in every epoch
     checks["writes_add_up"] = {
-        "pass": None if unknown else not (by_kind["count"] or by_kind["duplicate"]),
+        "pass": counted(by_kind["count"] or by_kind["duplicate"]),
         "problems": by_kind["count"] + by_kind["duplicate"] + unknown,
     }
     checks["upsert_edges_complete"] = {
-        "pass": None if unknown else not by_kind["missing"],
+        "pass": counted(by_kind["missing"]),
         "problems": by_kind["missing"] + unknown,
     }
     wto = sum(1 for w in writes if w[5] == 1)
     checks["timed_out_writes_leave_nothing"] = {
-        "pass": None if unknown else not by_kind["timed-out"],
+        "pass": counted(by_kind["timed-out"]),
         "applies": ep["write_timeout_ms"] > 0,
         "timed_out_writes": wto,
         "problems": by_kind["timed-out"],
```

**File**: `bench/src/falkorbench/fuzz/harness.py` (modified, +61/-30)
```diff
@@ -919,22 +919,7 @@ def ev(kind, **kw):
                                 ev("violation_odd_error", graph=g, msg=str(e)[:200])
             elif kind == "bgsave":
                 try:
-                    r.execute_command("BGSAVE")
-                    t0 = now()
-                    info = {}
-                    while now() - t0 < 300:
-                        info = r.info("persistence")
-                        if not info.get("rdb_bgsave_in_progress") or stop.wait(0.5):
-                            break
-                    status = info.get("rdb_last_bgsave_status")
-                    if status == "ok":
-                        ev("bgsave_done", seconds=round(now() - t0, 1), status=status)
-                    else:  # a failed save is a persistence failure, not a completion
-                        ev(
-                            "bgsave_error",
-                            msg=f"rdb_last_bgsave_status={status}"[:200],
-                            seconds=round(now() - t0, 1),
-                        )
+                    bgsave(r, stop, ev)
                 except Exception as e:
                     ev("bgsave_error", msg=str(e)[:200])
     except Exception as e:
@@ -943,6 +928,39 @@ def ev(kind, **kw):
         r.close()
 
 
+def bgsave(r, stop, ev):
+    """BGSAVE, then wait for it to end (at most 300 s, or until the epoch stops). A save still
+    running when the wait ends has no status of its own (rdb_last_bgsave_status is still the
+    previous save's): one the epoch's end cut short is bgsave_unfinished, which the harness
+    caused; one still saving after 300 s is bgsave_stuck, a failed event."""
+    r.execute_command("BGSAVE")
+    t0 = now()
+    info = {}
+    stopped = False  # the epoch's end, not the 300 s limit, ended the wait
+    while now() - t0 < 300:
+        info = r.info("persistence")
+        if not info.get("rdb_bgsave_in_progress"):
+            break
+        if stop.wait(0.5):
+            stopped = True
+            break
+    if info.get("rdb_bgsave_in_progress"):
+        if stopped:
+            ev("bgsave_unfinished", seconds=round(now() - t0, 1), why="the epoch ended")
+        else:
+            ev("bgsave_stuck", seconds=round(now() - t0, 1), why="still saving after 300 s")
+        return
+    status = info.get("rdb_last_bgsave_status")
+    if status == "ok":
+        ev("bgsave_done", seconds=round(now() - t0, 1), status=status)
+    else:  # a failed save is a persistence failure, not a completion
+        ev(
+            "bgsave_error",
+            msg=f"rdb_last_bgsave_status={status}"[:200],
+            seconds=round(now() - t0, 1),
+        )
+
+
 def end_of_epoch_cleanup(r, ep, ng, notes):
     for g in range(ng):
         if ep["constraints"]:
@@ -978,11 +996,12 @@ def probed_indexes(r, g) -> list[tuple[str, str]]:
     return out
 
 
-def index_vs_scan(r, ng, sizes, seed) -> list[str]:
+def index_vs_scan(r, ng, sizes, seed, problems=None) -> list[str]:
     """Index lookups against scans on the indexes each graph holds. A graph with none to probe
-    raises: a scan agreeing with a scan is no evidence, so the comparison is unmeasured."""
+    raises: a scan agreeing with a scan is no evidence, so the comparison is unmeasured. The
+    mismatches go to `problems` (the caller's list keeps those found before a raise)."""
     rng = random.Random(f"{seed}-ivs")
-    problems = []
+    problems = [] if problems is None else problems
     for g in range(ng):
         probes = probed_indexes(r, g)
         if not probes:
@@ -1220,11 +1239,7 @@ def run_epoch(
             "hang": hung,
         }
         if ledger.incomplete:
-            for k in ("writes_add_up", "upsert_edges_complete", "timed_out_writes_leave_nothing"):
-                an["checks"][k] = {
-                    "pass": None,
-                    "skipped": "a driver result file was lost earlier on this server",
-                }
+            counts_unknown(an["checks"])
         an["checks"]["index_matches_scan"] = index_check(ep, ivs)
         result.update(an)
         result["notes"] = notes
@@ -1261,6 +1276,18 @@ def schema_left(r, ng) -> dict:
     return left
 
 
+def counts_unknown(checks_: dict) -> None:
+    """After a driver result file was lost the ledger cannot predict the counts: its checks
+    are not measured, except one that failed anyway (a duplicated key is wrong whatever was
+    lost), which stands."""
+    for k in ("writes_add_up", "upsert_edges_complete", "timed_out_writes_leave_nothing"):
+        if checks_[k].get("pass") is not False:
+            checks_[k] = {
+                "pass": None,
+                "skipped": "a driver result file was lost earlier on this server",
+            }
+
+
 def index_check(ep, ivs) -> dict:
     """index_matches_scan from index_vs_scan's problems; None (the comparison failed) is unmeasured."""
     return {
@@ -1279,17 +1306,21 @@ def end_of_epoch(r, ep, ng, sizes, ledger, events, t_start) -> dict:
     try:
   
```

**File**: `bench/src/falkorbench/soak/campaign.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+ "label": "20f9a45ee",
+ "previous": "d070f1f9b",
+ "c_baseline": "C v4.22.4",
+ "environment": "Rust 20 min and C 5 min per scenario, one at a time, full scale · Redis 8.6.2 · Apple M-series, 11 cores, 36 GB",
+ "notes": {
+  "written_for": "d070f1f9b",
+  "html": "Re-soaked on d070f1f9b, main after 19 more PRs incl. #3511, #3578, #3856, #3035, #3469 (was 77ab63f48). Outside the blocked areas, Rust is production-grade: no crash, panic or hang in 12 full-scale soaks, and the C baseline, <b>release v4.22.4</b>, did not crash either (the earlier local July master build crashed twice, in s03 and s11; both are gone in the release). Against v4.22.4, C still has 5 open problems of its own (C4–C7, C10). Snapshot isolation, durability across 8 kill/restart cycles, replication, and multi-tenant churn were all exact.\n    <b>Re-soak on main d070f1f9b</b> (compared with 77ab63f48), all 12 scenarios on a quiet machine; runs that overlapped outside load above 20 were discarded and repeated. No finding changed state: <b>F3</b> (range index loses numeric 0: s03, s10), <b>F9</b> (index built under writes loses entries: s10), <b>R1</b> (s12 still at ~0.45× C write throughput; fix PR #3889 still open) and <b>F10</b> (#3886, upstream HNSW, C too) still block; <b>F7</b> is unchanged by #3511 (s05 keeps 210 MB of used_memory after every graph is deleted). The s03 late ingest stall seen on 77ab63f48 did not recur (ingest p99 22 → 29 ms early to late), so s03 recovers 53.5 → 58.6. <b>Watch: p99 of light operations rose 1.25–2× in s05, s08 and s09</b> (e.g. replica 1-hop read 2.2 → 4.3 ms, ledger write 2.7 → 5.0 ms, durability lookups 6 → 8.6 ms), taking p99 vs C to 2.1× in s05, 1.72× in s09 and 1.1× in s08; this is unconfirmed (single runs) and needs an A/B of 77ab63f48 vs d070f1f9b, with #3469 (GraphBLAS 10.5.3) and #3578 (write retry) the first suspects. An s05 run on d070f1f9b lost its server to an external SIGKILL with no crash log; the repeat ran clean. Caveats: the C baseline (release v4.22.4) is built without OpenMP, so vs-C performance ratios favour Rust; after a /tmp cleanup on 2026-11-23 the scenario scripts were rebuilt from transcripts (s06 verified byte-identical to the surviving original)."
+ },
+ "caveats": "One macOS machine, shared at times with other jobs, so absolute latencies are indicative and the Rust/C ratios are the signal. The C baseline is release v4.22.4 (falkordb-macos-arm64v8.so from the GitHub release, module ver 42204) for all 12 scenarios; the earlier runs on a local July master build are kept as @jul-master. C runs are 5 min, so slow drift is only measured on Rust."
+}
```

**File**: `bench/src/falkorbench/soak/gen_final.py` (modified, +99/-28)
```diff
@@ -1,5 +1,10 @@
 """Build the final soak report (report.html) from full/ results, findings.json and scores.json.
-usage: python -I gen_final.py"""
+usage: python -I gen_final.py
+
+The gate line, the tiles and each scenario's labels come from scores.json and the runs it
+scored. What a person wrote about one campaign (its label, the campaign it is compared
+with, the machine, notes and caveats) lives in campaign.json beside this script, and the
+report shows the notes as written for that campaign."""
 import csv
 import html
 import json
@@ -44,8 +49,29 @@ def cdir(scn):
     return sw if (sw / ".done").exists() else FULL / f"{scn}-c"
 
 
-def edir(scn, eng):
-    return cdir(scn) if eng == "c" else FULL / f"{scn}-{eng}"
+def run_dirs(scn, sc):
+    """The Rust and C run directories score.py scored for this scenario (its `run` and
+    `c_run`; c_run None: no C baseline), or the current ones when it has not scored it."""
+    rust = FULL / sc["run"] if sc.get("run") else FULL / f"{scn}-rust"
+    if "c_run" in sc:
+        return {"rust": rust, "c": FULL / sc["c_run"] if sc["c_run"] else None}
+    return {"rust": rust, "c": cdir(scn)}
+
+
+def campaign():
+    """campaign.json: label (run_rust_main.sh's <commit-label>), previous (compared through
+    full/scores-<previous>.json), c_baseline, environment, notes {written_for, html},
+    caveats. Without a label: the one most current Rust runs carry."""
+    c = jl(S / "campaign.json") or {}
+    if not c.get("label"):
+        labels = [(FULL / f"{scn}-rust" / ".commit").read_text().strip() for scn, *_ in SCN
+                  if (FULL / f"{scn}-rust" / ".commit").exists()]
+        c["label"] = max(set(labels), key=labels.count) if labels else None
+    return c
+
+
+def label_of(d):
+    return (d / ".commit").read_text().strip() if (d / ".commit").exists() else None
 
 
 def fmt(v, nd=1, unit=""):
@@ -125,35 +151,50 @@ def main_op(summ):
 
 # ------------------------------------------------------------- build
 def build():
-    subprocess.run([PY, "-I", str(S / "score.py"), str(FULL)], capture_output=True, timeout=300)
-    scores = jl(FULL / "scores.json") or {"scenarios": {}}
-    prev = jl(FULL / "scores-d070f1f9b.json") or {"scenarios": {}}
-    rerun = {scn: (FULL / f"{scn}-rust" / ".commit").read_text().strip() for scn, *_ in SCN
-             if (FULL / f"{scn}-rust" / ".commit").exists()}
+    scoring = subprocess.run([PY, "-I", str(S / "score.py"), str(FULL)], capture_output=True, text=True,
+                             timeout=300)
+    # a score.py that failed left the previous scores.json (if any): none of it is this run's
+    scores = (jl(FULL / "scores.json") if scoring.returncode == 0 else None) or {"scenarios": {}}
+    camp = campaign()
+    label, previous = camp.get("label"), camp.get("previous")
+    prev = (jl(FULL / f"scores-{previous}.json") if previous else None) or {"scenarios": {}}
+    crashes = {"rust": 0, "c": 0}  # scenarios whose server log has crash markers
     findings = jl(S / "findings.json") or []
     charts = []
     rows_score, cards = [], []
     for scn, title, what, size in SCN:
         sc = scores["scenarios"].get(scn, {})
-        sm = {e: jl(edir(scn, e) / "summary.json") for e, _, _ in ENG}
+        dirs = run_dirs(scn, sc)
+        sm = {e: jl(dirs[e] / "summary.json") if dirs[e] else None for e, _, _ in ENG}
+        crashes["rust"] += bool((sm["rust"] or {}).get("server_log_crash_markers"))
+        # a C run that crashed is no baseline (score.py drops it), but it still crashed: count
+        # this campaign's C run as well as the one the scores compare with
+        c_runs = (sm["c"], jl(cdir(scn) / "summary.json"))
+        crashes["c"] += any((c or {}).get("server_log_crash_markers") for c in c_runs)
         r = sm["rust"] or {}
         mon_r, mon_c = r.get("monitor", {}), (sm["c"] or {}).get("monitor", {})
         crit = len(sc.get("critical_failures", []))
         maj = len(sc.get("major_failures", []))
-        pill = ('<span class="pill crit">BLOCKER</span>' if crit else
+        pill = ('<span class="pill crit">BLOCKER</span>' if crit or scn in scores.get("failed_runs", {}) else
                 '<span class="pill maj">PASS w/ issues</span>' if maj else '<span class="pill ok">PASS</span>')
+        on = label_of(dirs["rust"])
+        was = prev["scenarios"].get(scn, {}).get("total")
+        if on and on == label:
+            sub = f"on {on}" + (f" · was {fmt(was, 1)} on {previous}" if previous and was is not None else "")
+        else:
+            sub = f"on {on or '?'}" + (f" · {label} re-run pending" if label else "")
         rows_score.append(
             f"<tr><td><b>{title}</b><div class='sub'>{esc(size)}</div></td><td class='num big'>{fmt(sc.get('total'), 1)}"
-            f"<div class='sub'>{('on ' + rerun[scn] + ' · was ' + fmt(prev['scenarios'].get(scn, {}).get('total'), 1) + ' on d070f1f9b') if rerun.get(scn) == '20f9a45ee' else ('on ' + rerun.get(scn, '?') + ' · main 2
```

**File**: `bench/src/falkorbench/soak/process_group.sh` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# Sourced by the release-soak run scripts (bash): run one scenario in a process group of
+# its own, and afterwards kill what is left of that group. A local-module scenario starts
+# its redis-servers as children (soakkit.Server), so they share the scenario's group, and
+# a server that outlives its scenario (a crash, a timeout) is killed with the group. A
+# server this run did not start (another soak, a developer's redis) is never touched, even
+# on the same ports: soakkit refuses to start on a port that already answers.
+#
+# usage: run_in_group <command> [args...]    returns the command's exit status
+#        refuse_busy_ports <port>...            at start: 1 (and why) if one already answers
+#        fresh_run_dir <dir>                    an empty run directory to start an attempt in
+#
+# SOAK_GROUP_FILE, when the script sets it, holds the running scenario's group id, so a
+# script that was itself SIGKILLed (no trap runs) leaves a way to stop what it started.
+
+SOAK_GROUP=
+SOAK_GROUP_FILE=${SOAK_GROUP_FILE:-}
+
+reap_group() {
+  [ -n "$SOAK_GROUP" ] || return 0
+  kill -9 -- "-$SOAK_GROUP" 2>/dev/null
+  # SIGKILL is asynchronous: wait (at most 10 s) until the group is gone, so the next
+  # scenario finds its ports free
+  local waited=0
+  while kill -0 -- "-$SOAK_GROUP" 2>/dev/null && [ $waited -lt 100 ]; do
+    sleep 0.1
+    waited=$((waited + 1))
+  done
+  SOAK_GROUP=
+  [ -z "$SOAK_GROUP_FILE" ] || rm -f "$SOAK_GROUP_FILE"
+}
+
+# A server already answering on a scenario's port is another soak's, a developer's, or
+# one an earlier run left when it was SIGKILLed. None is this run's to stop, and every
+# scenario would fail on it (soakkit refuses a port that answers) and be marked done:
+# refuse to start instead.
+refuse_busy_ports() {
+  local port busy=
+  for port in "$@"; do
+    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then busy="$busy $port"; fi
+  done
+  [ -z "$busy" ] && return 0
+  echo "a server already answers on port(s)$busy; stop it first" >&2
+  if [ -n "$SOAK_GROUP_FILE" ] && [ -s "$SOAK_GROUP_FILE" ]; then
+    echo "an earlier run's scenario may still run: kill -9 -- -$(cat "$SOAK_GROUP_FILE")" >&2
+  fi
+  return 1
+}
+
+# The scenario's group does not get the terminal's Ctrl-C, so the script reaps it on the
+# way out, whatever ends it.
+trap reap_group EXIT
+trap 'reap_group; exit 130' INT
+trap 'reap_group; exit 143' TERM
+
+# A run directory still there after the scripts archived what they keep (its archive name
+# was taken, or it holds an unfinished run) is moved aside, never reused: a run that fails
+# before it writes its own summary.json would be scored on the old one. The name has no
+# "@", so the scorer never takes it for an archive.
+fresh_run_dir() {
+  if [ -e "$1" ]; then
+    mv "$1" "$1-superseded-$(date +%Y%m%dT%H%M%S)-$$" || return 1
+  fi
+  mkdir "$1"
+}
+
+run_in_group() {
+  # with job control on, a background job leads a process group of its own (pgid = pid);
+  # GNU timeout keeps that group for its command
+  set -m
+  "$@" &
+  SOAK_GROUP=$!
+  set +m
+  [ -z "$SOAK_GROUP_FILE" ] || echo "$SOAK_GROUP" > "$SOAK_GROUP_FILE"
+  wait "$SOAK_GROUP"
+  local rc=$?
+  reap_group
+  return $rc
+}
```

---

### Incident Patch 3: `3bba59f2` (2026-11-26)
**Commit Message**: fix: an Aggregate emits and evaluates only its own scope's slot ids (#3375, #3571, #3333, #3372) (#3579)

* fix: an Aggregate emits and evaluates only the ids of its own scope (#3375, #3571, #3333, #3372)

The binder numbers each scope from zero and Row is keyed by slot id, so
AggregateOp mixed two scopes in one row: it wrote aggregation outputs and
new-scope keys into the row the aggregation trees (bound to the old scope,
accumulators included) were evaluated against, and it emitted old-scope
accumulator/pre-projection key ids to downstream operators. Colliding ids
gave wrong sums and an avg panic (#3375), a key read as an old variable
(#3571), and stale bound slots that turned the next MATCH into an
expand-into (#3333, #3372).

Evaluate against old-scope bindings only, emit new-scope bindings only.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: drop #3579's removed unbind_agg_accumulators row; aggregate next to NOT COVERED

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* proofs: record which aggregate next theorems are stale

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix: evaluate a mixed aggregation item with its implicit grouping keys

In an it

**File**: `graph/src/parser/ast.rs` (modified, +14/-0)
```diff
@@ -430,6 +430,20 @@ pub struct ShortestPathInfo {
 }
 
 impl<TVar: VarKind + Clone> ExprIR<TVar> {
+    /// The loop variables this node binds for its children: a list
+    /// comprehension's or quantifier's element, `reduce`'s accumulator and
+    /// element; none for any other node. They are in scope from the returned
+    /// child index on: the list, and `reduce`'s initial value, are evaluated
+    /// outside them.
+    pub fn loop_vars(&self) -> (impl Iterator<Item = &TVar>, usize) {
+        let (vars, first_scoped) = match self {
+            Self::ListComprehension(var) | Self::Quantifier { var, .. } => ([Some(var), None], 1),
+            Self::Reduce(vars) => ([Some(&vars.accumulator), Some(&vars.iterator)], 2),
+            _ => ([None, None], usize::MAX),
+        };
+        (vars.into_iter().flatten(), first_scoped)
+    }
+
     /// `a AND b AND …` over `conjuncts`, kept flat.
     ///
     /// AND is associative, so an operand that is itself an AND contributes
```

**File**: `graph/src/planner/mod.rs` (modified, +13/-10)
```diff
@@ -1341,15 +1341,8 @@ impl Planner {
                 let child_mode = mode.descend(node.data());
                 // The loop variables this node binds, and the child from
                 // which on they are in scope (the list itself is not).
-                let (bound, first_scoped): (Vec<Variable>, usize) = match node.data() {
-                    ExprIR::ListComprehension(var) | ExprIR::Quantifier { var, .. } => {
-                        (vec![var.clone()], 1)
-                    }
-                    ExprIR::Reduce(vars) => {
-                        (vec![vars.accumulator.clone(), vars.iterator.clone()], 2)
-                    }
-                    _ => (vec![], usize::MAX),
-                };
+                let (bound, first_scoped) = node.data().loop_vars();
+                let bound: Vec<Variable> = bound.cloned().collect();
                 let mut new_tree = DynTree::new(node.data().clone());
                 for (i, child) in node.children().enumerate() {
                     let outer_len = self.loop_vars.len();
@@ -2836,7 +2829,17 @@ impl Planner {
                 res.node_mut(insert_idx).push_child_tree(chain);
             }
         }
-        if distinct && !matches!(res.root().data(), IR::Aggregate { .. }) {
+        // An Aggregate emits one row per group, so its rows are already
+        // distinct, unless an item mixing an aggregate with other terms
+        // (`count(*) > x`) adds hidden grouping keys: two groups can then
+        // project the same row.
+        let rows_distinct = match res.root().data() {
+            IR::Aggregate { aggregations, .. } => aggregations.iter().all(|(_, expr)| {
+                matches!(expr.root().data(), ExprIR::FuncInvocation(func) if func.is_aggregate())
+            }),
+            _ => false,
+        };
+        if distinct && !rows_distinct {
             res = tree!(IR::Distinct, res);
         }
         if !orderby.is_empty() {
```

**File**: `graph/src/runtime/ops/aggregate.rs` (modified, +368/-89)
```diff
@@ -34,18 +34,19 @@ use crate::planner::IR;
 use crate::runtime::eval::ExprEval;
 use crate::runtime::{
     batch::{BATCH_SIZE, Batch, BatchBuilder, BatchOp, BatchRow},
-    functions::{FnType, GraphFn},
+    functions::{FnType, GraphFn, Type},
     row::{Row, RowView},
     runtime::Runtime,
     value::{Value, ValuesDeduper},
     vector_expr::VectorEval,
 };
 use ahash::RandomState;
 use arcstr::ArcStr;
-use orx_tree::{Dyn, DynNode, DynTree, NodeIdx, NodeRef};
+use orx_tree::{Dfs, Dyn, DynNode, DynTree, NodeIdx, NodeRef};
 use smallvec::SmallVec;
 use std::cmp::Ordering;
 use std::collections::HashMap;
+use std::collections::hash_map::Entry;
 use std::hash::{Hash, Hasher};
 use std::sync::Arc;
 use thin_vec::ThinVec;
@@ -180,12 +181,273 @@ enum AggInputKind {
 /// Such an input cannot be materialised as a column: the inner aggregate needs
 /// the per-row path's group-aware evaluation, so those trees keep falling back.
 fn subtree_has_aggregate(node: &DynNode<'_, ExprIR<Variable>>) -> bool {
-    if let ExprIR::FuncInvocation(func) = node.data()
-        && func.is_aggregate()
-    {
-        return true;
+    node.walk::<Dfs>()
+        .any(|expr| matches!(expr, ExprIR::FuncInvocation(func) if func.is_aggregate()))
+}
+
+/// One implicit grouping key: an aggregate-free subtree of an aggregation item.
+struct ImplicitKey {
+    /// The aggregation item the subtree belongs to.
+    item: usize,
+    /// The subtree's root in that item's tree.
+    idx: NodeIdx<Dyn<ExprIR<Variable>>>,
+    /// The value evaluated when the group's first row is grouped is kept in
+    /// the group under `slot`, and the item reads it from there, so a volatile
+    /// subtree (`rand()`) reports the value it grouped by, not a fresh draw.
+    slot: Variable,
+    /// `Some(ok)` for a guarded subtree, one a `CASE`, `AND`, `OR`, map
+    /// projection or loop body may skip: it must not be able to fail the
+    /// query at grouping. An error groups as `null` and leaves `slot` unset,
+    /// and `ok` records whether the value was evaluated. The item reads
+    /// `CASE WHEN ok THEN slot ELSE <subtree> END`, so when the branch is
+    /// taken after an error the subtree runs again from the group's first row
+    /// (see [`ImplicitKeys::lazy_vars`]) and raises it.
+    ok: Option<Variable>,
+}
+
+/// The implicit grouping keys of an aggregation and what finalizing them needs.
+#[derive(Default)]
+struct ImplicitKeys {
+    keys: Vec<ImplicitKey>,
+    /// The variables the guarded keys read. Each group keeps their values
+    /// from its first row, under their (old-scope) ids, so a guarded key that
+    /// failed at grouping can be evaluated again when the group is finalized.
+    lazy_vars: Vec<Variable>,
+    /// The aggregation items with each key replaced by a read of its slot;
+    /// `None` when there are no keys.
+    items: Option<Vec<(Variable, QueryExpr<Variable>)>>,
+}
+
+/// The highest variable id the tree reads or binds: a comprehension's,
+/// quantifier's or `reduce`'s own variables take row slots while it is
+/// evaluated, so a fresh slot must not reuse one either.
+fn max_variable_id(node: &DynNode<'_, ExprIR<Variable>>) -> u32 {
+    node.walk::<Dfs>()
+        .flat_map(|expr| {
+            let read = match expr {
+                ExprIR::Variable(var) => Some(var),
+                _ => None,
+            };
+            read.into_iter().chain(expr.loop_vars().0)
+        })
+        .map(|var| var.id)
+        .max()
+        .unwrap_or(0)
+}
+
+/// The variables `node` reads from the row, each once: those its own list
+/// comprehensions, quantifiers and `reduce`s bind (`v` in `[v IN [1] | v]`)
+/// are left out. The binder gives every loop variable a fresh id, read only
+/// inside the node that binds it, so leaving out every id bound anywhere in
+/// the subtree drops exactly those.
+fn free_variables(node: &DynNode<'_, ExprIR<Variable>>) -> Vec<Variable> {
+    let bound: Vec<&Variable> = node
+        .walk::<Dfs>()
+        .flat_map(|expr| expr.loop_vars().0)
+        .collect();
+    let mut read: Vec<Variable> = Vec::new();
+    for expr in node.walk::<Dfs>() {
+        if let ExprIR::Variable(var) = expr
+            && !bound.contains(&var)
+            && !read.contains(var)
+        {
+            read.push(var.clone());
+        }
+    }
+    read
+}
+
+/// A copy of `tree` with each key's subtree replaced by a read of its slot
+/// (see [`ImplicitKey::ok`] for a guarded key's).
+///
+/// Built in one pre-order pass that only pushes nodes: each node goes under
+/// its parent's copy, a key's node is replaced by its read, and the nodes
+/// inside a key have no parent copy, so they are left out.
+fn replace_with_slots(
+    tree: &DynTree<ExprIR<Variable>>,
+    keys: &[&ImplicitKey],
+) -> DynTree<ExprIR<Variable>> {
+    // The root holds an aggregate, so it is never a key.
+    let mut copy = DynTree::new(tree.root().data().clone());
+    let mut copied = HashMap::from([(tree.root(
```

**File**: `proofs/FINDINGS.md` (modified, +0/-3)
```diff
@@ -64,9 +64,6 @@ A bug is **confirmed** only if a repro against the real Rust shows it, and it is
 - #2738 (rt/apply): a writing CALL subquery is batched (can_batch admits Create/Delete/Set/Commit), so later outer rows do not see earlier rows' writes; Rust count 3 / 4 nodes vs C 7 / 8. Lean RowWrites.bug2738_batched_call_hides_writes; property RowWrites.WriteSeparable. Fix pending in #2968 (open).
 - Model note, #3368 / #3369 (rt; model only, not yet run live): equal leftovers in two rows of the SAME MERGE still share one `merge_pattern_cache` entry (`MergeSlot.same_op_leftover_shares_entry`).
 - **W2-pending-3** (SET/REMOVE): writes to a deleted relationship are applied and counted (`ops/remove.rs`; `ops/set.rs:85` `has_pending_deleted_rels` misses a DETACH cascade). Confirmed live on 256ab4d3f: on `(:N)-[r:R {x:0}]->(:N)`, `MATCH (a:N)-[r:R]->(b) DETACH DELETE a SET r.x = 1` → Rust `Properties set: 1`, C none; on `{v:0}`, `MATCH ()-[r:R]->() DELETE r REMOVE r.v` → Rust `Properties removed: 1`, C none (`DELETE r SET r.v = 5` is right in both).
-- #3333 (aggregate/binder ids): the pre-projection alias of m (id 2) stays bound on the Aggregate output and the next MATCH gives b id 2, so b starts bound to m and the query returns []. Lean bug3333_alias_binds_next_var; property EmitsOnlyScope. Fix pending in #3579 (open).
-- #3372 (rt/aggregate→traverse): Aggregate re-binds a grouping key at its slot from the previous scope (aggregate.rs:1187-1196), and the binder restarts slot ids at 0 in each scope (binder.rs:2261). A fresh variable in the next MATCH that gets the same slot is read by CondTraverse as already bound to that node (cond_traverse.rs:648-652,771-777), so `WITH c, count(*) AS k MATCH (c)-[:E]->(d)` returns 0 instead of 4. Lean bug3372_slot_reuse_drops_rows; property ScopedRow. Fix pending in #3579 (open).
-- #3375 (aggregate/binder ids): count(x)'s output id equals sum(x)'s accumulator id and is written into `combined` first, so sum returns the count (3 vs 6) and avg panics in finalize_avg. Lean bug3375_output_overwrites_next_acc, bug3375_avg_panics; property OutputsOwnAcc. Fix pending in #3579 (open).
 
 ## UDFs, procedures & algorithms
 
```

**File**: `proofs/ops_aggregate/COVERAGE.tsv` (modified, +21/-17)
```diff
@@ -1,21 +1,20 @@
 file	function	line	bucket	lean_name_or_reason
-graph/src/runtime/ops/aggregate.rs	eq	100	PROVEN	gkEq (veq = sort_cmp == Equal since #2917): gkEq_iff, Discharge.gkEq_spec (= GroupKey::eq on main), Discharge.veqMain_equiv (an equivalence on main)
-graph/src/runtime/ops/aggregate.rs	hash	116	PROVEN	gkHash: gkHash_consistent with hc discharged on main: Discharge.hc_main, Discharge.gk_hash_consistent_main (from proofs/value_order Main.main_hash_consistent)
-graph/src/runtime/ops/aggregate.rs	subtree_has_aggregate	182	PROVEN	hasAgg: hasAgg_spec, hasAgg_iff
-graph/src/runtime/ops/aggregate.rs	args_for	223	PROVEN	argsFor: argsFor_spec
-graph/src/runtime/ops/aggregate.rs	fold	244	PROVEN	rowDriver_eq_batch (fold = batch_fn on a 1-slice)
-graph/src/runtime/ops/aggregate.rs	new	295	PROVEN	AggSt.new: aggNew_spec, foldlM_setZero
-graph/src/runtime/ops/aggregate.rs	analyze	328	PROVEN	analyze/analyzeKey: analyze_spec, analyze_lengths, analyzeKey_spec
-graph/src/runtime/ops/aggregate.rs	analyze_agg_tree	397	PROVEN	analyzeAgg/aggBody: analyzeAgg_shape, aggBody_fields, singleArg_computed, multiArg_computed, distinctInput_computed, countStar_no_input, multi_extra, constsOf_spec
-graph/src/runtime/ops/aggregate.rs	consume_input_vectorized	524	PROVEN	batchDriver_eq_join, vectorized_eq_rowwise, *_hom; group id = insertion index (#2977): GroupId.insert_new_id, gid_inj, distinct_by_group_id_exact (fixed by #2977 c652e505e)
-graph/src/runtime/ops/aggregate.rs	extract_key_columns	795	PROVEN	extractKeys/keyCol: extractKeys_spec, extractKeys_err
-graph/src/runtime/ops/aggregate.rs	extract_agg_input_columns	844	PROVEN	extractAggs/aggCol: extractAggs_spec
-graph/src/runtime/ops/aggregate.rs	consume_input_per_row	885	PROVEN	groupAll_spec, keyless_one_row; group id from the map entry (#2977): GroupId.gid_inj, distinct_by_group_id_exact (groups never share a seen-set; value-hash collisions inside a group are the residual dedup_collision_drops)
-graph/src/runtime/ops/aggregate.rs	consume_batch_per_row	929	PROVEN	groupAll_spec, rowDriver_eq_batch; group id from the map entry (#2977): GroupId.gid_inj, distinct_by_group_id_exact (groups never share a seen-set; value-hash collisions inside a group are the residual dedup_collision_drops)
-graph/src/runtime/ops/aggregate.rs	run_agg_expr	999	PROVEN	rowDriver_eq_batch; DISTINCT branch keyed (node, group id) since #2977: GroupId.distinct_by_group_id_exact, fixed2977_collision_example; distinct_fold_clear_overcounts (BUG #2779, apply.rs:283)
-graph/src/runtime/ops/aggregate.rs	set_agg_expr_zero	1100	PROVEN	setZero: setZero_eq, setZero_spec
-graph/src/runtime/ops/aggregate.rs	next	1129	PROVEN	aggNext/finishGroup (GroupMap value is a 3-tuple since #2977; the id is ignored at emit) (unbind before keys since #3522, aggregate.rs:1192-1218): aggNext_error_first, aggNext_ok, drain_all, finishGroup_outputs, finishGroup_err, finishGroup_keys_bound/keysBound_main (KeysBound on main, fixed3522_null_key_bound, keysBound_swap_3522); keyed_empty, keyless_one_row; with binder ids (SlotReuse projLayout, finishCore/finishVals/cell) OutputsOwnAcc/EmitsOnlyScope are still refuted: bug3375_output_overwrites_next_acc, bug3375_avg_panics, bug3333_alias_binds_next_var, bug3369_count_acc_in_merge_slot, bug3368_count_acc_in_merge_slot (BUGs)
-graph/src/runtime/ops/aggregate.rs	unbind_agg_accumulators	1252	PROVEN	unbindAcc: unbindAcc_eq, unbind_after_zero, unbind_other, one_child_not_unbound; unbind runs before the keys are written since #3522, so an accumulator id equal to a null key's id no longer drops the key: fixed3522_null_key_bound
+graph/src/runtime/ops/aggregate.rs	eq	101	PROVEN	gkEq (veq = sort_cmp == Equal since #2917): gkEq_iff, Discharge.gkEq_spec (= GroupKey::eq on main), Discharge.veqMain_equiv (an equivalence on main)
+graph/src/runtime/ops/aggregate.rs	hash	117	PROVEN	gkHash: gkHash_consistent with hc discharged on main: Discharge.hc_main, Discharge.gk_hash_consistent_main (from proofs/value_order Main.main_hash_consistent)
+graph/src/runtime/ops/aggregate.rs	subtree_has_aggregate	183	PROVEN	hasAgg: hasAgg_spec, hasAgg_iff
+graph/src/runtime/ops/aggregate.rs	args_for	485	PROVEN	argsFor: argsFor_spec
+graph/src/runtime/ops/aggregate.rs	fold	506	PROVEN	rowDriver_eq_batch (fold = batch_fn on a 1-slice)
+graph/src/runtime/ops/aggregate.rs	new	559	PROVEN	AggSt.new: aggNew_spec, foldlM_setZero
+graph/src/runtime/ops/aggregate.rs	analyze	594	PROVEN	analyze/analyzeKey: analyze_spec, analyze_lengths, analyzeKey_spec; implicit-key guard (#3579): analyzeOp_implicit, analyzeOp_none
+graph/src/runtime/ops/aggregate.rs	analyze_agg_tree	667	PROVEN	analyzeAgg/aggBody: analyzeAgg_shape, aggBody_fields, singleArg_computed, multiArg_computed, distinctInput_computed, countStar_no_input, multi_extra, constsOf_spec
+graph/src/runtime/ops/aggregate.rs	consume_input_vectorized	794	PROVEN	batchDriver_eq_join, vectorized_eq_rowwise, *_hom; fallback gets no implicit keys since analyze refuses them (analyzeOp_implicit,
```

**File**: `proofs/ops_aggregate/FalkorAggOps/AggNext.lean` (modified, +127/-137)
```diff
@@ -102,12 +102,7 @@ theorem extractAggs_spec (evalC : Ex Z → Except String (List Z)) (active : Lis
 
 end Extract
 
-/-! ## Per-group output row (aggregate.rs) -/
-
-/-- `Row::merge`: every bound slot of `other` overwrites. -/
-def mergeE (self other : Env Z) : Env Z := fun j => match other j with
-  | some v => some v
-  | none => self j
+/-! ## Per-group output row (aggregate.rs, `AggregateOp::next`, since #3579) -/
 
 def updAll (env : Env Z) (l : List (Nat × Z)) : Env Z := l.foldl (fun a p => upd a p.1 p.2) env
 
@@ -116,70 +111,76 @@ structure KeySpec where
   name : Nat
   orig : Option Nat
 
-/-- `combined` (aggregate.rs): the key row, the pre-projection key aliases
-(`combined.insert(original_var, …)`), then every bound accumulator slot on top
-(`combined.merge(&acc)`). -/
-def combinedEnv (keys : List KeySpec) (key acc : Env Z) : Env Z :=
-  mergeE (keys.foldl (fun c k => match k.orig, key k.name with
+/-- `eval_env` (aggregate.rs since #3579): the group's accumulator row `acc` (accumulators, and
+the slots / first-row variables of the implicit grouping keys written when the group was
+created), then each grouping key that is a bare variable at its pre-projection id. It holds
+only ids of the scope *before* the projection: the key row `key` (new-scope ids) is not merged
+in, so a new-scope key at id `N` is never read as the old-scope variable `N` (#3571). -/
+def evalEnv (keys : List KeySpec) (key acc : Env Z) : Env Z :=
+  keys.foldl (fun c k => match k.orig, key k.name with
     | some o, some v => upd c o v
-    | _, _ => c) key) acc
-
-/-- The closure of `next` up to `acc.merge(&key)` (aggregate.rs): evaluate every
-aggregation over `combined`, writing each output into `acc` **and** `combined`
-(`acc.insert(name, …)`, `combined.insert(name, …)`, :1188-1189), then the pre-projection key
-aliases unless an output owns the slot (:1206-1216), then the key row (:1217). Returns that
-row and the outputs in order. Every slot of it is bound (`Row::insert` sets the bit). -/
-def finishCore {E : Type} (ev : Ex Z → Env Z → Except E Z) (keys : List KeySpec)
-    (aggs : List (Nat × Ex Z)) (key acc : Env Z) : Except E (Env Z × List (Nat × Z)) := do
-  -- evaluate every aggregation expression in order
-  let (acc1, _, outs) ← aggs.foldlM (fun (st : Env Z × Env Z × List (Nat × Z)) (p : Nat × Ex Z) => do
-      let val ← ev p.2 st.2.1
-      pure (upd st.1 p.1 val, upd st.2.1 p.1 val, st.2.2 ++ [(p.1, val)]))
-    (acc, combinedEnv keys key acc, [])
-  -- pre-projection key aliases, unless an aggregate output owns the slot
-  let acc2 := keys.foldl (fun a k => match k.orig, key k.name with
-    | some o, some v => if aggs.any (·.1 == o) then a else upd a o v
-    | _, _ => a) acc1
-  pure (mergeE acc2 key, outs)
-
-/-- Stage 1 of `finishCore` (aggregate.rs): evaluate every aggregation over `combined`,
-writing each output into `acc` and `combined`. Returns `acc` and the outputs in order. -/
+    | _, _ => c) acc
+
+/-- One item of the loop: its name and its value over `env`, or the evaluation error. -/
+def evalItem {E : Type} (ev : Ex Z → Env Z → Except E Z) (env : Env Z) (p : Nat × Ex Z) :
+    Except E (Nat × Z) :=
+  match ev p.2 env with
+  | .ok v => .ok (p.1, v)
+  | .error e => .error e
+
+/-- The evaluation loop of `next` (aggregate.rs since #3579): every item (the aggregations, or
+`implicit.items` with each implicit key replaced by `slot_read`: its slot, or for a guarded key
+`CASE WHEN ok THEN slot ELSE <subtree> END`) is evaluated
+over the same `eval_env`; nothing is written back between items (#3375). Returns the outputs
+in order, or the first error. -/
 def finishEval {E : Type} (ev : Ex Z → Env Z → Except E Z) (keys : List KeySpec)
-    (aggs : List (Nat × Ex Z)) (key acc : Env Z) : Except E (Env Z × List (Nat × Z)) := do
-  let (acc1, _, outs) ← aggs.foldlM (fun (st : Env Z × Env Z × List (Nat × Z)) (p : Nat × Ex Z) => do
-      let val ← ev p.2 st.2.1
-      pure (upd st.1 p.1 val, upd st.2.1 p.1 val, st.2.2 ++ [(p.1, val)]))
-    (acc, combinedEnv keys key acc, [])
-  pure (acc1, outs)
-
-/-- Stage 2 (aggregate.rs on main): the pre-projection key aliases unless an output owns
-the slot, then `acc.merge(&key)`. -/
-def finishTail (keys : List KeySpec) (aggs : List (Nat × Ex Z)) (key acc1 : Env Z) : Env Z :=
-  mergeE (keys.foldl (fun a k => match k.orig, key k.name with
-    | some o, some v => if aggs.any (·.1 == o) then a else upd a o v
-    | _, _ => a) acc1) key
-
-/-- The emitted row's **bound** slots on main (aggregate.rs since #3522): evaluate the
-aggregations (:1175-1191), unbind every accumulator FIRST (:1192-1201), then write the key aliases
-and the key row (:1202-1217), then re-bind the outputs last (:1218-1226). -/
+    (aggs : List (Nat × Ex Z)) (key acc : Env Z) : Except E (List (Nat × Z)) :=
+  aggs.mapM (evalItem ev (evalEnv keys key acc))
+
+/-- The emitted row (aggregate.rs since #3579): `out = key` (the projected keys and the
+`copy_from_parent` copies), then every out
```

**File**: `proofs/ops_aggregate/FalkorAggOps/AggPlan.lean` (modified, +206/-0)
```diff
@@ -328,4 +328,210 @@ theorem analyzeKey_spec (e : Ex Z) (k : KeyKind Z) (h : analyzeKey e = some k) :
     · cases h
     · cases h; simp
 
+/-- `AggregateOp::analyze` (aggregate.rs since #3579): an aggregation with any implicit grouping
+key (`implicit_keys`, abstract here) is refused, so it takes the per-row path; otherwise the
+analysis is `analyze` on the explicit keys and the aggregations. -/
+def analyzeOp {K : Type} (implicit : List K) (keys aggs : List (Ex Z)) :
+    Option (List (KeyKind Z) × List (VAgg Z)) :=
+  if implicit.isEmpty then analyze keys aggs else none
+
+/-- With an implicit grouping key the vectorized path is never taken: `consume_input_vectorized`
+may therefore hand its fallback an empty `ImplicitKeys`. -/
+theorem analyzeOp_implicit {K : Type} (implicit : List K) (keys aggs : List (Ex Z))
+    (h : implicit ≠ []) : analyzeOp implicit keys aggs = none := by
+  cases implicit with
+  | nil => exact absurd rfl h
+  | cons _ _ => rfl
+
+/-- Without implicit keys `analyze` is unchanged (`analyze_spec`, `analyze_lengths` apply). -/
+theorem analyzeOp_none {K : Type} (keys aggs : List (Ex Z)) :
+    analyzeOp ([] : List K) keys aggs = analyze keys aggs := rfl
+
+/-! ## `max_variable_id` (aggregate.rs, #3579) -/
+
+/-- An expression tree for `max_variable_id`: each node carries the ids it reads or binds
+itself (`Variable`: its id; a quantifier or list comprehension: its variable; `reduce`: its
+accumulator and iterator; any other node: none). -/
+inductive VT where
+  | node (own : List Nat) (cs : List VT)
+
+/-- The node's own id: the largest of the ids it reads or binds (`ExprIR::loop_vars`), `0` if
+none (the Rust takes the max over the whole DFS walk, `unwrap_or(0)`). -/
+def ownId (own : List Nat) : Nat := own.foldl max 0
+
+mutual
+/-- `max_variable_id`: the node's own id folded with `u32::max` over every child. -/
+def maxVarId : VT → Nat
+  | .node own cs => maxVarIdL (ownId own) cs
+def maxVarIdL : Nat → List VT → Nat
+  | a, [] => a
+  | a, c :: cs => maxVarIdL (max a (maxVarId c)) cs
+end
+
+-- Every id the tree reads or binds, pre-order.
+mutual
+def allIds : VT → List Nat
+  | .node own cs => own ++ allIdsL cs
+def allIdsL : List VT → List Nat
+  | [] => []
+  | c :: cs => allIds c ++ allIdsL cs
+end
+
+theorem le_foldl_max (l : List Nat) (a : Nat) : a ≤ l.foldl max a ∧ ∀ x ∈ l, x ≤ l.foldl max a := by
+  induction l generalizing a with
+  | nil => simp
+  | cons y ys ih =>
+    obtain ⟨h1, h2⟩ := ih (max a y)
+    refine ⟨by simp only [List.foldl_cons]; omega, fun x hx => ?_⟩
+    simp only [List.foldl_cons]
+    rcases List.mem_cons.mp hx with rfl | hx
+    · omega
+    · exact h2 x hx
+
+mutual
+theorem maxVarId_ge : ∀ t : VT, ∀ x ∈ allIds t, x ≤ maxVarId t
+  | .node own cs => by
+    intro x hx
+    simp only [allIds, List.mem_append] at hx
+    simp only [maxVarId]
+    rcases hx with hx | hx
+    · exact Nat.le_trans ((le_foldl_max own 0).2 x hx) (maxVarIdL_ge cs (ownId own)).1
+    · exact (maxVarIdL_ge cs (ownId own)).2 x hx
+theorem maxVarIdL_ge : ∀ (cs : List VT) (a : Nat), a ≤ maxVarIdL a cs ∧ ∀ x ∈ allIdsL cs, x ≤ maxVarIdL a cs
+  | [], a => by simp [maxVarIdL, allIdsL]
+  | c :: cs, a => by
+    obtain ⟨h1, h2⟩ := maxVarIdL_ge cs (max a (maxVarId c))
+    refine ⟨by simp only [maxVarIdL]; omega, fun x hx => ?_⟩
+    simp only [allIdsL, List.mem_append] at hx
+    simp only [maxVarIdL]
+    rcases hx with hx | hx
+    · have := maxVarId_ge c x hx; omega
+    · exact h2 x hx
+end
+
+/-- **The slots are fresh** (`implicit_keys`, #3579): the first slot id, one above
+`max_variable_id` of every key and aggregation tree, and every later one, is above every id
+any of those trees reads or binds (a comprehension's or `reduce`'s own variables included), so
+a slot is never read as an old-scope variable. -/
+theorem slot_fresh (ts : List VT) (n : Nat) (t : VT) (ht : t ∈ ts) (x : Nat) (hx : x ∈ allIds t) :
+    x < (ts.map maxVarId).foldl max 0 + 1 + n := by
+  have h1 := maxVarId_ge t x hx
+  have h2 := (le_foldl_max (ts.map maxVarId) 0).2 (maxVarId t) (List.mem_map_of_mem ht)
+  omega
+
+/-! ## `free_variables` (aggregate.rs, #3579) -/
+
+/-- An expression tree for `free_variables`: each node carries the id it reads (`Variable`)
+and the loop variables it binds (`ExprIR::loop_vars`: a quantifier's or comprehension's
+variable, `reduce`'s accumulator and iterator). A `Variable` is identified by its id. -/
+inductive FT where
+  | node (read : Option Nat) (binds : List Nat) (cs : List FT)
+
+mutual
+/-- The ids read, in `walk::<Dfs>()` (pre-)order. -/
+def readsOf : FT → List Nat
+  | .node r _ cs => r.toList ++ readsOfL cs
+def readsOfL : List FT → List Nat
+  | [] => []
+  | c :: cs => readsOf c ++ readsOfL cs
+end
+
+mutual
+/-- Every loop variable bound anywhere in the tree (`bound` in the Rust). -/
+def boundOf : FT → List Nat
+  | .node _ b cs => b ++ boundOfL cs
+def boundOfL : List FT → List Nat
+  | [] => []
+  | c :: cs => boundOf c ++ boundOfL cs
+end
+
+/-- 
```

**File**: `proofs/ops_aggregate/FalkorAggOps/AggState.lean` (modified, +2/-114)
```diff
@@ -1,17 +1,16 @@
 import FalkorAggOps.AggPlan
 /-
-Aggregate operator state: accumulator zeroing / unbinding, `GroupKey` Eq/Hash,
+Aggregate operator state: accumulator zeroing, `GroupKey` Eq/Hash,
 `args_for`, `new` (graph/src/runtime/ops/aggregate.rs).
 An environment is `Nat → Option Z` (slot ↦ bound value);
-`Row::insert` = `upd`, `Row::unbind` = `clr`.
+`Row::insert` = `upd`.
 -/
 namespace FalkorAggOps.AggPlan
 
 variable {Z : Type}
 
 abbrev Env (Z : Type) := Nat → Option Z
 def upd (env : Env Z) (k : Nat) (z : Z) : Env Z := fun j => if j = k then some z else env j
-def clr (env : Env Z) (k : Nat) : Env Z := fun j => if j = k then none else env j
 
 -- The outermost aggregate calls of a tree, pre-order (no descent into an aggregate).
 mutual
@@ -113,117 +112,6 @@ theorem setZero_spec (e : Ex Z) (env : Env Z) (hw : AccWF (outer e)) :
   rw [setZero_eq]
   exact ⟨rfl, foldlM_stepZ_ok _ env hw (outer_agg e)⟩
 
-/-! ## `unbind_agg_accumulators` (aggregate.rs) -/
-
-mutual
-def unbindAcc : Ex Z → Env Z → Env Z
-  | .func f cs, env =>
-    if f.init.isSome then
-      if 2 ≤ cs.length then
-        match cs.getLast? with
-        | some (.var k) => clr env k
-        | _ => env
-      else env
-    else unbindAccL cs env
-  | .var _, env | .const _, env => env
-  | .prop _ cs, env | .distinct cs, env | .other cs, env => unbindAccL cs env
-def unbindAccL : List (Ex Z) → Env Z → Env Z
-  | [], env => env
-  | e :: es, env => unbindAccL es (unbindAcc e env)
-end
-
-def stepU (env : Env Z) (p : Fn Z × List (Ex Z)) : Env Z :=
-  if 2 ≤ p.2.length then
-    match p.2.getLast? with
-    | some (.var k) => clr env k
-    | _ => env
-  else env
-
-def accIs : Option (Ex Z) → Nat → Bool
-  | some (.var k), j => k == j
-  | _, _ => false
-
-theorem accIs_iff (o : Option (Ex Z)) (j : Nat) : accIs o j = true ↔ o = some (.var j) := by
-  cases o with
-  | none => simp [accIs]
-  | some x => cases x <;> simp [accIs]
-
-theorem stepU_apply (e : Env Z) (p : Fn Z × List (Ex Z)) (j : Nat) :
-    stepU e p j = if 2 ≤ p.2.length ∧ accIs p.2.getLast? j = true then none else e j := by
-  unfold stepU
-  by_cases h2 : 2 ≤ p.2.length
-  · simp only [h2, ite_true, true_and]
-    cases hl : p.2.getLast? with
-    | none => simp [accIs]
-    | some x =>
-      cases x <;> simp [accIs]
-      rename_i k
-      simp only [clr]
-      by_cases hj : j = k <;> simp [hj]
-      intro h; exact absurd h.symm hj
-  · simp [h2]
-
-mutual
-theorem unbindAcc_eq : ∀ (e : Ex Z) (env : Env Z), unbindAcc e env = (outer e).foldl stepU env
-  | .func f cs, env => by
-      unfold unbindAcc outer
-      cases h : f.init.isSome
-      · simp [unbindAccL_eq cs env]
-      · simp [stepU]
-  | .var _, _ => rfl
-  | .const _, _ => rfl
-  | .prop _ cs, env => by simp [unbindAcc, outer, unbindAccL_eq cs env]
-  | .distinct cs, env => by simp [unbindAcc, outer, unbindAccL_eq cs env]
-  | .other cs, env => by simp [unbindAcc, outer, unbindAccL_eq cs env]
-theorem unbindAccL_eq : ∀ (es : List (Ex Z)) (env : Env Z), unbindAccL es env = (outerL es).foldl stepU env
-  | [], _ => rfl
-  | e :: es, env => by
-      simp only [unbindAccL, outerL, List.foldl_append, unbindAcc_eq e env, unbindAccL_eq es]
-end
-
-/-- Every slot `set_agg_expr_zero` wrote is unbound again by `unbind_agg_accumulators`,
-provided every outermost aggregate has an argument besides its accumulator (true of every
-parsed call: `count(*)` is `count(1)`, cypher.rs). Other slots are untouched. -/
-theorem unbind_after_zero (l : List (Fn Z × List (Ex Z))) (env : Env Z) (k : Nat)
-    (h2 : ∀ p ∈ l, 2 ≤ p.2.length) (hk : ∃ p ∈ l, p.2.getLast? = some (.var k)) :
-    l.foldl stepU env k = none := by
-  induction l generalizing env with
-  | nil => simp at hk
-  | cons p ps ih =>
-    simp only [List.foldl_cons]
-    rcases hk with ⟨q, hq, hqk⟩
-    rcases List.mem_cons.mp hq with rfl | hq'
-    · have hc : stepU env q k = none := by
-        rw [stepU_apply]; simp [h2 q (List.mem_cons_self ..), hqk, accIs]
-      have keep : ∀ (l : List (Fn Z × List (Ex Z))) (e : Env Z), e k = none → l.foldl stepU e k = none := by
-        intro l; induction l with
-        | nil => intro e he; exact he
-        | cons r rs ihr =>
-          intro e he; apply ihr
-          rw [stepU_apply]; split <;> simp_all
-      exact keep ps _ hc
-    · exact ih _ (fun r hr => h2 r (List.mem_cons_of_mem _ hr)) ⟨q, hq', hqk⟩
-
-theorem unbind_other (l : List (Fn Z × List (Ex Z))) (env : Env Z) (k : Nat)
-    (hk : ∀ p ∈ l, p.2.getLast? ≠ some (.var k)) : l.foldl stepU env k = env k := by
-  induction l generalizing env with
-  | nil => rfl
-  | cons p ps ih =>
-    simp only [List.foldl_cons]
-    rw [ih _ (fun r hr => hk r (List.mem_cons_of_mem _ hr))]
-    have hp := hk p (List.mem_cons_self ..)
-    have : accIs p.2.getLast? k = false := by
-      cases h : accIs p.2.getLast? k
-      · rfl
-      · exact absurd ((accIs_iff _ _).mp h) hp
-    rw [stepU_apply]; simp [this]
-
-/-- Latent asymmetry: a one-child aggregate call (a
```

#### Recent Merged Pull Requests:
- **PR #4078** (2026-11-26): ci(perf): run each soak scenario as its own check on its own VM (@DvirDukhan)
- **PR #4074** (2026-11-26): fix(banner): wait for the output queue before each line, not after it (@DvirDukhan)
- **PR #4070** (2026-11-26): ci(perf): fix the bot review findings left open on the merged perf PRs (@DvirDukhan)
- **PR #4067** (2026-11-26): ci(perf): a night is green only when every pass/fail check passes on the candidate (@DvirDukhan)
- **PR #4039** (2026-11-26): ci(perf): run the perf checks on a pull request from a `/perf` comment (@DvirDukhan)
- **PR #4038** (2026-11-26): fix(proofs): pr_impact.py no longer blames a fn for attributes above the next one (@AviAvni)

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

## X. banner): wait for the output queue before each line, not after it

**RULE**:
When implementing operations in `src/banner/mod.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc5d7837`: banner): wait for the output queue before each line, not after it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/banner/mod.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        fd::{AsFd, AsRawFd, BorrowedFd, RawFd},
/// Writes `text` to `tty` a line at a time. Before each line it waits up to
/// `wait` for the output queue to empty, and it stops at the first line it
/// cannot send. Returns whether all of `text` was written.
///
/// Waiting before each line rather than after it means `tty` is not touched
/// after the last line: if the terminal closes as soon as it has read all of
/// `text`, the result is still true.
    tty: &mut (impl Write + AsFd),
        .all(|line| drained(tty.as_fd(), wait) && tty.write_all(line.as_bytes()).is_ok())
    tty: BorrowedFd<'_>,
        io::{self, Read, Write},
        os::fd::{AsFd, AsRawFd, BorrowedFd, FromRawFd, OwnedFd},
    /// A terminal that reads every write at once and closes as soon as it has
    /// the whole banner, before `write_bounded` returns. The reader thread in
    /// `whole_banner_reaches_a_draining_terminal` does the same when it beats
    /// the writer on a busy machine (#4073). On Linux, closing the master end
    /// hangs up the slave end, and every later call on it fails with EIO. macOS
    /// still answers TIOCOUTQ after that, so this test guards Linux only.
    struct ClosesOnceI
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        fd::{AsRawFd, RawFd},
/// Writes `text` to `tty` a line at a time, each line only once the previous
/// one has left the output queue; stops at the first line the terminal does
/// not take within `wait`. Returns whether all of `text` was written.
    tty: &mut File,
        .all(|line| tty.write_all(line.as_bytes()).is_ok() && drained(tty, wait))
    tty: &File,
        io::Read,
        os::fd::{FromRawFd, OwnedFd},
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc5d7837` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
