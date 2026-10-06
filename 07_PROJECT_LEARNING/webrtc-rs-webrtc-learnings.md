# Forensic Learning Record (Deep Inspection): webrtc-rs/webrtc

> **Canonical Artifact**: `07_PROJECT_LEARNING/webrtc-rs-webrtc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/webrtc-rs/webrtc](https://github.com/webrtc-rs/webrtc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:23:53.562Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webrtc-rs/webrtc`
- **Description**: Async-friendly WebRTC implementation in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5159 stars

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

### Core Architecture Module: `examples/data-channels-offer-answer/data-channels-offer.rs`
```
//! Offer side of the offer/answer example.
//!
//! Run `answer` first, then `offer`.  They exchange SDP over HTTP and send
//! random messages to each other via a WebRTC data channel every 5 seconds.
//!
//! Usage:
//!   cargo run --example offer -- [--offer-address 0.0.0.0:50000] [--answer-address localhost:60000] [-d]

use std::io::Write;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use bytes::BytesMut;
use clap::Parser;
use futures::FutureExt;
use hyper::{Body, Client, Method, Request};
use signal::get_local_ip;
use webrtc::data_channel::DataChannelEvent;
use webrtc::peer_connection::{
    MediaEngine, RTCConfigurationBuilder, RTCIceGatheringState, RTCIceServer,
    RTCPeerConnectionState, Registry, register_default_interceptors,
};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::runtime::{Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, runtime, sleep};

#[derive(Parser)]
#[command(name = "offer", about = "WebRTC offer side")]
struct Cli {
    #[arg(long, default_value = "0.0.0.0:50000")]
    offer_address: String,
    #[arg(long, default_value = "localhost:60000")]
    answer_address: String,
    #[arg(short, long)]
    debug: bool,
}

#[derive(Clone)]
struct OfferHandler {
    gather_complete_tx: Sender<()>,
    done_tx: Sender<()>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for OfferHandler {
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

    let peer_connection = PeerConnectionBuilder::new()
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
        .with_handler(Arc::new(OfferHandler {
            gather_complete_tx: gather_tx,
            done_tx: done_tx.clone(),
        }))
        .with_runtime(runtime.clone())
        .with_udp_addrs(vec![format!("{}:0", get_local_ip())])
        .build()
        .await?;

    // Create the data channel
    let data_channel = peer_connection.create_data_channel("data", None).await?;

    // Event loop for the data channel: wait for open, then send every 5 s and print received messages
    runtime.spawn(Box::pin(async move {
        let mut opened = false;
        let label = match data_channel.label().await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Failed to get data channel label: {e}");
                return;
            }
        };
        let id = data_channel.id();
        let mut count = 0u32;
        let mut send_timer = Box::pin(sleep(Duration::from_secs(5)));

        loop {
            if opened {
                futures::select! {
                    event = data_channel.poll().fuse() => {
                        match event {
                            Some(DataChannelEvent::OnMessage(msg)) => {
                                let text = String::from_utf8(msg.data.to_vec()).unwrap_or_default();
                                println!("Message from DataChannel '{label}': '{text}'");
                            }
                            Some(DataChannelEvent::OnClose) | None => break,
                            _ => {}
                        }
                    }
                    _ = send_timer.as_mut().fuse() => {
                        let message = format!("offer-{count}");
                        count += 1;
                        println!("Sending '{message}'");
                        let _ = data_channel.send(BytesMut::from(message.as_bytes())).await;
                        send_timer = Box::pin(sleep(Duration::from_secs(5)));
                    }
                }
            } else {
                match data_channel.poll().await {
                    Some(DataChannelEvent::OnOpen) => {
                        println!("Data channel '{label}'-'{id}' open");
                        opened = true;
                        send_timer = Box::pin(sleep(Duration::from_secs(5)));
                    }
                    Some(DataChannelEvent::OnClose) | None => break,
                    _ => {}
                }
            }
        }

        println!("exit loop for DataChannel '{label}'-'{id}'");
    }));

    // Create offer and wait for ICE gathering to complete (non-trickle)
    let offer = peer_connection.create_offer(None).await?;

    // Sets the LocalDescription, and starts our UDP listeners
    peer_connection.set_local_description(offer).await?;

    // Block until ICE Gathering is complete, disabling trickle ICE
    // we do this because we only can exchange one signaling message
    // in a production application you should exchange ICE Candidates via OnICECandidate
    let _ = gather_rx.recv().await;

    let offer_sdp = peer_connection
        .local_description()
        .await
        .ok_or_else(|| anyhow::anyhow!("no local description"))?;

    // Start our HTTP server to receive the answer SDP
    let offer_port = cli
        .offer_address
        .split(':')
        .last()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(50000);
    let mut sdp_rx = signal::http_sdp_server(offer_port).await;
    println!("Listening on http://{}", cli.offer_address);

    // POST the offer SDP to the answer side
    let payload = serde_json::to_string(&offer_sdp)?;
    let req = Request::builder()
        .method(Method::POST)
        .uri(format!("http://{}/sdp", cli.answer_address))
        .header("content-type", "application/json; charset=utf-8")
        .body(Body::from(payload))?;
    Client::new().request(req).await?;

    // Wait for the answer SDP
    let answer_str = sdp_rx
        .recv()
        .await
        .ok_or_else(|| anyhow::anyhow!("answer channel closed"))?;
    let answer_sdp = serde_json::from_str(&answer_str)?;
    peer_connection.set_remote_description(answer_sdp).await?;

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

### Core Architecture Module: `examples/data-channels-simple/data-channels-simple.rs`
```
//! data-channels-simple is a simple datachannel demo with HTTP signaling server.
//!
//! This example demonstrates:
//! - HTTP server for WebRTC signaling
//! - Browser-based DataChannel communication
//! - ICE candidate exchange via HTTP endpoints
//! - Real-time messaging between browser and Rust server

use anyhow::Result;
use futures::FutureExt;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server, StatusCode};
use log::{error, info};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
use webrtc::peer_connection::{
    RTCConfigurationBuilder, RTCIceCandidateInit, RTCIceGatheringState, RTCIceServer,
    RTCPeerConnectionState, RTCSessionDescription,
};
use webrtc::runtime::{Runtime, Sender, channel};

#[path = "../common/mod.rs"]
mod common;
use common::{block_on, runtime, timeout};

const DEMO_HTML: &str = include_str!("demo.html");

// ── Shared state for HTTP handlers ─────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    offer_tx: Sender<(
        RTCSessionDescription,
        Sender<Result<RTCSessionDescription, String>>,
    )>,
    candidate_tx: Sender<RTCIceCandidateInit>,
}

// ── WebRTC event handler ───────────────────────────────────────────────────────

struct Handler {
    gather_complete_tx: Sender<()>,
    runtime: Arc<dyn Runtime>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for Handler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete {
            let _ = self.gather_complete_tx.try_send(());
        }
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        info!("Connection state: {}", state);
    }

    async fn on_data_channel(&self, dc: Arc<dyn DataChannel>) {
        let runtime = self.runtime.clone();
        runtime.spawn(Box::pin(async move {
            let label = dc.label().await.unwrap_or_default();
            info!("New DataChannel: '{}'", label);
            while let Some(event) = dc.poll().await {
                match event {
                    DataChannelEvent::OnOpen => {
                        info!("DataChannel '{}' open, sending greeting", label);
                        if let Err(e) = dc.send_text("Hello from Rust server!").await {
                            error!("Failed to send greeting: {}", e);
                        }
                    }
                    DataChannelEvent::OnMessage(msg) => {
                        let text = String::from_utf8_lossy(&msg.data);
                        info!("Received from '{}': {}", label, text);
                    }
                    DataChannelEvent::OnClose => {
                        info!("DataChannel '{}' closed", label);
                        break;
                    }
                    _ => {}
                }
            }
        }));
    }
}

// ── Entry point ────────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    block_on(async_main())
}

async fn async_main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let runtime = runtime();

    let (offer_tx, mut offer_rx) = channel::<(
        RTCSessionDescription,
        Sender<Result<RTCSessionDescription, String>>,
    )>(8);
    let (candidate_tx, mut candidate_rx) = channel::<RTCIceCandidateInit>(8);

    let state = Arc::new(AppState {
        offer_tx,
        candidate_tx,
    });

    // Start HTTP signaling server in background
    let addr: SocketAddr = "127.0.0.1:8080".parse()?;
    info!("Signaling server started on http://{}", addr);

    let state_clone = state.clone();
    runtime.spawn(Box::pin(async move {
        let make_svc = make_service_fn(move |_| {
            let state = state_clone.clone();
            async move {
                Ok::<_, hyper::Error>(service_fn(move |req| handle_request(req, state.clone())))
            }
        });
        let server = Server::bind(&addr).serve(make_svc);
        if let Err(e) = server.await {
            error!("HTTP server error: {}", e);
        }
    }));

    // Main loop: process offers and ICE candidates forwarded from HTTP handlers
    let mut peer_connection: Option<Arc<dyn PeerConnection>> = None;

    loop {
        futures::select! {
            msg = offer_rx.recv().fuse() => {
                let Some((offer, response_tx)) = msg else { break };
                info!("Received offer from browser");

                let (gather_tx, mut gather_rx) = channel::<()>(1);
                let handler = Arc::new(Handler {
                    gather_complete_tx: gather_tx,
                    runtime: runtime.clone(),
                });

                let config = RTCConfigurationBuilder::new()
                    .with_ice_servers(vec![RTCIceServer {
                        urls: vec!["stun:stun.l.google.com:19302".to_string()],
                        ..Default::default()
                    }])
                    .build();

                match PeerConnectionBuilder::new()
                    .with_configuration(config)
                    .with_handler(handler)
                    .with_runtime(runtime.clone())
                    .with_udp_addrs(vec!["0.0.0.0:0".to_string()])
                    .build()
                    .await
                {
                    Ok(pc) => {
                        if let Err(e) = pc.set_remote_description(offer).await {
                            response_tx.try_send(Err(e.to_string())).ok();
                            continue;
                        }
                        match pc.create_answer(None).await {
                            Ok(answer) => {
                                if let Err(e) = pc.set_local_description(answer).await {
                                    response_tx.try_send(Err(e.to_string())).ok();
                                    continue;
                                }
                                // Wait for ICE gathering to complete before returning the answer
                                let _ = timeout(Duration::from_secs(5), gather_rx.recv()).await;
                                match pc.local_description().await {
                                    Some(local_desc) => {
                                        response_tx.try_send(Ok(local_desc)).ok();
                                    }
                                    None => {
                                        response_tx
                                            .try_send(Err("No local description".to_string()))
                                            .ok();
                                        continue;
                                    }
                                }
                                let pc: Arc<dyn PeerConnection> = Arc::new(pc);
                                peer_connection = Some(pc);
                            }
                            Err(e) => {
                                response_tx.try_send(Err(e.to_string())).ok();
                            }
                        }
                    }
                    Err(e) => {
                        response_tx.try_send(Err(e.to_string())).ok();
                    }
                }
            }

            msg = candidate_rx.recv().fuse() => {
                let Some(candidate) = msg else { break };
                if let Some(pc) = peer_connection.as_ref() {
                    if let Err(e) = pc.add_ice_candidate(candidate).await {
                        error!("Failed to add ICE candidate: {}", e);
                    }
                }
            }
        }
    }

    Ok(())
}

// ── HTTP request handler ───────────────────────────────────────────────────────

