# Forensic Learning Record (Deep Inspection): freenet/freenet-core

> **Canonical Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:37.734Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3100 stars

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

### Core Architecture Module: `crates/core/benches/transport/slow_start.rs`
```
//! Slow Start Validation - Benchmarks to measure cold-start throughput
//!
//! **VirtualTime Mode:**
//! All benchmarks use VirtualTime for instant execution of high-RTT scenarios.
//! A 100ms RTT simulation completes in ~1ms wall time while accurately
//! measuring virtual throughput.
//!
//! Expected runtime: ~1-2 minutes (vs 30+ minutes with real-time delays)
//!
//! **Note:** Uses multi-threaded runtime to allow packet delivery (via real async
//! channels) to proceed concurrently with VirtualTime operations.

use criterion::{Criterion, Throughput};
use dashmap::DashMap;
use freenet::simulation::{TimeSource, VirtualTime};
use freenet::transport::PeerConnection;
use freenet::transport::congestion_control::CongestionControlConfig;
use freenet::transport::mock_transport::{
    Channels, MockSocket, PacketDelayPolicy, PacketDropPolicy,
    create_mock_peer_with_congestion_config,
};
use std::hint::black_box as std_black_box;
use std::sync::Arc;
use std::time::Duration;

use super::common::{
    create_connected_peers_with_configurable_congestion, get_congestion_config,
    print_congestion_config, spawn_auto_advance_task,
};

/// Benchmark fresh connection cold-start throughput with VirtualTime
///
/// Uses VirtualTime for instant execution - 100ms RTT completes in ~1ms wall time.
/// Measures the actual slow start benefit by tracking virtual time elapsed.
///
/// Congestion control algorithm is configurable via `FREENET_CONGESTION_ALGO` env var.
/// Defaults to BBR.
pub fn bench_cold_start_throughput(c: &mut Criterion) {
    // Print which congestion control algorithm is being used
    print_congestion_config();
    let congestion_config = Some(get_congestion_config());

    // Use multi-threaded runtime to allow packet delivery to proceed concurrently
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("slow_start/cold_start");
    group.sample_size(10);

    // Use 16KB - standard size for cold start measurement
    let transfer_size = 16 * 1024;
    group.throughput(Throughput::Bytes(transfer_size as u64));

    let config_clone = congestion_config.clone();
    group.bench_function("16kb_transfer", |b| {
        let config = config_clone.clone();
        b.to_async(&rt).iter_custom(|iters| {
            let config = config.clone();
            async move {
                let mut total_virtual_time = Duration::ZERO;

                for _ in 0..iters {
                    // Create fresh VirtualTime for each iteration to avoid time accumulation
                    let ts = VirtualTime::new();

                    // Spawn auto-advance task BEFORE connection
                    let auto_advance = spawn_auto_advance_task(ts.clone());

                    let channels: Channels = Arc::new(DashMap::new());
                    let message: Vec<u8> = vec![0xABu8; transfer_size];

                    // Create peers with VirtualTime and configurable congestion control
                    let (peer_a_pub, mut peer_a, peer_a_addr) =
                        match create_mock_peer_with_congestion_config(
                            PacketDropPolicy::ReceiveAll,
                            PacketDelayPolicy::NoDelay,
                            channels.clone(),
                            ts.clone(),
                            config.clone(),
                        )
                        .await
                        {
                            Ok(p) => p,
                            Err(e) => {
                                eprintln!("cold_start peer_a creation failed: {:?}", e);
                                continue;
                            }
                        };

                    let (peer_b_pub, mut peer_b, peer_b_addr) =
                        match create_mock_peer_with_congestion_config(
                            PacketDropPolicy::ReceiveAll,
                            PacketDelayPolicy::NoDelay,
                            channels.clone(),
                            ts.clone(),
                            config.clone(),
                        )
                        .await
                        {
                            Ok(p) => p,
                            Err(e) => {
                                eprintln!("cold_start peer_b creation failed: {:?}", e);
                                continue;
                            }
                        };

                    let start_virtual = ts.now_nanos();

                    // Connect both peers concurrently
                    let (conn_a_future, conn_b_future) = futures::join!(
                        peer_a.connect(peer_b_pub, peer_b_addr),
                        peer_b.connect(peer_a_pub, peer_a_addr),
                    );

                    let (conn_a, conn_b) = futures::join!(conn_a_future, conn_b_future);

                    let (mut conn_a, mut conn_b) = match (conn_a, conn_b) {
                        (Ok(a), Ok(b)) => (a, b),
                        (Err(e), _) => {
                            eprintln!("cold_start receiver connect failed: {:?}", e);
                            continue;
                        }
                        (_, Err(e)) => {
                            eprintln!("cold_start sender connect failed: {:?}", e);
                            continue;
                        }
                    };

                    // IMPORTANT: PeerConnection requires bidirectional recv() polling for
                    // congestion control to work - the sender needs to process incoming ACKs.
                    // We use tokio::select! with biased to run recv on both sides concurrently.
                    // See comment in outbound_stream.rs about cwnd waiting.

                    // Start the send (returns immediately, spawns outbound_stream task)
                    let send_result = conn_b.send(message).await;
                    let sent_ok = send_result.is_ok();

                    // Now run both recv() calls concurrently until receiver gets the message
                    // The sender's recv() processes ACKs to unblock the outbound_stream task
                    let received_len = if sent_ok {
                        let mut recv_result = None;
                        loop {
                            tokio::select! {
                                biased;
                                // Receiver side - wait for the actual data
                                result = conn_a.recv(), if recv_result.is_none() => {
                                    recv_result = Some(result);
                                }
                                // Sender side - process ACKs to unblock cwnd
                                _ = conn_b.recv() => {
                                    // ACK processed, continue loop
                                }
                            }
                            if recv_result.is_some() {
                                break;
                            }
                        }
                        match recv_result.unwrap() {
                            Ok(received) => {
                                std_black_box(&received);
                                received.len()
                            }
                            Err(e) => {
                                eprintln!("cold_start recv failed: {:?}", e);
                                0
                            }
                        }
                    } else {
                        0
                    };

                    drop(conn_a);
                    drop(conn_b);
                    drop(peer_a);
                    drop(peer_b);

                    let end_virtual = ts.now_nanos();
                    total_virtual_time +=
                        Duration::from_nanos(end_virtual.saturating_sub(start_virtual));

                    if !sent_ok || received_len == 0 {
                        eprintln!(
                            "cold_start failed: sent={}, received={}",
                            sent_ok, received_len
                        );
                    }

                    auto_advance.abort();
                    drop(channels);
                }

                total_virtual_time
            }
        });
    });
    group.finish();
}

/// Benchmark warm connection throughput with VirtualTime
///
/// Creates fresh connections, performs warmup transfers, then measures.
/// Uses VirtualTime for instant execution.
///
/// Congestion control algorithm is configurable via `FREENET_CONGESTION_ALGO` env var.
/// Defaults to BBR.
pub fn bench_warm_connection_throughput(c: &mut Criterion) {
    // Get configurable congestion control
    let congestion_config = Some(get_congestion_config());

    // Use multi-threaded runtime to allow packet delivery to proceed concurrently
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("slow_start/warm_connection");
    group.sample_size(10);

    let transfer_size = 16 * 1024;
    group.throughput(Throughput::Bytes(transfer_size as u64));

    let config_clone = congestion_config.clone();
    group.bench_function("16kb_warm", |b| {
        let config = config_clone.clone();
        b.to_async(&rt).iter_custom(|iters| {
            let config = config.clone();
            async move {
                let mut total_virtual_time = Duration::ZERO;

                for _ in 0..iters {
                    // Create fresh VirtualTime for each iteration
                    let ts = VirtualTime::new();
                    let auto_advance = spawn_auto_advance_task(ts.clone());

                    let channels: Channels = Arc::new(DashMap::new());

                    // Create peers with VirtualTime and configurable congestion control
   
```

### Core Architecture Module: `crates/core/benches/transport/streaming.rs`
```
//! Transport Streaming Benchmarks with VirtualTime - Large message transfers
//!
//! These benchmarks test stream fragmentation, reassembly, and rate limiting
//! for messages larger than a single packet (>1364 bytes).
//!
//! Uses VirtualTime for instant execution of network operations.
//! Expected runtime: ~30 seconds (vs ~5-10 minutes with real time)

use criterion::{BenchmarkId, Criterion, Throughput};
use dashmap::DashMap;
use freenet::simulation::{TimeSource, VirtualTime};
use freenet::transport::mock_transport::Channels;
use std::hint::black_box as std_black_box;
use std::sync::Arc;
use std::time::Duration;

use super::common::{STREAM_SIZES, create_peer_pair_with_virtual_time, spawn_auto_advance_task};

/// Benchmark large message streaming with VirtualTime (multi-packet transfers)
///
/// This measures the stream fragmentation and reassembly pipeline with
/// instant virtual time execution.
pub fn bench_stream_throughput(c: &mut Criterion) {
    // Use multi-threaded runtime to allow packet delivery to proceed concurrently
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("transport/streaming/throughput");
    group.sample_size(10);

    // Test STREAM_SIZES: 4KB, 16KB, 64KB
    for &size in STREAM_SIZES {
        group.throughput(Throughput::Bytes(size as u64));

        group.bench_with_input(BenchmarkId::new("stream", size), &size, |b, &sz| {
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
                        let message = vec![0xABu8; sz];
                        let start_virtual = ts.now_nanos();

                        // Send large message (will be fragmented)
                        if let Err(e) = peers.conn_a.send(message).await {
                            eprintln!("streaming send failed: {:?}", e);
                            continue;
                        }

                        let received: Vec<u8> = match peers.conn_b.recv().await {
                            Ok(r) => r,
                            Err(e) => {
                                eprintln!("streaming recv failed: {:?}", e);
                                continue;
                            }
                        };

                        let end_virtual = ts.now_nanos();
                        total_virtual_time +=
                            Duration::from_nanos(end_virtual.saturating_sub(start_virtual));

                        std_black_box(received);
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

/// Benchmark multiple concurrent streams with VirtualTime
///
/// This measures fairness and aggregate throughput when multiple streams
/// compete for bandwidth.
pub fn bench_concurrent_streams(c: &mut Criterion) {
    // Use multi-threaded runtime to allow packet delivery to proceed concurrently
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .unwrap();

    let mut group = c.benchmark_group("transport/streaming/concurrent");
    group.sample_size(10);

    // Test 2, 5, 10 concurrent streams
    for num_streams in [2, 5, 10] {
        group.bench_with_input(
            BenchmarkId::new("streams", num_streams),
            &num_streams,
            |b, &n| {
                b.to_async(&rt).iter_custom(|iters| {
                    async move {
                        // Create FRESH VirtualTime for each iter_custom call
                        let ts = VirtualTime::new();

                        // Spawn auto-advance task BEFORE connection - handshake has
                        // VirtualTime-dependent timeouts that require time to advance
                        let auto_advance = spawn_auto_advance_task(ts.clone());

                        let channels: Channels = Arc::new(DashMap::new());
                        let mut peers = create_peer_pair_with_virtual_time(
                            channels,
                            Duration::ZERO,
                            ts.clone(),
                        )
                        .await
                        .connect()
                        .await;

                        let mut total_virtual_time = Duration::ZERO;

                        for _ in 0..iters {
                            let message = vec![0xABu8; 16384]; // 16KB each
                            let start_virtual = ts.now_nanos();

                            // Send all messages sequentially
                            for _ in 0..n {
                                if let Err(e) = peers.conn_a.send(message.clone()).await {
                                    eprintln!("concurrent send failed: {:?}", e);
                                    break;
                                }
                            }

                            // Receive all messages
                            let mut results = Vec::new();
                            for i in 0..n {
                                match peers.conn_b.recv().await {
                                    Ok(received) => results.push((i, received.len())),
                                    Err(e) => {
                                        eprintln!("concurrent recv failed: {:?}", e);
                                        break;
                                    }
                                }
                            }

                            let end_virtual = ts.now_nanos();
                            total_virtual_time +=
                                Duration::from_nanos(end_virtual.saturating_sub(start_virtual));

                            std_black_box(results);
                        }

                        // Stop the auto-advance task
                        auto_advance.abort();

                        total_virtual_time
                    }
                });
            },
        );
    }

    group.finish();
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5810** (2026-10-05): **build: release 0.2.142**
  *Symptoms*: **Automated release PR**  - freenet: → **0.2.142** - fdev: → **0.3.304**  This PR will auto-merge once GitHub CI passes. Generated by: `.github/workflows/release.yml`

- **Issue #5807** (2026-10-05): **test(sim): read final node state in the turmoil convergence check**
  *Symptoms*: ## Problem  `test_anti_starvation_exercised` failed on 5 of 40 seeds of its exact config on `main`. #5803's sweeps saw 2/20 on main and 1/20 on its branch, and it is blocking #5803's Simulation CI. Every failure was one contract "diverged" on one peer.  The problem is in the convergence check, not the network. `check_convergence_from_logs` reads each peer's **last logged** stored-state hash. A peer that originates a client PUT or UPDATE commits the new state locally and fans it out, but logs no hash for its own commit: - its `PutSuccess` carries `state_hash: None` - a client-local UPDATE emits no `UpdateSuccess`  In all 5 failing seeds, the outlier peer was the originator of the last write to that contract. The 7 peers that applied its fan-out logged the new hash; the originator still showed the hash from before its own write. Its next fan-out skipped all 6 targets because their summaries matched its own, so it held the same state as everyone else. More settle time does not help, because the gap is in what gets logged, not in timing.  ## Solution  Test harness only; no new product log event.  - `SimNetwork::run_simulation` registers each node's `MockStateStorage` in a `FinalStateHandle`, keyed by the node's address (the same address its log entries carry). `sim.final_state_handle()` exposes it. - `check_convergence_from_logs_and_state` takes each peer's hash from its store at the end of the run.   - **The peer set is unchanged:** a peer is checked iff it logged a stored-state
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37285441541) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > Disposition of the Light-review consider items, by the orchestrator: 1. **Silent fallback to log-only when unregistered.** Not changing it. The fallback is exactly the pre-PR behaviour, so it can't hide any divergence the old check caught, and only `run_simulation` callers rely on the store path. Worth a doc note in a later cleanup. 2. **About 30 lines duplicated between the two convergence checks.** Cosmetic. Deferred, so the test-infra diff stays small before the release. 3. **No unit test for the evicted-peer fallback.** The fallback is the old log-only path, which existing tests already exercise.  CI is green at e48f5759 (15 pass, 3 skipped). Enqueuing.  [AI-assisted - Claude]

- **Issue #5805** (2026-10-05): **test(sim): remove RNG-trajectory dependence from four sim tests**
  *Symptoms*: ## Problem  Four simulation tests passed on `main` only because of the exact `GlobalRng` sequence. Adding one `GlobalRng::random_u64()` at the top of `PeerConnection::noop` (no behaviour change) made three of them fail every time (#5172), and #5803, which legitimately changes transport packet counts, trips them in CI. Two were already on #5172's flaky list.  To measure, I added a throwaway env knob that performs N extra draws per noop (not committed) and ran each test across N = 0..29.  ## Root causes (all test-side; no product bug found)  **`test_subscription_count_tracks_demand_not_cache`: harness artifact, not a hosting bug.** The hosting clock is frozen between `AdvanceHostingClock` jumps, so the 20-minute jump lands instantly mid-flight. When a renewal cycle fires in the few virtual seconds before the jump, the just-GET'd cache contracts are rightly eligible (§3, accessed seconds ago). Those renewals complete after the jump, and the hub and its upstream stamp the lease against the post-jump clock, so the lease is fresh at the snapshot. Every renewal cycle after the jump selects only the two demand contracts. No real operation spans 20 minutes (`OPERATION_TTL` is 60s). Fix: jump, settle 66s of virtual time (22 no-op advances × 3s, > `OPERATION_TTL`), then jump again past a full lease. The assertion is unchanged: zero cache-only leases anywhere.  **`test_5147_originator_target_list_cuts_duplicate_deliveries`: the premise held by luck.** The sender exclusion is gated on the
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37278639645) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > Light re-check of the follow-up round at 5e8eaca8f, read by the orchestrator, who did not write this code. Both should-fix items are addressed: - **Discriminator E.** It is now documented as a sim-noise limit, with measured sizes: 136 B full state against 144 B delta, so bytes can't carry the production signal here. A byte-level treatment-below-control check was added, and an E-targeted mutation (dropping the `sender_summary_bytes` piggyback) turns E red. - **Comments.** Stale figures are replaced, and HTL 3 is documented as load-bearing, along with the coverage it gives up.  The non-test delta is `GlobalTestMetrics::record_{delta,full_state}_send` taking a payload size and adding it to thread-local counters, which is negligible. No findings. Enqueuing.  [AI-assisted - Claude]

- **Issue #5803** (2026-10-05): **perf(transport): end the ack-of-ack NoOp ping-pong and keep recv() timers across cancellation**
  *Symptoms*: ## Problem  A 20 s capture on try.freenet.org (v0.2.141, 104 peers) saw 2,256 pps, 61% of them 49-byte packets. 52 connections carried **no data at all** yet each traded a steady ~5.2 pps of 49-byte packets in each direction. A CPU profile put `PeerConnection::noop` at ~6.3% of node CPU, timer machinery in the recv path at up to ~10.5%, and span enter/exit at ~1.5%.  Three causes:  - **A. Ack-of-ack ping-pong.** Every ack-only `NoOp` went through `packet_sending`, so it was registered in the `SentPacketTracker` and had to be acked. The remote acked it with another tracked `NoOp`, which we then had to ack, and so on. Once any tracked packet crossed a connection, the two ends traded NoOps forever at the ack-timer cadence (period ≈ 2 × (ack wait + one-way delay), which matches the measured 5.2 pps). - **B. Timer churn and three timer bugs.** `peer_connection_listener` cancels `recv()` whenever an outbound message wins its select, and calls it again after every returned message. Each `recv()` call rebuilt three `TimeSourceInterval`s and the resend sleep, and `TimeSourceInterval::tick` boxed a new sleep on every poll. That also caused:   - `timeout_check`'s first tick was immediate, so the 5 s idle check (with the `pending_pings` write lock) and the streaming-handle sweep ran on **every** `recv()` call;   - the 100 ms ack timer restarted on every call, so if `recv()` was re-entered more often than every 100 ms it **never fired**;   - the resend check was re-armed 10 ms out on ever
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37317828503) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > ## CI: the Simulation job fails on 3 tests. They are seed-fragile, and the same failures reproduce on `main` with no change in behaviour  Failing: `test_5147_originator_target_list_cuts_duplicate_deliveries`, `test_subscription_count_tracks_demand_not_cache`, `test_terminal_advertisement_consult_closes_subscribe_dead_end` (CI, nextest TRY 3, and locally).  How I narrowed it down (each run is `cargo test -p freenet --features "simulation_tests,testing" --test simulation_integration <name> -- --exact`):  | source | result | |---|---| | base `9ed68f9f4` | all 3 pass | | base + **one extra `GlobalRng::random_u64()` in `noop()`**, no other change | **all 3 fail, with the same assertions** | | this PR | all 3 fail | | this PR with tracked noops restored / old receipt policy / old duplicate fall-through (each bisected separately) | still fail |  So these tests pass only on the RNG trajectory that `main` happens to produce. Any change to how many packets the transport sends (which shifts `dete
  > **Addendum: the HEAD moved during the review.** The review above covers `18237da6c`. The PR is now at `e1904f127` ("mark untracked ack-only NoOps as shipping in 0.2.142"), so I did a light re-check of that commit.  It changes only the marker, its doc comment, the guard test and RELEASING.md. There is no transport logic change, so none of the findings above are affected. The new plausibility assert (`shipped <= next`) partly covers my floor-guard point.  Two consequences: - **Pre-setting `Some((0,2,142))` before merge removes the only automatic tripwire.** If this PR misses the 0.2.142 tag, nothing will flag it (the doc comment says so). Whoever cuts 0.2.142 must confirm this PR is in it. Otherwise peers on 0.2.142 would stop acking NoOps that the peers actually running 0.2.142 still track. - **Should-fix 4 now bites at the release itself.** When the bump to 0.2.142 lands, every simulation peer reaches the floor at once. The whole sim suite then switches to the no-NoOp-ack path for the 

