> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `1b511d59`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T02:28:56.545Z  
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
> **Harvest Timestamp**: 2026-11-25T02:28:56.540Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3133 stars

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
- **Issue #6384** (2026-11-25): **chore: remove fixed advisories from the RustSec baseline**
  *Symptoms*: ## Problem #6381 added `scripts/rustsec-baseline.tsv` with 5 known QUIC/TLS stack advisories (RUSTSEC-2026-0346..0349 on rustls 0.23.45, RUSTSEC-2026-0538 on quinn-udp 0.5.14), tracked by #6382. #6382 has merged and bumped both crates, so the entries are stale and the scheduled job warns about them.  ## Approach Remove exactly those 5 rows; the header comment is kept. An empty baseline is valid: `rustsec-watch.sh` reads it with `grep -vE ... || true`.  ## Testing Ran locally from this branch: - `scripts/rustsec-watch.sh scheduled`: `QUIC/TLS stack: 0 finding(s), 0 baseline entr(ies)`, exit 0, no stale-entry warning. - `scripts/rustsec-watch.sh pr origin/main`: no new findings relative to origin/main, exit 0.  [AI-assisted - Claude] 
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No issues found  **Rules checked:** git-workflow.md **Files reviewed:** 1  The PR only deletes the five baseline entries in `scripts/rustsec-baseline.tsv`, and its one commit uses the `chore:` prefix. `Cargo.lock` now pins `quinn-udp` 0.5.16 and `rustls` 0.23.46, so the removed entries (0.5.14 and 0.23.45) no longer match anything. No rule violations detected.  <!-- warning-count: 0 -->  --- *Rule review against `.claude/rules/`. WARNING findings turn the `rule-review/warnings` status red.*

- **Issue #6383** (2026-11-25): **test: property-test pre-authentication parsing of QUIC peer keys**
  *Symptoms*: ## Problem The QUIC peer-identity code parses and checks bytes from a peer before the peer is authenticated (`peer_key_presented`, `PeerKey::of`, the pinned and proven certificate verifiers, the handshake signature check). It had one proptest for the SPKI parser and fixed-input unit tests, but nothing that fed arbitrary input to the verifiers or ran property tests at a depth beyond 256 cases.  ## Approach Property tests in the normal suite (deterministic cost, no new toolchain), plus a weekly workflow that raises the case count. I did not add a cargo-fuzz target: the entry points are `pub(crate)`, so a fuzz crate would need them re-exported, and cargo-fuzz needs nightly, which CI does not use. Proptest reaches the same entry points through the existing test module.  New properties (`transport/quic/identity/tests.rs`): - `PeerKey::of` and the Edwards conversion take any 32 bytes without panicking; what is accepted is canonical, agrees with an independent conversion, and round-trips through its presented form. - `PinnedServerKey`, `PinnedClientKey` and `ProvenClientKey` certificate checks, over arbitrary, mutated, truncated and extended keys and arbitrary chains: accept exactly the expected key (pinned) or exactly what `peer_key_presented` accepts (proven), never with a chain; `RefuseEveryClient` always refuses. - Signature checks with arbitrary bytes, message, scheme and presented key are refused. - Our own signatures over arbitrary messages verify; a flipped bit, changed or e

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

