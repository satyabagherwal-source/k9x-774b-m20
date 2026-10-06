# Forensic Learning Record (Deep Inspection): malisper/pgrust

> **Canonical Artifact**: `07_PROJECT_LEARNING/malisper-pgrust-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/malisper/pgrust](https://github.com/malisper/pgrust))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:12:56.705Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `malisper/pgrust`
- **Description**: Postgres rewritten in Rust, now faster than Postgres and Clickhouse
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5231 stars

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

            pub fn call $(<$($lt),+>)? ($($arg: $arg_ty),*) $(-> $ret)? {
                let raw = SLOT.load(::std::sync::atomic::Ordering::Relaxed);
                // SAFETY: set-once invariant (crate top) — always a valid `Signature`.
                let f: Signature = unsafe { ::std::mem::transmute::<*mut (), Signature>(raw) };
                f($($arg),*)
            }
        }
    };
}

// Link-time seam: direct `extern "Rust"` symbol; fat-LTO inlines the body.
// PRECONDITION: exactly one impl, always linked; test-mocked seams stay `seam!`.
#[macro_export]
macro_rules! seam_linktime {
    (
        link_name = $sym:literal;
        $(#[$attr:meta])*
        $vis:vis fn $name:ident $(<$($lt:lifetime),+ $(,)?>)? ( $($arg:ident : $arg_ty:ty),* $(,)? ) $(-> $ret:ty)?
    ) => {
        $(#[$attr])*
        $vis mod $name {
            #![allow(dead_code, unused_imports)]
            use super::*;

            pub type Signature = $(for<$($lt),+>)? fn($($arg_ty),*) $(-> $ret)?;

            pub const LINK_NAME: &str = $sym;

            extern "Rust" {
                #[link_name = $sym]
                fn __seam_impl $(<$($lt),+>)? ($($arg : $arg_ty),*) $(-> $ret)?;
            }

            #[inline(always)]
            pub fn call $(<$($lt),+>)? ($($arg : $arg_ty),*) $(-> $ret)? {
                // SAFETY: defined once by `seam_linktime_impl!`, const-checked against `Signature`.
                unsafe { __seam_impl($($arg),*) }
            }
        }
    };
}

#[macro_export]
macro_rules! seam_linktime_impl {
    (
        export_fn = $export:ident;
        link_name = $sym:literal;
        signature = $sigpath:path;
        impl = $imp:expr;
        fn $(<$($lt:lifetime),+ $(,)?>)? ( $($arg:ident : $arg_ty:ty),* $(,)? ) $(-> $ret:ty)?
    ) => {
        // Pins the impl to the consumer-facing Signature (no ABI drift).
        const _: () = {
            #[allow(unused)]
            const __SEAM_SIG_CHECK: $sigpath = $imp;
        };

        #[export_name = $sym]
        pub extern "Rust" fn $export $(<$($lt),+>)? ($($arg : $arg_ty),*) $(-> $ret)? {
            ($imp)($($arg),*)
        }
    };
}

#[cfg(test)]
mod tests {
    crate::seam!(pub fn double(x: i32) -> i32);
    crate::seam!(pub fn never_installed(x: i32) -> i32);
    crate::seam!(pub fn installed_twice(x: i32) -> i32);
    crate::seam!(pub fn first<'a>(xs: &'a [i32]) -> &'a i32);

    #[test]
    fn install_and_call() {
        assert!(!double::is_installed());
        double::set(|x| x * 2);
        assert!(double::is_installed());
        assert_eq!(double::call(21), 42);
    }

    #[test]
    #[should_panic(expected = "seam not installed: seam_core::tests::never_installed")]
    fn uninstalled_call_panics_with_path() {
        never_installed::call(1);
    }

    #[test]
    #[should_panic(expected = "seam installed twice: seam_core::tests::installed_twice")]
    fn double_install_panics_with_path() {
        installed_twice::set(|x| x);
        installed_twice::set(|x| x + 1);
    }

    #[test]
    fn lifetime_generic_seam_returns_borrow() {
        first::set(|xs| &xs[0]);
        let data = [7, 8, 9];
        assert_eq!(*first::call(&data), 7);
    }

    crate::tap!(pub fn counter(x: i32));
    crate::tap!(pub fn counter_empty(x: i32));
    crate::tap!(pub fn install_twice_tap(x: i32));
    crate::tap!(pub fn never_installed_tap(x: i32));

    #[test]
    fn tap_default_empty_and_call_if_skips() {
        // Its OWN tap, which no sibling test installs on: taps are
        // process-global and never uninstalled, so asserting emptiness of
        // the shared `counter` 
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
use ::types_error::PgResult;
use ::types_fmgr::{FmgrInfo, LocalFcinfo};
use ::types_tuple::TupleDescData;

use crate::{GistEntryVector, GistSplitVec, GISTENTRY};

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
        self.unionFn[attno].invoke(&mut self.frame2)
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
        Ok(r.as_f64())
    }
}

// ---------------------------------------------------------------------------
// Scan opaque (gist_private.h GISTScanOpaqueData).
// ---------------------------------------------------------------------------

use ::mcx::MemoryContext;
use ::types_core::{BlockNumber, InvalidBlockNumber, OffsetNumber, XLogRecPtr};
use ::types_tuple::itemptr::ItemPointerData;

// IndexOrderByDistance (access/genam.h).
#[derive(Clone, Copy, Debug, Default)]
pub struct IndexOrderByDistance {
    pub value: f64,
    pub isnull: bool,
}

// Ordered-scan reconstructed index tuple: an owned 8-aligned image (itup
// deform requires MAXALIGN), living as long as its queue item + one
// getNextNearest return.
#[derive(Clone, Debug)]
pub struct ReconTup(Box<[u64]>);

impl ReconTup {
    pub fn from_bytes(b: &[u8]) -> Self {
        let mut v = vec![0u64; b.len().div_ceil(8)];
        // SAFETY: the u64 buffer spans >= b.len() bytes.
        unsafe {
            core::ptr::copy_nonoverlapping(b.as_ptr(), v.as_mut_ptr().cast::<u8>(), b.len());
        }
        ReconTup(v.into_boxed_slice())
    }
    pub fn as_ptr(&self) -> *const u8 {
        self.0.as_ptr().cast()
    }
}

// Ordered-scan leaf payload (C GISTSearc
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

### Core Architecture Module: `crates/_support/types/types_core/src/fmgr.rs`
```
pub const INDEX_MAX_KEYS: i32 = 32;
pub const NAMEDATALEN: i32 = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IOFuncSelector {
    Input,
    Output,
    Receive,
    Send,
}

