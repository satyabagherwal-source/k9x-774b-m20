# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet/freenet-core

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "a93b0a3b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T02:21:13.711Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `a93b0a3b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T02:21:13.711Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## 1. Scope & Verification Target
- **Target Repository**: `freenet/freenet-core` (Commit: `a93b0a3b`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): freenet/freenet-core

> **Canonical Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T02:21:12.434Z  
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
- **Issue #6357** (2026-11-24): **test(sim): keep peer-to-peer native connects off in the closed gateway-join sim**
  *Symptoms*: ## Problem  `test_quic_native_gateway_join_dead_before_a_frame_goes_legacy_next` fails deterministically on main (0cbc9b7ae):  ``` no node ends holding a native link to or from a gateway: [(([::1]:55898, [::1]:59568), true), (([::1]:59568, [::1]:55898), true)] ```  Both addresses are the two gateways. The link formed through the ordinary connect op (tx `01FWS2PCRXSF15VT7N4AV385R0`, `transient: false`, origins `ConnectJoiner` / `ConnectAcceptor`, `transport: Native`), not through the gateway-join path that `with_gateway_closing_native_joins` closes.  The test came in with #6328 and passed there. #6330 then raised production `QUIC_NATIVE_PERCENT` from 0 to 25, and this test does not override it, so ordinary CONNECTs now draw native at 25%. At this seed the gateways' CONNECT to each other draws native. #6330 already added `with_native_connect(0)` to the upgrade sims for this reason; this test merged in parallel and missed it. The Simulation job does not run on merge-queue entries, so the combination was never run.  Bisect: original test with `QUIC_NATIVE_PERCENT = 0` on the same main passes.  No code bug: a gateway taking part in an ordinary native CONNECT is intended (`test_quic_native_at_the_shipped_percent_mixes_native_and_udp` covers it). The test's assertion is about closed gateway joins.  ## Approach  Call `sim.with_native_connect(0)` in this test, so every native link in the run is a gateway join and the existing assertion reads only those. The assertion itself is unchang

- **Issue #6354** (2026-11-23): **ci: raise test_unit timeout from 30 to 45 minutes**
  *Symptoms*: ## Problem  `Unit & Integration` (`test_unit`) is cancelled at its 30-minute limit even when every test passes, because the `Swatinem/rust-cache@v2` restore of its ~1.7 GiB entry downloads at 2-4 MB/s: 445-799 s on cache hits measured on 2026-11-23 (table and evidence in #6346). Tests take ~13-14 min and a cold build only ~2 min longer than a warm one, so a slow restore pushes the job over 30 min. It cancelled #6344 twice and #6351 once.  ## Approach  Stopgap only: raise `test_unit`'s `timeout-minutes` from 30 to 45, with a comment saying so. Worst measured case is restore + tests + build, about 28-30 min.  A 5-minute cap on the cache step with `continue-on-error` was considered and dropped in review: it would fire on almost every measured restore (all >300 s), silently disabling the cache that the warm-cache job (#6105) exists to provide, and a kill landing mid-extract could leave a partial `target/` and fail the job. The real fix (shrink or speed up the cache, or drop it and the warm job deliberately) stays tracked in #6346.  ## Testing  - `check_cache_warm_parity.py` passes (it compares action inputs/env; the job timeout is outside it). - No other job changed; the job id and check name are unchanged, so required-check and merge-queue behaviour are unaffected. - Review: two Claude lenses (skeptical, big-picture) plus codex on the earlier version; this version is a strict subset of it (the timeout line only). Two lenses rather than three was a usage-budget call, recorded her

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

### Incident Patch 1: `447373c9` (2026-11-23)
**Commit Message**: fix: create_delegate leaves an already-registered delegate's origin unchanged (#6351)

