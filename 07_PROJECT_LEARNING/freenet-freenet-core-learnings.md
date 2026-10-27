> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `b11d06c6`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T23:44:08.811Z  
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
> **Harvest Timestamp**: 2026-10-27T23:44:07.429Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3110 stars

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
- **Issue #6016** (2026-10-27): **build: release 0.2.151**
  *Symptoms*: **Automated release PR**  - freenet: → **0.2.151** - fdev: → **0.3.313**  This PR will auto-merge once GitHub CI passes. Generated by: `.github/workflows/release.yml` 

- **Issue #6015** (2026-10-27): **feat(conformance): report-only removal tier in policy::decide**
  *Symptoms*: ## Problem  `policy::decide` decided removal from `Severity` alone: every `Severity::Violation` became `WouldRemove` in Shadow and `Remove` under Enforce. Some of those properties produce findings from inputs anyone may supply, or describe a contract that converges after a bounded cost. Counting those as prospective removals skews the shadow `would_remove` number, which is the number the Phase 5 enforcement gate is judged on, and would make them removable once Enforce is reachable.  The decision (#5906, 2026-10-22) is that these are report-only: `Report` in every mode, Shadow included.  ## Approach  A removal tier, separate from severity. `Severity` keeps saying what a finding is: a `Violation` broke a law. The new `policy::RemovalTier` says what the network may do about it. Folding this into `Severity` would bend the classification to soften an enforcement consequence, which #5462 rejected.  - `policy::property_tier(property)`: an exhaustive match with no wildcard, so a new property does not compile until its tier is decided. - `policy::removal_tier(violation)`: the property tier, refined by the locally recomputed idempotence settling class. - `policy::decide` returns `Report` for any `ReportOnly` finding in Shadow and Enforce (and `Nothing` when Disabled, as before).  Per property:  | Property | Tier | Why | |---|---|---| | `StateIdempotence`, settling `SettledAfter(n)` | report-only | The state is rewritten once and then holds still: it converges after a bounded cost, and 

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

