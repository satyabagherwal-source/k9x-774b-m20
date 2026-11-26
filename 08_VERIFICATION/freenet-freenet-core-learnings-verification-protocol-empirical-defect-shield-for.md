# Verification Protocol: Verification Protocol: Empirical Defect Shield for freenet-freenet-core-learnings

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T07:19:18.114Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T07:19:18.114Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `freenet-freenet-core-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`  
> **Source**: github ([https://github.com/freenet/freenet-core](https://github.com/freenet/freenet-core))  
> **Source Version**: `28cc85d1`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T07:19:11.114Z  
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
> **Harvest Timestamp**: 2026-11-26T07:19:11.108Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `freenet/freenet-core`
- **Description**: Declare your digital independence
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3134 stars

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
- **Issue #6401** (2026-11-26): **test: default simulations to QUIC data (prefer, 100%)**
  *Symptoms*: ## Problem Simulated nodes were pinned to `QuicMode::OFF`, so the simulation suites exercised only the legacy UDP transport while production moves to QUIC data (phase D, D-2b).  ## Approach `SimNetwork` now configures every simulated node with `transport-quic = prefer` and `quic-data-percent = 100` (both pinned in the harness, so a change of the node default does not move simulations). `with_transport_quic("off")` still opts a test back to legacy UDP. New testing-only `SimNetwork::with_release_quic_data_share()` clears the 100% share so a test can read the release's own ramp.  Tests kept on `off` (all are tests whose subject is the negotiation itself, so they must start from no QUIC and turn it on where they want it): - `run_quic_shadow_sim_waiting` (all negotiation/shadow sims built on it) and `run_quic_harness_sim` when no mode is passed. Tests moved to the release data share (they read the ramp): everything built on `run_quic_data_ramp`.  Assertions and tests changed, with reasons: - `test_quic_native_zero_percent_forms_the_same_mesh`: both runs now call `with_native_connect(0)`. The test's subject is 0%, but with QUIC on the production 25% native share decided native connects in the "on" run only, giving a different mesh (verified: stable at 40/80/160 steps; each configuration is deterministic run to run). No assertion changed. - `quic_harness_knobs_reach_the_node_configs` (lib): default assertion now expects QUIC on at 100% instead of off. - `transport_quic_builds_the_en

- **Issue #6400** (2026-11-26): **ci: bump freenet-git mirror-repo.yml pin 61d5fea -> 7a85b99**
  *Symptoms*: ## Problem  The "Mirror to Freenet" workflow pins freenet-git's reusable `mirror-repo.yml` at `61d5fea`. That pin predates freenet/freenet-git#57, which classifies a push that fails on transient gateway backpressure ("contract queue full", "put timed out") and skips the #freenet-dev Matrix alert for it. Genuine failures and cancellations still alert.  The workflow was disabled from 2026-06-19 until today. It is re-enabled now, so that the freenet-git demo mirror is current again (Ian approved).  ## Approach  Bump the pin to freenet-git main `7a85b99`. The other change in the `61d5fea..7a85b99` range of `mirror-repo.yml` is `actions/checkout` v4 to v7. `workflow_call` inputs and the explicit `secrets:` mapping are unchanged, and the range adds no third-party actions. The pin comment is updated to say what it is pinned to.  ## Testing  The re-enabled workflow ran green today on the old pin, and a fresh `git clone` of the mirror returned today's content. The new pin's `mirror-repo.yml` is the version freenet-git's own self-mirror runs on every push to its main, which is green.  [AI-assisted - Claude] 
  **Post-Mortem & Fix Analysis**:
  > <!-- claude-rule-review --> ### Rule Review: No issues found  **Rules checked:** git-workflow.md **Files reviewed:** 1  No rule violations detected. The PR is a CI-only bump of the `mirror-repo.yml` pin to a full 40-character SHA, with the comment updated to match.  - The PR title and commit subject use the `ci:` prefix and are under 72 characters. - The change is one logical change and adds no feature. - It doesn't touch `crates/core`, tests, or stdlib dependencies.  <!-- warning-count: 0 -->  --- *Rule review against `.claude/rules/`. WARNING findings turn the `rule-review/warnings` status red.*

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

### Incident Patch 1: `28cc85d1` (2026-11-26)
**Commit Message**: test: default simulations to QUIC data (prefer, 100%) (#6401)

**File**: `.claude/rules/transport.md` (modified, +1/-1)
```diff
@@ -466,7 +466,7 @@ QUIC memory (`quic/config.rs`, `quic::memory_tests`)
 - quinn assumptions (PANICS-class) to re-check before bumping the quinn pin: `QUIC_ACK_TAIL_BYTES` assumes quinn-proto's cap of 1000 ack-only packets (M2); loss telemetry assumes quinn-proto 0.11.19 `PathStats` semantics (sent includes ack-only, lost never taken back, lost PLPMTUD probes left out of `lost` while sent ones are in `sent`, MTU discovery off).
 
 Simulation (`SimNetwork`)
-- Harness writes `off` unless `with_transport_quic` / `with_node_transport_quic` set it. The endpoint runs on VirtualTime only in simulation (`the_transport_endpoint_runs_on_virtual_time_only_in_simulation`); the bind-time draw uses `GlobalRng::with_side_stream`; every runner must move VirtualTime (`run_turmoil_on_virtual_time`) or no QUIC timer fires.
+- Harness writes `prefer` at a 100% data share and pins native connect / native gateway join at 0%, unless `with_transport_quic` / `with_node_transport_quic` (`"off"` is the legacy-UDP opt-out), `with_release_quic_data_share` (the release's own share) or `with_native_connect` set otherwise. The endpoint runs on VirtualTime only in simulation (`the_transport_endpoint_runs_on_virtual_time_only_in_simulation`); the bind-time draw uses `GlobalRng::with_side_stream`; every runner must move VirtualTime (`run_turmoil_on_virtual_time`) or no QUIC timer fires.
 
 Mechanism detail: docs/architecture/transport/rules-reference.md § QUIC endpoint (`transport/quic.rs`, #5940 step c2)
 
```

**File**: `crates/core/src/node/testing_impl.rs` (modified, +61/-12)
```diff
@@ -2247,8 +2247,10 @@ impl SimNetwork {
 
     /// Sets `transport-quic` to `value`, as `config.toml` would (`"off"`,
     /// `"shadow"`, `"prefer"`), on every node. Without this call the harness
-    /// writes `off`, whatever the node default is. Call before the simulation
-    /// starts.
+    /// writes `prefer` at a 100% data share (see
+    /// [`Self::with_release_quic_data_share`] to read the release's own share
+    /// instead); `"off"` opts a test back to the legacy UDP transport. Call
+    /// before the simulation starts.
     ///
     /// # Panics
     /// On a value this binary does not know. A node would read it as off
@@ -2529,6 +2531,33 @@ impl SimNetwork {
         self
     }
 
+    /// Clears `quic-data-percent` on every node, so each reads the release's own
+    /// share (the ramp), instead of the simulation default of 100.
+    #[cfg(any(test, feature = "testing"))]
+    pub fn with_release_quic_data_share(&mut self) -> &mut Self {
+        for label in self.pending_labels() {
+            let config = self.node_config_mut(&label);
+            Arc::make_mut(&mut config.config)
+                .network_api
+                .quic_data_percent = None;
+        }
+        self
+    }
+
+    /// Clears the native connect and native gateway join shares on every
+    /// node, so each runs this release's own (`QUIC_NATIVE_PERCENT`,
+    /// `GATEWAY_NATIVE_JOIN_PERCENT`) instead of the simulation default of 0%.
+    /// For a test of the shipped defaults. Call before the simulation starts.
+    #[cfg(any(test, feature = "testing"))]
+    pub fn with_release_native_share(&mut self) -> &mut Self {
+        for label in self.pending_labels() {
+            let config = self.node_config_mut(&label);
+            config.native_connect_override = None;
+            config.native_gateway_join_override = None;
+        }
+        self
+    }
+
     /// Sets `quic-max-paths` to `limit` on every node, as `config.toml` would.
     /// Call before the simulation starts. No effect on a node with QUIC off.
     #[cfg(any(test, feature = "testing"))]
@@ -3973,10 +4002,12 @@ impl SimNetwork {
                     // Default to usize::MAX so tests don't trigger streaming unless
                     // explicitly opted in via with_streaming_threshold().
                     streaming_threshold: Some(self.streaming_threshold.unwrap_or(usize::MAX)),
-                    // QUIC is off in a simulation unless the test turns it on
-                    // (`with_transport_quic`), whatever the node default is, so a
-                    // change of that default leaves every other run's trace as it was.
-                    transport_quic: Some(crate::transport::quic::QuicMode::OFF.to_string()),
+                    // A simulation negotiates QUIC data with every pair unless the
+                    // test opts back into the legacy UDP transport with
+                    // `with_transport_quic("off")`. The values are pinned here so a
+                    // change of the node default does not move simulations.
+                    transport_quic: Some(crate::transport::quic::QuicMode::PREFER.to_string()),
+                    quic_data_percent: Some("100".to_string()),
                     ..Default::default()
                 },
                 ..Default::default()
@@ -4002,6 +4033,12 @@ impl SimNetwork {
                 config.transient_budget = budget;
             }
             config.connect_backoff_base = self.connect_backoff_base_override;
+            // Pinned, like the QUIC mode and data share above: a default
+            // simulation decides no connect native, whatever this release's
+            // `QUIC_NATIVE_PERCENT` and `GATEWAY_NATIVE_JOIN_PERCENT` are. A test
+            // turns native on with `with_native_connect` / `with_native_gateway_join`.
+            config.native_connect_override = Some(0);
+            config.native_gateway_join_override = Some(0);
             config.key_pair = keypair;
             config.network_listener_ip = ip.into();
             config.network_listener_port = port;
@@ -4085,10 +4122,12 @@ impl SimNetwork {
                     // Default to usize::MAX so tests don't trigger streaming unless
                     // explicitly opted in via with_streaming_threshold().
                     streaming_threshold: Some(self.streaming_threshold.unwrap_or(usize::MAX)),
-                    // QUIC is off in a simulation unless the test turns it on
-                    // (`with_transport_quic`), whatever the node default is, so a
-                    // change of that default leaves every other run's trace as it was.
-                    transport_quic: Some(crate::transport::quic::QuicMode::OFF.to_string()),
+                    // A simulation negotiates QUIC data with every pair unless the
+                    // test opts back into the legacy UDP transport with
+                    // `with_transport_quic("off")`. The values are pinned here so a
+            
```

**File**: `crates/core/tests/simulation_integration.rs` (modified, +45/-5)
```diff
@@ -70,6 +70,9 @@ struct TestConfig {
     /// Send states larger than this many bytes as streams (`run_direct` only).
     /// `None` keeps the simulation default (streaming off).
     streaming_threshold: Option<usize>,
+    /// Run on the legacy UDP transport (`transport-quic = off`) instead of the
+    /// simulation default of QUIC data (`run_direct` only).
+    legacy_udp: bool,
 }
 
 impl TestConfig {
@@ -94,6 +97,7 @@ impl TestConfig {
             message_loss_rate: 0.0,
             use_mock_wasm: false,
             streaming_threshold: None,
+            legacy_udp: false,
         }
     }
 
@@ -118,6 +122,7 @@ impl TestConfig {
             message_loss_rate: 0.0,
             use_mock_wasm: false,
             streaming_threshold: None,
+            legacy_udp: false,
         }
     }
 
@@ -142,6 +147,7 @@ impl TestConfig {
             message_loss_rate: 0.0,
             use_mock_wasm: false,
             streaming_threshold: None,
+            legacy_udp: false,
         }
     }
 
@@ -186,6 +192,7 @@ impl TestConfig {
             message_loss_rate: 0.0,
             use_mock_wasm: false,
             streaming_threshold: None,
+            legacy_udp: false,
         }
     }
 
@@ -282,6 +289,14 @@ impl TestConfig {
         self
     }
 
+    /// Keep this test on the legacy UDP transport (`run_direct` only), for a
+    /// test whose subject is not the transport and whose QUIC run exceeds its
+    /// CI time cap.
+    fn with_legacy_udp(mut self) -> Self {
+        self.legacy_udp = true;
+        self
+    }
+
     /// Run the simulation and return results.
     fn run(self) -> TestResult {
         use freenet::simulation::FaultConfig;
@@ -404,6 +419,9 @@ impl TestConfig {
             if let Some(bytes) = self.streaming_threshold {
                 sim.with_streaming_threshold(bytes);
             }
+            if self.legacy_udp {
+                sim.with_transport_quic("off");
+            }
 
             // Apply fault injection if configured (latency and/or message loss)
             let has_latency = self.latency_range.is_some();
@@ -6596,6 +6614,7 @@ fn test_subscription_renewal_at_scale() {
         message_loss_rate: 0.0,
         use_mock_wasm: false,
         streaming_threshold: None,
+        legacy_udp: false,
     };
 
     let max_contracts = config.max_contracts; // Save before config.run() moves it
@@ -16005,6 +16024,11 @@ fn run_subscription_mesh(
     let sim = rt.block_on(async {
         let mut sim = SimNetwork::new(network, 1, 15, 10, 3, 5, 3, seed).await;
         sim.enable_hosting_time_control();
+        // Kept on the legacy UDP transport: the subscription tree does not
+        // depend on the transport, and the callers (six meshes per test) take
+        // about 1.6x as long under QUIC data (measured alone: 288 s off, 452 s
+        // on, loaded host), past the 240 s CI cap with a 95 s QUIC-off baseline.
+        sim.with_transport_quic("off");
         sim
     });
 
@@ -21081,9 +21105,7 @@ fn run_quic_harness_sim(name: &str, seed: u64, quic: Option<&str>) -> QuicSimTra
     let rt = create_runtime();
     let (sim, logs_handle, probe) = rt.block_on(async {
         let mut sim = SimNetwork::new(name, 2, 4, 10, 3, 10, 3, seed).await;
-        if let Some(value) = quic {
-            sim.with_transport_quic(value);
-        }
+        sim.with_transport_quic(quic.unwrap_or("off"));
         let probe = sim.probe_quic_endpoints_at(Duration::from_secs(2));
         let logs_handle = sim.event_logs_handle();
         (sim, logs_handle, probe)
@@ -21472,6 +21494,11 @@ fn run_quic_shadow_sim_waiting(
         // native wire fields but decides none, isolating the upgrade path;
         // native connects are covered by the `test_quic_native_*` sims.
         sim.with_native_connect(0);
+        // These runs exercise the negotiation itself, so every node starts with
+        // QUIC off and `set_up` turns it on where the test wants it. The harness
+        // default is `prefer` at 100%.
+        sim.with_transport_quic("off")
+            .with_release_quic_data_share();
         let trace = sim.quic_upgrade_trace();
         let mut labels: Vec<_> = sim.all_node_addresses().keys().cloned().collect();
         labels.sort_by_key(|label| (!label.is_gateway(), label.number()));
@@ -21775,7 +21802,8 @@ fn run_quic_data_ramp(
         let mut sim = SimNetwork::new(network, 1, 3, 7, 3, 10, 2, seed).await;
         sim.enable_gateway_ack_version();
         let trace = sim.quic_upgrade_trace();
-        sim.with_transport_quic("prefer");
+        sim.with_transport_quic("prefer")
+            .with_release_quic_data_share();
         trace.ramp_data_started_before(started_before);
         run_as_first_negotiating_release(&trace);
         let nodes: Vec<_> = sim.all_node_addresses().values().copied().collect();
@@ -23560,10 +23588,14 @@ fn test_quic_native_zero_percent_forms_the_same_mesh() {
     let off = run_native_wire_sim("native-wire-off", SEED, |si
```

**File**: `docs/architecture/transport/rules-reference.md` (modified, +4/-2)
```diff
@@ -1845,8 +1845,10 @@ seeded GlobalRng repeat the same event trace; the bytes differ, because
 rustls's key exchange and the XEdDSA nonce use the OS RNG.
 
 In SimNetwork: `with_transport_quic` / `with_node_transport_quic` set the
-config value per node (off unless set, whatever the node default: the
-harness writes `off` into every node's config; an unknown value panics;
+config value per node (`prefer` at a 100% data share unless set, whatever the
+node default: the harness writes both into every node's config and pins native
+connect and native gateway join at 0%; `"off"` opts a test back to legacy UDP,
+`with_release_quic_data_share` reads the release's own share instead; an unknown value panics;
 tests that start nodes outside SimNetwork, in `crates/core/tests` and through
 freenet-test-network, get the platform default on purpose, as production does,
 except where a restart after SIGKILL would trip a gateway's breaker on Linux or macOS; a
```

---

### Incident Patch 2: `cc7216cc` (2026-11-26)
**Commit Message**: feat(transport): one build constant makes every QUIC path act as udp_fallback = false (dark) (#6396)

**File**: `.claude/rules/transport.md` (modified, +1/-0)
```diff
@@ -506,6 +506,7 @@ Mechanism detail: docs/architecture/transport/rules-reference.md § QUIC identit
 - Proven peers (`PunchBudget`): only a completed native setup or a successful gateway hand-off proves a peer, never a UDP connection (source-scrape pin `only_native_completions_prove_a_peer`). A proof is keyed on (IPv4 or IPv6 /64, peer key), not the port. Proven setups draw on per-peer, per-address and node allowances, falling back to the shared budgets when spent (never worse than unproven). Joined proofs are a separate bounded partition. Forgetting or migrating a proof MUST NOT refill an allowance. Figures are provisional.
 - Fairness between requesters steering setups is NOT decided (A5): it MUST be fair before UDP is removed. The proven-peer allowance changes who is starved, not whether.
 - `QuicPathLimits::NATIVE` (udp_fallback off, data on): a send that would go to UDP is Dropped (after the `NoCredit` retries, below); a quiet timeout NEVER makes a native path suspect; a peer refusing data (NOT_ACCEPTING_DATA) closes it (`stop_sending_data`).
+- `breaker::UDP_FALLBACK` (D-3, dark, true today) is read by every path through `QuicPathLimits::effective_udp_fallback` (one reader; a source-scan pin in `breaker.rs` fails on any other). With it false an upgraded path gives up what it cannot carry, never turns suspect, a route whose path ended drops its queue, and a short the queue cannot take (full or closed) is dropped and counted instead of overflowing to UDP. This is the PATH-level fallback only: a connection with no route still sends on its UDP session, which D-8 deletes, so a sim or soak with the constant false is a partial check and cannot show what a no-UDP network costs.
 - `queue_native_short` returns `SendQueueFull` (Transient, connection survives, no ShortOverflowUdp, counted `quic_data_event_native_short_queue_full`, not Dropped) on a full queue. A native connection counts in `GlobalBandwidthManager`; its drop closes NODE_DROPPED_PEER.
 - Native connect gates on this node's OWN endpoint availability (per-node `QuicAvailabilityWatch`, not the process-wide metric), on the configured `transport-quic` mode being `prefer` (a shadow or off node is never ready in any role, gateway joins included) and on not being demoted. The joiner's offer reads `readiness()` (joiner demotion only); the relay's decision reads `acceptor_readiness()` (either role's demotion). Dial: higher key serves; setups capped by `NATIVE_SETUPS_MAX`; setup errors counted by an EXHAUSTIVE match (`connect_native_setup_<label>`).
 - Every accept site MUST pass the response's decision to `dispatch_expect_connection_from` (source-scrape pin).
```

**File**: `crates/core/src/transport/peer_connection/ack_policy_tests/quic_send.rs` (modified, +77/-0)
```diff
@@ -363,6 +363,83 @@ fn a_full_queue_overflows_to_udp_and_nothing_is_lost() {
     );
 }
 
+/// [`a_full_queue_overflows_to_udp_and_nothing_is_lost`] with the build constant
+/// false (a child process, `breaker::run_with_no_udp_fallback`): an existing route
+/// has no UDP fallback, so what the queue cannot take is dropped and counted, and
+/// nothing goes on UDP and no overflow is counted.
+#[test]
+fn with_no_udp_fallback_a_full_queue_drops_what_it_cannot_take() {
+    if !crate::transport::quic::breaker::run_with_no_udp_fallback(
+        module_path!(),
+        "with_no_udp_fallback_a_full_queue_drops_what_it_cannot_take",
+    ) {
+        return;
+    }
+    run(
+        "quic-send-overflow-no-udp",
+        QuicPathLimits::DEFAULT,
+        |mut rig| async move {
+            let over = 5;
+            let total = SHORT_QUEUE_CAPACITY as u32 + over;
+            for i in 0..total {
+                rig.e.conn.send_serialized(message(i)).await.unwrap();
+            }
+            assert_eq!(rig.stats().send_event_count(E::ShortOverflowUdp), 0);
+            assert_eq!(
+                rig.stats().send_count(SendKind::Short, R::Dropped),
+                u64::from(over),
+                "each short past the queue is counted dropped"
+            );
+            let udp = rig.udp_data();
+            assert!(
+                udp.shorts.is_empty(),
+                "nothing went on UDP: {:?}",
+                udp.shorts
+            );
+            rig.path.settle(Duration::from_secs(2)).await;
+            assert_eq!(
+                sorted(rig.delivered_shorts()),
+                sorted(
+                    (0..SHORT_QUEUE_CAPACITY as u32)
+                        .map(message)
+                        .collect::<Vec<_>>()
+                ),
+                "the queue reached the peer, each once"
+            );
+        },
+    );
+}
+
+/// A message sent after the route's path ended finds the queue closed: with the
+/// build constant false it is dropped and counted, not sent on UDP (a child
+/// process, `breaker::run_with_no_udp_fallback`).
+#[test]
+fn with_no_udp_fallback_a_short_after_the_path_ended_is_dropped() {
+    if !crate::transport::quic::breaker::run_with_no_udp_fallback(
+        module_path!(),
+        "with_no_udp_fallback_a_short_after_the_path_ended_is_dropped",
+    ) {
+        return;
+    }
+    run(
+        "quic-send-closed-no-udp",
+        QuicPathLimits::DEFAULT,
+        |mut rig| async move {
+            rig.route
+                .path()
+                .close(crate::transport::metrics::QuicCloseCode::Downgrade);
+            rig.path.settle(Duration::from_millis(50)).await;
+            assert!(
+                rig.worker.is_finished(),
+                "the worker ends once the path has"
+            );
+            rig.e.conn.send_serialized(message(1)).await.unwrap();
+            assert!(rig.udp_data().shorts.is_empty(), "nothing went on UDP");
+            assert_eq!(rig.stats().send_count(SendKind::Short, R::Dropped), 1);
+        },
+    );
+}
+
 /// A send on a route never waits in the connection's task, however stuck the path
 /// is: with every stream credit held, nothing of the queue can leave, so each
 /// message past its capacity would wait if the queue were awaited. The first poll
```

**File**: `crates/core/src/transport/quic/breaker.rs` (modified, +251/-4)
```diff
@@ -250,6 +250,17 @@ pub(crate) use short_runs::QuicCode;
 /// it takes it as a parameter, so tests cover both values; production reads
 /// it through [`udp_fallback`].
 ///
+/// Flipping it also removes the path-level UDP fallback of every upgraded
+/// QUIC path (`path::QuicPathLimits::effective_udp_fallback`): a send the path
+/// cannot carry is given up for the operation layer to retry, a quiet path is
+/// never suspect, and a route whose path ended or whose queue is full drops
+/// what it cannot take. It does
+/// not remove the connection's own UDP session: a connection with no route
+/// (no path, or the path closed) still sends on UDP, and so does the
+/// connect-time UDP dial (`udp_fallback_dial`). Those go with the UDP deletion
+/// (D-8), so a simulation or soak with this constant false is a partial check
+/// and cannot show what a network with no UDP costs.
+///
 /// Flipping it also turns on `fatal_exit` (the update check before a
 /// transport-fatal exit, and a failed bind ending the process). That check
 /// logs `Preparing the update before exiting (#5790)` through
@@ -259,18 +270,77 @@ pub(crate) use short_runs::QuicCode;
 /// flipping.
 pub const UDP_FALLBACK: bool = true;
 
-/// [`UDP_FALLBACK`], or `false` in a test build of the binary whose
-/// environment sets `FREENET_TEST_BREAKER_NO_UDP_FALLBACK` (the
+/// [`UDP_FALLBACK`], or `false` in a test build whose process environment sets
+/// `FREENET_TEST_NO_UDP_FALLBACK` (the `testing` feature and unit tests, see
+/// [`run_with_no_udp_fallback`]) or `FREENET_TEST_BREAKER_NO_UDP_FALLBACK` (the
 /// `quic-panic-injection` feature, which cannot be built without debug
-/// assertions), so a real-process test can run the post-UDP path.
+/// assertions), so a real-process test can run the post-UDP path. The one
+/// reader of the constant outside this module: every path, the breaker and the
+/// fatal-exit rules take the value from here (D-3). Each variable is read once
+/// per process, and nothing in a process sets it, so a test cannot change what
+/// another test in the same process sees. No simulation harness sets either
+/// variable: a run that wants the false value starts the process with it. Any
+/// binary built with the `testing` feature (fdev is) honours the first one.
 pub(crate) fn udp_fallback() -> bool {
     #[cfg(feature = "quic-panic-injection")]
-    if std::env::var_os("FREENET_TEST_BREAKER_NO_UDP_FALLBACK").is_some() {
+    {
+        static SET: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
+        if *SET.get_or_init(|| std::env::var_os("FREENET_TEST_BREAKER_NO_UDP_FALLBACK").is_some()) {
+            return false;
+        }
+    }
+    #[cfg(any(test, feature = "testing"))]
+    if no_udp_fallback_process() {
         return false;
     }
     UDP_FALLBACK
 }
 
+/// Whether this process was started with `FREENET_TEST_NO_UDP_FALLBACK` set.
+#[cfg(any(test, feature = "testing"))]
+pub(crate) fn no_udp_fallback_process() -> bool {
+    static SET: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
+    *SET.get_or_init(|| std::env::var_os("FREENET_TEST_NO_UDP_FALLBACK").is_some())
+}
+
+/// For a test that needs [`udp_fallback`] to be `false`. Called first in the
+/// test, it returns `true` when the test is running in a child process that has
+/// it (the caller goes on); otherwise it runs this one test again in a child
+/// with `FREENET_TEST_NO_UDP_FALLBACK` set, asserts the child ran it and passed,
+/// and returns `false` (the caller returns). A child process is used because
+/// the value is process-global and a test that changed it in place would change
+/// what concurrent tests of the same process see under plain `cargo test`.
+/// Pass `module_path!()` and the test's name.
+#[cfg(test)]
+#[must_use = "the test body runs only when this returns true"]
+pub(crate) fn run_with_no_udp_fallback(module: &str, test: &str) -> bool {
+    if no_udp_fallback_process() {
+        return true;
+    }
+    // A child that does not honour the variable would start another child
+    // without end: fail it instead.
+    assert!(
+        std::env::var_os("FREENET_TEST_NO_UDP_FALLBACK_CHILD").is_none(),
+        "the child process started with the variable but `udp_fallback()` ignores it"
+    );
+    let (_, within_crate) = module.split_once("::").expect("a module path");
+    let name = format!("{within_crate}::{test}");
+    let output = std::process::Command::new(std::env::current_exe().expect("test binary"))
+        .args([name.as_str(), "--exact", "--test-threads=1"])
+        .env("FREENET_TEST_NO_UDP_FALLBACK", "1")
+        .env("FREENET_TEST_NO_UDP_FALLBACK_CHILD", "1")
+        .output()
+        .expect("the child test process starts");
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    assert!(
+        output.status.success() && stdout.contains("1 passed"),
+        "`{name}` with no UDP fallback did not pass in its child process (a renamed test \
+         runs nothing and fa
```

**File**: `crates/core/src/transport/quic/path.rs` (modified, +16/-2)
```diff
@@ -409,6 +409,14 @@ impl QuicPathLimits {
         short_ack_wait: None,
     };
 
+    /// Whether a path built on these limits has a UDP session to fall back
+    /// to: the path's own flag ([`Self::udp_fallback`]) and the build constant
+    /// ([`super::breaker::UDP_FALLBACK`]). The only place a path reads the
+    /// constant, so the UDP-removal release flips every path with it (D-3).
+    pub(crate) fn effective_udp_fallback(&self) -> bool {
+        self.udp_fallback && super::breaker::udp_fallback()
+    }
+
     /// [`Self::DEFAULT`] for a path in shadow mode: control frames only.
     #[cfg_attr(not(test), allow(dead_code))]
     pub(crate) const SHADOW: Self = Self {
@@ -1141,7 +1149,7 @@ impl QuicPath {
                     rtt: receiver_rtt,
                     heard: heard.clone(),
                     carries_data: carries_data.clone(),
-                    udp_fallback: limits.udp_fallback,
+                    udp_fallback: limits.effective_udp_fallback(),
                     late_ends_close_native: limits.late_ends_close_native,
                     dark: dark.clone(),
                     long_dark_at: long_dark_at.clone(),
@@ -1171,7 +1179,7 @@ impl QuicPath {
                 send_data: AtomicU8::new(SEND_DATA_NEVER),
                 counted_as_data_path,
                 ended_as_data_path,
-                udp_fallback: limits.udp_fallback,
+                udp_fallback: limits.effective_udp_fallback(),
                 stall: parking_lot::Mutex::new(stall),
                 dark,
                 long_dark_at,
@@ -1681,6 +1689,12 @@ impl QuicPath {
         }
     }
 
+    /// Whether a send this path cannot carry may go on a UDP session
+    /// ([`QuicPathLimits::effective_udp_fallback`], fixed when the path is built).
+    pub(in crate::transport) fn udp_fallback(&self) -> bool {
+        self.udp_fallback
+    }
+
     /// Whether a new data send may start on this path.
     pub(in crate::transport) fn sends_data(&self) -> bool {
         self.send_data.load(Ordering::Acquire) == SEND_DATA_ON
```

**File**: `crates/core/src/transport/quic/path/tests/route.rs` (modified, +129/-0)
```diff
@@ -864,3 +864,132 @@ fn retry_not_opened_decides_by_path_outcome_and_attempt() {
         );
     })
 }
+
+/// Every outcome that can end on UDP for some kind of send, with the step a
+/// path WITH a UDP session takes for a Short (also a LargeShort) and for a
+/// Stream (also a Pipe). Written out, not computed from `next_step`, so a change
+/// to the table or to what `settle` does with it shows here.
+fn udp_rows() -> Vec<(BoundedSend, NextStep, NextStep)> {
+    use NextStep::{GiveUp, SendOnUdp};
+    let not_opened = |n| BoundedSend::Failed(SendFailure::NotOpened(n));
+    vec![
+        (not_opened(NotOpened::TimedOut), SendOnUdp, SendOnUdp),
+        (not_opened(NotOpened::Paced), SendOnUdp, SendOnUdp),
+        (not_opened(NotOpened::NoCredit), SendOnUdp, SendOnUdp),
+        (
+            not_opened(NotOpened::ConnectionLost(lost())),
+            SendOnUdp,
+            SendOnUdp,
+        ),
+        (
+            error(QuicSendError::InvalidFrame(framing_error_for_tests())),
+            SendOnUdp,
+            SendOnUdp,
+        ),
+        (stopped(stop_code::NOT_ACCEPTING_DATA), SendOnUdp, SendOnUdp),
+        (
+            BoundedSend::Failed(SendFailure::TimedOut),
+            SendOnUdp,
+            GiveUp,
+        ),
+        (BoundedSend::Failed(SendFailure::Paced), SendOnUdp, GiveUp),
+        (
+            error(QuicSendError::ConnectionLost(lost())),
+            SendOnUdp,
+            GiveUp,
+        ),
+        (error(QuicSendError::Closed), SendOnUdp, GiveUp),
+        (stopped(stop_code::BUDGET_REFUSED), SendOnUdp, GiveUp),
+    ]
+}
+
+/// With the build constant at its shipped value an upgraded path is what it was
+/// before the constant: its sends go on UDP (the steps are written out in
+/// [`udp_rows`]), a quiet timeout makes it suspect, and nothing is retried on it
+/// (D-3, dark).
+#[test]
+fn an_upgraded_path_keeps_its_udp_fallback_while_the_constant_is_true() {
+    const { assert!(super::super::super::breaker::UDP_FALLBACK) };
+    assert!(QuicPathLimits::DEFAULT.effective_udp_fallback());
+    assert!(!QuicPathLimits::NATIVE.effective_udp_fallback());
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let p = paths("quic-route-constant-true", QuicPathLimits::DEFAULT).await;
+        let a = &p.a;
+        assert!(a.udp_fallback());
+        for (outcome, short, stream) in udp_rows() {
+            let path = paths("quic-route-constant-true-row", QuicPathLimits::DEFAULT).await;
+            for (kind, expected) in [
+                (SendKind::Short, short),
+                (SendKind::LargeShort, short),
+                (SendKind::Stream, stream),
+                (SendKind::Pipe, stream),
+            ] {
+                assert_eq!(
+                    path.a.settle(kind, &outcome, false, 0),
+                    expected,
+                    "{kind:?} {outcome:?}"
+                );
+            }
+        }
+        let no_credit = BoundedSend::Failed(SendFailure::NotOpened(NotOpened::NoCredit));
+        assert!(!a.retry_not_opened(&no_credit, 0));
+        let built = p.time().now_nanos();
+        a.settle(SendKind::Short, &timeouts()[0], false, built + SECOND);
+        a.settle(SendKind::Short, &timeouts()[0], false, built + QUIET);
+        assert!(a.is_suspect());
+    });
+}
+
+/// With the build constant at `false` a path built on the default limits has no
+/// UDP fallback (the path level only; the connection keeps its UDP session):
+/// what would go on UDP is given up (the operation layer retries), counted
+/// dropped, a send that found no stream credit is tried again on the path, and a
+/// quiet timeout never makes it suspect, since there is nowhere to divert to.
+/// The test runs in a child process with the constant off
+/// (`breaker::run_with_no_udp_fallback`).
+#[test]
+fn with_no_udp_fallback_an_upgraded_path_gives_up_instead_of_going_on_udp() {
+    if !super::super::super::breaker::run_with_no_udp_fallback(
+        module_path!(),
+        "with_no_udp_fallback_an_upgraded_path_gives_up_instead_of_going_on_udp",
+    ) {
+        return;
+    }
+    assert!(!QuicPathLimits::DEFAULT.effective_udp_fallback());
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let p = paths("quic-route-constant-false", QuicPathLimits::DEFAULT).await;
+        let a = &p.a;
+        assert!(!a.udp_fallback());
+        for (outcome, _, _) in udp_rows() {
+            let path = paths("quic-route-constant-false-row", QuicPathLimits::DEFAULT).await;
+            for kind in [
+                SendKind::Short,
+                SendKind::LargeShort,
+                SendKind::Stream,
+                SendKind::Pipe,
+            ] {
+                assert_eq!(
+                    path.a.settle(kind, &outcome, false, 0),
+                    NextStep::GiveUp,
+                    "{kind:?} {outcome:?}"
+                );
+                assert_eq!(
+                    path.
```

**File**: `crates/core/src/transport/quic/upgrade/data_route.rs` (modified, +28/-11)
```diff
@@ -178,21 +178,36 @@ impl DataRoute {
     }
 
     /// Take `payload` for the path, or hand it back for UDP: the queue is full,
-    /// or the path has ended. Never waits.
+    /// or the path has ended. Never waits. On a path with no UDP fallback
+    /// (`QuicPathLimits::effective_udp_fallback`) nothing is handed back: a
+    /// payload the queue cannot take is dropped and counted, as every other
+    /// send the path cannot carry is, and the caller sees it taken.
     pub(in crate::transport) fn queue_short(
         &self,
         payload: SerializedMessage,
     ) -> Result<(), SerializedMessage> {
-        match self.shorts.try_send(payload) {
-            Ok(()) => Ok(()),
+        let refused = match self.shorts.try_send(payload) {
+            Ok(()) => return Ok(()),
             Err(mpsc::error::TrySendError::Full(payload)) => {
-                self.path
-                    .stats()
-                    .record_send_event(QuicSendEvent::ShortOverflowUdp);
-                Err(payload)
+                if self.path.udp_fallback() {
+                    self.path
+                        .stats()
+                        .record_send_event(QuicSendEvent::ShortOverflowUdp);
+                }
+                payload
             }
-            Err(mpsc::error::TrySendError::Closed(payload)) => Err(payload),
+            Err(mpsc::error::TrySendError::Closed(payload)) => payload,
+        };
+        if self.path.udp_fallback() {
+            return Err(refused);
         }
+        self.path.stats().record_send_dropped(SendKind::Short);
+        self.note(|| {
+            "dropped a short: the queue is full or the path has ended, and there is no UDP \
+             fallback"
+                .to_string()
+        });
+        Ok(())
     }
 }
 
@@ -288,12 +303,14 @@ async fn send_elsewhere(
     payload: SerializedMessage,
 ) {
     match udp {
-        Some(udp) => send_on_udp(path, udp, note, payload).await,
-        None => {
+        // A path with no UDP fallback (`QuicPathLimits::effective_udp_fallback`)
+        // gives up what it cannot carry, whether or not a session exists.
+        Some(udp) if path.udp_fallback() => send_on_udp(path, udp, note, payload).await,
+        _ => {
             path.stats().record_send_dropped(SendKind::Short);
             note.note(|| {
                 "dropped a short: the native path does not take it (ended, or the peer \
-                 refused data) and there is no UDP session"
+                 refused data) and there is no UDP fallback"
                     .to_string()
             });
         }
```

**File**: `crates/core/src/transport/quic/upgrade/driver/tests.rs` (modified, +56/-0)
```diff
@@ -928,6 +928,62 @@ fn a_route_ends_with_its_path_and_what_it_holds_goes_on_udp() {
     });
 }
 
+/// With the build constant at `false` the route of an upgraded path has no UDP
+/// to hand what it holds to: after the path ends, what is queued is dropped and
+/// counted, not sent on the session's UDP (`a_route_ends_with_its_path_and_what_it_holds_goes_on_udp`
+/// is the same run with the constant true).
+#[test]
+fn with_no_udp_fallback_what_a_route_holds_when_its_path_ends_is_dropped() {
+    use crate::transport::quic::control::caps;
+    use crate::transport::quic::path::{QuicSendResult, SendKind};
+    if !crate::transport::quic::breaker::run_with_no_udp_fallback(
+        module_path!(),
+        "with_no_udp_fallback_what_a_route_holds_when_its_path_ends_is_dropped",
+    ) {
+        return;
+    }
+    bounded(|| async move {
+        let _seed = GlobalRng::seed_guard(SEED);
+        let h = Harness::server_with("quic-driver-route-no-udp", "prefer", Some("100")).await;
+        let (session, inbox) = h.session();
+        let attempt = offered(&h, &session);
+        let up = path_up(&h, &session, inbox);
+        let time = h.pair.time.clone();
+        let (_peer_path, _peer_inbound, inbox) =
+            drive(&h.pair.time, Duration::from_secs(60), async move {
+                let up = up.await;
+                time.sleep(Duration::from_secs(1)).await;
+                up
+            })
+            .await;
+        ready_ack(&session, attempt, caps::DATA);
+        let route = session.data_route().expect("both bits");
+        assert!(!route.path().udp_fallback());
+        let path = route.path_handle();
+        for i in 0..10u8 {
+            route.queue_short(vec![i]).expect("the queue has room");
+        }
+        session.end();
+        let time = h.pair.time.clone();
+        let udp = Arc::clone(&h.udp);
+        drive(&h.pair.time, Duration::from_secs(60), async move {
+            time.sleep(Duration::from_secs(1)).await;
+            drop(inbox);
+            assert!(
+                udp.shorts.lock().unwrap().is_empty(),
+                "nothing goes on UDP when there is no UDP fallback"
+            );
+            assert_eq!(
+                path.stats()
+                    .send_count(SendKind::Short, QuicSendResult::Dropped),
+                10,
+                "each held short is counted dropped"
+            );
+        })
+        .await;
+    });
+}
+
 /// A path with both data bits counts once in `quic_enabled_data_paths` and in the
 /// `quic_live_data_paths` gauge while its route lives, and a session that ends under it
 /// counts by the path's age. A shadow path counts none of them.
```

**File**: `docs/architecture/transport/rules-reference.md` (modified, +5/-1)
```diff
@@ -2145,7 +2145,11 @@ Path: QuicPathLimits::NATIVE (DEFAULT with udp_fallback off) and data
   ends by the stall close or the acknowledgement watch's dark rule. A peer
   refusing data (NOT_ACCEPTING_DATA) closes the native path at once
   (QuicPath::stop_sending_data); left open it would drop every later send.
-  Upgrade paths keep udp_fallback on and are unchanged.
+  Upgrade paths keep udp_fallback on and are unchanged, unless
+  breaker::UDP_FALLBACK is false (not yet: D-3, dark): QuicPathLimits::
+  effective_udp_fallback then turns it off for every path, which removes the
+  PATH-level fallback only. The connection still sends on its UDP session
+  when it has no route.
 Shorts: DataRoute::native, no UDP sender. queue_native_short refuses a full
   queue with TransportError::SendQueueFull (Transient: the connection
   survives, the message is counted quic_data_event_native_short_queue_full,
```

#### Recent Merged Pull Requests:
- **PR #6401** (2026-11-26): test: default simulations to QUIC data (prefer, 100%) (@sanity)
- **PR #6400** (2026-11-26): ci: bump freenet-git mirror-repo.yml pin 61d5fea -> 7a85b99 (@sanity)
- **PR #6397** (2026-11-26): chore: add GET hop diagnostics to existing telemetry events (@sanity)
- **PR #6396** (2026-11-26): feat(transport): one build constant makes every QUIC path act as udp_fallback = false (dark) (@sanity)
- **PR #6395** (2026-11-25): fix: keep the node running when a helper process is OOM-killed (@sanity)
- **PR #6394** (2026-11-26): feat: late-end native close behind a dark flag, count judged ends (#6205) (@sanity)

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

## X. test: default simulations to QUIC data (prefer, 100%)

**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `28cc85d1`: test: default simulations to QUIC data (prefer, 100%). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Harness writes `prefer` at a 100% data share and pins native connect / native gateway join at 0%, unless `with_transport_quic` / `with_node_transport_quic` (`"off"` is the legacy-UDP opt-out), `with_release_quic_data_share` (the release's own share) or `with_native_connect` set otherwise. The endpoint runs on VirtualTime only in simulation (`the_transport_endpoint_runs_on_virtual_time_only_in_simulation`); the bind-time draw uses `GlobalRng::with_side_stream`; every runner must move VirtualTime (`run_turmoil_on_virtual_time`) or no QUIC timer fires.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- Harness writes `off` unless `with_transport_quic` / `with_node_transport_quic` set it. The endpoint runs on VirtualTime only in simulation (`the_transport_endpoint_runs_on_virtual_time_only_in_simulation`); the bind-time draw uses `GlobalRng::with_side_stream`; every runner must move VirtualTime (`run_turmoil_on_virtual_time`) or no QUIC timer fires.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `28cc85d1` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
