# Forensic Learning Record (Deep Inspection): malisper/pgrust

> **Canonical Artifact**: `07_PROJECT_LEARNING/malisper-pgrust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/malisper/pgrust](https://github.com/malisper/pgrust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:16:36.770Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `malisper/pgrust`
- **Description**: Postgres rewritten in Rust, now faster than Postgres and Clickhouse
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5202 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crash-simulator/src/bin/simharness_gen.rs`
```
//! simharness-gen — WS-GEN's gen-only CLI (bootstrap binary).
//!
//! WS-RUNNER's `simharness` binary owns run/replay/bugbase; this tool covers
//! the generation-only gates and stays useful afterwards as the plan
//! inspection/smoke tool:
//!
//!   simharness-gen gen       --seed N --profile FILE [--out FILE]
//!   simharness-gen gen-batch --seed-base N --count K --profile FILE --out-dir DIR
//!   simharness-gen smoke     --profile-dir DIR --count N [--seed-base B] [--census FILE]
//!
//! Generator version pin: SIMHARNESS_GENERATOR_SHA env if set, else
//! `git rev-parse --short=12 HEAD`, else "unknown". Timestamps never enter
//! plan bytes (determinism law A3).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::exit;

use simharness::gen::profile::GenProfile;
use simharness::gen::screens;
use simharness::gen::generate_plan;
use simharness::plan::{self, Plan, PlanItem, Step};

fn generator_sha() -> String {
    if let Ok(s) = std::env::var("SIMHARNESS_GENERATOR_SHA") {
        if !s.is_empty() && !s.chars().any(|c| c.is_whitespace()) {
            return s;
        }
    }
    if let Ok(out) = std::process::Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .output()
    {
        if out.status.success() {
            if let Ok(s) = String::from_utf8(out.stdout) {
                let s = s.trim().to_string();
                if !s.is_empty() {
                    return s;
                }
            }
        }
    }
    "unknown".to_string()
}

fn die(msg: &str) -> ! {
    eprintln!("simharness-gen: {msg}");
    exit(2);
}

fn parse_flags(args: &[String]) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    let mut i = 0;
    while i < args.len() {
        let k = &args[i];
        if !k.starts_with("--") {
            die(&format!("unexpected argument '{k}'"));
        }
        let Some(v) = args.get(i + 1) else {
            die(&format!("flag {k} needs a value"));
        };
        out.insert(k[2..].to_string(), v.clone());
        i += 2;
    }
    out
}

fn load_profile(path: &Path) -> (GenProfile, String) {
    let bytes = fs::read(path)
        .unwrap_or_else(|e| die(&format!("cannot read profile {}: {e}", path.display())));
    GenProfile::from_bytes(&bytes)
        .unwrap_or_else(|e| die(&format!("profile {}: {e}", path.display())))
}

#[derive(Default, Clone)]
struct Census {
    ddl: u64,
    dml: u64,
    query: u64,
    tx: u64,
    arm: u64,
    fault: u64,
    assume: u64,
    assert_: u64,
    property_blocks: u64,
    order_underdetermined: u64,
    float_lenient: u64,
    session: u64,
}

impl Census {
    fn add_step(&mut self, s: &Step) {
        match s {
            Step::Ddl(_) => self.ddl += 1,
            Step::Dml(_) => self.dml += 1,
            Step::Query(q) => {
                self.query += 1;
                if q.flags.order_underdetermined {
                    self.order_underdetermined += 1;
                }
                if q.flags.float_lenient {
                    self.float_lenient += 1;
                }
            }
            Step::Tx(_) => self.tx += 1,
            Step::Arm(_) => self.arm += 1,
            Step::Assumption(_) => self.assume += 1,
            Step::Assertion(_) => self.assert_ += 1,
            Step::Fault(_) => self.fault += 1,
            // H8 session-family steps (multi-session properties).
            Step::Session(_) | Step::AsyncDml(_) | Step::Join(_) | Step::WaitUntil(_) => {
                self.session += 1
            }
        }
    }

    fn add_plan(&mut self, p: &Plan) {
        for item in &p.items {
            match item {
                PlanItem::Step(s) => self.add_step(s),
                PlanItem::Property { steps, .. } => {
                    self.property_blocks += 1;
                    for s in steps {
                        self.add_step(s);
                    }
                }
            }
        }
    }

    fn merge(&mut self, o: &Census) {
        self.ddl += o.ddl;
        self.dml += o.dml;
        self.query += o.query;
        self.tx += o.tx;
        self.arm += o.arm;
        self.fault += o.fault;
        self.assume += o.assume;
        self.assert_ += o.assert_;
        self.property_blocks += o.property_blocks;
        self.order_underdetermined += o.order_underdetermined;
        self.float_lenient += o.float_lenient;
    }

    fn tsv(&self) -> String {
        format!(
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
            self.ddl,
            self.dml,
            self.query,
            self.tx,
            self.arm,
            self.fault,
            self.assume,
            self.assert_,
            self.property_blocks,
            self.order_underdetermined,
            self.float_lenient
        )
    }

    fn kv(&self) -> String {
        format!(
            "ddl={} dml={} query={} tx={} arm={} fault={} assume={} assert={} props={} orderund={} floatlen={}",
            self.ddl,
            self.dml,
            self.query,
            self.tx,
            self.arm,
            self.fault,
            self.assume,
            self.assert_,
            self.property_blocks,
            self.order_underdetermined,
            self.float_lenient
        )
    }
}

const CENSUS_TSV_HEADER: &str =
    "profile\tseed\tddl\tdml\tquery\ttx\tarm\tfault\tassume\tassert\tprops\torderund\tfloatlen";

fn cmd_gen(flags: BTreeMap<String, String>) {
    let seed: u64 = flags
        .get("seed")
        .unwrap_or_else(|| die("gen needs --seed"))
        .parse()
        .unwrap_or_else(|_| die("bad --seed"));
    let ppath = PathBuf::from(flags.get("profile").unwrap_or_else(|| die("gen needs --profile")));
    let (profile, sha) = load_profile(&ppath);
    let plan = generate_plan(seed, &profile, &sha, &generator_sha(), &[]);
    let text = plan::render(&plan);
    match flags.get("out") {
        Some(o) => fs::write(o, &text).unwrap_or_else(|e| die(&format!("write {o}: {e}"))),
        None => print!("{text}"),
    }
}

fn cmd_gen_batch(flags: BTreeMap<String, String>) {
    let base: u64 = flags
        .get("seed-base")
        .unwrap_or_else(|| die("gen-batch needs --seed-base"))
        .parse()
        .unwrap_or_else(|_| die("bad --seed-base"));
    let count: u64 = flags
        .get("count")
        .unwrap_or_else(|| die("gen-batch needs --count"))
        .parse()
        .unwrap_or_else(|_| die("bad --count"));
    let ppath =
        PathBuf::from(flags.get("profile").unwrap_or_else(|| die("gen-batch needs --profile")));
    let out_dir =
        PathBuf::from(flags.get("out-dir").unwrap_or_else(|| die("gen-batch needs --out-dir")));
    fs::create_dir_all(&out_dir).unwrap_or_else(|e| die(&format!("mkdir out-dir: {e}")));
    let (profile, sha) = load_profile(&ppath);
    let gsha = generator_sha();
    for i in 0..count {
        let seed = base + i;
        let plan = generate_plan(seed, &profile, &sha, &gsha, &[]);
        let text = plan::render(&plan);
        let path = out_dir.join(format!("{}-{seed}.plan", profile.name));
        fs::write(&path, &text)
            .unwrap_or_else(|e| die(&format!("write {}: {e}", path.display())));
    }
    println!("SIMHARNESS|gen-batch|{}|{count}", profile.name);
}

fn cmd_smoke(flags: BTreeMap<String, String>) {
    let dir = PathBuf::from(
        flags.get("profile-dir").unwrap_or_else(|| die("smoke needs --profile-dir")),
    );
    let count: u64 = flags
        .get("count")
        .unwrap_or_else(|| die("smoke needs --count"))
        .parse()
        .unwrap_or_else(|_| die("bad --count"));
    let base: u64 =
        flags.get("seed-base").map(|s| s.parse().unwrap_or_else(|_| die("bad --seed-base"))).unwrap_or(1);
    let mut profiles: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap_or_else(|e| die(&format!("read profile-dir: {e}")))
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "jso
```

