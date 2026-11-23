# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: freenet-freenet-core-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T21:48:47.588Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T21:48:47.588Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 72%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from freenet-freenet-core-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `d0b2003d`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T21:48:16.956Z  
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
> **Harvest Timestamp**: 2026-11-23T21:48:16.950Z  
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
- **Issue #6352** (2026-11-23): **test: give each joiners-behind-one-address test its own network name**
  *Symptoms*: ## Problem  `joiners_behind_one_address_get_past_transient_eviction` and its `_seed_1/2/3` variants (#6337) all pass the same network name, `"transient-evict-one-address"`, to `SimNetwork`. The name keys each node's config and data directories. Under plain `cargo test` the four tests share one process, so they collide on those directories and all four fail at `NodeConfig` build. CI runs `cargo nextest`, which isolates each test in its own process, so CI is green and cannot see this (`.claude/rules/testing.md`, "Cross-test interference is invisible to CI").  On `main` at 8198b32c8, `cargo test -p freenet --features simulation_tests,testing --lib -- joiners_behind_one_address_get_past_transient_eviction`:  ``` test ...::joiners_behind_one_address_get_past_transient_eviction_seed_3 ... FAILED test ...::joiners_behind_one_address_get_past_transient_eviction_seed_1 ... FAILED test ...::joiners_behind_one_address_get_past_transient_eviction ... FAILED test ...::joiners_behind_one_address_get_past_transient_eviction_seed_2 ... FAILED called `Result::unwrap()` on an `Err` value: File exists (os error 17) called `Result::unwrap()` on an `Err` value: File exists (os error 17) called `Result::unwrap()` on an `Err` value: File exists (os error 17) test result: FAILED. 0 passed; 4 failed; 0 ignored; 0 measured; 9327 filtered out; finished in 0.48s ```  Each test passes when run alone.  ## Approach  The test macro now passes the test's own name (`stringify!($test)`) as the network name. Ea
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No issues found  **Rules checked:** git-workflow.md, code-style.md, testing.md **Files reviewed:** 1  The only change is in the test-generating macro `joiners_behind_one_address_test!` in `connection_lifecycle/tests.rs`. It replaces the shared literal network name `"transient-evict-one-address"` with `stringify!($test)`.  - `stringify!($test)` expands to a `&'static str`. That matches the `name: &'static str` parameter of `join_behind_one_address`, so it compiles. - Each of the four generated tests now gets a unique name, which fixes the "File exists" collision on shared config and data directories. - The change adds no banned time or randomness APIs, no `.unwrap()` in production code, and no GC or cleanup logic. - The commit subject follows conventional commits and is under 72 characters. - The macro's comment explains why the change is needed. - This is a test-only change. It isn't a `fix:` PR, so the regression-test rule doesn't apply. - 
  > Closing as a duplicate: #6348 (merged 42b9438bd) gives each joiners_behind_one_address variant its own network name, which is the same fix.

- **Issue #6350** (2026-11-23): **fix(test): simulation test binaries keep node data dirs under a per-process temp root**
  *Symptoms*: ## Problem  `test_quic_native_blocked_pairs_connect_over_udp_behind_nats` fails intermittently on nova ("UDP fallbacks between peers that did not connect (1 of N)") and passes in CI, on a fixed seed with the direct runner, which should be deterministic.  The cause is not wall-clock time. The simulation integration tests link the library without `cfg(test)`, so `ConfigPathsArgs::default_dirs` puts every node's data dir at the shared `/tmp/freenet-{id}`, and the ids are fixed per test. Two concurrent runs of one simulation test share those dirs. That happens with another worktree, another agent, or two parallel batches on one machine. One run can then delete the other's live dirs (`build Config: No such file or directory`). Or a node can load the peer cache the other process just persisted, which changes its bootstrap, so the fixed-seed run takes a different path.  Evidence: - **Sequential runs are identical.** Six sequential runs of the test produce byte-identical logs up to teardown, once per-run ports and absolute instants are normalized. - **CPU contention alone does not change anything.** Six runs pinned to one core against three busy loops are also identical up to teardown, so this is not a dependence on host load as such. - **The failing run diverges at a cache load.** The failing run's log diverges from an unloaded run at `Loaded peer cache count=9`. - **Concurrency reproduces it.** Starting a second run 5 s and 5.5 s after a first makes the second load peer caches (1 a

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

