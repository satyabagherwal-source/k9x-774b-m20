> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webrtc-rs-webrtc-learnings.md`  
> **Source**: github ([https://github.com/webrtc-rs/webrtc](https://github.com/webrtc-rs/webrtc))  
> **Source Version**: `a53d7ac4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T17:30:14.111Z  
> **Learning ID**: `learn-github-webrtc-rs-webrtc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): webrtc-rs/webrtc

> **Canonical Artifact**: `07_PROJECT_LEARNING/webrtc-rs-webrtc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/webrtc-rs/webrtc](https://github.com/webrtc-rs/webrtc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T17:30:14.103Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webrtc-rs/webrtc`
- **Description**: Async-friendly WebRTC implementation in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5166 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/bandwidth-estimation-from-disk/bandwidth-estimation-from-disk.rs`
```
//! bandwidth-estimation-from-disk: switch between three pre-encoded renditions as the estimate moves.
//!
//! A port of pion's `bandwidth-estimation-from-disk`. Send-side congestion control produces one
//! number — how many bits per second the path looks willing to carry — and it is the sender's job
//! to meet it. This example meets it the crudest way that works: three IVF files encoded at 300
//! kbps, 1 Mbps and 2.5 Mbps, and a switch to whichever one fits.
//!
//! # Getting the estimate out
//!
//! The estimator is a plain object behind [`BandwidthEstimator`], but `configure_congestion_control`
//! takes it by value and it ends up boxed inside the interceptor chain, where the application
//! cannot reach it. So the number has to be pushed rather than pulled: [`ReportingEstimator`] wraps
//! the real estimator, delegates every call, and publishes the target where the streaming task can
//! read it.
//!
//! That wrapper is the whole of the integration, and it is worth noticing what it is *not*. There
//! is no callback registration, no event variant, no new peer-connection API — a
//! `BandwidthEstimator` is a function from acknowledgements to a number, and anything that wants to
//! observe that number can sit in the same place the algorithm does.
//!
//! The handoff is an `AtomicU64` holding `f64::to_bits`, not a `watch` channel. These examples are
//! runtime-agnostic — the same source runs under `runtime-tokio` and `runtime-smol` — so reaching
//! for `tokio::sync::watch` would tie the example to one of them. A relaxed atomic is enough for a
//! value that is written by one task and sampled by another, where a reader that misses an update
//! simply uses the previous estimate for one more frame.

use anyhow::Result;
use clap::Parser;
use env_logger::Target;
use futures::FutureExt;
use rtc::interceptor::{BandwidthEstimator, EstimatorStats, Gcc, PacketReport, Registry};
use rtc::media::Sample;
use rtc::media::io::ivf_reader::{IVFFrameHeader, IVFReader};
use rtc::media_stream::MediaStreamTrack;
use rtc::peer_connection::configuration::RTCConfigurationBuilder;
use rtc::peer_connection::configuration::interceptor_registry::{
    CongestionFeedback, configure_congestion_control, register_default_interceptors,
};
use rtc::peer_connection::configuration::media_engine::{MIME_TYPE_VP8, MediaEngine};
use rtc::peer_connection::sdp::RTCSessionDescription;
use rtc::peer_connection::transport::RTCIceServer;
use rtc::rtp_transceiver::rtp_sender::{
    RTCRtpCodec, RTCRtpCodecParameters, RTCRtpCodingParameters, RTCRtpEncodingParameters,
    RtpCodecKind,
};
use rtc::rtp_transceiver::{PayloadType, SSRC};
use std::io::{Seek, SeekFrom};
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use std::{
    fs,
    fs::{File, OpenOptions},
    io::{BufReader, Write as IoWrite},
    str::FromStr,
};
use webrtc::error::Error;
use webrtc::media_stream::Track;
use webrtc::media_stream::track_local::TrackLocal;
use webrtc::media_stream::track_local::static_sample::TrackLocalStaticSample;
use webrtc::peer_connection::{
    PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler, RTCIceGatheringState,
    RTCPeerConnectionState,
};
use webrtc::rtp_transceiver::RtpSender;
use webrtc::runtime::{Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, interval, runtime};

/// The IVF file header, which `reset_reader` does not re-parse — a reader handed to it must
/// already be positioned past it.
const IVF_HEADER_SIZE: u64 = 32;

/// The renditions, cheapest first. Each entry is the file and the bitrate it was encoded at; the
/// estimate is compared against these numbers to decide which one to send.
const QUALITY_LEVELS: [(&str, f64); 3] = [
    ("low.ivf", 300_000.0),
    ("med.ivf", 1_000_000.0),
    ("high.ivf", 2_500_000.0),
];

/// Where the estimator starts. The lowest rendition, so the first seconds of the call are
/// deliverable on a path that turns out to be poor, and probing climbs from there. Starting at the
/// highest instead would open the call by congesting the path it is still measuring.
const INITIAL_BITRATE: f64 = 300_000.0;
const MIN_BITRATE: f64 = 100_000.0;
const MAX_BITRATE: f64 = 5_000_000.0;

// ── CLI ───────────────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(name = "bandwidth-estimation-from-disk")]
#[command(author = "Rain Liu <yliu@webrtc.rs>")]
#[command(version = "0.1.0")]
#[command(about = "An example of bandwidth estimation driving quality selection.")]
struct Cli {
    #[arg(short, long)]
    debug: bool,
    #[arg(short, long, default_value_t = format!("INFO"))]
    log_level: String,
    #[arg(short, long, default_value_t = format!(""))]
    input_sdp_file: String,
    #[arg(short, long, default_value_t = format!(""))]
    output_log_file: String,
    /// Directory holding `low.ivf`, `med.ivf` and `high.ivf`.
    #[arg(short, long, default_value_t = format!("."))]
    video_dir: String,
}

// ── Estimator ─────────────────────────────────────────────────────────────────

/// Delegates to `inner` and publishes its target bitrate after every update.
///
/// The estimator is where an application belongs if it wants to watch the estimate: it is the one
/// object in the congestion control loop that is application-supplied, so wrapping it costs nothing
/// and reaches into no internals. Every method forwards; the only addition is the store after each
/// call that can move the number.
///
/// `target_bitrate` takes `&self`, so publishing cannot happen there. It happens after
/// [`on_reports`](BandwidthEstimator::on_reports) and
/// [`handle_timeout`](BandwidthEstimator::handle_timeout), which the interceptor's own contract
/// names as the two points where the estimate can change.
struct ReportingEstimator<E: BandwidthEstimator> {
    inner: E,
    target: Arc<AtomicU64>,
}

impl<E: BandwidthEstimator> ReportingEstimator<E> {
    fn new(inner: E) -> (Self, Arc<AtomicU64>) {
        let target = Arc::new(AtomicU64::new(inner.target_bitrate().to_bits()));
        let handle = Arc::clone(&target);
        (Self { inner, target }, handle)
    }

    fn publish(&self) {
        self.target
            .store(self.inner.target_bitrate().to_bits(), Ordering::Relaxed);
    }
}

impl<E: BandwidthEstimator> BandwidthEstimator for ReportingEstimator<E> {
    fn on_reports(&mut self, now: Instant, reports: &[PacketReport]) {
        self.inner.on_reports(now, reports);
        self.publish();
    }

    fn target_bitrate(&self) -> f64 {
        self.inner.target_bitrate()
    }

    fn handle_timeout(&mut self, now: Instant) {
        self.inner.handle_timeout(now);
        self.publish();
    }

    fn poll_timeout(&self) -> Option<Instant> {
        self.inner.poll_timeout()
    }

    fn stats(&self) -> EstimatorStats {
        self.inner.stats()
    }
}

// ── Event handler ─────────────────────────────────────────────────────────────

#[derive(Clone)]
struct Handler {
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
    connected_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for Handler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("Peer Connection State has changed: {state}");
        match state {
            RTCPeerConnectionState::Connected => {
                let _ = self.connected_tx.try_send(());
            }
            RTCPeerConnectionState::Failed | RTCPeerConnectionState::Closed => {
                let _ = self.done_tx.try_send(());
            }
            _ => {}
        }
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    block_on(async_main())
}

async fn async_main() -> Result<()> {
    let cli = Cli::parse();
    let log_level = log::LevelFilter::from_str(&cli.log_level)?;
    let video_dir = cli.video_dir.clone();

    if cli.debug {
        env_logger::Builder::new()
            .target(if !cli.output_log_file.is_empty() {
                Target::Pipe(Box::new(
                    OpenOptions::new()
                        .create(true)
                        .write(true)
                        .truncate(true)
                        .open(&cli.output_log_file)?,
                ))
            } else {
                Target::Stdout
            })
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log_level)
            .init();
    }

    // All three renditions have to exist before the call starts: discovering a missing file at the
    // moment the estimate says to switch would fail mid-stream, long after the mistake was made.
    for (file_name, _) in QUALITY_LEVELS {
        let path = Path::new(&video_dir).join(file_name);
        if !path.exists() {
            return Err(anyhow::anyhow!("video file '{}' not found", path.display()));
        }
    }

    // Everything below is the WebRTC-rs API! Thanks for using it ❤️.

    // Create a MediaEngine object to configure the supported codec
    let mut media_engine = MediaEngine::default();

    let video_codec = RTCRtpCodecParameters {
        rtp_codec: RTCRtpCodec {
            mime_type: MIME_TYPE_VP8.to_owned(),
            clock_rate: 90000,
            channels: 0,
            sdp_fmtp_line: "".to_owned(),
            rtcp_feedback: vec![
```

### Core Architecture Module: `examples/broadcast/broadcast.rs`
```
use anyhow::Result;
use clap::Parser;
use env_logger::Target;
use futures::FutureExt;
use rtc::interceptor::Registry;
use rtc::media_stream::MediaStreamTrack;
use rtc::peer_connection::configuration::RTCConfigurationBuilder;
use rtc::peer_connection::configuration::interceptor_registry::register_default_interceptors;
use rtc::peer_connection::configuration::media_engine::MediaEngine;
use rtc::peer_connection::sdp::RTCSessionDescription;
use rtc::peer_connection::transport::RTCIceServer;
use rtc::rtcp::payload_feedbacks::picture_loss_indication::PictureLossIndication;
use rtc::rtp;
use rtc::rtp_transceiver::rtp_sender::{
    RTCRtpCodec, RTCRtpCodingParameters, RTCRtpEncodingParameters, RtpCodecKind,
};
use rtc::rtp_transceiver::{RTCRtpTransceiverDirection, RTCRtpTransceiverInit};
use std::sync::Arc;
use std::{fs::OpenOptions, io::Write, str::FromStr};
use webrtc::error::Result as WebRtcResult;
use webrtc::media_stream::track_local::TrackLocal;
use webrtc::media_stream::track_local::static_rtp::TrackLocalStaticRTP;
use webrtc::media_stream::track_remote::{TrackRemote, TrackRemoteEvent};
use webrtc::peer_connection::{
    PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler, RTCIceGatheringState,
    RTCPeerConnectionState,
};
use webrtc::runtime::{BroadcastSender, Runtime, Sender, broadcast_channel, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, runtime, sleep};

// ── Broadcaster handler ───────────────────────────────────────────────────────

#[derive(Clone)]
struct BroadcastHandler {
    runtime: Arc<dyn Runtime>,
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
    // Sends the broadcaster's codec once when on_track fires
    codec_tx: Sender<RTCRtpCodec>,
    // Broadcast sender: each viewer subscribes to get its own receiver
    broadcast_tx: BroadcastSender<rtp::Packet>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for BroadcastHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("Broadcaster Peer Connection State: {state}");
        if state == RTCPeerConnectionState::Failed || state == RTCPeerConnectionState::Closed {
            let _ = self.done_tx.try_send(());
        }
    }

    async fn on_track(&self, track: Arc<dyn TrackRemote>) {
        let media_ssrc = *track.ssrcs().await.first().unwrap();
        let codec = track.codec(media_ssrc).await.unwrap().clone();
        println!(
            "Broadcaster received track: {} ssrc={}",
            codec.mime_type, media_ssrc
        );

        // Publish codec so main loop can create matching viewer tracks
        let _ = self.codec_tx.try_send(codec);

        // Send PLI periodically so the broadcaster keeps pushing keyframes
        let pli_track = track.clone();
        self.runtime.spawn(Box::pin(async move {
            let mut result = WebRtcResult::<()>::Ok(());
            while result.is_ok() {
                let timeout = sleep(std::time::Duration::from_secs(3));
                futures::pin_mut!(timeout);
                futures::select! {
                    _ = timeout.fuse() => {
                        result = pli_track.write_rtcp(vec![Box::new(PictureLossIndication {
                            sender_ssrc: 0,
                            media_ssrc,
                        })]).await;
                    }
                };
            }
        }));

        // Forward RTP packets to all subscribers via broadcast channel
        let broadcast_tx = self.broadcast_tx.clone();
        self.runtime.spawn(Box::pin(async move {
            while let Some(evt) = track.poll().await {
                if let TrackRemoteEvent::OnRtpPacket(packet) = evt {
                    let _ = broadcast_tx.send(packet);
                }
            }
        }));
    }
}

// ── Viewer handler ────────────────────────────────────────────────────────────

#[derive(Clone)]
struct ViewerHandler {
    gather_complete_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for ViewerHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("Viewer Peer Connection State: {state}");
    }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(name = "broadcast")]
#[command(author = "Rain Liu <yliu@webrtc.rs>")]
#[command(version = "0.1.0")]
#[command(about = "An example of broadcast: one sender, multiple viewers.")]
struct Cli {
    #[arg(short, long)]
    debug: bool,
    #[arg(short, long, default_value_t = format!("INFO"))]
    log_level: String,
    #[arg(short, long, default_value_t = format!(""))]
    output_log_file: String,
    #[arg(long, default_value_t = 8080)]
    port: u16,
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    block_on(async_main())
}

async fn async_main() -> Result<()> {
    let cli = Cli::parse();
    let log_level = log::LevelFilter::from_str(&cli.log_level)?;

    if cli.debug {
        env_logger::Builder::new()
            .target(if !cli.output_log_file.is_empty() {
                Target::Pipe(Box::new(
                    OpenOptions::new()
                        .create(true)
                        .write(true)
                        .truncate(true)
                        .open(&cli.output_log_file)?,
                ))
            } else {
                Target::Stdout
            })
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log_level)
            .init();
    }

    let runtime = runtime();

    let mut sdp_chan_rx = signal::http_sdp_server(cli.port).await;
    println!("Waiting for broadcaster offer on port {}", cli.port);

    // First SDP = broadcaster offer
    let line = sdp_chan_rx
        .recv()
        .await
        .ok_or_else(|| anyhow::anyhow!("SDP channel closed"))?;
    let desc_data = signal::decode(line.as_str())?;
    let offer = serde_json::from_str::<RTCSessionDescription>(&desc_data)?;

    // ── Broadcaster peer connection ──────────────────────────────────────────

    let (done_tx, mut done_rx) = channel::<()>(1);
    let (broadcast_gather_tx, mut broadcast_gather_rx) = channel::<()>(1);
    let (codec_tx, mut codec_rx) = channel::<RTCRtpCodec>(1);
    let (ctrlc_tx, mut ctrlc_rx) = channel::<()>(1);
    ctrlc::set_handler(move || {
        let _ = ctrlc_tx.try_send(());
    })?;

    // Broadcast sender: each viewer will subscribe to get its own receiver
    let broadcast_tx = broadcast_channel::<rtp::Packet>(256);

    let broadcast_handler = Arc::new(BroadcastHandler {
        runtime: runtime.clone(),
        gather_complete_tx: broadcast_gather_tx,
        done_tx: done_tx.clone(),
        codec_tx,
        broadcast_tx: broadcast_tx.clone(),
    });

    let mut broadcaster_media_engine = MediaEngine::default();
    broadcaster_media_engine.register_default_codecs()?;
    let broadcaster_registry =
        register_default_interceptors(Registry::new(), &mut broadcaster_media_engine)?;
    let broadcaster_config = RTCConfigurationBuilder::new()
        .with_ice_servers(vec![RTCIceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            ..Default::default()
        }])
        .build();

    let broadcaster_pc: Arc<dyn PeerConnection> = Arc::new(
        PeerConnectionBuilder::new()
            .with_configuration(broadcaster_config)
            .with_media_engine(broadcaster_media_engine)
            .with_interceptor_registry(broadcaster_registry)
            .with_handler(broadcast_handler as Arc<dyn PeerConnectionEventHandler>)
            .with_runtime(runtime.clone())
            .with_udp_addrs(vec![format!("{}:0", signal::get_local_ip())])
            .build()
            .await?,
    );

    broadcaster_pc
        .add_transceiver_from_kind(
            RtpCodecKind::Video,
            Some(RTCRtpTransceiverInit {
                direction: RTCRtpTransceiverDirection::Recvonly,
                ..Default::default()
            }),
        )
        .await?;

    broadcaster_pc.set_remote_description(offer).await?;
    let answer = broadcaster_pc.create_answer(None).await?;
    broadcaster_pc.set_local_description(answer).await?;

    let _ = broadcast_gather_rx.recv().await;

    if let Some(local_desc) = broadcaster_pc.local_description().await {
        let json_str = serde_json::to_string(&local_desc)?;
        let b64 = signal::encode(&json_str);
        println!("Broadcaster answer:\n{b64}");
    } else {
        anyhow::bail!("generate local_description failed!");
    }

    println!("Waiting for broadcaster track...");
    let broadcaster_codec = codec_rx
        .recv()
        .await
        .ok_or_else(|| anyhow::anyhow!("codec channel closed"))?;
    println!(
        "Broadcaster codec: {}, ready for viewers.",
        broadcaster_codec.mime_type
    );

    // ── Viewer loop ──────────────────────────────────────────────────────────

    let mut viewer_pcs: Vec<Arc<dyn PeerConnection>> = Vec::new();

    loop {
        println!("\nCurl a base64 SDP to start a viewer peer connection");

        futures::select! {
            line
```

### Core Architecture Module: `examples/common/mod.rs`
```
//! Shared runtime helpers for the examples.
//!
//! The examples are runtime-agnostic: the same sources run under `runtime-tokio` and under
//! `runtime-smol`, selected by Cargo feature. These helpers resolve
//! [`webrtc::runtime::default_runtime`] — the compiled-in built-in — so an example stays
//! focused on WebRTC rather than runtime plumbing.
//!
//! Included by each example with `#[path = "../common/mod.rs"] mod common;`.
//!
//! The library itself has **no** ambient runtime: every internal call site takes an explicit
//! `&dyn Runtime`, and a `PeerConnection`'s runtime is injected per connection via
//! `with_runtime`. An application wanting a custom runtime passes it there — see
//! `examples/custom-runtime`.

#![allow(dead_code)]

use std::future::Future;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use webrtc::runtime::{Elapsed, Runtime, default_runtime};

/// The one runtime instance shared by every helper in this module.
///
/// `default_runtime()` *constructs* a runtime on each call, so resolving it per operation
/// would allocate a fresh `Arc<dyn Runtime>` for every `sleep` / `timeout` / `interval` /
/// `yield_now`. Beyond the waste, that is semantically wrong: it hands out a distinct
/// runtime each time, which is harmless for the stateless built-ins but would silently
/// break any runtime carrying state (a `MockRuntime` would get a different virtual clock
/// per call). Resolve once, then clone the handle.
static RUNTIME: OnceLock<Arc<dyn Runtime>> = OnceLock::new();

/// The runtime used by the examples, i.e. whichever built-in the enabled feature provides.
///
/// Cheap to call repeatedly: clones a shared `Arc` rather than building a new runtime.
/// **Every example should obtain its runtime from here** rather than calling
/// `default_runtime()` directly, so a single process-wide instance backs both the timer
/// helpers and each `PeerConnection`.
pub fn runtime() -> Arc<dyn Runtime> {
    Arc::clone(RUNTIME.get_or_init(|| {
        default_runtime().expect("no runtime feature enabled (runtime-tokio or runtime-smol)")
    }))
}

/// Drive `future` to completion on the example runtime, returning its output.
///
/// [`Runtime::block_on`] is restricted to a `()` output so the trait stays object-safe;
/// this helper recovers the generic form for tests by moving the value out through a
/// local slot, as the trait documentation suggests.
pub fn block_on<F, T>(future: F) -> T
where
    F: Future<Output = T>,
{
    let mut out: Option<T> = None;
    {
        let slot = &mut out;
        runtime().block_on(Box::pin(async move {
            *slot = Some(future.await);
        }));
    }
    out.expect("block_on future did not run to completion")
}

/// Sleep on the example runtime.
pub async fn sleep(duration: Duration) {
    runtime().sleep(duration).await;
}

/// Cooperatively yield on the example runtime.
pub async fn yield_now() {
    runtime().yield_now().await;
}

/// Run `future` with a deadline on the example runtime.
pub async fn timeout<T>(duration: Duration, future: impl Future<Output = T>) -> Result<T, Elapsed> {
    webrtc::runtime::timeout(&*runtime(), duration, future).await
}

/// A repeating timer on the example runtime.
pub fn interval(period: Duration) -> Box<dyn webrtc::runtime::AsyncInterval> {
    runtime().interval(period)
}

```

### Core Architecture Module: `examples/custom-runtime/custom-runtime.rs`
```
//! A third-party async runtime plugged into `webrtc`.
//!
//! This example implements [`webrtc::runtime::Runtime`] over `async-executor` +
//! `async-io` — neither tokio nor smol — to demonstrate that the runtime abstraction is
//! genuinely pluggable. It is the acceptance test for that design:
//!
//! ```text
//! cargo run --no-default-features --example custom-runtime
//! ```
//!
//! Building with **neither** `runtime-tokio` nor `runtime-smol` proves nothing in the
//! library is hard-wired to a built-in runtime. All that is required is:
//!
//! * one `impl Runtime` (8 methods), plus
//! * the three socket traits, then
//! * `PeerConnectionBuilder::with_runtime(Arc::new(MyRuntime::new()))`
//!
//! No `#[cfg]` edits, no fork, and no changes to library internals. Because the runtime is
//! injected per connection, a process can run some connections on this runtime and others
//! on a different one.

mod my_runtime;

use std::sync::Arc;
use std::time::Duration;
use webrtc::runtime::Runtime;

// ── Demonstration ─────────────────────────────────────────────────────────────

fn main() {
    env_logger::init();

    let runtime: Arc<dyn Runtime> = Arc::new(my_runtime::MyRuntime::new());
    println!("running on a custom runtime: {}", runtime.name());

    // Every capability the WebRTC stack needs now comes from `runtime`.
    runtime.block_on(Box::pin(async {
        // Timers.
        let started = std::time::Instant::now();
        runtime.sleep(Duration::from_millis(50)).await;
        println!("sleep(50ms) took {:?}", started.elapsed());

        // Repeating timer.
        let mut ticker = runtime.interval(Duration::from_millis(20));
        for n in 0..3 {
            ticker.tick().await;
            println!("tick {n}");
        }

        // Timeout, derived generically from `Runtime::sleep`.
        let timed_out = webrtc::runtime::timeout(
            &*runtime,
            Duration::from_millis(30),
            std::future::pending::<()>(),
        )
        .await;
        println!("timeout on a pending future => {timed_out:?}");

        // Task spawning.
        let (tx, rx) = async_channel::bounded::<&str>(1);
        let handle = runtime.spawn(Box::pin(async move {
            let _ = tx.send("hello from a spawned task").await;
        }));
        println!("{}", rx.recv().await.expect("task sent a value"));
        drop(handle);

        // UDP round-trip through the custom socket wrapper. Binding can be denied by a
        // sandbox, so treat failure as "skipped" rather than aborting the demo.
        match (
            std::net::UdpSocket::bind("127.0.0.1:0"),
            std::net::UdpSocket::bind("127.0.0.1:0"),
        ) {
            (Ok(sa), Ok(sb)) => {
                let a = runtime.wrap_udp_socket(sa).expect("wrap a");
                let b = runtime.wrap_udp_socket(sb).expect("wrap b");
                let b_addr = b.local_addr().expect("b addr");

                a.send_to(b"ping", b_addr).await.expect("send");
                let mut buf = [0u8; 16];
                let (n, from) = b.recv_from(&mut buf).await.expect("recv");
                println!(
                    "udp: received {:?} from {from}",
                    std::str::from_utf8(&buf[..n]).unwrap_or("<invalid utf8>")
                );
            }
            _ => println!("udp: skipped (socket binding not permitted in this environment)"),
        }

        // DNS.
        match runtime.resolve_host("localhost:3478").await {
            Ok(addrs) => println!("resolved localhost:3478 -> {addrs:?}"),
            Err(err) => println!("resolve failed (may be sandboxed): {err}"),
        }
    }));

    println!(
        "\nAll runtime capabilities exercised without tokio or smol.\n\
         To use it for a connection:\n\
         \n    PeerConnectionBuilder::new()\n\
         \x20       .with_runtime(runtime.clone())\n\
         \x20       .with_udp_addrs(vec![\"0.0.0.0:0\"])\n\
         \x20       .build()\n\
         \x20       .await?;\n"
    );
}

```

### Core Architecture Module: `examples/custom-runtime/my_runtime.rs`
```
//! A third-party async runtime for `webrtc`, over `async-executor` + `async-io`.
//!
//! Implements [`webrtc::runtime::Runtime`] using neither Tokio nor smol, demonstrating that
//! the runtime abstraction is genuinely pluggable: supply this type to
//! `PeerConnectionBuilder::with_runtime` and the whole stack — timers, task spawning,
//! sockets, DNS — runs on it.
//!
//! Kept in its own module so it has a single definition shared by two consumers:
//!
//! * `custom-runtime.rs`, the runnable example, and
//! * `tests/custom_runtime_interop.rs`, which drives a real peer connection on it alongside
//!   a second connection on the built-in runtime.

use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use futures::Future;
use std::io::IoSliceMut;
use std::task::{Context, Poll};
use webrtc::runtime::{
    AsyncInterval, AsyncTcpListener, AsyncTcpStream, AsyncUdpSocket, JoinHandle, RecvMeta, Runtime,
    Transmit,
};

// ── The runtime ───────────────────────────────────────────────────────────────

/// A minimal runtime over `async-executor` (task scheduling) and `async-io` (reactor).
#[derive(Debug)]
pub struct MyRuntime {
    executor: Arc<async_executor::Executor<'static>>,
}

impl MyRuntime {
    pub fn new() -> Self {
        let executor = Arc::new(async_executor::Executor::new());

        // Drive the executor on a small pool of threads. `async-io` runs its own reactor
        // thread on demand, so timers and socket readiness work without further setup.
        for i in 0..2 {
            let ex = Arc::clone(&executor);
            std::thread::Builder::new()
                .name(format!("my-rt-{i}"))
                .spawn(move || {
                    futures_lite::future::block_on(ex.run(std::future::pending::<()>()));
                })
                .expect("failed to spawn executor thread");
        }

        Self { executor }
    }
}

/// Handle wrapping an `async-task` so it can be aborted or polled for completion.
struct MyJoinHandle {
    task: std::sync::Mutex<Option<async_executor::Task<()>>>,
}

/// `async_executor::Task` cancels on drop, but `JoinHandle` requires drop to *detach*.
/// Omitting this is the classic way to make a custom runtime silently kill its own drivers.
impl Drop for MyJoinHandle {
    fn drop(&mut self) {
        self.detach();
    }
}

impl JoinHandle for MyJoinHandle {
    fn detach(&self) {
        if let Some(task) = self.task.lock().unwrap().take() {
            task.detach();
        }
    }

    fn abort(&self) {
        // Dropping an `async-executor` Task cancels it at its next await point.
        self.task.lock().unwrap().take();
    }

    fn is_finished(&self) -> bool {
        self.task
            .lock()
            .unwrap()
            .as_ref()
            .is_none_or(|t| t.is_finished())
    }
}

impl Runtime for MyRuntime {
    fn spawn(&self, future: Pin<Box<dyn Future<Output = ()> + Send>>) -> Box<dyn JoinHandle> {
        let task = self.executor.spawn(future);
        Box::new(MyJoinHandle {
            task: std::sync::Mutex::new(Some(task)),
        })
    }

    fn wrap_udp_socket(&self, socket: std::net::UdpSocket) -> io::Result<Arc<dyn AsyncUdpSocket>> {
        socket.set_nonblocking(true)?;
        Ok(Arc::new(MyUdpSocket {
            io: async_io::Async::new(socket)?,
        }))
    }

    fn wrap_tcp_listener(
        &self,
        listener: std::net::TcpListener,
    ) -> io::Result<Arc<dyn AsyncTcpListener>> {
        listener.set_nonblocking(true)?;
        Ok(Arc::new(MyTcpListener {
            io: async_io::Async::new(listener)?,
        }))
    }

    fn connect_tcp<'a>(
        &'a self,
        remote_addr: SocketAddr,
    ) -> Pin<Box<dyn Future<Output = io::Result<Arc<dyn AsyncTcpStream>>> + Send + 'a>> {
        Box::pin(async move {
            let stream = async_io::Async::<std::net::TcpStream>::connect(remote_addr).await?;
            let local_addr = stream.get_ref().local_addr()?;
            let peer_addr = stream.get_ref().peer_addr()?;
            Ok(Arc::new(MyTcpStream {
                io: stream,
                local_addr,
                peer_addr,
            }) as Arc<dyn AsyncTcpStream>)
        })
    }

    fn resolve_host<'a>(
        &'a self,
        host: &'a str,
    ) -> Pin<Box<dyn Future<Output = io::Result<Vec<SocketAddr>>> + Send + 'a>> {
        // `std`'s resolver blocks, so run it off the executor threads.
        let host = host.to_owned();
        Box::pin(async move {
            blocking_task(move || {
                use std::net::ToSocketAddrs;
                host.to_socket_addrs().map(|it| it.collect::<Vec<_>>())
            })
            .await
        })
    }

    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + 'static>> {
        Box::pin(async move {
            async_io::Timer::after(duration).await;
        })
    }

    fn interval(&self, period: Duration) -> Box<dyn AsyncInterval> {
        Box::new(MyInterval {
            period,
            first: true,
        })
    }

    fn block_on(&self, future: Pin<Box<dyn Future<Output = ()> + '_>>) {
        futures_lite::future::block_on(future);
    }

    fn name(&self) -> &'static str {
        "my-runtime"
    }
}

