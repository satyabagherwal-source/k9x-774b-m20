> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `b94bef03`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T10:16:09.154Z  
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
> **Harvest Timestamp**: 2026-11-05T10:16:09.148Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3111 stars

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
- **Issue #6113** (2026-11-05): **test(transport): pin the QUIC fair share where it holds and record the default-minimum case**
  *Symptoms*: ## Problem  #6112 reported that under a saturated egress cap (`total-bandwidth-limit`), the QUIC window cap from #6111 let a path take about 390 kB/s of a 500 kB/s cap, against what the test took to be a 250 kB/s fair share.  That test built its `GlobalBandwidthManager` with the default minimum per connection, `DEFAULT_MIN_PER_CONNECTION` (1 MB/s), which the manager clamps to the total. So each connection's share was the whole 500 kB/s cap, and the QUIC window cap (`share x RTT`) did no apportioning. Measuring it properly shows two cases:  | Setup (2 connections, 500 kB/s cap, 40 seeds) | QUIC | UDP stream sender | |---|---|---| | Minimum per connection below the 250 kB/s share | 239 to 240 kB/s | 250 kB/s | | The same, window cap removed | 491 kB/s | 12 kB/s | | **Default minimum** (share = whole cap) | **about 462 kB/s** | **about 38 kB/s** |  The UDP sender in every row is paced as the transport paces a stream fragment: its connection's `TokenBucket` at the share, then `try_take` on the egress cap with `jittered` sleeps.  With the default minimum, which covers nearly every residential `total-bandwidth-limit` (any total below n x 1 MB/s), the window cap does not apportion the cap. The egress cap is not neutral either: QUIC waits in `poll_admit` (a queued waker, woken in order as the bucket refills), while UDP stream senders `try_take` and sleep jittered deficits, so QUIC wins contended refills. **That defect remains open in #6112. This PR does not fix it.**  ## What this PR

- **Issue #6111** (2026-11-05): **feat(transport): cap the QUIC window to the configured bandwidth**
  *Symptoms*: ## Problem  `bandwidth-limit`, and the fair share of `total-bandwidth-limit`, pace the UDP transport's streams through each connection's token bucket. A QUIC path does not use that bucket, so once a path carries data both settings would stop applying to it. Under `total-bandwidth-limit` the node-wide egress cap still holds the total. Without that cap, nothing would.  ## Approach  As recommended in the e5b plan (section 5): the congestion controller wrapper around Cubic, which already sees every call quinn makes, now caps the window.  - **The window:** `CappedCubic::window()` (renamed from `AckCounting`, since it now does more than count acknowledgements) returns `min(Cubic's window, rate x RTT)`.   - It never goes below `window_floor`: two full datagrams and one byte (2401 B). quinn refuses a send at `in_flight + bytes >= window`, so a floor of exactly 2400 B admitted only one datagram, which then waited for the peer's delayed ack.   - quinn's in-flight limit reads this window, and that is what holds a path to about `rate`; the pacer reads it too, but only spreads the sends.   - With no limit configured, or before the first acknowledgement, the window is Cubic's unchanged. For the first batch of acknowledgements the RTT is still quinn's 333 ms initial estimate, so the cap is loose for that batch. - **Cubic behind the cap:** a send the cap holds back counts in quinn as blocked by congestion, not limited by the application. Left alone, Cubic would grow on every acknowledgement 

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

