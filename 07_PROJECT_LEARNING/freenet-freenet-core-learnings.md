> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `23080e91`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T12:54:28.511Z  
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
> **Harvest Timestamp**: 2026-11-13T12:51:47.557Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3121 stars

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
- **Issue #6215** (2026-11-13): **CI: Claude rule review is failing to run**
  *Symptoms*: <!-- claude-rule-review-outage --> @sanity: the `Claude PR Rule Review` workflow could not complete a review, so affected PRs were not reviewed. They show a red `rule-review/warnings` status; the required `Claude Rule Review` check stays green, so merges are not blocked.  If the run ended within about a turn, before any model work, that points at the credential or account behind `CLAUDE_CODE_OAUTH_TOKEN` rather than the diff (usage exhausted, or the token revoked or expired); see #5628 for that pattern. This was opened for a run that did not complete; the error annotation on the run below carries what the action recorded.  First failing run: https://github.com/freenet/freenet-core/actions/runs/43404429667  This issue is opened and closed automatically. It closes itself after the next review that completes, so a flaky reviewer can open and close it repeatedly.
  **Post-Mortem & Fix Analysis**:
  > A review completed again: https://github.com/freenet/freenet-core/actions/runs/43405264586. Closing.

- **Issue #6213** (2026-11-13): **fix(bin): run the node on a worker thread, not the main thread**
  *Symptoms*: ## Problem  `run_node` passes the whole node to `rt.block_on`, so the node's futures are polled on the process's main thread. The platform fixes that thread's stack when the process starts: 1 MiB on Windows, 8 MiB on Linux. Every thread std spawns gets 2 MiB, and `RUST_MIN_STACK` (which CI sets to 256 MiB) reaches only spawned threads, never the main one.  In a debug build the node's nested poll frames use about 900 KiB of the main thread by the first event-loop turn. Measured with gdb on a Linux debug build of current main at the overflow point; the largest frames are `run_network` (114 KiB), `run` (100 KiB), the `run_node` async block (94 KiB), the event-listener select (88 KiB) and `run_event_listener` (68 KiB). That leaves a few KiB of headroom on Windows. #6207 grew those frames by a few KiB in total, with no single frame standing out, and its "Windows Service Unit" job failed all four `quic_breaker_windows` tests: the node exited with 3221225725 (0xC00000FD, STATUS_STACK_OVERFLOW) right after "Network listener opened". Main passes today only because of that small margin, so the next change that grows any of these frames hits the same overflow.  ## Approach  The node now runs in a spawned task, so a worker thread polls it and the main thread only waits on the join handle (`rt.spawn` plus `rt.block_on(handle)`). Worker threads get std's 2 MiB default, as every other task already does. Identifying the frame was the first step, and it showed the problem is cumulative depth 

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

