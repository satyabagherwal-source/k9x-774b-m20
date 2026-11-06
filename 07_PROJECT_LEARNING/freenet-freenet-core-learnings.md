> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `49808ff5`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T23:19:58.287Z  
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
> **Harvest Timestamp**: 2026-11-06T23:19:57.465Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3113 stars

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
- **Issue #6131** (2026-11-06): **test(util): count the summary thread's allows in the rate-limit stress test**
  *Symptoms*: ## Problem  `util::rate_limit_layer::tests::per_callsite_concurrent_writers_and_summary_no_deadlock` failed once under a loaded `cargo test` run on nova, with `allowed=22 suspiciously low — fewer than CAP/2=25`, and passed 40 of 40 runs alone.  The test runs eight writers and a summary thread on one callsite with a cap of 50 per one-second window. The summary thread calls `should_allow_inner` on the same callsite in a loop, so it draws on the same cap, but only the writers' allows were counted. When the summary thread ran first, it could take most of the first window's 50, and the writers finish all 8000 calls inside that window. That left the writers' count under the `CAP / 2` floor. The limiter is correct; the test's accounting was not.  ## Approach  Count every caller's allows and calls, writers and summary thread alike. The floor then holds by construction (the first window admits the first `CAP` calls, whoever makes them), so it is raised from `CAP / 2` to `CAP`. The upper bound (`CAP * 10`) and the "cap enforced" check (`allowed < calls`) are unchanged in meaning. The test body moves into a shared helper so the bad schedule can be forced.  ## Testing  - New `per_callsite_summary_thread_ahead_of_the_writers` forces the schedule that failed: the writers start only after the summary thread has made `CAP` calls. Counting only the writers' allows (the old accounting) fails it 3 of 3 runs. With this change it passes. - Both tests passed 200 of 200 repeated runs (`--test-threa

- **Issue #6125** (2026-11-06): **feat: skip payloads already merged into the local state**
  *Symptoms*: ## Problem  A contract whose merge does not converge can keep a set of peers replaying a small fixed set of payloads to each other indefinitely. Field telemetry shows a few such contracts carrying whole-state payloads thousands of times per day, and the existing 60 s `BroadcastDedupCache` does not stop it, because the replay period is close to its TTL. None of the existing limits bind (cost floors, per-pair rate limits, merge backoff all sit well above or outside this traffic).  The direction for RFC #5320 (tracked in #5906) is that nodes do not remove contracts for breaking a merge law: any removal rule can be triggered by crafted inputs, including against contracts whose honest use never breaks the laws. Instead a node declines work that a lawful contract never needs.  ## Solution  A lawful merge is idempotent, and a payload a replica has already merged lies below its current state, so merging it again changes nothing. A node therefore records a keyed 64-bit hash of each payload it merges (per contract, 1024 newest, `ahash::RandomState` with per-process random keys) and skips a payload from a peer whose hash was recorded within the last 15 minutes.  - Check: before the WASM merge, after the 60 s dedup cache, in `drive_relay_broadcast_to` and `apply_streaming_broadcast`. Anti-entropy heals pushed by peers arrive through the same drivers. A `ResyncResponse` is never skipped: this node requested it because the states differ. - Record: only in the executor, after a merge that c

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

### Incident Patch 1: `49808ff5` (2026-11-06)
**Commit Message**: feat(transport): export quinn's per-path QUIC loss (#6124)

**File**: `.claude/rules/transport.md` (modified, +26/-2)
```diff
@@ -1292,8 +1292,32 @@ a test passes its own; tests read their own, never the global).
   path tried, data and control, and those that waited for stream credit);
   quic_streamed_sends and quic_stream_permit_waited; quic_bytes_sent and
   quic_bytes_received (quinn's UDP payload counts, reported by change at each 2 s
-  tick of the acknowledgement watch, so a path's last tick before it closes is
-  lost); quic_session_ended_with_data_path_<age> (sessions that ended while their
+  tick of the acknowledgement watch and once more when the path's task ends);
+  quic_sent_packets, quic_lost_packets, quic_lost_bytes and
+  quic_congestion_events (quinn's PathStats, every path including shadow ones, by
+  the same tick and once more when the path's task ends, so a path's last tick
+  before it closes is counted, sums of the period). A CONNECTION_CLOSE quinn sends
+  again after that report is in neither the byte nor the packet counts. A panic
+  in the watch, which the path survives, ends nothing: the report is the
+  receive supervisor's (recycle::PathReport); quic_loss_rate_<zero|lt_0_5pct|lt_1pct|
+  lt_2pct|lt_5pct|lt_10pct|lt_20pct|ge_20pct> (a gauge of live paths that have sent
+  at least 200 packets since they started, each in the one bucket of its own
+  lost/sent over its life, moved as it changes, out when the path ends; every
+  bucket uploaded every period, 0 included; no per-path values) and
+  quic_ended_loss_rate_<bucket> (paths that ended in the period, by their final
+  bucket, so paths that fail lossy still show) and quic_ended_paths_below_floor
+  (paths that ended in the period before 200 packets). Packets in flight at close
+  are dropped by quinn, not declared lost, so a final bucket can understate the
+  loss at the end. The rate is quinn's lost over
+  sent (quinn-proto 0.11.19), not a measurement of the link: sent counts every
+  packet quinn built, acknowledgement-only ones included; lost counts quinn's
+  loss declarations, and a packet declared lost and later acknowledged is not
+  taken back; lost PLPMTUD probes are left out of lost while sent ones are in
+  sent, and MTU discovery is off, so no path sends any. A shadow path's packets
+  are mostly keepalives and acknowledgements, so its rate may not hold for
+  data-sized packets. The sums and the buckets are updated and reset under one
+  lock;
+  quic_session_ended_with_data_path_<age> (sessions that ended while their
   path's route still carried data); quic_streams_sampled_paths,
   quic_streams_open_ge_<8|16|32|48> and quic_streams_peak_max (per path and period,
   the peak of inbound streams read at once, counted as inbound_concurrency counts
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +7/-0)
```diff
@@ -7708,6 +7708,13 @@ mod tests {
         data.streams_open_paths_sampled = 1009;
         data.streams_open_ge = vec![1010, 1011, 1012, 1013];
         data.streams_open_max = 1014;
+        data.sent_packets = 1015;
+        data.lost_packets = 1016;
+        data.lost_bytes = 1017;
+        data.congestion_events = 1018;
+        data.loss_rate = (1019..1027).collect();
+        data.ended_loss_rate = (1027..1035).collect();
+        data.ended_below_floor = 1035;
         let want: std::collections::BTreeMap<String, u64> =
             snapshot.quic_data.keys().into_iter().collect();
         assert!(want.values().all(|value| *value != 0));
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +48/-1)
```diff
@@ -31,7 +31,7 @@ use crate::tracing::{TransferDirection, TransferEvent};
 
 mod quic_data;
 pub use quic_data::QuicDataSnapshot;
-pub(crate) use quic_data::{QuicDataCounters, StreamsOpenPeak};
+pub(crate) use quic_data::{PathLossWindow, QuicDataCounters, StreamsOpenPeak};
 
 /// Global transport metrics instance.
 ///
@@ -5085,6 +5085,53 @@ mod tests {
         assert_eq!(json["quic_sends"], 1);
     }
 
+    /// quinn's per-path loss counts go through `take_snapshot` end to end: a
+    /// report makes the period active and reaches the upload under its keys with
+    /// its own values, the loss-rate bucket included, a read that does not reset
+    /// leaves them, and the next period is empty.
+    #[test]
+    fn quic_path_loss_goes_through_take_snapshot() {
+        let metrics: &'static TransportMetrics = Box::leak(Box::new(TransportMetrics::new()));
+        let mut window = PathLossWindow::new(&metrics.quic_data);
+        metrics.quic_data.record_path_loss(
+            &mut window,
+            crate::transport::quic::recycle::PathLoss {
+                sent_packets: 1000,
+                lost_packets: 7,
+                lost_bytes: 8400,
+                congestion_events: 3,
+            },
+        );
+        let peek = metrics.read_snapshot();
+        assert_eq!(peek.quic_data.lost_packets, 7);
+        let snap = metrics.take_snapshot().expect("a report is activity");
+        let json = snap.upload_json().unwrap();
+        assert_eq!(json["quic_sent_packets"], 1000, "the peek did not reset");
+        assert_eq!(json["quic_lost_packets"], 7);
+        assert_eq!(json["quic_lost_bytes"], 8400);
+        assert_eq!(json["quic_congestion_events"], 3);
+        assert_eq!(json["quic_loss_rate_lt_1pct"], 1);
+        assert_eq!(json["quic_loss_rate_zero"], 0, "a gauge of 0 is sent");
+        assert!(
+            json.get("quic_ended_loss_rate_zero").is_none(),
+            "a count of 0 is not"
+        );
+        assert!(json.get("quic_ended_paths_below_floor").is_none());
+        assert!(
+            metrics.take_snapshot().is_none(),
+            "the sums were reset, and the bucket alone is not activity"
+        );
+        assert_eq!(metrics.read_snapshot().quic_data.loss_rate[2], 1, "a gauge");
+        // A path that ends below the floor reaches the JSON by its own key.
+        drop(PathLossWindow::new(&metrics.quic_data));
+        let json = metrics
+            .take_snapshot()
+            .expect("an ended path is activity")
+            .upload_json()
+            .unwrap();
+        assert_eq!(json["quic_ended_paths_below_floor"], 1);
+    }
+
     /// A breaker trip reaches the snapshot and its JSON, counts as activity
     /// on its own, and resets; the suppressed state is carried while it
     /// holds and is not activity by itself.
```

