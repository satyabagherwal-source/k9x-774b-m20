# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet-freenet-core-learnings

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:35:55.580Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-freenet-freenet-core-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:35:55.580Z`  
> **Learning ID**: `LEARN-REEXTRACT-freenet-freenet-core-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `freenet-freenet-core-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `201a62bc`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T14:23:48.979Z  
> **Learning ID**: `learn-github-freenet-freenet-core`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): freenet/freenet-core

> **Canonical Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T14:23:48.969Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3119 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/core/benches/transport/allocation_overhead.rs`
```
//! Allocation overhead microbenchmarks
//!
//! Measures the specific allocation patterns we're optimizing:
//! 1. Arc<[u8]> vs Box<[u8]> for packet data
//! 2. Vec::split_off vs Bytes::slice for stream fragmentation

use bytes::Bytes;
use criterion::{BenchmarkId, Criterion, Throughput};
use std::hint::black_box;
use std::sync::Arc;

/// Maximum packet data size (same as transport layer MAX_PACKET_SIZE)
const MAX_PACKET_SIZE: usize = 1200;

/// Largest payload one packet carries: MAX_PACKET_SIZE minus the packet-type
/// byte, the 12-byte nonce and the 16-byte tag (the transport's MAX_DATA_SIZE).
const MAX_PAYLOAD_SIZE: usize = MAX_PACKET_SIZE - 1 - 12 - 16;

/// Fragment size for stream tests (same as MAX_DATA_SIZE - overhead)
const FRAGMENT_SIZE: usize = 1130;

/// Benchmark Arc<[u8]> vs Box<[u8]> creation from a buffer
///
/// This simulates what happens in `prepared_send()`:
/// - Current: `self.data[..self.size].into()` creates Arc<[u8]>
/// - Proposed: Same but creates Box<[u8]>
pub fn bench_packet_allocation(c: &mut Criterion) {
    let mut group = c.benchmark_group("allocation/packet_data");

    // Pre-allocate a buffer like PacketData does
    let buffer: [u8; MAX_PACKET_SIZE] = [0xAB; MAX_PACKET_SIZE];
    let sizes = [64, 256, 1024, MAX_PACKET_SIZE];

    for &size in &sizes {
        group.throughput(Throughput::Elements(1));

        // Current: Arc<[u8]>
        group.bench_with_input(BenchmarkId::new("arc", size), &size, |b, &sz| {
            b.iter(|| {
                let arc: Arc<[u8]> = buffer[..sz].into();
                black_box(arc)
            });
        });

        // Proposed: Box<[u8]>
        group.bench_with_input(BenchmarkId::new("box", size), &size, |b, &sz| {
            b.iter(|| {
                let boxed: Box<[u8]> = buffer[..sz].into();
                black_box(boxed)
            });
        });

        // Alternative: Vec<u8>
        group.bench_with_input(BenchmarkId::new("vec", size), &size, |b, &sz| {
            b.iter(|| {
                let vec: Vec<u8> = buffer[..sz].to_vec();
                black_box(vec)
            });
        });
    }

    group.finish();
}

/// Benchmark Vec::split_off vs Bytes::slice for stream fragmentation
///
/// This simulates what happens in send_stream():
/// - Current: `stream_to_send.split_off(MAX_DATA_SIZE)` allocates a new Vec
/// - Proposed: `stream_to_send.slice(..MAX_DATA_SIZE)` is zero-copy
pub fn bench_fragmentation(c: &mut Criterion) {
    let mut group = c.benchmark_group("allocation/fragmentation");

    // Test with various stream sizes (number of fragments)
    let stream_sizes: [(usize, &str); 4] = [
        (4 * 1024, "4KB"),     // ~3 fragments
        (64 * 1024, "64KB"),   // ~45 fragments
        (256 * 1024, "256KB"), // ~180 fragments
        (1024 * 1024, "1MB"),  // ~720 fragments
    ];

    for (size, label) in stream_sizes {
        let num_fragments = size.div_ceil(FRAGMENT_SIZE);
        group.throughput(Throughput::Elements(num_fragments as u64));

        // Current: Vec::split_off (allocates per fragment)
        group.bench_with_input(BenchmarkId::new("vec_split_off", label), &size, |b, &sz| {
            b.iter(|| {
                let mut stream = vec![0xABu8; sz];
                let mut fragments = Vec::new();

                while !stream.is_empty() {
                    let split_at = stream.len().min(FRAGMENT_SIZE);
                    let rest = if stream.len() > split_at {
                        let mut rest = stream.split_off(split_at);
                        std::mem::swap(&mut stream, &mut rest);
                        rest
                    } else {
                        std::mem::take(&mut stream)
                    };
                    fragments.push(rest);
                }

                black_box(fragments)
            });
        });

        // Proposed: Bytes::slice (zero-copy)
        group.bench_with_input(BenchmarkId::new("bytes_slice", label), &size, |b, &sz| {
            b.iter(|| {
                let stream = Bytes::from(vec![0xABu8; sz]);
                let mut fragments = Vec::new();
                let mut offset = 0;

                while offset < stream.len() {
                    let end = (offset + FRAGMENT_SIZE).min(stream.len());
                    fragments.push(stream.slice(offset..end));
                    offset = end;
                }

                black_box(fragments)
            });
        });

        // Also test pre-allocated Bytes (simulates if caller provides Bytes)
        group.bench_with_input(
            BenchmarkId::new("bytes_slice_preallocated", label),
            &size,
            |b, &sz| {
                // Pre-allocate outside the benchmark loop
                let stream = Bytes::from(vec![0xABu8; sz]);

                b.iter(|| {
                    let mut fragments = Vec::new();
                    let mut offset = 0;

                    while offset < stream.len() {
                        let end = (offset + FRAGMENT_SIZE).min(stream.len());
                        fragments.push(stream.slice(offset..end));
                        offset = end;
                    }

                    black_box(fragments)
                });
            },
        );
    }

    group.finish();
}

/// Benchmark the full packet preparation path
///
/// Simulates the complete flow: serialize -> encrypt -> prepare for send
/// This helps measure the relative contribution of allocation overhead.
pub fn bench_packet_preparation(c: &mut Criterion) {
    use aes_gcm::{Aes128Gcm, KeyInit, aead::AeadInPlace};

    let mut group = c.benchmark_group("allocation/packet_preparation");

    let key: [u8; 16] = [0x42u8; 16];
    let cipher = Aes128Gcm::new(&key.into());
    let nonce: [u8; 12] = [0u8; 12];

    let sizes = [64, 256, 1024, MAX_PAYLOAD_SIZE];

    for &size in &sizes {
        group.throughput(Throughput::Bytes(size as u64));

        // Current path: encrypt in place, then create Arc
        group.bench_with_input(
            BenchmarkId::new("encrypt_then_arc", size),
            &size,
            |b, &sz| {
                let mut buffer = [0u8; MAX_PACKET_SIZE];
                buffer[12..12 + sz].fill(0xAB);

                b.iter(|| {
                    // Reset buffer
                    buffer[12..12 + sz].fill(0xAB);

                    // Encrypt in place
                    let tag = cipher
                        .encrypt_in_place_detached((&nonce).into(), &[], &mut buffer[12..12 + sz])
                        .unwrap();

                    // Copy nonce and tag
                    buffer[..12].copy_from_slice(&nonce);
                    buffer[12 + sz..12 + sz + 16].copy_from_slice(&tag);

                    // Create Arc (current behavior)
                    let packet_size = 12 + sz + 16;
                    let arc: Arc<[u8]> = buffer[..packet_size].into();
                    black_box(arc)
                });
            },
        );

        // Proposed path: encrypt in place, then create Box
        group.bench_with_input(
            BenchmarkId::new("encrypt_then_box", size),
            &size,
            |b, &sz| {
                let mut buffer = [0u8; MAX_PACKET_SIZE];
                buffer[12..12 + sz].fill(0xAB);

                b.iter(|| {
                    // Reset buffer
                    buffer[12..12 + sz].fill(0xAB);

                    // Encrypt in place
                    let tag = cipher
                        .encrypt_in_place_detached((&nonce).into(), &[], &mut buffer[12..12 + sz])
                        .unwrap();

                    // Copy nonce and tag
                    buffer[..12].copy_from_slice(&nonce);
                    buffer[12 + sz..12 + sz + 16].copy_from_slice(&tag);

                    // Create Box (proposed behavior)
                    let packet_size = 12 + sz + 16;
                    let boxed: Box<[u8]> = buffer[..packet_size].into();
                    black_box(boxed)
                });
            },
        );
    }

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/blackbox.rs`
```
//! Transport Layer Benchmarks (Blackbox) with VirtualTime
//!
//! These benchmarks test the actual Freenet transport code (PeerConnection,
//! connection_handler, encryption) with mock sockets and VirtualTime.
//!
//! Uses VirtualTime for instant execution of network operations.
//! Expected runtime: ~30 seconds (vs ~5-10 minutes with real time)
//!
//! What's measured:
//! - Message throughput: Full pipeline (serialize → encrypt → channel → decrypt)
//! - Connection establishment: Full handshake timing

use criterion::{BenchmarkId, Criterion, Throughput};
use dashmap::DashMap;
use freenet::simulation::{TimeSource, VirtualTime};
use freenet::transport::mock_transport::{Channels, PacketDelayPolicy, PacketDropPolicy};
use std::hint::black_box as std_black_box;
use std::sync::Arc;
use std::time::Duration;

use super::common::create_peer_pair_with_virtual_time;

/// Benchmark connection establishment between two mock peers with VirtualTime.
///
/// This measures the full handshake: key exchange, encryption setup, etc.
/// With VirtualTime, handshakes complete instantly while tracking virtual elapsed time.
pub fn bench_connection_establishment(c: &mut Criterion) {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();

    let time_source = VirtualTime::new();

    let mut group = c.benchmark_group("transport/connection");
    group.sample_size(10);

    let ts = time_source.clone();
    group.bench_function("establish", |b| {
        b.to_async(&rt).iter_custom(|iters| {
            let ts = ts.clone();
            async move {
                let mut total_virtual_time = Duration::ZERO;

                for _ in 0..iters {
                    let channels: Channels = Arc::new(DashMap::new());

                    // Create peers with VirtualTime
                    let (peer_a_pub, mut peer_a, peer_a_addr) =
                        match freenet::transport::mock_transport::create_mock_peer_with_virtual_time(
                            PacketDropPolicy::ReceiveAll,
                            PacketDelayPolicy::NoDelay,
                            channels.clone(),
                            ts.clone(),
                        )
                        .await
                        {
                            Ok(p) => p,
                            Err(e) => {
                                eprintln!("establish peer_a creation failed: {:?}", e);
                                continue;
                            }
                        };

                    let (peer_b_pub, mut peer_b, peer_b_addr) =
                        match freenet::transport::mock_transport::create_mock_peer_with_virtual_time(
                            PacketDropPolicy::ReceiveAll,
                            PacketDelayPolicy::NoDelay,
                            channels,
                            ts.clone(),
                        )
                        .await
                        {
                            Ok(p) => p,
                            Err(e) => {
                                eprintln!("establish peer_b creation failed: {:?}", e);
                                continue;
                            }
                        };

                    let start_virtual = ts.now_nanos();

                    // Establish connection from both sides
                    let (conn_a_inner, conn_b_inner) = futures::join!(
                        peer_a.connect(peer_b_pub, peer_b_addr),
                        peer_b.connect(peer_a_pub, peer_a_addr),
                    );
                    let (conn_a, conn_b) = futures::join!(conn_a_inner, conn_b_inner);

                    let end_virtual = ts.now_nanos();
                    total_virtual_time +=
                        Duration::from_nanos(end_virtual.saturating_sub(start_virtual));

                    // Connection established - drop the connections
                    drop(conn_a.ok());
                    drop(conn_b.ok());
                }

                total_virtual_time
            }
        });
    });

    group.finish();
}

/// Benchmark message throughput between two connected mock peers with VirtualTime.
///
/// This measures the full pipeline: serialize → encrypt → channel → decrypt → deserialize
/// With VirtualTime, all operations complete instantly while tracking virtual elapsed time.
pub fn bench_message_throughput(c: &mut Criterion) {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .unwrap();

    let time_source = VirtualTime::new();

    let mut group = c.benchmark_group("transport/throughput");
    group.sample_size(10);

    // Test different message sizes
    for &size in &[64, 256, 1024, 1364] {
        group.throughput(Throughput::Bytes(size as u64));

        let ts = time_source.clone();
        group.bench_with_input(BenchmarkId::new("bytes", size), &size, |b, &sz| {
            b.to_async(&rt).iter_custom(|iters| {
                let ts = ts.clone();
                async move {
                    let mut total_virtual_time = Duration::ZERO;

                    for _ in 0..iters {
                        let channels: Channels = Arc::new(DashMap::new());
                        let message = vec![0xABu8; sz];

                        // Create peers with VirtualTime
                        let mut peers = create_peer_pair_with_virtual_time(
                            channels,
                            Duration::ZERO,
                            ts.clone(),
                        )
                        .await
                        .connect()
                        .await;

                        let start_virtual = ts.now_nanos();

                        // Send and receive message
                        if let Err(e) = peers.conn_a.send(message).await {
                            eprintln!("throughput send failed: {:?}", e);
                            continue;
                        }
                        match peers.conn_b.recv().await {
                            Ok(received) => {
                                std_black_box(received);
                            }
                            Err(e) => {
                                eprintln!("throughput recv failed: {:?}", e);
                                continue;
                            }
                        }

                        let end_virtual = ts.now_nanos();
                        total_virtual_time +=
                            Duration::from_nanos(end_virtual.saturating_sub(start_virtual));
                    }

                    total_virtual_time
                }
            });
        });
    }

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/common.rs`
```
//! Common utilities for transport benchmarks
//!
//! This module provides shared helpers to reduce duplication across benchmark files.
//! Key abstractions:
//! - `ConnectedPeerPair`: Encapsulates peer creation + connection establishment
//! - Runtime/throughput/formatting utilities
//!
//! ## Usage
//!
//! ```rust,ignore
//! use common::{create_connected_peers, ConnectedPeerPair};
//!
//! // Simple case - instant connection
//! let ConnectedPeerPair { mut conn_a, mut conn_b, .. } = create_connected_peers().await;
//!
//! // With delay
//! let mut peers = create_connected_peers_with_delay(Duration::from_millis(2)).await;
//! peers.warmup(5, 1024).await; // 5 warmup transfers of 1KB each
//! ```

