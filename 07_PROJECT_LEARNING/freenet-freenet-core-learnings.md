> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `ba036280`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T22:54:39.742Z  
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
> **Harvest Timestamp**: 2026-10-25T22:54:38.708Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3109 stars

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
- **Issue #5992** (2026-10-25): **fix(executor): decide the sampled re-apply probe with the verifier's heal step**
  *Symptoms*: ## Problem  The sampled re-apply probe (`Executor::maybe_probe_idempotency`) treated any content change on re-applying the same incoming full state as a broken contract. A content change there is a strict associativity failure on the triple (S, X, X), but the conformance verifier reports such a failure only when the two groupings do not heal (#5915). The probe and the verifier disagreed, and the probe's flag suppresses the contract's propagation from that node.  ## Approach  - `contract/executor/runtime/reapply_probe.rs`: `reapply_verdict`, generic over `ConformanceOracle`, decides the question with the verifier's own `associativity_heals`. It flags only when the groupings do not converge, a re-delivered input keeps moving the state, or reconciliation revisits a state. Unchanged, reordered (#4295) and healing re-applies end the probe; a heal-step refusal, running out of heal passes and runtime errors are inconclusive and never flag. - The right grouping is `merge(S, X)`, because the merge path answers a merge of a state into an identical copy without calling the contract (the byte-identical fast path). The probe answers those merges the same way, so every merge it asks for is one the node would make. The module doc lists every place the rule differs from `verify_case(StateAssociativity, [S, X, X])`, and the known residuals. - Bounded work: at most `REAPPLY_PROBE_MAX_CALLS` contract calls (`1 + 2 + 9 * MAX_HEAL_PASSES`) and `REAPPLY_PROBE_TIME_BUDGET` (250 ms on the node clock

- **Issue #5991** (2026-10-25): **fix(delegates): scope delegate unregistration, context and hosted runs to their user**
  *Symptoms*: ## Problem  A node already separates local clients from network clients. A hosted node goes further and separates its users by user token, giving each user their own secrets. This PR applies the same boundaries to delegate unregistration, delegate context, delegate runs and permission prompts. Each of these runs for, and affects, only the client and user it belongs to.  ## Approach  **Unregistering a delegate** - Only a local client may unregister a delegate. Other connections get `DelegateError::ExecutionError("only a local client may unregister a delegate")`. The check runs before anything is removed. - The push registry is cleared only after the executor accepts the unregistration. A created-delegate slot is released only for a key that was counted. - The store removes only a key it has indexed. Once the index entry is gone, a failure to delete the code file is logged and does not leave a half-removed delegate. - On a hosted node, a client's unregistration removes only that user's push registrations. It never removes the delegate or any secrets.  **Delegate context** - A delegate's context is kept per (delegate, user). - The context cache is bounded by bytes (RAM-derived, 1.25 to 32 MiB) and is counted in the declared cache ceiling. - A run parked on a user prompt holds its context in the park entry, charged to the park byte budget, and gets it back when it resumes.  **Hosted nodes** - The client API requires a user token. A connection without one gets 403 before the upgra

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

### Incident Patch 1: `ba036280` (2026-10-25)
**Commit Message**: fix(delegates): scope delegate unregistration, context and hosted runs to their user (#5991)

**File**: `.claude/rules/contracts.md` (modified, +29/-2)
```diff
@@ -97,11 +97,38 @@ brief: "gate on the #5730 Background grant"); an app granted under the older
 card text gets periodic runs without a new prompt. Revoking stops them at the
 next fire.
 
+Hosted nodes: every delegate run belongs to a user, and the node runs no
+delegate on its own. A client request runs under its connection's user; an
+inter-delegate hop runs its target under the originating user (secrets and
+context, via execute_delegate_hop's user_context), so a delegate that calls
+another makes the target run as the same user, as on a normal node. The node
+runs no contract notification and no lifecycle or wake-up run (no
+capabilities). A delegate's SubscribeContractRequest still succeeds: the
+subscription keeps the contract current on the node for the user's reads, but
+the delegate is not run for its changes. Two guards: the executor builds and
+sends no DelegateNotification on a hosted node
+(send_delegate_contract_notifications), and handle_delegate_notification
+returns after the registry sweep if one arrives. Routing a run's output to
+its own user (route_to_apps_for + Recipients::User, nobody when it has no
+user) is a backstop on a hosted node, not a live path: no hosted run delivers
+to apps today. The executor refuses an ApplicationMessages run
+with no user on a hosted node (is_hosted_run_without_user, logged at warn
+once per process, then debug: no client can send one, so it means a node path
+forgot the user). NEVER give
+a run on a hosted node the node-local secrets, and NEVER start a node-owned
+delegate run there; on a node that is not hosted nothing changes. The push
+registry stores a user's id, never the user's secret.
+
 Old delegate versions: a re-keyed delegate's OLD key keeps its record, and so
 its wake-ups, while any app stays bound to it. Only an unregister by a bound
 app from a local connection removes a binding (the record goes with the last
-one); a CLI or remote unregister does not. An app that re-keys should
-unregister the old key from its own tab once its migration is done.
+one); a CLI unregister does not. Only a local client may unregister a
+delegate at all. On a hosted node a user's unregister removes only that
+user's push registrations, a client without a user token is refused, and no
+client can remove the delegate itself: an operator does that by running the
+node without hosted mode. Secrets are never removed by an unregister. An app
+that re-keys should unregister the old key from its own tab once its
+migration is done.
 ```
 
 ### WASM Call Modes
```

**File**: `crates/core/src/client_events.rs` (modified, +77/-15)
```diff
@@ -12,6 +12,8 @@ pub(crate) mod test;
 #[cfg(test)]
 mod test_correlation;
 pub(crate) mod types;
+#[cfg(test)]
+mod unregister_dispatch_tests;
 
 /// Largest client WebSocket message, and frame, the node accepts (see
 /// `websocket::configure_upgrade`).
@@ -549,6 +551,38 @@ fn delegate_request_outcome(
             );
             Err(Error::Executor(exec_err))
         }
+        // Refused: an UnregisterDelegate from a connection that is not local,
+        // or from a hosted node's client without a user token. Caused by the
+        // request, and already logged once at debug by the executor.
+        Ok(ContractHandlerEvent::DelegateResponse(Err(exec_err)))
+            if exec_err.is_unregister_not_local() || exec_err.is_unregister_hosted() =>
+        {
+            tracing::debug!(
+                client_id = %client_id,
+                request_id = %request_id,
+                delegate = %delegate_key,
+                outcome = "unregister_refused",
+                error = %exec_err,
+                "DelegateRequest refused: UnregisterDelegate not allowed for this client"
+            );
+            Err(Error::Executor(exec_err))
+        }
+        // Refused: a delegate run with no user on a hosted node. No client can
+        // send one (a hosted node refuses a connection with no user token), so
+        // this means a node path did not supply the run's user; the executor
+        // already logged it (at warn the first time, then at debug).
+        Ok(ContractHandlerEvent::DelegateResponse(Err(exec_err)))
+            if exec_err.is_hosted_run_without_user() =>
+        {
+            tracing::debug!(
+                client_id = %client_id,
+                request_id = %request_id,
+                delegate = %delegate_key,
+                outcome = "hosted_run_without_user",
+                "DelegateRequest refused: a hosted node runs a delegate only on behalf of a user"
+            );
+            Err(Error::Executor(exec_err))
+        }
         // Genuine delegate execution failure (#5263). Previously this arm
         // didn't exist: a failure was indistinguishable from
         // `Ok(ContractHandlerEvent::DelegateResponse(Ok(vec![])))`, so the