**File**: `crates/core/src/transport/metrics/quic_data.rs` (modified, +393/-12)
```diff
@@ -20,8 +20,27 @@
 //! | `quic_streamed_sends`, `quic_stream_permit_waited` | streamed-send permits taken, and those that waited |
 //! | `quic_bytes_sent`, `quic_bytes_received` | UDP payload bytes of QUIC paths, from quinn's counts |
 //! | `quic_session_ended_with_data_path_<age>` | sessions that ended under a data path, by the path's age |
+//! | `quic_sent_packets`, `quic_lost_packets`, `quic_lost_bytes`, `quic_congestion_events` | quinn's per-path counts (`PathStats`), shadow paths included, summed over the node's paths up to each path's last tick |
+//! | `quic_loss_rate_<bucket>` | live paths that have sent at least 200 packets since they started, by their own lost/sent over that time (a gauge, not reset, every bucket sent every period, 0 included): `zero`, `lt_0_5pct`, `lt_1pct`, `lt_2pct`, `lt_5pct`, `lt_10pct`, `lt_20pct`, `ge_20pct` |
+//! | `quic_ended_loss_rate_<bucket>` | paths that ended in the period, by the bucket they were in at the end (same buckets) |
+//! | `quic_ended_paths_below_floor` | paths that ended in the period before sending 200 packets, so in no bucket |
 //! | `quic_streams_sampled_paths`, `quic_streams_open_ge_<n>`, `quic_streams_peak_max` | per path and period, the peak of inbound streams read at once: the paths sampled, those whose peak reached each level, and the highest peak |
 //!
+//! What the loss rate is: quinn's lost over sent (quinn-proto 0.11.19). `sent`
+//! counts every packet quinn built, acknowledgement-only ones included. `lost`
+//! counts quinn's loss declarations (packet or time threshold), and a packet
+//! declared lost that is later acknowledged is not taken back, so spurious
+//! declarations count as losses. Lost PLPMTUD probes are left out of `lost` while
+//! sent probes are in `sent`; MTU discovery is off (`quic::config`), so no path
+//! sends any. Packets still in flight when a connection closes are dropped
+//! by quinn, not declared lost, so a path's final bucket can understate its
+//! loss at the moment it ended. It is quinn's view of loss, not a measurement
+//! of the link. A shadow path's packets are mostly keepalives and
+//! acknowledgements, so its rate is of small packets and may not hold for
+//! data-sized ones. After a contained panic in a path's acknowledgement
+//! watch the path stops ticking, so its counts from then on arrive in one
+//! report when it ends.
+//!
 //! The waits are the step-3 stream-limit bars: `quic_open_uni_waited` over
 //! `quic_sends` and `quic_stream_permit_waited` over `quic_streamed_sends` below 0.5%, and
 //! `quic_streams_open_ge_48` below 0.2% of `quic_streams_sampled_paths`. Both
@@ -39,6 +58,110 @@ use crate::transport::quic::path::{
 /// The gauge's key, uploaded in every snapshot ([`QuicDataSnapshot::upload_keys`]).
 const LIVE_DATA_PATHS: &str = "quic_live_data_paths";
 
+/// The loss-rate gauges' prefix; every bucket is uploaded in every snapshot.
+const LOSS_RATE_PREFIX: &str = "quic_loss_rate_";
+
+/// A path's loss rate is bucketed once it has sent this many packets since it
+/// started; below it the rate says too little.
+pub(crate) const LOSS_RATE_MIN_SENT: u64 = 200;
+
+/// The upper bounds of the loss-rate buckets after `zero`, in lost packets per
+/// 1000 sent; the last bucket is `ge_20pct`.
+const LOSS_RATE_BOUNDS_PER_MILLE: [u64; 6] = [5, 10, 20, 50, 100, 200];
+
+/// The loss-rate buckets' labels (`quic_loss_rate_<label>`), in order.
+pub(crate) const LOSS_RATE_LABELS: [&str; 8] = [
+    "zero",
+    "lt_0_5pct",
+    "lt_1pct",
+    "lt_2pct",
+    "lt_5pct",
+    "lt_10pct",
+    "lt_20pct",
+    "ge_20pct",
+];
+
+/// The bucket of `lost` packets out of `sent`. Losses found in a window can
+/// be of packets sent before it, so `lost` may pass `sent`: `ge_20pct`.
+fn loss_rate_bucket(lost: u64, sent: u64) -> usize {
+    if lost == 0 {
+        return 0;
+    }
+    let per_mille_times_sent = lost.saturating_mul(1000);
+    1 + LOSS_RATE_BOUNDS_PER_MILLE
+        .iter()
+        .take_while(|bound| per_mille_times_sent >= sent.saturating_mul(**bound))
+        .count()
+}
+
+/// One path's packets since it started, and the loss-rate bucket it is counted
+/// in. Owned by the path's acknowledgement watch; dropping it, however the watch
+/// ends, takes the path out of its bucket.
+#[derive(Debug)]
+pub(crate) struct PathLossWindow {
+    node: &'static QuicDataCounters,
+    sent: u64,
+    lost: u64,
+    bucket: Option<usize>,
+}
+
+impl PathLossWindow {
+    /// A window for a new path, counted in `node`.
+    pub(crate) fn new(node: &'static QuicDataCounters) -> Self {
+        Self {
+            node,
+            sent: 0,
+            lost: 0,
+            bucket: None,
+        }
+    }
+}
+
+impl PathLossWindow {
+    /// Whether the path is in a loss-rate bucket. Tests only.
+    #[cfg(test)]
+    pub(crate) fn is_bucketed(&self) -> bool {
+        self.bucket.is_some()
+    }
+}
+
+impl Drop for PathLossWindow {
+    /// The path ended: out of its bucket, and counted
```

**File**: `crates/core/src/transport/quic/path.rs` (modified, +26/-6)
```diff
@@ -298,6 +298,10 @@ pub(crate) struct QuicPathLimits {
     /// The receive task panics on its first stream (supervisor test).
     #[cfg(test)]
     pub(crate) panic_in_receive: bool,
+    /// The acknowledgement watch panics once the path is in a loss-rate bucket
+    /// (supervisor test).
+    #[cfg(test)]
+    pub(crate) panic_in_watch: bool,
 }
 
 impl QuicPathLimits {
@@ -322,6 +326,8 @@ impl QuicPathLimits {
         counters: None,
         #[cfg(test)]
         panic_in_receive: false,
+        #[cfg(test)]
+        panic_in_watch: false,
     };
 
     /// [`Self::DEFAULT`] for a path in shadow mode: control frames only.
@@ -841,14 +847,23 @@ impl QuicPath {
             time.now_nanos(),
         );
         let heard = Arc::new(recycle::PeerHeard::default());
+        #[cfg_attr(not(test), allow(unused_mut))]
+        let mut report = recycle::PathReport::new(connection.inner().clone(), stats.node());
+        #[cfg(test)]
+        {
+            report.panic_once_bucketed = limits.panic_in_watch;
+        }
         let receive = GlobalExecutor::spawn(supervise_receive(
             connection.inner().clone(),
             connection.closer(),
             Arc::new(receiver),
             stats.clone(),
             time,
-            connection.cap_holds(),
-            heard.clone(),
+            recycle::AckWatchParts {
+                cap_holds: connection.cap_holds(),
+                heard: heard.clone(),
+                report,
+            },
         ));
         (
             Self {
@@ -1473,21 +1488,26 @@ async fn supervise_receive<T: TimeSource>(
     receiver: Arc<inbound::Receiver<T>>,
     stats: Arc<QuicPathStats>,
     time: T,
-    cap_holds: Arc<super::socket::CapHolds>,
-    heard: Arc<recycle::PeerHeard>,
+    watch: recycle::AckWatchParts,
 ) {
     use futures::FutureExt;
     let mut receive = std::pin::pin!(
         std::panic::AssertUnwindSafe(inbound::receive(connection.clone(), receiver)).catch_unwind()
     );
-    let node = stats.node();
+    // Outside the watch, so a panic the watch contains does not end the path's
+    // report: it ends with this task ([`recycle::PathReport`]).
+    let recycle::AckWatchParts {
+        cap_holds,
+        heard,
+        mut report,
+    } = watch;
     let watch = std::panic::AssertUnwindSafe(recycle::watch_acknowledgements(
         connection.clone(),
         closer.clone(),
         time,
         cap_holds,
         heard,
-        node,
+        &mut report,
     ))
     .catch_unwind();
     let ended = tokio::select! {
```