pub const PG_VERSION_NUM: i32 = 180_003;

pub const FLOAT8PASSBYVAL: i32 = 1;

pub const FMGR_ABI_EXTRA: [u8; 32] = [
    b'P', b'o', b's', b't', b'g', b'r', b'e', b'S', b'Q', b'L', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

pub const PG_MAGIC_FUNCTION_NAME_STRING: &str = "Pg_magic_func";

pub const PG_INIT_FUNCTION_NAME_STRING: &str = "_PG_init";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PgAbiValues {
    pub version: i32,
    pub funcmaxargs: i32,
    pub indexmaxkeys: i32,
    pub namedatalen: i32,
    pub float8byval: i32,
    pub abi_extra: [u8; 32],
}

impl PgAbiValues {
    pub const fn server() -> Self {
        Self {
            version: PG_VERSION_NUM / 100,
            funcmaxargs: crate::primitive::FUNC_MAX_ARGS as i32,
            indexmaxkeys: INDEX_MAX_KEYS,
            namedatalen: NAMEDATALEN,
            float8byval: FLOAT8PASSBYVAL,
            abi_extra: FMGR_ABI_EXTRA,
        }
    }
}

// `fn_addr` is an opaque address (`0` = unresolved): the typed `PGFunction`
// shape lives in the nodes layer, which this crate must not depend on.
#[derive(Clone, Debug, Default)]
pub struct FmgrInfo {
    pub fn_addr: usize,
    pub fn_oid: crate::primitive::Oid,
    pub fn_nargs: i16,
    pub fn_strict: bool,
    pub fn_retset: bool,
    pub fn_stats: u8,
    // C's `fmNodePtr fn_expr`, carried erased; `None` is C's NULL.
    pub fn_expr: Option<FnExprErased>,
}

// C: build_aggregate_transfn_expr/build_aggregate_finalfn_expr's constructed
// FuncExpr, reduced to its consumers (get_fn_expr_argtype +
// get_fn_expr_rettype/get_call_result_type): `rettype` is the fake FuncExpr's
// funcresulttype (the transtype for transfns, the aggregate result type for
// finalfns); `argtypes` slot 0 is the transition type, slots 1.. the
// aggregate input types; `variadic` is the fake FuncExpr's funcvariadic
// (agg_variadic for transfns). The slice is arena-backed with the lifetime
// forgotten (from_node_ref's contract); Copy, so FmgrInfo stays drop-free.
#[derive(Clone, Copy)]
pub struct AggFnArgTypes {
    pub rettype: crate::primitive::Oid,
    pub argtypes: &'static [crate::primitive::Oid],
    pub variadic: bool,
}

// Erased `fn_expr` carrier: the node is a `types-nodes` `Expr` this crate
// must not name. Copy raw pointer — C copies the bare `fmNodePtr`; the arena
// owns the node, so FmgrInfo carries no drop glue.
#[derive(Clone, Copy)]
pub struct FnExprErased(*const dyn core::any::Any);

impl FnExprErased {
    /// # Safety
    /// `expr`'s backing context must outlive every `downcast_ref` read of
    /// this carrier (the resolved-once FmgrInfo dies with the plan it serves).
    /// `STATIC` must be the `'static` form of the caller's `'mcx`-branded
    /// node type (same concrete type, lifetime forgotten).
    pub unsafe fn from_node_ref<STATIC: core::any::Any>(expr: &STATIC) -> Self {
        Self(expr as &dyn core::any::Any as *const dyn core::any::Any)
    }

    pub fn downcast_ref<T: core::any::Any>(&self) -> Option<&T> {
        // SAFETY: pointee live per from_node_ref's contract.
        unsafe { (*self.0).downcast_ref::<T>() }
    }
}

impl core::fmt::Debug for FnExprErased {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("FnExprErased(<fn_expr node>)")
    }
}

