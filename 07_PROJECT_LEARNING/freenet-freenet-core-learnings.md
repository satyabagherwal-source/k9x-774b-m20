> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `c9f3057f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T20:49:08.964Z  
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
> **Harvest Timestamp**: 2026-11-07T20:49:07.705Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3115 stars

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
- **Issue #6137** (2026-11-07): **docs: retire the contract-removal plan from conformance docs**
  *Symptoms*: ## Problem  Nodes will not remove contracts for breaking a merge law. The decision is recorded at https://github.com/freenet/freenet-core/issues/5906#issuecomment-6677346389. The conformance code docs still described removal as the plan: the module docs called a violation "eventually meant to justify deleting a contract", `policy` said "Deletion is the last step of the RFC's deployment plan", and several docs called `would_remove` "the number the enforcement gate is judged on".  ## Solution  Documentation only. The docs now say: - removal was the RFC #5320 plan and is superseded, with a link to the decision; - verifier, `fdev verify-merge` and shadow results are diagnostics recorded locally; - nodes instead decline work a contract with a lawful merge never needs: a payload already merged into the node's current state is not merged again (`ring::applied_payloads`, #6125); - the removal machinery (`EnforcementMode::Enforce`, `ConformanceAction::Remove`, `RemovalTier`, the shadow `would_remove` count) is retained, unreachable and not planned to be enabled. Removing that code is left to a separate decision.  Files: `crates/core/src/conformance.rs` and `conformance/{policy,property,shadow,status,capture}.rs`, plus `.claude/rules/contracts.md`. No code paths, enums, config or CLI output change; `Enforce` stays unreachable exactly as before. One test doc and one assertion message in `shadow.rs` were reworded.  Left as is: the `fdev verify-merge` error text ("Most laws are removal-el

- **Issue #6135** (2026-11-07): **fix(config): honour data_dir from config.toml on default installs**
  *Symptoms*: ## Problem On a default install (no `--config-dir`), `data_dir` in `config.toml` is ignored, and the next boot then writes the default back over it. A user who edits it to move their data to another drive gets a fresh, empty node at the default location instead (#6134). This came up from a Windows user asking how to keep Freenet off C:. The FAQ currently documents a directory junction as the workaround.  Cause: `build_with_gateways_index` filled `config_paths.data_dir` with the default `data_local_dir` **before** reading `config.toml`. `ConfigPathsArgs::merge` uses `get_or_insert`, so a value that was already set beat the file's. The `--config-dir` branch never pre-filled, which is why the file was honoured there.  ## Solution Move the pre-fill into `ConfigPathsArgs::apply_default_dirs`, and pre-fill `data_dir` only for the temp-dir case. Test and `id` runs need that, because `ConfigPathsArgs::build` can only derive a default from `ProjectDirs` and hits `unreachable!` otherwise. The file isn't read for a temp dir anyway. For a real install, `data_dir` stays unset through the merge, so precedence becomes **CLI / `DATA_DIR` > `config.toml` > default**. When neither is set, `build()` supplies the same `data_local_dir()` default as before.  **The keypair and cipher follow the data dir.** `build()` persists `transport_keypair`, `cipher` (and an operator-supplied `nonce`) as absolute paths under the data dir. Moving the data dir hit two further problems: - `read_config` opened thos

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

### Incident Patch 1: `c9f3057f` (2026-11-07)
**Commit Message**: fix(transport): hold the bandwidth limit on short-RTT QUIC paths (#6126)

**File**: `.claude/rules/transport.md` (modified, +55/-9)
```diff
@@ -806,7 +806,7 @@ Rate calculation on every rate update (peer_connection::paced_rate; #6047):
   A configured limit only lowers the rate, never raises it above cc_rate.
   bandwidth_limit is the config after NetworkApiConfig::transport_bandwidth_limit
   (effective_bandwidth_limit, called once in p2p_protoc and pinned there by a
-  config.rs test): 0 = unset, ignored under any total-bandwidth-limit, and
+  config.rs test): 0 = unset, ignored under any non-zero total-bandwidth-limit (a total of 0 is unset), and
   raised to MIN_BANDWIDTH_LIMIT (2 x MIN_INBOUND_STREAM_RATE_BYTES_PER_SEC,
   64 KiB/s) if lower: near the receiver's age-limit rate, long streams fail.
   The bucket's INITIAL rate comes from peer_connection::initial_paced_rate at