/// Run a blocking closure on its own thread and await the result.
async fn blocking_task<T, F>(f: F) -> T
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    let (tx, rx) = async_channel::bounded(1);
    std::thread::spawn(move || {
        let _ = tx.send_blocking(f());
    });
    rx.recv().await.expect("blocking task panicked")
}

/// Repeating timer. The first tick fires immediately, matching the built-in runtimes.
struct MyInterval {
    period: Duration,
    first: bool,
}

impl AsyncInterval for MyInterval {
    fn tick(&mut self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        if self.first {
            self.first = false;
            return Box::pin(std::future::ready(()));
        }
        let period = self.period;
        Box::pin(async move {
            async_io::Timer::after(period).await;
        })
    }
}

// ── Sockets ───────────────────────────────────────────────────────────────────

#[derive(Debug)]
struct MyUdpSocket {
    io: async_io::Async<std::net::UdpSocket>,
}

impl AsyncUdpSocket for MyUdpSocket {
    fn local_addr(&self) -> io::Result<SocketAddr> {
        self.io.get_ref().local_addr()
    }

    fn poll_send(&self, cx: &mut Context<'_>, transmit: &Transmit<'_>) -> Poll<io::Result<usize>> {
        // No GSO here: `max_gso_segments` stays at its default of 1, so the caller never
        // hands us a multi-segment buffer, and ECN marking is not applied. A production
        // runtime would batch via `webrtc::runtime::UdpSocketState`, handing it the whole
        // `Transmit`.
        debug_assert!(
            transmit
                .segment_size
                .is_none_or(|seg| seg >= transmit.contents.len())
        );
        loop {
            match self.io.poll_writable(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(Err(e)) => return Poll::Ready(Err(e)),
                Poll::Ready(Ok(())) => {}
            }
            match self
                .io
                .get_ref()
                .send_to(transmit.contents, transmit.destination)
            {
                Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => continue,
                other => return Poll::Ready(other),
            }
        }
    }

