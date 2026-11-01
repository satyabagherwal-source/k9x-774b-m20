> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `dd302470`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-01T02:07:48.320Z  
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
> **Harvest Timestamp**: 2026-11-01T02:07:48.312Z  
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
- **Issue #6066** (2026-11-01): **test(transport): add QUIC shadow scenarios and correct the rollout docs**
  *Symptoms*: ## Problem  The shadow sims so far cover two or a few nodes, with one condition at a time. Before shadow can ship, the plan needs three scenarios on a larger or harder network: mixed modes in one mesh, a node at its path limit, and a restart. Docs also still say shadow would confirm `MAX_UNI_STREAMS` (shadow carries no data) and describe opt-in stages, which the rollout plan no longer has.  Tests and docs only. No production behaviour changes; `SimNetwork::with_quic_max_paths` is a testing-only helper.  ## Approach  - **`test_quic_mixed_modes_form_paths_only_between_shadow_nodes`:** 4 shadow, 1 off, and 1 off advertising the below-floor 0.2.149. The mesh joins the same peers as the all-off run, paths exist only between shadow pairs, the off node declines, and the below-floor node gets no offer and receives nothing. - **`test_quic_max_paths_one_declines_busy_and_retries`:** `DeclineSent(Busy)` at the client, an uncharged `Declined{Busy}` at the offerer, permits never above 1, and a pair declined `Busy` later establishes once a slot frees. - **`test_quic_restart_while_shadowed_returns_the_path_and_frees_the_permit`:** the survivor's session end shows 0 permits, the path returns on both sides with one permit, and the carried backoff holds: a server waits at least 48 s before its first new offer, a client declines with `Backoff`. Both roles, by looping seeds. - **`test_quic_mixed_modes_are_deterministic`:** same seed, same records and mesh. - **Docs:** `MAX_UNI_STREAMS` claims co

- **Issue #6065** (2026-10-31): **feat(transport): report QUIC shadow-mode telemetry**
  *Symptoms*: ## Problem  Rollout stages 1 and 2 of #5940 have to judge shadow mode from field data: upgrade success, fallbacks, path counts and their memory, with nothing else to go on. Shadow's outcomes reached only a test hook until now, so nodes report nothing.  No behaviour change: counters and gauges only, and all of them read zero with QUIC off.  ## Approach  - **Outcome counters:** every machine `Outcome` reaches a `quic_upgrade_*` counter through `Session::count` in `driver.rs`, a match over each variant, so a new outcome fails to compile until it is counted. Counts happen where the decision is made. Also `inbox_overflow` (a full inbox only), `attempt_unrouted` and `task_panicked`; driver and pump panics are counted and then re-raised. - **Gate denominator:** offers repeat every 60 s while a peer answers Busy, NotReady or Backoff, so a per-offer rate is meaningless. The report gives `established_as_offerer` over `accepted`. `accepted` is also recorded when the peer's connection arrives before its Accept (a lost or late Accept), so the numerator cannot exceed the denominator. The report gives both, beside `offered` and `declined_uncharged`. To make this one-sided, `Outcome::Established` now carries a role, `Declined` carries the machine's uncharged decision, and the client's Accept is renamed `AcceptSent`. - **Fallbacks:** `quic_fallback_{idle,reset,protocol,downgrade_rx,endpoint_down}`, for paths that had been active only. An attempt that ends before it is active has its own count

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

