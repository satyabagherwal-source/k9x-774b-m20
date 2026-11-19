> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `a1b7415e`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T14:03:32.807Z  
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
> **Harvest Timestamp**: 2026-11-19T14:03:32.801Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3131 stars

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
- **Issue #6298** (2026-11-19): **fix: bound contract-handler event admission per priority class**
  *Symptoms*: ## Problem  Event admission to the contract handler was not bounded per priority class. The fair queue's per-contract cap, total cap, `ClientLocal` reserve and priority tiers applied only to events that had already left one unbounded channel shared by every class, so a node's own client requests could wait behind other work there, and memory upstream of the fair queue was not bounded.  ## Approach  - **One admission lane per class** (`contract/handler.rs`, `Lane`): control (`ClientDisconnect`, `EvictContract`, chosen by event type; unbounded, never refused), client (2048), relay (1024), background (256). Every send is non-blocking, including the delegate lane's forwarder. A full lane answers at once with the typed `ContractQueueFull` response the fair queue gives (`queue_full_response_for`, factored out of `send_queue_full_response`). Each iteration drains control in full, then up to 256 client, 256 relay and 64 background events, so a client event reaches the `ClientLocal` tier within one execution. The idle select's arm now also handles `ClientDisconnect` inline. - **Relay driver permits** (`operations/relay_admission.rs`): relay GET, PUT, streaming PUT and the four relay UPDATE starters take a permit after their dedup gate and hold it for the driver's lifetime: 256 per source (IPv4 address or IPv6 /64) and 4096 per node. The node's own operations are not counted. A refusal is answered upstream at once: GET `NotFound`; PUT `PutMsg::Error` with `PUT_RELAY_OVERLOADED_CAUSE`; 

- **Issue #6297** (2026-11-19): **feat(quic): native joiners inside the connection cap, with their own queue share**
  *Symptoms*: ## Problem  A native joiner at a gateway (behind `GATEWAY_NATIVE_ADMISSION`, off in production) held no memory charge from its first packet, so a join flood was not counted against the QUIC connection cap. It also sat on the demux allow-set with a full per-source share (256 of 1024 slots) of the established ingress queue for up to 8 s. Admission is keyed on IP:port, so one host on several ports could fill the queue down to the quiet reserve (#6263 review, QUIC-NATIVE-CONNECT 10.2 item 23).  ## Approach  - **Cap (5.1 item 5).** `QuicPathPermits` now counts in memory units (16 KiB): a path takes `PATH_PERMIT_UNITS` (the connection charge), a joiner `JOINER_PERMIT_UNITS` (new `QUIC_HANDSHAKE_PHASE_CHARGE_BYTES`: 16 KiB windows, 4 uni streams, three CRYPTO spaces, ACK tail). Paths and joiners draw from one total, so there is no parallel counter, and with no joiners it is the old path count. `EndpointCore::admit` charges the joiner after the rate checks and before the allow-set; the charge lives in `JoinerCharge`, which `establish` returns beside the connection. Every release is a drop: ignored attempt, failed handshake, the 8 s window (the `establish` future is dropped), close. `JoinerCharge::promote` re-charges at the full path rate in one atomic step. The hub attaches the permits (`attach_joiner_cap`); with none attached every joiner is ignored. - **Queue share (gate 23, decided by the lead).** All unpromoted joiners together get `QUIC_INGRESS_JOINER_DATAGRAMS` = 64 slots (1/16
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No blocking issues; 2 informational notes  **Rules checked:** git-workflow.md, code-style.md, testing.md, transport.md, contracts.md **Files reviewed:** 10. I read the full diff. I did not run the tests, so I haven't confirmed the new source-scrape pins fail on a mutation (see the last note).  #### Warnings None.  #### Info - `crates/core/src/transport/quic/upgrade/policy.rs` (`QuicJoinerPermit::promote`) — `.expect("a live joiner permit holds its count")` is in new production code. The message states the invariant: the `Option` is `None` only after `promote` or `Drop`, and `promote` takes `self` by value. It meets the "say why it is infallible" rule. A `let Some(count) = self.0.take() else { return Err(self) }` would avoid the panic path entirely. (rule: code-style.md, errors) - `crates/core/src/transport/quic/upgrade/driver.rs` (`join_gateway`) — the charge is bound as `_charge` and then released with `drop(_charge)`. Binding it as `charge
  > ## ⚠️ Extended Benchmark Regressions Detected  Some extended benchmarks show performance regressions.  **Note**: Extended benchmarks include high-latency and packet-loss scenarios which have higher variance than standard CI benchmarks.  [View full results](https://github.com/freenet/freenet-core/actions/runs/44472832991)  [View full benchmark summary](https://github.com/freenet/freenet-core/actions/runs/44472832991)

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

### Incident Patch 1: `a1b7415e` (2026-11-19)
**Commit Message**: fix: bound contract-handler event admission per priority class (#6298)

**File**: `.claude/rules/operations.md` (modified, +50/-1)
```diff
@@ -229,6 +229,53 @@ tier remote peers feed) from indefinitely starving Background. Both are
 backstops only: tag each send site with the class it belongs to.
 ```
 
+**Admission lanes in front of the fair queue (ANT-2026-K0YQ8CG4).** Events
+reach `contract_handling` over four channels, chosen by `handler::Lane::of`:
+control (`ClientDisconnect`, `EvictContract`, by event type and whatever
+their priority; unbounded, never refused), client (`ClientLocal`, 2048),
+relay (`NetworkRelay`, 1024) and background (`Background`, 256). Every send
+into them is non-blocking (`try_send`); NEVER add a `.send().await` there
+(pinned by `no_send_into_the_lanes_waits`). A full bounded lane answers the
+caller at once with the same typed `ContractQueueFull` response the fair
+queue gives a refused event (`queue_full_response_for`), so a full client
+lane is now an immediate `ContractQueueFull` to the client rather than a
+wait. Each loop iteration drains control in full, then up to 256 client, 256
+relay and 64 background events, so a client event reaches the
+`ClientLocal` tier within one execution. The tag you choose therefore also
+picks the lane: a node-originated burst tagged `NetworkRelay` competes with
+peers' requests for relay-lane room.
+
+Relay drivers bound the relay lane per peer. `start_relay_get`,
+`start_relay_put`, `start_relay_put_streaming` and the four relay UPDATE
+starters take a `relay_admission::RelayDriverPermit` (256 per source, an
+IPv4 address or IPv6 /64; 4096 per node) after their dedup gate and hold it
+until the driver exits; the node's own operations (originator loopback) are
+not counted. A refusal is answered upstream at once: GET `NotFound`, PUT
+`PutMsg::Error` with `PUT_RELAY_OVERLOADED_CAUSE` (the originator's
+`classify_reply` treats it as "try the next peer", not terminal), and a
+refused UPDATE broadcast of a held contract gets the same throttled
+`ResyncRequest` repair as a rate-limited one. Relay drivers wait for the
+handler through `OpManager::notify_contract_handler_relay`
+(`RELAY_HANDLER_TIMEOUT` = `OPERATION_TTL`), not the 300 s default. A relay
+GET whose local query is refused for overload answers `NotFound` and does
+NOT forward (`check_local_with_interest_gate` returns `HandlerOverloaded`);
+the node's own GET queries on the client lane instead. A relay PUT whose
+permit or local store is refused for overload is NOT forwarded: the relay
+answers `PUT_RELAY_OVERLOADED_CAUSE`. A first hop's answer reaches the
+originator's client driver directly (the loopback relay forwards without
+waiting), which classifies it `Overloaded` and retries; `PutRetryDriver`
+hands every first hop that answered it to the loopback relay as first-pick
+exclusions (`first_hop_exclusions`, via `AttemptHopRegistry`, as GET does):
+local to that one pick, never in the forwarded `skip_list`, and ignored when
+they would exclude every candidate, so the loopback picks a different first
+hop when one exists and never ends up with an empty pick. When the attempts run out, a
+non-streaming PUT gets an error; a streaming PUT (no further attempts)
+ends as `exhausted_attempt_is_local_success` decides. A relay further along
+that stored and then hears the cause from its next hop reports success
+upstream (it holds a copy), and an overload reply labels no route failure.
+The node's own PUT whose client-lane store is refused fails at once with
+`ContractQueueFull`. No path reports success without a stored copy.
+
 **Client `DelegateRequest`s and the delegate lane (#6144).** Once
 `contract_handling` has started a delegate lane (`contract/delegate_lane.rs`;
 production always does), `ContractHandlerChannel::send_to_handler` hands a
@@ -240,7 +287,9 @@ the operator's own local requests, and hosted users share the other 7/8 among
 themselves). The lane runs a request itself only when its
 delegate is free and fewer than `MAX_PENDING_UNITS` (16) continuations wait
 for the loop; every other request it FORWARDS, unchanged (same id, priority,
-scope, user, responder), into this loop's event channel. The fair-queue
+scope, user, responder), into this loop's admission lane for that priority
+(the client lane for a `ClientLocal` request), with `try_send`: a full lane
+answers the client with the typed `ContractQueueFull` refusal. The fair-queue
 bounds above (capacity, per-slot cap, `CLIENT_LOCAL_RESERVE`) and, for a
 parked delegate, the park's `queue_pending` cap and byte budget apply ONLY
 to forwarded requests; a request the lane runs never enters the fair queue.