impl FmgrInfo {
    pub fn empty() -> Self {
        Self {
            fn_addr: 0,
            fn_oid: 0,
            fn_nargs: 0,
            fn_strict: false,
            fn_retset: false,
            fn_stats: 0,
            fn_expr: None,
        }
    }
}

pub const F_INT4EQ: crate::primitive::RegProcedure = 65;
pub const F_INT4GE: crate::primitive::RegProcedure = 150;
pub const F_OIDEQ: crate::primitive::RegProcedure = 184;
pub const F_TEXTEQ: crate::primitive::RegProcedure = 67;
pub const F_INT2EQ: crate::primitive::RegProcedure = 63;
pub const F_INT2GT: crate::primitive::RegProcedure = 146;
pub const F_NAMEEQ: crate::primitive::RegProcedure = 62;
pub const F_BOOLEQ: crate::primitive::RegProcedure = 60;
pub const F_CHAREQ: crate::primitive::RegProcedure = 61;
pub const F_CHARNE: crate::primitive::RegProcedure = 70;

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, PartialEq)]
    struct FakeExpr {
        argtypes: [u32; 2],
    }

    #[test]
    fn fn_expr_erased_round_trips() {
        let mut finfo = FmgrInfo::empty();
        assert!(finfo.fn_expr.is_none());

        let expr = FakeExpr { argtypes: [23, 25] };
        // SAFETY: `expr` outlives every read below.
        finfo.fn_expr = Some(unsafe { FnExprErased::from_node_ref(&expr) });

        let recovered = finfo
            .fn_expr
            .as_ref()
            .and_then(|e| e.downcast_ref::<FakeExpr>())
            .expect("fn_expr downcasts to the stamped type");
        assert_eq!(recovered.argtypes, [23, 25]);

        let cloned = finfo.clone();
        let recovered2 = cloned
            .fn_expr
            .as_ref()
            .and_then(|e| e.downcast_ref::<FakeExpr>())
            .expect("cloned fn_expr still downcasts");
        assert_eq!(recovered2.argtypes, [23, 25]);

        assert!(finfo
            .fn_expr
            .as_ref()
            .and_then(|e| e.downcast_ref::<u64>())
            .is_none());
    }
}