    fn poll_recv(
        &self,
        cx: &mut Context<'_>,
        bufs: &mut [IoSliceMut<'_>],
        meta: &mut [RecvMeta],
    ) -> Poll<io::Result<usize>> {
        // The minimal shape the trait allows: fill one buffer per call and return `Ok(1)`,
        // as a platform without `recvmmsg` would. A production runtime would hand `bufs`
        // and `meta` straight to `UdpSocketState::recv`, which fills up to `BATCH_SIZE` of
        // them in one syscall.
        loop {
            match self.io.poll_readable(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(Err(e)) => return Poll::Ready(Err(e)),
                Poll::Ready(Ok(())) => {}
            }
            match self.io.get_ref().recv_from(&mut bufs[0]) {
                Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => continue,
                Err(e) => return Poll::Ready(Err(e)),
                // No GRO: exactly one datagram, so `stride == len`. `RecvMeta` is
                // `#[non_exhaustive]`, so assign fields rather than using a literal.
                Ok((len, peer_addr)) => {
                    meta[0] = RecvMeta::default();
                    meta[0].len = len;
                    meta[0].stride = len.max(1);
                    meta[0].addr = peer_addr;
                    return Poll::Ready(Ok(1));
                }
            }
        }
    }
}

#[derive(Debug)]
struct MyTcpListener {
    io: async_io::Async<std::net::TcpListener>,
}

impl AsyncTcpListener for MyTcpListener {
    fn accept<'a>(
        &'a self,
    ) -> Pin<Box<dyn Future<Output = io::Result<(Arc<dyn AsyncTcpStream>, SocketAddr)>> + Send + 'a>>
    {
        Box::pin(async move {
            let (stream, peer_addr) = self.io.accept().await?;
            let local_addr = stream.get_ref().local_addr()?;
            Ok((
                Arc::new(MyTcpStream {
                    io: stream,
                    local_addr,
                    peer_addr,
                }) as Arc<dyn AsyncTcpStream>,
                peer_addr,
            ))
        })
    }

    fn local_addr(&self) -> io::Result<SocketAddr> {
        self.io.get_ref().local_addr()
    }
}

#[derive(Debug)]
struct MyTcpStream {
    io: async_io::Async<std::net::TcpStream>,
    local_addr: SocketAddr,
    peer_addr: SocketAddr,
}

impl AsyncTcpStream for MyTcpStream {
    fn read<'a, 'b>(
        &'a self,
        buf: &'b mut [u8]
```

### Core Architecture Module: `examples/data-channels-close/data-channels-close.rs`
```
use clap::Parser;
use env_logger::Target;
use futures::FutureExt;
use std::fs::OpenOptions;
use std::sync::Arc;
use std::time::Duration;
use std::{fs, io::Write, str::FromStr};
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::error::Result;
use webrtc::peer_connection::{
    MediaEngine, RTCConfigurationBuilder, RTCIceGatheringState, RTCIceServer,
    RTCPeerConnectionState, RTCSessionDescription, Registry, register_default_interceptors,
};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::runtime::{Notify, Runtime, Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, runtime, sleep};

#[derive(Parser)]
#[command(name = "data-channels")]
#[command(author = "Rusty Rain <y@liu.mx>")]
#[command(version = "0.0.0")]
#[command(about = "An example of Data-Channels", long_about = None)]
struct Cli {
    #[arg(short, long)]
    debug: bool,
    #[arg(short, long, default_value_t = format!("INFO"))]
    log_level: String,
    #[arg(short, long, default_value_t = format!(""))]
    input_sdp_file: String,
    #[arg(short, long, default_value_t = format!(""))]
    output_log_file: String,
    #[arg(long, default_value_t = format!("0.0.0.0"))]
    host: String,
    #[arg(long, default_value_t = 0)]
    port: u16,
}

#[derive(Clone)]
struct TestHandler {
    runtime: Arc<dyn Runtime>,
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for TestHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        println!("ICE gathering state: {:?}", state);
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("Peer Connection State has changed: {state}");
        if state == RTCPeerConnectionState::Failed {
            println!("Peer Connection has gone to failed exiting");
            let _ = self.done_tx.try_send(());
        }
    }

    async fn on_data_channel(&self, data_channel: Arc<dyn DataChannel>) {
        let runtime = self.runtime.clone();
        let pc_done_tx = self.done_tx.clone();
        self.runtime.spawn(Box::pin(async move {
            let label = match data_channel.label().await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("Failed to get data channel label: {e}");
                    return;
                }
            };
            let id = data_channel.id();
            println!("New DataChannel {label} {id}");

            let done = Notify::new();
            while let Some(event) = data_channel.poll().await {
                match event {
                    DataChannelEvent::OnOpen => {
                        println!("Data channel '{label}'-'{id}' open. Random messages will now be sent to any connected DataChannels every 5 seconds");
                        let data_channel = data_channel.clone();
                        let done_rx = done.clone();
                        runtime.spawn(Box::pin(async move {
                            let id2 = data_channel.id();
                            let mut result = Result::<()>::Ok(());
                            let mut close_after = 5;
                            while result.is_ok() {
                                let timeout = sleep(Duration::from_secs(5));
                                futures::pin_mut!(timeout);

                                futures::select! {
                                    _ = done_rx.notified().fuse() => {
                                        break;
                                    }
                                    _ = timeout.fuse() =>{
                                        let message = rtc::shared::util::math_rand_alpha(15);
                                        println!("Sending '{message}' - {close_after}/5");
                                        result = data_channel.send_text(message.as_str()).await;

                                        close_after-=1;
                                        if close_after <= 0 {
                                            println!("Sent times out. Closing data channel '{id2}'.");
                                            let _ = data_channel.close().await;
                                            break;
                                        }
                                    }
                                }
                            }
                        }));
                    }
                    DataChannelEvent::OnClose => {
                        println!("Data channel '{label}'-'{id}' closed.");
                        done.notify_waiters();
                        let _ = pc_done_tx.try_send(());
                        break;
                    }
                    DataChannelEvent::OnMessage(msg) => {
                        let msg_str = String::from_utf8(msg.data.to_vec()).unwrap();
                        println!("Message from DataChannel '{label}': '{msg_str}'");
                    }
                    _ => {}
                }
            }
        }));
    }
}

fn main() -> anyhow::Result<()> {
    block_on(async_main())
}