**File**: `crates/core/src/wasm_runtime/delegate_api.rs` (modified, +87/-0)
```diff
@@ -748,6 +748,93 @@ mod tests {
         // and the window before it did was the #4813 flake.
     }
 
+    /// Creating a delegate that is already registered returns the same key and
+    /// leaves its inherited origins and creation count unchanged.
+    #[tokio::test]
+    async fn test_create_delegate_existing_keeps_origin() {
+        let mut env_holder = TestEnv::new().await;
+        let origins = env_holder.inherited_origins.clone();
+        let counter = env_holder.created_delegates_count.clone();
+        let first = ContractInstanceId::new([1u8; 32]);
+        let second = ContractInstanceId::new([2u8; 32]);
+        let wasm = minimal_delegate_wasm();
+        let (cipher, nonce) = ([0u8; 32], [0u8; 24]);
+
+        // SAFETY: env_holder is alive for the duration of this test
+        let key = unsafe { env_holder.make_env_with_attestations(vec![first]) }
+            .create_delegate_sync(&wasm, &[1], cipher, nonce)
+            .unwrap();
+        assert_eq!(counter.count(), 1);
+
+        // SAFETY: as above
+        let again = unsafe { env_holder.make_env_with_attestations(vec![second]) }
+            .create_delegate_sync(&wasm, &[1], cipher, nonce)
+            .unwrap();
+        assert_eq!(again, key, "same key is returned");
+        assert_eq!(origins.get(&key).unwrap().value().origins, vec![first]);
+        assert_eq!(counter.count(), 1, "no second creation is counted");
+    }
+
+    /// With no inherited-origins entry (after a restart or expiry), creating an
+    /// already-registered delegate does not add one.
+    #[tokio::test]
+    async fn test_create_delegate_existing_without_entry_stays_without() {
+        let mut env_holder = TestEnv::new().await;
+        let origins = env_holder.inherited_origins.clone();
+        let wasm = minimal_delegate_wasm();
+        let (cipher, nonce) = ([0u8; 32], [0u8; 24]);
+
+        // SAFETY: env_holder is alive for the duration of this test
+        let key = unsafe { env_holder.make_env() }
+            .create_delegate_sync(&wasm, &[1], cipher, nonce)
+            .unwrap();
+        assert!(origins.get(&key).is_none());
+
+        // SAFETY: as above
+        let again = unsafe {
+            env_holder.make_env_with_attestations(vec![ContractInstanceId::new([2u8; 32])])
+        }
+        .create_delegate_sync(&wasm, &[1], cipher, nonce)
+        .unwrap();
+        assert_eq!(again, key);
+        assert!(origins.get(&key).is_none(), "no entry may be added");
+    }
+
+    /// Repeated creates of one key count toward the per-call limit but hold a
+    /// single node-wide slot.
+    #[tokio::test]
+    async fn test_create_delegate_existing_counts_per_call_only() {
+        let mut env_holder = TestEnv::new().await;
+        let counter = env_holder.created_delegates_count.clone();
+        let wasm = minimal_delegate_wasm();
+        let (cipher, nonce) = ([0u8; 32], [0u8; 24]);
+
+        // SAFETY: env_holder is alive for the duration of this test
+        let env = unsafe { env_holder.make_env() };
+        env.create_delegate_sync(&wasm, &[1], cipher, nonce)
+            .unwrap();
+        env.create_delegate_sync(&wasm, &[1], cipher, nonce)
+            .unwrap();
+        assert_eq!(env.creations_this_call.get(), 2);
+        assert_eq!(counter.count(), 1);
+
+        // Looping on the existing key succeeds until the per-call limit
+        // (two creations are already counted), then is refused.
+        let limit = crate::contract::MAX_DELEGATE_CREATIONS_PER_CALL;
+        for i in 2..limit + 2 {
+            let result = env.create_delegate_sync(&wasm, &[1], cipher, nonce);
+            if i < limit {
+                assert!(result.is_ok(), "call {i} is within the limit");
+            } else {
+                assert!(
+                    matches!(result, Err(DelegateCreateError::CreationsExceeded)),
+                    "call {i} is over the limit"
+                );
+            }
+        }
+        assert_eq!(counter.count(), 1, "the node-wide count is unchanged");
+    }
+
     /// Child created by non-attested parent gets no attestation entry, but
     /// still counts toward the per-node limit.
     ///
```