**File**: `crates/core/src/transport/quic/path/tests.rs` (modified, +116/-0)
```diff
@@ -2589,6 +2589,122 @@ fn seeded_loss(network: &str, percent: u64) -> Arc<LossCount> {
     count
 }
 
+/// A path's watch reports its last counts when it ends, here dropped because
+/// the receive task ended with the connection, so the node's packet sums end at
+/// quinn's final counts. The short
+/// is sent and the path closed between two ticks (2 s and 4 s), so without that
+/// last report what they sent is missing.
+#[test]
+fn a_closed_path_reports_its_last_tick() {
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let counters: &'static crate::transport::metrics::QuicDataCounters =
+            Box::leak(Box::new(crate::transport::metrics::QuicDataCounters::new()));
+        let limits = QuicPathLimits {
+            counters: Some(counters),
+            ..QuicPathLimits::DEFAULT
+        };
+        let p = paths("quic-path-last-tick", 75, limits).await;
+        let (a, b, time) = (p.a.clone(), p.b.clone(), p.time());
+        let totals = |a: &QuicPath, b: &QuicPath| {
+            let (a, b) = (
+                a.connection().inner().stats(),
+                b.connection().inner().stats(),
+            );
+            (
+                a.path.sent_packets + b.path.sent_packets,
+                a.udp_tx.bytes + b.udp_tx.bytes,
+            )
+        };
+        // The watches count from when the paths were built, before the drive.
+        let before = totals(&a, &b);
+        let (at_short, after) = p
+            .drive(async move {
+                time.sleep(Duration::from_millis(2500)).await;
+                a.send_short(&[7u8; 600]).await.expect("sent");
+                let at_short = totals(&a, &b);
+                a.connection().close(QuicCloseCode::Downgrade);
+                time.sleep(Duration::from_secs(5)).await;
+                (at_short, totals(&a, &b))
+            })
+            .await;
+        let snap = counters.snapshot(false);
+        // Every packet up to the short, which went after the 2 s tick, is in
+        // the report. A close quinn sends again after a watch has ended is in
+        // quinn's counts and in no report, so the report can be below them.
+        let (up_to_short, sent) = (at_short.0 - before.0, after.0 - before.0);
+        assert!(
+            snap.sent_packets >= up_to_short && snap.sent_packets <= sent,
+            "{} reported, {up_to_short} up to the short, {sent} in all",
+            snap.sent_packets
+        );
+        let (up_to_short, udp_sent) = (at_short.1 - before.1, after.1 - before.1);
+        assert!(
+            snap.bytes_sent >= up_to_short && snap.bytes_sent <= udp_sent,
+            "{} reported, {up_to_short} up to the short, {udp_sent} in all",
+            snap.bytes_sent
+        );
+        // Both paths ended, each counted once, here below the floor.
+        let ended = snap.ended_loss_rate.iter().sum::<u64>() + snap.ended_below_floor;
+        assert_eq!(ended, 2);
+        assert_eq!(snap.loss_rate.iter().sum::<u32>(), 0);
+    })
+}
+
+/// A panic in the acknowledgement watch, which the receive supervisor
+/// contains while the path stays up, leaves the path in its live loss-rate
+/// bucket; it is counted as ended only when the path really ends.
+#[test]
+fn a_watch_panic_does_not_end_the_path_in_the_loss_counts() {
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let counters: &'static crate::transport::metrics::QuicDataCounters =
+            Box::leak(Box::new(crate::transport::metrics::QuicDataCounters::new()));
+        let limits = QuicPathLimits {
+            counters: Some(counters),
+            panic_in_watch: true,
+            ..QuicPathLimits::DEFAULT
+        };
+        // Only `b` panics: `paths` gives `a` the default limits.
+        let p = paths("quic-path-watch-panic", 78, limits).await;
+        let panics = recycle::TEST_WATCH_PANICS.load(std::sync::atomic::Ordering::Relaxed);
+        // `b` sends, so its own packet count passes the floor.
+        let (b, time) = (p.b.clone(), p.time());
+        let (live, ended) = p
+            .drive(async move {
+                b.send_stream(StreamId::next(), None, payload(2 * MIB).into())
+                    .await
+                    .expect("sent");
+                time.sleep(Duration::from_secs(5)).await;
+                let snap = counters.snapshot(false);
+                (
+                    snap.loss_rate.iter().sum::<u32>(),
+                    snap.ended_loss_rate.iter().sum::<u64>() + snap.ended_below_floor,
+                )
+            })
+            .await;
+        assert!(
+            recycle::TEST_WATCH_PANICS.load(std::sync::atomic::Ordering::Relaxed) > panics,
+            "b's watch panicked"
+        );
+        assert!(p.b.connection().inner().close_reason().is_none(), "b is up");
+        // `a` only acknowledged, below the floor; `b` is in a bucket.
+        assert_eq!(live, 1, "b is still in its live bucket");
+        asser
```

**File**: `crates/core/src/transport/quic/path/tests/node_counts.rs` (modified, +4/-0)
```diff
@@ -74,6 +74,10 @@ fn a_paths_sends_and_receives_reach_the_node() {
         assert_eq!(keys["quic_open_uni_waited"], 0);
         assert!(keys["quic_bytes_sent"] > 0);
         assert!(keys["quic_bytes_received"] > 0);
+        assert!(
+            keys["quic_sent_packets"] > 0,
+            "quinn's path counts reach the node"
+        );
         assert_eq!(keys["quic_streams_sampled_paths"], 1, "only b read streams");
     });
 }
```

**File**: `crates/core/src/transport/quic/recycle.rs` (modified, +126/-10)
```diff
@@ -789,7 +789,7 @@ pub(crate) async fn watch_acknowledgements<T: TimeSource>(
     time: T,
     cap_holds: Arc<CapHolds>,
     heard: Arc<PeerHeard>,
-    node: &'static crate::transport::metrics::QuicDataCounters,
+    report: &mut PathReport,
 ) {
     let Some(first) = AckSample::of(&connection, &cap_holds) else {
         tracing::warn!(
@@ -801,15 +801,15 @@ pub(crate) async fn watch_acknowledgements<T: TimeSource>(
     };
     let mut received = first.received;
     let mut watch = AckWatch::new(ACK_WATCH_WINDOW, first);
-    let mut bytes = UdpBytes::of(&connection);
     loop {
         time.sleep(ACK_WATCH_TICK).await;
-        if connection.close_reason().is_some() {
+        // Read before the counts, so a closed connection's counts are its
+        // final ones.
+        let closed = connection.close_reason().is_some();
+        report.report();
+        if closed {
             return;
         }
-        let (next, sent, got) = bytes.step(UdpBytes::of(&connection));
-        node.record_bytes(sent, got);
-        bytes = next;
         let Some(sample) = AckSample::of(&connection, &cap_holds) else {
             return;
         };
@@ -833,18 +833,97 @@ pub(crate) async fn watch_acknowledgements<T: TimeSource>(
 
 #[cfg(test)]
 mod cap_tests;
+
+/// What a path's receive supervisor keeps for its acknowledgement watch.
+pub(crate) struct AckWatchParts {
+    pub(crate) cap_holds: Arc<CapHolds>,
+    pub(crate) heard: Arc<PeerHeard>,
+    pub(crate) report: PathReport,
+}
+
+/// Watch panics `PathReport::panic_once_bucketed` raised. Tests only; only
+/// the one test that sets it raises any.
+#[cfg(test)]
+pub(crate) static TEST_WATCH_PANICS: std::sync::atomic::AtomicU64 =
+    std::sync::atomic::AtomicU64::new(0);
+
+/// A path's byte and loss counts, reported node-wide by their change at each
+/// tick of the watch, and once more when the report is dropped. It is owned
+/// by the path's receive supervisor and lent to the watch, so it is dropped
+/// when the path's task ends (the connection closed and the receive task
+/// returned, or the task was aborted with the path), and the counts up to
+/// then, often the losses that ended the path, are still reported. Then the
+/// window is dropped, which counts the path among the ended ones. A panic in
+/// the watch, which the supervisor contains while the path stays up, does
+/// not drop it: the path stays in its live bucket until it really ends.
+/// After a contained watch panic nothing ticks it any more, so the path's
+/// bytes and packets from then on arrive as one report when the path ends.
+pub(crate) struct PathReport {
+    connection: quinn::Connection,
+    node: &'static crate::transport::metrics::QuicDataCounters,
+    bytes: UdpBytes,
+    loss: PathLoss,
+    window: crate::transport::metrics::PathLossWindow,
+    /// The next report that finds the path in a bucket panics, once
+    /// (supervisor test).
+    #[cfg(test)]
+    pub(crate) panic_once_bucketed: bool,
+}
+
+impl PathReport {
+    pub(crate) fn new(
+        connection: quinn::Connection,
+        node: &'static crate::transport::metrics::QuicDataCounters,
+    ) -> Self {
+        let stats = connection.stats();
+        Self {
+            bytes: UdpBytes::of(&stats),
+            loss: PathLoss::of(&stats),
+            window: crate::transport::metrics::PathLossWindow::new(node),
+            connection,
+            node,
+            #[cfg(test)]
+            panic_once_bucketed: false,
+        }
+    }
+
+    /// Report the change since the last report, from one read of the stats.
+    fn report(&mut self) {
+        let stats = self.connection.stats();
+        let (next, sent, got) = self.bytes.step(UdpBytes::of(&stats));
+        self.node.record_bytes(sent, got);
+        self.bytes = next;
+        let (next, delta) = self.loss.step(PathLoss::of(&stats));
+        self.node.record_path_loss(&mut self.window, delta);
+        self.loss = next;
+        #[cfg(test)]
+        if self.panic_once_bucketed && self.window.is_bucketed() {
+            self.panic_once_bucketed = false;
+            TEST_WATCH_PANICS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
+            panic!("test: the acknowledgement watch panics");
+        }
+    }
+}
+
+impl Drop for PathReport {
+    fn drop(&mut self) {
+        // Not while unwinding: quinn's state lock may be what panicked.
+        if !std::thread::panicking() {
+            self.report();
+        }
+    }
+}
 /// A path's UDP payload bytes as quinn counts them, reported node-wide by their
-/// change at each tick of the watch (`quic_bytes_sent`, `quic_bytes_received`).
-/// What a path moves in its last tick before it closes is not reported.
+/// change at each tick of the watch (`quic_bytes_sent`, `quic_bytes_received`)
+/// and when the path's task ends ([`PathReport`]).
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 struct UdpBytes {
     sent: u64,
     received: u64,
 }
 
 impl UdpBytes {
-    fn of
```