### Incident Patch 1: `b5fa9c61` (2026-11-25)
**Commit Message**: chore: remove fixed advisories from the RustSec baseline (#6384)

**File**: `scripts/rustsec-baseline.tsv` (modified, +0/-5)
```diff
@@ -5,8 +5,3 @@
 # expiry that is still present, and warns about an entry that no longer
 # matches (delete it). An entry needs a tracking link and an expiry; renew an
 # expiry only with a stated reason in the PR.
-RUSTSEC-2026-0538	quinn-udp	0.5.14	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
-RUSTSEC-2026-0347	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
-RUSTSEC-2026-0348	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
-RUSTSEC-2026-0346	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
-RUSTSEC-2026-0349	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
```

---

### Incident Patch 2: `b0b79b07` (2026-11-25)
**Commit Message**: test: property-test pre-authentication parsing of QUIC peer keys (#6383)

**File**: `.github/workflows/spki-proptest.yml` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+name: QUIC Identity Property Tests (Weekly)
+
+# The property tests on the QUIC peer-identity parsing and verification
+# (`transport/quic/identity/tests.rs`) run in PR CI at 256 cases each, which
+# finds a bug that shows up in the first few hundred inputs. This job runs the
+# same tests with 100,000 cases each, to find the ones that do not.
+#
+# Each run seeds proptest from its run id (printed in the log, or given as the
+# `seed` input), so a failure can be reproduced locally with the same
+# PROPTEST_CASES and PROPTEST_RNG_SEED.
+#
+# Weekly, not per PR: it adds about 15 minutes on a ubicloud-standard-8
+# (a few dollars a month) and nothing about it depends on the PR's diff.
+# Run it by hand (workflow_dispatch) to check a specific change.
+on:
+  schedule:
+    - cron: "0 4 * * 1"
+  workflow_dispatch:
+    inputs:
+      cases:
+        description: "Cases per property test"
+        required: false
+        default: "100000"
+      seed:
+        description: "PROPTEST_RNG_SEED (decimal u64). Leave empty to use the run id."
+        required: false
+        default: ""
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: false
+
+permissions:
+  contents: read
+
+jobs:
+  spki-proptest:
+    name: QUIC identity property tests
+    runs-on: ubicloud-standard-8
+    timeout-minutes: 45
+    env:
+      CARGO_TARGET_DIR: ${{ github.workspace }}/target
+      # Use mold linker to avoid rust-lld crashes
+      CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: clang
+      CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS: -C link-arg=-fuse-ld=mold
+      PROPTEST_CASES: ${{ github.event.inputs.cases || '100000' }}
+      PROPTEST_RNG_SEED: ${{ github.event.inputs.seed || github.run_id }}
+
+    steps:
+      - uses: actions/checkout@v7
+
+      - uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: 1.95.0
+
+      - uses: Swatinem/rust-cache@v2
+        with:
+          prefix-key: spki-proptest
+          save-if: ${{ github.ref == 'refs/heads/main' }}
+
+      - name: Install mold linker
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y mold
+
+      # The failing case itself is not printed, but the seed is, and with the
+      # same PROPTEST_CASES it lets anyone reproduce that case locally. That
+      # is on purpose: without it a failure seen once in 100,000 cases could
+      # not be reproduced. The output is kept short (failing test names, seed
+      # and summary line); it is minimal, not secret. The job also fails when
+      # the filter ran fewer tests than expected or one of the property tests
+      # did not run, so a renamed or moved module cannot leave it green while
+      # testing nothing.
+      - name: Run the identity property tests
+        timeout-minutes: 35
+        run: |
+          if ! printf '%s' "$PROPTEST_CASES" | grep -Eq '^[1-9][0-9]{0,8}$'; then
+            echo "::error::PROPTEST_CASES is not a positive integer"
+            exit 1
+          fi
+          if ! printf '%s' "$PROPTEST_RNG_SEED" | grep -Eq '^[0-9]{1,19}$'; then
+            echo "::error::PROPTEST_RNG_SEED is not a decimal integer"
+            exit 1
+          fi
+          echo "PROPTEST_CASES=$PROPTEST_CASES PROPTEST_RNG_SEED=$PROPTEST_RNG_SEED"
+          log="$RUNNER_TEMP/proptest.log"
+          status=0
+          cargo test -p freenet --lib -- transport::quic::identity > "$log" 2>&1 || status=$?
+          grep -E '^(test .* (ok|FAILED)|test result:)' "$log" || true
+          if [ "$status" -ne 0 ]; then
+            echo "::error::identity property tests failed (exit $status); case not printed. Rerun locally with PROPTEST_CASES=$PROPTEST_CASES PROPTEST_RNG_SEED=$PROPTEST_RNG_SEED"
+            exit "$status"
+          fi
+          passed=$(grep -cE '^test .* \.\.\. ok$' "$log" || true)
+          if [ "$passed" -lt 23 ]; then
+            echo "::error::expected at least 23 identity tests to pass, saw $passed"
+            exit 1
+          fi
+          for name in peer_key_of_matches_the_independent_oracle \
+            peer_key_presented_matches_the_independent_oracle \
+            certificate_verifiers_take_any_presented_key \
+            signature_verifiers_refuse_arbitrary_signatures \
+            our_signatures_round_trip_and_nothing_else_verifies; do
+            if ! grep -qE "^test .*::$name \.\.\. ok$" "$log"; then
+              echo "::error::property test $name did not run"
+              exit 1
+            fi
+          done
+
+  # Tell the private freenet-dev room when the scheduled run fails (the public
+  # official room is not used: a failure here may be an unfixed defect).
+  notify-dev-room-failure:
+    name: Notify dev room on Failure
+    runs-on: ubuntu-latest
+    needs: [spki-proptest]
+    if: failure() && needs.spki-proptest.result == 'failure'
+    continue-on-error: true
+    steps:
+      - uses: actions/checkout@v7
+      - uses: ./.github/actions/
```

**File**: `crates/core/src/transport/quic/identity/tests.rs` (modified, +412/-0)
```diff
@@ -730,6 +730,418 @@ proptest::proptest! {
     }
 }
 
+/// One node's key material, made once: key generation draws from `GlobalRng`,
+/// which the property cases below must not reseed.
+struct Fixture {
+    peer: PeerKey,
+}
+
+fn fixture() -> &'static Fixture {
+    static FIXTURE: std::sync::OnceLock<Fixture> = std::sync::OnceLock::new();
+    FIXTURE.get_or_init(|| {
+        let keys = GlobalRng::scoped_seed(SEED, TransportKeypair::new);
+        let peer = PeerKey::of(keys.public()).unwrap();
+        Fixture { peer }
+    })
+}
+
+/// Case counts for the properties below. The default keeps PR CI cheap; the
+/// scheduled `spki-proptest` workflow raises it through `PROPTEST_CASES`
+/// (and fails the job when the value does not parse, rather than falling
+/// back to this default).
+fn cases() -> proptest::test_runner::Config {
+    proptest::test_runner::Config::with_cases(
+        std::env::var("PROPTEST_CASES")
+            .ok()
+            .and_then(|value| value.parse().ok())
+            .unwrap_or(256),
+    )
+}
+
+/// p = 2^255 - 19 and the Ed25519 group order L = 2^252 +
+/// 27742317777372353535851937790883648493, little-endian, written out here
+/// rather than taken from the code under test.
+const P_LE: [u8; 32] = {
+    let mut p = [0xffu8; 32];
+    p[0] = 0xed;
+    p[31] = 0x7f;
+    p
+};
+/// DER prefix of an Ed25519 SubjectPublicKeyInfo (RFC 8410), written out
+/// here so the oracle does not share it with the code under test.
+const SPKI_PREFIX_LITERAL: [u8; 12] = [
+    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
+];
+const L_LE: [u8; 32] = [
+    0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14,
+    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10,
+];
+
+/// `a < b` for little-endian 256-bit numbers.
+fn below(a: &[u8; 32], b: &[u8; 32]) -> bool {
+    let halves = |x: &[u8; 32]| {
+        (
+            u128::from_le_bytes(x[16..].try_into().unwrap()),
+            u128::from_le_bytes(x[..16].try_into().unwrap()),
+        )
+    };
+    halves(a) < halves(b)
+}
+
+/// Whether a node can hold the transport key `u`, decided with
+/// curve25519-dalek 5 alone: canonical (u < p), an Edwards form exists, and
+/// the point has neither small order nor a torsion component.
+fn oracle_accepts_transport_key(u: [u8; 32]) -> bool {
+    below(&u, &P_LE)
+        && curve25519_dalek::montgomery::MontgomeryPoint(u)
+            .to_edwards(0)
+            .is_some_and(|point| !point.is_small_order() && point.is_torsion_free())
+}
+
+/// Whether `bytes` is the presented form of a key a node can hold, decided
+/// with curve25519-dalek 5 alone: the Ed25519 SPKI prefix and 32 bytes that
+/// are the canonical sign-bit-0 encoding of a point with neither small
+/// order nor a torsion component.
+fn oracle_accepts_presented(bytes: &[u8]) -> bool {
+    let Some(rest) = bytes.strip_prefix(&SPKI_PREFIX_LITERAL[..]) else {
+        return false;
+    };
+    let Ok(y) = <[u8; 32]>::try_from(rest) else {
+        return false;
+    };
+    y[31] >> 7 == 0
+        && curve25519_dalek::edwards::CompressedEdwardsY(y)
+            .decompress()
+            .is_some_and(|point| {
+                point.compress().to_bytes() == y
+                    && !point.is_small_order()
+                    && point.is_torsion_free()
+            })
+}
+
+/// The expected key's point plus each of the eight torsion points, and the
+/// torsion points alone, as Edwards points.
+fn torsion_mixed() -> Vec<curve25519_dalek::edwards::EdwardsPoint> {
+    use curve25519_dalek::constants::EIGHT_TORSION;
+    let honest = curve25519_dalek::edwards::CompressedEdwardsY(*fixture().peer.ed25519())
+        .decompress()
+        .unwrap();
+    EIGHT_TORSION
+        .iter()
+        .flat_map(|t| [honest + t, *t])
+        .collect()
+}
+
+fn spki_with(key: &[u8; 32]) -> Vec<u8> {
+    [&SPKI_PREFIX_LITERAL[..], &key[..]].concat()
+}
+
+/// A transport key as an attacker may send it: arbitrary, or chosen at the
+/// edges of the checks (u in [p, 2^255), just below p, bit 255 set, the
+/// honest key plus a torsion point, a torsion point).
+fn arb_transport_key() -> impl proptest::strategy::Strategy<Value = [u8; 32]> {
+    use proptest::prelude::*;
+    let mixed: Vec<[u8; 32]> = torsion_mixed()
+        .iter()
+        .map(|point| point.to_montgomery().to_bytes())
+        .collect();
+    let honest = *fixture().peer.transport_key().as_bytes();
+    prop_oneof![
+        4 => any::<[u8; 32]>(),
+        2 => (0u8..19).prop_map(|k| add_le(&P_LE, &{
+            let mut add = [0u8; 32];
+            add[0] = k;
+            add
+        }).unwrap()),
+        1 => (1u8..4).prop_map(|k| {
+            let mut u = P_LE;
+            u[0] -= k;
+            u
+        }),
+        1 => any::<[u8; 32]>().prop_map(|mut u| {
+            u[31] |= 0x80;
+            u
+        }),
+        2 => proptest::sample::select(mixed),
+        1 => Jus
```

---

### Incident Patch 3: `45a426c4` (2026-11-24)
**Commit Message**: ci: add a RustSec watch for the QUIC/TLS stack including the quinn fork (#6381)

**File**: `.github/workflows/audit.yml.disabled` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-name: Security audit
-on:
- workflow_dispatch: false
- push:
-   paths:
-     - "**/Cargo.toml"
-     - "**/Cargo.lock"
- schedule:
-  - cron: "0 0 * * *"
-
-jobs:
-  audit:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4
-      - uses: rustsec/audit-check@v2.0.0
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/rustsec-watch.yml` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+name: RustSec watch
+
+# Advisory watch for the QUIC/TLS stack (scripts/rustsec-watch.sh). Replaces the
+# old audit.yml, which was disabled in 2024 (its triggers were commented out
+# after it went red on advisories nobody was assigned to fix) and used
+# rustsec/audit-check, which cannot see advisories filed against the upstream
+# quinn crates behind the freenet-quinn fork.
+#
+#   schedule / push to main / manual: fail on a vulnerability or unsound
+#       advisory against a QUIC/TLS stack crate (in Cargo.lock or in the
+#       fork's upstream crates, scripts/rustsec-fork-upstream.map) that is not
+#       in scripts/rustsec-baseline.tsv, or whose baseline entry has expired.
+#       Advisories on other crates are listed in the log but do not fail the
+#       run. The run is therefore green while known advisories are being fixed
+#       and red on anything new.
+#   pull_request touching Cargo.lock: fail only on findings the PR introduces
+#       relative to the base branch, so an unrelated PR is never blocked by an
+#       existing advisory.
+#
+# Runbook for a failure: docs/quinn-rustls-bump.md.
+
+on:
+  schedule:
+    - cron: "17 5 * * *"
+  push:
+    branches: [main]
+    paths:
+      - Cargo.lock
+      - scripts/rustsec-watch.sh
+      - scripts/rustsec-watch-fixture.lock
+      - scripts/rustsec-baseline.tsv
+      - scripts/rustsec-fork-upstream.map
+      - .github/workflows/rustsec-watch.yml
+  pull_request:
+    paths:
+      - Cargo.lock
+      - scripts/rustsec-watch.sh
+      - scripts/rustsec-watch-fixture.lock
+      - scripts/rustsec-baseline.tsv
+      - scripts/rustsec-fork-upstream.map
+      - .github/workflows/rustsec-watch.yml
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+# A cancelled run is neither a failure nor notified, so only superseded PR runs
+# are cancelled; scheduled and main runs always finish.
+concurrency:
+  group: rustsec-watch-${{ github.event_name }}-${{ github.ref }}
+  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
+
+jobs:
+  audit:
+    name: Audit QUIC/TLS stack
+    runs-on: ubuntu-latest
+    timeout-minutes: 15
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          fetch-depth: 0
+
+      - uses: taiki-e/install-action@v2
+        with:
+          # Pinned: the script parses cargo-audit's JSON, and its self-test
+          # fails the run if the shape changes.
+          tool: cargo-audit@0.23.0
+
+      - name: Audit (pull request, new advisories only)
+        if: github.event_name == 'pull_request'
+        run: scripts/rustsec-watch.sh pr "origin/${{ github.base_ref }}"
+
+      - name: Audit (QUIC/TLS stack)
+        if: github.event_name != 'pull_request'
+        run: scripts/rustsec-watch.sh scheduled
+
+  # Same channel as the other scheduled failures (simulation-nightly.yml): the
+  # private freenet-dev room. Not the public room: an unfixed advisory should
+  # not be announced publicly.
+  notify-dev-room-failure:
+    name: Notify dev room on failure
+    runs-on: ubuntu-latest
+    needs: [audit]
+    if: failure() && github.event_name != 'pull_request'
+    steps:
+      - uses: actions/checkout@v7
+      # river-dev-notify no-ops with a warning when secrets are missing; here
+      # a notification that cannot be delivered must turn this job red.
+      - name: Require notification secrets
+        env:
+          BOT: ${{ secrets.RIVER_DEV_BOT_CONFIG }}
+          ROOM: ${{ secrets.RIVER_DEV_ROOM_ID }}
+          GW: ${{ secrets.RIVER_GATEWAY_URL }}
+        run: |
+          if [ -z "$BOT" ] || [ -z "$ROOM" ] || [ -z "$GW" ]; then
+            echo "::error::dev-room notification secrets are not configured; the RustSec watch failure above was NOT announced"
+            exit 1
+          fi
+      - uses: ./.github/actions/river-dev-notify
+        with:
+          message: "RustSec watch failed (QUIC/TLS stack advisory) - ${{ github.repository }} - ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
+          bot-config: ${{ secrets.RIVER_DEV_BOT_CONFIG }}
+          room-id: ${{ secrets.RIVER_DEV_ROOM_ID }}
+          gateway-url: ${{ secrets.RIVER_GATEWAY_URL }}
```

**File**: `docs/quinn-rustls-bump.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# Rehearsed bump of quinn / rustls (and the quinn fork sync)
+
+Use this when the RustSec watch (`.github/workflows/rustsec-watch.yml`) fails,
+or when a release fixes a transport/TLS advisory. Goal: a reviewed bump PR in
+hours, not days.
+
+0. **Known advisory being fixed?** Add it to `scripts/rustsec-baseline.tsv`
+   (id, crate, version, tracking link, expiry about 14 days out) so the daily
+   run is not red while the fix is in review; delete the entry in the fix PR.
+1. **Read the failing advisory.** The job log lists id, crate, version and
+   patched range. Entries labelled `fork-upstream` are advisories against the
+   upstream crates behind `freenet-quinn*`; they come from
+   `scripts/rustsec-fork-upstream.map`, which holds a lower bound (see its
+   header), so first check whether the fork head already contains the fix.
+2. **rustls, quinn-udp, ring, webpki** (plain crates.io dependencies):
+   `cargo update -p <crate> --precise <patched>` and commit `Cargo.lock`
+   (or merge the Dependabot PR). The `quinn` pin in `crates/core/Cargo.toml` is
+   exact, so these never move by themselves.
+3. **quinn / quinn-proto (the fork):**
+   1. Sync `freenet/quinn` with upstream's `0.11.x` branch (merge, keep only the
+      package renames and README). If upstream has released the fix the fork
+      exists for (quinn-rs/quinn#2987), retire the fork instead and depend on
+      upstream (see the comment above the `quinn` entry in
+      `crates/core/Cargo.toml`).
+   2. Run the fork's tests, publish `freenet-quinn` and `freenet-quinn-proto`
+      with a new version, and bump the exact pins in `crates/core/Cargo.toml`.
+   3. Re-check the quinn-internals items in `.claude/rules/transport.md`
+      (PANICS) against the new code, as the `Cargo.toml` comment requires.
+   4. Update `scripts/rustsec-fork-upstream.map` to the newest released
+      upstream versions that are ancestors of the new fork commit
+      (`gh api repos/freenet/quinn/compare/quinn-proto-<ver>...<sha>`).
+4. **Verify locally before pushing** (PR CI is not the test runner):
+   `scripts/rustsec-watch.sh scheduled`, then `cargo clippy` with CI's flags and
+   `cargo nextest run -p freenet quic` (plus the transport tests the change
+   touches).
+5. **Review and release.** Transport/TLS changes are Full-tier review. Whether to
+   cut a release is a separate decision (see `docs/RELEASING.md`).
```

**File**: `scripts/rustsec-baseline.tsv` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Known QUIC/TLS stack advisories that the scheduled RustSec watch tolerates
+# until they are fixed. Tab-separated:
+#   advisory id, crate, version, tracking link, expiry (YYYY-MM-DD)
+# The watch fails on a stack advisory NOT listed here, on an entry past its
+# expiry that is still present, and warns about an entry that no longer
+# matches (delete it). An entry needs a tracking link and an expiry; renew an
+# expiry only with a stated reason in the PR.
+RUSTSEC-2026-0538	quinn-udp	0.5.14	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
+RUSTSEC-2026-0347	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
+RUSTSEC-2026-0348	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
+RUSTSEC-2026-0346	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
+RUSTSEC-2026-0349	rustls	0.23.45	https://github.com/freenet/freenet-core/pull/6382	2026-12-08
```

**File**: `scripts/rustsec-fork-upstream.map` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Upstream crates that the vendored quinn fork (freenet-quinn*, see
+# crates/core/Cargo.toml) is built from. `cargo audit` matches advisories by
+# crate name, so it never sees advisories filed against `quinn` / `quinn-proto`
+# for the renamed fork crates. scripts/rustsec-watch.sh audits these upstream
+# name/version pairs as well.
+#
+# Format: <fork crate> <upstream crate> <upstream version>
+#
+# The version is the newest RELEASED upstream version that is an ancestor of
+# the fork's commit (the fork is upstream's 0.11.x branch plus unreleased
+# commits). It is a lower bound on what the fork contains, so a report here may
+# be a false positive when the fork head already carries an unreleased fix: check
+# the fork head before dismissing it, and never raise the version without
+# checking ancestry. Update this file in the same PR as every fork bump
+# (docs/quinn-rustls-bump.md).
+#
+# freenet/quinn @ 9072e7f1 (freenet-quinn 0.11.13): quinn-proto-0.11.19 is an
+# ancestor (compare quinn-proto-0.11.19...9072e7f1: ahead 40, behind 0).
+freenet-quinn quinn 0.11.12
+freenet-quinn-proto quinn-proto 0.11.19
```

**File**: `scripts/rustsec-watch-fixture.lock` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Self-test fixture for scripts/rustsec-watch.sh: an old quinn-proto with a
+# long-published advisory (RUSTSEC-2023-0063). If cargo-audit reports nothing for
+# this file, the watch cannot see advisories and must fail instead of passing.
+version = 3
+
+[[package]]
+name = "quinn-proto"
+version = "0.10.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
```

**File**: `scripts/rustsec-watch.sh` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+#!/usr/bin/env bash
+# RustSec advisory watch for the QUIC/TLS stack.
+#
+# Usage: scripts/rustsec-watch.sh scheduled
+#        scripts/rustsec-watch.sh pr <base-ref>      (e.g. origin/main)
+#
+# Two lockfiles are audited (a finding is keyed on advisory id + crate + version):
+#   1. Cargo.lock as is.
+#   2. A synthetic lockfile naming the upstream crates behind each freenet-quinn*
+#      fork crate PRESENT in the lock (scripts/rustsec-fork-upstream.map),
+#      because the fork's renamed crates are invisible to RustSec. No fork in
+#      the lock means no synthetic lock and no map needed.
+#
+# scheduled: fail (exit 1) on a vulnerability or unsound advisory against a
+#            STACK crate that is not in scripts/rustsec-baseline.tsv, or whose
+#            baseline entry has expired. Other crates are listed, not gating.
+# pr:        fail (exit 1) only for findings (any crate) absent from <base-ref>.
+#
+# Every run first audits scripts/rustsec-watch-fixture.lock and fails unless the
+# known advisory is reported, so a cargo-audit output change or an empty
+# advisory database cannot turn the watch into a silent green.
+#
+# Env: RUSTSEC_FORK_MAP overrides the map file; RUSTSEC_TODAY overrides the
+# date (tests). Exit: 0 ok, 1 findings, 2 usage, 3 tooling/config failure.
+set -euo pipefail
+
+mode="${1:-}"
+base_ref="${2:-}"
+root="$(git rev-parse --show-toplevel)"
+map="${RUSTSEC_FORK_MAP:-$root/scripts/rustsec-fork-upstream.map}"
+baseline="$root/scripts/rustsec-baseline.tsv"
+today="${RUSTSEC_TODAY:-$(date -u +%F)}"
+work="$(mktemp -d)"
+trap 'rm -rf "$work"' EXIT
+
+die() { echo "::error::$*"; exit 3; }
+
+# Crates whose advisories matter to the transport/TLS path.
+stack_re='^(quinn|quinn-proto|quinn-udp|freenet-quinn|freenet-quinn-proto|rustls|rustls-webpki|webpki|webpki-roots|rustls-pki-types|rustls-native-certs|rustls-pemfile|rustls-platform-verifier|tokio-rustls|ring|aws-lc-rs|aws-lc-sys|rcgen|ed25519-dalek|curve25519-dalek|x509-parser|spki|der)$'
+
+# fork_lock <lockfile> <mapfile> <out>: writes a lockfile with the upstream
+# crate for each freenet-quinn* package in <lockfile>. Returns 1 if there are none.
+fork_lock() {
+  local lock="$1" mapf="$2" out="$3" f n=0
+  { echo 'version = 3'; echo
+    for f in $(grep -oE '^name = "freenet-quinn[a-z-]*"' "$lock" | cut -d'"' -f2 | sort -u); do
+      [ -f "$mapf" ] || die "$f is in the lockfile but $mapf does not exist; its upstream advisories are not being watched"
+      local row; row="$(awk -v f="$f" '$1==f {print $2, $3}' "$mapf")"
+      [ -n "$row" ] || die "$f is in the lockfile but not in $mapf; its upstream advisories are not being watched"
+      read -r up ver <<<"$row"
+      printf '[[package]]\nname = "%s"\nversion = "%s"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\n\n' "$up" "$ver"
+      n=$((n + 1))
+    done
+  } >"$out"
+  [ "$n" -gt 0 ]
+}
+
+# audit <lockfile> <out.json>: cargo-audit exits 1 for vulnerabilities; any
+# other failure (no DB, parse error) fails the job.
+audit() {
+  local rc=0
+  cargo audit --file "$1" --json >"$2" 2>"$2.err" || rc=$?
+  if [ "$rc" -gt 1 ] || ! jq -e '.vulnerabilities.list' "$2" >/dev/null 2>&1; then
+    cat "$2.err"; die "cargo audit failed to run on $1 (exit $rc)"
+  fi
+}
+
+# findings <json> <label>: TSV rows id, crate, version, kind, label, title.
+findings() {
+  jq -r --arg l "$2" '
+    (.vulnerabilities.list[]? | [.advisory.id, .package.name, .package.version, "vulnerability", $l, .advisory.title]),
+    (.warnings.unsound[]?     | [.advisory.id, .package.name, .package.version, "unsound", $l, .advisory.title])
+    | @tsv' "$1"
+}
+
+# collect <lockfile> <mapfile> <label-prefix> <out.tsv>: all findings for one
+# tree (its lock plus the upstream crates of its forks).
+collect() {
+  local lock="$1" mapf="$2" out="$4"
+  audit "$lock" "$work/c.json"
+  findings "$work/c.json" "Cargo.lock" >"$out"
+  if fork_lock "$lock" "$mapf" "$work/c-fork.lock"; then
+    audit "$work/c-fork.lock" "$work/c-fork.json"
+    findings "$work/c-fork.json" "fork-upstream" >>"$out"
+  fi
+}
+
+# One row per (id, crate, version): the same finding from both lockfiles is one.
+dedupe() { sort -t$'\t' -k1,3 -u "$1" >"$1.u" && mv "$1.u" "$1"; }
+
+case "$mode" in scheduled | pr) ;; *) echo "usage: $0 scheduled | pr <base-ref>"; exit 2 ;; esac
+[ "$mode" = pr ] && [ -z "$base_ref" ] && { echo "pr mode needs a base ref"; exit 2; }
+
+# Self-test: the watch must be able to see a known advisory.
+audit "$root/scripts/rustsec-watch-fixture.lock" "$work/fixture.json"
+findings "$work/fixture.json" fixture | cut -f1 | grep -qx RUSTSEC-2023-0063 \
+  || die "self-test failed: scripts/rustsec-watch-fixture.lock should report RUSTSEC-2023-0063 and did not (cargo-audit output changed, or the advisory database is empty)"
+
+collect "$root/Cargo.lock" "$map" x "$work/all.tsv"
+dedupe "$work/all.tsv"
+echo "findings (vulnerability or unsound): $(wc -l <"$work/all.tsv")"
+
+if
```

#### Recent Merged Pull Requests:
- **PR #6384** (2026-11-25): chore: remove fixed advisories from the RustSec baseline (@sanity)
- **PR #6383** (2026-11-25): test: property-test pre-authentication parsing of QUIC peer keys (@sanity)
- **PR #6382** (2026-11-24): build(deps): bump rustls and quinn-udp for RustSec advisories (@sanity)
- **PR #6381** (2026-11-24): ci: add a RustSec watch for the QUIC/TLS stack including the quinn fork (@sanity)
- **PR #6380** (2026-11-24): feat: check for an update after repeated gateway handshake failures (@sanity)
- **PR #6379** (2026-11-25): feat: punch allowance for destinations that already proved reachable (@sanity)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