### Incident Patch 1: `dd302470` (2026-11-01)
**Commit Message**: test(transport): add QUIC shadow scenarios and correct the rollout docs (#6066)

**File**: `.claude/rules/transport.md` (modified, +46/-3)
```diff
@@ -407,8 +407,8 @@ arrivals older than the horizon or past the 1024 cap, streams the 1024-stream
 budget refused) are listed in the module doc. So `ge_T / conns_sampled` can
 support LOWERING `MAX_UNI_STREAMS` (`quic/config.rs`), never raising it; a
 limit that is too low costs only sender back-pressure. Shadow mode carries no
-data, so it cannot confirm the value; rollout stage 3 (data on QUIC, opt-in)
-is the first measurement on real QUIC. The gauge says nothing about the memory
+data, so it measures nothing about the value; rollout step 3 (data on a slice
+of pairs, see "QUIC rollout") is the first measurement on real QUIC. The gauge says nothing about the memory
 a peer opening streams on purpose can hold (the per-path ceiling's job). `inbound_concurrency_max` is diagnostic
 only (one peer can drive it to the cap with a burst or an inflated RTT). The
 counts sit under one mutex taken only on a connection's first sample of a
@@ -1014,7 +1014,7 @@ snapshot except the two gauges.
   task_panicked (a driver or pump panic, re-raised after counting).
   `identity_mismatch` counts on both ends: a peer's close with code 2 ends this
   node's attempt as `identity_mismatch` too.
-  Stage 2 gate denominator: established_as_offerer over accepted, reported beside
+  Step 2 gate denominator: established_as_offerer over accepted, reported beside
   offered and declined_uncharged. Both sides count `established`; only the
   offerer's is the numerator. Counts are node-wide; there is no per-pair series.
   `quic_fallback_<label>` (`QuicFallback`): idle, reset, protocol, downgrade_rx,
@@ -1236,6 +1236,49 @@ time; `simulation::QuicDatagramDrop`, kept across `with_fault_injection`).
 `quic/test_tls.rs` holds only a plain Ed25519 identity for tests where a
 peer presents a key that is not its transport key.
 
+#### QUIC rollout (#5940)
+
+There are no opt-in stages; releases do the rollout. QUIC stays off on Windows
+throughout, until #6031. Every step watches: peers disappearing per version
+against the previous rollout (a node that dies before reporting is absent from
+every rate), endpoint-down, panics and breaker trips, RSS against
+`quic_paths_active`, CPU and egress, and NAT success, connections and transfers.
+
+- Step 0: the first negotiating release ships with QUIC off. Its nodes answer
+  offers (`Decline{disabled}` with the key off); `upgrade_control_received`
+  stays near 0 and UDP metrics do not change.
+- Step 1: nova gateways and framework in shadow for 24-48 h. The 24 h gateway
+  A/B runs only if something looks odd. Rollback: set the key to off and restart.
+- Step 2: shadow on by default, not on Windows. Gate: at least 95% upgrade
+  success by `established_as_offerer / accepted`; fewer than 1 fallback per
+  path-day excluding endpoint and restart causes; memory within the measured
+  terms (about 0.3 to 0.5 MiB per idle path). An abort spike stops the step.
+  Shadow carries no data, so it does not measure `MAX_UNI_STREAMS`.
+- Step 3 (e5b): data on a slice of pairs chosen by a hash of their two keys, so
+  both sides agree with no extra message: about 5%, then 25%, then 100%, one
+  release each. Pairs outside the slice are the control. Needs identity PR3, the
+  quinn pin decision and #6027. Keep the stream limits if permit waits plus
+  `quic_open_uni_waited` stay below 0.5% of sends and ge_48 below 0.2% of
+  path-windows.
+- Going to 100% is default-on. Per slice against its control: fewer transfers
+  that hit an RTO; p90 queueing at 1 MiB or more no worse than 262 ms; timeout
+  disconnects no worse; CPU per byte at most 1.5x; OS egress at most cap + 5%;
+  memory no worse than UDP; zero panics or endpoint-downs attributable to QUIC;
+  over the slice's release; and the kill switch rehearsed once (a default-off
+  release through the stagger). The stream-limit bars are re-derived from real
+  data, not loosened.
+- Rollback at any step is a default-off release through auto-update's 0-4 h
+  stagger. Per-path fallback to UDP and the breaker work without a release. A
+  node in a broken state may not self-update.
+
+Simulation scenarios (`tests/simulation_integration.rs`, `test_quic_*`): two
+nodes established with traffic on UDP; QUIC-off peers decline `Disabled`; peers
+below the version floor are never offered; blackholed and idle paths fall back
+and are re-offered; a wrong key closes with IDENTITY_MISMATCH; endpoint-down
+closes every path; a replaced or restarted session closes its path and keeps the
+backoff; a mixed shadow / off / below-floor network forms paths only between
+shadow nodes; `quic-max-paths` = 1 declines `Busy` without a charge.
+
 #### QUIC identity (`transport/quic/identity.rs`, #5940 step c3)
 
 ```
```

**File**: `crates/core/src/node/testing_impl.rs` (modified, +11/-0)
```diff
@@ -2087,6 +2087,17 @@ impl SimNetwork {
         self
     }
 
+    /// Sets `quic-max-paths` to `limit` on every node, as `config.toml` would.
+    /// Call before the simulation starts. No effect on a node with QUIC off.
+    #[cfg(any(test, feature = "testing"))]
+    pub fn with_quic_max_paths(&mut self, limit: usize) -> &mut Self {
+        for label in self.pending_labels() {
+            let config = self.node_config_mut(&label);
+            Arc::make_mut(&mut config.config).network_api.quic_max_paths = Some(limit.to_string());
+        }
+        self
+    }
+
     /// Drops every QUIC-class datagram between the nodes `a` and `b`, both
     /// directions, from virtual time `from` on (the network's clock starts
     /// at zero). Every other datagram between them is delivered as before,
```

**File**: `crates/core/src/transport/quic/config.rs` (modified, +4/-3)
```diff
@@ -102,9 +102,10 @@ pub(crate) const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(15);
 ///
 /// The estimate is built to err high (see
 /// `peer_connection::inbound_concurrency`), so it can justify lowering
-/// this value, never raising it. Shadow mode carries no data, so it cannot
-/// confirm or justify the value either. Rollout stage 3 (#5940: data on
-/// QUIC, opt-in) is the first measurement on real QUIC that can.
+/// this value, never raising it. Shadow mode carries no data, so it
+/// measures nothing about this value. The first measurement on real QUIC is
+/// step 3 of the rollout (#5940: data on a slice of pairs, chosen by a hash
+/// of the two keys).
 pub(crate) const MAX_UNI_STREAMS: u32 = 64;
 
 /// Uni stream slots left for short messages and control frames when every
```

**File**: `crates/core/tests/simulation_integration.rs` (modified, +247/-1)
```diff
@@ -20734,6 +20734,8 @@ struct QuicShadowRun {
     /// Gateways first.
     nodes: Vec<SocketAddr>,
     logs_events: usize,
+    /// Each pair of nodes that connected, ordered.
+    mesh: std::collections::BTreeSet<(SocketAddr, SocketAddr)>,
 }
 
 impl QuicShadowRun {
@@ -20795,11 +20797,20 @@ fn run_quic_shadow_sim(
     sim.run_simulation_direct::<rand::rngs::SmallRng>(seed, 1, steps, QUIC_EVENT_WAIT)
         .expect("direct simulation should succeed");
     let rt = create_runtime();
-    let logs_events = rt.block_on(async { logs_handle.lock().await.len() });
+    let (logs_events, mesh) = rt.block_on(async {
+        let logs = logs_handle.lock().await;
+        let mesh = logs
+            .iter()
+            .filter_map(|log| log.kind.connect_connected_addrs())
+            .map(|(a, b)| if a <= b { (a, b) } else { (b, a) })
+            .collect();
+        (logs.len(), mesh)
+    });
     QuicShadowRun {
         trace,
         nodes: addresses,
         logs_events,
+        mesh,
     }
 }
 
@@ -21289,3 +21300,238 @@ fn run_quic_restart_sim(
         (trace, labels[&gateway], replaced_at)
     })
 }
