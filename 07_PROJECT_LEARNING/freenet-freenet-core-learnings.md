> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `76d7ef16`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T13:37:39.134Z  
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
> **Harvest Timestamp**: 2026-10-30T13:37:38.827Z  
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
- **Issue #6054** (2026-10-30): **fix: skip validate_state when an update leaves the state unchanged**
  *Symptoms*: ## Problem  In `crates/core/src/contract/executor/runtime/executor_impl.rs`, the upsert path ran `validate_state` on the merged state, through `fetch_related_for_validation`, before checking whether the merge had changed anything. Updates that leave the state unchanged therefore paid a full validation of bytes that were validated when they were stored. These include duplicates, replayed deltas, and records the contract's merge drops. That validation could also trigger a related-contract fetch. For a contract whose `validate_state` checks signatures over a large state, that is most of its time budget per message, spent on a no-op.  ## Approach  When the merge leaves the stored state unchanged, return `NoChange` before validating. Every state that differs from the stored one is still validated, and an invalid one is still rejected.  The same rule already applied one step earlier: the byte-identical incoming-state short-circuit (#4151) skips revalidating the stored state.  Two parts of the old code could no longer be reached and are reduced: - **Recovery condition.** A corrupted-state recovery cannot end with the stored state. Recovery installs the incoming full state, and an incoming state identical to the stored one has already returned at that short-circuit. The check is now a `debug_assert!`. - **Post-validation branch.** The old branch for an unchanged state after validation is removed. Its body, the changed-state path, is unchanged apart from indentation.  The rest of the 

- **Issue #6052** (2026-10-30): **test: bind the fdev websocket test to an OS-assigned port**
  *Symptoms*: ## Problem  `test_websocket_client_waits_for_put_response` in `crates/fdev/tests/websocket_response.rs` failed intermittently with `bind: AddrInUse` at its `TcpListener::bind`. The test bound a fixed localhost port counting up from 54000. That port is inside Linux's ephemeral range (32768-60999), so on a busy machine an outgoing connection can already hold it as its source port. When that happened, nothing was listening on 54000: `ss` showed only a TIME-WAIT socket whose local end was 127.0.0.1:54000.  ## Approach  Bind port 0 and read the assigned port back from `local_addr()`. The `AtomicU16` port counter is removed. No other test in the fdev crate binds a fixed port. `testing/network/v1.rs` binds a socket its caller supplies, and the `8080` in `commands/v1.rs` only builds a URL string.  ## Testing  - **Deterministic reproduction.** With a listener holding 127.0.0.1:54000, the test binary built from `origin/main` fails with `AddrInUse`, and the binary built from this branch passes. - **Repeat runs.** `cargo test -p fdev --test websocket_response` passed 20 times out of 20 in a loop on nova. - **Lints.** `cargo fmt --all --check` and `cargo clippy --all-targets -p fdev -- -D warnings` are clean.  [AI-assisted - Claude]  https://claude.ai/code/session_01XxpwztPzPYgRQuNM3tr9JW 

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

