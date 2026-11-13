# Verification Protocol: Verification Protocol: Empirical Defect Shield for matthart1983-netwatch-learnings

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983-netwatch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:41:15.514Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-matthart1983-netwatch-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983-netwatch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:41:15.514Z`  
> **Learning ID**: `LEARN-REEXTRACT-matthart1983-netwatch-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `matthart1983-netwatch-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matthart1983-netwatch-learnings.md`  
> **Source**: github ([https://github.com/matthart1983/netwatch](https://github.com/matthart1983/netwatch))  
> **Source Version**: `81275065`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T19:07:04.901Z  
> **Learning ID**: `learn-github-matthart1983-netwatch`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): matthart1983/netwatch

> **Canonical Artifact**: `07_PROJECT_LEARNING/matthart1983-netwatch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/matthart1983/netwatch](https://github.com/matthart1983/netwatch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T19:07:04.367Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `matthart1983/netwatch`
- **Description**: Network diagnostics in your terminal. Inspect traffic, connections and network behaviour. Built with Rust.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3584 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/diagnose/engine.rs`
```
//! The evaluator: detections in, a stable `Vec<Issue>` out.
//!
//! Everything a user sees about what is wrong reads from [`Engine::issues`] —
//! the Diagnose tab, the verdict line under the tab bar on every other tab,
//! the timeline events, the toast, and the exported report. There is exactly
//! one list, so those six surfaces cannot disagree with each other.
//!
//! The engine's real job is *continuity*. A resolver that has been slow for an
//! hour is one issue with a growing window, not 3,600 findings; a resolver
//! that flaps every few minutes is one issue with a recurrence count, not
//! twenty. Detectors are stateless and fire every tick — turning that into a
//! stable, human-sized list of findings happens here.

use chrono::{DateTime, Duration, Local, TimeZone};
use std::collections::{HashMap, HashSet};

use super::baseline::{BaselineStore, SigmaFloor};
use super::detectors::{self, Detection, Observations, Thresholds};
use super::issue::{Issue, IssueId, IssueState, Kind, Severity};
use super::rules;

/// Time source. A trait so the fixture and the tests can pin the clock and
/// produce byte-identical reports.
pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Local>;
}

pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Local> {
        Local::now()
    }
}

/// A clock frozen at one instant, then advanced by hand.
pub struct FixedClock {
    at: std::sync::Mutex<DateTime<Local>>,
}

impl FixedClock {
    pub fn at(s: &str) -> Self {
        let naive = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
            .expect("fixed clock needs YYYY-MM-DD HH:MM:SS");
        let at = Local
            .from_local_datetime(&naive)
            .single()
            .expect("unambiguous local time");
        Self {
            at: std::sync::Mutex::new(at),
        }
    }

    pub fn advance_secs(&self, secs: i64) {
        let mut g = self.at.lock().unwrap();
        *g += Duration::seconds(secs);
    }
}

impl Clock for FixedClock {
    fn now(&self) -> DateTime<Local> {
        *self.at.lock().unwrap()
    }
}

impl FixedClock {
    /// Move the clock to a recorded timestamp. `false` if it doesn't parse.
    pub fn set(&self, s: &str) -> bool {
        let Some(at) = parse_ts(s) else {
            return false;
        };
        *self.at.lock().unwrap() = at;
        true
    }
}

/// A shared handle, so a caller can keep setting the clock an engine owns.
impl Clock for std::sync::Arc<FixedClock> {
    fn now(&self) -> DateTime<Local> {
        self.as_ref().now()
    }
}

/// The completion time of the collector a rule's evidence comes from.
/// `None` for rules with no single sampling collector; `Some(None)` when the
/// collector exists but hasn't completed.
///
/// `subject` matters for the per-target rules: evidence about one target is
/// not evidence about another, however recently the other was probed.
fn sample_time(
    rule: &str,
    subject: &super::issue::Subject,
    times: &ObservationTimes,
) -> Option<Option<std::time::Instant>> {
    if rule == "ipv6.broken" {
        Some(times.ipv6)
    } else if rule == "captive.portal" {
        Some(times.portal)
    } else if rule == "pmtu.blackhole" {
        Some(times.pmtu)
    } else if matches!(rule, "tcp.connect_failures" | "tcp.timewait_exhaustion") {
        Some(times.kernel)
    } else if rule.starts_with("egress.") {
        Some(times.egress)
    } else if rule.starts_with("dns.") {
        Some(times.health.dns)
    } else if rule.starts_with("gateway.") {
        Some(times.health.gateway)
    } else if rule.starts_with("nat.") {
        Some(times.health.nat)
    } else if rule.starts_with("link.") || rule.starts_with("iface.") || rule.starts_with("wifi.") {
        Some(times.interface)
    } else if rule.starts_with("path.") {
        Some(times.path)
    } else if rule.starts_with("tcp.") && rule != "tcp.bufferbloat_local" {
        Some(times.sockets)
    } else if rule.starts_with("target.") {
        match subject {
            super::issue::Subject::Target { name } => Some(times.targets.get(name).copied()),
            // A target rule filed against something else has no per-target
            // clock to read; treat it as unsampled rather than borrowing
            // another target's.
            _ => Some(None),
        }
    } else {
        None
    }
}

/// Why an open issue's subject has gone away, or `None` while it may still be
/// there. Gone is a positive finding about the subject, never an absence of
/// readings about it: an unmeasured gateway, a stale probe or a collector
/// that did not run leaves the issue open, however long it lasts.
///
/// | Subject | Gone when |
/// |---|---|
/// | Socket | the sockets collector is fresh (≤ 30 s), the rule's coverage is available or has no subjects, and no socket matches |
/// | Target | its name has left the config, or no entry under its name has the revision the issue was found under |
/// | Resolver | it has left the system resolvers, and so has any resolver an applied step switched to |
/// | Path (`path.*`) | it was the periodic trace target while open, periodic tracing is still on, and the trace target is now another |
/// | Iface | the interface collector is fresh (≤ 15 s) and does not read it, and the platform no longer lists it |
/// | Host, anything else, or no recorded config | never |
///
/// The returned reason is authored text, never the subject's name, because
/// redacted exports keep a state verbatim.
fn subject_gone(
    issue: &Issue,
    obs: &Observations,
    coverage: &super::coverage::Coverage,
    live: Option<(&ObservationTimes, std::time::Instant)>,
    periodic_path: bool,
) -> Option<&'static str> {
    use super::coverage::Availability;
    use super::issue::Subject;
    // A recording from before the configuration was recorded, or a frame
    // built without one: unknown, which never expires anything.
    let config = obs.config.as_ref()?;
    let fresh = |at: fn(&ObservationTimes) -> Option<std::time::Instant>, max_secs| {
        live.is_some_and(|(times, now)| {
            crate::collectors::health::ProbeTimes::fresh_at(at(times), max_secs, now)
        })
    };
    match &issue.subject {
        Subject::Socket { local, remote } => {
            // The collector listed every socket it could see, just now.
            let listed = coverage.rules.iter().any(|r| {
                r.rule == issue.rule
                    && matches!(r.status, Availability::Available | Availability::NoSubjects)
            });
            let open = obs
                .sockets
                .iter()
                .any(|s| &s.local == local && &s.remote == remote);
            (fresh(|t| t.sockets, 30) && listed && !open).then_some("socket closed")
        }
        Subject::Target { name } => {
            let mut revisions = config
                .targets
                .iter()
                .filter(|(n, _)| n == name)
                .map(|(_, r)| r)
                .peekable();
            if revisions.peek().is_none() {
                Some("target removed from the config")
            } else if let Some(found) = &issue.scope.configuration {
                // A duplicated name is a config error netwatch reports, and
                // one entry still carrying this revision keeps the subject.
                (!revisions.any(|r| r == found)).then_some("target configuration changed")
            } else {
                None
            }
        }
        Subject::Resolver { addr } => {
            let resolvers = config.resolvers.as_ref()?;
            let listed = |a: &str| resolvers.iter().any(|r| r == a);
            (!listed(addr) && !replacement_resolvers(issue).any(listed))
                .then_some("resolver left the config")
        }
        Subject::Path { target } if issue.rule.starts_with("path.") => {
            (periodic_path && config.trace_refresh_secs.is_some() && &config.trace_target != target)
                .then_some("trace target changed")
        }
        Subject::Iface { name } => {
            // The list lags the collector, and on Windows may name adapters
            // differently, so a fresh reading of the interface keeps it.
            let listed = config.interfaces.as_ref()?.contains(name)
                || obs.iface.as_ref().is_some_and(|i| &i.name == name);
            (!listed && fresh(|t| t.interface, 15)).then_some("interface removed")
        }
        _ => None,
    }
}

/// Resolvers an applied step switched this issue's lookups to. Their results
/// stand in for the original resolver's, so they can verify its issue and
/// keep its subject from counting as gone.
fn replacement_resolvers(issue: &Issue) -> impl Iterator<Item = &str> {
    use super::issue::{Action, Applied};
    issue
        .remediation
        .iter()
        .filter_map(|step| match (&step.action, &step.applied) {
            (Some(Action::SetResolver { addr }), Some(Applied::Yes { .. })) => Some(addr.as_str()),
            _ => None,
        })
}

pub fn format_ts(dt: DateTime<Local>) -> String {
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Parse a `%Y-%m-%d %H:%M:%S` local stamp of the kind every issue carries.
///
/// Public so surfaces that place an event on a time axis measure it against
/// the same clock the engine wrote it with, instead of re-deriving an offset
/// and drifting by a tick.
pub fn parse_ts(s: &str) -> Option<DateTime<Local>> {
    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .ok()
        .and_then(|n| Local.from_local_datetime(&n).single())
}

/// Whether a mute that ends at `until`, a stamp like [`parse_ts`] reads, is
/// over at `now`. The stamp carries no offset, so in the hour a clock goes
/// back it names two instants, and [`parse_ts`] returns neither. This takes
/// the later: at worst the mute lasts an hour longer, where returning neither
/// ended it on the next tick. A stamp that does not parse has e
```

### Core Architecture Module: `src/remote/queue.rs`
```
//! Durability primitives for the remote ingest agent.
//!
//! The old publisher was fire-and-forget: a single latest-snapshot slot,
//! POSTed every 15s, dropped on any error. At fleet scale that silently gaps
//! telemetry on every network blip. These two small pieces fix that:
//!
//! - [`SnapshotQueue`] — a bounded, drop-oldest buffer. The sender *peeks* a
//!   batch and only *removes* it once the backend ACKs, so a transient outage
//!   never loses data up to `cap`. Overflow drops the oldest and counts it, so
//!   the backend can surface "agent shedding load" instead of a silent gap.
//! - [`Backoff`] — exponential backoff with jitter for retry pacing, so a
//!   recovering backend doesn't get a thundering herd from a reconnecting fleet.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;

/// Bounded queue of pending ingest snapshots with at-least-once delivery
/// semantics: items stay in the queue until explicitly removed after an ACK.
pub struct SnapshotQueue {
    inner: Mutex<VecDeque<serde_json::Value>>,
    cap: usize,
    // u32, not u64: this counts overflow drops of whole snapshots (one push
    // per agent tick, seconds apart), so wrapping would take centuries even
    // under sustained overload. armv5te (old Kirkwood NAS boxes) has no
    // native 64-bit atomics.
    dropped: AtomicU32,
}

impl SnapshotQueue {
    pub fn new(cap: usize) -> Self {
        Self {
            inner: Mutex::new(VecDeque::with_capacity(cap.min(1024))),
            cap: cap.max(1),
            dropped: AtomicU32::new(0),
        }
    }

    /// Enqueue a snapshot. On overflow, drop the *oldest* (it's the stalest and
    /// least useful) and bump the dropped counter.
    pub fn push(&self, snapshot: serde_json::Value) {
        let mut q = self.lock();
        while q.len() >= self.cap {
            q.pop_front();
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
        q.push_back(snapshot);
    }

    /// Clone up to `max` of the oldest snapshots for sending, without removing
    /// them. They are only removed via [`remove`](Self::remove) after an ACK.
    pub fn peek_batch(&self, max: usize) -> Vec<serde_json::Value> {
        let q = self.lock();
        q.iter().take(max).cloned().collect()
    }

    /// Remove the `n` oldest snapshots (call after the backend ACKs a batch).
    pub fn remove(&self, n: usize) {
        let mut q = self.lock();
        for _ in 0..n.min(q.len()) {
            q.pop_front();
        }
    }

    pub fn len(&self) -> usize {
        self.lock().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Total snapshots dropped to overflow since start. Reported in the wire
    /// envelope so the backend can flag a struggling agent.
    pub fn dropped(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed) as u64
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, VecDeque<serde_json::Value>> {
        // A poisoned lock here means a prior holder panicked mid-mutation. The
        // queue invariants are simple (a deque), so recovering the guard and
        // continuing is strictly better than killing the only sender thread.
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Exponential backoff with full jitter, bounded by `max`.
///
/// `delay()` is deterministic given attempt + seed; the seed is folded in so a
/// reconnecting fleet spreads its retries instead of synchronizing. There is no
/// RNG dependency — the caller passes a per-attempt entropy source (e.g. the
/// low bits of a monotonic clock), keeping this unit-testable and dep-free.
pub struct Backoff {
    base: Duration,
    max: Duration,
    attempt: u32,
}

impl Backoff {
    pub fn new(base: Duration, max: Duration) -> Self {
        Self {
            base,
            max,
            attempt: 0,
        }
    }

    /// Reset after a successful send.
    pub fn reset(&mut self) {
        self.attempt = 0;
    }

    /// Record a failure and return the delay to wait before the next attempt.
    /// `entropy` provides jitter (full jitter: uniform in `[0, capped]`). It
    /// must be uniform over all of `u64`: it picks its point in proportion,
    /// so 0 waits nothing and `u64::MAX` waits the whole ceiling.
    pub fn fail(&mut self, entropy: u64) -> Duration {
        let capped = self.capped_ceiling();
        self.attempt = self.attempt.saturating_add(1);
        // Scaled rather than reduced modulo the ceiling: entropy drawn from a
        // narrower range than the ceiling's, such as the sub-second
        // nanoseconds this once took, would keep every delay inside it.
        let ceil_nanos = capped.as_nanos().min(u64::MAX as u128);
        let jittered = (entropy as u128 * (ceil_nanos + 1)) >> 64;
        Duration::from_nanos(jittered as u64)
    }

    /// The current (un-jittered) backoff ceiling for the next attempt.
    fn capped_ceiling(&self) -> Duration {
        let factor = 1u64.checked_shl(self.attempt.min(32)).unwrap_or(u64::MAX);
        let scaled = self.base.saturating_mul(factor.min(u32::MAX as u64) as u32);
        scaled.min(self.max)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn snap(i: u64) -> serde_json::Value {
        json!({ "seq": i })
    }

    #[test]
    fn push_within_cap_keeps_everything() {
        let q = SnapshotQueue::new(4);
        for i in 0..3 {
            q.push(snap(i));
        }
        assert_eq!(q.len(), 3);
        assert_eq!(q.dropped(), 0);
    }

    #[test]
    fn overflow_drops_oldest_and_counts() {
        let q = SnapshotQueue::new(3);
        for i in 0..5 {
            q.push(snap(i));
        }
        assert_eq!(q.len(), 3);
        assert_eq!(q.dropped(), 2);
        // The three newest survive (oldest two evicted).
        let batch = q.peek_batch(10);
        assert_eq!(batch[0]["seq"], 2);
        assert_eq!(batch[2]["seq"], 4);
    }

    #[test]
    fn peek_does_not_remove() {
        let q = SnapshotQueue::new(8);
        q.push(snap(1));
        q.push(snap(2));
        let a = q.peek_batch(8);
        let b = q.peek_batch(8);
        assert_eq!(a.len(), 2);
        assert_eq!(b.len(), 2); // still there — peek is non-destructive
        assert_eq!(q.len(), 2);
    }

    #[test]
    fn ack_gated_remove_advances_queue() {
        let q = SnapshotQueue::new(8);
        for i in 0..5 {
            q.push(snap(i));
        }
        let batch = q.peek_batch(2);
        assert_eq!(batch.len(), 2);
        // Simulate ACK of the 2 sent.
        q.remove(2);
        assert_eq!(q.len(), 3);
        assert_eq!(q.peek_batch(1)[0]["seq"], 2);
    }

    #[test]
    fn remove_more_than_present_is_safe() {
        let q = SnapshotQueue::new(8);
        q.push(snap(1));
        q.remove(10);
        assert!(q.is_empty());
    }

    #[test]
    fn batch_max_caps_take() {
        let q = SnapshotQueue::new(100);
        for i in 0..50 {
            q.push(snap(i));
        }
        assert_eq!(q.peek_batch(10).len(), 10);
    }

    #[test]
    fn backoff_grows_then_caps() {
        let mut b = Backoff::new(Duration::from_millis(250), Duration::from_secs(60));
        // With max entropy, jittered delay approaches the ceiling; ceilings grow.
        let huge = u64::MAX;
        let d0 = b.fail(huge);
        let d1 = b.fail(huge);
        let d2 = b.fail(huge);
        assert!(d1 >= d0, "ceiling should not shrink: {d0:?} -> {d1:?}");
        assert!(d2 >= d1, "ceiling should not shrink: {d1:?} -> {d2:?}");
        // Drive many failures; never exceed max.
        for _ in 0..40 {
            let d = b.fail(huge);
            assert!(d <= Duration::from_secs(60));
        }
    }

    /// Review R5: every delay up to the ceiling is reachable. Full entropy
    /// waits each ceiling in turn, doubling from the base to the cap, no
    /// entropy waits nothing, and half waits half.
    #[test]
    fn delays_reach_each_ceiling_up_to_the_cap() {
        let ms = Duration::from_millis;
        let mut b = Backoff::new(ms(500), Duration::from_secs(60));
        let full: Vec<Duration> = (0..10).map(|_| b.fail(u64::MAX)).collect();
        assert_eq!(
            full,
            [500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000].map(ms)
        );

        let mut b = Backoff::new(ms(500), Duration::from_secs(60));
        assert_eq!(b.fail(0), Duration::ZERO);
        assert_eq!(b.fail(1 << 63), ms(500), "half of the second ceiling, 1 s");
        b.reset();
        assert_eq!(
            b.fail(u64::MAX),
            ms(500),
            "a success starts again from the base"
        );
    }

    #[test]
    fn backoff_jitter_is_bounded_by_ceiling() {
        let mut b = Backoff::new(Duration::from_millis(100), Duration::from_secs(10));
        // First failure ceiling is `base` (2^0 * base). Jitter must stay within.
        let d = b.fail(12345);
        assert!(d < Duration::from_millis(100));
    }

    #[test]
    fn reset_shrinks_ceiling_back_to_base() {
        let mut b = Backoff::new(Duration::from_millis(100), Duration::from_secs(60));
        // Climb several attempts so the ceiling is well above base.
        for _ in 0..6 {
            b.fail(u64::MAX);
        }
        let high = b.capped_ceiling();
        assert!(high > Duration::from_millis(100));
        // After a successful send, the next failure starts from base again.
        b.reset();
        assert_eq!(b.capped_ceiling(), Duration::from_millis(100));
    }
}

```

### Core Architecture Module: `src/sandbox/worker.rs`
```
//! Explicit per-worker entry policy. No input is processed before entry returns.
use super::{CaptureAuthority, Mode, Report, SandboxPaths};
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Clone, Debug)]
pub struct Component {
    pub ready: bool,
    pub report: Option<Report>,
    pub error: Option<String>,
}
struct Policy {
    mode: Mode,
    paths: SandboxPaths,
    /// Set once by [`ensure`], which knows the session; until then
    /// [`capture_authority`] reads [`CaptureAuthority::DropAfterOpen`].
    capture_authority: OnceLock<CaptureAuthority>,
    /// Shared by every worker and the UI, the capture thread included, so
    /// every access goes through `safe_lock`.
    components: Mutex<BTreeMap<String, Component>>,
    #[cfg(target_os = "linux")]
    prepared: Result<landlock::RulesetCreated, String>,
    /// Stacked on `prepared` by parser threads; see [`super::Role`].
    #[cfg(target_os = "linux")]
    prepared_parser: Result<landlock::RulesetCreated, String>,
    /// Stacked on `prepared` by the capture thread.
    #[cfg(target_os = "linux")]
    prepared_capture: Result<landlock::RulesetCreated, String>,
}
type SharedJoin = Arc<Mutex<Option<std::thread::JoinHandle<()>>>>;
static HANDLES: Mutex<Vec<SharedJoin>> = Mutex::new(Vec::new());
static STOPPING: AtomicBool = AtomicBool::new(false);

pub struct WorkerHandle(SharedJoin);
impl WorkerHandle {
    pub fn is_finished(&self) -> bool {
        self.0
            .lock()
            .unwrap()
            .as_ref()
            .is_none_or(|h| h.is_finished())
    }
    pub fn join(self) -> std::thread::Result<()> {
        let handle = self.0.lock().unwrap().take();
        handle.map_or(Ok(()), |h| h.join())
    }
    /// Leave this worker out of the session's shutdown wait, for one with
    /// nothing to finish.
    pub fn not_waited_for(self) {
        HANDLES
            .lock()
            .unwrap()
            .retain(|slot| !Arc::ptr_eq(slot, &self.0));
    }
}
pub fn stopping() -> bool {
    STOPPING.load(Ordering::SeqCst)
}
/// Poll a queue so dropping the application can cancel queued work promptly.
pub fn receive<T>(rx: &std::sync::mpsc::Receiver<T>) -> Option<T> {
    while !stopping() {
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(value) => return (!stopping()).then_some(value),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return None,
        }
    }
    None
}
/// Stop new work, wait to a shared deadline, then report workers still unwinding.
pub fn shutdown(timeout: Duration) -> usize {
    STOPPING.store(true, Ordering::SeqCst);
    let deadline = Instant::now() + timeout;
    loop {
        let mut handles = HANDLES.lock().unwrap();
        handles.retain(|slot| {
            let mut handle = slot.lock().unwrap();
            if handle.as_ref().is_some_and(|h| h.is_finished()) {
                if let Some(h) = handle.take() {
                    let _ = h.join();
                }
            }
            handle.is_some()
        });
        let remaining = handles.len();
        if remaining == 0 || Instant::now() >= deadline {
            return remaining;
        }
        drop(handles);
        std::thread::sleep(Duration::from_millis(10));
    }
}
/// The workers [`shutdown`] is still waiting for, by thread name.
fn unfinished() -> Vec<String> {
    HANDLES
        .lock()
        .unwrap()
        .iter()
        .filter_map(|slot| {
            let handle = slot.lock().unwrap();
            let name = handle.as_ref()?.thread().name()?.to_string();
            Some(name)
        })
        .collect()
}
pub struct SessionGuard;
impl Drop for SessionGuard {
    fn drop(&mut self) {
        let remaining = shutdown(Duration::from_secs(2));
        if remaining != 0 {
            tracing::warn!(
                remaining,
                workers = ?unfinished(),
                "workers still unwinding after shutdown deadline"
            );
        }
    }
}

static POLICY: OnceLock<Policy> = OnceLock::new();

/// Called synchronously before constructing runtime or application workers.
pub fn install(mode: Mode, paths: SandboxPaths) -> Result<(), String> {
    POLICY
        .set(Policy {
            mode,
            #[cfg(target_os = "linux")]
            prepared: super::linux::prepare_ruleset(&paths),
            #[cfg(target_os = "linux")]
            prepared_parser: super::linux::prepare_parser_layer(mode),
            #[cfg(target_os = "linux")]
            prepared_capture: super::linux::prepare_capture_layer(mode, &paths),
            paths,
            capture_authority: OnceLock::new(),
            components: Mutex::new(BTreeMap::new()),
        })
        .map_err(|_| "worker policy already installed".to_string())
}
#[cfg(target_os = "linux")]
pub(super) fn prepared_ruleset() -> Option<&'static Result<landlock::RulesetCreated, String>> {
    POLICY.get().map(|p| &p.prepared)
}
/// The layer `role` stacks on the shared ruleset. Each thread clones its own.
#[cfg(target_os = "linux")]
pub(super) fn prepared_layer(
    role: super::Role,
) -> Option<&'static Result<landlock::RulesetCreated, String>> {
    POLICY.get().map(|p| match role {
        super::Role::Capture => &p.prepared_capture,
        _ => &p.prepared_parser,
    })
}
/// Install the policy if `main` has not, and record the session's capture
/// authority. Workers that entered before this took
/// [`CaptureAuthority::DropAfterOpen`].
pub fn ensure(mode: Mode, paths: SandboxPaths, authority: CaptureAuthority) -> Result<(), String> {
    if let Some(policy) = POLICY.get() {
        if policy.mode != mode {
            return Err("worker policy mode cannot change during a session".into());
        }
    } else {
        if !matches!(mode, Mode::Disabled) {
            paths.prepare().map_err(|e| e.to_string())?;
        }
        install(mode, paths)?;
    }
    let policy = POLICY.get().expect("installed above");
    if *policy.capture_authority.get_or_init(|| authority) != authority {
        return Err("capture authority cannot change during a session".into());
    }
    preflight()
}
/// Whether main and the network workers keep CAP_NET_RAW on entry.
pub fn capture_authority() -> CaptureAuthority {
    POLICY
        .get()
        .and_then(|p| p.capture_authority.get().copied())
        .unwrap_or(CaptureAuthority::DropAfterOpen)
}
/// Check enforceability in a disposable thread before opening optional sources.
pub fn preflight() -> Result<(), String> {
    if !snapshot().contains_key("policy-preflight") {
        let handle = spawn("policy-preflight", || {});
        if handle.is_finished() {
            let _ = handle.join();
        }
    }
    if matches!(mode(), Mode::Strict) {
        wait_ready(Duration::from_secs(5))
    } else {
        Ok(())
    }
}
pub fn mode() -> Mode {
    POLICY.get().map_or(Mode::Disabled, |p| p.mode)
}
pub fn begin(name: &str) {
    if let Some(p) = POLICY.get() {
        let mut components = crate::app::safe_lock(&p.components, "worker::begin");
        if components.get(name).is_some_and(|s| s.error.is_some()) {
            return;
        }
        components.insert(
            name.into(),
            Component {
                ready: false,
                report: None,
                error: None,
            },
        );
    }
}
/// Record a component that exists but is only partly confined, with the
/// reason.
///
/// Distinct from [`fail`]: the component is running and useful, and the note
/// is what stops its protection being overstated. Strict mode treats it as a
/// failure, because a partial guarantee is not the one strict promises.
pub fn note(name: &str, detail: impl Into<String>) {
    if let Some(p) = POLICY.get() {
        let mut components = crate::app::safe_lock(&p.components, "worker::note");
        let detail = detail.into();
        let strict = matches!(p.mode, Mode::Strict);
        components.insert(
            name.into(),
            Component {
                ready: !strict,
                report: None,
                error: Some(detail),
            },
        );
    }
}

pub fn fail(name: &str, error: impl Into<String>) {
    #[cfg(all(test, target_os = "linux"))]
    {
        let held = [caps::CapSet::Permitted, caps::CapSet::Inheritable]
            .into_iter()
            .filter_map(|set| caps::read(None, set).ok())
            .flatten()
            .collect();
        FAILED_HOLDING.lock().unwrap().insert(name.into(), held);
    }
    if let Some(p) = POLICY.get() {
        crate::app::safe_lock(&p.components, "worker::fail").insert(
            name.into(),
            Component {
                ready: false,
                report: None,
                error: Some(error.into()),
            },
        );
    }
}
/// Enforce on the actual worker, with the policy of its role
/// ([`super::roles::role_for`]). Strict failures return false before
/// processing.
pub fn enter(name: &str) -> bool {
    enter_retaining(name, super::Retain::Nothing)
}

/// Enter while keeping the capabilities `retain` names.
///
/// The eBPF worker is the only caller: it needs CAP_BPF and CAP_PERFMON for
/// the load that entry would otherwise have taken from it. It drops them with
/// [`drop_load_caps`] before reading anything, so the window is the load
/// itself and the report names it.
pub fn enter_retaining(name: &str, retain: super::Retain) -> bool {
    let Some(p) = POLICY.get() else {
        return true;
    };
    let role = super::roles::role_for(name);
    let report = super::apply_retaining(p.mode, &p.paths, retain, role);
    #[cfg(test)]
    let report = {
        let mut report = report;
        if std::env::var("NETWATCH_WORKER_FORCE_FAILURE").as_deref() == Ok(name) {
            report
                .mode
                .warnings
   
```

### Core Architecture Module: `src/state.rs`
```
//! Substructs that group App state by concern, keeping `app.rs` itself
//! focused on lifecycle, the event loop, and orchestration rather than the
//! working data the tabs visualize.
//!
//! As Phase 2 of the refactoring plan progresses, this module will grow
//! `AppConfig` (user_config, theme, graph_style) alongside [`AppCaches`]
//! and [`AppUiState`].

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, Mutex};

use ratatui::layout::Rect;

use crate::app::{
    default_sort_states, ConnectionGroup, ConnectionStateFilter, IfaceChangeEvent, InterfaceFilter,
    StatsRange, StreamDirectionFilter, Tab, TimelineFilter, TimelineWindow, UiScrollState,
    ViewMode,
};
use crate::config::NetwatchConfig;
use crate::platform::InterfaceInfo;
use crate::sort::TabSortState;
use crate::ui::sort_picker::SortPickerState;

/// Bounded business caches accumulated across the session — sparkline
/// histories, the bookmarks set, the iface-change log. None of these belong
/// to a single collector; they're cross-cutting derived state that the tick
/// loop and various UI tabs both touch. Grouping them under one substruct
/// keeps `App` itself focused on lifecycle + handles rather than the working
/// data the tabs visualize.
#[derive(Default)]
pub struct AppCaches {
    /// Connection IDs the user has bookmarked. Toggled with `b`; surfaces in
    /// the Packets tab; cleared with `B`.
    pub bookmarks: HashSet<u64>,
    /// Per-remote-IP RTT history for sparklines (keyed by remote IP string).
    /// Bounded by `MAX_RTT_HISTORY_IPS` keys; oldest-inserted IP is evicted
    /// via `rtt_history_order` when a new IP would push the map past the cap.
    pub rtt_history: HashMap<String, VecDeque<f64>>,
    /// FIFO of remote IPs in the order they first appeared in `rtt_history`.
    /// Drives bounded eviction when the keyset exceeds `MAX_RTT_HISTORY_IPS`.
    pub rtt_history_order: VecDeque<String>,
    /// Rolling RX rate history per grouped (process, host) for the Dashboard
    /// Top Connections sparkline. Updated each connection-collector tick.
    pub top_conn_history: HashMap<(String, String), VecDeque<u64>>,
    /// Rolling RX rate history per (process, pid) for the Process drill-in
    /// chart. Updated each connection-collector tick.
    pub top_proc_rx_history: HashMap<(String, Option<u32>), VecDeque<u64>>,
    /// Recent interface up/down/IP-changed events surfaced on the Timeline tab.
    /// Populated when info_tick detects a delta from the previous snapshot.
    pub iface_events: VecDeque<IfaceChangeEvent>,
    /// Snapshot of the previous interface_info, used to detect changes on the
    /// next info_tick. Empty until the second info refresh.
    pub prev_interface_info: Vec<InterfaceInfo>,
    /// Stream indexes whose handshake RTT we've already sampled into
    /// `rtt_history`. Prevents double-counting if the same handshake shows
    /// up across multiple `sample_rtt_from_streams` calls.
    pub rtt_sampled_streams: HashSet<u32>,
    /// The Connections tab's rows for the current table and filters. Readers
    /// take `&App`, hence the lock, and hold the view while the UI state it
    /// was built from changes, hence the `Arc`. See
    /// [`crate::ui::connections::current_view`].
    pub conn_view: Mutex<Option<Arc<crate::ui::connections::ConnView>>>,
}

/// State owned by the Lite view (`src/ui/lite.rs`).
///
/// Kept in its own substruct rather than scattered across [`AppUiState`] so
/// the Lite surface stays legible and auditable — the design brief caps it at
/// a selection, one toggle, and one filter, and a substruct makes creep
/// visible in review.
#[derive(Default)]
pub struct LiteState {
    /// Index into the *filtered* talker list.
    pub selected: usize,
    /// First talker row shown, for scrolling past the visible window.
    pub offset: usize,
    /// Detail block expanded beneath the selected row (`↵`).
    pub detail_open: bool,
    /// `/` filter is accepting keystrokes.
    pub filter_input: bool,
    /// Live query text — matched incrementally against process *or* host.
    pub filter_text: String,
}

/// All UI-controlled state: the active tab, scroll/sort/selection state,
/// chip-row filter selections, in-progress filter input buffers, modal
/// flags (help/settings/memory_stats/geo), transient status messages with
/// their tick counters, and the settings cursor + edit buffer.
///
/// Construction is driven by [`AppUiState::from_config`] because several
/// fields (initial tab, packet_follow flag, geo toggle, timeline window)
/// are seeded from the persisted [`NetwatchConfig`] on startup. Everything
/// else gets a sensible zero-value default.
///
/// Future tests can construct an `AppUiState` directly and exercise event
/// handlers (filter parsing, settings cursor movement, status fade timers)
/// without needing to spin up any collector threads.
/// Ordering for the Egress tree. Volume first by default: on a screen whose
/// job is "what left this machine", the biggest talker is the story.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum EgressSort {
    #[default]
    Volume,
    Active,
    Process,
    LastSeen,
    Risk,
}

impl EgressSort {
    pub const ALL: &'static [EgressSort] = &[
        EgressSort::Volume,
        EgressSort::Active,
        EgressSort::Process,
        EgressSort::LastSeen,
        EgressSort::Risk,
    ];
    pub fn label(self) -> &'static str {
        match self {
            EgressSort::Volume => "volume",
            EgressSort::Active => "active",
            EgressSort::Process => "process",
            EgressSort::LastSeen => "last seen",
            EgressSort::Risk => "risk",
        }
    }
}

pub struct AppUiState {
    pub current_tab: Tab,
    /// Full tabbed TUI vs the single-screen Lite view. Opt-in only.
    pub view_mode: ViewMode,
    pub lite: LiteState,
    /// Which Dense box fills the screen, if any. Its number key toggles it.
    pub dense_zoom: Option<crate::ui::dense::DenseBox>,
    /// Which process groups are folded in the Dense conns box. Its own
    /// state, like the Dashboard's: the Connections tab's is keyed by a
    /// remote host half the time.
    pub dense_collapsed: crate::ui::tree::FoldState,
    pub scroll: UiScrollState,
    pub sort_states: HashMap<Tab, TabSortState>,
    pub sort_picker: SortPickerState,

    pub paused: bool,
    pub last_area: Rect,
    pub selected_interface: Option<usize>,

    // ── Chip-row filter selections ──
    pub interface_filter: InterfaceFilter,
    pub connection_state_filter: ConnectionStateFilter,
    pub connection_group: ConnectionGroup,
    pub stats_range: StatsRange,
    pub timeline_filter: TimelineFilter,
    pub timeline_window: TimelineWindow,

    // ── Text-filter input state (per-tab `/` filters) ──
    pub packet_filter_input: bool,
    pub packet_filter_text: String,
    pub packet_filter_active: Option<String>,
    pub connection_filter_input: bool,
    pub connection_filter_text: String,
    pub connection_filter_active: Option<String>,
    pub egress_filter_input: bool,
    pub egress_filter_text: String,
    pub egress_filter_active: Option<String>,

    // ── Egress-tab specifics ──
    /// Which processes' destination rows are folded. Carries a default plus
    /// exceptions rather than a set of names, so a process first seen after
    /// the user folded everything arrives folded too — see
    /// [`crate::ui::tree::FoldState`].
    pub egress_collapsed: crate::ui::tree::FoldState,
    /// Column the Egress tree is ordered by.
    pub egress_sort: EgressSort,
    /// Show processes last seen before this session started.
    ///
    /// Egress profiles are a persisted baseline, so the tab would otherwise
    /// open on every program ever observed on this machine — most of them
    /// months old and none of them what someone opening the tab is looking
    /// for. History is a keypress away, not the default.
    pub egress_show_history: bool,
    /// Whether the destination detail pane is open (`d`).
    pub egress_detail: bool,
    /// Which connection groups are folded. Keyed by group value (process
    /// name or remote host), so the fold survives re-sorting and the list
    /// churning between ticks.
    pub connection_collapsed: crate::ui::tree::FoldState,
    /// Which process groups are folded in the *dashboard's* connections
    /// panel. Separate from `connection_collapsed`: that one is keyed by
    /// whatever the Connections tab is grouping by, which is a remote host
    /// half the time, and the two panels are different sizes with different
    /// jobs — folding a group to fit a summary panel should not silently
    /// fold it on the tab you opened to read it in full.
    pub dashboard_collapsed: crate::ui::tree::FoldState,

    /// Process whose rule removal is awaiting confirmation (`x`, then `y`).
    ///
    /// Removal is the only destructive action on this tab — it can discard
    /// hand-written allowlist entries that no amount of re-observation will
    /// bring back, since promotion only ever regenerates what was *seen*. So
    /// it asks, unlike promote, which is additive and therefore safe to fire
    /// on a single keystroke.
    pub egress_pending_removal: Option<String>,

    /// Dashboard throughput graph on a log scale. Off by default: linear is
    /// the honest default for a rate. It exists because autoscaling to peak
    /// means one 200 KB/s spike flattens an hour of 2 KB/s into the zero line,
    /// and the shape of that hour is the thing worth seeing.
    pub dashboard_log_scale: bool,

    // ── Packet-tab specifics ──
    pub packet_follow: bool,
    /// Show only packets the expert classifier flagged `Warn` or `Error`.
    /// A display filter, not a capture one — nothing stops being captured.
    pub packet_expert_only: bool,
    /// When true, the detail pane grows to fill most of the visible
    /// area (and the packet list shrinks). Toggled with `d`. U
```

### Core Architecture Module: `examples/diagnose_active_live.rs`
```
//! Real sandboxed active-runner → live sampler → engine → recorded replay test.
use anyhow::{ensure, Context, Result};
use netwatch::{
    app::App,
    config::NetwatchConfig,
    diagnose::{active, episode, export},
    runtime::bootstrap::{self, SessionKind},
};
use std::{
    io::{Read, Write},
    net::TcpListener,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
fn main() -> Result<()> {
    let root = PathBuf::from(std::env::args().nth(1).context("new scratch directory")?);
    ensure!(!root.exists(), "scratch must be new");
    for (key, dir) in [
        ("XDG_CONFIG_HOME", "config"),
        ("XDG_CACHE_HOME", "cache"),
        ("XDG_DATA_HOME", "data"),
        ("XDG_STATE_HOME", "state"),
    ] {
        let p = root.join(dir);
        std::fs::create_dir_all(&p)?;
        std::env::set_var(key, p);
    }
    let portal = Arc::new(AtomicBool::new(true));
    let stop = Arc::new(AtomicBool::new(false));
    let listener = TcpListener::bind("0.0.0.0:0")?;
    let port = listener.local_addr()?.port();
    listener.set_nonblocking(true)?;
    let mode = portal.clone();
    let stopping = stop.clone();
    let server = std::thread::spawn(move || {
        while !stopping.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((mut s, _)) => {
                    let _ = s.set_read_timeout(Some(Duration::from_millis(300)));
                    let mut b = [0; 4096];
                    if s.read(&mut b).is_ok() {
                        let response = if mode.load(Ordering::Relaxed) {
                            "HTTP/1.1 302 Found\r\nLocation: http://login.invalid/private?token=secret\r\nContent-Length: 0\r\n\r\n"
                        } else {
                            "HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n"
                        };
                        let _ = s.write_all(response.as_bytes());
                    }
                }
                Err(_) => std::thread::sleep(Duration::from_millis(10)),
            }
        }
    });
    let mut config = NetwatchConfig {
        diagnose_record_episodes: true,
        insights_enabled: false,
        ..Default::default()
    };
    config.diagnose_probes.portal_endpoints = ["127.0.0.1", "127.0.0.2"]
        .iter()
        .map(|h| active::HttpEndpoint {
            url: format!("http://{h}:{port}/"),
            expect_status: 204,
        })
        .collect();
    config.save()?;
    let mut app = App::prepare_with_config(config);
    bootstrap::start(
        &mut app,
        SessionKind::Daemon,
        netwatch::sandbox::Mode::from_config("on"),
    )?;
    bootstrap::prime_collectors(&mut app);
    app.tick();
    app.diagnose
        .active_prober
        .start("captive.portal", &app.user_config.diagnose_probes)
        .map_err(anyhow::Error::msg)?;
    let start = Instant::now();
    let mut repairing = false;
    let mut recovered = false;
    while start.elapsed() < Duration::from_secs(100) {
        app.tick();
        let issue = app
            .diagnose
            .engine
            .issues()
            .iter()
            .find(|i| i.rule == "captive.portal");
        if !repairing && issue.is_some_and(|i| i.state.is_open()) {
            portal.store(false, Ordering::Relaxed);
            if app
                .diagnose
                .active_prober
                .start("captive.portal", &app.user_config.diagnose_probes)
                .is_ok()
            {
                repairing = true;
                println!(
                    "{}s: confirmed interception; checking restored expected responses",
                    start.elapsed().as_secs()
                );
            }
        }
        if repairing && issue.is_some_and(|i| !i.state.is_open()) {
            recovered = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(1000));
    }
    app.shutdown_diagnose();
    app.packet_collector.stop_capture();
    stop.store(true, Ordering::Relaxed);
    server.join().unwrap();
    ensure!(
        repairing && recovered,
        "active probe did not confirm and recover: {:?}",
        app.diagnose.active_prober.snapshot()
    );
    let dir = episode::default_dir().context("episode directory")?;
    let files = episode::list(&dir);
    ensure!(!files.is_empty(), "episode missing");
    for file in files {
        let ep = episode::load(&file)?;
        ensure!(episode::replay(&ep).matches(), "live replay differs");
        let safe = export::Redactor::new(b"active-live").episode(&ep);
        ensure!(episode::replay(&safe).matches(), "redacted replay differs");
        ensure!(
            !serde_json::to_string(&safe)?.contains("secret"),
            "redirect secret retained"
        );
    }
    println!("PASS: sandboxed active probe, distinct samples, recovery, full and redacted replay in {:.1}s",start.elapsed().as_secs_f64());
    Ok(())
}

```

### Core Architecture Module: `examples/diagnose_demo.rs`
```
//! Renders the Diagnose tab from the demo fixture and writes a shareable
//! bundle: an ANSI dump for the terminal, an HTML page that preserves the
//! real colours, and the `report.md` / `report.json` the `e` key exports.
//!
//! This is not a mockup. It runs the actual detection engine over 440 seconds
//! of observations and draws the result with the same `render_body` the TUI
//! calls, so anything that appears here is something netwatch produced.
//!
//! ```text
//! cargo run --example diagnose_demo -- [output-dir]
//! ```

use netwatch::diagnose::issue::Capability;
use netwatch::diagnose::{fixture, report::Report};
use netwatch::ui::diagnose::{render_body, View};
use ratatui::backend::TestBackend;
use ratatui::buffer::Buffer;
use ratatui::style::{Color, Modifier};
use ratatui::Terminal;

const WIDTH: u16 = 150;
const HEIGHT: u16 = 42;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out_dir = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "netwatch-diagnose-demo".to_string());
    let out = std::path::Path::new(&out_dir);
    std::fs::create_dir_all(out)?;

    // The engine run. Everything below is derived from this.
    let (engine, baselines) = fixture::run();
    let report = fixture::report();

    println!("netwatch diagnose demo");
    println!("  window   {} → {}", fixture::WINDOW_START, fixture::NOW);
    println!("  verdict  {}", engine.verdict(&baselines).line());
    println!(
        "  issues   {} open of {} tracked",
        engine.open_count(),
        engine.issues().len()
    );
    for issue in engine.primary() {
        println!(
            "    [{}] {} — {}",
            issue.severity.label(),
            issue.id,
            issue.summary_line()
        );
        if let Some(c) = issue.top_cause() {
            println!(
                "           cause: {} ({}, {})",
                c.label,
                c.confidence().label(),
                c.checks_label()
            );
        }
        for cid in &issue.consequences {
            if let Some(c) = engine.get(cid) {
                println!("           explains: {} · {}", c.title, c.subject.label());
            }
        }
    }

    // Two screens: the default view, and the same screen with the report
    // preview open, so the demo shows the export matching what is above it.
    let theme = netwatch::theme::by_name("dracula");
    let mut frames = Vec::new();
    for (name, show_report, selected) in [
        ("diagnose", false, 0usize),
        ("diagnose-report", true, 0),
        ("diagnose-path", false, 2),
    ] {
        let view = View {
            engine: &engine,
            baselines: &baselines,
            theme: &theme,
            selected,
            show_report,
            capability: Capability::Root,
            ai: None,
            endpoint: "local".to_string(),
            third_party_probes: true,
            status: None,
            status_is_recovery: false,
            // These stills are for documentation, not a live claim: the
            // caption carries the provenance.
            demo_banner: None,
            running_tests: vec![],
            // The stills render from a recorded engine, which carries no
            // live probe history to chart.
            history: None,
        };
        let mut terminal = Terminal::new(TestBackend::new(WIDTH, HEIGHT))?;
        terminal.draw(|f| render_body(f, &view, f.area()))?;
        let buffer = terminal.backend().buffer().clone();

        std::fs::write(out.join(format!("{name}.txt")), buffer_to_text(&buffer))?;
        std::fs::write(out.join(format!("{name}.ans")), buffer_to_ansi(&buffer))?;
        frames.push((name.to_string(), buffer_to_html(&buffer)));
    }

    std::fs::write(out.join("report.md"), report.to_markdown())?;
    std::fs::write(out.join("report.json"), report.to_json()?)?;
    std::fs::write(out.join("index.html"), page(&frames, &report))?;

    println!();
    println!("wrote {}/", out.display());
    for name in ["index.html", "report.md", "report.json"] {
        println!("  {name}");
    }
    for (name, _) in &frames {
        println!("  {name}.txt, {name}.ans");
    }
    Ok(())
}