### Core Architecture Module: `crash-simulator/src/bridge.rs`
```
//! Integration bridge (harness/h1) — the glue the three WS surfaces meet on.
//!
//! - `runner_profile_to_gen`: the runner's profile JSON (contract §4.2 schema,
//!   WS-RUNNER owned) viewed through WS-GEN's `GenProfile` (which owns the
//!   generation-side fields). One file on disk, one sha256, two typed views.
//! - `oracle_registry` / `OraclePropGen`: WS-ORACLE's 14 v1 properties adapted
//!   to WS-GEN's `PropertyGen` trait, lowering the oracle-side `PStep` IR into
//!   frozen plan-format v1 steps (1:1, so run-time context stays aligned).
//! - `OracleCtx` + `generate_plan_with_ctx`: per-seed oracle run context —
//!   the property instances (ledger ops, probe slots, checks) keyed by the
//!   plan's property `seq`. Deterministically regenerable from the seed
//!   (determinism law §0 A3), so it is never serialized into the plan.
//! - `OracleCheckEval`: the runner-side `CheckEval` backed by WS-ORACLE's
//!   ledger + slot-addressed result stack + `eval_check`.
//! - `OracleDiffClassifier`: the runner-side `DiffClassifier` backed by
//!   WS-ORACLE's triage.py-pinned ladder + warts.toml suppression.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use rand::RngCore;

use crate::gen::profile::{
    ColTypeWeights, GenProfile, IsoMix, PlanLen, StatementWeights, TableShape,
};
use crate::gen::schema::SchemaState;
use crate::oracle::check::{
    check_from_json, check_to_json, eval_check, CheckOutcome, HookKind, HookProbe,
    ResultStack as OracleStack, Row, StmtResult, Value,
};
use crate::oracle::classifier::{classify_step, digest_rows, RunStatus};
use crate::oracle::ledger::{reconcile, ApplyOutcome, EngineDmlResult, Ledger};
use crate::oracle::props::{self, ProfileView};
use crate::oracle::pstep::{
    ArmCtl as PArmCtl, IsoLevel as PIso, Mark as PMark, NoiseConstraint, PropertyInstance, PStep,
    SqlMeta, SqlStep, TxCtl as PTxCtl,
};
use crate::oracle::warts::Warts;
use crate::plan::{ArmCtl, Check, IsoLevel, Mark, Plan, PlanItem, Sql, SqlFlags, Step, TxCtl};
use crate::property::{Caps, Footprint, GeneratedProperty, NoiseSource, PropertyGen};
use crate::runner::driver::{CheckEval, CheckVerdict, DiffClassifier, ExecOutcome};
use crate::vocab::Severity;

// ---------------------------------------------------------------------------
// Profile view: runner schema -> gen schema (one file, two typed views)
// ---------------------------------------------------------------------------

pub fn runner_profile_to_gen(p: &crate::runner::profile::Profile) -> GenProfile {
    let w = |k: &str, d: u64| p.statement_weights.get(k).map(|v| *v as u64).unwrap_or(d);
    let iso = |k: &str| p.iso_mix.get(k).map(|v| *v as u64).unwrap_or(0);
    // Preserve SET structure (never flatten): a profile arm set is applied
    // atomically by the generator (H4 arm-set fidelity fix).
    let arm_sets: Vec<Vec<(String, String)>> = p
        .arm_sets
        .iter()
        .map(|set| {
            set.iter()
                .filter_map(|arm| {
                    arm.split_once('=').map(|(k, v)| (k.to_string(), v.to_string()))
                })
                .collect()
        })
        .collect();
    let mut property_weights: BTreeMap<String, u64> = p
        .property_weights
        .iter()
        .map(|(k, v)| (k.clone(), *v as u64))
        .collect();
    for k in &p.kill_switches {
        property_weights.insert(k.clone(), 0);
    }
    // H8: session-gated properties (M2/S1) are weighted 0 unless the profile
    // opts into the multi-session estate — the reach gate then treats them as
    // gated-unreachable (no reach-gap), matching the hook-gated F7/F8 pattern.
    if !p.multi_session {
        for id in crate::oracle::props::v1_set() {
            if id.needs_sessions() {
                property_weights.insert(id.as_str().to_string(), 0);
            }
        }
    }
    GenProfile {
        name: p.name.clone(),
        plan_len: PlanLen { min: p.steps_min.max(1) as u64, max: p.steps_max.max(1) as u64 },
        statement_weights: StatementWeights {
            ddl: w("ddl", 0),
            dml: w("dml", 0),
            query: w("query", 0),
            tx: w("tx", 0),
            arm: w("arm", 0),
            fault: w("fault", 0),
            property: w("property", 0),
        },
        table_shape: TableShape {
            min_cols: p.table_shape.cols_min.max(1),
            max_cols: p.table_shape.cols_max.max(1),
            // H6 (H5 find 2 fix): honor the profile's col_types. An empty
            // map keeps the generator defaults; a non-empty map is a FULL
            // specification (missing keys weigh 0). The old hardcoded
            // default (float8=0) made q:float-agg unreachable from every
            // runner profile — float_lenient profiles included.
            col_types: if p.table_shape.col_types.is_empty() {
                ColTypeWeights::default()
            } else {
                let ct = |k: &str| {
                    p.table_shape.col_types.get(k).map(|v| *v as u64).unwrap_or(0)
                };
                ColTypeWeights {
                    int: ct("int"),
                    bigint: ct("bigint"),
                    text: ct("text"),
                    numeric: ct("numeric"),
                    float8: ct("float8"),
                }
            },
            rows_max: p.table_shape.rows_max,
        },
        iso_mix: IsoMix {
            rc: iso("read-committed"),
            rr: iso("repeatable-read"),
            ser: iso("serializable"),
        },
        arm_sets,
        property_weights,
        float_lenient: p.float_lenient,
        test_disable_productions: p.test_disable_productions.clone(),
        planner_knobs: p.planner_knobs.clone(),
        multi_session: p.multi_session,
    }
}

/// The typed-generator schema, viewed for the metamorphic properties (L1/L2
/// live-table arms): current SQL names + birth ids + predicate-relevant
/// column kinds. `id` is always present (Int, NOT NULL unique).
fn schema_view(schema: &SchemaState) -> props::SchemaView {
    use crate::gen::schema::ColType;
    let tables = schema
        .tables()
        .iter()
        .map(|t| {
            let mut cols = vec![props::SchemaCol {
                name: "id".to_string(),
                kind: props::PredColKind::Int,
            }];
            cols.extend(t.cols.iter().map(|c| props::SchemaCol {
                name: c.name.clone(),
                kind: match c.ty {
                    ColType::Int | ColType::Bigint => props::PredColKind::Int,
                    ColType::Text => props::PredColKind::Text,
                    ColType::Numeric | ColType::Float8 => props::PredColKind::Other,
                },
            }));
            props::SchemaTable {
                name: t.cur_name.clone(),
                birth_id: t.birth_id.clone(),
                cols,
            }
        })
        .collect();
    props::SchemaView { tables }
}

fn profile_view(gp: &GenProfile) -> ProfileView {
    let mut iso_mix = Vec::new();
    // Weighted mix as a proportional pick vector (integer arithmetic only).
    let scale = |w: u64| ((w + 9) / 10).min(16) as usize; // 0 stays 0
    for _ in 0..scale(gp.iso_mix.rc) {
        iso_mix.push(PIso::ReadCommitted);
    }
    for _ in 0..scale(gp.iso_mix.rr) {
        iso_mix.push(PIso::RepeatableRead);
    }
    for _ in 0..scale(gp.iso_mix.ser) {
        iso_mix.push(PIso::Serializable);
    }
    if iso_mix.is_empty() {
        iso_mix.push(PIso::ReadCommitted);
    }
    // Property-side view keeps set structure; empty control sets are not
    // useful to X1/L2 (nothing to SET), so they are filtered here.
    let arm_sets: Vec<Vec<(String, String)>> =
        gp.arm_sets.iter().filter(|s| !s.is_empty()).cloned().collect();
    ProfileView { float_lenient: gp.float_lenient, iso_mix, arm_sets }
}

// ---------------------------------------------------------------------------
// PStep -> plan::Step lowering (1:1; NoiseSlot
```

### Core Architecture Module: `crash-simulator/src/gen/budget.rs`
```
//! Budget steering (`Remaining`, contract §2.1.2): per-statement-kind budgets
//! from profile weights, decremented as steps are emitted (noise AND
//! property-embedded), so the configured distribution holds across both.

use crate::gen::profile::StatementWeights;
use crate::property::Footprint;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Ddl = 0,
    Dml = 1,
    Query = 2,
    Tx = 3,
    Arm = 4,
    Fault = 5,
    Property = 6,
}

pub const N_KINDS: usize = 7;

pub const ALL_KINDS: [Kind; N_KINDS] =
    [Kind::Ddl, Kind::Dml, Kind::Query, Kind::Tx, Kind::Arm, Kind::Fault, Kind::Property];

#[derive(Debug, Clone)]
pub struct Budgets {
    remaining: [u64; N_KINDS],
}

impl Budgets {
    /// Largest-remainder allocation of `total` steps across kinds by weight.
    /// Integer arithmetic only.
    pub fn allocate(weights: &StatementWeights, total: u64, properties_available: bool) -> Budgets {
        let mut w = [
            weights.ddl,
            weights.dml,
            weights.query,
            weights.tx,
            weights.arm,
            weights.fault,
            weights.property,
        ];
        if !properties_available {
            w[Kind::Property as usize] = 0;
        }
        let wsum: u64 = w.iter().sum();
        let mut remaining = [0u64; N_KINDS];
        if wsum == 0 {
            return Budgets { remaining };
        }
        let mut assigned = 0u64;
        // (remainder, index) for largest-remainder distribution; ties broken by
        // fixed kind order — fully deterministic.
        let mut rems: Vec<(u64, usize)> = Vec::with_capacity(N_KINDS);
        for (i, &wi) in w.iter().enumerate() {
            let exact_num = wi * total;
            remaining[i] = exact_num / wsum;
            assigned += remaining[i];
            rems.push((exact_num % wsum, i));
        }
        rems.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        let mut leftover = total - assigned;
        for &(_, i) in &rems {
            if leftover == 0 {
                break;
            }
            if w[i] > 0 {
                remaining[i] += 1;
                leftover -= 1;
            }
        }
        // H6 fix (H5 find 1): the disconnect fault emits as a PAIR, so a
        // fault budget of 0 or 1 means a profile that DECLARES faults never
        // executes one. Battery-typical fault weights (1-2%) floor to 0/1 at
        // every allowed plan length, which left 4 of 6 profiles — the whole
        // smoke tier — with zero disconnect coverage since H1, silently.
        // The pair floor: any profile with fault weight > 0 gets a fault
        // budget of at least 2 (when the plan is long enough), taken
        // deterministically from the largest other allocations.
        let fi = Kind::Fault as usize;
        if w[fi] > 0 && total >= 2 && remaining[fi] < 2 {
            let mut need = 2 - remaining[fi];
            while need > 0 {
                // Largest non-fault allocation; ties broken by kind order.
                let donor = (0..N_KINDS)
                    .filter(|&i| i != fi && remaining[i] > 0)
                    .max_by(|&a, &b| remaining[a].cmp(&remaining[b]).then(b.cmp(&a)));
                match donor {
                    Some(d) => {
                        remaining[d] -= 1;
                        remaining[fi] += 1;
                        need -= 1;
                    }
                    None => break, // degenerate: nothing to take from
                }
            }
        }
        Budgets { remaining }
    }

    pub fn remaining(&self, k: Kind) -> u64 {
        self.remaining[k as usize]
    }

    pub fn consume(&mut self, k: Kind, n: u64) {
        let r = &mut self.remaining[k as usize];
        *r = r.saturating_sub(n);
    }

    /// Consume a property's expected footprint (saturating per kind) plus one
    /// unit of the property budget itself.
    pub fn consume_footprint(&mut self, fp: &Footprint) {
        self.consume(Kind::Property, 1);
        self.consume(Kind::Ddl, fp.ddl as u64);
        self.consume(Kind::Dml, fp.dml as u64);
        self.consume(Kind::Query, fp.query as u64);
        self.consume(Kind::Tx, fp.tx as u64);
        self.consume(Kind::Arm, fp.arm as u64);
        self.consume(Kind::Fault, fp.fault as u64);
    }

    pub fn total_remaining(&self) -> u64 {
        self.remaining.iter().sum()
    }
}

```

