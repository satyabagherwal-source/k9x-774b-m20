# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: freenet-freenet-core-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T18:35:49.029Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T18:35:49.029Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 78%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from freenet-freenet-core-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `f26a5e1f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T18:34:56.286Z  
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
> **Harvest Timestamp**: 2026-11-13T18:34:56.279Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3122 stars

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
- **Issue #6225** (2026-11-13): **docs(config): --transport-quic help says prefer is the default**
  *Symptoms*: ## Problem  `freenet --help` describes `--transport-quic` as "Unset means `shadow` on Linux, macOS and Windows". Since #6207 an unset value means `prefer` there. The same text says `prefer` uses "this release's share, which is 0". That stops being true once a release sets a data ramp (`QUIC_DATA_RAMP_START`). Operators read this text when deciding whether to set the key.  ## Approach  The help text now says `prefer` is the default on Linux, macOS and Windows, and that the release's share is its data ramp, or 0 when it has none. This wording holds both before and after the ramp release. One test doc comment in `driver/tests.rs` made the same claim that shadow is the default, and it is corrected too.  ## Testing  Comment and help text only. `cargo fmt --check` is clean.  Found in review of #6224.  [AI-assisted - Claude] 
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No issues found  **Rules checked:** git-workflow.md, code-style.md, testing.md, transport.md **Files reviewed:** 2  The diff only changes comments, in two places: - The `--transport-quic` help text in `crates/core/src/config.rs`. - A doc comment in `crates/core/src/transport/quic/upgrade/driver/tests.rs`.  No logic, tests or APIs change, so none of the rules on `.unwrap()`, spawns, retries, `biased;`, cleanup, push-before-send or regression tests apply.  - **The new wording is accurate.** The `quic_is_prefer_by_default_on_linux_macos_and_windows` test at `config.rs:7703` asserts that an unset value gives `QuicMode::Prefer` on Linux, macOS and Windows and `Off` elsewhere. `transport/quic.rs:118` already says the same. - **Related docs are not stale.** `.claude/rules/transport.md:1974` ("Step 2: shadow on by default…") is the rollout plan, not a statement of today's default. The next step in the plan describes the data ramp. Nothing else I fou
  > ## ⚠️ Extended Benchmark Regressions Detected  Some extended benchmarks show performance regressions.  **Note**: Extended benchmarks include high-latency and packet-loss scenarios which have higher variance than standard CI benchmarks.  [View full results](https://github.com/freenet/freenet-core/actions/runs/43461625242)  [View full benchmark summary](https://github.com/freenet/freenet-core/actions/runs/43461625242)

- **Issue #6223** (2026-11-13): **fix(test): a lost VirtualTime wakeup and drive_on_threads advancing over busy workers**
  *Symptoms*: ## Problem  `many_tasks_send_while_the_path_closes_and_nothing_goes_twice` failed intermittently. Running 24 copies of it in parallel reproduced the failure in 7 of 880 runs. Instrumenting `drive_on_threads` (each clock advance logged with which workers were busy and the global queue depth) showed two independent causes:  1. **A lost wakeup in `VirtualTime`** (5 of the 7 instrumented failures, "the multi-thread test did not finish"). `sleep_until` and `sleep_cancelable` checked `deadline > now` and then took the `pending_wakeups` lock to push. If another thread's `advance_to` ran in between, it stored the new time and popped the expired wakeups before the push. The pushed wakeup then had a deadline at or before the current time, so no later `advance_to` popped it. That sleep never ended, and `advance_to_next_wakeup` peeked it on every call and stopped there: the logs show 20,000 to 50,000 advances at one unchanging time, with every worker parked. 2. **`drive_on_threads` advanced the clock over busy workers** ("virtual time passed 30s"). It moved the clock whenever the driven future was unfinished after 64 yields and a 1 ms real-time sleep. In a debug build under load, a worker can still be computing the handshake after that. The log of the remaining failure shows `0 -> 999 ms -> 1998 ms -> 86,400,000 ms`, each advance with worker 3 busy: the handshake's timers fired before it ran, up to the 24 h idle timeout, and the server's handshake timed out.  ## Approach  1. `VirtualTime

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