@@ -816,8 +816,10 @@ Rate calculation on every rate update (peer_connection::paced_rate; #6047):
   (#3702 burst). The global share is still taken as is, as before #6047.
   Only stream fragments draw on the bucket; short messages, ACKs and
   retransmits are unpaced.
-  QUIC has no bucket. The same rate (QuicRateLimit::rate, which calls
-  paced_rate) caps each QUIC connection's congestion window instead:
+  QUIC has no share of this bucket. With a limit set its data is paced by a
+  bucket of its own at the limit (the path pacer, below), and the same rate
+  (QuicRateLimit::rate, which calls paced_rate) caps each QUIC connection's
+  congestion window:
   recycle::CappedCubic::window = min(Cubic's window, max(rate x RTT,
   window_floor)): the cap never goes below window_floor (two full datagrams
   and one byte, 2401 B: quinn refuses
@@ -835,11 +837,54 @@ Rate calculation on every rate update (peer_connection::paced_rate; #6047):
   does not hold where rate x RTT is under the floor: there a path keeps two
   datagrams in flight, about 2400 B per round trip (at the 64 KiB/s minimum,
   any round trip under about 37 ms; pinned by
-  the_floor_keeps_two_datagrams_in_flight_both_ways). A QUIC path is not a
-  connection to GlobalBandwidthManager: it rides on its UDP connection and
-  takes that connection's full share, so a peer whose traffic is split across
-  both transports can get up to twice its share (the egress cap still bounds
-  the node). e5b-6 decides whether one peer's streams stay on one transport.
+  the_floor_keeps_two_datagrams_in_flight_both_ways). On loopback a path ran
+  at 3.4 to 34 MB/s with 500 kB/s set.
+  Path pacer (quic/path/pacer.rs): with bandwidth-limit or
+  total-bandwidth-limit set (PeerConnection::path_rate_limit), the session
+  builds a LimitPacer on the path's clock (the one the send deadlines run
+  on), and every path of the connection draws its data writes from it: a
+  token bucket of the connection's QUIC side at QuicRateLimit::rate (the
+  limit, or the share, read again at every reservation; capacity rate / 10,
+  at least MIN_BUCKET_CAPACITY_BYTES, recomputed when the rate changes), so
+  the limit holds at any round trip. NOT the UDP stream bucket: that runs at
+  min(UDP controller rate, limit), and FixedRate's 1.25 MB/s would pace QUIC
+  below a higher limit, slower than no limit at all. Charged: each write of
+  a Stream or pipe (header, metadata, payload) and of a Short past one
+  packet. Not charged, as on UDP: one-packet Shorts and control frames,
+  which never wait behind data. With no limit nothing is paced. A write
+  reserves with reserve_within, limited to what the send's current deadline
+  leaves, and waits in the send's own task; a refused reservation takes
+  nothing and ends the send NotOpened(Paced) before the stream opened
+  (header and metadata are taken before open_uni) or Failed(Paced) after
+  (the stream is reset). A message the pacer refused that UDP then sent is
+  charged to the pacer in full as debt (QuicPath::charge_fallback, after the
+  UDP send succeeds), up to FALLBACK_DEBT (half a second at the rate): an
+  unbounded debt refused the next fragment of every stream already open, and
+  a refused open stream is dropped. Each refusal counts
+  quic_data_event_pacer_refused. A total-bandwidth-limit of 0 is unset for
+  both transports (NetworkApiConfig::effective_total_bandwidth_limit: no
+  global pool, so no UDP share, no QUIC pacer, no window cap, and a
+  bandwidth-limit beside it applies to both). Bytes taken for a write not
+  made go back. A refusal is never a timeout for the stall count (route.rs
+  timed_out); a pacer wait is NOT progress, so a dark paced path still goes
+  suspect and closes. Residual, accepted (lead, 2026-11-06; the design-B
+  residual): a peer whose data is on both transports at once can get up to
+  twice its share, for as long as that lasts. That includes a message the
+  pacer refused: the charge is booked when its UDP transfer ends and is
+  capped at half a second, so for the whole transfer QUIC keeps sending at
+  the pacer's rate beside it (a 10 MB fallback at a 100 kB/s bandwidth-limit
+  runs about 100 s on the UDP bucket, then 50 kB is charged). Data that
```

**File**: `crates/core/src/config.rs` (modified, +163/-12)
```diff
@@ -2368,7 +2368,7 @@ pub struct NetworkArgs {
     /// controller's rate: it can lower a connection's rate, never raise it, and
     /// N connections may send up to N times this. Short messages, ACKs and
     /// retransmits are not paced. To limit what the node sends as a whole, use
-    /// --total-bandwidth-limit, which overrides this.
+    /// --total-bandwidth-limit, which overrides this unless it is 0.
     /// 0 means unset; a value below 64 KiB/s (65,536 bytes/second) is raised to
     /// it with a warning. Low limits slow large transfers in proportion, and
     /// very large ones (multi-MB contract states) can miss their deadlines.
@@ -2382,7 +2382,9 @@ pub struct NetworkArgs {
     /// across all connections: data, handshakes, ACKs, keepalives and
     /// retransmissions. Each connection is also paced at
     /// total / active_connections (at least --min-bandwidth-per-connection).
-    /// Overrides the per-connection `--bandwidth-limit`.
+    /// Overrides the per-connection `--bandwidth-limit`. 0 means unset: no cap
+    /// and no per-connection share on UDP or QUIC, and `--bandwidth-limit`, if
+    /// set, then applies to both transports.
     #[arg(long)]
     #[serde(
         rename = "total-bandwidth-limit",
@@ -2720,7 +2722,7 @@ pub struct NetworkApiConfig {
     /// rate: 1.25 MB/s (`fixed_rate::DEFAULT_RATE_BYTES_PER_SEC`) for the default
     /// `fixedrate` controller, which does not adapt to queuing delay or other traffic.
     ///
-    /// If `total_bandwidth_limit` is set, this field is ignored and per-connection rates
+    /// If `total_bandwidth_limit` is set and not 0, this field is ignored and per-connection rates
     /// are derived from: `total_bandwidth_limit / active_connections`.
     #[serde(alias = "bandwidth-limit", skip_serializing_if = "Option::is_none")]
     pub bandwidth_limit: Option<usize>,
@@ -2906,17 +2908,59 @@ pub struct NetworkApiConfig {
 }
 
 impl NetworkApiConfig {
+    /// The `total-bandwidth-limit` the node applies: the configured value, with
+    /// 0 read as unset. A total of 0 is no cap, so it builds no egress cap, no
+    /// global pool and no per-connection share, for UDP and QUIC alike, and a
+    /// `bandwidth-limit` beside it applies.
+    pub(crate) fn effective_total_bandwidth_limit(&self) -> Option<usize> {
+        self.total_bandwidth_limit.filter(|total| *total > 0)
+    }
+
+    /// Warn that a `total-bandwidth-limit` of 0 is no limit
+    /// ([`Self::effective_total_bandwidth_limit`]), so an operator who set it
+    /// expecting a cap sees why none applies. Call it once per node.
+    pub(crate) fn warn_if_total_bandwidth_limit_is_zero(&self) {
+        if self.total_bandwidth_limit == Some(0) {
+            tracing::warn!(
+                "total-bandwidth-limit is 0, which is no limit: no node-wide egress cap \
+                 and no per-connection share is applied, and bandwidth-limit applies \
+                 if set"
+            );
+        }
+    }
+
+    /// The node's global bandwidth pool, when `total-bandwidth-limit` is set
+    /// ([`Self::effective_total_bandwidth_limit`]). Its per-connection share
+    /// paces UDP (`peer_connection::paced_rate`) and QUIC
+    /// (`quic::config::QuicRateLimit`) alike.
+    ///
+    /// The node's only builder of the pool, and so the only thing keeping a
+    /// total of 0 from pacing: `QuicRateLimit::rate` and UDP's `paced_rate`
+    /// take any pool they are given, so a second builder that skipped this
+    /// would bring back pacing at the 1 MB/s minimum.
+    pub(crate) fn global_bandwidth_manager(
+        &self,
+    ) -> Option<std::sync::Arc<crate::transport::global_bandwidth::GlobalBandwidthManager>> {
+        self.effective_total_bandwidth_limit().map(|total| {
+            std::sync::Arc::new(
+                crate::transport::global_bandwidth::GlobalBandwidthManager::new(
+                    total,
+                    self.min_bandwidth_per_connection,
+                ),
+            )
+        })
+    }
+
     /// The per-connection `bandwidth-limit` the node hands its transport
     /// (#6047): the configured value after
     /// [`effective_bandwidth_limit`](crate::transport::peer_connection::effective_bandwidth_limit),
-    /// which ignores it whenever `total-bandwidth-limit` is set. That includes
-    /// a total of 0: a global pool is built for any configured total, and its
-    /// share overrides the per-connection limit anyway. Logs what it decided,
-    /// so call it once per node.
+    /// which ignores it whenever `total-bandwidth-limit` is set
+    /// ([`Self::effective_total_bandwidth_limit`]: a total of 0 is unset, so
+    /// the limit then applies). Logs what it decided, so call it once per node.
     pub(crate) fn transport_bandwidth_limit(&self) -> Option<usize> {
         crate::transport::peer_connection::effective_bandwidth_limit(
             self.bandwidth_limit,
-            self.total_bandwidth_limit.is_some(),
+          
```

**File**: `crates/core/src/contract/executor.rs` (modified, +44/-5)
```diff
@@ -2507,6 +2507,45 @@ mod tests {
         );
     }
 
+    /// What follows `const ` in a module-scope constant declaration of any
+    /// visibility (`const`, `pub const`, `pub(crate)`, `pub(super)`,
+    /// `pub(in some::path)`), or `None` for any other line.
+    fn const_declaration(line: &str) -> Option<&str> {
+        let rest = match line.strip_prefix("pub") {
+            None => line,
+            Some(after) => match after.strip_prefix('(') {
+                Some(inner) => inner.split_once(')')?.1.strip_prefix(' ')?,
+                None => after.strip_prefix(' ')?,
+            },
+        };
+        rest.strip_prefix("const ")
+    }
+
+    #[test]
+    fn const_declaration_reads_every_visibility() {
+        for (line, want) in [
+            ("const A_BYTES: usize = 1;", Some("A_BYTES: usize = 1;")),
+            ("pub const A_BYTES: usize = 1;", Some("A_BYTES: usize = 1;")),
+            (
+                "pub(crate) const A_BYTES: usize = 1;",
+                Some("A_BYTES: usize = 1;"),
+            ),
+            (
+                "pub(super) const A_BYTES: usize = 1;",
+                Some("A_BYTES: usize = 1;"),
+            ),
+            (
+                "pub(in crate::transport) const A_BYTES: usize = 1;",
+                Some("A_BYTES: usize = 1;"),
+            ),
+            ("    const A_BYTES: usize = 1;", None),
+            ("pub fn a_bytes() -> usize {", None),
+            ("pub(crate) static A_BYTES: usize = 1;", None),
+        ] {
+            assert_eq!(const_declaration(line), want, "{line:?}");
+        }
+    }
+
     /// The other half of `declared_cache_ceiling_names_every_budget`, and the
     /// half that was missing: that one catches a summed budget being REMOVED;
     /// this one catches a new one being ADDED and not summed.
@@ -3099,11 +3138,11 @@ mod tests {
             for (i, line) in lines.iter().copied().enumerate() {
                 // Module scope only: an indented declaration is inside a
                 // function or a test module and cannot be a node-wide budget.
-                if let Some(rest) = line
-                    .strip_prefix("const ")
-                    .or_else(|| line.strip_prefix("pub const "))
-                    .or_else(|| line.strip_prefix("pub(crate) const "))
-                    .or_else(|| line.strip_prefix("pub(super) const "))
+                // Any visibility, `pub(in path)` included: a fixed list of
+                // prefixes dropped `MIN_BUCKET_CAPACITY_BYTES` from discovery
+                // when it became `pub(in crate::transport)`, leaving its
+                // `NOT_SUMMED` entry naming nothing.
+                if let Some(rest) = const_declaration(line)
                     && let Some((name, tail)) = rest.split_once(':')
                     // `ByteCount` as well as `usize`: a budget does not stop
                     // being a budget because its type became safer. This guard
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +18/-21)
```diff
@@ -1316,6 +1316,10 @@ impl P2pConnManager {
             quic.breaker,
         );
 
+        config
+            .config
+            .network_api
+            .warn_if_total_bandwidth_limit_is_zero();
         Ok(P2pConnManager {
             gateways,
             bridge,
@@ -1340,34 +1344,27 @@ impl P2pConnManager {
             global_bandwidth: config
                 .config
                 .network_api
-                .total_bandwidth_limit
-                .map(|total| {
-                    let manager = Arc::new(GlobalBandwidthManager::new(
-                        total,
-                        config.config.network_api.min_bandwidth_per_connection,
-                    ));
+                .global_bandwidth_manager()
+                .inspect(|manager| {
                     // The transport builds a node-wide egress cap from the
                     // same total (`transport::egress_cap`); say so at startup,
                     // and warn when it is low for the allowed connections.
-                    if total > 0 {
-                        crate::transport::egress_cap::log_startup_cap(
-                            total,
-                            config
-                                .config
-                                .network_api
-                                .min_bandwidth_per_connection
-                                .unwrap_or(
-                                    crate::transport::global_bandwidth::DEFAULT_MIN_PER_CONNECTION,
-                                ),
-                            config.config.network_api.max_connections,
-                        );
-                    }
+                    crate::transport::egress_cap::log_startup_cap(
+                        manager.total_limit(),
+                        config
+                            .config
+                            .network_api
+                            .min_bandwidth_per_connection
+                            .unwrap_or(
+                                crate::transport::global_bandwidth::DEFAULT_MIN_PER_CONNECTION,
+                            ),
+                        config.config.network_api.max_connections,
+                    );
                     // Phase 1.6 shadow telemetry (#4074): expose the
                     // effective aggregate rate R to the demand aggregator.
                     // Observation only — the manager is read, never written,
                     // by the shadow side. See transport/shadow_demand.rs.
-                    crate::transport::shadow_demand::register_global_bandwidth(&manager);
-                    manager
+                    crate::transport::shadow_demand::register_global_bandwidth(manager);
                 }),
             ledbat_min_ssthresh: config.config.network_api.ledbat_min_ssthresh,
             congestion_config: config.config.network_api.build_congestion_config(),
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +4/-3)
```diff
@@ -102,7 +102,7 @@ const TOKEN_BUCKET_WINDOW: Duration = Duration::from_millis(100);
 /// (~1200 bytes) cannot be admitted, stalling connections at very low rates.
 /// 8 KiB (~6–7 max-size packets) provides enough headroom for burst handling
 /// without allowing large uncontrolled bursts.
-const MIN_BUCKET_CAPACITY_BYTES: usize = 8192;
+pub(in crate::transport) const MIN_BUCKET_CAPACITY_BYTES: usize = 8192;
 
 pub type SerializedMessage = Vec<u8>;
 
@@ -249,8 +249,9 @@ pub(super) async fn bind_udp_listener<S: Socket>(
         .as_ref()
         .and_then(|_| get_socket_virtual_time(&bind_addr));
     // The node-wide egress cap exists only when `total-bandwidth-limit` is
-    // set and not 0 (`global_bandwidth` is set, and `from_total_limit`
-    // builds no cap for 0), so a node without it pays nothing. The cap runs
+    // set and not 0 (`global_bandwidth` is set; the node builds no pool for a
+    // total of 0, `NetworkApiConfig::global_bandwidth_manager`), so a node
+    // without it pays nothing. The cap runs
     // on `RealTime`, as the listener built below does, in production and in
     // simulation alike; waiters sleep on their own connection's time
     // source. A cap on the network's `VirtualTime` would compute deficits on
```

**File**: `crates/core/src/transport/egress_cap.rs` (modified, +7/-9)
```diff
@@ -783,9 +783,9 @@ pub struct EgressTake<'a> {
 impl EgressCap {
     /// A cap of `rate_bytes_per_sec`, starting with a full bucket.
     pub(crate) fn new<T: TimeSource>(rate_bytes_per_sec: u64, time_source: T) -> Self {
-        // A rate of 0 cannot be met by anything; callers do not build a cap
-        // for it (see `from_total_limit`). Treat it as 1 B/s rather than
-        // dividing by zero.
+        // A rate of 0 cannot be met by anything, and the node never builds a
+        // cap for it (no pool is built for a total of 0). Treat it as 1 B/s
+        // rather than dividing by zero.
         let rate = rate_bytes_per_sec.max(1);
         let burst_bytes = (rate as u128 * BURST_WINDOW.as_nanos() / NANOS_PER_SEC) as u64;
         let burst_bytes = burst_bytes.max(MIN_BURST_PACKETS * MAX_PACKET_SIZE as u64);
@@ -818,17 +818,15 @@ impl EgressCap {
         }
     }
 
-    /// The cap for a configured `total-bandwidth-limit`, or `None` when the
-    /// value cannot be a cap (0).
+    /// The cap for a configured `total-bandwidth-limit`, or `None` for 0,
+    /// which cannot be a cap. The node never passes 0 (it builds no pool for
+    /// it, and warns at startup, `P2pConnManager::build`), so this is only a
+    /// guard.
     pub(crate) fn from_total_limit<T: TimeSource>(
         total_bytes_per_sec: usize,
         time_source: T,
     ) -> Option<Self> {
         if total_bytes_per_sec == 0 {
-            tracing::warn!(
-                "total-bandwidth-limit is 0; no node-wide egress cap is applied \
-                 (a cap of 0 bytes per second cannot be met)"
-            );
             return None;
         }
         Some(Self::new(total_bytes_per_sec as u64, time_source))
```

**File**: `crates/core/src/transport/peer_connection.rs` (modified, +43/-1)
```diff
@@ -189,7 +189,7 @@ pub(crate) struct RemoteConnection<S = super::UdpSocket, T: TimeSource = RealTim
 /// Before #6047 the rate update ignored `bandwidth-limit`, which then only set
 /// the initial rate. `bandwidth_limit` is the value after
 /// [`effective_bandwidth_limit`].
-pub(super) fn paced_rate(
+pub(crate) fn paced_rate(
     cc_rate: usize,
     global_rate: Option<usize>,
     bandwidth_limit: Option<usize>,
@@ -1095,6 +1095,7 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
                 self.inbound_budget.clone(),
                 self.quic_receipt_nanos.clone(),
                 self.udp_sender(),
+                self.path_rate_limit(),
                 self.remote_conn.time_source.clone(),
             );
             self.quic_path = Some(quic_path);
@@ -1244,6 +1245,20 @@ impl<S: super::Socket, T: TimeSource> PeerConnection<S, T> {
         self.pending_decline = None;
     }
 
+    /// The bandwidth limit this connection's QUIC data is paced at
+    /// (`bandwidth-limit`, or `total-bandwidth-limit` and its share), or `None`
+    /// with no limit. The session builds the pacer from it, on the path's
+    /// clock (`quic::path::pacer`): a bucket of the QUIC side's own, not the
+    /// UDP stream bucket, whose rate the UDP congestion controller can hold
+    /// below the limit.
+    fn path_rate_limit(&self) -> Option<crate::transport::quic::config::QuicRateLimit> {
+        let limit = crate::transport::quic::config::QuicRateLimit::new(
+            self.remote_conn.bandwidth_limit,
+            self.remote_conn.global_bandwidth.clone(),
+        );
+        limit.rate().is_some().then_some(limit)
+    }
+
     /// What sends one tracked packet on the UDP session from outside the
     /// connection's task.
     fn udp_sender(&self) -> UdpSender<S, T> {
@@ -6635,6 +6650,33 @@ mod tests {
         (conn, inbound_tx)
     }
 
+    /// A connection paces its QUIC data at a limit only when one is set
+    /// (`bandwidth-limit`, or `total-bandwidth-limit`), and at that limit, not
+    /// at the UDP bucket's rate: 5 MB/s is above FixedRate's 1.25 MB/s.
+    #[tokio::test]
+    async fn quic_data_is_paced_only_under_a_limit_and_at_that_limit() {
+        let addr: SocketAddr = "127.0.0.1:41000".parse().unwrap();
+        let (unlimited, _tx) = test_conn_with_bandwidth_limit(addr, None);
+        assert!(unlimited.path_rate_limit().is_none(), "no limit, no pacing");
+        let (zero, _tx) = test_conn_with_bandwidth_limit(addr, Some(0));
+        assert!(zero.path_rate_limit().is_none(), "0 is unset");
+        let (limited, _tx) = test_conn_with_bandwidth_limit(addr, Some(5_000_000));
+        assert_eq!(
+            limited.path_rate_limit().and_then(|limit| limit.rate()),
+            Some(5_000_000)
+        );
+        let (mut shared, _tx) = test_conn_with_bandwidth_limit(addr, None);
+        shared.remote_conn.global_bandwidth =
+            Some(Arc::new(GlobalBandwidthManager::new(500_000, Some(1000))));
+        assert_eq!(
+            shared.path_rate_limit().and_then(|limit| limit.rate()),
+            Some(500_000),
+            "total-bandwidth-limit paces at the connection's share"
+        );
+        // A total of 0 builds no manager, so it reaches no connection
+        // (config::tests::a_total_of_zero_paces_neither_transport).
+    }
+
     /// Runs `conn`'s real `recv()` loop until its token bucket's rate is
     /// `expected` or `limit` passes, and returns the rate it ended at.
     /// `rate_update_check` first fires after `ACK_CHECK_INTERVAL` (100 ms) on
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests.rs` (modified, +61/-0)
```diff
@@ -3659,3 +3659,64 @@ async fn set_peer_identity_promotes_the_session_on_set_and_same_only() {
     assert_eq!(promoted(&e), None, "Refused");
     assert_eq!(e.conn.peer_identity(), Some(&key));
 }
+
+/// A connection opens its upgrade session with a pacer when it has a bandwidth
+/// limit, and without one when it has none: `open_session` builds the pacer
+/// from the connection's limit.
+#[tokio::test(start_paused = true)]
+async fn a_session_paces_its_data_only_under_a_limit() {
+    for (case, subnet, limit) in [("none", 30, None), ("limited", 31, Some(100_000))] {
+        let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(
+            &format!("ack-policy-paced-{case}"),
+            subnet,
+        )
+        .await;
+        let mut e = single(CAPABLE);
+        e.conn.remote_conn.bandwidth_limit = limit;
+        e.conn = e.conn.with_upgrade_site(&hub.site());
+        assert_eq!(
+            e.conn.quic_path.as_ref().expect("a session").paces_data(),
+            limit.is_some(),
+            "{case}"
+        );
+    }
+}
+
+/// The pacer a session builds runs on the path's clock, the one its paths'
+/// send deadlines run on, not the connection's: a 200 kB reservation at a
+/// 100 kB/s limit waits about 1.9 s (the burst is 10 kB), and that wait shrinks
+/// as the path's virtual clock advances, while the connection's clock (real
+/// time here) barely moves.
+#[tokio::test(start_paused = true)]
+async fn a_sessions_pacer_runs_on_the_path_clock() {
+    let hub = crate::transport::quic::upgrade::driver::tests::Harness::server(
+        "ack-policy-pacer-clock",
+        32,
+    )
+    .await;
+    let mut e = single(CAPABLE);
+    e.conn.remote_conn.bandwidth_limit = Some(100_000);
+    e.conn = e.conn.with_upgrade_site(&hub.site());
+    let pacer = e
+        .conn
+        .quic_path
+        .as_ref()
+        .expect("a session")
+        .pacer()
+        .expect("a limit paces");
+    let first = pacer
+        .reserve_within(200_000, Duration::MAX)
+        .expect("no limit to refuse at");
+    assert!(
+        first >= Duration::from_millis(1_850) && first <= Duration::from_millis(1_950),
+        "{first:?}"
+    );
+    hub.time().advance(Duration::from_secs(1));
+    let after = pacer
+        .reserve_within(0, Duration::MAX)
+        .expect("no limit to refuse at");
+    assert!(
+        after >= Duration::from_millis(850) && after <= Duration::from_millis(950),
+        "a second of the path's clock paid a second of the debt: {after:?}"
+    );
+}
```

---

### Incident Patch 2: `a1937892` (2026-11-07)
**Commit Message**: fix(ring): run the disk-usage walk inline on simulation hosts (#6129)

**File**: `crates/core/src/ring.rs` (modified, +93/-5)
```diff
@@ -3614,6 +3614,21 @@ impl Ring {
     /// When contracts are evicted (past max entries and beyond TTL), this task
     /// cleans up the local subscription state. The upstream peer will eventually
     /// prune us when updates fail to deliver.
+    /// The free-space figure the hosting sweep budgets disk against.
+    ///
+    /// `read_real` is the data-dir mount's free space (`statvfs`); a failed
+    /// read falls back to `u64::MAX`, so the disk budget clamps to its cap. In
+    /// a simulation (`SimNetwork` sets the network name on the thread its
+    /// nodes run on) the real read is skipped and the fallback used, so free
+    /// space on the machine running the tests cannot change eviction between
+    /// runs of one seed (#6123).
+    fn sweep_free_space_bytes(read_real: impl FnOnce() -> Option<u64>) -> u64 {
+        if topology_registry::get_current_network_name().is_some() {
+            return u64::MAX;
+        }
+        read_real().unwrap_or(u64::MAX)
+    }
+
     async fn sweep_get_subscription_cache(ring: Arc<Self>, interval_duration: Duration) {
         let shutdown = ring.shutdown_token();
         // Add random initial delay to prevent synchronized sweeps across peers
@@ -3853,8 +3868,14 @@ impl Ring {
             // no `.await` point. Push it onto a blocking thread so it can never
             // stall other tasks on the async reactor — the same discipline
             // `secrets_store/sweep.rs` uses for its "disk walk + ReDb reads".
+            //
+            // `offload_blocking`, not a bare `spawn_blocking`: on a simulation
+            // host (`current_thread`) it runs the walk inline. A pool thread
+            // finishes in wall-clock time, so the step at which this loop
+            // resumed depended on OS scheduling and one seed gave different
+            // results from run to run (#6123).
             let ring_for_disk = ring.clone();
-            if let Err(err) = tokio::task::spawn_blocking(move || {
+            if let Err(err) = crate::util::blocking::offload_blocking(move || {
                 #[cfg(feature = "redb")]
                 ring_for_disk.hosting_manager.seed_disk_tracker_if_absent();
                 ring_for_disk.hosting_manager.refresh_disk_usage();
@@ -3876,10 +3897,8 @@ impl Ring {
             // du-walks above already ran OUTSIDE any cache lock (in the blocking
             // task); only the O(1) `set_budget_bytes` inside
             // `recompute_effective_budget` takes the cache write lock.
-            let available = ring
-                .hosting_manager
-                .disk_available_bytes()
-                .unwrap_or(u64::MAX);
+            let available =
+                Self::sweep_free_space_bytes(|| ring.hosting_manager.disk_available_bytes());
             ring.hosting_manager.recompute_effective_budget(available);
         }
     }
@@ -8203,6 +8222,75 @@ mod k_closest_source_tests {
         );
     }
 
+    /// #6123: the hosting sweep's disk-usage walk goes through
+    /// `offload_blocking`, so a simulation host runs it inline. Through a bare
+    /// `spawn_blocking` it finished on a real OS thread in wall-clock time, the
+    /// step at which the sweep resumed followed OS scheduling, and one seed gave
+    /// different results from run to run. In a simulation the free-space read
+    /// is replaced by a fixed figure for the same reason. Comment lines are
+    /// dropped, so a commented-out call fails this pin too.
+    #[test]
+    fn sweep_disk_walk_runs_inline_in_simulations() {
+        let src = production_source();
+        let body = extract_fn_body(
+            src,
+            "async fn sweep_get_subscription_cache(ring: Arc<Self>, interval_duration: Duration) {",
+        );
+        let code: String = body
+            .lines()
+            .filter(|line| !line.trim_start().starts_with("//"))
+            .flat_map(|line| line.chars())
+            .filter(|c| !c.is_whitespace())
+            .collect();
+        assert!(
+            !code.contains("spawn_blocking("),
+            "the sweep awaits a bare spawn_blocking; use offload_blocking (#6123)"
+        );
+        let walk = code
+            .split_once("crate::util::blocking::offload_blocking(move||{")
+            .map(|(_, after)| after)
+            .and_then(|after| after.split_once("}).await"))
+            .map(|(walk, _)| walk)
+            .expect("the sweep runs a closure through offload_blocking");
+        assert!(
+            walk.contains("ring_for_disk.hosting_manager.refresh_disk_usage();"),
+            "offload_blocking must wrap the disk-usage walk"
+        );
+        assert!(
+            code.contains(
+                "letavailable=Self::sweep_free_space_bytes(||ring.hosting_manager.disk_available_bytes());"
+            ),
+            "the sweep's free space goes through the simulation gate (#6123)"
+        );
+    }
+
+    /// In a simulation the sweep's free-space figure is the fixed fallback and
+    /// the
```

**File**: `crates/core/src/util.rs` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 #[cfg(test)]
 pub(crate) mod alloc_count;
 pub(crate) mod backoff;
+pub(crate) mod blocking;
 pub(crate) mod byte_bounded_lru;
 pub mod deterministic_select;
 /// Internal to the `freenet` binary: not a stable API (it exposes reqwest types).
```

**File**: `crates/core/src/util/blocking.rs` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+//! Blocking work that must not stall the async reactor, and must not make a
+//! simulation depend on OS scheduling.
+
+/// Runs blocking `f` on the blocking pool in production, and inline on a
+/// `current_thread` runtime.
+///
+/// On a multi-thread runtime (the node in production) `f` goes to
+/// `spawn_blocking`, so a long disk walk cannot stall other tasks.
+///
+/// On a `current_thread` runtime (every turmoil host in a simulation, and most
+/// tests) `f` runs inline. A blocking-pool thread finishes in wall-clock time,
+/// so the simulation step at which the awaiting task resumes would depend on
+/// how the OS schedules that thread, and the same seed would take different
+/// paths from one run to the next (#6123). The executor's
+/// `run_blocking_offloaded` uses the same gate for the same reason.
+///
+/// A panic in `f` is caught on both paths and returned as [`BlockingPanicked`],
+/// so a caller's loop survives it either way.
+pub(crate) async fn offload_blocking<F, R>(f: F) -> Result<R, BlockingPanicked>
+where
+    F: FnOnce() -> R + Send + 'static,
+    R: Send + 'static,
+{
+    use tokio::runtime::{Handle, RuntimeFlavor};
+    match Handle::try_current() {
+        Ok(handle) if handle.runtime_flavor() == RuntimeFlavor::MultiThread => {
+            tokio::task::spawn_blocking(f)
+                .await
+                .map_err(|err| BlockingPanicked(err.to_string()))
+        }
+        _ => std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).map_err(|payload| {
+            let message = payload
+                .downcast_ref::<&str>()
+                .map(|s| (*s).to_string())
+                .or_else(|| payload.downcast_ref::<String>().cloned())
+                .unwrap_or_else(|| "non-string panic payload".to_string());
+            BlockingPanicked(message)
+        }),
+    }
+}
+
+/// The blocking closure given to [`offload_blocking`] panicked (or, on the
+/// blocking pool, was cancelled by runtime shutdown).
+#[derive(Debug)]
+pub(crate) struct BlockingPanicked(String);
+
+impl std::fmt::Display for BlockingPanicked {
+    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        write!(f, "blocking task failed: {}", self.0)
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[tokio::test(flavor = "current_thread")]
+    async fn runs_inline_on_a_current_thread_runtime() {
+        let caller = std::thread::current().id();
+        let ran_on = offload_blocking(|| std::thread::current().id())
+            .await
+            .unwrap();
+        assert_eq!(
+            ran_on, caller,
+            "a simulation host must not hand the work to a wall-clock thread"
+        );
+    }
+
+    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
+    async fn uses_the_blocking_pool_on_a_multi_thread_runtime() {
+        let caller = std::thread::current().id();
+        let ran_on = offload_blocking(|| std::thread::current().id())
+            .await
+            .unwrap();
+        assert_ne!(
+            ran_on, caller,
+            "production must keep the disk walk off the reactor thread"
+        );
+    }
+
+    #[tokio::test(flavor = "current_thread")]
+    async fn an_inline_panic_comes_back_as_an_error() {
+        let outcome = offload_blocking(|| -> () { panic!("walk failed") }).await;
+        let err = outcome.expect_err("the panic must be caught");
+        assert!(err.to_string().contains("walk failed"), "{err}");
+    }
+
+    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
+    async fn a_pool_panic_comes_back_as_an_error() {
+        let outcome = offload_blocking(|| -> () { panic!("walk failed") }).await;
+        let err = outcome.expect_err("the panic must be caught");
+        assert!(err.to_string().contains("walk failed"), "{err}");
+    }
+}
```

**File**: `crates/core/tests/simulation_integration.rs` (modified, +192/-0)
```diff
@@ -848,6 +848,198 @@ impl TraceFingerprint {
     }
 }
 
+/// Thread ids of the tokio blocking-pool threads alive now (Linux).
+#[cfg(target_os = "linux")]
+fn blocking_pool_threads() -> std::collections::BTreeSet<u64> {
+    let Ok(tasks) = std::fs::read_dir("/proc/self/task") else {
+        return Default::default();
+    };
+    tasks
+        .flatten()
+        .filter_map(|task| {
+            let tid = task.file_name().to_str()?.parse::<u64>().ok()?;
+            let name = std::fs::read_to_string(task.path().join("comm")).ok()?;
+            (name.trim_end() == "tokio-rt-worker").then_some(tid)
+        })
+        .collect()
+}
+
+#[cfg(target_os = "linux")]
+const NO_BLOCKING_POOL_CHILD_ENV: &str = "FREENET_NO_BLOCKING_POOL_CHILD";
+#[cfg(target_os = "linux")]
+const NO_BLOCKING_POOL_TEST: &str = "test_simulation_uses_no_blocking_pool_thread";
+
+/// No simulated node may hand work to tokio's blocking pool.
+///
+/// A blocking-pool thread finishes in wall-clock time, so the simulation step
+/// at which the awaiting task resumes follows OS scheduling, and one seed gives
+/// different results from run to run. That was #6123: Ring's disk-usage sweep
+/// awaited `spawn_blocking` (now `offload_blocking`, inline on a simulation
+/// host). The sweep first walks 70-90 s of virtual time into a run, so this run
+/// keeps operations going to about 140 s and watches, every 20 ms, for a
+/// `tokio-rt-worker` thread (tokio's name for its blocking-pool threads) that
+/// was not there before the simulation started. It catches any awaited
+/// `spawn_blocking` or `tokio::fs` call on a simulation path, not only the
+/// sweep's. The polling matters: an idle blocking thread exits after 10 s, so
+/// a check at the end alone could miss one used early.
+///
+/// Runs in a child process (a re-exec of this binary filtered to this test), so
+/// no other test in the same `cargo test` process can create a blocking thread
+/// during the watch.
+#[cfg(target_os = "linux")]
+#[test]
+fn test_simulation_uses_no_blocking_pool_thread() {
+    if std::env::var_os(NO_BLOCKING_POOL_CHILD_ENV).is_none() {
+        let output = std::process::Command::new("/proc/self/exe")
+            .args([
+                "--exact",
+                "--test-threads=1",
+                "--nocapture",
+                NO_BLOCKING_POOL_TEST,
+            ])
+            .env(NO_BLOCKING_POOL_CHILD_ENV, "1")
+            .output()
+            .expect("re-exec the test binary");
+        let stdout = String::from_utf8_lossy(&output.stdout);
+        let stderr = String::from_utf8_lossy(&output.stderr);
+        assert!(
+            output.status.success(),
+            "child run of {NO_BLOCKING_POOL_TEST} failed.\nstdout:\n{stdout}\nstderr:\n{stderr}",
+        );
+        // libtest exits 0 when its filter matches nothing; fail closed on a
+        // rename instead of passing vacuously.
+        assert!(
+            stdout.contains("1 passed"),
+            "the child must actually have run {NO_BLOCKING_POOL_TEST}; if it was \
+             renamed, update NO_BLOCKING_POOL_TEST.\nstdout:\n{stdout}\nstderr:\n{stderr}",
+        );
+        return;
+    }
+
+    const SEED: u64 = 0xD15C_6123;
+    const NAME: &str = "no-blocking-pool";
+    const NODES: usize = 9;
+    const CONTRACTS: u8 = 4;
+    const ROUNDS: usize = 30;
+
+    // Positive control: a deliberate `spawn_blocking` on a runtime of its own
+    // must show up, or the detector is blind (tokio renamed its blocking
+    // threads, or something set a thread name) and an empty result below
+    // would mean nothing.
+    {
+        let control_before = blocking_pool_threads();
+        let control = create_runtime();
+        control
+            .block_on(async {
+                tokio::task::spawn_blocking(|| {
+                    std::thread::sleep(Duration::from_millis(50));
+                })
+                .await
+            })
+            .expect("control blocking task");
+        let seen = blocking_pool_threads();
+        assert!(
+            seen.difference(&control_before).next().is_some(),
+            "the detector did not see a deliberate spawn_blocking; tokio's \
+             blocking-pool thread name is no longer \"tokio-rt-worker\", so this \
+             test would pass without detecting anything"
+        );
+        drop(control);
+    }
+
+    // Taken before the network is built, so a blocking thread created while
+    // building it counts too.
+    let before = blocking_pool_threads();
+    setup_deterministic_state(SEED);
+    let rt = create_runtime();
+    let mut sim = rt.block_on(SimNetwork::new(NAME, 1, NODES, 10, 3, 8, 3, SEED));
+
+    let contracts: Vec<_> = (0..CONTRACTS)
+        .map(|i| SimOperation::create_test_contract(0x60 + i))
+        .collect();
+    let mut operations = Vec::new();
+    for (i, contract) in contracts.iter().enumerate() {
+        operations.push(ScheduledOperation::new(
+            NodeLabel::gateway
```

#### Recent Merged Pull Requests:
- **PR #6137** (2026-11-07): docs: retire the contract-removal plan from conformance docs (@sanity)
- **PR #6135** (closed): fix(config): honour data_dir from config.toml on default installs (@sanity)
- **PR #6131** (2026-11-06): test(util): count the summary thread's allows in the rate-limit stress test (@sanity)
- **PR #6130** (2026-11-07): feat: user-approved app grants for native clients (#5264) (@sanity)
- **PR #6129** (2026-11-07): fix(ring): run the disk-usage walk inline on simulation hosts (@sanity)
- **PR #6127** (2026-11-07): fix(update): wait for a streamed broadcast as long as the receiver keeps the stream (@sanity)

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

## X. transport): hold the bandwidth limit on short-RTT QUIC paths (#6126)

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c9f3057f`: transport): hold the bandwidth limit on short-RTT QUIC paths (#6126). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  config.rs test): 0 = unset, ignored under any non-zero total-bandwidth-limit (a total of 0 is unset), and
  QUIC has no share of this bucket. With a limit set its data is paced by a
  bucket of its own at the limit (the path pacer, below), and the same rate
  (QuicRateLimit::rate, which calls paced_rate) caps each QUIC connection's
  congestion window:
  the_floor_keeps_two_datagrams_in_flight_both_ways). On loopback a path ran
  at 3.4 to 34 MB/s with 500 kB/s set.
  Path pacer (quic/path/pacer.rs): with bandwidth-limit or
  total-bandwidth-limit set (PeerConnection::path_rate_limit), the session
  builds a LimitPacer on the path's clock (the one the send deadlines run
  on), and every path of the connection draws its data writes from it: a
  token bucket of the connection's QUIC side at QuicRateLimit::rate (the
  limit, or the share, read again at every reservation; capacity rate / 10,
  at least MIN_BUCKET_CAPACITY_BYTES, recomputed when the rate changes), so
  the limit holds at any round trip. NOT the UDP stream bucket: that runs at
  min(UDP controller rate, limit), and FixedRate's 1.25 MB/s would pace QUIC
  below a higher limit, slower than no limit at all. Charged: each 
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  config.rs test): 0 = unset, ignored under any total-bandwidth-limit, and
  QUIC has no bucket. The same rate (QuicRateLimit::rate, which calls
  paced_rate) caps each QUIC connection's congestion window instead:
  the_floor_keeps_two_datagrams_in_flight_both_ways). A QUIC path is not a
  connection to GlobalBandwidthManager: it rides on its UDP connection and
  takes that connection's full share, so a peer whose traffic is split across
  both transports can get up to twice its share (the egress cap still bounds
  the node). e5b-6 decides whether one peer's streams stay on one transport.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c9f3057f` are properly handled with clean fallback behavior.