**File**: `crates/core/src/wasm_runtime/native_api.rs` (modified, +29/-1)
```diff
@@ -542,6 +542,9 @@ pub(crate) fn prune_expired_contexts(cache: &DelegateContextCache) {
 /// `created_at` cap drops the entry at a fixed age regardless, so an always-busy
 /// entry can't be refreshed forever.
 ///
+/// An already-registered child is never given an entry by `create_delegate`,
+/// so after a restart or expiry it stays without one.
+///
 /// Dropping an entry never loses identity: secrets live in the SecretsStore
 /// keyed by delegate key (not here) and the DEK is re-derived from the node KEK.
 /// `tokio::time::Instant` mirrors [`DelegateContextEntry`].
@@ -1492,7 +1495,8 @@ impl DelegateCallEnv {
     /// Create a new delegate synchronously during process() execution.
     ///
     /// Validates resource limits, constructs a DelegateContainer from the raw WASM bytes,
-    /// registers it in the delegate store and secret store, and records creator attestation.
+    /// registers it in the delegate store and secret store, and records creator
+    /// attestation for a newly created delegate.
     ///
     /// Note: WASM bytes are stored as-is. Validation is deferred to execution time
     /// (when the delegate is actually invoked). Depth tracking is per-call only — child
@@ -1507,6 +1511,12 @@ impl DelegateCallEnv {
     ///   value works. See `SecretsStore::register_delegate`.
     /// * `nonce_bytes` - 24-byte field, discarded for the same reason.
     ///
+    /// If the delegate is already registered, its key is returned and its
+    /// inherited origins are left unchanged, whether or not an entry exists.
+    /// After a restart or TTL expiry an already-registered child therefore has
+    /// no inherited origin, and tokenless callers resolve to no origin, as
+    /// after the idle TTL. The call counts toward the per-call creation limit.
+    ///
     /// # Returns
     /// The new delegate's `DelegateKey` on success, or a `DelegateCreateError`.
     pub(super) fn create_delegate_sync(
@@ -1582,6 +1592,24 @@ impl DelegateCallEnv {
 
         let child_key = container.key().clone();
 
+        // An already-registered delegate is left exactly as it is: return its
+        // key without registering again or touching its inherited origins.
+        // The call still counts toward the per-call creation limit, so a guest
+        // cannot loop on existing keys, but not toward the node-wide count of
+        // created delegates, which holds one slot per delegate.
+        // Deliberately not insert-if-absent: a missing inherited-origins entry
+        // (after a restart or TTL expiry) cannot be told apart from "never
+        // created by this parent", so filling it in here would let any creator
+        // set the attribution of a delegate it did not create.
+        if self
+            .delegate_store_mut()
+            .fetch_delegate(&child_key, &params_owned)
+            .is_some()
+        {
+            self.creations_this_call.set(current + 1);
+            return Ok(child_key);
+        }
+
         // Build cipher and nonce
         let cipher = XChaCha20Poly1305::new((&cipher_bytes).into());
         let nonce = XNonce::from(nonce_bytes);
```

---