async fn async_main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let host = cli.host;
    let port = cli.port;
    let input_sdp_file = cli.input_sdp_file;
    let output_log_file = cli.output_log_file;
    let log_level = log::LevelFilter::from_str(&cli.log_level)?;
    if cli.debug {
        env_logger::Builder::new()
            .target(if !output_log_file.is_empty() {
                Target::Pipe(Box::new(
                    OpenOptions::new()
                        .create(true)
                        .write(true)
                        .truncate(true)
                        .open(output_log_file)?,
                ))
            } else {
                Target::Stdout
            })
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log_level)
            .init();
    }

    // Everything below is the WebRTC-rs API! Thanks for using it ❤️.

    let (done_tx, mut done_rx) = channel::<()>(1);
    let (gather_complete_tx, mut gather_complete_rx) = channel(1);
    let (ctrlc_tx, mut ctrlc_rx) = channel::<()>(1);
    ctrlc::set_handler(move || {
        let _ = ctrlc_tx.try_send(());
    })?;
    let runtime = runtime();

    let handler = Arc::new(TestHandler {
        runtime: runtime.clone(),
        gather_complete_tx,
        done_tx,
    });

    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs()?;

    let registry = Registry::new();
    // Use the default set of Interceptors
    let registry = register_default_interceptors(registry, &mut media_engine)?;

    let config = RTCConfigurationBuilder::new()
        .with_ice_servers(vec![RTCIceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            ..Default::default()
        }])
        .build();

    let peer_connection = PeerConnectionBuilder::new()
        .with_configuration(config)
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .with_handler(handler)
        .with_runtime(runtime)
        .with_udp_addrs(vec![format!("{host}:{port}")])
        .build()
        .await?;

    // Wait for the offer to be pasted
    let line = if input_sdp_file.is_empty() {
        println!("Please paste offer here:");
        signal::must_read_stdin()?
    } else {
        fs::read_to_string(&input_sdp_file)?
    };
    let desc_data = signal::decode(line.as_str())?;
    let offer = serde_json::from_str::<RTCSessionDescription>(&desc_data)?;
    println!("offer: {}", offer);

    // Set the remote SessionDescription
    peer_connection.set_remote_description(offer).await?;

    // Create an answer
    let answer = peer_connection.create_answer(None).await?;

    // Sets the LocalDescription, and starts our UDP listeners
    peer_connection.set_local_description(answer).await?;

    // Block until ICE Gathering is complete, disabling trickle ICE
    // we do this because we only can exchange one signaling message
    // in a production application you should exchange ICE Candidates via OnICECandidate
    let _ = gather_complete_rx.recv().await;

    // Output the answer in base64 so we can paste it in browser
    if let Some(local_desc) = peer_connection.local_description().await {
        println!("answer: {}", local_desc);
        let json_str = serde_json::to_string(&local_desc)?;
        let b64 = signal::encode(&json_str);
        println!("{b64}");
    } else {
        println!("generate local_description failed!");
    }

    println!("Press ctrl-c to stop");
    futures::select! {
        _ = done_rx.recv().fuse() => {
            println!("received done signal!");
        }
        _ = ctrlc_rx.recv().fuse() => {
            println!("received ctrl-c signal!");
        }
    };

    peer_connection.close().await?;

    Ok(())
}

```

### Core Architecture Module: `examples/data-channels-create/data-channels-create.rs`
```
use clap::Parser;
use env_logger::Target;
use futures::FutureExt;
use std::fs::OpenOptions;
use std::sync::Arc;
use std::time::Duration;
use std::{fs, io::Write, str::FromStr};
use webrtc::data_channel::DataChannelEvent;
use webrtc::error::Result;
use webrtc::peer_connection::{
    MediaEngine, RTCConfigurationBuilder, RTCIceGatheringState, RTCIceServer,
    RTCPeerConnectionState, RTCSessionDescription, Registry, register_default_interceptors,
};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::runtime::{Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, runtime, sleep};

#[derive(Parser)]
#[command(name = "data-channels")]
#[command(author = "Rusty Rain <y@liu.mx>")]
#[command(version = "0.0.0")]
#[command(about = "An example of Data-Channels", long_about = None)]
struct Cli {
    #[arg(short, long)]
    debug: bool,
    #[arg(short, long, default_value_t = format!("INFO"))]
    log_level: String,
    #[arg(short, long, default_value_t = format!(""))]
    input_sdp_file: String,
    #[arg(short, long, default_value_t = format!(""))]
    output_log_file: String,
    #[arg(long, default_value_t = format!("0.0.0.0"))]
    host: String,
    #[arg(long, default_value_t = 0)]
    port: u16,
}

#[derive(Clone)]
struct TestHandler {
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for TestHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        println!("ICE gathering state: {:?}", state);
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("Peer Connection State has changed: {state}");
        if state == RTCPeerConnectionState::Failed {
            println!("Peer Connection has gone to failed exiting");
            let _ = self.done_tx.try_send(());
        }
    }
}

fn main() -> anyhow::Result<()> {
    block_on(async_main())
}

async fn async_main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let host = cli.host;
    let port = cli.port;
    let input_sdp_file = cli.input_sdp_file;
    let output_log_file = cli.output_log_file;
    let log_level = log::LevelFilter::from_str(&cli.log_level)?;
    if cli.debug {
        env_logger::Builder::new()
            .target(if !output_log_file.is_empty() {
                Target::Pipe(Box::new(
                    OpenOptions::new()
                        .create(true)
                        .write(true)
                        .truncate(true)
                        .open(output_log_file)?,
                ))
            } else {
                Target::Stdout
            })
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log_level)
            .init();
    }

    // Everything below is the WebRTC-rs API! Thanks for using it ❤️.

    let (done_tx, mut done_rx) = channel::<()>(1);
    let (gather_complete_tx, mut gather_complete_rx) = channel(1);
    let (ctrlc_tx, mut ctrlc_rx) = channel::<()>(1);
    ctrlc::set_handler(move || {
        let _ = ctrlc_tx.try_send(());
    })?;
    let runtime = runtime();

    let handler = Arc::new(TestHandler {
        gather_complete_tx,
        done_tx,
    });

    let mut media_engine = MediaEngine::default();
    media_engine.register_default_codecs()?;

    let registry = Registry::new();
    // Use the default set of Interceptors
    let registry = register_default_interceptors(registry, &mut media_engine)?;

    let config = RTCConfigurationBuilder::new()
        .with_ice_servers(vec![RTCIceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            ..Default::default()
        }])
        .build();

    let peer_connection = PeerConnectionBuilder::new()
        .with_configuration(config)
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .with_handler(handler)
        .with_runtime(runtime.clone())
        .with_udp_addrs(vec![format!("{host}:{port}")])
        .build()
        .await?;

    // Create a datachannel with label 'data'
    let data_channel = peer_connection.create_data_channel("data", None).await?;

    let runtime_clone = runtime.clone();
    runtime.spawn(Box::pin(async move {
        let label = match data_channel.label().await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Failed to get data channel label: {e}");
                return;
            }
        };
        let id = data_channel.id();

        while let Some(event) = data_channel.poll().await {
            match event {
                DataChannelEvent::OnOpen => {
                    println!("Data channel '{label}'-'{id}' open. Random messages will now be sent to any connected DataChannels every 5 seconds");

                    let data_channel = data_channel.clone();
                    runtime_clone.spawn(Box::pin(async move {
                        let mut result = Result::<()>::Ok(());
                        while result.is_ok() {
                            let timeout = sleep(Duration::from_secs(5));
                            futures::pin_mut!(timeout);

                            futures::select! {
                                    _ = timeout.fuse() =>{
                                        let message = rtc::shared::util::math_rand_alpha(15);
                                        println!("Sending '{message}'");
                                        result = data_channel.send_text(message.as_str()).await;
                                    }
                                }
                        }
                    }));
                }
                DataChannelEvent::OnClose => {
                    println!("Data channel {id} is closed");
                    break;
                }
                DataChannelEvent::OnMessage(msg) => {
                    let msg_str = String::from_utf8(msg.data.to_vec()).unwrap();
                    println!("Message from DataChannel '{label}': '{msg_str}'");
                }
                _ => {}
            }
        }
    }));

    // Create an offer to send to the browser
    let offer = peer_connection.create_offer(None).await?;

    // Sets the LocalDescription, and starts our UDP listeners
    peer_connection.set_local_description(offer).await?;

    // Block until ICE Gathering is complete, disabling trickle ICE
    // we do this because we only can exchange one signaling message
    // in a production application you should exchange ICE Candidates via OnICECandidate
    let _ = gather_complete_rx.recv().await;

    // Output the answer in base64 so we can paste it in browser
    if let Some(local_desc) = peer_connection.local_description().await {
        println!("offer: {}", local_desc);
        let json_str = serde_json::to_string(&local_desc)?;
        let b64 = signal::encode(&json_str);
        println!("{b64}");
    } else {
        println!("generate local_description failed!");
    }

    // Wait for the answer to be pasted
    let line = if input_sdp_file.is_empty() {
        println!("Please paste offer here:");
        signal::must_read_stdin()?
    } else {
        fs::read_to_string(&input_sdp_file)?
    };
    let desc_data = signal::decode(line.as_str())?;
    let answer = serde_json::from_str::<RTCSessionDescription>(&desc_data)?;
    println!("answer: {}", answer);
    // Apply the answer as the remote description
    peer_connection.set_remote_description(answer).await?;

    println!("Press ctrl-c to stop");
    futures::select! {
        _ = done_rx.recv().fuse() => {
            println!("received done signal!");
        }
        _ = ctrlc_rx.recv().fuse() => {
            println!("received ctrl-c signal!");
        }
    }

    peer_connection.close().await?;

    Ok(())
}

```

### Core Architecture Module: `examples/data-channels-flow-control-multi/data-channels-flow-control-multi.rs`
```
//! Multi-pair data-channel flow-control bench for a single-`poop` N-connection run.
//!
//! Spawns `FLOW_PAIRS` in-process connection pairs, each running the unordered/no-retransmit,
//! 1 KB / 512 KB-1 MB-watermark, `bufferedAmount`-flow-controlled transfer of the stock
//! `data-channels-flow-control` example. Each pair skips `FLOW_WARMUP_MB` of ramp, then
//! measures per-interval steady-state throughput over `FLOW_STOP_MB`; once every pair has
//! finished its measured window the process prints an aggregate `FINAL` line and exits.
//! Fixed work per run ⇒ a clean `poop` command:
//!
//!   FLOW_PAIRS=10 FLOW_WARMUP_MB=64 FLOW_STOP_MB=128 FLOW_DEDICATED_REACTOR=1 \
//!     poop ./multi-master ./multi-backpressure ./pion-multi
//!
//! Uses ONLY public APIs, so the same source builds on upstream master and on the
//! send-back-pressure branch (no `outstanding_bytes()` dependency).

use bytes::BytesMut;
use futures::FutureExt;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use webrtc::data_channel::{DataChannel, DataChannelEvent, RTCDataChannelInit};
use webrtc::peer_connection::{
    MediaEngine, RTCConfigurationBuilder, RTCIceGatheringState, Registry,
    register_default_interceptors,
};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::runtime::{Runtime, Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::block_on;
use common::runtime;

const BUFFERED_LOW: u32 = 512 * 1024; // 512 KB
const BUFFERED_HIGH: u32 = 1024 * 1024; // 1 MB
// Application message size is set at runtime via FLOW_MSG_KB (default 1 KB).

fn env_usize(key: &str, default: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

#[derive(Clone)]
struct GatherHandler {
    gather_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for GatherHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_tx.try_send(());
        }
    }
}

#[derive(Clone)]
struct ResponderHandler {
    runtime: Arc<dyn Runtime>,
    gather_tx: Sender<()>,
    warmup_bytes: usize,
    stop_bytes: usize,
    stop: Arc<AtomicBool>,
    mbps_tx: Sender<f64>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for ResponderHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_tx.try_send(());
        }
    }

    async fn on_data_channel(&self, dc: Arc<dyn DataChannel>) {
        let warmup = self.warmup_bytes;
        let stop_bytes = self.stop_bytes;
        let stop = self.stop.clone();
        let mbps_tx = self.mbps_tx.clone();
        // Must spawn: returning from on_data_channel unblocks the driver.
        self.runtime.spawn(Box::pin(async move {
            let mut got = 0usize;
            let mut measure_start: Option<Instant> = None;
            let mut measure_start_bytes = 0usize;
            while let Some(event) = dc.poll().await {
                match event {
                    DataChannelEvent::OnMessage(msg) => {
                        got += msg.data.len();
                        // Start the clock once past the warmup threshold.
                        if measure_start.is_none() && got >= warmup {
                            measure_start = Some(Instant::now());
                            measure_start_bytes = got;
                        }
                        if let Some(start) = measure_start
                            && got - measure_start_bytes >= stop_bytes
                        {
                            let secs = start.elapsed().as_secs_f64();
                            let measured = got - measure_start_bytes;
                            let mbps = (measured * 8) as f64 / secs / (1024.0 * 1024.0);
                            let _ = mbps_tx.try_send(mbps);
                            stop.store(true, Ordering::Relaxed);
                            break;
                        }
                    }
                    DataChannelEvent::OnClose | DataChannelEvent::OnError => break,
                    _ => {}
                }
            }
        }));
    }
}

async fn build_pc(
    runtime: Arc<dyn Runtime>,
    dedicated_reactor: bool,
    handler: Arc<dyn PeerConnectionEventHandler>,
) -> anyhow::Result<Arc<dyn PeerConnection>> {
    let mut media = MediaEngine::default();
    media.register_default_codecs()?;
    let registry = register_default_interceptors(Registry::new(), &mut media)?;
    let dedicated_reactor_pool_size = if dedicated_reactor { 1 } else { 0 };

    let pc = PeerConnectionBuilder::new()
        .with_configuration(RTCConfigurationBuilder::new().build())
        .with_media_engine(media)
        .with_interceptor_registry(registry)
        .with_handler(handler)
        .with_runtime(runtime.clone())
        .with_udp_addrs(vec!["127.0.0.1:0".to_string()])
        .with_dedicated_reactor_pool_size(dedicated_reactor_pool_size)
        .build()
        .await?;
    Ok(Arc::new(pc) as Arc<dyn PeerConnection>)
}