### Incident Patch 1: `76d7ef16` (2026-10-30)
**Commit Message**: fix(transport): contain panics in the QUIC socket adapter without aborting the node (#6027)

**File**: `.claude/rules/transport.md` (modified, +99/-14)
```diff
@@ -368,7 +368,9 @@ plus `egress_bytes`, `egress_bytes_waited`, `egress_wait_us_sum` / `_max`,
 ignored (`upgrade_control_received`) and hole-punch handshake packets dropped,
 one count per packet, because they were not encrypted under the attempt's
 inbound session key (`handshake_unauthenticated_dropped`), QUIC endpoint deaths
-(`quic_endpoint_down`), QUIC crash-loop breaker trips at startup
+(`quic_endpoint_down`), panics the QUIC socket adapter caught
+(`quic_adapter_panicked`, once per endpoint; the process keeps running
+and no breaker state is left), QUIC crash-loop breaker trips at startup
 (`quic_breaker_trips`, counted for any abnormal end of a QUIC-enabled run, not
 only a QUIC fault; see `quic/breaker.rs`) and whether the breaker keeps QUIC
 off in this process (`quic_breaker_suppressed`, a state that is never reset and
@@ -1332,18 +1334,93 @@ Liveness ("alive" = the endpoint driver has not ENDED; it does not mean
   quic_endpoint_down. Its connections end, accept() returns None and
   connect() fails as EndpointDown. The UDP transport is untouched.
   → NEVER feed endpoint death to ListenerExit: that exits the node.
-  → What this covers is narrow. quinn's driver returns only on a receive
-    I/O error and QuicSocket never returns one, so in production today it
-    cannot return at all; tests inject the error (socket::ReceiveFault).
-    The one real way it ends is a PANIC, which is NOT contained: quinn
-    0.11.12 polls the driver holding its endpoint state mutex
-    (endpoint.rs line 370), so a panic poisons it and every later lock
-    panics too, in EndpointDriver::drop (line 403), Accept::poll (line
-    651, the accept loop), connect (line 214) and the connection drivers;
-    one of those running during the unwind aborts the process. A panic is
-    never reported as Down. Containing a quinn panic (catch the unwind,
-    leak the driver instead of dropping it, guard the accept loop) is a
-    separate PREREQUISITE before QUIC is on by default.
+  → quinn's driver returns only on a receive I/O error. QuicSocket returns
+    one only after it caught a panic (below); tests inject one
+    (socket::SocketFaults::fail_receive).
+  → PANICS. The node relies on panic = "unwind". A build with
+    panic = "abort" still compiles, but QuicEndpoint::bind refuses
+    (require_unwinding, through bind_checked so tests drive it) and the
+    node runs with QUIC off; log_startup says so instead of describing the
+    configured mode. This covers a profile-level abort only.
+    CONTAINED: a panic in the socket adapter (QuicSocket::poll_recv,
+    try_send, QuicPoller::poll_writable), which quinn calls holding its
+    endpoint or connection state lock. The adapter catches it before it
+    unwinds into quinn (no lock poisoned), and
+    EndpointHealth::adapter_panicked turns the endpoint Down, counts
+    quic_adapter_panicked once per endpoint and logs ERROR once (quinn
+    also logs its own ERROR "I/O error" for each of its drivers that ends
+    with the error, so expect up to one such line per connection). The call
+    returns an io error (never Ready(Ok)/Ok, which would make a lasting
+    fault repeat on every transmit), ending that driver. From then on
+    every adapter call returns that error before the adapter's own code
+    runs (one AtomicBool load), so a lasting fault is hit once per
+    endpoint, and the adapter wakes the endpoint driver so it ends
+    promptly.
+  → After an adapter panic NOTHING more leaves the endpoint: no
+    CONNECTION_CLOSE reaches any peer, and peers find out from their own
+    idle timeout. Sending one would not work anyway: EndpointDriver::drop
+    drops each connection's event channel, and a connection driver that
+    sees that ends with INTERNAL_ERROR before it transmits (quinn 0.11.12
+    ConnectionDriver::poll). Pinned by
+    an_adapter_panic_ends_every_connection_and_counts_once.
+  → On EVERY Down (a returned driver too) each connection's watcher closes
+    it locally with DOWNGRADE; that is what fails calls waiting on a
+    driver that ended. QuicCloser counts a close in quic_close_sent_* only
+    while it can be sent (EndpointHealth::closes_can_be_sent: not Down,
+    no adapter panic), so the watcher's close and any close after an
+    adapter panic are not counted. Released alone closes nothing. An
+    adapter panic after Released is counted and logged but leaves it
+    Released; since every send of the endpoint then fails (which can end
+    any connection driver without closing its connection), each watcher
+    also closes its connection when EndpointHealth::adapter_panic_watch
+    turns true (pinned by an_adapter_panic_after_release_closes_its_connections).
+  → connect refuses before quinn sees the attempt when the endpoint is
+    Down or the adapter flag is set (EndpointHealth::refuses_connects).
+    After a driver return quinn already refuses; after an adapter panic it
+    refuses only once the woken endpoint driver has ru
```

**File**: `crates/core/Cargo.toml` (modified, +9/-1)
```diff
@@ -124,7 +124,15 @@ rustls = { version = "0.23", default-features = false, features = ["std"] }
 # crate's own Runtime over TimeSource, so simulation drives it), no
 # platform-verifier (peers are authenticated by raw public keys, never by a CA
 # root store), and no aws-lc-rs (deny.toml bans it).
-quinn = { version = "0.11.12", default-features = false, features = ["rustls-ring"] }
+# Pinned exactly: the panic containment in transport/quic relies on quinn
+# 0.11.12 internals (driver poll order, which destructors lock, respond()
+# sending without poll_writable). See .claude/rules/transport.md (PANICS)
+# and re-check those before bumping. This freezes quinn only: quinn-proto and
+# quinn-udp still float, which is intended, as the internals relied on live
+# in quinn itself. It also stops `cargo update` (and automated bumps) from
+# taking quinn patch releases, security fixes included, so taking one is a
+# deliberate step: bump this pin and re-check the transport.md items.
+quinn = { version = "=0.11.12", default-features = false, features = ["rustls-ring"] }
 # quinn's protocol crate, already in the graph under quinn. Named directly only
 # for `InvalidCid`, which quinn does not re-export and a connection-ID
 # generator's `validate` must return (transport/quic/cid.rs). No features of
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +8/-2)
```diff
@@ -3035,6 +3035,10 @@ fn event_kind_to_json(kind: &EventKind) -> serde_json::Value {
                 "quic_endpoint_down".into(),
                 serde_json::json!(snapshot.quic_endpoint_down),
             );
+            m.insert(
+                "quic_adapter_panicked".into(),
+                serde_json::json!(snapshot.quic_adapter_panicked),
+            );
             m.insert(
                 "quic_breaker_trips".into(),
                 serde_json::json!(snapshot.quic_breaker_trips),
@@ -7745,12 +7749,13 @@ mod tests {
         }
     }
 
-    /// The event-log JSON carries the QUIC endpoint-down and close-code
-    /// counts, with the same values serde gives.
+    /// The event-log JSON carries the QUIC endpoint-down, adapter-panic and
+    /// close-code counts, with the same values serde gives.
     #[test]
     fn transport_snapshot_json_carries_quic_endpoint_and_close_counts() {
         let snapshot = crate::transport::metrics::TransportSnapshot {
             quic_endpoint_down: 1,
+            quic_adapter_panicked: 5,
             quic_close_sent_node_dropped_peer: 2,
             quic_close_sent_downgrade: 3,
             quic_close_sent_identity_mismatch: 4,
@@ -7766,6 +7771,7 @@ mod tests {
         )));
         for (key, expected) in [
             ("quic_endpoint_down", 1),
+            ("quic_adapter_panicked", 5),
             ("quic_close_sent_node_dropped_peer", 2),
             ("quic_close_sent_downgrade", 3),
             ("quic_close_sent_identity_mismatch", 4),
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +76/-3)
```diff
@@ -614,17 +614,28 @@ pub struct TransportMetrics {
     conn_identity: [AtomicU32; ConnIdentity::COUNT],
 
     /// Times the QUIC endpoint went down while the node still held it (its
-    /// driver future returned), after which the node runs with QUIC off
-    /// (reset each snapshot). At most one per endpoint.
+    /// driver future returned, or the QUIC socket adapter caught a panic),
+    /// after which the node runs with QUIC off (reset each snapshot). At
+    /// most one per endpoint.
     quic_endpoint_down: AtomicU64,
+    /// QUIC endpoints whose socket adapter caught a panic, at most one per
+    /// endpoint however often the fault repeats; each turns that endpoint
+    /// off, unless the node had already released it (reset each snapshot).
+    /// A panic in a path's receive task is not counted here
+    /// (`receive_task_panicked`), and a panic in quinn's own driver code is
+    /// not caught at all.
+    quic_adapter_panicked: AtomicU64,
     /// Times the QUIC crash-loop breaker tripped at startup (reset each
     /// snapshot; at most one per process).
     quic_breaker_trips: AtomicU64,
     /// Whether the crash-loop breaker keeps QUIC off in this process (a
     /// state, never reset).
     quic_breaker_suppressed: AtomicBool,
     /// QUIC connections this node closed, by [`QuicCloseCode`] (reset each
-    /// snapshot).
+    /// snapshot). Counted when the close is queued, and only while it can
+    /// still be sent (not after the endpoint went Down or its socket adapter
+    /// caught a panic); a panic between the count and quinn's transmit can
+    /// still leave a counted close unsent, so this is an upper bound.
     quic_close_sent: [AtomicU64; QuicCloseCode::COUNT],
 
     /// The current snapshot period, starting at 1 and advanced by each
@@ -790,6 +801,11 @@ struct NatDetailCounters {
     /// down (bounded), one per `record_quic_endpoint_down`.
     #[cfg(test)]
     quic_endpoint_down_at: parking_lot::Mutex<std::collections::VecDeque<SocketAddr>>,
+    /// Test-only log of the local addresses of QUIC endpoints whose socket
+    /// adapter caught a panic (bounded), one per
+    /// `record_quic_adapter_panicked`.
+    #[cfg(test)]
+    quic_adapter_panicked_at: parking_lot::Mutex<std::collections::VecDeque<SocketAddr>>,
     /// Test-only log of QUIC closes this node sent, with the remote
     /// (bounded).
     #[cfg(test)]
@@ -1010,6 +1026,7 @@ impl TransportMetrics {
             handshake_unauthenticated_dropped: AtomicU64::new(0),
             conn_identity: Default::default(),
             quic_endpoint_down: AtomicU64::new(0),
+            quic_adapter_panicked: AtomicU64::new(0),
             quic_breaker_trips: AtomicU64::new(0),
             quic_breaker_suppressed: AtomicBool::new(false),
             quic_close_sent: Default::default(),
@@ -1448,6 +1465,28 @@ impl TransportMetrics {
         self.quic_endpoint_down.fetch_add(1, Ordering::Relaxed);
     }
 
+    /// The socket adapter of the QUIC endpoint bound at `local` caught its
+    /// first panic (`local` is never exported).
+    pub(crate) fn record_quic_adapter_panicked(&self, local: SocketAddr) {
+        #[cfg(test)]
+        push_test_log(&self.nat_detail.quic_adapter_panicked_at, local);
+        #[cfg(not(test))]
+        let _ = local;
+        self.quic_adapter_panicked.fetch_add(1, Ordering::Relaxed);
+    }
+
+    /// Test-only: how many times a socket-adapter panic was counted for the
+    /// QUIC endpoint bound at `local`.
+    #[cfg(test)]
+    pub(crate) fn quic_adapter_panicked_at(&self, local: SocketAddr) -> usize {
+        self.nat_detail
+            .quic_adapter_panicked_at
+            .lock()
+            .iter()
+            .filter(|addr| **addr == local)
+            .count()
+    }
+
     /// The QUIC crash-loop breaker tripped at startup
     /// (`quic::breaker`).
     pub(crate) fn record_quic_breaker_trip(&self) {
@@ -2086,6 +2125,7 @@ impl TransportMetrics {
             upgrade_control_received: get64(&self.upgrade_control_received),
             handshake_unauthenticated_dropped: get64(&self.handshake_unauthenticated_dropped),
             quic_endpoint_down: get64(&self.quic_endpoint_down),
+            quic_adapter_panicked: get64(&self.quic_adapter_panicked),
             quic_breaker_trips: get64(&self.quic_breaker_trips),
             quic_breaker_suppressed: self.quic_breaker_suppressed.load(Ordering::Relaxed),
             quic_close_sent_node_dropped_peer: get64(
@@ -2615,6 +2655,10 @@ pub struct TransportSnapshot {
     /// Times the QUIC endpoint went down while the node held it; the node
     /// then runs with QUIC off (#5940 e4).
     pub quic_endpoint_down: u64,
+    /// QUIC endpoints whose socket adapter caught a panic (at most one per
+    /// endpoint); each turns that endpoint off unless the node had already
+    /// released it (#5940). Not counted: a panic in a path's receive task.
+    pub quic_adapter_panicked: u64,
     /// Times the QUIC
```

**File**: `crates/core/src/transport/quic.rs` (modified, +167/-19)
```diff
@@ -76,7 +76,6 @@ use identity::{PeerKey, QuicIdentity};
 use liveness::EndpointHealth;
 
 pub(crate) use config::QuicSettings;
-#[cfg(test)]
 pub(crate) use liveness::QuicAvailability;
 pub(crate) use liveness::QuicAvailabilityWatch;
 
@@ -202,11 +201,14 @@ pub(crate) struct EndpointCore {
     identity: Arc<QuicIdentity>,
     /// The transport key each allowed client must present.
     expected_clients: Arc<ExpectedClients>,
+    /// The endpoint's health, handed to each connection (its watcher, and
+    /// its closer, which does not count a close after an adapter panic).
+    health: Arc<EndpointHealth>,
     /// The QUIC transmits the egress cap holds (`socket::CapHolds`).
     cap_holds: Arc<socket::CapHolds>,
-    /// Test hook that ends quinn's endpoint driver.
+    /// Test hooks that inject faults into quinn's drivers.
     #[cfg(test)]
-    receive_fault: Arc<socket::ReceiveFault>,
+    faults: Arc<socket::SocketFaults>,
     /// The type name of the clock quinn runs on (tests).
     #[cfg(any(test, feature = "testing"))]
     clock: &'static str,
@@ -383,6 +385,30 @@ pub(crate) enum QuicConnectError {
     Connection(#[from] quinn::ConnectionError),
 }
 
+/// The QUIC transport contains a panic in its socket adapter by catching
+/// the unwind (`socket`, `liveness`). A build with `panic = "abort"` cannot
+/// do that: the first such panic would end the process. So the endpoint is
+/// refused there, and the node runs with QUIC off (`bind_or_warn` logs it).
+/// A runtime check rather than a compile-time one, so such a build still
+/// compiles and runs with QUIC off. It covers a build whose profile sets
+/// `panic = "abort"`; this crate built to unwind and then linked into an
+/// aborting binary passes it.
+fn require_unwinding(unwinds: bool) -> io::Result<()> {
+    if unwinds {
+        Ok(())
+    } else {
+        Err(io::Error::new(
+            io::ErrorKind::Unsupported,
+            "this build aborts on panic (panic = \"abort\"), and the QUIC transport \
+             needs panics to unwind to contain them",
+        ))
+    }
+}
+
+/// Whether this build unwinds on panic, which the QUIC transport needs
+/// ([`require_unwinding`]).
+pub(crate) const UNWINDS: bool = cfg!(panic = "unwind");
+
 impl QuicEndpoint {
     /// Build an endpoint over `socket`, which must be the socket the
     /// listener reads (it fills the QUIC ingress queue), bound at
@@ -398,14 +424,30 @@ impl QuicEndpoint {
     /// endpoint receives nothing until a peer is allowed
     /// ([`Self::allow_peer`], or a connection this endpoint opens). Fails if
     /// the socket's ingress was already enabled, or if the TLS
-    /// configuration cannot be built.
+    /// configuration cannot be built, or if the build aborts on panic
+    /// ([`require_unwinding`]).
+    #[cfg_attr(not(test), allow(dead_code))]
     pub(crate) fn bind<S: Socket, T: TimeSource>(
         socket: Arc<DemuxSocket<S>>,
         local_addr: SocketAddr,
         time: T,
         settings: &QuicSettings,
         keypair: &TransportKeypair,
     ) -> io::Result<Self> {
+        Self::bind_checked(UNWINDS, socket, local_addr, time, settings, keypair)
+    }
+
+    /// [`Self::bind`] for a build that does (`unwinds`) or does not unwind
+    /// on panic; tests drive the aborting case through it.
+    fn bind_checked<S: Socket, T: TimeSource>(
+        unwinds: bool,
+        socket: Arc<DemuxSocket<S>>,
+        local_addr: SocketAddr,
+        time: T,
+        settings: &QuicSettings,
+        keypair: &TransportKeypair,
+    ) -> io::Result<Self> {
+        require_unwinding(unwinds)?;
         Self::bind_with(
             socket,
             local_addr,
@@ -416,22 +458,35 @@ impl QuicEndpoint {
         )
     }
 
-    /// [`Self::bind`], or `None` with a WARN when it fails, so a node with
-    /// `transport-quic = "prefer"` still starts, with QUIC off.
+    /// Build the endpoint as [`Self::bind`] describes, for this build
+    /// ([`UNWINDS`], through [`Self::bind_checked`]), or `None` with a WARN
+    /// when it fails, so a node with QUIC on still starts, with QUIC off.
     pub(crate) fn bind_or_warn<S: Socket, T: TimeSource>(
         socket: Arc<DemuxSocket<S>>,
         local_addr: SocketAddr,
         time: T,
         settings: &QuicSettings,
         keypair: &TransportKeypair,
     ) -> Option<Self> {
-        match Self::bind(socket, local_addr, time, settings, keypair) {
+        Self::bind_or_warn_checked(UNWINDS, socket, local_addr, time, settings, keypair)
+    }
+
+    /// [`Self::bind_or_warn`] through [`Self::bind_checked`].
+    fn bind_or_warn_checked<S: Socket, T: TimeSource>(
+        unwinds: bool,
+        socket: Arc<DemuxSocket<S>>,
+        local_addr: SocketAddr,
+        time: T,
+        settings: &QuicSettings,
+        keypair: &TransportKeypair,
+    ) -> Option<Self> {
+        match Self::bind_checked(unwinds, socket, local_addr, time, settings, keypair) {
             Ok(endpoint) => Some(endpoint
```

**File**: `crates/core/src/transport/quic/liveness.rs` (modified, +184/-17)
```diff
@@ -20,21 +20,62 @@
 //! - a driver task dropped without finishing (the runtime shutting down) is
 //!   not reported: the process is ending.
 //!
-//! What this does NOT cover: a PANIC in the driver. quinn's driver returns
-//! only on an I/O error from `drive_recv`, and [`QuicSocket`] never returns
-//! one, so in production today the driver cannot return at all; the only
-//! way it ends is a panic, and a panic is not contained. quinn 0.11.12 polls
-//! the driver while holding its endpoint state mutex
-//! (`EndpointDriver::poll`, `endpoint.rs` line 370: `state.lock().unwrap()`),
-//! so a panic there poisons it, and every later lock of it panics too:
-//! `EndpointDriver::drop` (line 403), `Accept::poll` (line 651, inside
-//! `quic_accept_loop`), `connect` (line 214) and the connection drivers. Where
-//! one of those runs while the first panic is still unwinding, the process
-//! aborts. So this circuit only reports a driver that RETURNED (tests inject
-//! that with a receive error, `socket::ReceiveFault`). Containing a quinn
-//! panic (catch the unwind, leak the driver instead of dropping it, guard
-//! the accept loop against the poisoned lock) is a separate prerequisite
-//! before QUIC is on by default.
+//! Panics. The node relies on unwinding (`panic = "unwind"`; a build that
+//! aborts on panic refuses to build the endpoint, `super::require_unwinding`,
+//! and runs with QUIC off), and what a panic does depends on where it
+//! starts:
+//!
+//! - In the node's socket adapter ([`QuicSocket`]: `poll_recv`, `try_send`,
+//!   `poll_writable`), which quinn calls while holding its endpoint or
+//!   connection state lock: CONTAINED. The adapter catches it before it
+//!   unwinds into quinn, so no lock is poisoned, and reports it through
+//!   [`EndpointHealth::adapter_panicked`]: the endpoint is `Down` (counted
+//!   in `quic_endpoint_down` and `quic_adapter_panicked`, and logged at
+//!   ERROR once by the node; quinn also logs its own ERROR "I/O error" for
+//!   each of its drivers that ends with the error, so a busy endpoint logs
+//!   one such line per connection whose driver ran into it), and the
+//!   adapter returns an I/O error, which ends the quinn driver that called
+//!   it cleanly. From then on every adapter call returns
+//!   that error without running the adapter's code. QUIC then stays off
+//!   until the node restarts: the endpoint driver ends at its next receive;
+//!   `connect` refuses at once (`QuicEndpoint::connect` checks);
+//!   a handshake in progress ends with an error (quinn's implicit close, see
+//!   `QuicIncoming::establish`); and each connection is closed locally by
+//!   its watcher (`QuicConnection::new`), so callers get an error instead of
+//!   waiting on a driver that has stopped. Peers are not told: no
+//!   CONNECTION_CLOSE leaves (see `socket`), so they find out from their own
+//!   idle timeout. A panic after the node released the endpoint is counted
+//!   and logged but leaves it `Released`; its connections (which the node
+//!   may still hold) are closed locally by their watchers all the same,
+//!   since every send of the endpoint now fails (see the watcher in
+//!   `QuicConnection::new`).
+//! - In the node's own per-connection tasks (the path's receive task, see
+//!   `path::supervise_receive`): contained per connection, which is closed
+//!   with DOWNGRADE, and not counted in `quic_adapter_panicked`.
+//! - In the node's runtime adapter ([`QuicRuntime`]: `now`, and
+//!   `QuicTimer::reset` / `poll`, which call the `TimeSource`, including
+//!   `sleep_until`): NOT contained. quinn calls them from its drivers under
+//!   the same state lock, so a panic there behaves as one in quinn's own
+//!   code (below). They have no error to return a panic as (`now` must
+//!   return an `Instant`), so they are not wrapped like the socket adapter.
+//! - In quinn's own code inside its endpoint or connection driver: NOT
+//!   contained, and it can abort the process. quinn 0.11.12 polls each
+//!   driver holding a `std::sync::Mutex` it locks with `.lock().unwrap()`,
+//!   so the panic poisons it, and quinn's destructors unwrap the poisoned
+//!   lock. For the endpoint driver that happens on every such panic: quinn
+//!   spawns it inside its own `async` block, and the unwind out of that
+//!   block drops the driver there, before any catch around the spawned
+//!   future (ours or tokio's) runs. `EndpointDriver::drop`
+//!   (`endpoint.rs:403`) and then `EndpointRef::drop` (`endpoint.rs:724`)
+//!   lock the poisoned mutex during the unwind, and the process aborts. For
+//!   a connection driver, `SendStream`, `RecvStream` and the last
+//!   `Connection` handle lock in their `Drop`, so dropping one afterwards
+//!   panics in whatever task drops it, and aborts the process if that drop
+//!   runs during an unwind. The fix belongs in quinn: those destructors
+//!   must tolerate a poisoned lock (both `endpoint.rs:403` and `:724` for
+//! 
```

**File**: `crates/core/src/transport/quic/socket.rs` (modified, +307/-46)
```diff
@@ -4,6 +4,32 @@
 //! fills; the endpoint never reads the UDP socket itself. Sending goes
 //! through the demux socket without waiting, and when the node has an egress
 //! cap each datagram is admitted by it first.
+//!
+//! quinn calls `poll_recv`, `try_send` and `poll_writable` while it holds its
+//! endpoint or connection state lock. A panic in them is caught here, before
+//! it unwinds into quinn (where it would poison that lock), and reported
+//! ([`EndpointHealth::adapter_panicked`]): the endpoint goes `Down`. The call
+//! then returns an I/O error, which ends the quinn driver that made it
+//! without looping. Every later call returns one too (one atomic load,
+//! before the adapter's own code runs), so a fault that lasts is hit once
+//! per endpoint, and the endpoint driver is woken for its next receive, so
+//! it ends promptly. See `super::liveness` for what is and is not
+//! contained.
+//!
+//! Sends fail too, so the endpoint's other connections do not send their
+//! CONNECTION_CLOSE: their peers learn of the end only from their own idle
+//! timeout. Sending it would not work anyway: once the endpoint driver
+//! ends, quinn's `EndpointDriver::drop` drops each connection's event
+//! channel, and a connection driver that sees that ends with
+//! INTERNAL_ERROR before it transmits (quinn 0.11.12,
+//! `ConnectionDriver::poll`), which is what usually happens first. Pinned
+//! by `an_adapter_panic_ends_every_connection_and_counts_once`.
+//!
+//! The catches use `AssertUnwindSafe`: the state a panic can interrupt here
+//! (the demux socket, its egress cap and allow-set) is shared with the UDP
+//! transport and is left as the panic left it, not repaired. Their locks
+//! (`parking_lot`, `DashMap`) do not poison, so UDP keeps working, but a
+//! panic part way through an update there could leave a count off.
 
 use std::fmt;
 use std::io::{self, IoSliceMut};
@@ -18,6 +44,7 @@ use quinn::udp::{RecvMeta, Transmit};
 use quinn::{AsyncUdpSocket, UdpPoller};
 
 use super::config::MAX_UDP_PAYLOAD;
+use super::liveness::EndpointHealth;
 use crate::transport::demux::{DemuxSocket, QuicIngressReceiver};
 use crate::transport::egress_cap::AdmissionWaiter;
 use crate::transport::{Socket, normalize_mapped_addr};
@@ -134,31 +161,117 @@ pub(crate) struct QuicSocket<S> {
     send_errors: AtomicU64,
     /// Whether the ingress queue's sending side is gone has been logged.
     ingress_closed_logged: AtomicBool,
-    /// Test hook: make the next receive fail, which ends quinn's endpoint
-    /// driver.
+    /// Told of a panic caught here.
+    health: Arc<EndpointHealth>,
+    /// The endpoint driver's waker from its last receive, woken when the
+    /// adapter catches a panic so the driver comes back to receive, gets the
+    /// error and ends (it might otherwise wait for a datagram that never
+    /// comes, since the endpoint's connections let their addresses go).
+    receive_waker: futures::task::AtomicWaker,
+    /// Test hooks: faults injected into quinn's drivers.
     #[cfg(test)]
-    receive_fault: Arc<ReceiveFault>,
+    faults: Arc<SocketFaults>,
 }
 
-/// Test hook: a socket error quinn's endpoint driver cannot get past, the
-/// way a socket that fails for good would end it.
+/// Test hooks: faults injected into quinn's drivers through this socket.
 #[cfg(test)]
 #[derive(Default)]
-pub(crate) struct ReceiveFault {
-    tripped: AtomicBool,
+pub(crate) struct SocketFaults {
+    /// What the endpoint's next receive does (`RECEIVE_*`).
+    receive: std::sync::atomic::AtomicU8,
     waker: parking_lot::Mutex<Option<std::task::Waker>>,
+    /// What the next write-readiness poll does (`WRITABLE_*`).
+    writable: std::sync::atomic::AtomicU8,
+    /// Write-readiness polls that reached the adapter's panicking hook.
+    writable_panics: AtomicU64,
+    /// Every send panics in the adapter's own code.
+    panic_sends: AtomicBool,
+    /// Every send returns `WouldBlock`, as when the socket's buffer or the
+    /// egress cap is short.
+    block_sends: AtomicBool,
+    /// Sends that reached the adapter's panicking hook.
+    send_panics: AtomicU64,
 }
 
 #[cfg(test)]
-impl ReceiveFault {
-    /// Fail the endpoint's next receive, and wake the driver so it makes
-    /// one.
-    pub(crate) fn trip(&self) {
-        self.tripped.store(true, Ordering::Release);
+const RECEIVE_OK: u8 = 0;
+#[cfg(test)]
+const RECEIVE_ERROR: u8 = 1;
+/// A panic in the adapter's own code, which it catches.
+#[cfg(test)]
+const RECEIVE_PANIC: u8 = 2;
+/// A panic that unwinds through quinn, as one in quinn's own code would.
+#[cfg(test)]
+const RECEIVE_PANIC_IN_QUINN: u8 = 3;
+/// Every write-readiness poll panics in the adapter's own code.
+#[cfg(test)]
+const WRITABLE_PANIC: u8 = 1;
+/// The next write-readiness poll panics in the adapter's own code, once.
+#[cfg(test)]
+const WRITABLE_PANIC_ONCE: u8 = 2;
+/// Panics of a lasting write-readiness fault after which its hook reports
+/// `Pending` instead 
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +1111/-1)
```diff
@@ -593,6 +593,7 @@ async fn attempt(
                             incoming.permit,
                             Some(incoming.hold),
                             incoming.peer,
+                            incoming.health,
                             incoming.cap_holds,
                         ))
                     }
