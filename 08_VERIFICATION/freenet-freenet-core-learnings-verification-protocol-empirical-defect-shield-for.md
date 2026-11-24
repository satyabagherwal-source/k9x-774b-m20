# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet-freenet-core-learnings

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T17:43:23.714Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T17:43:23.714Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `freenet-freenet-core-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `e9613f90`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T17:42:46.043Z  
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
> **Harvest Timestamp**: 2026-11-24T17:42:46.037Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3132 stars

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
- **Issue #6374** (2026-11-24): **fix: an older peer refusing us no longer shows "update required"**
  *Symptoms*: ## Problem A node on the latest release showed "Version mismatch — update required" with a `cargo install ... --version 0.2.117` downgrade command. When this node dials a peer running an older release that refuses it, `handle_ack_connection_error` returned `ProtocolVersionMismatch { expected: <remote version> }` even in the branch where we do NOT need to update. `record_gateway_failure` runs for every failed outbound dial, `classify_transport_error` turned the text into `FailureReason::VersionMismatch`, and that forced health to Trouble even with open connections. The entry stayed until the next new connection. About half of 0.2.164 nodes hit an old peer's refusal in telemetry.  ## Approach - New `TransportError::PeerVersionOutdated { peer_version }`, returned when the refusing peer is not newer than us. Its Display text carries no "Version incompatibility" and no install command. `ProtocolVersionMismatch` is now only produced when we must update. - `classify_transport_error` also requires the remote version to be strictly newer than ours before recording `VersionMismatch` (second guard; the banner can never offer an older version). - A recorded `VersionMismatch` forces Trouble only when the node has no open connections. - Fixed the misleading log line ("within our compatible range" for a peer below our floor). - Wire bytes unchanged: `TransportError` is not serialized anywhere on the wire; it is converted to a string (`ConnectionError::TransportError(String)`) for local clas

- **Issue #6373** (2026-11-24): **fix(release): verify gateway update downloads; keep docker latest monotonic**
  *Symptoms*: ## Problem  `gateway-auto-update.sh` runs as root on the gateways and installed whatever archive the GitHub release served. It never checked the archive against the signed `SHA256SUMS.txt` that every release has carried since #4587. The node's own updater does check it. A release-asset swap therefore reached the gateways unchecked. Two further gaps, found in the release-tooling audit behind #6361: - Re-publishing an older tag could move the Docker `latest` and minor tags backwards. - `scripts/release-agent` still carried vega files for a host retired in #5540.  ## Approach  **Gateway updater (`scripts/gateway-auto-update.sh`)** - Downloads go into a fresh private directory, over HTTPS only and with size and time bounds. The script verifies the ed25519 signature on `SHA256SUMS.txt`. The key is pinned in the script and tested against `update.rs` and the Docker key copy. It then requires exactly one manifest line for the archive and a matching sha256. All of this happens before anything is extracted. Any failure logs `Release verification FAILED`, leaves the running gateway untouched, and the script fails closed. - The binary must report exactly the target version, which stops an older signed release being replayed under a newer tag. - A version older than the installed one is refused unless `--allow-downgrade` is given. That flag is accepted on argv only, and is refused when the caller is the release-agent account. Versions are compared by SemVer precedence, so 0.2.150-rc1 sort

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

### Incident Patch 1: `e9613f90` (2026-11-24)
**Commit Message**: fix: an older peer refusing us no longer shows "update required" (#6374)

**File**: `crates/core/src/node/network_status.rs` (modified, +97/-1)
```diff
@@ -2892,7 +2892,24 @@ pub fn classify_transport_error(error_msg: &str) -> FailureReason {
             .map(|s| s.trim().to_string())
             .unwrap_or_default();
         if is_well_formed_version(&local) && is_well_formed_version(&gateway) {
-            FailureReason::VersionMismatch { local, gateway }
+            // "Update required" is only true when the remote is NEWER. The
+            // transport layer already sends an older peer's refusal as a
+            // different error, so this is a second guard: the banner must
+            // never tell the user to install a version older than their own.
+            let remote_is_newer = match (
+                semver::Version::parse(&local),
+                semver::Version::parse(&gateway),
+            ) {
+                (Ok(l), Ok(g)) => g > l,
+                _ => false,
+            };
+            if remote_is_newer {
+                FailureReason::VersionMismatch { local, gateway }
+            } else {
+                FailureReason::Other(format!(
+                    "peer runs an incompatible version {gateway} (this node runs {local})"
+                ))
+            }
         } else {
             FailureReason::Other("version mismatch (version text not recognised)".to_string())
         }
@@ -3462,6 +3479,85 @@ mod tests {
         assert!(snap.failures[0].reason_html.contains("0.1.1"));
     }
 
+    fn status_addr(last: u8) -> SocketAddr {
+        SocketAddr::new(IpAddr::V4(Ipv4Addr::new(10, 9, 8, last)), 31337)
+    }
+
+    fn connect_peer(addr: SocketAddr) {
+        record_peer_connected(addr, None, None);
+    }
+
+    /// Regression: an older peer refusing a node on the latest release was
+    /// recorded as a version mismatch, so the dashboard said "update
+    /// required" and offered a downgrade command.
+    #[test]
+    fn older_peer_refusal_is_not_a_version_mismatch() {
+        let error = crate::transport::TransportError::PeerVersionOutdated {
+            peer_version: "0.2.117".into(),
+        };
+        let message = crate::node::network_bridge::ConnectionError::from(error).to_string();
+        assert!(!matches!(
+            classify_transport_error(&message),
+            FailureReason::VersionMismatch { .. }
+        ));
+        // Second guard: even the legacy mismatch text is not a mismatch when
+        // the remote is older than us.
+        let legacy = "Version incompatibility with gateway\n  Your client version: 0.2.164\n  Gateway version: 0.2.117\n  \n";
+        match classify_transport_error(legacy) {
+            FailureReason::Other(m) => assert!(m.contains("0.2.117")),
+            FailureReason::VersionMismatch { .. }
+            | FailureReason::NatTraversalFailed
+            | FailureReason::Timeout => panic!("older peer must not be a VersionMismatch"),
+        }
+    }
+
+    #[test]
+    fn newer_peer_requiring_update_is_still_a_version_mismatch() {
+        let error = crate::transport::TransportError::ProtocolVersionMismatch {
+            expected: "0.2.170".into(),
+            actual: "0.2.164".into(),
+        };
+        let message = crate::node::network_bridge::ConnectionError::from(error).to_string();
+        match classify_transport_error(&message) {
+            FailureReason::VersionMismatch { local, gateway } => {
+                assert_eq!(local, "0.2.164");
+                assert_eq!(gateway, "0.2.170");
+            }
+            FailureReason::NatTraversalFailed
+            | FailureReason::Timeout
+            | FailureReason::Other(_) => panic!("expected VersionMismatch from {message:?}"),
+        }
+    }
+
+    #[test]
+    fn older_peer_refusal_does_not_make_connected_node_trouble() {
+        let _lock = lock_global_state_for_test();
+        init(31340, HashSet::new(), "0.2.164".to_string());
+        connect_peer(status_addr(1));
+        // The real Display text of both errors an older peer's refusal can
+        // arrive as: the dedicated variant, and the legacy mismatch text with
+        // the remote older than us (the classifier guard).
+        let refusals = [
+            crate::transport::TransportError::PeerVersionOutdated {
+                peer_version: "0.2.117".into(),
+            },
+            crate::transport::TransportError::ProtocolVersionMismatch {
+                expected: "0.2.117".into(),
+                actual: "0.2.164".into(),
+            },
+        ];
+        for refusal in refusals {
+            record_gateway_failure(
+                status_addr(2),
+                classify_transport_error(&refusal.to_string()),
+            );
+            let snap = get_snapshot().unwrap();
+            assert_ne!(snap.health, HealthLevel::Trouble);
+            assert!(!snap.failures[0].reason_html.contains("Version mismatch"));
+            assert!(!snap.failures[0].reason_html.contains("cargo install"));
+        }
+    }
+
     #[test]
     fn test_format_duration() {
         assert_eq!(format_duration(0), "0s");
```

**File**: `crates/core/src/server/home_page.rs` (modified, +68/-0)
```diff
@@ -242,6 +242,74 @@ fn homepage_html_for(snap: Option<network_status::NetworkStatusSnapshot>, hosted
 mod tests {
     use super::*;
 
+    /// Drive the real failure path (transport error text -> classifier ->
+    /// recorded failure -> snapshot -> status card) and return the card.
+    fn status_card_after_refusal(
+        error: crate::transport::TransportError,
+        version: &str,
+        port: u16,
+    ) -> String {
+        use crate::node::network_status as ns;
+        let message = error.to_string();
+        ns::init(port, Default::default(), version.to_string());
+        ns::record_gateway_failure(
+            "10.9.8.7:31337".parse().unwrap(),
+            ns::classify_transport_error(&message),
+        );
+        cards::build_status_card(&ns::get_snapshot())
+    }
+
+    /// Regression: an older peer refusing us must never produce the "update
+    /// required" banner or an install command for an older version.
+    #[test]
+    fn older_peer_refusal_never_shows_update_banner() {
+        let _lock = crate::node::network_status::lock_global_state_for_test();
+        let card = status_card_after_refusal(
+            crate::transport::TransportError::PeerVersionOutdated {
+                peer_version: "0.2.117".into(),
+            },
+            "0.2.164",
+            31350,
+        );
+        assert!(!card.contains("update required"), "{card}");
+        assert!(!card.contains("Version mismatch"), "{card}");
+        assert!(!card.contains("--version 0.2.117"), "{card}");
+    }
+
+    /// The real mismatch Display text with the remote OLDER than us must not
+    /// produce the banner either (second guard in the classifier).
+    #[test]
+    fn mismatch_text_with_older_remote_never_shows_update_banner() {
+        let _lock = crate::node::network_status::lock_global_state_for_test();
+        let card = status_card_after_refusal(
+            crate::transport::TransportError::ProtocolVersionMismatch {
+                expected: "0.2.117".into(),
+                actual: "0.2.164".into(),
+            },
+            "0.2.164",
+            31352,
+        );
+        assert!(!card.contains("update required"), "{card}");
+        assert!(!card.contains("--version 0.2.117"), "{card}");
+    }
+
+    /// A newer peer requiring an update keeps the banner for a node that has
+    /// no connections, and the version it offers is newer than the running one.
+    #[test]
+    fn newer_peer_requiring_update_shows_banner_without_connections() {
+        let _lock = crate::node::network_status::lock_global_state_for_test();
+        let card = status_card_after_refusal(
+            crate::transport::TransportError::ProtocolVersionMismatch {
+                expected: "0.2.170".into(),
+                actual: "0.2.164".into(),
+            },
+            "0.2.164",
+            31351,
+        );
+        assert!(card.contains("update required"), "{card}");
+        assert!(card.contains("--version 0.2.170"), "{card}");
+    }
+
     /// A hosted node does not serve `/permission/apps`, so its home page does
     /// not link to it; a node that is not hosted keeps the link.
     ///
```

**File**: `crates/core/src/transport.rs` (modified, +10/-0)
```diff
@@ -406,6 +406,11 @@ pub enum TransportError {
         "Version incompatibility with gateway\n  Your client version: {actual}\n  Gateway version: {expected}\n  \n  To fix this, update your Freenet client:\n    cargo install --force freenet --version {expected}\n  \n  Or if building from source:\n    git pull && cargo install --path crates/core"
     )]
     ProtocolVersionMismatch { expected: String, actual: String },
+    /// The remote peer runs an OLDER release that refused us. We do not need
+    /// to update, so this must never be shown as "update required". Local
+    /// classification only: never serialized onto the wire.
+    #[error("peer runs an outdated version {peer_version} and refused this connection")]
+    PeerVersionOutdated { peer_version: String },
     #[error("outbound stream to {0} failed (stream-scoped, connection survives)")]
     OutboundStreamFailed(SocketAddr),
     /// An outbound stream was not started because its length is outside
@@ -694,6 +699,7 @@ impl TransportError {
             | TransportError::ConnectionClosed(_)
             | TransportError::ConnectionEstablishmentFailure { .. }
             | TransportError::ProtocolVersionMismatch { .. }
+            | TransportError::PeerVersionOutdated { .. }
             | TransportError::Other(_)
             | TransportError::Udp(UdpError(
                 UdpErrorKind::IO(_)
@@ -1227,6 +1233,7 @@ mod tests {
                 TransportError::ProtocolVersionMismatch { .. } => {
                     (ErrorScope::Connection, false, true)
                 }
+                TransportError::PeerVersionOutdated { .. } => (ErrorScope::Connection, false, true),
                 TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..))) => {
                     (ErrorScope::Transient, true, false)
                 }
@@ -1280,6 +1287,9 @@ mod tests {
                 expected: "1".into(),
                 actual: "2".into(),
             },
+            TransportError::PeerVersionOutdated {
+                peer_version: "1".into(),
+            },
             TransportError::send_failed(addr, io::ErrorKind::NetworkUnreachable),
             TransportError::OutboundStreamFailed(addr),
             TransportError::SendQueueFull(addr),
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +28/-7)
```diff
@@ -3060,7 +3060,11 @@ impl<S: Socket, T: TimeSource> UdpPacketsListener<S, T> {
                         // Failed gateway connection
                         Err((error, remote_addr)) => {
                             tracing::info!(error = %error, peer_addr = %remote_addr, "Failed to establish gateway connection");
-                            if matches!(error, TransportError::ProtocolVersionMismatch { .. }) {
+                            if matches!(
+                                error,
+                                TransportError::ProtocolVersionMismatch { .. }
+                                    | TransportError::PeerVersionOutdated { .. }
+                            ) {
                                 outdated_peer.insert(remote_addr, self.time_source.now_nanos());
                             }
                             self.connections.fail_gateway_handshake(&remote_addr);
@@ -3137,7 +3141,8 @@ impl<S: Socket, T: TimeSource> UdpPacketsListener<S, T> {
                                 &crate::transport::TRANSPORT_METRICS,
                             );
                             match &error {
-                                TransportError::ProtocolVersionMismatch { .. } => {
+                                TransportError::ProtocolVersionMismatch { .. }
+                                | TransportError::PeerVersionOutdated { .. } => {
                                     tracing::warn!(%error);
                                     crate::transport::TRANSPORT_METRICS
                                         .record_nat_traversal_failed_version();
@@ -4348,7 +4353,8 @@ fn classify_nat_failure(
         return NatFailureKind::VersionIncompatible;
     }
     match error {
-        TransportError::ProtocolVersionMismatch { .. } => NatFailureKind::VersionIncompatible,
+        TransportError::ProtocolVersionMismatch { .. }
+        | TransportError::PeerVersionOutdated { .. } => NatFailureKind::VersionIncompatible,
         TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..))) => NatFailureKind::SendError,
         TransportError::ChannelClosed
         | TransportError::ConnectionClosed(_)
@@ -4640,11 +4646,12 @@ fn handle_ack_connection_error(err: Cow<'static, str>) -> TransportError {
         ) {
             tracing::info!(
                 remote_version = remote_version_str,
-                "Old peer rejected us (strict match) but is within our compatible range — not triggering self-update"
+                "Old peer rejected us (strict match) but is not newer than us — not triggering self-update"
             );
-            return TransportError::ProtocolVersionMismatch {
-                expected: remote_version_str.to_string(),
-                actual: PCK_VERSION.to_string(),
+            // The remote is the one that is out of date: record it as such so
+            // the dashboard never tells the user to install the remote's version.
+            return TransportError::PeerVersionOutdated {
+                peer_version: remote_version_str.to_string(),
             };
         }
         // Remote is genuinely newer — signal version mismatch
@@ -4939,6 +4946,7 @@ pub mod mock_transport {
             TransportError::ChannelClosed
             | TransportError::ConnectionClosed(_)
             | TransportError::ConnectionEstablishmentFailure { .. }
+            | TransportError::PeerVersionOutdated { .. }
             | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..)))
             | TransportError::OutboundStreamFailed(_)
             | TransportError::OutboundStreamInvalidLength(..)
@@ -4978,6 +4986,18 @@ pub mod mock_transport {
             &ok,
             TransportError::ProtocolVersionMismatch { expected, .. } if expected == "1.2.3-rc.1+b5"
         ));
+        // An OLDER peer refusing us is not a request for us to update: it must
+        // not be reported as a version mismatch (which drives the "update
+        // required" banner) and must not carry a downgrade install command.
+        let older = handle_ack_connection_error("expected version 0.2.117".to_string().into());
+        assert!(
+            matches!(
+                &older,
+                TransportError::PeerVersionOutdated { peer_version } if peer_version == "0.2.117"
+            ),
+            "older peer must not be a ProtocolVersionMismatch, got {older:?}"
+        );
+        assert!(!older.to_string().contains("cargo install"));
         let long_other = "x".repeat(500);
         let err = handle_ack_connection_error(long_other.into());
         assert!(matches!(
@@ -4993,6 +5013,7 @@ pub mod mock_transport {
             TransportError::ChannelClosed
             | TransportError::ConnectionClosed(_)
             | TransportError::ProtocolVersionMismatch { .. }
+            | TransportError::PeerVersionOutdated { .. }
             | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..)))
             | TransportError::OutboundStreamFailed(_)
             | Transpo
```

**File**: `crates/core/src/transport/connection_handler/version_cmp.rs` (modified, +42/-1)
```diff
@@ -151,6 +151,31 @@ const fn parse_semver(version: &str) -> (u8, u8, u16) {
     (major, minor, patch)
 }
 
+/// [`parse_semver`] for text a remote peer sent: `None` when a component does
+/// not fit the wire width (`u8.u8.u16`) instead of overflowing (a debug
+/// panic, or a silent wrap in release) or truncating ("256.0.0" reading as
+/// 0.0.0). Callers must treat `None` as "not newer than us".
+fn try_parse_semver(version: &str) -> Option<(u8, u8, u16)> {
+    let mut parts = [0u32; 3];
+    let mut state = 0usize;
+    for c in version.bytes() {
+        if c == b'.' {
+            state += 1;
+        } else if c.is_ascii_digit() {
+            if let Some(part) = parts.get_mut(state) {
+                *part = part.checked_mul(10)?.checked_add(u32::from(c - b'0'))?;
+            }
+        } else {
+            break; // Pre-release suffix.
+        }
+    }
+    Some((
+        u8::try_from(parts[0]).ok()?,
+        u8::try_from(parts[1]).ok()?,
+        u16::try_from(parts[2]).ok()?,
+    ))
+}
+
 /// Parse 8 version bytes. Detects old (byte[7]==0) vs new (byte[0]==0xFF, byte[7]!=0).
 pub(super) fn parse_version_bytes(bytes: &[u8; 8]) -> VersionInfo {
     if bytes[0] == NEW_FORMAT_MARKER && bytes[7] != 0 {
@@ -305,7 +330,10 @@ pub(super) fn old_peer_rejection_means_we_must_update(
     local: &[u8; 8],
 ) -> bool {
     let local_info = parse_version_bytes(local);
-    let (rmaj, rmin, rpatch) = parse_semver(remote_version_str);
+    // An unrepresentable remote version cannot be shown to be newer than us.
+    let Some((rmaj, rmin, rpatch)) = try_parse_semver(remote_version_str) else {
+        return false;
+    };
 
     if let Some(local_min) = local_info.min_compatible {
         // If remote < our min, we don't care about their rejection
@@ -652,6 +680,19 @@ mod tests {
     /// parse_semver with adversarial/malformed input.
     #[test]
     fn test_parse_semver_malformed() {
+        assert_eq!(try_parse_semver("0.2.164"), Some((0, 2, 164)));
+        assert_eq!(try_parse_semver("1.2.3-rc.1+b5"), Some((1, 2, 3)));
+        assert_eq!(try_parse_semver("0.2.65535"), Some((0, 2, 65535)));
+        for unrepresentable in ["0.2.70000", "256.0.0", "0.256.0", "99999999999.0.0"] {
+            assert_eq!(try_parse_semver(unrepresentable), None, "{unrepresentable}");
+        }
+        // Peer-supplied text that overflows must fail safe: not "newer".
+        let local = encode_new_format("0.1.153", "0.1.150");
+        assert!(!old_peer_rejection_means_we_must_update(
+            "0.2.70000",
+            &local
+        ));
+        assert!(!old_peer_rejection_means_we_must_update("256.0.0", &local));
         // Empty string
         assert_eq!(parse_semver(""), (0, 0, 0));
         // Missing patch
```

---

### Incident Patch 2: `7f386ac7` (2026-11-24)
**Commit Message**: fix(release): verify gateway update downloads; keep docker latest monotonic (#6373)

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -447,7 +447,7 @@ jobs:
       # clean when they landed but were not actually in this list, so nothing
       # held them to it. `-x` because the two test scripts `source` the canary.
       - name: Lint install/uninstall scripts (shellcheck)
-        run: shellcheck -x scripts/check-x86-64-baseline.sh scripts/check-x86-64-baseline_test.sh scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh scripts/wan-bench-classify.sh scripts/wan-bench-classify_test.sh scripts/cache_warm_parity_test.sh scripts/simulation_schedule_test.sh scripts/check_quic_data_ramp_t0.sh scripts/check_quic_data_ramp_t0_test.sh scripts/check_release_preflight.sh scripts/check_release_preflight_test.sh scripts/apply_version_bump.sh scripts/release_lib.sh scripts/resolve_release_ship.sh scripts/resolve_release_ship_test.sh scripts/wait_for_release_ci.sh scripts/wait_for_release_ci_test.sh scripts/release_sync.sh scripts/release_sync_test.sh scripts/verify_release_checkout.sh scripts/release_mergequeue_test.sh scripts/release_publish_steps_test.sh
+        run: shellcheck -x scripts/check-x86-64-baseline.sh scripts/check-x86-64-baseline_test.sh scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh scripts/wan-bench-classify.sh scripts/wan-bench-classify_test.sh scripts/cache_warm_parity_test.sh scripts/simulation_schedule_test.sh scripts/check_quic_data_ramp_t0.sh scripts/check_quic_data_ramp_t0_test.sh scripts/check_release_preflight.sh scripts/check_release_preflight_test.sh scripts/apply_version_bump.sh scripts/release_lib.sh scripts/resolve_release_ship.sh scripts/resolve_release_ship_test.sh scripts/wait_for_release_ci.sh scripts/wait_for_release_ci_test.sh scripts/release_sync.sh scripts/release_sync_test.sh scripts/verify_release_checkout.sh scripts/release_mergequeue_test.sh scripts/release_publish_steps_test.sh scripts/gateway-auto-update.sh scripts/release-agent/gateway-auto-update_test.sh
       # The PR-backlog sweep reports stalled PRs (see
       # .github/workflows/pr-backlog-sweep.yml). Its self-test drives the ABORT
       # paths -- failed query, empty listing the REST probe contradicts,
```

**File**: `.github/workflows/docker-publish.yml` (modified, +90/-7)
```diff
@@ -323,19 +323,28 @@ jobs:
         id: version
         env:
           RELEASE_TAG: ${{ github.event.release.tag_name || inputs.tag }}
+          RELEASE_PRERELEASE: ${{ github.event.release.prerelease }}
         run: |
           set -euo pipefail
+          # Release tags are always v-prefixed semver. Refuse anything else
+          # rather than guess: a dispatched `0.2.150` would otherwise compare
+          # unequal to every listed tag and skip the floating tags silently.
+          if ! printf '%s' "$RELEASE_TAG" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'; then
+            echo "::error::Release tag '${RELEASE_TAG}' is not of the form vX.Y.Z[-pre]."
+            exit 1
+          fi
           version="${RELEASE_TAG#v}"
           minor="${version%.*}"
           echo "tag=${RELEASE_TAG}" >> "$GITHUB_OUTPUT"
           echo "version=${version}" >> "$GITHUB_OUTPUT"
           echo "minor=${minor}" >> "$GITHUB_OUTPUT"
 
-          # `latest` and the minor tag must move only for a stable release.
-          # `!github.event.release.prerelease` is TRUE on a workflow_dispatch,
-          # where that field is empty, so a dispatched prerelease tag would
-          # otherwise take over `latest`. Decide from the version string too.
-          if [ "${{ github.event.release.prerelease }}" = "true" ]; then
+          # The floating tags (`latest`, the minor tag) may move only for a
+          # stable release. `!github.event.release.prerelease` is TRUE on a
+          # workflow_dispatch, where that field is empty, so a dispatched
+          # prerelease tag would otherwise take over `latest`. Decide from the
+          # version string too.
+          if [ "${RELEASE_PRERELEASE:-}" = "true" ]; then
             is_stable=false
           elif printf '%s' "$version" | grep -q -- '-'; then
             is_stable=false
@@ -345,15 +354,16 @@ jobs:
           echo "is_stable=${is_stable}" >> "$GITHUB_OUTPUT"
           echo "stable release: ${is_stable}"
 
+      # Only the immutable per-release tags are pushed here. The floating tags
+      # (`latest`, `X.Y`) are moved by "Move the floating tags" below, AFTER the
+      # push, from a fresh look at the published releases.
       - uses: docker/metadata-action@v6
         id: metadata
         with:
           images: ghcr.io/${{ github.repository }}
           tags: |
             type=raw,value=${{ steps.version.outputs.tag }}
             type=raw,value=${{ steps.version.outputs.version }}
-            type=raw,value=${{ steps.version.outputs.minor }},enable=${{ steps.version.outputs.is_stable == 'true' }}
-            type=raw,value=latest,enable=${{ steps.version.outputs.is_stable == 'true' }}
           labels: |
             org.opencontainers.image.version=${{ steps.version.outputs.version }}
 
@@ -376,6 +386,79 @@ jobs:
           build-args: |
             FREENET_VERSION=${{ steps.version.outputs.tag }}
 
+      # `latest` must name the highest published non-prerelease release, and
+      # `X.Y` the highest within that minor (the same definition as
+      # cross-compile.yml's "Publish release" un-draft). Re-publishing an older
+      # tag must not move either backwards.
+      #
+      # Decided HERE, after the slow build and push, from a fresh release list,
+      # and applied by re-tagging the image just pushed: deciding before the
+      # build would let a slow re-publish of an old tag overwrite `latest`
+      # after a newer release's job had already set it. The window that
+      # remains is the few seconds between this listing and the retag.
+      #
+      # On a `release` event the tag counts as published even if the listing
+      # lags behind the publish. Only plain vX.Y.Z tags count, so a release
+      # someone forgot to flag as a prerelease (v0.3.0-beta) cannot pin
+      # `latest`. Fails closed: if the list cannot be read or is empty, neither
+      # floating tag moves, and the step FAILS so notify-publish-failure says
+      # `latest` is stale (the versioned tags are already pushed). A tag that
+      # is simply not the highest is a warning, not a failure.
+      - name: Move the floating tags
+        id: floating
+        env:
+          RELEASE_TAG: ${{ steps.version.outputs.tag }}
+          MINOR: ${{ steps.version.outputs.minor }}
+          IS_STABLE: ${{ steps.version.outputs.is_stable }}
+          EVENT_NAME: ${{ github.event_name }}
+          IMAGE: ghcr.io/${{ github.repository }}
+          # Read-only: lists releases.
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          set -euo pipefail
+          moved_latest=false
+          moved_minor=false
+          finish() {
+            echo "moved_latest=${moved_latest}" >> "$GITHUB_OUTPUT"
+            echo "moved_minor=${moved_minor}" >> "$GITHUB_OUTPUT"
+            echo "moved latest: ${moved_latest}; moved ${MINOR}: ${moved_minor}"
+          }
+          if [ "$IS_STABLE" != true ]; then
+            echo "${RELEASE_TAG} is a 
```

**File**: `AGENTS.md` (modified, +10/-5)
```diff
@@ -290,11 +290,16 @@ cascade to fire automatically.
 (`FREENET_RELEASE_SIGNING_KEY` repo secret) and uploads `SHA256SUMS.txt.sig`.
 The auto-updater (`crates/core/src/bin/commands/update.rs`) verifies that
 signature against the public key baked into the binary (`FREENET_RELEASE_PUBKEY`)
-before trusting the checksum manifest. Rotating the key means updating BOTH the
-secret AND the baked-in `FREENET_RELEASE_PUBKEY` (a mismatch would make every
-client refuse the release). To verify the secret matches the baked-in key
-without cutting a release, run `cross-compile.yml` via `workflow_dispatch` and
-check the `verify-signing-key` job. The full prerequisites table (including the
+before trusting the checksum manifest. Rotating the key means updating the
+secret AND every copy of the public key: the baked-in `FREENET_RELEASE_PUBKEY`,
+`docker/freenet-node/release-signing-key.der`, and `RELEASE_PUBKEY_HEX` in
+`scripts/gateway-auto-update.sh` (which refuses to install a gateway update
+whose manifest does not verify). A mismatch makes every client, image build or
+gateway update refuse the release; tests in `update.rs` and
+`scripts/release-agent/gateway-auto-update_test.sh` fail if the copies drift.
+To verify the secret matches the baked-in key without cutting a release, run
+`cross-compile.yml` via `workflow_dispatch` and check the `verify-signing-key`
+job. The full prerequisites table (including the
 two-release `REQUIRE_RELEASE_SIGNATURE` transition) is in `docs/RELEASING.md`.
 
 ### Reserved offline revocation key (`FREENET_REVOCATION_PUBKEY`)
```

**File**: `docs/RELEASING.md` (modified, +14/-6)
```diff
@@ -106,7 +106,7 @@ published.
 | `MATRIX_ACCESS_TOKEN` | release-announce.yml | Matrix job warns + skips. |
 | `RELEASE_AGENT_HMAC_NOVA` | gateway-update.yml, release-announce.yml | nova update + River announce fail (HTTP 401). |
 | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | cross-compile.yml `build-x86_64-windows` (Authenticode signing) | **Does NOT degrade gracefully — this one fails the release.** See "Windows code signing" below. |
-| `FREENET_RELEASE_SIGNING_KEY` | cross-compile.yml (`Sign SHA256SUMS.txt`) | **Fails the release** in `attach-to-release`, while it is still a draft. It used to publish an UNSIGNED release with only a warning; clients accept one (`REQUIRE_RELEASE_SIGNATURE = false`) but verify nothing, and docker-publish.yml then fails after publication because it requires a verified signature. PEM-encoded ed25519 private key whose public half is baked into the updater (`update.rs` `FREENET_RELEASE_PUBKEY`). |
+| `FREENET_RELEASE_SIGNING_KEY` | cross-compile.yml (`Sign SHA256SUMS.txt`) | **Fails the release** in `attach-to-release`, while it is still a draft. It used to publish an UNSIGNED release with only a warning; clients accept one (`REQUIRE_RELEASE_SIGNATURE = false`) but verify nothing, and docker-publish.yml then fails after publication because it requires a verified signature. PEM-encoded ed25519 private key. Its public half has three copies that must all change on rotation: `update.rs` `FREENET_RELEASE_PUBKEY` (the node's updater), `docker/freenet-node/release-signing-key.der` (image builds), and `RELEASE_PUBKEY_HEX` in `scripts/gateway-auto-update.sh` (gateway rollouts, which refuse an unsigned or mis-signed release outright). Tests fail if they drift. |
 
 To validate `FREENET_RELEASE_SIGNING_KEY` without cutting a release, run the
 `Build and Cross-Compile` workflow via `workflow_dispatch`: its
@@ -1143,9 +1143,14 @@ Recovery:
    --since "10 min ago"'`
 2. If the agent is fine but the service is down, restart it directly:
    `ssh ian@<host> 'sudo systemctl restart freenet-gateway'` (then confirm
-   `systemctl is-active freenet-gateway`). If the script itself failed, the
-   manual fix is `ssh ian@<host> 'sudo /usr/local/bin/gateway-auto-update.sh
-   --force'`.
+   `systemctl is-active freenet-gateway`). If the script itself failed, check
+   `sudo grep -E 'Release verification|Refusing to downgrade' /var/log/freenet-auto-update.log`
+   first: a "Release verification FAILED" line means the download did not
+   match the release's signed `SHA256SUMS.txt` (or the signature or manifest
+   was missing), and the gateway deliberately stayed on its old binary. Gateway
+   rollouts require a signed release; do not work around this, find out why
+   the release's signature or checksums are wrong. Otherwise the manual fix is
+   `ssh ian@<host> 'sudo /usr/local/bin/gateway-auto-update.sh --force'`.
 3. Re-run the gateway-update workflow against just the failed gateway:
    `gh workflow run gateway-update.yml --field version=X.Y.Z --field
    gateways=nova`.
@@ -1228,8 +1233,11 @@ fix-forward release.
 
 For a serious regression that needs immediate rollback, the operator path
 is `ssh ian@<host> 'sudo gateway-auto-update.sh --force --target-version
-vX.Y.Z'` against the previous good version — the script accepts a downgrade
-when invoked directly, the agent doesn't.
+vX.Y.Z --allow-downgrade'` against the previous good version. The script
+refuses any downgrade without `--allow-downgrade` (even with `--force`, which
+only permits reinstalling the same version), and refuses that flag when sudo
+reports the caller as the release-agent account; the agent itself answers 403
+to a downgrade. The rolled-back release is still signature-checked.
 
 ## Skip mechanisms
 
```

**File**: `docs/release-agent-deployment.md` (modified, +29/-44)
```diff
@@ -79,7 +79,7 @@ cargo run -p riverctl message send <ROOM_VK> "<message>"
 
 This endpoint is **opt-in via config** (`river_announce_command` and
 `river_announce_user` in `config.toml`). Gateways without a local
-Freenet node + room signing key (e.g. vega) leave both fields blank;
+Freenet node + room signing key leave both fields blank;
 `POST /announce/river` returns 503 there.
 
 ## GitHub Actions secrets
@@ -98,16 +98,26 @@ the Matrix secrets are absent — useful while bootstrapping.
 
 ## Prerequisites per gateway
 
-1. **`gateway-auto-update.sh` installed at `/usr/local/bin/`** (or wherever
-   the existing release flow puts it), owned by root, perms ≤ 755.
-   `install.sh` aborts otherwise.
-2. **Caddy** (or another TLS terminator) already running and serving
+1. **`gateway-auto-update.sh` and `deploy-local-gateway.sh` installed at
+   `/usr/local/bin/`**, root:root 0755, in a directory only root can write
+   (the updater runs the deploy script from its own directory, as root).
+   `install.sh` installs both from the checkout it runs from and aborts if
+   `/usr/local/bin` is writable by anyone but root. **Nothing updates them
+   automatically**: after a change to either script merges, refresh both on
+   each gateway from an up-to-date `main` checkout, by re-running `install.sh`
+   (or `scripts/install-auto-update.sh`), or by hand:
+   `sudo install -m 0755 -o root -g root scripts/gateway-auto-update.sh
+   scripts/deploy-local-gateway.sh /usr/local/bin/`.
+2. **OpenSSL >= 3.0** (`openssl version`). `gateway-auto-update.sh` verifies
+   each release's signed `SHA256SUMS.txt` with `openssl pkeyutl -rawin`, and
+   refuses every update, before downloading, if OpenSSL is missing or older.
+3. **Caddy** (or another TLS terminator) already running and serving
    `*.locut.us`. Caddyfile snippet in
    [`scripts/release-agent/Caddyfile.snippet`](../scripts/release-agent/Caddyfile.snippet).
-3. **DNS A record** for `update.<host>.locut.us` pointing at the
+4. **DNS A record** for `update.<host>.locut.us` pointing at the
    gateway's public IP. Create this before `install.sh` runs so Caddy can
    acquire the cert.
-4. **Inbound TCP/443 reachable** from GitHub Actions runners. See [Firewall
+5. **Inbound TCP/443 reachable** from GitHub Actions runners. See [Firewall
    notes per host](#firewall-notes-per-host) below.
 
 ## Install procedure
@@ -194,42 +204,17 @@ narrowing the SG creates more breakage than it prevents.
 
 ### vega (AWS EC2) — RETIRED September 2026
 
-> Retired. Kept because it documents the only deployment where ghostkey-api
-> owned :80/:443 and forced the agent onto :8443 — useful precedent if another
-> host ever needs that shape. No longer a rollout target: out of the release
-> matrix, out of `release.sh`, and `RELEASE_AGENT_HMAC_VEGA` is unused.
-
-
-Vega differs from nova: `ghostkey-api` (gkapi.freenet.org) already owns
-:80 and :443 on this host, so the release-agent uses a **non-standard
-port and a per-host vhost**.
-
-- AWS Security Group `sg-0f4b9b9b5bf2a8cbb`: open inbound **TCP/8443**
-  from `0.0.0.0/0`. (No need to open :443; Caddy doesn't listen there
-  on vega.) Rely on HMAC for authentication; the agent's defense-in-
-  depth layers (clock-skew window, rate-limit, version-pin, GitHub-
-  latest cross-check) make a public endpoint safe.
-- Caddy config: install
-  [`scripts/release-agent/Caddyfile.vega.snippet`](../scripts/release-agent/Caddyfile.vega.snippet)
-  as `/etc/caddy/Caddyfile`. It uses `auto_https off` so Caddy doesn't
-  try to bind :80/:443, and an explicit `tls` directive pointing at
-  the dedicated `vega.locut.us` Let's Encrypt cert at
-  `/etc/letsencrypt/live/vega.locut.us/{fullchain,privkey}.pem`.
-- Cert permissions: the `caddy` system user must be in the `ssl-cert`
-  group; the cert files in `/etc/letsencrypt/archive/vega.locut.us/`
-  must be chgrp'd to `ssl-cert` with mode `0640` (privkey) / `0644`
-  (the rest). Install
-  [`scripts/release-agent/reload-caddy.sh`](../scripts/release-agent/reload-caddy.sh)
-  as `/etc/letsencrypt/renewal-hooks/deploy/reload-caddy.sh` (mode
-  0755) so certbot re-applies the group ownership and reloads Caddy
-  after each renewal.
-- Smoke test URL: `https://vega.locut.us:8443/release-agent/healthz`
-  (not `update.vega.locut.us`). The workflow's vega matrix entry
-  matches this.
-
-If you want a tighter SG, the alternative is a fronting Caddy on a
-known-IP host that the SG allows in, with the agent's port only
-reachable through it. Adds operational complexity; not recommended for
+Retired in #5540 and no longer a rollout target: out of the release matrix,
+out of `release.sh`, and `RELEASE_AGENT_HMAC_VEGA` is unused. Its
+deployment-specific files (a Caddyfile that served the agent on `:8443`
+because ghostkey-api owned `:80`/`:443`, and a certbot deploy hook that
+re-applied cert group ownership) were deleted with it. If another host ever
+needs that shape, recover them from git history (`git log --diff-
```

**File**: `scripts/deploy-local-gateway.sh` (modified, +1/-1)
```diff
@@ -538,7 +538,7 @@ verify_service() {
             # confirm the service is running the new binary. Return success to
             # preserve the existing manual-deploy behaviour on macOS, but make
             # the lack of verification explicit. The automated release-agent
-            # path is systemd-only (nova/vega), and gateway-auto-update.sh adds
+            # path is systemd-only (nova), and gateway-auto-update.sh adds
             # an independent is-active gate on top of this (#4492), so the
             # unverified launchd path is not on the automated update chain.
             echo "  ℹ️  Manual verification required for launchd"
```

**File**: `scripts/gateway-auto-update.sh` (modified, +313/-32)
```diff
@@ -10,12 +10,15 @@
 # - Safe update process using deploy-local-gateway.sh
 # - Manual trigger support with --force flag
 # - Dry-run mode for testing
+# - Refuses to install a download whose signed checksum does not verify
 #
 # Usage:
 #   ./gateway-auto-update.sh              # Check and update if newer version
 #   ./gateway-auto-update.sh --force      # Force update even if same version
 #   ./gateway-auto-update.sh --check      # Just check, don't update
 #   ./gateway-auto-update.sh --dry-run    # Show what would be done
+#   sudo ./gateway-auto-update.sh --force --target-version vX.Y.Z --allow-downgrade
+#                                         # Roll back to an older release (operator only)
 
 set -euo pipefail
 
@@ -24,16 +27,39 @@ SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 # Configuration
 INSTALL_PATH="${INSTALL_PATH:-/usr/local/bin/freenet}"
 GITHUB_REPO="${GITHUB_REPO:-freenet/freenet-core}"
-DOWNLOAD_DIR="${DOWNLOAD_DIR:-/tmp/freenet-update}"
+# Empty means "a fresh private directory from mktemp", created in main(). A
+# fixed path under /tmp would let any local user pre-create it and swap the
+# archive between verification and extraction, which would make the
+# signature check below worthless. sudo strips the environment, so the
+# release-agent's invocation always gets the private directory. An override
+# is honoured only if it is an existing directory, not a symlink, owned by the
+# user running this script and mode 0700 (see prepare_download_dir).
+DOWNLOAD_DIR="${DOWNLOAD_DIR:-}"
 LOG_FILE="${LOG_FILE:-/var/log/freenet-auto-update.log}"
+# Ed25519 public key that signs every release's SHA256SUMS.txt, as 64 hex
+# characters (the raw 32-byte key). The ONE copy in this script.
+#
+# It MUST equal FREENET_RELEASE_PUBKEY in crates/core/src/bin/commands/update.rs
+# (the key the node's own auto-updater trusts) and the key that
+# cross-compile.yml's "Sign SHA256SUMS.txt (ed25519)" step signs with (also
+# copied in docker/freenet-node/release-signing-key.der). Rotating the release
+# key means changing all of them; gateway-auto-update_test.sh fails if this
+# copy drifts from update.rs or the docker copy.
+#
+# Assigned unconditionally, never from the environment: a root script whose
+# trusted key could be supplied by an env var would accept any release an
+# attacker cared to sign. The test harness replaces it only after `source`-ing
+# this file into its own shell, which is not a path production can take.
+RELEASE_PUBKEY_HEX="eb2986604e34a3f985279a7e70852f3764d3347fe82074d92b1e4bc6336f8664"
+
 # systemd unit (without .service) this run deploys to AND independently
 # confirms is active afterwards. Used both as deploy-local-gateway.sh's
 # --service and by verify_service_active so the two always target the same
 # unit (#4492).
 #
 # Defaults to freenet-gateway (nova's unit, and the deploy-script default).
 #
-# A non-default instance (e.g. vega's freenet-gateway-hector) needs SERVICE_NAME
+# A non-default instance (e.g. a secondary freenet-gateway-foo) needs SERVICE_NAME
 # set, but the release-agent does NOT yet forward its `managed_service` config:
 # it spawns this script via `sudo --non-interactive <cmd> --force
 # --target-version vX.Y.Z` (updater.rs), and sudo strips the environment, so an
@@ -59,6 +85,15 @@ ALL_INSTANCES=false
 # actually installed, even if a newer release is published between the
 # agent's GitHub check and this script's own fetch.
 TARGET_VERSION=""
+# Installing a release OLDER than the one installed is refused unless the
+# operator passes --allow-downgrade. Argv only, never the environment. The
+# release-agent's sudoers entry ends in a `*` wildcard that can match extra
+# arguments, so the flag is also refused when sudo reports the caller as the
+# agent's account (SUDO_USER is set by sudo itself from the invoking user and
+# cannot be supplied by the caller). The agent never downgrades: it answers
+# 403 to a version below the installed one.
+ALLOW_DOWNGRADE=false
+RELEASE_AGENT_USER="freenet-update"
 
 # Colors (disabled if not a terminal)
 if [[ -t 1 ]]; then
@@ -115,13 +150,16 @@ Options:
                           a newer release lands between sign and install.
                           Must be strict semver; whitespace and shell metachars
                           rejected (paired with sudoers wildcard for the agent).
+  --allow-downgrade       Permit installing a release older than the installed
+                          one (a rollback). Operator use only: refused when
+                          invoked through sudo by the release-agent account.
   --verbose, -v           Show verbose output
   --help, -h              Show this help message
 
 Environment Variables:
   INSTALL_PATH      Path to installed freenet binary (default: /usr/local/bin/freenet)
   GITHUB_REPO       GitHub repository (default: freenet/freenet-core)
-  DOWNLOAD_DIR      Temporary download directory (default: /tmp/freenet-update)
+  DOWNLOAD_DIR      Tempor
```

**File**: `scripts/install-auto-update.sh` (modified, +20/-7)
```diff
@@ -28,7 +28,7 @@ fi
 # Check dependencies
 echo "Checking dependencies..."
 MISSING=()
-for cmd in curl jq unzip; do
+for cmd in curl jq tar unzip openssl; do
     if ! command -v "$cmd" &> /dev/null; then
         MISSING+=("$cmd")
     fi
@@ -38,6 +38,16 @@ if [[ ${#MISSING[@]} -gt 0 ]]; then
     echo -e "${YELLOW}Installing missing dependencies: ${MISSING[*]}${NC}"
     apt-get update && apt-get install -y "${MISSING[@]}"
 fi
+# gateway-auto-update.sh verifies each release's signed SHA256SUMS.txt with
+# `openssl pkeyutl -rawin` (OpenSSL >= 3.0) and refuses every update without it.
+if ! openssl version 2>/dev/null | grep -qE '^OpenSSL ([3-9]|[1-9][0-9])\.'; then
+    echo -e "${RED}Error: OpenSSL >= 3.0 is required (found: $(openssl version 2>/dev/null || echo none))${NC}"
+    exit 1
+fi
+if ! command -v sha256sum &> /dev/null; then
+    echo -e "${RED}Error: sha256sum (coreutils) is required${NC}"
+    exit 1
+fi
 echo -e "${GREEN}Dependencies OK${NC}"
 echo
 
@@ -47,13 +57,16 @@ cp "$SCRIPT_DIR/gateway-auto-update.sh" /usr/local/bin/gateway-auto-update.sh
 chmod 755 /usr/local/bin/gateway-auto-update.sh
 echo -e "${GREEN}Installed: /usr/local/bin/gateway-auto-update.sh${NC}"
 
-# Install the deploy script (if not already present)
-if [[ ! -f /usr/local/bin/deploy-local-gateway.sh ]]; then
-    echo "Installing deployment script..."
-    cp "$SCRIPT_DIR/deploy-local-gateway.sh" /usr/local/bin/deploy-local-gateway.sh
-    chmod 755 /usr/local/bin/deploy-local-gateway.sh
-    echo -e "${GREEN}Installed: /usr/local/bin/deploy-local-gateway.sh${NC}"
+# Install or refresh the deploy script. Always refreshed: gateway-auto-update.sh
+# runs it as root, and a stale copy that swallowed its own failure reported a
+# dead gateway as updated (#4492). A changed previous copy is kept as .prev.
+DEPLOY_SCRIPT=/usr/local/bin/deploy-local-gateway.sh
+if [[ -f "$DEPLOY_SCRIPT" ]] && ! cmp -s "$SCRIPT_DIR/deploy-local-gateway.sh" "$DEPLOY_SCRIPT"; then
+    cp -p "$DEPLOY_SCRIPT" "$DEPLOY_SCRIPT.prev"
+    echo -e "${YELLOW}Replacing a different deploy-local-gateway.sh (previous copy: $DEPLOY_SCRIPT.prev)${NC}"
 fi
+install -m 0755 -o root -g root "$SCRIPT_DIR/deploy-local-gateway.sh" "$DEPLOY_SCRIPT"
+echo -e "${GREEN}Installed: $DEPLOY_SCRIPT${NC}"
 
 # Install systemd units
 echo "Installing systemd units..."
```

#### Recent Merged Pull Requests:
- **PR #6374** (2026-11-24): fix: an older peer refusing us no longer shows "update required" (@sanity)
- **PR #6373** (2026-11-24): fix(release): verify gateway update downloads; keep docker latest monotonic (@sanity)
- **PR #6371** (2026-11-24): test: isolate three test families from process-global state under plain cargo test (@sanity)
- **PR #6370** (2026-11-24): ci: raise the Fmt job timeout from 5 to 10 minutes (@sanity)
- **PR #6369** (2026-11-24): fix(get): host and count GET replies only when accepted and matching the request (@sanity)
- **PR #6366** (2026-11-24): fix(transport): retry a native send whose stream did not open instead of dropping it (@sanity)

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

## X. an older peer refusing us no longer shows "update required"

**RULE**:
When implementing operations in `crates/core/src/node/network_status.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e9613f90`: an older peer refusing us no longer shows "update required". Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/node/network_status.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            // "Update required" is only true when the remote is NEWER. The
            // transport layer already sends an older peer's refusal as a
            // different error, so this is a second guard: the banner must
            // never tell the user to install a version older than their own.
            let remote_is_newer = match (
                semver::Version::parse(&local),
                semver::Version::parse(&gateway),
            ) {
                (Ok(l), Ok(g)) => g > l,
                _ => false,
            };
            if remote_is_newer {
                FailureReason::VersionMismatch { local, gateway }
            } else {
                FailureReason::Other(format!(
                    "peer runs an incompatible version {gateway} (this node runs {local})"
                ))
            }
    fn status_addr(last: u8) -> SocketAddr {
        SocketAddr::new(IpAddr::V4(Ipv4Addr::new(10, 9, 8, last)), 31337)
    }

    fn connect_peer(addr: SocketAddr) {
        record_peer_connected(addr, None, None);
    }

    /// Regression: an older peer refusing a node on the latest release was
    /// recorded as a version mismatch, so the dashboard said "update
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            FailureReason::VersionMismatch { local, gateway }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e9613f90` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