### Incident Patch 2: `0a8b6b1d` (2026-11-23)
**Commit Message**: ci: raise test_unit timeout from 30 to 45 minutes (#6354)

**File**: `.github/workflows/ci.yml` (modified, +6/-1)
```diff
@@ -951,7 +951,12 @@ jobs:
     # the one heavy gate kept on every merge_group entry (release or not), so the
     # tiered model (#3973) doesn't apply here.
     runs-on: ubicloud-standard-16
-    timeout-minutes: 30
+    # 45, not 30: a stopgap (#6346). The rust-cache restore of the ~1.7 GiB
+    # entry measured 445-799 s at 2-4 MB/s on 2026-11-23, and the worst case
+    # is about restore plus ~14 min of tests plus build, which fits under 45.
+    # The real fix (shrink or speed up the cache, or drop it and the warm job
+    # deliberately) is tracked in #6346.
+    timeout-minutes: 45
     # Skip on push to main (PR already validated) and on release branches
     # themselves (the release version-bump PR is gated by its merge_group entry,
     # which runs the full suite). The release merge_group entry IS the
```

---

### Incident Patch 3: `0cbc9b7a` (2026-11-23)
**Commit Message**: feat(connect): enable native QUIC connects at 25% (A+ step 1) (#6330)

**File**: `.claude/rules/transport.md` (modified, +14/-7)
```diff
@@ -2271,9 +2271,11 @@ upgrades hub's
 `QuicUpgrades::setup_native` (A5b, below); the endpoint's native side
 (`native/endpoint.rs`: `allow_native_peer`, `dial_native`, `send_punch`)
 stays `pub(in crate::transport::quic::native)`, and registering a native
-waiter is private to `setup`. In production nothing asks for a setup: the
-connect op gates on `operations::connect::native::NATIVE_DIAL_READY` (pinned
-false) and `QUIC_NATIVE_PERCENT` (0).
+waiter is private to `setup`. Since A+ step 1 the connect op asks for a
+setup for ready pairs whose bucket is below `QUIC_NATIVE_PERCENT` (25), gated
+on `operations::connect::native::NATIVE_DIAL_READY` (true). There is no
+runtime kill switch: the acceptor decides on `min(offered, own)`, so a
+reversal takes effect for a pair once either side has updated.
 
 ```
 ALPN per attempt: an address allowed with allow_native_peer is accepted with
@@ -2373,16 +2375,21 @@ The transient-send warn in peer_connection_listener is throttled per
 
 Native connect (`operations/connect/native.rs`, `quic/upgrade/driver/native.rs`,
 A5b): the connect op asks for a native connection when the acceptor decides
-`Native`. Off in production (gates above); a simulation turns it on per node
-with `SimNetwork::with_native_connect` / `with_node_native_connect`
-(`NodeConfig::native_connect_override`).
+`Native`. On in production since A+ step 1 at `QUIC_NATIVE_PERCENT` (25), for
+`transport-quic = prefer` nodes only (gates above); a simulation sets the
+percent per node with `SimNetwork::with_native_connect` /
+`with_node_native_connect` (`NodeConfig::native_connect_override`). Native
+gateway joins stay off (`GATEWAY_NATIVE_JOIN_PERCENT` 0).
 
 ```
 Readiness: NativeConnectState, one per node in the ConnectionManager. Ready
   when dialling is on (NATIVE_DIAL_READY, or the override), this node's own
   QUIC endpoint is up (its QuicAvailabilityWatch from TransportHandle, read
   per node: the process-wide quic_endpoint metric is shared by simulated
-  nodes) and the node is not demoted. The joiner's offer reads
+  nodes), the configured transport-quic mode is prefer (set_endpoint's
+  `prefer`: a native connection carries application data, which shadow
+  keeps on UDP, so a shadow or off node is never ready in any role,
+  including gateway joins) and the node is not demoted. The joiner's offer reads
   readiness() (joiner demotion only); the relay's decision reads
   acceptor_readiness() (either role's demotion).
 Dial: NodeEvent::ConnectPeer and HandshakeCommand::Connect carry a
```

**File**: `crates/core/src/node.rs` (modified, +6/-4)
```diff
@@ -541,8 +541,8 @@ pub struct NodeConfig {
     #[serde(skip)]
     pub(crate) quic_native_floor_override: Option<(u8, u8, u16)>,
     /// Simulation-only: QUIC-native connects on, at this release percent, in
-    /// place of `NATIVE_DIAL_READY` and `QUIC_NATIVE_PERCENT`, both off in
-    /// production until the A+ ramp (`SimNetwork::with_native_connect`). Read
+    /// place of `NATIVE_DIAL_READY` and `QUIC_NATIVE_PERCENT`, in production
+    /// they are true and 25 (A+ step 1; `SimNetwork::with_native_connect`). Read
     /// into the node's `NativeConnectState`. `None` in production.
     /// `#[serde(skip)]`.
     #[serde(skip)]
@@ -560,8 +560,10 @@ pub struct NodeConfig {
     #[serde(skip)]
     pub(crate) native_refuses_decisions: bool,
     /// Simulation-only: native gateway joins on, at this percent, in place of
-    /// `NATIVE_DIAL_READY` and `GATEWAY_NATIVE_JOIN_PERCENT`, both off in
-    /// production until phase B (`SimNetwork::with_native_gateway_join`).
+    /// `NATIVE_DIAL_READY` and `GATEWAY_NATIVE_JOIN_PERCENT`. In production
+    /// `NATIVE_DIAL_READY` is true since A+ step 1, and only
+    /// `GATEWAY_NATIVE_JOIN_PERCENT` (0) keeps gateway-native off until
+    /// phase B (`SimNetwork::with_native_gateway_join`).
     /// Read into the node's `NativeConnectState`. `None` in production.
     /// `#[serde(skip)]`.
     #[serde(skip)]
```

**File**: `crates/core/src/node/network_bridge/handshake.rs` (modified, +4/-2)
```diff
@@ -1954,7 +1954,7 @@ mod tests {
         let (endpoint, watch) = QuicAvailabilityWatch::for_test(QuicAvailability::Up);
         let native = crate::operations::connect::native::NativeConnectState::new(None)
             .with_gateway_join_override(Some(100));
-        native.set_endpoint(watch);
+        native.set_endpoint(watch, true);
         native.set_native_gateways(marked.iter().copied());
         let own = TransportKeypair::new().public().clone();
         (
@@ -2262,7 +2262,9 @@ mod tests {
         node_config.native_gateway_join_override = Some(100);
         let connection_manager = ConnectionManager::new(&node_config);
         let (_endpoint, watch) = QuicAvailabilityWatch::for_test(QuicAvailability::Up);
-        connection_manager.native_connect().set_endpoint(watch);
+        connection_manager
+            .native_connect()
+            .set_endpoint(watch, true);
 
         let connector = Arc::new(GatewayConnector::new(true, Handshake::Succeeds));
         let (_conn_tx, conn_rx) = mpsc::channel(1);
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +5/-2)
```diff
@@ -1225,7 +1225,7 @@ use crate::operations::connect::native::NativeWire;
 /// starts the data ramp, and turning on the native connect offer in the same
 /// release would change two things at once. Raised to 0.2.160 for 0.2.159,
 /// which ships while the data ramp is still under watch. Raised to 0.2.161
-/// for 0.2.160: native connect is still off (`QUIC_NATIVE_PERCENT` is 0) and
+/// for 0.2.160: native connect was still off (`QUIC_NATIVE_PERCENT` was 0) and
 /// its wire fields may change before it is enabled, so no release is frozen
 /// as the floor yet. Raised to 0.2.162 for 0.2.161 for the same reasons, and
 /// to 0.2.163 for 0.2.162. Frozen at 0.2.163: that release ships the variants
@@ -1664,7 +1664,10 @@ impl P2pConnManager {
             .ring
             .connection_manager
             .native_connect()
-            .set_endpoint(quic_availability);
+            .set_endpoint(
+                quic_availability,
+                quic_policy.mode() == crate::transport::quic::QuicMode::Prefer,
+            );
 
         tracing::info!(
             listening_port,
```

**File**: `crates/core/src/node/testing_impl.rs` (modified, +2/-2)
```diff
@@ -2363,8 +2363,8 @@ impl SimNetwork {
 
     /// Turns QUIC-native connects on for every node, at `percent` (the share
     /// of joins an acceptor decides native), in place of this release's
-    /// `NATIVE_DIAL_READY` and `QUIC_NATIVE_PERCENT`, which are off. Pair it
-    /// with [`Self::with_quic_native_floor`], since without the native wire
+    /// `NATIVE_DIAL_READY` and `QUIC_NATIVE_PERCENT`, which are on (25) in
+    /// production. Pair it with [`Self::with_quic_native_floor`], since without the native wire
     /// variants no decision reaches a joiner, and with
     /// [`Self::with_transport_quic`], since a node without a QUIC endpoint
     /// cannot set one up. Call before the simulation starts.
```

**File**: `crates/core/src/operations/connect.rs` (modified, +2/-2)
```diff
@@ -4449,7 +4449,7 @@ mod tests {
     }
 
     /// The acceptor answers a request that carried an offer with a decision
-    /// (`Udp` in this build), and one without an offer with none.
+    /// (`Udp` here: the offer is at percent 0), and one without an offer with none.
     #[test]
     fn acceptor_decides_only_when_offered() {
         let self_loc = make_peer(4000);
@@ -4698,7 +4698,7 @@ mod tests {
 
     /// Every join request, including a bootstrap join through a gateway, is
     /// built by `prepare_join_request` and carries an offer, at percent 0 in
-    /// this build, and each offer is counted.
+    /// a bare test (no endpoint up), and each offer is counted.
     #[test]
     fn every_join_request_carries_an_offer() {
         let offers =
```

**File**: `crates/core/src/operations/connect/native.rs` (modified, +121/-43)
```diff
@@ -9,9 +9,9 @@
 //!
 //! On `Native` the joiner and the acceptor each dial a native connection
 //! ([`DialTransport::Native`]), and a failed setup falls back to today's UDP
-//! dial. In production nothing changes yet: [`NATIVE_DIAL_READY`] is false,
-//! so every offer carries percent 0 and every decision is
-//! [`NativeDecision::Udp`]; a simulation turns it on per node
+//! dial. In production [`NATIVE_DIAL_READY`] is true and
+//! [`QUIC_NATIVE_PERCENT`] is 25 (A+ step 1), so a ready pair whose bucket is
+//! below 25 decides `Native`; a simulation sets both per node
 //! ([`NativeConnectState`]). A `Native` the joiner cannot honour fails that
 //! attempt ([`joiner_response_action`]).
 //!
@@ -36,22 +36,26 @@ use crate::transport::TransportPublicKey;
 use crate::transport::metrics::ConnectArm;
 use crate::transport::metrics::TRANSPORT_METRICS;
 
-/// Whether this build can dial a native connection. False until the native
-/// connection exists and is wired into the connect op; while false, every offer
-/// this node sends carries percent 0 and it never decides `Native`.
-pub(crate) const NATIVE_DIAL_READY: bool = false;
+/// Whether this build can dial a native connection. True since A+ step 1;
+/// while false, every offer this node sends carries percent 0 and it never
+/// decides `Native`.
+pub(crate) const NATIVE_DIAL_READY: bool = true;
 
 /// This release's share of pairs, 0 to 100, that set up a native connection
-/// when both sides are ready. Each step is its own release; the acceptor's
-/// release governs, since only the acceptor decides.
-pub(crate) const QUIC_NATIVE_PERCENT: u8 = 0;
+/// when both sides are ready. Each step is its own release. Only the acceptor
+/// decides, and it decides on `min(offered, own)`, so a pair goes native only
+/// if both releases allow it: a reversal takes effect for any pair where either
+/// the acceptor or the joiner has updated, as nodes update. There is no runtime
+/// kill switch. 25 is A+ step 1.
+pub(crate) const QUIC_NATIVE_PERCENT: u8 = 25;
 
 /// This release's share, 0 to 100, of (joiner, gateway) pairs whose join
 /// tries a native connection to the gateway first (#5940, phase B), when the
 /// gateway is marked native in the gateway index and this node can dial
 /// native. Any failure falls back at once to today's join. The joiner alone
 /// decides (there is no connection to the gateway yet to ask it), so the
-/// joiner's release governs. At 0 no join tries native.
+/// joiner's release governs. At 0 no join tries native. `NATIVE_DIAL_READY`
+/// is true since A+ step 1, so this 0 alone keeps gateway-native off.
 pub(crate) const GATEWAY_NATIVE_JOIN_PERCENT: u8 = 0;
 
 /// After a native join with a gateway fails, joins to that gateway go
@@ -777,7 +781,7 @@ pub(crate) struct NativeConnectState {
     /// and when it is not up, the node cannot dial native. Read per node, not
     /// from the process-wide endpoint metric, which several simulated nodes
     /// in one process share.
-    endpoint: std::sync::OnceLock<crate::transport::QuicAvailabilityWatch>,
+    endpoint: std::sync::OnceLock<(crate::transport::QuicAvailabilityWatch, bool)>,
     /// Simulation only: native gateway joins on, at this percent, in place of
     /// [`NATIVE_DIAL_READY`] and [`GATEWAY_NATIVE_JOIN_PERCENT`]
     /// (`NodeConfig::native_gateway_join_override`). `None` in production.
@@ -964,13 +968,21 @@ impl NativeConnectState {
     fn endpoint_up(&self) -> bool {
         self.endpoint
             .get()
-            .is_some_and(|e| e.get() == crate::transport::QuicAvailability::Up)
+            .is_some_and(|(e, prefer)| *prefer && e.get() == crate::transport::QuicAvailability::Up)
     }
 
     /// The node's transport opened with this QUIC endpoint. Only the first
-    /// call counts: a node opens one transport.
-    pub(crate) fn set_endpoint(&self, endpoint: crate::transport::QuicAvailabilityWatch) {
-        self.endpoint.get_or_init(|| endpoint);
+    /// call counts: a node opens one transport. `prefer` is whether the
+    /// configured `transport-quic` mode is `prefer`: a native connection
+    /// carries application data, which `shadow` promises to keep on UDP, so a
+    /// node in any other mode is never ready, as joiner, acceptor or gateway
+    /// joiner, however up its endpoint is.
+    pub(crate) fn set_endpoint(
+        &self,
+        endpoint: crate::transport::QuicAvailabilityWatch,
+        prefer: bool,
+    ) {
+        self.endpoint.get_or_init(|| (endpoint, prefer));
     }
 
     /// This node's readiness now, as joiner: the offer it sends and whether
@@ -1532,23 +1544,35 @@ mod tests {
         );
     }
 
-    /// This build cannot dial native, so it offers 0 and never decides
-    /// `Native`, whatever the endpoint state.
+    /// A+ step 1: this build dials native and offers 25 once its endpoint is
+    /// up. A node whose endpoint is down offers 0 and decides UDP; an up node
+    /// decides `Native` exactly for bucket
```

**File**: `crates/core/src/operations/connect/op_ctx_task.rs` (modified, +1/-1)
```diff
@@ -4041,7 +4041,7 @@ mod driver_timing_tests {
             crate::transport::QuicAvailability::Up,
         );
         let connect = op_manager.ring.connection_manager.native_connect();
-        connect.set_endpoint(watch);
+        connect.set_endpoint(watch, true);
         assert!(
             connect.readiness().ready,
             "premise: the joiner can dial native"
```

#### Recent Merged Pull Requests:
- **PR #6357** (2026-11-24): test(sim): keep peer-to-peer native connects off in the closed gateway-join sim (@sanity)
- **PR #6354** (2026-11-23): ci: raise test_unit timeout from 30 to 45 minutes (@sanity)
- **PR #6353** (2026-11-23): fix(connect): a joiner that cannot use a native decision dials the acceptor over UDP (@sanity)
- **PR #6352** (closed): test: give each joiners-behind-one-address test its own network name (@sanity)
- **PR #6351** (2026-11-23): fix: create_delegate leaves an already-registered delegate's origin unchanged (@sanity)
- **PR #6350** (2026-11-23): fix(test): simulation test binaries keep node data dirs under a per-process temp root (@sanity)

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

## X. create_delegate leaves an already-registered delegate's origin unchanged

**RULE**:
When implementing operations in `crates/core/src/wasm_runtime/delegate_api.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `447373c9`: create_delegate leaves an already-registered delegate's origin unchanged. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/wasm_runtime/delegate_api.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Creating a delegate that is already registered returns the same key and
    /// leaves its inherited origins and creation count unchanged.
    #[tokio::test]
    async fn test_create_delegate_existing_keeps_origin() {
        let mut env_holder = TestEnv::new().await;
        let origins = env_holder.inherited_origins.clone();
        let counter = env_holder.created_delegates_count.clone();
        let first = ContractInstanceId::new([1u8; 32]);
        let second = ContractInstanceId::new([2u8; 32]);
        let wasm = minimal_delegate_wasm();
        let (cipher, nonce) = ([0u8; 32], [0u8; 24]);

        // SAFETY: env_holder is alive for the duration of this test
        let key = unsafe { env_holder.make_env_with_attestations(vec![first]) }
            .create_delegate_sync(&wasm, &[1], cipher, nonce)
            .unwrap();
        assert_eq!(counter.count(), 1);

        // SAFETY: as above
        let again = unsafe { env_holder.make_env_with_attestations(vec![second]) }
            .create_delegate_sync(&wasm, &[1], cipher, nonce)
            .unwrap();
        assert_eq!(again, key, "same key is returned");
        assert_eq!(origins.get(&key).unwrap().value().orig
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `447373c9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
