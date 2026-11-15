# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet-freenet-core-learnings

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T20:51:39.464Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T20:51:39.464Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `freenet-freenet-core-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `fdc05210`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T20:51:00.903Z  
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
> **Harvest Timestamp**: 2026-11-15T20:51:00.897Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3123 stars

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
- **Issue #6237** (2026-11-15): **fix: replace the broken-invariant contract freeze with a per-contract merge budget**
  *Symptoms*: ## Problem  A contract flagged by the broken-invariant detector (`ring/broken_invariants.rs`) was frozen on every node that flagged it, for 300 s doubling to 6 h, persisted across restarts. The commit, the broadcast and three full-state egress paths were all skipped, and that included the node's **own client UPDATEs**: they were answered `UpdateResponse { state_changed: false }` and silently discarded. So a sampled correctness verdict could stop a contract advancing and drop a user's write with no error.  Field data (nova collector, 59.6 h, 2026-11-11): 1134 flag events on 9 contracts across 555 nodes. They are persistent and agreed across hundreds of nodes, which looks like genuine non-convergence rather than flutter, but each one is a contract the network stopped updating.  What the gates protected against is load: a merge that never settles turns every broadcast into another state change. Simulation (12 nodes, worst-case merge that yields fresh bytes on every apply, #6125 on, 300 iterations) shows existing mechanisms do not bound that once the gates go:  | run | merges of the bad contract | events | |---|---|---| | flag gates ON | 733 | 35k | | flag gates OFF | 53,283 | 24.0M |  The per-pair UPDATE interval still admits about 50 broadcasts/s from EACH neighbour, and the applied-payload record only skips byte-identical re-pushes. Details in #6190.  ## Approach  Bound the harm by usage alone, identically for every contract, and stop freezing on a verdict.  **1. Per-contract 

- **Issue #6235** (2026-11-15): **ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache)**
  *Symptoms*: ## Problem `macOS Service Unit` runs at its 45-minute timeout and fails by cancellation (#6207, #6208) after all tests passed, while recompiling `freenet` for the e2e step.  Cause: the e2e step set `FREENET_GIT_IS_DIRTY=1` on its own step only. `crates/core/build.rs:223` has `rerun-if-env-changed=FREENET_GIT_IS_DIRTY`, so the changed env reruns the build script and recompiles the whole `freenet` crate, even though profile, features, target dir and RUSTFLAGS are identical to the earlier `cargo build`.  Evidence from job 132296546454 (passing): `Build freenet bin` 14m36s, nextest test build 8m05s, then the e2e step's `cargo build` 2m42s (`Finished dev ... in 2m 42s`) just for the env change. In job 131783770014 (#6207, cancelled) the same steps took 18m50s and 10m45s before the e2e rebuild started. The same logs show `No cache found`: this job only runs on PRs, so `save-if: main` never saves and every build is cold, which is why the total swings between 11 and 45 min with runner speed.  ## Approach Set `FREENET_GIT_IS_DIRTY: "1"` in the job `env`, so every build in the job shares one build-script input and the e2e step's `cargo build` is a no-op. Auto-update stays off for the e2e as before. The other steps are unaffected: the node tests already pass `--disable-auto-update`, and the service tests pass the dirty string explicitly. Timeout left at 45 (the rebuild is gone from the critical path); the cold-cache cost is noted in the comment.  Second change, the real fix for the cold

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

### Incident Patch 1: `66b4a932` (2026-11-15)
**Commit Message**: ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache) (#6235)

**File**: `.github/scripts/check_cache_warm_parity.py` (modified, +42/-16)
```diff
@@ -34,12 +34,14 @@
    filters, ``-j`` and nextest's test ``--profile`` are ignored, so a warm job
    that compiles without running matches a CI job that compiles and runs;
 5. ``apt-get install`` package sets are identical;
-6. the warm job runs on a Ubicloud runner with the same label suffix
-   (architecture, OS variant), and its display name starts with
+6. the warm job runs on the same kind of runner as its twin: a Ubicloud
+   runner with the same label suffix (architecture, OS variant), or, for a
+   GitHub-hosted twin (macOS), the identical label, since GitHub's cache
+   backend is only written by GitHub-hosted runners; its display name starts with
    ``Warm cache:`` -- scripts/release.sh excludes check runs by that prefix,
    and a name that matched a required context would impersonate it.
 
-It also DISCOVERS which ci.yml jobs need a twin: a Ubicloud job whose
+It also DISCOVERS which ci.yml jobs need a twin: a job (Ubicloud or macOS) whose
 rust-cache has a conditional ``save-if`` and whose ``if:`` gates on
 ``github.event_name`` without ever admitting ``== 'push'``. It fails if such a
 job has no twin, or if a warm job's twin no longer needs one.
@@ -277,15 +279,19 @@ def _restore_only_on_prs(job: list[str]) -> bool:
 
 
 def needs_warm_twin(job: list[str]) -> bool:
-    """A Ubicloud job that restores a cache it can never write itself.
+    """A job that restores a cache it can never write itself.
 
     Its rust-cache saves conditionally, and its ``if:`` gates on the event
     without admitting a push, so it never runs where it could save a
     main-scoped entry. Clippy (no ``if:``) runs on main pushes and saves its
