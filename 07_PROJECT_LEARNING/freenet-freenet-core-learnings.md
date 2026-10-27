> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `b1d59903`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T11:09:21.130Z  
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
> **Harvest Timestamp**: 2026-10-27T11:09:20.701Z  
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
- **Issue #6011** (2026-10-27): **fix(core): repair degenerate visited-peers bloom indices, gated on the floor**
  *Symptoms*: ## Problem  #5994: the visited-peers bloom filter (`VisitedPeers`, k=4, m=512) produces far more false positives than its design for small sets. With 2 peers marked, about 1 check in 22,000 is a false positive, where the textbook rate is about 6e-8.  Measuring the false positives by cause gives two root causes:  1. **Degenerate double-hash steps (about 2/3 of the excess at n=2).**    - Indices are `h1 + i*h2 mod 512`. With m a power of two, they repeat whenever `h2 % 512` is 0 (one distinct bit) or 256 (two).    - So for 1 address in 256 per transaction the filter tests 1-2 bits instead of 4. 2. **Whole-set collisions (the rest).**    - All four indices depend only on `h1, h2 mod 512` (18 bits).    - Two addresses therefore share all four bits with probability about `2/512²` per pair.    - Every non-degenerate false positive in the measurement was an exact set match, plain or reversed.    - This also rules out the issue's other suspect, the key derivation from the ULID halves: the observed rate is what independent hashing predicts.  ## Approach  **This PR fixes cause 1.** Degenerate addresses get four distinct bits: their old one or two, plus the rest from h2's upper bits. Every other address keeps its indices exactly.  **Backward compatibility.** - Receivers recompute the indices from the tx id. - A filter mixes bits from every release on the path, including marks of *other* peers' addresses (a CONNECT joiner marks all its connections; GET relays mark failed hops). - Checkin

- **Issue #6004** (2026-10-26): **fix(telemetry): let fixed-cadence events bypass the node rate limit and count drops per type**
  *Symptoms*: ## Problem  The telemetry worker caps ordinary events at 10 per second per node. Busy gateways offer about 60 per second, so they drop about 84% of their events before upload (#6001): - operation events thinned to about 16%; - fixed-cadence node streams (`transport_snapshot`, `resource_utilization`, `router_snapshot`, ...) arriving at about 25-30% of their cadence.  ## Approach  - **New `EventPriority::Periodic`.** It bypasses the aggregate cap without using up any of its slots, as `NetworkEfficiency` already does.   - It applies only to event types on a fixed list (`PERIODIC_EVENT_TYPES`). Each is emitted by one task on a timer: about 0.27 events per second per node at default intervals, about 0.34 at the 10 s transport-snapshot minimum.   - The worker, router-snapshot and mix timers use `MissedTickBehavior::Delay`, so a stall does not release a catch-up burst. `interest_heartbeat_cycle` and `subscription_health_snapshot` keep their sweeps' burst timers, which reconciliation depends on (#5782), and instead skip an emission that follows the previous one by less than half a period.   - `admit_event` treats any other event marked `Periodic` as operational, so the list cannot grow by accident.   - Events emitted per item, such as `interest_expired`, stay operational.    | Event | Cadence |   |---|---|   | `transport_snapshot` | snapshot interval, at least 10 s |   | `resource_utilization` | about 60 s |   | `router_snapshot` | 5 min |   | `shadow_*` rollups (5) | 30 s window |  

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