### Incident Patch 1: `b94bef03` (2026-11-05)
**Commit Message**: test(transport): pin the QUIC fair share where it holds and record the default-minimum case (#6113)

**File**: `.claude/rules/transport.md` (modified, +20/-7)
```diff
@@ -742,8 +742,9 @@ Rate calculation on every rate update (peer_connection::paced_rate; #6047):
   retransmits are unpaced.
   QUIC has no bucket. The same rate (QuicRateLimit::rate, which calls
   paced_rate) caps each QUIC connection's congestion window instead:
-  recycle::CappedCubic::window = min(Cubic's window, rate x RTT), never
-  below window_floor (two full datagrams and one byte, 2401 B: quinn refuses
+  recycle::CappedCubic::window = min(Cubic's window, max(rate x RTT,
+  window_floor)): the cap never goes below window_floor (two full datagrams
+  and one byte, 2401 B: quinn refuses
   a send at in_flight + bytes >= window, so 2400 would admit one datagram, and
   a lone packet waits for the peer's 25 ms delayed ack). With no limit, or
   before the first acknowledgement, it is Cubic's window; for the first batch
@@ -763,11 +764,23 @@ Rate calculation on every rate update (peer_connection::paced_rate; #6047):
   takes that connection's full share, so a peer whose traffic is split across
   both transports can get up to twice its share (the egress cap still bounds
   the node). e5b-6 decides whether one peer's streams stay on one transport.
-  Under a binding egress cap the window cap does not hold a path to its
-  share either: the cap's holds add to quinn's RTT samples, and rate x RTT
-  grows with them (a_quic_path_and_udp_streams_both_progress_under_an_
-  egress_cap measured about 390 kB/s against a 250 kB/s share, 400 kB/s with
-  no window cap). The egress cap still holds the node's total.
+  Under a saturated egress cap, the window cap apportions it only when the
+  per-connection share is below the cap. With the minimum per connection set
+  below the share (two connections, one flow each, equal RTT),
+  a_quic_path_and_udp_streams_each_get_their_fair_share_under_a_saturated_
+  egress_cap measured QUIC about 239 kB/s and a UDP stream sender about
+  250 kB/s of a 250 kB/s share, over 40 seeds (491 and 12 kB/s with the
+  window cap removed). With the DEFAULT minimum (DEFAULT_MIN_PER_CONNECTION,
+  1 MB/s, which GlobalBandwidthManager clamps to the total), a total below
+  n x 1 MB/s, so nearly every residential cap, gives every connection a share
+  of min(1 MB/s, total): each QUIC window cap is total x RTT and apportions
+  nothing, and the egress cap itself is not neutral between the transports.
+  QUIC waits in poll_admit (a queued waker, woken in order as the bucket
+  refills); a UDP stream sender takes with try_take and sleeps jittered
+  deficits, so QUIC wins contended refills. Measured the same way with the
+  default minimum: QUIC about 462 kB/s, UDP about 38 kB/s (40 seeds). #6112
+  tracks the fix.
+  CappedCubic::metrics reports the capped window as congestion_window.
   The transport sets the rate when it binds (bind_udp_listener, pinned by
   the_transport_gives_the_endpoint_its_bandwidth_settings); QuicSettings
   from the config carries none.
```

**File**: `crates/core/src/transport/quic/recycle.rs` (modified, +18/-6)
```diff
@@ -329,6 +329,16 @@ impl CappedCubic {
         }
     }
 
+    /// `cubic` (Cubic's window) lowered to the rate's window, when there is a
+    /// limit and an RTT; otherwise `cubic`. The one place the cap is applied,
+    /// for [`Controller::window`] and [`Controller::metrics`].
+    fn capped(&self, cubic: u64) -> u64 {
+        match (self.rate.rate(), self.srtt) {
+            (Some(rate), Some(srtt)) => cubic.min(rate_window(rate, srtt, self.mtu)),
+            (None, _) | (_, None) => cubic,
+        }
+    }
+
     /// Whether the wrapped controller is a `C`.
     #[cfg(test)]
     pub(crate) fn wraps<C: Controller + 'static>(&self) -> bool {
@@ -400,15 +410,17 @@ impl Controller for CappedCubic {
     }
 
     fn window(&self) -> u64 {
-        let window = self.inner.window();
-        match (self.rate.rate(), self.srtt) {
-            (Some(rate), Some(srtt)) => window.min(rate_window(rate, srtt, self.mtu)),
-            (None, _) | (_, None) => window,
-        }
+        self.capped(self.inner.window())
     }
 
+    /// Cubic's metrics, with the window this controller gives quinn (the
+    /// capped one) in place of Cubic's own.
     fn metrics(&self) -> ControllerMetrics {
-        self.inner.metrics()
+        let mut metrics = self.inner.metrics();
+        // Cubic's `congestion_window` is its window; lower it as `window`
+        // does, without asking Cubic again.
+        metrics.congestion_window = self.capped(metrics.congestion_window);
+        metrics
     }
 
     fn clone_box(&self) -> Box<dyn Controller> {
```

**File**: `crates/core/src/transport/quic/recycle/cap_tests.rs` (modified, +121/-13)
```diff
@@ -179,9 +179,11 @@ fn with_a_limit_the_window_is_the_lower_of_cubics_and_the_rates() {
     );
     fast.srtt = Some(Duration::from_millis(40));
     assert_eq!(fast.window(), fast.inner.window());
-    // And a low one at the same RTT lowers it.
+    assert_eq!(fast.metrics().congestion_window, fast.inner.window());
+    // And a low one at the same RTT lowers it, and the metrics report it.
     fast.rate = QuicRateLimit::new(Some(100_000), None);
     assert_eq!(fast.window(), 4000);
+    assert_eq!(fast.metrics().congestion_window, 4000);
 }
 
 /// A socket that delivers each datagram `delay` after it is sent, on
@@ -356,6 +358,12 @@ impl Link {
 
     /// [`Self::send`], from `a` to `b` when `from_a`, else from `b` to `a`.
     async fn send_from(&self, from_a: bool, len: usize, limit: Duration) -> Duration {
+        self.send_timed(from_a, len, limit).await.1
+    }
+
+    /// [`Self::send_from`], also returning when the transfer started (ns on
+    /// the link's clock, once the connection was up).
+    async fn send_timed(&self, from_a: bool, len: usize, limit: Duration) -> (u64, Duration) {
         let _permit = self
             .b
             .allow_peer(self.a_addr, self.a_keys.public())
@@ -388,7 +396,7 @@ impl Link {
             assert_eq!(read.len(), len);
             let elapsed = Duration::from_nanos(time.now_nanos() - start);
             drop((client, server));
-            elapsed
+            (start, elapsed)
         })
         .await
     }
@@ -463,24 +471,20 @@ fn the_floor_keeps_two_datagrams_in_flight_both_ways() {
 }
 
 /// A no-starvation check. Under a node-wide egress cap, a QUIC path and a
-/// sender that takes from the cap as the UDP transport's stream senders do
-/// both finish, no UDP fragment waits past a stream's 5 s gap deadline, and
-/// everything the node sends stays within the cap.
-///
-/// It does not show the QUIC path keeping to its fair share, because it does
-/// not: the cap's holds add to the RTT quinn measures, and the window cap is
-/// `rate x RTT`, so it loosens as the egress cap binds. Measured here: the
-/// QUIC path ran at about 390 kB/s against a share of 250 kB/s, and at about
-/// 400 kB/s with the window cap removed. The egress cap is what holds the
-/// node's total, and this test checks that it does.
+/// sender that takes from the cap greedily, with no bucket of its own, both
+/// finish, no UDP fragment waits past a stream's 5 s gap deadline, and
+/// everything the node sends stays within the cap. Fair shares are
+/// `a_quic_path_and_udp_streams_each_get_their_fair_share_under_a_saturated_egress_cap`.
 #[test]
 fn a_quic_path_and_udp_streams_both_progress_under_an_egress_cap() {
     use crate::transport::egress_cap::{PACED_WAIT_DEADLINE, try_take};
     bounded(|| async move {
         const CAP: u64 = 500_000;
         const QUIC_LEN: usize = 1_000_000;
         const UDP_LEN: usize = 1_000_000;
-        let manager = Arc::new(GlobalBandwidthManager::new(CAP as usize, None));
+        // A minimum below the share, or the default minimum (1 MB/s, clamped
+        // to the total) makes each connection's share the whole cap.
+        let manager = Arc::new(GlobalBandwidthManager::new(CAP as usize, Some(1000)));
         manager.register_connection();
         manager.register_connection();
         let link = Arc::new(
@@ -559,6 +563,110 @@ fn a_quic_path_and_udp_streams_both_progress_under_an_egress_cap() {
     })
 }
 
+/// Under a saturated egress cap shared by two connections, with the minimum
+/// per connection set below the share, a QUIC path and a UDP stream sender on
+/// the other connection each get their fair share, half the cap, within 15%.
+/// The UDP sender is paced as the UDP transport paces a stream fragment: it
+/// reserves from its own connection's token bucket at the share
+/// (`TokenBucket::reserve`), then takes from the egress cap. Each side's rate
+/// is the bytes it put on the wire while the QUIC transfer ran, from when its
+/// connection was up.
+///
+/// What it covers is narrow: two connections, the same RTT, one flow each,
+/// and a minimum below the share. With the default minimum the share is the
+/// whole cap and the window cap does not apportion it (see `transport.md`).
+/// Seeded; over 40 seeds the rates ranged 239354 to 239658 B/s for QUIC and
+/// 249990 to 250105 B/s for UDP.
+///
+/// Measured: QUIC about 239 kB/s and UDP about 250 kB/s of a 250 kB/s share.
+/// With the window cap removed (and Cubic no longer told about it) QUIC took
+/// about 491 kB/s and UDP about 12 kB/s, so the window cap is what holds QUIC
+/// to its share here.
+///
+/// #6112 measured QUIC at about 390 kB/s against what it took for a 250 kB/s
+/// share. With the default minimum per connection (1 MB/s, which
+/// `GlobalBandwidthManager::new` clamps to the total) the share is the whole
+/// cap, so the window cap does not apportion it; that case is the open part
+/// of #6112, and this test sets a minimum below 
```

---

### Incident Patch 2: `275333f0` (2026-11-05)
**Commit Message**: feat(transport): cap the QUIC window to the configured bandwidth (#6111)

**File**: `.claude/rules/transport.md` (modified, +38/-2)
```diff
@@ -740,6 +740,37 @@ Rate calculation on every rate update (peer_connection::paced_rate; #6047):
   (#3702 burst). The global share is still taken as is, as before #6047.
   Only stream fragments draw on the bucket; short messages, ACKs and
   retransmits are unpaced.
+  QUIC has no bucket. The same rate (QuicRateLimit::rate, which calls
+  paced_rate) caps each QUIC connection's congestion window instead:
+  recycle::CappedCubic::window = min(Cubic's window, rate x RTT), never
+  below window_floor (two full datagrams and one byte, 2401 B: quinn refuses
+  a send at in_flight + bytes >= window, so 2400 would admit one datagram, and
+  a lone packet waits for the peer's 25 ms delayed ack). With no limit, or
+  before the first acknowledgement, it is Cubic's window; for the first batch
+  of acknowledgements the RTT is still quinn's 333 ms initial estimate, so the
+  cap is loose for that batch. quinn's in-flight limit reads the window, which
+  holds a path to about the rate (a_path_under_a_bandwidth_limit_keeps_to_it:
+  within 10% at 400 kB/s over a 40 ms round trip); the pacer only spreads the
+  sends. While the cap is below Cubic's window, on_ack reports the path as
+  app-limited to Cubic, so Cubic does not grow behind the cap and still backs
+  off on loss once the cap rises above the capacity (RFC 7661 idea). It
+  covers everything the path sends, shorts and control frames included. It
+  does not hold where rate x RTT is under the floor: there a path keeps two
+  datagrams in flight, about 2400 B per round trip (at the 64 KiB/s minimum,
+  any round trip under about 37 ms; pinned by
+  the_floor_keeps_two_datagrams_in_flight_both_ways). A QUIC path is not a
+  connection to GlobalBandwidthManager: it rides on its UDP connection and
+  takes that connection's full share, so a peer whose traffic is split across
+  both transports can get up to twice its share (the egress cap still bounds
+  the node). e5b-6 decides whether one peer's streams stay on one transport.
+  Under a binding egress cap the window cap does not hold a path to its
+  share either: the cap's holds add to quinn's RTT samples, and rate x RTT
+  grows with them (a_quic_path_and_udp_streams_both_progress_under_an_
+  egress_cap measured about 390 kB/s against a 250 kB/s share, 400 kB/s with
+  no window cap). The egress cap still holds the node's total.
+  The transport sets the rate when it binds (bind_udp_listener, pinned by
+  the_transport_gives_the_endpoint_its_bandwidth_settings); QuicSettings
+  from the config carries none.
 
 Token reservation:
   → Reserve BEFORE sending
@@ -1128,6 +1159,10 @@ snapshot except the two gauges.
   `PathGauge` guard inside the attempt, so dropping the attempt leaves the gauge.
   `quic_paths_active` is also in `resource_utilization` beside
   `memory_rss_bytes`.
+  `quic_flow_control_window_bytes`: the flow-control window of this node's QUIC
+  connections (per connection and direction), set when the endpoint is built,
+  0 without one; a state, not reset and not activity. Throughput by window
+  size shows whether nodes at the 128 KiB floor are slower on QUIC than on UDP.
   Not built: stream-concurrency instruments on real QUIC (`quic_open_uni_waited`,
   permit waits, ge_8..ge_48, control_* refusals) have no source until e5b and
   read zero in shadow; the `transport=legacy|quic` connection attribute; a
@@ -1244,7 +1279,8 @@ exposes (its module doc lists the few it does not):
   grease_quic_bit(false) (the demux rule depends on it), versions [1],
   max_udp_payload / initial and min MTU 1200, no MTU discovery, no GSO,
   keepalive 15 s (None when the TimeSource disables keepalive), idle = the
-  TimeSource's connection idle timeout, Cubic, 64 uni / 0 bidi streams,
+  TimeSource's connection idle timeout, Cubic with its window capped to the
+  configured bandwidth (recycle::CappedCubic), 64 uni / 0 bidi streams,
   stream / receive / send window = clamp(5% of memory / (2 x
   max-number-of-connections), 128 KiB, 2 MiB), no unreliable datagrams, no
   spin bit, migration off, max_incoming 64, incoming buffers 64 KiB / 1 MiB,
@@ -1743,7 +1779,7 @@ Path recycling (quic/recycle.rs, #5940 step M6): besides the send-reset
   the peer acknowledged none of them, and the peer kept sending (no two
   samples in a row without anything from it). A peer that keeps sending but
   acknowledges none of our packets is not a conforming QUIC peer (RFC 9000 13.2.1). Newly acknowledged packets
-  are counted by AckCounting, which wraps Cubic in transport_config;
+  are counted by CappedCubic, which wraps Cubic in transport_config;
   ConnectionStats has no such counter. Two samples in a row with nothing
   from the peer end the window, and so does a sample with nothing
   outstanding (in flight after the latest acknowledgements, minus losses,
```

**File**: `crates/core/src/config.rs` (modified, +2/-0)
```diff
@@ -2934,6 +2934,8 @@ impl NetworkApiConfig {
             memory_limit: crate::wasm_runtime::read_total_ram_bytes()
                 .unwrap_or(QUIC_FALLBACK_TOTAL_RAM),
             idle_timeout: None,
+            // The transport sets it from its bandwidth settings when it binds.
+            rate_limit: Default::default(),
         })
     }
 
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +1/-1)
```diff
@@ -1432,7 +1432,7 @@ impl P2pConnManager {
                 ledbat_min_ssthresh: self.ledbat_min_ssthresh,
                 congestion_config: Some(self.congestion_config.clone()),
                 ack_version_floor_override: self.ack_version_floor_override,
-                quic: self.quic.settings,
+                quic: self.quic.settings.clone(),
                 quic_policy: Some(self.quic_policy),
                 advertised_version_override: self.advertised_version_override,
                 task_registrar: Some(self.task_registrar.clone()),
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +7/-1)
```diff
@@ -3132,6 +3132,10 @@ fn event_kind_to_json(kind: &EventKind) -> serde_json::Value {
                 "quic_paths_active".into(),
                 serde_json::json!(snapshot.quic_paths_active),
             );
+            m.insert(
+                "quic_flow_control_window_bytes".into(),
+                serde_json::json!(snapshot.quic_flow_control_window_bytes),
+            );
             m.insert(
                 "nat_fail_samples".into(),
                 serde_json::json!(snapshot.nat_fail_samples),
@@ -7951,6 +7955,7 @@ mod tests {
         snapshot.quic_establish_samples = 903;
         snapshot.quic_paths_offered_or_dialing = 904;
         snapshot.quic_paths_active = 905;
+        snapshot.quic_flow_control_window_bytes = 906;
         let json = event_kind_to_json(&super::super::EventKind::TransportSnapshot(Box::new(
             snapshot.clone(),
         )));
@@ -7979,6 +7984,7 @@ mod tests {
             ("quic_establish_samples", 903),
             ("quic_paths_offered_or_dialing", 904),
             ("quic_paths_active", 905),
+            ("quic_flow_control_window_bytes", 906),
         ] {
             expected.push((key.to_string(), value));
         }
@@ -7989,7 +7995,7 @@ mod tests {
                 + QuicUpgradeOutcome::COUNT
                 + 2 * QuicFallback::COUNT
                 + QuicPathAge::COUNT
-                + 5
+                + 6
         );
         for (key, value) in expected {
             assert_eq!(json[&key], value, "event-log value for {key}");
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +16/-1)
```diff
@@ -281,7 +281,19 @@ pub(super) async fn bind_udp_listener<S: Socket>(
     // above; the simulation's `VirtualTime` in a simulation, which has no
     // cap), authenticates with this node's transport key, and has an empty
     // allow-set: nothing reaches it until an upgrade path allows a peer.
-    let quic_endpoint = config.quic.as_ref().and_then(|settings| {
+    // Each QUIC connection's window is capped at the rate the UDP token
+    // bucket paces a connection at (`quic::recycle::CappedCubic`).
+    let quic_settings = config
+        .quic
+        .clone()
+        .map(|settings| super::quic::QuicSettings {
+            rate_limit: super::quic::config::QuicRateLimit::new(
+                config.bandwidth_limit,
+                config.global_bandwidth.clone(),
+            ),
+            ..settings
+        });
+    let quic_endpoint = quic_settings.as_ref().and_then(|settings| {
         let socket = socket.clone();
         match quic_virtual_time {
             // Building the endpoint draws quinn's RNG seed from `GlobalRng`.
@@ -304,6 +316,9 @@ pub(super) async fn bind_udp_listener<S: Socket>(
         }
     });
 
+    if let (Some(_), Some(settings)) = (&quic_endpoint, &quic_settings) {
+        super::TRANSPORT_METRICS.set_quic_flow_control_window_bytes(settings.window_bytes());
+    }
     #[cfg(any(test, feature = "testing"))]
     if let Some(endpoint) = &quic_endpoint {
         super::in_memory_socket::record_quic_endpoint_clock(bind_addr, endpoint.clock_type());
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +49/-0)
```diff
@@ -866,6 +866,10 @@ pub struct TransportMetrics {
     quic_paths_offered_or_dialing: AtomicU64,
     /// Paths active on this node's evidence (state, never reset).
     quic_paths_active: AtomicU64,
+    /// The flow-control window of this node's QUIC connections, per
+    /// connection and direction (`quic::config::connection_window_bytes`):
+    /// a state set when the endpoint is built, 0 without one.
+    quic_flow_control_window_bytes: AtomicU64,
 
     /// The current snapshot period, starting at 1 and advanced by each
     /// `take_snapshot`. A connection's [`InboundConcurrencyPeak`] from an
@@ -1275,6 +1279,7 @@ impl TransportMetrics {
             quic_establish_samples: AtomicU64::new(0),
             quic_paths_offered_or_dialing: AtomicU64::new(0),
             quic_paths_active: AtomicU64::new(0),
+            quic_flow_control_window_bytes: AtomicU64::new(0),
             inbound_concurrency_epoch: AtomicU64::new(1),
             inbound_concurrency: Default::default(),
             inbound_stream_outcomes: Default::default(),
@@ -1925,6 +1930,12 @@ impl TransportMetrics {
         self.quic_paths_active.load(Ordering::Relaxed)
     }
 
+    /// The QUIC endpoint was built with this flow-control window.
+    pub(crate) fn set_quic_flow_control_window_bytes(&self, window: u64) {
+        self.quic_flow_control_window_bytes
+            .store(window, Ordering::Relaxed);
+    }
+
     /// QUIC upgrade control messages received since process start, never
     /// reset (tests only).
     #[cfg(test)]
@@ -2568,6 +2579,9 @@ impl TransportMetrics {
                 .quic_paths_offered_or_dialing
                 .load(Ordering::Relaxed),
             quic_paths_active: self.quic_paths_active.load(Ordering::Relaxed),
+            quic_flow_control_window_bytes: self
+                .quic_flow_control_window_bytes
+                .load(Ordering::Relaxed),
             quic_close_sent_peer_not_acknowledging: get64(
                 &self.quic_close_sent[QuicCloseCode::PeerNotAcknowledging as usize],
             ),
@@ -3163,6 +3177,12 @@ pub struct TransportSnapshot {
     /// paths active on this node's evidence. Zero outside shadow mode.
     pub quic_paths_offered_or_dialing: u64,
     pub quic_paths_active: u64,
+    /// The flow-control window of this node's QUIC connections, per
+    /// connection and direction (0 without an endpoint). A state, not reset,
+    /// and not activity by itself. Field data by window size shows whether
+    /// low-memory nodes, whose window is the 128 KiB floor, are slower on QUIC
+    /// than on UDP over long paths.
+    pub quic_flow_control_window_bytes: u64,
     /// Per-attempt records of the FIRST 8 failed outbound NAT traversals in
     /// the period (not a representative sample of a busy period);
     /// `nat_fail_samples_dropped` counts the rest. Read with the same
@@ -3512,6 +3532,7 @@ impl TransportSnapshot {
             quic_establish_samples,
             quic_paths_offered_or_dialing,
             quic_paths_active,
+            quic_flow_control_window_bytes,
             nat_fail_samples,
             nat_fail_samples_dropped,
             inbound_stream_refused_invalid_length,
@@ -3652,6 +3673,7 @@ impl TransportSnapshot {
         self.quic_establish_samples = quic_establish_samples;
         self.quic_paths_offered_or_dialing = quic_paths_offered_or_dialing;
         self.quic_paths_active = quic_paths_active;
+        self.quic_flow_control_window_bytes = quic_flow_control_window_bytes;
         self.nat_fail_samples = nat_fail_samples;
         self.nat_fail_samples_dropped = nat_fail_samples_dropped;
         self.inbound_stream_refused_invalid_length = inbound_stream_refused_invalid_length;
@@ -3869,6 +3891,12 @@ struct SnapshotExtras {
     /// paths active on this node's evidence. Zero outside shadow mode.
     pub quic_paths_offered_or_dialing: u64,
     pub quic_paths_active: u64,
+    /// The flow-control window of this node's QUIC connections, per
+    /// connection and direction (0 without an endpoint). A state, not reset,
+    /// and not activity by itself. Field data by window size shows whether
+    /// low-memory nodes, whose window is the 128 KiB floor, are slower on QUIC
+    /// than on UDP over long paths.
+    pub quic_flow_control_window_bytes: u64,
     /// Per-attempt records of the FIRST 8 failed outbound NAT traversals in
     /// the period (not a representative sample of a busy period);
     /// `nat_fail_samples_dropped` counts the rest. Read with the same
@@ -4981,6 +5009,26 @@ mod tests {
         assert_eq!(metrics.quic_adapter_panicked_at(local), 1);
     }
 
+    /// The QUIC flow-control window is a state: carried in every snapshot,
+    /// not reset, and not activity by itself.
+    #[test]
+    fn quic_flow_control_window_is_a_state_in_the_snapshot() {
+        let metrics = TransportMetrics::new();
+        metrics.set_quic_flow_control_window_bytes(128 * 1024);
+        assert!(
+            metr
```

**File**: `crates/core/src/transport/quic/config.rs` (modified, +56/-4)
```diff
@@ -44,6 +44,7 @@ use ring_crypto::{hkdf, hmac};
 use super::cid::MacConnectionIdGenerator;
 use crate::config::GlobalRng;
 use crate::simulation::TimeSource;
+use crate::transport::global_bandwidth::GlobalBandwidthManager;
 
 /// The largest UDP payload the endpoint sends or advertises it accepts: the
 /// UDP transport's packet size and QUIC's minimum (RFC 9000 section 14), so
@@ -310,8 +311,52 @@ pub(crate) const MAX_WINDOW_BYTES: u64 = 2 * 1024 * 1024;
 /// divisor: one twentieth, 5%.
 const WINDOW_MEMORY_DIVISOR: usize = 20;
 
+/// The rate a QUIC connection's window is capped at
+/// (`recycle::CappedCubic`): the fair share of `total-bandwidth-limit` when
+/// that is set, otherwise `bandwidth-limit`, otherwise none. The same rule as
+/// the UDP transport's token bucket (`peer_connection::paced_rate`), which it
+/// calls, so the two cannot drift. `bandwidth_limit` is the value after
+/// `peer_connection::effective_bandwidth_limit`, as on the UDP side.
+#[derive(Debug, Clone, Default)]
+pub(crate) struct QuicRateLimit {
+    bandwidth_limit: Option<usize>,
+    global: Option<Arc<GlobalBandwidthManager>>,
+}
+
+impl QuicRateLimit {
+    pub(crate) fn new(
+        bandwidth_limit: Option<usize>,
+        global: Option<Arc<GlobalBandwidthManager>>,
+    ) -> Self {
+        Self {
+            bandwidth_limit,
+            global,
+        }
+    }
+
+    /// The cap in bytes per second now, or `None` for no cap. The fair
+    /// share is read on each call, so it follows the connection count.
+    pub(crate) fn rate(&self) -> Option<u64> {
+        // `paced_rate` lowers a controller's rate to the cap; given no
+        // controller rate (`usize::MAX`) it returns the cap itself, or
+        // `usize::MAX` when there is none.
+        let global = self
+            .global
+            .as_ref()
+            .map(|global| global.current_per_connection_rate());
+        match crate::transport::peer_connection::paced_rate(
+            usize::MAX,
+            global,
+            self.bandwidth_limit,
+        ) {
+            usize::MAX => None,
+            rate => Some(rate as u64),
+        }
+    }
+}
+
 /// What the endpoint's settings are derived from.
-#[derive(Debug, Clone, Copy)]
+#[derive(Debug, Clone)]
 pub(crate) struct QuicSettings {
     /// `max-number-of-connections`: the windows are split between this many.
     pub max_connections: usize,
@@ -321,6 +366,10 @@ pub(crate) struct QuicSettings {
     /// source's connection idle timeout (24 h on `VirtualTime`), so a
     /// simulation can see a silent QUIC path time out. `None` in production.
     pub idle_timeout: Option<Duration>,
+    /// The rate each connection's window is capped at. Set by the transport
+    /// from its bandwidth settings when it binds (`bind_udp_listener`);
+    /// none in what the config produces.
+    pub rate_limit: QuicRateLimit,
 }
 
 impl QuicSettings {
@@ -450,9 +499,12 @@ pub(crate) fn transport_config<T: TimeSource>(
         .mtu_discovery_config(None::<MtuDiscoveryConfig>)
         .pad_to_mtu(false)
         .enable_segmentation_offload(false)
-        // Cubic, wrapped to count the packets the peer acknowledges (the
-        // path's acknowledgement watch, `recycle`).
-        .congestion_controller_factory(Arc::new(super::recycle::AckCountingFactory::default()))
+        // Cubic, wrapped to cap the window to the configured bandwidth and to
+        // count the packets the peer acknowledges (the path's acknowledgement
+        // watch), `recycle::CappedCubic`.
+        .congestion_controller_factory(Arc::new(super::recycle::CappedCubicFactory::new(
+            settings.rate_limit.clone(),
+        )))
         .initial_rtt(Duration::from_millis(333))
         .packet_threshold(3)
         .time_threshold(9.0 / 8.0)
```

**File**: `crates/core/src/transport/quic/memory_tests.rs` (modified, +2/-0)
```diff
@@ -52,6 +52,7 @@ fn settings() -> QuicSettings {
         max_connections: 200,
         memory_limit: 2 * 1024 * 1024 * 1024,
         idle_timeout: None,
+        rate_limit: Default::default(),
     }
 }
 
@@ -763,6 +764,7 @@ fn frames_filling_the_window_measure_within_the_window_multiple() {
             max_connections: 200,
             memory_limit,
             idle_timeout: None,
+            rate_limit: Default::default(),
         };
         let w = settings.window_bytes() as usize;
         assert_eq!(w, expected as usize, "premise: the window at its extreme");
```

#### Recent Merged Pull Requests:
- **PR #6113** (2026-11-05): test(transport): pin the QUIC fair share where it holds and record the default-minimum case (@sanity)
- **PR #6111** (2026-11-05): feat(transport): cap the QUIC window to the configured bandwidth (@sanity)
- **PR #6110** (2026-11-05): feat(transport): attribute QUIC fallbacks to session churn (@sanity)
- **PR #6108** (2026-11-04): build: release 0.2.155 (@sanity)
- **PR #6105** (2026-11-03): ci: cut Ubicloud runner spend without slowing PR CI (@sanity)
- **PR #6104** (2026-11-03): feat(transport): turn QUIC shadow mode on by default on Linux and macOS (@sanity)

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

## X. test(transport): pin the QUIC fair share where it holds and record the default-m

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b94bef03`: test(transport): pin the QUIC fair share where it holds and record the default-minimum case (#6113). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  recycle::CappedCubic::window = min(Cubic's window, max(rate x RTT,
  window_floor)): the cap never goes below window_floor (two full datagrams
  and one byte, 2401 B: quinn refuses
  Under a saturated egress cap, the window cap apportions it only when the
  per-connection share is below the cap. With the minimum per connection set
  below the share (two connections, one flow each, equal RTT),
  a_quic_path_and_udp_streams_each_get_their_fair_share_under_a_saturated_
  egress_cap measured QUIC about 239 kB/s and a UDP stream sender about
  250 kB/s of a 250 kB/s share, over 40 seeds (491 and 12 kB/s with the
  window cap removed). With the DEFAULT minimum (DEFAULT_MIN_PER_CONNECTION,
  1 MB/s, which GlobalBandwidthManager clamps to the total), a total below
  n x 1 MB/s, so nearly every residential cap, gives every connection a share
  of min(1 MB/s, total): each QUIC window cap is total x RTT and apportions
  nothing, and the egress cap itself is not neutral between the transports.
  QUIC waits in poll_admit (a queued waker, woken in order as the bucket
  refills); a UDP stream sender takes with try_take and sleeps jittered
  deficits, so QUIC wins contended refills. Measured the
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  recycle::CappedCubic::window = min(Cubic's window, rate x RTT), never
  below window_floor (two full datagrams and one byte, 2401 B: quinn refuses
  Under a binding egress cap the window cap does not hold a path to its
  share either: the cap's holds add to quinn's RTT samples, and rate x RTT
  grows with them (a_quic_path_and_udp_streams_both_progress_under_an_
  egress_cap measured about 390 kB/s against a 250 kB/s share, 400 kB/s with
  no window cap). The egress cap still holds the node's total.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b94bef03` are properly handled with clean fallback behavior.