@@ -1816,7 +1817,12 @@ fn the_socket_never_batches() {
             None,
         ));
         let ingress = demux.enable_quic_ingress().unwrap();
-        let socket = super::socket::QuicSocket::new(demux, ingress, addr);
+        let socket = super::socket::QuicSocket::new(
+            demux,
+            ingress,
+            addr,
+            super::liveness::EndpointHealth::new(addr),
+        );
         check(&socket);
         unregister_network_time_source(network);
     });
@@ -2021,6 +2027,7 @@ fn scripted(
             demux.clone(),
             ingress,
             local,
+            super::liveness::EndpointHealth::new(local),
         )),
         demux,
     )
@@ -2716,6 +2723,9 @@ fn endpoint_death_turns_quic_off_without_stopping_the_node() {
             QuicErrorKind::EndpointDown,
             "{ended:?}"
         );
+        assert!(ended_by_endpoint_down(&ended), "{ended:?}");
+        // The watcher's close on Down is not counted as a close sent.
+        assert!(TRANSPORT_METRICS.quic_close_sent_to(pair.b_addr).is_empty());
         let refused = pair
             .a
             .connect(pair.b_addr, &pair.b_key())
@@ -3165,3 +3175,1103 @@ fn concurrent_closers_close_and_count_once() {
         assert_eq!(TRANSPORT_METRICS.quic_close_sent_to(pair.b_addr).len(), 1);
     });
 }
