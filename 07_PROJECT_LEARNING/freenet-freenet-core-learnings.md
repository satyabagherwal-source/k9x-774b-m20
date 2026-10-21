> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `93188d6b`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T03:37:08.158Z  
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
> **Harvest Timestamp**: 2026-10-21T03:37:08.149Z  
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
- **Issue #5955** (2026-10-21): **refactor(transport): add a transport-neutral IncomingStream to the boundary**
  *Symptoms*: ## Problem  `PeerConnectionApi::pipe_stream_data` and `IncomingStreamRegistry::register_inbound_stream` took the UDP transport's reassembly handle, `StreamHandle`. Every layer above the transport that touched an inbound stream therefore named a UDP type: the orphan registry, the GET and PUT drivers, and the node's pipe events. A QUIC transport delivering native streams would have had to fake a fragment handle.  ## Approach  This is phase C step 2 from the #5952 plan. It adds a transport-neutral `IncomingStream` to `transport/boundary.rs`, with exactly the methods the operations and node layers use:  ```rust pub struct IncomingStream(/* private: today the UDP StreamHandle */); impl IncomingStream {     pub fn total_bytes(&self) -> u64;     pub async fn assemble(&self) -> Result<Vec<u8>, StreamError>;     pub fn fork(&self) -> Self;                 // independent reader     pub fn received_fragments(&self) -> usize;  // progress, in transport units     pub fn total_fragments(&self) -> usize;     pub(crate) fn cancel(&self);     pub(crate) fn is_cancelled(&self) -> bool;     pub(crate) fn shares_buffer(&self, &Weak<LockFreeStreamBuffer>) -> bool; // until C3     pub(in crate::transport) fn into_udp(self) -> StreamHandle; } ```  - **The representation is private.** A second transport can turn it into an enum or a trait object without changing the API. - **UDP is unchanged inside.** The UDP connection wraps each new operations stream before registering it. Its `pipe_stream_data` u

- **Issue #5953** (2026-10-21): **feat(telemetry): tag NAT traversal attempts by origin and count stray intros**
  *Symptoms*: ## Problem  Hole punching succeeds on about a quarter of attempts (#5940), and today's telemetry can't say why. `nat_traversal_attempts` lumps together dials that should almost always work, such as a CONNECT joiner dialling an acceptor that is already punching back, with dials that can't work by design, such as a re-dial to a non-gateway peer that isn't expecting us and drops our intro. Some failures are also probably timing or port-mapping misses that never show up as anything but `no_response`. The next fix depends on which of these slices is largest, so this PR measures before changing behaviour.  ## Approach  This PR adds telemetry only. Nothing changes on the wire or in behaviour.  - **Attempt origin.** A new internal `NatAttemptOrigin` (`connect_joiner`, `connect_acceptor`, `gateway`, `ring_peer_no_transport`) is set at each `NodeEvent::ConnectPeer` site. It travels through `HandshakeCommand::Connect`, `OutboundConnector::connect` and `ConnectionStart` to the listener. `transport_snapshot` gains per-period `nat_attempts_<origin>` and `nat_established_<origin>`, and each `nat_fail_samples` entry gets an `origin`. A dial to a configured gateway is always `gateway`, whichever path started it (`dial_origin` in `handle_connect_peer`). The event loop's dial for a message to a peer with no transport is `ring_peer_no_transport` (`unconnected_dial_origin`). Because `peek_target_peer` always returns `None` (since #4110), that dial only reaches configured gateways and peers the ri

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