### Core Architecture Module: `crash-simulator/src/gen/generator.rs`
```
//! The lazy plan generator (Turso mechanics per spec §1.1, contract §2.1.2).
//!
//! Determinism law (§0 A3, plan tier — unconditional): one ChaCha8 stream
//! seeded from the one u64 seed; all draws in generation order; ordered
//! containers only; integer weight arithmetic; no ambient entropy or clock
//! anywhere in this module. `seed + profile + generator version` =>
//! byte-identical plan.

use std::cell::RefCell;
use std::collections::VecDeque;

use rand::RngCore;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

use crate::gen::budget::{Budgets, Kind};
use crate::gen::noise;
use crate::gen::prodreg::{self as pr, GenTraces, ProdPath};
use crate::gen::profile::GenProfile;
use crate::gen::schema::{SchemaSnapshot, SchemaState};
use crate::gen::weights::{range_incl, weighted_index};
use crate::plan::{
    ArmCtl, FaultPoint, IsoLevel, Plan, PlanHeader, PlanItem, Sql, Step, TxCtl,
};
use crate::property::{NoiseSource, PropertyGen};

/// Bounded retry for constrained placeholder noise (contract §2.1.2).
const NOISE_RETRY_BUDGET: usize = 16;

/// A property is offered only while its expected footprint fits the remaining
/// per-kind budgets ("property weights are functions of remaining budgets" —
/// this is what keeps the distribution exact across noise and
/// property-embedded steps).
fn footprint_fits(budgets: &Budgets, fp: &crate::property::Footprint) -> bool {
    budgets.remaining(Kind::Property) >= 1
        && budgets.remaining(Kind::Ddl) >= fp.ddl as u64
        && budgets.remaining(Kind::Dml) >= fp.dml as u64
        && budgets.remaining(Kind::Query) >= fp.query as u64
        && budgets.remaining(Kind::Tx) >= fp.tx as u64
        && budgets.remaining(Kind::Arm) >= fp.arm as u64
        && budgets.remaining(Kind::Fault) >= fp.fault as u64
}

struct NoiseCtx<'a> {
    schema: &'a SchemaState,
    profile: &'a GenProfile,
    /// H5 production-trace sink. Property noise queries are emitted (and
    /// executed) statements from the same query grammar, so their traces are
    /// committed as `stmt:query` paths on ACCEPTANCE only (rejected retry
    /// candidates never reach the plan and must not enter the metric).
    trace: &'a RefCell<GenTraces>,
}

impl NoiseSource for NoiseCtx<'_> {
    fn noise_query(
        &mut self,
        rng: &mut dyn RngCore,
        constraint: &dyn Fn(&Sql) -> bool,
    ) -> Option<Sql> {
        for _ in 0..NOISE_RETRY_BUDGET {
            let mut sub: ProdPath = Vec::new();
            let q = noise::gen_query(self.schema, self.profile, rng, &mut sub)?;
            if constraint(&q) {
                let mut path = vec![pr::STMT_QUERY.to_string()];
                path.extend(sub);
                self.trace.borrow_mut().paths.push(path);
                return Some(q);
            }
        }
        None
    }
}

/// Transaction-visible model state captured at BEGIN / SAVEPOINT and restored
/// on ROLLBACK / ROLLBACK TO / aborting disconnect. DDL and (non-LOCAL) SET
/// are both transactional in PostgreSQL, so both revert with the tx. The
/// schema snapshot covers tables AND the H6 fdw state (extension/server/
/// foreign tables are transactional too).
#[derive(Clone)]
struct TxSnapshot {
    schema: SchemaSnapshot,
    gucs_set: bool,
}

/// Session-visible state the generator must model to stay coherent
/// (serial single-session — §0 A1).
#[derive(Default)]
struct SessionModel {
    in_tx: bool,
    savepoints: Vec<String>,
    next_savepoint: u32,
    gucs_set: bool,
    /// Model state as of BEGIN (`Some` iff `in_tx`): the server reverts to
    /// this on ROLLBACK or on a disconnect that aborts the open tx.
    tx_snapshot: Option<TxSnapshot>,
    /// One snapshot per live savepoint, aligned index-for-index with
    /// `savepoints` (state as of the SAVEPOINT statement; ROLLBACK TO
    /// restores it and keeps the savepoint — and its snapshot — live).
    sp_snapshots: Vec<TxSnapshot>,
}

pub struct Generator<'a> {
    rng: ChaCha8Rng,
    profile: &'a GenProfile,
    registry: &'a [Box<dyn PropertyGen>],
    schema: SchemaState,
    budgets: Budgets,
    session: SessionModel,
    /// H6 planner-knob swarm: per-seed sampled GUC sets (see `gen::knobs`),
    /// appended after `profile.arm_sets` in the arm-set pool. Sampled once
    /// at construction from the SAME seeded stream (draws happen before the
    /// first statement draw, so determinism law A3 is untouched: same seed +
    /// profile => same knob sets => byte-identical plan). Empty when the
    /// profile has no `planner_knobs` block — zero extra draws, so plans for
    /// knob-less profiles are byte-identical to pre-H6 plans.
    sampled_arm_sets: Vec<Vec<(String, String)>>,
    /// Queued items that must follow the current one (fault pairing, tail).
    pending: VecDeque<PlanItem>,
    next_seq: u32,
    emitted_first: bool,
    finished: bool,
    /// H5 rung A: production traces for every emitted statement. Collection
    /// consumes no RNG draws and never touches plan bytes (determinism law
    /// A3 untouched). RefCell: the NoiseCtx borrow runs while `schema` is
    /// shared-borrowed. Cleanup-tail steps (mechanical ROLLBACK/RESET ALL)
    /// are not grammar decisions and are deliberately untraced.
    trace: RefCell<GenTraces>,
}

impl<'a> Generator<'a> {
    pub fn new(seed: u64, profile: &'a GenProfile, registry: &'a [Box<dyn PropertyGen>]) -> Self {
        let mut rng = ChaCha8Rng::seed_from_u64(seed);
        let total = range_incl(&mut rng, profile.plan_len.min, profile.plan_len.max);
        let budgets =
            Budgets::allocate(&profile.statement_weights, total, !registry.is_empty());
        let mut schema = SchemaState::default();
        // Seed tag for foreign-table CSV paths (part of plan identity, so
        // plan bytes stay a pure function of seed+profile+generator).
        schema.set_plan_seed(seed);
        // H6-GUC: knob sampling draws from the SAME seeded stream; knob-less
        // profiles take the None arm and consume zero draws.
        let sampled_arm_sets = match &profile.planner_knobs {
            Some(cfg) => crate::gen::knobs::sample_knob_sets(&mut rng, cfg),
            None => Vec::new(),
        };
        Generator {
            rng,
            profile,
            registry,
            schema,
            budgets,
            session: SessionModel::default(),
            sampled_arm_sets,
            pending: VecDeque::new(),
            next_seq: 1,
            emitted_first: false,
            finished: false,
            trace: RefCell::new(GenTraces::default()),
        }
    }

    fn commit_path(&self, stmt_node: &str, sub: ProdPath) {
        let mut path = Vec::with_capacity(1 + sub.len());
        path.push(stmt_node.to_string());
        path.extend(sub);
        self.trace.borrow_mut().paths.push(path);
    }

    fn cleanup_tail(&mut self) {
        // Deterministic session cleanup: close any open tx, then RESET ALL if
        // any GUC was set (the 1session GUC-leak law).
        if self.session.in_tx {
            self.pending.push_back(PlanItem::Step(Step::Tx(TxCtl::Rollback)));
            // The tail ROLLBACK reverts the server to the BEGIN snapshot, so
            // whether RESET ALL is still owed is decided by the snapshot's
            // GUC state, not the in-tx state.
            let snap = self.session.tx_snapshot.take().expect("in_tx implies tx snapshot");
            self.schema.restore(snap.schema);
            self.session.gucs_set = snap.gucs_set;
            self.session.in_tx = false;
            self.session.savepoints.clear();
            self.session.sp_snapshots.clear();
        }
        if self.session.gucs_set {
            self.pending.push_back(PlanItem::Step(Step::Arm(ArmCtl::ResetAll)));
            self.session.gucs_set = false;
        }
        self.finished = true;
    }

    /// Kind-choice weights for the current state: remaining budget per kind,
    /// zeroed where the kind is not currently generatable.
    fn kind_weight
```

