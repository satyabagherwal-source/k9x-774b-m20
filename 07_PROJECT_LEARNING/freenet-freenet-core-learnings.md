> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `bce01abd`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T12:48:16.258Z  
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
> **Harvest Timestamp**: 2026-11-16T12:48:16.251Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3125 stars

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
- **Issue #6241** (2026-11-16): **fix(transport): emergency stop of the QUIC data ramp**
  *Symptoms*: ## Problem  0.2.158 started the QUIC data ramp (#6224, T0 2026-11-16 02:30 UTC). Release-watch telemetry from 0.2.158 nodes, at a share of 5% (now 6-7% and rising):  - Loss on the paths that carry data rose from 2.1% at 07:00 UTC to 3-3.7% per 10 min at 08:00 UTC, above twice the loss on shadow paths for 2 h (watch rule 3, HOLD). - Paths that carry data end in reset fallbacks at about 5x the rate of shadow paths (watch rule 5). - In the 08:00 UTC hour, legacy cwnd-wait timeouts were about 2x on nodes carrying QUIC data compared with matched nodes without, and `transfer_failed` on 0.2.158 was 20.9%, mostly cwnd timeouts.  The cause is not yet known. The ramp reaches 25% at T0 + 12 h and 100% at T0 + 24 h, so this stops it.  ## Approach  This returns exactly to 0.2.156's state, because an emergency release should only go back to states the field has run (docs/RELEASING.md, "Emergency stop"):  - `QUIC_DATA_RAMP_START = None`: every `prefer` node gets a share of 0, so no pair carries data. `QUIC_DATA_RAMP_RELEASE` stays `Some("0.2.158")`, so a later version passes the release check as "no ramp start" and 0.2.158 itself is refused. - `QuicMode::default_mode()` back to 0.2.156's: shadow on Linux and macOS (endpoints and shadow paths stay up; off would tear every endpoint down mid-incident), off on Windows (no release before 0.2.157 ran QUIC on Windows). - `QUIC_DATA_PERCENT` stays 0. A new pin, `the_constants_are_in_a_shape_a_release_ships`, requires that on Linux and macOS a build

- **Issue #6239** (2026-11-16): **fix(transport): count local QUIC path closes by reason; leave dark paths with UDP to the idle timeout**
  *Symptoms*: ## Problem  Since 0.2.158 carries data over QUIC (ramp from 5% of pairs), carried paths fall back with `reset` about five times as often as shadow paths. Two things are behind that number.  1. **Labelling.** When this node closes a path itself (an acknowledgement-watch rule, the stalled-sends count, send aborts, over budget), quinn reports the end as `LocallyClosed`, which the upgrade machine reads as a lost connection and counts as `quic_fallback_reset` / `quic_carried_fallback_reset`. The reason the closer recorded (`QuicCloser::close_for`) was never consulted, so our own liveness closes were indistinguishable from peer resets. 2. **The dark rule closes paths that would recover.** Most of those closes are the dark rule (`recycle::AckWatch`, `Stall::Dark`), which closes a carrying path after roughly 30-75 s with nothing heard from the peer. On 0.2.158's shadow paths (which only count episodes), per 1000 path-hours: 47 dark episodes recovered after 30-120 s, 0.28 after 120 s or more, and 129 never recovered. So about a quarter of the episodes that last past the rule's close would have recovered. A close drops the one-packet Shorts still waiting for their acknowledgement: `MaybeDelivered` is never resent, by design (a resend could deliver twice, since a dark path may be dark in one direction only). The rule's own record (#6202) notes that new data already leaves a dark path after 10-15 s through suspect routing, so "the close only frees the path", and quinn's idle timeout (120

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