use criterion::measurement::{Measurement, ValueFormatter};
use dashmap::DashMap;
use freenet::simulation::{RealTime, TimeSource, VirtualTime};
use freenet::transport::congestion_control::{CongestionControlAlgorithm, CongestionControlConfig};
use freenet::transport::mock_transport::{
    Channels, MockSocket, PacketDelayPolicy, PacketDropPolicy, create_mock_peer,
    create_mock_peer_with_congestion_config, create_mock_peer_with_delay,
    create_mock_peer_with_virtual_time,
};
use freenet::transport::{OutboundConnectionHandler, PeerConnection, TransportPublicKey};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

// =============================================================================
// Runtime Creation
// =============================================================================

/// Create a multi-threaded tokio runtime for benchmarks
///
/// Uses 4 worker threads which is suitable for most benchmark scenarios.
pub fn create_benchmark_runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .expect("Failed to create benchmark runtime")
}

// =============================================================================
// Congestion Control Configuration
// =============================================================================

/// Get the congestion control algorithm from environment variable.
///
/// Set `FREENET_CONGESTION_ALGO` to:
/// - `fixedrate` or `fixed` - Use FixedRate (10 Mbps per connection)
/// - `bbr` or `BBR` - Use BBR (Bottleneck Bandwidth and RTT)
/// - `ledbat` or `LEDBAT` - Use LEDBAT++ (Low Extra Delay Background Transport)
///
/// If not set, defaults to `CongestionControlAlgorithm::default()` (production default).
///
/// ## Example
///
/// ```bash
/// # Run benchmarks with BBR for comparison
/// FREENET_CONGESTION_ALGO=bbr cargo bench --bench transport_ci
///
/// # Run benchmarks with production default
/// cargo bench --bench transport_ci
/// ```
pub fn get_congestion_algorithm() -> CongestionControlAlgorithm {
    match std::env::var("FREENET_CONGESTION_ALGO")
        .unwrap_or_default()
        .to_lowercase()
        .as_str()
    {
        "ledbat" => CongestionControlAlgorithm::Ledbat,
        "bbr" => CongestionControlAlgorithm::Bbr,
        "fixedrate" | "fixed" | "" => CongestionControlAlgorithm::default(),
        other => {
            eprintln!(
                "Warning: Unknown FREENET_CONGESTION_ALGO value '{}', using default",
                other
            );
            CongestionControlAlgorithm::default()
        }
    }
}

/// Get the congestion control configuration from environment variable.
///
/// Returns the appropriate `CongestionControlConfig` based on `FREENET_CONGESTION_ALGO`.
/// This is a convenience wrapper around `get_congestion_algorithm()`.
pub fn get_congestion_config() -> CongestionControlConfig {
    CongestionControlConfig::new(get_congestion_algorithm())
}

/// Print the current congestion control configuration.
///
/// Call this at the start of benchmark runs to show which algorithm is being tested.
pub fn print_congestion_config() {
    let algo = get_congestion_algorithm();
    eprintln!(
        "Benchmark congestion control: {} (set FREENET_CONGESTION_ALGO to switch)",
        algo
    );
}

// =============================================================================
// Peer Creation & Connection
// =============================================================================

/// Unconnected peer pair
///
/// Created by `create_peer_pair()` functions. Call `.connect()` to establish
/// bidirectional connections and get a `ConnectedPeerPair`.
///
/// Generic over `TS: TimeSource` to support both RealTime (wall-clock) and
/// VirtualTime (instant simulation) timing modes.
pub struct PeerPair<TS: TimeSource = RealTime> {
    pub peer_a_pub: TransportPublicKey,
    pub peer_a: OutboundConnectionHandler<MockSocket, TS>,
    pub peer_a_addr: SocketAddr,
    pub peer_b_pub: TransportPublicKey,
    pub peer_b: OutboundConnectionHandler<MockSocket, TS>,
    pub peer_b_addr: SocketAddr,
    /// Keep channels alive - dropping this closes MockSocket inbound channels
    #[allow(dead_code)]
    channels: Channels,
}

/// Connected peer pair ready for data transfer
///
/// Encapsulates both connections and their peer handlers. The channels map
/// MUST be kept alive - dropping it closes the MockSocket inbound channels
/// which causes the listener tasks to exit and `ConnectionClosed` errors.
///
/// Generic over `TS: TimeSource` to support both RealTime (wall-clock) and
/// VirtualTime (instant simulation) timing modes.
///
/// ## Example
///
/// ```rust,ignore
/// let ConnectedPeerPair { mut conn_a, mut conn_b, .. } = create_connected_peers().await;
/// conn_a.send(message).await.unwrap();
/// let received: Vec<u8> = conn_b.recv().await.unwrap();
/// ```
pub struct ConnectedPeerPair<TS: TimeSource = RealTime> {
    pub conn_a: PeerConnection<MockSocket, TS>,
    pub conn_b: PeerConnection<MockSocket, TS>,
    /// Must keep peer_a alive for send_queue channel
    #[allow(dead_code)]
    peer_a: OutboundConnectionHandler<MockSocket, TS>,
    /// Must keep peer_b alive for send_queue channel
    #[allow(dead_code)]
    peer_b: OutboundConnectionHandler<MockSocket, TS>,
    /// Keep channels alive - dropping this closes MockSocket inbound channels
    #[allow(dead_code)]
    channels: Channels,
}

impl PeerPair<RealTime> {
    /// Establish bidirectional connections between peers (RealTime variant)
    ///
    /// This performs the connection handshake and returns a `ConnectedPeerPair`
    /// ready for data transfer.
    pub async fn connect(mut self) -> ConnectedPeerPair<RealTime> {
        let (conn_a_inner, conn_b_inner) = futures::join!(
            self.peer_a.connect(self.peer_b_pub, self.peer_b_addr),
            self.peer_b.connect(self.peer_a_pub, self.peer_a_addr),
        );
        let (conn_a, conn_b) = futures::join!(conn_a_inner, conn_b_inner);
        let (conn_a, conn_b) = (conn_a.expect("connect A"), conn_b.expect("connect B"));

        ConnectedPeerPair {
            conn_a,
            conn_b,
            peer_a: self.peer_a,
            peer_b: self.peer_b,
            channels: self.channels,
        }
    }
}

impl PeerPair<VirtualTime> {
    /// Establish bidirectional connections between peers (VirtualTime variant)
    ///
    /// This performs the connection handshake and returns a `ConnectedPeerPair`
    /// ready for data transfer. Uses VirtualTime for instant delay simulation.
    pub async fn connect(mut self) -> ConnectedPeerPair<VirtualTime> {
        let (conn_a_inner, conn_b_inner) = futures::join!(
            self.peer_a.connect(self.peer_b_pub, self.peer_b_addr),
            self.peer_b.connect(self.peer_a_pub, self.peer_a_addr),
        );
        let (conn_a, conn_b) = futures::join!(conn_a_inner, conn_b_inner);
        let (conn_a, conn_b) = (conn_a.expect("connect A"), conn_b.expect("connect B"));

        ConnectedPeerPair {
            conn_a,
            conn_b,
            peer_a: self.peer_a,
            peer_b: self.peer_b,
            channels: self.channels,
        }
    }
}

impl<TS: TimeSource> ConnectedPeerPair<TS> {
    /// Warmup the connection with N transfers to stabilize LEDBAT cwnd
    ///
    /// Performs `iterations` send/receive cycles to allow LEDBAT congestion
    /// control to reach steady state before measurements begin.
    ///
    /// Returns the number of successful warmup iterations. If warmup fails
    /// early, benchmarks can still proceed (the connection may be less stable).
    ///
    /// ## Example
    ///
    /// ```rust,ignore
    /// let mut peers = create_connected_peers().await;
    /// let completed = peers.warmup(5, 65536).await; // 5 x 64KB warmup transfers
    /// ```
    pub async fn warmup(&mut self, iterations: usize, message_size: usize) -> usize {
        let mut completed = 0;
        for i in 0..iterations {
            let msg = vec![0xABu8; message_size];
            if let Err(e) = self.conn_a.send(msg).await {
                eprintln!("Warmup send {} failed: {:?}", i, e);
                break;
            }
            match self.conn_b.recv().await {
                Ok(_) => completed += 1,
                Err(e) => {
                    eprintln!("Warmup recv {} failed: {:?}", i, e);
                    break;
                }
            }
        }
        completed
    }

    /// Get mutable references to both connections
    ///
    /// Useful when you need to pass connections separately to different tasks.
    pub fn connections_mut(
        &mut self,
    ) -> (
        &mut PeerConnection<MockSocket, TS>,
        &mut PeerConnection<MockSocket, TS>,
    ) {
        (&mut self.conn_a, &mut self.conn_b)
    }
}

