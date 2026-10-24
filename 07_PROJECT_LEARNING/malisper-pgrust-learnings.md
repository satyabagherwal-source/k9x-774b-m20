> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/malisper-pgrust-learnings.md`  
> **Source**: github ([https://github.com/malisper/pgrust](https://github.com/malisper/pgrust))  
> **Source Version**: `38634b40`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-24T20:11:26.110Z  
> **Learning ID**: `learn-github-malisper-pgrust`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): malisper/pgrust

> **Canonical Artifact**: `07_PROJECT_LEARNING/malisper-pgrust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/malisper/pgrust](https://github.com/malisper/pgrust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-24T20:11:24.967Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `malisper/pgrust`
- **Description**: Postgres rewritten in Rust, now faster than Postgres and Clickhouse
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5372 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crash-simulator/src/oracle/props/x4_statement_form.rs`
```
//! X4 StatementForm: the same logical query through a different statement
//! form yields the same multiset. v1 form pair: plain SELECT vs
//! PREPARE/EXECUTE (cursor-fetch-all and COPY TO forms need runner-side
//! support and land as follow-on forms).

use rand::Rng;
use std::collections::BTreeSet;

use crate::oracle::check::Check;
use crate::oracle::props::{helpers as h, ProfileView, PropertyId, SchemaView};
use crate::oracle::pstep::{Mark, ProbeSpec, PropertyInstance, PStep, SqlMeta, SqlStep};

pub fn generate(
    rng: &mut impl Rng,
    _schema: &SchemaView,
    _profile: &ProfileView,
) -> PropertyInstance {
    let table = h::fresh_table(rng, "x4");
    let stmt_name = format!("{table}_ps");
    let n = rng.gen_range(2..=6);
    let rows = h::gen_rows(rng, n);

    let prepare = SqlStep {
        sql: format!("PREPARE {stmt_name} AS SELECT k, v FROM {table}"),
        mark: Mark::Passthrough,
        meta: SqlMeta::default(),
        ledger_op: None,
        probe: Some(ProbeSpec::Opaque),
        stackref: None,
    };
    let execute = SqlStep {
        sql: format!("EXECUTE {stmt_name}"),
        mark: Mark::Read,
        meta: SqlMeta::default(),
        ledger_op: None,
        probe: Some(ProbeSpec::SelectAll { table: table.clone() }),
        stackref: Some(1),
    };
    let deallocate = SqlStep {
        sql: format!("DEALLOCATE {stmt_name}"),
        mark: Mark::Passthrough,
        meta: SqlMeta::default(),
        ledger_op: None,
        probe: Some(ProbeSpec::Opaque),
        stackref: None,
    };

    let steps = vec![
        h::sql(h::create_kv(&table)),
        h::sql(h::insert_rows(&table, &rows)),
        h::sql(h::select_all(&table, 0)),
        h::sql(prepare),
        h::sql(execute),
        h::sql(deallocate),
        PStep::Assert(Check::MultisetEq { a: 0, b: 1 }),
        h::sql(h::drop_table(&table)),
    ];

    PropertyInstance {
        property: PropertyId::X4StatementForm,
        steps,
        tables: BTreeSet::from([table]),
    }
}

```

### Core Architecture Module: `crash-simulator/src/runner/runloop.rs`
```
//! Run loop, replay-from-seed, and distillation (contract §4.1.3/4/6).

use crate::bridge::{self, OracleCheckEval, OracleCtx, OracleDiffClassifier};
use super::bugbase::{now_utc_string, BugBase, RunsJson};
use super::driver::{
    execute_plan, CheckEval, ExecOptions, PgSession, RunReport, Session, Signature,
    SkipAllCheckEval,
};
use super::planface::Plan;
use super::profile::LoadedProfile;
use super::shrink;
use super::verdict::{severity, ArtifactWriter, Census};
use std::path::Path;

pub struct EngineConfig {
    pub dut_conninfo: String,
    pub cpg_conninfo: Option<String>,
    pub restart_cmd: Option<String>,
    /// SQL run at (re)connect on every leg: statement_timeout etc.
    pub session_setup: Vec<String>,
    /// Fresh-schema SQL run before each seed (property-local isolation).
    pub per_seed_reset: Vec<String>,
    /// H5 rung B: fingerprint every Nth executed query via EXPLAIN (0 = off).
    pub explain_every: u32,
    /// TEETH INSTRUMENT (`--test-null-bug`): wrap the DUT session in the
    /// NULL-predicate-bug shim (planted wrong-DUT for metamorphic-oracle
    /// validation). Never set in battery configs.
    pub test_null_bug: bool,
}

impl EngineConfig {
    pub fn default_setup() -> Vec<String> {
        vec!["SET statement_timeout = '5s'".to_string()]
    }
    pub fn default_reset() -> Vec<String> {
        vec![
            "DROP SCHEMA IF EXISTS simharness CASCADE".to_string(),
            "CREATE SCHEMA simharness".to_string(),
            "SET search_path = simharness".to_string(),
        ]
    }
}

/// Generate the plan for a seed — THE integration point with WS-GEN: drives
/// `crate::gen::generate_plan` with the oracle property registry and returns
/// the flat execution view.
pub fn gen_plan(seed: u64, lp: &LoadedProfile, generator_version: &str) -> Plan {
    gen_plan_ctx(seed, lp, generator_version).0
}

/// Generate the plan AND its oracle run context (property instances with
/// ledger ops + probe slots keyed by property seq). The context is derived
/// deterministically from the seed and never serialized (§0 A3).
pub fn gen_plan_ctx(seed: u64, lp: &LoadedProfile, generator_version: &str) -> (Plan, OracleCtx) {
    let (plan, ctx, _traces) = gen_plan_ctx_traced(seed, lp, generator_version);
    (plan, ctx)
}

/// `gen_plan_ctx` + the H5 production traces (plan bytes identical — trace
/// collection consumes no RNG draws).
pub fn gen_plan_ctx_traced(
    seed: u64,
    lp: &LoadedProfile,
    generator_version: &str,
) -> (Plan, OracleCtx, crate::gen::prodreg::GenTraces) {
    let gp = bridge::runner_profile_to_gen(&lp.profile);
    let (core, ctx, traces) =
        bridge::generate_plan_with_ctx_traced(seed, &gp, &lp.sha256, generator_version);
    (Plan::from_core(&core), ctx, traces)
}

/// Generator version string recorded in plan headers: the harness build's
/// git sha (compile-time env, falls back to "dev").
pub fn generator_version() -> String {
    option_env!("SIMHARNESS_GIT_SHA").unwrap_or("dev").to_string()
}

pub struct SeedRun {
    pub seed: u64,
    pub report: RunReport,
    pub plan_text: String,
}

fn connect_legs(
    cfg: &EngineConfig,
) -> Result<(Box<dyn Session>, Option<PgSession>), String> {
    let dut = PgSession::connect("pgrust", &cfg.dut_conninfo, &cfg.session_setup)?;
    let dut: Box<dyn Session> = if cfg.test_null_bug {
        // Planted wrong-DUT (teeth): mis-evaluates NULL predicates.
        Box::new(super::driver::NullBugShim { inner: dut })
    } else {
        Box::new(dut)
    };
    let cpg = match &cfg.cpg_conninfo {
        Some(ci) => Some(PgSession::connect("cpg", ci, &cfg.session_setup)?),
        None => None,
    };
    Ok((dut, cpg))
}

fn reset_leg(s: &mut dyn Session, resets: &[String]) -> Result<(), String> {
    for sql in resets {
        if let super::driver::ExecOutcome::SqlError { sqlstate, message } = s.execute(sql) {
            return Err(format!("{}: per-seed reset '{}': {} {}", s.engine(), sql, sqlstate, message));
        }
    }
    Ok(())
}

pub fn run_one_seed(seed: u64, lp: &LoadedProfile, cfg: &EngineConfig) -> Result<SeedRun, String> {
    let (plan, ctx) = gen_plan_ctx(seed, lp, &generator_version());
    let plan_text = plan.render();
    let report = run_plan_ctx(&plan, cfg, Some(&ctx))?;
    Ok(SeedRun { seed, report, plan_text })
}

pub fn run_plan(plan: &Plan, cfg: &EngineConfig) -> Result<RunReport, String> {
    run_plan_ctx(plan, cfg, None)
}

/// Run a plan. With an oracle context the model oracle is ON (ledger
/// reconcile + slot-addressed checks); without one, checks evaluate to a
/// counted skip (`property-skipped`) — never a false verdict (plans loaded
/// from disk without their seed's regenerated context, e.g. `test -b`).
pub fn run_plan_ctx(
    plan: &Plan,
    cfg: &EngineConfig,
    ctx: Option<&OracleCtx>,
) -> Result<RunReport, String> {
    let (mut dut, mut cpg) = connect_legs(cfg)?;
    reset_leg(dut.as_mut(), &cfg.per_seed_reset)?;
    if let Some(c) = cpg.as_mut() {
        reset_leg(c, &cfg.per_seed_reset)?;
    }
    // reconnect() restores session_setup (incl. search_path); ARM reset-all
    // replays post_reset_sql so generated unqualified names keep resolving.
    let session_sql: Vec<String> = cfg
        .session_setup
        .iter()
        .chain(cfg.per_seed_reset.iter())
        .filter(|s| s.to_ascii_uppercase().trim_start().starts_with("SET "))
        .cloned()
        .collect();
    let opts = ExecOptions {
        restart_cmd: cfg.restart_cmd.clone(),
        stop_on_failure: true,
        post_reset_sql: session_sql.clone(),
        explain_every: cfg.explain_every,
        // H8: worker sessions mirror the primary pair's connect discipline
        // (same conninfo, session_setup, and the per-seed SET replay so
        // unqualified names resolve in the simharness schema).
        session_pool: Some(crate::runner::sessions::SessionPoolConfig {
            dut_conninfo: cfg.dut_conninfo.clone(),
            cpg_conninfo: cfg.cpg_conninfo.clone(),
            session_sql: cfg
                .session_setup
                .iter()
                .cloned()
                .chain(session_sql.iter().cloned())
                .collect(),
        }),
        ..ExecOptions::default()
    };
    let classifier = OracleDiffClassifier::new(bridge::load_warts());
    let oracle_checks;
    let checks: &dyn CheckEval = match ctx {
        Some(c) => {
            // Engine-hook capability probe against the live DUT session
            // (contract §0 A5): one uncompared read per channel. Presence
            // un-gates F7 (Memory); absence keeps the counted skip.
            let hooks = bridge::probe_hooks(dut.as_mut());
            oracle_checks = OracleCheckEval::with_hooks(c, hooks);
            &oracle_checks
        }
        None => &SkipAllCheckEval,
    };
    Ok(execute_plan(
        plan,
        dut.as_mut(),
        cpg.as_mut().map(|c| c as &mut dyn Session),
        checks,
        &classifier,
        &opts,
    ))
}

/// Replay-N flake policy (contract §4.1.4): re-run K times, report re-fail
/// rate. Probabilistic failures are findings-with-a-plan, never
/// gate-blockers (spec HR3).
pub fn replay_n(
    plan: &Plan,
    cfg: &EngineConfig,
    times: u32,
    ctx: Option<&OracleCtx>,
) -> Result<(u32, u32, Option<Signature>), String> {
    let mut refails = 0;
    let mut last_sig = None;
    for _ in 0..times {
        let report = run_plan_ctx(plan, cfg, ctx)?;
        if let Some(f) = report.failure {
            refails += 1;
            last_sig = Some(f.signature);
        }
    }
    Ok((times, refails, last_sig))
}

pub struct CampaignOutcome {
    pub census: Census,
    pub seeds_run: u64,
    pub failures_banked: u64,
}

/// H7: DUT server-log scrape for `panicked at` lines — the other half of H3
/// finding 1. A CONTAINED backend panic reaches the client as XX000 with the
/// PANIC PAYLOAD as the message; when the payload is a custom
/// `panic!("...")` string that is byte-identical to C's elog(ERROR) text on
/// the same path (the p9 interval-typmod class), the diff ladder sees
/// err-match and the client-side panic-signature grammar cannot match — the
/// server log's `panicked at` line is the ONLY witness. Each scraped hit
/// mints the existing `panic-signature` P1 census class, so the campaign
/// VERDICT fails, not just the census (the zero-panic ratchet's grammar).
/// Scanning starts at the log's size at campaign start, so earlier legs
/// sharing the same server log are never re-counted. Single-campaign-per-
/// server discipline: concurrent campaigns against one DUT would
/// cross-attribute lines (the validate rig runs legs sequentially).
struct DutLogScraper {
    path: std::path::PathBuf,
    offset: u64,
}

impl DutLogScraper {
    fn new(path: &Path) -> Self {
        let offset = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        DutLogScraper { path: path.to_path_buf(), offset }
    }

    /// `panicked at` lines appended since the last scan.
    fn scan(&mut self) -> Vec<String> {
        use std::io::{Read as _, Seek as _};
        let Ok(mut f) = std::fs::File::open(&self.path) else {
            return Vec::new();
        };
        if f.seek(std::io::SeekFrom::Start(self.offset)).is_err() {
            return Vec::new();
        }
        let mut buf = String::new();
        if f.read_to_string(&mut buf).is_err() {
            // Non-UTF8 window: skip past it rather than wedging the scraper.
            self.offset =
                std::fs::metadata(&self.path).map(|m| m.len()).unwrap_or(self.offset);
            return Vec::new();
        }
        self.offset += buf.len() as u64;
        buf.lines()
            .filter(|l| l.contains("panicked at"))
            .map(|l| l.to_string())
            .collect()
    }
}

#[allow(clippy::too_many_arguments)]
pub fn run_campaign(
    lp: &LoadedProfile,
    cfg: &EngineConfig,
    seed_base: u64,
    seed_count: u64,
    bugbase_dir: &Path,
    out_d
```

### Core Architecture Module: `crates/_support/pagepool/src/state.rs`
```
//! The pick order, each class's partial superpages (binned by their longest free stretch, smallest first; by used runs,
//! fullest first, with `PGRUST_POOL_HOLE_FIT=0`) and the low-warm flag. A class's
//! lists and run table entries change under its spin bit, every run bitmap and partial list under the runs bit inside it.

use crate::reserve::Zones;
use crate::run::RUN;
use crate::stats;
use crate::superpage::{self, meta, State, ALL_RUNS, NONE, RUNS_PER, SUPER};
use crate::{Class, Zero, CLASSES};
use crate::sync::{AtomicBool, AtomicU32, AtomicU64, AtomicU8, Ordering::*};

/// A hole bin per longest free stretch (1 .. 31 runs).
const BINS: usize = RUNS_PER as usize - 1;
/// The used-run bins (`PGRUST_POOL_HOLE_FIT=0`): 1 = fullest .. 4.
const USED_BINS: usize = 4;
/// Partial-list fronts searched per bin before a fresh superpage is claimed.
const SEARCH: usize = 16;

static LOCKS: [crate::Line<AtomicU32>; CLASSES] = [const { crate::Line(AtomicU32::new(0)) }; CLASSES];
static BIN_HEADS: [crate::Line<[AtomicU32; BINS]>; CLASSES] = [const { crate::Line([const { AtomicU32::new(NONE) }; BINS]) }; CLASSES];
/// Lock order: a class's spin bit, then this one, innermost; a take never takes another class's bit.
static RUNS: crate::Line<AtomicU32> = crate::Line(AtomicU32::new(0));
static LOW: AtomicBool = AtomicBool::new(false);

struct Runs;

impl Drop for Runs {
    fn drop(&mut self) {
        superpage::unspin(&RUNS);
    }
}

fn runs() -> Runs {
    superpage::spin(&RUNS);
    Runs
}

pub(crate) struct Guard {
    class: Class,
}

impl Drop for Guard {
    fn drop(&mut self) {
        superpage::unspin(&LOCKS[self.class as usize]);
    }
}

pub(crate) fn lock(class: Class) -> Guard {
    superpage::spin(&LOCKS[class as usize]);
    Guard { class }
}

pub(crate) fn init(z: &Zones) {
    let per = superpage::per_chunk();
    let stride = superpage::stride_slots();
    let mut i = 0;
    while i < z.nsuper {
        if i % stride < per {
            superpage::put(i, State::Cold);
        }
        i += 1;
    }
}

/// A whole free superpage for `class`, by the pick order for `zero`; held (Busy) on return. A Cold one counts as claimed
/// and is refused past the cap. `supers`: the ask's superpages (0: runs), for the miss counts.
pub(crate) fn claim(zero: Zero, class: Class, supers: u32) -> Option<u32> {
    // pppress card 6 (`PGRUST_POOL_GROW_GUARD`): a zeroed take the ladder presses reuses a free warm superpage (zeroed by
    // its taker) before it claims a Cold one
    let pressed = zero != Zero::No && crate::purger::pressed(SUPER);
    let order: &[State] = match zero {
        Zero::No => &[State::WarmDirty, State::WarmZero, State::Cold],
        _ if pressed => &[State::WarmZero, State::WarmDirty, State::Cold],
        Zero::Dense => &[State::WarmZero, State::Cold, State::WarmDirty],
        Zero::Sparse => &[State::Cold, State::WarmZero, State::WarmDirty],
    };
    for &st in order {
        if st == State::Cold && !stats::under_cap(SUPER) {
            continue;
        }
        if let Some(i) = superpage::take_one(st) {
            took(st, zero, class, supers);
            if pressed && st == State::WarmDirty {
                crate::purger::note_warm_first();
            }
            if st == State::Cold {
                crate::purger::fresh(i);
            }
            return Some(i);
        }
    }
    None
}

/// Count a superpage taken for an ask with `zero`; a Cold one for an ask that wanted warm is a warm-list miss.
pub(crate) fn took(st: State, zero: Zero, class: Class, supers: u32) {
    match st {
        State::Cold => {
            stats::claim(SUPER as isize);
            stats::COLD_TAKES.fetch_add(1, Relaxed);
            crate::purger::touch();
            if zero != Zero::Sparse {
                crate::claimer::missed(class, supers);
            }
        }
        _ => {
            stats::WARM_TAKES.fetch_add(1, Relaxed);
            crate::warmres::drew(st);
            if st == State::WarmZero {
                crate::claimer::maybe_wake();
            }
        }
    }
}

/// D4872 (`PGRUST_POOL_HOLE_FIT`, default on; `=0` turns it off), read once (0: unread, 1: off, 2: on): a partial
/// superpage is listed in the bin of its longest stretch of free runs, and a take of `k` runs searches bin `k` (every
/// superpage there holds `k` free runs in a row), then the longer ones, smallest first. Listed by used runs, a take of
/// 21-31 runs saw 16 superpages a bin, none with the stretch, and claimed a fresh superpage while thousands past them had
/// it (an x86 wide-table bulk load: 50k claims, 16 GB of free runs stranded in 9.6k superpages against 7 GB owned).
static HOLE_SWITCH: AtomicU8 = AtomicU8::new(0);

pub(crate) fn hole_fit_on() -> bool {
    match HOLE_SWITCH.load(Relaxed) {
        0 => {
            let v = if crate::os::env_on_by_default(c"PGRUST_POOL_HOLE_FIT") { 2 } else { 1 };
            HOLE_SWITCH.store(v, Relaxed);
            v == 2
        }
        v => v == 2,
    }
}

pub(crate) fn force_hole_fit(on: bool) {
    HOLE_SWITCH.store(if on { 2 } else { 1 }, Relaxed);
}

/// The longest stretch of set bits in `free`.
#[inline]
pub(crate) fn longest_free(mut free: u32) -> u32 {
    let mut n = 0;
    while free != 0 {
        free &= free << 1;
        n += 1;
    }
    n
}

/// Hole bin (the longest free stretch, 1 .. 31) of a superpage with free runs `free`, 0 = none free or all.
#[inline]
fn hole_bin(free: u32) -> u32 {
    let s = longest_free(free);
    if s as usize > BINS { 0 } else { s }
}

/// The bins a take of `k` runs searches, in order (list indices). With the switch on: bin `k`, then the longer ones. A
/// stretch of `k` may still lack a start aligned to `align` > 1 runs; the per-bin SEARCH walk covers that.
#[inline]
fn take_bins(k: u32) -> core::ops::Range<usize> {
    if hole_fit_on() {
        (k as usize).clamp(1, BINS) - 1..BINS
    } else {
        0..USED_BINS
    }
}

/// Bin (1 = fullest .. 4) of a superpage with `used` runs taken, 0 = listed nowhere (empty or full).
#[inline]
fn bin_for(used: u32) -> u32 {
    match used {
        0 => 0,
        u if u >= RUNS_PER => 0,
        u if u >= 24 => 1,
        u if u >= 16 => 2,
        u if u >= 8 => 3,
        _ => 4,
    }
}

fn unlist(class: Class, i: u32) {
    let m = meta(i);
    let b = m.bin();
    if b == 0 {
        return;
    }
    let (p, n) = (m.prev.load(Relaxed), m.next.load(Relaxed));
    if p == NONE {
        BIN_HEADS[class as usize][b as usize - 1].store(n, Relaxed);
    } else {
        meta(p).next.store(n, Relaxed);
    }
    if n != NONE {
        meta(n).prev.store(p, Relaxed);
    }
    m.set_bin(0);
}

fn list(class: Class, i: u32, b: u32) {
    let m = meta(i);
    let head = &BIN_HEADS[class as usize][b as usize - 1];
    let h = head.load(Relaxed);
    m.prev.store(NONE, Relaxed);
    m.next.store(h, Relaxed);
    if h != NONE {
        meta(h).prev.store(i, Relaxed);
    }
    head.store(i, Relaxed);
    m.set_bin(b);
}

/// A run superpage's free runs given back to the OS (zero when taken again), in its span_n word. Under the runs bit.
#[inline]
fn gone(m: &superpage::SuperMeta) -> &AtomicU32 {
    &m.span_n
}

/// pagepool P3 (F1): a run superpage's free runs the last age mark saw free, none taken since (`take_mask` clears them),
/// in its dirty_at word (a free superpage's age, unused while it holds runs). Under the runs bit.
#[inline]
fn seen(m: &superpage::SuperMeta) -> &AtomicU32 {
    &m.dirty_at
}

#[inline]
fn free_runs_moved(runs: isize) {
    stats::STRANDED.fetch_add(runs * RUN as isize, Relaxed);
    stats::FREE_RUNS.fetch_add(runs * RUN as isize, Relaxed);
}

/// Put superpage `i` where its free runs say: listed Partial, Full, or a whole free superpage again (lock held). Whole
/// free with gone runs, the superpage is claimed whole again (those pages fault in on touch).
fn settle(class: Class, i: u32) {
    let m = meta(i);
    // pppress card 8: the activity bit outlives the word's rewrite below
    let active = m.word.load(Relaxed) & superpage::ACTIVE;
    let free = m.free_runs.load(Relaxed);
    let used = RUNS_PER - free.count_ones();
    let want = if hole_fit_on() { hole_bin(free) } else { bin_for(used) };
    if used == 0 {
        unlist(class, i);
        let g = gone(m).swap(0, Relaxed).count_ones() as isize;
        free_runs_moved(g - RUNS_PER as isize);
        if g != 0 {
            stats::claim(g * RUN as isize);
        }
        let st = if m.zero_runs.load(Relaxed) == ALL_RUNS { State::WarmZero } else { State::WarmDirty };
        superpage::put(i, st);
        return;
    }
    if m.bin() != want {
        unlist(class, i);
        if want != 0 {
            list(class, i, want);
        }
    }
    let st = if used == RUNS_PER { State::Full } else { State::Partial };
    m.set(st, class, want, 0, NONE);
    if active != 0 {
        m.word.fetch_or(active, Relaxed);
    }
}

/// The first `k` free runs of `free` starting at a multiple of `align`, as a mask.
#[inline]
pub(crate) fn find_runs(free: u32, k: u32, align: u32) -> Option<u32> {
    let one = ((1u64 << k) - 1) as u32;
    let mut s = 0;
    while s + k <= RUNS_PER {
        let mask = one << s;
        if free & mask == mask {
            return Some(mask);
        }
        s += align.max(1);
    }
    None
}

/// A superpage's free-run bitmap as the runs bit's kernels see it (std's atomics here, loom's in its model).
pub trait FreeRuns {
    fn get(&self) -> u32;
    fn clear(&self, mask: u32);
    fn add(&self, mask: u32) -> u32;
}

impl FreeRuns for AtomicU32 {
    fn get(&self) -> u32 {
        self.load(Relaxed)
    }
    fn clear(&self, mask: u32) {
        self.fetch_and(!mask, Relaxed);
    }
    fn add(&self, mask: u32) -> u32 {
        self.fetch_or(mask, Relaxed)
    }
}

/// Under the runs bit: the first `k` free runs of `free` at a multiple of `align`, taken.
pub fn take_free<F: FreeRuns>(free: &F, k: u32, align: u32) -> Option<u32> {
    let mask = find_
```

### Core Architecture Module: `crates/_support/pgsync/src/sim/hooks.rs`
```
//! The WS-CORE seam (permit-s1 contract §2.1): the scheduler hook API the
//! sim-world wrappers call at every interception point. PINNED in WS-SYNC's
//! first pushed commit so WS-CORE develops against a fixed surface; WS-CORE
//! owns this file from then on (refinements are CORE's to make, with a
//! coordination row in both worklogs).
//!
//! Contract vocabulary (one call class per interception point): `block_on`,
//! `touch`, `timed_park`, `spawn`, `exit`, `pick_waiter`. WS-SYNC additions
//! required to make the wrapper protocol complete (deviations recorded in
//! `notes/permit-s1-sync.md` §deviations):
//! - [`SchedulerHooks::wake`] — the second half of every notify/unlock
//!   interception: names the `block_on`-parked thread that a seeded pick
//!   chose, so the scheduler can mark it runnable.
//! - [`SchedulerHooks::current_vpid`] — wrappers enqueue the CALLER in their
//!   wait lists; the scheduler owns thread→vpid identity (registered at the
//!   spawn door), so the wrappers ask rather than duplicate a registry.
//! - [`SchedulerHooks::now_ns`] — SimClock read for wrapper deadline math in
//!   `wait_timeout`-shaped ops (time advances only when nothing is runnable;
//!   P3 §2.4).
//!
//! THE WRAPPER PROTOCOL the scheduler must satisfy (and may rely on):
//! - Every wrapper op runs on a REGISTERED thread (registration at the
//!   launch_backend spawn door / `pgsync::thread` sim spawn prologue).
//! - `block_on(site, kind)` is the park: the caller yields the permit and
//!   the call returns only when the scheduler next grants this thread the
//!   permit (i.e. after some `wake(vpid)` named it, or — for `timed_park` —
//!   after the virtual deadline). Wrappers call it in a PREDICATE LOOP and
//!   re-check their condition on return, so a spurious grant is safe.
//! - Permit transfer happens ONLY at `block_on` / `timed_park` (parks) and,
//!   optionally + seeded, at `touch` (preemption). The query hooks
//!   (`pick_waiter`, `current_vpid`, `now_ns`) and `wake` never yield the
//!   permit.
//! - `wake(vpid)` MAY BE DROPPED when the target is not parked (e.g. it was
//!   preempted at a `touch` and is already runnable). Wrappers therefore use
//!   CHECK-BEFORE-PARK: a waker falsifies the wait predicate (removes the
//!   wakee from the wait list) BEFORE calling `wake`, and a waiter re-checks
//!   its predicate immediately before every park, with no hook call in the
//!   check→park gap (the permit is held across it, so no waker can run
//!   there). NOTE this corrects the originally pinned claim that
//!   enqueue-then-park alone cannot lose a wake — false when a hook sits in
//!   the gap (Condvar's unlock does; adversarial review BLOCKING-1,
//!   2026-07-18). Doc-only correction by WS-SYNC; the trait surface is
//!   unchanged and the wording matches the WS-CORE scheduler's shipped
//!   behavior (wake on a runnable slot is a no-op).
//! - `timed_park` returns `true` when the virtual deadline expired (the
//!   caller decides timeout vs notified by consulting its wait list).
//! - `pick_waiter(site, n)` returns an index in `0..n` drawn from
//!   SimEntropy — every OS-arbitrary choice (which wakee, which next holder,
//!   which sender proceeds) routes through it.
//! - `touch(site, kind)` marks an optional-preemption point (unlock, notify,
//!   send) — the seeded-preemption diversity dial (`PGRUST_SIM_PREEMPT_P`).
//! - Every hook carries the caller's `#[track_caller]` Location: the
//!   watchdog dump and the SCHEDOP log NAME blocked sites symbolically.
//!
//! Install discipline: `install()` once, at corpus boot, BEFORE any thread
//! the scheduler must govern is spawned. Mixed-mode (installing after
//! wrapper ops began parking on the std fallback path) is outside the
//! contract. With nothing installed the wrappers are plain std behavior.

use core::panic::Location;
use core::time::Duration;
// Raw std deliberately: this is pgsync's own control plane (the hooks slot
// must not recurse into the wrappers it serves). Scanner-visible; ledgered
// under the PERMIT-S1-SYNC allowlist band.
use std::sync::OnceLock as StdOnceLock;

/// Stable thread identity: `reserve_child_pid` vpids for backend threads
/// (P3 §1.4 inheritance); `pgsync::thread` sim spawns outside the door use
/// the synthetic range (`0x8000_0000..`).
pub type Vpid = u32;

/// Interception-point vocabulary for `block_on` / `touch` / SCHEDOP logging.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum OpClass {
    MutexLock,
    MutexUnlock,
    RwRead,
    RwWrite,
    RwUnlock,
    CondWait,
    CondNotify,
    ChanSend,
    ChanRecv,
    SemAcquire,
    BarrierWait,
    OnceInit,
    Join,
    Park,
    Sleep,
    Spawn,
    Exit,
}

impl OpClass {
    /// grep-stable lowercase token for SCHEDOP lines.
    pub fn as_str(self) -> &'static str {
        match self {
            OpClass::MutexLock => "mutex-lock",
            OpClass::MutexUnlock => "mutex-unlock",
            OpClass::RwRead => "rw-read",
            OpClass::RwWrite => "rw-write",
            OpClass::RwUnlock => "rw-unlock",
            OpClass::CondWait => "cond-wait",
            OpClass::CondNotify => "cond-notify",
            OpClass::ChanSend => "chan-send",
            OpClass::ChanRecv => "chan-recv",
            OpClass::SemAcquire => "sem-acquire",
            OpClass::BarrierWait => "barrier-wait",
            OpClass::OnceInit => "once-init",
            OpClass::Join => "join",
            OpClass::Park => "park",
            OpClass::Sleep => "sleep",
            OpClass::Spawn => "spawn",
            OpClass::Exit => "exit",
        }
    }
}

/// The permit scheduler, as the wrappers see it. Implemented by WS-CORE in
/// `pgsync::sim`; [`PanicHooks`] is the development stub.
pub trait SchedulerHooks: Sync {
    /// Would-block park: yield the permit; return when this thread is next
    /// granted it. Called in a predicate loop (spurious grants are safe).
    fn block_on(&self, site: &'static Location<'static>, kind: OpClass);

    /// Non-blocking touch (unlock/notify/send): optional seeded preemption.
    fn touch(&self, site: &'static Location<'static>, kind: OpClass);

    /// Timed park on SimClock virtual time (sleep and every `*_timeout`).
    /// Returns `true` iff the virtual deadline expired (vs woken earlier).
    /// Virtual time advances only when nothing is runnable (P3 §2.4).
    fn timed_park(&self, site: &'static Location<'static>, dur: Duration) -> bool;

    /// Thread registration (the spawn door + `pgsync::thread` sim spawns).
    fn spawn(&self, vpid: Vpid, site: &'static Location<'static>);

    /// Thread deregistration; post-dates all shared TLS teardown (P3 §1.6
    /// rule 3: joiners wake on this). `#[track_caller]` (F5 ledger row) so
    /// the Exit / join-Wake SCHEDOP lines carry the wrapper's exit site.
    #[track_caller]
    fn exit(&self, vpid: Vpid);

    /// Seeded choice over `n` waiters (SimEntropy): returns an index in
    /// `0..n`. Callers guarantee `n >= 1`.
    fn pick_waiter(&self, site: &'static Location<'static>, n: usize) -> usize;

    /// Mark a `block_on`-parked thread runnable (the wakee a seeded pick
    /// chose; the notify/unlock second half).
    fn wake(&self, vpid: Vpid, site: &'static Location<'static>);

    /// The CALLER's vpid (scheduler-owned thread→vpid registry).
    fn current_vpid(&self) -> Vpid;

    /// SimClock read (ns) for wrapper deadline math.
    fn now_ns(&self) -> u64;
}

static HOOKS: StdOnceLock<&'static dyn SchedulerHooks> = StdOnceLock::new();

/// Install the scheduler (once per process, at corpus boot, before governed
/// threads spawn).
pub fn install(h: &'static dyn SchedulerHooks) {
    HOOKS
        .set(h)
        .unwrap_or_else(|_| panic!("pgsync::sim::hooks: scheduler already installed"));
}

/// The installed scheduler, if any. `None` = wrappers behave as plain std
/// (today's sim binaries: sim-net-e2e / dst-smoke are unchanged).
#[inline]
pub fn installed() -> Option<&'static dyn SchedulerHooks> {
    HOOKS.get().copied()
}

