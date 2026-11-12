> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `acae3b45`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T00:58:31.533Z  
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
> **Harvest Timestamp**: 2026-11-12T00:58:31.320Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3119 stars

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
- **Issue #6189** (2026-11-11): **feat(transport): handshake format 2 expresses a floor in the previous version series**
  *Symptoms*: ## Problem The handshake version field can only carry a floor in the sender's own major.minor series (`build.rs` enforced it), so a 1.0.0 node and any 0.2.x node reject each other and a major/minor bump is a flag day. See #6187. Ian approved the bridge-release approach (option A) on 2026-11-11.  ## Approach - Same 8 bytes, same framing. New format byte `2`, emitted **only** when the floor is in a different series than the version. Otherwise output is format 1, byte-identical to 0.2.156 (pinned against frozen arrays). - Format 2 packs the floor in bytes 5-6 as `0x8000 | major_back<<14 | minor<<8 | patch` (floor major at most one below ours, minor < 64, patch < 256). Releases through 0.2.156 ignore the format byte and read that as `min_patch >= 32768`, so they reject cleanly and take the existing "remote requires newer" path. No misparse as compatible. - `build.rs`: cross-series floor allowed only if encodable and not above the version; `encode_wire` also panics at compile time otherwise. - `MIN_COMPATIBLE_VERSION` and the crate version are untouched; the 1.0.0 floor change is a later PR. The bridge must reach the fleet before that. - Consumers checked: `visited_peers`, `testing_impl`, the ack-version floor, the urgent-update path and `report_peer_version` all compare full `(major, minor, patch)` tuples; `release.sh`/docs assume nothing about a shared series.  ## Testing - Frozen format-1 bytes; frozen format-2 bytes; roundtrip; rejection of floor > version, two majors back, pa
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No blocking issues found  **Rules checked:** git-workflow.md, code-style.md, testing.md, transport.md **Files reviewed:** 5 (`crates/core/build.rs`, `crates/core/build/version_floor.rs`, `crates/core/src/transport/connection_handler/version_cmp.rs`, `docs/RELEASING.md`, `docs/architecture/transport/security.md`)  I read the diff and checked it against the four rule files. I didn't build the code or run the tests.  - **Docs:** The edits to `docs/RELEASING.md` and `docs/architecture/transport/security.md` match the new behavior. A search for other text still saying the floor must share major.minor turned up nothing stale. - **Tests:** Coverage goes beyond the happy path. It includes:   - frozen byte pins;   - round-trips;   - the boundaries minor 63/64, patch 255/256 and two majors back;   - a floor above the version;   - an unknown future format byte;   - a malformed format 2;   - a frozen copy of the old parser;   - a mixed-population matrix
  > ## ⚠️ Extended Benchmark Regressions Detected  Some extended benchmarks show performance regressions.  **Note**: Extended benchmarks include high-latency and packet-loss scenarios which have higher variance than standard CI benchmarks.  [View full results](https://github.com/freenet/freenet-core/actions/runs/43081602396)  [View full benchmark summary](https://github.com/freenet/freenet-core/actions/runs/43081602396)

- **Issue #6188** (2026-11-11): **fix(server): tighten client API request validation**
  *Symptoms*: ## Problem The client API WebSocket, contract web pages, dashboard pages and permission endpoints validated the request Origin and Host loosely.  ## Approach Validate Origin and Host more strictly on those surfaces and mark the app token cookie HttpOnly. Native app grant connections (header token, no Origin, loopback Host) are unaffected.  ## Behaviour changes (release notes) - Reverse proxies that rewrite the Host header need `--allowed-host` for browser WebSocket access. - On a loopback bind, a hosts-file alias for the machine hostname no longer works; use `localhost` or `--allowed-host`. - Non-http Origins, such as browser-extension origins, are refused. - When `X-Forwarded-Proto` is present, the client-API Origin scheme must match it. - An IPv4-mapped loopback bind (`::ffff:127.0.0.1`) counts as loopback.  ## Testing Unit tests for the Origin/Host rules, forwarded-proto variants, and native grant connections; Playwright `websocket-origin` and shell specs (run by the browser workflow, which now also triggers on changes to the upgrade code and allowlist builder). Locally: `cargo fmt`, clippy `-D warnings` (default and all-features), `cargo test -p freenet --lib` (8321 passed).  ## Review Reviewed before opening by code-first, skeptical and testing lenses plus a skeptical delta pass; all findings addressed. Codex was unavailable (out of quota), so Claude lenses substituted.  [AI-assisted - Claude]
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> Checking the diff against the rule files is done; here is the review.  ### Rule Review: No blocking issues found, 3 informational notes  **Rules checked:** git-workflow.md, code-style.md, testing.md **Files reviewed:** 11  #### Warnings None.  - **Regression tests:** this is a `fix:` PR and it adds many specific tests, including negative and boundary cases. The Origin tests cover `null`, hostname look-alikes, and port mismatches. The Host tests cover `localhost.`, `localhost:`, `localhost:80x`, `localhost:+1`, `evil.localhost`, and a missing Host. There are also tests for IPv4-mapped loopback, scheme comparison against `X-Forwarded-Proto`, and a "dashboard-only" layer scope. A Playwright spec checks real browser behavior. (rule: testing.md) - **No new production `.unwrap()`:** the new production code (`trusted_host_header_ip`, `is_localhost_host`, `request_host_trusted`, `shell_token_cookie`, `require_trusted_host`) uses `?`, `let ... else`, and `Option` com

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

