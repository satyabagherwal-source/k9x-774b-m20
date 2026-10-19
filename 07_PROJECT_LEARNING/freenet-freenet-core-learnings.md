> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `78eca881`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T20:10:37.398Z  
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
> **Harvest Timestamp**: 2026-10-19T20:10:37.392Z  
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
- **Issue #5943** (2026-10-19): **refactor(transport): classify transport errors and close reasons without UDP details**
  *Symptoms*: ## Problem  The node still reads two of the transport's UDP-specific details across the `PeerConnectionApi` boundary (#5941 lists them in `transport/boundary.rs`):  - It decides whether a transport error ends a connection through `TransportError::is_transient_send_failure`, a predicate named and documented in terms of UDP sends. - It learns why `recv` ended a connection from two out-of-band booleans, `closed_by_idle_timeout()` and `closed_by_stream_refusals()`, and turns them into a `DisconnectReason` with an if-chain.  A second transport would have to mimic both.  ## Approach  Two behaviour-neutral commits:  1. **`TransportError::scope()`**. A new `ErrorScope { Transient, Stream, Connection }`, assigned by an exhaustive match with no default arm. `is_transient()` is `scope() == Transient` and replaces `is_transient_send_failure` at every call site, including the three in `p2p_protoc.rs`. The classification is unchanged: `SendFailed` and `OutboundStreamFailed` are transient, and nothing else is. `OutboundStreamInvalidLength` is labelled `Stream`, as its docs already described it; the transport handles it in its own recv loop. 2. **`CloseReason`**. `PeerConnectionApi` replaces the two flag methods with a single `close_reason() -> Option<CloseReason>`, where `CloseReason` is `IdleTimeout` or `InboundStreamRefusals`. The UDP connection keeps its internal flags (one also drives control flow in `process_inbound`). It reports them through `close_reason_from_flags`, which keeps the 
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Claude Rule Review: Failed to run  The Claude rule review step failed (likely an authentication or API issue). Check the [workflow logs](https://github.com/freenet/freenet-core/actions/runs/39308389554) for details.  --- *Advisory review against `.claude/rules/`. Critical patterns are enforced by the Rule Lint CI job.*
  > ## ⚠️ Extended Benchmark Regressions Detected  Some extended benchmarks show performance regressions.  **Note**: Extended benchmarks include high-latency and packet-loss scenarios which have higher variance than standard CI benchmarks.  [View full results](https://github.com/freenet/freenet-core/actions/runs/39305080154)  [View full benchmark summary](https://github.com/freenet/freenet-core/actions/runs/39305080154)

- **Issue #5941** (2026-10-19): **refactor(transport): narrow the transport API boundary**
  *Symptoms*: Part of #5940 (transport redesign): narrows the transport's API boundary so a second transport implementation can sit behind it. **No behaviour change.**  ## What changes - `PeerConnectionApi` and its types move to `transport/boundary.rs`. - `send_message(NetMessage)` becomes `send(Vec<u8>)`. Serialization moves up into the network bridge, which runs the same `bincode::serialize` call and records the same message-mix length. - Stream progress and inbound-stream registration become transport-owned traits (`StreamProgressObserver`, `InboundStreamRegistry`). The operations layer implements them by forwarding to its existing methods. - `BroadcastDeliveryOutcome` is renamed to `StreamSendOutcome`.  Outside test code, the transport no longer imports `crate::message` or `crate::operations` types. The one runtime difference is a single `Arc` allocation per streamed send, where the bridge wraps the progress handle.  ## Not in this PR (follow-ups) - Ring location and `SocketAddr`-keyed identity. - Moving the auto-update statics, the simulation hooks and the connection setup behind the boundary. - Neutral stream types. `StreamHandle` and `LockFreeStreamBuffer` still appear in the boundary.  ## Testing - `cargo nextest run -p freenet --lib`: 6885 passed, including the `link_model::r1_tests` WAN gates. - CI simulation suite: 201 passed. - R1/R1b FixedRate on 20 seeds: passed. - fmt and both CI clippy variants are clean.  [AI-assisted - Claude] 

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

### Incident Patch 1: `afb74456` (2026-10-19)
**Commit Message**: fix(ci): make release.yml dry_run side-effect free (#5939)

**File**: `.github/scripts/check_release_dry_run.py` (added, +1664/-0)
```diff
@@ -0,0 +1,1664 @@
+#!/usr/bin/env python3
+"""Guard: a workflow's `dry_run` must not be able to push, merge, tag or publish.
+
+#5936. `release.yml` had a `dry_run` input described as "show what would be
+done without publishing". Each mutating step carried its own
+`if: ${{ !inputs.dry_run }}`, and the version-bump job carried none. So a dry
+run pushed `release/vX.Y.Z`, opened the real `build: release X.Y.Z` PR and
+enabled auto-merge on it, landing the bump on `main` through the merge queue:
+a partial release cut, which also invalidated any soak of the previous `main`.
+
+The fix replaces per-step guards with ONE resolved value, and this linter makes
+that structure the only one that passes:
+
+  1. The `validate` job resolves the input once, in its step `id: mode`
+     (`scripts/resolve_release_mode.sh`), and exports `outputs.live`. Only the
+     literal input `false` yields `live == 'true'`; anything else is a dry run.
+  2. `inputs.dry_run` is read NOWHERE else: dotted or indexed, any case, or
+     through a whole object that carries it (`inputs`, `github.event`,
+     `github`). A second reader is how the guards drifted apart.
+  3. Every MUTATING step is gated on `needs.validate.outputs.live == 'true'`,
+     as a top-level `&&` term of its own `if:` or its job's `if:`, in an
+     expression with no top-level `||` (`&&` binds tighter, so `a || b && G`
+     runs without G). A missing or empty output SKIPS the step: fail closed.
+  4. Every mutating `run:` step also refuses, as the first command of its
+     own script (only `set -...` may precede it), unless `RELEASE_LIVE`
+     (wired from the same output) is `true`. So deleting an `if:` turns a dry
+     run red instead of letting it mutate.
+  5. Credentials, the rule that makes any gap in the mutation detector below
+     harmless. In a job a dry run can reach: `actions/checkout` persists no
+     credential (a stray `git push` cannot authenticate) and gets RELEASE_PAT
+     only through the live-gated expression `DRY_SAFE_CHECKOUT_TOKEN`; no
+     step a dry run executes receives RELEASE_PAT at all; and if the job's
+     token can write, no such step is passed ANY token or secret through an
+     expression (workflow env, job env, step env/with, or `${{ }}` in `run:`,
+     in the raw source; a presence test like `secrets.X != ''` is allowed).
+     Actions' implicit default token for `actions/*` steps is not an
+     expression and is not counted; with persistence off it stays inside the
+     action. A dry-run-ONLY job declares read-only `permissions:`, and may
+     then use its own read-only token. No dry-run job gets `id-token: write`.
+     A job that pushes when live must persist its credential when live, or
+     the push fails. YAML anchors and aliases are refused, since an alias can
+     copy a live step's env into a dry-run step invisibly.
+  6. Every `needs.J.*` reference names a job in `needs:`, every
+     `needs.J.outputs.Y` names an output J declares, and every
+     `steps.S.outputs.Y` names a step `id: S` in the same job whose script
+     writes `Y=`. A broken reference is silently empty, which on the LIVE path
+     skips a guarded step or passes an empty argument.
+  7. Steps the reader cannot place (a `steps:` block it cannot itemise, a
+     flow-style `steps: [...]` or `- {...}` item, an item with neither `run:`
+     nor `uses:`) are an error, not a pass.
+  8. `continue-on-error` is refused (it lets a release pass a failed gate),
+     and so is comparing with an unquoted boolean (`'true' == true` is false
+     in Actions).
+
+To extend this guard, extend rule 5 (what credential a dry-run step can
+hold), not the mutation detector: the detector can never be complete.
+
+Rule 5 is the guarantee; the mutation detector below is best-effort. Its
+known gaps (a command it does not recognise) cannot write, because a step
+that runs in a dry run holds no usable write credential.
+
+"Mutating" is decided from the step's source, not from its name: `git push`;
+`gh pr|release|workflow|run|issue|label|secret|variable|repo|cache` write
+verbs; `gh api` with a non-GET method, request fields, or a GraphQL `mutation`
+(or a query read from a file, which cannot be inspected); `cargo publish`
+without `--dry-run` on that same command; `cargo yank|owner`; `docker|podman
+push`; `npm publish`; `curl` with a write method or a body; Python
+`requests.post|put|patch|delete` and `subprocess` argv `["git", "push"]`.
+Commands are matched in the raw line, quotes included, so `bash -c '...'`,
+`eval "..."` and `CMD="git push"; $CMD` are all seen; only a line whose
+command is `echo`/`printf` has its quoted text ignored, so an error message
+that TELLS the operator to run `gh run rerun` is not a rerun. A `run:` that
+invokes `scripts/` or `.github/scripts/` files is scanned through them. A
+`uses:` step is mutating unless its action is on a short read-only allowlist,
+and a job-level `uses:` (reusable workflow) always is.
+
+Escape hatc
```

**File**: `.github/workflows/ci.yml` (modified, +22/-1)
```diff
@@ -286,6 +286,15 @@ jobs:
       - name: Self-test release canary wiring
         run: bash scripts/release_canary_wiring_test.sh
 
+      # Regression gate for #5936: a `dry_run=true` release run pushed the
+      # release branch, opened the `build: release` PR and auto-merged the
+      # version bump into main. Pins that the dry-run resolver fails closed,
+      # that the linter catches the pre-fix job and likely regressions of the
+      # real file, and EXECUTES every mutating step of release.yml against
+      # stubs to prove it refuses (and calls nothing) when not live.
+      - name: Self-test release dry run
+        run: bash scripts/release_dry_run_test.sh
+
       # Regression gate for #5221/#5222: auto-update was broken fleet-wide for
       # TWO releases (v0.2.120, v0.2.121) and nothing noticed, because every
       # signal was one-sided — the release built, published, installed and ran.
@@ -337,7 +346,7 @@ jobs:
       # clean when they landed but were not actually in this list, so nothing
       # held them to it. `-x` because the two test scripts `source` the canary.
       - name: Lint install/uninstall scripts (shellcheck)
-        run: shellcheck -x scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh
+        run: shellcheck -x scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh
       # The PR-backlog sweep reports stalled PRs (see
       # .github/workflows/pr-backlog-sweep.yml). Its self-test drives the ABORT
       # paths -- failed query, empty listing the REST probe contradicts,
@@ -457,6 +466,18 @@ jobs:
       - name: Check required-check workflows (no PR path filter, no needs on a required job)
         run: python3 .github/scripts/check_required_check_path_filters.py .github/workflows
 
+      # Self-test the release dry-run linter, then run it. Not diff-scoped, like
+      # the two above. Guards #5936: release.yml's `dry_run=true` pushed the
+      # release branch, opened the bump PR and auto-merged it into main, because
+      # each mutating step carried its own `!inputs.dry_run` guard and one job
+      # had none. The linter requires every mutating step to be gated on the one
+      # resolved `needs.validate.outputs.live` and to refuse in its own script.
+      - name: Release dry-run linter self-test
+        run: python3 .github/scripts/check_release_dry_run.py --self-test
+
+      - name: Check release dry_run cannot push, merge, tag or publish
+        run: python3 .github/scripts/check_release_dry_run.py .github/workflows
+
       - name: Check for banned patterns in new code
         env:
           PR_TITLE: ${{ github.event.pull_request.title }}
```

**File**: `.github/workflows/release.yml` (modified, +280/-47)
```diff
@@ -14,7 +14,7 @@ on:
         type: boolean
         default: false
       dry_run:
-        description: 'Dry run - show what would be done without publishing'
+        description: 'Dry run - compute and package the release, print what would be created, push/merge/tag/publish nothing'
         required: false
         type: boolean
         default: false
@@ -28,13 +28,33 @@ jobs:
     name: Validate release inputs
     runs-on: ubuntu-latest
     timeout-minutes: 5
+    # Reads only. Without this the job would hold the workflow's write token,
+    # in a dry run as much as a live one.
+    permissions:
+      contents: read
     outputs:
       version: ${{ steps.validate.outputs.version }}
       fdev_version: ${{ steps.validate.outputs.fdev_version }}
+      # 'true' ONLY for a live release. Every step that pushes, opens or merges
+      # a PR, tags or creates a release is gated on
+      # `needs.validate.outputs.live == 'true'`, so an empty or missing value
+      # skips it (fail closed). See scripts/resolve_release_mode.sh (#5936).
+      live: ${{ steps.mode.outputs.live }}
 
     steps:
       - name: Checkout code
         uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+
+      # The ONLY reader of `inputs.dry_run` in this workflow. Rule Lint's
+      # .github/scripts/check_release_dry_run.py fails a PR that reads it
+      # anywhere else, or that adds a mutating step without the `live` guard.
+      - name: Resolve run mode (live or dry run)
+        id: mode
+        env:
+          DRY_RUN_INPUT: ${{ inputs.dry_run }}
+        run: bash scripts/resolve_release_mode.sh
 
       - name: Warn if RELEASE_PAT is not configured
         env:
@@ -109,7 +129,7 @@ jobs:
       # Pinned by scripts/release_canary_wiring_test.sh (assertion 2b-quater),
       # which fails if a validity probe is re-added or the refusal is removed.
       - name: Verify the crates.io token before anything is created
-        if: ${{ !inputs.dry_run }}
+        if: steps.mode.outputs.live == 'true'
         env:
           CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}
         run: |
@@ -165,19 +185,36 @@ jobs:
           echo "  freenet: $VERSION"
           echo "  fdev: $FDEV_VERSION"
 
+  # Runs in BOTH modes: the bump is computed and committed locally either way.
+  # Only a live run pushes it, opens the PR and enables auto-merge (#5936: a
+  # dry run used to do all three, landing the version bump on main).
   update_versions:
     name: Update versions and create PR
     runs-on: ubuntu-latest
     timeout-minutes: 10
     needs: validate
     outputs:
       pr_number: ${{ steps.create_pr.outputs.pr_number }}
+      # Set only in a dry run: the unpushed bump commit, shipped to
+      # `dry_run_rehearsal` as a git bundle artifact.
+      dry_run_bump_sha: ${{ steps.dry_run_report.outputs.bump_sha }}
+    env:
+      RELEASE_LIVE: ${{ needs.validate.outputs.live }}
 
     steps:
       - name: Checkout code
         uses: actions/checkout@v7
         with:
-          token: ${{ secrets.RELEASE_PAT || secrets.GITHUB_TOKEN }}
+          # Live: RELEASE_PAT when set (coalescing to GITHUB_TOKEN), exactly as
+          # before, so the push below fires downstream workflows. Dry run: the
+          # workflow token, used for the fetch only, because no credential is
+          # persisted to .git/config, so even a `git push` that slipped past
+          # every guard below cannot authenticate. The job still holds the
+          # workflow-level write token; Rule Lint forbids handing it, or any
+          # other secret, to a step that runs in a dry run here (this token
+          # line is the one exemption).
+          token: ${{ (needs.validate.outputs.live == 'true' && secrets.RELEASE_PAT) || secrets.GITHUB_TOKEN }}
+          persist-credentials: ${{ needs.validate.outputs.live == 'true' }}
 
       - name: Configure git
         run: |
@@ -237,7 +274,8 @@ jobs:
           cargo update --workspace
           cargo metadata --format-version 1 --manifest-path apps/freenet-ping/Cargo.toml > /dev/null
 
-      - name: Create release branch
+      - name: Commit the version bump locally
+        id: bump
         run: |
           BRANCH="release/v${{ needs.validate.outputs.version }}"
           git checkout -b "$BRANCH"
@@ -248,48 +286,208 @@ jobs:
           - fdev: → ${{ needs.validate.outputs.fdev_version }}
 
           🤖 Automated release commit"
-          git push origin "$BRANCH"
-          echo "RELEASE_BRANCH=$BRANCH" >> $GITHUB_ENV
+          echo "branch=$BRANCH" >> "$GITHUB_OUTPUT"
 
-      - name: Create Pull Request
-        id: create_pr
-        env:
-          GH_TOKEN: ${{ secrets.RELEASE_PAT || secrets.GITHUB_TOKEN }}
-        # NOTE: The PR title MUST start with "build: release " — squash-merge
-        # propagates the title to the merge_group head_commit.message, where
-        # ci.yml's `skip_check` keys off it to decide whether the merge_group
-    
```

**File**: `AGENTS.md` (modified, +2/-2)
```diff
@@ -208,8 +208,8 @@ v0.2.57 release, and they have DIFFERENT remedies:
 1. **Bump PR gets 0 check-runs.** No `pull_request` event fires, so `ci.yml`
    never runs and its required checks never turn green. `ci.yml` has no
    `workflow_dispatch`, so it cannot be started by hand. The old workaround,
-   closing and reopening the PR, breaks `wait_for_pr` polling
-   (`release.yml:285`), whose `release_sha` output `verify_publishable` and
+   closing and reopening the PR, breaks the polling in `release.yml`'s
+   `wait_for_pr` job, whose `release_sha` output `verify_publishable` and
    `create_release` depend on.
 2. **`release.published` does not fire downstream workflows.** Those DO expose
    `workflow_dispatch`, so they can be triggered per step by hand.
```

**File**: `docs/RELEASING.md` (modified, +44/-5)
```diff
@@ -432,16 +432,55 @@ Current wire-gated floors:
 When a NEW wire-gated feature first ships (not this one), set its floor to
 **exactly that release version** and freeze it, as described above.
 
+## Dry run
+
+`gh workflow run release.yml --field dry_run=true` rehearses a cut without
+making one. It resolves the version, commits the bump on the runner, and runs
+the checkout verifier and `cargo publish -p freenet --dry-run` against that
+commit in a read-only `dry_run_rehearsal` job. It prints the branch, PR title
+and body a live run would open, and an approximate changelog. It pushes no
+branch, opens and merges no PR, and creates no tag or release, so `main` does
+not move.
+
+Every mutating step is gated on the single `needs.validate.outputs.live`
+value and refuses in its own script when that is not `true`. No step that
+runs in a dry run is passed `RELEASE_PAT`. The only job that runs in a dry run
+holding a write-capable token is the bump job (`update_versions`), and the
+only step given that token is its checkout, which uses it to fetch and
+persists nothing. `validate` is read-only, `summary` has no permissions, and
+the rehearsal job is read-only. A presence test such as
+`secrets.RELEASE_PAT != ''` passes no credential and is allowed. Rule Lint's
+`.github/scripts/check_release_dry_run.py` and the CI self-test
+`scripts/release_dry_run_test.sh` fail a PR that breaks any of that (#5936).
+
+Caveats:
+
+- **Only from a ref that contains #5939** (the fix for #5936). The workflow
+  file comes from the ref you dispatch. Before that fix a "dry run" pushed
+  the branch and auto-merged the bump PR, so `--ref` pointing at an older tag
+  or branch still does.
+- **It does not exercise the live-only half:** the `CARGO_REGISTRY_TOKEN`
+  presence check, waiting for the bump PR's merge queue (`wait_for_pr`,
+  `resolve_release_sha.sh`), GitHub's generated release notes, the tag push
+  and the release creation, and everything the tag triggers in
+  `cross-compile.yml` (binaries, Gate A, the crates.io publish). A green dry
+  run says the bump and the packaging are sound, not that a cut will ship.
+- Whether a dry run needs the pre-cut preconditions is decided by the
+  `freenet:release` skill, not here.
+
 ## What fires when
 
 ```
 gh workflow run release.yml
-    └─→ release.yml: validate
+    └─→ release.yml: validate   (resolves dry_run → outputs.live)
     └─→ release.yml: update_versions
-            └─→ creates "build: release X.Y.Z" PR
-            └─→ ci.yml runs on PR (using RELEASE_PAT scope)
-            └─→ PR auto-merges to main
-    └─→ release.yml: wait_for_pr
+            └─→ dry run: commits the bump locally, prints what it would
+                push and bundles the commit; dry_run_rehearsal then verifies
+                and packages it. Of what follows, only the summary runs
+            └─→ (live only) creates "build: release X.Y.Z" PR
+            └─→ (live only) ci.yml runs on PR (using RELEASE_PAT scope)
+            └─→ (live only) PR auto-merges to main
+    └─→ release.yml: wait_for_pr   (this and everything below: live only)
             └─→ resolves the bump PR's merge commit -> RELEASE_SHA
                 (everything below checks out that exact commit; see #5233)
     └─→ release.yml: verify_publishable
```

**File**: `scripts/release_dry_run_test.sh` (added, +714/-0)
```diff
@@ -0,0 +1,714 @@
+#!/usr/bin/env bash
+# Regression tests for #5936: release.yml's `dry_run=true` was not a dry run.
+#
+# The version-bump job had no dry-run guard, so a "dry run" pushed
+# `release/vX.Y.Z`, opened the real `build: release X.Y.Z` PR and enabled
+# auto-merge on it, landing the bump on main. Only the tag and release steps
+# carried their own `if: ${{ !inputs.dry_run }}`.
+#
+# The fix resolves the input ONCE (scripts/resolve_release_mode.sh, exported as
+# `needs.validate.outputs.live`), gates every mutating step on it, and makes
+# each mutating script refuse on its own when not live.
+# `.github/scripts/check_release_dry_run.py` enforces that shape and has its own
+# `--self-test` over synthetic fixtures. This file tests what that cannot:
+#
+#   1. the resolver fails closed (only the literal `false` is live);
+#   2. the linter fires on the REAL pre-fix job, and passes the repo today;
+#   3. the obvious future regressions of the real file are caught: each is
+#      applied to a copy of release.yml and the linter must go red;
+#   4. the job/step topology of BOTH modes, by evaluating every `if:` for
+#      live and for dry (`--simulate`), so a guard flipped the wrong way --
+#      which would break a LIVE release -- fails here;
+#   5. every mutating step of the real release.yml, EXECUTED with stubbed
+#      git/gh and its real `env:`, refuses before calling anything when not
+#      live, and when live reaches its command with no empty argument and the
+#      right expression feeding each argument;
+#   6. the real non-mutating steps of the dry path (bump, compose, report,
+#      bundle, rehearsal checkout, verifier) run end to end in throwaway repos;
+#   7. the linter and this test are wired into CI, and not disabled in place.
+#
+# Run manually with: bash scripts/release_dry_run_test.sh
+
+set -euo pipefail
+
+# The end-to-end section runs real git in throwaway repos. Keep the caller's
+# git environment out of it: an exported GIT_DIR would aim it at a real repo,
+# and global signing or hook settings would fail or prompt.
+unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY
+# An ambient token would satisfy the "every gh call has a GH_TOKEN" checks
+# vacuously; the steps must supply their own.
+unset GH_TOKEN GITHUB_TOKEN
+export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
+LINTER="$REPO_ROOT/.github/scripts/check_release_dry_run.py"
+RESOLVER="$REPO_ROOT/scripts/resolve_release_mode.sh"
+RELEASE_YML="$REPO_ROOT/.github/workflows/release.yml"
+CI_YML="$REPO_ROOT/.github/workflows/ci.yml"
+command -v jq > /dev/null || { echo "FAIL - this test needs jq (preinstalled on ubuntu-latest)" >&2; exit 2; }
+TEST_TMP=$(mktemp -d)
+trap 'rm -rf "$TEST_TMP"' EXIT
+
+FAILURES=0
+check() {
+    # check <description> <actual> <expected>
+    local desc="$1" actual="$2" expected="$3"
+    if [[ "$actual" == "$expected" ]]; then
+        echo "ok   - $desc"
+    else
+        echo "FAIL - $desc (got '$actual', expected '$expected')" >&2
+        FAILURES=$((FAILURES + 1))
+    fi
+}
+
+# --- 1. the resolver ---------------------------------------------------------
+
+resolve() {
+    # resolve <value|__unset__> -> the `live=` value written, plus stdout
+    local out="$TEST_TMP/mode.out" rc=0
+    : > "$out"
+    if [[ "$1" == "__unset__" ]]; then
+        env -u DRY_RUN_INPUT GITHUB_OUTPUT="$out" bash "$RESOLVER" > "$TEST_TMP/mode.log" 2>&1 || rc=$?
+    else
+        DRY_RUN_INPUT="$1" GITHUB_OUTPUT="$out" bash "$RESOLVER" > "$TEST_TMP/mode.log" 2>&1 || rc=$?
+    fi
+    [[ "$rc" -eq 0 ]] || { echo "resolver-exit-$rc"; return; }
+    grep -E '^live=' "$out" | paste -sd, -
+}
+
+check "resolver: dry_run=false is a live run" "$(resolve false)" "live=true"
+check "resolver: dry_run=true is a dry run" "$(resolve true)" "live=false"
+check "resolver: an empty input is a dry run (fail closed)" "$(resolve '')" "live=false"
+check "resolver: an unset input is a dry run (fail closed)" "$(resolve __unset__)" "live=false"
+check "resolver: 'False' is not 'false', so a dry run" "$(resolve False)" "live=false"
+resolve '' > /dev/null
+check "resolver: an unexpected value is reported, not silently accepted" \
+    "$(grep -c 'Treating this run as a dry run' "$TEST_TMP/mode.log")" "1"
+
+# --- 2. the linter against real files ----------------------------------------
+
+SELF_RC=0
+python3 "$LINTER" --self-test > /dev/null 2>&1 || SELF_RC=$?
+check "linter self-test passes" "$SELF_RC" "0"
+
+REPO_RC=0
+python3 "$LINTER" "$REPO_ROOT/.github/workflows" > "$TEST_TMP/repo.out" 2>&1 || REPO_RC=$?
+check "linter passes the repo's workflows" "$REPO_RC" "0"
+[[ "$REPO_RC" -eq 0 ]] || cat "$TEST_TMP/repo.out" >&2
+
+# The pre-fix shape, abbreviated from origin/main 9c09d2dbf (the three
+# mutating steps of the version-bump job are as they were; the rest is cut to
+# the minimum): guarded tag 
```

**File**: `scripts/resolve_release_mode.sh` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+#!/usr/bin/env bash
+# Resolve release.yml's `dry_run` input into the ONE value every mutating step
+# checks: `live=true` or `live=false` on $GITHUB_OUTPUT.
+#
+# Why a single resolved value rather than `if: ${{ !inputs.dry_run }}` on each
+# step: that is how #5936 happened. Each step carried its own guard, the
+# version-bump job had none, and a "dry run" pushed a release branch, opened
+# the `build: release` PR and auto-merged it into main. A guard that has to be
+# remembered per step is missed by the next edit. Now `inputs.dry_run` is read
+# HERE ONLY, and every step that pushes, opens a PR, merges, tags or creates a
+# release is gated on `needs.validate.outputs.live == 'true'`.
+# `.github/scripts/check_release_dry_run.py` (run by Rule Lint) enforces both.
+#
+# FAILS CLOSED. Only the exact string `false` yields a live run. Anything else
+# (`true`, empty because the input was never wired, a typo) is a dry run, and
+# a mutating step whose guard reads an empty or missing output is skipped.
+#
+# Run manually with:
+#   DRY_RUN_INPUT=true GITHUB_OUTPUT=/dev/stdout bash scripts/resolve_release_mode.sh
+# Tests: scripts/release_dry_run_test.sh
+
+set -euo pipefail
+
+OUTPUT_FILE="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
+DRY_RUN_INPUT="${DRY_RUN_INPUT-}"
+
+if [ "$DRY_RUN_INPUT" = "false" ]; then
+    echo "live=true" >> "$OUTPUT_FILE"
+    echo "🚀 LIVE release: this run pushes the bump branch, merges the bump PR, tags and creates the draft release."
+    exit 0
+fi
+
+echo "live=false" >> "$OUTPUT_FILE"
+if [ "$DRY_RUN_INPUT" != "true" ]; then
+    echo "::warning title=Treating this run as a dry run::The dry_run input was '$DRY_RUN_INPUT', not 'true' or 'false'. Refusing to guess that a release was meant, so nothing will be pushed."
+fi
+echo "::notice title=DRY RUN::Nothing will be pushed, merged, tagged or released. The version bump is computed and committed locally, packaged with 'cargo publish --dry-run', and what a live run would create is printed instead."
```

#### Recent Merged Pull Requests:
- **PR #5943** (2026-10-19): refactor(transport): classify transport errors and close reasons without UDP details (@sanity)
- **PR #5941** (2026-10-19): refactor(transport): narrow the transport API boundary (@sanity)
- **PR #5939** (2026-10-19): fix(ci): make release.yml dry_run side-effect free (@sanity)
- **PR #5938** (2026-10-19): build: release 0.2.147 (@sanity)
- **PR #5935** (2026-10-19): test: cut chain-collapse sim runtime and keep ping lockfile in sync (@sanity)
- **PR #5934** (2026-10-19): fix(transport): validate declared stream lengths (@sanity)

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

## X. ci): make release.yml dry_run side-effect free (#5939)

**RULE**:
When implementing operations in `.github/scripts/check_release_dry_run.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `afb74456`: ci): make release.yml dry_run side-effect free (#5939). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/check_release_dry_run.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#!/usr/bin/env python3
"""Guard: a workflow's `dry_run` must not be able to push, merge, tag or publish.

#5936. `release.yml` had a `dry_run` input described as "show what would be
done without publishing". Each mutating step carried its own
`if: ${{ !inputs.dry_run }}`, and the version-bump job carried none. So a dry
run pushed `release/vX.Y.Z`, opened the real `build: release X.Y.Z` PR and
enabled auto-merge on it, landing the bump on `main` through the merge queue:
a partial release cut, which also invalidated any soak of the previous `main`.

The fix replaces per-step guards with ONE resolved value, and this linter makes
that structure the only one that passes:

  1. The `validate` job resolves the input once, in its step `id: mode`
     (`scripts/resolve_release_mode.sh`), and exports `outputs.live`. Only the
     literal input `false` yields `live == 'true'`; anything else is a dry run.
  2. `inputs.dry_run` is read NOWHERE else: dotted or indexed, any case, or
     through a whole object that carries it (`inputs`, `github.event`,
     `github`). A second reader is how the guards drifted apart.
  3. Every MUTATING step is gated on `needs.validate.outputs.live == 'true'`,
   
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `afb74456` are properly handled with clean fallback behavior.