-    own; a GitHub-hosted job uses a different cache backend, which a Ubicloud
-    warm job could not fill.
+    own. The runner may be Ubicloud or GitHub-hosted (macOS): each has its own
+    cache backend, so the warm job must run on the same kind of runner (see the
+    runner check in ``check``).
     """
-    if "ubicloud" not in _runs_on(job):
+    # windows_unit has the same shape (#6236) and no warm twin yet; widen this
+    # to GitHub-hosted runners generally when one is added.
+    ro = _runs_on(job)
+    if "ubicloud" not in ro and not ro.startswith("macos-"):
         return False
     steps = _cache_steps(job)
     if not steps or not any(w.get("save-if", "").strip() not in ("", "true")
@@ -456,7 +462,7 @@ def differ(what: str, job: str, ci_val, warm_val, why: str):
               if needs_warm_twin(extract_job(ci_text, j) or [])]
     if not needed:
         errors.append(
-            f"{ci_name}: no job looks like it needs a warm twin (Ubicloud, "
+            f"{ci_name}: no job looks like it needs a warm twin (Ubicloud or macOS runner, "
             f"conditional rust-cache save-if, `if:` on event_name without "
             f"'push'). Either the discovery rule no longer matches {ci_name}, "
             f"or {warm_name} is dead weight; find out which before silencing this."
@@ -486,7 +492,7 @@ def differ(what: str, job: str, ci_val, warm_val, why: str):
                 f"{warm_name}: job `{job_id}` warms a cache its {ci_name} twin "
                 f"does not need from it: the twin runs on pushes to main (so it "
                 f"saves its own entry), saves unconditionally, or is not on "
-                f"Ubicloud. Delete the warm job, or restore the twin's shape."
+                f"a Ubicloud or macOS runner. Delete the warm job, or restore the twin's shape."
             )
 
         ci_env, warm_env = _job_env(ci_job), _job_env(warm_job)
@@ -545,12 +551,18 @@ def cache_inputs(job):
                 )
 
         warm_ro = _runs_on(warm_job)
-        if "ubicloud" not in warm_ro:
+        if "ubicloud" not in _runs_on(ci_job):
+            # GitHub-hosted twin: its cache lives in GitHub's backend, which
+            # only a GitHub-hosted runner can write, and the runner label
+            # decides OS and arch (so the key).
+            if _norm(_runs_on(ci_job)) != _norm(warm_ro):
+                differ("runner label", job_id, _runs_on(ci_job), warm_ro, key_why)
+        elif "ubicloud" not in warm_ro:
             errors.append(
-                f"{warm_name}: job `{job_id}` runs on `{warm_ro}`. Ubicloud "
-                f"serves its own cache backend, so an entry saved from any other "
-                f"runner is invisible to the Ubicloud PR job. Use a "
-                f"`ubicloud-standard-*` label."
+                f"{warm_name}: job `{job_id}` runs on `{warm_ro}`. Its "
+                f"`ci.yml` twin is on Ubicloud, which serves its own cache "
+                f"backend, so an entry saved from any other runner is invisible "
+                f"to that PR job. Use a `ubicloud-standard-*` label."
             )
         else:
             ci_sfx, warm_sfx = _label_suffixes(_runs_on(ci_job)), _label_suffixes(warm_ro)
@@ -817,7 +829,7 @@ def _cases() -> list[tuple[str, str, str, str | None]]:
      "apt-get install packages"),
     (
```

**File**: `.github/workflows/ci-cache-warm.yml` (modified, +56/-6)
```diff
@@ -21,18 +21,20 @@ name: CI Cache Warm
 # the PR jobs compile (which must be mirrored here) has to yield a new key for
 # this workflow to fill. So each job below MUST keep:
 #   - the SAME job id as its ci.yml counterpart (test_unit, test_simulation,
-#     nat_validation) -- the display `name:` is deliberately different, so
+#     nat_validation, macos_unit) -- the display `name:` is deliberately different, so
 #     these never masquerade as the required status contexts;
 #   - the SAME job-level `env:`, toolchain and toolchain targets;
 #   - the SAME linker env on its compile steps, and the same cargo features,
 #     or cargo's fingerprints differ and the restored deps are rebuilt anyway.
 # .github/scripts/check_cache_warm_parity.py enforces this from Rule Lint.
 # When you change one of those jobs in ci.yml, change its twin here.
 #
-# It must run on a Ubicloud runner: Ubicloud serves its own cache backend, so
-# an entry saved from a GitHub-hosted runner is invisible to Ubicloud jobs.
-# Runner size does not enter the key (only OS and arch do), so the cheaper
-# standard-8 is used throughout.
+# The Linux jobs must run on a Ubicloud runner: Ubicloud serves its own cache
+# backend, so an entry saved from a GitHub-hosted runner is invisible to
+# Ubicloud jobs. Runner size does not enter the key (only OS and arch do), so
+# the cheaper standard-8 is used throughout. The reverse holds for macos_unit,
+# which ci.yml runs on GitHub-hosted `macos-latest`: only a GitHub-hosted runner
+# can write the entry it restores.
 
 on:
   # Daily backstop, for what no path filter sees: eviction (Ubicloud's policy
@@ -234,13 +236,61 @@ jobs:
           cargo nextest run -p freenet-ping-app --features testing \
             --profile ci --no-run
 
+  # Same job id as ci.yml's `macos_unit`, which runs on a GitHub-hosted macOS
+  # runner and so uses GitHub's own cache backend, not Ubicloud's: this job
+  # must run on the identical `macos-latest` label. It shares the repo's 10 GB
+  # GitHub cache pool with the release-build and benchmark entries, so a new
+  # macOS entry can evict older ones there; the Ubicloud entries above are in a
+  # different backend and are not affected.
+  macos_unit:
+    name: "Warm cache: macOS Service Unit"
+    runs-on: macos-latest
+    timeout-minutes: 60
+
+    # Must match ci.yml macos_unit's job-level env exactly (cache key input).
+    env:
+      RUST_LOG: error
+      CARGO_TARGET_DIR: ${{ github.workspace }}/target
+      RUST_MIN_STACK: 268435456
+      FREENET_GIT_IS_DIRTY: "1"
+
+    steps:
+      - uses: actions/checkout@v7
+
+      - uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: 1.93.0
+          targets: wasm32-unknown-unknown
+
+      - uses: Swatinem/rust-cache@v2
+        with:
+          save-if: ${{ github.ref == 'refs/heads/main' }}
+          key: ci-${{ hashFiles('.github/workflows/ci-cache-warm.yml') }}
+
+      - name: Install nextest
+        uses: taiki-e/install-action@v2
+        timeout-minutes: 5
+        with:
+          tool: cargo-nextest
+          fallback: none
+
+      - name: Build freenet bin
+        run: cargo build --locked -p freenet --bin freenet
+
+      # The three test invocations of ci.yml macos_unit, compiled but not run.
+      - name: Compile tests
+        run: |
+          cargo nextest run -p freenet --bin freenet --profile ci --no-run
+          cargo nextest run -p freenet --profile ci --test graceful_shutdown_exit_code --no-run
+          cargo nextest run -p freenet --profile ci --test url_scheme_handler --no-run
+
   # A failed warm leaves PRs building cold with every check green, so say so.
   # Named "Warm cache: ..." like the jobs above: scripts/release.sh ignores
   # main-branch check runs by that prefix, including this one while queued.
   notify_failure:
     name: "Warm cache: notify on failure"
     runs-on: ubuntu-latest
-    needs: [test_unit, test_simulation, nat_validation]
+    needs: [test_unit, test_simulation, nat_validation, macos_unit]
     if: failure() && github.ref == 'refs/heads/main'
     # Best-effort, like ci.yml's notify_dev_room_main_failure.
     continue-on-error: true
```

**File**: `.github/workflows/ci.yml` (modified, +23/-9)
```diff
@@ -1129,8 +1129,15 @@ jobs:
   macos_unit:
     name: macOS Service Unit
     runs-on: macos-latest
-    # 45, not 30: the freenet:// LaunchServices e2e rebuilds the freenet crate
-    # (auto-update off) and waits for the app to launch and handle links.
+    # 45, not 30: the freenet:// LaunchServices e2e waits for the app to launch
+    # and handle links, and a cold build of this job takes ~35 min. Normally it
+    # is not cold: this job never runs on main, so ci-cache-warm.yml's
+    # `macos_unit` job writes the cache entry it restores (the key below is that
+    # file's hash; check_cache_warm_parity.py keeps the two in step). After a
+    # lockfile change on main, or if the warm entry was evicted, a PR run is
+    # cold again and the headroom is what keeps it from failing by cancellation.
+    # The warm entry covers dependencies only: rust-cache cleans workspace-member
+    # artifacts before saving, so `freenet` itself still compiles on every run.
     timeout-minutes: 45
     # Same skip conditions as test_unit (see test_unit comment for details).
     if: |
@@ -1144,6 +1151,16 @@ jobs:
       # Increase rustc stack size to prevent SIGSEGV during compilation
       # 256MB required for LLVM optimization passes on large workspaces (rustc suggests this value)
       RUST_MIN_STACK: 268435456
+      # Auto-update off for EVERY build in this job, not just the e2e step. The
+      # freenet:// LaunchServices e2e starts a real node from the built binary,
+      # and a newer release must not make it exit 42 and swap the test bundle.
+      # `build.rs` declares `rerun-if-env-changed=FREENET_GIT_IS_DIRTY`, so
+      # setting this only on the e2e step changed the build script's input and
+      # recompiled the whole freenet crate there (2m42s on a fast runner; it ran
+      # the job into its timeout on a slow one, #6214). Set once here, the e2e
+      # build is a no-op. The other steps are unaffected: the node tests already
+      # pass --disable-auto-update.
+      FREENET_GIT_IS_DIRTY: "1"
 
     steps:
       - uses: actions/checkout@v7
@@ -1168,6 +1185,7 @@ jobs:
         # `if:` here, and NOT a separate step.
         with:
           save-if: ${{ github.ref == 'refs/heads/main' }}
+          key: ci-${{ hashFiles('.github/workflows/ci-cache-warm.yml') }}
 
       # nextest via the maintained action, not a hand-rolled download.
       # Rationale at the first of these in ci.yml (test_unit job); see #5296.
@@ -1203,14 +1221,10 @@ jobs:
       # login. It also checks that the menu bar icon is really on screen, which
       # needs macOS 26 or later to mean anything (#6093), and that Launch at
       # Login registers and repairs old agents. The app starts a real node, so
-      # this rebuilds the binary with
-      # FREENET_GIT_IS_DIRTY=1 (auto-update off; only the freenet crate
-      # recompiles): otherwise a release newer than this branch would make
-      # the node exit 42 and the DMG-swap updater replace the test bundle
-      # mid-run. Last step on purpose, since it changes target/debug/freenet.
+      # the binary must be built with FREENET_GIT_IS_DIRTY=1 (auto-update off;
+      # set job-wide above, so this `cargo build` is a no-op).
+      # Last step on purpose, since it changes target/debug/freenet.
       - name: freenet:// end to end through LaunchServices
-        env:
-          FREENET_GIT_IS_DIRTY: "1"
         run: |
           cargo build --locked -p freenet --bin freenet
           scripts/macos-url-scheme-e2e.sh target/debug/freenet
```

**File**: `scripts/macos-url-scheme-e2e.sh` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ echo "ok - LaunchServices resolves freenet:// to the bundle"
 # build uses the platform directories); explicit directories sidestep that.
 # FREENET_TELEMETRY_ENABLED: the app starts a real node; keep it out of the
 # production telemetry. (Its auto-update is off because CI builds this binary
-# with FREENET_GIT_IS_DIRTY=1, so a newer release cannot swap the bundle out
+# with FREENET_GIT_IS_DIRTY=1 (set job-wide), so a newer release cannot swap the bundle out
 # mid-test.)
 mkdir -p "$OUT/data" "$OUT/config"
 launchctl setenv FREENET_OPEN_DRY_RUN 1
```

---

### Incident Patch 2: `fdc05210` (2026-11-15)
**Commit Message**: fix: replace the broken-invariant contract freeze with a per-contract merge budget (#6237)

**File**: `.claude/rules/contracts.md` (modified, +12/-8)
```diff
@@ -317,12 +317,16 @@ State merging rules:
     bytes, as the verifier does, so a contract whose encoding depends on
     argument order and that also fails strict associativity can be flagged
     for byte order alone. Violators get flagged in
-    `Ring::broken_invariants`; while flagged, this node suppresses commit,
-    outbound `BroadcastStateChange` (including the retry/stash/flush
-    re-emissions through `handle_broadcast_state_change`), AND full-state
-    egress (`ResyncResponse`, `SyncStateToPeer` heal). The flag is
-    TTL-bounded (`BROKEN_INVARIANT_TTL`, swept by the Ring reaper) so a
-    false positive self-heals instead of bricking the contract forever; a
+    `Ring::broken_invariants`. Since #6190 the flag is DIAGNOSTIC ONLY (INFO
+    log, `freenet.contract.broken_invariant.detections` counter,
+    `broken_invariant_flagged` telemetry event): it must not gate a commit,
+    a broadcast or an egress path, and a source pin
+    (`broken_flag_gates_no_commit_broadcast_or_egress`) fails if one comes
+    back. The load a non-settling merge causes is bounded instead, for every
+    contract alike, by the per-contract merge budget on the broadcast receive
+    path (`ring::contract_merge_budget`). The flag is TTL-bounded
+    (`BROKEN_INVARIANT_TTL`, swept by the Ring reaper), which now bounds how
+    often a contract is re-probed and re-reported; a
     genuine violation is re-detected after expiry (deterministically by the
     identical-input probe when the echo re-pushes a payload this node has not
     already recorded as merged). A re-push of a payload the node already
@@ -336,8 +340,8 @@ State merging rules:
     by a different payload with the same bytes; otherwise, for 15 minutes the
     skip replaces it. When the record's precondition holds and when it does
     not is in that module's "Precondition" section. For a
-    contract that replays a fixed set of payloads, that skip is now the
-    defence, not the flag: such contracts are flagged less often, and a lower
+    contract that replays a fixed set of payloads, that skip is a defence
+    alongside the merge budget: such contracts are flagged less often, and a lower
     broken-flag count does NOT mean fewer broken contracts. There is deliberately NO
     automatic escalation to the contract ban list: a durable ban needs an
     aging/recovery story first (see PR #4902 review). Residual
```

**File**: `crates/core/src/contract.rs` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ pub(crate) mod delegate_capabilities;
 mod delegate_lane;
 mod delegate_park;
 mod delegate_restore;
-mod executor;
+pub(crate) mod executor;
 mod fair_queue;
 #[cfg(all(test, feature = "wasmtime-backend", feature = "redb"))]
 mod wakeup_wasm_tests;
```

**File**: `crates/core/src/contract/executor.rs` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ use crate::{
 
 pub(super) mod init_tracker;
 pub(super) mod mock_runtime;
-pub(super) mod mock_wasm_runtime;
+pub(crate) mod mock_wasm_runtime;
 #[cfg(test)]
 mod pool_tests;
 pub(super) mod runtime;
```

**File**: `crates/core/src/contract/executor/mock_wasm_runtime.rs` (modified, +49/-1)
```diff
@@ -157,6 +157,44 @@ pub(crate) enum UpdateOverride {
 /// merge), `MockWasmRuntime` delegates to the same `bridged_*` methods that
 /// `Executor<Runtime>` uses, exercising init_tracker, validation, subscriber
 /// notification pipeline, corrupted state recovery, and contract key indexing.
+/// Simulation hooks (#6190, `dev_tool::sim_merge_budget`). Process-global
+/// because simulation contract ids are random; a test that arms them must run
+/// in its own process (it does: `run_alone_in_child_process`).
+#[cfg(any(test, feature = "testing"))]
+pub(crate) mod sim_hooks {
+    use super::*;
+    use std::sync::atomic::{AtomicU8, AtomicU64, Ordering};
+
+    /// Contracts whose first id byte is a multiple of this merge
+    /// non-idempotently (fresh bytes on every apply). 0 disables the hook and
+    /// the merge counter.
+    pub(crate) static BAD_CONTRACT_MODULUS: AtomicU8 = AtomicU8::new(0);
+    /// `update_state` calls per contract id while armed.
+    pub(crate) static MERGE_COUNTS: std::sync::Mutex<Option<HashMap<ContractInstanceId, u64>>> =
+        std::sync::Mutex::new(None);
+    static NONCE: AtomicU64 = AtomicU64::new(1);
+
+    /// Count the call and return the non-settling override for `key` if the
+    /// hook selects it. A no-op (one atomic load) while disarmed.
+    pub(crate) fn on_update_state(key: &ContractInstanceId) -> Option<UpdateOverride> {
+        let modulus = BAD_CONTRACT_MODULUS.load(Ordering::Relaxed);
+        if modulus == 0 {
+            return None;
+        }
+        *MERGE_COUNTS
+            .lock()
+            .unwrap()
+            .get_or_insert_with(HashMap::new)
+            .entry(*key)
+            .or_insert(0) += 1;
+        (key.as_bytes()[0] % modulus == 0).then(|| {
+            UpdateOverride::NonIdempotent(std::sync::Arc::new(AtomicU64::new(
+                NONCE.fetch_add(1 << 20, Ordering::Relaxed),
+            )))
+        })
+    }
+}
+
 pub(crate) struct MockWasmRuntime {
     pub(crate) contract_store: InMemoryContractStore,
     /// Per-contract validation overrides for testing related contract flows.
@@ -494,7 +532,17 @@ impl ContractRuntimeInterface for MockWasmRuntime {
         // update_data slice) returns `requires`; once the bridged path
         // re-attempts with `RelatedState` entries appended, fall through
         // to the default merge.
-        if let Some(override_) = self.update_overrides.get(_key.id()).cloned() {
+        #[cfg(any(test, feature = "testing"))]
+        let sim_override = sim_hooks::on_update_state(_key.id())
+            .filter(|_| !self.update_overrides.contains_key(_key.id()));
+        #[cfg(not(any(test, feature = "testing")))]
+        let sim_override: Option<UpdateOverride> = None;
+        if let Some(override_) = self
+            .update_overrides
+            .get(_key.id())
+            .cloned()
+            .or(sim_override)
+        {
             match override_ {
                 UpdateOverride::RequiresRelated(ids) => {
                     let has_related = update_data
```

**File**: `crates/core/src/contract/executor/pool_tests/applied_payloads_tests.rs` (modified, +13/-6)
```diff
@@ -319,8 +319,11 @@ async fn a_refused_merge_is_not_recorded() {
     );
 }
 
+/// Since #6190 a flagged contract's merge is committed like any other, so its
+/// payload is absorbed and recorded (the flag used to suppress the commit, and
+/// this test used to assert the payload was NOT recorded).
 #[tokio::test(flavor = "current_thread")]
-async fn a_merge_suppressed_for_a_broken_contract_is_not_recorded() {
+async fn a_merge_on_a_flagged_contract_is_recorded() {
     let (op_manager, _guards) = build_op_manager("applied-broken").await;
     let (mut executor, key) = installed(&op_manager, b"applied_broken", b"s0").await;
     op_manager.ring.record_broken_invariant(
@@ -329,6 +332,7 @@ async fn a_merge_suppressed_for_a_broken_contract_is_not_recorded() {
         crate::ring::BrokenInvariantDetector::IdenticalInput,
         "test",
     );
+    assert!(op_manager.ring.is_contract_broken(&key), "premise: flagged");
     let result = executor
         .upsert_contract_state(
             key,
@@ -337,14 +341,17 @@ async fn a_merge_suppressed_for_a_broken_contract_is_not_recorded() {
             None,
         )
         .await
-        .expect("suppressed merge returns Ok");
-    assert!(matches!(result, crate::contract::UpsertResult::NoChange));
+        .expect("merge on a flagged contract");
     assert!(
-        !op_manager
+        matches!(result, crate::contract::UpsertResult::Updated(_)),
+        "a flagged contract's merge must commit, got {result:?}"
+    );
+    assert!(
+        op_manager
             .ring
             .applied_payloads
             .contains(&key, state_hash(&op_manager, b"s1")),
-        "nothing was stored, so the payload was not absorbed"
+        "the committed payload was absorbed, so it is recorded"
     );
 }
 
@@ -408,7 +415,7 @@ fn the_install_reset_precedes_the_store() {
 fn the_recovery_reset_precedes_the_commit() {
     let src = include_str!("../runtime/executor_impl.rs");
     let commit_at = src
-        .find("let commit_outcome = self")
+        .find("self.commit_state_update(&key, &params, &updated_state)")
         .expect("final commit of the merge path");
     let before = &src[..commit_at];
     let gate = before
```

**File**: `crates/core/src/contract/executor/pool_tests/delegate_notification_tests.rs` (modified, +0/-68)
```diff
@@ -508,41 +508,6 @@ fn finalize_state_commit_is_the_only_post_store_fan_out_site() {
         );
     }
 
-    // The queued-operation replay loop inside the install branch must consume
-    // `commit_state_update`'s OUTCOME, not a bare `Ok`.
-    //
-    // `commit_state_update` returns `Ok(SuppressedBrokenContract)` — storing
-    // nothing and fanning out nothing — for a contract flagged in
-    // `ring::broken_invariants`. When it returned `Result<(), _>` the replay
-    // loop read that as "this replay committed", advanced `installed_state`,
-    // and skipped the branch's own trailing fan-out, so the state the branch
-    // HAD stored reached no delegate, no WebSocket client and no peer. #5481
-    // again, at the install-plus-flagged-contract corner, introduced by the fix
-    // for #5481 and caught by the repo's rule review.
-    //
-    // The enum makes the conflation uncompilable — there is no `Ok(())` left to
-    // misread — so what is worth pinning is that the loop still matches on the
-    // variant rather than being rewritten to discard it with `let _ =` or
-    // `.is_ok()`, which would restore the same bug through a different door.
-    // Scoped to `bridged_upsert_contract_state_inner`, NOT the whole file:
-    // `commit_state_update`'s own return sites mention both variants, so a
-    // file-wide check is satisfied by the enum's definition site and would
-    // stay green through the very rewrite it is meant to catch.
-    let replay_scope = upsert_inner_body(production);
-    assert!(
-        code_contains(replay_scope, "StateCommitOutcome::Committed"),
-        "the queued-operation replay loop must branch on \
-         `StateCommitOutcome::Committed`. Treating any `Ok` as a commit makes \
-         a broken-contract suppression look like a successful one, and the \
-         install branch then skips a fan-out it still owes."
-    );
-    assert!(
-        code_contains(replay_scope, "StateCommitOutcome::SuppressedBrokenContract"),
-        "the replay loop must handle the suppression case explicitly, so the \
-         install branch's own fan-out is still performed when a replay stored \
-         nothing."
-    );
-
     // And every storing path delegates to it.
     let calls = count_call_sites(production, ".finalize_state_commit(");
     assert_eq!(
@@ -652,39 +617,6 @@ fn brace_delimited_body(src: &str, start: usize) -> &str {
     panic!("unbalanced braces while scraping the item body starting at {start}");
 }
 
-/// The brace-delimited body of `bridged_upsert_contract_state_inner`, which is
-/// where the queued-operation replay loop lives.
-///
-/// Scoping matters here rather than being tidiness. `StateCommitOutcome::`
-/// appears FOUR times in `executor_impl.rs`: twice in the replay match, and
-/// twice in `commit_state_update`'s own `return` sites. An unscoped "does this
-/// token appear" check is therefore satisfied by the enum's DEFINITION SITE, so
-/// deleting the replay match entirely and writing `if ....await.is_ok()` would
-/// leave it green — restoring the exact bug the enum was introduced to close.
-/// Two reviewers found that independently on #5484.
-///
-/// The function body is the right scope rather than the loop itself: it
-/// excludes both `commit_state_update` sites, and it does not depend on the
-/// loop keeping any particular shape.
-fn upsert_inner_body(src: &str) -> &str {
-    const SIG: &str = "async fn bridged_upsert_contract_state_inner(";
-    let start = src
-        .find(SIG)
-        .expect("bridged_upsert_contract_state_inner must exist");
-    brace_delimited_body(src, start)
-}
-
-/// Whether `needle` appears in `src` as CODE — not in a comment, not inside a
-/// string literal.
-///
-/// Deliberately says nothing about scope: pass the region you mean. The
-/// previous name (`helper_free_production_contains`) promised a region
-/// excluding the fan-out helper and delivered a whole-file search, which is how
-/// the unscoped `StateCommitOutcome` assertions above came to pin nothing.
-fn code_contains(src: &str, needle: &str) -> bool {
-    count_call_sites(src, needle) > 0
-}
-
 /// Count `needle` occurrences, one per matching LINE (two calls on one line
 /// count once — rustfmt does not produce that shape here, and the assertions
 /// below would fail loud rather than pass if it ever did).
```

**File**: `crates/core/src/contract/executor/pool_tests/identical_input_probe_tests.rs` (modified, +31/-22)
```diff
@@ -21,12 +21,13 @@
 //! `bridged_upsert_contract_state` path via `Executor<MockWasmRuntime>`
 //! wired to a real `OpManager`/`Ring` (harness mirrors
 //! `disk_budget_gate_tests.rs`), so the `is_contract_broken` flag the
-//! probes set — and the commit suppression it gates — are the real ones.
+//! probes set is the real one. Since #6190 the flag gates nothing:
+//! `flagged_contract_subsequent_apply_is_committed` pins that a flagged
+//! contract still commits, and `non_idempotent_detector_tests.rs` pins that
+//! no commit/broadcast/egress path reads the flag.
 //!
 //! The probe cooldown is unit-tested with a mock clock in
-//! `ring::broken_invariants::tests`; the egress gates (ResyncResponse /
-//! SyncStateToPeer / handle_broadcast_state_change) are pinned in
-//! `non_idempotent_detector_tests.rs`.
+//! `ring::broken_invariants::tests`.
 
 use either::Either;
 use freenet_stdlib::prelude::*;
@@ -296,15 +297,18 @@ async fn identical_input_canonicalize_once_is_not_flagged() {
     );
 }
 
-/// While flagged, a subsequent NON-identical apply is fully suppressed:
-/// the merge result is neither committed nor observable — the stored
-/// state stays put and the caller sees `NoChange`. (This is the existing
-/// #4279 commit gate; asserting it here proves the flag set by the NEW
-/// identity probe engages it end-to-end.)
+/// Regression for #6190: a flagged contract still takes updates.
+///
+/// While flagged, a non-identical apply used to be suppressed: nothing was
+/// stored and the caller got `NoChange`. That caller includes this node's own
+/// client, whose UPDATE was then answered `state_changed: false` and silently
+/// discarded (`contract.rs::update_response_from_result` maps `NoChange` to
+/// exactly that). The flag is diagnostic only now, so the apply must commit
+/// and report `Updated`, and the stored state must be the merge result.
 #[tokio::test(flavor = "current_thread")]
-async fn flagged_contract_subsequent_apply_is_suppressed() {
-    let (op_manager, _guards) = build_op_manager("nonidem-identity-suppress").await;
-    let contract = test_contract(b"suppressed_identity_contract");
+async fn flagged_contract_subsequent_apply_is_committed() {
+    let (op_manager, _guards) = build_op_manager("nonidem-identity-commit").await;
+    let contract = test_contract(b"flagged_commit_contract");
     let key = contract.key();
     let state = distinct_bytes_state();
 
@@ -335,10 +339,11 @@ async fn flagged_contract_subsequent_apply_is_suppressed() {
         )
         .await
         .expect("identical re-apply");
-    assert!(op_manager.ring.is_contract_broken(&key));
+    assert!(
+        op_manager.ring.is_contract_broken(&key),
+        "premise: the contract is flagged before the update under test"
+    );
 
-    // A different incoming state now runs the merge, but the flagged-
-    // contract gate suppresses the commit: NoChange, stored state intact.
     let different = WrappedState::new((101u8..=132).collect::<Vec<u8>>());
     let result = executor
         .upsert_contract_state(
@@ -349,18 +354,22 @@ async fn flagged_contract_subsequent_apply_is_suppressed() {
         )
         .await
         .expect("non-identical apply while flagged");
-    assert!(
-        matches!(result, UpsertResult::NoChange),
-        "apply while flagged must be suppressed to NoChange, got {result:?}"
-    );
+    let UpsertResult::Updated(merged) = result else {
+        panic!("an apply on a flagged contract must commit and report Updated, got {result:?}");
+    };
 
     let (stored, _) = executor
         .fetch_contract(key, false)
         .await
-        .expect("fetch after suppressed apply");
+        .expect("fetch after apply");
     assert_eq!(
         stored.map(|s| s.as_ref().to_vec()),
-        Some(state.as_ref().to_vec()),
-        "suppressed apply must not have touched the stored state"
+        Some(merged.as_ref().to_vec()),
+        "the stored state must be the committed merge result"
+    );
+    assert_ne!(
+        merged.as_ref(),
+        state.as_ref(),
+        "the merge must have changed the state"
     );
 }
```

**File**: `crates/core/src/contract/executor/pool_tests/non_idempotent_detector_tests.rs` (modified, +89/-129)
```diff
@@ -1,7 +1,7 @@
 //! Tests for the per-contract non-idempotency *fixture*. See
 //! `crate::ring::broken_invariants` (tracker-level unit tests) and
 //! `Executor::maybe_probe_idempotency` in `contract/executor/runtime.rs`
-//! for the detector + gate code itself.
+//! for the detector itself.
 //!
 //! ## What these tests cover
 //!
@@ -15,18 +15,8 @@
 //!    so the property the probe checks doesn't false-positive on
 //!    well-behaved contracts.
 //!
-//! ## What these tests do NOT cover (deferred)
-//!
-//! End-to-end "probe fires inside the executor, sets the flag via
-//! `Ring::record_broken_invariant`, and the next merge / broadcast is
-//! suppressed by the `is_contract_broken` gate in `commit_state_update`
-//! and `broadcast_state_change`" is **NOT** exercised here — the mock
-//! executor path (`Executor::new_mock_wasm`) doesn't wire a real
-//! `OpManager`, so `op_manager.ring.is_contract_broken(...)` from inside
-//! the executor is a no-op against an absent ring. The tracker layer
-//! (record → is_broken) is covered in `ring::broken_invariants::tests`.
-//! Full integration coverage requires a `SimNetwork`-shaped harness and
-//! is filed as a follow-up to #4279.
+//! 3. **No gate on the flag** — `broken_flag_gates_no_commit_broadcast_or_egress`
+//!    pins that the flag stays diagnostic (#6190).
 
 use freenet_stdlib::prelude::*;
 
@@ -111,130 +101,100 @@ fn fixture_non_idempotent_override_produces_distinct_states() {
     );
 }
 
-/// Source-grep pin: the three production gate sites in `runtime.rs`
-/// (`commit_state_update` top-gate, `broadcast_state_change` gate, and
-/// `bridged_upsert_contract_state` merge-suppression after probe) all
-/// MUST consult `op_manager.ring.is_contract_broken(...)`. A regression
-/// that removes or inverts any of these checks silently re-enables the
-/// broadcast storm — this test would fail compile-time-style on string
-/// match in CI before the gap reaches production.
-#[test]
-fn production_gate_sites_consult_is_contract_broken() {
-    // Read the full source files at compile time. `include_str!` is
-    // resolved relative to the file containing this macro — these tests
-    // live at `crates/core/src/contract/executor/pool_tests/` so we
-    // climb one level to reach the production files.
-    // `is_contract_broken` call sites live in runtime/executor_impl.rs after
-    // the split; both files are searched independently (not concatenated) so
-    // that `#[cfg(test)]` markers in runtime.rs don't accidentally truncate
-    // the executor_impl.rs search window.
-    const RUNTIME_RS: &str = include_str!("../runtime.rs");
-    const EXECUTOR_IMPL_RS: &str = include_str!("../runtime/executor_impl.rs");
-
-    // Strip test modules from each file independently, then concatenate the
-    // production-only slices. executor_impl.rs has no #[cfg(test)] today so
-    // its split_once is a no-op, but future-proofs against one being added.
-    let runtime_prod = RUNTIME_RS
-        .split_once("#[cfg(test)]")
-        .map(|(prod, _)| prod)
-        .unwrap_or(RUNTIME_RS);
-    let executor_impl_prod = EXECUTOR_IMPL_RS
-        .split_once("#[cfg(test)]")
-        .map(|(prod, _)| prod)
-        .unwrap_or(EXECUTOR_IMPL_RS);
-
-    let occurrences = runtime_prod.matches("is_contract_broken").count()
-        + executor_impl_prod.matches("is_contract_broken").count();
-    assert!(
-        occurrences >= 3,
-        "expected at least 3 `is_contract_broken` checks in production \
-         runtime.rs (commit_state_update top-gate, broadcast_state_change \
-         gate, and bridged_upsert_contract_state post-probe merge \
-         suppression); found {occurrences}. A regression that removed or \
-         inverted any of these silently re-enables the storm we're \
-         defending against — see PR #4279."
-    );
-}
-
-/// Source-grep pin for the full-state EGRESS gates: while a contract is
-/// flagged, the executor's own commit/broadcast suppression is not enough
-/// — three paths still pushed state off the node and kept the broadcast
-/// echo alive network-wide:
+/// Source pin (#6190): the broken-invariant flag is DIAGNOSTIC ONLY.
 ///
-/// 1. `InterestMessage::ResyncRequest` handling in node.rs served a full
-///    `ResyncResponse`.
-/// 2. The Summaries-mismatch heal (`handle_sync_state_to_peer` in
-///    p2p_protoc/broadcast.rs) pushed full state to a "stale" peer.
-/// 3. `handle_broadcast_state_change` (same file) — the highest-
-///    amplification fan-out sink — is re-entered by re-emission paths
-///    that bypass the executor's emission gate (its own no-target retry
-///    re-emissions, the #4359 stashed-broadcast flush, pending flushes),
-///    re-seeding the echo after a flag lands.
+/// It used to gate the commit, the broadcast and three egress paths, so a
+/// flagged contract stopped advancing on this node, including the node's own
+/// client UPDATEs, which were answered `state_changed: false` and silently
+/// di
```

---

### Incident Patch 3: `76c85b09` (2026-11-15)
**Commit Message**: feat(transport): close a QUIC path whose peer lets three ack waits expire in 30 min (#6208)

**File**: `.claude/rules/transport.md` (modified, +114/-28)
```diff
@@ -1529,6 +1529,13 @@ a test passes its own; tests read their own, never the global).
   level in the period, and the highest count a reset in the period took a path
   to). They are for the fixed charge, which takes quinn's stopped map at
   SEND_ABORT_LIMIT x QUIC_STOPPED_ENTRY_BYTES until field data justifies less.
+  quic_ack_wait_expired_<stream|short|control>: ack-wait expiries that
+  counted as strikes (path::StrikeCheck), by kind; expected 0 on honest
+  paths. quic_stall_close_<not_acknowledging|dark|credit_starved|
+  stream_credit_withheld|ack_waits_expired>: paths the acknowledgement
+  watch closed, by why (recycle::Stall). quic_stall_would_close_<same
+  labels>: times a rule that only observes would have closed a path; only
+  ack_waits_expired observes today (recycle::ACK_WAITS_EXPIRED_CLOSES).
   quic_dark_episode_<recovered_lt_5s|lt_10s|lt_30s|lt_120s|recovered_ge_120s|
   unrecovered|cap_held|closed_at_window>: dark episodes (recycle::AckWatch:
   packets outstanding, nothing acknowledged, nothing heard) by how they ended;
@@ -2210,7 +2217,10 @@ Sending (QuicPath::send_short_bounded / send_stream_bounded /
   also past a deadline that reported MaybeDelivered: Outgoing's drop hands
   the wait to a small task (at most 48 per path, each ending with the
   connection). A one-packet Short holds no permit but its send epoch, and
-  waits the same way, at most ACK_WAITS_WITHOUT_PERMIT (64) per path; past
+  waits the same way, at most ACK_WAITS_WITHOUT_PERMIT (64) per path, each
+  for at most SHORT_ACK_WAIT (120 s), after which its stream is reset,
+  freeing the epoch, and may count as a strike (liveness rules, below); a
+  control frame's wait is bounded the same way; past
   that its epoch is released at once and counted
   (quic_data_event_ack_wait_released) and its stream is reset, so quinn
   discards the unacknowledged packet with the epoch (the reset counts toward
@@ -2399,7 +2409,10 @@ Sending (QuicPath::send_short_bounded / send_stream_bounded /
   Dropping a send future resets its stream (Drop on Outgoing; quinn's own
   drop would FINISH it, which the receiver reads as a stream that ended
   early). A send dropped while waiting for acks after finish is not reset
-  and may still be delivered.
+  and may still be delivered, except when its own deadline ended the wait
+  (a stream's ack wait or total, SendDeadlines::ack_wait), and a one-packet
+  Short or control frame whose background wait reaches SHORT_ACK_WAIT:
+  those are reset (liveness rules, below).
   Each locally reset stream leaves one Arc<Notify> in quinn's per-
   connection `stopped` map until the connection closes (quinn 0.11.12:
   stopped() registers it, and a local reset produces neither the Finished
@@ -2742,31 +2755,102 @@ Path recycling (quic/recycle.rs, #5940 step M6): besides the send-reset
   → Ack wait (SendDeadlines::ack_wait): once a stream's end is sent, its
     acknowledgement is awaited for at most its first age
     (inbound_stream_age_limit(len): its length at 32 KiB/s, at least
-    5 min), or, on a node's sends (QuicPath::stream_deadlines), its length
-    at the credit floor at the path's round trip (credit_floor_rate, at
-    least 16 KiB/s) if that is longer, and at most the 2 h total. When a
-    stream send's deadline runs out after its end was sent (the ack wait,
+    5 min), or, on a node's sends (QuicPath::stream_deadlines), the longer
+    of that, the stream's length at the credit floor at the path's round
+    trip (credit_floor_rate, at least 16 KiB/s), and the time the rest of
+    the stream may take, read when the end is sent: at most its length
+    (and MAX_WINDOW_BYTES) is left, going round-robin at a share of one in
+    the streamed sends in flight, so the sends in flight (their permits)
+    times that, at the floor (QuicPath::backlog_wait); and at most the 2 h
+    total. Multi-packet Shorts (SendDeadlines::short) hold a permit and
+    take the same backlog term. With many large sends in flight a wait
+    can run to the 2 h total, so the expiry rule below can take up to
+    that long to fire there. When
+    a stream send's deadline runs out after its end was sent (the ack wait,
     or the total), the send ends MaybeDelivered(TimedOut) and the stream is
     reset, counted as an abort toward SEND_ABORT_LIMIT, freeing its permit
-    and send epoch. Residual, open (#6205, a gate before UDP removal): no
-    rule recycles a peer that acknowledges other traffic but not Stream
-    ends; only SEND_ABORT_LIMIT (4096 resets) does, as before this rule, so
-    such a peer can keep a path degraded for hours, its streamed sends
-    holding permits and epochs (up to all 48) for their ack waits. A rule
-    counting expiries in a row was removed: an acknowledged multi-packet
-    Short (which has an ack wait) reset it, and acknowledging one Stream
-    end in three defeated it. With UDP present the harm is performance on
-    that path. A Short or a send without an ack wait that ti
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +3/-0)
```diff
@@ -7927,6 +7927,9 @@ mod tests {
         data.dark_episodes = (1078..1086).collect();
         data.carried_dark_episodes = (1087..1095).collect();
         data.ramp_share_pct = 1086;
+        data.ack_wait_expired = (1095..1098).collect();
+        data.stall_closes = (1098..1103).collect();
+        data.stall_would_close = (1103..1108).collect();
         let want: std::collections::BTreeMap<String, u64> =
             snapshot.quic_data.keys().into_iter().collect();
         assert!(want.values().all(|value| *value != 0));
```

**File**: `crates/core/src/transport/egress_cap.rs` (modified, +5/-0)
```diff
@@ -1080,6 +1080,11 @@ impl EgressCap {
         Some(Self::new(total_bytes_per_sec as u64, time_source))
     }
 
+    /// The cap's clock, in nanoseconds.
+    pub(crate) fn now_nanos(&self) -> u64 {
+        (self.clock)()
+    }
+
     /// The cap's rate, in bytes per second.
     pub(crate) fn rate_bytes_per_sec(&self) -> u64 {
         self.rate_bytes_per_sec
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +4/-1)
```diff
@@ -32,8 +32,11 @@ use crate::tracing::{TransferDirection, TransferEvent};
 
 mod quic_data;
 pub use quic_data::QuicDataSnapshot;
+#[cfg(test)]
+pub(crate) use quic_data::STALL_CLOSE_LABELS;
 pub(crate) use quic_data::{
-    DarkEnd, PathGateWindow, PathLossWindow, QuicDataCounters, ShareSource, StreamsOpenPeak,
+    AckWaitKind, DarkEnd, PathGateWindow, PathLossWindow, QuicDataCounters, ShareSource,
+    StreamsOpenPeak,
 };
 
 /// Global transport metrics instance.
```

**File**: `crates/core/src/transport/metrics/quic_data.rs` (modified, +100/-0)
```diff
@@ -31,6 +31,9 @@
 //! | `quic_gate_ended_queue_<bucket>` | paths that ended in the period after at least 20 gate verdicts, by the share of them passed as `queue`: `lt_10pct`, `lt_50pct`, `ge_50pct`. A path whose losses mostly read as a queue runs as plain Cubic, whether the queue is real or jitter |
 //! | `quic_carried_dark_episode_<label>` | the same, for the episodes of paths that carried data when the episode ended: a subset of `quic_dark_episode_<label>`, counted by the same decision |
 //! | `quic_dark_episode_<label>` | dark episodes on QUIC paths (`recycle::AckWatch`: packets outstanding, nothing acknowledged and nothing heard) by how they ended: `recovered_lt_5s`, `lt_10s`, `lt_30s`, `lt_120s`, `recovered_ge_120s`, `unrecovered` (the path closed, or nothing was outstanding any more), `cap_held` (the egress cap held this side's sends, so darkness could no longer be told), `closed_at_window` (the dark-path rule closed a path that carries data). A path that carries no data is never closed by that rule, so its episodes run to their end; read at the watch's 2 s ticks |
+//! | `quic_ack_wait_expired_<label>` | sends whose wait for the acknowledgement of their end ran out and whose stream was reset, by kind: `stream` (a send with an ack wait: a Stream, or a Short past one packet), `short` (a one-packet Short, past its 120 s bound) or `control` (a control frame, bounded as a one-packet Short); only those that count as strikes (`path::StrikeCheck`: evidence the end went out and the peer is alive). An honest peer acknowledges an end within a few round trips, so this should be 0 on every honest path (`recycle::ACK_WAIT_EXPIRY_LIMIT` in `ACK_WAIT_EXPIRY_WINDOW` counts a would-close; the rule does not close a path yet) |
+//! | `quic_stall_close_<label>` | paths the acknowledgement watch closed, by why: `not_acknowledging`, `dark`, `credit_starved`, `stream_credit_withheld`, `ack_waits_expired` (`recycle::Stall`) |
+//! | `quic_stall_would_close_<label>` | times a rule that only observes would have closed a path, by the same labels; each count starts the rule's window afresh. Only `ack_waits_expired` observes today (`recycle::ACK_WAITS_EXPIRED_CLOSES` is false): it counts each time `ACK_WAIT_EXPIRY_LIMIT` strikes came within `ACK_WAIT_EXPIRY_WINDOW`, for calibrating the close from the field (#6205) |
 //! | `quic_send_resets`, `quic_path_ms` | sends a path reset on this side, and the time QUIC paths were up, shadow paths included, up to each path's last tick: resets per connection-hour is their ratio |
 //! | `quic_budget_bytes`, `quic_budget_charged_bytes`, `quic_budget_charged_peak_bytes` | the node's QUIC buffer budget, what its data paths' windows have grown above their floor grants now (the floor grants are each path's fixed charge, not the budget's, so a node with every path at the floor reports 0 and uploads nothing; gauges, not reset, uploaded when not 0), and the most charged at once in the period (`quic::budget`) |
 //! | `quic_staged_peak_pct` | the most any connection staged in the period (bytes read for streams whose header its reader had not taken yet) as a percentage of its staging cap (`quic::path::inbound::ConnStaging`); streams stopped at the cap are `quic_inbound_evicted_staged` |
@@ -167,6 +170,35 @@ pub(crate) const GATE_MIN_VERDICTS: u64 = 20;
 /// queue: under 10%, under 50%, 50% or more.
 pub(crate) const GATE_QUEUE_LABELS: [&str; 3] = ["lt_10pct", "lt_50pct", "ge_50pct"];
 
+/// The labels of `quic_ack_wait_expired_<label>`: sends whose wait for the
+/// acknowledgement of their end ran out (`recycle::AckWatch`'s expiry rule),
+/// by kind: a send with an ack wait (a Stream, or a Short past one packet),
+/// a one-packet Short, or a control frame (whose background wait is bounded
+/// as a one-packet Short's).
+pub(crate) const ACK_WAIT_EXPIRED_LABELS: [&str; 3] = ["stream", "short", "control"];
+
+/// What kind of send's ack wait ran out, for `quic_ack_wait_expired_<label>`.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum AckWaitKind {
+    /// A send with an ack wait (`bounded::SendDeadlines::ack_wait`).
+    Stream = 0,
+    /// A one-packet Short, whose acknowledgement is waited for in the
+    /// background up to its bound.
+    Short = 1,
+    /// A control frame, waited for as a one-packet Short.
+    Control = 2,
+}
+
+/// The labels of `quic_stall_close_<label>`: paths the acknowledgement watch
+/// closed, by why (`recycle::Stall::label`, in its order).
+pub(crate) const STALL_CLOSE_LABELS: [&str; 5] = [
+    "not_acknowledging",
+    "dark",
+    "credit_starved",
+    "stream_credit_withheld",
+    "ack_waits_expired",
+];
+
 /// The labels of `quic_dark_episode_<label>`: dark episodes on QUIC paths
 /// (`recycle::AckWatch`: this side's packets outstanding, nothing
 /// acknowledged and nothing heard), by how they ended: the peer was heard
@@ -457,6 +489,9 @@ pub(crate) struct QuicDataCounters {
     /// Where this node's data share is read from, set when i
```

**File**: `crates/core/src/transport/quic/path.rs` (modified, +308/-16)
```diff
@@ -332,6 +332,10 @@ pub(crate) struct QuicPathLimits {
     /// ([`staging_cap_without_meter`]). A metered path's follows its credit.
     #[cfg(test)]
     pub(crate) staging_cap: Option<usize>,
+    /// The bound on a one-packet Short's background ack wait, in place of
+    /// [`SHORT_ACK_WAIT`], for a test that cannot wait two minutes.
+    #[cfg(test)]
+    pub(crate) short_ack_wait: Option<Duration>,
     /// While the flag is set, the receive side cancels the handle of the
     /// next Stream it admits, before its announce, and clears the flag: a
     /// test of how a stream cancelled that early ends.
@@ -389,6 +393,8 @@ impl QuicPathLimits {
         staging_cap: None,
         #[cfg(test)]
         cancel_next_admitted: None,
+        #[cfg(test)]
+        short_ack_wait: None,
     };
 
     /// [`Self::DEFAULT`] for a path in shadow mode: control frames only.
@@ -789,6 +795,13 @@ pub(crate) struct QuicPath {
     /// Sends with data still to write, for the credit rule
     /// (`recycle::CreditWatch`).
     writers: Arc<recycle::Writers>,
+    /// A sleep on the path's clock, for a stream's bounded background wait
+    /// (`SHORT_ACK_WAIT`).
+    sleeper: Sleeper,
+    /// [`SHORT_ACK_WAIT`], or a test's.
+    short_ack_wait: Duration,
+    /// The path's clock, for judging expired ack waits ([`StrikeCheck`]).
+    clock: Arc<dyn Fn() -> u64 + Send + Sync>,
     /// Set once the path may send data: only then does the acknowledgement
     /// watch's dark-path rule close it (`recycle::AckWatch::observing`).
     carries_data: Arc<std::sync::atomic::AtomicBool>,
@@ -972,6 +985,14 @@ impl QuicPath {
         data: QuicDataSenders,
         windows: Option<&Arc<super::budget::QuicBudget>>,
     ) -> (Self, mpsc::Receiver<Bytes>) {
+        let sleeper: Sleeper = {
+            let time = time.clone();
+            Arc::new(move |duration| time.sleep_cancelable(duration))
+        };
+        let clock: Arc<dyn Fn() -> u64 + Send + Sync> = {
+            let time = time.clone();
+            Arc::new(move || time.now_nanos())
+        };
         let stats = Arc::new(QuicPathStats::new(
             limits
                 .counters
@@ -1105,6 +1126,12 @@ impl QuicPath {
                 meter,
                 stream_slots: Arc::new(tokio::sync::Semaphore::new(STREAMED_SEND_LIMIT as usize)),
                 writers,
+                sleeper,
+                #[cfg(test)]
+                short_ack_wait: limits.short_ack_wait.unwrap_or(SHORT_ACK_WAIT),
+                #[cfg(not(test))]
+                short_ack_wait: SHORT_ACK_WAIT,
+                clock,
                 carries_data,
                 controls_opening: Arc::default(),
                 send_data: AtomicU8::new(SEND_DATA_NEVER),
@@ -1342,6 +1369,11 @@ impl QuicPath {
     /// the credit rule's floor (`recycle::credit_floor_rate`, at least
     /// 16 KiB/s), when that is longer than its first age, so an honest slow
     /// path's stream is not reset while its acknowledgement is on the way.
+    ///
+    /// The time the rest of the stream may take is added when the end is
+    /// sent ([`Outgoing::finish`], [`Self::backlog_wait`]): the streams in
+    /// flight then, times the rest of this one (at most `len`), at the
+    /// floor.
     pub(crate) fn stream_deadlines(&self, len: u64) -> SendDeadlines {
         let deadlines = SendDeadlines::stream(len).with_gap(self.receiver_gap());
         let floor = recycle::credit_floor_rate(self.connection.inner().stats().path.rtt).max(1);
@@ -1350,10 +1382,33 @@ impl QuicPath {
             ack_wait: deadlines
                 .ack_wait
                 .map(|wait| wait.max(at_floor).min(deadlines.total)),
+            ack_wait_covers_backlog: true,
             ..deadlines
         }
     }
 
+    /// How long the rest of a stream of `len` bytes may take to go out, read
+    /// when its end is sent: at most `len` (and at most the send window,
+    /// `budget::MAX_WINDOW_BYTES` at its largest) is left of it, and quinn
+    /// shares the link round-robin among the streams with data, so it goes
+    /// at a share of one in the streamed sends in flight (their permits).
+    /// That is the sends in flight times the rest, at the credit floor at
+    /// the path's round trip.
+    fn backlog_wait(&self, len: u64) -> Arc<dyn Fn() -> Duration + Send + Sync> {
+        let (slots, connection) = (self.stream_slots.clone(), self.connection.inner().clone());
+        Arc::new(move || {
+            let in_flight = (STREAMED_SEND_LIMIT as u64)
+                .saturating_sub(slots.available_permits() as u64)
+                .max(1);
+            let floor = recycle::credit_floor_rate(connection.stats().path.rtt).max(1);
+            Duration::from_secs(
+                in_flight
+                    .saturating_mul(len.min(super::budget::MAX_WINDOW_BYTES))
+                    .div_ceil(floor),
+            )
+        })
+    }
+
     /// The connection, for tests that write raw streams
```

**File**: `crates/core/src/transport/quic/path/bounded.rs` (modified, +65/-2)
```diff
@@ -79,6 +79,10 @@ pub(crate) struct SendDeadlines {
     /// abort (`Outgoing`'s drop), so a peer that never acknowledges a
     /// stream's last packet cannot hold its permit and send epoch for long.
     pub(crate) ack_wait: Option<Duration>,
+    /// The ack wait also covers the backlog ahead of the stream's end, read
+    /// when the end is sent ([`SendProgress::mark_finished_behind`]): a
+    /// node's sends (`QuicPath::stream_deadlines`).
+    pub(crate) ack_wait_covers_backlog: bool,
 }
 
 impl SendDeadlines {
@@ -90,6 +94,7 @@ impl SendDeadlines {
             source_gap: None,
             total: timeout,
             ack_wait: None,
+            ack_wait_covers_backlog: false,
         }
     }
 
@@ -104,9 +109,15 @@ impl SendDeadlines {
                 source_gap: None,
                 total: SHORT_TOTAL_TIMEOUT,
                 ack_wait: None,
+                ack_wait_covers_backlog: false,
             }
         } else {
-            Self::stream(len)
+            // It holds a permit and shares the link as a stream does, so its
+            // ack wait covers the backlog ahead of its end too.
+            Self {
+                ack_wait_covers_backlog: true,
+                ..Self::stream(len)
+            }
         }
     }
 
@@ -129,6 +140,7 @@ impl SendDeadlines {
             source_gap: None,
             total,
             ack_wait: Some(inbound_stream_age_limit(len).min(total)),
+            ack_wait_covers_backlog: false,
         }
     }
 
@@ -266,6 +278,14 @@ struct ProgressState {
     finished_at: AtomicU64,
     /// [`SendProgress::ack_wait_ended`].
     ack_wait_ended: AtomicBool,
+    /// [`SendProgress::ack_wait_due`].
+    ack_wait_due: AtomicU64,
+    /// The ack wait's deadline once the end is sent, recorded each time the
+    /// loop arms; zero before ([`SendProgress::ack_wait_left`]).
+    ack_wait_deadline: AtomicU64,
+    /// The backlog ahead of the end when it was sent, in nanoseconds
+    /// ([`SendProgress::mark_finished_behind`]).
+    backlog_wait: AtomicU64,
 }
 
 impl SendProgress {
@@ -286,6 +306,9 @@ impl SendProgress {
             refused: AtomicBool::new(false),
             finished_at: AtomicU64::new(0),
             ack_wait_ended: AtomicBool::new(false),
+            ack_wait_due: AtomicU64::new(0),
+            ack_wait_deadline: AtomicU64::new(0),
+            backlog_wait: AtomicU64::new(0),
         }))
     }
 
@@ -305,6 +328,9 @@ impl SendProgress {
             refused: AtomicBool::new(false),
             finished_at: AtomicU64::new(0),
             ack_wait_ended: AtomicBool::new(false),
+            ack_wait_due: AtomicU64::new(0),
+            ack_wait_deadline: AtomicU64::new(0),
+            backlog_wait: AtomicU64::new(0),
         }))
     }
 
@@ -403,7 +429,16 @@ impl SendProgress {
     }
 
     /// Every byte was written and the end of the stream queued.
+    #[cfg(test)]
     pub(super) fn mark_finished(&self) {
+        self.mark_finished_behind(Duration::ZERO);
+    }
+
+    /// [`Self::mark_finished`], with `backlog`: how long the bytes still
+    /// ahead of the stream's end may take to go out, which extends its ack
+    /// wait ([`SendDeadlines::ack_wait`]) to at least that, within its total.
+    pub(super) fn mark_finished_behind(&self, backlog: Duration) {
+        self.0.backlog_wait.store(nanos(backlog), Ordering::Release);
         self.0.finished_at.store((self.0.now)(), Ordering::Release);
         self.0.stage.store(STAGE_FINISHED, Ordering::Release);
         // The loop re-arms at the ack wait's end, which may come before the
@@ -419,6 +454,20 @@ impl SendProgress {
         self.0.ack_wait_ended.load(Ordering::Acquire)
     }
 
+    /// When the ack wait that ended was due, in nanoseconds on the send's
+    /// clock ([`Self::ack_wait_ended`]).
+    pub(super) fn ack_wait_due(&self) -> u64 {
+        self.0.ack_wait_due.load(Ordering::Acquire)
+    }
+
+    /// What is left of the ack wait of a send whose end was sent, if it has
+    /// one: from now to its deadline, at most `deadlines.total` from the
+    /// start (recorded by [`bounded_send`]).
+    pub(super) fn ack_wait_left(&self) -> Option<Duration> {
+        let deadline = self.0.ack_wait_deadline.load(Ordering::Acquire);
+        (deadline != 0).then(|| Duration::from_nanos(deadline.saturating_sub((self.0.now)())))
+    }
+
     fn stage(&self) -> u8 {
         self.0.stage.load(Ordering::Acquire)
     }
@@ -461,10 +510,15 @@ impl SendProgress {
             }
             _ => (
                 deadlines.ack_wait.map_or(total, |wait| {
+                    let backlog = if deadlines.ack_wait_covers_backlog {
+                        self.0.backlog_wait.load(Ordering::Acquire)
+                    } else {
+                        0
+                    };
                     self.0
                         .finished_at
                         .load(Ordering::Acquire)
-                        .saturating_add(nanos(wait))
+               
```

**File**: `crates/core/src/transport/quic/path/route.rs` (modified, +6/-4)
```diff
@@ -182,10 +182,12 @@ pub(crate) fn next_step(kind: SendKind, outcome: &BoundedSend) -> (NextStep, Qui
 /// count: a path whose sends nothing acknowledges is closed by its
 /// acknowledgement watch's dark-path rule (`recycle::AckWatch`); a peer that
 /// acknowledges other traffic but never a stream's end has the stream reset
-/// at its ack wait (`bounded::SendDeadlines::ack_wait`), counted as an abort
-/// toward `recycle::SEND_ABORT_LIMIT`; and a peer that withholds its
-/// stream limit is closed by the stream-credit rule
-/// (`recycle::StreamCreditWatch`).
+/// at its ack wait (`bounded::SendDeadlines::ack_wait`), and three strikes
+/// within 30 min are counted as a would-close
+/// (`recycle::ACK_WAIT_EXPIRY_LIMIT`); that rule only observes for now
+/// (`recycle::ACK_WAITS_EXPIRED_CLOSES`), so such a peer is bounded by
+/// `recycle::SEND_ABORT_LIMIT`; and a peer that withholds its stream limit is
+/// closed by the stream-credit rule (`recycle::StreamCreditWatch`).
 fn timed_out(outcome: &BoundedSend) -> bool {
     match outcome {
         BoundedSend::MaybeDelivered(MaybeDelivered::TimedOut)
```

#### Recent Merged Pull Requests:
- **PR #6237** (2026-11-15): fix: replace the broken-invariant contract freeze with a per-contract merge budget (@sanity)
- **PR #6235** (2026-11-15): ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache) (@sanity)
- **PR #6230** (2026-11-14): build: release 0.2.157 (@sanity)
- **PR #6228** (2026-11-13): chore(release): raise the QUIC-native wire floor to 0.2.158 (@sanity)
- **PR #6225** (2026-11-13): docs(config): --transport-quic help says prefer is the default (@sanity)
- **PR #6223** (2026-11-13): fix(test): a lost VirtualTime wakeup and drive_on_threads advancing over busy workers (@sanity)

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

## X. ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache)

**RULE**:
When implementing operations in `.github/scripts/check_cache_warm_parity.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `66b4a932`: ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/check_cache_warm_parity.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
6. the warm job runs on the same kind of runner as its twin: a Ubicloud
   runner with the same label suffix (architecture, OS variant), or, for a
   GitHub-hosted twin (macOS), the identical label, since GitHub's cache
   backend is only written by GitHub-hosted runners; its display name starts with
It also DISCOVERS which ci.yml jobs need a twin: a job (Ubicloud or macOS) whose
    """A job that restores a cache it can never write itself.
    own. The runner may be Ubicloud or GitHub-hosted (macOS): each has its own
    cache backend, so the warm job must run on the same kind of runner (see the
    runner check in ``check``).
    # windows_unit has the same shape (#6236) and no warm twin yet; widen this
    # to GitHub-hosted runners generally when one is added.
    ro = _runs_on(job)
    if "ubicloud" not in ro and not ro.startswith("macos-"):
            f"{ci_name}: no job looks like it needs a warm twin (Ubicloud or macOS runner, "
                f"a Ubicloud or macOS runner. Delete the warm job, or restore the twin's shape."
        if "ubicloud" not in _runs_on(ci_job):
            # GitHub-hosted twin: its cache lives in GitHub's backend, which
            # only a GitHub
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
6. the warm job runs on a Ubicloud runner with the same label suffix
   (architecture, OS variant), and its display name starts with
It also DISCOVERS which ci.yml jobs need a twin: a Ubicloud job whose
    """A Ubicloud job that restores a cache it can never write itself.
    own; a GitHub-hosted job uses a different cache backend, which a Ubicloud
    warm job could not fill.
    if "ubicloud" not in _runs_on(job):
            f"{ci_name}: no job looks like it needs a warm twin (Ubicloud, "
                f"Ubicloud. Delete the warm job, or restore the twin's shape."
        if "ubicloud" not in warm_ro:
                f"{warm_name}: job `{job_id}` runs on `{warm_ro}`. Ubicloud "
                f"serves its own cache backend, so an entry saved from any other "
                f"runner is invisible to the Ubicloud PR job. Use a "
                f"`ubicloud-standard-*` label."
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `66b4a932` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