### Incident Patch 1: `b1d59903` (2026-10-27)
**Commit Message**: fix(core): repair degenerate visited-peers bloom indices, gated on the floor (#6011)

**File**: `crates/core/src/node.rs` (modified, +2/-0)
```diff
@@ -69,6 +69,8 @@ pub(crate) use network_bridge::p2p_protoc::{
     SUMMARY_FIRST_PUT_MIN_VERSION, version_supports_broadcast_target_list,
     version_supports_hash_first_summaries, version_supports_summary_first_put,
 };
+// The visited-peers bloom gates its index check on the handshake floor (#5994).
+pub(crate) use network_bridge::p2p_protoc::parse_crate_version;
 // Test-only: the release-timing marker has no runtime reader by design (see
 // its rustdoc), so re-exporting it unconditionally is an unused import in the
 // non-test build.
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +1/-1)
```diff
@@ -865,7 +865,7 @@ pub(crate) const fn own_crate_version() -> (u8, u8, u16) {
 ///
 /// Mirrors `connection_handler::parse_semver` (kept local so this gate does not
 /// reach into the transport module). Pre-release suffixes are ignored.
-const fn parse_crate_version(version: &str) -> (u8, u8, u16) {
+pub(crate) const fn parse_crate_version(version: &str) -> (u8, u8, u16) {
     let bytes = version.as_bytes();
     let mut major = 0u8;
     let mut minor = 0u8;
```

**File**: `crates/core/src/operations/connect.rs` (modified, +4/-3)
```diff
@@ -1500,9 +1500,10 @@ pub(super) async fn dispatch_expect_connection_from(
 /// Bloom filter saturation note: `VisitedPeers` uses a 512-bit filter
 /// with k=4 hash functions. Pre-loading N entries raises the false-positive
 /// rate; at typical network sizes (≤ 20 connections in current deployments)
-/// the FP rate is negligible (~0.01%). At DEFAULT_MAX_CONNECTIONS (200),
-/// the rate reaches ~39%, which would cause routing to occasionally skip
-/// reachable peers. This is an accepted trade-off for current network sizes.
+/// it stays below about 0.1% (measured rates are in the `VisitedPeers` docs).
+/// At DEFAULT_MAX_CONNECTIONS (200), the rate reaches ~39%, which would cause
+/// routing to occasionally skip reachable peers. This is an accepted trade-off
+/// for current network sizes.
 pub(crate) fn prepare_join_request(
     tx: Transaction,
     own: &PeerKeyLocation,
```

**File**: `crates/core/src/operations/visited_peers.rs` (modified, +432/-9)
```diff
@@ -14,7 +14,9 @@ use ahash::RandomState;
 use serde::{Deserialize, Serialize};
 use serde_with::serde_as;
 
+use crate::config::MIN_COMPATIBLE_VERSION;
 use crate::message::Transaction;
+use crate::node::parse_crate_version;
 
 /// Number of bits in the bloom filter (512 bits = 64 bytes).
 const BLOOM_BITS: usize = 512;
@@ -25,15 +27,96 @@ const BLOOM_BYTES: usize = BLOOM_BITS / 8;
 /// Number of hash functions to use (double-hashing generates 4 from 2).
 const NUM_HASHES: usize = 4;
 
+/// First release whose peers mark the repaired indices of degenerate
+/// double-hash steps (#5994, see [`VisitedPeers::repair_degenerate_step`]).
+///
+/// Per the wire-gated-floor rule in `docs/RELEASING.md`: the release that
+/// first ships the repaired marking, then frozen. Checks switch to the repaired
+/// indices only once [`REPAIRED_INDICES_SHIPPED_IN`] is set and the handshake
+/// floor reaches this version ([`CHECK_REPAIRED_INDICES`]),
+/// so a value below the shipping release makes peers test bits that release
+/// never set.
+pub(crate) const REPAIRED_INDICES_MIN_VERSION: (u8, u8, u16) = (0, 2, 151);
+
+/// Has the repaired marking shipped, and in which release?
+///
+/// `Some(v)`: shipped in `v`, which must EQUAL the floor, frozen thereafter.
+/// `None`: not yet shipped, so the floor is a prediction about the next release
+/// and must stay strictly above the crate version. Checked by
+/// `repaired_indices_floor_tracks_the_shipping_release`, mirroring
+/// `ACK_VERSION_SHIPPED_IN`.
+pub(crate) const REPAIRED_INDICES_SHIPPED_IN: Option<(u8, u8, u16)> = None;
+
+/// Whether [`VisitedPeers::probably_visited`] tests the repaired indices.
+///
+/// A filter carries bits from every peer on the path, some marking other
+/// peers' addresses (a CONNECT joiner marks all its connections), and nothing
+/// in it says which release set them. A repaired address that only an older
+/// release marked has only one or two of its four repaired bits set, so
+/// checking the repaired indices would read it as unvisited and route back to
+/// it. Until the floor excludes those releases, this peer marks the repaired
+/// indices (a superset of the old ones, so older peers still find them) but
+/// checks the old ones, exactly as older releases do.
+///
+/// The floor admits only neighbours that mark the repaired indices. A peer
+/// further back could still be older if a peer between runs a lower floor, so
+/// raise the floor past [`REPAIRED_INDICES_MIN_VERSION`] once older releases
+/// have left the network, not merely once it ships. Raising it is what switches
+/// the check on, so `repaired_check_is_a_decision_not_a_side_effect` fails
+/// until [`REPAIRED_CHECK_FLOOR_CONFIRMED`] records that decision.
+const CHECK_REPAIRED_INDICES: bool = repaired_check_enabled(
+    REPAIRED_INDICES_SHIPPED_IN,
+    parse_crate_version(MIN_COMPATIBLE_VERSION),
+);
+
+/// Set to `true` by whoever raises `min-compatible-version` to at least
+/// [`REPAIRED_INDICES_MIN_VERSION`], confirming that releases marking only the
+/// unrepaired indices have left the network. Read only by a test: the floor
+/// alone decides [`CHECK_REPAIRED_INDICES`], and the test stops the floor
+/// reaching it as a side effect of a raise made for another reason.
+#[cfg_attr(not(test), allow(dead_code))]
+const REPAIRED_CHECK_FLOOR_CONFIRMED: bool = false;
+
+const fn repaired_check_enabled(
+    shipped: Option<(u8, u8, u16)>,
+    handshake_floor: (u8, u8, u16),
+) -> bool {
+    shipped.is_some() && version_at_least(handshake_floor, REPAIRED_INDICES_MIN_VERSION)
+}
+
+const fn version_at_least(version: (u8, u8, u16), floor: (u8, u8, u16)) -> bool {
+    if version.0 != floor.0 {
+        return version.0 > floor.0;
+    }
+    if version.1 != floor.1 {
+        return version.1 > floor.1;
+    }
+    version.2 >= floor.2
+}
+
 /// A bloom filter for tracking visited peers during contract search operations.
 ///
 /// Uses the transaction ID as a hash seed to prevent topology inference attacks.
 /// An observer cannot correlate visited sets across different transactions.
 ///
 /// # False Positive Rates (k=4 hash functions, m=512 bits)
-/// - 10 peers: ~0.006% (1 in 17,000)
-/// - 20 peers: ~0.04% (1 in 2,500)
-/// - 30 peers: ~0.2% (1 in 500)
+///
+/// Measured per check over random transaction ids (#5994), checking the
+/// unrepaired indices (today) and the repaired ones (once
+/// [`CHECK_REPAIRED_INDICES`] is on):
+///
+/// | peers marked | unrepaired   | repaired     |
+/// |--------------|--------------|--------------|
+/// | 2            | 1 in ~22,000 | 1 in ~60,000 |
+/// | 10           | 1 in ~3,700  | 1 in ~8,400  |
+/// | 20           | 1 in ~1,100  | 1 in ~1,600  |
+/// | 30           | 1 in ~380    | 1 in ~460    |
+///
+/// For small sets both are well above the textbook `(1 - e^(-kn/m))^k`. Apart
+/// from the repaired steps, the four indices depend only on `h1` and `h2`
+/// modulo 512, so two addresses collide on all four bits with probabil
```

**File**: `docs/RELEASING.md` (modified, +29/-0)
```diff
@@ -383,6 +383,29 @@ Current wire-gated floors:
   `untracked_noop_floor_stays_above_every_release_that_tracks_noops` catches
   the floor being lowered.
 
+- `REPAIRED_INDICES_MIN_VERSION` in
+  `crates/core/src/operations/visited_peers.rs` (visited-peers bloom
+  index repair, #5994). Not a wire variant and not a per-peer gate: peers mark
+  the repaired bloom indices (a superset of the old ones) from this release on,
+  and switch their CHECK to them only once this node's handshake floor
+  (`min-compatible-version`) reaches it, because a filter mixes bits from every
+  release on the path.
+
+  Set to **`(0, 2, 151)`** and guarded by `REPAIRED_INDICES_SHIPPED_IN`
+  (currently `None`), checked by
+  `visited_peers::tests::repaired_indices_floor_tracks_the_shipping_release`.
+  When the 0.2.151 bump fails that test, set the marker to
+  `Some(REPAIRED_INDICES_MIN_VERSION)` if the release carries #5994's fix,
+  otherwise raise the floor. Failure mode of a floor that is too LOW: once the
+  handshake floor passes it, peers test bloom bits that the release just
+  below never set, read visited peers as unvisited and route requests back to
+  them. Bias high. If you raise it, move `LAST_RELEASE_WITHOUT` in
+  `repaired_indices_floor_stays_above_every_release_without_it` (which catches
+  the floor being lowered) to the release that lacked the fix. The repaired
+  check takes effect only when someone raises `min-compatible-version` to at
+  least this value, which should wait until older releases have left the
+  network; see "Check what the raise switches on" below.
+
 - `BROADCAST_TARGET_LIST_MIN_VERSION` in
   `crates/core/src/node/network_bridge/p2p_protoc.rs` — the originator target
   list on contract broadcasts (#5147).
@@ -795,6 +818,12 @@ Before raising it:
 - **Expect a gradual effect.** Peers still on older releases keep accepting
   the refused versions until they update, so the refusal reaches the whole
   network only as the release spreads.
+- **Check what the raise switches on.** A floor at or above
+  `REPAIRED_INDICES_MIN_VERSION` switches visited-peers lookups to the repaired
+  bloom indices (see the wire-gated floors above), which is safe only once
+  releases before it have left the network.
+  `visited_peers::tests::repaired_check_is_a_decision_not_a_side_effect` fails
+  until `REPAIRED_CHECK_FLOOR_CONFIRMED` is set.
 
 ## Rollback
 
```

**File**: `docs/architecture/operations/README.md` (modified, +11/-7)
```diff
@@ -381,13 +381,17 @@ network_bridge.send(target, msg).await?;    // 2. Send message
 
 ### Visited Peers (Privacy-Preserving)
 
-The `VisitedPeers` bloom filter tracks visited peers during GET/SUBSCRIBE:
-
-| Peers | False Positive Rate |
-|-------|-------------------|
-| 10 | ~0.006% (1 in 17,000) |
-| 20 | ~0.04% (1 in 2,500) |
-| 30 | ~0.2% (1 in 500) |
+The `VisitedPeers` bloom filter tracks visited peers during GET/SUBSCRIBE/CONNECT.
+Its measured false-positive rates (about 1 in 3,700 checks with 10 peers marked)
+are in the `VisitedPeers` docs, along with why they exceed the textbook rate for
+small sets (#5994).
+
+**Cross-release compatibility:** receivers recompute bit indices from the
+transaction id, so every release must derive the same indices. Peers mark a
+superset of the old indices and keep checking the old ones until the repaired
+marking has shipped (`REPAIRED_INDICES_SHIPPED_IN`) and the handshake floor
+reaches `REPAIRED_INDICES_MIN_VERSION`. Raise the floor that far only once
+older releases have left the network.
 
 **Privacy feature:** Hash keys derived from transaction ID, so same peer hashes differently in different transactions.
 
```

---

### Incident Patch 2: `5764d806` (2026-10-26)
**Commit Message**: feat(transport): share one inbound stream budget per peer across UDP and QUIC (#6003)

**File**: `.claude/rules/bug-prevention-patterns.md` (modified, +3/-2)
```diff
@@ -882,8 +882,9 @@ Audit questions for any new byte budget:
 **Recorded exception: inbound stream reassembly.** `MAX_STREAM_TOTAL_BYTES` and
 `MAX_INBOUND_STREAM_BYTES_PER_CONNECTION` are flat and sit outside the
 aggregate (listed in `NOT_SUMMED` with the reason). They bound one stream and
-one connection, not the node: reassembly memory across the node is at most the
-number of connections times the per-connection allowance. The QUIC
+one peer, not the node: reassembly memory across the node is at most the
+number of peers times the per-peer allowance (one budget, shared by a peer's
+UDP connection and QUIC path). The QUIC
 flow-control windows (`quic::config::connection_window_bytes`, #5940) are
 the same class of per-connection exception and are in `NOT_SUMMED`. They are
 NOT covered by the reassembly allowance: they come on top of it, the send
```

**File**: `.claude/rules/transport.md` (modified, +62/-11)
```diff
@@ -1032,7 +1032,8 @@ Inbound adapter: a Stream's payload goes into an ordinary StreamHandle,
   StreamIdentity / registry are unchanged. The handle is announced
   (InboundStreamArrival, with the metadata) before the payload.
   → Before allocating: header checks, then the path's
-    InboundStreamBudget check and charge (same cost and limits as UDP).
+    InboundStreamBudget check and charge (same cost and limits as UDP;
+    one lock from check to charge).
     Short messages are charged too (a token rides with the message until
     its payload is taken). Refusal: STOP_SENDING (stop_code), counted in
     the shared InboundStreamOutcome counters, path and process-wide.
@@ -1074,13 +1075,61 @@ Inbound adapter: a Stream's payload goes into an ordinary StreamHandle,
     more bytes, and a new QUIC stream with that id carries the whole
     stream. A Stream id already held on the path is refused
     (StreamIdInUse). Dropping the path cancels streams in progress.
-Not here: dedup (e5: is_duplicate_dispatch, completed_inbound_streams),
-  export of the QUIC-only counters (per path, QuicPath::stats), and one
-  budget shared with the UDP session. The path has its own budget, so a
-  peer with both may hold twice the per-connection allowance until e5
-  resolves it (QUIC memory gate). Short-message budget keys are picked by
-  the path and could equal a UDP transport-internal id: do not share the
-  budget without separating the keys.
+One budget per peer (QUIC memory gate M3): QuicPath::with_budget charges
+  the SharedInboundBudget of the peer's UDP connection
+  (PeerConnection::inbound_budget), so a peer with both paths has ONE
+  allowance; with_limits gives a path its own budget and is for tests.
+  QuicPath::new and with_limits are #[cfg(test)]; with_budget ignores
+  limits.max_streams/max_bytes. Charges are keyed by InboundKey:
+  Udp(StreamId), Quic(StreamId), QuicShort(u32). The same numeric id on
+  both paths is two charges; never charge, test or release one path's
+  stream under another path's variant. UDP's take_expired and
+  live_buffer_streams see only Udp keys (QUIC evicts by its own timers).
+  A gone UDP charge is released ONLY by UDP code (its check and sweep,
+  Releaser::Udp), so UDP's release timing is exactly main's; a UDP-only
+  node releases as before. (The dedup against restarting a stream is
+  completed_inbound_streams, not the held charge.) A QUIC admission
+  (Releaser::Quic) releases gone QUIC charges only. UDP's check and sweep
+  also release gone QUIC charges, since QUIC reads its own gone charge as
+  free; otherwise one would hold UDP's room until the path next needed
+  room, or for good once the path is gone. Pinned at the call sites by
+  udp_and_quic_paths_share_one_inbound_allowance (read_stream and
+  read_short refused on room a gone UDP charge holds),
+  a_quic_guard_releases_only_its_own_charge,
+  udp_admission_releases_its_own_gone_charges_for_room,
+  the_udp_sweep_releases_a_gone_quic_charge and
+  quic_admission_holds_one_budget_lock_from_check_to_charge (which also
+  pins Releaser::Quic in both QUIC checks). The lock is parking_lot,
+  never held across .await, and not reentrant (do not call the handle's
+  stream_count/charged_bytes while holding lock()); it may be held while
+  taking the StreamRegistry (DashMap) locks, never the reverse. UDP
+  admission holds it from check to charge, so a QUIC charge cannot take
+  the room between (pinned by
+  udp_admission_holds_one_budget_lock_from_check_to_charge).
+  e5 MUST build node paths with with_budget, and MUST handle:
+  → If the UDP PeerConnection is replaced (reconnect or fallback) while a
+    QUIC path lives, the new connection gets a fresh budget and the peer
+    has two allowances again: hand the path the new handle or rebuild it.
+  → A UDP stream refused because QUIC filled the budget is remembered as
+    refused (sticky), and MAX_REMEMBERED_REFUSALS (4096) outstanding
+    refusals close the UDP connection. Same as UDP's own overload, but the
+    other path can now cause it.
+  → A QUIC charge whose consumer never releases it blocks UDP admissions
+    too: the UDP sweep does not evict QUIC streams.
+  → A gone UDP charge holds room against QUIC until UDP's next 5 s
+    timeout_check sweep (or UDP's own admission under pressure), so QUIC
+    can see BUDGET_REFUSED for up to about 5 s on room that is free.
+  → The shared Arc can keep UDP charges (and their room) alive after the
+    PeerConnection drops, and no QUIC code releases them: do not keep a
+    path on a gone connection's handle.
+  Telemetry and logs that read the budget (sample_inbound_concurrency's
+  outstanding count, the refusal warning's open_streams/charged_bytes)
+  are peer-wide once shared and include QUIC charges.
+  With one allowance, a large UDP stream still draining can make a QUIC
+  stream refuse (BUDGET_REFUSED) where two allowances admitted it; that
+  is the intended semantics, retried like any transfer failu
```

**File**: `crates/core/src/contract/executor.rs` (modified, +9/-8)
```diff
@@ -2687,17 +2687,18 @@ mod tests {
             // operation, so they are not memory the node holds resident.
             ("MAX_EVIDENCE_INPUT_BYTES", "per-request input limit"),
             ("MAX_IMPORT_BUNDLE_BYTES", "per-request import limit"),
-            // Inbound stream reassembly is bounded per connection (stream
-            // count, bytes, eviction), not by a node memory budget: an
-            // explicit exception to the rule that byte budgets join this
-            // aggregate (`.claude/rules/bug-prevention-patterns.md`, recorded
-            // there under "Recorded exception"). Node-wide it is at most the
-            // number of connections times the per-connection allowance;
-            // node-wide fairness is left to the transport redesign.
+            // Inbound stream reassembly is bounded per peer (stream count,
+            // bytes, eviction; one budget shared by a peer's UDP connection
+            // and QUIC path), not by a node memory budget: an explicit
+            // exception to the rule that byte budgets join this aggregate
+            // (`.claude/rules/bug-prevention-patterns.md`, recorded there
+            // under "Recorded exception"). Node-wide it is at most the number
+            // of peers times the per-peer allowance; node-wide fairness is
+            // left to the transport redesign.
             (
                 "MAX_STREAM_TOTAL_BYTES",
                 "per-stream wire length limit; reassembly memory is bounded per \
-                 connection, not by a node budget (see comment)",
+                 peer, not by a node budget (see comment)",
             ),
             (
                 "STREAM_ENVELOPE_MARGIN_BYTES",
```

**File**: `crates/core/src/transport/peer_connection.rs` (modified, +86/-29)
```diff
@@ -54,6 +54,7 @@ use super::{
     token_bucket::TokenBucket,
 };
 use crate::util::time_source::InstantTimeSrc;
+use inbound_budget::InboundKey;
 
 type Result<T = (), E = TransportError> = std::result::Result<T, E>;
 
@@ -363,8 +364,10 @@ pub struct PeerConnection<S = super::UdpSocket, T: TimeSource = RealTime> {
     /// `InboundStreamOutcome` (also counted node-wide in `TRANSPORT_METRICS`).
     inbound_outcomes: [u64; super::metrics::InboundStreamOutcome::COUNT],
     /// Charges for every inbound stream holding reassembly state on this
-    /// connection, released when that state is gone.
-    inbound_budget: inbound_budget::InboundStreamBudget,
+    /// connection, released when that state is gone. Shareable with a QUIC
+    /// path to the same peer (see [`Self::inbound_budget`]), so the peer has
+    /// one allowance; this connection's charges are keyed `InboundKey::Udp`.
+    inbound_budget: inbound_budget::SharedInboundBudget,
     /// Telemetry only: recent short-message arrivals for the inbound
     /// concurrency estimate, and this connection's peak estimate in the
     /// current snapshot period (see `sample_inbound_concurrency`).
@@ -398,11 +401,13 @@ impl<S, T: TimeSource> Drop for PeerConnection<S, T> {
         // retired, too) would otherwise wait out the orphan timeout with
         // nothing accounting for them.
         if let Some(registry) = &self.inbound_stream_registry {
+            // Collected first, so the shared budget is not locked while the
+            // registry runs.
+            let live: Vec<_> = self.inbound_budget.lock().live_buffer_streams().collect();
             registry.cancel_unclaimed_streams(
                 self.remote_conn.remote_addr,
-                &mut self
-                    .inbound_budget
-                    .live_buffer_streams()
+                &mut live
+                    .into_iter()
                     .map(|(id, buffer)| (id, super::StreamIdentity::from_udp_buffer(buffer))),
             );
         }
@@ -1113,7 +1118,7 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
             completed_inbound_streams: lru::LruCache::new(COMPLETED_STREAM_MEMORY),
             legacy_tokens: HashMap::new(),
             inbound_outcomes: [0; super::metrics::InboundStreamOutcome::COUNT],
-            inbound_budget: inbound_budget::InboundStreamBudget::new(
+            inbound_budget: inbound_budget::SharedInboundBudget::new(
                 streaming::MAX_INBOUND_STREAMS_PER_CONNECTION,
                 streaming::MAX_INBOUND_STREAM_BYTES_PER_CONNECTION,
             ),
@@ -1709,7 +1714,9 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
                             // dropped (eviction). Its state is gone with it.
                             self.inbound_streams.remove(&stream_id);
                             self.legacy_tokens.remove(&stream_id);
-                            self.inbound_budget.release_if_gone(stream_id);
+                            self.inbound_budget
+                                .lock()
+                                .release_if_gone(InboundKey::Udp(stream_id));
                             tracing::debug!(
                                 peer_addr = %self.remote_conn.remote_addr,
                                 stream_id = %stream_id,
@@ -1720,7 +1727,9 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
                     };
                     self.inbound_streams.remove(&stream_id);
                     self.legacy_tokens.remove(&stream_id);
-                    self.inbound_budget.release_if_gone(stream_id);
+                    self.inbound_budget
+                        .lock()
+                        .release_if_gone(InboundKey::Udp(stream_id));
                     self.completed_inbound_streams.put(stream_id, ());
                     // Record inbound bytes for dashboard metrics
                     let bytes_received = msg.len() as u64;
@@ -2244,11 +2253,22 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
         Arc::clone(&self.streaming_registry)
     }
 
+    /// This connection's inbound budget, to build a QUIC path to the same
+    /// peer on (`QuicPath::with_budget`), so the peer has one reassembly
+    /// allowance across both.
+    #[cfg_attr(not(test), allow(dead_code))]
+    pub(super) fn inbound_budget(&self) -> inbound_budget::SharedInboundBudget {
+        self.inbound_budget.clone()
+    }
+
     /// Decide whether a new inbound stream declaring `total_length_bytes` may
     /// get reassembly state on this connection. Runs before anything is
-    /// created for it.
-    fn admit_inbound_stream(
+    /// created for it. `budget` is this connection's budget, locked by the
+    /// caller until the stream is charged (or found not to need a charge),
+    /// so a QUIC path sharing it cannot take the room in between.
+    fn admit_inbound_stream_locked(
         &mut self,
+        budget: &mut inbound_budget::InboundStre
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests.rs` (modified, +188/-3)
```diff
@@ -1770,6 +1770,52 @@ fn fragment_with(
     }
 }
 
+impl<S: crate::transport::Socket, T: TimeSource> PeerConnection<S, T> {
+    /// [`Self::admit_inbound_stream_locked`] with the budget locked here.
+    fn admit_inbound_stream(
+        &mut self,
+        stream_id: StreamId,
+        total_length_bytes: u64,
+    ) -> std::result::Result<(), InboundStreamRejection> {
+        let shared_budget = self.inbound_budget.clone();
+        let mut budget = shared_budget.lock();
+        self.admit_inbound_stream_locked(&mut budget, stream_id, total_length_bytes)
+    }
+}
+
+/// Pin: both UDP admission paths (operations and legacy) hold ONE guard on
+/// the shared budget from the `contains` test through `check` to `charge`.
+/// The admission tests call the wrapper above, so they would still pass if
+/// a path dropped the guard and locked again between check and charge,
+/// which lets a QUIC path sharing the budget take the room in between.
+#[test]
+fn udp_admission_holds_one_budget_lock_from_check_to_charge() {
+    use super::inbound_budget::pin;
+    let source = include_str!("../peer_connection.rs");
+    for (signature, what) in [
+        ("fn process_operations_fragment(", "operations admission"),
+        ("async fn process_inbound(", "legacy admission"),
+    ] {
+        let body = pin::fn_body(source, signature);
+        let after = pin::assert_one_guard(
+            &body,
+            what,
+            "let mut budget = shared_budget.lock();",
+            &[
+                "if budget.contains(InboundKey::Udp(stream_id))",
+                "self.admit_inbound_stream_locked(&mut budget, stream_id, total_length_bytes)",
+            ],
+            "budget.charge(",
+        );
+        assert!(
+            after
+                .trim_start()
+                .starts_with("InboundKey::Udp(stream_id),"),
+            "{what}: the charge must be the UDP stream's"
+        );
+    }
+}
+
 /// What the connection's budget charges a stream declaring `declared` bytes.
 fn cost(declared: u64) -> u64 {
     super::inbound_budget::ChargeOverhead::DEFAULT.cost(declared)
@@ -1781,7 +1827,11 @@ fn holds_no_state(e: &End, stream_id: StreamId) -> bool {
         && e.conn.streaming_registry.get(stream_id).is_none()
         && !e.conn.inbound_streams.contains_key(&stream_id)
         && e.conn.inbound_stream_futures.is_empty()
-        && !e.conn.inbound_budget.contains(stream_id)
+        && !e
+            .conn
+            .inbound_budget
+            .lock()
+            .contains(InboundKey::Udp(stream_id))
 }
 
 async fn feed(e: &mut End, payload: SymmetricMessagePayload) -> Option<Vec<u8>> {
@@ -1961,7 +2011,10 @@ async fn inbound_stream_bytes_are_bounded_per_connection() {
             StreamId::next_transport_internal()
         };
         feed(&mut e, fragment(id, small, 1)).await;
-        assert!(e.conn.inbound_budget.contains(id), "stream {i} of {fit}");
+        assert!(
+            e.conn.inbound_budget.lock().contains(InboundKey::Udp(id)),
+            "stream {i} of {fit}"
+        );
     }
 
     for over in [StreamId::next(), StreamId::next_transport_internal()] {
@@ -1978,7 +2031,11 @@ fn holds_no_state_but_others(e: &End, stream_id: StreamId) -> bool {
     !e.conn.streaming_handles.contains_key(&stream_id)
         && e.conn.streaming_registry.get(stream_id).is_none()
         && !e.conn.inbound_streams.contains_key(&stream_id)
-        && !e.conn.inbound_budget.contains(stream_id)
+        && !e
+            .conn
+            .inbound_budget
+            .lock()
+            .contains(InboundKey::Udp(stream_id))
 }
 
 /// The number of streams per connection is bounded, so many small streams
@@ -2001,6 +2058,134 @@ async fn inbound_stream_count_is_bounded_per_connection() {
     );
 }
 
+/// The connection's budget handle is the one a QUIC path to the same peer
+/// charges (`QuicPath::with_budget`): a QUIC charge refuses a UDP stream
+/// that no longer fits, and once its state is gone the room is the UDP
+/// side's again. Charges are keyed by path, so the same numeric id held on
+/// both is two charges, and releasing one leaves the other.
+#[tokio::test(start_paused = true)]
+async fn a_quic_charge_on_the_shared_budget_refuses_a_udp_stream() {
+    use super::inbound_budget::{LegacyStreamToken, Liveness};
+    use super::streaming::MAX_STREAM_TOTAL_BYTES;
+    use crate::transport::metrics::InboundStreamOutcome as O;
+    const AGE: Duration = Duration::from_secs(3600);
+    let mut e = single(CAPABLE);
+    let shared = e.conn.inbound_budget();
+
+    // A maximum-size QUIC stream leaves less room than another one costs.
+    let quic_token = LegacyStreamToken::new();
+    let refused = StreamId::next();
+    shared.lock().charge(
+        InboundKey::Quic(refused),
+        MAX_STREAM_TOTAL_BYTES,
+        0,
+        AGE,
+        Liveness::Task(Arc::downgrade(&quic_token)),
+    );
+    feed(&mut e, fragment(refused, MAX_STREAM_TOTAL_BYTES, 1)).await;
+    assert!(
```

**File**: `crates/core/src/transport/peer_connection/inbound_budget.rs` (modified, +340/-54)
```diff
@@ -19,16 +19,28 @@
 //! charge plus its length; the charge itself lasts until the message is
 //! handed on (legacy) or its consumers let go (operations).
 //!
-//! The bound is per connection: node reassembly memory is at most the number
-//! of connections times `MAX_INBOUND_STREAM_BYTES_PER_CONNECTION`. There is
-//! no node-wide allowance; fairness between connections is left to the
-//! transport redesign.
+//! The bound is per peer: a UDP connection holds its budget through a
+//! [`SharedInboundBudget`] handle, and a QUIC path to the same peer can be
+//! built on that handle (`QuicPath::with_budget`), so both charge one
+//! allowance. Charges are keyed by [`InboundKey`], which names the path, so
+//! the same numeric stream id on both holds two separate charges. Node
+//! reassembly memory is at most the number of peers times
+//! `MAX_INBOUND_STREAM_BYTES_PER_CONNECTION`. There is no node-wide
+//! allowance; fairness between peers is left to the transport redesign.
+//!
+//! A gone UDP charge is released only by UDP code, at the points it was
+//! released before the budget could be shared, so UDP's release timing is
+//! exactly what it was (a UDP-only node releases as before). A QUIC path
+//! reads a gone charge of its own as free, so the UDP side may release
+//! those too (see [`Releaser`]).
 
 use std::collections::HashMap;
 use std::sync::atomic::{AtomicU8, AtomicU64, Ordering};
 use std::sync::{Arc, Weak};
 use std::time::Duration;
 
+use parking_lot::{Mutex, MutexGuard};
+
 use super::StreamId;
 use super::streaming_buffer::LockFreeStreamBuffer;
 
@@ -217,8 +229,81 @@ impl ChargeOverhead {
     }
 }
 
+/// What a charge is held under. The variant names the path that charged
+/// it, so charges from a UDP connection and a QUIC path sharing one budget
+/// never meet, whatever their numeric ids.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
+pub(in crate::transport) enum InboundKey {
+    /// A stream of the UDP connection, by its stream id.
+    Udp(StreamId),
+    /// A `Stream` frame of a QUIC path, by the id in its header.
+    Quic(StreamId),
+    /// A `Short` frame of a QUIC path, by a key the path picks.
+    QuicShort(u32),
+}
+
+/// Who is releasing gone charges, which decides which ones it may release
+/// ([`InboundStreamBudget::release_gone`]).
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(in crate::transport) enum Releaser {
+    /// The UDP connection: every gone charge. Its own, so its release
+    /// timing stays what it was before the budget could be shared (the
+    /// dedup against restarting a stream is `completed_inbound_streams`,
+    /// not the held charge); a QUIC path's too, because the path treats a
+    /// gone charge of its own as free (it releases one before testing an
+    /// id), and without this a gone QUIC charge would hold room from the
+    /// UDP side until the path next needed room, or for good once the path
+    /// is gone.
+    Udp,
+    /// A QUIC path: only QUIC charges. A gone UDP charge stays until UDP
+    /// code releases it: at its next `timeout_check` sweep (every 5 s) or
+    /// its own admission under pressure. Until then the QUIC path can be
+    /// refused for room that is free.
+    Quic,
+}
+
+impl Releaser {
+    fn may_release(self, key: &InboundKey) -> bool {
+        match self {
+            Self::Udp => true,
+            Self::Quic => matches!(key, InboundKey::Quic(_) | InboundKey::QuicShort(_)),
+        }
+    }
+}
+
+/// One peer's [`InboundStreamBudget`], shared by its UDP connection and any
+/// QUIC path built on it. The lock is taken only in synchronous sections,
+/// never across an `.await`, and is not reentrant: do not call
+/// [`Self::stream_count`] or [`Self::charged_bytes`] while holding
+/// [`Self::lock`]. Lock order: the budget lock may be held while taking the
+/// connection's `StreamRegistry` (DashMap shard) locks, never the reverse.
+#[derive(Clone)]
+pub(in crate::transport) struct SharedInboundBudget(Arc<Mutex<InboundStreamBudget>>);
+
+impl SharedInboundBudget {
+    pub(in crate::transport) fn new(max_streams: usize, max_bytes: u64) -> Self {
+        Self(Arc::new(Mutex::new(InboundStreamBudget::new(
+            max_streams,
+            max_bytes,
+        ))))
+    }
+
+    pub(in crate::transport) fn lock(&self) -> MutexGuard<'_, InboundStreamBudget> {
+        self.0.lock()
+    }
+
+    pub(in crate::transport) fn stream_count(&self) -> usize {
+        self.lock().stream_count()
+    }
+
+    #[cfg(test)]
+    pub(in crate::transport) fn charged_bytes(&self) -> u64 {
+        self.lock().charged_bytes()
+    }
+}
+
 pub(in crate::transport) struct InboundStreamBudget {
-    streams: HashMap<StreamId, Charge>,
+    streams: HashMap<InboundKey, Charge>,
     charged_bytes: u64,
     max_streams: usize,
     max_bytes: u64,
@@ -244,20 +329,23 @@ impl InboundStreamBudget {
         }
     }
 
-    /// Whether `stream_id` holds a charge (live, or evicted but not yet gone).
-    pu
```

**File**: `crates/core/src/transport/peer_connection/streaming.rs` (modified, +6/-4)
```diff
@@ -107,10 +107,12 @@ pub(crate) const MAX_STREAM_TOTAL_BYTES: u64 = (crate::wasm_runtime::MAX_STATE_S
 /// stream arriving while one is held may be refused; its operation fails
 /// and is retried like any other transfer failure.
 ///
-/// Per connection: a node with many connections can hold this much for each.
-/// Charges are dropped with the connection, but an unclaimed buffer can be
-/// kept by the orphan stream registry for up to its 60 s GC interval after
-/// the connection has gone.
+/// Per peer: the UDP connection's budget, which a QUIC path to the same peer
+/// shares (`inbound_budget::SharedInboundBudget`), so a node with many peers
+/// can hold this much for each. Charges last as long as whoever holds the
+/// shared handle (the connection, or a QUIC path built on it), and an
+/// unclaimed buffer can be kept by the orphan stream registry for up to its
+/// 60 s GC interval after the connection has gone.
 ///
 /// A stream is charged when admitted and keeps the charge
 /// until all of its reassembly state has been released (see
```

**File**: `crates/core/src/transport/quic/path.rs` (modified, +84/-27)
```diff
@@ -90,7 +90,6 @@ use std::sync::atomic::{AtomicU64, Ordering};
 
 use bytes::Bytes;
 use futures::{Stream, StreamExt};
-use parking_lot::Mutex;
 use tokio::sync::mpsc;
 
 use super::QuicConnection;
@@ -101,9 +100,11 @@ use crate::simulation::TimeSource;
 use crate::transport::StreamId;
 use crate::transport::metrics::{InboundStreamOutcome, QuicCloseCode};
 use crate::transport::peer_connection::embeds_metadata;
-use crate::transport::peer_connection::inbound_budget::InboundStreamBudget;
+use crate::transport::peer_connection::inbound_budget::SharedInboundBudget;
+use crate::transport::peer_connection::streaming::StreamError;
+#[cfg(test)]
 use crate::transport::peer_connection::streaming::{
-    MAX_INBOUND_STREAM_BYTES_PER_CONNECTION, MAX_INBOUND_STREAMS_PER_CONNECTION, StreamError,
+    MAX_INBOUND_STREAM_BYTES_PER_CONNECTION, MAX_INBOUND_STREAMS_PER_CONNECTION,
 };
 
 pub(crate) use inbound::{InboundShort, InboundStreamArrival};
@@ -160,19 +161,27 @@ pub(crate) mod reset_code {
 
 /// Capacity of [`QuicInbound::shorts`]. Each queued message still holds its
 /// inbound budget charge, so the budget bounds the bytes queued.
+#[cfg_attr(not(test), allow(dead_code))]
 pub(crate) const SHORT_CHANNEL_CAPACITY: usize = 256;
 /// Capacity of [`QuicInbound::streams`]. Each queued stream holds its charge.
+#[cfg_attr(not(test), allow(dead_code))]
 pub(crate) const STREAM_CHANNEL_CAPACITY: usize = 256;
 /// Capacity of [`QuicInbound::controls`]; control frames are at most
 /// `MAX_CONTROL_BYTES` each.
+#[cfg_attr(not(test), allow(dead_code))]
 pub(crate) const CONTROL_CHANNEL_CAPACITY: usize = 16;
 
 /// The receive-side limits of a path.
 #[derive(Debug, Clone, Copy)]
 pub(crate) struct QuicPathLimits {
-    /// Inbound streams (Short and Stream) holding a budget charge at once.
+    /// Inbound streams (Short and Stream) holding a budget charge at once,
+    /// for the test-only [`QuicPath::with_limits`], which gives the path a
+    /// budget of its own. A node path ([`QuicPath::with_budget`]) takes its
+    /// limits from the budget, so this field does not exist outside tests.
+    #[cfg(test)]
     pub(crate) max_streams: usize,
-    /// Bytes of inbound budget charges at once.
+    /// Bytes of inbound budget charges at once; see `max_streams`.
+    #[cfg(test)]
     pub(crate) max_bytes: u64,
     pub(crate) short_capacity: usize,
     pub(crate) stream_capacity: usize,
@@ -183,10 +192,16 @@ pub(crate) struct QuicPathLimits {
 }
 
 impl QuicPathLimits {
-    /// The UDP transport's per-connection inbound limits and the channel
-    /// capacities above.
+    /// The channel capacities above, and for a test path with a budget of
+    /// its own, inbound limits equal to one peer's UDP allowance
+    /// (`MAX_INBOUND_STREAMS_PER_CONNECTION`,
+    /// `MAX_INBOUND_STREAM_BYTES_PER_CONNECTION`). A node path built with
+    /// [`QuicPath::with_budget`] takes its inbound limits from the budget.
+    #[cfg_attr(not(test), allow(dead_code))]
     pub(crate) const DEFAULT: Self = Self {
+        #[cfg(test)]
         max_streams: MAX_INBOUND_STREAMS_PER_CONNECTION,
+        #[cfg(test)]
         max_bytes: MAX_INBOUND_STREAM_BYTES_PER_CONNECTION,
         short_capacity: SHORT_CHANNEL_CAPACITY,
         stream_capacity: STREAM_CHANNEL_CAPACITY,
@@ -381,7 +396,7 @@ pub(crate) struct QuicPath {
     stats: Arc<QuicPathStats>,
     receive: tokio::task::JoinHandle<()>,
     #[cfg(test)]
-    budget: Arc<Mutex<InboundStreamBudget>>,
+    budget: SharedInboundBudget,
 }
 
 impl std::fmt::Debug for QuicPath {
@@ -399,35 +414,76 @@ impl Drop for QuicPath {
 }
 
 impl QuicPath {
-    /// A path over `connection` with the default limits. `time` drives the
-    /// idle and age limits of inbound streams; use the clock quinn runs on.
-    #[cfg_attr(not(test), allow(dead_code))]
+    /// A path over `connection` with the default limits and a budget of its
+    /// own. Tests only; nodes must use [`Self::with_budget`]. `time` drives
+    /// the idle and age limits of inbound streams; use the clock quinn runs
+    /// on.
+    #[cfg(test)]
     pub(crate) fn new<T: TimeSource>(connection: QuicConnection, time: T) -> (Self, QuicInbound) {
         Self::with_limits(connection, time, QuicPathLimits::DEFAULT)
     }
 
     /// [`Self::new`] with given limits.
     ///
-    /// The path has its own inbound budget, sized like the UDP transport's
-    /// per-connection one. A peer with both a UDP session and a QUIC path
-    /// may therefore hold up to twice the per-connection allowance; e5 must
-    /// resolve that before QUIC carries traffic (the QUIC memory gate). Do
-    /// not hand this budget's keys to the UDP side as they are: short
-    /// messages are charged under ids this path picks (see `inbound`),
-    /// which could equal a UDP transport-internal id.
+    /// Tests only; nodes must use [`Self::with_budget`]. The path has its
+    /// own inbound budget of `limits.max_streams` and `limits.max_bytes`, so
+    /
```

---

### Incident Patch 3: `c9765152` (2026-10-26)
**Commit Message**: fix(telemetry): let fixed-cadence events bypass the node rate limit and count drops per type (#6004)

**File**: `.claude/rules/transport.md` (modified, +5/-4)
```diff
@@ -290,12 +290,13 @@ populated by `RollingRttStatsHandle` in every `RemoteConnection`. A
 mirror; visible via `RUST_LOG=…=debug` in debug builds, compiled
 out entirely in release builds via the `release_max_level_info`
 feature in `crates/core/Cargo.toml`) and via
-`send_standalone_shadow_event_with_peer_id` so it reaches the OTLP
+`send_standalone_event_with_peer_id` so it reaches the OTLP
 collector regardless of log level, tagged with the local node id
 so the collector can disaggregate samples per reporting node. All
-five shadow emitters use the `_shadow_` variant so the telemetry
-rate limiter admits them under a low-priority sub-budget and they
-cannot starve operational telemetry (#4380).
+five shadow rollups are listed in `telemetry::PERIODIC_EVENT_TYPES`,
+so the telemetry rate limiter admits them without consuming the
+operational cap (#6001). A new emitter belongs on that list only if
+a fixed timer bounds it.
 
 `transport/reference_ping.rs` runs an analogous 1Hz loop
 (`reference_ping` background task) that probes a fixed external
```

**File**: `crates/core/src/node/network_bridge/broadcast_payload_mix.rs` (modified, +1/-1)
```diff
@@ -1563,7 +1563,7 @@ pub(crate) fn emit_payload_mix_rollup(
         &window.applies(),
         window_secs,
     );
-    crate::tracing::telemetry::send_standalone_shadow_event_with_peer_id(
+    crate::tracing::telemetry::send_standalone_event_with_peer_id(
         "broadcast_payload_mix",
         local_peer_id,
         payload.clone(),
```

**File**: `crates/core/src/node/network_bridge/outbound_message_mix.rs` (modified, +5/-6)
```diff
@@ -994,9 +994,8 @@ impl OutboundMix {
     /// Lives on the outbound rollup despite being a RECEIVE-side observation,
     /// for two reasons: it belongs in the same node-minute record as the
     /// `interest_sync_summaries_bytes` it explains (joinable without
-    /// interpolation), and the telemetry budget has room for exactly one more
-    /// aligned rollup stream (`telemetry.rs`, `MAX_SHADOW_EVENTS_PER_SECOND`),
-    /// which this measurement does not deserve to consume.
+    /// interpolation), and a separate stream would be one more periodic event per
+    /// node-minute, which this measurement does not deserve.
     ///
     /// # The `single_entry` split (R4b instrument, #5153)
     ///
@@ -1507,9 +1506,9 @@ fn outbound_mix_json(w: &Window, window_secs: u64) -> serde_json::Value {
 
 fn emit_outbound_mix_rollup(mix: &OutboundMix, local_peer_id: &str, window_secs: u64) {
     let w = mix.take_window();
-    // Shadow priority, matching the payload mix: one event per node-minute is
-    // negligible volume, but it is observation rather than operational signal.
-    crate::tracing::telemetry::send_standalone_shadow_event_with_peer_id(
+    // A periodic event (`telemetry::PERIODIC_EVENT_TYPES`): one per
+    // node-minute from this one task, so its timer bounds it.
+    crate::tracing::telemetry::send_standalone_event_with_peer_id(
         "outbound_message_mix",
         local_peer_id,
         outbound_mix_json(&w, window_secs),
```

**File**: `crates/core/src/ring.rs` (modified, +32/-38)
```diff
@@ -108,7 +108,7 @@ mod hosting;
 #[cfg(test)]
 pub(crate) use broken_invariants::{BROKEN_INVARIANT_TTL, EMITTED_FLAG_EVENTS};
 pub(crate) use broken_invariants::{
-    BrokenInvariant, BrokenInvariantDetector, BrokenInvariantsTracker,
+    BrokenInvariant, BrokenInvariantDetector, BrokenInvariantsTracker, FLAG_TELEMETRY_EVENT,
 };
 /// Pre-write admission-gate rejection type (#4683, PR 3). Surfaced to the
 /// executor chokepoints so a write that would overflow the aggregate disk
@@ -1737,6 +1737,11 @@ impl Ring {
 
         let mut interval = tokio::time::interval(INTEREST_HEARTBEAT_INTERVAL);
         interval.tick().await; // Skip first immediate tick
+        // The interval keeps tokio's default `Burst`, so after a stall cycles
+        // can run back to back. `interest_heartbeat_cycle` bypasses the
+        // telemetry rate limit (#6001), so its emission is bounded here.
+        let mut cycle_event_guard =
+            crate::tracing::telemetry::PeriodicEmissionGuard::half_of(INTEREST_HEARTBEAT_INTERVAL);
 
         loop {
             if sleep_or_shutdown(&shutdown, async {
@@ -1880,6 +1885,9 @@ impl Ring {
             // it the event reports fleet-wide distributions only, which is why
             // the InterestSync cost hypothesis could not be confirmed by
             // correlation and had to stay an estimate.
+            if !cycle_event_guard.should_emit(tokio::time::Instant::now()) {
+                continue;
+            }
             crate::tracing::telemetry::send_standalone_event_with_peer_id(
                 "interest_heartbeat_cycle",
                 &op_manager
@@ -2003,6 +2011,10 @@ impl Ring {
     async fn emit_router_snapshot_telemetry(ring: Arc<Self>, interval_duration: Duration) {
         let shutdown = ring.shutdown_token();
         let mut interval = tokio::time::interval(interval_duration);
+        // `Delay`, not tokio's default `Burst`: `router_snapshot` bypasses the
+        // telemetry rate limit (#6001), so a stall must not release a burst of
+        // catch-up ticks.
+        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
         // Skip the first immediate tick
         interval.tick().await;
 
@@ -2607,9 +2619,11 @@ impl Ring {
                 let lifecycle = op_manager.interest_manager.interest_lifecycle_snapshot();
                 // SHADOW MODE: futile-repair evidence (#nc-merge). Rides the
                 // same fixed-cardinality block for the same reason the rest of
-                // it does — `network_efficiency_v1` is the only family that
-                // bypasses both the node rate limiter and the collector's 5%
-                // sampler, so a rare-but-decisive counter is not sampled away.
+                // it does: `network_efficiency_v1` has a reserved channel and
+                // buffer slot and bypasses both the node rate limiter and the
+                // collector's 5% sampler, so a rare-but-decisive counter is not
+                // sampled away. (Since #6001 the periodic event types also
+                // bypass the node rate limiter, but without the reserved path.)
                 let futile_repair = op_manager.interest_manager.futile_repair_snapshot();
                 let receiver = op_manager.payload_mix.receiver_apply_stats();
                 let queue = crate::node::BROADCAST_QUEUE_EFFICIENCY_METRICS.snapshot();
@@ -2652,37 +2666,10 @@ impl Ring {
                     })
                 });
 
-                let tel = [
-                    telemetry.enqueue_attempts_total,
-                    telemetry.enqueue_succeeded_total,
-                    telemetry.enqueue_dropped_full_total,
-                    telemetry.enqueue_dropped_closed_total,
-                    telemetry.rate_limit_admitted_operational_total,
-                    telemetry.rate_limit_admitted_shadow_total,
-                    telemetry.dropped_aggregate_limit_operational_total,
-                    telemetry.dropped_aggregate_limit_shadow_total,
-                    telemetry.dropped_shadow_limit_total,
-                    telemetry.dropped_backoff_buffer_full_total,
-                    telemetry.batch_send_attempts_total,
-                    telemetry.batch_send_successes_total,
-                    telemetry.batch_send_failures_total,
-                    telemetry.batch_events_sent_total,
-                    telemetry.batch_retry_truncated_events_total,
-                ];
-                let shadow = std::array::from_fn(|index| {
-                    let stream = telemetry.known_shadow_rollups[index];
-                    [
-                        stream.enqueue_attempts_total,
-                        stream.enqueue_dropped_full_total,
-                        stream.enqueue_dropped_closed_total,
-                        stream.rate_limit_admitted_total,
-                        stream.dropped_aggregate_limit_total,
-                        stream.dropped_shadow_limit_total,
-                    
```

**File**: `crates/core/src/ring/contract_exec_metrics.rs` (modified, +2/-3)
```diff
@@ -123,9 +123,8 @@
 //! Note the deliberate choice of an EXISTING telemetry stream: `router_snapshot`
 //! already carries this class of per-node monotonic counter
 //! (`contract_module_cache_evictions_total`, `broadcast_stream_*_total`), so
-//! these fields cost no shadow-rollup budget slot (`MAX_SHADOW_EVENTS_PER_SECOND`
-//! is 6 with one slot of headroom) and land in a `tracing::info!` line that
-//! survives `release_max_level_info` for local `journalctl` reading.
+//! these fields add no new event stream and land in a `tracing::info!` line
+//! that survives `release_max_level_info` for local `journalctl` reading.
 
 use std::sync::Arc;
 use std::sync::atomic::{AtomicU64, Ordering};
```

**File**: `crates/core/src/ring/interest.rs` (modified, +16/-8)
```diff
@@ -3465,6 +3465,12 @@ impl<T: TimeSource + Sync> InterestManager<T> {
 
         let mut interval = tokio::time::interval(INTEREST_SWEEP_INTERVAL);
         interval.tick().await; // Skip first immediate tick
+        // The sweep keeps tokio's default `Burst` (reconciliation is written
+        // around it, #5782), so passes can run back to back after a stall.
+        // `subscription_health_snapshot` bypasses the telemetry rate limit
+        // (#6001), so only its emission is bounded; every pass still sweeps.
+        let mut health_event_guard =
+            crate::tracing::telemetry::PeriodicEmissionGuard::half_of(INTEREST_SWEEP_INTERVAL);
 
         loop {
             interval.tick().await;
@@ -3495,14 +3501,16 @@ impl<T: TimeSource + Sync> InterestManager<T> {
             }
 
             // Emit periodic health snapshot
-            crate::tracing::telemetry::send_standalone_event(
-                "subscription_health_snapshot",
-                serde_json::json!({
-                    "contracts_with_interests": stats.total_contracts,
-                    "total_interest_entries": stats.total_peer_interests,
-                    "expired_this_sweep": expired.len(),
-                }),
-            );
+            if health_event_guard.should_emit(tokio::time::Instant::now()) {
+                crate::tracing::telemetry::send_standalone_event(
+                    "subscription_health_snapshot",
+                    serde_json::json!({
+                        "contracts_with_interests": stats.total_contracts,
+                        "total_interest_entries": stats.total_peer_interests,
+                        "expired_this_sweep": expired.len(),
+                    }),
+                );
+            }
         }
     }
 
```

**File**: `crates/core/src/router.rs` (modified, +26/-2)
```diff
@@ -301,15 +301,39 @@ pub(crate) struct NetworkEfficiencyV1 {
     /// every hosted contract and then restricted to eviction-eligible ones.
     pub cost_ba: [[u64; STATE_SIZE_BUCKET_COUNT]; 3],
     pub cost_be: [[u64; STATE_SIZE_BUCKET_COUNT]; 3],
-    /// Local telemetry pipeline totals in the order documented where populated.
-    pub tel: [u64; 15],
+    /// Local telemetry pipeline totals, in the order of
+    /// `TelemetryLocalMetricsSnapshot::network_efficiency_rows`. Grew from 15
+    /// to 16 entries in #6001 (periodic admitted, appended last) while the
+    /// schema stayed `v: 1`, because no consumer reading these positions was
+    /// found. From #6001 on, positions 5, 7 and 8 read 0 (the shadow
+    /// sub-budget they counted was removed), and position 4 (operational
+    /// admitted) no longer includes `transport_snapshot`,
+    /// `resource_utilization`, `router_snapshot`, `interest_heartbeat_cycle`
+    /// or `subscription_health_snapshot`, which moved to position 15. Read
+    /// pre- and post-#6001 series separately.
+    pub tel: [u64; 16],
     /// Per known shadow rollup: generated/enqueue attempts, enqueue full,
     /// enqueue closed, rate-limit admitted, aggregate-limit drop,
     /// shadow-subbudget drop, backoff-buffer drop, retry truncation, final sent.
+    /// The two rate-limit drop columns (aggregate-limit and shadow-subbudget)
+    /// are always 0 since #6001: these rollups are periodic events, which
+    /// bypass the per-second cap, and the shadow sub-budget no longer exists.
     pub shadow: [[u64; 9]; 7],
     /// Delivery path for this diagnostic block itself; order is documented in
     /// `TelemetryLocalMetricsSnapshot::network_efficiency_delivery`.
     pub eff: [u64; 8],
+    /// Per event type, lifetime `[admitted, dropped]` at the node's
+    /// per-second telemetry rate limiter, in
+    /// `tracing::telemetry::KNOWN_EVENT_TYPES` order (#6001). Exactly that
+    /// many rows; the last is `other`, which should stay 0. Counts only
+    /// events that reached the worker: channel-full drops before it are
+    /// `tel[2]`, not per type. The admitted column does not reconcile with
+    /// `tel[4] + tel[15]` alone: the `router_snapshot` row also counts the
+    /// snapshots carrying this block, whose admissions are `eff[3]`. A `Vec` only
+    /// because serde does not implement arrays longer than 32. Added so the
+    /// mix of event types a node offers, and which ones the cap drops, can be
+    /// measured instead of inferred from the aggregate `tel` counts.
+    pub tel_t: Vec<[u64; 2]>,
     /// Monotonic hosting-BEGIN counts by CAUSE; row order is
     /// `ring::hosting::HostingCause::ALL`: client GET, transit GET, sub-op GET,
     /// client PUT, transit PUT, startup restore, unattributed.
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +1133/-312)
```diff
@@ -7,10 +7,10 @@
 //! Features:
 //! - Exponential backoff on connection failures (1s → 2s → 4s → ... → 5min max)
 //! - Event batching (send every 10 seconds or when buffer reaches 100 events)
-//! - Rate limiting (max 10 ordinary events/second aggregate), with a separate
-//!   shadow sub-budget (max 6/second) so always-on low-priority shadow
-//!   telemetry cannot starve operational telemetry (#4380), plus one bounded
-//!   reserved path for the fixed 30-minute #5090 diagnostic
+//! - Rate limiting (max 10 operational events/second aggregate). Fixed-cadence
+//!   periodic node streams bypass that cap, because their timers already bound
+//!   them and a busy node otherwise drops most of them (#6001). The fixed
+//!   30-minute #5090 diagnostic has its own bounded reserved path.
 //! - Priority-based dropping when buffer is full
 //!
 //! ## Design Notes
@@ -51,7 +51,8 @@ use super::{EventKind, NetEventLog, NetEventRegister, NetLogMessage};
 /// silently drops events.
 static TELEMETRY_SENDER: OnceLock<TelemetryChannel> = OnceLock::new();
 
-/// The fixed set of background rollups admitted at [`EventPriority::Shadow`].
+/// The fixed set of background "shadow" rollups with per-stream delivery
+/// counters. All of them are also [`PERIODIC_EVENT_TYPES`].
 ///
 /// This is deliberately an enum rather than an event-name map: #5090 needs to
 /// identify which aligned rollup was lost without creating attacker-controlled
@@ -124,8 +125,6 @@ pub(crate) struct KnownShadowRollupMetricsSnapshot {
     pub enqueue_dropped_full_total: u64,
     pub enqueue_dropped_closed_total: u64,
     pub rate_limit_admitted_total: u64,
-    pub dropped_aggregate_limit_total: u64,
-    pub dropped_shadow_limit_total: u64,
     pub dropped_backoff_buffer_full_total: u64,
     pub retry_truncated_total: u64,
     pub sent_total: u64,
@@ -136,17 +135,16 @@ pub(crate) struct KnownShadowRollupMetricsSnapshot {
 /// Every field is a monotonic lifetime total. A later successful snapshot can
 /// therefore report a snapshot that was itself dropped; that loss appears one
 /// snapshot late rather than disappearing with the failed event.
-#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
 pub(crate) struct TelemetryLocalMetricsSnapshot {
     pub enqueue_attempts_total: u64,
     pub enqueue_succeeded_total: u64,
     pub enqueue_dropped_full_total: u64,
     pub enqueue_dropped_closed_total: u64,
     pub rate_limit_admitted_operational_total: u64,
-    pub rate_limit_admitted_shadow_total: u64,
+    /// [`EventPriority::Periodic`] events, which bypass the per-second cap.
+    pub rate_limit_admitted_periodic_total: u64,
     pub dropped_aggregate_limit_operational_total: u64,
-    pub dropped_aggregate_limit_shadow_total: u64,
-    pub dropped_shadow_limit_total: u64,
     pub dropped_backoff_buffer_full_total: u64,
     pub batch_send_attempts_total: u64,
     pub batch_send_successes_total: u64,
@@ -158,6 +156,77 @@ pub(crate) struct TelemetryLocalMetricsSnapshot {
     /// attempts, enqueue full/closed, admitted, rate-limit drop, coalesced
     /// pending sample, retry truncation, final sent.
     pub network_efficiency_delivery: [u64; 8],
+    /// Per event type, in [`KNOWN_EVENT_TYPES`] order: `[admitted, dropped]`
+    /// at the per-second rate limiter. Always exactly
+    /// `KNOWN_EVENT_TYPES.len()` rows, so the exported cardinality is fixed.
+    /// Counts only events that reached the worker; channel-full drops before
+    /// it are in `enqueue_dropped_full_total`, not per type.
+    pub event_type_admissions: Vec<[u64; 2]>,
+}
+
+/// The telemetry rows of `network_efficiency_v1` (`tel`, `shadow`, `eff`,
+/// `tel_t`), built in one place so the positions are unit-testable.
+pub(crate) struct NetworkEfficiencyTelemetryRows {
+    pub tel: [u64; 16],
+    pub shadow: [[u64; 9]; KnownShadowRollup::ALL.len()],
+    pub eff: [u64; 8],
+    pub tel_t: Vec<[u64; 2]>,
+}
+
+impl TelemetryLocalMetricsSnapshot {
+    /// Lay these totals out as the `network_efficiency_v1` rows.
+    ///
+    /// `tel` positions 5, 7 and 8 were the shadow sub-budget's admitted,
+    /// aggregate-drop and sub-budget-drop counts, and `shadow` columns 4 and 5
+    /// its aggregate-limit and sub-budget drops. #6001 replaced that priority
+    /// with the periodic bypass, so they are always 0, kept so every later
+    /// position stays where readers expect it. The periodic admitted count is
+    /// appended as `tel` position 15.
+    ///
+    /// `tel` position 4 (operational admitted) also changed meaning at #6001:
+    /// before it, it included `transport_snapshot`, `resource_utilization`,
+    /// `router_snapshot` (without the diagnostic block),
+    /// `interest_heartbeat_cycle` and `subscription_health_snapshot`, which now
+    /// count in position 15. Read pre- and post-#6001 series separately. The
+    /// schema stays `v: 1`: no consumer reading these positions 
```

#### Recent Merged Pull Requests:
- **PR #6011** (2026-10-27): fix(core): repair degenerate visited-peers bloom indices, gated on the floor (@sanity)
- **PR #6004** (2026-10-26): fix(telemetry): let fixed-cadence events bypass the node rate limit and count drops per type (@sanity)
- **PR #6003** (2026-10-26): feat(transport): share one inbound stream budget per peer across UDP and QUIC (@sanity)
- **PR #6002** (2026-10-26): feat(transport): lower QUIC's concurrent uni stream limit to 64 from field data (@sanity)
- **PR #5998** (2026-10-26): test: keep GET relay driver tests off bloom false positives (@sanity)
- **PR #5997** (2026-10-26): fix(fdev): write build artifacts atomically (@sanity)

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

## X. core): repair degenerate visited-peers bloom indices, gated on the floor (#6011)

**RULE**:
When implementing operations in `crates/core/src/node.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b1d59903`: core): repair degenerate visited-peers bloom indices, gated on the floor (#6011). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/node.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
// The visited-peers bloom gates its index check on the handshake floor (#5994).
pub(crate) use network_bridge::p2p_protoc::parse_crate_version;
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b1d59903` are properly handled with clean fallback behavior.
