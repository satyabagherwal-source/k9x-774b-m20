# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet-freenet-core-learnings

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T02:51:32.126Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T02:51:32.126Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `freenet-freenet-core-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `0515d873`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T02:51:26.625Z  
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
> **Harvest Timestamp**: 2026-11-18T02:51:26.619Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3127 stars

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
- **Issue #6271** (2026-11-18): **fix: run initiate_buffer and instance setup under the guest backstop**
  *Symptoms*: ## Problem  The allocator export (`__frnt__initiate_buffer`) and instance setup (the module start function and `__frnt_set_id`) did not run under the wall-clock backstop and panic capture that the typed contract and delegate entry points (`call_2i64_blocking`, `call_3i64_blocking`, `call_3i64`) run under.  ## Approach  All guest entry points, including the allocator and instance setup, now run under the wall-clock backstop and panic capture of `execute_wasm_blocking`, off the calling thread.  - `initiate_buffer` goes through `call_typed_blocking` with `delegate_instance: None`. `call_typed_blocking` now takes the error classifier for the entry. The allocator keeps its existing classification (an epoch interrupt is `Timeout`, anything else `Runtime`, with no error-level log). The other entries keep `classify_runtime_error`. - `create_instance` runs `instantiate_and_init` as one job. Each of its two entries keeps its own freshly armed epoch budget, and the job's wall-clock bound (`WallBounds::for_entries`, `INSTANCE_SETUP_GUEST_ENTRIES = 2`) allows both budgets, so setup timing for in-budget contracts is unchanged. The store is recovered on every failure, as before. - `execute_wasm_blocking` is generic over the job's result, and has an explicit-bounds variant, `execute_wasm_blocking_within`. The linker moves into an `Arc` so the setup job can own a handle to it. - Source pins are updated. `initiate_buffer` is now listed with the entries that delegate to `call_typed_blocking`, a

- **Issue #6269** (2026-11-18): **fix(transport): keep transport-internal stream ids below the caller-named bit**
  *Symptoms*: ## Problem  Every node silently stops delivering its oversized (multi-fragment) messages after a few days of uptime. This is the root cause of #6143.  Each thread's stream-id counter starts at `(thread_index as u32) * 100_000` (`transport/boundary.rs`). `thread_index` grows by one for every thread that ever allocates, and nodes keep creating threads (tokio's blocking pool, `block_in_place` replacements): about 8 a minute on Ian's laptop, faster on the gateways. From index 21,475 the counter is at or above 2^31, so every id from `StreamId::next_transport_internal()` has the top bit set. Receivers read that bit as "caller-named operations stream" (`peer_connection.rs`, the `is_caller_named()` branch), park the stream as an orphan nobody claims, and drop it when it expires. Nothing is logged above debug.  What still works while a node is in that state: one-packet messages, caller-named streams (`StreamId::next()`, used for streamed full state), and everything it receives. What is lost: every message over one packet that a thread at or above index 21,475 sends through the legacy transport stream (on Ian's laptop on 2026-11-13, every allocating thread observed was in that range), for example `BroadcastTo` deltas (they carry the sender's summary, ~40 KB for the River room), `RequestUpdate` with full state, and `ResyncResponse`. It lasts until index 42,950 or a restart, then comes back after another 21,475 threads.  Evidence: - **Laptop.** The logged caller-named stream ids on 2026-

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

### Incident Patch 1: `0515d873` (2026-11-18)
**Commit Message**: fix: run initiate_buffer and instance setup under the guest backstop (#6271)

**File**: `.claude/rules/contracts.md` (modified, +21/-15)
```diff
@@ -147,18 +147,30 @@ migration is done.
 
 ### WASM Call Modes
 
-All three guest entry points share ONE body, `call_typed_blocking` in
-`engine/wasmtime_engine.rs`. Delegates ran "sync, on the calling thread" until
-#5480; they no longer do, and nothing should reintroduce a per-entry-point copy.
+All guest entry points, including the allocator export and instance setup
+(module start function and `__frnt_set_id`), run under the wall-clock backstop
+and panic capture: on a blocking-pool thread (a plain thread on a
+`current_thread` runtime), with a host-side panic returned as an `Err`. The
+typed calls share ONE body, `call_typed_blocking` in
+`engine/wasmtime_engine.rs`; instance setup runs as one job of its own, whose
+wall-clock bound allows each of its two entries its own budget. Nothing should
+reintroduce a per-entry-point copy or an inline guest call.
 
 ```
 call_3i64()               — delegates
 call_2i64_blocking()      — contracts
 call_3i64_blocking()      — contracts
-        ↓ all three
-call_typed_blocking()     — spawn_blocking + wall-clock backstop + panic capture
+initiate_buffer()         — allocator export, contracts and delegates
+        ↓ all four
+call_typed_blocking()     — execute_wasm_blocking
+
+create_instance()         — module start function + __frnt_set_id
+        ↓ one job
+execute_wasm_blocking_within() — wall-clock backstop + panic capture
 ```
 
+`call_void` is the one inline entry left, and only a test calls it.
+
 Two consequences for anything touching the delegate path:
 
 - **A delegate guest can outlive its call.** On the wall-clock-timeout path
@@ -168,16 +180,10 @@ Two consequences for anything touching the delegate path:
   different facts (`native_api::LIVE_DELEGATE_GUESTS`).
 - **During `process()`, delegate host functions run on a blocking-pool thread**,
   so they find their env through a thread-local installed on THAT thread by