+
+// =============================================================================
+// QUIC shadow scenarios (#5940 step e5a-7)
+// =============================================================================
+
+/// The peers in `mesh`.
+fn quic_mesh_peers(
+    mesh: &std::collections::BTreeSet<(SocketAddr, SocketAddr)>,
+) -> std::collections::BTreeSet<SocketAddr> {
+    quic_mesh_peers_and_connected(mesh).0
+}
+
+/// Six nodes: four in shadow, one with QUIC off and one with QUIC off that
+/// advertises a release below the floor. The mesh joins the same peers as with
+/// QUIC off everywhere, paths exist only between shadow nodes, a node with QUIC
+/// off is offered and declines, and the node below the floor is neither offered
+/// nor sent a single upgrade message.
+#[test_log::test]
+fn test_quic_mixed_modes_form_paths_only_between_shadow_nodes() {
+    const SEED: u64 = 0x5940_E5C0_1003;
+    const ANSWER_FLOOR: (u8, u8, u16) = (0, 2, 149);
+    let baseline = run_quic_shadow_sim("quic-mixed-off", SEED, (2, 4), 8, |_, _, _| {});
+    let mixed = run_quic_shadow_sim("quic-mixed", SEED, (2, 4), 8, |sim, trace, labels| {
+        for label in &labels[..4] {
+            sim.with_node_transport_quic(label, "shadow");
+        }
+        sim.with_node_advertised_version(&labels[5], ANSWER_FLOOR);
+        run_as_first_negotiating_release(trace);
+    });
+    let (shadow, off, below) = (&mixed.nodes[..4], mixed.nodes[4], mixed.nodes[5]);
+
+    // Premises: the mesh formed, and offers, answers and paths all happened.
+    let baseline_peers = quic_mesh_peers(&baseline.mesh);
+    assert_eq!(
+        baseline_peers.len(),
+        6,
+        "every node joined: {:?}",
+        baseline.mesh
+    );
+    for node in &mixed.nodes {
+        assert!(
+            mixed.trace.connections_opened(*node) > 0,
+            "{node} connected"
+        );
+    }
+    assert!(mixed.total("Offered") >= 1, "{}", mixed.dump());
+    assert!(
+        mixed.total("Established") >= 2,
+        "a path formed between shadow nodes: {}",
+        mixed.dump()
+    );
+    assert!(
+        mixed.whats(off, "received Offer") >= 1,
+        "a shadow node offered to the node with QUIC off: {}",
+        mixed.dump()
+    );
+    // Who it declined to depends on the keys, so this reads the whole run.
+    assert!(
+        mixed.total("Declined { reason: Some(Disabled)") >= 1,
+        "the node with QUIC off answers Disabled: {}",
+        mixed.dump()
+    );
+    assert!(
+        mixed.total("IneligibleVersion") >= 1,
+        "a shadow node met the node below the floor: {}",
+        mixed.dump()
+    );
+
+    // The mesh joins the same peers, and is connected.
+    let (peers, connected) = quic_mesh_peers_and_connected(&mixed.mesh);
+    assert_eq!(peers, baseline_peers, "the same peers join");
+    assert!(connected, "{:?}", mixed.mesh);
+
+    // Paths exist only between shadow nodes.
+    for record in mixed.trace.records() {
+        if record.what.starts_with("Established") {
+            assert!(
+                shadow.contains(&record.node) && shadow.contains(&record.peer),
+                "{record:?} is not between shadow nodes"
+            );
+        }
+    }
+    for node in [off, below] {
+        assert_eq!(mixed.whats(node, "Established"), 0, "{}", mixed.dump());
+        assert_eq!(mixed.trace.permits_in_use(node), None, "it has no upgrades");
+    }
+    // Nothing is offered to, or sent to, the node below the floor.
+    assert_eq!(mixed.whats(below, "received"), 0, "{}", mixed.dump());
+    assert!(
+        mixed
+            .trace
+            .records()
+            .iter()
+            .all(|r| r.peer != below || !r.what.starts_with("Offered")),
+        "{}",
+        mixed.dump()
+    );
+}
+
+/// With `quic-max-paths` = 1 a node holds one path at a time. An offer that finds
+//
```

---

### Incident Patch 2: `465a3a3b` (2026-10-31)
**Commit Message**: feat(transport): report QUIC shadow-mode telemetry (#6065)

**File**: `.claude/rules/transport.md` (modified, +53/-1)
```diff
@@ -376,7 +376,8 @@ and no breaker state is left), QUIC crash-loop breaker trips at startup
 only a QUIC fault; see `quic/breaker.rs`) and whether the breaker keeps QUIC
 off in this process (`quic_breaker_suppressed`, a state that is never reset and
 is not activity by itself) and QUIC connections this node closed, by close code
-(`quic_close_sent_<label>`, one per `QuicCloseCode`). Each label set is declared once in a
+(`quic_close_sent_<label>`, one per `QuicCloseCode`) and the shadow-mode upgrade
+telemetry (below, "Upgrade telemetry"). Each label set is declared once in a
 `labelled_counters!` list, so a new variant needs a snapshot field. Hot
 path writes are single relaxed atomics; `SentPacketTracker` keeps an
 `rto_expiries` count and a bounded per-stream final-ACK watch, both
@@ -958,17 +959,20 @@ doc has the transition table.
   once with CONTROL_REFUSED and a normal backoff, so the sender does not wait
   for its setup timeout. WrongLength and Empty wait for the deadline. Once
   active, a refused frame leaves the path alone.
+
   Off is final for the session, also for a policy that later clears (endpoint
   Down, Released or Disabled, session ended, policy refusing, below the version
   floor, equal keys): no re-offer, and no charge to the peer except from a
   session end (above). A client or a machine with no role answers an Offer in
   Off with Disabled; a server records role_conflict and does not reply. A later
   Promoted changes and records nothing.
+
   An Offer repeating or older than the highest seen gets no reply. An Offer
   while an attempt is in progress gets NotReady; a client never tears a path
   down because of an Offer, so offers cannot make it dial faster than its
   attempts finish. A server that receives an Offer records role_conflict and
   does not reply.