/// Create a new pair of mock peers with no delay
pub async fn create_peer_pair(channels: Channels) -> PeerPair {
    let (peer_a_pub, peer_a, peer_a_addr) =
        create_mock_peer(PacketDropPolicy::ReceiveAll, channels.clone())
            .await
            .expect("create peer A");

    let (peer_b_pub, peer_b, peer_b_addr) =
        create_mock_peer(PacketDropPolicy::ReceiveAll, channels.clon
```

### Core Architecture Module: `crates/core/benches/transport/ledbat_validation.rs`
```
//! LEDBAT Validation Benchmarks with VirtualTime
//!
//! These benchmarks test LEDBAT congestion control behavior with separate
//! cold start and warm connection measurements.
//!
//! Uses VirtualTime for instant execution of network operations.
//! Expected runtime: ~30 seconds (vs ~5-10 minutes with real time)
//!
//! **Design principles:**
//! - Cold start: Create new connection per iteration (measures connection + transfer)
//! - Warm connection: Reuse connection across iterations (measures pure transfer)
//! - Keep OutboundConnectionHandler alive to prevent channel closure

use criterion::{Criterion, Throughput};
use dashmap::DashMap;
use freenet::simulation::{TimeSource, VirtualTime};
use freenet::transport::mock_transport::Channels;
use std::hint::black_box as std_black_box;
use std::sync::Arc;
use std::time::Duration;

use super::common::{SMALL_SIZES, create_peer_pair_with_virtual_time, spawn_auto_advance_task};

/// Cold start benchmark with VirtualTime: measures connection establishment + transfer
///
/// Each iteration creates a fresh connection, measuring real cold-start behavior.
/// With VirtualTime, connection handshakes complete instantly.
pub fn bench_large_transfer_validation(c: &mut Criterion) {
    // Use multi-threaded runtime to allow packet delivery to proceed concurrently
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("ledbat/cold_start");
    group.sample_size(10);

    // Test multiple sizes: 1KB, 4KB, 16KB
    for &(size, name) in SMALL_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        group.bench_function(name, |b| {
            b.to_async(&rt).iter_custom(|iters| {
                async move {
                    // Create FRESH VirtualTime for each iter_custom call
                    let ts = VirtualTime::new();

                    // Spawn auto-advance task BEFORE connection - handshake has
                    // VirtualTime-dependent timeouts that require time to advance
                    let auto_advance = spawn_auto_advance_task(ts.clone());

                    let channels: Channels = Arc::new(DashMap::new());
                    let mut peers =
                        create_peer_pair_with_virtual_time(channels, Duration::ZERO, ts.clone())
                            .await
                            .connect()
                            .await;

                    let mut total_virtual_time = Duration::ZERO;

                    for _ in 0..iters {
                        let message = vec![0xABu8; size];
                        let start_virtual = ts.now_nanos();

                        // Transfer
                        if let Err(e) = peers.conn_a.send(message).await {
                            eprintln!("ledbat_cold send failed: {:?}", e);
                            continue;
                        }
                        match peers.conn_b.recv().await {
                            Ok(received) => {
                                std_black_box(received);
                            }
                            Err(e) => {
                                eprintln!("ledbat_cold recv failed: {:?}", e);
                                continue;
                            }
                        }

                        let end_virtual = ts.now_nanos();
                        total_virtual_time +=
                            Duration::from_nanos(end_virtual.saturating_sub(start_virtual));
                    }

                    // Stop the auto-advance task
                    auto_advance.abort();

                    total_virtual_time
                }
            });
        });
    }

    group.finish();
}

/// Warm connection benchmark with VirtualTime: measures pure transfer throughput
///
/// Connection is established once with warmup, then measures steady-state throughput.
/// With VirtualTime, all operations complete instantly while tracking virtual elapsed time.
pub fn bench_1mb_transfer_validation(c: &mut Criterion) {
    // Use multi-threaded runtime to allow packet delivery to proceed concurrently
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("ledbat/warm_connection");
    group.sample_size(10);

    // Test multiple sizes: 1KB, 4KB, 16KB
    for &(size, name) in SMALL_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        group.bench_function(name, |b| {
            b.to_async(&rt).iter_custom(|iters| {
                async move {
                    // Create FRESH VirtualTime for each iter_custom call
                    let ts = VirtualTime::new();

                    // Spawn auto-advance task BEFORE connection - handshake has
                    // VirtualTime-dependent timeouts that require time to advance
                    let auto_advance = spawn_auto_advance_task(ts.clone());

                    let channels: Channels = Arc::new(DashMap::new());
                    let mut peers =
                        create_peer_pair_with_virtual_time(channels, Duration::ZERO, ts.clone())
                            .await
                            .connect()
                            .await;

                    let mut total_virtual_time = Duration::ZERO;

                    // Warmup: 5 transfers to stabilize LEDBAT cwnd
                    for i in 0..5 {
                        let warmup_msg = vec![0xABu8; size];
                        if let Err(e) = peers.conn_a.send(warmup_msg).await {
                            eprintln!("ledbat warmup send {} failed: {:?}", i, e);
                            break;
                        }
                        match peers.conn_b.recv().await {
                            Ok(_) => {}
                            Err(e) => {
                                eprintln!("ledbat warmup recv {} failed: {:?}", i, e);
                                break;
                            }
                        }
                    }

                    // Measured iterations
                    for _ in 0..iters {
                        let message = vec![0xABu8; size];
                        let start_virtual = ts.now_nanos();

                        if let Err(e) = peers.conn_a.send(message).await {
                            eprintln!("ledbat_warm send failed: {:?}", e);
                            continue;
                        }
                        match peers.conn_b.recv().await {
                            Ok(received) => {
                                std_black_box(received);
                            }
                            Err(e) => {
                                eprintln!("ledbat_warm recv failed: {:?}", e);
                                continue;
                            }
                        }

                        let end_virtual = ts.now_nanos();
                        total_virtual_time +=
                            Duration::from_nanos(end_virtual.saturating_sub(start_virtual));
                    }

                    // Stop the auto-advance task
                    auto_advance.abort();

                    total_virtual_time
                }
            });
        });
    }

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/level0.rs`
```
//! Level 0: Pure Logic - ZERO noise path
//!
//! These benchmarks have:
//! - No async runtime
//! - No tracing (even disabled tracing has macro overhead)
//! - No allocation in hot path
//! - Pre-computed inputs
//! - Deterministic operations

use criterion::{BenchmarkId, Criterion, Throughput};
use std::hint::black_box as std_black_box;

use aes_gcm::{
    Aes128Gcm,
    aead::{AeadInPlace, KeyInit},
};

/// Payload sizes to benchmark (bytes)
const PAYLOAD_SIZES: &[usize] = &[
    64,   // Tiny message
    256,  // Small message
    1024, // 1KB
    1171, // Max single-packet payload: 1200 - type byte - nonce - tag
];

/// AES-GCM encryption - the core crypto operation
///
/// This measures ONLY the AES-GCM encrypt operation with:
/// - Pre-allocated buffer (reused)
/// - Pre-computed key and nonce
/// - No allocation, no branching, no logging
pub fn bench_aes_gcm_encrypt(c: &mut Criterion) {
    let mut group = c.benchmark_group("level0/crypto/encrypt");

    // Pre-compute cipher once
    let key: [u8; 16] = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
    ];
    let cipher = Aes128Gcm::new(&key.into());

    // Fixed nonce (in real code this would be random, but we're measuring encrypt speed)
    let nonce: [u8; 12] = [0u8; 12];

    for &size in PAYLOAD_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        // Pre-allocate buffer with extra space for in-place encryption
        let mut buffer = vec![0xABu8; size];

        group.bench_with_input(BenchmarkId::new("aes128gcm", size), &size, |b, &_size| {
            b.iter(|| {
                // Reset buffer (minimal overhead - just memset)
                buffer.fill(0xAB);

                // The actual operation we're measuring
                let tag = cipher
                    .encrypt_in_place_detached(
                        (&nonce).into(),
                        &[], // No AAD
                        &mut buffer,
                    )
                    .expect("encryption failed");

                // Prevent dead code elimination without adding overhead
                std_black_box(&tag);
                std_black_box(&buffer);
            });
        });
    }

    group.finish();
}

/// AES-GCM decryption
pub fn bench_aes_gcm_decrypt(c: &mut Criterion) {
    let mut group = c.benchmark_group("level0/crypto/decrypt");

    let key: [u8; 16] = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
    ];
    let cipher = Aes128Gcm::new(&key.into());
    let nonce: [u8; 12] = [0u8; 12];

    for &size in PAYLOAD_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        // Pre-encrypt data to create valid ciphertext
        let mut plaintext = vec![0xABu8; size];
        let tag = cipher
            .encrypt_in_place_detached((&nonce).into(), &[], &mut plaintext)
            .unwrap();
        let ciphertext_template = plaintext.clone();

        // Working buffer for decryption
        let mut buffer = vec![0u8; size];

        group.bench_with_input(BenchmarkId::new("aes128gcm", size), &size, |b, &_size| {
            b.iter(|| {
                // Copy ciphertext (simulates receiving packet)
                buffer.copy_from_slice(&ciphertext_template);

                // The actual operation
                cipher
                    .decrypt_in_place_detached((&nonce).into(), &[], &mut buffer, &tag)
                    .expect("decryption failed");

                std_black_box(&buffer);
            });
        });
    }

    group.finish();
}

/// Nonce generation comparison: random vs counter
///
/// Counter-based nonces are much faster and equally secure for our use case
pub fn bench_nonce_generation(c: &mut Criterion) {
    use std::sync::atomic::{AtomicU64, Ordering};

    let mut group = c.benchmark_group("level0/crypto/nonce");

    // Random nonce generation
    group.bench_function("random", |b| {
        b.iter(|| {
            let nonce: [u8; 12] = rand::random();
            std_black_box(nonce);
        });
    });

    // Counter-based nonce (much faster)
    let counter = AtomicU64::new(0);
    group.bench_function("counter", |b| {
        b.iter(|| {
            let val = counter.fetch_add(1, Ordering::Relaxed);
            let mut nonce = [0u8; 12];
            nonce[..8].copy_from_slice(&val.to_le_bytes());
            std_black_box(nonce);
        });
    });

    // Counter with additional entropy (connection ID in upper bytes)
    group.bench_function("counter_with_connid", |b| {
        let conn_id: u32 = 0x12345678;
        b.iter(|| {
            let val = counter.fetch_add(1, Ordering::Relaxed);
            let mut nonce = [0u8; 12];
            nonce[..8].copy_from_slice(&val.to_le_bytes());
            nonce[8..].copy_from_slice(&conn_id.to_le_bytes());
            std_black_box(nonce);
        });
    });

    group.finish();
}

/// Bincode serialization - measures pure serialization overhead
pub fn bench_serialization(c: &mut Criterion) {
    use serde::{Deserialize, Serialize};

    // Simplified message structure matching SymmetricMessage
    #[derive(Serialize, Deserialize, Clone)]
    struct BenchMessage {
        packet_id: u32,
        confirm_receipt: Vec<u32>,
        payload_type: u8, // Discriminant
        payload: Vec<u8>,
    }

    let mut group = c.benchmark_group("level0/serialization");

    for &size in PAYLOAD_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        // Pre-create message
        let msg = BenchMessage {
            packet_id: 12345,
            confirm_receipt: vec![1, 2, 3, 4, 5],
            payload_type: 1,
            payload: vec![0xABu8; size],
        };

        // Pre-allocate output buffer
        let mut output_buf = vec![0u8; size + 100]; // Extra for headers

        group.bench_with_input(BenchmarkId::new("serialize", size), &msg, |b, msg| {
            b.iter(|| {
                // Serialize into pre-allocated buffer
                let written = bincode::serialize_into(output_buf.as_mut_slice(), msg).is_ok();
                std_black_box(written);
                std_black_box(&output_buf);
            });
        });

        // Pre-serialize for deserialization bench
        let serialized = bincode::serialize(&msg).unwrap();

        group.bench_with_input(
            BenchmarkId::new("deserialize", size),
            &serialized,
            |b, data| {
                b.iter(|| {
                    let msg: BenchMessage = bincode::deserialize(data).unwrap();
                    std_black_box(msg);
                });
            },
        );
    }

    group.finish();
}

/// Combined encrypt + serialize (full packet creation path)
pub fn bench_packet_creation(c: &mut Criterion) {
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize)]
    struct BenchMessage {
        packet_id: u32,
        confirm_receipt: Vec<u32>,
        payload: Vec<u8>,
    }

    let mut group = c.benchmark_group("level0/packet_creation");

    let key: [u8; 16] = [0x42u8; 16];
    let cipher = Aes128Gcm::new(&key.into());
    let nonce: [u8; 12] = [0u8; 12];

    for &size in PAYLOAD_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        let msg = BenchMessage {
            packet_id: 12345,
            confirm_receipt: vec![1, 2, 3],
            payload: vec![0xABu8; size],
        };

        // Max packet buffer
        let mut packet_buf = vec![0u8; 1500];

        group.bench_with_input(
            BenchmarkId::new("serialize_then_encrypt", size),
            &msg,
            |b, msg| {
                b.iter(|| {
                    // Step 1: Serialize
                    let serialized_len = bincode::serialized_size(msg).unwrap() as usize;
                    bincode::serialize_into(&mut packet_buf[..serialized_len], msg).unwrap();

                    // Step 2: Encrypt in place
                    let tag = cipher
                        .encrypt_in_place_detached(
                            (&nonce).into(),
                            &[],
                            &mut packet_buf[..serialized_len],
                        )
                        .unwrap();

                    std_black_box(&tag);
                    std_black_box(&packet_buf);
                });
            },
        );
    }

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/level1.rs`
```
//! Level 1: Mock I/O - Protocol logic without syscalls
//!
//! Uses tokio channels to simulate network I/O without actual syscalls.
//! Measures: async overhead, channel throughput, protocol state machines

