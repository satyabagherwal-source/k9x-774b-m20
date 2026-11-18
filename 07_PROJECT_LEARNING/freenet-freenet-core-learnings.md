> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `b7ba2671`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T21:42:21.771Z  
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
> **Harvest Timestamp**: 2026-11-18T21:42:21.765Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3129 stars

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
- **Issue #6285** (2026-11-18): **fix(hosting): keep contract state inside --max-hosting-storage**
  *Symptoms*: ## Problem Three paths let contract state stay on disk outside `--max-hosting-storage`, or kept eviction from running:  1. Relayed UPDATEs were merged into, and persisted for, a contract that is neither hosted nor in use. That moves the state generation without re-hosting, so the "written since eviction" guard in `RuntimePool::remove_contract` re-queued reclamation with no limit, for as long as a peer kept sending. 2. `Ring::commit_state_write` refreshed only the generation in the hosting cache, not the size, so state grown by UPDATE was never charged and the byte budget never triggered eviction. 3. `FairEventQueue::pop` served Background only when NetworkRelay was empty, and `EvictContract` was Background, so a steady trickle of relayed writes stalled reclamation.  A fourth issue (a relayed SUBSCRIBE registering a subscriber for state an eviction left on disk) is handled separately.  ## Approach 1. **Merge rule.** A relayed write is merged into the local copy only if the contract is hosted or in use (`Ring::may_merge_relayed_update`). It gates `RequestUpdate`, `BroadcastTo`, their two streaming forms, and PUT `ProbeReconcile`, which previously merged on an upstream lease alone.    - A `RequestUpdate` (streaming or not) for any other contract is forwarded toward the hosts, as for a contract this node does not hold. `BroadcastTo` and a refused `ProbeReconcile` are skipped or routed on.    - Skipped broadcasts are counted in a process counter, logged at `info` on each power of 
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> I'm done reading the diff and the rule files, so here is the review.  ### Rule Review: 2 warnings, 2 info  **Rules checked:** git-workflow.md, code-style.md, testing.md, operations.md, contracts.md, ring.md. `contracts.md` and `ring.md` had nothing applicable to these changes. **Files reviewed:** 12 (including the `.claude/rules/operations.md` doc change)  #### Warnings - `crates/core/src/operations/update/op_ctx_task.rs:8330-8353` (`driver_body` plus `every_relay_merge_site_checks_may_merge_relayed_update`, `declined_streaming_request_update_is_forwarded`)   - **Problem:** the new source-scrape pins slice the region with a bare `src.find(name)` and then `body.find("\n}\n")`. They do not reject an anchor that matched inside the test module, as `fn_body()` does.   - **Failure mode:** each `name` is also a string literal in the test's own array, which sits later in the same file. If a driver is renamed or moved, `find` lands on that literal. The region then ru

- **Issue #6283** (2026-11-18): **test: give the two merge-budget sims their own network names**
  *Symptoms*: ## Problem `non_settling_contract_is_bounded_by_merge_budget` and `non_settling_contract_is_bounded_by_merge_budget_streaming` (added in #6237) both build `TestConfig::medium("merge-budget-non-settling", ..)`. The network name is the node data directory under the temp dir, so when nextest runs the two at once, one run deletes the other's config files. Both then panic with `No such file or directory` at the config build in `testing_impl.rs`. This failed the Simulation job on #6264 (run 44213362154), where both tests failed in the same second.  ## Approach One network name per variant. No other test in `simulation_integration.rs` shares a literal network name; this collision came from the two tests sharing one helper.  ## Testing Both variants run together under nextest with `--features simulation_tests,testing` and `--test-threads 2`: 2 passed.  [AI-assisted - Claude]
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No issues found  **Rules checked:** git-workflow.md, code-style.md, testing.md **Files reviewed:** 1  No rule violations detected. The change is a test-only fix in `crates/core/tests/simulation_integration.rs`. It gives each variant of `assert_non_settling_contract_is_bounded` its own network name, so the two variants no longer share a node data directory. The commit subject is in conventional-commit form and under 72 characters. The change is one logical change, adds no banned APIs, and leaves no tests deleted or ignored.  <!-- warning-count: 0 -->  --- *Rule review against `.claude/rules/`. WARNING findings turn the `rule-review/warnings` status red.*

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