async fn handle_request(
    req: Request<Body>,
    state: Arc<AppState>,
) -> Result<Response<Body>, hyper::Error> {
    match (req.method(), req.uri().path()) {
        // Serve demo HTML
        (&Method::GET, "/") => Ok(Response::builder()
            .header("Content-Type", "text/html")
            .body(Body::from(DEMO_HTML))
            .unwrap()),

        // Handle SDP offer → return answer with ICE candidates
        (&Method::POST, "/offer") => {
            let body_bytes = hyper::body::to_bytes(req.into_body()).await?;
            let body_str = String::from_utf8_lossy(&body_bytes);

            let offer: RTCSessionDescription = match serde_json::from_str(&body_str) {
                Ok(o) => o,
                Err(e) => {
                    return Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .body(Body::from(e.to_string()))
                        .unwrap());
                }
            };

            let (response_tx, mut response_rx) =
                channel::<Result<RTCSessionDescription, String>>(8);

            if state.offer_tx.try_send((offer, response_tx)).is_err() {
                return Ok(Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from("WebRTC loop not running"))
                    .unwrap());
            }

            match response_rx.recv().await {
                Some(Ok(answer)) => {
                    let json = serde_json::to_string(&answer).unwrap();
                    Ok(Response::builder()
                        .header("Content-Type", "application/json")
                        .body(Body::from(json))
                        .unwrap())
                }
                Some(Err(e)) => Ok(Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from(e))
                    .unwrap()),
                None => Ok
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

- **Issue #776** (2026-07-31): **RTCDataChannel transitions to Closed state after a single failed delivery with max_retransmits(0)**
  *Symptoms*: ### **Description** I am reporting a behavior in `webrtc-rs` that seems to violate the expected behavior of unreliable Data Channels as defined in **RFC 8831**.   When a Data Channel is configured with `ordered = false` and `max_retransmits = 0`, a single failed transmission attempt (due to transient network loss) causes the channel to transition to the `Closed` state immediately, rather than simply dropping the packet.  ### **RFC References** 1.  **[RFC 8831, Section 6.1](https://datatracker.ietf.org/doc/html/rfc8831#section-6.1):**     > *"Limiting the number of retransmissions to zero, combined with unordered delivery, provides a UDP-like service..."*          A UDP-like service should inherently tolerate packet loss. Closing the entire association due to a single dropped packet contradicts the core purpose of "Partial Reliability".  2.  **[RFC 4960 (SCTP), Section 8](https://datatracker.ietf.org/doc/html/rfc4960#section-8):**     SCTP should only fail an association after reaching `Association.Max.Retransmits` thresholds. A packet that is not retransmitted because of the **PR-SCTP** policy (as per **RFC 3758**) should be silently discarded by the sender's stack once the policy is met, without terminating the SCTP association or closing the Data Channel.  ### **Observed Behavior** In `webrtc-rs`, if I simulate a network drop (e.g., `sudo iptables -A OUTPUT -o lo -j DROP`) and call `data_channel.send()`, the channel state moves to `Closed` immediately.   * **Comparison with
  **Post-Mortem & Fix Analysis**:
  > in commit [4f518fb](https://github.com/webrtc-rs/webrtc/commit/4f518fb1eef95f389826b44bd1c1c182f71ec3d1), I added a new integration test to try to reproduce this issue, but #776 does not reproduce on current master. I built a deterministic reproduction rather than assume, and the channel stays Open.  What I checked in the code  Three places the report implicates, all fine:  - SCTP association — on_retransmission_failure handles Timer::T3RTX with an explicit comment that it does not fail the association ("T3-rtx timer will not fail by design"). Only T1-init and T1-cookie set an error, which is handshake, not data. - DCEP mapping — ordered: false + max_retransmits: Some(0) correctly produces PartialReliableRexmitUnordered with reliability parameter 0. - PR-SCTP abandonment — RFC 3758 §3.5 C2 and FORWARD-TSN generation are implemented; abandoned chunks are retired, not escalated.  And nothing in the data-channel or driver code closes a channel on a write error — the core write path only l

- **Issue #774** (2026-06-23): **Fix IPV6 ICE gather failure issue**
  *Symptoms*: [2026-02-10T00:23:39Z DEBUG webrtc::ice_gatherer] Resolved STUN server stun.l.google.com:19302 to 74.125.250.129:19302 [2026-02-10T00:23:39Z DEBUG webrtc::ice_gatherer] STUN client bound to 0.0.0.0:46260 [2026-02-10T00:23:39Z DEBUG webrtc::ice_gatherer] Resolving STUN server: stun.l.google.com:19302 [2026-02-10T00:23:39Z DEBUG webrtc::ice_gatherer] Resolved STUN server stun.l.google.com:19302 to [2001:4860:4864:5:8000::1]:19302 [2026-02-10T00:23:39Z DEBUG webrtc::ice_gatherer] STUN client bound to [::]:45307 [2026-02-10T00:23:39Z TRACE webrtc::peer_connection_driver] Sent 20 bytes to 74.125.250.129:19302 from 0.0.0.0:46260 [2026-02-10T00:23:39Z ERROR webrtc::peer_connection_driver] Failed to send to [2001:4860:4864:5:8000::1]:19302 from [::]:45307: Network is unreachable (os error 101) [2026-02-10T00:23:39Z TRACE webrtc::peer_connection_driver] Received 32 bytes from 74.125.250.129:19302 [2026-02-10T00:23:39Z ERROR webrtc::peer_connection] I/O error: the DTLS transport has not started yet test test_stun_gathering_with_google_stun has been running for over 60 seconds

- **Issue #737** (2026-03-11): **Negotiating codecs when sender supports multiple options**
  *Symptoms*: I want to send media over WHIP. My app supports multiple encoders, so I don't want to enforce a specific codec when creating a track. I want to resolve which codec to use based on the result of the codec negotiation. I would be grateful for any suggestions on how to approach it.  ##  Current scenario with webrtc-rs 0.13  - create peer connection - create audio and video transceiver - create offer, send it to WHIP endpoint, receive answer - set_local_description - set_remote_description (fails at this point) - replace both tracks with negotiated values based on `RTCRtpSendParameters` from `RTCRtpSender`  Failure scenario: For example, if the server supports only H264, but VP8 is first on our list of codecs (in MediaEngine), then set_remote_description will fail. If H264 is first on the list of codecs, it would work.  It looks like here https://github.com/webrtc-rs/webrtc/blob/master/webrtc/src/peer_connection/peer_connection_internal.rs when creating a transceiver, some codec is already assigned. My understanding is that behavior like that is expected for tracks, but not transceivers.  I'm able to make it work if, before calling set_remote_description, I call `replace_track`. However, this would require me to parse the offer and answer on my own and resolve what codec should be used. This would basically duplicate a resolution logic that is already in webrtc-rs, so I'm assuming that is not an intended approach.  ##  Current scenario with webrtc-rs 0.11  We have this scenario w
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this issue.   Do you have any existing example code or tests to reproduce this issue? If not, you may submit an example like https://github.com/webrtc-rs/webrtc/tree/master/examples/examples, so I can reproduce this issue with your example locally and fix it.
  > Hi I created example here https://github.com/wkozyra95/webrtc/blob/repro_whip_codec_negotiation/examples/examples/whip/whip.rs. It will fail if you stream it to the WHIP server that supports H264, but does not support VP8. However if you move [registering vp8](https://github.com/wkozyra95/webrtc/blob/repro_whip_codec_negotiation/examples/examples/whip/whip.rs#L24) after h264 it would work.   By default, It's connecting to `https://g.webrtc.live-video.net:4443/v2/offer` (which is a Twitch url) and you need to [provide token](https://github.com/wkozyra95/webrtc/blob/repro_whip_codec_negotiation/examples/examples/whip/whip.rs#L209) to run it. However you can switch `send_offer` with `fake_send_offer` [here](https://github.com/wkozyra95/webrtc/blob/repro_whip_codec_negotiation/examples/examples/whip/whip.rs#L66) to mock WHIP sdp exchange, or test that with any other WHIP server that does not support VP8.
  > [Add support for multi codec negotiation #741](https://github.com/webrtc-rs/webrtc/pull/741) is merged.  by default, it is enabled.   If you want to disable multi codec negotiation, you can `settingEngine.disable_media_engine_multiple_codecs(true);`

- **Issue #641** (2024-12-11): **Upgrade to 0.12.0 broke TURN**
  *Symptoms*: Hey, I just saw that an upgrade broke my turn setup. TURN no longer works after upgrading to 0.12.0. The TURN server is coturn. The coturn configuration is below.  ``` bps-capacity=400000000 external-ip=103.97.203.7 fingerprint listening-port=3478 lt-cred-mech max-bps=1000000 max-port=65535 min-port=49152 realm= relay-ip=103.97.203.7 syslog tls-listening-port=5349 total-quota=0 user=user:password ```  When turn:[domain] and the credentials user:password is used, the login attempt does not even register with coturn and it fails ErrTurnCredentials. This happens regardless of whether `no-stun` or `fingerprint` is enabled or not, or a realm is set.  This has broken connectivity in two servers so far.  Thank you.  Regards, Rishi
  **Post-Mortem & Fix Analysis**:
  > Also, can confirm that the older builds work fine. Their logins register when run with `turnserver -v`.
  > BTW additional details: none of the servers/clients have a public IP, so sometimes I _need_ TURN. They are all behind NAT. Sometimes STUN works, sometimes it doesn't, and it is expected. TURN is the only publicly available endpoint they can connect to.
  > that's weird, TURN crate doesn't have actual code changes, only upgrades dependencies crates utils and stun.   what's the command for TURN client to connect to your coturn server?

- **Issue #616** (2026-01-31): **mdns storm**
  *Symptoms*: I'm using the latest version of the `webrtc` crate to connect nodes between servers and webclients. Recently I had problems in my home network, and it turned out that my nodes running on my server using webrtc create mdns storms:  ```log 08:32:16.365924 fwpr100p0 Out IP fricklebox.fritz.box.mdns > mdns.mcast.net.mdns: 0 A (QM)? 53854a1e-1c02-4df1-932a-c3f8bad7784f.local. (60) 08:32:16.365924 fwpr100p0 Out IP fricklebox.fritz.box.mdns > mdns.mcast.net.mdns: 0 A (QM)? 53854a1e-1c02-4df1-932a-c3f8bad7784f.local. (60) 08:32:16.365926 eno4  Out IP fricklebox.fritz.box.mdns > mdns.mcast.net.mdns: 0 A (QM)? 53854a1e-1c02-4df1-932a-c3f8bad7784f.local. (60) 08:32:16.365928 eno1  Out IP fricklebox.fritz.box.mdns > mdns.mcast.net.mdns: 0 A (QM)? 53854a1e-1c02-4df1-932a-c3f8bad7784f.local. (60) 08:32:16.365928 eno4  Out IP fricklebox.fritz.box.mdns > mdns.mcast.net.mdns: 0 A (QM)? 53854a1e-1c02-4df1-932a-c3f8bad7784f.local. (60) ```  Lots and lots of them. If I correlated this correctly, it tries to find the mdns of a remote web-client, which will never be in the local network.  Is there something to do to calm down these mdns storms? I tried to look how to configure the `mdns` part in the documentation, but didn't find how to do that.  The nodes are running in a docker container - might this impact how `mdns` interacts with the network?
  **Post-Mortem & Fix Analysis**:
  > I added the following lines to the setup of the `APIBuilder` from the `/examples` directory. I'm not really sure what the consequences of it are with regard to running it on the local network. I guess it still will manage to find the nodes locally.  Also not sure if I should keep the issue open or not. Without turning off the `mdns` module, I still have the flood of messages.  ```rust         // There seems to be some trouble with mdns where it can flood the local network         // with requests - so turn it off.         let mut setting_engine = SettingEngine::default();         setting_engine.set_ice_multicast_dns_mode(MulticastDnsMode::Disabled);          // Create the API object with the MediaEngine         let api = APIBuilder::new()             .with_media_engine(m)             .with_interceptor_registry(registry)             .with_setting_engine(setting_engine)             .build(); ```
  > I see lot of mdns error messages when a peer connection is closed. It seems like the mdns connection is not stopped when the peer connection is closed. Tracking down the call from `peer_connection.stop()` leads to here:  https://github.com/webrtc-rs/webrtc/blob/fc3a0aaa0d17bfd8cacfc141a77334bc1e94c2e6/ice/src/agent/mod.rs#L342  I think this should have a `close_multicast_conn()` here somewhere.  I'm disabling mdns for now using the above method.
  > Ah, that might be it. My nodes do reconnect quite often, which might lead to having lots of mdns requests going on.  I didn't try it out yet, but here is a PR: https://github.com/webrtc-rs/webrtc/pull/636  @r-byondlabs - is that what you think should happen?

- **Issue #614** (2026-01-31): **DTLSListener gets stuck in accept when DTLS Handshake fails**
  *Symptoms*: I'm not sure if this is intentional or not but the problem is in essence that `DTLSConn::new()` has no timeout within the `accept()` function. So whenever a handshake fails for various reasons, accept will not be able to return any new connection.  ```rs     async fn accept(&self) -> UtilResult<(Arc<dyn Conn + Send + Sync>, SocketAddr)> {         let (conn, raddr) = self.parent.accept().await?;         let dtls_conn = DTLSConn::new(conn, self.config.clone(), false, None)             .await             .map_err(util::Error::from_std)?;         Ok((Arc::new(dtls_conn), raddr))     } ```  This happens for example with my laptop, which has wifi and ethernet ports. Opening a DTLSListener on this device on `0.0.0.0:4242` accepts connections via WIFI and Ethernet (two separate ips), however the Ethernet port is preferred leading to response messages being sent only via the Ethernet port.  Connecting to the WIFI IP leads to `self.parent.accept().await?` returning successfully, however the `DTLSConn::new()` call blocks indefinitely since the Handshake fails. Therefore `accept` never returns, which leaves the `DTLSListener` in a broken state.  ![image](https://github.com/user-attachments/assets/d626ee69-52e7-46e3-9878-30c5f98a2604)  the attached image illustrates the problem: 192.168.178.189 is the wifi port on the laptop and 192.168.178.172 is the ethernet port. The Client Hello is sent to the WIFI port but the Helly Verify Request is received from the ethernet p
  **Post-Mortem & Fix Analysis**:
  > Unfortunately we are facing the same problem. Sometimes connecting our NB-IoT devices via [a CoAP Library](https://github.com/Covertness/coap-rs) fails due to packet loss. Afterwards no new handshakes are possible and we are forced to restart the server.   The mentioned library uses webrtc-rs for DTLS handshakes too
  > The `DTLSListener` itself is not used anywhere in the project besides the DTLS example apparently.  @rainliu could you comment on [this](https://github.com/webrtc-rs/webrtc/blob/632f8a553e2018ce05ad5af63da1a0355cc036bc/dtls/src/listener.rs#L74C9-L74C19) line? What was the plan here? The difference to the [pion](https://github.com/pion/dtls) implementation seems to be that here the handshake is done in `DTLSConn::new()` whereas pion defers it until the first read / write request on the connection.

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

### Incident Patch 1: `7dba2537` (2026-10-03)
**Commit Message**: fix(runtime): don't block the smol executor in connect_tcp (#917)

The smol runtime's connect_tcp called the blocking
std::net::TcpStream::connect inside its async block, so a dial that
gets no answer held the executor thread for the OS connect timeout
(135 s on Linux). Connect through smol's Async<TcpStream>::connect
instead, as the tokio runtime already does.

The test dials a loopback listener whose accept queue is full and
requires a 200 ms timer to win the race. It is Linux-only because it
relies on Linux dropping SYNs for a full accept queue. socket2 is added
as a dev-dependency to set the listen backlog.

Assisted-by: claude:claude-opus-5-5
Assisted-by: chatgpt:gpt-6-pro

**File**: `Cargo.toml` (modified, +3/-0)
```diff
@@ -68,6 +68,9 @@ async-executor = "1.14.0"
 async-io = "2.6.0"
 futures-lite = "2.6.1"
 
+# For the smol `connect_tcp` test: a listen backlog, which std cannot set.
+socket2 = "0.6.5"
+
 [[example]]
 name = "custom-runtime"
 path = "examples/custom-runtime/custom-runtime.rs"
```

**File**: `src/runtime/smol.rs` (modified, +44/-5)
```diff
@@ -156,11 +156,8 @@ impl Runtime for SmolRuntime {
         remote_addr: SocketAddr,
     ) -> Pin<Box<dyn Future<Output = io::Result<Arc<dyn AsyncTcpStream>>> + Send + 'a>> {
         Box::pin(async move {
-            let std_stream = std::net::TcpStream::connect(remote_addr)?;
-            std_stream.set_nonblocking(true)?;
-            let std_stream2 = std_stream.try_clone()?;
-            let read_io = ::smol::Async::new(std_stream)?;
-            let write_io = ::smol::Async::new(std_stream2)?;
+            let read_io = ::smol::Async::<std::net::TcpStream>::connect(remote_addr).await?;
+            let write_io = ::smol::Async::new(read_io.get_ref().try_clone()?)?;
             let local_addr = read_io.get_ref().local_addr()?;
             let peer_addr = read_io.get_ref().peer_addr()?;
             Ok(Arc::new(TcpStream {
@@ -411,3 +408,45 @@ impl AsyncTcpStream for TcpStream {
         Ok(self.peer_addr)
     }
 }
+
+// Linux only: once a listener's accept queue is full, Linux drops further SYNs, which keeps
+// the next connect pending without leaving the machine. Other kernels may refuse or admit
+// that connection instead, so the fixture only works on Linux.
+#[cfg(all(test, target_os = "linux"))]
+mod tests {
+    use super::*;
+    use std::time::Duration;
+
+    /// A connect whose handshake is still in flight must yield, not block the executor.
+    #[test]
+    fn connect_tcp_does_not_block_the_executor() {
+        let listener =
+            socket2::Socket::new(socket2::Domain::IPV4, socket2::Type::STREAM, None).unwrap();
+        listener
+            .bind(&SocketAddr::from(([127, 0, 0, 1], 0)).into())
+            .unwrap();
+        listener.listen(1).unwrap();
+        let addr = listener.local_addr().unwrap().as_socket().unwrap();
+        // Fill the accept queue until a handshake stalls.
+        let mut queued = Vec::new();
+        while let Ok(stream) =
+            std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(200))
+        {
+            queued.push(stream);
+            assert!(queued.len() < 8, "accept queue never filled");
+        }
+
+        // The timer can only win if connect_tcp handed control back while still pending.
+        let dialed = ::smol::block_on(::smol::future::or(
+            async { Some(SmolRuntime.connect_tcp(addr).await.map(|_| ())) },
+            async {
+                ::smol::Timer::after(Duration::from_millis(200)).await;
+                None
+            },
+        ));
+        assert!(
+            dialed.is_none(),
+            "connect_tcp did not stay pending: {dialed:?}"
+        );
+    }
+}
```

---

### Incident Patch 2: `a72f5358` (2026-09-27)
**Commit Message**: fix: release TURN allocations on close() on both runtimes (#903) (#911)

* fix(turn): release allocations when TURN clients are retired (port of #895)

#895 landed on v0.20.x only. On master, retiring the TURN relayer's clients
dropped them without releasing their allocations, so the server kept each
one until its lifetime expired: on close(), on an ICE-restart rebind, and
on a configuration change that recreates the clients.

Port it:

- RTCTurnRelayer::remove_client takes release_allocation. When set and the
  client has a relay, Relay::close queues an authenticated Refresh with
  LIFETIME=0 (RFC 8656 §7), drained into retirement_wouts, which poll_write
  sends first and which a configuration reset does not clear. A socket
  write failure retires without releasing: the socket can no longer
  deliver it.
- The driver sends those releases on both exit paths (the closing check at
  the top of the loop and the Close event), through a small
  release_turn_allocations helper, and before an ICE-restart rebind drops
  the old sockets, since a release from a new socket would not match the
  allocation's 5-tuple.

master's rtc-turn takes the time explicitly, so Relay::close is passed the
r

**File**: `src/peer_connection/driver.rs` (modified, +86/-6)
```diff
@@ -44,8 +44,10 @@ use rtc::shared::{FourTuple, TaggedBytesMut, TransportContext, TransportProtocol
 use rtc::{rtcp, rtp};
 use std::collections::hash_map::Entry;
 use std::collections::{HashMap, VecDeque};
+use std::future::Future;
 use std::io::IoSliceMut;
 use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
+use std::pin::Pin;
 use std::sync::Arc;
 use std::sync::atomic::Ordering;
 use std::time::{Duration, Instant};
@@ -134,6 +136,67 @@ const DEFAULT_TIMEOUT_DURATION: Duration = Duration::from_secs(86400); // 1 day
 /// by elapsed time catches every shape.
 const MIN_IMMEDIATE_TIMEOUT_INTERVAL: Duration = Duration::from_millis(1);
 
+thread_local! {
+    /// The connection whose driver task this thread is polling at this moment, or `0`.
+    static POLLING_DRIVER: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
+}
+
+/// Identifies a connection for [`POLLING_DRIVER`].
+fn driver_id(inner: &Arc<PeerConnectionRef>) -> usize {
+    Arc::as_ptr(inner) as usize
+}
+
+/// Whether the caller is running inside `inner`'s own driver task.
+///
+/// Application callbacks are awaited on the driver task, so this is true for a `close()`
+/// called from one of them. Waiting there for the driver to finish can never succeed (it cannot
+/// make progress until the callback returns), and aborting it would cut off the TURN releases it
+/// sends on its way out.
+pub(crate) fn is_polling_driver(inner: &Arc<PeerConnectionRef>) -> bool {
+    POLLING_DRIVER.with(|polling| polling.get()) == driver_id(inner)
+}
+
+/// Runs a connection's driver future, recording on the polling thread for the duration of every
+/// poll which connection it belongs to, so [`is_polling_driver`] can answer from inside it.
+///
+/// Recorded per poll rather than per task because a multi-threaded runtime may poll the task on a
+/// different thread each time; everything the driver awaits, callbacks included, runs within one
+/// of those polls.
+pub(crate) struct DriverTask {
+    id: usize,
+    future: Pin<Box<dyn Future<Output = ()> + Send>>,
+}
+
+impl DriverTask {
+    pub(crate) fn new(
+        inner: &Arc<PeerConnectionRef>,
+        future: impl Future<Output = ()> + Send + 'static,
+    ) -> Self {
+        Self {
+            id: driver_id(inner),
+            future: Box::pin(future),
+        }
+    }
+}
+
+impl Future for DriverTask {
+    type Output = ();
+
+    fn poll(self: Pin<&mut Self>, cx: &mut std::task::Context<'_>) -> std::task::Poll<()> {
+        /// Restores the previous marker even if the poll panics.
+        struct Restore(usize);
+        impl Drop for Restore {
+            fn drop(&mut self) {
+                POLLING_DRIVER.with(|polling| polling.set(self.0));
+            }
+        }
+
+        let this = self.get_mut();
+        let _restore = Restore(POLLING_DRIVER.with(|polling| polling.replace(this.id)));
+        this.future.as_mut().poll(cx)
+    }
+}
+
 /// Insert `sender` for `channel_id`, returning `true` if the channel should be announced.
 pub(crate) fn insert_data_channel_event_sender(
     data_channels: &mut HashMap<RTCDataChannelId, Sender<DataChannelEvent>>,
@@ -563,6 +626,15 @@ where
     async fn bind_transports(&mut self) -> Result<()> {
         let runtime = Arc::clone(&self.inner.runtime);
 
+        // Release TURN allocations while the old UDP sockets still exist. Rebinding drops them
+        // below, and a Refresh(0) sent from a new socket would not match the allocation's
+        // 5-tuple, leaving it on the server until it expires. The initial bind has no previous
+        // generation to release.
+        if !self.udp_sockets.is_empty() {
+            self.turn_relayer.close()?;
+            self.poll_writes().await?;
+        }
+
         // Drop before binding — see above. Also drops every accepted TCP stream, which is
         // correct: they belong to the generation being replaced.
         self.udp_sockets.clear();
@@ -766,9 +838,7 @@ where
             // momentarily full channel), this check still guarantees the loop —
             // and thus a dedicated reactor thread — terminates instead of leaking.
             if self.inner.closing.load(Ordering::Acquire) {
-                if let Err(err) = self.turn_relayer.close() {
-                    error!("Failed to close turn_relayer: {}", err);
-                }
+                self.release_turn_allocations().await;
                 return Ok(());
             }
 
@@ -1689,9 +1759,7 @@ where
                 self.tcp_transport.register_stream(four_tuple, stream);
             }
             PeerConnectionDriverEvent::Close => {
-                if let Err(err) = self.turn_relayer.close() {
-                    error!("Failed to close turn_relayer: {}", err);
-                }
+                self.release_turn_allocations().await;
                 return true;
             }
         }
@@ -1848,6 +1916,18 @@ where
         messages
     }
 
+    /// Releases every TURN allocation (Refresh with LIFETIME=0) and se
```

**File**: `src/peer_connection/mod.rs` (modified, +55/-31)
```diff
@@ -68,7 +68,7 @@ use std::sync::atomic::{AtomicBool, Ordering};
 
 use driver::{
     APPLICATION_TO_DRIVER_EVENT_CHANNEL_CAPACITY, DRIVER_TO_DATA_CHANNEL_EVENT_CHANNEL_CAPACITY,
-    PeerConnectionDriver,
+    DriverTask, PeerConnectionDriver, is_polling_driver,
 };
 
 use rtc::data_channel::{RTCDataChannelId, RTCDataChannelInit};
@@ -448,9 +448,15 @@ pub trait PeerConnection: crate::sealed::Sealed + Send + Sync + 'static {
     /// Idempotent: closing an already-closed connection succeeds. Pending
     /// [`DataChannel::send`] calls blocked awaiting
     /// capacity are woken with [`Error::ErrDataChannelClosed`], and every event stream ends:
-    /// [`DataChannel::poll`], [`TrackRemote::poll`](crate::media_stream::track_remote::TrackRemote::poll)
-    /// and [`TrackLocal::poll`](crate::media_stream::track_local::TrackLocal::poll) return `None`
-    /// once the events already queued have been read.
+    /// [`DataChannel::poll`], [`TrackRemote::poll`] and [`TrackLocal::poll`] return `None` once the
+    /// events already queued have been read.
+    ///
+    /// TURN allocations are released on a best-effort basis: a Refresh with LIFETIME 0 is sent
+    /// for each one before this returns, so the server frees them now rather than when their
+    /// lifetime expires. `close()` waits at most about 100 ms for that; if the connection's
+    /// driver cannot send them in time, it is stopped anyway and the allocations expire on the
+    /// server. Called from an event-handler callback, which runs on the driver itself, it returns
+    /// without waiting and the releases are sent as soon as the callback returns.
     ///
     /// # Errors
     ///
@@ -720,15 +726,25 @@ pub trait PeerConnection: crate::sealed::Sealed + Send + Sync + 'static {
 ///
 /// Not exposed directly — obtained as an opaque `impl PeerConnection` from
 /// [`PeerConnectionBuilder::build`].
+/// How long `close()` waits for the driver to finish its exit path before aborting it.
+///
+/// The exit path is local work: queue the TURN releases and hand them to the socket, with no
+/// round trip, so it normally completes in a few milliseconds. This only caps the case of a driver
+/// that cannot get there promptly — one blocked in an application callback, say — where releasing
+/// the allocations is best effort and `close()` must not be held up for it.
+const DRIVER_STOP_TIMEOUT: Duration = Duration::from_millis(100);
+
 pub(crate) struct PeerConnectionImpl {
     inner: Arc<PeerConnectionRef>,
     driver_handle: Mutex<Option<Box<dyn JoinHandle>>>,
+    /// Ends (`recv` returns `None`) once the driver future is gone, whether it ran to completion
+    /// or was aborted: its sender lives in that future. `close()` waits on it.
+    driver_stopped: Mutex<Option<crate::runtime::Receiver<()>>>,
     /// Whether the driver runs on the shared bounded reactor pool (a task pinned to
-    /// one pool thread) rather than the general async runtime. When true, `close()`
-    /// waits for that task to finish and then aborts it, and `Drop` signals it to
-    /// stop (via [`PeerConnectionRef::closing`]) so a driver task is not left
-    /// running on a pool thread if the connection is dropped without an explicit
-    /// `close()`.
+    /// one pool thread) rather than the general async runtime. When true, `Drop`
+    /// signals it to stop (via [`PeerConnectionRef::closing`]) so a driver task is not
+    /// left running on a pool thread if the connection is dropped without an explicit
+    /// `close()`. (`close()` itself treats both runtimes alike.)
     dedicated_reactor: bool,
 }
 
@@ -1005,6 +1021,7 @@ impl PeerConnectionImpl {
                 ice_restart_rebind_pending: AtomicBool::new(false),
             }),
             driver_handle: Mutex::new(None),
+            driver_stopped: Mutex::new(None),
             dedicated_reactor: dedicated_reactor_pool_size > 0,
         };
 
@@ -1021,7 +1038,10 @@ impl PeerConnectionImpl {
         // future, build the driver, report the init outcome, then run the event
         // loop to completion.
         let inner = peer_connection.inner.clone();
+        let (driver_stopped_tx, driver_stopped_rx) = channel::<()>(1);
         let run_driver = async move {
+            // Dropped with this future, which is what `close()` waits for.
+            let _driver_stopped = driver_stopped_tx;
             let stopped_inner = Arc::clone(&inner);
             let mut driver = PeerConnectionDriver::new(
                 inner,
@@ -1050,12 +1070,14 @@ impl PeerConnectionImpl {
             stopped_inner.end_event_streams().await;
         };
 
+        let run_driver = DriverTask::new(&peer_connection.inner, run_driver);
         let driver_handle = if dedicated_reactor_pool_size > 0 {
             runtime.spawn_reactor(dedicated_reactor_pool_size, Box::pin(run_driver))
         } else {
             runtime.spawn(Box::pin(run_driver))
         };
         *peer_connection.driver_handle.lock().await = Some(dr
```

**File**: `src/peer_connection/transport/turn_relayer.rs` (modified, +30/-5)
```diff
@@ -69,6 +69,10 @@ pub(crate) struct RTCTurnRelayer {
     pending_permissions: HashMap<rtc::stun::message::TransactionId, PendingPermission>,
     pending_permission_pairs: HashMap<(SocketAddr, SocketAddr), rtc::stun::message::TransactionId>,
     pending_packets: HashMap<(SocketAddr, SocketAddr), VecDeque<TaggedBytesMut>>,
+    /// Refresh(LIFETIME=0) requests queued while retiring a TURN client. They must survive a
+    /// configuration reset (which clears `wouts`) and go out on the socket that owns the
+    /// allocation, so they are kept apart and sent first.
+    retirement_wouts: VecDeque<TaggedBytesMut>,
     wouts: VecDeque<TaggedBytesMut>,
     routs: VecDeque<TaggedBytesMut>,
     events: VecDeque<RTCTurnRelayEventOut>,
@@ -96,6 +100,7 @@ impl RTCTurnRelayer {
             pending_permissions: HashMap::new(),
             pending_permission_pairs: HashMap::new(),
             pending_packets: HashMap::new(),
+            retirement_wouts: VecDeque::new(),
             wouts: VecDeque::new(),
             routs: VecDeque::new(),
             events: VecDeque::new(),
@@ -131,7 +136,7 @@ impl RTCTurnRelayer {
 
         let keys: Vec<FourTuple> = self.clients.keys().copied().collect();
         for key in keys {
-            self.remove_client(key);
+            self.remove_client(key, true);
         }
         self.relay_addrs.clear();
         self.pending_permissions.clear();
@@ -507,8 +512,24 @@ impl RTCTurnRelayer {
         }
     }
 
-    fn remove_client(&mut self, four_tuple: FourTuple) {
+    /// Drops a TURN client. With `release_allocation`, a live allocation is released first
+    /// (RFC 8656 §7: a Refresh with LIFETIME 0) instead of being left on the server until its
+    /// lifetime expires.
+    fn remove_client(&mut self, four_tuple: FourTuple, release_allocation: bool) {
         if let Some(mut managed_client) = self.clients.remove(&four_tuple) {
+            // `Client::close` only clears transaction state; the release is `Relay::close`,
+            // which queues an authenticated Refresh(LIFETIME=0). Clear the old transactions
+            // first, then create and drain the release so the driver sends it on the socket
+            // that owns the allocation.
+            let _ = managed_client.client.close();
+            if release_allocation && let Some(relay_addr) = managed_client.relay_addr {
+                if let Ok(mut relay) = managed_client.client.relay(relay_addr) {
+                    let _ = relay.close(self.runtime.now());
+                }
+                while let Some(msg) = managed_client.client.poll_write() {
+                    self.retirement_wouts.push_back(msg);
+                }
+            }
             if let Some(relay_addr) = managed_client.relay_addr.take() {
                 self.relay_addrs.remove(&relay_addr);
                 self.pending_packets
@@ -518,7 +539,6 @@ impl RTCTurnRelayer {
                 self.pending_permission_pairs
                     .retain(|(addr, _), _| *addr != relay_addr);
             }
-            let _ = managed_client.client.close();
         }
     }
 
@@ -645,6 +665,9 @@ impl Protocol<TaggedBytesMut, TaggedBytesMut, RTCTurnRelayEventIn> for RTCTurnRe
     }
 
     fn poll_write(&mut self) -> Option<Self::Wout> {
+        if let Some(msg) = self.retirement_wouts.pop_front() {
+            return Some(msg);
+        }
         for managed_client in self.clients.values_mut() {
             while let Some(msg) = managed_client.client.poll_write() {
                 self.wouts.push_back(msg);
@@ -656,7 +679,9 @@ impl Protocol<TaggedBytesMut, TaggedBytesMut, RTCTurnRelayEventIn> for RTCTurnRe
     fn handle_event(&mut self, evt: RTCTurnRelayEventIn) -> Result<()> {
         match evt {
             RTCTurnRelayEventIn::SocketWriteFailure(four_tuple) => {
-                self.remove_client(four_tuple);
+                // The socket is already unusable, so a Refresh(0) could not be delivered; the
+                // server reclaims this allocation when its lifetime expires.
+                self.remove_client(four_tuple, false);
                 self.maybe_emit_gathering_complete();
             }
         }
@@ -795,7 +820,7 @@ impl Protocol<TaggedBytesMut, TaggedBytesMut, RTCTurnRelayEventIn> for RTCTurnRe
     fn close(&mut self) -> Result<()> {
         let keys: Vec<FourTuple> = self.clients.keys().copied().collect();
         for key in keys {
-            self.remove_client(key);
+            self.remove_client(key, true);
         }
         Ok(())
     }
```

**File**: `tests/turn_release_on_close.rs` (added, +426/-0)
```diff
@@ -0,0 +1,426 @@
+//! Regression test for webrtc#903: `close()` must release the connection's TURN allocations.
+//!
+//! A TURN allocation is released with a Refresh carrying LIFETIME=0 (RFC 8656 §7). The driver
+//! sends those releases on its way out, but on the general runtime `close()` used to abort the
+//! driver without waiting, so whether the releases went out was a race — and on master they were
+//! never queued at all (webrtc#895 had landed on v0.20.x only). The server kept the allocations
+//! until their lifetime expired.
+//!
+//! The same release is owed when an ICE restart rebinds the sockets: the old allocation belongs to
+//! a socket that is about to be dropped, and a release sent from its replacement would not match
+//! the allocation's 5-tuple.
+//!
+//! A mock TURN server counts the releases it receives. Each close case is repeated because the
+//! old failure was a race.
+use std::net::{IpAddr, Ipv4Addr, SocketAddr};
+use std::sync::Arc;
+use std::sync::atomic::{AtomicUsize, Ordering};
+use std::time::{Duration, Instant};
+
+use rtc::peer_connection::configuration::setting_engine::SettingEngineBuilder;
+use rtc::stun::attributes::{ATTR_NONCE, ATTR_REALM};
+use rtc::stun::error_code::CODE_UNAUTHORIZED;
+use rtc::stun::message::{
+    CLASS_ERROR_RESPONSE, CLASS_SUCCESS_RESPONSE, Getter, METHOD_ALLOCATE,
+    METHOD_CREATE_PERMISSION, METHOD_REFRESH, Message as StunMessage, MessageType,
+};
+use rtc::stun::textattrs::{Nonce, Realm};
+use rtc::turn::proto::lifetime::Lifetime;
+use rtc::turn::proto::relayaddr::RelayedAddress;
+use webrtc::peer_connection::{
+    MediaEngine, PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler,
+    RTCConfigurationBuilder, RTCIceGatheringState, RTCIceServer, RTCIceTransportPolicy,
+};
+use webrtc::runtime::{AsyncUdpSocket, Mutex, Receiver, Sender, channel};
+
+mod common;
+use common::{block_on, runtime, sleep, timeout};
+
+/// Each case is repeated this many times: the old failure was a race on the general runtime.
+const RUNS: usize = 5;
+
+/// How long after `close()` returns the release may take to reach the mock server.
+const RELEASE_TIMEOUT: Duration = Duration::from_secs(2);
+
+/// What the mock TURN server has seen.
+#[derive(Default)]
+struct Counts {
+    allocations: AtomicUsize,
+    releases: AtomicUsize,
+}
+
+/// A TURN server that grants every authenticated Allocate and counts Refresh(LIFETIME=0).
+async fn run_mock_turn_server(
+    socket: Arc<dyn AsyncUdpSocket>,
+    relay_addr: SocketAddr,
+    counts: Arc<Counts>,
+) {
+    let mut buf = vec![0u8; 2048];
+    loop {
+        let Ok((n, peer_addr)) = socket.recv_from(&mut buf).await else {
+            break;
+        };
+        let mut msg = StunMessage::new();
+        msg.raw = buf[..n].to_vec();
+        if msg.decode().is_err() {
+            continue;
+        }
+
+        let mut response = StunMessage::new();
+        let built = match msg.typ.method {
+            METHOD_ALLOCATE if msg.get(ATTR_NONCE).is_err() => response.build(&[
+                Box::new(msg.transaction_id),
+                Box::new(MessageType::new(METHOD_ALLOCATE, CLASS_ERROR_RESPONSE)),
+                Box::new(CODE_UNAUTHORIZED),
+                Box::new(Realm::new(ATTR_REALM, "webrtc.rs".to_owned())),
+                Box::new(Nonce::new(ATTR_NONCE, "nonce".to_owned())),
+            ]),
+            METHOD_ALLOCATE => {
+                counts.allocations.fetch_add(1, Ordering::SeqCst);
+                response.build(&[
+                    Box::new(msg.transaction_id),
+                    Box::new(MessageType::new(METHOD_ALLOCATE, CLASS_SUCCESS_RESPONSE)),
+                    Box::new(RelayedAddress {
+                        ip: relay_addr.ip(),
+                        port: relay_addr.port(),
+                    }),
+                    Box::new(Lifetime(Duration::from_secs(600))),
+                ])
+            }
+            METHOD_REFRESH => {
+                let mut lifetime = Lifetime::default();
+                let release = lifetime.get_from(&msg).is_ok() && lifetime.0.is_zero();
+                if release {
+                    counts.releases.fetch_add(1, Ordering::SeqCst);
+                }
+                response.build(&[
+                    Box::new(msg.transaction_id),
+                    Box::new(MessageType::new(METHOD_REFRESH, CLASS_SUCCESS_RESPONSE)),
+                    Box::new(Lifetime(if release {
+                        Duration::ZERO
+                    } else {
+                        Duration::from_secs(600)
+                    })),
+                ])
+            }
+            METHOD_CREATE_PERMISSION => response.build(&[
+                Box::new(msg.transaction_id),
+                Box::new(MessageType::new(
+                    METHOD_CREATE_PERMISSION,
+                    CLASS_SUCCESS_RESPONSE,
+                )),
+            ]),
+            _ => continue,
+        };
+        if built.is_err() {
+            continue;
```

---

### Incident Patch 3: `c0bc204a` (2026-09-26)
**Commit Message**: fix(stun_gatherer): complete gathering when a STUN server does not answer (#910)

Each STUN client sends a single Binding request, but poll_event retired a
client only when its response produced a server-reflexive candidate. Every
other outcome kept it in stun_clients:

- a timed-out request (the `_` arm logged "STUN error: TransactionTimeOut"
  at error! and moved on);
- a response without a usable XOR-MAPPED-ADDRESS, or one whose candidate
  could not be built (those paths `continue`d).

StunGatheringComplete is only sent once stun_clients is empty, so one local
address that cannot reach one STUN server (a VPN or cellular interface,
say) left the gatherer in Gathering for good with nothing scheduled to
move it. The driver's finish_gathering_if_ready waits for both STUN and
TURN completion, so the end-of-candidates marker was never added and ICE
gathering never reached Complete; an application waiting for gathering to
finish before sending its SDP hung. It repeated on every ICE restart. The
TURN relayer already treats its transaction timeout as finished.

Treat every event as the end of that client's transaction and retire it,
so the existing emptiness check sends StunGatheringCom

**File**: `src/peer_connection/transport/stun_gatherer.rs` (modified, +272/-42)
```diff
@@ -239,6 +239,48 @@ impl RTCStunGatherer {
         Ok(())
     }
 
+    /// The server-reflexive candidate a Binding response reports, or `None` if the response
+    /// cannot yield one. Either way the transaction is over.
+    fn server_reflexive_candidate(
+        msg: &StunMessage,
+        four_tuple: FourTuple,
+    ) -> Option<RTCIceCandidateInit> {
+        let mut xor_addr = XorMappedAddress::default();
+        if let Err(err) = xor_addr.get_from(msg) {
+            warn!(
+                "STUN response from {} to {} has no usable XOR-MAPPED-ADDRESS: {}",
+                four_tuple.peer_addr, four_tuple.local_addr, err
+            );
+            return None;
+        }
+        let config = CandidateServerReflexiveConfig {
+            base_config: CandidateConfig {
+                network: "udp".to_owned(),
+                address: xor_addr.ip.to_string(),
+                port: xor_addr.port,
+                component: 1,
+                ..Default::default()
+            },
+            rel_addr: four_tuple.local_addr.ip().to_string(),
+            rel_port: four_tuple.local_addr.port(),
+            ..Default::default()
+        };
+        let candidate = match config.new_candidate_server_reflexive() {
+            Ok(candidate) => candidate,
+            Err(err) => {
+                error!("Failed to new_candidate_server_reflexive: {}", err);
+                return None;
+            }
+        };
+        match RTCIceCandidate::from(&candidate).to_json() {
+            Ok(candidate_init) => Some(candidate_init),
+            Err(err) => {
+                error!("Failed to RTCIceCandidate to json: {}", err);
+                None
+            }
+        }
+    }
+
     /// Gather a single srflx candidate, skipping servers without a matching address family.
     fn gather_from_stun_server(
         runtime: &dyn Runtime,
@@ -335,59 +377,52 @@ impl Protocol<TaggedBytesMut, (), RTCStunGatherEventIn> for RTCStunGatherer {
     }
 
     fn poll_event(&mut self) -> Option<Self::Eout> {
-        let mut four_tuples = HashSet::new();
+        // Each client sends a single Binding request, so any event ends it: a response, usable
+        // or not, a timeout, or a stop. Every such client is retired below, which is what lets
+        // gathering complete. Retiring only the ones that produced a candidate left a client
+        // whose server never answered in the map for good, so `StunGatheringComplete` never
+        // fired and ICE gathering never finished (webrtc#904).
+        let mut finished = HashSet::new();
         for stun_client in self.stun_clients.values_mut() {
+            let four_tuple = FourTuple {
+                local_addr: stun_client.local_addr(),
+                peer_addr: stun_client.peer_addr(),
+            };
             while let Some(event) = stun_client.poll_event() {
+                finished.insert(four_tuple);
                 match event {
                     StunEvent::Message(msg) => {
-                        let mut xor_addr = XorMappedAddress::default();
-                        if let Err(err) = xor_addr.get_from(&msg) {
-                            error!("Failed to get xor mapped message: {}", err);
-                            continue;
+                        if let Some(candidate_init) =
+                            RTCStunGatherer::server_reflexive_candidate(&msg, four_tuple)
+                        {
+                            self.events
+                                .push_back(RTCStunGatherEventOut::LocalIceCandidate(
+                                    candidate_init,
+                                ));
                         }
-                        let config = CandidateServerReflexiveConfig {
-                            base_config: CandidateConfig {
-                                network: "udp".to_owned(),
-                                address: xor_addr.ip.to_string(),
-                                port: xor_addr.port,
-                                component: 1,
-                                ..Default::default()
-                            },
-                            rel_addr: stun_client.local_addr().ip().to_string(),
-                            rel_port: stun_client.local_addr().port(),
-                            ..Default::default()
-                        };
-                        let candidate = match config.new_candidate_server_reflexive() {
-                            Ok(candidate) => candidate,
-                            Err(err) => {
-                                error!("Failed to new_candidate_server_reflexive: {}", err);
-                                continue;
-                            }
-                        };
-
-                        let candidate_init = match RTCIceCandidate::from(&candidate).to_json() {
-                            Ok(candidate_init) => candidate_init,
-                            Err(err) => {
-                                error!("Faile
```

---

### Incident Patch 4: `64b6eeeb` (2026-09-26)
**Commit Message**: fix(rtp_transceiver): break the PeerConnectionRef reference cycle (#906) (#909)

* fix(rtp_transceiver): break the PeerConnectionRef reference cycle (#906)

PeerConnectionRef.rtp_transceivers owns every RtpTransceiverImpl, and each
transceiver owns its RtpSenderImpl and RtpReceiverImpl. All three held a
strong Arc<PeerConnectionRef> back, and neither close() nor Drop empties
the map, so a single add_track() kept the whole connection alive after
close() and drop: the event handler, the sans-I/O core with its buffers,
the runtime handle and every event channel.

Hold the back-reference as Weak in all three. Making only the transceiver's
Weak is not enough: the sender and receiver are owned by the transceiver,
so either one still closes the cycle.

Access goes through a peer_connection() helper that upgrades the Weak and
returns ErrConnectionClosed once the connection is gone. Every public
method already returns Result. set_sender returns early instead; it is only
called by the connection's own methods, which keep the connection alive.
All three types are pub(crate) and their constructors keep their
signatures, so the public API is unchanged. A sender, receiver or
transceiver the appl

**File**: `src/peer_connection/driver.rs` (modified, +19/-8)
```diff
@@ -1259,7 +1259,13 @@ where
 
                         let should_announce = {
                             let mut data_channels = self.inner.data_channel_events_tx.lock().await;
-                            insert_data_channel_event_sender(&mut data_channels, channel_id, evt_tx)
+                            // Checked under the map's lock; see `end_event_streams`.
+                            !self.inner.is_closing()
+                                && insert_data_channel_event_sender(
+                                    &mut data_channels,
+                                    channel_id,
+                                    evt_tx,
+                                )
                         };
 
                         if should_announce {
@@ -1383,13 +1389,18 @@ where
                                 rtp_transceiver.set_receiver(Some(receiver)).await;
                             }
 
-                            self.inner
-                                .track_remote_events_tx
-                                .lock()
-                                .await
-                                .insert(track_id.clone(), (evt_tx, Arc::clone(&track_remote)));
-
-                            pending_on_track = Some(track_remote);
+                            {
+                                let mut track_remotes =
+                                    self.inner.track_remote_events_tx.lock().await;
+                                // Checked under the map's lock; see `end_event_streams`.
+                                if !self.inner.is_closing() {
+                                    track_remotes.insert(
+                                        track_id.clone(),
+                                        (evt_tx, Arc::clone(&track_remote)),
+                                    );
+                                    pending_on_track = Some(track_remote);
+                                }
+                            }
                         }
                     }
                 }
```

**File**: `src/peer_connection/mod.rs` (modified, +48/-7)
```diff
@@ -447,11 +447,15 @@ pub trait PeerConnection: crate::sealed::Sealed + Send + Sync + 'static {
     ///
     /// Idempotent: closing an already-closed connection succeeds. Pending
     /// [`DataChannel::send`] calls blocked awaiting
-    /// capacity are woken with [`Error::ErrDataChannelClosed`].
+    /// capacity are woken with [`Error::ErrDataChannelClosed`], and every event stream ends:
+    /// [`DataChannel::poll`], [`TrackRemote::poll`](crate::media_stream::track_remote::TrackRemote::poll)
+    /// and [`TrackLocal::poll`](crate::media_stream::track_local::TrackLocal::poll) return `None`
+    /// once the events already queued have been read.
     ///
     /// # Errors
     ///
-    /// Returns an error if the driver could not be reached to perform the shutdown.
+    /// Returns an error if the underlying `rtc` peer connection fails to close. Failing to reach
+    /// the driver is not an error: `close()` stops it either way.
     ///
     /// # Specification
     ///
@@ -889,6 +893,28 @@ fn will_restart_ice(core: &RTCPeerConnection, desc: &RTCSessionDescription) -> b
 const WRITE_YIELD_INTERVAL: usize = 128;
 
 impl PeerConnectionRef {
+    /// Whether `close()`, `Drop` or a driver exit has begun shutting the connection down.
+    #[inline]
+    pub(crate) fn is_closing(&self) -> bool {
+        self.closing.load(Ordering::Acquire)
+    }
+
+    /// Ends every application-facing event stream, so a [`DataChannel::poll`],
+    /// [`TrackRemote::poll`](crate::media_stream::track_remote::TrackRemote::poll) or
+    /// [`TrackLocal::poll`](crate::media_stream::track_local::TrackLocal::poll) blocked on one
+    /// returns `None` once the events already queued have been read, instead of waiting forever
+    /// for events a stopped driver will never deliver.
+    ///
+    /// Call only after `closing` is set. Every sender is inserted under its map's lock after
+    /// checking [`is_closing`](Self::is_closing), so once this has run no new sender can
+    /// appear: an insert that took the lock first is cleared here, and one that takes it later
+    /// sees `closing` and skips.
+    pub(crate) async fn end_event_streams(&self) {
+        self.data_channel_events_tx.lock().await.clear();
+        self.track_remote_events_tx.lock().await.clear();
+        self.track_local_events_tx.lock().await.clear();
+    }
+
     /// Marks that the next gathering pass must rebind the UDP sockets.
     ///
     /// A no-op unless the application asked for it through
@@ -996,6 +1022,7 @@ impl PeerConnectionImpl {
         // loop to completion.
         let inner = peer_connection.inner.clone();
         let run_driver = async move {
+            let stopped_inner = Arc::clone(&inner);
             let mut driver = PeerConnectionDriver::new(
                 inner,
                 udp_addrs,
@@ -1016,6 +1043,11 @@ impl PeerConnectionImpl {
             // send() cannot hang waiting for a drain that will never come — the driver no
             // longer drains outstanding_bytes. Idempotent when close()/Drop already set it.
             driver.signal_stopped();
+            // No more events will be delivered, so end every stream an application task may be
+            // blocked on. This covers the stops that do not go through `close()`: `Drop` on a
+            // dedicated reactor, and an abnormal driver exit.
+            drop(driver);
+            stopped_inner.end_event_streams().await;
         };
 
         let driver_handle = if dedicated_reactor_pool_size > 0 {
@@ -1125,6 +1157,10 @@ impl PeerConnection for PeerConnectionImpl {
             }
         }
 
+        // The driver will deliver no more events, so end every stream an application task may
+        // be blocked on. `closing` is already set above, which `end_event_streams` requires.
+        self.inner.end_event_streams().await;
+
         Ok(())
     }
 
@@ -1309,7 +1345,10 @@ impl PeerConnection for PeerConnectionImpl {
         let (evt_tx, evt_rx) = channel(DRIVER_TO_DATA_CHANNEL_EVENT_CHANNEL_CAPACITY);
         {
             let mut data_channels = self.inner.data_channel_events_tx.lock().await;
-            data_channels.insert(channel_id, evt_tx);
+            // Racing a `close()` that has already ended the streams: leave this one ended too.
+            if !self.inner.is_closing() {
+                data_channels.insert(channel_id, evt_tx);
+            }
         }
 
         self.inner.wake_writes().await;
@@ -1391,7 +1430,9 @@ impl PeerConnection for PeerConnectionImpl {
             Arc::clone(&self.inner),
             track,
         ));
-        rtp_transceiver.set_sender(Some(Arc::clone(&sender))).await;
+        rtp_transceiver
+            .set_sender(Some(Arc::clone(&sender)))
+            .await?;
 
         Ok(sender)
     }
@@ -1407,7 +1448,7 @@ impl PeerConnection for PeerConnectionImpl {
         let rtp_transceiver = rtp_transceivers
             .get(&sender.id().into())
             .ok_or(Error::ErrRTPTransceiverNotExi
```

**File**: `src/rtp_transceiver/mod.rs` (modified, +246/-30)
```diff
@@ -21,7 +21,7 @@
 //!
 //! ```no_run
 //! # use webrtc::rtp_transceiver::{RtpTransceiver, RTCRtpTransceiverDirection};
-//! # use std::sync::Arc;
+//! # use std::sync::{Arc, Weak};
 //! # async fn configure_transceiver(transceiver: Arc<dyn RtpTransceiver>) -> webrtc::error::Result<()> {
 //! // Set preferred direction to receive only
 //! transceiver.set_direction(RTCRtpTransceiverDirection::Recvonly).await?;
@@ -59,7 +59,7 @@ pub use rtc::rtp_transceiver::{
 };
 use rtc::shared::error::Result;
 use rtc::statistics::report::RTCStatsReport;
-use std::sync::Arc;
+use std::sync::{Arc, Weak};
 use std::time::Instant;
 
 /// An RTP Receiver that receives media from a remote peer.
@@ -212,62 +212,83 @@ pub(crate) struct RtpTransceiverImpl {
     id: RTCRtpTransceiverId,
 
     /// Inner PeerConnection Reference
-    inner: Arc<PeerConnectionRef>,
+    inner: Weak<PeerConnectionRef>,
 
     sender: Mutex<Option<Arc<dyn RtpSender>>>,
     receiver: Mutex<Option<Arc<dyn RtpReceiver>>>,
 }
 
 impl RtpTransceiverImpl {
+    /// The owning connection, or `ErrConnectionClosed` once it is gone. The back-reference is
+    /// `Weak` because `PeerConnectionRef` owns this object: a strong one would form a cycle that
+    /// keeps the whole connection alive after `close()` and drop (webrtc#906).
+    fn peer_connection(&self) -> Result<Arc<PeerConnectionRef>> {
+        self.inner.upgrade().ok_or(Error::ErrConnectionClosed)
+    }
     /// Create a new rtp transceiver wrapper
     pub(crate) fn new(id: RTCRtpTransceiverId, inner: Arc<PeerConnectionRef>) -> Self {
         Self {
             id,
-            inner,
+            inner: Arc::downgrade(&inner),
             sender: Mutex::new(None),
             receiver: Mutex::new(None),
         }
     }
 
-    pub(crate) async fn set_sender(&self, rtp_sender: Option<Arc<dyn RtpSender>>) {
+    /// Replace this transceiver's sender, wiring the new sender's track to the driver.
+    ///
+    /// # Errors
+    ///
+    /// - [`Error::ErrConnectionClosed`] once the owning connection is gone.
+    /// - Whatever the new sender's `get_parameters` fails with. Nothing changes in that case:
+    ///   the parameters are resolved before the current sender is unbound, so the transceiver
+    ///   keeps the sender it had rather than being left with none.
+    pub(crate) async fn set_sender(&self, rtp_sender: Option<Arc<dyn RtpSender>>) -> Result<()> {
+        let pc = self.peer_connection()?;
+        let rtp_sender = match rtp_sender {
+            Some(rtp_sender) => {
+                let params = rtp_sender.get_parameters().await?;
+                Some((rtp_sender, params))
+            }
+            None => None,
+        };
+
         let mut sender = self.sender.lock().await;
 
-        if let Some(rtp_sender) = sender.take() {
-            let track_id = rtp_sender.track().track_id().await;
-            self.inner
-                .track_local_events_tx
-                .lock()
-                .await
-                .remove(&track_id);
-            rtp_sender.track().unbind().await;
+        if let Some(old_sender) = sender.take() {
+            let track_id = old_sender.track().track_id().await;
+            pc.track_local_events_tx.lock().await.remove(&track_id);
+            old_sender.track().unbind().await;
         }
 
-        if let Some(rtp_sender) = rtp_sender
-            && let Ok(params) = rtp_sender.get_parameters().await
-        {
+        if let Some((rtp_sender, params)) = rtp_sender {
             // Wire an event channel so RTCP feedback the remote sends about this track
             // (Receiver Reports, PLI/FIR) can be read via `TrackLocal::poll`. The driver
             // routes inbound RTCP tagged with this track id to `evt_tx`.
             let track_id = rtp_sender.track().track_id().await;
             let (evt_tx, evt_rx) = channel(DRIVER_TO_TRACK_LOCAL_EVENT_CHANNEL_CAPACITY);
-            self.inner
-                .track_local_events_tx
-                .lock()
-                .await
-                .insert(track_id, evt_tx);
+            {
+                let mut track_locals = pc.track_local_events_tx.lock().await;
+                // Checked under the map's lock; see `PeerConnectionRef::end_event_streams`.
+                if !pc.is_closing() {
+                    track_locals.insert(track_id, evt_tx);
+                }
+            }
             rtp_sender
                 .track()
                 .bind(
                     TrackLocalContext {
                         rtp_sender_id: self.id.into(),
                         rtp_parameters: params.rtp_parameters,
-                        driver_event_tx: self.inner.driver_event_tx.clone(),
+                        driver_event_tx: pc.driver_event_tx.clone(),
                     },
                     evt_rx,
                 )
                 .await;
             *sender = Some(rtp_sender);
         }
+
+        Ok(())
     }
 
     pub(crate) async fn set_receiver(&self, rt
```

**File**: `src/rtp_transceiver/rtp_receiver.rs` (modified, +27/-10)
```diff
@@ -8,7 +8,7 @@ use rtc::rtp_transceiver::rtp_receiver::{RTCRtpContributingSource, RTCRtpSynchro
 use rtc::rtp_transceiver::rtp_sender::{RTCRtpCapabilities, RTCRtpReceiveParameters, RtpCodecKind};
 use rtc::statistics::StatsSelector;
 use rtc::statistics::report::RTCStatsReport;
-use std::sync::Arc;
+use std::sync::{Arc, Weak};
 use std::time::Instant;
 
 /// Concrete async rtp receiver implementation (generic over interceptor type).
@@ -19,19 +19,30 @@ pub(crate) struct RtpReceiverImpl {
     id: RTCRtpReceiverId,
 
     /// Inner PeerConnection Reference
-    inner: Arc<PeerConnectionRef>,
+    inner: Weak<PeerConnectionRef>,
 
     track: Arc<dyn TrackRemote>,
 }
 
 impl RtpReceiverImpl {
+    /// The owning connection, or `ErrConnectionClosed` once it is gone. The back-reference is
+    /// `Weak` because `PeerConnectionRef` owns this object: a strong one would form a cycle that
+    /// keeps the whole connection alive after `close()` and drop (webrtc#906).
+    fn peer_connection(&self) -> Result<Arc<PeerConnectionRef>> {
+        self.inner.upgrade().ok_or(Error::ErrConnectionClosed)
+    }
+
     /// Create a new rtp receiver wrapper
     pub(crate) fn new(
         id: RTCRtpReceiverId,
         inner: Arc<PeerConnectionRef>,
         track: Arc<dyn TrackRemote>,
     ) -> Self {
-        Self { id, inner, track }
+        Self {
+            id,
+            inner: Arc::downgrade(&inner),
+            track,
+        }
     }
 }
 
@@ -48,7 +59,8 @@ impl RtpReceiver for RtpReceiverImpl {
     }
 
     async fn get_capabilities(&self, kind: RtpCodecKind) -> Result<Option<RTCRtpCapabilities>> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         Ok(peer_connection
             .rtp_receiver(self.id)
@@ -57,7 +69,8 @@ impl RtpReceiver for RtpReceiverImpl {
     }
 
     async fn get_parameters(&self) -> Result<RTCRtpReceiveParameters> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         Ok(peer_connection
             .rtp_receiver(self.id)
@@ -67,7 +80,8 @@ impl RtpReceiver for RtpReceiverImpl {
     }
 
     async fn get_contributing_sources(&self) -> Result<Vec<RTCRtpContributingSource>> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         Ok(peer_connection
             .rtp_receiver(self.id)
@@ -78,7 +92,8 @@ impl RtpReceiver for RtpReceiverImpl {
     }
 
     async fn get_synchronization_sources(&self) -> Result<Vec<RTCRtpSynchronizationSource>> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         Ok(peer_connection
             .rtp_receiver(self.id)
@@ -89,14 +104,16 @@ impl RtpReceiver for RtpReceiverImpl {
     }
 
     async fn get_stats(&self, now: Instant) -> Result<RTCStatsReport> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
         peer_connection
             .rtp_receiver(self.id)
             .ok_or(Error::ErrRTPReceiverNotExisted)?;
         Ok(peer_connection.get_stats(now, StatsSelector::Receiver(self.id)))
     }
     async fn transport(&self) -> Result<Option<Arc<dyn DtlsTransport>>> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         // Walk under the lock and keep only the ids: a borrowed view cannot cross an await, so
         // the handle re-walks per call and carries the ids so `id()` can stay synchronous.
@@ -113,7 +130,7 @@ impl RtpReceiver for RtpReceiverImpl {
                 id,
                 ice_id,
                 DtlsRoute::Receiver(self.id),
-                Arc::clone(&self.inner),
+                Arc::clone(&pc),
             )) as Arc<dyn DtlsTransport>
         }))
     }
```

**File**: `src/rtp_transceiver/rtp_sender.rs` (modified, +29/-11)
```diff
@@ -10,7 +10,7 @@ use rtc::rtp_transceiver::rtp_sender::{
 };
 use rtc::statistics::StatsSelector;
 use rtc::statistics::report::RTCStatsReport;
-use std::sync::Arc;
+use std::sync::{Arc, Weak};
 use std::time::Instant;
 
 /// Concrete async rtp sender implementation (generic over interceptor type).
@@ -21,19 +21,30 @@ pub(crate) struct RtpSenderImpl {
     id: RTCRtpSenderId,
 
     /// Inner PeerConnection Reference
-    inner: Arc<PeerConnectionRef>,
+    inner: Weak<PeerConnectionRef>,
 
     track: Arc<dyn TrackLocal>,
 }
 
 impl RtpSenderImpl {
+    /// The owning connection, or `ErrConnectionClosed` once it is gone. The back-reference is
+    /// `Weak` because `PeerConnectionRef` owns this object: a strong one would form a cycle that
+    /// keeps the whole connection alive after `close()` and drop (webrtc#906).
+    fn peer_connection(&self) -> Result<Arc<PeerConnectionRef>> {
+        self.inner.upgrade().ok_or(Error::ErrConnectionClosed)
+    }
+
     /// Create a new rtp sender wrapper
     pub(crate) fn new(
         id: RTCRtpSenderId,
         inner: Arc<PeerConnectionRef>,
         track: Arc<dyn TrackLocal>,
     ) -> Self {
-        Self { id, inner, track }
+        Self {
+            id,
+            inner: Arc::downgrade(&inner),
+            track,
+        }
     }
 }
 
@@ -50,7 +61,8 @@ impl RtpSender for RtpSenderImpl {
     }
 
     async fn get_capabilities(&self, kind: RtpCodecKind) -> Result<Option<RTCRtpCapabilities>> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         Ok(peer_connection
             .rtp_sender(self.id)
@@ -63,7 +75,8 @@ impl RtpSender for RtpSenderImpl {
         parameters: RTCRtpSendParameters,
         set_parameter_options: Option<RTCSetParameterOptions>,
     ) -> Result<()> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         peer_connection
             .rtp_sender(self.id)
@@ -72,7 +85,8 @@ impl RtpSender for RtpSenderImpl {
     }
 
     async fn get_parameters(&self) -> Result<RTCRtpSendParameters> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         Ok(peer_connection
             .rtp_sender(self.id)
@@ -82,7 +96,8 @@ impl RtpSender for RtpSenderImpl {
     }
 
     async fn replace_track(&self, track: Arc<dyn TrackLocal>) -> Result<()> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         peer_connection
             .rtp_sender(self.id)
@@ -91,7 +106,8 @@ impl RtpSender for RtpSenderImpl {
     }
 
     async fn set_streams(&self, streams: Vec<MediaStreamId>) -> Result<()> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         peer_connection
             .rtp_sender(self.id)
@@ -101,14 +117,16 @@ impl RtpSender for RtpSenderImpl {
     }
 
     async fn get_stats(&self, now: Instant) -> Result<RTCStatsReport> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
         peer_connection
             .rtp_sender(self.id)
             .ok_or(Error::ErrRTPSenderNotExisted)?;
         Ok(peer_connection.get_stats(now, StatsSelector::Sender(self.id)))
     }
     async fn transport(&self) -> Result<Option<Arc<dyn DtlsTransport>>> {
-        let mut peer_connection = self.inner.core.lock().await;
+        let pc = self.peer_connection()?;
+        let mut peer_connection = pc.core.lock().await;
 
         // Walk under the lock and keep only the ids: a borrowed view cannot cross an await, so
         // the handle re-walks per call and carries the ids so `id()` can stay synchronous.
@@ -125,7 +143,7 @@ impl RtpSender for RtpSenderImpl {
                 id,
                 ice_id,
                 DtlsRoute::Sender(self.id),
-                Arc::clone(&self.inner),
+                Arc::clone(&pc),
             )) as Arc<dyn DtlsTransport>
         }))
     }
```

**File**: `tests/close_ends_event_streams.rs` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+//! Closing a connection must end every application-facing event stream.
+//!
+//! `DataChannel::poll`, `TrackRemote::poll` and `TrackLocal::poll` each wait on a channel whose
+//! sender the connection keeps. `close()` stopped the driver without ever ending those channels:
+//! the driver exits at the top of its loop before delivering another event, and the senders stayed
+//! in the connection — which a `DataChannel` handle itself keeps alive — so a task blocked in
+//! `poll()` never woke, even after the application dropped the connection.
+//!
+//! The documented contract is that `poll()` returns `None` once the channel or connection is
+//! closed; these tests hold `close()` (and a driver stopped by `Drop`) to it.
+use std::sync::Arc;
+use std::time::Duration;
+
+use rtc::media_stream::MediaStreamTrack;
+use rtc::peer_connection::configuration::media_engine::MediaEngine;
+use rtc::rtp_transceiver::rtp_sender::{
+    RTCRtpCodec, RTCRtpCodingParameters, RTCRtpEncodingParameters, RtpCodecKind,
+};
+use webrtc::data_channel::DataChannel;
+use webrtc::media_stream::track_local::TrackLocal;
+use webrtc::media_stream::track_local::static_rtp::TrackLocalStaticRTP;
+use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
+
+mod common;
+use common::{block_on, timeout};
+
+/// How long a stream may take to end once the connection is closed.
+const STREAM_END_TIMEOUT: Duration = Duration::from_secs(2);
+
+struct NoopHandler;
+
+#[async_trait::async_trait]
+impl PeerConnectionEventHandler for NoopHandler {}
+
+async fn build(dedicated_reactor: bool) -> impl PeerConnection {
+    let mut media_engine = MediaEngine::default();
+    media_engine
+        .register_default_codecs()
+        .expect("register default codecs");
+    let mut builder = PeerConnectionBuilder::new()
+        .with_media_engine(media_engine)
+        .with_handler(Arc::new(NoopHandler))
+        .with_udp_addrs(vec!["127.0.0.1:0".to_string()]);
+    if dedicated_reactor {
+        builder = builder.with_dedicated_reactor_pool_size(1);
+    }
+    builder.build().await.expect("build peer connection")
+}
+
+fn video_track() -> Arc<dyn TrackLocal> {
+    Arc::new(TrackLocalStaticRTP::new(MediaStreamTrack::new(
+        "stream".to_owned(),
+        "track".to_owned(),
+        "label".to_owned(),
+        RtpCodecKind::Video,
+        vec![RTCRtpEncodingParameters {
+            rtp_coding_parameters: RTCRtpCodingParameters {
+                ssrc: Some(1234),
+                ..Default::default()
+            },
+            codec: RTCRtpCodec {
+                mime_type: "video/VP8".to_owned(),
+                clock_rate: 90000,
+                ..Default::default()
+            },
+            ..Default::default()
+        }],
+    )))
+}
+
+#[test]
+fn data_channel_poll_ends_after_close() {
+    block_on(async {
+        for dedicated_reactor in [false, true] {
+            for drop_connection in [false, true] {
+                let pc = build(dedicated_reactor).await;
+                let dc: Arc<dyn DataChannel> = pc
+                    .create_data_channel("events", None)
+                    .await
+                    .expect("create data channel");
+
+                pc.close().await.expect("close");
+                if drop_connection {
+                    drop(pc);
+                }
+
+                let event = timeout(STREAM_END_TIMEOUT, dc.poll())
+                    .await
+                    .unwrap_or_else(|_| {
+                        panic!(
+                            "DataChannel::poll still blocked after close() \
+                         (dedicated_reactor={dedicated_reactor}, drop_connection={drop_connection})"
+                        )
+                    });
+                assert!(
+                    event.is_none(),
+                    "no event is pending, so the stream must end"
+                );
+            }
+        }
+    });
+}
+
+#[test]
+fn track_local_poll_ends_after_close() {
+    block_on(async {
+        for dedicated_reactor in [false, true] {
+            let pc = build(dedicated_reactor).await;
+            let track = video_track();
+            pc.add_track(Arc::clone(&track)).await.expect("add_track");
+
+            pc.close().await.expect("close");
+
+            let event = timeout(STREAM_END_TIMEOUT, track.poll())
+                .await
+                .unwrap_or_else(|_| {
+                    panic!(
+                        "TrackLocal::poll still blocked after close() \
+                         (dedicated_reactor={dedicated_reactor})"
+                    )
+                });
+            assert!(
+                event.is_none(),
+                "no RTCP is pending, so the stream must end"
+            );
+        }
+    });
+}
+
+/// `Drop` on a dedicated reactor stops the driver without `close()`; the driver's stop path must
+/// end the streams too.
+#[test]
+fn data_channel_poll_ends_when_a_dedicat
```

**File**: `tests/close_releases_connection_with_transceivers.rs` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+//! Regression test for webrtc#906: a connection that ever held a transceiver must be freed after
+//! `close()` and drop.
+//!
+//! `PeerConnectionRef.rtp_transceivers` owns every `RtpTransceiverImpl`, and each transceiver owns
+//! its `RtpSenderImpl` and `RtpReceiverImpl`. All three used to hold a strong
+//! `Arc<PeerConnectionRef>` back, a cycle that nothing broke: neither `close()` nor `Drop` empties
+//! the map. A single `add_track()` therefore kept the event handler, the sans-I/O core and every
+//! buffer alive for the life of the process. The back-references are now `Weak`.
+//!
+//! The connection is observed through a `Weak` to its event handler, which only the connection
+//! holds once the test has handed it to the builder.
+use std::sync::Arc;
+use std::time::Duration;
+
+use rtc::media_stream::MediaStreamTrack;
+use rtc::peer_connection::configuration::media_engine::MediaEngine;
+use rtc::rtp_transceiver::rtp_sender::{
+    RTCRtpCodec, RTCRtpCodingParameters, RTCRtpEncodingParameters, RtpCodecKind,
+};
+use webrtc::media_stream::track_local::TrackLocal;
+use webrtc::media_stream::track_local::static_rtp::TrackLocalStaticRTP;
+use webrtc::peer_connection::{PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler};
+
+mod common;
+use common::{block_on, sleep};
+
+/// How long a closed and dropped connection may take to be freed.
+const RELEASE_TIMEOUT: Duration = Duration::from_secs(2);
+
+struct NoopHandler;
+
+#[async_trait::async_trait]
+impl PeerConnectionEventHandler for NoopHandler {}
+
+fn video_track() -> Arc<dyn TrackLocal> {
+    Arc::new(TrackLocalStaticRTP::new(MediaStreamTrack::new(
+        "stream".to_owned(),
+        "track".to_owned(),
+        "label".to_owned(),
+        RtpCodecKind::Video,
+        vec![RTCRtpEncodingParameters {
+            rtp_coding_parameters: RTCRtpCodingParameters {
+                ssrc: Some(1234),
+                ..Default::default()
+            },
+            codec: RTCRtpCodec {
+                mime_type: "video/VP8".to_owned(),
+                clock_rate: 90000,
+                ..Default::default()
+            },
+            ..Default::default()
+        }],
+    )))
+}
+
+/// Builds a connection, optionally adds a track (which creates a transceiver with a sender),
+/// closes and drops it, and reports whether its event handler was freed within
+/// [`RELEASE_TIMEOUT`].
+async fn is_released_after_close_and_drop(add_track: bool, dedicated_reactor: bool) -> bool {
+    let handler = Arc::new(NoopHandler);
+    let handler_weak = Arc::downgrade(&handler);
+
+    let mut media_engine = MediaEngine::default();
+    media_engine
+        .register_default_codecs()
+        .expect("register default codecs");
+    let mut builder = PeerConnectionBuilder::new()
+        .with_media_engine(media_engine)
+        .with_handler(handler)
+        .with_udp_addrs(vec!["127.0.0.1:0".to_string()]);
+    if dedicated_reactor {
+        builder = builder.with_dedicated_reactor_pool_size(1);
+    }
+    let pc = builder.build().await.expect("build peer connection");
+
+    if add_track {
+        pc.add_track(video_track()).await.expect("add_track");
+    }
+    pc.close().await.expect("close");
+    drop(pc);
+
+    let step = Duration::from_millis(10);
+    let mut waited = Duration::ZERO;
+    while waited < RELEASE_TIMEOUT {
+        if handler_weak.upgrade().is_none() {
+            return true;
+        }
+        sleep(step).await;
+        waited += step;
+    }
+    false
+}
+
+#[test]
+fn close_and_drop_release_a_connection_that_added_a_track() {
+    block_on(async {
+        for dedicated_reactor in [false, true] {
+            // Control: without a transceiver the connection was always freed, so a failure below
+            // can only come from the transceiver path.
+            assert!(
+                is_released_after_close_and_drop(false, dedicated_reactor).await,
+                "a connection without tracks was not freed (dedicated_reactor={dedicated_reactor})"
+            );
+            assert!(
+                is_released_after_close_and_drop(true, dedicated_reactor).await,
+                "a connection that added a track was never freed after close() and drop \
+                 (dedicated_reactor={dedicated_reactor}): the transceiver, sender or receiver \
+                 still holds a strong reference to it"
+            );
+        }
+    });
+}
```

---

### Incident Patch 5: `36433e53` (2026-09-20)
**Commit Message**: fix: skip STUN servers without a matching address family (#900)

* fix: skip STUN servers without a matching address family

* fix(stun): parse STUN urls instead of slicing the scheme off

Two problems on the resolution path, both of which produced the spurious
"Failed to resolve STUN server" this change set out to remove.

`url.strip_prefix("stun:")` handed the remainder straight to
`resolve_host`, which needs `host:port`:

  - `stun:stun.l.google.com` omits the port, which RFC 7064 permits and
    defaults to 3478. It resolved nothing. The deleted `format!` branch
    was meant to cover this but was already dead — the `starts_with`
    guard makes `contains(':')` always true.
  - `stun:host:3478?transport=udp` carries a query that RFC 7064 does not
    define for `stun:`, but that providers ship anyway.
    `RTCConfiguration::get_ice_servers` strips it for exactly that reason;
    the driver bypasses it by passing the unsanitized list here, so the
    query reached `resolve_host` and resolution failed.

Parse the URL with `ice::url::Url::parse_url` — the same source of the
3478 default that `turn_relayer` already relies on — after stripping the
query the way `get_ice_servers` doe

**File**: `src/peer_connection/transport/stun_gatherer.rs` (modified, +269/-46)
```diff
@@ -6,6 +6,7 @@
 
 use crate::runtime::Runtime;
 use rtc::ice::candidate::CandidateConfig;
+use rtc::ice::url::{SchemeType, Url as IceUrl};
 use rtc::peer_connection::configuration::{RTCIceServer, RTCIceTransportPolicy};
 use rtc::peer_connection::transport::{
     CandidateHostConfig, CandidateServerReflexiveConfig, RTCIceCandidate, RTCIceCandidateInit,
@@ -22,7 +23,7 @@ use std::sync::Arc;
 /*use rtc::turn::client::{
     Client as TurnClient, ClientConfig as TurnClientConfig, Event as TurnEvent,
 };*/
-use log::{debug, error};
+use log::{debug, error, warn};
 use rtc::peer_connection::state::RTCIceGatheringState;
 use rtc::stun::agent::StunEvent;
 use rtc::stun::message::Getter;
@@ -160,17 +161,64 @@ impl RTCStunGatherer {
         // Clone the handle up front so the per-server borrows below stay disjoint.
         let runtime = Arc::clone(&self.runtime);
         for ice_server in &self.ice_servers {
-            for url in &ice_server.urls {
-                // Only handle stun: URLs for now
-                if !url.starts_with("stun:") {
-                    continue;
+            for raw_url in &ice_server.urls {
+                // RFC 7064 defines no query component for `stun:`, but real-world
+                // configurations ship `?transport=udp` on STUN URLs. Strip it rather than
+                // reject the server, matching `RTCConfiguration::get_ice_servers` — which
+                // exists for exactly this reason, and which the driver bypasses by handing
+                // this gatherer the unsanitized list.
+                let sanitized = raw_url.split('?').next().unwrap_or(raw_url);
+
+                let url = match IceUrl::parse_url(sanitized) {
+                    Ok(url) => url,
+                    Err(err) => {
+                        // `turn:`/`turns:` belong to the TURN relayer; stay quiet about
+                        // anything that does not claim to be STUN.
+                        if sanitized.starts_with("stun") {
+                            warn!("Skipping malformed STUN url {}: {}", raw_url, err);
+                        }
+                        continue;
+                    }
+                };
+
+                match url.scheme {
+                    SchemeType::Stun => {}
+                    SchemeType::Stuns => {
+                        warn!("Skipping unsupported secure STUN url {}", raw_url);
+                        continue;
+                    }
+                    // Gathered by the TURN relayer, not here.
+                    _ => continue,
                 }
 
+                // `Url` supplies RFC 7064's default port, so a `stun:host` URL with the
+                // port omitted resolves instead of reaching `resolve_host` without one.
+                // `parse_url` strips the brackets from an IPv6 literal, so put them back:
+                // a bare `2001:db8::2:3478` is not a parseable socket address. A host
+                // containing `:` can only be an IPv6 literal — DNS names never do.
+                let server_addr = if url.host.contains(':') {
+                    format!("[{}]:{}", url.host, url.port)
+                } else {
+                    format!("{}:{}", url.host, url.port)
+                };
+
+                // Resolve once per URL, then only create clients for matching families.
+                debug!("Resolving STUN server: {}", server_addr);
+                let resolved_addrs = match runtime.resolve_host(&server_addr).await {
+                    Ok(addrs) => addrs,
+                    Err(err) => {
+                        error!("Failed to resolve STUN server {}: {}", server_addr, err);
+                        continue;
+                    }
+                };
+
                 for local_addr in &self.local_addrs {
-                    match RTCStunGatherer::gather_from_stun_server(&*runtime, *local_addr, url)
-                        .await
-                    {
-                        Ok(stun_client) => {
+                    match RTCStunGatherer::gather_from_stun_server(
+                        &*runtime,
+                        *local_addr,
+                        &resolved_addrs,
+                    ) {
+                        Ok(Some(stun_client)) => {
                             self.stun_clients.insert(
                                 FourTuple {
                                     local_addr: stun_client.local_addr(),
@@ -179,6 +227,7 @@ impl RTCStunGatherer {
                                 stun_client,
                             );
                         }
+                        Ok(None) => {}
                         Err(err) => {
                             error!("Failed to gather stun client: {}", err);
                         }
@@ -190,49 +239,25 @@ impl RTCStunGatherer {
         Ok(())
     }
 
-    /// Gather a single srflx candidate from a STUN server
-    async fn gather_from_stun_server(
+    /// Gather a single srflx candidate, skipping servers without a ma
```

---

### Incident Patch 6: `b45f9a93` (2026-09-03)
**Commit Message**: fix 0.20 (sans-IO): TURN relayer consumes STUN Binding responses when STUN and TURN share the same server address — no srflx candidates gathered #890

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 7df0a825c53155850b4e76dda03815c9902a801f
+Subproject commit 7386413428e16cbbae16552647a972df5d655fd5
```

**File**: `src/peer_connection/transport/turn_relayer.rs` (modified, +252/-20)
```diff
@@ -12,7 +12,10 @@ use rtc::peer_connection::transport::{
 use rtc::sansio::Protocol;
 use rtc::shared::error::{Error, Result};
 use rtc::shared::{FourTuple, TaggedBytesMut, TransportContext, TransportProtocol};
-use rtc::stun::message::{METHOD_BINDING, Message as StunMessage, is_stun_message};
+use rtc::stun::message::{
+    CLASS_ERROR_RESPONSE, CLASS_INDICATION, CLASS_SUCCESS_RESPONSE, Message as StunMessage,
+    TransactionId, is_stun_message,
+};
 use rtc::turn::client::{
     Client as TurnClient, ClientConfig as TurnClientConfig, Event as TurnEvent,
 };
@@ -397,24 +400,21 @@ impl RTCTurnRelayer {
         }
     }
 
+    /// Which TURN client, if any, this inbound packet belongs to.
+    ///
+    /// These sockets are shared with [`RTCStunGatherer`](super::stun_gatherer::RTCStunGatherer),
+    /// and when the configuration points `stun:` and `turn:` URLs at one `host:port` — the standard
+    /// single-listener coturn deployment — the four-tuple is *identical* for both users. So the
+    /// message is inspected before the four-tuple is trusted, because in that deployment an address
+    /// match cannot say whose the packet is: a response is matched by transaction id, and only the
+    /// framings that carry none fall back to addresses. See [webrtc#890].
+    ///
+    /// [webrtc#890]: https://github.com/webrtc-rs/webrtc/issues/890
     fn matching_client_key(&self, msg: &TaggedBytesMut) -> Option<FourTuple> {
-        let exact = FourTuple::from(&msg.transport);
-        if self.clients.contains_key(&exact) {
-            return Some(exact);
-        }
-
-        let same_local: Vec<FourTuple> = self
-            .clients
-            .keys()
-            .copied()
-            .filter(|four_tuple| four_tuple.local_addr == msg.transport.local_addr)
-            .collect();
-        if same_local.is_empty() {
-            return None;
-        }
-
+        // ChannelData is not STUN-framed and carries no transaction id, so addresses are all there
+        // is — and they suffice, because the gatherer neither sends nor receives it.
         if ChannelData::is_channel_data(&msg.message) {
-            return Self::match_same_local_client(&same_local, msg.transport.peer_addr);
+            return self.match_by_local_addr(msg);
         }
 
         if !is_stun_message(&msg.message) {
@@ -427,9 +427,54 @@ impl RTCTurnRelayer {
             return None;
         }
 
-        if stun_message.typ.method == METHOD_BINDING {
-            return None;
+        match stun_message.typ.class {
+            // Data and Send indications are not transaction-matched, so they route by address for
+            // the same reason ChannelData does.
+            CLASS_INDICATION => self.match_by_local_addr(msg),
+
+            // RFC 5389 section 7.3.3: a response belongs to whoever sent the request, identified by
+            // transaction id and by nothing else. Every TURN request registers one, so a response
+            // no client is waiting on is not ours — most often a Binding response for the gatherer,
+            // arriving from the address we share with it.
+            CLASS_SUCCESS_RESPONSE | CLASS_ERROR_RESPONSE => {
+                self.match_by_transaction(&stun_message.transaction_id)
+            }
+
+            // An inbound request on these sockets is an ICE connectivity check, which belongs to
+            // neither this relayer nor the gatherer.
+            _ => None,
         }
+    }
+
+    /// The client waiting on `transaction_id`.
+    ///
+    /// Searches every client rather than the one whose four-tuple matches, because a multi-homed
+    /// server may answer from an address other than the one we sent to — the case
+    /// [`match_same_local_client`](Self::match_same_local_client) exists for. A transaction id
+    /// identifies the client outright, so that heuristic is not needed here.
+    fn match_by_transaction(&self, transaction_id: &TransactionId) -> Option<FourTuple> {
+        self.clients
+            .iter()
+            .find(|(_, managed)| managed.client.has_transaction(transaction_id))
+            .map(|(four_tuple, _)| *four_tuple)
+    }
+
+    /// The client on this packet's local socket, disambiguated by peer address.
+    ///
+    /// For the framings that carry no transaction id. Prefers an exact four-tuple, then falls back
+    /// to clients sharing the local socket.
+    fn match_by_local_addr(&self, msg: &TaggedBytesMut) -> Option<FourTuple> {
+        let exact = FourTuple::from(&msg.transport);
+        if self.clients.contains_key(&exact) {
+            return Some(exact);
+        }
+
+        let same_local: Vec<FourTuple> = self
+            .clients
+            .keys()
+            .copied()
+            .filter(|four_tuple| four_tuple.local_addr == msg.transport.local_addr)
+            .collect();
 
         Self::match_same_local_client(&same_local, msg.transport.peer_addr)
     }
@@ -766,10 +811,43 @@ mod tests {
     use rtc::peer_connection
```

---

### Incident Patch 7: `d89ccc43` (2026-08-31)
**Commit Message**: update rtc pointer to fix two sctp issues

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 51558ffb550bb17a540343b338e2cd4a764f3690
+Subproject commit e530b4cecb0f87eb26ba89a610529f2bca81ed8e
```

---

### Incident Patch 8: `6a6c3254` (2026-08-30)
**Commit Message**: update rtc pointer to fix sctp: permanent zero-window deadlock when the chunk dropped at buffer-full is the tail of a burst #217

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit d5785c9b4643d0eac37b819e5cf72cf88fa12725
+Subproject commit 2dadde6e556a9a6abfa89a6aa9f4ef32a95126cf
```

---

### Incident Patch 9: `00a33a2e` (2026-08-29)
**Commit Message**: fix RFC: Defer SCTP stream-id assignment until DTLS role is resolved (breaking API change) #199

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit fa17b237e20d171e2bcf113e36ec655f025e5eb3
+Subproject commit d5785c9b4643d0eac37b819e5cf72cf88fa12725
```

**File**: `tests/data_channels_close_by_rtc_interop.rs` (modified, +2/-1)
```diff
@@ -32,6 +32,7 @@ use webrtc::runtime::{Runtime, Sender, channel};
 
 mod common;
 use common::{block_on, runtime, sleep, timeout};
+use rtc::data_channel::RTCDataChannelId;
 
 const DEFAULT_TIMEOUT_DURATION: Duration = Duration::from_secs(30);
 
@@ -196,7 +197,7 @@ async fn run_test() -> Result<()> {
     let mut rtc_connected = false;
     let mut webrtc_connected = false;
     let mut rtc_data_channel_opened = false;
-    let mut rtc_dc_id: Option<u16> = None;
+    let mut rtc_dc_id: Option<RTCDataChannelId> = None;
     let mut last_message_time = Instant::now();
     let message_interval = Duration::from_millis(500);
     let mut webrtc_msg_count = 0usize;
```

**File**: `tests/data_channels_create_interop.rs` (modified, +2/-1)
```diff
@@ -36,6 +36,7 @@ use webrtc::runtime::{Runtime, Sender, channel};
 
 mod common;
 use common::{block_on, runtime, sleep, timeout};
+use rtc::data_channel::RTCDataChannelId;
 
 const DEFAULT_TIMEOUT_DURATION: Duration = Duration::from_secs(30);
 
@@ -208,7 +209,7 @@ async fn run_test() -> Result<()> {
     let mut webrtc_connected = false;
     let mut message_sent = false;
     let mut rtc_data_channel_opened = false;
-    let mut rtc_dc_id: Option<u16> = None;
+    let mut rtc_dc_id: Option<RTCDataChannelId> = None;
     let mut webrtc_received = false;
     let mut rtc_received_echo = false;
 
```

**File**: `tests/ice_restart_by_rtc_interop.rs` (modified, +2/-1)
```diff
@@ -28,6 +28,7 @@ use webrtc::runtime::{Runtime, Sender, channel};
 
 mod common;
 use common::{block_on, runtime, sleep, timeout};
+use rtc::data_channel::RTCDataChannelId;
 
 const DEFAULT_TIMEOUT_DURATION: Duration = Duration::from_secs(30);
 const TEST_MESSAGE: &str = "Hello before restart!";
@@ -180,7 +181,7 @@ async fn run_test() -> Result<()> {
     let mut buf = vec![0u8; 2000];
     let mut rtc_connected = false;
     let mut webrtc_connected = false;
-    let mut rtc_dc_id: Option<u16> = None;
+    let mut rtc_dc_id: Option<RTCDataChannelId> = None;
     let mut rtc_received: Vec<String> = Vec::new();
 
     log::info!("Waiting for initial connection...");
```

**File**: `tests/ice_restart_by_webrtc_interop.rs` (modified, +2/-1)
```diff
@@ -29,6 +29,7 @@ use webrtc::runtime::{Sender, channel};
 
 mod common;
 use common::{block_on, runtime, sleep, timeout};
+use rtc::data_channel::RTCDataChannelId;
 
 const DEFAULT_TIMEOUT_DURATION: Duration = Duration::from_secs(30);
 const TEST_MESSAGE_1: &str = "Hello before restart!";
@@ -181,7 +182,7 @@ async fn run_test() -> Result<()> {
     let mut buf = vec![0u8; 2000];
     let mut rtc_connected = false;
     let mut webrtc_connected = false;
-    let mut rtc_dc_id: Option<u16> = None;
+    let mut rtc_dc_id: Option<RTCDataChannelId> = None;
     let mut rtc_received: Vec<String> = Vec::new();
 
     log::info!("Waiting for initial connection...");
```

---

### Incident Patch 10: `df3cd3a7` (2026-08-29)
**Commit Message**: fix the first RTP packet of a stream traverses the whole interceptor chain before bind_remote_stream is called #207

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 0a971cf1fa35fc151dd3635d40426a4915b762cb
+Subproject commit fa17b237e20d171e2bcf113e36ec655f025e5eb3
```

**File**: `tests/flexfec03_encoder_decoder.rs` (modified, +24/-25)
```diff
@@ -520,15 +520,6 @@ fn flexfec03_recovers_every_dropped_packet() {
             "the drop filter should have discarded one packet in {DROP_ONE_IN}, got {dropped:?}"
         );
 
-        // The claim: every packet the sender discarded was rebuilt by the decoder and handed on.
-        assert!(
-            dropped.is_subset(&recovered),
-            "these dropped sequence numbers were never recovered: {:?}\n\
-             dropped:   {dropped:?}\n\
-             recovered: {recovered:?}",
-            dropped.difference(&recovered).collect::<Vec<_>>()
-        );
-
         // And nothing else went astray, so the recovery above is the whole story rather than one
         // effect among several.
         let all: BTreeSet<u16> = (1..=MEDIA_PACKETS_TO_SEND).collect();
@@ -540,24 +531,32 @@ fn flexfec03_recovers_every_dropped_packet() {
             all.difference(&delivered).collect::<Vec<_>>()
         );
 
-        // What was rebuilt that had not been lost.
-        //
-        // This should be empty and is not: the first packet of the stream is always rebuilt as
-        // well, duplicating one the receiver already had. The cause is not in the codec. A remote
-        // stream is bound to the interceptors only once its codec can be resolved from an arriving
-        // RTP payload type (`rtc`'s `endpoint.rs`, `find_track_id_by_ssrc`), and the endpoint sits
-        // application-ward of the chain — so the packet that triggers the bind has already
-        // traversed the chain by the time the bind happens. The decoder therefore never sees
-        // packet one, finds it missing when the first repair packet arrives, and rebuilds it.
+        // Set equality in both directions: every dropped packet came back rebuilt, and nothing
+        // else was rebuilt.
         //
-        // Pinned rather than tolerated. If the artifact ever spreads beyond that first packet this
-        // fails, and when the bind ordering is fixed the `is_empty` case starts holding and this
-        // can be tightened to set equality.
-        let spurious: BTreeSet<u16> = recovered.difference(&dropped).copied().collect();
+        // The second half is the one with history. Until stream establishment moved into rtc's
+        // interceptor handler, sequence number 1 was always rebuilt as well — a duplicate of a
+        // packet that had arrived perfectly well — because the packet that resolved the stream's
+        // codec had already traversed the chain by the time the decoder was bound to it. See
+        // `rtc`'s `handler/stream_establishment.rs`.
+        assert_eq!(
+            dropped,
+            recovered,
+            "every dropped sequence number must be recovered, and only those:\n\
+             dropped:   {dropped:?}\n\
+             recovered: {recovered:?}\n\
+             never recovered: {:?}\n\
+             rebuilt but never lost: {:?}",
+            dropped.difference(&recovered).collect::<Vec<_>>(),
+            recovered.difference(&dropped).collect::<Vec<_>>()
+        );
+
+        // A recovered packet must not also have arrived: that would mean the decoder rebuilt
+        // something it did not need to, and the sets above would agree for the wrong reason.
         assert!(
-            spurious.is_empty() || spurious == BTreeSet::from([1]),
-            "packets were rebuilt that had not been lost: {spurious:?}\n\
-             only sequence number 1 is a known artifact of the late remote-stream bind"
+            arrived.is_disjoint(&recovered),
+            "a packet was both received and recovered: {:?}",
+            arrived.intersection(&recovered).collect::<Vec<_>>()
         );
     });
 }
```

---

### Incident Patch 11: `98488a72` (2026-08-10)
**Commit Message**: update SettingEngineBuilder

**File**: `.github/workflows/cargo.yml` (modified, +6/-19)
```diff
@@ -111,25 +111,12 @@ jobs:
       # webrtc#858 got in. See docs/internal-channel-overflow-policy.md.
       - name: Bounded channels declare an overflow policy
         run: python3 scripts/check-channel-overflow-policy.py
-      # `webrtc` cannot be packaged until the core crates it depends on are published: cargo
-      # resolves against the registry and the path dependency is stripped from the published
-      # manifest. Publication order is rtc-crypto, then the rtc protocol crates, then rtc, then
-      # webrtc. This asserts the failure is exactly that missing version and nothing else, so a
-      # different packaging break is still caught.
-      - name: Confirm packaging blocks only on core publication
-        run: |
-          if cargo package --allow-dirty 2>package.log; then
-            echo "webrtc packaged; the core crates appear to be published."
-            echo "Replace this step with a normal packaging check."
-            exit 0
-          fi
-          if grep -q 'failed to select a version for the requirement `rtc' package.log; then
-            echo "Expected: webrtc awaits the rtc 0.21.0 publish."
-            exit 0
-          fi
-          echo "webrtc packaging failed for an unexpected reason:"
-          cat package.log
-          exit 1
+      # No packaging check here: `webrtc` cannot be packaged until the core crates are
+      # published — cargo resolves against the registry and the path dependency is stripped
+      # from the published manifest, so `cargo package` builds against whatever `rtc` is on
+      # crates.io rather than the submodule. Publication order is rtc-crypto, then the rtc
+      # protocol crates, then rtc, then webrtc. Add a plain `cargo package` step once rtc
+      # 0.21.0 is out.
 
   test:
     name: Test
```

**File**: `README.md` (modified, +87/-57)
```diff
@@ -64,7 +64,9 @@ alt="Recall.ai">
 
 ## Overview
 
-WebRTC.rs is an async-friendly WebRTC implementation in Rust, originally inspired by and largely rewriting the Pion stack. The async `webrtc` crate is a clean, ergonomic, runtime-agnostic rewrite on top of a Sans-I/O core; it ships with Tokio and smol runtime backends, and any other runtime can be plugged in by implementing one trait.
+WebRTC.rs is an async-friendly WebRTC implementation in Rust, originally inspired by and largely rewriting the Pion
+stack. The async `webrtc` crate is a clean, ergonomic, runtime-agnostic rewrite on top of a Sans-I/O core; it ships with
+Tokio and smol runtime backends, and any other runtime can be plugged in by implementing one trait.
 
 **Architecture:**
 
@@ -83,43 +85,45 @@ details and roadmap.
 
 ## Getting Started
 
-```toml
-[dependencies]
-webrtc = "0.20"
-```
-
-Or with the smol runtime instead of Tokio:
+**Trying the `0.21` pre-release?** Cargo does not select pre-release versions from a plain
+`"0.21"` requirement, so name it in full:
 
 ```toml
 [dependencies]
-webrtc = { version = "0.20", default-features = false, features = ["runtime-smol"] }
+webrtc = "0.21.0-alpha.1"
 ```
 
 **Feature flags:**
 
-| Feature         | Default | Description                                                             |
-|-----------------|---------|-------------------------------------------------------------------------|
-| `runtime-tokio` | ✅      | Timers, task spawning and sockets via Tokio                             |
-| `runtime-smol`  |         | The same, via smol                                                      |
-| `runtime-mock`  |         | `MockRuntime`, a deterministic virtual-clock runtime for tests (no I/O) |
-| `crypto-ring`   | ✅      | The `ring`-based crypto provider                                        |
-| `crypto-aws-lc-rs` |      | The `aws-lc-rs`-based crypto provider                                   |
+| Feature            | Default | Description                                                             |
+|--------------------|---------|-------------------------------------------------------------------------|
+| `runtime-tokio`    | ✅       | Timers, task spawning and sockets via Tokio                             |
+| `runtime-smol`     |         | The same, via smol                                                      |
+| `runtime-mock`     |         | `MockRuntime`, a deterministic virtual-clock runtime for tests (no I/O) |
+| `crypto-ring`      | ✅       | The `ring`-based crypto provider                                        |
+| `crypto-aws-lc-rs` |         | The `aws-lc-rs`-based crypto provider                                   |
 
-The runtime features are **additive**: each one only makes a built-in runtime *available*, so enabling several is safe and a single process can drive different connections on different runtimes.
+The runtime features are **additive**: each one only makes a built-in runtime *available*, so enabling several is safe
+and a single process can drive different connections on different runtimes.
 
-The crypto features work the same way. Enabling both compiles both providers, and `ring` stays the default selection — so a dependency that turns on `crypto-aws-lc-rs` cannot silently change which one your application runs. Building with neither compiles no provider, and you supply your own.
+The crypto features work the same way. Enabling both compiles both providers, and `ring` stays the default selection —
+so a dependency that turns on `crypto-aws-lc-rs` cannot silently change which one your application runs. Building with
+neither compiles no provider, and you supply your own.
 
-**Bringing your own runtime.** The built-ins are not privileged — implement `webrtc::runtime::Runtime` and pass it per connection with `with_runtime`, with no `#[cfg]` edits and no fork. See the [custom-runtime example](examples/custom-runtime), which runs the full stack on `async-executor` + `async-io` with `--no-default-features` (neither Tokio nor smol compiled in).
+**Bringing your own runtime.** The built-ins are not privileged — implement `webrtc::runtime::Runtime` and pass it per
+connection with `with_runtime`, with no `#[cfg]` edits and no fork. See
+the [custom-runtime example](examples/custom-runtime), which runs the full stack on `async-executor` + `async-io` with
+`--no-default-features` (neither Tokio nor smol compiled in).
 
-**Choosing a crypto provider.** Same story: pass one per connection through `SettingEngine`, which also means two connections in one process can use different providers.
+**Choosing a crypto provider.** Same story: pass one per connection through `SettingEngine`, which also means two
+connections in one process can use different providers.
 
 ```rust
 use std::sync::Arc;
 use webrtc::peer_connection::crypto;
-use webrtc::peer_connection::SettingEngine;
+use webrtc::peer_connection::SettingEngineBuilder;
 
-let mut setting_engine = SettingEngine::def
```

**File**: `examples/ice-tcp-active-passive/ice-tcp-active-offer.rs` (modified, +7/-6)
```diff
@@ -21,7 +21,7 @@ use rtc::peer_connection::state::RTCPeerConnectionState;
 use webrtc::data_channel::DataChannelEvent;
 use webrtc::peer_connection::{
     PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler, RTCPeerConnectionIceEvent,
-    Registry, SettingEngine,
+    Registry, SettingEngineBuilder,
 };
 use webrtc::runtime::channel;
 
@@ -149,11 +149,12 @@ async fn async_main(cli: Cli) -> Result<()> {
     media.register_default_codecs()?;
     let registry = register_default_interceptors(Registry::new(), &mut media)?;
 
-    let mut setting_engine = SettingEngine::default();
-    setting_engine.set_network_types(vec![
-        rtc::ice::network_type::NetworkType::Tcp4,
-        rtc::ice::network_type::NetworkType::Tcp6,
-    ]);
+    let setting_engine = SettingEngineBuilder::new()
+        .with_network_types(vec![
+            rtc::ice::network_type::NetworkType::Tcp4,
+            rtc::ice::network_type::NetworkType::Tcp6,
+        ])
+        .build();
 
     let pc = PeerConnectionBuilder::new()
         .with_configuration(RTCConfigurationBuilder::new().build())
```

**File**: `examples/ice-tcp-active-passive/ice-tcp-passive-answer.rs` (modified, +8/-7)
```diff
@@ -23,7 +23,7 @@ use rtc::peer_connection::transport::RTCDtlsRole;
 use webrtc::data_channel::{DataChannel, DataChannelEvent};
 use webrtc::peer_connection::{
     PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler, RTCPeerConnectionIceEvent,
-    SettingEngine,
+    SettingEngineBuilder,
 };
 use webrtc::runtime::channel;
 
@@ -259,12 +259,13 @@ async fn async_main(cli: Cli) -> Result<()> {
     media.register_default_codecs()?;
     let registry = register_default_interceptors(Registry::new(), &mut media)?;
 
-    let mut setting_engine = SettingEngine::default();
-    setting_engine.set_answering_dtls_role(RTCDtlsRole::Client)?;
-    setting_engine.set_network_types(vec![
-        rtc::ice::network_type::NetworkType::Tcp4,
-        rtc::ice::network_type::NetworkType::Tcp6,
-    ]);
+    let setting_engine = SettingEngineBuilder::new()
+        .with_answering_dtls_role(RTCDtlsRole::Client)
+        .with_network_types(vec![
+            rtc::ice::network_type::NetworkType::Tcp4,
+            rtc::ice::network_type::NetworkType::Tcp6,
+        ])
+        .build();
 
     let pc: Arc<dyn PeerConnection> = Arc::new(
         PeerConnectionBuilder::new()
```

**File**: `examples/ice-tcp/README.md` (modified, +14/-5)
```diff
@@ -1,14 +1,19 @@
 # ICE TCP Example
 
-This example demonstrates how to establish a WebRTC connection exclusively over TCP (RFC 4571) using the async `webrtc` API.
+This example demonstrates how to establish a WebRTC connection exclusively over TCP (RFC 4571) using the async `webrtc`
+API.
 
 ## About ICE TCP
 
-ICE TCP is useful when UDP traffic is blocked by restrictive firewalls. WebRTC normally uses UDP for media and data transport, but can fall back to TCP when necessary.
+ICE TCP is useful when UDP traffic is blocked by restrictive firewalls. WebRTC normally uses UDP for media and data
+transport, but can fall back to TCP when necessary.
 
 This example showcases:
-- Configuring the `PeerConnection` to only gather and listen on TCP candidates using `.with_tcp_addrs()` and leaving UDP addresses empty.
-- Customizing the DTLS role via `SettingEngine::set_answering_dtls_role(RTCDtlsRole::Client)` to act as the DTLS client when answering the connection.
+
+- Configuring the `PeerConnection` to only gather and listen on TCP candidates using `.with_tcp_addrs()` and leaving UDP
+  addresses empty.
+- Customizing the DTLS role via `SettingEngineBuilder::with_answering_dtls_role(RTCDtlsRole::Client)` to act as the DTLS
+  client when answering the connection.
 - Serving a local web interface using `hyper` to serve static pages and handle SDP signaling.
 - Establishing a `DataChannel` over pure TCP and exchanging periodic messages.
 
@@ -18,14 +23,16 @@ This example showcases:
 2. When a browser opens `http://localhost:8080`, it generates an SDP offer with both TCP and UDP candidates.
 3. The browser sends this SDP offer to the server via an HTTP `POST` to `/doSignaling`.
 4. The server configures the `PeerConnection`, sets the remote offer, and generates an answer.
-5. The server waits for local ICE gathering to complete (disabling trickle ICE) so that the answer includes the server's TCP passive candidate.
+5. The server waits for local ICE gathering to complete (disabling trickle ICE) so that the answer includes the server's
+   TCP passive candidate.
 6. The server responds with the local SDP answer.
 7. The browser sets the answer and initiates an active TCP connection to the server's listener on port `8443`.
 8. Once connected, a `DataChannel` is established, and the server sends timestamp messages every 3 seconds.
 
 ## Running the Example
 
 ### 1. Run the Server
+
 From the root of the project, run:
 
 ```bash
@@ -39,12 +46,14 @@ cargo run --example ice-tcp -- --debug
 ```
 
 ### 2. Access the Web UI
+
 Open your browser and navigate to:
 
 ```
 http://localhost:8080
 ```
 
 You will see:
+
 - Real-time updates of the ICE connection state.
 - Inbound messages received from the server over the established TCP WebRTC data channel.
```

**File**: `examples/ice-tcp/ice-tcp.rs` (modified, +4/-3)
```diff
@@ -28,7 +28,7 @@ use rtc::peer_connection::transport::RTCDtlsRole;
 use signal::get_local_ip;
 use webrtc::data_channel::{DataChannel, DataChannelEvent};
 use webrtc::peer_connection::{
-    PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler, SettingEngine,
+    PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler, SettingEngineBuilder,
 };
 use webrtc::runtime::{Mutex, Runtime, Sender, channel};
 
@@ -259,8 +259,9 @@ async fn async_main(_cli: Cli) -> Result<()> {
     media.register_default_codecs()?;
     let registry = register_default_interceptors(Registry::new(), &mut media)?;
 
-    let mut setting_engine = SettingEngine::default();
-    setting_engine.set_answering_dtls_role(RTCDtlsRole::Client)?;
+    let setting_engine = SettingEngineBuilder::new()
+        .with_answering_dtls_role(RTCDtlsRole::Client)
+        .build();
 
     let local_ip = get_local_ip();
     println!("Server local IP address is: {local_ip}");
```

**File**: `examples/mdns-query-and-gather/mdns-query-and-gather.rs` (modified, +17/-14)
```diff
@@ -23,7 +23,8 @@ use webrtc::data_channel::{DataChannel, DataChannelEvent};
 use webrtc::peer_connection::{
     MediaEngine, PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler,
     RTCConfigurationBuilder, RTCIceCandidateType, RTCIceConnectionState, RTCIceGatheringState,
-    RTCIceServer, RTCPeerConnectionState, Registry, SettingEngine, register_default_interceptors,
+    RTCIceServer, RTCPeerConnectionState, Registry, SettingEngineBuilder,
+    register_default_interceptors,
 };
 use webrtc::runtime::{Runtime, Sender, channel};
 
@@ -182,21 +183,23 @@ async fn async_main(cli: Cli) -> Result<()> {
     media.register_default_codecs()?;
     let registry = register_default_interceptors(Registry::new(), &mut media)?;
 
-    let mut setting_engine = SettingEngine::default();
-    setting_engine.set_answering_dtls_role(if cli.client {
-        RTCDtlsRole::Client
-    } else {
-        RTCDtlsRole::Server
-    })?;
-    setting_engine.set_multicast_dns_timeout(Some(Duration::from_secs(10)));
-    if cli.query_only {
-        setting_engine.set_multicast_dns_mode(MulticastDnsMode::QueryOnly);
+    let builder = SettingEngineBuilder::new()
+        .with_answering_dtls_role(if cli.client {
+            RTCDtlsRole::Client
+        } else {
+            RTCDtlsRole::Server
+        })
+        .with_multicast_dns_timeout(Some(Duration::from_secs(10)));
+
+    let setting_engine = if cli.query_only {
+        builder.with_multicast_dns_mode(MulticastDnsMode::QueryOnly)
     } else {
-        setting_engine.set_multicast_dns_mode(MulticastDnsMode::QueryAndGather);
-        setting_engine
-            .set_multicast_dns_local_name("webrtc-rs-hides-local-ip-by-mdns.local".to_string());
-        setting_engine.set_multicast_dns_local_ip(Some(local_ip));
+        builder
+            .with_multicast_dns_mode(MulticastDnsMode::QueryAndGather)
+            .with_multicast_dns_local_name("webrtc-rs-hides-local-ip-by-mdns.local".to_string())
+            .with_multicast_dns_local_ip(Some(local_ip))
     }
+    .build();
 
     let peer_connection = PeerConnectionBuilder::new()
         .with_configuration(
```

**File**: `examples/play-from-disk-playlist-control/play-from-disk-playlist-control.rs` (modified, +4/-3)
```diff
@@ -11,7 +11,7 @@ use rtc::media_stream::MediaStreamTrack;
 use rtc::peer_connection::configuration::RTCConfigurationBuilder;
 use rtc::peer_connection::configuration::interceptor_registry::register_default_interceptors;
 use rtc::peer_connection::configuration::media_engine::{MIME_TYPE_OPUS, MediaEngine};
-use rtc::peer_connection::configuration::setting_engine::SettingEngine;
+use rtc::peer_connection::configuration::setting_engine::SettingEngineBuilder;
 use rtc::peer_connection::sdp::RTCSessionDescription;
 use rtc::peer_connection::state::RTCSignalingState;
 use rtc::peer_connection::transport::RTCDtlsRole;
@@ -463,8 +463,9 @@ async fn handle_whep_connection(
     tracks: Arc<Vec<OggTrack>>,
     runtime: Arc<dyn Runtime>,
 ) -> Result<String> {
-    let mut setting_engine = SettingEngine::default();
-    setting_engine.set_answering_dtls_role(RTCDtlsRole::Server)?;
+    let setting_engine = SettingEngineBuilder::new()
+        .with_answering_dtls_role(RTCDtlsRole::Server)
+        .build();
 
     let mut media_engine = MediaEngine::default();
     let opus_codec = RTCRtpCodecParameters {
```

---

### Incident Patch 12: `869153fe` (2026-08-09)
**Commit Message**: fix cargo doc

**File**: `src/runtime/mod.rs` (modified, +4/-1)
```diff
@@ -166,9 +166,12 @@ pub trait Runtime: Send + Sync + Debug + 'static {
     /// **This is the clock the sans-I/O core sees.** The core is *told* the time — through
     /// `handle_timeout(now)` and the timestamps on inbound messages — and never reads one
     /// itself, so whatever the driver passes down is the only clock protocol logic has. Routing
-    /// that through the runtime is what makes [`MockRuntime`](crate::runtime::mock::MockRuntime)'s
+    /// that through the runtime is what makes the `runtime-mock` feature's `MockRuntime`
     /// virtual clock reach ICE timeouts, DTLS retransmits and SCTP RTO.
     ///
+    /// (Named rather than linked: `mock` is behind the `runtime-mock` feature, so an
+    /// intra-doc link to it does not resolve in a default-feature doc build.)
+    ///
     /// Defaulted to the wall clock, so existing `Runtime` implementations keep working
     /// unchanged. A runtime with a controllable clock should override it and return that
     /// clock's instant; one that does not will simply behave as before.
```

---

### Incident Patch 13: `81b4735f` (2026-08-09)
**Commit Message**: PeerConnection driver can hot-loop on a non-advancing expired timeout #862

**File**: `rtc` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit eb07ac297d7fd1ca23eee5c7d69d605bbb8bb5e6
+Subproject commit efe5114f1d2eee62372b19ad5b2ce7fe343d33da
```

**File**: `src/peer_connection/driver.rs` (modified, +52/-5)
```diff
@@ -103,6 +103,26 @@ pub(crate) const DRIVER_TO_TRACK_LOCAL_EVENT_CHANNEL_CAPACITY: usize = 256;
 
 const DEFAULT_TIMEOUT_DURATION: Duration = Duration::from_secs(86400); // 1 day duration
 
+/// The resolution at which an already-expired deadline is worth re-handling.
+///
+/// Network protocol timers are millisecond-grained — SCTP retransmits, ICE consent, DTLS
+/// backoff, TURN refresh. Handling an expired deadline more than once within the same
+/// millisecond therefore cannot advance any of them; it can only spin. So when a deadline is
+/// already past *and* less than this has elapsed since the last time one was handled, the loop
+/// waits out the remainder instead of looping straight back.
+///
+/// That waiting is the point. `select!` is the only place this loop reads sockets, takes driver
+/// events, or notices `Close`, and the previous code reached it only when a deadline was in the
+/// future — so a source that never advanced past `now` starved the connection *and* the
+/// shutdown meant to end it. See [webrtc#862](https://github.com/webrtc-rs/webrtc/issues/862).
+///
+/// Deliberately a time bound rather than a comparison of successive deadlines. A source stuck
+/// at one instant is only the easiest shape to spot; one returning a *different* expired
+/// instant each time — a timer advancing slower than the clock, or a deadline derived from the
+/// newest packet's arrival — spins exactly as hard while never repeating a value. Rate-limiting
+/// by elapsed time catches every shape.
+const MIN_IMMEDIATE_TIMEOUT_INTERVAL: Duration = Duration::from_millis(1);
+
 /// Insert `sender` for `channel_id`, returning `true` if the channel should be announced.
 pub(crate) fn insert_data_channel_event_sender(
     data_channels: &mut HashMap<RTCDataChannelId, Sender<DataChannelEvent>>,
@@ -324,6 +344,10 @@ where
             })
             .collect();
         let mut active_socket_count = udp_socket_list.len();
+        // When an already-expired deadline was last handled, so the loop can decline to do it
+        // again within the same millisecond. `None` once a deadline lands in the future, so a
+        // connection behaving normally never carries state from an earlier stall.
+        let mut last_immediate_timeout: Option<Instant> = None;
 
         // Batch-drain: after one datagram wakes the select, non-blockingly drain a
         // bounded burst of additional ready datagrams from the same socket and feed
@@ -377,13 +401,36 @@ where
             // The runtime's clock, not the wall clock: this instant is what reaches
             // `core.handle_timeout(now)`, so under a `MockRuntime` it is the virtual one.
             let now = self.inner.runtime.now();
-            let delay_from_now = timeout.checked_duration_since(now).unwrap_or_default();
+            let delay_from_now = timeout.saturating_duration_since(now);
 
             // 4.b handle immediate timeout
-            if delay_from_now.is_zero() {
-                self.handle_timeout(now).await?;
-                continue;
-            }
+            // Rate-limited, not unconditional. Handling an expired deadline and looping
+            // straight back is the right fast path, but it is also the only way this loop can
+            // fail to reach `select!` — where sockets, driver events and `Close` are read.
+            let delay_from_now = if delay_from_now.is_zero() {
+                let too_soon = last_immediate_timeout
+                    .map(|last| now.saturating_duration_since(last))
+                    .filter(|elapsed| *elapsed < MIN_IMMEDIATE_TIMEOUT_INTERVAL);
+
+                match too_soon {
+                    // Less than a millisecond since the last one: no protocol timer can have
+                    // become due, so wait out the remainder in `select!` rather than spin.
+                    // The timeout is handled on the next pass, with a clock that has moved.
+                    Some(elapsed) => {
+                        last_immediate_timeout = None;
+                        MIN_IMMEDIATE_TIMEOUT_INTERVAL - elapsed
+                    }
+                    // First expired deadline, or a millisecond has passed: handle it now.
+                    None => {
+                        last_immediate_timeout = Some(now);
+                        self.handle_timeout(now).await?;
+                        continue;
+                    }
+                }
+            } else {
+                last_immediate_timeout = None;
+                delay_from_now
+            };
 
             // Wake as soon as a blocked consumer frees a slot. `Notify` stores no permit, so
             // a naive "check, then wait" drops any wake published in between and the loop
```

---

### Incident Patch 14: `d7ee0f6c` (2026-07-31)
**Commit Message**: fix default_runtime for mockRuntime

**File**: `.github/workflows/cargo.yml` (modified, +15/-13)
```diff
@@ -27,29 +27,31 @@ jobs:
       - name: Build
         run: cargo build --verbose
 
-  build-features:
-    # The runtime features are additive and each only decides whether a built-in `Runtime`
-    # type exists, so a build with any one of them — or with none at all — must compile.
-    # `--no-default-features` with no runtime is the configuration an application supplying
-    # its own `Runtime` uses; nothing in the library may reach for a built-in.
-    #
-    # Feature resolution is platform-independent, so one OS is enough here; the `build` job
-    # above still covers Linux/macOS/Windows for the default feature set.
-    name: Build (${{ matrix.features }})
+  build-no-features:
+    name: Build with No Default Features
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v3
+        with:
+          submodules: recursive
+      - name: Build
+        run: cargo build --verbose --no-default-features
+
+  test-features:
+    name: Unit Test with ${{ matrix.features }}
     runs-on: ubuntu-latest
     strategy:
       fail-fast: false
       matrix:
         features:
-          - '--no-default-features'
-          - '--no-default-features --features runtime-smol'
-          - '--no-default-features --features runtime-mock'
+          - 'runtime-smol'
+          - 'runtime-mock'
     steps:
       - uses: actions/checkout@v3
         with:
           submodules: recursive
       - name: Build
-        run: cargo build --verbose ${{ matrix.features }}
+        run: cargo test --lib --verbose --no-default-features --features ${{ matrix.features }}
 
   test:
     name: Test
```

**File**: `src/runtime/mod.rs` (modified, +23/-3)
```diff
@@ -424,15 +424,35 @@ pub trait AsyncTcpStream: Send + Sync + Debug + 'static {
 /// [`with_runtime`](crate::peer_connection::PeerConnectionBuilder::with_runtime); that
 /// also allows different connections in one process to use different runtimes.
 pub fn default_runtime() -> Option<Arc<dyn Runtime>> {
-    #[cfg(feature = "runtime-tokio")]
+    #[cfg(all(
+        feature = "runtime-tokio",
+        not(feature = "runtime-smol"),
+        not(feature = "runtime-mock")
+    ))]
     {
         Some(Arc::new(TokioRuntime))
     }
-    #[cfg(all(not(feature = "runtime-tokio"), feature = "runtime-smol"))]
+    #[cfg(all(
+        not(feature = "runtime-tokio"),
+        feature = "runtime-smol",
+        not(feature = "runtime-mock")
+    ))]
     {
         Some(Arc::new(SmolRuntime))
     }
-    #[cfg(not(any(feature = "runtime-tokio", feature = "runtime-smol")))]
+    #[cfg(all(
+        not(feature = "runtime-tokio"),
+        not(feature = "runtime-smol"),
+        feature = "runtime-mock"
+    ))]
+    {
+        Some(Arc::new(MockRuntime::new()))
+    }
+    #[cfg(not(any(
+        feature = "runtime-tokio",
+        feature = "runtime-smol",
+        feature = "runtime-mock"
+    )))]
     {
         None
     }
```

---

### Incident Patch 15: `f9100a7b` (2026-07-31)
**Commit Message**: add build features in CI

**File**: `.github/workflows/cargo.yml` (modified, +30/-5)
```diff
@@ -2,9 +2,9 @@ name: cargo
 
 on:
   push:
-    branches: [master, v0.17.x]
+    branches: [ master, v0.17.x ]
   pull_request:
-    branches: [master, v0.17.x]
+    branches: [ master, v0.17.x ]
 
 concurrency:
   group: ${{ github.workflow }}-${{ github.ref }}
@@ -14,11 +14,11 @@ env:
   CARGO_TERM_COLOR: always
 
 jobs:
-  build:
-    name: Build
+  build-os:
+    name: Build (${{ matrix.os }})
     strategy:
       matrix:
-        os: ['ubuntu-latest', 'macos-latest', 'windows-latest']
+        os: [ 'ubuntu-latest', 'macos-latest', 'windows-latest' ]
     runs-on: ${{ matrix.os }}
     steps:
       - uses: actions/checkout@v3
@@ -27,6 +27,31 @@ jobs:
       - name: Build
         run: cargo build --verbose
 
+  build-features:
+    # The runtime features are additive and each only decides whether a built-in `Runtime`
+    # type exists, so a build with any one of them — or with none at all — must compile.
+    # `--no-default-features` with no runtime is the configuration an application supplying
+    # its own `Runtime` uses; nothing in the library may reach for a built-in.
+    #
+    # Feature resolution is platform-independent, so one OS is enough here; the `build` job
+    # above still covers Linux/macOS/Windows for the default feature set.
+    name: Build (${{ matrix.features }})
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        features:
+          - '--no-default-features'
+          - '--no-default-features --features runtime-tokio'
+          - '--no-default-features --features runtime-smol'
+          - '--no-default-features --features runtime-mock'
+    steps:
+      - uses: actions/checkout@v3
+        with:
+          submodules: recursive
+      - name: Build
+        run: cargo build --verbose ${{ matrix.features }}
+
   test:
     name: Test
     strategy:
```

#### Recent Merged Pull Requests:
- **PR #917** (2026-10-03): fix(runtime): don't block the smol executor in connect_tcp (@lovon-spec)
- **PR #913** (2026-09-27): [v0.20.x] fix: give the driver a brief chance to release TURN allocations on close() (#903) (@yapprtc)
- **PR #912** (2026-09-27): [v0.21.x] fix: release TURN allocations on close() on both runtimes (#903) (@yapprtc)
- **PR #911** (2026-09-27): fix: release TURN allocations on close() on both runtimes (#903) (@yapprtc)
- **PR #910** (2026-09-26): fix(stun_gatherer): complete gathering when a STUN server does not answer (@yapprtc)
- **PR #909** (2026-09-26): fix(rtp_transceiver): break the PeerConnectionRef reference cycle (#906) (@yapprtc)
- **PR #908** (2026-09-26): fix(data_channel): advertise and honour receive max-message-size (@coleleavitt)
- **PR #905** (2026-09-26): fix(0.21): backport pre-registration data-channel event retention (@kaito-harry)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