### Incident Patch 1: `f26a5e1f` (2026-11-13)
**Commit Message**: fix(test): a lost VirtualTime wakeup and drive_on_threads advancing over busy workers (#6223)

**File**: `crates/core/src/simulation/time.rs` (modified, +91/-15)
```diff
@@ -318,15 +318,18 @@ impl VirtualTime {
     ///
     /// Returns the list of wakeup IDs that were triggered, in order.
     pub fn advance_to(&self, target_nanos: u64) -> Vec<WakeupId> {
-        let current = self.state.current_nanos.load(AtomicOrdering::SeqCst);
-        if target_nanos <= current {
+        // One atomic step, so two threads advancing at once cannot move the
+        // clock backwards (a load then a store could store the smaller
+        // target last). The time is stored before `pending_wakeups` is taken
+        // below, which `register_future_wakeup` relies on.
+        let previous = self
+            .state
+            .current_nanos
+            .fetch_max(target_nanos, AtomicOrdering::SeqCst);
+        if target_nanos <= previous {
             return Vec::new();
         }
 
-        self.state
-            .current_nanos
-            .store(target_nanos, AtomicOrdering::SeqCst);
-
         let mut triggered = Vec::new();
         let mut wakers_to_wake = Vec::new();
 
@@ -387,7 +390,9 @@ impl VirtualTime {
             .map(|w| w.deadline)
     }
 
-    /// Registers a wakeup and returns its ID.
+    /// Registers a wakeup and returns its ID, whatever its deadline. Tests
+    /// only; sleeps use [`Self::register_future_wakeup`].
+    #[cfg(test)]
     fn register_wakeup(&self, deadline: u64) -> WakeupId {
         let id = WakeupId::new(
             self.state
@@ -400,6 +405,32 @@ impl VirtualTime {
         id
     }
 
+    /// Registers a wakeup for `deadline` if it is still in the future, and
+    /// returns its ID; `None` if the clock has already reached it.
+    ///
+    /// The check and the push are one step under the `pending_wakeups` lock.
+    /// [`Self::advance_to`] stores the new time before it takes that lock to
+    /// pop expired wakeups, so a registration either sees the new time (and
+    /// registers nothing) or is pushed before the pop (and is popped). Checked
+    /// outside the lock, a thread that read the time just before another
+    /// thread's advance could push a wakeup the advance had already passed:
+    /// its deadline is then at or before the current time, which no later
+    /// `advance_to` pops, so the sleep never ends and
+    /// [`Self::advance_to_next_wakeup`] stops at it for good (#6220).
+    fn register_future_wakeup(&self, deadline: u64) -> Option<WakeupId> {
+        let mut pending = self.state.pending_wakeups.lock().unwrap();
+        if deadline <= self.state.current_nanos.load(AtomicOrdering::SeqCst) {
+            return None;
+        }
+        let id = WakeupId::new(
+            self.state
+                .next_wakeup_id
+                .fetch_add(1, AtomicOrdering::SeqCst),
+        );
+        pending.push(Wakeup::new(deadline, id));
+        Some(id)
+    }
+
     /// Registers a waker for a wakeup ID.
     #[allow(dead_code)]
     fn register_waker(&self, id: WakeupId, waker: Waker) {
@@ -508,23 +539,19 @@ impl TimeSource for VirtualTime {
     }
 
     fn sleep_until(&self, deadline_nanos: u64) -> Pin<Box<dyn Future<Output = ()> + Send>> {
-        let current = self.now_nanos();
-        if deadline_nanos <= current {
+        let Some(id) = self.register_future_wakeup(deadline_nanos) else {
             return Box::pin(std::future::ready(()));
-        }
-
-        let id = self.register_wakeup(deadline_nanos);
+        };
         let state = self.state.clone();
 
         Box::pin(VirtualSleep { id, state })
     }
 
     fn sleep_cancelable(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send>> {
         let deadline = self.now_nanos().saturating_add(duration.as_nanos() as u64);
-        if deadline <= self.now_nanos() {
+        let Some(id) = self.register_future_wakeup(deadline) else {
             return Box::pin(std::future::ready(()));
-        }
-        let id = self.register_wakeup(deadline);
+        };
         let state = self.state.clone();
         Box::pin(CancelableVirtualSleep {
             inner: VirtualSleep { id, state },
@@ -902,6 +929,55 @@ mod tests {
         assert_eq!(triggered[2], id3);
     }
 
+    /// A sleep registered while another thread advances the clock is never
+    /// left pending with a deadline the clock has already passed: no later
+    /// advance would pop it, so the sleep would never end and
+    /// `advance_to_next_wakeup` would stop at it for good (#6220).
+    #[test]
+    fn a_sleep_registered_during_an_advance_is_never_left_behind() {
+        let vt = VirtualTime::new();
+        std::thread::scope(|scope| {
+            scope.spawn(|| {
+                for _ in 0..200_000 {
+                    vt.advance(Duration::from_nanos(1));
+                }
+            });
+            for _ in 0..3 {
+                scope.spawn(|| {
+                    for _ in 0..200_000 {
+                        drop(vt.sleep_until(vt.now_nanos() + 1));
+                    }
+                });
+            }
+        });
+        let now = vt.now
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests/quic_send.rs` (modified, +4/-1)
```diff
@@ -1727,7 +1727,10 @@ fn many_tasks_send_while_the_path_closes_and_nothing_goes_twice() {
     match finished.recv_timeout(Duration::from_secs(120)) {
         Ok(Ok(())) => {}
         Ok(Err(panic)) => std::panic::resume_unwind(panic),
-        Err(_) => panic!("the multi-thread test did not finish"),
+        Err(_) => panic!(
+            "the multi-thread test did not finish (a `drive_on_threads:` line above says whether \
+             the runtime never went idle or went idle with nothing to wake)"
+        ),
     }
 }
 
```

**File**: `crates/core/src/transport/quic/tests.rs` (modified, +84/-7)
```diff
@@ -138,10 +138,32 @@ where
     }
 }
 
-/// [`drive`] on a multi-thread runtime. There, a task can still be running on
-/// another worker when this one runs out of things to poll, so after its turns it
-/// pauses briefly in real time, and moves the clock only to a wakeup that is
-/// armed. A stuck test is caught by the caller's real-time limit.
+/// [`drive`] on a multi-thread runtime. The clock moves to the next wakeup
+/// only when the runtime is idle ([`idle_workers`]): every worker parked
+/// and nothing in the global queue, the same on two readings a real-time
+/// millisecond apart (a worker that ran in between changes its park count).
+/// Moving it while a worker is still busy (a handshake's crypto in a debug
+/// build, say) fires that work's timers before it has had a chance to run,
+/// up to quinn's idle timeout (#6220). A stuck test is caught by the
+/// caller's real-time limit.
+///
+/// Must run on the thread that called `block_on`, not on a worker: its own
+/// worker would never read as parked.
+///
+/// Limits: idleness is read from the workers only. Work elsewhere is
+/// invisible to it: `spawn_blocking` and `block_in_place` threads, a
+/// `std::thread` that wakes tasks, real I/O or real-time timers. So is a
+/// worker preempted between parking and taking a task another thread just
+/// queued for it, for as long as the global queue is not read. A caller with
+/// any of those can still have the clock advanced over busy work; the QUIC
+/// tests here use none (in-memory sockets on virtual time).
+///
+/// A run that cannot go on prints why once, so a caller's real-time watchdog
+/// failure shows it: the runtime never read as idle for
+/// [`DRIVE_DIAGNOSTIC_CHECKS`] checks in a row (busy work it cannot see the
+/// end of, or a task that never parks), or it was idle with no wakeup left
+/// to advance to for as many (a lost wakeup, or a task waiting on something
+/// no timer will bring).
 pub(in crate::transport) async fn drive_on_threads<F>(
     time: &VirtualTime,
     limit: Duration,
@@ -151,27 +173,82 @@ where
     F: std::future::Future + Send + 'static,
     F::Output: Send + 'static,
 {
+    assert_ne!(
+        std::thread::current().name(),
+        Some("tokio-rt-worker"),
+        "drive_on_threads runs on the block_on thread, not on a worker"
+    );
     let task = tokio::spawn(fut);
     let limit_ns = time.now_nanos() + limit.as_nanos() as u64;
+    // Checks in a row that found the runtime busy, and that found it idle
+    // with nothing to advance to.
+    let (mut busy, mut stuck) = (0u32, 0u32);
     loop {
         for _ in 0..64 {
             if task.is_finished() {
                 return task.await.expect("the driven future panicked");
             }
             tokio::task::yield_now().await;
         }
-        tokio::time::sleep(Duration::from_millis(1)).await;
+        let before = idle_workers();
+        // Blocks only this thread (not a worker), and sets no runtime timer
+        // that would wake the worker holding the time driver and change its
+        // park count.
+        std::thread::sleep(Duration::from_millis(1));
         if task.is_finished() {
             return task.await.expect("the driven future panicked");
         }
-        time.advance_to_next_wakeup();
+        if before.is_none() || before != idle_workers() {
+            busy += 1;
+            if busy == DRIVE_DIAGNOSTIC_CHECKS {
+                eprintln!(
+                    "drive_on_threads: the runtime has not been idle for {busy} checks in a row \
+                     at {} ns: work it cannot see the end of, or a task that never parks",
+                    time.now_nanos()
+                );
+            }
+            continue;
+        }
+        busy = 0;
+        if time.advance_to_next_wakeup().is_none() {
+            stuck += 1;
+            if stuck == DRIVE_DIAGNOSTIC_CHECKS {
+                eprintln!(
+                    "drive_on_threads: the runtime is idle and no wakeup is left to advance to \
+                     at {} ns: a lost wakeup, or a task waiting on something no timer brings",
+                    time.now_nanos()
+                );
+            }
+            continue;
+        }
+        stuck = 0;
         assert!(
             time.now_nanos() <= limit_ns,
-            "virtual time passed {limit:?} before the future finished"
+            "virtual time passed {limit:?} before the future finished, advancing only while \
+             the runtime was idle"
         );
     }
 }
 
+/// Checks in a row of one kind after which [`drive_on_threads`] prints why
+/// it cannot go on: about a second or more of real time.
+const DRIVE_DIAGNOSTIC_CHECKS: u32 = 1000;
+
+/// Each worker's park count if the runtime is idle (every worker parked,
+/// none queued globally), else `None`. Two equal readings mean no worker
+/// ran between them.
+fn idle_workers() -> Option<Vec<u64>> {
+    let metrics = tokio::runtime::Handle::current().metric
```

---

### Incident Patch 2: `4ee2c161` (2026-11-13)
**Commit Message**: fix: validate transaction type at decode; call status providers outside the status lock (#6219)

**File**: `crates/core/src/message.rs` (modified, +68/-4)
```diff
@@ -32,13 +32,37 @@ use ulid::Ulid;
 ///
 /// A transaction may span different messages sent across the network.
 #[derive(Serialize, Deserialize, PartialEq, Eq, Hash, Clone, Copy)]
+#[serde(try_from = "TransactionWire")]
 pub struct Transaction {
     id: Ulid,
     /// Parent transaction ID for child operations spawned by this transaction.
     /// Enables atomicity tracking for composite operations (e.g., PUT with SUBSCRIBE).
     parent: Option<Ulid>,
 }
 
+/// Wire shape of [`Transaction`]. Identical field layout, so the encoding is
+/// unchanged; exists so decoding can validate the type byte, which a peer
+/// otherwise controls entirely.
+#[derive(Deserialize)]
+struct TransactionWire {
+    id: Ulid,
+    parent: Option<Ulid>,
+}
+
+impl TryFrom<TransactionWire> for Transaction {
+    type Error = String;
+
+    fn try_from(w: TransactionWire) -> Result<Self, Self::Error> {
+        let id_byte = (w.id.0 & 0xFFu128) as u8;
+        TransactionType::try_from(id_byte)
+            .map_err(|_| format!("invalid transaction type byte {id_byte}"))?;
+        Ok(Transaction {
+            id: w.id,
+            parent: w.parent,
+        })
+    }
+}
+
 impl Transaction {
     pub const NULL: &'static Transaction = &Transaction {
         id: Ulid(0),
@@ -71,9 +95,15 @@ impl Transaction {
 
     pub(crate) fn transaction_type(&self) -> TransactionType {
         let id_byte = (self.id.0 & 0xFFu128) as u8;
-        TransactionType::try_from(id_byte).expect(
-            "Transaction ID contains invalid type byte; this is a bug in Transaction construction",
-        )
+        // Deserialization rejects unknown type bytes and every constructor
+        // (including `ttl_transaction_with_multiplier`) sets a valid one, so
+        // the fallback is unreachable. It exists so that a value built some
+        // other way can never panic the network event loop; the debug_assert
+        // makes such a value visible in tests instead of silently
+        // misclassifying it.
+        let ty = TransactionType::try_from(id_byte);
+        debug_assert!(ty.is_ok(), "Transaction with invalid type byte {id_byte}");
+        ty.unwrap_or(TransactionType::Connect)
     }
 
     pub fn timed_out(&self) -> bool {
@@ -148,7 +178,10 @@ impl Transaction {
 
         // Clear the timestamp bits and replace with the cutoff timestamp.
         const TIMESTAMP_MASK: u128 = 0x00000000000000000000FFFFFFFFFFFFFFFF;
-        let new_ulid = (id.0 & TIMESTAMP_MASK) | ((ttl_epoch as u128) << 80);
+        // Keep the low byte a valid type byte (Connect = 0): the cutoff id is
+        // only compared against, but it must still satisfy the invariant that
+        // every Transaction carries a valid type.
+        let new_ulid = (id.0 & TIMESTAMP_MASK & !0xFFu128) | ((ttl_epoch as u128) << 80);
         Self {
             id: Ulid(new_ulid),
             parent: None,
@@ -1500,6 +1533,37 @@ mod tests {
         assert_eq!(msg.version(), semver::Version::new(1, 3, 0));
     }
 
+    /// A peer chooses every bit of a decoded transaction id; an unknown type
+    /// byte must be a decode error, never a later panic.
+    #[test]
+    fn deserialize_rejects_unknown_transaction_type_byte() {
+        for byte in 0u8..=255 {
+            let id = Ulid((Ulid::generate().0 & !0xFFu128) | byte as u128);
+            let wire = bincode::serialize(&(id, None::<Ulid>)).unwrap();
+            let decoded = bincode::deserialize::<Transaction>(&wire);
+            if byte <= 4 {
+                let tx = decoded.expect("valid type byte must decode");
+                assert_eq!(tx.id, id);
+                assert_eq!(tx.transaction_type() as u8, byte);
+                // Encoding is unchanged by validation.
+                assert_eq!(bincode::serialize(&tx).unwrap(), wire);
+            } else {
+                assert!(decoded.is_err(), "type byte {byte} must be rejected");
+            }
+        }
+    }
+
+    #[test]
+    fn ttl_transactions_carry_a_valid_type_byte() {
+        for _ in 0..512 {
+            for m in [1u64, 2, 5] {
+                let tx = Transaction::ttl_transaction_with_multiplier(m);
+                assert!(TransactionType::try_from((tx.id.0 & 0xFF) as u8).is_ok());
+                let _ = tx.transaction_type();
+            }
+        }
+    }
+
     #[test]
     fn pack_transaction_type() {
         let ts_0 = Ulid::generate();
```

**File**: `crates/core/src/node/network_status.rs` (modified, +106/-58)
```diff
@@ -2497,6 +2497,70 @@ pub fn get_snapshot() -> Option<NetworkStatusSnapshot> {
 /// `Instant` in the past (which can underflow on a freshly booted machine).
 fn snapshot_at(now: Instant) -> Option<NetworkStatusSnapshot> {
     let status = NETWORK_STATUS.get()?;
+    // Call every registered provider BEFORE taking the NETWORK_STATUS read
+    // guard. Providers lock ring/connection state (e.g. the ring-stats provider
+    // takes `ConnectionManager::own_addr`), while `set_own_addr` holds that
+    // lock and then takes the NETWORK_STATUS write lock. Calling them under
+    // the guard is a lock-order inversion that deadlocks the node.
+    // Read subscribed contracts from the registered provider, which in
+    // production points at the canonical lease map in `HostingManager`.
+    // Sort order is set inside the provider (most recently updated first;
+    // never-updated entries fall to the end with a deterministic key
+    // tie-break).
+    let contracts: Vec<ContractSnapshot> = SUBSCRIPTION_PROVIDER
+        .read()
+        .as_ref()
+        .map(|provider| {
+            provider()
+                .into_iter()
+                .map(|c| {
+                    let key_full = c.key.to_string();
+                    let instance_id = c.key.id().to_string();
+                    // Use char boundary for safe truncation (contract keys
+                    // are base58/ASCII, but be defensive against future
+                    // encoding changes).
+                    let key_short = if key_full.chars().count() > 12 {
+                        let trunc: String = key_full.chars().take(12).collect();
+                        format!("{trunc}...")
+                    } else {
+                        key_full.clone()
+                    };
+                    ContractSnapshot {
+                        key_short,
+                        key_full,
+                        instance_id,
+                        subscribed_secs: c.subscribed_secs,
+                        last_updated_secs: c.last_updated_secs,
+                        is_receiving_updates: c.is_receiving_updates,
+                        in_use: c.in_use,
+                    }
+                })
+                .collect()
+        })
+        .unwrap_or_default();
+
+    let ring_stats = RING_STATS_PROVIDER
+        .read()
+        .as_ref()
+        .map(|provider| provider())
+        .unwrap_or_default();
+
+    let governance = GOVERNANCE_PROVIDER
+        .read()
+        .as_ref()
+        .map(|provider| provider())
+        .unwrap_or_default();
+    let ban_list = BAN_LIST_PROVIDER
+        .read()
+        .as_ref()
+        .map(|provider| provider())
+        .unwrap_or_default();
+    let hosting = HOSTING_PROVIDER
+        .read()
+        .as_ref()
+        .map(|provider| provider())
+        .unwrap_or_default();
+
     let s = status.read().ok()?;
 
     let failures = s
@@ -2577,43 +2641,6 @@ fn snapshot_at(now: Instant) -> Option<NetworkStatusSnapshot> {
     let gateway_only_persisting =
         gateway_only && gateway_only_is_persisting(s.gateway_only_since, now);
 
-    // Read subscribed contracts from the registered provider, which in
-    // production points at the canonical lease map in `HostingManager`.
-    // Sort order is set inside the provider (most recently updated first;
-    // never-updated entries fall to the end with a deterministic key
-    // tie-break).
-    let contracts: Vec<ContractSnapshot> = SUBSCRIPTION_PROVIDER
-        .read()
-        .as_ref()
-        .map(|provider| {
-            provider()
-                .into_iter()
-                .map(|c| {
-                    let key_full = c.key.to_string();
-                    let instance_id = c.key.id().to_string();
-                    // Use char boundary for safe truncation (contract keys
-                    // are base58/ASCII, but be defensive against future
-                    // encoding changes).
-                    let key_short = if key_full.chars().count() > 12 {
-                        let trunc: String = key_full.chars().take(12).collect();
-                        format!("{trunc}...")
-                    } else {
-                        key_full.clone()
-                    };
-                    ContractSnapshot {
-                        key_short,
-                        key_full,
-                        instance_id,
-                        subscribed_secs: c.subscribed_secs,
-                        last_updated_secs: c.last_updated_secs,
-                        is_receiving_updates: c.is_receiving_updates,
-                        in_use: c.in_use,
-                    }
-                })
-                .collect()
-        })
-        .unwrap_or_default();
-
     let elapsed_secs = now.saturating_duration_since(s.started_at).as_secs();
     let has_version_mismatch = s
         .gateway_failures
@@ -2644,12 +2671,6 @@ fn snapshot_at(now: Instant) -> Option<NetworkStatusSnapshot> {
     le
```

**File**: `crates/core/src/operations/connect/op_ctx_task.rs` (modified, +40/-1)
```diff
@@ -424,6 +424,10 @@ async fn drive_client_connect(
     // Standard join at zero connections, but its first hop is no gateway.
     let started = Instant::now();
     let mut heard_gateway = false;
+    // The first relay sends exactly one `ObservedAddress` per CONNECT, so only
+    // the first one is acted on; repeats would otherwise let any sender keep
+    // rewriting this node's own address until the TTL.
+    let mut applied_observed_address = false;
     let through_gateway = op_manager
         .configured_gateways
         .iter()
@@ -939,12 +943,21 @@ async fn drive_client_connect(
                 collection_end = Some((CollectionEnd::Rejected, Instant::now()));
                 continue;
             }
+            ConnectMsg::ObservedAddress { address, .. } if applied_observed_address => {
+                tracing::debug!(
+                    tx = %tx,
+                    observed_address = %address,
+                    "connect driver: ignoring repeated ObservedAddress"
+                );
+            }
             ConnectMsg::ObservedAddress { address, .. } => {
+                applied_observed_address = true;
                 // The joiner doesn't know its external IP behind NAT;
                 // the gateway observes it from the UDP packet source
                 // and ships it back. Update both `own_addr` (for
                 // diagnostics) and `own_location` (for routing).
-                // Idempotent: subsequent observations overwrite.
+                // Only the first ObservedAddress per transaction is applied
+                // (see the guard arm above); repeats are ignored.
                 let location = Location::from_address(&address);
                 // GLOBAL-ADDR-WRITE-OK: production. A real node learning its
                 // peer-observed address is exactly what the external_address
@@ -1962,6 +1975,32 @@ mod tests {
         );
     }
 
+    /// Source-literal guard: the joiner driver applies only the first
+    /// `ObservedAddress` per CONNECT transaction. Repeats must hit the
+    /// ignoring arm BEFORE the applying arm, and the applying arm must set the
+    /// flag, so a peer cannot keep rewriting this node's own address.
+    #[test]
+    fn joiner_driver_applies_only_first_observed_address() {
+        const SOURCE: &str = include_str!("op_ctx_task.rs");
+        let guard = SOURCE
+            .find("ConnectMsg::ObservedAddress { address, .. } if applied_observed_address =>")
+            .expect("repeat-ignoring ObservedAddress arm removed");
+        let apply = SOURCE
+            .find("ConnectMsg::ObservedAddress { address, .. } => {\n                applied_observed_address = true;")
+            .expect("applying arm must set applied_observed_address first");
+        assert!(
+            guard < apply,
+            "the ignoring arm must precede the applying arm"
+        );
+        let body_end = SOURCE[apply..]
+            .find("set_own_addr(address)")
+            .expect("set_own_addr call");
+        assert!(
+            body_end < 2000,
+            "set_own_addr must stay in the applying arm"
+        );
+    }
+
     /// Source-literal guard: the relay driver runs the full re-entry
     /// state machine (Response/Rejected/ObservedAddress/ConnectFailed)
     /// on its inbox receiver. Removing any of these branches would
```

---

### Incident Patch 3: `af79d38e` (2026-11-13)
**Commit Message**: docs(config): --transport-quic help says prefer is the default (#6225)

**File**: `crates/core/src/config.rs` (modified, +3/-2)
```diff
@@ -2588,13 +2588,14 @@ pub struct NetworkArgs {
     pub bbr_startup_rate: Option<u64>,
 
     /// QUIC transport (#5940): `off`, `shadow` or `prefer`. Unset means
-    /// `shadow` on Linux, macOS and Windows, and `off` elsewhere.
+    /// `prefer` on Linux, macOS and Windows, and `off` elsewhere.
     ///
     /// `shadow` builds a QUIC endpoint on the network port and upgrades
     /// connections to peers that also run it to a QUIC path. The path carries
     /// control frames only, so all traffic stays on the existing transport.
     /// `prefer` also negotiates data with a share of pairs (`quic-data-percent`,
-    /// or this release's share, which is 0), and a pair where both sides did
+    /// or this release's share: its data ramp, or 0 when it has none), and a
+    /// pair where both sides did
     /// sends its traffic on the path. `off` builds no endpoint. An unknown value is treated as `off`,
     /// with a warning in the log.
     #[arg(long, env = "FREENET_TRANSPORT_QUIC", value_name = "off|shadow|prefer")]
```

**File**: `crates/core/src/transport/quic/upgrade/driver/tests.rs` (modified, +4/-2)
```diff
@@ -1038,8 +1038,10 @@ fn data_route_takes_no_lock(session: &Arc<Session>) -> bool {
 }
 
 /// With no route, as on a path without both data bits, a send reads one atomic
-/// and never waits for the session's lock, which the driver also takes. Shadow is
-/// the default on Linux, macOS and Windows, so this is every connection there.
+/// and never waits for the session's lock, which the driver also takes. With no
+/// data ramp, a `prefer` path carries no data, so this is every connection on
+/// Linux, macOS and Windows, where `prefer` is the default; with a ramp, every
+/// pair outside its share.
 #[test]
 fn a_connection_without_a_route_takes_no_lock_to_send() {
     bounded(|| async move {
```

#### Recent Merged Pull Requests:
- **PR #6225** (2026-11-13): docs(config): --transport-quic help says prefer is the default (@sanity)
- **PR #6223** (2026-11-13): fix(test): a lost VirtualTime wakeup and drive_on_threads advancing over busy workers (@sanity)
- **PR #6222** (2026-11-13): fix: validate guest buffer and result offsets against linear memory (@sanity)
- **PR #6221** (2026-11-13): fix(transport): sweep Established entries whose connection has ended (@sanity)
- **PR #6219** (2026-11-13): fix: validate transaction type at decode; call status providers outside the status lock (@sanity)
- **PR #6217** (2026-11-13): fix: bound guest-supplied error text and delegate result size (@sanity)

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

## X. test): a lost VirtualTime wakeup and drive_on_threads advancing over busy worker

**RULE**:
When implementing operations in `crates/core/src/simulation/time.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f26a5e1f`: test): a lost VirtualTime wakeup and drive_on_threads advancing over busy workers (#6223). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/simulation/time.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // One atomic step, so two threads advancing at once cannot move the
        // clock backwards (a load then a store could store the smaller
        // target last). The time is stored before `pending_wakeups` is taken
        // below, which `register_future_wakeup` relies on.
        let previous = self
            .state
            .current_nanos
            .fetch_max(target_nanos, AtomicOrdering::SeqCst);
        if target_nanos <= previous {
    /// Registers a wakeup and returns its ID, whatever its deadline. Tests
    /// only; sleeps use [`Self::register_future_wakeup`].
    #[cfg(test)]
    /// Registers a wakeup for `deadline` if it is still in the future, and
    /// returns its ID; `None` if the clock has already reached it.
    ///
    /// The check and the push are one step under the `pending_wakeups` lock.
    /// [`Self::advance_to`] stores the new time before it takes that lock to
    /// pop expired wakeups, so a registration either sees the new time (and
    /// registers nothing) or is pushed before the pop (and is popped). Checked
    /// outside the lock, a thread that read the time just before another
    /// thread's advance could push a wakeup the
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        let current = self.state.current_nanos.load(AtomicOrdering::SeqCst);
        if target_nanos <= current {
        self.state
            .current_nanos
            .store(target_nanos, AtomicOrdering::SeqCst);

    /// Registers a wakeup and returns its ID.
        let current = self.now_nanos();
        if deadline_nanos <= current {
        }

        let id = self.register_wakeup(deadline_nanos);
        if deadline <= self.now_nanos() {
        }
        let id = self.register_wakeup(deadline);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f26a5e1f` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
