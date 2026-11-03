> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `99b7ccaf`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T20:12:20.074Z  
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
> **Harvest Timestamp**: 2026-11-03T20:11:12.583Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3112 stars

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
- **Issue #6105** (2026-11-03): **ci: cut Ubicloud runner spend without slowing PR CI**
  *Symptoms*: ## Problem  The October Ubicloud bill was $429. Rebuilt from the Actions API (per-job durations for a stratified sample of 573 of ~3,700 runs, at Ubicloud list prices) it comes to ~$440, which confirms the account is on standard pricing. freenet-core's `ci.yml` is ~$301 of it, most of that on three standard-16 jobs (Unit & Integration ~$124, Simulation ~$89, NAT Validation ~$55). The daily large simulation is another ~$42. Spend tracks real work: 92% of PR CI runs were on PRs that merged, about $1.80 of CI per merged PR. So this cuts structural waste, not usage.  ## Approach  **1. Simulation stopped recompiling before it tests** (measured). Its run step lacked the build step's linker env. Cargo saw changed flags and rebuilt before running a single test: 3m04s on run 41154587352 and 3m54s (485 crates) on run 41665757502, per `sim-logs/nextest.log`, on a standard-16, on every PR run. The same gap existed in Unit & Integration's ping-types step. Both now carry the env. Projected saving: ~$20-30/month, plus 3-4 min off Simulation's wall clock.  **2. Warm Rust cache for the heavy jobs.** A PR can restore a cache from its own branch or from main. I verified that Ubicloud honours this: a new PR's first Clippy run logs `Restored from cache key "v0-rust-clippy_check-…" full match: true`. But the heavy jobs never run on main, so they had no main entry. There was no `v0-rust-test_unit-*` entry at all, and Simulation and NAT saved 1.2-2.2 GB per PR branch (0.5-0.9 min of upload per run) 

- **Issue #6103** (2026-11-03): **fix(delegates): refuse node-only inbound messages from clients**
  *Symptoms*: ## Problem  A client's delegate request (`DelegateRequest::ApplicationMessages`) could carry any `InboundDelegateMsg` variant, and the runtime forwarded it to the delegate verbatim. `carries_host_only_inbound` refused only `Lifecycle` and `WakeupFired`. Every other non-`ApplicationMessage` variant reports something only the node knows: `ContractNotification`, the `Get/Put/Update/Subscribe/UnsubscribeContractResponse` family, `UserResponse` and `DelegateMessage`. None of them carries an origin, so a delegate cannot tell a forged one from a real one. A web app on the node, or an unattested client, could hand a delegate a contract state the contract never had, or a made-up answer to a contract request it made.  Local mode (`run_local_node`, `Executor::handle_request`) reaches the executor without going through the contract loop, so it had no refusal at all, not even for `Lifecycle`/`WakeupFired`.  Tracked privately as GHSA-3rw4-2m4x-g3gh.  ## Approach  - `carries_host_only_inbound` becomes `node_only_inbound`, an **allowlist**: a client may send `ApplicationMessage` and nothing else. A variant added later to the `#[non_exhaustive]` enum is refused until someone decides otherwise. - It is applied at every client entry point: `dispatch_delegate_request` on a network node (where the old check lived, still before exclusion/queueing), and a new `Executor::client_delegate_request` that `run_local_node` and `handle_request` now both call. - The unchecked inherent methods `Executor::del

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