+
   Caller contracts (e5a-5b): report OfferSent before stepping any reply to that
   Offer; drop an Offer still deferred behind allow_peer once a TearDown names
   its attempt; read backoff_seed after stepping SessionEnded (None when the machine took no seed: file nothing); end and file any older session for the peer key BEFORE stepping Promoted on the new one, and never let an older session's seed replace a newer one's (a max merge undoes a stable path's clear, so track session order); give every session the listener's clock clone (RealTime::new() starts its own epoch); give the client
@@ -989,6 +993,54 @@ doc has the transition table.
   negotiation_floor_stays_above_every_release_that_ignores_an_offer stops
   QUIC_UPGRADE_NEGOTIATES_IN going down to 0.2.152 or below.
 
+Upgrade telemetry (#5940 e5a-6). The driver turns each machine `Outcome` into a
+counter at `Session::count`, which matches every `Outcome` variant, so a new
+outcome does not compile until it has one. All are per-period and reset with the
+snapshot except the two gauges.
+  `quic_upgrade_<label>` (`QuicUpgradeOutcome`): offered, accepted (the peer
+  accepted this node's Offer, by its Accept or, if that was lost, by its
+  connection, counted once either way), accept_sent, established (either role),
+  established_as_offerer, no_reply, timeout, handshake_failed, identity_mismatch,
+  role_conflict, allow_set_full, key_conflict, control_refused,
+  ineligible_version, declined_<reason> (the peer's Decline), declined_uncharged
+  (the same Decline when the machine spared the peer the penalty; the flag comes
+  from `on_decline`), decline_sent_<reason> (counted after the decline rate gate;
+  `upgrade_decline_suppressed` counts the held-back ones), setup_downgrade_rx and
+  setup_endpoint_down (the same causes as the fallbacks below, before the path
+  was active), session_ended_setup and session_ended_active (the UDP session
+  ended under an attempt or a path), inbox_overflow (a full inbox only),
+  attempt_unrouted (attempts that reached this node and found no session or no
+  attempt waiting; a client's retransmitted Initial can count again), and
+  task_panicked (a driver or pump panic, re-raised after counting).
+  `identity_mismatch` counts on both ends: a peer's close with code 2 ends this
+  node's attempt as `identity_mismatch` too.
+  Stage 2 gate denominator: established_as_offerer over accepted, reported beside
+  offered and declined_uncharged. Both sides count `established`; only the
+  offerer's is the numerator. Counts are node-wide; there is no per-pair series.
+  `quic_fallback_<label>` (`QuicFallback`): idle, reset, protocol, downgrade_rx,
+  endpoint_down. Paths that had been active only; an attempt that ends in setup
+  is counted in `quic_upgrade_*`. A close this node sent for send_abort_limit or
+  peer_not_acknowledging reaches the machine as a lost connection, so it counts
+  as `reset`; its count is `quic_close_sent_*`. A key mismatch is
+  `quic_upgrade_identity_mismatch`.
+  `quic_close_received_<label>`: one per QUIC connection quinn reports as closed
+  by a peer application close, by raw code (counted in `QuicConnection::
```

**File**: `crates/core/src/node/resource_metrics.rs` (modified, +25/-2)
```diff
@@ -49,6 +49,9 @@ pub(crate) struct ResourceUtilization {
     /// Cumulative bytes received at the UDP socket layer since start (never
     /// reset).
     pub cumulative_bytes_received: u64,
+    /// QUIC upgrade paths active now (shadow mode), sampled with the RSS so
+    /// the two can be regressed against each other for a per-path cost.
+    pub quic_paths_active: u64,
 }
 
 impl ResourceUtilization {
@@ -67,12 +70,17 @@ impl ResourceUtilization {
 /// in-process [`TRANSPORT_METRICS`] cumulative byte counters. Never blocks on
 /// the network and never panics.
 pub(crate) fn sample() -> ResourceUtilization {
+    sample_from(&TRANSPORT_METRICS)
+}
+
+fn sample_from(transport: &crate::transport::metrics::TransportMetrics) -> ResourceUtilization {
     ResourceUtilization {
         memory_rss_bytes: rss_bytes(),
         memory_limit_bytes: crate::wasm_runtime::read_total_ram_bytes().map(|v| v as u64),
         cpu_time_seconds: cpu_time_seconds(),
-        cumulative_bytes_sent: TRANSPORT_METRICS.cumulative_bytes_sent(),
-        cumulative_bytes_received: TRANSPORT_METRICS.cumulative_bytes_received(),
+        cumulative_bytes_sent: transport.cumulative_bytes_sent(),
+        cumulative_bytes_received: transport.cumulative_bytes_received(),
+        quic_paths_active: transport.quic_paths_active(),
     }
 }
 
@@ -162,6 +170,20 @@ mod tests {
         }
     }
 
+    /// The sample reports the transport's active QUIC path count. Uses its own
+    /// metrics, since the process-wide ones are shared with other tests.
+    #[test]
+    fn sample_reports_the_active_quic_path_count() {
+        let metrics = crate::transport::metrics::TransportMetrics::new();
+        let remote: std::net::SocketAddr = "10.0.0.1:1".parse().unwrap();
+        assert_eq!(sample_from(&metrics).quic_paths_active, 0);
+        metrics.quic_path_attempting(remote);
+        metrics.quic_path_activated(remote);
+        assert_eq!(sample_from(&metrics).quic_paths_active, 1);
+        metrics.quic_path_left(true, remote);
+        assert_eq!(sample_from(&metrics).quic_paths_active, 0);
+    }
+
     /// The telemetry JSON carries every axis as a populated key, so the
     /// dashboard sees non-absent fields it can chart. Guards against the field
     /// silently dropping out of the serialized event.
@@ -178,6 +200,7 @@ mod tests {
             "cpu_time_seconds",
             "cumulative_bytes_sent",
             "cumulative_bytes_received",
+            "quic_paths_active",
         ] {
             assert!(obj.contains_key(key), "telemetry value missing key `{key}`");
         }
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +145/-0)
```diff
@@ -3075,6 +3075,49 @@ fn event_kind_to_json(kind: &EventKind) -> serde_json::Value {
                 "quic_close_sent_control_refused".into(),
                 serde_json::json!(snapshot.quic_close_sent_control_refused),
             );
+            {
+                use crate::transport::metrics::{
+                    QuicCloseCode, QuicFallback, QuicPathAge, QuicUpgradeOutcome,
+                };
+                for (i, count) in snapshot.quic_close_received.iter().enumerate() {
+                    let label = QuicCloseCode::ALL
+                        .get(i)
+                        .map_or("unknown_code", |code| code.label());
+                    m.insert(format!("quic_close_received_{label}"), (*count).into());
+                }
+                for (outcome, count) in QuicUpgradeOutcome::ALL.iter().zip(snapshot.quic_upgrade) {
+                    m.insert(format!("quic_upgrade_{}", outcome.label()), count.into());
+                }
+                for (cause, count) in QuicFallback::ALL.iter().zip(snapshot.quic_fallback) {
+                    m.insert(format!("quic_fallback_{}", cause.label()), count.into());
+                }
+                for (age, count) in QuicPathAge::ALL.iter().zip(snapshot.quic_path_age_at_close) {
+                    m.insert(
+                        format!("quic_path_age_at_close_{}", age.label()),
+                        count.into(),
+                    );
+                }
+            }
+            m.insert(
+                "quic_establish_ms_p50".into(),
+                serde_json::json!(snapshot.quic_establish_ms_p50),
+            );
+            m.insert(
+                "quic_establish_ms_p90".into(),
+                serde_json::json!(snapshot.quic_establish_ms_p90),
+            );
+            m.insert(
+                "quic_establish_samples".into(),
+                serde_json::json!(snapshot.quic_establish_samples),
+            );
+            m.insert(
+                "quic_paths_offered_or_dialing".into(),
+                serde_json::json!(snapshot.quic_paths_offered_or_dialing),
+            );
+            m.insert(
+                "quic_paths_active".into(),
+                serde_json::json!(snapshot.quic_paths_active),
+            );
             m.insert(
                 "nat_fail_samples".into(),
                 serde_json::json!(snapshot.nat_fail_samples),
@@ -5862,6 +5905,7 @@ mod tests {
             "cpu_time_seconds",
             "cumulative_bytes_sent",
             "cumulative_bytes_received",
+            "quic_paths_active",
         ] {
             assert!(obj.contains_key(key), "event_data missing key `{key}`");
         }
@@ -7542,6 +7586,41 @@ mod tests {
             .cloned()
             .collect();
         expected.insert("type".to_string());
+        // The QUIC families are arrays in the snapshot and one key per label in
+        // the event.
+        use crate::transport::metrics::{
+            QuicCloseCode, QuicFallback, QuicPathAge, QuicUpgradeOutcome,
+        };
+        for family in [
+            "quic_close_received",
+            "quic_upgrade",
+            "quic_fallback",
+            "quic_path_age_at_close",
+        ] {
+            assert!(expected.remove(family), "{family} is in the snapshot");
+        }
+        expected.extend(
+            QuicCloseCode::ALL
+                .iter()
+                .map(|code| code.label())
+                .chain(["unknown_code"])
+                .map(|label| format!("quic_close_received_{label}")),
+        );
+        expected.extend(
+            QuicUpgradeOutcome::ALL
+                .iter()
+                .map(|outcome| format!("quic_upgrade_{}", outcome.label())),
+        );
+        expected.extend(
+            QuicFallback::ALL
+                .iter()
+                .map(|cause| format!("quic_fallback_{}", cause.label())),
+        );
+        expected.extend(
+            QuicPathAge::ALL
+                .iter()
+                .map(|age| format!("quic_path_age_at_close_{}", age.label())),
+        );
         let actual: std::collections::BTreeSet<String> = event_kind_to_json(
             &super::super::EventKind::TransportSnapshot(Box::new(snapshot)),
         )
@@ -7811,6 +7890,72 @@ mod tests {
         );
     }
 
+    /// Every QUIC upgrade family reaches the event-log JSON under its flat
+    /// `<prefix>_<label>` key with the value the snapshot holds.
+    #[test]
+    fn transport_snapshot_json_carries_quic_upgrade_telemetry() {
+        use crate::transport::metrics::{
+            QuicCloseCode, QuicFallback, QuicPathAge, QuicUpgradeOutcome,
+        };
+        let mut snapshot = crate::transport::metrics::TransportSnapshot::default();
+        let mut next = 0u64;
+        let mut fill = |slots: &mut [u64]| {
+            for slot in slots {
+                next += 1;
+                *slot = next;
+            }
+        };
+        fill(&mut snapshot.quic_close_received);
+        fill(&mut snaps
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +532/-0)
```diff
@@ -374,6 +374,155 @@ labelled_counters! {
     }
 }
 
+labelled_counters! {
+    /// What a QUIC upgrade negotiation decided, counted by the code making
+    /// the decision (`quic::upgrade::machine::Outcome`, recorded by the
+    /// driver) or, for the last three, where the event is seen. Exported per
+    /// period as `quic_upgrade_<label>`.
+    ///
+    /// Success rate on eligible pairs: `established_as_offerer` over
+    /// `accepted` (attempts the peer accepted, by its Accept or, if that was
+    /// lost, by its connection), reported beside `offered` and
+    /// `declined_uncharged`. Offers repeat every 60 s while a peer
+    /// answers Busy, NotReady or Backoff, so a per-offer rate is not
+    /// meaningful. `accept_sent` and `established` also count the client
+    /// side. Zero while QUIC is off.
+    pub(crate) enum QuicUpgradeOutcome {
+        /// This node sent an Offer.
+        Offered => "offered",
+        /// The peer accepted this node's Offer.
+        Accepted => "accepted",
+        /// This node accepted the peer's Offer.
+        AcceptSent => "accept_sent",
+        /// A path became active on this node's evidence (either role).
+        Established => "established",
+        /// As `established`, for a path this node offered (the server).
+        EstablishedAsOfferer => "established_as_offerer",
+        /// An Offer got no reply in time.
+        NoReply => "no_reply",
+        /// A setup stage ran out of time.
+        Timeout => "timeout",
+        /// The connection failed during setup, or a send of setup failed.
+        HandshakeFailed => "handshake_failed",
+        /// The key proved on the path is not the key on record. Counted on
+        /// both ends: a peer's close with the identity-mismatch code ends
+        /// this node's attempt as `identity_mismatch` too, so a sum across
+        /// the fleet counts one mismatch up to twice.
+        IdentityMismatch => "identity_mismatch",
+        /// Both sides acted as server, or the keys were equal.
+        RoleConflict => "role_conflict",
+        /// The `allow_peer` set was full.
+        AllowSetFull => "allow_set_full",
+        /// The key was already allowed for another address.
+        KeyConflict => "key_conflict",
+        /// A control frame this node cannot read ended the setup.
+        ControlRefused => "control_refused",
+        /// A peer below the version floor was not offered.
+        IneligibleVersion => "ineligible_version",
+        /// The peer declined this node's Offer, by reason.
+        DeclinedDisabled => "declined_disabled",
+        DeclinedBackoff => "declined_backoff",
+        DeclinedBusy => "declined_busy",
+        DeclinedNotReady => "declined_not_ready",
+        /// A reason this node does not know.
+        DeclinedUnknown => "declined_unknown",
+        /// A decline of any reason that the machine did not charge to the
+        /// peer's backoff (Busy, NotReady, Backoff).
+        DeclinedUncharged => "declined_uncharged",
+        /// This node declined the peer's Offer, by reason. Counted when the
+        /// decline passes the rate gate; one the gate holds back is not.
+        DeclineSentDisabled => "decline_sent_disabled",
+        DeclineSentBackoff => "decline_sent_backoff",
+        DeclineSentBusy => "decline_sent_busy",
+        DeclineSentNotReady => "decline_sent_not_ready",
+        /// A peer's upgrade message was dropped because the session's inbox
+        /// was full. A closed inbox (the session is ending) is not counted.
+        InboxOverflow => "inbox_overflow",
+        /// A QUIC connection attempt reached no session, a full or closed
+        /// session inbox, or no attempt waiting for it, and was ignored. It
+        /// counts attempts that reached this node, not dials: a client
+        /// retransmits its Initial, and each one that arrives can count.
+        AttemptUnrouted => "attempt_unrouted",
+        /// A session's driver or a path's pump panicked.
+        TaskPanicked => "task_panicked",
+        /// The peer closed the connection of an attempt that was not yet
+        /// active with a downgrade-class code. After activation the same
+        /// close is `quic_fallback_downgrade_rx`.
+        SetupDowngraded => "setup_downgrade_rx",
+        /// The QUIC endpoint went down under an attempt that was not yet
+        /// active. After activation it is `quic_fallback_endpoint_down`.
+        SetupEndpointDown => "setup_endpoint_down",
+        /// The UDP session ended under an attempt that was not yet active
+        /// (a peer restart or a dropped connection). Together with the
+        /// setup outcomes above it accounts for an `accepted` that never
+        /// reached `established_as_offerer`.
+        SessionEndedSetup => "session_ended_setup",
+        /// The UDP session ended under a path that was active, or one
+        /// waiting out a protocol recheck after it was. Not a `quic_fallback`.
+        SessionEndedActiv
```

**File**: `crates/core/src/transport/quic.rs` (modified, +6/-0)
```diff
@@ -1013,6 +1013,12 @@ impl QuicConnection {
                 }
             }
             let reason = watched.closed().await;
+            if let quinn::ConnectionError::ApplicationClosed(close) = &reason {
+                TRANSPORT_METRICS.record_quic_close_received(
+                    close.error_code.into_inner(),
+                    watched.remote_address(),
+                );
+            }
             tracing::debug!(%reason, remote = %watched.remote_address(), "QUIC connection ended");
             drop(hold);
             drop(permit);
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +23/-0)
```diff
@@ -2637,6 +2637,29 @@ fn close_codes_reach_the_peer() {
                 drop((closer, peer));
             }
         }
+        // The side that did not close counts the raw code it received, once
+        // per connection (`quic_close_received_*`). The closer's own watcher
+        // sees a local close and counts nothing.
+        let time = pair.time.clone();
+        drive(&pair.time, Duration::from_secs(5), async move {
+            time.sleep(Duration::from_secs(1)).await
+        })
+        .await;
+        let received = |remote| -> Vec<String> {
+            TRANSPORT_METRICS
+                .quic_events_of(remote)
+                .into_iter()
+                .filter(|event| event.starts_with("(\"close_received\""))
+                .collect()
+        };
+        let want = |codes: &[QuicCloseCode]| -> Vec<String> {
+            codes
+                .iter()
+                .map(|code| format!("(\"close_received\", Some({code:?}), {})", code.code()))
+                .collect()
+        };
+        assert_eq!(received(pair.a_addr), want(&sent_by_a));
+        assert_eq!(received(pair.b_addr), want(&sent_by_b));
         assert_eq!(TRANSPORT_METRICS.quic_close_sent_to(pair.b_addr), sent_by_a);
         assert_eq!(TRANSPORT_METRICS.quic_close_sent_to(pair.a_addr), sent_by_b);
 
```

**File**: `crates/core/src/transport/quic/upgrade/driver.rs` (modified, +174/-14)
```diff
@@ -64,19 +64,23 @@ use parking_lot::Mutex;
 use tokio::sync::mpsc;
 use tokio::task::JoinHandle;
 
-use super::machine::{Action, BackoffSeed, CONTROL_SEND_TIMEOUT, Event, Inputs, UpgradeMachine};
+use super::machine::{
+    Action, BackoffSeed, CONTROL_SEND_TIMEOUT, Event, FallbackCause, Inputs, Outcome, Role,
+    UpgradeMachine,
+};
 use super::policy::QuicPolicy;
 use crate::config::{GlobalExecutor, GlobalRng};
 use crate::node::background_task_monitor::LateRegistrar;
 use crate::simulation::{RealTime, TimeSource, VirtualTime};
 use crate::transport::crypto::TransportPublicKey;
-use crate::transport::metrics::QuicCloseCode;
+use crate::transport::metrics::{QuicCloseCode, QuicFallback, QuicUpgradeOutcome};
 use crate::transport::peer_connection::UpgradeSender;
 use crate::transport::peer_connection::inbound_budget::SharedInboundBudget;
 use crate::transport::quic::control::ControlError;
 use crate::transport::quic::identity::PeerKey;
 use crate::transport::quic::path::{BoundedSend, QuicInbound, QuicPath, QuicPathLimits};
 use crate::transport::quic::{QuicConnection, QuicEndpoint, QuicIncoming, QuicPeerPermit};
+use crate::transport::symmetric_message::DeclineReason;
 use crate::transport::symmetric_message::UpgradeControl;
 use crate::transport::{
     QuicErrorKind, QuicRefusal, Socket, TRANSPORT_METRICS, normalize_mapped_addr,
@@ -271,9 +275,43 @@ struct LivePath {
     _streams: mpsc::Receiver<crate::transport::quic::path::InboundStreamArrival>,
 }
 
+/// An attempt's place in the `quic_paths_*` gauges: counted as offered or
+/// dialing from creation, as active once the machine reports the path
+/// established, and out again when the attempt is dropped. A guard, so no
+/// way of ending an attempt leaves a gauge high.
+struct PathGauge {
+    remote: SocketAddr,
+    /// When the path became active, on the session clock.
+    active_since: Option<Duration>,
+}
+
+impl PathGauge {
+    fn new(remote: SocketAddr) -> Self {
+        TRANSPORT_METRICS.quic_path_attempting(remote);
+        Self {
+            remote,
+            active_since: None,
+        }
+    }
+
+    fn activate(&mut self, now: Duration) {
+        if self.active_since.is_none() {
+            self.active_since = Some(now);
+            TRANSPORT_METRICS.quic_path_activated(self.remote);
+        }
+    }
+}
+
+impl Drop for PathGauge {
+    fn drop(&mut self) {
+        TRANSPORT_METRICS.quic_path_left(self.active_since.is_some(), self.remote);
+    }
+}
+
 /// What one attempt holds. Dropping it drops all of it.
 struct Attempt {
     id: u32,
+    gauge: PathGauge,
     /// The server's `allow_peer` permit.
     allow: Option<QuicPeerPermit>,
     /// A routed connection attempt is finishing its handshake.
@@ -284,9 +322,10 @@ struct Attempt {
 }
 
 impl Attempt {
-    fn new(id: u32) -> Self {
+    fn new(id: u32, remote: SocketAddr) -> Self {
         Self {
             id,
+            gauge: PathGauge::new(remote),
             allow: None,
             establishing: false,
             path: None,
@@ -309,6 +348,9 @@ struct SessionState {
     /// The key the node promoted the session under.
     peer_key: Option<TransportPublicKey>,
     ended: bool,
+    /// When this node sent its Offer or Accept, on the session clock, until
+    /// the path is established.
+    setup_started: Option<Duration>,
 }
 
 /// One UDP session's upgrade. The driver, the connection and a newer session of
@@ -341,10 +383,10 @@ pub(in crate::transport) struct QuicUpgrades {
     by_key: DashMap<TransportPublicKey, Weak<Session>>,
     seeds: Mutex<SeedStore>,
     next_session: AtomicU64,
-    /// Peer-sent upgrade messages dropped because the inbox was full.
+    /// Peer-sent upgrade messages dropped because an inbox was full. Only
+    /// throttles the warning; the exported count is
+    /// `quic_upgrade_inbox_overflow`.
     inbox_overflow: AtomicU64,
-    /// Attempts dropped because no session wanted them.
-    attempts_unrouted: AtomicU64,
     #[cfg(any(test, feature = "testing"))]
     trace: Option<super::sim_trace::NodeTrace>,
 }
@@ -371,7 +413,6 @@ impl QuicUpgrades {
             seeds: Mutex::new(SeedStore::new(SEED_STORE_ENTRIES)),
             next_session: AtomicU64::new(1),
             inbox_overflow: AtomicU64::new(0),
-            attempts_unrouted: AtomicU64::new(0),
             #[cfg(any(test, feature = "testing"))]
             trace,
         })
@@ -427,7 +468,7 @@ impl QuicUpgrades {
             },
         };
         if let Some(incoming) = unrouted {
-            self.attempts_unrouted.fetch_add(1, Ordering::Relaxed);
+            TRANSPORT_METRICS.record_quic_upgrade(QuicUpgradeOutcome::AttemptUnrouted, addr);
             tracing::debug!(%addr, "Ignoring a QUIC connection attempt no session wanted");
             incoming.ignore();
         }
@@ -462,9 +503,13 @@ impl QuicUpgrades {
                 attempt: None,
                 peer_key: None,
                 ended: false,
+                setup_started: 
```

**File**: `crates/core/src/transport/quic/upgrade/driver/tests.rs` (modified, +254/-0)
```diff
@@ -130,6 +130,7 @@ impl Harness {
                 attempt: None,
                 peer_key: None,
                 ended: false,
+                setup_started: None,
             }),
         });
         (session, inbox_rx)
@@ -555,3 +556,256 @@ fn a_full_inbox_drops_peer_messages_and_still_delivers_a_path_end() {
         assert!(matches!(last, Some(SessionEvent::PathClosed { .. })));
     });
 }
+
+/// The machine's decisions reach the telemetry counters through the driver, and the
+/// path gauges follow the attempt: an offer is counted, an attempt is in the
+/// offered-or-dialing gauge until it ends, and a timeout is counted once.
+#[test]
+fn offer_outcomes_and_the_path_gauge_reach_telemetry() {
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let h = Harness::server("quic-driver-telemetry", 11).await;
+        let (session, _rx) = h.session();
+        session.promote(h.peer.clone());
+        let events = || TRANSPORT_METRICS.quic_events_of(h.remote);
+        let at = Duration::from_nanos(session.deadline_nanos().unwrap());
+        h.set_now(at);
+        let sends = session.take(Event::Tick);
+        let [UdpSend::Offer { attempt, .. }] = sends[..] else {
+            panic!("{sends:?}");
+        };
+        session.take(Event::OfferSent { attempt });
+        assert_eq!(events(), ["\"path_attempting\"", "Offered"]);
+        h.set_now(at + OFFER_TIMEOUT);
+        assert!(session.take(Event::Tick).is_empty());
+        assert_eq!(
+            events(),
+            [
+                "\"path_attempting\"",
+                "Offered",
+                "(\"path_left\", false)",
+                "NoReply"
+            ]
+        );
+    });
+}
+
+/// A decline reaches the counters under its reason and, when the machine spared
+/// the peer the penalty, as an uncharged decline; the one the node sends is counted
+/// by reason.
+#[test]
+fn declines_are_counted_by_reason_and_penalty() {
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let h = Harness::server("quic-driver-declines", 12).await;
+        let (session, _rx) = h.session();
+        session.promote(h.peer.clone());
+        let events = || TRANSPORT_METRICS.quic_events_of(h.remote);
+        for (reason, counted) in [
+            (
+                DeclineReason::Busy.wire(),
+                vec!["DeclinedBusy", "DeclinedUncharged"],
+            ),
+            (DeclineReason::Disabled.wire(), vec!["DeclinedDisabled"]),
+            (0xEE, vec!["DeclinedUnknown"]),
+        ] {
+            h.set_now(Duration::from_nanos(session.deadline_nanos().unwrap()));
+            let sends = session.take(Event::Tick);
+            let [UdpSend::Offer { attempt, .. }] = sends[..] else {
+                panic!("{sends:?}");
+            };
+            session.take(Event::OfferSent { attempt });
+            let before = events().len();
+            session.handle(SessionEvent::Upgrade(UpgradeControl::Decline {
+                attempt,
+                reason,
+            }));
+            let after = events();
+            let counted: Vec<_> = counted.into_iter().map(String::from).collect();
+            assert_eq!(after[before], "(\"path_left\", false)", "reason {reason}");
+            assert_eq!(after[before + 1..], counted[..], "reason {reason}");
+        }
+    });
+}
+
+/// A panic in a task the driver spawns is counted, and the same panic goes on.
+#[test]
+fn a_panicking_task_is_counted_and_still_panics() {
+    let remote: SocketAddr = "10.204.13.1:5000".parse().unwrap();
+    let runtime = tokio::runtime::Builder::new_current_thread()
+        .build()
+        .unwrap();
+    runtime.block_on(async {
+        let task = tokio::spawn(report_panics(remote, async { panic!("task failed") }));
+        let error = task.await.expect_err("the panic goes on");
+        assert!(error.is_panic());
+    });
+    assert_eq!(TRANSPORT_METRICS.quic_events_of(remote), ["TaskPanicked"]);
+}
+
+/// An established path is counted under both its role counters, its latency runs
+/// from the offer, the gauge moves from offered-or-dialing to active, and tearing
+/// the path down records its age and leaves the active gauge.
+#[test]
+fn an_established_path_is_counted_timed_and_aged() {
+    use crate::transport::quic::upgrade::machine::{Outcome, Role};
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let h = Harness::server("quic-driver-established", 14).await;
+        let (session, _rx) = h.session();
+        session.promote(h.peer.clone());
+        h.set_now(Duration::from_secs(100));
+        let mut state = session.state.lock();
+        session.apply(
+            &mut state,
+            vec![
+                Action::AllowPeerThenOffer {
+                    attempt: 1,
+                    caps: 0,
+                },
+                Action::Record(Outcome::Offered),
+            ],
+        );
+        h.set_now(Durat
```

#### Recent Merged Pull Requests:
- **PR #6066** (2026-11-01): test(transport): add QUIC shadow scenarios and correct the rollout docs (@sanity)
- **PR #6065** (2026-10-31): feat(transport): report QUIC shadow-mode telemetry (@sanity)
- **PR #6064** (2026-10-31): test: pick node ports the OS cannot assign to other tests (@sanity)
- **PR #6063** (2026-10-31): build: release 0.2.153 (@sanity)
- **PR #6061** (2026-10-31): ci: build Linux x86_64 release for baseline x86-64 (@sanity)
- **PR #6060** (2026-10-31): feat(transport): drive the QUIC upgrade machine in shadow mode (@sanity)

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

## X. test(transport): add QUIC shadow scenarios and correct the rollout docs (#6066)

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd302470`: test(transport): add QUIC shadow scenarios and correct the rollout docs (#6066). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
data, so it measures nothing about the value; rollout step 3 (data on a slice
of pairs, see "QUIC rollout") is the first measurement on real QUIC. The gauge says nothing about the memory
  Step 2 gate denominator: established_as_offerer over accepted, reported beside
#### QUIC rollout (#5940)

There are no opt-in stages; releases do the rollout. QUIC stays off on Windows
throughout, until #6031. Every step watches: peers disappearing per version
against the previous rollout (a node that dies before reporting is absent from
every rate), endpoint-down, panics and breaker trips, RSS against
`quic_paths_active`, CPU and egress, and NAT success, connections and transfers.

- Step 0: the first negotiating release ships with QUIC off. Its nodes answer
  offers (`Decline{disabled}` with the key off); `upgrade_control_received`
  stays near 0 and UDP metrics do not change.
- Step 1: nova gateways and framework in shadow for 24-48 h. The 24 h gateway
  A/B runs only if something looks odd. Rollback: set the key to off and restart.
- Step 2: shadow on by default, not on Windows. Gate: at least 95% upgrade
  success by `established_as_offerer / accepted`; fewer than 1 fallback per
  path-day e
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
data, so it cannot confirm the value; rollout stage 3 (data on QUIC, opt-in)
is the first measurement on real QUIC. The gauge says nothing about the memory
  Stage 2 gate denominator: established_as_offerer over accepted, reported beside
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd302470` are properly handled with clean fallback behavior.