### Incident Patch 1: `61dfd129` (2026-11-16)
**Commit Message**: fix(transport): count local QUIC path closes by reason; leave dark paths with UDP to the idle timeout (#6239)

**File**: `.claude/rules/transport.md` (modified, +61/-27)
```diff
@@ -1400,11 +1400,16 @@ snapshot except the two gauges.
   offered and declined_uncharged. Both sides count `established`; only the
   offerer's is the numerator. Counts are node-wide; there is no per-pair series.
   `quic_fallback_<label>` (`QuicFallback`): idle, reset, protocol, downgrade_rx,
-  endpoint_down, session_ended_rx, over_budget_rx. Paths that had been active only; an attempt
-  that ends in setup is counted in `quic_upgrade_*`. A close this node sent for
-  send_abort_limit or peer_not_acknowledging reaches the machine as a lost
-  connection, so it counts as `reset`; its count is `quic_close_sent_*`. A key
-  mismatch is `quic_upgrade_identity_mismatch`.
+  endpoint_down, session_ended_rx, over_budget_rx, liveness_tx, closed_tx. Paths that had been active only; an attempt
+  that ends in setup is counted in `quic_upgrade_*`. A close this node sent
+  reaches the machine as a lost connection; since 0.2.159 the driver counts it
+  by the reason the closer recorded (`QuicCloser::close_for`, read at the
+  count, `driver::fallback_label`): `liveness_tx` for the acknowledgement
+  watch's rules and the stalled-sends count (which rule: quic_stall_close_*),
+  `closed_tx` for every other recorded reason (send aborts, a peer over its
+  budget, refused data, a panicked receive task). A close with no recorded
+  reason, and a real reset, stay `reset`. Releases before 0.2.159 count all of
+  these as `reset`. A key mismatch is `quic_upgrade_identity_mismatch`.
   session_ended_rx is the peer closing with SESSION_ENDED (6): its UDP session
   to this node ended (a prune or a restart). It is charged like downgrade_rx.
   In setup this node counts the same close as `setup_downgrade_rx`, since
@@ -1431,7 +1436,8 @@ snapshot except the two gauges.
   negative. Subtract only over windows much longer than 150 s (an hour or a
   day). The Step 2 gate, fallbacks per path-day excluding endpoint and
   restart causes, is then
-    (sum over c in idle, reset, protocol, downgrade_rx, over_budget_rx of
+    (sum over c in idle, reset, protocol, downgrade_rx, over_budget_rx,
+       liveness_tx, closed_tx of
        quic_fallback_<c> - quic_churned_fallback_<c>) / path-days,
   with endpoint_down and session_ended_rx left out entirely (session_ended_rx
   is churn by definition). over_budget_rx is in the sum: it is a close that
@@ -1547,9 +1553,10 @@ a test passes its own; tests read their own, never the global).
   read at the watch's 2 s samples, so none recovers in under 2 s, and
   `cap_held` is an episode ended by the egress cap holding this side's sends
   (the watch cannot tell then whether the peer is dark). The
-  dark-path rule closes only a path that carries data (QuicPath::enable_data);
-  on every other path (shadow paths, and pairs outside the ramp's share) it
-  only counts, so the field shows how long real dark spells last. A spell is read
+  dark-path rule closes only a path that carries data (QuicPath::enable_data)
+  and has no UDP session (a native path, recycle::DARK_CLOSES_WITH_UDP);
+  on every other path (shadow paths, pairs outside the ramp's share, and data
+  paths with a UDP session) it only counts, so the field shows how long real dark spells last. A spell is read
   up to when the peer is next heard from, which waits for quinn's backed-off
   probes after the outage ends, so it reads longer than the outage (in
   a_path_without_data_is_not_closed_by_a_dark_spell a 30 s outage read about
@@ -2227,7 +2234,7 @@ Sending (QuicPath::send_short_bounded / send_stream_bounded /
   the wait to a small task (at most 48 per path, each ending with the
   connection). A one-packet Short holds no permit but its send epoch, and
   waits the same way, at most ACK_WAITS_WITHOUT_PERMIT (64) per path, each
-  for at most SHORT_ACK_WAIT (120 s), after which its stream is reset,
+  for at most SHORT_ACK_WAIT (150 s), after which its stream is reset,
   freeing the epoch, and may count as a strike (liveness rules, below); a
   control frame's wait is bounded the same way; past
   that its epoch is released at once and counted
@@ -2683,10 +2690,28 @@ Path recycling (quic/recycle.rs, #5940 step M6): besides the send-reset
     sooner: a send that times out with nothing acknowledged for 10 s makes
     the path suspect (route::StallCount), and new data then goes on UDP at
     once, about 10-15 s after the silence began
-    (a_dark_path_takes_no_new_data_long_before_the_watch_closes_it). So a
+    (a_dark_path_takes_no_new_data_and_the_watch_does_not_close_it). So a
     dead path costs new traffic seconds; the close only frees the path.
-    Closes only a path that carries data (QuicPath::enable_data); every
-    other path only counts its dark episodes (quic_dark_episode_*, above).
+    Closes only a path that carries data (QuicPath::enable_data) and has no
+    UDP session (a native path); every other path only counts its dark
+    episodes (quic_dark_episode_*, above). On a data path with a UDP session
+    
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +13/-3)
```diff
@@ -511,9 +511,9 @@ labelled_counters! {
     /// `quic_fallback_<label>`. An attempt that ended before it was active is
     /// not here; see `quic_upgrade_*`. The UDP session ending under a path is
     /// `quic_upgrade_session_ended_active`.
-    /// Not here: a close this node sent for `send_abort_limit` or
-    /// `peer_not_acknowledging` reaches the machine as a lost connection
-    /// (`reset`), and is counted by `quic_close_sent_*`; the same codes sent
+    /// A close this node sent reaches the machine as a lost connection; it is
+    /// counted by the reason the closer recorded (`liveness_tx`, `closed_tx`),
+    /// and its code by `quic_close_sent_*`; the codes sent
     /// by the peer are `downgrade_rx`, with the raw code in
     /// `quic_close_received_*`. A key mismatch is
     /// `quic_upgrade_identity_mismatch`.
@@ -537,6 +537,16 @@ labelled_counters! {
         /// peer's QUIC buffer budget than it allows. A peer on a release
         /// before the code does not send it.
         OverBudgetReceived => "over_budget_rx",
+        /// This node closed it because the peer stopped making progress on
+        /// it: an acknowledgement-watch rule (`quic_stall_close_<stall>`
+        /// says which) or the stalled-sends count. Counted as `reset` by
+        /// releases before the label.
+        LivenessClosed => "liveness_tx",
+        /// This node closed it for another recorded reason: too many reset
+        /// sends, the peer over its buffer budget, refused data, or a
+        /// panicked receive task. Counted as `reset` by releases before the
+        /// label.
+        LocallyClosed => "closed_tx",
     }
 }
 
```

**File**: `crates/core/src/transport/metrics/quic_data.rs` (modified, +10/-7)
```diff
@@ -30,10 +30,10 @@
 //! | `quic_gate_loss_<verdict>` | congestion events by the loss gate's verdict (`recycle::loss_gate`): passed to Cubic as `queue`, `share` (loss share above the ceiling), `persistent`, `ecn` (a congestion mark), `no_sample`, or `ignored` as random loss; summed over the node's paths up to each path's last tick. Over a path's life they sum to its `quic_congestion_events`; within one period they can differ by the events between the two reads of a tick |
 //! | `quic_gate_ended_queue_<bucket>` | paths that ended in the period after at least 20 gate verdicts, by the share of them passed as `queue`: `lt_10pct`, `lt_50pct`, `ge_50pct`. A path whose losses mostly read as a queue runs as plain Cubic, whether the queue is real or jitter |
 //! | `quic_carried_dark_episode_<label>` | the same, for the episodes of paths that carried data when the episode ended: a subset of `quic_dark_episode_<label>`, counted by the same decision |
-//! | `quic_dark_episode_<label>` | dark episodes on QUIC paths (`recycle::AckWatch`: packets outstanding, nothing acknowledged and nothing heard) by how they ended: `recovered_lt_5s`, `lt_10s`, `lt_30s`, `lt_120s`, `recovered_ge_120s`, `unrecovered` (the path closed, or nothing was outstanding any more), `cap_held` (the egress cap held this side's sends, so darkness could no longer be told), `closed_at_window` (the dark-path rule closed a path that carries data). A path that carries no data is never closed by that rule, so its episodes run to their end; read at the watch's 2 s ticks |
-//! | `quic_ack_wait_expired_<label>` | sends whose wait for the acknowledgement of their end ran out and whose stream was reset, by kind: `stream` (a send with an ack wait: a Stream, or a Short past one packet), `short` (a one-packet Short, past its 120 s bound) or `control` (a control frame, bounded as a one-packet Short); only those that count as strikes (`path::StrikeCheck`: evidence the end went out and the peer is alive). An honest peer acknowledges an end within a few round trips, so this should be 0 on every honest path (`recycle::ACK_WAIT_EXPIRY_LIMIT` in `ACK_WAIT_EXPIRY_WINDOW` counts a would-close; the rule does not close a path yet) |
+//! | `quic_dark_episode_<label>` | dark episodes on QUIC paths (`recycle::AckWatch`: packets outstanding, nothing acknowledged and nothing heard) by how they ended: `recovered_lt_5s`, `lt_10s`, `lt_30s`, `lt_120s`, `recovered_ge_120s`, `unrecovered` (the path closed, or nothing was outstanding any more), `cap_held` (the egress cap held this side's sends, so darkness could no longer be told), `closed_at_window` (the dark-path rule closed a path that carries data and has no UDP session, a native path). A path that carries no data, and since 0.2.159 a data path with a UDP session (`recycle::DARK_CLOSES_WITH_UDP`), is never closed by that rule, so its episodes run to their end (a data path with a UDP session counts the close the rule would have made in `quic_stall_would_close_dark`); read at the watch's 2 s ticks |
+//! | `quic_ack_wait_expired_<label>` | sends whose wait for the acknowledgement of their end ran out and whose stream was reset, by kind: `stream` (a send with an ack wait: a Stream, or a Short past one packet), `short` (a one-packet Short, past its 150 s bound) or `control` (a control frame, bounded as a one-packet Short); only those that count as strikes (`path::StrikeCheck`: evidence the end went out and the peer is alive). An honest peer acknowledges an end within a few round trips, so this should be 0 on every honest path (`recycle::ACK_WAIT_EXPIRY_LIMIT` in `ACK_WAIT_EXPIRY_WINDOW` counts a would-close; the rule does not close a path yet) |
 //! | `quic_stall_close_<label>` | paths the acknowledgement watch closed, by why: `not_acknowledging`, `dark`, `credit_starved`, `stream_credit_withheld`, `ack_waits_expired` (`recycle::Stall`) |
-//! | `quic_stall_would_close_<label>` | times a rule that only observes would have closed a path, by the same labels; each count starts the rule's window afresh. Only `ack_waits_expired` observes today (`recycle::ACK_WAITS_EXPIRED_CLOSES` is false): it counts each time `ACK_WAIT_EXPIRY_LIMIT` strikes came within `ACK_WAIT_EXPIRY_WINDOW`, for calibrating the close from the field (#6205) |
+//! | `quic_stall_would_close_<label>` | times a rule that only observes would have closed a path, by the same labels; each count starts the rule's window afresh. Two rules observe today. `ack_waits_expired` (`recycle::ACK_WAITS_EXPIRED_CLOSES` is false) counts each time `ACK_WAIT_EXPIRY_LIMIT` strikes came within `ACK_WAIT_EXPIRY_WINDOW`, for calibrating the close from the field (#6205). `dark` counts once per episode on a data path with a UDP session, where the dark rule does not close (`recycle::DARK_CLOSES_WITH_UDP` is false); the episode is counted to its end in `quic_carried_dark_episode_<label>` |
 //! | `quic_send_resets`, `quic_path_ms` | sends a path reset on this side, and the time QUIC paths were u
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests/quic_send.rs` (modified, +102/-66)
```diff
@@ -934,9 +934,12 @@ fn a_busy_relay_whose_transfers_are_acknowledged_keeps_its_path() {
 /// Permits held by sends waiting for acknowledgements that never come: nothing on
 /// the path is acknowledged and every large message times out waiting for a
 /// permit. Those timeouts are back-pressure and do not count toward the stall
-/// close; the acknowledgement watch's dark-path rule closes the path instead.
+/// close. The path has a UDP session, so the acknowledgement watch's dark rule
+/// counts the close it would make and does not close
+/// (`recycle::DARK_CLOSES_WITH_UDP`): past the rule's latest close the path is
+/// still up, closed by no rule.
 #[test]
-fn permits_held_with_nothing_acknowledged_close_the_path() {
+fn permits_held_with_nothing_acknowledged_do_not_close_a_path_with_udp() {
     run(
         "quic-send-held-permits",
         // Every permit held needs a peer at the full stream limit.
@@ -958,13 +961,13 @@ fn permits_held_with_nothing_acknowledged_close_the_path() {
                     .await
                     .unwrap();
             }
-            // The dark rule closes once a send made a window into the spell
-            // goes unanswered for its grace: at the latest
+            // On a native path the dark rule would have closed by
             // `dark_close_bound` after the silence began, 9 s of which have
-            // passed.
+            // passed; wait past it.
             rig.path
                 .settle(
                     crate::transport::quic::recycle::dark_close_bound(Duration::from_millis(50))
+                        + Duration::from_secs(10)
                         - Duration::from_secs(9),
                 )
                 .await;
@@ -979,54 +982,77 @@ fn permits_held_with_nothing_acknowledged_close_the_path() {
                 0,
                 "a send that never opened does not count"
             );
-            assert!(rig.route.path().quinn_connection().close_reason().is_some());
-            assert_eq!(
-                crate::transport::quic::recycle::stalls_to(rig.path.peer_addr()),
-                vec![crate::transport::quic::recycle::Stall::Dark],
-                "closed by the watch as dark"
+            assert!(
+                rig.route.path().quinn_connection().close_reason().is_none(),
+                "{:?}",
+                rig.route.path().quinn_connection().close_reason()
+            );
+            assert!(
+                crate::transport::quic::recycle::stalls_to(rig.path.peer_addr()).is_empty(),
+                "no rule closed it"
             );
         },
     );
 }
 
 /// Eight streams that open and then stop moving, with nothing acknowledged past the
-/// window, close the path.
+/// window, close the path, with or without a UDP session. On a path with one the
+/// stall close leaves alone only a path the dark rule would already have closed
+/// (`recycle::AckWatch::publishing_dark`); here the eighth timeout comes about
+/// 16 s into the silence, before the dark rule's close (at the earliest two
+/// probe rounds after its 10 s window), so the stall close is made as before.
+/// The skip itself is `the_stall_close_leaves_a_path_the_dark_rule_would_have_closed`.
 #[test]
 fn eight_streams_that_stall_after_opening_close_the_path() {
-    run_with(
-        "quic-send-stall-close",
-        // The stall count's close, which the acknowledgement watch would
-        // otherwise preempt on this dark path (`recycle::AckWatch`).
-        QuicPathLimits {
-            watch_closes: false,
-            ..QuicPathLimits::DEFAULT
-        },
-        QuicPathLimits::DEFAULT,
-        |mut rig| async move {
-            let silenced = DropFrom::new("quic-send-stall-close", &[rig.path.peer_addr()]);
-            rig.path.settle(Duration::from_secs(6)).await;
-            for _ in 0..STALLED_SENDS_LIMIT {
-                rig.e
-                    .conn
-                    .outbound_stream_with_id(
-                        StreamId::next(),
-                        bytes_of(4 * 1024 * 1024),
-                        None,
-                        None,
-                        None,
-                    )
-                    .await;
-            }
-            rig.path.settle(Duration::from_secs(10)).await;
-            drop(silenced);
-            assert_eq!(
-                rig.stats().send_count(SendKind::Stream, R::Dropped),
-                u64::from(STALLED_SENDS_LIMIT)
-            );
-            assert_eq!(rig.stats().send_event_count(E::StalledClosed), 1);
-            assert!(rig.route.path().quinn_connection().close_reason().is_some());
-        },
-    );
+    for (network, udp_fallback) in [
+        ("quic-send-stall-close", false),
+        ("quic-send-stall-close-udp", true),
+    ] {
+        run_with(
+            network,
+            // The stall count's close, which the acknowledgement watch would
+            // otherwise preempt on this dark path (`recycle::AckWatch`). The
+            // watch 
```

**File**: `crates/core/src/transport/quic.rs` (modified, +27/-0)
```diff
@@ -1239,6 +1239,27 @@ impl Drop for QuicConnection {
     }
 }
 
+/// Why this node closed a connection, if it said ([`QuicCloser::close_for`]),
+/// readable without holding the connection.
+#[derive(Clone, Default)]
+pub(crate) struct CloseRecord(Arc<std::sync::OnceLock<crate::transport::boundary::QuicPathEnd>>);
+
+impl CloseRecord {
+    /// A record of a close for `end`. Tests only.
+    #[cfg(test)]
+    pub(crate) fn of(end: crate::transport::boundary::QuicPathEnd) -> Self {
+        let record = Self::default();
+        let _first = record.0.set(end);
+        record
+    }
+
+    /// Why this node closed the connection, if it closed it with
+    /// [`QuicCloser::close_for`].
+    pub(crate) fn get(&self) -> Option<crate::transport::boundary::QuicPathEnd> {
+        self.0.get().copied()
+    }
+}
+
 /// Closes one QUIC connection at most once, from any number of clones.
 /// Every close the QUIC code sends goes through here.
 #[derive(Clone)]
@@ -1344,6 +1365,12 @@ impl QuicCloser {
         self.closed_for.get().copied()
     }
 
+    /// A handle on [`Self::closed_for`] that does not hold the connection,
+    /// for whoever must read why it was closed after letting it go.
+    pub(crate) fn close_record(&self) -> CloseRecord {
+        CloseRecord(Arc::clone(&self.closed_for))
+    }
+
     /// Whether the connection is still open (quinn has no close reason).
     pub(crate) fn is_open(&self) -> bool {
         self.connection.close_reason().is_none()
```

**File**: `crates/core/src/transport/quic/path.rs` (modified, +52/-20)
```diff
@@ -333,7 +333,7 @@ pub(crate) struct QuicPathLimits {
     #[cfg(test)]
     pub(crate) staging_cap: Option<usize>,
     /// The bound on a one-packet Short's background ack wait, in place of
-    /// [`SHORT_ACK_WAIT`], for a test that cannot wait two minutes.
+    /// [`SHORT_ACK_WAIT`], for a test that cannot wait 150 s.
     #[cfg(test)]
     pub(crate) short_ack_wait: Option<Duration>,
     /// While the flag is set, the receive side cancels the handle of the
@@ -802,8 +802,9 @@ pub(crate) struct QuicPath {
     short_ack_wait: Duration,
     /// The path's clock, for judging expired ack waits ([`StrikeCheck`]).
     clock: Arc<dyn Fn() -> u64 + Send + Sync>,
-    /// Set once the path may send data: only then does the acknowledgement
-    /// watch's dark-path rule close it (`recycle::AckWatch::observing`).
+    /// Set once the path may send data: only then may the acknowledgement
+    /// watch's dark-path rule close it, and only a path with no UDP session
+    /// (`recycle::AckWatch::observing`, `recycle::DARK_CLOSES_WITH_UDP`).
     carries_data: Arc<std::sync::atomic::AtomicBool>,
     /// Control frames taking their stream ([`Self::control_first`]); a data
     /// send opens no stream while any is.
@@ -826,6 +827,9 @@ pub(crate) struct QuicPath {
     udp_fallback: bool,
     /// Send timeouts while nothing is acknowledged ([`route::StallCount`]).
     stall: parking_lot::Mutex<route::StallCount>,
+    /// Set while the acknowledgement watch sees a dark episode
+    /// (`recycle::WatchShared::dark`), read by the stall close.
+    dark: Arc<std::sync::atomic::AtomicBool>,
     /// The [`bounded::QuietProof`] sends that ran out of gap left, read (not
     /// taken) by every settle; a proof of the same counts is merged into it.
     quiet: Arc<parking_lot::Mutex<Option<bounded::QuietProof>>>,
@@ -1099,6 +1103,7 @@ impl QuicPath {
         }
         let ack_waits = Arc::new(AckWaits::new(stats.clone()));
         let carries_data = Arc::new(std::sync::atomic::AtomicBool::new(false));
+        let dark = Arc::new(std::sync::atomic::AtomicBool::new(false));
         let receive = GlobalExecutor::spawn(supervise_receive(
             connection.inner().clone(),
             connection.closer(),
@@ -1112,6 +1117,8 @@ impl QuicPath {
                     rtt: receiver_rtt,
                     heard: heard.clone(),
                     carries_data: carries_data.clone(),
+                    udp_fallback: limits.udp_fallback,
+                    dark: dark.clone(),
                 },
                 report,
             },
@@ -1139,6 +1146,7 @@ impl QuicPath {
                 ended_as_data_path,
                 udp_fallback: limits.udp_fallback,
                 stall: parking_lot::Mutex::new(stall),
+                dark,
                 quiet: Arc::default(),
                 last_acked: Arc::new(bounded::AckRecord::new(
                     ack_progress.as_ref().map_or(0, recycle::AckProgress::acked),
@@ -1177,6 +1185,11 @@ impl QuicPath {
         self.connection.closer().closed_for()
     }
 
+    /// A handle on [`Self::closed_for`] that outlives the path.
+    pub(in crate::transport) fn close_record(&self) -> crate::transport::quic::CloseRecord {
+        self.connection.closer().close_record()
+    }
+
     /// Pace this path's data sends with `pacer` (`pacer` module): the
     /// connection's token bucket when a bandwidth limit is set. A second call
     /// changes nothing.
@@ -1434,13 +1447,21 @@ impl QuicPath {
         self.connection.close(code);
     }
 
-    /// [`Self::close`], recording `cause` as why this node closed.
+    /// [`Self::close`], recording `cause` as why this node closed. Whether this
+    /// call closed the connection (not if it was closed or closing already).
     pub(in crate::transport) fn close_for(
         &self,
         code: QuicCloseCode,
         cause: crate::transport::boundary::QuicPathEnd,
-    ) {
-        self.connection.closer().close_for(code, cause);
+    ) -> bool {
+        self.connection.closer().close_for(code, cause)
+    }
+
+    /// Set the acknowledgement watch's dark flag (`recycle::WatchShared::dark`)
+    /// by hand. Tests only.
+    #[cfg(test)]
+    pub(crate) fn set_dark_for_test(&self, dark: bool) {
+        self.dark.store(dark, std::sync::atomic::Ordering::Release);
     }
 
     /// The quinn connection, to wait for its end.
@@ -1452,8 +1473,8 @@ impl QuicPath {
     /// separate, set by [`QuicPathLimits::accept_data`] when the path is built.
     pub(in crate::transport) fn enable_data(&self) {
         self.send_data.store(SEND_DATA_ON, Ordering::Release);
-        // From now on the dark-path rule closes the path
-        // (`recycle::AckWatch::observing`).
+        // From now on the dark-path rule closes the path if it has no UDP
+        // session (`recycle::AckWatch::observing`, `DARK_CLOSES_WITH_UDP`).
         self.carries_data.store(true, Ordering::Release);
     }
 
@@ -1568,8 +1589,9 @@ impl QuicPath {

```

**File**: `crates/core/src/transport/quic/path/route.rs` (modified, +47/-10)
```diff
@@ -180,7 +180,8 @@ pub(crate) fn next_step(kind: SendKind, outcome: &BoundedSend) -> (NextStep, Qui
 /// of this side's permits or for the peer's stream credit, which is
 /// back-pressure, not a stall. What ends the cases these timeouts no longer
 /// count: a path whose sends nothing acknowledges is closed by its
-/// acknowledgement watch's dark-path rule (`recycle::AckWatch`); a peer that
+/// acknowledgement watch's dark-path rule (`recycle::AckWatch`) if it has no
+/// UDP session, and by quinn's idle timeout if it has one; a peer that
 /// acknowledges other traffic but never a stream's end has the stream reset
 /// at its ack wait (`bounded::SendDeadlines::ack_wait`), and three strikes
 /// within 30 min are counted as a would-close
@@ -224,8 +225,11 @@ pub(crate) fn hold_credit(cap: &CapHoldReading) -> Duration {
 /// What [`StallCount::take`] decided.
 #[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
 pub(crate) struct StallVerdict {
-    /// The eighth such timeout in a row: close the path.
+    /// The eighth such timeout in a row or a later one: close the path.
     pub(crate) close: bool,
+    /// The eighth exactly: the close is counted here even when the path was
+    /// already closed, as before a close could be left for a later timeout.
+    pub(crate) at_limit: bool,
     /// A timeout that counted: the path made no progress for the window.
     pub(crate) quiet_timeout: bool,
 }
@@ -248,8 +252,11 @@ pub(crate) struct StallVerdict {
 /// The first counted timeout also makes the path suspect
 /// ([`QuicPath::become_suspect`]), which keeps new sends off it. So on a path
 /// that went dark the close fires only if `STALLED_SENDS_LIMIT` sends were
-/// already on it; otherwise the acknowledgement watch's dark rule closes it
-/// (`recycle::dark_close_bound`), with its new data on UDP meanwhile.
+/// already on it, and on a path with a UDP session only before the dark rule
+/// would have closed it (`QuicPath::settle`); otherwise a native path is closed
+/// by the acknowledgement watch's dark rule (`recycle::dark_close_bound`) and
+/// one with a UDP session by quinn's idle timeout, with its new data on UDP
+/// meanwhile.
 ///
 /// The acknowledgement count is read when a send settles, so progress is seen at
 /// the next settle after it, within one send's deadline. A receiver whose
@@ -368,7 +375,12 @@ impl StallCount {
         }
         self.in_a_row += 1;
         StallVerdict {
-            close: self.in_a_row == STALLED_SENDS_LIMIT,
+            // At or past the limit: a close left alone at the limit (a dark
+            // path with a UDP session, `QuicPath::settle`) is tried again at
+            // the next counted timeout. Closing an already closed path sends
+            // and counts nothing.
+            close: self.in_a_row >= STALLED_SENDS_LIMIT,
+            at_limit: self.in_a_row == STALLED_SENDS_LIMIT,
             quiet_timeout: true,
         }
     }
@@ -474,7 +486,36 @@ impl QuicPath {
         if let (true, Some(acked), true) = (verdict.quiet_timeout, acked, self.udp_fallback) {
             self.become_suspect(acked);
         }
-        if verdict.close {
+        // A path the dark rule would have closed by now (the acknowledgement
+        // watch's flag, `recycle::AckWatch::publishing_dark`: two probe rounds
+        // after its window unanswered, nothing heard from the peer) is the
+        // dark rule's: on a path with a UDP session new sends already go on
+        // UDP (suspect, above), and the close is left to quinn's idle timeout,
+        // as the dark rule leaves it (`recycle::DARK_CLOSES_WITH_UDP`). A
+        // stall the dark rule would not have closed (the peer still heard, or
+        // before the rule's close) closes as before, and so does a native
+        // path. The flag moves at the watch's 2 s samples, the same samples the
+        // dark rule decides at, so a stall close before the flag is set is one
+        // the dark rule had not yet made either.
+        if verdict.close
+            && self.udp_fallback
+            && !recycle::DARK_CLOSES_WITH_UDP
+            && self.dark.load(std::sync::atomic::Ordering::Acquire)
+        {
+            tracing::debug!(
+                in_a_row = STALLED_SENDS_LIMIT,
+                "QUIC path: sends keep timing out and the peer is silent; the path is \
+                 left to the idle timeout, and new data goes on UDP"
+            );
+        } else if verdict.close
+            && (self.close_for(
+                QuicCloseCode::Downgrade,
+                crate::transport::boundary::QuicPathEnd::Stalled,
+            ) || verdict.at_limit)
+        {
+            // Counted once: at the limit, or at the later timeout that made a
+            // close left alone at the limit; a verdict after that finds the
+            // path closed.
             self.stats.record_send_event(QuicSendEvent::StalledClosed);
             if self.udp_fallback {
                 tracing::warn!(

```

**File**: `crates/core/src/transport/quic/path/tests.rs` (modified, +155/-22)
```diff
@@ -149,6 +149,21 @@ struct Windows {
     b: Option<Arc<super::super::budget::QuicBudget>>,
 }
 
+/// [`paths`] with `a`'s path a native connection's ([`QuicPathLimits::NATIVE`]):
+/// no UDP session, so its dark rule closes (`recycle::DARK_CLOSES_WITH_UDP`).
+async fn paths_native(network: &str) -> Paths {
+    paths_built(
+        network,
+        QuicPathLimits::DEFAULT,
+        QuicPathLimits::NATIVE,
+        None,
+        None,
+        Windows::default(),
+        true,
+    )
+    .await
+}
+
 /// [`paths`] with each side's path taking its windows from a buffer budget.
 async fn paths_metered(network: &str, windows: Windows) -> Paths {
     paths_built(
@@ -1407,7 +1422,7 @@ fn ack_wait_expiries_under_this_nodes_egress_cap_are_not_strikes() {
 /// A one-packet Short's acknowledgement is waited for in the background once
 /// its send has ended (here at its own 50 ms deadline, on a 200 ms round
 /// trip), holding its send epoch. The wait is bounded (here 10 ms in place of
-/// `SHORT_ACK_WAIT`, 120 s): past it the stream is reset and the epoch is
+/// `SHORT_ACK_WAIT`, 150 s): past it the stream is reset and the epoch is
 /// released. Nothing else was acknowledged meanwhile, so it is not a strike
 /// (`ack_wait_expiries_count_a_would_close_whatever_else_is_acknowledged` covers
 /// strikes). An honest peer acknowledges the Short's one packet on arrival,
@@ -1911,7 +1926,7 @@ fn ack_wait_expiries_on_a_congestion_limited_slow_path_are_not_strikes() {
 /// the dark rule tolerates (11 s on a fast path, 30 s at an 800 ms round
 /// trip), on virtual time, which runs no keepalive (as the simulations):
 /// after the outage quinn's probes bring the peer back and the Shorts are
-/// retransmitted and acknowledged within their 120 s background wait
+/// retransmitted and acknowledged within their 150 s background wait
 /// (`SHORT_ACK_WAIT`). None is reset and the path is not closed.
 #[test]
 fn one_packet_shorts_through_a_tolerated_outage_do_not_expire() {
@@ -4524,26 +4539,39 @@ impl Scripted {
     /// while no release sends data on QUIC: its watch counts dark spells and
     /// does not close on them.
     async fn connect_without_data(network: &str) -> Self {
-        Self::connect_built(network, None, false, None).await
+        Self::connect_built(network, None, QuicPathLimits::SHADOW, None).await
+    }
+
+    /// [`Self::connect`] with `a`'s path a native connection's
+    /// ([`QuicPathLimits::NATIVE`]): no UDP session to fall back to, so the
+    /// dark rule closes it (`recycle::DARK_CLOSES_WITH_UDP`).
+    async fn connect_native(network: &str) -> Self {
+        Self::connect_built(network, None, QuicPathLimits::NATIVE, None).await
+    }
+
+    /// [`Self::connect`] (a data path with a UDP session) with quinn's idle
+    /// timeout set to `idle` on both ends, as a node's is (120 s).
+    async fn connect_idle(network: &str, idle: Duration) -> Self {
+        Self::connect_built(network, None, QuicPathLimits::DEFAULT, Some(idle)).await
     }
 
     /// [`Self::connect_without_data`] with quinn's idle timeout set to
     /// `idle` on both ends, as a node's is (120 s), in place of virtual
     /// time's 24 h. Keepalives stay off: virtual time has none.
     async fn connect_without_data_idle(network: &str, idle: Duration) -> Self {
-        Self::connect_built(network, None, false, Some(idle)).await
+        Self::connect_built(network, None, QuicPathLimits::SHADOW, Some(idle)).await
     }
 
     /// [`Self::connect`] with a node-wide egress cap of `a_cap` bytes per
     /// second on `a`'s socket.
     async fn connect_capped(network: &str, a_cap: Option<u64>) -> Self {
-        Self::connect_built(network, a_cap, true, None).await
+        Self::connect_built(network, a_cap, QuicPathLimits::DEFAULT, None).await
     }
 
     async fn connect_built(
         network: &str,
         a_cap: Option<u64>,
-        data: bool,
+        a_limits: QuicPathLimits,
         idle_timeout: Option<Duration>,
     ) -> Self {
         use super::super::config::{self, QuicSettings};
@@ -4669,11 +4697,7 @@ impl Scripted {
         let counters = leaked_counters();
         let limits = QuicPathLimits {
             counters: Some(counters),
-            ..if data {
-                QuicPathLimits::DEFAULT
-            } else {
-                QuicPathLimits::SHADOW
-            }
+            ..a_limits
         };
         let (a, a_in) = QuicPath::with_limits(conn, time.clone(), limits);
         Self {
@@ -4814,7 +4838,8 @@ fn packets_left_outstanding_when_the_peer_stops_acknowledging_close_the_path() {
 
 /// #5940 step M6, guard 2 (review finding 2): an outage of 8 s in both
 /// directions in the middle of a transfer, then recovery (shorter than the
-/// window: a longer one is a dark path, closed by the dark-path rule). `b` sends all the
+/// window: a longer one is a dark path, which the dark-path rule closes on a
+/// native path and leaves to quinn's idle timeout on one with a UDP se
```

---

### Incident Patch 2: `bce01abd` (2026-11-16)
**Commit Message**: fix(transport): emergency stop of the QUIC data ramp (#6241)

**File**: `.claude/rules/transport.md` (modified, +34/-30)
```diff
@@ -1168,21 +1168,20 @@ it must not wait unless it is a pacing point.
 #### QUIC endpoint (`transport/quic.rs`, #5940 step c2)
 
 `transport-quic` (config key: `off`, `shadow` or `prefer`; unset is
-`QuicMode::default_mode`, prefer on Linux, macOS and Windows and off
-elsewhere, since the breaker cannot trip without a boot identity) decides whether `bind_udp_listener` builds a quinn endpoint over the DemuxSocket.
+`QuicMode::default_mode`, shadow on Linux and macOS and off elsewhere, Windows
+included: the data ramp's emergency stop returned to 0.2.156's defaults, the last
+state the field ran) decides whether `bind_udp_listener` builds a quinn endpoint over the DemuxSocket.
 `prefer` negotiates data with the share of pairs the ramp gives at the time ("Data
 slice" below; `upgrade::policy::log_startup` reports the share at INFO once per
 node, and each band the ramp enters is logged at INFO), and a pair with both bits
-sends its data on the path ("QUIC send route" below). The tree sets the ramp
-start for 0.2.158 (#6224), so `prefer` nodes, every Linux, macOS and Windows node
-that did not set the key, carry data with the ramp's share, and 0.2.158's release
-notes say so. With no ramp start (the emergency-stop build) and no
+sends its data on the path ("QUIC send route" below). 0.2.158 set the ramp
+start (#6224); this tree is its emergency stop, with no ramp start, so with no
 `quic-data-percent` the share is 0, and `prefer` differs from `shadow` only by the
 bit, which stays 0. Off: no endpoint, no QUIC ingress, nothing
 changes, except that `off` set in the config is deprecated and logs a WARN at
 startup (`upgrade::policy::log_startup`); the endpoint state telemetry reports it
-as `off_config`. Windows has the same default since its crash-loop breaker was
-confirmed on a real Windows machine (#6031). The default is
+as `off_config`. Windows had prefer by default from 0.2.157 (at a share of 0) until the stop (its
+crash-loop breaker was confirmed on a real Windows machine, #6031). The default is
 read, never written to config.toml: a node that did not set the key follows the
 release it runs, so a default-off release is the kill switch for QUIC as a
 whole. Stopping only the data ramp is smaller: `QUIC_DATA_RAMP_START = None`
@@ -1305,9 +1304,10 @@ pair is in the slice when its bucket is below the percentage, so 0 holds none,
   The percentage: a ramp over one release (`slice::ramp_percent`): 5% for the
   first 6 h, then linear 5 to 25% to 12 h and 25 to 100% to 24 h, 100% after,
   from `QUIC_DATA_RAMP_START` in `upgrade/policy.rs` (Unix seconds, or `None`:
-  no ramp, share 0). The start is set for 0.2.158 (#6224, 2026-11-16 02:30 UTC),
-  in its own reviewed PR at the planned publish time, and left set: past 24 h it
-  reads 100%, the steady state. Only an emergency stop sets it back to `None`. A node whose clock reads before the start gets
+  no ramp, share 0). It was set for 0.2.158 (#6224, 2026-11-16 02:30 UTC), in its
+  own reviewed PR at the planned publish time, to be left set (past 24 h it reads
+  100%, the steady state). This tree is the emergency stop, which sets it back to
+  `None`; a new ramp needs its own reviewed PR. A node whose clock reads before the start gets
   5%. Slices nest, so a pair in the slice stays in as the share grows. The config
   key `quic-data-percent` (lenient text like `quic-max-paths`; anything but a whole
   number from 0 to 100 reads as unset, with a WARN when QUIC is on) replaces the
@@ -1555,17 +1555,17 @@ a test passes its own; tests read their own, never the global).
   (the watch cannot tell then whether the peer is dark). The
   dark-path rule closes only a path that carries data (QuicPath::enable_data)
   and has no UDP session (a native path, recycle::DARK_CLOSES_WITH_UDP);
-  on every other path (shadow paths, pairs outside the ramp's share, and data
-  paths with a UDP session) it only counts, so the field shows how long real dark spells last. A spell is read
+  on every other path (all of them in the emergency-stop build, which has no
+  ramp, and data paths with a UDP session) it only counts, so the field shows how long real dark spells last. A spell is read
   up to when the peer is next heard from, which waits for quinn's backed-off
   probes after the outage ends, so it reads longer than the outage (in
   a_path_without_data_is_not_closed_by_a_dark_spell a 30 s outage read about
   45 s and a 100 s one about 200 s), and an outage whose backoff runs past
   quinn's 120 s idle timeout ends the path and counts `unrecovered`. The dark
-  threshold (the 10 s window) was not revisited before 0.2.158: the ramp passes
-  5% at T0 + 6 h with it as is. The release watch reads carried against shadow
-  dark episodes (rule 14) through the 5% plateau, and the window is to be
-  revisited from those numbers.
+  threshold (the 10 s window) was not revisited before 0.2.158, which ran the
+  ramp with it as is until this stop. The window is to be revisited from t
```

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -1203,7 +1203,7 @@ jobs:
       - name: Test service commands
         run: cargo nextest run -p freenet --bin freenet --profile ci -E 'test(commands::service) | test(commands::url_handler) | test(commands::open_link)'
 
-      # QUIC is on by default on macOS (`prefer`, #5940), and its crash-loop
+      # QUIC is on by default on macOS (`shadow`, #5940), and its crash-loop
       # breaker reads kern.boottime there: run the real-binary shutdown tests on
       # a real Mac (a clean stop clears it, a SIGKILL trips it, which needs the
       # boot identity, and a node with no setting arms it). Not the lib unit
```

**File**: `crates/core/Cargo.toml` (modified, +2/-2)
```diff
@@ -119,8 +119,8 @@ rustls-native-certs = "0.8.4"
 # Keep it semver-compatible with reqwest's rustls: os_trust probes certificates
 # with it on the assumption that reqwest validates them identically.
 rustls = { version = "0.23", default-features = false, features = ["std"] }
-# QUIC endpoint (transport/quic.rs, #5940): on by default on Linux, macOS and
-# Windows (`prefer`), off elsewhere (`transport-quic`). Only the ring rustls provider: no runtime-tokio (the endpoint runs on the
+# QUIC endpoint (transport/quic.rs, #5940): shadow by default on Linux and
+# macOS, off elsewhere, Windows included (`transport-quic`). Only the ring rustls provider: no runtime-tokio (the endpoint runs on the
 # crate's own Runtime over TimeSource, so simulation drives it), no
 # platform-verifier (peers are authenticated by raw public keys, never by a CA
 # root store), and no aws-lc-rs (deny.toml bans it).
```

**File**: `crates/core/src/config.rs` (modified, +13/-18)
```diff
@@ -363,7 +363,7 @@ impl Default for ConfigArgs {
                 ledbat_min_ssthresh: None, // Uses default from NetworkApiConfig
                 congestion_control: None,  // Default: fixedrate (set in NetworkApiConfig)
                 bbr_startup_rate: None,    // Uses default from BBR config
-                transport_quic: None,      // Default: prefer on Linux, macOS and Windows
+                transport_quic: None,      // Default: shadow on Linux and macOS, off elsewhere
                 quic_max_paths: None,      // Default: the node's connection limit
                 quic_data_percent: None,   // Default: this release's share of pairs
                 quic_ignore_crash_breaker: None,
@@ -2588,15 +2588,14 @@ pub struct NetworkArgs {
     pub bbr_startup_rate: Option<u64>,
 
     /// QUIC transport (#5940): `off`, `shadow` or `prefer`. Unset means
-    /// `prefer` on Linux, macOS and Windows, and `off` elsewhere.
+    /// `shadow` on Linux and macOS, and `off` elsewhere, Windows included.
     ///
     /// `shadow` builds a QUIC endpoint on the network port and upgrades
     /// connections to peers that also run it to a QUIC path. The path carries
     /// control frames only, so all traffic stays on the existing transport.
     /// `prefer` also negotiates data with a share of pairs (`quic-data-percent`,
     /// or this release's share: its data ramp, or 0 when it has none), and a
-    /// pair where both sides did
-    /// sends its traffic on the path. `off` builds no endpoint. An unknown value is treated as `off`,
+    /// pair where both sides did sends its traffic on the path. `off` builds no endpoint. An unknown value is treated as `off`,
     /// with a warning in the log.
     #[arg(long, env = "FREENET_TRANSPORT_QUIC", value_name = "off|shadow|prefer")]
     #[serde(rename = "transport-quic", skip_serializing_if = "Option::is_none")]
@@ -2975,7 +2974,7 @@ pub struct NetworkApiConfig {
     pub bbr_startup_rate: Option<u64>,
 
     /// QUIC transport (#5940): `off`, `shadow` or `prefer`; unset reads as
-    /// `QuicMode::default_mode` (prefer on Linux, macOS and Windows). Kept as written, so a value from a later release
+    /// `QuicMode::default_mode` (shadow on Linux and macOS, off elsewhere). Kept as written, so a value from a later release
     /// round-trips; see [`Self::quic_settings`] for how it is read.
     #[serde(
         default,
@@ -7693,21 +7692,17 @@ shutdown-drain-secs = 42
         assert_seeded_values_bound(&cfg);
     }
 
-    /// An unset `transport-quic` is prefer on Linux, macOS and Windows; Windows
-    /// joined once its crash-loop breaker was confirmed on a real Windows
-    /// machine (#6031). The lib tests do not compile on Windows, so
-    /// `tests/quic_breaker_windows.rs` pins the Windows half through the real
-    /// binary. The default is not written into the config, so a default-off
-    /// release turns QUIC off on every node that did not set the key.
+    /// An unset `transport-quic` is shadow on Linux and macOS and off on
+    /// Windows: the emergency stop of the QUIC data ramp returns to 0.2.156's
+    /// defaults, the last state the field ran. The lib tests do not compile on
+    /// Windows, so `tests/quic_breaker_windows.rs` pins the Windows half
+    /// through the real binary. The default is not written into the config, so
+    /// a release changes it for every node that did not set the key.
     #[test]
-    fn quic_is_prefer_by_default_on_linux_macos_and_windows() {
+    fn quic_is_shadow_by_default_except_on_windows() {
         use crate::transport::quic::QuicMode;
-        let expected = if cfg!(any(
-            target_os = "linux",
-            target_os = "macos",
-            target_os = "windows"
-        )) {
-            QuicMode::Prefer
+        let expected = if cfg!(any(target_os = "linux", target_os = "macos")) {
+            QuicMode::Shadow
         } else {
             QuicMode::Off
         };
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +4/-2)
```diff
@@ -1173,8 +1173,10 @@ use crate::operations::connect::native::NativeWire;
 /// high only delays the offer.
 /// Raised from 0.2.158 to 0.2.159 by the QUIC data ramp PR (#6224): 0.2.158
 /// starts the data ramp, and turning on the native connect offer in the same
-/// release would change two things at once.
-pub(crate) const QUIC_NATIVE_MIN_VERSION: (u8, u8, u16) = (0, 2, 159);
+/// release would change two things at once. Raised to 0.2.160 by the
+/// emergency stop of the ramp: a stop release goes back to states the field
+/// has run, and no release has emitted the native variants.
+pub(crate) const QUIC_NATIVE_MIN_VERSION: (u8, u8, u16) = (0, 2, 160);
 
 /// Has the decoder for the QUIC-native `ConnectMsg` variants shipped, and in
 /// which release?
```

**File**: `crates/core/src/transport/quic.rs` (modified, +17/-18)
```diff
@@ -85,12 +85,12 @@ pub(crate) use liveness::QuicAvailabilityWatch;
 
 /// Whether the node may use QUIC: the `transport-quic` config key.
 ///
-/// An unset key is [`QuicMode::default_mode`]: prefer on Linux, macOS and
-/// Windows, and off elsewhere, because the breaker reads no boot identity
+/// An unset key is [`QuicMode::default_mode`]: shadow on Linux and macOS,
+/// and off elsewhere (Windows included, since the ramp's emergency stop), because the breaker reads no boot identity
 /// there and so cannot trip. The Windows breaker counts short runs that
 /// panicked in QUIC code instead of detecting crashes ([`breaker`]); it was
-/// confirmed on a real Windows machine before Windows defaulted to an endpoint
-/// (#6031). The default is decided when the value is read and
+/// confirmed on a real Windows machine (#6031) before Windows ran QUIC by
+/// default (shadow, then `prefer`) in 0.2.157 and 0.2.158. The default is decided when the value is read and
 /// never written to `config.toml`, so a later release can change it
 /// for every node that did not set the key, which is how a default-off
 /// release turns QUIC off. A value given with `--transport-quic` or
@@ -99,7 +99,7 @@ pub(crate) use liveness::QuicAvailabilityWatch;
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 pub enum QuicMode {
     /// No QUIC endpoint is built and no QUIC datagram is read. The default on
-    /// platforms other than Linux, macOS and Windows.
+    /// platforms other than Linux and macOS, Windows included.
     Off,
     /// The node builds a QUIC endpoint on its UDP port and upgrades a UDP
     /// session to a QUIC path that carries only control frames: all
@@ -110,12 +110,13 @@ pub enum QuicMode {
     /// endpoint driver and one upgrade task per connection run; a promoted
     /// connection's higher key sends `Upgrade` messages on its UDP session; and
     /// the endpoint's memory. If the endpoint cannot be built the node logs a
-    /// warning and runs with QUIC off.
+    /// warning and runs with QUIC off. The default on Linux and macOS.
     Shadow,
     /// Negotiates data on a path to a peer in the release's slice
     /// (`upgrade::slice`, the release's ramp from `QUIC_DATA_RAMP_START`), and sends
-    /// its data on a path where both sides did. With no ramp start set it acts as
-    /// [`Self::Shadow`] on the wire. The default on Linux, macOS and Windows.
+    /// its data on a path where both sides did. With no ramp start set, as since
+    /// the emergency stop of the data ramp, it acts as [`Self::Shadow`] on the
+    /// wire.
     Prefer,
 }
 
@@ -146,17 +147,15 @@ impl QuicMode {
     /// See [`QuicMode::Prefer`].
     pub const PREFER: &'static str = "prefer";
 
-    /// What an unset `transport-quic` means on this platform: prefer on Linux,
-    /// macOS and Windows, and off elsewhere, because the crash-loop breaker
-    /// cannot trip there. Windows joined once its breaker was confirmed on a
-    /// real Windows machine (#6031).
+    /// What an unset `transport-quic` means on this platform: shadow on Linux
+    /// and macOS, and off elsewhere, Windows included. This is the emergency
+    /// stop of the QUIC data ramp, and it returns exactly to 0.2.156's
+    /// defaults, because an emergency release should only go back to states
+    /// the field has run (Windows with QUIC off is what every release through
+    /// 0.2.156 ran).
     pub const fn default_mode() -> Self {
-        if cfg!(any(
-            target_os = "linux",
-            target_os = "macos",
-            target_os = "windows"
-        )) {
-            Self::Prefer
+        if cfg!(any(target_os = "linux", target_os = "macos")) {
+            Self::Shadow
         } else {
             Self::Off
         }
```

**File**: `crates/core/src/transport/quic/breaker.rs` (modified, +3/-2)
```diff
@@ -19,8 +19,9 @@
 //! **Windows is weaker than unix.** There, a crash not preceded by a panic in
 //! QUIC code is not counted, a crash loop whose runs each last ten minutes or
 //! more never trips, and neither does a fault that crashes once a day. QUIC
-//! became on by default on Windows (shadow, now `prefer`) after this breaker
-//! was confirmed on a real Windows machine (#6031), with those limits weighed.
+//! became on by default on Windows (shadow, then `prefer` for the data ramp)
+//! after this breaker was confirmed on a real Windows machine (#6031), with
+//! those limits weighed. The ramp's emergency stop returned Windows to off.
 //!
 //! # The marker
 //!
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +3/-3)
```diff
@@ -1935,9 +1935,9 @@ fn transport_quic_values_and_unknown_ones() {
     assert_eq!(QuicMode::from_config_value(Some("force")), QuicMode::Off);
     assert_eq!(QuicMode::from_config_value(Some("")), QuicMode::Off);
     assert_eq!(QuicMode::default(), QuicMode::default_mode());
-    #[cfg(any(target_os = "linux", target_os = "macos", target_os = "windows"))]
-    assert_eq!(QuicMode::from_config_value(None), QuicMode::Prefer);
-    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
+    #[cfg(any(target_os = "linux", target_os = "macos"))]
+    assert_eq!(QuicMode::from_config_value(None), QuicMode::Shadow);
+    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
     assert_eq!(QuicMode::from_config_value(None), QuicMode::Off);
 }
 
```

---

### Incident Patch 3: `71657db8` (2026-11-16)
**Commit Message**: build: release 0.2.158 (#6238)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -1899,7 +1899,7 @@ dependencies = [
 
 [[package]]
 name = "fdev"
-version = "0.3.319"
+version = "0.3.320"
 dependencies = [
  "anyhow",
  "axum",
@@ -2078,7 +2078,7 @@ dependencies = [
 
 [[package]]
 name = "freenet"
-version = "0.2.157"
+version = "0.2.158"
 dependencies = [
  "aes-gcm",
  "ahash",
```

**File**: `apps/freenet-ping/Cargo.lock` (modified, +1/-1)
```diff
@@ -1715,7 +1715,7 @@ dependencies = [
 
 [[package]]
 name = "freenet"
-version = "0.2.157"
+version = "0.2.158"
 dependencies = [
  "aes-gcm",
  "ahash",
```

**File**: `crates/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "freenet"
-version = "0.2.157"
+version = "0.2.158"
 edition = "2024"
 rust-version = "1.85"
 publish = true
```

**File**: `crates/fdev/Cargo.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "fdev"
-version = "0.3.319"
+version = "0.3.320"
 edition = "2024"
 rust-version = "1.85"
 publish = true
@@ -14,12 +14,12 @@ readme = "README.md"
 # (v0.2.x), so we embed the matching freenet version literally — `v{ version }`
 # would expand to the fdev crate version and 404. release.yml rewrites the
 # `vX.Y.Z` segment whenever the freenet version is bumped (issue #3995).
-pkg-url = "{ repo }/releases/download/v0.2.157/fdev-{ target }.tar.gz"
+pkg-url = "{ repo }/releases/download/v0.2.158/fdev-{ target }.tar.gz"
 pkg-fmt = "tgz"
 bin-dir = "fdev"
 
 [package.metadata.binstall.overrides.x86_64-pc-windows-msvc]
-pkg-url = "{ repo }/releases/download/v0.2.157/fdev-{ target }.zip"
+pkg-url = "{ repo }/releases/download/v0.2.158/fdev-{ target }.zip"
 pkg-fmt = "zip"
 bin-dir = "fdev.exe"
 
@@ -56,7 +56,7 @@ ed25519-dalek = { version = "2", features = ["rand_core", "serde"] }
 hex = { workspace = true }
 
 # internal
-freenet = { path = "../core", version = "0.2.157", features = ["testing"] }
+freenet = { path = "../core", version = "0.2.158", features = ["testing"] }
 freenet-stdlib = { workspace = true }
 
 [dev-dependencies]
```

#### Recent Merged Pull Requests:
- **PR #6241** (2026-11-16): fix(transport): emergency stop of the QUIC data ramp (@sanity)
- **PR #6239** (2026-11-16): fix(transport): count local QUIC path closes by reason; leave dark paths with UDP to the idle timeout (@sanity)
- **PR #6238** (2026-11-16): build: release 0.2.158 (@sanity)
- **PR #6237** (2026-11-15): fix: replace the broken-invariant contract freeze with a per-contract merge budget (@sanity)
- **PR #6235** (2026-11-15): ci: fix macOS Service Unit timeouts (reuse e2e build, warm cache) (@sanity)
- **PR #6230** (2026-11-14): build: release 0.2.157 (@sanity)

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

## X. transport): count local QUIC path closes by reason; leave dark paths with UDP to

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `61dfd129`: transport): count local QUIC path closes by reason; leave dark paths with UDP to the idle timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  endpoint_down, session_ended_rx, over_budget_rx, liveness_tx, closed_tx. Paths that had been active only; an attempt
  that ends in setup is counted in `quic_upgrade_*`. A close this node sent
  reaches the machine as a lost connection; since 0.2.159 the driver counts it
  by the reason the closer recorded (`QuicCloser::close_for`, read at the
  count, `driver::fallback_label`): `liveness_tx` for the acknowledgement
  watch's rules and the stalled-sends count (which rule: quic_stall_close_*),
  `closed_tx` for every other recorded reason (send aborts, a peer over its
  budget, refused data, a panicked receive task). A close with no recorded
  reason, and a real reset, stay `reset`. Releases before 0.2.159 count all of
  these as `reset`. A key mismatch is `quic_upgrade_identity_mismatch`.
    (sum over c in idle, reset, protocol, downgrade_rx, over_budget_rx,
       liveness_tx, closed_tx of
  dark-path rule closes only a path that carries data (QuicPath::enable_data)
  and has no UDP session (a native path, recycle::DARK_CLOSES_WITH_UDP);
  on every other path (shadow paths, pairs outside the ramp's share, and data
  paths with a UDP session) it only counts, so the field shows h
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  endpoint_down, session_ended_rx, over_budget_rx. Paths that had been active only; an attempt
  that ends in setup is counted in `quic_upgrade_*`. A close this node sent for
  send_abort_limit or peer_not_acknowledging reaches the machine as a lost
  connection, so it counts as `reset`; its count is `quic_close_sent_*`. A key
  mismatch is `quic_upgrade_identity_mismatch`.
    (sum over c in idle, reset, protocol, downgrade_rx, over_budget_rx of
  dark-path rule closes only a path that carries data (QuicPath::enable_data);
  on every other path (shadow paths, and pairs outside the ramp's share) it
  only counts, so the field shows how long real dark spells last. A spell is read
  for at most SHORT_ACK_WAIT (120 s), after which its stream is reset,
    (a_dark_path_takes_no_new_data_long_before_the_watch_closes_it). So a
    Closes only a path that carries data (QuicPath::enable_data); every
    other path only counts its dark episodes (quic_dark_episode_*, above).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `61dfd129` are properly handled with clean fallback behavior.