-  `GuestDelegateInstance`, not on the caller's.
-
-  Scope that to `process()` and no further. Buffer setup and instantiation —
-  `initiate_buffer`, `call_void`, `instantiate_and_init` — still enter the guest
-  with `block_on_async(func.call_async(...))` INLINE on the calling thread, with
-  no `execute_wasm_blocking` and no `GuestDelegateInstance`. That is why
-  `exec_inbound_with_env` still sets `CURRENT_DELEGATE_INSTANCE` on the calling
-  thread at all, as `DelegateEnvGuard`'s rustdoc explains. "Nothing
-  delegate-related runs on the calling thread" is false and would produce a wrong
-  call about exactly those paths.
+  `GuestDelegateInstance`, not on the caller's. The allocator export gets no
+  `GuestDelegateInstance` (it is called with `delegate_instance: None`), so a
+  delegate's allocator cannot reach the delegate host functions. It has no use
+  for them.
 
 The pins `every_guest_entry_is_preceded_by_arm_epoch_deadline` and
 `blocking_paths_arm_epoch_inside_the_closure` enforce the single-body structure.
```

**File**: `crates/core/src/wasm_runtime/engine/wasmtime_engine.rs` (modified, +583/-81)
```diff
@@ -140,6 +140,14 @@
 //! ```
 //!
 //! We wrap with `block_on_async()` to maintain a synchronous interface for callers.
+//!
+//! That `block_on_async` call runs inside a job passed to
+//! `execute_wasm_blocking` / `execute_wasm_blocking_within`, not on the
+//! caller's thread: every production guest entry (the typed calls through
+//! `call_typed_blocking`, the allocator export, and instance setup in
+//! `create_instance`) runs off the calling thread under the wall-clock
+//! backstop, with a host-side panic returned as an error. `call_void`, used
+//! only by tests, is the exception.
 
 use std::collections::HashMap;
 use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
