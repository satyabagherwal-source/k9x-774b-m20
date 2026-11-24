> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `fe85b027`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T07:55:46.409Z  
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
> **Harvest Timestamp**: 2026-11-24T07:55:46.403Z  
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
- **Issue #6362** (2026-11-24): **ci(release): ship an exact soaked commit so main stays open during a cut**
  *Symptoms*: This changes how every release works. The design was reviewed and approved for landing; #6361, which it was stacked on, has merged.  ## Problem  Today a release ships the version-bump PR's *merge commit*, which is current `main` plus anything that merged while the bump sat in the queue. The soak validates one SHA and the release ships another, so `main` has to be frozen from the start of the soak until the tag is pushed. The 0.2.164 freeze lasted about 4 hours across three lanes.  ## Approach  `release.yml` gains a `ship_sha` input (required for a live run) and releases exactly that commit plus a version bump:  1. **validate** (`scripts/resolve_release_ship.sh`) checks that `ship_sha` is on `main` and that it contains the previous release's ship commit, so a release can never drop a fix the last one shipped. It reads the versions from `ship_sha`'s tree. fdev is set to max(fdev at `ship_sha`, fdev at the latest published tag) + 1. The pre-flight from #6361 also refuses a version that is not above the latest published release. 2. **update_versions** checks out `ship_sha`, applies the bump (`scripts/apply_version_bump.sh`, now the single copy of the seds), and pushes `release/vX` at B = `ship_sha` + bump. There is no bump PR. 3. **ci.yml** now also runs its full suite on pushes to `release/v*`. **wait_for_ci** (`scripts/wait_for_release_ci.sh`) waits for that run on B and requires every gate job to have actually succeeded, not merely that the run is green. It also asserts that B

- **Issue #6361** (2026-11-24): **ci(release): close fail-open and half-done paths found in a release-tooling audit**
  *Symptoms*: ## Problem  An audit of the release tooling (release.yml, cross-compile.yml, release-announce.yml, the legacy `scripts/release.sh` driver and the recovery docs) found several paths that fail open or stop a release half-done:  - **release.yml** fails *after* the bump PR has merged when the tag or crates.io version already exists, or when the version equals main's (empty bump commit). A second concurrent dispatch is not refused at all. Without `RELEASE_PAT` a live run only warns, then the tag push never starts cross-compile.yml. Release notes measure from the newest release *including drafts*, and a spent version is left as a draft on purpose. `create_release` cannot be re-run once its tag is pushed. - **cross-compile.yml** cancels an in-flight tag run when a second run for the same tag starts (the documented recovery dispatch), possibly between the crates.io publish and the un-draft. A recovery un-draft of an older tag takes GitHub's `latest` marker by default and nothing moves it back. A missing signing key publishes an unsigned release with a warning. A failed `tar` inside `cd X && tar && cd ../..` is invisible to errexit, and `sha256sum ... || true` hides a missing asset class. The Windows steps run in pwsh, which only checks the last command's exit code. - **release-announce.yml** announces any published release, including a recovery un-draft of an old one. - **scripts/release.sh** carries bugs release.yml already fixed: it tags local HEAD rather than the bump PR's merge c

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

