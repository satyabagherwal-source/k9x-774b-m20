# Forensic Learning Record (Deep Inspection): 1jehuang/jcode

> **Canonical Artifact**: `07_PROJECT_LEARNING/1jehuang-jcode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/1jehuang/jcode](https://github.com/1jehuang/jcode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:22:14.392Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1jehuang/jcode`
- **Description**: The most RAM efficient harness
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 20238 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `assets/demos/pelican-bike/pelican.js`
```
(() => {
  'use strict';

  const canvas = document.querySelector('#pelican-canvas');
  const ctx = canvas.getContext('2d');
  const W = 1600;
  const H = 900;
  const LOOP = 12;
  const TAU = Math.PI * 2;

  const C = {
    ink: '#173642',
    deepInk: '#102b35',
    cream: '#fff7df',
    paper: '#f8edcf',
    coral: '#e8644a',
    coralDark: '#c84e3d',
    peach: '#ee9a72',
    apricot: '#f2b07e',
    sun: '#f7d386',
    sea: '#337f88',
    seaDeep: '#245e68',
    seaLight: '#7bb9ae',
    mint: '#a7c6ae',
    grass: '#2e6663',
    gold: '#e6aa52'
  };

  let cssWidth = innerWidth;
  let cssHeight = innerHeight;
  let dpr = 1;
  let startedAt = performance.now();
  const requestedTime = Number(new URLSearchParams(location.search).get('t'));
  let manualTime = Number.isFinite(requestedTime) && location.search.includes('t=')
    ? ((requestedTime % LOOP) + LOOP) % LOOP
    : null;

  const mod = (n, m) => ((n % m) + m) % m;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  function resize() {
    cssWidth = innerWidth;
    cssHeight = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }

  function path(fill, stroke = null, width = 1) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function line(points, color, width, close = false) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (close) ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function ellipse(x, y, rx, ry, fill, rotation = 0, stroke = null, width = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
    path(fill, stroke, width);
  }

  function circle(x, y, r, fill, stroke = null, width = 1) {
    ellipse(x, y, r, r, fill, 0, stroke, width);
  }

  function drawSky(p, cycle) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 620);
    gradient.addColorStop(0, '#e77a5f');
    gradient.addColorStop(.46, '#ef9c75');
    gradient.addColorStop(1, '#f4c696');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(1268, 178, 20, 1268, 178, 226);
    halo.addColorStop(0, 'rgba(255,244,190,.9)');
    halo.addColorStop(.34, 'rgba(248,214,139,.45)');
    halo.addColorStop(1, 'rgba(248,214,139,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(1020, -60, 500, 500);
    circle(1268, 178, 84, C.sun);
    circle(1268, 178, 67, '#f9dda0');

    ctx.globalAlpha = .12;
    for (let i = 0; i < 7; i++) {
      const y = 96 + i * 49;
      const drift = Math.sin(cycle + i * .8) * (8 + i * 2);
      ctx.beginPath();
      ctx.moveTo(560 + drift, y);
      ctx.bezierCurveTo(765, y - 30, 960, y + 20, 1160, y - 8);
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    drawCloud(705 + Math.sin(cycle) * 24, 158, .82, .38);
    drawCloud(1425 + Math.sin(cycle + 2) * 18, 304, .54, .26);
    drawCloud(410 + Math.sin(cycle + 4) * 14, 358, .42, .18);

    ctx.globalAlpha = .7;
    drawBird(795 + Math.sin(cycle) * 10, 277, 1.1, cycle * 3);
    drawBird(845 + Math.sin(cycle + 1) * 8, 307, .7, cycle * 3 + 1);
    drawBird(1470 + Math.sin(cycle + 2) * 8, 232, .55, cycle * 3 + 2);
    ctx.globalAlpha = 1;
  }

  function drawCloud(x, y, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.moveTo(-112, 24);
    ctx.bezierCurveTo(-104, -7, -72, -16, -50, -5);
    ctx.bezierCurveTo(-39, -54, 31, -65, 52, -15);
    ctx.bezierCurveTo(83, -29, 116, -2, 110, 26);
    ctx.bezierCurveTo(58, 38, -48, 39, -112, 24);
    ctx.fill();
    ctx.restore();
  }

  function drawBird(x, y, scale, flap) {
    const wing = Math.sin(flap) * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(-22, 2);
    ctx.quadraticCurveTo(-10, -11 - wing, 0, 0);
    ctx.quadraticCurveTo(11, -11 + wing, 24, 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawSea(p, cycle) {
    const sea = ctx.createLinearGradient(0, 420, 0, 650);
    sea.addColorStop(0, C.seaLight);
    sea.addColorStop(.48, C.sea);
    sea.addColorStop(1, C.seaDeep);
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(0, 436);
    ctx.bezierCurveTo(320, 418, 595, 452, 900, 431);
    ctx.bezierCurveTo(1170, 414, 1375, 440, 1600, 424);
    ctx.lineTo(1600, 680);
    ctx.lineTo(0, 680);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 420, W, 250);
    ctx.clip();

    const shimmer = ctx.createLinearGradient(1130, 430, 1390, 640);
    shimmer.addColorStop(0, 'rgba(255,236,174,.42)');
    shimmer.addColorStop(1, 'rgba(255,236,174,0)');
    ctx.fillStyle = shimmer;
    ctx.beginPath();
    ctx.moveTo(1215, 430);
    ctx.lineTo(1330, 430);
    ctx.lineTo(1445, 670);
    ctx.lineTo(1030, 670);
    ctx.closePath();
    ctx.fill();

    for (let row = 0; row < 8; row++) {
      const y = 459 + row * 26;
      const amp = 3 + row * .35;
      const phase = cycle * (1 + row);
      ctx.beginPath();
      for (let x = -180; x <= W + 180; x += 10) {
        const yy = y + Math.sin(x * .035 + phase + row) * amp;
        if (x === -180) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = row % 2 ? 'rgba(255,247,223,.2)' : 'rgba(255,247,223,.38)';
      ctx.lineWidth = row % 3 === 0 ? 3 : 1.6;
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#3a6e69';
    ctx.beginPath();
    ctx.moveTo(0, 503);
    ctx.bezierCurveTo(145, 462, 266, 484, 375, 500);
    ctx.bezierCurveTo(505, 520, 575, 493, 706, 487);
    ctx.lineTo(706, 535);
    ctx.lineTo(0, 550);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#285954';
    ctx.beginPath();
    ctx.moveTo(1374, 476);
    ctx.bezierCurveTo(1460, 442, 1530, 450, 1600, 430);
    ctx.lineTo(1600, 550);
    ctx.lineTo(1408, 536);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoad(p, cycle) {
    ctx.fillStyle = '#e6b178';
    ctx.beginPath();
    ctx.moveTo(0, 609);
    ctx.bezierCurveTo(350, 570, 610, 620, 900, 596);
    ctx.bezierCurveTo(1190, 573, 1415, 586, 1600, 565);
    ctx.lineTo(1600, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 624);
    ctx.bezierCurveTo(350, 585, 610, 635, 900, 611);
    ctx.bezierCurveTo(1190, 588, 1415, 601, 1600, 580);
    ctx.strokeStyle = 'rgba(255,247,223,.72)';
    ctx.lineWidth = 7;
    ctx.stroke();

    const travel = p * 3600;
    ctx.fillStyle = 'rgba(255,247,223,.62)';
    for (let x = -400; x < W + 400; x += 300) {
      const px = mod(x - travel, 2100) - 260;
      ctx.save();
      ctx.translate(px, 790);
      ctx.transform(1, 0, -.18, 1, 0, 0);
      ctx.fillRect(0, 0, 118, 10);
      ctx.restore();
    }

    ctx.globalAlpha = .1;
    for (let i = 0; i < 14; i++) {
      const x = mod(i * 173 - travel * .5, 1800) - 150;
      ellipse(x, 700 + (i % 4) * 47, 48 + (i % 3) * 13, 4, C.ink, -.08);
    }
    ctx.globalAlpha = 1;

    drawRoadsidePlants(travel, cycle);
  }

  function drawRoadsidePlants(travel, cycle) {
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const x = mod(i * 119 - travel * .5, 1800) - 100;
      const y = 608 + (i % 4) * 8;
      const scale = .48 + (i % 5) * .08;
      const sway = Math.sin(cycle * 3 + i) * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.rotate(sway * Math.PI
```

### Core Architecture Module: `crates/jcode-agent-runtime/src/lib.rs`
```
use std::sync::Arc;

/// A soft interrupt message queued for injection at the next safe point.
#[derive(Debug, Clone)]
pub struct SoftInterruptMessage {
    pub content: String,
    pub images: Vec<(String, String)>,
    /// If true, can skip remaining tools when injected at point C.
    pub urgent: bool,
    pub source: SoftInterruptSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SoftInterruptSource {
    User,
    System,
    BackgroundTask,
}

/// Thread-safe soft interrupt queue that can be accessed without holding the agent lock.
pub type SoftInterruptQueue = Arc<std::sync::Mutex<Vec<SoftInterruptMessage>>>;

/// Signal to move the currently executing tool to background.
/// Uses std::sync so it can be set without async from outside the agent lock.
pub type BackgroundToolSignal = Arc<std::sync::atomic::AtomicBool>;

/// Signal to gracefully stop generation.
pub type GracefulShutdownSignal = Arc<std::sync::atomic::AtomicBool>;

/// Async-aware interrupt signal that combines AtomicBool (sync read) with
/// tokio::Notify (async wake). Eliminates spin-loops during tool execution.
#[derive(Clone)]
pub struct InterruptSignal {
    flag: Arc<std::sync::atomic::AtomicBool>,
    /// Monotonic fire counter. Lets owners of a timed/deferred reset detect
    /// that a *newer* fire landed in the meantime and skip the reset instead
    /// of erasing a cancel the target has not observed yet (issue #428).
    epoch: Arc<std::sync::atomic::AtomicU64>,
    notify: Arc<tokio::sync::Notify>,
}

impl InterruptSignal {
    pub fn new() -> Self {
        Self {
            flag: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            epoch: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            notify: Arc::new(tokio::sync::Notify::new()),
        }
    }

    pub fn fire(&self) {
        self.epoch.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        self.flag.store(true, std::sync::atomic::Ordering::SeqCst);
        self.notify.notify_waiters();
    }

    pub fn is_set(&self) -> bool {
        self.flag.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub fn reset(&self) {
        self.flag.store(false, std::sync::atomic::Ordering::SeqCst);
    }

    /// Current fire epoch. Capture this right after a [`fire`](Self::fire) to
    /// later reset only that specific fire via
    /// [`reset_if_epoch`](Self::reset_if_epoch).
    pub fn epoch(&self) -> u64 {
        self.epoch.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Reset the signal only if no newer [`fire`](Self::fire) happened since
    /// `epoch` was captured. Returns `true` when the reset was applied.
    ///
    /// If a racing fire lands between the epoch check and the reset, the
    /// fire is restored (flag re-set and waiters re-notified) so no cancel
    /// is ever silently erased.
    pub fn reset_if_epoch(&self, epoch: u64) -> bool {
        if self.epoch.load(std::sync::atomic::Ordering::SeqCst) != epoch {
            return false;
        }
        self.flag.store(false, std::sync::atomic::Ordering::SeqCst);
        if self.epoch.load(std::sync::atomic::Ordering::SeqCst) != epoch {
            // A newer fire raced with the reset; restore it.
            self.flag.store(true, std::sync::atomic::Ordering::SeqCst);
            self.notify.notify_waiters();
            return false;
        }
        true
    }

    pub async fn notified(&self) {
        let mut notified = std::pin::pin!(self.notify.notified());
        // Explicitly register this waiter with the Notify before checking the
        // flag. `notify_waiters()` (used by `fire()`) wakes only registered
        // waiters; current tokio registers a `notified()` future at creation,
        // but `enable()` makes the registration explicit rather than relying
        // on that version-specific guarantee, since a lost wakeup here parks
        // the cancel path (agent stream loop, tool-wait select) until an
        // unrelated event arrives (issue #428).
        notified.as_mut().enable();
        if self.is_set() {
            return;
        }
        notified.await;
    }

    pub fn as_atomic(&self) -> Arc<std::sync::atomic::AtomicBool> {
        Arc::clone(&self.flag)
    }

    /// True when `other` is a clone of this signal (shares the same state).
    /// Used by cancel fan-out to avoid double-firing the same signal and by
    /// diagnostics that need to detect stale signal instances (issue #428).
    pub fn same_instance(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.flag, &other.flag)
    }
}

impl Default for InterruptSignal {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct StreamError {
    pub message: String,
    pub retry_after_secs: Option<u64>,
}

impl StreamError {
    pub fn new(message: String, retry_after_secs: Option<u64>) -> Self {
        Self {
            message,
            retry_after_secs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    /// Documents the tokio semantics `InterruptSignal::notified()` relies on:
    /// current tokio guarantees a `notified()` future receives wakeups from
    /// `notify_waiters()` from the moment it is *created*, even before its
    /// first poll. The explicit `enable()` in `notified()` makes that
    /// registration explicit instead of relying on the version-specific
    /// creation-time guarantee (hardening for issue #428).
    #[tokio::test]
    async fn notified_future_receives_notify_waiters_from_creation() {
        let notify = tokio::sync::Notify::new();

        // Created before the notification, not yet polled: must be woken.
        let created_before = notify.notified();
        notify.notify_waiters();
        tokio::time::timeout(Duration::from_millis(100), created_before)
            .await
            .expect("a notified() future created before notify_waiters() must be woken");

        // Created after the notification: must NOT be woken (notify_waiters
        // stores no permit). This is why fire() also sets the atomic flag.
        let created_after = notify.notified();
        assert!(
            tokio::time::timeout(Duration::from_millis(50), created_after)
                .await
                .is_err(),
            "notify_waiters() must not store a permit for future waiters"
        );
    }

    /// Probabilistic race hammer for issue #428: `fire()` must never be lost
    /// regardless of where the waiter is between creating the `notified()`
    /// future and its first poll. The agent stream loop recreates this future
    /// per stream event, so under fast token streams the pre-fix race made
    /// Esc/Ctrl+C cancels appear to be ignored.
    #[test]
    fn fire_never_loses_wakeup_while_notified_races() {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_time()
            .build()
            .expect("runtime");
        rt.block_on(async {
            for i in 0..2000 {
                let signal = InterruptSignal::new();
                let waiter = {
                    let signal = signal.clone();
                    tokio::spawn(async move { signal.notified().await })
                };
                // Fire concurrently: the waiter may be anywhere between
                // future creation and first poll.
                signal.fire();
                tokio::time::timeout(Duration::from_secs(2), waiter)
                    .await
                    .unwrap_or_else(|_| {
                        panic!(
                            "lost wakeup on iteration {i}: notified() missed fire() (issue #428)"
                        )
                    })
                    .expect("waiter task must not panic");
            }
        });
    }

    /// A fire() that happened before notified() is observed immediately.
    #[tokio::test]
    async fn notified_returns_immediately_when_already_fired
```