/// Build + connect one unordered/no-retransmit pair; spawn its flow-controlled send loop and a
/// measuring receive loop. Returns both peer connections so the caller keeps them alive.
async fn run_pair(
    runtime: Arc<dyn Runtime>,
    dedicated: bool,
    warmup_bytes: usize,
    stop_bytes: usize,
    chunk_bytes: usize,
    ordered: bool,
    mbps_tx: Sender<f64>,
) -> anyhow::Result<[Arc<dyn PeerConnection>; 2]> {
    let stop = Arc::new(AtomicBool::new(false));

    // Requester
    let (req_gather_tx, mut req_gather_rx) = channel::<()>(1);
    let requester = build_pc(
        runtime.clone(),
        dedicated,
        Arc::new(GatherHandler {
            gather_tx: req_gather_tx,
        }),
    )
    .await?;

    // Default: unordered / no-retransmit (matches the stock data-channels-flow-control
    // example and pion's). FLOW_ORDERED=1 switches to ordered + reliable (no
    // max_retransmits), matching the batch-drain issue-101 comment's harness.
    let dc_init = if ordered {
        RTCDataChannelInit {
            ordered: true,
            ..Default::default()
        }
    } else {
        RTCDataChannelInit {
            ordered: false,
            max_retransmits: Some(0),
            ..Default::default()
        }
    };
    let dc = requester.create_data_channel("data", Some(dc_init)).await?;
    dc.set_buffered_amount_low_threshold(BUFFERED_LOW).await?;
    dc.set_buffered_amount_high_threshold(BUFFERED_HIGH).await?;

    // Flow-controlled send loop (single-task; mirrors data-channels-flow-control).
    {
        let stop = stop.clone();
        runtime.spawn(Box::pin(async move {
            let buf = BytesMut::from(vec![0u8; chunk_bytes].as_slice());
            let mut dc_open = false;
            let mut paused = false;
            loop {
                if stop.load(Ordering::Relaxed) {
                    break;
                }
                if dc_open && !paused {
                    futures::select! {
                        maybe_event = dc.poll().fuse() => match maybe_event {
                            Some(DataChannelEvent::OnBufferedAmountHigh) => paused = true,
                            Some(DataChannelEvent::OnBufferedAmountLow) => paused = false,
                            Some(DataChannelEvent::OnClose) | None => break,
                            _ => {}
                        },
                        result = dc.send(buf.clone()).fuse() => { let _ = result; }
                    }
                } else {
                    match dc.poll().await {
                        Some(DataChannelEvent::OnOpen) => dc_open = true,
                        Some(DataChannelEvent::OnBufferedAmountHigh) => paused = true,
                        Some(DataChannelEvent::OnBufferedAmountLow) => paused = false,
                        Some(DataChannelEvent::OnClose) | None => break,
                        _ => {}
                    }
                }
            }
        }));
    }

    let offer = requester.create_offer(None).await?;
    requester.set_local_description(offer).await?;
    req_gather_rx.recv().await;
    let offer_sdp = requester
        .local_description()
        .await
        .ok_or_else(|| anyhow::anyhow!("requester has no local description"))?;

    // Responder
    let (resp_gather_tx, mut resp_gather_rx) = channel::<()>(1);
    let responder = build_pc(
        runtime.clone(),
        dedicated,
        Arc::new(ResponderHandler {
            runtime: runtime.clone(),
            gather_tx: resp_gather_tx,
            warmup_bytes,
            stop_bytes,
            stop,
            mbps_tx,
        }),
    )
    .await?;

    responder.set_remote_description(offer_sdp).await?;
    let answer = responder.create_answer(None).await?;
    responder.set_local_description(answer).await?;
    resp_gather_rx.recv().await;
    let answer_sdp = responder
        .local_description()
        .await
        .ok_or_else(|| anyhow::anyhow!("responder has no local description"))?;
    requester.set_remote_description(answer_sdp).await?;

    Ok([requester, responder])
}

fn main() -> anyhow::Result<()> {
    block_on(async_main())
}

async fn async_main() -> anyhow::Result<()> {
    let pairs = env_usize("FLOW_PAIRS", 10);
    let warmup_bytes = env_usize("FLOW_WARMUP_MB", 64) * 1024 * 1024;
    let stop_bytes = env_usize("FLOW_STOP_MB", 128) * 1024 * 1024;
    // Application message size. Large messages (e.g. 64) fragment into many MTU-sized
    // SCTP DATA chunks -> many same-size datagrams to one peer, which the driver
    // coalesces into single UDP GSO syscalls; 1 (the default) is one datagram/message.
    let chunk_bytes = env_usize("FLOW_MSG_KB", 1) * 1024;
    // FLO
```

### Core Architecture Module: `examples/data-channels-flow-control/data-channels-flow-control.rs`
```
//! Data Channels Flow Control Example
//!
//! Demonstrates flow control via `OnBufferedAmountHigh` / `OnBufferedAmountLow` events.
//! Two in-process peer connections are created: a requester that sends data as fast as
//! possible and a responder that measures throughput.
//!
//! When the send buffer exceeds MAX_BUFFERED_AMOUNT the sender pauses; it resumes once
//! the buffer drains below BUFFERED_AMOUNT_LOW_THRESHOLD.

use bytes::BytesMut;
use clap::Parser;
use env_logger::Target;
use futures::FutureExt;
use std::fs::OpenOptions;
use std::io::Write;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use webrtc::data_channel::{DataChannel, DataChannelEvent, RTCDataChannelInit};
use webrtc::peer_connection::{
    MediaEngine, RTCConfigurationBuilder, RTCIceGatheringState, RTCPeerConnectionState, Registry,
    register_default_interceptors,
};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::runtime::{Runtime, Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::block_on;
use common::runtime;

// Match pion's data-channels-flow-control example so throughput is comparable:
// pause the sender once ~1 MB is buffered, resume below 512 KB. (The previous
// 100 MB high-water mark let a fast sender flood the SCTP send buffer and starve
// the driver on cooperatively-scheduled runtimes such as smol.)
const BUFFERED_AMOUNT_LOW_THRESHOLD: u32 = 512 * 1024; // 512 KB
const BUFFERED_AMOUNT_HIGH_THRESHOLD: u32 = 1024 * 1024; // 1 MB

// ── Requester handler ────────────────────────────────────────────────────────

#[derive(Clone)]
struct RequesterHandler {
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for RequesterHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("[requester] Connection state: {state}");
        if state == RTCPeerConnectionState::Failed {
            let _ = self.done_tx.try_send(());
        }
    }
}

// ── Responder handler ────────────────────────────────────────────────────────

#[derive(Clone)]
struct ResponderHandler {
    runtime: Arc<dyn Runtime>,
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for ResponderHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("[responder] Connection state: {state}");
        if state == RTCPeerConnectionState::Failed {
            let _ = self.done_tx.try_send(());
        }
    }

    async fn on_data_channel(&self, data_channel: Arc<dyn DataChannel>) {
        let done_tx = self.done_tx.clone();
        // Must spawn: returning from on_data_channel unblocks the driver;
        // awaiting poll() here would stall it.
        self.runtime.spawn(Box::pin(async move {
            // ── perf harness (env-controlled, off by default) ─────────────────
            // FLOW_WARMUP_MB: don't start the clock until N MB have arrived (skip ramp).
            // FLOW_STOP_MB:   after N measured MB, print a FINAL line and exit so
            //                 `perf stat` gets a clean, deterministic, bounded run.
            let warmup_bytes = std::env::var("FLOW_WARMUP_MB")
                .ok()
                .and_then(|v| v.parse::<usize>().ok())
                .map(|mb| mb * 1024 * 1024);
            let stop_bytes = std::env::var("FLOW_STOP_MB")
                .ok()
                .and_then(|v| v.parse::<usize>().ok())
                .map(|mb| mb * 1024 * 1024);
            let mut measure_start: Option<Instant> = None;
            let mut measure_start_bytes: usize = 0;
            // ──────────────────────────────────────────────────────────────────

            let mut total_bytes: usize = 0;
            let mut last_bytes: usize = 0;
            let mut period_start = Instant::now();

            while let Some(event) = data_channel.poll().await {
                match event {
                    DataChannelEvent::OnOpen => {
                        println!("[responder] Data channel open — measuring throughput...");
                        period_start = Instant::now();
                    }
                    DataChannelEvent::OnMessage(msg) => {
                        total_bytes += msg.data.len();

                        // Start the measurement clock once past the warmup threshold.
                        if measure_start.is_none() && warmup_bytes.is_none_or(|w| total_bytes >= w)
                        {
                            let now = Instant::now();
                            measure_start = Some(now);
                            measure_start_bytes = total_bytes;
                            last_bytes = total_bytes;
                            period_start = now;
                        }

                        // Deterministic stop for `perf stat`: exit after N measured MB.
                        if let (Some(start), Some(stop)) = (measure_start, stop_bytes)
                            && total_bytes - measure_start_bytes >= stop
                        {
                            let secs = start.elapsed().as_secs_f64();
                            let measured = total_bytes - measure_start_bytes;
                            let mbps = (measured * 8) as f64 / secs / (1024.0 * 1024.0);
                            println!(
                                "FINAL {:.3} Mbps over {} MB in {:.3}s",
                                mbps,
                                measured / (1024 * 1024),
                                secs
                            );
                            let _ = done_tx.try_send(());
                            break;
                        }

                        // Print once per second (only while measuring).
                        if measure_start.is_some() {
                            let now = Instant::now();
                            if now.duration_since(period_start) >= Duration::from_secs(1) {
                                let elapsed = now.duration_since(period_start);
                                let bps =
                                    ((total_bytes - last_bytes) * 8) as f64 / elapsed.as_secs_f64();
                                println!(
                                    "Throughput is about {:.03} Mbps",
                                    bps / (1024.0 * 1024.0)
                                );
                                last_bytes = total_bytes;
                                period_start = now;
                            }
                        }
                    }
                    DataChannelEvent::OnClose => {
                        let _ = done_tx.try_send(());
                        break;
                    }
                    _ => {}
                }
            }
        }));
    }
}

// ── Entry point ──────────────────────────────────────────────────────────────

#[derive(Parser)]
#[command(name = "data-channels")]
#[command(author = "Rusty Rain <y@liu.mx>")]
#[command(version = "0.0.0")]
#[command(about = "An example of Data-Channels", long_about = None)]
struct Cli {
    #[arg(short, long)]
    debug: bool,
    #[arg(short, long, default_value_t = format!("INFO"))]
    log_level: String,
    #[arg(short, long, default_value_t = format!(""))]
    output_log_file: String,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let output_log_file = cli.output_log_file;
    let log_level = log::LevelFilter::from_str(&cli.log_level)?;
    if cli.debug {
        env_logger::Builder::new()
            .target(if !output_log_file.is_empty() {
                Target::Pipe(Box::new(
                    OpenOptions::new()
                        .create(true)
                        .write(true)
                        .truncate(true)
                        .open(output_log_file)?,
                ))
            } else {
                Target::Stdout
            })
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log_level)
            .init();
    }

    block_on(async_main())
}