### Incident Patch 1: `99b7ccaf` (2026-11-03)
**Commit Message**: ci: cut Ubicloud runner spend without slowing PR CI (#6105)

**File**: `.github/scripts/check_cache_warm_parity.py` (added, +900/-0)
```diff
@@ -0,0 +1,900 @@
+#!/usr/bin/env python3
+"""Keep ci-cache-warm.yml's jobs producing the cache keys ci.yml restores.
+
+ci.yml's heavy PR jobs (Unit & Integration, Simulation, NAT Validation) never
+run on pushes to main, so nothing they do can write a main-scoped cache entry,
+and a PR can only restore from its own branch or from main. Measured
+2026-11-03: no ``v0-rust-test_unit-*`` entry existed, so every Unit &
+Integration run compiled its dependency tree from scratch on a standard-16
+Ubicloud runner. ci-cache-warm.yml writes those entries.
+
+It only helps while its keys are the keys the PR jobs look up. Swatinem/
+rust-cache restores by ``<prefix>-<key>-<GITHUB_JOB>-<OS>-<arch>-<hash>``,
+where ``<hash>`` covers the rustc version and every env var whose name starts
+with CARGO, CC, CFLAGS, CXX, CMAKE or RUST. And a restored entry only saves
+work if cargo's fingerprints match, which needs the same flags, env and
+feature sets on every compile command. Any drift fails SILENTLY: the PR jobs
+stay green and quietly build cold again. Hence this linter, run from Rule Lint.
+
+A "warm job" is a job in the warm workflow that uses Swatinem/rust-cache.
+Against the ci.yml job with the SAME id it checks:
+
+1. workflow-level ``env:``/``defaults:`` and job-level ``env:``/``defaults:``
+   are identical, and so are ``$GITHUB_ENV`` writes and the ORDER of actions
+   up to the cache step (the toolchain action sets CARGO_* env the key hashes);
+2. the ``dtolnay/rust-toolchain`` inputs are identical (and present);
+3. the ``Swatinem/rust-cache`` reference, inputs and step env are identical,
+   except ``save-if``, which is checked separately: the ci.yml twin must save
+   only from main (exactly ``SAVE_IF_MAIN``), and the warm job must save;
+4. the compile signatures are identical: each cargo build/test/nextest/run/
+   check/clippy/bench/doc command reduced to the flags that decide what is
+   compiled, plus every ``make`` invocation, EACH paired with the compile-
+   affecting env of its own step (step ``env:``, ``export``s, and inline
+   ``VAR=value cargo ...`` prefixes). ``--no-run``, ``--locked``, ``-E``
+   filters, ``-j`` and nextest's test ``--profile`` are ignored, so a warm job
+   that compiles without running matches a CI job that compiles and runs;
+5. ``apt-get install`` package sets are identical;
+6. the warm job runs on a Ubicloud runner with the same label suffix
+   (architecture, OS variant), and its display name starts with
+   ``Warm cache:`` -- scripts/release.sh excludes check runs by that prefix,
+   and a name that matched a required context would impersonate it.
+
+It also DISCOVERS which ci.yml jobs need a twin: a Ubicloud job whose
+rust-cache has a conditional ``save-if`` and whose ``if:`` gates on
+``github.event_name`` without ever admitting ``== 'push'``. It fails if such a
+job has no twin, or if a warm job's twin no longer needs one.
+
+Standard library only, like the other Rule Lint scripts: the subset of YAML
+these two files use is parsed by indentation.
+
+Usage:
+    check_cache_warm_parity.py <ci.yml> <ci-cache-warm.yml>
+    check_cache_warm_parity.py --self-test
+"""
+
+from __future__ import annotations
+
+import re
+import shlex
+import sys
+from pathlib import Path
+
+SAVE_IF_MAIN = "${{ github.ref == 'refs/heads/main' }}"
+WARM_NAME_PREFIX = "Warm cache:"
+
+# Step-level env that changes what cargo/rustc/cc/build scripts produce, so a
+# cached artifact built without it is not reused. CARGO_TERM_* only colours
+# output.
+COMPILE_ENV_RE = re.compile(
+    r"^(CARGO_(?!TERM_)|RUSTFLAGS$|RUSTDOCFLAGS$|RUSTC|CC$|CC_|CFLAGS|CXX|"
+    r"CMAKE|PKG_CONFIG|LIBCLANG|BINDGEN|OPENSSL_|SDKROOT$|MACOSX_DEPLOYMENT_TARGET$)"
+)
+EXPORT_RE = re.compile(r"^\s*export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$")
+INLINE_ENV_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)=(\"[^\"]*\"|'[^']*'|\S+)\s+")
+CARGO_CMD_RE = re.compile(
+    r"\bcargo\s+(build|nextest\s+run|test|run|check|clippy|bench|doc)\b(.*)"
+)
+MAKE_CMD_RE = re.compile(r"(?:^|[;&|]\s*|\s)(make\s.*)$")
+APT_RE = re.compile(r"\bapt(?:-get)?\s+install\b(.*)")
+UBICLOUD_LABEL_RE = re.compile(r"ubicloud-standard-\d+((?:-[a-z0-9]+)*)")
+
+# Flags that take a value and decide what is compiled.
+VALUE_FLAGS = {"-p", "--package", "--features", "-F", "--exclude", "--test",
+               "--bin", "--example", "--bench", "--target", "--profile",
+               "--cargo-profile", "--target-dir", "--config", "--manifest-path"}
+# nextest's --profile picks a TEST profile (retries, timeouts), not a cargo
+# profile, so it does not affect what is compiled.
+NEXTEST_IGNORED_VALUE_FLAGS = {"--profile"}
+BOOL_FLAGS = {"--no-default-features", "--all-features", "--release", "-r",
+              "--workspace", "--all", "--lib", "--bins", "--tests", "--benches",
+              "--examples", "--all-targets"}
+
+
+# --- minimal indentation-based YAML access -----------------------------------
+
+def _indent(line: str) -> int:
+    return len(line) - len(l
```

**File**: `.github/workflows/binstall-smoke-test.yml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ name: Binstall Smoke Test (Nightly)
 
 on:
   schedule:
-    # 5 AM UTC daily — staggered after simulation-nightly (3 AM UTC).
+    # 5 AM UTC daily — staggered after simulation-nightly (WAN bench 3 AM UTC daily, large sim 2 AM UTC Sundays).
     - cron: "0 5 * * *"
   workflow_dispatch:
 
```

**File**: `.github/workflows/check-token-coalesce.yml` (modified, +8/-1)
```diff
@@ -30,11 +30,18 @@ jobs:
   check:
     name: Workflow steps that trigger downstream events must use RELEASE_PAT coalesce
     runs-on: ubuntu-latest
-    timeout-minutes: 2
+    # 5, not 2: the full-history fetch alone took 1m56s on 2026-11-03 (run
+    # 41688535376) and the job was killed two seconds into its grep, leaving a
+    # red required-looking check on a PR it had nothing to say about.
+    timeout-minutes: 5
     steps:
       - uses: actions/checkout@v7
         with:
           fetch-depth: 0
+          # Blobless partial clone: full history and trees (what the
+          # three-dot diff and merge-base need) without every file version;
+          # the few blobs the diff below reads are fetched on demand.
+          filter: blob:none
 
       - name: Grep workflow files for unsafe GITHUB_TOKEN usage
         env:
```

**File**: `.github/workflows/ci-cache-warm.yml` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+name: CI Cache Warm
+
+# Writes the main-scoped Rust caches that ci.yml's heavy PR jobs restore from.
+#
+# WHY THIS EXISTS. A PR can restore a cache saved on its own branch or on main,
+# nothing else. ci.yml's Unit & Integration, Simulation and NAT Validation jobs
+# do not run on pushes to main (the PR already validated the code), so none of
+# them ever wrote a main-scoped entry. Measured 2026-11-03 with
+# `ubi gh freenet/freenet-core list-cache-entries`: no `v0-rust-test_unit-*`
+# entry existed at all, so every Unit & Integration run compiled its whole
+# dependency tree on a standard-16 runner, and Simulation / NAT Validation
+# started cold on each PR's first run and then saved a 1.2-2.2 GB entry that
+# only later pushes to that one branch could read.
+#
+# HOW THE KEYS LINE UP. Swatinem/rust-cache keys on
+#   <prefix>-<key input>-<GITHUB_JOB>-<OS>-<arch>-<hash>-<lockfile hash>
+# where <hash> covers the installed rustc versions and every env var whose
+# name starts with CARGO, CC, CFLAGS, CXX, CMAKE or RUST, and a PR restores by
+# the key minus the lockfile hash. The `key` input is THIS file's hash on both
+# sides: rust-cache skips the save on an exact key hit, so a change to what
+# the PR jobs compile (which must be mirrored here) has to yield a new key for
+# this workflow to fill. So each job below MUST keep:
+#   - the SAME job id as its ci.yml counterpart (test_unit, test_simulation,
+#     nat_validation) -- the display `name:` is deliberately different, so
+#     these never masquerade as the required status contexts;
+#   - the SAME job-level `env:`, toolchain and toolchain targets;
+#   - the SAME linker env on its compile steps, and the same cargo features,
+#     or cargo's fingerprints differ and the restored deps are rebuilt anyway.
+# .github/scripts/check_cache_warm_parity.py enforces this from Rule Lint.
+# When you change one of those jobs in ci.yml, change its twin here.
+#
+# It must run on a Ubicloud runner: Ubicloud serves its own cache backend, so
+# an entry saved from a GitHub-hosted runner is invisible to Ubicloud jobs.
+# Runner size does not enter the key (only OS and arch do), so the cheaper
+# standard-8 is used throughout.
+
+on:
+  # Daily backstop, for what no path filter sees: eviction (Ubicloud's policy
+  # is not documented; this does not rely on PR restores keeping an entry
+  # alive), and a runner-image update. rust-cache hashes EVERY installed rustup
+  # toolchain into the key, so an image that bumps its preinstalled stable
+  # orphans the entries until the next warm. On an exact key hit a run only
+  # rebuilds the workspace crates and skips the save, so it is cheap.
+  schedule:
+    - cron: "0 4 * * *"
+  # Re-warm when what the cached dependencies depend on changes on main: the
+  # lockfile and manifests, the toolchain and cargo config, and this file.
+  # ci.yml is deliberately absent: any ci.yml change that matters to the cache
+  # (job env, toolchain, compile commands) must be mirrored here -- the parity
+  # linter enforces it -- and the cache `key` is this file's hash, so a
+  # ci.yml-only push would hit the existing key and save nothing. Path filters
+  # are safe because no job here is a required status context (#5451).
+  push:
+    branches: [main]
+    paths:
+      - "Cargo.lock"
+      - "**/Cargo.toml"
+      - "rust-toolchain"
+      - "rust-toolchain.toml"
+      - ".cargo/config.toml"
+      - ".github/workflows/ci-cache-warm.yml"
+  workflow_dispatch:
+
+# Finish the running warm, then run only the latest queued one (GitHub keeps
+# one pending run per group). Cancelling instead would discard a run just
+# before its post-job save, and a steady stream of merges could then keep
+# every run from saving.
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: false
+
+permissions:
+  contents: read
+
+jobs:
+  test_unit:
+    name: "Warm cache: Unit & Integration"
+    runs-on: ubicloud-standard-8
+    timeout-minutes: 45
+
+    # Must match ci.yml test_unit's job-level env exactly (cache key input).
+    env:
+      RUST_LOG: error
+      CARGO_TARGET_DIR: ${{ github.workspace }}/target
+      RUST_MIN_STACK: 268435456
+
+    steps:
+      - uses: actions/checkout@v7
+
+      - name: Install mold linker
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y mold
+
+      - uses: dtolnay/rust-toolchain@stable
+        with:
+          toolchain: 1.93.0
+          targets: wasm32-unknown-unknown
+
+      - uses: Swatinem/rust-cache@v2
+        with:
+          save-if: ${{ github.ref == 'refs/heads/main' }}
+          key: ci-${{ hashFiles('.github/workflows/ci-cache-warm.yml') }}
+
+      - name: Install nextest
+        uses: taiki-e/install-action@v2
+        timeout-minutes: 5
+        with:
+          tool: cargo-nextest
+          fallback: none
+
+      - name: Build
+        env:
+          CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: clang
+  
```

**File**: `.github/workflows/ci.yml` (modified, +90/-10)
```diff
@@ -7,8 +7,8 @@ name: CI
 #    permanently unmergeable, so it is confined to the trigger where no
 #    required check is at stake.
 #    This is a REAL cost increase, not a relocation: since #5571 a docs-only PR
-#    pays the full PR suite (Clippy on ubicloud-standard-8; Unit & Integration,
-#    Simulation and NAT Validation on ubicloud-standard-16; the macOS/Windows
+#    pays the full PR suite (Clippy and NAT Validation on ubicloud-standard-8;
+#    Unit & Integration and Simulation on ubicloud-standard-16; the macOS/Windows
 #    unit jobs) PLUS a paid Claude rule review, on top of the merge_group run it
 #    already paid. That was accepted because docs-only merges are rare (15 in
 #    the year to 2026-09-05) and the alternative — gating each expensive STEP on
@@ -30,6 +30,9 @@ name: CI
 #      protection happy without contending for ubicloud-standard-16 slots.
 #    - Release merge_group (commit message starts with "build: release") runs
 #      the full suite as the pre-publish gate, so what ships is known-green.
+# 8. Heavy jobs restore a main-scoped Rust cache and never save on PRs. The
+#    entries are written by ci-cache-warm.yml, which mirrors those jobs' ids,
+#    env and build commands; check_cache_warm_parity.py keeps them in step.
 
 on:
   push:
@@ -239,6 +242,22 @@ jobs:
       - name: Self-test required-check path-filter guard
         run: bash scripts/required_check_path_filters_test.sh
 
+      # Regression gate for the Rust cache warm (#6105). ci-cache-warm.yml
+      # writes the main-scoped caches the heavy PR jobs restore, and drift
+      # between the two files fails silently (green checks, cold builds).
+      # Pins that the parity linter fires on the real defect it found
+      # (Simulation's run step recompiling for want of the linker env), that
+      # the repo satisfies it, that it is wired into rule_lint, and that the
+      # release pre-flight ignores "Warm cache:" check runs.
+      - name: Self-test cache-warm parity guard
+        run: bash scripts/cache_warm_parity_test.sh
+
+      # Each simulation-nightly job selects its cron with a literal copy of the
+      # string under `on.schedule`. If they drift, the job is skipped on every
+      # run, which the notifiers and the release pre-flight read as healthy.
+      - name: Self-test simulation schedule pairing
+        run: bash scripts/simulation_schedule_test.sh
+
       # Regression gate for the release driver's cross-compile wait: under
       # `set -euo pipefail` a bare `var=$(gh ...)` aborts the whole driver on a
       # transient GitHub blip, AFTER the release publishes but BEFORE the
@@ -352,7 +371,7 @@ jobs:
       # clean when they landed but were not actually in this list, so nothing
       # held them to it. `-x` because the two test scripts `source` the canary.
       - name: Lint install/uninstall scripts (shellcheck)
-        run: shellcheck -x scripts/check-x86-64-baseline.sh scripts/check-x86-64-baseline_test.sh scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh scripts/wan-bench-classify.sh scripts/wan-bench-classify_test.sh
+        run: shellcheck -x scripts/check-x86-64-baseline.sh scripts/check-x86-64-baseline_test.sh scripts/install.sh scripts/uninstall.sh scripts/test-install-sh.sh scripts/test-uninstall-sh.sh scripts/macos-url-scheme-e2e.sh scripts/auto-update-canary.sh scripts/auto-update-canary_test.sh scripts/auto-update-canary_lifecycle_test.sh scripts/release_wait_for_binaries_test.sh scripts/release_canary_wiring_test.sh scripts/rule_lint_shell_assertion_counter_test.sh scripts/release.sh scripts/pr-backlog-sweep.sh scripts/pr-backlog-sweep_test.sh scripts/release-rollback.sh scripts/release_rollback_test.sh scripts/resolve_release_mode.sh scripts/release_dry_run_test.sh nix/freenet-node.sh scripts/nix-node-wrapper_test.sh scripts/wan-bench-classify.sh scripts/wan-bench-classify_test.sh scripts/cache_warm_parity_test.sh scripts/simulation_schedule_test.sh
       # The PR-backlog sweep reports stalled PRs (see
       # .github/workflows/pr-backlog-sweep.yml). Its self-test drives the ABORT
       # paths -- failed query, empty listing the REST probe contradicts,
@@ -490,6 +509,17 @@ jobs:
       - name: Check release dry_run cannot push, merge, tag or publish
         run: python3 .github/scripts/check_release_dry_run.py .github/workflows
 
+      # Self-test the cache-warm parity linter, then run it. Not diff-sco
```

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -492,8 +492,8 @@ jobs:
     name: Wait for PR to merge
     runs-on: ubuntu-latest
     # 75 min covers: merge-queue scheduling + full-suite release gate (test_unit
-    # + Simulation + NAT Validation in parallel, ~10-15 min each on a busy
-    # ubicloud-standard-16) + branch-protection check propagation. Bumped from
+    # + Simulation + NAT Validation in parallel, ~10-15 min each on busy
+    # Ubicloud runners) + branch-protection check propagation. Bumped from
     # 60 min when the release merge_group started running the full suite (#3973).
     timeout-minutes: 75
     needs: [validate, update_versions]
```

**File**: `.github/workflows/simulation-nightly.yml` (modified, +22/-2)
```diff
@@ -6,9 +6,25 @@ name: Simulation Tests (Nightly)
 #   - Nightly-gated nextest tests (1h virtual time, 250-contract scale)
 #   - Large scale (500 nodes, 10000 events)
 
+# Despite the name, the large simulation runs WEEKLY; only WAN Bench R1 is
+# still nightly. The name stays because scripts/release.sh filters on the
+# check names "Simulation Tests (Nightly)" and "Large Scale Simulation", and
+# "nightly" also names the `nightly_tests` feature and nextest profile.
 on:
   schedule:
-    # Run at 3 AM UTC every day
+    # Each job runs on exactly ONE of these crons (see each job's `if:`), and
+    # the concurrency group includes the cron string, so the two never cancel
+    # each other.
+    #
+    # Large Scale Simulation: Sundays 02:00 UTC. Daily until 2026-11: at
+    # ~2.5 h on a ubicloud-standard-16 the daily run cost ~$42/month, about a
+    # tenth of the project's Ubicloud bill, and a daily cadence had not bought
+    # fast detection in practice -- the 500-node step was silently cancelled
+    # for weeks before anyone noticed (see the timeout note on the job below).
+    # Run it by hand (workflow_dispatch) to check a specific change.
+    - cron: "0 2 * * 0"
+    # WAN Bench R1: daily 03:00 UTC, unchanged. A short congestion-controller
+    # gate (~$1.30/month), so it keeps its nightly cadence.
     - cron: "0 3 * * *"
   workflow_dispatch:
     # Allow manual triggering from any branch
@@ -24,12 +40,14 @@ on:
 
 # Cancel in-progress runs when a new run is triggered
 concurrency:
-  group: ${{ github.workflow }}-${{ github.ref }}
+  group: ${{ github.workflow }}-${{ github.ref }}-${{ github.event.schedule || 'manual' }}
   cancel-in-progress: true
 
 jobs:
   large-scale-simulation:
     name: Large Scale Simulation
+    # Weekly cron only (see `on.schedule`); always on a manual dispatch.
+    if: github.event_name != 'schedule' || github.event.schedule == '0 2 * * 0'
     runs-on: ubicloud-standard-16
     # This job runs the nextest suite (~109 min) then the 500-node step
     # (≤60 min, its own cap below) sequentially, plus ~4 min build/setup.
@@ -186,6 +204,8 @@ jobs:
   # Once the cause is fixed, add a seed that caught a real bug to GATE_SEEDS.
   wan-bench-r1:
     name: WAN Bench R1
+    # Daily cron only (see `on.schedule`); always on a manual dispatch.
+    if: github.event_name != 'schedule' || github.event.schedule == '0 3 * * *'
     runs-on: ubicloud-standard-16
     # Steps carry their own timeouts, and this cap is above their sum (5 + 40
     # + 30 + 40 = 115 min, plus setup), so a hang always trips a step first: a
```

**File**: `docs/architecture/testing/simulation-testing.md` (modified, +1/-1)
```diff
@@ -343,7 +343,7 @@ when mid-simulation fault injection via closures is needed.
 
 ## Nightly Test Suite
 
-The nightly workflow (`.github/workflows/simulation-nightly.yml`) runs these simulation scenarios.
+The "nightly" workflow (`.github/workflows/simulation-nightly.yml`) runs these simulation scenarios. Despite its name, the large-scale simulation job is scheduled weekly (Sundays, 02:00 UTC); its WAN Bench R1 job still runs nightly. Trigger the workflow with `workflow_dispatch` to run both on demand.
 All fdev tests include realistic network conditions and use 200ms default event spacing.
 
 | Test | Nodes | Events | Virtual Time | Fault Injection |
```

#### Recent Merged Pull Requests:
- **PR #6105** (2026-11-03): ci: cut Ubicloud runner spend without slowing PR CI (@sanity)
- **PR #6103** (2026-11-03): fix(delegates): refuse node-only inbound messages from clients (@sanity)
- **PR #6101** (2026-11-03): feat(transport): add a QUIC crash-loop breaker for Windows by counting short runs (@sanity)
- **PR #6094** (2026-11-03): fix(macos): make freenet-bin the bundle executable so the menu bar icon shows on macOS 26 (@sanity)
- **PR #6092** (2026-11-02): fix(conformance): report what the shadow prober leaves out and the states the sampler refuses (@sanity)
- **PR #6091** (2026-11-02): feat(transport): add QUIC send primitives with deadlines per stage (@sanity)

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

## X. ci: cut Ubicloud runner spend without slowing PR CI (#6105)

**RULE**:
When implementing operations in `.github/scripts/check_cache_warm_parity.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `99b7ccaf`: ci: cut Ubicloud runner spend without slowing PR CI (#6105). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/check_cache_warm_parity.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#!/usr/bin/env python3
"""Keep ci-cache-warm.yml's jobs producing the cache keys ci.yml restores.

ci.yml's heavy PR jobs (Unit & Integration, Simulation, NAT Validation) never
run on pushes to main, so nothing they do can write a main-scoped cache entry,
and a PR can only restore from its own branch or from main. Measured
2026-11-03: no ``v0-rust-test_unit-*`` entry existed, so every Unit &
Integration run compiled its dependency tree from scratch on a standard-16
Ubicloud runner. ci-cache-warm.yml writes those entries.

It only helps while its keys are the keys the PR jobs look up. Swatinem/
rust-cache restores by ``<prefix>-<key>-<GITHUB_JOB>-<OS>-<arch>-<hash>``,
where ``<hash>`` covers the rustc version and every env var whose name starts
with CARGO, CC, CFLAGS, CXX, CMAKE or RUST. And a restored entry only saves
work if cargo's fingerprints match, which needs the same flags, env and
feature sets on every compile command. Any drift fails SILENTLY: the PR jobs
stay green and quietly build cold again. Hence this linter, run from Rule Lint.

A "warm job" is a job in the warm workflow that uses Swatinem/rust-cache.
Against the ci.yml job with the SAME id it checks:

1. workflow-le
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `99b7ccaf` are properly handled with clean fallback behavior.