+
+/// Whether `error` is one of the two ways a connection ends locally when its
+/// endpoint goes down: the watcher's local close, or quinn's own
+/// INTERNAL_ERROR when the endpoint driver was dropped. Any other error (a
+/// peer's close, a crypto or protocol error, an idle timeout) is not.
+fn ended_by_endpoint_down(error: &quinn::ConnectionError) -> bool {
+    match error {
+        quinn::ConnectionError::LocallyClosed => true,
+        quinn::ConnectionError::TransportError(e) => {
+            e.code == quinn::TransportErrorCode::INTERNAL_ERROR
+        }
+        quinn::ConnectionError::VersionMismatch
+        | quinn::ConnectionError::ConnectionClosed(_)
+        | quinn::ConnectionError::ApplicationClosed(_)
+        | quinn::ConnectionError::Reset
+        | quinn::ConnectionError::TimedOut
+        | quinn::ConnectionError::CidsExhausted => false,
+    }
+}
+
+/// Set in the child process [`in_child`] starts.
+const PANIC_CHILD_ENV: &str = "FREENET_QUIC_PANIC_CHILD";
+
+/// Run `body` in a child process: the test binary re-run on the one test
+/// named `name` (under `transport::quic::tests`). A panic that is not
+/// contained aborts the process, and that must fail one test, not take
+/// every test running beside it down.
+fn in_child(name: &str, body: impl FnOnce()) {
+    if std::env::var_os(PANIC_CHILD_ENV).is_some() {
+        body();
+        return;
+    }
+    let (test, output) = run_child(name);
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    let stderr = String::from_utf8_lossy(&output.stderr);
+    assert!(
+        output.status.success(),
+        "the child running {test} failed ({}).\nstdout:\n{stdout}\nstderr:\n{stderr}",
+        output.status
+    );
+    // libtest exits 0 when its filter matches nothing: a rename must fail.
+    assert!(
+        stdout.contains("1 passed"),
+        "the child did not run {test}; was it renamed?\nstdout:\n{stdout}\nstderr:\n{stderr}"
+    );
+}
+
+/// Re-run the test binary on the one test `name`, with [`PANIC_CHILD_ENV`].
+fn run_child(name: &str) -> (String, std::process::Output) {
+    // The running image: after a concurrent rebuild replaces the test
+    // binary, Linux current_exe() reports "<path> (deleted)" (#5185).
+    let exe = if cfg!(target_os = "linux") {
+        std::path::PathBuf::from("/proc/self/exe")
+    } else {
+        std::env::current_exe().expect("test binary path")
+    };
+    let test = format!("transport::quic::tests::{name}");
+    let mut command = std::process::Command::new(exe);
+    // Core dumps off in the child: one that aborts (the pinned test does, by
+    // design) must not leave a core file on the host.
+    #[cfg(unix)]
+    // SAFETY: setrlimit(2) is async-signal-safe, and the struct it reads is
+    // owned by the closure.
+    unsafe {
+        use std::os::unix::process::CommandExt;
+        command.pre_exec(|| {
+            let none = libc::rlimit {
+                rlim_cur: 0,
+                rlim_max: 0,
+            };
+            if libc::setrlimit(libc::RLIMIT_CORE, &none) != 0 {
+                return Err(std::io::Error::last_os_error());
+            }
+            Ok(())
+        });
+    }
+    let mut child = command
+        .args(["--exact", "--test-threads=1", "--nocapture", &test])
+        .env(PANIC_CHILD_ENV, "1")
+        .st
```

---

### Incident Patch 2: `6111b563` (2026-10-30)
**Commit Message**: fix: skip validate_state when an update leaves the state unchanged (#6054)

**File**: `crates/core/src/contract/executor/mock_wasm_runtime.rs` (modified, +9/-0)
```diff
@@ -21,6 +21,9 @@ pub(crate) enum ValidateOverride {
     EmptyRequestRelated,
     /// `Valid` exactly when the predicate holds for the state bytes.
     ValidWhen(fn(&[u8]) -> bool),
+    /// Always `Valid`, recording the bytes of every state validated, so a test
+    /// can assert which states were (and were not) validated.
+    Record(std::sync::Arc<std::sync::Mutex<Vec<Vec<u8>>>>),
 }
 
 /// Configurable `update_state` behavior for testing related contract flows.
@@ -285,6 +288,12 @@ impl ContractRuntimeInterface for MockWasmRuntime {
                         ValidateResult::Invalid
                     }
                 }