### Incident Patch 1: `93188d6b` (2026-10-21)
**Commit Message**: feat(telemetry): tag NAT traversal attempts by origin and count stray intros (#5953)

**File**: `.claude/rules/transport.md` (modified, +19/-2)
```diff
@@ -203,7 +203,23 @@ the listener-to-connection queue (`inbound_queue_depth_hwm`, `_drops`) and
 inbound stream refusals / evictions by reason (`inbound_stream_<label>`, one
 per `InboundStreamOutcome`; the never-reset twin feeds the opt-in OTel
 `freenet.transport.inbound_stream_limits`, which must not observe the period
-counters). Hot
+counters), NAT traversals by why they were started (`nat_attempts_<label>`,
+`nat_established_<label>`, one per `NatAttemptOrigin`, and `origin` on each
+`nat_fail_samples` entry; the origin is threaded internally from each
+`NodeEvent::ConnectPeer` through `OutboundConnector::connect` and
+`ConnectionStart`, never on the wire; a dial to a configured gateway is
+always `gateway`, and `ring_peer_no_transport` is the event loop's dial to a
+ring peer whose transport was lost, since cached-peer joins never dial
+(#5954)), intro packets a non-gateway drops as unknown (`stray_intro_<label>`:
+the exact address's traversal timed out (no_response, undecryptable or
+incomplete; not other failures) in the last 10 s,
+a traversal to another port of the IP is running (endpoint-dependent mapping
+OR another peer behind the same IP, e.g. CGNAT; it cannot tell them apart), or
+neither; the recent failures are a listener-owned table bounded by count and
+TTL, and early evictions are counted in `stray_intro_failures_evicted`) and CONNECT
+joiner dial-queue waits (`dial_queue_wait_<label>`, coarse buckets around the
+3 s punch window). Each label set is declared once in a `labelled_counters!`
+list, so a new variant needs a snapshot field. Hot
 path writes are single relaxed atomics; `SentPacketTracker` keeps an
 `rto_expiries` count and a bounded per-stream final-ACK watch, both
 observation only.
@@ -609,7 +625,8 @@ created from its declared length.
     in TRANSPORT_METRICS (cumulative_inbound_stream_outcomes, OTel
     freenet.transport.inbound_stream_limits) and per period in the
     transport_snapshot inbound_stream_<label> fields. A new reason is added
-    once, in the inbound_stream_outcomes! list; it then needs a snapshot field.
+    once, in the InboundStreamOutcome labelled_counters! list; it then needs a
+    snapshot field.
   - A complete operations stream is retired from streaming_handles and the
     registry at once, so only its consumers hold the charge.
   - LockFreeStreamBuffer::insert claims the slot BEFORE reserving bytes, so
```

**File**: `crates/core/src/message.rs` (modified, +3/-0)
```diff
@@ -878,6 +878,9 @@ pub(crate) enum NodeEvent {
         tx: Transaction,
         callback: tokio::sync::mpsc::Sender<ConnectResult>,
         is_gw: bool,
+        /// Why this dial is made (telemetry only; a configured gateway is
+        /// tagged `Gateway` whatever is passed here).
+        origin: crate::transport::NatAttemptOrigin,
     },
     Disconnect {
         cause: Option<Cow<'static, str>>,
```

**File**: `crates/core/src/node/network_bridge/handshake.rs` (modified, +77/-6)
```diff
@@ -104,6 +104,8 @@ pub(crate) enum Command {
         peer: PeerKeyLocation,
         transaction: Transaction,
         transient: bool,
+        /// Why this dial is made (telemetry only).
+        origin: crate::transport::NatAttemptOrigin,
     },
     /// Register expectation for an inbound connection from `peer`.
     ExpectInbound {
@@ -265,8 +267,8 @@ async fn run_driver(
     loop {
         select! {
             command = commands_rx.recv() => match command {
-                Some(Command::Connect { peer, transaction, transient }) => {
-                    spawn_outbound(outbound.clone(), events_tx.clone(), peer, transaction, transient, peer_ready.clone());
+                Some(Command::Connect { peer, transaction, transient, origin }) => {
+                    spawn_outbound(outbound.clone(), events_tx.clone(), peer, transaction, transient, origin, peer_ready.clone());
                 }
             Some(Command::ExpectInbound { peer, transaction, transient }) => {
                     expected_inbound.register(peer, transaction, transient /* transient */);
@@ -379,6 +381,7 @@ fn spawn_outbound(
     peer: PeerKeyLocation,
     transaction: Transaction,
     transient: bool,
+    origin: crate::transport::NatAttemptOrigin,
     peer_ready: Option<Arc<std::sync::atomic::AtomicBool>>,
 ) {
     GlobalExecutor::spawn(async move {
@@ -387,6 +390,7 @@ fn spawn_outbound(
             peer,
             transaction,
             transient,
+            origin,
             peer_ready.as_deref(),
         )
         .await;
@@ -414,12 +418,13 @@ async fn connect_outbound(
     peer: PeerKeyLocation,
     transaction: Transaction,
     transient: bool,
+    origin: crate::transport::NatAttemptOrigin,
     peer_ready: Option<&std::sync::atomic::AtomicBool>,
 ) -> Event {
     let addr = peer
         .socket_addr()
         .expect("Connect requires known peer address");
-    let connect_future = outbound.connect(peer.pub_key.clone(), addr).await;
+    let connect_future = outbound.connect(peer.pub_key.clone(), addr, origin).await;
     let result: Result<Box<dyn PeerConnectionApi>, ConnectionError> =
         match tokio::time::timeout(OUTBOUND_CONNECT_TIMEOUT, connect_future).await {
             Ok(res) => res.map_err(|err| err.into()),
@@ -532,6 +537,43 @@ mod tests {
         }
     }
 
+    /// A `Connect` command reaches the connector with its origin.
+    #[tokio::test(start_paused = true)]
+    async fn run_driver_passes_the_connect_commands_origin_to_the_connector() {
+        let (_conn_tx, conn_rx) = mpsc::channel(4);
+        let (cmd_tx, cmd_rx) = mpsc::channel(4);
+        let (event_tx, mut event_rx) = mpsc::channel(4);
+        let connector = Arc::new(ScriptedConnector {
+            enqueue: Duration::ZERO,
+            handshake: Handshake::Succeeds,
+            origins: Default::default(),
+        });
+        let driver = GlobalExecutor::spawn(run_driver(
+            Box::new(ChannelAcceptor(conn_rx)),
+            connector.clone(),
+            cmd_rx,
+            event_tx,
+            None,
+        ));
+        cmd_tx
+            .send(Command::Connect {
+                peer: make_peer(4310),
+                transaction: Transaction::new::<ConnectMsg>(),
+                transient: false,
+                origin: crate::transport::NatAttemptOrigin::Gateway,
+            })
+            .await
+            .unwrap();
+        let Some(Event::OutboundEstablished { .. }) = event_rx.recv().await else {
+            panic!("expected OutboundEstablished");
+        };
+        assert_eq!(
+            *connector.origins.lock(),
+            vec![crate::transport::NatAttemptOrigin::Gateway]
+        );
+        driver.abort();
+    }
+
     /// The accept loop, driven through `Box<dyn InboundAcceptor>`: an
     /// expected connection is reported with its peer, transaction and
     /// transient flag; an unexpected one with none of them; each accept marks
@@ -547,6 +589,7 @@ mod tests {
             Arc::new(ScriptedConnector {
                 enqueue: Duration::ZERO,
                 handshake: Handshake::Hangs,
+                origins: Default::default(),
             }),
             cmd_rx,
             event_tx,
@@ -637,6 +680,8 @@ mod tests {
     struct ScriptedConnector {
         enqueue: Duration,
         handshake: Handshake,
+        /// The origin each `connect` was called with.
+        origins: parking_lot::Mutex<Vec<crate::transport::NatAttemptOrigin>>,
     }
 
     impl OutboundConnector for ScriptedConnector {
@@ -646,9 +691,11 @@ mod tests {
             &self,
             _remote_public_key: crate::transport::TransportPublicKey,
             remote_addr: SocketAddr,
+            origin: crate::transport::NatAttemptOrigin,
         ) -> Pin<
             Box<dyn std::future::Future<Output = crate::transport::PendingConnection> + Send + '_>,
         > {
+            self.origins.lock().push(origin);
             let (enqueue, handshake) = (self.enqueue
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +81/-26)
```diff
@@ -1896,6 +1896,7 @@ impl P2pConnManager {
                                             tx,
                                             callback,
                                             is_gw,
+                                            origin: unconnected_dial_origin(is_gw),
                                         }),
                                     ) {
                                         // `err` owns the ConnectPeer event (and thus the
@@ -2468,6 +2469,7 @@ impl P2pConnManager {
                                 tx,
                                 callback,
                                 is_gw: transient,
+                                origin,
                             } => {
                                 tracing::debug!(
                                     tx = %tx,
@@ -2484,6 +2486,7 @@ impl P2pConnManager {
                                     &handshake_cmd_sender,
                                     &mut state,
                                     transient,
+                                    origin,
                                 )
                                 .await?;
                             }
@@ -3082,6 +3085,21 @@ fn orphan_transaction(
     live_tx_tracker.remove_finished_transaction(tx);
 }
 
+/// The origin of the event loop's dial for a message to a peer it has no
+/// transport to. The target is a configured gateway or a peer the ring still
+/// lists (`peek_target_peer` always returns `None` since #4110, so nothing
+/// else reaches the dial), so a non-gateway target is a ring peer whose
+/// transport was lost. The message may be from any op: a relayed request, a
+/// reply, or our own CONNECT request routed through that peer (for example
+/// by `acquire_new`). Cached-peer joins never reach this dial (#5954).
+fn unconnected_dial_origin(is_gw: bool) -> crate::transport::NatAttemptOrigin {
+    if is_gw {
+        crate::transport::NatAttemptOrigin::Gateway
+    } else {
+        crate::transport::NatAttemptOrigin::RingPeerNoTransport
+    }
+}
+
 /// What to tell the event loop when `msg`, waiting for a connection to
 /// `target_addr`, was dropped because the connection failed. Only this
 /// node's own CONNECT request as a joiner (`own`) is reported (#5858): its
@@ -4143,9 +4161,37 @@ pub(crate) mod tests {
     /// event loop, which has no harness here.
     #[test]
     fn the_resend_waiter_reports_only_a_message_it_did_not_send() {
+        let code = event_loop_code();
+        let own = "&ctx.bridge.op_manager.ring.connection_manager.pub_key,";
+        let notice = code
+            .find(&format!(
+                "letunsent_notice=unsent_message_notice(&msg_clone,tx,target_addr,{own});"
+            ))
+            .expect("the waiter must work out the notice before msg_clone is moved");
+        let sent = code[notice..]
+            .find("iflet(false,Some(notice))=(resent,unsent_notice){ifletErr(e)=bridge_sender.send_timeout(P2pBridgeEvent::NodeAction(notice),UNSENT_NOTICE_SEND_TIMEOUT,).await")
+            .expect("the notice must go out only when the message was not resent");
+        let resent_ok = code[notice..]
+            .find("\"Failedtoreschedulemessageafterconnectionestablished\");}true}")
+            .expect("a resent message must count as sent");
+        assert!(resent_ok < sent);
+        let dropped = code
+            .find("overwhelmingtheeventloop.\");")
+            .expect("the ConnectPeer full/closed branch");
+        let inline = code[dropped..]
+            .find(&format!(
+                "ifunsent_message_notice(&msg,tx,target_addr,{own}).is_some(){{orphan_transaction(&mutstate,&ctx.bridge.op_manager.ring.live_tx_tracker,tx,target_addr,);}}"
+            ))
+            .expect("the full/closed branch must end an unsent CONNECT's driver");
+        let cont = code[dropped..].find("continue;").expect("the branch ends");
+        assert!(inline < cont, "before the branch moves on");
+    }
+
+    /// The event-loop function `run_event_listener_with_transport`, with all
+    /// whitespace removed. Scoped to that function: a whole-file scrape could
+    /// match a literal anywhere, including in these tests.
+    fn event_loop_code() -> String {
         const SOURCE: &str = include_str!("p2p_protoc.rs");
-        // Scoped to the event-loop function that holds both drop sites: a
-        // whole-file scrape could match these literals anywhere.
         let signature = "async fn run_event_listener_with_transport(";
         let start = SOURCE.find(signature).expect("event-loop function renamed");
         let tests_at = SOURCE
@@ -4169,30 +4215,39 @@ pub(crate) mod tests {
             }
         }
         assert!(end > open && end < tests_at, "unbalanced body slice");
-        let code: String = SOURCE[open..end].split_whitespace().collect();
-        let own = "&ctx.bridge.op_manager.ring.connection_manager.pub_key,";
-        let notice = code
-            .find(&format!(
-                "letunsent_
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc/connection_lifecycle.rs` (modified, +123/-0)
```diff
@@ -204,6 +204,9 @@ impl P2pConnManager {
         }
     }
 
+    // `origin` is telemetry carried alongside the dial; bundling it with the
+    // other arguments would only move them into a one-use struct.
+    #[allow(clippy::too_many_arguments)]
     pub(super) async fn handle_connect_peer(
         &mut self,
         peer: PeerKeyLocation,
@@ -212,6 +215,7 @@ impl P2pConnManager {
         handshake_commands: &HandshakeCommandSender,
         state: &mut EventListenerState,
         transient: bool,
+        origin: crate::transport::NatAttemptOrigin,
     ) -> anyhow::Result<()> {
         // Periodic cleanup of expired backoff entries (every 60 seconds)
         const BACKOFF_CLEANUP_INTERVAL: Duration = Duration::from_secs(60);
@@ -602,10 +606,12 @@ impl P2pConnManager {
         // parking. The connect op can retry on a later attempt; this failure is
         // LOCAL channel contention, not a remote connection failure, so we do
         // NOT record peer backoff.
+        let origin = dial_origin(origin, transient, peer_addr, &self.gateways);
         if !handshake_commands.try_send(HandshakeCommand::Connect {
             peer: peer.clone(),
             transaction: tx,
             transient,
+            origin,
         }) {
             tracing::warn!(
                 tx = %tx,
@@ -1597,3 +1603,120 @@ impl P2pConnManager {
         }
     }
 }
+
+/// The origin a dial is reported under: `Gateway` for any dial to a
+/// configured gateway (or one the caller marked as a gateway dial), whichever
+/// path started it, otherwise the caller's `origin`. A CONNECT joiner whose
+/// acceptor is a gateway, for example, is still a gateway dial.
+fn dial_origin(
+    origin: crate::transport::NatAttemptOrigin,
+    is_gw: bool,
+    peer_addr: SocketAddr,
+    gateways: &[PeerKeyLocation],
+) -> crate::transport::NatAttemptOrigin {
+    if is_gw
+        || gateways
+            .iter()
+            .any(|gw| gw.socket_addr() == Some(peer_addr))
+    {
+        crate::transport::NatAttemptOrigin::Gateway
+    } else {
+        origin
+    }
+}
+
+#[cfg(test)]
+mod dial_origin_tests {
+    use super::*;
+    use crate::transport::NatAttemptOrigin;
+
+    fn gateway() -> PeerKeyLocation {
+        PeerKeyLocation::new(
+            crate::transport::TransportKeypair::new().public().clone(),
+            "192.0.2.1:31337".parse().unwrap(),
+        )
+    }
+
+    /// A dial to a configured gateway is `Gateway` whatever path started it.
+    #[test]
+    fn a_configured_gateway_is_always_a_gateway_dial() {
+        let gw = gateway();
+        let addr = gw.socket_addr().unwrap();
+        for origin in NatAttemptOrigin::ALL {
+            assert_eq!(
+                dial_origin(origin, false, addr, std::slice::from_ref(&gw)),
+                NatAttemptOrigin::Gateway,
+                "{origin:?}"
+            );
+        }
+    }
+
+    /// A dial the caller marked as a gateway dial is `Gateway` even before
+    /// the gateway list knows the address.
+    #[test]
+    fn a_marked_gateway_dial_is_a_gateway_dial() {
+        let addr: SocketAddr = "198.51.100.4:9".parse().unwrap();
+        assert_eq!(
+            dial_origin(NatAttemptOrigin::RingPeerNoTransport, true, addr, &[]),
+            NatAttemptOrigin::Gateway
+        );
+    }
+
+    /// Source pin: `handle_connect_peer` applies `dial_origin` to the
+    /// origin it hands to the handshake driver (the event loop has no
+    /// harness here).
+    #[test]
+    fn handle_connect_peer_applies_dial_origin() {
+        const SOURCE: &str = include_str!("connection_lifecycle.rs");
+        let tests_at = SOURCE
+            .find("\n#[cfg(test)]\nmod dial_origin_tests")
+            .expect("test module");
+        let start = SOURCE
+            .find("pub(super) async fn handle_connect_peer(")
+            .expect("handle_connect_peer renamed");
+        assert!(start < tests_at, "the anchor must be production code");
+        let open = start
+            + SOURCE[start..]
+                .find(") -> anyhow::Result<()> {")
+                .expect("body")
+            + 24;
+        let (mut depth, mut end) = (0i32, open);
+        for (i, b) in SOURCE.bytes().enumerate().skip(open) {
+            match b {
+                b'{' => depth += 1,
+                b'}' => {
+                    depth -= 1;
+                    if depth == 0 {
+                        end = i;
+                        break;
+                    }
+                }
+                _ => {}
+            }
+        }
+        assert!(end > open && end < tests_at, "unbalanced body slice");
+        let code: String = SOURCE[open..end].split_whitespace().collect();
+        let applied = code
+            .find("letorigin=dial_origin(origin,transient,peer_addr,&self.gateways);")
+            .expect("handle_connect_peer must apply dial_origin");
+        let sent = code
+            .find("HandshakeCommand::Connect{peer:peer.clone(),transaction:tx,transient,ori
```

**File**: `crates/core/src/operations/connect.rs` (modified, +1/-0)
```diff
@@ -1459,6 +1459,7 @@ pub(super) async fn dispatch_expect_connection_from(
             tx,
             callback,
             is_gw: false,
+            origin: crate::transport::NatAttemptOrigin::ConnectAcceptor,
         })
         .await?;
 
```

**File**: `crates/core/src/operations/connect/op_ctx_task.rs` (modified, +167/-9)
```diff
@@ -424,7 +424,9 @@ async fn drive_client_connect(
     // one unreachable acceptor cannot hold the next one past its hole-punch
     // window (#5858). A peer that already has a connection keeps dialling
     // one at a time, as before.
-    let mut dial_queue: AcceptorDialQueue<PeerKeyLocation> = AcceptorDialQueue::new(
+    // Each acceptor carries when its Response arrived, so the dial can
+    // report how long it waited in the queue (telemetry).
+    let mut dial_queue: AcceptorDialQueue<(PeerKeyLocation, Instant)> = AcceptorDialQueue::new(
         if bootstrapping {
             MAX_CONCURRENT_ACCEPTOR_DIALS
         } else {
@@ -522,8 +524,8 @@ async fn drive_client_connect(
                 acceptor_addr,
                 result,
             })) => {
-                if let Some(next) = dial_queue.finish() {
-                    dials.push(begin_acceptor_dial(op_manager, tx, next).await?);
+                if let Some((next, answered_at)) = dial_queue.finish() {
+                    dials.push(begin_acceptor_dial(op_manager, tx, next, answered_at).await?);
                 }
                 // The address the connection was made to, which can differ from
                 // the advertised one when an existing transport is reused.
@@ -766,10 +768,12 @@ async fn drive_client_connect(
 
                 // `accepted` only grows with what the queue takes, so both
                 // stay within `acceptor_limit`.
-                match dial_queue.offer(payload.acceptor.clone()) {
-                    Offer::Dial(acceptor) => {
+                match dial_queue.offer((payload.acceptor.clone(), Instant::now())) {
+                    Offer::Dial((acceptor, answered_at)) => {
                         accepted.insert(acceptor.clone());
-                        dials.push(begin_acceptor_dial(op_manager, tx, acceptor).await?);
+                        dials.push(
+                            begin_acceptor_dial(op_manager, tx, acceptor, answered_at).await?,
+                        );
                     }
                     Offer::Queued => {
                         accepted.insert(payload.acceptor.clone());
@@ -925,12 +929,14 @@ struct AcceptorDial {
     result: Option<crate::message::ConnectResult>,
 }
 
-/// Starts the hole punch to `acceptor` and returns a future that resolves
-/// with its outcome, so several acceptors can be dialled at once.
+/// Starts the hole punch to `acceptor`, whose Response arrived at
+/// `answered_at`, and returns a future that resolves with its outcome, so
+/// several acceptors can be dialled at once.
 async fn begin_acceptor_dial(
     op_manager: &OpManager,
     tx: Transaction,
     acceptor: PeerKeyLocation,
+    answered_at: Instant,
 ) -> Result<impl std::future::Future<Output = AcceptorDial> + Send + 'static, OpError> {
     // The Response arm only queues acceptors that have a socket address.
     let acceptor_addr = acceptor.socket_addr().ok_or(OpError::UnexpectedOpState)?;
@@ -947,8 +953,16 @@ async fn begin_acceptor_dial(
             tx,
             callback,
             is_gw: false,
+            origin: crate::transport::NatAttemptOrigin::ConnectJoiner,
         })
         .await?;
+    // The acceptor started punching when it accepted, before its Response
+    // reached us; time spent queued here comes out of its 3 s window. Taken
+    // only once the dial is handed to the event loop, so the wait includes
+    // any time the two sends above were blocked, and a dial that was never
+    // sent is not counted.
+    crate::transport::TRANSPORT_METRICS
+        .record_dial_queue_wait(acceptor_addr, answered_at.elapsed());
     Ok(async move {
         let result = rx.recv().await;
         AcceptorDial {
@@ -2826,6 +2840,8 @@ mod driver_timing_tests {
         max_in_flight: usize,
         /// Acceptors the driver reported to the gateway as failed.
         connect_failed: Vec<SocketAddr>,
+        /// The origin each dial was tagged with.
+        origins: Vec<crate::transport::NatAttemptOrigin>,
     }
 
     /// Plays the event loop: every dial takes the NAT traversal deadline and
@@ -2842,12 +2858,18 @@ mod driver_timing_tests {
             use std::sync::atomic::Ordering::SeqCst;
             while let Some(event) = events.recv().await {
                 match event {
-                    Either::Right(NodeEvent::ConnectPeer { peer, callback, .. }) => {
+                    Either::Right(NodeEvent::ConnectPeer {
+                        peer,
+                        callback,
+                        origin,
+                        ..
+                    }) => {
                         let addr = peer.socket_addr().expect("acceptor address");
                         let now_in_flight = in_flight.fetch_add(1, SeqCst) + 1;
                         {
                             let mut log = shared.lock();
                             log.dials.push((addr, t0.elapsed()));
+                            log.origins.push(origin);
          
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +112/-0)
```diff
@@ -2809,6 +2809,70 @@ fn event_kind_to_json(kind: &EventKind) -> serde_json::Value {
                 "inbound_stream_evicted_age".into(),
                 serde_json::json!(snapshot.inbound_stream_evicted_age),
             );
+            m.insert(
+                "nat_attempts_connect_joiner".into(),
+                serde_json::json!(snapshot.nat_attempts_connect_joiner),
+            );
+            m.insert(
+                "nat_attempts_connect_acceptor".into(),
+                serde_json::json!(snapshot.nat_attempts_connect_acceptor),
+            );
+            m.insert(
+                "nat_attempts_gateway".into(),
+                serde_json::json!(snapshot.nat_attempts_gateway),
+            );
+            m.insert(
+                "nat_attempts_ring_peer_no_transport".into(),
+                serde_json::json!(snapshot.nat_attempts_ring_peer_no_transport),
+            );
+            m.insert(
+                "nat_established_connect_joiner".into(),
+                serde_json::json!(snapshot.nat_established_connect_joiner),
+            );
+            m.insert(
+                "nat_established_connect_acceptor".into(),
+                serde_json::json!(snapshot.nat_established_connect_acceptor),
+            );
+            m.insert(
+                "nat_established_gateway".into(),
+                serde_json::json!(snapshot.nat_established_gateway),
+            );
+            m.insert(
+                "nat_established_ring_peer_no_transport".into(),
+                serde_json::json!(snapshot.nat_established_ring_peer_no_transport),
+            );
+            m.insert(
+                "stray_intro_after_deadline".into(),
+                serde_json::json!(snapshot.stray_intro_after_deadline),
+            );
+            m.insert(
+                "stray_intro_same_ip_other_port".into(),
+                serde_json::json!(snapshot.stray_intro_same_ip_other_port),
+            );
+            m.insert(
+                "stray_intro_other".into(),
+                serde_json::json!(snapshot.stray_intro_other),
+            );
+            m.insert(
+                "stray_intro_failures_evicted".into(),
+                serde_json::json!(snapshot.stray_intro_failures_evicted),
+            );
+            m.insert(
+                "dial_queue_wait_lt_100ms".into(),
+                serde_json::json!(snapshot.dial_queue_wait_lt_100ms),
+            );
+            m.insert(
+                "dial_queue_wait_lt_1s".into(),
+                serde_json::json!(snapshot.dial_queue_wait_lt_1s),
+            );
+            m.insert(
+                "dial_queue_wait_lt_3s".into(),
+                serde_json::json!(snapshot.dial_queue_wait_lt_3s),
+            );
+            m.insert(
+                "dial_queue_wait_ge_3s".into(),
+                serde_json::json!(snapshot.dial_queue_wait_ge_3s),
+            );
             serde_json::Value::Object(m)
         }
         EventKind::InterestSync(interest_sync_event) => {
@@ -6450,6 +6514,54 @@ mod tests {
         assert_eq!(actual, expected);
     }
 
+    /// As below, for the NAT-origin, stray-intro and dial-queue counts:
+    /// each is distinct and non-zero, so a swapped or mis-keyed one is caught.
+    #[test]
+    fn transport_snapshot_json_carries_nat_origin_values() {
+        let snapshot = crate::transport::metrics::TransportSnapshot {
+            nat_attempts_connect_joiner: 1,
+            nat_attempts_connect_acceptor: 2,
+            nat_attempts_gateway: 3,
+            nat_attempts_ring_peer_no_transport: 5,
+            nat_established_connect_joiner: 6,
+            nat_established_connect_acceptor: 7,
+            nat_established_gateway: 8,
+            nat_established_ring_peer_no_transport: 10,
+            stray_intro_after_deadline: 11,
+            stray_intro_same_ip_other_port: 12,
+            stray_intro_other: 13,
+            stray_intro_failures_evicted: 18,
+            dial_queue_wait_lt_100ms: 14,
+            dial_queue_wait_lt_1s: 15,
+            dial_queue_wait_lt_3s: 16,
+            dial_queue_wait_ge_3s: 17,
+            ..Default::default()
+        };
+        let reference = serde_json::to_value(&snapshot).unwrap();
+        let json = event_kind_to_json(&super::super::EventKind::TransportSnapshot(snapshot));
+        for (key, expected) in [
+            ("nat_attempts_connect_joiner", 1),
+            ("nat_attempts_connect_acceptor", 2),
+            ("nat_attempts_gateway", 3),
+            ("nat_attempts_ring_peer_no_transport", 5),
+            ("nat_established_connect_joiner", 6),
+            ("nat_established_connect_acceptor", 7),
+            ("nat_established_gateway", 8),
+            ("nat_established_ring_peer_no_transport", 10),
+            ("stray_intro_after_deadline", 11),
+            ("stray_intro_same_ip_other_port", 12),
+            ("stray_intro_other", 13),
+            ("stray_intro_failures_evicted", 18),
+            ("dial_queue_wait_lt_100ms", 
```

---

### Incident Patch 2: `2d27f0a1` (2026-10-21)
**Commit Message**: refactor(transport): add a transport-neutral IncomingStream to the boundary (#5955)

**File**: `.claude/rules/transport.md` (modified, +9/-3)
```diff
@@ -552,9 +552,15 @@ USE: LockFreeStreamBuffer (AtomicPtr<Bytes> slots, 256-slot chunks
   - Lock-free insertion
   - Ordered delivery to consumer
 
-Legacy (non-operations) streams use InboundStream only; operations streams
-use StreamHandle/StreamRegistry/orphan registry only. Never feed one stream
-to both.
+Three stream types, never mixed:
+  - inbound_stream::InboundStream: the UDP transport's reassembler for its
+    OWN streams (oversized messages, StreamId::next_transport_internal).
+    Transport-internal.
+  - StreamHandle (with StreamRegistry): the UDP transport's handle for
+    caller-named streams (StreamId::next). Transport-internal.
+  - boundary::IncomingStream: what the registry, operations and node see.
+    Above the transport, use only this; it wraps a StreamHandle today.
+Never feed one stream to both reassembly paths.
 ```
 
 ### WHEN admitting or sending a stream
```

**File**: `crates/core/src/node/network_bridge.rs` (modified, +2/-2)
```diff
@@ -85,15 +85,15 @@ pub(crate) trait NetworkBridge: Send + Sync {
     /// Pipe an inbound stream to a peer, forwarding fragments as they arrive.
     ///
     /// Unlike `send_stream` which takes complete data and fragments it, this forwards
-    /// fragments from an existing `StreamHandle` incrementally without waiting for
+    /// data from an existing `IncomingStream` incrementally without waiting for
     /// full reassembly. This enables low-latency forwarding at intermediate nodes.
     ///
     /// The `outbound_stream_id` should be created via `StreamId::next()`.
     fn pipe_stream(
         &self,
         target_addr: SocketAddr,
         outbound_stream_id: crate::transport::StreamId,
-        inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+        inbound_handle: crate::transport::IncomingStream,
         metadata: Option<bytes::Bytes>,
     ) -> impl Future<Output = ConnResult<()>> + Send;
 }
```

**File**: `crates/core/src/node/network_bridge/handshake.rs` (modified, +1/-1)
```diff
@@ -513,7 +513,7 @@ mod tests {
         fn pipe_stream_data(
             &mut self,
             _outbound_stream_id: crate::transport::StreamId,
-            _inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+            _inbound_handle: crate::transport::IncomingStream,
             _metadata: Option<bytes::Bytes>,
             _progress: Option<Arc<dyn crate::transport::StreamProgressObserver>>,
         ) -> Pin<Box<dyn std::future::Future<Output = Result<(), TransportError>> + Send + '_>>
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +4/-4)
```diff
@@ -163,7 +163,7 @@ pub(crate) enum P2pBridgeEvent {
     PipeStream {
         target_addr: SocketAddr,
         outbound_stream_id: StreamId,
-        inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+        inbound_handle: crate::transport::IncomingStream,
         metadata: Option<bytes::Bytes>,
     },
 }
@@ -507,7 +507,7 @@ impl NetworkBridge for P2pBridge {
         &self,
         target_addr: SocketAddr,
         outbound_stream_id: StreamId,
-        inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+        inbound_handle: crate::transport::IncomingStream,
         metadata: Option<bytes::Bytes>,
     ) -> super::ConnResult<()> {
         self.ev_listener_tx
@@ -3270,7 +3270,7 @@ pub(super) enum ConnEvent {
     PipeStream {
         target_addr: SocketAddr,
         outbound_stream_id: StreamId,
-        inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+        inbound_handle: crate::transport::IncomingStream,
         metadata: Option<bytes::Bytes>,
     },
 }
@@ -3999,7 +3999,7 @@ pub(crate) mod tests {
         fn pipe_stream_data(
             &mut self,
             _outbound_stream_id: crate::transport::StreamId,
-            _inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+            _inbound_handle: crate::transport::IncomingStream,
             _metadata: Option<bytes::Bytes>,
             _progress: Option<Arc<dyn crate::transport::StreamProgressObserver>>,
         ) -> std::pin::Pin<
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc/zombie_sweep.rs` (modified, +1/-1)
```diff
@@ -2466,7 +2466,7 @@ mod tests {
         fn pipe_stream_data(
             &mut self,
             _outbound_stream_id: StreamId,
-            _inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+            _inbound_handle: crate::transport::IncomingStream,
             _metadata: Option<bytes::Bytes>,
             _progress: Option<std::sync::Arc<dyn crate::transport::StreamProgressObserver>>,
         ) -> Pin<Box<dyn Future<Output = Result<(), TransportError>> + Send + '_>> {
```

**File**: `crates/core/src/node/network_bridge/priority_select/tests.rs` (modified, +1/-1)
```diff
@@ -2852,7 +2852,7 @@ impl crate::transport::PeerConnectionApi for MockPeerConnection {
     fn pipe_stream_data(
         &mut self,
         _outbound_stream_id: crate::transport::StreamId,
-        _inbound_handle: crate::transport::peer_connection::streaming::StreamHandle,
+        _inbound_handle: crate::transport::IncomingStream,
         _metadata: Option<bytes::Bytes>,
         _progress: Option<std::sync::Arc<dyn crate::transport::StreamProgressObserver>>,
     ) -> std::pin::Pin<
```

**File**: `crates/core/src/operations/get/op_ctx_task.rs` (modified, +16/-10)
```diff
@@ -9104,7 +9104,7 @@ mod route_attempt_driver_tests {
             .expect("the fragment is accepted");
         op_manager
             .orphan_stream_registry()
-            .register_orphan(from, stream_id, handle);
+            .register_test_orphan(from, stream_id, handle);
     }
 
     fn streaming_header(
@@ -9372,9 +9372,11 @@ mod route_attempt_driver_tests {
             handle
                 .push_fragment(1, bytes::Bytes::from(payload))
                 .expect("fragment accepted");
-            op_manager
-                .orphan_stream_registry()
-                .register_orphan(addr(&peers[2]), stream_id, handle);
+            op_manager.orphan_stream_registry().register_test_orphan(
+                addr(&peers[2]),
+                stream_id,
+                handle,
+            );
 
             let hop = peers[2].clone();
             serve_attempts(
@@ -10360,9 +10362,11 @@ mod route_attempt_driver_tests {
         let handle =
             crate::transport::peer_connection::streaming::StreamHandle::new(stream_id, 4096);
         handle.cancel();
-        op_manager
-            .orphan_stream_registry()
-            .register_orphan(addr(&peers[0]), stream_id, handle);
+        op_manager.orphan_stream_registry().register_test_orphan(
+            addr(&peers[0]),
+            stream_id,
+            handle,
+        );
         let header_hop = peers[0].clone();
         serve_attempts(
             op_manager.clone(),
@@ -12656,9 +12660,11 @@ mod route_attempt_driver_tests {
         handle
             .push_fragment(1, bytes::Bytes::from(payload))
             .expect("fragment accepted");
-        op_manager
-            .orphan_stream_registry()
-            .register_orphan(addr(&peers[0]), stream_id, handle);
+        op_manager.orphan_stream_registry().register_test_orphan(
+            addr(&peers[0]),
+            stream_id,
+            handle,
+        );
         serve_attempts(
             op_manager.clone(),
             rx,
```

**File**: `crates/core/src/operations/orphan_streams.rs` (modified, +38/-24)
```diff
@@ -36,7 +36,9 @@ use tokio::time::Instant;
 use dashmap::DashMap;
 use tokio::sync::oneshot;
 
+use crate::transport::IncomingStream;
 use crate::transport::StreamId;
+#[cfg(test)]
 use crate::transport::peer_connection::streaming::StreamHandle;
 use crate::transport::peer_connection::streaming_buffer::LockFreeStreamBuffer;
 
@@ -71,9 +73,9 @@ type StreamKey = (SocketAddr, StreamId);
 enum Slot {
     /// The stream arrived before its metadata (RequestStreaming /
     /// ResponseStreaming): the handle and when it was registered.
-    Orphan(StreamHandle, Instant),
+    Orphan(IncomingStream, Instant),
     /// The metadata arrived first: the claimant waiting for the stream.
-    Waiter(oneshot::Sender<StreamHandle>),
+    Waiter(oneshot::Sender<IncomingStream>),
 }
 
 pub struct OrphanStreamRegistry {
@@ -113,7 +115,7 @@ impl OrphanStreamRegistry {
         &self,
         peer_addr: SocketAddr,
         stream_id: StreamId,
-        handle: StreamHandle,
+        handle: IncomingStream,
     ) {
         use dashmap::mapref::entry::Entry;
         let key = (peer_addr, stream_id);
@@ -188,7 +190,7 @@ impl OrphanStreamRegistry {
         peer_addr: SocketAddr,
         stream_id: StreamId,
         timeout: Duration,
-    ) -> Result<StreamHandle, OrphanStreamError> {
+    ) -> Result<IncomingStream, OrphanStreamError> {
         use dashmap::mapref::entry::Entry;
         let key = (peer_addr, stream_id);
         // Atomic dedup: try to insert into claimed_streams. If already present,
@@ -321,6 +323,18 @@ impl OrphanStreamRegistry {
         );
     }
 
+    /// [`Self::register_orphan`] for tests that build a UDP `StreamHandle`
+    /// directly.
+    #[cfg(test)]
+    pub(crate) fn register_test_orphan(
+        &self,
+        peer_addr: SocketAddr,
+        stream_id: StreamId,
+        handle: impl Into<IncomingStream>,
+    ) {
+        self.register_orphan(peer_addr, stream_id, handle.into());
+    }
+
     /// Cancel the unclaimed orphans among `streams` from `peer_addr` when the
     /// connection that received them is gone. Each is matched by buffer, so
     /// a stream with the same key from another connection is left alone, as
@@ -460,9 +474,9 @@ impl crate::transport::InboundStreamRegistry for OrphanStreamRegistry {
         &self,
         peer_addr: SocketAddr,
         stream_id: StreamId,
-        handle: StreamHandle,
+        stream: IncomingStream,
     ) {
-        self.register_orphan(peer_addr, stream_id, handle);
+        self.register_orphan(peer_addr, stream_id, stream);
     }
 
     fn cancel_unclaimed_streams(
@@ -542,7 +556,7 @@ mod tests {
         let addr = dummy_addr();
 
         // Register orphan
-        registry.register_orphan(addr, stream_id, handle);
+        registry.register_test_orphan(addr, stream_id, handle);
         assert_eq!(registry.orphan_count(), 1);
 
         // Claim immediately
@@ -573,7 +587,7 @@ mod tests {
 
         // Register orphan (should deliver to waiter)
         let handle = make_test_handle(stream_id);
-        registry.register_orphan(addr, stream_id, handle);
+        registry.register_test_orphan(addr, stream_id, handle);
 
         // Waiter should succeed
         let result = waiter.await.unwrap();
@@ -589,7 +603,7 @@ mod tests {
         let addr = dummy_addr();
 
         // Register and claim once
-        registry.register_orphan(addr, stream_id, handle);
+        registry.register_test_orphan(addr, stream_id, handle);
         let result = registry
             .claim_or_wait(addr, stream_id, Duration::from_secs(1))
             .await;
@@ -630,7 +644,7 @@ mod tests {
         // Insert with fake old timestamp by directly manipulating
         registry.slots.insert(
             (addr, stream_id),
-            Slot::Orphan(handle, Instant::now() - EXPIRED_ORPHAN_AGE),
+            Slot::Orphan(handle.into(), Instant::now() - EXPIRED_ORPHAN_AGE),
         );
 
         assert_eq!(registry.orphan_count(), 1);
@@ -648,7 +662,7 @@ mod tests {
         let addr = dummy_addr();
 
         // Register fresh orphan
-        registry.register_orphan(addr, stream_id, handle);
+        registry.register_test_orphan(addr, stream_id, handle);
         assert_eq!(registry.orphan_count(), 1);
 
         // GC should preserve fresh stream
@@ -663,7 +677,7 @@ mod tests {
         let registry = OrphanStreamRegistry::new();
         let stream_id = StreamId::next();
         let handle = make_test_handle(stream_id);
-        registry.register_orphan(dummy_addr(), stream_id, handle.clone());
+        registry.register_test_orphan(dummy_addr(), stream_id, handle.clone());
         handle.cancel();
         registry.gc_expired();
         assert_eq!(registry.orphan_count(), 0);
@@ -681,20 +695,20 @@ mod tests {
 
         let mine = StreamId::next();
         let mine_handle = make_test_handle(mine);
-        registry.register_orphan(dummy_addr(), mine, mine_handle.clone());
+        registry.register_test_orphan(dummy_addr(), mine, mine_han
```

#### Recent Merged Pull Requests:
- **PR #5955** (2026-10-21): refactor(transport): add a transport-neutral IncomingStream to the boundary (@sanity)
- **PR #5953** (2026-10-21): feat(telemetry): tag NAT traversal attempts by origin and count stray intros (@sanity)
- **PR #5952** (2026-10-21): refactor(transport): make StreamId a boundary-owned, sender-chosen id (@sanity)
- **PR #5949** (2026-10-20): refactor(transport): move inbound accept, transport opening and liveness behind the boundary (@sanity)
- **PR #5948** (2026-10-20): fix(test): make send_stream bandwidth-limit tests deterministic with VirtualTime (@sanity)
- **PR #5946** (2026-10-20): refactor(transport): open outbound connections through an OutboundConnector trait (@sanity)

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

## X. telemetry): tag NAT traversal attempts by origin and count stray intros (#5953)

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `93188d6b`: telemetry): tag NAT traversal attempts by origin and count stray intros (#5953). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
counters), NAT traversals by why they were started (`nat_attempts_<label>`,
`nat_established_<label>`, one per `NatAttemptOrigin`, and `origin` on each
`nat_fail_samples` entry; the origin is threaded internally from each
`NodeEvent::ConnectPeer` through `OutboundConnector::connect` and
`ConnectionStart`, never on the wire; a dial to a configured gateway is
always `gateway`, and `ring_peer_no_transport` is the event loop's dial to a
ring peer whose transport was lost, since cached-peer joins never dial
(#5954)), intro packets a non-gateway drops as unknown (`stray_intro_<label>`:
the exact address's traversal timed out (no_response, undecryptable or
incomplete; not other failures) in the last 10 s,
a traversal to another port of the IP is running (endpoint-dependent mapping
OR another peer behind the same IP, e.g. CGNAT; it cannot tell them apart), or
neither; the recent failures are a listener-owned table bounded by count and
TTL, and early evictions are counted in `stray_intro_failures_evicted`) and CONNECT
joiner dial-queue waits (`dial_queue_wait_<label>`, coarse buckets around the
3 s punch window). Each label set is declared once in a `labelled_counters!`
list, so a new varia
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
counters). Hot
    once, in the inbound_stream_outcomes! list; it then needs a snapshot field.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `93188d6b` are properly handled with clean fallback behavior.