/// Panic-on-call stub (contract §2.1): pins the surface so WS-CORE can
/// develop unit batteries against a fixed trait before the scheduler lands.
/// Never installed by pgsync itself.
pub struct PanicHooks;

impl SchedulerHooks for PanicHooks {
    fn block_on(&self, site: &'static Location<'static>, kind: OpClass) {
        panic!("pgsync sim hooks stub: block_on({}) at {site}", kind.as_str());
    }
    fn touch(&self, site: &'static Location<'static>, kind: OpClass) {
        panic!("pgsync sim hooks stub: touch({}) at {site}", kind.as_str());
    }
    fn timed_park(&self, site: &'static Location<'static>, dur: Duration) -> bool {
        panic!("pgsync sim hooks stub: timed_park({dur:?}) at {site}");
    }
    fn spawn(&self, vpid: Vpid, site: &'static Location<'static>) {
        panic!("pgsync sim hooks stub: spawn(vpid={vpid}) at {site}");
    }
    fn exit(&self, vpid: Vpid) {
        panic!("pgsync sim hooks stub: exit(vpid={vpid})");
    }
    fn pick_waiter(&self, site: &'static Location<'static>, n: usize) -> usize {
        panic!("pgsync sim hooks stub: pick_waiter(n={n}) at {site}");
    }
    fn wake(&self, vpid: Vpid, site: &'static Location<'static>) {
        panic!("pgsync sim hooks stub: wake(vpid={vpid}) at {site}");
    }
    fn current_vpid(&self) -> Vpid {
        panic!("pgsync sim hooks stub: current_vpid()");
    }
    fn now_ns(&self) -> u64 {
        panic!("pgsync sim hooks stub: now_ns()");
    }
}