// ── buffer export ───────────────────────────────────────────────────

fn buffer_to_text(buf: &Buffer) -> String {
    (0..buf.area.height)
        .map(|y| {
            (0..buf.area.width)
                .map(|x| buf[(x, y)].symbol())
                .collect::<String>()
                .trim_end()
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn rgb(c: Color) -> Option<(u8, u8, u8)> {
    Some(match c {
        Color::Rgb(r, g, b) => (r, g, b),
        Color::Black => (0x1a, 0x1b, 0x26),
        Color::Red => (0xf7, 0x76, 0x8e),
        Color::Green => (0x9e, 0xce, 0x6a),
        Color::Yellow => (0xe0, 0xaf, 0x68),
        Color::Blue => (0x7a, 0xa2, 0xf7),
        Color::Magenta => (0xbb, 0x9a, 0xf7),
        Color::Cyan => (0x7d, 0xcf, 0xff),
        Color::Gray => (0xa9, 0xb1, 0xd6),
        Color::DarkGray => (0x56, 0x5f, 0x89),
        Color::LightRed => (0xff, 0x9e, 0x9e),
        Color::LightGreen => (0xb9, 0xf2, 0x7c),
        Color::LightYellow => (0xff, 0xd7, 0x8c),
        Color::LightBlue => (0x9a, 0xbd, 0xff),
        Color::LightMagenta => (0xd6, 0xba, 0xff),
        Color::LightCyan => (0xa4, 0xe4, 0xff),
        Color::White => (0xc0, 0xca, 0xf5),
        Color::Indexed(_) | Color::Reset => return None,
    })
}

fn buffer_to_ansi(buf: &Buffer) -> String {
    let mut out = String::new();
    for y in 0..buf.area.height {
        for x in 0..buf.area.width {
            let cell = &buf[(x, y)];
            let mut codes = Vec::new();
            if let Some((r, g, b)) = rgb(cell.fg) {
                codes.push(format!("38;2;{r};{g};{b}"));
            }
            if let Some((r, g, b)) = rgb(cell.bg) {
                codes.push(format!("48;2;{r};{g};{b}"));
            }
            if cell.modifier.contains(Modifier::BOLD) {
                codes.push("1".into());
            }
            if codes.is_empty() {
                out.push_str(cell.symbol());
            } else {
                out.push_str(&format!(
                    "\x1b[{}m{}\x1b[0m",
                    codes.join(";"),
                    cell.symbol()
                ));
            }
        }
        out.push('\n');
    }
    out
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Walk the buffer into HTML, coalescing runs that share a style so the page
/// stays small. Colours come from the cells themselves — this is a picture of
/// what the terminal drew, not a re-creation of it.
fn buffer_to_html(buf: &Buffer) -> String {
    let mut out = String::new();
    for y in 0..buf.area.height {
        let mut run = String::new();
        let mut run_style: Option<(Color, Color, bool)> = None;

        let flush = |out: &mut String, run: &mut String, style: &Option<(Color, Color, bool)>| {
            if run.is_empty() {
                return;
            }
            match style {
                Some((fg, bg, bold)) => {
                    let mut css = String::new();
                    if let Some((r, g, b)) = rgb(*fg) {
                        css.push_str(&format!("color:#{r:02x}{g:02x}{b:02x};"));
                    }
                    if let Some((r, g, b)) = rgb(*bg) {
                        css.push_str(&format!("background:#{r:02x}{g:02x}{b:02x};"));
                    }
                    if *bold {
                        css.push_str("font-weight:700;");
                    }
                    if css.is_empty() {
                        out.push_str(&escape(run));
                    } else {
                        out.push_str(&format!("<span style=\"{css}\">{}</span>", escape(run)));
                    }
                }
                None => out.push_str(&escape(run)),
            }
            run.clear();
        };

        for x in 0..buf.area.width {
            let cell = &buf[(x, y)];
            let style = (cell.fg, cell.bg, cell.modifier.contains(Modifier::BOLD));
            if run_style != Some(style) {
                flush(&mut out, &mut run, &run_style);
                run_style = Some(style);
            }
            run.push_str(cell.symbol());
        }
        flush(&mut out, &mut run, &run_style);
        out.push('\n');
    }
    out
}

fn page(frames: &[(String, String)], report: &Report) -> String {
    let mut screens = String::new();
    for (name, html) in frames {
        let caption = match name.as_str() {
            "diagnose" => "The tab as it opens: three findings, the top one expanded.",
            "diagnose-report" => {
                "`o` opens the report preview — the same numbers, ready to export."
            }
            _ => "The path change, with the latency it cost filed underneath it.",
        };
        screens.push_str(&format!(
            "<figure><pre class=\"term\">{html}</pre><figcaption>{}</figcaption></figure>\n",
            escape(caption)
        ));
    }

    format!(
        r#"<title>netwatch Diagnose</title>
<style>
  :root {{
    --bg:#faf9f7; --fg:#1c1b19; --muted:#6b6862; --rule:#e3e0da;
    --term-bg:#282a36; --card:#ffffff;
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      --bg:#16151a; --fg:#e8e6e1; --muted:#9a968e; --rule:#2e2c33; --card:#1e1d23;
    }}
  }}
  :root[data-theme="dark"] {{
    --bg:#16151a; --fg:#e8e6e1; --muted:#9a968e; --rule:#2e2c33; --card:#1e1d23;
  }}
  body {{ background:var(--bg); color:var(--fg); margin:0;
         font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }}
  main {{ max-width:1180px; margin:0 auto; padding:48px 24px 96px; }}
  h1 {{ font-size:28px; margin:0 0 6px; letter-spacing:-0.02em; }}
  .sub {{ color:var(--muted); margin:0 0 40px; font-size:16px; }}
  h2 {{ font-size:19p
```

### Core Architecture Module: `examples/diagnose_lab.rs`
```
//! Headless lab driver: the real `App::tick` once a second, one line per tick.
//!
//! `diagnose_lab --seconds N [--seed FILE] [--stop-file FILE] [--jsonl]`
//!
//! `--stop-file` ends the run early, after the tick on which FILE first
//! exists, with the same shutdown as `--seconds`: a scenario that has seen
//! everything it asserts stops there and still gets its episode written.
//!
//! Run by `tests/diagnose/health_lab.py` inside its namespaces, never by hand
//! against a real home: it refuses to start unless every directory the App
//! writes resolves inside the temp home the lab created. See
//! `netwatch::diagnose::lab` for the line format and the seed file.
use anyhow::{bail, ensure, Context, Result};
use netwatch::{
    app::App,
    config::NetwatchConfig,
    diagnose::{lab, live::LiveSampler},
    runtime::bootstrap::{self, SessionKind},
};
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

struct Options {
    seconds: u64,
    seed: Option<PathBuf>,
    stop_file: Option<PathBuf>,
    jsonl: bool,
}

fn parse() -> Result<Options> {
    let mut opts = Options {
        seconds: 0,
        seed: None,
        stop_file: None,
        jsonl: false,
    };
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--seconds" => {
                opts.seconds = args.next().context("--seconds requires 1..3600")?.parse()?
            }
            "--seed" => opts.seed = Some(args.next().context("--seed requires a file")?.into()),
            "--stop-file" => {
                opts.stop_file = Some(args.next().context("--stop-file requires a file")?.into())
            }
            "--jsonl" => opts.jsonl = true,
            other => bail!("unknown option: {other}"),
        }
    }
    ensure!(
        (1..=3600).contains(&opts.seconds),
        "--seconds must be 1..3600"
    );
    Ok(opts)
}

fn main() -> Result<()> {
    let opts = parse()?;
    // Before anything resolves a path: the App loads baselines, the recovery
    // journal and the config as it is built.
    let home = lab::check_home(
        |name| std::env::var_os(name).map(PathBuf::from),
        &std::env::temp_dir(),
        &[
            ("cache", dirs::cache_dir()),
            ("config", dirs::config_dir()),
            ("state", dirs::state_dir().or_else(dirs::data_local_dir)),
        ],
    )
    .map_err(anyhow::Error::msg)?;
    eprintln!("lab home: {}", home.display());
    let seed = match &opts.seed {
        Some(path) => Some(
            lab::Seed::parse(&std::fs::read_to_string(path).context("reading the seed file")?)
                .map_err(anyhow::Error::msg)?,
        ),
        None => None,
    };
    // Missing, the file would load as the defaults, which here would run the
    // lab without episode recording and pass for the wrong reason.
    let path = NetwatchConfig::path().context("no config directory")?;
    ensure!(path.is_file(), "the lab writes {}", path.display());
    let config = NetwatchConfig::load_from(&path)?;

    let _session = netwatch::sandbox::worker::SessionGuard;
    let mode = netwatch::sandbox::Mode::from_config(&config.sandbox);
    let mut app = App::prepare_with_config(config);
    bootstrap::start(&mut app, SessionKind::Daemon, mode)?;
    bootstrap::prime_collectors(&mut app);

    // Before the first tick, not after it: tick 1's episode frame holds the
    // only baseline snapshot a recording keeps for this network, and replay
    // restores baselines from that alone. The gateway and resolver are read
    // as the App is built, and tick 1 computes this same fingerprint, so its
    // `set_network` changes nothing.
    if let Some(seed) = &seed {
        let network = &app.config_collector.config;
        let (Some(gateway), Some(resolver)) = (network.gateway.clone(), network.primary_dns())
        else {
            // Unseeded σ rules stay in Learning, and a scenario that expects
            // nothing to open would pass without judging anything.
            bail!("--seed: the gateway or resolver is not known, so nothing can be seeded");
        };
        app.diagnose
            .baselines
            .set_network(LiveSampler::fingerprint(&app));
        let seeded = seed.apply(&mut app.diagnose.baselines, &gateway, &resolver);
        eprintln!("seeded {}", seeded.join(", "));
    }

    let started = Instant::now();
    for t in 1..=opts.seconds {
        std::thread::sleep(
            (started + Duration::from_secs(t)).saturating_duration_since(Instant::now()),
        );
        app.tick();
        let snap = lab::snapshot(
            &app.diagnose.engine,
            &app.diagnose.baselines,
            &app.health_prober.status(),
            t,
            netwatch::diagnose::engine::format_ts(chrono::Local::now()),
        );
        if opts.jsonl {
            println!("{}", serde_json::to_string(&snap)?);
        } else {
            let issues: Vec<String> = snap
                .issues
                .iter()
                .map(|i| format!("{} {}", i.key, i.state))
                .collect();
            println!(
                "{t:>4}s {:<8} gw {:?} dns {:?} · {}",
                snap.verdict.chip,
                snap.probes.gateway_rtt_ms,
                snap.probes.dns_rtt_ms,
                if issues.is_empty() {
                    "no issues".to_string()
                } else {
                    issues.join(", ")
                }
            );
        }
        if opts.stop_file.as_ref().is_some_and(|f| f.exists()) {
            eprintln!("stop file seen after {t}s");
            break;
        }
    }
    // As the daemon stops: the recorder writes an episode still in progress.
    app.packet_collector.stop_capture();
    app.egress_profiler.persist_now();
    app.shutdown_diagnose();
    Ok(())
}

```

### Core Architecture Module: `examples/diagnose_live_check.rs`
```
//! Wall-clock smoke test against local HTTP services, using the real App loop.
//! cargo run --example diagnose_live_check -- /tmp/netwatch-live-check-unique
//! Takes about three minutes; writes recordings and an assertion summary.
use anyhow::{bail, ensure, Context, Result};
use netwatch::app::App;
use netwatch::config::NetwatchConfig;
use netwatch::diagnose::{
    episode, export,
    issue::{Severity, StepKind, VerifyOutcome},
    targets::TargetConfig,
};
use netwatch::runtime::bootstrap::{self, SessionKind};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::{Duration, Instant};

fn serve(
    listener: TcpListener,
    healthy: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
) -> std::thread::JoinHandle<()> {
    listener.set_nonblocking(true).unwrap();
    std::thread::spawn(move || {
        while !stop.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
                    let mut request = [0; 4096];
                    if stream.read(&mut request).is_ok_and(|n| n > 0) {
                        let status = if healthy.load(Ordering::SeqCst) {
                            "200 OK"
                        } else {
                            "503 Service Unavailable"
                        };
                        let _ = write!(
                            stream,
                            "HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                        );
                    }
                }
                Err(_) => std::thread::sleep(Duration::from_millis(20)),
            }
        }
    })
}

fn main() -> Result<()> {
    let root = PathBuf::from(
        std::env::args()
            .nth(1)
            .context("supply a new scratch output directory")?,
    );
    ensure!(
        !root.exists(),
        "output directory must be new to isolate the test"
    );
    for (var, subdir) in [
        ("XDG_CONFIG_HOME", "config"),
        ("XDG_CACHE_HOME", "cache"),
        ("XDG_DATA_HOME", "data"),
        ("XDG_STATE_HOME", "state"),
    ] {
        let path = root.join(subdir);
        std::fs::create_dir_all(&path)?;
        std::env::set_var(var, path);
    }
    let unhealthy = Arc::new(AtomicBool::new(false));
    let stop = Arc::new(AtomicBool::new(false));
    let http = TcpListener::bind("127.0.0.1:0")?;
    let http_port = http.local_addr()?.port();
    let reservation = TcpListener::bind("127.0.0.1:0")?;
    let stopped_port = reservation.local_addr()?.port();
    drop(reservation);
    let server = serve(http, unhealthy.clone(), stop.clone());
    let mut restarted = None;
    let target = |name: &str, port| TargetConfig {
        enabled: true,
        name: name.into(),
        host: "127.0.0.1".into(),
        port,
        tls: Some(false),
        http: true,
        path: "/private-health-secret".into(),
        expect_status: Some(200),
        interval_secs: 10,
    };
    let mut config = NetwatchConfig {
        refresh_rate_ms: 1000,
        insights_enabled: false,
        diagnose_record_episodes: true,
        diagnose_targets: vec![
            target("live-check-http", http_port),
            target("live-check-stopped", stopped_port),
        ],
        ..Default::default()
    };
    config.save()?;
    let mut app = App::prepare_with_config(config);
    bootstrap::start(
        &mut app,
        SessionKind::Daemon,
        netwatch::sandbox::Mode::from_config("on"),
    )?;
    bootstrap::prime_collectors(&mut app);
    let start = Instant::now();
    let mut repaired = false;
    let mut ids = Vec::new();
    let mut recovered = false;
    while start.elapsed() < Duration::from_secs(220) {
        app.tick();
        if start.elapsed().as_secs().is_multiple_of(20) {
            println!(
                "{}s: {}",
                start.elapsed().as_secs(),
                app.diagnose
                    .engine
                    .issues()
                    .iter()
                    .filter(|i| i.rule.starts_with("target."))
                    .map(|i| format!("{} {}", i.rule, i.state.label()))
                    .collect::<Vec<_>>()
                    .join("; ")
            );
        }
        if !repaired {
            let issues: Vec<_> = app
                .diagnose
                .engine
                .issues()
                .iter()
                .filter(|i| i.rule.starts_with("target.") && i.state.is_open())
                .cloned()
                .collect();
            if issues.len() == 2 {
                for issue in &issues {
                    let expected = if issue.rule == "target.http_error" {
                        "service_error"
                    } else {
                        "service_down"
                    };
                    ensure!(
                        issue.top_cause().is_some_and(|c| c.id == expected),
                        "wrong cause: {issue:#?}"
                    );
                    ensure!(
                        issue.severity == Severity::Info,
                        "local service failure called a network fault"
                    );
                    if let Some(step) = issue
                        .remediation
                        .iter()
                        .position(|s| s.kind == StepKind::Instruct)
                    {
                        app.mark_diagnose_step_done(&issue.id, step)
                            .map_err(anyhow::Error::msg)?;
                    } else {
                        ensure!(
                            issue.rule == "target.http_error"
                                && issue
                                    .remediation
                                    .iter()
                                    .any(|s| s.kind == StepKind::Escalate),
                            "unexpected remediation workflow"
                        );
                    }
                    ids.push((
                        issue.id.clone(),
                        issue.top_cause().unwrap().key(&issue.rule),
                    ));
                }
                unhealthy.store(true, Ordering::SeqCst);
                restarted = Some(serve(
                    TcpListener::bind(("127.0.0.1", stopped_port))?,
                    Arc::new(AtomicBool::new(true)),
                    stop.clone(),
                ));
                repaired = true;
                println!("{}s: both faults correctly identified; recorded the manual service fix and restored both services", start.elapsed().as_secs());
            }
        } else if ids.iter().all(|(id, _)| {
            app.diagnose
                .engine
                .get(id)
                .is_some_and(|i| !i.state.is_open())
        }) {
            recovered = true;
            println!(
                "{}s: both incidents closed after the recovery holding window",
                start.elapsed().as_secs()
            );
            break;
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    let mut checks = Vec::new();
    for (id, cause) in &ids {
        let issue = app.diagnose.engine.get(id).unwrap();
        checks.push(serde_json::json!({"id": id, "rule": issue.rule, "state": issue.state, "verification": issue.verification}));
        app.label_issue(id, cause).map_err(anyhow::Error::msg)?;
    }
    app.packet_collector.stop_capture();
    app.shutdown_diagnose();
    stop.store(true, Ordering::SeqCst);
    let _ = server.join();
    if let Some(server) = restarted {
        let _ = server.join();
    }
    let dir = app
        .diagnose
        .episode_dir
        .clone()
        .context("recording directory missing")?;
    let history = episode::history(&dir, 100);
    let mut replays = Vec::new();
    for entry in &history {
        let ep = episode::load(&entry.path)?;
        let replay = episode::replay(&ep);
        replays.push(serde_json::json!({"file": entry.path, "matches": replay.matches(), "divergences": replay.divergences}));
    }
    let key = export::install_key(&dir)?;
    let preview = export::build(&dir, &key, 1, chrono::Local::now());
    let exported = serde_json::to_string(&preview.bundle)?;
    let private = ![
        "127.0.0.1",
        "live-check-http",
        "live-check-stopped",
        "private-health-secret",
    ]
    .iter()
    .any(|s| exported.contains(s));
    let output_dir = root.join("cache/netwatch/exports");
    export::write(&preview.bundle, &output_dir.join("incident-export.json.gz"))
        .context("write redacted export")?;
    let summary = serde_json::json!({"repaired": repaired, "recovered": recovered, "checks": checks,
        "history_entries": history.len(), "replays": replays, "export_private": private,
        "labels": preview.bundle.episodes.iter().map(|e| e.labels.len()).sum::<usize>()});
    std::fs::write(
        output_dir.join("result.json"),
        serde_json::to_string_pretty(&summary)?,
    )?;
    println!("{}", serde_json::to_string_pretty(&summary)?);
    if !repaired || !recovered {
        bail!("fault or recovery was not observed; see {}", root.display());
    }
    for (id, _) in &ids {
        if app
            .diagnose
            .engine
            .get(id)
            .is_some_and(|i| i.rule == "target.http_error")
        {
            continue;
        }
        ensure!(
            app.diagnose
                .engine
                .get(id)
                .and_then(|i| i.verification.as_ref())
                .and_then(|v| v.outcome)
                == Some(VerifyOutcome::Recovered),
            "manual verification did not recover"
        );
    }
    ensure!(!history.is_empty(), "no incident history saved");
    ensure!(
        replays.iter().all(|r| r["matches"] == true),
        "live replay div
```

### Core Architecture Module: `examples/diagnose_probe.rs`
```
//! Bounded experiment driver for the isolated fault lab.
use anyhow::{Context, Result};
use netwatch::diagnose::{active, kernel, probe_io::Cancel};
use std::time::{Duration, Instant};
fn main() -> Result<()> {
    let args: Vec<_> = std::env::args().collect();
    let rule = args
        .get(1)
        .context("rule or kernel, optional config JSON")?;
    if rule == "kernel" {
        let secs = args
            .get(2)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
            .min(600);
        let mut c = kernel::Collector::default();
        let start = Instant::now();
        loop {
            let (_, o) = c.sample().map_err(anyhow::Error::msg)?;
            if start.elapsed().as_secs() >= secs {
                println!("{}", serde_json::to_string(&o)?);
                break;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    } else {
        let cfg = if let Some(path) = args.get(2) {
            serde_json::from_str(&std::fs::read_to_string(path)?)?
        } else {
            active::Config::default()
        };
        let r = active::run(rule, &cfg, &Cancel::default());
        println!("{}", serde_json::to_string(&r)?);
    }
    Ok(())
}

```

### Core Architecture Module: `examples/diagnose_soak.rs`
```
//! Live workstation stability accounting, with isolated state. No injected faults.
use anyhow::{ensure, Context, Result};
use netwatch::{
    app::App,
    config::NetwatchConfig,
    runtime::bootstrap::{self, SessionKind},
};
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
fn bytes(path: &Path) -> u64 {
    std::fs::read_dir(path)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| {
            let p = e.path();
            if p.is_dir() {
                bytes(&p)
            } else {
                e.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}
fn state_bytes(root: &Path) -> u64 {
    ["config", "state", "cache", "data"]
        .iter()
        .map(|dir| bytes(&root.join(dir).join("netwatch")))
        .sum()
}
fn main() -> Result<()> {
    let root = PathBuf::from(
        std::env::args()
            .nth(1)
            .context("new scratch directory required")?,
    );
    let seconds = std::env::args()
        .nth(2)
        .context("duration seconds required")?
        .parse::<u64>()?
        .clamp(60, 3600);
    ensure!(!root.exists(), "scratch directory must be new");
    for (key, dir) in [
        ("XDG_CONFIG_HOME", "config"),
        ("XDG_CACHE_HOME", "cache"),
        ("XDG_DATA_HOME", "data"),
        ("XDG_STATE_HOME", "state"),
    ] {
        let p = root.join(dir);
        std::fs::create_dir_all(&p)?;
        std::env::set_var(key, p);
    }
    let mut cfg = NetwatchConfig {
        insights_enabled: false,
        diagnose_record_episodes: true,
        ..Default::default()
    };
    cfg.save()?;
    let mut app = App::prepare_with_config(cfg);
    bootstrap::start(
        &mut app,
        SessionKind::Daemon,
        netwatch::sandbox::Mode::from_config("on"),
    )?;
    bootstrap::prime_collectors(&mut app);
    let start = Instant::now();
    let mut last = start;
    let mut sampled = 0.0;
    let mut ticks = 0;
    let mut max_tick: f64 = 0.0;
    let mut max_rss = 0;
    let mut max_threads = 0;
    let mut identities = BTreeSet::new();
    let mut max_ready = 0;
    while start.elapsed().as_secs() < seconds {
        let tick = Instant::now();
        app.tick();
        max_tick = max_tick.max(tick.elapsed().as_secs_f64());
        let now = Instant::now();
        let gap = now.duration_since(last).as_secs_f64();
        if gap <= 5.0 {
            sampled += gap;
        }
        last = now;
        ticks += 1;
        max_ready = max_ready.max(
            app.diagnose
                .engine
                .coverage()
                .rules
                .iter()
                .filter(|r| r.status == netwatch::diagnose::coverage::Availability::Available)
                .count(),
        );
        for i in app
            .diagnose
            .engine
            .issues()
            .iter()
            .filter(|i| i.state.is_open())
        {
            identities.insert(format!("{}|{}", i.rule, i.subject.label()));
        }
        if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
            for line in status.lines() {
                if let Some(v) = line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|s| s.parse::<u64>().ok())
                {
                    if line.starts_with("VmRSS:") {
                        max_rss = max_rss.max(v);
                    }
                    if line.starts_with("Threads:") {
                        max_threads = max_threads.max(v);
                    }
                }
            }
        }
        if ticks % 60 == 0 {
            println!("{}s: {ticks} samples, {sampled:.1}s observed, RSS {max_rss} KiB, threads {max_threads}, state {} bytes",start.elapsed().as_secs(),state_bytes(&root));
        }
        std::thread::sleep(Duration::from_millis(1000));
    }
    app.shutdown_diagnose();
    app.packet_collector.stop_capture();
    let summary = serde_json::json!({"wall_seconds":start.elapsed().as_secs_f64(),"monitored_seconds":sampled,"ticks":ticks,"longest_tick_seconds":max_tick,"max_rss_kib":max_rss,"max_threads":max_threads,"state_bytes":state_bytes(&root),"max_available_checks":max_ready,"observed_issue_keys":identities});
    std::fs::write(
        root.join("state/netwatch/soak-summary.json"),
        serde_json::to_vec_pretty(&summary)?,
    )?;
    println!("{summary}");
    ensure!(sampled > seconds as f64 * 0.9, "insufficient measured time");
    ensure!(max_tick < 5.0, "collector stalled app tick");
    ensure!(max_threads < 100, "unexpected worker growth");
    ensure!(state_bytes(&root) < 20_000_000, "unexpected state growth");
    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #56** (2026-09-20): **Default Interface Selection is broken.**
  *Symptoms*: **What happened?** NO eth0 Interface to work on!!  **What did you expect?** The software should not hallucinate network interfaces, even if written with LLMs.  **Steps to reproduce:** 1. start the software on a systemd based machine, without legacy interface names.  **Environment:** - OS: Arch Linux 7.2.4-arch1-2 - NetWatch version (`netwatch --version`): netwatch: invalid option -- '-', the command does not work, package manager says: netwatch-1.3.1_2-4 - Terminal: Konsole 26.08.1-1 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report — but this looks like a different project.  Arch's `extra/netwatch` (1.3.1_2-4) is an unrelated tool from slctech.org; the version string and the `invalid option -- '-'` error both point there — it predates predictable interface names, which explains the eth0 behaviour.  This repo's package on Arch is `netwatch-tui` (currently 0.32.3):      yay -S netwatch-tui  If you hit interface-selection trouble with that one, I'd genuinely like to hear about it — reopen this or file a fresh issue and I'll dig in.

- **Issue #53** (2026-09-12): **libpcap.so.0.8: cannot open shared object file: No such file or directory**
  *Symptoms*: **What happened?** libpcap.so.0.8: cannot open shared object file: No such file or directory  **What did you expect?** It should work  **Steps to reproduce:** 1.  <img width="1117" height="305" alt="Image" src="https://github.com/user-attachments/assets/55c14ab6-bb6f-47cc-9dbc-81f3271bf6cd" />  **Environment:** - OS: Debian GNU/Linux 13 (trixie) - NetWatch version (`netwatch --version`):  - Terminal:  ash@app:/tmp$ ls -l total 17436    -rwxr-xr-x 1 ash ash 13084456 Sep 11 05:04 netwatch-linux-x86_64 -rw-rw-r-- 1 ash ash  4764951 Sep 11 05:08 netwatch-linux-x86_64.tar.gz ash@app:/tmp$ ./netwatch-linux-x86_64  ./netwatch-linux-x86_64: error while loading shared libraries: libpcap.so.0.8: cannot open shared object file: No such file or directory ash@app:/tmp$ cat /etc/os-release  PRETTY_NAME="Debian GNU/Linux 13 (trixie)" NAME="Debian GNU/Linux" VERSION_ID="13" VERSION="13 (trixie)" VERSION_CODENAME=trixie DEBIAN_VERSION_FULL=13.5 ID=debian HOME_URL="https://www.debian.org/" SUPPORT_URL="https://www.debian.org/support" BUG_REPORT_URL="https://bugs.debian.org/"

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

### Incident Patch 1: `fc4b48fe` (2026-11-07)
**Commit Message**: fix(sandbox): accept a denied TCP Fast Open send in the gap test (#196)

Linux 7.2 checks a MSG_FASTOPEN send against Landlock's connect rules
(33cb713db016, "landlock: Fix TCP Fast Open connection bypass", Cc
stable). parser_layer_leaves_fast_open_and_autobind_open expected the
send to get out, so on a fixed kernel it failed with EACCES and stopped
the Nix build, which runs the test suite.

The test, renamed parser_layer_leaves_autobind_open_and_fast_open_to_the_kernel,
now passes when the send is denied and nothing reaches the listener, or
when it goes out and the data arrives. The autobind check is unchanged.
The threat model and the SandboxReport doc scope the Fast Open gap to
kernels without the fix; Landlock has no erratum for it, so the report
does not claim it either way.

Fixes #192

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -2,6 +2,15 @@
 
 All notable changes to NetWatch will be documented in this file.
 
+## [Unreleased]
+
+### Fixed
+- **The Nix build passes its tests on Linux 7.2.** A sandbox test expected a TCP Fast Open
+  send from a parser thread to get past the Landlock network deny. Linux 7.2 closes that gap,
+  and kernels with the stable backport may too, so the test failed and the build stopped
+  (#192). The test now accepts a denied send, as long as nothing reaches the listener, and
+  the threat model scopes the Fast Open gap to kernels without the fix.
+
 ## [1.0.0-rc.1] - 2026-11-07
 
 ### Added
```

**File**: `docs/THREAT-MODEL.md` (modified, +9/-6)
```diff
@@ -212,12 +212,15 @@ write: /dev/null
    opened earlier, the filtered ones included, because threads share descriptors
    (item 1); a test holds a UDP socket opened before the filter to that
    ([filter tests](../src/sandbox/seccomp.rs#L1)). On a thread with socket(2) open,
-   two TCP calls get past the deny. A TCP Fast Open send (`sendto` or
-   `sendmsg` with `MSG_FASTOPEN`) opens a connection and delivers its data
-   without connect(2), and listen(2) on an unbound socket takes an ephemeral port
-   on every address without bind(2). Both work from a parser thread on Linux 7.1,
-   and a test fails if that changes
-   ([gap tests](../src/sandbox/linux.rs#L1122)). Accepting on a listener bound
+   two TCP calls get past the deny. listen(2) on an unbound socket takes an
+   ephemeral port on every address without bind(2); that works from a parser
+   thread on Linux 7.1, and a test fails if it changes. A TCP Fast Open send
+   (`sendto` or `sendmsg` with `MSG_FASTOPEN`) opens a connection and delivers
+   its data without connect(2) on kernels before 7.2. Linux 7.2 checks it
+   against the connect rules, and the fix is marked for stable kernels, so an
+   older kernel may have it too. Landlock has no erratum for it, so netwatch
+   cannot tell which kernels do, and the report does not claim it; the test
+   accepts either result ([gap tests](../src/sandbox/linux.rs#L1122)). Accepting on a listener bound
    before entry is not mediated either, which is how the metrics threads serve.
    Main, the network workers and the proc broker have no network restriction,
    and a parser running injected code can reach them through shared memory
```

**File**: `src/sandbox/linux.rs` (modified, +18/-7)
```diff
@@ -1429,11 +1429,16 @@ mod tests {
     }
 
     #[test]
-    fn parser_layer_leaves_fast_open_and_autobind_open() {
-        // Landlock checks connect(2) and bind(2). A TCP Fast Open sendto
-        // connects without the first, and listen(2) on an unbound socket
-        // takes an ephemeral port on every address without the second. The
-        // threat model says so; this fails if that changes under it.
+    fn parser_layer_leaves_autobind_open_and_fast_open_to_the_kernel() {
+        // Landlock checks connect(2) and bind(2). listen(2) on an unbound
+        // socket takes an ephemeral port on every address without the second;
+        // the threat model says so, and this fails if that changes under it.
+        // A TCP Fast Open sendto connects without the first on kernels before
+        // Linux 7.2, which checks it against the connect rules (33cb713db016,
+        // "landlock: Fix TCP Fast Open connection bypass", also marked for
+        // stable). Either the send is denied and nothing arrives, or it goes
+        // out. Landlock has no erratum for the fix, so nothing can tell which
+        // ahead of time (#192).
         use nix::sys::socket::{
             listen, sendto, socket, AddressFamily, Backlog, MsgFlags, SockFlag, SockType,
             SockaddrIn,
@@ -1489,9 +1494,15 @@ mod tests {
         .join()
         .unwrap();
 
-        if let Some(sent) = sent {
+        outside.set_nonblocking(true).unwrap();
+        if sent == Some(Err(nix::errno::Errno::EACCES)) {
+            std::thread::sleep(std::time::Duration::from_millis(100));
+            match outside.accept() {
+                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
+                other => panic!("a denied Fast Open send reached the listener: {other:?}"),
+            }
+        } else if let Some(sent) = sent {
             assert_eq!(sent, Ok(9));
-            outside.set_nonblocking(true).unwrap();
             let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
             let mut accepted = loop {
                 match outside.accept() {
```

**File**: `src/sandbox/mod.rs` (modified, +4/-4)
```diff
@@ -203,10 +203,10 @@ pub struct PlatformReport {
     /// when the layer could not be built to ask.
     pub landlock_availability: Option<&'static str>,
     /// Linux: connect(2) and bind(2) on TCP sockets denied on this thread by
-    /// its parser or capture layer. The network stays reachable: UDP, MPTCP,
-    /// a TCP Fast Open send and listen(2) on an unbound socket all get past
-    /// it (docs/THREAT-MODEL.md, item 4). Main and the network workers leave
-    /// this false.
+    /// its parser or capture layer. The network stays reachable: UDP, MPTCP
+    /// and listen(2) on an unbound socket get past it, and so does a TCP Fast
+    /// Open send on kernels without the Linux 7.2 fix (docs/THREAT-MODEL.md,
+    /// item 4). Main and the network workers leave this false.
     pub landlock_network_blocked: bool,
     /// Linux: the layer this thread's role stacks on the filesystem one,
     /// "parser" or "capture", whether or not the kernel enforced it. `None`
```

---

### Incident Patch 2: `81275065` (2026-11-08)
**Commit Message**: fix(memory): turn transparent huge pages off at startup on Linux (#198)

mimalloc 3 calls madvise(MADV_HUGEPAGE) on its arenas. With THP on
`madvise` (Fedora, Ubuntu) or `always`, the kernel kept whole 2 MiB
pages resident after a capture burst, and khugepaged (max_ptes_none 511)
collapsed ranges mimalloc had released back into huge pages. RSS sat
80 to 100 MiB above the live heap and rose with each burst, which is the
flood soak's cycle-to-cycle growth that blocked 1.0.0.

Evidence, three cycles of two-minute steps on the reference machine,
with a driver that also counted live heap bytes:
- THP on: RSS after udp-churn 57.7 / 117.2 / 128.5 MiB, live heap
  11.7 / 18.0 / 21.5, AnonHugePages up to 102 MiB off-peak; mtu-tcp
  peaks 355.1 / 357.9 / 360.3; 114.5 MiB after the paced steps.
- MIMALLOC_ALLOW_THP=0: the same step 34.5 / 40.4 / 44.2 MiB, a steady
  ~23 MiB above the live heap; peaks 327.5 / 334.4 / 335.9; 40.5 after.
The live heap grows 6.3 then 3.5 MiB as the capped tables fill and drops
back to 15 MiB once their entries expire, so nothing leaks.

platform::disable_transparent_huge_pages() sets PR_SET_THP_DISABLE. main
calls it first, and the flood soak driver does too so i

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -19,6 +19,13 @@ All notable changes to NetWatch will be documented in this file.
   and kernels with the stable backport may too, so the test failed and the build stopped
   (#192). The test now accepts a denied send, as long as nothing reaches the listener, and
   the threat model scopes the Fast Open gap to kernels without the fix.
+- **Memory no longer creeps up after capture bursts on Linux.** mimalloc asks for transparent
+  huge pages on its arenas, so after a burst the kernel kept whole 2 MiB pages resident and
+  khugepaged collapsed released ranges back into them. RSS sat 80 to 100 MiB above the bytes
+  live on the heap and rose a little with each burst, which is what failed the flood soak's
+  plateau gate. netwatch now turns transparent huge pages off for itself at startup
+  (`PR_SET_THP_DISABLE`). In a three-cycle soak with two-minute steps, RSS after the cycles
+  fell from 115 to 41 MiB, and the peak under a full stream budget from 360 to 336 MiB.
 
 ## [1.0.0-rc.1] - 2026-11-07
 
```

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -205,6 +205,9 @@ nix = { version = "0.31", features = ["term", "signal"] }
 [target.'cfg(target_os = "linux")'.dependencies]
 landlock = "0.4.7"
 caps = "0.5"
+# prctl(PR_SET_THP_DISABLE) at startup (platform::disable_transparent_huge_pages).
+# The same nix as above, so nothing new is compiled.
+nix = { version = "0.31", features = ["process"] }
 
 [target.'cfg(windows)'.dependencies]
 windows-sys = { version = "0.61", features = [
```

**File**: `docs/PERFORMANCE.md` (modified, +2/-0)
```diff
@@ -39,6 +39,8 @@ The four runs dispatched together read +17.8 to +20.4, v0.40.0 among them. One c
 
 One local run of `main` with a third cycle points the wrong way. Its peaks, all in the `mtu-tcp` phase, were 375.7 MiB in cycle 2 and 393.7 MiB in cycle 3, 18 MiB higher. Every other scenario except `bulk` also peaked about 8 to 20 MiB higher in cycle 3. Cycle 1 doesn't count: the machine suspended in the middle of it. That is one run, and runs vary by 7 MiB, but it reads as growth that continues after warm-up. Before 1.0.0, the soak is to compare a third cycle with the second, a 24-hour run is to show whether memory keeps climbing, and the growth is to be found or ruled out. A climb blocks 1.0.0.
 
+The growth was transparent huge pages, not a leak. A driver that also counted the bytes live on the heap ran three cycles of two-minute steps on the reference machine, once with huge pages and once without (`MIMALLOC_ALLOW_THP=0`), the two side by side. With them, RSS after `udp-churn` read 57.7, 117.2 and 128.5 MiB in the three cycles while the live heap read 11.7, 18.0 and 21.5 MiB, and outside the `mtu-tcp` peaks up to 102 MiB of RSS was huge pages. mimalloc asks for them on its arenas, and khugepaged collapses ranges it has released back into whole 2 MiB pages. Without them the same step read 34.5, 40.4 and 44.2 MiB, about 23 MiB above the live heap each time, and the `mtu-tcp` peaks were 327.5, 334.4 and 335.9 MiB. The live heap rises a few MiB per cycle as the capped tables fill (6.3, then 3.5), and falls back to 15 MiB in the paced steps once their entries expire. netwatch now turns huge pages off for itself at startup. The tables above are from before that change, and the next full soak replaces them.
+
 ## Flood soak
 
 Each run floods a veth pair in a private network namespace for an hour: two cycles of six scenarios, then paced rates, then ten minutes of the real daemon. A Python AF_PACKET generator sends the traffic, so the soak needs no extra packages. It offers up to about 1.5 million packets a second on the reference machine and about 350,000 on the runner. The harness can use tcpreplay for the replay scenario if asked.
```

**File**: `examples/flood_soak.rs` (modified, +2/-0)
```diff
@@ -142,6 +142,8 @@ fn parse() -> Result<Options> {
 }
 
 fn main() -> Result<()> {
+    // As `main` does, so RSS reads as the binary's.
+    netwatch::platform::disable_transparent_huge_pages();
     let opts = parse()?;
     match &opts.replay {
         Some(dir) => replay(dir, opts.seconds),
```

**File**: `src/main.rs` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ use std::mem::ManuallyDrop;
 static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;
 
 fn main() -> Result<()> {
+    // Before the collectors allocate: see the function for the RSS it saves.
+    netwatch::platform::disable_transparent_huge_pages();
     let args: Vec<String> = std::env::args().skip(1).collect();
     let options = match netwatch::cli::parse(&args)? {
         netwatch::cli::Command::Help => {
```

**File**: `src/platform/mod.rs` (modified, +33/-0)
```diff
@@ -28,6 +28,24 @@ pub mod socket_table;
 #[cfg(target_os = "windows")]
 pub mod windows;
 
+/// Turns transparent huge pages off for this process on Linux, and does
+/// nothing elsewhere. `main` calls it first, and the flood soak's driver does
+/// the same so its RSS reads as the binary's.
+///
+/// mimalloc asks for huge pages on its arenas (`madvise(MADV_HUGEPAGE)`). With
+/// THP set to `madvise` or `always`, the kernel backs every 2 MiB of an arena
+/// netwatch has touched, and khugepaged collapses ranges mimalloc had released
+/// back into huge pages. After a capture burst that left RSS 80 to 100 MiB
+/// above the bytes live on the heap, and a little higher each time the burst
+/// came back: the flood soak's cycle-to-cycle growth. Without huge pages RSS
+/// stays about 23 MiB above the live heap. The flag also covers the children
+/// netwatch starts, which is harmless for `ss` and `ip`. A kernel without the
+/// prctl (before 3.15) keeps huge pages.
+pub fn disable_transparent_huge_pages() {
+    #[cfg(target_os = "linux")]
+    let _ = nix::sys::prctl::set_thp_disable(true);
+}
+
 /// The command the capture error and the Dashboard banner give for capture
 /// without root on Linux. CAP_BPF and CAP_PERFMON are for eBPF attribution
 /// (`sandbox/mod.rs`). It restricts the binary to a group before granting it,
@@ -791,3 +809,18 @@ stat() { case ${3#"$PWD"/} in usr/* | local/* | store/* | profile/*) echo root ;
         }
     }
 }
+
+#[cfg(all(test, target_os = "linux"))]
+mod huge_page_tests {
+    /// The kernel reports the flag back, and `THP_enabled` in
+    /// `/proc/self/status` reads 0, as it would for the binary.
+    #[test]
+    fn transparent_huge_pages_are_off_after_the_call() {
+        super::disable_transparent_huge_pages();
+        assert_eq!(nix::sys::prctl::get_thp_disable(), Ok(true));
+        let status = std::fs::read_to_string("/proc/self/status").unwrap();
+        if let Some(line) = status.lines().find(|l| l.starts_with("THP_enabled:")) {
+            assert_eq!(line.split_whitespace().nth(1), Some("0"), "{line}");
+        }
+    }
+}
```

---

### Incident Patch 3: `f30ae2e6` (2026-11-07)
**Commit Message**: fix(release): name pre-release packages as GitHub serves them, and keep :latest off them (#191)

* fix(release): name pre-release packages as GitHub serves them

GitHub turns a `~` in an asset's name into `.`, so 1.0.0-rc.1's SHA256SUMS
listed netwatch_1.0.0~rc.1-1_amd64.deb while the release served
netwatch_1.0.0.rc.1-1_amd64.deb, and `sha256sum -c` could not find the four
packages. The release job now renames them before the sums and
attestations. install-check's rpm job asks for the served name.

rc.1's SHA256SUMS was replaced by hand with the corrected names; the hashes
are unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(release): keep :latest off a pre-release's container image

contains(tag, '-') && '' || format(':latest') yields :latest whatever the
tag: '' is falsy, so && '' falls through to ||. 1.0.0-rc.1 took :latest
from 0.40.0. The non-empty value now sits in the && branch.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/install-check.yml` (modified, +5/-3)
```diff
@@ -148,9 +148,11 @@ jobs:
     steps:
       - run: |
           set -euo pipefail
-          rpm_version=$(tr - '~' <<< "${VERSION}")
-          curl -fsSLO "https://github.com/${REPO}/releases/download/${TAG}/netwatch-${rpm_version}-1.x86_64.rpm"
-          dnf install -y "./netwatch-${rpm_version}-1.x86_64.rpm"
+          # The package's version is 1.0.0~rc.1, but GitHub serves a `~` in an
+          # asset's name as `.`.
+          rpm_file="netwatch-$(tr - . <<< "${VERSION}")-1.x86_64.rpm"
+          curl -fsSLO "https://github.com/${REPO}/releases/download/${TAG}/${rpm_file}"
+          dnf install -y "./${rpm_file}"
           out=$(netwatch --version)
           echo "$out"
           grep -qF "${VERSION}" <<< "$out" ||
```

**File**: `.github/workflows/release.yml` (modified, +16/-1)
```diff
@@ -439,6 +439,17 @@ jobs:
             scripts/static-asset-names.sh
           fi
 
+      # GitHub replaces a `~` in an asset's name with `.`, so a pre-release's
+      # packages (netwatch_1.0.0~rc.1-1_amd64.deb) were served under names
+      # SHA256SUMS did not list, and `sha256sum -c` could not find them
+      # (1.0.0-rc.1). Renamed first, the sums, the attestations and the
+      # release all use the name GitHub serves. The version inside each
+      # package keeps its tilde.
+      - name: Name pre-release packages as GitHub serves them
+        run: |
+          shopt -s nullglob
+          for f in *~*; do mv -v "$f" "${f//\~/.}"; done
+
       # Every shipped binary must carry the dependency list `cargo auditable`
       # embeds. A build step that lost the wrapper still links fine, so
       # check the artifacts rather than trust the build.
@@ -574,9 +585,13 @@ jobs:
           context: packaging/docker
           platforms: linux/amd64,linux/arm64
           push: true
+          # `cond && x || y` is the expression language's only conditional,
+          # and it yields y whenever x is falsy. The old form put '' in x, so
+          # it always yielded :latest, and 1.0.0-rc.1 took :latest from
+          # 0.40.0. The non-empty value goes in x.
           tags: |
             ghcr.io/${{ github.repository }}:${{ env.RELEASE_TAG }}
-            ${{ contains(env.RELEASE_TAG, '-') && '' || format('ghcr.io/{0}:latest', github.repository) }}
+            ${{ !contains(env.RELEASE_TAG, '-') && format('ghcr.io/{0}:latest', github.repository) || '' }}
 
       # The image's provenance, pushed to GHCR next to it. Verified with:
       #   gh attestation verify oci://ghcr.io/matthart1983/netwatch:vX.Y.Z -R matthart1983/netwatch
```

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -5,6 +5,15 @@ All notable changes to NetWatch will be documented in this file.
 ## [Unreleased]
 
 ### Fixed
+- **A pre-release's `SHA256SUMS` names its packages as GitHub serves them.** GitHub turns
+  a `~` in an asset's name into `.`, so 1.0.0-rc.1's sums listed `netwatch_1.0.0~rc.1-1_amd64.deb`
+  while the release served `netwatch_1.0.0.rc.1-1_amd64.deb`, and `sha256sum -c` could not
+  find the four packages. The release workflow renames them before the sums are taken.
+  1.0.0-rc.1's `SHA256SUMS` was replaced with the corrected names; the hashes are unchanged.
+- **A pre-release no longer takes the container image's `:latest`.** The release workflow's
+  condition always added `:latest`, so 1.0.0-rc.1 replaced 0.40.0 there, and
+  `docker run ghcr.io/matthart1983/netwatch` pulled the candidate. `:latest` was put back on
+  0.40.0 by re-running 0.40.0's own container job.
 - **The Nix build passes its tests on Linux 7.2.** A sandbox test expected a TCP Fast Open
   send from a parser thread to get past the Landlock network deny. Linux 7.2 closes that gap,
   and kernels with the stable backport may too, so the test failed and the build stopped
```

**File**: `docs/PACKAGING.md` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ What each channel does with a hyphenated tag:
 | GitHub release | published, marked pre-release; `/releases/latest` stays on the last release |
 | crates.io | published; `cargo install` and `cargo binstall` take it only when asked for by version |
 | GHCR | `:v1.0.0-rc.1`, never `:latest` |
-| `.deb` / `.rpm` assets | `1.0.0~rc.1-1`, which both sort below `1.0.0` |
+| `.deb` / `.rpm` assets | version `1.0.0~rc.1-1`, which both sort below `1.0.0`; the file names say `1.0.0.rc.1`, since GitHub serves no `~` in an asset's name |
 | apt repository, COPR | skipped: each has one channel that users upgrade from |
 | Homebrew, Scoop, conda-forge | not picked up; they follow releases |
 
```

#### Recent Merged Pull Requests:
- **PR #198** (2026-11-08): fix(memory): turn transparent huge pages off at startup on Linux (@matthart1983)
- **PR #196** (2026-11-07): fix(sandbox): accept a denied TCP Fast Open send in the gap test (#192) (@matthart1983)
- **PR #191** (2026-11-07): fix(release): name pre-release packages as GitHub serves them, and keep :latest off them (@matthart1983)
- **PR #190** (2026-11-07): docs(performance): record the plateau gate exception for 1.0.0-rc.1 (@matthart1983)
- **PR #189** (2026-11-07): Record the light demo in the paper theme (@matthart1983)
- **PR #188** (2026-11-07): README: light-terminal demo at the top; re-record the dark demo on 0.40.0 (@matthart1983)

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

## X. sandbox): accept a denied TCP Fast Open send in the gap test (#196)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matthart1983/netwatch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fc4b48fe`: sandbox): accept a denied TCP Fast Open send in the gap test (#196). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## [Unreleased]

### Fixed
- **The Nix build passes its tests on Linux 7.2.** A sandbox test expected a TCP Fast Open
  send from a parser thread to get past the Landlock network deny. Linux 7.2 closes that gap,
  and kernels with the stable backport may too, so the test failed and the build stopped
  (#192). The test now accepts a denied send, as long as nothing reaches the listener, and
  the threat model scopes the Fast Open gap to kernels without the fix.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fc4b48fe` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