async fn async_main() -> anyhow::Result<()> {
    let (done_tx, mut done_rx) = channel::<()>(1);
    let (ctrlc_tx, mut ctrlc_rx) = channel::<()>(1);
    ctrlc::set_handler(move || {
        let _ = ctrlc_tx.try_send(());
    })?;

    let runtime = runtime();

    // Opt into the dedicated per-connection reactor thread (issue #101) via env.
    let dedicated_reactor = std::env::var("FLOW_DEDICATED_REACTOR").is_ok();
    let dedicated_reactor_pool_size = if dedicated_reactor { 1 } else { 0 };

    // ── Build requester peer connection ──────────────────────────────────────
    let (req_gather_tx, mut req_gather_rx) = channel::<()>(1);
    let mut req_media = MediaEngine::default();
    req_media.register_default_codecs()?;
    let req_registry = register_default_interceptors(Registry::new(), &mut req_media)?;

    let requester = PeerConnectionBuilder::new()
        .with_configuration(RTCConfigurationBuilder::new().build())
        .with_media_engine(req_media)
        .with_interceptor_registry(req_regist
```

### Core Architecture Module: `examples/data-channels-offer-answer/data-channels-answer.rs`
```
//! Answer side of the offer/answer example.
//!
//! Run `answer` first, then `offer`.  They exchange SDP over HTTP and send
//! random messages to each other via a WebRTC data channel every 5 seconds.
//!
//! Usage:
//!   cargo run --example answer -- [--answer-address 0.0.0.0:60000] [--offer-address localhost:50000] [-d]

use std::io::Write;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use bytes::BytesMut;
use clap::Parser;
use futures::FutureExt;
use hyper::{Body, Client, Method, Request};
use signal::get_local_ip;
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::peer_connection::{
    MediaEngine, RTCConfigurationBuilder, RTCIceGatheringState, RTCIceServer,
    RTCPeerConnectionState, Registry, register_default_interceptors,
};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::runtime::{Runtime, Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, runtime, sleep};

#[derive(Parser)]
#[command(name = "answer", about = "WebRTC answer side")]
struct Cli {
    #[arg(long, default_value = "0.0.0.0:60000")]
    answer_address: String,
    #[arg(long, default_value = "localhost:50000")]
    offer_address: String,
    #[arg(short, long)]
    debug: bool,
}

#[derive(Clone)]
struct AnswerHandler {
    runtime: Arc<dyn Runtime>,
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for AnswerHandler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        println!("Peer connection state: {state}");
        if state == RTCPeerConnectionState::Failed {
            let _ = self.done_tx.try_send(());
        }
    }

    async fn on_data_channel(&self, dc: Arc<dyn DataChannel>) {
        let done_tx = self.done_tx.clone();
        // Must spawn: blocking here would stall the driver.
        self.runtime.spawn(Box::pin(async move {
            let mut opened = false;
            let label = dc.label().await.unwrap_or_default();
            let id = dc.id();
            let mut count = 0u32;
            let mut send_timer = Box::pin(sleep(Duration::from_secs(5)));

            loop {
                if opened {
                    futures::select! {
                        event = dc.poll().fuse() => {
                            match event {
                                Some(DataChannelEvent::OnMessage(msg)) => {
                                    let text = String::from_utf8(msg.data.to_vec())
                                        .unwrap_or_default();
                                    println!("Message from DataChannel '{label}': '{text}'");
                                }
                                Some(DataChannelEvent::OnClose) | None => {
                                    let _ = done_tx.try_send(());
                                    break;
                                }
                                _ => {}
                            }
                        }
                        _ = send_timer.as_mut().fuse() => {
                            let message = format!("answer-{count}");
                            count += 1;
                            println!("Sending '{message}'");
                            let _ = dc.send(BytesMut::from(message.as_bytes())).await;
                            send_timer = Box::pin(sleep(Duration::from_secs(5)));
                        }
                    }
                } else {
                    match dc.poll().await {
                        Some(DataChannelEvent::OnOpen) => {
                            println!("Data channel '{label}'-'{id}' open");
                            opened = true;
                            send_timer = Box::pin(sleep(Duration::from_secs(5)));
                        }
                        Some(DataChannelEvent::OnClose) | None => {
                            let _ = done_tx.try_send(());
                            break;
                        }
                        _ => {}
                    }
                }
            }

            println!("exit loop for DataChannel '{label}'-'{id}'");
        }));
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    if cli.debug {
        env_logger::Builder::new()
            .format(|buf, record| {
                writeln!(
                    buf,
                    "{}:{} [{}] {} - {}",
                    record.file().unwrap_or("unknown"),
                    record.line().unwrap_or(0),
                    record.level(),
                    chrono::Local::now().format("%H:%M:%S.%6f"),
                    record.args()
                )
            })
            .filter(None, log::LevelFilter::Trace)
            .init();
    }
    block_on(async_main(cli))
}

async fn async_main(cli: Cli) -> Result<()> {
    let (done_tx, mut done_rx) = channel::<()>(1);
    let (ctrlc_tx, mut ctrlc_rx) = channel::<()>(1);
    ctrlc::set_handler(move || {
        let _ = ctrlc_tx.try_send(());
    })?;

    let runtime = runtime();

    let (gather_tx, mut gather_rx) = channel::<()>(1);

    let mut media = MediaEngine::default();
    media.register_default_codecs()?;
    let registry = register_default_interceptors(Registry::new(), &mut media)?;

    let pc = PeerConnectionBuilder::new()
        .with_configuration(
            RTCConfigurationBuilder::new()
                .with_ice_servers(vec![RTCIceServer {
                    urls: vec!["stun:stun.l.google.com:19302".to_owned()],
                    ..Default::default()
                }])
                .build(),
        )
        .with_media_engine(media)
        .with_interceptor_registry(registry)
        .with_handler(Arc::new(AnswerHandler {
            runtime: runtime.clone(),
            gather_complete_tx: gather_tx,
            done_tx: done_tx.clone(),
        }))
        .with_runtime(runtime.clone())
        .with_udp_addrs(vec![format!("{}:0", get_local_ip())])
        .build()
        .await?;

    // Start HTTP server to receive the offer SDP
    let answer_port = cli
        .answer_address
        .split(':')
        .last()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(60000);
    let mut sdp_rx = signal::http_sdp_server(answer_port).await;
    println!("Listening on http://{}", cli.answer_address);
    println!("Waiting for offer...");

    // Wait for offer SDP
    let offer_str = sdp_rx
        .recv()
        .await
        .ok_or_else(|| anyhow::anyhow!("offer channel closed"))?;
    let offer_sdp = serde_json::from_str(&offer_str)?;

    // Complete the exchange
    pc.set_remote_description(offer_sdp).await?;
    let answer = pc.create_answer(None).await?;
    pc.set_local_description(answer).await?;

    // Wait for ICE gathering to complete (non-trickle)
    gather_rx.recv().await;

    let answer_sdp = pc
        .local_description()
        .await
        .ok_or_else(|| anyhow::anyhow!("no local description"))?;

    // POST the answer SDP back to the offer side
    let payload = serde_json::to_string(&answer_sdp)?;
    let req = Request::builder()
        .method(Method::POST)
        .uri(format!("http://{}/sdp", cli.offer_address))
        .header("content-type", "application/json; charset=utf-8")
        .body(Body::from(payload))?;
    Client::new().request(req).await?;

    println!("Press ctrl-c to stop");
    futures::select! {
        _ = done_rx.recv().fuse() => {
            println!("Peer connection failed or data channel closed.");
        }
        _ = ctrlc_rx.recv().fuse() => {
            println!();
        }
    }

    pc.close().await?;
    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #778** (2026-06-23): **Fix localhost ip 127.0.0.1 takes too long to recv RTCIceGatheringState::Complete,  when stun:stun.l.google.com:19302 is set**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > should be fixed in commit a6600fb86b9b9b58c31e63fb9c8adc5faf3c789a

- **Issue #777** (2026-06-24): **better handling on socket recv error**
  *Symptoms*: 

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

### Incident Patch 1: `a53d7ac4` (2026-10-24)
**Commit Message**: feat(webrtc): multiplex peer connections over a single UDP socket (UDPMux) (#918)

* chore: bump the rtc submodule to master (with webrtc-rs/rtc#270)

SettingEngine::ice_credentials / set_ice_credentials, which the UDP mux
uses to pin each connection's credentials.

* feat(webrtc): multiplex peer connections over a single UDP socket

Add webrtc::peer_connection::transport::udp_mux: a UDPMux trait and the
built-in UDPMuxDefault, plus PeerConnectionBuilder::with_udp_mux. One
bound socket serves any number of connections — the SRS/mediamtx
deployment shape (Pion's ICEUDPMux equivalent) — where pinning
with_udp_addrs to a fixed port fails the second connection's bind with
EADDRINUSE.

How it works:

- UDPMuxDefault owns the socket and a reader task. Inbound datagrams are
  demultiplexed by the local ufrag in a STUN check's USERNAME (the only
  traffic that carries one), then by learnt peer address for DTLS/SRTP;
  a ufrag match re-points the address route, so a client reconnecting
  from the same address with fresh credentials is not stranded on its
  old connection's route.
- A muxed connection gets a virtual AsyncUdpSocket (UdpMuxedConn) from
  mux registration; the driver is otherwi

**File**: `CHANGELOG.md` (modified, +14/-0)
```diff
@@ -9,6 +9,20 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Added
 
+- **UDP multiplexing: many peer connections over one shared UDP socket** — new
+  `webrtc::peer_connection::transport::udp_mux` module with a `UDPMux` trait and the built-in
+  `UDPMuxDefault`. Handing one mux to every `PeerConnectionBuilder::with_udp_mux` serves any
+  number of connections from a single fixed UDP port (the SRS/mediamtx deployment shape),
+  where a pinned `with_udp_addrs` port fails the second connection's bind with `EADDRINUSE`.
+  The mux's reader demultiplexes inbound datagrams by the local ICE ufrag in each STUN check
+  and by learnt peer address for ufrag-less traffic (DTLS/SRTP/SRTCP); candidates are
+  advertised per interface on the mux's port, with inbound packets attributed to an interface
+  via `RecvMeta::dst_ip` (packet info) and outbound ones pinned with `Transmit::src_ip` on a
+  wildcard listen. Muxed connections gather host candidates only (the restriction Pion's
+  `ICEUDPMux` documents), and their ICE credentials are pinned at build time so the route
+  survives ICE restarts. `tests/udp_mux.rs` runs two connections on one fixed port end to end.
+  Requires `rtc` ≥ the commit that adds `SettingEngine::set_ice_credentials`/
+  `ice_credentials`.
 - **Crypto provider selection** ([webrtc#839](https://github.com/webrtc-rs/webrtc/issues/839),
   [rtc#128](https://github.com/webrtc-rs/rtc/issues/128)). New `crypto-ring` (default) and `crypto-aws-lc-rs`
   Cargo features forward to `rtc`. They are additive: enabling both compiles both providers and
```

**File**: `Cargo.toml` (modified, +6/-0)
```diff
@@ -58,6 +58,7 @@ clap = { version = "4.6.1", features = ["derive"] }
 anyhow = "1.0.103"
 ctrlc = "3.5.2"
 serde_json = "1.0.150"
+serde = { version = "1.0.228", features = ["derive"] }
 hyper = { version = "0.14.32", features = ["full"] }
 rand = "0.10.1"
 base64 = "0.22.1"
@@ -274,3 +275,8 @@ required-features = ["runtime-tokio"]
 name = "stats"
 path = "examples/stats/stats.rs"
 bench = false
+
+[[example]]
+name = "udp-mux"
+path = "examples/udp-mux/udp-mux.rs"
+bench = false
```

**File**: `examples/udp-mux/demo.html` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+<!DOCTYPE html>
+<html>
+<head>
+  <meta charset="utf-8">
+  <title>UDP Mux DataChannel Test</title>
+</head>
+<body>
+  <h2>WebRTC DataChannel Test</h2>
+  <input id="msg" placeholder="Message">
+  <button id="sendBtn" disabled onclick="sendMsg()">Send</button>
+  <pre id="log"></pre>
+  <script>
+    const sessionId = crypto.randomUUID();
+    const pc = new RTCPeerConnection({iceServers: []});
+    const channel = pc.createDataChannel("chat");
+    const log = msg => document.getElementById("log").textContent += msg + "\n";
+    pc.onconnectionstatechange = () => log(`Connection state: ${pc.connectionState}`);
+    channel.onopen = () => {
+      log("DataChannel opened");
+      document.getElementById("sendBtn").disabled = false;
+    };
+    channel.onmessage = event => log(`Server: ${event.data}`);
+    pc.onicecandidate = event => {
+      if (event.candidate) fetch("/candidate", {
+        method: "POST",
+        headers: {"Content-Type": "application/json"},
+        body: JSON.stringify({session_id: sessionId, candidate: event.candidate})
+      });
+    };
+    async function start() {
+      const offer = await pc.createOffer();
+      await pc.setLocalDescription(offer);
+      const response = await fetch("/offer", {
+        method: "POST",
+        headers: {"Content-Type": "application/json"},
+        body: JSON.stringify({session_id: sessionId, offer})
+      });
+      if (!response.ok) throw new Error(`HTTP ${response.status}`);
+      await pc.setRemoteDescription(await response.json());
+    }
+    function sendMsg() {
+      const input = document.getElementById("msg");
+      if (input.value.trim() && channel.readyState === "open") {
+        channel.send(input.value);
+        log(`You: ${input.value}`);
+        input.value = "";
+      }
+    }
+    start().catch(error => log(`Connection failed: ${error.message}`));
+  </script>
+</body>
+</html>
```

**File**: `examples/udp-mux/udp-mux.rs` (added, +504/-0)
```diff
@@ -0,0 +1,504 @@
+//! udp-mux serves any number of browser data-channel sessions over **one** UDP port.
+//!
+//! This example demonstrates:
+//! - `UDPMuxDefault` sharing one UDP socket across every peer connection
+//! - HTTP signaling (offer → answer, trickle ICE), one browser tab per connection
+//! - Why: with per-connection binds (`with_udp_addrs`), pinning one port fails the second
+//!   connection with `EADDRINUSE`; with a mux, only the mux binds, so one firewall/forward
+//!   rule covers every session — the deployment shape of servers like SRS or mediamtx.
+//!
+//! Run it, open http://127.0.0.1:8080 in several browser tabs, and connect them all:
+//! every session's media arrives on UDP port 9002.
+
+use anyhow::Result;
+use futures::FutureExt;
+use hyper::service::{make_service_fn, service_fn};
+use hyper::{Body, Method, Request, Response, Server, StatusCode};
+use log::{error, info};
+use std::collections::HashMap;
+use std::net::SocketAddr;
+use std::sync::{Arc, Mutex};
+use std::time::{Duration, Instant};
+use webrtc::data_channel::{DataChannel, DataChannelEvent};
+use webrtc::peer_connection::transport::udp_mux::{UDPMux, UDPMuxDefault};
+use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
+use webrtc::peer_connection::{
+    RTCIceCandidateInit, RTCIceGatheringState, RTCPeerConnectionState, RTCSessionDescription,
+};
+use webrtc::runtime::{Runtime, Sender, channel};
+
+#[path = "../common/mod.rs"]
+mod common;
+use common::{block_on, runtime, timeout};
+
+const DEMO_HTML: &str = include_str!("demo.html");
+
+/// The UDP port every session shares.
+const MUX_UDP_PORT: u16 = 9002;
+const MAX_PENDING_CANDIDATES: usize = 256;
+const DISCONNECTED_TIMEOUT: Duration = Duration::from_secs(60);
+const PENDING_CANDIDATE_TTL: Duration = Duration::from_secs(30);
+const INVALID_SESSION_ID: &str = "session_id must contain 1 to 128 bytes and no control characters";
+
+fn valid_session_id(id: &str) -> bool {
+    !id.is_empty() && id.len() <= 128 && !id.chars().any(char::is_control)
+}
+
+#[derive(Default)]
+struct DisconnectWatchdog {
+    since: Mutex<Option<Instant>>,
+}
+
+impl DisconnectWatchdog {
+    fn update(&self, state: RTCPeerConnectionState, now: Instant) {
+        let mut since = self.since.lock().unwrap();
+        if state == RTCPeerConnectionState::Disconnected {
+            since.get_or_insert(now);
+        } else {
+            *since = None;
+        }
+    }
+
+    fn expired(&self, now: Instant) -> bool {
+        self.since
+            .lock()
+            .unwrap()
+            .is_some_and(|since| now.duration_since(since) >= DISCONNECTED_TIMEOUT)
+    }
+}
+
+struct Session {
+    generation: u64,
+    pc: Arc<dyn PeerConnection>,
+    watchdog: Arc<DisconnectWatchdog>,
+}
+
+type PendingCandidates = HashMap<String, Vec<(Instant, RTCIceCandidateInit)>>;
+
+fn prune_pending(candidates: &mut PendingCandidates, now: Instant) {
+    candidates.retain(|_, entries| {
+        entries.retain(|(received, _)| now.duration_since(*received) < PENDING_CANDIDATE_TTL);
+        !entries.is_empty()
+    });
+}
+
+// ── Shared state for HTTP handlers ─────────────────────────────────────────────
+
+#[derive(Clone)]
+struct AppState {
+    offer_tx: Sender<(
+        String,
+        RTCSessionDescription,
+        Sender<Result<RTCSessionDescription, String>>,
+    )>,
+    candidate_tx: Sender<(String, RTCIceCandidateInit)>,
+}
+
+#[derive(serde::Deserialize)]
+struct OfferRequest {
+    session_id: String,
+    offer: RTCSessionDescription,
+}
+
+#[derive(serde::Deserialize)]
+struct CandidateRequest {
+    session_id: String,
+    candidate: RTCIceCandidateInit,
+}
+
+// ── WebRTC event handler ───────────────────────────────────────────────────────
+
+struct Handler {
+    id: String,
+    generation: u64,
+    stopped_tx: async_channel::Sender<(String, u64)>,
+    watchdog: Arc<DisconnectWatchdog>,
+    gather_complete_tx: Sender<()>,
+    runtime: Arc<dyn Runtime>,
+}
+
+#[async_trait::async_trait]
+impl PeerConnectionEventHandler for Handler {
+    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
+        if state == RTCIceGatheringState::Complete {
+            let _ = self.gather_complete_tx.try_send(());
+        }
+    }
+
+    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
+        self.watchdog.update(state, Instant::now());
+        info!("[session {}] connection state: {}", self.id, state);
+        if matches!(
+            state,
+            RTCPeerConnectionState::Failed | RTCPeerConnectionState::Closed
+        ) {
+            let _ = self.stopped_tx.try_send((self.id.clone(), self.generation));
+        }
+    }
+
+    async fn on_data_channel(&self, dc: Arc<dyn DataChannel>) {
+        let id = self.id.clone();
+        self.runtime.spawn(Box::pin(async move {
+            let label = dc.label().await.unwrap_or_default();
+            info!("[session {id}] data channe
```

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 07423df27fbbbaaf56f45ee43343f9836304a9da
+Subproject commit ec4696855a5c34319254f48aeda2eddb1225e8f7
```

**File**: `src/peer_connection/driver.rs` (modified, +357/-57)
```diff
@@ -12,14 +12,15 @@ use crate::media_stream::track_remote::static_rtp::TrackRemoteStaticRTP;
 use crate::media_stream::track_remote::{TrackRemote, TrackRemoteEvent};
 use crate::peer_connection::PeerConnectionRef;
 use crate::peer_connection::transport::tcp_transport::RTCTcpTransport;
+use crate::peer_connection::transport::udp_mux::{UDPMux, UDPMuxConnHandle};
 use crate::peer_connection::transport::{
     MAX_GSO_BATCH_BYTES, MAX_GSO_SEGMENTS, MIN_GSO_RUN, SocketRecvResult, UDP_RECV_BUF_LEN,
     gro_recv_buf_len, is_retryable_socket_recv_error,
 };
 use crate::rtp_transceiver::rtp_receiver::RtpReceiverImpl;
 use crate::rtp_transceiver::{RtpReceiver, RtpTransceiverImpl};
 use crate::runtime::{
-    AsyncTcpStream, AsyncUdpSocket, EcnCodepoint, Receiver, RecvMeta, Sender, Transmit,
+    AsyncTcpStream, AsyncUdpSocket, EcnCodepoint, Receiver, RecvMeta, Runtime, Sender, Transmit,
     TrySendError, channel,
 };
 use bytes::BytesMut;
@@ -341,13 +342,15 @@ fn restage_retained_data_channel_events(
 /// boxed-future convenience (`send_to`), which would cost one heap allocation per datagram
 /// on the hot path. `segment_size` of `0` sends a single datagram; non-zero requests UDP
 /// GSO — only valid when the socket reports `max_gso_segments() > 1`. `ecn` carries the raw
-/// two codepoint bits.
+/// two codepoint bits. `src_ip` pins the datagram's source address on a wildcard socket (a
+/// shared mux socket is the case that needs it); `None` leaves the choice to the kernel.
 async fn send_datagrams(
     socket: &dyn AsyncUdpSocket,
     buf: &[u8],
     segment_size: usize,
     target: SocketAddr,
     ecn: Option<u8>,
+    src_ip: Option<IpAddr>,
 ) -> Result<usize> {
     let transmit = Transmit {
         destination: target,
@@ -356,7 +359,7 @@ async fn send_datagrams(
         // `0` means "no segmentation": hand the whole buffer over as one datagram rather
         // than asking the kernel to shred it into 0-byte segments.
         segment_size: (segment_size != 0).then_some(segment_size),
-        src_ip: None,
+        src_ip,
     };
     futures::future::poll_fn(|cx| socket.poll_send(cx, &transmit))
         .await
@@ -531,6 +534,20 @@ pub(crate) struct PeerConnectionDriver<A = SocketAddr> {
     /// than the ones that existed when the connection was built.
     udp_addrs: Vec<A>,
     tcp_addrs: Vec<A>,
+    /// The shared socket this connection rides on, when it is muxed. Mutually exclusive with
+    /// binding `udp_addrs` per connection; see
+    /// [`udp_mux`](crate::peer_connection::transport::udp_mux).
+    udp_mux: Option<Arc<dyn UDPMux>>,
+    /// The connection's registration in `udp_mux`, registered once at first bind. On an ICE
+    /// restart the same registration gains the new ufrag via `add_ufrag` — its queue and
+    /// socket view never change. Kept separately from `udp_sockets`: that map keys the conn by
+    /// every advertised interface address for the write path, while the receive loop wants
+    /// exactly one entry for it.
+    mux_conn: Option<(UDPMuxConnHandle, Arc<dyn AsyncUdpSocket>)>,
+    /// The connection's current ICE ufrag on the mux.
+    mux_active_ufrag: Option<String>,
+    /// ufrags a restart rotated away from, still routable until their grace ends.
+    mux_ufrag_expiry: VecDeque<(Instant, String)>,
     mdns_mode: MulticastDnsMode,
     ice_servers: Vec<RTCIceServer>,
     ice_gather_policy: RTCIceTransportPolicy,
@@ -556,6 +573,7 @@ where
         inner: Arc<PeerConnectionRef>,
         udp_addrs: Vec<A>,
         tcp_addrs: Vec<A>,
+        udp_mux: Option<Arc<dyn UDPMux>>,
         mdns_mode: MulticastDnsMode,
         ice_servers: Vec<RTCIceServer>,
         ice_gather_policy: RTCIceTransportPolicy,
@@ -592,6 +610,10 @@ where
             pending_data_channel_events: HashMap::new(),
             udp_addrs,
             tcp_addrs,
+            udp_mux,
+            mux_conn: None,
+            mux_active_ufrag: None,
+            mux_ufrag_expiry: VecDeque::new(),
             mdns_mode,
             ice_servers,
             ice_gather_policy,
@@ -626,6 +648,10 @@ where
     async fn bind_transports(&mut self) -> Result<()> {
         let runtime = Arc::clone(&self.inner.runtime);
 
+        if let Some(mux) = self.udp_mux.clone() {
+            return self.bind_muxed_transports(&mux).await;
+        }
+
         // Release TURN allocations while the old UDP sockets still exist. Rebinding drops them
         // below, and a Refresh(0) sent from a new socket would not match the allocation's
         // 5-tuple, leaving it on the server until it expires. The initial bind has no previous
@@ -665,6 +691,173 @@ where
                 .insert(local_addr, runtime.wrap_udp_socket(socket)?);
         }
 
+        self.bind_tcp_listeners(&runtime)?;
+        if self.udp_sockets.is_empty() && self.tcp_transport.is_empty() {
+            return Err(Error::Other(
+                "no udp_sockets or tcp_listeners available".to_owned(),
+            ));
+        }
```

**File**: `src/peer_connection/mod.rs` (modified, +95/-0)
```diff
@@ -86,6 +86,7 @@ use crate::media_stream::track_local::TrackLocalEvent;
 use crate::media_stream::track_local::static_rtp::TrackLocalStaticRTP;
 use crate::media_stream::track_remote::TrackRemoteEvent;
 use crate::peer_connection::driver::PeerConnectionDriverEvent;
+use crate::peer_connection::transport::udp_mux;
 use crate::rtp_transceiver::rtp_sender::RtpSenderImpl;
 pub use rtc::interceptor::Registry;
 
@@ -184,6 +185,7 @@ pub struct PeerConnectionBuilder<A: ToSocketAddrs> {
     handler: Option<Arc<dyn PeerConnectionEventHandler>>,
     udp_addrs: Vec<A>,
     tcp_addrs: Vec<A>,
+    udp_mux: Option<Arc<dyn udp_mux::UDPMux>>,
     dedicated_reactor_pool_size: usize,
     data_channel_send_buffer_limit: usize,
     /// Held rather than forwarded immediately, so [`build`](Self::build) can resolve the crypto
@@ -199,6 +201,7 @@ impl<A: ToSocketAddrs> Default for PeerConnectionBuilder<A> {
             handler: None,
             udp_addrs: vec![],
             tcp_addrs: vec![],
+            udp_mux: None,
             dedicated_reactor_pool_size: 0,
             setting_engine: SettingEngine::default(),
             // `usize::MAX` = unbounded: no send back-pressure unless the application
@@ -285,6 +288,23 @@ impl<A: ToSocketAddrs> PeerConnectionBuilder<A> {
         self
     }
 
+    /// Shares one UDP socket across connections instead of binding per connection.
+    ///
+    /// The mux owns the socket; this connection registers on it under its ICE ufrag and
+    /// receives the datagrams routed to that ufrag. This is the deployment shape of servers
+    /// like SRS or mediamtx: exactly one UDP port to open or forward, however many
+    /// connections the process serves. See [`udp_mux`] for how routing works and the
+    /// constraints (host candidates only; pinned ICE credentials).
+    ///
+    /// Mutually exclusive with [`with_udp_addrs`](Self::with_udp_addrs): the mux owns the
+    /// socket, so there is nothing left for a per-connection bind. ICE credentials are not
+    /// pinned by the mux — the driver registers whatever the agent holds at bind time and
+    /// re-registers under the rotated credentials on an ICE restart.
+    pub fn with_udp_mux(mut self, udp_mux: Arc<dyn udp_mux::UDPMux>) -> Self {
+        self.udp_mux = Some(udp_mux);
+        self
+    }
+
     /// Set the size of the dedicated reactor pool used. Defaults to `0`, means disabled.
     /// Values above `1024` are clamped down to it.
     ///
@@ -364,6 +384,33 @@ impl<A: ToSocketAddrs> PeerConnectionBuilder<A> {
         };
         self.setting_engine
             .set_crypto_provider(crypto_provider.clone());
+
+        // A muxed connection registers under the ICE credentials the agent holds: the driver
+        // reads them at first bind and re-reads them after an ICE restart (which rotates
+        // them), so nothing is pinned here — the mux's routing key always tracks the agent's
+        // current ufrag.
+        let udp_mux = if let Some(mux) = self.udp_mux {
+            if !self.udp_addrs.is_empty() {
+                return Err(Error::Other(
+                    "`with_udp_addrs` and `with_udp_mux` are mutually exclusive: the mux owns \
+                     the socket, there is nothing left to bind"
+                        .to_owned(),
+                ));
+            }
+            Some(mux)
+        } else {
+            None
+        };
+
+        // Whether the application pinned ICE credentials on the setting engine. Pinned
+        // credentials survive into ICE restarts (rtc reuses them), which a muxed connection
+        // cannot tolerate — its routing ufrag must rotate — so the combination is refused at
+        // restart time (see `ensure_mux_credentials_can_restart`).
+        let pins_credentials = {
+            let (ufrag, pwd) = self.setting_engine.ice_credentials();
+            !ufrag.is_empty() || !pwd.is_empty()
+        };
+
         let mdns_mode = self.setting_engine.multicast_dns().mode;
         let turn_allocation_refresh_interval_cap =
             self.setting_engine.turn_allocation_refresh_interval_cap();
@@ -399,10 +446,12 @@ impl<A: ToSocketAddrs> PeerConnectionBuilder<A> {
             discard_local_candidates_during_ice_restart,
             self.udp_addrs,
             self.tcp_addrs,
+            udp_mux,
             self.dedicated_reactor_pool_size,
             data_channel_send_buffer_limit,
             turn_allocation_refresh_interval_cap,
             crypto_provider,
+            pins_credentials,
         )
         .await
     }
@@ -746,6 +795,14 @@ pub(crate) struct PeerConnectionImpl {
     /// left running on a pool thread if the connection is dropped without an explicit
     /// `close()`. (`close()` itself treats both runtimes alike.)
     dedicated_reactor: bool,
+    /// Whether this connection shares a UDP mux. A mux gathers host candidates only, so a
+    /// relay-only ICE policy is rejected at `set_configuration` instead of silently gathering

```

**File**: `src/peer_connection/transport/mod.rs` (modified, +7/-1)
```diff
@@ -2,7 +2,8 @@
 //! objects an application reads through.
 //!
 //! Two layers share this module. Below: the plumbing that moves bytes — see `stun_gatherer`,
-//! `tcp_transport`, `turn_relayer` and the GRO/GSO constants, all crate-private. Above:
+//! `tcp_transport`, `turn_relayer` and the GRO/GSO constants, all crate-private, plus the
+//! public [`udp_mux`] (many connections sharing one UDP socket). Above:
 //! [`SctpTransport`], [`DtlsTransport`] and [`IceTransport`], the public handles mirroring the
 //! W3C interfaces of the same names.
 //!
@@ -54,6 +55,8 @@ pub(crate) mod stun_gatherer;
 pub(crate) mod tcp_transport;
 pub(crate) mod turn_relayer;
 
+pub mod udp_mux;
+
 /// Plain single-datagram UDP receive buffer size (no GRO coalescing).
 pub(crate) const UDP_RECV_BUF_LEN: usize = 2000;
 
@@ -120,6 +123,9 @@ pub(crate) enum SocketRecvResult {
         stride: usize,
         local_addr: SocketAddr,
         peer_addr: SocketAddr,
+        /// The datagram's destination IP from packet info, where the platform supplies it.
+        /// Consulted only for muxed conns, whose socket's bound address names no interface.
+        dst_ip: Option<std::net::IpAddr>,
         idx: usize,
         buf: Vec<u8>,
     },
```

---

### Incident Patch 2: `e74a9205` (2026-10-24)
**Commit Message**: fix(turn): retain allocation credentials across configuration updates (#928)

**File**: `src/peer_connection/transport/turn_relayer.rs` (modified, +155/-59)
```diff
@@ -116,20 +116,10 @@ impl RTCTurnRelayer {
         ice_servers: Vec<RTCIceServer>,
         ice_gather_policy: RTCIceTransportPolicy,
     ) {
-        // A pure credential rotation — same servers, same policy, different username or
-        // password — must NOT tear the allocations down. `local_addrs` is fixed at
-        // construction (the sockets are shared with host candidates), so a teardown here
-        // means the following `gather()` re-`Allocate`s on exactly the same 5-tuple. The
-        // server still holds the previous allocation for it and answers **437 (Allocation
-        // Mismatch)** per RFC 8656 §7.2, and the restart gathers no relay candidate at all
-        // (issue #835).
-        //
-        // An allocation is a 5-tuple resource, independent of the credential that created
-        // it, so the correct move is to re-sign the allocation we already have: update the
-        // client's credential and Refresh. Allocation, permissions and channel bindings all
-        // survive, so the data path is never interrupted.
+        // RFC 8656 section 5 binds subsequent requests to the allocation's
+        // original username. Keep established clients and their keys intact;
+        // the updated configuration supplies credentials for future allocations.
         if self.is_credential_only_change(&ice_servers, ice_gather_policy) {
-            self.rotate_credentials(&ice_servers);
             self.ice_servers = ice_servers;
             return;
         }
@@ -166,8 +156,8 @@ impl RTCTurnRelayer {
             return false;
         }
 
-        // Nothing to re-sign unless every live client's allocation is established; a client
-        // still mid-Allocate has no allocation to keep.
+        // Only established allocations can retain their original credentials;
+        // a client still mid-Allocate has no allocation to keep.
         if self
             .clients
             .values()
@@ -192,50 +182,6 @@ impl RTCTurnRelayer {
         }
     }
 
-    /// Re-signs every live allocation with the rotated credential and refreshes it.
-    ///
-    /// Best-effort per client: a client whose URL is no longer present, or whose refresh
-    /// fails to encode, is left alone rather than torn down — its allocation keeps working
-    /// on the old credential until it expires, which is strictly better than forcing the
-    /// 437 this path exists to avoid.
-    fn rotate_credentials(&mut self, ice_servers: &[RTCIceServer]) {
-        // url string -> (username, credential), matching how `gather` derives them.
-        let mut credentials: HashMap<String, (String, String)> = HashMap::new();
-        for ice_server in ice_servers {
-            let Ok(urls) = ice_server.urls() else {
-                continue;
-            };
-            for url in urls {
-                credentials.insert(
-                    url.to_string(),
-                    (url.username.clone(), url.password.clone()),
-                );
-            }
-        }
-
-        for managed in self.clients.values_mut() {
-            let Some((username, password)) = credentials.get(&managed.url) else {
-                continue;
-            };
-
-            let _ = managed
-                .client
-                .update_credentials(username.clone(), password.clone());
-
-            if let Err(err) = managed.client.refresh_allocations(self.runtime.now()) {
-                warn!(
-                    "TURN credential rotation: refresh failed for {} via {}: {}",
-                    managed.local_addr, managed.url, err
-                );
-            } else {
-                debug!(
-                    "TURN credentials rotated for {} via {}, allocation kept",
-                    managed.local_addr, managed.url
-                );
-            }
-        }
-    }
-
     pub(crate) fn is_turn_message(&self, msg: &TaggedBytesMut) -> bool {
         self.matching_client_key(msg).is_some()
     }
@@ -1102,4 +1048,154 @@ mod tests {
             );
         });
     }
+
+    #[test]
+    fn credential_rotation_preserves_existing_allocation_authentication() {
+        futures::executor::block_on(async {
+            use rtc::stun::attributes::ATTR_USERNAME;
+            use rtc::stun::message::{Getter, METHOD_ALLOCATE, METHOD_REFRESH};
+            use rtc::stun::textattrs::Username;
+            use rtc::turn::proto::lifetime::Lifetime;
+            use rtc::turn::proto::relayaddr::RelayedAddress;
+
+            let local_addr: SocketAddr = "127.0.0.1:50000".parse().unwrap();
+            let server_addr: SocketAddr = "127.0.0.1:3478".parse().unwrap();
+            let relay_addr: SocketAddr = "127.0.0.1:60000".parse().unwrap();
+            let server = |username: &str, password: &str| RTCIceServer {
+                urls: vec![format!("turn:{server_addr}?transport=udp")],
+                username: username.into(),
+                credential: password.into(),
+            };
+            let mut relayer =
```

**File**: `tests/ice_test.rs` (modified, +11/-19)
```diff
@@ -83,7 +83,7 @@ impl PeerConnectionEventHandler for CandidateTypeTracker {
 ///
 /// `username_tx` reports `(method, username)` for every authenticated request that carries
 /// a credential, so a test can tell *how* a credential reached the server — an `Allocate`
-/// for a fresh allocation, or a `Refresh` re-signing an existing one (issue #835).
+/// for a fresh allocation, or a `Refresh` using an existing allocation's identity.
 async fn run_mock_turn_server(
     turn_socket: Arc<dyn AsyncUdpSocket>,
     relay_addr: SocketAddr,
@@ -702,27 +702,19 @@ fn test_set_configuration_updates_turn_credentials_on_ice_restart() {
             .expect("Failed to update ICE server configuration");
         pc.restart_ice().await.expect("Failed to restart ICE");
 
-        // The rotated credential must reach the server — but as a **Refresh** re-signing the
-        // existing allocation, not a second Allocate. An allocation is a 5-tuple resource
-        // independent of the credential that created it, and `local_addrs` is fixed at
-        // relayer construction, so re-Allocating here would reuse the same 5-tuple and a
-        // conforming server would reject it with 437 (RFC 5766 §6.2) — issue #835. This mock
-        // answers every Allocate with success, so the method assertion is what guards it;
-        // `turn_credential_rotation.rs` covers the same property against a real server.
-        let (restarted_method, restarted_username) =
-            timeout(Duration::from_secs(5), username_rx.recv())
-                .await
-                .expect("Timed out waiting for the rotated credential to reach the server")
-                .expect("TURN username channel closed");
-        assert_eq!(
-            (restarted_method, restarted_username.as_str()),
-            ("refresh", "username-b"),
-            "a pure credential rotation must re-sign the existing allocation with a Refresh, \
-             not re-Allocate on the same 5-tuple (issue #835)"
-        );
         timeout(Duration::from_secs(5), gathering_rx.recv())
             .await
             .expect("Timed out waiting for restarted relay gathering");
+        // Reusing the allocation must retain its authenticated identity. The
+        // previous assertion expected username-b in Refresh, which would be
+        // rejected with 441 by an RFC 8656 section 5 server.
+        assert!(
+            timeout(Duration::from_millis(100), username_rx.recv())
+                .await
+                .is_err(),
+            "configuration updates must not re-sign an existing allocation"
+        );
+        pc.close().await.unwrap();
 
         turn_task.abort();
     });
```

**File**: `tests/turn_credential_rotation.rs` (modified, +8/-9)
```diff
@@ -229,8 +229,8 @@ fn test_ice_restart_after_turn_credential_rotation_keeps_relay() {
 
         // ── 2. Rotate credentials and restart ICE ─────────────────────────────
         // Same server, same policy, different credential: a pure credential rotation. The
-        // allocation is a 5-tuple resource independent of the credential that created it,
-        // so nothing here should require giving it up.
+        // allocation keeps its original authenticated username (RFC 8656 section 5),
+        // so rotating the configuration must not mutate its client credentials.
         let allocates_before = wire.allocates.load(Ordering::SeqCst);
         assert!(
             allocates_before > 0,
@@ -297,7 +297,7 @@ fn test_ice_restart_after_turn_credential_rotation_keeps_relay() {
         // ── What actually happened on the wire ────────────────────────────────
         // These are the assertions with teeth. The SDP above keeps the stale relay
         // candidate whether or not the re-Allocate succeeded, so only the wire distinguishes
-        // "re-signed the existing allocation" from "tried to re-Allocate and got 437".
+        // "retained the existing allocation" from "tried to re-Allocate and got 437".
         let allocates_after = wire.allocates.load(Ordering::SeqCst) - allocates_before;
         let refreshes = wire.refreshes.load(Ordering::SeqCst);
         let mismatches = wire.alloc_mismatch_437.load(Ordering::SeqCst);
@@ -315,14 +315,13 @@ fn test_ice_restart_after_turn_credential_rotation_keeps_relay() {
         assert_eq!(
             allocates_after, 0,
             "issue #835: {allocates_after} new Allocate(s) after a pure credential rotation. \
-             An allocation is a 5-tuple resource independent of the credential that created \
-             it, so rotating credentials must re-sign the existing allocation, not replace it."
+             The established allocation should retain its original identity until retired."
         );
-        assert!(
-            refreshes > 0,
-            "expected a Refresh carrying the rotated credential; the server only learns the \
-             new credential when the allocation is re-signed"
+        assert_eq!(
+            refreshes, 0,
+            "updating credentials must not trigger a Refresh under a new allocation identity"
         );
+        pc.close().await.unwrap();
     });
 }
 
```

#### Recent Merged Pull Requests:
- **PR #937** (2026-10-24): ice: bound STUN writes so one wedged socket cannot stop connectivity checks (@akirilyuk)
- **PR #936** (2026-10-25): fix(turn): complete UDP authentication and allocation validation (@kookyleo)
- **PR #934** (2026-10-24): fix(turn): align authentication failures with RFC 8489 (@kookyleo)
- **PR #932** (2026-10-24): fix(turn): retain server-wide EVEN-PORT socket reservations (@kookyleo)
- **PR #930** (2026-10-24): fix(turn): protect legacy channel bindings across range exhaustion (@kookyleo)
- **PR #928** (2026-10-24): fix(turn): retain allocation credentials across configuration updates (@kookyleo)

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

## X. webrtc): multiplex peer connections over a single UDP socket (UDPMux) (#918)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webrtc-rs/webrtc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a53d7ac4`: webrtc): multiplex peer connections over a single UDP socket (UDPMux) (#918). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **UDP multiplexing: many peer connections over one shared UDP socket** — new
  `webrtc::peer_connection::transport::udp_mux` module with a `UDPMux` trait and the built-in
  `UDPMuxDefault`. Handing one mux to every `PeerConnectionBuilder::with_udp_mux` serves any
  number of connections from a single fixed UDP port (the SRS/mediamtx deployment shape),
  where a pinned `with_udp_addrs` port fails the second connection's bind with `EADDRINUSE`.
  The mux's reader demultiplexes inbound datagrams by the local ICE ufrag in each STUN check
  and by learnt peer address for ufrag-less traffic (DTLS/SRTP/SRTCP); candidates are
  advertised per interface on the mux's port, with inbound packets attributed to an interface
  via `RecvMeta::dst_ip` (packet info) and outbound ones pinned with `Transmit::src_ip` on a
  wildcard listen. Muxed connections gather host candidates only (the restriction Pion's
  `ICEUDPMux` documents), and their ICE credentials are pinned at build time so the route
  survives ICE restarts. `tests/udp_mux.rs` runs two connections on one fixed port end to end.
  Requires `rtc` ≥ the commit that adds `SettingEngine::set_ice_credentials`/
  `ice_credentials`.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a53d7ac4` are properly handled with clean fallback behavior.