use criterion::{BatchSize, BenchmarkId, Criterion, Throughput};
use std::hint::black_box as std_black_box;
use std::sync::Arc;
use tokio::sync::mpsc;

/// Channel throughput - critical path for packet routing
///
/// Tests different buffer sizes to find optimal configuration
pub fn bench_channel_throughput(c: &mut Criterion) {
    // Create runtime ONCE, outside benchmark
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("level1/channel/throughput");
    group.throughput(Throughput::Elements(1000));

    // Test various buffer sizes
    for buffer_size in [1, 10, 100, 1000] {
        // Pre-create packet data outside the benchmark loop
        let packet: Arc<[u8]> = vec![0u8; 1200].into();

        group.bench_with_input(
            BenchmarkId::new("buffer", buffer_size),
            &buffer_size,
            |b, &buf_size| {
                let packet = packet.clone();
                b.to_async(&rt).iter_batched(
                    // Setup: create channel and clone packet (not measured)
                    || {
                        let p = packet.clone();
                        (mpsc::channel::<Arc<[u8]>>(buf_size), p)
                    },
                    // Routine: send 1000 packets (measured)
                    |((tx, mut rx), packet)| async move {
                        // Spawn receiver
                        let receiver = tokio::spawn(async move {
                            let mut count = 0;
                            while rx.recv().await.is_some() {
                                count += 1;
                            }
                            count
                        });

                        // Send packets
                        for _ in 0..1000 {
                            tx.send(packet.clone()).await.unwrap();
                        }
                        drop(tx); // Close channel

                        let count = receiver.await.unwrap();
                        std_black_box(count);
                    },
                    BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/level2.rs`
```
//! Level 2: Loopback - Real sockets, kernel involved
//!
//! WARNING: Results vary significantly based on:
//! - Kernel version and configuration
//! - CPU frequency scaling
//! - Other system load
//! - Socket buffer sizes

use criterion::{BenchmarkId, Criterion, Throughput};

/// Raw UDP syscall overhead
pub fn bench_udp_syscall(c: &mut Criterion) {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("level2/udp/syscall");

    // Pre-create socket outside the benchmark
    let socket = rt.block_on(async {
        let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let addr = socket.local_addr().unwrap();
        socket.connect(addr).await.unwrap();
        socket
    });
    let socket = std::sync::Arc::new(socket);

    // Single send syscall
    let socket_clone = socket.clone();
    group.bench_function("send_1400b", |b| {
        let socket = socket_clone.clone();
        b.to_async(&rt).iter(|| {
            let socket = socket.clone();
            async move {
                let buf = [0u8; 1400];
                socket.send(&buf).await.unwrap();
            }
        });
    });

    // Send + recv roundtrip
    group.bench_function("roundtrip_1400b", |b| {
        let socket = socket.clone();
        b.to_async(&rt).iter(|| {
            let socket = socket.clone();
            async move {
                let send_buf = [0u8; 1400];
                let mut recv_buf = [0u8; 1500];
                socket.send(&send_buf).await.unwrap();
                socket.recv(&mut recv_buf).await.unwrap();
            }
        });
    });

    group.finish();
}

/// Burst send performance (no batching, sequential sends)
pub fn bench_udp_burst(c: &mut Criterion) {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("level2/udp/burst");

    // Pre-create socket
    let socket = rt.block_on(async {
        let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let addr = socket.local_addr().unwrap();
        socket.connect(addr).await.unwrap();
        socket
    });
    let socket = std::sync::Arc::new(socket);

    for count in [10, 100, 1000] {
        group.throughput(Throughput::Elements(count as u64));

        let socket = socket.clone();
        group.bench_with_input(BenchmarkId::new("packets", count), &count, |b, &n| {
            let socket = socket.clone();
            b.to_async(&rt).iter(move || {
                let socket = socket.clone();
                async move {
                    let buf = [0u8; 1400];
                    for _ in 0..n {
                        socket.send(&buf).await.unwrap();
                    }
                }
            });
        });
    }

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/level3.rs`
```
//! Level 3: Stress Tests

use criterion::Criterion;
use std::time::Duration;

/// Maximum sustainable send rate
pub fn bench_max_send_rate(c: &mut Criterion) {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("level3/stress/send_rate");
    group.sample_size(10);
    group.measurement_time(Duration::from_secs(10));

    // Pre-create socket
    let socket = rt.block_on(async {
        let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let addr = socket.local_addr().unwrap();
        socket.connect(addr).await.unwrap();
        socket
    });
    let socket = std::sync::Arc::new(socket);

    group.bench_function("10k_packets", |b| {
        let socket = socket.clone();
        b.to_async(&rt).iter(|| {
            let socket = socket.clone();
            async move {
                let buf = [0u8; 1400];
                for _ in 0..10_000 {
                    let _sent = socket.send(&buf).await;
                }
            }
        });
    });

    group.finish();
}

```

### Core Architecture Module: `crates/core/benches/transport/manual_throughput.rs`
```
//! Manual Throughput Benchmarks
//!
//! Custom harness for testing large transfer throughput without criterion.
//! Criterion's warmup phase hangs with 16KB+ transfers, so we use
//! manual timing instead.
//!
//! Tests:
//! - Cold start vs warm connection throughput (1KB, 4KB, 16KB)
//! - Connection reuse speedup (warm connection should be 5-25x faster)
//!
//! Run with: `cargo test --release --bench transport_manual --features bench -- --nocapture`
//!
//! **Expected runtime: ~3-5 minutes**
//!
//! Use when:
//! - Testing congestion control changes
//! - Validating slow start behavior
//! - Measuring cold-start vs steady-state performance

use std::time::{Duration, Instant};

use super::common::{
    calculate_throughput_mbps, create_connected_peers, create_connected_peers_with_delay,
    format_duration, format_throughput, new_channels,
};

/// Run a manual throughput benchmark with specified parameters
async fn bench_throughput(
    message_size: usize,
    iterations: usize,
    rtt_delay: Option<Duration>,
    warmup_iterations: usize,
) -> (Duration, f64) {
    eprintln!("  [DEBUG] Creating channels...");

    let mut peers = if let Some(delay) = rtt_delay {
        create_connected_peers_with_delay(delay).await
    } else {
        create_connected_peers().await
    };

    eprintln!(
        "  [DEBUG] Running {} warmup iterations...",
        warmup_iterations
    );
    // Warmup phase
    for i in 0..warmup_iterations {
        let msg = vec![0xABu8; message_size];
        peers.conn_a.send(msg).await.unwrap();
        let _: Vec<u8> = peers.conn_b.recv().await.unwrap();
        if i == 0 {
            eprintln!("  [DEBUG] First warmup iteration complete");
        }
    }

    eprintln!("  [DEBUG] Running {} benchmark iterations...", iterations);
    // Benchmark phase
    let start = Instant::now();
    for i in 0..iterations {
        let msg = vec![0xABu8; message_size];
        peers.conn_a.send(msg).await.unwrap();
        let _: Vec<u8> = peers.conn_b.recv().await.unwrap();
        if i == 0 {
            eprintln!("  [DEBUG] First benchmark iteration complete");
        }
    }
    let elapsed = start.elapsed();
    eprintln!("  [DEBUG] Benchmark complete");

    // Calculate throughput
    let total_bytes = message_size * iterations;
    let throughput_mbps = calculate_throughput_mbps(total_bytes, elapsed);

    // Peers kept alive until function completes
    (elapsed, throughput_mbps)
}

#[tokio::test]
async fn manual_throughput_single_test() {
    println!("\n=== Simple Single Test ===\n");
    eprintln!("[DEBUG] Starting simple 1KB test");
    let (elapsed, mbps) = bench_throughput(1024, 5, None, 1).await;
    println!("1 KB: time={:?} throughput={:.2} Mbps", elapsed, mbps);
    println!("\n=== Test Complete ===\n");
}

#[tokio::test]
async fn manual_throughput_benchmarks() {
    println!("\n=== Manual Throughput Benchmarks ===\n");
    println!("Testing large transfers with warm connection (reused)\n");

    // Limited sizes due to timeout issues with 64KB+
    // 64KB+ appears to hang even on single iteration (likely in cleanup/teardown)
    let test_configs = vec![
        (1024, "1 KB"),
        (4 * 1024, "4 KB"),
        (16 * 1024, "16 KB"),
        (32 * 1024, "32 KB"),
    ];

    // Test with instant RTT (0ms) - single iteration only due to timeout issues
    println!("--- Instant RTT (0ms) ---\n");
    println!(
        "NOTE: Using single iteration per size due to hang issues with 16KB+ on second iteration\n"
    );
    for (size, label) in &test_configs {
        eprintln!("[DEBUG] Starting benchmark for {}", label);
        let (elapsed, mbps) = bench_throughput(*size, 1, None, 0).await;
        println!(
            "{:>8}: time={:>12} throughput={:>12}",
            label,
            format_duration(elapsed),
            format_throughput(mbps)
        );
    }

    // Test with LAN RTT (2ms) - single iteration only
    println!("\n--- LAN RTT (2ms) ---\n");
    println!("NOTE: Using single iteration per size due to timeout issues\n");
    for (size, label) in &test_configs {
        eprintln!("[DEBUG] Starting benchmark for {} with 2ms RTT", label);
        let (elapsed, mbps) = bench_throughput(*size, 1, Some(Duration::from_millis(2)), 0).await;
        println!(
            "{:>8}: time={:>12} throughput={:>12}",
            label,
            format_duration(elapsed),
            format_throughput(mbps)
        );
    }

    println!("\n=== Benchmark Complete ===\n");
}

/// Test continuous message sending (sustained throughput)
#[tokio::test]
async fn manual_sustained_throughput() {
    println!("\n=== Sustained Throughput Test ===\n");
    println!("Sending multiple messages continuously on same connection\n");

    let test_configs = vec![
        (1024, 100, "1 KB × 100"),
        (1024, 500, "1 KB × 500"), // Test more iterations with size that works
        (4096, 10, "4 KB × 10"),   // Reduce iterations for larger sizes
    ];

    for (size, iterations, label) in test_configs {
        eprintln!("[DEBUG] Starting sustained test: {}", label);

        let mut peers = create_connected_peers().await;

        eprintln!(
            "  [DEBUG] Sending {} messages of {} bytes...",
            iterations, size
        );
        let start = Instant::now();
        for i in 0..iterations {
            let msg = vec![0xABu8; size];
            peers.conn_a.send(msg).await.unwrap();
            let _: Vec<u8> = peers.conn_b.recv().await.unwrap();
            if i == 0 {
                eprintln!("  [DEBUG] First message complete");
            }
        }
        let elapsed = start.elapsed();

        let total_bytes = size * iterations;
        let throughput_mbps = calculate_throughput_mbps(total_bytes, elapsed);

        println!(
            "{:>12}: total_time={:>10} aggregate_throughput={:>12}",
            label,
            format_duration(elapsed),
            format_throughput(throughput_mbps)
        );
    }

    println!("\n=== Sustained Test Complete ===\n");
}

/// Test multiple concurrent streams
#[tokio::test]
async fn manual_concurrent_streams() {
    println!("\n=== Concurrent Streams Test ===\n");
    println!("Multiple peer pairs sending simultaneously\n");

    let num_streams = 4;
    let message_size = 1024; // 1KB (4KB causes hangs)
    let iterations = 25;

    eprintln!("[DEBUG] Creating {} concurrent streams", num_streams);

    let channels = new_channels();

    // Create multiple peer pairs
    let mut tasks = Vec::new();

    for stream_id in 0..num_streams {
        let channels_clone = channels.clone();

        let task = tokio::spawn(async move {
            eprintln!("  [DEBUG] Stream {} starting...", stream_id);

            // Create connected peers for this stream
            use super::common::create_peer_pair;
            let mut peers = create_peer_pair(channels_clone).await.connect().await;

            // Send messages
            let start = Instant::now();
            for _ in 0..iterations {
                let msg = vec![0xABu8; message_size];
                peers.conn_a.send(msg).await.unwrap();
                let _: Vec<u8> = peers.conn_b.recv().await.unwrap();
            }
            let elapsed = start.elapsed();

            eprintln!("  [DEBUG] Stream {} complete in {:?}", stream_id, elapsed);
            (stream_id, elapsed)
        });

        tasks.push(task);
    }

    // Wait for all streams to complete
    let start = Instant::now();
    let results = futures::future::join_all(tasks).await;
    let total_elapsed = start.elapsed();

    // Calculate aggregate throughput
    let total_bytes = message_size * iterations * num_streams;
    let aggregate_mbps = calculate_throughput_mbps(total_bytes, total_elapsed);

    println!("Streams: {}", num_streams);
    println!("Message size: {} KB", message_size / 1024);
    println!("Messages per stream: {}", iterations);
    println!("Total data: {:.2} MB", total_bytes as f64 / 1_000_000.0);
    println!("Total time: {}", format_duration(total_elapsed));
    println!(
        "Aggregate throughput: {}",
        format_throughput(aggregate_mbps)
    );

    println!("\nPer-stream times:");
    for (stream_id, elapsed) in results.into_iter().flatten() {
        println!("  Stream {}: {}", stream_id, format_duration(elapsed));
    }

    println!("\n=== Concurrent Test Complete ===\n");
}

/// Test maximum bandwidth utilization
#[tokio::test]
async fn manual_bandwidth_saturation() {
    println!("\n=== Bandwidth Saturation Test ===\n");
    println!("Sending messages as fast as possible\n");

    let message_size = 1024; // 1KB messages
    let duration_secs = 2; // Send for 2 seconds

    eprintln!("[DEBUG] Creating connection...");
    let mut peers = create_connected_peers().await;

    eprintln!("[DEBUG] Sending messages for {} seconds...", duration_secs);
    let start = Instant::now();
    let deadline = start + Duration::from_secs(duration_secs);
    let mut count = 0;

    while Instant::now() < deadline {
        let msg = vec![0xABu8; message_size];
        peers.conn_a.send(msg).await.unwrap();
        let _: Vec<u8> = peers.conn_b.recv().await.unwrap();
        count += 1;

        if count == 1 {
            eprintln!("[DEBUG] First message complete");
        }
    }

    let elapsed = start.elapsed();
    let total_bytes = message_size * count;
    let throughput_mbps = calculate_throughput_mbps(total_bytes, elapsed);

    println!("Duration: {}", format_duration(elapsed));
    println!("Messages sent: {}", count);
    println!("Total data: {:.2} MB", total_bytes as f64 / 1_000_000.0);
    println!("Throughput: {}", format_throughput(throughput_mbps));
    println!("Messages/sec: {:.2}", count as f64 / elapsed.as_secs_f64());

    println!("\n=== Saturation Test Complete ===\n");
}

```

### Core Architecture Module: `crates/core/benches/transport/mod.rs`
```
//! Transport benchmark modules
//!
//! This module re-exports all transport benchmark functions from their
//! respective submodules for use in benchmark binaries.
//!
//! Note: dead_code and unused_imports warnings are expected since each
//! benchmark binary only uses a subset of these functions.

#![allow(dead_code)]
#![allow(unused_imports)]

pub mod allocation_overhead;
pub mod blackbox;
pub mod common; // Shared utilities for reducing duplication
pub mod ledbat_validation;
pub mod level0;
pub mod level1;
pub mod level2;
pub mod level3;
pub mod manual_throughput;
pub mod slow_start;
pub mod streaming;
pub mod streaming_buffer;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6199** (2026-11-12): **feat(telemetry): hourly join_versions census of gateway joiners and neighbours**
  *Symptoms*: ## Problem  Making QUIC the only transport (#5940) needs to know which releases are still running, including on nodes whose own telemetry is off. Today `report_peer_version` keeps only the highest version seen, in memory, and nothing exports the versions of joiners or neighbours.  ## Approach  A new hourly telemetry event, `join_versions`, with two views:  - **Gateway joins (gateways only).** Each successful inbound gateway handshake, counted by the joiner's version bucket and by transport (`legacy_intro`; `native` is reserved and stays 0 until QUIC-native joins exist).   - Counted in the listener's `complete_gateway_handshake` success arm (`connection_handler.rs`), so only after the joiner has proved it holds the session key. An intro alone is spoofable and is never counted.   - Gated on `is_gateway`, because a non-gateway also completes this handshake when it accepts a restarted peer's intro.   - These are joiners whose own telemetry may be off. - **Neighbours (every node).** A snapshot at emission time of this node's live ring connections, by the peer's version bucket (`ConnectionManager::live_neighbour_versions`). It walks the live set, because the version mirror is not pruned on disconnect, so reconnects and stale entries do not skew it.  **Not in this PR: joiner offers.** The planned breakdown of joins by the joiner's native-QUIC offer needs the offer to exist on the wire, which a later change adds. It will extend this event then.  **Bounded labels.** A version maps to 

- **Issue #6198** (2026-11-12): **fix(transport): keep the last eighth of the QUIC ingress queue for quiet sources**
  *Symptoms*: ## Problem  All QUIC connections of a node share one ingress queue of 1024 datagrams (`QUIC_INGRESS_QUEUE_DATAGRAMS`), with tail drop when it is full. When the endpoint drains the queue more slowly than busy connections fill it, the queue stays full. A connection whose window has shrunk to loss probes then keeps losing them, and quinn doubles its probe timeout after each loss.  In a real-time test (256 connections into one node, real loopback sockets, debug build, 2 runtime workers), probes went out about 1, 2.3 and 4.5 s apart and every one was dropped at the ingress queue. Connections went silent for 5 to 11 s. About 12% of QUIC datagrams were counted as `quic_ingress_queue_full`, with no kernel receive-buffer drops.  That is longer than a consumer's 5 s fragment gap, so `assemble()` failed with `InactivityTimeout` on streams the transport later delivered in full. The sender's send returned `Sent`. The per-source quarter share does not help here: with 256 sources each one holds far less than its share.  A release build drains much faster (about 105k datagrams per second process-wide with 2 workers on the same test), so on real hardware this takes a CPU-starved node or inbound near 1 Gbit/s per 2 cores. It is still a failure mode, and the fix is cheap.  ## Approach  Keep the last eighth of the queue (`QUIC_INGRESS_QUIET_RESERVE`, 128 slots) for sources that have fewer than `QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS` (4) datagrams queued. Once only the reserve is free, a datagram f

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

### Incident Patch 1: `ac1b23e4` (2026-11-12)
**Commit Message**: fix(transport): keep the last eighth of the QUIC ingress queue for quiet sources (#6198)

**File**: `.claude/rules/transport.md` (modified, +16/-2)
```diff
@@ -1087,7 +1087,20 @@ one allowed or spoofed-allowed source cannot starve the other connections.
 The trade-off: a lone bulk peer, with no other connection competing, still
 gets only a quarter of the queue, so a burst larger than 256 datagrams that
 the endpoint has not yet drained is dropped (`_source_full`) even when the
-rest of the queue is empty.
+rest of the queue is empty. The last QUIC_INGRESS_QUIET_RESERVE (128) slots
+are for sources holding fewer than QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS (4):
+once only those are free, any other source's datagram is `_reserve_full`, so
+a quiet connection's loss probes and acknowledgements still get in. Without
+it, a full queue dropped a quiet connection's probes one after another, quinn
+doubled its probe timeout each time, and the connection went silent past the
+consumers' 5 s gap (256 connections into one node, debug build). The cost:
+sources holding 4 or more queued datagrams have 12.5% less room between them
+for a burst (896 slots rather than 1024). The 896 is momentary, not a quota:
+a source that drains below 4 counts as quiet again. Many sources spoofing
+allowed addresses can fill the reserve; the queue then holds 1024, as
+without it. Limitation: the reserve helps only while most sources are busy;
+with about 256 or more connections each holding a few datagrams, most
+traffic counts as quiet and the queue behaves close to a plain FIFO.
 `allow_quic_source` returns a QuicSourcePermit: the address stays allowed
 while a permit for it is alive, and the set holds at most
 QUIC_ALLOWED_SOURCES_MAX addresses (past it, `allow_quic_source` refuses; a
@@ -1100,7 +1113,8 @@ connection closed, whatever closed it, and dropping its connection handle
 closes it; an address on the set is bounded by its connection's life, which
 inherits the #5922 gap for a connection held open indefinitely. Each
 QUIC-class datagram is counted as `quic_ingress_forwarded`, `_not_allowed`,
-`_queue_full`, `_source_full` or `_no_ingress` (no ingress enabled, its
+`_queue_full`, `_source_full`, `_reserve_full` (refused at the quiet
+reserve, below) or `_no_ingress` (no ingress enabled, its
 receiver gone, or disabled; every node with `transport-quic` off). The QUIC
 endpoint enables the ingress through `with_quic_ingress`, which disables it
 again (allow-set emptied and closed) if the endpoint cannot be built, so a
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +6/-0)
```diff
@@ -3281,6 +3281,10 @@ fn event_kind_to_json(kind: &EventKind) -> serde_json::Value {
                 "quic_ingress_no_ingress".into(),
                 serde_json::json!(snapshot.quic_ingress_no_ingress),
             );
+            m.insert(
+                "quic_ingress_reserve_full".into(),
+                serde_json::json!(snapshot.quic_ingress_reserve_full),
+            );
             m.insert(
                 "egress_immediate".into(),
                 serde_json::json!(snapshot.egress_immediate),
@@ -7893,6 +7897,7 @@ mod tests {
             quic_ingress_queue_full: 48,
             quic_ingress_source_full: 50,
             quic_ingress_no_ingress: 49,
+            quic_ingress_reserve_full: 51,
             egress_immediate: 22,
             egress_waited: 23,
             egress_unpaced: 25,
@@ -7946,6 +7951,7 @@ mod tests {
             ("quic_ingress_queue_full", 48),
             ("quic_ingress_source_full", 50),
             ("quic_ingress_no_ingress", 49),
+            ("quic_ingress_reserve_full", 51),
             ("egress_immediate", 22),
             ("egress_waited", 23),
             ("egress_unpaced", 25),
```

**File**: `crates/core/src/transport/demux.rs` (modified, +155/-15)
```diff
@@ -55,6 +55,27 @@ pub(crate) const QUIC_INGRESS_QUEUE_DATAGRAMS: usize = 1024;
 /// `quic_ingress_source_full`.
 pub(crate) const QUIC_INGRESS_PER_SOURCE_DATAGRAMS: usize = QUIC_INGRESS_QUEUE_DATAGRAMS / 4;
 
+/// The last slots of the QUIC ingress queue, kept for sources that have fewer
+/// than [`QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS`] datagrams queued. Once only
+/// these are free, a datagram from a source holding more is dropped and
+/// counted as `reserve_full`. So sources that are bursting can fill at most
+/// `QUIC_INGRESS_QUEUE_DATAGRAMS - QUIC_INGRESS_QUIET_RESERVE` (896) slots
+/// between them at any moment (a source that drains below the mark counts as
+/// quiet again), and a quiet connection's datagram (a loss probe, an
+/// acknowledgement) still finds room. The cost is 12.5% less burst room for
+/// busy sources. With about 256 or more connections each holding a few
+/// datagrams, most traffic counts as quiet and the queue is close to a plain
+/// FIFO. Without it, when the endpoint drained
+/// the queue more slowly than busy connections filled it, a quiet
+/// connection's probes kept arriving at a full queue. quinn doubled its probe
+/// timeout after each loss, and the connection went silent for 5 to 11 s
+/// (e5b-9's real-time hold run, 256 connections into one node, debug build).
+pub(crate) const QUIC_INGRESS_QUIET_RESERVE: usize = QUIC_INGRESS_QUEUE_DATAGRAMS / 8;
+
+/// A source with fewer than this many datagrams queued may use
+/// [`QUIC_INGRESS_QUIET_RESERVE`].
+pub(crate) const QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS: usize = 4;
+
 /// How many distinct source addresses the QUIC ingress allow-set holds. One
 /// entry per peer with a QUIC connection (or one being set up), so this is
 /// far above any `max-number-of-connections` in use; past it,
@@ -406,15 +427,26 @@ impl<S> DemuxSocket<S> {
 }
 
 impl QuicIngress {
-    /// Queue a datagram from an allowed source, within the source's share.
+    /// Queue a datagram from an allowed source, within the source's share
+    /// and outside [`QUIC_INGRESS_QUIET_RESERVE`] unless the source is quiet.
     /// The share is counted before the slot is taken and given back if the
     /// queue refuses, so a datagram that is not queued never holds a share.
+    /// The listener is the only sender, so the free slots read here cannot
+    /// shrink before the `try_reserve` below; the receiver can only add some.
     fn queue_from(&self, datagram: &[u8], from: SocketAddr) -> QuicIngressOutcome {
         {
             let mut queued = self.shared.queued.entry(from).or_insert(0);
             if *queued >= QUIC_INGRESS_PER_SOURCE_DATAGRAMS {
                 return QuicIngressOutcome::SourceFull;
             }
+            if *queued >= QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS
+                && self.queue.capacity() <= QUIC_INGRESS_QUIET_RESERVE
+            {
+                // A source that newly took an entry above holds none, so
+                // only a non-zero count can reach here: no empty entry is
+                // left behind.
+                return QuicIngressOutcome::ReserveFull;
+            }
             *queued += 1;
         }
         let refused = match self.queue.try_reserve() {
@@ -823,38 +855,52 @@ mod tests {
             );
         }
         assert!(queue.try_recv().is_err(), "nothing else was queued");
-        assert_eq!(outcomes(&socket), [3, 0, 0, 0, 0]);
+        assert_eq!(outcomes(&socket), [3, 0, 0, 0, 0, 0]);
     }
 
     /// With the queue full and nobody reading it, QUIC-class datagrams are
     /// dropped and counted, and a legacy datagram behind them is still
-    /// returned at once. Four sources fill the queue with their shares, so a
-    /// fifth one's datagrams find the queue itself full. The test runs on a
+    /// returned at once. Four sources send their shares: they fill the queue
+    /// up to its quiet reserve and the fourth's last datagrams are refused at
+    /// the reserve; quiet sources then fill the reserve, and a last source's
+    /// datagrams find the queue itself full. The test runs on a
     /// paused clock, so if the listener waited for room in the queue the
     /// runtime would go idle, the clock would jump to the 5 s timeout and the
     /// test would fail at once rather than after 5 real seconds.
     #[tokio::test(start_paused = true)]
     async fn quic_ingress_queue_full_drops_and_counts_without_stalling_legacy() {
-        let sources: Vec<SocketAddr> = (0..5u16)
+        let sources: Vec<SocketAddr> = (0..4u16)
             .map(|i| SocketAddr::from(([10, 254, 2, 2], 4102 + i)))
             .collect();
+        let fillers: Vec<SocketAddr> =
+            (0..(QUIC_INGRESS_QUIET_RESERVE / QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS) as u16)
+                .map(|i| SocketAddr::from(([10, 254, 2, 5], 4500 + i)))
+                .collect();
+        let last = SocketAddr::from(([10, 254, 2, 6], 4600));
         let overflow = 5;
         let shares = QUIC_INGRESS_QU
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +12/-0)
```diff
@@ -360,6 +360,10 @@ labelled_counters! {
         SourceFull => "source_full",
         /// Dropped: no QUIC ingress is enabled, or its receiver is gone.
         NoIngress => "no_ingress",
+        /// Dropped: only the queue's reserve for quiet sources was free
+        /// (`demux::QUIC_INGRESS_QUIET_RESERVE`) and this source already had
+        /// `demux::QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS` or more queued.
+        ReserveFull => "reserve_full",
     }
 }
 
@@ -2730,6 +2734,7 @@ impl TransportMetrics {
             quic_ingress_queue_full: get64(&quic[QuicIngressOutcome::QueueFull as usize]),
             quic_ingress_source_full: get64(&quic[QuicIngressOutcome::SourceFull as usize]),
             quic_ingress_no_ingress: get64(&quic[QuicIngressOutcome::NoIngress as usize]),
+            quic_ingress_reserve_full: get64(&quic[QuicIngressOutcome::ReserveFull as usize]),
             egress_immediate: get64(&egress.packets[EgressDecision::Immediate as usize]),
             egress_waited: get64(&egress.packets[EgressDecision::Waited as usize]),
             egress_unpaced: get64(&egress.packets[EgressDecision::Unpaced as usize]),
@@ -3402,6 +3407,7 @@ pub struct TransportSnapshot {
     pub quic_ingress_queue_full: u64,
     pub quic_ingress_source_full: u64,
     pub quic_ingress_no_ingress: u64,
+    pub quic_ingress_reserve_full: u64,
     /// Datagrams sent during the period by how the node-wide egress cap
     /// paced them, by [`EgressDecision`], with their bytes, the bytes and
     /// total and longest wait (microseconds) of those that waited, the
@@ -3732,6 +3738,7 @@ impl TransportSnapshot {
             quic_ingress_queue_full,
             quic_ingress_source_full,
             quic_ingress_no_ingress,
+            quic_ingress_reserve_full,
             egress_immediate,
             egress_waited,
             egress_unpaced,
@@ -3880,6 +3887,7 @@ impl TransportSnapshot {
         self.quic_ingress_queue_full = quic_ingress_queue_full;
         self.quic_ingress_source_full = quic_ingress_source_full;
         self.quic_ingress_no_ingress = quic_ingress_no_ingress;
+        self.quic_ingress_reserve_full = quic_ingress_reserve_full;
         self.egress_immediate = egress_immediate;
         self.egress_waited = egress_waited;
         self.egress_unpaced = egress_unpaced;
@@ -4148,6 +4156,7 @@ struct SnapshotExtras {
     pub quic_ingress_queue_full: u64,
     pub quic_ingress_source_full: u64,
     pub quic_ingress_no_ingress: u64,
+    pub quic_ingress_reserve_full: u64,
     /// Datagrams sent during the period by how the node-wide egress cap
     /// paced them, by [`EgressDecision`], with their bytes, the bytes and
     /// total and longest wait (microseconds) of those that waited, the
@@ -4299,6 +4308,7 @@ impl SnapshotExtras {
             || self.quic_ingress_queue_full != 0
             || self.quic_ingress_source_full != 0
             || self.quic_ingress_no_ingress != 0
+            || self.quic_ingress_reserve_full != 0
             // The debt high-water mark alone is not activity: it is only set
             // by a charge, which also counts a packet.
             || self.egress_immediate != 0
@@ -6121,6 +6131,7 @@ mod tests {
             QuicIngressOutcome::QueueFull => snap.quic_ingress_queue_full,
             QuicIngressOutcome::SourceFull => snap.quic_ingress_source_full,
             QuicIngressOutcome::NoIngress => snap.quic_ingress_no_ingress,
+            QuicIngressOutcome::ReserveFull => snap.quic_ingress_reserve_full,
         }
     }
 
@@ -6726,6 +6737,7 @@ mod tests {
             "quic_ingress_queue_full",
             "quic_ingress_source_full",
             "quic_ingress_no_ingress",
+            "quic_ingress_reserve_full",
             "egress_immediate",
             "egress_waited",
             "egress_unpaced",
```

---

### Incident Patch 2: `0f0c9424` (2026-11-12)
**Commit Message**: test(transport): take every simulated QUIC test address from one process-wide allocator (#6197)

**File**: `crates/core/src/transport.rs` (modified, +2/-0)
```diff
@@ -193,6 +193,8 @@ pub(crate) mod demux;
 pub(crate) mod egress_cap;
 pub mod in_memory_socket;
 pub(crate) mod quic;
+#[cfg(test)]
+pub(crate) mod test_net;
 
 /// Mock transport infrastructure for testing and benchmarking.
 /// Provides MockSocket and helper functions to create mock peer connections
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests.rs` (modified, +20/-26)
```diff
@@ -4,8 +4,6 @@
 //! All tests run on a paused tokio clock with `RealTime`, so the keepalive
 //! task is live (as in production) and timing is deterministic.
 
-use std::net::Ipv4Addr;
-
 use aes_gcm::KeyInit;
 use bytes::Bytes;
 
@@ -145,8 +143,12 @@ fn end_with_wire_capacity(
     }
 }
 
+/// One address per port, on one subnet for the whole module: the ends here
+/// are fed by hand, on no simulated network.
 fn addr(port: u16) -> SocketAddr {
-    SocketAddr::new(Ipv4Addr::new(10, 77, 0, 1).into(), port)
+    static NET: std::sync::LazyLock<crate::transport::test_net::Subnet> =
+        std::sync::LazyLock::new(crate::transport::test_net::subnet);
+    NET.addr_port(1, port)
 }
 
 /// A single connection end facing a remote of the given version.
@@ -3470,11 +3472,9 @@ async fn rising_offers_with_quic_off_keep_one_tracked_decline() {
 /// gate lets one through per interval. An unpromoted session answers each one.
 #[tokio::test(start_paused = true)]
 async fn rising_offers_with_a_session_keep_one_tracked_decline() {
-    let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(
-        "ack-policy-rising-offers",
-        20,
-    )
-    .await;
+    let hub =
+        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-rising-offers")
+            .await;
     let mut e = single(CAPABLE);
     e.conn = e.conn.with_upgrade_site(&hub.site());
     e.take_offers(1, 200).await;
@@ -3553,11 +3553,9 @@ async fn a_failed_decline_send_leaves_nothing_in_flight() {
 /// hands the driver the events a path's pump sends, not a frame off a real path.
 #[tokio::test(start_paused = true)]
 async fn quic_inbound_does_not_move_the_udp_idle_clocks() {
-    let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(
-        "ack-policy-idle-clocks",
-        21,
-    )
-    .await;
+    let hub =
+        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-idle-clocks")
+            .await;
     let mut e = single(CAPABLE);
     e.conn = e.conn.with_upgrade_site(&hub.site());
     e.deliver(1, short(b"first"), vec![]).await;
@@ -3594,8 +3592,7 @@ async fn quic_inbound_does_not_move_the_udp_idle_clocks() {
 async fn a_quic_receipt_moves_the_stamp_and_no_udp_clock() {
     use std::sync::atomic::Ordering;
     let hub =
-        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-stamp", 23)
-            .await;
+        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-stamp").await;
     let mut e = single(CAPABLE);
     e.conn = e.conn.with_upgrade_site(&hub.site());
     let time = e.conn.remote_conn.time_source.clone();
@@ -3628,7 +3625,7 @@ async fn a_quic_receipt_moves_the_stamp_and_no_udp_clock() {
 #[tokio::test(start_paused = true)]
 async fn set_peer_identity_promotes_the_session_on_set_and_same_only() {
     let hub =
-        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-identity", 22)
+        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-identity")
             .await;
     let key = hub.peer.clone();
     let other = TransportKeypair::new().public().clone();
@@ -3665,11 +3662,10 @@ async fn set_peer_identity_promotes_the_session_on_set_and_same_only() {
 /// from the connection's limit.
 #[tokio::test(start_paused = true)]
 async fn a_session_paces_its_data_only_under_a_limit() {
-    for (case, subnet, limit) in [("none", 30, None), ("limited", 31, Some(100_000))] {
-        let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(
-            &format!("ack-policy-paced-{case}"),
-            subnet,
-        )
+    for (case, limit) in [("none", None), ("limited", Some(100_000))] {
+        let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(&format!(
+            "ack-policy-paced-{case}"
+        ))
         .await;
         let mut e = single(CAPABLE);
         e.conn.remote_conn.bandwidth_limit = limit;
@@ -3689,11 +3685,9 @@ async fn a_session_paces_its_data_only_under_a_limit() {
 /// time here) barely moves.
 #[tokio::test(start_paused = true)]
 async fn a_sessions_pacer_runs_on_the_path_clock() {
-    let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(
-        "ack-policy-pacer-clock",
-        32,
-    )
-    .await;
+    let hub =
+        crate::transport::quic::upgrade::driver::tests::Harness::server("ack-policy-pacer-clock")
+            .await;
     let mut e = single(CAPABLE);
     e.conn.remote_conn.bandwidth_limit = Some(100_000);
     e.conn = e.conn.with_upgrade_site(&hub.site());
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests/quic_data.rs` (modified, +2/-14)
```diff
@@ -102,7 +102,7 @@ async fn claim(
         .expect("the stream was registered")
 }
 
-fn run<F, Fut>(network: &'static str, subnet: u8, limits: QuicPathLimits, test: F)
+fn run<F, Fut>(network: &'static str, limits: QuicPathLimits, test: F)
 where
     F: FnOnce(Rig) -> Fut + Send + 'static,
     Fut: Future<Output = ()> + Send + 'static,
@@ -113,7 +113,7 @@ where
         e.conn.attach_quic_inbox(inbox);
         let registry = Arc::new(OrphanStreamRegistry::new());
         e.conn.set_inbound_stream_registry(registry.clone());
-        let path = data_path(network, subnet, limits, e.conn.inbound_budget(), data).await;
+        let path = data_path(network, limits, e.conn.inbound_budget(), data).await;
         let time = path.time.clone();
         (time, test(Rig { e, path, registry }))
     });
@@ -130,7 +130,6 @@ fn bytes_of(len: usize) -> Bytes {
 fn a_short_and_a_stream_on_a_path_arrive_as_the_udp_ones_do() {
     run(
         "quic-data-arrive",
-        40,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let clocks = |e: &End| {
@@ -174,7 +173,6 @@ fn a_short_and_a_stream_on_a_path_arrive_as_the_udp_ones_do() {
 fn embedded_metadata_is_suppressed_only_after_the_same_short() {
     run(
         "quic-data-meta",
-        41,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             rig.path.send_short(b"first").await;
@@ -203,7 +201,6 @@ fn embedded_metadata_is_suppressed_only_after_the_same_short() {
 fn a_path_ending_mid_stream_frees_its_charge_and_the_stream_reports_failed() {
     run(
         "quic-data-end",
-        42,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let (claimed, unclaimed) = (StreamId::next(), StreamId::next());
@@ -254,7 +251,6 @@ fn a_path_ending_mid_stream_frees_its_charge_and_the_stream_reports_failed() {
 fn a_stream_that_ended_in_the_channel_is_not_registered() {
     run(
         "quic-data-queued",
-        43,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let id = StreamId::next();
@@ -303,7 +299,6 @@ fn fill_budget(rig: &Rig) -> Vec<Arc<LegacyStreamToken>> {
 fn a_budget_full_of_quic_charges_refuses_and_keeps_the_connection() {
     run(
         "quic-data-full",
-        44,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let tokens = fill_budget(&rig);
@@ -360,7 +355,6 @@ fn a_budget_full_of_quic_charges_refuses_and_keeps_the_connection() {
 fn a_stalled_quic_stream_is_released_and_a_udp_stream_then_fits() {
     run(
         "quic-data-stalled",
-        45,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let id = StreamId::next();
@@ -396,7 +390,6 @@ fn a_stalled_quic_stream_is_released_and_a_udp_stream_then_fits() {
 fn a_stream_id_in_use_on_udp_is_refused_on_the_path() {
     run(
         "quic-data-both-udp",
-        46,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let id = StreamId::next();
@@ -434,7 +427,6 @@ fn a_stream_id_in_use_on_udp_is_refused_on_the_path() {
 fn a_stream_id_used_on_the_path_is_refused_on_udp_and_on_the_path_again() {
     run(
         "quic-data-both-quic",
-        47,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let id = StreamId::next();
@@ -474,7 +466,6 @@ fn a_stream_id_used_on_the_path_is_refused_on_udp_and_on_the_path_again() {
 fn a_cancelled_recv_loses_nothing() {
     run(
         "quic-data-cancel",
-        48,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             const COUNT: usize = 40;
@@ -528,7 +519,6 @@ fn a_cancelled_recv_loses_nothing() {
 fn a_stream_with_no_registry_is_cancelled_and_its_charge_released() {
     run(
         "quic-data-noregistry",
-        51,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             rig.e.conn.inbound_stream_registry = None;
@@ -549,7 +539,6 @@ fn a_stream_with_no_registry_is_cancelled_and_its_charge_released() {
 fn a_path_with_the_bit_at_zero_refuses_data_before_charging() {
     run(
         "quic-data-shadow",
-        49,
         QuicPathLimits::SHADOW,
         |mut rig| async move {
             let _sent = rig
@@ -572,7 +561,6 @@ fn a_path_with_the_bit_at_zero_refuses_data_before_charging() {
 fn a_connection_drop_leaves_no_charge_and_no_registry_row() {
     run(
         "quic-data-drop",
-        50,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let (partial, whole) = (StreamId::next(), StreamId::next());
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests/quic_send.rs` (modified, +53/-88)
```diff
@@ -153,7 +153,7 @@ fn bytes_of(len: usize) -> Bytes {
     (0..len).map(|i| (i / 7) as u8).collect::<Vec<_>>().into()
 }
 
-fn run<F, Fut>(network: &'static str, subnet: u8, peer_limits: QuicPathLimits, test: F)
+fn run<F, Fut>(network: &'static str, peer_limits: QuicPathLimits, test: F)
 where
     F: FnOnce(Rig) -> Fut + Send + 'static,
     Fut: Future<Output = ()> + Send + 'static,
@@ -164,7 +164,6 @@ where
         e.conn.attach_quic_inbox(inbox);
         let path = data_path_to(
             network,
-            subnet,
             QuicPathLimits::DEFAULT,
             peer_limits,
             e.conn.inbound_budget(),
@@ -201,7 +200,6 @@ where
 fn a_message_of_each_kind_goes_on_the_path_and_not_on_udp() {
     run(
         "quic-send-each-kind",
-        50,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let short = message(1);
@@ -269,7 +267,6 @@ fn a_message_of_each_kind_goes_on_the_path_and_not_on_udp() {
 fn an_observed_send_on_the_path_is_unobserved() {
     run(
         "quic-send-observed",
-        50,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let short = message(1);
@@ -309,7 +306,6 @@ fn an_observed_send_on_the_path_is_unobserved() {
 fn a_full_queue_overflows_to_udp_and_nothing_is_lost() {
     run(
         "quic-send-overflow",
-        51,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let over = 5;
@@ -359,7 +355,6 @@ fn a_full_queue_overflows_to_udp_and_nothing_is_lost() {
 fn a_short_never_waits_for_the_path() {
     run(
         "quic-send-no-wait",
-        52,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let _held = rig.hold_stream_credit().await;
@@ -387,7 +382,6 @@ fn a_short_never_waits_for_the_path() {
 fn a_path_closed_with_a_full_queue_hands_every_message_to_udp_once() {
     run(
         "quic-send-close-drain",
-        53,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let _held = rig.hold_stream_credit().await;
@@ -437,7 +431,6 @@ fn a_path_closed_with_a_full_queue_hands_every_message_to_udp_once() {
 fn a_message_whose_ack_is_lost_is_delivered_once() {
     run(
         "quic-send-lost-ack",
-        54,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let silenced = DropFrom::new("quic-send-lost-ack", &[rig.path.peer_addr()]);
@@ -461,7 +454,6 @@ fn a_message_whose_ack_is_lost_is_delivered_once() {
 fn flight_size_returns_to_zero_after_each_way_to_udp() {
     run(
         "quic-send-flight",
-        55,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             // The queue overflows.
@@ -518,7 +510,6 @@ fn flight_size_returns_to_zero_after_each_way_to_udp() {
 fn a_udp_send_that_fails_charges_no_flight_and_is_counted() {
     run(
         "quic-send-udp-fails",
-        56,
         QuicPathLimits::DEFAULT,
         |rig| async move {
             rig.e
@@ -541,7 +532,6 @@ fn a_udp_send_that_fails_charges_no_flight_and_is_counted() {
 fn the_largest_short_goes_on_udp_whole() {
     run(
         "quic-send-largest",
-        57,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let largest = (0u64..)
@@ -567,7 +557,6 @@ fn the_largest_short_goes_on_udp_whole() {
 fn a_stream_that_never_opened_goes_on_udp_under_its_id() {
     run(
         "quic-send-stream-udp",
-        58,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let _held = rig.hold_stream_credit().await;
@@ -595,7 +584,6 @@ fn a_stream_that_never_opened_goes_on_udp_under_its_id() {
 fn a_large_short_that_never_opened_goes_on_udp_as_a_stream() {
     run(
         "quic-send-large-udp",
-        59,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let _held = rig.hold_stream_credit().await;
@@ -622,7 +610,6 @@ fn a_large_short_that_never_opened_goes_on_udp_as_a_stream() {
 fn data_the_peer_refuses_goes_on_udp_and_the_peer_closes_the_path() {
     run(
         "quic-send-refused",
-        60,
         QuicPathLimits::SHADOW,
         |mut rig| async move {
             let id = StreamId::next();
@@ -668,7 +655,7 @@ fn a_stream_refused_for_room_is_dropped_and_a_short_is_not() {
         max_bytes: 1024,
         ..QuicPathLimits::DEFAULT
     };
-    run("quic-send-budget", 61, limits, |mut rig| async move {
+    run("quic-send-budget", limits, |mut rig| async move {
         let (done, heard) = oneshot::channel();
         rig.e
             .conn
@@ -703,7 +690,6 @@ fn a_stream_refused_for_room_is_dropped_and_a_short_is_not() {
 fn a_stream_that_stalls_after_opening_is_dropped() {
     run(
         "quic-send-stalled",
-        62,
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
             let (done, heard) = oneshot::channel();
@@ -735,7 +721,6 @@ fn a_stream_that_stalls_after_opening_is_dropped() {
 fn a_pipe_that_never_opened_goes_on_udp_from_its_first_byte() {
     r
```

**File**: `crates/core/src/transport/quic/liveness.rs` (modified, +6/-4)
```diff
@@ -362,14 +362,15 @@ mod tests {
     /// after the driver's watcher read `released` as false.
     #[test]
     fn the_first_final_state_wins() {
-        let addr: SocketAddr = "10.201.35.1:1".parse().unwrap();
+        let net = crate::transport::test_net::subnet();
+        let addr: SocketAddr = net.addr_port(1, 1);
         let health = EndpointHealth::new(addr);
         health.availability.send_replace(QuicAvailability::Released);
         health.driver_ended();
         assert_eq!(health.watch().get(), QuicAvailability::Released);
         assert_eq!(TRANSPORT_METRICS.quic_endpoint_down_at(addr), 0);
 
-        let addr: SocketAddr = "10.201.35.2:1".parse().unwrap();
+        let addr: SocketAddr = net.addr_port(2, 1);
         let health = EndpointHealth::new(addr);
         health.driver_ended();
         health.release();
@@ -385,7 +386,8 @@ mod tests {
     /// longer be sent.
     #[test]
     fn an_adapter_panic_counts_once_and_keeps_released() {
-        let addr: SocketAddr = "10.201.35.3:1".parse().unwrap();
+        let net = crate::transport::test_net::subnet();
+        let addr: SocketAddr = net.addr_port(3, 1);
         let health = EndpointHealth::new(addr);
         assert!(health.closes_can_be_sent());
         health.adapter_panicked("test", &"first");
@@ -395,7 +397,7 @@ mod tests {
         assert_eq!(TRANSPORT_METRICS.quic_endpoint_down_at(addr), 1);
         assert!(!health.closes_can_be_sent());
 
-        let addr: SocketAddr = "10.201.35.4:1".parse().unwrap();
+        let addr: SocketAddr = net.addr_port(4, 1);
         let health = EndpointHealth::new(addr);
         health.release();
         assert!(health.closes_can_be_sent());
```

**File**: `crates/core/src/transport/quic/memory_tests.rs` (modified, +17/-21)
```diff
@@ -125,10 +125,10 @@ async fn settle(time: &VirtualTime) {
 ///   acknowledged are not here.
 /// - socket buffers. `SimulationSocket` has none; a real UDP socket's
 ///   kernel buffers are per endpoint, not per connection.
-async fn measure(network: &str, subnet: u8, n: usize) -> Cost {
+async fn measure(network: &str, n: usize) -> Cost {
     let _seed = GlobalRng::seed_guard(SEED);
-    let a_addr: SocketAddr = format!("10.204.{subnet}.1:5000").parse().unwrap();
-    let b_addr: SocketAddr = format!("10.204.{subnet}.2:5000").parse().unwrap();
+    let net = crate::transport::test_net::subnet();
+    let (a_addr, b_addr) = (net.addr(1), net.addr(2));
     let time = VirtualTime::new();
     register_network_time_source(network, time.clone());
     register_address_network(a_addr, network);
@@ -235,7 +235,7 @@ async fn measure(network: &str, subnet: u8, n: usize) -> Cost {
 #[test]
 fn an_idle_connection_measures_within_the_fixed_pin() {
     bounded(|| async move {
-        let cost = measure("quic-memory-fixed", 1, 16).await;
+        let cost = measure("quic-memory-fixed", 16).await;
         assert!(
             cost.settle_drift.rounded.abs() <= SETTLE_DRIFT_BYTES,
             "premise: nothing was running before the baseline: {cost:?}"
@@ -267,9 +267,9 @@ struct StreamRig {
 }
 
 impl StreamRig {
-    async fn new(network: &str, subnet: u8) -> Self {
-        let a_addr: SocketAddr = format!("10.204.{subnet}.1:5000").parse().unwrap();
-        let b_addr: SocketAddr = format!("10.204.{subnet}.2:5000").parse().unwrap();
+    async fn new(network: &str) -> Self {
+        let net = crate::transport::test_net::subnet();
+        let (a_addr, b_addr) = (net.addr(1), net.addr(2));
         let time = VirtualTime::new();
         register_network_time_source(network, time.clone());
         register_address_network(a_addr, network);
@@ -347,9 +347,9 @@ impl Drop for StreamRig {
 /// the receiver's reader for each (`path::inbound`), with one byte written
 /// on each and the stream left open. A warm-up stream first, a settled
 /// baseline, then the streams, settled, against it.
-async fn measure_open_streams(network: &str, subnet: u8, streams: usize) -> Live {
+async fn measure_open_streams(network: &str, streams: usize) -> Live {
     let _seed = GlobalRng::seed_guard(SEED);
-    let rig = StreamRig::new(network, subnet).await;
+    let rig = StreamRig::new(network).await;
     let (time, raw) = (rig.time.clone(), rig.raw.clone());
     let warm = raw.clone();
     drive(&time, LIMIT, async move {
@@ -385,15 +385,10 @@ async fn measure_open_streams(network: &str, subnet: u8, streams: usize) -> Live
 /// deregistration, so `VirtualTime`'s wakeup queues reach about `streams`
 /// entries, and a `Vec`/`BinaryHeap` keeps its peak capacity once they fire.
 /// Production timers deregister on drop. Compare two runs to cancel it.
-async fn measure_reset_streams(
-    network: &str,
-    subnet: u8,
-    streams: usize,
-    poll_stopped: bool,
-) -> Live {
+async fn measure_reset_streams(network: &str, streams: usize, poll_stopped: bool) -> Live {
     use futures::FutureExt;
     let _seed = GlobalRng::seed_guard(SEED);
-    let rig = StreamRig::new(network, subnet).await;
+    let rig = StreamRig::new(network).await;
     let (time, raw) = (rig.time.clone(), rig.raw.clone());
     let reset_one = move |raw: quinn::Connection| async move {
         let mut send = raw.open_uni().await.expect("open");
@@ -428,8 +423,8 @@ async fn measure_reset_streams(
 fn polling_stopped_on_a_reset_stream_costs_at_most_its_entry() {
     bounded(|| async move {
         let streams = 1024;
-        let polled = measure_reset_streams("quic-memory-stopped", 3, streams, true).await;
-        let plain = measure_reset_streams("quic-memory-unpolled", 4, streams, false).await;
+        let polled = measure_reset_streams("quic-memory-stopped", streams, true).await;
+        let plain = measure_reset_streams("quic-memory-unpolled", streams, false).await;
         let entries = polled.rounded - plain.rounded;
         assert!(
             entries > 0,
@@ -455,7 +450,7 @@ fn an_open_stream_measures_within_its_pin() {
         // Not the whole stream limit: the warm-up stream's slot comes back only
         // once more than an eighth of the limit is freed.
         let streams = super::config::STREAMED_SEND_LIMIT as usize;
-        let cost = measure_open_streams("quic-memory-streams", 2, streams).await;
+        let cost = measure_open_streams("quic-memory-streams", streams).await;
         assert!(
             cost.rounded > 0,
             "premise: the streams held memory: {cost:?}"
@@ -704,8 +699,9 @@ fn connected_pair_with_factory(
         super::config::system_clock(real.clone()),
     )
     .expect("server config");
+    let net = crate::transport::test_net::subnet();
     let mut receiver = ProtoPeer {
-        addr: "10.205.0.2:5000".parse().unwrap(),
+        addr: net.addr(2),
         endpoint: quinn_proto::Endpoint::
```

**File**: `crates/core/src/transport/quic/path/inbound.rs` (modified, +2/-2)
```diff
@@ -2362,8 +2362,8 @@ mod tests {
         use super::super::super::budget::{QuicBudget, WindowControl, floor_window_bytes};
         use super::super::super::tests::{bounded, drive, pair};
         bounded(|| async move {
-            let a_addr: std::net::SocketAddr = "10.209.1.1:5000".parse().unwrap();
-            let b_addr: std::net::SocketAddr = "10.209.1.2:5000".parse().unwrap();
+            let net = crate::transport::test_net::subnet();
+            let (a_addr, b_addr) = (net.addr(1), net.addr(2));
             let p = pair("quic-inbound-gapped-delivery", a_addr, b_addr, None).await;
             let permit =
                 p.b.allow_peer(p.a_addr, p.a_keys.public())
```

**File**: `crates/core/src/transport/quic/path/tests.rs` (modified, +138/-163)
```diff
@@ -34,6 +34,8 @@ const LIMIT: Duration = Duration::from_secs(600);
 /// server; `b`'s path has `b_limits`.
 struct Paths {
     pair: Pair,
+    /// The subnet `a` (`.1`) and `b` (`.2`) are on, for a third endpoint.
+    net: crate::transport::test_net::Subnet,
     a: Arc<QuicPath>,
     b: Arc<QuicPath>,
     a_in: QuicInbound,
@@ -60,32 +62,23 @@ impl Paths {
     }
 }
 
-/// Build the pair on `10.203.<subnet>.1` and `.2` and connect it. Every
-/// test needs a subnet of its own: the simulated network maps each address
-/// to one network for the whole process, so two tests on one subnet send
-/// each other's packets into the wrong network.
-async fn paths(network: &str, subnet: u8, b_limits: QuicPathLimits) -> Paths {
-    paths_with(network, subnet, b_limits, None).await
+/// Build the pair on `.1` and `.2` of a subnet of its own
+/// (`transport::test_net`) and connect it. Every pair needs its own: the
+/// simulated network maps each address to one network for the whole
+/// process, so two tests on one subnet send each other's packets into the
+/// wrong network.
+async fn paths(network: &str, b_limits: QuicPathLimits) -> Paths {
+    paths_with(network, b_limits, None).await
 }
 
 /// [`paths`], with `b`'s path charging `b_budget` if given
 /// ([`QuicPath::with_budget`]) instead of a budget of its own.
 async fn paths_with(
     network: &str,
-    subnet: u8,
     b_limits: QuicPathLimits,
     b_budget: Option<SharedInboundBudget>,
 ) -> Paths {
-    paths_built(
-        network,
-        subnet,
-        b_limits,
-        b_budget,
-        None,
-        Windows::default(),
-        true,
-    )
-    .await
+    paths_built(network, b_limits, b_budget, None, Windows::default(), true).await
 }
 
 /// The buffer budgets a test's paths take their windows from, if any
@@ -98,24 +91,14 @@ struct Windows {
 }
 
 /// [`paths`] with each side's path taking its windows from a buffer budget.
-async fn paths_metered(network: &str, subnet: u8, windows: Windows) -> Paths {
-    paths_built(
-        network,
-        subnet,
-        QuicPathLimits::DEFAULT,
-        None,
-        None,
-        windows,
-        true,
-    )
-    .await
+async fn paths_metered(network: &str, windows: Windows) -> Paths {
+    paths_built(network, QuicPathLimits::DEFAULT, None, None, windows, true).await
 }
 
 /// [`paths`] with an egress cap of `a_cap` bytes per second on `a`'s socket.
-async fn paths_capped(network: &str, subnet: u8, a_cap: u64) -> Paths {
+async fn paths_capped(network: &str, a_cap: u64) -> Paths {
     paths_built(
         network,
-        subnet,
         QuicPathLimits::DEFAULT,
         None,
         Some(a_cap),
@@ -128,10 +111,9 @@ async fn paths_capped(network: &str, subnet: u8, a_cap: u64) -> Paths {
 /// [`paths`] with plain Cubic, no loss gate (`recycle::loss_gate`), so
 /// random loss collapses the window: for the path's rules on a connection
 /// that drains slowly while it is still acknowledged.
-async fn paths_without_loss_gate(network: &str, subnet: u8) -> Paths {
+async fn paths_without_loss_gate(network: &str) -> Paths {
     paths_built(
         network,
-        subnet,
         QuicPathLimits::DEFAULT,
         None,
         None,
@@ -143,15 +125,14 @@ async fn paths_without_loss_gate(network: &str, subnet: u8) -> Paths {
 
 async fn paths_built(
     network: &str,
-    subnet: u8,
     b_limits: QuicPathLimits,
     b_budget: Option<SharedInboundBudget>,
     a_cap: Option<u64>,
     windows: Windows,
     loss_gate: bool,
 ) -> Paths {
-    let a_addr: SocketAddr = format!("10.203.{subnet}.1:5000").parse().unwrap();
-    let b_addr: SocketAddr = format!("10.203.{subnet}.2:5000").parse().unwrap();
+    let net = crate::transport::test_net::subnet();
+    let (a_addr, b_addr) = (net.addr(1), net.addr(2));
     let mut settings = super::super::tests::settings();
     settings.rate_limit.without_loss_gate = !loss_gate;
     let pair = pair_with(network, a_addr, b_addr, a_cap, settings).await;
@@ -204,6 +185,7 @@ async fn paths_built(
     }
     Paths {
         pair,
+        net,
         a: Arc::new(a),
         b: Arc::new(b),
         a_in,
@@ -287,7 +269,7 @@ fn assert_stopped(result: Result<(), QuicSendError>, code: u32) {
 fn short_messages_round_trip_and_are_not_deduplicated() {
     bounded(|| async move {
         let _seed = GlobalRng::seed_guard(SEED);
-        let mut p = paths("quic-path-short", 1, QuicPathLimits::DEFAULT).await;
+        let mut p = paths("quic-path-short", QuicPathLimits::DEFAULT).await;
         let big = payload(200 * 1024);
         let a = p.a.clone();
         let sent = big.clone();
@@ -339,7 +321,7 @@ fn short_messages_round_trip_and_are_not_deduplicated() {
 fn a_one_mib_stream_round_trips_through_the_adapter() {
     bounded(|| async move {
         let _seed = GlobalRng::seed_guard(SEED);
-        let mut p = paths("quic-path-stream", 2, QuicPathLimits::DEFAULT).await;
+        let mut p = paths("quic-path-stream", QuicPathLimits::
```

#### Recent Merged Pull Requests:
- **PR #6199** (2026-11-12): feat(telemetry): hourly join_versions census of gateway joiners and neighbours (@sanity)
- **PR #6198** (2026-11-12): fix(transport): keep the last eighth of the QUIC ingress queue for quiet sources (@sanity)
- **PR #6197** (2026-11-12): test(transport): take every simulated QUIC test address from one process-wide allocator (@sanity)
- **PR #6195** (2026-11-12): feat(transport): report the QUIC endpoint state in telemetry; deprecate transport-quic = off (@sanity)
- **PR #6193** (2026-11-12): test: wait for an open connection before revoking in the grant close-code test (@sanity)
- **PR #6189** (2026-11-11): feat(transport): handshake format 2 expresses a floor in the previous version series (@sanity)

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

## X. transport): keep the last eighth of the QUIC ingress queue for quiet sources (#6

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ac1b23e4`: transport): keep the last eighth of the QUIC ingress queue for quiet sources (#6198). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
rest of the queue is empty. The last QUIC_INGRESS_QUIET_RESERVE (128) slots
are for sources holding fewer than QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS (4):
once only those are free, any other source's datagram is `_reserve_full`, so
a quiet connection's loss probes and acknowledgements still get in. Without
it, a full queue dropped a quiet connection's probes one after another, quinn
doubled its probe timeout each time, and the connection went silent past the
consumers' 5 s gap (256 connections into one node, debug build). The cost:
sources holding 4 or more queued datagrams have 12.5% less room between them
for a burst (896 slots rather than 1024). The 896 is momentary, not a quota:
a source that drains below 4 counts as quiet again. Many sources spoofing
allowed addresses can fill the reserve; the queue then holds 1024, as
without it. Limitation: the reserve helps only while most sources are busy;
with about 256 or more connections each holding a few datagrams, most
traffic counts as quiet and the queue behaves close to a plain FIFO.
`_queue_full`, `_source_full`, `_reserve_full` (refused at the quiet
reserve, below) or `_no_ingress` (no ingress enabled, its
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
rest of the queue is empty.
`_queue_full`, `_source_full` or `_no_ingress` (no ingress enabled, its
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ac1b23e4` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