@@ -736,8 +744,9 @@ pub(crate) struct WasmtimeEngine {
     /// Taken during blocking operations, restored after. Recreated on timeout/panic
     /// or when `lifetime_instances` exceeds `STORE_REFRESH_THRESHOLD`.
     store: Option<Store<HostState>>,
-    /// Linker pre-configured with all host functions.
-    linker: Linker<HostState>,
+    /// Linker pre-configured with all host functions. Shared (`Arc`) so the
+    /// blocking job that instantiates a module can own a handle to it.
+    linker: Arc<Linker<HostState>>,
     /// Map of instance ID to wasmtime Instance.
     instances: HashMap<i64, Instance>,
     /// Maximum execution time in seconds.
@@ -890,7 +899,7 @@ impl WasmEngine for WasmtimeEngine {
         Ok(Self {
             engine,
             store: Some(store),
-            linker,
+            linker: Arc::new(linker),
             instances: HashMap::new(),
             max_execution_seconds: config.max_execution_seconds,
             enabled_metering,
@@ -979,32 +988,60 @@ impl WasmEngine for WasmtimeEngine {
         }
 
         // The guest-entry half (instantiate + __frnt_set_id + ensure_memory) is
-        // factored out so we can RECOVER THE STORE on ANY guest-entry
-        // timeout/error before returning (#4864 round-9 item 2). Previously an
-        // epoch interrupt during __frnt_set_id returned via `?` AFTER the module
-        // was instantiated but BEFORE `instances.insert` / `lifetime_instances += 1`,
-        // so the store-refresh accounting never counted it: wasmtime's Store arena
-        // retained the dropped instance's allocation, and repeated init timeouts
-        // across fresh contract ids accumulated untracked arena memory that never
-        // triggered a count-based refresh.
+        // factored out so the store is REPLACED on ANY guest-entry failure
+        // before returning (#4864 round-9 item 2). A failure after the module
+        // was instantiated leaves its allocation in the store's arena without an
+        // `instances` entry or a `lifetime_instances` count, so nothing else
+        // would ever trigger a refresh that reclaims it.
         let epoch_ticks = self.epoch_deadline_ticks;
-        let store = self
+        let mut store = self
             .store
-            .as_mut()
+            .take()
             .ok_or_else(|| WasmError::Other(anyhow::anyhow!("engine store not available")))?;
-        let instance = match Self::instantiate_and_init(
-            store,
-            &self.linker,
-            module,
-            id,
-            req_bytes,
-            epoch_ticks,
-        ) {
+        let linker = Arc::clone(&self.linker);
+        let module = module.clone();
+
+        // A module's start function and `__frnt_set_id` are guest code, so they
+        // run off the calling thread under the wall-clock backstop, with a
+        // host-side panic captured as an error, like every other guest entry
+        // (see `call_typed_blocking`). They run as ONE job, and each gets its
+        // own freshly armed epoch budget, so the wall-clock bound allows
+        // `INSTANCE_SETUP_GUEST_ENTRIES` budgets (see `WallBounds::for_entries`).
+        let result = execute_wasm_blocking_within(
+            move || {
+                let instance = Self::instantiate_and_init(
+                    &mut store,
+                    &linker,
+                    &module,
+                    id,
+                    req_bytes,
+                    epoch_ticks,
+                );
+                (Ok(instance), store)
+            },
+            WallBounds::for_entries(self.max_execution_seconds, INSTANCE_SETUP_GUEST_ENTRIES),
+            self.max_execution_seconds,
+        );
+        let outcome = match result {
+            BlockingResult::Ok(Ok(instance), store) => {
+                self.store = Some(store);
+                Ok(instance)
+            }
+            BlockingResult::Ok(Err(e), _failed_store) => Err(e),
+            // The job classifies its own errors, so it never returns this.
+            BlockingResult::WasmError(e, _failed_store) => {
+                Err(WasmError::Instantiation(e.to_string()))
+            }
+            BlockingResult::Timeout => Err(WasmError::Timeout),
+            BlockingResult::QueuedTimeout => Err(Wasm
```

---

### Incident Patch 2: `b0f844ea` (2026-11-18)
**Commit Message**: fix(transport): keep transport-internal stream ids below the caller-named bit (#6269)

**File**: `crates/core/src/config.rs` (modified, +14/-0)
```diff
@@ -5529,6 +5529,15 @@ impl GlobalRng {
         THREAD_INDEX.with(|idx| idx.set(Some(0)));
     }
 
+    /// Give the current thread index `idx`, as if it were the `idx`-th
+    /// thread to ask. Only for a fresh thread that has not asked yet: a
+    /// thread-local derived from the index (the stream-id counter, the nonce
+    /// counter) is initialized on first use and does not see a later change.
+    #[cfg(test)]
+    pub(crate) fn pin_thread_index_for_test(idx: u64) {
+        THREAD_INDEX.with(|c| c.set(Some(idx)));
+    }
+
     /// Clears the simulation seed, reverting to system RNG.
     pub fn clear_seed() {
         THREAD_SEED.with(|s| s.set(None));
@@ -5542,6 +5551,11 @@ impl GlobalRng {
     ///
     /// Each thread gets a unique index from the global `THREAD_INDEX_COUNTER`.
     /// This is used by thread-local ID counters to compute non-overlapping offset blocks.
+    ///
+    /// Indices are never reused, so a long-running node's index keeps growing
+    /// with every thread it creates (tens of thousands within days). Any
+    /// `idx * block` arithmetic must be wide enough or wrap safely, and must
+    /// not reach bits that carry meaning (#6143).
     pub fn thread_index() -> u64 {
         THREAD_INDEX.with(|c| match c.get() {
             Some(idx) => idx,
```

**File**: `crates/core/src/transport/boundary.rs` (modified, +113/-13)
```diff
@@ -88,11 +88,20 @@ use super::{TransportError, TransportPublicKey};
 /// ([`StreamId::next_transport_internal`]). The UDP transport relies on that
 /// split to route a stream (see [`StreamId::is_caller_named`]).
 ///
-/// The split is a convention, not a guarantee: both allocators share one
-/// per-thread counter, so once it passes 2^31 an internal id also has the top
-/// bit, and each thread's 100,000-id block overlaps the next thread's after
-/// 100,000 allocations. Receivers key streams by (peer, id), so a collision
-/// needs both within one connection's live streams.
+/// Both allocators share one per-thread counter that lives in the low 31 bits
+/// ([`COUNTER_MASK`]); the top bit is set or cleared by the allocator, never
+/// by the counter. It used to be a plain `u32` starting at `thread_index *
+/// 100_000`, and `thread_index` grows by one for every thread that ever
+/// allocates, so a node creating a few threads a minute (tokio's blocking pool
+/// and `block_in_place` replacements) passed index 21,475 after a few days of
+/// uptime. From then on every transport-internal id carried the top bit, the
+/// receiver routed it as a caller-named operations stream that nothing claims,
+/// and every oversized message the node sent was silently dropped (#6143).
+///
+/// Each thread's 100,000-id block still overlaps the next thread's after
+/// 100,000 allocations, and blocks wrap modulo 2^31. Receivers key streams by
+/// (peer, id), so a collision needs both within one connection's live or
+/// recently completed streams.
 #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
 #[repr(transparent)]
 #[serde(transparent)]
@@ -106,17 +115,29 @@ const STREAM_ID_BLOCK: u32 = 100_000;
 /// Top bit of ids from [`StreamId::next`].
 const CALLER_NAMED_BIT: u32 = 0x8000_0000;
 
+/// The bits the shared counter may occupy. Keeping the counter below the top
+/// bit is what makes [`StreamId::is_caller_named`] reliable: the bit is only
+/// ever set by [`StreamId::next`].
+const COUNTER_MASK: u32 = !CALLER_NAMED_BIT;
+
+/// Where thread `idx`'s counter starts: its block, wrapped into the 31-bit
+/// counter space. Identical to the old `idx * 100_000` for every index below
+/// 21,475, so ids from young nodes and simulations are unchanged.
+fn block_start(idx: u64) -> u32 {
+    (idx.wrapping_mul(u64::from(STREAM_ID_BLOCK)) & u64::from(COUNTER_MASK)) as u32
+}
+
 thread_local! {
     static STREAM_ID_COUNTER: std::cell::Cell<u32> = {
         let idx = crate::config::GlobalRng::thread_index();
-        std::cell::Cell::new((idx as u32) * STREAM_ID_BLOCK)
+        std::cell::Cell::new(block_start(idx))
     };
 }
 
 fn next_stream_counter() -> u32 {
     STREAM_ID_COUNTER.with(|c| {
         let v = c.get();
-        c.set(v + 1);
+        c.set(v.wrapping_add(1) & COUNTER_MASK);
         v
     })
 }
@@ -129,11 +150,12 @@ impl StreamId {
     }
 
     /// A fresh id for a stream a transport opens for its own purposes (the
-    /// UDP transport's oversized messages). Distinct from ids from
-    /// [`Self::next`] until the shared counter passes 2^31 (see the type
-    /// docs).
+    /// UDP transport's oversized messages). It never has the top bit, so it
+    /// is always distinct from ids from [`Self::next`]. The counter is
+    /// already kept below the bit; the mask here keeps that true at the one
+    /// place receivers depend on it, whatever the counter does.
     pub(crate) fn next_transport_internal() -> Self {
-        Self(next_stream_counter())
+        Self(next_stream_counter() & COUNTER_MASK)
     }
 
     /// Whether this id came from [`Self::next`]: a stream named by the
@@ -146,7 +168,14 @@ impl StreamId {
     /// Thread-local, so safe for parallel test execution.
     pub fn reset_counter() {
         let idx = crate::config::GlobalRng::thread_index();
-        STREAM_ID_COUNTER.with(|c| c.set((idx as u32) * STREAM_ID_BLOCK));
+        STREAM_ID_COUNTER.with(|c| c.set(block_start(idx)));
+    }
+
+    /// Put this thread's counter where thread `idx` would start, so a test can
+    /// allocate as the thread of a node that has been up for days.
+    #[cfg(test)]
+    pub(crate) fn reset_counter_as_thread(idx: u64) {
+        STREAM_ID_COUNTER.with(|c| c.set(block_start(idx)));
     }
 }
 
@@ -827,7 +856,7 @@ mod stream_id_tests {
     #[test]
     fn stream_id_values_are_unchanged() {
         StreamId::reset_counter();
-        let base = (crate::config::GlobalRng::thread_index() as u32) * 100_000;
+        let base = super::block_start(crate::config::GlobalRng::thread_index());
         let internal = StreamId::next_transport_internal();
         let named = StreamId::next();
         let internal_again = StreamId::next_transport_internal();
@@ -839,6 +868,77 @@ mod stream_id_tests {
         assert!(!internal_again.is_caller_named());
     }
 
+    /// #6143: a node's thread indices keep growing for its whole uptime, and
+    /// from index 21,475 on,
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests.rs` (modified, +88/-0)
```diff
@@ -2712,6 +2712,94 @@ async fn a_legacy_stream_completed_by_its_task_is_remembered() {
     assert!(holds_no_state(&e, id), "not started again");
 }
 
+/// Allocates stream ids on this thread as thread `idx` would, and puts the
+/// counter back when dropped, also when the test panics.
+struct ResetStreamCounter;
+
+impl ResetStreamCounter {
+    fn as_thread(idx: u64) -> Self {
+        StreamId::reset_counter_as_thread(idx);
+        Self
+    }
+}
+
+impl Drop for ResetStreamCounter {
+    fn drop(&mut self) {
+        StreamId::reset_counter();
+    }
+}
+
+/// #6143, the sender's side: an oversized message sent on UDP from a thread
+/// whose index is past 21,475 goes out as fragments of a transport-internal
+/// stream, without the caller-named bit. Before the fix every such fragment
+/// carried the bit, so the receiver parked the message as an operations
+/// stream nobody claims.
+#[tokio::test(start_paused = true)]
+async fn an_oversized_send_from_a_long_running_thread_is_not_caller_named() {
+    let mut e = single(CAPABLE);
+    let sent = {
+        let _reset = ResetStreamCounter::as_thread(24_160);
+        e.conn.send_serialized(vec![7u8; 4000]).await
+    };
+    sent.unwrap();
+    let mut ids = Vec::new();
+    for _ in 0..50 {
+        tokio::time::advance(Duration::from_millis(10)).await;
+        tokio::task::yield_now().await;
+        for message in e.drain_sent() {
+            if let SymmetricMessagePayload::StreamFragment { stream_id, .. } = message.payload {
+                ids.push(stream_id);
+            }
+        }
+        if !ids.is_empty() {
+            break;
+        }
+    }
+    assert!(!ids.is_empty(), "the message went out as a stream");
+    assert!(ids.iter().all(|id| !id.is_caller_named()), "{ids:?}");
+    // The id came from the counter set above, not one allocated elsewhere:
+    // thread 24,160's block starts at 24,160 x 100,000 mod 2^31.
+    let start = 268_516_352u32;
+    assert!(
+        ids.iter().all(|id| (start..start + 16).contains(&id.0)),
+        "{ids:?}"
+    );
+}
+
+/// #6143: an oversized message sent from a thread whose index is past
+/// 21,475, which every node reaches after a few days of uptime, is still
+/// reassembled and delivered. Before the fix its transport-internal id carried
+/// the caller-named bit, so the receiver parked it as an operations stream
+/// nobody claims and the message was lost without a trace.
+#[tokio::test(start_paused = true)]
+async fn a_legacy_stream_from_a_long_running_sender_thread_is_delivered() {
+    let mut e = single(CAPABLE);
+    let id = {
+        let _reset = ResetStreamCounter::as_thread(24_160);
+        StreamId::next_transport_internal()
+    };
+    let f = super::MAX_DATA_SIZE;
+    let data: Vec<u8> = (0..(2 * f)).map(|i| i as u8).collect();
+    let total = data.len() as u64;
+    for (i, chunk) in data.chunks(f).enumerate() {
+        feed(
+            &mut e,
+            fragment_with(
+                id,
+                total,
+                i as u32 + 1,
+                bytes::Bytes::copy_from_slice(chunk),
+            ),
+        )
+        .await;
+    }
+    assert_eq!(
+        e.pump(Duration::from_millis(10)).await.as_deref(),
+        Some(&data[..]),
+        "stream {id:?} was not delivered as a message"
+    );
+}
+
 /// An evicted legacy stream delivers nothing even when the fragments that
 /// would complete it are already queued for its reassembly task.
 #[tokio::test(start_paused = true)]
```

---

### Incident Patch 3: `88ffb1cd` (2026-11-18)
**Commit Message**: fix(broadcast): bound memory when broadcasting large contract states (#6266)

**File**: `crates/core/src/node/network_bridge/broadcast_payload_mix.rs` (modified, +22/-1)
```diff
@@ -41,6 +41,10 @@
 //!    have three different fixes, published as
 //!    `tracked_missing_<reason>_{sends,bytes}` plus a
 //!    `tracked_missing_unattributed_*` residual that must stay at zero.
+//! 7. [`PayloadArm::FullLargeDeltaStreamed`] — a delta WAS computed, but the
+//!    state is large and the delta too large to send inline, so the state went
+//!    out as a stream to keep the fan-out's resident memory under the lane
+//!    bound. Can be several times the bytes of the delta it replaced.
 //!
 //! Arms 4-6 were a single `full_no_summary` bucket when #4922 first shipped.
 //! The 2026-07-25 measurement then found that bucket was the LARGEST single
@@ -377,20 +381,28 @@ pub(crate) enum PayloadArm {
     /// cleared by a delta-apply failure / `ResyncRequest`. The next delivered
     /// broadcast caches a summary and the pair collapses to deltas.
     FullNoTheirSummaryTracked,
+    /// Full state: the contract's state is large and the computed delta was
+    /// too large to send inline, so the state went out as a stream instead,
+    /// where the lane permit bounds how many are resident. Kept apart from
+    /// [`Self::FullNotEfficient`]: that arm is the delta not being smaller than
+    /// the state, this one is a memory bound chosen over a smaller payload.
+    /// See `broadcast_queue::delta_sent_as_full_state`.
+    FullLargeDeltaStreamed,
 }
 
 impl PayloadArm {
     /// Every arm, in reporting order. Exhaustive by construction: the
     /// `match` in [`PayloadArm::index`] fails to compile if a variant is
     /// added without being listed here.
-    pub(crate) const ALL: [PayloadArm; 7] = [
+    pub(crate) const ALL: [PayloadArm; 8] = [
         PayloadArm::Delta,
         PayloadArm::FullDeltaSuppressed,
         PayloadArm::FullNotEfficient,
         PayloadArm::FullComputeFailed,
         PayloadArm::FullNoOurSummary,
         PayloadArm::FullNoTheirSummaryUntracked,
         PayloadArm::FullNoTheirSummaryTracked,
+        PayloadArm::FullLargeDeltaStreamed,
     ];
 
     /// The three arms that together make up the legacy `full_no_summary`
@@ -413,6 +425,7 @@ impl PayloadArm {
             PayloadArm::FullNoOurSummary => 4,
             PayloadArm::FullNoTheirSummaryUntracked => 5,
             PayloadArm::FullNoTheirSummaryTracked => 6,
+            PayloadArm::FullLargeDeltaStreamed => 7,
         }
     }
 
@@ -427,6 +440,7 @@ impl PayloadArm {
             PayloadArm::FullNoOurSummary => "full_no_our_summary",
             PayloadArm::FullNoTheirSummaryUntracked => "full_no_their_summary_untracked",
             PayloadArm::FullNoTheirSummaryTracked => "full_no_their_summary_tracked",
+            PayloadArm::FullLargeDeltaStreamed => "full_large_delta_streamed",
         }
     }
 
@@ -1136,6 +1150,13 @@ impl PayloadMix {
         }
     }
 
+    /// Test-only view of one arm's delivered `(sends, bytes)`, without draining.
+    #[cfg(test)]
+    pub(crate) fn arm_for_test(&self, arm: PayloadArm) -> (u64, u64) {
+        let w = self.window.lock();
+        (w.sends[arm.index()], w.bytes[arm.index()])
+    }
+
     /// Test-only view of the [`PropagationEvent`] counts, without draining.
     #[cfg(test)]
     pub(crate) fn propagation_event_for_test(&self, ev: PropagationEvent) -> u64 {
```

**File**: `crates/core/src/node/network_bridge/broadcast_queue.rs` (modified, +443/-66)
```diff
@@ -175,6 +175,28 @@ pub(super) async fn await_stream_completion_releasing_permit<T>(
 /// old state-size classification had it too) and is not what #4961 was about.
 const BROADCAST_QUEUE_PAYLOAD_SIZE_THRESHOLD: usize = 64 * 1024;
 
+/// State size, in bytes, at or above which a broadcast is queued in the large
+/// lane even when a delta is expected.
+///
+/// The delta prediction only says that a summary is cached for the target, not
+/// how big the delta will be, and a contract's delta against a peer that holds
+/// little of its state is about the size of the state. For a small state a
+/// wrong prediction costs one large payload, corrected by
+/// [`SendLanePermit::ensure_capacity_for`]. For a multi-megabyte state it does
+/// not: every leg of the fan-out runs the summarize and delta work and builds
+/// its payload under one of the 12 small-lane permits before the correction
+/// applies, so a whole fan-out builds state-sized payloads at once. Queueing
+/// these legs in the large lane from the start means a leg does no work at all
+/// until it holds one of the large lane's permits.
+///
+/// The cost is that the small deltas of a state this large share the large
+/// lane's two permits. That is the pre-#4961 behaviour, kept only for states
+/// this size.
+// Only read by the production queue, which is cfg'd out under
+// `simulation_tests`.
+#[cfg_attr(feature = "simulation_tests", allow(dead_code))]
+const LARGE_STATE_LANE_THRESHOLD: usize = 4 * 1024 * 1024;
+
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
 // The simulation feature replaces the production queue, but keeps the shared
 // payload-selection path and its public signature compiled.
@@ -848,7 +870,7 @@ mod queue {
 
     /// Maximum concurrent outbound broadcast streams for large payloads (>= 64KB).
     /// Large payloads (full state) are rate-limited to avoid uplink saturation.
-    const DEFAULT_LARGE_PAYLOAD_CONCURRENCY: usize = 2;
+    pub(super) const DEFAULT_LARGE_PAYLOAD_CONCURRENCY: usize = 2;
 
     /// Maximum entries in the queue before oldest are dropped.
     const DEFAULT_MAX_QUEUE_DEPTH: usize = 256;
@@ -872,11 +894,16 @@ mod queue {
     /// send full state anyway — so it decides SCHEDULING only. The uplink bound
     /// is enforced against the real payload by
     /// [`SendLanePermit::ensure_capacity_for`].
+    ///
+    /// A state at or above [`super::LARGE_STATE_LANE_THRESHOLD`] is queued
+    /// large whatever the prediction; see that constant.
     pub(super) fn classify_payload_lane(
         state_size: usize,
         delta_expected: bool,
     ) -> QueuedPayloadClass {
-        if state_size < super::BROADCAST_QUEUE_PAYLOAD_SIZE_THRESHOLD || delta_expected {
+        if state_size < super::BROADCAST_QUEUE_PAYLOAD_SIZE_THRESHOLD
+            || (delta_expected && state_size < super::LARGE_STATE_LANE_THRESHOLD)
+        {
             QueuedPayloadClass::Small
         } else {
             QueuedPayloadClass::Large
@@ -3412,6 +3439,18 @@ mod queue {
                 QueuedPayloadClass::Small,
                 "a state below the threshold is small whatever the payload shape"
             );
+            const HUGE: usize = super::super::LARGE_STATE_LANE_THRESHOLD;
+            assert_eq!(
+                classify_payload_lane(HUGE - 1, true),
+                QueuedPayloadClass::Small,
+                "an expected delta stays small up to the large-state threshold"
+            );
+            assert_eq!(
+                classify_payload_lane(HUGE, true),
+                QueuedPayloadClass::Large,
+                "a state at the large-state threshold is queued large even when \
+                 a delta is expected: its delta may be as large as the state"
+            );
 
             let queue = BroadcastQueue::new();
             let mut lanes = spawn_lanes(&queue, 12, 2);
@@ -4147,6 +4186,11 @@ mod queue {
                 "THE #4961 CASE: a >64 KiB contract sending a delta to a peer whose \
                  summary we hold must not spend one of the 2 large-lane permits"
             );
+            assert_eq!(
+                lane(super::super::LARGE_STATE_LANE_THRESHOLD),
+                QueuedPayloadClass::Large,
+                "a multi-megabyte state is queued large even with a cached summary"
+            );
 
             let addr = |port: u16| -> std::net::SocketAddr {
                 format!("127.0.0.1:{port}").parse().unwrap()
@@ -4168,6 +4212,11 @@ mod queue {
 #[cfg(not(feature = "simulation_tests"))]
 pub(crate) use queue::BroadcastQueue;
 
+/// The large lane's permit count, for the fan-out memory test in
+/// `p2p_protoc`, which derives its bound from it.
+#[cfg(all(test, not(feature = "simulation_tests")))]
+pub(super) const LARGE_LANE_PERMITS: usize = queue::DEFAULT_LARGE_PAYLOAD_CONCURRENCY;
+
 /// Classify the result of awaiting the streaming completion oneshot into
 /// "the message was actually delivered" vs "the permit can be released but the
 /// message was dropped".
@
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +2/-0)
```diff
@@ -56,6 +56,8 @@ mod connection_lifecycle;
 mod connection_map;
 mod dispatch;
 mod identity;
+#[cfg(all(test, not(feature = "simulation_tests")))]
+mod large_state_fanout_tests;
 mod migration;
 mod zombie_sweep;
 
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc/large_state_fanout_tests.rs` (added, +465/-0)
```diff
@@ -0,0 +1,465 @@
+//! Memory held by the fan-out of a large new state to many co-hosts, through
+//! the node's real fan-out: `handle_broadcast_state_change` (what the
+//! executor's `BroadcastStateChange` reaches after a PUT or UPDATE commits),
+//! its co-host target selection, the broadcast queue workers and
+//! `broadcast_to_single_peer`.
+//!
+//! Each case runs on one current-thread runtime, so every allocation of the
+//! fan-out lands on the measuring thread (`util::alloc_count`), counted at the
+//! jemalloc size class it would be served from. The state is allocated before
+//! the measurement and shared, as a node's stored state is, so a peak excludes
+//! that one copy. Memory the contract executor uses for real summarize and
+//! delta calls (WASM linear memory, on its own threads) is not modelled: the
+//! stand-in contract below runs on the measuring thread and allocates only the
+//! delta it returns.
+//!
+//! Every co-host has a cached summary that differs from ours, so the queue
+//! predicts a small delta for each, and the stand-in contract returns a delta
+//! of the size each case sets: for a contract new to the receivers that is
+//! about the size of the state.
+//!
+//! The stand-in transport keeps every payload it is handed:
+//! - a stream for `TRANSFER` of virtual time, longer than
+//!   `STREAM_PERMIT_HOLD`, as a slow uplink would, then drops its bytes and
+//!   reports delivery. A stream gives its lane permit back at the hold, so its
+//!   buffer stays resident outside the lane for the rest of the transfer;
+//! - an inline message until every target's leg has reached the transport, so
+//!   a case that sends inline measures all of them resident at once rather
+//!   than however many happened to overlap.
+
+use std::net::SocketAddr;
+use std::sync::Arc;
+use std::time::Duration;
+
+use freenet_stdlib::prelude::{
+    CodeHash, ContractInstanceId, ContractKey, StateDelta, StateSummary, WrappedState,
+};
+
+use super::{P2pBridgeEvent, P2pConnManager};
+use crate::contract::{ContractHandlerEvent, StoreResponse};
+use crate::message::{NetMessage, NetMessageV1};
+use crate::operations::update::{BroadcastStreamingPayload, UpdateMsg};
+use crate::ring::PeerKey;
+use crate::ring::interest::SummaryPopulationSource;
+use crate::transport::{StreamSendOutcome, TransportPublicKey};
+use crate::util::alloc_count::{allocated_by, jemalloc_class, peak_delta};
+
+const STATE_LEN: usize = 30 * 1024 * 1024;
+const TARGETS: u8 = 20;
+/// Longer than `STREAM_PERMIT_HOLD` (120 s), so each stream's buffer outlives
+/// the permit that admitted it and another leg builds its buffer meanwhile.
+const TRANSFER: Duration = Duration::from_secs(150);
+/// The default `streaming-threshold`; [`fan_out`] asserts the node uses it.
+const STREAMING_THRESHOLD: usize = 64 * 1024;
+const OUR_SUMMARY: &[u8] = &[0xA0];
+const THEIR_SUMMARY: &[u8] = &[0xB0];
+
+/// What one fan-out case observed.
+struct Fanout {
+    /// Peak live bytes above the shared state, in jemalloc size classes.
+    peak: isize,
+    /// Every byte allocated on the measuring thread during the fan-out,
+    /// freed or not. A floor on it shows the counter saw the fan-out at all.
+    allocated: usize,
+    streams: usize,
+    inline: usize,
+    /// Streams whose bytes were not exactly the bincode of
+    /// `BroadcastStreamingPayload { stored state, OUR_SUMMARY }`.
+    malformed_streams: usize,
+}
+
+/// Fan a `STATE_LEN` state out to `TARGETS` co-hosts whose deltas the
+/// stand-in contract computes as `delta_bytes` long.
+fn fan_out(id: &str, delta_bytes: usize) -> Fanout {
+    let rt = tokio::runtime::Builder::new_current_thread()
+        .enable_all()
+        .build()
+        .expect("runtime");
+    let state = WrappedState::new(vec![0x5A; STATE_LEN]);
+    let (mut mgr, op_manager, key, handler) = rt.block_on(node(id, state.clone(), delta_bytes));
+    assert_eq!(
+        op_manager.streaming_threshold, STREAMING_THRESHOLD,
+        "the threshold cases below are written against the default"
+    );
+    // What a correct stream carries, built before the measurement so it adds
+    // nothing to the peak.
+    let expected_stream = bincode::serialize(&BroadcastStreamingPayload {
+        state_bytes: state.as_ref().to_vec(),
+        sender_summary_bytes: OUR_SUMMARY.to_vec(),
+    })
+    .expect("serialize");
+
+    let ((observed, allocated), _, peak) = peak_delta(|| {
+        allocated_by(|| {
+            rt.block_on(async {
+                // Virtual time from here: the node is built, and nothing below
+                // waits on I/O, so a 150 s transfer costs no wall time. The
+                // clock is driven explicitly (see `drive_clock`), because the
+                // node keeps a task runnable and tokio only auto-advances a
+                // paused clock when every task is idle.
+                tokio::time::pause();
+                let fan_out = async {
+                    let workers = mgr
+      
```

**File**: `crates/core/src/operations/update.rs` (modified, +44/-1)
```diff
@@ -15,7 +15,9 @@ pub(crate) mod propagation_stats;
 
 use freenet_stdlib::prelude::*;
 
-pub(crate) use self::messages::{BroadcastStreamingPayload, UpdateMsg, UpdateStreamingPayload};
+pub(crate) use self::messages::{
+    BroadcastStreamingPayload, BroadcastStreamingPayloadRef, UpdateMsg, UpdateStreamingPayload,
+};
 use super::OpError;
 use crate::contract::{ContractHandlerEvent, ExecutorError, StoreResponse};
 use crate::message::{NodeEvent, Transaction};
@@ -1648,6 +1650,18 @@ mod messages {
         pub sender_summary_bytes: Vec<u8>,
     }
 
+    /// The sender's borrowed form of [`BroadcastStreamingPayload`].
+    ///
+    /// Serializes to the same bytes (serde writes a `&[u8]` and a `Vec<u8>` the
+    /// same way), so a sender can serialize from a state it shares with other
+    /// broadcast legs without first copying it into a `Vec`. Pinned by
+    /// `broadcast_streaming_payload_ref_serializes_like_the_owned_payload`.
+    #[derive(Serialize)]
+    pub(crate) struct BroadcastStreamingPayloadRef<'a> {
+        pub state_bytes: &'a [u8],
+        pub sender_summary_bytes: &'a [u8],
+    }
+
     #[derive(Debug, Serialize, Deserialize, Clone)]
     /// Update operation messages.
     ///
@@ -1824,6 +1838,35 @@ mod tests {
     use super::*;
     use crate::operations::test_utils::make_contract_key;
 
+    /// The borrowed payload a broadcast sender serializes must decode as the
+    /// owned payload a receiver deserializes, byte for byte, including the
+    /// empty summary a sender without one sends.
+    #[test]
+    fn broadcast_streaming_payload_ref_serializes_like_the_owned_payload() {
+        for (state, summary) in [
+            (vec![1u8, 2, 3, 250], vec![9u8, 8]),
+            (vec![0u8; 70_000], Vec::new()),
+            (Vec::new(), Vec::new()),
+        ] {
+            let borrowed = bincode::serialize(&BroadcastStreamingPayloadRef {
+                state_bytes: &state,
+                sender_summary_bytes: &summary,
+            })
+            .unwrap();
+            let owned = bincode::serialize(&BroadcastStreamingPayload {
+                state_bytes: state.clone(),
+                sender_summary_bytes: summary.clone(),
+            })
+            .unwrap();
+            assert_eq!(borrowed, owned);
+            let decoded: BroadcastStreamingPayload = bincode::deserialize(&borrowed).unwrap();
+            assert_eq!(
+                (decoded.state_bytes, decoded.sender_summary_bytes),
+                (state, summary)
+            );
+        }
+    }
+
     /// Wire-compatibility guard for #5147, in two independent halves.
     ///
     /// Appending `BroadcastToV2` / `BroadcastToStreamingV2` must not renumber
```

**File**: `crates/core/src/ring.rs` (modified, +7/-0)
```diff
@@ -5021,6 +5021,13 @@ impl Ring {
         self.hosting_manager.disk_usage_stats()
     }
 
+    /// The size of `contract`'s stored state at its last committed write, if
+    /// the disk tracker has recorded it. See
+    /// `HostingManager::committed_state_size`.
+    pub(crate) fn committed_state_size(&self, contract: &ContractKey) -> Option<u64> {
+        self.hosting_manager.committed_state_size(contract)
+    }
+
     pub(crate) fn commit_state_write(&self, contract: &ContractKey, state_size: usize) {
         let new_gen = self.hosting_manager.bump_state_generation(contract);
         self.hosting_manager
```

**File**: `crates/core/src/ring/hosting.rs` (modified, +10/-0)
```diff
@@ -1192,6 +1192,16 @@ impl HostingManager {
         }
     }
 
+    /// The size of `key`'s state at its last committed write, from the disk
+    /// tracker. `None` before the tracker is installed or when no write or
+    /// seed has recorded it.
+    pub(crate) fn committed_state_size(&self, key: &ContractKey) -> Option<u64> {
+        self.disk_tracker
+            .read()
+            .as_ref()
+            .and_then(|tracker| tracker.committed_state_size(key))
+    }
+
     /// Apply a state-write delta to the disk tracker at a state-write chokepoint.
     /// Wired from `Ring::commit_state_write` (the single infallible post-write
     /// funnel for all four executor chokepoints), so
```

**File**: `crates/core/src/ring/hosting/disk_usage.rs` (modified, +6/-0)
```diff
@@ -444,6 +444,12 @@ impl DiskUsageTracker {
         self.refresh_webapp_cache();
     }
 
+    /// The size last recorded for `key` by [`Self::record_state_write`] (or
+    /// the seed), or `None` if none is recorded.
+    pub(crate) fn committed_state_size(&self, key: &ContractKey) -> Option<u64> {
+        self.state_sizes.lock().get(key)
+    }
+
     /// Apply a state-write at a chokepoint: set `key`'s tracked size to
     /// `new_size` and adjust `state_bytes` by the signed delta against the
     /// previous size for that key (0 if unseen).
```

#### Recent Merged Pull Requests:
- **PR #6271** (2026-11-18): fix: run initiate_buffer and instance setup under the guest backstop (@sanity)
- **PR #6269** (2026-11-18): fix(transport): keep transport-internal stream ids below the caller-named bit (@sanity)
- **PR #6267** (2026-11-18): test(server): pin Host refusal on the permission event stream (@sanity)
- **PR #6266** (2026-11-18): fix(broadcast): bound memory when broadcasting large contract states (@sanity)
- **PR #6265** (2026-11-17): feat(telemetry): a native_setup_outcome event per native setup at each end (gate 22) (@sanity)
- **PR #6262** (2026-11-17): fix(quic): breaker review carry-overs from #6259 (@sanity)

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

## X. run initiate_buffer and instance setup under the guest backstop

**RULE**:
When implementing operations in `.claude/rules/contracts.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0515d873`: run initiate_buffer and instance setup under the guest backstop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/contracts.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
All guest entry points, including the allocator export and instance setup
(module start function and `__frnt_set_id`), run under the wall-clock backstop
and panic capture: on a blocking-pool thread (a plain thread on a
`current_thread` runtime), with a host-side panic returned as an `Err`. The
typed calls share ONE body, `call_typed_blocking` in
`engine/wasmtime_engine.rs`; instance setup runs as one job of its own, whose
wall-clock bound allows each of its two entries its own budget. Nothing should
reintroduce a per-entry-point copy or an inline guest call.
initiate_buffer()         — allocator export, contracts and delegates
        ↓ all four
call_typed_blocking()     — execute_wasm_blocking

create_instance()         — module start function + __frnt_set_id
        ↓ one job
execute_wasm_blocking_within() — wall-clock backstop + panic capture
`call_void` is the one inline entry left, and only a test calls it.

  `GuestDelegateInstance`, not on the caller's. The allocator export gets no
  `GuestDelegateInstance` (it is called with `delegate_instance: None`), so a
  delegate's allocator cannot reach the delegate host functions. It has no use
  for them.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
All three guest entry points share ONE body, `call_typed_blocking` in
`engine/wasmtime_engine.rs`. Delegates ran "sync, on the calling thread" until
#5480; they no longer do, and nothing should reintroduce a per-entry-point copy.
        ↓ all three
call_typed_blocking()     — spawn_blocking + wall-clock backstop + panic capture
  `GuestDelegateInstance`, not on the caller's.

  Scope that to `process()` and no further. Buffer setup and instantiation —
  `initiate_buffer`, `call_void`, `instantiate_and_init` — still enter the guest
  with `block_on_async(func.call_async(...))` INLINE on the calling thread, with
  no `execute_wasm_blocking` and no `GuestDelegateInstance`. That is why
  `exec_inbound_with_env` still sets `CURRENT_DELEGATE_INSTANCE` on the calling
  thread at all, as `DelegateEnvGuard`'s rustdoc explains. "Nothing
  delegate-related runs on the calling thread" is false and would produce a wrong
  call about exactly those paths.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0515d873` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
