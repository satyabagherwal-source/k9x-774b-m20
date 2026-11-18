# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: freenet-freenet-core-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T16:01:21.074Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T16:01:21.074Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 67%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from freenet-freenet-core-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `9811972d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T15:59:53.217Z  
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
> **Harvest Timestamp**: 2026-11-18T15:59:53.211Z  
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
- **Issue #6280** (2026-11-18): **fix(hosting): bound per-neighbor hosting adverts and close disconnect race**
  *Symptoms*: ## Problem  `NeighborHostingManager` stores, per ring neighbour, the set of contract ids that neighbour advertises (`neighbor_contracts`). Three weaknesses in how it is filled and consumed:  1. **Unbounded per-neighbour set.** `HostingAnnounce{added}` and an unsolicited `HostingStateResponse{contracts}` were stored verbatim, with no cap, until the connection dropped. Each message also cloned the neighbour's whole current set (`previously_known`) to compute the diff, so a one-id message cost O(stored set) time and a transient copy of the set. 2. **Per-copy sync work.** Duplicate ids in `added` each passed the overlap filter, so the dispatch loop in `node.rs` did one full-state `get_contract_state_by_id` and one `SyncStateToPeer` per copy. The `Summaries` path already caps the same work at `MAX_STALE_SYNCS_PER_SUMMARIES` (32). 3. **Check-then-write race.** The dispatch arm resolves the sender's key, then writes. A large snapshot applied after `on_peer_disconnected` re-created the departed sender's entry, which nothing removes.  ## Approach  - `MAX_ADVERTISED_CONTRACTS_PER_NEIGHBOR = 65,536` (about 4 MiB per neighbour). An honest peer advertises what it hosts. The hosting cache charges at least 8 KiB per hosted contract against 1/8 of RAM, which is 32,768 contracts on a 2 GiB node; measured sets are far smaller (telemetry median 417, max 2,814; a busy peer about 6,200). 65,536 is twice the 2 GiB ceiling and about 10 times the largest measured set. A node with over 16 GiB of RAM 

- **Issue #6279** (2026-11-18): **fix: bound remote-controlled relay inputs (UPDATE loop, HTL, reconcile rate, streaming admission)**
  *Symptoms*: ## Problem  Four relay paths acted on a value from the inbound message, or on a count of inbound messages, without a bound of their own:  - **UPDATE request loop (#3911).** `UpdateMsg::RequestUpdate` and `RequestUpdateStreaming` carry no hops-to-live and no visited list, and each relay excludes only itself and the previous hop when it picks the next one. For a contract no reachable peer hosts, the request can come back to a relay it already passed through. The in-flight gate `active_relay_update_txs` does not stop that, because its entry is removed when the relay driver exits, before the request returns. The cycle did not end on its own. - **HTL clamp.** `drive_relay_put`, `drive_relay_put_streaming`, `drive_relay_probe_reconcile` and `drive_relay_subscribe` decremented the wire HTL without first bounding it by `ring.max_hops_to_live`, unlike the GET relay and `drive_relay_probe`. - **ProbeReconcile and the UPDATE rate limiter.** A `PutMsg::ProbeReconcile` delta is merged through `update_contract`, the path every UPDATE takes, but the PUT dispatch never charged it to `update_rate_limiter`. - **Streaming PUT relay drivers.** Each `PutMsg::RequestStreaming` with a new transaction id started a relay driver that waits up to 60 s for its stream, with no limit on how many waited.  ## Approach  - **UPDATE loop: a node-local record, with no wire change.** Adding an HTL field to `RequestUpdate*` would break decoding on every peer that predates it, because bincode is positional and the

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

