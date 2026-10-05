# Forensic Learning Record (Deep Inspection): domcyrus/rustnet

> **Canonical Artifact**: `07_PROJECT_LEARNING/domcyrus-rustnet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/domcyrus/rustnet](https://github.com/domcyrus/rustnet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:19:10.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `domcyrus/rustnet`
- **Description**: Per-process network monitoring for your terminal with deep packet inspection. Cross-platform, sandboxed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5069 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/common/mod.rs`
```
//! Helpers shared by the criterion benches. Cargo treats every top-level
//! `benches/*.rs` file as its own bench target, so shared code lives in this
//! subdirectory and each bench pulls it in with `mod common;`.

// Not every bench uses every helper.
#![allow(dead_code)]

use rustnet_monitor::network::parser::{ParsedPacket, TcpFlags, TcpHeaderInfo};
use rustnet_monitor::network::types::{Connection, Protocol, ProtocolState, TcpState};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

/// Build a synthetic established TCP data packet (1400 payload bytes,
/// outgoing) from `local_port` to 93.184.216.34:443 carrying `seq`.
///
/// Varying the local port distinguishes flows so tracker workloads exercise
/// key hashing and DashMap sharding the same way live traffic does.
pub fn make_packet(local_port: u16, seq: u32) -> ParsedPacket {
    let local_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100)), local_port);
    let remote_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34)), 443);
    let mut packet = ParsedPacket::new(
        Protocol::Tcp,
        local_addr,
        remote_addr,
        ProtocolState::Tcp(TcpState::Established),
        true,
        1400,
        None,
        None,
    );
    packet.tcp_header = Some(TcpHeaderInfo {
        seq,
        ack: seq.wrapping_add(1),
        window: 65535,
        flags: TcpFlags {
            syn: false,
            ack: true,
            fin: false,
            rst: false,
        },
        payload_len: 1400,
        window_scale: None,
    });
    packet
}

/// Create a Connection with a RateTracker filled to `n_samples` entries.
/// `prune_every` sprinkles in `prune()` calls at the given interval to keep
/// the tracker realistic; `None` skips pruning entirely.
pub fn make_connection_with_samples(n_samples: usize, prune_every: Option<usize>) -> Connection {
    let local = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100)), 54321);
    let remote = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34)), 443);
    let mut conn = Connection::new(
        Protocol::Tcp,
        local,
        remote,
        ProtocolState::Tcp(TcpState::Established),
    );

    for i in 0..n_samples {
        conn.bytes_sent += 100;
        conn.bytes_received += 200;
        conn.rate_tracker
            .update(conn.bytes_sent, conn.bytes_received);
        conn.packets_sent += 1;
        conn.packets_received += 1;
        if let Some(every) = prune_every
            && i % every == 0
        {
            conn.rate_tracker.prune();
        }
    }
    conn
}

```

### Core Architecture Module: `benches/connection_merge.rs`
```
use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use rustnet_core::network::merge::merge_packet_into_connection;
use rustnet_monitor::network::types::*;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::SystemTime;

mod common;

/// Create a Connection with a RateTracker filled to `n_samples` entries.
fn make_connection_with_samples(n_samples: usize) -> Connection {
    common::make_connection_with_samples(n_samples, None)
}

/// Create a minimal ParsedPacket for merge benchmarking.
fn make_parsed_packet() -> rustnet_monitor::network::parser::ParsedPacket {
    common::make_packet(54321, 1000)
}

fn bench_merge(c: &mut Criterion) {
    let parsed = make_parsed_packet();
    let now = SystemTime::now();

    let mut group = c.benchmark_group("merge_packet");

    for n_samples in [0, 100, 1000, 5000, 10000] {
        group.bench_with_input(
            BenchmarkId::new("in_place_merge", n_samples),
            &n_samples,
            |b, &n| {
                let mut conn = make_connection_with_samples(n);
                b.iter(|| merge_packet_into_connection(&mut conn, &parsed, now));
            },
        );

        let conn = make_connection_with_samples(n_samples);
        group.bench_with_input(
            BenchmarkId::new("clone_only", n_samples),
            &conn,
            |b, conn| {
                b.iter(|| conn.clone());
            },
        );
    }

    group.finish();
}

/// String-key baseline vs the Copy `ConnectionKey` + FxHash the tracker uses.
fn bench_connection_key_format(c: &mut Criterion) {
    use std::hash::BuildHasher;

    let local = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100)), 54321);
    let remote = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34)), 443);

    c.bench_function("connection_key_format_string", |b| {
        b.iter(|| format!("TCP:{}-TCP:{}", local, remote));
    });

    let parsed = make_parsed_packet();
    let hasher = rustc_hash::FxBuildHasher;
    c.bench_function("connection_key_struct_fxhash", |b| {
        b.iter(|| hasher.hash_one(parsed.connection_key()));
    });
}

criterion_group!(benches, bench_merge, bench_connection_key_format);
criterion_main!(benches);

```

### Core Architecture Module: `benches/dpi_overhead.rs`
```
//! Deterministic full-packet workloads for comparing DPI changes with their base.
//! Fixture construction and parser initialization are outside the timed region.
//! These synthetic workloads measure CPU cost, not live capture loss or UI cost.

use criterion::{Criterion, Throughput, criterion_group, criterion_main};
use rustnet_monitor::network::parser::PacketParser;
use rustnet_monitor::network::tracker::ConnectionTracker;
use std::hint::black_box;
use std::time::SystemTime;

fn tcp(payload: &[u8], source: u16, destination: u16, sequence: u32) -> Vec<u8> {
    let mut frame = vec![0; 54];
    frame[..12].copy_from_slice(&[2, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 2]);
    frame[12..14].copy_from_slice(&0x0800u16.to_be_bytes());
    frame[14] = 0x45;
    frame[16..18].copy_from_slice(&((40 + payload.len()) as u16).to_be_bytes());
    frame[22] = 64;
    frame[23] = 6;
    // Loopback is always in the local address snapshot, making orientation stable.
    frame[26..30].copy_from_slice(&[127, 0, 0, 1]);
    frame[30..34].copy_from_slice(&[192, 0, 2, 1]);
    frame[34..36].copy_from_slice(&source.to_be_bytes());
    frame[36..38].copy_from_slice(&destination.to_be_bytes());
    frame[38..42].copy_from_slice(&sequence.to_be_bytes());
    frame[46] = 0x50;
    frame[47] = 0x10;
    frame[48..50].copy_from_slice(&65535u16.to_be_bytes());
    frame.extend_from_slice(payload);
    frame
}

fn client_hello() -> Vec<u8> {
    // RFC 9001 Appendix A.2, wrapped in a TLS record.
    let hex = concat!(
        "010000ed0303ebf8fa56f12939b9584a3896472ec40bb863cfd3e868",
        "04fe3a47f06a2b69484c00000413011302010000c000000010000e00000b6578",
        "616d706c652e636f6dff01000100000a00080006001d0017001800100007000504616c706e",
        "0005000501000000000033002600",
        "24001d00209370b2c9caa47fbabaf4559fedba753de171fa71f50f1ce15d43e9",
        "94ec74d748002b0003020304000d0010000e04030503060302030804080508",
        "06002d00020101001c00024001003900320408ffffffffffffffff0504800",
        "0ffff07048000ffff0801100104800075300901100f088394c8f03e5157080",
        "6048000ffff"
    );
    let mut payload = vec![0x16, 3, 1];
    payload.extend_from_slice(&((hex.len() / 2) as u16).to_be_bytes());
    for offset in (0..hex.len()).step_by(2) {
        payload.push(u8::from_str_radix(&hex[offset..offset + 2], 16).unwrap());
    }
    payload
}

fn mysql_greeting() -> Vec<u8> {
    let mut body = b"\x0a8.4.0\0".to_vec();
    body.extend_from_slice(&123u32.to_le_bytes());
    body.extend_from_slice(b"12345678\0");
    body.extend_from_slice(&0x8a00u16.to_le_bytes());
    body.push(45);
    body.extend_from_slice(&2u16.to_le_bytes());
    body.extend_from_slice(&8u16.to_le_bytes());
    body.push(21);
    body.extend_from_slice(&[0; 10]);
    body.extend_from_slice(b"abcdefghijkl\0caching_sha2_password\0");
    let mut payload = (body.len() as u32).to_le_bytes().to_vec();
    payload.extend_from_slice(&body);
    payload
}

fn postgres_startup() -> Vec<u8> {
    let parameters = b"user\0bench\0database\0example\0application_name\0psql\0\0";
    let mut payload = ((8 + parameters.len()) as u32).to_be_bytes().to_vec();
    payload.extend_from_slice(&0x0003_0000u32.to_be_bytes());
    payload.extend_from_slice(parameters);
    payload
}

fn resp(arguments: &[&[u8]]) -> Vec<u8> {
    let mut payload = format!("*{}\r\n", arguments.len()).into_bytes();
    for argument in arguments {
        payload.extend_from_slice(format!("${}\r\n", argument.len()).as_bytes());
        payload.extend_from_slice(argument);
        payload.extend_from_slice(b"\r\n");
    }
    payload
}

fn workloads() -> Vec<(&'static str, Vec<u8>)> {
    let mut encrypted = vec![0x17, 3, 3, 0x05, 0x73];
    encrypted.extend((0..1395).map(|i| (i * 37 + 11) as u8));
    let unknown: Vec<u8> = (0..1400).map(|i| (i * 31 + 73) as u8).collect();
    let redis = resp(&[b"GET", b"example"]);
    let maximum_args = resp(&[b"GET".as_slice(); 128]);
    vec![
        ("tcp_ack", tcp(&[], 40000, 443, 0)),
        (
            "http",
            tcp(b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n", 40000, 80, 0),
        ),
        ("tls_client_hello", tcp(&client_hello(), 40000, 443, 0)),
        ("tls_data_1400", tcp(&encrypted, 40000, 443, 0)),
        ("unknown_1400", tcp(&unknown, 40000, 45000, 0)),
        ("ssh", tcp(b"SSH-2.0-OpenSSH_9.0\r\n", 22, 40000, 0)),
        ("mysql_greeting", tcp(&mysql_greeting(), 3306, 40000, 0)),
        ("postgres_startup", tcp(&postgres_startup(), 40000, 5432, 0)),
        ("redis_get", tcp(&redis, 40000, 6379, 0)),
        ("redis_max_args", tcp(&maximum_args, 40000, 6379, 0)),
        ("redis_reply", tcp(&redis, 6379, 40000, 0)),
    ]
}

fn bench_dpi_overhead(c: &mut Criterion) {
    let parser = PacketParser::new().with_linktype(1);
    let workloads = workloads();
    for (name, frame) in &workloads {
        assert!(
            parser.parse_packet(frame).is_some(),
            "invalid fixture: {name}"
        );
    }
    let mut group = c.benchmark_group("dpi_packet");
    group.throughput(Throughput::Elements(1));
    for (name, frame) in &workloads {
        group.bench_function(*name, |b| {
            b.iter(|| black_box(parser.parse_packet(black_box(frame)).unwrap()));
        });
    }
    group.finish();

    // 64 concurrent flows, 32 packets each: 1 handshake, 15 ACKs, 16 data
    // packets per flow. Sequence numbers advance between data packets.
    // HTTP and TLS each make up half the flows; this is a defined synthetic
    // mix, not an estimate of real-world traffic proportions.
    let mut frames = Vec::new();
    let mut sequences = [0u32; 64];
    for round in 0..32u32 {
        for flow in 0..64u16 {
            let index = if round == 0 {
                1 + usize::from(flow % 2)
            } else if round % 2 == 0 {
                0
            } else {
                4 - usize::from(flow % 2)
            };
            let mut frame = workloads[index].1.clone();
            frame[34..36].copy_from_slice(&(40000 + flow).to_be_bytes());
            frame[36..38].copy_from_slice(&(if flow % 2 == 0 { 80u16 } else { 443 }).to_be_bytes());
            let sequence = &mut sequences[usize::from(flow)];
            frame[38..42].copy_from_slice(&sequence.to_be_bytes());
            *sequence += (frame.len() - 54) as u32;
            frames.push(frame);
        }
    }
    let mut group = c.benchmark_group("dpi_mixed");
    group.throughput(Throughput::Elements(frames.len() as u64));
    group.bench_function("parse", |b| {
        b.iter(|| {
            for frame in black_box(&frames) {
                black_box(parser.parse_packet(frame).unwrap());
            }
        });
    });
    let now = SystemTime::now();
    group.bench_function("parse_and_track", |b| {
        b.iter(|| {
            let tracker = ConnectionTracker::new();
            for frame in black_box(&frames) {
                tracker.ingest_at(&parser.parse_packet(frame).unwrap(), now);
            }
            black_box(tracker);
        });
    });
    group.finish();

    // Redis commands can be inspected throughout a connection, unlike the
    // MySQL/PostgreSQL startup metadata. Measure that sustained cost too.
    let mut redis_frames = Vec::new();
    let redis_payload = resp(&[b"GET", b"example"]);
    for round in 0..32u32 {
        for flow in 0..64u16 {
            redis_frames.push(tcp(
                &redis_payload,
                40000 + flow,
                6379,
                round * redis_payload.len() as u32,
            ));
        }
    }
    let mut group = c.benchmark_group("dpi_database");
    group.throughput(Throughput::Elements(redis_frames.len() as u64));
    group.bench_function("redis_parse_and_track", |b| {
        b.iter(|| {
            let tracker = ConnectionTracker::new();
            for frame in black_box(&redis_frames) {
                tracker.ingest_at(&parser.parse_packet(frame).unwrap(), now);
            }
            black_box(tracker);
  
```

### Core Architecture Module: `benches/packet_parsing.rs`
```
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use rustnet_monitor::network::parser::PacketParser;
use std::path::Path;

/// Load all raw packet bytes from the capture.pcap file.
fn load_packets_from_pcap(path: &str) -> Vec<Vec<u8>> {
    let mut cap = pcap::Capture::from_file(path).expect("failed to open pcap file");
    let mut packets = Vec::new();
    while let Ok(packet) = cap.next_packet() {
        packets.push(packet.data.to_vec());
    }
    packets
}

fn bench_parse_packet(c: &mut Criterion) {
    if !Path::new("capture.pcap").exists() {
        if std::env::var_os("CI").is_some()
            || std::env::var_os("RUSTNET_REQUIRE_BENCH_PCAP").is_some()
        {
            panic!("capture.pcap fixture is required for packet_parsing benchmark");
        }
        eprintln!(
            "Skipping packet_parsing benchmark: capture.pcap not found \
             (set RUSTNET_REQUIRE_BENCH_PCAP=1 to require it)"
        );
        return;
    }

    let packets = load_packets_from_pcap("capture.pcap");
    assert!(!packets.is_empty(), "capture.pcap must contain packets");

    // Configure parser with Linux SLL linktype (DLT 113) matching capture.pcap
    let parser = PacketParser::new().with_linktype(113);

    let mut group = c.benchmark_group("parse_packet");
    group.throughput(Throughput::Elements(packets.len() as u64));

    group.bench_function("all_packets", |b| {
        b.iter(|| {
            let mut parsed_count = 0u32;
            for pkt in &packets {
                if parser.parse_packet(pkt).is_some() {
                    parsed_count += 1;
                }
            }
            parsed_count
        });
    });

    group.finish();

    // Per-packet benchmark (average cost of a single parse)
    let mut single_group = c.benchmark_group("parse_single_packet");
    single_group.throughput(Throughput::Elements(1));

    // Pick a few representative packets (first TCP, first UDP if available)
    let mut tcp_packet = None;
    let mut udp_packet = None;
    for pkt in &packets {
        let result = parser.parse_packet(pkt);
        if let Some(ref parsed) = result {
            match parsed.protocol {
                rustnet_monitor::network::types::Protocol::Tcp if tcp_packet.is_none() => {
                    tcp_packet = Some(pkt.clone());
                }
                rustnet_monitor::network::types::Protocol::Udp if udp_packet.is_none() => {
                    udp_packet = Some(pkt.clone());
                }
                _ => {}
            }
        }
        if tcp_packet.is_some() && udp_packet.is_some() {
            break;
        }
    }

    if let Some(ref pkt) = tcp_packet {
        single_group.bench_with_input(BenchmarkId::new("tcp", pkt.len()), pkt, |b, pkt| {
            b.iter(|| parser.parse_packet(pkt));
        });
    }

    if let Some(ref pkt) = udp_packet {
        single_group.bench_with_input(BenchmarkId::new("udp", pkt.len()), pkt, |b, pkt| {
            b.iter(|| parser.parse_packet(pkt));
        });
    }

    single_group.finish();
}

criterion_group!(benches, bench_parse_packet);
criterion_main!(benches);

```

### Core Architecture Module: `benches/rate_tracker.rs`
```
use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use rustnet_monitor::network::types::Connection;

mod common;

/// Create a Connection with `n` rate samples, pruning periodically to keep
/// the tracker realistic.
fn make_connection_with_samples(n_samples: usize) -> Connection {
    common::make_connection_with_samples(n_samples, Some(500))
}

/// Benchmark the per-packet `update()` call on RateTracker: the hot path,
/// called for every packet received. The Arc<VecDeque> sample buffer adds an
/// `Arc::make_mut` uniqueness check here.
fn bench_rate_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("rate_tracker_update");

    for n_samples in [0, 100, 1000, 5000] {
        // Unique owner: simulates the normal packet-processing path where
        // no snapshot clone is holding a shared reference.
        group.bench_with_input(
            BenchmarkId::new("unique_owner", n_samples),
            &n_samples,
            |b, &n| {
                let mut conn = make_connection_with_samples(n);
                let mut bytes_sent = conn.bytes_sent;
                let mut bytes_recv = conn.bytes_received;
                b.iter(|| {
                    bytes_sent += 100;
                    bytes_recv += 200;
                    conn.rate_tracker.update(bytes_sent, bytes_recv);
                });
            },
        );

        // Shared owner: two Arcs share the VecDeque (as right after a UI
        // snapshot clone), so the first `update()` pays a full copy via
        // Arc::make_mut. The snapshot is returned from the routine so it
        // stays alive during the update and its drop isn't measured.
        group.bench_with_input(
            BenchmarkId::new("after_snapshot_clone", n_samples),
            &n_samples,
            |b, &n| {
                b.iter_batched(
                    || {
                        let conn = make_connection_with_samples(n);
                        let snapshot = conn.clone(); // shared Arc, kept alive
                        (conn, snapshot)
                    },
                    |(mut conn, snapshot)| {
                        conn.bytes_sent += 100;
                        conn.bytes_received += 200;
                        conn.rate_tracker
                            .update(conn.bytes_sent, conn.bytes_received);
                        (conn, snapshot)
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );

        // Detached snapshot (what the snapshot thread does): snapshot_clone()
        // drops the sample buffer, so the live tracker stays unique owner and
        // the next update takes the fast path even while the snapshot is
        // alive.
        group.bench_with_input(
            BenchmarkId::new("after_snapshot_clone_detached", n_samples),
            &n_samples,
            |b, &n| {
                b.iter_batched(
                    || {
                        let conn = make_connection_with_samples(n);
                        let snapshot = conn.snapshot_clone(); // no shared samples
                        (conn, snapshot)
                    },
                    |(mut conn, snapshot)| {
                        conn.bytes_sent += 100;
                        conn.bytes_received += 200;
                        conn.rate_tracker
                            .update(conn.bytes_sent, conn.bytes_received);
                        (conn, snapshot)
                    },
                    criterion::BatchSize::SmallInput,
                );
            },
        );
    }

    group.finish();
}

/// Benchmark `refresh_rates()` (prune + rate calculation + smoothing).
/// Called once per second per connection from the refresh loop.
fn bench_refresh_rates(c: &mut Criterion) {
    let mut group = c.benchmark_group("refresh_rates");

    // 20000 = the sample cap: with O(1) window totals the curve must stay
    // flat instead of growing with the sample count.
    for n_samples in [0, 100, 1000, 5000, 20000] {
        group.bench_with_input(
            BenchmarkId::new("unique_owner", n_samples),
            &n_samples,
            |b, &n| {
                let mut conn = make_connection_with_samples(n);
                b.iter(|| {
                    conn.refresh_rates();
                });
            },
        );
    }

    group.finish();
}

/// Benchmark Connection::clone() to measure the impact of Arc<VecDeque>
/// vs a plain VecDeque. With Arc, clone is O(1) for the samples field
/// (just a refcount bump). Without Arc, it's O(n_samples).
fn bench_connection_clone(c: &mut Criterion) {
    let mut group = c.benchmark_group("connection_clone");

    for n_samples in [0, 100, 1000, 5000, 10000] {
        let conn = make_connection_with_samples(n_samples);
        group.bench_with_input(BenchmarkId::new("clone", n_samples), &conn, |b, conn| {
            b.iter(|| conn.clone());
        });
    }

    group.finish();
}

/// Benchmark the snapshot-then-mutate cycle that happens in practice:
/// cheap Arc clone followed by the CoW deep copy on first mutation.
fn bench_snapshot_then_update(c: &mut Criterion) {
    let mut group = c.benchmark_group("snapshot_then_update");

    for n_conns in [100, 1000, 5000] {
        let connections: Vec<Connection> = (0..n_conns)
            .map(|_| make_connection_with_samples(100))
            .collect();

        group.bench_with_input(
            BenchmarkId::new("clone_all_then_update_all", n_conns),
            &connections,
            |b, connections| {
                b.iter_batched(
                    || connections.clone(),
                    |mut conns| {
                        // Snapshot clone, then mutate the originals (UI snapshot vs
                        // incoming packets).
                        let _snapshot: Vec<Connection> = conns.to_vec();
                        for conn in &mut conns {
                            conn.bytes_sent += 100;
                            conn.bytes_received += 200;
                            conn.rate_tracker
                                .update(conn.bytes_sent, conn.bytes_received);
                        }
                    },
                    criterion::BatchSize::LargeInput,
                );
            },
        );

        // Same cycle but with snapshot_clone(): the snapshot detaches from
        // the sample buffers, so the mutation never pays the CoW deep copy.
        group.bench_with_input(
            BenchmarkId::new("snapshot_clone_all_then_update_all", n_conns),
            &connections,
            |b, connections| {
                b.iter_batched(
                    || connections.clone(),
                    |mut conns| {
                        let _snapshot: Vec<Connection> =
                            conns.iter().map(|c| c.snapshot_clone()).collect();
                        for conn in &mut conns {
                            conn.bytes_sent += 100;
                            conn.bytes_received += 200;
                            conn.rate_tracker
                                .update(conn.bytes_sent, conn.bytes_received);
                        }
                    },
                    criterion::BatchSize::LargeInput,
                );
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_rate_update,
    bench_refresh_rates,
    bench_connection_clone,
    bench_snapshot_then_update,
);
criterion_main!(benches);

```

### Core Architecture Module: `benches/snapshot.rs`
```
use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use dashmap::DashMap;
use rustnet_monitor::network::types::*;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

/// Populate a DashMap with `n` connections, each with a small number of rate samples.
fn populate_connections(n: usize) -> DashMap<String, Connection> {
    let map = DashMap::new();
    for i in 0..n {
        let port = (i % 65000) as u16 + 1;
        let octet3 = ((i / 256) % 256) as u8;
        let octet4 = (i % 256) as u8;
        let local = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100)), port);
        let remote = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(10, 0, octet3, octet4)), 443);
        let key = format!("TCP:{}-TCP:{}", local, remote);
        let mut conn = Connection::new(
            Protocol::Tcp,
            local,
            remote,
            ProtocolState::Tcp(TcpState::Established),
        );
        conn.bytes_sent = 5000;
        conn.bytes_received = 15000;
        conn.packets_sent = 10;
        conn.packets_received = 30;
        conn.rate_tracker
            .update(conn.bytes_sent, conn.bytes_received);
        map.insert(key, conn);
    }
    map
}

fn bench_snapshot(c: &mut Criterion) {
    let mut group = c.benchmark_group("snapshot");

    for n_conns in [100, 1000, 5000, 10000, 50000] {
        let connections = populate_connections(n_conns);

        group.bench_with_input(
            BenchmarkId::new("clone_and_collect", n_conns),
            &connections,
            |b, connections| {
                b.iter(|| {
                    let snapshot: Vec<Connection> = connections
                        .iter()
                        .map(|entry| entry.value().clone())
                        .collect();
                    snapshot
                });
            },
        );

        // snapshot_clone (drops rate samples) + collect: what
        // start_snapshot_provider does, leaving the live connections as unique
        // owners of their sample buffers.
        group.bench_with_input(
            BenchmarkId::new("snapshot_clone_and_collect", n_conns),
            &connections,
            |b, connections| {
                b.iter(|| {
                    let snapshot: Vec<Connection> = connections
                        .iter()
                        .map(|entry| entry.value().snapshot_clone())
                        .collect();
                    snapshot
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("clone_collect_sort", n_conns),
            &connections,
            |b, connections| {
                b.iter(|| {
                    let mut snapshot: Vec<Connection> = connections
                        .iter()
                        .map(|entry| entry.value().clone())
                        .collect();
                    snapshot.sort_by_key(|a| a.created_at);
                    snapshot
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_snapshot);
criterion_main!(benches);

```

### Core Architecture Module: `benches/tracker_ingest.rs`
```
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use rustnet_monitor::network::parser::ParsedPacket;
use rustnet_monitor::network::tracker::ConnectionTracker;
use std::time::SystemTime;

mod common;

/// Interleaved packet stream: `flows` connections sending `packets_per_flow`
/// packets round-robin, mimicking concurrent flows rather than one flow at a
/// time.
fn make_workload(flows: u16, packets_per_flow: u32) -> Vec<ParsedPacket> {
    let mut packets = Vec::with_capacity(flows as usize * packets_per_flow as usize);
    for round in 0..packets_per_flow {
        for flow in 0..flows {
            packets.push(common::make_packet(10000 + flow, round * 1460));
        }
    }
    packets
}

/// The canonical per-packet ingest cost: parse results folded into a fresh
/// tracker (mix of connection creation and in-place merge). This is the
/// before/after number for connection-key, timestamp, and limit-check work
/// on the packet path.
fn bench_tracker_ingest(c: &mut Criterion) {
    let now = SystemTime::now();

    let mut group = c.benchmark_group("tracker_ingest");
    for (flows, per_flow) in [(100u16, 100u32), (1000, 50)] {
        let packets = make_workload(flows, per_flow);
        group.throughput(Throughput::Elements(packets.len() as u64));
        group.bench_with_input(
            BenchmarkId::new("fresh_tracker", format!("{flows}x{per_flow}")),
            &packets,
            |b, packets| {
                b.iter(|| {
                    let tracker = ConnectionTracker::new();
                    for p in packets {
                        tracker.ingest_at(p, now);
                    }
                    tracker
                });
            },
        );
    }
    group.finish();

    // Steady state: every packet updates an existing connection (no creation).
    let mut group = c.benchmark_group("tracker_ingest_steady");
    let packets = make_workload(1000, 1);
    let tracker = ConnectionTracker::new();
    for p in &packets {
        tracker.ingest_at(p, now);
    }
    group.throughput(Throughput::Elements(packets.len() as u64));
    group.bench_function("existing_connections_1000", |b| {
        b.iter(|| {
            for p in &packets {
                tracker.ingest_at(p, now);
            }
        });
    });
    group.finish();
}

criterion_group!(benches, bench_tracker_ingest);
criterion_main!(benches);

```

### Core Architecture Module: `crates/rustnet-capture/src/capture_wait.rs`
```
//! Shared bounded-wait policy, with native readiness isolated in two adapters.
//!
//! Adapters only report readiness, timeout, or an error. This module owns the
//! idle budget and guards against unsupported backends and spurious readiness.
//! No adapter consumes packets or owns the capture's descriptor/event.

use pcap::{Active, Capture};
use std::io;
use std::time::{Duration, Instant};

use super::IDLE_POLL_INTERVAL;

#[cfg(unix)]
mod unix;
#[cfg(unix)]
use unix::NativeWait;
#[cfg(windows)]
mod windows;
#[cfg(windows)]
use windows::NativeWait;

pub(super) struct CaptureWait {
    native: NativeWait,
    policy: WaitPolicy,
}

impl CaptureWait {
    pub(super) fn new(capture: &Capture<Active>) -> Self {
        Self {
            native: NativeWait::new(capture),
            policy: WaitPolicy::default(),
        }
    }

    pub(super) fn packet_received(&mut self) {
        self.policy.packet_received();
    }

    pub(super) fn wait(&mut self, capture: &Capture<Active>) {
        self.policy.wait(IDLE_POLL_INTERVAL, || {
            self.native.wait(capture, IDLE_POLL_INTERVAL)
        });
    }
}

#[derive(Default)]
struct WaitPolicy {
    readiness_unconsumed: bool,
}

impl WaitPolicy {
    fn packet_received(&mut self) {
        self.readiness_unconsumed = false;
    }

    fn wait(&mut self, interval: Duration, wait: impl FnOnce() -> io::Result<bool>) {
        // Readiness can still yield no accepted packet, for example after
        // filtering. Yield if libpcap could not consume the last notification.
        if self.readiness_unconsumed {
            self.readiness_unconsumed = false;
            std::thread::sleep(interval);
            return;
        }
        let started = Instant::now();
        match wait() {
            Ok(readable) => self.readiness_unconsumed = readable,
            Err(_) => {
                // Unsupported backends, invalid handles and interruptions must
                // not spin or restart a full timeout. Sleep only the remainder
                // of this budget, then let the capture loop check shutdown.
                std::thread::sleep(interval.saturating_sub(started.elapsed()));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packet_reader_remains_send() {
        fn assert_send<T: Send>() {}
        assert_send::<crate::PacketReader>();
    }

    #[test]
    fn errors_fall_back_without_retrying_or_spinning() {
        for kind in [io::ErrorKind::Interrupted, io::ErrorKind::Unsupported] {
            let mut policy = WaitPolicy::default();
            let started = Instant::now();
            policy.wait(IDLE_POLL_INTERVAL, || Err(io::Error::from(kind)));
            assert!(started.elapsed() >= IDLE_POLL_INTERVAL);
            assert!(started.elapsed() < Duration::from_secs(1));
            assert!(!policy.readiness_unconsumed);
        }
    }

    #[test]
    fn timeout_does_not_trigger_the_spurious_readiness_guard() {
        let mut policy = WaitPolicy::default();
        policy.wait(IDLE_POLL_INTERVAL, || Ok(false));
        policy.wait(IDLE_POLL_INTERVAL, || Ok(true));
        assert!(policy.readiness_unconsumed);
    }

    #[test]
    fn persistent_unconsumed_readiness_yields_before_waiting_again() {
        let mut policy = WaitPolicy::default();
        policy.wait(IDLE_POLL_INTERVAL, || Ok(true));
        assert!(policy.readiness_unconsumed);
        let started = Instant::now();
        policy.wait(IDLE_POLL_INTERVAL, || {
            panic!("unconsumed readiness must yield instead of waiting")
        });
        assert!(started.elapsed() >= IDLE_POLL_INTERVAL);
        assert!(!policy.readiness_unconsumed);
        policy.wait(IDLE_POLL_INTERVAL, || Ok(true));
        assert!(policy.readiness_unconsumed);
        policy.packet_received();
        policy.wait(IDLE_POLL_INTERVAL, || Ok(true));
        assert!(policy.readiness_unconsumed);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #334** (2026-05-28): **Exiting program when pressing Backspace twice after entering filter mode**
  *Symptoms*: After entering filter mode using /, pressing the Backspace key twice causes the program to exit. I'm not sure if this is a bug.
  **Post-Mortem & Fix Analysis**:
  > ubuntu 24.04
  > Thanks @lant1s , this sounds very much longer a bug.

- **Issue #34** (2025-10-03): **Network byte statistics are inaccurate for large packets**
  *Symptoms*: ## Issue  Network byte statistics show incorrect values when monitoring file transfers, especially over NFS or when jumbo frames are used. The reported bytes transferred can be off by orders of magnitude (too small).  ## Reproduction  1. Transfer a large file over NFS (e.g., using rsync to an NFS-mounted directory) 2. Monitor the connection with rustnet 3. Observe that bytes sent/received are severely undercounted  ## Root Cause  The code counts captured packet length (`data.len()`) instead of actual packet length. Since snaplen is set to 1514 bytes, any packet larger than this is truncated but counted as only 1514 bytes.  **Location**: `src/network/parser.rs` line 330 and similar places use `packet_len: data.len()`  ## Fix  Use the actual packet length from the IP header's Total Length field instead of the captured buffer length.

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

### Incident Patch 1: `84a8f83f` (2026-09-27)
**Commit Message**: fix: show DNS attribution in application displays (#638)

**File**: `ARCHITECTURE.md` (modified, +1/-1)
```diff
@@ -188,7 +188,7 @@ Cache properties:
 
 **Race safety**: `attribute()` enrolls the connection in the pending index, then re-checks the cache. If a concurrent `record_and_drain_pending()` for the same IP landed between the lookup and the enrollment, the re-check tags the connection; the now-stale enrollment is harmless and is removed by `forget_pending` when the connection is cleaned up or by the pending prune after the freshness window.
 
-**Distinct from `network::dns::DnsResolver`**: that component performs *reverse* DNS (IP to PTR) via the system resolver; the attribution cache is *forward* DNS (domain to IPs) harvested from observed packets. The two are complementary and the UI prefers the attribution cache when both have a name.
+**Distinct from `network::dns::DnsResolver`**: that component performs *reverse* DNS (IP to PTR) via the system resolver; the attribution cache is *forward* DNS (domain to IPs) harvested from observed packets. The two are complementary. In development builds, the UI shows reverse DNS in Remote and DNS attribution in App, with SNI / Host taking precedence over inferred names.
 
 CNAME chains need no separate map: the DNS DPI parser records the original *question* name, and the answer's A/AAAA records map directly to it. Capturing at the wire sees fewer signals than an eBPF socket-level approach (no app-to-stub traffic on `lo` unless captured, no D-Bus resolutions, no DoH/DoT plaintext); this is a known limitation.
 
```

**File**: `ARCHITECTURE.zh-CN.md` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ flowchart LR
 
 **竞争安全**：`attribute()` 先把连接登记到待归因索引，然后重查缓存。如果同一 IP 的并发 `record_and_drain_pending()` 恰好落在查找和登记之间，重查会为连接打上标签；此时已过时的登记是无害的，会在连接被清理时由 `forget_pending` 移除，或在新鲜窗口过后由待归因清理移除。
 
-**与 `network::dns::DnsResolver` 的区别**：后者通过系统解析器执行*反向* DNS（IP 到 PTR）；归因缓存则是从观测到的数据包中收集的*正向* DNS（域名到 IP）。两者互补，当两边都有名字时 UI 优先使用归因缓存。
+**与 `network::dns::DnsResolver` 的区别**：后者通过系统解析器执行*反向* DNS（IP 到 PTR）；归因缓存则是从观测到的数据包中收集的*正向* DNS（域名到 IP）。两者互补。在开发版本中，UI 在 Remote 中显示反向 DNS，在 App 中显示 DNS 归因；SNI / Host 名称优先于推断名称。
 
 CNAME 链不需要单独的映射：DNS DPI 解析器记录的是原始*问题*名称，应答中的 A/AAAA 记录直接映射到它。在线路层捕获看到的信号比 eBPF 套接字层方案少（除非同时捕获 `lo`，否则看不到应用到 stub 的流量；看不到 D-Bus 解析；看不到 DoH/DoT 明文）；这是已知限制。
 
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -59,6 +59,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   the selected process group
 
 ### Changed
+- Move DNS-inferred hostnames from Remote to App and their Details metadata
+  into the Application card, retaining the `~` marker and SNI / Host precedence (#638)
 - **Documentation accuracy**: Align English, Chinese, and Japanese feature
   claims, installation and profiling steps, sandbox limits, and the roadmap
   with the current implementation.
```

**File**: `USAGE.md` (modified, +3/-5)
```diff
@@ -1235,13 +1235,11 @@ RustNet uses intelligent timeout management to automatically clean up inactive c
 
 ### Hostname Display
 
-Hostnames extracted from the connection itself (TLS SNI from HTTPS or QUIC, the HTTP `Host:` header) are shown in the **App** column. The name in the **Remote** column is chosen by priority (toggle hostnames with the `d` key):
+Hostnames extracted from the connection itself (TLS SNI from HTTPS or QUIC, the HTTP `Host:` header) are shown in the **App** column. In development builds, DNS-attributed names also appear in **App**, for example `TCP·HTTPS (~example.com)` or `UDP (~example.com)` when no application protocol is detected. They appear when no SNI / Host name is available and a DNS resolution to the remote IP was observed within the last **10 seconds**. Compact App columns omit hostname metadata.
 
-1. **DNS-attributed hostname**: rendered as `~name:port` in a dim color when the connection carries no SNI / Host header but a DNS resolution to this IP was observed within the last **10 seconds**
-2. **Reverse DNS** (system resolver, unless disabled with `--no-resolve-dns`)
-3. **Raw IP address**
+The **Remote** column shows reverse DNS (unless disabled with `--no-resolve-dns`), falling back to the raw IP address. The `d` key toggles reverse-DNS names without hiding application names.
 
-The leading `~` glyph signals that the hostname was *inferred* from a DNS response seen on the wire, not extracted from the connection. This is most useful for QUIC sessions after the handshake (where SNI is encrypted) and for plain TCP/UDP connections that carry no hostname-bearing payload. Attribution needs no active lookups, so it works even with `--no-resolve-dns`. The Details tab shows a separate **Attributed Name** row with the full inferred hostname, plus an **Attributed Via** row with the source and observation age (`Captured DNS, 5s ago`) so the provenance is explicit. Attributed names are searchable like any other hostname: both the `sni:` / `host:` / `hostname:` keyword filter and the free-text search match them.
+The leading `~` glyph signals that the hostname was *inferred* from a DNS response seen on the wire, not extracted from the connection. This is most useful for QUIC sessions after the handshake (where SNI is encrypted) and for plain TCP/UDP connections that carry no hostname-bearing payload. Attribution needs no active lookups, so it works even with `--no-resolve-dns`. In development builds, the Details tab’s **Application** card shows a separate **Attributed Name** row with the full inferred hostname, plus an **Attributed Via** row with the source and observation age (`Captured DNS, 5s ago`) so the provenance is explicit. Attributed names are searchable like any other hostname: both the `sni:` / `host:` / `hostname:` keyword filter and the free-text search match them.
 
 **Caveats** (RustNet learns names by sniffing DNS on the wire):
 
```

**File**: `USAGE.zh-CN.md` (modified, +3/-5)
```diff
@@ -1156,13 +1156,11 @@ RustNet 使用智能超时管理自动清理不活跃的连接，同时在移除
 
 ### 主机名显示
 
-从连接本身提取的主机名（HTTPS 或 QUIC 的 TLS SNI、HTTP `Host:` 头）显示在 **App** 列中。**Remote** 列中的名称按以下优先级选择（用 `d` 键切换主机名显示）：
+从连接本身提取的主机名（HTTPS 或 QUIC 的 TLS SNI、HTTP `Host:` 头）显示在 **App** 列中。在开发版本中，DNS 归因主机名也显示在 **App** 中，例如 `TCP·HTTPS (~example.com)`；尚未识别应用协议时显示为 `UDP (~example.com)`。当连接没有 SNI / Host 名称，且最近 **10 秒**内观测到了指向远程 IP 的 DNS 解析时，显示此推断名称。紧凑的 App 列省略主机名元数据。
 
-1. **DNS 归因主机名**：当连接不携带 SNI / Host 头，但在最近 **10 秒**内观测到了指向该 IP 的 DNS 解析时，以暗色的 `~name:port` 形式渲染
-2. **反向 DNS**（系统解析器，除非用 `--no-resolve-dns` 禁用）
-3. **原始 IP 地址**
+**Remote** 列显示反向 DNS 名称（除非用 `--no-resolve-dns` 禁用），否则显示原始 IP 地址。`d` 键切换反向 DNS 名称，不会隐藏应用名称。
 
-前缀 `~` 表示该主机名是从 DNS 响应*推断*出来的，而非从连接本身提取。这对握手后的 QUIC 会话（SNI 已加密）以及不携带主机名载荷的纯 TCP/UDP 连接最有用。归因不需要主动查询，因此即使使用 `--no-resolve-dns` 也能工作。详情标签页会单独显示一行 **Attributed Name**（完整的推断主机名），以及一行 **Attributed Via**（来源和观测时间，如 `Captured DNS, 5s ago`），使来源一目了然。归因主机名可以像其他主机名一样搜索：`sni:` / `host:` / `hostname:` 关键字过滤器和自由文本搜索都能匹配它们。
+前缀 `~` 表示该主机名是从 DNS 响应*推断*出来的，而非从连接本身提取。这对握手后的 QUIC 会话（SNI 已加密）以及不携带主机名载荷的纯 TCP/UDP 连接最有用。归因不需要主动查询，因此即使使用 `--no-resolve-dns` 也能工作。在开发版本中，详情标签页的 **Application** 卡片会单独显示一行 **Attributed Name**（完整的推断主机名），以及一行 **Attributed Via**（来源和观测时间，如 `Captured DNS, 5s ago`），使来源一目了然。归因主机名可以像其他主机名一样搜索：`sni:` / `host:` / `hostname:` 关键字过滤器和自由文本搜索都能匹配它们。
 
 **注意事项**（RustNet 通过嗅探线上的 DNS 学习名称）：
 
```

---

### Incident Patch 2: `36b55bd7` (2026-09-26)
**Commit Message**: fix: retain short Kubernetes flow attribution (#634)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -126,6 +126,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- **Short Kubernetes flows**: retain cgroup v2 pod/container identity with eBPF
+  socket records after process exit, match both endpoint orientations, and
+  evict old records when the map fills.
+  Track evidence export before debug-pod cleanup in the separate
+  [kubectl-rustnet follow-up](https://github.com/domcyrus/kubectl-rustnet/issues/20).
 - Clarify unreleased features and Windows setup in all three documentation
   languages; link v1.6.0 docs and add release checks for availability notes (#620)
 - **Connection viewport**: paging, scrollbars, and mouse targets track the current
```

**File**: `KUBERNETES.ja.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Kubernetes のキャプチャと証拠の保存
+
+[English](KUBERNETES.md) | [简体中文](KUBERNETES.zh-CN.md)
+
+## 短い接続（未リリース）
+
+Linux eBPF と cgroup v2 を使用する場合、RustNet は socket イベントの時点でコンテナと親 pod の cgroup 名を保持します。標準的な systemd と cgroupfs の Kubernetes 構成では、5 秒間隔の名前空間スキャンの間に接続が開始して終了しても、プロセス終了後に所有者を特定できます。検索は観測したエンドポイントの方向（送信元アドレスのワイルドカードを含む）を先に確認し、その後に逆方向を試すため、ホストでのキャプチャでも pod のネットワーク名前空間内の socket を照合できます。Pod とコンテナの名前は既存の kubelet ログのメタデータから解決します。イベントに記録された pod UID とコンテナ ID は、PID ごとのキャッシュより優先されます。
+
+Socket マップは最大 32,768 個の接続タプルを保持し、容量が不足すると古い記録を破棄します。既存のクリーンアップは 30 秒間隔で、60 秒より古い記録を削除します。同じタプルの新しいイベントは所有者情報を置き換えます。保持したイベントはキャプチャ済みパケットの所有者特定に使われ、取り逃したパケットを復元するものではありません。イベントには 2 つの cgroup 名だけが含まれるため、この情報源を使う場合は `cgroup_path` を省略します。
+
+Cgroup v1、コンテナ配下の入れ子の cgroup、eBPF が利用できない環境、読み取れないか切り詰められた cgroup 名では、引き続き procfs スキャンに依存し、スキャンの間に終了するプロセスを取り逃す場合があります。読みやすい名前の解決には kubelet ログのメタデータが必要です。
+
+## エクスポートの後続作業
+
+kubectl プラグインは別のリポジトリ [domcyrus/kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet) で管理されています。連携する [`--output-dir` の後続タスク](https://github.com/domcyrus/kubectl-rustnet/issues/20) では、キャプチャを正常に停止し、JSONL または PCAPNG の証拠ファイル（sidecar を含む）をフラッシュしてコピーした後に、デバッグ pod を削除する必要があります。コピーが失敗した場合は pod を保持し、復旧手順を表示します。
+
+このオプションはプラグインで計画中の機能であり、今回の RustNet の変更には実装されていません。対応版が出るまでは、セッションを終了する前に、デバッグ pod が動作している間に `kubectl cp` でファイルをコピーしてください。Kubernetes の設定は[使用ガイド（英語）](USAGE.md#--kubernetes-mode-optional-feature)を参照してください。
```

**File**: `KUBERNETES.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Kubernetes capture and evidence
+
+[简体中文](KUBERNETES.zh-CN.md) | [日本語](KUBERNETES.ja.md)
+
+## Short flows (unreleased)
+
+With Linux eBPF and cgroup v2, RustNet retains the container and parent pod cgroup names at each socket event. Standard systemd and cgroupfs Kubernetes layouts can therefore be attributed after the process exits, even when the flow starts and ends between the five-second namespace scans. Lookup tries the observed endpoint orientation first, including wildcard source addresses, then the reverse orientation, so host capture can match sockets in a pod network namespace. Pod and container names are resolved from the existing kubelet log metadata. The recorded pod UID and container ID take precedence over cached PID metadata.
+
+The socket map holds up to 32,768 tuples and evicts older records under pressure. Existing cleanup removes records more than 60 seconds old on a 30-second cleanup cadence. A newer event for the same tuple replaces its owner. Retained events supply attribution for captured packets; they do not reconstruct packets missed by capture. The event contains two cgroup names, so `cgroup_path` is omitted when enrichment uses this source.
+
+Cgroup v1, nested cgroups below the container, unavailable eBPF, and unreadable or truncated cgroup names still rely on procfs discovery and can miss processes that exit between scans. Human-readable names require the kubelet log metadata to remain available.
+
+## Export follow-up
+
+The kubectl plugin lives in a separate repository: [domcyrus/kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet). Its coordinated [`--output-dir` follow-up](https://github.com/domcyrus/kubectl-rustnet/issues/20) must stop capture gracefully, flush and copy JSONL or PCAPNG evidence (including any sidecar), and only then delete the debug pod. If copying fails, it must preserve the pod and report recovery instructions.
+
+This flag is planned in the plugin, not implemented by this RustNet change. Until it ships, copy exports with `kubectl cp` while the debug pod is still running, before quitting the session. See the [usage guide](USAGE.md#--kubernetes-mode-optional-feature) for Kubernetes setup.
```

**File**: `KUBERNETES.zh-CN.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# Kubernetes 抓包与证据导出
+
+[English](KUBERNETES.md) | [日本語](KUBERNETES.ja.md)
+
+## 短连接（尚未发布）
+
+在启用 Linux eBPF 和 cgroup v2 时，RustNet 会在 socket 事件发生时保留容器及其父 pod 的 cgroup 名称。因此，对于标准 systemd 和 cgroupfs Kubernetes 布局，即使连接在间隔五秒的两次命名空间扫描之间建立并结束，进程退出后仍可识别归属。查询先尝试观测到的端点方向（包括源地址通配匹配），再尝试反向匹配，因此主机上的抓包也能匹配 pod 网络命名空间内的 socket。Pod 和容器名称通过现有的 kubelet 日志元数据解析。事件中的 pod UID 和容器 ID 优先于按 PID 缓存的元数据。
+
+Socket 映射最多保留 32,768 个连接元组，容量不足时淘汰较旧记录。现有清理机制每 30 秒清理超过 60 秒的记录。同一元组的新事件会替换其所有者。保留的事件用于为已捕获的数据包补充归属信息，不能重建漏抓的数据包。事件只包含两个 cgroup 名称，因此使用该来源时不提供 `cgroup_path`。
+
+Cgroup v1、容器下的嵌套 cgroup、eBPF 不可用，以及无法读取或被截断的 cgroup 名称仍依赖 procfs 扫描，可能遗漏在两次扫描之间退出的进程。解析可读名称需要相应的 kubelet 日志元数据仍然存在。
+
+## 导出后续工作
+
+kubectl 插件位于独立仓库：[domcyrus/kubectl-rustnet](https://github.com/domcyrus/kubectl-rustnet)。配套的 [`--output-dir` 后续任务](https://github.com/domcyrus/kubectl-rustnet/issues/20) 要求先正常停止抓包，刷新并复制 JSONL 或 PCAPNG 证据（包括 sidecar），然后才能删除调试 pod。如果复制失败，必须保留 pod 并提供恢复说明。
+
+该参数属于插件的计划功能，本次 RustNet 修改尚未实现。在插件支持该功能之前，请在调试 pod 仍运行时、退出会话之前使用 `kubectl cp` 复制文件。Kubernetes 配置见[使用指南](USAGE.zh-CN.md#--kubernetes-mode-optional-feature)。
```

**File**: `README.ja.md` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ macOS で PKTAP を使用するには `sudo` が必要です。BPF へのアク
 - [使用方法](USAGE.md): 操作、フィルター、自動化、キャプチャの出力
 - [セキュリティ](SECURITY.md): サンドボックスと権限管理
 - [アーキテクチャ](ARCHITECTURE.md): プラットフォーム別の実装と性能
+- [Kubernetes のキャプチャ](KUBERNETES.ja.md): 所有者特定の制限と証拠保存の後続作業
 - [変更履歴](CHANGELOG.md): リリース済みおよび今後の変更
 - [貢献](CONTRIBUTING.md): コントリビューションガイド
 
```

---

### Incident Patch 3: `9278d367` (2026-09-21)
**Commit Message**: fix: navigate connections with the Details mouse wheel (#621)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -113,6 +113,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   languages; link v1.6.0 docs and add release checks for availability notes (#620)
 - **Connection viewport**: paging, scrollbars, and mouse targets track the current
   layout immediately after resizing, including filters and two-row capture errors.
+- **Details Mouse Navigation**: the scroll wheel now selects the previous or
+  next connection, matching Overview. Use `Ctrl+D` / `Ctrl+U` to scroll long records
 - **Required UID Drop**: abort startup before packet-processing workers when a
   requested root UID/GID drop fails, including in best-effort mode
 - **Windows Connection History**: connections that reuse a tuple with the
```

**File**: `README.ja.md` (modified, +3/-0)
```diff
@@ -165,6 +165,9 @@ Overview の下部ステータスバーでは、プロセスグループ表示
 有効状態がハイライトされます。グループ表示中は、選択したグループに
 応じて `space expand` または `space collapse` も表示されます。
 
+Details ではマウスホイールで前後の接続に切り替えます。グループの見出しは
+スキップします。長い接続情報は `Ctrl+D` / `Ctrl+U` でスクロールできます。
+
 フィルター例:
 
 ```text
```

**File**: `USAGE.md` (modified, +3/-0)
```diff
@@ -529,8 +529,11 @@ RustNet has full mouse support. Mouse capture is enabled automatically — all i
 
 | Action | Effect |
 |--------|--------|
+| **Scroll wheel** | Show the previous/next connection, skipping group headers |
 | **Click** on any field line | Copy the field value to the system clipboard |
 
+Use `Ctrl+D` / `Ctrl+U` to scroll long connection information panes.
+
 Clicking a field copies just the value (not the label). For example, clicking the "Remote Address: 142.250.80.46:443" line copies `142.250.80.46:443` to your clipboard. A confirmation message appears in the status bar for 3 seconds.
 
 Both the "Connection Information" and "Traffic Statistics" panels support click-to-copy.
```

**File**: `USAGE.zh-CN.md` (modified, +3/-0)
```diff
@@ -484,8 +484,11 @@ RustNet 具有完整的鼠标支持。鼠标捕获自动启用 —— 以下描
 
 | 操作 | 效果 |
 |------|------|
+| **滚轮** | 显示上一个或下一个连接，跳过分组头部 |
 | **单击** 任意字段行 | 将字段值复制到系统剪贴板 |
 
+使用 `Ctrl+D` / `Ctrl+U` 滚动较长的连接信息面板。
+
 单击字段仅复制值（不包括标签）。例如，单击 "Remote Address: 142.250.80.46:443" 行会将 `142.250.80.46:443` 复制到剪贴板。状态栏会显示 3 秒的确认消息。
 
 "Connection Information" 和 "Traffic Statistics" 两个面板都支持点击复制。
```

**File**: `src/tui.rs` (modified, +3/-4)
```diff
@@ -159,9 +159,8 @@ where
                 crossterm::event::Event::Mouse(mouse) => {
                     use crossterm::event::{MouseButton, MouseEventKind};
 
-                    // Active tab's Component gets first crack; currently
-                    // only OverviewTab claims (scroll wheel inside the
-                    // scroll area). Click events fall through to the
+                    // The active component handles wheel events.
+                    // Unclaimed click events fall through to the
                     // global ClickableRegions dispatch below.
                     let grouped_opt = if ui_state.grouping_enabled {
                         Some(grouped_rows.as_slice())
@@ -281,7 +280,7 @@ where
                             }
                         }
                     }
-                    // Scroll events are handled by OverviewTab::handle_mouse above.
+                    // Scroll events are handled by the active component above.
                 }
                 crossterm::event::Event::Key(key) => {
                     use crossterm::event::{KeyCode, KeyEventKind, KeyModifiers};
```

---

### Incident Patch 4: `3e3815df` (2026-09-17)
**Commit Message**: fix(ebpf): align ConnInfo ABI on 32-bit targets (#612)

ConnInfo has a natural alignment of 4 bytes on 32-bit x86, while the
shared eBPF map ABI requires and asserts 8-byte alignment. Explicitly
align both the Rust and C definitions to keep their ABI consistent
without changing the existing 40-byte size or field offsets.

Fixes #611.

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -58,6 +58,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and PCAPNG export errors spell the format in uppercase
 
 ### Fixed
+- **32-bit eBPF Map ABI**: explicitly align the shared C and Rust `ConnInfo`
+  structures to 8 bytes, fixing compilation on i586 (#611)
 - **macOS Host Tab SYN_RCVD**: sockets that `lsof` reports as `SYN_RCVD` now
   show as SYN received instead of an unknown state
 
```

**File**: `crates/rustnet-host/src/linux/ebpf/maps_libbpf.rs` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ pub(super) struct ConnKey {
 }
 
 /// Raw process identity matching `socket_tracker_types.h`.
-#[repr(C)]
+#[repr(C, align(8))]
 #[derive(Debug, Clone, Copy, PartialEq, Eq)]
 struct ConnInfo {
     pub tgid: u32,
```

**File**: `crates/rustnet-host/src/linux/ebpf/programs/socket_tracker_types.h` (modified, +3/-1)
```diff
@@ -38,11 +38,13 @@ struct conn_info
     __u32 gid;
     char comm[TASK_COMM_LEN];
     __u64 timestamp;
-};
+} __attribute__((aligned(8)));
 
 _Static_assert(sizeof(struct conn_key) == CONN_KEY_SIZE,
                "conn_key map ABI size changed");
 _Static_assert(sizeof(struct conn_info) == CONN_INFO_SIZE,
                "conn_info map ABI size changed");
+_Static_assert(__alignof__(struct conn_info) == 8,
+               "conn_info map ABI alignment changed");
 
 #endif
```

---

### Incident Patch 5: `747f265d` (2026-09-04)
**Commit Message**: fix: align Cargo dependencies (#605)

* fix: align toml dependency with lockfile

* chore(deps): update workspace dependencies

**File**: `Cargo.lock` (modified, +372/-511)
```diff
@@ -16,14 +16,14 @@ checksum = "f8eb277bec05f56a0e0591f155a484cbd0f4f07ff2905051a48c72f004f7ed58"
 dependencies = [
  "cipher",
  "cpubits",
- "cpufeatures 0.3.0",
+ "cpufeatures 0.3.1",
 ]
 
 [[package]]
 name = "aho-corasick"
-version = "1.1.4"
+version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ddd31a130427c27518df266943a5308ed92d4b226cc639f5a8f1002816174301"
+checksum = "c982642fa9e8606056828ee9a8505737230110bb1099153c79efe865c59d12ba"
 dependencies = [
  "memchr",
 ]
@@ -45,9 +45,9 @@ checksum = "683d7910e743518b0e34f1186f92494becacb047c7b6bf616c96772180fef923"
 
 [[package]]
 name = "android_system_properties"
-version = "0.1.5"
+version = "0.1.6"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
+checksum = "ae221649c9976a6f6c56ae1facf410f3ddb33cc661c4b7b61020a912d4237fbc"
 dependencies = [
  "libc",
 ]
@@ -155,9 +155,9 @@ dependencies = [
 
 [[package]]
 name = "autocfg"
-version = "1.5.0"
+version = "1.5.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c08606f8c3cbf4ce6ec8e28fb0014a2c086708fe954eaa885384a6165172e7e8"
+checksum = "f2032f911046de80f0a198e0901378627c33f59ea0ac00e363d481118bd70a53"
 
 [[package]]
 name = "base64"
@@ -203,19 +203,19 @@ dependencies = [
 
 [[package]]
 name = "block-buffer"
-version = "0.12.0"
+version = "0.12.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cdd35008169921d80bc60d3d0ab416eecb028c4cd653352907921d95084790be"
+checksum = "d2f6c7dbe95a6ed67ad9f18e57daf93a2f034c524b99fd2b76d18fdfeb6660aa"
 dependencies = [
  "hybrid-array",
  "zeroize",
 ]
 
 [[package]]
 name = "bumpalo"
-version = "3.19.1"
+version = "3.20.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "5dd9dc738b7a8311c7ade152424974d8115f2cdad61e8dab8dac9f2362298510"
+checksum = "72f5acc6cb2ba439de613abc23857ec3d78374d8ed5ac84e9d11336e87da8649"
 
 [[package]]
 name = "by_address"
@@ -225,9 +225,9 @@ checksum = "64fa3c856b712db6612c019f14756e64e4bcea13337a6b33b696333a9eaa2d06"
 
 [[package]]
 name = "bytemuck"
-version = "1.25.0"
+version = "1.25.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c8efb64bd706a16a1bdde310ae86b351e4d21550d98d056f22f8a7f7a2183fec"
+checksum = "95832e849adfb21180ccb6826a99da14e5d266ae5c2e668e1602cf234f153797"
 
 [[package]]
 name = "byteorder"
@@ -252,9 +252,9 @@ dependencies = [
 
 [[package]]
 name = "camino"
-version = "1.2.2"
+version = "1.2.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e629a66d692cb9ff1a1c664e41771b3dcaf961985a9774c0eb0bd1b51cf60a48"
+checksum = "bb1307f12aa967b5a58416e87b3653360e0fd614a016b6e970db08fecbb1b80d"
 dependencies = [
  "serde_core",
 ]
@@ -288,7 +288,7 @@ dependencies = [
  "semver",
  "serde",
  "serde_json",
- "thiserror 2.0.18",
+ "thiserror 2.0.20",
 ]
 
 [[package]]
@@ -308,9 +308,9 @@ dependencies = [
 
 [[package]]
 name = "cc"
-version = "1.2.55"
+version = "1.4.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "47b26a0954ae34af09b50f0de26458fa95369a0d478d8236d3f93082b219bd29"
+checksum = "005ec2760ca554fae18df7a11195552ec576cd665632a881bc011d5bb2fd4d80"
 dependencies = [
  "find-msvc-tools",
  "jobserver",
@@ -326,9 +326,9 @@ checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
 
 [[package]]
 name = "cfg_aliases"
-version = "0.2.1"
+version = "0.2.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"
+checksum = "f079e83a288787bcd14a6aea84cee5c87a67c5a3e660c30f557a3d24761b3527"
 
 [[package]]
 name = "chrono"
@@ -372,11 +372,11 @@ dependencies = [
 
 [[package]]
 name = "cipher"
-version = "0.5.1"
+version = "0.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "e34d8227fe1
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ chrono = "0.4"
 ratatui = { version = "0.30", features = ["all-widgets", "unstable-rendered-line-info"] }
 serde = { version = "1.0", features = ["derive"] }
 serde_json = "1.0"
-toml = "0.9"
+toml = "1.1"
 regex-lite = "0.1"
 # Note: dns-lookup, ring, aes, flate2, and maxminddb moved to rustnet-core,
 # which is the only place they are used. They are re-exported transitively
```

**File**: `crates/rustnet-core/Cargo.toml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ log.workspace = true
 dashmap.workspace = true
 rustc-hash.workspace = true
 crossbeam.workspace = true
-dns-lookup = "3.0"
+dns-lookup = "4.0"
 pnet_datalink = "0.35"
 maxminddb = "0.30"
 flate2 = "1"
```

---

### Incident Patch 6: `47f34d7f` (2026-08-30)
**Commit Message**: fix(linux): drop fake "unknown" process name (#590)

A process that exits mid-/proc-scan was stored under the literal name
"unknown", showing as its own group and overriding the eBPF-captured
comm. Skip it instead. (#590)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -31,6 +31,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Bogus "unknown" Process Group on Linux**: a process that exited while
+  RustNet scanned `/proc` was recorded under the literal name `unknown`, which
+  showed up as its own process group next to the real `<unknown>` bucket and,
+  with eBPF attribution, overrode the correct name the kernel had captured at
+  socket creation. Such a process is now skipped instead (#590)
 - **TCP Window Size Per Direction**: the Details Transport Health card kept a
   single window slot that every segment overwrote, so the value flipped
   between the local and remote advertised windows. Both are now shown (`↓`
```

**File**: `crates/rustnet-host/src/linux/process.rs` (modified, +35/-6)
```diff
@@ -34,6 +34,22 @@ pub(crate) fn resolve_credentials(tgid: u32) -> Option<(u32, u32)> {
     Some((metadata.uid(), metadata.gid()))
 }
 
+/// Read a process's name from `/proc/<pid>/comm`, given the process directory.
+///
+/// Returns `None` when comm is unreadable or empty, which happens when the
+/// process exits mid-scan. Callers skip such a process rather than storing a
+/// placeholder name: the fd scan has nothing left to read either, and a
+/// placeholder would surface as its own process group in the UI and outrank
+/// the eBPF-captured comm via the PID name cache.
+fn read_process_name(proc_dir: &Path) -> Option<String> {
+    let comm = fs::read_to_string(proc_dir.join("comm")).ok()?;
+    let name = comm.trim();
+    if name.is_empty() {
+        return None;
+    }
+    Some(name.to_string())
+}
+
 /// Recover a comm-truncated process name from the executable's file name.
 ///
 /// The kernel `comm` field holds at most 15 bytes, so both eBPF and the procfs
@@ -584,12 +600,11 @@ impl LinuxProcessLookup {
                     continue;
                 }
 
-                // Get process name
-                let comm_path = path.join("comm");
-                let process_name = fs::read_to_string(&comm_path)
-                    .unwrap_or_else(|_| "unknown".to_string())
-                    .trim()
-                    .to_string();
+                // Get process name, skipping the process when comm is
+                // unreadable (see `read_process_name`).
+                let Some(process_name) = read_process_name(&path) else {
+                    continue;
+                };
 
                 // Store PID -> name mapping for all processes
                 #[cfg(feature = "ebpf")]
@@ -783,6 +798,20 @@ mod tests {
     use super::*;
     use rustnet_core::network::types::{ProtocolState, TcpState};
 
+    #[test]
+    fn process_name_comes_from_comm() {
+        let name = read_process_name(Path::new("/proc/self")).expect("own comm is readable");
+        assert!(!name.is_empty());
+        assert_eq!(name, name.trim());
+    }
+
+    #[test]
+    fn no_process_name_when_comm_is_unreadable() {
+        // A PID that cannot exist: the process directory is gone, as it is
+        // for a process that exits between the /proc listing and the read.
+        assert_eq!(read_process_name(Path::new("/proc/0")), None);
+    }
+
     fn connection(local: &str, remote: &str) -> Connection {
         Connection::new(
             Protocol::Tcp,
```

---

### Incident Patch 7: `786c660a` (2026-08-30)
**Commit Message**: fix: correct TCP window and duplicate-ACK reporting (#589)

* fix(ui): report TCP window size per direction

One shared slot was overwritten by whichever side sent last, so the
Details window jumped between the local and remote advertised windows.
Track both, and show bytes only when the handshake proved the scale.

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -31,6 +31,25 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **TCP Window Size Per Direction**: the Details Transport Health card kept a
+  single window slot that every segment overwrote, so the value flipped
+  between the local and remote advertised windows. Both are now shown (`↓`
+  local, `↑` remote), in bytes only when the captured handshake proved the
+  window scale. Without it the scale is unknowable from the wire, so the row
+  reads `unknown (no handshake)` rather than a raw header field that stands
+  for anything up to 16384 times its value; the Details help and USAGE explain
+  it (#589)
+- **TCP Analytics for a Connection's First Packet**: the packet that creates a
+  connection now reaches the TCP analytics. For a connection this host
+  initiates that packet is its own SYN, the only carrier of the local
+  window-scale option, so windows could never be reported in bytes even with
+  the whole handshake captured (#589)
+- **Duplicate ACK False Positives**: a repeated ACK only counts as a duplicate
+  when this host has data outstanding and the advertised window is unchanged
+  (RFC 5681), so an idle connection's keepalives and the peer's window updates
+  no longer inflate the counter or report a fast retransmit on a connection
+  that never retransmitted. A RST no longer overwrites the last advertised
+  window with its meaningless zero (#589)
 - **Default Npcap Installations on Windows**: RustNet now finds Npcap in its
   standard `System32\Npcap` directory, so WinPcap API-compatible mode is no
   longer required. `--help` and `--version` also work without Npcap installed
```

**File**: `USAGE.md` (modified, +16/-0)
```diff
@@ -799,6 +799,22 @@ Fast Retransmits: 0
 
 These counters are tracked independently for each connection, allowing you to identify problematic connections experiencing packet loss or network issues.
 
+**Window Size**
+The same card reports each end's last advertised receive window as a pair:
+`↓` is the window this host advertised, which bounds inbound data, and `↑` the
+one the remote advertised, which bounds outbound data.
+
+```
+Window Size  ↓ 137.50 KB · ↑ 1.00 KB
+```
+
+Window scaling is negotiated only in the SYN handshake (RFC 7323), so a
+connection that was already open when RustNet started reads
+`unknown (no handshake)`. The 16-bit header field on its own stands for
+anything up to 16384 times its value, so it is reported as unknown rather than
+as a size that cannot be acted on. Connections opened while RustNet is running
+show byte counts.
+
 ### Use Cases
 
 **Network Quality Monitoring**
```

**File**: `USAGE.zh-CN.md` (modified, +13/-0)
```diff
@@ -783,6 +783,19 @@ Fast Retransmits: 0
 
 这些计数器独立追踪每个连接，允许你识别遇到数据包丢失或网络问题的有问题连接。
 
+**Window Size（窗口大小）**
+同一张卡片还成对显示两端最后通告的接收窗口：`↓` 是本机通告的窗口，
+限制入站数据；`↑` 是对端通告的窗口，限制出站数据。
+
+```
+Window Size  ↓ 137.50 KB · ↑ 1.00 KB
+```
+
+窗口缩放只在 SYN 握手中协商（RFC 7323），因此 RustNet 启动前就已建立的
+连接显示 `unknown (no handshake)`。仅凭 16 位首部字段，实际窗口可能是其
+数值的 1 到 16384 倍，与其给出无法据此判断的大小，不如报告为未知。
+在 RustNet 运行期间建立的连接会显示字节数。
+
 ### 使用场景<a id="use-cases"></a>
 
 **网络质量监控**
```

**File**: `crates/rustnet-core/src/network/merge.rs` (modified, +290/-57)
```diff
@@ -4,7 +4,7 @@ use log::{debug, info, warn};
 use std::time::{Duration, SystemTime};
 
 use crate::network::dpi::{DpiResult, is_partial_sni, try_extract_tls_from_reassembler};
-use crate::network::parser::{ParsedPacket, SynWindowScale, TcpFlags};
+use crate::network::parser::{ParsedPacket, SynWindowScale, TcpFlags, TcpHeaderInfo};
 use crate::network::types::{
     ApplicationProtocol, Connection, DnsInfo, DpiInfo, FtpInfo, HttpInfo, MqttInfo, NetBiosInfo,
     ProtocolState, QuicConnectionState, QuicInfo, SshInfo, TcpState, TlsInfo,
@@ -89,10 +89,29 @@ struct TcpSegment {
     is_outgoing: bool,
     has_ack_flag: bool,
     is_syn: bool,
+    is_rst: bool,
     /// Window-scale verdict from this segment's options (SYN only).
     window_scale: Option<SynWindowScale>,
 }
 
+/// The analytics view of one packet's TCP header.
+fn tcp_segment_from(parsed: &ParsedPacket, tcp_header: &TcpHeaderInfo) -> TcpSegment {
+    TcpSegment {
+        seq: tcp_header.seq,
+        ack: tcp_header.ack,
+        window: tcp_header.window,
+        // SYN and FIN each consume a sequence number even with no payload.
+        payload_len: tcp_header.payload_len
+            + u32::from(tcp_header.flags.syn)
+            + u32::from(tcp_header.flags.fin),
+        is_outgoing: parsed.is_outgoing,
+        has_ack_flag: tcp_header.flags.ack,
+        is_syn: tcp_header.flags.syn,
+        is_rst: tcp_header.flags.rst,
+        window_scale: tcp_header.window_scale,
+    }
+}
+
 /// Analyze TCP segment and update analytics for retransmissions, packet
 /// quality, and round-trip timing. `at` is the packet's capture timestamp.
 fn analyze_tcp_segment(
@@ -108,9 +127,13 @@ fn analyze_tcp_segment(
         is_outgoing,
         has_ack_flag,
         is_syn,
+        is_rst,
         window_scale,
     } = segment;
     let mut events = TcpMergeEvents::default();
+    // Read before this segment overwrites it: RFC 5681 asks whether the
+    // window moved, which only the previous advertisement can answer.
+    let previous_window_in = analytics.last_window_in;
 
     // Learn each side's window-scale shift from its SYN. Only a fully
     // examined SYN without the option turns scaling off (RFC 7323); a SYN
@@ -131,14 +154,13 @@ fn analyze_tcp_segment(
         }
     }
 
-    // Track window size. SYN windows are never scaled; for data segments the
-    // sender's negotiated shift applies (0 when the handshake wasn't seen).
-    analytics.last_window_size = window;
-    analytics.last_window_shift = if is_syn {
-        0
-    } else {
-        analytics.window_shift_for(is_outgoing)
-    };
+    // Track the advertised window per direction, since each end advertises
+    // its own and one shared slot would flip between them packet by packet.
+    // A RST carries no meaningful window (RFC 9293 §3.1), so it must not
+    // overwrite the last real advertisement with a zero.
+    if !is_rst {
+        analytics.record_window(window, is_outgoing, is_syn);
+    }
 
     if is_outgoing {
         // Outbound packet - check for retransmissions
@@ -218,25 +240,38 @@ fn analyze_tcp_segment(
 
         // Check for duplicate ACKs (fast retransmit indicator).
         //
-        // RFC 5681 §2 requires a duplicate ACK to carry no data — otherwise
-        // every inbound data segment of a download counts as one, since they
-        // all repeat the same ack number while we have nothing to send, and
-        // the fast-retransmit total balloons on healthy connections.
+        // RFC 5681 §2 counts an ACK as duplicate only when it carries no data
+        // (SYN and FIN consume sequence space, so `payload_len` covers both),
+        // this host still has data outstanding, the ack number does not
+        // advance, and the advertised window is unchanged. All four matter:
+        // without the no-data test every inbound segment of a download counts,
+        // and without the outstanding-data and window tests an idle
+        // connection's keepa
```

**File**: `crates/rustnet-core/src/network/types/rates.rs` (modified, +61/-15)
```diff
@@ -243,6 +243,31 @@ impl Default for RateTracker {
     }
 }
 
+/// One direction's most recently advertised receive window. The header
+/// field is 16 bits; the real window is that value shifted by the sender's
+/// window-scale option from its SYN (RFC 7323), so the shift is kept with
+/// the sample that it applies to.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub struct WindowSample {
+    /// Raw 16-bit header field, before window scaling.
+    pub raw: u16,
+    /// Shift applying to `raw`: 0 on a SYN, and whenever scaling is off or
+    /// was never observed.
+    pub shift: u8,
+    /// The shift is the negotiated one rather than an assumption. False when
+    /// the handshake was missed, where the true window is `raw` shifted by
+    /// an unknown amount and only `raw` can honestly be shown.
+    pub scale_known: bool,
+}
+
+impl WindowSample {
+    /// Advertised window in bytes. Only meaningful when `scale_known`;
+    /// otherwise it is the raw field with no shift applied.
+    pub fn bytes(&self) -> u64 {
+        (self.raw as u64) << self.shift
+    }
+}
+
 /// TCP analytics for tracking retransmissions and connection quality
 #[derive(Debug, Clone)]
 pub struct TcpAnalytics {
@@ -269,14 +294,14 @@ pub struct TcpAnalytics {
     pub out_of_order_count: u64,
     pub fast_retransmit_count: u64,
 
-    // Window tracking. The header field is 16 bits; the real window is that
-    // value shifted by the sender's window-scale option from its SYN
-    // (RFC 7323). Scaling is only in effect when both SYNs offered it, so
-    // both shifts are tracked and a SYN without the option disables scaling.
-    pub last_window_size: u16,
-    /// Shift that applies to `last_window_size` (0 when scaling is off,
-    /// unknown, or the segment was a SYN, whose window is never scaled).
-    pub last_window_shift: u8,
+    // Window tracking. Each end advertises its own receive window, so the
+    // two are kept apart: a single last-segment slot flips between them on
+    // every packet and reads as a wildly jumping value.
+    /// Last window advertised by this host, which bounds what the remote
+    /// may send us.
+    pub last_window_out: Option<WindowSample>,
+    /// Last window advertised by the remote, which bounds what we may send.
+    pub last_window_in: Option<WindowSample>,
     /// Window-scale shift advertised by the local side's SYN.
     pub window_scale_out: Option<u8>,
     /// Window-scale shift advertised by the remote side's SYN.
@@ -308,8 +333,8 @@ impl TcpAnalytics {
             retransmit_count: 0,
             out_of_order_count: 0,
             fast_retransmit_count: 0,
-            last_window_size: 0,
-            last_window_shift: 0,
+            last_window_out: None,
+            last_window_in: None,
             window_scale_out: None,
             window_scale_in: None,
             window_scaling_disabled: false,
@@ -318,11 +343,32 @@ impl TcpAnalytics {
         }
     }
 
-    /// Last advertised window in bytes, with the sender's window-scale
-    /// shift applied when the handshake negotiated one. Falls back to the
-    /// raw header value when the handshake was not observed.
-    pub fn last_window_bytes(&self) -> u64 {
-        (self.last_window_size as u64) << self.last_window_shift
+    /// Whether the window scaling in effect is known: both SYNs were seen,
+    /// or one of them proved the option absent. Until then a non-SYN window
+    /// is a raw header field with an unknown multiplier, not a byte count.
+    pub fn window_scale_known(&self) -> bool {
+        self.window_scaling_disabled
+            || (self.window_scale_out.is_some() && self.window_scale_in.is_some())
+    }
+
+    /// Record one direction's advertised window. `is_syn` matters twice: a
+    /// SYN's window is never scaled (RFC 7323), which also makes it an exact
+    /// byte count even when the rest of the handshake was missed.
+    pub fn record_window(&mut self, window: u16, is_outgoing: b
```

---

### Incident Patch 8: `4da0d53b` (2026-08-28)
**Commit Message**: fix(linux): keep attribution for connections that predate startup (#575)

* fix(linux): keep the privileged startup socket snapshot for pre-existing connections

**File**: `ARCHITECTURE.md` (modified, +3/-1)
```diff
@@ -263,6 +263,7 @@ The same backend publishes a socket snapshot every 5 seconds for the Host tab. T
 **eBPF Mode (Default on Linux):**
 - Uses kernel eBPF programs attached to socket syscalls
 - Captures socket creation events with process context
+- On Linux 5.11+, runs a one-shot task-file iterator after attaching the live probes to capture owners of sockets that predate RustNet, including other users' sockets in file-capability mode
 - Provides lower overhead than procfs scanning
 - Records the group leader's TGID, the acting TID, and credentials; the name, executable path, and PPID are enriched in user space via procfs
 - **Limitations:**
@@ -273,7 +274,8 @@ The same backend publishes a socket snapshot every 5 seconds for the Host tab. T
   - Note: CAP_NET_ADMIN is NOT required (uses read-only, non-promiscuous packet capture)
 
 **Fallback Behavior:**
-- If eBPF fails to load (permissions, kernel compatibility), automatically falls back to procfs mode
+- If the task-file iterator is unavailable, keeps the live eBPF tracker and uses the procfs startup inventory
+- If the live eBPF tracker fails to load, automatically falls back to procfs mode
 - TUI Statistics panel shows active detection method
 
 #### macOS
```

**File**: `ARCHITECTURE.zh-CN.md` (modified, +3/-1)
```diff
@@ -258,6 +258,7 @@ RustNet 使用平台特定的 API 将网络连接与进程关联。每次归属
 **eBPF 模式（Linux 默认）：**
 - 使用附加到 socket 系统调用的内核 eBPF 程序
 - 捕获带进程上下文的 socket 创建事件
+- 在 Linux 5.11 及更高版本上，先附加实时探针，再运行一次性的 task-file 迭代器，以捕获 RustNet 启动前已存在的 socket 所有者；使用文件 capabilities 运行时也包括其他用户的 socket
 - 比 procfs 扫描开销更低
 - 记录进程组组长的 TGID、当前线程的 TID 以及凭据；进程名、可执行路径和 PPID 在用户态通过 procfs 富化
 - **局限性：**
@@ -268,7 +269,8 @@ RustNet 使用平台特定的 API 将网络连接与进程关联。每次归属
   - 注意：不需要 CAP_NET_ADMIN（使用只读、非混杂包捕获）
 
 **回退行为：**
-- 如果 eBPF 加载失败（权限、内核兼容性），自动回退到 procfs 模式
+- 如果 task-file 迭代器不可用，则保留实时 eBPF 追踪，并使用启动时的 procfs 清单
+- 如果实时 eBPF 追踪器加载失败，则自动回退到 procfs 模式
 - TUI 统计面板显示当前使用的检测方法
 
 #### macOS
```

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -29,6 +29,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Default Npcap Installations on Windows**: RustNet now finds Npcap in its
   standard `System32\Npcap` directory, so WinPcap API-compatible mode is no
   longer required. `--help` and `--version` also work without Npcap installed
+- **Attribution of Pre-Existing Connections on Linux**: connections that were
+  already open before RustNet started keep their process name after privilege
+  reduction, including root services when RustNet runs with file capabilities
+  on Linux 5.11 and newer. A one-shot BPF task-file inventory and the
+  privileged procfs scan feed a validated fallback shown as the "startup
+  snapshot" match quality (#575)
 
 ### Removed
 - **Ubuntu 25.10 (Questing) PPA**: the series reached end of life and
```

**File**: `README.ja.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ RustNet は、各接続を所有するプロセス、通信量、状態、アプ
 ## 主な機能
 
 - TCP、UDP、QUIC 接続とプロセスの対応付け。詳細には PID、実行ファイル、ユーザー/グループ名、照合の信頼度、全プラットフォーム共通の親プロセスチェーン（上限あり）を表示
+- Linux 5.11 以降では、起動時の BPF task-file イテレーターにより、ファイル capabilities で実行した場合でも root や他ユーザーが所有する既存 socket を識別
 - HTTP、TLS/SNI、DNS、SSH、QUIC、WireGuard、OpenVPN などの深層パケット解析
 - TCP、QUIC ハンドシェイク、DNS 応答、ICMP エコーの往復時間（RTT）と、TCP の再送・順序入れ替わりをリアルタイム表示
 - Host タブに TCP LISTEN ソケット、UDP BOUND エンドポイント、TCP 状態集計、観測 RTT、所有プロセス、インターフェース統計を表示
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -63,8 +63,9 @@ RustNet uses kernel eBPF programs by default on Linux for enhanced performance a
 - Short-lived processes that exit before this enrichment runs keep the eBPF-recorded 16-character name
 
 **Fallback Behavior:**
+- On Linux 5.11 and newer, a one-shot BPF task-file iterator inventories sockets that were already open at startup, including sockets owned by root and other users when RustNet runs with file capabilities
 - When eBPF fails to load or lacks sufficient permissions, RustNet automatically falls back to standard procfs-based process identification
-- Standard mode resolves names the same way via procfs scanning, but with higher CPU overhead
+- Older kernels and procfs-only builds resolve names through procfs scanning, which has higher CPU overhead and can only inspect socket owners visible to the RustNet user
 - eBPF is enabled by default; no special build flags needed
 
 To disable eBPF and use procfs-only mode, build with:
```

---

### Incident Patch 9: `8e97c84e` (2026-08-23)
**Commit Message**: fix(windows): accept friendly interface names for -i and list descriptions in the error (#579)

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -2645,6 +2645,7 @@ dependencies = [
  "anyhow",
  "log",
  "pcap",
+ "windows 0.62.2",
 ]
 
 [[package]]
```

**File**: `USAGE.md` (modified, +5/-0)
```diff
@@ -137,6 +137,11 @@ rustnet -i eth0          # Monitor Ethernet interface
 rustnet -i wlan0         # Monitor WiFi interface
 rustnet -i en0           # Monitor macOS primary interface
 
+# Windows: use the adapter's friendly name; it is resolved to the
+# \Device\NPF_{GUID} device automatically
+rustnet -i Ethernet
+rustnet -i "Wi-Fi"
+
 # Monitor VPN and tunnel interfaces (TUN/TAP support)
 rustnet -i utun0         # macOS VPN tunnel (TUN, Layer 3)
 rustnet -i tun0          # Linux/BSD VPN tunnel (TUN, Layer 3)
```

**File**: `USAGE.zh-CN.md` (modified, +5/-0)
```diff
@@ -137,6 +137,11 @@ rustnet -i eth0          # 监控以太网接口
 rustnet -i wlan0         # 监控 WiFi 接口
 rustnet -i en0           # 监控 macOS 主接口
 
+# Windows：可直接使用适配器的友好名称，会自动解析为
+# \Device\NPF_{GUID} 设备
+rustnet -i Ethernet
+rustnet -i "Wi-Fi"
+
 # 监控 VPN 和隧道接口（TUN/TAP 支持）
 rustnet -i utun0         # macOS VPN 隧道（TUN，Layer 3）
 rustnet -i tun0          # Linux/BSD VPN 隧道（TUN，Layer 3）
```

**File**: `crates/rustnet-capture/Cargo.toml` (modified, +7/-0)
```diff
@@ -25,3 +25,10 @@ path = "src/lib.rs"
 anyhow.workspace = true
 log.workspace = true
 pcap = "2.4.0"
+
+[target.'cfg(windows)'.dependencies]
+windows = { version = "0.62", features = [
+    "Win32_Foundation",
+    "Win32_NetworkManagement_IpHelper",
+    "Win32_NetworkManagement_Ndis",
+] }
```

**File**: `crates/rustnet-capture/src/lib.rs` (modified, +71/-2)
```diff
@@ -356,6 +356,56 @@ pub fn validate_interface(interface_name: &Option<String>) -> Result<()> {
     Ok(())
 }
 
+/// Resolve a Windows interface alias ("Ethernet", "Wi-Fi") to the
+/// `\Device\NPF_{GUID}` name Npcap registers the adapter under, via the
+/// interface table's Alias and InterfaceGuid columns. `None` when no
+/// interface carries that alias.
+#[cfg(windows)]
+fn windows_alias_to_npf_name(alias: &str) -> Option<String> {
+    use windows::Win32::NetworkManagement::IpHelper::{FreeMibTable, GetIfTable2, MIB_IF_TABLE2};
+
+    let alias_lower = alias.to_lowercase();
+    // SAFETY: GetIfTable2 allocates the table, which is freed with
+    // FreeMibTable on every path; rows are only read within NumEntries.
+    unsafe {
+        let mut table: *mut MIB_IF_TABLE2 = std::ptr::null_mut();
+        if GetIfTable2(&mut table).is_err() {
+            return None;
+        }
+        let table_ref = table.as_ref()?;
+
+        let mut guid = None;
+        for i in 0..table_ref.NumEntries as usize {
+            let row = &*table_ref.Table.as_ptr().add(i);
+            let row_alias = String::from_utf16_lossy(&row.Alias)
+                .trim_end_matches('\0')
+                .to_lowercase();
+            if row_alias == alias_lower {
+                guid = Some(row.InterfaceGuid);
+                break;
+            }
+        }
+        FreeMibTable(table as *const _);
+
+        guid.map(|g| {
+            format!(
+                "\\Device\\NPF_{{{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}}}",
+                g.data1,
+                g.data2,
+                g.data3,
+                g.data4[0],
+                g.data4[1],
+                g.data4[2],
+                g.data4[3],
+                g.data4[4],
+                g.data4[5],
+                g.data4[6],
+                g.data4[7],
+            )
+        })
+    }
+}
+
 /// Find a capture device by name or return the default
 fn find_capture_device(interface_name: &Option<String>) -> Result<Device> {
     match interface_name {
@@ -393,8 +443,27 @@ fn find_capture_device(interface_name: &Option<String>) -> Result<Device> {
                 return Ok(device.clone());
             }
 
-            // List available interfaces for error message
-            let available: Vec<String> = devices.iter().map(|d| d.name.clone()).collect();
+            // Windows: pcap device names are `\Device\NPF_{GUID}`, which
+            // nobody types. Resolve a friendly alias ("Ethernet", "Wi-Fi")
+            // to its adapter GUID and retry against the NPF name.
+            #[cfg(windows)]
+            if let Some(npf_name) = windows_alias_to_npf_name(name) {
+                let npf_lower = npf_name.to_lowercase();
+                if let Some(device) = devices.iter().find(|d| d.name.to_lowercase() == npf_lower) {
+                    log::info!("Resolved interface alias '{}' to '{}'", name, device.name);
+                    return Ok(device.clone());
+                }
+            }
+
+            // List available interfaces for the error message, with the
+            // human-readable description where the backend provides one.
+            let available: Vec<String> = devices
+                .iter()
+                .map(|d| match &d.desc {
+                    Some(desc) => format!("{} ({})", d.name, desc),
+                    None => d.name.clone(),
+                })
+                .collect();
 
             Err(anyhow!(
                 "Interface '{}' not found. Available interfaces: {}",
```

---

### Incident Patch 10: `23b9793f` (2026-08-23)
**Commit Message**: fix(tcp): apply RFC 7323 window scaling to the displayed window size (#574)

**File**: `benches/connection_merge.rs` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ fn make_parsed_packet() -> rustnet_monitor::network::parser::ParsedPacket {
             rst: false,
         },
         payload_len: 1400,
+        window_scale: None,
     });
     packet
 }
```

**File**: `benches/tracker_ingest.rs` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ fn make_packet(flow: u16, seq: u32) -> ParsedPacket {
             rst: false,
         },
         payload_len: 1400,
+        window_scale: None,
     });
     packet
 }
```

**File**: `crates/rustnet-core/src/network/merge.rs` (modified, +111/-2)
```diff
@@ -4,7 +4,7 @@ use log::{debug, info, warn};
 use std::time::{Duration, SystemTime};
 
 use crate::network::dpi::{DpiResult, is_partial_sni, try_extract_tls_from_reassembler};
-use crate::network::parser::{ParsedPacket, TcpFlags};
+use crate::network::parser::{ParsedPacket, SynWindowScale, TcpFlags};
 use crate::network::types::{
     ApplicationProtocol, Connection, DnsInfo, DpiInfo, FtpInfo, HttpInfo, MqttInfo, NetBiosInfo,
     ProtocolState, QuicConnectionState, QuicInfo, SshInfo, TcpState, TlsInfo,
@@ -88,6 +88,9 @@ struct TcpSegment {
     payload_len: u32,
     is_outgoing: bool,
     has_ack_flag: bool,
+    is_syn: bool,
+    /// Window-scale verdict from this segment's options (SYN only).
+    window_scale: Option<SynWindowScale>,
 }
 
 /// Analyze TCP segment and update analytics for retransmissions, packet
@@ -104,11 +107,38 @@ fn analyze_tcp_segment(
         payload_len,
         is_outgoing,
         has_ack_flag,
+        is_syn,
+        window_scale,
     } = segment;
     let mut events = TcpMergeEvents::default();
 
-    // Track window size
+    // Learn each side's window-scale shift from its SYN. Only a fully
+    // examined SYN without the option turns scaling off (RFC 7323); a SYN
+    // whose options could not be examined (truncated capture, malformed
+    // options) proves nothing, and a complete retransmitted SYN may still
+    // supply the shift later.
+    if is_syn {
+        match window_scale {
+            Some(SynWindowScale::Present(shift)) => {
+                if is_outgoing {
+                    analytics.window_scale_out = Some(shift);
+                } else {
+                    analytics.window_scale_in = Some(shift);
+                }
+            }
+            Some(SynWindowScale::Absent) => analytics.window_scaling_disabled = true,
+            Some(SynWindowScale::Unknown) | None => {}
+        }
+    }
+
+    // Track window size. SYN windows are never scaled; for data segments the
+    // sender's negotiated shift applies (0 when the handshake wasn't seen).
     analytics.last_window_size = window;
+    analytics.last_window_shift = if is_syn {
+        0
+    } else {
+        analytics.window_shift_for(is_outgoing)
+    };
 
     if is_outgoing {
         // Outbound packet - check for retransmissions
@@ -309,6 +339,8 @@ pub fn merge_packet_into_connection(
                     payload_len: seq_consumed,
                     is_outgoing: parsed.is_outgoing,
                     has_ack_flag: tcp_header.flags.ack,
+                    is_syn: tcp_header.flags.syn,
+                    window_scale: tcp_header.window_scale,
                 },
                 now,
             );
@@ -1020,6 +1052,7 @@ mod tests {
                     rst: false,
                 },
                 payload_len: 60, // Simulated payload length
+                window_scale: None,
             },
         );
         packet.is_outgoing = is_outgoing;
@@ -1346,6 +1379,8 @@ mod tests {
                 payload_len: len,
                 is_outgoing: true,
                 has_ack_flag: false,
+                is_syn: false,
+                window_scale: None,
             },
             at,
         );
@@ -1372,11 +1407,85 @@ mod tests {
                 payload_len: len,
                 is_outgoing: false,
                 has_ack_flag: true,
+                is_syn: false,
+                window_scale: None,
             },
             at,
         )
     }
 
+    /// One SYN (or SYN-ACK, via `is_outgoing`/`ack`) with the given
+    /// window-scale verdict and a raw window of 65535.
+    fn syn(analytics: &mut TcpAnalytics, is_outgoing: bool, window_scale: SynWindowScale) {
+        analyze_tcp_segment(
+            analytics,
+            TcpSegment {
+                seq: 0,
+                ack: 0,
+                window: 65535,
+                payload_len: 1,
+                is_outgoing,
+                has_ack_flag: !is_outgoing,
+                is_syn: true,
+           
```

**File**: `crates/rustnet-core/src/network/parser.rs` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ const AMBIGUOUS_ENDPOINT_REFRESH_INTERVAL: Duration = Duration::from_secs(1);
 const AMBIGUOUS_ENDPOINT_REFRESH_MAX_INTERVAL: Duration = Duration::from_secs(60);
 
 // Re-export TCP types
-pub use crate::network::protocol::tcp::{TcpFlags, TcpHeaderInfo};
+pub use crate::network::protocol::tcp::{SynWindowScale, TcpFlags, TcpHeaderInfo};
 
 /// Result of parsing a packet
 #[derive(Debug)]
```

**File**: `crates/rustnet-core/src/network/protocol/tcp.rs` (modified, +118/-0)
```diff
@@ -28,6 +28,61 @@ pub struct TcpHeaderInfo {
     pub window: u16,      // Window size
     pub flags: TcpFlags,  // TCP flags
     pub payload_len: u32, // Actual TCP payload length (not including headers)
+    /// Window-scale verdict from the SYN's options (RFC 7323). Only ever
+    /// `Some` on a SYN segment; the option is illegal elsewhere.
+    pub window_scale: Option<SynWindowScale>,
+}
+
+/// What a SYN's options said about window scaling. `Absent` is a proven
+/// negative (the options were walked completely and carried no window-scale
+/// option), which is different from `Unknown` (truncated or malformed
+/// options), where no conclusion may be drawn: treating an unexamined SYN
+/// as a refusal would permanently disable scaling for the connection even
+/// when a complete retransmitted SYN later shows the option.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub enum SynWindowScale {
+    /// The SYN offered window scaling with this shift.
+    Present(u8),
+    /// The options were fully examined and carry no window-scale option.
+    Absent,
+    /// The options could not be fully examined (capture truncation or a
+    /// malformed option); nothing can be concluded.
+    Unknown,
+}
+
+/// Highest shift RFC 7323 permits; larger advertised values are clamped.
+const MAX_WINDOW_SCALE: u8 = 14;
+
+/// Extract the window-scale verdict (option kind 3) from a SYN's option bytes.
+fn parse_window_scale(options: &[u8]) -> SynWindowScale {
+    let mut i = 0;
+    while i < options.len() {
+        match options[i] {
+            0 => return SynWindowScale::Absent, // End of option list
+            1 => i += 1,                        // NOP
+            kind => {
+                let Some(&len) = options.get(i + 1) else {
+                    return SynWindowScale::Unknown; // kind byte without length
+                };
+                let len = len as usize;
+                if len < 2 || i + len > options.len() {
+                    return SynWindowScale::Unknown; // Malformed, stop walking
+                }
+                if kind == 3 {
+                    // Kind 3 is exactly three bytes (RFC 7323); any other
+                    // length is a malformed option (RFC 9293) and proves
+                    // nothing, so it must not end the walk in Absent.
+                    return if len == 3 {
+                        SynWindowScale::Present(options[i + 2].min(MAX_WINDOW_SCALE))
+                    } else {
+                        SynWindowScale::Unknown
+                    };
+                }
+                i += len;
+            }
+        }
+    }
+    SynWindowScale::Absent
 }
 
 /// Parse TCP flags from the flags byte
@@ -81,12 +136,28 @@ pub(crate) fn parse(
     }
     let tcp_payload_len = transport_data.len().saturating_sub(tcp_header_len) as u32;
 
+    // The window-scale option only appears on SYN segments. A capture
+    // truncated before the declared data offset (snaplen) cannot prove the
+    // option absent, so it yields Unknown rather than Absent.
+    let window_scale = if tcp_flags.syn {
+        Some(if transport_data.len() < tcp_header_len {
+            SynWindowScale::Unknown
+        } else if tcp_header_len > 20 {
+            parse_window_scale(&transport_data[20..tcp_header_len])
+        } else {
+            SynWindowScale::Absent
+        })
+    } else {
+        None
+    };
+
     let tcp_header = TcpHeaderInfo {
         seq,
         ack,
         window,
         flags: tcp_flags,
         payload_len: tcp_payload_len,
+        window_scale,
     };
 
     // Log TCP flags for debugging
@@ -147,4 +218,51 @@ mod tests {
         assert!(flags.fin);
         assert!(flags.ack);
     }
+
+    #[test]
+    fn window_scale_option_parsed() {
+        // MSS (kind 2, len 4), NOP, window scale (kind 3, len 3, shift 7)
+        let options = [2, 4, 0x05, 0xb4, 1, 3, 3, 7];
+        assert_eq!(parse_window_scale(&options), SynWindowScale::Present(7));
+    }
+
+    #[
```

#### Recent Merged Pull Requests:
- **PR #644** (2026-09-28): chore(deps): bump debian from `d7e1218` to `a99cfc5` in the docker group (@dependabot[bot])
- **PR #643** (2026-09-27): docs: plan cross-platform identity retention (@domcyrus)
- **PR #642** (2026-09-27): feat(linux): add optional socket-cookie attribution (@domcyrus)
- **PR #640** (2026-09-27): feat(linux): retain process identity after exit (@domcyrus)
- **PR #638** (2026-09-27): fix: show DNS attribution in App and Details (@domcyrus)
- **PR #637** (2026-09-26): feat: add generic container attribution (@domcyrus)
- **PR #636** (2026-09-26): feat: add MySQL, Redis and PostgreSQL DPI (@domcyrus)
- **PR #635** (2026-09-26): feat: display observed VLAN IDs (@domcyrus)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
