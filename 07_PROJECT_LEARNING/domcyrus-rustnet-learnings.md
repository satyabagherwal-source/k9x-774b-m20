# Forensic Learning Record (Deep Inspection): domcyrus/rustnet

> **Canonical Artifact**: `07_PROJECT_LEARNING/domcyrus-rustnet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/domcyrus/rustnet](https://github.com/domcyrus/rustnet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:39:28.896Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `domcyrus/rustnet`
- **Description**: Per-process network monitoring for your terminal with deep packet inspection. Cross-platform, sandboxed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5092 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/rustnet-core/src/lib.rs`
```
//! # rustnet-core
//!
//! The reusable network-analysis core of [RustNet](https://github.com/domcyrus/rustnet):
//! packet parsing, protocol types, deep packet inspection (DPI), link-layer
//! parsers, connection merging, and DNS / GeoIP / OUI lookups.
//!
//! This crate is platform-independent and capture-independent: it operates on
//! byte slices and parsed structures, with no dependency on `libpcap`, raw
//! sockets, or OS process tables. Raw packet capture and platform-specific
//! process attribution live in the `rustnet` binary crate.
//!
//! ## Capabilities
//!
//! - **Packet parsing** for Ethernet, Linux SLL/SLL2, PKTAP, raw IP, and
//!   TUN/TAP link layers, plus IPv4/IPv6, TCP, UDP, ICMP, and IGMP.
//! - **Deep packet inspection** for HTTP, HTTPS/TLS with SNI extraction,
//!   DNS, SSH, QUIC, NTP, mDNS, LLMNR, DHCP, SNMP, SSDP, NetBIOS, and more.
//! - **Connection merging**: fold parsed packets into long-lived connection
//!   state with protocol-aware lifecycle tracking and TCP analytics.
//! - **Reusable filtering and retention policy** through `ConnectionFilter`
//!   and `TrackerConfig`, independent of any frontend.
//! - **GeoIP** lookups against MaxMind GeoLite2 databases.
//! - **Reverse DNS** with background async resolution and caching.
//! - **OUI** vendor resolution and **service** name resolution (baked-in
//!   datasets).
//!
//! ## Layout
//!
//! All modules live under [`network`].

pub mod network;

```

### Core Architecture Module: `crates/rustnet-core/src/network/bogon.rs`
```
//! Classification of an IP address into a routing/usage scope: globally
//! routable ("public"), or one of the RFC-reserved ranges (private, loopback,
//! link-local, multicast, documentation, etc.).
//!
//! Used to label remote endpoints in the UI so internal traffic is visually
//! distinguishable from public-Internet traffic. Pure passive classification:
//! no lookups, no I/O.
//!
//! The set of non-public categories is intentionally small but covers the
//! ranges users care about when scanning a connection list. Stable-Rust
//! `is_*` helpers on `Ipv4Addr` / `Ipv6Addr` only cover a subset, so the
//! checks here are done with explicit bit-mask comparisons to avoid relying
//! on unstable APIs.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Scope {
    Public,
    Loopback,
    Private,
    LinkLocal,
    Cgnat,
    Multicast,
    Broadcast,
    Documentation,
    Benchmarking,
    Unspecified,
    Reserved,
    UniqueLocal,
    Discard,
    Ipv4Mapped,
}

impl Scope {
    /// Short, all-caps tag suitable for inline display in a detail panel.
    pub fn label(self) -> &'static str {
        match self {
            Scope::Public => "PUBLIC",
            Scope::Loopback => "LOOPBACK",
            Scope::Private => "PRIVATE",
            Scope::LinkLocal => "LINK-LOCAL",
            Scope::Cgnat => "CGNAT",
            Scope::Multicast => "MULTICAST",
            Scope::Broadcast => "BROADCAST",
            Scope::Documentation => "DOCUMENTATION",
            Scope::Benchmarking => "BENCHMARKING",
            Scope::Unspecified => "UNSPECIFIED",
            Scope::Reserved => "RESERVED",
            Scope::UniqueLocal => "UNIQUE-LOCAL",
            Scope::Discard => "DISCARD",
            Scope::Ipv4Mapped => "IPV4-MAPPED",
        }
    }
}

pub fn classify(ip: IpAddr) -> Scope {
    match ip {
        IpAddr::V4(v4) => classify_v4(v4),
        IpAddr::V6(v6) => classify_v6(v6),
    }
}

fn classify_v4(ip: Ipv4Addr) -> Scope {
    let octets = ip.octets();
    let [a, b, _, _] = octets;

    if ip.is_unspecified() {
        return Scope::Unspecified;
    }
    if a == 127 {
        return Scope::Loopback;
    }
    // RFC 1918
    if a == 10 || (a == 172 && (16..=31).contains(&b)) || (a == 192 && b == 168) {
        return Scope::Private;
    }
    if a == 169 && b == 254 {
        return Scope::LinkLocal;
    }
    // RFC 6598 carrier-grade NAT: 100.64.0.0/10
    if a == 100 && (64..=127).contains(&b) {
        return Scope::Cgnat;
    }
    // Documentation: 192.0.2.0/24 (TEST-NET-1), 198.51.100.0/24 (TEST-NET-2),
    // 203.0.113.0/24 (TEST-NET-3).
    if (a == 192 && b == 0 && octets[2] == 2)
        || (a == 198 && b == 51 && octets[2] == 100)
        || (a == 203 && b == 0 && octets[2] == 113)
    {
        return Scope::Documentation;
    }
    // RFC 2544 benchmarking: 198.18.0.0/15
    if a == 198 && (b == 18 || b == 19) {
        return Scope::Benchmarking;
    }
    if octets == [255, 255, 255, 255] {
        return Scope::Broadcast;
    }
    // 224.0.0.0/4 multicast
    if (224..=239).contains(&a) {
        return Scope::Multicast;
    }
    // 240.0.0.0/4 reserved (excluding the 255.255.255.255 broadcast above)
    if a >= 240 {
        return Scope::Reserved;
    }
    Scope::Public
}

fn classify_v6(ip: Ipv6Addr) -> Scope {
    if ip.is_unspecified() {
        return Scope::Unspecified;
    }
    if ip.is_loopback() {
        return Scope::Loopback;
    }
    let segs = ip.segments();
    // ::ffff:0:0/96 IPv4-mapped
    if segs[0..5] == [0, 0, 0, 0, 0] && segs[5] == 0xffff {
        return Scope::Ipv4Mapped;
    }
    // 100::/64 discard prefix (RFC 6666)
    if segs[0] == 0x0100 && segs[1] == 0 && segs[2] == 0 && segs[3] == 0 {
        return Scope::Discard;
    }
    // 2001:db8::/32 documentation
    if segs[0] == 0x2001 && segs[1] == 0x0db8 {
        return Scope::Documentation;
    }
    // ff00::/8 multicast
    if (segs[0] >> 8) == 0xff {
        return Scope::Multicast;
    }
    // fe80::/10 link-local
    if (segs[0] & 0xffc0) == 0xfe80 {
        return Scope::LinkLocal;
    }
    // fc00::/7 unique-local
    if (segs[0] & 0xfe00) == 0xfc00 {
        return Scope::UniqueLocal;
    }
    Scope::Public
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v4(s: &str) -> IpAddr {
        IpAddr::V4(s.parse().unwrap())
    }

    fn v6(s: &str) -> IpAddr {
        IpAddr::V6(s.parse().unwrap())
    }

    #[test]
    fn rfc1918_10_slash_8_is_private() {
        assert_eq!(classify(v4("10.0.0.1")), Scope::Private);
        assert_eq!(classify(v4("10.255.255.254")), Scope::Private);
        assert_eq!(classify(v4("10.0.0.0")), Scope::Private);
        assert_eq!(classify(v4("10.0.0.0")).label(), "PRIVATE");
    }

    #[test]
    fn ipv4_169_254_slash_16_is_link_local() {
        assert_eq!(classify(v4("169.254.1.1")), Scope::LinkLocal);
        assert_eq!(classify(v4("169.254.255.255")), Scope::LinkLocal);
        assert_eq!(classify(v4("169.254.0.0")).label(), "LINK-LOCAL");
        // Sibling /16 must not match.
        assert_eq!(classify(v4("169.253.1.1")), Scope::Public);
    }

    #[test]
    fn ipv6_fe80_slash_10_is_link_local() {
        assert_eq!(classify(v6("fe80::1")), Scope::LinkLocal);
        assert_eq!(
            classify(v6("febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff")),
            Scope::LinkLocal
        );
        assert_eq!(classify(v6("fe80::1")).label(), "LINK-LOCAL");
        // fec0::/10 site-local is deprecated and outside fe80::/10.
        assert_eq!(classify(v6("fec0::1")), Scope::Public);
    }

    // One representative per remaining category.

    #[test]
    fn ipv4_other_categories() {
        assert_eq!(classify(v4("172.16.0.1")), Scope::Private);
        assert_eq!(classify(v4("192.168.1.1")), Scope::Private);
        assert_eq!(classify(v4("172.32.0.1")), Scope::Public); // outside 172.16/12
        assert_eq!(classify(v4("127.0.0.1")), Scope::Loopback);
        assert_eq!(classify(v4("0.0.0.0")), Scope::Unspecified);
        assert_eq!(classify(v4("100.64.0.1")), Scope::Cgnat);
        assert_eq!(classify(v4("100.128.0.1")), Scope::Public); // outside 100.64/10
        assert_eq!(classify(v4("224.0.0.251")), Scope::Multicast); // mDNS
        assert_eq!(classify(v4("239.255.255.250")), Scope::Multicast);
        assert_eq!(classify(v4("255.255.255.255")), Scope::Broadcast);
        assert_eq!(classify(v4("192.0.2.1")), Scope::Documentation);
        assert_eq!(classify(v4("198.51.100.5")), Scope::Documentation);
        assert_eq!(classify(v4("203.0.113.7")), Scope::Documentation);
        assert_eq!(classify(v4("198.18.0.1")), Scope::Benchmarking);
        assert_eq!(classify(v4("240.0.0.1")), Scope::Reserved);
    }

    #[test]
    fn ipv6_other_categories() {
        assert_eq!(classify(v6("::")), Scope::Unspecified);
        assert_eq!(classify(v6("::1")), Scope::Loopback);
        assert_eq!(classify(v6("ff02::1")), Scope::Multicast);
        assert_eq!(classify(v6("fc00::1")), Scope::UniqueLocal);
        assert_eq!(classify(v6("fd00::1")), Scope::UniqueLocal);
        assert_eq!(classify(v6("2001:db8::1")), Scope::Documentation);
        assert_eq!(classify(v6("100::1")), Scope::Discard);
        assert_eq!(classify(v6("::ffff:1.2.3.4")), Scope::Ipv4Mapped);
    }

    #[test]
    fn public_ips_are_classified_public() {
        assert_eq!(classify(v4("1.1.1.1")), Scope::Public);
        assert_eq!(classify(v4("8.8.8.8")), Scope::Public);
        assert_eq!(classify(v4("93.184.216.34")), Scope::Public);
        assert_eq!(classify(v6("2606:4700:4700::1111")), Scope::Public);
        assert_eq!(classify(v4("1.1.1.1")).label(), "PUBLIC");
    }
}

```

### Core Architecture Module: `crates/rustnet-core/src/network/dns.rs`
```
//! DNS resolver with background async resolution and caching.
//!
//! Provides non-blocking reverse DNS lookups with an LRU cache to avoid
//! repeated lookups for the same IP address.

use crate::network::bogon::{Scope, classify};
use crossbeam::channel::{self, Receiver, Sender};
use dashmap::DashMap;
use dashmap::mapref::entry::Entry;
use dns_lookup::lookup_addr;
use log::debug;
use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Resolution state for a cached entry
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ResolutionState {
    /// Resolution is in progress
    Pending,
    /// Resolution succeeded
    Resolved,
    /// Resolution failed
    Failed,
}

#[derive(Debug, Clone, Copy)]
struct ResolutionRequest {
    ip: IpAddr,
    reserved_at: Instant,
}

type Worker = Box<dyn FnOnce() + Send + 'static>;
type StartupGate = Arc<(Mutex<Option<bool>>, Condvar)>;

fn wait_for_startup(gate: &StartupGate) -> bool {
    let (state, ready) = &**gate;
    let mut state = state.lock().unwrap_or_else(|error| error.into_inner());
    while state.is_none() {
        state = ready.wait(state).unwrap_or_else(|error| error.into_inner());
    }
    state.unwrap_or(false)
}

fn release_startup_gate(gate: &StartupGate, start: bool) {
    let (state, ready) = &**gate;
    *state.lock().unwrap_or_else(|error| error.into_inner()) = Some(start);
    ready.notify_all();
}

/// Cached hostname entry
#[derive(Debug, Clone)]
pub(crate) struct CachedHostname {
    /// The resolved hostname, if successful
    pub hostname: Option<String>,
    /// When this entry was resolved
    pub resolved_at: Instant,
    /// Current resolution state
    pub state: ResolutionState,
}

/// How long a `Pending` entry is trusted before the lookup is considered
/// lost and the address may be queued again.
const PENDING_TIMEOUT: Duration = Duration::from_secs(30);

impl CachedHostname {
    /// Whether this entry still answers for its address: resolved names live
    /// for `cache_ttl`, failures for `negative_cache_ttl`, and in-flight
    /// lookups for [`PENDING_TIMEOUT`].
    fn is_fresh(&self, cache_ttl: Duration, negative_cache_ttl: Duration) -> bool {
        let age = self.resolved_at.elapsed();
        match self.state {
            ResolutionState::Resolved => age < cache_ttl,
            ResolutionState::Failed => age < negative_cache_ttl,
            ResolutionState::Pending => age < PENDING_TIMEOUT,
        }
    }

    fn pending() -> Self {
        Self {
            hostname: None,
            resolved_at: Instant::now(),
            state: ResolutionState::Pending,
        }
    }

    fn resolved(hostname: String) -> Self {
        Self {
            hostname: Some(hostname),
            resolved_at: Instant::now(),
            state: ResolutionState::Resolved,
        }
    }

    fn failed() -> Self {
        Self {
            hostname: None,
            resolved_at: Instant::now(),
            state: ResolutionState::Failed,
        }
    }
}

/// Configuration for DNS resolver
#[derive(Debug, Clone)]
pub(crate) struct DnsResolverConfig {
    /// Cache TTL for resolved hostnames (default: 5 minutes)
    pub cache_ttl: Duration,
    /// Cache TTL for failed lookups (default: 1 minute)
    pub negative_cache_ttl: Duration,
    /// Maximum cache size (default: 10000 entries)
    pub max_cache_size: usize,
    /// Maximum queued lookup requests (default: 10000 entries)
    pub request_queue_capacity: usize,
    /// Number of resolver threads (default: 4)
    pub resolver_threads: usize,
    /// Total time allowed for all DNS workers to stop (default: 1 second)
    pub shutdown_timeout: Duration,
}

impl Default for DnsResolverConfig {
    fn default() -> Self {
        Self {
            cache_ttl: Duration::from_secs(300),         // 5 minutes
            negative_cache_ttl: Duration::from_secs(60), // 1 minute
            max_cache_size: 10000,
            request_queue_capacity: 10000,
            resolver_threads: 4,
            shutdown_timeout: Duration::from_secs(1),
        }
    }
}

#[derive(Default)]
struct DnsResolverLifecycle {
    started: bool,
    stopped: bool,
    handles: Vec<JoinHandle<()>>,
    stop_report: Option<DnsStopReport>,
}

/// Outcome of stopping the DNS resolver's background workers.
///
/// A worker is counted exactly once. Successfully joined workers contribute to
/// `joined`, workers whose join observed a panic contribute to `panicked`, and
/// workers still running when the shared shutdown deadline expires contribute
/// to `timed_out`. Timed-out worker handles are detached because a blocking
/// system resolver call cannot be forcibly cancelled safely.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DnsStopReport {
    /// Workers that exited and were joined successfully.
    pub joined: usize,
    /// Workers that exited with a panic.
    pub panicked: usize,
    /// Workers detached after the shutdown deadline expired.
    pub timed_out: usize,
}

/// Background DNS resolver with caching
pub struct DnsResolver {
    /// Hostname cache: IP -> CachedHostname
    cache: Arc<DashMap<IpAddr, CachedHostname>>,
    /// Channel to send IPs for resolution
    request_tx: Sender<ResolutionRequest>,
    /// Channel consumed by resolver threads once background work is started
    request_rx: Receiver<ResolutionRequest>,
    /// Startup, shutdown, and worker ownership
    lifecycle: Mutex<DnsResolverLifecycle>,
    /// Control flag for shutdown
    should_stop: Arc<AtomicBool>,
    /// Configuration
    config: DnsResolverConfig,
}

impl DnsResolver {
    /// Build a DNS resolver without starting background threads.
    fn new_deferred(config: DnsResolverConfig) -> Self {
        let cache = Arc::new(DashMap::new());
        let (request_tx, request_rx) = channel::bounded(config.request_queue_capacity);
        let should_stop = Arc::new(AtomicBool::new(false));

        Self {
            cache,
            request_tx,
            request_rx,
            lifecycle: Mutex::new(DnsResolverLifecycle::default()),
            should_stop,
            config,
        }
    }

    /// Create a DNS resolver that will not spawn background threads until
    /// [`DnsResolver::start`] is called.
    ///
    /// This is intended for runtimes that must finish privileged setup and
    /// apply a process sandbox before starting general worker threads.
    pub fn with_defaults_deferred() -> Self {
        Self::new_deferred(DnsResolverConfig::default())
    }

    /// Start the background resolver and cache-cleanup threads.
    ///
    /// Starting is idempotent. A resolver that has already been stopped cannot
    /// be restarted.
    ///
    /// Returns an error if a worker cannot be spawned. Workers staged before
    /// that failure are stopped and joined before the error is returned.
    pub fn start(&self) -> anyhow::Result<()> {
        self.start_with_spawner(|name, worker| thread::Builder::new().name(name).spawn(worker))
    }

    fn start_with_spawner(
        &self,
        mut spawn: impl FnMut(String, Worker) -> std::io::Result<JoinHandle<()>>,
    ) -> anyhow::Result<()> {
        let mut lifecycle = self
            .lifecycle
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if lifecycle.started || lifecycle.stopped || self.should_stop.load(Ordering::Acquire) {
            return Ok(());
        }

        // Staged workers wait here until every spawn succeeds. If a later spawn
        // fails, the workers are released directly into their exit path and can
        // all be joined without starting a potentially blocking resolver call.
        let startup_gate = Arc::new((Mutex::new(None), Condvar::new()));
        let mut handles = Vec::with_capacity(self.config.resolver_threads + 1);

        for index in 0..self.config.resolver_threads {
            let rx = self.request_rx.clone();
            let cache = Arc::clone(&self.cache);
            let should_stop = Arc::clone(&self.should_stop);
            let worker_gate = Arc::clone(&startup_gate);

            let worker: Worker = Box::new(move || {
                if !wait_for_startup(&worker_gate) {
                    return;
                }

                debug!("DNS resolver thread {} started", index);

                while !should_stop.load(Ordering::Relaxed) {
                    match rx.recv_timeout(Duration::from_millis(100)) {
                        Ok(request) => {
                            let reservation_is_current =
                                cache.get(&request.ip).is_some_and(|entry| {
                                    entry.state == ResolutionState::Pending
                                        && entry.resolved_at == request.reserved_at
                                });
                            if !reservation_is_current {
                                continue;
                            }

                            let result = match lookup_addr(&request.ip) {
                                Ok(hostname) => {
                                    debug!("Resolved {} -> {}", request.ip, hostname);
                                    CachedHostname::resolved(hostname)
                                }
                                Err(error) => {
                                    debug!("Failed to resolve {}: {}", request.ip, error);
                                    CachedHostname::failed()
                                }
                            };

                            // A timed-out reservation may have been superseded
                            // while the system resolver was blocked. Never let
                            // its late result overwrite the newer generation.
                            if let Entry::Occupied(mut entry) = cache.entry(request.ip)
                               
```

### Core Architecture Module: `crates/rustnet-core/src/network/dns_analytics.rs`
```
//! Bounded passive DNS transaction analytics.

use std::collections::{HashMap, VecDeque};
use std::time::{Duration, SystemTime};

use super::types::{ConnectionKey, DnsInfo, DnsQueryType};

const DNS_ANALYTICS_WINDOW: Duration = Duration::from_secs(60);
const DNS_TRANSACTION_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_PENDING_DNS_TRANSACTIONS: usize = 4096;
const MAX_RETAINED_DNS_TRANSACTIONS: usize = 8192;
/// Operational-failure share of finalized lookups that degrades DNS health.
pub const DEGRADED_FAILURE_PERCENT: usize = 20;
const DEGRADED_P95: Duration = Duration::from_millis(500);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DnsHealth {
    #[default]
    NotObserved,
    Checking,
    Responsive,
    Degraded,
    Failing,
    NoReplies,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DnsQuestionStats {
    pub name: String,
    pub query_type: Option<DnsQueryType>,
    pub lookups: usize,
    pub nxdomain: usize,
    pub failures: usize,
    pub latency_p95: Option<Duration>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DnsAnalyticsSnapshot {
    pub health: DnsHealth,
    pub lookups: usize,
    pub answered: usize,
    pub pending: usize,
    pub timeouts: usize,
    pub noerror: usize,
    pub nxdomain: usize,
    pub servfail: usize,
    pub refused: usize,
    pub other_rcodes: usize,
    pub nodata: usize,
    /// Operational failures among finalized lookups: timeouts plus every
    /// response other than NOERROR or NXDOMAIN.
    pub failures: usize,
    pub latency_samples: usize,
    pub latency_p50: Option<Duration>,
    pub latency_p95: Option<Duration>,
    pub latency_max: Option<Duration>,
    /// Latency buckets: below 10ms, 10ms to below 50ms, 50ms to below
    /// 100ms, and 100ms or slower.
    pub latency_buckets: [usize; 4],
    pub questions: Vec<DnsQuestionStats>,
    /// True when capacity pressure within the rolling window caused at least
    /// one transaction sample to be omitted or evicted.
    pub truncated: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct TransactionKey {
    connection: ConnectionKey,
    txid: u16,
}

#[derive(Debug)]
struct PendingTransaction {
    sent_at: SystemTime,
    query_name: Option<String>,
    query_type: Option<DnsQueryType>,
}

#[derive(Debug)]
struct CompletedTransaction {
    completed_at: SystemTime,
    query_name: Option<String>,
    query_type: Option<DnsQueryType>,
    rcode: Option<u8>,
    nodata: bool,
    latency: Option<Duration>,
    timed_out: bool,
}

impl CompletedTransaction {
    fn is_normal_response(&self) -> bool {
        !self.timed_out && matches!(self.rcode, Some(0 | 3))
    }

    fn is_failure(&self) -> bool {
        !self.is_normal_response()
    }
}

#[derive(Debug, Default)]
struct QuestionAggregate {
    lookups: usize,
    nxdomain: usize,
    failures: usize,
    latencies: Vec<Duration>,
}

#[derive(Debug, Default)]
pub(crate) struct DnsAnalyticsTracker {
    pending: HashMap<TransactionKey, PendingTransaction>,
    completed: VecDeque<CompletedTransaction>,
    truncated_at: Option<SystemTime>,
}

impl DnsAnalyticsTracker {
    pub(crate) fn record_packet(
        &mut self,
        connection: ConnectionKey,
        info: &DnsInfo,
        is_outgoing: bool,
        at: SystemTime,
        latency: Option<Duration>,
    ) {
        self.advance(at);
        let key = TransactionKey {
            connection,
            txid: info.txid,
        };

        if is_outgoing && !info.is_response {
            let pending = PendingTransaction {
                sent_at: at,
                query_name: normalize_query_name(info.query_name.as_deref()),
                query_type: info.query_type,
            };
            if self.pending.len() < MAX_PENDING_DNS_TRANSACTIONS || self.pending.contains_key(&key)
            {
                self.pending.insert(key, pending);
            } else {
                self.mark_truncated(at);
            }
            return;
        }

        if is_outgoing || !info.is_response {
            return;
        }

        let Some(mut pending) = self.pending.remove(&key) else {
            return;
        };
        if pending.query_name.is_none() {
            pending.query_name = normalize_query_name(info.query_name.as_deref());
        }
        if pending.query_type.is_none() {
            pending.query_type = info.query_type;
        }
        self.push_completed(CompletedTransaction {
            completed_at: at,
            query_name: pending.query_name,
            query_type: pending.query_type,
            rcode: info.rcode,
            nodata: info.nodata == Some(true),
            latency,
            timed_out: false,
        });
    }

    pub(crate) fn snapshot(&mut self, now: SystemTime) -> DnsAnalyticsSnapshot {
        self.advance(now);

        let mut snapshot = DnsAnalyticsSnapshot {
            pending: self.pending.len(),
            truncated: self.truncated_at.is_some(),
            ..DnsAnalyticsSnapshot::default()
        };
        let mut latencies = Vec::new();
        let mut questions: HashMap<(String, Option<DnsQueryType>), QuestionAggregate> =
            HashMap::new();
        let mut normal_responses = 0usize;
        let mut failures = 0usize;

        for transaction in &self.completed {
            if transaction.timed_out {
                snapshot.timeouts += 1;
            } else {
                snapshot.answered += 1;
                match transaction.rcode {
                    Some(0) => snapshot.noerror += 1,
                    Some(2) => snapshot.servfail += 1,
                    Some(3) => snapshot.nxdomain += 1,
                    Some(5) => snapshot.refused += 1,
                    _ => snapshot.other_rcodes += 1,
                }
                if transaction.nodata {
                    snapshot.nodata += 1;
                }
            }

            if transaction.is_normal_response() {
                normal_responses += 1;
            } else {
                failures += 1;
            }

            if let Some(latency) = transaction.latency {
                latencies.push(latency);
                let bucket = if latency < Duration::from_millis(10) {
                    0
                } else if latency < Duration::from_millis(50) {
                    1
                } else if latency < Duration::from_millis(100) {
                    2
                } else {
                    3
                };
                snapshot.latency_buckets[bucket] += 1;
            }

            if let Some(name) = &transaction.query_name {
                let aggregate = questions
                    .entry((name.clone(), transaction.query_type))
                    .or_default();
                aggregate.lookups += 1;
                if transaction.rcode == Some(3) {
                    aggregate.nxdomain += 1;
                }
                if transaction.is_failure() {
                    aggregate.failures += 1;
                }
                if let Some(latency) = transaction.latency {
                    aggregate.latencies.push(latency);
                }
            }
        }

        snapshot.lookups = self.completed.len() + snapshot.pending;
        snapshot.failures = failures;
        latencies.sort_unstable();
        snapshot.latency_samples = latencies.len();
        snapshot.latency_p50 = percentile(&latencies, 50);
        snapshot.latency_p95 = percentile(&latencies, 95);
        snapshot.latency_max = latencies.last().copied();

        snapshot.questions = questions
            .into_iter()
            .map(|((name, query_type), mut aggregate)| {
                aggregate.latencies.sort_unstable();
                DnsQuestionStats {
                    name,
                    query_type,
                    lookups: aggregate.lookups,
                    nxdomain: aggregate.nxdomain,
                    failures: aggregate.failures,
                    latency_p95: percentile(&aggregate.latencies, 95),
                }
            })
            .collect();
        snapshot.questions.sort_unstable_by(|a, b| {
            b.lookups
                .cmp(&a.lookups)
                .then_with(|| a.name.cmp(&b.name))
                .then_with(|| {
                    a.query_type
                        .map(|value| value.to_string())
                        .cmp(&b.query_type.map(|value| value.to_string()))
                })
        });

        snapshot.health = classify_health(HealthInputs {
            lookups: snapshot.lookups,
            pending: snapshot.pending,
            finalized: self.completed.len(),
            answered: snapshot.answered,
            timeouts: snapshot.timeouts,
            normal_responses,
            failures,
            latency_samples: snapshot.latency_samples,
            latency_p95: snapshot.latency_p95,
        });
        snapshot
    }

    pub(crate) fn clear(&mut self) {
        self.pending.clear();
        self.completed.clear();
        self.truncated_at = None;
    }

    fn advance(&mut self, now: SystemTime) {
        let pending_cutoff = now.checked_sub(DNS_TRANSACTION_TIMEOUT);
        let expired: Vec<TransactionKey> = pending_cutoff.map_or_else(Vec::new, |cutoff| {
            self.pending
                .iter()
                .filter_map(|(key, pending)| (pending.sent_at <= cutoff).then_some(*key))
                .collect()
        });
        for key in expired {
            if let Some(pending) = self.pending.remove(&key) {
                let completed_at = pending
                    .sent_at
                    .checked_add(DNS_TRANSACTION_TIMEOUT)
                    .unwrap_or(now);
                self.push_completed(CompletedTransaction {
                    completed_at,
                    query_name: pending.query_name,
                    query_type: pending.query_type,
                    rcode: None,
                    nodata: false,

```

### Core Architecture Module: `crates/rustnet-core/src/network/dns_attribution.rs`
```
//! DNS-based hostname attribution cache.
//!
//! Builds an IP -> domain map from DNS responses observed on the wire and
//! lets callers tag connections with the most recently resolved hostname
//! for that IP. This is how a QUIC or plain-TCP connection gets a
//! human-readable hostname even when no SNI / Host header is visible:
//! when the user resolved `foo.com -> 1.2.3.4` a moment before opening
//! the connection, we can attribute that connection to `foo.com`.
//!
//! Conceptually equivalent to what Little Snitch's eBPF DNS cache does on
//! Linux, but driven from pcap. CNAME chains are handled implicitly
//! because the DNS DPI parser already records the original *question*
//! name; the IPs in the answer section map directly to that.
//!
//! The cache is owned by `ConnectionTracker` and is called from inside
//! the tracker's connection-map entry closures (a shard lock is held).
//! It must therefore only ever touch its own maps: no method here may
//! call back into the tracker's connection table.

use dashmap::DashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant, SystemTime};

use crate::network::types::{
    AttributedHostname, AttributionSource, Connection, ConnectionKey, Protocol,
};

/// Entries kept per IP. CDN / load-balanced IPs may be claimed by several
/// names within the retention window; a small bound prevents pathological
/// growth.
const MAX_DOMAINS_PER_IP: usize = 4;

/// Default freshness window: the time horizon over which a DNS
/// observation and a connection are considered to belong to the same
/// user action. Used symmetrically: a cached IP -> domain entry is
/// trusted within this window, and a pending enrollment is kept while
/// it waits for matching DNS for at most this long. 10s matches Little
/// Snitch's `MAX_QUERY_AGE` and is tight enough to keep CDN-IP
/// collisions rare.
pub(crate) const DEFAULT_FRESH_WINDOW: Duration = Duration::from_secs(10);

/// Default retention window: entries past this are eligible for
/// pruning. Kept longer than `fresh_window` so debug accessors / detail
/// views can show recently-seen-but-not-fresh names if we ever want
/// them; lookups won't return these for attribution.
pub(crate) const DEFAULT_RETENTION: Duration = Duration::from_secs(600);

/// Default cap on tracked IPs.
pub(crate) const DEFAULT_MAX_ENTRIES: usize = 8192;

/// Cap on the number of connection keys that may wait on the same IP
/// for attribution. Bounds memory if many simultaneous connections to a
/// CDN IP all happen to predate any DNS observation.
const MAX_PENDING_PER_IP: usize = 256;

/// One observed (domain, when, source) tuple for an IP.
#[derive(Debug, Clone)]
pub(crate) struct AttributedDomain {
    pub domain: String,
    pub observed_at: Instant,
    pub source: AttributionSource,
}

/// One waiting connection key plus when it was enrolled.
#[derive(Debug, Clone, Copy)]
struct PendingEntry {
    conn_key: ConnectionKey,
    enrolled_at: Instant,
}

/// IP -> recent domains cache, populated from captured DNS responses.
///
/// In addition to the main IP -> domains map, the cache maintains a side
/// index of *pending attributions*: connections that have been observed
/// but couldn't be tagged yet because no fresh DNS for their remote IP
/// is in cache. When a DNS response later arrives for one of those IPs,
/// the cache surfaces the waiting connection keys so the caller can
/// attribute them in batch, no per-packet polling required.
///
/// All access is concurrent (DashMap), no outer lock required.
#[derive(Debug)]
pub(crate) struct DnsAttributionCache {
    map: DashMap<IpAddr, Vec<AttributedDomain>>,
    /// IP -> connection keys waiting on a DNS resolution for that IP.
    /// Entries are added by `attribute()` on a cache miss and drained
    /// by `record_and_drain_pending()` when the matching DNS response
    /// arrives. Connection cleanup calls `forget_pending()` so dead
    /// keys don't accumulate.
    pending: DashMap<IpAddr, Vec<PendingEntry>>,
    /// Tracked copy of `map.len()`, bumped on insert and refreshed by
    /// `prune()`. The per-packet path checks the cap against this
    /// instead of `DashMap::len()`, which read-locks every shard.
    map_len: AtomicUsize,
    max_entries: usize,
    fresh_window: Duration,
    retention: Duration,
}

impl Default for DnsAttributionCache {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_ENTRIES, DEFAULT_FRESH_WINDOW, DEFAULT_RETENTION)
    }
}

impl DnsAttributionCache {
    pub(crate) fn new(max_entries: usize, fresh_window: Duration, retention: Duration) -> Self {
        Self {
            map: DashMap::new(),
            pending: DashMap::new(),
            map_len: AtomicUsize::new(0),
            max_entries,
            fresh_window,
            retention,
        }
    }

    /// Record a DNS resolution: `query_name` resolved to `ips`.
    ///
    /// Empty inputs are ignored. Existing entries for an IP are updated
    /// in place: if the same domain is already present its timestamp is
    /// refreshed, otherwise the new entry is pushed and the per-IP list
    /// is trimmed to `MAX_DOMAINS_PER_IP` keeping the most recent.
    pub(crate) fn record(&self, query_name: &str, ips: &[IpAddr], source: AttributionSource) {
        let domain = query_name.trim().trim_end_matches('.');
        if domain.is_empty() || ips.is_empty() {
            return;
        }
        let now = Instant::now();

        for ip in ips {
            // Skip useless mappings.
            if ip.is_unspecified() || ip.is_loopback() {
                continue;
            }

            self.map
                .entry(*ip)
                .and_modify(|entries| {
                    if let Some(existing) = entries.iter_mut().find(|d| d.domain == domain) {
                        existing.observed_at = now;
                        existing.source = source;
                    } else {
                        entries.push(AttributedDomain {
                            domain: domain.to_string(),
                            observed_at: now,
                            source,
                        });
                    }
                    // Keep only the freshest MAX_DOMAINS_PER_IP entries.
                    if entries.len() > MAX_DOMAINS_PER_IP {
                        entries.sort_by_key(|d| std::cmp::Reverse(d.observed_at));
                        entries.truncate(MAX_DOMAINS_PER_IP);
                    }
                })
                .or_insert_with(|| {
                    self.map_len.fetch_add(1, Ordering::Relaxed);
                    vec![AttributedDomain {
                        domain: domain.to_string(),
                        observed_at: now,
                        source,
                    }]
                });
        }

        // Emergency prune, amortized: `prune()` trims to a watermark
        // below the cap, so under sustained diverse DNS traffic this
        // triggers at most once per `max_entries / 8` new IPs rather
        // than on every response.
        if self.map_len.load(Ordering::Relaxed) > self.max_entries {
            self.prune(now);
        }
    }

    /// Look up the freshest domain known for `ip`.
    ///
    /// Returns `None` when the IP is unknown or all known entries are
    /// older than `retention`. The boolean is `true` when the freshest
    /// entry is within `fresh_window` (and therefore trustworthy enough
    /// to attribute a new connection to).
    pub(crate) fn lookup(&self, ip: IpAddr) -> Option<(AttributedDomain, bool)> {
        let entries = self.map.get(&ip)?;
        let now = Instant::now();
        let freshest = entries
            .iter()
            .filter(|d| now.saturating_duration_since(d.observed_at) <= self.retention)
            .max_by_key(|d| d.observed_at)?
            .clone();
        let fresh = now.saturating_duration_since(freshest.observed_at) <= self.fresh_window;
        Some((freshest, fresh))
    }

    /// Tag `conn` (stored under `key`) with a hostname inferred from the
    /// freshest DNS resolution observed for its remote IP, if any.
    ///
    /// On a cache miss the connection's key is **enrolled in the
    /// pending index** so the next matching DNS response can attribute
    /// it without further work from the packet hot path. Callers
    /// therefore call this once at connection creation and rely on
    /// `record_and_drain_pending()` to do the eventual tagging.
    ///
    /// `key` must be the tracker's resolved (QUIC-coalesced) key, not
    /// one recomputed from the packet, so drained waiters find migrated
    /// QUIC connections.
    ///
    /// Short-circuits (no enrollment, no lookup) when attribution is
    /// unnecessary or impossible:
    ///
    /// * `attributed_hostname` is already set (first-write-wins).
    /// * Connection already has an *authoritative* hostname from DPI
    ///   (TLS SNI on HTTPS / QUIC, or HTTP `Host:`). The UI prefers
    ///   those over attribution.
    /// * Protocol is ARP or the connection carries a name-resolution
    ///   / local-discovery protocol (DNS, mDNS, LLMNR, DHCP, SSDP,
    ///   NetBIOS). Attribution is either nonsensical (the protocol
    ///   *is* the name lookup) or useless (broadcast / multicast).
    pub(crate) fn attribute(&self, conn: &mut Connection, key: ConnectionKey) {
        if conn.protocol == Protocol::Arp || conn.attributed_hostname.is_some() {
            return;
        }
        if conn.authoritative_hostname().is_some() {
            return;
        }
        if is_unattributable_protocol(conn) {
            return;
        }
        let ip = conn.remote_addr.ip();
        if let Some((att, fresh)) = self.lookup(ip)
            && fresh
        {
            conn.attributed_hostname = Some(to_attributed_hostname(att));
            return;
        }

        // Cache miss: enroll for the next matching DNS response.
        self.enroll_pend
```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/bittorrent.rs`
```
use crate::network::types::{BitTorrentInfo, BitTorrentType};
use crate::network::util::hex_encode;