### Core Architecture Module: `crash-simulator/src/gen/knobs.rs`
```
//! H6 planner-knob swarm sampling (the GUC arm of the reach program).
//!
//! Background, in plain terms: the H5 census showed the engine only ever
//! produced 18 distinct query-plan SHAPES under the existing profiles,
//! because the planner was always free to pick its favorite strategy (for
//! example, it almost always picks a hash join for our joins). PostgreSQL —
//! and this engine, which implements the same knobs — exposes planner GUCs
//! ("Grand Unified Configuration" settings, i.e. `SET` variables) like
//! `enable_hashjoin` that turn individual planner strategies off. Turning a
//! strategy off forces the planner onto its ALTERNATIVES (nested loop,
//! materialize, sorted aggregation, parallel plans, ...), which are exactly
//! the plan shapes the census never saw. This is "swarm testing over
//! configuration": every seed gets its own randomly-sampled knob
//! configuration, so a campaign as a whole visits many planner modes.
//!
//! Mechanics: a profile may carry a `planner_knobs` block. When it does, the
//! generator samples `sets_per_seed` knob SETS at plan start (from the same
//! seeded RNG stream as everything else — determinism law A3: same seed +
//! same profile bytes = byte-identical plan) and appends them to the
//! profile's static `arm_sets` pool. Arm steps then apply them through the
//! existing atomic arm-set machinery (H4 fidelity: a set is applied as
//! consecutive SET steps, never flattened).
//!
//! Degeneracy guards (a config that disables EVERY strategy in a family is
//! not a planner mode, it is noise — the planner falls back to
//! disabled-cost plans and the sample wastes its arm):
//! - never all of {seqscan, indexscan, bitmapscan} off in one set;
//! - never all of {hashjoin, mergejoin, nestloop} off in one set;
//! - a sampled set is never empty (an empty set would lower to RESET ALL,
//!   which the pool already has as the control arm).
//!
//! Every knob named here was checked against the engine's GUC table
//! (crates/backend/utils/misc/guc_tables/src/tables.rs) — the validator
//! rejects names outside that checked list so a typo cannot silently
//! sample a no-op configuration.

use rand::RngCore;
use serde::{Deserialize, Serialize};

use crate::gen::weights::range_incl;

/// Planner-knob swarm configuration (profile JSON block `planner_knobs`).
/// All fields are explicit — checked-in profiles spell out their sampling
/// space so the profile sha pins it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PlannerKnobs {
    /// How many knob sets to sample per seed (each becomes one extra arm
    /// set in that plan's pool). Validator bounds: 1..=8.
    pub sets_per_seed: u32,
    /// Percent chance (0..=100) that each listed boolean knob is included
    /// as `<knob>=off` in a sampled set. Independent per knob per set.
    pub off_percent: u32,
    /// The boolean `enable_*` planner GUCs that participate in sampling.
    /// Must be non-empty, duplicate-free, and drawn from
    /// `IMPLEMENTED_BOOL_KNOBS`.
    pub knobs: Vec<String>,
    /// Percent chance (0..=100) that a sampled set ALSO includes the
    /// parallel-forcing block (`PARALLEL_FORCE_SET` — the H4 parallel-arms
    /// recipe: zero parallel costs, zero size floor, 2 workers).
    pub parallel_percent: u32,
}

/// Boolean planner GUCs verified implemented by the engine
/// (guc_tables/src/tables.rs, QUERY_TUNING_METHOD group). `enable_geqo`,
/// `enable_async_append`, partitionwise and partition-pruning knobs are
/// deliberately absent: the grammar has no partitioned tables or async
/// foreign scans yet, so toggling them cannot change any reachable plan.
pub const IMPLEMENTED_BOOL_KNOBS: [&str; 18] = [
    "enable_seqscan",
    "enable_indexscan",
    "enable_indexonlyscan",
    "enable_bitmapscan",
    "enable_tidscan",
    "enable_hashjoin",
    "enable_mergejoin",
    "enable_nestloop",
    "enable_hashagg",
    "enable_sort",
    "enable_incremental_sort",
    "enable_material",
    "enable_memoize",
    "enable_gathermerge",
    "enable_parallel_hash",
    "enable_parallel_append",
    "enable_presorted_aggregate",
    "enable_distinct_reordering",
];

/// Scan-strategy family: never turn ALL of these off in one sampled set.
/// (`enable_indexonlyscan` is not in the family — it only specializes
/// `enable_indexscan`, it is not an independent way to read a table.)
pub const SCAN_GROUP: [&str; 3] = ["enable_seqscan", "enable_indexscan", "enable_bitmapscan"];

/// Join-strategy family: never turn ALL of these off in one sampled set.
pub const JOIN_GROUP: [&str; 3] = ["enable_hashjoin", "enable_mergejoin", "enable_nestloop"];

/// The parallel-forcing block (H4 parallel-arms prior art, verified against
/// the engine's GUC table): makes parallel plans cost-free so the planner
/// considers them even on tiny tables.
pub const PARALLEL_FORCE_SET: [(&str, &str); 4] = [
    ("parallel_setup_cost", "0"),
    ("parallel_tuple_cost", "0"),
    ("min_parallel_table_scan_size", "0"),
    ("max_parallel_workers_per_gather", "2"),
];

/// Percent draw: true with probability `percent`/100. Integer arithmetic
/// only (determinism law A3).
fn pct(rng: &mut dyn RngCore, percent: u32) -> bool {
    range_incl(rng, 0, 99) < percent as u64
}

/// Sample the per-seed knob sets. Called by the generator at plan start with
/// its one seeded RNG stream, so the result is a pure function of
/// (seed, profile): same seed + same profile = same knob sets, every time.
///
/// Guard order matters and is deterministic:
/// 1. draw each knob off with `off_percent` (in the profile's listed order);
/// 2. if nothing was drawn, force ONE uniformly-chosen knob off (a sampled
///    set must be a real planner point, not a duplicate control arm);
/// 3. for each strategy family, if the set turned the WHOLE family off,
///    re-enable one uniformly-chosen member (degeneracy guard);
/// 4. draw the parallel-forcing block with `parallel_percent`.
/// Step 2 runs before step 3 and adds at most one knob, so it can never
/// re-create a whole-family-off set; step 3 removes at most one member per
/// family, so the set can never become empty again.
pub fn sample_knob_sets(rng: &mut dyn RngCore, cfg: &PlannerKnobs) -> Vec<Vec<(String, String)>> {
    let mut sets = Vec::with_capacity(cfg.sets_per_seed as usize);
    for _ in 0..cfg.sets_per_seed {
        let mut offs: Vec<String> = Vec::new();
        for k in &cfg.knobs {
            if pct(rng, cfg.off_percent) {
                offs.push(k.clone());
            }
        }
        if offs.is_empty() && !cfg.knobs.is_empty() {
            let i = range_incl(rng, 0, cfg.knobs.len() as u64 - 1) as usize;
            offs.push(cfg.knobs[i].clone());
        }
        for group in [&SCAN_GROUP, &JOIN_GROUP] {
            if group.iter().all(|g| offs.iter().any(|o| o == g)) {
                let i = range_incl(rng, 0, group.len() as u64 - 1) as usize;
                let victim = group[i];
                offs.retain(|o| o != victim);
            }
        }
        let mut set: Vec<(String, String)> =
            offs.into_iter().map(|k| (k, "off".to_string())).collect();
        if pct(rng, cfg.parallel_percent) {
            set.extend(
                PARALLEL_FORCE_SET.iter().map(|(k, v)| (k.to_string(), v.to_string())),
            );
        }
        sets.push(set);
    }
    sets
}

/// Validate a `planner_knobs` block (called from the runner profile
/// validator; kept here so the knob list and its checks live together).
pub fn validate(k: &PlannerKnobs, profile_name: &str) -> Result<(), String> {
    if k.sets_per_seed == 0 || k.sets_per_seed > 8 {
        return Err(format!(
            "profile '{}': planner_knobs.sets_per_seed={} out of range 1..=8",
            profile_name, k.sets_per_seed
        ));
    }
    if k.off_percent > 100 || k.parallel_percent > 100 {
        return Err(format!(
            "profile '{}': planner_knobs percents must be 0..=100
```

### Core Architecture Module: `crash-simulator/src/gen/mod.rs`
```
//! Generator (WS-GEN): grammar, weights, budgets, screens, lazy plan generator.

pub mod budget;
pub mod generator;
pub mod knobs;
pub mod noise;
pub mod prodreg;
pub mod profile;
pub mod schema;
pub mod screens;
pub mod weights;

pub use generator::{generate_plan, generate_plan_traced, Generator};

```