@@ -590,15 +624,15 @@ fn delegate_request_outcome(
 }
 
 /// Keeps a missing-delegate failure (#5727), and the refusal of a request
-/// whose params do not derive the delegate key, TYPED on their way to the
-/// client.
+/// whose params do not derive the delegate key or of a non-local
+/// `UnregisterDelegate`, TYPED on their way to the client.
 ///
 /// Returns the client error `freenet local` sends for the same request —
 /// `RequestError::DelegateError(DelegateError::Missing(key))`, or
-/// `RequestError::DelegateError(DelegateError::ExecutionError(..))` for the
+/// `RequestError::DelegateError(DelegateError::ExecutionError(..))` for a
 /// refusal — when `err` is one of those failures, and hands every other error
-/// back unchanged for the generic `OperationError { cause }` flattening. The
-/// refusal is identified by `ExecutorError::is_params_mismatch`, a typed flag,
+/// back unchanged for the generic `OperationError { cause }` flattening. A
+/// refusal is identified by `ExecutorError::is_delegate_refusal`, a typed flag,
 /// never by its text.
 ///
 /// Without this the missing-delegate answer would reach a network-mode client
@@ -611,7 +645,7 @@ fn typed_delegate_client_error(err: Error) -> Result<ClientError, Error> {
     match err {
         Error::Executor(exec_err)
             if exec_err.is_missing_delegate()
-                || (exec_err.is_request() && exec_err.is_params_mismatch()) =>
+                || (exec_err.is_request() && exec_err.is_delegate_refusal()) =>
         {
             Ok(ErrorKind::RequestError(exec_err.unwrap_request()).into())
         }
@@ -624,7 +658,7 @@ fn typed_delegate_client_error(err: Error) -> Result<ClientError, Error> {
 }
 
 /// True for the typed client errors `typed_delegate_client_error` produces —
-/// a missing delegate (#5727) or a params-mismatch refusal — so the send path
+/// a missing delegate (#5727) or a refusal — so the send path
 /// keeps them out of the error log; both were already logged once upstream.
 ///
 /// The refusal is matched by variant AND message here because the flag that
@@ -639,7 +673,12 @@ fn is_routine_delegate_client_error(err: &ClientError) -> bool {
         ErrorKind::RequestError(RequestError::DelegateError(DelegateError::Missing(_))) => true,
         ErrorKind::RequestError(RequestError::DelegateError(DelegateError::ExecutionError(
             msg,
-        ))) => msg.starts_with(crate::wasm_runtime::DELEGATE_PARAMS_MISMATCH),
+        ))) => {
+            msg.starts_with(crate::wasm_runtime::DELEGATE_PARAMS_MISMATCH)
+                || msg.starts_with(crate::wasm_runtime::DELEGATE_UNREGISTER_NOT_LOCAL)
+                || msg.starts_with(crate::wasm_runtime::DELEGATE_UNREGISTER_HOSTED)
+                || msg.starts_with(crate
```

**File**: `crates/core/src/client_events/unregister_dispatch_tests.rs` (added, +558/-0)
```diff
@@ -0,0 +1,558 @@
+//! `UnregisterDelegate` through the real client dispatch: `process_open_request`
+//! into the PRODUCTION contract handler (`NetworkContractHandler` over a real
+//! `RuntimePool`) running a real WASM delegate.
+//!
+//! The executor's own refusal is pinned in
+//! `contract::executor::runtime::unregister_tests`. These tests drive the layer
+//! above it, which clears a delegate's push registrations: a guard in the
+//! executor says nothing about what this layer did before reaching it.
+
+use std::sync::Arc;
+use std::time::Duration;
+
+use freenet_stdlib::client_api::{
+    ClientRequest, DelegateError, DelegateRequest, ErrorKind, HostResponse, RequestError,
+};
+use freenet_stdlib::prelude::*;
+use tokio::sync::mpsc;
+
+use super::{ClientId, ConnectionScope, Error, HostResult, OpenRequest, process_open_request};
+use crate::config::{ConfigArgs, GlobalExecutor};
+use crate::contract::OperationMode;
+use crate::contract::delegate_app_registry;
+use crate::contract::{ContractHandler, NetworkContractHandler, contract_handling};
+use crate::node::OpManager;
+use crate::wasm_runtime::UserSecretContext;
+
+/// A node whose `OpManager` feeds the production contract handler loop, so a
+/// request sent through `process_open_request` is executed for real.
+struct Node {
+    op_manager: Arc<OpManager>,
+    delegates_dir: std::path::PathBuf,
+    handle: tokio::task::JoinHandle<Result<(), crate::contract::ContractError>>,
+    _guards: Box<dyn std::any::Any>,
+}
+
+impl Drop for Node {
+    fn drop(&mut self) {
+        self.handle.abort();
+    }
+}
+
+impl Node {
+    async fn start(id: &str) -> Self {
+        Self::start_with(id, false).await
+    }
+
+    async fn start_with(id: &str, hosted_mode: bool) -> Self {
+        let config_args = ConfigArgs {
+            id: Some(id.to_string()),
+            mode: Some(OperationMode::Local),
+            ws_api: crate::config::WebsocketApiArgs {
+                hosted_mode: Some(hosted_mode),
+                ..Default::default()
+            },
+            ..Default::default()
+        };
+        let node_config =
+            crate::node::NodeConfig::new(config_args.build().await.expect("build Config"))
+                .await
+                .expect("build NodeConfig");
+        let config = node_config.config.clone();
+        let delegates_dir = config.delegates_dir();
+
+        let (notification_rx, notification_tx) = crate::node::event_loop_notification_channel();
+        let (ops_ch_channel, handler_half, wait_for_event) =
+            crate::contract::contract_handler_channel();
+        let connection_manager = crate::ring::ConnectionManager::new(&node_config);
+        let (result_router_tx, result_router_rx) = mpsc::channel(100);
+        let task_monitor = crate::node::background_task_monitor::BackgroundTaskMonitor::new();
+        let op_manager = Arc::new(
+            OpManager::new(
+                notification_tx,
+                ops_ch_channel,
+                &node_config,
+                crate::tracing::DynamicRegister::new(vec![]),
+                connection_manager,
+                result_router_tx,
+                &task_monitor,
+            )
+            .expect("build OpManager"),
+        );
+        op_manager.ring.attach_op_manager(&op_manager);
+
+        // The loop reads the half the OpManager sends to, so this is the path
+        // a client request takes in a running node.
+        let handler = NetworkContractHandler::build(handler_half, op_manager.clone(), config)
+            .await
+            .expect("build the production contract handler");
+        let handle = GlobalExecutor::spawn(contract_handling(
+            handler,
+            crate::contract::user_input::AutoApprovePrompter,
+        ));
+        Node {
+            op_manager,
+            delegates_dir,
+            handle,
+            _guards: Box::new((
+                notification_rx,
+                wait_for_event,
+                result_router_rx,
+                task_monitor,
+            )),
+        }
+    }
+
+    /// Send one delegate request the way a client connection does.
+    async fn send(
+        &self,
+        client_id: ClientId,
+        req: DelegateRequest<'static>,
+        scope: ConnectionScope,
+        notification: Option<mpsc::Sender<HostResult>>,
+    ) -> Result<(), Error> {
+        self.send_as(client_id, req, scope, notification, None)
+            .await
+    }
+
+    /// [`Self::send`] from a hosted user's connection.
+    async fn send_as(
+        &self,
+        client_id: ClientId,
+        req: DelegateRequest<'static>,
+        scope: ConnectionScope,
+        notification: Option<mpsc::Sender<HostResult>>,
+        user: Option<UserSecretContext>,
+    ) -> Result<(), Error> {
+        let mut open = OpenRequest::new(client_id, Box::new(ClientRequest::DelegateOp(req)))
+            .with_connection_scope(scope)
+            .with_user_context(user);
+        if let Some(tx) = n
```

**File**: `crates/core/src/client_events/user_op_rate_limit.rs` (modified, +5/-4)
```diff
@@ -11,10 +11,11 @@
 //!
 //! The limiter is consulted ONLY when a connection carries a
 //! [`UserSecretContext`](crate::wasm_runtime::UserSecretContext) — i.e. hosted
-//! mode is on AND the connection presented a user token. Local / non-hosted /
-//! tokenless connections derive no context, so they are NEVER rate-limited:
-//! the single-user node behaves byte-for-byte as before (#4381's "never break
-//! single-user default" invariant).
+//! mode is on AND the connection presented a user token. Non-hosted
+//! connections derive no context, so they are NEVER rate-limited: the
+//! single-user node behaves byte-for-byte as before (#4381's "never break
+//! single-user default" invariant). A hosted node serves its client API only
+//! to connections that present a token, so every such connection is limited.
 //!
 //! # Server-level shared state, not a process global
 //!
```

**File**: `crates/core/src/client_events/websocket.rs` (modified, +186/-37)
```diff
@@ -819,12 +819,14 @@ struct ConnectionInfo {
 /// - hosted mode OFF => always `None` (token ignored entirely; single-user).
 /// - hosted mode ON, non-empty token => `Some` context derived solely from the
 ///   token bytes.
-/// - hosted mode ON, no token or empty token => `None` (this connection is
-///   single-user, just like a non-hosted node).
+/// - hosted mode ON, no token or empty token => `None`. This helper also serves
+///   routes that need no token (the shell and other HTTP routes); the client
+///   API refuses such a connection on a hosted node before the upgrade (see
+///   `websocket_commands`).
 ///
-/// `None` everywhere means [`crate::wasm_runtime::SecretScope::Local`]
-/// downstream — byte-for-byte the pre-#4381 behavior — so the flag-off path is
-/// provably inert.
+/// `None` means [`crate::wasm_runtime::SecretScope::Local`] downstream. On a
+/// hosted node no client-API connection reaches that scope, and with hosted
+/// mode off the path is byte-for-byte the pre-#4381 behavior.
 pub(crate) fn derive_user_context(
     hosted_mode: bool,
     user_token: Option<&str>,
@@ -833,7 +835,8 @@ pub(crate) fn derive_user_context(
         (true, Some(token)) if !token.is_empty() => {
             Some(UserSecretContext::from_token(token.as_bytes()))
         }
-        // hosted on but no/empty token, or hosted off (token ignored): Local.
+        // hosted on but no/empty token (the client API refuses such a
+        // connection before this matters), or hosted off (token ignored).
         (true, _) | (false, _) => None,
     }
 }
@@ -851,18 +854,21 @@ pub(crate) enum UserTokenDecision {
     /// demonstrably secure (not a loopback source carrying
     /// `X-Forwarded-Proto: https`). Reject the upgrade rather than silently
     /// dropping the token — silently falling back to `Local` would put the user
-    /// on the WRONG (shared) namespace under a public plaintext deployment.
+    /// on the WRONG namespace under a public plaintext deployment.
     RejectInsecure,
-    /// No per-user scoping: treat as single-user (`SecretScope::Local`). Reached
-    /// for the flag-off path and the no-token path (`has_token == false`) — both
-    /// byte-for-byte the pre-#4381 behavior, so no rejection fires.
+    /// No per-user scoping (`SecretScope::Local`). Reached for the flag-off
+    /// path and for `has_token == false`. On a node that is not hosted this is
+    /// the normal single-user path. On a hosted node the client API refuses a
+    /// connection with no token before the upgrade (`websocket_commands`), so
+    /// only routes that need no token (the shell, other HTTP routes) see this
+    /// outcome there.
     ///
-    /// NOTE: an EMPTY token (`?userToken=` with no value) is mapped to `Local`
-    /// too, but that happens at the CALL SITE, which passes `has_token = false`
-    /// for an empty token (matching `derive_user_context`'s empty-is-absent
-    /// rule). This pure fn keys only on the `has_token` bool and never inspects
-    /// token contents — so an empty token must NOT reach here as `has_token ==
-    /// true`, or it would be wrongly rejected as insecure.
+    /// NOTE: an EMPTY token (`?userToken=` with no value) counts as no token.
+    /// The CALL SITE passes `has_token = false` for it (matching
+    /// `derive_user_context`'s empty-is-absent rule). This pure fn keys only on
+    /// the `has_token` bool and never inspects token contents, so an empty
+    /// token must NOT reach here as `has_token == true`, or it would be wrongly
+    /// rejected as insecure.
     Local,
 }
 
@@ -922,9 +928,10 @@ pub(crate) fn decide_user_token(
     source_ip: Option<std::net::IpAddr>,
     xfp_https: bool,
 ) -> UserTokenDecision {
-    // Flag off, or no token presented: single-user, no rejection. This is the
-    // ONLY path when hosted mode is off, so the whole invariant is hosted-gated
-    // and the flag-off behavior is byte-for-byte unchanged.
+    // Flag off, or no token presented: no rejection here. This is the ONLY
+    // path when hosted mode is off, so the whole invariant is hosted-gated and
+    // the flag-off behavior is byte-for-byte unchanged. A hosted node's client
+    // API refuses a tokenless connection separately (`websocket_commands`).
     if !hosted_mode || !has_token {
         return UserTokenDecision::Local;
     }
@@ -1131,11 +1138,11 @@ async fn connection_info(
     let token_str: Option<&str> = user_token.as_deref().map(String::as_str);
 
     // `has_token` is a NON-EMPTY check, matching `derive_user_context`'s
-    // empty-is-absent semantics. The browser shell sends `?userToken=` (empty)
-    // for a brand-new user who has no token yet; that connection must fall
-    // through to Local (single-user) so the client can connect and GET a token,
-    // NOT be locked out with a 403. Both helpers must agree on "empty": an empty
-    // token is treated as no token, so it is never gated.
+    // empty-is-absent semantics: an empty 
```

**File**: `crates/core/src/config.rs` (modified, +36/-40)
```diff
@@ -2257,9 +2257,9 @@ impl Config {
                 %address,
                 allowed_hosts = ?self.ws_api.allowed_hosts,
                 hosted_mode = self.ws_api.hosted_mode,
-                "Client API exposure: {reason}. A connection that presents no per-user \
-                 token drives this node's SHARED namespace and can read and modify its \
-                 contract state, identities and keys. Bind loopback \
+                "Client API exposure: {reason}. On a node that is not in hosted mode, a \
+                 connection drives this node's SHARED namespace and can read and modify \
+                 its contract state, identities and keys. Bind loopback \
                  (--ws-api-address ::1) unless you intend this."
             );
         }
@@ -3361,10 +3361,18 @@ pub struct WebsocketApiConfig {
     /// gets a per-user delegate-secret namespace derived from that token; when
     /// `false` (the default), the `userToken` parameter is ignored entirely and
     /// every connection is single-user — byte-for-byte the pre-#4381 behavior.
-    ///
-    /// This flag ONLY governs whether the WS boundary derives a per-user
-    /// context; everything downstream is driven by whether a context was
-    /// derived, so with the flag off the entire feature is inert.
+    /// A hosted node serves its client API only to a connection that presents a
+    /// user token.
+    ///
+    /// The flag also governs the rest of hosted mode:
+    /// - the permission routes require a user token, show each user only their
+    ///   own prompts, and the permission routes a hosted node does not serve
+    ///   are refused;
+    /// - imports into the node-local secret scope are refused;
+    /// - the node sends no contract notifications to delegates;
+    /// - the executor refuses a delegate run that has no user.
+    ///
+    /// With the flag off none of these apply.
     #[serde(default, rename = "hosted-mode")]
     pub hosted_mode: bool,
 
@@ -3796,33 +3804,24 @@ fn resolve_ws_api_address(
 /// machine while connections can land in ONE shared secret namespace, and if
 /// so, why. `None` means stay quiet.
 ///
-/// The shared namespace is the danger. `decide_user_token` hands a connection
-/// the node's single-user context whenever hosted mode is off **or the
-/// connection simply omits `userToken`** — so hosted mode ADDS a per-user
-/// namespace for well-behaved clients, it does not remove the shared one.
+/// The shared namespace is the danger. A node that is not in hosted mode hands
+/// every connection its single-user context. A hosted node serves its client
+/// API only to a connection that presents a user token, so it hands none of
+/// them that context.
 ///
 /// Two triggers:
-/// - a **non-loopback bind** warns regardless of hosted mode, because any host
-///   that can route to the address can omit a token and land in the shared
-///   namespace;
+/// - a **non-loopback bind** warns regardless of hosted mode: without hosted
+///   mode any host that can route to the address lands in the shared
+///   namespace, and with it a user token is honoured only from a loopback
+///   source, so a wide bind is not the deployment hosted mode expects;
 /// - **`--allowed-host` on a loopback bind with hosted mode OFF** warns. That
 ///   flag names a reverse proxy, and a proxy terminates the connection itself,
 ///   so every visitor arrives wearing the proxy's source address and the node's
 ///   own source-IP filters cannot tell them apart.
 ///
-/// **Loopback + hosted mode stays quiet, and that is a known gap, not an
-/// assertion of safety.** A connection that omits `userToken` reads the shared
-/// namespace there too, and behind a public proxy that is any visitor;
-/// containment on the flagship deployment today is that the shared namespace is
-/// empty (measured: zero files outside `*/users/*`), which is a fact about
-/// current state rather than a structural guarantee. Making this branch fire
-/// only when the shared namespace actually holds something needs a probe of the
-/// secrets tree, which is a separate change with its own failure modes — it is
-/// tracked in advisory GHSA-824h-7x5x-wfmf §8, with the measured tree shape and
-/// the requirements, rather than bolted onto a default-hardening PR, because a
-/// probe that is wrong in either direction is worse than no warning: too eager
-/// and it fires on every boot of the flagship and trains operators to ignore the
-/// one signal there is.
+/// **Loopback + hosted mode stays quiet.** A hosted node serves its client API
+/// only to a connection that presents a user token, and each token has its own
+/// namespace, including behind a public proxy.
 fn ws_api_shares_one_namespace_with_remote_clients(
     hosted_mode: bool,
     address: IpAddr,
@@ -3831,8 +3830,9 @@ fn ws_api_shares_one_namespace_with_remote_clients(
     if !address.is_loopback() {
         return Some(if hosted_mode {
             "the client API is
```

**File**: `crates/core/src/conformance/runtime_oracle.rs` (modified, +3/-0)
```diff
@@ -293,6 +293,9 @@ fn classify(err: RuntimeContractError) -> OracleError {
         | RuntimeInnerError::Serialization(_)
         | RuntimeInnerError::DelegateNotFound(_)
         | RuntimeInnerError::DelegateParamsMismatch(_)
+        | RuntimeInnerError::DelegateUnregisterNotLocal(_)
+        | RuntimeInnerError::DelegateUnregisterHosted(_)
+        | RuntimeInnerError::DelegateHostedRunWithoutUser(_)
         | RuntimeInnerError::DelegateIdentityMismatch { .. }
         | RuntimeInnerError::DelegateExecError(_)
         | RuntimeInnerError::ContractNotFound(_)
```

**File**: `crates/core/src/contract.rs` (modified, +1282/-77)
```diff
@@ -1321,6 +1321,9 @@ async fn run_user_input_prompts<P>(
     delegate_key: &DelegateKey,
     delegate_key_str: &str,
     caller: CallerIdentity,
+    // The hosted user the prompts belong to: the run's own user. A hosted
+    // node shows each prompt only to its owner (`user_input::UserInputPrompter`).
+    owner: Option<crate::wasm_runtime::UserId>,
     // Answers are appended AS THEY ARRIVE rather than returned at the end, so a
     // caller whose overall budget expires mid-sequence still keeps the ones a
     // human already answered (#5544 S6).
@@ -1331,7 +1334,7 @@ async fn run_user_input_prompts<P>(
     for req in requests {
         let request_id = req.request_id;
         let response = match prompter
-            .prompt(&req, delegate_key_str, caller.clone())
+            .prompt(&req, delegate_key_str, caller.clone(), owner)
             .await
         {
             Some((_, response)) => response,
@@ -1627,6 +1630,24 @@ where
                     );
                     return DelegateRunOutcome::Failed(err);
                 }
+                if err.is_unregister_not_local() || err.is_unregister_hosted() {
+                    tracing::debug!(
+                        delegate_key = %delegate_key,
+                        error = %err,
+                        "Delegate request refused: UnregisterDelegate not allowed for this client"
+                    );
+                    return DelegateRunOutcome::Failed(err);
+                }
+                // A node path that did not supply the run's user; the executor
+                // already logged it with the key (at warn the first time).
+                if err.is_hosted_run_without_user() {
+                    tracing::debug!(
+                        delegate_key = %delegate_key,
+                        "Delegate run refused: a hosted node runs a delegate only on \
+                         behalf of a user"
+                    );
+                    return DelegateRunOutcome::Failed(err);
+                }
                 tracing::error!(
                     delegate_key = %delegate_key,
                     error = %err,
@@ -2517,7 +2538,7 @@ where
         // Design notes:
         // - Delivery is intentionally single-hop: if target delegate B emits its own
         //   SendDelegateMessage in response, it is filtered out (not delivered). This
-        //   prevents infinite recursion between delegates. We use execute_delegate_request
+        //   prevents infinite recursion between delegates. We use execute_delegate_hop
         //   (not the full delivery loop) for the same reason.
         // - Target delegate runs with the params IT was registered with on this node
         //   (`registered_delegate_params`, #5616), never the caller's and never empty
@@ -2547,7 +2568,7 @@ where
                 let target_key = msg.target.clone();
                 // PER-DELEGATE EXCLUSION, second door (#5544 B2).
                 //
-                // This is the SECOND call site of `execute_delegate_request`,
+                // This is the second executor call (`execute_delegate_hop`),
                 // and it invokes the TARGET delegate, not the calling one — so
                 // `dispatch_delegate_request`'s check upstream says nothing
                 // about it. Delivering here while the target is parked would
@@ -2612,14 +2633,18 @@ where
 
                 match contract_handler
                     .executor()
-                    // Inter-delegate hop: `user_context = None`. A
-                    // delegate-to-delegate message does NOT carry the
-                    // originating connection's per-user secret namespace — the
-                    // target delegate's secrets are its own, scoped to whatever
-                    // (if any) user context its own connections present. This
-                    // keeps the per-user namespace bound to the connection
-                    // boundary, not propagated transitively through delegate
-                    // messages (part of the #4381 unforgeability invariant).
+                    // Inter-delegate hop: the target runs under the ORIGINATING
+                    // user, the one whose request led to the hop. On a hosted
+                    // node every delegate run belongs to a user, so the hop
+                    // gets that user's secrets and that user's delegate
+                    // context, and nothing else. The user comes from the
+                    // connection boundary through `user_context`, never from
+                    // the message. So a delegate that calls another delegate
+                    // makes that target run as the same user, as on a node that
+                    // is not hosted, where `user_context` is `None` and both
+                    // run under the node-local secrets. The target sees the
+                    // caller as the attested origin and decides what to allow.
+                    //
                    
```

---

### Incident Patch 2: `ee32942c` (2026-10-25)
**Commit Message**: fix(executor): decide the sampled re-apply probe with the verifier's heal step (#5992)

**File**: `.claude/rules/contracts.md` (modified, +21/-7)
```diff
@@ -242,10 +242,19 @@ State merging rules:
   - Contract defines merge semantics
   - Merge MUST be commutative: merge(a, b) == merge(b, a)
   - Merge MUST be associative: merge(merge(a, b), c) == merge(a, merge(b, c))
-  - For `UpdateData::State` inputs, merge MUST be idempotent:
-      update_state(update_state(S, State(X)), State(X)) == update_state(S, State(X))
+  - For `UpdateData::State` inputs, re-applying the same incoming state MUST
+    settle: update_state(update_state(S, State(X)), State(X)) should equal
+    update_state(S, State(X)), and where it does not (a contract with bounded
+    retention can change once), the results must reconcile to a fixpoint.
     Enforced at runtime via TWO in-peer detectors: the sampled re-apply probe
-    (`Executor::maybe_probe_idempotency`, 1/32 of pure-State merges) and the
+    (`Executor::maybe_probe_idempotency`, 1/32 of merges whose batch is a
+    single full `State`; rule in `contract::executor::runtime::reapply_probe`:
+    a content change on re-apply is a strict associativity failure on
+    (S, X, X), so it flags only when the conformance verifier's heal step
+    (`conformance::verifier::associativity_heals`) shows the groupings do not
+    converge, a re-delivered input keeps moving the state, or reconciliation
+    revisits a state; bounded to `REAPPLY_PROBE_MAX_CALLS` contract calls and
+    `REAPPLY_PROBE_TIME_BUDGET`, and inconclusive past either) and the
     deterministic identical-input probe
     (`Executor::probe_identical_input_idempotency`): when an incoming
     full-State payload is byte-identical to the stored state,
@@ -258,10 +267,15 @@ State merging rules:
     Both detectors flag a violation only when the CONTENT changed (a
     counter/timestamp/signature churned, an entry was added/removed),
     including the fixed-size byte-churn shape of the #4251 incident.
-    Neither flags a mere REORDERING of the same bytes, because a correct
-    contract with non-canonical serialization (HashMap/HashSet iteration
-    order) re-serializes the same logical state in a different byte order
-    (the #4295 false-positive case). Violators get flagged in
+    A re-apply that only REORDERS the same bytes ends either probe without a
+    flag, because a correct contract with non-canonical serialization
+    (HashMap/HashSet iteration order) re-serializes the same logical state in
+    a different byte order (the #4295 false-positive case). Caveat for the
+    sampled probe: only its first re-apply comparison tolerates reordering.
+    Once the content has changed, the heal step compares states in exact
+    bytes, as the verifier does, so a contract whose encoding depends on
+    argument order and that also fails strict associativity can be flagged
+    for byte order alone. Violators get flagged in
     `Ring::broken_invariants`; while flagged, this node suppresses commit,
     outbound `BroadcastStateChange` (including the retry/stash/flush
     re-emissions through `handle_broadcast_state_change`), AND full-state
```

**File**: `crates/core/src/conformance.rs` (modified, +7/-4)
```diff
@@ -53,17 +53,20 @@
 //! # Relationship to the existing probe
 //!
 //! `contract::executor::runtime::executor_impl::maybe_probe_idempotency` already
-//! samples one merge in 32 and checks re-apply idempotence. Two differences matter.
+//! samples one merge in 32 and checks that re-applying the incoming state settles,
+//! deciding a content change with this module's own [`verifier`] heal step (see
+//! `contract::executor::runtime::reapply_probe`). Two differences matter.
 //!
 //! It compares with `byte_multiset_eq` rather than byte equality, because states
 //! were not guaranteed to have a canonical encoding, so a strict comparison would
 //! have flagged contracts that merely reordered their own output. The RFC makes
 //! canonical serialization an explicit platform requirement, which is what lets this
 //! module compare exact bytes and therefore say something much stronger.
 //!
-//! It also checks exactly one law. Commutativity, associativity and reconciliation
-//! are where the measured production damage actually came from (#5153), and a
-//! re-apply probe cannot see any of them.
+//! It also checks one input shape, the triple `(S, X, X)`. Commutativity,
+//! associativity over distinct inputs and reconciliation are where the measured
+//! production damage actually came from (#5153), and a re-apply probe cannot see
+//! them.
 //!
 //! This module does not replace or disable that probe. The node can run this verifier
 //! in an opt-in shadow mode: set `FREENET_CONFORMANCE_CAPTURE_DIR` (see [`capture`] and
```

**File**: `crates/core/src/conformance/runtime_oracle.rs` (modified, +67/-0)
```diff
@@ -199,6 +199,73 @@ impl ConformanceOracle for RuntimeOracle {
     }
 }
 
+/// An oracle over a runtime someone else owns, for one contract.
+///
+/// The executor's sampled re-apply probe uses this to run the verifier's heal step
+/// ([`super::verifier::associativity_heals`]) on the runtime that just performed the
+/// merge, so the probe's verdict comes from the same law the verifier checks rather
+/// than from a second copy of it.
+pub(crate) struct BorrowedRuntimeOracle<'a, 'p, R: ?Sized> {
+    runtime: &'a mut R,
+    key: &'a ContractKey,
+    parameters: &'a Parameters<'p>,
+}
+
+impl<'a, 'p, R: ContractRuntimeInterface + ?Sized> BorrowedRuntimeOracle<'a, 'p, R> {
+    pub(crate) fn new(
+        runtime: &'a mut R,
+        key: &'a ContractKey,
+        parameters: &'a Parameters<'p>,
+    ) -> Self {
+        Self {
+            runtime,
+            key,
+            parameters,
+        }
+    }
+}
+
+impl<R: ContractRuntimeInterface + ?Sized> ConformanceOracle for BorrowedRuntimeOracle<'_, '_, R> {
+    fn validate_state(
+        &mut self,
+        state: &[u8],
+        related: &RelatedContracts<'_>,
+    ) -> Result<ValidateResult, OracleError> {
+        let state = WrappedState::new(state.to_vec());
+        self.runtime
+            .validate_state(self.key, self.parameters, &state, related)
+            .map_err(classify)
+    }
+
+    fn update_state(
+        &mut self,
+        state: &[u8],
+        updates: &[UpdateData<'_>],
+    ) -> Result<UpdateModification<'static>, OracleError> {
+        let state = WrappedState::new(state.to_vec());
+        self.runtime
+            .update_state(self.key, self.parameters, &state, updates)
+            .map_err(classify)
+    }
+
+    fn summarize_state(&mut self, state: &[u8]) -> Result<Vec<u8>, OracleError> {
+        let state = WrappedState::new(state.to_vec());
+        self.runtime
+            .summarize_state(self.key, self.parameters, &state)
+            .map(StateSummary::into_bytes)
+            .map_err(classify)
+    }
+
+    fn get_state_delta(&mut self, state: &[u8], summary: &[u8]) -> Result<Vec<u8>, OracleError> {
+        let state = WrappedState::new(state.to_vec());
+        let summary = StateSummary::from(summary.to_vec());
+        self.runtime
+            .get_state_delta(self.key, self.parameters, &state, &summary)
+            .map(|delta| delta.into_bytes())
+            .map_err(classify)
+    }
+}
+
 /// Classify a runtime failure by its *typed* provenance.
 ///
 /// Not by message text. A contract can return a rejection whose text mentions gas or
```

**File**: `crates/core/src/conformance/verifier.rs` (modified, +15/-3)
```diff
@@ -54,6 +54,13 @@ pub const MAX_CANONICALIZATION_APPLIES: usize = 3;
 /// cost coverage, never accuse anyone, because running out is inconclusive; too
 /// large a bound costs work, and only on a triple that has already failed the
 /// strict check: at most `2 + 10 * MAX_HEAL_PASSES` extra merges.
+///
+/// NODE BEHAVIOUR DEPENDS ON THIS. The executor's sampled re-apply probe
+/// (`contract::executor::runtime::reapply_probe`) runs [`associativity_heals`] on
+/// the merge path and flags contracts on its verdict, so changing this bound,
+/// [`associativity_heals`] or [`Heal`] changes what a node suppresses and what a
+/// sampled merge costs. Review such a change as a node change, and keep
+/// `reapply_verdict_matches_verifier_on_s_x_x` passing.
 pub const MAX_HEAL_PASSES: usize = 4;
 
 /// One property plus the exact inputs to check it with.
@@ -822,7 +829,10 @@ fn run<O: ConformanceOracle + ?Sized>(
 }
 
 /// How the heal step for [`ConformanceProperty::StateAssociativity`] ended.
-enum Heal {
+///
+/// Also read by the executor's sampled re-apply probe; see [`MAX_HEAL_PASSES`].
+#[derive(Debug, PartialEq, Eq)]
+pub(crate) enum Heal {
     /// The groupings converge and the state they converge to is a fixpoint.
     Healed,
     /// `merge(L, R) != merge(R, L)`: one exchange does not even agree.
@@ -887,7 +897,9 @@ enum Heal {
 /// Each moving step costs two merges, so the heal step is at most
 /// `2 + 10 * MAX_HEAL_PASSES` merges, spent only on a triple that already failed the
 /// strict check.
-fn associativity_heals<O: ConformanceOracle + ?Sized>(
+///
+/// Also called by the executor's sampled re-apply probe; see [`MAX_HEAL_PASSES`].
+pub(crate) fn associativity_heals<O: ConformanceOracle + ?Sized>(
     oracle: &mut O,
     left: &[u8],
     right: &[u8],
@@ -1212,7 +1224,7 @@ fn require_valid<O: ConformanceOracle + ?Sized>(
 /// There is no separate `merge` entry point in the contract interface; a full-state
 /// update *is* the merge, which is why a contract that "rejects" an incoming state by
 /// returning its own state unchanged shows up as an ordinary commutativity failure.
-fn merge<O: ConformanceOracle + ?Sized>(
+pub(crate) fn merge<O: ConformanceOracle + ?Sized>(
     oracle: &mut O,
     base: &[u8],
     other: &[u8],
```

**File**: `crates/core/src/contract/executor/mock_wasm_runtime.rs` (modified, +76/-0)
```diff
@@ -19,6 +19,8 @@ pub(crate) enum ValidateOverride {
     Invalid,
     /// Return `RequestRelated` with an empty vec (malformed request).
     EmptyRequestRelated,
+    /// `Valid` exactly when the predicate holds for the state bytes.
+    ValidWhen(fn(&[u8]) -> bool),
 }
 
 /// Configurable `update_state` behavior for testing related contract flows.
@@ -68,6 +70,22 @@ pub(crate) enum UpdateOverride {
     /// merge canonicalizes, every later one is a fixpoint. The
     /// identical-input probe must NOT flag this shape.
     CanonicalizeOnce,
+    /// A full-state merge given as a pure function `merge(current, incoming)`,
+    /// folded over every `State` entry in the batch. Lets a test run the
+    /// executor's probes against a merge with known algebraic properties.
+    MergeWith(fn(&[u8], &[u8]) -> Vec<u8>),
+    /// [`Self::MergeWith`] for a merge that can refuse: `None` is returned as a
+    /// contract error (`InvalidUpdateWithInfo`).
+    TryMergeWith(fn(&[u8], &[u8]) -> Option<Vec<u8>>),
+    /// [`Self::MergeWith`], except that when the batch carries no
+    /// `RelatedState` entry and `needs(current)` holds, it returns
+    /// `requires(related)`. Models a contract that needs related state only
+    /// for some stored states.
+    RequiresRelatedWhen {
+        related: ContractInstanceId,
+        needs: fn(&[u8]) -> bool,
+        merge: fn(&[u8], &[u8]) -> Vec<u8>,
+    },
 }
 
 /// A lightweight mock runtime at the `ContractRuntimeInterface` level that lets
@@ -249,6 +267,13 @@ impl ContractRuntimeInterface for MockWasmRuntime {
                 ValidateOverride::AlwaysRequestRelated(ids) => ValidateResult::RequestRelated(ids),
                 ValidateOverride::Invalid => ValidateResult::Invalid,
                 ValidateOverride::EmptyRequestRelated => ValidateResult::RequestRelated(vec![]),
+                ValidateOverride::ValidWhen(valid) => {
+                    if valid(_state.as_ref()) {
+                        ValidateResult::Valid
+                    } else {
+                        ValidateResult::Invalid
+                    }
+                }
             });
         }
         Ok(ValidateResult::Valid)
@@ -392,6 +417,57 @@ impl ContractRuntimeInterface for MockWasmRuntime {
                     let out = logical[canonical_start..].to_vec();
                     return Ok(UpdateModification::valid(out.into()));
                 }
+                UpdateOverride::TryMergeWith(merge) => {
+                    let mut out = _state.as_ref().to_vec();
+                    for update in update_data {
+                        if let UpdateData::State(incoming) = update {
+                            let Some(next) = merge(&out, incoming.as_ref()) else {
+                                use crate::wasm_runtime::ContractExecError;
+                                use freenet_stdlib::prelude::ContractError as StdlibContractError;
+                                let inner_err = StdlibContractError::InvalidUpdateWithInfo {
+                                    reason: "merge refused".into(),
+                                };
+                                return Err(crate::wasm_runtime::ContractError::from(
+                                    ContractExecError::ContractError(inner_err),
+                                ));
+                            };
+                            out = next;
+                        }
+                    }
+                    return Ok(UpdateModification::valid(out.into()));
+                }
+                UpdateOverride::RequiresRelatedWhen {
+                    related,
+                    needs,
+                    merge,
+                } => {
+                    let has_related = update_data
+                        .iter()
+                        .any(|u| matches!(u, UpdateData::RelatedState { .. }));
+                    if !has_related && needs(_state.as_ref()) {
+                        return Ok(UpdateModification::requires(vec![RelatedContract {
+                            contract_instance_id: related,
+                            mode: RelatedMode::StateOnce,
+                        }])
+                        .map_err(|e| anyhow::anyhow!("{e}"))?);
+                    }
+                    let mut out = _state.as_ref().to_vec();
+                    for update in update_data {
+                        if let UpdateData::State(incoming) = update {
+                            out = merge(&out, incoming.as_ref());
+                        }
+                    }
+                    return Ok(UpdateModification::valid(out.into()));
+                }
+                UpdateOverride::MergeWith(merge) => {
+                    let mut out = _state.as_ref().to_vec();
+                    for update in update_data {
+                        if let UpdateData::State(incoming) = update {
+                            out = merge(&out, incoming.as_ref());
+                        }
+                    }
+       
```

**File**: `crates/core/src/contract/executor/pool_tests.rs` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ mod non_idempotent_detector_tests;
 mod params_integrity_wasm_tests;
 mod related_contract_tests;
 mod runtime_pool_tests;
+mod sampled_probe_tests;
 mod subscriber_limit_tests;
 mod subscriber_stress_tests;
 mod summarize_delta_cache_tests;
```

**File**: `crates/core/src/contract/executor/pool_tests/identical_input_probe_tests.rs` (modified, +7/-2)
```diff
@@ -44,7 +44,7 @@ use super::super::mock_runtime::test::create_test_contract as test_contract;
 
 /// Build a real `OpManager` backed by a temp-dir `Config`, mirroring the
 /// wiring in `disk_budget_gate_tests.rs::build_op_manager`.
-async fn build_op_manager(id: &str) -> (Arc<OpManager>, Box<dyn std::any::Any>) {
+pub(super) async fn build_op_manager(id: &str) -> (Arc<OpManager>, Box<dyn std::any::Any>) {
     let config_args = ConfigArgs {
         id: Some(id.to_string()),
         mode: Some(OperationMode::Local),
@@ -92,7 +92,7 @@ fn distinct_bytes_state() -> WrappedState {
     WrappedState::new((1u8..=32).collect::<Vec<u8>>())
 }
 
-async fn build_executor(
+pub(super) async fn build_executor(
     op_manager: &Arc<OpManager>,
 ) -> Executor<crate::contract::executor::mock_wasm_runtime::MockWasmRuntime, MockStateStorage> {
     Executor::new_mock_wasm("t", MockStateStorage::new(), None, Some(op_manager.clone()))
@@ -133,6 +133,8 @@ async fn identical_input_reapply_flags_non_idempotent_contract_on_first_apply()
         "no flag before any identical re-apply — the install path proves nothing"
     );
 
+    crate::ring::EMITTED_FLAG_EVENTS.with(|events| events.borrow_mut().clear());
+
     // FIRST identical re-apply: the probe re-merges S into itself, the
     // fixture mutates (different byte multiset) → flagged. Deterministic:
     // this assertion would only pass ~1/32 of runs under the sampled probe.
@@ -154,6 +156,9 @@ async fn identical_input_reapply_flags_non_idempotent_contract_on_first_apply()
         "identity probe must flag the non-idempotent contract on the FIRST \
          identical apply (no 1/32 sampling)"
     );
+    let events = crate::ring::EMITTED_FLAG_EVENTS.with(|events| events.borrow().clone());
+    assert_eq!(events.len(), 1, "the flag must reach telemetry: {events:?}");
+    assert_eq!(events[0]["detector"], "identical_input");
 }
 
 /// Healthy baseline: a correctly-idempotent contract (default mock merge)
```

**File**: `crates/core/src/contract/executor/pool_tests/sampled_probe_tests.rs` (added, +719/-0)
```diff
@@ -0,0 +1,719 @@
+//! Tests for the SAMPLED re-apply probe (`Executor::maybe_probe_idempotency`)
+//! through the executor's merge path. The decision rule itself
+//! (`runtime::reapply_probe::reapply_verdict`) has its own unit tests.
+//!
+//! The probe re-applies the incoming state `X` to the merge result
+//! `merge(S, X)`. A difference there is a strict associativity failure on the
+//! triple `(S, X, X)`, which the conformance verifier reports only when the two
+//! groupings fail to heal (#5915). These tests pin that a merge that changes once
+//! on re-apply and then settles is not flagged, that a merge that keeps moving
+//! is, and that the probe's verdict agrees with
+//! `verify_case(StateAssociativity, [S, X, X])` on every pair of four small
+//! merges.
+//!
+//! Sampling is forced with `IDEMPOTENCY_PROBE_ALWAYS`, which is thread-local, so
+//! every test that drives the merge path runs on a `current_thread` runtime.
+
+use either::Either;
+use freenet_stdlib::prelude::*;
+use std::sync::Arc;
+use std::sync::atomic::AtomicU64;
+use std::time::Duration;
+
+use super::identical_input_probe_tests::{build_executor, build_op_manager};
+use crate::conformance::runtime_oracle::BorrowedRuntimeOracle;
+use crate::conformance::{ConformanceCase, ConformanceProperty, PropertyOutcome, verify_case};
+use crate::contract::UpsertResult;
+use crate::contract::executor::mock_wasm_runtime::UpdateOverride;
+use crate::contract::executor::runtime::{
+    IDEMPOTENCY_PROBE_ALWAYS, IdenticalIsNoOp, REAPPLY_PROBE_TIME_BUDGET,
+};
+use crate::contract::executor::{ContractExecutor, Executor};
+use crate::ring::{BROKEN_INVARIANT_TTL, EMITTED_FLAG_EVENTS};
+use crate::wasm_runtime::MockStateStorage;
+
+use super::super::mock_runtime::test::create_test_contract as test_contract;
+
+/// A symmetric, idempotent merge over the one-byte states `0..=3`:
+///
+/// | merge | 0 | 1 | 2 | 3 |
+/// |---|---|---|---|---|
+/// | 0 | 0 | 0 | 0 | 0 |
+/// | 1 | 0 | 1 | 0 | 0 |
+/// | 2 | 0 | 0 | 2 | 1 |
+/// | 3 | 0 | 0 | 1 | 3 |
+///
+/// It is commutative and idempotent, and its eight strictly non-associative
+/// triples all heal, so the verifier accepts it. `merge(2, 3) = 1` but
+/// `merge(1, 3) = 0`: re-applying `X = 3` changes the result once, and
+/// `merge(0, 3) = 0` is then a fixpoint.
+fn settles_after_one_reapply(a: &[u8], b: &[u8]) -> Vec<u8> {
+    const TABLE: [[u8; 4]; 4] = [[0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 2, 1], [0, 0, 1, 3]];
+    vec![TABLE[a[0] as usize % 4][b[0] as usize % 4]]
+}
+
+/// A merge that never settles: merging any different state advances the current
+/// one around `0 -> 1 -> 2 -> 0`, so re-applying the same incoming state cycles.
+fn cycles_on_reapply(a: &[u8], b: &[u8]) -> Vec<u8> {
+    if a == b {
+        a.to_vec()
+    } else {
+        vec![(a[0] + 1) % 3]
+    }
+}
+
+fn force_sampling() -> impl Drop {
+    struct Reset;
+    impl Drop for Reset {
+        fn drop(&mut self) {
+            IDEMPOTENCY_PROBE_ALWAYS.with(|always| always.set(false));
+        }
+    }
+    IDEMPOTENCY_PROBE_ALWAYS.with(|always| always.set(true));
+    EMITTED_FLAG_EVENTS.with(|events| events.borrow_mut().clear());
+    Reset
+}
+
+fn emitted_flag_events() -> Vec<serde_json::Value> {
+    EMITTED_FLAG_EVENTS.with(|events| events.borrow().clone())
+}
+
+/// Install `stored` with a PUT, then deliver `incoming` as a full state through
+/// the production merge path with the probe sampling every merge.
+async fn deliver(
+    id: &str,
+    merge: UpdateOverride,
+    stored: &[u8],
+    incoming: &[u8],
+) -> (UpsertResult, bool, Vec<serde_json::Value>, Option<Vec<u8>>) {
+    let (op_manager, _guards) = build_op_manager(id).await;
+    let contract = test_contract(id.as_bytes());
+    let key = contract.key();
+    let mut executor = build_executor(&op_manager).await;
+    executor
+        .mock_runtime_mut()
+        .update_overrides
+        .insert(*key.id(), merge);
+
+    executor
+        .upsert_contract_state(
+            key,
+            Either::Left(WrappedState::new(stored.to_vec())),
+            RelatedContracts::default(),
+            Some(contract.clone()),
+        )
+        .await
+        .expect("initial PUT");
+
+    let _sampling = force_sampling();
+    let result = executor
+        .upsert_contract_state(
+            key,
+            Either::Left(WrappedState::new(incoming.to_vec())),
+            RelatedContracts::default(),
+            None,
+        )
+        .await
+        .expect("full-state delivery");
+    let events = emitted_flag_events();
+    let (stored_after, _) = executor
+        .fetch_contract(key, false)
+        .await
+        .expect("fetch after delivery");
+    (
+        result,
+        op_manager.ring.is_contract_broken(&key),
+        events,
+        stored_after.map(|s| s.as_ref().to_vec()),
+    )
+}
+
+/// A merge the verifier accepts, whose re-apply changes the state once and then
+/// settles, is not flagged and commits.
+#[tokio::test(flavor = 
```

#### Recent Merged Pull Requests:
- **PR #5992** (2026-10-25): fix(executor): decide the sampled re-apply probe with the verifier's heal step (@sanity)
- **PR #5991** (2026-10-25): fix(delegates): scope delegate unregistration, context and hosted runs to their user (@sanity)
- **PR #5989** (2026-10-25): fix(ring): an expected inbound connection starts without a peer identity (@sanity)
- **PR #5986** (2026-10-25): fix(test): give each test process its own temp root for node data dirs (@sanity)
- **PR #5985** (2026-10-25): feat(transport): add QUIC error kinds, close codes and the endpoint-death circuit (@sanity)
- **PR #5984** (2026-10-25): feat(telemetry): count connection identity transitions (@sanity)

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

## X. delegates): scope delegate unregistration, context and hosted runs to their user

**RULE**:
When implementing operations in `.claude/rules/contracts.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ba036280`: delegates): scope delegate unregistration, context and hosted runs to their user (#5991). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/contracts.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Hosted nodes: every delegate run belongs to a user, and the node runs no
delegate on its own. A client request runs under its connection's user; an
inter-delegate hop runs its target under the originating user (secrets and
context, via execute_delegate_hop's user_context), so a delegate that calls
another makes the target run as the same user, as on a normal node. The node
runs no contract notification and no lifecycle or wake-up run (no
capabilities). A delegate's SubscribeContractRequest still succeeds: the
subscription keeps the contract current on the node for the user's reads, but
the delegate is not run for its changes. Two guards: the executor builds and
sends no DelegateNotification on a hosted node
(send_delegate_contract_notifications), and handle_delegate_notification
returns after the registry sweep if one arrives. Routing a run's output to
its own user (route_to_apps_for + Recipients::User, nobody when it has no
user) is a backstop on a hosted node, not a live path: no hosted run delivers
to apps today. The executor refuses an ApplicationMessages run
with no user on a hosted node (is_hosted_run_without_user, logged at warn
once per process, then debug: no client can se
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
one); a CLI or remote unregister does not. An app that re-keys should
unregister the old key from its own tab once its migration is done.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ba036280` are properly handled with clean fallback behavior.