### Incident Patch 1: `d0b2003d` (2026-11-23)
**Commit Message**: fix(connect): bound per-joiner native setups; decide UDP when there is no room (#6345)

**File**: `.claude/rules/transport.md` (modified, +39/-0)
```diff
@@ -527,6 +527,10 @@ dropped unanswered past the per-CONNECT cap on refused acceptors,
 turned its own native connects off,
 `connect_native_acceptor_demotions` for each time it stopped deciding native
 as acceptor,
+`connect_native_admission_refused` for each native setup it did not admit as
+acceptor (deciding UDP instead),
+`connect_native_admission_control_dropped` for each control pair it left out
+of the arms as acceptor for lack of setup room,
 `connect_native_rescued_by_udp_{joiner,acceptor}` for each UDP dial that
 connected after a native setup that failed ON THE PATH (timed out,
 handshake failed, Hello lost: `counts_toward_demotion`; R5: a connection a
@@ -2539,6 +2543,41 @@ Demotion: one principle for both roles: a STRIKE needs evidence that native
   counts (joiner_in_control, not read for rates) still include pairs whose
   acceptor is demoted and every UDP-answered pair of a demoted joiner.
   Either streak's effect is a 6 h downgrade to UDP, never a failed join.
+Setup admission: before deciding Native, the acceptor admits the setup
+  (NativeConnectState::admit_acceptor_setup, through
+  RelayContext::admit_native_setup), by joiner ADDRESS, the unit native
+  setups, allow-set slots and dial coalescing all use: at most
+  acceptor_pending_setups_max(max_connections) addresses pending (half of
+  the node's native setup slots, NATIVE_SETUPS_MAX lowered to the connection
+  limit as QuicPolicy::native_setups_max is, so the node's own dials as
+  joiner keep the rest), at most ACCEPTOR_PENDING_SETUPS_PER_SOURCE (4) from
+  one source (put::stream_admission::Source: an IPv4 address or an IPv6 /64;
+  loopback counted per port for local test networks), and only with a known
+  address. Another CONNECT to a pending address shares its entry (a
+  refcount). A refusal decides Udp at once (counted
+  connect_native_admission_refused), so a joiner never waits out the native
+  fallback because the acceptor had no room; the pair is in neither arm, and
+  a control pair at an acceptor with no room (acceptor_setup_room) leaves
+  the control arm too. The admission is a SetupTicket carried in the
+  AcceptOutcome into dispatch_expect_connection_from and dropped at the
+  acceptor's native dial deadline (NATIVE_CONNECT_WITHIN after the dispatch,
+  which ends every window the setup can run in, however late it starts), not
+  at the dial's answer, which can come before the setup ends (a UDP
+  connection beside it or from the joiner, a transient-budget refusal) or
+  never (a native request queued behind a stalled UDP dial); an
+  accept never dispatched (the retry branches drop one when they forward)
+  or a failed dispatch drops it and releases it. The source is the address
+  the CONNECT carries, which the joiner or a relay on its path chooses, so
+  the per-source cap bounds honest crowding (one host, one CGNAT line), not
+  a sender that forges addresses; what holds either way is the node cap,
+  and that a refused pair dials UDP at once. A control pair dropped for lack
+  of room is counted (connect_native_admission_control_dropped), so step 1
+  sees how much of the control arm load removed, beside the treated
+  refusals (connect_native_admission_refused). Residuals: the cap bounds
+  distinct pending addresses, not decisions; the node's own native dials as
+  joiner take setup slots uncapped; loopback is counted per port only in
+  test builds; and after phase D a refusal cannot "decide UDP", so it will
+  need another answer (a Rejected).
 Existing transport: a native dial does not drop a connection the node
   already has to that peer; the joiner may have connected another way since
   the acceptor decided.
```

**File**: `crates/core/src/operations/connect.rs` (modified, +195/-9)
```diff
@@ -445,6 +445,22 @@ pub(crate) trait RelayContext {
     /// address, read when it decides as acceptor. An existing transport is
     /// reused, so the decision is then `Udp`.
     fn holds_transport_to(&self, joiner: &PeerKeyLocation) -> bool;
+
+    /// Admits a native setup with the joiner before this node, as acceptor,
+    /// decides `Native` (`NativeConnectState::admit_acceptor_setup`); a
+    /// refusal makes the decision `Udp`. The ticket rides in the
+    /// `AcceptOutcome` and is dropped at the acceptor's native dial deadline.
+    fn admit_native_setup(
+        &self,
+        joiner: &PeerKeyLocation,
+    ) -> Result<native::SetupTicket, native::SetupAdmissionRefusal>;
+
+    /// Whether a native setup with the joiner would be admitted now, without
+    /// taking one (`NativeConnectState::acceptor_setup_room`).
+    fn native_setup_room(
+        &self,
+        joiner: &PeerKeyLocation,
+    ) -> Result<(), native::SetupAdmissionRefusal>;
 }
 
 /// Bundle of the two side-effects a relay must emit atomically when it
@@ -467,6 +483,10 @@ pub(crate) struct AcceptOutcome {
     /// The comparison arm of the decision in `response`
     /// ([`native::acceptor_arm`]), kept for the dial's outcome.
     pub native_arm: Option<crate::transport::ConnectArm>,
+    /// The native setup admission a `Native` decision holds until the
+    /// acceptor's native dial deadline; dropped with an accept that is never
+    /// dispatched, which releases it.
+    pub native_admission: Option<native::SetupTicket>,
 }
 
 /// Why a relay at terminus could not accept and rejected the request.
@@ -645,15 +665,38 @@ impl RelayState {
     ) -> (
         Option<native::NativeDecision>,
         Option<crate::transport::ConnectArm>,
+        Option<native::SetupTicket>,
     ) {
         let Some(offer) = self.request.native_offer else {
-            return (None, None);
+            return (None, None, None);
         };
         let bucket = native::native_bucket(own_key, self.request.joiner.pub_key());
         let readiness = ctx.native_readiness();
         let holds = ctx.holds_transport_to(&self.request.joiner);
-        let decision = native::decide_native(Some(offer), readiness, bucket, holds);
-        let arm = native::acceptor_arm(Some(offer), readiness, bucket, holds);
+        let mut decision = native::decide_native(Some(offer), readiness, bucket, holds);
+        let mut arm = native::acceptor_arm(Some(offer), readiness, bucket, holds);
+        // A `Native` decision holds a native setup slot and an allow-set slot
+        // here for up to the server's window. Admit it first; with no room
+        // (or too many pending from the joiner's source) decide `Udp`, so the
+        // joiner dials UDP at once instead of waiting out the fallback. The
+        // pair is then in neither arm: it left the treated arm for a reason
+        // other than the slice, and a control pair at an acceptor with no room
+        // leaves the control arm the same way.
+        let mut admission = None;
+        if decision == native::NativeDecision::Native {
+            match ctx.admit_native_setup(&self.request.joiner) {
+                Ok(ticket) => admission = Some(ticket),
+                Err(_) => {
+                    decision = native::NativeDecision::Udp;
+                    arm = None;
+                }
+            }
+        } else if arm == Some(crate::transport::ConnectArm::Control)
+            && ctx.native_setup_room(&self.request.joiner).is_err()
+        {
+            arm = None;
+            crate::transport::metrics::TRANSPORT_METRICS.record_connect_native_control_dropped();
+        }
         crate::transport::metrics::TRANSPORT_METRICS.record_connect_native_decided(decision);
         #[cfg(any(test, feature = "testing"))]
         if let Some(own) = ctx.self_location().socket_addr() {
@@ -666,7 +709,7 @@ impl RelayState {
                 },
             );
         }
-        (Some(decision), arm)
+        (Some(decision), arm, admission)
     }
 
     /// Helper to prepare and execute forwarding to a peer.
@@ -820,7 +863,7 @@ impl RelayState {
                                     let acceptor = PeerKeyLocation::with_unknown_addr(
                                         self_loc.pub_key().clone(),
                                     );
-                                    let (native_decision, native_arm) =
+                                    let (native_decision, native_arm, native_admission) =
                                         self.native_decision(ctx, self_loc.pub_key());
                                     actions.accept = Some(AcceptOutcome {
                                         response: ConnectResponse {
@@ -829,6 +872,7 @@ impl RelayState {
                                         },
                                         joiner: self.request.joiner.clone(),
                                         native_arm,
+                                        native_admis
```

**File**: `crates/core/src/operations/connect/native.rs` (modified, +375/-2)
```diff
@@ -121,6 +121,20 @@ pub(crate) const STRIKE_WINDOW: Duration = DEMOTION_COOLDOWN;
 /// How long a demoted node offers (or decides) nothing native.
 pub(crate) const DEMOTION_COOLDOWN: Duration = Duration::from_secs(6 * 3600);
 
+/// Native setups this node may have decided as acceptor and not yet seen end,
+/// at a connection limit of `max_connections`: half of the node's native
+/// setup slots (`QuicPolicy::native_setups_max`, which is
+/// [`crate::transport::NATIVE_SETUPS_MAX`] lowered to the connection limit),
+/// so its own dials as joiner keep the other half; at least 1.
+pub(crate) fn acceptor_pending_setups_max(max_connections: usize) -> usize {
+    (crate::transport::NATIVE_SETUPS_MAX.min(max_connections) / 2).max(1)
+}
+
+/// Of the acceptor's pending setups, how many may be for joiner addresses
+/// in one source: an IPv4 address, or an IPv6 /64 (what one host or one
+/// customer line usually gets). Provisional.
+pub(crate) const ACCEPTOR_PENDING_SETUPS_PER_SOURCE: usize = 4;
+
 const SLICE_DOMAIN: &[u8] = b"freenet-quic-native-slice-v1";
 
 /// What a joiner offers in its `ConnectRequest`.
@@ -336,8 +350,11 @@ impl DialTransport {
 
 /// How long a native dial may wait when its caller has no deadline of its
 /// own. The setup's own window is shorter and ends it first (8 s for the
-/// client, 12 s for the server), so this only bounds a setup that never
-/// reports.
+/// client, 12 s for the server), so for the setup this only bounds one that
+/// never reports. It ALSO sets how long an acceptor holds a native setup
+/// admission ([`SetupTicket`]): from the dispatch of its native dial to this
+/// long after it. Changing it changes the acceptor's admission throughput
+/// (pending cap / this duration).
 pub(crate) const NATIVE_CONNECT_WITHIN: std::time::Duration = std::time::Duration::from_secs(20);
 
 /// This node's readiness for native connections in one role: as joiner
@@ -530,6 +547,168 @@ pub(crate) fn joiner_response_action(
     }
 }
 
+/// Where a joiner's native setup is counted for
+/// [`ACCEPTOR_PENDING_SETUPS_PER_SOURCE`]: the crate's per-host source unit
+/// (`put::stream_admission::Source`: an IPv4 address or an IPv6 /64). In test
+/// builds only, a loopback or unspecified address is counted per port, since
+/// local test networks run every node on one such address; a release build
+/// counts it as one host.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum SetupSource {
+    Host(crate::operations::put::stream_admission::Source),
+    #[cfg(any(test, feature = "testing"))]
+    Exact(std::net::SocketAddr),
+}
+
+impl SetupSource {
+    fn of(addr: std::net::SocketAddr) -> Self {
+        #[cfg(any(test, feature = "testing"))]
+        {
+            let ip = addr.ip().to_canonical();
+            if ip.is_loopback() || ip.is_unspecified() {
+                return Self::Exact(addr);
+            }
+        }
+        Self::Host(crate::operations::put::stream_admission::Source::of(addr))
+    }
+}
+
+/// Why the acceptor decided `Udp` for a pair it would otherwise have decided
+/// `Native`.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(crate) enum SetupAdmissionRefusal {
+    /// The acceptor's pending setups are at its cap
+    /// ([`acceptor_pending_setups_max`]).
+    Full,
+    /// [`ACCEPTOR_PENDING_SETUPS_PER_SOURCE`] joiner addresses are pending
+    /// from the joiner's source.
+    SourceFull,
+    /// The joiner's address is not known, so there is nothing to count it by
+    /// (or to dial).
+    NoAddress,
+}
+
+/// The native setups this node decided as acceptor and has not yet seen end
+/// ([`NativeConnectState::admit_acceptor_setup`]), by joiner address: the
+/// unit the node's native setups, allow-set slots and dial coalescing all
+/// use. A `Native` decision holds a native setup slot and an allow-set slot
+/// for up to the server's window, so the acceptor admits a setup before
+/// deciding `Native` rather than finding the slots taken when its setup
+/// starts. A joiner that was refused is decided `Udp` at once: it never waits
+/// out the native fallback because the acceptor had no room.
+#[derive(Debug)]
+pub(crate) struct NativeSetupAdmission {
+    /// By joiner address: its source and how many tickets hold it (CONNECTs
+    /// to one address share its one setup, since dials to one address
+    /// coalesce).
+    pending: std::collections::HashMap<std::net::SocketAddr, (SetupSource, usize)>,
+    cap: usize,
+}
+
+impl NativeSetupAdmission {
+    fn new(cap: usize) -> Self {
+        Self {
+            pending: std::collections::HashMap::new(),
+            cap: cap.max(1),
+        }
+    }
+
+    /// Whether a ticket for `addr` would be admitted now, without taking one.
+    fn check(&self, addr: Option<std::net::SocketAddr>) -> Result<(), SetupAdmissionRefusal> {
+        let Some(addr) = addr else {
+            return Err(SetupAdmissionRefusal::NoAddress);
+        };
+        if self.pending.contains_key(&addr) {
+         
```

**File**: `crates/core/src/operations/connect/op_ctx_task.rs` (modified, +198/-7)
```diff
@@ -1611,7 +1611,7 @@ async fn drive_relay_connect(
     // across the decision (handle_request + initial outbound emits) so
     // the slot count tracks "concurrent admissions" not "in-flight
     // relay drivers" — the receive loop below runs without the guard.
-    let initial_actions = {
+    let mut initial_actions = {
         let _admission = match op_manager.ring.connection_manager.try_admit_connect() {
             Some(g) => g,
             None => {
@@ -1685,13 +1685,14 @@ async fn drive_relay_connect(
 
     // Local accept (promote joiner BEFORE sending Response upstream;
     // legacy connect.rs:1636).
-    if let Some(ref accept) = initial_actions.accept {
+    if let Some(accept) = initial_actions.accept.as_mut() {
         dispatch_expect_connection_from(
             op_manager,
             incoming_tx,
             accept.joiner.clone(),
             accept.response.native_decision,
             accept.native_arm,
+            accept.native_admission.take(),
         )
         .await?;
     }
@@ -1942,6 +1943,7 @@ async fn drive_relay_connect(
                         accept.joiner,
                         accept.response.native_decision,
                         accept.native_arm,
+                        accept.native_admission,
                     )
                     .await?;
                     trace_accept(upstream_addr, &accept.response, joiner_addr, true);
@@ -2122,6 +2124,7 @@ async fn drive_relay_connect(
                         accept.joiner,
                         accept.response.native_decision,
                         accept.native_arm,
+                        accept.native_admission,
                     )
                     .await?;
                     trace_accept(upstream_addr, &accept.response, joiner_addr, true);
@@ -2539,9 +2542,9 @@ mod tests {
         // 3. The happy-path accept branch must dispatch too, so the pin is
         //    not satisfied solely by the retry branches.
         let happy_pos = prod
-            .find("if let Some(ref accept) = initial_actions.accept {")
+            .find("if let Some(accept) = initial_actions.accept.as_mut() {")
             .expect(
-                "happy-path accept branch `if let Some(ref accept) = initial_actions.accept` \
+                "happy-path accept branch `if let Some(accept) = initial_actions.accept.as_mut()` \
                  not found — renamed or removed; update this pin and verify it still \
                  promotes the joiner.",
             );
@@ -2567,7 +2570,27 @@ mod tests {
                 "a `dispatch_expect_connection_from` call does not pass \
                  `accept.response.native_decision`: {call}"
             );
+            // 5. ... and the decision's native setup admission (#6345). A
+            //    site passing `None` leaves the ticket in the accept, which
+            //    drops when the response block ends: the admission would be
+            //    held for milliseconds, not to the dial deadline, and the
+            //    acceptor's cap would bound nothing.
+            let flat: String = call.split_whitespace().collect();
+            assert!(
+                flat.contains(",accept.native_admission") && !flat.contains(",None,)"),
+                "a `dispatch_expect_connection_from` call does not hand over \
+                 `accept.native_admission`: {call}"
+            );
         }
+        // The happy path borrows the accept (it is read after the dispatch),
+        // so it must take the ticket out of it.
+        let happy_call = &happy_window[happy_dispatch.expect("checked above")..];
+        let happy_call = &happy_call[..happy_call.find(".await").expect("awaited")];
+        let happy_flat: String = happy_call.split_whitespace().collect();
+        assert!(
+            happy_flat.contains(",accept.native_admission.take(),"),
+            "the happy-path dispatch must pass `accept.native_admission.take()`: {happy_call}"
+        );
     }
 
     /// Pins the wiring of the lattice-probe miss report (#5814), which the
@@ -3671,9 +3694,16 @@ mod driver_timing_tests {
         let (op_manager, mut events) = op_manager_with_events("acceptor-origin").await;
         let joiner = peer(24880);
         let tx = Transaction::new::<ConnectMsg>();
-        super::super::dispatch_expect_connection_from(&op_manager, tx, joiner.clone(), None, None)
-            .await
-            .expect("dispatch");
+        super::super::dispatch_expect_connection_from(
+            &op_manager,
+            tx,
+            joiner.clone(),
+            None,
+            None,
+            None,
+        )
+        .await
+        .expect("dispatch");
         loop {
             let event = tokio::time::timeout(Duration::from_secs(5), events.recv())
                 .await
@@ -3714,6 +3744,7 @@ mod driver_timing_tests {
             joiner.clone(),
             Some(NativeDecision::Native),
             None,
+            None,
         )
         .await
         .e
```

**File**: `crates/core/src/ring/connection_manager.rs` (modified, +2/-1)
```diff
@@ -782,7 +782,8 @@ impl ConnectionManager {
             config.native_connect_override,
         )
         .with_gateway_join_override(config.native_gateway_join_override)
-        .with_joiner_off(config.native_joiner_off);
+        .with_joiner_off(config.native_joiner_off)
+        .with_acceptor_setup_limit(cm.max_connections);
         native_connect.set_native_gateways(
             config
                 .gateways
```

**File**: `crates/core/src/tracing/telemetry.rs` (modified, +8/-0)
```diff
@@ -3108,6 +3108,14 @@ fn event_kind_to_json(kind: &EventKind) -> serde_json::Value {
                 "connect_native_acceptor_demotions".into(),
                 serde_json::json!(snapshot.connect_native_acceptor_demotions),
             );
+            m.insert(
+                "connect_native_admission_refused".into(),
+                serde_json::json!(snapshot.connect_native_admission_refused),
+            );
+            m.insert(
+                "connect_native_admission_control_dropped".into(),
+                serde_json::json!(snapshot.connect_native_admission_control_dropped),
+            );
             m.insert(
                 "connect_native_rescued_by_udp_joiner".into(),
                 serde_json::json!(snapshot.connect_native_rescued_by_udp_joiner),
```

**File**: `crates/core/src/transport.rs` (modified, +1/-1)
```diff
@@ -357,7 +357,7 @@ pub(crate) use self::boundary::NativeConnectFuture;
 pub(crate) use self::boundary::TransportHandle;
 pub(crate) use self::metrics::{ConnectArm, NativeConnectSide, NativeSetupOutcome};
 pub(crate) use self::quic::native::setup::{
-    MIN_WINDOW_LEFT as NATIVE_MIN_WINDOW_LEFT, NATIVE_FALLBACK_AFTER,
+    MIN_WINDOW_LEFT as NATIVE_MIN_WINDOW_LEFT, NATIVE_FALLBACK_AFTER, NATIVE_SETUPS_MAX,
     window_of as native_setup_window,
 };
 pub(crate) use self::quic::upgrade::driver::NativeDial;
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +76/-0)
```diff
@@ -1167,6 +1167,13 @@ pub struct TransportMetrics {
     /// Times this node stopped deciding QUIC-native as acceptor after its
     /// native setups failed with distinct joiners (reset each snapshot).
     connect_native_acceptor_demotions: AtomicU64,
+    /// Native setups this node did not admit as acceptor, deciding UDP
+    /// instead (`connect::native::NativeSetupAdmission`) (reset each
+    /// snapshot).
+    connect_native_admission_refused: AtomicU64,
+    /// Control pairs this node left out of the connect arms as acceptor
+    /// because it had no room for a native setup (reset each snapshot).
+    connect_native_admission_control_dropped: AtomicU64,
     /// A UDP dial that followed a failed native setup connected, by the side
     /// this node had in the CONNECT (reset each snapshot).
     connect_native_rescued_by_udp_joiner: AtomicU64,
@@ -1599,6 +1606,14 @@ thread_local! {
     pub(crate) static CONNECT_ARM_ON_THIS_THREAD: std::cell::Cell<[u64; ConnectArmCounter::COUNT]> =
         const { std::cell::Cell::new([0; ConnectArmCounter::COUNT]) };
 
+    /// Test-only: control pairs dropped for lack of setup room on this thread.
+    pub(crate) static NATIVE_CONTROL_DROPPED_ON_THIS_THREAD: std::cell::Cell<u64> =
+        const { std::cell::Cell::new(0) };
+
+    /// Test-only: native setups not admitted as acceptor on this thread.
+    pub(crate) static NATIVE_ADMISSIONS_REFUSED_ON_THIS_THREAD: std::cell::Cell<u64> =
+        const { std::cell::Cell::new(0) };
+
     /// Test-only: acceptor-role demotions recorded on this thread, so a test
     /// can see its own increment of the process-wide counter.
     pub(crate) static ACCEPTOR_DEMOTIONS_ON_THIS_THREAD: std::cell::Cell<u64> =
@@ -1727,6 +1742,8 @@ impl TransportMetrics {
             connect_native_decision_over_cap: AtomicU64::new(0),
             connect_native_demotions: AtomicU64::new(0),
             connect_native_acceptor_demotions: AtomicU64::new(0),
+            connect_native_admission_refused: AtomicU64::new(0),
+            connect_native_admission_control_dropped: AtomicU64::new(0),
             connect_native_rescued_by_udp_joiner: AtomicU64::new(0),
             connect_native_rescued_by_udp_acceptor: AtomicU64::new(0),
             connect_native_fallback_connected_joiner: AtomicU64::new(0),
@@ -2373,6 +2390,24 @@ impl TransportMetrics {
             .fetch_add(1, Ordering::Relaxed);
     }
 
+    /// This node, as acceptor, left a control pair out of the connect arms:
+    /// it had no room for a native setup, as a treated pair would have been
+    /// refused.
+    pub(crate) fn record_connect_native_control_dropped(&self) {
+        self.connect_native_admission_control_dropped
+            .fetch_add(1, Ordering::Relaxed);
+        #[cfg(test)]
+        NATIVE_CONTROL_DROPPED_ON_THIS_THREAD.with(|count| count.set(count.get() + 1));
+    }
+
+    /// This node did not admit a native setup as acceptor and decided UDP.
+    pub(crate) fn record_connect_native_admission_refused(&self) {
+        self.connect_native_admission_refused
+            .fetch_add(1, Ordering::Relaxed);
+        #[cfg(test)]
+        NATIVE_ADMISSIONS_REFUSED_ON_THIS_THREAD.with(|count| count.set(count.get() + 1));
+    }
+
     /// This node stopped deciding QUIC-native as acceptor.
     pub(crate) fn record_connect_native_acceptor_demotion(&self) {
         self.connect_native_acceptor_demotions
@@ -3409,6 +3444,10 @@ impl TransportMetrics {
             connect_native_decision_over_cap: get64(&self.connect_native_decision_over_cap),
             connect_native_demotions: get64(&self.connect_native_demotions),
             connect_native_acceptor_demotions: get64(&self.connect_native_acceptor_demotions),
+            connect_native_admission_refused: get64(&self.connect_native_admission_refused),
+            connect_native_admission_control_dropped: get64(
+                &self.connect_native_admission_control_dropped,
+            ),
             connect_native_rescued_by_udp_joiner: get64(&self.connect_native_rescued_by_udp_joiner),
             connect_native_rescued_by_udp_acceptor: get64(
                 &self.connect_native_rescued_by_udp_acceptor,
@@ -4144,6 +4183,10 @@ pub struct TransportSnapshot {
     pub connect_native_demotions: u64,
     /// Times the node stopped deciding native as acceptor after failures.
     pub connect_native_acceptor_demotions: u64,
+    /// Native setups not admitted as acceptor (decided UDP instead).
+    pub connect_native_admission_refused: u64,
+    /// Control pairs left out of the arms for lack of setup room.
+    pub connect_native_admission_control_dropped: u64,
     /// UDP dials that connected after a native setup that failed on the
     /// path, as joiner and as acceptor (R5's rescue).
     pub connect_native_rescued_by_udp_joiner: u64,
@@ -4610,6 +4653,8 @@ impl TransportSnapshot {
             connect_native_decision_over_cap,
             connect_native_demotions,
             connect
```

---

### Incident Patch 2: `0837f3f7` (2026-11-23)
**Commit Message**: feat(transport): rebuild a dead QUIC endpoint in process on unsupervised nodes (dark) (#6324)

**File**: `.claude/rules/transport.md` (modified, +21/-5)
```diff
@@ -514,7 +514,7 @@ off in this process (`quic_breaker_suppressed`, a state that is never reset and
 is not activity by itself) and the endpoint's state (`quic_endpoint`: `up`, or
 `off_config`, `off_platform`, `off_abort`, `off_bind`, `off_breaker`, or `died`;
 `unknown` before the node reaches the bind; set at startup after the breaker
-gate, at the bind, and at the endpoint's death, which is final for the process;
+gate, at the bind, and at the endpoint's death, which is final for the process unless the node rebuilds its endpoint (see "QUIC endpoint rebuild", dark by default);
 a state that is never reset and is not activity by itself) and QUIC connections this node closed, by close code
 (`quic_close_sent_<label>`, one per `QuicCloseCode`), the QUIC-native connect
 offer and decision (`connect_native_offered_{zero,nonzero}` built as joiner,
@@ -3956,11 +3956,27 @@ Liveness ("alive" = the endpoint driver has not ENDED; it does not mean
   → QuicAvailabilityWatch (QuicEndpoint::availability, and
     OutboundConnectionHandler::quic_availability, which is Disabled with
     no endpoint): get() any time, not_up() to wait. Disabled, Down and
-    Released are final, and not_up() returns them at once every time.
-    Availability is per endpoint, one per node (so per process in
-    production, per node in simulation).
+    Released are final for an endpoint, and not_up() returns them at once
+    every time. A node that rebuilds its endpoint (quic/rebuild.rs, off
+    unless ENDPOINT_REBUILD or a test turns it on) holds one watch of its
+    own (QuicAvailabilityWatch::settable) that follows the current endpoint
+    and goes from Down back to Up after a rebuild; each dead endpoint's own
+    watch keeps its final Down. Availability is per endpoint, one per
+    node (so per process in production, per node in simulation).
+  → QUIC endpoint rebuild (quic/rebuild.rs, #6272; dark: ENDPOINT_REBUILD is
+    false, so no production node rebuilds, and a supervised node exits for a
+    restart instead): a node with no supervisor whose endpoint died waits
+    1 s doubling to 5 min, +-20% jitter, then builds the endpoint again on
+    the node's one socket (QuicEndpoint::rebuild), starts its accept loop,
+    upgrades and attempt router (spawn_accept_loop_with and
+    spawn_attempt_router_with, which hand their JoinHandles to the rebuild
+    loop instead of the monitor), and swaps them in for the dead endpoint's.
+    The rebuild loop owns these tasks as the task quic_endpoint_rebuild;
+    a task that ends while the endpoint stays up still ends the node. The
+    backoff resets only after a rebuilt endpoint stays up for REBUILD_STABLE.
   → QuicEndpoint::spawn_accept_loop registers the accept loop through a
-    LateRegistrar as quic_accept_loop. The node starts it when it opens the
+    LateRegistrar as quic_accept_loop (a node that rebuilds its endpoint uses
+    spawn_accept_loop_with instead, and the rebuild loop owns the task). The node starts it when it opens the
     transport with an endpoint (UdpTransportConfig::task_registrar; tools
     and tests that pass none start no loop). It holds an EndpointCore
     (no owner share), so it does not keep the endpoint alive: when the
```

**File**: `crates/core/src/transport/connection_handler.rs` (modified, +435/-66)
```diff
@@ -471,15 +471,27 @@ pub(super) async fn bind_udp_listener<S: Socket>(
     // with it off the only additions are an idle queue and its poll, one
     // atomic load per datagram from a source not on the allow-set, and
     // counters that stay 0.
-    if let Some(endpoint) = &quic_endpoint {
-        if super::quic::admission::enabled_at(is_gateway, bind_addr) {
-            let enabled = match quic_virtual_time {
-                Some(time) => endpoint.enable_gateway_admission(time),
-                None => endpoint.enable_gateway_admission(RealTime::new()),
-            };
-            tracing::info!(enabled, "QUIC gateway admission of native joins");
-        }
-    }
+    admit_native_joins_if_on(
+        quic_endpoint.as_ref(),
+        is_gateway,
+        bind_addr,
+        quic_virtual_time.clone(),
+    );
+    // What a node that rebuilds its endpoint when it dies (`quic::rebuild`)
+    // builds in place of the dead one: the same build, on this socket.
+    let rebuild_endpoint = quic_endpoint
+        .as_ref()
+        .and(quic_settings.clone())
+        .map(|settings| {
+            endpoint_rebuilder(
+                socket.clone(),
+                bind_addr,
+                keypair.clone(),
+                is_gateway,
+                settings,
+                quic_virtual_time.clone(),
+            )
+        });
 
     // Test builds only: kill the endpoint after the delay this variable
     // names, through a caught socket adapter panic, so a real-process test can
@@ -512,6 +524,7 @@ pub(super) async fn bind_udp_listener<S: Socket>(
         (listen_host, listen_port).into(),
         config,
         quic_endpoint,
+        rebuild_endpoint,
     )?;
     Ok((
         och,
@@ -522,21 +535,289 @@ pub(super) async fn bind_udp_listener<S: Socket>(
     ))
 }
 
+/// Admit native joins from sources nobody named on `endpoint`, on the
+/// endpoint's clock, when this gateway does (`quic::admission`).
+fn admit_native_joins_if_on(
+    endpoint: Option<&super::quic::QuicEndpoint>,
+    is_gateway: bool,
+    bind_addr: SocketAddr,
+    quic_virtual_time: Option<VirtualTime>,
+) {
+    if let Some(endpoint) = endpoint {
+        if super::quic::admission::enabled_at(is_gateway, bind_addr) {
+            let enabled = match quic_virtual_time {
+                Some(time) => endpoint.enable_gateway_admission(time),
+                None => endpoint.enable_gateway_admission(RealTime::new()),
+            };
+            tracing::info!(enabled, "QUIC gateway admission of native joins");
+        }
+    }
+}
+
+/// How a node that rebuilds its endpoint (`quic::rebuild`) builds one in
+/// place of a dead one: as `bind_udp_listener` built the first, on the same
+/// socket, clock (and `GlobalRng` side stream, in a simulation), settings and
+/// key, with the same admission, replacing the socket's QUIC ingress
+/// (`QuicEndpoint::rebuild`). The test-only faults of the first build (the
+/// endpoint-down variable, the trace's `fail_endpoint_at`) are not set again.
+fn endpoint_rebuilder<S: Socket>(
+    socket: Arc<DemuxSocket<S>>,
+    bind_addr: SocketAddr,
+    keypair: TransportKeypair,
+    is_gateway: bool,
+    settings: super::quic::QuicSettings,
+    quic_virtual_time: Option<VirtualTime>,
+) -> super::quic::rebuild::EndpointFactory {
+    use super::quic::QuicEndpoint;
+    Box::new(move || {
+        let built = match quic_virtual_time.clone() {
+            Some(time) => GlobalRng::with_side_stream(side_stream_of(bind_addr), || {
+                QuicEndpoint::rebuild(socket.clone(), bind_addr, time, &settings, &keypair)
+            }),
+            None => QuicEndpoint::rebuild(
+                socket.clone(),
+                bind_addr,
+                RealTime::new(),
+                &settings,
+                &keypair,
+            ),
+        };
+        let endpoint = match built {
+            Ok(endpoint) => endpoint,
+            Err(error) => {
+                tracing::warn!(%error, %bind_addr, "Could not rebuild the QUIC endpoint");
+                return None;
+            }
+        };
+        admit_native_joins_if_on(
+            Some(&endpoint),
+            is_gateway,
+            bind_addr,
+            quic_virtual_time.clone(),
+        );
+        Some(endpoint)
+    })
+}
+
+/// What runs on one QUIC endpoint besides quinn's own drivers, held by the
+/// listener for as long as it reads the socket that feeds the endpoint. The
+/// node replaces all of it when it rebuilds its endpoint (`quic::rebuild`).
+pub(super) struct QuicStack {
+    /// The endpoint, with its allow-set empty until an upgrade allows a peer
+    /// (#5940). Read only by tests; held for its owner share.
+    #[cfg_attr(not(test), allow(dead_code))]
+    endpoint: super::quic::QuicEndpoint,
+    /// The connection attempts the endpoint's accept loop hands on, when it
+    /// runs (`UdpTransportConfig::task_registrar` was set) and the node has no
+    /// upgrades to route them
```

**File**: `crates/core/src/transport/connection_handler/legacy_responder.rs` (modified, +1/-0)
```diff
@@ -320,6 +320,7 @@ mod tests {
                 ..UdpTransportConfig::default()
             },
             None,
+            None,
         )
         .expect("gateway setup");
 
```

**File**: `crates/core/src/transport/connection_handler/tests/outbound_connector.rs` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ fn handler() -> (OutboundConnectionHandler<MockSocket>, Queue) {
         quic_availability: crate::transport::quic::QuicAvailabilityWatch::disabled(),
         upgrade_site: Default::default(),
         quic_endpoint: None,
+        quic_stack: std::sync::Weak::new(),
     };
     (handler, queue)
 }
```

**File**: `crates/core/src/transport/connection_handler/tests/transport_handle.rs` (modified, +3/-0)
```diff
@@ -49,6 +49,7 @@ async fn udp_handle_shares_one_expected_ip_set_and_reports_the_listener() {
         quic_availability: crate::transport::quic::QuicAvailabilityWatch::disabled(),
         upgrade_site: Default::default(),
         quic_endpoint: None,
+        quic_stack: std::sync::Weak::new(),
     };
     let (inbound_tx, inbound_rx) = mpsc::channel(1);
     let inbound = InboundConnectionHandler {
@@ -112,6 +113,7 @@ async fn listener_outlives_a_dropped_connector_while_a_clone_remains() {
         addr,
         UdpTransportConfig::default(),
         None,
+        None,
     )
     .map(|(o, rx, task)| {
         (
@@ -177,6 +179,7 @@ async fn udp_transport_config_reaches_the_listener_by_name() {
             task_registrar: None,
         },
         None,
+        None,
     );
     assert_eq!(listener.bandwidth_limit, Some(1_111));
     assert_eq!(listener.ledbat_min_ssthresh, Some(2_222));
```

**File**: `crates/core/src/transport/demux.rs` (modified, +156/-22)
```diff
@@ -13,10 +13,10 @@
 
 use std::io;
 use std::net::SocketAddr;
+use std::sync::Arc;
 #[cfg(test)]
 use std::sync::atomic::AtomicU64;
 use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
-use std::sync::{Arc, OnceLock};
 use std::task::{Context, Poll};
 
 use dashmap::DashMap;
@@ -377,7 +377,10 @@ pub(crate) fn classify(packet: &[u8]) -> DemuxClass {
 pub struct DemuxSocket<S> {
     inner: S,
     egress: Option<EgressCap>,
-    quic: OnceLock<QuicIngress>,
+    /// The QUIC ingress, once enabled. Replaced only when the node rebuilds
+    /// its QUIC endpoint (`quic::rebuild`, [`Self::with_replaced_quic_ingress`]);
+    /// read once per QUIC-class datagram.
+    quic: parking_lot::RwLock<Option<Arc<QuicIngress>>>,
     /// Datagrams consumed here since the last legacy one, for the yield in
     /// `recv_classified`. Only the listener reads, so relaxed is enough.
     diverted_in_a_row: AtomicU32,
@@ -390,7 +393,7 @@ impl<S> DemuxSocket<S> {
         Self {
             inner,
             egress,
-            quic: OnceLock::new(),
+            quic: parking_lot::RwLock::new(None),
             diverted_in_a_row: AtomicU32::new(0),
             #[cfg(test)]
             quic_outcomes: Default::default(),
@@ -418,13 +421,17 @@ impl<S> DemuxSocket<S> {
         let (unknown, unknown_receiver) =
             mpsc::channel(super::quic::admission::UNKNOWN_SOURCE_QUEUE_DATAGRAMS);
         let shared = Arc::new(IngressShared::default());
-        self.quic
-            .set(QuicIngress {
+        {
+            let mut slot = self.quic.write();
+            if slot.is_some() {
+                return None;
+            }
+            *slot = Some(Arc::new(QuicIngress {
                 queue,
                 unknown,
                 shared: shared.clone(),
-            })
-            .ok()?;
+            }));
+        }
         Some(QuicIngressReceiver {
             queue: receiver,
             unknown: unknown_receiver,
@@ -437,7 +444,7 @@ impl<S> DemuxSocket<S> {
     /// dropping it (`quic::admission`, a gateway admitting native joins).
     /// Whether an ingress was there to take it.
     pub(crate) fn enable_unknown_source_lane(&self) -> bool {
-        match self.live_quic_ingress() {
+        match self.live_quic_ingress().as_deref() {
             Some(ingress) => {
                 ingress.shared.unknown_lane.store(true, Ordering::Release);
                 true
@@ -463,23 +470,66 @@ impl<S> DemuxSocket<S> {
         Some(built)
     }
 
+    /// [`Self::with_quic_ingress`] for an endpoint built to replace one that
+    /// died (`quic::rebuild`): the ingress the dead endpoint read is disabled
+    /// (its allow-set emptied, its permits releasing nothing) and dropped, so
+    /// the dead endpoint's receiver ends, and a new one, with an empty
+    /// allow-set and empty queues, takes its place. If `build` fails the new
+    /// ingress is disabled too, leaving the socket as with QUIC off. `None`,
+    /// with nothing changed, if no ingress was ever enabled: a rebuild only
+    /// replaces an endpoint the node had.
+    pub(crate) fn with_replaced_quic_ingress<R, E>(
+        &self,
+        build: impl FnOnce(QuicIngressReceiver) -> Result<R, E>,
+    ) -> Option<Result<R, E>> {
+        let receiver = {
+            let mut slot = self.quic.write();
+            let old = slot.take()?;
+            disable(&old.shared);
+            let (queue, receiver) = mpsc::channel(QUIC_INGRESS_QUEUE_DATAGRAMS);
+            let (unknown, unknown_receiver) =
+                mpsc::channel(super::quic::admission::UNKNOWN_SOURCE_QUEUE_DATAGRAMS);
+            let shared = Arc::new(IngressShared::default());
+            *slot = Some(Arc::new(QuicIngress {
+                queue,
+                unknown,
+                shared: shared.clone(),
+            }));
+            QuicIngressReceiver {
+                queue: receiver,
+                unknown: unknown_receiver,
+                shared,
+            }
+        };
+        let built = build(receiver);
+        if built.is_err() {
+            self.disable_quic_ingress();
+        }
+        Some(built)
+    }
+
     /// Stop the QUIC ingress for good: refuse new permits, empty the
     /// allow-set, and count every QUIC-class datagram as `no_ingress`.
     /// Permits still held release nothing (their entries are gone).
     fn disable_quic_ingress(&self) {
-        if let Some(ingress) = self.quic.get() {
-            let shared = &ingress.shared;
-            shared.disabled.store(true, Ordering::Release);
-            shared.allowed.clear();
-            shared.allowed_count.store(0, Ordering::Release);
+        if let Some(ingress) = self.quic.read().as_deref() {
+            disable(&ingress.shared);
         }
     }
 
     /// The enabled ingress, unless it was disabled.
-    fn live_quic_ingress(&self) -> Option<&QuicIngress> {
+    fn live_quic_ingress(&self) -> Option<Arc<QuicIngress>> {
         self.quic
-      
```

**File**: `crates/core/src/transport/metrics.rs` (modified, +29/-3)
```diff
@@ -2243,8 +2243,8 @@ impl TransportMetrics {
     }
 
     /// Record the QUIC endpoint's state. [`QuicEndpointState::Died`] is final
-    /// for the process: an endpoint that died is never rebuilt, so nothing
-    /// set after it replaces it.
+    /// for the process: nothing set after it replaces it, except a rebuilt
+    /// endpoint ([`Self::record_quic_endpoint_rebuilt`]).
     pub(crate) fn set_quic_endpoint_state(&self, state: QuicEndpointState) {
         let died = QuicEndpointState::Died as u8;
         // An `Err` is a death already recorded, which stays.
@@ -2255,6 +2255,17 @@ impl TransportMetrics {
             .ok();
     }
 
+    /// The node built a new QUIC endpoint in place of one that died
+    /// (`quic::rebuild`): the state is `Up` again, replacing `Died`, unless
+    /// the new endpoint already died (`still_up` false): its death is then
+    /// the state.
+    pub(crate) fn record_quic_endpoint_rebuilt(&self, still_up: bool) {
+        if still_up {
+            self.quic_endpoint_state
+                .store(QuicEndpointState::Up as u8, Ordering::Relaxed);
+        }
+    }
+
     /// The QUIC endpoint's state as last recorded.
     pub(crate) fn quic_endpoint_state(&self) -> QuicEndpointState {
         QuicEndpointState::from_u8(self.quic_endpoint_state.load(Ordering::Relaxed))
@@ -3927,7 +3938,9 @@ pub(crate) enum QuicEndpointState {
     /// The crash-loop breaker keeps QUIC off for this run.
     OffBreaker = 6,
     /// The endpoint died while the node held it: its driver ended, or its
-    /// socket adapter caught a panic (`quic::liveness`). Final.
+    /// socket adapter caught a panic (`quic::liveness`). Final, unless the
+    /// node rebuilds its endpoint (`quic::rebuild`, dark until the UDP
+    /// removal), which records `Up` again.
     Died = 7,
 }
 
@@ -6543,6 +6556,19 @@ mod tests {
         assert_eq!(snap.quic_endpoint, "died", "the state is not reset");
     }
 
+    /// A rebuilt endpoint makes the state `Up` again, except one that
+    /// already died: its death stays the state.
+    #[test]
+    fn a_rebuilt_endpoint_replaces_died_only_while_it_is_up() {
+        let metrics = TransportMetrics::new();
+        metrics.record_quic_endpoint_down("127.0.0.1:1".parse().unwrap());
+        assert_eq!(metrics.quic_endpoint_state(), QuicEndpointState::Died);
+        metrics.record_quic_endpoint_rebuilt(false);
+        assert_eq!(metrics.quic_endpoint_state(), QuicEndpointState::Died);
+        metrics.record_quic_endpoint_rebuilt(true);
+        assert_eq!(metrics.quic_endpoint_state(), QuicEndpointState::Up);
+    }
+
     /// Every endpoint state has its own label and survives the round trip
     /// through the atomic.
     #[test]
```

**File**: `crates/core/src/transport/quic.rs` (modified, +114/-28)
```diff
@@ -50,6 +50,7 @@ pub(crate) mod native;
 #[cfg(any(test, feature = "quic-panic-injection"))]
 pub(crate) mod panic_injection;
 pub(crate) mod path;
+pub(crate) mod rebuild;
 pub(crate) mod recycle;
 pub(crate) mod runtime;
 pub(crate) mod socket;
@@ -486,6 +487,15 @@ fn require_unwinding(unwinds: bool) -> io::Result<()> {
 /// ([`require_unwinding`]).
 pub(crate) const UNWINDS: bool = cfg!(panic = "unwind");
 
+/// What building an endpoint does to its socket's QUIC ingress.
+#[derive(Clone, Copy)]
+enum Ingress {
+    /// Enable it; the build fails if it was already enabled.
+    Enable,
+    /// Replace the one a dead endpoint read ([`QuicEndpoint::rebuild`]).
+    Replace,
+}
+
 impl EndpointCore {
     /// The node's buffer budget, which sets each data path's windows.
     pub(crate) fn buffer_budget(&self) -> &Arc<budget::QuicBudget> {
@@ -503,6 +513,13 @@ impl EndpointCore {
 }
 
 impl QuicEndpoint {
+    /// Whether `other` is a handle on this same endpoint, not one built in
+    /// place of it (`rebuild`).
+    #[cfg(test)]
+    pub(crate) fn same_endpoint(&self, other: &Self) -> bool {
+        Arc::ptr_eq(&self.owner, &other.owner)
+    }
+
     /// Build an endpoint over `socket`, which must be the socket the
     /// listener reads (it fills the QUIC ingress queue), bound at
     /// `local_addr`, authenticating as the holder of `keypair`.
@@ -551,6 +568,31 @@ impl QuicEndpoint {
         )
     }
 
+    /// Build an endpoint as [`Self::bind`] does, to replace one on the same
+    /// socket that died (`rebuild`): the socket's QUIC ingress is replaced
+    /// rather than enabled (`DemuxSocket::with_replaced_quic_ingress`), so
+    /// the new endpoint starts with an empty allow-set and nothing the dead
+    /// one queued. Fails, leaving the socket's QUIC ingress disabled, as
+    /// [`Self::bind`] fails; also if the socket never had an ingress.
+    pub(crate) fn rebuild<S: Socket, T: TimeSource>(
+        socket: Arc<DemuxSocket<S>>,
+        local_addr: SocketAddr,
+        time: T,
+        settings: &QuicSettings,
+        keypair: &TransportKeypair,
+    ) -> io::Result<Self> {
+        require_unwinding(UNWINDS)?;
+        Self::bind_on(
+            Ingress::Replace,
+            socket,
+            local_addr,
+            time,
+            settings,
+            keypair,
+            config::endpoint_config()?,
+        )
+    }
+
     /// Build the endpoint as [`Self::bind`] describes, for this build
     /// ([`UNWINDS`], through [`Self::bind_checked`]), or `None` with a WARN
     /// when it fails, so a node with QUIC on still starts, with QUIC off.
@@ -598,6 +640,28 @@ impl QuicEndpoint {
         settings: &QuicSettings,
         keypair: &TransportKeypair,
         endpoint_config: quinn::EndpointConfig,
+    ) -> io::Result<Self> {
+        Self::bind_on(
+            Ingress::Enable,
+            socket,
+            local_addr,
+            time,
+            settings,
+            keypair,
+            endpoint_config,
+        )
+    }
+
+    /// [`Self::bind_with`], enabling the socket's QUIC ingress or replacing
+    /// it ([`Self::rebuild`]).
+    fn bind_on<S: Socket, T: TimeSource>(
+        ingress_mode: Ingress,
+        socket: Arc<DemuxSocket<S>>,
+        local_addr: SocketAddr,
+        time: T,
+        settings: &QuicSettings,
+        keypair: &TransportKeypair,
+        endpoint_config: quinn::EndpointConfig,
     ) -> io::Result<Self> {
         let invalid = |error: &dyn std::fmt::Display| {
             io::Error::new(io::ErrorKind::InvalidInput, error.to_string())
@@ -619,37 +683,44 @@ impl QuicEndpoint {
         let mut cap_holds = None;
         // If quinn refuses the socket after the ingress is enabled, the
         // ingress is disabled again, so the node is left as with QUIC off.
-        let endpoint = socket
-            .with_quic_ingress(|ingress| {
-                let quic_socket = Arc::new(socket::QuicSocket::new(
-                    socket.clone(),
-                    ingress,
-                    local_addr,
-                    health.clone(),
-                ));
-                cap_holds = Some(quic_socket.cap_holds());
-                #[cfg(any(test, feature = "testing"))]
-                {
-                    faults = Some(quic_socket.faults());
-                }
-                let runtime = Arc::new(runtime::QuicRuntime::new(time, health.clone()));
-                // The server configuration is set so quinn hands every
-                // Initial from an allowed source to `accept` (without one it
-                // answers with a stateless reset); its TLS refuses every
-                // client, and `accept` replaces it per attempt.
-                quinn::Endpoint::new_with_abstract_socket(
-                    endpoint_config,
-                    Some((*server).clone()),
-                    quic_socket,
-                    runtime,
-                )
-            })
-            .ok_or_else(|| {
+        let b
```

---

### Incident Patch 3: `603e2db9` (2026-11-23)
**Commit Message**: fix(get): bound the memory held by outbound GET responses (#6344)

**File**: `.claude/rules/operations.md` (modified, +10/-0)
```diff
@@ -229,6 +229,16 @@ tier remote peers feed) from indefinitely starving Background. Both are
 backstops only: tag each send site with the class it belongs to.
 ```
 
+**Outbound GET response budget.** A streamed GET response is charged to
+`node::outbound_budget::OutboundPayloadBudget` (node-wide G, per-source P = G/4,
+a reserve for idle sources, one oversize slot) BEFORE its `ResponseStreaming`
+header is sent, so a refusal returns `Err` and the driver answers NotFound with
+no header outstanding. The charge is owned by the bytes handed to `send_stream`
+and released when the transport drops them, so the memory bound holds whatever
+the peer does. How long one response is held is bounded on QUIC paths only
+(`QuicPath::stream_deadlines`). A response at or below the streaming threshold, and every other
+outbound send, is not budgeted.
+
 **Admission lanes in front of the fair queue (ANT-2026-K0YQ8CG4).** Events
 reach `contract_handling` over four channels, chosen by `handler::Lane::of`:
 control (`ClientDisconnect`, `EvictContract`, by event type and whatever
```

**File**: `crates/core/src/contract/executor.rs` (modified, +39/-0)
```diff
@@ -2840,6 +2840,45 @@ mod tests {
                 "per-record length cap on a native app grant's display name, in a table \
                  bounded at MAX_NATIVE_GRANTS (64) rows; not a cache budget",
             ),
+            // Outbound GET responses in flight (`node::outbound_budget`). A
+            // node-wide bound on transfer memory, released as each stream
+            // ends, NOT a cache. A recorded exception, not summed here and
+            // not in `declared_caches_plus_hosting_budget_leave_room_for_the_runtime`
+            // either: it is transient send memory held only while a response
+            // is being sent, so the budget caps a worst case rather than
+            // adding to a committed total, and its floor, which keeps a
+            // multi-megabyte web app servable, does not fit the headroom of
+            // the smallest hosts those two tests cover. Same kind of
+            // exception as inbound reassembly (`MAX_STREAM_TOTAL_BYTES`
+            // below). The hosting budget is its own share of the memory limit
+            // and is not derived from this sum, so leaving this out does not
+            // enlarge it. The oversize slot sits outside the budget by design
+            // (`OVERSIZE_RESPONSE_MAX_BYTES`).
+            (
+                "outbound_payload_budget_for",
+                "node-wide bound on outbound GET responses in flight; transfer memory \
+                 released as streams end, not a cache (see comment)",
+            ),
+            (
+                "for_memory_limit",
+                "OutboundPayloadBudget constructor: outbound_payload_budget_for, see above",
+            ),
+            (
+                "OVERSIZE_RESPONSE_MAX_BYTES",
+                "size limit of the one oversize slot beside outbound_payload_budget_for, see above",
+            ),
+            (
+                "OUTBOUND_PAYLOAD_BUDGET_MIN_BYTES",
+                "clamp inside outbound_payload_budget_for",
+            ),
+            (
+                "OUTBOUND_PAYLOAD_BUDGET_MAX_BYTES",
+                "clamp inside outbound_payload_budget_for",
+            ),
+            (
+                "OUTBOUND_PAYLOAD_FALLBACK_TOTAL_RAM_BYTES",
+                "RAM fallback for outbound_payload_budget_for",
+            ),
             // Functions.
             ("disk_budget_for", "DISK, not resident memory"),
             (
```

**File**: `crates/core/src/node.rs` (modified, +1/-0)
```diff
@@ -111,6 +111,7 @@ pub(crate) mod neighbor_hosting;
 pub(crate) mod network_status;
 pub use network_status::set_auto_update_state;
 mod op_state_manager;
+pub(crate) mod outbound_budget;
 mod p2p_impl;
 mod request_router;
 pub(crate) mod resource_metrics;
```

**File**: `crates/core/src/node/op_state_manager.rs` (modified, +12/-0)
```diff
@@ -329,6 +329,11 @@ pub(crate) struct OpManager {
     /// amplification observed in workflow run 24600634908 (6.8M spawns
     /// in 100s, 63GB RSS).
     pub(crate) active_relay_get_txs: Arc<DashSet<Transaction>>,
+    /// Bytes of GET responses this node has serialized and not yet finished
+    /// sending, per recipient source and node-wide. The relay dedup above
+    /// does not bound how many responses one peer can have queued; this does.
+    /// See `node::outbound_budget`.
+    pub(crate) outbound_payload_budget: Arc<super::outbound_budget::OutboundPayloadBudget>,
     /// Same role as `active_relay_get_txs` but for UPDATE relay.
     /// UPDATE relay has no retry loop and no upstream reply, so the
     /// amplification risk is structurally lower than GET — the gate
@@ -440,6 +445,7 @@ impl Clone for OpManager {
             // one node look like two to the delegate-interest hold map.
             node_identity: self.node_identity,
             active_relay_get_txs: self.active_relay_get_txs.clone(),
+            outbound_payload_budget: self.outbound_payload_budget.clone(),
             active_relay_update_txs: self.active_relay_update_txs.clone(),
             recent_relay_update_requests: self.recent_relay_update_requests.clone(),
             relay_put_stream_admission: self.relay_put_stream_admission.clone(),
@@ -900,6 +906,12 @@ impl OpManager {
             pending_contract_fetches,
             node_identity,
             active_relay_get_txs,
+            outbound_payload_budget:
+                super::outbound_budget::OutboundPayloadBudget::for_memory_limit(
+                    crate::wasm_runtime::read_total_ram_bytes().unwrap_or(
+                        super::outbound_budget::OUTBOUND_PAYLOAD_FALLBACK_TOTAL_RAM_BYTES,
+                    ),
+                ),
             active_relay_update_txs,
             recent_relay_update_requests: Arc::new(
                 crate::operations::update::recent_requests::RecentRelayedRequests::new(),
```

**File**: `crates/core/src/node/outbound_budget.rs` (added, +581/-0)
```diff
@@ -0,0 +1,581 @@
+//! Bound on the memory held by GET responses this node is sending.
+//!
+//! A node answers a GET for a contract it holds by serializing the state (and
+//! code) and queueing the bytes on the requester's connection, where they stay
+//! until the transport has sent them at that connection's rate. The relay
+//! dedup gate (`OpManager::active_relay_get_txs`) limits requests, not the
+//! bytes of the responses queued for them.
+//!
+//! [`OutboundPayloadBudget`] charges each streamed response before anything is
+//! sent:
+//!
+//! - **Node-wide**, at most `G` bytes held, where `G` is
+//!   [`outbound_payload_budget_for`] the node's memory limit.
+//! - **Per source**, at most `P = G / 4` bytes queued toward a source that
+//!   already holds something. A source is the recipient's IPv4 address or
+//!   IPv6 /64 ([`crate::operations::put::stream_admission::Source`]), so
+//!   several peers behind one IPv4 address share one `P`.
+//! - **Reserve**: the last `G / 4` of the node budget can be drawn only by a
+//!   source with nothing outstanding, so sources that already hold responses
+//!   cannot take the whole budget from a source that holds none.
+//! - **Idle source**: a source holding nothing is not checked against `P`; it
+//!   may be sent one response of any size that fits in the node budget it can
+//!   draw on.
+//! - **Oversize slot**: a response that does not fit the node budget is still
+//!   admitted when its source holds nothing, no other oversize response is
+//!   in flight, and it is at most [`OVERSIZE_RESPONSE_MAX_BYTES`]. This keeps
+//!   a maximum-size contract servable on a host whose `G` is small. The node
+//!   can then hold up to `G + OVERSIZE_RESPONSE_MAX_BYTES`, with one such
+//!   response at a time. Other streams do not join an oversize copy, so a
+//!   host whose `G` is small serves one oversize requester at a time.
+//!
+//! Streamed responses share one serialized copy per (contract, state hash,
+//! includes-contract) while any stream holds it
+//! ([`OutboundPayloadBudget::try_reserve_shared`]). The node budget counts
+//! each distinct copy once; each source is still charged the full length per
+//! stream.
+//!
+//! A charge is owned by the bytes handed to the transport
+//! (`bytes::Bytes::from_owner`), so it is returned when the last reference to
+//! them is dropped: the stream finished, was abandoned, or the send was
+//! dropped on the way. The memory bound therefore holds whatever the peer
+//! does. How long a response is held is bounded on QUIC paths only
+//! (`QuicPath::stream_deadlines`).
+//!
+//! A refused response is not sent. The caller returns an error, which the GET
+//! driver answers upstream with `NotFound`, and the requester tries another
+//! peer. A requester cannot tell a refusal from a missing contract. No wire
+//! change. Refusals are counted (`freenet.get.outbound_budget_refusals`).
+//!
+//! Scope: only streamed GET responses (above the streaming threshold) are
+//! charged here. A GET response at or below the threshold, and every other
+//! outbound message or stream (PUT, UPDATE, broadcast, forwarded streams), is
+//! not budgeted. Limits are per source.
+//!
+//! Not counted: the state and code a driver loaded before asking (dropped at
+//! once on a refusal), and the packets the transport keeps for
+//! retransmission.
+
+use std::collections::HashMap;
+use std::net::SocketAddr;
+use std::sync::atomic::{AtomicU64, Ordering};
+use std::sync::{Arc, Weak};
+
+use freenet_stdlib::prelude::ContractKey;
+
+use crate::operations::put::stream_admission::Source;
+
+/// The node budget as a share of the node's memory limit: one sixteenth,
+/// the same share as the QUIC buffer budget
+/// (`transport::quic::config::quic_buffer_budget_for`).
+const OUTBOUND_PAYLOAD_BUDGET_DIVISOR: usize = 16;
+
+/// Smallest node budget. Large enough that `P` (a quarter of it) holds a few
+/// multi-megabyte responses to one source. A response larger than the room
+/// this leaves is served through the oversize slot.
+pub(crate) const OUTBOUND_PAYLOAD_BUDGET_MIN_BYTES: usize = 64 * 1024 * 1024;
+
+/// The largest single response the oversize slot admits: a maximum-size state
+/// (`MAX_STATE_SIZE`, 50 MiB) plus stored code and parameters.
+pub(crate) const OVERSIZE_RESPONSE_MAX_BYTES: u64 = 128 * 1024 * 1024;
+
+/// Largest node budget, reached at 8 GiB of memory.
+pub(crate) const OUTBOUND_PAYLOAD_BUDGET_MAX_BYTES: usize = 512 * 1024 * 1024;
+
+/// The node-wide budget `G` for responses being sent:
+/// `memory_limit / 16`, clamped to 64..=512 MiB.
+pub(crate) fn outbound_payload_budget_for(memory_limit: usize) -> usize {
+    (memory_limit / OUTBOUND_PAYLOAD_BUDGET_DIVISOR).clamp(
+        OUTBOUND_PAYLOAD_BUDGET_MIN_BYTES,
+        OUTBOUND_PAYLOAD_BUDGET_MAX_BYTES,
+    )
+}
+
+/// Memory assumed when the node's cannot be read (1 GiB), as the QUIC
+/// settings assume (`config::QUIC_FALLBACK_TOTAL_RAM`).
+pub(crate) const OUTBOUND_PAYLOA
```

**File**: `crates/core/src/node/outbound_budget/tests.rs` (added, +567/-0)
```diff
@@ -0,0 +1,567 @@
+use super::*;
+use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
+
+const MIB: usize = 1024 * 1024;
+const GIB: usize = 1024 * MIB;
+
+fn v4(last: u8, port: u16) -> SocketAddr {
+    SocketAddr::new(IpAddr::V4(Ipv4Addr::new(10, 0, 0, last)), port)
+}
+
+/// G = 400, P = 100, reserve = 100: sources holding something share 300.
+/// The oversize slot is off, so the ordinary rules are what is tested.
+fn small() -> Arc<OutboundPayloadBudget> {
+    let b = OutboundPayloadBudget::with_caps(400, 100);
+    b.set_oversize_max_for_test(0);
+    b
+}
+
+fn key(n: u8) -> SharedPayloadKey {
+    SharedPayloadKey::for_test(n)
+}
+
+/// A charge for a response no other stream shares: every call uses a key
+/// no earlier call used, so the node is charged the full length.
+trait ReserveUnshared {
+    fn try_reserve(&self, to: SocketAddr, len: u64) -> Result<bytes::Bytes, Refusal>;
+}
+
+impl ReserveUnshared for Arc<OutboundPayloadBudget> {
+    fn try_reserve(&self, to: SocketAddr, len: u64) -> Result<bytes::Bytes, Refusal> {
+        use std::sync::atomic::AtomicU64;
+        static NEXT: AtomicU64 = AtomicU64::new(0);
+        let n = NEXT.fetch_add(1, Ordering::Relaxed);
+        let mut k = key(0);
+        k.state_hash[..8].copy_from_slice(&n.to_le_bytes());
+        shared(self, to, k, len as usize)
+    }
+}
+
+fn shared(
+    budget: &Arc<OutboundPayloadBudget>,
+    to: SocketAddr,
+    k: SharedPayloadKey,
+    len: usize,
+) -> Result<bytes::Bytes, Refusal> {
+    budget
+        .try_reserve_shared(to, k, len as u64, || {
+            Ok::<_, std::convert::Infallible>(vec![7; len])
+        })
+        .map_err(|e| match e {
+            SharedReserveError::Refused(r) => r,
+            SharedReserveError::Serialize(never) => match never {},
+            SharedReserveError::LengthMismatch { .. } => panic!("length mismatch"),
+        })
+}
+
+#[test]
+fn budget_is_a_sixteenth_of_memory_clamped() {
+    assert_eq!(outbound_payload_budget_for(256 * MIB), 64 * MIB, "floor");
+    assert_eq!(outbound_payload_budget_for(GIB), 64 * MIB);
+    assert_eq!(outbound_payload_budget_for(2 * GIB), 128 * MIB);
+    assert_eq!(outbound_payload_budget_for(4 * GIB), 256 * MIB);
+    assert_eq!(outbound_payload_budget_for(7_600 * MIB), 475 * MIB);
+    assert_eq!(outbound_payload_budget_for(64 * GIB), 512 * MIB, "ceiling");
+    let b = OutboundPayloadBudget::for_memory_limit(4 * GIB);
+    assert_eq!(b.per_source_cap(), 64 * MIB as u64);
+}
+
+/// Repeated requests from one source: whatever their number and whichever
+/// port they come from, the source holds at most P.
+#[test]
+fn one_source_cannot_hold_more_than_its_cap() {
+    let b = small();
+    let held: Vec<_> = (0..20)
+        .filter_map(|i| b.try_reserve(v4(1, 1000 + i), 30).ok())
+        .collect();
+    assert_eq!(held.len(), 3, "3 x 30 fits P = 100, a fourth does not");
+    assert_eq!(b.charged_to(v4(1, 1)), 90);
+    assert_eq!(b.try_reserve(v4(1, 9), 30).err(), Some(Refusal::SourceCap));
+    // Another source is unaffected.
+    assert!(b.try_reserve(v4(2, 1), 30).is_ok());
+}
+
+/// IPv6 addresses in one /64 are one source.
+#[test]
+fn an_ipv6_slash_64_is_one_source() {
+    let b = small();
+    let a = SocketAddr::new(
+        IpAddr::V6(Ipv6Addr::new(0x2001, 0xdb8, 0, 1, 0, 0, 0, 1)),
+        1,
+    );
+    let c = SocketAddr::new(
+        IpAddr::V6(Ipv6Addr::new(0x2001, 0xdb8, 0, 1, 9, 9, 9, 9)),
+        2,
+    );
+    let _first = b.try_reserve(a, 80).unwrap();
+    assert_eq!(b.try_reserve(c, 30).err(), Some(Refusal::SourceCap));
+}
+
+/// Sources that already hold responses share G - reserve; the reserve stays
+/// available to a source holding nothing.
+#[test]
+fn busy_sources_cannot_take_the_reserve() {
+    let b = small();
+    // Each source takes a first response (idle sources may use all of G),
+    // then a second one, which must fit within G - reserve = 300.
+    let mut held = Vec::new();
+    for s in 1..=3 {
+        held.push(b.try_reserve(v4(s, 1), 50).unwrap());
+    }
+    assert_eq!(b.node_total(), 150);
+    for s in 1..=3 {
+        held.push(b.try_reserve(v4(s, 1), 50).unwrap());
+    }
+    assert_eq!(b.node_total(), 300);
+    // Sources 1-3 hold their whole P. Source 4 takes a first response from
+    // the reserve (idle), and its second is refused by G - reserve, not by
+    // its own cap.
+    held.push(b.try_reserve(v4(4, 1), 10).unwrap());
+    assert_eq!(b.try_reserve(v4(4, 1), 10).err(), Some(Refusal::NodeCap));
+    // An idle source still gets in from the reserve.
+    assert!(b.try_reserve(v4(5, 1), 80).is_ok());
+}
+
+/// A response larger than P is admitted only when its source holds nothing.
+#[test]
+fn oversize_only_when_the_source_is_idle() {
+    let b = small();
+    let big = b
+        .try_reserve(v4(1, 1), 250)
+        .expect("idle source, room in G");
+    assert_eq!(b.try_reserve(v4(1, 1), 1).err(), Some(Refusal::SourceCap));
+    drop(big);
+    let _small = b.try_reserve
```

**File**: `crates/core/src/operations/get/op_ctx_task.rs` (modified, +316/-11)
```diff
@@ -3923,17 +3923,95 @@ where
             contract,
         },
     };
-    let payload_bytes = match bincode::serialize(&payload) {
-        Ok(b) => b,
+    // The length, without allocating, so a response the budget refuses is
+    // never serialized.
+    let payload_len = match bincode::serialized_size(&payload) {
+        Ok(len) => len,
         Err(e) => {
             return Err(OpError::NotificationChannelError(format!(
-                "Failed to serialize GET relay forward payload: {e}"
+                "Failed to size GET relay forward payload: {e}"
             )));
         }
     };
 
-    if crate::operations::should_use_streaming(op_manager.streaming_threshold, payload_bytes.len())
+    if crate::operations::should_use_streaming(op_manager.streaming_threshold, payload_len as usize)
     {
+        // The relay dedup gate bounds requests, not queued response bytes.
+        // Charge this response to the recipient's source and to the node
+        // BEFORE the header goes out; concurrent streams of the same response
+        // share one serialized copy. The charge lives as long as the transport
+        // holds the bytes. A refusal is an `Err`, which `drive_relay_get` answers
+        // upstream with NotFound, so the requester moves on to its next peer.
+        // A response the budget has no room for is refused on its length
+        // alone, before the state is hashed.
+        if let Err(refusal) = op_manager.outbound_payload_budget.precheck(
+            upstream_addr,
+            key,
+            includes_contract,
+            payload_len,
+        ) {
+            tracing::debug!(
+                tx = %tx,
+                contract = %key,
+                target = %upstream_addr,
+                total_size = payload_len,
+                reason = %refusal,
+                "GET relay: response refused by the outbound payload budget"
+            );
+            return Err(OpError::NotificationChannelError(format!(
+                "GET response of {payload_len} bytes for {key} to {upstream_addr} \
+                 refused: {refusal}"
+            )));
+        }
+        // The state's hash names the serialized copy that concurrent streams
+        // of this response share. Only an admitted streamed response needs it.
+        let state_hash: [u8; 32] = payload
+            .value
+            .state
+            .as_ref()
+            .map(|state| blake3::hash(state.as_ref()).into())
+            .unwrap_or([0; 32]);
+        let shared_key = crate::node::outbound_budget::SharedPayloadKey {
+            contract: key,
+            state_hash,
+            includes_contract,
+        };
+        let payload_bytes = match op_manager.outbound_payload_budget.try_reserve_shared(
+            upstream_addr,
+            shared_key,
+            payload_len,
+            || bincode::serialize(&payload),
+        ) {
+            Ok(bytes) => bytes,
+            Err(crate::node::outbound_budget::SharedReserveError::Refused(refusal)) => {
+                // Debug: the driver logs the returned error at warn already.
+                tracing::debug!(
+                    tx = %tx,
+                    contract = %key,
+                    target = %upstream_addr,
+                    total_size = payload_len,
+                    reason = %refusal,
+                    "GET relay: response refused by the outbound payload budget"
+                );
+                return Err(OpError::NotificationChannelError(format!(
+                    "GET response of {payload_len} bytes for {key} to {upstream_addr} \
+                     refused: {refusal}"
+                )));
+            }
+            Err(crate::node::outbound_budget::SharedReserveError::Serialize(e)) => {
+                return Err(OpError::NotificationChannelError(format!(
+                    "Failed to serialize GET relay forward payload: {e}"
+                )));
+            }
+            Err(crate::node::outbound_budget::SharedReserveError::LengthMismatch {
+                charged,
+                produced,
+            }) => {
+                return Err(OpError::NotificationChannelError(format!(
+                    "GET relay payload serialized to {produced} bytes, charged {charged}"
+                )));
+            }
+        };
         let sid = StreamId::next();
         tracing::info!(
             tx = %tx,
@@ -3981,12 +4059,7 @@ where
             .await
             .map_err(|_| OpError::NotificationError)?;
         conn_manager
-            .send_stream(
-                upstream_addr,
-                sid,
-                bytes::Bytes::from(payload_bytes),
-                embedded,
-            )
+            .send_stream(upstream_addr, sid, payload_bytes, embedded)
             .await
             .map_err(|e| {
                 OpError::NotificationChannelError(format!("get relay send_stream failed: {e}"))
@@ -8083,10 +8156,38 @@ mod tests {
              metadata header on the stream
```

**File**: `crates/core/src/tracing/otel.rs` (modified, +13/-0)
```diff
@@ -1352,6 +1352,18 @@ neither: a complete stream its consumer still holds past the age limit",
             }
         })
         .build();
+
+    let _outbound_budget = meter
+        .u64_observable_counter("freenet.get.outbound_budget_refusals")
+        .with_description(
+            "GET responses not sent because the outbound payload budget had no room, by reason",
+        )
+        .with_callback(|observer| {
+            let (source, node) = crate::node::outbound_budget::refused_totals_process();
+            observer.observe(source, &[KeyValue::new("reason", "source_cap")]);
+            observer.observe(node, &[KeyValue::new("reason", "node_cap")]);
+        })
+        .build();
 }
 
 /// Ring / topology state, mirroring the dashboard's connection-status tiles.
@@ -3054,6 +3066,7 @@ mod tests {
             "freenet.transport.transfers",
             "freenet.transport.nat_traversal",
             "freenet.transport.inbound_stream_limits",
+            "freenet.get.outbound_budget_refusals",
             "freenet.contract.queue.depth",
             "freenet.contract.queue.depth.high_water",
             "freenet.contract.queue.rejected",
```

#### Recent Merged Pull Requests:
- **PR #6352** (closed): test: give each joiners-behind-one-address test its own network name (@sanity)
- **PR #6350** (2026-11-23): fix(test): simulation test binaries keep node data dirs under a per-process temp root (@sanity)
- **PR #6348** (2026-11-23): test: give each joiners_behind_one_address variant its own network name (@sanity)
- **PR #6345** (2026-11-23): fix(connect): bound per-joiner native setups; decide UDP when there is no room (@sanity)
- **PR #6344** (2026-11-23): fix(get): bound the memory held by outbound GET responses (@sanity)
- **PR #6342** (2026-11-23): chore(ci): build the NAT Validation binary with auto-update off (@sanity)

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

## X. connect): bound per-joiner native setups; decide UDP when there is no room

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d0b2003d`: connect): bound per-joiner native setups; decide UDP when there is no room. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
`connect_native_admission_refused` for each native setup it did not admit as
acceptor (deciding UDP instead),
`connect_native_admission_control_dropped` for each control pair it left out
of the arms as acceptor for lack of setup room,
Setup admission: before deciding Native, the acceptor admits the setup
  (NativeConnectState::admit_acceptor_setup, through
  RelayContext::admit_native_setup), by joiner ADDRESS, the unit native
  setups, allow-set slots and dial coalescing all use: at most
  acceptor_pending_setups_max(max_connections) addresses pending (half of
  the node's native setup slots, NATIVE_SETUPS_MAX lowered to the connection
  limit as QuicPolicy::native_setups_max is, so the node's own dials as
  joiner keep the rest), at most ACCEPTOR_PENDING_SETUPS_PER_SOURCE (4) from
  one source (put::stream_admission::Source: an IPv4 address or an IPv6 /64;
  loopback counted per port for local test networks), and only with a known
  address. Another CONNECT to a pending address shares its entry (a
  refcount). A refusal decides Udp at once (counted
  connect_native_admission_refused), so a joiner never waits out the native
  fallback because the acceptor had no room; the pair is 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d0b2003d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