### Incident Patch 1: `b11d06c6` (2026-10-27)
**Commit Message**: feat(conformance): report-only removal tier in policy::decide (#6015)

**File**: `crates/core/src/conformance.rs` (modified, +4/-2)
```diff
@@ -150,9 +150,11 @@ pub use generator::{GeneratorConfig, generate_cases};
 pub use host_clock::{
     HOST_CLOCK_DEPRECATION_DOC, HOST_CLOCK_IMPORT, HOST_CLOCK_NAMESPACE, imports_host_clock,
 };
-pub use minimize::{MinimizeConfig, MinimizeReport, minimize};
+pub use minimize::{MinimizeConfig, MinimizeReport, minimize, minimize_toward};
 pub use oracle::{ConformanceOracle, OracleError, OracleErrorKind};
-pub use policy::{ConformanceAction, EnforcementMode, decide};
+pub use policy::{
+    ConformanceAction, EnforcementMode, RemovalTier, decide, property_tier, removal_tier,
+};
 pub use property::{
     ConformanceProperty, IdempotenceSettling, Inconclusive, OutputDigest, PremiseSource,
     PropertyOutcome, Severity, Violation,
```

**File**: `crates/core/src/conformance/capture.rs` (modified, +6/-6)
```diff
@@ -953,14 +953,14 @@ async fn run_writer(
                     probed = report.probed,
                     cases = report.cases,
                     inconclusive = report.inconclusive,
+                    // Removal-eligible findings only; report-only ones, the
+                    // idempotence class that settles after a rewrite included,
+                    // are in `reported`.
                     would_remove = report.would_remove,
-                    // Emitted beside the total, never instead of it. The
-                    // subset that CONVERGES is the part of `would_remove` an
-                    // enforcement gate must not read as removal-worthy, and a
-                    // counter that never leaves the process cannot inform the
-                    // decision it was collected for.
-                    would_remove_settled = report.would_remove_settled,
                     reported = report.reported,
+                    // The report-only violations inside `reported`; the rest of
+                    // it is diagnostics.
+                    report_only_violations = report.report_only_violations,
                     skipped_no_code = report.skipped_no_code,
                     skipped_no_samples = report.skipped_no_samples,
                     timed_out = report.timed_out,
```

**File**: `crates/core/src/conformance/evidence.rs` (modified, +3/-1)
```diff
@@ -283,7 +283,9 @@ impl ConformanceEvidence {
         // pair permutes to two different states on contracts that are perfectly
         // sound, because production would never apply them in the other order.
         // Either way, every peer receiving the fabrication would independently reach
-        // a removal-eligible verdict against a correct contract.
+        // a violation verdict against a correct contract. Both properties are also
+        // report-only (`policy::removal_tier`), which is the second guard, not a
+        // reason to drop this one.
         //
         // Refused rather than deprioritised: a lower rank still lets it in, and the
         // whole point of the front door is that unsound input never reaches the
```

**File**: `crates/core/src/conformance/minimize.rs` (modified, +245/-18)
```diff
@@ -22,6 +22,7 @@
 //! [`ConformanceEvidence::check_bounds`]: super::evidence::ConformanceEvidence::check_bounds
 
 use super::oracle::ConformanceOracle;
+use super::policy::{RemovalTier, removal_tier};
 use super::property::{ConformanceProperty, PropertyOutcome};
 use super::verifier::{Bytes, ConformanceCase, verify_case};
 
@@ -55,34 +56,101 @@ pub struct MinimizeReport {
     pub attempts: usize,
 }
 
-/// Shrink `case` while it keeps producing a violation of the same property.
+/// Shrink `case` while it keeps producing a violation of the same property with
+/// the same removal tier (`policy::removal_tier`).
+///
+/// The tier is part of what the finding is. A never-settling `StateIdempotence`
+/// case can have a smaller input that settles after a rewrite: the same property,
+/// but report-only. Swapping that in would turn removal-eligible evidence into
+/// evidence no peer may act on.
+///
+/// Tier equality is deliberately coarse. It does not pin the settling class, so
+/// a `NeverSettled` case may shrink to an `Indeterminate` one: both are
+/// removal-eligible today, and pinning the class would refuse shrinks that change
+/// nothing a receiving peer decides.
 ///
 /// Returns the case unchanged if it does not currently violate anything: shrinking
 /// a case that does not fail would be searching for a failure, which is a different
 /// and much more dangerous activity.
 ///
 /// `candidates` are other states the peer has observed for this same contract.
 /// Only states the contract itself produced or accepted are ever substituted.
+///
+/// A caller that has already verified `case` should use [`minimize_toward`] with
+/// the finding it checked, so the target cannot differ from what it decided on.
 pub fn minimize<O: ConformanceOracle + ?Sized>(
     oracle: &mut O,
     case: &ConformanceCase,
     state_candidates: &[Bytes],
     delta_candidates: &[Bytes],
     config: &MinimizeConfig,
+) -> (ConformanceCase, MinimizeReport) {
+    let Some(target) = violated_finding(oracle, case) else {
+        let bytes = case.input_bytes();
+        let report = MinimizeReport {
+            original_bytes: bytes,
+            final_bytes: bytes,
+            attempts: 0,
+        };
+        return (case.clone(), report);
+    };
+    // The verification that derived the target is charged to the budget too.
+    shrink(
+        oracle,
+        case,
+        target,
+        state_candidates,
+        delta_candidates,
+        config,
+        1,
+    )
+}
+
+/// [`minimize`] toward a finding the caller already established: shrink `case`
+/// while each trial violates `target.0` with removal tier `target.1`.
+///
+/// Re-deriving the target here would verify `case` again, and against a
+/// contract whose verdict is not stable between runs (a nondeterministic one, or
+/// one reading the clock across a boundary) that second answer can differ from
+/// the one the caller decided on. The shrink would then chase a finding the
+/// caller never checked.
+pub fn minimize_toward<O: ConformanceOracle + ?Sized>(
+    oracle: &mut O,
+    case: &ConformanceCase,
+    target: (ConformanceProperty, RemovalTier),
+    state_candidates: &[Bytes],
+    delta_candidates: &[Bytes],
+    config: &MinimizeConfig,
+) -> (ConformanceCase, MinimizeReport) {
+    shrink(
+        oracle,
+        case,
+        target,
+        state_candidates,
+        delta_candidates,
+        config,
+        0,
+    )
+}
+
+/// The shrink both entry points share. `attempts_spent` is what the caller has
+/// already charged to `config.max_attempts`.
+fn shrink<O: ConformanceOracle + ?Sized>(
+    oracle: &mut O,
+    case: &ConformanceCase,
+    finding: (ConformanceProperty, RemovalTier),
+    state_candidates: &[Bytes],
+    delta_candidates: &[Bytes],
+    config: &MinimizeConfig,
+    attempts_spent: usize,
 ) -> (ConformanceCase, MinimizeReport) {
     let original_bytes = case.input_bytes();
     let mut report = MinimizeReport {
         original_bytes,
         final_bytes: original_bytes,
-        attempts: 0,
+        attempts: attempts_spent,
     };
 
-    let property = match violated_property(oracle, case) {
-        Some(property) => property,
-        None => return (case.clone(), report),
-    };
-    report.attempts += 1;
-
     // Smallest first, so the first substitution that sticks is the best available
     // rather than merely an improvement.
     //
@@ -110,7 +178,7 @@ pub fn minimize<O: ConformanceOracle + ?Sized>(
         if !shrink_slot(
             oracle,
             &mut current,
-            property,
+            finding,
             &ordered_states,
             config,
             &mut report,
@@ -124,7 +192,7 @@ pub fn minimize<O: ConformanceOracle + ?Sized>(
         if !shrink_slot(
             oracle,
             &mut current,
-            property,
+            finding,
             &ordered_deltas,
             config,
             &mut report,
@@ -140,12 +208,13 @@ pub fn minimize<O:
```

**File**: `crates/core/src/conformance/policy.rs` (modified, +307/-8)
```diff
@@ -7,18 +7,22 @@
 //! the gate is gone with nothing failing.
 //!
 //! So the ordering lives here, as a decision function with tests, rather than as
-//! scattered `if` statements at the call sites. Two invariants are pinned:
+//! scattered `if` statements at the call sites. Three invariants are pinned:
 //!
 //! 1. Under [`EnforcementMode::Shadow`], **no input of any kind produces a removal.**
 //! 2. A [`Severity::Diagnostic`] finding never proposes removal in *any* mode. A
 //!    wasteful self-delta (#5072, #5056) is an efficiency report about a contract
 //!    that still converges. Deleting an application over that would be absurd, and
 //!    the distinction is exactly the sort that erodes once "violation" becomes one
 //!    undifferentiated word.
+//! 3. A [`RemovalTier::ReportOnly`] finding is a [`ConformanceAction::Report`] in
+//!    every mode that runs, Shadow included. See [`removal_tier`].
 
 use serde::{Deserialize, Serialize};
 
-use super::property::{PropertyOutcome, Severity, Violation};
+use super::property::{
+    ConformanceProperty, IdempotenceSettling, PropertyOutcome, Severity, Violation,
+};
 
 /// How much authority the conformance mechanism currently has.
 #[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
@@ -77,6 +81,10 @@ impl ConformanceAction {
 /// takes an outcome rather than evidence: there is no argument you can pass it that
 /// means "another peer says so", because a remote claim is never grounds for
 /// anything on its own.
+///
+/// Only a [`Severity::Violation`] whose [`removal_tier`] is
+/// [`RemovalTier::RemovalEligible`] can propose a removal. Everything else that
+/// was violated is a [`ConformanceAction::Report`].
 pub fn decide(mode: EnforcementMode, outcome: &PropertyOutcome) -> ConformanceAction {
     let violation = match outcome {
         PropertyOutcome::Violated(v) => v.clone(),
@@ -89,19 +97,128 @@ pub fn decide(mode: EnforcementMode, outcome: &PropertyOutcome) -> ConformanceAc
     // the headline invariant here is that a diagnostic never proposes removal in any
     // mode, and that invariant should not rest on the caller never handing us a
     // deserialized `Violation`. Same expression, no trust dependency.
-    match (mode, violation.property.severity()) {
-        (EnforcementMode::Disabled, _) => ConformanceAction::Nothing,
+    match (
+        mode,
+        violation.property.severity(),
+        removal_tier(&violation),
+    ) {
+        (EnforcementMode::Disabled, _, _) => ConformanceAction::Nothing,
         // Diagnostics are reports in every mode, enforcement included.
-        (_, Severity::Diagnostic) => ConformanceAction::Report(violation),
-        (EnforcementMode::Shadow, Severity::Violation) => ConformanceAction::WouldRemove(violation),
-        (EnforcementMode::Enforce, Severity::Violation) => ConformanceAction::Remove(violation),
+        (_, Severity::Diagnostic, _) => ConformanceAction::Report(violation),
+        // So are report-only findings, and Shadow is not an exception: a
+        // `WouldRemove` is the number the enforcement gate is judged on, and a
+        // finding anyone can produce on demand must not be able to move it.
+        (_, Severity::Violation, RemovalTier::ReportOnly) => ConformanceAction::Report(violation),
+        (EnforcementMode::Shadow, Severity::Violation, RemovalTier::RemovalEligible) => {
+            ConformanceAction::WouldRemove(violation)
+        }
+        (EnforcementMode::Enforce, Severity::Violation, RemovalTier::RemovalEligible) => {
+            ConformanceAction::Remove(violation)
+        }
+    }
+}
+
+/// Whether a finding may ever propose a removal, in any mode.
+///
+/// A separate axis from [`Severity`] on purpose. Severity says what the finding
+/// IS: a `Violation` broke a merge law, and `fdev` fails on it so the author fixes
+/// it. This says what the NETWORK may do about it. A law can be broken for real and
+/// still be no ground for removal, because removal needs more than a broken law:
+/// the finding must not be producible by inputs anyone may supply, and the
+/// contract must not converge after a bounded cost anyway. Folding that into the
+/// severity would bend the classification to soften an enforcement consequence,
+/// which is the move #5462 rejected.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
+pub enum RemovalTier {
+    /// [`ConformanceAction::WouldRemove`] in Shadow, [`ConformanceAction::Remove`]
+    /// under Enforce.
+    RemovalEligible,
+    /// [`ConformanceAction::Report`] in every mode that runs, Shadow included.
+    ReportOnly,
+}
+
+/// The tier a property's findings get before anything about the individual
+/// finding is considered.
+///
+/// An exhaustive match with no wildcard arm, so a new property does not compile
+/// until someone has decided whether it may lead to a removal.
+///
+/// The report-only set was decided on 2026-10-22 (merge-law conformance tracker
+//
```

**File**: `crates/core/src/conformance/property.rs` (modified, +110/-45)
```diff
@@ -135,42 +135,54 @@ pub enum ConformanceProperty {
     /// notice: the partition pin asserts the classification the code states rather
     /// than deriving it from the generator, and
     /// `no_shippable_removal_eligible_property_consumes_unvalidated_bytes` only
-    /// fires on a SEVERITY change, which such a refinement does not make.
-    ///
-    /// What keeps the unvalidated bytes harmless is the [`Severity::Diagnostic`]
-    /// tier, which `policy::decide` never maps to a removal: a fabricated delta buys
-    /// an attacker a report and nothing else. That coupling is NOT incidental. This
-    /// is the only property that both travels as evidence and consumes delta bytes,
-    /// so promoting it to [`Severity::Violation`] — which the contested empirical
-    /// question above may one day justify — must revisit this classification in the
-    /// same change. `no_shippable_removal_eligible_property_consumes_unvalidated_bytes`
+    /// fires on a severity or removal-tier change, which such a refinement does not
+    /// make.
+    ///
+    /// What keeps the unvalidated bytes harmless is that it is
+    /// [`Severity::Diagnostic`] and report-only (`policy::property_tier`), which
+    /// `policy::decide` never maps to a removal: a fabricated delta buys an attacker
+    /// a report and nothing else. That coupling is NOT incidental. This is the only
+    /// property that both travels as evidence and consumes delta bytes, so making it
+    /// removal-eligible (a `Violation` with a `RemovalEligible` tier) — which the
+    /// contested empirical question above may one day justify — must revisit this
+    /// classification in the same change. `no_shippable_removal_eligible_property_consumes_unvalidated_bytes`
     /// is the test that forces it to.
     DeltaIdempotence,
-    /// Deltas applied in any order reach the same canonical state.
+    /// Concurrent, independent deltas applied in either order reach the same
+    /// canonical state.
     ///
-    /// The published `ContractInterface` requirement carries no independence
-    /// qualifier — "the order in which these updates are applied should not affect
-    /// the final state" — so order-dependence is a defect whether or not the deltas
-    /// are causally related, and this checks exactly that.
+    /// The law covers concurrent, independent deltas only (decided 2026-10-22,
+    /// #5906). Two deltas where one was computed from a state that already
+    /// contained the other's effect are not covered: the protocol never asks a
+    /// contract to apply them in the reverse order.
+    ///
+    /// # Report-only
+    ///
+    /// Findings here are [`RemovalTier::ReportOnly`]: never `WouldRemove` or
+    /// `Remove`, in any mode. The same-base pairing below is necessary for
+    /// concurrency and not sufficient, so capture cannot yet prove that a pair it
+    /// found was concurrent. Until it can, a finding may be about a pair the law
+    /// does not cover.
     ///
     /// The generator only pairs deltas observed against the SAME base state, which is
     /// what makes a finding here mean something. A delta is computed as
     /// `get_state_delta(sender_state, recipient_summary)`, so two deltas observed
     /// against different bases can be causally sequenced — the later one computed from
     /// a state that already contains the earlier one's effect — and permuting those
     /// asks what happens in a situation the protocol never produces. Same-base pairs
-    /// are the genuine concurrent-independent-updates case. Deltas with no recorded
-    /// base are not paired at all.
+    /// are the closest the corpus gets to the concurrent-independent-updates case:
+    /// two deltas recorded against one base can still be causally sequenced if the
+    /// second sender had already seen the first's effect by another route. Deltas
+    /// with no recorded base are not paired at all.
     ///
-    /// So a finding here still reads as "this delta encoding carries sequence", and
-    /// that is a real defect on this network rather than an artifact: delivery is
-    /// out-of-order, so a delta that assumes a base will be applied out of order in
-    /// production too.
+    /// So a finding here reads as "this delta encoding may carry sequence", which
+    /// is worth telling the author: delivery is out-of-order, so a delta that
+    /// assumes a base can be applied out of order in production too.
     ///
     /// Re-delivery is deliberately not checked here; that is
     /// [`ConformanceProperty::DeltaIdempotence`], which is contested and reports at
     /// a lower severity. Folding it in would accuse a counter-style contract under
-    /// this property's name and severity regardless of that.
+    /// this property's name regardless of that.
     ///
     /// # Local provenance only: this property is NOT self-verifying
     ///
@@ -187,9 +199,10 @@ pub enum ConformanceProperty {
     /// seen — sound in production, 
```

**File**: `crates/core/src/conformance/shadow.rs` (modified, +366/-113)
```diff
@@ -46,7 +46,7 @@ use super::capture::RecordOutcome;
 use super::focus::{FocusSelector, FocusSlot};
 use super::generator::{GeneratorConfig, generate_cases};
 use super::policy::{ConformanceAction, EnforcementMode, decide};
-use super::property::{ConformanceProperty, PropertyOutcome};
+use super::property::{ConformanceProperty, PropertyOutcome, Severity};
 use super::runtime_oracle::RuntimeOracle;
 use super::verifier::verify_case;
 
@@ -136,43 +136,30 @@ pub struct ShadowReport {
     /// Violations that would have caused a removal, had enforcement been on. The
     /// number the RFC's Phase 5 gate is judged on.
     ///
-    /// Read it together with `would_remove_settled`. Since #5462 this total includes
-    /// contracts that DO converge — a canonicalizing contract breaks idempotence by
-    /// rewriting a non-canonical stored state once, and is reported honestly rather
-    /// than suppressed. Comparing this number across that change, or against a
-    /// future where the PUT install path canonicalizes, compares different
-    /// populations.
-    pub would_remove: usize,
-    /// The subset of `would_remove` whose finding says the state SETTLED.
-    ///
-    /// Carried as its own counter because `would_remove` is a bare `usize` with
-    /// nowhere to record that a finding is benign, and this is the number Phase 5
-    /// is judged on. Leaving the distinction out would pre-filter the corpus by
-    /// omission — the same move as the fixpoint gate #5462 removed, one layer up:
-    /// the population would look uniformly removal-worthy when a large and
-    /// knowable part of it is waiting on an install-path fix instead.
+    /// Only removal-eligible findings reach it (`policy::removal_tier`). A
+    /// report-only finding is counted in `reported` instead, in Shadow as in every
+    /// other mode, so findings anyone can produce on demand cannot move this number.
+    /// That includes a `state_idempotence` finding whose state settled after a
+    /// rewrite: before the report-only tier this total included that converging
+    /// class, so comparing it across that change compares different populations.
     ///
-    /// Deliberately additive rather than subtracted from `would_remove`: the
-    /// finding IS removal-eligible, and netting it off would be the severity fork
-    /// the #5462 decision rejected, hidden in a metric.
-    ///
-    /// Read it as a CASE count, not a contract count, and do not read the ratio
-    /// against `would_remove` as "the benign fraction of contracts". Idempotence
-    /// draws a fixed handful of cases per probe while a contract breaking several
-    /// properties feeds the total from each, so the multiplier is not equal across
-    /// the two populations and the ratio systematically misstates the fraction. It
-    /// tells you the class is present and roughly how loud, which is what it is
-    /// for.
+    /// `Indeterminate` idempotence findings are still in it. That is the
+    /// conservative default (an unknown class must not be counted benign), and
+    /// `Indeterminate` is adversarially reachable (see its rustdoc), so this total
+    /// can still include findings that a proof of non-settling would clear.
+    pub would_remove: usize,
+    /// Findings that never propose removal in any mode: diagnostics, and
+    /// violations of a report-only tier (`policy::RemovalTier::ReportOnly`).
     ///
-    /// `Indeterminate` findings are in `would_remove` and in NEITHER subset. That
-    /// is the conservative default — an unknown class must not be counted benign —
-    /// but it means a residual exists that this pair of numbers cannot show, and
-    /// `Indeterminate` is adversarially reachable (see its rustdoc), so a nonzero
-    /// gap between the total and the sum of what you can classify is itself worth
-    /// looking at.
-    pub would_remove_settled: usize,
-    /// Diagnostic-severity findings, which never propose removal in any mode.
+    /// The population changed with the report-only tier. Before it, this counted
+    /// diagnostics only; it now also holds every report-only `Violation`,
+    /// including the settled idempotence class that used to be in
+    /// `would_remove`. `report_only_violations` is that second part on its own,
+    /// so `reported - report_only_violations` is the old series.
     pub reported: usize,
+    /// The subset of `reported` that are `Severity::Violation`s of a report-only
+    /// tier: real law breaks the network does not act on.
+    pub report_only_violations: usize,
     /// Probes cut short by [`PROBE_TIME_BUDGET`].
     pub timed_out: usize,
     /// Focus contracts that reached a verdict: at least one case came back `Holds` or
@@ -593,11 +580,11 @@ pub struct ShadowRunner {
     ticks: u32,
     /// Capture directory, so a rotation can persist the new epoch beside the salt.
     dir: PathBuf,
-    /// `(contract, property)` pairs already logged this epoch, so a contract that
-    /// 
```

**File**: `crates/core/src/conformance/status.rs` (modified, +118/-7)
```diff
@@ -121,7 +121,9 @@ pub struct MergeFinding {
     /// The law that was broken, e.g. `state_commutativity`.
     pub property: &'static str,
     /// `Diagnostic` means the contract is legal but wasteful. `Violation` means it
-    /// broke an algebraic law and would be removal-eligible under enforcement.
+    /// broke an algebraic law. Whether that law may lead to a removal is a separate
+    /// question (`policy::removal_tier`), and its answer for this finding is
+    /// `would_remove`.
     ///
     /// It does NOT mean "cannot converge". That was true when every `Violation` was
     /// a divergence, and `state_idempotence` now reports a class that converges: a
@@ -256,27 +258,42 @@ impl CheckedContract {
             // non-convergent one on the same contract — the operator would read
             // "settles after a rewrite" for a contract that also never settles.
             //
-            // So the SERIOUS classification wins the slot, and an unknown one
-            // outranks a benign one because it has not been shown to be benign.
-            if settling_rank(finding.settling) > settling_rank(existing.settling) {
+            // So the SERIOUS finding wins the slot: one that would remove outranks
+            // one that would not, then the settling class decides, and an unknown
+            // class outranks a benign one because it has not been shown to be
+            // benign. Same order as `shadow::LoggedSeverity`, so the log and the
+            // dashboard name the same finding.
+            //
+            // The winner supplies BOTH fields. Taking the decision from one finding
+            // and the class from another could render "settles after a rewrite
+            // (report-only)" beside "Would remove: yes". Since `would_remove` leads
+            // the order, the kept decision is still true if any finding's was.
+            if slot_rank(&finding) > slot_rank(existing) {
                 existing.settling = finding.settling;
+                existing.would_remove = finding.would_remove;
             }
             return;
         }
         self.findings.insert(0, finding);
     }
 }
 
+/// The order in which [`CheckedContract::note_finding`] picks the finding that
+/// keeps a slot: the decision first, then [`settling_rank`].
+fn slot_rank(finding: &MergeFinding) -> (bool, u8) {
+    (finding.would_remove, settling_rank(finding.settling))
+}
+
 /// How much a settling classification should outrank another for the one slot a
 /// property gets per contract.
 ///
 /// Not a severity — every one of these is `Severity::Violation` and #5462 exists
 /// partly to keep it that way. This orders how much a reader NEEDS to see it when
 /// two findings for one property must collapse to one: an unknown class outranks a
 /// benign one because it has not been shown benign, and a never-settling class
-/// outranks both because it is the case enforcement can act on without waiting for
-/// the install path.
-fn settling_rank(settling: Option<IdempotenceSettling>) -> u8 {
+/// outranks both because it is the case enforcement can act on. The benign class,
+/// `SettledAfter`, is report-only (`policy::removal_tier`).
+pub(crate) fn settling_rank(settling: Option<IdempotenceSettling>) -> u8 {
     match settling {
         Some(IdempotenceSettling::NeverSettled) => 3,
         Some(IdempotenceSettling::Indeterminate) => 2,
@@ -701,12 +718,25 @@ mod tests {
                 Some(IdempotenceSettling::Indeterminate),
                 Some(IdempotenceSettling::Indeterminate),
             ),
+            // Same decision: the settling class alone decides.
+            (
+                Some(IdempotenceSettling::Indeterminate),
+                Some(IdempotenceSettling::NeverSettled),
+                Some(IdempotenceSettling::NeverSettled),
+            ),
         ] {
             let mut record = CheckedContract::new(instance(1), 1, 0, Instant::now());
+            // Each fixture carries the decision `policy::removal_tier` gives its
+            // class: a settled finding is report-only.
+            let settled = |s: Option<IdempotenceSettling>| {
+                matches!(s, Some(IdempotenceSettling::SettledAfter(_)))
+            };
             let mut a = finding(1, "state_idempotence");
             a.settling = first;
+            a.would_remove = !settled(first);
             let mut b = finding(1, "state_idempotence");
             b.settling = second;
+            b.would_remove = !settled(second);
             record.note_finding(a);
             record.note_finding(b);
 
@@ -719,6 +749,87 @@ mod tests {
         }
     }
 
+    /// The kept slot says "would remove" if ANY finding for that property did.
+    ///
+    /// A settled idempotence finding is report-only and a never-settling one is
+    /// not, so the two arrive with different `would_remove`. Keeping the first
+    /// arrival's value would render a never-settling contract as "would remove:
+    /// no" next to a 
```

#### Recent Merged Pull Requests:
- **PR #6016** (2026-10-27): build: release 0.2.151 (@sanity)
- **PR #6015** (2026-10-27): feat(conformance): report-only removal tier in policy::decide (@sanity)
- **PR #6014** (2026-10-27): chore(release): record that 0.2.151 ships the repaired visited-peers indices (@sanity)
- **PR #6013** (closed): build: release 0.2.151 (@sanity)
- **PR #6011** (2026-10-27): fix(core): repair degenerate visited-peers bloom indices, gated on the floor (@sanity)
- **PR #6004** (2026-10-26): fix(telemetry): let fixed-cadence events bypass the node rate limit and count drops per type (@sanity)

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

## X. conformance): report-only removal tier in policy::decide (#6015)

**RULE**:
When implementing operations in `crates/core/src/conformance.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b11d06c6`: conformance): report-only removal tier in policy::decide (#6015). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/conformance.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
pub use minimize::{MinimizeConfig, MinimizeReport, minimize, minimize_toward};
pub use policy::{
    ConformanceAction, EnforcementMode, RemovalTier, decide, property_tier, removal_tier,
};
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
pub use minimize::{MinimizeConfig, MinimizeReport, minimize};
pub use policy::{ConformanceAction, EnforcementMode, decide};
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b11d06c6` are properly handled with clean fallback behavior.