### Core Architecture Module: `crash-simulator/src/gen/noise.rs`
```
//! Noise grammar (property-first discipline, spec HR2: a construct is here
//! only because the v1 property set / shape classes want it).
//!
//! Screens are enforced AT GENERATION (contract §2.1.3):
//!   R2 — LIMIT/OFFSET is only ever emitted with a same-depth ORDER BY over
//!        the unique key (`id`).
//!   R3/R6 — the grammar contains no volatile or engine-constant-metadata
//!        functions at all; screens::lint is the regex backstop.
//!   R7 — aggregates in compared positions are over exact types unless the
//!        profile is float-lenient, in which case the Sql is tagged.
//!   R1 — nothing here promises result order beyond an explicit unique-key
//!        ORDER BY (relaxed order-law posture).
//!
//! Marks: queries = READ; DML/DDL = MUTATION (nothing ambiguous is generated;
//! anything ambiguous would be MUTATION per the dualexec fail-safe law).

use rand::RngCore;

use crate::gen::prodreg as pr;
use crate::gen::profile::GenProfile;
use crate::gen::schema::{Col, ColType, IndexDef, SchemaState, Table};
use crate::gen::weights::{range_incl, weighted_index};
use crate::plan::{Mark, Sql, SqlFlags};

/// One statement's production sub-path (below the `stmt:*` node), pushed by
/// the emission sites in this module. H5 rung A: the trace records generator
/// DECISIONS at generation time — it never consumes RNG draws and never
/// changes plan bytes (determinism law A3 untouched).
pub type ProdTrace = Vec<String>;

fn sql(text: String, mark: Mark, flags: SqlFlags) -> Sql {
    Sql::new(text, mark, flags).expect("generated SQL is single-line and ';'-terminated")
}

fn literal(rng: &mut dyn RngCore, ty: ColType) -> String {
    match ty {
        ColType::Int | ColType::Bigint => format!("{}", range_incl(rng, 0, 99)),
        ColType::Numeric => format!("{}.{:02}", range_incl(rng, 0, 99), range_incl(rng, 0, 99)),
        ColType::Text => format!("'s{:02}'", range_incl(rng, 0, 49)),
        ColType::Float8 => format!("{}.5", range_incl(rng, 0, 99)),
    }
}

/// Small-domain literal (H6): values that land inside the modular value
/// domains the bulk loader writes (`g % m`, m in 5..=30; text `'s0' || g%10`).
/// Equality predicates drawn from here actually SELECT rows, which is what
/// makes the planner's index/bitmap choices meaningful after ANALYZE.
fn small_literal(rng: &mut dyn RngCore, ty: ColType) -> String {
    match ty {
        ColType::Int | ColType::Bigint | ColType::Numeric => {
            format!("{}", range_incl(rng, 0, 9))
        }
        ColType::Text => format!("'s0{}'", range_incl(rng, 0, 9)),
        ColType::Float8 => format!("{}.5", range_incl(rng, 0, 9)),
    }
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

/// DDL variant nodes, index-aligned with the weight array in `gen_ddl`. The
/// array length is the coupling that keeps the registry from going stale: a
/// new DDL arm without a `prodreg` name is a compile error here (H5 rung A).
/// The fdw entry stands for the whole setup chain; its emitted statements are
/// traced with their own per-statement nodes (see `gen_fdw_chain`).
const DDL_VARIANTS: [&str; 12] = [
    pr::DDL_CREATE_TABLE,
    pr::DDL_CREATE_INDEX,
    pr::DDL_CREATE_INDEX_MULTI,
    pr::DDL_CREATE_INDEX_EXPR,
    pr::DDL_CREATE_INDEX_PARTIAL,
    pr::DDL_CREATE_INDEX_BRIN,
    pr::DDL_DROP_INDEX,
    pr::DDL_ANALYZE,
    pr::DDL_FDW_TABLE,
    pr::DDL_RENAME_TABLE,
    pr::DDL_DROP_TABLE,
    pr::DDL_INDEX_PAIR,
];

/// One emitted DDL statement: its production sub-path + the SQL.
pub type DdlEmit = (ProdTrace, Sql);

/// CREATE TABLE from the profile shape distribution; registers the table.
/// (Production trace: the CALLER pushes `ddl:create-table` — this fn is also
/// the forced first plan item, outside `gen_ddl`'s variant draw.)
pub fn gen_create_table(
    schema: &mut SchemaState,
    rng: &mut dyn RngCore,
    profile: &GenProfile,
) -> Sql {
    let idx = schema.create_table(rng, &profile.table_shape);
    let t = &schema.tables()[idx];
    let mut cols = String::new();
    for c in &t.cols {
        cols.push_str(&format!(", {} {}", c.name, c.ty.sql()));
    }
    sql(
        format!("CREATE TABLE {} (id bigint PRIMARY KEY{});", t.cur_name, cols),
        Mark::Mutation,
        SqlFlags::default(),
    )
}

/// Column list for an index: prefer payload columns, fall back to `id`.
fn pick_index_col(t: &Table, rng: &mut dyn RngCore) -> String {
    if t.cols.is_empty() {
        "id".to_string()
    } else {
        let ci = range_incl(rng, 0, t.cols.len() as u64 - 1) as usize;
        t.cols[ci].name.clone()
    }
}

/// The file_fdw setup chain (H6, Foreign Scan elicitation). One generator
/// decision emits every statement still missing for a NEW foreign table:
/// extension -> server -> deterministic CSV via `COPY ... TO` an absolute
/// seed-tagged /tmp path (COPY requires absolute paths; both legs write the
/// same deterministic bytes, so reads agree) -> `CREATE FOREIGN TABLE`.
/// IF NOT EXISTS keeps extension/server idempotent across seeds (they are
/// database-global and survive the per-seed schema reset).
fn gen_fdw_chain(schema: &mut SchemaState, rng: &mut dyn RngCore) -> Vec<DdlEmit> {
    let mut out: Vec<DdlEmit> = Vec::new();
    if !schema.fdw_extension_created() {
        schema.mark_fdw_extension();
        out.push((
            vec![pr::DDL_FDW_EXTENSION.to_string()],
            sql(
                "CREATE EXTENSION IF NOT EXISTS file_fdw;".to_string(),
                Mark::Mutation,
                SqlFlags::default(),
            ),
        ));
    }
    if !schema.fdw_server_created() {
        schema.mark_fdw_server();
        out.push((
            vec![pr::DDL_FDW_SERVER.to_string()],
            sql(
                "CREATE SERVER IF NOT EXISTS simharness_fsrv FOREIGN DATA WRAPPER file_fdw;"
                    .to_string(),
                Mark::Mutation,
                SqlFlags::default(),
            ),
        ));
    }
    let rows = range_incl(rng, 5, 60);
    let m = range_incl(rng, 5, 25);
    let ft = schema.create_foreign_table(rows);
    let (name, csv) = (ft.name.clone(), ft.csv_name.clone());
    out.push((
        vec![pr::DDL_FDW_COPY.to_string()],
        sql(
            format!(
                "COPY (SELECT g AS id, (g % {m}) AS a, 's0' || (g % 10) AS b \
                 FROM generate_series(1, {rows}) AS g ORDER BY g) \
                 TO '{csv}' WITH (FORMAT csv);"
            ),
            Mark::Mutation,
            SqlFlags::default(),
        ),
    ));
    out.push((
        vec![pr::DDL_FDW_TABLE.to_string()],
        sql(
            format!(
                "CREATE FOREIGN TABLE {name} (id bigint, a int, b text) \
                 SERVER simharness_fsrv OPTIONS (filename '{csv}', format 'csv');"
            ),
            Mark::Mutation,
            SqlFlags::default(),
        ),
    ));
    out
}

/// Maximum foreign tables per plan (state-op bloat guard).
const MAX_FOREIGN_TABLES: usize = 2;

/// Weighted DDL choice. May mutate schema state. Never drops the last table.
/// Returns one or more consecutive DDL statements (the fdw chain is the only
/// multi-statement arm), each with its own production sub-path.
pub fn gen_ddl(
    schema: &mut SchemaState,
    rng: &mut dyn RngCore,
    profile: &GenProfile,
) -> Vec<DdlEmit> {
    let can_drop = schema.tables().len() > 1;
    let has_table = !schema.tables().is_empty();
    let fdw_ok = schema.foreign_tables().len() < MAX_FOREIGN_TABLES;
    // NOTE: free (non-property) DDL draws are RARE — property footprints
    // consume most of the DDL budget, leaving ~1 draw per plan besides the
    // forced first CREATE TABLE. Arms that need a prior arm's state within
    // the same plan are therefore structurally starved; drop-index emits its
    // own create+drop chain when no index exists yet (measured: 0 drop-index
    // emissions in 300 seeds under 
```

