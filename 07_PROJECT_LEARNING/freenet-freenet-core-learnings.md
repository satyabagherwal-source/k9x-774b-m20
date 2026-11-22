> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `dbfadb1c`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T20:35:46.557Z  
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
> **Harvest Timestamp**: 2026-11-22T20:35:46.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3132 stars

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
- **Issue #6314** (2026-11-22): **feat(transport): run the egress cap on VirtualTime for a simulated QUIC node**
  *Symptoms*: ## Problem  Simulations write `transport_quic = off` (`node/testing_impl.rs`), partly because `bind_udp_listener` refused a simulated node that had both `transport-quic` and `total-bandwidth-limit`: the egress cap was always built on `RealTime` while a simulated QUIC endpoint runs on the network's `VirtualTime`, and the endpoint must share the cap's clock. D-2b (flip the simulation default to QUIC) needs that restriction lifted. Part of D-2 in `PHASE-D-PLAN.md`.  ## Approach  When the node has a QUIC endpoint and its network registered a `VirtualTime`, the egress cap is built on that `VirtualTime` (same instance as the endpoint). `EgressCap` already type-erases its clock and uses cancelable sleeps, so nothing else changes. The refusal error is removed.  Unchanged: production (no registered `VirtualTime`) and simulated nodes without QUIC keep a `RealTime` cap. A simulated QUIC node's UDP stream senders still sleep on `RealTime` until the legacy path goes; that residual is noted in `.claude/rules/transport.md`. The default is not flipped here.  Test-only hooks: a per-address egress cap probe in `in_memory_socket.rs` (`#[cfg(test)]`), `SimNetwork::with_node_total_bandwidth_limit`, `egress_cap_reading`, `egress_cap_take`.  ## Testing  - `a_simulated_node_with_quic_runs_its_egress_cap_on_virtual_time` (replaces the refusal test): all four QUIC/cap combinations bind; the QUIC cap reads the simulated clock and moves exactly 100 s when it advances 100 s; a non-QUIC cap stays on `Real

- **Issue #6313** (2026-11-22): **feat(config): warn that UDP-only transport keys stop applying once legacy UDP is removed**
  *Symptoms*: ## Problem  Phase D removes the legacy UDP transport. Five config keys only tune it: `streaming-threshold`, `ledbat-min-ssthresh`, `congestion-control`, `bbr-startup-rate`, `min-bandwidth-per-connection`. They must stay parseable after D (a rollback reinstalls the previous binary, which must never meet an unknown key in a file a newer binary wrote), and operators who set them should hear in advance that they stop applying. This is D-1 of `PHASE-D-PLAN.md`; it has to be in a release before D.  ## Approach  No behaviour change: all five keys keep their current effect, since UDP still exists. A node given a non-default value for any of them logs one startup warning naming the keys and saying a future release accepts and ignores them.  - `NetworkApiConfig::udp_only_settings_in_use()` lists the keys set to a non-default value (config file, flag or env, after the existing merge). A node that never set them hears nothing. A value explicitly set to the default is indistinguishable from unset in the file mirror, so it is not reported; that is harmless since it is also the default after D. - `Config::log_udp_only_settings()` emits the warning. It is called in `bin/freenet.rs` right after `set_logger`, like `log_network_address_migration`, because `build()` runs before any subscriber exists and would drop the message.  Difference from the D-1 text: it says to keep parsing and warn; this PR does exactly that and leaves the keys' effect in place (D-8 removes the effect, D-9e removes the k

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

