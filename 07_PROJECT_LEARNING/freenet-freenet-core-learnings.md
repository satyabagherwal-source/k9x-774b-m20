> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `98118f47`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:16:32.069Z  
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
> **Harvest Timestamp**: 2026-10-18T22:16:30.314Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3108 stars

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
    let sizes = [64, 256, 1024, 1364, MAX_PACKET_SIZE];

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

    let sizes = [64, 256, 1024, 1364];

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
/// - `fixedrate` or `fixed` - Use FixedRate (100 Mbps)
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
        create_mock_peer(PacketDropPolicy::ReceiveAll, channels.clone())
         
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
    1364, // Max single packet (after overhead)
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
- **Issue #5928** (2026-10-18): **docs: allow cleanup exemptions bounded by a lifecycle event**
  *Symptoms*: ## Problem  The cleanup rule in `AGENTS.md` and `.claude/rules/ring.md` said every exemption from garbage collection must expire by a TTL or an absolute age. Some state is correctly bounded by its owner's lifetime instead. Since #5920 the delegate app registry keeps a registration exactly as long as its connection, and its module doc had to describe itself as a departure from the rule.  ## Approach  The rule now says cleanup exemptions must be bounded, by time or by a lifecycle event such as connection close. For a lifecycle bound, every way the owner can end (clean close, error, dropped task) must trigger it. The existing ban on exemptions an entry can renew for itself stays. Connections that stay open without ever closing are not yet bounded at the connection level; that is #5922, and the rule says an entry bounded only by connection close inherits that gap.  Also updated: the registry's module doc, and two comments (`ring/broken_invariants.rs`, `ring/hosting.rs`) that cited the old section title. No code behaviour changes.  ## Testing  Documentation and comments only. `cargo fmt --all -- --check` is clean.  [AI-assisted - Claude]  https://claude.ai/code/session_012FMsogkyxn3DKhB1nVBWA1 
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/39141034931) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*

- **Issue #5927** (2026-10-18): **feat(telemetry): transport loss, RTT, disconnect-reason and NAT-failure telemetry**
  *Symptoms*: Observability-only groundwork for the transport redesign. Without it there's no baseline to measure a new transport against. **No changes to the wire protocol, retransmission, congestion control or timing.**  Field telemetry (about 2,200 peers on 0.2.146) showed that the data we need for a baseline is missing or broken: - there are no loss or retransmit counters at all - `final_srtt_ms` always reports 0 and `final_cwnd` reports `u32::MAX` - every disconnect is reported as "pruned" - hole-punch failures have no sub-reason, and there is no NAT-type signal  ## Changes  ### `transport_snapshot` All new fields are additive. - **Loss and ACK overhead:** `packets_sent`, `packets_retransmitted`, `packets_abandoned`, `rto_expiries`, `tlp_probes`, `standalone_ack_packets`, `standalone_ack_bytes`. These are relaxed atomics. - **Per-connection RTT distribution:** `conn_rtt_connections`, plus `conn_srtt_{p50,p90,max}_us` and `conn_min_rtt_{p50,p90,max}_us`. Each live connection contributes one value. SRTT comes from whichever source most recently produced a fresh sample: data ACKs or keep-alives. A retransmit-only ACK batch doesn't count as fresh. This value may be an unloaded keep-alive SRTT, so use the per-transfer `final_srtt_ms` vs `min_rtt_ms` for bufferbloat analysis. - **NAT failure sub-reasons (outbound traversals only):** `nat_fail_{no_response,undecryptable,version_incompatible,incomplete,send_error,other}`. They sum to `nat_traversal_failed_error + nat_traversal_failed_version`

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