### Core Architecture Module: `crates/jcode-ambient-types/src/lib.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum UsageSource {
    User,
    Ambient,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub timestamp: DateTime<Utc>,
    pub source: UsageSource,
    pub tokens_input: u32,
    pub tokens_output: u32,
    pub provider: String,
}

impl UsageRecord {
    pub fn total_tokens(&self) -> u64 {
        self.tokens_input as u64 + self.tokens_output as u64
    }
}

#[derive(Debug, Clone)]
pub struct RateLimitInfo {
    pub limit_tokens: Option<u64>,
    pub remaining_tokens: Option<u64>,
    pub limit_requests: Option<u64>,
    pub remaining_requests: Option<u64>,
    pub reset_at: Option<DateTime<Utc>>,
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent.rs`
```
#![cfg_attr(test, allow(clippy::await_holding_lock))]

mod compaction;
mod environment;
mod inline_tail;
mod interrupts;
mod messages;
#[cfg(test)]
mod model_usage_tests;
mod prompting;
mod provider;
mod response_recovery;
mod status;
mod streaming;
mod tools;
mod turn_execution;
mod turn_loops;
mod turn_streaming_mpsc;
mod utils;

use self::streaming::{send_stream_keepalive_mpsc, stream_keepalive_ticker};
use self::tools::{
    cap_sdk_tool_content_for_history, cap_tool_output_for_history, print_tool_summary,
    tool_output_side_pane_images, tool_output_to_content_blocks,
};
use self::utils::trace_enabled;
use crate::build;
use crate::bus::{Bus, BusEvent, SubagentStatus, ToolEvent, ToolStatus};
use crate::cache_tracker::CacheTracker;
use crate::compaction::CompactionEvent;
use crate::id;
use crate::logging;
use crate::message::{
    ContentBlock, Message, Role, StreamEvent, TOOL_OUTPUT_MISSING_TEXT, ToolCall, ToolDefinition,
};
use crate::protocol::{HistoryMessage, ServerEvent};
use crate::provider::{NativeToolResult, Provider, ProviderRuntimeState};
use crate::session::{GitState, Session, SessionStatus, StoredDisplayRole, StoredMessage};
use crate::skill::SkillRegistry;
use crate::tool::{Registry, ToolContext, ToolExecutionMode};
use anyhow::Result;
use futures::StreamExt;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::io::{self, Write};
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

use interrupts::{NoToolCallOutcome, PostToolInterruptOutcome};
pub use jcode_agent_runtime::{
    BackgroundToolSignal, GracefulShutdownSignal, InterruptSignal, SoftInterruptMessage,
    SoftInterruptQueue, SoftInterruptSource, StreamError,
};

const JCODE_NATIVE_TOOLS: &[&str] = &["selfdev", "desktop_selfdev", "communicate"];
static RECOVERED_TEXT_WRAPPED_TOOL_CALLS: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(0);
static JCODE_REPO_SOURCE_STATE: LazyLock<(Option<String>, Option<bool>)> = LazyLock::new(|| {
    crate::build::get_repo_dir()
        .map(|repo_dir| {
            (
                build::current_git_hash(&repo_dir).ok(),
                build::is_working_tree_dirty(&repo_dir).ok(),
            )
        })
        .unwrap_or((None, None))
});
static WORKING_GIT_STATE_CACHE: LazyLock<StdMutex<HashMap<PathBuf, Option<GitState>>>> =
    LazyLock::new(|| StdMutex::new(HashMap::new()));
const STREAM_KEEPALIVE_PONG_ID: u64 = 0;

fn stable_hash_str(value: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

fn stable_hash_json<T: serde::Serialize + ?Sized>(value: &T) -> u64 {
    let encoded = serde_json::to_string(value).unwrap_or_default();
    stable_hash_str(&encoded)
}

fn stable_json_len<T: serde::Serialize + ?Sized>(value: &T) -> usize {
    serde_json::to_string(value)
        .map(|encoded| encoded.len())
        .unwrap_or_default()
}

fn message_hashes(messages: &[Message]) -> Vec<u64> {
    // Hash the cache-relevant projection, not the raw Message. Raw hashing
    // keys off non-transmitted metadata (timestamp, tool_duration_ms,
    // ReasoningTrace blocks, cache_control markers), which triggers spurious
    // harness:_prefix_changed KV-cache miss reports when the same message is
    // re-serialized with backfilled metadata on the next turn.
    crate::message::cache_relevant_message_hashes(messages)
}

fn kv_cache_request_event(
    messages: &[Message],
    tools: &[ToolDefinition],
    system_static: &str,
    ephemeral_messages: &[Message],
) -> ServerEvent {
    let ephemeral_hash = if ephemeral_messages.is_empty() {
        None
    } else {
        Some(stable_hash_json(ephemeral_messages))
    };
    ServerEvent::KvCacheRequest {
        system_static_hash: stable_hash_str(system_static),
        tools_hash: stable_hash_json(tools),
        messages_hash: stable_hash_json(&crate::message::cache_relevant_messages(messages)),
        message_hashes: message_hashes(messages),
        message_count: messages.len(),
        tool_count: tools.len(),
        system_static_chars: system_static.chars().count(),
        tools_json_chars: stable_json_len(tools),
        messages_json_chars: stable_json_len(messages),
        ephemeral_hash,
        ephemeral_chars: stable_json_len(ephemeral_messages),
        ephemeral_message_count: ephemeral_messages.len(),
    }
}

impl Agent {
    /// Provider identity used for cache retention lookups. Generic OpenAI is
    /// only refined when the credential mode is explicitly pinned.
    fn kv_cache_provider_identity(&self) -> String {
        let name = self.provider.name().to_string();
        if !name.eq_ignore_ascii_case("openai") {
            return name;
        }
        match self.provider.active_explicit_credential() {
            Some(jcode_provider_core::ResolvedCredential::ApiKey) => "openai-api".into(),
            Some(jcode_provider_core::ResolvedCredential::Oauth) => "openai-oauth".into(),
            None => name,
        }
    }

    fn begin_kv_cache_monitor_request(&mut self, event: &ServerEvent, model: &str) {
        let ServerEvent::KvCacheRequest {
            system_static_hash,
            tools_hash,
            messages_hash,
            message_hashes,
            message_count,
            tool_count,
            ..
        } = event
        else {
            return;
        };
        let provider = self.kv_cache_provider_identity();
        let route = crate::kv_cache_monitor::RequestRoute {
            cache_ttl_secs: crate::provider::cache_ttl_for_provider_model(&provider, Some(model)),
            ttl_is_estimate: crate::provider::cache_ttl_is_estimate(&provider),
            provider,
            model: model.to_string(),
            upstream_provider: self.last_upstream_provider.clone(),
        };
        let signature = crate::kv_cache_monitor::RequestSignature {
            system_static_hash: *system_static_hash,
            tools_hash: *tools_hash,
            tool_count: *tool_count,
            messages_hash: *messages_hash,
            message_hashes: message_hashes.clone(),
            message_count: *message_count,
        };
        self.kv_cache_monitor.begin_request(route, signature);
    }

    /// Classify the completed request's usage. Returns the event to send when
    /// the request missed the KV cache.
    fn finish_kv_cache_monitor_request(
        &mut self,
        input: u64,
        cache_read: Option<u64>,
        cache_creation: Option<u64>,
    ) -> Option<ServerEvent> {
        let effective = self.effective_context_tokens_from_usage(input, cache_read, cache_creation);
        let miss = self
            .kv_cache_monitor
            .finish_request(effective, cache_read)?;
        logging::warn(&format!(
            "KV_CACHE_MISS session={} reason={} harness_caused={} missed={} expected={} read={} documented={:?}",
            self.session.id,
            miss.reason.id(),
            miss.reason.harness_caused(),
            miss.missed_tokens,
            miss.expected_tokens,
            miss.read_tokens,
            miss.documented_cause,
        ));
        Some(ServerEvent::KvCacheMiss {
            reason: miss.reason.id().to_string(),
            harness_caused: miss.reason.harness_caused(),
            missed_tokens: miss.missed_tokens,
            expected_tokens: miss.expected_tokens,
            read_tokens: miss.read_tokens,
            message: miss.message(),
            documented_cause: miss.documented_cause,
        })
    }
}

fn log_agent_provider_stream_lifecycle(
    level: logging::LogLevel,
    agent: &Agent,
    phase: &str,
    api_start: Instant,
    fields: Vec<(&str, String)>,
) {
    let mut owned = vec![
        ("phase".to_string(), phase.to_string()),
        ("provider".to_string(), agent.provider.name().to_string()),
        ("model".to_string(), agent.provider.model()),
  
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/compaction.rs`
```
use super::*;

impl Agent {
    pub(super) fn note_compaction_applied(&mut self) {
        self.cache_tracker.reset();
        self.kv_cache_monitor.reset();
        self.locked_tools = None;
        self.provider_session_id = None;
        self.session.provider_session_id = None;
    }

    pub fn poll_compaction_completion_event(&mut self) -> Option<CompactionEvent> {
        let provider_messages = self.session.messages_for_provider();
        let compaction = self.registry.compaction();
        let event = match compaction.try_write() {
            Ok(mut manager) => {
                let event = manager.poll_compaction_event_with(&provider_messages);
                if event.is_some() {
                    self.sync_session_compaction_state_from_manager(&manager);
                }
                event
            }
            Err(_) => return None,
        };

        if event.is_some() {
            self.note_compaction_applied();
            self.persist_session_best_effort("compaction completion");
        }

        event
    }

    pub fn request_manual_compaction(&mut self) -> (String, bool) {
        if !self.provider.supports_compaction() {
            return (
                "Manual compaction is not available for this provider.".to_string(),
                false,
            );
        }

        let provider = self.provider.fork();
        let messages = self.session.messages_for_provider();
        let compaction = self.registry.compaction();

        match compaction.try_write() {
            Ok(mut manager) => {
                let stats = manager.stats_with(&messages);
                let status_msg = format!(
                    "**Context Status:**\n\
                    • Messages: {} (active), {} (total history)\n\
                    • Token usage: ~{}k (estimate ~{}k) / {}k ({:.1}%)\n\
                    • Has summary: {}\n\
                    • Compacting: {}",
                    stats.active_messages,
                    stats.total_turns,
                    stats.effective_tokens / 1000,
                    stats.token_estimate / 1000,
                    manager.token_budget() / 1000,
                    stats.context_usage * 100.0,
                    if stats.has_summary { "yes" } else { "no" },
                    if stats.is_compacting {
                        "in progress..."
                    } else {
                        "no"
                    }
                );

                match manager.force_compact_with(&messages, provider) {
                    Ok(()) => (
                        format!(
                            "{}\n\n📦 **Compacting context** (manual) — summarizing older messages in the background to stay within the context window.\n\
                            The summary will be applied automatically when ready.",
                            status_msg
                        ),
                        true,
                    ),
                    Err(reason) => (
                        format!("{status_msg}\n\n⚠ **Cannot compact:** {reason}"),
                        false,
                    ),
                }
            }
            Err(_) => (
                "⚠ Cannot access compaction manager (lock held)".to_string(),
                false,
            ),
        }
    }

    fn is_context_limit_error(error: &str) -> bool {
        let lower = error.to_lowercase();
        lower.contains("context length")
            || lower.contains("context window")
            || lower.contains("maximum context")
            || lower.contains("max context")
            || lower.contains("token limit")
            || lower.contains("too many tokens")
            || lower.contains("prompt is too long")
            || lower.contains("input is too long")
            || lower.contains("request too large")
            || lower.contains("length limit")
            || lower.contains("maximum tokens")
            || (lower.contains("exceeded") && lower.contains("tokens"))
    }

    /// Best-effort emergency recovery after a context-limit error.
    ///
    /// Performs a synchronous hard compaction and resets provider session state,
    /// allowing the caller to retry the same turn immediately.
    pub(super) fn try_auto_compact_after_context_limit(&mut self, error: &str) -> bool {
        if crate::provider::openai_request::is_openai_encrypted_content_too_large_error(error)
            && self.try_recover_oversized_openai_native_compaction()
        {
            return true;
        }
        // A provider HTTP 413 ("request too large") is a *byte-size* failure
        // driven by inline base64 images, not a token-context overflow. Token
        // accounting deliberately undercounts images, so ordinary compaction
        // would not shrink the payload and the retry would 413 again. Strip
        // oversized images first.
        if self.try_recover_after_payload_too_large(error) {
            return true;
        }
        if !Self::is_context_limit_error(error) {
            return false;
        }
        if !self.provider.supports_compaction() {
            return false;
        }

        let context_limit = self.provider.context_window() as u64;
        let compaction = self.registry.compaction();

        let (dropped, usage_pct) = match compaction.try_write() {
            Ok(mut manager) => {
                let (dropped, usage_pct) = {
                    let all_messages = self.session.provider_messages();
                    manager.update_observed_input_tokens(context_limit);
                    let usage_pct = manager.context_usage_with(all_messages) * 100.0;
                    let dropped = match manager.hard_compact_with(all_messages) {
                        Ok(dropped) => dropped,
                        Err(reason) => {
                            logging::warn(&format!(
                                "Context-limit auto-recovery failed: hard compact failed ({})",
                                reason
                            ));
                            return false;
                        }
                    };
                    (dropped, usage_pct)
                };
                self.sync_session_compaction_state_from_manager(&manager);
                (dropped, usage_pct)
            }
            Err(_) => {
                logging::warn("Context-limit auto-recovery skipped: compaction manager lock busy");
                return false;
            }
        };

        self.cache_tracker.reset();
        self.kv_cache_monitor.reset();
        self.locked_tools = None;
        self.provider_session_id = None;
        self.session.provider_session_id = None;

        logging::warn(&format!(
            "Context limit exceeded; auto-compacted and retrying (dropped {} messages, usage was {:.1}%)",
            dropped, usage_pct
        ));
        crate::runtime_memory_log::emit_event(
            crate::runtime_memory_log::RuntimeMemoryLogEvent::new(
                "auto_compaction_applied",
                "context_limit_auto_compaction",
            )
            .with_session_id(self.session.id.clone())
            .with_detail(format!(
                "dropped_messages={dropped},usage_pct={usage_pct:.1}"
            ))
            .force_attribution(),
        );

        true
    }

    /// Best-effort recovery after a provider HTTP 413 "request too large" error.
    ///
    /// This failure is caused by the serialized request body (dominated by inline
    /// base64 images) exceeding the provider's size cap, which is independent of
    /// the token context window. We strip oversized images from the persisted
    /// transcript, oldest-first, down to a conservative byte budget and reset the
    /// provider session/cache so the caller can retry the same turn immediately.
    fn try_recover_after_payload_too_large(&mut self, error: &str) -> bool {
        if !crate::compaction::is_request_payload_too_large_error(error) {
         
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/environment.rs`
```
use super::{Agent, JCODE_REPO_SOURCE_STATE, WORKING_GIT_STATE_CACHE};
use crate::logging;
use crate::session::{EnvSnapshot, GitState};
use chrono::Utc;
use std::path::Path;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum EnvSnapshotDetail {
    Minimal,
    Full,
}

pub(super) fn cached_git_state_for_dir(
    dir: &Path,
    git_state_for_dir: impl Fn(&Path) -> Option<GitState>,
) -> Option<GitState> {
    let cache_key = dir.to_path_buf();
    if let Ok(cache) = WORKING_GIT_STATE_CACHE.lock()
        && let Some(state) = cache.get(&cache_key)
    {
        return state.clone();
    }

    let state = git_state_for_dir(dir);
    if let Ok(mut cache) = WORKING_GIT_STATE_CACHE.lock() {
        cache.insert(cache_key, state.clone());
    }
    state
}

impl Agent {
    /// Set logging context for this agent's session/provider
    pub(super) fn set_log_context(&self) {
        logging::set_session(&self.session.id);
        // Log the profile this session actually talks to. `name()` is the
        // stable machine id for the provider class, which the multiplexing
        // slot reports as `OpenRouter` (a concrete runtime instance reports
        // `openrouter`); that slot also serves every direct OpenAI-compatible
        // profile, so it tagged DeepSeek sessions `prv:OpenRouter` /
        // `prv:openrouter` (issue #1286).
        logging::set_provider_info(&self.provider.display_name(), &self.provider.model());
    }

    /// Record a lightweight environment snapshot for post-mortem debugging
    pub(super) fn log_env_snapshot(&mut self, reason: &str) {
        let snapshot = self.build_env_snapshot(reason, self.env_snapshot_detail());
        self.session.record_env_snapshot(snapshot.clone());
        if !self.session.messages.is_empty() {
            self.persist_session_best_effort("environment snapshot");
        }
        if let Ok(json) = serde_json::to_string(&snapshot) {
            logging::info(&format!("ENV_SNAPSHOT {}", json));
        } else {
            logging::info("ENV_SNAPSHOT {}");
        }
    }

    pub(super) fn env_snapshot_detail(&self) -> EnvSnapshotDetail {
        if self.session.visible_conversation_message_count() == 0 {
            EnvSnapshotDetail::Minimal
        } else {
            EnvSnapshotDetail::Full
        }
    }

    pub(super) fn build_env_snapshot(
        &self,
        reason: &str,
        detail: EnvSnapshotDetail,
    ) -> EnvSnapshot {
        let (jcode_git_hash, jcode_git_dirty) = match detail {
            EnvSnapshotDetail::Full => JCODE_REPO_SOURCE_STATE.clone(),
            EnvSnapshotDetail::Minimal => (None, None),
        };

        let working_dir = self.session.working_dir.clone();
        let working_git = match detail {
            EnvSnapshotDetail::Full => working_dir.as_deref().and_then(|dir| {
                cached_git_state_for_dir(Path::new(dir), super::utils::git_state_for_dir)
            }),
            EnvSnapshotDetail::Minimal => None,
        };

        EnvSnapshot {
            captured_at: Utc::now(),
            reason: reason.to_string(),
            session_id: self.session.id.clone(),
            working_dir,
            provider: self.provider.name().to_string(),
            model: self.provider.model().to_string(),
            jcode_version: jcode_build_meta::version().to_string(),
            jcode_git_hash,
            jcode_git_dirty,
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            pid: std::process::id(),
            is_selfdev: self.session.is_self_dev(),
            is_debug: self.session.is_debug,
            is_canary: self.session.is_canary,
            testing_build: self.session.testing_build.clone(),
            working_git,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::{Message, ToolDefinition};
    use crate::provider::{EventStream, Provider};
    use crate::tool::Registry;
    use anyhow::Result;
    use async_trait::async_trait;
    use std::sync::Arc;

    /// A stand-in for the multiplexing OpenRouter slot: the machine-facing
    /// `name()` is the transport, while the runtime it executes is a direct
    /// OpenAI-compatible profile. A concrete runtime instance reports the
    /// lowercase `openrouter` instead; both tag the same sessions.
    struct MultiplexedSlotProvider;

    #[async_trait]
    impl Provider for MultiplexedSlotProvider {
        async fn complete(
            &self,
            _messages: &[Message],
            _tools: &[ToolDefinition],
            _system: &str,
            _resume_session_id: Option<&str>,
        ) -> Result<EventStream> {
            Err(anyhow::anyhow!(
                "the log context test never completes a call"
            ))
        }

        fn name(&self) -> &str {
            "OpenRouter"
        }

        fn display_name(&self) -> String {
            "DeepSeek".to_string()
        }

        fn fork(&self) -> Arc<dyn Provider> {
            Arc::new(MultiplexedSlotProvider)
        }
    }

    /// The log prefix must name the profile the session talks to. `name()` is
    /// the transport slot that also serves every direct OpenAI-compatible
    /// profile, so it tagged DeepSeek sessions as `prv:openrouter` (issue #1286).
    #[tokio::test]
    async fn log_context_names_the_profile_not_the_transport_slot() {
        // `Agent::new` only builds in-memory session state, so the test needs
        // no `JCODE_HOME`, and it must not set one either: the crate's tests
        // run in parallel.
        let provider: Arc<dyn Provider> = Arc::new(MultiplexedSlotProvider);
        let registry = Registry::new(provider.clone()).await;
        let agent = Agent::new(provider, registry);

        agent.set_log_context();

        let context = logging::current_context_snapshot();
        assert_eq!(
            context.provider.as_deref(),
            Some("DeepSeek"),
            "the log prefix must name the profile, not the slot"
        );
    }
}

```

### Core Architecture Module: `crates/jcode-app-core/src/agent/inline_tail.rs`
```
//! Rolling live-output tail for inline swarm workers.
//!
//! The coordinator's inline gallery/dock renders a small viewport of each
//! worker's recent activity. Streaming only the in-progress assistant text
//! had two failure modes:
//!
//! 1. Workers spend most wall-clock time inside tool calls, during which no
//!    text streams, so the viewport froze on stale prose for the duration.
//! 2. `text_content` resets on every API call, so the viewport blanked at
//!    each turn/continuation boundary.
//!
//! [`InlineTailBuffer`] fixes both: it keeps a rolling, capped buffer of
//! *committed* activity lines (finished text segments and tool markers) that
//! survives across turns, plus the current *live* streaming text segment.
//! Tool executions are interleaved as `⚙ name · summary` markers, updated in
//! place with a duration or error state on completion.

use std::collections::VecDeque;

/// Max committed lines retained (matches the gallery viewport budget).
const MAX_LINES: usize = 14;
/// Max total characters in the rendered tail (bus payload cap).
const MAX_CHARS: usize = 1400;
/// Max characters of a tool marker's input summary.
const MAX_SUMMARY_CHARS: usize = 60;

/// Rolling tail of a worker's recent activity: committed lines (text +
/// tool markers) plus the live in-progress assistant text.
#[derive(Debug, Default)]
pub(crate) struct InlineTailBuffer {
    /// Finished activity lines, oldest first, capped to [`MAX_LINES`].
    committed: VecDeque<String>,
    /// In-progress assistant text for the current stream (replaced wholesale
    /// on every delta, committed at message end, discarded on rollback).
    live: String,
    /// Whether the last committed line is an in-flight tool marker that
    /// [`Self::finish_tool`] should update in place.
    pending_tool_marker: bool,
}

impl InlineTailBuffer {
    /// Replace the live streaming text with the accumulated `text` so far.
    pub(crate) fn set_live(&mut self, text: &str) {
        self.live.clear();
        self.live.push_str(text);
    }

    /// Commit the live text into the rolling buffer (end of a message) and
    /// clear it. Empty/whitespace-only live text is discarded.
    pub(crate) fn commit_live(&mut self) {
        let live = std::mem::take(&mut self.live);
        for line in live.lines().filter(|l| !l.trim().is_empty()) {
            self.push_committed(line.to_string());
        }
    }

    /// Discard the live text (mid-stream retry rollback replays from the top).
    pub(crate) fn clear_live(&mut self) {
        self.live.clear();
    }

    /// Record a tool execution starting. Any live text is committed first so
    /// ordering in the tail matches what actually happened.
    pub(crate) fn start_tool(&mut self, name: &str, input: &serde_json::Value) {
        self.commit_live();
        let summary = tool_marker_summary(name, input);
        let marker = if summary.is_empty() {
            format!("⚙ {name}")
        } else {
            format!("⚙ {name} · {summary}")
        };
        self.push_committed(marker);
        self.pending_tool_marker = true;
    }

    /// Record the in-flight tool finishing, updating its marker in place with
    /// a duration (and error flag). If the marker was already evicted by
    /// buffer pressure, this is a no-op.
    pub(crate) fn finish_tool(&mut self, elapsed_secs: f64, is_error: bool) {
        if !self.pending_tool_marker {
            return;
        }
        self.pending_tool_marker = false;
        if let Some(last) = self.committed.back_mut() {
            let status = if is_error { " ✗" } else { "" };
            last.push_str(&format!(" ({}){status}", humanize_secs(elapsed_secs)));
        }
    }

    /// Render the tail for the bus: committed lines then live lines, bounded
    /// to the last [`MAX_LINES`] lines / [`MAX_CHARS`] chars.
    pub(crate) fn render(&self) -> String {
        let live_lines = self
            .live
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect::<Vec<_>>();
        let mut lines: Vec<&str> = self
            .committed
            .iter()
            .map(String::as_str)
            .chain(live_lines)
            .collect();
        if lines.len() > MAX_LINES {
            lines.drain(..lines.len() - MAX_LINES);
        }
        let mut tail = lines.join("\n");
        if tail.len() > MAX_CHARS {
            let start = floor_char_boundary(&tail, tail.len() - MAX_CHARS);
            tail = tail[start..].to_string();
        }
        tail
    }

    fn push_committed(&mut self, line: String) {
        // A new committed line supersedes any pending in-place marker update
        // ordering (finish_tool only touches the true last line).
        self.pending_tool_marker = false;
        self.committed.push_back(line);
        while self.committed.len() > MAX_LINES {
            self.committed.pop_front();
        }
    }
}

/// Compact one-line summary of a tool's input for the activity marker.
/// Prefers the model-provided `intent`, then well-known per-tool fields.
fn tool_marker_summary(name: &str, input: &serde_json::Value) -> String {
    let raw = jcode_message_types::ToolCall::intent_from_input(input)
        .or_else(|| {
            let field = match name {
                "bash" => "command",
                "read" | "write" => "file_path",
                "edit" | "multiedit" => "file_path",
                "replace" => "pattern",
                "agentgrep" | "websearch" => "query",
                "webfetch" => "url",
                "task" | "subagent" => "description",
                _ => return None,
            };
            input
                .get(field)
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .unwrap_or_default();
    let flat = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > MAX_SUMMARY_CHARS {
        let mut out: String = flat.chars().take(MAX_SUMMARY_CHARS - 1).collect();
        out.push('…');
        out
    } else {
        flat
    }
}

/// "3s" / "2m10s" style duration for tool markers.
fn humanize_secs(secs: f64) -> String {
    if secs < 10.0 {
        format!("{secs:.1}s")
    } else if secs < 60.0 {
        format!("{}s", secs as u64)
    } else {
        let total = secs as u64;
        format!("{}m{}s", total / 60, total % 60)
    }
}

/// Largest byte index `<= index` that is a UTF-8 char boundary in `text`.
fn floor_char_boundary(text: &str, index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    let mut boundary = index;
    while boundary > 0 && !text.is_char_boundary(boundary) {
        boundary -= 1;
    }
    boundary
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn live_text_renders_and_survives_commit() {
        let mut tail = InlineTailBuffer::default();
        tail.set_live("thinking about the fix\nsecond line");
        assert_eq!(tail.render(), "thinking about the fix\nsecond line");
        tail.commit_live();
        // Next stream starts blank but the previous output is retained.
        tail.set_live("");
        assert_eq!(tail.render(), "thinking about the fix\nsecond line");
    }

    #[test]
    fn tool_markers_interleave_and_complete_in_place() {
        let mut tail = InlineTailBuffer::default();
        tail.set_live("Let me check the render pipeline.");
        tail.start_tool(
            "bash",
            &serde_json::json!({"command": "cargo build --profile selfdev"}),
        );
        let mid = tail.render();
        assert!(
            mid.contains("Let me check the render pipeline."),
            "live text must commit before the marker: {mid}"
        );
        assert!(
            mid.contains("⚙ bash · cargo build --profile selfdev"),
            "{mid}"
        );

        tail.finish_tool(47.2, false);
        assert!(tail.render().contains("(47s)"), "{}", tail.render());

        tail.start_tool("edit", &serde_
```

### Core Architecture Module: `crates/jcode-app-core/src/agent/interrupts.rs`
```
use super::Agent;
use crate::logging;
use crate::message::{ContentBlock, Role};
use crate::protocol::ServerEvent;
use crate::session::StoredDisplayRole;
use anyhow::Result;
use jcode_agent_runtime::{
    InterruptSignal, SoftInterruptMessage, SoftInterruptQueue, SoftInterruptSource,
};
use std::sync::Arc;

fn soft_interrupt_session_display_role(source: SoftInterruptSource) -> Option<StoredDisplayRole> {
    match source {
        SoftInterruptSource::User => None,
        SoftInterruptSource::System => Some(StoredDisplayRole::System),
        SoftInterruptSource::BackgroundTask => Some(StoredDisplayRole::BackgroundTask),
    }
}

fn soft_interrupt_protocol_display_role(source: SoftInterruptSource) -> Option<String> {
    match source {
        SoftInterruptSource::User => None,
        SoftInterruptSource::System => Some("system".to_string()),
        SoftInterruptSource::BackgroundTask => Some("background_task".to_string()),
    }
}

#[derive(Debug, Clone)]
pub(super) struct InjectedSoftInterrupt {
    pub(super) content: String,
    pub(super) source: SoftInterruptSource,
}

pub(super) enum NoToolCallOutcome {
    Break,
    ContinueWithoutEvent,
    ContinueWithSoftInterrupt {
        injected: Vec<InjectedSoftInterrupt>,
        point: &'static str,
    },
}

pub(super) enum PostToolInterruptOutcome {
    NoInterrupt,
    SoftInterrupt {
        injected: Vec<InjectedSoftInterrupt>,
        point: &'static str,
    },
}

impl Agent {
    pub fn restore_persisted_soft_interrupts(&self) -> usize {
        let restored = match crate::soft_interrupt_store::take(self.session_id()) {
            Ok(items) => items,
            Err(err) => {
                logging::warn(&format!(
                    "Failed to restore persisted soft interrupts for {}: {}",
                    self.session_id(),
                    err
                ));
                return 0;
            }
        };

        if restored.is_empty() {
            return 0;
        }

        let restored_count = restored.len();
        if let Ok(mut queue) = self.soft_interrupt_queue.lock() {
            queue.extend(restored);
        } else {
            logging::warn(&format!(
                "Failed to restore persisted soft interrupts for {} because queue lock was poisoned",
                self.session_id()
            ));
            return 0;
        }

        logging::info(&format!(
            "Restored {} persisted soft interrupt(s) for session {}",
            restored_count,
            self.session_id()
        ));
        restored_count
    }

    pub fn persist_soft_interrupt_snapshot(&self) {
        let pending = match self.soft_interrupt_queue.lock() {
            Ok(queue) => queue.clone(),
            Err(_) => {
                logging::warn(&format!(
                    "Failed to snapshot soft interrupts for {} because queue lock was poisoned",
                    self.session_id()
                ));
                return;
            }
        };

        if let Err(err) = crate::soft_interrupt_store::overwrite(self.session_id(), &pending) {
            logging::warn(&format!(
                "Failed to persist {} soft interrupt(s) for {}: {}",
                pending.len(),
                self.session_id(),
                err
            ));
        }
    }

    /// Add a swarm alert to be injected into the next turn
    pub fn push_alert(&mut self, alert: String) {
        self.pending_alerts.push(alert);
    }

    /// Take all pending alerts (clears the queue)
    pub fn take_alerts(&mut self) -> Vec<String> {
        std::mem::take(&mut self.pending_alerts)
    }

    /// Queue a soft interrupt message to be injected at the next safe point.
    /// This method can be called even while the agent is processing (uses separate lock).
    pub fn queue_soft_interrupt(
        &self,
        content: String,
        images: Vec<(String, String)>,
        urgent: bool,
        source: SoftInterruptSource,
    ) {
        let content_bytes = content.len();
        let content_chars = content.chars().count();
        let image_count = images.len();
        if let Ok(mut queue) = self.soft_interrupt_queue.lock() {
            let pending_before = queue.len();
            queue.push(SoftInterruptMessage {
                content,
                images,
                urgent,
                source,
            });
            logging::info(&format!(
                "AGENT_SOFT_INTERRUPT_QUEUE_PUSH session={} source={:?} urgent={} content_bytes={} content_chars={} image_count={} pending_before={} pending_after={}",
                self.session_id(),
                source,
                urgent,
                content_bytes,
                content_chars,
                image_count,
                pending_before,
                queue.len()
            ));
        } else {
            logging::warn(&format!(
                "AGENT_SOFT_INTERRUPT_QUEUE_PUSH_FAILED session={} source={:?} urgent={} content_bytes={} content_chars={} image_count={} reason=queue_lock_poisoned",
                self.session_id(),
                source,
                urgent,
                content_bytes,
                content_chars,
                image_count
            ));
        }
    }

    /// Get a handle to the soft interrupt queue.
    /// The server can use this to queue interrupts without holding the agent lock.
    pub fn soft_interrupt_queue(&self) -> SoftInterruptQueue {
        Arc::clone(&self.soft_interrupt_queue)
    }

    /// Get a handle to the background tool signal.
    /// The server can use this to signal "move tool to background" without holding the agent lock.
    pub fn background_tool_signal(&self) -> InterruptSignal {
        self.background_tool_signal.clone()
    }

    pub fn graceful_shutdown_signal(&self) -> InterruptSignal {
        self.graceful_shutdown.clone()
    }

    pub fn request_graceful_shutdown(&self) {
        self.graceful_shutdown.fire();
    }

    pub(super) fn is_graceful_shutdown(&self) -> bool {
        self.graceful_shutdown.is_set()
    }

    /// Check if there are pending soft interrupts
    pub fn has_soft_interrupts(&self) -> bool {
        self.soft_interrupt_queue
            .lock()
            .map(|q| !q.is_empty())
            .unwrap_or(false)
    }

    /// Check if there's an urgent soft interrupt that should skip remaining tools
    pub fn has_urgent_interrupt(&self) -> bool {
        self.soft_interrupt_queue
            .lock()
            .map(|q| q.iter().any(|m| m.urgent))
            .unwrap_or(false)
    }

    /// Get count of queued soft interrupts
    pub fn soft_interrupt_count(&self) -> usize {
        self.soft_interrupt_queue
            .lock()
            .map(|q| q.len())
            .unwrap_or(0)
    }

    /// Get count of pending alerts
    pub fn pending_alert_count(&self) -> usize {
        self.pending_alerts.len()
    }

    /// Get pending alerts (for debug visibility)
    pub fn pending_alerts_preview(&self) -> Vec<String> {
        self.pending_alerts
            .iter()
            .take(10)
            .map(|s| {
                if s.len() > 100 {
                    format!("{}...", crate::util::truncate_str(s, 100))
                } else {
                    s.clone()
                }
            })
            .collect()
    }

    /// Get comprehensive debug info about agent internal state
    pub fn debug_info(&self) -> serde_json::Value {
        serde_json::json!({
            "provider": self.provider.name(),
            "model": self.provider.model(),
            "provider_session_id": self.provider_session_id,
            "last_upstream_provider": self.last_upstream_provider,
            "last_connection_type": self.last_connection_type,
            "active_skill": self.active_skill,
            "allowed_tools": self.allowed_tools,
            "disabled_tools": self.disabled_tools,
            "session": {
                "id": self.session.id,
              
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1524** (2026-09-28): **Windows: is_socket_path and remove_socket panic with 'there is no reactor running' when called from a plain thread**
  *Symptoms*: ## Environment  - jcode v0.88.0-dev (`b5a4cde7a`) - Windows, named-pipe transport (`crates/jcode-transport/src/windows.rs`)  ## What happens  `is_socket_path` and `remove_socket` are synchronous by contract, but both open the pipe through tokio's named-pipe client:  ```rust pub fn is_socket_path(path: &Path) -> bool {     let pipe_name = path_to_pipe_name(path);     match ClientOptions::new().open(&pipe_name) { ```  `ClientOptions::open` registers the pipe handle with the ambient tokio reactor. Called from a thread that has no runtime context, it aborts the process:  ``` thread '<unnamed>' panicked at tokio-1.49.0/src/net/windows/named_pipe.rs:1005 there is no reactor running, must be called from the context of a Tokio 1.x runtime ```  The panic happens on the `open` call itself, before any success or failure is known, so it is not specific to a missing endpoint or a busy pipe.  ## Minimal reproduction  The two halves of the bug have to meet: a runtime on the server side, and a plain `std::thread` on the probing side. This is a test:  ```rust #[tokio::test] async fn probes_run_from_a_thread_without_a_reactor() {     let path = std::env::temp_dir().join("jcode-probe.sock");     let _listener = Listener::bind(&path).expect("bind named pipe");      // This thread has no runtime, which is the point.     std::thread::spawn(move || {         is_socket_path(&path);   // panics         remove_socket(&path);     })     .join()     .unwrap(); } ```  It fails on the current `master` wit
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report! This is covered by open PR #1525, which is now queued for maintainer review.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1522** (2026-09-28): **OpenRouter: images are clamped to text even when the catalog declares image input**
  *Symptoms*: ## Environment  - jcode v0.88.0-dev (b5a4cde7a), Windows - Native OpenRouter route (`api_base` = `https://openrouter.ai/v1`), no named profile  ## What happens  Reading any image in a session on the native OpenRouter route returns the clamp marker instead of the image:  ``` [read] C:\Users\...\probe.png Image: C:\Users\...\probe.png (255 bytes) Dimensions: 200x200 Image sent to model for vision analysis.  [Image omitted: this provider/model does not support image input; media_type=image/png] ```  The model never sees the pixels. `supports_image_input()` returns false, so the outbound image clamp replaces the block with that text.  ## Why that is wrong  OpenRouter's own catalog already declares which modalities each model accepts. For the model used below:  ```json {   "id": "vendor/vision-model",   "architecture": {     "input_modalities": ["text", "image", "file"],     "output_modalities": ["text"]   } } ```  That information never reaches the decision. `ModelInfo` has no field for it, so `architecture.input_modalities` is discarded during deserialization. `supports_image_input()` therefore falls through to its last line:  ```rust !self.supports_provider_features ```  and `provider_features_enabled(api_base)` is `api_base.contains("openrouter.ai")`, i.e. **true** for this route, so the fallback evaluates to **false** and every image is clamped. The comment above that line says image availability is "model/provider-route dependent there" for the aggregator, but nothing ever c
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report! This is covered by open PR #1523, which is now queued for maintainer review. Related: #772, #1221.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1517** (2026-09-28): **MCP: a stdio server that exits before `initialize` hangs connect for `timeout_secs` and blocks the `mcp` tool's `list` action**
  *Symptoms*: ## Summary  If a stdio MCP server exits before it answers `initialize`, jcode does not notice. The pending `initialize` request waits out the server's full reply timeout. That is 30s by default, but with the per-server `timeout_secs` from #1174 it can be hours.  The same stall also blocks the `mcp` management tool. The startup `connect_all()` runs while holding `mcp_manager.write()`, and `mcp` → `action=list` waits on `read()`. So a model that calls `mcp list` hangs for the whole timeout. In a headless `jcode run` driven by an orchestrator, this showed up as a run stuck for 3h46m at 0% CPU.  ## Reproduction  jcode v0.88.0 (ee4cd3db3), macOS arm64. The relevant code is unchanged on current `master` (b5a4cde7a).  Use an isolated home with a single MCP server that writes to stderr and exits immediately:  ```sh H=$(mktemp -d) cp ~/.jcode/auth.json "$H/"   # provider credentials only cat > "$H/mcp.json" <<'EOF' {"mcpServers":{"dead":{"command":"/bin/sh","args":["-c","echo boom >&2; exit 1"],"timeout_secs":86400}}} EOF cd /tmp && JCODE_HOME="$H" timeout 90 jcode --no-update run --quiet \   "Call the mcp tool with action=list once, then reply with the server names and statuses on one line." echo "rc=$?" ```  **Expected:** `dead` is reported as failed right away, and `mcp list` returns.  **Actual:** the command is killed by `timeout` (`rc=124`, 90s). The log shows neither `Connected to` nor `Failed to connect` for `dead`, and `mcp list` never finishes:  ``` MCP: Connecting to 'dead' 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report! This is covered by open PR #1518, which is now queued for maintainer review. Related: #802, #1174.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1504** (2026-09-27): **TUI: effort chip shows stale level after remote model switch (ModelChanged discards reasoning_effort)**
  *Symptoms*: ## Summary  After a remote model switch, the reasoning-effort chip keeps showing the previous model's effort level. A switch can clear an effort the new model does not advertise, so the chip then advertises a capability the new model does not have.  Version: current master 74577fe83, macOS, remote session (TUI connected to the shared daemon).  ## Repro  1. TUI remote session, pick a model with reasoning effort (e.g. medium). 2. Switch model (`/model` or picker) to one that does not advertise an effort. 3. The effort chip next to the model name still shows the old level.  ## Cause  The daemon half already landed on master: since 74577fe83, `model_changed` carries the effort the switched-to model runs with (`crates/jcode-app-core/src/server/provider_control.rs`, `send_model_changed_result` sends `reasoning_effort` in `ServerEvent::ModelChanged`, null on the error path), and the wire type always serializes the key with the comment "Always serialized (`null` = no effort) so a client can tell 'cleared' from an older server that omits it" (`crates/jcode-protocol/src/wire.rs`). The harness API translation adopted it (`crates/jcode-harness-api-server/src/translate.rs`).  But the TUI consumer never did: `crates/jcode-tui/src/tui/app/remote/server_events.rs` matches `ServerEvent::ModelChanged` with `model, provider_name, error, resolved_credential, ..` — the `..` discards `reasoning_effort`, and nothing touches `app.remote_reasoning_effort`, which the status chip renders (`crates/jcode
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise root cause! Fixed in 6a3ce79ab: the TUI's `ModelChanged` handler now binds `reasoning_effort` and replaces `remote_reasoning_effort` on a successful switch (`None` clears the chip), and the failure path leaves the running model's effort alone. Regression test `test_remote_model_changed_updates_reasoning_effort` covers adopt, clear, and failed-switch; I confirmed it fails without the fix.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1500** (2026-09-27): **Hardcoded Ctrl/Cmd+Enter queue shortcut is invisible to keymap conflict detection, and its hint is inverted for the default queue_mode**
  *Symptoms*: ## Summary  jcode hardcodes Ctrl+Enter / Cmd+Enter as its "alternate enter" (queue) shortcut, but two defects make it unreliable and confusing:  1. **It is silently swallowed by a terminal-level binding, and jcode's own keymap conflict detector does not know the chord exists.** Ghostty's default config binds `super+enter=toggle_fullscreen`, so Cmd+Enter never reaches the TUI. `crates/jcode-setup-hints/src/keymap/conflicts.rs` enumerates the built-in prompt-jump fallbacks (`cmd+k`, `cmd+j`, `cmd+[`, `cmd+]`, `ctrl+[`, `ctrl+]`) but not `alternate_enter`, so no conflict warning is ever produced.  2. **The hotkey hint describes the opposite of the default behavior.** `crates/jcode-tui/src/tui/app/hotkey_feedback.rs` labels Ctrl/Cmd+Enter as "send now, bypassing queue mode". But `send_action` (`crates/jcode-tui/src/tui/app/input.rs:1313`) with the default `queue_mode = false` makes alternate-enter **queue** the message, while plain Enter interleaves. The label is only correct when `queue_mode = true`.  ## Environment  - jcode `0.88.427-dev` (`3be93ab50`), macOS (darwin), built from source - Ghostty `1.3.1`, `TERM=xterm-ghostty` - Default config: `[display] queue_mode = false`  ## Repro (finding 1)  1. In Ghostty with its default keybindings, run jcode and start a turn (`is_processing` is true). 2. Type a follow-up message and press Cmd+Enter. 3. Expected: the message is queued (alternate enter). Observed: nothing happens to the message; Ghostty toggles fullscreen instead.  Eviden
  **Post-Mortem & Fix Analysis**:
  > Thanks for the thorough report! Fixed in 85b7105d6: 1. `ctrl+enter` / `cmd+enter` are now enumerated as built-in `alternate_enter` chords in keymap conflict detection, so Ghostty's default `super+enter=toggle_fullscreen` produces a conflict warning (new test `detects_terminal_claiming_alternate_enter`). 2. The hotkey hint now follows `queue_mode`: "queue this message until the turn ends" when off, "send now, bypassing queue mode" when on (test `alternate_enter_description_follows_queue_mode`).  Your optional item 3 (making `alternate_enter` configurable) is a config-surface decision and is left for the maintainer.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1475** (2026-09-29): **TUI: mermaid diagrams fall back to source text on foot (sixel support is never detected)**
  *Symptoms*: # TUI: mermaid diagrams fall back to source text on foot (sixel support is never detected)  ## Summary  On foot, `mermaid` fenced blocks render as raw source text instead of a diagram. foot has built-in sixel support and advertises it in DA1, but jcode's default (env-based) protocol inference maps `TERM=foot` to "no image protocol", so the mermaid render path is disabled.  ## Environment  - foot `1.28.0` (Arch Linux), sixel built in (no `libsixel` dependency; `sixel.c` is compiled in) - `TERM=foot`, `TERM_PROGRAM` unset, `KITTY_WINDOW_ID` unset  ## Root cause  `infer_protocol_from_env` (`crates/jcode-tui-mermaid/src/mermaid_runtime.rs`) has no foot branch. With `TERM=foot` and no `TERM_PROGRAM`:  1. no terminal branch matches, and `term.contains("sixel")` is false, so it returns `None` 2. the picker stays on `ProtocolType::Halfblocks` 3. `native_image_protocol_available()` is false 4. `should_render_mermaid_block()` (`crates/jcode-tui-markdown/src/lib.rs`) is false, so the block is rendered as source  A unit test currently pins this: `infer_protocol_from_env(Some("foot"), Some("foot"), None, None) == None`.  foot has had built-in sixel since 1.2.0 and answers DA1 with `ESC[?62;4;22c` when sixel is enabled (`4` = sixel), so the capability is there; jcode just never looks. Note foot only advertises `4` when sixel is enabled at runtime (`[tweak].sixel=no`) and compile time, so DA1, not the version, is the correct signal.  ## Impact  Every foot user sees mermaid source instead of
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report! This is covered by open PR #1476, which is now queued for maintainer review.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1414** (2026-09-23): **Stale `active_pids` markers leak across exec-based auto-update reload and inflate session presence counts**
  *Symptoms*: # Stale `active_pids` markers leak across exec-based auto-update reload and inflate session presence counts  ## Summary  After an automated update triggers the graceful exec-based reload, `~/.jcode/active_pids/<id>` markers written by the *previous* process image are never removed. Because the reload uses `exec`, the daemon PID is unchanged, so the markers still look "live" to every liveness check and are counted forever by presence UIs (`jcode menubar`, and anything reading `active_pids` directly).  ## Impact  - Session presence counts inflate by one per client connection that lands in the reload handoff window. - The phantom entries point at the live daemon PID, so no PID-liveness check can detect them. `session_presence()` counts them, and so does any external status bar. - Files persist until manually deleted; they are not reaped at startup.  ## Reproduction  1. Run a daemon and connect one or more clients. 2. Let the updater install a new build and perform its graceful reload (observed with `Updated to v0.87.1. Requesting graceful session reload...`). 3. Open a new client (or let one reconnect) during the exec handoff. 4. Observe `~/.jcode/active_pids/` accumulating entries whose session has no `~/.jcode/sessions/<id>.json`, with a live PID equal to the daemon's.  ## Evidence (real log, v0.87.1)  ``` 13:48:46.744  Updated to v0.87.1. Requesting graceful session reload... 13:48:49.531  Reloading with binary built 2 seconds ago... 13:48:49.832  Server: reload signal receiv
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed root-cause analysis. From reading the code, your diagnosis holds: `find_crashed_via_pid_files` only reaps markers whose PID is dead, and exec keeps the daemon PID. `Server::run` is only reached from `jcode serve` after provider init, and no session marker is written before it. So pruning markers owned by `std::process::id()` next to `reload_recovery::collect_garbage()` looks safe, and it would leave crash-restart markers (new PID) alone. The maintainer will confirm the location. A PR with a regression test for the prune helper would be welcome.  --- *Jcode agent (automated triage), on behalf of @1jehuang*

- **Issue #1404** (2026-09-23): **First-run skill import fails with EACCES when a skill exists in both ~/.claude/skills and ~/.codex/skills and contains read-only files**
  *Symptoms*: ## Summary  On first run, `SkillRegistry::import_from_external` copies `~/.claude/skills` and then `~/.codex/skills` into the same `~/.jcode/skills`. If the same skill exists in both places and contains read-only files, the second copy fails with `Permission denied (os error 13)`. jcode logs `Failed to copy skill 'X'` and abandons that skill's copy.  A common trigger is `~/.codex/skills/X -> ~/.claude/skills/X` (symlinked skill directories) where the skill is a git checkout: `.git/objects/**` files are mode `0444`.  Seen on jcode v0.86.0 (`e589cbe5a`), macOS. The code is in `crates/jcode-base/src/skill.rs` (`import_from_external`, `copy_dir_recursive`).  ## Repro  ```sh export JCODE_HOME=/tmp/jh mkdir -p /tmp/jh/external/.claude/skills/s/sub /tmp/jh/external/.codex printf -- '---\nname: s\ndescription: test skill\n---\nbody\n' > /tmp/jh/external/.claude/skills/s/SKILL.md echo x > /tmp/jh/external/.claude/skills/s/sub/obj && chmod 444 /tmp/jh/external/.claude/skills/s/sub/obj ln -s /tmp/jh/external/.claude/skills /tmp/jh/external/.codex/skills jcode run 'hello' ```  The log shows: `Failed to copy skill 's': Permission denied (os error 13)`.  ## Impact  The first pass's copy is usually complete, so the damage is mostly an error at first run. But the import runs only once (it returns early when `~/.jcode/skills` exists), so any partial copy stays in place for good. The imported copies also go stale as soon as the source skill is updated.  ## Suggested fix  - De-duplicate sources
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise repro. I opened #1416: the first-run import now skips a skill that an earlier source already imported, so a symlinked `~/.codex/skills` no longer hits EACCES on read-only files. The new test uses your layout (symlinked dir, 0444 file) and fails without the fix. Switching to symlinks instead of copies would change behavior, so I left that out for now.  --- *Jcode agent (automated triage), on behalf of @1jehuang*
  > Released in [v0.88.0](https://github.com/1jehuang/jcode/releases/tag/v0.88.0). Run `jcode update` to get it.

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

### Incident Patch 1: `2475895e` (2026-09-29)
**Commit Message**: fix(cursor): answer AgentService allowlist prechecks instead of stalling

Cursor's protocol defines MCP/shell/web-fetch allowlist precheck exec
requests (fields 42/41/43) that it can send before dispatching a tool.
Like the mcp_state request, an unanswered precheck leaves the turn hanging
with heartbeats. Pre-approve jcode's own ccbridge tools (jcode enforces its
own permissions at execution time) and deny Cursor's native shell and
fetch, which jcode rejects anyway.

Not observed on the Auto model in 10 live runs. This closes the remaining
unanswered-exec paths for models such as Grok 4.7 that could not be tested
on a free account.

**File**: `crates/jcode-provider-cursor-runtime/src/agent_transport.rs` (modified, +31/-0)
```diff
@@ -1388,6 +1388,37 @@ pub async fn run_agent_turn(
                         let connect_bytes = crate::wire::connect_frame(&agent_bytes);
                         let _ = outbound_tx.send(connect_bytes).await;
                     }
+                    ExecServerMessageVariant::McpAllowlistPrecheck {
+                        provider_identifier,
+                    } => {
+                        let allowlisted = provider_identifier == crate::wire::JCODE_TOOL_PROVIDER;
+                        stream_debug(format_args!(
+                            "mcp allowlist precheck provider={provider_identifier} allowlisted={allowlisted}"
+                        ));
+                        let res = crate::wire::encode_allowlist_precheck_result(
+                            msg.id,
+                            &msg.exec_id,
+                            42,
+                            allowlisted,
+                        );
+                        let agent_bytes = crate::wire::encode_agent_client_exec_message(&res);
+                        let _ = outbound_tx
+                            .send(crate::wire::connect_frame(&agent_bytes))
+                            .await;
+                    }
+                    ExecServerMessageVariant::OtherAllowlistPrecheck(field) => {
+                        stream_debug(format_args!("allowlist precheck field={field} denied"));
+                        let res = crate::wire::encode_allowlist_precheck_result(
+                            msg.id,
+                            &msg.exec_id,
+                            field,
+                            false,
+                        );
+                        let agent_bytes = crate::wire::encode_agent_client_exec_message(&res);
+                        let _ = outbound_tx
+                            .send(crate::wire::connect_frame(&agent_bytes))
+                            .await;
+                    }
                     ExecServerMessageVariant::Unknown(field, _) => {
                         // An unanswered exec request stalls AgentService with
                         // heartbeat-only frames. Make that visible instead of
```

**File**: `crates/jcode-provider-cursor-runtime/src/cursor_tests.rs` (modified, +36/-0)
```diff
@@ -1070,3 +1070,39 @@ fn mcp_state_request_decodes_and_reports_bridge_tools_ready() {
         .map(|f| std::str::from_utf8(f.data).unwrap().to_string());
     assert!(tool_name.unwrap().contains("list_pages"));
 }
+
+/// Cursor may precheck tool allowlisting before dispatching (exec fields
+/// 41/42/43). An unanswered precheck stalls the turn the same way an
+/// unanswered mcp_state did, so each must decode and get a reply.
+#[test]
+fn allowlist_prechecks_decode_and_reply_on_matching_field() {
+    let mut mcp = wire::field_str(1, wire::JCODE_TOOL_PROVIDER);
+    mcp.extend(wire::field_str(2, "cc_list_pages"));
+    let mut exec = wire::field_varint(1, 9);
+    exec.extend(wire::field_ld(42, &mcp));
+    match wire::decode_exec_server_message(&exec).unwrap().variant {
+        wire::ExecServerMessageVariant::McpAllowlistPrecheck {
+            provider_identifier,
+        } => {
+            assert_eq!(provider_identifier, wire::JCODE_TOOL_PROVIDER)
+        }
+        other => panic!("expected McpAllowlistPrecheck, got {other:?}"),
+    }
+    for field in [41u64, 43] {
+        let mut exec = wire::field_varint(1, 9);
+        exec.extend(wire::field_ld(field, &wire::field_str(1, "x")));
+        assert_eq!(
+            wire::decode_exec_server_message(&exec).unwrap().variant,
+            wire::ExecServerMessageVariant::OtherAllowlistPrecheck(field)
+        );
+    }
+
+    let reply = wire::encode_allowlist_precheck_result(9, "e", 42, true);
+    let result = wire::iter_fields(&reply)
+        .find(|f| f.field == 42)
+        .expect("mcp_allowlist_precheck_result field 42");
+    let allowed = wire::iter_fields(result.data)
+        .find(|f| f.field == 1)
+        .unwrap();
+    assert_eq!(allowed.varint, 1);
+}
```

**File**: `crates/jcode-provider-cursor-runtime/src/wire.rs` (modified, +37/-0)
```diff
@@ -482,6 +482,21 @@ pub fn encode_mcp_state_error(id: u32, exec_id: &str, error: &str) -> Vec<u8> {
     encode_exec_client_message(id, exec_id, 36, &result)
 }
 
+/// Answer an allowlist precheck (`*AllowlistPrecheckResult { allowlisted = 1 }`)
+/// on `response_field` (41 shell, 42 mcp, 43 web fetch). jcode applies its own
+/// permission policy when it executes a bridged tool, so its `ccbridge` MCP
+/// tools are pre-approved. Cursor's native shell/fetch are not (jcode rejects
+/// those exec requests anyway). Leaving a precheck unanswered stalls the turn.
+pub fn encode_allowlist_precheck_result(
+    id: u32,
+    exec_id: &str,
+    response_field: u64,
+    allowlisted: bool,
+) -> Vec<u8> {
+    let result = field_bool(1, allowlisted);
+    encode_exec_client_message(id, exec_id, response_field, &result)
+}
+
 // --------------------------------------------------------------------------
 // McpArgs & Args Map Decoding
 // --------------------------------------------------------------------------
@@ -646,6 +661,13 @@ pub enum ExecServerMessageVariant {
     ComputerUse(ComputerUseArgs),
     WriteShellStdin(WriteShellStdinArgs),
     McpState(McpStateExecArgs),
+    /// `mcp_allowlist_precheck_args` (42): provider_identifier=1, tool_name=2.
+    McpAllowlistPrecheck {
+        provider_identifier: String,
+    },
+    /// `shell_allowlist_precheck_args` (41) / `web_fetch_allowlist_precheck_args`
+    /// (43). Carries the ExecClientMessage response field number.
+    OtherAllowlistPrecheck(u64),
     Unknown(u64, Vec<u8>),
 }
 
@@ -961,6 +983,21 @@ pub fn decode_exec_server_message(bytes: &[u8]) -> Result<ExecServerMessage> {
                 }
                 variant = Some(ExecServerMessageVariant::McpState(args));
             }
+            42 => {
+                let provider_identifier = iter_fields(field.data)
+                    .find(|f| f.field == 1 && f.wire == 2)
+                    .and_then(|f| std::str::from_utf8(f.data).ok())
+                    .unwrap_or_default()
+                    .to_string();
+                variant = Some(ExecServerMessageVariant::McpAllowlistPrecheck {
+                    provider_identifier,
+                });
+            }
+            41 | 43 => {
+                variant = Some(ExecServerMessageVariant::OtherAllowlistPrecheck(
+                    field.field,
+                ));
+            }
             other => {
                 if variant.is_none() {
                     variant = Some(ExecServerMessageVariant::Unknown(
```

---

### Incident Patch 2: `9cdf0016` (2026-09-29)
**Commit Message**: fix(cursor): send model ids Cursor actually serves (grok-4.6, claude-opus-5-5, ...)

jcode reduced every Cursor model to a bare base id, but AgentService only
accepts some of those. Verified live on 2026-09-29: grok-4.7 and
composer-2.5 work, while grok-4.6, claude-opus-5-5, claude-opus-5 and
gpt-5.6-sol fail with ERROR_BAD_MODEL_NAME. Cursor's catalog serves them
as cursor-grok-4.6-high, claude-opus-5-5-high, and so on.

Resolve against the live GetUsableModels catalog instead: exact catalog
ids go through verbatim, base ids map to the catalog variant Cursor labels
with the plain model name, and /fast switches to the -fast sibling. The
catalog is fetched inline (5s bound) when the background prefetch has not
landed yet. grok-4.6 keeps an offline alias for when no catalog is
reachable.

**File**: `crates/jcode-provider-cursor-runtime/src/agent_transport.rs` (modified, +184/-15)
```diff
@@ -316,18 +316,22 @@ pub(crate) struct ResolvedModel {
 /// default: an explicit `-fast` suffix wins, and Composer defaults to Fast,
 /// matching Cursor's API (`composer-2.5` with no params runs the Fast variant).
 pub(crate) fn resolve_model_id(model: &str, fast_override: Option<bool>) -> ResolvedModel {
-    let mut name = model.trim();
-    name = name.strip_prefix("cursor:").unwrap_or(name);
-    name = name.strip_prefix("cursor-").unwrap_or(name);
+    resolve_model_id_with_catalog(model, fast_override, &[])
+}
 
-    let mut suffix_fast = false;
+/// Split a catalog-style id into (base, has_fast_suffix, has_effort_suffix).
+fn split_model_suffixes(model: &str) -> (&str, bool, bool) {
+    let mut name = model;
+    let mut fast = false;
+    let mut effort = false;
     const SUFFIXES: &[&str] = &[
         "-fast",
         "-xhigh",
         "-high",
         "-medium",
         "-low",
         "-minimal",
+        "-max",
         "-thinking",
     ];
     loop {
@@ -337,7 +341,9 @@ pub(crate) fn resolve_model_id(model: &str, fast_override: Option<bool>) -> Reso
                 && !stripped.is_empty()
             {
                 if *suffix == "-fast" {
-                    suffix_fast = true;
+                    fast = true;
+                } else {
+                    effort = true;
                 }
                 name = stripped;
                 stripped_any = true;
@@ -348,7 +354,115 @@ pub(crate) fn resolve_model_id(model: &str, fast_override: Option<bool>) -> Reso
             break;
         }
     }
+    (name, fast, effort)
+}
+
+/// Models whose bare base id Cursor rejects, mapped to the catalog entry
+/// Cursor itself labels with the plain display name. Used only when the live
+/// catalog is unavailable. Verified against AgentService on 2026-09-29:
+/// `grok-4.6` -> `ERROR_BAD_MODEL_NAME`, `cursor-grok-4.6-high` ("Grok 4.6")
+/// is accepted.
+const OFFLINE_CATALOG_ALIASES: &[(&str, &str)] = &[("grok-4.6", "cursor-grok-4.6-high")];
+
+/// Resolve a jcode model id against Cursor's live `GetUsableModels` catalog.
+///
+/// Cursor's AgentService accepts the exact catalog ids it advertises
+/// (`cursor-grok-4.6-high`, `claude-opus-5-5-medium`, `grok-4.7-high-fast`)
+/// but only *some* bare base ids (`grok-4.7`, `composer-2.5` work, while
+/// `grok-4.6`, `claude-opus-5-5` are rejected with `ERROR_BAD_MODEL_NAME`).
+/// So an id that is in the catalog is sent verbatim, and a base id is mapped
+/// onto the catalog variant that matches it. Only when there is no catalog
+/// entry at all do we fall back to stripping suffixes.
+pub(crate) fn resolve_model_id_with_catalog(
+    model: &str,
+    fast_override: Option<bool>,
+    catalog: &[String],
+) -> ResolvedModel {
+    let mut name = model.trim();
+    name = name.strip_prefix("cursor:").unwrap_or(name);
+    let in_catalog = |id: &str| catalog.iter().any(|entry| entry == id);
+
+    // 1. Exact catalog id: send verbatim, honoring /fast by switching to the
+    //    sibling `-fast` variant when one exists.
+    if in_catalog(name) {
+        let (_, suffix_fast, _) = split_model_suffixes(name);
+        let mut id = name.to_string();
+        let mut fast = suffix_fast;
+        match fast_override {
+            Some(true) if !suffix_fast && in_catalog(&format!("{name}-fast")) => {
+                id = format!("{name}-fast");
+                fast = true;
+            }
+            Some(false) if suffix_fast => {
+                let slow = name.strip_suffix("-fast").unwrap_or(name);
+                if in_catalog(slow) {
+                    id = slow.to_string();
+                    fast = false;
+                }
+            }
+            _ => {}
+        }
+        if name.starts_with("composer-") && fast_override.is_none() {
+            fast = true;
+        }
+        return ResolvedModel {
+            id,
+            fast: fast_override.unwrap_or(fast),
+        };
+    }
+
+    // 2. Base or legacy composite id: map onto 
```

**File**: `crates/jcode-provider-cursor-runtime/src/lib.rs` (modified, +28/-0)
```diff
@@ -562,6 +562,11 @@ impl Provider for CursorCliProvider {
             .fast
             .read()
             .unwrap_or_else(|poisoned| poisoned.into_inner());
+        let model_catalog = self
+            .fetched_models
+            .read()
+            .unwrap_or_else(|poisoned| poisoned.into_inner())
+            .clone();
 
         tokio::spawn(async move {
             let _stream_guard = stream_guard;
@@ -571,6 +576,7 @@ impl Provider for CursorCliProvider {
                 &prompt,
                 &model,
                 fast_override,
+                &model_catalog,
                 None,
                 resume_session_id.as_deref(),
                 &stream_uuid,
@@ -776,6 +782,7 @@ async fn run_native_text_command(
     prompt: &str,
     model: &str,
     fast_override: Option<bool>,
+    model_catalog: &[String],
     _account_label: Option<&str>,
     resume_session_id: Option<&str>,
     stream_uuid: &str,
@@ -785,6 +792,25 @@ async fn run_native_text_command(
 ) -> Result<()> {
     let tokens = cursor_auth::resolve_direct_tokens(&client).await?;
 
+    // Cursor rejects some bare base ids (`grok-4.6`, `claude-opus-5-5`) and only
+    // serves the exact ids in its catalog, so model resolution needs it. The
+    // catalog is normally prefetched in the background, but a first turn can
+    // race that. Fetch it inline (bounded) when we have nothing yet.
+    let fetched_catalog;
+    let model_catalog = if model_catalog.is_empty() {
+        fetched_catalog = tokio::time::timeout(
+            std::time::Duration::from_secs(5),
+            fetch_agent_models(&client, &tokens.access_token),
+        )
+        .await
+        .ok()
+        .and_then(Result::ok)
+        .unwrap_or_default();
+        fetched_catalog.as_slice()
+    } else {
+        model_catalog
+    };
+
     // The current Cursor agent transport (`agent.v1.AgentService/Run`) is a
     // paced bidirectional Connect/HTTP2 stream. The old
     // `ChatService/StreamUnifiedChatWithTools` endpoint was decommissioned for
@@ -794,6 +820,7 @@ async fn run_native_text_command(
         prompt,
         model,
         fast_override,
+        model_catalog,
         resume_session_id,
         stream_uuid,
         tools,
@@ -816,6 +843,7 @@ async fn run_native_text_command(
                 prompt,
                 model,
                 fast_override,
+                model_catalog,
                 resume_session_id,
                 stream_uuid,
                 tools,
```

---

### Incident Patch 3: `2cab3a1e` (2026-09-29)
**Commit Message**: fix(cursor): answer AgentService mcp_state requests so MCP tool calls proceed

Cursor's AgentService now sends McpStateExecArgs (ExecServerMessage field
36) for the ccbridge server before it dispatches an McpArgs call. jcode
decoded it as Unknown and never replied, so every Cursor turn that tried to
call a jcode tool stalled on heartbeat frames and ended without running
the tool. Reply with McpStateSuccess listing the bridged tools as ready, and
log any other unsupported exec request instead of ignoring it silently.

Verified live against Cursor: the MCP round trip now completes in ~6s
(4/4) where the previous build stalled 30s and never ran the tool (4/4).

**File**: `crates/jcode-provider-cursor-runtime/src/agent_transport.rs` (modified, +31/-1)
```diff
@@ -1251,7 +1251,37 @@ pub async fn run_agent_turn(
                         let connect_bytes = crate::wire::connect_frame(&agent_bytes);
                         let _ = outbound_tx.send(connect_bytes).await;
                     }
-                    ExecServerMessageVariant::Unknown(_, _) => {}
+                    ExecServerMessageVariant::McpState(args) => {
+                        stream_debug(format_args!(
+                            "mcp_state requested servers={:?} kick_only={}",
+                            args.server_identifiers, args.kick_only
+                        ));
+                        let res = crate::wire::encode_mcp_state_result(
+                            msg.id,
+                            &msg.exec_id,
+                            &args,
+                            tools,
+                        )
+                        .unwrap_or_else(|error| {
+                            crate::wire::encode_mcp_state_error(
+                                msg.id,
+                                &msg.exec_id,
+                                &format!("jcode could not describe its tools: {error}"),
+                            )
+                        });
+                        let agent_bytes = crate::wire::encode_agent_client_exec_message(&res);
+                        let connect_bytes = crate::wire::connect_frame(&agent_bytes);
+                        let _ = outbound_tx.send(connect_bytes).await;
+                    }
+                    ExecServerMessageVariant::Unknown(field, _) => {
+                        // An unanswered exec request stalls AgentService with
+                        // heartbeat-only frames. Make that visible instead of
+                        // silently waiting out the idle timeout.
+                        jcode_base::logging::warn(&format!(
+                            "Cursor agent sent unsupported exec request field {field}; the turn may stall"
+                        ));
+                        stream_debug(format_args!("unsupported exec field={field}"));
+                    }
                 }
             }
         }
```

**File**: `crates/jcode-provider-cursor-runtime/src/cursor_tests.rs` (modified, +56/-0)
```diff
@@ -1014,3 +1014,59 @@ fn test_outbound_tool_result_secret_redaction() {
     assert!(!hay.contains(raw_secret));
     assert!(hay.contains("[REDACTED"));
 }
+
+/// Regression: Cursor's AgentService now sends `McpStateExecArgs` (exec field
+/// 36) for the `ccbridge` server before dispatching an MCP call. jcode used to
+/// decode it as `Unknown` and never answer, so the turn stalled on heartbeats.
+#[test]
+fn mcp_state_request_decodes_and_reports_bridge_tools_ready() {
+    let mut state_args = wire::field_str(1, wire::JCODE_TOOL_PROVIDER);
+    state_args.extend(wire::field_varint(2, 0));
+    let mut exec = wire::field_varint(1, 7);
+    exec.extend(wire::field_str(15, "exec-state"));
+    exec.extend(wire::field_ld(36, &state_args));
+
+    let decoded = wire::decode_exec_server_message(&exec).expect("decode mcp_state");
+    let args = match decoded.variant {
+        wire::ExecServerMessageVariant::McpState(args) => args,
+        other => panic!("expected McpState, got {other:?}"),
+    };
+    assert_eq!(args.server_identifiers, vec![wire::JCODE_TOOL_PROVIDER]);
+    assert!(!args.kick_only);
+
+    let tools = vec![jcode_message_types::ToolDefinition {
+        name: "mcp__chrome-devtools__list_pages".to_string(),
+        description: "List pages".to_string(),
+        input_schema: serde_json::json!({"type": "object", "properties": {}}),
+        defer_loading: false,
+    }];
+    let reply = wire::encode_mcp_state_result(7, "exec-state", &args, &tools)
+        .expect("encode mcp_state result");
+
+    // ExecClientMessage: id=1, exec_id=15, mcp_state_exec_result=36
+    let fields: Vec<_> = wire::iter_fields(&reply).collect();
+    assert!(fields.iter().any(|f| f.field == 1 && f.varint == 7));
+    let result = fields
+        .iter()
+        .find(|f| f.field == 36)
+        .expect("mcp_state_exec_result field 36");
+    // McpStateExecResult.success(1) -> McpStateSuccess.servers(1) -> McpStateServer
+    let success = wire::iter_fields(result.data)
+        .find(|f| f.field == 1)
+        .expect("success case");
+    let server = wire::iter_fields(success.data)
+        .find(|f| f.field == 1)
+        .expect("one server");
+    let server_fields: Vec<_> = wire::iter_fields(server.data).collect();
+    let ident = server_fields
+        .iter()
+        .find(|f| f.field == 2)
+        .map(|f| std::str::from_utf8(f.data).unwrap());
+    assert_eq!(ident, Some(wire::JCODE_TOOL_PROVIDER));
+    let tool_defs: Vec<_> = server_fields.iter().filter(|f| f.field == 5).collect();
+    assert_eq!(tool_defs.len(), 1, "bridged tools are listed on the server");
+    let tool_name = wire::iter_fields(tool_defs[0].data)
+        .find(|f| f.field == 5)
+        .map(|f| std::str::from_utf8(f.data).unwrap().to_string());
+    assert!(tool_name.unwrap().contains("list_pages"));
+}
```

**File**: `crates/jcode-provider-cursor-runtime/src/wire.rs` (modified, +74/-0)
```diff
@@ -433,6 +433,55 @@ pub fn encode_mcp_tools(tools: &[ToolDefinition]) -> Result<Vec<u8>> {
     Ok(out)
 }
 
+/// Encode an `ExecClientMessage` answering `McpStateExecArgs` with
+/// `mcp_state_exec_result` (field 36) -> `McpStateSuccess` (case 1).
+///
+/// jcode advertises every bridged tool under one pseudo server,
+/// [`JCODE_TOOL_PROVIDER`]. Report that server as ready with the same tool
+/// definitions sent in `RunRequest.mcp_tools` so Cursor proceeds to the
+/// `McpArgs` call instead of waiting for a server it thinks is still loading.
+pub fn encode_mcp_state_result(
+    id: u32,
+    exec_id: &str,
+    requested: &McpStateExecArgs,
+    tools: &[ToolDefinition],
+) -> Result<Vec<u8>> {
+    let mut success = Vec::new();
+    let wants_bridge = requested.server_identifiers.is_empty()
+        || requested
+            .server_identifiers
+            .iter()
+            .any(|id| id == JCODE_TOOL_PROVIDER);
+    if wants_bridge {
+        // McpStateServer: server_name=1, server_identifier=2, tools=5 (repeated
+        // McpToolDefinition), status=7
+        let mut server = field_str(1, JCODE_TOOL_PROVIDER);
+        server.extend(field_str(2, JCODE_TOOL_PROVIDER));
+        let aliases = mcp_wire_aliases(tools);
+        for tool in tools {
+            let wire_name = aliases
+                .get(&tool.name)
+                .cloned()
+                .unwrap_or_else(|| mcp_wire_name(&tool.name));
+            let def = encode_mcp_tool_definition_with_wire_name(tool, &wire_name)?;
+            server.extend(field_ld(5, &def));
+        }
+        server.extend(field_str(7, "ready"));
+        // McpStateSuccess: servers=1 (repeated)
+        success.extend(field_ld(1, &server));
+    }
+    // McpStateExecResult: success = 1
+    let result = field_ld(1, &success);
+    Ok(encode_exec_client_message(id, exec_id, 36, &result))
+}
+
+/// Encode an `McpStateError` result (case 2) for `McpStateExecArgs`.
+pub fn encode_mcp_state_error(id: u32, exec_id: &str, error: &str) -> Vec<u8> {
+    let err = field_str(1, error);
+    let result = field_ld(2, &err);
+    encode_exec_client_message(id, exec_id, 36, &result)
+}
+
 // --------------------------------------------------------------------------
 // McpArgs & Args Map Decoding
 // --------------------------------------------------------------------------
@@ -596,9 +645,19 @@ pub enum ExecServerMessageVariant {
     RecordScreen(RecordScreenArgs),
     ComputerUse(ComputerUseArgs),
     WriteShellStdin(WriteShellStdinArgs),
+    McpState(McpStateExecArgs),
     Unknown(u64, Vec<u8>),
 }
 
+/// `McpStateExecArgs` (ExecServerMessage field 36). Cursor asks for the state
+/// of the listed MCP servers before it dispatches an `McpArgs` call. Leaving
+/// it unanswered stalls the turn with only heartbeat frames.
+#[derive(Debug, Clone, PartialEq, Default)]
+pub struct McpStateExecArgs {
+    pub server_identifiers: Vec<String>,
+    pub kick_only: bool,
+}
+
 #[derive(Debug, Clone, PartialEq)]
 pub struct ExecServerMessage {
     pub id: u32,
@@ -887,6 +946,21 @@ pub fn decode_exec_server_message(bytes: &[u8]) -> Result<ExecServerMessage> {
                     WriteShellStdinArgs { shell_id, stdin },
                 ));
             }
+            36 => {
+                // McpStateExecArgs (server_identifiers=1 repeated, kick_only=2)
+                let mut args = McpStateExecArgs::default();
+                for f in iter_fields(field.data) {
+                    if f.field == 1
+                        && f.wire == 2
+                        && let Ok(s) = std::str::from_utf8(f.data)
+                    {
+                        args.server_identifiers.push(s.to_string());
+                    } else if f.field == 2 && f.wire == 0 {
+                        args.kick_only = f.varint != 0;
+                    }
+                }
+                variant = Some(ExecServerMessageVariant::McpState(args));
+            }
             other => {
                 if
```

---

### Incident Patch 4: `c454df77` (2026-09-29)
**Commit Message**: fix(cursor): route native MCP tool results back to the Cursor stream

MultiProvider::native_result_sender returned None for the Cursor provider,
so after jcode executed a Cursor-requested MCP tool locally the result was
dropped and AgentService waited forever for it. Delegate to the active
Cursor runtime's bridge and add a regression test.

**File**: `crates/jcode-base/src/provider/mod.rs` (modified, +7/-1)
```diff
@@ -2902,7 +2902,13 @@ impl Provider for MultiProvider {
             ActiveProvider::Copilot => None,
             ActiveProvider::Antigravity => None,
             ActiveProvider::Gemini => None,
-            ActiveProvider::Cursor => None,
+            // Cursor's AgentService keeps its bidirectional stream open until
+            // the MCP tool result is sent back over the same stream. Dropping
+            // the sender here made every Cursor tool call hang after the tool
+            // ran locally.
+            ActiveProvider::Cursor => self
+                .cursor_provider()
+                .and_then(|provider| provider.native_result_sender()),
             ActiveProvider::Bedrock => None,
             ActiveProvider::OpenRouter => None,
         }
```

**File**: `crates/jcode-base/src/provider/tests.rs` (modified, +62/-0)
```diff
@@ -1029,6 +1029,68 @@ fn test_multi_provider_with_cursor() -> MultiProvider {
     }
 }
 
+struct NativeBridgeProvider {
+    tx: NativeToolResultSender,
+}
+
+#[async_trait::async_trait]
+impl Provider for NativeBridgeProvider {
+    async fn complete(
+        &self,
+        _messages: &[Message],
+        _tools: &[ToolDefinition],
+        _system: &str,
+        _resume_session_id: Option<&str>,
+    ) -> anyhow::Result<EventStream> {
+        anyhow::bail!("native bridge provider must not complete")
+    }
+
+    fn name(&self) -> &'static str {
+        "cursor"
+    }
+
+    fn fork(&self) -> Arc<dyn Provider> {
+        Arc::new(Self {
+            tx: self.tx.clone(),
+        })
+    }
+
+    fn native_result_sender(&self) -> Option<NativeToolResultSender> {
+        Some(self.tx.clone())
+    }
+}
+
+/// Regression: Cursor's AgentService only resumes a turn after the MCP tool
+/// result is written back onto its stream. The agent loop reaches the runtime
+/// through `MultiProvider`, so a `None` here silently dropped every result and
+/// hung Cursor turns right after the local tool finished.
+#[test]
+fn cursor_native_result_sender_reaches_the_active_cursor_runtime() {
+    let runtime = enter_test_runtime();
+    runtime.block_on(async {
+        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
+        let provider = test_multi_provider_with_cursor();
+        *provider
+            .cursor
+            .write()
+            .unwrap_or_else(|poisoned| poisoned.into_inner()) =
+            Some(Arc::new(NativeBridgeProvider { tx }));
+
+        let sender = provider
+            .native_result_sender()
+            .expect("Cursor must expose its native tool result bridge");
+        sender
+            .send(NativeToolResult::success(
+                "stream:1:exec".to_string(),
+                "ok".to_string(),
+            ))
+            .await
+            .expect("send native result");
+        let received = rx.recv().await.expect("runtime receives the result");
+        assert_eq!(received.request_id, "stream:1:exec");
+    });
+}
+
 struct PrewarmRecordingProvider {
     name: &'static str,
     prewarms: Arc<std::sync::atomic::AtomicUsize>,
```

---

### Incident Patch 5: `c943a29d` (2026-09-29)
**Commit Message**: fix(clippy): allow the intentional label-registry test lock, name the publish hook type

**File**: `crates/jcode-app-core/src/server/client_comm_tests.rs` (modified, +1/-0)
```diff
@@ -912,6 +912,7 @@ async fn comm_broadcast_reaches_only_senders_spawned_subtree() {
 /// swarm. Without `to_session` the DM lands on that swarm's coordinator; with
 /// it, on the named agent. Without `to_swarm`, DMs stay swarm-local.
 #[tokio::test]
+#[allow(clippy::await_holding_lock)] // serializes tests sharing the global swarm label registry
 async fn comm_message_cross_swarm_dm_by_label() {
     let _labels_guard = crate::server::swarm_labels::SWARM_LABELS_TEST_LOCK
         .lock()
```

**File**: `crates/jcode-tui/src/tui/session_picker/loading.rs` (modified, +5/-2)
```diff
@@ -185,8 +185,11 @@ pub fn invalidate_session_list_cache() {
 }
 
 #[cfg(test)]
-fn before_session_list_cache_publish_hook() -> &'static Mutex<Option<Box<dyn Fn() + Send>>> {
-    static HOOK: OnceLock<Mutex<Option<Box<dyn Fn() + Send>>>> = OnceLock::new();
+type PublishHook = Box<dyn Fn() + Send>;
+
+#[cfg(test)]
+fn before_session_list_cache_publish_hook() -> &'static Mutex<Option<PublishHook>> {
+    static HOOK: OnceLock<Mutex<Option<PublishHook>>> = OnceLock::new();
     HOOK.get_or_init(|| Mutex::new(None))
 }
 
```

---

### Incident Patch 6: `571de3b8` (2026-09-29)
**Commit Message**: fix(desktop_selfdev): bring instance description under the 25-token cap

**File**: `crates/jcode-app-core/src/tool/desktop_selfdev.rs` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ impl Tool for DesktopSelfDevTool {
         json!({"type":"object", "required":["action"], "properties": {
             "intent": super::intent_schema_property(),
             "action": {"type":"string", "enum":["status","build","reload","build-reload","reload-bridge","test","screenshot","inspect"], "description":"reload-bridge restarts the harness API bridge onto this checkout's newest target/*/jcode-harness-api-bridge as a daemon task that survives this connection dropping. Never kill or restart the bridge by hand from bash: this session talks through it."},
-            "instance": {"type":"string", "enum":INSTANCES, "description":"Required when more than one Desktop instance is running. single-panel is the shared host of every --single-panel window. No arbitrary socket paths."},
+            "instance": {"type":"string", "enum":INSTANCES, "description":"Required if several Desktops run. single-panel hosts all --single-panel windows."},
             "command": {"type":"string", "description":"Optional test shell command, run with the Desktop repository as cwd. Default cargo test."},
             "output": {"type":"string", "description":"Screenshot path under target/. Default desktop-selfdev.png. Uses private Xvfb."},
             "timeout_seconds": {"type":"integer", "minimum":1, "maximum":600, "description":"Command timeout, default 120s. For longer jobs use bash in the Desktop checkout."}
```

---

### Incident Patch 7: `705ec7a9` (2026-09-29)
**Commit Message**: Merge pull request #1462: test(browser): keep the timeout fixture in one process (@Kenmege)

**File**: `crates/jcode-base/src/browser_tests.rs` (modified, +3/-2)
```diff
@@ -297,8 +297,9 @@ fn write_executable(path: &std::path::Path, script: &str) {
 async fn hanging_browser_cli_times_out_instead_of_blocking_forever() {
     let temp = tempfile::tempdir().expect("temp dir");
     let bin = temp.path().join("browser");
-    // Stands in for a CLI waiting on a bridge that will never answer.
-    write_executable(&bin, "#!/bin/sh\nsleep 600\n");
+    // Stands in for a CLI waiting on a bridge that will never answer. `exec` keeps it one
+    // process: kill_on_drop kills only the direct child, so a forked sleep outlived the test.
+    write_executable(&bin, "#!/bin/sh\nexec sleep 600\n");
 
     let started = std::time::Instant::now();
     let result = run_browser_cli_capped(&bin, &["ping"], std::time::Duration::from_millis(300))
```

---

### Incident Patch 8: `5a4805f6` (2026-09-29)
**Commit Message**: Merge pull request #1472: fix(auth): recognize test binaries in custom Cargo target directories (@Kenmege)

**File**: `crates/jcode-base/src/auth/mod.rs` (modified, +23/-6)
```diff
@@ -137,8 +137,8 @@ fn browser_unusable_here() -> bool {
 }
 
 /// True when the current process is a Rust test binary (`cargo test` /
-/// `cargo nextest`). Test binaries always run from `target/**/deps/`, a
-/// location no installed or self-dev jcode binary ever runs from.
+/// `cargo nextest`). Cargo places hashed test executables in `deps/` beneath
+/// its build directory, which can be relocated with `CARGO_TARGET_DIR`.
 ///
 /// Used to keep tests from opening real browser windows (OAuth login pages,
 /// files) on the developer's desktop: many login/onboarding flows are
@@ -153,14 +153,31 @@ pub fn running_in_test_harness() -> bool {
         }
         std::env::current_exe()
             .ok()
-            .map(|exe| {
-                let path = exe.to_string_lossy().replace('\\', "/");
-                path.contains("/target/") && path.contains("/deps/")
-            })
+            .map(|exe| is_test_harness_path(&exe.to_string_lossy()))
             .unwrap_or(false)
     })
 }
 
+fn is_test_harness_path(path: &str) -> bool {
+    let path = path.replace('\\', "/");
+    // Preserve detection for the default target tree, including custom runners.
+    if path.contains("/target/") && path.contains("/deps/") {
+        return true;
+    }
+    let mut components = path.rsplit('/');
+    let Some(filename) = components.next() else {
+        return false;
+    };
+    if components.next() != Some("deps") {
+        return false;
+    }
+    let stem = filename.strip_suffix(".exe").unwrap_or(filename);
+    let Some((name, hash)) = stem.rsplit_once('-') else {
+        return false;
+    };
+    !name.is_empty() && hash.len() == 16 && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
+}
+
 fn env_truthy(key: &str) -> bool {
     std::env::var(key)
         .ok()
```

**File**: `crates/jcode-base/src/auth/tests.rs` (modified, +30/-2)
```diff
@@ -963,20 +963,48 @@ fn claude_oauth_provider_reports_oauth_independently_of_api_key() {
 /// Test binaries must never open real browser windows: login/onboarding flows
 /// are exercised heavily by unit tests, and each ungated `open::that` pops an
 /// OAuth page on the developer's desktop. `running_in_test_harness` detects
-/// the `target/**/deps/` test-binary path, and `browser_suppressed` must honor
+/// the Cargo `deps/` test-binary path, and `browser_suppressed` must honor
 /// it even without --no-browser or NO_BROWSER/JCODE_NO_BROWSER.
 #[test]
 fn browser_suppressed_inside_test_harness_without_env_overrides() {
     assert!(
         super::running_in_test_harness(),
-        "test binary should be detected as a test harness (exe under target/**/deps/)"
+        "test binary should be detected even with a custom Cargo target directory"
     );
     assert!(
         super::browser_suppressed(false),
         "browser opens must be suppressed in test binaries even without --no-browser/env vars"
     );
 }
 
+#[test]
+fn test_harness_paths_include_custom_cargo_target_directories() {
+    for path in [
+        "/work/target/debug/deps/test_binary-0123456789abcdef",
+        "/work/target/debug/deps/custom_runner",
+        "/build-cache/debug/deps/test_binary-0123456789abcdef",
+        "/build-cache/aarch64-apple-darwin/release/deps/test_binary-0123456789abcdef",
+        r"C:\build-cache\debug\deps\test_binary-0123456789abcdef.exe",
+    ] {
+        assert!(
+            super::is_test_harness_path(path),
+            "missed test binary: {path}"
+        );
+    }
+    for path in [
+        "/usr/local/bin/jcode",
+        "/work/target/debug/jcode",
+        "/build-cache/debug/deps/jcode",
+        "/build-cache/debug/deps/libjcode-0123456789abcdef.rlib",
+        "/build-cache/debug/deps/test_binary-not_a_cargo_hash",
+    ] {
+        assert!(
+            !super::is_test_harness_path(path),
+            "not a test binary: {path}"
+        );
+    }
+}
+
 /// Antigravity/Gemini access tokens live about an hour and are refreshed
 /// transparently on the next request. Reporting `Expired` just because the
 /// cached access token aged out made a fully working provider render as broken
```

---

### Incident Patch 9: `66d6fb4a` (2026-09-29)
**Commit Message**: Merge pull request #1476: fix(mermaid): detect foot as a sixel terminal (@zipadoodlez)

**File**: `crates/jcode-tui-mermaid/src/mermaid_runtime.rs` (modified, +19/-4)
```diff
@@ -265,6 +265,16 @@ pub(super) fn infer_protocol_from_env(
         return None;
     }
 
+    // foot has built-in sixel support (since 1.2.0, no libsixel) and sets
+    // TERM=foot with no TERM_PROGRAM, so TERM is the signal. foot only
+    // advertises DA1 attribute 4 when sixel is enabled at runtime
+    // ([tweak].sixel=no) and compile time, so a disabled-sixel foot is still
+    // mis-detected here; JCODE_MERMAID_PICKER_PROBE=1 probes the real DA1 and
+    // overrides the protocol with the truthful answer.
+    if term.starts_with("foot") || term_program.contains("foot") {
+        return Some(ProtocolType::Sixel);
+    }
+
     if term.contains("sixel") {
         return Some(ProtocolType::Sixel);
     }
@@ -822,6 +832,15 @@ mod tests {
             infer_protocol_from_env(Some("xterm-sixel"), None, None, None),
             Some(ProtocolType::Sixel)
         );
+        assert_eq!(
+            infer_protocol_from_env(Some("foot"), Some("foot"), None, None),
+            Some(ProtocolType::Sixel)
+        );
+        // foot sets TERM=foot but no TERM_PROGRAM.
+        assert_eq!(
+            infer_protocol_from_env(Some("foot"), None, None, None),
+            Some(ProtocolType::Sixel)
+        );
     }
 
     #[test]
@@ -835,10 +854,6 @@ mod tests {
             ),
             Some(ProtocolType::Iterm2)
         );
-        assert_eq!(
-            infer_protocol_from_env(Some("foot"), Some("foot"), None, None),
-            None
-        );
         assert_eq!(
             infer_protocol_from_env(Some("xterm-256color"), Some("konsole"), None, None),
             None
```

---

### Incident Patch 10: `25bad307` (2026-09-29)
**Commit Message**: Merge pull request #1485: fix(agentgrep): bump to v0.1.7 so rg exit-2 partial results are not discarded (@adminwat)

**File**: `Cargo.lock` (modified, +5/-5)
```diff
@@ -30,8 +30,8 @@ dependencies = [
 
 [[package]]
 name = "agentgrep"
-version = "0.1.6"
-source = "git+https://github.com/1jehuang/agentgrep.git?tag=v0.1.6#b01b804008ab0662fa14e6b60b10bff61716e6f1"
+version = "0.1.7"
+source = "git+https://github.com/1jehuang/agentgrep.git?tag=v0.1.7#525fc54117962f5f75f93cbffb53b8becf7b3add"
 dependencies = [
  "clap",
  "globset",
@@ -143,7 +143,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -154,7 +154,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.61.2",
+ "windows-sys 0.60.2",
 ]
 
 [[package]]
@@ -8885,7 +8885,7 @@ version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.48.0",
+ "windows-sys 0.52.0",
 ]
 
 [[package]]
```

**File**: `crates/jcode-app-core/Cargo.toml` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ jcode-tool-types = { path = "../jcode-tool-types" }
 flate2 = "1"
 tar = "0.4"
 tempfile = "3"
-agentgrep = { git = "https://github.com/1jehuang/agentgrep.git", tag = "v0.1.6" }
+agentgrep = { git = "https://github.com/1jehuang/agentgrep.git", tag = "v0.1.7" }
 
 [features]
 default = ["pdf", "bedrock"]
```

**File**: `crates/jcode-app-core/src/tool/agentgrep/args.rs` (modified, +4/-0)
```diff
@@ -61,6 +61,8 @@ pub(super) fn build_grep_args(params: &AgentGrepInput, ctx: &ToolContext) -> Res
         paths_only: params.paths_only.unwrap_or(false),
         hidden: params.hidden.unwrap_or(false),
         no_ignore: params.no_ignore.unwrap_or(false),
+        // Keep following symlinks (pre-v0.1.7 behavior); the guardrail is opt-in.
+        no_follow: false,
         path: scope.root,
         glob: scope.glob,
     })
@@ -93,6 +95,8 @@ pub(super) fn build_find_args(params: &AgentGrepInput, ctx: &ToolContext) -> Res
         max_files: params.max_files.unwrap_or(10),
         hidden: params.hidden.unwrap_or(false),
         no_ignore: params.no_ignore.unwrap_or(false),
+        // Keep following symlinks (pre-v0.1.7 behavior); the guardrail is opt-in.
+        no_follow: false,
         path: scope.root,
         glob: scope.glob,
     })
```

**File**: `crates/jcode-app-core/src/tool/agentgrep_tests.rs` (modified, +1/-0)
```diff
@@ -111,6 +111,7 @@ fn render_compacts_huge_grep_match_lines() {
         paths_only: false,
         hidden: false,
         no_ignore: false,
+        no_follow: false,
         path: None,
         glob: None,
     };
```

#### Recent Merged Pull Requests:
- **PR #1558** (2026-09-29): test(tui): pin truecolor in colour tests instead of inheriting COLORTERM (@Kenmege)
- **PR #1556** (2026-09-29): test(tui): scope two whole-screen scans to what they assert (@Kenmege)
- **PR #1554** (2026-09-29): fix(openrouter): collapse the nested if in catalog_declares_image_input (@Kenmege)
- **PR #1552** (2026-09-29): fix(swarm): bring three swarm parameter descriptions under the 25-token cap (@Kenmege)
- **PR #1546** (2026-09-28): fix(antigravity): use daily-cloudcode-pa endpoint to fix consumer-account 429s (@John8a)
- **PR #1545** (2026-09-28): test(reload): cover server reload exit statuses (@alecuba16)
- **PR #1544** (2026-09-28): fix(mcp): avoid startup lock stalls and duplicate spawns (@alecuba16)
- **PR #1542** (2026-09-28): test(tui): hermetic ambient refresh and panic-safe env restore in cost test (@alecuba16)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