```

**File**: `crates/core/src/contract.rs` (modified, +422/-42)
```diff
@@ -54,6 +54,7 @@ pub(crate) use handler::{
 
 pub use executor::{ContractQueueFull, Executor, ExecutorError, OperationMode};
 pub use handler::reset_event_id_counter;
+pub(crate) use handler::{Lane, RELAY_CHANNEL_CAPACITY, lane_refusals};
 pub(crate) use state_size_metrics::{
     StateSizeRejectionStage, record_state_size_rejection, state_size_rejection_snapshot,
 };
@@ -3599,36 +3600,40 @@ where
             }
         }
 
-        // Drain pending events from the channel into the fair queue (bounded batch).
-        // Capped at MAX_DRAIN_BATCH (256) to bound the synchronous work per iteration
-        // before yielding back to the Tokio scheduler. Each iteration of this loop is
-        // a non-blocking try_recv + HashMap insert, so 256 iterations complete in
-        // single-digit microseconds even at peak load.
-        for _ in 0..fair_queue::MAX_DRAIN_BATCH {
-            match contract_handler.channel().try_recv_from_sender()? {
-                Some((id, event, priority)) => {
-                    // Process ClientDisconnect inline — it's a lightweight cleanup
-                    // operation that should never be delayed or compete with
-                    // DelegateRequest events for the default queue's limited capacity.
-                    if let ContractHandlerEvent::ClientDisconnect { client_id } = &event {
-                        let client_id = *client_id;
-                        contract_handler.executor().remove_client(client_id);
-                        // Drop any delegate-notification routing registrations
-                        // for this client (#3275).
-                        delegate_app_registry::remove_client(client_id);
-                        contract_handler.channel().drop_waiting_response(id);
-                        continue;
+        // Move waiting events from the admission lanes into the fair queue
+        // (ANT-2026-K0YQ8CG4). Lane by lane in precedence order, each with
+        // its own budget, so a client event reaches the fair queue's
+        // `ClientLocal` tier on this iteration however much relay or
+        // background work is waiting; the bounded lanes refuse at the sender
+        // once full, so nothing piles up behind the budget. The control lane
+        // is taken in full (what was waiting when the drain began, so the
+        // drain stays finite under a concurrent producer). Each step is a
+        // non-blocking try_recv plus a map insert, so the whole drain is
+        // microseconds even at peak load.
+        let control_waiting = contract_handler.channel().lane_len(handler::Lane::Control);
+        for (lane, budget) in [
+            (handler::Lane::Control, control_waiting),
+            (handler::Lane::Client, fair_queue::MAX_DRAIN_BATCH),
+            (handler::Lane::Relay, fair_queue::MAX_DRAIN_BATCH),
+            (
+                handler::Lane::Background,
+                fair_queue::MAX_BACKGROUND_DRAIN_BATCH,
+            ),
+        ] {
+            for _ in 0..budget {
+                match contract_handler.channel().try_recv_lane(lane)? {
+                    Some((id, event, priority)) => {
+                        admit_to_fair_queue(
+                            &mut contract_handler,
+                            &mut fair_queue,
+                            id,
+                            event,
+                            priority,
+                        )
+                        .await;
                     }
-                    push_with_background_eviction(
-                        &mut contract_handler,
-                        &mut fair_queue,
-                        id,
-                        event,
-                        priority,
-                    )
-                    .await;
+                    None => break,
                 }
-                None => break,
             }
         }
 
@@ -3800,7 +3805,7 @@ where
             } => {}
             result = contract_handler.channel().recv_from_sender() => {
                 let (id, event, priority) = result?;
-                push_with_background_eviction(
+                admit_to_fair_queue(
                     &mut contract_handler,
                     &mut fair_queue,
                     id,
@@ -4544,6 +4549,32 @@ where
     })
 }
 
+/// Take one event received from the admission lanes: a `ClientDisconnect` is
+/// handled inline, anything else goes into the fair queue.
+async fn admit_to_fair_queue<CH>(
+    contract_handler: &mut CH,
+    fair_queue: &mut fair_queue::FairEventQueue,
+    id: handler::EventId,
+    event: ContractHandlerEvent,
+    priority: fair_queue::Priority,
+) where
+    CH: ContractHandler + Send + 'static,
+{
+    // Process ClientDisconnect inline — it's a lightweight cleanup
+    // operation that should never be delayed or compete with
+    // DelegateRequest events for the default queue's limited capacity.
+    if let ContractHandlerEvent::ClientDisconnect { client_id } = &event {
+      
```

**File**: `crates/core/src/contract/executor/mock_wasm_runtime.rs` (modified, +18/-0)
```diff
@@ -911,6 +911,24 @@ impl ContractExecutor for Executor<MockWasmRuntime, MockStateStorage> {
         self.bridged_lookup_key(instance_id)
     }
 
+    /// Keeps the state (the mock has no disk to reclaim), but a contract whose
+    /// validate RECORDS (`ValidateOverride::Record`) also records its eviction
+    /// there as `b"evicted"`, so a test can read the order the loop ran a PUT
+    /// and an `EvictContract` in.
+    async fn remove_contract(
+        &mut self,
+        key: &ContractKey,
+        _expected_generation: u64,
+    ) -> Result<(), ExecutorError> {
+        if let Some(ValidateOverride::Record(seen)) = self.runtime.validate_overrides.get(key.id())
+        {
+            seen.lock()
+                .unwrap_or_else(|e| e.into_inner())
+                .push(b"evicted".to_vec());
+        }
+        Ok(())
+    }
+
     fn delegate_capabilities(
         &self,
     ) -> Option<std::sync::Arc<crate::contract::delegate_capabilities::DelegateCapabilities>> {
```

**File**: `crates/core/src/contract/fair_queue.rs` (modified, +10/-5)
```diff
@@ -53,9 +53,9 @@ const _: () = assert!(
 );
 
 /// Maximum total events across all queues.
-/// Global backpressure to bound total memory usage.
-/// Set below MAX_PENDING_REQUESTS (10,000) so backpressure propagates
-/// before the mediator hits its limit.
+/// Global backpressure to bound total memory usage. What waits upstream of
+/// this queue is bounded separately, by the capacities of the bounded
+/// admission lanes (`handler::Lane`).
 pub(super) const MAX_TOTAL_FAIR_QUEUE: usize = 5_000;
 
 /// Admission capacity reserved for [`Priority::ClientLocal`] events.
@@ -70,10 +70,15 @@ pub(super) const MAX_TOTAL_FAIR_QUEUE: usize = 5_000;
 /// client's in-flight working set without materially shrinking the shared cap.
 pub(super) const CLIENT_LOCAL_RESERVE: usize = 256;
 
-/// Maximum events to drain from channel per iteration.
-/// Prevents the drain loop from blocking delegate notifications too long.
+/// Maximum events `contract_handling` moves from the client lane, and from the
+/// relay lane, into this queue per loop iteration (`handler::Lane`). Prevents
+/// the drain from blocking delegate notifications too long.
 pub(super) const MAX_DRAIN_BATCH: usize = 256;
 
+/// The same for the background lane, which is smaller because background
+/// work is shed first anyway and re-runs on its next cycle.
+pub(super) const MAX_BACKGROUND_DRAIN_BATCH: usize = 64;
+
 /// Scheduling/admission priority class for a contract-handler event (#4534).
 ///
 /// The contract event loop is single-threaded, so a flood of best-effort
```

**File**: `crates/core/src/contract/handler.rs` (modified, +543/-59)
```diff
@@ -237,16 +237,227 @@ pub(crate) struct ContractHandlerChannel<End: sealed::ChannelHalve> {
 }
 
 pub(crate) struct ContractHandlerHalve {
-    event_receiver: mpsc::UnboundedReceiver<InternalCHEvent>,
+    lanes: LaneReceivers,
     waiting_response: BTreeMap<u64, tokio::sync::oneshot::Sender<(EventId, ContractHandlerEvent)>>,
     /// Shared with the [`SenderHalve`]: `contract_handling` installs the
     /// delegate lane's intake here once it has started the lane.
     delegate_lane: DelegateLaneSlot,
-    /// A WEAK handle on this channel's own event sender, for the delegate
-    /// lane to forward requests into ([`LoopForwarder`]). Weak, so that it
-    /// does not keep the channel open: the loop still sees the channel close
+    /// WEAK handles on this channel's own lane senders, for the delegate
+    /// lane to forward requests into ([`LoopForwarder`]). Weak, so that they
+    /// do not keep the channel open: the loop still sees the channel close
     /// when every client-side sender is gone.
-    event_sender: mpsc::WeakUnboundedSender<InternalCHEvent>,
+    event_sender: WeakLaneSenders,
+}
+
+// ── Admission lanes (ANT-2026-K0YQ8CG4) ────────────────────────────────────
+//
+// The fair queue's caps, its `ClientLocal` reserve and its priority tiers
+// apply to an event only once `contract_handling` has moved it out of the
+// handler channel. Event admission into that channel is therefore bounded per
+// class here, ahead of the fair queue.
+//
+// Each class has its own channel, every send is non-blocking, and a full
+// bounded channel refuses at the sender with the same typed `ContractQueueFull`
+// response the fair queue gives (`queue_full_response_for`). The loop drains
+// the lanes in precedence order each iteration, so a client event reaches the
+// fair queue's `ClientLocal` tier on the next iteration, whatever is queued in
+// the other lanes.
+
+/// Capacity of the lane carrying [`Priority::ClientLocal`] events: eight times
+/// the fair queue's `CLIENT_LOCAL_RESERVE`, which covers concurrent
+/// multi-WebSocket bursts such as freenet-git's 8-way parallel chunked PUT
+/// pool (#4056). A client sending beyond it gets an error at once.
+///
+/// [`Priority::ClientLocal`]: super::fair_queue::Priority::ClientLocal
+pub(crate) const CLIENT_CHANNEL_CAPACITY: usize = 8 * super::fair_queue::CLIENT_LOCAL_RESERVE;
+
+/// Capacity of the lane carrying `Priority::NetworkRelay` events. Each relay
+/// driver holds at most one event here at a time, and drivers are capped per
+/// source (`operations::relay_admission`), so one peer cannot fill it alone.
+pub(crate) const RELAY_CHANNEL_CAPACITY: usize = 1024;
+
+/// Capacity of the lane carrying `Priority::Background` events. Background
+/// work (interest-sync summaries, renewal, placement caching) is periodic and
+/// re-runs on its next cycle when refused.
+pub(crate) const BACKGROUND_CHANNEL_CAPACITY: usize = 256;
+
+/// Which admission channel an event travels on.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub(crate) enum Lane {
+    /// `ClientDisconnect` and `EvictContract`. Unbounded and never refused:
+    /// it grows only with the number of clients and with hosting churn, and
+    /// dropping either event would leak state (a client's registrations, an
+    /// evicted contract's disk). Its events still take their own priority
+    /// once in the fair queue.
+    Control,
+    Client,
+    Relay,
+    Background,
+}
+
+impl Lane {
+    pub(crate) fn of(ev: &ContractHandlerEvent, priority: super::fair_queue::Priority) -> Self {
+        use super::fair_queue::Priority;
+        if matches!(
+            ev,
+            ContractHandlerEvent::ClientDisconnect { .. }
+                | ContractHandlerEvent::EvictContract { .. }
+        ) {
+            return Lane::Control;
+        }
+        match priority {
+            Priority::ClientLocal => Lane::Client,
+            Priority::NetworkRelay => Lane::Relay,
+            Priority::Background => Lane::Background,
+        }
+    }
+
+    fn index(self) -> usize {
+        match self {
+            Lane::Control => 0,
+            Lane::Client => 1,
+            Lane::Relay => 2,
+            Lane::Background => 3,
+        }
+    }
+}
+
+/// Events refused at admission so far, per lane (the control lane never
+/// refuses, so its slot stays zero).
+static LANE_REFUSALS: [std::sync::atomic::AtomicU64; 4] = [
+    std::sync::atomic::AtomicU64::new(0),
+    std::sync::atomic::AtomicU64::new(0),
+    std::sync::atomic::AtomicU64::new(0),
+    std::sync::atomic::AtomicU64::new(0),
+];
+
+/// Events a full lane has refused so far.
+pub(crate) fn lane_refusals(lane: Lane) -> u64 {
+    LANE_REFUSALS[lane.index()].load(std::sync::atomic::Ordering::Relaxed)
+}
+
+/// Count a refusal and log it at powers of two of the running total, so a
+/// sustained refusal costs a handful of log lines rather than one per event.
+fn record_lane_refusal(lane: Lane, ev: &ContractHandlerEvent) {
+    
```

**File**: `crates/core/src/lib.rs` (modified, +14/-0)
```diff
@@ -171,6 +171,20 @@ pub mod dev_tool {
                 .collect()
         }
     }
+    /// Simulation hook for ANT-2026-K0YQ8CG4: make chosen nodes' contract
+    /// handlers refuse every relay query, as a full relay lane does.
+    /// Process-global: a test that uses it must run in its own process.
+    #[cfg(any(test, feature = "testing"))]
+    pub mod sim_relay_overload {
+        /// Treat the node at `addr` as having a full relay lane.
+        pub fn saturate(addr: std::net::SocketAddr) {
+            crate::operations::relay_admission::sim_overload::saturate(addr);
+        }
+        /// Undo every `saturate`.
+        pub fn clear() {
+            crate::operations::relay_admission::sim_overload::clear();
+        }
+    }
     pub use crate::config::{
         Config, GlobalTestMetrics, KEK_SIZE, KekBackend, KekBackendKind, KekError, Secrets,
         ensure_kek_loaded, load_from_backend, read_backend_marker, replace_backend_marker,
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +7/-1)
```diff
@@ -122,7 +122,13 @@ async fn query_app_subscriptions_bounded(
     let (tx, mut rx) = tokio::sync::mpsc::channel(1);
     match timeout(
         QUERY_SUBSCRIPTIONS_HANDLER_TIMEOUT,
-        ch_outbound.send_to_handler(ContractHandlerEvent::QuerySubscriptions { callback: tx }),
+        // Diagnostics, so the background lane: it must not take relay-lane
+        // room from peers' requests (ANT-2026-K0YQ8CG4). A refusal yields an
+        // empty list, like any other failure here.
+        ch_outbound.send_to_handler_prioritized(
+            ContractHandlerEvent::QuerySubscriptions { callback: tx },
+            crate::contract::Priority::Background,
+        ),
     )
     .await
     {
```

**File**: `crates/core/src/node/op_state_manager.rs` (modified, +43/-0)
```diff
@@ -81,6 +81,14 @@ impl Ops {
 /// past the cap are unmeasured for that drop.
 const CONNECTION_DROP_SHADOW_SAMPLE_CAP: usize = 32;
 
+/// How long a relay driver waits for the contract handler
+/// ([`OpManager::notify_contract_handler_relay`]).
+pub(crate) const RELAY_HANDLER_TIMEOUT: std::time::Duration = crate::config::OPERATION_TTL;
+
+// A relay driver must wait less than the handler's 300 s default, and no
+// longer than its upstream does.
+const _: () = assert!(RELAY_HANDLER_TIMEOUT.as_secs() <= crate::config::OPERATION_TTL.as_secs());
+
 /// Max number of our active-subscription entries to EXAMINE per dropped
 /// connection while looking for the ≤`CONNECTION_DROP_SHADOW_SAMPLE_CAP` matches
 /// (keystone step-2, #4642). Bounds the SCAN itself (not just the recording): a
@@ -331,6 +339,11 @@ pub(crate) struct OpManager {
     /// flight. See [`crate::operations::put::stream_admission`].
     pub(crate) relay_put_stream_admission:
         Arc<crate::operations::put::stream_admission::RelayStreamAdmission>,
+    /// Per-source and node-wide bound on relay GET and PUT drivers in
+    /// flight (ANT-2026-K0YQ8CG4). See
+    /// [`crate::operations::relay_admission`].
+    pub(crate) relay_driver_admission:
+        Arc<crate::operations::relay_admission::RelayDriverAdmission>,
     /// Same role as `active_relay_get_txs` but for PUT relay. PUT
     /// relay has req/response semantics like GET (but forwards once
     /// — no per-hop retry), so amplification risk is comparable.
@@ -422,6 +435,7 @@ impl Clone for OpManager {
             active_relay_update_txs: self.active_relay_update_txs.clone(),
             recent_relay_update_requests: self.recent_relay_update_requests.clone(),
             relay_put_stream_admission: self.relay_put_stream_admission.clone(),
+            relay_driver_admission: self.relay_driver_admission.clone(),
             active_relay_put_txs: self.active_relay_put_txs.clone(),
             active_relay_subscribe_txs: self.active_relay_subscribe_txs.clone(),
             active_relay_connect_txs: self.active_relay_connect_txs.clone(),
@@ -871,6 +885,9 @@ impl OpManager {
             relay_put_stream_admission: Arc::new(
                 crate::operations::put::stream_admission::RelayStreamAdmission::new(),
             ),
+            relay_driver_admission: Arc::new(
+                crate::operations::relay_admission::RelayDriverAdmission::new(),
+            ),
             active_relay_put_txs,
             active_relay_subscribe_txs,
             active_relay_connect_txs,
@@ -1805,6 +1822,32 @@ impl OpManager {
             .await
     }
 
+    /// Send a relay driver's event to the contract handler and await the
+    /// answer for at most [`RELAY_HANDLER_TIMEOUT`] (ANT-2026-K0YQ8CG4).
+    ///
+    /// A relay driver holds its relay-lane slot and its driver permit while
+    /// it waits, and its upstream gives up at `OPERATION_TTL` anyway, so it
+    /// waits no longer than that rather than the handler's 300 s default.
+    pub async fn notify_contract_handler_relay(
+        &self,
+        msg: ContractHandlerEvent,
+    ) -> Result<ContractHandlerEvent, ContractError> {
+        #[cfg(any(test, feature = "testing"))]
+        if crate::operations::relay_admission::sim_overload::is_saturated(
+            self.ring.connection_manager.get_own_addr(),
+        ) {
+            return crate::contract::queue_full_response_for(&msg)
+                .ok_or(ContractError::NoEvHandlerResponse);
+        }
+        self.ch_outbound
+            .send_to_handler_with_timeout(
+                msg,
+                RELAY_HANDLER_TIMEOUT,
+                crate::contract::Priority::NetworkRelay,
+            )
+            .await
+    }
+
     /// Fire-and-forget notification to the contract handler at an explicit
     /// priority class (#4534). Used for maintenance events (e.g. EvictContract)
     /// where no response is needed and the caller must not block.
```

---

### Incident Patch 2: `96babd04` (2026-11-19)
**Commit Message**: feat(quic): native joiners inside the connection cap, with their own queue share (#6297)

**File**: `.claude/rules/transport.md` (modified, +26/-6)
```diff
@@ -1053,6 +1053,15 @@ Token reservation:
     giving it back if the fragment is not sent; see "Node-wide egress cap"
 ```
 
+### WHEN admitting native joiners at a gateway (#5940, A7b; dark behind `GATEWAY_NATIVE_ADMISSION`)
+
+- **A joiner is charged against the node's QUIC path cap from its admission.** `JoinerIncoming` holds a `JoinerCharge` (a `QuicJoinerPermit` from `QuicPathPermits::try_acquire_joiner`, plus a `QuicJoinerMark`). Dropping it releases both, which covers every exit: the handshake failing, the 8 s window passing (the `establish` future is dropped), the connection closing (end of `join_gateway`) and an ignored attempt. `JoinerCharge::promote` re-charges at the full path rate (`QuicJoinerPermit::promote`, one atomic step; on no room the joiner keeps its charge). Do not add a parallel joiner counter: paths and joiners take from ONE unit total in `QuicPathPermits` (`config::PATH_PERMIT_UNITS` for a path, `config::JOINER_PERMIT_UNITS` for the handshake-phase charge, `config::QUIC_HANDSHAKE_PHASE_CHARGE_BYTES`).
+- **Joiners together hold at most 1/`JOINER_SHARE_DIVISOR` (a quarter) of the cap's units**, so established peers' path upgrades always keep the rest; refused joiners are ignored as when the cap is full. **The join window counts from the hub queueing the join** (`JoinerIncoming::stamp`, read by `join_gateway`), so waiting for a join slot does not extend the hold. Promotion moves the `Arc` to the path permit (`QuicJoinerPermit` holds an `Option`); never `mem::forget` it.
+- **The cap is attached by the hub** (`QuicUpgrades::new` calls `attach_joiner_cap`). Until then every admitted attempt is ignored (`joiner_cap_full`): a missing cap fails closed.
+- **Order in `EndpointCore::admit`**: Retry, per-address, global, THEN the cap charge, THEN the allow-set. A refusal at any step drops the `AdmissionTicket` (refund) and the charge. Pinned by `with_admission_off_no_joiner_is_charged`.
+- **Unpromoted joiners share one slice of the established ingress queue** (`demux::QUIC_INGRESS_JOINER_DATAGRAMS`, 64 of 1024), not a per-source share and not per-IP keying (QUIC-NATIVE-CONNECT 10.2 item 23, decided in A7b PR 6): one host on many ports cannot take more than 64 slots, and established peers keep the rest. A joiner never uses the quiet reserve. The slot is recorded per datagram (`QuicDatagram::joiner_slot`) so promotion or release cannot leak it. Overflow counts `quic_gateway_admission_joiner_share_full` and `quic_ingress_source_full`.
+- **Never `std::mem::forget` a charge or a mark.** A leaked charge shrinks the cap for the life of the process.
+
 ## Backoff, Jitter, and Recovery Rules
 
 ### WHEN implementing retry/backoff
@@ -1169,6 +1178,9 @@ allowed addresses can fill the reserve; the queue then holds 1024, as
 without it. Limitation: the reserve helps only while most sources are busy;
 with about 256 or more connections each holding a few datagrams, most
 traffic counts as quiet and the queue behaves close to a plain FIFO.
+Unpromoted native joiners (gateway admission on) hold one separate slice,
+`QUIC_INGRESS_JOINER_DATAGRAMS` (64) in all, instead of the per-source share,
+and never use the quiet reserve.
 `allow_quic_source` returns a QuicSourcePermit: the address stays allowed
 while a permit for it is alive, and the set holds at most
 QUIC_ALLOWED_SOURCES_MAX addresses (past it, `allow_quic_source` refuses; a
@@ -1198,7 +1210,7 @@ Off, a node behaves as before; what it still carries is an idle second
 ingress queue (128 slots) and its poll in the endpoint's receive, one atomic
 load per QUIC datagram from a source not on the allow-set, and the
 `quic_gateway_admission_*` counters at 0. The switch's doc names what turning
-it on waits for (joiners inside the connection cap, phase B). When on, the
+it on waits for (phase B; joiners inside the connection cap are done, A7b PR 6). When on, the
 demux gets an unknown-source lane (`enable_unknown_source_lane`): a
 QUIC-class datagram from a source not on the allow-set is queued on a
 separate queue of `UNKNOWN_SOURCE_QUEUE_DATAGRAMS` (128, in
@@ -1211,7 +1223,11 @@ first and the unknown-source queue only when it is empty.
 allow-set, in order: no Retry token yet → Retry; an address admitted within
 the last second → ignored; the node-wide rate (50 a second) spent → ignored;
 otherwise admitted, recorded against both limits as an `AdmissionTicket`;
-then the address is put on the allow-set for the attempt and then the
+then the joiner is charged against the node's QUIC path cap at the
+handshake-phase rate (`QuicPathPermits::try_acquire_joiner`; no room, joiners
+already at a quarter of the cap, or no cap attached yet → ignored,
+`joiner_cap_full`); then the address is put on the allow-set, marked as a
+joiner (`allow_joiner`), for the attempt and then the
 connection (the handshake's later, shorter datagrams take the established
 path), and the attempt is accepted with one server configuration built at
 enable (`server_tls_proven`). A ticke
```

**File**: `crates/core/src/contract/executor.rs` (modified, +13/-0)
```diff
@@ -3135,6 +3135,19 @@ mod tests {
                 "a measurement of one QUIC connection term (one open stream, both \
                  sides), not a ceiling; a term inside QUIC_CONNECTION_CHARGE_BYTES",
             ),
+            (
+                "QUIC_HANDSHAKE_PHASE_CHARGE_BYTES",
+                "the charge one native joiner takes from the QUIC connection cap \
+                 (#6297), not a ceiling; joiners draw permit units from the same \
+                 cap total as paths, so their memory is inside the QUIC transport \
+                 share (cap x QUIC_CONNECTION_CHARGE_BYTES), which is summed",
+            ),
+            (
+                "PERMIT_UNIT_BYTES",
+                "the unit the QUIC connection cap counts in (#6297), not a budget; \
+                 the cap's total is limit x the path charge in these units, which \
+                 the QUIC transport share already sums",
+            ),
             (
                 "QUIC_STOPPED_ENTRY_BYTES",
                 "a measurement of one QUIC connection term (one entry of quinn's \
```

**File**: `crates/core/src/transport/demux.rs` (modified, +427/-12)
```diff
@@ -55,6 +55,30 @@ pub(crate) const QUIC_INGRESS_QUEUE_DATAGRAMS: usize = 1024;
 /// `quic_ingress_source_full`.
 pub(crate) const QUIC_INGRESS_PER_SOURCE_DATAGRAMS: usize = QUIC_INGRESS_QUEUE_DATAGRAMS / 4;
 
+/// How many datagrams of the QUIC ingress queue admitted-but-unpromoted
+/// native joiners (`quic::admission`) may hold, all of them together: a
+/// sixteenth of the queue. A joiner's source is on the allow-set from its
+/// admission, so without this it would take the per-source share
+/// ([`QUIC_INGRESS_PER_SOURCE_DATAGRAMS`], 256) for the up to 8 s its
+/// handshake and `Hello` may last, and the per-address admission limit is
+/// keyed on IP and port, so one host on several ports could fill the queue
+/// down to the quiet reserve. The share is for all unpromoted joiners
+/// together, whatever their addresses, so established peers keep the other
+/// 960 slots. An honest join exchanges a few dozen datagrams over its whole
+/// window, and the global admission rate (50 a second) admits that many
+/// joiners in one second, so this holds the handshake flights of a burst
+/// without letting joiners crowd the queue; a joiner datagram over it is
+/// dropped and the QUIC handshake retransmits it. A joiner never uses the
+/// quiet reserve. A source stops counting as a joiner when its
+/// [`QuicJoinerMark`] is dropped: at promotion or the end of the join.
+pub(crate) const QUIC_INGRESS_JOINER_DATAGRAMS: usize = QUIC_INGRESS_QUEUE_DATAGRAMS / 16;
+
+const _: () = assert!(
+    QUIC_INGRESS_JOINER_DATAGRAMS <= QUIC_INGRESS_PER_SOURCE_DATAGRAMS
+        && QUIC_INGRESS_JOINER_DATAGRAMS
+            <= QUIC_INGRESS_QUEUE_DATAGRAMS - QUIC_INGRESS_QUIET_RESERVE
+);
+
 /// The last slots of the QUIC ingress queue, kept for sources that have fewer
 /// than [`QUIC_INGRESS_QUIET_SOURCE_DATAGRAMS`] datagrams queued. Once only
 /// these are free, a datagram from a source holding more is dropped and
@@ -103,6 +127,10 @@ pub(crate) const QUIC_INGRESS_QUEUE_BYTES: usize = (QUIC_INGRESS_QUEUE_DATAGRAMS
 pub(crate) struct QuicDatagram {
     pub bytes: Vec<u8>,
     pub from: SocketAddr,
+    /// Whether it holds a slot of the joiners' share of the queue
+    /// ([`QUIC_INGRESS_JOINER_DATAGRAMS`]), fixed when it was queued, so the
+    /// slot is given back even if its source was promoted since.
+    pub(crate) joiner_slot: bool,
 }
 
 /// The state of a QUIC ingress shared by the socket (the sending side), the
@@ -126,6 +154,12 @@ struct IngressShared {
     /// source not on the allow-set that can open a connection goes to the
     /// unknown-source queue instead of being dropped (`quic::admission`).
     unknown_lane: AtomicBool,
+    /// Allowed sources that are admitted native joiners, not yet promoted,
+    /// each with the number of live joiner permits for it.
+    joiners: DashMap<SocketAddr, usize>,
+    /// Datagrams queued and not yet received that hold a slot of the
+    /// joiners' share ([`QUIC_INGRESS_JOINER_DATAGRAMS`]).
+    joiner_queued: AtomicUsize,
 }
 
 /// The QUIC ingress of one [`DemuxSocket`]: the queue's sending half and the
@@ -156,7 +190,7 @@ impl QuicIngressReceiver {
     pub(crate) fn poll_recv(&mut self, cx: &mut Context<'_>) -> Poll<Option<QuicDatagram>> {
         match self.queue.poll_recv(cx) {
             Poll::Ready(Some(datagram)) => {
-                self.release(datagram.from);
+                self.release(&datagram);
                 Poll::Ready(Some(datagram))
             }
             Poll::Ready(None) => Poll::Ready(None),
@@ -169,17 +203,22 @@ impl QuicIngressReceiver {
         }
     }
 
-    fn release(&self, from: SocketAddr) {
-        self.shared.queued.remove_if_mut(&from, |_, queued| {
-            *queued = queued.saturating_sub(1);
-            *queued == 0
-        });
+    fn release(&self, datagram: &QuicDatagram) {
+        if datagram.joiner_slot {
+            self.shared.joiner_queued.fetch_sub(1, Ordering::AcqRel);
+        }
+        self.shared
+            .queued
+            .remove_if_mut(&datagram.from, |_, queued| {
+                *queued = queued.saturating_sub(1);
+                *queued == 0
+            });
     }
 
     #[cfg(test)]
     pub(crate) fn try_recv(&mut self) -> Result<QuicDatagram, mpsc::error::TryRecvError> {
         let datagram = self.queue.try_recv()?;
-        self.release(datagram.from);
+        self.release(&datagram);
         Ok(datagram)
     }
 
@@ -221,6 +260,31 @@ impl QuicSourcePermit {
     }
 }
 
+/// Marks an allowed source as an unpromoted native joiner while it lives
+/// ([`DemuxSocket::allow_quic_joiner`]); dropping it is promotion (or the
+/// end of the join), after which the source's datagrams take the established
+/// share. Datagrams already queued keep the slots they took.
+#[must_use = "the source counts as a joiner only while the mark is alive"]
+pub(crate) struct QuicJoinerMark {
+    shared: Arc<IngressShared>,
+    addr: SocketAddr,
+}
+
+impl Drop for QuicJoinerMark {
+   
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +8/-0)
```diff
@@ -667,6 +667,14 @@ labelled_counters! {
         Joined => "joined",
         /// A join panicked; its task's owner caught it and goes on.
         JoinPanicked => "join_panicked",
+        /// An attempt was ignored: no room for another joiner inside the
+        /// node's QUIC connection cap (`admission`, `QuicPathPermits`), or
+        /// the cap is not attached yet.
+        JoinerCapFull => "joiner_cap_full",
+        /// A datagram from an admitted, unpromoted joiner was dropped: the
+        /// joiners' share of the ingress queue was full
+        /// (`demux::QUIC_INGRESS_JOINER_DATAGRAMS`).
+        JoinerShareFull => "joiner_share_full",
     }
 }
 
```

**File**: `crates/core/src/transport/quic.rs` (modified, +105/-13)
```diff
@@ -72,13 +72,14 @@ use tokio::sync::mpsc;
 
 use super::Socket;
 use super::crypto::{TransportKeypair, TransportPublicKey};
-use super::demux::{DemuxSocket, QuicSourcePermit};
+use super::demux::{DemuxSocket, QuicJoinerMark, QuicSourcePermit};
 use super::metrics::{QuicCloseCode, TRANSPORT_METRICS};
 use crate::config::GlobalExecutor;
 use crate::node::background_task_monitor::LateRegistrar;
 use crate::simulation::TimeSource;
 use identity::{PeerKey, QuicIdentity};
 use liveness::EndpointHealth;
+use upgrade::policy::{QuicJoinerPermit, QuicPathPermit, QuicPathPermits};
 
 pub(crate) use config::QuicSettings;
 pub(crate) use liveness::QuicAvailability;
@@ -251,6 +252,10 @@ pub(crate) struct EndpointCore {
     /// by [`QuicEndpoint::enable_gateway_admission`] (dark: see
     /// [`admission::GATEWAY_NATIVE_ADMISSION`]).
     admission: Arc<OnceLock<GatewayAdmission>>,
+    /// The node's QUIC path permits, which admitted joiners are charged
+    /// against ([`QuicEndpoint::attach_joiner_cap`]). Until it is set, no
+    /// joiner is admitted.
+    joiner_cap: Arc<OnceLock<QuicPathPermits>>,
     /// Test hooks that inject faults into quinn's drivers.
     #[cfg(any(test, feature = "testing"))]
     faults: Arc<socket::SocketFaults>,
@@ -403,6 +408,9 @@ trait QuicSources: Send + Sync {
     fn enable_unknown_source_lane(&self) -> bool;
     fn allow(&self, addr: SocketAddr) -> Option<QuicSourcePermit>;
     fn allow_existing(&self, addr: SocketAddr) -> Option<QuicSourcePermit>;
+    /// [`Self::allow`] for an admitted native joiner: its datagrams share the
+    /// joiners' slots of the ingress queue until the mark is dropped.
+    fn allow_joiner(&self, addr: SocketAddr) -> Option<(QuicSourcePermit, QuicJoinerMark)>;
     /// Send one datagram outside quinn, without waiting (a native punch).
     fn try_send(&self, datagram: &[u8], to: SocketAddr) -> io::Result<usize>;
 }
@@ -420,6 +428,10 @@ impl<S: Socket> QuicSources for DemuxSocket<S> {
         self.allow_existing_quic_source(addr)
     }
 
+    fn allow_joiner(&self, addr: SocketAddr) -> Option<(QuicSourcePermit, QuicJoinerMark)> {
+        self.allow_quic_joiner(addr)
+    }
+
     fn try_send(&self, datagram: &[u8], to: SocketAddr) -> io::Result<usize> {
         Socket::try_send_to(self, datagram, to)
     }
@@ -668,6 +680,7 @@ impl QuicEndpoint {
                 cap_holds: cap_holds.expect("the QUIC socket's cap holds"),
                 buffer_budget,
                 admission: Arc::default(),
+                joiner_cap: Arc::default(),
                 #[cfg(any(test, feature = "testing"))]
                 faults: faults.unwrap_or_default(),
                 #[cfg(any(test, feature = "testing"))]
@@ -700,6 +713,15 @@ impl QuicEndpoint {
         self.admission.set(gate).is_ok() && self.sources.enable_unknown_source_lane()
     }
 
+    /// Charge admitted native joiners against `permits`, the node's QUIC
+    /// path permits (the connection cap): each joiner takes a handshake-phase
+    /// charge from its admission until it is promoted or released. Set once
+    /// by the hub that owns the permits; until then every joiner is ignored
+    /// (counted `joiner_cap_full`). Whether it took effect.
+    pub(crate) fn attach_joiner_cap(&self, permits: QuicPathPermits) -> bool {
+        self.joiner_cap.set(permits).is_ok()
+    }
+
     /// Whether [`Self::enable_gateway_admission`] took effect.
     pub(crate) fn gateway_admission_enabled(&self) -> bool {
         self.admission.get().is_some()
@@ -1117,18 +1139,37 @@ impl EndpointCore {
             }
         };
         super::TRANSPORT_METRICS.record_gateway_admission(Outcome::Admitted);
+        // Item 5: the joiner counts against the connection cap from here,
+        // at the handshake-phase charge. With no room (or no cap attached
+        // yet) the attempt is ignored and the admission given back (the
+        // ticket drops). The charge is released by dropping it: the
+        // handshake failing, the join window passing and the connection
+        // closing all end the future that holds it, and promotion hands it
+        // back as a path permit.
+        let Some(charge) = self
+            .joiner_cap
+            .get()
+            .and_then(QuicPathPermits::try_acquire_joiner)
+        else {
+            super::TRANSPORT_METRICS.record_gateway_admission(Outcome::JoinerCapFull);
+            incoming.ignore();
+            return None;
+        };
         // The handshake's later datagrams are shorter than an Initial and
         // take the established path, so the address goes on the allow-set
-        // now, held by the connection. A full set gives the admission back
-        // (the ticket drops).
-        let Some(permit) = self.sources.allow(remote) else {
+        // now, held by the connection, and marked as a joiner so that all
+        // joiners share one bounded part of the ingress queue. A full set
+        // gives the admission and the charge back (bot
```

**File**: `crates/core/src/transport/quic/admission.rs` (modified, +13/-5)
```diff
@@ -25,6 +25,14 @@
 //! 4. At most [`GLOBAL_RATE_PER_SEC`] validated attempts per second for the
 //!    node, a token bucket of one second's worth.
 //!
+//! 5. A joiner takes a handshake-phase charge against the node's connection
+//!    cap ([`super::upgrade::policy::QuicPathPermits`]) from its admission,
+//!    released when its join ends or re-charged at the full rate at
+//!    promotion; with no room, or no cap attached yet, the attempt is
+//!    ignored ([`GatewayAdmission::JoinerCapFull`]). Its address is marked
+//!    as a joiner on the allow-set, so all unpromoted joiners share one
+//!    bounded part of the ingress queue.
+//!
 //! An attempt over a limit is ignored, with no reason given. An admitted one
 //! is recorded at once, against both limits, as an [`AdmissionTicket`]; the
 //! ticket gives the admission back (counted `refunded`) if it is dropped
@@ -49,9 +57,10 @@ use crate::transport::normalize_mapped_addr;
 /// about. The change that turns it on is a one-line change here, and it
 /// waits for:
 ///
-/// - joiners counted inside the node's connection cap (the next A7b PR),
-///   with the share of the QUIC ingress queue an admitted joiner may hold
-///   settled in the same PR;
+/// - (done, A7b PR 6) joiners counted inside the node's connection cap at
+///   the handshake-phase charge, and all unpromoted joiners held to one small
+///   share of the QUIC ingress queue
+///   (`demux::QUIC_INGRESS_JOINER_DATAGRAMS`);
 /// - phase B: the node takes the admitted connection (`ConnectRequest` on
 ///   it, transient to promoted). Until then a join that completes is closed
 ///   at the hook (`driver::join_gateway`);
@@ -498,8 +507,7 @@ pub(in crate::transport::quic) mod tests {
     #[test]
     fn proven_key_is_read_only_after_the_handshake_completes() {
         let quic = include_str!("../quic.rs");
-        let signature =
-            "    pub(crate) async fn establish(self) -> Result<QuicConnection, JoinerError> {";
+        let signature = "    pub(crate) async fn establish(self) -> Result<(QuicConnection, JoinerCharge), JoinerError> {";
         let start = quic.find(signature).expect("JoinerIncoming::establish");
         let len = quic[start..].find("\n    }\n").expect("its end");
         let body = &quic[start..start + len];
```

**File**: `crates/core/src/transport/quic/config.rs` (modified, +36/-0)
```diff
@@ -427,6 +427,42 @@ pub(crate) const QUIC_SHADOW_CONNECTION_CHARGE_BYTES: usize = QUIC_CONNECTION_FI
     + super::upgrade::machine::CONTROL_SENDS_PER_PATH
         * (QUIC_STOPPED_ENTRY_BYTES + QUIC_ACK_WAIT_BYTES);
 
+/// What one native joiner may hold from its first packet until it is
+/// promoted or released (`admission`, QUIC-NATIVE-CONNECT 5.1 item 5): the
+/// fixed state; quinn's state for the [`INITIAL_UNI_STREAMS`] uni streams the
+/// endpoint lets a peer open; the CRYPTO reassembly of all three packet
+/// number spaces (a half-open connection holds the Initial and Handshake
+/// spaces besides the 1-RTT one, [`QUIC_CRYPTO_HOLD_BYTES`] each); the
+/// receive charge at the [`INITIAL_RECEIVE_WINDOW_BYTES`] windows; and the
+/// ACK-only tail. It carries no data (data off) and sends no control frames
+/// of its own, so none of the data path's stopped-entry, ack-wait or
+/// control-channel terms apply. Against [`QUIC_CONNECTION_CHARGE_BYTES`] plus
+/// a floor grant: a promoted joiner is charged that in full
+/// (`upgrade::policy::QuicJoinerPermit::promote`).
+pub(crate) const QUIC_HANDSHAKE_PHASE_CHARGE_BYTES: usize = QUIC_CONNECTION_FIXED_BYTES
+    + INITIAL_UNI_STREAMS as usize * QUIC_OPEN_STREAM_BYTES
+    + 3 * QUIC_CRYPTO_HOLD_BYTES
+    + QUIC_ACK_TAIL_BYTES
+    + super::budget::receive_charge(INITIAL_RECEIVE_WINDOW_BYTES) as usize;
+
+/// The granularity the path permits count memory in (`upgrade::policy::
+/// QuicPathPermits`): a path is [`PATH_PERMIT_UNITS`] of these and a joiner
+/// [`JOINER_PERMIT_UNITS`], each rounded UP, so a permit is charged at least
+/// its bytes. The floor grant a data path also holds is left out of the
+/// path's side, so a joiner is charged slightly more than its share of the
+/// cap, the safe direction.
+pub(crate) const PERMIT_UNIT_BYTES: usize = 16 * 1024;
+
+/// Permit units of one data path, [`QUIC_CONNECTION_CHARGE_BYTES`] rounded up.
+pub(crate) const PATH_PERMIT_UNITS: usize =
+    QUIC_CONNECTION_CHARGE_BYTES.div_ceil(PERMIT_UNIT_BYTES);
+
+/// Permit units of one joiner, [`QUIC_HANDSHAKE_PHASE_CHARGE_BYTES`] rounded up.
+pub(crate) const JOINER_PERMIT_UNITS: usize =
+    QUIC_HANDSHAKE_PHASE_CHARGE_BYTES.div_ceil(PERMIT_UNIT_BYTES);
+
+const _: () = assert!(JOINER_PERMIT_UNITS >= 1 && JOINER_PERMIT_UNITS < PATH_PERMIT_UNITS);
+
 /// The share of the node's memory for QUIC buffers that scale with the windows,
 /// as a divisor: one sixteenth.
 const QUIC_BUFFER_BUDGET_DIVISOR: usize = 16;
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +360/-8)
```diff
@@ -5367,6 +5367,13 @@ fn a_proven_server_config_accepts_each_client_by_its_own_key() {
     })
 }
 
+/// Turn gateway admission on for `endpoint` with room for 64 paths' worth of
+/// joiners, as the hub does with the node's path permits.
+fn enable_admission(endpoint: &QuicEndpoint, time: VirtualTime) -> bool {
+    endpoint.attach_joiner_cap(super::upgrade::policy::QuicPathPermits::new(64));
+    endpoint.enable_gateway_admission(time)
+}
+
 /// What a client's native dial to `server` gave, and what `server`'s
 /// accept loop made of the attempts it read, for the admission tests.
 async fn native_dial_to_gateway(
@@ -5390,7 +5397,12 @@ async fn native_dial_to_gateway(
     drive(time, limit, async move {
         let accept = async {
             match server.accept_attempt().await {
-                Some(super::EndpointAttempt::Joiner(joiner)) => Some(joiner.establish().await),
+                Some(super::EndpointAttempt::Joiner(joiner)) => Some(
+                    joiner
+                        .establish()
+                        .await
+                        .map(|(connection, _charge)| connection),
+                ),
                 Some(super::EndpointAttempt::Allowed(_)) => {
                     panic!("the client was never allowed")
                 }
@@ -5414,9 +5426,9 @@ fn a_gateway_with_admission_accepts_a_native_join_from_an_unknown_source() {
         let _seed = GlobalRng::seed_guard(SEED);
         let net = crate::transport::test_net::subnet();
         let pair = pair("quic-admission-join", net.addr(1), net.addr(2), None).await;
-        assert!(pair.b.enable_gateway_admission(pair.time.clone()));
+        assert!(enable_admission(&pair.b, pair.time.clone()));
         assert!(
-            !pair.b.enable_gateway_admission(pair.time.clone()),
+            !enable_admission(&pair.b, pair.time.clone()),
             "once per endpoint"
         );
         let (dialled, joined) = native_dial_to_gateway(
@@ -5521,7 +5533,7 @@ fn a_gateways_admission_decides_on_the_endpoints_clock() {
         let _seed = GlobalRng::seed_guard(SEED);
         let net = crate::transport::test_net::subnet();
         let pair = pair("quic-admission-clock", net.addr(1), net.addr(2), None).await;
-        assert!(pair.b.enable_gateway_admission(pair.time.clone()));
+        assert!(enable_admission(&pair.b, pair.time.clone()));
         use super::admission::tests::{DecideKept, Verdict};
         let admission = &pair.b.admission.get().expect("enabled").decisions;
         let from = pair.a_addr;
@@ -5549,7 +5561,7 @@ fn an_admitted_join_exchanges_hellos_and_is_closed_at_the_hook() {
             let _seed = GlobalRng::seed_guard(SEED);
             let net = crate::transport::test_net::subnet();
             let pair = pair("quic-admission-hello", net.addr(1), net.addr(2), None).await;
-            assert!(pair.b.enable_gateway_admission(pair.time.clone()));
+            assert!(enable_admission(&pair.b, pair.time.clone()));
             let server_peer = PeerKey::of(pair.b_keys.public()).unwrap();
             let tls = pair
                 .a
@@ -5628,7 +5640,7 @@ fn a_gateway_hello_lost_at_first_is_retransmitted_before_the_join_closes() {
         let _seed = GlobalRng::seed_guard(SEED);
         let net = crate::transport::test_net::subnet();
         let pair = pair("quic-admission-hello-lost", net.addr(1), net.addr(2), None).await;
-        assert!(pair.b.enable_gateway_admission(pair.time.clone()));
+        assert!(enable_admission(&pair.b, pair.time.clone()));
         let server_peer = PeerKey::of(pair.b_keys.public()).unwrap();
         let tls = pair
             .a
@@ -5697,7 +5709,7 @@ fn an_admission_refused_by_a_full_allow_set_is_given_back() {
         let _seed = GlobalRng::seed_guard(SEED);
         let net = crate::transport::test_net::subnet();
         let pair = pair("quic-admission-allow-full", net.addr(1), net.addr(2), None).await;
-        assert!(pair.b.enable_gateway_admission(pair.time.clone()));
+        assert!(enable_admission(&pair.b, pair.time.clone()));
         let max = crate::transport::demux::QUIC_ALLOWED_SOURCES_MAX;
         // Allow-set entries only: never bound, sent to, or read from a log.
         let filler = |i: usize| SocketAddr::from(([10, 252, (i >> 8) as u8, i as u8], 1)); // test_net: exempt (allow-set filler)
@@ -5749,7 +5761,7 @@ fn a_dropped_joiner_gives_its_admission_back() {
         let _seed = GlobalRng::seed_guard(SEED);
         let net = crate::transport::test_net::subnet();
         let pair = pair("quic-admission-dropped", net.addr(1), net.addr(2), None).await;
-        assert!(pair.b.enable_gateway_admission(pair.time.clone()));
+        assert!(enable_admission(&pair.b, pair.time.clone()));
         let server_peer = PeerKey::of(pair.b_keys.public()).unwrap();
         let tls = pair
             .a
@@ -5787,6 +5799,346 @@ fn a_dropped_joiner_gives_its_admission_back() {
     })
 }
 
+/// A client config for a native dial from `clien
```

---

### Incident Patch 3: `ec1aa022` (2026-11-19)
**Commit Message**: fix(server): bound web-app archive unpacking and whole-file reads (#6281)

**File**: `crates/core/src/contract/executor.rs` (modified, +20/-0)
```diff
@@ -2921,6 +2921,26 @@ mod tests {
                 "unpacked-webapp cache under the XDG CACHE dir; on disk, and by its own \
                  doc outside the node's disk accounting too, so it is not resident memory",
             ),
+            (
+                "MAX_UNPACKED_TOTAL_BYTES",
+                "per-archive limit on one web-app unpack, written to disk; not a standing cache",
+            ),
+            (
+                "MAX_UNPACKED_FILE_BYTES",
+                "per-file limit within one web-app unpack, written to disk; not a standing cache",
+            ),
+            (
+                "TAR_ENTRY_OVERHEAD_BYTES",
+                "per-entry allowance used to derive the web-app decompressed-stream cap",
+            ),
+            (
+                "MAX_DECOMPRESSED_STREAM_BYTES",
+                "per-unpack cap on a streaming decoder, transient and freed when the unpack ends",
+            ),
+            (
+                "MAX_REWRITTEN_ASSET_BYTES",
+                "per-request read bound for one .js or HTML file, transient",
+            ),
             ("LOG_DIR_MAX_BYTES", "on-disk log rotation cap"),
             ("MIN_LOG_DIR_MAX_BYTES", "clamp for that log rotation cap"),
             (
```

**File**: `crates/core/src/server/app_packaging.rs` (modified, +377/-42)
```diff
@@ -1,7 +1,7 @@
 //! Helper functions and types for dealing with HTTP client API compatible contracts.
 use std::{
     io::{Cursor, Read},
-    path::Path,
+    path::{Path, PathBuf},
 };
 use tracing::{debug, instrument};
 
@@ -19,6 +19,67 @@ pub enum WebContractError {
     FileNotFound(String),
 }
 
+/// Largest compressed web archive accepted from a contract's state.
+const MAX_WEB_SIZE: u64 = 1024 * 1024 * 100;
+
+/// Most bytes a web archive may unpack to, summed over all entries.
+///
+/// `MAX_WEB_SIZE` bounds only the compressed bytes, and xz compresses runs of
+/// zeros by several orders of magnitude, so it says nothing about what lands on
+/// disk or in memory. This bound is below the node's webapp cache budget
+/// (`WEBAPP_CACHE_MAX_BYTES`, 64 MiB; a test in `path_handlers` pins the
+/// relation) so a single archive can never exceed the budget by itself, and well
+/// above the largest real web app we have measured (about 23 MB unpacked, 14.5 MB
+/// of it one wasm file).
+pub(crate) const MAX_UNPACKED_TOTAL_BYTES: u64 = 48 * 1024 * 1024;
+
+/// Largest single file in a web archive. Twice the largest wasm bundle measured
+/// (14.5 MB), and below the total bound.
+pub(crate) const MAX_UNPACKED_FILE_BYTES: u64 = 32 * 1024 * 1024;
+
+/// Most entries (files plus directories) in a web archive. Real apps have tens
+/// to a few hundred.
+pub(crate) const MAX_ARCHIVE_ENTRIES: usize = 4096;
+
+/// Per-entry allowance for tar headers, extension records and padding when
+/// bounding the raw decompressed stream.
+const TAR_ENTRY_OVERHEAD_BYTES: u64 = 4096;
+
+/// Most decompressed bytes read from the xz stream, headers and padding
+/// included. Backstops the per-entry checks: whatever the tar headers claim,
+/// the decoder is never asked for more than this.
+const MAX_DECOMPRESSED_STREAM_BYTES: u64 =
+    MAX_UNPACKED_TOTAL_BYTES + MAX_ARCHIVE_ENTRIES as u64 * TAR_ENTRY_OVERHEAD_BYTES;
+
+/// A reader that fails (rather than reporting a clean EOF) once more than
+/// `remaining` bytes have been read.
+struct LimitedReader<R> {
+    inner: R,
+    remaining: u64,
+}
+
+impl<R: Read> Read for LimitedReader<R> {
+    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
+        if buf.is_empty() {
+            return Ok(0);
+        }
+        if self.remaining == 0 {
+            // At the limit: any further byte is an error, a clean EOF is fine.
+            let mut probe = [0u8; 1];
+            return match self.inner.read(&mut probe)? {
+                0 => Ok(0),
+                _ => Err(std::io::Error::other(
+                    "web archive exceeds the decompressed size limit",
+                )),
+            };
+        }
+        let max = self.remaining.min(buf.len() as u64) as usize;
+        let n = self.inner.read(&mut buf[..max])?;
+        self.remaining -= n as u64;
+        Ok(n)
+    }
+}
+
 #[non_exhaustive]
 pub struct WebApp {
     pub metadata: Vec<u8>,
@@ -79,22 +140,51 @@ impl WebApp {
     /// path traversal / zip-slip). See freenet/freenet-core#3946.
     ///
     /// We therefore validate each entry ourselves and **reject** (rather than
-    /// silently skip) anything that could escape the destination:
+    /// silently skip) anything that could escape the destination or exhaust the
+    /// node's resources:
     ///
-    /// - absolute paths,
-    /// - any component equal to `..` (`ParentDir`),
-    /// - symlink and hardlink entries (web apps have no legitimate need for
-    ///   them, and they are the primary symlink-escape vector).
+    /// - every entry type other than regular files and directories (links,
+    ///   GNU sparse files, devices, FIFOs, ...),
+    /// - absolute paths and any component equal to `..` (`ParentDir`),
+    /// - more than [`MAX_ARCHIVE_ENTRIES`] entries, any file larger than
+    ///   [`MAX_UNPACKED_FILE_BYTES`], or more than [`MAX_UNPACKED_TOTAL_BYTES`]
+    ///   in total. The decoder itself is also capped, so the limits hold
+    ///   whatever the tar headers claim.
     ///
     /// Overwrite is disabled so a republished contract cannot clobber files
-    /// already present at the destination via a crafted duplicate entry.
+    /// already present at the destination via a crafted duplicate entry. On any
+    /// error, everything this call created under `dst` is removed again.
     #[instrument(level = "debug", skip(self, dst))]
     pub fn unpack(&mut self, dst: impl AsRef<Path>) -> Result<(), WebContractError> {
+        let dst = dst.as_ref();
+        debug!("Unpacking web content to {:?}", dst);
+
+        let mut created: Vec<PathBuf> = Vec::new();
+        let result = self.unpack_checked(dst, &mut created);
+        if result.is_err() {
+            for path in created.iter().rev() {
+                let removed = if path.is_dir() {
+                    std::fs::remove_dir_all(path)
+                } else {
+                    std::fs::remove_file(path)
+                };
+                if let Err(e) =
```

**File**: `crates/core/src/server/path_handlers.rs` (modified, +496/-36)
```diff
@@ -141,8 +141,17 @@ static CONTRACT_REFRESH_LOCKS: LazyLock<
 enum TerminalAbsenceKind {
     ContractNotFound,
     MissingContract,
+    /// The contract's state is not an archive this node will unpack (malformed,
+    /// or over the unpack limits). The answer is a function of the state, so it
+    /// repeats until the state changes; without recording it, every request
+    /// re-fetches and re-unpacks the same refused archive.
+    ArchiveRefused,
 }
 
+/// Prefix of the error `unpack_if_stale` returns for an archive it refuses;
+/// `ensure_contract_cached`'s caller recognises it to record the refusal.
+const UNPACK_FAILED_PREFIX: &str = "failed unpacking contract: ";
+
 impl TerminalAbsenceKind {
     fn into_error(self, instance_id: ContractInstanceId) -> WebSocketApiError {
         match self {
@@ -152,6 +161,9 @@ impl TerminalAbsenceKind {
             TerminalAbsenceKind::MissingContract => {
                 WebSocketApiError::MissingContract { instance_id }
             }
+            TerminalAbsenceKind::ArchiveRefused => WebSocketApiError::InvalidParam {
+                error_cause: format!("{UNPACK_FAILED_PREFIX}{instance_id}"),
+            },
         }
     }
 }
@@ -370,6 +382,39 @@ fn try_acquire_cache_lock(
 /// sit on a different mount than the one the budget's free-space term measures).
 const WEBAPP_CACHE_MAX_BYTES: u64 = 64 * 1024 * 1024;
 
+// One archive must fit the budget on its own: the sweep never evicts the entry
+// that triggered it (`in_use`), so an entry larger than the budget would stay
+// over it. The unpack limits guarantee that cannot happen.
+const _: () = assert!(super::app_packaging::MAX_UNPACKED_TOTAL_BYTES < WEBAPP_CACHE_MAX_BYTES);
+
+/// Largest cached file the handlers will read whole into memory, for the two
+/// cases that rewrite text (`.js` and HTML pages). Everything else is streamed
+/// by `ServeFile`. Real bundles are well under 1 MB; this is far above that, and
+/// the rewrite holds about three copies (bytes, `String`, rewritten `String`)
+/// so memory per request stays under about 50 MB.
+const MAX_REWRITTEN_ASSET_BYTES: u64 = 16 * 1024 * 1024;
+
+/// Bumped whenever the unpack rules change, so a cache written under older,
+/// weaker rules no longer matches the stored state hash and is unpacked again
+/// (and rejected, if it violates the new limits) on the next reconcile.
+const WEBAPP_CACHE_FORMAT: u64 = 2;
+
+/// Read `path` whole, refusing files larger than `limit` bytes. The bound is
+/// enforced on the bytes actually read, not on the file's reported length, so a
+/// file that grows or is sparse cannot exceed it.
+async fn read_file_bounded(path: &Path, limit: u64) -> std::io::Result<Vec<u8>> {
+    let file = File::open(path).await?;
+    let mut buf = Vec::new();
+    file.take(limit + 1).read_to_end(&mut buf).await?;
+    if buf.len() as u64 > limit {
+        return Err(std::io::Error::other(format!(
+            "{} is larger than the {limit} byte limit for rewritten assets",
+            path.display()
+        )));
+    }
+    Ok(buf)
+}
+
 /// How long an entry is protected from eviction after this process last served
 /// from it.
 ///
@@ -1393,6 +1438,11 @@ async fn refresh_cache_if_due(
             Err(WebSocketApiError::MissingContract { .. }) => {
                 Some(TerminalAbsenceKind::MissingContract)
             }
+            Err(WebSocketApiError::InvalidParam { error_cause })
+                if error_cause.starts_with(UNPACK_FAILED_PREFIX) =>
+            {
+                Some(TerminalAbsenceKind::ArchiveRefused)
+            }
             _ => None,
         };
         refresh.last_cold_failure =
@@ -1699,6 +1749,15 @@ async fn handle_get_response(
 ///
 /// Both exits then run [`maybe_enforce_webapp_cache_budget`], which is what
 /// keeps the cache from growing without bound (see [`WEBAPP_CACHE_MAX_BYTES`]).
+///
+/// # Cancellation safety
+///
+/// Dropping this future is safe. Once the directory mutation starts it runs in
+/// a detached task that owns the lock guard, so it completes, and releases the
+/// lock, whether or not the caller is still waiting. A later call therefore
+/// waits for it instead of unpacking into the same directory concurrently.
+/// Only the trailing budget sweep is skipped, and the next unpack or debounced
+/// reconcile sweep covers it.
 async fn unpack_if_stale(
     contract: &ContractContainer,
     state_bytes: &[u8],
@@ -1735,54 +1794,91 @@ async fn unpack_if_stale(
     }
 
     debug!("State changed or not cached, unpacking webapp");
-    let state = State::from(state_bytes);
 
-    fn err(err: WebContractError, contract: &ContractContainer) -> WebSocketApiError {
-        let key = contract.key();
-        tracing::error!("{err}");
-        WebSocketApiError::InvalidParam {
-            error_cause: format!("failed unpacking contract: {key}"),
+    // The mutation below runs in a DETACHED task that owns the per-contract
+    // lock guard. `spawn_blocking` work canno
```

#### Recent Merged Pull Requests:
- **PR #6298** (2026-11-19): fix: bound contract-handler event admission per priority class (@sanity)
- **PR #6297** (2026-11-19): feat(quic): native joiners inside the connection cap, with their own queue share (@sanity)
- **PR #6295** (2026-11-19): test: give the merge-budget sims a measured nextest timeout (@sanity)
- **PR #6294** (2026-11-19): feat(connect): keep the UDP connection until native carries a frame (option b) (@sanity)
- **PR #6293** (2026-11-19): fix(transport): draw AES-GCM nonces from one process-wide counter (@sanity)
- **PR #6289** (2026-11-19): fix(transport): give a node's threads one stream-id counter (@sanity)

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

## X. bound contract-handler event admission per priority class

**RULE**:
When implementing operations in `.claude/rules/operations.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a1b7415e`: bound contract-handler event admission per priority class. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/operations.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
**Admission lanes in front of the fair queue (ANT-2026-K0YQ8CG4).** Events
reach `contract_handling` over four channels, chosen by `handler::Lane::of`:
control (`ClientDisconnect`, `EvictContract`, by event type and whatever
their priority; unbounded, never refused), client (`ClientLocal`, 2048),
relay (`NetworkRelay`, 1024) and background (`Background`, 256). Every send
into them is non-blocking (`try_send`); NEVER add a `.send().await` there
(pinned by `no_send_into_the_lanes_waits`). A full bounded lane answers the
caller at once with the same typed `ContractQueueFull` response the fair
queue gives a refused event (`queue_full_response_for`), so a full client
lane is now an immediate `ContractQueueFull` to the client rather than a
wait. Each loop iteration drains control in full, then up to 256 client, 256
relay and 64 background events, so a client event reaches the
`ClientLocal` tier within one execution. The tag you choose therefore also
picks the lane: a node-originated burst tagged `NetworkRelay` competes with
peers' requests for relay-lane room.

Relay drivers bound the relay lane per peer. `start_relay_get`,
`start_relay_put`, `start_relay_put_streaming` and the four rela
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
scope, user, responder), into this loop's event channel. The fair-queue
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a1b7415e` are properly handled with clean fallback behavior.