### Core Architecture Module: `crash-simulator/src/gen/prodreg.rs`
```
//! Production registry + k-path grammar coverage (H5 rung A).
//!
//! The generator is typed/procedural, not a CFG, so the k-path metric
//! (Havrikov & Zeller, *Systematically Covering Input Structure*, ASE 2019;
//! journal ext. ACM TOSEM 2022) is adapted honestly: the "grammar graph" is
//! defined from the generator's OWN production structure — statement-kind
//! choices, per-kind variant choices, and sub-variant choices (scalar-call
//! arms, SRF element types, join-qual alternatives, BEGIN isolation levels,
//! oracle properties). Every node the generator can emit is declared HERE, in
//! one static table (+ the oracle-property nodes derived from
//! `props::v1_set()` at registry build, so a new property self-registers).
//!
//! Anti-staleness discipline (the "metric can't silently go stale" charter
//! line): the emission sites in `gen::noise` index compile-time-sized arrays
//! of these node names (`[&str; N]` tied to the weight-array length), so
//! adding a generator variant without a registry name is a compile error at
//! the emission site; and the registry-lock unit tests assert (a) every
//! traced name over a large multi-profile corpus is registered and (b) every
//! default-reachable registered name is actually emitted by such a corpus.
//!
//! k-path semantics (verified traps carried from the research doc,
//! docs/research/fuzzer-exploration-2026-07-18.md):
//!   * NO subsumption across k (ASE'19 thesis §2.5.3) — k=1, k=2, k=3 are
//!     computed and reported JOINTLY, never only the largest.
//!   * epsilon-class productions (alternatives that emit no token, e.g. the
//!     "no WHERE qual" branch of the LEFT-join variant) cannot appear in
//!     traces — they are declared with `epsilon: true` and EXCLUDED from
//!     every denominator explicitly, and listed in the report.
//!   * k=1 here is symbol coverage (Def. 3, ASE'19): it does NOT subsume
//!     rule coverage; our nodes are generator DECISIONS, which for this
//!     generator coincide with its production applications.
//!
//! THE REACH GATE: any production whose gate evaluates reachable-by-default
//! under the campaign profile that never appears at k=1 makes the campaign
//! verdict RED (`reach-gap`, a harness-mechanics class distinct from bug
//! findings). This is the check that would have caught H3's 0/9 before any
//! seed ran: joins/functions/SRFs sat at 0% emission — a k=1 zero.

use std::collections::{BTreeMap, BTreeSet};

use crate::gen::profile::GenProfile;

// ---------------------------------------------------------------------------
// Node names (referenced from the emission sites in gen::noise / generator)
// ---------------------------------------------------------------------------

// statement kinds (children of the plan root)
pub const STMT_DDL: &str = "stmt:ddl";
pub const STMT_DML: &str = "stmt:dml";
pub const STMT_QUERY: &str = "stmt:query";
pub const STMT_TX: &str = "stmt:tx";
pub const STMT_ARM: &str = "stmt:arm";
pub const STMT_FAULT: &str = "stmt:fault";
pub const STMT_PROPERTY: &str = "stmt:property";

// ddl variants
pub const DDL_CREATE_TABLE: &str = "ddl:create-table";
pub const DDL_CREATE_INDEX: &str = "ddl:create-index";
pub const DDL_RENAME_TABLE: &str = "ddl:rename-table";
pub const DDL_DROP_TABLE: &str = "ddl:drop-table";
// H6 state arm: index-shape diversity + statistics + foreign-data state ops.
// "State op" = a DDL step whose point is to change what plans the planner can
// pick for LATER queries (an index, fresh statistics, a foreign table), not
// to be interesting by itself.
pub const DDL_CREATE_INDEX_MULTI: &str = "ddl:create-index-multi";
pub const DDL_CREATE_INDEX_EXPR: &str = "ddl:create-index-expr";
pub const DDL_CREATE_INDEX_PARTIAL: &str = "ddl:create-index-partial";
pub const DDL_CREATE_INDEX_BRIN: &str = "ddl:create-index-brin";
pub const DDL_DROP_INDEX: &str = "ddl:drop-index";
pub const DDL_ANALYZE: &str = "ddl:analyze";
/// BitmapAnd substrate chain: two single-column indexes on one table +
/// ANALYZE emitted as one decision (first statement traces this node; the
/// second and third trace ddl:create-index / ddl:analyze).
pub const DDL_INDEX_PAIR: &str = "ddl:index-pair";
// file_fdw foreign-table setup chain. One generator decision emits the whole
// chain as consecutive DDL steps (extension -> server -> csv COPY -> foreign
// table); each emitted statement gets its own trace node so statement/trace
// alignment holds. Later picks in the same plan skip the stages the session
// already has (IF NOT EXISTS keeps the SQL idempotent across seeds).
pub const DDL_FDW_EXTENSION: &str = "ddl:fdw-extension";
pub const DDL_FDW_SERVER: &str = "ddl:fdw-server";
pub const DDL_FDW_COPY: &str = "ddl:fdw-copy";
pub const DDL_FDW_TABLE: &str = "ddl:fdw-table";

// dml variants
pub const DML_INSERT: &str = "dml:insert";
pub const DML_UPDATE: &str = "dml:update";
pub const DML_DELETE: &str = "dml:delete";
pub const DML_TRUNCATE: &str = "dml:truncate";
/// H6: key-addressed MERGE (semantically a guarded UPDATE/DELETE — the
/// ledger-understood subset is preserved; ModifyTable Merge species reaches
/// the census through the DML explain gate).
pub const DML_MERGE: &str = "dml:merge";
/// H6 state arm: set-based INSERT ... SELECT over generate_series — the
/// cardinality lever (tiny/medium/larger tables make the planner cross its
/// seq-scan-vs-index cost thresholds).
pub const DML_BULK_INSERT: &str = "dml:bulk-insert";

// query variants (gen_query)
pub const Q_FULL_ORDERED: &str = "q:full-ordered";
pub const Q_COUNT_STAR: &str = "q:count-star";
pub const Q_EXACT_AGG: &str = "q:exact-agg";
pub const Q_FILTERED: &str = "q:filtered";
pub const Q_TOPK_LIMIT: &str = "q:topk-limit";
pub const Q_LIMIT_OFFSET: &str = "q:limit-offset";
pub const Q_GROUP_COUNT: &str = "q:group-count";
pub const Q_FLOAT_AGG: &str = "q:float-agg";
pub const Q_SRF_UNNEST: &str = "q:srf-unnest";
pub const Q_GENERATE_SERIES: &str = "q:generate-series";
pub const Q_SCALAR_CALL: &str = "q:scalar-call";
pub const Q_INNER_JOIN: &str = "q:inner-join";
pub const Q_LEFT_JOIN_COALESCE: &str = "q:left-join-coalesce";
pub const Q_OJ_NEST_COALESCE: &str = "q:oj-nest-coalesce";
// H6 state arm: query shapes that pay off once the state ops above ran.
/// ORDER BY <payload-col>, id — with an index on the payload column this is
/// the Incremental Sort elicitation shape (index gives the prefix order).
pub const Q_ORDER_PREFIX: &str = "q:order-prefix";
/// WHERE a = k1 AND b = k2 — with two single-column indexes + ANALYZE'd
/// stats this is the BitmapAnd elicitation shape.
pub const Q_TWO_COL_EQ: &str = "q:two-col-eq";
/// SELECT <col> ... WHERE <col> ... — projection covered by a single-column
/// index: the Index Only Scan elicitation shape.
pub const Q_COVERED_SELECT: &str = "q:covered-select";
/// SELECT over a file_fdw foreign table — the Foreign Scan elicitation shape.
pub const Q_FOREIGN_SCAN: &str = "q:foreign-scan";

// H6 grammar-arm query variants. Each name is one gen_query alternative;
// sub-variant nodes (children) follow each family below. All are plain
// differential reads (compared DUT-vs-C like every noise query — the H4
// join pattern: no ledger modeling, `ledger_op: None` when substituted
// into property noise slots).
pub const Q_EXISTS_SEMI: &str = "q:exists-semi";
pub const Q_NOT_EXISTS_ANTI: &str = "q:not-exists-anti";
pub const Q_IN_SUBQ: &str = "q:in-subq";
pub const Q_SCALAR_SUBQ: &str = "q:scalar-subq";
pub const Q_CTE_MATERIALIZED: &str = "q:cte-materialized";
pub const Q_CTE_RECURSIVE: &str = "q:cte-recursive";
pub const Q_SETOP: &str = "q:setop";
pub const Q_UNION_ALL_TOPK: &str = "q:union-all-topk";
pub const Q_HAVING: &str = "q:having";
pub const Q_GROUP_NOAGG: &str = "q:group-noagg";
pub const Q_DISTINCT: &str = "q:distinct";
pub const Q_DISTINCT_ON: &str = "q:distinct-on";
pub const Q_GROUPING_SETS: &str = "q:grouping-sets";
pub const Q_WINDOW: &str = "q:window";
pub const Q_VALUES_SCAN: &str = "q:values-scan";
pub const Q_SUBQUERY_SCAN
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #136** (2026-09-28): **wasix: run pgrust on the WASIX lane**
  *Symptoms*: ## Summary  This adds the WASIX lane that lets pgrust serve pgwire from a single WASIX guest instance: the postmaster hands each connection its own backend thread and takes a termination signal, which the existing `wasm32-wasip1` lane deliberately stubs out (no threads, no TCP, no epoll).  ## What this changes  WASIX socket / epoll / accept-loop and signal-handling changes across the postmaster and backend:  - `common/ip` (`lib.rs`, `sys.rs`, `Cargo.toml`): real socket + `getaddrinfo` path for WASIX. - `backend/libpq/pqcomm/socket.rs`, `postmaster/postmaster/{main_entry.rs,serverloop.rs}`, `postmaster/launch_backend`: threaded accept loop and per-connection backend spawn. - `storage/ipc/waiter`, `storage/ipc/waiteventset` (`epoll.rs`, `wasm_epoll.rs`): epoll-backed wait set for WASIX.  Guest-side compatibility fixes this port needed on WASIX:  - `port/pg_clock` (`posix.rs`): clockid ABI — a measured `CLOCK_*` mismatch on the guest. - `postmaster/launch_backend`: admission guard against the wasm32 linear-memory ceiling. - `postmaster/memwatchdog`: usage-basis fall-through so the watchdog is not blind in-guest. - `storage/buffer/bufmgr/read.rs`: a PG-faithful `AbortBufferIO` that falls through instead of panicking the postmaster.  ## Notes  - Bundled under `bench/` in this branch is the concurrency harness (`serve-and-bench.sh`, `pgwire_bench.py`) with a tunable worker/concurrency count. - This is the source of the packaged WASIX module; it is a fork branch, and I am open to wh
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Draft PR not reviewed >  > Draft PRs are not automatically reviewed by default. >  > - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> Trigger a manual review >  > To automatically review draft PRs, update your CodeRabbit configuration: >  > ```yaml > reviews: >   auto_review: >     drafts: true > ```  <!-- end of auto-generated comment: skip review by coderabbit.ai -->  <!-- tips_start -->  ---  Thanks for using [CodeRabbit](https://coderabbit.ai?utm_source=oss&utm_medium=github&utm_campaign=malisper/pgrust&utm_content=136)! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.  <details> <summary>❤️ Share</summary>  - [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27
  > Dropping this: the WASIX lane is meant to ship on the wasmer deployment (our repo will be forked for that, and the package is already published to wasmer.io), so it is not applicable to upstream pgrust, which is not wasmer-restricted. The branch stays available if that changes.

- **Issue #113** (2026-09-10): **EXPLAIN option `WAL` unsupported: `WAL needs pgWalUsage counters + show_wal_usage (xloginsert lane)`**
  *Symptoms*: # EXPLAIN option `WAL` unsupported: `WAL needs pgWalUsage counters + show_wal_usage (xloginsert lane)`  **pgrust version**: 0.2 (binary `pgrust-0.2-linux-x86_64`, PostgreSQL 18 compatible) **Component**: `ExplainOnePlan()` in `explain.c` (WAL usage instrumentation)  ## Summary  The `EXPLAIN (WAL)` option fails on every statement, including plain `SELECT`. PostgreSQL's EXPLAIN `WAL` option requires the `pgWalUsage` instrumentation counters collected in the xlog insert lane; pgrust does not expose them, and `ExplainOnePlan()` hard-errors instead of omitting the WAL section.  ## Reproducer  ```sql EXPLAIN (ANALYZE, WAL) SELECT 1; ```  Any statement type fails the same way (SELECT, INSERT, UPDATE, ...). Note: upstream PostgreSQL already requires `ANALYZE` before `WAL` is accepted (`EXPLAIN (WAL)` without `ANALYZE` is rejected by the parser), so the relevant case is `EXPLAIN (ANALYZE, WAL, ...)`, which on pgrust aborts during plan display.  ## Expected behaviour  On PostgreSQL 18.6 the same EXPLAIN prints a `WAL:` section on each plan node that generates WAL records, e.g.:  ```  Insert on events_fact  (cost=... )    WAL: records=4006 fpi=8 bytes=283985 ```  and a plain SELECT plan unchanged (with no WAL section).  ## Actual behaviour  ``` ERROR:  ExplainOnePlan (explain.c): WAL needs pgWalUsage counters + show_wal_usage (xloginsert lane) ```  No plan is printed for the statement.  ## Notes  - Blocks every EXPLAIN run that requests WAL — the entire plan is lost, not  just the WAL n
  **Post-Mortem & Fix Analysis**:
  > Fixed on current main: WalUsage counters are wired through xlog insert and `show_wal_usage` emits the `WAL:` line in text/JSON/YAML (PR #449). Covered by `fixtures/community-regress/sql/explain_analyze_wal.sql` and the `show_wal_usage_matches_c_shape` unit test. Closing.

- **Issue #112** (2026-09-10): **EXPLAIN ANALYZE fails on `INSERT ... ON CONFLICT`: `ON CONFLICT Tuples Inserted/Conflicting Tuples need ntuples2 accounting`**
  *Symptoms*: # EXPLAIN ANALYZE fails on `INSERT ... ON CONFLICT`: `ON CONFLICT Tuples Inserted/Conflicting Tuples need ntuples2 accounting`  **pgrust version**: 0.2 (binary `pgrust-0.2-linux-x86_64`, PostgreSQL 18 compatible) **Component**: `show_modifytable_info()` in `explain.c` (ModifyTable instrument, `ntuples2`)  ## Summary  `EXPLAIN ANALYZE` on any `INSERT ... ON CONFLICT` statement fails during plan display. pgrust's `show_modifytable_info()` needs the `ntuples2` accounting from `nodeModifyTable.c` instrumentation (tuples inserted vs. tuples that hit the conflict path) and that counter is not wired up, so EXPLAIN aborts instead of printing the plan.  ## Reproducer  ```sql CREATE TABLE t (id int PRIMARY KEY, v int); EXPLAIN (ANALYZE) INSERT INTO t (id, v) VALUES (1, 1) ON CONFLICT (id) DO UPDATE SET v = EXCLUDED.v; ```  Also reproduces with `ON CONFLICT DO NOTHING` — any `ON CONFLICT` clause is enough.  ## Expected behaviour  A normal query plan like PostgreSQL 18.6 produces, including a `Tuples Inserted` / `Tuples Conflicted` breakdown on the `Insert` node.  ## Actual behaviour  ``` ERROR:  show_modifytable_info (explain.c): ON CONFLICT Tuples Inserted/Conflicting Tuples need ntuples2 accounting nodeModifyTable instrument) ```  No plan is printed. There is no workaround — removing `ANALYZE` avoids the failure but then no execution stats (the reason you use `EXPLAIN ANALYZE`) appear.  ## Notes  - Independent of `VERBOSE`/`BUFFERS`/`WAL`; `ANALYZE` alone is sufficient. - Also breaks 
  **Post-Mortem & Fix Analysis**:
  > Fixed on current main: `nodemodifytable` counts conflicting tuples in `ntuples2` and EXPLAIN prints `Tuples Inserted` / `Conflicting Tuples` (PRs #1658, #1689). Covered by `scripts/nodemodifytable-audit-b014-e2e.sh` and `scripts/explain-remediation-b040-e2e.sh` (the issue's INSERT … ON CONFLICT DO UPDATE / DO NOTHING under EXPLAIN ANALYZE, byte-diffed against PostgreSQL 18). Closing.

- **Issue #111** (2026-09-10): **EXPLAIN VERBOSE fails on INSERT into an IDENTITY column table: `T_NextValueExpr deparse arm unported`**
  *Symptoms*: # EXPLAIN VERBOSE fails on INSERT into an IDENTITY column table: `T_NextValueExpr deparse arm unported`  **pgrust version**: 0.2 (binary `pgrust-0.2-linux-x86_64`, PostgreSQL 18 compatible) **Component**: `ruleutils.c` / `get_rule_expr()` deparse of `T_NextValueExpr`  ## Summary  `EXPLAIN VERBOSE` (with or without `ANALYZE`) errors out on any `INSERT` targeting a table with a `GENERATED ALWAYS AS IDENTITY` column, when the identity column is not listed in the INSERT's target list. PostgreSQL emits a `T_NextValueExpr` in the plan for the identity default and the pgrust deparse path for that node type is not ported (`arm unported`).  ## Reproducer  ```sql CREATE TABLE t (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, v int); EXPLAIN (VERBOSE) INSERT INTO t (v) VALUES (1); ```  Note: `serial` columns are NOT affected (deparse via DEFAULT nextval works); only `GENERATED AS IDENTITY` triggers the unported code path.  ## Expected behaviour  A normal query plan like PostgreSQL 18.6 produces, e.g.:  ```  Insert on t_identity  (cost=0.00..0.01 rows=0 width=0)    ->  Result  (cost=0.00..0.01 rows=1 width=8)          Output: nextval('t_identity_id_seq'::regclass), 1 ```  ## Actual behaviour  ``` ERROR:  ruleutils (get_rule_expr): T_NextValueExpr deparse arm unported ```  Workaround: re-run the EXPLAIN without `VERBOSE` (the plan prints, but the `Output:` line and any identity `nextval` expression are dropped from the output).  ## Notes  - Triggered regardless of `ANALYZE`/`BUFFERS`
  **Post-Mortem & Fix Analysis**:
  > Fixed on current main (PR #472, 2026-08-08): `get_rule_expr` deparses `NextValueExpr` as `nextval('seq')`, matching PostgreSQL 18.6 byte-for-byte (C's arm appends no `::regclass`; that form belongs to a serial column's DEFAULT). Pinned in `scripts/explain-verbose-e2e.sh` with EXPLAIN (VERBOSE) INSERT statements into GENERATED ALWAYS AS IDENTITY tables (VALUES, INSERT … SELECT … RETURNING) and a serial control, byte-diffed against C 18 — landing in Pager-Free/pgrust-fast#2062. Closing.

- **Issue #110** (2026-09-10): **`aclchk` does not detoast a compressed ACL: any privilege check on a function with ≥113 grantees fails**
  *Symptoms*: `catalog/aclchk`'s `with_acl_datum` reads a stored `aclitem[]` in place and raises on any varlena that is not plain, so once the toaster stores a catalog ACL compressed, every subsequent privilege check, `GRANT` and `REVOKE` against that object fails.  **Version:** `pgrust 0.2 (PostgreSQL 18.3 compatible)`, commit `d13d781fb9` (a spike branch on top of the public 0.2 tree; the affected code is unchanged from upstream). **Targets:** reproduced on `wasm32-wasip1-threads` (64-bit `Datum`, memory store) **and** on a native `x86_64-unknown-linux-gnu` `--host-pipes` build of the same commit. Not target-specific.  **Reproduction:**  ```sql DO $$ BEGIN   FOR i IN 1..113 LOOP     EXECUTE format('CREATE ROLE pgrust_repro_g%s', i);   END LOOP; END; $$;  CREATE FUNCTION public.pgrust_repro_f() RETURNS int LANGUAGE sql AS 'SELECT 1';  DO $$ BEGIN   EXECUTE 'GRANT EXECUTE ON FUNCTION public.pgrust_repro_f() TO '     || (SELECT string_agg(format('pgrust_repro_g%s', i), ', ') FROM generate_series(1, 113) AS i); END; $$;  SELECT has_function_privilege('pgrust_repro_g1', 'public.pgrust_repro_f()', 'EXECUTE') AS may_execute; ```  **Actual:**  ``` ERROR:  aclchk: compressed/external ACL varlena — detoast gap ```  ``` thread 'pg:backend:1031' panicked at crates/backend/catalog/aclchk/src/lib.rs:92:13: aclchk: compressed/external ACL varlena — detoast gap ```  **Expected** (PostgreSQL 18.3, and PGlite 0.5.5 which is PostgreSQL 18.3 compiled to wasm): one row, `t`.  **What is required to hit it**  
  **Post-Mortem & Fix Analysis**:
  > Verified fixed on current main. `with_acl_datum` (crates/backend/catalog/aclchk/src/lib.rs) detoasts compressed and external ACL datums before decoding, so every privilege check and grant path sees the full ACL.  Regression guard: `scripts/acl-compressed-e2e.sh` (landing in Pager-Free/pgrust-fast#2062). It creates 160 long-named roles, grants EXECUTE on a function and SELECT on a table to all of them so `pg_proc.proacl` and `pg_class.relacl` are pglz-compressed (asserted via `pg_column_compression`), then runs `has_function_privilege` / `has_table_privilege` for granted, ungranted and owner roles, `SET ROLE` + call/scan as a grantee, `aclexplode` counts, `pg_get_functiondef`, REVOKE / re-check / re-GRANT, and repeats the checks in a fresh session. pgrust's output is byte-identical to PostgreSQL 18 on the same data directory with no ERROR/panic (fleet job `pgrust-fast-tests-070ae96afe-1789010869-010b`).  Closing. 

- **Issue #109** (2026-09-10): **`exprType` is missing `T_NullIfExpr` and seven sibling families, so `NULLIF`, `GREATEST`, `IS NULL` and `AND` cannot be arguments of a `"any"` function**
  *Symptoms*: `funcapi`'s `expr_type` has no `T_NullIfExpr` arm, so any function that resolves its argument types through fmgr at run time — everything declared `"any"` or `VARIADIC "any"` — fails when one of its arguments is a `NULLIF` expression.  **Version:** `pgrust 0.2 (PostgreSQL 18.3 compatible)`, commit `d13d781fb9` (a spike branch on top of the public 0.2 tree; the affected code is unchanged from upstream). **Targets:** reproduced on `wasm32-wasip1-threads` (64-bit `Datum`, memory store) **and** on a native `x86_64-unknown-linux-gnu` `--host-pipes` build of the same commit. Not target-specific.  **Reproduction** — one statement, no DDL:  ```sql SELECT format('%s', NULLIF(g, 0)) AS out FROM generate_series(1, 1) AS g; ```  **Actual:**  ``` ERROR:  funcapi exprType: node family T_NullIfExpr not ported ```  ``` thread 'pg:backend:1031' panicked at crates/backend/utils/fmgr/funcapi/src/lib.rs:133:16: funcapi exprType: node family T_NullIfExpr not ported ```  **Expected** (PostgreSQL 18.3, and PGlite 0.5.5 which is PostgreSQL 18.3 compiled to wasm): one row, `1`.  **What is required to hit it**  - a function with a run-time-resolved argument type — `format`, `concat`, `concat_ws` and `json_build_object` all confirmed, and every other `"any"` / `VARIADIC "any"` function resolves the same way; - a `NULLIF` argument that is not constant-folded away. `generate_series` above is only there for that; a table column or a PL/pgSQL variable behaves the same, while `NULLIF('a'::text, '')` folds t
  **Post-Mortem & Fix Analysis**:
  > Fixed on current main: `funcapi` delegates argument typing to `nodes_core::node_funcs::expr_type`, which covers NullIfExpr and every family the issue lists (commit 77ab13c454b). Verified with the exact reproducer plus GREATEST/LEAST, IS NULL, AND/OR/NOT, CASE, COALESCE, ARRAY[], ROW(), IS TRUE, IS DISTINCT FROM, = ANY, a SubPlan, COLLATE and json_build_object through format('%s', …) and pg_typeof(): byte-identical to PostgreSQL 18 (`scripts/issue-repro-e2e.sh` in Pager-Free/pgrust-fast#2062, fleet job pgrust-fast-tests-4ff4d13feb-1789014409-2373). Closing.

- **Issue #108** (2026-09-06): **objkv 6/6: end-to-end shell harness**
  *Symptoms*: Stacked on #107 (objkv 5/6). _Stacked PR: GitHub shows the diff against `main`, which includes the lower layers until they merge. Review the **last commit only**, or the per-layer diff:_ https://github.com/brandonros/pgrust/compare/objkv/5-lift...objkv/6-e2e-harness  The scripts that drive a built server against an S3-compatible store, with `initdb` and `psql` on PATH. No Rust source changes beyond the `#[ignore]`d cargo wrapper.  - `tests/server.sh`: the environment (MinIO on :9000, the `OBJKV_S3_*` variables, a fresh data directory per script) and the helpers the scripts share; `bucket.py` lists and clears the bucket with SigV4. - `tests/run_all.sh` runs every script with a per-script timeout; `OBJKV_ONLY` / `OBJKV_SKIP` select, `OBJKV_TIMING=1` adds the load-sensitive timing checks. - Coverage: ordinary SQL, isolation (concurrency, snapshot timing, torn commits, group commit, last-commit re-read), indexes (ranges, IN lists, NULL search, DESC, partial and expression, bitmap, index-only), TRUNCATE, ALTER TABLE, ANALYZE, collection and snapshots surviving it, the lease and takeover, the lift, a stale lift, the OID floor after restore, and database scope. - `tests/e2e.rs` wraps `run_all.sh`: `cargo test -p objkv -- --ignored e2e`.  Known follow-up from the #92 review: `bucket.py` accepts any HTTP endpoint; it should require HTTPS off loopback unless explicitly opted out.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  <!-- This is an auto-generated comment: r
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/malisper/pgrust/pull/108)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The PR adds the ObjKV object-store table and index access methods. It implements immutable object storage, transactions, snapshots, leases, compaction, catalog lifting, PostgreSQL dispatch integration, configuration, documentation, and extensive unit and end-to-end tests.  ### Changes  **ObjKV storage engine**  |Layer / File(s)|Summary| |---|---| |**Object formats and storage** <br> `crates/_support/objkv/src/*`|Adds versioned keys, commit and run formats, Bloom filters, S3 access, leases, fault injection, and in-memory storage.| |**Table and transaction integration** <br> `crates/bac
  > @coderabbitai review
  > <!-- This is an auto-generated reply by CodeRabbit --> <!-- CodeRabbit review command invocation: v2:8fa707886b47b7bf986e5be62c034a49b2627f06ccf39a861802dc0337e6206e --> <details> <summary>✅ Action performed</summary>  Review finished.  > Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.  </details>