### Incident Patch 1: `6174c624` (2026-11-18)
**Commit Message**: feat(quic): the peer crash-breaker action for when UDP is removed, switched off (#6268)

**File**: `.claude/rules/transport.md` (modified, +8/-0)
```diff
@@ -3731,6 +3731,14 @@ Liveness ("alive" = the endpoint driver has not ENDED; it does not mean
     marker (quic-crash-breaker-legacy.json) and never changes whether QUIC
     runs. It tells what the switch loses (crash loops with no QUIC panic) and
     what it stops (kills read as crashes). The shadow goes with UDP (#6151).
+    With no UDP to fall back to (breaker::UDP_FALLBACK false, set by the
+    UDP-removal release; until then tests only, switched on in a
+    quic-panic-injection build by FREENET_TEST_BREAKER_NO_UDP_FALLBACK), a
+    peer trips at three again and its trip keeps QUIC on: a start delay of 1
+    minute doubling to 30 (Verdict::Backoff, waited out just before the
+    transport opens, cut short by a stop), the startup update check at once
+    (quic_crash_loop_update_now; the update claim still applies), and a
+    supervised peer exits on endpoint death like a gateway.
   → When the node drops its last handle, the availability is Released
     (final; the first final state stored wins, so a release and a
     driver return racing never overwrite each other) and the driver's
```

**File**: `crates/core/src/bin/commands/rollback.rs` (modified, +41/-0)
```diff
@@ -2701,6 +2701,47 @@ pub(crate) mod tests {
         assert!(read_probation_at(dir).is_none());
     }
 
+    /// A rollback that could not run for a transient reason (here the retained
+    /// known-good binary cannot be read) leaves the probation marker, so a
+    /// later crash retries it and succeeds once the cause is gone. Pinned
+    /// because the QUIC crash-loop backoff (#6151) must not clear the marker
+    /// meanwhile (`freenet.rs`'s `wait_for_healthy_window`): this is the case
+    /// a commit during the backoff's wait would have destroyed.
+    #[test]
+    fn a_rollback_that_could_not_run_is_retried_by_a_later_crash() {
+        let tmp = tempfile::tempdir().unwrap();
+        let dir = tmp.path();
+        let live = setup_probation(dir, "0.2.84", "0.2.83");
+        let known_good = known_good_path(dir);
+        let blob = std::fs::read(&known_good).unwrap();
+        // A directory where the blob should be: opening it works, reading fails.
+        std::fs::remove_file(&known_good).unwrap();
+        std::fs::create_dir(&known_good).unwrap();
+
+        for _ in 0..ROLLBACK_CRASH_THRESHOLD - 1 {
+            handle_post_stop_at(dir, "101", "0.2.84");
+        }
+        for attempt in 0..2 {
+            let PostStopOutcome::RollbackUnavailable { reason } =
+                handle_post_stop_at(dir, "101", "0.2.84")
+            else {
+                panic!("expected RollbackUnavailable at attempt {attempt}");
+            };
+            assert!(reason.contains("cannot read known-good"), "{reason}");
+            assert!(
+                read_probation_at(dir).is_some(),
+                "the marker must stay for a later crash to retry (attempt {attempt})"
+            );
+        }
+        std::fs::remove_dir(&known_good).unwrap();
+        std::fs::write(&known_good, &blob).unwrap();
+        assert!(matches!(
+            handle_post_stop_at(dir, "101", "0.2.84"),
+            PostStopOutcome::RolledBack { .. }
+        ));
+        assert_eq!(std::fs::read(&live).unwrap(), b"GOOD-BINARY");
+    }
+
     #[test]
     fn prepare_known_good_preserves_blob_and_label_for_genuine_chained_install() {
         // Genuine chained install (existing marker is for the running version,
```

**File**: `crates/core/src/bin/freenet.rs` (modified, +179/-20)
```diff
@@ -409,9 +409,13 @@ async fn run_network_node_with_signals(
     let commit_probation_task = {
         let version = build_info::VERSION.to_string();
         GlobalExecutor::spawn(async move {
-            tokio::time::sleep(std::time::Duration::from_secs(
-                commands::rollback::COMMIT_HEALTHY_UPTIME_SECS,
-            ))
+            // #6151: a start the QUIC crash-loop breaker backed off does not
+            // count the wait, with the transport closed, as healthy uptime:
+            // the window starts again once the transport can open.
+            wait_for_healthy_window(
+                std::time::Duration::from_secs(commands::rollback::COMMIT_HEALTHY_UPTIME_SECS),
+                freenet::wait_for_quic_transport_open,
+            )
             .await;
             // `spawn_blocking`, not a direct call: `commit_probation` does
             // synchronous filesystem work (`read_to_string`, `remove_file`) and
@@ -630,8 +634,13 @@ async fn run_network_node_with_signals(
                 "Startup update check skipped: {reason}. Run `freenet update` to update now."
             );
         }
-        let startup_jitter_secs =
-            freenet::config::GlobalRng::random_u64() % STARTUP_UPDATE_JITTER_MAX_SECS;
+        // #6151: a node the crash-loop breaker found in a QUIC crash loop,
+        // with no UDP to fall back to, checks within seconds: it is broken, and a
+        // fixed release is what ends the loop. The claim below still applies.
+        let startup_jitter_secs = startup_update_jitter_secs(
+            freenet::quic_crash_loop_update_now(),
+            freenet::config::GlobalRng::random_u64(),
+        );
         // `startup_check_ran` is true only if the claim, made after the
         // jitter, allowed the check.
         let (startup_check_ran, latest) = match startup_attempt {
@@ -1291,6 +1300,43 @@ fn gateway_quic_restarts(status: commands::auto_update::SupervisorStatus) -> Gat
     }
 }
 
+/// Sleep `window`, then, if `wait_for_open` had to wait for the transport to
+/// open (a QUIC crash-loop backoff, #6151), sleep a whole `window` again, until
+/// it has not. The update probation commits after this, so the backoff's wait
+/// with the transport closed never counts as healthy uptime.
+// No upper bound on purpose: if a backoff flag were ever left pending, this
+// keeps the rollback armed rather than committing a probation for a node whose
+// transport never opened, which is the failure the wait exists to prevent.
+async fn wait_for_healthy_window<Fut: std::future::Future<Output = bool>>(
+    window: std::time::Duration,
+    wait_for_open: impl Fn() -> Fut,
+) {
+    loop {
+        tokio::time::sleep(window).await;
+        if !wait_for_open().await {
+            break;
+        }
+    }
+}
+
+/// The startup update check's jitter when the QUIC crash-loop breaker found
+/// this start in a crash loop with no UDP to fall back to (#6151): short, so
+/// the check is still prompt, but a fleet that crashes together does not send
+/// its checks to GitHub at the same second (peers behind one NAT share its
+/// unauthenticated rate limit).
+const CRASH_LOOP_UPDATE_JITTER_MAX_SECS: u64 = 5;
+
+/// The startup update check's jitter: under [`CRASH_LOOP_UPDATE_JITTER_MAX_SECS`]
+/// when the QUIC crash-loop breaker found this start in a crash loop with no
+/// UDP to fall back to (#6151), otherwise `random` reduced to under [`STARTUP_UPDATE_JITTER_MAX_SECS`].
+fn startup_update_jitter_secs(crash_loop: bool, random: u64) -> u64 {
+    if crash_loop {
+        random % CRASH_LOOP_UPDATE_JITTER_MAX_SECS
+    } else {
+        random % STARTUP_UPDATE_JITTER_MAX_SECS
+    }
+}
+
 /// Whether a finished run (after [`finish_run`]) ended cleanly for the QUIC
 /// crash-loop breaker (#5940): an operator stop, which `finish_run` made `Ok`,
 /// or an auto-update exit. Every other ending leaves the marker armed.
@@ -2092,29 +2138,142 @@ mod tests {
         );
     }
 
-    /// #6151: while UDP exists, a peer's QUIC crash-loop breaker trips, and
-    /// the peer falls back to UDP, before the post-update crash-loop rollback
-    /// restores the previous release and pins this one as bad. Each run the
-    /// breaker counts ended in a crash the rollback also counts; the start
-    /// that trips runs with QUIC off, so it adds no QUIC crash. At that point
-    /// the rollback's count must still be short of its threshold. This holds
-    /// for a release whose crashes are all QUIC panics; the rollback also
-    /// counts unrelated crashes, which the breaker does not, so one of those
-    /// before the panics lets the rollback act first.
+    /// #6151: the startup update check skips its jitter only in a QUIC crash
+    /// loop with no UDP to fall back to, and the update task takes its jitter
+    /// from that decision.
     #[test]
-    fn peer_breaker_trips_before_the_crash_loop_rollback() {
-        let crashes_when_the_breaker_trips = freenet::PEER_SHORT_RUN
```

**File**: `crates/core/src/lib.rs` (modified, +4/-1)
```diff
@@ -36,12 +36,15 @@ pub use transport::connection_handler::QUIC_RESTORE_MIN_UPTIME;
 #[doc(hidden)]
 pub use transport::quic::breaker::{
     ENDPOINT_DOWN_EXITS_TO_TRIP, GATEWAY_QUIC_BREAKER_COOLDOWN, PEER_SHORT_RUNS_TO_TRIP_WITH_UDP,
+    UDP_FALLBACK as QUIC_BREAKER_UDP_FALLBACK,
+    short_runs_to_trip as quic_breaker_short_runs_to_trip,
 };
 pub use transport::quic::breaker::{
     STOP_NOTE_ENV_VAR as QUIC_BREAKER_STOP_NOTE_ENV_VAR,
     STOP_NOTE_FILE as QUIC_BREAKER_STOP_NOTE_FILE, enable_quic_crash_breaker,
-    quic_breaker_clean_exit, quic_breaker_signals_ready,
+    quic_breaker_clean_exit, quic_breaker_signals_ready, quic_crash_loop_update_now,
     record_deliberate_stop as record_quic_breaker_deliberate_stop,
+    wait_for_transport_open as wait_for_quic_transport_open,
 };
 pub use transport::quic::liveness::{
     enable_gateway_quic_restarts, note_gateway_supervisor_unverified,
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +11/-0)
```diff
@@ -1499,6 +1499,17 @@ impl P2pConnManager {
         notification_channel: EventLoopNotificationsReceiver,
         node_controller: Receiver<NodeEvent>,
     ) -> anyhow::Result<Infallible> {
+        // A peer in a QUIC crash loop with no UDP to fall back to waits here,
+        // before its transport opens (#6151, `breaker::Verdict::Backoff`).
+        // The update check is already running by now; a stop ends the wait.
+        // Nothing waits unless the binary's breaker decided a backoff.
+        if crate::transport::quic::breaker::wait_out_crash_loop_backoff(&op_manager.shutting_down)
+            .await
+        {
+            // Stopped during the wait: do not bind the socket for a node
+            // that is going away.
+            return Err(EventLoopExitReason::GracefulShutdown.into());
+        }
         let transport = open_udp_transport::<S>(
             self.key_pair.clone(),
             self.listening_ip,
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +7/-6)
```diff
@@ -599,10 +599,11 @@ pub(crate) async fn open_udp_transport<S: Socket>(
     );
     // A supervised gateway exits for its supervisor to restart it when that
     // restores QUIC (#5940): its endpoint died, or the crash-breaker
-    // cooldown that kept QUIC off for this run ended. Every other node keeps
-    // running over UDP.
+    // cooldown that kept QUIC off for this run ended. With no UDP to fall
+    // back to (#6151) a supervised peer exits for an endpoint death too.
+    // Every other node keeps running over UDP.
     let restart = gateway_quic_restart(
-        is_gateway,
+        super::quic::liveness::restarts_for_quic(is_gateway),
         super::quic::liveness::gateway_quic_restarts(is_gateway),
         super::quic::liveness::gateway_supervisor_unverified(),
         outbound.quic_availability(),
@@ -678,10 +679,10 @@ fn gateway_quic_restart(
     }
     if !enabled && unverified {
         tracing::warn!(
-            "This gateway runs under systemd, but its unit does not set FREENET_SUPERVISED=1, \
+            "This node runs under systemd, but its unit does not set FREENET_SUPERVISED=1, \
              so it does not restart itself to restore QUIC: if its QUIC endpoint dies or a \
-             crash-breaker cooldown keeps QUIC off, it keeps running over UDP until it is \
-             restarted. Set FREENET_SUPERVISED=1 in the unit if it restarts the node on exit \
+             crash-breaker cooldown keeps QUIC off, it keeps running until it is restarted, \
+             over UDP while UDP exists and with no transport once it is gone. Set FREENET_SUPERVISED=1 in the unit if it restarts the node on exit \
              code 42 (units written by `freenet service install` do)"
         );
     }
```

**File**: `crates/core/src/transport/quic/breaker.rs` (modified, +686/-31)
```diff
@@ -11,8 +11,10 @@
 //! on Windows, and a gateway on a unix platform with no boot identity
 //! (`platform::boot_id`: anything but Linux and macOS), count short runs
 //! that panicked in QUIC code ([`short_runs`]). A gateway on Linux or macOS
-//! asks how its last run ended, which the rest of this doc describes. Peers on unix used that second rule until
-//! #6151; it still runs on them as a shadow ([`legacy_shadow`]) that only
+//! asks how its last run ended, which the rest of this doc describes. With no
+//! UDP to fall back to ([`UDP_FALLBACK`] false) every node counts short runs,
+//! a gateway included, because only that rule can back off. Peers on unix used
+//! that second rule until #6151; it still runs on them as a shadow ([`legacy_shadow`]) that only
 //! telemetry reads, until UDP is removed.
 //!
 //! # Gateways
@@ -80,6 +82,42 @@
 //! what they cost: the `quic_breaker_start` event reports what it would have
 //! decided ([`StartReport`]).
 //!
+//! # Without UDP (#6151; off until UDP is removed)
+//!
+//! Turning QUIC off is a fallback only while UDP exists. [`UDP_FALLBACK`]
+//! says whether it does; the UDP-removal release sets it to `false`, and
+//! until then everything below runs only in tests. With no UDP:
+//!
+//! - a peer trips at three short runs again
+//!   ([`short_runs::short_runs_to_trip`]);
+//! - a trip keeps QUIC on, on a gateway as on a peer ([`Verdict::Backoff`];
+//!   QUIC off would leave a gateway with no transport for 15 minutes to 4
+//!   hours, and every unix gateway counts short runs for this, see
+//!   [`decides_by_short_runs`]): its transport opens
+//!   only after a delay, 1 minute doubling per further counted run up to 30
+//!   ([`backoff_delay`], waited out in [`wait_out_crash_loop_backoff`] just
+//!   before the transport opens, and cut short by a stop), the marker records
+//!   the step at once with no QUIC panic (so a stop or crash during the wait
+//!   ends the backoff), and a run that outlives the short-run limit clears it.
+//!   The update probation (`rollback::COMMIT_HEALTHY_UPTIME_SECS`) does not
+//!   run while the wait does ([`wait_for_transport_open`]), so a release that
+//!   crashes the moment QUIC opens is still rolled back;
+//! - the binary's startup update check runs after a jitter of under 5
+//!   seconds instead of its 0-60 s one ([`quic_crash_loop_update_now`]), through the same claim, so the
+//!   known-bad pin, the lockout, a release cooling down and the download
+//!   budget still apply, and the backoff spaces the checks to about one per
+//!   30 minutes;
+//! - an earlier release's QUIC-off trip is dropped with a WARN;
+//! - a supervised peer exits when its QUIC endpoint dies, as a gateway does
+//!   (`liveness::gateway_quic_restarts`), under the same endpoint-death rule.
+//!   On unix this is a change in today's behaviour for a gateway with no boot
+//!   identity: [`note_endpoint_down_exit`] now writes its marker again after the
+//!   short-run timer cleared it, where it used to find none and keep running.
+//!
+//! An unsupervised peer whose endpoint dies is not restarted: it keeps
+//! running, with no transport once UDP is gone. Whether it should exit
+//! instead is left to the UDP-removal release.
+//!
 //! # The marker
 //!
 //! [`MARKER_FILE`] in the node's data directory, written atomically:
@@ -202,6 +240,190 @@ mod short_runs;
 pub use short_runs::PEER_SHORT_RUNS_TO_TRIP_WITH_UDP;
 pub(crate) use short_runs::QuicCode;
 
+/// Whether UDP is still there to fall back to when the breaker trips (#6151).
+/// While it is, a trip keeps QUIC off for a cooldown and the node runs over
+/// UDP. The UDP-removal release (#5940 phase D) sets this to `false`: a
+/// peer's trip then keeps QUIC on and delays the start instead
+/// ([`Verdict::Backoff`]), runs the update check within seconds, and a supervised
+/// peer exits when its QUIC endpoint dies, as a gateway does; and a peer
+/// trips at [`short_runs::SHORT_RUNS_TO_TRIP`] again. Everything that reads
+/// it takes it as a parameter, so tests cover both values; production reads
+/// it through [`udp_fallback`].
+pub const UDP_FALLBACK: bool = true;
+
+/// [`UDP_FALLBACK`], or `false` in a test build of the binary whose
+/// environment sets `FREENET_TEST_BREAKER_NO_UDP_FALLBACK` (the
+/// `quic-panic-injection` feature, which cannot be built without debug
+/// assertions), so a real-process test can run the post-UDP path.
+pub(crate) fn udp_fallback() -> bool {
+    #[cfg(feature = "quic-panic-injection")]
+    if std::env::var_os("FREENET_TEST_BREAKER_NO_UDP_FALLBACK").is_some() {
+        return false;
+    }
+    UDP_FALLBACK
+}
+
+/// How many short runs in a row trip the crash-loop breaker for a node, with
+/// or without UDP to fall back to. Read by the binary's test of the order
+/// between the breaker and the post-update rollback.
+#[doc(hidden)]
+pub fn short_runs_to_trip(is_gateway: bool, udp_fallback: bool) -> u32 {
+    short_runs::short_runs_to_trip(
```

**File**: `crates/core/src/transport/quic/breaker/short_runs.rs` (modified, +400/-50)
```diff
@@ -179,19 +179,30 @@ pub(super) const SHORT_RUNS_TO_TRIP: u32 = 3;
 /// every crash (an out-of-memory kill, a SIGKILL, a crash elsewhere), while
 /// the breaker counts consecutive short runs that panicked in QUIC code, so
 /// one unrelated crash followed by two QUIC panics still lets the rollback
-/// act first. Goes back to
-/// [`SHORT_RUNS_TO_TRIP`] when UDP is removed, when there is no UDP to fall
-/// back to and a rollback is the better outcome.
+/// act first. Goes back to [`SHORT_RUNS_TO_TRIP`] when UDP is removed
+/// ([`super::UDP_FALLBACK`] false, [`short_runs_to_trip`]), when there is no
+/// UDP to fall back to and a rollback is the better outcome.
 pub const PEER_SHORT_RUNS_TO_TRIP_WITH_UDP: u32 = 2;
 
-/// How many short runs in a row trip the breaker for `role`.
-pub(super) const fn short_runs_to_trip(role: BreakerRole) -> u32 {
+/// How many short runs in a row trip the breaker for `role`, with or without
+/// UDP to fall back to ([`super::udp_fallback`]).
+pub(crate) const fn short_runs_to_trip(role: BreakerRole, udp_fallback: bool) -> u32 {
     match role {
-        BreakerRole::Peer => PEER_SHORT_RUNS_TO_TRIP_WITH_UDP,
-        BreakerRole::Gateway => SHORT_RUNS_TO_TRIP,
+        BreakerRole::Peer if udp_fallback => PEER_SHORT_RUNS_TO_TRIP_WITH_UDP,
+        BreakerRole::Peer | BreakerRole::Gateway => SHORT_RUNS_TO_TRIP,
     }
 }
 
+/// Whether a trip keeps QUIC off for a cooldown, or, with no UDP to fall back
+/// to (#6151), delays the start instead and keeps QUIC on
+/// ([`Verdict::Backoff`]): with UDP removed, QUIC off is no transport at all.
+/// Gateways too: a gateway with QUIC off for 15 minutes to 4 hours would have
+/// no transport, and its backoff is no longer than a peer's. The role does not
+/// matter here; it still sets how many short runs trip ([`short_runs_to_trip`]).
+const fn trips_into_backoff(_role: BreakerRole, udp_fallback: bool) -> bool {
+    !udp_fallback
+}
+
 /// How many times the timer tries to clear the count, [`SHORT_RUN`] apart. A
 /// scanner holding the file open makes a removal fail on Windows, and the
 /// failure only costs one count.
@@ -218,11 +229,29 @@ pub(super) fn decide(
     now_secs: u64,
     ignore_breaker: bool,
     role: BreakerRole,
+    udp_fallback: bool,
 ) -> Decision {
     let arm = |short_runs| Decision {
         verdict: Verdict::Arm,
         short_runs,
     };
+    let backoff = trips_into_backoff(role, udp_fallback);
+    // The backoff step the last run started at; a further counted run (or
+    // endpoint death) on a peer in a backoff goes one step further.
+    let previous_step = match previous {
+        Previous::Marker(Marker::ShortRuns { backoff_step, .. }) => *backoff_step,
+        Previous::Nothing | Previous::Unreadable | Previous::Marker(_) => 0,
+    };
+    let trip = |short_runs: u32| Decision {
+        verdict: if backoff {
+            Verdict::Backoff {
+                step: previous_step.saturating_add(1),
+            }
+        } else {
+            Verdict::Trip
+        },
+        short_runs,
+    };
     // A gateway's exit because its QUIC endpoint died is decided as on unix,
     // whatever the run's length, so the restarts per day stay bounded.
     if let Previous::Marker(Marker::ShortRuns {
@@ -240,12 +269,10 @@ pub(super) fn decide(
             role,
         ) {
             return match verdict {
-                Verdict::Trip if !ignore_breaker => Decision {
-                    verdict,
-                    short_runs: *short_runs,
-                },
+                Verdict::Trip if !ignore_breaker => trip(*short_runs),
                 Verdict::Arm
                 | Verdict::Trip
+                | Verdict::Backoff { .. }
                 | Verdict::Cool { .. }
                 | Verdict::RunUnarmed
                 | Verdict::Unreadable => arm(0),
@@ -260,19 +287,25 @@ pub(super) fn decide(
             ..
         }) if within(*started_at_secs, now_secs, SHORT_RUN_WINDOW) => {
             let short_runs = short_runs.saturating_add(1);
-            if short_runs >= short_runs_to_trip(role) && !ignore_breaker {
-                Decision {
-                    verdict: Verdict::Trip,
-                    short_runs,
-                }
+            let in_backoff = backoff && previous_step > 0;
+            if (in_backoff || short_runs >= short_runs_to_trip(role, udp_fallback))
+                && !ignore_breaker
+            {
+                trip(short_runs)
             } else {
                 arm(short_runs)
             }
         }
+        // With no UDP to fall back to, a peer does not keep QUIC off for an
+        // earlier trip (one from a release that still had UDP): it starts
+        // again as if nothing had happened, and `gate` logs it once.
         Previous::Marker(Marker::Tripped {
             tripped_at_secs,
             trips,
-        }) if !ignore_breaker && within(*tripped_at_secs, now_secs, role.cooldown(*trips)) => {
+        }) if !ignore_b
```

---

### Incident Patch 2: `b7ba2671` (2026-11-18)
**Commit Message**: fix(hosting): keep contract state inside --max-hosting-storage (#6285)

**File**: `.claude/rules/operations.md` (modified, +11/-6)
```diff
@@ -207,21 +207,26 @@ Rules for choosing the class at a send site:
                  drive_relay_* drivers, ResyncResponse apply, broadcast-path
                  summaries/deltas that propagate a real UPDATE. This is also
                  `Priority::DEFAULT`, so untagged callers fall here safely.
+                 EvictContract disk reclamation runs here too
+                 (reclaim_evicted_contract): it is what makes the hosting
+                 budget a disk bound, so the relayed writes that fill the disk
+                 must not be able to starve it.
 
   Background   → best-effort node-internal work that must yield to client/relay
                  traffic: the periodic interest-sync summarize
                  (summary_if_hosted_or_in_use), placement-migration caching,
-                 renewal, and EvictContract disk reclamation. NEVER tag a
-                 client- or peer-visible op Background.
+                 and renewal. NEVER tag a client- or peer-visible op Background,
+                 nor work that enforces a resource bound (EvictContract).
 
 When a shared helper is reached from BOTH a client and a relay path (e.g.
 put_contract, update_contract), thread a `priority` param through rather
 than hardcoding — decide the class at the driver that knows the origin.
 
-The loop's pop() applies a bounded anti-starvation floor
-(RELAY_STARVATION_FLOOR) so sustained ClientLocal load cannot indefinitely
-starve NetworkRelay/Background — but that is a backstop, not a license to
-mis-tag.
+The loop's pop() applies two bounded anti-starvation floors. RELAY_STARVATION_FLOOR
+stops sustained ClientLocal load from indefinitely starving NetworkRelay and
+Background. BACKGROUND_STARVATION_FLOOR stops sustained NetworkRelay load (the
+tier remote peers feed) from indefinitely starving Background. Both are
+backstops only: tag each send site with the class it belongs to.
 ```
 
 **Client `DelegateRequest`s and the delegate lane (#6144).** Once
```

**File**: `crates/core/src/contract/fair_queue.rs` (modified, +225/-9)
```diff
@@ -10,8 +10,9 @@
 //! Two layers of fairness:
 //!
 //! 1. **Across priority classes** ([`Priority`]) — events are bucketed into one
-//!    [`PriorityTier`] per class. [`FairEventQueue::pop`] drains `ClientLocal`
-//!    fully before `NetworkRelay`, which drains before `Background`. Admission
+//!    [`PriorityTier`] per class. [`FairEventQueue::pop`] serves `ClientLocal`
+//!    before `NetworkRelay`, and `NetworkRelay` before `Background`, with a
+//!    bounded anti-starvation floor for each lower tier. Admission
 //!    ([`FairEventQueue::try_push`]) reserves `CLIENT_LOCAL_RESERVE` slots that
 //!    only `ClientLocal` may use, and [`FairEventQueue::evict_background`] sheds
 //!    queued background work to make room for higher-priority events.
@@ -87,10 +88,12 @@ pub(super) const MAX_DRAIN_BATCH: usize = 256;
 #[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
 pub(crate) enum Priority {
     /// Best-effort, node-internal background work (summarize for interest-sync,
-    /// placement-migration caching, renewal, contract eviction). Shed FIRST
-    /// under pressure; never surfaces a client-facing error when dropped.
+    /// placement-migration caching, renewal). Shed FIRST under pressure; never
+    /// surfaces a client-facing error when dropped.
     Background,
-    /// Serving a remote peer's relayed operation. Normal precedence.
+    /// Serving a remote peer's relayed operation. Normal precedence. Also disk
+    /// reclamation of evicted contracts (`EvictContract`): the relayed writes
+    /// that fill the disk must not outrun the work that frees it.
     NetworkRelay,
     /// Originated by a WS/HTTP client connected to THIS node. Highest
     /// precedence; admitted into the reserved lane so it is never rejected
@@ -258,6 +261,13 @@ pub(super) struct FairEventQueue {
     /// non-empty lower tier so sustained client load cannot indefinitely starve
     /// remote relay / background execution (#4534 review).
     client_streak: usize,
+    /// Consecutive `pop()`s that served a higher tier while `Background` had
+    /// work waiting. Drives the `Background` anti-starvation floor (see `pop`):
+    /// once this reaches `BACKGROUND_STARVATION_FLOOR`, the next `pop` serves
+    /// one `Background` event, so sustained `NetworkRelay` load — the tier
+    /// remote peers feed — cannot indefinitely postpone interest-sync
+    /// summaries and the rest of the `Background` work.
+    background_passed_over: usize,
     /// Observability counters (#4917). Instance-scoped on purpose: a purely
     /// process-global counter would make every gauge assertion race other
     /// tests sharing the binary, which is the #4918 flake. [`Self::publish`]
@@ -362,13 +372,22 @@ const DEPTH_WARN_BANDS: [usize; 2] = [MAX_TOTAL_FAIR_QUEUE / 2, MAX_TOTAL_FAIR_Q
 /// `RELAY_STARVATION_FLOOR + 1` pops while still strongly favouring client work.
 pub(super) const RELAY_STARVATION_FLOOR: usize = 16;
 
+/// After this many consecutive pops that passed over waiting `Background` work
+/// (whichever higher tier they served), `pop()` serves one `Background` event
+/// regardless of pending `ClientLocal` / `NetworkRelay`. `RELAY_STARVATION_FLOOR`
+/// alone does not bound `Background` latency: it only fires under `ClientLocal`
+/// load and prefers `NetworkRelay`, so a `NetworkRelay` tier that never runs
+/// empty would otherwise starve `Background` forever.
+pub(super) const BACKGROUND_STARVATION_FLOOR: usize = 16;
+
 impl FairEventQueue {
     /// Create a new, empty fair event queue.
     pub(super) fn new() -> Self {
         Self {
             tiers: Default::default(),
             total_queued: 0,
             client_streak: 0,
+            background_passed_over: 0,
             counters: FairQueueCounters::default(),
         }
     }
@@ -587,18 +606,35 @@ impl FairEventQueue {
     /// relay/background latency while keeping the overwhelming majority of slots
     /// for client work.
     ///
+    /// That floor serves `NetworkRelay` ahead of `Background` and never fires
+    /// without `ClientLocal` load, so `Background` has a floor of its own: after
+    /// `BACKGROUND_STARVATION_FLOOR` consecutive pops that served a higher tier
+    /// *with `Background` work waiting*, one `Background` event is served.
+    /// Without it a `NetworkRelay` tier that never runs empty (a busy node, or a
+    /// remote peer that keeps one event queued) suspends `Background` work for
+    /// as long as it lasts.
+    ///
     /// Returns `None` if all tiers are empty.
     pub(super) fn pop(&mut self) -> Option<(EventId, ContractHandlerEvent)> {
         let client_nonempty = self.tiers[Priority::ClientLocal as usize].queued > 0;
-        let lower_nonempty = self.tiers[Priority::NetworkRelay as usize].queued > 0
-            || self.tiers[Priority::Background as usize].queued > 0;
+        let relay_nonempty = self.tiers[Priority::NetworkRelay as usize].queued > 0;
+        let background_nonempty = se
```

**File**: `crates/core/src/operations.rs` (modified, +26/-3)
```diff
@@ -764,14 +764,19 @@ pub(crate) fn reclaim_evicted_contract(
     // safe. See `crate::ring::applied_payloads`.
     op_manager.ring.applied_payloads.reset(&key);
 
-    // Disk reclamation after hosting-cache eviction is best-effort GC —
-    // background-tier so it yields the contract loop to client/relay work (#4534).
+    // Disk reclamation after hosting-cache eviction is what makes the hosting
+    // budget a real disk bound, so it is NOT background-tier: `Background`
+    // yields to `NetworkRelay`, the tier remote peers feed, and gets only its
+    // anti-starvation floor share while that tier stays busy — a peer could
+    // hold reclamation back for as long as it kept sending. At relay precedence
+    // it still yields the contract loop to client work (#4534) and takes its
+    // turn among the relayed writes that caused the eviction.
     op_manager.notify_contract_handler_fire_and_forget_prioritized(
         crate::contract::ContractHandlerEvent::EvictContract {
             key,
             expected_generation,
         },
-        crate::contract::Priority::Background,
+        crate::contract::Priority::NetworkRelay,
     );
 }
 
@@ -1610,6 +1615,24 @@ mod reclaim_retraction_pin_tests {
         );
     }
 
+    /// EvictContract is what makes the hosting budget a disk bound, so it must
+    /// not be sheddable `Background` work that relayed writes (the tier remote
+    /// peers feed) can postpone (ANT-2026-YTU5DE0O).
+    #[test]
+    fn evict_contract_is_not_sent_at_background_priority() {
+        let src = include_str!("operations.rs");
+        let needle = ["fn ", "reclaim_evicted_contract("].concat();
+        let code = extract_fn_code(src, &needle);
+        assert!(
+            code.contains(&["Priority::Network", "Relay"].concat()),
+            "`reclaim_evicted_contract` must send EvictContract at NetworkRelay priority"
+        );
+        assert!(
+            !code.contains(&["Priority::Back", "ground"].concat()),
+            "EvictContract enforces a resource bound and must never be Background"
+        );
+    }
+
     /// The emission must stay INSIDE the guard. The helper's protection is the
     /// `on_contract_unhosted_unless_rehosted` return value; a refactor that
     /// inlined `try_notify_node_event` at the call site — or emitted a retraction
```

**File**: `crates/core/src/operations/get/op_ctx_task.rs` (modified, +55/-2)
```diff
@@ -3483,12 +3483,23 @@ async fn check_local_with_interest_gate(
             // Peers with only stale LRU cache (no active interest) defer to
             // the network but keep the local value as fallback.
             if !op_manager.interest_manager.has_local_interest(&key) {
-                // Stale cache only — defer to network, keep as fallback.
+                // Stale cache only — defer to network, keep as fallback, but
+                // only while this node still hosts the contract or has it in use (the
+                // same rule as `Ring::may_merge_relayed_update`: such a copy
+                // still receives updates). An evicted
+                // copy awaiting reclamation is not in the update mesh and no
+                // longer receives updates, so its bytes are frozen: serving
+                // them would answer a read from a stale copy (hosting
+                // invariant 1).
                 tracing::debug!(
                     %instance_id,
                     "GET relay: stale cache (no local interest), will forward"
                 );
-                (None, Some((key, state, contract)))
+                if op_manager.ring.may_merge_relayed_update(&key) {
+                    (None, Some((key, state, contract)))
+                } else {
+                    (None, None)
+                }
             } else {
                 // Actively hosting with interest — serve immediately.
                 (Some((key, state, contract)), None)
@@ -12925,3 +12936,45 @@ mod candidate_log_call_site_tests {
         );
     }
 }
+
+#[cfg(test)]
+mod evicted_copy_fallback_tests {
+    use super::*;
+    use crate::operations::route_attempt::driver_test_support::op_manager_with_peers_and_store;
+
+    /// A relay's routing-exhausted fallback must not be an evicted copy that is
+    /// awaiting reclamation: it no longer receives updates, so serving it
+    /// answers a read from a frozen copy. A hosted contract keeps being served.
+    #[tokio::test(flavor = "current_thread", start_paused = true)]
+    async fn the_stale_fallback_is_not_an_evicted_unhosted_copy() {
+        let (op_manager, _rx, _peers, _guards, store) =
+            op_manager_with_peers_and_store("get-fallback-evicted", 1).await;
+        let key = ContractKey::from_id_and_code(
+            ContractInstanceId::new([0x5a; 32]),
+            freenet_stdlib::prelude::CodeHash::new([0x5b; 32]),
+        );
+        *store.lock() = Some((key, WrappedState::new(vec![1; 8])));
+        assert!(!op_manager.ring.is_hosting_contract(&key));
+        assert!(!op_manager.interest_manager.has_local_interest(&key));
+
+        let (served, fallback) = check_local_with_interest_gate(&op_manager, key.id(), false).await;
+        assert!(served.is_none());
+        assert!(
+            fallback.is_none(),
+            "an evicted, unreclaimed copy must not be offered as the stale fallback"
+        );
+
+        op_manager.ring.host_contract(
+            key,
+            8,
+            crate::ring::AccessType::Get,
+            crate::ring::HostingCause::Other,
+        );
+        assert!(op_manager.ring.is_hosting_contract(&key));
+        let (served, fallback) = check_local_with_interest_gate(&op_manager, key.id(), false).await;
+        assert!(
+            served.is_some() || fallback.is_some(),
+            "a hosted contract's local copy is served or kept as the fallback"
+        );
+    }
+}
```

**File**: `crates/core/src/operations/put/op_ctx_task.rs` (modified, +6/-1)
```diff
@@ -5000,7 +5000,12 @@ async fn drive_relay_probe_reconcile(
     // see `drive_relay_put`.
     let htl = htl.min(op_manager.ring.max_hops_to_live);
 
-    if op_manager.ring.is_receiving_updates(&key) {
+    // A probe reconcile merges into the local copy like a relayed UPDATE, so
+    // it follows the same rule: an evicted copy awaiting reclamation is not
+    // merged into (`Ring::may_merge_relayed_update`), the reconcile is routed
+    // on instead.
+    if op_manager.ring.is_receiving_updates(&key) && op_manager.ring.may_merge_relayed_update(&key)
+    {
         // Merge via the same path an UPDATE uses; the contract executor
         // fans the change out to the rest of the subscriber mesh
         // automatically on a real state change (`BroadcastStateChange`,
```

**File**: `crates/core/src/operations/update/op_ctx_task.rs` (modified, +191/-3)
```diff
@@ -1097,6 +1097,29 @@ async fn run_relay_broadcast_to(
     }
 }
 
+/// Broadcasts skipped because this node does not host the contract
+/// (`Ring::may_merge_relayed_update`), since process start.
+static UNHOSTED_BROADCAST_SKIPS: std::sync::atomic::AtomicU64 =
+    std::sync::atomic::AtomicU64::new(0);
+
+/// Count a skipped broadcast for an unhosted contract. The count is logged at
+/// `info` on each power of two, which release builds keep (a `debug` line is
+/// compiled out), so a sender that keeps broadcasting to a node that evicted
+/// the contract is visible. No resync is sent: the sender's belief about this
+/// node heals through the periodic interest sync.
+fn record_unhosted_broadcast_skip(incoming_tx: &Transaction, key: &ContractKey, kind: &str) {
+    let total = UNHOSTED_BROADCAST_SKIPS.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
+    if total.is_power_of_two() {
+        tracing::info!(
+            tx = %incoming_tx,
+            contract = %key,
+            kind,
+            total_skipped = total,
+            "UPDATE relay: broadcast skipped, contract is not hosted here"
+        );
+    }
+}
+
 /// Inner driver for `RequestUpdate`. Mirrors `update.rs:347-594`.
 ///
 /// Decision tree:
@@ -1144,7 +1167,7 @@ async fn drive_relay_request_update(
         _ => None,
     };
 
-    if state_before.is_some() {
+    if state_before.is_some() && op_manager.ring.may_merge_relayed_update(&key) {
         // ── Local apply path ──────────────────────────────────────────────
         let hash_before = state_before.as_ref().map(state_hash_full);
 
@@ -1971,6 +1994,11 @@ async fn drive_relay_broadcast_to(
 ) -> Result<(), OpError> {
     let self_location = op_manager.ring.connection_manager.own_location();
 
+    if !op_manager.ring.may_merge_relayed_update(&key) {
+        record_unhosted_broadcast_skip(&incoming_tx, &key, "BroadcastTo");
+        return Ok(());
+    }
+
     // ── Step 1: update sender's cached summary ────────────────────────────
     // Empty bytes mean the sender could not summarize itself, NOT that its
     // summary is empty — see `seed_sender_summary_from_broadcast`.
@@ -2829,6 +2857,26 @@ async fn drive_relay_request_update_streaming(
         value,
     } = payload;
 
+    if !op_manager.ring.may_merge_relayed_update(&key) {
+        tracing::debug!(
+            tx = %incoming_tx,
+            %key,
+            "UPDATE relay (driver streaming): RequestUpdateStreaming not merged, \
+             contract is not hosted here; forwarding"
+        );
+        // The non-streaming driver sees the gate refuse as well and takes its
+        // forward path.
+        return drive_relay_request_update(
+            op_manager,
+            incoming_tx,
+            key,
+            related_contracts,
+            value,
+            sender_addr,
+        )
+        .await;
+    }
+
     // Step 4: apply update. BroadcastStateChange propagates automatically.
     let UpdateExecution {
         value: updated_value,
@@ -3012,6 +3060,10 @@ async fn apply_streaming_broadcast(
     sender_addr: SocketAddr,
     covered: crate::ring::broadcast_coverage::CoveredPeers,
 ) -> Result<(), OpError> {
+    if !op_manager.ring.may_merge_relayed_update(&key) {
+        record_unhosted_broadcast_skip(&incoming_tx, &key, "BroadcastToStreaming");
+        return Ok(());
+    }
     let mut receiver_terminal = op_manager
         .payload_mix
         .receiver_terminal_guard(false, state_bytes.len());
@@ -4482,6 +4534,7 @@ mod tests {
             ContractInstanceId::new([7u8; 32]),
             CodeHash::new([8u8; 32]),
         );
+        host_for_test(&op_manager, key);
         let sender_addr: SocketAddr = "127.0.0.1:12100".parse().unwrap();
 
         // First broadcast delta → dropped queue-full → MUST emit a ResyncRequest.
@@ -4558,6 +4611,7 @@ mod tests {
             ContractInstanceId::new([9u8; 32]),
             CodeHash::new([10u8; 32]),
         );
+        host_for_test(&op_manager, key);
         let sender_addr: SocketAddr = "127.0.0.1:12200".parse().unwrap();
 
         // First streaming full-state → dropped queue-full → MUST emit a ResyncRequest.
@@ -4637,6 +4691,7 @@ mod tests {
         for key in [inline_key, stream_key] {
             host_for_test(&op_manager, key);
         }
+        let skips_before = UNHOSTED_BROADCAST_SKIPS.load(std::sync::atomic::Ordering::Relaxed);
 
         for _ in 0..2 {
             let _result: Result<(), OpError> = drive_relay_broadcast_to(
@@ -4693,8 +4748,16 @@ mod tests {
             op_manager
                 .payload_mix
                 .propagation_event_for_test(Ev::RxDedup),
-            3,
-            "telemetry still counts every received skip"
+            2,
+            "a broadcast for a contract this node does not host is skipped before the \
+             dedup cache, so only the two hosted keys' repeats are counted here"
+        );
+        // Every skip is still counted somewhere: the two unhosted b
```

**File**: `crates/core/src/ring.rs` (modified, +70/-1)
```diff
@@ -5028,10 +5028,31 @@ impl Ring {
         self.hosting_manager.committed_state_size(contract)
     }
 
+    /// Whether a relayed UPDATE (or probe reconcile) may be merged into, and
+    /// persisted for, `key` here.
+    ///
+    /// A contract that is neither in the hosting cache nor in use (no
+    /// subscriber of any kind) is not hosted: an eviction has queued its bytes
+    /// for reclamation, or this node only still has them on disk. Merging a
+    /// relayed write into such a copy moves its state generation without
+    /// re-hosting it, and a remote peer decides when that happens, so the
+    /// bytes would stay on disk outside every budget (hosting invariants 1
+    /// and 3: a copy is served only while fresh in the update mesh, and the
+    /// demand ranking, not an UPDATE, decides what stays). Callers skip the
+    /// merge and, for a request, forward it toward the hosts instead.
+    pub(crate) fn may_merge_relayed_update(&self, key: &ContractKey) -> bool {
+        self.is_hosting_contract(key) || self.contract_in_use(key)
+    }
+
     pub(crate) fn commit_state_write(&self, contract: &ContractKey, state_size: usize) {
         let new_gen = self.hosting_manager.bump_state_generation(contract);
+        // Hosting-budget accounting: charge the hosted entry the size that was
+        // just stored. `host_contract` records a size on PUT/GET only, and the
+        // UPDATE paths must not call it (it stamps recency), so without this a
+        // contract that grows through UPDATE stays charged its PUT-time size
+        // and the byte-budget eviction never sees the growth.
         self.hosting_manager
-            .refresh_cache_generation(contract, new_gen);
+            .refresh_cache_after_write(contract, new_gen, state_size as u64);
         // Disk-usage accounting (#4683): maintain the aggregate on-disk state
         // total by signed delta (`new − previous_for_key`). Read by the
         // eviction floor and the admission gates since #4702. No-op until the
@@ -11322,6 +11343,54 @@ mod cost_pressure_seam_tests {
         );
     }
 
+    /// A state write must re-charge an already-hosted contract to the hosting
+    /// budget. Goes through the production funnel (`Ring::commit_state_write`,
+    /// the post-write step of every executor PUT/UPDATE chokepoint) and the
+    /// production sweep entry (`Ring::sweep_expired_hosting`). Without the
+    /// size refresh a contract hosted at 1 byte and grown by an UPDATE stays
+    /// charged 1 byte, the cache never goes over budget, and the sweep evicts
+    /// nothing however much state the UPDATEs stored.
+    #[tokio::test]
+    async fn commit_state_write_charges_update_growth_to_the_hosting_budget() {
+        let op_manager = attached_op_manager("commit-state-write-size").await;
+        let hosting = &op_manager.ring.hosting_manager;
+        let budget = hosting.hosting_cache_stats().budget_bytes;
+        let keys: Vec<_> = (0..3).map(wiring_key).collect();
+        for key in &keys {
+            hosting.record_contract_access(
+                *key,
+                1,
+                crate::ring::hosting::AccessType::Put,
+                crate::ring::hosting::HostingCause::Other,
+            );
+        }
+        assert_eq!(hosting.hosting_cache_stats().current_bytes, 3);
+
+        // One UPDATE per contract, each leaving a state of most of the budget.
+        let grown = budget / 2 + 1;
+        for key in &keys {
+            op_manager.ring.commit_state_write(key, grown as usize);
+        }
+        let stats = hosting.hosting_cache_stats();
+        assert_eq!(
+            stats.current_bytes,
+            3 * grown,
+            "every state write must charge the stored size to the hosting cache"
+        );
+        // Byte accounting only: the write itself evicts nothing.
+        assert_eq!(stats.contract_count, 3);
+
+        let swept = op_manager.ring.sweep_expired_hosting();
+        assert_eq!(
+            swept.expired.len(),
+            2,
+            "the sweep must shed the contracts that UPDATE grew over budget"
+        );
+        let stats = hosting.hosting_cache_stats();
+        assert_eq!(stats.current_bytes, grown);
+        assert!(stats.current_bytes <= stats.budget_bytes);
+    }
+
     fn wiring_peer() -> crate::ring::PeerKey {
         crate::ring::PeerKey::from(crate::transport::TransportKeypair::new().public().clone())
     }
```

**File**: `crates/core/src/ring/hosting.rs` (modified, +102/-0)
```diff
@@ -947,12 +947,42 @@ impl HostingManager {
     /// permanently skip reclamation after an UPDATE-then-evict. No-op when
     /// the entry is not currently cached. See
     /// `HostingCache::refresh_entry_generation`.
+    #[cfg(test)]
     pub(crate) fn refresh_cache_generation(&self, key: &ContractKey, new_gen: u64) {
         self.hosting_cache
             .write()
             .refresh_entry_generation(key, new_gen);
     }
 
+    /// Refresh both the write generation and the size of `key`'s hosting-cache
+    /// entry under ONE write lock, so a concurrent reader never sees the new
+    /// generation with the old size. See `refresh_cache_generation` and
+    /// `refresh_cache_size`.
+    pub(crate) fn refresh_cache_after_write(
+        &self,
+        key: &ContractKey,
+        new_gen: u64,
+        size_bytes: u64,
+    ) {
+        let mut cache = self.hosting_cache.write();
+        cache.refresh_entry_generation(key, new_gen);
+        cache.refresh_entry_size(key, size_bytes);
+    }
+
+    /// Update the hosting-cache size of `key` to the state size just written.
+    /// Paired with `refresh_cache_generation` at every state-write chokepoint
+    /// so a contract that grows (or shrinks) through UPDATE is charged to the
+    /// hosting budget what is actually stored, not its PUT/GET-time size.
+    /// Byte accounting only: no recency stamp, and nothing is evicted here.
+    /// No-op when the entry is not currently cached. See
+    /// `HostingCache::refresh_entry_size`.
+    #[cfg(test)]
+    pub(crate) fn refresh_cache_size(&self, key: &ContractKey, size_bytes: u64) {
+        self.hosting_cache
+            .write()
+            .refresh_entry_size(key, size_bytes);
+    }
+
     /// Set the storage reference for persisting hosting metadata.
     /// Must be called after executor creation.
     pub fn set_storage(&self, storage: crate::contract::storages::Storage) {
@@ -7013,6 +7043,78 @@ mod tests {
         );
     }
 
+    /// Without `refresh_cache_size`, a hosted contract whose state grows
+    /// through UPDATE stays charged the size `record_contract_access` was
+    /// given at PUT/GET time (the UPDATE paths must not call it: it stamps
+    /// recency). `current_bytes` then under-counts what is stored, the cache
+    /// never goes over budget, and the sweep that enforces the hosting budget
+    /// evicts nothing while UPDATEs fill the disk.
+    ///
+    /// The fix is to call `refresh_cache_size` paired with
+    /// `refresh_cache_generation` at every state-write chokepoint. This test
+    /// asserts the refresh re-charges the entries and that the next sweep
+    /// then sheds the overage.
+    #[test]
+    fn test_refresh_cache_size_charges_update_growth_to_budget() {
+        let manager = HostingManager::new(DEFAULT_HOSTING_BUDGET_BYTES);
+        {
+            let mut cache = manager.hosting_cache.write();
+            *cache = cache::HostingCache::new(
+                1000,
+                std::sync::Arc::new(crate::util::time_source::InstantTimeSrc::new()),
+            );
+        }
+
+        // Three contracts hosted with 1-byte states: far under budget.
+        let keys = [
+            make_contract_key(1),
+            make_contract_key(2),
+            make_contract_key(3),
+        ];
+        for key in keys {
+            manager.record_contract_access(key, 1, AccessType::Put, HostingCause::Other);
+        }
+        assert_eq!(manager.hosting_cache_stats().current_bytes, 3);
+
+        // Simulate one UPDATE per contract that grows its state to 600
+        // bytes. The refresh is byte accounting only: it evicts nothing.
+        for key in &keys {
+            manager.refresh_cache_size(key, 600);
+        }
+        let stats = manager.hosting_cache_stats();
+        assert_eq!(stats.current_bytes, 1800);
+        assert_eq!(stats.contract_count, 3);
+
+        // The sweep now sees the cache over budget and sheds down to it.
+        // Without the refresh `current_bytes` would still read 3 and nothing
+        // would be evicted.
+        let swept = manager.sweep_expired_hosting();
+        assert_eq!(
+            swept.expired.len(),
+            2,
+            "sweep must evict the contracts that UPDATE grew over budget"
+        );
+        let stats = manager.hosting_cache_stats();
+        assert_eq!(stats.current_bytes, 600);
+        assert_eq!(stats.contract_count, 1);
+    }
+
+    /// `refresh_cache_size` is a no-op when the entry is not in the cache:
+    /// a state write for a contract this node does not host must not insert
+    /// a phantom entry or charge bytes to the hosting budget.
+    #[test]
+    fn test_refresh_cache_size_is_noop_when_entry_absent() {
+        let manager = HostingManager::new(DEFAULT_HOSTING_BUDGET_BYTES);
+        let key = make_contract_key(99);
+
+        manager.refresh_cache_size(&key, 4096);
+        assert!(
+            !manager.hosting_cache.read().contains(&key),
+            "refresh mu
```

---

### Incident Patch 3: `fdc53266` (2026-11-18)
**Commit Message**: fix(client-api): bound client subscription leaks, id collisions and the completed set (#6282)

**File**: `crates/core/src/client_events.rs` (modified, +628/-89)
```diff
@@ -63,14 +63,37 @@ use crate::{config::GlobalExecutor, contract::StoreResponse};
 
 use crate::contract::{contains_debug_sections, debug_sections};
 
-/// Helper function to register a subscription listener for GET/PUT operations with auto-subscribe
+/// Test-only record of the `subscribe` flag a client's GET or PUT was started
+/// with, so tests can tell a request started without its subscription from one
+/// that was not changed. Keyed by client id, which is unique per test.
+#[cfg(test)]
+static STARTED_WITH_SUBSCRIBE: std::sync::Mutex<Vec<(ClientId, bool)>> =
+    std::sync::Mutex::new(Vec::new());
+
+/// Helper function to register a subscription listener for GET/PUT operations with auto-subscribe.
+///
+/// Returns `Ok(false)` when the client's `Disconnect` was handled before or
+/// during the registration: nothing stays registered, and the caller must not
+/// start a subscription for it.
 async fn register_subscription_listener(
-    op_manager: &OpManager,
+    op_manager: &Arc<OpManager>,
     instance_id: ContractInstanceId,
     client_id: ClientId,
     subscription_listener: mpsc::Sender<HostResult>,
     operation_type: &str,
-) -> Result<(), Error> {
+) -> Result<bool, Error> {
+    // The client's `Disconnect` may already have been handled: requests run as
+    // independent tasks, so one can still be in flight after it. Nothing would
+    // ever clean up a subscription registered now (ANT-2026-VCHSBVO6).
+    if op_manager.ring.is_client_disconnected(client_id) {
+        tracing::debug!(
+            client_id = %client_id,
+            contract = %instance_id,
+            operation = operation_type,
+            "Client already disconnected, not registering subscription listener"
+        );
+        return Ok(false);
+    }
     tracing::debug!(
         client_id = %client_id,
         contract = %instance_id,
@@ -115,7 +138,7 @@ async fn register_subscription_listener(
                     op_manager.ring.register_events(Either::Left(event)).await;
                 }
             }
-            Ok(())
+            Ok(!sweep_if_client_disconnected(op_manager, client_id).await)
         }
         // #4681: registration was rejected (e.g. subscriber-limit reached).
         // Forward the underlying RequestError so the client sees the real
@@ -199,6 +222,90 @@ pub(crate) fn should_serve_local_copy(
     local_satisfies_request && (connection_count == 0 || is_subscribed || has_local_interest)
 }
 
+/// Remove everything a client's `Disconnect` is responsible for: delegate
+/// notification routing, ring and interest subscriptions, upstream
+/// subscriptions nobody needs any more, and the contract handler's
+/// per-client state. Idempotent, so it is also run again when a registration
+/// lands after the client's `Disconnect` (ANT-2026-VCHSBVO6).
+async fn sweep_disconnected_client(op_manager: &Arc<OpManager>, client_id: ClientId) {
+    // Drop any delegate-notification routing registrations for this
+    // client (#3275).
+    crate::contract::delegate_app_registry::remove_client(client_id);
+
+    let result = op_manager
+        .ring
+        .remove_client_from_all_subscriptions(client_id);
+    for contract in &result.affected_contracts {
+        op_manager.interest_manager.remove_local_client(contract);
+    }
+    if !result.affected_contracts.is_empty() {
+        tracing::debug!(
+            %client_id,
+            subscriptions_cleaned = result.affected_contracts.len(),
+            "Cleaned up client subscriptions and interest tracking"
+        );
+    }
+
+    // Send Unsubscribe upstream for contracts with no remaining interest.
+    // FLIP (keystone P6, #4642): the collapse decision is driven by the
+    // reconcile controller's strict-farther interest gate
+    // (`reconcile_wants_collapse` = `!contract_in_use`), replacing the
+    // legacy ANY-downstream `should_unsubscribe_upstream`. The teardown
+    // still targets the STORED upstream (narrow flip keeps the flag).
+    for contract in &result.affected_contracts {
+        if op_manager.reconcile_wants_collapse(
+            contract,
+            crate::node::network_status::ReconcileShadowSite::Collapse,
+        ) {
+            let op_mgr = op_manager.clone();
+            let contract = *contract;
+            GlobalExecutor::spawn(async move {
+                op_mgr.send_unsubscribe_upstream(&contract).await;
+            });
+        }
+    }
+
+    // Notify contract handler to clean up shared_summaries and
+    // shared_notifications for this client (fire-and-forget — no response needed).
+    if let Err(err) = op_manager
+        .ch_outbound
+        .send_to_handler_fire_and_forget(ContractHandlerEvent::ClientDisconnect { client_id })
+    {
+        tracing::warn!(
+            %client_id,
+            error = %err,
+            "Failed to notify contract handler of client disconnect"
+        );
+    }
+
+    // Drop the session actor's registrations for this client. It only forgets
+
```

**File**: `crates/core/src/client_events/session_actor.rs` (modified, +8/-5)
```diff
@@ -422,18 +422,21 @@ impl<T: TimeSource> SessionActor<T> {
 
     /// Clean up client from all transaction mappings on disconnect
     fn cleanup_client_transactions(&mut self, client_id: ClientId) {
-        // Remove client from all transaction mappings
+        // Remove the client from every transaction, remembering the
+        // transactions nobody else waits for.
+        let mut emptied: HashSet<Transaction> = HashSet::new();
         self.client_transactions.retain(|tx, clients| {
             clients.remove(&client_id);
-            // If no clients left for this transaction, also clean up RequestId mappings
             if clients.is_empty() {
-                self.client_request_ids.retain(|(t, _), _| t != tx);
+                emptied.insert(*tx);
             }
             !clients.is_empty()
         });
 
-        // Clean up RequestId mappings for this client across all transactions
-        self.client_request_ids.retain(|(_, c), _| *c != client_id);
+        // One pass over the RequestId mappings: this client's, and those of
+        // transactions that no client waits for any more.
+        self.client_request_ids
+            .retain(|(t, c), _| *c != client_id && !emptied.contains(t));
     }
 
     /// Prune stale pending results based on TTL and enforce capacity limits.
```

**File**: `crates/core/src/client_events/types.rs` (modified, +98/-16)
```diff
@@ -19,20 +19,19 @@ pub type HostResult = Result<HostResponse, ClientError>;
 #[repr(transparent)]
 pub struct RequestId(u64);
 
-const COUNTER_BLOCK: u64 = 1_000_000;
+use crate::util::id_block::IdBlock;
 
 thread_local! {
-    static REQUEST_ID_COUNTER: Cell<u64> = {
-        let idx = crate::config::GlobalRng::thread_index();
-        Cell::new(1 + idx * COUNTER_BLOCK)
-    };
+    static REQUEST_ID_COUNTER: Cell<IdBlock> =
+        Cell::new(IdBlock::for_thread(crate::config::GlobalRng::thread_index(), 1));
 }
 
 impl RequestId {
     pub fn new() -> Self {
         Self(REQUEST_ID_COUNTER.with(|c| {
-            let v = c.get();
-            c.set(v + 1);
+            let mut block = c.get();
+            let v = block.take();
+            c.set(block);
             v
         }))
     }
@@ -41,7 +40,7 @@ impl RequestId {
     /// Thread-local, so safe for parallel test execution.
     pub fn reset_counter() {
         let idx = crate::config::GlobalRng::thread_index();
-        REQUEST_ID_COUNTER.with(|c| c.set(1 + idx * COUNTER_BLOCK));
+        REQUEST_ID_COUNTER.with(|c| c.set(IdBlock::for_thread(idx, 1)));
     }
 }
 
@@ -74,28 +73,27 @@ impl From<ClientId> for usize {
 }
 
 thread_local! {
-    static CLIENT_ID_COUNTER: Cell<usize> = {
-        let idx = crate::config::GlobalRng::thread_index();
-        Cell::new(1 + (idx as usize) * (COUNTER_BLOCK as usize))
-    };
+    static CLIENT_ID_COUNTER: Cell<IdBlock> =
+        Cell::new(IdBlock::for_thread(crate::config::GlobalRng::thread_index(), 1));
 }
 
 impl ClientId {
     pub const FIRST: Self = ClientId(0);
 
     pub fn next() -> Self {
         ClientId(CLIENT_ID_COUNTER.with(|c| {
-            let v = c.get();
-            c.set(v + 1);
-            v
+            let mut block = c.get();
+            let v = block.take();
+            c.set(block);
+            v as usize
         }))
     }
 
     /// Reset the client ID counter to initial state for this thread.
     /// Thread-local, so safe for parallel test execution.
     pub fn reset_counter() {
         let idx = crate::config::GlobalRng::thread_index();
-        CLIENT_ID_COUNTER.with(|c| c.set(1 + (idx as usize) * (COUNTER_BLOCK as usize)));
+        CLIENT_ID_COUNTER.with(|c| c.set(IdBlock::for_thread(idx, 1)));
     }
 }
 
@@ -396,3 +394,87 @@ mod connection_scope_tests {
         );
     }
 }
+
+/// ANT-2026-8LFV3MG8: a thread's id block used to run into the next thread's
+/// block after 1M allocations, so two clients (or requests) could be handed
+/// the same id and replies were cross-delivered.
+#[cfg(test)]
+mod id_block_overflow_tests {
+    use super::*;
+    use std::collections::HashSet;
+
+    const BLOCK: usize = crate::util::id_block::ID_BLOCK as usize;
+
+    /// Allocate `n` client ids on a fresh thread pinned to index `idx`.
+    fn client_ids_on_thread(idx: u64, n: usize) -> Vec<usize> {
+        std::thread::spawn(move || {
+            crate::config::GlobalRng::pin_thread_index_for_test(idx);
+            (0..n).map(|_| ClientId::next().0).collect()
+        })
+        .join()
+        .unwrap()
+    }
+
+    fn request_ids_on_thread(idx: u64, n: usize) -> Vec<u64> {
+        std::thread::spawn(move || {
+            crate::config::GlobalRng::pin_thread_index_for_test(idx);
+            (0..n).map(|_| RequestId::new().0).collect()
+        })
+        .join()
+        .unwrap()
+    }
+
+    #[test]
+    fn client_ids_stay_unique_after_a_thread_exhausts_its_block() {
+        // Thread 3000007000 allocates past the end of its block; thread 3000007001's first
+        // ids must not be among them.
+        let overflowing = client_ids_on_thread(3000007000, BLOCK + 10);
+        let neighbour = client_ids_on_thread(3000007001, 10);
+        let seen: HashSet<_> = overflowing.iter().copied().collect();
+        assert_eq!(seen.len(), overflowing.len(), "ids repeated on one thread");
+        for id in neighbour {
+            assert!(!seen.contains(&id), "client id {id} handed out twice");
+        }
+    }
+
+    #[test]
+    fn request_ids_stay_unique_after_a_thread_exhausts_its_block() {
+        let overflowing = request_ids_on_thread(3000007100, BLOCK + 10);
+        let neighbour = request_ids_on_thread(3000007101, 10);
+        let seen: HashSet<_> = overflowing.iter().copied().collect();
+        assert_eq!(seen.len(), overflowing.len(), "ids repeated on one thread");
+        for id in neighbour {
+            assert!(!seen.contains(&id), "request id {id} handed out twice");
+        }
+    }
+
+    /// Two threads that both exhaust their blocks must not be given the same
+    /// replacement block.
+    #[test]
+    fn two_overflowing_threads_get_distinct_replacement_blocks() {
+        let a = client_ids_on_thread(3000007200, BLOCK + 10);
+        let b = client_ids_on_thread(3000007300, BLOCK + 10);
+        let seen: HashSet<_> = a.iter().copied().collect();
+        for id in b {
+            assert!(!seen.contains(&id), "client id {id} handed ou
```

**File**: `crates/core/src/contract/handler.rs` (modified, +48/-17)
```diff
@@ -456,20 +456,30 @@ pub(crate) fn contract_handler_channel() -> (
     )
 }
 
-const EV_ID_BLOCK: u64 = 1_000_000;
-
 thread_local! {
-    static EV_ID: Cell<u64> = {
-        let idx = crate::config::GlobalRng::thread_index();
-        Cell::new(idx * EV_ID_BLOCK)
-    };
+    static EV_ID: Cell<crate::util::id_block::IdBlock> =
+        Cell::new(crate::util::id_block::IdBlock::for_thread(
+            crate::config::GlobalRng::thread_index(),
+            0,
+        ));
+}
+
+/// Next contract-handler event id for this thread; never overlaps another
+/// thread's ids (ANT-2026-8LFV3MG8).
+fn next_event_id() -> u64 {
+    EV_ID.with(|c| {
+        let mut block = c.get();
+        let id = block.take();
+        c.set(block);
+        id
+    })
 }
 
 /// Reset the event ID counter to initial state for this thread.
 /// Thread-local, so safe for parallel test execution.
 pub fn reset_event_id_counter() {
     let idx = crate::config::GlobalRng::thread_index();
-    EV_ID.with(|c| c.set(idx * EV_ID_BLOCK));
+    EV_ID.with(|c| c.set(crate::util::id_block::IdBlock::for_thread(idx, 0)));
 }
 
 impl Stream for ContractHandlerChannel<WaitingResolution> {
@@ -521,11 +531,7 @@ impl ContractHandlerChannel<SenderHalve> {
         timeout: Duration,
         priority: super::fair_queue::Priority,
     ) -> Result<ContractHandlerEvent, ContractError> {
-        let id = EV_ID.with(|c| {
-            let v = c.get();
-            c.set(v + 1);
-            v
-        });
+        let id = next_event_id();
         let (result, result_receiver) = tokio::sync::oneshot::channel();
         let internal = InternalCHEvent {
             ev,
@@ -650,6 +656,35 @@ impl ContractHandlerChannel<SenderHalve> {
         }
     }
 
+    /// Tell the session actor that `client_id` is gone, so it drops every
+    /// transaction still registered for that client. Without this the actor
+    /// only forgets a registration when a result is delivered for it, and a
+    /// request that was refused after registering never gets one
+    /// (ANT-2026-DN7GTB1F).
+    pub async fn notify_session_actor_client_disconnect(&self, client_id: ClientId) {
+        let Some(session_tx) = &self.session_adapter_tx else {
+            return;
+        };
+        let msg = SessionMessage::ClientDisconnect { client_id };
+        match tokio::time::timeout(Self::WAIT_FOR_RES_SEND_TIMEOUT, session_tx.send(msg)).await {
+            Ok(Ok(())) => {}
+            Ok(Err(e)) => {
+                tracing::error!(
+                    client = %client_id,
+                    error = %e,
+                    "Failed to notify session actor of client disconnect — receiver dropped"
+                );
+            }
+            Err(_) => {
+                tracing::error!(
+                    client = %client_id,
+                    timeout_secs = Self::WAIT_FOR_RES_SEND_TIMEOUT.as_secs(),
+                    "Timed out notifying session actor of client disconnect — channel full"
+                );
+            }
+        }
+    }
+
     /// Send an event to the contract handler without waiting for a response.
     ///
     /// Used for fire-and-forget events like `ClientDisconnect` that don't
@@ -667,11 +702,7 @@ impl ContractHandlerChannel<SenderHalve> {
         ev: ContractHandlerEvent,
         priority: super::fair_queue::Priority,
     ) -> Result<(), ContractError> {
-        let id = EV_ID.with(|c| {
-            let v = c.get();
-            c.set(v + 1);
-            v
-        });
+        let id = next_event_id();
         // Create a oneshot but immediately drop the receiver — the handler
         // won't send a response, and if it does, the send will harmlessly fail.
         let (result, _) = tokio::sync::oneshot::channel();
```

**File**: `crates/core/src/node/op_state_manager.rs` (modified, +33/-30)
```diff
@@ -50,9 +50,10 @@ use super::{
 struct Ops {
     // No per-op DashMaps remain. CONNECT, GET, PUT, UPDATE, and
     // SUBSCRIBE all run on drivers that own state in task
-    // locals; the only state retained here is the global completed /
-    // under_progress sets used by the GC sweep.
-    completed: DashSet<Transaction>,
+    // locals; the only state retained here is the global under_progress
+    // set used by the GC sweep. There is deliberately no `completed` set:
+    // nothing read it, and since #4110 nothing removed from it, so every
+    // finished transaction stayed in memory (ANT-2026-OZWLXLHH).
     under_progress: DashSet<Transaction>,
 }
 
@@ -62,14 +63,12 @@ struct Ops {
 /// run.
 #[derive(Debug, Default)]
 struct OpsSizes {
-    completed: usize,
     under_progress: usize,
 }
 
 impl Ops {
     fn sizes(&self) -> OpsSizes {
         OpsSizes {
-            completed: self.completed.len(),
             under_progress: self.under_progress.len(),
         }
     }
@@ -693,7 +692,7 @@ impl OpManager {
         let ring = Ring::new(
             config,
             notification_channel.clone(),
-            event_register.clone(),
+            event_register,
             config.is_gateway,
             connection_manager,
             task_monitor,
@@ -729,7 +728,6 @@ impl OpManager {
                     ops.clone(),
                     ring.live_tx_tracker.clone(),
                     notification_channel.clone(),
-                    event_register,
                     result_router_tx.clone(),
                     request_router.clone(),
                     contract_waiters.clone(),
@@ -1903,7 +1901,6 @@ impl OpManager {
     pub fn completed(&self, id: Transaction) {
         self.ring.live_tx_tracker.remove_finished_transaction(id);
         self.ops.under_progress.remove(&id);
-        self.ops.completed.insert(id);
 
         // Clean up request router to prevent stale entries from blocking subsequent requests
         if let Some(router) = self.request_router.get() {
@@ -2728,12 +2725,11 @@ fn notify_transaction_timeout(
 // has a `ConnectOp` to inspect.
 
 #[allow(clippy::too_many_arguments)]
-async fn garbage_cleanup_task<ER: NetEventRegister>(
+async fn garbage_cleanup_task(
     mut new_transactions: tokio::sync::mpsc::Receiver<Transaction>,
     ops: Arc<Ops>,
     live_tx_tracker: LiveTransactionTracker,
     event_loop_notifier: EventLoopNotificationsSender,
-    mut event_register: ER,
     _result_router_tx: mpsc::Sender<(Transaction, HostResult)>,
     request_router: Arc<OnceLock<Arc<RequestRouter>>>,
     contract_waiters: Arc<
@@ -2839,7 +2835,6 @@ async fn garbage_cleanup_task<ER: NetEventRegister>(
                         ops_get = 0,
                         ops_subscribe = 0,
                         ops_update = 0,
-                        ops_completed = ops_sizes.completed,
                         ops_under_progress = ops_sizes.under_progress,
                         pending_contract_fetches = pending_fetches,
                         contract_waiters = waiters_len,
@@ -2903,15 +2898,6 @@ async fn garbage_cleanup_task<ER: NetEventRegister>(
 
                 let old_missing = std::mem::take(&mut delayed);
                 for tx in old_missing {
-                    if let Some(tx) = ops.completed.remove(&tx) {
-                        if cfg!(feature = "trace-ot") {
-                            let op_type = tx.transaction_type().description();
-                            event_register.notify_of_time_out(tx, op_type, None).await;
-                        } else {
-                            _ = tx;
-                        }
-                        continue;
-                    }
                     // Every op runs on a driver and owns
                     // its own timeout reporting (via
                     // `Relay*InflightGuard` failure paths or
@@ -2922,7 +2908,6 @@ async fn garbage_cleanup_task<ER: NetEventRegister>(
                         delayed.push(tx);
                     } else {
                         ops.under_progress.remove(&tx);
-                        ops.completed.remove(&tx);
                         tracing::info!(
                             tx = %tx,
                             tx_type = ?tx.transaction_type(),
@@ -2961,15 +2946,6 @@ async fn garbage_cleanup_task<ER: NetEventRegister>(
                         ops.under_progress.remove(&tx);
                         // Fall through to normal cleanup below
                     }
-                    if let Some(tx) = ops.completed.remove(&tx) {
-                        tracing::debug!("Clean up timed out: {tx}");
-                        if cfg!(feature = "trace-ot") {
-                            let op_type = tx.transaction_type().description();
-                            event_register.notify_of_time_out(tx, op_type, None).await;
-                        } else {
-                            _ = tx;
-                        }
-                    }
    
```

**File**: `crates/core/src/operations/get/op_ctx_task.rs` (modified, +2/-4)
```diff
@@ -483,10 +483,8 @@ async fn drive_client_get_inner(
     // returns (and the side-effect block below has run). Do not add
     // explicit `completed()` calls in the arms here — doing so would
     // race the originator-side side effects (`cache_contract_locally`,
-    // `maybe_subscribe_child`) because once the tx is in `ops.completed`, any
-    // `op_manager.push(...)` for that tx is silently dropped (see
-    // `op_state_manager.rs::push` short-circuit on
-    // `ops.completed.contains`).
+    // `maybe_subscribe_child`): `completed()` also drops the tx from the
+    // request router and the live-transaction tracker.
 
     match loop_result {
         RetryLoopOutcome::Done(terminal) => {
```

**File**: `crates/core/src/ring.rs` (modified, +6/-0)
```diff
@@ -5182,6 +5182,12 @@ impl Ring {
             .remove_client_from_all_subscriptions(client_id)
     }
 
+    /// Whether `client_id`'s disconnect has already been swept, so a
+    /// subscription registered for it now would never be removed.
+    pub(crate) fn is_client_disconnected(&self, client_id: crate::client_events::ClientId) -> bool {
+        self.hosting_manager.is_client_disconnected(client_id)
+    }
+
     /// Get all hosted contract keys from the hosting cache.
     pub fn hosting_contract_keys(&self) -> Vec<ContractKey> {
         self.hosting_manager.hosting_contract_keys()
```

**File**: `crates/core/src/ring/hosting.rs` (modified, +73/-0)
```diff
@@ -450,6 +450,32 @@ impl AddSubscriberOutcome {
     }
 }
 
+/// Most recently disconnected clients remembered by [`DisconnectedClients`].
+/// Far more than the requests that can be in flight for clients that have just
+/// gone; when it is full the oldest entry is forgotten.
+const MAX_REMEMBERED_DISCONNECTED_CLIENTS: usize = 65_536;
+
+/// Bounded FIFO set of client ids whose disconnect was swept.
+#[derive(Default)]
+struct DisconnectedClients {
+    order: std::collections::VecDeque<crate::client_events::ClientId>,
+    members: HashSet<crate::client_events::ClientId>,
+}
+
+impl DisconnectedClients {
+    fn insert(&mut self, client_id: crate::client_events::ClientId) {
+        if !self.members.insert(client_id) {
+            return;
+        }
+        self.order.push_back(client_id);
+        while self.order.len() > MAX_REMEMBERED_DISCONNECTED_CLIENTS {
+            if let Some(oldest) = self.order.pop_front() {
+                self.members.remove(&oldest);
+            }
+        }
+    }
+}
+
 /// Result of removing all subscriptions for a disconnected client.
 #[derive(Debug)]
 pub struct ClientDisconnectResult {
@@ -627,6 +653,12 @@ pub(crate) struct HostingManager {
     /// silently miss it.
     client_subscriptions: DashMap<ContractInstanceId, LocalSubscribers>,
 
+    /// Clients whose `Disconnect` has already been swept. A request from such a
+    /// client can still be in flight (client requests run as independent
+    /// tasks), and without this record it would register its subscription
+    /// after the sweep and keep the slot forever (ANT-2026-VCHSBVO6).
+    disconnected_clients: parking_lot::Mutex<DisconnectedClients>,
+
     /// Unified hosting cache with byte-budget demand-ordered eviction ("fuel
     /// gauge") and TTL protection. This is the single source of truth for which
     /// contracts we're hosting.
@@ -838,6 +870,7 @@ impl HostingManager {
         Self {
             active_subscriptions: Default::default(),
             client_subscriptions: DashMap::new(),
+            disconnected_clients: Default::default(),
             hosting_cache: RwLock::new(HostingCache::new(budget_bytes, time_source.clone())),
             demand_estimator: RwLock::new(ProximityPrior::new()),
             own_location: RwLock::new(None),
@@ -1868,11 +1901,25 @@ impl HostingManager {
         self.maybe_record_abandonment(contract);
     }
 
+    /// Whether `client_id`'s disconnect has been swept already, so a
+    /// subscription registered for it now would never be cleaned up.
+    pub fn is_client_disconnected(&self, client_id: crate::client_events::ClientId) -> bool {
+        self.disconnected_clients
+            .lock()
+            .members
+            .contains(&client_id)
+    }
+
     /// Remove a client from ALL its subscriptions (used when client disconnects).
     pub fn remove_client_from_all_subscriptions(
         &self,
         client_id: crate::client_events::ClientId,
     ) -> ClientDisconnectResult {
+        // Record the disconnect BEFORE sweeping. A registration that lands
+        // after the sweep checks this record (`is_client_disconnected`) and
+        // undoes itself; one that landed before it is found by the sweep.
+        self.disconnected_clients.lock().insert(client_id);
+
         let mut affected_contracts = Vec::new();
 
         // Find all contracts where this client is subscribed
@@ -4855,6 +4902,32 @@ mod tests {
         assert!(is_last2);
     }
 
+    /// ANT-2026-VCHSBVO6: the sweep records the client, and the record is a
+    /// bounded FIFO so a flood of connections cannot grow it without limit.
+    #[test]
+    fn sweep_records_the_client_and_the_record_is_bounded() {
+        let manager = HostingManager::new(DEFAULT_HOSTING_BUDGET_BYTES);
+        let first = crate::client_events::ClientId::next();
+        assert!(!manager.is_client_disconnected(first));
+        manager.remove_client_from_all_subscriptions(first);
+        assert!(manager.is_client_disconnected(first));
+
+        for _ in 0..MAX_REMEMBERED_DISCONNECTED_CLIENTS {
+            manager.remove_client_from_all_subscriptions(crate::client_events::ClientId::next());
+        }
+        assert!(
+            !manager.is_client_disconnected(first),
+            "the oldest record is forgotten once the bound is reached"
+        );
+        let last = crate::client_events::ClientId::next();
+        manager.remove_client_from_all_subscriptions(last);
+        assert!(manager.is_client_disconnected(last));
+        assert_eq!(
+            manager.disconnected_clients.lock().members.len(),
+            MAX_REMEMBERED_DISCONNECTED_CLIENTS
+        );
+    }
+
     #[test]
     fn test_hosting_cache_basic() {
         let manager = HostingManager::new(DEFAULT_HOSTING_BUDGET_BYTES);
```

#### Recent Merged Pull Requests:
- **PR #6285** (2026-11-18): fix(hosting): keep contract state inside --max-hosting-storage (@sanity)
- **PR #6283** (2026-11-18): test: give the two merge-budget sims their own network names (@sanity)
- **PR #6282** (2026-11-18): fix(client-api): bound client subscription leaks, id collisions and the completed set (@sanity)
- **PR #6280** (2026-11-18): fix(hosting): bound per-neighbor hosting adverts and close disconnect race (@sanity)
- **PR #6279** (2026-11-18): fix: bound remote-controlled relay inputs (UPDATE loop, HTL, reconcile rate, streaming admission) (@sanity)
- **PR #6278** (2026-11-18): build: release 0.2.160 (@sanity)

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

## X. quic): the peer crash-breaker action for when UDP is removed, switched off

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6174c624`: quic): the peer crash-breaker action for when UDP is removed, switched off. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    With no UDP to fall back to (breaker::UDP_FALLBACK false, set by the
    UDP-removal release; until then tests only, switched on in a
    quic-panic-injection build by FREENET_TEST_BREAKER_NO_UDP_FALLBACK), a
    peer trips at three again and its trip keeps QUIC on: a start delay of 1
    minute doubling to 30 (Verdict::Backoff, waited out just before the
    transport opens, cut short by a stop), the startup update check at once
    (quic_crash_loop_update_now; the update claim still applies), and a
    supervised peer exits on endpoint death like a gateway.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6174c624` are properly handled with clean fallback behavior.