### Incident Patch 1: `5814a8ab` (2026-10-16)
**Commit Message**: test: fix refresh-lock table test self-deadlock under cargo test (#5905)

**File**: `crates/core/src/server/path_handlers.rs` (modified, +100/-25)
```diff
@@ -4642,14 +4642,50 @@ mod tests {
     ///    request at once while nothing bounds the warm refreshes that follow.
     #[tokio::test]
     async fn refresh_lock_table_is_bounded_prunes_safely_and_overflows_per_contract() {
+        // Hang detector only, not a fix: a regression that locks in the fill
+        // below would self-deadlock, and this makes it fail loudly in-process.
+        tokio::time::timeout(
+            std::time::Duration::from_secs(10),
+            refresh_lock_table_scenario(),
+        )
+        .await
+        .expect(
+            "refresh-lock table scenario hung: the fill must not await a tokio \
+             mutex it already holds (overflow stripes are shared by id hash)",
+        );
+    }
+
+    async fn refresh_lock_table_scenario() {
+        // Simulate sibling tests of the same process that hold table entries
+        // (`refresh_cache_if_due` holds one for the length of a refresh). With
+        // more than REFRESH_LOCK_OVERFLOW_STRIPES of them, a fill that LOCKED
+        // every id would put two ids on one overflow stripe (pigeonhole) and
+        // deadlock deterministically. The fill below does not lock, so it
+        // cannot.
+        let siblings: Vec<_> = (0..(REFRESH_LOCK_OVERFLOW_STRIPES + 6))
+            .map(|i| {
+                let mut bytes = [0u8; 32];
+                bytes[0] = 0x41;
+                bytes[1..9].copy_from_slice(&(i as u64).to_be_bytes());
+                let id = ContractInstanceId::new(bytes);
+                (id, refresh_lock_for(&id))
+            })
+            .collect();
+        for (id, _) in &siblings {
+            assert!(
+                CONTRACT_REFRESH_LOCKS.contains_key(id),
+                "a simulated sibling must actually occupy a table entry"
+            );
+        }
         let mut bytes = [0u8; 32];
         bytes[0] = 0x3c;
         let held_id = ContractInstanceId::new(bytes);
-        let guard = acquire_refresh_lock(&held_id).await;
-        let held_lock = CONTRACT_REFRESH_LOCKS
-            .get(&held_id)
-            .map(|entry| entry.clone())
-            .expect("the held lock must be in the table");
+        // Held as an `Arc` clone, not a locked guard: see the fill loop below.
+        let held_lock = refresh_lock_for(&held_id);
+        assert!(
+            CONTRACT_REFRESH_LOCKS.contains_key(&held_id),
+            "the held lock must be in the table"
+        );
 
         let sprayed: Vec<_> = (0..(MAX_REFRESH_LOCKS + 64))
             .map(|i| {
@@ -4679,51 +4715,90 @@ mod tests {
              it — a replacement lets two refreshers for one contract run at once"
         );
 
-        // Now fill the table with locks that are HELD, so the prune can reclaim
-        // nothing and a newcomer has to take the overflow path.
+        // Now fill the table with locks that are HELD (an `Arc` clone keeps
+        // `strong_count > 1`, which is all the prune looks at), so the prune
+        // can reclaim nothing and a newcomer has to take the overflow path.
+        //
+        // The mutexes are deliberately NOT locked. Once sibling tests hold
+        // entries, some of this loop's ids would be handed an overflow stripe,
+        // and two of them can share one; awaiting a tokio mutex this task
+        // already holds is a self-deadlock production never reaches (one lock
+        // per task). Fill until a new id is refused admission (the prune
+        // has nothing left to reclaim) rather than for a fixed count, so
+        // leftover unheld entries and any number of held sibling entries only
+        // change how many ids fit, not whether the loop ends. The assertions
+        // after the loop use the id that was actually refused, so a real
+        // sibling freeing an entry afterwards cannot make them race.
         let mut held = Vec::with_capacity(MAX_REFRESH_LOCKS);
         let mut held_ids = Vec::with_capacity(MAX_REFRESH_LOCKS);
-        for i in 0..MAX_REFRESH_LOCKS {
+        let mut i = 0u64;
+        let (refused_id, refused_lock) = loop {
+            assert!(
+                i <= 2 * MAX_REFRESH_LOCKS as u64,
+                "the refresh-lock table never filled; is something removing entries?"
+            );
             let mut bytes = [0u8; 32];
             bytes[0] = 0x3f;
-            bytes[1..9].copy_from_slice(&(i as u64).to_be_bytes());
+            bytes[1..9].copy_from_slice(&i.to_be_bytes());
             let id = ContractInstanceId::new(bytes);
-            held.push(acquire_refresh_lock(&id).await);
+            i += 1;
+            let lock = refresh_lock_for(&id);
+            if !CONTRACT_REFRESH_LOCKS.contains_key(&id) {
+                // Not admitted: the prune found nothing left to reclaim, so
+                // the table is full of held entries (`lock` is an overflow
+                // stripe).
+                break (id, lock);
+            }
+            held.push(lock);
             held_ids.push(id);
-        }
-
-        l
```

---

### Incident Patch 2: `5c61998c` (2026-10-14)
**Commit Message**: build: remove stale Cargo.lock from workspace member test-contract-integration (#5890)

**File**: `tests/test-contract-integration/Cargo.lock` (removed, +0/-1058)
```diff
@@ -1,1058 +0,0 @@
-# This file is automatically @generated by Cargo.
-# It is not intended for manual editing.
-version = 4
-
-[[package]]
-name = "aho-corasick"
-version = "1.1.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8e60d3430d3a69478ad0993f19238d2df97c507009a52b3c10addcd7f6bcb916"
-dependencies = [
- "memchr",
-]
-
-[[package]]
-name = "android-tzdata"
-version = "0.1.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e999941b234f3131b00bc13c22d06e8c5ff726d1b6318ac7eb276997bbb4fef0"
-
-[[package]]
-name = "android_system_properties"
-version = "0.1.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
-dependencies = [
- "libc",
-]
-
-[[package]]
-name = "arrayref"
-version = "0.3.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6b4930d2cb77ce62f89ee5d5289b4ac049559b1c45539271f5ed4fdc7db34545"
-
-[[package]]
-name = "arrayvec"
-version = "0.7.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "96d30a06541fbafbc7f82ed10c06164cfbd2c401138f6addd8404629c4b16711"
-
-[[package]]
-name = "autocfg"
-version = "1.2.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1fdabc7756949593fe60f30ec81974b613357de856987752631dea1e3394c80"
-
-[[package]]
-name = "base64"
-version = "0.21.7"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9d297deb1925b89f2ccc13d7635fa0714f12c87adce1c75356b39ca9b7178567"
-
-[[package]]
-name = "bincode"
-version = "1.3.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b1f45e9417d87227c7a56d22e471c6206462cba514c7590c09aff4cf6d1ddcad"
-dependencies = [
- "serde",
-]
-
-[[package]]
-name = "bitflags"
-version = "1.3.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
-
-[[package]]
-name = "blake3"
-version = "1.5.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "30cca6d3674597c30ddf2c587bf8d9d65c9a84d2326d941cc79c9842dfe0ef52"
-dependencies = [
- "arrayref",
- "arrayvec",
- "cc",
- "cfg-if",
- "constant_time_eq",
- "digest",
-]
-
-[[package]]
-name = "block-buffer"
-version = "0.10.4"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
-dependencies = [
- "generic-array",
-]
-
-[[package]]
-name = "bs58"
-version = "0.5.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "bf88ba1141d185c399bee5288d850d63b8369520c1eafc32a0430b5b6c287bf4"
-dependencies = [
- "tinyvec",
-]
-
-[[package]]
-name = "bumpalo"
-version = "3.16.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "79296716171880943b8470b5f8d03aa55eb2e645a4874bdbb28adb49162e012c"
-
-[[package]]
-name = "byteorder"
-version = "1.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1fd0f2584146f6f2ef48085050886acf353beff7305ebd1ae69500e27c67f64b"
-
-[[package]]
-name = "cc"
-version = "1.0.94"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "17f6e324229dc011159fcc089755d1e2e216a90d43a7dea6853ca740b84f35e7"
-
-[[package]]
-name = "cfg-if"
-version = "1.0.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "baf1de4339761588bc0619e3cbc0120ee582ebb74b53b4efbf79117bd2da40fd"
-
-[[package]]
-name = "chrono"
-version = "0.4.38"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a21f936df1771bf62b77f047b726c4625ff2e8aa607c01ec06e5a05bd8463401"
-dependencies = [
- "android-tzdata",
- "iana-time-zone",
- "num-traits",
- "serde",
- "windows-targets",
-]
-
-[[package]]
-name = "constant_time_eq"
-version = "0.3.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f7144d30dcf0fafbce74250a3963025d8d52177934239851c917d29f1df280c2"
-
-[[package]]
-name = "core-foundation-sys"
-version = "0.8.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "06ea2b9bc92be3c2baa9334a323ebca2d6f074ff852cd1d7b11064035cd3868f"
-
-[[package]]
-name = "crypto-common"
-version = "0.1.6"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "1bfb12502f3fc46cca1bb51ac28df9d618d813cdc3d2f25b9fe775a34af26bb3"
-dependencies = [
- "generic-array",
- "typenum",
-]
-
-[[package]]
-name = "darling"
-version = "0.20.8"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "54e36fcd13ed84ffdfda6f5be89b31287cbb80c439841fe69e04841435464391"
-dependencies = [
- "darling_core",
- "darling_macro",
-]
-
-[[package]]
-name = "darling_core"
-version = "0.20.8"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9c2cf1c23a687a1feeb728783b993c4e1ad83d99f351801
```

---

### Incident Patch 3: `83ea83b3` (2026-10-17)
**Commit Message**: fix(conformance): report associativity only for groupings that do not converge (#5924)

**File**: `crates/core/src/conformance.rs` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@
 //! to repair a state that cannot converge. #5153 measured deployed contracts doing
 //! exactly that.
 //!
+//! One law is checked in a weaker form than the RFC #5320 table states it.
+//! Associativity is reported only when `merge(merge(A, B), C)` and
+//! `merge(A, merge(B, C))` differ and do not heal: converge in one exchange, then
+//! settle at a fixpoint when both groupings and all three inputs are merged back in
+//! (#5915). No contract with bounded retention can satisfy the strict form. See
+//! [`ConformanceProperty::StateAssociativity`].
+//!
 //! This module is the *single* implementation of what "conformance" means. The
 //! offline `fdev verify-merge` harness and the node's opt-in shadow-mode checker both call
 //! [`verify_case`], so the developer-facing answer and the network-facing answer
```

**File**: `crates/core/src/conformance/property.rs` (modified, +82/-4)
```diff
@@ -16,7 +16,72 @@ pub enum ConformanceProperty {
     StateIdempotence,
     /// `merge(A, B) == merge(B, A)`
     StateCommutativity,
-    /// `merge(merge(A, B), C) == merge(A, merge(B, C))`
+    /// `merge(merge(A, B), C) == merge(A, merge(B, C))`, or the two groupings heal:
+    /// they converge in one exchange to a state that, re-merged with both groupings
+    /// and all three inputs, settles at a fixpoint.
+    ///
+    /// # What is checked (#5915)
+    ///
+    /// With `L = merge(merge(A, B), C)` and `R = merge(A, merge(B, C))`, `L == R`
+    /// holds outright. Otherwise:
+    ///
+    /// 1. `L` and `R` must be valid, or it is a violation: from valid inputs the
+    ///    contract emitted a state it rejects.
+    /// 2. `merge(R, L)` must equal `M = merge(L, R)`, or it is a violation: one
+    ///    exchange does not even agree.
+    /// 3. `M` is iterated by merging in `L`, `R`, `A`, `B` and `C` until a full pass
+    ///    changes nothing. A fixpoint heals. Each step that moves the iterate must
+    ///    also absorb a re-delivery of the same input, or it is a violation. A state
+    ///    that repeats is a cycle and a violation. Running out of `MAX_HEAL_PASSES`
+    ///    passes with none of these is [`Inconclusive::RoundLimit`].
+    ///
+    /// A heal-step merge the contract itself rejects is a violation: both sides are
+    /// valid states it emitted, so it is refusing to reconcile its own output
+    /// (#5725). A runtime or resource failure there stays inconclusive (#5509), which
+    /// leaves a residual: a contract that traps on a heal-step merge escapes this
+    /// law, as it escapes every other law in this module.
+    ///
+    /// # Why strict associativity is not the law
+    ///
+    /// Any contract with bounded retention fails it, and cannot help failing it.
+    /// A grouping that truncated an old entry to make room cannot refill the slot
+    /// when a later removal (a ban) or a raised cap frees it, while the other
+    /// grouping still holds the entry. Measured on River's room contract
+    /// (freenet/river#793): 956 of 3200 generated triples fail strictly, about 30%,
+    /// and every one converges on the next exchange. Enforcing the strict form would
+    /// make every capped chat, feed or log removable, and a participant able to
+    /// trigger a removal could build a failing triple on purpose. Ian's decision,
+    /// 2026-10-16: heal-guarded, not diagnostic-only, severity unchanged; 2026-10-17:
+    /// healing means converge AND stable.
+    ///
+    /// # Why the heal step is a fixpoint and not something cheaper
+    ///
+    /// - **Convergence alone** silenced every commutative merge, because
+    ///   `merge(L, R) == merge(R, L)` by definition there; integer averaging got
+    ///   through.
+    /// - **`M` absorbing `L` and `R`** silenced every pick-one merge, because `M` is
+    ///   then `L` or `R`. One whose winner relation is cyclic (wrapping sequence
+    ///   numbers, rock-paper-scissors) never converges and escaped every enforceable
+    ///   law that way: a probe saw 1916 strict failures and reported none.
+    /// - **Cycle detection alone** misses a merge that keeps moving without ever
+    ///   repeating inside the budget: on any domain wider than a byte, averaging and
+    ///   "max + 1" climbing came back inconclusive. So each step that moves the
+    ///   iterate re-delivers the same input and requires
+    ///   `merge(merge(M, X), X) == merge(M, X)`, which any join satisfies and those
+    ///   merges fail at any width. A failure is a violation.
+    /// - **`M` absorbing all five without iterating** is too strict: a raised cap can
+    ///   re-admit a truncated message, so a bounded log may need one more merge.
+    ///
+    /// # Measured
+    ///
+    /// On small, exhaustively enumerated state spaces (these numbers do not
+    /// generalize past them): the bounded-log fixture's 80 states heal on every one
+    /// of 36,252 strictly failing triples, within 2 passes, and so does its
+    /// keep-oldest variant (21,980). The fixture shapes this law reported before
+    /// #5915 are reported again: averaging (0..=20), the partially-ordered cap and
+    /// `NEVER_SETTLES` on every strict failure, `CAPPED_SET` on 23,812 of 26,034
+    /// (6-element universe; the rest settle). Averaging and climbing are reported at
+    /// 32 and 64 bits too, by the re-delivery check rather than by enumeration.
     StateAssociativity,
     /// Every state emitted by `update_state` is itself valid.
     EmittedStateValidity,
@@ -343,6 +408,17 @@ pub enum ConformanceProperty {
     /// nothing it had not already lost. Either way there is no contract that this
     /// property alone condemns while the settled algebra would have acquitted it.
     ///
+    /// **What changed with #5915.** `StateAssociativity` no longer means strict
+    /// associativity: it accepts groupings that heal (converge, then settle at a
+    /// fixpoint
```

**File**: `crates/core/src/conformance/tests.rs` (modified, +520/-0)
```diff
@@ -415,6 +415,526 @@ fn associativity_only_defect_needs_the_triple_check() {
     );
 }
 
+// ------------------------------------- associativity heals or it is reported (#5915)
+
+/// Bytes below this are messages; the retained log is the largest ones.
+const LOG_BAN: u8 = 100;
+/// Bytes at or above this raise the cap to `byte - LOG_CAP`; the largest wins.
+const LOG_CAP: u8 = 200;
+/// How many messages are kept when no state has raised the cap.
+const LOG_DEFAULT_CAP: usize = 2;
+
+/// A bounded-retention log: the shape of a capped chat, feed or audit log.
+///
+/// One byte per entry, in three disjoint ranges so a sorted state is canonical:
+///
+/// - `0..LOG_BAN` — a message. Only the newest (largest) `cap` survive.
+/// - `LOG_BAN..LOG_CAP` — a ban on message `byte - LOG_BAN`, which removes it.
+/// - `LOG_CAP..` — a cap of `byte - LOG_CAP` messages. The largest cap wins.
+///
+/// The merge is a function of the union of its inputs, so it is commutative, and it
+/// is idempotent on its own output. It is NOT strictly associative, and cannot be:
+/// a message truncated away to make room is gone from that grouping, so when a
+/// later removal or a raised cap frees the slot, one grouping refills it and the
+/// other has nothing to refill it with (#5915). Both groupings still converge on the
+/// next exchange, which is why `StateAssociativity` must not report them.
+fn bounded_log(a: &[u8], b: &[u8]) -> Vec<u8> {
+    bounded_log_keeping(a, b, false)
+}
+
+/// [`bounded_log`], or with `keep_oldest` the variant that truncates the NEWEST
+/// messages instead: a log that keeps its first `cap` entries.
+fn bounded_log_keeping(a: &[u8], b: &[u8], keep_oldest: bool) -> Vec<u8> {
+    let all = union(a, b);
+    let banned: Vec<u8> = all
+        .iter()
+        .filter(|x| (LOG_BAN..LOG_CAP).contains(*x))
+        .map(|x| x - LOG_BAN)
+        .collect();
+    let cap_marker = all.iter().copied().filter(|x| *x >= LOG_CAP).max();
+    let cap = cap_marker.map_or(LOG_DEFAULT_CAP, |m| (m - LOG_CAP) as usize);
+    let mut messages: Vec<u8> = all
+        .iter()
+        .copied()
+        .filter(|x| *x < LOG_BAN && !banned.contains(x))
+        .collect();
+    while messages.len() > cap {
+        if keep_oldest {
+            messages.pop();
+        } else {
+            messages.remove(0);
+        }
+    }
+    messages.extend(
+        all.iter()
+            .copied()
+            .filter(|x| (LOG_BAN..LOG_CAP).contains(x)),
+    );
+    messages.extend(cap_marker);
+    messages
+}
+
+fn bounded_log_contract() -> Fake {
+    Fake::conforming()
+        .merging(|a, b| Ok(bounded_log(a, b)))
+        .applying(|a, b| Ok(bounded_log(a, b)))
+        .validating(|state| {
+            if bounded_log(state, &[]) == state {
+                Ok(ValidateResult::Valid)
+            } else {
+                Ok(ValidateResult::Invalid)
+            }
+        })
+}
+
+/// A bounded-retention triple that fails STRICT associativity but heals on one more
+/// exchange is not reported. Both minimal shapes from #5915 are covered: a removal
+/// arriving after truncation, and a cap raised after truncation with no removal.
+///
+/// Each triple's strict failure is asserted directly first, or a passing verdict
+/// would prove nothing: the test would hold just as well against a contract that
+/// happened to be associative on these inputs.
+#[test]
+fn a_bounded_retention_triple_that_heals_is_not_reported() {
+    let removal: [&[u8]; 3] = [&[1, 2], &[3], &[LOG_BAN + 3]];
+    let raised_cap: [&[u8]; 3] = [&[1, 2], &[3], &[LOG_CAP + 3]];
+
+    for (shape, [a, b, c]) in [
+        ("removal after truncation", removal),
+        ("cap raised", raised_cap),
+    ] {
+        let left = bounded_log(&bounded_log(a, b), c);
+        let right = bounded_log(a, &bounded_log(b, c));
+        assert_ne!(
+            left, right,
+            "{shape}: the triple must fail strict associativity, or this tests nothing"
+        );
+        let m = bounded_log(&left, &right);
+        assert_eq!(
+            m,
+            bounded_log(&right, &left),
+            "{shape}: the two groupings must converge on one more exchange, or this \
+             is not the healing shape #5915 describes"
+        );
+        assert_eq!(
+            (bounded_log(&m, &left), bounded_log(&m, &right)),
+            (m.clone(), m.clone()),
+            "{shape}: the converged state must absorb both groupings"
+        );
+
+        // The pairwise laws hold, so the triple is the only place this could fire.
+        let mut fake = bounded_log_contract();
+        assert_holds(verify_case(
+            &mut fake,
+            &case(ConformanceProperty::StateCommutativity, &[a, c]),
+        ));
+        assert_holds(verify_case(
+            &mut fake,
+            &case(ConformanceProperty::StateIdempotence, &[a]),
+        ));
+
+        assert_holds(verify_case(
+            &mut bounded_log_contract(),
+            &case(ConformanceProp
```

**File**: `crates/core/src/conformance/verifier.rs` (modified, +219/-11)
```diff
@@ -44,6 +44,18 @@ pub const DETERMINISM_REPEATS: usize = 3;
 /// rewrites a non-canonical stored state once and then stabilizes.
 pub const MAX_CANONICALIZATION_APPLIES: usize = 3;
 
+/// How many full passes over `(L, R, A, B, C)` the associativity heal step may take
+/// before it gives up, as [`Inconclusive::RoundLimit`].
+///
+/// Measured, not guessed: over the bounded-retention fixture's whole 80-state space
+/// (512,000 triples, 36,252 failing strict associativity), every healing triple
+/// reaches its fixpoint within 2 passes, and only 16 need the second (a raised cap
+/// re-admitting a truncated message). 4 doubles that. Too small a bound can only
+/// cost coverage, never accuse anyone, because running out is inconclusive; too
+/// large a bound costs work, and only on a triple that has already failed the
+/// strict check: at most `2 + 10 * MAX_HEAL_PASSES` extra merges.
+pub const MAX_HEAL_PASSES: usize = 4;
+
 /// One property plus the exact inputs to check it with.
 ///
 /// Cases are the unit of work everywhere: the generator produces them, the verifier
@@ -457,12 +469,72 @@ fn run<O: ConformanceOracle + ?Sized>(
             require_valid(oracle, &bc, &case.related)?;
             let ab_c = merge(oracle, &ab, c)?;
             let a_bc = merge(oracle, a, &bc)?;
-            Ok(compare(
-                case.property,
-                &ab_c,
-                &a_bc,
-                "merge(merge(A, B), C) must equal merge(A, merge(B, C))",
-            ))
+            if ab_c == a_bc {
+                return Ok(PropertyOutcome::Holds);
+            }
+
+            // The two groupings differ. That alone is not reported (#5915): no
+            // contract with bounded retention can satisfy strict associativity. A
+            // grouping that truncated an old entry to make room cannot refill the slot
+            // when a later removal (a ban) or a raised cap frees it, while the other
+            // grouping still holds the entry. Measured on River's room contract: ~30%
+            // of generated triples fail strictly and every one converges on the next
+            // exchange. Reporting them would make every capped chat, feed or log
+            // removable, and anyone able to trigger a removal could build a failing
+            // triple on purpose. So it is reported only if it does not HEAL, in the
+            // sense `associativity_heals` defines.
+            //
+            // A grouping the contract rejects is reported outright. Both inputs and
+            // both intermediates are valid, so this is the contract emitting a state
+            // it rejects from valid inputs: the network drops it, and the peer that
+            // computed it can never agree with the one that computed the other. That
+            // was a violation before #5915 and stays one.
+            for grouping in [&ab_c, &a_bc] {
+                match oracle
+                    .validate_state(grouping, &case.related)
+                    .map_err(inconclusive_from)?
+                {
+                    ValidateResult::Valid => {}
+                    ValidateResult::RequestRelated(_) => return Err(Inconclusive::RelatedRequired),
+                    ValidateResult::Invalid => {
+                        return Ok(compare(
+                            case.property,
+                            &ab_c,
+                            &a_bc,
+                            "merge(merge(A, B), C) differs from merge(A, merge(B, C)), and \
+                             the contract rejects one grouping as invalid: from valid \
+                             inputs it emitted a state it will not accept",
+                        ));
+                    }
+                }
+            }
+
+            let detail = match associativity_heals(oracle, &ab_c, &a_bc, [a, b, c])? {
+                Heal::Healed => return Ok(PropertyOutcome::Holds),
+                Heal::OutOfPasses => return Err(Inconclusive::RoundLimit),
+                Heal::NotConverged => "merge(merge(A, B), C) differs from merge(A, merge(B, C)), \
+                     and merging each grouping into the other does not reach one state, so \
+                     two peers that received the same updates grouped differently still \
+                     disagree after reconciling"
+                    .to_string(),
+                Heal::Redelivery => "merge(merge(A, B), C) differs from merge(A, merge(B, C)), \
+                     and the groupings never settle: while reconciling them, merging the \
+                     same state in a second time moved the result again, so under \
+                     at-least-once delivery the state keeps moving and peers never agree"
+                    .to_string(),
+                Heal::Cycle => "merge(merge(A, B), C) differs from merge(A, merge(B, C)), and \
+                     the groupings never settle: re-merging them and the three inputs into \
+                     the state they converge 
```

**File**: `crates/fdev/src/config.rs` (modified, +4/-2)
```diff
@@ -76,8 +76,10 @@ pub enum SubCommand {
         command: crate::website::WebsiteCommand,
     },
     /// Check that a contract's merge obeys the laws the network requires: that
-    /// merging is order-independent, groups the same way whichever pairing is used,
-    /// and applying the same change twice does nothing the second time.
+    /// merging is order-independent, that merges grouped differently converge in one
+    /// exchange and then settle on a state that re-merging the groupings and their
+    /// inputs no longer changes, and that applying the same change twice does nothing
+    /// the second time.
     ///
     /// A contract that breaks these usually cannot converge — two peers given the same
     /// updates in different orders end up with different state, never agree, and
```

**File**: `tests/test-contract-conformance/src/lib.rs` (modified, +11/-6)
```diff
@@ -25,10 +25,12 @@
 //!                                by something other than the merge's own ordering.
 //!                                Commutative and idempotent, so no PAIRWISE state
 //!                                law sees it and only a three-state case reveals
-//!                                it. The transition law sees it too, from the same
-//!                                information loss, and that is asserted rather than
-//!                                left implicit — but associativity is the law that
-//!                                names it, and the pairwise ones stay silent.
+//!                                it, on triples that do not converge to an
+//!                                absorbing fixpoint (#5915; most strict failures,
+//!                                not all). The transition law sees it too, from the
+//!                                same information loss, and that is asserted rather
+//!                                than left implicit — but associativity is the law
+//!                                that names it, and the pairwise ones stay silent.
 //!   6 NEVER_SETTLES            — merge rewrites the state on every apply, so
 //!                                merge(A, A) never reaches a fixpoint. Idempotence
 //!                                and associativity break; commutativity still HOLDS
@@ -220,7 +222,9 @@ fn merge_state(m: u8, current: &[u8], incoming: &[u8]) -> Vec<u8> {
         //
         // This is the "cap the collection at N" rule real applications write, and
         // it is why associativity needs a three-state check of its own rather
-        // than being assumed to follow from the pairwise laws.
+        // than being assumed to follow from the pairwise laws. Since #5915 that
+        // check reports it on triples that do not converge to an absorbing
+        // fixpoint, which is most of its strict failures but not all.
         //
         // The eviction has to pick its victim from the whole set, not from the
         // ordering the merge is defined over. Keeping the largest N would be
@@ -233,7 +237,8 @@ fn merge_state(m: u8, current: &[u8], incoming: &[u8]) -> Vec<u8> {
         //
         // The pairwise laws still hold: the result depends only on the union, so
         // it is commutative, and a state already at or under the cap merged with
-        // itself is unchanged, so it is idempotent. Only the triple reveals it.
+        // itself is unchanged, so it is idempotent. Only a triple reveals it, one
+        // whose groupings do not converge to an absorbing fixpoint.
         CAPPED_SET => capped(current, incoming),
         // First write wins on a key collision — `entry(key).or_insert(value)`.
         //
```

#### Recent Merged Pull Requests:
- **PR #5928** (2026-10-18): docs: allow cleanup exemptions bounded by a lifecycle event (@sanity)
- **PR #5927** (2026-10-18): feat(telemetry): transport loss, RTT, disconnect-reason and NAT-failure telemetry (@sanity)
- **PR #5924** (2026-10-17): fix(conformance): report associativity only for groupings that do not converge (@sanity)
- **PR #5921** (2026-10-17): test: choose the delegate E2E probe node from the ring layout (@sanity)
- **PR #5920** (2026-10-17): fix(delegates): keep live app registrations past the push TTL (@sanity)
- **PR #5918** (2026-10-17): fix(delegates): require delegate run params to match the delegate key (@sanity)

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

## X. test: fix refresh-lock table test self-deadlock under cargo test (#5905)

**RULE**:
When implementing operations in `crates/core/src/server/path_handlers.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5814a8ab`: test: fix refresh-lock table test self-deadlock under cargo test (#5905). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/server/path_handlers.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // Hang detector only, not a fix: a regression that locks in the fill
        // below would self-deadlock, and this makes it fail loudly in-process.
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            refresh_lock_table_scenario(),
        )
        .await
        .expect(
            "refresh-lock table scenario hung: the fill must not await a tokio \
             mutex it already holds (overflow stripes are shared by id hash)",
        );
    }

    async fn refresh_lock_table_scenario() {
        // Simulate sibling tests of the same process that hold table entries
        // (`refresh_cache_if_due` holds one for the length of a refresh). With
        // more than REFRESH_LOCK_OVERFLOW_STRIPES of them, a fill that LOCKED
        // every id would put two ids on one overflow stripe (pigeonhole) and
        // deadlock deterministically. The fill below does not lock, so it
        // cannot.
        let siblings: Vec<_> = (0..(REFRESH_LOCK_OVERFLOW_STRIPES + 6))
            .map(|i| {
                let mut bytes = [0u8; 32];
                bytes[0] = 0x41;
                bytes[1..9].copy_from_slice(&(i as u64).to_be_bytes());
    
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        let guard = acquire_refresh_lock(&held_id).await;
        let held_lock = CONTRACT_REFRESH_LOCKS
            .get(&held_id)
            .map(|entry| entry.clone())
            .expect("the held lock must be in the table");
        // Now fill the table with locks that are HELD, so the prune can reclaim
        // nothing and a newcomer has to take the overflow path.
        for i in 0..MAX_REFRESH_LOCKS {
            bytes[1..9].copy_from_slice(&(i as u64).to_be_bytes());
            held.push(acquire_refresh_lock(&id).await);
        }

        l
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5814a8ab` are properly handled with clean fallback behavior.