- **Issue #5802** (2026-10-05): **perf(contracts): share the summary/delta caches across the RuntimePool**
  *Symptoms*: ## Problem  Production evidence (try.freenet.org, v0.2.141, ~6,200 hosted contracts, ~100 peers; 4-hour soak with entry uprobes on WASM entry points):  - `summarize_state` = 70,057 WASM calls, 74% of WASM CPU (WASM ≈ 4–10% of node CPU). - 57,935 of 64,572 repeat summaries had **no `update_state` in between**; every such gap was ≥ 240 s (eviction between 300 s interest heartbeats). 29.5k calls hit contracts with zero updates during the soak; some contracts cost 85–175 ms per summarize. - Summarize demand rose 4–5× over the soak (tracks interest traffic, not state changes). router_snapshot hit rate ~85–88%, but misses scale with demand.  Cause: every pool executor had its own `summary_cache` / `delta_cache`, bounded by a per-executor byte budget (`SUMMARY_CACHE_MAX_BYTES` = 32 MiB). The sizing comments assumed ~512 B summaries, but a River room summary is ~16.7 KB, so only ~1,900 fit. The contract loop is serialized and `pop_executor` always takes the first free slot, so in practice only executor 0's cache filled. The memory envelope still reserved `pool_size ×` the budget, and the other workers' share sat empty.  ## Design  Two commits:  1. **Metrics first** (`perf(contracts): export summary/delta cache occupancy`). `ByteBoundedLruCache` can publish into `ByteLruGauges`: entries, counted bytes, byte budget, and lifetime evictions (count-cap or byte-budget pops; a same-key replace or an oversized refusal does not count). The gauges sum over every live cache attached to them, an
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37267876489) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > Light re-check of the fix round at 310844a81, read by the orchestrator, who did not write this code.  The review findings are addressed: - **Per-entry cap.** `with_max_entry_bytes` is clamped to the budget. The pool caches cap entries at one executor's budget, and a single executor keeps cap = budget, unchanged. A refused entry is simply not cached, and the summary is still returned. - **Warm-detector cross-executor test.** It goes red with the fast-path hash check removed. - **Eviction metrics.** They are split into count-cap and byte-budget evictions, with a `count_cap` gauge kept in sync on `resize`. - **Memory wording.** Softened.  No findings. RSS is gated by the release soak, which compares RSS against the new cache gauges. Enqueuing.  [AI-assisted - Claude]

- **Issue #5801** (2026-10-05): **perf(wasm): wake on WASM job completion instead of polling every 10 ms**
  *Symptoms*: ## Problem  `execute_wasm_blocking` (`crates/core/src/wasm_runtime/engine/wasmtime_engine.rs`), the single wait behind every contract and delegate guest call (`call_typed_blocking`), ran the guest with `spawn_blocking` and then looped:  ```rust loop {     if task_handle.is_finished() { return block_in_place(|| handle.block_on(task_handle)) ... }     // classify wall-clock timeout ...     std::thread::sleep(Duration::from_millis(10)); } ```  The first `is_finished()` check ran immediately after the spawn, so in practice **every WASM call slept a full 10 ms** on top of its own CPU time. An upsert (validate + update) paid at least 20 ms. The sleep also ran on the tokio worker itself, outside `block_in_place`, so it took the core out of service without telling the runtime.  Evidence: DWARF stacks from the production peer try.freenet.org (v0.2.141) show this `thread::sleep` directly under async frames (`maybe_defer_upsert`, `execute_delegate_request`). Median WASM CPU per call there is ~1-4 ms, so the sleep is most of the latency. The no-runtime/current_thread arm had its own copy of the same 10 ms `try_recv` + sleep loop.  ## Approach  The job now sends its result over a capacity-1 `std::sync::mpsc::sync_channel`. The caller waits with `recv_timeout` until whichever wall-clock bound applies at that moment, so it wakes as soon as the job finishes. On the multi-thread runtime, **one `block_in_place` covers the whole wait**, so the worker hands its core to a replacement thread for a
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37269319029) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > ## Re-review at db3de4f2e (delta since d10bd84d6)  **Verdict: no blocking findings. Approve once CI is green on this SHA** (Simulation, Unit & Integration, macOS/Windows service jobs were still pending when I checked). I did not merge.  **Lenses run:** skeptical (timeout arithmetic) and testing (mutation check), both done by me in a fresh worktree. `codex review --base origin/main` failed twice with "usage limit, try again Oct 5th 1:01 AM"; no external model ran, and I did not wait for it. Local run: `cargo test -p freenet --lib wasmtime_engine::tests`, 63 passed, 0 failed.  **Timeout arithmetic (verified).** - Guest bound = max(T, epoch_deadline_ticks(T) x 100 ms) + 50 ms. The trap lands in [ceil(T/tick), ceil(T/tick)+1) ticks after arming, so the bound always outlasts it. 51 ticks plus 50 ms is 5.15 s for the default budget. No premature timeout: the bound is never below T. - No busy-spin: `time_to_next_wall_bound` is non-zero exactly when `classify_wall_timeout` is `KeepWaiting`, on
  > Check of the final test-only round at 5692b2d2f, by the orchestrator, who did not write this code. The diff since the re-reviewed db3de4f2e is test-only: additions inside `wasmtime_engine.rs` `mod tests` plus the deletion of the vacuous mpsc test. All three re-review findings are addressed: - The epoch-trap test is deterministic. Its epoch is advanced at 250 ms, inside the window, so a slow ticker can only make the trap earlier. The author reports it failing 3/3 with the guest-bound slack removed. - `!ran` is re-asserted after the blocker releases. - The vacuous test is removed.  Residual risk, to watch in the release soak: each in-flight call now holds two blocking-pool slots (the guest plus the `block_in_place` replacement worker), so a node already at its blocking-thread limit may see more `QueuedTimeout`s. Enqueuing.  [AI-assisted - Claude]

- **Issue #5800** (2026-10-05): **perf(client-api): event-driven subscription delivery instead of 10ms polling**
  *Symptoms*: ## Problem  On the hosted peer try.freenet.org, where browsers connect over WebSocket, the client WebSocket interface costs about 5.7% of node CPU. Two causes, both in `client_events/websocket.rs`:  1. **10 ms polling of subscription listeners.** Every pass of the per-connection `select!` loop built a fresh future that locked a `tokio::Mutex`, `try_recv`'d every subscription receiver in a `VecDeque`, then slept 10 ms. `try_recv` registers no waker, so the only thing that woke the task was the sleep. Each connection therefore woke about 100 times a second even when idle, and notifications waited up to 10 ms. 2. **Every wake re-polls the socket read, and that is expensive.** tungstenite's `FrameCodec::read_in` zero-fills the read buffer up to `read_buffer_size` (128 KiB by default) before *every* read attempt, including ones that return `WouldBlock`. That memset alone was about 2.5% of node CPU. The same code is in tungstenite 0.27 to 0.29, so upgrading would not help.  ## Approach  - **Event-driven delivery.** The receivers now live in a per-connection `tokio_stream::StreamMap`, polled as a guarded `select!` branch (`Some(n) = listeners.next(), if !listeners.is_empty()`). A notification wakes the task through the receiver's own waker. With no traffic, a connection now wakes only for its 30 s ping. The mutex, `Arc` and sleep are gone.   - **Keying:** entries are keyed by a per-connection `u64` counter, not by the contract label. `StreamMap` replaces an entry on a duplicate key,
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37265395517) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > Light re-check of the fix round at 3cfee7342, read by the orchestrator, who did not write this code. All three should-fix items are addressed: - `max_frame_size` now matches `max_message_size`, with a 20 MiB single-frame test that goes red without it. - The closed-listener step now waits deterministically on the listener-removed event. - Client-disconnect cleanup has a test.  Non-test delta: frame cap, `permission_prompts` read buffer (1 KiB, equal to that socket's caps), and a `debug_assert` on listener-id reuse. Correct.  One trade-off, recorded rather than blocking: tungstenite reserves a frame's declared length when the header arrives, so a 100 MiB frame cap lets one header reserve up to 100 MiB per connection, mostly untouched virtual memory. A 100 MiB message was already reachable through fragmented frames, and browsers send each message as one frame, so this fixes a real large-PUT failure. Enqueuing.  [AI-assisted - Claude]

- **Issue #5797** (2026-10-05): **perf(transport): cache socket address family instead of getsockname per send**
  *Symptoms*: ## Problem `impl Socket for UdpSocket` called `self.local_addr().map(|a| a.is_ipv6())` in both `send_to` and `send_to_blocking`, i.e. one `getsockname` syscall per UDP packet. Measured on production peer try.freenet.org at ~2,250 pps: 0.6-3.6% of node CPU depending on profiler.  ## Fix The socket family never changes after bind and equals the bind address family (a dual-stack socket bound to `[::]` is AF_INET6). Add `UdpTransportSocket { sock: tokio::net::UdpSocket, is_ipv6: bool }`, set in `Socket::bind` from `addr.is_ipv6()`, with a `Socket` impl that uses the cached flag. The node binds its transport socket as this type in `p2p_protoc.rs` (`run_event_listener`).  `impl Socket for tokio::net::UdpSocket` and the default `S = UdpSocket` generic parameters are unchanged, so there is no public API change (freenet is published). Bind and the blocking-send loop are shared helpers. No `Deref` on the new type, so it is always explicit whether a call is the metered trait `send_to`. Metrics recording is unchanged.  ## Tests - New `cached_family_matches_local_addr` (v4, `0.0.0.0`, `::1`, dual-stack `[::]`: cached flag == `local_addr().is_ipv6()`; IPv6 skip only on AddrNotAvailable/Unsupported). - New `transport_socket_sends_to_dual_stack_and_records_metrics` (v4 -> dual-stack, mapped reply via `send_to_blocking`, per-peer metrics). - Existing transport tests unchanged. - `cargo clippy -p freenet --all-targets -- -D warnings`: clean. - `cargo test -p freenet --lib transport`: 736 passe
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/37264070115) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > Light re-review of the revised diff at 2adcc738c, read by the orchestrator, who did not write this code. It addresses the earlier review: `impl Socket for UdpSocket` and the default type parameters are restored, so there is no public API change. `UdpTransportSocket` is used only at the production bind site in `p2p_protoc.rs`. `bind_udp` and `send_to_blocking_mapped` are pure extractions that keep the mapping and metrics behaviour identical, and `recv_from` delegates to the original impl. The IPv6 skip in the new test is narrowed to `AddrNotAvailable`/`Unsupported`. The new metrics test asserts on the cumulative per-peer snapshot keyed by a unique ephemeral port, the same pattern as the existing tests at `transport.rs:1124/1187`. No findings. Enqueuing.  [AI-assisted - Claude]

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

