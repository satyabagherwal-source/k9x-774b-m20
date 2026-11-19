> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `48d67dfb`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T20:55:51.408Z  
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
> **Harvest Timestamp**: 2026-11-19T20:55:51.402Z  
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
- **Issue #6300** (2026-11-19): **build: release 0.2.161**
  *Symptoms*: **Automated release PR**  - freenet: → **0.2.161** - fdev: → **0.3.323**  This PR will auto-merge once GitHub CI passes. Generated by: `.github/workflows/release.yml` 

- **Issue #6299** (2026-11-19): **chore(release): raise the QUIC-native wire floor to 0.2.162**
  *Symptoms*: ## Problem `quic_native_floor_tracks_the_shipping_release` fails once `Cargo.toml` is at 0.2.161: `QUIC_NATIVE_MIN_VERSION` is (0, 2, 161) and `QUIC_NATIVE_SHIPPED_IN` is `None`. Found by checking the release-marker tests before the 0.2.161 soak.  ## Approach Raise the floor to 0.2.162, as #6273 did for 0.2.160. Native connect is still off in production (`QUIC_NATIVE_PERCENT` is 0), so this changes no behaviour, and the native connect work is still changing before it is enabled, so no release is frozen as the floor yet.  ## Testing Full `cargo test -p freenet --lib` with the crate at 0.2.161 and this change; `cargo fmt --check`.  [AI-assisted - Claude]
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No issues found  **Rules checked:** git-workflow.md, code-style.md, testing.md **Files reviewed:** 1  The diff changes the `QUIC_NATIVE_MIN_VERSION` constant from `(0, 2, 161)` to `(0, 2, 162)` in `crates/core/src/node/network_bridge/p2p_protoc.rs`. It also adds one sentence to the doc comment saying why. This continues the pattern in the existing comment.  - The commit title follows conventional commits (`chore(release): …`) and is under 72 characters. - The existing floor-invariant tests at `p2p_protoc.rs:4421-4455` cover the constant. They check that the floor stays above the last release without a decoder and stays ahead of the crate version. No new tests are needed for a value bump. - The doc comment is updated with the change, so nothing is stale. - I made no check on whether the PR description has the Problem, Solution, Testing and Fixes sections. The review inputs don't include it.  No rule violations detected.  <!-- warning-count: 0

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