/// BitTorrent protocol handshake prefix: length byte (19) + "BitTorrent protocol"
const BT_HANDSHAKE_PREFIX: &[u8] = b"\x13BitTorrent protocol";

/// Full handshake length: 1 (pstrlen) + 19 (pstr) + 8 (reserved) + 20 (info_hash) + 20 (peer_id)
const BT_HANDSHAKE_LEN: usize = 68;

/// Reserved byte bit positions for extension flags
const DHT_BIT_BYTE: usize = 7; // Byte 7, bit 0x01
const FAST_BIT_BYTE: usize = 7; // Byte 7, bit 0x04
const EXTENSION_BIT_BYTE: usize = 5; // Byte 5, bit 0x10

/// uTP header size (BEP 29)
const UTP_HEADER_LEN: usize = 20;

/// Maximum DHT method name length. Standard methods are short
/// (e.g., "ping", "find_node", "get_peers", "announce_peer").
const MAX_DHT_METHOD_LEN: usize = 64;

// --- TCP: Peer Handshake ---

/// Check if the payload starts with a BitTorrent peer handshake.
pub(super) fn is_bittorrent_handshake(payload: &[u8]) -> bool {
    payload.starts_with(BT_HANDSHAKE_PREFIX)
}

/// Analyze a BitTorrent TCP handshake payload and extract protocol details.
pub(super) fn analyze_bittorrent(payload: &[u8]) -> Option<BitTorrentInfo> {
    if !is_bittorrent_handshake(payload) {
        return None;
    }

    let reserved = if payload.len() >= 28 {
        Some(&payload[20..28])
    } else {
        None
    };

    let supports_dht = reserved.is_some_and(|r| r[DHT_BIT_BYTE] & 0x01 != 0);
    let supports_fast = reserved.is_some_and(|r| r[FAST_BIT_BYTE] & 0x04 != 0);
    let supports_extension = reserved.is_some_and(|r| r[EXTENSION_BIT_BYTE] & 0x10 != 0);

    let info_hash = if payload.len() >= 48 {
        let hash_bytes = &payload[28..48];
        Some(hex_encode(hash_bytes, ""))
    } else {
        None
    };

    let client = if payload.len() >= BT_HANDSHAKE_LEN {
        let peer_id = &payload[48..68];
        decode_client_name(peer_id)
    } else {
        None
    };

    Some(BitTorrentInfo {
        protocol_type: BitTorrentType::Peer,
        info_hash,
        client,
        dht_method: None,
        supports_dht,
        supports_extension,
        supports_fast,
    })
}

// --- UDP: DHT + uTP ---

/// Analyze a UDP payload for BitTorrent DHT or uTP traffic.
/// Tries DHT first (higher confidence), then uTP.
pub(super) fn analyze_udp_bittorrent(payload: &[u8]) -> Option<BitTorrentInfo> {
    if let Some(info) = analyze_dht(payload) {
        return Some(info);
    }
    analyze_utp(payload)
}

/// Analyze a UDP payload for BitTorrent DHT (bencoded dictionary messages).
///
/// DHT messages are bencoded dicts containing:
/// - `y`: message type, `q` (query), `r` (response), `e` (error)
/// - `q`: method name (for queries), `ping`, `find_node`, `get_peers`, `announce_peer`
/// - `t`: transaction ID
fn analyze_dht(payload: &[u8]) -> Option<BitTorrentInfo> {
    // Must start with 'd' (bencoded dict) and end with 'e'
    if payload.len() < 10 || payload[0] != b'd' || payload[payload.len() - 1] != b'e' {
        return None;
    }

    // Must contain the message type key "1:y1:" followed by q/r/e
    let pos = find_subsequence(payload, b"1:y1:")?;
    if pos + 6 > payload.len() {
        return None;
    }
    let msg_type_char = payload[pos + 5];
    if msg_type_char != b'q' && msg_type_char != b'r' && msg_type_char != b'e' {
        return None;
    }

    let dht_method = if msg_type_char == b'q' {
        extract_dht_method(payload)
    } else if msg_type_char == b'r' {
        Some("response".to_string())
    } else {
        Some("error".to_string())
    };

    Some(BitTorrentInfo {
        protocol_type: BitTorrentType::Dht,
        info_hash: None,
        client: None,
        dht_method,
        supports_dht: false,
        supports_extension: false,
        supports_fast: false,
    })
}

/// Extract the DHT query method name from a bencoded payload.
/// Looks for "1:q" followed by a bencoded string like "4:ping" or "9:find_node".
fn extract_dht_method(payload: &[u8]) -> Option<String> {
    let pos = find_subsequence(payload, b"1:q")?;
    let after = pos + 3;
    if after >= payload.len() {
        return None;
    }

    // Parse the bencoded string length: digits followed by ':'
    let mut len_end = after;
    while len_end < payload.len() && payload[len_end].is_ascii_digit() {
        len_end += 1;
    }
    if len_end == after || len_end >= payload.len() || payload[len_end] != b':' {
        return None;
    }

    let len_str = std::str::from_utf8(&payload[after..len_end]).ok()?;
    let str_len: usize = len_str.parse().ok()?;
    if str_len > MAX_DHT_METHOD_LEN {
        return None;
    }
    let str_start = len_end + 1;
    let str_end = str_start + str_len;
    if str_end > payload.len() {
        return None;
    }

    std::str::from_utf8(&payload[str_start..str_end])
        .ok()
        .map(String::from)
}

/// Analyze a UDP payload for BitTorrent uTP (Micro Transport Protocol, BEP 29).
///
/// uTP header (20 bytes):
/// - Byte 0: type (upper 4 bits) | version (lower 4 bits, must be 1)
/// - Byte 1: extension
/// - Bytes 2-3: connection_id
/// - Bytes 4-7: timestamp_microseconds
/// - Bytes 8-11: timestamp_difference_microseconds
/// - Bytes 12-15: wnd_size
/// - Bytes 16-17: seq_nr
/// - Bytes 18-19: ack_nr
fn analyze_utp(payload: &[u8]) -> Option<BitTorrentInfo> {
    if payload.len() < UTP_HEADER_LEN {
        return None;
    }

    let first_byte = payload[0];
    let version = first_byte & 0x0F;
    let pkt_type = (first_byte >> 4) & 0x0F;
    let extension = payload[1];

    // Version must be 1
    if version != 1 {
        return None;
    }

    // Type must be 0-4: ST_DATA, ST_FIN, ST_STATE, ST_RESET, ST_SYN
    if pkt_type > 4 {
        return None;
    }

    // Extension byte should be small (0=none, 1=selective ack, 2=extension bits)
    if extension > 2 {
        return None;
    }

    // Real uTP connection IDs are randomly generated, so 0 is effectively
    // never seen, but bytes 2-3 == 0 is exactly what a WireGuard handshake
    // initiation looks like here (type byte 0x01 followed by three reserved
    // zero bytes). Since this check runs on every unmatched UDP packet,
    // require a non-zero connection ID so WireGuard rekeys are not
    // classified as BitTorrent.
    let connection_id = u16::from_be_bytes([payload[2], payload[3]]);
    if connection_id == 0 {
        return None;
    }

    // Window size sanity check: 0 is valid for ST_RESET but otherwise should be non-zero
    let wnd_size = u32::from_be_bytes([payload[12], payload[13], payload[14], payload[15]]);
    if pkt_type != 3 && wnd_size == 0 {
        // ST_SYN with zero window is also suspicious
        return None;
    }

    Some(BitTorrentInfo {
        protocol_type: BitTorrentType::Utp,
        info_hash: None,
        client: None,
        dht_method: None,
        supports_dht: false,
        supports_extension: false,
        supports_fast: false,
    })
}

// --- Helpers ---

/// Decode the BitTorrent client name from a 20-byte peer_id using the Azureus-style convention.
///
/// Azureus-style: `-XX1234-............` where XX is the client ID and 1234 is the version.
fn decode_client_name(peer_id: &[u8]) -> Option<String> {
    if peer_id.len() >= 8 && peer_id[0] == b'-' && peer_id[7] == b'-' {
        let client_id = std::str::from_utf8(&peer_id[1..3]).ok()?;
        let version_bytes = &peer_id[3..7];

        let name = match client_id {
            "qB" => "qBittorrent",
            "TR" => "Transmission",
            "DE" => "Deluge",
            "UT" => "uTorrent",
            "lt" => "libtorrent",
            "LT" => "libtorrent",
            "AZ" => "Azureus",
            "BT" => "BitTorrent",
            "BI" => "BiglyBT",
            "FD" => "Free Download Manager",
            "KT" => "KTorrent",
            "RB" => "rtorrent",
            "WW" => "WebTorrent",
            "FL" => "Flud",
            "SD" => "Xunlei",
            "TL" => "Tribler",
            _ => client_id,
        };

        let version = format_version(version_bytes);
        Some(format!("{name} {version}"))
    } else if peer_id[0].is_ascii_alphanumeric() {
        let id_char = peer_id[0] as char;
        let name = match id_char {
            'M' => "Mainline",
            'S' => "Shadow",
            'T' => "BitTornado",
            'A' => "ABC",
            _ => return None,
        };
        Some(name.to_string())
    } else {
        None
    }
}