### Incident Patch 1: `76a147f2` (2026-10-05)
**Commit Message**: build: release 0.2.142 (#5810)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1899,7 +1899,7 @@ dependencies = [
 
 [[package]]
 name = "fdev"
-version = "0.3.303"
+version = "0.3.304"
 dependencies = [
  "anyhow",
  "axum",
@@ -2078,7 +2078,7 @@ dependencies = [
 
 [[package]]
 name = "freenet"
-version = "0.2.141"
+version = "0.2.142"
 dependencies = [
  "aes-gcm",
  "ahash",
```

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "freenet"
-version = "0.2.141"
+version = "0.2.142"
 edition = "2024"
 rust-version = "1.85"
 publish = true
```

**File**: `crates/fdev/Cargo.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "fdev"
-version = "0.3.303"
+version = "0.3.304"
 edition = "2024"
 rust-version = "1.85"
 publish = true
@@ -14,12 +14,12 @@ readme = "README.md"
 # (v0.2.x), so we embed the matching freenet version literally — `v{ version }`
 # would expand to the fdev crate version and 404. release.yml rewrites the
 # `vX.Y.Z` segment whenever the freenet version is bumped (issue #3995).
-pkg-url = "{ repo }/releases/download/v0.2.141/fdev-{ target }.tar.gz"
+pkg-url = "{ repo }/releases/download/v0.2.142/fdev-{ target }.tar.gz"
 pkg-fmt = "tgz"
 bin-dir = "fdev"
 
 [package.metadata.binstall.overrides.x86_64-pc-windows-msvc]
-pkg-url = "{ repo }/releases/download/v0.2.141/fdev-{ target }.zip"
+pkg-url = "{ repo }/releases/download/v0.2.142/fdev-{ target }.zip"
 pkg-fmt = "zip"
 bin-dir = "fdev.exe"
 
@@ -56,7 +56,7 @@ ed25519-dalek = { version = "2", features = ["rand_core", "serde"] }
 hex = { workspace = true }
 
 # internal
-freenet = { path = "../core", version = "0.2.141", features = ["testing"] }
+freenet = { path = "../core", version = "0.2.142", features = ["testing"] }
 freenet-stdlib = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 2: `46bf2002` (2026-10-04)
**Commit Message**: build: release 0.2.141 (#5788)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1899,7 +1899,7 @@ dependencies = [
 
 [[package]]
 name = "fdev"
-version = "0.3.302"
+version = "0.3.303"
 dependencies = [
  "anyhow",
  "axum",
@@ -2078,7 +2078,7 @@ dependencies = [
 
 [[package]]
 name = "freenet"
-version = "0.2.140"
+version = "0.2.141"
 dependencies = [
  "aes-gcm",
  "ahash",
```

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "freenet"
-version = "0.2.140"
+version = "0.2.141"
 edition = "2024"
 rust-version = "1.85"
 publish = true
```

**File**: `crates/fdev/Cargo.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "fdev"
-version = "0.3.302"
+version = "0.3.303"
 edition = "2024"
 rust-version = "1.85"
 publish = true
@@ -14,12 +14,12 @@ readme = "README.md"
 # (v0.2.x), so we embed the matching freenet version literally — `v{ version }`
 # would expand to the fdev crate version and 404. release.yml rewrites the
 # `vX.Y.Z` segment whenever the freenet version is bumped (issue #3995).
-pkg-url = "{ repo }/releases/download/v0.2.140/fdev-{ target }.tar.gz"
+pkg-url = "{ repo }/releases/download/v0.2.141/fdev-{ target }.tar.gz"
 pkg-fmt = "tgz"
 bin-dir = "fdev"
 
 [package.metadata.binstall.overrides.x86_64-pc-windows-msvc]
-pkg-url = "{ repo }/releases/download/v0.2.140/fdev-{ target }.zip"
+pkg-url = "{ repo }/releases/download/v0.2.141/fdev-{ target }.zip"
 pkg-fmt = "zip"
 bin-dir = "fdev.exe"
 
@@ -56,7 +56,7 @@ ed25519-dalek = { version = "2", features = ["rand_core", "serde"] }
 hex = { workspace = true }
 
 # internal
-freenet = { path = "../core", version = "0.2.140", features = ["testing"] }
+freenet = { path = "../core", version = "0.2.141", features = ["testing"] }
 freenet-stdlib = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 3: `33834dae` (2026-10-04)
**Commit Message**: fix(hosting): count the memory hosted contracts hold instead of estimating 1 MiB each (#5779)

**File**: `.claude/rules/code-style.md` (modified, +6/-4)
```diff
@@ -133,10 +133,12 @@ actors (clients, network peers) can influence.
      for coverage + hard byte budget + per-entry overhead floor); do not
      hand-roll byte accounting a third time (#4804 wrote it, #4805 shared it)
    → Name any new cache byte budget in
-     contract::executor::declared_cache_ceiling. The hosting budget
-     (ring::hosting::cache::resident_overhead_budget_for) is a RESIDUAL of
-     that sum, so an unnamed budget silently over-grants hosted contracts
-     against memory already committed. Pinned by
+     contract::executor::declared_cache_ceiling (test-only since #5647).
+     Each memory consumer has its own byte budget; the test
+     ring::hosting::cache::tests::declared_caches_plus_hosting_budget_leave_room_for_the_runtime
+     checks that the declared caches plus the hosting budget stay within 75%
+     of the memory limit at the shipped shapes, so an unnamed budget is
+     memory that check never sees. Naming is pinned by
      declared_cache_ceiling_names_every_budget.
 
 WHY: Unbounded collections are amplification vectors.
```

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ tao = { workspace = true }
 # had not actually been confirmed by (the job was still pending). `libc`
 # has every symbol needed, including the `_COUNT` size constants that avoid
 # hand-rolled `size_of` arithmetic — see `wasm_runtime::module_cache`'s
-# `read_macos_available_bytes`/`read_macos_own_rss_bytes`.
+# `read_macos_own_rss_bytes`.
 
 [dev-dependencies]
 arbitrary = { workspace = true }
```

**File**: `crates/core/src/config.rs` (modified, +16/-17)
```diff
@@ -181,17 +181,17 @@ pub struct ConfigArgs {
     #[arg(long, env = "MAX_HOSTING_DISK")]
     pub max_hosting_disk: Option<u64>,
 
-    /// Fraction (0.0 to 1.0) of spare host memory (this process's resident size
-    /// plus the memory the system reports as available) that the
-    /// resident-overhead budget may claim on top of what it already uses. That
-    /// budget limits how far an otherwise idle host grows the number of
-    /// contracts it hosts, so Freenet does not dominate the process list on a
-    /// machine with plenty of free memory. It is a separate axis from
-    /// `--max-hosting-storage`, which bounds state bytes. Default: 0.125.
-    // Internal (#5333): applies to the resident-overhead (count-derived)
-    // eviction budget, and never shrinks it below the host's already-declared
-    // static caches. The 1/8 default matches qBittorrent's disk-cache "auto"
-    // default and this codebase's own pre-existing `/8` convention.
+    /// Fraction (0.0 to 1.0) of this node's memory limit that hosted contracts
+    /// may hold in RAM (mainly the summaries neighbours send so the node can
+    /// keep each hosted contract up to date). The limit is physical RAM, or a
+    /// smaller cgroup / systemd `MemoryMax` limit when one applies; the budget
+    /// is never below 64 MiB. Past it, the node stops hosting its
+    /// least-demanded contracts. A separate axis from `--max-hosting-storage`,
+    /// which bounds state bytes on disk. Default: 0.125.
+    // Internal (#5647): before #5647 this was a share of LIVE spare memory added
+    // to current RSS, applied to a count-based estimate; a persisted
+    // non-default value now means a share of the whole limit. The 1/8 default
+    // matches this codebase's other RAM-scaled budgets.
     #[arg(long, env = "HOSTING_MEM_SHARE")]
     pub hosting_mem_share: Option<f64>,
 
@@ -1782,10 +1782,9 @@ pub struct Config {
     /// operator override survives a flag-less restart.
     #[serde(default = "default_max_hosting_disk", rename = "max-hosting-disk")]
     pub max_hosting_disk: u64,
-    /// Fraction (0.0-1.0) of LIVE host-wide surplus memory the resident-
-    /// overhead (count-derived) eviction budget may claim on top of its own
-    /// RSS (#5333). Default 0.125 (1/8). Persisted so an operator override
-    /// survives a flag-less restart.
+    /// Fraction (0.0-1.0) of the node's memory limit (cgroup-aware) that hosted
+    /// contracts may hold in RAM (#5647). Default 0.125 (1/8). Persisted so an
+    /// operator override survives a flag-less restart.
     #[serde(default = "default_hosting_mem_share", rename = "hosting-mem-share")]
     pub hosting_mem_share: f64,
     /// Per-user secret-storage quota in bytes for hosted mode (#4561, P5 of
@@ -1985,8 +1984,8 @@ fn default_max_hosting_disk() -> u64 {
     crate::ring::DEFAULT_MAX_HOSTING_DISK_BYTES
 }
 
-/// Default fraction of live host-wide surplus memory the resident-overhead
-/// eviction budget may claim (#5333): resolves to
+/// Default fraction of the node's memory limit that hosted contracts may hold
+/// in RAM (#5647): resolves to
 /// [`crate::ring::DEFAULT_RESIDENT_OVERHEAD_MEM_SHARE`] (0.125), the single
 /// source of truth shared with the sizing math.
 fn default_hosting_mem_share() -> f64 {
```

**File**: `crates/core/src/contract.rs` (modified, +3/-2)
```diff
@@ -28,11 +28,12 @@ mod state_size_metrics;
 pub mod storages;
 pub(crate) mod user_input;
 
+#[cfg(test)]
+pub(crate) use executor::declared_cache_ceiling;
 pub(crate) use executor::{
     ContractExecutor, ExecutorTransactionStream, ExportBusy, MAX_CREATED_DELEGATES_PER_NODE,
     MAX_DELEGATE_CREATION_DEPTH, MAX_DELEGATE_CREATIONS_PER_CALL,
-    SUBSCRIBER_NOTIFICATION_CHANNEL_SIZE, UpsertOutcome, UpsertResult, declared_cache_ceiling,
-    mock_runtime::MockRuntime,
+    SUBSCRIBER_NOTIFICATION_CHANNEL_SIZE, UpsertOutcome, UpsertResult, mock_runtime::MockRuntime,
 };
 
 // Re-export CRDT emulation functions for testing
```

**File**: `crates/core/src/contract/executor.rs` (modified, +5/-9)
```diff
@@ -1394,15 +1394,11 @@ pub(crate) fn delta_budget_for(total_ram: usize, pool_size: usize) -> usize {
 /// safety on a >32 GiB host is guarded separately by
 /// `module_cache::tests::max_clamp_combined_ceiling_is_safe_at_binding_host`.)
 ///
-/// Promoted from a `#[cfg(test)]`-only helper (originally written purely to
-/// verify [`cache_byte_budgets_are_aggregate_safe`] below) to a real
-/// production function (#5333 review): the resident-overhead hosting budget
-/// (`ring::hosting::cache::resident_overhead_budget_for`) needs the SAME
-/// real figure — what every OTHER memory consumer has already declared — to
-/// derive its own budget as a residual rather than an independently-clamped
-/// guess. Using this one function in both places means the aggregate-safety
-/// test now checks the ACTUAL formula the resident-overhead budget composes
-/// against, not a second, potentially-drifting re-derivation of it.
+/// Test-only again since #5647. #5333 promoted it to production so the
+/// resident-overhead hosting budget could be derived as a residual of it; that
+/// budget is now its own share of the memory limit, so this sum is used only
+/// by the aggregate-safety tests, which keep every declared cache in one place.
+#[cfg(test)]
 pub(crate) fn declared_cache_ceiling(memory_limit: usize, pool_size: usize) -> usize {
     // PER-EXECUTOR — multiplied by the pool.
     let summary = summary_budget_for(memory_limit, pool_size);
```

**File**: `crates/core/src/contract/handler.rs` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@ impl ContractHandler for NetworkContractHandler {
             config.hosting_disk_pct,
             config.max_hosting_disk,
         );
-        // Resident-overhead (count-derived) budget's live-surplus share (#5333).
+        // Share of the memory limit hosted contracts may hold in RAM (#5647).
         op_manager
             .ring
             .configure_resident_overhead_mem_share(config.hosting_mem_share);
```

**File**: `crates/core/src/node.rs` (modified, +31/-9)
```diff
@@ -4568,20 +4568,36 @@ async fn handle_interest_sync_message(
                         // production and sim-only converged skips, both fixed in
                         // #5055). Pinned by
                         // `summaries_arm_writes_summary_outside_staleness_branch_pin`.
+                        //
+                        // Bounded against OUR summary of the same contract
+                        // when we have it (#5647, #5781): a peer's summary far
+                        // larger than ours is not stored, because its bytes are
+                        // charged to the hosting budget.
                         match their_summary {
                             Some(theirs) => {
-                                op_manager.interest_manager.upsert_peer_summary_from(
+                                op_manager.interest_manager.upsert_peer_summary_bounded(
                                     &contract,
                                     &pk,
                                     theirs,
                                     crate::ring::interest::SummaryPopulationSource::InterestSummary,
+                                    our_summary.as_ref(),
                                 );
                             }
-                            None => op_manager.interest_manager.clear_peer_summary(
-                                &contract,
-                                &pk,
-                                crate::ring::interest::SummaryMissingReason::ClearedByNoneReport,
-                            ),
+                            None => {
+                                // Our summary, when we computed it, sizes the
+                                // contract's summary cap even if this peer sent
+                                // none (#5781).
+                                if let Some(ours) = our_summary.as_ref() {
+                                    op_manager
+                                        .interest_manager
+                                        .note_own_summary(&contract, ours);
+                                }
+                                op_manager.interest_manager.clear_peer_summary(
+                                    &contract,
+                                    &pk,
+                                    crate::ring::interest::SummaryMissingReason::ClearedByNoneReport,
+                                )
+                            }
                         }
 
                         if is_stale && !stale_contracts.contains(&contract) {
@@ -6456,10 +6472,15 @@ mod tests {
                 .expect("end of handler region not found");
         let body: String = src[handler_start..handler_end].split_whitespace().collect();
         assert!(
-            body.contains("upsert_peer_summary_from(&contract,&pk,theirs,"),
+            body.contains("upsert_peer_summary_bounded(&contract,&pk,theirs,"),
             "Summaries arm must upsert a Some(summary) report (seeds untracked \
              co-hosts, #4952)"
         );
+        assert!(
+            body.contains("ifletSome(ours)=our_summary.as_ref(){op_manager.interest_manager.note_own_summary(&contract,ours);}"),
+            "a Summaries entry without the peer's summary must still record our own \
+             summary when we computed it (#5781)"
+        );
         assert!(
             !body.contains("update_peer_summary(&contract,&pk,Some"),
             "a Some(summary) report must go through the upsert, not the \
@@ -6683,7 +6704,7 @@ mod tests {
 
         // Both writes must be present — they are the only thing refreshing the
         // TTL on this path.
-        let upsert_at = summaries_arm.find("upsert_peer_summary_from(").expect(
+        let upsert_at = summaries_arm.find("upsert_peer_summary_bounded(").expect(
             "the Summaries arm must cache the peer's reported summary via \
              upsert_peer_summary — that write is also what refreshes the peer's \
              interest TTL here (#4952, #3046)",
@@ -6719,7 +6740,8 @@ mod tests {
             .filter(|c| !c.is_whitespace())
             .collect();
         assert!(
-            !stripped.contains("ifis_stale{op_manager.interest_manager.upsert_peer_summary_from("),
+            !stripped
+                .contains("ifis_stale{op_manager.interest_manager.upsert_peer_summary_bounded("),
             "the summary write must not be gated on is_stale — see above"
         );
     }
```

**File**: `crates/core/src/node/network_status.rs` (modified, +9/-20)
```diff
@@ -2161,28 +2161,17 @@ pub struct HostingSnapshot {
     /// real value — so the panel can distinguish "not yet computed" from a
     /// genuine (if enormous) budget.
     pub disk_budget_bytes: Option<u64>,
-    /// Configured resident-overhead budget (bytes, #5325): the RAM-scaled
-    /// ceiling on `contract_count * ESTIMATED_RESIDENT_BYTES_PER_CONTRACT`, a
-    /// pressure axis independent of `budget_bytes`/`used_bytes` (which cover
-    /// contract STATE bytes only, not the per-contract resident bookkeeping
-    /// overhead that scales with count). See
+    /// Resident-overhead budget (bytes, #5325/#5647): the memory hosted
+    /// contracts may hold in RAM, `--hosting-mem-share` of the node's memory
+    /// limit. A pressure axis independent of `budget_bytes`/`used_bytes`,
+    /// which cover contract STATE bytes on disk. See
     /// `.claude/rules/hosting-invariants.md` invariant 3.
     pub resident_overhead_budget_bytes: u64,
-    /// Current estimated resident-overhead bytes (#5325): `contract_count *
-    /// ESTIMATED_RESIDENT_BYTES_PER_CONTRACT`. Compare against
-    /// `resident_overhead_budget_bytes` the same way `used_bytes` is compared
-    /// against `budget_bytes`.
-    pub estimated_resident_overhead_bytes: u64,
-    /// The resident-overhead budget expressed as the contract COUNT it really
-    /// bounds (`resident_overhead_budget_bytes / 1 MiB-per-contract`).
-    ///
-    /// The dashboard renders this rather than the byte pair, because the byte
-    /// pair is not a memory measurement: the "used" side is
-    /// `contract_count * ESTIMATED_RESIDENT_BYTES_PER_CONTRACT`, so printing
-    /// it in MB reads to an operator as measured RAM when it is really a
-    /// contract-count ceiling. Derived in `HostingCache::contract_slot_budget`
-    /// so the per-contract constant keeps exactly one reader.
-    pub contract_slot_budget: u64,
+    /// Bytes hosted contracts currently hold in RAM (#5647): neighbour
+    /// summaries plus a fixed per-entry charge, counted from what is stored.
+    /// Compare against `resident_overhead_budget_bytes` the same way
+    /// `used_bytes` is compared against `budget_bytes`.
+    pub resident_overhead_bytes: u64,
     /// Monotonic count of evictions where resident-overhead pressure was
     /// active at decision time (#5325); may overlap with
     /// `budget_evictions_total`.
```

---

### Incident Patch 4: `70367478` (2026-10-03)
**Commit Message**: fix(interest): free neighbour interest records when a contract stops being hosted (#5782)

**File**: `.claude/rules/bug-prevention-patterns.md` (modified, +107/-0)
```diff
@@ -774,3 +774,110 @@ grep -rn "\.record_contract_update(\|\.send_update_notification(\|\.send_delegat
 # reachable from the driver.
 grep -rn "ring.subscribe(\|complete_subscription_request\|announce_contract_hosted\|fetch_contract_if_missing" crates/core/src/operations/
 ```
+
+
+## A mirror of hosting state cleaned up only when the mirror changes
+
+**State that mirrors another structure's membership must be reconciled against
+that structure on a timer, not only cleaned up at the moment the mirror
+changes.** `InterestManager` mirrors the hosting cache (`LocalInterest.hosting`,
+and the neighbour records in `interested_peers` that ride on it), and
+several paths write the mirror without consulting the source: the `Interests`
+heartbeat handler, `upsert_peer_summary_from`, a subscribe finaliser. A cleanup
+run at the instant local interest ends can be undone by a registration already
+in flight, and nothing ever runs it again.
+
+#5780: eviction cleared `LocalInterest.hosting` but left `interested_peers`.
+The records kept the contract in `contract_hash_index`, so the heartbeat kept
+advertising it, so neighbours kept refreshing the records. Evicting a contract
+freed almost none of its memory. #5779's first fix dropped the records at the
+moment interest ended (edge-triggered) and review found it raced every
+unchecked writer.
+
+### Fix shape (#5782)
+
+- **Level-triggered reconciliation** on the existing hosting sweep
+  (`InterestManager::reconcile_with_hosting`), acting only on a state that has
+  held for `RECONCILE_MIN_UNUSED_AGE`.
+- **Measure the wait in elapsed time, never in passes.** The sweep's
+  `tokio::time::interval` uses `MissedTickBehavior::Burst` (the tokio default;
+  the sweep does not set it), so after a stall two passes can run milliseconds
+  apart.
+- **Restart the wait on every change to the mirror**, not only when a pass
+  observes the source: a re-host and re-eviction between two passes is
+  invisible to the passes. A pass treats a restart as a stop signal: its
+  record removal re-checks, under the record's shard guard, that the wait
+  entry it started from is unchanged, so a subscribe refreshing an upstream
+  record mid-pass keeps it. The one write that must NOT restart the wait is
+  the pass's own stale-flag clear (`clear_local_hosting_flag`); going
+  through `unregister_local_hosting` there would stop the pass dropping the
+  records it just made eligible.
+- **Re-check the source immediately before each destructive step**, and say in
+  the doc comment that the checks are not atomic and what restores state when
+  a registration lands just after a drop.
+- **When a pass works through a bounded window, resume from a KEY, not an
+  offset.** An offset into unordered map iteration loses coverage under churn.
+- **Do not add a repair that writes the mirror from a probe that can be
+  inconclusive.** `contract_state_present` (and the async variant on SQLite
+  errors) answers "present" when it cannot tell; a repair keyed on it
+  registers and advertises stateless phantoms (#4610 shape). #5782 removed
+  such a repair rather than gate it; the residual is #5784.
+- **A node's own subscription lease is not demand.** It exists to receive
+  updates for a hosted copy, so it follows hosting and never justifies it.
+  Demand is a local client or a downstream subscriber. When the copy is gone
+  and there is no demand, do not count the lease as use and do not keep the
+  copy for it: the lease is renewed only for demand, so it lapses within one
+  lease period. The advertisement retraction refuses while a lease is live (a
+  subscribe installs it before the body arrives, so a live lease may mean a
+  host is forming), so something must retract after the lease ends. A
+  lease ends several ways (expiry, an upstream unsubscribe on collapse,
+  eviction), so reconcile against the advertised set itself: the sweep
+  examines every advertised contract, not only those with interest records
+  (up to `MAX_RECONCILE_KEYS_PER_PASS` per pass, resuming where it stopped),
+  and retracts each that is unhosted, unused and lease-free past the wait.
+  A contract tracked only by its records goes untracked once they are
+  dropped, and a retraction refused earlier is then never retried. Do not
+  retract only at the moment a flag is cleared or a lease expires: other
+  paths end the same state and nothing comes back to retry.
+
+The two paths that form a CACHE host (the GET cache path and the PUT relay
+store) go through `operations::complete_host_formation` (announce, migration
+nudge, register local hosting, interest change). The caller checks
+`is_hosting_contract` before it, and the helper checks again after the
+announce await and registers nothing if the contract was evicted meanwhile.
+Its retraction there is usually a no-op (the eviction already removed the
+advertisement entry), and every hosting retraction is best-effort: a dropped
+one is healed when a co-host re-requests our hoste
```

**File**: `.config/nextest.toml` (modified, +10/-0)
```diff
@@ -21,6 +21,16 @@ slow-timeout = { period = "120s", terminate-after = 2 }
 filter = "test(test_interest_renewal)"
 slow-timeout = { period = "300s", terminate-after = 2 }
 
+# #5780 interest-record reconciliation: a 1-gateway / 3-node Turmoil simulation
+# of ~2400s virtual time (ten slow GETs 45s apart, then a 1500s quiet period so
+# leases lapse and the 120s reconcile wait plus a sweep elapse before
+# measuring), with a topology snapshot per peer every virtual second. Measured
+# 68-72s wall-clock alone and 113s under the full parallel suite locally, too
+# close to the default 120s period on a slower runner.
+[[profile.ci.overrides]]
+filter = "test(test_evicted_contracts_keep_no_interest_records)"
+slow-timeout = { period = "300s", terminate-after = 2 }
+
 # Ping integration tests have internal timeouts of 360-600s with sequential
 # phases (WS connect retries, ring connection waits, contract operations).
 # Default 240s nextest cap kills them before they can finish on slow runners.
```

**File**: `crates/core/src/contract/handler.rs` (modified, +1/-2)
```diff
@@ -160,10 +160,9 @@ impl ContractHandler for NetworkContractHandler {
         // Populate neighbor hosting from hosted contracts so HostingStateResponse
         // reports our full contract set when ring connections establish.
         let hosted_keys = op_manager.ring.hosting_contract_keys();
-        let hosted_ids = hosted_keys.iter().map(|k| *k.id());
         op_manager
             .neighbor_hosting
-            .initialize_from_hosting_cache(hosted_ids);
+            .initialize_from_hosting_cache(hosted_keys.into_iter());
 
         // #4780: also rehydrate InterestManager local-hosting for every restored
         // hosted contract, so a client GET for a cached contract serves LOCALLY
```

**File**: `crates/core/src/node/neighbor_hosting.rs` (modified, +39/-17)
```diff
@@ -25,7 +25,7 @@
 
 use std::{collections::HashSet, sync::Arc};
 
-use dashmap::{DashMap, DashSet};
+use dashmap::DashMap;
 use freenet_stdlib::prelude::{ContractInstanceId, ContractKey};
 use tracing::{debug, info, trace};
 
@@ -88,8 +88,10 @@ impl NeighborHostingResult {
 /// This information is used to forward UPDATEs to hosts who have a contract
 /// but may not be explicitly subscribed to it.
 pub struct NeighborHostingManager {
-    /// Contracts we are hosting locally.
-    my_contracts: Arc<DashSet<ContractInstanceId>>,
+    /// Contracts we are hosting locally, with the full key of each so the
+    /// hosting sweep can reconcile the advertised set against the hosted set
+    /// (#5782).
+    my_contracts: Arc<DashMap<ContractInstanceId, ContractKey>>,
 
     /// What we know about our neighbors' hosted contracts.
     /// Maps neighbor public key to the set of contracts they're hosting.
@@ -108,7 +110,7 @@ impl NeighborHostingManager {
     /// Create a new neighbor hosting manager.
     pub fn new() -> Self {
         Self {
-            my_contracts: Arc::new(DashSet::new()),
+            my_contracts: Arc::new(DashMap::new()),
             neighbor_contracts: DashMap::new(),
         }
     }
@@ -120,7 +122,11 @@ impl NeighborHostingManager {
     pub fn on_contract_hosted(&self, contract_key: &ContractKey) -> Option<NeighborHostingMessage> {
         let contract_id = *contract_key.id();
 
-        if self.my_contracts.insert(contract_id) {
+        if self
+            .my_contracts
+            .insert(contract_id, *contract_key)
+            .is_none()
+        {
             info!(
                 contract = %contract_key,
                 "NEIGHBOR_HOSTING: Added contract to locally hosted"
@@ -223,7 +229,7 @@ impl NeighborHostingManager {
         if still_hosted() {
             // Re-host / re-subscribe raced us: put the advertisement back and
             // emit nothing. Neighbors never observed the removal.
-            self.my_contracts.insert(contract_id);
+            self.my_contracts.insert(contract_id, *contract_key);
             trace!(
                 contract = %contract_key,
                 "NEIGHBOR_HOSTING: eviction retraction skipped — contract re-hosted \
@@ -325,7 +331,7 @@ impl NeighborHostingManager {
                 let overlapping: Vec<ContractInstanceId> = added
                     .iter()
                     .filter(|id| !previously_known.contains(id)) // Only NEW contracts
-                    .filter(|id| self.my_contracts.contains(*id)) // That we also have
+                    .filter(|id| self.my_contracts.contains_key(*id)) // That we also have
                     .copied()
                     .collect();
 
@@ -406,7 +412,7 @@ impl NeighborHostingManager {
                 let overlapping: Vec<ContractInstanceId> = contracts
                     .iter()
                     .filter(|id| !previously_known.contains(*id)) // Only NEW from this peer
-                    .filter(|id| self.my_contracts.contains(*id)) // That we also host
+                    .filter(|id| self.my_contracts.contains_key(*id)) // That we also host
                     .copied()
                     .collect();
 
@@ -547,13 +553,10 @@ impl NeighborHostingManager {
 
     /// Initialize my_contracts from contracts loaded from disk.
     /// Must be called after loading the hosting cache and before ring connections establish.
-    pub fn initialize_from_hosting_cache(
-        &self,
-        contract_ids: impl Iterator<Item = ContractInstanceId>,
-    ) {
+    pub fn initialize_from_hosting_cache(&self, contract_keys: impl Iterator<Item = ContractKey>) {
         let mut count = 0;
-        for id in contract_ids {
-            self.my_contracts.insert(id);
+        for key in contract_keys {
+            self.my_contracts.insert(*key.id(), key);
             count += 1;
         }
         if count > 0 {
@@ -567,7 +570,15 @@ impl NeighborHostingManager {
     /// Check if we are hosting a contract locally.
     #[allow(dead_code)]
     pub fn is_hosted_locally(&self, contract_key: &ContractKey) -> bool {
-        self.my_contracts.contains(contract_key.id())
+        self.my_contracts.contains_key(contract_key.id())
+    }
+
+    /// The contracts this node advertises hosting (`my_contracts`).
+    pub(crate) fn advertised_contract_keys(&self) -> Vec<ContractKey> {
+        self.my_contracts
+            .iter()
+            .map(|entry| *entry.value())
+            .collect()
     }
 
     /// Get the number of contracts we advertise hosting locally (`my_contracts`).
@@ -1325,10 +1336,14 @@ mod tests {
         assert_eq!(manager.local_hosted_count(), 0);
 
         // Initialize from hosting cache
-        manager.initialize_from_hosting_cache(vec![*key1.id(), *key2.id()].into_iter());
+        manager.initialize_from_hosting_cache(vec![key1, key2].into_iter());
 
-        // Should now report both contracts
+        // Should now report both contracts, under their full
```

**File**: `crates/core/src/operations.rs` (modified, +141/-3)
```diff
@@ -274,6 +274,71 @@ pub(crate) fn reject_if_contract_banned_on(
     Ok(())
 }
 
+/// Side effects of a contract becoming hosted with its state held locally
+/// (#5780): advertise it to neighbours (so it receives live UPDATE fan-out),
+/// nudge placement, register local hosting (so it joins anti-entropy,
+/// hosting-invariants invariant 1), and send one interest change carrying it
+/// together with any `removed` contracts from the same event.
+///
+/// One helper so every path that forms a host runs the whole sequence: the GET
+/// cache path and the PUT relay store both call it. A path that registered
+/// without announcing left a re-hosted copy unadvertised after its eviction had
+/// retracted the advertisement; one that announced without checking the
+/// contract was still hosted left an advertisement and a hosting flag for a
+/// contract it no longer held.
+///
+/// Callers check `is_hosting_contract` first, and the helper checks again after
+/// the announce, which can wait up to 30s: if the contract was evicted in that
+/// window nothing is registered, so no local-hosting flag or `added` interest
+/// outlives the eviction. The retraction issued then is often a no-op, since
+/// the eviction already removed the advertisement entry; like every hosting
+/// retraction it is best-effort, and a dropped one is healed when a co-host
+/// re-requests our hosted set on the interest heartbeat (~5 min). Neither check
+/// is atomic with eviction: a flag set just before an eviction is cleared and
+/// retracted by the hosting sweep's reconciliation, within
+/// `RECONCILE_MIN_UNUSED_AGE` plus one sweep interval.
+pub(crate) async fn complete_host_formation(
+    op_manager: &OpManager,
+    key: ContractKey,
+    removed: Vec<ContractKey>,
+) {
+    announce_contract_hosted(op_manager, &key).await;
+    // The announce can wait up to 30s; an evicted contract re-hosted or
+    // re-subscribed meanwhile must not be sent as removed after its own
+    // addition went out.
+    let removed: Vec<ContractKey> = removed
+        .into_iter()
+        .filter(|k| {
+            !op_manager.ring.is_hosting_contract(k)
+                && !op_manager.interest_manager.has_local_interest(k)
+        })
+        .collect();
+    if !op_manager.ring.is_hosting_contract(&key) {
+        retract_advertisement_for_evicted_contract(op_manager, &key);
+        if !removed.is_empty() {
+            broadcast_change_interests(op_manager, Vec::new(), removed).await;
+        }
+        return;
+    }
+    // Directed-subscribe placement (#4404): best-effort nudge the node to
+    // consider migrating this freshly-hosted contract toward a closer
+    // neighbor. Dropped silently if the event channel is full; the next
+    // hosting/peer event re-triggers consideration.
+    if let Err(err) = op_manager
+        .try_notify_node_event(crate::message::NodeEvent::ConsiderContractMigration { key })
+    {
+        tracing::debug!(%key, %err, "ConsiderContractMigration emit dropped");
+    }
+    let added = if op_manager.interest_manager.register_local_hosting(&key) {
+        vec![key]
+    } else {
+        Vec::new()
+    };
+    if !added.is_empty() || !removed.is_empty() {
+        broadcast_change_interests(op_manager, added, removed).await;
+    }
+}
+
 /// Announces to neighbors that we're hosting a contract.
 /// This broadcasts to all connected peers so they know to forward UPDATEs to us.
 pub(crate) async fn announce_contract_hosted(op_manager: &OpManager, key: &ContractKey) {
@@ -384,9 +449,15 @@ pub(crate) fn announce_contract_unhosted(op_manager: &OpManager, key: &ContractK
 /// - `is_hosting_contract` — a GET/PUT re-hosted it into the hosting cache.
 /// - `contract_in_use` — a client or downstream subscriber re-registered.
 ///   (These two match guards 1 and 2 in `RuntimePool::remove_contract`.)
-/// - `is_subscribed` — we hold a live upstream subscription lease, so we are
-///   wired into the contract's update mesh and therefore a host under invariant
-///   1, even with no cache entry and no subscriber of our own yet.
+/// - `is_subscribed` — we hold a live upstream subscription lease. A lease is
+///   not demand (it follows hosting); it is checked here because a SUBSCRIBE
+///   installs it before the body fetch and the announce, so a live lease may
+///   mean a host is forming. A lease left on a contract with no host and no
+///   demand is not renewed, so it lapses within one lease period (#5782). The
+///   hosting sweep's reconciliation calls this retraction every pass for each
+///   advertised or tracked contract that has been unhosted and unused for
+///   `RECONCILE_MIN_UNUSED_AGE` and is lease-free, so the advertisement goes
+///   on the first such pass after the lease ends, however it ended.
 ///
 /// The lease check is what makes the ordering guarantee below hold for the
 /// SUBSCRIBE path, whose announce is gated on the body being present ON DISK
@@ -1332,6 +1403,73 @@ mod sub_op_subscrib
```

**File**: `crates/core/src/operations/get/op_ctx_task.rs` (modified, +264/-34)
```diff
@@ -43,7 +43,7 @@ use freenet_stdlib::prelude::*;
 use crate::client_events::HostResult;
 use crate::config::{GlobalExecutor, OPERATION_TTL};
 use crate::contract::{ContractHandlerEvent, StoreResponse};
-use crate::message::{NetMessage, NetMessageV1, NodeEvent, Transaction};
+use crate::message::{NetMessage, NetMessageV1, Transaction};
 use crate::node::NetworkBridge;
 use crate::node::OpManager;
 #[rustfmt::skip]
@@ -1853,6 +1853,26 @@ fn synthetic_key(instance_id: &ContractInstanceId) -> ContractKey {
     ContractKey::from_id_and_code(*instance_id, CodeHash::new([0u8; 32]))
 }
 
+/// Whether a local `GetQuery` reply holds both state and code for `key`,
+/// stored under the same full key (#5782). `ContractKey` equality ignores the
+/// code hash, so the stored key's code hash is compared explicitly: a reply
+/// with the right instance and a different code hash does not count.
+fn stored_state_and_code_match(
+    stored: &Result<ContractHandlerEvent, crate::contract::ContractError>,
+    key: &ContractKey,
+) -> bool {
+    matches!(
+        stored,
+        Ok(ContractHandlerEvent::GetResponse {
+            key: Some(stored_key),
+            response: Ok(StoreResponse {
+                state: Some(_),
+                contract: Some(_),
+            }),
+        }) if stored_key.code_hash() == key.code_hash()
+    )
+}
+
 /// Store the fetched contract state in the local executor and run
 /// the originator-side hosting side effects. Mirrors the legacy
 /// `process_message` Response{Found} branch at `get.rs:2218-2450`.
@@ -1884,9 +1904,11 @@ fn synthetic_key(instance_id: &ContractInstanceId) -> ContractKey {
 ///    `get.rs:2260-2262, :2353-2355, :3056-3058`
 ///    all gate the call on `is_original_requester =
 ///    upstream_addr.is_none()`.
-/// 4. **Newly-hosted announcement** — only runs when the local
-///    store actually transitioned from no-state to has-state
-///    (i.e., `access_result.is_new && put_persisted`). NOT gated on
+/// 4. **Newly-hosted announcement** — runs through
+///    `operations::complete_host_formation` when this access newly hosts
+///    the contract with its state held locally, whether persisted now or
+///    already on disk with its code, and it is still hosted (`forms_host`,
+///    #5780). NOT gated on
 ///    `is_client_requester`; legacy announces on any first-time relay
 ///    cache too (`get.rs:2278, 2370`).
 ///
@@ -2037,9 +2059,13 @@ async fn cache_contract_locally(
 
     let mut removed_contracts = Vec::new();
     for (evicted_key, expected_generation) in &access_result.evicted {
-        if op_manager
-            .interest_manager
-            .unregister_local_hosting(evicted_key)
+        // Skip if re-hosted since the eviction decision (#5780): the
+        // re-host registered it, and unregistering here would take a
+        // hosted contract out of anti-entropy.
+        if !op_manager.ring.is_hosting_contract(evicted_key)
+            && op_manager
+                .interest_manager
+                .unregister_local_hosting(evicted_key)
         {
             removed_contracts.push(*evicted_key);
         }
@@ -2049,15 +2075,39 @@ async fn cache_contract_locally(
         crate::operations::reclaim_evicted_contract(op_manager, *evicted_key, *expected_generation);
     }
 
+    // A re-host from state already on disk forms a host only if the contract
+    // code is on disk too: a partial reclamation can delete the code and leave
+    // the state, and `state_matches` reads the state alone (#5782). Checked
+    // only on this branch, and only while still hosted, since it loads the
+    // WASM. It reads the code on disk and ignores code carried by the GET:
+    // restoring missing code from the GET is #5784. The stored key's code
+    // hash must match the key being hosted: `ContractKey` equality ignores
+    // the code hash, so a reply with the right instance and a wrong code hash
+    // would otherwise be registered and advertised under a malformed key.
+    let rehost_has_code =
+        if access_result.is_new && state_matches && op_manager.ring.is_hosting_contract(&key) {
+            let stored = op_manager
+                .notify_contract_handler(ContractHandlerEvent::GetQuery {
+                    instance_id: *key.id(),
+                    return_contract_code: true,
+                })
+                .await;
+            stored_state_and_code_match(&stored, &key)
+        } else {
+            false
+        };
+    let forms_host = access_result.is_new
+        && (put_persisted || rehost_has_code)
+        && op_manager.ring.is_hosting_contract(&key);
     // Reconcile-controller SHADOW comparison (keystone step-2, #4642),
     // HOST-FORMATION site (GET cache path). About to (conditionally) announce
     // hosting; does the controller agree? Focused on `Announce`. Actual =
     // `{Announce}` iff production announces a NOT-yet-advertised host this event
-    // (`is_new && put_persisted` AND not already advertis
```

**File**: `crates/core/src/operations/put/op_ctx_task.rs` (modified, +36/-32)
```diff
@@ -29,7 +29,7 @@ use freenet_stdlib::prelude::*;
 
 use crate::client_events::HostResult;
 use crate::config::{GlobalExecutor, OPERATION_TTL};
-use crate::message::{NetMessage, NetMessageV1, NodeEvent, Transaction};
+use crate::message::{NetMessage, NetMessageV1, Transaction};
 use crate::node::NetworkBridge;
 use crate::node::OpManager;
 use crate::node::WaiterReply;
@@ -2654,8 +2654,9 @@ where
 /// Store a relayed PUT's contract locally: `put_contract` + `host_contract`
 /// (unconditional, so EVERY genuine PUT refreshes hosting recency —
 /// invariant 3 / #4903 review Fix 1) + (on first host, gated on the atomic
-/// `host_contract` `is_new` result) `announce_contract_hosted` + interest
-/// register/unregister + broadcast interest changes.
+/// `host_contract` `is_new` result) eviction teardown, then host formation
+/// through `operations::complete_host_formation` (announce, interest register,
+/// interest changes) while the contract is still hosted (#5780).
 ///
 /// Shared between the non-streaming relay driver (`drive_relay_put`)
 /// and the streaming relay driver (`drive_relay_put_streaming`) so both
@@ -2812,8 +2813,9 @@ async fn relay_put_store_locally(
     // result (`is_new`), NOT a pre-await `is_hosting_contract` snapshot
     // (#4903 review round-3 Fix 1): a sweep can evict this contract during the
     // `put_contract().await` above, in which case `host_contract` re-adds it
-    // (`is_new = true`) and we MUST run announce / interest-register /
-    // evicted-teardown here. A stale pre-await "was already hosting" snapshot
+    // (`is_new = true`) and we MUST run evicted-teardown and host formation
+    // here (host formation itself is skipped if the contract has been evicted
+    // again by then). A stale pre-await "was already hosting" snapshot
     // would skip them AND drop `access_result.evicted` (leaking the contracts
     // this re-add shed to make room). On the already-hosted refresh path
     // `is_new` is false and `evicted` is empty (`record_access_with_demand`
@@ -2837,23 +2839,15 @@ async fn relay_put_store_locally(
             );
         }
 
-        crate::operations::announce_contract_hosted(op_manager, &key).await;
-
-        // Directed-subscribe placement (#4404): best-effort nudge the node to
-        // consider migrating this freshly-hosted contract toward a closer
-        // neighbor. Dropped silently if the event channel is full — the next
-        // hosting/peer event re-triggers consideration.
-        if let Err(err) =
-            op_manager.try_notify_node_event(NodeEvent::ConsiderContractMigration { key })
-        {
-            tracing::debug!(%key, %err, "ConsiderContractMigration emit dropped (PUT)");
-        }
-
         let mut removed_contracts = Vec::new();
         for (evicted_key, expected_generation) in evicted {
-            if op_manager
-                .interest_manager
-                .unregister_local_hosting(&evicted_key)
+            // Skip if re-hosted since the eviction decision (#5780): the
+            // re-host registered it, and unregistering here would take a
+            // hosted contract out of anti-entropy.
+            if !op_manager.ring.is_hosting_contract(&evicted_key)
+                && op_manager
+                    .interest_manager
+                    .unregister_local_hosting(&evicted_key)
             {
                 removed_contracts.push(evicted_key);
             }
@@ -2867,19 +2861,24 @@ async fn relay_put_store_locally(
             );
         }
 
-        let became_interested = op_manager.interest_manager.register_local_hosting(&key);
-        let added = if became_interested { vec![key] } else { vec![] };
-        if !added.is_empty() || !removed_contracts.is_empty() {
-            crate::operations::broadcast_change_interests(op_manager, added, removed_contracts)
-                .await;
+        // Form the host through the shared helper (announce, migration nudge,
+        // register, interest change), and only while the contract is still
+        // hosted: a sweep eviction between `host_contract` and here has already
+        // retracted it, and announcing afterwards would leave an advertisement
+        // and a local-hosting flag for a contract this node no longer holds
+        // (#5780).
+        if op_manager.ring.is_hosting_contract(&key) {
+            crate::operations::complete_host_formation(op_manager, key, removed_contracts).await;
+        } else if !removed_contracts.is_empty() {
+            crate::operations::broadcast_change_interests(
+                op_manager,
+                Vec::new(),
+                removed_contracts,
+            )
+            .await;
         }
     }
 
-    debug_assert!(
-        op_manager.ring.is_hosting_contract(&key),
-        "PUT relay: contract {key} must be in hosting list after put_contract + host_contract"
-    );
-
     Ok(merged_value)
 }
 
@@ -6844,9 +6843,14 @@ mod tests {
             helper_src.contains("host_con
```

**File**: `crates/core/src/operations/subscribe.rs` (modified, +7/-9)
```diff
@@ -504,15 +504,13 @@ pub(super) async fn fetch_contract_if_missing(
 ///    the body is locally present after step 4*. Announcing without a
 ///    body would tell neighbors to forward UPDATEs to a peer that
 ///    cannot validate or store them. If the body lands later via the
-///    sub-op GET's own cache path, `get/op_ctx_task.rs` calls
-///    `announce_contract_hosted` there *on first-time cache* (gated
-///    on `is_new && put_persisted`). A niche case where the contract
-///    was previously hosted then evicted, the lease expires, and the
-///    re-subscribe fetch then times out, would not re-trigger the
-///    announce via that fallback — neighbors learn we host the
-///    contract again either through the next renewal cycle's
-///    finalization (if the body has arrived by then) or via UPDATE
-///    delivery + auto-fetch.
+///    sub-op GET's own cache path, `get/op_ctx_task.rs` announces
+///    there when that cache newly hosts the contract with its state
+///    held locally, whether persisted now or already on disk (#5780).
+///    If the re-subscribe fetch times out, that fallback does not run
+///    and neighbors learn we host the contract again either through
+///    the next renewal cycle's finalization (if the body has arrived
+///    by then) or via UPDATE delivery + auto-fetch.
 /// 6. Register the contract in our local interest manager (so inbound
 ///    `ChangeInterests` for this contract get processed) and broadcast
 ///    a `ChangeInterests` so connected peers learn we became interested.
```

---

### Incident Patch 5: `99a34dd0` (2026-10-03)
**Commit Message**: fix(transport): keep the wakeup when a re-armed stream listener fires (#5751)

**File**: `crates/core/src/transport/peer_connection/streaming.rs` (modified, +160/-5)
```diff
@@ -217,6 +217,8 @@ impl StreamHandle {
             bytes_read: 0,
             auto_reclaim: false,
             listener: None,
+            #[cfg(test)]
+            before_rearmed_listener_poll: None,
         }
     }
 
@@ -266,6 +268,8 @@ impl StreamHandle {
             bytes_read: 0,
             auto_reclaim: true,
             listener: None,
+            #[cfg(test)]
+            before_rearmed_listener_poll: None,
         }
     }
 
@@ -475,6 +479,9 @@ pub struct StreamingInboundStream {
     /// Uses the buffer's `event_listener::Event` which is fired by every
     /// `buffer.insert()` — independent of which handle called `push_fragment`.
     listener: Option<Pin<Box<EventListener>>>,
+    /// Inject an arrival after the re-armed listener's buffer check, before its poll.
+    #[cfg(test)]
+    before_rearmed_listener_poll: Option<Box<dyn FnOnce() + Send + Sync>>,
 }
 
 impl StreamingInboundStream {
@@ -616,7 +623,7 @@ impl Stream for StreamingInboundStream {
         // (set above), but we use if-let to satisfy the no-unwrap rule.
         if let Some(listener) = self.listener.as_mut() {
             match listener.as_mut().poll(cx) {
-                Poll::Ready(()) => {
+                Poll::Ready(()) => loop {
                     // Notified — clear listener and re-check buffer inline
                     // (avoids wake_by_ref spin-loop).
                     self.listener = None;
@@ -637,14 +644,21 @@ impl Stream for StreamingInboundStream {
                         self.bytes_read += data.len() as u64;
                         return Poll::Ready(Some(Ok(data)));
                     }
+                    #[cfg(test)]
+                    if let Some(hook) = self.before_rearmed_listener_poll.take() {
+                        hook();
+                    }
                     if let Some(new_listener) = self.listener.as_mut() {
                         match new_listener.as_mut().poll(cx) {
-                            Poll::Ready(()) => self.listener = None,
-                            Poll::Pending => {}
+                            // Notification can arrive after the re-check but
+                            // before this first poll, without waking our task.
+                            // Consume it by looping to re-check, never by
+                            // returning Pending with no registered listener.
+                            Poll::Ready(()) => {}
+                            Poll::Pending => return Poll::Pending,
                         }
                     }
-                    Poll::Pending
-                }
+                },
                 Poll::Pending => Poll::Pending,
             }
         } else {
@@ -738,6 +752,147 @@ mod tests {
         StreamId::next()
     }
 
+    #[derive(Default)]
+    struct CountingWaker(std::sync::atomic::AtomicUsize);
+
+    impl std::task::Wake for CountingWaker {
+        fn wake(self: Arc<Self>) {
+            self.0.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
+        }
+    }
+
+    /// Drive the second-listener race without threads, timers, or an executor.
+    fn check_rearmed_listener_arrival(final_fragment: bool, auto_reclaim: bool) {
+        use super::super::streaming_buffer::FRAGMENT_PAYLOAD_SIZE;
+        use std::sync::atomic::Ordering;
+
+        let fragment_count = if final_fragment { 2 } else { 3 };
+        let handle = StreamHandle::new(
+            make_stream_id(),
+            (FRAGMENT_PAYLOAD_SIZE * fragment_count) as u64,
+        );
+        let fork = handle.fork();
+        let mut stream = if auto_reclaim {
+            fork.stream_with_reclaim()
+        } else {
+            fork.stream()
+        };
+        let counter = Arc::new(CountingWaker::default());
+        let waker = Waker::from(counter.clone());
+        let mut cx = Context::from_waker(&waker);
+        let first = Bytes::from(vec![1; FRAGMENT_PAYLOAD_SIZE]);
+        handle.push_fragment(1, first.clone()).unwrap();
+        assert_eq!(
+            Pin::new(&mut stream).poll_next(&mut cx),
+            Poll::Ready(Some(Ok(first)))
+        );
+        assert_eq!(Pin::new(&mut stream).poll_next(&mut cx), Poll::Pending);
+
+        // Wake the old listener without supplying the missing fragment #2.
+        if final_fragment {
+            // Cancellation of a different fork shares the buffer notification,
+            // but must not cancel this consumer (nor its producer).
+            handle.fork().cancel();
+        } else {
+            handle
+                .push_fragment(3, Bytes::from(vec![3; FRAGMENT_PAYLOAD_SIZE]))
+                .unwrap();
+        }
+        assert!(counter.0.swap(0, Ordering::SeqCst) > 0);
+
+        let expected = Bytes::from(vec![2; FRAGMENT_PAYLOAD_SIZE]);
+        let arriving = expected.clone();
+        let producer = handle.clone();
+        stream.before_rearmed_listener_poll = Some(Box::new(move || {
+            assert!(producer.push_fragment(2, arriving).unwrap());
+   
```

---

### Incident Patch 6: `71ce930e` (2026-10-03)
**Commit Message**: build(deps): bump the cargo-minor-and-patch group across 1 directory with 17 updates (#5776)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +167/-142)
```diff
@@ -226,7 +226,7 @@ checksum = "82f6aeea286b8eb4dd3431a1be1b59d290ace00f5bfd8e2a159bc2a05e2c1667"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 3.0.4",
+ "syn 3.0.6",
 ]
 
 [[package]]
@@ -335,7 +335,7 @@ dependencies = [
  "addr2line 0.25.1",
  "cfg-if",
  "libc",
- "miniz_oxide",
+ "miniz_oxide 0.8.9",
  "object 0.37.3",
  "rustc-demangle",
  "windows-link 0.2.1",
@@ -353,6 +353,12 @@ version = "0.22.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"
 
+[[package]]
+name = "base64"
+version = "0.23.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ac07cdecf99051d9a5238b80f35af32cdeba5b336e55d957b318b50137e18da5"
+
 [[package]]
 name = "base64ct"
 version = "1.8.3"
@@ -473,7 +479,7 @@ dependencies = [
  "serde_json",
  "serde_repr",
  "serde_urlencoded",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "tokio",
  "tokio-util",
  "tower-service",
@@ -738,19 +744,19 @@ dependencies = [
 
 [[package]]
 name = "clap"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "473c7e07f409a8d772161724aa8db6a765a2532a70f9667eeb7b49d3d02fbdca"
+checksum = "aa8876b300ab35ba921adea3dfd70157a46249b33f95c9084ae5709785478946"
 dependencies = [
  "clap_builder",
  "clap_derive",
 ]
 
 [[package]]
 name = "clap_builder"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b48fea5a88e9ae728a2dcbedbfc0e730f7d60da42e1cb049a83c9fb8b789889"
+checksum = "ec0797fb7aeb1406c84efac526901f7ec3ead2124f946b494e72879d4b54704d"
 dependencies = [
  "anstream",
  "anstyle",
@@ -760,14 +766,14 @@ dependencies = [
 
 [[package]]
 name = "clap_derive"
-version = "4.6.4"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d012d2b9d65aca7f18f4d9878a045bc17899bba951561ba5ec3c2ba1eed9a061"
+checksum = "f9c751b79415d4e559e3d1fcf128e09e720eb673a06d26cf6f392d37d75b66e0"
 dependencies = [
  "heck 0.5.0",
  "proc-macro2",
  "quote",
- "syn 3.0.4",
+ "syn 3.0.6",
 ]
 
 [[package]]
@@ -788,7 +794,7 @@ version = "0.3.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0fa961b519f0b462e3a3b4a34b64d119eeaca1d59af726fe450bbba07a9fc0a1"
 dependencies = [
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -1203,9 +1209,9 @@ dependencies = [
 
 [[package]]
 name = "crossbeam-epoch"
-version = "0.9.18"
+version = "0.9.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5b82ac4a3c2ca9c3460964f020e1402edd5753411d7737aa39c3714ad1b5420e"
+checksum = "dc74980687109a3b14c72fd458107bf0baa1da1a1a805e178d15501ba9b86d9d"
 dependencies = [
  "crossbeam-utils",
 ]
@@ -1398,36 +1404,36 @@ dependencies = [
 
 [[package]]
 name = "darling"
-version = "0.23.0"
+version = "0.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "25ae13da2f202d56bd7f91c25fba009e7717a1e4a1cc98a76d844b65ae912e9d"
+checksum = "ed17f5901b6630b993ca003def43f2f8ef4014fc13b047b57aad617ff32bc2ec"
 dependencies = [
  "darling_core",
  "darling_macro",
 ]
 
 [[package]]
 name = "darling_core"
-version = "0.23.0"
+version = "0.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "9865a50f7c335f53564bb694ef660825eb8610e0a53d3e11bf1b0d3df31e03b0"
+checksum = "6837e2cf7485aaae18f86181d2f0e9a7ed297a025e220aeabf63fdebd3a2ddff"
 dependencies = [
  "ident_case",
  "proc-macro2",
  "quote",
  "strsim",
- "syn 2.0.119",
+ "syn 3.0.6",
 ]
 
 [[package]]
 name = "darling_macro"
-version = "0.23.0"
+version = "0.24.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ac3984ec7bd6cfa798e62b4a642426a5be0e68f9401cfc2a01e3fa9ea2fcdb8d"
+checksum = "2ac7135c3ef02b2f7833bbeb1be5ba7f966dcde8a87c6b87f65a778d71a02785"
 dependencies = [
  "darling_core",
  "quote",
- "syn 2.0.119",
+ "syn 3.0.6",
 ]
 
 [[package]]
@@ -1487,7 +1493,7 @@ version = "1.0.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "10d60334b3b2e7c9d91ef8150abfb6fa4c1c39ebbcf4a81c2e346aad939fee3e"
 dependencies = [
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -1909,7 +1915,7 @@ dependencies = [
  "either",
  "freenet",
  "freenet-stdlib 0.12.1",
- "futures 0.3.32",
+ "futures 0.3.34",
  "glob",
  "hex",
  "http 1.5.0",
@@ -1921,10 +1927,10 @@ dependencies = [
  "serde_with",
  "tar",
  "tempfile",
- "thiserror 2.0.20",
+ "thiserror 2.0.21",
  "tokio",
  "tokio-tungstenite 0.27.0",
- "toml 1.1.2+spec-1.1.0",
+ "toml 1.1.3+spec-1.1.0",
  "tracing",
  "wat",
  "xz2",
@@ -1996,12 +2002,12 @@ dependencies = [
 
 [[package]]
 name = "flate2"
-version = "1.1.9"
+version = "1.1.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "843fba2746e448b37e26a819579957415c8cef339bf08564fe8b7ddbd959573c"
+checksum = "6e634e2e0ebac1ee03402
```

---

### Incident Patch 7: `baae878e` (2026-10-03)
**Commit Message**: build(deps): bump the nix group with 2 updates (#5778)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `flake.lock` (modified, +6/-6)
```diff
@@ -20,11 +20,11 @@
     },
     "nixpkgs": {
       "locked": {
-        "lastModified": 1789370336,
-        "narHash": "sha256-6RSEDHIWQtesQKWSu5qRai8L2h4KgCgMEfJHstW99G4=",
+        "lastModified": 1790238896,
+        "narHash": "sha256-ym4BG18Pu2awiJIehla1Lo9xiB2QYRcCzW3SB74gEBY=",
         "owner": "nixos",
         "repo": "nixpkgs",
-        "rev": "c7def046b9a883d46974757852106483d741586f",
+        "rev": "34ca302a9572963c02e385c056be37c85ff51b77",
         "type": "github"
       },
       "original": {
@@ -48,11 +48,11 @@
         ]
       },
       "locked": {
-        "lastModified": 1789457514,
-        "narHash": "sha256-Aggle++fTyAifBy+QBPxjM+obO5iepKW/8MDxQtgGvI=",
+        "lastModified": 1790234952,
+        "narHash": "sha256-tjQa1vDoHJir4lasZTakz/xgmsfB6SRjeQqaIbefFOk=",
         "owner": "oxalica",
         "repo": "rust-overlay",
-        "rev": "89e99bf0778a8f2cd18c9360c3f19c1ee47fc739",
+        "rev": "ed34466c59b766481248959a21a6e46cf0c60468",
         "type": "github"
       },
       "original": {
```

---

### Incident Patch 8: `aef81bed` (2026-10-03)
**Commit Message**: build(deps-dev): bump the npm-minor-and-patch group in /crates/core/src/server with 2 updates (#5777)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `crates/core/src/server/package-lock.json` (modified, +8/-8)
```diff
@@ -9,9 +9,9 @@
       "version": "0.0.0",
       "devDependencies": {
         "@eslint/js": "^10.0.1",
-        "eslint": "^10.10.0",
+        "eslint": "^10.11.0",
         "globals": "^17.12.0",
-        "prettier": "^3.9.6"
+        "prettier": "^3.9.9"
       },
       "engines": {
         "node": ">=20"
@@ -411,9 +411,9 @@
       }
     },
     "node_modules/eslint": {
-      "version": "10.10.0",
-      "resolved": "https://registry.npmjs.org/eslint/-/eslint-10.10.0.tgz",
-      "integrity": "sha512-NPXn6r5zl4uET1DAVPaOwzX3rut4c0wcmw3dWJAfOsTM5+TogXo0DDjz8pwm/hL8cyVNpHqeK4JpN0NjnyFFNw==",
+      "version": "10.11.0",
+      "resolved": "https://registry.npmjs.org/eslint/-/eslint-10.11.0.tgz",
+      "integrity": "sha512-P7a6UEEqb9G95MYAtqkmsTbVXIYyzIfl6NGOIJk162PaahFxFyeGcrlXYFSiagECg4sEm8IseJdZBKR3rx6MsQ==",
       "dev": true,
       "license": "MIT",
       "workspaces": [
@@ -893,9 +893,9 @@
       }
     },
     "node_modules/prettier": {
-      "version": "3.9.6",
-      "resolved": "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
-      "integrity": "sha512-OpN0zzVdiaiAhxpuuj5efpIS4sY9j7bY6uR5mnj5yPzGkdkjNKSJeUThPb60Jw29QuAZgA4o+/iB49kFiaBX6g==",
+      "version": "3.9.9",
+      "resolved": "https://registry.npmjs.org/prettier/-/prettier-3.9.9.tgz",
+      "integrity": "sha512-Z/CJHIkdujO/OtN7nXUii0Rf3VT5SRuhjBA82Xvu2XhBUgX3nhP67T0LHceBdQLex7OOFGTox+Q5Yg8Jk2Qivg==",
       "dev": true,
       "license": "MIT",
       "bin": {
```

**File**: `crates/core/src/server/package.json` (modified, +2/-2)
```diff
@@ -15,8 +15,8 @@
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
-    "eslint": "^10.10.0",
+    "eslint": "^10.11.0",
     "globals": "^17.12.0",
-    "prettier": "^3.9.6"
+    "prettier": "^3.9.9"
   }
 }
```

---

### Incident Patch 9: `c68a8049` (2026-10-03)
**Commit Message**: build(deps): bump docker/setup-qemu-action from 3 to 4 (#5775)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/docker-publish.yml` (modified, +3/-3)
```diff
@@ -65,7 +65,7 @@ jobs:
       - name: Test the update supervisor
         run: docker/freenet-node/test-entrypoint.sh
 
-      - uses: docker/setup-qemu-action@v3
+      - uses: docker/setup-qemu-action@v4
       - uses: docker/setup-buildx-action@v4
 
       - name: Build both architectures without pushing
@@ -310,7 +310,7 @@ jobs:
         with:
           ref: ${{ github.event.release.tag_name || inputs.tag }}
 
-      - uses: docker/setup-qemu-action@v3
+      - uses: docker/setup-qemu-action@v4
       - uses: docker/setup-buildx-action@v4
 
       - uses: docker/login-action@v4
@@ -382,7 +382,7 @@ jobs:
     runs-on: ubuntu-latest
     timeout-minutes: 20
     steps:
-      - uses: docker/setup-qemu-action@v3
+      - uses: docker/setup-qemu-action@v4
 
       # Authenticated on purpose. This step's job is "does the published image
       # run on both architectures", and pulling anonymously conflates that with
```

---

### Incident Patch 10: `a05a6119` (2026-10-03)
**Commit Message**: build(deps-dev): bump brace-expansion from 5.0.9 to 5.0.12 in /crates/core/src/server (#5768)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `crates/core/src/server/package-lock.json` (modified, +3/-3)
```diff
@@ -331,9 +331,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 11: `9e75df05` (2026-10-03)
**Commit Message**: build(deps-dev): bump webpack-dev-middleware from 8.0.4 to 8.3.0 in /tests/test-app-1 (#5767)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `tests/test-app-1/package-lock.json` (modified, +66/-68)
```diff
@@ -927,14 +927,14 @@
       }
     },
     "node_modules/@jsonjoy.com/fs-core": {
-      "version": "4.64.0",
-      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-core/-/fs-core-4.64.0.tgz",
-      "integrity": "sha512-zs2TAq7Six5jgMuoMNjpspAvOP3mhtgq/k1UyQodEzCtQi/N83y2/y+zcvnZSGp/Rxq96DBN+bValOBQAyn/ew==",
+      "version": "4.80.0",
+      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-core/-/fs-core-4.80.0.tgz",
+      "integrity": "sha512-qMKWshnyjbyhm+NbzqGE3w5y1mckFFEMj0aDPU2/JBNh1BzIjVy9esq9lBmRnNVmhMEkxwDzLZ8Gqh5G1P5Dag==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "@jsonjoy.com/fs-node-builtins": "4.64.0",
-        "@jsonjoy.com/fs-node-utils": "4.64.0",
+        "@jsonjoy.com/fs-node-builtins": "4.80.0",
+        "@jsonjoy.com/fs-node-utils": "4.80.0",
         "thingies": "^2.5.0"
       },
       "engines": {
@@ -949,15 +949,15 @@
       }
     },
     "node_modules/@jsonjoy.com/fs-fsa": {
-      "version": "4.64.0",
-      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-fsa/-/fs-fsa-4.64.0.tgz",
-      "integrity": "sha512-nMWOVbkLFyEgmXZih3wyvxA9XpgyyqyfrINMHvEFqhi7uqfRl7c9ERJt6yX7vgMPrB9Uo+OJO+Spa0cFzPD01w==",
+      "version": "4.80.0",
+      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-fsa/-/fs-fsa-4.80.0.tgz",
+      "integrity": "sha512-ZBEKl7J6dbkRCfmrFV48Re211A/FHqniTUhsWCsaRteNSOqMgkX3qF1UreVgwB9oSPm81JLAwhIi6Lb/NH/PoA==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "@jsonjoy.com/fs-core": "4.64.0",
-        "@jsonjoy.com/fs-node-builtins": "4.64.0",
-        "@jsonjoy.com/fs-node-utils": "4.64.0",
+        "@jsonjoy.com/fs-core": "4.80.0",
+        "@jsonjoy.com/fs-node-builtins": "4.80.0",
+        "@jsonjoy.com/fs-node-utils": "4.80.0",
         "thingies": "^2.5.0"
       },
       "engines": {
@@ -972,18 +972,18 @@
       }
     },
     "node_modules/@jsonjoy.com/fs-node": {
-      "version": "4.64.0",
-      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node/-/fs-node-4.64.0.tgz",
-      "integrity": "sha512-dO+NNkODbUli4uV42bcNrrLvq5rE7SNpdZ5TNd0dtbLsAaNK3MDiIC9lUi+brboGoIjW6vd2fB1qao60nrk5xA==",
+      "version": "4.80.0",
+      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node/-/fs-node-4.80.0.tgz",
+      "integrity": "sha512-yiBlUfkMMRFFGy8CD/h2zd5rPnrM6bjlF+nx2LRAxNV6hOSiuObQIUEE7m7y2VTMisjxCRtzINH94bFGySWL7g==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "@jsonjoy.com/fs-core": "4.64.0",
-        "@jsonjoy.com/fs-node-builtins": "4.64.0",
-        "@jsonjoy.com/fs-node-utils": "4.64.0",
-        "@jsonjoy.com/fs-print": "4.64.0",
-        "@jsonjoy.com/fs-snapshot": "4.64.0",
-        "glob-to-regex.js": "^1.0.0",
+        "@jsonjoy.com/fs-core": "4.80.0",
+        "@jsonjoy.com/fs-node-builtins": "4.80.0",
+        "@jsonjoy.com/fs-node-utils": "4.80.0",
+        "@jsonjoy.com/fs-print": "4.80.0",
+        "@jsonjoy.com/fs-snapshot": "4.80.0",
+        "glob-to-regex.js": "^1.3.1",
         "thingies": "^2.5.0"
       },
       "engines": {
@@ -998,9 +998,9 @@
       }
     },
     "node_modules/@jsonjoy.com/fs-node-builtins": {
-      "version": "4.64.0",
-      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node-builtins/-/fs-node-builtins-4.64.0.tgz",
-      "integrity": "sha512-/o7WRFhUWaM/fOrslwLZGnzn4RmRILykn+lAL+mNObqqRNw+CQSiij6hpCeZ+C7buhdoVo7go/OYqzaSUfDYmA==",
+      "version": "4.80.0",
+      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node-builtins/-/fs-node-builtins-4.80.0.tgz",
+      "integrity": "sha512-OIOIhqaWiwUySFMny4epIAoviXsyMaQQ63PTc3zH+5HEOvarl5hpUmZIhp2m5+OfyKAh5ylxXnQIgew1OgJDVw==",
       "dev": true,
       "license": "Apache-2.0",
       "engines": {
@@ -1015,15 +1015,15 @@
       }
     },
     "node_modules/@jsonjoy.com/fs-node-to-fsa": {
-      "version": "4.64.0",
-      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node-to-fsa/-/fs-node-to-fsa-4.64.0.tgz",
-      "integrity": "sha512-WDD9WVs0hb7UAEKTgZW2f66WDrbj7gIIWwpP3spbLyXa0rghtUaFTB8L4gdR3ZCWwiKIsj38/CNijpVmpnuPUw==",
+      "version": "4.80.0",
+      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node-to-fsa/-/fs-node-to-fsa-4.80.0.tgz",
+      "integrity": "sha512-ljeaR5xwtX1EyRmB0wvXANUMQZ3mjKcm7z8s2N8D8SLQ04CcAGtUhHFRZQXFb9mhgFyEVMydQGQtSOFS7pcrFQ==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "@jsonjoy.com/fs-fsa": "4.64.0",
-        "@jsonjoy.com/fs-node-builtins": "4.64.0",
-        "@jsonjoy.com/fs-node-utils": "4.64.0"
+        "@jsonjoy.com/fs-fsa": "4.80.0",
+        "@jsonjoy.com/fs-node-builtins": "4.80.0",
+        "@jsonjoy.com/fs-node-utils": "4.80.0"
       },
       "engines": {
         "node": ">=10.0"
@@ -1037,14 +1037,14 @@
       }
     },
     "node_modules/@jsonjoy.com/fs-node-utils": {
-      "version": "4.64.0",
-      "resolved": "https://registry.npmjs.org/@jsonjoy.com/fs-node-utils
```

---

### Incident Patch 12: `d1185ba9` (2026-10-03)
**Commit Message**: build(deps): bump brace-expansion from 1.1.18 to 1.1.21 in /tests/test-app-1 (#5766)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `tests/test-app-1/package-lock.json` (modified, +3/-3)
```diff
@@ -2573,9 +2573,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 13: `69c60a58` (2026-10-03)
**Commit Message**: build(deps-dev): bump @babel/core from 7.23.2 to 7.29.7 in /tests/test-app-1 (#5738)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `tests/test-app-1/package-lock.json` (modified, +147/-362)
```diff
@@ -29,128 +29,48 @@
         "webpack-dev-server": "6.0.0"
       }
     },
-    "node_modules/@ampproject/remapping": {
-      "version": "2.2.1",
-      "resolved": "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.2.1.tgz",
-      "integrity": "sha512-lFMjJTrFL3j7L9yBxwYfCq2k6qqwHyzuUl/XBnif78PWTJYyL/dfowQHWE3sp6U6ZzqWiiIZnpTMO96zhkjwtg==",
-      "dev": true,
-      "dependencies": {
-        "@jridgewell/gen-mapping": "^0.3.0",
-        "@jridgewell/trace-mapping": "^0.3.9"
-      },
-      "engines": {
-        "node": ">=6.0.0"
-      }
-    },
     "node_modules/@babel/code-frame": {
-      "version": "7.22.13",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.22.13.tgz",
-      "integrity": "sha512-XktuhWlJ5g+3TJXc5upd9Ks1HutSArik6jf2eAjYFyIOf4ej3RN+184cZbzDvbPnuTJIUhPKKJE3cIsYTiAT3w==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
+      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
       "dev": true,
+      "license": "MIT",
       "dependencies": {
-        "@babel/highlight": "^7.22.13",
-        "chalk": "^2.4.2"
+        "@babel/helper-validator-identifier": "^7.29.7",
+        "js-tokens": "^4.0.0",
+        "picocolors": "^1.1.1"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
-    "node_modules/@babel/code-frame/node_modules/ansi-styles": {
-      "version": "3.2.1",
-      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-3.2.1.tgz",
-      "integrity": "sha512-VT0ZI6kZRdTh8YyJw3SMbYm/u+NqfsAxEpWO0Pf9sq8/e94WxxOpPKx9FR1FlyCtOVDNOQ+8ntlqFxiRc+r5qA==",
-      "dev": true,
-      "dependencies": {
-        "color-convert": "^1.9.0"
-      },
-      "engines": {
-        "node": ">=4"
-      }
-    },
-    "node_modules/@babel/code-frame/node_modules/chalk": {
-      "version": "2.4.2",
-      "resolved": "https://registry.npmjs.org/chalk/-/chalk-2.4.2.tgz",
-      "integrity": "sha512-Mti+f9lpJNcwF4tWV8/OrTTtF1gZi+f8FqlyAdouralcFWFQWF2+NgCHShjkCb+IFBLq9buZwE1xckQU4peSuQ==",
-      "dev": true,
-      "dependencies": {
-        "ansi-styles": "^3.2.1",
-        "escape-string-regexp": "^1.0.5",
-        "supports-color": "^5.3.0"
-      },
-      "engines": {
-        "node": ">=4"
-      }
-    },
-    "node_modules/@babel/code-frame/node_modules/color-convert": {
-      "version": "1.9.3",
-      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-1.9.3.tgz",
-      "integrity": "sha512-QfAUtd+vFdAtFQcC8CCyYt1fYWxSqAiK2cSD6zDB8N3cpsEBAvRxp9zOGg6G/SHHJYAT88/az/IuDGALsNVbGg==",
-      "dev": true,
-      "dependencies": {
-        "color-name": "1.1.3"
-      }
-    },
-    "node_modules/@babel/code-frame/node_modules/color-name": {
-      "version": "1.1.3",
-      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.3.tgz",
-      "integrity": "sha512-72fSenhMw2HZMTVHeCA9KCmpEIbzWiQsjN+BHcBbS9vr1mtt+vJjPdksIBNUmKAW8TFUDPJK5SUU3QhE9NEXDw==",
-      "dev": true
-    },
-    "node_modules/@babel/code-frame/node_modules/escape-string-regexp": {
-      "version": "1.0.5",
-      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-1.0.5.tgz",
-      "integrity": "sha512-vbRorB5FUQWvla16U8R/qgaFIya2qGzwDrNmCZuYKrbdSUMG6I1ZCGQRefkRVhuOkIGVne7BQ35DSfo1qvJqFg==",
-      "dev": true,
-      "engines": {
-        "node": ">=0.8.0"
-      }
-    },
-    "node_modules/@babel/code-frame/node_modules/has-flag": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-3.0.0.tgz",
-      "integrity": "sha512-sKJf1+ceQBr4SMkvQnBDNDtf4TXpVhVGateu0t918bl30FnbE2m4vNLX+VWe/dpjlb+HugGYzW7uQXH98HPEYw==",
-      "dev": true,
-      "engines": {
-        "node": ">=4"
-      }
-    },
-    "node_modules/@babel/code-frame/node_modules/supports-color": {
-      "version": "5.5.0",
-      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-5.5.0.tgz",
-      "integrity": "sha512-QjVjwdXIt408MIiAqCX4oUKsgU2EqAGzs2Ppkm4aQYbjm+ZEWEcW4SfFNTr4uMNZma0ey4f5lgLrkB0aX0QMow==",
-      "dev": true,
-      "dependencies": {
-        "has-flag": "^3.0.0"
-      },
-      "engines": {
-        "node": ">=4"
-      }
-    },
     "node_modules/@babel/compat-data": {
-      "version": "7.23.2",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.23.2.tgz",
-      "integrity": "sha512-0S9TQMmDHlqAZ2ITT95irXKfxN9bncq8ZCoJhun3nHL/lLUxd2NKBJYoNGWH7S0hz6fRQwWlAWn/ILM0C70KZQ==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
+      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
       "dev": true,
+      "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/core": {
-      "ve
```

---

### Incident Patch 14: `7b675c8c` (2026-09-30)
**Commit Message**: fix(release): wait for GitHub to serve the release before Gate B boots the canary (#5771)

**File**: `.github/workflows/cross-compile.yml` (modified, +25/-8)
```diff
@@ -1024,11 +1024,24 @@ jobs:
   # own. The release is already public at that point, so the job is red and
   # notifies rather than blocking; the response is to ship a fix and/or roll
   # the fleet by hand, exactly as v0.2.120/v0.2.121 required.
+  #
+  # `releases/latest` lags an un-draft by tens of seconds (v0.2.136: 52s,
+  # v0.2.140: 39s), so the canary first waits, up to CANARY_LATEST_WAIT_SECS,
+  # for GitHub to report this tag as latest before it boots the old node
+  # (#5715). Without that the node was asked about a release GitHub was not
+  # serving yet and the gate went red on healthy releases.
   # -----------------------------------------------------------------------
   auto-update-selfupdate-canary:
     name: Auto-update self-update canary (previous release -> this one)
     runs-on: ubuntu-latest
-    timeout-minutes: 20
+    # 20 -> 35 for the latest-release wait (#5715). Worst case is the previous
+    # release's download, the wait (budget plus one probe's overrun), every
+    # node attempt at CANARY_TIMEOUT_SECS with the retry sleeps, and the
+    # install. `release_canary_wiring_test.sh` computes that from the canary's
+    # own defaults and fails if this no longer holds it. A job killed by the
+    # timeout carries no classification and takes the loud path, which is safe
+    # but says nothing useful.
+    timeout-minutes: 35
     needs: attach-to-release
     if: startsWith(github.ref, 'refs/tags/v')
     permissions:
@@ -1066,7 +1079,9 @@ jobs:
 
       # Exit 75 (EX_TEMPFAIL, EXIT_UNVERIFIED_ENVIRONMENTAL in the canary) means
       # the run was environmental -- the previous release's binary could not
-      # reach GitHub from this runner, or the ports were held -- so nothing was
+      # reach GitHub from this runner, the ports were held, or the runner could
+      # not connect to GitHub while waiting for it to serve this release as
+      # latest (#5715) -- so nothing was
       # learned about the updater in either direction. The step still FAILS on
       # it: unverified is not verified, and a green job here would be the
       # vacuous pass the canary exists to remove. What the classification buys
@@ -1150,15 +1165,17 @@ jobs:
           needs.auto-update-selfupdate-canary.outputs.classification == 'environmental'
         uses: ./.github/actions/river-dev-notify
         with:
-          # Names BOTH environmental causes rather than assuming the network
-          # one. Exit 75 covers two: the previous release's binary could not
-          # reach GitHub (and neither could the runner), or every attempt lost a
-          # port race on this host. An earlier version of this message asserted
+          # Names EVERY environmental cause rather than assuming the network
+          # one. Exit 75 covers three: the previous release's binary could not
+          # reach GitHub (and neither could the runner), every attempt lost a
+          # port race on this host, or the runner could not connect to GitHub
+          # while waiting for it to report this release as latest (#5715). An
+          # earlier version of this message asserted
           # the first, so a self-hosted runner with something holding the ports
           # sent the operator after DNS. The job log's `UNVERIFIED
           # (ENVIRONMENTAL)` line says which; this says what to do, which is the
           # same either way.
-          message: "⚠️ ${{ github.ref_name }} published fine, but auto-update for it is **UNVERIFIED** — the self-update canary never reached a verdict, for an environmental reason: either the previous release's binary could not reach GitHub (and neither could the runner) or every attempt hit a port collision on the runner. The job log's `UNVERIFIED (ENVIRONMENTAL)` line says which. The run is not evidence in either direction. Nothing suggests a stranded fleet and no fleet action is indicated, but this release has NOT been shown to be reachable by auto-update: re-run the job to actually verify it. If you are seeing this on consecutive releases, stop treating it as noise — whatever it names, something is persistently stopping the gate from running, the post-publish gate is not working, and nothing has been verified since the last green run. ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
+          message: "⚠️ ${{ github.ref_name }} published fine, but auto-update for it is **UNVERIFIED** — the self-update canary never reached a verdict, for an environmental reason: the previous release's binary could not reach GitHub (and neither could the runner), every attempt hit a port collision on the runner, or the runner lost its connection to GitHub while waiting to confirm this release was being served as latest. The job log's `UNVERIFIED (ENVIRONMENTAL)` line says which. The run is not evidence in either direction. Nothing suggests a stranded fleet and no fleet action is indicated, but this release has NOT been shown to be reachable by auto-update
```

**File**: `docs/RELEASING.md` (modified, +25/-3)
```diff
@@ -980,8 +980,11 @@ curl -sS -o /dev/null -w '%{http_code}\n' -A 'freenet-release-driver' \
 ### If Gate B fails
 
 **A red Gate B is not by itself a fleet problem, and the Matrix message is not
-enough to tell.** Five distinct outcomes end in a red job; only one of them means
-a node on the previous release genuinely cannot reach this one. **Read the
+enough to tell.** Several distinct outcomes end in a red job. Only the ones that
+name a specific detection or install failure mean a node on the previous release
+genuinely cannot reach this one; the rows that say GitHub never served this
+release as latest mean no node can see it YET, and their Response column says
+whether that is a re-run or a real problem. **Read the
 `::error::` line in the job log before doing anything** — it names which.
 
 The wording below is generated from the code, so match on the quoted phrases
@@ -993,8 +996,25 @@ rather than on the shape of the alarm.
 | `UNVERIFIED (ENVIRONMENTAL): every attempt hit a port collision on this host` | 75 | ⚠️ quiet | Something else on the runner held the ports; the node never started. | Re-run the job. |
 | `UNVERIFIED: … reported it could not reach GitHub … but THIS RUNNER reached the same endpoint immediately afterwards` | 1 | 🚨 loud | The published binary consistently could not do what the runner just did. Most likely its persisted poll-budget cooldown (#5102), possibly a published fetch-side regression. **Not a stranded fleet.** | Read the node output. Re-run; if it recurs across releases it is not the runner. |
 | `UNVERIFIED: at least one attempt started the update check and never logged an outcome` | 1 | 🚨 loud | A hung updater, or the check was cut short. Genuinely unknown. | Re-run. Persisting, treat as a real fault. |
+| `GitHub never reported vX as latest within Ns: … last named '<older tag>'` | 1 | 🚨 loud | Before booting the node, Gate B waits (up to `CANARY_LATEST_WAIT_SECS`, 300s) for `releases/latest` to name this release (#5715). It never did. The node was **not started**, so this says nothing about the updater, but until GitHub serves this release as latest no node can see it. | Check the release is published, not a prerelease, and marked latest. `freenet update` by hand will not help: it reads the same endpoint. |
+| `GitHub reports a NEWER release than the one this run was asked to verify` | 1 | 🚨 loud | A newer release is already latest, usually because an old tag's workflow was re-run. Node not started. | Expected on a re-run of an old tag. Otherwise check which release is marked latest. |
+| `GitHub never reported vX as latest: … answered none of N probe(s) … with a release redirect, yet THIS RUNNER could connect to it during the wait` | 1 | 🚨 loud | The endpoint the node reads is answering, but not with a `/releases/tag/<tag>` redirect (HTTP error, rate limit, new redirect shape). Node not started. If it persists, no node can detect any release. | `curl -sI https://github.com/freenet/freenet-core/releases/latest` and look at the `Location`. |
+| `GitHub never reported vX as latest on 3 consecutive probes … the wait ended N answer(s) into a streak naming it … Of P probe(s), A named a different tag and B got no tag at all` | 1 | 🚨 loud | The budget ran out mid-streak. If P − A − B equals N, every answer naming the release was in that final streak, so GitHub began serving it only at the end. Otherwise it was served earlier and the streak kept breaking: on another tag (A, a flapping CDN) or on a failed probe (B). Node not started. | Re-run. If it recurs, GitHub is not serving the release consistently. |
+| `GitHub never reported vX as latest: … was still naming a different tag Ns into the wait (the cutoff for publication lag is 120s …)` | 1 | 🚨 loud | GitHub served another tag later than lag explains (at any point in the wait, not only last), then the probes failed. The stale answer is the finding. Node not started. | As for the "last named '<older tag>'" row above. |
+| `GitHub never reported vX as latest: … last named '<tag>', then answered none of the last N probe(s) with a release redirect … while THIS RUNNER could still connect` | 1 | 🚨 loud | GitHub answered, then the endpoint stopped answering with a redirect while the runner could still connect: the endpoint went bad. Node not started. | Check the endpoint by hand as above. |
+| `UNVERIFIED (ENVIRONMENTAL): … last named '<tag>', then this runner lost its connection to it` | 75 | ⚠️ quiet | GitHub answered, then the runner's network went for the rest of the wait, and no answer naming another tag came later than 120s in (which would have been the loud row above). Node not started, nothing learned. | Re-run the job. |
+| `UNVERIFIED (ENVIRONMENTAL): no probe of … releases/latest produced a release tag … and after every one of them this runner also failed to connect to it` | 75 | ⚠️ quiet | The runner could not connect to GitHub after any probe of the wait. Node not started, nothing learned. | Re-run the job. |
 |
```

**File**: `scripts/auto-update-canary.sh` (modified, +209/-7)
```diff
@@ -269,8 +269,10 @@ EXIT_CODE_ALREADY_RUNNING=43
 # reusing it here would make "the canary exited 43" mean either "another process
 # held the port" or "the node started fine and GitHub was unreachable" --
 # indistinguishable at the one moment someone is reading it under time pressure,
-# on a release. The port collision is one of the two things that produce a 75;
-# it is not what 75 means.
+# on a release. The port collision is one of the three things that produce a
+# 75 (with the node's corroborated fetch failure, and the runner failing to
+# connect while waiting for GitHub to serve the release, #5715); it is not what
+# 75 means.
 #
 # The job still goes RED on a 75. Unverified is not verified, and reporting green
 # on a run that proved nothing is the vacuous pass this whole file exists to
@@ -367,6 +369,27 @@ CANARY_RETRY_SLEEP="${CANARY_RETRY_SLEEP:-20}"
 # (#5236).
 CANARY_OUTCOME_WAIT_SECS="$(sanitise_positive_int "${CANARY_OUTCOME_WAIT_SECS:-20}" 20)"
 
+# Gate B only: how long to wait for GitHub to report the just-published release
+# as latest before booting the previous release's node (#5715), how often to
+# ask, and how many CONSECUTIVE answers naming it are required.
+#
+# `releases/latest` is eventually consistent after an un-draft. Gate B starts
+# seconds after publication, and twice the node's one startup check read the
+# PREVIOUS tag: 52s after publication on v0.2.136, 39s on v0.2.140. The gate
+# then failed a healthy release with "compared against the WRONG release".
+#
+# Consecutive, not first-sight, because the answer comes from a CDN: one fresh
+# edge answering does not mean the next request (the node's) lands on a fresh
+# one. Three answers 5s apart cost ~10s on the happy path.
+#
+# 300s is ~6x the worst lag seen so far. Gate B's `timeout-minutes` in
+# cross-compile.yml has to hold this on top of the node attempts;
+# `release_canary_wiring_test.sh` computes that from these defaults and goes
+# red if the job no longer fits.
+CANARY_LATEST_WAIT_SECS="$(sanitise_positive_int "${CANARY_LATEST_WAIT_SECS:-300}" 300)"
+CANARY_LATEST_POLL_SECS="$(sanitise_positive_int "${CANARY_LATEST_POLL_SECS:-5}" 5)"
+CANARY_LATEST_CONFIRMATIONS="$(sanitise_positive_int "${CANARY_LATEST_CONFIRMATIONS:-3}" 3)"
+
 log()  { printf '%s\n' "$*"; }
 fail() { printf '::error::%s\n' "$*" >&2; }
 # An UNVERIFIED result, not a detected fault. Deliberately not `::error::`:
@@ -1205,7 +1228,14 @@ resolve_expected_latest() {
   # NODE's verdict and not of one curl. `--retry-all-errors` because the
   # interesting failures (connection reset, DNS blip) are not HTTP statuses,
   # which is all bare `--retry` covers.
-  url="$(curl -fsS --max-time 30 --retry 2 --retry-all-errors \
+  #
+  # `--retry-max-time 90` bounds the retries in wall time. curl honours a 429's
+  # `Retry-After`, so without it one probe could sleep past the job's timeout
+  # -- and Gate B's latest-release wait calls this every few seconds (#5715).
+  # Gate A shares this call: a 429 asking for more than ~90s now fails its
+  # lookup (loud, release stays a draft) instead of waiting it out. Bounded and
+  # visible, where the unbounded wait could hit Gate A's step timeout instead.
+  url="$(curl -fsS --max-time 30 --retry 2 --retry-all-errors --retry-max-time 90 \
     -o /dev/null -w '%{redirect_url}' \
     "$RELEASES_LATEST_URL" 2>/dev/null)" || return 1
   case "$url" in
@@ -1216,6 +1246,164 @@ resolve_expected_latest() {
   normalise_release_tag "$tag"
 }
 
+# The wait's clock, in whole seconds. A function so the tests can substitute a
+# fake one: bash's `SECONDS` ticks on real second boundaries however the loop's
+# `sleep` is stubbed, and under load those ticks changed which branch a test
+# ended in (10 of 120 parallel suite runs, round-4 review).
+canary_now() { printf '%s' "$SECONDS"; }
+
+# How long a stale answer can still be publication lag: 2x the worst measured
+# (52s, v0.2.136). An OLDER tag served after this -- at ANY point, not only as
+# the last answer -- is itself a finding, and a network drop afterwards must
+# not wash it out into the quiet path. The clock starts at the WAIT, not at
+# publication, which errs toward quiet: on a re-run hours after publishing, an
+# older tag in the first two minutes followed by an outage still reads as
+# possible lag.
+LATEST_PLAUSIBLE_LAG_SECS=120
+
+# wait_for_release_to_be_latest <expected-version>
+#
+# Gate B only (#5715). Polls the endpoint the node's updater uses
+# (RELEASES_LATEST_URL, via `resolve_expected_latest`, so the same URL and the
+# same tag normalisation) until it names <expected-version> on
+# CANARY_LATEST_CONFIRMATIONS consecutive probes, or CANARY_LATEST_WAIT_SECS
+# runs out.
+#
+# THIS IS A PRECONDITION, NOT A VERDICT. It decides only WHEN the node is
+# booted. Everything that judges the updater -- the two-sided log assertion,
+# the positive-equality check, the decision to update, exit 42, the install,
+# the final version -- runs afterwards exactly
```

**File**: `scripts/auto-update-canary_lifecycle_test.sh` (modified, +5/-0)
```diff
@@ -672,6 +672,11 @@ boot_count_for() {
     (
         curl() { :; }
         tar()  { :; }
+        # The #5715 latest-release wait runs before the first boot. With `curl`
+        # a no-op it would never see an answer, so answer it: the boot count is
+        # the subject here, not the wait.
+        CANARY_LATEST_CONFIRMATIONS=1
+        resolve_expected_latest() { printf '0.2.122'; }
         cmd_selfupdate 0.2.121 0.2.122 >/dev/null 2>&1
     )
     grep -c x "$counter" 2>/dev/null || echo 0
```

**File**: `scripts/auto-update-canary_test.sh` (modified, +259/-0)
```diff
@@ -856,6 +856,19 @@ gate_b_case() {
         curl() { :; }
         tar()  { :; }
         run_node_until_check() { run_node_until_check_stub "$@"; }
+        # The #5715 latest-release wait. `curl` is a no-op above, so without
+        # this stub the real `resolve_expected_latest` never answers and every
+        # case would end in the wait instead of reaching the node. One
+        # confirmation, and a 1s budget, so a case that makes GitHub stale or
+        # silent (GATE_B_LATEST) fails fast; the wait's own loop has its own
+        # cases further down.
+        CANARY_LATEST_CONFIRMATIONS=1
+        CANARY_LATEST_WAIT_SECS=1
+        CANARY_LATEST_POLL_SECS=1
+        resolve_expected_latest() {
+            [[ "${GATE_B_LATEST:-0.2.122}" != FAIL ]] || return 1
+            printf '%s' "${GATE_B_LATEST:-0.2.122}"
+        }
         if [[ "$reachable" == yes ]]; then
             runner_can_reach_github() { return 0; }
         else
@@ -970,6 +983,252 @@ gate_b_case "the previous release simply stayed put -> loud, named as such" 1 1
 gate_b_case "the previous release refused via the #4073 local gate -> named as THAT" 1 1 yes \
     "REFUSED it as locally blocked (#4073" "0:SEEN_REFUSED_4073" "0:SEEN_REFUSED_4073"
 
+# --- Gate B waits for GitHub to serve the release before asking the node ----
+# #5715. Gate B used to boot the previous release's node seconds after the
+# un-draft, while `releases/latest` still named the PREVIOUS tag (52s lag on
+# v0.2.136, 39s on v0.2.140). The node read the stale tag, stayed put, and a
+# healthy release failed "compared against the WRONG release".
+#
+# Two properties, both behavioural:
+#   1. The wait is a PRECONDITION: if GitHub never serves the release, the node
+#      is never booted (0 attempts) and the message says GitHub, not the node.
+#   2. It is NOT a verdict: once GitHub serves the release, a node that still
+#      fails -- stale read, stayed put, #5221 -- fails exactly as before, and is
+#      not retried into a pass.
+
+# The exact v0.2.140 log shape: the previous release saw its OWN version as
+# latest and stayed put.
+# shellcheck disable=SC2034
+SEEN_STALE='2026-08-08T02:00:00.000000Z  INFO freenet: Startup update check against GitHub current="0.2.121" jitter_secs=7
+2026-08-08T02:00:00.300000Z  INFO freenet::commands::auto_update: Startup update check: GitHub reports latest release latest=0.2.121
+2026-08-08T02:00:00.412000Z  INFO freenet: Startup update check complete: staying on the current version current="0.2.121"'
+
+GATE_B_LATEST=0.2.121 gate_b_case "GitHub never serves the release -> loud, node never booted" 1 0 yes \
+    "GitHub never reported v0.2.122 as latest within " "0:SEEN_OK" "0:SEEN_OK"
+GATE_B_LATEST=0.2.121 gate_b_case "...and it names what GitHub DID serve" 1 0 yes \
+    "last named '0.2.121'" "0:SEEN_OK" "0:SEEN_OK"
+GATE_B_LATEST=FAIL gate_b_case "no tag from GitHub and the runner cannot connect -> 75, node never booted" 75 0 no \
+    "after every one of them this runner also failed to connect to it" "0:SEEN_OK" "0:SEEN_OK"
+# The same non-answer with the runner ONLINE is not environmental: a 403, a 429
+# or a new redirect shape all look like "no tag" to resolve_expected_latest, and
+# the node reads the same 302. Quiet here is the direction that hides things.
+GATE_B_LATEST=FAIL gate_b_case "no tag from GitHub but the runner CAN connect -> loud, node never booted" 1 0 yes \
+    "yet THIS RUNNER could connect to it during the wait" "0:SEEN_OK" "0:SEEN_OK"
+# Property 2. GitHub serves 0.2.122 (the default stub), the node still reads
+# 0.2.121 and stays put: a CDN flap after the wait, or a genuinely broken
+# updater. Either way it is a real failure and is never retried -- two specs,
+# one consumed. (v0.2.121 predates the observed-latest marker, so what catches
+# it here is the decision check; the equality check is exercised on the
+# `assert_detection_healthy` fixtures above.)
+gate_b_case "GitHub serves the release but the node stays on a stale tag -> still loud, not retried" 1 1 yes \
+    "did NOT decide to update to v0.2.122" "0:SEEN_STALE" "0:SEEN_STALE"
+
+# The wait's DEFAULTS, read in a clean environment. Every case above overrides
+# them, so a default edited to 30s or 1 confirmation left the suite green -- and
+# either one quietly brings #5715 back. Pinned as relations to the measured lag
+# (52s on v0.2.136, the worst seen) rather than as copies of the numbers, so a
+# deliberate retune within reason does not need this file touched.
+# shellcheck disable=SC2016,SC2031  # the inner script expands in the child, on purpose
+read -r _lw _lc <<<"$(env -i PATH="$PATH" HOME="${HOME:-/tmp}" bash -c '
+    source "$1" >/dev/null 2>&1 || exit 1
+    echo "$CANARY_LATEST_WAIT_SECS $CANARY_LATEST_CONFIRMATIONS"' _ "$CANARY_SH")"
+if [[ -z "${_lc:-}" ]]; then
+    echo "FAIL - could not read the latest-release wait defaults from $(basename "$CANARY_SH")" >&2
+    FAILURES=$((FAILURES + 1))
+elif [[ "$_lw" -lt 12
```

**File**: `scripts/release_canary_wiring_test.sh` (modified, +61/-0)
```diff
@@ -2714,6 +2714,67 @@ else
     fi
 fi
 
+# --- 6f. Gate B's job timeout still holds the canary's worst case ----------
+# #5715 added a wait for GitHub to serve the release before the node boots, on
+# top of the node attempts, and raised `timeout-minutes` to hold both. The two
+# live in different files and change for different reasons, so nothing kept
+# them in step. A job killed by its timeout carries no classification and
+# reports only "cancelled" -- a red release with no diagnosis.
+#
+# The budgets come from the canary's OWN defaults, sourced in a clean
+# environment so an exported CANARY_* in the caller cannot skew them. The
+# remaining terms are allowances. Only the first three are hard curl bounds in
+# auto-update-canary.sh; the last two are ESTIMATES, so this is a sanity bound
+# with margin, not a proof that the job can never time out:
+#   300  previous-release download (curl --max-time 300)
+#   OVERRUN of the latest-release wait past its budget. The deadline is
+#   checked between probes, so slow probes inside the budget are paid for by
+#   the budget itself; only the LAST iteration can run past it. That is the
+#   poll sleep (read from the defaults) plus:
+#   120  one probe: a retry may START just inside --retry-max-time 90 and then
+#        run its full --max-time 30
+#    30  the connect check that follows a failed probe (curl --max-time 30)
+#    30  the runner reachability probe after the node attempts (same bound)
+#   300  `freenet update` downloading and installing the new release. Estimate:
+#        update.rs bounds a STALLED transfer (30s idle), not a slow one.
+#    60  checkout, previous-release lookup, runner overhead. Estimate.
+# shellcheck disable=SC2016  # the inner script expands in the child, on purpose
+canary_defaults="$(env -i PATH="$PATH" HOME="${HOME:-/tmp}" bash -c '
+    source "$1" >/dev/null 2>&1 || exit 1
+    echo "$CANARY_LATEST_WAIT_SECS $CANARY_LATEST_POLL_SECS $CANARY_ATTEMPTS $CANARY_TIMEOUT_SECS $CANARY_RETRY_SLEEP"
+' _ "$SCRIPT_DIR/auto-update-canary.sh")"
+gate_b_timeout_min="$(printf '%s\n' "$selfupdate_block" \
+    | sed -n 's/^    timeout-minutes:[[:space:]]*\([0-9]\{1,\}\).*/\1/p' | head -1)"
+read -r _wait _poll _attempts _timeout _sleep <<<"$canary_defaults"
+if [[ -z "$gate_b_timeout_min" || -z "${_sleep:-}" ]]; then
+    fail "could not read Gate B's timeout-minutes or the canary's default budgets" \
+        "timeout-minutes='${gate_b_timeout_min}' defaults='${canary_defaults}'" \
+        "Without both, the check below cannot say whether the job can finish."
+else
+    _worst=$(( 300 + _wait + _poll + 120 + 30 + _attempts * _timeout + (_attempts - 1) * _sleep + 30 + 300 + 60 ))
+    if [[ $(( gate_b_timeout_min * 60 )) -ge "$_worst" ]]; then
+        pass "Gate B's timeout-minutes ($gate_b_timeout_min) holds the canary's worst case (${_worst}s)"
+    else
+        fail "Gate B's timeout-minutes ($gate_b_timeout_min = $(( gate_b_timeout_min * 60 ))s) is below the canary's worst case (${_worst}s)" \
+            "wait=${_wait}s poll=${_poll}s attempts=${_attempts} x ${_timeout}s retry-sleep=${_sleep}s, plus fixed allowances." \
+            "Raise timeout-minutes, or shrink the budgets in auto-update-canary.sh."
+    fi
+fi
+# The check above reads the SCRIPT's defaults. A CANARY_* override set in the
+# workflow would bypass it silently, so refuse one outright: change the default
+# in auto-update-canary.sh instead, where this check can see it. Catches a step
+# or job `env:` key and an inline or `export` assignment in `run:`. A
+# workflow-level `env:` sits outside this job's block and is not seen.
+# A here-string, not `printf | grep -q`: under pipefail that form reads a
+# present match as absent (SIGPIPE; see bug-prevention-patterns.md).
+if grep -qE '^[[:space:]]+CANARY_[A-Z_]+:|CANARY_[A-Z_]+=' <<<"$selfupdate_block"; then
+    fail "Gate B's job sets a CANARY_* variable in cross-compile.yml" \
+        "The timeout check above computes the worst case from auto-update-canary.sh's" \
+        "defaults and cannot see a workflow override. Change the default in the script."
+else
+    pass "Gate B's job does not override the canary's budgets in the workflow"
+fi
+
 # --- 7. Gate B's job still exists -------------------------------------------
 # The notify job's clauses are only meaningful if the job they name is real.
 if grep -qE '^  auto-update-selfupdate-canary:[[:space:]]*$' "$WF"; then
```

---

### Incident Patch 15: `22a677eb` (2026-09-30)
**Commit Message**: fix(dashboard): stop styling normal states as alarms (#5769)

**File**: `crates/core/src/node/network_status.rs` (modified, +421/-22)
```diff
@@ -330,6 +330,31 @@ pub struct NetworkStatus {
     pub gateway_addresses: HashSet<SocketAddr>,
     /// Active peer connections.
     pub connected_peers: Vec<ConnectedPeer>,
+    /// When the current spell without any peer-to-peer connection began, as
+    /// far as the gateway-only warning is concerned. Set when the node first
+    /// becomes gateway-only (connected, every connection a gateway); cleared
+    /// when it gains a peer-to-peer connection.
+    ///
+    /// Maintained by [`NetworkStatus::refresh_gateway_only_since`], which
+    /// every mutation of `connected_peers` must call. Kept as its own
+    /// timestamp because no property of the current connections can stand in
+    /// for it: the age of the oldest connection is too old when a long-lived
+    /// gateway link outlives the last peer, and too young when a gateway link
+    /// is re-established.
+    ///
+    /// It SURVIVES a drop to zero connections, because a real reconnect is a
+    /// disconnect followed by a connect: clearing it there would let a
+    /// firewalled node whose one gateway link flaps stay "still joining"
+    /// forever. It is restarted only if the node then stays disconnected for
+    /// longer than the grace itself (see [`Self::gateway_only_outage_since`]),
+    /// so a node that has been offline for a long stretch is treated as
+    /// joining afresh. (Time spent suspended does not count: `Instant` is a
+    /// monotonic clock that stops during sleep, so what is measured is the
+    /// disconnected time while awake.)
+    pub gateway_only_since: Option<Instant>,
+    /// When the node dropped to zero connections while
+    /// [`Self::gateway_only_since`] was set. `None` while connected.
+    pub gateway_only_outage_since: Option<Instant>,
     /// Freenet version string.
     pub version: String,
     /// This node's ring location.
@@ -938,6 +963,8 @@ pub fn init(listening_port: u16, gateway_addrs: HashSet<SocketAddr>, version: St
         started_at: Instant::now(),
         gateway_addresses: gateway_addrs,
         connected_peers: Vec::new(),
+        gateway_only_since: None,
+        gateway_only_outage_since: None,
         version,
         own_location: None,
         external_address: None,
@@ -1006,6 +1033,33 @@ pub fn record_gateway_failure(address: SocketAddr, reason: FailureReason) {
     }
 }
 
+impl NetworkStatus {
+    /// Bring [`Self::gateway_only_since`] in line with `connected_peers`.
+    /// Call after every change to that list.
+    fn refresh_gateway_only_since(&mut self, now: Instant) {
+        if self.connected_peers.iter().any(|p| !p.is_gateway) {
+            // A peer-to-peer connection: not gateway-only, nothing to time.
+            self.gateway_only_since = None;
+            self.gateway_only_outage_since = None;
+        } else if self.connected_peers.is_empty() {
+            // Disconnected. Keep the anchor and note when the outage began.
+            if self.gateway_only_since.is_some() && self.gateway_only_outage_since.is_none() {
+                self.gateway_only_outage_since = Some(now);
+            }
+        } else {
+            // Gateway-only. A long outage in between starts the grace over; a
+            // short one (a reconnect) does not.
+            let long_outage = self.gateway_only_outage_since.is_some_and(|since| {
+                now.saturating_duration_since(since).as_secs() >= GATEWAY_ONLY_GRACE_SECS
+            });
+            if self.gateway_only_since.is_none() || long_outage {
+                self.gateway_only_since = Some(now);
+            }
+            self.gateway_only_outage_since = None;
+        }
+    }
+}
+
 /// Record a successful peer connection.
 pub fn record_peer_connected(
     addr: SocketAddr,
@@ -1024,6 +1078,7 @@ pub fn record_peer_connected(
                 connected_since: Instant::now(),
                 peer_key_location,
             });
+            s.refresh_gateway_only_since(Instant::now());
             s.gateway_failures.clear();
         }
     }
@@ -1034,6 +1089,7 @@ pub fn record_peer_disconnected(addr: SocketAddr) {
     if let Some(status) = NETWORK_STATUS.get() {
         if let Ok(mut s) = status.write() {
             s.connected_peers.retain(|p| p.address != addr);
+            s.refresh_gateway_only_since(Instant::now());
         }
     }
     // Free the per-peer metrics slot so the bounded table doesn't accumulate
@@ -1775,8 +1831,14 @@ pub struct NetworkStatusSnapshot {
     pub contracts: Vec<ContractSnapshot>,
     pub op_stats: OpStatsSnapshot,
     pub nat_stats: NatStatsSnapshot,
-    /// True if all connections are to gateways (no peer-to-peer connections).
-    pub gateway_only: bool,
+    /// True if every connection is to a gateway (no peer-to-peer connections)
+    /// AND that has held for longer than [`GATEWAY_ONLY_GRACE_SECS`].
+    ///
+    /// The raw "all my peers are gateways" fact is deliberately not exposed:
+    /// it is true of every node for a while after it joi
```

**File**: `crates/core/src/server/home_page.rs` (modified, +496/-9)
```diff
@@ -257,7 +257,7 @@ mod tests {
             contracts: Vec::new(),
             op_stats: OpStatsSnapshot::default(),
             nat_stats: NatStatsSnapshot::default(),
-            gateway_only: false,
+            gateway_only_persisting: false,
             bytes_uploaded: 0,
             bytes_downloaded: 0,
             health: HealthLevel::Connecting,
@@ -598,7 +598,7 @@ mod tests {
         // Degraded
         let mut snap = base_snapshot();
         snap.health = HealthLevel::Degraded;
-        snap.gateway_only = true;
+        snap.gateway_only_persisting = true;
         snap.open_connections = 1;
         let html = build_status_card(&Some(snap));
         assert!(html.contains("health-degraded"), "degraded banner missing");
@@ -2641,10 +2641,13 @@ mod tests {
             "the state tooltip must name the operator override and the disk-budget \
              floor, not just the RAM-scaled default — got:\n{html}"
         );
-        // Non-zero recently-read evictions are the miscalibration alarm: colored.
+        // A non-zero "evicted w/ demand" count is NOT coloured. It is a
+        // lifetime counter that any node running at its ceiling accumulates,
+        // so colouring it on `> 0` kept the tile red on a healthy peer. (This
+        // fixture has a non-zero count; the assertion used to demand red.)
         assert!(
-            html.contains("var(--danger"),
-            "recently-read eviction count should be highlighted — got:\n{html}"
+            !html.contains("var(--danger") && !html.contains("var(--warn"),
+            "a lifetime eviction count must not be styled as an alarm — got:\n{html}"
         );
         // The next-to-evict badge attaches to the first eligible row.
         let victim_idx = html.find("VICTIM_FULL").expect("victim row present");
@@ -3112,11 +3115,315 @@ mod tests {
             html.contains("99 of 100"),
             "the binding axis detail must show its own units — got:\n{html}"
         );
-        // At 99% it must be flagged, not left in the same muted grey as an
-        // axis with room to spare.
+        // Naming it is the whole signal. It is NOT coloured: a slot ceiling
+        // is a cache ceiling and 99% is where a busy node is supposed to sit
+        // (this test used to assert red here, which is the false alarm
+        // `hosting_card_full_cache_axis_is_not_an_alarm` now pins against).
+        let strips = binding_strips(&html);
         assert!(
-            html.contains("var(--danger"),
-            "a near-full binding axis must be coloured — got:\n{html}"
+            !strips.contains("var(--danger") && !strips.contains("var(--warn"),
+            "a nearly-full cache axis is normal and must not be coloured — got:\n{strips}"
+        );
+    }
+
+    /// The "Closest limit" strips only, so a colour assertion cannot be
+    /// satisfied (or tripped) by some other tile on the card.
+    fn binding_strips(html: &str) -> &str {
+        let start = html
+            .find(r#"<div class="hz-binding""#)
+            .expect("the card must render a closest-limit strip");
+        let len = html[start..]
+            .find(r#"<div class="g-verdict-row">"#)
+            .expect("the tiles follow the strip");
+        &html[start..start + len]
+    }
+
+    /// A full cache is the steady state, not an alarm.
+    ///
+    /// Reported from a live peer: "Closest limit: contract slots — 508 of 508
+    /// (100%)" over a solid red bar. Nothing was wrong. A cache is supposed to
+    /// be full: the sweep trims back to the budget and stops, so a busy node
+    /// sits at or around N of N for as long as it stays busy. The strip
+    /// coloured purely on utilisation and so was red on every peer doing the
+    /// most useful work. Same for contract state, which nova's own peer showed
+    /// at "1023.9 MB of 1.0 GB (100%)".
+    #[test]
+    fn hosting_card_full_cache_axis_is_not_an_alarm() {
+        use crate::node::network_status::HostingSnapshot;
+        for (label, hosting) in [
+            (
+                "slots exactly full",
+                HostingSnapshot {
+                    budget_bytes: 1000,
+                    used_bytes: 100,
+                    contract_count: 508,
+                    contract_slot_budget: 508,
+                    contracts: vec![mk_hosted_entry("A", true)],
+                    ..Default::default()
+                },
+            ),
+            (
+                "state a hair under full",
+                HostingSnapshot {
+                    budget_bytes: 1_000_000,
+                    used_bytes: 999_900,
+                    contract_count: 5,
+                    contract_slot_budget: 508,
+                    contracts: vec![mk_hosted_entry("A", true)],
+                    ..Default::default()
+                },
+            ),
+        ] {
+            let mut snap = base_snapshot();
+            snap.hosting = hosting;
+            let html = build_hosting_card(&Some(sna
```

**File**: `crates/core/src/server/home_page/assets/style.css` (modified, +24/-7)
```diff
@@ -605,8 +605,14 @@ code {
 .op-ok::before {
   content: '\2713 ';
 }
+/* Not red, for any operation type. This is a lifetime count with no rate
+ * behind it, so colour cannot distinguish one failure a week ago from every
+ * request failing now, and it rendered a red "0" on a node with no failures
+ * at all. For GET it is mostly requests the NETWORK could not route, which
+ * the status card above declines to colour for the same reason (#5370). The
+ * cross already says which number this is; the numbers say how it is going. */
 .op-fail {
-  color: #f87171;
+  color: var(--text-secondary);
   font-weight: 600;
   margin-left: 0.5rem;
 }
@@ -616,9 +622,6 @@ code {
 [data-theme='light'] .op-ok {
   color: #059669;
 }
-[data-theme='light'] .op-fail {
-  color: #dc2626;
-}
 .op-count {
   color: var(--text-primary);
   font-weight: 600;
@@ -1525,7 +1528,10 @@ table.sortable thead th.sort-desc::after {
 /* "Closest limit" strip on the Demand-driven eviction card: the card shows
  * several independent ceilings and this names the one nearest to binding,
  * because three flat rows of identical tiles gave no clue which mattered. The
- * fill is coloured only above 75% so the strip is ignorable until it isn't. */
+ * fill is coloured only when the state is worth attention, and what counts
+ * depends on the axis: a cache ceiling (contract state, contract slots) is
+ * meant to run full and is never coloured; the disk limit warns as it fills,
+ * because filling it refuses writes. See `CeilingKind` in cards.rs. */
 .hz-binding {
   margin: 0 0.9rem 0.7rem;
 }
@@ -1538,6 +1544,13 @@ table.sortable thead th.sort-desc::after {
   color: var(--text-primary, #e6edf3);
   font-weight: 600;
 }
+/* `--text-secondary`, not `--text-muted`: this sentence carries the meaning
+ * the bar's colour used to, so it has to be comfortably readable. */
+.hz-binding-note {
+  font-size: 0.78rem;
+  color: var(--text-secondary, #8b949e);
+  margin-top: 0.3rem;
+}
 .hz-bar {
   display: block;
   height: 6px;
@@ -1566,9 +1579,13 @@ table.sortable thead th.sort-desc::after {
   font-weight: 500;
   vertical-align: middle;
 }
+/* Neutral on purpose. The badge marks a position in the eviction ORDER and is
+ * present on every node that hosts anything, including one far under budget
+ * where nothing is being evicted; in warning orange it read as "about to be
+ * lost". */
 .hz-next {
-  background: rgba(255, 138, 61, 0.2);
-  color: #ff8a3d;
+  background: rgba(139, 148, 158, 0.16);
+  color: var(--text-secondary, #8b949e);
 }
 
 /* Denominator in the empty-state verdict ("3/30"). Smaller than the
```

**File**: `crates/core/src/server/home_page/cards.rs` (modified, +221/-76)
```diff
@@ -140,7 +140,7 @@ pub fn build_status_card(snap: &Option<network_status::NetworkStatusSnapshot>) -
             )
         }
         network_status::HealthLevel::Degraded => {
-            let detail = if snap.gateway_only {
+            let detail = if snap.gateway_only_persisting {
                 "Only connected to gateways — no peer-to-peer connections yet"
             } else {
                 "Connected but NAT traversal is failing"
@@ -362,8 +362,11 @@ pub fn build_status_card(snap: &Option<network_status::NetworkStatusSnapshot>) -
         ""
     };
 
-    // Gateway-only warning (only when not connected to any peers)
-    let gateway_warning = if snap.gateway_only {
+    // Gateway-only warning (only when not connected to any peers). Gated on
+    // the state having PERSISTED: every node is gateway-only for a while after
+    // it joins, and diagnosing a firewall fault on a node that simply has not
+    // finished connecting is a false alarm shown to every new user.
+    let gateway_warning = if snap.gateway_only_persisting {
         format!(
             r#"<div class="warning">
                 <strong>Firewall likely blocking incoming connections</strong> on UDP port <code>{port}</code>.
@@ -380,9 +383,11 @@ pub fn build_status_card(snap: &Option<network_status::NetworkStatusSnapshot>) -
 
     // NAT stats with rolling trend
     let nat_html = if snap.nat_stats.attempts > 0 {
-        let all_failed = snap.nat_stats.successes == 0;
+        // `looks_blocked`, not "no successes yet": single attempts fail
+        // routinely, so one or two failures are not a verdict on the port.
+        let all_failed = snap.nat_stats.looks_blocked();
         let class = if all_failed { " nat-fail" } else { "" };
-        let extra = if all_failed && !snap.gateway_only {
+        let extra = if all_failed && !snap.gateway_only_persisting {
             format!(
                 r#"<p class="nat-advice">All NAT traversal attempts have failed. Try forwarding UDP port <code>{}</code> on your router.</p>"#,
                 snap.listening_port
@@ -395,7 +400,7 @@ pub fn build_status_card(snap: &Option<network_status::NetworkStatusSnapshot>) -
         let (recent, verdict) = if snap.nat_stats.recent_attempts > 0 {
             let rs = snap.nat_stats.recent_successes;
             let ra = snap.nat_stats.recent_attempts;
-            let verdict = if rs == 0 && snap.nat_stats.successes == 0 {
+            let verdict = if rs == 0 && all_failed {
                 r#" <span class="nat-verdict nat-verdict-bad">Port may be blocked</span>"#
                     .to_string()
             } else {
@@ -1392,6 +1397,161 @@ pub fn build_governance_card(snap: &Option<network_status::NetworkStatusSnapshot
     )
 }
 
+/// What reaching a ceiling on the hosting card MEANS, which decides whether a
+/// full bar is worth an operator's attention.
+///
+/// The "Closest limit" strip used to colour every axis from utilisation alone
+/// (amber from 75%, red from 90%). That is right for a limit you are supposed
+/// to stay under and wrong for a cache, which is supposed to be full. So the
+/// strip was permanently red on exactly the peers doing the most useful work,
+/// and red reads as "broken".
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum CeilingKind {
+    /// A cache ceiling (contract state bytes, contract slots). Never coloured,
+    /// at any utilisation, because both "full" and "a little over" are how a
+    /// busy node normally runs:
+    ///
+    /// - contract state is trimmed back under its budget on every insert, so
+    ///   it rests just below 100%;
+    /// - contract slots are trimmed only after the ceiling has been exceeded
+    ///   for ~2.5 minutes, so a node with contracts still arriving sits a few
+    ///   over, trims to exactly N of N, and goes over again.
+    ///
+    /// Being over is the eviction sweep's trigger, not a fault, and a
+    /// subscribed contract is shed as a last resort, so the sweep is not
+    /// blocked by everything being in use. (One corner does stay over for a
+    /// while: a just-inserted contract larger than the whole budget is
+    /// protected from the insert-time sweep and goes at the next periodic one.
+    /// That is logged as a warning; it is not a reason to colour this axis for
+    /// every busy node.) The strip says what is happening in words instead.
+    Cache,
+    /// An admission limit (disk). Reaching it refuses new writes, so
+    /// approaching it is a real warning.
+    Admission,
+}
+
+/// How the strip's bar is coloured.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum LimitTone {
+    Neutral,
+    Warn,
+    Danger,
+}
+
+impl LimitTone {
+    fn css_colour(self) -> &'static str {
+        match self {
+            LimitTone::Neutral => "var(--text-muted, #888)",
+            LimitTone::Warn => "var(--warn, #b8860b)",
+            LimitTone::Danger => "var(--danger, #c0392b)",
+        }
+    }
+}
+
+/// Displayed percentage
```

**File**: `crates/core/src/server/home_page/favicon.rs` (modified, +6/-7)
```diff
@@ -16,11 +16,11 @@ use super::*;
 pub fn build_favicon_data_uri(snap: &Option<network_status::NetworkStatusSnapshot>) -> String {
     // Color is pre-encoded for data URI (# → %23) to avoid scanning the entire SVG.
     let color = match snap {
-        None => "%239e9e9e",                              // grey — starting up
-        Some(s) if s.open_connections > 0 => "%230abab5", // teal — connected
-        Some(s) if s.nat_stats.attempts > 0 && s.nat_stats.successes == 0 => "%238b0000", // dark red — NAT problems
-        Some(s) if !s.failures.is_empty() => "%23f44336", // red — connection issues
-        Some(_) => "%23fbbf24",                           // amber — connecting
+        None => "%239e9e9e",                                   // grey — starting up
+        Some(s) if s.open_connections > 0 => "%230abab5",      // teal — connected
+        Some(s) if s.nat_stats.looks_blocked() => "%238b0000", // dark red — NAT problems
+        Some(s) if !s.failures.is_empty() => "%23f44336",      // red — connection issues
+        Some(_) => "%23fbbf24",                                // amber — connecting
     };
 
     format!(
@@ -52,8 +52,7 @@ pub fn build_dashboard_title(snap: &Option<network_status::NetworkStatusSnapshot
     match snap {
         Some(s) if s.open_connections > 0 => format!("({}) Dashboard", s.open_connections),
         Some(s)
-            if s.health == network_status::HealthLevel::Trouble
-                || (s.nat_stats.attempts > 0 && s.nat_stats.successes == 0) =>
+            if s.health == network_status::HealthLevel::Trouble || s.nat_stats.looks_blocked() =>
         {
             "\u{26A0} Dashboard".to_string()
         }
```

**File**: `crates/core/tests/playwright/tests/dashboard-alarm-colours.spec.ts` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+import { test, expect } from "@playwright/test";
+
+// Things that are normal must not be PAINTED as alarms.
+//
+// The dashboard used to render several ordinary states in warning colours: an
+// always-red operations failure count (including a red "0"), and an orange
+// "next to evict" badge on a node far under budget. Both are now neutral, and
+// the sentence that explains a full cache ("Full is normal here") has to be
+// readable, because it carries the meaning a bar's colour used to.
+//
+// The Rust tests pin the stylesheet TEXT of these rules. They cannot tell
+// whether the declaration wins the cascade or what it computes to under each
+// theme — a `[data-theme='light']` override, or a later rule with the old
+// colour, would pass them and still paint the element red. Only a browser
+// resolving the real stylesheet can see that, so this asserts the COMPUTED
+// colour, in both themes.
+
+const shellUrl = process.env.FREENET_SHELL_URL;
+const dashboardUrl = shellUrl ? new URL("/", shellUrl).toString() : undefined;
+
+test.skip(
+  !shellUrl,
+  "FREENET_SHELL_URL is not set — run via `cargo test --test playwright_shell`",
+);
+
+type Rgb = { r: number; g: number; b: number };
+
+function rgb(value: string): Rgb {
+  const m = value.match(/rgba?\(([^)]+)\)/);
+  if (!m) throw new Error(`not a colour: ${value}`);
+  const [r, g, b] = m[1].split(",").map((p) => parseFloat(p.trim()));
+  return { r, g, b };
+}
+
+/** Spread between the strongest and weakest channel. A grey is near 0; the
+ *  alarm colours these rules used to carry are all above 130 (#f87171 is 135,
+ *  #dc2626 is 182, #ff8a3d is 194). */
+function chroma(c: Rgb): number {
+  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
+}
+
+function luminance(c: Rgb): number {
+  const f = (v: number) => {
+    const s = v / 255;
+    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
+  };
+  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
+}
+
+function contrast(a: Rgb, b: Rgb): number {
+  const la = luminance(a);
+  const lb = luminance(b);
+  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
+}
+
+/** Anything at or above this is a hue, not a grey. Far below the old alarm
+ *  colours and far above the neutral text tokens (under 10 in both themes). */
+const MAX_NEUTRAL_CHROMA = 40;
+
+// Probes are injected rather than waiting for the node to reach each state.
+// The rules under test are static stylesheet rules; what matters is what they
+// compute to. Class names must match what `cards.rs` emits.
+const PROBES: { name: string; className: string; mustBeReadable: boolean }[] = [
+  { name: "operations failure count", className: "op-fail", mustBeReadable: true },
+  { name: "next-to-evict badge", className: "hz-badge hz-next", mustBeReadable: false },
+  { name: "closest-limit note", className: "hz-binding-note", mustBeReadable: true },
+];
+
+for (const scheme of ["dark", "light"] as const) {
+  test.describe(`normal states are not painted as alarms (${scheme})`, () => {
+    for (const probe of PROBES) {
+      test(`${probe.name} is a neutral colour`, async ({ page }) => {
+        await page.emulateMedia({ colorScheme: scheme });
+        await page.goto(dashboardUrl!, { waitUntil: "domcontentloaded" });
+
+        const result = await page.evaluate((className) => {
+          const el = document.createElement("span");
+          el.className = className;
+          el.textContent = "probe";
+          document.querySelector("main")!.appendChild(el);
+          return {
+            color: getComputedStyle(el).color,
+            bodyBg: getComputedStyle(document.body).backgroundColor,
+            stamped: document.documentElement.getAttribute("data-theme"),
+          };
+        }, probe.className);
+
+        const colour = rgb(result.color);
+        const bg = rgb(result.bodyBg);
+
+        // Precondition: the page really is in the theme under test, or a
+        // pass here says nothing about that theme's overrides.
+        const bgLum = luminance(bg);
+        if (scheme === "light") {
+          expect(bgLum, "precondition: light page").toBeGreaterThan(0.5);
+        } else {
+          expect(bgLum, "precondition: dark page").toBeLessThan(0.2);
+        }
+
+        expect(
+          chroma(colour),
+          `.${probe.className} computes to ${result.color} under the ${scheme} theme ` +
+            `(data-theme=${result.stamped}) — that is a hue, and this element ` +
+            `describes a normal state, so it must be neutral`,
+        ).toBeLessThan(MAX_NEUTRAL_CHROMA);
+
+        if (probe.mustBeReadable) {
+          const ratio = contrast(colour, bg);
+          expect(
+            ratio,
+            `.${probe.className} has a contrast ratio of ${ratio.toFixed(2)} ` +
+              `against the page background under the ${scheme} theme — neutral ` +
+              `must not mean unreadable`,
+          ).toBeGreaterThan(4.5);
+        
```

#### Recent Merged Pull Requests:
- **PR #5810** (2026-10-05): build: release 0.2.142 (@sanity)
- **PR #5807** (2026-10-05): test(sim): read final node state in the turmoil convergence check (@sanity)
- **PR #5805** (2026-10-05): test(sim): remove RNG-trajectory dependence from four sim tests (@sanity)
- **PR #5803** (2026-10-05): perf(transport): end the ack-of-ack NoOp ping-pong and keep recv() timers across cancellation (@sanity)
- **PR #5802** (2026-10-05): perf(contracts): share the summary/delta caches across the RuntimePool (@sanity)
- **PR #5801** (2026-10-05): perf(wasm): wake on WASM job completion instead of polling every 10 ms (@sanity)
- **PR #5800** (2026-10-05): perf(client-api): event-driven subscription delivery instead of 10ms polling (@sanity)
- **PR #5797** (2026-10-05): perf(transport): cache socket address family instead of getsockname per send (@sanity)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