```

### Core Architecture Module: `crates/_support/types/types_core/src/geo.rs`
```
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    // Panics on a too-short image — a caller bug, as C would misread too.
    #[inline]
    pub fn from_datum_bytes(bytes: &[u8]) -> Point {
        let mut x = [0u8; 8];
        let mut y = [0u8; 8];
        x.copy_from_slice(&bytes[0..8]);
        y.copy_from_slice(&bytes[8..16]);
        Point {
            x: f64::from_ne_bytes(x),
            y: f64::from_ne_bytes(y),
        }
    }

    #[inline]
    pub fn to_datum_bytes(&self) -> [u8; 16] {
        let mut out = [0u8; 16];
        out[0..8].copy_from_slice(&self.x.to_ne_bytes());
        out[8..16].copy_from_slice(&self.y.to_ne_bytes());
        out
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct LSEG {
    pub p: [Point; 2],
}

impl LSEG {
    #[inline]
    pub fn from_datum_bytes(bytes: &[u8]) -> LSEG {
        LSEG {
            p: [
                Point::from_datum_bytes(&bytes[0..16]),
                Point::from_datum_bytes(&bytes[16..32]),
            ],
        }
    }

    #[inline]
    pub fn to_datum_bytes(&self) -> [u8; 32] {
        let mut out = [0u8; 32];
        out[0..16].copy_from_slice(&self.p[0].to_datum_bytes());
        out[16..32].copy_from_slice(&self.p[1].to_datum_bytes());
        out
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct LINE {
    pub A: f64,
    pub B: f64,
    pub C: f64,
}

impl LINE {
    #[inline]
    pub fn from_datum_bytes(bytes: &[u8]) -> LINE {
        let f = |o: usize| {
            let mut a = [0u8; 8];
            a.copy_from_slice(&bytes[o..o + 8]);
            f64::from_ne_bytes(a)
        };
        LINE {
            A: f(0),
            B: f(8),
            C: f(16),
        }
    }

    #[inline]
    pub fn to_datum_bytes(&self) -> [u8; 24] {
        let mut out = [0u8; 24];
        out[0..8].copy_from_slice(&self.A.to_ne_bytes());
        out[8..16].copy_from_slice(&self.B.to_ne_bytes());
        out[16..24].copy_from_slice(&self.C.to_ne_bytes());
        out
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct CIRCLE {
    pub center: Point,
    pub radius: f64,
}

impl CIRCLE {
    #[inline]
    pub fn from_datum_bytes(bytes: &[u8]) -> CIRCLE {
        let mut radius = [0u8; 8];
        radius.copy_from_slice(&bytes[16..24]);
        CIRCLE {
            center: Point::from_datum_bytes(&bytes[0..16]),
            radius: f64::from_ne_bytes(radius),
        }
    }

    #[inline]
    pub fn to_datum_bytes(&self) -> [u8; 24] {
        let mut out = [0u8; 24];
        out[0..16].copy_from_slice(&self.center.to_datum_bytes());
        out[16..24].copy_from_slice(&self.radius.to_ne_bytes());
        out
    }
}

// `offsetof(PATH, p)`: fixed header before the flexible `Point` array.
pub const PATH_HEADER_SIZE: usize = 16;

// `offsetof(POLYGON, p)`: fixed header before the flexible `Point` array.
pub const POLYGON_HEADER_SIZE: usize = 40;

// `high` = upper-right, `low` = lower-left; field order is the C image order.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BOX {
    pub high: Point,
    pub low: Point,
}

impl BOX {
    #[inline]
    pub fn from_datum_bytes(bytes: &[u8]) -> BOX {
        BOX {
            high: Point::from_datum_bytes(&bytes[0..16]),
            low: Point::from_datum_bytes(&bytes[16..32]),
        }
    }

    #[inline]
    pub fn to_datum_bytes(&self) -> [u8; 32] {
        let mut out = [0u8; 32];
        out[0..16].copy_from_slice(&self.high.to_datum_bytes());
        out[16..32].copy_from_slice(&self.low.to_datum_bytes());
        out
    }
}

// The decoded SP-GiST ordering-scan key: leaf key = point, inner key = box.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SpgKey {
    LeafPoint(Point),
    InnerBox(BOX),
}

// gistproc.c:1575-1581 point_zorder_internal: Morton code over the two
// float32-narrowed coordinates (C's float4 parameters narrow the point's
// float8 members at the call).
pub fn point_zorder_internal(x: f32, y: f32) -> u64 {
    let ix = ieee_float32_to_uint32(x);
    let iy = ieee_float32_to_uint32(y);
    part_bits32_by2(ix) | (part_bits32_by2(iy) << 1)
}

// gistproc.c:1586-1596 part_bits32_by2.
fn part_bits32_by2(x: u32) -> u64 {
    let mut n = x as u64;
    n = (n | (n << 16)) & 0x0000FFFF0000FFFF;
    n = (n | (n << 8)) & 0x00FF00FF00FF00FF;
    n = (n | (n << 4)) & 0x0F0F0F0F0F0F0F0F;
    n = (n | (n << 2)) & 0x3333333333333333;
    n = (n | (n << 1)) & 0x5555555555555555;
    n
}

// gistproc.c:1603-1671 ieee_float32_to_uint32: order-preserving sign-magnitude
// map; negatives bit-flipped into 0-7FFFFFFE, positives/zeros ORed into
// 80000000-FFFFFFFE, every NaN to FFFFFFFF.
fn ieee_float32_to_uint32(f: f32) -> u32 {
    if f.is_nan() {
        return 0xFFFFFFFF;
    }
    let i = f.to_bits();
    if (i & 0x80000000) != 0 {
        i ^ 0xFFFFFFFF
    } else {
        i | 0x80000000
    }
}

// gistproc.c:1681-1701 gist_bbox_zorder_cmp over the leaf-key box's low
// corner; the leading float8 equality check is C's abbrev tie-break fast path.
pub fn gist_bbox_zorder_cmp(a: &BOX, b: &BOX) -> i32 {
    let (p1, p2) = (&a.low, &b.low);
    if p1.x == p2.x && p1.y == p2.y {
        return 0;
    }
    let z1 = point_zorder_internal(p1.x as f32, p1.y as f32);
    let z2 = point_zorder_internal(p2.x as f32, p2.y as f32);
    (z1 > z2) as i32 - (z1 < z2) as i32
}

#[cfg(test)]
mod zorder_tests {
    use super::*;

    fn pbox(x: f64, y: f64) -> BOX {
        let p = Point { x, y };
        BOX { high: p, low: p }
    }

    // Hand-computed interleavings: float32 map first (0.0 -> 0x80000000,
    // 1.0 -> 0xBF800000, -1.0 -> 0x407FFFFF, NaN -> 0xFFFFFFFF), then each
    // bit k lands at 2k (x) / 2k+1 (y).
    #[test]
    fn zorder_bit_exact() {
        assert_eq!(point_zorder_internal(0.0, 0.0), 0xC000000000000000);
        assert_eq!(point_zorder_internal(1.0, 1.0), 0xCFFFC00000000000);
        assert_eq!(point_zorder_internal(-1.0, 0.0), 0x9000155555555555);
        assert_eq!(point_zorder_internal(f32::NAN, f32::NAN), 0xFFFFFFFFFFFFFFFF);
        assert_eq!(part_bits32_by2(0xFFFFFFFF), 0x5555555555555555);
        assert_eq!(part_bits32_by2(0b11), 0b101);
        assert_eq!(ieee_float32_to_uint32(-0.0), 0x7FFFFFFF);
        assert_eq!(ieee_float32_to_uint32(0.0), 0x80000000);
        assert_eq!(ieee_float32_to_uint32(f32::NEG_INFINITY), 0x007FFFFF);
        assert_eq!(ieee_float32_to_uint32(f32::INFINITY), 0xFF800000);
    }

    #[test]
    fn bbox_cmp_ordering() {
        assert_eq!(gist_bbox_zorder_cmp(&pbox(0.0, 0.0), &pbox(0.0, 0.0)), 0);
        assert_eq!(gist_bbox_zorder_cmp(&pbox(1.0, 1.0), &pbox(0.0, 0.0)), 1);
        assert_eq!(gist_bbox_zorder_cmp(&pbox(-1.0, 0.0), &pbox(0.0, 0.0)), -1);
        // NaNs: float8 equality fails, z-values tie at all-ones.
        assert_eq!(gist_bbox_zorder_cmp(&pbox(f64::NAN, f64::NAN), &pbox(f64::NAN, f64::NAN)), 0);
        assert_eq!(gist_bbox_zorder_cmp(&pbox(f64::NAN, f64::NAN), &pbox(1e30, 1e30)), 1);
        // y's bits interleave above x's: (2,3) carries bit45, (3,2) bit44.
        assert_eq!(gist_bbox_zorder_cmp(&pbox(2.0, 3.0), &pbox(3.0, 2.0)), 1);
    }
}

```

### Core Architecture Module: `crates/_support/types/types_core/src/init.rs`
```
// Discriminants match the C enum order: used in protocol and stats indexing.
#[repr(u32)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum BackendType {
    Invalid = 0,
    Backend,
    DeadEndBackend,
    AutovacLauncher,
    AutovacWorker,
    BgWorker,
    WalSender,
    SlotsyncWorker,
    StandaloneBackend,
    Archiver,
    BgWriter,
    Checkpointer,
    IoWorker,
    Startup,
    WalReceiver,
    WalSummarizer,
    WalWriter,
    Logger,
}

impl BackendType {
    pub const ALL: [BackendType; BACKEND_NUM_TYPES] = [
        BackendType::Invalid,
        BackendType::Backend,
        BackendType::DeadEndBackend,
        BackendType::AutovacLauncher,
        BackendType::AutovacWorker,
        BackendType::BgWorker,
        BackendType::WalSender,
        BackendType::SlotsyncWorker,
        BackendType::StandaloneBackend,
        BackendType::Archiver,
        BackendType::BgWriter,
        BackendType::Checkpointer,
        BackendType::IoWorker,
        BackendType::Startup,
        BackendType::WalReceiver,
        BackendType::WalSummarizer,
        BackendType::WalWriter,
        BackendType::Logger,
    ];
}

pub const BACKEND_NUM_TYPES: usize = BackendType::Logger as usize + 1;

#[repr(u32)]
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum ProcessingMode {
    BootstrapProcessing = 0,
    InitProcessing,
    NormalProcessing,
}

use crate::primitive::{InvalidOid, Oid};

pub const SECURITY_LOCAL_USERID_CHANGE: i32 = 0x1;
pub const SECURITY_RESTRICTED_OPERATION: i32 = 0x2;
pub const SECURITY_NOFORCE_RLS: i32 = 0x4;

// `save_nestlevel` sentinel meaning no GUC nest level was created.
pub const USER_CONTEXT_NO_NEST_LEVEL: i32 = -1;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub struct UserContext {
    pub save_userid: Oid,
    pub save_sec_context: i32,
    pub save_nestlevel: i32,
}

impl UserContext {
    pub const fn new(save_userid: Oid, save_sec_context: i32, save_nestlevel: i32) -> Self {
        Self {
            save_userid,
            save_sec_context,
            save_nestlevel,
        }
    }

    pub const fn uninitialized() -> Self {
        Self {
            save_userid: InvalidOid,
            save_sec_context: 0,
            save_nestlevel: USER_CONTEXT_NO_NEST_LEVEL,
        }
    }
}

impl Default for UserContext {
    fn default() -> Self {
        Self::uninitialized()
    }
}

pub type UserAuth = u32;
pub const uaReject: UserAuth = 0;
pub const uaImplicitReject: UserAuth = 1;
pub const uaTrust: UserAuth = 2;
pub const uaIdent: UserAuth = 3;
pub const uaPassword: UserAuth = 4;
pub const uaMD5: UserAuth = 5;
pub const uaSCRAM: UserAuth = 6;
pub const uaGSS: UserAuth = 7;
pub const uaSSPI: UserAuth = 8;
pub const uaPAM: UserAuth = 9;
pub const uaBSD: UserAuth = 10;
pub const uaLDAP: UserAuth = 11;
pub const uaCert: UserAuth = 12;
pub const uaRADIUS: UserAuth = 13;
pub const uaPeer: UserAuth = 14;
pub const uaOAuth: UserAuth = 15;

```

### Core Architecture Module: `crates/_support/types/types_core/src/instrument.rs`
```
pub const NS_PER_S: i64 = 1_000_000_000;

pub const NS_PER_MS: i64 = 1_000_000;

// A monotonic-clock reading or interval, in nanosecond ticks.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct instr_time {
    pub ticks: i64,
}

impl instr_time {
    pub fn set_zero(&mut self) {
        self.ticks = 0;
    }

    pub fn is_zero(self) -> bool {
        self.ticks == 0
    }

    pub fn add(&mut self, y: instr_time) {
        self.ticks += y.ticks;
    }

    pub fn subtract(&mut self, y: instr_time) {
        self.ticks -= y.ticks;
    }

    pub fn accum_diff(&mut self, y: instr_time, z: instr_time) {
        self.ticks += y.ticks - z.ticks;
    }

    pub fn get_double(self) -> f64 {
        self.ticks as f64 / NS_PER_S as f64
    }

    pub fn get_millisec(self) -> f64 {
        self.ticks as f64 / NS_PER_MS as f64
    }

    pub fn get_microsec(self) -> u64 {
        (self.ticks / NS_PER_US) as u64
    }
}

pub const NS_PER_US: i64 = 1_000;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct BufferUsage {
    pub shared_blks_hit: i64,
    pub shared_blks_read: i64,
    pub shared_blks_dirtied: i64,
    pub shared_blks_written: i64,
    pub local_blks_hit: i64,
    pub local_blks_read: i64,
    pub local_blks_dirtied: i64,
    pub local_blks_written: i64,
    pub temp_blks_read: i64,
    pub temp_blks_written: i64,
    pub shared_blk_read_time: instr_time,
    pub shared_blk_write_time: instr_time,
    pub local_blk_read_time: instr_time,
    pub local_blk_write_time: instr_time,
    pub temp_blk_read_time: instr_time,
    pub temp_blk_write_time: instr_time,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct SerializeMetrics {
    pub timeSpent: instr_time,
    pub bytesSent: u64,
    pub bufferUsage: BufferUsage,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct WalUsage {
    pub wal_records: i64,
    pub wal_fpi: i64,
    /// `uint64` in C; arithmetic on it is unsigned (modular).
    pub wal_bytes: u64,
    pub wal_buffers_full: i64,
}

pub type InstrumentOption = i32;

pub const INSTRUMENT_TIMER: InstrumentOption = 1 << 0;
pub const INSTRUMENT_BUFFERS: InstrumentOption = 1 << 1;
pub const INSTRUMENT_ROWS: InstrumentOption = 1 << 2;
pub const INSTRUMENT_WAL: InstrumentOption = 1 << 3;
pub const INSTRUMENT_ALL: InstrumentOption = i32::MAX;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Instrumentation {
    pub need_timer: bool,
    pub need_bufusage: bool,
    pub need_walusage: bool,
    pub async_mode: bool,
    pub running: bool,
    pub starttime: instr_time,
    pub counter: instr_time,
    pub firsttuple: f64,
    pub tuplecount: f64,
    pub bufusage_start: BufferUsage,
    pub walusage_start: WalUsage,
    pub startup: f64,
    pub total: f64,
    pub ntuples: f64,
    pub ntuples2: f64,
    pub nloops: f64,
    pub nfiltered1: f64,
    pub nfiltered2: f64,
    pub bufusage: BufferUsage,
    pub walusage: WalUsage,
}

/// EA-on-morsels pipeline report (pgrust-fast docs/design/ea-morsels.md §4;
/// no C counterpart). One record per engaged runtime pipeline phase,
/// constructed by the arm's leader merge on a clean Completed outcome and
/// read by EXPLAIN through the query_desc_runtime_ea_pipeline seam. All
/// counters are EXACT merges of per-worker instrument partials; timing
/// fields are zero under TIMING OFF and MUST NOT be printed as times then
/// (never fake a time).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RuntimeEaPipeline {
    /// The engaged pipeline's breaker (root) node — the block prints here.
    pub root_node_id: i32,
    /// Bypassed member nodes marked in EXPLAIN (-1 = unused slot). The m2
    /// arms have one (SeqScan) or two (SeqScan + skipped Sort).
    pub member_node_id: i32,
    pub member2_node_id: i32,
    /// Arm vocabulary: "scan" | "agg" | "distinct" (extensible).
    pub arm: &'static str,
    /// Phase role: "accept" ("combine"/"probe"/"fill" reserved for later
    /// arms and the m3 extension points).
    pub role: &'static str,
    pub taskset_index: u32,
    pub taskset_count: u32,
    /// Workers that executed at least one claim.
    pub workers: u32,
    pub claims: u64,
    /// Claim epoch segments (= claims until the dop1-tax coalescing split
    /// is threaded through).
    pub epoch_segments: u64,
    pub granules: u64,
    pub rows_scanned: u64,
    pub rows_survived: u64,
    /// Exported partials merged by the leader (scan: non-empty result
    /// partials; sinks: participating workers).
    pub partials: u64,
    /// Scan-descriptor fold: [granules_scanned, granules_pruned,
    /// granules_bloom_pruned, granules_meta, granules_bound_skipped,
    /// blocks_pruned, windows_staged].
    pub prune: [u64; 7],
    /// TIMING ON only (inc-3); zero under TIMING OFF.
    pub busy_ns: u64,
    pub first_start_ns: u64,
    pub last_end_ns: u64,
    /// min over workers' last_end (finish spread = last_end - this).
    pub min_last_end_ns: u64,
    /// min/max per-claim wall ns.
    pub morsel_min_ns: u64,
    pub morsel_max_ns: u64,
}

/// EXPLAIN (ENGINE) wire vocabulary (pgrust-fast single-executor Phase 0.2;
/// no C counterpart): which engine owned a plan node's execution. Mirror of
/// `executils::EngineKind` — the seam crate cannot depend on executils, so
/// this repr(u8) twin rides the seam (`query_desc_engine_events`), the same
/// home as `RuntimeEaPipeline`.
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EngineKindWire {
    /// Serial lane-v2 push pipeline owns the node (production verdict).
    Lane = 0,
    /// Volcano row spine runs it (detail carries the refusal reason; "" if
    /// the node was never offered to a lane).
    Spine = 1,
    /// Spine refusal whose reason is admission-economics-fused-drive — the
    /// legacy fused batch arm owns the shape (displayed "spine/fused-arm").
    FusedArm = 2,
    /// Morsel-runtime arm engaged (pipeline identity via RuntimeEaPipeline).
    Runtime = 3,
    /// sqe stencil engine owns the node (P2-1 dispatch; detail carries the
    /// stencil family on "engaged", the refusal variant key on "refused").
    Sqe = 4,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum TuplesortMethod {
    #[default]
    StillInProgress,
    TopNHeapsort,
    Quicksort,
    ExternalSort,
    ExternalMerge,
}

impl TuplesortMethod {
    /// C TuplesortMethod bit value (tuplesort.h); StillInProgress is 0.
    pub fn bit(self) -> u32 {
        match self {
            TuplesortMethod::StillInProgress => 0,
            TuplesortMethod::TopNHeapsort => 1 << 0,
            TuplesortMethod::Quicksort => 1 << 1,
            TuplesortMethod::ExternalSort => 1 << 2,
            TuplesortMethod::ExternalMerge => 1 << 3,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            TuplesortMethod::StillInProgress => "still in progress",
            TuplesortMethod::TopNHeapsort => "top-N heapsort",
            TuplesortMethod::Quicksort => "quicksort",
            TuplesortMethod::ExternalSort => "external sort",
            TuplesortMethod::ExternalMerge => "external merge",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum TuplesortSpaceType {
    Disk,
    #[default]
    Memory,
}

impl TuplesortSpaceType {
    pub fn name(self) -> &'static str {
        match self {
            TuplesortSpaceType::Disk => "Disk",
            TuplesortSpaceType::Memory => "Memory",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct TuplesortInstrumentation {
    pub sortMethod: TuplesortMethod,
    pub spaceType: TuplesortSpaceType,
    pub spaceUsed: i64,
}

/// C IncrementalSortGroupInfo (execnodes.h); sortMethods is the C bitmask of
/// TuplesortMethod bits.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct IncrementalSortGroupInfo {
    pub groupCount: i64,
    pub maxDiskSpaceUsed: i64,
    pub totalDiskSpaceUsed: i64,
    pub maxMemorySpaceUsed: i64,
    pub totalMemorySpaceUsed: i64,
    pub sortMethods: u32,
}

impl IncrementalSortGroupInfo {
    /// C instrumentSortedGroup (nodeIncrementalSort.c).
    pub fn record(&mut self, stats: &TuplesortInstrumentation) {
        self.groupCount += 1;
        match stats.spaceType {
            TuplesortSpaceType::Disk => {
                self.totalDiskSpaceUsed += stats.spaceUsed;
                self.maxDiskSpaceUsed = self.maxDiskSpaceUsed.max(stats.spaceUsed);
            }
            TuplesortSpaceType::Memory => {
                self.totalMemorySpaceUsed += stats.spaceUsed;
                self.maxMemorySpaceUsed = self.maxMemorySpaceUsed.max(stats.spaceUsed);
            }
        }
        self.sortMethods |= stats.sortMethod.bit();
    }
}

/// C IncrementalSortInfo (execnodes.h).
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct IncrementalSortInfo {
    pub fullsortGroupInfo: IncrementalSortGroupInfo,
    pub prefixsortGroupInfo: IncrementalSortGroupInfo,
}

// C AggregateInstrumentation (nodeAgg.h) + hash_planned_partitions (an
// AggState field in C; rides this carrier so EXPLAIN reads one struct).
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct AggregateInstrumentation {
    pub hash_mem_peak: u64,
    pub hash_disk_used: u64,
    pub hash_batches_used: i32,
    pub hash_planned_partitions: i32,
}

// tuplestore_get_stats output (tuplestore.c); space_type reuses the
// Memory/Disk vocabulary tuplesort displays share.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct TuplestoreInstrumentation {
    pub space_type: TuplesortSpaceType,
    pub max_space: i64,
}

// C MemoizeInstrumentation (execnodes.h).
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct MemoizeInstrumentation {
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_evictions: u64,
    pub cache_overflows: u64,
    pub mem_peak: u64,
}

// C BitmapHeapScanInstrumentation (execnodes.h).
#[derive(Clone, Copy, Debu
```

### Core Architecture Module: `crates/_support/types/types_core/src/keywords.rs`
```
// Values match C's UNRESERVED_KEYWORD..RESERVED_KEYWORD defines.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeywordCategory {
    Unreserved = 0,
    ColumnName = 1,
    TypeOrFunctionName = 2,
    Reserved = 3,
}

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

Co-Authored-By: Fable <[REDACTED_EMAIL]>



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