+                ValidateOverride::Record(seen) => {
+                    seen.lock()
+                        .unwrap_or_else(|e| e.into_inner())
+                        .push(_state.as_ref().to_vec());
+                    ValidateResult::Valid
+                }
             });
         }
         Ok(ValidateResult::Valid)
```

**File**: `crates/core/src/contract/executor/pool_tests.rs` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ mod delegate_notification_wasm_tests;
 mod disk_budget_gate_tests;
 mod identical_input_probe_tests;
 mod merge_rejected_tests;
+mod no_change_validation_tests;
 mod non_idempotent_detector_tests;
 #[cfg(feature = "wasmtime-backend")]
 mod params_integrity_wasm_tests;
```

**File**: `crates/core/src/contract/executor/pool_tests/no_change_validation_tests.rs` (added, +368/-0)
```diff
@@ -0,0 +1,368 @@
+//! Regression tests for #6050: an update whose merge leaves the stored state
+//! unchanged must not run `validate_state` on that unchanged state.
+//!
+//! The stored state was validated when it was stored, so validating identical
+//! bytes again adds nothing, and for a contract whose `validate_state` checks
+//! signatures over a large state it was most of the cost of every duplicate or
+//! replayed update. Every state that DOES change must still be validated, and an
+//! invalid one must still be rejected.
+
+use either::Either;
+use freenet_stdlib::prelude::*;
+use std::cell::RefCell;
+use std::rc::Rc;
+use std::sync::{Arc, Mutex};
+
+use crate::contract::executor::mock_wasm_runtime::{
+    MockWasmRuntime, UpdateOverride, ValidateOverride,
+};
+use crate::contract::executor::{ContractExecutor, Executor, UpsertOutcome, UpsertResult};
+use crate::wasm_runtime::MockStateStorage;
+
+const STORED: [u8; 3] = [1, 2, 3];
+
+/// An executor holding a contract whose stored state is [`STORED`].
+async fn executor_with_stored_state(
+    name: &str,
+) -> (Executor<MockWasmRuntime, MockStateStorage>, ContractKey) {
+    let mut executor = Executor::new_mock_wasm(name, MockStateStorage::new(), None, None)
+        .await
+        .expect("create MockWasmRuntime executor");
+    let code = ContractCode::from(name.as_bytes().to_vec());
+    let contract = ContractContainer::Wasm(ContractWasmAPIVersion::V1(WrappedContract::new(
+        Arc::new(code),
+        Parameters::from(vec![]),
+    )));
+    let key = contract.key();
+    executor
+        .upsert_contract_state(
+            key,
+            Either::Left(WrappedState::new(STORED.to_vec())),
+            RelatedContracts::default(),
+            Some(contract),
+        )
+        .await
+        .expect("initial PUT should succeed");
+    (executor, key)
+}
+
+/// Record every state `validate_state` is called on from here on.
+fn record_validations(
+    executor: &mut Executor<MockWasmRuntime, MockStateStorage>,
+    key: &ContractKey,
+) -> Arc<Mutex<Vec<Vec<u8>>>> {
+    let seen = Arc::new(Mutex::new(Vec::new()));
+    executor
+        .runtime
+        .validate_overrides
+        .insert(*key.id(), ValidateOverride::Record(seen.clone()));
+    seen
+}
+
+fn keep_current(current: &[u8], _incoming: &[u8]) -> Vec<u8> {
+    current.to_vec()
+}
+
+fn take_incoming(_current: &[u8], incoming: &[u8]) -> Vec<u8> {
+    incoming.to_vec()
+}
+
+fn union(current: &[u8], incoming: &[u8]) -> Vec<u8> {
+    let mut out = [current, incoming].concat();
+    out.sort_unstable();
+    out.dedup();
+    out
+}
+
+/// A full state the merge drops leaves the stored state unchanged. Only the
+/// incoming full state is validated (on entry, as before); the stored state is not
+/// validated again.
+#[tokio::test(flavor = "current_thread")]
+async fn a_dropped_full_state_does_not_validate_the_unchanged_state() {
+    let (mut executor, key) = executor_with_stored_state("dropped_full_state").await;
+    executor
+        .runtime
+        .update_overrides
+        .insert(*key.id(), UpdateOverride::MergeWith(keep_current));
+    let seen = record_validations(&mut executor, &key);
+
+    let result = executor
+        .upsert_contract_state(
+            key,
+            Either::Left(WrappedState::new(vec![9])),
+            RelatedContracts::default(),
+            None,
+        )
+        .await
+        .expect("a dropped update is not an error");
+    assert!(matches!(result, UpsertResult::NoChange), "{result:?}");
+    assert_eq!(*seen.lock().unwrap(), vec![vec![9]]);
+}
+
+/// A delta the merge ignores leaves the stored state unchanged and validates
+/// nothing.
+#[tokio::test(flavor = "current_thread")]
+async fn an_ignored_delta_validates_nothing() {
+    let (mut executor, key) = executor_with_stored_state("ignored_delta").await;
+    executor
+        .runtime
+        .update_overrides
+        .insert(*key.id(), UpdateOverride::MergeWith(keep_current));
+    let seen = record_validations(&mut executor, &key);
+
+    let result = executor
+        .upsert_contract_state(
+            key,
+            Either::Right(StateDelta::from(vec![7])),
+            RelatedContracts::default(),
+            None,
+        )
+        .await
+        .expect("an ignored delta is not an error");
+    assert!(matches!(result, UpsertResult::NoChange), "{result:?}");
+    assert!(
+        seen.lock().unwrap().is_empty(),
+        "{:?}",
+        seen.lock().unwrap()
+    );
+}
+
+/// The same holds through the deferrable entry the UPDATE driver uses: a no-op
+/// completes as `NoChange` without validating.
+#[tokio::test(flavor = "current_thread")]
+async fn a_no_op_through_the_deferrable_entry_validates_nothing() {
+    let (mut executor, key) = executor_with_stored_state("deferrable_no_op").await;
+    executor
+        .runtime
+        .update_overrides
+        .insert(*key.id(), UpdateOverride::MergeWith(keep_current));
+    let seen = record_vali
```