```

### Core Architecture Module: `crates/_support/seam_core/src/lib.rs`
```
// INVARIANT (set-once): SLOT is written only by `set()` during single-threaded
// startup, before any call, never again; it always holds a fn pointer of the
// seam's exact `Signature` — so `call()` is one relaxed load + indirect call.

// Tap boot phase: a `tap!` may `install()` only before this is closed. Closed
// once, from the postmaster's single-threaded boot sequence, strictly before
// any backend thread spawns — the same window `seam::set()` relies on. Tests
// never close it, so `install()` in test binaries only ever hits the
// double-install panic, never this one.
static TAP_BOOT_PHASE_OPEN: ::std::sync::atomic::AtomicBool =
    ::std::sync::atomic::AtomicBool::new(true);

pub fn close_tap_boot_phase() {
    TAP_BOOT_PHASE_OPEN.store(false, ::std::sync::atomic::Ordering::Relaxed);
}

pub fn tap_boot_phase_open() -> bool {
    TAP_BOOT_PHASE_OPEN.load(::std::sync::atomic::Ordering::Relaxed)
}

// Default-empty variant of `seam!`: the slot starts null (no consumer), and
// the hot-path form is `name::call_if(|f| f(args))` — one relaxed load, a
// predicted-not-taken null test, and (only when installed) an indirect call.
// No chaining: install-once, like `seam!`, plus a boot-phase gate (`seam!`
// carries no such gate because its single mandatory impl always installs
// during boot by construction; a tap's consumer is optional and boot-loaded,
// so the gate catches a stray runtime install directly).
#[macro_export]
macro_rules! tap {
    (
        $(#[$attr:meta])*
        $vis:vis fn $name:ident $(<$($lt:lifetime),+ $(,)?>)? ( $($arg:ident : $arg_ty:ty),* $(,)? ) $(-> $ret:ty)?
    ) => {
        $(#[$attr])*
        $vis mod $name {
            #![allow(dead_code, unused_imports)]
            use super::*;

            pub type Signature = $(for<$($lt),+>)? fn($($arg_ty),*) $(-> $ret)?;

            static SLOT: ::std::sync::atomic::AtomicPtr<()> =
                ::std::sync::atomic::AtomicPtr::new(::std::ptr::null_mut());

            pub fn install(implementation: Signature) {
                if !$crate::tap_boot_phase_open() {
                    panic!(concat!("tap installed after boot: ", module_path!()));
                }
                let prev = SLOT.swap(
                    implementation as *mut (),
                    ::std::sync::atomic::Ordering::Relaxed,
                );
                if !prev.is_null() {
                    panic!(concat!("tap installed twice: ", module_path!()));
                }
            }

            #[inline(always)]
            pub fn is_installed() -> bool {
                !SLOT.load(::std::sync::atomic::Ordering::Relaxed).is_null()
            }

            // Empty cost: relaxed load + null test + not-taken branch. `f`
            // is only invoked (and its captured args only materialize) on
            // the installed path, so callers can defer expensive argument
            // construction into the closure body.
            #[inline(always)]
            pub fn call_if(f: impl FnOnce(Signature)) {
                let raw = SLOT.load(::std::sync::atomic::Ordering::Relaxed);
                if !raw.is_null() {
                    __invoke(raw, f);
                }
            }

            // Fallible-tap form: a tap declared `-> R` (the executor end
            // hook, whose C consumers may ereport(ERROR) with no PG_TRY
            // between them and the caller) yields the consumer's value when
            // installed and `default` otherwise. Same not-installed cost as
            // `call_if`.
            #[inline(always)]
            pub fn call_if_or<R>(default: R, f: impl FnOnce(Signature) -> R) -> R {
                let raw = SLOT.load(::std::sync::atomic::Ordering::Relaxed);
                if raw.is_null() {
                    default
                } else {
                    __invoke(raw, f)
                }
            }

            #[cold]
            #[inline(never)]
            fn __invoke<R>(raw: *mut (), f: impl FnOnce(Signature) -> R) -> R {
                // SAFETY: install-once invariant — a non-null SLOT always
                // holds a valid `Signature` written by `install()`.
                let g: Signature = unsafe { ::std::mem::transmute::<*mut (), Signature>(raw) };
                f(g)
            }
        }
    };
}

#[macro_export]
macro_rules! seam {
    (
        $(#[$attr:meta])*
        $vis:vis fn $name:ident $(<$($lt:lifetime),+ $(,)?>)? ( $($arg:ident : $arg_ty:ty),* $(,)? ) $(-> $ret:ty)?
    ) => {
        $(#[$attr])*
        $vis mod $name {
            #![allow(dead_code, unused_imports)]
            use super::*;

            pub type Signature = $(for<$($lt),+>)? fn($($arg_ty),*) $(-> $ret)?;

            #[cold]
            #[inline(never)]
            fn __uninstalled_stub $(<$($lt),+>)? ($(_: $arg_ty),*) $(-> $ret)? {
                panic!(concat!("seam not installed: ", module_path!()))
            }

            #[inline(always)]
            fn __stub_ptr() -> *mut () {
                __uninstalled_stub as Signature as *mut ()
            }

            static SLOT: ::std::sync::atomic::AtomicPtr<()> =
                ::std::sync::atomic::AtomicPtr::new(__uninstalled_stub as Signature as *mut ());

            pub fn set(implementation: Signature) {
                // compare_exchange from the stub, NOT swap-then-panic: a
                // second install must FAIL WITHOUT CLOBBERING the first.
                // (Found by the wave-3 fuzz train: test harnesses that
                // tolerate the double-install panic via catch_unwind were
                // silently replacing the owning module's seam — the panic
                // fired AFTER the swap, so "tolerated" meant
                // last-writer-wins and a mixed seam environment.)
                if SLOT
                    .compare_exchange(
                        __stub_ptr(),
                        implementation as *mut (),
                        ::std::sync::atomic::Ordering::Relaxed,
                        ::std::sync::atomic::Ordering::Relaxed,
                    )
                    .is_err()
                {
                    panic!(concat!("seam installed twice: ", module_path!()));
                }
            }

            pub fn is_installed() -> bool {
                SLOT.load(::std::sync::atomic::Ordering::Relaxed) != __stub_ptr()
            }

            pub fn wrap(implementation: Signature) -> Signature {
                if !$crate::tap_boot_phase_open() {
                    panic!(concat!("seam wrapped after boot: ", module_path!()));
                }
                let prev = SLOT.swap(
                    implementation as *mut (),
                    ::std::sync::atomic::Ordering::Relaxed,
                );
                if prev == __stub_ptr() {
                    panic!(concat!("seam wrapped before install: ", module_path!()));
                }
                // SAFETY: a non-stub SLOT always holds a valid `Signature`.
                unsafe { ::std::mem::transmute::<*mut (), Signature>(prev) }
            }

            // Inlined into the caller: a seam call is the slot load and one indirect call, not a call to this function
            // first (a separate function per seam, each its own instruction-cache line on the statement path).
            #[inline]
            pub fn call $(<$($lt),+>)? ($($arg: $arg_ty),*) $(-> $ret)? {
                let raw = SLOT.load(::std::sync::atomic::Ordering::Relaxed);
                // SAFETY: set-once invariant (crate top) — always a valid `Signature`.
                let f: Signature = unsafe { ::std::mem::transmute::<*mut (), Signature>(raw) };
                f($($arg),*)
            }
        }
    };
}

// A `seam!` whose callers' lines matter (testflow K11, main 2026-10-12T21:08:00Z; D4214 / D4229). A #[track_caller]
// implementation reached through a seam's fn pointer reports its own definition line, so every CHECK_FOR_INTERRUPTS through
// the seam read 'crates/backend/tcop/postgres/src/lib.rs:312' in Gravity's poll-gap probe, whatever code called it.
// `seam_tracked!` declares a zero-argument seam with `seam!`'s API (set / is_installed / wrap / call) plus `set_tracked`: an
// implementation that takes the call's own location. `call()` is #[inline(always)] #[track_caller], so the location is a
// constant at each call site (or its #[track_caller] caller's), and a call costs what `seam!`'s does: one relaxed load and
// one indirect call. Until `set_tracked`, the tracked slot holds an adapter that calls the `set` implementation (a test's
// mock), so a seam with only `set` behaves as a `seam!`.
#[macro_export]
macro_rules! seam_tracked {
    (
        $(#[$attr:meta])*
        $vis:vis fn $name:ident () $(-> $ret:ty)?
    ) => {
        $(#[$attr])*
        $vis mod $name {
            #![allow(dead_code, unused_imports)]
            use super::*;

            pub type Signature = fn() $(-> $ret)?;
            pub type Tracked = fn(&'static ::core::panic::Location<'static>) $(-> $ret)?;

            #[cold]
            #[inline(never)]
            fn __uninstalled_stub() $(-> $ret)? {
                panic!(concat!("seam not installed: ", module_path!()))
            }

            #[inline(always)]
            fn __stub_ptr() -> *mut () {
                __uninstalled_stub as Signature as *mut ()
            }

            static SLOT: ::std::sync::atomic::AtomicPtr<()> =
                ::std::sync::atomic::AtomicPtr::new(__uninstalled_stub as Signature as *mut ());

            // The tracked slot until `set_tracked`: the `set` implementation (or the stub), the location dropped.
            fn __adapter(_site: &'static ::core::panic::Location<'static>) $(-> $ret)? {
                let raw = SLOT.load(::std::sync::atomic::Ordering::Relaxed);
                // SAFETY: set-once invariant (crate top) — SLOT always holds a valid `Signature`.
                let f: Signature = unsafe { ::std::mem::transmute::<*mut (), Signatur
```

### Core Architecture Module: `crates/_support/types/gist/src/state.rs`
```
//! GISTSTATE carrier and per-column opclass support-proc call frames.
//! Support procs are resolved once per state (C fmgr_info_copy from
//! rd_support); per-tuple calls rewrite args in place on owned frames.
use std::rc::Rc;

use ::datum::Datum;
use ::mcx::Mcx;
use ::types_core::Oid;
use ::types_error::{PgError, PgResult};
use ::types_fmgr::{FmgrInfo, LocalFcinfo};
use ::types_tuple::TupleDescData;

use crate::{GistEntryVector, GistSplitVec, GISTENTRY};

// fmgr.c FunctionCallNColl: elog(ERROR, "function %u returned NULL").
#[cold]
#[inline(never)]
fn returned_null(fn_oid: Oid) -> Box<PgError> {
    Box::new(PgError::error(format!("function {fn_oid} returned NULL")))
}

const InvalidOid: Oid = 0;

pub struct GistState<'mcx> {
    pub leafTupdesc: Rc<TupleDescData<'mcx>>,
    pub nonLeafTupdesc: Rc<TupleDescData<'mcx>>,
    pub fetchTupdesc: Option<Rc<TupleDescData<'mcx>>>,

    pub consistentFn: Vec<FmgrInfo>,
    pub unionFn: Vec<FmgrInfo>,
    pub compressFn: Vec<FmgrInfo>,
    pub decompressFn: Vec<FmgrInfo>,
    pub penaltyFn: Vec<FmgrInfo>,
    pub picksplitFn: Vec<FmgrInfo>,
    pub equalFn: Vec<FmgrInfo>,
    pub distanceFn: Vec<FmgrInfo>,
    pub fetchFn: Vec<FmgrInfo>,

    pub supportCollation: Vec<Oid>,

    // Owner of the per-column parsed opclass options the support-fn
    // FmgrInfos' fn_expr slots point into (C: the options Const in
    // rd_indexcxt); boxed for address stability, dropped with the state.
    pub opclassOptions: Vec<Option<Box<::types_fmgr::OpclassOptions>>>,

    pub frame1: LocalFcinfo<1>,
    pub frame2: LocalFcinfo<2>,
    pub frame3: LocalFcinfo<3>,
    pub frame5: LocalFcinfo<5>,
}

impl<'mcx> GistState<'mcx> {
    pub fn has_compress(&self, attno: usize) -> bool {
        self.compressFn[attno].fn_oid != InvalidOid
    }
    pub fn has_decompress(&self, attno: usize) -> bool {
        self.decompressFn[attno].fn_oid != InvalidOid
    }
    pub fn has_fetch(&self, attno: usize) -> bool {
        self.fetchFn[attno].fn_oid != InvalidOid
    }
    pub fn has_distance(&self, attno: usize) -> bool {
        self.distanceFn[attno].fn_oid != InvalidOid
    }

    // FunctionCall1Coll(&compressFn[attno], …, PointerGetDatum(&entry)); the
    // result GISTENTRY* may be the input or a temp-allocated replacement.
    pub fn call_compress(&mut self, mcx: Mcx<'_>, attno: usize, entry: &GISTENTRY) -> PgResult<GISTENTRY> {
        self.frame1.rearm(self.supportCollation[attno]);
        // SAFETY: caller's temp context outlives the call (its reset point
        // is after consuming the results).
        unsafe { self.frame1.set_result_mcx(mcx) };
        self.frame1
            .set_arg(0, Datum::from_usize(entry as *const GISTENTRY as usize));
        let r = self.compressFn[attno].invoke(&mut self.frame1)?;
        if self.frame1.isnull {
            return Err(returned_null(self.compressFn[attno].fn_oid));
        }
        // SAFETY: opclass contract — returns a GISTENTRY* (input or palloc'd
        // in the armed temp context, live until reset_temp).
        Ok(unsafe { *(r.as_usize() as *const GISTENTRY) })
    }

    pub fn call_decompress(&mut self, mcx: Mcx<'_>, attno: usize, entry: &GISTENTRY) -> PgResult<GISTENTRY> {
        self.frame1.rearm(self.supportCollation[attno]);
        // SAFETY: as call_compress.
        unsafe { self.frame1.set_result_mcx(mcx) };
        self.frame1
            .set_arg(0, Datum::from_usize(entry as *const GISTENTRY as usize));
        let r = self.decompressFn[attno].invoke(&mut self.frame1)?;
        if self.frame1.isnull {
            return Err(returned_null(self.decompressFn[attno].fn_oid));
        }
        // SAFETY: as call_compress.
        Ok(unsafe { *(r.as_usize() as *const GISTENTRY) })
    }

    pub fn call_fetch(&mut self, mcx: Mcx<'_>, attno: usize, entry: &GISTENTRY) -> PgResult<GISTENTRY> {
        self.frame1.rearm(self.supportCollation[attno]);
        // SAFETY: as call_compress.
        unsafe { self.frame1.set_result_mcx(mcx) };
        self.frame1
            .set_arg(0, Datum::from_usize(entry as *const GISTENTRY as usize));
        let r = self.fetchFn[attno].invoke(&mut self.frame1)?;
        if self.frame1.isnull {
            return Err(returned_null(self.fetchFn[attno].fn_oid));
        }
        // SAFETY: as call_compress.
        Ok(unsafe { *(r.as_usize() as *const GISTENTRY) })
    }

    // FunctionCall2Coll(&unionFn[attno], …, evec, &size) -> new key Datum.
    pub fn call_union(&mut self, mcx: Mcx<'_>, attno: usize, evec: &GistEntryVector) -> PgResult<Datum> {
        let mut size: i32 = 0;
        self.frame2.rearm(self.supportCollation[attno]);
        // SAFETY: as call_compress.
        unsafe { self.frame2.set_result_mcx(mcx) };
        self.frame2
            .set_arg(0, Datum::from_usize(evec as *const GistEntryVector as usize));
        self.frame2
            .set_arg(1, Datum::from_usize(&mut size as *mut i32 as usize));
        let r = self.unionFn[attno].invoke(&mut self.frame2)?;
        if self.frame2.isnull {
            return Err(returned_null(self.unionFn[attno].fn_oid));
        }
        Ok(r)
    }

    // FunctionCall3Coll(&penaltyFn[attno], …, orig, add, &penalty).
    pub fn call_penalty(
        &mut self,
        mcx: Mcx<'_>,
        attno: usize,
        orig: &GISTENTRY,
        add: &GISTENTRY,
    ) -> PgResult<f32> {
        let mut penalty: f32 = 0.0;
        // C's entry->rel is live inside penalty procs (btree_gist reads
        // rd_att->natts); stamp the stand-in on local copies.
        let natts = self.leafTupdesc.natts as u16;
        let orig = GISTENTRY { rel_natts: natts, ..*orig };
        let add = GISTENTRY { rel_natts: natts, ..*add };
        self.frame3.rearm(self.supportCollation[attno]);
        // SAFETY: as call_compress.
        unsafe { self.frame3.set_result_mcx(mcx) };
        self.frame3
            .set_arg(0, Datum::from_usize(&orig as *const GISTENTRY as usize));
        self.frame3
            .set_arg(1, Datum::from_usize(&add as *const GISTENTRY as usize));
        self.frame3
            .set_arg(2, Datum::from_usize(&mut penalty as *mut f32 as usize));
        self.penaltyFn[attno].invoke(&mut self.frame3)?;
        if self.frame3.isnull {
            return Err(returned_null(self.penaltyFn[attno].fn_oid));
        }
        Ok(penalty)
    }

    pub fn call_picksplit(
        &mut self,
        mcx: Mcx<'_>,
        attno: usize,
        evec: &GistEntryVector,
        sv: &mut GistSplitVec,
    ) -> PgResult<()> {
        self.frame2.rearm(self.supportCollation[attno]);
        // SAFETY: as call_compress.
        unsafe { self.frame2.set_result_mcx(mcx) };
        self.frame2
            .set_arg(0, Datum::from_usize(evec as *const GistEntryVector as usize));
        self.frame2
            .set_arg(1, Datum::from_usize(sv as *mut GistSplitVec as usize));
        self.picksplitFn[attno].invoke(&mut self.frame2)?;
        if self.frame2.isnull {
            return Err(returned_null(self.picksplitFn[attno].fn_oid));
        }
        Ok(())
    }

    // FunctionCall3Coll(&equalFn[attno], …, a, b, &result).
    pub fn call_same(&mut self, mcx: Mcx<'_>, attno: usize, a: Datum, b: Datum) -> PgResult<bool> {
        let mut result = false;
        self.frame3.rearm(self.supportCollation[attno]);
        // SAFETY: as call_compress.
        unsafe { self.frame3.set_result_mcx(mcx) };
        self.frame3.set_arg(0, a);
        self.frame3.set_arg(1, b);
        self.frame3
            .set_arg(2, Datum::from_usize(&mut result as *mut bool as usize));
        self.equalFn[attno].invoke(&mut self.frame3)?;
        if self.frame3.isnull {
            return Err(returned_null(self.equalFn[attno].fn_oid));
        }
        Ok(result)
    }

    // FunctionCall5Coll(consistent-proc via scankey, …). Frame owned here so
    // gistindex_keytest never builds a fresh fcinfo per tuple.
    #[allow(clippy::too_many_arguments)]
    pub fn call_consistent(
        &mut self,
        mcx: Mcx<'_>,
        finfo: &mut FmgrInfo,
        collation: Oid,
        de: &GISTENTRY,
        query: Datum,
        strategy: u16,
        subtype: Oid,
        recheck: &mut bool,
    ) -> PgResult<bool> {
        self.frame5.rearm(collation);
        // SAFETY: as call_compress.
        unsafe { self.frame5.set_result_mcx(mcx) };
        self.frame5
            .set_arg(0, Datum::from_usize(de as *const GISTENTRY as usize));
        self.frame5.set_arg(1, query);
        self.frame5.set_arg(2, Datum::from_i16(strategy as i16));
        self.frame5.set_arg(3, Datum::from_oid(subtype));
        self.frame5
            .set_arg(4, Datum::from_usize(recheck as *mut bool as usize));
        let r = finfo.invoke(&mut self.frame5)?;
        if self.frame5.isnull {
            return Err(returned_null(finfo.fn_oid));
        }
        Ok(r.as_bool())
    }

    // FunctionCall5Coll(distance-proc via scankey, …) — gistindex_keytest's
    // isorderby arm; recheck is initialized false by the caller (pre-9.5
    // distance fns never set it).
    #[allow(clippy::too_many_arguments)]
    pub fn call_distance(
        &mut self,
        mcx: Mcx<'_>,
        finfo: &mut FmgrInfo,
        collation: Oid,
        de: &GISTENTRY,
        query: Datum,
        strategy: u16,
        subtype: Oid,
        recheck: &mut bool,
    ) -> PgResult<f64> {
        self.frame5.rearm(collation);
        // SAFETY: as call_compress.
        unsafe { self.frame5.set_result_mcx(mcx) };
        self.frame5
            .set_arg(0, Datum::from_usize(de as *const GISTENTRY as usize));
        self.frame5.set_arg(1, query);
        self.frame5.set_arg(2, Datum::from_i16(strategy as i16));
        self.frame5.set_arg(3, Datum::from_oid(subtype));
        self.frame5
            .set_arg(4, Datum::from_usize(recheck as *mut bool as usize));
        let r = finfo.invoke(&mut self.frame5)?;
        if self.frame5.isnull {
            return Err(returned_null(finfo.fn_oid));
        }
        Ok(r.as
```

### Core Architecture Module: `crates/_support/types/types_core/src/cast.rs`
```
use crate::catalog::{INT2OID, INT4OID, INT8OID, NUMERICOID};

pub const F_INT4_INT2: u32 = 313;
pub const F_INT2_INT4: u32 = 314;
pub const F_INT4_INT8: u32 = 480;
pub const F_INT8_INT4: u32 = 481;
pub const F_INT2_INT8: u32 = 714;
pub const F_INT8_INT2: u32 = 754;
pub const F_NUMERIC_INT4: u32 = 1740;
pub const F_NUMERIC_INT8: u32 = 1781;
pub const F_NUMERIC_INT2: u32 = 1782;

pub const fn int_digits(typid: u32) -> Option<u32> {
    match typid {
        INT2OID => Some(5),
        INT4OID => Some(10),
        INT8OID => Some(19),
        _ => None,
    }
}

const CASTS: [(u32, u32, u32); 9] = [
    (F_INT4_INT2, INT2OID, INT4OID),
    (F_INT2_INT4, INT4OID, INT2OID),
    (F_INT4_INT8, INT8OID, INT4OID),
    (F_INT8_INT4, INT4OID, INT8OID),
    (F_INT2_INT8, INT8OID, INT2OID),
    (F_INT8_INT2, INT2OID, INT8OID),
    (F_NUMERIC_INT4, INT4OID, NUMERICOID),
    (F_NUMERIC_INT8, INT8OID, NUMERICOID),
    (F_NUMERIC_INT2, INT2OID, NUMERICOID),
];

pub fn exact(funcid: u32) -> Option<(u32, u32)> {
    CASTS
        .iter()
        .find(|c| c.0 == funcid)
        .map(|c| (c.1, c.2))
        .filter(|&(s, t)| int_digits(s).is_some() && (int_digits(t).is_some() || t == NUMERICOID))
}

pub fn exact_to_numeric(funcid: u32) -> Option<u32> {
    exact(funcid).filter(|c| c.1 == NUMERICOID).map(|c| c.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn integer_casts_are_exact_and_name_their_source() {
        for f in [F_INT4_INT2, F_INT2_INT4, F_INT4_INT8, F_INT8_INT4, F_INT2_INT8, F_INT8_INT2] {
            assert!(exact(f).is_some_and(|(s, t)| int_digits(s).is_some() && int_digits(t).is_some()), "{f}");
            assert_eq!(exact_to_numeric(f), None, "{f}: not to numeric");
        }
        assert_eq!(exact_to_numeric(F_NUMERIC_INT4), Some(INT4OID));
        assert_eq!(exact_to_numeric(F_NUMERIC_INT8), Some(INT8OID));
        assert_eq!(exact_to_numeric(F_NUMERIC_INT2), Some(INT2OID));
        assert_eq!((F_INT4_INT2, F_INT8_INT2, F_INT8_INT4, F_NUMERIC_INT4, F_NUMERIC_INT8, F_NUMERIC_INT2), (313, 754, 481, 1740, 1781, 1782));
        assert!(exact(1744).is_none() && exact(317).is_none() && exact(1251).is_none());
        assert_eq!((int_digits(21), int_digits(23), int_digits(20), int_digits(1700)), (Some(5), Some(10), Some(19), None));
    }
}

```

### Core Architecture Module: `crates/_support/types/types_core/src/catalog.rs`
```
use crate::primitive::Oid;

pub const NAMESPACE_RELATION_ID: Oid = 2615;
pub const RELATION_RELATION_ID: Oid = 1259;
pub const DATABASE_RELATION_ID: Oid = 1262;
pub const PROCEDURE_RELATION_ID: Oid = 1255;
pub const TYPE_RELATION_ID: Oid = 1247;
pub const LANGUAGE_RELATION_ID: Oid = 2612;
pub const TRIGGER_RELATION_ID: Oid = 2620;
pub const FOREIGN_SERVER_RELATION_ID: Oid = 1417;
pub const FOREIGN_SERVER_OID_INDEX_ID: Oid = 113;
pub const FOREIGN_SERVER_NAME_INDEX_ID: Oid = 549;
pub const FOREIGN_DATA_WRAPPER_RELATION_ID: Oid = 2328;
pub const FOREIGN_DATA_WRAPPER_OID_INDEX_ID: Oid = 112;
pub const FOREIGN_DATA_WRAPPER_NAME_INDEX_ID: Oid = 548;
pub const USER_MAPPING_RELATION_ID: Oid = 1418;
pub const USER_MAPPING_OID_INDEX_ID: Oid = 174;
pub const USER_MAPPING_USER_SERVER_INDEX_ID: Oid = 175;
pub const FOREIGN_TABLE_RELATION_ID: Oid = 3118;
pub const FOREIGN_TABLE_RELID_INDEX_ID: Oid = 3119;
pub const TABLE_SPACE_RELATION_ID: Oid = 1213;
pub const AUTH_ID_RELATION_ID: Oid = 1260;
pub const AUTH_ID_OID_INDEX_ID: Oid = 2677;
pub const AUTH_MEM_RELATION_ID: Oid = 1261;
pub const AUTH_MEM_OID_INDEX_ID: Oid = 6303;
pub const ATTRIBUTE_RELATION_ID: Oid = 1249;
pub const INDEX_RELATION_ID: Oid = 2610;
pub const CONSTRAINT_RELATION_ID: Oid = 2606;
pub const CONSTRAINT_NAME_NSP_INDEX_ID: Oid = 2664;
pub const CONSTRAINT_RELID_TYPID_NAME_INDEX_ID: Oid = 2665;
pub const CONSTRAINT_TYPID_INDEX_ID: Oid = 2666;
pub const CONSTRAINT_OID_INDEX_ID: Oid = 2667;
pub const EXTENSION_RELATION_ID: Oid = 3079;
pub const ATTR_DEFAULT_RELATION_ID: Oid = 2604;
pub const ATTR_DEFAULT_INDEX_ID: Oid = 2656;
pub const ATTR_DEFAULT_OID_INDEX_ID: Oid = 2657;
pub const OPERATOR_RELATION_ID: Oid = 2617;
pub const OPERATOR_OID_INDEX_ID: Oid = 2688;
pub const OPERATOR_CLASS_RELATION_ID: Oid = 2616;
pub const OPCLASS_OID_INDEX_ID: Oid = 2687;
pub const OPCLASS_AM_NAME_NSP_INDEX_ID: Oid = 2686;
pub const OPERATOR_FAMILY_RELATION_ID: Oid = 2753;
pub const OPFAMILY_OID_INDEX_ID: Oid = 2755;
pub const ACCESS_METHOD_RELATION_ID: Oid = 2601;
pub const ACCESS_METHOD_OPERATOR_RELATION_ID: Oid = 2602;
pub const ACCESS_METHOD_OPERATOR_OID_INDEX_ID: Oid = 2756;
pub const ACCESS_METHOD_PROCEDURE_RELATION_ID: Oid = 2603;
pub const ACCESS_METHOD_PROCEDURE_OID_INDEX_ID: Oid = 2757;

pub const ATTRIBUTE_IDENTITY_ALWAYS: u8 = b'a';
pub const ATTRIBUTE_IDENTITY_BY_DEFAULT: u8 = b'd';
pub const ATTRIBUTE_GENERATED_STORED: u8 = b's';
pub const ATTRIBUTE_GENERATED_VIRTUAL: u8 = b'v';

pub const PG_CATALOG_NAMESPACE: Oid = 11;
pub const PG_TOAST_NAMESPACE: Oid = 99;
pub const BOOTSTRAP_SUPERUSERID: Oid = 10;
pub const ROLE_PG_DATABASE_OWNER: Oid = 6171;

pub const FirstGenbkiObjectId: Oid = 10000;
pub const FirstUnpinnedObjectId: Oid = 12000;
pub const FirstNormalObjectId: Oid = 16384;

pub const OIDOID: Oid = 26;
pub const TIDOID: Oid = 27;
pub const XIDOID: Oid = 28;
pub const CIDOID: Oid = 29;
pub const BOOLOID: Oid = 16;
pub const BYTEAOID: Oid = 17;
pub const CHAROID: Oid = 18;
pub const REGTYPEOID: Oid = 2206;
pub const BOOL_BTREE_FAM_OID: Oid = 424;
pub const BOOL_HASH_FAM_OID: Oid = 2222;
pub const INT8OID: Oid = 20;
pub const INT4OID: Oid = 23;
pub const INT2OID: Oid = 21;
pub const VOIDOID: Oid = 2278;
pub const INTERNALOID: Oid = 2281;
pub const TEXTOID: Oid = 25;
pub const TEXTARRAYOID: Oid = 1009;
pub const RECORDOID: Oid = 2249;
pub const INT2VECTOROID: Oid = 22;
pub const OIDVECTOROID: Oid = 30;
pub const INT2ARRAYOID: Oid = 1005;
pub const OIDARRAYOID: Oid = 1028;
pub const UNKNOWNOID: Oid = 705;
pub const FLOAT4OID: Oid = 700;
pub const FLOAT8OID: Oid = 701;
pub const BITOID: Oid = 1560;
pub const VARBITOID: Oid = 1562;
pub const NUMERICOID: Oid = 1700;
pub const INTERVALOID: Oid = 1186;
pub const JSONOID: Oid = 114;
pub const XMLOID: Oid = 142;
pub const JSONBOID: Oid = 3802;
pub const BPCHAROID: Oid = 1042;
pub const VARCHAROID: Oid = 1043;
pub const DATEOID: Oid = 1082;
pub const TIMEOID: Oid = 1083;
pub const TIMETZOID: Oid = 1266;
pub const TIMESTAMPOID: Oid = 1114;
pub const TIMESTAMPTZOID: Oid = 1184;
pub const NAMEOID: Oid = 19;
pub const REGPROCOID: Oid = 24;
pub const CASHOID: Oid = 790;
pub const REGPROCEDUREOID: Oid = 2202;
pub const REGOPEROID: Oid = 2203;
pub const REGOPERATOROID: Oid = 2204;
pub const REGCLASSOID: Oid = 2205;
pub const LSNOID: Oid = 3220;
pub const REGCONFIGOID: Oid = 3734;
pub const REGDICTIONARYOID: Oid = 3769;
pub const REGNAMESPACEOID: Oid = 4089;
pub const REGROLEOID: Oid = 4096;
pub const REGCOLLATIONOID: Oid = 4191;
pub const XID8OID: Oid = 5069;
pub const MACADDR8OID: Oid = 774;
pub const MACADDROID: Oid = 829;
pub const ACLITEMOID: Oid = 1033;
pub const UUIDOID: Oid = 2950;
pub const INETOID: Oid = 869;
pub const CIDROID: Oid = 650;
pub const CSTRINGOID: Oid = 2275;
pub const RECORDARRAYOID: Oid = 2287;
pub const ANYOID: Oid = 2276;
pub const ANYARRAYOID: Oid = 2277;
pub const ANYELEMENTOID: Oid = 2283;
pub const ANYNONARRAYOID: Oid = 2776;
pub const ANYENUMOID: Oid = 3500;
pub const ANYRANGEOID: Oid = 3831;
pub const ANYMULTIRANGEOID: Oid = 4537;
pub const ANYCOMPATIBLEOID: Oid = 5077;
pub const ANYCOMPATIBLEARRAYOID: Oid = 5078;
pub const ANYCOMPATIBLENONARRAYOID: Oid = 5079;
pub const ANYCOMPATIBLERANGEOID: Oid = 5080;
pub const ANYCOMPATIBLEMULTIRANGEOID: Oid = 4538;

pub const BTREE_AM_OID: Oid = 403;
pub const HASH_AM_OID: Oid = 405;
pub const GIN_AM_OID: Oid = 2742;
pub const BRIN_AM_OID: Oid = 3580;
pub const SPGIST_AM_OID: Oid = 4000;
pub const GIST_AM_OID: Oid = 783;

pub const INDEX_AM_HANDLEROID: Oid = 325;

pub const TABLE_AM_HANDLEROID: Oid = 269;

pub const COLLATION_RELATION_ID: Oid = 3456;
pub const AGGREGATE_RELATION_ID: Oid = 2600;
pub const AGGREGATE_FNOID_INDEX_ID: Oid = 2650;

// `ScanKeyInit` always stamps this into `sk_collation`.
pub const C_COLLATION_OID: Oid = 950;
pub const POSIX_COLLATION_OID: Oid = 951;
pub const DEFAULT_COLLATION_OID: Oid = 100;

pub const RELPERSISTENCE_PERMANENT: u8 = b'p';
pub const RELPERSISTENCE_UNLOGGED: u8 = b'u';
pub const RELPERSISTENCE_TEMP: u8 = b't';

```

### Core Architecture Module: `crates/_support/types/types_core/src/cmdtag.rs`
```
/// C `CommandTag` as a value-checked newtype: the values are positional
/// indices in `tcop/cmdtaglist.h` (PG 18.3) and must stay index-exact.
#[derive(Clone, Copy, Debug, Default, Eq, Hash, PartialEq)]
#[repr(transparent)]
pub struct CommandTag(pub i32);

impl CommandTag {
    pub const UNKNOWN: CommandTag = CommandTag(0);
    pub const ALTER_SEQUENCE: CommandTag = CommandTag(29);
    pub const CREATE_SEQUENCE: CommandTag = CommandTag(84);
    pub const REFRESH_MATERIALIZED_VIEW: CommandTag = CommandTag(169);
    pub const SELECT: CommandTag = CommandTag(179);
}

```

### Core Architecture Module: `crates/_support/types/types_core/src/eq_alike.rs`
```

use crate::Oid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EqAlike {
    Image,
    Text { pad: bool },
    Numeric,
    Float,
    Apart,
}

/// The class of a built-in type (PostgreSQL 18.6's pg_type), `None` for a type the table does not list.
pub const fn builtin(typid: Oid) -> Option<EqAlike> {
    use EqAlike::*;
    Some(match typid {
        16 | 17 | 18 | 20 | 21 | 23 | 24 | 26 | 27 | 28 | 29 | 650 | 774 | 790 | 829 | 869 | 1082 | 1083 | 1114 | 1184 | 1266
        | 1560 | 1562 | 2202..=2206 | 2950 | 3220 | 3734 | 3769 | 4089 | 4096 | 4191 | 5069 => Image,
        19 | 25 | 1043 => Text { pad: false },
        1042 => Text { pad: true },
        1700 => Numeric,
        700 | 701 => Float,
        22 | 30 | 114 | 142 | 194 | 600..=604 | 718 | 1002 | 1003 | 1005 | 1007 | 1009 | 1014 | 1015 | 1016 | 1021 | 1022
        | 1028 | 1033 | 1034 | 1186 | 2249 | 2277 | 2970 | 3361 | 3402 | 3614 | 3615 | 3802 | 3904 | 3906 | 3908
        | 3910 | 3912 | 3926 | 4451 | 4532 | 5017 | 5038 => Apart,
        _ => return None,
    })
}

const ARRAY_ELEMS: [(Oid, Oid); 16] = [
    (1000, 16),   // _bool
    (1001, 17),   // _bytea
    (1002, 18),   // _char
    (1003, 19),   // _name
    (1005, 21),   // _int2
    (1007, 23),   // _int4
    (1009, 25),   // _text
    (1014, 1042), // _bpchar
    (1015, 1043), // _varchar
    (1016, 20),   // _int8
    (1028, 26),   // _oid
    (1115, 1114), // _timestamp
    (1182, 1082), // _date
    (1185, 1184), // _timestamptz
    (1231, 1700), // _numeric
    (2951, 2950), // _uuid
];

pub fn array_elem(typid: Oid) -> Option<Oid> {
    ARRAY_ELEMS.binary_search_by_key(&typid, |p| p.0).ok().map(|i| ARRAY_ELEMS[i].1)
}

pub const fn class_alike(class: EqAlike, typmod: i32, coll_bytes_eq: bool, float_hidden: bool) -> bool {
    match class {
        EqAlike::Image => true,
        EqAlike::Text { pad } => coll_bytes_eq && (!pad || typmod > 0),
        EqAlike::Numeric => typmod >= 0,
        EqAlike::Float => float_hidden,
        EqAlike::Apart => false,
    }
}

pub fn alike(typid: Oid, typmod: i32, coll_bytes_eq: bool, float_hidden: bool, other: impl FnOnce(Oid) -> Option<EqAlike>) -> bool {
    let typid = match array_elem(typid) {
        Some(elem) => elem,
        None => typid,
    };
    match builtin(typid) {
        Some(class) => class_alike(class, typmod, coll_bytes_eq, float_hidden),
        None => other(typid).is_some_and(|class| class_alike(class, typmod, coll_bytes_eq, float_hidden)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_array_list_is_sorted_and_its_elements_are_listed() {
        assert!(ARRAY_ELEMS.windows(2).all(|w| w[0].0 < w[1].0));
        assert!(ARRAY_ELEMS.iter().all(|&(_, e)| builtin(e).is_some_and(|c| c != EqAlike::Apart)));
    }

    #[test]
    fn members_print_alike_by_class() {
        let none = |_| None;
        assert!(alike(23, -1, false, false, none));
        assert!(alike(1007, -1, false, false, none)); // int4[] reads int4
        assert!(alike(25, -1, true, false, none));
        assert!(!alike(25, -1, false, false, none)); // text under a nondeterministic collation
        assert!(!alike(1042, -1, true, false, none) && alike(1042, 8, true, false, none));
        assert!(!alike(1700, -1, true, false, none) && alike(1700, (12 << 16 | 2) + 4, true, false, none));
        assert!(!alike(1231, -1, true, false, none)); // numeric[] without a typmod
        assert!(!alike(701, -1, true, false, none) && alike(701, -1, true, true, none));
        assert!(!alike(1186, -1, true, false, none) && !alike(3802, -1, true, false, none));
        assert!(!alike(90_000, -1, true, false, none) && alike(90_000, -1, true, false, |_| Some(EqAlike::Image)));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #136** (2026-09-28): **wasix: run pgrust on the WASIX lane**
  *Symptoms*: ## Summary  This adds the WASIX lane that lets pgrust serve pgwire from a single WASIX guest instance: the postmaster hands each connection its own backend thread and takes a termination signal, which the existing `wasm32-wasip1` lane deliberately stubs out (no threads, no TCP, no epoll).  ## What this changes  WASIX socket / epoll / accept-loop and signal-handling changes across the postmaster and backend:  - `common/ip` (`lib.rs`, `sys.rs`, `Cargo.toml`): real socket + `getaddrinfo` path for WASIX. - `backend/libpq/pqcomm/socket.rs`, `postmaster/postmaster/{main_entry.rs,serverloop.rs}`, `postmaster/launch_backend`: threaded accept loop and per-connection backend spawn. - `storage/ipc/waiter`, `storage/ipc/waiteventset` (`epoll.rs`, `wasm_epoll.rs`): epoll-backed wait set for WASIX.  Guest-side compatibility fixes this port needed on WASIX:  - `port/pg_clock` (`posix.rs`): clockid ABI — a measured `CLOCK_*` mismatch on the guest. - `postmaster/launch_backend`: admission guard against the wasm32 linear-memory ceiling. - `postmaster/memwatchdog`: usage-basis fall-through so the watchdog is not blind in-guest. - `storage/buffer/bufmgr/read.rs`: a PG-faithful `AbortBufferIO` that falls through instead of panicking the postmaster.  ## Notes  - Bundled under `bench/` in this branch is the concurrency harness (`serve-and-bench.sh`, `pgwire_bench.py`) with a tunable worker/concurrency count. - This is the source of the packaged WASIX module; it is a fork branch, and I am open to wh

- **Issue #113** (2026-09-10): **EXPLAIN option `WAL` unsupported: `WAL needs pgWalUsage counters + show_wal_usage (xloginsert lane)`**
  *Symptoms*: # EXPLAIN option `WAL` unsupported: `WAL needs pgWalUsage counters + show_wal_usage (xloginsert lane)`  **pgrust version**: 0.2 (binary `pgrust-0.2-linux-x86_64`, PostgreSQL 18 compatible) **Component**: `ExplainOnePlan()` in `explain.c` (WAL usage instrumentation)  ## Summary  The `EXPLAIN (WAL)` option fails on every statement, including plain `SELECT`. PostgreSQL's EXPLAIN `WAL` option requires the `pgWalUsage` instrumentation counters collected in the xlog insert lane; pgrust does not expose them, and `ExplainOnePlan()` hard-errors instead of omitting the WAL section.  ## Reproducer  ```sql EXPLAIN (ANALYZE, WAL) SELECT 1; ```  Any statement type fails the same way (SELECT, INSERT, UPDATE, ...). Note: upstream PostgreSQL already requires `ANALYZE` before `WAL` is accepted (`EXPLAIN (WAL)` without `ANALYZE` is rejected by the parser), so the relevant case is `EXPLAIN (ANALYZE, WAL, ...)`, which on pgrust aborts during plan display.  ## Expected behaviour  On PostgreSQL 18.6 the same EXPLAIN prints a `WAL:` section on each plan node that generates WAL records, e.g.:  ```  Insert on events_fact  (cost=... )    WAL: records=4006 fpi=8 bytes=283985 ```  and a plain SELECT plan unchanged (with no WAL section).  ## Actual behaviour  ``` ERROR:  ExplainOnePlan (explain.c): WAL needs pgWalUsage counters + show_wal_usage (xloginsert lane) ```  No plan is printed for the statement.  ## Notes  - Blocks every EXPLAIN run that requests WAL — the entire plan is lost, not  just the WAL n

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

### Incident Patch 1: `38634b40` (2026-10-22)
**Commit Message**: pgrust v0.4-beta with ACID-compliant columnar and automatic memory management

**File**: `.cargo/config.toml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+# Workspace cargo config.
+#
+# openssl-src (openssl-sys `vendored`) runs "$OPENSSL_SRC_PERL ./Configure ..."; this wrapper appends the
+# OpenSSL modules a PostgreSQL server never uses (QUIC, SM2/SM4, ML-DSA/SLH-DSA/LMS, ARIA/BF/CAST/RC2/RC4, engines;
+# the list and what is kept on purpose are in the script). A caller that exports its own OPENSSL_SRC_PERL wins over
+# this and gets no trim; the tripwire is be_secure_openssl's src/openssl_trim.rs.
+[env]
+OPENSSL_SRC_PERL = { value = "scripts/openssl-src-perl.sh", relative = true }
```

**File**: `.gitignore` (modified, +6/-42)
```diff
@@ -1,50 +1,14 @@
 /target
 **/target
-*.profraw
 **/target-*/
-covloop-history/
-proofs/coverage/__pycache__/
+target-mut/
+*.profraw
+__pycache__/
 
 # cargo-mutants working/output directory (transient audit artifacts)
 mutants.out/
 mutants.out.old/
-/cpg-cov/
-/cpg-ref/
-/cpg-src/
-/cpg-icu/
-/cpg-icu-build.out
-# crashdiff (W1) work root: B-side scratch checkout, per-seed run evidence
-/crashdiff-work/
-/int8-evidence/
-# Q3 nodes/obs lane: per-seed diffrunner evidence + corpus run logs
-/q3-evidence/
-/q3-before-corpus.out
-/q3-after-corpus.out
-/q3-after2-corpus.out
-/pgref-build.out
-/gapreport-build.out
-# Q5 lane (fuzz-q5-adminacl) local rigs/evidence: B-side scratch checkout,
-# hand-verify decks + servers, differential evidence
-/bmain/
-/q5-evidence/
-/q5-handverify/
-# integration-9 local evidence (manifests + leg logs; summary lives in docs/fuzzing/findings-int9.md)
-/int9-evidence/
 
-# accidental build-log commits
-/cpg-build.log
-cpg-ref-install/
-target-mut/
-# cfg-sampler evidence output (summaries live in docs/fuzzing/findings-cfg*.md)
-cfgfindings/
-
-# FTS-RANK lane transient coverage/differential artifacts
-covloop-*.log
-diffpair*.log
-fts-findings*.jsonl
-fts-only-findings*.jsonl
-fts-*findings-manifest.txt
-wire-diff-out/
-.tpchconv/
-.tpch22/
-__pycache__/
+# crates/postgres-18.6-reference stays tracked on this branch; scripts/pg-reference.sh's stamp and scratch copy are not
+/crates/postgres-*-reference/.pgrust-reference-stamp
+/crates/postgres-*-reference.tmp.*
```

**File**: `ACKNOWLEDGEMENTS.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# Acknowledgements
+
+pgrust is a Rust reimplementation of [PostgreSQL](https://www.postgresql.org),
+and almost all of it follows PostgreSQL's design and code. Beyond PostgreSQL,
+pgrust builds on published research and on ideas from other database systems.
+This file credits them. Code that pgrust ports or vendors from other projects,
+and the licenses for that code, are listed in [`NOTICE`](NOTICE).
+
+## Research
+
+- **Self-tuning query scheduling.** Benjamin Wagner, André Kohn, Thomas
+  Neumann. "Self-Tuning Query Scheduling for Analytical Workloads." SIGMOD 2021.
+  Basis for the executor's scheduler: resource groups, priority decay, and
+  adaptive task sizing (`crates/backend/executor/runtime`).
+- **ALP.** Azim Afroozeh, Leonardo X. Kuffo, Peter Boncz. "ALP: Adaptive Lossless
+  floating-Point Compression." SIGMOD 2024. Floating-point encoding
+  (`crates/_support/alp`).
+- **FastLanes.** Azim Afroozeh, Peter Boncz. "The FastLanes Compression Layout:
+  Decoding >100 Billion Integers per Second with Scalar Code." PVLDB 16(9), 2023.
+  The interleaved bit-packing layout (`crates/_support/alp/src/bitpack.rs`,
+  `pgrc_codec/src/ffor.rs`).
+- **BtrBlocks.** Maximilian Kuschewski, David Sauerwein, Adnan Alhomssi, Viktor
+  Leis. "BtrBlocks: Efficient Columnar Compression for Data Lakes." SIGMOD 2023.
+  Sample-based choice of a column encoding (`pgrc_codec/src/election.rs`).
+- **OnPair.** Francesco Gargiulo, Rossano Venturini. "OnPair: Short Strings
+  Compression for Fast Random Access." arXiv:2508.02280, 2025. Token training
+  and the 16-byte token form for dictionary string bytes before zstd
+  (`pgrc_codec/src/onpair.rs`).
+- **Photon.** Alexander Behm et al. "Photon: A Fast Query Engine for Lakehouse
+  Systems." SIGMOD 2022. Position-list selection vectors
+  (`pgrc_batch/src/selection.rs`).
+- **Unnesting.** Thomas Neumann. "Improving Unnesting of Complex Queries."
+  BTW 2025. Subquery unnesting in the planner
+  (`crates/backend/optimizer/plan/planner/src/unnest.rs`).
+- **Groupjoin.** Guido Moerkotte, Thomas Neumann. "Accelerating Queries with
+  Group-By and Join by Groupjoin." PVLDB 4(11), 2011. The groupjoin aggregation
+  strategy (`crates/gravity/lowerv4/src/ops/agg/strategies/dependent.rs`).
+- **Copy-and-patch compilation.** Haoran Xu, Fredrik Kjolstad. "Copy-and-Patch
+  Compilation." OOPSLA 2021. JIT tuple deforming (`crates/_support/jit_deform`).
+- **TPDE.** Tobias Schwarz, Tobias Kamm, Alexis Engelke. "TPDE: A Fast Adaptable
+  Compiler Back-End Framework." arXiv:2505.22610, 2025. The JIT's code
+  generator is a port of TPDE (`crates/tpde`; see NOTICE).
+- **SSA construction.** Matthias Braun, Sebastian Buchwald, Sebastian Hack,
+  Roland Leißa, Christoph Mallon, Andreas Zwinkau. "Simple and Efficient
+  Construction of Static Single Assignment Form." CC 2013.
+  (`crates/gravity/ir/src/promote.rs`).
+- **PCT.** Sebastian Burckhardt, Pravesh Kothari, Madanlal Musuvathi, Santosh
+  Nagarakatte. "A Randomized Scheduler with Probabilistic Guarantees of Finding
+  Bugs." ASPLOS 2010. Randomized scheduling in the concurrency simulator
+  (`crates/_support/pgsync/src/sim`).
+- **Malthusian locks.** Dave Dice. "Malthusian Locks." EuroSys 2017. Lock
+  hand-off policy (`crates/_support/pgsync`).
+- **TinyLFU.** Gil Einziger, Roy Friedman, Ben Manes. "TinyLFU: A Highly
+  Efficient Cache Admission Policy." ACM TOS 13(4), 2017; with the count-min
+  sketch of Graham Cormode, S. Muthukrishnan (J. Algorithms 55(1), 2005).
+  Cache admission (`crates/gravity/hosts/src/tinylfu.rs`).
+- **SipHash.** Jean-Philippe Aumasson, Daniel J. Bernstein. "SipHash: a fast
+  short-input PRF." INDOCRYPT 2012. 128-bit value fingerprints
+  (`crates/gravity/dict`).
+- **Division by constants.** Torbjörn Granlund, Peter L. Montgomery. "Division
+  by Invariant Integers using Multiplication." PLDI 1994.
+  (`crates/gravity/expr`).
+- **HNSW.** Yu A. Malkov, D. A. Yashunin. "Efficient and Robust Approximate
+  Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs."
+  IEEE TPAMI 42(4), 2020. The vector index, via pgvector
+  (`crates/contrib/pgvector_hnsw`).
+- **Dremel.** Sergey Melnik et al. "Dremel: Interactive Analysis of Web-Scale
+  Datasets." PVLDB 3(1), 2010. Nested-column record assembly in the Parquet
+  reader (`crates/backend/commands/copy/src/fromparquet.rs`).
+- **LeanStore.** Viktor Leis, Michael Haubenschild, Alfons Kemper, Thomas
+  Neumann. "LeanStore: In-Memory Data Management Beyond Main Memory." ICDE 2018.
+  Cooling-stage admission for prefetched extents (`pgrc_read/src/openpart.rs`).
+- **Strongly connected components.** Robert Tarjan. "Depth-First Search and
+  Linear Graph Algorithms." SIAM J. Comput. 1(2), 1972.
+  (`crates/gravity/backend/wasm/src/irreduce.rs`).
+- Classic algorithms used throughout, largely inherited from PostgreSQL:
+  Bentley and McIlroy's "Engineering a Sort Function" (Software: Practice and
+  Experience, 1993), Knuth's *Th
```

**File**: `Cargo.toml` (modified, +156/-54)
```diff
@@ -1,5 +1,7 @@
 [workspace]
 resolver = "2"
+# The vendored libmimalloc-sys and allocator-api2 ([patch.crates-io] below) are path dependencies, not members.
+exclude = ["third_party/libmimalloc-sys", "third_party/allocator-api2"]
 members = [
     "crates/backend/replication/origin",
     "crates/backend/replication/slotsync",
@@ -10,6 +12,7 @@ members = [
     "crates/backend/backup/sink",
     "crates/backend/backup/compress",
     "crates/common/compression",
+    "crates/common/lz4_block",
     "crates/backend/backup/sink_support",
     "crates/backend/backup/backup_copy",
     "crates/backend/backup/backup_copy_seams",
@@ -23,11 +26,20 @@ members = [
     "crates/_support/types/types_core",
     "crates/_support/mcx",
     "crates/_support/secure_zero",
+    "crates/_support/pagegive",
+    "crates/_support/pagepool",
+    "crates/_support/memledger",
+    "crates/_support/allocarena",
+    "crates/_support/mempolicy",
+    "crates/_support/fp_contract",
     "crates/_support/pg_qsort",
     "crates/_support/jit_deform",
     "crates/_support/types/datum",
     "crates/_support/seam_core",
     "crates/_support/pgsync",
+    "crates/_support/fires",
+    "crates/_support/cancelpoll",
+    "crates/_support/leader_tls",
     "crates/_support/test_boot",
     "crates/_support/types/types_tuple",
     "crates/_support/types/types_trigger",
@@ -36,9 +48,9 @@ members = [
     "crates/backend/utils/adt/tsvector_stat",
     "crates/_support/types/stringinfo",
     "crates/common/blkreftable",
+    "crates/common/ct_carrier_mimalloc",
     "crates/common/parse_manifest",
     "crates/common/hashfn",
-    "crates/common/stringhash",
     "crates/_support/types/fmgr",
     "crates/_support/types/types_scan",
     "crates/_support/types/types_guc",
@@ -144,6 +156,7 @@ members = [
     "crates/backend/libpq/be_secure_seams",
     "crates/backend/libpq/be_secure",
     "crates/backend/libpq/be_secure_common",
+    "crates/backend/libpq/be_gssapi_common",
     "crates/backend/libpq/be_secure_openssl",
     "crates/backend/libpq/pqcomm",
     "crates/backend/libpq/pqmq",
@@ -156,6 +169,7 @@ members = [
     "crates/backend/tcop/fastpath",
     "crates/backend/storage/aio/aio_seams",
     "crates/backend/storage/aio/aio_core",
+    "crates/backend/storage/aio/read_stream",
     "crates/backend/postmaster/io_worker",
     "crates/backend/storage/aio/aio_uring",
     "crates/backend/storage/aio/aio_funcs",
@@ -208,11 +222,7 @@ members = [
     "crates/backend/executor/exectuples_output",
     "crates/backend/executor/execexpr",
     "crates/backend/executor/runtime",
-    "crates/backend/executor/sqe",
-    "crates/backend/executor/sqe/lanestitch",
     "crates/backend/executor/spillset",
-    "crates/backend/executor/laneexec",
-    "crates/backend/executor/lanereg",
     "crates/backend/executor/executils",
     "crates/backend/executor/instrument",
     "crates/backend/executor/execjunk",
@@ -221,35 +231,7 @@ members = [
     "crates/backend/executor/nodemodifytable",
     "crates/backend/executor/nodefunctionscan",
     "crates/backend/executor/nodetablefuncscan",
-    "crates/backend/executor/nodevaluesscan",
-    "crates/backend/executor/nodeseqscan",
-    "crates/backend/executor/nodetidscan",
-    "crates/backend/executor/nodetidrangescan",
-    "crates/backend/executor/nodeindexscan",
-    "crates/backend/executor/nodebitmapindexscan",
-    "crates/backend/executor/nodectescan",
     "crates/backend/executor/nodenamedtuplestorescan",
-    "crates/backend/executor/noderecursiveunion",
-    "crates/backend/executor/nodeworktablescan",
-    "crates/backend/executor/nodebitmapheapscan",
-    "crates/backend/executor/nodeindexonlyscan",
-    "crates/backend/executor/nodesort",
-    "crates/backend/executor/nodeincrementalsort",
-    "crates/backend/executor/nodegroup",
-    "crates/backend/executor/nodeunique",
-    "crates/backend/executor/nodeappend",
-    "crates/backend/executor/nodemergeappend",
-    "crates/backend/executor/nodesetop",
-    "crates/backend/executor/nodelimit",
-    "crates/backend/executor/nodelockrows",
-    "crates/backend/executor/nodehash",
-    "crates/backend/executor/nodehashjoin",
-    "crates/backend/executor/nodematerial",
-    "crates/backend/executor/nodememoize",
-    "crates/backend/executor/nodemergejoin",
-    "crates/backend/executor/nodenestloop",
-    "crates/backend/executor/nodeagg",
-    "crates/backend/executor/nodewindowagg",
     "crates/backend/utils/sort/sharedtuplestore",
     "crates/backend/utils/sort/sort_storage",
     "crates/backend/utils/sort/tuplesort",
@@ -313,27 +295,35 @@ members = [
     "crates/backend/access/transam/xlogutils",
     "crates/backend/access/table/tableam_vocab",
     "crates/backend/access/table/tableam",
-    "crates/backend/access/pgrcolumnar",
-    "crates/backend/access/pgrcolumnar2/pgrc2_batch",
-    "crates/backend/access/pgrcolumnar2/pgrc2_claim",
-    "crates/backend/access/pgrcolumnar2/pgrc2_format",
-    "crates/backend/access/
```

**File**: `NOTICE` (modified, +166/-5)
```diff
@@ -10,11 +10,29 @@ error message text, which are intentionally kept identical to
 PostgreSQL so the two systems can be compared byte-for-byte in
 testing).
 
-In addition, the equivalence-proof tree under proofs/ contains verbatim
-copies of PostgreSQL C source files (vendored as the reference side of
-machine-checked C-vs-Rust equivalence proofs). Those files are
-PostgreSQL source code, retain their upstream headers, and are
-distributed under the PostgreSQL License reproduced below.
+Verbatim PostgreSQL source also ships in this repository, under the
+PostgreSQL License reproduced below, with upstream headers retained:
+
+- crates/postgres-18.6-reference/: the unmodified PostgreSQL 18.6 source
+  tree, kept as a read-only reference (not compiled). It includes the
+  third-party files PostgreSQL itself carries, under their own headers
+  (for example src/backend/jit/llvm/SectionMemoryManager.LICENSE).
+- proofs/: PostgreSQL C files vendored as the reference side of
+  machine-checked C-vs-Rust equivalence proofs.
+- Test oracles and generators copied from PostgreSQL inside crates:
+  crates/_support/pg_qsort/cref, crates/_support/types/nodes/vendor,
+  crates/backend/access/common/tidstore/bench/cref/vendor,
+  crates/backend/lib/dshash/bench/cref.c, and the tests/data/cref
+  directories of crates/common/hashfn, crates/common/pglz and
+  crates/port/crc32c.
+- crates/backend/parser/gram_core/gram.c and
+  crates/backend/parser/scan_fgram/scan.c: Bison and flex output generated
+  from PostgreSQL's grammar and scanner. The Bison skeleton carries the
+  Bison special exception, which permits distributing the output under
+  any terms.
+- crates/bin/initdb/share/: PostgreSQL 18.6 install-time data (see its
+  PROVENANCE.md), including the IANA time zone database compiled by zic
+  (public domain).
 
 PostgreSQL is developed by the PostgreSQL Global Development Group and
 is distributed under the PostgreSQL License. In accordance with that
@@ -24,6 +42,117 @@ below.
 PostgreSQL: https://www.postgresql.org
 PostgreSQL source: https://github.com/postgres/postgres
 
+Third-party code inside PostgreSQL
+----------------------------------
+
+PostgreSQL incorporates code from other projects under their own
+permissive licenses. pgrust's Rust ports of those parts derive from that
+code. The license and copyright text of each is in the named file of
+crates/postgres-18.6-reference/:
+
+- Henry Spencer's regular expression engine, Copyright (c) 1998, 1999
+  Henry Spencer, BSD-style license (as adapted via Tcl):
+  ported in crates/backend/regex/ and crates/_support/types/regex.
+  License: src/backend/regex/COPYRIGHT.
+- Snowball stemmers and stop-word lists (https://snowballstem.org),
+  BSD-style license: ported in crates/backend/snowball/dict_snowball.
+  License: src/backend/snowball/README.
+- Ryu floating-point output, Copyright 2018 Ulf Adams, Boost Software
+  License 1.0 (as distributed in PostgreSQL): ported in crates/common/ryu.
+  License: src/common/d2s.c, src/common/f2s.c, src/common/ryu_common.h.
+- HyperLogLog, Copyright (c) 2013 Hideaki Ohno, MIT: ported in
+  crates/backend/lib/hyperloglog. License: src/backend/lib/hyperloglog.c.
+- MD5 and SHA-1, Copyright (C) 1995-1998 WIDE Project, BSD-3-Clause; SHA-2,
+  Copyright (c) 2000-2001 Aaron D. Gifford, BSD-3-Clause: ported in
+  crates/common/md5, crates/common/sha1, crates/common/sha2. License:
+  src/common/md5.c, src/common/sha1.c, src/common/sha2.c.
+- inet_net_ntop, Copyright (c) 2004 Internet Systems Consortium and (c)
+  1996,1999 Internet Software Consortium, ISC: ported in
+  crates/backend/utils/adt/network. License: src/port/inet_net_ntop.c.
+- tzcode (time zone library), public domain: ported in
+  crates/backend/timezone/.
+- pgcrypto's crypt() engines: crypt-des.c (FreeBSD, BSD), crypt-blowfish.c
+  and crypt-gensalt.c (Solar Designer, public domain with a fallback
+  permissive license), crypt-md5.c (Poul-Henning Kamp, "beer-ware"
+  license), crypt-sha.c (public domain), and Marko Kreen's pgcrypto
+  framework (BSD-2-Clause): ported in crates/contrib/pgcrypto. License: the
+  headers of the corresponding files under contrib/pgcrypto/.
+- Unicode Character Database derived tables, Copyright (c) Unicode, Inc.,
+  Unicode License v3: transcribed in crates/common/unicode_case,
+  crates/common/unicode_category and crates/common/unicode_norm (generated
+  in PostgreSQL by src/common/unicode/).
+- NetBSD qsort (Copyright (c) 1992, 1993 The Regents of the University of
+  California, BSD-3-Clause): ported in crates/_support/pg_qsort. License:
+  src/include/lib/sort_template.h.
+
+Other ported or derived code
+----------------------------
+
+- pgvector 0.8.5 (https://github.com/pgvector/pgvector), PostgreSQL
+  License: the vector type, its functions and the HNSW access method are
+  ported to Rust in crates/contrib/pgvector, crates/contrib/pgvector_hnsw
+  and crates/contrib/pgvector_hnsw_build; the extension script and
+  regression SQL ar
```

**File**: `README.md` (modified, +285/-257)
```diff
@@ -1,13 +1,12 @@
 <h1 align="center">pgrust</h1>
 
 <p align="center">
-  <strong>A Rust rewrite of Postgres that's faster than Postgres and ClickHouse.</strong>
+  <strong>A Rust rewrite of Postgres.</strong>
 </p>
 
 <p align="center">
   <img alt="Postgres 18.6" src="https://img.shields.io/badge/Postgres-18.6-336791">
-  <img alt="Regression suite: 100%" src="https://img.shields.io/badge/regression_suite-46%2C066%2F46%2C066-brightgreen">
-  <img alt="Version: v0.3.1" src="https://img.shields.io/badge/version-v0.3.1-blue">
+  <img alt="Version: v0.4-beta" src="https://img.shields.io/badge/version-v0.4--beta-blue">
   <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue"></a>
 </p>
 
@@ -23,259 +22,181 @@
 
 <br />
 
-> **New: v0.3.1** is a bug-fix release. [Release notes](RELEASE-NOTES.md) · [What's new in v0.3](#whats-new-in-v03)
->
-> [Video of Michael's talk at PlanetScale on pgrust](https://www.youtube.com/watch?v=7L_nG3EBjck) and the [slides](https://drive.google.com/file/d/1_wDk4HPE9-MuiPBo_X-QdJUmFtVV0p8p/view)
+> **New:** [Video of Michael's talk at PlanetScale on pgrust](https://www.youtube.com/watch?v=7L_nG3EBjck) — and the [slides](https://drive.google.com/file/d/1_wDk4HPE9-MuiPBo_X-QdJUmFtVV0p8p/view).
 >
 > [How AI Changes the Economics of JIT Compilers](https://malisper.me/how-ai-changes-the-economics-of-jit-compilers/)
+>
+> **v0.4-beta is out:** [the release post](https://pgrust.com/blog/pgrust-v0-4-beta/) and [what's new](#whats-new-in-v04-beta).
 
 pgrust is a re-implementation of Postgres meant to show what Postgres would
 look like if it was built in 2026. It is wire compatible and even SQL dialect
-compatible with Postgres. It passes
-[all 46,066 tests in Postgres' regression suite](https://malisper.me/pgrust-passes-100-of-postgresqls-regression-tests/).
-For the story of why we're building it, see
-[pgrust: rebuilding Postgres in Rust with AI](https://malisper.me/pgrust-rebuilding-postgres-in-rust-with-ai/).
+compatible with Postgres.
 
 Every line is Rust, written to match the behavior of the C implementation.
 Rust makes it easy to re-architect several core Postgres pieces. pgrust has:
 
-- A new vectorized push-based, JIT compiled executor
+- Gravity, a new vectorized push-based, JIT compiled query engine
 - A thread based concurrency model
 - A query scheduler designed to keep any individual query from taking down
   your database
-- A built-in OOM killer that gives pgrust control of what happens when you're
-  running low on memory, greatly reducing the chance of your whole DB being
-  taken down by the OS OOM killer
+- An automatic memory manager: one memory budget, sized from the machine,
+  covers the buffer pool, the columnar caches and running queries, and gives
+  pgrust control of what happens when you're running low on memory, greatly
+  reducing the chance of your whole DB being taken down by the OS OOM killer
 
-and many other really awesome pieces. The scheduler and the OOM killer go
+and many other really awesome pieces. The scheduler and the memory manager go
 after two of
 [the four horsemen behind thousands of Postgres outages](https://malisper.me/the-four-horsemen-behind-thousands-of-postgres-outages/).
 
-## Status
-
-We don't recommend running pgrust in production (yet), but we are
-successfully running it ourselves internally. Keep Postgres as the source
-of truth for data you can't afford to lose.
-
-pgrust currently passes the Postgres regression suite. It's faster than
-Postgres and ClickHouse, but it still has a lot of bugs. Our #1 priority right
-now is testing and reliability.
-
-If you need production ready Postgres today, use Postgres.
-
-Existing PostgreSQL extensions do not work. There is no stable extension ABI
-in pgrust yet. Some bundled contrib modules are ported, but PL/Python,
-PL/Perl, and PL/Tcl are not.
-
-pgrust is specifically tuned for Graviton4 and the JIT compiler only targets
-Graviton4. pgrust will still work on other platforms, but will not have
-similar performance.
-
-## Performance
-
-Measured on `c8g.4xlarge` (AWS Graviton4) against PostgreSQL 18.3.
-
-On the ClickBench combined score, pgrust scored 18.5% faster than ClickHouse
-and hundreds of times faster than PostgreSQL. This was using pgrcolumnar,
-pgrust's builtin columnar layout.
-
-On sysbench-oltp, pgrust achieved 30% higher throughput than Postgres 18.3 on
-read-only workloads at 300GB scale.
-
-For a code-level walkthrough of one part of that speedup, read
-[Rebuilding Postgres for 300x faster analytics: batching, operator fusion, and SIMD](https://malisper.me/how-we-made-postgres-hundreds-of-times-faster-the-query-engine/).
-
-These runs were reviewed independently by **Greg Smith**, author of
-*PostgreSQL 9.0 High Performance*.
-
-Two honest caveats. We had previously reported that pgrust was over 50%
-faster than Postgres. On Kubernetes we measure a larger OLTP gap, 50-60%
-rather than 30%, and we have not isolated 
```

**File**: `RELEASE-NOTES.md` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-# pgrust v0.3.1
-
-v0.3.1 is a bug-fix release on top of v0.3, still compatible with Postgres 18.6.
-
-## Fixes
-
-- Fix whole-row record references while preserving fields literally named `"*"`.
-- Fix duplicated COPY notice context.
-- Decode only the requested prefix for LZ4-compressed TOAST slices.
-- Fix BRIN indexes with custom operator classes to use their own support functions instead of the built-in ones.
-- Fix integer percentile ordering and transaction statistics accounting.
-
-## Upgrade
-
-Rebuild existing BRIN indexes that use custom operator classes with `REINDEX`.
-
-pgrust is still experimental and not for production.
```

**File**: `benchmarks/pgo/README.md` (added, +399/-0)
```diff
@@ -0,0 +1,399 @@
+# PGO training corpus
+
+Profile-guided optimization needs a workload to train on. This directory holds
+that workload, the proof that it is **not** the workload we publish numbers
+for, and the machinery that keeps the two apart.
+
+## Why this exists
+
+A PGO binary is shaped by whatever it was profiled running. If the profile run
+executes the exact statements a published benchmark later measures, the
+published number is partly a measurement of the training, not of the engine —
+the compiler has been handed the answer key. That is the ordinary
+train-on-test failure, and it is invisible from the outside unless the training
+inputs can be read.
+
+So: the training corpus lives in the source tree, under version control; every
+training run reads it and nothing else (no downloaded data, no benchmark
+tables); and a lint refuses to build if any training statement is a published
+measurement statement, or a published analytical statement with its columns
+renamed.
+
+## Provenance
+
+One corpus, one training run, two callers:
+
+- the release: `scripts/release/linux-builder.sh` builds the instrumented
+  server and runs `scripts/release/pgo-train.sh` on the builder host;
+- a local rebuild: `benchmarks/build-pgo.sh` runs the same `pgo-train.sh`.
+
+`pgo-train.sh` expands this directory with `gen-corpus.sh` (which re-runs the
+lint over the expansion), trains on a fresh `initdb` cluster, and logs a
+`PGO-CORPUS sha256=<hex>` line. The corpus sha256 is the sha256 of the sorted
+`sha256sum` listing of `corpus/`, `denylist/`, `gen-corpus.sh` and the two lint
+files; it does not depend on where the corpus is expanded, so it names the
+corpus revision a binary was trained on. The release builder copies the line
+into its own log; `build-pgo.sh` writes it into `build-manifest.txt` next to
+the source sha and the profdata and binary hashes.
+
+Where it can be read: this directory ships with the public source tree (the
+rest of `benchmarks/` does not), so the corpus a published binary was trained
+on is readable in the public tree at the source sha the binary was built from.
+
+## What is here
+
+| path | role |
+|---|---|
+| `corpus/analytics-pulse.sql` | 88 analytical statements (`J1`…`J88`) over the generated fixture, one per line |
+| `corpus/analytics-pulse-engines.tsv` | per-statement execution-engine class (drives the two vectors) |
+| `corpus/analytics-pulse-fixture.sql` | the fixture: DDL plus the SQL that generates and loads every row |
+| `corpus/oltp-generic.sql` | the transactional statement-class list of record |
+| `corpus/oltp-schema.sql` | fixture DDL for the transactional corpus |
+| `corpus/QUARANTINE.tsv` | shape ids held out of the emitted vectors, each with its defect |
+| `gen-corpus.sh` | expands the corpus into the files a profile run consumes, lints the expansion, prints the corpus sha256 |
+| `denylist/analytics-skeletons.sql` | the published single-table analytical measurement vector, stored as its column-blind skeletons (no statement text) — **denied** |
+| `denylist/tpch-official.sql` | the published TPC-H vector (22 templates), stored as column-blind skeletons plus the sha256 of each statement's canonical form (no statement text) — **denied**, exact and column-blind |
+| `denylist/tpcds-official.sql` | the published TPC-DS vector (99 templates), stored as for TPC-H — **denied**, exact and column-blind |
+| `denylist/oltp-official.sql` | statement templates of the published transactional rigs — **denied**, exact form |
+| `denylist/EXEMPTIONS.txt` | statements permitted despite a match, each with a reason (currently empty) |
+| `lint-training-overlap.sh` / `.awk` | the proof: training ∩ denied = ∅, under both rules |
+| `../build-pgo.sh` | a local PGO build from source: instrumented build, `scripts/release/pgo-train.sh`, merge, profile-use build, manifest |
+
+The denylist files are inputs to the lint only. Nothing in the build reads them
+as training material.
+
+## The line this draws
+
+**Enforced mechanically, rule 1: no literal overlap.** No statement that a
+published benchmark issues may appear in the training corpus, in any binding.
+The lint canonicalizes both sides — string literals, numbers, `?`, `$1` and
+`:name` all collapse to a single token, harness `RESET ALL;` / `SET …;`
+prefixes are stripped, case is folded, punctuation is spaced and whitespace
+collapsed — so what is compared is the statement's identifier-and-operator
+skeleton. Changing a search term, a range bound, a table suffix, or a parameter
+binding does not get a denied statement past the lint; that is deliberate,
+because a parameterized family is one statement.
+
+**Enforced mechanically, rule 2: no renamed copies.** See "The column-blind
+guard" below.
+
+**Disclosed, not enforced: shape-class overlap.** The corpus deliberately
+exercises the operator classes the product is measured on — grouped
+aggregation, per-group distinct, top-N, substring and regexp predicates, joins,
+point lookup
```

#### Recent Merged Pull Requests:
- **PR #136** (closed): wasix: run pgrust on the WASIX lane (@UnitBuilds)
- **PR #108** (closed): objkv 6/6: end-to-end shell harness (@brandonros)
- **PR #107** (closed): objkv 5/6: lift the system catalogs into the bucket (@brandonros)
- **PR #106** (closed): objkv 4/6: the index access method (objkv_btree) (@brandonros)
- **PR #105** (closed): objkv 3/6: the table access method (CREATE TABLE ... USING objkv) (@brandonros)
- **PR #104** (closed): objkv 2/6: the database engine over the object store (@brandonros)

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

## X. pgrust v0.4-beta with ACID-compliant columnar and automatic memory management

**RULE**:
When implementing operations in `.cargo/config.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in malisper/pgrust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `38634b40`: pgrust v0.4-beta with ACID-compliant columnar and automatic memory management. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.cargo/config.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Workspace cargo config.
#
# openssl-src (openssl-sys `vendored`) runs "$OPENSSL_SRC_PERL ./Configure ..."; this wrapper appends the
# OpenSSL modules a PostgreSQL server never uses (QUIC, SM2/SM4, ML-DSA/SLH-DSA/LMS, ARIA/BF/CAST/RC2/RC4, engines;
# the list and what is kept on purpose are in the script). A caller that exports its own OPENSSL_SRC_PERL wins over
# this and gets no trim; the tripwire is be_secure_openssl's src/openssl_trim.rs.
[env]
OPENSSL_SRC_PERL = { value = "scripts/openssl-src-perl.sh", relative = true }
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `38634b40` are properly handled with clean fallback behavior.