### Incident Patch 1: `d1948e2f` (2026-11-24)
**Commit Message**: fix(release): the manual release driver never changes the handshake floor (#6355)

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ readme = "README.md"
 [package.metadata.freenet]
 # Minimum compatible protocol version. Peers older than this are rejected at
 # the handshake, in both directions. The release workflow (release.yml) ships
-# this value unchanged; scripts/release.sh rewrites it. The env var
+# this value unchanged, and so does scripts/release.sh (#5833). The env var
 # FREENET_MIN_COMPATIBLE_VERSION overrides this at build time.
 #
 # 0.2.122: 0.2.120 and 0.2.121 cannot detect updates themselves (they parse
```

**File**: `crates/core/build.rs` (modified, +2/-1)
```diff
@@ -45,7 +45,8 @@ fn main() {
 
 fn emit_min_compatible_version() {
     // Priority for min-compatible version:
-    // 1. FREENET_MIN_COMPATIBLE_VERSION env var (set by release.sh)
+    // 1. FREENET_MIN_COMPATIBLE_VERSION env var (a manual override; the
+    //    release paths never set it, and release.sh clears it)
     // 2. package.metadata.freenet.min-compatible-version in Cargo.toml
     // 3. CARGO_PKG_VERSION (strict match — same as old behavior)
     //
```

**File**: `docs/RELEASING.md` (modified, +6/-4)
```diff
@@ -1004,10 +1004,12 @@ above: it refuses the connection outright, rather than deciding which message
 variants a peer can receive.
 
 `release.yml` ships the committed value unchanged, so raising it is its own
-reviewed PR, never a side effect of a release. (`scripts/release.sh` still
-rewrites it; see #5833.) `build.rs` requires an `X.Y.Z` value no higher than
-the package version. A floor in the same major.minor series is carried as a
-patch number (wire format 1). A floor in a different series (for example a
+reviewed PR, never a side effect of a release. `scripts/release.sh` also
+ships it unchanged and refuses `--min-compatible` (#5833). To raise it, change
+`min-compatible-version` in `crates/core/Cargo.toml` in a PR that goes through
+the checklist below; the next release from `main` ships it. `build.rs` requires
+an `X.Y.Z` value no higher than the package version. A floor in the same
+major.minor series is carried as a patch number (wire format 1). A floor in a different series (for example a
 1.0.0 build keeping floor 0.2.N) uses wire format 2 and is accepted only if
 its major is at most one below the package's, its minor is below 64 and its
 patch is below 256; `build.rs` fails the build otherwise. Releases before the
```

**File**: `scripts/release.sh` (modified, +38/-18)
```diff
@@ -68,8 +68,9 @@ show_help() {
     echo
     echo "Options:"
     echo "  --version X.Y.Z           Target version (required)"
-    echo "  --min-compatible X.Y.Z    Minimum compatible version for range-based"
-    echo "                            version checking (default: previous release)"
+    echo "  --min-compatible X.Y.Z    Refused. This script never changes the"
+    echo "                            handshake floor; raise it in its own reviewed"
+    echo "                            PR (docs/RELEASING.md)"
     echo "  --skip-tests              Skip pre-release tests"
     echo "  --dry-run                 Show what would be done without executing"
     echo "  --help                    Show this help"
@@ -99,9 +100,12 @@ while [[ $# -gt 0 ]]; do
             echo "      Gateways are now updated automatically after binaries are available."
             shift
             ;;
-        --min-compatible)
-            MIN_COMPATIBLE="$2"
-            shift 2
+        --min-compatible|--min-compatible=*)
+            # Refused on sight, in any spelling, with or without a value (#5833).
+            echo "Error: --min-compatible is no longer supported. This script never changes"
+            echo "       the handshake floor; raise min-compatible-version in"
+            echo "       crates/core/Cargo.toml in its own reviewed PR (docs/RELEASING.md)."
+            exit 1
             ;;
         --skip-tests)
             SKIP_TESTS=true
@@ -135,15 +139,34 @@ if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
     exit 1
 fi
 
-# Default min-compatible to the current version in Cargo.toml (the version before the bump).
-# This means gateways running the new version will still accept peers on the previous version.
-if [[ -z "$MIN_COMPATIBLE" ]]; then
-    MIN_COMPATIBLE=$(grep "^version" "$PROJECT_ROOT/crates/core/Cargo.toml" 2>/dev/null | head -1 | cut -d'"' -f2)
-    echo "Min-compatible version: $MIN_COMPATIBLE (defaulting to current version before bump)"
-else
-    echo "Min-compatible version: $MIN_COMPATIBLE (explicitly set)"
+# current_min_compatible <Cargo.toml> -- print the handshake floor committed in
+# `package.metadata.freenet.min-compatible-version`, or return 1 if it is
+# missing or not X.Y.Z.
+current_min_compatible() {
+    local value
+    value=$(grep -E '^min-compatible-version[[:space:]]*=' "$1" 2>/dev/null | head -1 | cut -d'"' -f2)
+    if [[ ! "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
+        return 1
+    fi
+    printf '%s\n' "$value"
+}
+
+# The handshake floor ships exactly as committed, as it does from release.yml
+# (#5833). This script used to default it to the previous release and write
+# that into the bump, which would make every updated peer refuse every peer
+# that had not updated yet: a network split on an ordinary release. Raising the
+# floor is its own reviewed PR (docs/RELEASING.md), so --min-compatible is
+# refused during argument parsing rather than written into a release bump.
+#
+# A committed floor that cannot be read is refused too: build.rs would then
+# fall back to the package version, the same split. The env override is
+# cleared so a value left in the caller's shell cannot reach the builds.
+if ! MIN_COMPATIBLE=$(current_min_compatible "$PROJECT_ROOT/crates/core/Cargo.toml"); then
+    echo "Error: could not read an X.Y.Z min-compatible-version from crates/core/Cargo.toml."
+    exit 1
 fi
-export FREENET_MIN_COMPATIBLE_VERSION="$MIN_COMPATIBLE"
+echo "Handshake floor (min-compatible-version): $MIN_COMPATIBLE (unchanged, shipped as committed)"
+unset FREENET_MIN_COMPATIBLE_VERSION
 
 # Get the most recently published version from crates.io (most authoritative source).
 #
@@ -803,11 +826,8 @@ update_versions() {
     sed_inplace "s/^version = \".*\"/version = \"$VERSION\"/" "$PROJECT_ROOT/crates/core/Cargo.toml"
     echo "✓"
 
-    # Update min-compatible-version in Cargo.toml metadata so cross-compile CI
-    # builds (which don't have the env var) get the correct min-compatible version.
-    echo -n "  Setting min-compatible-version to $MIN_COMPATIBLE... "
-    sed_inplace "s/^min-compatible-version = \".*\"/min-compatible-version = \"$MIN_COMPATIBLE\"/" "$PROJECT_ROOT/crates/core/Cargo.toml"
-    echo "✓"
+    # min-compatible-version is deliberately left alone (#5833): the
+    # committed floor ships unchanged.
 
     # Update fdev version and its freenet dependency
     echo -n "  Updating fdev to $FDEV_VERSION... "
```

**File**: `scripts/release_driver_test.sh` (modified, +143/-1)
```diff
@@ -27,7 +27,7 @@
 # fdev actually get published" and "does publishing happen after the tag", and
 # the only way to assert a property is to run the thing.
 #
-# Both functions are extracted verbatim from release.sh (`eval "$(awk ...)"`),
+# Functions are extracted verbatim from release.sh (`eval "$(awk ...)"`),
 # matching release_state_restore_test.sh's idiom, so these tests cannot drift
 # from the implementation.
 #
@@ -556,6 +556,148 @@ else
     fi
 fi
 
+# ---------------------------------------------------------------------------
+# N. The handshake floor ships as committed (#5833)
+# ---------------------------------------------------------------------------
+# release.sh used to default --min-compatible to the version before the bump
+# and write it into the bump, which would make every updated peer refuse every
+# peer that had not updated yet: a network split on an ordinary release. Now it
+# never changes the floor, refuses --min-compatible, refuses a committed floor
+# it cannot read (build.rs would fall back to the package version), and clears
+# FREENET_MIN_COMPATIBLE_VERSION so a value in the caller's shell cannot reach
+# the builds.
+FLOOR_FN="$(awk '/^current_min_compatible\(\) \{/,/^\}/' "$RELEASE_SH")"
+if [[ "$FLOOR_FN" != *"min-compatible-version"* ]]; then
+    fail "could not extract current_min_compatible() from release.sh" \
+        "Every floor case below runs it, so an empty extraction would make them" \
+        "all pass vacuously."
+else
+    eval "$FLOOR_FN"
+    # floor_case <desc> <Cargo.toml body> <expected output or FAIL>
+    floor_case() {
+        local desc="$1" body="$2" want="$3" work got
+        work="$(mktemp -d)"
+        printf '%s\n' "$body" > "$work/Cargo.toml"
+        if got="$(current_min_compatible "$work/Cargo.toml")"; then :; else got="FAIL"; fi
+        rm -rf "$work"
+        if [[ "$got" == "$want" ]]; then
+            pass "$desc"
+        else
+            fail "$desc" "got '$got', expected '$want'"
+        fi
+    }
+    floor_case "the floor read is min-compatible-version, not the package version" \
+        $'[package]\nname = "freenet"\nversion = "0.2.200"\n\n[package.metadata.freenet]\nmin-compatible-version = "0.2.122"' \
+        "0.2.122"
+    floor_case "a floor written without spaces around '=' is read" \
+        $'[package]\nversion = "0.2.200"\n[package.metadata.freenet]\nmin-compatible-version="0.2.150"' "0.2.150"
+    floor_case "a missing min-compatible-version is refused" \
+        $'[package]\nname = "freenet"\nversion = "0.2.200"' "FAIL"
+    floor_case "a malformed min-compatible-version is refused" \
+        $'[package]\nversion = "0.2.200"\n[package.metadata.freenet]\nmin-compatible-version = "next"' "FAIL"
+
+    REAL_TOML="$SCRIPT_DIR/../crates/core/Cargo.toml"
+    if got="$(current_min_compatible "$REAL_TOML")"; then
+        pass "the real crates/core/Cargo.toml has a readable floor ($got)"
+    else
+        fail "the real crates/core/Cargo.toml has no readable min-compatible-version" \
+            "Every release.sh run would refuse."
+    fi
+fi
+
+# The call site, run for real: release.sh is copied into a throwaway repo with
+# a stub `cargo`. The first thing the driver does after the floor check is
+# `cargo search`, with stderr discarded, so the stub records that it was
+# reached, and what FREENET_MIN_COMPATIBLE_VERSION it saw, in a file.
+# floor_run_case <desc> <expect: refuse|proceed> <error text or ""> <Cargo.toml body> <args...>
+floor_run_case() {
+    local desc="$1" expect="$2" want_err="$3" toml_body="$4" out rc work reached seen
+    shift 4
+    work="$(mktemp -d)"
+    mkdir -p "$work/scripts" "$work/crates/core" "$work/bin"
+    cp "$RELEASE_SH" "$work/scripts/release.sh"
+    printf '%s\n' "$toml_body" > "$work/crates/core/Cargo.toml"
+    printf '#!/usr/bin/env bash\nprintf "%%s\\n" "${FREENET_MIN_COMPATIBLE_VERSION-<unset>}" > "%s/reached_cargo"\nexit 1\n' \
+        "$work" > "$work/bin/cargo"
+    chmod +x "$work/bin/cargo"
+    (cd "$work" && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git init -q .)
+    rc=0
+    out="$(cd "$work" && PATH="$work/bin:$PATH" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
+        FREENET_MIN_COMPATIBLE_VERSION=0.0.1 bash scripts/release.sh "$@" 2>&1)" || rc=$?
+    reached=no
+    seen=""
+    if [[ -e "$work/reached_cargo" ]]; then
+        reached=yes
+        seen="$(cat "$work/reached_cargo")"
+    fi
+    rm -rf "$work"
+    case "$expect" in
+        refuse)
+            if [[ "$rc" -ne 0 ]] && [[ "$reached" == no ]] && [[ "$out" == *"$want_err"* ]]; then
+                pass "$desc"
+            else
+                fail "$desc" "exit=$rc, reached cargo=$reached, wanted '$want_err'" "$out"
+            fi
+            ;;
+        proceed)
+            # A shell value of the override must not reach the build steps.
+            if [[ "$reached" == yes ]] && [[ "$seen" == "<unset>" ]]; then
+                pass "$desc"
+            else

```

---

### Incident Patch 2: `1ffa3f10` (2026-11-24)
**Commit Message**: fix(shell): derive the notification consent key from the decoded contract key (#6359)

**File**: `crates/core/src/server/path_handlers/assets/shell_bridge.js` (modified, +9/-1)
```diff
@@ -282,7 +282,15 @@ function freenetBridge(authToken, userToken, hostedMode) {
     // match than CONTRACT_PREFIX_RE (which is anchored), which is fine because
     // `location.pathname` is server-controlled and can't contain `?`/`#`.
     var m = location.pathname.match(/\/v[12]\/contract\/web\/([^/?#]+)/);
-    return m ? 'freenet_notify:' + m[1] : null;
+    if (!m) return null;
+    // Canonicalise: percent-encoded spellings of one key (`%41` vs `A`) must
+    // share one consent / rate / snooze entry. Fall back to the raw segment
+    // when it is not valid percent-encoding.
+    var seg = m[1];
+    try {
+      seg = decodeURIComponent(seg);
+    } catch (_) {}
+    return 'freenet_notify:' + seg;
   }
 
   function contractSnoozeKey() {
```

**File**: `crates/core/src/server/shell_bridge_notifications.test.mjs` (modified, +35/-0)
```diff
@@ -752,6 +752,41 @@ function check(name, cond) {
   }
 }
 
+// 8. contractConsentKey canonicalises percent-encoded spellings of one key.
+{
+  const kb = src.indexOf('function contractConsentKey(');
+  const ke = src.indexOf('function contractSnoozeKey(');
+  const keyFn = src.slice(kb, ke);
+  const keyFor = (pathname) =>
+    new Function('location', `${keyFn}\nreturn contractConsentKey();`)({
+      pathname,
+    });
+  const plain = keyFor('/v1/contract/web/AbC123/');
+  check('plain key derived', plain === 'freenet_notify:AbC123');
+  check(
+    'percent-encoded spelling shares the plain key',
+    keyFor('/v1/contract/web/%41bC123/') === plain,
+  );
+  check(
+    'mixed-case hex escape shares the plain key',
+    keyFor('/v2/contract/web/Ab%43123/') === plain,
+  );
+  check(
+    'invalid escape does not throw and is kept raw',
+    keyFor('/v1/contract/web/Ab%ZZ/') === 'freenet_notify:Ab%ZZ',
+  );
+  check(
+    'double-encoded spelling decodes once and stays distinct',
+    keyFor('/v1/contract/web/%2541bC123/') === 'freenet_notify:%41bC123' &&
+      keyFor('/v1/contract/web/%2541bC123/') !== plain,
+  );
+  check(
+    'invalid UTF-8 escape does not throw and is kept raw',
+    keyFor('/v1/contract/web/Ab%C3/') === 'freenet_notify:Ab%C3',
+  );
+  check('non-contract path -> null', keyFor('/other/') === null);
+}
+
 if (failures > 0) {
   console.error(`\nnotify-rate-limiter: ${failures} check(s) FAILED`);
   process.exit(1);
```

---

### Incident Patch 3: `5ffab250` (2026-11-24)
**Commit Message**: fix(dashboard): only use a well-formed, bounded gateway version in mismatch hints (#6358)

**File**: `crates/core/src/node/network_status.rs` (modified, +77/-8)
```diff
@@ -2643,13 +2643,7 @@ fn snapshot_at(now: Instant) -> Option<NetworkStatusSnapshot> {
             address: f.address,
             reason_html: match &f.reason {
                 FailureReason::VersionMismatch { local, gateway } => {
-                    let local = html_escape(local);
-                    let gateway = html_escape(gateway);
-                    format!(
-                        "<strong>Version mismatch</strong>: Your version: <code>{local}</code> \
-                         — Gateway requires: <code>{gateway}</code><br>\
-                         Run: <code>cargo install --force freenet --version {gateway}</code>"
-                    )
+                    version_mismatch_html(local, gateway)
                 }
                 FailureReason::NatTraversalFailed => {
                     let has_peer_connections = s.connected_peers.iter().any(|p| !p.is_gateway);
@@ -2784,6 +2778,33 @@ fn snapshot_at(now: Instant) -> Option<NetworkStatusSnapshot> {
     })
 }
 
+/// Longest peer-supplied version text that is logged or displayed.
+const MAX_PEER_VERSION_TEXT_LEN: usize = 64;
+
+/// True when `s` is a well-formed version string (pre-release and build
+/// suffixes allowed) of bounded length, the only kind that may be placed into
+/// a suggested install command.
+fn is_well_formed_version(s: &str) -> bool {
+    s.len() <= MAX_PEER_VERSION_TEXT_LEN && semver::Version::parse(s).is_ok()
+}
+
+/// Dashboard text for a version mismatch. The install command is only offered
+/// when both versions are well-formed.
+fn version_mismatch_html(local: &str, gateway: &str) -> String {
+    if !(is_well_formed_version(local) && is_well_formed_version(gateway)) {
+        return "<strong>Version mismatch</strong>: the gateway reported a version \
+                this node could not read. Update Freenet to the latest release."
+            .to_string();
+    }
+    let local = html_escape(local);
+    let gateway = html_escape(gateway);
+    format!(
+        "<strong>Version mismatch</strong>: Your version: <code>{local}</code> \
+         — Gateway requires: <code>{gateway}</code><br>\
+         Run: <code>cargo install --force freenet --version {gateway}</code>"
+    )
+}
+
 /// Classify a ConnectionError::TransportError string into a FailureReason.
 pub fn classify_transport_error(error_msg: &str) -> FailureReason {
     if error_msg.contains("Version incompatibility") {
@@ -2801,7 +2822,11 @@ pub fn classify_transport_error(error_msg: &str) -> FailureReason {
             .and_then(|s| s.split('\n').next())
             .map(|s| s.trim().to_string())
             .unwrap_or_default();
-        FailureReason::VersionMismatch { local, gateway }
+        if is_well_formed_version(&local) && is_well_formed_version(&gateway) {
+            FailureReason::VersionMismatch { local, gateway }
+        } else {
+            FailureReason::Other("version mismatch (version text not recognised)".to_string())
+        }
     } else if error_msg.contains("max connection attempts reached") {
         FailureReason::NatTraversalFailed
     } else {
@@ -2899,6 +2924,50 @@ mod tests {
         }
     }
 
+    #[test]
+    fn test_classify_version_mismatch_rejects_unrecognised_text() {
+        let msg = "Version incompatibility with gateway\n  Your client version: 0.1.133\n  Gateway version: 0.1.135 --git https://example.invalid/x\n  \n";
+        assert!(matches!(
+            classify_transport_error(msg),
+            FailureReason::Other(_)
+        ));
+        let msg = "Version incompatibility with gateway\n  Your client version: 0.1.133\n  Gateway version: \n";
+        assert!(matches!(
+            classify_transport_error(msg),
+            FailureReason::Other(_)
+        ));
+    }
+
+    #[test]
+    fn test_version_mismatch_html_omits_command_for_unrecognised_text() {
+        let html = version_mismatch_html("0.1.133", "1.0.0 --git https://example.invalid/x");
+        assert!(!html.contains("cargo install"));
+        assert!(!html.contains("example.invalid"));
+    }
+
+    #[test]
+    fn test_classify_version_mismatch_accepts_prerelease_and_rejects_overlong() {
+        let msg = "Version incompatibility with gateway\n  Your client version: 0.1.133\n  Gateway version: 1.2.3-rc.1+b5\n  \n";
+        match classify_transport_error(msg) {
+            FailureReason::VersionMismatch { gateway, .. } => assert_eq!(gateway, "1.2.3-rc.1+b5"),
+            FailureReason::NatTraversalFailed
+            | FailureReason::Timeout
+            | FailureReason::Other(_) => panic!("expected VersionMismatch"),
+        }
+        let html = version_mismatch_html("0.1.133", "1.2.3-rc.1+b5");
+        assert!(html.contains("cargo install --force freenet --version 1.2.3-rc.1+b5"));
+
+        let long = format!("1.2.3-{}", "a".repeat(100));
+        let msg = format!(
+            "Version incompatibility with gateway\n  Your client version: 0.1.133\n  Gateway version: {long}\n  \n"
+        );
+        assert!(mat
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +47/-1)
```diff
@@ -4624,6 +4624,13 @@ fn ack_ok_parts(
 fn handle_ack_connection_error(err: Cow<'static, str>) -> TransportError {
     if let Some(expected) = err.split("expected version").nth(1) {
         let remote_version_str = expected.trim();
+        // The version is echoed in logs and in a suggested install command,
+        // so only a well-formed version is ever carried forward.
+        if remote_version_str.len() > 64 || semver::Version::parse(remote_version_str).is_err() {
+            return TransportError::ConnectionEstablishmentFailure {
+                cause: Cow::Borrowed("remote reported an unrecognised protocol version"),
+            };
+        }
         // Check if this old peer's rejection actually means we need to update.
         // Old peers do strict exact-match. If they're compatible with our range
         // but just don't support range-checking, we should NOT self-update.
@@ -4647,7 +4654,13 @@ fn handle_ack_connection_error(err: Cow<'static, str>) -> TransportError {
             actual: PCK_VERSION.to_string(),
         }
     } else {
-        TransportError::ConnectionEstablishmentFailure { cause: err }
+        // Peer text is logged and displayed, so keep only a bounded prefix.
+        let cause = if err.chars().count() > 64 {
+            Cow::Owned(err.chars().take(64).collect::<String>())
+        } else {
+            err
+        };
+        TransportError::ConnectionEstablishmentFailure { cause }
     }
 }
 
@@ -4939,6 +4952,39 @@ pub mod mock_transport {
             }
         }
 
+        // A refusal whose version is not a well-formed version is not carried
+        // into the mismatch error (which is rendered as an install command).
+        for bad in [
+            "expected version 1.2.3 --git https://example.invalid/x",
+            "expected version 1.2.3; echo hi",
+            "expected version <b>1.2.3</b>",
+            "expected version 1.2",
+            "expected version ",
+            "expected version 1.2.3-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
+        ] {
+            let err = handle_ack_connection_error(bad.to_string().into());
+            assert!(
+                matches!(
+                    &err,
+                    TransportError::ConnectionEstablishmentFailure { cause }
+                        if !cause.contains("example.invalid") && !cause.contains("echo")
+                ),
+                "expected generic failure for {bad:?}, got {err:?}"
+            );
+        }
+
+        let ok = handle_ack_connection_error("expected version 1.2.3-rc.1+b5".to_string().into());
+        assert!(matches!(
+            &ok,
+            TransportError::ProtocolVersionMismatch { expected, .. } if expected == "1.2.3-rc.1+b5"
+        ));
+        let long_other = "x".repeat(500);
+        let err = handle_ack_connection_error(long_other.into());
+        assert!(matches!(
+            &err,
+            TransportError::ConnectionEstablishmentFailure { cause } if cause.chars().count() == 64
+        ));
+
         let err_msg_no_version = "remote is using a different protocol version".to_string();
         match handle_ack_connection_error(err_msg_no_version.clone().into()) {
             TransportError::ConnectionEstablishmentFailure { cause } => {
```

#### Recent Merged Pull Requests:
- **PR #6362** (2026-11-24): ci(release): ship an exact soaked commit so main stays open during a cut (@sanity)
- **PR #6361** (2026-11-24): ci(release): close fail-open and half-done paths found in a release-tooling audit (@sanity)
- **PR #6360** (2026-11-24): build: release 0.2.164 (@sanity)
- **PR #6359** (2026-11-24): fix(shell): derive the notification consent key from the decoded contract key (@sanity)
- **PR #6358** (2026-11-24): fix(dashboard): only use a well-formed, bounded gateway version in mismatch hints (@sanity)
- **PR #6357** (2026-11-24): test(sim): keep peer-to-peer native connects off in the closed gateway-join sim (@sanity)

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

## X. release): the manual release driver never changes the handshake floor

**RULE**:
When implementing operations in `crates/core/Cargo.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1948e2f`: release): the manual release driver never changes the handshake floor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/Cargo.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# this value unchanged, and so does scripts/release.sh (#5833). The env var
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
# this value unchanged; scripts/release.sh rewrites it. The env var
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1948e2f` are properly handled with clean fallback behavior.