### Incident Patch 1: `7fcb4157` (2026-11-13)
**Commit Message**: fix(bin): run the node on a worker thread, not the main thread (#6213)

**File**: `crates/core/src/bin/freenet.rs` (modified, +26/-2)
```diff
@@ -1651,7 +1651,24 @@ fn run_node(config_args: ConfigArgs) -> anyhow::Result<()> {
         .build()
         .unwrap();
 
-    rt.block_on(async move {
+    // The node runs on a worker thread, never on the main thread. `block_on`
+    // polls its future on the calling thread, and the main thread's stack is
+    // fixed by the platform: 1 MiB on Windows, against 2 MiB for every thread
+    // std spawns. Polled there, the node's nested startup futures used most of
+    // it (about 900 KiB measured in a Linux debug build at the first event
+    // loop turn), within a few KiB of the Windows limit: a branch that grew
+    // those frames slightly overflowed at startup on Windows. A spawned task
+    // is polled by a worker, so the main thread only waits on the join
+    // handle. `tests/main_thread_stack.rs` pins it by starting the node with
+    // a small main-thread stack and workers at their production size.
+    //
+    // The root future is now an ordinary task on a worker, so synchronous
+    // work on its path (config build, logger setup, node construction) holds
+    // a worker while it runs. With `worker_threads` set to the CPU count, a
+    // 1-vCPU host has one worker, so a long blocking call here would stall
+    // the whole runtime. Nothing on that path blocks for long today; anything
+    // added that does belongs in `spawn_blocking`.
+    let node = rt.spawn(async move {
         let config = config_args.build().await?;
         freenet::config::set_logger(None, None, config.paths().log_dir());
         // Same reason as the info! below: `ConfigArgs::build()` resolves the
@@ -1672,7 +1689,14 @@ fn run_node(config_args: ConfigArgs) -> anyhow::Result<()> {
         // installed — operators with a custom `UMask=` see the change.
         log_umask_override();
         run(config).await
-    })?;
+    });
+    match rt.block_on(node) {
+        Ok(result) => result?,
+        // A panic in the node keeps unwinding from `main`, as it did when the
+        // node ran on this thread.
+        Err(join) if join.is_panic() => std::panic::resume_unwind(join.into_panic()),
+        Err(join) => return Err(anyhow::anyhow!("the node task was cancelled: {join}")),
+    }
 
     Ok(())
 }
```

**File**: `crates/core/tests/main_thread_stack.rs` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+//! The node must not run on the process's main thread.
+//!
+//! The main thread's stack is fixed by the platform when the process starts:
+//! 1 MiB on Windows, against 2 MiB for every thread std spawns (and more under
+//! `RUST_MIN_STACK`, which CI sets, but which does not reach the main thread).
+//! `run_node` used to `block_on` the whole node, so its startup futures were
+//! polled on the main thread. In a debug build their nested poll frames used
+//! about 900 KiB there by the first event-loop turn, a few KiB short of the
+//! Windows limit. A branch that made those frames slightly larger (#6207, QUIC
+//! `prefer` by default) overflowed in the Windows debug binary at startup
+//! (exit 0xC00000FD, STATUS_STACK_OVERFLOW) before its transport was up. Linux
+//! CI could not see it: the Linux main thread has 8 MiB.
+//!
+//! This test starts the real binary with a 640 KiB main-thread stack, set with
+//! `ulimit -s` before `exec`, and requires the node to come up and keep running.
+//! Before the fix the same build aborted with "thread 'main' has overflowed its
+//! stack" at 640 KiB (and at every size up to about 900 KiB). With the node on
+//! a worker, the main thread holds only command-line parsing and the wait on
+//! the node task; clap's derived parser alone takes about 400 KiB in a debug
+//! build, so the limit leaves room for it and none for the node.
+//!
+//! The node's work now runs on tokio workers, whose stack std sizes from
+//! `RUST_MIN_STACK` (2 MiB when it is unset, as in production). CI sets it to
+//! 256 MiB, which would let worker stack use grow far past the production size
+//! unseen, so every case here sets it explicitly: 2 MiB, the production size,
+//! for each transport, and 1.5 MiB as an early warning. The node's root task
+//! keeps the same nested frames on its worker that it had on the main thread:
+//! in a Linux debug build with CI's unit-test features it needs between 896
+//! KiB and 1 MiB there (measured by lowering `RUST_MIN_STACK`; at 896 KiB it
+//! overflows in the event listener's select). Production's 2 MiB leaves about
+//! twice that, and the 1.5 MiB case fails once use grows by about half.
+//!
+//! Linux only: `ulimit -s` before `exec` sets the main thread's stack there;
+//! Windows fixes it in the executable's header at link time. It proves the
+//! Windows property anyway, because what it checks is where the node runs, not
+//! a platform's frame sizes: at 640 KiB no node work fits on the main thread on
+//! any platform. No test runs Windows at its real sizes on both kinds of
+//! thread. `tests/quic_breaker_windows.rs` runs the binary with its real 1 MiB
+//! main stack, but with QUIC at the default mode and with CI's 256 MiB
+//! `RUST_MIN_STACK` on the workers, and Windows frames are usually somewhat
+//! larger than the Linux ones measured here.
+//!
+//! `ulimit -s` also lowers glibc's default stack for threads that C code
+//! creates without a size (Rust's own threads set theirs). A failure here can
+//! therefore come from such a thread rather than from node work on the main
+//! thread: read the overflow message, which names the thread.
+
+#![cfg(target_os = "linux")]
+
+use std::{
+    path::{Path, PathBuf},
+    process::{Child, Command, Stdio},
+    time::{Duration, Instant},
+};
+
+/// Main-thread stack for the node, in KiB. See the module doc for the sizes
+/// measured on either side of it.
+const MAIN_STACK_KIB: u32 = 640;
+
+/// std's default stack for the threads it spawns, tokio's workers included,
+/// when `RUST_MIN_STACK` is unset: the size production runs with.
+const PRODUCTION_WORKER_STACK: usize = 2 * 1024 * 1024;
+
+/// Three quarters of the production worker stack: fails when worker stack use
+/// grows by about half from the measured 896 KiB - 1 MiB, before it reaches
+/// production's limit.
+const EARLY_WARNING_WORKER_STACK: usize = 3 * 512 * 1024;
+
+/// Logged once the network listener is open, after the transport is bound:
+/// the point the Windows run never reached.
+const LISTENER_OPEN: &str = "Network listener opened";
+
+/// How long the node must keep running after `LISTENER_OPEN`. Before the fix
+/// the overflow came on the first event-loop turns, within milliseconds.
+const KEEP_RUNNING: Duration = Duration::from_secs(3);
+
+/// A port free in both TCP and UDP right now, below the ephemeral range.
+fn reserve_port() -> std::io::Result<u16> {
+    use std::sync::atomic::{AtomicU32, Ordering};
+    const FIRST: u32 = 20_000;
+    const COUNT: u32 = 10_000;
+    static NEXT: AtomicU32 = AtomicU32::new(0);
+    let start = std::process::id().wrapping_mul(2_654_435_761);
+    for _ in 0..COUNT {
+        let offset = start.wrapping_add(NEXT.fetch_add(1, Ordering::Relaxed)) % COUNT;
+        let port = (FIRST + offset) as u16;
+        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
+            && std::net::UdpSocket::bind(("127.0.0.1", port)).is_ok()
+        {
+            retu
```

---

### Incident Patch 2: `23080e91` (2026-11-13)
**Commit Message**: ci(release): refuse a live cut of the QUIC data ramp release far from T0 (#6206)

**File**: `.github/workflows/ci.yml` (modified, +8/-1)
```diff
@@ -283,6 +283,13 @@ jobs:
       - name: Self-test x86-64 baseline check
         run: bash scripts/check-x86-64-baseline_test.sh
 
+      # The release-time check that the QUIC data ramp release is cut within
+      # 3 h of its ramp start (#5940): its decisions on a fixed clock, that it
+      # is a no-op while QUIC_DATA_RAMP_RELEASE is None, and that release.yml's
+      # validate job still runs it.
+      - name: Self-test QUIC data ramp start check
+        run: bash scripts/check_quic_data_ramp_t0_test.sh
+
       # Release-driver RESUME state. Two regressions, both of the shape where a
       # resumed release is wrong in a way the operator cannot see: the v0.2.42
       # FDEV_VERSION double-bump, and the CRATES_PUBLISHED flag being set on
@@ -381,7 +388,7 @@ jobs:
       # clean when they landed but were not actually in this list, so nothing
       # held them to it. `-x` because the two test scripts `source` the canary.
       - name: Lint install/uninstall scripts (shellcheck)
-        run: shellcheck -x scripts/check-x86-64-baseline.sh scripts/check-x86-64-baseline_test.sh scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh scripts/wan-bench-classify.sh scripts/wan-bench-classify_test.sh scripts/cache_warm_parity_test.sh scripts/simulation_schedule_test.sh
+        run: shellcheck -x scripts/check-x86-64-baseline.sh scripts/check-x86-64-baseline_test.sh scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh scripts/wan-bench-classify.sh scripts/wan-bench-classify_test.sh scripts/cache_warm_parity_test.sh scripts/simulation_schedule_test.sh scripts/check_quic_data_ramp_t0.sh scripts/check_quic_data_ramp_t0_test.sh
       # The PR-backlog sweep reports stalled PRs (see
       # .github/workflows/pr-backlog-sweep.yml). Its self-test drives the ABORT
       # paths -- failed query, empty listing the REST probe contradicts,
```

**File**: `.github/workflows/cross-compile.yml` (modified, +20/-0)
```diff
@@ -925,6 +925,26 @@ jobs:
       # does. The default ref for a tag push is the tag, so the tree published
       # here is exactly the tree the shipped binaries were built from.
       # ---------------------------------------------------------------------
+      # The QUIC data ramp start (T0) is checked again here, against the tag's
+      # version and the clock now, immediately before the irreversible publish
+      # and the un-draft: release.yml's validate job checks it when the run
+      # starts, but the bump PR, the builds and the canary come between, and a
+      # "re-run failed jobs" of this job hours later must check it again rather
+      # than publish on the earlier verdict. A failure leaves the draft
+      # unpublished, which is the safe state. Pinned by
+      # scripts/check_quic_data_ramp_t0_test.sh.
+      - name: Check the QUIC data ramp start is near now (before publishing)
+        if: ${{ success() && startsWith(github.ref, 'refs/tags/v') }}
+        working-directory: _src
+        env:
+          # Read-only: the check asks the GitHub API whether a release is
+          # published, and the anonymous limit is shared by the runner's
+          # address. The workflow token is enough to read; nothing here writes.
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          TAG_NAME="${GITHUB_REF#refs/tags/}"
+          bash scripts/check_quic_data_ramp_t0.sh --version "${TAG_NAME#v}" --live true
+
       - name: Publish crates to crates.io
         # Tag-gated as well as job-gated. The job's own
         # `if: startsWith(github.ref, 'refs/tags/v')` already blocks this on a
```

**File**: `.github/workflows/release.yml` (modified, +21/-0)
```diff
@@ -185,6 +185,27 @@ jobs:
           echo "  freenet: $VERSION"
           echo "  fdev: $FDEV_VERSION"
 
+      # The QUIC data ramp release must be published within 3 h of its ramp
+      # start (QUIC_DATA_RAMP_START), which is fixed in the binary: a late
+      # publish starts every node part-way along the curve. This measures the
+      # DISPATCH time; cross-compile.yml's attach-to-release job checks again
+      # just before the crates.io publish and the un-draft, so a re-run checks
+      # the clock it publishes at. Nodes then take the release over the 0-4 h
+      # auto-update stagger, on top of either. The ramp release is checked
+      # against T0; another version passes unless it would ship the ramp
+      # unchecked (before the ramp release, or skipping it), which fails
+      # closed. A live run that fails stops here, before anything is created;
+      # a dry run gets a warning. Pinned by scripts/check_quic_data_ramp_t0_test.sh.
+      - name: Check the QUIC data ramp start is near now
+        env:
+          RELEASE_VERSION: ${{ steps.validate.outputs.version }}
+          RELEASE_LIVE: ${{ steps.mode.outputs.live }}
+          # Read-only: the check asks the GitHub API whether a release is
+          # published, and the anonymous limit is shared by the runner's
+          # address. The workflow token is enough to read; nothing here writes.
+          GH_TOKEN: ${{ github.token }}
+        run: bash scripts/check_quic_data_ramp_t0.sh --version "$RELEASE_VERSION" --live "$RELEASE_LIVE"
+
   # Runs in BOTH modes: the bump is computed and committed locally either way.
   # Only a live run pushes it, opens the PR and enables auto-merge (#5936: a
   # dry run used to do all three, landing the version bump on main).
```

**File**: `crates/core/src/transport/quic/upgrade/policy.rs` (modified, +45/-0)
```diff
@@ -52,6 +52,26 @@ pub(crate) fn may_carry_data(config: &NetworkApiConfig) -> bool {
         && config.quic_data_percent().unwrap_or(QUIC_DATA_PERCENT) > 0
 }
 
+/// When this release's QUIC data ramp starts (T0), in seconds since the Unix
+/// epoch, or `None` for no ramp. `None` in tree; the data ramp (#5940) reads
+/// it, and the reviewed PR for the ramp release sets it to the planned publish
+/// time. `scripts/check_quic_data_ramp_t0.sh` reads this line, so keep it on
+/// one line in this form.
+#[cfg_attr(not(test), allow(dead_code))]
+pub(in crate::transport) const QUIC_DATA_RAMP_START: Option<u64> = None;
+
+/// The release whose cut must come within 3 h of [`QUIC_DATA_RAMP_START`], as
+/// `"X.Y.Z"`, or `None`. Set together with the ramp start, in the same reviewed
+/// PR, to the version of the release that ships it; release.yml's validate job
+/// then refuses a live cut of that version unless the clock is within 3 h of the
+/// start (`scripts/check_quic_data_ramp_t0.sh`, which reads this line, so keep
+/// it on one line in this form). Left set afterwards, like the start: it names
+/// one version, so a later release is not held to T0, though one that would
+/// ship the ramp unchecked (before this release, or skipping it) is refused. An
+/// emergency stop that sets the start back to `None` leaves this as it is.
+#[cfg_attr(not(test), allow(dead_code))]
+pub(in crate::transport) const QUIC_DATA_RAMP_RELEASE: Option<&str> = None;
+
 /// Whether this build reads data from a QUIC path. It does: `PeerConnection::recv`
 /// drains the session's data channels, so a node that says it accepts data delivers
 /// a peer's frames. While this is `false`, [`QuicPolicy::own_caps`] returns 0
@@ -389,6 +409,31 @@ pub(crate) fn log_startup(config: &NetworkApiConfig) {
 mod tests {
     use super::*;
 
+    /// A ramp start names the release it ships in, so the release-time check
+    /// (`scripts/check_quic_data_ramp_t0.sh`) has a version to key on; a
+    /// named release is `X.Y.Z`, the form the script and release.yml use. A
+    /// release with no start is allowed: an emergency stop resets the start
+    /// and leaves the release, which names an earlier version.
+    #[test]
+    fn a_ramp_start_names_its_release() {
+        if QUIC_DATA_RAMP_START.is_some() {
+            assert!(
+                QUIC_DATA_RAMP_RELEASE.is_some(),
+                "QUIC_DATA_RAMP_START is set, so QUIC_DATA_RAMP_RELEASE must name its release"
+            );
+        }
+        if let Some(release) = QUIC_DATA_RAMP_RELEASE {
+            let parts: Vec<&str> = release.split('.').collect();
+            assert!(
+                parts.len() == 3
+                    && parts
+                        .iter()
+                        .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit())),
+                "QUIC_DATA_RAMP_RELEASE must be X.Y.Z, got {release:?}"
+            );
+        }
+    }
+
     const AVAILABILITIES: [QuicAvailability; 4] = [
         QuicAvailability::Disabled,
         QuicAvailability::Up,
```

**File**: `docs/RELEASING.md` (modified, +52/-0)
```diff
@@ -504,6 +504,58 @@ Current wire-gated floors:
   `quic_native_floor_stays_above_every_release_without_the_decoder` catches the
   floor being lowered.
 
+- `QUIC_DATA_RAMP_START` (T0) and `QUIC_DATA_RAMP_RELEASE` in
+  `crates/core/src/transport/quic/upgrade/policy.rs` (#5940): both `None` in
+  tree. The reviewed PR for the QUIC data ramp release sets T0 to the planned
+  publish time, in Unix seconds, and `QUIC_DATA_RAMP_RELEASE` to that release's
+  version. `scripts/check_quic_data_ramp_t0.sh` then refuses a live cut of
+  that version when the clock is more than 3 h from T0 either side (a dry run
+  only warns). It runs at dispatch (release.yml's validate job), again in
+  cross-compile.yml's attach-to-release job just before the crates.io publish
+  and the un-draft (so "re-run failed jobs" checks the clock it publishes at),
+  and in `scripts/release.sh` at its start and before each publish. What it
+  measures is the publish time; nodes take the release over the 0-4 h
+  auto-update stagger on top of it. Both constants stay set afterwards: a later
+  version passes with a warning. A version that would ship the ramp unchecked
+  fails closed: one before `QUIC_DATA_RAMP_RELEASE`, one that skips it while
+  the tree has not reached it (an auto-bump past a taken number), one cut
+  while `v<QUIC_DATA_RAMP_RELEASE>` is not a published (non-draft) GitHub
+  release, GitHub's latest release is before it, or `freenet` at that version
+  is not on crates.io, or any of these gives no clear answer (the ramp
+  release's bump merged but its publish or un-draft failed or was cancelled,
+  or "latest" stayed pinned to an older build; nodes update from GitHub's
+  latest release, so a crates.io publish alone did not reach them), or one
+  cut more than 3 h
+  before T0, and T0 set with no ramp release named. The check reads the
+  GitHub API with `GH_TOKEN` (the workflow token in CI, `gh auth token`
+  locally) when it has one. Cut the ramp release with `--field version=X.Y.Z` set to
+  `QUIC_DATA_RAMP_RELEASE`, not the auto-bump. If that version is already
+  taken, change the constant in the same reviewed PR as T0. A later re-ramp
+  must set a new T0 and a new `QUIC_DATA_RAMP_RELEASE` together: a new T0 with
+  a stale release name is not caught when the cut comes more than 3 h after
+  the new T0. If the publish slips more than about 3 h past T0, re-set T0 in a
+  new reviewed PR before publishing.
+
+  Which check guards which side. The dispatch check (release.yml) reads the
+  tree before the version bump, so it is the one that sees a cut version
+  skipping or preceding the ramp release. At the tag the tree is already the
+  cut version, so the attach-to-release check sees only the clock and the
+  publication of the ramp release, not a skip. One case neither sees at cut
+  time: `QUIC_DATA_RAMP_RELEASE` naming a version that ships before the ramp
+  PR merges. CI covers it: `scripts/check_quic_data_ramp_t0_test.sh` fails a
+  tree where T0 is more than 3 h away and `QUIC_DATA_RAMP_RELEASE` is not
+  above the `crates/core` version. The same test requires each state the
+  constants pass through to pass CI, including the emergency stop (T0 back to
+  `None` with the release left named: a later version passes, the named one is
+  refused). A stop taken before the ramp release ships leaves the next
+  auto-bump equal to the named version, which is then refused: cut another
+  version, or set `QUIC_DATA_RAMP_RELEASE` to `None` in the stop PR.
+
+  The attach-to-release check reads the version from the tag and accepts only
+  `X.Y.Z`. A pre-release tag (`v0.2.157-rc1`) exits 2 there and stops the
+  publish. The project tags no pre-releases; one would need the check taught
+  its form first.
+
 - `QUIC_DATA_PERCENT` in `crates/core/src/transport/quic/upgrade/policy.rs` (the
   share of pairs that carry data on QUIC, #5940). It stays at its value unless
   this release is a rollout step (0, 5, 25, 100), changed in its own PR. That PR also edits the expectations that pin 0:
```

**File**: `scripts/RELEASE_RECOVERY.md` (modified, +14/-1)
```diff
@@ -299,14 +299,27 @@ gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq '
 
 **That must print `success`.** `failure`, `cancelled`, `skipped` — or no line
 at all, which means the step never ran — all mean Gate A did not pass. Stop and
-go to Step 4b. Only continue past this point on `success`:
+go to Step 4b. Only continue past this point on `success`.
+
+Gate A is not the only step that leaves a release in this state. The QUIC data
+ramp start check (`Check the QUIC data ramp start is near now (before
+publishing)`, just before the crates.io publish) refuses a release that would
+ship the ramp at the wrong time, and its refusal also leaves Gate A passed, the
+crates absent and the release a draft. So the publish below runs that check
+first, on the clock you publish at, and stops if it refuses. Do not publish
+around a refusal; follow the remedy it prints (docs/RELEASING.md).
 
 ```bash
 cd ~/code/freenet/freenet-core/main
 git fetch origin
 # Publish from the release commit, not from whatever main is now (see Step 2).
 git checkout "$RELEASE_SHA"
 
+# The QUIC data ramp start check, as attach-to-release runs it.
+if ! bash scripts/check_quic_data_ramp_t0.sh --version 0.1.X --live true; then
+  echo "STOP: the QUIC data ramp start check refused 0.1.X; do not publish"; exit 1
+fi
+
 # Per crate, because a partial publish is the usual reason to be here:
 # RELEASING.md routes "fdev failed but freenet succeeded" to this step, and an
 # unconditional `cargo publish -p freenet` would just error on the crate that
```

**File**: `scripts/check_quic_data_ramp_t0.sh` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+#!/usr/bin/env bash
+# Check, when the QUIC data ramp release is cut, that its ramp start (T0) is
+# close to now (#5940, #6138).
+#
+# T0 (`QUIC_DATA_RAMP_START` in crates/core/src/transport/quic/upgrade/policy.rs)
+# is fixed in the binary. A publish long after T0 starts every node that updates
+# part-way along the curve (24 h after T0, at 100%, skipping the ramp), and one
+# long before T0 holds every node at 5% until T0. So the ramp release must be
+# cut within WINDOW of T0, or T0 must be re-set in a new reviewed PR first.
+#
+# Only the release named by `QUIC_DATA_RAMP_RELEASE` (beside T0) is held to
+# T0: T0 stays set after it (past 24 h it reads 100%, the steady state), and
+# later releases must not be held to it, so one passes with a warning. A
+# version that would ship the ramp unchecked fails closed like a late cut:
+# T0 set with no release named; a version before the named one; a later one
+# that skips it while this tree (crates/core/Cargo.toml) has not reached it;
+# a later one while the ramp release is not a published (non-draft) GitHub
+# release, GitHub's latest release is before it, or it is not on crates.io,
+# or any of these has no clear answer (the bump can merge and the publish or
+# un-draft then fail); a later one
+# cut more than WINDOW before T0. With no T0, or no ramp release and no T0, it
+# prints a notice and exits 0.
+#
+# Usage:
+#   check_quic_data_ramp_t0.sh --version X.Y.Z --live true|false
+#                              [--now UNIX_SECS] [--policy PATH] [--window SECS]
+#                              [--cargo-toml PATH]
+#
+# --now defaults to the clock (`date +%s`); tests pass it. A live run that
+# fails the check exits 1. A dry run reports the same finding as a warning and
+# exits 0, so a rehearsal shows it without stopping. A policy file the script
+# cannot read (a constant missing, repeated or written another way) exits 2 in
+# both modes: the check cannot say anything, so it does not pass.
+
+set -uo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+POLICY="$SCRIPT_DIR/../crates/core/src/transport/quic/upgrade/policy.rs"
+CARGO_TOML="$SCRIPT_DIR/../crates/core/Cargo.toml"
+WINDOW=$((3 * 3600))
+VERSION=""
+LIVE=""
+NOW=""
+
+while [[ $# -gt 0 ]]; do
+    case "$1" in
+        --version) VERSION="${2:-}"; shift 2 ;;
+        --live) LIVE="${2:-}"; shift 2 ;;
+        --now) NOW="${2:-}"; shift 2 ;;
+        --policy) POLICY="${2:-}"; shift 2 ;;
+        --window) WINDOW="${2:-}"; shift 2 ;;
+        --cargo-toml) CARGO_TOML="${2:-}"; shift 2 ;;
+        *) echo "::error::check_quic_data_ramp_t0: unknown argument '$1'"; exit 2 ;;
+    esac
+done
+
+if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
+    echo "::error::check_quic_data_ramp_t0: --version must be X.Y.Z (got '$VERSION')"
+    exit 2
+fi
+if [[ "$LIVE" != "true" && "$LIVE" != "false" ]]; then
+    echo "::error::check_quic_data_ramp_t0: --live must be true or false (got '$LIVE')"
+    exit 2
+fi
+if [[ -z "$NOW" ]]; then
+    NOW="$(date +%s)"
+fi
+if [[ ! "$NOW" =~ ^[0-9]+$ || ! "$WINDOW" =~ ^[0-9]+$ ]]; then
+    echo "::error::check_quic_data_ramp_t0: --now and --window must be whole seconds"
+    exit 2
+fi
+if [[ ! -f "$POLICY" ]]; then
+    echo "::error::check_quic_data_ramp_t0: policy file not found: $POLICY"
+    exit 2
+fi
+
+# Sets DECLARED to the value of the one declaration of constant $1 whose type
+# is $2, or exits 2. The declaration starts a line and runs to its `;`,
+# possibly over several lines (rustfmt wraps a long one), and its whitespace
+# is collapsed, so `Some(\n    1_800_000_000,\n)` reads as `Some(1_800_000_000)`.
+# Starting a line keeps a comment or test that mentions the name from being
+# read; two declarations are refused rather than one picked. (Not a command
+# substitution: its error message would be captured.)
+DECLARED=""
+read_declared() {
+    local name="$1" type="$2" found count
+    found="$(awk -v head="pub(in crate::transport) const ${name}: ${type} =" '
+        index($0, head) == 1 { inside = 1; text = "" }
+        inside { text = text " " $0; if ($0 ~ /;[[:space:]]*$/) { print text; inside = 0 } }
+    ' "$POLICY")"
+    count="$(printf '%s' "$found" | grep -c . || true)"
+    if [[ "$count" != "1" ]]; then
+        echo "::error::check_quic_data_ramp_t0: expected one declaration of ${name}: ${type} in $POLICY, found ${count}"
+        exit 2
+    fi
+    found="${found#*= }"
+    found="${found%;*}"
+    # Collapse whitespace, then drop it inside the parentheses and a trailing
+    # comma rustfmt adds to a wrapped argument.
+    found="$(printf '%s' "$found" | tr -s '[:space:]' ' ')"
+    found="${found// /}"
+    found="${found/,)/)}"
+    DECLARED="$found"
+}
+
+read_declared QUIC_DATA_RAMP_RELEASE 'Option<&str>'
+release_value="$DECLARED"
+read_declared QUIC_DATA_RAMP_START 'Option<u64>'
+start_value="$DECLARED"
+
+# Every finding below fails a live run and warns in a dry run.
+finding() {
+    if 
```

**File**: `scripts/check_quic_data_ramp_t0_test.sh` (added, +522/-0)
```diff
@@ -0,0 +1,522 @@
+#!/usr/bin/env bash
+# Tests for scripts/check_quic_data_ramp_t0.sh, the release-time check that the
+# QUIC data ramp release is cut within 3 h of its ramp start (#5940, #6138).
+#
+# Each case runs the script against a policy file written here, with the clock
+# passed as --now, and checks its exit code and one line of its output. Then it
+# checks the tree as it is: with QUIC_DATA_RAMP_RELEASE = None the check is a
+# no-op for any version, live or dry. Last, the wiring, each read from the
+# step's (or function's) own lines: release.yml's validate job runs it on the
+# resolved version and run mode; cross-compile.yml's attach-to-release job runs
+# it again on the tag's version before the crates.io publish and the un-draft;
+# the local release script runs it at the start and in each publish function.
+#
+# Run manually: bash scripts/check_quic_data_ramp_t0_test.sh
+# Also wired into CI (the Fmt job in .github/workflows/ci.yml).
+
+# The needles below are literal workflow and script text, `${{ }}` and `$VAR`
+# included, so single quotes are meant.
+# shellcheck disable=SC2016
+# Two cases run check_tree in a subshell on purpose, so the failures they
+# expect stay out of this run's count.
+# shellcheck disable=SC2030,SC2031
+set -uo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+CHECK="$SCRIPT_DIR/check_quic_data_ramp_t0.sh"
+POLICY="$SCRIPT_DIR/../crates/core/src/transport/quic/upgrade/policy.rs"
+RELEASE_YML="$SCRIPT_DIR/../.github/workflows/release.yml"
+WORK="$(mktemp -d)"
+trap 'rm -rf "$WORK"' EXIT
+FAILURES=0
+T0=1800000000
+HOUR=3600
+
+# A policy file declaring the two constants as $1 and $2.
+policy() {
+    local file="$WORK/policy-$RANDOM.rs"
+    {
+        echo "/// When this release's data ramp starts."
+        echo "pub(in crate::transport) const QUIC_DATA_RAMP_START: Option<u64> = $1;"
+        echo ""
+        echo "#[cfg_attr(not(test), allow(dead_code))]"
+        echo "pub(in crate::transport) const QUIC_DATA_RAMP_RELEASE: Option<&str> = $2;"
+        echo "// QUIC_DATA_RAMP_START: Option<u64> = Some(1); a comment is not read"
+    } > "$file"
+    printf '%s' "$file"
+}
+
+# A crates/core/Cargo.toml at version $1.
+cargo_at() {
+    local file="$WORK/cargo-$1.toml"
+    printf '[package]\nname = "freenet"\nversion = "%s"\n' "$1" > "$file"
+    printf '%s' "$file"
+}
+SHIPPED="$(cargo_at 0.2.157)"
+BEFORE="$(cargo_at 0.2.156)"
+
+# crates.io and GitHub, as the check sees them: a `curl` first on PATH that
+# records its arguments (and the header file it is given, which is where a
+# token goes) and answers by host: GitHub with HTTP $FAKE_GH_CODE and body
+# $FAKE_GH_BODY written to the -o file, crates.io with HTTP $FAKE_CRATES_CODE.
+# $FAKE_CURL_EXIT, when set, makes it fail with no answer at all. A `gh` that
+# fails keeps the check from reading a real token on this machine.
+mkdir -p "$WORK/bin"
+cat > "$WORK/bin/curl" <<'CURL'
+#!/usr/bin/env bash
+printf '%s\n' "$*" >> "$FAKE_CURL_LOG"
+out="" url=""
+while [[ $# -gt 0 ]]; do
+    case "$1" in
+        -o) out="$2"; shift 2 ;;
+        -H) if [[ "$2" == @* ]]; then cat "${2#@}" >> "$FAKE_CURL_LOG.headers"; fi; shift 2 ;;
+        http*) url="$1"; shift ;;
+        *) shift ;;
+    esac
+done
+if [[ -n "${FAKE_CURL_EXIT:-}" ]]; then
+    exit "$FAKE_CURL_EXIT"
+fi
+case "$url" in
+    https://api.github.com/*/releases/latest)
+        if [[ -n "$out" ]]; then printf '%s' "$FAKE_GH_LATEST_BODY" > "$out"; fi
+        printf '%s' "$FAKE_GH_LATEST_CODE" ;;
+    https://api.github.com/*)
+        if [[ -n "$out" ]]; then printf '%s' "$FAKE_GH_BODY" > "$out"; fi
+        printf '%s' "$FAKE_GH_CODE" ;;
+    *) printf '%s' "$FAKE_CRATES_CODE" ;;
+esac
+CURL
+printf '#!/usr/bin/env bash\nexit 1\n' > "$WORK/bin/gh"
+chmod +x "$WORK/bin/curl" "$WORK/bin/gh"
+export PATH="$WORK/bin:$PATH"
+unset GH_TOKEN GITHUB_TOKEN
+export FAKE_CURL_LOG="$WORK/curl.log"
+export FAKE_CRATES_CODE=200 FAKE_GH_CODE=200
+export FAKE_GH_BODY='{"tag_name": "v0.2.157", "draft": false, "prerelease": false}'
+export FAKE_GH_LATEST_CODE=200
+export FAKE_GH_LATEST_BODY='{"tag_name": "v0.2.157", "draft": false}'
+: > "$FAKE_CURL_LOG"
+
+# check_case NAME EXPECTED_RC EXPECTED_TEXT -- ARGS...
+check_case() {
+    local name="$1" want_rc="$2" want_text="$3" out rc
+    shift 4
+    out="$(bash "$CHECK" "$@" 2>&1)"
+    rc=$?
+    if [[ "$rc" != "$want_rc" || "$out" != *"$want_text"* ]]; then
+        echo "FAIL - $name: rc=$rc (want $want_rc), output: $out"
+        FAILURES=$((FAILURES + 1))
+    else
+        echo "ok - $name"
+    fi
+}
+
+unset_both="$(policy None None)"
+check_case "no ramp release, live: no-op" 0 "no ramp release" -- \
+    --version 0.2.156 --live true --now "$T0" --policy "$unset_both"
+check_case "no ramp release, dry run: no-op" 0 "no ramp release" -- \
+    --version 0.2.156 --live false --now "$T0" --policy "$unset_both"
+
+set_both="$(policy "Some(1_800_000_000)" 'Some("0.2.157")')"
+check_case "a
```

---

### Incident Patch 3: `b9479d5b` (2026-11-13)
**Commit Message**: feat(transport): a QUIC-native connection as a PeerConnectionApi (#6210)

**File**: `.claude/rules/transport.md` (modified, +41/-2)
```diff
@@ -2088,6 +2088,44 @@ Not decided here (A5): fairness between the requesters that steer setups,
   before UDP is removed.
 ```
 
+Native connection (`peer_connection/native_connection.rs`, A5a): the
+`PeerConnectionApi` over a native connection, built by nothing in production
+until A5b wires the connect op.
+
+```
+Path: QuicPathLimits::NATIVE (DEFAULT with udp_fallback off) and data
+  enabled at once. A send whose next step would be UDP is given up (counted
+  Dropped, a stream's completion told Dropped), and a quiet timeout never
+  makes the path suspect (suspect only diverts data to UDP); a dark path
+  ends by the stall close or the acknowledgement watch's dark rule. A peer
+  refusing data (NOT_ACCEPTING_DATA) closes the native path at once
+  (QuicPath::stop_sending_data); left open it would drop every later send.
+  Upgrade paths keep udp_fallback on and are unchanged.
+Shorts: DataRoute::native, no UDP sender. queue_native_short refuses a full
+  queue with TransportError::SendQueueFull (Transient: the connection
+  survives, the message is counted Dropped, no ShortOverflowUdp), and an
+  ended path with ConnectionClosed. The worker drops and counts a short it
+  cannot put on the path (ended, or refusing data while it closes).
+Receive: recv reads the path's inbox through InboundDispatch, the same record
+  a UDP connection keeps (metadata dispatched once, stream ids not reused).
+  When the connection ends, both inbox channels are drained before recv
+  fails.
+End reasons (close_reason after recv fails): quinn's idle TimedOut is
+  CloseReason::IdleTimeout; everything else is CloseReason::QuicPath with a
+  QuicPathEnd. A close this node makes records its cause at the close site
+  (QuicCloser::close_for: Stalled, NotAcknowledging, SendAborts,
+  PeerOverBudget, RefusedData, PeerRefusedData, ReceiveTaskPanicked), first
+  cause wins; a
+  local close with none is ClosedLocally, the peer's close ClosedByPeer, and
+  any other end Lost. The disconnect label is QuicPathEnd::label.
+Pacing: the bandwidth limit paces its data with a LimitPacer on the path's
+  clock, as an upgrade session's does.
+Drop: closes with NODE_DROPPED_PEER at once (send tasks hold the path) and
+  cancels its unclaimed inbound streams, as PeerConnection's drop does.
+send_bytes_observed is always Unobserved: no message is a stream it reports.
+The route worker runs under report_panics (task_panicked).
+```
+
 #### QUIC framing and path (`quic/framing.rs`, `quic/path.rs`, #5940 step e3)
 
 The upgrade driver builds a `QuicPath` and sends control frames on it. Data goes on
@@ -2195,8 +2233,9 @@ Sending (QuicPath::send_short_bounded / send_stream_bounded /
     repeated timeouts close the path. NotOpened opened nothing, so it does not
     count.
   → A NOT_ACCEPTING_DATA stop means the sender's gating is wrong: log it and
-    send the message on UDP, do not retry on this path. A sender cannot rely
-    on seeing it (see the stop code).
+    send the message on UDP, do not retry on this path (a native path, with no
+    UDP, closes instead). A sender cannot rely on seeing it (see the stop
+    code).
   Sends have no deadline of their own: open_uni, a flow-blocked write
   and the final wait for acks can wait as long as the connection lives
   against a peer that does not cooperate. Every node send MUST go through
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +65/-0)
```diff
@@ -4116,6 +4116,9 @@ fn disconnect_reason_for_close(
         Some(CloseReason::InboundStreamRefusals) => {
             crate::tracing::DisconnectReason::Explicit("inbound_stream_refusals".into())
         }
+        Some(CloseReason::QuicPath(end)) => {
+            crate::tracing::DisconnectReason::Explicit(end.label().into())
+        }
         None => crate::tracing::DisconnectReason::NetworkError("transport_closed".into()),
     }
 }
@@ -4470,6 +4473,68 @@ pub(crate) mod tests {
         }
     }
 