**File**: `crates/core/src/contract/executor/runtime/executor_impl.rs` (modified, +67/-55)
```diff
@@ -1285,6 +1285,28 @@ where
                 .remove(&key);
         }
 
+        // A merge that left the stored state unchanged needs no validation: those
+        // bytes were validated when they were stored, and validating them again
+        // costs a full `validate_state` (and possibly a related-contract fetch)
+        // on every duplicate or replayed update (#6050).
+        //
+        // Consequence: a stored state that has become invalid since it was stored
+        // (post-write corruption that still decodes, a time-dependent
+        // `validate_state`, a related contract that changed) no longer makes a
+        // no-op update fail with "invalid outcome state". It is surfaced by the
+        // next update that changes it. No repair depended on the old error: it
+        // re-fired on every update and never replaced the state.
+        if updated_state.as_ref() == current_state.as_ref() {
+            // Recovery installs the incoming full state, and an incoming state
+            // identical to the stored one already returned at the byte-identical
+            // short-circuit above, so a recovery cannot end here.
+            debug_assert!(
+                !recovery_performed,
+                "a corrupted-state recovery produced the stored state"
+            );
+            return Ok(UpsertResult::NoChange);
+        }
+
         let result = self
             .fetch_related_for_validation(
                 &key,
@@ -1298,64 +1320,54 @@ where
         if result != ValidateResult::Valid {
             return Err(Self::validation_error(key, result));
         }
-        if updated_state.as_ref() == current_state.as_ref() {
-            Ok(UpsertResult::NoChange)
-        } else {
-            // Sampled re-apply probe. With low probability, re-apply the
-            // incoming full state to `updated_state`. A re-apply that changes
-            // the content is a strict associativity failure on (S, X, X); the
-            // contract is flagged only when the conformance verifier's heal
-            // step shows the merge does not settle (a mutate-on-every-apply or
-            // cycling contract, which storms the network), not when it changes
-            // once and reconciles. See `reapply_probe` and
-            // `crate::ring::broken_invariants`.
-            //
-            // `RelatedState` inputs are skipped: re-applying a cross-
-            // contract state hint isn't required to be a no-op by the
-            // contract ABI, so probing it can produce false positives.
-            // Not after a corrupted-state recovery: there `updated_state` is the
-            // incoming state rather than a merge with the stored one, so the
-            // probe's premise does not hold. Not after a related-state retry
-            // either: there `updated_state` was computed with fetched
-            // `RelatedState` entries that the probe's re-apply would lack.
-            if !recovery_performed && !related_retry_performed {
-                self.maybe_probe_idempotency(
-                    &key,
-                    &params,
-                    &current_state,
-                    &updated_state,
-                    &updates,
-                )
+        // Sampled re-apply probe. With low probability, re-apply the
+        // incoming full state to `updated_state`. A re-apply that changes
+        // the content is a strict associativity failure on (S, X, X); the
+        // contract is flagged only when the conformance verifier's heal
+        // step shows the merge does not settle (a mutate-on-every-apply or
+        // cycling contract, which storms the network), not when it changes
+        // once and reconciles. See `reapply_probe` and
+        // `crate::ring::broken_invariants`.
+        //
+        // `RelatedState` inputs are skipped: re-applying a cross-
+        // contract state hint isn't required to be a no-op by the
+        // contract ABI, so probing it can produce false positives.
+        // Not after a corrupted-state recovery: there `updated_state` is the
+        // incoming state rather than a merge with the stored one, so the
+        // probe's premise does not hold. Not after a related-state retry
+        // either: there `updated_state` was computed with fetched
+        // `RelatedState` entries that the probe's re-apply would lack.
+        if !recovery_performed && !related_retry_performed {
+            self.maybe_probe_idempotency(&key, &params, &current_state, &updated_state, &updates)
                 .await;
-            }
-
-            if self
-                .op_manager
-                .as_ref()
-                .map(|m| m.ring.is_contract_broken(&key))
-                .unwrap_or(false)
-            {
-                // Probe just flagged this contract (or it was already
-                // flagged). Skip the commit so we don't extend the
-                // problematic state, and surface the suppression to
-                // ca
```

---