/// Format version bytes into a dotted version string.
fn format_version(bytes: &[u8]) -> String {
    bytes
        .iter()
        .filter_map(|&b| {
            if b.is_ascii_digit() {
                Some((b - b'0').to_string())
            } else if b.is_ascii_alphanumeric() {
                Some((b as char).to_string())
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join(".")
}

/// Find the first occurrence of a subsequence in a byte slice.
fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- TCP Handshake Tests ---

    fn build_handshake(reserved: [u8; 8], info_hash: [u8; 20], peer_id: &[u8; 20]) -> Vec<u8> {
        let mut payload = Vec::with_capacity(BT_HANDSHAKE_LEN);
        payload.extend_from_slice(BT_HANDSHAKE_PREFIX);
        payload.extend_from_slice(&reserved);
        payload.extend_from_slice(&info_hash);
        payload.extend_from_slice(peer_id);
        payload
    }

    #[test]
    fn test_handshake_detection() {
        let payload = build_handshake([0; 8], [0xAB; 20], b"-qB4250-xxxxxxxxxxxx");
        assert!(is_bittorrent_handshake(&payload));
    }

    #[test]
    fn test_non_bittorrent_payloads() {
        assert!(!is_bittorrent_handshake(b"GET / HTTP/1.1\r\n"));
        assert!(!is_bittorrent_handshake(b"SSH-2.0-OpenSSH_8.9\r\n"));
        asser
```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/cipher_suites.rs`
```
//! TLS Cipher Suite mappings
//!
//! This module provides mappings from cipher suite codes to their human-readable names.
//! The mappings are based on the IANA TLS Cipher Suite Registry and include commonly
//! used cipher suites from TLS 1.0 through TLS 1.3.

use std::collections::HashMap;
use std::sync::LazyLock;

/// Static mapping of cipher suite codes to their names
static CIPHER_SUITE_MAP: LazyLock<HashMap<u16, &'static str>> = LazyLock::new(|| {
    let mut map = HashMap::new();

    // TLS 1.3 Cipher Suites (RFC 8446)
    map.insert(0x1301, "TLS_AES_128_GCM_SHA256");
    map.insert(0x1302, "TLS_AES_256_GCM_SHA384");
    map.insert(0x1303, "TLS_CHACHA20_POLY1305_SHA256");
    map.insert(0x1304, "TLS_AES_128_CCM_SHA256");
    map.insert(0x1305, "TLS_AES_128_CCM_8_SHA256");

    // TLS 1.2 ECDHE Cipher Suites (RFC 5289, RFC 7905)
    map.insert(0xc02b, "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256");
    map.insert(0xc02c, "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384");
    map.insert(0xc02f, "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256");
    map.insert(0xc030, "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384");
    map.insert(0xc009, "TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA");
    map.insert(0xc00a, "TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA");
    map.insert(0xc013, "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA");
    map.insert(0xc014, "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA");
    map.insert(0xc023, "TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256");
    map.insert(0xc024, "TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384");
    map.insert(0xc027, "TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256");
    map.insert(0xc028, "TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384");

    // ChaCha20-Poly1305 (RFC 7905)
    map.insert(0xcca9, "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256");
    map.insert(0xcca8, "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256");
    map.insert(0xccaa, "TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256");

    // DHE Cipher Suites
    map.insert(0x009e, "TLS_DHE_RSA_WITH_AES_128_GCM_SHA256");
    map.insert(0x009f, "TLS_DHE_RSA_WITH_AES_256_GCM_SHA384");
    map.insert(0x0033, "TLS_DHE_RSA_WITH_AES_128_CBC_SHA");
    map.insert(0x0039, "TLS_DHE_RSA_WITH_AES_256_CBC_SHA");
    map.insert(0x0067, "TLS_DHE_RSA_WITH_AES_128_CBC_SHA256");
    map.insert(0x006b, "TLS_DHE_RSA_WITH_AES_256_CBC_SHA256");

    // RSA Cipher Suites (less preferred but still common)
    map.insert(0x009c, "TLS_RSA_WITH_AES_128_GCM_SHA256");
    map.insert(0x009d, "TLS_RSA_WITH_AES_256_GCM_SHA384");
    map.insert(0x002f, "TLS_RSA_WITH_AES_128_CBC_SHA");
    map.insert(0x0035, "TLS_RSA_WITH_AES_256_CBC_SHA");
    map.insert(0x003c, "TLS_RSA_WITH_AES_128_CBC_SHA256");
    map.insert(0x003d, "TLS_RSA_WITH_AES_256_CBC_SHA256");

    // 3DES (Legacy)
    map.insert(0x000a, "TLS_RSA_WITH_3DES_EDE_CBC_SHA");
    map.insert(0x0016, "TLS_DHE_RSA_WITH_3DES_EDE_CBC_SHA");
    map.insert(0xc008, "TLS_ECDHE_ECDSA_WITH_3DES_EDE_CBC_SHA");
    map.insert(0xc012, "TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA");

    // RC4 (Deprecated but still seen)
    map.insert(0x0004, "TLS_RSA_WITH_RC4_128_MD5");
    map.insert(0x0005, "TLS_RSA_WITH_RC4_128_SHA");
    map.insert(0xc007, "TLS_ECDHE_ECDSA_WITH_RC4_128_SHA");
    map.insert(0xc011, "TLS_ECDHE_RSA_WITH_RC4_128_SHA");

    // PSK Cipher Suites (RFC 4279, RFC 5487)
    map.insert(0x008c, "TLS_PSK_WITH_AES_128_CBC_SHA");
    map.insert(0x008d, "TLS_PSK_WITH_AES_256_CBC_SHA");
    map.insert(0x00a8, "TLS_PSK_WITH_AES_128_GCM_SHA256");
    map.insert(0x00a9, "TLS_PSK_WITH_AES_256_GCM_SHA384");

    // ECDHE-PSK
    map.insert(0xc035, "TLS_ECDHE_PSK_WITH_AES_128_CBC_SHA");
    map.insert(0xc036, "TLS_ECDHE_PSK_WITH_AES_256_CBC_SHA");
    map.insert(0xc037, "TLS_ECDHE_PSK_WITH_AES_128_CBC_SHA256");
    map.insert(0xc038, "TLS_ECDHE_PSK_WITH_AES_256_CBC_SHA384");

    // ARIA Cipher Suites (RFC 6209)
    map.insert(0xc03c, "TLS_RSA_WITH_ARIA_128_CBC_SHA256");
    map.insert(0xc03d, "TLS_RSA_WITH_ARIA_256_CBC_SHA384");
    map.insert(0xc060, "TLS_ECDHE_RSA_WITH_ARIA_128_GCM_SHA256");
    map.insert(0xc061, "TLS_ECDHE_RSA_WITH_ARIA_256_GCM_SHA384");

    // Camellia Cipher Suites (RFC 6367)
    map.insert(0xc072, "TLS_ECDHE_ECDSA_WITH_CAMELLIA_128_CBC_SHA256");
    map.insert(0xc073, "TLS_ECDHE_ECDSA_WITH_CAMELLIA_256_CBC_SHA384");
    map.insert(0xc076, "TLS_ECDHE_RSA_WITH_CAMELLIA_128_CBC_SHA256");
    map.insert(0xc077, "TLS_ECDHE_RSA_WITH_CAMELLIA_256_CBC_SHA384");

    // NULL encryption (for testing/debugging)
    map.insert(0x0001, "TLS_RSA_WITH_NULL_MD5");
    map.insert(0x0002, "TLS_RSA_WITH_NULL_SHA");
    map.insert(0x003b, "TLS_RSA_WITH_NULL_SHA256");

    map
});

/// Get the human-readable name for a cipher suite code
pub(super) fn get_cipher_suite_name(code: u16) -> Option<&'static str> {
    CIPHER_SUITE_MAP.get(&code).copied()
}

/// Format a cipher suite code with its name if known, e.g.
/// "TLS_AES_128_GCM_SHA256 (0x1301)", or just "0x1234" when unknown
pub fn format_cipher_suite(code: u16) -> String {
    match get_cipher_suite_name(code) {
        Some(name) => format!("{} (0x{:04X})", name, code),
        None => format!("0x{:04X}", code),
    }
}

/// Check if a cipher suite is considered secure by modern standards
pub fn is_secure_cipher_suite(code: u16) -> bool {
    match code {
        // TLS 1.3 suites are all secure
        0x1301..=0x1305 => true,
        // Modern TLS 1.2 ECDHE suites with AEAD
        0xc02b | 0xc02c | 0xc02f | 0xc030 => true, // ECDHE + AES-GCM
        0xcca8..=0xccaa => true,                   // ChaCha20-Poly1305
        0x009e | 0x009f => true,                   // DHE-RSA with AES-GCM
        // Everything else is either legacy or insecure
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tls13_cipher_suites() {
        assert_eq!(
            get_cipher_suite_name(0x1301),
            Some("TLS_AES_128_GCM_SHA256")
        );
        assert_eq!(
            get_cipher_suite_name(0x1302),
            Some("TLS_AES_256_GCM_SHA384")
        );
        assert_eq!(
            get_cipher_suite_name(0x1303),
            Some("TLS_CHACHA20_POLY1305_SHA256")
        );
    }

    #[test]
    fn test_format_cipher_suite() {
        assert_eq!(
            format_cipher_suite(0x1301),
            "TLS_AES_128_GCM_SHA256 (0x1301)"
        );
        assert_eq!(format_cipher_suite(0x9999), "0x9999");
    }

    #[test]
    fn test_security_classification() {
        assert!(is_secure_cipher_suite(0x1301)); // TLS 1.3
        assert!(is_secure_cipher_suite(0xc02f)); // ECDHE-RSA-AES128-GCM-SHA256
        assert!(!is_secure_cipher_suite(0x0004)); // RC4
        assert!(!is_secure_cipher_suite(0x000a)); // 3DES
    }

    #[test]
    fn test_unknown_cipher_suite() {
        assert_eq!(get_cipher_suite_name(0xFFFF), None);
        assert_eq!(format_cipher_suite(0xFFFF), "0xFFFF");
    }

    #[test]
    fn test_aria_camellia_iana_names() {
        // 0xC03C/0xC03D are RSA + CBC per IANA / RFC 6209; the
        // ECDHE_ECDSA ARIA GCM suites live at 0xC05C/0xC05D.
        assert_eq!(
            get_cipher_suite_name(0xc03c),
            Some("TLS_RSA_WITH_ARIA_128_CBC_SHA256")
        );
        assert_eq!(
            get_cipher_suite_name(0xc03d),
            Some("TLS_RSA_WITH_ARIA_256_CBC_SHA384")
        );
        // 0xC060/0xC061 are ECDHE_RSA ARIA GCM.
        assert_eq!(
            get_cipher_suite_name(0xc060),
            Some("TLS_ECDHE_RSA_WITH_ARIA_128_GCM_SHA256")
        );
        // 0xC072-0xC077 are CBC per IANA / RFC 6367; the matching
        // Camellia GCM suites live at 0xC086/0xC087/0xC08A/0xC08B.
        assert_eq!(
            get_cipher_suite_name(0xc072),
            Some("TLS_ECDHE_ECDSA_WITH_CAMELLIA_128_CBC_SHA256")
        );
        assert_eq!(
            get_cipher_suite_name(0xc073),
            Some("TLS_ECDHE_ECDSA_WITH_CAMELLIA_256_CBC_SHA384")
        );
        assert_eq!(
            get_cipher_suite_name(0xc076),
            Some("TLS_ECDHE_RSA_WITH_CAMELLIA_128_CBC_SHA256")
        );
        assert_eq!(
            get_cipher_suite_name(0xc077),
            Some("TLS_ECDHE_RSA_WITH_CAMELLIA_256_CBC_SHA384")
        );
    }
}

```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/dhcp.rs`
```
//! DHCP (Dynamic Host Configuration Protocol) Deep Packet Inspection
//!
//! Parses DHCP packets according to RFC 2131.
//! DHCP uses UDP ports 67 (server) and 68 (client).

use crate::network::types::{DhcpInfo, DhcpMessageType};

/// Minimum DHCP packet size (fixed header + magic cookie)
const MIN_DHCP_SIZE: usize = 240;

/// DHCP magic cookie: 99.130.83.99 (0x63825363)
const DHCP_MAGIC_COOKIE: [u8; 4] = [0x63, 0x82, 0x53, 0x63];

/// DHCP option codes
const DHCP_OPT_HOSTNAME: u8 = 12;
const DHCP_OPT_MESSAGE_TYPE: u8 = 53;
const DHCP_OPT_END: u8 = 255;

/// Analyze a DHCP packet and extract key information.
///
/// Returns `None` if the packet is too small or doesn't have the DHCP magic cookie.
pub(super) fn analyze_dhcp(payload: &[u8]) -> Option<DhcpInfo> {
    if payload.len() < MIN_DHCP_SIZE {
        return None;
    }

    // Verify DHCP magic cookie at offset 236-239
    if payload[236..240] != DHCP_MAGIC_COOKIE {
        return None;
    }

    // Extract client MAC address from bytes 28-33 (chaddr field, first 6 bytes)
    let client_mac = crate::network::oui::format_mac(&payload[28..34]);

    // Parse DHCP options starting at byte 240
    let (message_type, hostname) = parse_dhcp_options(&payload[240..])?;

    Some(DhcpInfo {
        message_type,
        hostname,
        client_mac: Some(client_mac),
    })
}

/// Parse DHCP options and extract message type and hostname
fn parse_dhcp_options(options: &[u8]) -> Option<(DhcpMessageType, Option<String>)> {
    let mut message_type = None;
    let mut hostname = None;
    let mut offset = 0;

    while offset < options.len() {
        let opt_code = options[offset];

        // Option 255 = End
        if opt_code == DHCP_OPT_END {
            break;
        }

        // Option 0 = Pad (no length)
        if opt_code == 0 {
            offset += 1;
            continue;
        }

        // Need at least 1 more byte for length
        if offset + 1 >= options.len() {
            break;
        }

        let opt_len = options[offset + 1] as usize;

        // Bounds check for option data
        if offset + 2 + opt_len > options.len() {
            break;
        }

        let opt_data = &options[offset + 2..offset + 2 + opt_len];

        match opt_code {
            DHCP_OPT_MESSAGE_TYPE if opt_len >= 1 => {
                message_type = Some(parse_message_type(opt_data[0]));
            }
            DHCP_OPT_HOSTNAME => {
                if let Ok(name) = std::str::from_utf8(opt_data) {
                    hostname = Some(name.to_string());
                }
            }
            _ => {}
        }

        offset += 2 + opt_len;
    }

    // Message type is required
    Some((message_type?, hostname))
}

/// Parse DHCP message type from option 53 value
fn parse_message_type(value: u8) -> DhcpMessageType {
    match value {
        1 => DhcpMessageType::Discover,
        2 => DhcpMessageType::Offer,
        3 => DhcpMessageType::Request,
        4 => DhcpMessageType::Decline,
        5 => DhcpMessageType::Ack,
        6 => DhcpMessageType::Nak,
        7 => DhcpMessageType::Release,
        8 => DhcpMessageType::Inform,
        other => DhcpMessageType::Unknown(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_dhcp_packet(msg_type: u8, hostname: Option<&str>, mac: &[u8; 6]) -> Vec<u8> {
        let mut packet = vec![0u8; 240];

        packet[28..34].copy_from_slice(mac);

        packet[236..240].copy_from_slice(&DHCP_MAGIC_COOKIE);

        // Option 53: DHCP Message Type
        packet.push(DHCP_OPT_MESSAGE_TYPE);
        packet.push(1); // length
        packet.push(msg_type);

        // Option 12: Hostname (if provided)
        if let Some(name) = hostname {
            packet.push(DHCP_OPT_HOSTNAME);
            packet.push(name.len() as u8);
            packet.extend_from_slice(name.as_bytes());
        }

        // Option 255: End
        packet.push(DHCP_OPT_END);

        packet
    }

    #[test]
    fn test_dhcp_discover() {
        let mac = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
        let packet = build_dhcp_packet(1, Some("myhost"), &mac);
        let info = analyze_dhcp(&packet).expect("should parse");
        assert_eq!(info.message_type, DhcpMessageType::Discover);
        assert_eq!(info.hostname, Some("myhost".to_string()));
        assert_eq!(info.client_mac, Some("aa:bb:cc:dd:ee:ff".to_string()));
    }

    #[test]
    fn test_dhcp_offer() {
        let mac = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
        let packet = build_dhcp_packet(2, None, &mac);
        let info = analyze_dhcp(&packet).expect("should parse");
        assert_eq!(info.message_type, DhcpMessageType::Offer);
        assert!(info.hostname.is_none());
    }

    #[test]
    fn test_dhcp_request() {
        let mac = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
        let packet = build_dhcp_packet(3, Some("workstation-01"), &mac);
        let info = analyze_dhcp(&packet).expect("should parse");
        assert_eq!(info.message_type, DhcpMessageType::Request);
        assert_eq!(info.hostname, Some("workstation-01".to_string()));
    }

    #[test]
    fn test_dhcp_ack() {
        let mac = [0x00, 0x00, 0x00, 0x00, 0x00, 0x01];
        let packet = build_dhcp_packet(5, None, &mac);
        let info = analyze_dhcp(&packet).expect("should parse");
        assert_eq!(info.message_type, DhcpMessageType::Ack);
    }

    #[test]
    fn test_dhcp_too_short() {
        let packet = vec![0u8; 100];
        assert!(analyze_dhcp(&packet).is_none());
    }

    #[test]
    fn test_dhcp_bad_magic_cookie() {
        let mut packet = vec![0u8; 250];
        packet[236..240].copy_from_slice(&[0x00, 0x00, 0x00, 0x00]); // Wrong cookie
        assert!(analyze_dhcp(&packet).is_none());
    }

    #[test]
    fn test_dhcp_release() {
        let mac = [0xde, 0xad, 0xbe, 0xef, 0x00, 0x01];
        let packet = build_dhcp_packet(7, None, &mac);
        let info = analyze_dhcp(&packet).expect("should parse");
        assert_eq!(info.message_type, DhcpMessageType::Release);
    }

    #[test]
    fn test_dhcp_inform() {
        let mac = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc];
        let packet = build_dhcp_packet(8, Some("printer"), &mac);
        let info = analyze_dhcp(&packet).expect("should parse");
        assert_eq!(info.message_type, DhcpMessageType::Inform);
        assert_eq!(info.hostname, Some("printer".to_string()));
    }
}

```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/dns.rs`
```
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::ops::Range;

use crate::network::types::{DnsInfo, DnsQueryType};

/// Maximum DNS name length per RFC 1035 section 2.3.4
const MAX_DNS_NAME_LEN: usize = 253;

/// Cap on how many answer records we will walk for a single packet. Real
/// resolver answers are well under this; the bound is here to keep a
/// malformed `ancount` from spinning the parser.
const MAX_ANSWERS_TO_PARSE: usize = 64;

/// Cap on response IPs we surface per packet. The UI only renders a short
/// list anyway, and the merge layer dedups across the flow, so anything
/// beyond this is noise we'd rather drop than allocate for.
const MAX_RESPONSE_IPS_PER_PACKET: usize = 16;

/// Cap on how many pointer indirections we follow while skipping a name in
/// the answer section. Per RFC 1035 these must not form cycles; this cap
/// keeps a crafted packet from looping forever.
const MAX_NAME_POINTER_HOPS: usize = 16;

/// Walk a DNS name in the answer section and return the offset of the
/// byte immediately after the name (where TYPE / CLASS / TTL / RDLENGTH
/// start). Compression pointers (0xC0-prefixed two-byte sequences) terminate
/// the name in-place, so the returned offset is two past the start of the
/// pointer. Returns `None` if the name is malformed or runs off the end of
/// the payload.
fn skip_dns_name(payload: &[u8], start: usize) -> Option<usize> {
    let mut offset = start;
    let mut hops = 0;
    loop {
        if offset >= payload.len() {
            return None;
        }
        let label_len = payload[offset] as usize;
        if label_len == 0 {
            return Some(offset + 1);
        }
        if label_len & 0xC0 == 0xC0 {
            // Pointer: two bytes total, name ends here at the call site.
            if offset + 1 >= payload.len() {
                return None;
            }
            hops += 1;
            if hops > MAX_NAME_POINTER_HOPS {
                return None;
            }
            return Some(offset + 2);
        }
        // Reject reserved length-octet top bits (0x40 / 0x80), neither
        // standard label nor pointer.
        if label_len & 0xC0 != 0 {
            return None;
        }
        let next = offset.checked_add(1)?.checked_add(label_len)?;
        if next > payload.len() {
            return None;
        }
        offset = next;
    }
}

/// Parse a single question section and return `(query_name, query_type,
/// offset_after_question)`. The offset advances past QNAME + QTYPE (2) +
/// QCLASS (2); if QTYPE / QCLASS run off the end the offset still moves to
/// keep skip-only callers (qdcount > 1) bounds-safe.
fn parse_question(payload: &[u8], start: usize) -> (Option<String>, Option<DnsQueryType>, usize) {
    let mut offset = start;
    let mut name = String::new();
    let mut name_over_limit = false;

    // Parse domain name (label-by-label, with light pointer handling; we
    // only need to terminate the walk, not fully resolve compressed labels).
    while offset < payload.len() {
        let label_len = payload[offset] as usize;
        if label_len == 0 {
            offset += 1;
            break;
        }

        if label_len & 0xC0 == 0xC0 {
            // Compressed name: skip for simplicity.
            offset += 2;
            break;
        }

        // Reject reserved length-octet top bits (0x40 / 0x80), neither a
        // standard label nor a pointer (RFC 1035 §3.3). Stop the walk so the
        // invalid bytes are not pulled into the name, matching skip_dns_name.
        if label_len & 0xC0 != 0 {
            break;
        }

        if offset + 1 + label_len > payload.len() {
            break;
        }

        if !name_over_limit {
            if !name.is_empty() {
                name.push('.');
            }

            if let Ok(label) = std::str::from_utf8(&payload[offset + 1..offset + 1 + label_len]) {
                name.push_str(label);
            }

            // Enforce RFC 1035 maximum name length: stop accumulating, but
            // keep walking the remaining labels so `offset` ends up past the
            // whole QNAME; otherwise QTYPE/QCLASS would be read from name
            // bytes and report a fabricated query type.
            if name.len() > MAX_DNS_NAME_LEN {
                name_over_limit = true;
            }
        }

        offset += 1 + label_len;
    }

    let query_name = if name.is_empty() { None } else { Some(name) };

    let mut query_type = None;
    if offset + 2 <= payload.len() {
        let qtype = u16::from_be_bytes([payload[offset], payload[offset + 1]]);
        query_type = Some(DnsQueryType::from_wire(qtype));
    }
    // Advance past QTYPE (2) and QCLASS (2). If they run past the payload,
    // downstream walks' bounds checks will short-circuit cleanly.
    offset = offset.saturating_add(4);

    (query_name, query_type, offset)
}

/// Walk `count` resource records starting at `offset`, pushing A / AAAA
/// rdata into `ips` (subject to [`MAX_RESPONSE_IPS_PER_PACKET`]) and counting
/// records whose TYPE matches `queried_type` into `matched` (for NODATA
/// detection; pass `None` to skip counting, e.g. on the mDNS additional-records
/// walk where the concept does not apply). Returns the offset of the byte
/// immediately after the last record successfully walked (so callers can
/// chain a second walk, e.g. ANCOUNT then ARCOUNT for mDNS) together with
/// the number of records fully walked (so callers can tell a complete walk
/// from one that bailed on a malformed or truncated record).
fn walk_a_aaaa_records(
    payload: &[u8],
    start: usize,
    count: usize,
    ips: &mut Vec<IpAddr>,
    queried_type: Option<DnsQueryType>,
    matched: &mut usize,
) -> (usize, usize) {
    let mut offset = start;
    let mut walked = 0;
    let count = count.min(MAX_ANSWERS_TO_PARSE);
    for _ in 0..count {
        let Some(rr) = parse_rr_header(payload, offset) else {
            return (offset, walked);
        };

        if queried_type.is_some() && queried_type == Some(DnsQueryType::from_wire(rr.rtype)) {
            *matched += 1;
        }

        if ips.len() < MAX_RESPONSE_IPS_PER_PACKET {
            match (rr.rtype, rr.rdata.len()) {
                (1, 4) => {
                    let octets: [u8; 4] = payload[rr.rdata.clone()]
                        .try_into()
                        .expect("rdlength==4 and bounds checked above");
                    ips.push(IpAddr::V4(Ipv4Addr::from(octets)));
                }
                (28, 16) => {
                    let octets: [u8; 16] = payload[rr.rdata.clone()]
                        .try_into()
                        .expect("rdlength==16 and bounds checked above");
                    ips.push(IpAddr::V6(Ipv6Addr::from(octets)));
                }
                _ => {
                    // CNAME, NS, SOA, PTR, SRV, TXT, etc. are not surfaced.
                }
            }
        }

        offset = rr.rdata.end;
        walked += 1;
    }
    (offset, walked)
}

/// Fixed fields of a resource record parsed by [`parse_rr_header`].
struct RrHeader {
    /// TYPE (A = 1, AAAA = 28, SOA = 6, ...)
    rtype: u16,
    /// Byte range of RDATA within the payload; `rdata.end` is where the next
    /// record starts.
    rdata: Range<usize>,
}

/// Skip the owner name at `offset` and read the fixed-size RR fields:
/// TYPE (2) + CLASS (2) + TTL (4) + RDLENGTH (2) = 10 bytes, bounding RDATA
/// by RDLENGTH. Returns `None` if the name is malformed or the header or
/// rdata run off the end of the payload.
fn parse_rr_header(payload: &[u8], offset: usize) -> Option<RrHeader> {
    let after_name = skip_dns_name(payload, offset)?;
    if after_name.checked_add(10)? > payload.len() {
        return None;
    }
    let rtype = u16::from_be_bytes([payload[after_name], payload[after_name + 1]]);
    let rdlength = u16::from_be_bytes([payload[after_name + 8], payload[after_name + 9]]) as usize;
    let rdata_start = after_name + 10;
    let rdata_end = rdata_start.checked_add(rdlength)?;
    if rdata_end > payload.len() {
        return None;
    }
    Some(RrHeader {
        rtype,
        rdata: rdata_start..rdata_end,
    })
}

/// RFC 2308 §2.2: a NODATA response carries an SOA record in the authority
/// section (types 1 and 2) or an empty authority section (type 3). NS
/// records without an SOA are a referral instead, which says nothing about
/// whether the queried type exists at the name. Returns true only when the
/// authority section parses completely and has a NODATA shape.
fn authority_marks_nodata(payload: &[u8], start: usize, count: usize) -> bool {
    if count == 0 {
        return true;
    }
    if count > MAX_ANSWERS_TO_PARSE {
        return false;
    }
    let mut offset = start;
    let mut has_soa = false;
    for _ in 0..count {
        let Some(rr) = parse_rr_header(payload, offset) else {
            return false;
        };
        if rr.rtype == 6 {
            has_soa = true;
        }
        offset = rr.rdata.end;
    }
    has_soa
}

/// Parsed DNS-shaped header counts. Surfaced as a thin internal helper so
/// the mDNS / LLMNR wrappers can also reach ARCOUNT without re-decoding.
pub(super) struct DnsHeaderCounts {
    pub is_response: bool,
    /// TC bit: the response was cut to fit the transport, so section counts
    /// may promise records the payload does not carry.
    pub truncated: bool,
    pub qdcount: u16,
    pub ancount: u16,
    pub nscount: u16,
    pub arcount: u16,
    pub txid: u16,
    pub rcode: u8,
}

/// Decode the four 16-bit counts at the start of a DNS-shaped header.
pub(super) fn dns_header_counts(payload: &[u8]) -> Option<DnsHeaderCounts> {
    if payload.len() < 12 {
        return None;
    }
    let flags = u16::from_be_bytes([payload[2], payload[3]]);
    Some(DnsHeaderCounts {
        is_response: (flags & 0x8000) != 0,
        truncated: (flags & 0x0200) != 0,
        qdcount: u16::from_be_bytes([payload[4], payload[5]]),
```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/ftp.rs`
```
//! FTP (File Transfer Protocol) Deep Packet Inspection
//!
//! Parses the plaintext FTP control channel (RFC 959, RFC 2389, RFC 2428).
//! Detection is keyed off port 21 plus a cheap start-line signature so non-
//! standard ports are still caught. The data channel (port 20 / passive) is
//! deliberately not inspected: payloads are arbitrary file bytes.

use crate::network::types::{FtpInfo, FtpMessageType};

/// Maximum bytes we ever scan to decide whether a payload looks like FTP.
const MAX_SNIFF_BYTES: usize = 1024;

/// Commands defined by RFC 959 / 2389 / 2428 / 4217. Matched case-insensitively
/// against the first whitespace-delimited token on the first line of the
/// payload.
const FTP_COMMANDS: &[&str] = &[
    // RFC 959 access control
    "USER", "PASS", "ACCT", "CWD", "CDUP", "SMNT", "QUIT", "REIN",
    // RFC 959 transfer parameters
    "PORT", "PASV", "TYPE", "STRU", "MODE", // RFC 959 service
    "RETR", "STOR", "STOU", "APPE", "ALLO", "REST", "RNFR", "RNTO", "ABOR", "DELE", "RMD", "MKD",
    "PWD", "LIST", "NLST", "SITE", "SYST", "STAT", "HELP", "NOOP",
    // RFC 2389 (FEAT/OPTS)
    "FEAT", "OPTS", // RFC 2428 (extended passive / port for IPv6)
    "EPSV", "EPRT", // RFC 4217 (FTP over TLS)
    "AUTH", "PBSZ", "PROT", "CCC", // RFC 3659 (size/mdtm/mlsd)
    "SIZE", "MDTM", "MLSD", "MLST",
];

/// Commands accepted by the port-independent signature check. This is the
/// subset of [`FTP_COMMANDS`] that no other common line-based protocol
/// shares: SMTP claims `AUTH`/`QUIT`/`NOOP`/`HELP`, POP3 claims
/// `USER`/`PASS`/`STAT`/`LIST`/`RETR`/`DELE`, and NNTP claims `MODE`, so
/// matching those off port 21 would label mail and news flows as FTP.
const FTP_DISTINCTIVE_COMMANDS: &[&str] = &[
    "ACCT", "CWD", "CDUP", "SMNT", "REIN", "PORT", "PASV", "TYPE", "STRU", "STOR", "STOU", "APPE",
    "ALLO", "REST", "RNFR", "RNTO", "ABOR", "RMD", "MKD", "PWD", "NLST", "SITE", "SYST", "FEAT",
    "OPTS", "EPSV", "EPRT", "PBSZ", "PROT", "CCC", "SIZE", "MDTM", "MLSD", "MLST",
];

/// Cheap heuristic that returns `true` when a payload's first line plausibly
/// belongs to the FTP control channel. Used so non-standard-port flows can
/// still be classified.
///
/// Only distinctively-FTP commands count as a signature. Server replies
/// (`220 <banner>`) are deliberately NOT matched here: the 3-digit reply
/// grammar is shared verbatim by SMTP, POP3-era protocols, and NNTP, so
/// off port 21 a reply line carries no FTP signal. Replies are still parsed
/// by [`analyze_ftp`] on the port-21 path.
pub(super) fn is_ftp(payload: &[u8]) -> bool {
    let line = first_line(payload);
    if line.is_empty() {
        return false;
    }
    let upper = first_token_upper(line);
    if upper.is_empty() {
        return false;
    }
    FTP_DISTINCTIVE_COMMANDS
        .iter()
        .any(|cmd| cmd.as_bytes() == upper)
}

/// Parse an FTP control-channel payload. Returns `None` when the payload does
/// not look like FTP.
pub(super) fn analyze_ftp(payload: &[u8]) -> Option<FtpInfo> {
    let line = first_line(payload);
    if line.is_empty() {
        return None;
    }

    // Server response branch: `CCC <text>` or `CCC-<text>` where CCC is a
    // 3-digit reply code. A trailing `-` is the RFC 959 §4.2 continuation
    // marker, signalling that the payload is multi-line.
    if line.len() >= 4
        && line[0].is_ascii_digit()
        && line[1].is_ascii_digit()
        && line[2].is_ascii_digit()
        && (line[3] == b' ' || line[3] == b'-')
    {
        let code = std::str::from_utf8(&line[0..3]).ok()?.parse::<u16>().ok()?;
        // RFC 959 §4.2: the first digit is 1-5 and the second 0-5. Anything
        // else ("999 hi") is not an FTP reply.
        if !(1..=5).contains(&(code / 100)) || (code / 10) % 10 > 5 {
            return None;
        }
        let is_continuation = line[3] == b'-';
        let message = std::str::from_utf8(&line[4..])
            .ok()
            .map(|s| s.trim().to_string());

        // Software / system-type extraction is skipped on continuation lines
        // (`220-Welcome to the FTP service.\r\n220 ProFTPD ...\r\n`) because
        // the first line is human-greeting prose. vsftpd, ProFTPD, and
        // Pure-FTPd all emit multi-line greetings by default, so honouring
        // the continuation marker is critical; without it we tag
        // `server_software = "Welcome"` on most real servers.
        let server_software = if code == 220 && !is_continuation {
            // RFC 959 §5.4: service-ready greetings typically embed the
            // FTP server software in the first whitespace-delimited token
            // (`220 ProFTPD 1.3.7 ...`).
            message.as_deref().map(extract_software_token)
        } else {
            None
        };
        // RFC 959 §4.2: code 215 carries the system / OS name (`UNIX`,
        // `Windows_NT`), NOT the FTP server software. Keeping the two
        // separate avoids labelling "UNIX" under "Server Software" in the
        // TUI.
        let system_type = if code == 215 && !is_continuation {
            message.as_deref().map(extract_software_token)
        } else {
            None
        };
        return Some(FtpInfo {
            message_type: FtpMessageType::Response,
            command: None,
            args: None,
            response_code: Some(code),
            response_message: message,
            username: None,
            server_software,
            system_type,
        });
    }

    // Client request branch.
    let upper = first_token_upper(line);
    if upper.is_empty() {
        return None;
    }
    let is_command = FTP_COMMANDS.iter().any(|cmd| cmd.as_bytes() == upper);
    if !is_command {
        return None;
    }
    // `first_token_upper` already proved every byte is ASCII alphabetic, so
    // `String::from_utf8` always succeeds; the `?` stays as a defensive guard
    // against a future change that widens the accepted byte range.
    let command = String::from_utf8(upper).ok()?;
    // Trim leading command + whitespace to expose the argument.
    let args = std::str::from_utf8(line)
        .ok()
        .map(|s| s.trim())
        .and_then(|s| {
            s.split_once(char::is_whitespace)
                .map(|(_, rest)| rest.trim())
        })
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    // RFC 959 §5.4: `USER` carries the login name, useful as a per-flow
    // identity hint (plaintext anyway; FTP-AUTH/TLS encrypts later).
    let username = if command == "USER" {
        args.clone()
    } else {
        None
    };

    Some(FtpInfo {
        message_type: FtpMessageType::Request,
        command: Some(command),
        args,
        response_code: None,
        response_message: None,
        username,
        server_software: None,
        system_type: None,
    })
}

fn first_line(payload: &[u8]) -> &[u8] {
    let sniff = &payload[..payload.len().min(MAX_SNIFF_BYTES)];
    match sniff.iter().position(|&b| b == b'\n') {
        Some(end) => {
            // Strip trailing CR if present.
            if end > 0 && sniff[end - 1] == b'\r' {
                &sniff[..end - 1]
            } else {
                &sniff[..end]
            }
        }
        None => sniff,
    }
}

fn first_token_upper(line: &[u8]) -> Vec<u8> {
    let token_end = line
        .iter()
        .position(|&b| b == b' ' || b == b'\t' || b == b'\r')
        .unwrap_or(line.len());
    let token = &line[..token_end];
    if token.is_empty() || token.len() > 6 {
        // FTP commands are 3-4 letters; cap at 6 to keep the cost of
        // upper-casing tight on hostile traffic.
        return Vec::new();
    }
    if !token.iter().all(|b| b.is_ascii_alphabetic()) {
        return Vec::new();
    }
    token.iter().map(|b| b.to_ascii_uppercase()).collect()
}

fn extract_software_token(message: &str) -> String {
    // The greeting line is free-form. Heuristic: take the first whitespace-
    // delimited token that contains a letter, strip surrounding punctuation.
    // Falls back to the full message when no clean token is found.
    for token in message.split_whitespace() {
        let trimmed = token.trim_matches(|c: char| !c.is_ascii_alphanumeric());
        if trimmed.chars().any(|c| c.is_ascii_alphabetic()) {
            return trimmed.to_string();
        }
    }
    message.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_server_greeting() {
        // Replies are parsed on the port-21 path but are NOT a signature:
        // the 3-digit grammar is shared with SMTP/POP3/NNTP.
        let payload = b"220 ProFTPD 1.3.7 Server (Example) [::ffff:10.0.0.1]\r\n";
        assert!(!is_ftp(payload));
        let info = analyze_ftp(payload).expect("should parse");
        assert!(matches!(info.message_type, FtpMessageType::Response));
        assert_eq!(info.response_code, Some(220));
        assert_eq!(info.server_software.as_deref(), Some("ProFTPD"));
    }

    #[test]
    fn detects_continuation_response() {
        let payload = b"220-Welcome to the FTP service.\r\n220 Ready.\r\n";
        assert!(!is_ftp(payload));
        let info = analyze_ftp(payload).expect("should parse");
        assert_eq!(info.response_code, Some(220));
    }

    #[test]
    fn signature_ignores_verbs_shared_with_mail_protocols() {
        // SMTP traffic must not be classified as FTP off port 21.
        assert!(!is_ftp(b"220 smtp.gmail.com ESMTP x1234\r\n"));
        assert!(!is_ftp(b"EHLO mail.example.com\r\n"));
        assert!(!is_ftp(b"AUTH LOGIN\r\n"));
        // POP3 shares USER/PASS/RETR/LIST/DELE with FTP.
        assert!(!is_ftp(b"USER alice\r\n"));
        assert!(!is_ftp(b"RETR 1\r\n"));
        // Distinctively-FTP commands still trigger the signature.
        assert!(is_ftp(b"PASV\r\n"));
        assert!(is_ftp(b"TYPE I\r\n"));
        assert!(is_ftp(b"cwd /pub\r\n"));
    }

    #[test]
    fn rejects_out_of_range_reply_codes() {
        // RFC 
```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/http.rs`
```
use crate::network::types::{HttpInfo, HttpVersion};

/// Analyze payload for HTTP protocol
pub(super) fn analyze_http(payload: &[u8]) -> Option<HttpInfo> {
    if !is_likely_http(payload) {
        return None;
    }

    let mut info = HttpInfo {
        version: HttpVersion::Http11,
        method: None,
        host: None,
        path: None,
        status_code: None,
        user_agent: None,
    };

    let text = String::from_utf8_lossy(payload);
    let mut lines = text.lines();
    let first_line = lines.next()?;
    // Requests have exactly 3 SP-delimited tokens; responses have 2 or 3
    // since the reason phrase is optional (RFC 9112 §4).
    let mut tokens = first_line.split_whitespace();
    let (tok0, tok1) = match (tokens.next(), tokens.next()) {
        (Some(a), Some(b)) => (a, b),
        _ => return None,
    };

    if first_line.starts_with("HTTP/") {
        // Response line: HTTP/1.1 200 OK. The reason phrase may be empty,
        // but the status code must be a 3-digit number.
        info.version = parse_http_version(tok0)?;
        info.status_code = Some(
            tok1.parse::<u16>()
                .ok()
                .filter(|c| (100..=599).contains(c))?,
        );
    } else if is_http_method(tok0) {
        // Request line: GET /path HTTP/1.1. The version token is required:
        // SIP and RTSP share the same verbs ("OPTIONS sip:bob@example.com
        // SIP/2.0"), so a method match alone is not HTTP.
        info.version = parse_http_version(tokens.next()?)?;
        info.method = Some(tok0.to_string());
        info.path = Some(tok1.to_string());
    } else {
        return None; // Not valid HTTP
    }

    // Parse headers. HTTP field-names are case-insensitive (RFC 7230 §3.2),
    // so compare with `eq_ignore_ascii_case` rather than lowercasing.
    for line in lines {
        if line.is_empty() {
            break; // End of headers
        }

        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            let value = value.trim();

            if key.eq_ignore_ascii_case("host") {
                info.host = Some(value.to_string());
            } else if key.eq_ignore_ascii_case("user-agent") {
                info.user_agent = Some(value.to_string());
            }
        }
    }

    Some(info)
}

/// Quick check if payload might be HTTP
fn is_likely_http(payload: &[u8]) -> bool {
    if payload.len() < 4 {
        return false;
    }

    // HTTP request methods
    payload.starts_with(b"GET ") ||
    payload.starts_with(b"POST ") ||
    payload.starts_with(b"PUT ") ||
    payload.starts_with(b"DELETE ") ||
    payload.starts_with(b"HEAD ") ||
    payload.starts_with(b"OPTIONS ") ||
    payload.starts_with(b"CONNECT ") ||
    payload.starts_with(b"TRACE ") ||
    payload.starts_with(b"PATCH ") ||
    // HTTP responses
    payload.starts_with(b"HTTP/1.0 ") ||
    payload.starts_with(b"HTTP/1.1 ") ||
    payload.starts_with(b"HTTP/2 ")
}

fn is_http_method(s: &str) -> bool {
    matches!(
        s,
        "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE" | "PATCH"
    )
}

fn parse_http_version(s: &str) -> Option<HttpVersion> {
    match s {
        "HTTP/1.0" => Some(HttpVersion::Http10),
        "HTTP/1.1" => Some(HttpVersion::Http11),
        "HTTP/2" => Some(HttpVersion::Http2),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_http_request() {
        let payload = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\n\r\n";
        let info = analyze_http(payload).unwrap();

        assert_eq!(info.method.as_deref(), Some("GET"));
        assert_eq!(info.path.as_deref(), Some("/index.html"));
        assert_eq!(info.host.as_deref(), Some("example.com"));
    }

    #[test]
    fn test_http_response() {
        let payload = b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n";
        let info = analyze_http(payload).unwrap();

        assert_eq!(info.status_code, Some(200));
        assert!(info.method.is_none());
    }

    #[test]
    fn test_http_start_line_token_extraction() {
        // All three tokens from a well-formed request line must be parsed.
        let req = b"POST /api/v1/upload HTTP/1.1\r\nHost: api.example.com\r\n\r\n";
        let info = analyze_http(req).expect("POST request should parse");
        assert_eq!(info.method.as_deref(), Some("POST"));
        assert_eq!(info.path.as_deref(), Some("/api/v1/upload"));
        assert_eq!(info.host.as_deref(), Some("api.example.com"));

        // A truncated request line must be rejected: requests need all
        // three tokens (method, target, version).
        let truncated: [&[u8]; 2] = [
            b"GET /index.html\r\n\r\n", // only 2 tokens
            b"GET\r\n\r\n",             // only 1 token
        ];
        for payload in &truncated {
            assert!(
                analyze_http(payload).is_none(),
                "truncated start line should not parse: {:?}",
                std::str::from_utf8(payload).unwrap_or("<invalid utf8>")
            );
        }
    }

    #[test]
    fn test_http_response_without_reason_phrase() {
        // RFC 9112 §4: the reason phrase is optional. Real servers emit
        // `HTTP/1.1 200 \r\n` (empty phrase) and some omit the trailing
        // space entirely; both are valid responses.
        for payload in [b"HTTP/1.1 200\r\n\r\n".as_slice(), b"HTTP/1.1 200 \r\n\r\n"] {
            let info = analyze_http(payload).expect("reason phrase is optional");
            assert_eq!(info.status_code, Some(200));
        }
    }

    #[test]
    fn test_non_http_text_protocols_rejected() {
        // SIP and RTSP share request verbs with HTTP; the version token
        // must be validated so they are not misclassified.
        let sip = b"OPTIONS sip:bob@example.com SIP/2.0\r\nVia: SIP/2.0/TCP host\r\n\r\n";
        assert!(analyze_http(sip).is_none());

        let rtsp = b"OPTIONS rtsp://cam.local/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n";
        assert!(analyze_http(rtsp).is_none());

        // A response-shaped line with a non-numeric status is not HTTP.
        assert!(analyze_http(b"HTTP/1.1 OK 200\r\n\r\n").is_none());
    }

    #[test]
    fn test_http_mixed_case_host_and_user_agent_headers() {
        // HTTP/1.1 §3.2 makes field-names case-insensitive.
        let host_variants: [&[u8]; 4] = [
            b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n",
            b"GET / HTTP/1.1\r\nhost: example.com\r\n\r\n",
            b"GET / HTTP/1.1\r\nHOST: example.com\r\n\r\n",
            b"GET / HTTP/1.1\r\nhOsT: example.com\r\n\r\n",
        ];
        for payload in &host_variants {
            let info = analyze_http(payload).expect("should parse");
            assert_eq!(info.host.as_deref(), Some("example.com"));
        }

        let ua_variants: [&[u8]; 4] = [
            b"GET / HTTP/1.1\r\nUser-Agent: curl/8.5\r\n\r\n",
            b"GET / HTTP/1.1\r\nuser-agent: curl/8.5\r\n\r\n",
            b"GET / HTTP/1.1\r\nUSER-AGENT: curl/8.5\r\n\r\n",
            b"GET / HTTP/1.1\r\nUser-AGENT: curl/8.5\r\n\r\n",
        ];
        for payload in &ua_variants {
            let info = analyze_http(payload).expect("should parse");
            assert_eq!(info.user_agent.as_deref(), Some("curl/8.5"));
        }
    }
}

```

### Core Architecture Module: `crates/rustnet-core/src/network/dpi/https.rs`
```
use super::tls_common::{self, TlsParseOptions};
use crate::network::types::{HttpsInfo, TlsInfo};
use log::debug;

pub(super) fn is_tls_handshake(payload: &[u8]) -> bool {
    if payload.len() < 5 {
        return false;
    }

    // TLS record header:
    // - Content type (1 byte): 0x16 for handshake
    // - Version (2 bytes): 0x0301-0x0304 for TLS 1.0-1.3
    // - Length (2 bytes)
    payload[0] == 0x16 && // Handshake content type
        payload[1] == 0x03 && // Major version 3
        (payload[2] >= 0x01 && payload[2] <= 0x04) // Minor version 1-4
}

pub(super) fn analyze_https(payload: &[u8]) -> Option<HttpsInfo> {
    // Need at least 5 bytes for the TLS record header
    if payload.len() < 5 {
        return None;
    }

    let mut info = TlsInfo::new();

    // Record layer version (kept even for non-handshake records)
    info.version = tls_common::version_from_bytes(payload[1], payload[2]);

    if payload[0] != 0x16 {
        // Not a handshake record - still extract version
        return Some(HttpsInfo {
            tls_info: Some(info),
        });
    }

    let record_length = u16::from_be_bytes([payload[3], payload[4]]) as usize;

    if record_length > 16384 + 2048 {
        return Some(HttpsInfo {
            tls_info: Some(info),
        });
    }

    // Calculate available data (handle fragmentation gracefully) and hand
    // the handshake bytes to the shared parser. A handshake larger than one
    // record is parsed from the prefix we have.
    let available_data = (payload.len() - 5).min(record_length);
    tls_common::parse_handshake(
        &payload[5..5 + available_data],
        &mut info,
        TlsParseOptions::tcp(),
    );

    if info.sni.is_some() || !info.alpn.is_empty() {
        debug!("TLS: Found SNI={:?}, ALPN={:?}", info.sni, info.alpn);
    }
    Some(HttpsInfo {
        tls_info: Some(info),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::dpi::tls_common::test_fixtures::{
        RFC9001_CLIENT_HELLO, build_server_hello, from_hex,
    };
    use crate::network::types::TlsVersion;

    fn rfc9001_client_hello() -> Vec<u8> {
        from_hex(RFC9001_CLIENT_HELLO)
    }

    /// Wrap a handshake message in a TLS record header.
    fn tls_record(handshake: &[u8]) -> Vec<u8> {
        let mut record = vec![0x16, 0x03, 0x01];
        record.extend_from_slice(&(handshake.len() as u16).to_be_bytes());
        record.extend_from_slice(handshake);
        record
    }

    #[test]
    fn test_analyze_https_client_hello_end_to_end() {
        let payload = tls_record(&rfc9001_client_hello());
        assert!(is_tls_handshake(&payload));

        let info = analyze_https(&payload).unwrap().tls_info.unwrap();
        assert_eq!(info.sni, Some("example.com".to_string()));
        assert_eq!(info.alpn, vec!["alpn".to_string()]);
        assert_eq!(info.version, Some(TlsVersion::Tls13));
    }

    #[test]
    fn test_analyze_https_server_hello_end_to_end() {
        // Synthetic TLS 1.3 ServerHello: legacy version 0x0303, cipher
        // TLS_AES_128_GCM_SHA256, supported_versions selecting 1.3.
        let handshake = build_server_hello(&from_hex("002b00020304"));

        let info = analyze_https(&tls_record(&handshake))
            .unwrap()
            .tls_info
            .unwrap();
        assert_eq!(info.cipher_suite, Some(0x1301));
        assert_eq!(info.version, Some(TlsVersion::Tls13));
    }

    #[test]
    fn test_analyze_https_truncated_client_hello() {
        // A ClientHello cut inside the SNI hostname still yields a partial
        // SNI on the TCP path (the record can never be completed later).
        let handshake = rfc9001_client_hello();
        // SNI extension content starts at the "example.com" bytes; cut after
        // "exampl" (the hostname starts at offset 0x2e + some header bytes).
        let sni_pos = handshake
            .windows(11)
            .position(|w| w == b"example.com")
            .unwrap();
        let truncated = &handshake[..sni_pos + 6];

        let info = analyze_https(&tls_record(truncated))
            .unwrap()
            .tls_info
            .unwrap();
        let sni = info.sni.expect("partial SNI should be extracted");
        assert!(sni.starts_with("exampl"));
        assert!(sni.contains("PARTIAL"));
    }

    #[test]
    fn test_analyze_https_non_handshake_record() {
        // Application data record: only the record version is extracted.
        let payload = [0x17, 0x03, 0x03, 0x00, 0x05, 1, 2, 3, 4, 5];
        let info = analyze_https(&payload).unwrap().tls_info.unwrap();
        assert_eq!(info.version, Some(TlsVersion::Tls12));
        assert_eq!(info.sni, None);
        assert!(info.alpn.is_empty());
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #334** (2026-05-28): **Exiting program when pressing Backspace twice after entering filter mode**
  *Symptoms*: After entering filter mode using /, pressing the Backspace key twice causes the program to exit. I'm not sure if this is a bug.
  **Post-Mortem & Fix Analysis**:
  > ubuntu 24.04
  > Thanks @lant1s , this sounds very much longer a bug.

- **Issue #34** (2025-10-03): **Network byte statistics are inaccurate for large packets**
  *Symptoms*: ## Issue  Network byte statistics show incorrect values when monitoring file transfers, especially over NFS or when jumbo frames are used. The reported bytes transferred can be off by orders of magnitude (too small).  ## Reproduction  1. Transfer a large file over NFS (e.g., using rsync to an NFS-mounted directory) 2. Monitor the connection with rustnet 3. Observe that bytes sent/received are severely undercounted  ## Root Cause  The code counts captured packet length (`data.len()`) instead of actual packet length. Since snaplen is set to 1514 bytes, any packet larger than this is truncated but counted as only 1514 bytes.  **Location**: `src/network/parser.rs` line 330 and similar places use `packet_len: data.len()`  ## Fix  Use the actual packet length from the IP header's Total Length field instead of the captured buffer length.

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

### Incident Patch 1: `a9e38a4e` (2026-10-05)
**Commit Message**: fix(ui): separate overview traffic and interface counters (#661)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -169,6 +169,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Keep packet rates, connection lifecycle, and health updating when interface counters are unavailable; prevent compact RX/TX rates from losing leading digits.
 - **macOS traffic graphs**: use aggregate counters for default PKTAP capture, keep
   Details scrolling independently, and publish complete interface-rate snapshots
+- Add the missing divider between Overview traffic and interface counters.
 - Keep the filter cursor on UTF-8 character boundaries when typing, moving, or deleting non-ASCII text, avoiding TUI panics.
 - Preserve regex syntax in connection filters, including uppercase escapes such as `\D` and explicit case-sensitive groups.
 - ARM DEB compatibility with Ubuntu 22.04 and Debian 12/13: use a glibc 2.35
```

**File**: `src/ui/tabs/overview.rs` (modified, +10/-4)
```diff
@@ -1322,6 +1322,7 @@ fn draw_stats_panel(
             Span::raw(" · "),
             Span::styled(format!("TX {}", sidebar_rate(tx)), theme::fg(theme::tx())),
         ]));
+        lines.push(section_separator(inner_area.width.saturating_sub(2)));
         lines.extend(interface_error_lines(app, usize::MAX));
         lines.push(section_separator(inner_area.width.saturating_sub(2)));
         lines.extend(security_lines);
@@ -1465,13 +1466,16 @@ fn draw_interface_stats_with_graph(
     area: Rect,
     state: &UiState,
 ) -> Result<()> {
-    // Heading + sparklines (3 lines) + interface details (remaining).
+    // Heading + sparklines (3 lines) + separator + interface details (remaining).
     let layout = Layout::default()
         .direction(Direction::Vertical)
         .constraints([
             Constraint::Length(1), // Heading
             Constraint::Length(3), // Traffic sparklines
-            Constraint::Min(0),    // Interface details
+            Constraint::Length(
+                SECTION_GAP_HEIGHT.min(area.height.saturating_sub(TRAFFIC_MIN_HEIGHT)),
+            ),
+            Constraint::Min(0), // Interface details
         ])
         .split(area);
 
@@ -1542,10 +1546,12 @@ fn draw_interface_stats_with_graph(
     let rates_para = Paragraph::new(rates_text);
     f.render_widget(rates_para, sparkline_rows[2]);
 
-    let max_interfaces = usize::from(sections[1].height).saturating_sub(1);
+    render_section_separator(f, sections[1]);
+
+    let max_interfaces = usize::from(sections[2].height).saturating_sub(1);
     let interface_text = interface_error_lines(app, max_interfaces);
     let interface_para = Paragraph::new(interface_text);
-    f.render_widget(interface_para, sections[1]);
+    f.render_widget(interface_para, sections[2]);
 
     Ok(())
 }
```

---

### Incident Patch 2: `149bbad1` (2026-10-05)
**Commit Message**: fix(ui): simplify traffic graphs and clarify rates (#660)

* fix(ui): simplify traffic graphs and clarify rates

**File**: `CHANGELOG.md` (modified, +9/-5)
```diff
@@ -11,9 +11,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Reject Unix output files owned by unrelated users before changing or writing them, anchor opens to validated directories, and create diagnostic logs exclusively
 
 ### Added
-- **Traffic surge visibility**: held auto scales, shared/independent and log modes,
-  scale lock with overflow markers, rounded traffic waves, and two-second rate averages
-  in Graph/Details and Activity sorting
+- **Traffic surge visibility**: automatic linear scales, preserved sampled peaks,
+  time labels, and two-second rate averages in Graph/Details and Activity sorting
+- **Traffic reporting clarity**: graphs follow the capture interface; label smoothed
+  process rates, use binary byte units, and show explicit idle rates
 - **Retained Linux process identity**: eBPF preserves bounded executable paths
   and immediate-parent metadata after exit or exec, and checks task birth times
   before extending ancestry through procfs (#640)
@@ -67,8 +68,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   the selected process group
 
 ### Changed
-- Restore gradient traffic waves with three-sample smoothing and independent RX/TX
-  scales by default; `s` switches Graph and wide Details to a shared scale.
+- Simplify Graph and Details to automatic independent RX/TX scales, with no scale,
+  log, or lock controls.
   Current rates and peak labels retain raw measurements. Details gains taller
   plots, aligned totals, and clear messages when no live history is available.
 - Smooth scrolling in Overview, Graph, and Details at 20 fps, preserving the
@@ -165,6 +166,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- Keep packet rates, connection lifecycle, and health updating when interface counters are unavailable; prevent compact RX/TX rates from losing leading digits.
+- **macOS traffic graphs**: use aggregate counters for default PKTAP capture, keep
+  Details scrolling independently, and publish complete interface-rate snapshots
 - Keep the filter cursor on UTF-8 character boundaries when typing, moving, or deleting non-ASCII text, avoiding TUI panics.
 - Preserve regex syntax in connection filters, including uppercase escapes such as `\D` and explicit case-sensitive groups.
 - ARM DEB compatibility with Ubuntu 22.04 and Debian 12/13: use a glibc 2.35
```

**File**: `TUI.ja.md` (modified, +31/-18)
```diff
@@ -49,24 +49,35 @@ Capture のカバレッジにも TX/RX の棒を表示します。小さい画
 
 ## 転送グラフ
 
-Graph と Details は縦方向のグラデーション付きの連続した塗りつぶし波形を使います。
-三つのサンプルの移動平均で単発の尖ったピークを和らげ、サンプル座標で補間して
-輪郭を丸めるため、スクロールで形が変わりません。各端末列で平滑化した曲線の
-最高点を保持し、離れた輪郭や塗りつぶしの穴を防ぎます。見出しは平滑化した表示で
-あることを示します。RX/TX は既定でラベル付きの独立した線形スケールを使います。
-Graph の転送ビュー、完全な Details ダッシュボード、またはその Traffic セクションで、次のキーを使えます。
-
-- `s` は RX/TX の独立スケールと共通スケールを切り替えます。
-- `z` は線形と対数を切り替えます。対数表示では大きなバーストと小さな通信量を同時に確認できます。見出しと軸ラベルにスケールを示します。
-- `l` は現在の表示範囲を固定または解除します。データはスクロールを続けます。上端の `▲` は固定上限を超えた値を示し、ピークの数値は正確に表示します。
-
-固定範囲を含む設定は Graph と Details で共有されます。単位はバイト毎秒で、
-K/M/G は 1024 の累乗です。余裕がある場合、見出しに生の現在値、履歴内のピーク、
-時間で重み付けした `2s avg` を表示します。起動直後は観測済みの区間だけを使い、
-二つのサンプルが揃ってから平均値を表示します。
-自動スケールは平滑化した履歴に合わせて丸めた上限を使い、古いピークが履歴から
-消えた後、五秒待ってから徐々に縮小します。大きな通信量が続いて 60 秒の履歴に残る間は線形グラフが圧縮される
-場合があります。対数モードでは履歴を切り捨てずに小さな通信量を確認できます。
+Graph はダッシュボード全体が収まる場合、すべてのパネルを同時に表示します。
+小さい端末では `v` / Shift+`v` または見出しのクリックで Traffic、Health、
+Distribution セクションを切り替えます。
+通信量には選択したキャプチャ対象のカウンターを使い、見出しにその名前を表示します。
+`any` と macOS 標準の `pktap` は全インターフェースの合計で、見出しに
+`all interfaces` と表示します。同じ通信を複数回数える場合があります。
+対象のカウンターが取得できない場合、別のインターフェースには切り替えません。
+パケット速度、接続ライフサイクル、ネットワーク健全性は引き続き更新し、
+カウンターのサンプルが再び取得できると RX/TX グラフを再開します。
+
+Graph と Details は観測した転送速度を直接描画し、複数のサンプルが一つの列に
+収まる場合も短いバーストのピークを保持します。塗りつぶし曲線はサンプル間を補間し、
+連続的にスクロールします。余裕がある場合、時間軸に `-60s`、`-30s`、`Now` を
+表示します。Overview と接続ライフサイクルの小さな波形は従来の平滑化を維持します。
+
+RX/TX はそれぞれ自動調整されるラベル付きの線形スケールを使います。単位はバイト毎秒で、
+KiB/MiB/GiB は 1024 の累乗で、コンパクトな軸は Ki/Mi/Gi を使います。両方向の上限は異なる場合があるため、大小の比較には数値を
+使ってください。スケール切り替え、対数表示、固定の操作はありません。上限はサンプルの
+ピークを含み、丸めた値まで上昇します。古いピークが履歴から消えて五秒後に徐々に縮小します。
+
+コンパクトな表の速度は小数桁数と単位を調整し、RX/TX の両方を省略せずに表示します。
+観測したアイドル状態は `0 B/s`、取得できない値はプレースホルダーで表示します。
+Top Processes は RX+TX の合計を平滑化した 10 秒平均として明記します。
+Details も同じ接続平均を使い、見出しと統計ラベルに平滑平均と表示します。
+その `2s avg` は表示サンプルの平均です。
+
+見出しには現在のサンプル値、履歴内のピーク、余裕があれば時間で重み付けした `2s avg` を
+表示します。平均は観測済みの区間だけを使い、二つのサンプルが揃ってから表示します。
+大きなバーストが 60 秒の履歴に残る間、小さな通信量は基線に近くなりますが、数値は表示されます。
 
 完全な Details ダッシュボードでは、並列 RX/TX グラフをフッターの上に固定します。
 Traffic パネルは内容の高さの約三分の一を使い、見出しと統計を含めて 7–18 行に制限します。
@@ -82,6 +93,8 @@ Activity では `s` で `2s Avg TX/RX` を選ぶと短時間の平均転送速
 Overview、Graph、Details でスクロールするグラフが表示されている間は、毎秒約 20 回
 描画し、既存の 500 ミリ秒のサンプル間を経過時間に応じて連続的にスクロールします。
 サンプル到着時に位置を引き継ぎ、タイミングの揺れによる履歴の飛びを防ぎます。
+Details は接続履歴自身の時計でアニメーションするため、インターフェースの
+カウンターが取得できなくても連続してスクロールします。
 Activity の割合とカバレッジ、Host の DNS 応答時間、Graph の健全性、プロトコル、
 TCP 状態の棒は、250 ミリ秒で新しい値へ滑らかに移行します。数値と状態の色は即座に
 更新します。並べ替えてもアニメーションは同じ指標を追跡し、新規表示、サイズ変更、
```

**File**: `TUI.md` (modified, +33/-22)
```diff
@@ -53,27 +53,37 @@ table or selected record; full interface inventory remains available in Host.
 
 ## Traffic charts
 
-Graph and Details use one continuous filled wave with a vertical gradient.
-A three-sample moving average softens isolated spikes, and interpolation rounds
-the contour in sample coordinates so scrolling does not reshape it. Each column
-retains the highest point of that smoothed curve, without a detached outline or
-holes in the fill. Headings identify the smoothed presentation. RX and TX use
-independent, labeled linear scales by default. In Graph's traffic view, the full Details dashboard, or its Traffic section:
-
-- `s` switches independent/shared RX/TX scales for magnitude comparisons.
-- `z` switches linear/logarithmic heights. Log mode keeps small background traffic
-  visible alongside large surges; the heading and axis labels identify the scale.
-- `l` locks/unlocks the currently displayed bounds. Data keeps scrolling. A `▲`
-  at the top marks values above the locked ceiling; the peak readout stays exact.
-
-These settings, including locked bounds, carry between Graph and Details. Units
-are bytes per second (K/M/G use powers of 1024). Headers show the raw current rate,
-window peak, and a time-weighted `2s avg` where space permits. During startup the
-average uses only observed intervals and appears after two samples.
-Auto scales follow the smoothed history, use rounded bounds, and wait five
-seconds before beginning a gradual shrink when older peaks leave the history.
-A sustained surge can still compress a linear chart until it leaves the
-60-second window; log mode exposes smaller rates without clipping that history.
+Graph shows all panels together when the full dashboard fits. Smaller terminals
+use Traffic, Health, and Distribution sections, selected with `v` / Shift+`v`
+or by clicking their names.
+Traffic uses the selected capture interface’s counters and names it in the heading.
+The `any` capture interface and macOS default `pktap` capture sum all interface
+counters, labeled `all interfaces`. This can count traffic on more than one
+interface. Missing counters never fall back to another interface. Packet rates,
+connection lifecycle, and network health keep updating without those counters;
+RX/TX plots restart when counter samples return.
+
+Graph and Details plot sampled rates directly, preserving short bursts even
+when several samples share a terminal column. The filled curves interpolate
+between samples and scroll continuously. Time labels show `-60s`, `-30s`, and
+`Now` where space permits. Overview and lifecycle mini waves retain their smoothing.
+
+RX and TX each use an automatic, labeled linear scale in bytes per second
+(KiB/MiB/GiB use powers of 1024; compact axes use Ki/Mi/Gi). Compare the numeric readings when comparing directions,
+since the two axes can have different bounds. There are no scale, log, or lock
+controls. Bounds include the sampled peak, rise to rounded values, and wait five
+seconds before gradually shrinking after older peaks leave the history.
+
+Compact table rates reduce precision and promote units to keep both RX/TX values visible.
+Observed idle rates show `0 B/s`; unavailable values retain a placeholder.
+Top Processes labels its combined RX+TX rate as a smoothed 10-second average.
+Details rates use the same smoothed connection average, identified in the heading
+and statistics labels; its `2s avg` averages those displayed samples.
+
+Headers show the current sampled rate, the window peak, and a time-weighted
+`2s avg` where space permits. Startup averages use only observed intervals and
+appear after two samples. Small traffic can appear near the baseline while a
+large burst remains in the 60-second window; the numeric readings remain visible.
 
 The full Details dashboard anchors its paired RX/TX plots above the footer.
 The Traffic panel uses about one third of the content height, bounded to 7–18
@@ -91,7 +101,8 @@ existing meaning.
 Visible scrolling graphs in Overview, Graph, and Details redraw about 20 times
 per second, using continuous elapsed time between the existing 500 ms samples.
 The scroll position carries across sample arrivals to prevent timing jitter from
-jumping the history forward.
+jumping the history forward. Details uses its connection history’s own clock,
+so unavailable interface counters do not interrupt its animation.
 Activity share/coverage bars, Host DNS latency bars, and Graph health, protocol,
 and TCP-state bars ease toward new values over 250 ms. Numeric readings and
 status colors update immediately. Transitions follow each metric's identity
```

**File**: `TUI.zh-CN.md` (modified, +26/-15)
```diff
@@ -42,20 +42,29 @@ TX/RX 条形图。小终端和详情视图优先显示表格或所选记录；
 
 ## 流量图
 
-Graph 和 Details 使用带垂直渐变的单一连续填充波形。
-三个采样的移动平均柔化孤立尖峰，插值在采样坐标中修圆轮廓，滚动不会改变曲线形状。
-每列保留平滑曲线的最高点，且不会出现分离的轮廓或填充空洞。标题注明图形经过平滑。
-RX/TX 默认使用带标签的独立线性刻度。在 Graph 流量视图、完整 Details 仪表板或其 Traffic 区块中：
-
-- `s` 切换独立或共享 RX/TX 刻度，以比较大小。
-- `z` 切换线性或对数高度。对数模式让小流量与大突发同时可见，标题和轴标签显示刻度。
-- `l` 锁定或解锁当前显示的范围。数据继续滚动；顶部的 `▲` 表示超出锁定上限，峰值读数保持准确。
-
-这些设置（包括锁定范围）在 Graph 和 Details 之间共享。单位为字节每秒，K/M/G 按
-1024 的幂计算。空间允许时，标题显示原始当前速率、窗口峰值和按时间加权的 `2s avg`。
-启动时只使用已观测的时间区间，至少有两个采样后才显示平均值。
-自动刻度跟随平滑历史，使用整齐的分级上限；旧峰值移出历史后等待五秒，再逐渐缩小。
-持续的大流量在 60 秒窗口内仍可能压缩线性图，对数模式可显示小流量而无需截断历史。
+Graph 在完整仪表板放得下时同时显示所有面板。较小的终端使用 Traffic、Health 和
+Distribution 区块，按 `v` / Shift+`v` 或点击名称切换。流量使用所选抓包接口的计数器，标题显示接口名称。
+`any` 和 macOS 默认的 `pktap` 抓包汇总所有接口的计数器，标题显示 `all interfaces`。
+同一流量可能在多个接口上被重复计数。
+所选接口缺少计数器时，不会改用其他接口。数据包速率、连接生命周期和网络健康指标仍会更新；
+计数器采样恢复后，RX/TX 图重新开始绘制。
+
+Graph 和 Details 直接绘制采样速率，即使多个采样共用一列也保留短暂突发的峰值。
+填充曲线在采样之间插值并连续滚动。空间允许时，时间轴显示 `-60s`、`-30s` 和
+`Now`。Overview 和连接生命周期迷你图保留原有平滑方式。
+
+RX/TX 各自使用自动调整、带标签的线性刻度，单位为字节每秒，KiB/MiB/GiB 按 1024 的幂计算，紧凑坐标轴使用 Ki/Mi/Gi。
+两个方向的上限可能不同，比较大小时请看数值。移除刻度切换、对数和锁定控制。
+上限包含采样峰值，向上调整到整齐的分级值；旧峰值移出历史后等待五秒，再逐渐缩小。
+
+紧凑表格中的速率会减少小数位数并提升单位，确保 RX/TX 两个值完整可见。
+已观测到的空闲速率显示 `0 B/s`，不可用数据保留占位符。Top Processes 将 RX+TX
+合计速率标为经过平滑处理的 10 秒平均值。Details 使用同样的连接平均速率，
+标题和统计标签注明平滑平均值；其中的 `2s avg` 对这些显示采样取平均。
+
+标题显示当前采样速率、窗口峰值和按时间加权的 `2s avg`（空间允许时）。启动时只使用
+已观测区间，至少有两个采样后才显示平均值。大突发留在 60 秒窗口内时，小流量可能
+接近基线，当前速率数值仍然可见。
 
 完整 Details 仪表板将并排 RX/TX 图固定在底部状态栏上方。Traffic 面板约占内容高度的
 三分之一，包含标题和统计行时限制为 7–18 行，并优先保证所有信息卡片完整显示。
@@ -68,7 +77,9 @@ Activity 中按 `s` 循环到 `2s Avg TX/RX` 可按短时平均速率排序。
 其他排序模式保持原有含义。
 
 Overview、Graph 和 Details 中可见的滚动图表每秒重绘约 20 次，在现有的 500 毫秒
-采样间隔内按实际经过的时间连续滚动。新采样到达时保留滚动位置，避免时序抖动使历史跳动。Activity 的占比和覆盖率、Host 的 DNS 延迟，
+采样间隔内按实际经过的时间连续滚动。新采样到达时保留滚动位置，避免时序抖动使历史跳动。
+Details 使用连接历史自身的时钟进行动画，接口计数器不可用时仍可连续滚动。
+Activity 的占比和覆盖率、Host 的 DNS 延迟，
 以及 Graph 的健康、协议和 TCP 状态条形图在 250 毫秒内平滑过渡到新值。
 数值和状态颜色立即更新。排序时动画跟随指标身份；新出现、尺寸变化或重新显示的
 条形图立即显示实际值。稳定的条形图、没有滚动图表的视图以及 Help 使用较低的
```

**File**: `crates/rustnet-core/src/network/interface_stats/mod.rs` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ use bsd::MacOSStatsProvider;
 use linux::LinuxStatsProvider;
 #[cfg(target_os = "windows")]
 use windows::WindowsStatsProvider;
+#[cfg(target_os = "windows")]
+pub use windows::capture_interface_alias;
 
 /// Statistics for a network interface
 #[derive(Debug, Clone)]
```

**File**: `crates/rustnet-core/src/network/interface_stats/windows.rs` (modified, +24/-0)
```diff
@@ -8,6 +8,30 @@ use std::time::SystemTime;
 use windows::Win32::NetworkManagement::IpHelper::{FreeMibTable, GetIfTable2, MIB_IF_TABLE2};
 use windows::Win32::NetworkManagement::Ndis::IfOperStatusUp;
 
+/// Match Npcap's GUID device name to the alias used by interface counters.
+/// Resolve once when starting the sampler, not on every graph refresh.
+pub fn capture_interface_alias(name: &str) -> Option<String> {
+    use windows::Win32::NetworkManagement::IpHelper::{
+        ConvertInterfaceGuidToLuid, ConvertInterfaceLuidToAlias,
+    };
+    use windows::Win32::NetworkManagement::Ndis::NET_LUID_LH;
+    use windows::core::GUID;
+
+    let guid = name.strip_prefix(r"\Device\NPF_{")?.strip_suffix('}')?;
+    let guid = GUID::from_u128(u128::from_str_radix(&guid.replace('-', ""), 16).ok()?);
+    let mut luid = NET_LUID_LH::default();
+    let mut alias = [0u16; 257];
+    // Both calls write only to the stack buffers passed here.
+    unsafe {
+        ConvertInterfaceGuidToLuid(&guid, &mut luid).ok().ok()?;
+        ConvertInterfaceLuidToAlias(&luid, &mut alias).ok().ok()?;
+    }
+    let alias = String::from_utf16_lossy(&alias)
+        .trim_end_matches('\0')
+        .to_string();
+    (!alias.is_empty()).then_some(alias)
+}
+
 /// Windows-specific implementation using IP Helper API
 pub struct WindowsStatsProvider;
 
```

**File**: `crates/rustnet-core/src/network/types/graph.rs` (modified, +184/-87)
```diff
@@ -17,6 +17,7 @@ pub struct ConnectionLifecycleSample {
 #[derive(Debug, Clone)]
 pub struct TrafficSample {
     pub timestamp: Instant,
+    traffic_available: bool,
     pub rx_bytes_per_sec: u64,
     pub tx_bytes_per_sec: u64,
     smoothed_rx_bytes_per_sec: u64,
@@ -152,12 +153,47 @@ impl Default for GraphScale {
     }
 }
 
+/// Animation clock owned by each sampled history. Carry the position across
+/// early arrivals, and stop one interval ahead if sampling stalls.
+#[derive(Debug, Clone, Default)]
+pub struct GraphScroll {
+    newest: Option<Instant>,
+    interval: Duration,
+    phase: f64,
+}
+
+impl GraphScroll {
+    pub fn record_at(&mut self, now: Instant) {
+        self.phase = if self.interval.is_zero() {
+            0.0
+        } else {
+            self.fraction_at(now) - 1.0
+        };
+        self.interval = self.newest.map_or(Duration::ZERO, |previous| {
+            now.saturating_duration_since(previous)
+        });
+        self.newest = Some(now);
+    }
+
+    pub fn fraction(&self) -> f64 {
+        self.fraction_at(Instant::now())
+    }
+
+    pub fn fraction_at(&self, now: Instant) -> f64 {
+        let Some(newest) = self.newest.filter(|_| !self.interval.is_zero()) else {
+            return 0.0;
+        };
+        let elapsed = now.saturating_duration_since(newest).as_secs_f64();
+        (self.phase + elapsed / self.interval.as_secs_f64()).min(1.0)
+    }
+}
+
 /// Ring buffer for aggregate traffic history (used for graphs)
 #[derive(Debug, Clone)]
 pub struct TrafficHistory {
     samples: VecDeque<TrafficSample>,
     max_samples: usize,
-    scroll_phase: f64,
+    scroll: GraphScroll,
     rx_scale: GraphScale,
     tx_scale: GraphScale,
     opened_scale: GraphScale,
@@ -172,7 +208,7 @@ impl TrafficHistory {
         Self {
             samples: VecDeque::with_capacity(max_samples),
             max_samples,
-            scroll_phase: 0.0,
+            scroll: GraphScroll::default(),
             rx_scale: GraphScale::default(),
             tx_scale: GraphScale::default(),
             opened_scale: GraphScale::new(10),
@@ -190,6 +226,25 @@ impl TrafficHistory {
         retransmits_per_sec: u64,
         avg_rtt_ms: Option<f64>,
     ) {
+        self.add_sample(
+            Some((rx_bytes_per_sec, tx_bytes_per_sec)),
+            lifecycle,
+            packets_per_sec,
+            retransmits_per_sec,
+            avg_rtt_ms,
+        );
+    }
+
+    /// Record capture metrics even when interface byte counters are unavailable.
+    pub fn add_sample(
+        &mut self,
+        traffic: Option<(u64, u64)>,
+        lifecycle: ConnectionLifecycleSample,
+        packets_per_sec: u64,
+        retransmits_per_sec: u64,
+        avg_rtt_ms: Option<f64>,
+    ) {
+        let (rx_bytes_per_sec, tx_bytes_per_sec) = traffic.unwrap_or_default();
         let packet_loss_pct = if packets_per_sec > 0 {
             (retransmits_per_sec as f32 / packets_per_sec as f32) * 100.0
         } else {
@@ -211,10 +266,20 @@ impl TrafficHistory {
                 let sum = if round { sum + count / 2 } else { sum };
                 (sum / count) as u64
             };
+        let traffic_average = |current, pick: fn(&TrafficSample) -> u64| {
+            let (sum, count) = self
+                .traffic_samples()
+                .rev()
+                .take(2)
+                .fold((u128::from(current), 1), |(sum, count), sample| {
+                    (sum + u128::from(pick(sample)), count + 1)
+                });
+            (sum / count) as u64
+        };
         let smoothed_rx_bytes_per_sec =
-            smoothed(rx_bytes_per_sec, 2, |sample| sample.rx_bytes_per_sec, false);
+            traffic_average(rx_bytes_per_sec, |sample| sample.rx_bytes_per_sec);
         let smoothed_tx_bytes_per_sec =
-            smoothed(tx_bytes_per_sec, 2, |sample| sample.tx_bytes_per_sec, false);
+            traffic_average(tx_bytes_per_sec, |sample| sample.tx_bytes_per_sec);
         let smoothed_opened_connections_per_sec_tenths = smoothed(
             lifecycle.opened_per_sec_tenths,
             OPENED_RATE_SMOOTHING_SAMPLES - 1,
@@ -229,9 +294,10 @@ impl TrafficHistory {
         );
 
         let timestamp = Instant::now();
-        self.advance_scroll_at(timestamp);
+        self.scroll.record_at(timestamp);
         let sample = TrafficSample {
             timestamp,
+            traffic_available: traffic.is_some(),
             rx_bytes_per_sec,
             tx_bytes_per_sec,
             smoothed_rx_bytes_per_sec,
@@ -251,19 +317,23 @@ impl TrafficHistory {
             self.samples.pop_front();
         }
         self.samples.push_back(sample);
-        let picks: [fn(&TrafficSample) -> u64; 4] = [
-            |sample| sample.smoothed_rx_bytes_per_sec,
-            |sample| sample.smoothed_tx_bytes_per_sec,
+        let picks: [fn(&TrafficSample) -> u64; 2] = [
             |sample| sample.smoothed_opened_connections_per_sec_tenths,
             |sample|
```

**File**: `src/app/mod.rs` (modified, +1/-1)
```diff
@@ -57,4 +57,4 @@ const LIVE_RATE_INTERVAL: Duration = Duration::from_millis(500);
 /// whole 60s history window. Keep this at half of [`LIVE_RATE_INTERVAL`].
 const MIN_RATE_SAMPLE_SECONDS: f64 = 0.25;
 const TRAFFIC_HISTORY_SECONDS: usize = 60;
-const TRAFFIC_HISTORY_CAPACITY: usize = TRAFFIC_HISTORY_SECONDS * 2;
+pub(crate) const TRAFFIC_HISTORY_CAPACITY: usize = TRAFFIC_HISTORY_SECONDS * 2;
```

---

### Incident Patch 3: `2073632b` (2026-10-04)
**Commit Message**: Fix release publication gate (#656)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -135,6 +135,7 @@ jobs:
 
   # Publish the release (un-draft) after all assets are uploaded.
   # This ensures downstream jobs (Homebrew, Chocolatey) can download assets.
+  # The default success gate keeps new releases in draft if any installer fails.
   publish-release:
     name: publish-release
     runs-on: ubuntu-latest
@@ -143,7 +144,6 @@ jobs:
       - package-installers
       - package-macos
       - package-windows
-    if: always() && needs.create-release.result == 'success'
     steps:
       - name: Publish release
         env:
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -246,6 +246,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   privileged procfs scan feed a validated fallback shown as the "startup
   snapshot" match quality (#575)
 
+- Keep new releases in draft until Linux, macOS and Windows installer jobs
+  all succeed, preventing publication with missing installer assets.
+
 ### Removed
 - Unused screenshots, the macOS PNG export, duplicate PPA setup notes,
   obsolete manual build/debug tools, and redundant services copies in local
```

---

### Incident Patch 4: `952fb50b` (2026-10-03)
**Commit Message**: Fix ARM DEB compatibility (#654)

**File**: `.github/actions/package-archive/action.yml` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@ runs:
           cp "crates/rustnet-core/assets/services" "$staging/assets/"
         fi
 
+        if [ "${{ inputs.target }}" = "armv7-unknown-linux-gnueabihf" ]; then
+          cp resources/packaging/linux/libpcap-LICENSE "$staging/"
+        fi
+
         cp README.md "$staging/"
         cp LICENSE "$staging/" 2>/dev/null || true
 
```

**File**: `.github/workflows/build-platforms.yml` (modified, +50/-0)
```diff
@@ -121,6 +121,20 @@ jobs:
           "CARGO_ENCODED_RUSTFLAGS=$($rustflags -join [char]0x1f)" |
             Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
 
+      - name: Build and validate DEB
+        if: contains(matrix.target, 'linux-gnu')
+        run: |
+          cargo install cargo-deb --locked
+          bash scripts/package-deb.sh '${{ matrix.target }}' rustnet.deb
+
+      - name: Upload DEB for installation tests
+        if: contains(matrix.target, 'linux-gnu')
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
+        with:
+          name: deb-${{ matrix.target }}
+          path: rustnet.deb
+          if-no-files-found: error
+
       - name: Run workspace tests
         if: matrix.run-tests
         run: cargo test --locked --workspace --all-features --no-fail-fast --target ${{ matrix.target }} --verbose
@@ -382,3 +396,39 @@ jobs:
           name: build-${{ matrix.target }}
           path: ${{ steps.archive.outputs.asset }}
           if-no-files-found: error
+
+  test-deb:
+    name: deb-${{ matrix.arch }}-${{ matrix.image }}
+    needs: build
+    permissions:
+      contents: read
+    runs-on: ${{ matrix.runner }}
+    timeout-minutes: 15
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - { arch: amd64, target: x86_64-unknown-linux-gnu, platform: linux/amd64, runner: ubuntu-24.04, image: 'ubuntu:22.04' }
+          - { arch: arm64, target: aarch64-unknown-linux-gnu, platform: linux/arm64, runner: ubuntu-24.04-arm, image: 'ubuntu:22.04' }
+          - { arch: arm64, target: aarch64-unknown-linux-gnu, platform: linux/arm64, runner: ubuntu-24.04-arm, image: 'ubuntu:24.04' }
+          - { arch: arm64, target: aarch64-unknown-linux-gnu, platform: linux/arm64, runner: ubuntu-24.04-arm, image: 'debian:bookworm-slim' }
+          - { arch: arm64, target: aarch64-unknown-linux-gnu, platform: linux/arm64, runner: ubuntu-24.04-arm, image: 'debian:trixie-slim' }
+          - { arch: armhf, target: armv7-unknown-linux-gnueabihf, platform: linux/arm/v7, runner: ubuntu-24.04, image: 'debian:bookworm-slim' }
+          - { arch: armhf, target: armv7-unknown-linux-gnueabihf, platform: linux/arm/v7, runner: ubuntu-24.04, image: 'debian:trixie-slim' }
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8
+        with:
+          name: deb-${{ matrix.target }}
+          path: packages
+      - uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 # v3
+        if: matrix.arch == 'armhf'
+      - name: Install, capture and uninstall
+        env:
+          PLATFORM: ${{ matrix.platform }}
+          IMAGE: ${{ matrix.image }}
+          CAPTURE_SMOKE: ${{ matrix.arch != 'armhf' }}
+        run: |
+          docker run --rm --platform "$PLATFORM" -e CAPTURE_SMOKE \
+            -v "$PWD/packages:/packages:ro" -v "$PWD/scripts:/checks:ro" \
+            "$IMAGE" bash /checks/test-deb-install.sh
```

**File**: `.github/workflows/release.yml` (modified, +1/-2)
```diff
@@ -287,8 +287,7 @@ jobs:
             unpack "$target"
 
             # Create deb package
-            cargo deb --no-build --no-strip --target "$target"
-            mv "target/$target/debian"/*.deb "installers/Rustnet_LinuxDEB_$arch.deb"
+            bash scripts/package-deb.sh "$target" "installers/Rustnet_LinuxDEB_$arch.deb"
 
             cleanup "$target"
           done
```

**File**: `.github/workflows/test-platform-builds.yml` (modified, +5/-0)
```diff
@@ -19,6 +19,11 @@ on:
       - 'Cargo.lock'
       - 'build.rs'
       - 'Cross.toml'
+      - 'resources/packaging/linux/**'
+      - 'scripts/package-deb.sh'
+      - 'scripts/verify-linux-abi.py'
+      - 'scripts/test-deb-install.sh'
+      - 'scripts/test-package-capture.py'
       - 'src/**'
       - 'crates/**'
       - 'tests/**'
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -167,6 +167,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 - Keep the filter cursor on UTF-8 character boundaries when typing, moving, or deleting non-ASCII text, avoiding TUI panics.
 - Preserve regex syntax in connection filters, including uppercase escapes such as `\D` and explicit case-sensitive groups.
+- ARM DEB compatibility with Ubuntu 22.04 and Debian 12/13: use a glibc 2.35
+  build baseline, declare runtime dependencies, and embed ARMv7 libpcap to
+  avoid Debian 13's time64 ABI mismatch. Test package installation and capture.
 - **Traffic graph stability**: remove hollow outlines and preserve the scroll position
   across sample arrivals; interpolate before rasterizing to prevent contour wobble
 - Keep Activity summary TX/RX labels, numbers, and units aligned as live rates change
```

**File**: `Cargo.toml` (modified, +8/-1)
```diff
@@ -185,7 +185,7 @@ Features:
 - Multi-threaded processing for optimal performance
 - eBPF-enhanced process detection on Linux (with automatic fallback)
 """
-depends = "libpcap0.8, libelf1"
+depends = "libc6 (>= 2.35), libgcc-s1, libpcap0.8 | libpcap0.8t64, libelf1 | libelf1t64, zlib1g"
 section = "net"
 priority = "optional"
 assets = [
@@ -217,6 +217,13 @@ assets = [
 ]
 conf-files = []
 
+# The release ARMv7 binary embeds libpcap to avoid the time32/time64 ABI
+# mismatch. Source builds retain the normal distribution dependencies above.
+[package.metadata.deb.variants.armhf]
+name = "rustnet-monitor"
+merge-assets.append = [["resources/packaging/linux/libpcap-LICENSE", "usr/share/doc/rustnet-monitor/libpcap-LICENSE", "644"]]
+depends = "libc6 (>= 2.35), libgcc-s1, libelf1 | libelf1t64, zlib1g"
+
 [package.metadata.generate-rpm]
 assets = [
     { source = "target/release/rustnet", dest = "/usr/bin/rustnet", mode = "755" },
```

**File**: `Cross.toml` (modified, +8/-16)
```diff
@@ -1,17 +1,9 @@
-# eBPF skeleton generation links libelf and zlib on the build host as well
-# as on the target. Install both development-library architectures explicitly.
-[target.aarch64-unknown-linux-gnu]
-image = "ghcr.io/cross-rs/aarch64-unknown-linux-gnu:edge"
-pre-build = [
-    "dpkg --add-architecture $CROSS_DEB_ARCH",
-    "apt-get update -y",
-    "apt-get install -y libelf-dev zlib1g-dev libelf-dev:arm64 zlib1g-dev:arm64 libpcap-dev:arm64 gcc-aarch64-linux-gnu clang llvm"
-]
+# Keep the GNU ARM sysroot on Ubuntu 22.04 (glibc 2.35), rather than a
+# moving cross image that can silently raise the minimum runtime version.
+[target.aarch64-unknown-linux-gnu.dockerfile]
+file = "resources/packaging/linux/Dockerfile.cross"
+build-args = { DEB_ARCH = "arm64", GNU_TARGET = "aarch64-linux-gnu" }
 
-[target.armv7-unknown-linux-gnueabihf]
-image = "ghcr.io/cross-rs/armv7-unknown-linux-gnueabihf:edge"
-pre-build = [
-    "dpkg --add-architecture $CROSS_DEB_ARCH",
-    "apt-get update -y",
-    "apt-get install -y libelf-dev zlib1g-dev libelf-dev:armhf zlib1g-dev:armhf libpcap-dev:armhf gcc-arm-linux-gnueabihf clang llvm"
-]
+[target.armv7-unknown-linux-gnueabihf.dockerfile]
+file = "resources/packaging/linux/Dockerfile.cross"
+build-args = { DEB_ARCH = "armhf", GNU_TARGET = "arm-linux-gnueabihf" }
```

**File**: `INSTALL.md` (modified, +5/-0)
```diff
@@ -140,6 +140,11 @@ rustnet
 
 For manual installation or non-Ubuntu Debian-based distributions:
 
+**Development builds (unreleased):** GNU release binaries require glibc 2.35
+or newer. ARM64 DEBs support Ubuntu 22.04+ and Debian 12/13; ARMv7 DEBs
+support Debian 12/13 and embed libpcap to keep its packet timestamps compatible
+across the time64 library transition. These fixes do not apply to v1.6.0 assets.
+
 ```bash
 # Download the appropriate package for your architecture:
 # - Rustnet_LinuxDEB_amd64.deb (x86_64)
```

---

### Incident Patch 5: `e680fd89` (2026-10-03)
**Commit Message**: fix(ui): keep filter cursor on UTF-8 boundaries (#652)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -165,6 +165,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- Keep the filter cursor on UTF-8 character boundaries when typing, moving, or deleting non-ASCII text, avoiding TUI panics.
 - Preserve regex syntax in connection filters, including uppercase escapes such as `\D` and explicit case-sensitive groups.
 - **Traffic graph stability**: remove hollow outlines and preserve the scroll position
   across sample arrivals; interpolate before rasterizing to prevent contour wobble
```

**File**: `src/ui/state.rs` (modified, +63/-6)
```diff
@@ -556,6 +556,7 @@ pub struct UiState {
     pub clipboard_message: Option<(String, std::time::Instant)>,
     pub filter_mode: bool,
     pub filter_query: String,
+    /// Byte offset at a UTF-8 character boundary in `filter_query`.
     pub filter_cursor_position: usize,
     pub show_port_numbers: bool,
     pub sort_column: SortColumn,
@@ -894,25 +895,31 @@ impl UiState {
 
     pub fn filter_add_char(&mut self, c: char) {
         self.filter_query.insert(self.filter_cursor_position, c);
-        self.filter_cursor_position += 1;
+        self.filter_cursor_position += c.len_utf8();
     }
 
     pub fn filter_backspace(&mut self) {
         if self.filter_cursor_position > 0 {
-            self.filter_cursor_position -= 1;
+            self.filter_cursor_left();
             self.filter_query.remove(self.filter_cursor_position);
         }
     }
 
     pub fn filter_cursor_left(&mut self) {
-        if self.filter_cursor_position > 0 {
-            self.filter_cursor_position -= 1;
+        if let Some(c) = self.filter_query[..self.filter_cursor_position]
+            .chars()
+            .next_back()
+        {
+            self.filter_cursor_position -= c.len_utf8();
         }
     }
 
     pub fn filter_cursor_right(&mut self) {
-        if self.filter_cursor_position < self.filter_query.len() {
-            self.filter_cursor_position += 1;
+        if let Some(c) = self.filter_query[self.filter_cursor_position..]
+            .chars()
+            .next()
+        {
+            self.filter_cursor_position += c.len_utf8();
         }
     }
 
@@ -1363,6 +1370,56 @@ mod tests {
         }
     }
 
+    #[test]
+    fn filter_unicode_insertion_keeps_cursor_at_char_boundary() {
+        let mut ui = UiState::default();
+        ui.enter_filter_mode();
+        for c in "aé中🦀".chars() {
+            ui.filter_add_char(c);
+            assert_eq!(ui.filter_cursor_position, ui.filter_query.len());
+        }
+        ui.filter_cursor_left();
+        ui.filter_add_char('ß');
+        assert_eq!(ui.filter_query, "aé中ß🦀");
+        assert_eq!(ui.filter_cursor_position, "aé中ß".len());
+    }
+
+    #[test]
+    fn filter_unicode_cursor_moves_between_char_boundaries() {
+        let mut ui = UiState {
+            filter_query: "aé中🦀".to_string(),
+            ..UiState::default()
+        };
+        ui.enter_filter_mode();
+        for expected in [6, 3, 1, 0, 0] {
+            ui.filter_cursor_left();
+            assert_eq!(ui.filter_cursor_position, expected);
+        }
+        for expected in [1, 3, 6, 10, 10] {
+            ui.filter_cursor_right();
+            assert_eq!(ui.filter_cursor_position, expected);
+        }
+    }
+
+    #[test]
+    fn filter_unicode_backspace_removes_whole_characters() {
+        let mut ui = UiState {
+            filter_query: "aé中🦀".to_string(),
+            ..UiState::default()
+        };
+        ui.enter_filter_mode();
+        ui.filter_cursor_left();
+        for expected in ["aé🦀", "a🦀", "🦀", "🦀"] {
+            ui.filter_backspace();
+            assert_eq!(ui.filter_query, expected);
+            assert!(ui.filter_query.is_char_boundary(ui.filter_cursor_position));
+        }
+        ui.filter_cursor_right();
+        ui.filter_backspace();
+        assert!(ui.filter_query.is_empty());
+        assert_eq!(ui.filter_cursor_position, 0);
+    }
+
     #[test]
     fn whitespace_only_filter_is_inactive_and_cleared_on_exit() {
         let mut ui = UiState {
```

---

### Incident Patch 6: `7090457a` (2026-10-03)
**Commit Message**: fix(filter): preserve regex syntax when parsing queries (#653)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -165,6 +165,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- Preserve regex syntax in connection filters, including uppercase escapes such as `\D` and explicit case-sensitive groups.
 - **Traffic graph stability**: remove hollow outlines and preserve the scroll position
   across sample arrivals; interpolate before rasterizing to prevent contour wobble
 - Keep Activity summary TX/RX labels, numbers, and units aligned as live rates change
```

**File**: `crates/rustnet-core/src/network/filter.rs` (modified, +48/-24)
```diff
@@ -101,10 +101,10 @@ fn parse_filter_value(value: &str) -> FilterValue {
         let pattern = &value[1..value.len() - 1];
         match Regex::new(&format!("(?i){pattern}")) {
             Ok(re) => FilterValue::Regex(re),
-            Err(_) => FilterValue::Literal(value.to_string()),
+            Err(_) => FilterValue::Literal(value.to_lowercase()),
         }
     } else {
-        FilterValue::Literal(value.to_string())
+        FilterValue::Literal(value.to_lowercase())
     }
 }
 
@@ -146,67 +146,62 @@ impl ConnectionFilter {
 
         for part in parts {
             if let Some((keyword, value)) = part.split_once(':') {
-                let value = value.to_lowercase();
                 match keyword.to_lowercase().as_str() {
                     "port" => {
-                        criteria.push(FilterCriteria::Port(parse_port_match(&value)));
+                        criteria.push(FilterCriteria::Port(parse_port_match(value)));
                     }
                     "sport" | "srcport" | "source-port" => {
-                        criteria.push(FilterCriteria::SourcePort(parse_port_match(&value)));
+                        criteria.push(FilterCriteria::SourcePort(parse_port_match(value)));
                     }
                     "dport" | "dstport" | "dest-port" | "destination-port" => {
-                        criteria.push(FilterCriteria::DestinationPort(parse_port_match(&value)));
+                        criteria.push(FilterCriteria::DestinationPort(parse_port_match(value)));
                     }
                     "src" | "source" => {
-                        criteria.push(FilterCriteria::SourceIp(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::SourceIp(parse_filter_value(value)));
                     }
                     "dst" | "dest" | "destination" => {
-                        criteria.push(FilterCriteria::DestinationIp(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::DestinationIp(parse_filter_value(value)));
                     }
                     "proto" | "protocol" => {
-                        criteria.push(FilterCriteria::Protocol(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Protocol(parse_filter_value(value)));
                     }
                     "pid" => criteria.push(FilterCriteria::Pid(value.parse().ok())),
                     "process" | "proc" => {
-                        criteria.push(FilterCriteria::Process(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Process(parse_filter_value(value)));
                     }
                     "service" | "svc" => {
-                        criteria.push(FilterCriteria::Service(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Service(parse_filter_value(value)));
                     }
                     "sni" | "host" | "hostname" => {
-                        criteria.push(FilterCriteria::Sni(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Sni(parse_filter_value(value)));
                     }
                     "app" | "application" => {
-                        criteria.push(FilterCriteria::Application(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Application(parse_filter_value(value)));
                     }
                     "state" => {
-                        criteria.push(FilterCriteria::State(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::State(parse_filter_value(value)));
                     }
                     #[cfg(feature = "kubernetes")]
                     "pod" => {
-                        criteria.push(FilterCriteria::Pod(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Pod(parse_filter_value(value)));
                     }
                     #[cfg(feature = "kubernetes")]
                     "ns" | "namespace" => {
-                        criteria.push(FilterCriteria::Namespace(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Namespace(parse_filter_value(value)));
                     }
                     "runtime" => {
-                        criteria.push(FilterCriteria::Runtime(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Runtime(parse_filter_value(value)));
                     }
                     "container" | "cont" => {
-                        criteria.push(FilterCriteria::Container(parse_filter_value(&value)));
+                        criteria.push(FilterCriteria::Container(parse_filter_value(value)));
                     }
                     _ => {
                         // Unknown keyword, treat as general search
-                        criteria.push(FilterCriteria::General(parse_filter_value(
-                            &part.to
```

---

### Incident Patch 7: `06e4b6b8` (2026-10-02)
**Commit Message**: fix: secure Unix output file creation (#651)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Security
+- Reject Unix output files owned by unrelated users before changing or writing them, anchor opens to validated directories, and create diagnostic logs exclusively
+
 ### Added
 - **Traffic surge visibility**: held auto scales, shared/independent and log modes,
   scale lock with overflow markers, rounded traffic waves, and two-second rate averages
```

**File**: `README.ja.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ brew install rustnet
 
 機能の詳細は[使用ガイド](USAGE.md)、[アーキテクチャガイド](ARCHITECTURE.md)、[セキュリティガイド](SECURITY.md)を参照してください。
 
+開発版では、Unix の出力先に信頼できるディレクトリが必要で、診断ログは排他的に新規作成されます。
+
 ## スクリーンショット
 
 <table>
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ Packet capture needs platform-specific permissions. See the [installation guide]
 
 See the [usage guide](USAGE.md), [architecture guide](ARCHITECTURE.md), and [security guide](SECURITY.md) for feature details.
 
+Development builds require trusted directories for Unix output files and create diagnostic logs exclusively.
+
 ## Screenshots
 
 <table>
```

**File**: `README.zh-CN.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ brew install rustnet
 
 功能详情见[使用指南](USAGE.zh-CN.md)、[架构指南](ARCHITECTURE.zh-CN.md)和[安全指南](SECURITY.zh-CN.md)。
 
+开发版在 Unix 上要求输出目录可信，并以独占方式创建诊断日志。
+
 ## 截图
 
 <table>
```

**File**: `SECURITY.md` (modified, +2/-0)
```diff
@@ -128,6 +128,8 @@ and execution of all binaries except `/usr/sbin/lsof`.
 
 All three flags work normally within the sandbox.
 
+**Unreleased:** On Unix, existing explicit output files must belong to the effective user or a valid sudo caller. Output paths are opened relative to validated directory descriptors. Directories with unsafe ownership or permissions are rejected. Automatic diagnostic logs are created only as new files in a validated `logs/` directory. Use trusted private launch and output directories; changing permissions on an existing file cannot revoke descriptors another process already holds.
+
 ### Security Benefits
 
 If an attacker exploits a vulnerability in DPI/packet parsing:
```

**File**: `SECURITY.zh-CN.md` (modified, +2/-0)
```diff
@@ -120,6 +120,8 @@ RustNet 使用 **默认允许** 的 SBPL 配置文件配合针对性拒绝。
 
 三个标志在沙箱内均可正常工作。
 
+**尚未发布：** 在 Unix 上，现有的显式输出文件必须属于有效用户或有效的 sudo 调用用户。输出路径相对于已验证的目录文件描述符打开；拒绝所有权或权限不安全的目录。自动诊断日志仅在已验证的 `logs/` 目录中创建新文件。请使用可信的私有启动目录和输出目录；修改现有文件的权限无法撤销其他进程已持有的文件描述符。
+
 ### 安全收益
 
 如果攻击者利用 DPI/包解析中的漏洞：
```

**File**: `USAGE.md` (modified, +2/-2)
```diff
@@ -413,7 +413,7 @@ Enable logging with the specified level. Logging is **disabled by default**.
 - `debug` - Detailed debugging information
 - `trace` - Very verbose output (includes packet-level details)
 
-Log files are created in the `logs/` directory with timestamp: `rustnet_YYYY-MM-DD_HH-MM-SS.log`
+Log files are created in the `logs/` directory with timestamp: `rustnet_YYYY-MM-DD_HH-MM-SS.log`. Development builds add a numeric suffix if that name already exists.
 
 #### `--kubernetes <MODE>` (optional feature) <a id="--kubernetes-mode-optional-feature"></a>
 
@@ -1393,7 +1393,7 @@ Observed Network Health, Observed TCP States, and Application Distribution use t
 
 ## Logging
 
-Logging is **disabled by default**. When enabled with the `--log-level` option, RustNet creates timestamped log files in the `logs/` directory. Each session generates a new log file with the format `rustnet_YYYY-MM-DD_HH-MM-SS.log`.
+Logging is **disabled by default**. When enabled with the `--log-level` option, RustNet creates timestamped log files in the `logs/` directory. Each session generates a new log file with the format `rustnet_YYYY-MM-DD_HH-MM-SS.log`. Development builds add a numeric suffix when that name already exists and require a trusted launch directory on Unix.
 
 ### Log File Contents
 
```

**File**: `USAGE.zh-CN.md` (modified, +2/-2)
```diff
@@ -403,7 +403,7 @@ rustnet --bpf-filter "not port 22"
 - `debug` —— 详细的调试信息
 - `trace` —— 非常详细的输出（包含数据包级详情）
 
-日志文件创建于 `logs/` 目录，带时间戳：`rustnet_YYYY-MM-DD_HH-MM-SS.log`
+日志文件创建于 `logs/` 目录，带时间戳：`rustnet_YYYY-MM-DD_HH-MM-SS.log`。开发版在文件名已存在时添加数字后缀。
 
 #### `--kubernetes <MODE>`（可选 feature）<a id="--kubernetes-mode-optional-feature"></a>
 
@@ -1289,7 +1289,7 @@ Observed Network Health（观测到的网络健康状况）、Observed TCP State
 
 ## 日志<a id="logging"></a>
 
-日志**默认禁用**。使用 `--log-level` 选项启用时，RustNet 在 `logs/` 目录中创建带时间戳的日志文件。每个会话生成一个新日志文件，格式为 `rustnet_YYYY-MM-DD_HH-MM-SS.log`。
+日志**默认禁用**。使用 `--log-level` 选项启用时，RustNet 在 `logs/` 目录中创建带时间戳的日志文件。每个会话生成一个新日志文件，格式为 `rustnet_YYYY-MM-DD_HH-MM-SS.log`。开发版在文件名已存在时添加数字后缀；在 Unix 上还要求使用可信的启动目录。
 
 ### 日志文件内容<a id="log-file-contents"></a>
 
```

---

### Incident Patch 8: `f3e3f333` (2026-10-02)
**Commit Message**: fix: bound QUIC handshake storage and parser lengths (#649)

**File**: `.github/workflows/rust.yml` (modified, +15/-0)
```diff
@@ -35,6 +35,21 @@ env:
   CARGO_TERM_COLOR: always
 
 jobs:
+  parser-32bit:
+    runs-on: ubuntu-latest
+    timeout-minutes: 20
+    steps:
+    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+    - name: Set up 32-bit parser tests
+      run: |
+        sudo apt-get update
+        sudo apt-get install -y gcc-multilib
+        rustup target add i686-unknown-linux-gnu
+    - name: Test 32-bit parsers with debug overflow checks
+      run: cargo test --locked -p rustnet-core --all-features --target i686-unknown-linux-gnu
+    - name: Test 32-bit parsers with release arithmetic
+      run: cargo test --locked -p rustnet-core --all-features --target i686-unknown-linux-gnu --release
+
   build:
     runs-on: ubuntu-latest
     timeout-minutes: 60
```

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -165,6 +165,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Traffic graph stability**: remove hollow outlines and preserve the scroll position
   across sample arrivals; interpolate before rasterizing to prevent contour wobble
 - Keep Activity summary TX/RX labels, numbers, and units aligned as live rates change
+- **QUIC handshake storage**: coalesce bounded CRYPTO ranges in either arrival
+  order, keep assembling through ClientHello for ALPN, and release bytes after
+  extraction. UI/history snapshots retain metadata only. Library consumers must
+  adapt `get_fragments()` from a map reference to an `(offset, slice)` iterator
+- **32-bit parser validation**: test QUIC and SNMP length boundaries in debug
+  and release CI; constrain SNMP nested fields to their declared containers
 - **Short Kubernetes flows**: retain cgroup v2 pod/container identity with eBPF
   socket records after process exit, match both endpoint orientations, and
   evict old records when the map fills.
```

**File**: `QUIC.ja.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# QUIC 検査
+
+[English](QUIC.md) | [简体中文](QUIC.zh-CN.md) | [日本語](QUIC.ja.md)
+
+**未リリース：** RustNet はクライアント Initial の CRYPTO ストリームを組み立て、
+ClientHello から SNI、ALPN、TLS バージョンを抽出します。後続断片に ALPN があるため、
+SNI を得た後も組み立てを続けます。
+
+検査範囲はオフセット 0 から 65,535、最大 256 個の非連続範囲です。隣接範囲は結合し、
+逆順到着にも対応します。重複再送は不足するバイトを追加し、重複位置は最初の値を
+保持します。空断片と範囲外オフセットは無視または拒否します。過大または過度に疎な
+ハンドシェイクでは、メタデータを部分的にしか取得できない場合があります。
+
+ClientHello の検査完了、64 KiB 範囲の充足、または接続終了状態のマージ後に
+ハンドシェイクのバイトを解放します。それ以外の不完全なハンドシェイクは接続の
+有効期限まで上限内で保持します。UI と履歴スナップショットは抽出済みメタデータのみを
+保持し、CRYPTO バッファをコピーしません。STREAM のアプリケーションバイトは
+読み飛ばします。生のキャプチャ出力にはパケットデータが含まれます。
+
+ライブラリ利用側では、`CryptoFrameReassembler::get_fragments()` が借用した
+`BTreeMap` の代わりに `(u64, &[u8])` イテレータを返すようになります。リング状の
+キューは実際のオフセットを持つ隣接 2 スライスに分かれる場合があります。
+`add_fragment()` と `get_contiguous_data()` のシグネチャは変わりません。
+
+QUIC の長さ変換とオフセット演算は検査付きです。SNMP BER の外側と入れ子の長さも
+宣言されたコンテナ内に制限します。回帰テストは重複、逆順、後続 ALPN、バッファ解放、
+debug・release CI での 32 ビット長境界を検査します。
```

**File**: `QUIC.md` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+# QUIC inspection
+
+[English](QUIC.md) | [简体中文](QUIC.zh-CN.md) | [日本語](QUIC.ja.md)
+
+**Unreleased:** RustNet assembles the client Initial CRYPTO stream to extract
+ClientHello metadata, including SNI, ALPN, and TLS version. Finding SNI alone
+does not stop assembly because later fragments can carry ALPN.
+
+The inspection window covers offsets 0 through 65,535, with at most 256
+disjoint ranges. Adjacent ranges coalesce, including reverse-order arrival.
+Overlapping retransmissions add missing bytes and preserve the first observed
+value where bytes overlap. Empty fragments and offsets outside the window are
+ignored or rejected. Oversized and excessively sparse handshakes may yield
+only partial metadata.
+
+Handshake bytes are released after the complete ClientHello is inspected, its
+64 KiB window is filled, or connection closure is merged. Incomplete handshakes
+otherwise remain bounded until the live connection expires. UI and history
+snapshots retain extracted metadata without copying CRYPTO buffers. STREAM
+application bytes are skipped. Raw capture exports still contain packet data.
+
+For library consumers, `CryptoFrameReassembler::get_fragments()` now returns an
+iterator of `(u64, &[u8])` instead of a borrowed `BTreeMap`. A wrapped deque can
+yield two adjacent slices with their actual stream offsets.
+`add_fragment()` and `get_contiguous_data()` retain their signatures.
+
+QUIC wire lengths use checked conversions and offset arithmetic. SNMP BER
+outer and nested lengths are also bounded by their declared containers.
+Regression tests cover overlaps, reverse order, late ALPN, buffer release, and
+32-bit length boundaries in debug and release CI.
```

**File**: `QUIC.zh-CN.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# QUIC 检查
+
+[English](QUIC.md) | [简体中文](QUIC.zh-CN.md) | [日本語](QUIC.ja.md)
+
+**未发布：** RustNet 组装客户端 Initial CRYPTO 流，提取 ClientHello 中的 SNI、ALPN
+和 TLS 版本。找到 SNI 后仍继续组装，因为后续分片可能携带 ALPN。
+
+检查窗口覆盖偏移 0 至 65,535，最多保留 256 个不连续区间。相邻区间会合并，
+也支持逆序到达。重叠重传补充缺失字节，重叠位置保留首次观察到的值。
+空分片和窗口外偏移会被忽略或拒绝。超大或过度稀疏的握手可能只能提取部分元数据。
+
+完整 ClientHello 检查完成、64 KiB 窗口填满或合并连接关闭状态后，释放握手字节。
+其余不完整握手在活动连接过期前保持有界缓冲。UI 和历史快照仅保留提取的元数据，
+不复制 CRYPTO 缓冲。STREAM 应用字节会跳过。原始抓包导出仍包含报文数据。
+
+库调用方需要注意：`CryptoFrameReassembler::get_fragments()` 现在返回
+`(u64, &[u8])` 迭代器，替代借用的 `BTreeMap`。环绕的双端队列可能返回两个
+相邻切片，各自带实际流偏移。`add_fragment()` 和 `get_contiguous_data()` 签名不变。
+
+QUIC 线上长度使用检查转换和偏移运算。SNMP BER 外层及嵌套长度也限制在声明的容器中。
+回归测试覆盖重叠、逆序、后续 ALPN、缓冲释放，以及 debug 和 release CI 中的
+32 位长度边界。
```

**File**: `README.ja.md` (modified, +2/-0)
```diff
@@ -84,6 +84,8 @@ macOS で PKTAP を使用するには `sudo` が必要です。BPF へのアク
 
 ## ドキュメント
 
+- [QUIC 検査](QUIC.ja.md)：ハンドシェイク保持とライブラリ互換性（未リリース）。
+
 以下の詳細ガイドは英語版です。各ガイドの先頭から簡体字中国語版にも移動できます。
 
 - [インストール](INSTALL.md): 対応プラットフォーム、権限設定、トラブルシューティング
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ Press `/` to filter connections, `Enter` to inspect one, and `q` to quit. See th
 
 ## Documentation
 
+- [QUIC inspection](QUIC.md): handshake storage and library compatibility (unreleased).
 - [Installation](INSTALL.md): platforms, permissions, and troubleshooting
 - [Usage](USAGE.md): controls, filtering, automation, and capture exports
 - [Terminal layout and appearance (development)](TUI.md)
```

**File**: `README.zh-CN.md` (modified, +1/-0)
```diff
@@ -84,6 +84,7 @@ rustnet
 
 ## 文档
 
+- [QUIC 检查](QUIC.zh-CN.md)：握手存储及库兼容性（未发布）。
 - [安装](INSTALL.zh-CN.md)：平台支持、权限配置与故障排查
 - [使用](USAGE.zh-CN.md)：操作、过滤、自动化与抓包导出
 - [终端布局与外观（开发版本）](TUI.zh-CN.md)
```

---

### Incident Patch 9: `a35aacb1` (2026-10-02)
**Commit Message**: fix: improve TUI layout and traffic graphs (#647)

**File**: `CHANGELOG.md` (modified, +27/-2)
```diff
@@ -8,6 +8,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [Unreleased]
 
 ### Added
+- **Traffic surge visibility**: held auto scales, shared/independent and log modes,
+  scale lock with overflow markers, rounded traffic waves, and two-second rate averages
+  in Graph/Details and Activity sorting
 - **Retained Linux process identity**: eBPF preserves bounded executable paths
   and immediate-parent metadata after exit or exec, and checks task birth times
   before extending ancestry through procfs (#640)
@@ -59,6 +62,20 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   the selected process group
 
 ### Changed
+- Restore gradient traffic waves with three-sample smoothing and independent RX/TX
+  scales by default; `s` switches Graph and wide Details to a shared scale.
+  Current rates and peak labels retain raw measurements. Details gains taller
+  plots, aligned totals, and clear messages when no live history is available.
+- Smooth scrolling in Overview, Graph, and Details at 20 fps, preserving the
+  500 ms sampling interval. Activity, DNS, and Graph bars animate value changes
+  over 250 ms; numeric readings update immediately and settled bars redraw slowly.
+- Restore Activity's application and interface traffic-share charts on roomy
+  terminals, plus capture coverage bars, while keeping the table and drill-down.
+  Share charts use 60-second totals and live interface rates stay in fixed columns.
+- Improve TUI readability with wrapped Host records on narrow terminals,
+  Unicode cell-aware truncation, consistent headings and gutters, and labeled
+  RX/TX chart scales. TCP state rows can scroll; Help shadows are opt-in
+  through `[ui] popup_shadow = true`
 - Move DNS-inferred hostnames from Remote to App and their Details metadata
   into the Application card, retaining the `~` marker and SNI / Host precedence (#638)
 - **Documentation accuracy**: Align English, Chinese, and Japanese feature
@@ -143,6 +160,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- **Traffic graph stability**: remove hollow outlines and preserve the scroll position
+  across sample arrivals; interpolate before rasterizing to prevent contour wobble
+- Keep Activity summary TX/RX labels, numbers, and units aligned as live rates change
 - **Short Kubernetes flows**: retain cgroup v2 pod/container identity with eBPF
   socket records after process exit, match both endpoint orientations, and
   evict old records when the map fills.
@@ -152,8 +172,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   languages; link v1.6.0 docs and add release checks for availability notes (#620)
 - **Connection viewport**: paging, scrollbars, and mouse targets track the current
   layout immediately after resizing, including filters and two-row capture errors.
-- **Details Mouse Navigation**: the scroll wheel now selects the previous or
-  next connection, matching Overview. Use `Ctrl+D` / `Ctrl+U` to scroll long records
+- **Details information pages**: replace overflowing information scrollbars with
+  sections and numbered pages reached with v/V. Keep j/k, paging, and the wheel
+  for connection navigation; retain Traffic plots when they fit
+- **Details layout**: use the terminal's full width and anchor RX/TX plots
+  above the footer with a proportional height capped at 18 rows
+- **TUI alignment**: align Activity pane headings, expand Host interface columns,
+  and size Graph process names and rows to the available space
 - **Required UID Drop**: abort startup before packet-processing workers when a
   requested root UID/GID drop fails, including in best-effort mode
 - **Windows Connection History**: connections that reuse a tuple with the
```

**File**: `README.ja.md` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ macOS で PKTAP を使用するには `sudo` が必要です。BPF へのアク
 
 - [インストール](INSTALL.md): 対応プラットフォーム、権限設定、トラブルシューティング
 - [使用方法](USAGE.md): 操作、フィルター、自動化、キャプチャの出力
+- [ターミナルのレイアウトと外観（開発版）](TUI.ja.md)
 - [セキュリティ](SECURITY.md): サンドボックスと権限管理
 - [アーキテクチャ](ARCHITECTURE.md): プラットフォーム別の実装と性能
 - [Kubernetes とコンテナ](KUBERNETES.ja.md): 所有者特定とキャプチャの出力
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ Press `/` to filter connections, `Enter` to inspect one, and `q` to quit. See th
 
 - [Installation](INSTALL.md): platforms, permissions, and troubleshooting
 - [Usage](USAGE.md): controls, filtering, automation, and capture exports
+- [Terminal layout and appearance (development)](TUI.md)
 - [Security](SECURITY.md): sandboxing and privilege management
 - [Architecture](ARCHITECTURE.md): platform backends and performance
 - [Kubernetes and containers](KUBERNETES.md): attribution and capture exports
```

**File**: `README.zh-CN.md` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ rustnet
 
 - [安装](INSTALL.zh-CN.md)：平台支持、权限配置与故障排查
 - [使用](USAGE.zh-CN.md)：操作、过滤、自动化与抓包导出
+- [终端布局与外观（开发版本）](TUI.zh-CN.md)
 - [安全](SECURITY.zh-CN.md)：沙箱与权限管理
 - [架构](ARCHITECTURE.zh-CN.md)：各平台后端与性能
 - [Kubernetes 与容器](KUBERNETES.zh-CN.md)：归属识别与抓包导出
```

**File**: `TUI.ja.md` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+<p align="center"><a href="TUI.md">English</a> | <a href="TUI.zh-CN.md">简体中文</a> | <strong>日本語</strong></p>
+
+# ターミナルのレイアウトと外観
+
+> 以下は未リリースの変更で、v1.6.0 より後の開発版に適用されます。
+
+五つのタブはターミナルの利用可能な幅を使い、共通のセクション見出しと隣接する
+パネル間の一定の間隔を保ちます。スクロール可能な表は右端に間隔とスクロールバー用の
+二つのセルを確保します。Host の Interfaces 表は内容に合わせて列幅を調整し、
+インターフェース名の列が残りの幅を使います。Activity のアプリケーションと Capture の
+見出しは速度の要約の下に揃います。Graph のプロセス一覧は端末のセル幅に合わせて名前を
+表示し、列見出しの下の利用可能な行をすべて使います。
+
+## Host の可変レイアウト
+
+Sockets と Interfaces は広いターミナルでは表を使います。120 列未満では、
+アドレス、プロセス名、転送速度の桁、カウンターを読めるように、折り返し可能な
+レコード表示に切り替わります。広い表でも長い値が収まらない場合はレコード表示を
+使います。高さが足りないソケット表示もレコード形式になり、すべての状態と
+エンドポイントにアクセスできます。コンパクト表示でもフィールドは省略しません。
+
+`j` / `k`、矢印キー、Page Up / Page Down、`g` / `G`、マウスホイールで
+スクロールできます。画面に収まらない場合はフッターに操作ヒントが表示されます。
+Host の `v` / Shift+`v` は Sockets、Interfaces、DNS の切り替えに使います。
+
+文字列の省略はターミナルのセル幅で計算し、結合文字や絵文字の並びを分割しません。
+Details の接続一覧、見出し、情報ペイン、揃えた RX/TX グラフは端末の全幅を使います。
+
+Details はすべての情報カードと転送グラフが収まる場合だけ完全なダッシュボードを
+表示します。それ以外は Connection、Network、Process、Application、Health、Traffic
+のセクションと共通の選択バーを使います。`v` で次のページまたはセクションへ、
+Shift+`v` で前へ移動し、セクション名のクリックでその先頭ページを開きます。
+高さが足りない場合、長いセクションを番号付きのページに分けます。情報の
+スクロールバーは使いません。`j` / `k`、上下矢印、Page Up/Down（または Ctrl+B/F）、
+マウスホイールは接続の切り替えに使います。接続を変えてもセクションを維持し、
+その先頭ページに戻ります。余裕があれば上部の接続一覧を表示します。Traffic は
+並列 RX/TX グラフが収まれば表示し、小さい端末では統計をページに分けます。
+サイズ変更後もセクションを保持し、再び狭くするとそのビューに戻ります。
+
+Activity の TX/RX サマリーはラベルと単位を固定列に配置し、数値を右揃えにします。
+転送速度や単位が変わっても、表示位置は動きません。
+幅と高さに余裕がある場合、アプリケーション表の選択と詳細表示を維持したまま、
+直近 60 秒のアプリケーション別とインターフェース別の通信量の割合を下部に表示します。
+`d` で両方のグラフを TX/RX に切り替えます。インターフェースの棒は全インターフェースの
+カウンター合計に対する割合で、同じ通信を複数のインターフェースで数える場合があります。
+現在の転送速度は固定列に表示し、棒は変動が緩やかな 60 秒の合計を使います。
+Capture のカバレッジにも TX/RX の棒を表示します。小さい画面と詳細ビューでは表や
+選択中のレコードを優先します。インターフェースの全一覧は引き続き Host で確認できます。
+
+## 転送グラフ
+
+Graph と Details は縦方向のグラデーション付きの連続した塗りつぶし波形を使います。
+三つのサンプルの移動平均で単発の尖ったピークを和らげ、サンプル座標で補間して
+輪郭を丸めるため、スクロールで形が変わりません。各端末列で平滑化した曲線の
+最高点を保持し、離れた輪郭や塗りつぶしの穴を防ぎます。見出しは平滑化した表示で
+あることを示します。RX/TX は既定でラベル付きの独立した線形スケールを使います。
+Graph の転送ビュー、完全な Details ダッシュボード、またはその Traffic セクションで、次のキーを使えます。
+
+- `s` は RX/TX の独立スケールと共通スケールを切り替えます。
+- `z` は線形と対数を切り替えます。対数表示では大きなバーストと小さな通信量を同時に確認できます。見出しと軸ラベルにスケールを示します。
+- `l` は現在の表示範囲を固定または解除します。データはスクロールを続けます。上端の `▲` は固定上限を超えた値を示し、ピークの数値は正確に表示します。
+
+固定範囲を含む設定は Graph と Details で共有されます。単位はバイト毎秒で、
+K/M/G は 1024 の累乗です。余裕がある場合、見出しに生の現在値、履歴内のピーク、
+時間で重み付けした `2s avg` を表示します。起動直後は観測済みの区間だけを使い、
+二つのサンプルが揃ってから平均値を表示します。
+自動スケールは平滑化した履歴に合わせて丸めた上限を使い、古いピークが履歴から
+消えた後、五秒待ってから徐々に縮小します。大きな通信量が続いて 60 秒の履歴に残る間は線形グラフが圧縮される
+場合があります。対数モードでは履歴を切り捨てずに小さな通信量を確認できます。
+
+完全な Details ダッシュボードでは、並列 RX/TX グラフをフッターの上に固定します。
+Traffic パネルは内容の高さの約三分の一を使い、見出しと統計を含めて 7–18 行に制限します。
+すべての情報カードの表示を優先し、必要に応じて縮小します。独立した Traffic セクションは
+利用可能な高さを使います。合計値は現在値と
+ピークのすぐ下の同じ行に配置し、平均値が収まれば横に表示します。履歴を収集中、
+または接続が終了した場合は、動く単一の点の代わりに状態メッセージを表示します。
+
+Activity では `s` で `2s Avg TX/RX` を選ぶと短時間の平均転送速度で並べ替えます。
+速度列は `2s Avg/s` となり、並べ替えに使う平均値を表示します。単発のバーストに
+よる並び順の変動を抑え、他の並べ替えモードの意味は変わりません。
+
+Overview、Graph、Details でスクロールするグラフが表示されている間は、毎秒約 20 回
+描画し、既存の 500 ミリ秒のサンプル間を経過時間に応じて連続的にスクロールします。
+サンプル到着時に位置を引き継ぎ、タイミングの揺れによる履歴の飛びを防ぎます。
+Activity の割合とカバレッジ、Host の DNS 応答時間、Graph の健全性、プロトコル、
+TCP 状態の棒は、250 ミリ秒で新しい値へ滑らかに移行します。数値と状態の色は即座に
+更新します。並べ替えてもアニメーションは同じ指標を追跡し、新規表示、サイズ変更、
+再表示された棒は実際の値を即座に表示します。変化のない棒、スクロールグラフのない
+ビュー、Help は低い描画頻度を使います。最小の移動幅はセル解像度に制約されます。
+
+Overview の小さな波形と接続ライフサイクルのミニグラフは従来の表示を維持します。
+Graph の Health で TCP 状態が収まらない場合は、上記のキーやホイールでスクロール
+できます。
+
+## ヘルプの影を有効にする
+
+[使用ガイド（英語）](USAGE.md)で説明されている任意の設定ファイルに追加します。
+
+```toml
+[ui]
+popup_shadow = true
+```
+
+既定値は `false` です。影はヘルプの横にあるセルを暗くし、元の文字を置き換えません。
+静的な効果のため、アニメーション用のタイマーは追加しません。`NO_COLOR` または
+`--no-color` が指定されている場合は、設定が有効でも影を表示しません。
```

**File**: `TUI.md` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+<p align="center"><strong>English</strong> | <a href="TUI.zh-CN.md">简体中文</a> | <a href="TUI.ja.md">日本語</a></p>
+
+# Terminal layout and appearance
+
+> These changes are unreleased and describe development builds after v1.6.0.
+
+All five tabs use the available terminal width, with shared section headings and
+consistent gaps between adjacent panes. Scrolling tables reserve two cells at the
+right for the gap and scrollbar. Host's Interfaces table sizes its columns to the
+contents and lets the interface-name column use the remaining width.
+Activity's application and Capture headings align below the rate summary.
+Graph's process list fits names by terminal-cell width and uses every available
+row below its column headings.
+
+## Responsive Host views
+
+Sockets and Interfaces use tables on wide terminals. Below 120 columns, they
+switch to wrapped records so addresses, process names, rate digits, and counters
+remain readable. Records are also used when unusually long values cannot fit a
+wide table. Short socket views also use records to keep every state and endpoint
+reachable. No fields are dropped from the compact records.
+
+Use `j` / `k`, arrow keys, Page Up / Page Down, `g` / `G`, or the mouse wheel to
+scroll. The footer shows a scroll hint when content extends beyond the viewport.
+Host's `v` / Shift+`v` shortcuts still select Sockets, Interfaces, and DNS.
+
+Text truncation measures terminal cells and preserves combining characters and
+emoji sequences. Details uses the terminal's full width for its connection
+strip, headings, information panes, and aligned RX/TX charts.
+
+Details shows the full dashboard only when every information card and the
+traffic plots fit. Otherwise it shows Connection, Network, Process, Application,
+Health, and Traffic sections with a shared selector. Press `v` for the next page
+or section and Shift+`v` to go back; click a section name to open its first page.
+Very short terminals split long sections into numbered pages. Details has no
+information scrollbar. `j` / `k`, the up/down arrows, Page Up/Down (or Ctrl+B/F),
+and the mouse wheel keep navigating connections. Changing connections preserves
+the selected section and starts at its first page. The top connection strip
+remains visible when there is room. Traffic retains its paired RX/TX plots where
+they fit and uses paged statistics on smaller terminals. Resizing preserves the
+selected section, so reducing the terminal restores that view.
+
+Activity keeps TX/RX summary labels and units in fixed columns, with right-aligned
+numbers. Changing rates or switching units no longer shifts the readouts.
+On wide, tall terminals, the application table keeps its selection and drill-down
+and gains two visual summaries below it: application traffic share and interface
+traffic share over the last 60 seconds. Press `d` to switch both between TX and
+RX. Interface bars compare each interface with the combined interface counters;
+these can count the same traffic on multiple interfaces. Live interface rates
+use fixed columns, while the bars follow the steadier 60-second totals. Capture
+coverage also has TX/RX bars. Smaller terminals and detail views prioritize the
+table or selected record; full interface inventory remains available in Host.
+
+## Traffic charts
+
+Graph and Details use one continuous filled wave with a vertical gradient.
+A three-sample moving average softens isolated spikes, and interpolation rounds
+the contour in sample coordinates so scrolling does not reshape it. Each column
+retains the highest point of that smoothed curve, without a detached outline or
+holes in the fill. Headings identify the smoothed presentation. RX and TX use
+independent, labeled linear scales by default. In Graph's traffic view, the full Details dashboard, or its Traffic section:
+
+- `s` switches independent/shared RX/TX scales for magnitude comparisons.
+- `z` switches linear/logarithmic heights. Log mode keeps small background traffic
+  visible alongside large surges; the heading and axis labels identify the scale.
+- `l` locks/unlocks the currently displayed bounds. Data keeps scrolling. A `▲`
+  at the top marks values above the locked ceiling; the peak readout stays exact.
+
+These settings, including locked bounds, carry between Graph and Details. Units
+are bytes per second (K/M/G use powers of 1024). Headers show the raw current rate,
+window peak, and a time-weighted `2s avg` where space permits. During startup the
+average uses only observed intervals and appears after two samples.
+Auto scales follow the smoothed history, use rounded bounds, and wait five
+seconds before beginning a gradual shrink when older peaks leave the history.
+A sustained surge can still compress a linear chart until it leaves the
+60-second window; log mode exposes smaller rates without clipping that history.
+
+The full Details dashboard anchors its paired RX/TX plots above the footer.
+The Traffic panel uses about 
```

**File**: `TUI.zh-CN.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+<p align="center"><a href="TUI.md">English</a> | <strong>简体中文</strong> | <a href="TUI.ja.md">日本語</a></p>
+
+# 终端布局与外观
+
+> 以下变更尚未发布，适用于 v1.6.0 之后的开发版本。
+
+五个标签页都使用终端的可用宽度，采用共用区块标题，并在相邻面板之间保留一致的间距。
+可滚动表格在右侧预留两个单元格作为间隙和滚动条。Host 的 Interfaces 表格按内容调整
+列宽，接口名称列使用剩余宽度。Activity 的应用表格和 Capture 标题在速率汇总下方对齐。
+Graph 的进程列表按终端单元格宽度显示名称，并使用列标题下方所有可用行。
+
+## 自适应 Host 视图
+
+Sockets 和 Interfaces 在宽终端中使用表格。少于 120 列时，改用自动换行的记录，
+保留完整地址、进程名、速率数字和计数器。即使终端较宽，过长的内容无法放入表格时也会
+使用记录布局。高度不足的套接字视图也使用记录布局，确保所有状态和端点均可访问。
+紧凑记录不会省略字段。
+
+使用 `j` / `k`、方向键、Page Up / Page Down、`g` / `G` 或鼠标滚轮滚动。
+内容超出视口时，底部显示滚动提示。Host 中仍用 `v` / Shift+`v` 切换
+Sockets、Interfaces 和 DNS。
+
+文本截断按终端单元格宽度计算，保留组合字符和完整 emoji 序列。
+Details 的连接列表、标题、信息面板和对齐的 RX/TX 图使用终端的完整宽度。
+
+Details 仅在所有信息卡片和流量图均能完整显示时使用完整仪表板，否则显示
+Connection、Network、Process、Application、Health 和 Traffic 区块及共用选择栏。
+按 `v` 查看下一页或下一区块，Shift+`v` 返回；点击区块名称打开其第一页。
+高度不足时，较长的区块分为带页码的页面，Details 不使用信息滚动条。
+`j` / `k`、上下方向键、Page Up/Down（或 Ctrl+B/F）和鼠标滚轮仍用于切换连接。
+切换连接时保留所选区块，并回到该区块的第一页。空间允许时保留顶部连接列表。
+Traffic 在放得下时保留并排的 RX/TX 图，小终端使用分页统计。调整终端大小会保留
+所选区块，因此再次缩小时恢复该视图。
+
+Activity 的 TX/RX 汇总标签和单位使用固定列，数字右对齐。速率或单位变化时，
+读数位置保持稳定。
+在宽度和高度充足的终端中，应用表格保留选择和详情导航，并在下方显示最近 60 秒的
+应用流量占比和接口流量占比。按 `d` 同时切换两个图表的 TX/RX 方向。
+接口条形图以所有接口计数器的总和为基准，同一流量可能在多个接口上被重复计数。
+实时接口速率使用固定列，条形图则使用更平稳的 60 秒总量。Capture 覆盖率也显示
+TX/RX 条形图。小终端和详情视图优先显示表格或所选记录；完整接口列表仍位于 Host。
+
+## 流量图
+
+Graph 和 Details 使用带垂直渐变的单一连续填充波形。
+三个采样的移动平均柔化孤立尖峰，插值在采样坐标中修圆轮廓，滚动不会改变曲线形状。
+每列保留平滑曲线的最高点，且不会出现分离的轮廓或填充空洞。标题注明图形经过平滑。
+RX/TX 默认使用带标签的独立线性刻度。在 Graph 流量视图、完整 Details 仪表板或其 Traffic 区块中：
+
+- `s` 切换独立或共享 RX/TX 刻度，以比较大小。
+- `z` 切换线性或对数高度。对数模式让小流量与大突发同时可见，标题和轴标签显示刻度。
+- `l` 锁定或解锁当前显示的范围。数据继续滚动；顶部的 `▲` 表示超出锁定上限，峰值读数保持准确。
+
+这些设置（包括锁定范围）在 Graph 和 Details 之间共享。单位为字节每秒，K/M/G 按
+1024 的幂计算。空间允许时，标题显示原始当前速率、窗口峰值和按时间加权的 `2s avg`。
+启动时只使用已观测的时间区间，至少有两个采样后才显示平均值。
+自动刻度跟随平滑历史，使用整齐的分级上限；旧峰值移出历史后等待五秒，再逐渐缩小。
+持续的大流量在 60 秒窗口内仍可能压缩线性图，对数模式可显示小流量而无需截断历史。
+
+完整 Details 仪表板将并排 RX/TX 图固定在底部状态栏上方。Traffic 面板约占内容高度的
+三分之一，包含标题和统计行时限制为 7–18 行，并优先保证所有信息卡片完整显示。
+独立的 Traffic 区块仍使用可用高度。总量始终位于当前值和峰值下方
+同一行；平均值在放得下时显示于旁边。尚无历史或连接已关闭时，图表显示状态提示，
+而不是移动的单个数据点。
+
+Activity 中按 `s` 循环到 `2s Avg TX/RX` 可按短时平均速率排序。
+此时速率列显示为 `2s Avg/s`，数值与排序依据一致，以减轻单次突发对排序的影响。
+其他排序模式保持原有含义。
+
+Overview、Graph 和 Details 中可见的滚动图表每秒重绘约 20 次，在现有的 500 毫秒
+采样间隔内按实际经过的时间连续滚动。新采样到达时保留滚动位置，避免时序抖动使历史跳动。Activity 的占比和覆盖率、Host 的 DNS 延迟，
+以及 Graph 的健康、协议和 TCP 状态条形图在 250 毫秒内平滑过渡到新值。
+数值和状态颜色立即更新。排序时动画跟随指标身份；新出现、尺寸变化或重新显示的
+条形图立即显示实际值。稳定的条形图、没有滚动图表的视图以及 Help 使用较低的
+重绘频率。终端单元格分辨率仍限制最小可见移动幅度。
+
+Overview 的小型活动波形和
+连接生命周期迷你图保留紧凑显示方式。Graph 的 Health 区块中，TCP 状态放不下时，
+可以用上述按键和滚轮滚动查看。
+
+## 可选帮助阴影
+
+在[使用指南](USAGE.zh-CN.md)所述的可选配置文件中添加：
+
+```toml
+[ui]
+popup_shadow = true
+```
+
+默认为 `false`。阴影使帮助窗口旁边的单元格变暗，但不会替换底层文字。
+它是静态效果，不增加动画计时器。设置 `NO_COLOR` 或使用 `--no-color` 时，即使配置
+启用也不会显示阴影。
```

**File**: `USAGE.md` (modified, +18/-6)
```diff
@@ -8,6 +8,7 @@ This guide covers detailed usage of RustNet, including command-line options, key
 
 ## Table of Contents
 
+- [Terminal layout and appearance (development)](TUI.md)
 - [Running RustNet](#running-rustnet)
 - [Command-line Options](#command-line-options)
 - [Headless Mode](#headless-mode)
@@ -479,11 +480,15 @@ information retains its section dividers and scrolls with `j` / `k`,
 Page Up/Down, or the mouse wheel. Escape returns to Connections without changing the selected connection or filter.
 Wider terminals retain the connection table and System sidebar, toggled with `i`.
 
-Details shows one section below 100 columns or 24 content rows (27 terminal
-rows without an open filter or expanded error banner). Choose Connection,
-Network, Process, Application, Health, or Traffic. `j` / `k` switch connections;
-Ctrl+D/U or the mouse wheel scrolls the information. Larger terminals retain
-the full dashboard and scroll its information panes together.
+Details switches to section pages below 100 columns or whenever its complete
+information dashboard and traffic plots do not fit. Choose Connection, Network,
+Process, Application, Health, or Traffic with `v` / Shift+`v` or a section click.
+Long sections on very short terminals have numbered pages, reached with the same
+keys. `j` / `k` and the mouse wheel switch connections. The selected section
+survives connection changes and resizing. Larger terminals show all cards and
+traffic plots together, without an information scrollbar. The dashboard spans
+the terminal's full width. Its RX/TX panel sits above the footer, using about one
+third of the content height, capped at 18 rows including the heading and statistics.
 
 Graph shows Traffic, Health, or Distribution below 100 columns or 32 content
 rows (35 terminal rows without an open filter or expanded error banner).
@@ -575,9 +580,16 @@ RustNet has full mouse support. Mouse capture is enabled automatically — all i
 | Action | Effect |
 |--------|--------|
 | **Scroll wheel** | Show the previous/next connection, skipping group headers |
+| **Click** a connection in the top strip | Select that connection |
 | **Click** on any field line | Copy the field value to the system clipboard |
 
-Use `Ctrl+D` / `Ctrl+U` to scroll long connection information panes.
+In development builds, `v` / Shift+`v` moves through information pages and
+sections when the complete dashboard does not fit; clicking a section opens its
+first page. Details uses no information scrollbar. `j` / `k`, up/down arrows,
+Page Up/Down (or Ctrl+B/F), and the mouse wheel navigate connections, skipping
+group headers. `g` / `G` select the first/last connection. Changing connections
+preserves the section and opens its first page. The Traffic section keeps its
+RX/TX plots when space permits, otherwise it displays paged statistics.
 
 Clicking a field copies just the value (not the label). For example, clicking the "Remote Address: 142.250.80.46:443" line copies `142.250.80.46:443` to your clipboard. A confirmation message appears in the status bar for 3 seconds.
 
```

---

### Incident Patch 10: `f5c5fc3f` (2026-10-01)
**Commit Message**: Update OUI vendor database (#646)

Co-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>



---

### Incident Patch 11: `84a8f83f` (2026-09-27)
**Commit Message**: fix: show DNS attribution in application displays (#638)

**File**: `ARCHITECTURE.md` (modified, +1/-1)
```diff
@@ -188,7 +188,7 @@ Cache properties:
 
 **Race safety**: `attribute()` enrolls the connection in the pending index, then re-checks the cache. If a concurrent `record_and_drain_pending()` for the same IP landed between the lookup and the enrollment, the re-check tags the connection; the now-stale enrollment is harmless and is removed by `forget_pending` when the connection is cleaned up or by the pending prune after the freshness window.
 
-**Distinct from `network::dns::DnsResolver`**: that component performs *reverse* DNS (IP to PTR) via the system resolver; the attribution cache is *forward* DNS (domain to IPs) harvested from observed packets. The two are complementary and the UI prefers the attribution cache when both have a name.
+**Distinct from `network::dns::DnsResolver`**: that component performs *reverse* DNS (IP to PTR) via the system resolver; the attribution cache is *forward* DNS (domain to IPs) harvested from observed packets. The two are complementary. In development builds, the UI shows reverse DNS in Remote and DNS attribution in App, with SNI / Host taking precedence over inferred names.
 
 CNAME chains need no separate map: the DNS DPI parser records the original *question* name, and the answer's A/AAAA records map directly to it. Capturing at the wire sees fewer signals than an eBPF socket-level approach (no app-to-stub traffic on `lo` unless captured, no D-Bus resolutions, no DoH/DoT plaintext); this is a known limitation.
 
```

**File**: `ARCHITECTURE.zh-CN.md` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ flowchart LR
 
 **竞争安全**：`attribute()` 先把连接登记到待归因索引，然后重查缓存。如果同一 IP 的并发 `record_and_drain_pending()` 恰好落在查找和登记之间，重查会为连接打上标签；此时已过时的登记是无害的，会在连接被清理时由 `forget_pending` 移除，或在新鲜窗口过后由待归因清理移除。
 
-**与 `network::dns::DnsResolver` 的区别**：后者通过系统解析器执行*反向* DNS（IP 到 PTR）；归因缓存则是从观测到的数据包中收集的*正向* DNS（域名到 IP）。两者互补，当两边都有名字时 UI 优先使用归因缓存。
+**与 `network::dns::DnsResolver` 的区别**：后者通过系统解析器执行*反向* DNS（IP 到 PTR）；归因缓存则是从观测到的数据包中收集的*正向* DNS（域名到 IP）。两者互补。在开发版本中，UI 在 Remote 中显示反向 DNS，在 App 中显示 DNS 归因；SNI / Host 名称优先于推断名称。
 
 CNAME 链不需要单独的映射：DNS DPI 解析器记录的是原始*问题*名称，应答中的 A/AAAA 记录直接映射到它。在线路层捕获看到的信号比 eBPF 套接字层方案少（除非同时捕获 `lo`，否则看不到应用到 stub 的流量；看不到 D-Bus 解析；看不到 DoH/DoT 明文）；这是已知限制。
 
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -59,6 +59,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   the selected process group
 
 ### Changed
+- Move DNS-inferred hostnames from Remote to App and their Details metadata
+  into the Application card, retaining the `~` marker and SNI / Host precedence (#638)
 - **Documentation accuracy**: Align English, Chinese, and Japanese feature
   claims, installation and profiling steps, sandbox limits, and the roadmap
   with the current implementation.
```

**File**: `USAGE.md` (modified, +3/-5)
```diff
@@ -1235,13 +1235,11 @@ RustNet uses intelligent timeout management to automatically clean up inactive c
 
 ### Hostname Display
 
-Hostnames extracted from the connection itself (TLS SNI from HTTPS or QUIC, the HTTP `Host:` header) are shown in the **App** column. The name in the **Remote** column is chosen by priority (toggle hostnames with the `d` key):
+Hostnames extracted from the connection itself (TLS SNI from HTTPS or QUIC, the HTTP `Host:` header) are shown in the **App** column. In development builds, DNS-attributed names also appear in **App**, for example `TCP·HTTPS (~example.com)` or `UDP (~example.com)` when no application protocol is detected. They appear when no SNI / Host name is available and a DNS resolution to the remote IP was observed within the last **10 seconds**. Compact App columns omit hostname metadata.
 
-1. **DNS-attributed hostname**: rendered as `~name:port` in a dim color when the connection carries no SNI / Host header but a DNS resolution to this IP was observed within the last **10 seconds**
-2. **Reverse DNS** (system resolver, unless disabled with `--no-resolve-dns`)
-3. **Raw IP address**
+The **Remote** column shows reverse DNS (unless disabled with `--no-resolve-dns`), falling back to the raw IP address. The `d` key toggles reverse-DNS names without hiding application names.
 
-The leading `~` glyph signals that the hostname was *inferred* from a DNS response seen on the wire, not extracted from the connection. This is most useful for QUIC sessions after the handshake (where SNI is encrypted) and for plain TCP/UDP connections that carry no hostname-bearing payload. Attribution needs no active lookups, so it works even with `--no-resolve-dns`. The Details tab shows a separate **Attributed Name** row with the full inferred hostname, plus an **Attributed Via** row with the source and observation age (`Captured DNS, 5s ago`) so the provenance is explicit. Attributed names are searchable like any other hostname: both the `sni:` / `host:` / `hostname:` keyword filter and the free-text search match them.
+The leading `~` glyph signals that the hostname was *inferred* from a DNS response seen on the wire, not extracted from the connection. This is most useful for QUIC sessions after the handshake (where SNI is encrypted) and for plain TCP/UDP connections that carry no hostname-bearing payload. Attribution needs no active lookups, so it works even with `--no-resolve-dns`. In development builds, the Details tab’s **Application** card shows a separate **Attributed Name** row with the full inferred hostname, plus an **Attributed Via** row with the source and observation age (`Captured DNS, 5s ago`) so the provenance is explicit. Attributed names are searchable like any other hostname: both the `sni:` / `host:` / `hostname:` keyword filter and the free-text search match them.
 
 **Caveats** (RustNet learns names by sniffing DNS on the wire):
 
```

**File**: `USAGE.zh-CN.md` (modified, +3/-5)
```diff
@@ -1156,13 +1156,11 @@ RustNet 使用智能超时管理自动清理不活跃的连接，同时在移除
 
 ### 主机名显示
 
-从连接本身提取的主机名（HTTPS 或 QUIC 的 TLS SNI、HTTP `Host:` 头）显示在 **App** 列中。**Remote** 列中的名称按以下优先级选择（用 `d` 键切换主机名显示）：
+从连接本身提取的主机名（HTTPS 或 QUIC 的 TLS SNI、HTTP `Host:` 头）显示在 **App** 列中。在开发版本中，DNS 归因主机名也显示在 **App** 中，例如 `TCP·HTTPS (~example.com)`；尚未识别应用协议时显示为 `UDP (~example.com)`。当连接没有 SNI / Host 名称，且最近 **10 秒**内观测到了指向远程 IP 的 DNS 解析时，显示此推断名称。紧凑的 App 列省略主机名元数据。
 
-1. **DNS 归因主机名**：当连接不携带 SNI / Host 头，但在最近 **10 秒**内观测到了指向该 IP 的 DNS 解析时，以暗色的 `~name:port` 形式渲染
-2. **反向 DNS**（系统解析器，除非用 `--no-resolve-dns` 禁用）
-3. **原始 IP 地址**
+**Remote** 列显示反向 DNS 名称（除非用 `--no-resolve-dns` 禁用），否则显示原始 IP 地址。`d` 键切换反向 DNS 名称，不会隐藏应用名称。
 
-前缀 `~` 表示该主机名是从 DNS 响应*推断*出来的，而非从连接本身提取。这对握手后的 QUIC 会话（SNI 已加密）以及不携带主机名载荷的纯 TCP/UDP 连接最有用。归因不需要主动查询，因此即使使用 `--no-resolve-dns` 也能工作。详情标签页会单独显示一行 **Attributed Name**（完整的推断主机名），以及一行 **Attributed Via**（来源和观测时间，如 `Captured DNS, 5s ago`），使来源一目了然。归因主机名可以像其他主机名一样搜索：`sni:` / `host:` / `hostname:` 关键字过滤器和自由文本搜索都能匹配它们。
+前缀 `~` 表示该主机名是从 DNS 响应*推断*出来的，而非从连接本身提取。这对握手后的 QUIC 会话（SNI 已加密）以及不携带主机名载荷的纯 TCP/UDP 连接最有用。归因不需要主动查询，因此即使使用 `--no-resolve-dns` 也能工作。在开发版本中，详情标签页的 **Application** 卡片会单独显示一行 **Attributed Name**（完整的推断主机名），以及一行 **Attributed Via**（来源和观测时间，如 `Captured DNS, 5s ago`），使来源一目了然。归因主机名可以像其他主机名一样搜索：`sni:` / `host:` / `hostname:` 关键字过滤器和自由文本搜索都能匹配它们。
 
 **注意事项**（RustNet 通过嗅探线上的 DNS 学习名称）：
 
```

**File**: `src/ui/connection_table.rs` (modified, +102/-70)
```diff
@@ -298,55 +298,39 @@ fn endpoint_display(
 /// ("host…:443"); raw addresses only ellipsize as a last resort at
 /// very narrow widths. Broadcast/multicast endpoints render as labels
 /// and skip hostname resolution.
-///
-/// The bool is true when the name was attributed from an observed DNS
-/// response (rendered as `~name:port` and dimmed) rather than resolved
-/// via reverse DNS. Attribution takes priority over reverse DNS and
-/// needs no resolver; an authoritative SNI / Host header suppresses it
-/// (that name already shows in the App column).
 fn remote_display(
     conn: &Connection,
     ui_state: &UiState,
     dns_resolver: Option<&DnsResolver>,
     max_width: usize,
-) -> (String, bool) {
+) -> String {
     if ui_state.show_hostnames
         && conn.protocol != Protocol::Arp
         && conn.remote_addr_kind == AddrKind::Unicast
     {
         let port = conn.remote_addr.port();
-        let fit = |name: &str, prefix: &str| -> String {
-            let full = format!("{prefix}{name}:{port}");
+        let fit = |name: &str| -> String {
+            let full = format!("{name}:{port}");
             if full.chars().count() > max_width {
                 let port_str = format!(":{port}");
-                let budget = max_width
-                    .saturating_sub(port_str.chars().count())
-                    .saturating_sub(prefix.chars().count());
-                format!("{prefix}{}{port_str}", truncate_with_ellipsis(name, budget))
+                let budget = max_width.saturating_sub(port_str.chars().count());
+                format!("{}{port_str}", truncate_with_ellipsis(name, budget))
             } else {
                 full
             }
         };
 
-        if conn.authoritative_hostname().is_none()
-            && let Some(att) = &conn.attributed_hostname
-        {
-            return (fit(&att.name, "~"), true);
-        }
         if let Some(resolver) = dns_resolver
             && let Some(hostname) = resolver.get_hostname(&conn.remote_addr.ip())
         {
-            return (fit(&hostname, ""), false);
+            return fit(&hostname);
         }
     }
-    (
-        endpoint_display(
-            conn.remote_addr,
-            conn.remote_addr_kind,
-            conn.remote_is_gateway,
-            max_width,
-        ),
-        false,
+    endpoint_display(
+        conn.remote_addr,
+        conn.remote_addr_kind,
+        conn.remote_is_gateway,
+        max_width,
     )
 }
 
@@ -547,15 +531,13 @@ pub(in crate::ui) fn connection_row<'a>(
                 spans.push(Span::raw(truncate_with_ellipsis(&full, budget)));
                 Cell::from(Line::from(spans)).style(process_style(conn, paint))
             }
-            ColumnId::Remote => {
-                let (display, attributed) =
-                    remote_display(conn, ui_state, dns_resolver, col.width as usize);
-                Cell::from(display).style(cell_style(if attributed {
-                    theme::field_attributed_hostname()
-                } else {
-                    theme::field_remote_addr()
-                }))
-            }
+            ColumnId::Remote => Cell::from(remote_display(
+                conn,
+                ui_state,
+                dns_resolver,
+                col.width as usize,
+            ))
+            .style(cell_style(theme::field_remote_addr())),
             ColumnId::Local => Cell::from(endpoint_display(
                 conn.local_addr,
                 conn.local_addr_kind,
@@ -678,30 +660,37 @@ fn process_style(conn: &Connection, paint: CellPaint) -> Style {
     paint.style(color)
 }
 
-/// Merged protocol + application cell: "TCP·HTTPS (sni)" at full width,
-/// "TCP·HTTPS" compact, bare "TCP" without DPI info. The protocol half
-/// is muted so the detected application reads as the content.
+/// Merged transport, detected application, and optional DNS-inferred name.
+/// Compact columns omit metadata, including inferred names.
 fn application_cell<'a>(conn: &Connection, width: u16, paint: CellPaint) -> Cell<'a> {
     let proto = conn.protocol.as_str();
-
-    let Some(dpi) = conn.dpi_info.as_ref() else {
-        return Cell::from(proto).style(paint.style(theme::muted()));
-    };
-
-    let budget = (width as usize).saturating_sub(proto.chars().count() + 1);
-    let app = if width >= APP_WIDTH_FULL {
-        truncate_with_ellipsis(&dpi.application.to_string(), budget)
-    } else {
-        truncate_with_ellipsis(dpi.application.sort_key(), budget)
-    };
-    if paint.colored() {
-        Cell::from(Line::from(vec![
-            Span::styled(format!("{proto}·"), paint.style(theme::muted())),
-            Span::styled(app, paint.style(dpi_color(&dpi.application))),
-        ]))
-    } else {
-        Cell::from(format!("{proto}·{app}"))
+    let mut spans = vec![Span::styled(proto, paint.style(theme::muted()))];
+    let mut used = proto.chars().count();
+    if let Some(dpi) = &conn.dpi_info {
+        let budget = (width as usize
```

**File**: `src/ui/mod.rs` (modified, +18/-0)
```diff
@@ -2370,6 +2370,24 @@ mod snapshot_tests {
         }));
         rich_app.set_connections_snapshot_for_test(rich_connections.clone());
         let rich = render_details_frame(&rich_app, &rich_connections, 0, 52).0;
+        let attributed_row = rich
+            .lines()
+            .find(|line| line.contains("Attributed Name"))
+            .unwrap();
+        let application_row = rich
+            .lines()
+            .find(|line| line.contains("Application"))
+            .unwrap();
+        assert_eq!(
+            attributed_row.find("Attributed Name"),
+            application_row.find("Application"),
+            "DNS attribution must be in the Application card",
+        );
+        assert!(attributed_row.contains("~lb-140-82-121-4.github.com"));
+        assert!(
+            rich.lines()
+                .any(|line| line.contains("Attributed Via") && line.contains("Captured DNS"))
+        );
 
         let bare_app = test_app();
         let mut bare_connections = sample_connections();
```

**File**: `src/ui/snapshots/rustnet_monitor__ui__snapshot_tests__compact_details_application.snap` (modified, +2/-2)
```diff
@@ -16,8 +16,8 @@ Detected              -
                                                                                 
                                                                                 
                                                                                 
-                                                                                
-                                                                                
+Attributed Name       -                                                         
+Attributed Via        -                                                         
                                                                                 
                                                                                 
                                                                                 
```

---

### Incident Patch 12: `95a21a0d` (2026-09-27)
**Commit Message**: feat(linux): retain process identity after exit (#640)

* feat(linux): retain process identity after exit

* docs: note retained process identity

**File**: `ARCHITECTURE.md` (modified, +3/-2)
```diff
@@ -286,9 +286,10 @@ The same backend publishes a socket snapshot every 5 seconds for the Host tab. T
 - Captures socket creation events with process context
 - On Linux 5.11+, runs a one-shot task-file iterator after attaching the live probes to capture owners of sockets that predate RustNet, including other users' sockets in file-capability mode
 - Provides lower overhead than procfs scanning
-- Records the group leader's TGID, the acting TID, and credentials; the name, executable path, and PPID are enriched in user space via procfs
+- Records the group leader's TGID, the acting TID, credentials, and process name
+- In development builds, also snapshots the executable and immediate parent (PID, name, executable, and birth time) at socket observation, retaining them after exit or exec. Procfs extends the parent chain only while task birth times still match.
 - **Limitations:**
-  - Names originate from the 16-character kernel `comm` field; RustNet re-resolves them via `/proc/<tgid>/comm` and recovers truncated names from the executable's file name, but processes that exit before enrichment keep the short eBPF-recorded name
+  - Names originate from the 16-byte kernel `comm` field; a retained executable basename can recover truncation. Executable snapshots are bounded to 255 path bytes and 32 directory/mount steps; incomplete paths remain unknown. Scripts identify the running interpreter. Ancestors beyond the immediate parent remain best effort.
 - **Capability requirements:**
   - Modern Linux (5.8+): `CAP_NET_RAW` (packet capture), `CAP_BPF`, `CAP_PERFMON` (eBPF)
   - Legacy Linux (pre-5.8): eBPF requires broad `CAP_SYS_ADMIN`; RustNet packages do not grant it automatically and fall back to procfs instead
```

**File**: `ARCHITECTURE.zh-CN.md` (modified, +3/-2)
```diff
@@ -278,9 +278,10 @@ RustNet 使用平台特定的 API 将网络连接与进程关联。每次归属
 - 捕获带进程上下文的 socket 创建事件
 - 在 Linux 5.11 及更高版本上，先附加实时探针，再运行一次性的 task-file 迭代器，以捕获 RustNet 启动前已存在的 socket 所有者；使用文件 capabilities 运行时也包括其他用户的 socket
 - 比 procfs 扫描开销更低
-- 记录进程组组长的 TGID、当前线程的 TID 以及凭据；进程名、可执行路径和 PPID 在用户态通过 procfs 富化
+- 记录进程组组长的 TGID、当前线程的 TID、凭据和进程名
+- 开发版本还在观察 socket 时保存可执行文件和直接父进程（PID、名称、可执行文件和启动时间），在退出或 exec 后继续保留。只有进程启动时间仍匹配时，才通过 procfs 扩展父进程链。
 - **局限性：**
-  - 进程名来源于内核 16 字符的 `comm` 字段；RustNet 会通过 `/proc/<tgid>/comm` 重新解析，并借助可执行文件名恢复被截断的名称，但在富化前就已退出的进程仍保留 eBPF 记录的短名称
+  - 进程名来源于内核 16 字节的 `comm` 字段，可使用保留的可执行文件名恢复截断。可执行路径最多保留 255 字节，最多遍历 32 个目录或挂载点；不完整路径保持未知。脚本显示运行中的解释器。直接父进程之外的祖先信息仍尽力提供。
 - **Linux capabilities 需求：**
   - 现代 Linux（5.8+）：`CAP_NET_RAW`（包捕获）、`CAP_BPF`、`CAP_PERFMON`（eBPF）
 	  - 旧版 Linux（pre-5.8）：eBPF 需要宽泛的 `CAP_SYS_ADMIN`；RustNet 安装包不会自动授予它，并会回退到 procfs
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [Unreleased]
 
 ### Added
+- **Retained Linux process identity**: eBPF preserves bounded executable paths
+  and immediate-parent metadata after exit or exec, and checks task birth times
+  before extending ancestry through procfs (#640)
 - **Generic container attribution (Linux)**: identify Docker, Podman and LXC
   from socket/process cgroups without daemon sockets. Show runtime, ID and
   available names in Details, `container:` / `runtime:` filters, headless JSON,
```

**File**: `crates/rustnet-host/src/linux/ebpf/loader.rs` (modified, +1/-1)
```diff
@@ -760,7 +760,7 @@ mod tests {
             .unwrap_err();
         assert_eq!(
             error.to_string(),
-            "socket_map value size mismatch: BPF object uses 297 bytes, Rust expects 296"
+            "socket_map value size mismatch: BPF object uses 849 bytes, Rust expects 848"
         );
     }
 
```

**File**: `crates/rustnet-host/src/linux/ebpf/maps_libbpf.rs` (modified, +58/-1)
```diff
@@ -6,7 +6,8 @@ use libbpf_rs::MapCore;
 use std::net::{Ipv4Addr, Ipv6Addr};
 
 pub(super) const CONN_KEY_SIZE: usize = 40;
-pub(super) const CONN_INFO_SIZE: usize = 296;
+pub(super) const CONN_INFO_SIZE: usize = 848;
+const EXE_PATH_LEN: usize = 256;
 const CGROUP_NAME_LEN: usize = 128;
 
 /// Connection key matching `socket_tracker_types.h`.
@@ -34,6 +35,14 @@ struct ConnInfo {
     pub timestamp: u64,
     pub cgroup_name: [u8; CGROUP_NAME_LEN],
     pub cgroup_parent: [u8; CGROUP_NAME_LEN],
+    executable: [u8; EXE_PATH_LEN],
+    parent_executable: [u8; EXE_PATH_LEN],
+    start_boottime: u64,
+    parent_start_boottime: u64,
+    parent_tgid: u32,
+    executable_offset: u16,
+    parent_executable_offset: u16,
+    parent_comm: [u8; TASK_COMM_LEN],
 }
 
 const _: () = assert!(std::mem::size_of::<ConnKey>() == CONN_KEY_SIZE);
@@ -171,6 +180,17 @@ impl ConnInfo {
     }
 }
 
+fn decode_executable(bytes: &[u8], offset: u16) -> Option<std::path::PathBuf> {
+    use std::os::unix::ffi::OsStrExt;
+    let start = usize::from(offset.checked_sub(1)?);
+    let bytes = bytes.get(start..)?;
+    if bytes.first() != Some(&b'/') {
+        return None;
+    }
+    let end = bytes.iter().position(|byte| *byte == 0)?;
+    Some(std::ffi::OsStr::from_bytes(&bytes[..end]).into())
+}
+
 impl From<ConnInfo> for ProcessInfo {
     fn from(info: ConnInfo) -> Self {
         Self {
@@ -180,6 +200,24 @@ impl From<ConnInfo> for ProcessInfo {
             gid: info.gid,
             comm: decode_comm(&info.comm),
             timestamp: info.timestamp,
+            executable: decode_executable(&info.executable, info.executable_offset),
+            start_boottime: info.start_boottime,
+            parent_start_boottime: info.parent_start_boottime,
+            parent: (info.parent_tgid != 0 && info.parent_tgid != info.tgid).then(|| {
+                let executable =
+                    decode_executable(&info.parent_executable, info.parent_executable_offset);
+                crate::ProcessAncestor {
+                    pid: info.parent_tgid,
+                    name: crate::linux::process::refine_truncated_name(
+                        decode_comm(&info.parent_comm),
+                        executable.as_deref(),
+                    ),
+                    executable,
+                    started_at_unix_ms: crate::linux::process::boottime_start_unix_ms(
+                        info.parent_start_boottime,
+                    ),
+                }
+            }),
             socket_cgroup: if info.cgroup_name[0] != 0 && info.cgroup_parent[0] != 0 {
                 Some(crate::SocketCgroup {
                     name: decode_comm(&info.cgroup_name),
@@ -298,6 +336,17 @@ impl MapReader {
 mod tests {
     use super::*;
 
+    #[test]
+    fn executable_paths_require_complete_absolute_terminated_bytes() {
+        use std::os::unix::ffi::OsStrExt;
+        assert!(decode_executable(b"/partial\0", 0).is_none());
+        assert!(decode_executable(b"/path", 1).is_none());
+        assert!(decode_executable(b"relative\0", 1).is_none());
+        assert!(decode_executable(b"/path\0", 99).is_none());
+        let path = decode_executable(b"\0\0/usr/bin/\xff\0", 3).unwrap();
+        assert_eq!(path.as_os_str().as_bytes(), b"/usr/bin/\xff");
+    }
+
     #[test]
     fn c_abi_sizes_and_alignment_are_stable() {
         assert_eq!(std::mem::size_of::<ConnKey>(), CONN_KEY_SIZE);
@@ -324,6 +373,14 @@ mod tests {
             timestamp: 14,
             cgroup_name: [0; CGROUP_NAME_LEN],
             cgroup_parent: [0; CGROUP_NAME_LEN],
+            executable: [0; EXE_PATH_LEN],
+            parent_executable: [0; EXE_PATH_LEN],
+            start_boottime: 0,
+            parent_start_boottime: 0,
+            parent_tgid: 0,
+            executable_offset: 0,
+            parent_executable_offset: 0,
+            parent_comm: [0; TASK_COMM_LEN],
         };
 
         let converted = ProcessInfo::from(raw);
```

**File**: `crates/rustnet-host/src/linux/ebpf/mod.rs` (modified, +5/-0)
```diff
@@ -40,6 +40,11 @@ pub(super) struct ProcessInfo {
     /// `bpf_ktime_get_ns` reading: nanoseconds on a **monotonic** clock, not
     /// wall-clock time.
     pub(super) timestamp: u64,
+    pub(super) executable: Option<std::path::PathBuf>,
+    /// Task birth times use CLOCK_BOOTTIME, matching /proc stat starttime.
+    pub(super) start_boottime: u64,
+    pub(super) parent_start_boottime: u64,
+    pub(super) parent: Option<crate::ProcessAncestor>,
     pub(super) socket_cgroup: Option<crate::SocketCgroup>,
 }
 
```

**File**: `crates/rustnet-host/src/linux/ebpf/programs/socket_tracker_helpers.h` (modified, +94/-3)
```diff
@@ -35,9 +35,85 @@ struct task_struct___local
 {
     struct task_struct___local *group_leader;
     char comm[TASK_COMM_LEN];
+    struct task_struct___local *real_parent;
+    struct mm_struct *mm;
+    __u64 start_boottime;
+    int tgid;
     struct css_set___local *cgroups;
 } __attribute__((preserve_access_index));
 
+/* Metadata exceeds the BPF stack. A nested probe must leave the outer
+ * probe's per-CPU scratch untouched. Tracing programs cannot migrate. */
+struct identity_scratch
+{
+    __u32 busy;
+    struct conn_info info;
+    /* The verifier bounds offset and read length independently. Reserve
+     * their maximum combined span after the paths; runtime checks below
+     * still keep every read strictly inside its own path array. */
+    char path_read_padding[EXE_PATH_LEN];
+};
+
+struct
+{
+    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
+    __uint(max_entries, 1);
+    __type(key, __u32);
+    __type(value, struct identity_scratch);
+} identity_buffer SEC(".maps");
+
+/* Resolve mm->exe_file while the task is alive. Walk across mount roots,
+ * preserving raw filename bytes. Incomplete or overlong paths stay unknown.
+ * Unlike exec filename arguments, this identifies the running interpreter
+ * for scripts. No process-lifecycle cache is needed. */
+static __noinline __u16 snapshot_executable(struct task_struct___local *task,
+                                           char *out)
+{
+    struct file *exe = BPF_CORE_READ(task, mm, exe_file);
+    if (!exe)
+        return 0;
+    struct dentry *dentry = BPF_CORE_READ(exe, f_path.dentry);
+    struct vfsmount *vfsmount = BPF_CORE_READ(exe, f_path.mnt);
+    __u32 offset = EXE_PATH_LEN - 1;
+    out[offset] = 0;
+
+    for (int depth = 0; depth < 32; depth++)
+    {
+        if (!dentry || !vfsmount)
+            return 0;
+        struct dentry *root = BPF_CORE_READ(vfsmount, mnt_root);
+        struct dentry *parent = BPF_CORE_READ(dentry, d_parent);
+        if (dentry == root)
+        {
+            struct mount *mount = (void *)vfsmount -
+                bpf_core_field_offset(struct mount, mnt);
+            struct mount *up = BPF_CORE_READ(mount, mnt_parent);
+            if (!up)
+                return 0;
+            if (up == mount)
+                return offset < EXE_PATH_LEN - 1 ? offset + 1 : 0;
+            dentry = BPF_CORE_READ(mount, mnt_mountpoint);
+            vfsmount = (void *)up + bpf_core_field_offset(struct mount, mnt);
+            continue;
+        }
+        if (!parent || parent == dentry)
+            return 0;
+        __u32 len = BPF_CORE_READ(dentry, d_name.len);
+        const unsigned char *name = BPF_CORE_READ(dentry, d_name.name);
+        if (!len || len >= EXE_PATH_LEN || len + 1 > offset)
+            return 0;
+        offset = (offset - len) & (EXE_PATH_LEN - 1);
+        if (offset >= EXE_PATH_LEN || offset + len >= EXE_PATH_LEN)
+            return 0;
+        if (bpf_probe_read_kernel(out + offset, len, name))
+            return 0;
+        offset--;
+        out[offset & (EXE_PATH_LEN - 1)] = '/';
+        dentry = parent;
+    }
+    return 0;
+}
+
 static __always_inline void get_process_info(struct conn_info *info)
 {
     __u64 pid_tgid = bpf_get_current_pid_tgid();
@@ -51,6 +127,14 @@ static __always_inline void get_process_info(struct conn_info *info)
 
     struct task_struct___local *task =
         (struct task_struct___local *)bpf_get_current_task();
+    struct task_struct___local *leader = BPF_CORE_READ(task, group_leader);
+    info->start_boottime = BPF_CORE_READ(leader, start_boottime);
+    info->executable_offset = snapshot_executable(leader, info->executable);
+    struct task_struct___local *parent_task = BPF_CORE_READ(leader, real_parent, group_leader);
+    info->parent_tgid = BPF_CORE_READ(parent_task, tgid);
+    info->parent_start_boottime = BPF_CORE_READ(parent_task, start_boottime);
+    BPF_CORE_READ_STR_INTO(&info->parent_comm, parent_task, comm);
+    info->parent_executable_offset = snapshot_executable(parent_task, info->parent_executable);
     long err = BPF_CORE_READ_STR_INTO(&info->comm, task, group_leader, comm);
     if (err <= 0 || info->comm[0] == '\0')
     {
@@ -82,9 +166,16 @@ static __always_inline void get_process_info(struct conn_info *info)
 
 static __always_inline int store_connection(struct conn_key *key)
 {
-    struct conn_info info = {};
-    get_process_info(&info);
-    return bpf_map_update_elem(&socket_map, key, &info, BPF_ANY);
+    __u32 zero = 0;
+    struct identity_scratch *scratch = bpf_map_lookup_elem(&identity_buffer, &zero);
+    if (!scratch || scratch->busy)
+        return 0;
+    scratch->busy = 1;
+    __builtin_memset(&scratch->info, 0, sizeof(scratch->info));
+    get_process_info(&scratch->info);
+    int result = bpf_map_update_elem(&socket_map, key, &scratch->info, BPF_ANY);
+    scratch->busy = 0;
+    return result;
 }
 
 static __always_inline void fill_socket_ports(struct sock *sk,
```

**File**: `crates/rustnet-host/src/linux/ebpf/programs/socket_tracker_types.h` (modified, +11/-1)
```diff
@@ -14,7 +14,8 @@
 #define IPPROTO_ICMPV6 58
 
 #define CONN_KEY_SIZE 40
-#define CONN_INFO_SIZE 296
+#define EXE_PATH_LEN 256
+#define CONN_INFO_SIZE 848
 
 /*
  * Map ABI shared with maps_libbpf.rs. Explicit trailing padding keeps the
@@ -41,6 +42,15 @@ struct conn_info
     __u64 timestamp;
     char cgroup_name[CGROUP_NAME_LEN];
     char cgroup_parent[CGROUP_NAME_LEN];
+    char executable[EXE_PATH_LEN];
+    char parent_executable[EXE_PATH_LEN];
+    __u64 start_boottime;
+    __u64 parent_start_boottime;
+    __u32 parent_tgid;
+    /* Right-aligned paths: start offset plus one, zero means unavailable. */
+    __u16 executable_offset;
+    __u16 parent_executable_offset;
+    char parent_comm[TASK_COMM_LEN];
 } __attribute__((aligned(8)));
 
 _Static_assert(sizeof(struct conn_key) == CONN_KEY_SIZE,
```

---

### Incident Patch 13: `7f674662` (2026-09-27)
**Commit Message**: docs: align guides with current behavior (#633)

**File**: `.github/pull_request_template.md` (modified, +3/-3)
```diff
@@ -27,9 +27,9 @@ Per [CONTRIBUTING.md > Code Quality Requirements](https://github.com/domcyrus/ru
 I ran the following locally and they all pass:
 
 - [ ] `cargo fmt --all -- --check`
-- [ ] `cargo clippy --all-targets --all-features -- -D warnings`
-- [ ] `cargo test --all-features`
-- [ ] `cargo build --release`
+- [ ] `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`
+- [ ] `cargo test --locked --workspace --all-features`
+- [ ] `cargo build --locked --workspace --all-targets --release`
 
 <!-- If any of these did not run, say which and why. CI will also run
 them, but local verification catches issues faster. -->
```

**File**: `ARCHITECTURE.md` (modified, +40/-127)
```diff
@@ -25,7 +25,7 @@ RustNet is a Cargo workspace of five crates. The analysis logic, capture backend
 | [`rustnet-core`](crates/rustnet-core) | library | Platform- and capture-independent analysis core: packet parsing, protocol/connection types, deep packet inspection, link-layer parsers, connection merging, DNS/GeoIP/OUI lookups, a reusable `ConnectionTracker`, and bounded retained process-activity accounting. Operates only on byte slices and parsed structures, with no libpcap, raw sockets, or OS process tables. |
 | [`rustnet-capture`](crates/rustnet-capture) | library | libpcap/Npcap packet-capture backend: device selection, BPF filters, macOS PKTAP, TUN/TAP, and a raw-frame `PacketReader`. |
 | [`rustnet-host`](crates/rustnet-host) | library | Per-connection process attribution plus a host TCP/UDP socket inventory: eBPF/procfs on Linux, PKTAP/lsof on macOS, ETW/IP Helper on Windows, and `sockstat` on FreeBSD. Owns the eBPF build tooling and bundled `vmlinux.h`. |
-| [`rustnet-sandbox`](crates/rustnet-sandbox) | library | Post-initialization sandboxing and root privilege dropping behind one `apply_sandbox` entry point: Landlock + capability drops on Linux, Seatbelt on macOS, restricted token + job object on Windows, and the shared uid drop on Linux/macOS/FreeBSD. Depends on no other workspace crate. |
+| [`rustnet-sandbox`](crates/rustnet-sandbox) | library | Post-initialization sandboxing and root privilege dropping behind one `apply_sandbox` entry point: Landlock + capability drops on Linux, Seatbelt on macOS, token privilege removal + job object on Windows, and the shared uid drop on Linux/macOS/FreeBSD. Depends on no other workspace crate. |
 | `rustnet-monitor` (binary `rustnet`) | binary | The user-facing application: CLI, TUI, and the app event loop. Dogfoods `ConnectionTracker` as the single source of truth. |
 
 The package is named `rustnet-monitor` because the `rustnet` crate name is taken on crates.io; the installed binary is `rustnet`.
@@ -236,10 +236,13 @@ TCP teardown packets from creating phantom established rows.
 
 **Visual Staleness Indicators:**
 
-Connections change color based on proximity to timeout:
-- **White** (default): < 75% of timeout
-- **Yellow**: 75-90% of timeout (warning)
-- **Red**: > 90% of timeout (critical)
+Once a connection has used at least half of its cleanup timeout and both
+displayed traffic rates have decayed to zero, its row shows a left-edge stripe
+and a removal countdown. Context columns soften toward the muted color on
+truecolor themes; signal columns retain their colors. The stripe and countdown
+progress from yellow toward red as cleanup approaches. A selected row with a
+selection background keeps its context colors for readability. Unselected
+historic rows appear gray when history is enabled.
 
 ### 7. Rate Refresh Thread
 
@@ -253,11 +256,11 @@ Updates bandwidth calculations every 500ms with gentle decay. This provides smoo
 
 ### 8. DashMap
 
-Concurrent hashmap (`DashMap<ConnectionKey, Connection>`) for storing connection state. This lock-free data structure enables efficient concurrent access from multiple threads.
+Concurrent hashmap (`DashMap<ConnectionKey, Connection>`) for storing connection state. It uses per-shard locks for concurrent access; lifecycle transitions also use a separate synchronization lock.
 
 **Key Features:**
 - Fine-grained locking (per-shard)
-- No global lock contention
+- Sharded access to connection entries
 - Safe concurrent reads and writes
 - High performance under concurrent load
 
@@ -342,20 +345,19 @@ The same backend publishes a socket snapshot every 5 seconds for the Host tab. T
 
 ### Network Interfaces
 
-The tool automatically detects and lists available network interfaces using platform-specific methods:
+The capture backend lists devices through libpcap/Npcap and selects a suitable
+active device when `--interface` is omitted. Separately, the packet parser
+collects the host's assigned addresses to determine traffic direction:
 
-- **Linux**: Uses `netlink` or falls back to `/sys/class/net/`
-- **macOS**: Uses `getifaddrs()` system call
-- **Windows**: Uses IP Helper APIs (`GetAdaptersInfo()` for interface listing and
-  `GetAdaptersAddresses()` for the parser's complete IPv4/IPv6 local-address set)
-- **All platforms**: Falls back to pcap's `pcap_findalldevs()` when native methods fail
+- **Linux, macOS, and FreeBSD**: `pnet_datalink` enumerates assigned IPv4 and IPv6 addresses.
+- **Windows**: IP Helper's `GetAdaptersAddresses()` enumerates assigned IPv4 and IPv6 addresses.
 
 Packet endpoint orientation maintains a snapshot of the addresses currently assigned to
 the host. Packet-processing workers refresh it every 30 seconds and, when neither unicast
 endpoint is recognized as local, perform a rate-limited refresh and retry that packet once.
 This keeps direction detection correct across DHCP changes, VPN connections, roaming, and
-IPv6 privacy-address rotation. On Windows, `GetAdaptersAddresses()` sup
```

**File**: `ARCHITECTURE.zh-CN.md` (modified, +35/-128)
```diff
@@ -25,7 +25,7 @@ RustNet 是一个由五个 crate 组成的 Cargo 工作区。分析逻辑、捕
 | [`rustnet-core`](crates/rustnet-core) | 库 | 与平台和捕获无关的分析核心：数据包解析、协议/连接类型、深度包检测、链路层解析器、连接合并、DNS/GeoIP/OUI 查找、可复用的 `ConnectionTracker`，以及有界的保留进程活动计量。仅操作字节切片和已解析的结构，不依赖 libpcap、原始套接字或操作系统进程表。 |
 | [`rustnet-capture`](crates/rustnet-capture) | 库 | 基于 libpcap/Npcap 的数据包捕获后端：设备选择、BPF 过滤器、macOS PKTAP、TUN/TAP，以及原始帧 `PacketReader`。 |
 | [`rustnet-host`](crates/rustnet-host) | 库 | 按连接进程归属及主机 TCP/UDP 套接字清单：Linux 上的 eBPF/procfs、macOS 上的 PKTAP/lsof、Windows 上的 ETW/IP Helper，以及 FreeBSD 上的 `sockstat`。负责 eBPF 构建工具链及内置的 `vmlinux.h`。 |
-| [`rustnet-sandbox`](crates/rustnet-sandbox) | 库 | 初始化完成后的沙箱与 root 权限降级，统一入口 `apply_sandbox`：Linux 上的 Landlock + 能力降级、macOS 上的 Seatbelt、Windows 上的受限令牌 + 作业对象，以及 Linux/macOS/FreeBSD 共享的 uid 降级。不依赖任何其他工作区 crate。 |
+| [`rustnet-sandbox`](crates/rustnet-sandbox) | 库 | 初始化完成后的沙箱与 root 权限降级，统一入口 `apply_sandbox`：Linux 上的 Landlock + 能力降级、macOS 上的 Seatbelt、Windows 上的令牌特权移除 + 作业对象，以及 Linux/macOS/FreeBSD 共享的 uid 降级。不依赖任何其他工作区 crate。 |
 | `rustnet-monitor`（二进制 `rustnet`） | 二进制 | 面向用户的应用：CLI、TUI 和应用事件循环。以 `ConnectionTracker` 作为唯一数据来源（dogfooding）。 |
 
 包名为 `rustnet-monitor`，因为 `rustnet` 这个 crate 名称在 crates.io 上已被占用；安装后的二进制文件名为 `rustnet`。
@@ -230,10 +230,11 @@ CNAME 链不需要单独的映射：DNS DPI 解析器记录的是原始*问题*
 
 **视觉陈旧度指示器：**
 
-连接根据距离超时的远近改变颜色：
-- **白色**（默认）：< 75% 的超时时间
-- **黄色**：75-90% 的超时时间（警告）
-- **红色**：> 90% 的超时时间（严重）
+连接的清理计时达到超时时间的一半，且显示的双向流量速率都衰减为零后，
+行左侧会出现条纹，并显示移除倒计时。真彩色主题下，标识信息列会逐渐接近
+柔和色，状态等信号列则保留原有颜色。随着清理时间临近，条纹与倒计时由黄
+色渐变为红色。带背景色的选中行保留标识信息列的颜色，以便阅读。启用历史
+记录时，未选中的已归档连接显示为灰色。
 
 ### 7. 速率刷新线程
 
@@ -247,11 +248,11 @@ CNAME 链不需要单独的映射：DNS DPI 解析器记录的是原始*问题*
 
 ### 8. DashMap
 
-并发哈希表（`DashMap<ConnectionKey, Connection>`）用于存储连接状态。这种无锁数据结构支持来自多个线程的高效并发访问。
+并发哈希表（`DashMap<ConnectionKey, Connection>`）用于存储连接状态。它使用分片锁支持并发访问；生命周期转换还使用独立的同步锁。
 
 **关键特性：**
 - 细粒度锁定（per-shard）
-- 无全局锁竞争
+- 对连接条目进行分片访问
 - 安全的并发读写
 - 高并发负载下的高性能
 
@@ -335,19 +336,18 @@ RustNet 使用平台特定的 API 将网络连接与进程关联。每次归属
 
 ### 网络接口
 
-该工具使用平台特定的方法自动检测和列出可用网络接口：
+抓包后端通过 libpcap/Npcap 列出设备。未指定 `--interface` 时，
+它会选择一个合适的活动设备。数据包解析器另行收集主机已分配的地址，
+用于判断流量方向：
 
-- **Linux**：使用 `netlink` 或回退到 `/sys/class/net/`
-- **macOS**：使用 `getifaddrs()` 系统调用
-- **Windows**：使用 IP Helper API（`GetAdaptersInfo()` 用于列出接口，
-  `GetAdaptersAddresses()` 用于获取解析器所需的完整 IPv4/IPv6 本地地址集合）
-- **所有平台**：当原生方法失败时回退到 pcap 的 `pcap_findalldevs()`
+- **Linux、macOS 和 FreeBSD**：`pnet_datalink` 枚举已分配的 IPv4 和 IPv6 地址。
+- **Windows**：IP Helper 的 `GetAdaptersAddresses()` 枚举已分配的 IPv4 和 IPv6 地址。
 
 数据包端点方向判定会维护当前分配给主机的地址快照。数据包处理线程每 30 秒刷新一次；
 当两个单播端点都无法识别为本地地址时，还会以限速方式立即刷新，并重新解析该数据包一次。
 因此，DHCP 地址变化、VPN 连接、网络漫游以及 IPv6 隐私地址轮换后，流量方向仍能正确判定。
-在 Windows 上，`GetAdaptersAddresses()` 会补充 `pnet_datalink` 仅包含 IPv4 的适配器数据，
-从而纳入临时和稳定的 IPv6 地址。
+在 Windows 上，`GetAdaptersAddresses()` 不依赖抓包驱动，
+即可获取临时和稳定的 IPv6 地址。
 
 ### 进程活动计量
 
@@ -370,23 +370,18 @@ RustNet 使用平台特定的 API 将网络连接与进程关联。每次归属
 
 ### 并发数据结构
 
-**DashMap** 提供无锁并发访问，具备：
-- Per-shard 锁定（默认 16 个 shard）
-- 无全局锁竞争
-- 读密集型工作负载优化
-- 安全的并发修改
+**DashMap** 通过分片锁提供并发连接映射访问，避免单个全局映射锁；
+访问同一分片的操作仍可能发生锁竞争。
 
 ### 批处理
 
-数据包以批次处理以提高缓存效率：
-- 上下文切换前处理多个数据包
-- 减少系统调用开销
-- 更好的 CPU 缓存利用率
+抓包线程将有界的数据包批次送入处理队列。单个处理线程会立即处理每个数据包；
+多个处理线程可以在有序更新连接跟踪器之前合并队列中已有的批次。
 
 ### 选择性 DPI
 
 可以使用 `--no-dpi` 禁用深度包检测以降低开销：
-- 在高流量网络中降低 20-40% 的 CPU 使用率
+- 在繁忙网络上可能降低 CPU 使用率；实际效果需按工作负载测量
 - 仍然追踪基本连接信息
 - 适用于性能受限的环境
 
@@ -403,12 +398,11 @@ RustNet 使用平台特定的 API 将网络连接与进程关联。每次归属
 **连接清理**防止内存无界增长：
 - 协议感知的超时移除陈旧连接
 - 移除前的视觉陈旧度警告
-- 可配置的超时阈值
 
 **快照隔离**防止 UI 阻塞：
 - UI 从不可变快照读取
 - 后台线程并发更新 DashMap
-- UI 和数据包处理之间无锁竞争
+- UI 渲染不会持有数据包处理所用的连接映射锁
 
 ## 依赖项<a id="dependencies"></a>
 
@@ -477,114 +471,27 @@ GitHub Action（`.github/workflows/update-oui.yml`）每月从 [IEEE 公开数
 
 关于 Landlock 沙箱、权限需求和威胁模型的安全文档，参见 [SECURITY.zh-CN.md](SECURITY.zh-CN.md)。
 
-## 与同类工具的对比<a id="comparison-with-similar-tools"></a>
+## 数据包捕获与进程归属<a id="comparison-with-similar-tools"></a>
 
-网络监控工具存在于从简单连接列表到完整数据包取证的光谱上：
+RustNet 将数据包捕获与操作系统的进程查询结合，在终端显示连接元数据。
+进程归属采用尽力而为的方式：权限、抓包接口或平台后端的限制，
+可能使归属信息缺失或延迟。连接视图不会解析所有协议，也不会保留完整数据包负载。
 
-```
-简单 ←─────────────────────────────────────────────────────→ 复杂
-
-netstat     iftop     bandwhich     RustNet     tcpdump     Wireshark
-   │          │           │            │            │            │
-   └── Socket ┴── Bandwidth ──────────┴── Live DPI ┴── Capture ──┴── Forensics
-       state      monitoring             + Process     & CLI        & Deep
-                                          tracking                   Analysis
-```
+使用 `--pcap-export` 将捕获的数据包保存为标准 PCAP 文件。
+如果路径是 `capture.pcap`，RustNet 还会写入
+`capture.pcap.connections.jsonl`，在连接关闭时记录其元数据。
+Sidecar 是独立文件，不嵌入 PCAP。
 
-**RustNet 的定位**：实时连接监控，带 DPI 和进程识别——比带宽监控器功能更强，比取证捕获工具更聚焦。
-
-### 功能对比
-
-| 功能 | RustNet | bandwhich | sniffnet | iftop | netstat | ss | tcpdump/wireshark |
-|---------|---------|-----------|----------|-------|---------|-----|-------------------|
-| **语言** | Rust | Rust | Rust | C | C | C | C |
-| **界面** | TUI | TUI | GUI | TUI | CLI | CLI | CLI/GUI |
-| **实时监控** | 是
```

**File**: `CHANGELOG.md` (modified, +4/-1)
```diff
@@ -56,6 +56,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   the selected process group
 
 ### Changed
+- **Documentation accuracy**: Align English, Chinese, and Japanese feature
+  claims, installation and profiling steps, sandbox limits, and the roadmap
+  with the current implementation.
 - **App artwork**: use a cyan and green terminal signal for desktop icons,
   the macOS installer, and the README logo in all three languages.
 - Document Scoop installation in all three README languages and both
@@ -962,7 +965,7 @@ Special thanks to the external contributors in this release:
 ### Added
 - **Landlock Sandbox for Linux**: Filesystem and network sandboxing for enhanced security
   - Restricts filesystem access to `/proc` only after initialization
-  - Network sandbox blocks TCP bind/connect on kernel 6.4+
+  - Network sandbox blocks TCP bind/connect on kernel 6.7+
   - Drops `CAP_NET_RAW` capability after pcap handle is opened
   - New CLI options: `--no-sandbox` and `--sandbox-strict`
   - Comprehensive security documentation in SECURITY.md
```

**File**: `CONTRIBUTING.md` (modified, +5/-1)
```diff
@@ -45,13 +45,17 @@ Before submitting a PR, please ensure:
 - **Code style**: Follow the existing code style and patterns in the codebase
 - **Clippy**: Fix all clippy warnings
   ```bash
-  cargo clippy --all-targets --all-features -- -D warnings
+  cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
   ```
 - **No clippy suppression**: Do not use `#[allow(clippy::...)]` to suppress warnings. Fix the underlying issue instead (e.g., reduce arguments, refactor code). If a suppression is truly unavoidable, discuss it in the PR.
 - **Formatting**: Run the formatter
   ```bash
   cargo fmt
   ```
+- **Tests**: Run the workspace test suite
+  ```bash
+  cargo test --locked --workspace --all-features
+  ```
 - **Security audit**: Check for known vulnerabilities in dependencies
   ```bash
   cargo audit
```

**File**: `CONTRIBUTING.zh-CN.md` (modified, +5/-1)
```diff
@@ -45,13 +45,17 @@ RustNet 追求小而快。并不是每个协议或功能都适合放在核心工
 - **代码风格**：遵循代码库中已有的代码风格和模式
 - **Clippy**：修复所有 clippy 警告
   ```bash
-  cargo clippy --all-targets --all-features -- -D warnings
+  cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
   ```
 - **禁止 clippy 抑制**：不要使用 `#[allow(clippy::...)]` 来抑制警告。请修复根本问题（例如减少参数、重构代码）。如果确实无法避免，请在 PR 中说明。
 - **格式化**：运行格式化工具
   ```bash
   cargo fmt
   ```
+- **测试**：运行整个工作区的测试套件
+  ```bash
+  cargo test --locked --workspace --all-features
+  ```
 - **安全审计**：检查依赖中的已知漏洞
   ```bash
   cargo audit
```

**File**: `INSTALL.md` (modified, +12/-12)
```diff
@@ -32,7 +32,7 @@ Pre-built packages are available for each release on the [GitHub Releases](https
 
 ### macOS DMG Installation
 
-> ** Prefer Homebrew?** If you have Homebrew installed, using `brew install` is easier and avoids Gatekeeper bypass steps. See [Homebrew Installation](#homebrew-installation) for instructions.
+> **Prefer Homebrew?** If you have Homebrew installed, using `brew install` is easier and avoids Gatekeeper bypass steps. See [Homebrew Installation](#homebrew-installation) for instructions.
 
 1. **Download** the appropriate DMG for your architecture:
    - `Rustnet_macOS_AppleSilicon.dmg` for Apple Silicon Macs (M1/M2/M3)
@@ -134,7 +134,7 @@ sudo setcap 'cap_net_raw,cap_bpf,cap_perfmon+eip' /usr/bin/rustnet
 rustnet
 ```
 
-**Important:** The PPA supports only the four series listed above because the build requires Rust 1.88+ (used for let-chains in the project). Other Ubuntu series don't ship a recent enough `rustc` in their repositories. For those, use the [.deb packages](#debianubuntu-deb-packages) from GitHub releases or [build from source](#building-from-source).
+**Important:** The PPA supports only the three series listed above because the build requires Rust 1.88+ (used for let-chains in the project). Other Ubuntu series don't ship a recent enough `rustc` in their repositories. For those, use the [.deb packages](#debianubuntu-deb-packages) from GitHub releases or [build from source](#building-from-source).
 
 #### Debian/Ubuntu (.deb packages)
 
@@ -146,20 +146,20 @@ For manual installation or non-Ubuntu Debian-based distributions:
 # - Rustnet_LinuxDEB_arm64.deb (ARM64)
 # - Rustnet_LinuxDEB_armhf.deb (ARMv7)
 
-# Install the package (capabilities are automatically configured)
+# Install the package (post-install script attempts to set capabilities)
 sudo dpkg -i Rustnet_LinuxDEB_amd64.deb
 
 # Install dependencies if needed
 sudo apt-get install -f
 
-# Run without sudo (capabilities were set by post-install script)
-rustnet
-
 # Verify capabilities
 getcap /usr/bin/rustnet
+
+# Run without sudo if CAP_NET_RAW is present; otherwise use sudo
+rustnet
 ```
 
-**Note:** The .deb package automatically sets Linux capabilities via post-install script, so you can run RustNet without sudo.
+**Note:** The .deb post-install script attempts to set Linux capabilities when `setcap` is available. Check with `getcap /usr/bin/rustnet`; if `CAP_NET_RAW` is absent, configure capabilities manually or run with `sudo`.
 
 #### RedHat/Fedora/CentOS (.rpm packages)
 
@@ -170,19 +170,19 @@ For manual installation or distributions not using COPR:
 # - Rustnet_LinuxRPM_x86_64.rpm
 # - Rustnet_LinuxRPM_aarch64.rpm
 
-# Install the package (capabilities are automatically configured)
+# Install the package (post-install script attempts to set capabilities)
 sudo rpm -i Rustnet_LinuxRPM_x86_64.rpm
 # Or with dnf/yum:
 sudo dnf install Rustnet_LinuxRPM_x86_64.rpm
 
-# Run without sudo (capabilities were set by post-install script)
-rustnet
-
 # Verify capabilities
 getcap /usr/bin/rustnet
+
+# Run without sudo if CAP_NET_RAW is present; otherwise use sudo
+rustnet
 ```
 
-**Note:** The .rpm package automatically sets Linux capabilities via post-install script, so you can run RustNet without sudo.
+**Note:** The .rpm post-install script attempts to set Linux capabilities when `setcap` is available. Check with `getcap /usr/bin/rustnet`; if `CAP_NET_RAW` is absent, configure capabilities manually or run with `sudo`.
 
 #### Arch Linux
 
```

**File**: `INSTALL.zh-CN.md` (modified, +11/-11)
```diff
@@ -134,7 +134,7 @@ sudo setcap 'cap_net_raw,cap_bpf,cap_perfmon+eip' /usr/bin/rustnet
 rustnet
 ```
 
-**重要：** 该 PPA 仅支持上述四个系列，因为构建需要 Rust 1.88+（项目中使用了 let-chains）。其他 Ubuntu 系列的仓库中没有足够新的 `rustc`。对于这些版本，请使用 GitHub releases 中的 [.deb 包](#debianubuntu-deb-packages)或[从源码构建](#building-from-source)。
+**重要：** 该 PPA 仅支持上述三个系列，因为构建需要 Rust 1.88+（项目中使用了 let-chains）。其他 Ubuntu 系列的仓库中没有足够新的 `rustc`。对于这些版本，请使用 GitHub releases 中的 [.deb 包](#debianubuntu-deb-packages)或[从源码构建](#building-from-source)。
 
 #### Debian/Ubuntu（.deb 包）<a id="debianubuntu-deb-packages"></a>
 
@@ -146,20 +146,20 @@ rustnet
 # - Rustnet_LinuxDEB_arm64.deb（ARM64）
 # - Rustnet_LinuxDEB_armhf.deb（ARMv7）
 
-# 安装包（Linux capabilities 会自动配置）
+# 安装包（安装后脚本会尝试设置 Linux capabilities）
 sudo dpkg -i Rustnet_LinuxDEB_amd64.deb
 
 # 如有需要安装依赖
 sudo apt-get install -f
 
-# 无需 sudo 运行（post-install 脚本已设置 Linux capabilities）
-rustnet
-
 # 验证 Linux capabilities
 getcap /usr/bin/rustnet
+
+# 若存在 CAP_NET_RAW，可无需 sudo 运行；否则使用 sudo
+rustnet
 ```
 
-**注意：** .deb 包通过 post-install 脚本自动设置 Linux capabilities，因此你可以无需 sudo 运行 RustNet。
+**注意：** .deb 包的安装后脚本会在 `setcap` 可用时尝试设置 Linux capabilities。请用 `getcap /usr/bin/rustnet` 验证；若缺少 `CAP_NET_RAW`，请手动配置 capabilities 或使用 `sudo`。
 
 #### RedHat/Fedora/CentOS（.rpm 包）<a id="redhatfedoracentos-rpm-packages"></a>
 
@@ -170,19 +170,19 @@ getcap /usr/bin/rustnet
 # - Rustnet_LinuxRPM_x86_64.rpm
 # - Rustnet_LinuxRPM_aarch64.rpm
 
-# 安装包（Linux capabilities 会自动配置）
+# 安装包（安装后脚本会尝试设置 Linux capabilities）
 sudo rpm -i Rustnet_LinuxRPM_x86_64.rpm
 # 或使用 dnf/yum：
 sudo dnf install Rustnet_LinuxRPM_x86_64.rpm
 
-# 无需 sudo 运行（post-install 脚本已设置 Linux capabilities）
-rustnet
-
 # 验证 Linux capabilities
 getcap /usr/bin/rustnet
+
+# 若存在 CAP_NET_RAW，可无需 sudo 运行；否则使用 sudo
+rustnet
 ```
 
-**注意：** .rpm 包通过 post-install 脚本自动设置 Linux capabilities，因此你可以无需 sudo 运行 RustNet。
+**注意：** .rpm 包的安装后脚本会在 `setcap` 可用时尝试设置 Linux capabilities。请用 `getcap /usr/bin/rustnet` 验证；若缺少 `CAP_NET_RAW`，请手动配置 capabilities 或使用 `sudo`。
 
 #### Arch Linux
 
```

---

### Incident Patch 14: `36b55bd7` (2026-09-26)
**Commit Message**: fix: retain short Kubernetes flow attribution (#634)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -126,6 +126,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- **Short Kubernetes flows**: retain cgroup v2 pod/container identity with eBPF
+  socket records after process exit, match both endpoint orientations, and
+  evict old records when the map fills.
+  Track evidence export before debug-pod cleanup in the separate
+  [kubectl-rustnet follow-up](https://github.com/domcyrus/kubectl-rustnet/issues/20).
 - Clarify unreleased features and Windows setup in all three documentation
   languages; link v1.6.0 docs and add release checks for availability notes (#620)
 - **Connection viewport**: paging, scrollbars, and mouse targets track the current
```

**File**: `KUBERNETES.ja.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Kubernetes のキャプチャと証拠の保存
+
+[English](KUBERNETES.md) | [简体中文](KUBERNETES.zh-CN.md)
+
+## 短い接続（未リリース）
+
+Linux eBPF と cgroup v2 を使用する場合、RustNet は socket イベントの時点でコンテナと親 pod の cgroup 名を保持します。標準的な systemd と cgroupfs の Kubernetes 構成では、5 秒間隔の名前空間スキャンの間に接続が開始して終了しても、プロセス終了後に所有者を特定できます。検索は観測したエンドポイントの方向（送信元アドレスのワイルドカードを含む）を先に確認し、その後に逆方向を試すため、ホストでのキャプチャでも pod のネットワーク名前空間内の socket を照合できます。Pod とコンテナの名前は既存の kubelet ログのメタデータから解決します。イベントに記録された pod UID とコンテナ ID は、PID ごとのキャッシュより優先されます。
+
+Socket マップは最大 32,768 個の接続タプルを保持し、容量が不足すると古い記録を破棄します。既存のクリーンアップは 30 秒間隔で、60 秒より古い記録を削除します。同じタプルの新しいイベントは所有者情報を置き換えます。保持したイベントはキャプチャ済みパケットの所有者特定に使われ、取り逃したパケットを復元するものではありません。イベントには 2 つの cgroup 名だけが含まれるため、この情報源を使う場合は `cgroup_path` を省略します。
+
+Cgroup v1、コンテナ配下の入れ子の cgroup、eBPF が利用できない環境、読み取れないか切り詰められた cgroup 名では、引き続き procfs スキャンに依存し、スキャンの間に終了するプロセスを取り逃す場合があります。読みやすい名前の解決には kubelet ログのメタデータが必要です。
+
+## エクスポートの後続作業
+
+kubectl プラグインは別のリポジトリ [domcyrus/kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet) で管理されています。連携する [`--output-dir` の後続タスク](https://github.com/domcyrus/kubectl-rustnet/issues/20) では、キャプチャを正常に停止し、JSONL または PCAPNG の証拠ファイル（sidecar を含む）をフラッシュしてコピーした後に、デバッグ pod を削除する必要があります。コピーが失敗した場合は pod を保持し、復旧手順を表示します。
+
+このオプションはプラグインで計画中の機能であり、今回の RustNet の変更には実装されていません。対応版が出るまでは、セッションを終了する前に、デバッグ pod が動作している間に `kubectl cp` でファイルをコピーしてください。Kubernetes の設定は[使用ガイド（英語）](USAGE.md#--kubernetes-mode-optional-feature)を参照してください。
```

**File**: `KUBERNETES.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Kubernetes capture and evidence
+
+[简体中文](KUBERNETES.zh-CN.md) | [日本語](KUBERNETES.ja.md)
+
+## Short flows (unreleased)
+
+With Linux eBPF and cgroup v2, RustNet retains the container and parent pod cgroup names at each socket event. Standard systemd and cgroupfs Kubernetes layouts can therefore be attributed after the process exits, even when the flow starts and ends between the five-second namespace scans. Lookup tries the observed endpoint orientation first, including wildcard source addresses, then the reverse orientation, so host capture can match sockets in a pod network namespace. Pod and container names are resolved from the existing kubelet log metadata. The recorded pod UID and container ID take precedence over cached PID metadata.
+
+The socket map holds up to 32,768 tuples and evicts older records under pressure. Existing cleanup removes records more than 60 seconds old on a 30-second cleanup cadence. A newer event for the same tuple replaces its owner. Retained events supply attribution for captured packets; they do not reconstruct packets missed by capture. The event contains two cgroup names, so `cgroup_path` is omitted when enrichment uses this source.
+
+Cgroup v1, nested cgroups below the container, unavailable eBPF, and unreadable or truncated cgroup names still rely on procfs discovery and can miss processes that exit between scans. Human-readable names require the kubelet log metadata to remain available.
+
+## Export follow-up
+
+The kubectl plugin lives in a separate repository: [domcyrus/kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet). Its coordinated [`--output-dir` follow-up](https://github.com/domcyrus/kubectl-rustnet/issues/20) must stop capture gracefully, flush and copy JSONL or PCAPNG evidence (including any sidecar), and only then delete the debug pod. If copying fails, it must preserve the pod and report recovery instructions.
+
+This flag is planned in the plugin, not implemented by this RustNet change. Until it ships, copy exports with `kubectl cp` while the debug pod is still running, before quitting the session. See the [usage guide](USAGE.md#--kubernetes-mode-optional-feature) for Kubernetes setup.
```

**File**: `KUBERNETES.zh-CN.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Kubernetes 抓包与证据导出
+
+[English](KUBERNETES.md) | [日本語](KUBERNETES.ja.md)
+
+## 短连接（尚未发布）
+
+在启用 Linux eBPF 和 cgroup v2 时，RustNet 会在 socket 事件发生时保留容器及其父 pod 的 cgroup 名称。因此，对于标准 systemd 和 cgroupfs Kubernetes 布局，即使连接在间隔五秒的两次命名空间扫描之间建立并结束，进程退出后仍可识别归属。查询先尝试观测到的端点方向（包括源地址通配匹配），再尝试反向匹配，因此主机上的抓包也能匹配 pod 网络命名空间内的 socket。Pod 和容器名称通过现有的 kubelet 日志元数据解析。事件中的 pod UID 和容器 ID 优先于按 PID 缓存的元数据。
+
+Socket 映射最多保留 32,768 个连接元组，容量不足时淘汰较旧记录。现有清理机制每 30 秒清理超过 60 秒的记录。同一元组的新事件会替换其所有者。保留的事件用于为已捕获的数据包补充归属信息，不能重建漏抓的数据包。事件只包含两个 cgroup 名称，因此使用该来源时不提供 `cgroup_path`。
+
+Cgroup v1、容器下的嵌套 cgroup、eBPF 不可用，以及无法读取或被截断的 cgroup 名称仍依赖 procfs 扫描，可能遗漏在两次扫描之间退出的进程。解析可读名称需要相应的 kubelet 日志元数据仍然存在。
+
+## 导出后续工作
+
+kubectl 插件位于独立仓库：[domcyrus/kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet)。配套的 [`--output-dir` 后续任务](https://github.com/domcyrus/kubectl-rustnet/issues/20) 要求先正常停止抓包，刷新并复制 JSONL 或 PCAPNG 证据（包括 sidecar），然后才能删除调试 pod。如果复制失败，必须保留 pod 并提供恢复说明。
+
+该参数属于插件的计划功能，本次 RustNet 修改尚未实现。在插件支持该功能之前，请在调试 pod 仍运行时、退出会话之前使用 `kubectl cp` 复制文件。Kubernetes 配置见[使用指南](USAGE.zh-CN.md#--kubernetes-mode-optional-feature)。
```

**File**: `README.ja.md` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ macOS で PKTAP を使用するには `sudo` が必要です。BPF へのアク
 - [使用方法](USAGE.md): 操作、フィルター、自動化、キャプチャの出力
 - [セキュリティ](SECURITY.md): サンドボックスと権限管理
 - [アーキテクチャ](ARCHITECTURE.md): プラットフォーム別の実装と性能
+- [Kubernetes のキャプチャ](KUBERNETES.ja.md): 所有者特定の制限と証拠保存の後続作業
 - [変更履歴](CHANGELOG.md): リリース済みおよび今後の変更
 - [貢献](CONTRIBUTING.md): コントリビューションガイド
 
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ Press `/` to filter connections, `Enter` to inspect one, and `q` to quit. See th
 - [Usage](USAGE.md): controls, filtering, automation, and capture exports
 - [Security](SECURITY.md): sandboxing and privilege management
 - [Architecture](ARCHITECTURE.md): platform backends and performance
+- [Kubernetes capture](KUBERNETES.md): attribution limits and evidence export follow-up
 - [Changelog](CHANGELOG.md): releases and upcoming changes
 - [Contributing](CONTRIBUTING.md): how to contribute
 
```

**File**: `README.zh-CN.md` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ rustnet
 - [使用](USAGE.zh-CN.md)：操作、过滤、自动化与抓包导出
 - [安全](SECURITY.zh-CN.md)：沙箱与权限管理
 - [架构](ARCHITECTURE.zh-CN.md)：各平台后端与性能
+- [Kubernetes 抓包](KUBERNETES.zh-CN.md)：归属识别限制及证据导出后续工作
 - [更新日志](CHANGELOG.md)：已发布和即将发布的变更
 - [参与贡献](CONTRIBUTING.zh-CN.md)：贡献指南
 
```

**File**: `USAGE.md` (modified, +2/-0)
```diff
@@ -406,6 +406,8 @@ Attribution is surfaced in:
 
 **Running on a cluster:** the easiest way to use this is the [kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet) plugin (`kubectl krew install rustnet`). It launches RustNet as an ephemeral debug pod on a node using the official image, mounts the kubelet log directories read-only for name resolution, and cleans up the pod on exit. Since the plugin runs RustNet inside a pod, the default `auto` mode enables attribution without any flags.
 
+**Short flows (unreleased):** eBPF retains cgroup v2 pod/container identity after process exit. See [Kubernetes capture](KUBERNETES.md) for retention limits and the separate plugin’s `--output-dir` follow-up.
+
 ```bash
 # On a Kubernetes cluster: run as an ephemeral debug pod via the plugin
 kubectl rustnet --node worker-3
```

---

### Incident Patch 15: `cb620460` (2026-09-25)
**Commit Message**: docs: simplify readmes and update release guide (#630)

**File**: `ARCHITECTURE.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 # Architecture
 
+> **Documentation version:** On `main`, this guide describes development code and may include unreleased implementation details. For v1.6.0, use the [v1.6.0 architecture guide](https://github.com/domcyrus/rustnet/blob/v1.6.0/ARCHITECTURE.md). Check `rustnet --version` for your installed version.
+
 This document describes the technical architecture and implementation details of RustNet.
 
 ## Table of Contents
```

**File**: `ARCHITECTURE.zh-CN.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 # 架构
 
+> **文档版本：** `main` 分支上的本指南描述开发中的代码，可能包含尚未发布的实现细节。使用 v1.6.0 时，请参阅 [v1.6.0 架构指南](https://github.com/domcyrus/rustnet/blob/v1.6.0/ARCHITECTURE.zh-CN.md)。运行 `rustnet --version` 可查看已安装的版本。
+
 本文档描述 RustNet 的技术架构和实现细节。
 
 ## 目录
```

**File**: `CONTRIBUTING.md` (modified, +6/-0)
```diff
@@ -95,6 +95,12 @@ Security is important for a network monitoring tool:
 - Verify locally before opening the PR. The PR template lists the exact commands.
 - Add user-visible changes to the `## [Unreleased]` section of `CHANGELOG.md` in the same PR
 
+## Documentation
+
+- Keep the READMEs concise: a short introduction, primary installation method, demo and screenshots, brief highlights, and links to detailed guides. Avoid adding long feature lists, setup instructions, CLI references, or implementation details there.
+- Put details in the relevant guides (`INSTALL.md`, `USAGE.md`, `SECURITY.md`, or `ARCHITECTURE.md`) and link to them from the README when useful.
+- Do not describe unreleased features as available in README highlights or media. Mark development-only information in the guides and `CHANGELOG.md`; update the release note and claims in all three READMEs when a release ships. Keep the English, Chinese, and Japanese READMEs aligned.
+
 ## Duplicate Pull Requests
 
 If two or more PRs address the same issue, the maintainers will evaluate them on their merits (code quality, test coverage, architectural fit) rather than submission order. The PR that best fits the project will be merged; others will be closed with thanks. If your PR is closed in favor of another, useful pieces from your work (documentation, tests, edge cases) may be ported over and credited.
```

**File**: `CONTRIBUTING.zh-CN.md` (modified, +6/-0)
```diff
@@ -95,6 +95,12 @@ RustNet 追求小而快。并不是每个协议或功能都适合放在核心工
 - 在提交 PR 之前在本地验证。PR 模板中列出了需要执行的精确命令。
 - 在同一个 PR 中把用户可见的改动写入 `CHANGELOG.md` 的 `## [Unreleased]` 小节
 
+## 文档<a id="documentation"></a>
+
+- 保持 README 简洁：简短介绍、主要安装方式、演示动画和截图、少量功能亮点，以及详细指南的链接。不要在 README 中加入冗长的功能列表、安装细节、命令行参考或实现细节。
+- 将详细内容写入相应指南（`INSTALL.zh-CN.md`、`USAGE.zh-CN.md`、`SECURITY.zh-CN.md` 或 `ARCHITECTURE.zh-CN.md`），适用时从 README 链接到这些指南。
+- 不要在 README 的功能亮点或媒体中将未发布功能描述为已可用。在指南和 `CHANGELOG.md` 中标明仅限开发版本的内容；发布新版本时，更新三个语言版本 README 的版本说明和功能描述，并保持内容一致。
+
 ## 重复 Pull Request<a id="duplicate-pull-requests"></a>
 
 如果两个或多个 PR 解决了同一个 issue，维护者将根据代码质量、测试覆盖率和架构契合度来评估，而不是提交顺序。最符合项目需求的 PR 将被合并；其他 PR 将被关闭并致谢。如果你的 PR 被另一个替代，你工作中的有用部分（文档、测试、边界情况）可能会被移植并给予署名。
```

**File**: `README.ja.md` (modified, +56/-196)
```diff
@@ -2,234 +2,94 @@
   <img src="https://raw.githubusercontent.com/domcyrus/rustnet/main/assets/rustnet.svg" alt="RustNet ロゴ" width="96" height="96">
 </p>
 
-<p align="center">
-  <h1 align="center">RustNet</h1>
-  <p align="center">
-    <strong>プロセス単位で TCP、UDP、QUIC 接続を監視できる、ターミナルと自動化に対応したサンドボックス対応ネットワークモニター。</strong>
-  </p>
-  <p align="center">
-    <a href="INSTALL.md"><img src="https://img.shields.io/badge/platforms-Linux%20%7C%20macOS%20%7C%20Windows%20%7C%20FreeBSD-blue.svg" alt="対応プラットフォーム: Linux、macOS、Windows、FreeBSD"></a>
-  </p>
-</p>
-
-<p align="center">
-  <a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <strong>日本語</strong>
-</p>
+<h1 align="center">RustNet</h1>
 
 <p align="center">
-  <img src="./assets/rustnet.gif" alt="RustNet demo" width="800">
+  <a href="https://ratatui.rs/"><img src="https://ratatui.rs/built-with-ratatui/badge.svg" alt="Ratatui を使用"></a>
+  <a href="https://github.com/domcyrus/rustnet/actions"><img src="https://github.com/domcyrus/rustnet/workflows/Rust/badge.svg" alt="ビルド状況"></a>
+  <a href="https://crates.io/crates/rustnet-monitor"><img src="https://img.shields.io/crates/v/rustnet-monitor.svg" alt="Crates.io のバージョン"></a>
+  <a href="https://github.com/domcyrus/rustnet/releases"><img src="https://img.shields.io/github/v/release/domcyrus/rustnet.svg" alt="最新リリース"></a>
+  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache 2.0 ライセンス"></a>
 </p>
 
-RustNet は、各接続を所有するプロセス、通信量、状態、アプリケーションプロトコルをリアルタイムで表示します。Linux、macOS、Windows、FreeBSD に対応しています。
-
-> **ドキュメントのバージョン：** `main` ブランチの README は開発中のコードを説明しており、未リリースの機能を含む場合があります。v1.6.0 を使用している場合は、[v1.6.0 のドキュメント](https://github.com/domcyrus/rustnet/blob/v1.6.0/README.ja.md)を参照してください。`rustnet --version` でインストール済みのバージョン、`rustnet --help` でそのバージョンが対応するオプションを確認できます。
-
-## 主な機能
-
-> **v1.6.0 以降の未リリース機能：** WireGuard/OpenVPN の識別、Host タブ、Health バッジとソート、アイドル時のカウントダウン、Linux の既存 socket の所有者識別の改善には開発版が必要です。以下の Activity ブラウザー、コンパクト表示の操作、`pid:` フィルターも未リリースです。未リリースの変更一覧は[変更履歴](CHANGELOG.md#unreleased)を参照してください。
-
-- TCP、UDP、QUIC 接続とプロセスの対応付け。詳細には PID、実行ファイル、ユーザー/グループ名、照合の信頼度、全プラットフォーム共通の親プロセスチェーン（上限あり）を表示
-- Linux 5.11 以降では、起動時の BPF task-file イテレーターにより、ファイル capabilities で実行した場合でも root や他ユーザーが所有する既存 socket を識別
-- HTTP、TLS/SNI、DNS、SSH、QUIC、WireGuard、OpenVPN などの深層パケット解析
-- TCP、QUIC ハンドシェイク、DNS 応答、ICMP エコーの往復時間（RTT）と、TCP の再送・順序入れ替わりをリアルタイム表示。Overview テーブルではプロトコル別のヘルスバッジにより、TCP の問題、明示的な QUIC Retry/バージョンネゴシエーション、トランザクション型 UDP の再試行/タイムアウトを表示し、重大度順に並べ替え可能。DNS の応答コード、タイムアウト、レイテンシ分位点、質問名、ヘルス状態も受動的に集計
-- Host タブに TCP LISTEN ソケット、UDP BOUND エンドポイント、TCP 状態集計、観測 RTT、所有プロセス、インターフェース統計、DNS 分析を表示
-- `port:`、`process:`、`sni:`、`state:` などのフィルター
-- TUI を使わず、バージョン付き JSONL スナップショットをストリーミング出力、または終了時に最終 JSON スナップショットを 1 件出力できるヘッドレスモード（未リリース）。対話表示と同じ接続フィルターを利用可能
-- 注釈付き PCAPNG、PCAP と JSONL sidecar、JSON ログの出力
-- ローカル GeoIP データベースによる国、ASN、都市情報
-- ARP トラフィックから受動的に学習した LAN 機器・ゲートウェイの MAC アドレスとベンダー表示（内蔵 IEEE OUI データベース）
-- Linux Landlock、macOS Seatbelt、Windows の権限削減によるサンドボックス
-- オプションの Kubernetes pod、namespace、container 帰属情報
+<p align="center"><a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <strong>日本語</strong></p>
 
-パケットの解析は並列に行い、接続情報と注釈付きエクスポートの更新はキャプチャ順を維持します。
-並列ワーカーはキュー内の最大 16 バッチを一度の順序付き更新にまとめ、バッチがそろうのを待ちません。ワーカーが一つの場合は各パケットを解析後すぐに更新し、DPI の割り当てメモリをまとめて保持しません。キューは最大 10,000 パケットを保持し、それとは別に各ワーカーが最大 1,600 パケットを処理中に保持します（最大四つのワーカーで合計 6,400 パケット）。アプリのその他のメモリ使用量は含みません。キューが満杯の場合は送信タイムアウトを 5 ミリ秒とし、タイムアウト後も送信できなければそのバッチを破棄します。Linux、macOS、FreeBSD、Windows では、対応するキャプチャバックエンドの読み取り準備通知により、新しいトラフィックの到着時に読み取りを再開します。各プラットフォームで 10 ミリ秒のアイドル待機上限を共有し、終了要求の確認と未満バッチの送信を可能にします。ネイティブ通知が利用できない場合は短いスリープによるポーリングに戻ります。これはパケットごとの固定遅延ではありません。急増や継続的な過負荷によって、キューやキャプチャバックエンドでパケットを失う場合があります。
+RustNet は、TCP、UDP、QUIC の接続とその所有プロセスをリアルタイムで表示するターミナル向けネットワークモニターです。Linux、macOS、Windows、FreeBSD に対応しています。
 
 ## インストール
 
-macOS または Linux:
+macOS または Linux で Homebrew を使う場合:
 
 ```bash
 brew install rustnet
 ```
 
-Ubuntu 22.04 LTS 以降 / Linux Mint 21 以降 / Pop!_OS 22.04 以降:
+パケットキャプチャには `sudo "$(command -v rustnet)"` で起動します。ほかのパッケージマネージャーは以下に、権限設定とトラブルシューティングは[インストールガイド](INSTALL.md)に記載しています。
 
-```bash
-sudo add-apt-repository ppa:domcyrus/rustnet
-# Pop!_OS の場合: sudo apt-manage add ppa:domcyrus/rustnet
-sudo apt update && sudo apt install rustnet
-```
-
-Fedora 42 以降:
+> **リリース状況:** 以下の特長、GIF、スクリーンショットは v1.6.0 の内容です。`main` からリンクされるガイドには[未リリースの変更](CHANGELOG.md#unreleased)も含まれる場合があります。リリース版を使う場合は [v1.6.0 のドキュメント](https://github.com/domcyrus/rustnet/blob/v1.6.0/README.ja.md)を参照し、`rustnet --version` と `rustnet --help` でバージョンと対応オプションを確認してください。
 
-```bash
-sudo dnf copr enable domcyrus/rustnet
-sudo dnf install rustnet
-```
+## デモ
 
-Arch Linux:
-
-```bash
-sudo pacman -S rustnet
-```
+<p align="center">
+  <img src="./assets/rustnet.gif" alt="RustNet デモ" width="800">
+</p>
 
-Cargo:
+## 特長
 
-```bash
-cargo install rustnet-monitor
-```
+- SSH 越しでも使えるターミナル UI で、各接続の所有プロセス、状態、通信量、アプリケーションプロトコルを表示します。
+- パケット解析で HTTP、TLS/SNI、DNS、SSH、Q
```

**File**: `README.md` (modified, +51/-367)
```diff
@@ -2,410 +2,94 @@
   <img src="https://raw.githubusercontent.com/domcyrus/rustnet/main/assets/rustnet.svg" alt="RustNet logo" width="96" height="96">
 </p>
 
-<p align="center">
-  <h1 align="center">RustNet</h1>
-  <p align="center">
-    <strong>Per-process network monitoring for terminals and automation: live TCP, UDP, and QUIC connections with deep packet inspection, sandboxed by default.</strong>
-  </p>
-  <p align="center">
-    <a href="https://ratatui.rs/"><img src="https://ratatui.rs/built-with-ratatui/badge.svg" alt="Built With Ratatui"></a>
-    <a href="https://github.com/domcyrus/rustnet/actions"><img src="https://github.com/domcyrus/rustnet/workflows/Rust/badge.svg" alt="Build Status"></a>
-    <a href="https://crates.io/crates/rustnet-monitor"><img src="https://img.shields.io/crates/v/rustnet-monitor.svg" alt="Crates.io"></a>
-    <a href="https://github.com/domcyrus/rustnet/stargazers"><img src="https://img.shields.io/github/stars/domcyrus/rustnet?style=flat&logo=github" alt="GitHub Stars"></a>
-    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License"></a>
-    <a href="https://github.com/domcyrus/rustnet/releases"><img src="https://img.shields.io/github/v/release/domcyrus/rustnet.svg" alt="GitHub release"></a>
-    <a href="https://github.com/domcyrus/rustnet/pkgs/container/rustnet"><img src="https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker" alt="Docker Image"></a>
-    <a href="INSTALL.md"><img src="https://img.shields.io/badge/platforms-Linux%20%7C%20macOS%20%7C%20Windows%20%7C%20FreeBSD-blue.svg" alt="Platforms: Linux, macOS, Windows, FreeBSD"></a>
-  </p>
-</p>
+<h1 align="center">RustNet</h1>
 
 <p align="center">
-  <strong>English</strong> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.ja.md">日本語</a>
+  <a href="https://ratatui.rs/"><img src="https://ratatui.rs/built-with-ratatui/badge.svg" alt="Built with Ratatui"></a>
+  <a href="https://github.com/domcyrus/rustnet/actions"><img src="https://github.com/domcyrus/rustnet/workflows/Rust/badge.svg" alt="Build status"></a>
+  <a href="https://crates.io/crates/rustnet-monitor"><img src="https://img.shields.io/crates/v/rustnet-monitor.svg" alt="Crates.io version"></a>
+  <a href="https://github.com/domcyrus/rustnet/releases"><img src="https://img.shields.io/github/v/release/domcyrus/rustnet.svg" alt="Latest release"></a>
+  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache 2.0 license"></a>
 </p>
 
-<p align="center">
-  <img src="./assets/rustnet.gif" alt="RustNet demo" width="800">
-</p>
-
-<p align="center">
-  <em>Real-time visibility into every connection your machine makes, who owns it, and what protocol it's speaking. No tcpdump, X11 forwarding, or root piping.</em>
-</p>
-
-> **Documentation version:** On `main`, this README describes development code and may include unreleased features. For v1.6.0, use the [v1.6.0 documentation](https://github.com/domcyrus/rustnet/blob/v1.6.0/README.md). Check `rustnet --version` for your installed version and `rustnet --help` for its supported options.
-
-## Features
-
-> **Unreleased since v1.6.0:** WireGuard/OpenVPN detection, the Host tab, Health badges and sorting, the idle countdown, and improved Linux attribution of pre-existing sockets require development builds. The Activity browser, compact-layout controls, and `pid:` filter described below are also unreleased. See the [changelog](CHANGELOG.md#unreleased) for all pending changes.
-
-- **Per-process attribution**: Every TCP, UDP, and QUIC connection mapped to its owning process, via eBPF on Linux, PKTAP on macOS, ETW with an automatic IP Helper fallback on Windows, and native APIs on FreeBSD. Details include PID, executable, user/group names, match confidence, and a capped parent-process chain on every platform. Wireshark and tcpdump can't do this; `netstat` / `ss` can't show live state.
-- **Deep packet inspection**: Identify HTTP, HTTPS/TLS with SNI, DNS, SSH, FTP, QUIC, MQTT, BitTorrent, WireGuard, OpenVPN, STUN, NTP, mDNS, LLMNR, DHCP, SNMP, SSDP, and NetBIOS, without external dissectors.
-- **Annotated PCAPNG export**: `--pcapng-export` writes a Wireshark-ready capture with process, PID, direction, DPI/SNI, and GeoIP embedded as per-packet comments. Open it in Wireshark and every packet already names its owning process, with no post-processing. Classic `--pcap-export` with a JSONL sidecar for offline correlation is also available.
-- **Security sandboxing**: Landlock (Linux 5.13+), Seatbelt (macOS), token privilege drop + job-object child-process block (Windows). Drops privileges after initialization; a failed requested UID/GID drop stops startup before packet-processing workers run. See [SECURITY.md](SECURITY.md).
-- **Network analytics**: Real-time round-trip times for TCP, QUIC handshakes, DNS responses, and ICMP echo, plus TCP retransmission, out-of-order, and fast-retransmit detection. Protocol-aware health bad
```

**File**: `README.zh-CN.md` (modified, +51/-349)
```diff
@@ -2,392 +2,94 @@
   <img src="https://raw.githubusercontent.com/domcyrus/rustnet/main/assets/rustnet.svg" alt="RustNet 标志" width="96" height="96">
 </p>
 
-<p align="center">
-  <h1 align="center">RustNet</h1>
-  <p align="center">
-    <strong>面向终端与自动化的进程级网络监控工具：实时呈现 TCP、UDP、QUIC 连接，自带深度包检测，默认沙箱隔离运行。</strong>
-  </p>
-  <p align="center">
-    <a href="https://ratatui.rs/"><img src="https://ratatui.rs/built-with-ratatui/badge.svg" alt="Built With Ratatui"></a>
-    <a href="https://github.com/domcyrus/rustnet/actions"><img src="https://github.com/domcyrus/rustnet/workflows/Rust/badge.svg" alt="Build Status"></a>
-    <a href="https://crates.io/crates/rustnet-monitor"><img src="https://img.shields.io/crates/v/rustnet-monitor.svg" alt="Crates.io"></a>
-    <a href="https://github.com/domcyrus/rustnet/stargazers"><img src="https://img.shields.io/github/stars/domcyrus/rustnet?style=flat&logo=github" alt="GitHub Stars"></a>
-    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License"></a>
-    <a href="https://github.com/domcyrus/rustnet/releases"><img src="https://img.shields.io/github/v/release/domcyrus/rustnet.svg" alt="GitHub release"></a>
-    <a href="https://github.com/domcyrus/rustnet/pkgs/container/rustnet"><img src="https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker" alt="Docker Image"></a>
-    <a href="INSTALL.zh-CN.md"><img src="https://img.shields.io/badge/platforms-Linux%20%7C%20macOS%20%7C%20Windows%20%7C%20FreeBSD-blue.svg" alt="支持平台：Linux、macOS、Windows、FreeBSD"></a>
-  </p>
-</p>
+<h1 align="center">RustNet</h1>
 
 <p align="center">
-  <a href="README.md">English</a> | <strong>简体中文</strong> | <a href="README.ja.md">日本語</a>
+  <a href="https://ratatui.rs/"><img src="https://ratatui.rs/built-with-ratatui/badge.svg" alt="基于 Ratatui 构建"></a>
+  <a href="https://github.com/domcyrus/rustnet/actions"><img src="https://github.com/domcyrus/rustnet/workflows/Rust/badge.svg" alt="构建状态"></a>
+  <a href="https://crates.io/crates/rustnet-monitor"><img src="https://img.shields.io/crates/v/rustnet-monitor.svg" alt="Crates.io 版本"></a>
+  <a href="https://github.com/domcyrus/rustnet/releases"><img src="https://img.shields.io/github/v/release/domcyrus/rustnet.svg" alt="最新版本"></a>
+  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache 2.0 许可证"></a>
 </p>
 
-<p align="center">
-  <img src="./assets/rustnet.gif" alt="RustNet demo" width="800">
-</p>
-
-<p align="center">
-  <em>实时洞察机器对外发起的每一条连接：谁在使用它、走的是什么协议。无需 tcpdump，无需 X11 转发，也不必把 root 权限传递下去。</em>
-</p>
-
-> **文档版本：** `main` 分支上的本 README 描述开发中的代码，可能包含尚未发布的功能。使用 v1.6.0 时，请参阅 [v1.6.0 文档](https://github.com/domcyrus/rustnet/blob/v1.6.0/README.zh-CN.md)。运行 `rustnet --version` 查看已安装的版本，运行 `rustnet --help` 查看该版本支持的选项。
-
-## 功能特性
-
-> **v1.6.0 之后尚未发布的功能：** WireGuard/OpenVPN 识别、Host 标签页、Health 徽标与排序、空闲倒计时，以及 Linux 既有 socket 归属识别的改进均需要开发版。下文的 Activity 浏览器、紧凑布局操作和 `pid:` 过滤器也尚未发布。全部待发布变更见[更新日志](CHANGELOG.md#unreleased)。
-
-- **进程级归属识别**：每一条 TCP、UDP、QUIC 连接都能追溯到所属进程。Linux 使用 eBPF，macOS 使用 PKTAP，Windows 使用 ETW 并在不可用时自动回退到 IP Helper，FreeBSD 则走原生 API。详情会显示 PID、可执行文件、用户/组名称、匹配可信度，以及每个平台都提供的父进程链（有层级上限）。Wireshark 与 tcpdump 做不到这一点；`netstat` / `ss` 也无法展示实时状态。
-- **深度包检测**：无需外部解析器即可识别 HTTP、带 SNI 的 HTTPS/TLS、DNS、SSH、FTP、QUIC、MQTT、BitTorrent、WireGuard、OpenVPN、STUN、NTP、mDNS、LLMNR、DHCP、SNMP、SSDP 及 NetBIOS。
-- **带注释的 PCAPNG 导出**：`--pcapng-export` 可写出能直接用 Wireshark 打开的捕获文件，并将进程、PID、方向、DPI/SNI 和 GeoIP 作为逐包注释嵌入。每个数据包都会直接标明所属进程，无需后处理。也可使用经典的 `--pcap-export` 配合 JSONL sidecar 进行离线关联。
-- **安全沙箱**：Linux 5.13+ 使用 Landlock，macOS 使用 Seatbelt，Windows 通过 token 降权 + job-object 阻止子进程创建。初始化完成后丢弃特权；如果请求的 UID/GID 降权失败，启动会中止，不会启动数据包处理线程。详见 [SECURITY.zh-CN.md](SECURITY.zh-CN.md)。
-- **网络分析**：实时统计 TCP、QUIC 握手、DNS 响应及 ICMP 回显的往返时延，并检测 TCP 重传、乱序包和快重传。概览表格通过按协议显示的健康徽标，呈现 TCP 问题、明确可见的 QUIC Retry/版本协商事件，以及事务型 UDP 的重试/超时，并按严重程度排序。被动 DNS 分析还会汇总响应码、超时、延迟分位数、查询名称和简洁的健康状态。
-- **智能连接生命周期**：按协议设置超时，空闲连接行会显示由黄变红的左侧条纹和移除倒计时，并逐渐柔化为灰色。按 `t` 可保留历史（已关闭）连接以便事后追溯。
-- **Vim / fzf 风格过滤**：支持 `port:`、`src:`、`dst:`、`sni:`、`process:`、`state:`、`proto:`，以及 `/(?i)pattern/` 形式的正则。
-- **无界面自动化（尚未发布）**：无需 TUI 即可流式输出带版本号的 JSONL 快照，或在结束时输出一份最终 JSON 快照，并支持与交互界面相同的连接过滤语法。
-- **GeoIP 增强**：基于本地 MaxMind GeoLite2 数据库查询国家信息，不发起任何网络请求。
-- **局域网设备识别**：链路内设备和网关的 MAC 地址及厂商（来自内嵌的 IEEE OUI 数据库），从 ARP 流量中被动学习，并显示在详情页中。
-- **Kubernetes 归属识别**（可选 `kubernetes` feature）：将连接映射到所属 pod、namespace 和 container，并在详情面板、JSON/PCAPNG 导出以及 `pod:`、`ns:`、`container:` 过滤器中显示。官方 Docker 镜像已启用该功能；在集群上可使用 [kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet) 插件以临时调试 pod 运行。详见 [USAGE.zh-CN.md](USAGE.zh-CN.md#--kubernetes-mode-optional-feature)。
-- **跨平台**：Linux、macOS、Windows、FreeBSD。
-
-数据包并行解析，连接更新和带注释的导出更新仍按捕获顺序执行。
-并行处理线程将已入队的最多 16 个批次合并为一次有序更新，不等待凑满。只有一个处理线程时，每个数据包解析后立即更新，不暂存 DPI 分配的内存。队列最多容纳 10,000 个数据包，此外每个处理线程最多持有 1,600 个处理中的数据包（最多四个线程合计 6,400 个），这些上限不包含应用的其他内存使用量。队列满时，发送超时设为 5 毫秒，超时仍无法入队才丢弃该批次。在 Linux、macOS、FreeBSD 和 Windows 上，支持就绪通知的捕获后端会在新流量到达时唤醒读取线程。各平台共
```

**File**: `RELEASE.md` (modified, +69/-61)
```diff
@@ -12,40 +12,29 @@ after the rename, and the release workflow's notes extraction ignores it.
 
 ## Creating a New Release
 
-### 1. Run Pre-Release Checks
-
-After updating versions and changelog, run the pre-release validation script:
-
-```bash
-./scripts/pre-release-check.sh 1.2.0
-```
-
-This validates version consistency, changelog entries, code quality (fmt/clippy/test),
-Dockerfile correctness, and git status. Fix any errors before proceeding.
-
-### 2. Test Platform Builds
+### 1. Test Platform Builds
 
 Before tagging, verify all platform builds succeed on the current main branch:
 
 ```bash
 # Ensure you're on the main branch with latest changes
 git checkout main
-git pull origin main
+git pull --ff-only origin main
 ```
 
-1. Go to [Actions > Test Platform Builds](../../actions/workflows/test-platform-builds.yml)
+1. Go to [Actions > Test Platform Builds](https://github.com/domcyrus/rustnet/actions/workflows/test-platform-builds.yml)
 2. Click "Run workflow" (it builds all platforms, including static Linux builds,
    and also triggers a FreeBSD test build in the rustnet-bsd repo)
 3. Wait for the workflow to complete successfully
 
 This catches cross-platform and static linking issues before you invest time in release prep.
 
-### 3. Prepare the Release
+### 2. Prepare the Release
 
 > **Two version tracks since the workspace split.** `Cargo.toml` carries two
-> versions: the binary's `[package] version` (line ~30, the user-facing `1.x`
-> line that tags and packages follow) and `[workspace.package] version` (line
-> ~9, the `0.x` library crates `rustnet-core`/`-capture`/`-host`/`-sandbox`,
+> versions: the binary's `[package] version` (the user-facing `1.x` line that
+> tags and packages follow) and `[workspace.package] version` (the `0.x`
+> library crates `rustnet-core`/`-capture`/`-host`/`-sandbox`,
 > single source of truth also referenced from
 > `[workspace.dependencies]`). A normal feature
 > release bumps **only the binary `[package] version`** and `rpm/rustnet.spec`.
@@ -55,28 +44,32 @@ This catches cross-platform and static linking issues before you invest time in
 Update the binary version in `Cargo.toml` and `rpm/rustnet.spec`, and turn the
 accumulated `[Unreleased]` changelog section into the release entry:
 
+The examples in this procedure use v1.7.0 as a release after v1.6.0. Replace
+both versions with the version being prepared and its preceding tag.
+
 ```bash
-# Update Cargo.toml [package] version (e.g., version = "1.4.0"), NOT the
+# Update Cargo.toml [package] version (e.g., version = "1.7.0"), NOT the
 #   [workspace.package] version unless you intend to bump the library crates.
-# Update rpm/rustnet.spec Version field (e.g., Version: 1.4.0)
+# Update rpm/rustnet.spec Version field (e.g., Version: 1.7.0)
 
 # In CHANGELOG.md:
-#   1. Rename "## [Unreleased]" to "## [0.3.0] - YYYY-MM-DD" (review/polish the entries)
+#   1. Rename "## [Unreleased]" to "## [1.7.0] - YYYY-MM-DD" (review/polish the entries)
 #   2. Add a fresh, empty "## [Unreleased]" section above it
 #   3. Update the comparison links at the bottom:
-#        [Unreleased]: https://github.com/domcyrus/rustnet/compare/v0.3.0...HEAD
-#        [0.3.0]: https://github.com/domcyrus/rustnet/compare/v0.2.0...v0.3.0
+#        [Unreleased]: https://github.com/domcyrus/rustnet/compare/v1.7.0...HEAD
+#        [1.7.0]: https://github.com/domcyrus/rustnet/compare/v1.6.0...v1.7.0
 
 # Update Cargo.lock and test the build
 cargo build --release
-cargo test
 ```
 
-Before committing, update documentation availability notes in all three languages:
+Before committing, update documentation availability notes in every existing translation:
 
 - Update the version labels and `/blob/vX.Y.Z/` links in the documentation-version
-  notices in `README*.md`, `USAGE*.md`, `INSTALL*.md`, and `SECURITY*.md` to the
-  release being prepared. Preserve each link's language and target file.
+  notices in `README*.md`, `USAGE*.md`, `INSTALL*.md`, `SECURITY*.md`, and
+  `ARCHITECTURE*.md` to the release being prepared. Preserve each link's
+  language and target file. Update the README release-status text and confirm
+  its highlights, GIF, and screenshots describe the release being tagged.
 - Replace "unreleased" labels for features included in this release with
   "available since vX.Y.Z" (and the Chinese/Japanese equivalents). Review the
   feature summaries, examples, keyboard controls, and Windows/Npcap instructions.
@@ -87,66 +80,78 @@ Before committing, update documentation availability notes in all three language
 Locate these notes before each release:
 
 ```bash
-rg -n 'Documentation version|文档版本|ドキュメントのバージョン|[Uu]nreleased|尚未发布|未リリース|/blob/v[0-9]' README*.md USAGE*.md INSTALL*.md SECURITY*.md
+rg -n 'Release status|发布状态|リリース状況|Documentation version|文档版本|[Uu]nreleased|尚未发布|未リリース|/blob/v[0-9]' README*.md USAGE*.md INSTALL*.md SECURITY*.md ARCHITECTURE*.md
 ```
 
-### 4. Commit Release Changes
+### 3. Commit Release Changes
 
 ```bash
```

#### Recent Merged Pull Requests:
- **PR #661** (2026-10-05): fix(ui): separate overview traffic and interface counters (@domcyrus)
- **PR #660** (2026-10-05): fix(ui): simplify traffic graphs and clarify rates (@domcyrus)
- **PR #659** (2026-10-05): chore(deps): bump dns-lookup from 4.0.1 to 4.0.2 in the rust-dependencies group (@dependabot[bot])
- **PR #658** (2026-10-05): chore(deps): bump docker/setup-qemu-action from 3.7.0 to 4.4.0 in the actions group (@dependabot[bot])
- **PR #657** (2026-10-05): chore(deps): bump rust from `3999a7f` to `4cd8294` in the docker group (@dependabot[bot])
- **PR #656** (2026-10-04): Require successful installers before release publication (@domcyrus)
- **PR #654** (2026-10-03): Fix ARM DEB compatibility (@domcyrus)
- **PR #653** (2026-10-03): fix(filter): preserve regex syntax when parsing queries (@ddy314)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