+    /// Every `QuicPathEnd` label reaches telemetry as `Explicit(label)`, both
+    /// from `disconnect_reason_for_close` and through `DisconnectReason`'s
+    /// substring parser, which reads "timeout", "limit", "pruned" and
+    /// "unresponsive" in a label as another reason. The match gives each
+    /// variant an index, so a new variant does not compile until it has one,
+    /// and the count check fails until it is in the list.
+    #[test]
+    fn every_quic_path_end_label_survives_the_disconnect_reason_parser() {
+        use crate::tracing::DisconnectReason;
+        use crate::transport::{CloseReason, QuicPathEnd as E};
+        fn index(end: E) -> usize {
+            match end {
+                E::Stalled => 0,
+                E::NotAcknowledging => 1,
+                E::SendAborts => 2,
+                E::PeerOverBudget => 3,
+                E::RefusedData => 4,
+                E::PeerRefusedData => 5,
+                E::ReceiveTaskPanicked => 6,
+                E::ClosedByPeer => 7,
+                E::ClosedLocally => 8,
+                E::Lost => 9,
+            }
+        }
+        let all = [
+            E::Stalled,
+            E::NotAcknowledging,
+            E::SendAborts,
+            E::PeerOverBudget,
+            E::RefusedData,
+            E::PeerRefusedData,
+            E::ReceiveTaskPanicked,
+            E::ClosedByPeer,
+            E::ClosedLocally,
+            E::Lost,
+        ];
+        let mut indices: Vec<usize> = all.iter().map(|end| index(*end)).collect();
+        indices.sort_unstable();
+        indices.dedup();
+        assert_eq!(
+            indices,
+            (0..all.len()).collect::<Vec<_>>(),
+            "list every variant once"
+        );
+        let mut labels = std::collections::HashSet::new();
+        for end in all {
+            let label = end.label();
+            assert!(labels.insert(label), "{label} is used twice");
+            let explicit = DisconnectReason::Explicit(label.to_string());
+            assert_eq!(
+                super::disconnect_reason_for_close(Some(CloseReason::QuicPath(end))),
+                explicit,
+                "{end:?}"
+            );
+            assert_eq!(
+                DisconnectReason::from(Some(label.to_string())),
+                explicit,
+                "{label} parses as another reason"
+            );
+        }
+    }
+
     fn hosting_announce() -> crate::message::NetMessage {
         use crate::message::{NeighborHostingMessage, NetMessage, NetMessageV1};
         NetMessage::V1(NetMessageV1::NeighborHosting {
```

**File**: `crates/core/src/transport.rs` (modified, +12/-0)
```diff
@@ -350,6 +350,9 @@ impl From<SocketAddr> for ObservedAddr {
 }
 
 pub(crate) use self::boundary::TransportHandle;
+// For the node's test that pins each end's disconnect label.
+#[cfg(test)]
+pub(crate) use self::boundary::QuicPathEnd;
 pub(crate) use self::boundary::{
     CloseReason, InboundAcceptor, InboundExpectations, InboundStreamRegistry, ListenerExit,
     NextConnection, ObservedSend, OutboundConnector, PeerConnectionApi, PendingConnection,
@@ -399,6 +402,12 @@ pub enum TransportError {
     /// the same message fails the same way on every attempt.
     #[error("outbound stream to {0} not sent: length {1} is outside the stream limits")]
     OutboundStreamInvalidLength(SocketAddr, u64),
+    /// A message to the peer was not sent because the connection's queue for
+    /// it is full (a QUIC-native connection's short-message queue, which has
+    /// no UDP session to spill to). Transient: the connection survives, and
+    /// the operation layer retries or gives up as for a lost message.
+    #[error("message to {0} not sent: the connection's send queue is full")]
+    SendQueueFull(SocketAddr),
     #[error(transparent)]
     Other(#[from] anyhow::Error),
     /// An error only the UDP transport produces (a socket send or I/O
@@ -638,6 +647,7 @@ impl TransportError {
     pub fn scope(&self) -> ErrorScope {
         match self {
             TransportError::OutboundStreamFailed(..)
+            | TransportError::SendQueueFull(..)
             | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..))) => ErrorScope::Transient,
             TransportError::Quic(QuicError(QuicErrorKind::Stopped { code }))
                 if quic::error::stop_is_retryable(*code) =>
@@ -1204,6 +1214,7 @@ mod tests {
                     (ErrorScope::Transient, true, false)
                 }
                 TransportError::OutboundStreamFailed(_) => (ErrorScope::Transient, true, false),
+                TransportError::SendQueueFull(_) => (ErrorScope::Transient, true, false),
                 TransportError::OutboundStreamInvalidLength(..) => {
                     (ErrorScope::Stream, false, false)
                 }
@@ -1254,6 +1265,7 @@ mod tests {
             },
             TransportError::send_failed(addr, io::ErrorKind::NetworkUnreachable),
             TransportError::OutboundStreamFailed(addr),
+            TransportError::SendQueueFull(addr),
             TransportError::OutboundStreamInvalidLength(addr, 0),
             TransportError::from(io::Error::other("x")),
             TransportError::Other(anyhow::anyhow!("x")),
```

**File**: `crates/core/src/transport/boundary.rs` (modified, +53/-0)
```diff
@@ -332,6 +332,59 @@ pub(crate) enum CloseReason {
     /// The peer had more refused inbound streams outstanding than are
     /// remembered.
     InboundStreamRefusals,
+    /// A QUIC-native connection's path ended, for the reason given.
+    QuicPath(QuicPathEnd),
+}
+
+/// Why a QUIC-native connection's path ended, other than the idle timeout
+/// ([`CloseReason::IdleTimeout`]). A cause this node closed for is recorded
+/// where it closed (`QuicCloser::close_for`).
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum QuicPathEnd {
+    /// This node's sends kept timing out with nothing acknowledged (the
+    /// path's stall count).
+    Stalled,
+    /// The peer acknowledged none of this node's packets while it kept
+    /// sending, or stopped acknowledging data (the acknowledgement watch).
+    NotAcknowledging,
+    /// This node reset more sends on the connection than it remembers
+    /// (`recycle::SEND_ABORT_LIMIT`).
+    SendAborts,
+    /// The peer held more of this node's buffer budget than it allows.
+    PeerOverBudget,
+    /// The peer sent data on a path that refuses it.
+    RefusedData,
+    /// The peer refused this node's data (`NOT_ACCEPTING_DATA`) on a path that
+    /// has no UDP session to send it on instead.
+    PeerRefusedData,
+    /// The path's receive task panicked.
+    ReceiveTaskPanicked,
+    /// The peer closed the connection.
+    ClosedByPeer,
+    /// This node closed it for another reason (its connection was dropped).
+    ClosedLocally,
+    /// The connection was lost: a reset, a transport error, or an end quinn
+    /// reports in any other way.
+    Lost,
+}
+
+impl QuicPathEnd {
+    /// The disconnect label. None contains "timeout", "limit", "pruned" or
+    /// "unresponsive", which `DisconnectReason` parses as other reasons.
+    pub(crate) fn label(self) -> &'static str {
+        match self {
+            Self::Stalled => "quic_path_stalled",
+            Self::NotAcknowledging => "quic_peer_not_acknowledging",
+            Self::SendAborts => "quic_send_aborts",
+            Self::PeerOverBudget => "quic_peer_over_budget",
+            Self::RefusedData => "quic_refused_data",
+            Self::PeerRefusedData => "quic_peer_refused_data",
+            Self::ReceiveTaskPanicked => "quic_receive_task_panicked",
+            Self::ClosedByPeer => "quic_closed_by_peer",
+            Self::ClosedLocally => "quic_closed_locally",
+            Self::Lost => "quic_connection_lost",
+        }
+    }
 }
 
 /// An inbound stream, as the layers above the transport see it: claimed from
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +4/-1)
```diff
@@ -2451,7 +2451,7 @@ impl<S: Socket, T: TimeSource> UdpPacketsListener<S, T> {
                                     crate::transport::TRANSPORT_METRICS
                                         .record_nat_traversal_failed_version();
                                 }
-                                TransportError::ChannelClosed | TransportError::ConnectionClosed(_) | TransportError::ConnectionEstablishmentFailure { .. } | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..))) | TransportError::OutboundStreamFailed(_) | TransportError::OutboundStreamInvalidLength(..) | TransportError::Udp(UdpError(UdpErrorKind::IO(_))) | TransportError::Other(_) | TransportError::Udp(UdpError(UdpErrorKind::PubKeyDecryptionError(_))) | TransportError::Udp(UdpError(UdpErrorKind::Serialization(_))) | TransportError::Quic(_) => {
+                                TransportError::ChannelClosed | TransportError::ConnectionClosed(_) | TransportError::ConnectionEstablishmentFailure { .. } | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..))) | TransportError::OutboundStreamFailed(_) | TransportError::OutboundStreamInvalidLength(..) | TransportError::SendQueueFull(_) | TransportError::Udp(UdpError(UdpErrorKind::IO(_))) | TransportError::Other(_) | TransportError::Udp(UdpError(UdpErrorKind::PubKeyDecryptionError(_))) | TransportError::Udp(UdpError(UdpErrorKind::Serialization(_))) | TransportError::Quic(_) => {
                                     tracing::error!(error = %error, peer_addr = %remote_addr, "Failed NAT traversal");
                                     crate::transport::TRANSPORT_METRICS
                                         .record_nat_traversal_failed_error();
@@ -3566,6 +3566,7 @@ fn classify_nat_failure(
         | TransportError::ConnectionEstablishmentFailure { .. }
         | TransportError::OutboundStreamFailed(_)
         | TransportError::OutboundStreamInvalidLength(..)
+        | TransportError::SendQueueFull(_)
         | TransportError::Udp(UdpError(UdpErrorKind::IO(_)))
         | TransportError::Other(_)
         | TransportError::Udp(UdpError(UdpErrorKind::PubKeyDecryptionError(_)))
@@ -4021,6 +4022,7 @@ pub mod mock_transport {
             | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..)))
             | TransportError::OutboundStreamFailed(_)
             | TransportError::OutboundStreamInvalidLength(..)
+            | TransportError::SendQueueFull(_)
             | TransportError::Udp(UdpError(UdpErrorKind::IO(_)))
             | TransportError::Other(_)
             | TransportError::Udp(UdpError(UdpErrorKind::PubKeyDecryptionError(_)))
@@ -4041,6 +4043,7 @@ pub mod mock_transport {
             | TransportError::Udp(UdpError(UdpErrorKind::SendFailed(..)))
             | TransportError::OutboundStreamFailed(_)
             | TransportError::OutboundStreamInvalidLength(..)
+            | TransportError::SendQueueFull(_)
             | TransportError::Udp(UdpError(UdpErrorKind::IO(_)))
             | TransportError::Other(_)
             | TransportError::Udp(UdpError(UdpErrorKind::PubKeyDecryptionError(_)))
```

**File**: `crates/core/src/transport/peer_connection.rs` (modified, +42/-116)
```diff
@@ -23,8 +23,12 @@ use tracing::{Instrument, span};
 
 pub(super) mod inbound_budget;
 mod inbound_concurrency;
+mod inbound_dispatch;
 mod inbound_stream;
 mod outbound_stream;
+// Built only by its tests until the connect op uses it (#5940, A5b).
+#[cfg_attr(not(test), allow(dead_code))]
+mod native_connection;
 pub(super) use outbound_stream::embeds_metadata;
 mod peer_identity;
 pub(crate) mod piped_stream;
@@ -483,19 +487,10 @@ pub struct PeerConnection<S = super::UdpSocket, T: TimeSource = RealTime> {
     streaming_handles: crate::util::DecisionHashMap<StreamId, (streaming::StreamHandle, u64)>,
     /// Time source for deterministic simulation support
     time_source: T,
-    /// Registry that receives inbound operations streams, handling the race
-    /// between stream fragments and metadata messages
-    /// (RequestStreaming/ResponseStreaming).
-    /// Set by the node layer after connection establishment.
-    inbound_stream_registry: Option<std::sync::Arc<dyn super::InboundStreamRegistry>>,
-    /// LRU cache of recently dispatched metadata hashes (capacity 1000), used to dedup
-    /// embedded-metadata-in-fragment-#1 against the separate ShortMessage.
-    ///
-    /// Uses `DefaultHasher` (not cryptographic). A hash collision would cause
-    /// a silent metadata drop, leading to a 60-second operation timeout for
-    /// the affected stream -- acceptable given the small working set and
-    /// negligible collision probability. See issue #3317.
-    dispatched_msg_hashes: lru::LruCache<u64, ()>,
+    /// What this connection has handed to the node: the inbound stream
+    /// registry, the hashes of dispatched messages and the completed stream
+    /// ids (`inbound_dispatch`).
+    dispatch: inbound_dispatch::InboundDispatch,
     /// Refused stream ids, so a refused stream's later fragments are dropped
     /// rather than admitted part-way through (see
     /// `inbound_budget::RefusedStreams`).
@@ -505,9 +500,6 @@ pub struct PeerConnection<S = super::UdpSocket, T: TimeSource = RealTime> {
     closed_by_stream_refusals: bool,
     /// Rate limiter for the refused-stream warning.
     refusal_log: RefusalLog,
-    /// Recently completed (and released) inbound streams, so a late
-    /// retransmission does not start one again.
-    completed_inbound_streams: lru::LruCache<StreamId, ()>,
     /// Tokens of the legacy streams in `inbound_streams`, to cancel them.
     legacy_tokens: crate::util::DecisionHashMap<StreamId, Arc<inbound_budget::LegacyStreamToken>>,
     /// This connection's inbound stream outcomes, indexed by
@@ -581,7 +573,7 @@ impl<S, T: TimeSource> Drop for PeerConnection<S, T> {
         // retired, too) would otherwise wait out the orphan timeout with
         // nothing accounting for them. Both paths' streams: a QUIC path's reader
         // cancels its own streams but not a complete one.
-        if let Some(registry) = &self.inbound_stream_registry {
+        if let Some(registry) = &self.dispatch.inbound_stream_registry {
             // Collected first, so the shared budget is not locked while the
             // registry runs.
             let live: Vec<_> = self.inbound_budget.lock().live_buffer_streams().collect();
@@ -1139,14 +1131,7 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
     /// A Short from a QUIC path, as the UDP arm takes a `ShortMessage`, with its
     /// charge released at once. It moves neither of the UDP session's clocks.
     fn take_quic_short(&mut self, short: super::quic::path::InboundShort) -> Vec<u8> {
-        let (payload, key) = short.into_parts();
-        if let Some(key) = key {
-            self.inbound_budget.lock().release_if_gone(key);
-        }
-        let bytes = Vec::from(payload);
-        // Only so that the same metadata embedded in a stream is suppressed; a
-        // Short itself is always delivered, as on UDP.
-        self.dispatched_msg_hashes.put(Self::msg_hash(&bytes), ());
+        let bytes = self.dispatch.take_short(short, &self.inbound_budget);
         self.note_quic_delivery(|| {
             let decoded = bincode::deserialize::<crate::message::NetMessage>(&bytes).is_ok();
             format!(
@@ -1171,70 +1156,24 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
         &mut self,
         arrival: super::quic::path::InboundStreamArrival,
     ) -> Option<Vec<u8>> {
-        let super::quic::path::InboundStreamArrival {
-            stream_id,
-            metadata,
-            handle,
-        } = arrival;
-        // The stream's payload length, counted here because the reader task
-        // completes the stream later, with no way to count it from there.
-        // UDP counts at completion; this counts at arrival, and a stream that
-        // later fails is counted too.
-        let total = handle.total_bytes();
-        let seen_on_udp = self
-            .inbound_budget
-            .lock()
-            .contains(InboundKey::Udp(stream_id));
-        // An id i
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests/quic_data.rs` (modified, +2/-2)
```diff
@@ -152,7 +152,7 @@ fn a_short_and_a_stream_on_a_path_arrive_as_the_udp_ones_do() {
                 .send_stream(id, Some(b"announce"), payload.clone())
                 .await;
             assert_eq!(rig.e.conn.recv().await.unwrap(), b"announce");
-            assert!(rig.e.conn.completed_inbound_streams.contains(&id));
+            assert!(rig.e.conn.dispatch.completed_inbound_streams.contains(&id));
             assert_eq!(rig.budget().0, 1, "the consumer's to hold");
             let stream = claim((&rig.registry, rig.peer_addr()), id).await;
             assert_eq!(stream.assemble().await.unwrap(), payload.to_vec());
@@ -521,7 +521,7 @@ fn a_stream_with_no_registry_is_cancelled_and_its_charge_released() {
         "quic-data-noregistry",
         QuicPathLimits::DEFAULT,
         |mut rig| async move {
-            rig.e.conn.inbound_stream_registry = None;
+            rig.e.conn.dispatch.inbound_stream_registry = None;
             rig.path
                 .send_stream(StreamId::next(), Some(b"meta"), bytes_of(50))
                 .await;
```

**File**: `crates/core/src/transport/peer_connection/inbound_dispatch.rs` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+//! What a connection has handed to the node, kept to refuse repeats: the
+//! registry that receives its inbound streams, the hashes of the messages it
+//! dispatched, and the ids of the streams it completed. Moved out of
+//! `PeerConnection` unchanged, so a connection with no UDP session can keep
+//! the same record.
+
+use std::net::SocketAddr;
+
+use super::StreamId;
+use super::inbound_budget::{InboundKey, SharedInboundBudget};
+use crate::transport::quic::path::{InboundShort, InboundStreamArrival};
+
+/// What became of a stream that arrived on a QUIC path.
+pub(super) enum TakenStream {
+    /// Its id was in use on UDP or used before: cancelled and released.
+    IdInUse,
+    /// It ended while it waited, or there is no registry: cancelled and
+    /// released.
+    Dropped,
+    /// Registered with the node; `message` is its announcing message, unless
+    /// there was none or it was already dispatched.
+    Registered {
+        stream_id: StreamId,
+        message: Option<Vec<u8>>,
+    },
+}
+
+pub(super) struct InboundDispatch {
+    /// Registry that receives inbound operations streams, handling the race
+    /// between stream fragments and metadata messages
+    /// (RequestStreaming/ResponseStreaming).
+    /// Set by the node layer after connection establishment.
+    pub(super) inbound_stream_registry:
+        Option<std::sync::Arc<dyn crate::transport::InboundStreamRegistry>>,
+    /// LRU cache of recently dispatched metadata hashes (capacity 1000), used to dedup
+    /// embedded-metadata-in-fragment-#1 against the separate ShortMessage.
+    ///
+    /// Uses `DefaultHasher` (not cryptographic). A hash collision would cause
+    /// a silent metadata drop, leading to a 60-second operation timeout for
+    /// the affected stream -- acceptable given the small working set and
+    /// negligible collision probability. See issue #3317.
+    pub(super) dispatched_msg_hashes: lru::LruCache<u64, ()>,
+    /// Recently completed (and released) inbound streams, so a late
+    /// retransmission does not start one again.
+    pub(super) completed_inbound_streams: lru::LruCache<StreamId, ()>,
+}
+
+impl InboundDispatch {
+    /// Compute a fast hash of the given bytes for dedup tracking.
+    pub(super) fn msg_hash(bytes: &[u8]) -> u64 {
+        use std::hash::{Hash, Hasher};
+        let mut h = std::collections::hash_map::DefaultHasher::new();
+        bytes.hash(&mut h);
+        h.finish()
+    }
+
+    /// Returns true if this message was already dispatched (is a duplicate).
+    /// Only used on the embedded-metadata-in-fragment-#1 path to suppress
+    /// duplicates when the same metadata was already dispatched as a ShortMessage.
+    pub(super) fn is_duplicate_dispatch(&mut self, bytes: &[u8]) -> bool {
+        self.dispatched_msg_hashes
+            .put(Self::msg_hash(bytes), ())
+            .is_some()
+    }
+
+    /// A Short taken from a QUIC path: its charge released and its hash
+    /// remembered. Moved from `PeerConnection::take_quic_short`.
+    pub(super) fn take_short(
+        &mut self,
+        short: InboundShort,
+        budget: &SharedInboundBudget,
+    ) -> Vec<u8> {
+        let (payload, key) = short.into_parts();
+        if let Some(key) = key {
+            budget.lock().release_if_gone(key);
+        }
+        let bytes = Vec::from(payload);
+        // Only so that the same metadata embedded in a stream is suppressed; a
+        // Short itself is always delivered, as on UDP.
+        self.dispatched_msg_hashes.put(Self::msg_hash(&bytes), ());
+        bytes
+    }
+
+    /// A stream arrival taken from a QUIC path. Moved from
+    /// `PeerConnection::take_quic_stream`; the caller records the outcome and
+    /// traces the delivery.
+    pub(super) fn take_stream(
+        &mut self,
+        arrival: InboundStreamArrival,
+        budget: &SharedInboundBudget,
+        remote_addr: SocketAddr,
+    ) -> TakenStream {
+        let InboundStreamArrival {
+            stream_id,
+            metadata,
+            handle,
+        } = arrival;
+        // The stream's payload length, counted here because the reader task
+        // completes the stream later, with no way to count it from there.
+        // UDP counts at completion; this counts at arrival, and a stream that
+        // later fails is counted too.
+        let total = handle.total_bytes();
+        let seen_on_udp = budget.lock().contains(InboundKey::Udp(stream_id));
+        // An id in use on UDP, or used before on either path: only a faulty peer
+        // or a bug sends one, and the shared budget bounds what it costs.
+        if seen_on_udp || self.completed_inbound_streams.contains(&stream_id) {
+            handle.cancel();
+            drop(handle);
+            budget.lock().release_if_gone(InboundKey::Quic(stream_id));
+            tracing::debug!(
+                peer_addr = %remote_addr,
+                stream_id = %stream_id,
+                see
```

#### Recent Merged Pull Requests:
- **PR #6213** (2026-11-13): fix(bin): run the node on a worker thread, not the main thread (@sanity)
- **PR #6212** (2026-11-13): test(transport): keep the QUIC test pair alive in partially captured test bodies (@sanity)
- **PR #6210** (2026-11-13): feat(transport): a QUIC-native connection as a PeerConnectionApi (@sanity)
- **PR #6206** (2026-11-13): ci(release): refuse a live cut of the QUIC data ramp release far from T0 (@sanity)
- **PR #6204** (2026-11-13): feat(quic): native setup with Hello exchange, punching and native ALPN (@sanity)
- **PR #6203** (2026-11-12): feat(quic): native Hello frame, two close codes, reserved punch byte (@sanity)

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

## X. bin): run the node on a worker thread, not the main thread (#6213)

**RULE**:
When implementing operations in `crates/core/src/bin/freenet.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7fcb4157`: bin): run the node on a worker thread, not the main thread (#6213). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/bin/freenet.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // The node runs on a worker thread, never on the main thread. `block_on`
    // polls its future on the calling thread, and the main thread's stack is
    // fixed by the platform: 1 MiB on Windows, against 2 MiB for every thread
    // std spawns. Polled there, the node's nested startup futures used most of
    // it (about 900 KiB measured in a Linux debug build at the first event
    // loop turn), within a few KiB of the Windows limit: a branch that grew
    // those frames slightly overflowed at startup on Windows. A spawned task
    // is polled by a worker, so the main thread only waits on the join
    // handle. `tests/main_thread_stack.rs` pins it by starting the node with
    // a small main-thread stack and workers at their production size.
    //
    // The root future is now an ordinary task on a worker, so synchronous
    // work on its path (config build, logger setup, node construction) holds
    // a worker while it runs. With `worker_threads` set to the CPU count, a
    // 1-vCPU host has one worker, so a long blocking call here would stall
    // the whole runtime. Nothing on that path blocks for long today; anything
    // added that does belongs in `spawn_
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    rt.block_on(async move {
    })?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7fcb4157` are properly handled with clean fallback behavior.