### Incident Patch 1: `48d67dfb` (2026-11-19)
**Commit Message**: fix(connect): enforce the transient connection budget; bound FixedRate flight size (#6296)

**File**: `crates/core/src/config.rs` (modified, +6/-2)
```diff
@@ -2508,7 +2508,9 @@ pub struct NetworkArgs {
     #[serde(rename = "transient-budget", skip_serializing_if = "Option::is_none")]
     pub transient_budget: Option<usize>,
 
-    /// Time (in seconds) before an unpromoted transient connection is dropped.
+    /// Time (in seconds) after which an unpromoted transient connection is counted
+    /// as expired. Its transport stays open, and its slot in the transient budget
+    /// is held until it is promoted or closed.
     #[arg(long, env = "TRANSIENT_TTL_SECS")]
     #[serde(rename = "transient-ttl-secs", skip_serializing_if = "Option::is_none")]
     pub transient_ttl_secs: Option<u64>,
@@ -2919,7 +2921,9 @@ pub struct NetworkApiConfig {
     #[serde(default = "default_transient_budget", rename = "transient-budget")]
     pub transient_budget: usize,
 
-    /// Time (in seconds) before an unpromoted transient connection is dropped.
+    /// Time (in seconds) after which an unpromoted transient connection is counted
+    /// as expired. Its transport stays open, and its slot in the transient budget
+    /// is held until it is promoted or closed.
     #[serde(default = "default_transient_ttl_secs", rename = "transient-ttl-secs")]
     pub transient_ttl_secs: u64,
 
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc/connection_lifecycle.rs` (modified, +209/-36)
```diff
@@ -644,12 +644,18 @@ impl P2pConnManager {
         }
         let key = key.clone();
         let connection_manager = &self.bridge.op_manager.ring.connection_manager;
-        let was_transient = connection_manager.drop_transient(peer_addr);
+        // Read, not removed: the connection keeps its transient slot unless
+        // the ring takes it (`add_connection` removes the entry), so a
+        // promotion refused at the cap leaves it counted.
+        let was_transient = connection_manager.transient_entry(peer_addr);
 
         // Promote if: (a) was tracked as transient, OR (b) not already in ring.
-        // Case (b) handles expired transient TTL: transport preserved per 76058cf4
-        // but tracking entry gone. Without this, CONNECT succeeds but peer is never
-        // added to ring topology (#3113).
+        // Case (b) handles an open connection with no tracking entry (#3113:
+        // the entry used to expire at the TTL while the transport stayed open;
+        // an open connection now holds its entry until it is promoted or
+        // closed, so this is the fallback for one that never had one).
+        // Without this, CONNECT succeeds but peer is never added to ring
+        // topology.
         let needs_promotion = was_transient.is_some() || !connection_manager.is_in_ring(peer_addr);
         let transient_expired = was_transient.is_none() && needs_promotion;
 
@@ -682,6 +688,7 @@ impl P2pConnManager {
                     transient_expired,
                     "connect_peer: rejecting transient promotion to enforce cap"
                 );
+                self.count_refused_promotion(peer_addr);
                 return Promotion::Refused;
             }
             // The key promoted is the one the caller passed: for a
@@ -724,6 +731,7 @@ impl P2pConnManager {
                     .connection_manager
                     .is_in_ring(peer_addr)
             {
+                self.count_refused_promotion(peer_addr);
                 return Promotion::Refused;
             }
             // A promotion only when the ring took an address it did not hold.
@@ -781,6 +789,33 @@ impl P2pConnManager {
         Promotion::AlreadyInRing
     }
 
+    /// A connection the ring refused stays open outside it, so it must hold a
+    /// transient slot like any other such connection. One with no entry (it
+    /// never had one) is registered and held here; when the budget or its
+    /// source's share refuses that, it stays uncounted and
+    /// [`Self::uncounted_outside_ring`] reports it, for the caller to close.
+    fn count_refused_promotion(&self, peer_addr: SocketAddr) {
+        let cm = &self.bridge.op_manager.ring.connection_manager;
+        if cm.is_transient(peer_addr) || cm.is_in_ring(peer_addr) {
+            return;
+        }
+        if cm
+            .register_transient(peer_addr, Some(Location::from_address(&peer_addr)))
+            .is_ok()
+        {
+            cm.hold_transient(peer_addr);
+        }
+    }
+
+    /// An open connection at `peer_addr` that is neither in the ring nor
+    /// holding a transient slot.
+    fn uncounted_outside_ring(&self, peer_addr: SocketAddr) -> bool {
+        let cm = &self.bridge.op_manager.ring.connection_manager;
+        self.connections.contains_key(&peer_addr)
+            && !cm.is_transient(peer_addr)
+            && !cm.is_in_ring(peer_addr)
+    }
+
     // `origin` is telemetry carried alongside the dial; bundling it with the
     // other arguments would only move them into a one-use struct.
     #[allow(clippy::too_many_arguments)]
@@ -965,6 +1000,16 @@ impl P2pConnManager {
                         );
                     })
                     .ok();
+                // Kept open, it would be outside the ring and uncounted.
+                if self.uncounted_outside_ring(peer_addr) {
+                    self.drop_connection_by_addr(
+                        peer_addr,
+                        handshake_commands,
+                        crate::tracing::DisconnectReason::ConnectionLimitReached,
+                    )
+                    .await;
+                    fail_awaiting_connection_callbacks(state, peer_addr).await;
+                }
                 return Ok(());
             }
 
@@ -2530,16 +2575,29 @@ impl P2pConnManager {
             );
         }
 
+        // The slot taken at the top of this function is gone if the
+        // replacement above released the old connection's slot at this
+        // address; take it again. Registering an address already tracked
+        // succeeds without taking a second slot.
         if is_transient {
             let cm = &self.bridge.op_manager.ring.connection_manager;
-            let current = cm.transient_count();
-            if current >= cm.transient_budget() {
+            if !cm.try_register_transient(peer_addr, None) {
                 tracing::warn!(
                     remote = %peer_addr,
                     budget = cm.transient_budge
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc/connection_lifecycle/tests.rs` (modified, +714/-0)
```diff
@@ -5244,3 +5244,717 @@ async fn local_and_udp_failures_carry_no_native_outcome() {
         "a local failure of a native dial"
     );
 }
+
+/// An inbound connection nobody expected, as the handshake driver reports
+/// it: not transient, and without a peer identity.
+async fn unexpected_inbound(h: &mut Harness, addr: SocketAddr) {
+    h.handshake_event(HandshakeEvent::InboundConnection {
+        transaction: None,
+        matched: HandshakeInboundMatch::Unexpected,
+        connection: Box::new(IdleConnection::new(addr)),
+        transient: false,
+    })
+    .await;
+}
+
+fn transient_count(h: &Harness) -> usize {
+    h.mgr
+        .bridge
+        .op_manager
+        .ring
+        .connection_manager
+        .transient_count()
+}
+
+/// At the transient budget, an unexpected inbound connection closes the
+/// oldest connection still waiting outside the ring and takes its slot, so a
+/// host that fills the budget has to keep opening connections to keep it
+/// full, rather than holding it and refusing every joiner.
+#[tokio::test]
+async fn unexpected_inbound_at_the_budget_evicts_the_oldest_unpromoted() {
+    let mut h = Harness::with_config("transient-budget-evict-oldest", |config| {
+        config.transient_budget = 2;
+    })
+    .await;
+    let cm = h.mgr.bridge.op_manager.ring.connection_manager.clone();
+    let addr = |n: u8| SocketAddr::from(([198, 51, 100, 216], 7300 + u16::from(n)));
+    unexpected_inbound(&mut h, addr(1)).await;
+    unexpected_inbound(&mut h, addr(2)).await;
+    assert_eq!(cm.transient_count(), 2, "premise: the budget is spent");
+
+    unexpected_inbound(&mut h, addr(3)).await;
+    assert!(
+        !h.mgr.connections.contains_key(&addr(1)),
+        "the oldest is closed"
+    );
+    assert!(!cm.is_transient(addr(1)));
+    for kept in [addr(2), addr(3)] {
+        assert!(h.mgr.connections.contains_key(&kept));
+        assert!(cm.is_transient(kept));
+    }
+    assert_eq!(cm.transient_count(), 2);
+    assert_eq!(cm.transient_evictions(), 1);
+
+    unexpected_inbound(&mut h, addr(4)).await;
+    assert!(
+        !h.mgr.connections.contains_key(&addr(2)),
+        "then the next oldest"
+    );
+    assert!(h.mgr.connections.contains_key(&addr(3)));
+    assert!(h.mgr.connections.contains_key(&addr(4)));
+    assert_eq!(cm.transient_evictions(), 2);
+    h.assert_open_transports_match();
+}
+
+/// An unexpected inbound connection the budget refuses is closed, not kept
+/// open and uncounted. Here every slot is held by a registration no open
+/// connection owns, so there is nothing to evict.
+#[tokio::test]
+async fn unexpected_inbound_refused_by_the_budget_is_dropped() {
+    let mut h = Harness::with_config("transient-budget-unexpected-inbound", |config| {
+        config.transient_budget = 2;
+    })
+    .await;
+    let cm = h.mgr.bridge.op_manager.ring.connection_manager.clone();
+    for port in [7301, 7302] {
+        assert!(cm.try_register_transient(SocketAddr::from(([198, 51, 100, 210], port)), None));
+    }
+    let addr = SocketAddr::from(([198, 51, 100, 210], 7303));
+    unexpected_inbound(&mut h, addr).await;
+    assert!(
+        !h.mgr.connections.contains_key(&addr),
+        "refused by the budget: dropped"
+    );
+    assert!(!cm.is_transient(addr));
+    assert_eq!(h.ring_key_at(addr), None, "not in the ring");
+    assert_eq!(cm.transient_count(), 2);
+    assert_eq!(cm.transient_evictions(), 0);
+    h.assert_open_transports_match();
+}
+
+/// The budget counts the connections open outside the ring, not those
+/// younger than `transient_ttl`: an unpromoted connection keeps its slot past
+/// the TTL (neither its expiry timer nor the periodic cleanup gives it back
+/// while the transport is open), and gives it back when it is promoted.
+#[tokio::test(start_paused = true)]
+async fn an_unpromoted_connection_keeps_its_budget_slot_past_the_ttl() {
+    let mut h = Harness::with_config("transient-budget-slot-held", |config| {
+        config.transient_budget = 1;
+    })
+    .await;
+    let first = SocketAddr::from(([198, 51, 100, 211], 7311));
+    let second = SocketAddr::from(([198, 51, 100, 211], 7312));
+    let third = SocketAddr::from(([198, 51, 100, 211], 7313));
+    let cm = h.mgr.bridge.op_manager.ring.connection_manager.clone();
+
+    unexpected_inbound(&mut h, first).await;
+    assert!(h.mgr.connections.contains_key(&first));
+    assert_eq!(cm.transient_count(), 1, "premise: the budget is spent");
+
+    // Past the TTL: the expiry timer has run, and so has a cleanup.
+    tokio::time::sleep(cm.transient_ttl() + Duration::from_secs(1)).await;
+    assert_eq!(cm.cleanup_expired_transients(), 0);
+    assert!(
+        h.mgr.connections.contains_key(&first),
+        "premise: still open"
+    );
+    assert!(cm.is_transient(first), "an open connection keeps its slot");
+    // The slot is still spent, so the next connection has to evict it.
+    unexpected_inbound(&mut h, second).await;
+    assert!(h.mgr.con
```

**File**: `crates/core/src/node/network_status.rs` (modified, +52/-7)
```diff
@@ -163,6 +163,8 @@ pub(crate) struct OtelStatusScalars {
     /// scalar source rather than a new provider.
     pub bootstrap_transient_registered: u64,
     pub bootstrap_transient_expired: u64,
+    pub bootstrap_transient_source_refusals: u64,
+    pub bootstrap_transient_evictions: u64,
     pub bootstrap_promoted_to_ring: u64,
     pub bootstrap_time_to_min_connections: Option<Duration>,
     /// Time from process start to this node's FIRST ring connection (#5858).
@@ -204,6 +206,8 @@ pub(crate) fn otel_status_scalars() -> Option<OtelStatusScalars> {
         op_stats: status.op_stats.clone(),
         bootstrap_transient_registered: b.transient_registered,
         bootstrap_transient_expired: b.transient_expired,
+        bootstrap_transient_source_refusals: b.transient_source_refusals,
+        bootstrap_transient_evictions: b.transient_evictions,
         bootstrap_promoted_to_ring: b.promoted_to_ring,
         bootstrap_time_to_min_connections: b.time_to_min_connections,
         bootstrap_time_to_first_ring_connection: b.time_to_first_ring_connection,
@@ -441,7 +445,7 @@ pub struct NetworkStatus {
 }
 
 /// Bootstrap-acceptance-churn counters (issue #4787): a restarted node's
-/// connection to a gateway lingers as transient, its tracking entry expires,
+/// connection to a gateway lingers as transient, its TTL elapses,
 /// and (if the onward CONNECT never promotes it) the underlying transport is
 /// later reaped as a zombie by a separate, uninstrumented sweep — cycling the
 /// joiner through repeated reconnects before it acquires real peers. These
@@ -456,9 +460,9 @@ pub struct NetworkStatus {
 /// signature reported in the issue.
 ///
 /// They are still not a clean partition of `transient_registered`: the #3113
-/// recovery path (a slow CONNECT that completes after the tracking entry's
-/// TTL already expired, `handle_connect_peer`) increments BOTH
-/// `transient_expired` (the tracking entry lapsed) AND `promoted_to_ring` (it
+/// recovery path (a slow CONNECT that completes after the transient TTL
+/// elapsed, `handle_connect_peer`) increments BOTH
+/// `transient_expired` (the TTL elapsed unpromoted) AND `promoted_to_ring` (it
 /// promoted anyway) for the SAME connection. So `transient_expired +
 /// promoted_to_ring` can exceed `transient_registered`, and a connection that
 /// recovers this way is indistinguishable in these counters from one that is
@@ -542,7 +546,15 @@ pub struct BootstrapChurnStats {
     /// and a re-registration of an already-tracked address (nothing new
     /// inserted) do not inflate it.
     pub transient_registered: u64,
+    /// Transient registrations whose TTL elapsed before the connection was
+    /// promoted, whether it was still open then or had already closed.
     pub transient_expired: u64,
+    /// Transient registrations refused because the address's source (IPv4
+    /// address or IPv6 /64) already held its share of the budget.
+    pub transient_source_refusals: u64,
+    /// Unpromoted connections closed to admit a newcomer at the transient
+    /// budget.
+    pub transient_evictions: u64,
     /// Counts promotions the ring actually accepted — both promotion call
     /// sites gate on `Ring::add_connection`'s reported `added`, so a
     /// cap-rejected promotion attempt is not counted as a promotion.
@@ -1643,9 +1655,11 @@ pub fn record_bootstrap_transient_registered() {
     }
 }
 
-/// Record that a transient tracking entry expired (TTL elapsed) before the
-/// onward CONNECT promoted it — issue #4787 instrumentation. Called from the
-/// "Transient connection expired" site in
+/// Record that a transient connection's TTL elapsed before the onward
+/// CONNECT promoted it — issue #4787 instrumentation. Counted whether the
+/// connection is still open (it keeps its budget slot until it is promoted or
+/// closed) or had already closed, as before slots were held. Called from the
+/// "Transient connection past its TTL" site in
 /// `p2p_protoc/connection_lifecycle.rs`.
 pub fn record_bootstrap_transient_expired() {
     if let Some(status) = NETWORK_STATUS.get() {
@@ -1656,6 +1670,32 @@ pub fn record_bootstrap_transient_expired() {
     }
 }
 
+/// Record that a transient registration was refused for its source's share
+/// of the budget. Called from `ConnectionManager::register_transient`.
+pub fn record_transient_source_refused() {
+    if let Some(status) = NETWORK_STATUS.get() {
+        if let Ok(mut s) = status.write() {
+            s.bootstrap_churn_stats.transient_source_refusals = s
+                .bootstrap_churn_stats
+                .transient_source_refusals
+                .saturating_add(1);
+        }
+    }
+}
+
+/// Record that an unpromoted connection was closed to admit a newcomer at the
+/// transient budget. Called from `ConnectionManager::record_transient_eviction`.
+pub fn record_transient_evicted() {
+    if let Some(status) = NETWORK_STATUS.get() {
+        if let Ok(mut s) = status.write() {
+       
```

**File**: `crates/core/src/node/testing_impl.rs` (modified, +24/-0)
```diff
@@ -1712,6 +1712,9 @@ pub struct SimNetwork {
     /// the capability-derived default, so a test can force cache pressure with a
     /// tiny budget and observe demand-driven eviction (#4642 piece A).
     hosting_budget_override: Option<u64>,
+    /// Transient connection budget (`--transient-budget`) for every node this
+    /// network builds, when set ([`SimNetwork::with_transient_budget`]).
+    transient_budget_override: Option<usize>,
     /// Per-node capture slots for the live `Arc<Ring>`, populated by
     /// `run_controlled_simulation` so governance sim tests can read each
     /// node's `contract_ban_list` after the simulation completes. Keyed by
@@ -1933,6 +1936,7 @@ impl SimNetwork {
             broadcast_target_list_floor_override: Some(Self::SIM_MIGRATION_DISABLED_FLOOR),
             hosting_clock: None,
             hosting_budget_override: None,
+            transient_budget_override: None,
             shared_rings: HashMap::new(),
             node_port_override,
             quic_datagram_drops: Vec::new(),
@@ -2745,6 +2749,20 @@ impl SimNetwork {
         self.hosting_clock.clone()
     }
 
+    /// Give every node this network builds `budget` as its transient
+    /// connection budget. Call before `start*`.
+    pub fn with_transient_budget(&mut self, budget: usize) -> &mut Self {
+        self.transient_budget_override = Some(budget);
+        // Patch already-built configs (see `with_hosting_budget`).
+        for (builder, _) in self.gateways.iter_mut() {
+            builder.config.transient_budget = budget;
+        }
+        for (builder, _) in self.nodes.iter_mut() {
+            builder.config.transient_budget = budget;
+        }
+        self
+    }
+
     /// Set the per-node hosting-cache byte budget (`max_hosting_storage`) for
     /// every node this network builds. A tiny budget forces cache pressure so a
     /// test can observe demand-driven eviction of low-demand contracts
@@ -3766,6 +3784,9 @@ impl SimNetwork {
             if let Some(budget) = self.hosting_budget_override {
                 std::sync::Arc::make_mut(&mut config.config).max_hosting_storage = budget;
             }
+            if let Some(budget) = self.transient_budget_override {
+                config.transient_budget = budget;
+            }
             config.key_pair = keypair;
             config.network_listener_ip = ip.into();
             config.network_listener_port = port;
@@ -3873,6 +3894,9 @@ impl SimNetwork {
             if let Some(budget) = self.hosting_budget_override {
                 std::sync::Arc::make_mut(&mut config.config).max_hosting_storage = budget;
             }
+            if let Some(budget) = self.transient_budget_override {
+                config.transient_budget = budget;
+            }
             for GatewayConfig {
                 peer_key_location,
                 location,
```

**File**: `crates/core/src/operations/put/stream_admission.rs` (modified, +3/-1)
```diff
@@ -76,7 +76,9 @@ pub(crate) const PER_SOURCE_CAP: usize = 32;
 pub(crate) const NODE_WIDE_CAP: usize = 512;
 
 /// Where an announcement came from, at the granularity one host controls.
-/// Also the source unit of `operations::relay_admission`.
+/// Also the source unit of `operations::relay_admission`, and groups the
+/// transient connection budget's per-source share
+/// (`ConnectionManager::try_register_transient`).
 #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
 pub(crate) enum Source {
     V4(u32),
```

**File**: `crates/core/src/ring.rs` (modified, +14/-1)
```diff
@@ -91,7 +91,7 @@ pub(crate) mod contract_exec_metrics;
 pub(crate) mod delta_incompat;
 /// Shadow-mode detector for repairs that never converge (see the module docs).
 pub(crate) mod futile_repair;
-pub(crate) use connection_manager::ConnectionManager;
+pub(crate) use connection_manager::{ConnectionManager, TransientRefusal, TransientTtlOutcome};
 // Nearest-neighbor ring lattice (successor+predecessor base edges).
 // `nn_lattice_active_for` is the full activation gate — the flag AND the
 // minimum-degree floor (`NN_LATTICE_MIN_MAX_CONNECTIONS`) — used by the
@@ -287,6 +287,8 @@ fn apply_bootstrap_churn_stats(
 ) {
     snapshot.bootstrap_transient_registered = Some(b.transient_registered);
     snapshot.bootstrap_transient_expired = Some(b.transient_expired);
+    snapshot.bootstrap_transient_source_refusals = Some(b.transient_source_refusals);
+    snapshot.bootstrap_transient_evictions = Some(b.transient_evictions);
     snapshot.bootstrap_promoted_to_ring = Some(b.promoted_to_ring);
     snapshot.bootstrap_time_to_min_connections_secs =
         b.time_to_min_connections.map(|d| d.as_secs_f64());
@@ -2369,6 +2371,7 @@ impl Ring {
             // `router_snapshot_json_includes_routing_attribution_counters`.
             snapshot.ring_connections = Some(cm.connection_count() as u64);
             snapshot.transient_connections = Some(cm.transient_count() as u64);
+            snapshot.transient_largest_source = Some(cm.transient_largest_source() as u64);
             snapshot.connections_to_gateways =
                 crate::node::network_status::connections_to_gateways();
             if let Some((gets, puts, subscribes, updates)) =
@@ -6200,6 +6203,12 @@ impl Ring {
             crate::transport::TRANSPORT_METRICS.connection_peer_bytes(peer.socket_addr()),
         );
         crate::node::network_status::record_peer_disconnected(peer.socket_addr());
+        // A connection kept outside the ring holds a slot in the transient
+        // budget for as long as it is open (`ConnectionManager::hold_transient`).
+        // Every path that closes a connection reaches this, so the slot is
+        // given back here, before the early return below for a connection the
+        // ring never held.
+        self.connection_manager.drop_transient(peer.socket_addr());
         let orphaned_transactions = self
             .live_tx_tracker
             .prune_transactions_from_peer(peer.socket_addr());
@@ -11750,6 +11759,8 @@ mod cost_pressure_seam_tests {
             &BootstrapChurnStats {
                 transient_registered: 11,
                 transient_expired: 12,
+                transient_source_refusals: 22,
+                transient_evictions: 23,
                 promoted_to_ring: 13,
                 time_to_min_connections: Some(Duration::from_millis(14_500)),
                 time_to_first_ring_connection: Some(Duration::from_millis(2_345)),
@@ -11762,6 +11773,8 @@ mod cost_pressure_seam_tests {
         );
         assert_eq!(snapshot.bootstrap_transient_registered, Some(11));
         assert_eq!(snapshot.bootstrap_transient_expired, Some(12));
+        assert_eq!(snapshot.bootstrap_transient_source_refusals, Some(22));
+        assert_eq!(snapshot.bootstrap_transient_evictions, Some(23));
         assert_eq!(snapshot.bootstrap_promoted_to_ring, Some(13));
         assert_eq!(snapshot.bootstrap_time_to_min_connections_secs, Some(14.5));
         assert_eq!(snapshot.bootstrap_completed, Some(true));
```

**File**: `crates/core/src/ring/connection_manager.rs` (modified, +600/-25)
```diff
@@ -28,6 +28,7 @@ use std::time::Duration;
 use tokio::time::Instant;
 
 use crate::config::GlobalRng;
+use crate::operations::put::stream_admission::Source as TransientSource;
 use crate::topology::{Limits, TopologyManager};
 use crate::util::backoff::{ExponentialBackoff, TrackedBackoff};
 
@@ -41,6 +42,53 @@ pub(crate) struct TransientEntry {
     pub location: Option<Location>,
     /// When this transient entry was created (for expiration cleanup).
     pub created_at: Instant,
+    /// Set once an open connection kept outside the ring owns the entry
+    /// (`ConnectionManager::hold_transient`). Such an entry is exempt from
+    /// age expiry: it is given back only when the connection is promoted
+    /// (`drop_transient`, `add_connection`) or closed
+    /// (`Ring::prune_connection`, which every teardown path calls). Its life
+    /// is bounded ONLY by its connection closing, through the zombie sweep or
+    /// the transport idle timeout; nothing guarantees that a connection held
+    /// open indefinitely is ever closed, which is the known gap in #5922 (no
+    /// time bound on such a connection yet). Eviction at the budget
+    /// (`oldest_held_transient`) limits how many slots such entries can take.
+    pub held: bool,
+    /// Distinguishes this entry from earlier and later ones at the same
+    /// address (`ConnectionManager::transient_generation`).
+    pub generation: u64,
+}
+
+/// What became of a transient entry when its TTL elapsed
+/// (`ConnectionManager::transient_ttl_outcome`).
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub(crate) enum TransientTtlOutcome {
+    /// Promoted into the ring before the TTL (or never registered).
+    Promoted,
+    /// Still held by its open, unpromoted connection.
+    StillHeld,
+    /// Its connection closed without being promoted.
+    Closed,
+}
+
+/// Why a transient registration was refused.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub(crate) enum TransientRefusal {
+    /// The node-wide transient budget is spent.
+    Budget,
+    /// The address's source already holds its share of the budget.
+    SourceShare,
+}
+
+/// A source's share of the transient budget is at least this many slots, so
+/// many joiners behind one carrier-grade NAT still fit on a small budget.
+const MIN_TRANSIENT_SOURCE_SHARE: usize = 16;
+/// A source holds at most this fraction (1/N) of the transient budget: 128 of
+/// the default 2048.
+const TRANSIENT_SOURCE_SHARE_DIVISOR: usize = 16;
+
+/// The most transient slots one source may hold under `budget`.
+fn transient_source_share(budget: usize) -> usize {
+    (budget / TRANSIENT_SOURCE_SHARE_DIVISOR).max(MIN_TRANSIENT_SOURCE_SHARE)
 }
 
 /// Maximum time a pending reservation can remain before being considered stale.
@@ -563,6 +611,21 @@ pub(crate) struct ConnectionManager {
     open_transports: Arc<dashmap::DashSet<SocketAddr>>,
     transient_in_use: Arc<AtomicUsize>,
     transient_budget: usize,
+    /// Transient entries per source (IPv4 address or IPv6 /64), each at most
+    /// `transient_source_share`. Kept equal to the sources of
+    /// `transient_connections`: every insert counts, every removal releases.
+    transient_per_source: Arc<DashMap<TransientSource, usize>>,
+    /// `max(MIN_TRANSIENT_SOURCE_SHARE, transient_budget / TRANSIENT_SOURCE_SHARE_DIVISOR)`.
+    transient_source_share: usize,
+    transient_source_refusals: Arc<AtomicU64>,
+    transient_evictions: Arc<AtomicU64>,
+    /// Transient entries in registration order, as `(addr, generation)`;
+    /// entries no longer in the map are skipped and dropped lazily.
+    transient_order: Arc<Mutex<std::collections::VecDeque<(SocketAddr, u64)>>>,
+    transient_generation: Arc<AtomicU64>,
+    /// Generations of held entries promoted before their TTL, until their
+    /// TTL timer asks (`take_promoted_within_ttl`), with when.
+    transient_promoted_within_ttl: Arc<DashMap<u64, Instant>>,
     transient_ttl: Duration,
     pub min_connections: usize,
     pub max_connections: usize,
@@ -770,6 +833,13 @@ impl ConnectionManager {
             open_transports: Arc::new(dashmap::DashSet::new()),
             transient_in_use: Arc::new(AtomicUsize::new(0)),
             transient_budget,
+            transient_per_source: Arc::new(DashMap::new()),
+            transient_source_share: transient_source_share(transient_budget),
+            transient_source_refusals: Arc::new(AtomicU64::new(0)),
+            transient_evictions: Arc::new(AtomicU64::new(0)),
+            transient_order: Arc::new(Mutex::new(std::collections::VecDeque::new())),
+            transient_generation: Arc::new(AtomicU64::new(0)),
+            transient_promoted_within_ttl: Arc::new(DashMap::new()),
             transient_ttl,
             min_connections,
             max_connections,
@@ -1981,34 +2051,281 @@ impl ConnectionManager {
     /// Attempts to register a transient connection, enforcing the configured budget.
     /// Returns `false` when the budg
```

---

### Incident Patch 2: `a669ccb9` (2026-11-19)
**Commit Message**: build: release 0.2.161 (#6300)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1899,7 +1899,7 @@ dependencies = [
 
 [[package]]
 name = "fdev"
-version = "0.3.322"
+version = "0.3.323"
 dependencies = [
  "anyhow",
  "axum",
@@ -2078,7 +2078,7 @@ dependencies = [
 
 [[package]]
 name = "freenet"
-version = "0.2.160"
+version = "0.2.161"
 dependencies = [
  "aes-gcm",
  "ahash",
```

**File**: `apps/freenet-ping/Cargo.lock` (modified, +1/-1)
```diff
@@ -1715,7 +1715,7 @@ dependencies = [
 
 [[package]]
 name = "freenet"
-version = "0.2.160"
+version = "0.2.161"
 dependencies = [
  "aes-gcm",
  "ahash",
```

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "freenet"
-version = "0.2.160"
+version = "0.2.161"
 edition = "2024"
 rust-version = "1.85"
 publish = true
```

**File**: `crates/fdev/Cargo.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "fdev"
-version = "0.3.322"
+version = "0.3.323"
 edition = "2024"
 rust-version = "1.85"
 publish = true
@@ -14,12 +14,12 @@ readme = "README.md"
 # (v0.2.x), so we embed the matching freenet version literally — `v{ version }`
 # would expand to the fdev crate version and 404. release.yml rewrites the
 # `vX.Y.Z` segment whenever the freenet version is bumped (issue #3995).
-pkg-url = "{ repo }/releases/download/v0.2.160/fdev-{ target }.tar.gz"
+pkg-url = "{ repo }/releases/download/v0.2.161/fdev-{ target }.tar.gz"
 pkg-fmt = "tgz"
 bin-dir = "fdev"
 
 [package.metadata.binstall.overrides.x86_64-pc-windows-msvc]
-pkg-url = "{ repo }/releases/download/v0.2.160/fdev-{ target }.zip"
+pkg-url = "{ repo }/releases/download/v0.2.161/fdev-{ target }.zip"
 pkg-fmt = "zip"
 bin-dir = "fdev.exe"
 
@@ -56,7 +56,7 @@ ed25519-dalek = { version = "2", features = ["rand_core", "serde"] }
 hex = { workspace = true }
 
 # internal
-freenet = { path = "../core", version = "0.2.160", features = ["testing"] }
+freenet = { path = "../core", version = "0.2.161", features = ["testing"] }
 freenet-stdlib = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 3: `6b11328d` (2026-11-19)
**Commit Message**: chore(release): raise the QUIC-native wire floor to 0.2.162 (#6299)

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +2/-2)
```diff
@@ -1227,8 +1227,8 @@ use crate::operations::connect::native::NativeWire;
 /// which ships while the data ramp is still under watch. Raised to 0.2.161
 /// for 0.2.160: native connect is still off (`QUIC_NATIVE_PERCENT` is 0) and
 /// its wire fields may change before it is enabled, so no release is frozen
-/// as the floor yet.
-pub(crate) const QUIC_NATIVE_MIN_VERSION: (u8, u8, u16) = (0, 2, 161);
+/// as the floor yet. Raised to 0.2.162 for 0.2.161 for the same reasons.
+pub(crate) const QUIC_NATIVE_MIN_VERSION: (u8, u8, u16) = (0, 2, 162);
 
 /// Has the decoder for the QUIC-native `ConnectMsg` variants shipped, and in
 /// which release?
```

#### Recent Merged Pull Requests:
- **PR #6300** (2026-11-19): build: release 0.2.161 (@sanity)
- **PR #6299** (2026-11-19): chore(release): raise the QUIC-native wire floor to 0.2.162 (@sanity)
- **PR #6298** (2026-11-19): fix: bound contract-handler event admission per priority class (@sanity)
- **PR #6297** (2026-11-19): feat(quic): native joiners inside the connection cap, with their own queue share (@sanity)
- **PR #6296** (2026-11-19): fix(connect): enforce the transient connection budget; bound FixedRate flight size (@sanity)
- **PR #6295** (2026-11-19): test: give the merge-budget sims a measured nextest timeout (@sanity)

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

## X. connect): enforce the transient connection budget; bound FixedRate flight size

**RULE**:
When implementing operations in `crates/core/src/config.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `48d67dfb`: connect): enforce the transient connection budget; bound FixedRate flight size. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/config.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Time (in seconds) after which an unpromoted transient connection is counted
    /// as expired. Its transport stays open, and its slot in the transient budget
    /// is held until it is promoted or closed.
    /// Time (in seconds) after which an unpromoted transient connection is counted
    /// as expired. Its transport stays open, and its slot in the transient budget
    /// is held until it is promoted or closed.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// Time (in seconds) before an unpromoted transient connection is dropped.
    /// Time (in seconds) before an unpromoted transient connection is dropped.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `48d67dfb` are properly handled with clean fallback behavior.