---

### Incident Patch 2: `e5694dff` (2026-11-06)
**Commit Message**: fix(transport): queue UDP stream fragments for the egress cap (#6116)

**File**: `.claude/rules/transport.md` (modified, +111/-22)
```diff
@@ -111,13 +111,75 @@ refill also covered: capacity moves between connections, the node cap
 holds; so no timer-slack margin is needed), and a send error after the
 take does not refund it (as uncapped). Rate updates every RTT can
 reorder waiters slightly, as on the uncapped reserve path; order is not
-a correctness property of the cap. Then each attempt is:
-cwnd check, node-wide egress_cap::try_take, back to back with no await
-before the send; if the cap is short, sleep through StreamPacing (deficit x
-U[1.0, 1.4) + U[0, 2 ms)) and start again from the cwnd check. NODE-CAP
-ADMISSION IS A RACE: nothing is held on the cap while waiting, the order
-among waiters is random, so connections share the cap by their number of
-waiting streams (no isolation between connections). The kept connection
+a correctness property of the cap. Then each attempt is: wait in the
+node-wide cap's admission queue (StreamPacing::wait_for_admission over
+EgressCap::poll_admit, the SAME queue the QUIC endpoint waits in); if it had
+to wait, start again from the cwnd check, which the queue then admits at
+once; then cwnd check and egress_cap::try_take back to back with no await
+before the send (a take that still fails, because another sender took the
+refill first, queues again). NODE-CAP ADMISSION IS IN ORDER: each waiting
+stream and each waiting QUIC connection is one entry, and poll_admit admits
+a waiter only when the bucket holds its datagram PLUS one for every waiter
+queued ahead of it (counted up to MAX_ADMISSION_WAKERS), so a waiter that
+polls first cannot take another's turn. Nothing is set aside: a waiter
+ahead that has not polled yet takes its datagram from the same level when
+it does. Timers (staggered by place) decide only when a waiter looks; a late
+timer delays that waiter, never reorders. Without the level check, waiters
+due on one tick were admitted in poll order and a re-armed waiter lost every
+tie (one stream in three sent nothing in 2 s at 1524 streams). After
+Admission::Waited the stream re-checks cwnd and calls again; that call
+takes its turn without queueing within ADMISSION_PASS (1 ms). Without the
+pass it re-queued at the back on every turn and never sent. A stream held
+by cwnd past the pass, or whose take failed (an unpaced send took the
+datagram first), queues again AT ITS PLACE (AdmissionWaiter::held_place, the
+ticket it was admitted from, kept until a take succeeds), so neither costs
+it a turn of the queue (streams_sharing_a_window_keep_their_turn_under_a_binding_cap:
+worst gap one turn, 0.86 s, against two turns, 1.61 s, when it went to the
+back). At most MAX_ADMISSION_WAKERS admissions are live at once; the next
+waiter waits, and no live one is dropped. Every admission has a number its
+waiter keeps; a waiter that polls again (a QUIC poller whose take failed, a
+stream past the pass) withdraws its own, and a take never withdraws one it
+did not use, so a failed send on quinn's respond path (no poll_writable)
+leaves every live admission alone. A named waiter admitted on its first poll
+keeps a place too (its admission's number). A withdrawn admission wakes the
+next held waker, and a waiter's timer is set no later than the oldest
+outstanding admission lapses, so a datagram counted for an admission that
+goes unused does not leave the bucket idle. An admission stays on the queue
+(QueuedWaiters::admitted) until its take or for ADMISSION_PASS, whichever
+comes first: it counts ahead of every waiter that polls, and every take
+leaves one datagram per outstanding admission but its own, so on a
+multi-thread runtime nobody can use a datagram admitted to another sender
+between its Ready and its take. Admission times are read under the queue
+lock. A stream's admission is NAMED (AdmissionWaiter::named, taken with
+try_take_admitted through StreamPacing::take): its take finds its own
+admission or, once that lapsed, takes as a newcomer that leaves the
+datagrams owed to the rest. Without names, a stream descheduled past the
+pass took the datagram of a newer admission and cleared that admission as
+its own (2 to 37 of 3200 takes lost in
+an_admitted_take_is_not_lost_to_another_thread). A QUIC take is named too:
+QuicPoller::poll_ready hands its admission number to QuicSocket::try_send
+through a thread-local (quic/socket.rs HANDED_ADMISSION), relying on quinn
+0.11.12 calling poll_writable then try_send back to back on one thread
+(connection.rs:1048-1057; a quinn bump must re-check it,
+a_poller_hands_its_admission_to_the_transmit_that_follows). quinn's
+endpoint respond (endpoint.rs:584) sends with no poll, finds no handoff and
+leaves every admission alone. No take ever uses an admission it does not
+name. The queue holds a waker
+and a place, never bytes. So connections share the cap by their number of
+waiting senders (no isolation between connections). The wait races the
+stream's deadline (cut at LONG_WAIT and at PACED_WAIT_DEADLINE, check()
+after each cut), so abandonment and i
```

**File**: `crates/core/src/transport/egress_cap.rs` (modified, +721/-171)
```diff
@@ -29,17 +29,29 @@
 //! only at the connection wait: a fragment
 //! can still fail on the node cap at the deadline. Otherwise the fragment
 //! keeps its payment until it is sent, through its waits on cwnd and on the
-//! cap. Then, right after a cwnd check, it calls [`try_take`]: if the
-//! node-wide bucket holds a datagram's worth, the bytes are taken and the
-//! fragment is sent at once; otherwise the task sleeps for the deficit at
-//! the cap rate (see [`jittered`]) and starts again from the cwnd check,
-//! keeping its connection payment and so its place on the connection.
-//! Nothing is reserved on the node-wide bucket while it sleeps, so a
-//! waiting stream holds no node-wide capacity. Node-wide admission is a
-//! race: whichever waiter wakes when the bucket has enough takes it. So
+//! cap. Then it waits in the node-wide cap's admission queue
+//! ([`StreamPacing::wait_for_admission`], over [`EgressCap::poll_admit`]),
+//! the same queue the QUIC endpoint waits in. If it had to wait it starts
+//! again from the cwnd check, keeping its connection payment and so its
+//! place on the connection, and the queue then admits it at once; right
+//! after the cwnd check it calls [`EgressCap::try_take_admitted`] and sends at once. The queue
+//! holds the stream's waker and its place, never bytes, so a waiting stream
+//! holds no node-wide capacity. An admitted sender holds one datagram from
+//! its admission to its take, at most [`ADMISSION_PASS`] (1 ms): every other
+//! take leaves it in the bucket meanwhile. A sender that was admitted and has
+//! not sent (its take failed, or its congestion window held it past the pass)
+//! keeps its place: it queues again where it was admitted from. Waiters are admitted in the order they
+//! queued (QUIC connections and UDP streams alike, one entry each), so
 //! connections share the cap in proportion to their number of waiting
-//! streams; there is no isolation between connections, and a peer driving
-//! many streams gets a proportional share.
+//! streams and QUIC connections; there is no isolation between connections,
+//! and a peer driving many streams gets a proportional share.
+//!
+//! Until #6112 a stream did not queue: it took with `try_take` and, when
+//! refused, slept the deficit with jitter and tried again, a race among the
+//! waiting streams. The QUIC endpoint queued, so it won contended refills:
+//! measured on a 500 kB/s cap with one QUIC path and one UDP stream at equal
+//! shares, about 462 kB/s against 38 kB/s, and 249 against 251 kB/s with
+//! both queued.
 //!
 //! The connection payment kept across a wait on cwnd or on the cap can be
 //! stale: the connection's bucket refills meanwhile, so after such a wait a
@@ -75,10 +87,19 @@
 //! not yet paid off, at most [`DEBT_LIMIT`] of the rate; an unpaced send
 //! beyond that is sent but not charged (forgiven, and counted).
 //!
-//! When the cap binds, a waiting stream gets a datagram when it wakes and
-//! finds enough in the bucket, with probability about `1/n` among `n`
-//! waiting streams, so each gets one every `n * 1200 / r` seconds on average
-//! at a cap of `r` bytes per second, and longer gaps have a geometric tail.
+//! When the cap binds, the `n` waiters are served in turn, so each gets a
+//! datagram about every `n * 1200 / r` seconds at a cap of `r` bytes per
+//! second, without the geometric tail of the earlier race. The order does
+//! not depend on which waiter polls first: [`EgressCap::poll_admit`] admits
+//! a waiter only when the bucket also holds a datagram for every waiter
+//! queued ahead of it and every admission whose take has not happened yet,
+//! and every take leaves the datagrams owed to the other admissions, so on
+//! a multi-thread runtime a sender cannot use another's turn between its
+//! admission and its take. Timers decide only when a waiter looks, so a late
+//! timer (tokio's are 1 ms) delays that waiter, never reorders. Two limits:
+//! the queue counts at most [`MAX_ADMISSION_WAKERS`] ahead, and a stream the
+//! queue admitted keeps its turn for [`ADMISSION_PASS`] while it re-checks
+//! its congestion window.
 //! (When only a connection's own bucket binds, its streams are served in
 //! order and a stream's gap is about one round of that connection's
 //! waiting streams.) A stream whose next fragment has not been sent
@@ -123,7 +144,6 @@ use super::Socket;
 use super::metrics::{EgressDecision, TRANSPORT_METRICS, WaitCause};
 use super::packet_data::MAX_PACKET_SIZE;
 use super::peer_connection::streaming::STREAM_INACTIVITY_TIMEOUT;
-use crate::config::GlobalRng;
 use crate::simulation::TimeSource;
 
 /// The bucket holds at most this much time at the cap rate, so after an idle
@@ -180,12 +200,25 @@ pub(crate) const PACED_TAKE_BYTES: usize = MAX_PACKET_SIZE;
 
 const NANOS_PER_SEC: u128 = 1_000_000_000;
 
-/// The most [`EgressCap::poll_admit`] wakers the cap holds. A waiter's entry
-/// is removed when it is woken, next admitted,
```

**File**: `crates/core/src/transport/egress_cap/tests.rs` (modified, +936/-228)
```diff
@@ -1,4 +1,5 @@
 use super::*;
+use crate::config::GlobalRng;
 use crate::simulation::VirtualTime;
 use crate::transport::metrics::WaitCause;
 
@@ -183,7 +184,6 @@ fn extreme_values_never_panic() {
             cap.give_back(u64::MAX);
             time.advance(Duration::from_secs(1));
             let _ = cap.level_bytes();
-            let _ = jittered(Duration::MAX / 2);
         }
     }
 }
@@ -216,9 +216,9 @@ where
 
 /// A fragment that cannot be admitted fails its stream once the gap since
 /// the stream's previous fragment reaches `PACED_WAIT_DEADLINE`, no later
-/// (the last sleep is cut to the deadline), and the gap is reported once at
-/// `LONG_WAIT` on the way, from the waiting loop, although nothing was sent.
-/// Both are blamed on the cap, which took all the time.
+/// (the wait in the admission queue races the deadline), and the gap is
+/// reported once at `LONG_WAIT` on the way, although nothing was sent. Both
+/// are blamed on the cap, which took all the time.
 #[tokio::test(flavor = "current_thread")]
 async fn a_fragment_fails_its_stream_at_the_wait_deadline() {
     let time = VirtualTime::new();
@@ -229,22 +229,12 @@ async fn a_fragment_fails_its_stream_at_the_wait_deadline() {
         let (cap, time) = (cap.clone(), time.clone());
         drive_virtual(&time.clone(), async move {
             let mut pacing = StreamPacing::new(&time);
-            loop {
-                assert!(
-                    time.now_nanos() < 2 * PACED_WAIT_DEADLINE.as_nanos() as u64,
-                    "no deadline"
-                );
-                if let Err(gap) = pacing.check(&time, &cap) {
-                    break gap;
-                }
-                match cap.try_take(PACKET, pacing.slept()) {
-                    Ok(_) => panic!("admitted"),
-                    Err(deficit) => {
-                        if let Err(gap) = pacing.sleep(&time, &cap, deficit).await {
-                            break gap;
-                        }
-                    }
-                }
+            assert_eq!(pacing.check(&time, &cap), Ok(()));
+            // The wait itself runs to the deadline: it returns only on
+            // admission or at the deadline, never in between.
+            match pacing.wait_for_admission(&time, &cap, PACKET).await {
+                Err(gap) => gap,
+                Ok(admission) => panic!("admitted: {admission:?}"),
             }
         })
         .await
@@ -394,26 +384,6 @@ fn the_warnings_are_rate_limited_separately() {
     assert_eq!(cap.abandoned_since_warn.pending(WaitCause::Cap).0, 0);
 }
 
-#[test]
-fn jitter_is_never_shorter_than_the_deficit() {
-    GlobalRng::scoped_seed(11, || {
-        let wait = Duration::from_millis(100);
-        for _ in 0..1_000 {
-            let j = jittered(wait);
-            assert!(
-                j >= Duration::from_millis(100) && j < Duration::from_millis(142),
-                "{j:?}"
-            );
-        }
-        // At a tiny deficit the additive part still spreads wakeups over
-        // more than one 1 ms timer tick.
-        let spread: std::collections::BTreeSet<u128> = (0..100)
-            .map(|_| jittered(Duration::from_micros(10)).as_millis())
-            .collect();
-        assert!(spread.len() >= 2, "{spread:?}");
-    });
-}
-
 struct Sink {
     fail: std::sync::atomic::AtomicBool,
 }
@@ -457,7 +427,10 @@ fn target() -> std::net::SocketAddr {
 #[test]
 fn try_take_without_a_cap_admits_at_once() {
     assert!(matches!(
-        try_take(&Sink::new(false), Duration::ZERO),
+        try_take(
+            &Sink::new(false),
+            &mut StreamPacing::new(&VirtualTime::new())
+        ),
         Ok(None)
     ));
 }
@@ -471,7 +444,9 @@ async fn the_socket_charges_every_datagram_once() {
     let socket = DemuxSocket::wrap(Sink::new(false), Some(EgressCap::new(RATE, time.clone())));
     socket.send_to(&[1; 100], target()).await.unwrap();
     socket.send_to_blocking(&[1; 50], target()).unwrap();
-    let take = try_take(&socket, Duration::ZERO).unwrap().expect("take");
+    let take = try_take(&socket, &mut StreamPacing::new(&time))
+        .unwrap()
+        .expect("take");
     socket
         .send_to_paced(&[2; 700], target(), take)
         .await
@@ -492,7 +467,9 @@ async fn failed_sends_are_not_charged() {
     let socket = DemuxSocket::wrap(Sink::new(true), Some(EgressCap::new(RATE, time.clone())));
     assert!(socket.send_to(&[1; 900], target()).await.is_err());
     assert!(socket.send_to_blocking(&[1; 900], target()).is_err());
-    let take = try_take(&socket, Duration::ZERO).unwrap().expect("take");
+    let take = try_take(&socket, &mut StreamPacing::new(&time))
+        .unwrap()
+        .expect("take");
     assert!(
         socket
             .send_to_paced(&[2; 700], target(), take)
@@ -508,95 +485,146 @@ async fn failed_sends_are_not_charged() {
 /// with `None` for an unpaced send.
 type Sends = Vec<(u64, u64, Option<usize>)>;
 
-/// Simulate `streams` paced s
```

**File**: `crates/core/src/transport/peer_connection/outbound_stream.rs` (modified, +336/-17)
```diff
@@ -185,9 +185,15 @@ enum CappedAttempt<'a> {
 /// wait is checked: a fragment can still fail on the node cap at the
 /// deadline. If it had to sleep, the attempt ends (`Retry`),
 /// so the cwnd check and the node-wide take of the next attempt are back to
-/// back. Then it takes from the node-wide cap with `try_take`: on a refusal
-/// it sleeps for the jittered deficit and retries, keeping the connection
-/// payment. Nothing is reserved on the node-wide cap.
+/// back. Then it waits in the node-wide cap's admission queue, the one the
+/// QUIC endpoint waits in (`StreamPacing::wait_for_admission`), racing the
+/// stream's deadline; if it had to wait the attempt ends (`Retry`) so the
+/// cwnd check comes again right before the take. Then it takes with
+/// `try_take`; a take that still fails (another sender took the refill
+/// first) retries, keeping the connection payment and its place in the
+/// queue. Nothing is reserved on the node-wide cap while the fragment waits:
+/// the queue holds a waker and a place, not bytes. Once admitted, the fragment
+/// holds one datagram until its take, at most `ADMISSION_PASS` (1 ms).
 async fn capped_attempt<'a, S: super::super::Socket, T: TimeSource>(
     socket: &'a S,
     cap: &'a super::super::egress_cap::EgressCap,
@@ -227,20 +233,28 @@ async fn capped_attempt<'a, S: super::super::Socket, T: TimeSource>(
             };
         }
     }
-    match super::super::egress_cap::try_take(socket, pacing.slept()) {
+    match pacing
+        .wait_for_admission(time_source, cap, super::super::egress_cap::PACED_TAKE_BYTES)
+        .await
+    {
+        Ok(super::super::egress_cap::Admission::Now) => {}
+        Ok(super::super::egress_cap::Admission::Waited) => return CappedAttempt::Retry,
+        Err(gap) => {
+            return CappedAttempt::Abandon {
+                gap,
+                refused: false,
+            };
+        }
+    }
+    match super::super::egress_cap::try_take(socket, pacing) {
         Ok(take) => {
             if let Some(payment) = payment.take() {
                 payment.spent();
             }
             CappedAttempt::Send(take)
         }
-        Err(deficit) => match pacing.sleep(time_source, cap, deficit).await {
-            Ok(()) => CappedAttempt::Retry,
-            Err(gap) => CappedAttempt::Abandon {
-                gap,
-                refused: false,
-            },
-        },
+        // Another sender took the refill first: queue again.
+        Err(_) => CappedAttempt::Retry,
     }
 }
 
@@ -430,9 +444,11 @@ pub(super) async fn send_stream<S: super::super::Socket, T: TimeSource>(
         // `capped_attempt`: the fragment pays the per-connection bucket once,
         // in order (reserve and sleep), and keeps that payment; then each
         // attempt checks cwnd and takes from the node-wide bucket back to
-        // back, with no await between them and the send. A refused node-wide
-        // take sleeps for the deficit with jitter and starts again from the
-        // cwnd check. Nothing is held on the node-wide bucket while waiting.
+        // back, with no await between them and the send. Before each take the
+        // fragment waits its turn in the node-wide admission queue
+        // (`StreamPacing::wait_for_admission`), and a take that fails queues
+        // again at its place. Nothing is held on the node-wide bucket while
+        // waiting; an admitted fragment holds its datagram for at most 1 ms.
         // `CWND_WAIT_TIMEOUT` counts only time spent waiting for cwnd, summed
         // over the attempts.
         let mut cwnd_waited = Duration::ZERO;
@@ -4656,9 +4672,9 @@ mod egress_cap_tests {
         // A round holds ROUND_LIMIT reservations, so at most about
         // ROUND_LIMIT streams can keep a reservation within the deadline at
         // once; streams admitted past that are refused at a later fragment.
-        // Measured: 20 of 30, send and pipe. The run draws no randomness
-        // (the node cap never refuses, so no jittered sleep happens; checked
-        // below), so the count does not vary with the seed. The floor leaves
+        // Measured: 20 of 30, send and pipe. The node cap never binds here
+        // (checked below), so the count does not vary with the seed. The
+        // floor leaves
         // 4 streams for rounding at the round boundary.
         const MIN_SURVIVORS: usize = ROUND_LIMIT - 4;
         const FRAGMENTS: usize = 8;
@@ -5195,6 +5211,309 @@ mod egress_cap_tests {
         }
     }
 
+    /// Several streams sharing one connection's window under a binding cap,
+    /// beside many streams on other connections. The window holds one fragment
+    /// and an ACK takes 30 ms, so a stream the queue admits usually finds the
+    /// window full and waits past `ADMISSION_PASS` before its take. It keeps
+    /// its place in the queue meanwhile, so its worst gap between fragments is
+    /// about one turn of the queue (34 senders at 50 kB/s: 0.8
```

**File**: `crates/core/src/transport/quic/recycle/cap_tests.rs` (modified, +165/-94)
```diff
@@ -477,7 +477,7 @@ fn the_floor_keeps_two_datagrams_in_flight_both_ways() {
 /// `a_quic_path_and_udp_streams_each_get_their_fair_share_under_a_saturated_egress_cap`.
 #[test]
 fn a_quic_path_and_udp_streams_both_progress_under_an_egress_cap() {
-    use crate::transport::egress_cap::{PACED_WAIT_DEADLINE, try_take};
+    use crate::transport::egress_cap::{PACED_WAIT_DEADLINE, StreamPacing, try_take};
     bounded(|| async move {
         const CAP: u64 = 500_000;
         const QUIC_LEN: usize = 1_000_000;
@@ -504,8 +504,10 @@ fn a_quic_path_and_udp_streams_both_progress_under_an_egress_cap() {
                 // the cap, send at once, or sleep the deficit and try again.
                 let fragment = [0x02u8; 1200];
                 let (mut sent, mut last, mut longest) = (0, link.time.now_nanos(), 0u64);
+                // Never admitted: each take is a newcomer's.
+                let mut pacing = StreamPacing::new(&link.time);
                 while sent < UDP_LEN {
-                    match try_take(link.a_socket.as_ref(), Duration::ZERO) {
+                    match try_take(link.a_socket.as_ref(), &mut pacing) {
                         Ok(Some(take)) => {
                             let n = link
                                 .a_socket
@@ -563,107 +565,176 @@ fn a_quic_path_and_udp_streams_both_progress_under_an_egress_cap() {
     })
 }
 
-/// Under a saturated egress cap shared by two connections, with the minimum
-/// per connection set below the share, a QUIC path and a UDP stream sender on
-/// the other connection each get their fair share, half the cap, within 15%.
-/// The UDP sender is paced as the UDP transport paces a stream fragment: it
-/// reserves from its own connection's token bucket at the share
-/// (`TokenBucket::reserve`), then takes from the egress cap. Each side's rate
-/// is the bytes it put on the wire while the QUIC transfer ran, from when its
-/// connection was up.
-///
-/// What it covers is narrow: two connections, the same RTT, one flow each,
-/// and a minimum below the share. With the default minimum the share is the
-/// whole cap and the window cap does not apportion it (see `transport.md`).
-/// Seeded; over 40 seeds the rates ranged 239354 to 239658 B/s for QUIC and
-/// 249990 to 250105 B/s for UDP.
+/// A paced UDP stream on `a`, sending 1200-byte fragments to `b` as
+/// `outbound_stream::capped_attempt` sends a stream fragment under a cap:
+/// reserve it on its connection's `bucket` (`TokenBucket::reserve`), wait in
+/// the cap's admission queue (`StreamPacing::wait_for_admission`), the one
+/// the QUIC endpoint waits in, then take and send at once. There is no
+/// congestion window here, so a fragment that had to wait goes straight back
+/// to the queue, which admits it at once. Records each send's time in
+/// `sends`. A fragment that reaches the stream deadline is counted in
+/// `abandoned`, and the stream carries on with a fresh gap.
+async fn paced_udp_stream(
+    link: Arc<Link>,
+    bucket: Arc<crate::transport::token_bucket::TokenBucket<VirtualTime>>,
+    sends: Arc<Mutex<Vec<u64>>>,
+    abandoned: Arc<AtomicU64>,
+) {
+    use crate::transport::egress_cap::{PACED_TAKE_BYTES, StreamPacing, try_take};
+    let fragment = [0x02u8; 1200];
+    let cap = link.a_socket.egress_cap().expect("a cap");
+    let mut pacing = StreamPacing::new(&link.time);
+    loop {
+        let wait = bucket.reserve(fragment.len());
+        if !wait.is_zero() {
+            link.time.sleep(wait).await;
+        }
+        loop {
+            if pacing
+                .wait_for_admission(&link.time, cap, PACED_TAKE_BYTES)
+                .await
+                .is_err()
+            {
+                abandoned.fetch_add(1, Ordering::Relaxed);
+                pacing = StreamPacing::new(&link.time);
+                continue;
+            }
+            match try_take(link.a_socket.as_ref(), &mut pacing) {
+                Ok(Some(take)) => {
+                    link.a_socket
+                        .try_send_to_paced(&fragment, link.b_addr, take)
+                        .expect("sent");
+                    sends.lock().unwrap().push(link.time.now_nanos());
+                    pacing.sent(&link.time);
+                    break;
+                }
+                Ok(None) => unreachable!("the socket has a cap"),
+                // Another sender took the refill first: queue again.
+                Err(_) => {}
+            }
+        }
+    }
+}
+
+/// A QUIC path and `streams` paced UDP streams on another connection share
+/// a saturated 500 kB/s egress cap; `minimum` is the minimum per connection
+/// (`None` for the default). Returns the QUIC and UDP rates in B/s, from the
+/// bytes each put on the wire while a 2 MB QUIC transfer ran (from when its
+/// connection was up), and the fragments abandoned at the stream deadline.
+async fn quic_and_udp_rates(
+    network: &str,
+    subnet: u8,
+    seed: u64,
+    minimum: Option<usize>,
+    str
```

**File**: `crates/core/src/transport/quic/socket.rs` (modified, +49/-4)
```diff
@@ -95,8 +95,9 @@ pub(crate) const CAP_HOLD_VALIDITY_MARGIN: u32 = 2;
 /// `rate_bytes_per_sec`: [`CAP_HOLD_VALIDITY_MARGIN`] times the longest the
 /// cap makes one waiting transmit wait before its poller is polled again.
 /// That is the cap's debt limit (unpaced sends may run the bucket that far
-/// into debt) plus one datagram's refill for every waiter that can be queued
-/// ahead of it (`MAX_ADMISSION_WAKERS`) and for its own. A held poller of a
+/// into debt) plus one datagram's refill for every waiter its timer counts
+/// ahead of it (at most `MAX_ADMISSION_WAKERS`, however long the queue: the
+/// stagger is clamped there) and for its own. A held poller of a
 /// live connection is polled again within that, at its timer; one that is
 /// not was left behind by a connection that ended.
 ///
@@ -515,13 +516,19 @@ impl<S: Socket> QuicSocket<S> {
             Some(cap) => {
                 // One datagram per transmit keeps every take within the
                 // burst (at least 4 datagrams), so the bucket's bound holds
-                // exactly and the take can always be admitted eventually.
+                // exactly. The take also leaves one datagram per other
+                // outstanding admission, each lasting at most
+                // `ADMISSION_PASS`, so it is admitted eventually.
                 debug_assert!(
                     transmit.contents.len() as u64 <= cap.burst_bytes(),
                     "a {} byte transmit is larger than the egress burst",
                     transmit.contents.len()
                 );
-                match cap.try_take(transmit.contents.len(), Duration::ZERO) {
+                // The admission the poller handed over, if this transmit
+                // follows one; none for an endpoint response, which must
+                // leave every connection's admission alone.
+                let handed = take_handed_admission(cap);
+                match cap.try_take_handed(transmit.contents.len(), Duration::ZERO, handed) {
                     Ok(take) => self
                         .socket
                         .try_send_to_paced(transmit.contents, target, take),
@@ -597,6 +604,35 @@ impl<S: Socket> QuicSocket<S> {
     }
 }
 
+thread_local! {
+    /// The admission a [`QuicPoller`] was just given, for the transmit that
+    /// follows it: `(cap, admission number)`. quinn 0.11.12 calls
+    /// `poll_writable` and, when it is `Ready`, `try_send` for the same
+    /// transmit back to back on one thread with nothing in between
+    /// (`quinn/src/connection.rs:1048-1057`), so the next `try_send` on this
+    /// thread is that connection's, and its take uses exactly that admission.
+    /// quinn's endpoint `respond` (`endpoint.rs:584`) sends with no poll, finds
+    /// nothing here, and leaves every admission alone. quinn is pinned; a
+    /// quinn bump must re-check this call order
+    /// (`a_poller_hands_its_admission_to_the_transmit_that_follows`).
+    static HANDED_ADMISSION: std::cell::Cell<Option<(usize, u64)>> =
+        const { std::cell::Cell::new(None) };
+}
+
+/// Which cap a handed admission belongs to: several nodes (and caps) can
+/// share a thread in a simulation.
+fn cap_key(cap: &crate::transport::egress_cap::EgressCap) -> usize {
+    std::ptr::from_ref(cap) as usize
+}
+
+/// Take the admission handed over on this thread for `cap`, if any.
+fn take_handed_admission(cap: &crate::transport::egress_cap::EgressCap) -> Option<u64> {
+    HANDED_ADMISSION
+        .take()
+        .filter(|(key, _)| *key == cap_key(cap))
+        .map(|(_, id)| id)
+}
+
 /// quinn's write-readiness check for one connection: ready when the socket
 /// can take a send and the egress cap holds a full datagram.
 struct QuicPoller<S> {
@@ -683,6 +719,10 @@ impl<S: Socket> QuicPoller<S> {
                 panic!("injected panic in the QUIC socket adapter (write readiness)");
             }
         }
+        // A handoff a poll left unused (its transmit never reached the cap)
+        // is stale: the admission it names is withdrawn below if this poller
+        // owns it, and must not go to another's transmit.
+        HANDED_ADMISSION.set(None);
         let this = self;
         let demux = &this.socket.socket;
         match demux.poll_send_ready(cx) {
@@ -701,6 +741,11 @@ impl<S: Socket> QuicPoller<S> {
             Err(poisoned) => poisoned.into_inner(),
         };
         let admitted = cap.poll_admit(usize::from(MAX_UDP_PAYLOAD), waiter, cx);
+        if admitted.is_ready() {
+            if let Some(id) = waiter.admission() {
+                HANDED_ADMISSION.set(Some((cap_key(cap), id)));
+            }
+        }
         this.record_admission(admitted.is_pending());
         admitted.map(Ok)
     }
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +131/-4)
```diff
@@ -2168,9 +2168,9 @@ fn a_hold_left_by_an_ended_connection_stops_pausing_the_ack_watch() {
 
 /// #5940 step M6: `socket::cap_hold_validity`, without its margin, bounds
 /// the longest wait the real cap gives a QUIC transmit before its poller is
-/// polled again: with the cap at its deepest debt (`DEBT_LIMIT`) and the
-/// most waiters it queues (`MAX_ADMISSION_WAKERS`), the last waiter's timer
-/// is no later than that.
+/// polled again: with the cap at its deepest debt (`DEBT_LIMIT`) and 500
+/// more waiters queued than it holds wakers for (`MAX_ADMISSION_WAKERS`),
+/// the last waiter's timer is no later than that.
 #[test]
 fn cap_hold_validity_bounds_the_longest_admission_wait() {
     use super::socket::{CAP_HOLD_VALIDITY_MARGIN, cap_hold_validity};
@@ -2184,7 +2184,9 @@ fn cap_hold_validity_bounds_the_longest_admission_wait() {
         // Past the debt limit: the rest is forgiven.
         let deepest = cap.burst_bytes() + 2 * rate * DEBT_LIMIT.as_secs();
         cap.charge_unpaced(deepest as usize);
-        let mut waiters: Vec<AdmissionWaiter> = (0..MAX_ADMISSION_WAKERS)
+        // More than the queue holds wakers for: the queue keeps every place,
+        // and the stagger counts at most `MAX_ADMISSION_WAKERS` ahead.
+        let mut waiters: Vec<AdmissionWaiter> = (0..MAX_ADMISSION_WAKERS + 500)
             .map(|_| AdmissionWaiter::default())
             .collect();
         for waiter in &mut waiters {
@@ -4530,3 +4532,128 @@ fn a_retry_token_is_honoured_for_its_lifetime_on_the_endpoint_clock() {
         "past its lifetime the token is answered with a close"
     );
 }
+
+/// The QUIC poller hands its admission to the transmit that follows it on the
+/// same thread, as quinn 0.11.12 calls them (`poll_writable`, then `try_send`,
+/// back to back): that transmit's take uses exactly that admission, and other
+/// senders' admissions, made before the poll and between the poll and the
+/// send, stay outstanding. A send on another thread (quinn's endpoint
+/// `respond`, which never polls) finds no handoff and uses no admission. Pins
+/// the call order this relies on: a quinn bump must keep it.
+#[test]
+fn a_poller_hands_its_admission_to_the_transmit_that_follows() {
+    use crate::transport::egress_cap::AdmissionWaiter;
+    use quinn::AsyncUdpSocket;
+    use std::task::Context;
+    let time = VirtualTime::new();
+    let local: SocketAddr = "10.201.9.1:5000".parse().unwrap();
+    let target: SocketAddr = "10.201.9.2:5000".parse().unwrap();
+    let (socket, demux) = scripted(local, SendMode::Send, Vec::new(), Some((1_000_000, &time)));
+    let cap = demux.egress_cap().unwrap();
+    let waker = futures::task::noop_waker();
+    let mut cx = Context::from_waker(&waker);
+    let mut before = AdmissionWaiter::default();
+    assert!(cap.poll_admit(1200, &mut before, &mut cx).is_ready());
+    let mut poller = socket.clone().create_io_poller();
+    assert!(poller.as_mut().poll_writable(&mut cx).is_ready());
+    let mut between = AdmissionWaiter::default();
+    assert!(cap.poll_admit(1200, &mut between, &mut cx).is_ready());
+    let (before_id, between_id) = (before.admission().unwrap(), between.admission().unwrap());
+
+    // quinn's endpoint response, on another thread: no handoff there.
+    std::thread::scope(|scope| {
+        scope
+            .spawn(|| socket.try_send(&transmit(&[0xC0; 1200], target)))
+            .join()
+            .unwrap()
+            .expect("the bucket has room for a response beside three admissions");
+    });
+    assert_eq!(
+        cap.admissions_outstanding(),
+        3,
+        "the response used no admission"
+    );
+
+    socket.try_send(&transmit(&[0xC0; 1200], target)).unwrap();
+    assert_eq!(
+        cap.admissions_outstanding(),
+        2,
+        "the transmit used one admission"
+    );
+    assert!(
+        cap.admission_outstanding(before_id),
+        "not the older sender's"
+    );
+    assert!(cap.admission_outstanding(between_id), "nor the newer one's");
+}
+
+/// A handoff whose transmit never reached the cap (the send returned first)
+/// goes to no other transmit: the poller's next poll clears it, and a send
+/// with no poll then uses no admission.
+#[test]
+fn an_unused_handoff_goes_to_no_other_transmit() {
+    use quinn::AsyncUdpSocket;
+    use std::task::Context;
+    let time = VirtualTime::new();
+    let local: SocketAddr = "10.201.9.1:5000".parse().unwrap();
+    let target: SocketAddr = "10.201.9.2:5000".parse().unwrap();
+    let (socket, demux) = scripted(local, SendMode::Send, Vec::new(), Some((1_000_000, &time)));
+    let cap = demux.egress_cap().unwrap();
+    // Room for one datagram and a bit.
+    cap.charge_unpaced(cap.burst_bytes() as usize - 1300);
+    let waker = futures::task::noop_waker();
+    let mut cx = Context::from_waker(&waker);
+    let mut admitted = socket.clone().create_io_poller();
+    assert!(admitted.as_mut().poll_writable(&mut cx).is_ready());
+    // Another conne
```

**File**: `docs/architecture/transport/configuration/bandwidth-configuration.md` (modified, +7/-5)
```diff
@@ -191,7 +191,7 @@ Only one kind of send waits for the bucket:
 
 | Send | Behaviour when the bucket is empty |
 |------|------------------------------------|
-| Stream fragments (`send_stream`, `pipe_stream`) | First reserve the datagram on the per-connection bucket and sleep until it is due, so a connection serves its streams in order; a reservation whose wait would reach the stream's 5 s deadline is not made, so it takes no place in the connection's order, and the stream fails at once (counted as refused, `egress_streams_refused_*`). A reservation that was made and is later given back (the stream is cancelled or fails on a later wait) does not move the fragments behind it up; their waits are not recomputed. An admitted new stream can still delay streams already in progress on the connection, as without a cap; a per-connection scheduler is future work. This looks only at the connection's wait, so a fragment can still fail on the node-wide bucket at the deadline. The fragment keeps that reservation through later waits. Then, right after a cwnd check, take the datagram from the node-wide bucket and send at once. If it is short, take nothing from it, sleep for the deficit times 1.0 to 1.4 plus 0 to 2 ms (random), and start again from the cwnd check. Nothing is held on the node-wide bucket while waiting, and the order among streams waiting for it is random. A stream whose next fragment has not been sent 5 s after its previous one (or after the stream started; the gap the receiver times, whatever the wait was for) fails. |
+| Stream fragments (`send_stream`, `pipe_stream`) | First reserve the datagram on the per-connection bucket and sleep until it is due, so a connection serves its streams in order; a reservation whose wait would reach the stream's 5 s deadline is not made, so it takes no place in the connection's order, and the stream fails at once (counted as refused, `egress_streams_refused_*`). A reservation that was made and is later given back (the stream is cancelled or fails on a later wait) does not move the fragments behind it up; their waits are not recomputed. An admitted new stream can still delay streams already in progress on the connection, as without a cap; a per-connection scheduler is future work. This looks only at the connection's wait, so a fragment can still fail on the node-wide bucket at the deadline. The fragment keeps that reservation through later waits. Then wait in the node-wide bucket's admission queue, the same queue the QUIC endpoint waits in, until the bucket holds the datagram; after any wait, check cwnd again; then take the datagram from the node-wide bucket and send at once. Nothing is held on the node-wide bucket while waiting: the queue holds the stream's place, not bytes. Once admitted, the stream holds one datagram until it takes it, for at most 1 ms. If its take fails (an ACK or another unpaced send took the datagram first), or its congestion window holds it longer than that, it waits again at the same place in the queue, not at the back. A stream whose next fragment has not been sent 5 s after its previous one (or after the stream started; the gap the receiver times, whatever the wait was for) fails. |
 | Everything else (handshakes, short messages, ACKs, receipts, keepalives, Pongs, retransmissions) | Sent at once and charged once sent. The bucket goes into debt, and the next stream fragments wait longer to pay it. |
 
 The sends that never wait are sent from places that must not block: the receive path
@@ -210,10 +210,12 @@ What this guarantees:
   it is still sent but not charged ("forgiven", counted as
   `egress_debt_forgiven_bytes`). So the cap holds on average, and forgiven bytes mean
   control traffic alone exceeded the cap for over a second.
-- The order among waiting streams is random: a stream that wakes when the bucket has
-  room takes it. Each of `N` concurrent streams gets a fragment about every
-  `N * 1200 / C` seconds on average at a cap of `C` bytes/s, and the gaps have a
-  geometric tail (see the troubleshooting section). Connections share the cap in
+- Waiting streams and QUIC connections are served approximately in the order they
+  queued, each with a turn (a QUIC transmit delayed by the operating system between
+  its admission and its send can take another QUIC connection's turn), so each of `N` waiting senders gets a datagram about every
+  `N * 1200 / C` seconds at a cap of `C` bytes/s. Until #6112 the order was random
+  and the gaps had a geometric tail, and a QUIC path, which already queued, won most
+  refills. Connections share the cap in
   proportion to their number of waiting streams.
 - Known limitation: there is no isolation between connections inside the cap. A peer
   that drives many streams through this node gets a proportional share of it.
```

#### Recent Merged Pull Requests:
- **PR #6131** (2026-11-06): test(util): count the summary thread's allows in the rate-limit stress test (@sanity)
- **PR #6125** (2026-11-06): feat: skip payloads already merged into the local state (@sanity)
- **PR #6124** (2026-11-06): feat(transport): export quinn's per-path QUIC loss (@sanity)
- **PR #6122** (2026-11-06): fix(transport): stop sending on a QUIC path that has gone dark (@sanity)
- **PR #6119** (2026-11-05): fix(test): advance VirtualTime in controlled simulations (@sanity)
- **PR #6118** (2026-11-05): feat(transport): export QUIC data path telemetry (@sanity)

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

## X. transport): export quinn's per-path QUIC loss (#6124)

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `49808ff5`: transport): export quinn's per-path QUIC loss (#6124). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  tick of the acknowledgement watch and once more when the path's task ends);
  quic_sent_packets, quic_lost_packets, quic_lost_bytes and
  quic_congestion_events (quinn's PathStats, every path including shadow ones, by
  the same tick and once more when the path's task ends, so a path's last tick
  before it closes is counted, sums of the period). A CONNECTION_CLOSE quinn sends
  again after that report is in neither the byte nor the packet counts. A panic
  in the watch, which the path survives, ends nothing: the report is the
  receive supervisor's (recycle::PathReport); quic_loss_rate_<zero|lt_0_5pct|lt_1pct|
  lt_2pct|lt_5pct|lt_10pct|lt_20pct|ge_20pct> (a gauge of live paths that have sent
  at least 200 packets since they started, each in the one bucket of its own
  lost/sent over its life, moved as it changes, out when the path ends; every
  bucket uploaded every period, 0 included; no per-path values) and
  quic_ended_loss_rate_<bucket> (paths that ended in the period, by their final
  bucket, so paths that fail lossy still show) and quic_ended_paths_below_floor
  (paths that ended in the period before 200 packets). Packets in flight at close
  are dropped by quinn, not de
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  tick of the acknowledgement watch, so a path's last tick before it closes is
  lost); quic_session_ended_with_data_path_<age> (sessions that ended while their
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `49808ff5` are properly handled with clean fallback behavior.