### Incident Patch 3: `fe2341c5` (2026-10-30)
**Commit Message**: fix(fdev): count verify-merge cases that never ran (#6043)

**File**: `crates/core/src/conformance.rs` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ pub use evidence::{
     EvidenceRejected,
 };
 pub use focus::FocusSelector;
-pub use generator::{GeneratorConfig, generate_cases};
+pub use generator::{GeneratedCases, GeneratorConfig, generate_cases, generate_cases_counted};
 pub use host_clock::{
     HOST_CLOCK_DEPRECATION_DOC, HOST_CLOCK_IMPORT, HOST_CLOCK_NAMESPACE, imports_host_clock,
 };
```

**File**: `crates/core/src/conformance/generator.rs` (modified, +163/-34)
```diff
@@ -171,8 +171,15 @@ pub struct GeneratorConfig {
     pub properties: Vec<ConformanceProperty>,
     /// Skip any case whose inputs exceed this. Keeps a handful of very large states
     /// from dominating the run.
+    ///
+    /// A skipped case never runs, so a property can read as held while the cases
+    /// that would break it were the ones skipped. A contract that is wrong only near
+    /// its size cap is exactly that shape (#5705). [`generate_cases_counted`]
+    /// counts the cases skipped for size and for the case budget per property, and
+    /// `fdev verify-merge` reports them. Cases left out by state sampling are not
+    /// counted; only the number of states sampled is. The shadow prober still uses the uncounted [`generate_cases`]; see #6044.
     pub max_case_bytes: usize,
-    /// Cap on states considered for pairing, since pairs grow quadratically.
+    /// Cap on states the state-based laws use, since pairs grow quadratically.
     pub max_states_paired: usize,
     /// Cap on recorded steps considered for `TransitionPathAgreement`.
     ///
@@ -199,56 +206,138 @@ impl Default for GeneratorConfig {
     }
 }
 
-/// Build cases from a corpus.
+/// What [`generate_cases_counted`] built, and what it refused to build.
+#[derive(Debug, Default, Clone)]
+pub struct GeneratedCases {
+    pub cases: Vec<ConformanceCase>,
+    /// One entry per entry of [`GeneratorConfig::properties`], in that order: how
+    /// many cases were built for the property and then dropped because their inputs
+    /// exceeded [`GeneratorConfig::max_case_bytes`].
+    ///
+    /// Zero entries are kept, so a consumer can tell "nothing was skipped" from
+    /// "this property was not counted".
+    pub oversized: Vec<(ConformanceProperty, usize)>,
+    /// Parallel to `oversized`: cases that passed the size limit and were then left
+    /// out because the [`GeneratorConfig::max_cases`] budget ran out first.
+    ///
+    /// Disjoint from `oversized`, so the two add up to every built case that did not
+    /// run. Raising the size limit can move cases from `oversized` to here, which is
+    /// why the budget needs its own count.
+    pub budget_cut: Vec<(ConformanceProperty, usize)>,
+    /// How many states the state-based laws used, out of `corpus.states.len()`.
+    /// Below the total when the corpus exceeds [`GeneratorConfig::max_states_paired`].
+    pub states_paired: usize,
+    /// How many recorded transitions were used, out of `corpus.transitions.len()`.
+    /// Below the total when the corpus exceeds [`GeneratorConfig::max_transitions`].
+    pub transitions_sampled: usize,
+}
+
+impl GeneratedCases {
+    /// Over-size cases across every property.
+    pub fn oversized_total(&self) -> usize {
+        self.oversized.iter().map(|(_, n)| n).sum()
+    }
+
+    /// Budget-cut cases across every property.
+    pub fn budget_cut_total(&self) -> usize {
+        self.budget_cut.iter().map(|(_, n)| n).sum()
+    }
+}
+
+/// Build cases from a corpus, discarding the count of over-size cases skipped.
+///
+/// A thin wrapper over [`generate_cases_counted`] for callers that only need the
+/// cases. A caller that reports a verdict to anyone must use the counted form:
+/// without the count, "every case held" cannot be told apart from "the cases that
+/// would have failed were too large to run" (#5705).
+pub fn generate_cases(corpus: &Corpus, config: &GeneratorConfig) -> Vec<ConformanceCase> {
+    generate_cases_counted(corpus, config).cases
+}
+
+/// Build cases from a corpus, and count the cases skipped for size and for budget.
 ///
 /// Deterministic given `(corpus, config)`: the same inputs produce the same cases in
 /// the same order, so a run that finds something can be re-run and a run that finds
 /// nothing can be compared against a later one.
-pub fn generate_cases(corpus: &Corpus, config: &GeneratorConfig) -> Vec<ConformanceCase> {
+pub fn generate_cases_counted(corpus: &Corpus, config: &GeneratorConfig) -> GeneratedCases {
+    let zeros = || config.properties.iter().map(|p| (*p, 0)).collect();
     if corpus.is_empty() {
-        return Vec::new();
+        return GeneratedCases {
+            cases: Vec::new(),
+            oversized: zeros(),
+            budget_cut: zeros(),
+            states_paired: 0,
+            transitions_sampled: 0,
+        };
     }
 
     // Per-property queues, filled independently and then interleaved. The
     // interleave is the point: a corpus big enough to blow the case budget on
     // commutativity alone would otherwise never reach associativity, and the
     // budget would silently decide which laws get checked.
     let mut queues: Vec<Vec<ConformanceCase>> = Vec::new();
+    let mut oversized = Vec::with_capacity(config.properties.len());
     for property in &config.properties {
-        queues.push(cases_for(*property, corpus, config));
+        let (queue, skipped) = cases_for(*property, corpus, config);
+        queues.push(queue);
+       
```

**File**: `crates/core/src/conformance/tests.rs` (modified, +318/-7)
```diff
@@ -22,7 +22,9 @@ use super::evidence::{
     ConformanceEvidence, EvidenceError, EvidenceRejected, MAX_EVIDENCE_ENCODED_BYTES,
     MAX_EVIDENCE_INPUT_BYTES, MAX_EVIDENCE_RELATED, MAX_EVIDENCE_TEXT_BYTES,
 };
-use super::generator::{Corpus, GeneratorConfig, generate_cases};
+use super::generator::{
+    Corpus, GeneratedCases, GeneratorConfig, generate_cases, generate_cases_counted,
+};
 use super::oracle::{ConformanceOracle, OracleError};
 use super::property::{
     ConformanceProperty, IdempotenceSettling, Inconclusive, OutputDigest, PremiseSource,
@@ -2751,13 +2753,12 @@ fn the_transition_branch_is_bounded_and_strided() {
     assert_eq!(cases.len(), 4, "the cap must bind");
     // Strided over the whole history rather than the first four.
     //
-    // Say what this actually pins: the four selected steps are spread across the
-    // range, not the first four. Index 39 is NOT selected — a stride of 10 from 0
-    // reaches 30 — so this is not a claim that the newest step is reachable. What it
-    // rules out is truncation, under which the bases would be `[0, 1, 2, 3]` and a
-    // contract would only ever be checked against its own oldest few minutes.
+    // The four selected steps are spread across the range, not the first four, and
+    // the last is the newest step (39), not the stride's 30 (#5705). Truncation
+    // would give `[0, 1, 2, 3]` and check a contract only against its own oldest few
+    // minutes.
     let bases: Vec<u8> = cases.iter().map(|c| c.states[0][0]).collect();
-    assert_eq!(bases, vec![0, 10, 20, 30]);
+    assert_eq!(bases, vec![0, 10, 20, 39]);
     assert_ne!(
         bases,
         vec![0, 1, 2, 3],
@@ -4108,6 +4109,316 @@ fn a_tight_case_budget_still_covers_every_law() {
     );
 }
 
+/// Regression (#5705): a case over `max_case_bytes` was dropped without a count.
+///
+/// The report counted only the cases that ran, so a property whose breaking cases
+/// were all too large read as held. The count must come from the filter itself and
+/// must equal exactly what the filter dropped: raising the limit must turn every
+/// counted case into a generated one, and no more.
+#[test]
+fn oversized_cases_are_counted_per_property_not_dropped_silently() {
+    // Three small states and one large one. Commutativity pairs all four: six pairs,
+    // three of which include the large state.
+    let corpus = Corpus::from_states(vec![vec![1, 1], vec![2, 2], vec![3, 3], vec![9; 64]]);
+    let limited = GeneratorConfig {
+        properties: vec![
+            ConformanceProperty::StateCommutativity,
+            ConformanceProperty::StateIdempotence,
+        ],
+        max_case_bytes: 16,
+        ..Default::default()
+    };
+    let generated = generate_cases_counted(&corpus, &limited);
+    assert_eq!(
+        generated.oversized,
+        vec![
+            (ConformanceProperty::StateCommutativity, 3),
+            (ConformanceProperty::StateIdempotence, 1),
+        ],
+        "every case dropped for size must be counted against its property"
+    );
+    assert_eq!(generated.oversized_total(), 4);
+    assert_eq!(generated.cases.len(), 3 + 3);
+
+    let unlimited = GeneratorConfig {
+        max_case_bytes: usize::MAX,
+        ..limited.clone()
+    };
+    let all = generate_cases_counted(&corpus, &unlimited);
+    assert_eq!(all.oversized_total(), 0);
+    assert_eq!(
+        all.cases.len(),
+        generated.cases.len() + generated.oversized_total(),
+        "the count must be exactly the cases the size limit removed"
+    );
+
+    // A property every one of whose cases is too large produces no case at all, and
+    // the count is the only thing that says why.
+    let huge = Corpus::from_states(vec![vec![7; 64], vec![8; 64]]);
+    let none = generate_cases_counted(&huge, &limited);
+    assert!(none.cases.is_empty());
+    assert_eq!(
+        none.oversized,
+        vec![
+            (ConformanceProperty::StateCommutativity, 1),
+            (ConformanceProperty::StateIdempotence, 2),
+        ]
+    );
+    // The uncounted wrapper still returns the same cases.
+    assert_eq!(
+        generate_cases(&corpus, &limited).len(),
+        generated.cases.len()
+    );
+}
+
+/// Every property's size count is exactly what the size limit removed.
+///
+/// One corpus that feeds every generator branch (pairs, triples, deltas with a shared
+/// base, summaries, a recorded transition), run over every property. Raising the size
+/// limit must turn each property's counted cases into generated ones and no more, so
+/// a branch that dropped a case without counting it fails here.
+#[test]
+fn every_property_counts_exactly_the_cases_the_size_limit_removed() {
+    let big = vec![9u8; 64];
+    let base = bytes(&[1, 1]);
+    let corpus = Corpus {
+        deltas: vec![bytes(&[5]), bytes(&[6]), bytes(&big)],
+        delta_bases: vec![Some(base.clone()), Some(base.clone()), Some(base)],
+        summaries: vec![bytes(&[7]), bytes(&big)],
+        transiti
```

**File**: `crates/fdev/src/conformance.rs` (modified, +1074/-68)
```diff
@@ -32,10 +32,10 @@ use freenet::conformance::generator::Corpus;
 use freenet::conformance::host_clock;
 use freenet::conformance::verifier::Bytes;
 use freenet::conformance::{
-    ConformanceCase, ConformanceEvidence, ConformanceProperty, EvidenceRejected, GeneratorConfig,
-    IdempotenceSettling, Inconclusive, MinimizeConfig, OracleBuildError, PropertyOutcome,
-    RemovalTier, ReplayBundle, RuntimeOracle, Severity, Transition, generate_cases,
-    minimize_toward, removal_tier, verify_case,
+    ConformanceCase, ConformanceEvidence, ConformanceProperty, EvidenceRejected, GeneratedCases,
+    GeneratorConfig, IdempotenceSettling, Inconclusive, MinimizeConfig, OracleBuildError,
+    PropertyOutcome, RemovalTier, ReplayBundle, RuntimeOracle, Severity, Transition,
+    generate_cases_counted, minimize_toward, removal_tier, verify_case,
 };
 use freenet_stdlib::prelude::{CodeHash, ContractCode, ContractInstanceId, State, UpdateData};
 use serde::Serialize;
@@ -49,6 +49,9 @@ use serde::Serialize;
 /// (`Severity::Violation`) does, including a break of a law the network only
 /// reports and never acts on (`freenet::conformance::policy::removal_tier`): an
 /// author should hear about every broken law, whatever the network does about it.
+/// Cases skipped for size or for the case budget do not change the exit code while
+/// any case runs; the report counts them per property. A run where every case was
+/// skipped checked nothing and exits non-zero.
 #[derive(clap::Parser, Clone)]
 pub struct ConformanceConfig {
     /// Path to the compiled contract WASM. Required unless `--bundle` supplies
@@ -115,6 +118,21 @@ pub struct ConformanceConfig {
     #[arg(long)]
     pub(crate) max_cases: Option<usize>,
 
+    /// Skip any generated case whose inputs (states, deltas and summary) total
+    /// more than this many bytes. Defaults to the generator's own default
+    /// (currently 4 MiB).
+    ///
+    /// Skipped cases never run, so a property can hold on the cases that ran
+    /// while the cases that would break it were skipped. The report counts the
+    /// cases skipped for size and for the case budget per property; cases left
+    /// out by state sampling are reported only as states sampled of total.
+    /// Skipped cases do not change the exit code, unless every case was skipped,
+    /// which exits non-zero. Raise this to check a contract at its size ceiling:
+    /// a merge that is wrong only for a full-size state is invisible below it.
+    /// Has no effect with `--evidence`, which re-checks one shipped case.
+    #[arg(long)]
+    pub(crate) max_case_bytes: Option<usize>,
+
     /// Restrict which laws to check, by name (e.g. `state_commutativity`).
     /// Repeat for multiple. Defaults to every property.
     #[arg(long = "property")]
@@ -186,31 +204,19 @@ pub async fn conformance(config: ConformanceConfig) -> anyhow::Result<()> {
         anyhow::bail!("no states to check: the corpus is empty");
     }
 
-    let mut generator_config = GeneratorConfig::default();
-    if let Some(max_cases) = config.max_cases {
-        generator_config.max_cases = max_cases;
-    }
-    if !properties.is_empty() {
-        generator_config.properties = properties;
-    }
-
-    let cases = generate_cases(&corpus, &generator_config);
+    let generator_config = generator_config(&config, properties);
+    let generated = generate_cases_counted(&corpus, &generator_config);
     // A run that checked nothing must not report success. Restricting to a property
     // whose inputs the corpus cannot supply (commutativity with one state, delta
     // idempotence with no captured deltas) otherwise prints "0 cases run" and exits
     // 0, which any automation reads as "this contract passed".
-    if cases.is_empty() {
+    if generated.cases.is_empty() {
         report_code_diagnostics_standalone(&code_diagnostics);
-        anyhow::bail!(
-            "no cases could be generated from this corpus: {} state(s), {} delta(s), \
-             {} summary/summaries for the selected properties. Nothing was checked, \
-             so this is not a pass — supply more states (commutativity and \
-             reconciliation need at least two), captured deltas for the delta \
-             properties, or --transition BASE RESULT for transition_path_agreement.",
-            corpus.states.len(),
-            corpus.deltas.len(),
-            corpus.summaries.len(),
-        );
+        anyhow::bail!(no_cases_message(
+            &corpus,
+            &generated.oversized,
+            generator_config.max_case_bytes,
+        ));
     }
 
     if let Some(path) = &config.bundle_out {
@@ -223,28 +229,26 @@ pub async fn conformance(config: ConformanceConfig) -> anyhow::Result<()> {
     let instance = oracle.instance_id();
     let _ = warn_on_reversed_transitions(&mut oracle, &hand_supplied_steps);
 
-    let outcomes: Vec<(ConformanceCase, PropertyOutcome)> = cases
-        .into_iter()
-        .map(|case| {
-           
```

**File**: `crates/fdev/src/main.rs` (modified, +1/-0)
```diff
@@ -307,6 +307,7 @@ mod tests {
             bundle: None,
             contract_store: None,
             max_cases: None,
+            max_case_bytes: None,
             properties: Vec::new(),
             json: false,
             evidence_out: None,
```

#### Recent Merged Pull Requests:
- **PR #6054** (2026-10-30): fix: skip validate_state when an update leaves the state unchanged (@sanity)
- **PR #6052** (2026-10-30): test: bind the fdev websocket test to an OS-assigned port (@sanity)
- **PR #6051** (2026-10-30): fix(transport): keep the configured bandwidth-limit on every rate update (@sanity)
- **PR #6046** (2026-10-30): docs: state the real per-connection bandwidth default (@sanity)
- **PR #6043** (2026-10-30): fix(fdev): count verify-merge cases that never ran (@sanity)
- **PR #6042** (2026-10-30): fix(ci): run the NixOS module VM test on a runner that provides KVM (@sanity)

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

## X. transport): contain panics in the QUIC socket adapter without aborting the node 

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `76d7ef16`: transport): contain panics in the QUIC socket adapter without aborting the node (#6027). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
(`quic_endpoint_down`), panics the QUIC socket adapter caught
(`quic_adapter_panicked`, once per endpoint; the process keeps running
and no breaker state is left), QUIC crash-loop breaker trips at startup
  → quinn's driver returns only on a receive I/O error. QuicSocket returns
    one only after it caught a panic (below); tests inject one
    (socket::SocketFaults::fail_receive).
  → PANICS. The node relies on panic = "unwind". A build with
    panic = "abort" still compiles, but QuicEndpoint::bind refuses
    (require_unwinding, through bind_checked so tests drive it) and the
    node runs with QUIC off; log_startup says so instead of describing the
    configured mode. This covers a profile-level abort only.
    CONTAINED: a panic in the socket adapter (QuicSocket::poll_recv,
    try_send, QuicPoller::poll_writable), which quinn calls holding its
    endpoint or connection state lock. The adapter catches it before it
    unwinds into quinn (no lock poisoned), and
    EndpointHealth::adapter_panicked turns the endpoint Down, counts
    quic_adapter_panicked once per endpoint and logs ERROR once (quinn
    also logs its own ERROR "I/O error" for each of its drivers that ends
    
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
(`quic_endpoint_down`), QUIC crash-loop breaker trips at startup
  → What this covers is narrow. quinn's driver returns only on a receive
    I/O error and QuicSocket never returns one, so in production today it
    cannot return at all; tests inject the error (socket::ReceiveFault).
    The one real way it ends is a PANIC, which is NOT contained: quinn
    0.11.12 polls the driver holding its endpoint state mutex
    (endpoint.rs line 370), so a panic poisons it and every later lock
    panics too, in EndpointDriver::drop (line 403), Accept::poll (line
    651, the accept loop), connect (line 214) and the connection drivers;
    one of those running during the unwind aborts the process. A panic is
    never reported as Down. Containing a quinn panic (catch the unwind,
    leak the driver instead of dropping it, guard the accept loop) is a
    separate PREREQUISITE before QUIC is on by default.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `76d7ef16` are properly handled with clean fallback behavior.