### Incident Patch 1: `9811972d` (2026-11-18)
**Commit Message**: fix(hosting): bound per-neighbor hosting adverts and close disconnect race (#6280)

**File**: `crates/core/src/node.rs` (modified, +270/-5)
```diff
@@ -2538,9 +2538,30 @@ where
                 );
                 return Ok(());
             };
-            let result = op_manager
+            // `source_pub_key` was resolved above, but this task runs
+            // concurrently with the event loop's disconnect handling and
+            // applying a large message takes a while. Ring membership is
+            // therefore re-checked AFTER the message is applied (see
+            // `handle_message_unless_disconnected`); otherwise a peer that
+            // drops its connection in between leaves a neighbor-hosting entry
+            // behind that nothing ever removes.
+            let Some(result) = op_manager
                 .neighbor_hosting
-                .handle_message(&source_pub_key, message.clone());
+                .handle_message_unless_disconnected(&source_pub_key, message.clone(), || {
+                    op_manager
+                        .ring
+                        .connection_manager
+                        .get_peer_by_pub_key(&source_pub_key)
+                        .is_some()
+                })
+            else {
+                tracing::debug!(
+                    %source,
+                    peer = %source_pub_key,
+                    "NeighborHosting: sender left the ring while its message was applied, discarded"
+                );
+                return Ok(());
+            };
             if let Some(response) = result.response {
                 // Send response back to sender
                 let response_msg =
@@ -2553,7 +2574,38 @@ where
             // so the neighbor gets current state if they're stale after restart.
             // Only sync contracts we're actively interested in (receiving updates
             // or have downstream subscribers) — skip cached-only contracts.
-            for instance_id in result.overlapping_contracts {
+            //
+            // The ids are already distinct (`handle_message` de-duplicates), and
+            // the number of state FETCHES per message is capped at
+            // `MAX_STALE_SYNCS_PER_SUMMARIES`, the same budget the `Summaries`
+            // path uses (ANT-2026-27GZI7ZB: a repeated id used to cost one
+            // full-state fetch and one sync per copy). The budget is charged at
+            // the `get_contract_state_by_id` call, not at the emit: the fetch
+            // and the `flush_pending_broadcast_on_interest` after it are the
+            // work being bounded, and they also run for ids that then fail the
+            // post-fetch check or return no state. Ids skipped before the fetch
+            // (banned, or neither served nor owing a broadcast) are free.
+            // Overflow is not dropped: InterestSync revisits every shared
+            // contract within 2*ceil(shared/64)-1 rounds of its 5-minute
+            // heartbeat (about 75 minutes for 500 shared contracts). When over
+            // the budget the start is rotated at random so the same prefix does
+            // not consume it every time.
+            let mut overlapping_contracts = result.overlapping_contracts;
+            let overlap_budget = stale_sync_emit_budget(overlapping_contracts.len());
+            if overlapping_contracts.len() > overlap_budget {
+                let start = crate::config::GlobalRng::random_range(0..overlapping_contracts.len());
+                overlapping_contracts.rotate_left(start);
+            }
+            let mut overlap_fetched = 0usize;
+            for instance_id in overlapping_contracts {
+                if overlap_fetched >= overlap_budget {
+                    // Telemetry only: may overstate when the remaining
+                    // unvisited ids would all have been skipped for free.
+                    op_manager
+                        .neighbor_hosting
+                        .note_sync_budget_hit(&source_pub_key, overlap_budget);
+                    break;
+                }
                 // Phase 7 egress gate. If we've banned the contract,
                 // don't proactively push its state to a sibling peer
                 // via the overlap-sync path — that would undermine
@@ -2610,6 +2662,7 @@ where
                 {
                     continue;
                 }
+                overlap_fetched += 1;
                 if let Some((key, state)) =
                     get_contract_state_by_id(&op_manager, &instance_id).await
                 {
@@ -7350,8 +7403,8 @@ mod tests {
         // ordering check can't false-pass on a neighbouring handler. The loop
         // is the only site that iterates `result.overlapping_contracts`.
         let loop_start = src
-            .find("for instance_id in result.overlapping_contracts {")
-            .expect("NeighborHosting overlap-sync loop not found");
+            .find("NetMessageV1::NeighborHosting { ref message } => {")
+            .expect("NeighborHosting dispatch arm not found");
         let loop_src = &src[loop_start..];
 
         let gate_
```

**File**: `crates/core/src/node/neighbor_hosting.rs` (modified, +459/-40)
```diff
@@ -23,7 +23,13 @@
 //! `OpManager::get_broadcast_targets_update()`, where HashSet naturally deduplicates
 //! any overlap.
 
-use std::{collections::HashSet, sync::Arc};
+use std::{
+    collections::HashSet,
+    sync::{
+        Arc,
+        atomic::{AtomicU64, Ordering},
+    },
+};
 
 use dashmap::DashMap;
 use freenet_stdlib::prelude::{ContractInstanceId, ContractKey};
@@ -49,6 +55,34 @@ use crate::transport::TransportPublicKey;
 // bound the spec calls out: a co-host advertisement can be stale for at most one
 // heartbeat interval after a dropped update.
 
+/// Most contract ids this node remembers one neighbour advertising (65,536,
+/// about 4 MiB of set per neighbour).
+///
+/// `neighbor_contracts[peer]` is filled from the peer's own `HostingAnnounce`
+/// and `HostingStateResponse` messages and lives as long as the connection, so
+/// without a bound one neighbour decides how much heap this node spends on it
+/// (ANT-2026-N74RDRBN: 4 x 1,000,000 ids cost about 330 MiB).
+///
+/// Sizing, from what an honest peer can advertise. A node advertises every
+/// contract it hosts, and the hosting cache bounds that count by memory: each
+/// hosted contract is charged at least `HOSTED_ENTRY_BYTES` (8 KiB) against a
+/// resident-overhead budget of 1/8 of the node's RAM. A 2 GiB node therefore
+/// tops out at 32,768 hosted contracts. Measured sets are far smaller: a
+/// `hosting_contract_count` telemetry sample (16,578 readings) had median 417
+/// and max 2,814, and a busy peer was seen hosting about 6,200. 65,536
+/// is twice the 2 GiB ceiling and about 10 times the largest measured set. A
+/// node with more than 16 GiB of RAM can hold more than this, and its
+/// neighbours then stop consulting it as a co-host for the overflow ids. That
+/// is the same best-effort outcome as a dropped announce: freshness of those
+/// contracts falls back to the subscription tree and InterestSync anti-entropy
+/// (hosting-invariants 1), and nothing is evicted or forgotten elsewhere.
+///
+/// Ids over the cap are not stored and the peer is not told. Saturation is
+/// counted (`over_cap_ids_total`) and logged at `info!` on power-of-two message
+/// counts only, so release builds show it while the sender cannot flood the log.
+/// Both write sites go through this bound.
+pub(crate) const MAX_ADVERTISED_CONTRACTS_PER_NEIGHBOR: usize = 65_536;
+
 /// Result from handling a neighbor hosting message.
 ///
 /// Contains an optional response message to send back, plus any contracts
@@ -98,6 +132,20 @@ pub struct NeighborHostingManager {
     /// Keyed by TransportPublicKey (stable identity) rather than SocketAddr (mutable
     /// due to NAT/reconnection), so entries survive address changes.
     neighbor_contracts: DashMap<TransportPublicKey, HashSet<ContractInstanceId>>,
+
+    /// Messages whose ids were partly dropped by the per-neighbour cap.
+    over_cap_messages: AtomicU64,
+    /// Ids dropped by the per-neighbour cap, in total.
+    over_cap_ids: AtomicU64,
+    /// Inbound messages whose proximity syncs hit the per-message budget.
+    sync_budget_hits: AtomicU64,
+}
+
+/// Log at `info!` when `count` is a power of two (1, 2, 4, 8, ...): saturation
+/// shows up in release builds (`debug!` is compiled out) while the volume of
+/// log lines stays logarithmic in a peer-controlled event count.
+fn is_log_point(count: u64) -> bool {
+    count.is_power_of_two()
 }
 
 impl Default for NeighborHostingManager {
@@ -112,9 +160,58 @@ impl NeighborHostingManager {
         Self {
             my_contracts: Arc::new(DashMap::new()),
             neighbor_contracts: DashMap::new(),
+            over_cap_messages: AtomicU64::new(0),
+            over_cap_ids: AtomicU64::new(0),
+            sync_budget_hits: AtomicU64::new(0),
+        }
+    }
+
+    /// Record that `dropped` ids from `from` exceeded the per-neighbour cap.
+    fn note_over_cap(&self, from: &TransportPublicKey, dropped: usize) {
+        if dropped == 0 {
+            return;
+        }
+        self.over_cap_ids
+            .fetch_add(dropped as u64, Ordering::Relaxed);
+        let messages = self.over_cap_messages.fetch_add(1, Ordering::Relaxed) + 1;
+        if is_log_point(messages) {
+            info!(
+                peer = %from,
+                dropped,
+                messages_over_cap = messages,
+                cap = MAX_ADVERTISED_CONTRACTS_PER_NEIGHBOR,
+                "NEIGHBOR_HOSTING: neighbor advertised more contracts than the per-neighbor cap; overflow ignored (logged at power-of-two counts)"
+            );
         }
     }
 
+    /// Record that an inbound message's proximity syncs hit the per-message
+    /// budget. Called by the dispatch loop in `node.rs`; logs at `info!` on
+    /// power-of-two counts only.
+    pub(crate) fn note_sync_budget_hit(&self, from: &TransportPublicKey, budget: usize) {
+        let hits = self.sync_budget_hits.fetch_add(1, Ordering::Relaxed) + 1;
+        if is_log_point(hits) {
+        
```

---

### Incident Patch 2: `aaf7d1ac` (2026-11-18)
**Commit Message**: fix: bound remote-controlled relay inputs (UPDATE loop, HTL, reconcile rate, streaming admission) (#6279)

**File**: `crates/core/src/node.rs` (modified, +200/-0)
```diff
@@ -1720,6 +1720,42 @@ where
                         htl,
                         skip_list,
                     } => {
+                        // A reconcile delivers a delta that is merged through
+                        // `update_contract`, the same path an UPDATE takes, so it
+                        // is charged to the UPDATE rate limiter
+                        // (ANT-2026-0ILTPRIJ), in its own class: a separate stamp
+                        // in the same (sender, contract) entry, at the request
+                        // interval. Sharing the Request stamp would refuse a
+                        // client's UPDATE that follows its PUT within the
+                        // interval through the same first hop, and a refused
+                        // `RequestUpdate` is lost until anti-entropy. A sender
+                        // alternating opcodes gains at most one extra bounded
+                        // budget. Only a remote sender is charged; `source_addr`
+                        // is `None` for this node's own loopback.
+                        //
+                        // A refused reconcile is not repaired: it is best-effort
+                        // by design (the originator holds the merged state and
+                        // anti-entropy heals the receiver, see
+                        // `drive_relay_probe_reconcile`), and the limiter records
+                        // the refusal in its counters and its once-a-minute log.
+                        if let Some(sender_addr) = source_addr {
+                            let decision = op_manager.ring.update_rate_limiter.check_and_record(
+                                sender_addr,
+                                *key.id(),
+                                crate::ring::update_rate_limit::UpdateClass::Reconcile,
+                            );
+                            if !decision.is_allowed() {
+                                tracing::debug!(
+                                    tx = %id,
+                                    contract = %key,
+                                    %sender_addr,
+                                    ?decision,
+                                    phase = "put_probe_reconcile_rate_limited",
+                                    "PUT dispatch: ProbeReconcile refused by the UPDATE rate limiter"
+                                );
+                                return Ok(());
+                            }
+                        }
                         if let Err(err) = put::op_ctx_task::start_relay_probe_reconcile(
                             op_manager.clone(),
                             *id,
@@ -8830,6 +8866,170 @@ mod tests {
         );
     }
 
+    /// ANT-2026-0ILTPRIJ: a `PutMsg::ProbeReconcile` delivers a delta that is
+    /// merged like an UPDATE, so it must be charged to the UPDATE rate limiter.
+    /// Before the fix the PUT dispatch went straight to the driver and the
+    /// limiter never saw it. The reconcile has its own class, so a
+    /// `RequestUpdate` right after it from the same sender is still admitted.
+    #[tokio::test]
+    async fn probe_reconcile_is_charged_to_the_update_rate_limiter() {
+        use crate::message::NetMessageV1;
+        use crate::operations::put::PutMsg;
+        use crate::operations::test_utils::MockNetworkBridge;
+        use crate::ring::update_rate_limit::UpdateClass;
+        use crate::util::time_source::SharedMockTimeSource;
+
+        let clock = SharedMockTimeSource::new();
+        let config_args = crate::config::ConfigArgs {
+            id: Some("probe-reconcile-rate-limit".to_string()),
+            mode: Some(crate::contract::OperationMode::Local),
+            ..Default::default()
+        };
+        let mut node_config = NodeConfig::new(config_args.build().await.expect("build Config"))
+            .await
+            .expect("build NodeConfig");
+        node_config.update_rate_limit_time_source_override =
+            Some(std::sync::Arc::new(clock.clone()));
+
+        let (notification_rx, notification_tx) = crate::node::event_loop_notification_channel();
+        let crate::node::EventLoopNotificationsReceiver {
+            notifications_receiver: _notifications_receiver,
+            mut op_execution_receiver,
+        } = notification_rx;
+        let (ops_ch_channel, _ch_channel, _wait_for_event) =
+            crate::contract::contract_handler_channel();
+        let connection_manager = crate::ring::ConnectionManager::new(&node_config);
+        let (result_router_tx, _result_router_rx) = tokio::sync::mpsc::channel(100);
+        let task_monitor = crate::node::background_task_monitor::BackgroundTaskMonitor::new();
+        let op_manager = std::sync::Arc::new(
+            crate::node::OpManager::new(
+                notification_tx,
+                ops_ch_channel,
+                &node_config,
+                crate::tracing::DynamicRegister::new(vec![]),
+                connection_manager,
+
```

**File**: `crates/core/src/node/op_state_manager.rs` (modified, +18/-0)
```diff
@@ -322,6 +322,16 @@ pub(crate) struct OpManager {
     /// exists primarily for robustness against GC-spawned re-entries
     /// and routing-bloom false-positive retransmissions.
     pub(crate) active_relay_update_txs: Arc<DashSet<Transaction>>,
+    /// `RequestUpdate*` transactions this node has relayed, remembered past
+    /// the driver's lifetime so a request that comes back around a routing
+    /// cycle is dropped (#3911). See
+    /// [`crate::operations::update::recent_requests`].
+    pub(crate) recent_relay_update_requests:
+        Arc<crate::operations::update::recent_requests::RecentRelayedRequests>,
+    /// Per-source and node-wide bound on streaming PUT relay drivers in
+    /// flight. See [`crate::operations::put::stream_admission`].
+    pub(crate) relay_put_stream_admission:
+        Arc<crate::operations::put::stream_admission::RelayStreamAdmission>,
     /// Same role as `active_relay_get_txs` but for PUT relay. PUT
     /// relay has req/response semantics like GET (but forwards once
     /// — no per-hop retry), so amplification risk is comparable.
@@ -411,6 +421,8 @@ impl Clone for OpManager {
             node_identity: self.node_identity,
             active_relay_get_txs: self.active_relay_get_txs.clone(),
             active_relay_update_txs: self.active_relay_update_txs.clone(),
+            recent_relay_update_requests: self.recent_relay_update_requests.clone(),
+            relay_put_stream_admission: self.relay_put_stream_admission.clone(),
             active_relay_put_txs: self.active_relay_put_txs.clone(),
             active_relay_subscribe_txs: self.active_relay_subscribe_txs.clone(),
             active_relay_connect_txs: self.active_relay_connect_txs.clone(),
@@ -855,6 +867,12 @@ impl OpManager {
             node_identity,
             active_relay_get_txs,
             active_relay_update_txs,
+            recent_relay_update_requests: Arc::new(
+                crate::operations::update::recent_requests::RecentRelayedRequests::new(),
+            ),
+            relay_put_stream_admission: Arc::new(
+                crate::operations::put::stream_admission::RelayStreamAdmission::new(),
+            ),
             active_relay_put_txs,
             active_relay_subscribe_txs,
             active_relay_connect_txs,
```

**File**: `crates/core/src/operations/orphan_streams.rs` (modified, +205/-1)
```diff
@@ -92,14 +92,75 @@ pub struct OrphanStreamRegistry {
     /// both the embedded metadata (in fragment #1) and the separate metadata
     /// message arrive — only the first one should be processed.
     claimed_streams: DashMap<StreamKey, ()>,
+
+    /// Keys whose claimant gave up before the stream arrived
+    /// ([`Self::abandon_claim`]), with when. A stream that arrives for one
+    /// while no claimant is waiting is cancelled instead of parked: the key's
+    /// `claimed_streams` entry blocks new claims, so a parked orphan would
+    /// only hold its buffer until GC. A new claim of the key clears its mark.
+    /// Bounded by [`MAX_ABANDONED_CLAIMS`] and expired by `gc_expired`.
+    abandoned: DashMap<StreamKey, Instant>,
 }
 
+/// Most abandoned claims remembered at once. Past this an abandoned stream
+/// is parked and aged out by `gc_expired`, as before abandonment existed.
+const MAX_ABANDONED_CLAIMS: usize = 4096;
+
 impl OrphanStreamRegistry {
     /// Creates a new empty registry.
     pub fn new() -> Self {
         Self {
             slots: Default::default(),
             claimed_streams: DashMap::new(),
+            abandoned: DashMap::new(),
+        }
+    }
+
+    /// Give up a claim whose `claim_or_wait` future was dropped mid-wait (a
+    /// streaming PUT relay driver evicted by its admission bound).
+    ///
+    /// Removes the dead waiter the dropped future left, cancels the stream if
+    /// it already arrived in the meantime, and otherwise marks the key so the
+    /// stream is cancelled when it arrives. A live waiter at the key belongs to
+    /// another claimant and is left alone, unmarked.
+    ///
+    /// A mark only ever applies while nobody else wants the stream: every
+    /// read and write of `abandoned` happens under the key's `slots` entry
+    /// lock (lock order: `slots`, then `abandoned`), a new claim of the key
+    /// clears the mark, and `register_orphan` honours a mark only when no
+    /// live waiter is parked. The new claim matters because `gc_expired`
+    /// clears `claimed_streams` wholesale, after which the same key can be
+    /// announced and claimed again.
+    pub fn abandon_claim(&self, peer_addr: SocketAddr, stream_id: StreamId) {
+        use dashmap::mapref::entry::Entry;
+        let key = (peer_addr, stream_id);
+        match self.slots.entry(key) {
+            Entry::Occupied(occupied) if matches!(occupied.get(), Slot::Orphan(..)) => {
+                let Slot::Orphan(handle, _) = occupied.remove() else {
+                    unreachable!("the match guard checked for an orphan");
+                };
+                handle.cancel();
+            }
+            Entry::Occupied(occupied) => {
+                let Slot::Waiter(tx) = occupied.get() else {
+                    unreachable!("the arm above took every orphan");
+                };
+                if tx.is_closed() {
+                    // Our own dead waiter: remove it and mark, both under the
+                    // entry lock.
+                    if self.abandoned.len() < MAX_ABANDONED_CLAIMS {
+                        self.abandoned.insert(key, Instant::now());
+                    }
+                    occupied.remove();
+                }
+                // Otherwise another claimant's live waiter: it wants the stream.
+            }
+            Entry::Vacant(vacant) => {
+                if self.abandoned.len() < MAX_ABANDONED_CLAIMS {
+                    self.abandoned.insert(key, Instant::now());
+                }
+                drop(vacant);
+            }
         }
     }
 
@@ -123,6 +184,11 @@ impl OrphanStreamRegistry {
         // or will find our orphan (#5731).
         match self.slots.entry(key) {
             Entry::Occupied(occupied) if matches!(occupied.get(), Slot::Waiter(_)) => {
+                // A live waiter wants this stream, whatever an older abandoned
+                // claim of the same key left behind.
+                if matches!(occupied.get(), Slot::Waiter(tx) if !tx.is_closed()) {
+                    self.abandoned.remove(&key);
+                }
                 // `remove` consumes the entry, releasing the shard lock before
                 // the handle is sent.
                 let Slot::Waiter(waiter) = occupied.remove() else {
@@ -157,6 +223,19 @@ impl OrphanStreamRegistry {
                 occupied.insert(Slot::Orphan(handle, Instant::now()));
             }
             Entry::Vacant(vacant) => {
+                // Its claimant gave up (`abandon_claim`) and nobody has claimed
+                // the key since (a new claim clears the mark): cancel the
+                // stream rather than park an orphan nobody can claim.
+                if self.abandoned.remove(&key).is_some() {
+                    drop(vacant);
+                    tracing::debug!(
+                        %peer_addr,
+                        stream_id = %stream_id,
+                        "Stream arrived for an abandoned claim; cancelling
```

**File**: `crates/core/src/operations/put.rs` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
 //! consume them.
 
 pub(crate) mod op_ctx_task;
+pub(crate) mod stream_admission;
 
 pub(crate) use self::messages::{PutMsg, PutStreamingPayload};
 use freenet_stdlib::prelude::*;
```

**File**: `crates/core/src/operations/put/op_ctx_task.rs` (modified, +692/-6)
```diff
@@ -1945,6 +1945,11 @@ where
     CB: NetworkBridge + Clone + Send + 'static,
 {
     let key = contract.key();
+    // The sender writes `htl`, so bound it by this node's own limit before
+    // anything reads it, as the GET relay and `drive_relay_probe` do
+    // (ANT-2026-QLQ8OSNJ). Without the clamp the sender chooses how many
+    // nodes the PUT walks.
+    let htl = htl.min(op_manager.ring.max_hops_to_live);
 
     tracing::info!(
         tx = %incoming_tx,
@@ -3342,6 +3347,9 @@ where
     #[cfg(any(test, feature = "testing"))]
     RELAY_PUT_STREAMING_DRIVER_CALL_COUNT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
 
+    let originator_loopback =
+        Some(upstream_addr) == op_manager.ring.connection_manager.get_own_addr();
+
     if !op_manager.active_relay_put_txs.insert(incoming_tx) {
         RELAY_PUT_STREAMING_DEDUP_REJECTS.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
         tracing::debug!(
@@ -3362,14 +3370,76 @@ where
         return Ok(());
     }
 
+    // Bound how many drivers wait for a stream that has not arrived yet, per
+    // source and node-wide (ANT-2026-16KQ0AS7). The permit covers only the
+    // unclaimed phase; the driver releases it when its claim ends. This node's
+    // own streaming PUT is not counted. Taken after the dedup gate, so a
+    // duplicate neither takes a slot nor evicts anyone.
+    let admission_permit = if originator_loopback {
+        None
+    } else {
+        match op_manager
+            .relay_put_stream_admission
+            .try_admit(upstream_addr)
+        {
+            Ok(permit) => Some(permit),
+            Err(refusal) => {
+                op_manager.active_relay_put_txs.remove(&incoming_tx);
+                let refused = op_manager.relay_put_stream_admission.refused_total();
+                // Release-visible, but logarithmic in the refusal count so a
+                // sustained flood does not become a log flood.
+                if refused.is_power_of_two() {
+                    tracing::info!(
+                        tx = %incoming_tx,
+                        contract = %contract_key,
+                        %upstream_addr,
+                        ?refusal,
+                        refused_total = refused,
+                        unclaimed = op_manager.relay_put_stream_admission.unclaimed(),
+                        phase = "relay_put_streaming_admission_refused",
+                        "PUT streaming relay: too many unclaimed streaming PUTs from this \
+                         source, refusing"
+                    );
+                } else {
+                    tracing::debug!(
+                        tx = %incoming_tx,
+                        contract = %contract_key,
+                        %upstream_addr,
+                        ?refusal,
+                        phase = "relay_put_streaming_admission_refused",
+                        "PUT streaming relay: too many unclaimed streaming PUTs from this \
+                         source, refusing"
+                    );
+                }
+                // Answer the upstream, one reply per announcement, so a
+                // streaming originator (which cannot advance to another peer)
+                // fails now instead of waiting out its attempt (#5671).
+                if let Err(err) = relay_put_send_error(
+                    &op_manager,
+                    incoming_tx,
+                    STREAM_ADMISSION_REFUSED_CAUSE.to_string(),
+                    upstream_addr,
+                )
+                .await
+                {
+                    tracing::debug!(
+                        tx = %incoming_tx,
+                        %upstream_addr,
+                        error = %err,
+                        "PUT streaming relay: could not report the refusal upstream"
+                    );
+                }
+                return Ok(());
+            }
+        }
+    };
+
     // Routing/hosting attribution (Group C): count this as a genuine relayed
     // PUT, mirroring `start_relay_put`. A direct `PutMsg::RequestStreaming`
     // (or a `PutMsg::Request` that upgrades to streaming on forward) dispatches
     // here, so without this the largest PUT relays were undercounted. Exclude
     // the originator-loopback case (own streaming PUT mapped to
     // `upstream_addr=own_addr`), consistent with the non-streaming path.
-    let originator_loopback =
-        Some(upstream_addr) == op_manager.ring.connection_manager.get_own_addr();
     if !originator_loopback {
         crate::node::network_status::record_relayed_put();
     }
@@ -3394,6 +3464,7 @@ where
 
     GlobalExecutor::spawn(run_relay_put_streaming(
         guard,
+        admission_permit,
         op_manager,
         conn_manager,
         incoming_tx,
@@ -3415,6 +3486,11 @@ struct RelayPutStreamingInflightGuard {
     incoming_tx: Transaction,
 }
 
+/// Cause sent upstream when a streaming PUT announcement is refused, or its
+/// driver evicted, b
```

**File**: `crates/core/src/operations/put/stream_admission.rs` (added, +357/-0)
```diff
@@ -0,0 +1,357 @@
+//! Bound on streaming PUT relay drivers still waiting for their stream
+//! (ANT-2026-16KQ0AS7).
+//!
+//! A `PutMsg::RequestStreaming` starts a relay driver whose first step waits up
+//! to `STREAM_CLAIM_TIMEOUT` (60 s) for the announced stream. The announcement
+//! is a small message and the stream a separate transfer, so the number of
+//! drivers waiting for a stream was decided by the peers sending
+//! announcements; the transport's per-connection stream limits do not count an
+//! announcement whose stream never comes.
+//!
+//! A permit covers only that UNCLAIMED phase: it is taken when the driver
+//! starts and released as soon as the claim ends, whether the stream arrived or
+//! not. What happens after the claim is bounded by the transport's
+//! per-connection inbound-stream and byte limits, as for any stream.
+//!
+//! Two bounds:
+//!
+//! - **Per source**, at most [`PER_SOURCE_CAP`] unclaimed drivers. A source is
+//!   the previous hop's IPv4 address or IPv6 /64 (an IPv4-mapped address counts
+//!   as IPv4), so more ports or more addresses in one /64 add nothing. A new
+//!   announcement over this cap is refused.
+//! - **Node-wide**, at most [`NODE_WIDE_CAP`]. At this cap the OLDEST unclaimed
+//!   driver is evicted to admit the newcomer, rather than refusing it. An
+//!   honest stream is claimed within about one round trip of its announcement,
+//!   so the oldest waiter is the one least likely to ever see its stream, and
+//!   no set of sources can lock the node out by holding every permit for the
+//!   claim timeout.
+//!
+//! A refused announcement and an evicted driver both answer their upstream with
+//! a `PutMsg::Error` (one reply per announcement, so no amplification); the
+//! upstream would otherwise wait out its whole attempt.
+
+use std::collections::{BTreeMap, HashMap};
+use std::net::{IpAddr, SocketAddr};
+use std::sync::Arc;
+use std::sync::atomic::{AtomicU64, Ordering};
+
+use tokio::sync::oneshot;
+
+/// Unclaimed streaming PUT relay drivers one source (the previous hop) may
+/// have at once.
+///
+/// Sized for an honest gateway relaying many joiners' PUTs, which all count
+/// against that gateway's address. A permit is held only from the
+/// announcement until the stream is claimed, i.e. until fragment 1 arrives.
+///
+/// # How long fragment 1 can lag its announcement on a busy link
+///
+/// Outbound streams on one connection are INTERLEAVED, not sent one after
+/// another. On the UDP session each stream is its own task
+/// (`PeerConnection::outbound_stream_with_id` / `pipe_stream_to_remote`
+/// push a spawned `send_stream` onto `outbound_stream_futures`), and each
+/// task admits its packets one at a time: wait for congestion-window
+/// space, then reserve that one packet from the connection's token bucket.
+/// On the QUIC path quinn multiplexes streams itself. So fragment 1 of a
+/// new stream does not wait for earlier transfers to finish. It waits for
+/// window space, which opens within about one round trip, and for the
+/// single packets the other active streams on the link have reserved ahead
+/// of it, about one packet per active stream. The sender emits fragment 1
+/// right after its announcement, and fragment 1 also carries a copy of it.
+///
+/// So the lag is about one round trip plus K packet times for K active
+/// streams on the link: at K = 32 and 1.25 MB/s, about 36 ms on top of
+/// the round trip. Taking 300 ms per permit as a generous figure, 32
+/// permits let one previous hop have about 100 streaming PUTs per second
+/// announced through it before any is refused. A streaming PUT carries
+/// more than the 64 KiB streaming threshold, so that is at least 6.5 MB/s
+/// of PUT payload over one link. If field data shows refusals from honest
+/// gateways, raise this constant: the node-wide cap with eviction is what
+/// bounds memory, not this one.
+pub(crate) const PER_SOURCE_CAP: usize = 32;
+
+/// Unclaimed streaming PUT relay drivers this node holds across all sources.
+/// At this cap the oldest is evicted. A driver waiting for its stream holds
+/// a few KB, so a full set is a few MiB.
+pub(crate) const NODE_WIDE_CAP: usize = 512;
+
+/// Where an announcement came from, at the granularity one host controls.
+#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
+enum Source {
+    V4(u32),
+    /// The top 64 bits of an IPv6 address: a host usually holds a whole /64.
+    V6Prefix(u64),
+}
+
+impl Source {
+    fn of(addr: SocketAddr) -> Self {
+        match addr.ip() {
+            IpAddr::V4(v4) => Source::V4(u32::from(v4)),
+            IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
+                Some(v4) => Source::V4(u32::from(v4)),
+                None => Source::V6Prefix((u128::from(v6) >> 64) as u64),
+            },
+        }
+    }
+}
+
+/// Why an announcement was refused.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub(crate) enum Refusal {
+    SourceAtCap,
+}
+
+pub(crate) struct Rela
```

**File**: `crates/core/src/operations/subscribe/op_ctx_task.rs` (modified, +63/-0)
```diff
@@ -1760,6 +1760,11 @@ async fn drive_relay_subscribe(
     is_renewal: bool,
     upstream_addr: std::net::SocketAddr,
 ) -> Result<(), OpError> {
+    // The sender writes `htl`, so bound it by this node's own limit before
+    // anything reads it, as the GET relay does (ANT-2026-QLQ8OSNJ). The visited
+    // bloom alone does not stop a long walk.
+    let htl = htl.min(op_manager.ring.max_hops_to_live);
+
     tracing::info!(
         tx = %incoming_tx,
         %instance_id,
@@ -6060,3 +6065,61 @@ mod bootstrap_subscription_tests {
         );
     }
 }
+
+/// ANT-2026-QLQ8OSNJ: the SUBSCRIBE relay clamps the hops-to-live a sender
+/// writes to this node's own limit before it forwards. Drives the real
+/// `start_relay_subscribe` against a stubbed event loop.
+#[cfg(test)]
+mod relay_htl_clamp_tests {
+    use super::*;
+    use crate::operations::route_attempt::driver_test_support::op_manager_with_peers_and_store;
+    use std::time::Duration;
+
+    #[tokio::test(flavor = "current_thread", start_paused = true)]
+    async fn relay_subscribe_clamps_an_oversized_wire_htl() {
+        let (op_manager, mut rx, _peers, _guards, _store) =
+            op_manager_with_peers_and_store("relay-subscribe-htl-clamp", 3).await;
+        let forwarded = Arc::new(parking_lot::Mutex::new(Vec::new()));
+        let log = forwarded.clone();
+        tokio::spawn(async move {
+            let mut held = Vec::new();
+            while let Some((reply_tx, msg, _target)) = rx.recv().await {
+                if let NetMessage::V1(NetMessageV1::Subscribe(SubscribeMsg::Request {
+                    htl, ..
+                })) = &msg
+                {
+                    log.lock().push(*htl);
+                }
+                held.push(reply_tx);
+            }
+        });
+
+        let tx = Transaction::new::<SubscribeMsg>();
+        let upstream: std::net::SocketAddr = "10.0.0.42:31337".parse().unwrap();
+        start_relay_subscribe(
+            op_manager.clone(),
+            tx,
+            ContractInstanceId::new([0x5a; 32]),
+            usize::MAX,
+            VisitedPeers::new(&tx),
+            false,
+            upstream,
+        )
+        .await
+        .expect("the relay starts");
+        for _ in 0..100 {
+            tokio::time::sleep(Duration::from_millis(100)).await;
+            if !forwarded.lock().is_empty() {
+                break;
+            }
+        }
+
+        let max_htl = op_manager.ring.max_hops_to_live;
+        assert_eq!(
+            forwarded.lock().first().copied(),
+            Some(max_htl - 1),
+            "a wire HTL above max_hops_to_live must be clamped before it is \
+             decremented and forwarded"
+        );
+    }
+}
```

**File**: `crates/core/src/operations/update.rs` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
 pub(crate) mod op_ctx_task;
 pub(crate) mod pending_broadcast;
 pub(crate) mod propagation_stats;
+pub(crate) mod recent_requests;
 
 use freenet_stdlib::prelude::*;
 
```

---

### Incident Patch 3: `37e8fbda` (2026-11-18)
**Commit Message**: fix: store only contract ids in PendingBroadcastStore and expire eagerly (#6274)

**File**: `crates/core/src/node.rs` (modified, +7/-3)
```diff
@@ -2551,9 +2551,13 @@ where
                 // `pending_broadcasts` clause so the #4359 fresh-PUT flush at
                 // the matching arm still runs for any contract that owes one.
                 // Skipping is safe for the flush because a deferred broadcast
-                // is only ever stashed for a contract THIS node originated
-                // (broadcast give-up), so the flush is a guaranteed no-op for
-                // every contract this gate skips. The predicates take a
+                // is only ever stashed for a contract THIS node stored and
+                // tried to fan out (broadcast give-up). That includes a remote
+                // peer's PUT stored under every-hop hosting, not only
+                // contracts this node originated, so the guard here is the
+                // `pending_broadcasts` clause above: any contract that owes a
+                // flush passes the gate, and every contract the gate skips has
+                // no pending entry. The predicates take a
                 // synthetic key with a zero code hash: `ContractKey` equality
                 // and hashing are instance-only (freenet-stdlib `key.rs`), so
                 // the hosting / subscription maps resolve correctly from the
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc.rs` (modified, +5/-1)
```diff
@@ -6711,7 +6711,11 @@ pub(crate) mod tests {
         // does not start writing a stash on every fan-out.
         let branch = &body[covered_pos..retry_pos];
         assert!(
-            branch.contains("pending_broadcasts.take(key.id()).is_some()"),
+            branch
+                .split_whitespace()
+                .collect::<Vec<_>>()
+                .join(" ")
+                .contains("if op_manager.pending_broadcasts.take(key.id()) {"),
             "the fully-covered branch must act on a deferred re-broadcast stash \
              only when one EXISTS. An unconditional take discards an earlier \
              give-up's stash with no replacement; an unconditional stash adds a \
```

**File**: `crates/core/src/node/network_bridge/p2p_protoc/broadcast.rs` (modified, +30/-35)
```diff
@@ -320,12 +320,11 @@ impl P2pConnManager {
             // every fully-covered fan-out — the COMMON outcome in the clique
             // regime this design targets — and re-emit on every new subscriber.
             // So: only if something was already stashed (meaning an earlier
-            // broadcast genuinely gave up on this contract) do we put the
-            // current state back in its place.
-            if op_manager.pending_broadcasts.take(key.id()).is_some() {
-                op_manager
-                    .pending_broadcasts
-                    .stash(*key.id(), new_state.clone());
+            // broadcast genuinely gave up on this contract) do we refresh its
+            // stash (the store holds only the id and time; the flush reads the
+            // CURRENT state).
+            if op_manager.pending_broadcasts.take(key.id()) {
+                op_manager.pending_broadcasts.stash(*key.id());
                 tracing::debug!(
                     contract = %key,
                     phase = "fully_covered_stash_refresh",
@@ -438,9 +437,7 @@ impl P2pConnManager {
                 // the freshly-registered target and propagates. The store is
                 // bounded by size and TTL so a churn of fresh ids that never
                 // gain a subscriber cannot pin memory.
-                op_manager
-                    .pending_broadcasts
-                    .stash(*key.id(), new_state.clone());
+                op_manager.pending_broadcasts.stash(*key.id());
 
                 // Lost-wakeup guard (#4359 re-review): stash() runs here on the
                 // event-loop task while the interest-resolve flush runs on the
@@ -472,35 +469,33 @@ impl P2pConnManager {
                     &key,
                     &crate::ring::broadcast_coverage::BroadcastOrigin::local(),
                 );
-                if !recheck.targets.is_empty() {
-                    if let Some(stashed) = op_manager.pending_broadcasts.take(key.id()) {
+                if !recheck.targets.is_empty() && op_manager.pending_broadcasts.take(key.id()) {
+                    tracing::debug!(
+                        contract = %key,
+                        target_count = recheck.targets.len(),
+                        phase = "pending_broadcast_stash_recheck",
+                        "A target appeared while giving up; re-emitting the deferred \
+                         fresh-contract broadcast immediately instead of leaving it \
+                         stashed for a future flush (#4359)"
+                    );
+                    if let Err(e) = op_manager.try_notify_node_event(
+                        crate::message::NodeEvent::BroadcastStateChange {
+                            key,
+                            new_state: new_state.clone(),
+                            is_retry: false,
+                            is_reemit: true,
+                        },
+                    ) {
+                        // Channel full/closed: re-stash so the next interest
+                        // flush still recovers it. Losing it would re-open the
+                        // locally-hosted-only failure this fix closes.
+                        op_manager.pending_broadcasts.stash(*key.id());
                         tracing::debug!(
                             contract = %key,
-                            target_count = recheck.targets.len(),
-                            phase = "pending_broadcast_stash_recheck",
-                            "A target appeared while giving up; re-emitting the deferred \
-                             fresh-contract broadcast immediately instead of leaving it \
-                             stashed for a future flush (#4359)"
+                            error = %e,
+                            "pending_broadcast_stash_recheck: immediate re-emit dropped; \
+                             re-stashed for the next interest signal"
                         );
-                        if let Err(e) = op_manager.try_notify_node_event(
-                            crate::message::NodeEvent::BroadcastStateChange {
-                                key,
-                                new_state: stashed.clone(),
-                                is_retry: false,
-                                is_reemit: true,
-                            },
-                        ) {
-                            // Channel full/closed: re-stash so the next interest
-                            // flush still recovers it. Losing it would re-open the
-                            // locally-hosted-only failure this fix closes.
-                            op_manager.pending_broadcasts.stash(*key.id(), stashed);
-                            tracing::debug!(
-                                contract = %key,
-                                error = %e,
-                                "pending_broadcast_stash_recheck: immediate re-emit dropped; \
-                                 re-stashed for the next in
```

**File**: `crates/core/src/node/op_state_manager.rs` (modified, +137/-68)
```diff
@@ -31,7 +31,7 @@ use crate::{
     message::{InterestMessage, MessageStats, NetMessage, NetMessageV1, NodeEvent, Transaction},
     operations::{
         OpCtx, OpError, connect::ConnectForwardEstimator, orphan_streams::OrphanStreamRegistry,
-        stream_progress::StreamProgressRegistry,
+        stream_progress::StreamProgressRegistry, update::pending_broadcast::StateRead,
     },
     ring::{
         ConnectionManager, Distance, LiveTransactionTracker, Location, PeerConnectionBackoff,
@@ -1196,21 +1196,20 @@ impl OpManager {
     /// Issue #4359: a never-before-seen contract id loses the race between the
     /// broadcast give-up window (~6 s) and the much slower interest/
     /// subscription/proximity resolve. When the broadcast handler gives up it
-    /// stashes the state in [`Self::pending_broadcasts`]. This is called on the
+    /// records the contract in [`Self::pending_broadcasts`]. This is called on the
     /// **first viable-target signal** for the contract — see the call-site list
     /// in the trigger-completeness note below — so the deferred state is
     /// re-emitted as a `BroadcastStateChange { is_retry: false, is_reemit: true }`,
     /// which now finds the just-appeared target and propagates.
     ///
-    /// ## Stale-state safety (issue #4359 re-review, SHOULD-FIX 4)
+    /// ## State is read at flush time
     ///
-    /// Rather than re-emit the give-up-time *bytes* (which a newer locally
-    /// applied UPDATE could have superseded in the meantime), this re-reads the
-    /// **current** local state for the contract and broadcasts that. The stash
-    /// entry's role is "this contract still owes a fan-out"; its bytes are only
-    /// a fallback used when the live read fails (contract handler unavailable),
-    /// which is strictly no worse than the give-up-time state we would otherwise
-    /// have re-emitted.
+    /// [`Self::pending_broadcasts`] holds only the contract id and the stash
+    /// time, never state bytes (#5551). This re-reads the **current** local
+    /// state for the contract and broadcasts that, so a newer locally-applied
+    /// UPDATE is never clobbered. If the contract is no longer held locally
+    /// the broadcast is skipped and counted (a node must not re-serve a copy it
+    /// no longer hosts).
     ///
     /// ## Trigger completeness (issue #4359 re-review, MUST-FIX 1)
     ///
@@ -1247,7 +1246,7 @@ impl OpManager {
     /// future `register_peer_interest` call site forgetting the flush.
     ///
     /// Best-effort via [`Self::try_notify_node_event`]: if the channel is full
-    /// the state is re-stashed for the next signal. No-op (no read, no emit)
+    /// the id is re-stashed for the next signal. No-op (no read, no emit)
     /// when nothing is pending for the contract — the overwhelmingly common
     /// case, kept cheap by checking membership before any contract-handler read.
     pub(crate) async fn flush_pending_broadcast_on_interest(&self, key: &ContractKey) {
@@ -1264,10 +1263,12 @@ impl OpManager {
         .await;
     }
 
-    /// Read the current local state for `key` from the contract handler, or
-    /// `None` if we don't host it / the read fails. Used by the #4359 deferred
-    /// re-broadcast flush to avoid re-emitting superseded give-up-time bytes.
-    async fn read_current_contract_state(&self, key: &ContractKey) -> Option<WrappedState> {
+    /// Read the current local state for `key` from the contract handler. Used
+    /// by the #4359 deferred re-broadcast flush, which stores no state bytes.
+    /// Only a handler answer of "no state" is [`StateRead::NotHeld`]; a timeout,
+    /// queue refusal, dropped channel or store error is [`StateRead::Error`],
+    /// which the flush treats as transient.
+    async fn read_current_contract_state(&self, key: &ContractKey) -> StateRead {
         use crate::contract::ContractHandlerEvent;
         match self
             .notify_contract_handler(ContractHandlerEvent::GetQuery {
@@ -1279,8 +1280,11 @@ impl OpManager {
             Ok(ContractHandlerEvent::GetResponse {
                 response: Ok(store_response),
                 ..
-            }) => store_response.state,
-            _ => None,
+            }) => match store_response.state {
+                Some(state) => StateRead::Held(state),
+                None => StateRead::NotHeld,
+            },
+            _ => StateRead::Error,
         }
     }
 
@@ -2543,9 +2547,9 @@ fn try_notify_node_event_on(
 ///    to a concurrent drain (TTL expiry, a targets-found take, another flush);
 ///    again a no-op.
 /// 3. **stashed → re-read current state** — re-broadcast the CURRENT local
-///    state (`read_current_state` returned `Some`) rather than the possibly
-///    superseded give-up-time bytes; fall back to the stashed `bytes` when the
-///    live read fails (`None`) so we never regress to dropping the broadcast.
+///    state (`StateRead::Held`); the store holds no bytes. `NotHeld` skips and
+//
```

**File**: `crates/core/src/operations/update/pending_broadcast.rs` (modified, +437/-128)
```diff
@@ -15,11 +15,15 @@
 //! other node GETs `NotFound`.
 //!
 //! Rather than lengthen the give-up timeout (a band-aid that still races), this
-//! store keeps the last broadcast state for a contract that exhausted its retry
-//! budget with no targets. When the *first viable broadcast target* for that
-//! contract appears later, the deferred state is drained and re-emitted as a
-//! single `BroadcastStateChange { is_reemit: true }` — which now finds the
-//! freshly-appeared target and propagates.
+//! store remembers that a contract exhausted its retry budget with no targets
+//! and still owes a fan-out. It records only the contract id and the stash
+//! time, never the state bytes. When the *first viable broadcast target* for
+//! that contract appears later, the entry is drained, the CURRENT local state
+//! is read, and it is re-emitted as a single
+//! `BroadcastStateChange { is_reemit: true }` — which now finds the
+//! freshly-appeared target and propagates. If the contract is no longer held
+//! locally at that point the broadcast is skipped and counted: this node must
+//! not re-serve a copy it no longer hosts (hosting-invariants, invariant 1).
 //!
 //! ## First-viable-target signal set (issue #4359 re-review, MUST-FIX 1)
 //!
@@ -55,14 +59,29 @@
 //! ## Bounding (per `.claude/rules/code-style.md` per-key-collection rule and
 //! the AGENTS.md "cleanup exemptions must be time-bounded" rule)
 //!
-//! The store is bounded two ways so a churn of network-influenced fresh ids
-//! cannot pin memory:
+//! Stashes come from this node's own broadcast give-up, which fires for any
+//! state it stores and fans out, including a remote peer's PUT stored under
+//! every-hop hosting, so remote peers can influence which ids are stashed. The
+//! store therefore holds NO state bytes (an earlier revision held full states,
+//! up to `MAX_STATE_SIZE` each, which a count cap does not bound: #5551).
+//! Memory is bounded by [`MAX_PENDING_BROADCASTS`] x (contract id + timestamp +
+//! LRU node), about a hundred kilobytes in total, whatever the state sizes.
 //!
-//! * **Size**: at most [`MAX_PENDING_BROADCASTS`] contracts. A new insert at
-//!   capacity evicts the oldest entry (it pruning expired entries first).
-//! * **Age (TTL)**: an entry older than [`PENDING_BROADCAST_TTL`] is dropped on
-//!   the next insert/take and never re-broadcast. A fresh PUT that never gains a
-//!   subscriber is therefore released, not pinned forever.
+//! * **Count**: at most [`MAX_PENDING_BROADCASTS`] ids. An insert at capacity
+//!   evicts the least-recently-stashed id (counted, and logged at `info!` on
+//!   powers of two so a flood is visible in release builds). An evicted id
+//!   loses its deferred broadcast until anti-entropy repairs it, so eviction is
+//!   a cost, but one that costs the attacker as many distinct ids as the cap.
+//! * **Age (TTL)**: an entry older than [`PENDING_BROADCAST_TTL_MS`] is never
+//!   re-broadcast. Expired entries are dropped eagerly, on every
+//!   [`PendingBroadcastStore::stash`] and every
+//!   [`PendingBroadcastStore::contains`] (called from the interest-activity
+//!   paths), not only when the same contract is later taken.
+//!
+//! Entries are evicted and expired in stash order (re-stashing an id refreshes
+//! its position and timestamp without growing the store). If the system clock
+//! steps backwards, an expired entry can sit behind a newer one until the clock
+//! catches up; the count cap still bounds it.
 //!
 //! Timestamps come from [`GlobalSimulationTime`](crate::config::GlobalSimulationTime)
 //! so the TTL is deterministic under the simulation clock (DST).
@@ -87,112 +106,253 @@
 //! even a hypothetical small skew could only shift an eviction by a tolerance
 //! far below the window. No shared/atomic clock is needed here.
 
+use std::num::NonZeroUsize;
+use std::sync::atomic::{AtomicU64, Ordering};
+
 use freenet_stdlib::prelude::{ContractInstanceId, WrappedState};
+use lru::LruCache;
+use parking_lot::Mutex;
 
 use crate::config::GlobalSimulationTime;
 
-/// Maximum number of distinct contracts with a deferred broadcast pending. A
-/// fresh insert at capacity evicts the oldest entry rather than growing the
-/// map. 1024 comfortably covers the realistic count of fresh-id PUTs in flight
-/// on a busy node while capping worst-case memory at a bounded multiple of the
-/// largest stashed state.
+/// Maximum number of distinct contracts with a deferred broadcast pending. The
+/// store holds only ids and timestamps, so this bounds memory at roughly
+/// `1024 x (32-byte id + 8-byte timestamp + LRU node)`. Raising it only costs
+/// that much per entry; it exists so a churn of fresh ids cannot grow the map
+/// without bound, and so a flood must supply this many distinct ids to evict a
+/// legitimate entry.
 const MAX_PENDING_BROADCASTS: usize = 1024;
 
 /// How long a deferred broadcast stays eligible for re-emission. After this the
 /// entry is dropped without re-b
```

#### Recent Merged Pull Requests:
- **PR #6280** (2026-11-18): fix(hosting): bound per-neighbor hosting adverts and close disconnect race (@sanity)
- **PR #6279** (2026-11-18): fix: bound remote-controlled relay inputs (UPDATE loop, HTL, reconcile rate, streaming admission) (@sanity)
- **PR #6278** (2026-11-18): build: release 0.2.160 (@sanity)
- **PR #6274** (2026-11-18): fix: store only contract ids in PendingBroadcastStore and expire eagerly (@sanity)
- **PR #6273** (2026-11-18): chore(release): raise the QUIC-native wire floor to 0.2.161 (@sanity)
- **PR #6271** (2026-11-18): fix: run initiate_buffer and instance setup under the guest backstop (@sanity)

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

## X. hosting): bound per-neighbor hosting adverts and close disconnect race

**RULE**:
When implementing operations in `crates/core/src/node.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9811972d`: hosting): bound per-neighbor hosting adverts and close disconnect race. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/node.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            // `source_pub_key` was resolved above, but this task runs
            // concurrently with the event loop's disconnect handling and
            // applying a large message takes a while. Ring membership is
            // therefore re-checked AFTER the message is applied (see
            // `handle_message_unless_disconnected`); otherwise a peer that
            // drops its connection in between leaves a neighbor-hosting entry
            // behind that nothing ever removes.
            let Some(result) = op_manager
                .handle_message_unless_disconnected(&source_pub_key, message.clone(), || {
                    op_manager
                        .ring
                        .connection_manager
                        .get_peer_by_pub_key(&source_pub_key)
                        .is_some()
                })
            else {
                tracing::debug!(
                    %source,
                    peer = %source_pub_key,
                    "NeighborHosting: sender left the ring while its message was applied, discarded"
                );
                return Ok(());
            };
            //
            // The ids are already distinct (`h
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            let result = op_manager
                .handle_message(&source_pub_key, message.clone());
            for instance_id in result.overlapping_contracts {
            .find("for instance_id in result.overlapping_contracts {")
            .expect("NeighborHosting overlap-sync loop not found");
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9811972d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