- **Issue #107** (2026-09-06): **objkv 5/6: lift the system catalogs into the bucket**
  *Symptoms*: Stacked on #106 (objkv 4/6). _Stacked PR: GitHub shows the diff against `main`, which includes the lower layers until they merge. Review the **last commit only**, or the per-layer diff:_ https://github.com/brandonros/pgrust/compare/objkv/4-index-am...objkv/5-lift  With the tables and indexes in the bucket, the catalogs can follow, after which a blank machine boots against it: `initdb`, put the marker back, set the S3 variables, start.  - `objkv_lift`: `objkv_lift_verify()` / `objkv_lift()` (superuser). The lift refuses, naming the offenders, when any user relation is not already objkv, any sequence exists, or any objkv row carries an external TOAST pointer. One database's catalogs are one commit object; the only local write is the marker file, by rename, at the end. - `objkv_marker`: the one-line file in the data directory saying the catalogs live in the bucket, readable before any catalog is, and the sentinel relam (`NAILED_AM`) the nailed catalogs carry in bucket mode. - `relcache`: `formrdesc` gives nailed catalogs that relam; the registry answers before `pg_am`, since `pg_am` is objkv too. - `postinit` registers the lifted AM oids before the first catalog opens. - `catalog_indexing`: `CatalogTupleInsert/Update/Delete` go through the table AM seams for objkv catalogs, with the cache invalidations heap used to send on the way past; a process that flipped while running refuses catalog writes until restart. - `genam`: `systable_inplace_update` on an objkv catalog is a new ver
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/malisper/pgrust/pull/107)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Team  **Run ID**: `dd13905e-ddc9-49dc-af9b-569b09effb40`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between d23621ffb2575a48b0a18eaeab2d4d1afbacc8c6 and cbcd57e1040f8c653aa5ffc8964b57ebe40e4e0a.  </details>  <details> <summary>⛔ Files ignored due to path filters (1)</summary>  * `Cargo.lock` is excluded by `!**/*.lock`  </details>  <details> 

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

### Incident Patch 1: `79ad992e` (2026-09-15)
**Commit Message**: v0.3: Try us on real world workloads in non-critical environments

The full commit history for this release is on the v0.3 release branch: https://github.com/malisper/pgrust/commits/v0.3

Co-Authored-By: Fable <noreply@anthropic.com>



#### Recent Merged Pull Requests:
- **PR #136** (closed): wasix: run pgrust on the WASIX lane (@UnitBuilds)
- **PR #108** (closed): objkv 6/6: end-to-end shell harness (@brandonros)
- **PR #107** (closed): objkv 5/6: lift the system catalogs into the bucket (@brandonros)
- **PR #106** (closed): objkv 4/6: the index access method (objkv_btree) (@brandonros)
- **PR #105** (closed): objkv 3/6: the table access method (CREATE TABLE ... USING objkv) (@brandonros)
- **PR #104** (closed): objkv 2/6: the database engine over the object store (@brandonros)
- **PR #103** (closed): objkv 1/6: object-store client, run format, key encodings, lease (@brandonros)
- **PR #102** (closed): session: re-derive the TLS census pin at main's tip (544 -> 545) (@brandonros)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