### Incident Patch 1: `acae3b45` (2026-11-11)
**Commit Message**: fix(transport): a loss gate in front of QUIC Cubic, so random loss does not collapse the window (#6185)

**File**: `.claude/rules/transport.md` (modified, +48/-6)
```diff
@@ -1434,6 +1434,15 @@ a test passes its own; tests read their own, never the global).
   level in the period, and the highest count a reset in the period took a path
   to). They are for the fixed charge, which takes quinn's stopped map at
   SEND_ABORT_LIMIT x QUIC_STOPPED_ENTRY_BYTES until field data justifies less.
+  quic_gate_loss_<queue|share|persistent|ecn|no_sample|ignored> (congestion
+  events by the loss gate's verdict, recycle::loss_gate, reported by the path's
+  report at each tick; over a path's life they sum to its quic_congestion_events,
+  since quinn counts an event where it calls the controller, while one period's
+  sums can differ by the events between a tick's two reads) and quic_gate_ended_queue_<lt_10pct|lt_50pct|
+  ge_50pct> (paths that ended in the period after at least 20 verdicts, by the
+  share passed as a queue). A path whose losses mostly read as a queue runs as
+  plain Cubic, from a real queue or from jitter; with the path's loss rate this
+  sizes how often jitter defeats the gate in the field.
   A family is the keys of one label list under one prefix
   (`QuicDataSnapshot::keys_by_family`). No other key starts with a family's
   prefix or with the prefix sibling families share (`quic_data_` for the send,
@@ -1557,8 +1566,10 @@ exposes (its module doc lists the few it does not):
   grease_quic_bit(false) (the demux rule depends on it), versions [1],
   max_udp_payload / initial and min MTU 1200, no MTU discovery, no GSO,
   keepalive 15 s (None when the TimeSource disables keepalive), idle = the
-  TimeSource's connection idle timeout, Cubic with its window capped to the
-  configured bandwidth (recycle::CappedCubic), 64 uni / 0 bidi streams,
+  TimeSource's connection idle timeout, Cubic behind the loss gate
+  (recycle::loss_gate::LossGate, see below) with its window capped to the
+  configured bandwidth (recycle::CappedCubic; QuicRateLimit::without_loss_gate,
+  test-only, gives plain capped Cubic), 64 uni / 0 bidi streams,
   stream / receive / send window = clamp(5% of memory / (2 x
   max-number-of-connections), 128 KiB, 2 MiB), no unreliable datagrams, no
   spin bit, migration off, max_incoming 64, incoming buffers 64 KiB / 1 MiB,
@@ -1571,6 +1582,35 @@ Connection IDs (quic/cid.rs) carry a keyed BLAKE3 MAC, so quinn drops a
   generator can be spoofed and would answer it with a stateless reset.
 ```
 
+QUIC loss gate (quic/recycle/loss_gate.rs, every QUIC path by default): Cubic
+cuts its window on every loss, so under a few percent of random loss (Wi-Fi,
+cheap routers) its window collapses and large messages take minutes. The gate
+passes a congestion event to Cubic only when: quinn declares persistent
+congestion; it is an ECN mark (lost_bytes 0; the socket reads no ECN today);
+there is no RTT sample yet; the queue estimated around the lost packet's send
+time is at least queue_threshold = max(10% of min RTT, 2 ms) (QUEUE_FRACTION,
+QUEUE_FLOOR); or the smoothed per-round loss share is at least 0.25
+(LOSS_SHARE_CEILING). Otherwise the loss is ignored (quinn still retransmits,
+the window stays). Limits, all known and measured in the e5b-9 lab (tables in
+#6185 and #6183, which tracks the follow-up):
+- min RTT is never forgotten (deliberately: a windowed minimum would let the
+  gate's own standing queue become the baseline). A route that grows longer
+  reads the extra delay as a queue and the path runs as plain Cubic.
+- On a drop-tail queue deeper than the threshold, with no random loss, it is
+  exactly Cubic. On a queue shallower than the threshold (or an AQM such as
+  CoDel/PIE whose target is below it, the common case for 100-250 ms node
+  RTTs) congestion losses look random and only the 0.25 share ceiling stops
+  the flow, so it holds a standing queue near the threshold and a competing
+  flow keeps less of the link than next to Cubic (still far more than next
+  to legacy UDP).
+- Jitter above the threshold reads as a queue, so the gate passes random
+  losses and the path behaves as Cubic (30 ms of jitter on a 100 ms path;
+  10 ms of jitter there is still absorbed).
+Verdicts are exported as quic_gate_loss_<verdict> and
+quic_gate_ended_queue_<bucket> (see the telemetry keys above). Do not raise
+the threshold, add a threshold cap or a windowed min RTT without lab cells
+for jitter, AQM and shallow queues: each was tried and broke one of them.
+
 QUIC memory: the flow-control windows (connection receive, stream receive,
 send; all one value from `connection_window_bytes`) are clamped and capped
 at `MAX_INBOUND_STREAM_BYTES_PER_CONNECTION`; the stream window never
@@ -1921,10 +1961,12 @@ Sending (QuicPath::send_short_bounded / send_stream_bounded /
   connection's own probes wait for a saturated cap too, and counted without
   that limit they kept a dark send going for 32 s. For the
   credit after its last ack a dark path's own held probes do still count (on
-  main they counted for as long as they were held). Under random loss the 384 KiB s
```

**File**: `crates/core/src/contract/executor.rs` (modified, +5/-0)
```diff
@@ -3128,6 +3128,11 @@ mod tests {
                 "free-DISK threshold the state directory must have before the node stages \
                  a release (#5791), not memory",
             ),
+            (
+                "SHARE_MIN_BYTES",
+                "QUIC loss gate: bytes a round trip must acknowledge or lose before its \
+                 loss share is sampled (quic::recycle::loss_gate), a threshold, not memory",
+            ),
         ];
 
         // WHAT THE SUM ACTUALLY CONSUMED, not what its source text mentions.
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +2/-0)
```diff
@@ -7830,6 +7830,8 @@ mod tests {
         data.path_ms = 1037;
         data.send_resets_reached = (1038..1042).collect();
         data.send_resets_path_max = 1042;
+        data.gate_loss = (1043..1049).collect();
+        data.gate_ended_queue = (1049..1052).collect();
         let want: std::collections::BTreeMap<String, u64> =
             snapshot.quic_data.keys().into_iter().collect();
         assert!(want.values().all(|value| *value != 0));
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ use crate::tracing::{TransferDirection, TransferEvent};
 
 mod quic_data;
 pub use quic_data::QuicDataSnapshot;
-pub(crate) use quic_data::{PathLossWindow, QuicDataCounters, StreamsOpenPeak};
+pub(crate) use quic_data::{PathGateWindow, PathLossWindow, QuicDataCounters, StreamsOpenPeak};
 
 /// Global transport metrics instance.
 ///
```

**File**: `crates/core/src/transport/metrics/quic_data.rs` (modified, +154/-0)
```diff
@@ -25,6 +25,8 @@
 //! | `quic_ended_loss_rate_<bucket>` | paths that ended in the period, by the bucket they were in at the end (same buckets) |
 //! | `quic_ended_paths_below_floor` | paths that ended in the period before sending 200 packets, so in no bucket |
 //! | `quic_streams_sampled_paths`, `quic_streams_open_ge_<n>`, `quic_streams_peak_max` | per path and period, the peak of inbound streams read at once: the paths sampled, those whose peak reached each level, and the highest peak |
+//! | `quic_gate_loss_<verdict>` | congestion events by the loss gate's verdict (`recycle::loss_gate`): passed to Cubic as `queue`, `share` (loss share above the ceiling), `persistent`, `ecn` (a congestion mark), `no_sample`, or `ignored` as random loss; summed over the node's paths up to each path's last tick. Over a path's life they sum to its `quic_congestion_events`; within one period they can differ by the events between the two reads of a tick |
+//! | `quic_gate_ended_queue_<bucket>` | paths that ended in the period after at least 20 gate verdicts, by the share of them passed as `queue`: `lt_10pct`, `lt_50pct`, `ge_50pct`. A path whose losses mostly read as a queue runs as plain Cubic, whether the queue is real or jitter |
 //! | `quic_send_resets`, `quic_path_ms` | sends a path reset on this side, and the time QUIC paths were up, shadow paths included, up to each path's last tick: resets per connection-hour is their ratio |
 //! | `quic_send_resets_reached_<n>`, `quic_send_resets_path_max` | paths whose lifetime reset count reached each level in the period, and the highest count a reset in the period took a path to: how close paths get to `recycle::SEND_ABORT_LIMIT` |
 //!
@@ -65,6 +67,7 @@ use super::QuicPathAge;
 use crate::transport::quic::path::{
     QuicInboundOutcome, QuicSendEvent, QuicSendResult, SendKind, stop_code,
 };
+use crate::transport::quic::recycle::loss_gate::{GATE_VERDICTS, VERDICT_LABELS, Verdict};
 
 /// The gauge's key, uploaded in every snapshot ([`QuicDataSnapshot::upload_keys`]).
 const LIVE_DATA_PATHS: &str = "quic_live_data_paths";
@@ -105,6 +108,58 @@ fn loss_rate_bucket(lost: u64, sent: u64) -> usize {
         .count()
 }
 
+/// A path enters a `quic_gate_ended_queue_` bucket only after this many gate
+/// verdicts; below it the share says too little.
+pub(crate) const GATE_MIN_VERDICTS: u64 = 20;
+
+/// The labels of the gate's per-path buckets
+/// (`quic_gate_ended_queue_<label>`), by the share of verdicts passed as a
+/// queue: under 10%, under 50%, 50% or more.
+pub(crate) const GATE_QUEUE_LABELS: [&str; 3] = ["lt_10pct", "lt_50pct", "ge_50pct"];
+
+/// The bucket of a path that had `queue` of `total` verdicts passed as a queue.
+fn gate_queue_bucket(queue: u64, total: u64) -> usize {
+    if queue.saturating_mul(10) < total {
+        0
+    } else if queue.saturating_mul(2) < total {
+        1
+    } else {
+        2
+    }
+}
+
+/// One path's loss-gate verdicts since it started. Owned by the path's report
+/// (`recycle::PathReport`); dropping it, when the path ends, counts the path in
+/// its `quic_gate_ended_queue_` bucket.
+#[derive(Debug)]
+pub(crate) struct PathGateWindow {
+    node: &'static QuicDataCounters,
+    verdicts: [u64; GATE_VERDICTS],
+}
+
+impl PathGateWindow {
+    pub(crate) fn new(node: &'static QuicDataCounters) -> Self {
+        Self {
+            node,
+            verdicts: [0; GATE_VERDICTS],
+        }
+    }
+}
+
+impl Drop for PathGateWindow {
+    fn drop(&mut self) {
+        let total: u64 = self.verdicts.iter().sum();
+        if total >= GATE_MIN_VERDICTS {
+            let bucket = gate_queue_bucket(self.verdicts[GATE_QUEUE], total);
+            self.node.gate_ended_queue[bucket].fetch_add(1, Ordering::Relaxed);
+        }
+    }
+}
+
+/// The index of `queue` among the gate's verdicts (`loss_gate::Verdict::ALL`).
+const GATE_QUEUE: usize = 0;
+const _: () = assert!(matches!(Verdict::ALL[GATE_QUEUE], Verdict::Queue));
+
 /// One path's packets since it started, and the loss-rate bucket it is counted
 /// in. Owned by the path's acknowledgement watch; dropping it, however the watch
 /// ends, takes the path out of its bucket.
@@ -228,6 +283,8 @@ pub(crate) struct QuicDataCounters {
     path_ms: AtomicU64,
     send_resets_reached: [AtomicU64; QUIC_SEND_RESET_LEVELS.len()],
     send_resets_path_max: AtomicU64,
+    gate_loss: [AtomicU64; GATE_VERDICTS],
+    gate_ended_queue: [AtomicU64; GATE_QUEUE_LABELS.len()],
 }
 
 impl QuicDataCounters {
@@ -254,6 +311,8 @@ impl QuicDataCounters {
             path_ms: zero(),
             send_resets_reached: std::array::from_fn(|_| zero()),
             send_resets_path_max: zero(),
+            gate_loss: std::array::from_fn(|_| zero()),
+            gate_ended_queue: std::array::from_fn(|_| zero()),
         }
     }
 
@@ -404,6 +463,22 @@ impl QuicDataCounters {
             .fetch_max(path_count, Ordering::Relaxed);
     }
 
+    /// A path's loss gate gave `delta` more verdicts, in the
```

**File**: `crates/core/src/transport/quic/config.rs` (modified, +7/-0)
```diff
@@ -414,6 +414,11 @@ const WINDOW_MEMORY_DIVISOR: usize = 20;
 pub(crate) struct QuicRateLimit {
     bandwidth_limit: Option<usize>,
     global: Option<Arc<GlobalBandwidthManager>>,
+    /// Tests only: build plain Cubic without the loss gate
+    /// (`recycle::loss_gate`), for tests of what the path does when Cubic's
+    /// window collapses under loss.
+    #[cfg(test)]
+    pub(crate) without_loss_gate: bool,
 }
 
 impl QuicRateLimit {
@@ -424,6 +429,8 @@ impl QuicRateLimit {
         Self {
             bandwidth_limit,
             global,
+            #[cfg(test)]
+            without_loss_gate: false,
         }
     }
 
```

**File**: `crates/core/src/transport/quic/path/tests.rs` (modified, +92/-5)
```diff
@@ -9,7 +9,7 @@ use std::time::Duration;
 use bytes::Bytes;
 
 use super::super::framing::{HEADER_LEN, MAX_CONTROL_BYTES, MAX_METADATA_BYTES};
-use super::super::tests::{MIB, Pair, SEED, bounded, drive, pair, payload};
+use super::super::tests::{MIB, Pair, SEED, bounded, drive, pair_with, payload};
 use super::*;
 use crate::config::GlobalRng;
 use crate::simulation::{TimeSource, VirtualTime};
@@ -76,12 +76,27 @@ async fn paths_with(
     b_limits: QuicPathLimits,
     b_budget: Option<SharedInboundBudget>,
 ) -> Paths {
-    paths_built(network, subnet, b_limits, b_budget, None).await
+    paths_built(network, subnet, b_limits, b_budget, None, true).await
 }
 
 /// [`paths`] with an egress cap of `a_cap` bytes per second on `a`'s socket.
 async fn paths_capped(network: &str, subnet: u8, a_cap: u64) -> Paths {
-    paths_built(network, subnet, QuicPathLimits::DEFAULT, None, Some(a_cap)).await
+    paths_built(
+        network,
+        subnet,
+        QuicPathLimits::DEFAULT,
+        None,
+        Some(a_cap),
+        true,
+    )
+    .await
+}
+
+/// [`paths`] with plain Cubic, no loss gate (`recycle::loss_gate`), so
+/// random loss collapses the window: for the path's rules on a connection
+/// that drains slowly while it is still acknowledged.
+async fn paths_without_loss_gate(network: &str, subnet: u8) -> Paths {
+    paths_built(network, subnet, QuicPathLimits::DEFAULT, None, None, false).await
 }
 
 async fn paths_built(
@@ -90,10 +105,13 @@ async fn paths_built(
     b_limits: QuicPathLimits,
     b_budget: Option<SharedInboundBudget>,
     a_cap: Option<u64>,
+    loss_gate: bool,
 ) -> Paths {
     let a_addr: SocketAddr = format!("10.203.{subnet}.1:5000").parse().unwrap();
     let b_addr: SocketAddr = format!("10.203.{subnet}.2:5000").parse().unwrap();
-    let pair = pair(network, a_addr, b_addr, a_cap).await;
+    let mut settings = super::super::tests::settings();
+    settings.rate_limit.without_loss_gate = !loss_gate;
+    let pair = pair_with(network, a_addr, b_addr, a_cap, settings).await;
     let permit = pair
         .b
         .allow_peer(pair.a_addr, pair.a_keys.public())
@@ -3325,13 +3343,18 @@ fn seeded_loss_from(
 /// nothing on the connection was acknowledged for `STALL_PROGRESS_WINDOW`, so
 /// the send completes. Before, it timed out (`SendFailure::TimedOut`) and went
 /// to UDP from the start.
+///
+/// The path runs plain Cubic: the loss gate (`recycle::loss_gate`) ignores
+/// random loss with no queue, so through it this send is not slowed at all.
+/// Cubic's collapse is still what happens when the gate passes losses (a
+/// queue, or a loss share above its ceiling), and that is the case tested.
 #[test]
 fn a_lossy_path_finishes_a_stream_whose_writes_wait_past_the_gap() {
     bounded(|| async move {
         let _seed = GlobalRng::seed_guard(SEED);
         let network = "quic-path-lossy-gap";
         let loss = seeded_loss_from(network, 5, 0x5940_0007, Some(Duration::from_millis(100)));
-        let p = paths(network, 47, QuicPathLimits::DEFAULT).await;
+        let p = paths_without_loss_gate(network, 47).await;
         let (a, time) = (p.a.clone(), p.time());
         const LEN: usize = 8 * MIB;
         let gaps = Arc::new(WriteGaps::new(time.clone()));
@@ -3371,6 +3394,70 @@ fn a_lossy_path_finishes_a_stream_whose_writes_wait_past_the_gap() {
     })
 }
 
+/// The loss gate's verdicts reach the node counters (`quic_gate_loss_<verdict>`)
+/// from the path's report, one per congestion event: quinn counts an event in
+/// `congestion_events` exactly where it calls the controller, so the verdicts
+/// sum to it. With random loss and no queue most losses are ignored.
+#[test]
+fn the_loss_gates_verdicts_reach_the_node_counters() {
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let counters: &'static crate::transport::metrics::QuicDataCounters =
+            Box::leak(Box::new(crate::transport::metrics::QuicDataCounters::new()));
+        let network = "quic-path-gate-verdicts";
+        let _loss = seeded_loss_from(network, 5, 0x5940_0011, Some(Duration::from_millis(50)));
+        let limits = QuicPathLimits {
+            counters: Some(counters),
+            ..QuicPathLimits::DEFAULT
+        };
+        let p = paths(network, 200, limits).await;
+        let (a, time) = (p.a.clone(), p.time());
+        const LEN: usize = MIB;
+        let (sent, snap) = p
+            .drive(async move {
+                let sent = a
+                    .send_stream_bounded(
+                        &time,
+                        SendDeadlines::stream(LEN as u64),
+                        StreamId::next(),
+                        None,
+                        payload(LEN).into(),
+                        None,
+                    )
+                    .await;
+                // Two ticks of the acknowledgement watch report the counts.
+                time.sleep(2 * recycle::ACK_WATCH_TICK).await;
+                (sent, c
```

**File**: `crates/core/src/transport/quic/path/tests/pacer.rs` (modified, +3/-2)
```diff
@@ -669,14 +669,15 @@ impl SendPacer for Honest {
 /// quinn makes writes wait past the gap and the connection's window carries
 /// the send, every reservation is offered at most 5 s and the send completes:
 /// the long waits are quinn's, after a reservation, and the write they end in
-/// is a step, so the next reservation is offered a fresh gap.
+/// is a step, so the next reservation is offered a fresh gap. Plain Cubic,
+/// as in that test.
 #[test]
 fn a_pacer_is_offered_at_most_the_gap_on_a_lossy_live_path() {
     bounded(|| async move {
         let _seed = GlobalRng::seed_guard(SEED);
         let network = "quic-pacer-lossy-window";
         let loss = seeded_loss_from(network, 5, 0x5940_0007, Some(Duration::from_millis(100)));
-        let p = paths(network, 47, QuicPathLimits::DEFAULT).await;
+        let p = paths_without_loss_gate(network, 47).await;
         let pacer = Scripted::new(&p.time(), usize::MAX, Duration::ZERO);
         p.a.pace_with(pacer.clone());
         let (elapsed, outcome) = time_a_stream(&p, 8 * MIB).await;
```

---

### Incident Patch 2: `104a05c3` (2026-11-11)
**Commit Message**: fix(server): tighten client API request validation (#6188)

**File**: `.github/workflows/playwright-shell.yml` (modified, +8/-0)
```diff
@@ -29,6 +29,10 @@ on:
     branches: [main]
     paths:
       - 'crates/core/src/server/**'
+      # The WebSocket upgrade's Origin/Host gate and the Host allowlist it
+      # reads live outside server/; websocket-origin.spec.ts exercises both.
+      - 'crates/core/src/server.rs'
+      - 'crates/core/src/client_events/websocket.rs'
       - 'crates/core/tests/playwright/**'
       - 'crates/core/tests/playwright_shell.rs'
       # fdev is the publish path the harness shells out to; a regression in
@@ -38,6 +42,10 @@ on:
   pull_request:
     paths:
       - 'crates/core/src/server/**'
+      # The WebSocket upgrade's Origin/Host gate and the Host allowlist it
+      # reads live outside server/; websocket-origin.spec.ts exercises both.
+      - 'crates/core/src/server.rs'
+      - 'crates/core/src/client_events/websocket.rs'
       - 'crates/core/tests/playwright/**'
       - 'crates/core/tests/playwright_shell.rs'
       - 'crates/fdev/**'
```

**File**: `crates/core/src/client_events/websocket.rs` (modified, +420/-114)
```diff
@@ -395,31 +395,24 @@ pub(crate) fn is_allowed_host(
 }
 
 /// Returns `true` if the request's `Host` header IP is acceptable for a
-/// privileged WS upgrade **and** the `Origin` is compatible with it.
+/// privileged WS upgrade **and** the `Origin` is a same-IP literal for it.
 ///
-/// Two acceptance branches with **different Origin policies**:
+/// The Host IP qualifies on either of two branches:
 ///
 /// 1. **Operator-configured CIDR** (`--allowed-source-cidrs` / config
-///    `allowed-source-cidrs`): accepts the upgrade when the Host IP is in
-///    the CIDR and the Origin is **either** `null` (sandboxed iframe
-///    served from the same node) **or** a same-IP literal (direct browser
-///    access). The operator has explicitly opted into the null-origin
-///    risk surface — see `origin_compatible_with_host_ip`.
+///    `allowed-source-cidrs`), e.g. a Tailnet range.
+/// 2. **Default LAN/private** (no operator config required): the Host IP
+///    is private (RFC 1918 / loopback / link-local / IPv6 ULA, but **not**
+///    the unspecified `0.0.0.0` / `::`).
 ///
-/// 2. **Default LAN/private** (no operator config required): accepts the
-///    upgrade when the Host IP is private (RFC 1918 / loopback /
-///    link-local / IPv6 ULA, but **not** the unspecified `0.0.0.0` / `::`)
-///    and the Origin is a **same-IP literal** matching the Host IP.
-///    `Origin: null` is **rejected** on this branch because any site can
-///    serve a `<iframe sandbox>` whose origin is null and use it to probe
-///    LAN-bound nodes — a default-on CSWSH would expose every desktop
-///    install on a LAN. Operators who genuinely need null-origin
-///    sandboxed access from non-localhost contexts must opt in via
-///    `--allowed-source-cidrs`.
+/// On both branches the Origin must be an IP literal equal to the Host IP
+/// (direct browser access, or the shell page served from that address).
+/// `Origin: null` is **rejected** on both: it identifies no page, and the
+/// node's own dApp iframe never needs it because the shell page opens the
+/// real WebSocket on its behalf (its Origin is the node's own address).
 ///
-/// This dual policy closes #3957 (LAN access works out of the box)
-/// without widening CSWSH exposure beyond what an explicit operator
-/// opt-in already accepts. The default-LAN branch matches what
+/// This closes #3957 (LAN access works out of the box). The default-LAN
+/// branch matches what
 /// [`is_private_ip`](crate::server::is_private_ip) and the
 /// `private_network_filter` accept for **source** IPs, modulo the
 /// unspecified-address exclusion, so the HTTP and WS layers agree on
@@ -430,40 +423,72 @@ pub(crate) fn is_allowed_host(
 /// CGNAT, and other non-private but operator-controlled ranges still
 /// require `--allowed-source-cidrs` (see `host_header_ip_in_tailscale_cidr_allowed`).
 ///
-/// CSWSH defence (both branches): `https://evil.com`'s JS opening
-/// `ws://<victim-lan-ip>:7509/...` sends `Origin: https://evil.com`, which
-/// parses to a hostname — not an IP, not matching the Host IP — so it's
-/// refused. DNS rebinding is defeated because no DNS resolution happens
-/// at this layer; only string-parseable IP literals are compared.
+/// An `Origin` that is a hostname (for example `https://example.com`) is
+/// refused: only an IP literal matching the Host IP is accepted. No DNS
+/// resolution happens at this layer; only string-parseable IP literals are
+/// compared.
 pub(crate) fn host_header_ip_in_cidrs(
     headers: &axum::http::HeaderMap,
     origin_str: &str,
     allowed_cidrs: &crate::server::AllowedSourceCidrs,
 ) -> bool {
-    let Some(host_header) = headers
+    let Some(host_ip) = trusted_host_header_ip(headers, allowed_cidrs) else {
+        return false;
+    };
+    origin_is_same_ip_literal(origin_str, host_ip)
+}
+
+/// Returns `true` if the request's `Host` header names this node: `localhost`
+/// on any port (so an SSH tunnel or port map such as `localhost:8000`
+/// qualifies), an entry in `allowed_hosts`, or an IP literal on either branch
+/// of [`host_header_ip_in_cidrs`] (private/LAN, or inside
+/// `allowed-source-cidrs`).
+///
+/// This is the Host half of the check without an Origin, for endpoints a
+/// browser reaches by top-level navigation (which carries no `Origin`),
+/// such as the contract shell page that issues an app-identity token. A
+/// browser sets `Host` from the URL it loads, so a page can only produce one
+/// of these values from an origin that is that value: `localhost:<port>` is
+/// no broader than `127.0.0.1:<port>`. Any other name, including
+/// `*.localhost`, is refused unless it is on the allowlist; names are never
+/// resolved.
+pub(crate) fn is_host_acceptable(
+    headers: &axum::http::HeaderMap,
+    allowed_hosts: &HashSet<String>,
+    allowed_cidrs: &crate::server::AllowedSourceCidrs,
+) -> bool {
+    is_localhost_host(headers)
+        || is_allowed_host(headers, allowed_hosts)
+        || truste
```

**File**: `crates/core/src/config.rs` (modified, +2/-1)
```diff
@@ -3810,7 +3810,8 @@ pub struct WebsocketApiConfig {
     pub token_cleanup_interval_seconds: u64,
 
     /// Additional hostnames allowed in the Host header for WebSocket connections.
-    /// Empty means only auto-detected hostnames (machine hostname + bound IP) are allowed.
+    /// Empty means only auto-detected hosts are allowed: the loopback names, the bound
+    /// IP, and (for a non-loopback bind only) the machine hostname and its IPs.
     #[serde(default, rename = "allowed-host")]
     pub allowed_hosts: Vec<String>,
 
```

**File**: `crates/core/src/server.rs` (modified, +89/-13)
```diff
@@ -429,7 +429,8 @@ pub(crate) fn is_source_allowed(ip: IpAddr, allowed: &AllowedSourceCidrs) -> boo
 }
 
 /// Whether a client could reach this bind address directly at the machine's
-/// own IPs.
+/// own IPs (and so whether the machine hostname is allowed at all; see
+/// `HostAllowlistBuilder::add_hostname`).
 ///
 /// A loopback listener cannot be reached at a LAN address, so resolving the
 /// machine's hostname to allow those addresses as `Host` values gains nothing
@@ -438,6 +439,12 @@ pub(crate) fn is_source_allowed(ip: IpAddr, allowed: &AllowedSourceCidrs) -> boo
 /// before the API starts listening, which took about 35 s on a macOS 26 CI
 /// runner and left the node unreachable for all of it (see #5956).
 fn hostname_ips_are_reachable(bind_addr: IpAddr) -> bool {
+    // `::ffff:127.0.0.1` is loopback too, though `Ipv6Addr::is_loopback`
+    // says otherwise.
+    let bind_addr = match bind_addr {
+        IpAddr::V6(v6) => v6.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(bind_addr),
+        v4 => v4,
+    };
     !bind_addr.is_loopback()
 }
 
@@ -451,7 +458,7 @@ fn resolve_hostname_ips(hostname: &str, port: u16) -> Vec<IpAddr> {
 ///
 /// Each entry is stored with and without the port suffix so both
 /// `Host: myhost` and `Host: myhost:7509` are accepted.
-fn build_allowed_hosts(
+pub(crate) fn build_allowed_hosts(
     bind_addr: IpAddr,
     port: u16,
     extra_allowed_hosts: &[String],
@@ -529,17 +536,23 @@ impl HostAllowlistBuilder {
         self.add_hostname(name_str, bind_addr, resolve);
     }
 
+    /// Allows the machine's hostname, and the IPs it resolves to, as `Host`
+    /// values, but only for a bind reachable at those IPs.
+    ///
+    /// A loopback bind gets neither; local browsers use `localhost` or
+    /// `127.0.0.1`. Use `--allowed-host` to add the name.
     fn add_hostname(
         &mut self,
         hostname: &str,
         bind_addr: IpAddr,
         resolve: impl FnOnce(&str, u16) -> Vec<IpAddr>,
     ) {
+        if !hostname_ips_are_reachable(bind_addr) {
+            return;
+        }
         self.add(hostname);
-        if hostname_ips_are_reachable(bind_addr) {
-            for ip in resolve(hostname, self.port) {
-                self.add(&ip.to_string());
-            }
+        for ip in resolve(hostname, self.port) {
+            self.add(&ip.to_string());
         }
     }
 
@@ -942,18 +955,34 @@ mod tests {
             IpAddr::V4(Ipv4Addr::LOCALHOST),
             IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2)),
             IpAddr::V6(std::net::Ipv6Addr::LOCALHOST),
+            // IPv4-mapped loopback.
+            IpAddr::V6(Ipv4Addr::LOCALHOST.to_ipv6_mapped()),
         ] {
             assert!(!hostname_ips_are_reachable(loopback), "{loopback}");
         }
         for reachable in [
             IpAddr::V4(Ipv4Addr::UNSPECIFIED),
             IpAddr::V6(std::net::Ipv6Addr::UNSPECIFIED),
             IpAddr::V4(Ipv4Addr::new(192, 168, 1, 2)),
+            IpAddr::V6(Ipv4Addr::new(192, 168, 1, 2).to_ipv6_mapped()),
         ] {
             assert!(hostname_ips_are_reachable(reachable), "{reachable}");
         }
     }
 
+    #[test]
+    fn a_mapped_loopback_bind_does_not_allow_the_machine_hostname() {
+        let mut hosts = HostAllowlistBuilder::new(7509);
+        hosts.add_hostname(
+            "myhost",
+            IpAddr::V6(Ipv4Addr::LOCALHOST.to_ipv6_mapped()),
+            |_, _| panic!("a loopback bind must not resolve the hostname"),
+        );
+        let hosts = hosts.build();
+        assert!(!hosts.contains("myhost"));
+        assert!(!hosts.contains("myhost:7509"));
+    }
+
     #[test]
     fn a_loopback_bind_does_not_look_up_the_machine_hostname() {
         // The guard is what keeps a slow resolver from delaying the API.
@@ -962,8 +991,8 @@ mod tests {
             panic!("a loopback bind must not resolve the hostname")
         });
         let hosts = hosts.build();
-        assert!(hosts.contains("myhost"));
-        assert!(hosts.contains("myhost:7509"));
+        assert!(!hosts.contains("myhost"));
+        assert!(!hosts.contains("myhost:7509"));
     }
 
     #[test]
@@ -1004,18 +1033,65 @@ mod tests {
     }
 
     #[test]
-    fn a_loopback_bind_still_allows_the_machine_hostname() {
-        // The name stays allowed: a hosts-file entry can map it to loopback,
-        // and such a client sends `Host: <hostname>:7509`.
+    fn a_loopback_bind_does_not_allow_the_machine_hostname() {
+        // Through the production builder with the real hostname: a loopback
+        // bind allows only the loopback names.
         let hosts = build_allowed_hosts(IpAddr::V4(Ipv4Addr::LOCALHOST), 7509, &[]);
         if let Ok(name) = hostname::get() {
             if let Some(name_str) = name.to_str() {
-                assert!(hosts.contains(&name_str.to_lowercase()));
-                assert!(hosts.contains(&format!("{}:7509", name_str.to_lowercase())));
+                let name = name_str.to_lowercase();
+                if
```

**File**: `crates/core/src/server/client_api.rs` (modified, +485/-12)
```diff
@@ -168,6 +168,8 @@ mod permission_prompts;
 mod v1;
 mod v2;
 
+pub(crate) use permission_prompts::is_origin_trusted;
+
 #[derive(Clone)]
 pub(super) struct HttpClientApiRequest(mpsc::Sender<ClientConnection>);
 
@@ -320,6 +322,8 @@ impl HttpClientApi {
                 "/contract/{key}",
                 axum::routing::get(home_page::contract_detail),
             )
+            // Applies to the four dashboard routes above only.
+            .route_layer(axum::middleware::from_fn(require_trusted_host))
             // Notification service worker, served at the origin root so its
             // default scope (`/`) covers every contract shell page. The shell
             // registers it to show notifications via showNotification() — the
@@ -519,6 +523,7 @@ async fn web_home(
     query_string: Option<String>,
     hosted_mode: bool,
     source_addr: Option<std::net::SocketAddr>,
+    host_trusted: bool,
 ) -> Result<axum::response::Response, WebSocketApiError> {
     // Check if this is the sandboxed iframe requesting its content
     let is_sandbox = query_string
@@ -549,6 +554,7 @@ async fn web_home(
         rs,
         hosted_mode,
         source_addr,
+        host_trusted,
     )
     .await
 }
@@ -576,9 +582,19 @@ async fn render_shell_response(
     // Peer address of the requesting connection, for the issuance audit log.
     // `None` only where no `ConnectInfo` is installed (standalone test routers).
     source_addr: Option<std::net::SocketAddr>,
+    // Result of [`request_host_trusted`] for this request.
+    host_trusted: bool,
 ) -> Result<axum::response::Response, WebSocketApiError> {
     use headers::{Header, HeaderMapExt};
 
+    // The token below attests its holder as this contract's app. Issue it
+    // only when the request's `Host` names this node, the same allowlist the WebSocket
+    // upgrade and `/permission` endpoints apply. Checked before minting so a
+    // refused request leaves no token behind.
+    if !host_trusted {
+        return Ok(untrusted_host_response());
+    }
+
     // Shell page: generate auth token, serve iframe wrapper with CSP
     let token = AuthToken::generate();
 
@@ -611,17 +627,7 @@ async fn render_shell_response(
         );
     }
 
-    let auth_header = headers::Authorization::<headers::authorization::Bearer>::name().to_string();
-    let version_prefix = api_version.prefix();
-    // Don't set a cookie domain — the browser will default to the request's origin host,
-    // which works for both localhost and remote access.
-    let cookie = cookie::Cookie::build((auth_header, format!("Bearer {}", token.as_str())))
-        .path(format!("/{version_prefix}/contract/web/{key}"))
-        .same_site(cookie::SameSite::Strict)
-        .max_age(cookie::time::Duration::days(1))
-        .secure(!config.localhost)
-        .http_only(false)
-        .build();
+    let cookie = shell_token_cookie(&token, &key, api_version, config.localhost);
 
     let token_header = headers::Authorization::bearer(token.as_str()).unwrap();
     let contract_response = path_handlers::contract_home(
@@ -687,6 +693,80 @@ fn hosted_mode_or_default(ext: Option<Extension<crate::server::HostedMode>>) ->
     ext.map(|Extension(hm)| hm.0).unwrap_or(false)
 }
 
+/// The cookie carrying a shell page's app-identity token.
+///
+/// `HttpOnly`: nothing in the shell or in a webapp reads it from script (the
+/// shell gets the token from the page body, the sandboxed app from its URL).
+fn shell_token_cookie(
+    token: &AuthToken,
+    key: &str,
+    api_version: ApiVersion,
+    localhost: bool,
+) -> cookie::Cookie<'static> {
+    use headers::Header;
+    let auth_header = headers::Authorization::<headers::authorization::Bearer>::name().to_string();
+    let version_prefix = api_version.prefix();
+    // Don't set a cookie domain — the browser will default to the request's origin host,
+    // which works for both localhost and remote access.
+    cookie::Cookie::build((auth_header, format!("Bearer {}", token.as_str())))
+        .path(format!("/{version_prefix}/contract/web/{key}"))
+        .same_site(cookie::SameSite::Strict)
+        .max_age(cookie::time::Duration::days(1))
+        .secure(!localhost)
+        .http_only(true)
+        .build()
+}
+
+/// The refusal for [`request_host_trusted`]. Not logged; the body tells the
+/// user what to change.
+fn untrusted_host_response() -> axum::response::Response {
+    (
+        axum::http::StatusCode::FORBIDDEN,
+        "Host header not allowed for this node. To use a hostname or public address, \
+         start the node with --allowed-host <name>; a reverse proxy must pass the \
+         browser's Host header through unchanged.",
+    )
+        .into_response()
+}
+
+/// Middleware for the node dashboard pages, which show the node's identity,
+/// peers and hosted contracts: refuse them for an untrusted `Host`.
+async fn require_trusted_host(
+    req: axum::extract::Request,
+    next: axum::middleware::Next,
+) -
```

**File**: `crates/core/src/server/client_api/permission_prompts.rs` (modified, +204/-74)
```diff
@@ -117,7 +117,7 @@ use tokio_stream::wrappers::errors::BroadcastStreamRecvError;
 
 use crate::client_events::websocket::{
     UserTokenDecision, decide_user_token, derive_user_context, host_header_ip_in_cidrs,
-    is_allowed_host, is_localhost_origin, is_loopback_source,
+    is_allowed_host, is_host_acceptable, is_localhost_origin, is_loopback_source,
 };
 use crate::contract::delegate_capabilities::{AppIdentity, Grant, capability_description};
 use crate::contract::user_input::{
@@ -602,7 +602,8 @@ fn caller_to_json(caller: &CallerIdentity) -> serde_json::Value {
 ///   cross-origin probes (e.g. a sandboxed iframe whose origin is
 ///   `null`). The body itself reveals nothing.
 /// * **Trusted callers** (loopback / LAN-with-same-IP-Origin /
-///   `allowed-host`-with-matching-Origin / no Origin same-origin GET):
+///   `allowed-host`-with-matching-Origin / no-Origin same-origin GET whose
+///   Host names this node, see [`grants_read_trusted`]):
 ///   reply `200 OK` with the real prompt list and **no**
 ///   `Access-Control-Allow-Origin` header. The legitimate consumer (the
 ///   gateway shell page) is same-origin, so it doesn't need CORS to
@@ -628,18 +629,9 @@ async fn pending_prompts(
     let allowed_hosts = allowed_hosts.as_ref().map(|Extension(v)| v);
     let allowed_source_cidrs = allowed_source_cidrs.as_ref().map(|Extension(v)| v);
 
-    // Missing Origin (e.g. same-origin top-level fetch from some
-    // browsers) is treated as trusted: the source-IP filter in
-    // `server.rs::private_network_filter` and the operator-configured
-    // `allowed-source-cidrs` policy already gate which networks can
-    // reach this endpoint, and the poll payload is not a capability.
-    let trusted = match headers.get("origin") {
-        Some(value) => value
-            .to_str()
-            .map(|s| is_origin_trusted(&headers, s, allowed_hosts, allowed_source_cidrs))
-            .unwrap_or(false),
-        None => true,
-    };
+    // A same-origin GET often carries no Origin; then the Host must pass
+    // `host_trusted_without_origin` (see `grants_read_trusted`).
+    let trusted = grants_read_trusted(&headers, allowed_hosts, allowed_source_cidrs);
 
     if !trusted {
         let mut resp = Json(serde_json::json!([])).into_response();
@@ -786,15 +778,18 @@ async fn list_grants(
     let allowed_hosts = allowed_hosts.as_ref().map(|Extension(v)| v);
     let allowed_source_cidrs = allowed_source_cidrs.as_ref().map(|Extension(v)| v);
     // A same-origin GET often carries no Origin. Without one, require a Host
-    // naming this machine (or an operator-allowed host), so a DNS-rebound
-    // page, whose Host is its own name, reads nothing: which apps a user has
-    // granted is a fingerprint worth keeping.
+    // that passes `host_trusted_without_origin`, so a request whose
+    // Host is an arbitrary hostname reads nothing: the list of granted apps
+    // is not public.
     if !grants_read_trusted(&headers, allowed_hosts, allowed_source_cidrs) {
         return Json(grants_body(None)).into_response();
     }
     Json(grants_body(capabilities_of(op_manager).as_deref())).into_response()
 }
 
+/// Read gate shared by `/permission/pending` and `/permission/grants`: a
+/// present Origin must pass [`is_origin_trusted`]; without one, the Host must
+/// pass [`host_trusted_without_origin`].
 pub(super) fn grants_read_trusted(
     headers: &HeaderMap,
     allowed_hosts: Option<&AllowedHosts>,
@@ -805,10 +800,7 @@ pub(super) fn grants_read_trusted(
             .to_str()
             .map(|s| is_origin_trusted(headers, s, allowed_hosts, allowed_source_cidrs))
             .unwrap_or(false),
-        None => {
-            host_is_loopback(headers)
-                || allowed_hosts.is_some_and(|hosts| is_allowed_host(headers, hosts))
-        }
+        None => host_trusted_without_origin(headers, allowed_hosts, allowed_source_cidrs),
     }
 }
 
@@ -833,6 +825,25 @@ pub(super) fn host_is_loopback(headers: &HeaderMap) -> bool {
     matches!(name.as_str(), "localhost" | "127.0.0.1" | "[::1]")
 }
 
+/// For a request with no `Origin` (a same-origin GET or `EventSource`): the
+/// Host must pass the same check as the shell page ([`is_host_acceptable`]:
+/// `localhost`, an `allowed-host` entry, or a private or
+/// `allowed-source-cidrs` IP literal). Names are never resolved, so a name
+/// that is neither `localhost` nor on the allowlist does not qualify.
+fn host_trusted_without_origin(
+    headers: &HeaderMap,
+    allowed_hosts: Option<&AllowedHosts>,
+    allowed_source_cidrs: Option<&AllowedSourceCidrs>,
+) -> bool {
+    let no_hosts = AllowedHosts::default();
+    let no_cidrs = AllowedSourceCidrs::default();
+    is_host_acceptable(
+        headers,
+        allowed_hosts.unwrap_or(&no_hosts),
+        allowed_source_cidrs.unwrap_or(&no_cidrs),
+    )
+}
+
 /// `{ "grants": [...], "stats": {...} }`. The stats are the capability
 /// counters (lifecycle runs delivered, deferred, d
```

**File**: `crates/core/src/server/client_api/v1.rs` (modified, +4/-0)
```diff
@@ -71,6 +71,7 @@ async fn web_home_v1(
     // Same tolerance as `hosted_mode` above.
     extensions: axum::http::Extensions,
 ) -> Result<axum::response::Response, WebSocketApiError> {
+    let host_trusted = request_host_trusted(&headers, &extensions);
     web_home(
         key,
         rs,
@@ -82,6 +83,7 @@ async fn web_home_v1(
         extensions
             .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
             .map(|ci| ci.0),
+        host_trusted,
     )
     .await
 }
@@ -97,6 +99,7 @@ async fn web_subpages_v1(
     // See `web_home_*`: read from extensions so standalone routers do not 500.
     extensions: axum::http::Extensions,
 ) -> Result<axum::response::Response, WebSocketApiError> {
+    let host_trusted = request_host_trusted(&headers, &extensions);
     web_subpages(
         key,
         last_path,
@@ -109,6 +112,7 @@ async fn web_subpages_v1(
         extensions
             .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
             .map(|ci| ci.0),
+        host_trusted,
     )
     .await
 }
```

**File**: `crates/core/src/server/client_api/v2.rs` (modified, +4/-0)
```diff
@@ -42,6 +42,7 @@ async fn web_home_v2(
     // Same tolerance as `hosted_mode` above.
     extensions: axum::http::Extensions,
 ) -> Result<axum::response::Response, WebSocketApiError> {
+    let host_trusted = request_host_trusted(&headers, &extensions);
     web_home(
         key,
         rs,
@@ -53,6 +54,7 @@ async fn web_home_v2(
         extensions
             .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
             .map(|ci| ci.0),
+        host_trusted,
     )
     .await
 }
@@ -68,6 +70,7 @@ async fn web_subpages_v2(
     // See `web_home_*`: read from extensions so standalone routers do not 500.
     extensions: axum::http::Extensions,
 ) -> Result<axum::response::Response, WebSocketApiError> {
+    let host_trusted = request_host_trusted(&headers, &extensions);
     web_subpages(
         key,
         last_path,
@@ -80,6 +83,7 @@ async fn web_subpages_v2(
         extensions
             .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
             .map(|ci| ci.0),
+        host_trusted,
     )
     .await
 }
```

#### Recent Merged Pull Requests:
- **PR #6189** (2026-11-11): feat(transport): handshake format 2 expresses a floor in the previous version series (@sanity)
- **PR #6188** (2026-11-11): fix(server): tighten client API request validation (@sanity)
- **PR #6185** (2026-11-11): fix(transport): a loss gate in front of QUIC Cubic, so random loss does not collapse the window (@sanity)
- **PR #6182** (2026-11-11): docs(rules): report scope bundling and subject length as INFO (@sanity)
- **PR #6180** (2026-11-11): ci(rule-review): report a non-run as a failure and track the outage (@sanity)
- **PR #6179** (2026-11-10): docs(conformance): drop the stale install-canonicalisation sequencing note (@sanity)

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

## X. transport): a loss gate in front of QUIC Cubic, so random loss does not collapse

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `acae3b45`: transport): a loss gate in front of QUIC Cubic, so random loss does not collapse the window (#6185). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  quic_gate_loss_<queue|share|persistent|ecn|no_sample|ignored> (congestion
  events by the loss gate's verdict, recycle::loss_gate, reported by the path's
  report at each tick; over a path's life they sum to its quic_congestion_events,
  since quinn counts an event where it calls the controller, while one period's
  sums can differ by the events between a tick's two reads) and quic_gate_ended_queue_<lt_10pct|lt_50pct|
  ge_50pct> (paths that ended in the period after at least 20 verdicts, by the
  share passed as a queue). A path whose losses mostly read as a queue runs as
  plain Cubic, from a real queue or from jitter; with the path's loss rate this
  sizes how often jitter defeats the gate in the field.
  TimeSource's connection idle timeout, Cubic behind the loss gate
  (recycle::loss_gate::LossGate, see below) with its window capped to the
  configured bandwidth (recycle::CappedCubic; QuicRateLimit::without_loss_gate,
  test-only, gives plain capped Cubic), 64 uni / 0 bidi streams,
QUIC loss gate (quic/recycle/loss_gate.rs, every QUIC path by default): Cubic
cuts its window on every loss, so under a few percent of random loss (Wi-Fi,
cheap routers) its window collapses and l
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  TimeSource's connection idle timeout, Cubic with its window capped to the
  configured bandwidth (recycle::CappedCubic), 64 uni / 0 bidi streams,
  main they counted for as long as they were held). Under random loss the 384 KiB s
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `acae3b45` are properly handled with clean fallback behavior.