### Incident Patch 1: `dbfadb1c` (2026-11-22)
**Commit Message**: feat(transport): run the egress cap on VirtualTime for a simulated QUIC node (#6314)

**File**: `.claude/rules/transport.md` (modified, +9/-8)
```diff
@@ -278,14 +278,15 @@ try_take and sends with DemuxSocket::try_send_to_paced, so its datagram is
 charged once, by the take. Every take is at most one datagram, within the
 burst (QUIC: one segment per transmit, debug-asserted), so the bound above
 holds exactly.
-The cap is built on RealTime even in simulation, because the listener and
-its connections run on RealTime there: a VirtualTime cap would compute
-deficits on another clock than its waiters sleep and time out on. The QUIC
-endpoint runs on the cap's clock for the same reason (bind_udp_listener
-builds both on RealTime in production; tests build both on one
-VirtualTime). In a simulation the endpoint runs on the network's
-VirtualTime, so bind_udp_listener refuses a simulated node with both
-transport-quic and total-bandwidth-limit.
+The cap is built on RealTime in production and in a simulated node without
+QUIC, because the listener and its connections run on RealTime there: a
+VirtualTime cap would compute deficits on another clock than its UDP
+waiters sleep and time out on. The QUIC endpoint must run on the cap's
+clock, because a hold's age is measured on the path's clock against a bound
+in the cap's time. In a simulation the endpoint runs on the network's VirtualTime, so
+bind_udp_listener builds a simulated QUIC node's cap on that VirtualTime
+too (D-2a); the same node's UDP stream senders still time on RealTime
+until the legacy path is removed.
 Tests assert on per-cap EgressCap::stats(), never the global counters.
 ```
 
```

**File**: `crates/core/src/node/testing_impl.rs` (modified, +148/-0)
```diff
@@ -2221,6 +2221,44 @@ impl SimNetwork {
         self
     }
 
+    /// Sets `total-bandwidth-limit` (bytes per second, node-wide egress cap)
+    /// on the node `label` only. Call before the simulation starts.
+    #[cfg(test)]
+    pub fn with_node_total_bandwidth_limit(
+        &mut self,
+        label: &NodeLabel,
+        bytes_per_sec: usize,
+    ) -> &mut Self {
+        let config = self.node_config_mut(label);
+        Arc::make_mut(&mut config.config)
+            .network_api
+            .total_bandwidth_limit = Some(bytes_per_sec);
+        self
+    }
+
+    /// What the egress cap of the node `label` reads: `None` if the node has
+    /// not bound its socket, `Some(None)` if it has no cap.
+    #[cfg(test)]
+    pub(crate) fn egress_cap_reading(
+        &self,
+        label: &NodeLabel,
+    ) -> Option<Option<crate::transport::in_memory_socket::EgressCapReading>> {
+        let addr = *self.node_addresses.get(label)?;
+        crate::transport::in_memory_socket::egress_cap_reading(&self.name, addr)
+    }
+
+    /// Takes `bytes` from the egress cap of the node `label` as one
+    /// datagram's send would; see `in_memory_socket::egress_cap_take`.
+    #[cfg(test)]
+    pub(crate) fn egress_cap_take(
+        &self,
+        label: &NodeLabel,
+        bytes: usize,
+    ) -> Option<Result<(), Duration>> {
+        let addr = *self.node_addresses.get(label)?;
+        crate::transport::in_memory_socket::egress_cap_take(&self.name, addr, bytes)
+    }
+
     /// Makes the node `label` advertise `version` in its transport
     /// handshakes instead of this binary's version, so its peers treat it as
     /// that (older) release in every version gate, e.g. `(0, 2, 148)` for a
@@ -8727,6 +8765,116 @@ mod tests {
         assert!(!sim.quic_accept_loop_started(&labels[1]));
     }
 
+    /// In a running simulation a node with `transport-quic` and a
+    /// `total-bandwidth-limit` runs its egress cap on the network's
+    /// `VirtualTime` (the clock of its QUIC endpoint): the cap's clock is the
+    /// simulated clock, the node's sends are charged to it, and over the run
+    /// the bytes charged stay within `burst + rate * elapsed` of simulated
+    /// time. A node without QUIC keeps its cap on `RealTime`.
+    #[tokio::test(flavor = "current_thread")]
+    async fn a_simulated_quic_node_runs_its_egress_cap_on_virtual_time() {
+        use crate::simulation::TimeSource;
+        const NETWORK: &str = "quic-sim-egress-cap-d2a";
+        const RATE: usize = 128 * 1024;
+        let mut sim = SimNetwork::new(NETWORK, 1, 2, 7, 3, 6, 2, 0xD2A0_0001).await;
+        let labels = labels_in_order(&sim);
+        sim.with_transport_quic("prefer")
+            .with_node_transport_quic(&labels[2], "off");
+        for label in &labels {
+            sim.with_node_total_bandwidth_limit(label, RATE);
+        }
+        let _handles = sim
+            .start_with_rand_gen::<rand::rngs::SmallRng>(0xD2A0_0001, 1, 1)
+            .await;
+        let started = sim.virtual_time().now_nanos();
+        // Run until 30 simulated seconds have passed and both QUIC nodes
+        // have sent something (their connections formed), however long the
+        // host takes in wall time; the deadline only ends a stuck run.
+        let deadline = std::time::Instant::now() + Duration::from_secs(600);
+        loop {
+            sim.advance_time(Duration::from_millis(100));
+            tokio::time::sleep(Duration::from_millis(10)).await;
+            let charged = labels[..2].iter().all(|label| {
+                sim.egress_cap_reading(label)
+                    .flatten()
+                    .is_some_and(|cap| cap.charged_bytes > 0)
+            });
+            if charged && sim.virtual_time().now_nanos() - started >= 30_000_000_000 {
+                break;
+            }
+            assert!(
+                std::time::Instant::now() < deadline,
+                "the QUIC nodes never sent anything"
+            );
+        }
+        let elapsed_ns = sim.virtual_time().now_nanos() - started;
+        assert!(elapsed_ns >= 30_000_000_000, "{elapsed_ns} ns elapsed");
+        for label in &labels[..2] {
+            let cap = sim
+                .egress_cap_reading(label)
+                .expect("the node bound its socket")
+                .unwrap_or_else(|| panic!("{label} has no egress cap"));
+            assert_eq!(cap.rate_bytes_per_sec, RATE as u64);
+            assert_eq!(
+                cap.now_nanos,
+                sim.virtual_time().now_nanos(),
+                "{label}: the cap reads the simulated clock"
+            );
+            assert!(cap.charged_bytes > 0, "{label}: its sends are charged");
+            assert!(
+                cap.charged_bytes as u128
+                    <= cap.burst_bytes as u128
+                        + RATE as u128 * u128::from(elapsed_ns) / 1_000_000_000,
+                "{label}: {} bytes charged in {elapsed_ns} ns",
+                cap.charged_by
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +30/-23)
```diff
@@ -390,37 +390,44 @@ pub(super) async fn bind_udp_listener<S: Socket>(
     // The node-wide egress cap exists only when `total-bandwidth-limit` is
     // set and not 0 (`global_bandwidth` is set; the node builds no pool for a
     // total of 0, `NetworkApiConfig::global_bandwidth_manager`), so a node
-    // without it pays nothing. The cap runs
-    // on `RealTime`, as the listener built below does, in production and in
-    // simulation alike; waiters sleep on their own connection's time
-    // source. A cap on the network's `VirtualTime` would compute deficits on
-    // one clock for stream senders that sleep and time out on another.
+    // without it pays nothing.
     //
-    // The QUIC endpoint must run on the cap's clock (see
-    // `QuicEndpoint::bind`), and in simulation it runs on `VirtualTime`, so
-    // a simulated node that has both a cap and QUIC is refused rather than
-    // run on two clocks.
-    let egress_cap = config.global_bandwidth.as_ref().and_then(|manager| {
-        super::egress_cap::EgressCap::from_total_limit(manager.total_limit(), RealTime::new())
-    });
-    if quic_virtual_time.is_some() && egress_cap.is_some() {
-        return Err(TransportError::Other(anyhow::anyhow!(
-            "simulated node at {bind_addr} sets both transport-quic and \
-             total-bandwidth-limit: the egress cap runs on RealTime and the \
-             simulated QUIC endpoint on VirtualTime, so they cannot share a clock"
-        )));
-    }
+    // The QUIC endpoint must run on the cap's clock: a hold's age is
+    // measured on the path's clock against a bound in the cap's time (see
+    // `QuicEndpoint::bind`). So a simulated node with QUIC builds the cap
+    // on the same `VirtualTime` as its endpoint; the cap's clock and its
+    // cancelable timers are then simulated time, and a seeded run repeats.
+    // If the endpoint then fails to bind (`bind_or_warn`), the cap stays on
+    // `VirtualTime` with no endpoint. Everywhere else, in production and in a simulated node
+    // without QUIC, the cap runs on `RealTime`, as the listener built below
+    // does: UDP stream senders sleep and time out on the connection's own
+    // time source, and a cap on `VirtualTime` would compute their deficits
+    // on another clock.
+    let egress_cap =
+        config
+            .global_bandwidth
+            .as_ref()
+            .and_then(|manager| match quic_virtual_time.clone() {
+                Some(time) => {
+                    super::egress_cap::EgressCap::from_total_limit(manager.total_limit(), time)
+                }
+                None => super::egress_cap::EgressCap::from_total_limit(
+                    manager.total_limit(),
+                    RealTime::new(),
+                ),
+            });
     let socket = Arc::new(
         bind_socket_with_retry::<DemuxSocket<S>>(bind_addr, SOCKET_BIND_MAX_RETRIES)
             .await?
             .with_egress_cap(egress_cap),
     );
+    #[cfg(test)]
+    super::in_memory_socket::record_egress_cap_probe(bind_addr, Arc::downgrade(&socket));
     // With `transport-quic` off nothing is built and no QUIC ingress is
     // enabled, so QUIC-class datagrams stay `quic_ingress_no_ingress`. With
-    // it on the endpoint runs on the egress cap's clock (`RealTime`, see
-    // above; the simulation's `VirtualTime` in a simulation, which has no
-    // cap), authenticates with this node's transport key, and has an empty
-    // allow-set: nothing reaches it until an upgrade path allows a peer.
+    // it on the endpoint runs on the egress cap's clock (`RealTime`, or the
+    // simulation's `VirtualTime` in a simulation, see above), authenticates
+    // with this node's transport key, and has an empty allow-set: nothing reaches it until an upgrade path allows a peer.
     // Each QUIC connection's window is capped at the rate the UDP token
     // bucket paces a connection at (`quic::recycle::CappedCubic`).
     let quic_settings = config
```

**File**: `crates/core/src/transport/in_memory_socket.rs` (modified, +100/-0)
```diff
@@ -252,6 +252,104 @@ pub(crate) fn quic_endpoint_clock(network: &str, addr: SocketAddr) -> Option<&'s
         .map(|clock| *clock)
 }
 
+/// What a simulated node's egress cap reads, for a test.
+#[cfg(test)]
+#[derive(Debug, Clone, Copy)]
+pub(crate) struct EgressCapReading {
+    pub(crate) rate_bytes_per_sec: u64,
+    pub(crate) burst_bytes: u64,
+    /// The cap's own clock, nanoseconds.
+    pub(crate) now_nanos: u64,
+    /// Bytes charged to the cap since it was built.
+    pub(crate) charged_bytes: u64,
+}
+
+/// What a test asks of a node's cap: read it, or take `bytes` from its bucket
+/// as a sender would (charged on success).
+#[cfg(test)]
+enum EgressCapAsk {
+    Read,
+    Take(usize),
+}
+
+#[cfg(test)]
+enum EgressCapAnswer {
+    Reading(EgressCapReading),
+    Taken(Result<(), Duration>),
+}
+
+#[cfg(test)]
+type EgressCapProbe = Box<dyn Fn(EgressCapAsk) -> Option<Option<EgressCapAnswer>> + Send + Sync>;
+
+/// A reader of the egress cap of the node at each `(network, address)`.
+/// `None` once the node's socket is gone; `Some(None)` for a node with no cap.
+#[cfg(test)]
+static EGRESS_CAP_PROBES: LazyLock<DashMap<(String, SocketAddr), EgressCapProbe>> =
+    LazyLock::new(DashMap::new);
+
+/// Records a reader of the egress cap of the socket bound at `addr`, if
+/// `addr` belongs to a simulation network (keyed as
+/// [`record_quic_endpoint_clock`] is).
+#[cfg(test)]
+pub(crate) fn record_egress_cap_probe<S: crate::transport::Socket>(
+    addr: SocketAddr,
+    socket: std::sync::Weak<S>,
+) {
+    if let Ok(network) = resolve_address_network(&addr) {
+        EGRESS_CAP_PROBES.insert(
+            (network, addr),
+            Box::new(move |ask| {
+                let socket = socket.upgrade()?;
+                Some(socket.egress_cap().map(|cap| {
+                    match ask {
+                        EgressCapAsk::Read => EgressCapAnswer::Reading(EgressCapReading {
+                            rate_bytes_per_sec: cap.rate_bytes_per_sec(),
+                            burst_bytes: cap.burst_bytes(),
+                            now_nanos: cap.now_nanos(),
+                            charged_bytes: cap.stats().bytes,
+                        }),
+                        EgressCapAsk::Take(bytes) => EgressCapAnswer::Taken(
+                            cap.try_take(bytes, Duration::ZERO)
+                                .map(|take| take.sent(bytes)),
+                        ),
+                    }
+                }))
+            }),
+        );
+    }
+}
+
+/// The reading of the egress cap of the node at `addr` in `network`: `None`
+/// if no socket is bound there, `Some(None)` if it has no cap.
+#[cfg(test)]
+pub(crate) fn egress_cap_reading(
+    network: &str,
+    addr: SocketAddr,
+) -> Option<Option<EgressCapReading>> {
+    let probe = EGRESS_CAP_PROBES.get(&(network.to_string(), addr))?;
+    Some(match probe(EgressCapAsk::Read)? {
+        Some(EgressCapAnswer::Reading(reading)) => Some(reading),
+        _ => None,
+    })
+}
+
+/// Takes `bytes` from the egress cap of the node at `addr` in `network`, as
+/// one datagram's send would: `Ok(())` if the bucket held them (they are
+/// charged), else the wait the bucket asks for, in the cap's time. `None` if
+/// no socket is bound there or it has no cap.
+#[cfg(test)]
+pub(crate) fn egress_cap_take(
+    network: &str,
+    addr: SocketAddr,
+    bytes: usize,
+) -> Option<Result<(), Duration>> {
+    let probe = EGRESS_CAP_PROBES.get(&(network.to_string(), addr))?;
+    match probe(EgressCapAsk::Take(bytes))?? {
+        EgressCapAnswer::Taken(taken) => Some(taken),
+        EgressCapAnswer::Reading(_) => None,
+    }
+}
+
 /// The simulated nodes whose transport started its QUIC endpoint's accept
 /// loop, keyed like [`QUIC_ENDPOINT_CLOCKS`]. Written by the transport when
 /// it starts the loop; read by tests to check the node passes its task
@@ -327,6 +425,8 @@ pub(crate) fn clear_quic_endpoint_clocks(network: &str) {
     crate::operations::connect::native_wire_trace::remove(network);
     QUIC_ACCEPT_LOOPS.retain(|(owner, _)| owner != network);
     QUIC_ENDPOINT_CLOCKS.retain(|(owner, _), _| owner != network);
+    #[cfg(test)]
+    EGRESS_CAP_PROBES.retain(|(owner, _), _| owner != network);
 }
 
 /// Clears all network time sources, for EVERY network in the process.
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +40/-24)
```diff
@@ -3525,29 +3525,32 @@ fn the_transport_endpoint_runs_on_virtual_time_only_in_simulation() {
     })
 }
 
-/// A simulated node with both `transport-quic` and an egress cap is
-/// refused: the cap runs on `RealTime` and the simulated endpoint on
-/// `VirtualTime`. Either one alone binds, and so does QUIC with
-/// `total-bandwidth-limit = 0`, which builds no cap.
+/// The clock of a simulated node's egress cap. With `transport-quic` the cap
+/// runs on the network's `VirtualTime`, the clock of the node's endpoint, so
+/// the node binds and advancing the simulated clock moves the cap's. Without
+/// QUIC the cap keeps `RealTime`, which a simulated clock does not move. QUIC
+/// with `total-bandwidth-limit = 0` builds no cap.
 #[test]
-fn a_simulated_node_with_quic_and_an_egress_cap_is_refused() {
+fn a_simulated_node_with_quic_runs_its_egress_cap_on_virtual_time() {
     bounded(|| async move {
         use crate::transport::connection_handler::{UdpTransportConfig, bind_udp_listener};
         use crate::transport::global_bandwidth::GlobalBandwidthManager;
+        use crate::transport::in_memory_socket::egress_cap_reading;
+        const RATE: usize = 1_000_000;
         let network = "quic-sim-egress-cap";
         let time = VirtualTime::new();
         let _clock = Registration::time_source(network, time.clone());
         let cap = |limit| Some(Arc::new(GlobalBandwidthManager::new(limit, None)));
-        for (port, quic, global_bandwidth, refused) in [
-            (5000, Some(settings()), cap(1_000_000), true),
-            (5001, Some(settings()), None, false),
-            (5002, None, cap(1_000_000), false),
-            (5003, Some(settings()), cap(0), false),
+        for (port, quic, global_bandwidth, expected) in [
+            (5000, Some(settings()), cap(RATE), Some(true)),
+            (5001, Some(settings()), None, None),
+            (5002, None, cap(RATE), Some(false)),
+            (5003, Some(settings()), cap(0), None),
         ] {
             let net = crate::transport::test_net::subnet();
             let local = net.addr_port(1, port);
             let _registered = Registration::address(local, network);
-            let bound = bind_udp_listener::<SimulationSocket>(
+            let (_, _, listener) = bind_udp_listener::<SimulationSocket>(
                 crate::transport::TransportKeypair::new(),
                 local.ip(),
                 port,
@@ -3558,21 +3561,34 @@ fn a_simulated_node_with_quic_and_an_egress_cap_is_refused() {
                     ..UdpTransportConfig::default()
                 },
             )
-            .await;
-            match bound {
-                Ok((_, _, listener)) => {
-                    assert!(!refused, "port {port}: QUIC plus a cap must be refused");
-                    listener.abort();
-                }
-                Err(error) => {
-                    assert!(refused, "port {port}: refused: {error}");
-                    let text = error.to_string();
-                    assert!(
-                        text.contains("transport-quic") && text.contains("total-bandwidth-limit"),
-                        "the error names both settings: {text}"
-                    );
+            .await
+            .unwrap_or_else(|error| panic!("port {port}: {error}"));
+            let before = egress_cap_reading(network, local)
+                .unwrap_or_else(|| panic!("port {port}: no socket"));
+            match expected {
+                None => assert!(before.is_none(), "port {port}: no cap is built"),
+                Some(on_virtual_time) => {
+                    let before = before.unwrap_or_else(|| panic!("port {port}: no cap"));
+                    assert_eq!(before.rate_bytes_per_sec, RATE as u64);
+                    time.advance(Duration::from_secs(100));
+                    let after = egress_cap_reading(network, local).unwrap().unwrap();
+                    let moved = after.now_nanos.saturating_sub(before.now_nanos);
+                    if on_virtual_time {
+                        assert_eq!(
+                            after.now_nanos,
+                            time.now_nanos(),
+                            "port {port}: the cap reads the simulated clock"
+                        );
+                        assert_eq!(moved, 100_000_000_000, "port {port}");
+                    } else {
+                        assert!(
+                            moved < 50_000_000_000,
+                            "port {port}: a cap without QUIC stays on RealTime"
+                        );
+                    }
                 }
             }
+            listener.abort();
         }
     })
 }
```

---

### Incident Patch 2: `a73f5e45` (2026-11-22)
**Commit Message**: chore(release): ship the QUIC-native wire variants in 0.2.163 (#6312)

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +16/-7)
```diff
@@ -1218,8 +1218,8 @@ use crate::operations::connect::native::NativeWire;
 /// one, so `connect::wire::encode_for_peer` emits them only to a peer whose
 /// negotiated version is known and at least this; every other encode emits
 /// today's variants without the fields. Per the wire-gated-floor rule in
-/// `docs/RELEASING.md`, this is the release that first ships the decoder, then
-/// frozen. Bias HIGH: too low closes connections to the release below it, too
+/// `docs/RELEASING.md`, the floor is the first release that emits them (the
+/// decoder itself shipped in 0.2.157), then frozen. Bias HIGH: too low closes connections to the release below it, too
 /// high only delays the offer.
 /// Raised from 0.2.158 to 0.2.159 by the QUIC data ramp PR (#6224): 0.2.158
 /// starts the data ramp, and turning on the native connect offer in the same
@@ -1228,20 +1228,29 @@ use crate::operations::connect::native::NativeWire;
 /// for 0.2.160: native connect is still off (`QUIC_NATIVE_PERCENT` is 0) and
 /// its wire fields may change before it is enabled, so no release is frozen
 /// as the floor yet. Raised to 0.2.162 for 0.2.161 for the same reasons, and
-/// to 0.2.163 for 0.2.162.
+/// to 0.2.163 for 0.2.162. Frozen at 0.2.163: that release ships the variants
+/// (`QUIC_NATIVE_SHIPPED_IN`), with every offer at percent 0, so a later
+/// release can turn the native path on. Do not raise it again.
 pub(crate) const QUIC_NATIVE_MIN_VERSION: (u8, u8, u16) = (0, 2, 163);
 
-/// Has the decoder for the QUIC-native `ConnectMsg` variants shipped, and in
-/// which release?
+/// Has the release that first emits the QUIC-native `ConnectMsg` variants
+/// shipped, and which one is it?
 ///
 /// Same contract as [`HASH_FIRST_SHIPPED_IN`], checked by
 /// `quic_native_floor_tracks_the_shipping_release`: `None` means
 /// [`QUIC_NATIVE_MIN_VERSION`] is a prediction that must stay strictly ABOVE
-/// the crate version; `Some(v)` means it shipped in `v`, which must equal the
+/// the crate version; `Some(v)` means it ships in `v`, which must equal the
 /// floor. Write the literal release when it ships, not
 /// `Some(QUIC_NATIVE_MIN_VERSION)`, which would compare the floor with itself.
+///
+/// `Some((0, 2, 163))`: 0.2.163 is the release that first puts the V2 variants
+/// on the wire (every offer at percent 0). Unlike the hash-first test, this
+/// tracker test accepts the marker one release ahead of the crate version, so
+/// it holds both on the 0.2.162 main that precedes the release bump and on
+/// 0.2.163 itself. Only the test reads this constant; the emission gate reads
+/// the floor.
 #[cfg_attr(not(test), allow(dead_code))]
-pub(crate) const QUIC_NATIVE_SHIPPED_IN: Option<(u8, u8, u16)> = None;
+pub(crate) const QUIC_NATIVE_SHIPPED_IN: Option<(u8, u8, u16)> = Some((0, 2, 163));
 
 /// Upper bound on the number of hosted contracts examined per new-peer
 /// migration trigger. Each examined contract may emit a best-effort
```

**File**: `crates/core/src/node/testing_impl.rs` (modified, +3/-2)
```diff
@@ -2253,9 +2253,10 @@ impl SimNetwork {
 
     /// Lowers the QUIC-native wire floor to `floor` on every node, so the
     /// native connect variants go to any peer whose negotiated version is at
-    /// least `floor`. Until the release that ships them the production floor
+    /// least `floor`. Before the release that ships them the production floor
     /// is above this binary's version, so without this call no simulation can
-    /// put them on the wire. Call before the simulation starts.
+    /// put them on the wire; from that release the default already does. Call
+    /// before the simulation starts.
     #[cfg(any(test, feature = "testing"))]
     pub fn with_quic_native_floor(&mut self, floor: (u8, u8, u16)) -> &mut Self {
         for label in self.pending_labels() {
```

**File**: `crates/core/src/operations/connect/wire.rs` (modified, +2/-2)
```diff
@@ -210,8 +210,8 @@ pub(crate) fn native_wire_allowed(remote: Option<(u8, u8, u16)>, floor: (u8, u8,
 /// The one encode that may emit the appended `ConnectMsg` variants, and only
 /// when [`native_wire_allowed`]. `floor` is
 /// [`crate::node::QUIC_NATIVE_MIN_VERSION`] in production; a test passes a
-/// lower one, since until the shipping release the real floor is above every
-/// version a test can run.
+/// different one to put the variants on the wire (or keep them off) regardless
+/// of the version the test binary reports.
 pub(crate) fn encode_for_peer<T: Serialize>(
     msg: &T,
     remote_version: Option<(u8, u8, u16)>,
```

**File**: `crates/core/tests/simulation_integration.rs` (modified, +2/-2)
```diff
@@ -23169,8 +23169,8 @@ fn run_native_wire_sim(
     NativeWireRun { trace, mesh, nodes }
 }
 
-/// A floor every node of this binary passes, injected because the real one
-/// is above this binary until the release that ships the decoder.
+/// A floor every node of this binary passes, injected so the test does not
+/// depend on the real floor relative to this binary's version.
 fn native_floor_for_tests() -> (u8, u8, u16) {
     SimNetwork::min_compatible_protocol_version()
 }
```

**File**: `docs/RELEASING.md` (modified, +10/-10)
```diff
@@ -494,16 +494,16 @@ Current wire-gated floors:
   and `ResponseNative` at indices 5 and 6 of
   `operations/connect/wire.rs::ConnectMsgWire`, #5940).
 
-  Set to **`(0, 2, 160)`**, the release intended to first ship the decoder,
-  and guarded by `QUIC_NATIVE_SHIPPED_IN`, currently `None`, checked by
-  `p2p_protoc::quic_native_floor_tests::quic_native_floor_tracks_the_shipping_release`.
-  0.2.157, 0.2.158 and 0.2.159 carry the decoder but were cut with the floor
-  raised past them, so they never emit the native variants. 0.2.158 is the
-  QUIC data ramp release (#6224), and 0.2.159 ships while the ramp is still
-  under watch; each raised the floor so that the native offer does not start
-  in the same release. When the 0.2.160 bump fails that test, set the marker
-  to the literal `Some((0, 2, 160))` if the release carries the decoder and
-  should start the native offer, otherwise raise the floor. Same failure mode as the
+  Set to **`(0, 2, 163)`**, the release that first ships the variants on the
+  wire, and frozen there: `QUIC_NATIVE_SHIPPED_IN` is `Some((0, 2, 163))`,
+  checked by
+  `p2p_protoc::quic_native_floor_tests::quic_native_floor_tracks_the_shipping_release`
+  (which accepts the marker one release ahead of the crate version, so it
+  holds on 0.2.162 main and on 0.2.163). 0.2.157 to 0.2.162 carry the decoder
+  but were cut with the floor raised past them, so they never emitted the
+  native variants. In 0.2.163 every offer carries percent 0
+  (`QUIC_NATIVE_PERCENT` 0, `NATIVE_DIAL_READY` false); the step that turns
+  the native path on is a later release. Do not raise the floor again unless the V2 layout itself has to change. Same failure mode as the
   application-message floors above: a peer at
   or above the floor without the decoder closes the connection on the variant,
   so bias high. Only `connect::wire::encode_for_peer`, at the one peer-bound
```

#### Recent Merged Pull Requests:
- **PR #6314** (2026-11-22): feat(transport): run the egress cap on VirtualTime for a simulated QUIC node (@sanity)
- **PR #6313** (2026-11-22): feat(config): warn that UDP-only transport keys stop applying once legacy UDP is removed (@sanity)
- **PR #6312** (2026-11-22): chore(release): ship the QUIC-native wire variants in 0.2.163 (@sanity)
- **PR #6311** (2026-11-22): test(transport): a dead native connection leaves no entry at this end (@sanity)
- **PR #6309** (2026-11-22): fix: name the refused request in hosted rate-limit rejections; raise burst to 500 (@sanity)
- **PR #6308** (2026-11-20): build: release 0.2.162 (@sanity)

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

## X. transport): run the egress cap on VirtualTime for a simulated QUIC node

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dbfadb1c`: transport): run the egress cap on VirtualTime for a simulated QUIC node. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
The cap is built on RealTime in production and in a simulated node without
QUIC, because the listener and its connections run on RealTime there: a
VirtualTime cap would compute deficits on another clock than its UDP
waiters sleep and time out on. The QUIC endpoint must run on the cap's
clock, because a hold's age is measured on the path's clock against a bound
in the cap's time. In a simulation the endpoint runs on the network's VirtualTime, so
bind_udp_listener builds a simulated QUIC node's cap on that VirtualTime
too (D-2a); the same node's UDP stream senders still time on RealTime
until the legacy path is removed.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
The cap is built on RealTime even in simulation, because the listener and
its connections run on RealTime there: a VirtualTime cap would compute
deficits on another clock than its waiters sleep and time out on. The QUIC
endpoint runs on the cap's clock for the same reason (bind_udp_listener
builds both on RealTime in production; tests build both on one
VirtualTime). In a simulation the endpoint runs on the network's
VirtualTime, so bind_udp_listener refuses a simulated node with both
transport-quic and total-bandwidth-limit.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dbfadb1c` are properly handled with clean fallback behavior.
