# Forensic Learning Record (Deep Inspection): zeronsh/zeron

> **Canonical Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:45.690Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2503 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/landing/public/downloads.js`
```
(() => {
  const base = "https://zeron.sh/releases/";
  const releases = {
    macos: ["macos-arm64.dmg", "Download for macOS", "Apple silicon"],
    windows: ["windows-x86_64-setup.exe", "Download for Windows", "Windows x64 · Installer"],
    "windows-portable": ["windows-x86_64.zip", "Download for Windows", "Windows x64 · Portable ZIP"],
    linux: ["linux-x86_64.tar.gz", "Download for Linux", "Linux x64"],
    "linux-arm": ["linux-aarch64.tar.gz", "Download for Linux", "Linux ARM64"],
  };
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || navigator.userAgentData?.mobile
    || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1);
  const os = mobile ? null : /Win/i.test(platform) ? "windows"
    : /Mac/i.test(platform) ? "macos" : /Linux/i.test(platform)
    ? (/aarch64|arm64/i.test(`${platform} ${ua}`) ? "linux-arm" : "linux") : null;
  const apply = (version) => {
    for (const link of document.querySelectorAll("[data-platform-download]")) {
      const release = releases[link.dataset.platformDownload];
      if (release) link.href = `${base}zeron-${version}-${release[0]}`;
    }
    for (const id of ["nav-download", "hero-download", "closing-download"]) {
      const link = document.getElementById(id);
      if (!link || !os) continue;
      const [file, label, detail] = releases[os];
      link.href = `${base}zeron-${version}-${file}`;
      link.textContent = id === "nav-download" ? "Download" : label;
      link.setAttribute("data-download-os", os);
      link.setAttribute("aria-label", `${label} (${detail})`);
      link.title = detail;
    }
  };
  // A published fallback keeps downloads usable without the version endpoint.
  // 0.2.97 is the first release with the Windows installer.
  const fallback = "0.2.97";
  apply(fallback);
  fetch(`${base}latest.txt`, { credentials: "omit" })
    .then((r) => r.ok ? r.text() : Promise.reject())
    .then((text) => {
      const version = text.trim();
      if (!/^\d+\.\d+\.\d+$/.test(version)) return;
      const a = version.split(".").map(Number), b = fallback.split(".").map(Number);
      const first = a.findIndex((value, i) => value !== b[i]);
      if (first !== -1 && a[first] < b[first]) return;
      apply(version);
    }).catch(() => {});
})();

```

### Core Architecture Module: `apps/landing/public/glyph-field.js`
```
// Zeron glyph field — a dark-mode descendant of anara.com's hero ASCII background.
//
// Anara: pale-gray math equations on white, cut into cloud-like gaps by a noise field,
// a pointer trail that darkens cells, 0.88 scroll parallax.
// Zeron: the same grid, but set in engraved stone. Text is agent traces and zero-math,
// glyphs sit barely above the obsidian, a slow violet light shaft sweeps through them
// (the canyon beam), and the pointer leaves a violet afterglow instead of ink.
//
// Cells are scattered by a hash (no clouds), and fade to `clearOpacity` behind the
// text and elements they're told to keep legible, so copy sits on clean ground.
//
// mountGlyphField(host, opts) → { destroy }

const DEFAULT_LINES = [
  'zeron run --harness claude',
  'lim n→∞ 1/n = 0',
  'git worktree add ../quiet-aperture',
  'codex › plan → edit → test',
  '0 errors  0 warnings',
  'spawn(agent) for agent in [claude, codex, opencode, cursor, pi]',
  'x · 0 = 0',
  'diff --git a/engine b/engine',
  '✓ 312 passed',
  'e^(iπ) + 1 = 0',
  'await turn.complete()',
  'Σ tokens → ∅',
  'opencode › reasoning',
  'ssh zeron@threshold',
  'f(0) = 0',
  'claude › subagent › explore',
  'git merge --ff-only',
  'origin = (0, 0, 0)',
];

export function mountGlyphField(host, opts = {}) {
  const o = {
    lines: DEFAULT_LINES,
    cellW: 7,
    cellH: 13,
    font: '11px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    // base glyph color as [r,g,b] and alpha range
    base: [196, 188, 226],
    baseAlpha: [0.028, 0.07],
    glow: [167, 139, 250], // #a78bfa
    glowAlpha: 0.75,
    // which fraction of cells are kept (lower = more gaps)
    density: 0.62,
    parallax: 0.88,
    // light shaft: angle in degrees, width as fraction of the diagonal, sweep seconds (0 = static)
    beam: { angle: -38, width: 0.14, sweep: 26, alpha: 0.22, offset: 0.5 },
    // clear hole (ellipse, fractions of the field) thinning the cells under it
    clear: null, // e.g. { x: 0.5, y: 0.45, rx: 0.3, ry: 0.18 }
    // elements whose box, and text elements whose rendered lines, keep glyphs
    // at `clearOpacity`, feathered out over `clearFeather` px
    clearElements: null,
    clearTextElements: null,
    clearPadding: 4,
    clearFeather: 24,
    clearOpacity: 0.2,
    // end the field partway down this element instead of at the host's bottom
    endElement: null,
    endFraction: 1,
    pointerTarget: window,
    ...opts,
  };
  const BEAM = { angle: -38, width: 0.14, sweep: 26, alpha: 0.22, offset: 0.5 };
  o.beam = opts.beam === null || opts.beam === false ? null : { ...BEAM, ...opts.beam };
  const clearEls = o.clearElements || [];
  const clearTextEls = o.clearTextElements || [];
  const text = o.lines.join('     ') + '     ';
  const coarse = matchMedia('(hover: none), (max-width: 767px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = document.createElement('div');
  wrap.className = 'glyph-field';
  wrap.setAttribute('aria-hidden', 'true');
  Object.assign(wrap.style, {
    position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
    maskImage: 'linear-gradient(to bottom, transparent 0%, #000 8%, #000 80%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 8%, #000 80%, transparent 100%)',
  });
  if (o.endElement) wrap.style.bottom = 'auto';
  const inner = document.createElement('div');
  Object.assign(inner.style, { position: 'absolute', left: 0, top: 0, width: '100%', willChange: 'transform' });
  const base = document.createElement('canvas');
  const lit = document.createElement('canvas');
  for (const c of [base, lit]) Object.assign(c.style, { position: 'absolute', left: 0, top: 0 });
  inner.append(base, lit);
  wrap.append(inner);
  host.prepend(wrap);
  const bx = base.getContext('2d');
  const lx = lit.getContext('2d');

  let cols = 0, rows = 0, W = 0, H = 0, extra = 0;
  let clears = [];
  let heat = new Float32Array(0);
  let hot = new Set();
  const trail = [];
  const charAt = (r, c) => text[((r * 41) % text.length + c) % text.length];

  // 0.3..0.7 intensity of a kept cell, or -1 if it's a gap
  const field = (r, c) => {
    let h = Math.imul(r + 1, 374761393) ^ Math.imul(c + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    let v = h / 4294967296;
    if (o.clear) {
      const x = c / cols, y = (r * o.cellH - extra) / (H - 2 * extra || 1);
      const d = Math.hypot((x - o.clear.x) / o.clear.rx, (y - o.clear.y) / o.clear.ry);
      v -= Math.max(0, 1 - d) * 0.6;
    }
    if (v <= 1 - o.density) return -1;
    return 0.3 + 0.4 * ((h >>> 8) % 256) / 255;
  };

  // 1 away from cleared text/elements, easing down to clearOpacity inside them
  const clearFactor = (r, c) => {
    if (!clears.length) return 1;
    const x = (c + 0.5) * o.cellW, y = (r + 0.5) * o.cellH - extra;
    let a = 1;
    for (const b of clears) {
      const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom);
      const s = Math.min(1, Math.hypot(dx, dy) / o.clearFeather);
      a = Math.min(a, o.clearOpacity + (1 - o.clearOpacity) * s * s * (3 - 2 * s));
    }
    return a;
  };

  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;

  let cache = new Float32Array(0);
  const drawCell = (r, c) => {
    bx.clearRect(c * o.cellW, r * o.cellH, o.cellW, o.cellH);
    const ch = charAt(r, c);
    if (ch === ' ') return;
    const f = cache[r * cols + c];
    const h = heat[r * cols + c];
    const k = clearFactor(r, c);
    if ((f < 0 && h <= 0) || k < 0.001) return;
    const a = f < 0 ? 0 : o.baseAlpha[0] + (o.baseAlpha[1] - o.baseAlpha[0]) * f;
    if (h > 0) {
      // mix toward glow
      const col = o.base.map((v, i) => Math.round(v + (o.glow[i] - v) * h));
      bx.fillStyle = rgba(col, (a + (o.glowAlpha - a) * h) * k);
    } else bx.fillStyle = rgba(o.base, a * k);
    bx.fillText(ch, c * o.cellW, r * o.cellH);
  };

  const setup = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (o.endElement) {
      const hr = host.getBoundingClientRect(), er = o.endElement.getBoundingClientRect();
      wrap.style.height = `${Math.max(0, er.top - hr.top + er.height * o.endFraction)}px`;
    }
    W = host.clientWidth;
    extra = 60;
    H = wrap.clientHeight + extra * 2;
    // cleared boxes, in field coordinates
    const hr = host.getBoundingClientRect();
    const local = (b) => ({
      left: b.left - hr.left - o.clearPadding, right: b.right - hr.left + o.clearPadding,
      top: b.top - hr.top - o.clearPadding, bottom: b.bottom - hr.top + o.clearPadding,
    });
    clears = clearEls.map((el) => local(el.getBoundingClientRect()));
    for (const el of clearTextEls) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode());) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const b of range.getClientRects()) if (b.width && b.height) clears.push(local(b));
      }
    }
    inner.style.top = `${-extra}px`;
    inner.style.height = `${H}px`;
    cols = Math.ceil(W / o.cellW) + 1;
    rows = Math.ceil(H / o.cellH) + 1;
    trail.length = 0;
    heat = new Float32Array(cols * rows);
    cache = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cache[r * cols + c] = field(r, c);
    hot = new Set();
    for (const [cv, cx] of [[base, bx], [lit, lx]]) {
      cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.font = o.font; cx.textBaseline = 'top';
    }
    bx.clearRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawCell(r, c);
    // lit layer: every glyph (gaps incl
```

### Core Architecture Module: `apps/landing/public/telemetry.js`
```
(() => {
  const optedOut = () => navigator.globalPrivacyControl === true || ["1", "yes"].includes(navigator.doNotTrack);
  if (
    !["https://zeron.sh", "https://comet.zeron.sh"].includes(location.origin) ||
    !["/", "/index.html"].includes(location.pathname) ||
    optedOut() || typeof fetch !== "function" ||
    typeof crypto === "undefined" || typeof crypto.randomUUID !== "function"
  ) return;

  const distinctId = crypto.randomUUID();
  let sessionId, sessionStartedAt;
  let referrer = "$direct", referringDomain = "$direct";
  try {
    const url = new URL(document.referrer);
    if (["https:", "http:"].includes(url.protocol)) {
      referrer = url.origin + "/";
      referringDomain = url.hostname;
    }
  } catch {}

  const capture = (event, properties = {}) => {
    if (optedOut()) return;
    try {
      const now = Date.now();
      if (!sessionId || now < sessionStartedAt || now - sessionStartedAt >= 24 * 60 * 60 * 1000) {
        const sessionTimestamp = now.toString(16).padStart(12, "0");
        sessionId = `${sessionTimestamp.slice(0, 8)}-${sessionTimestamp.slice(8)}-7${crypto.randomUUID().slice(15)}`;
        sessionStartedAt = now;
      }
      fetch("https://us.i.posthog.com/i/v0/e/?ip=0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        body: JSON.stringify({
          api_key: "phc_yAQTUdUM9vQMcHpGmMcNJom6vfrN3r3eo5avDSnt8S9R",
          event,
          timestamp: new Date(now).toISOString(),
          properties: {
            distinct_id: distinctId,
            $process_person_profile: false,
            $geoip_disable: true,
            $session_id: sessionId,
            $current_url: location.origin + location.pathname,
            $host: location.hostname,
            $pathname: location.pathname,
            $referrer: referrer,
            $referring_domain: referringDomain,
            ...properties,
          },
        }),
      }).catch(() => {});
    } catch {}
  };

  capture("$pageview");

  const placements = { "nav-download": "nav", "hero-download": "hero", "closing-download": "closing" };
  for (const [id, placement] of Object.entries(placements)) {
    const link = document.getElementById(id);
    if (!link) continue;
    const track = (event) => {
      if (event.defaultPrevented) return;
      let url;
      try { url = new URL(link.href); } catch { return; }
      const release = url.pathname.match(/^\/releases\/zeron-(\d+\.\d+\.\d+)-(macos-arm64\.dmg|windows-x86_64\.zip|linux-(?:x86_64|aarch64)\.tar\.gz)$/);
      if (url.origin !== "https://zeron.sh" || !release) return;
      capture("download_clicked", {
        placement,
        version: release[1],
        platform: release[2].split("-")[0],
        architecture: release[2].split("-")[1].split(".")[0],
      });
    };
    link.addEventListener("click", track);
    link.addEventListener("auxclick", (event) => { if (event.button === 1) track(event); });
  }
})();

```

### Core Architecture Module: `apps/www-redirect/src/index.js`
```
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = "zeron.sh";
    return Response.redirect(url.toString(), 301);
  },
};

```

### Core Architecture Module: `apps/zeron/src/auth_cli.rs`
```
//! `zeron login` / `zeron logout` / `zeron status` — the standalone auth surface.
//!
//! Sign-in used to live only inside `zeron headless`, coupling authentication to
//! the long-running daemon. These commands work on the persisted session
//! (`{data_dir}/session.json`) and exit, so a service-managed `zeron headless`
//! only ever *loads* credentials. While an engine is running it owns the session
//! (WorkOS refresh tokens are single-use and rotate on every refresh), so login
//! and logout take the same data-dir lock the engine holds and refuse politely
//! when it is busy.

use std::io::IsTerminal;

use zeron_engine::{AuthState, Engine, EngineConfig, InstanceLock, WorkspaceScope};

#[derive(Debug, PartialEq, Eq)]
struct AccountStatus {
    mode: &'static str,
    auth: String,
    healthy: bool,
}

fn account_status(scope: WorkspaceScope, auth: &AuthState) -> AccountStatus {
    match scope {
        WorkspaceScope::Local => match auth {
            AuthState::SignedOut => AccountStatus {
                mode: "local only",
                auth: "signed out (optional in local-only mode)".into(),
                healthy: true,
            },
            AuthState::NeedsOrganization { user } => AccountStatus {
                mode: "local only",
                auth: format!(
                    "signed in as {}; finish workspace setup to enable sync",
                    user.email
                ),
                healthy: true,
            },
            AuthState::SignedIn { user, .. } => AccountStatus {
                mode: "local only",
                auth: format!("signed in as {}; sync is ready after restart", user.email),
                healthy: true,
            },
        },
        WorkspaceScope::Development => AccountStatus {
            mode: "development",
            auth: "dev mode (bearer = user id)".into(),
            healthy: true,
        },
        WorkspaceScope::Synced => match auth {
            AuthState::SignedIn { user, org_id } => AccountStatus {
                mode: "synced",
                auth: format!(
                    "signed in as {}{}",
                    user.email,
                    org_id
                        .as_ref()
                        .map(|org| format!(" (workspace {org})"))
                        .unwrap_or_default()
                ),
                healthy: true,
            },
            AuthState::NeedsOrganization { user } => AccountStatus {
                mode: "synced",
                auth: format!(
                    "signed in as {} but no workspace selected — run `zeron login`",
                    user.email
                ),
                healthy: false,
            },
            AuthState::SignedOut => AccountStatus {
                mode: "synced",
                auth: "saved session is no longer valid — run `zeron login`".into(),
                healthy: false,
            },
        },
    }
}

/// `zeron login`: authenticate via the paste-code flow (and workspace
/// onboarding), persist `session.json`, and exit.
pub async fn login(config: EngineConfig) -> anyhow::Result<()> {
    std::fs::create_dir_all(&config.data_dir)?;
    let _lock = engine_lock(&config, "sign in")?;
    let auth = Engine::build_auth(&config).await;
    if !auth.workos_enabled() {
        println!("Auth is in dev mode (no WorkOS client id) — there is nothing to sign in to.");
        return Ok(());
    }
    if let AuthState::SignedIn { user, org_id } = auth.state() {
        println!(
            "Already signed in as {}{}.",
            user.email,
            org_id
                .map(|org| format!(" (workspace {org})"))
                .unwrap_or_default()
        );
        println!("Run `zeron logout` first to switch accounts.");
        println!("The next engine start will use the synced workspace.");
        return Ok(());
    }
    if !std::io::stdin().is_terminal() {
        anyhow::bail!("zeron login needs an interactive terminal");
    }
    zeron_engine::terminal_sign_in(&auth).await?;
    match auth.state() {
        AuthState::SignedIn { user, org_id } => {
            println!(
                "\nSigned in as {}{}.",
                user.email,
                org_id
                    .map(|org| format!(" (workspace {org})"))
                    .unwrap_or_default()
            );
            println!(
                "Sync is ready. Start or restart Zeron to open the synced workspace; existing local sessions will stay local."
            );
        }
        // terminal_sign_in only returns Ok once signed in; keep an honest fallback.
        _ => println!("Sign-in did not complete."),
    }
    Ok(())
}

/// `zeron logout`: remove the persisted session.
pub async fn logout(config: EngineConfig) -> anyhow::Result<()> {
    std::fs::create_dir_all(&config.data_dir)?;
    let _lock = engine_lock(&config, "sign out")?;
    let auth = Engine::build_auth(&config).await;
    if !auth.workos_enabled() {
        // Dev mode has no live session, but clear any stale session.json from a
        // previous WorkOS-mode run so the next real run starts signed out.
        auth.sign_out();
        println!("Auth is in dev mode — cleared any stale saved session.");
        println!("The next engine start will remain in development mode.");
        return Ok(());
    }
    match auth.state() {
        AuthState::SignedOut => {
            // Also remove malformed or stale files that could not be loaded.
            auth.sign_out();
            println!("No valid saved session; cleared any stale session file.");
        }
        state => {
            let email = state
                .user()
                .map(|u| u.email.clone())
                .unwrap_or_else(|| "<unknown>".into());
            auth.sign_out();
            println!(
                "Signed out {email} — removed {}.",
                config.data_dir.join("session.json").display()
            );
        }
    }
    println!("The next engine start will use the local-only workspace.");
    Ok(())
}

/// `zeron status`: report the fixed scope a new engine would select, optional
/// auth, and engine liveness. Local-only is a healthy signed-out state.
pub async fn status(config: EngineConfig) -> anyhow::Result<()> {
    let auth = Engine::build_auth(&config).await;
    let next_scope = Engine::initial_workspace_scope(&auth);
    let scope = live_engine_scope(config.ipc_port)
        .await
        .unwrap_or(next_scope);
    let account = account_status(scope, &auth.state());
    println!("Data dir: {}", config.data_dir.display());
    println!("Edge:     {}", config.edge_url);
    println!("Mode:     {}", account.mode);
    println!("Auth:     {}", account.auth);
    match InstanceLock::holder(&config.data_dir) {
        Some(pid) => println!("Engine:   running (pid {pid})"),
        None => println!("Engine:   not running"),
    }
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], config.ipc_port));
    let ipc = std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(500));
    println!(
        "IPC:      {} 127.0.0.1:{}",
        if ipc.is_ok() {
            "listening on"
        } else {
            "not listening on"
        },
        config.ipc_port
    );
    if !account.healthy {
        std::process::exit(1);
    }
    Ok(())
}

/// Prefer the immutable scope of a live runtime. Falling back to the next-boot
/// derivation is correct when no engine is listening and tolerant of old
/// daemons that predate EngineInfo.
async fn live_engine_scope(ipc_port: u16) -> Option<WorkspaceScope> {
    let client = zeron_rpc::connect_ws(&format!("ws://127.0.0.1:{ipc_port}"))
        .await
        .ok()?;
    let value = client
        .call(zeron_rpc::methods::ENGINE_INFO, serde_json::json!({}))
        .await
        .ok()?;
    serde_json::from_value::<zeron_engine::EngineInfo>(value)
        .ok()
        .map(|info| info.workspace_scope)
}

/// The same exclusive data-dir lock 
```

### Core Architecture Module: `apps/zeron/src/daemon.rs`
```
//! `zeron daemon …` — install/manage `zeron headless` as a background service:
//! a systemd **user** unit on Linux (the VPS deployment target), a launchd
//! LaunchAgent on macOS. The unit runs the current executable with the
//! `ZERON_*` environment captured at install time, so
//! `ZERON_EDGE_URL=… zeron daemon install` bakes that override in.
//!
//! Auth is decoupled: without a saved session the service remains up on the
//! local-only profile. `zeron login` and a service restart opt into sync.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, bail};

const LAUNCHD_LABEL: &str = "sh.zeron.app";
/// Same unit name the curl|sh installer (`edge/src/install.sh`) writes, so
/// `zeron daemon …` manages that installation rather than a competing copy.
const SYSTEMD_UNIT: &str = "zeron.service";

/// Environment captured into the unit file. `PATH` is always included (the
/// engine spawns harness CLIs like `claude`, which service managers' minimal
/// default PATH won't find); the `ZERON_*`/logging vars only when set.
const CAPTURED_ENV: &[&str] = &[
    "PATH",
    "ZERON_DATA_DIR",
    "ZERON_EDGE_URL",
    "ZERON_EDGE_TOKEN",
    "ZERON_ORG_ID",
    "ZERON_WORKOS_CLIENT_ID",
    "ZERON_WORKOS_API_BASE",
    "ZERON_IPC_PORT",
    "ZERON_CALLBACK_PORT",
    "ZERON_HARNESS",
    "ZERON_DEVICE_NAME",
    "RUST_LOG",
];

pub fn install(data_dir: &Path) -> anyhow::Result<()> {
    let exe = std::env::current_exe().context("resolving the zeron executable path")?;
    let env = captured_env();
    if cfg!(target_os = "macos") {
        let plist = launchd_plist_path()?;
        std::fs::create_dir_all(plist.parent().expect("LaunchAgents parent"))?;
        std::fs::create_dir_all(data_dir)?;
        // Reinstall-friendly: unload any previous incarnation before rewriting.
        let _ = run_quiet("launchctl", &["bootout", &launchd_service_target()?]);
        std::fs::write(
            &plist,
            render_launchd_plist(&exe, &env, &data_dir.join("daemon.log")),
        )?;
        run(
            "launchctl",
            &["bootstrap", &launchd_domain()?, &plist.to_string_lossy()],
        )?;
        println!(
            "Installed and started {LAUNCHD_LABEL} ({}).",
            plist.display()
        );
    } else if cfg!(target_os = "linux") {
        let unit = systemd_unit_path()?;
        std::fs::create_dir_all(unit.parent().expect("systemd user dir"))?;
        std::fs::write(&unit, render_systemd_unit(&exe, &env))?;
        run("systemctl", &["--user", "daemon-reload"])?;
        run("systemctl", &["--user", "enable", "--now", SYSTEMD_UNIT])?;
        println!("Installed and started {SYSTEMD_UNIT} ({}).", unit.display());
        println!(
            "For start-at-boot without an active login session (VPS): loginctl enable-linger $USER"
        );
    } else {
        bail!("zeron daemon is only supported on macOS (launchd) and Linux (systemd)");
    }
    println!(
        "Without a saved account the engine stays local-only; sign-in and restart are optional for sync."
    );
    println!(
        "Logs: {}",
        if cfg!(target_os = "macos") {
            format!("{}", data_dir.join("daemon.log").display())
        } else {
            format!("journalctl --user -u {SYSTEMD_UNIT}")
        }
    );
    Ok(())
}

pub fn uninstall() -> anyhow::Result<()> {
    if cfg!(target_os = "macos") {
        let _ = run_quiet("launchctl", &["bootout", &launchd_service_target()?]);
        let plist = launchd_plist_path()?;
        match std::fs::remove_file(&plist) {
            Ok(()) => println!("Removed {}.", plist.display()),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                println!("Not installed.")
            }
            Err(err) => return Err(err.into()),
        }
    } else if cfg!(target_os = "linux") {
        let _ = run_quiet("systemctl", &["--user", "disable", "--now", SYSTEMD_UNIT]);
        let unit = systemd_unit_path()?;
        match std::fs::remove_file(&unit) {
            Ok(()) => {
                run("systemctl", &["--user", "daemon-reload"])?;
                println!("Removed {}.", unit.display());
            }
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                println!("Not installed.")
            }
            Err(err) => return Err(err.into()),
        }
    } else {
        bail!("zeron daemon is only supported on macOS (launchd) and Linux (systemd)");
    }
    Ok(())
}

pub fn start() -> anyhow::Result<()> {
    if cfg!(target_os = "macos") {
        let plist = launchd_plist_path()?;
        if !plist.exists() {
            bail!("not installed — run `zeron daemon install` first");
        }
        // `stop` boots the job out of the domain, so start = bootstrap; already
        // loaded is fine, then kickstart guarantees a running process either way.
        let _ = run_quiet(
            "launchctl",
            &["bootstrap", &launchd_domain()?, &plist.to_string_lossy()],
        );
        run("launchctl", &["kickstart", &launchd_service_target()?])?;
    } else if cfg!(target_os = "linux") {
        run("systemctl", &["--user", "start", SYSTEMD_UNIT])?;
    } else {
        bail!("zeron daemon is only supported on macOS (launchd) and Linux (systemd)");
    }
    println!("Started.");
    Ok(())
}

pub fn stop() -> anyhow::Result<()> {
    if cfg!(target_os = "macos") {
        // bootout (not `kill`): with KeepAlive the job would otherwise respawn.
        run("launchctl", &["bootout", &launchd_service_target()?])?;
    } else if cfg!(target_os = "linux") {
        run("systemctl", &["--user", "stop", SYSTEMD_UNIT])?;
    } else {
        bail!("zeron daemon is only supported on macOS (launchd) and Linux (systemd)");
    }
    println!("Stopped.");
    Ok(())
}

pub fn restart() -> anyhow::Result<()> {
    if cfg!(target_os = "macos") {
        if run_quiet(
            "launchctl",
            &["kickstart", "-k", &launchd_service_target()?],
        )
        .is_err()
        {
            // Not loaded (e.g. after `stop`) — fall through to a plain start.
            return start();
        }
        println!("Restarted.");
        Ok(())
    } else if cfg!(target_os = "linux") {
        run("systemctl", &["--user", "restart", SYSTEMD_UNIT])?;
        println!("Restarted.");
        Ok(())
    } else {
        bail!("zeron daemon is only supported on macOS (launchd) and Linux (systemd)");
    }
}

pub fn status() -> anyhow::Result<()> {
    if cfg!(target_os = "macos") {
        let output = Command::new("launchctl")
            .args(["print", &launchd_service_target()?])
            .output()
            .context("running launchctl")?;
        if !output.status.success() {
            println!(
                "{LAUNCHD_LABEL}: not loaded{}",
                if launchd_plist_path()?.exists() {
                    " (installed — `zeron daemon start`)"
                } else {
                    " (not installed — `zeron daemon install`)"
                }
            );
            return Ok(());
        }
        // `launchctl print` is pages long; surface just the liveness lines.
        let text = String::from_utf8_lossy(&output.stdout);
        println!("{LAUNCHD_LABEL}: loaded");
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("state = ")
                || trimmed.starts_with("pid = ")
                || trimmed.starts_with("last exit code = ")
            {
                println!("  {trimmed}");
            }
        }
        Ok(())
    } else if cfg!(target_os = "linux") {
        // Passthrough; `status` exits nonzero for inactive units, which is not an
        // error for us to report — the output already says it.
        let _ = Command::new("systemctl")
            .args(["--user", "--no-pager", "status", SYSTEMD_UNIT])
            .status()
            .context("running systemctl")?;
        Ok(())
    } els
```

### Core Architecture Module: `apps/zeron/src/main.rs`
```
//! zeron — headed by default; `zeron headless` runs the engine alone. Both start
//! local-only without credentials. `zeron login` and `zeron logout` select the
//! profile used by the next engine start without mutating a live runtime.

#![cfg_attr(windows, windows_subsystem = "windows")]

mod auth_cli;
mod daemon;
mod paths;
mod update_cli;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "zeron",
    version,
    about = "Multi-device controller for coding agents"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
    /// Open a Zeron conversation URL.
    #[arg(value_name = "URL")]
    open_url: Option<String>,
    #[cfg(windows)]
    #[arg(long, hide = true)]
    wait_for_exit: Option<u32>,
}

#[derive(Subcommand)]
enum Command {
    /// Run the engine without a UI (local-only unless a saved session enables sync).
    Headless,
    /// Sign in and enable sync on the next engine start.
    Login,
    /// Remove the saved session and return to local-only on the next start.
    Logout,
    /// Show workspace mode, optional auth, and engine status.
    Status,
    /// Live sync introspection from the running engine: per-room connection
    /// state, last pushed-frame/ack ages, rejoin/probe/resync counters.
    Sync,
    #[cfg(target_os = "linux")]
    /// Trigger an Appshot in the running headed instance (desktop shortcut fallback).
    Appshot,
    /// Serve the Zeron MCP (Model Context Protocol) server on stdin/stdout,
    /// proxying to the running engine's IPC. Agents use it to create, read,
    /// and message chats. Logs go to stderr; stdout is the protocol.
    Mcp,
    /// Manage `zeron headless` as a background service (launchd / systemd --user).
    Daemon {
        #[command(subcommand)]
        command: DaemonCommand,
    },
    /// Check for a newer release and apply it (download → verify → swap →
    /// service restart). `--check` only reports (exits 1 when one is available).
    Update {
        #[arg(long)]
        check: bool,
    },
}

#[derive(Subcommand)]
enum DaemonCommand {
    /// Install, enable, and start the service (captures ZERON_* env).
    Install,
    /// Stop and remove the service.
    Uninstall,
    /// Start the installed service.
    Start,
    /// Stop the service.
    Stop,
    /// Restart the service.
    Restart,
    /// Show the service manager's view of the daemon.
    Status,
}

/// Production edge (Cloudflare Worker + Durable Objects on the zeron.sh zone).
/// `ZERON_EDGE_URL` overrides (local dev / self-hosting).
const DEFAULT_EDGE_URL: &str = "https://edge.zeron.sh";

/// Production WorkOS AuthKit client id — public knowledge (it appears in every
/// authorize URL), so baking it in is safe. Overridden by `ZERON_WORKOS_CLIENT_ID`;
/// set it to the empty string — or set a dev bearer via `ZERON_EDGE_TOKEN` — to
/// force dev-mode auth instead.
const DEFAULT_WORKOS_CLIENT_ID: &str = "client_01KWD0EAKZKD50YCQJNYSRE4BY";

fn edge_url_from_env() -> String {
    std::env::var("ZERON_EDGE_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_EDGE_URL.into())
}

/// WorkOS client id resolution: explicit env wins (empty string = dev mode);
/// otherwise a `ZERON_EDGE_TOKEN` dev bearer keeps dev mode (smoke tests,
/// local wrangler); otherwise the baked production client id makes optional
/// sync available while a bare start remains local-only.
fn workos_client_id_from_env(edge_token: &Option<String>) -> Option<String> {
    match std::env::var("ZERON_WORKOS_CLIENT_ID") {
        Ok(v) if v.trim().is_empty() => None,
        Ok(v) => Some(v),
        Err(_) if edge_token.is_some() => None,
        Err(_) => Some(DEFAULT_WORKOS_CLIENT_ID.into()),
    }
}

/// mimalloc, macOS only: libmalloc never returns the streaming churn's
/// high-water pages, so transient allocation became permanent RSS
/// (docs/memory-plan.md §1). Pinned to mimalloc v2 in the workspace manifest —
/// the crate's default v3 has the same pathology (churn retained as permanent
/// RSS, ~6x glibc's growth on identical workloads, no idle recovery). Linux
/// measured flat on glibc, so it keeps the system allocator.
#[cfg(target_os = "macos")]
#[global_allocator]
static ALLOC: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// glibc gives threads their own arenas (up to 8 × cores) and on free returns
/// only the top of each heap, so churn freed mid-heap stays resident: a
/// headless engine held 6.6GB in 129 arenas after a day. `malloc_trim` also
/// releases the free pages inside every arena, so long-running modes call it
/// once a minute. Capping arenas instead (`M_ARENA_MAX=2`) reclaimed less and
/// cost ~6x the engine's CPU in arena-lock contention while chats streamed
/// (docs/memory-plan.md).
#[cfg(all(target_os = "linux", target_env = "gnu"))]
fn spawn_malloc_trimmer() {
    const PERIOD: std::time::Duration = std::time::Duration::from_secs(60);
    let spawned = std::thread::Builder::new()
        .name("malloc-trim".into())
        .spawn(|| {
            loop {
                std::thread::sleep(PERIOD);
                let started = std::time::Instant::now();
                // SAFETY: malloc_trim takes no pointers and locks each arena
                // itself, so it is safe to call from any thread at any time.
                let released = unsafe { libc::malloc_trim(0) } != 0;
                tracing::debug!(released, elapsed = ?started.elapsed(), "malloc_trim");
            }
        });
    if let Err(error) = spawned {
        tracing::warn!(%error, "malloc trimmer not started");
    }
}

fn main() -> anyhow::Result<()> {
    if std::env::args_os().nth(1).as_deref() == Some(std::ffi::OsStr::new("--noop-browser")) {
        return Ok(());
    }
    #[cfg(windows)]
    attach_parent_console();
    let cli = Cli::parse();
    #[cfg(windows)]
    if let Some(pid) = cli.wait_for_exit {
        zeron_update::windows::wait_for_exit(pid)?;
    } else if matches!(&cli.command, None | Some(Command::Headless)) {
        zeron_update::windows::cleanup_previous_image();
    }
    // Long-running modes log at info, one-shot CLI commands at warn (RUST_LOG
    // overrides either).
    // loro's internal block-encode diagnostics log at info and flood
    // journald on every snapshot export — enough to fill a disk on a
    // long-running headless host. Quiet them by default (RUST_LOG still
    // overrides the whole filter).
    let long_running = matches!(&cli.command, None | Some(Command::Headless));
    let default_filter = if long_running {
        "info,loro_internal=warn,loro=warn"
    } else {
        "warn"
    };
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| default_filter.into());
    // Long-running modes mirror stdout logging to {data_dir}/logs — a headed
    // app launched from Finder has no visible stdout, which left every sync
    // wedge report ("stale until restart") with zero diagnostics even though
    // the engine logs the exact failure line. One file per launch, previous
    // launch kept as `.old`.
    let log_file = if long_running {
        let mode = if cli.command.is_some() {
            "headless"
        } else {
            "headed"
        };
        open_log_file(mode)
    } else {
        None
    };
    {
        use tracing_subscriber::layer::SubscriberExt;
        use tracing_subscriber::util::SubscriberInitExt;
        // `zeron mcp` owns stdout for the protocol: a single log line on it
        // would corrupt the JSON-RPC stream, so its diagnostics go to stderr.
        if matches!(&cli.command, Some(Command::Mcp)) {
            tracing_subscriber::registry()
                .with(filter)
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_ansi(false)
                        .with_writer(std::io::stderr),
                )
                .init();
        } else {
            let registry = tracing_subscri
```

### Core Architecture Module: `apps/zeron/src/paths.rs`
```
//! Application storage paths. Provider credentials keep their own locations.

use std::ffi::OsString;
use std::path::PathBuf;

pub fn data_dir() -> PathBuf {
    resolve_data_dir(|name| std::env::var_os(name))
}

fn resolve_data_dir(mut env: impl FnMut(&str) -> Option<OsString>) -> PathBuf {
    if let Some(dir) = env("ZERON_DATA_DIR") {
        return PathBuf::from(dir);
    }
    #[cfg(windows)]
    {
        // Explorer does not set HOME. Do not let a shell-specific HOME select
        // a different workspace from a desktop launch, or migrate credentials
        // between Unix-style and native Windows directories implicitly.
        let local = env("LOCALAPPDATA")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                env("USERPROFILE")
                    .filter(|value| !value.is_empty())
                    .map(|home| PathBuf::from(home).join("AppData").join("Local"))
            })
            .expect("LOCALAPPDATA and USERPROFILE not set; set ZERON_DATA_DIR");
        local.join("Zeron")
    }
    #[cfg(not(windows))]
    {
        let home = PathBuf::from(env("HOME").expect("HOME not set"));
        let dir = home.join(".zeron");
        // One-shot 0.2.0 migration: adopt the pre-rename data dir.
        if !dir.exists() {
            let old = home.join(".comet-native");
            if old.exists() && std::fs::rename(&old, &dir).is_ok() {
                eprintln!("migrated data dir {} -> {}", old.display(), dir.display());
            }
        }
        dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolve(vars: &[(&str, &str)]) -> PathBuf {
        resolve_data_dir(|name| {
            vars.iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| value.into())
        })
    }

    #[test]
    fn explicit_data_dir_needs_no_home() {
        assert_eq!(
            resolve(&[("ZERON_DATA_DIR", "custom data")]),
            PathBuf::from("custom data")
        );
    }

    #[cfg(windows)]
    #[test]
    fn explorer_launch_without_home_uses_local_app_data() {
        assert_eq!(
            resolve(&[("LOCALAPPDATA", r"C:\Users\Test User\AppData\Local")]),
            PathBuf::from(r"C:\Users\Test User\AppData\Local\Zeron"),
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_profile_fallback_handles_unicode_and_apostrophes() {
        assert_eq!(
            resolve(&[("USERPROFILE", r"C:\Users\O'Brien 日本語")]),
            PathBuf::from(r"C:\Users\O'Brien 日本語\AppData\Local\Zeron"),
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_default_does_not_depend_on_shell_home() {
        assert_eq!(
            resolve(&[("HOME", r"D:\msys-home"), ("LOCALAPPDATA", r"C:\Local")]),
            PathBuf::from(r"C:\Local\Zeron"),
        );
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #651** (2026-09-29): **Fix side chats appearing in the command palette**
  *Symptoms*: Cmd+K/Ctrl+K currently searches all chats, so manual side chats and chats created by agents through Zeron MCP appear alongside main sessions and can consume all 30 history slots.  Filter out chats with `parent_chat_id` before searching, sorting, and limiting results, matching the sidebar's top-level-session rule. Archived main sessions remain searchable, and the palette retains its global project scope.  Added regression tests covering empty and title-specific searches, manual and MCP child chats, archived and orphaned children, and the 30-result limit.  Validation: - Both new regression tests failed before the fix and passed afterward. - `cargo test --locked -p zeron-ui --lib shell::command_palette::tests -- --test-threads=1`: 7 passed. - `rustfmt --check --edition 2024 crates/ui/src/shell/command_palette.rs` and `git diff --check` passed.  <!-- codesmith:footer --> --- <a href="https://app.blacksmith.sh/zeronsh/codesmith/zeron/pr/651?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a> <a href="https://backend.blacksmith.sh/track/enable-autofix?expires=1793300324&installat

- **Issue #650** (2026-09-29): **Hide queue attachment filenames and fix hover overflow**
  *Symptoms*: Queued messages with attachments display filenames under the message text, and hovering a row can paint outside the queue tray's rounded top corners.  Remove attachment name labels while preserving image thumbnails and their preview actions. Add a small inset around the rows to contain hover and editing backgrounds, compensating row padding to preserve text and control alignment.  <img width="744" height="128" alt="image" src="https://github.com/user-attachments/assets/e4b6cde7-5c97-4127-bd03-131e9d29280e" />  Validation: `cargo check -p zeron-ui --locked --offline`, `rustfmt --edition 2024 --check crates/ui/src/queue.rs`, and `git diff --check` passed.  <!-- codesmith:footer --> --- <a href="https://app.blacksmith.sh/zeronsh/codesmith/zeron/pr/650?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a> <a href="https://backend.blacksmith.sh/track/enable-autofix?expires=1793299941&installation_model_id=425430&pr_number=650&ref=codesmith_pr_footer&repository=zeronsh%2Fzeron&return_to=https%3A%2F%2Fgithub.com%2Fzeronsh%2Fzeron%2Fpull%2F650&signature=828f78b7bd7d9398e378

- **Issue #642** (2026-09-29): **Appearance: reduce motion, and pause animations in background**
  *Symptoms*: - gpui already freezes every `with_animation` element when `App::reduce_motion` is set, and the motion kit, loaders and hand-driven tweens all read it. But nothing ever set it, so the OS "reduce motion" setting was ignored. This PR sets it. - New **Motion** section in Settings → Appearance:   - **Reduce motion**: `System` (default) / `On` / `Off`. `System` reads the OS setting:     - macOS: `NSWorkspace.accessibilityDisplayShouldReduceMotion`     - Windows: `SPI_GETCLIENTAREAANIMATION` ("Animation effects")     - Linux: the desktop portal's `org.freedesktop.appearance` `reduced-motion` key, which GNOME and KDE fill in from their own animation settings. It's read off the main thread, and portals without the key count as "no preference".   - **Pause animations in background** (off by default): also freezes animations while the main window isn't focused. Spinners and shimmers stop redrawing and the shared animation clock stops, so CPU usage for an unfocused window drops to 0% (see screenshot below). Previously a single Working spinner kept the window redrawing behind other apps. - The OS value is read at startup and again each time the main window regains focus, because changing it means leaving Zeron. This avoids keeping platform notification observers around. The helper text under the select shows what the system currently reports. - Both settings are stored per device in `ui-settings.json` (`reduceMotion`, `pauseAnimationsInBackground`). They're `#[serde(default)]`, s

- **Issue #641** (2026-09-29): **Sidebar: keep Ctrl+N jump hints on one line in compact rows**
  *Symptoms*: ## Problem  Holding Ctrl shows a `Ctrl+1` … `Ctrl+9` hint on each sidebar chat. In the compact sidebar layout only `Ctrl+1` stays on one line; `Ctrl+2`–`Ctrl+9` break after the `+` and stack onto two lines, which throws the rows out of alignment.  Cause: in a compact row the hint takes over the time-ago slot, which is a fixed 30px wide. That fits `17m` and, barely, `Ctrl+1` (a narrow glyph), but not the rest, and the text was allowed to wrap.  ## Change  - The compact time slot no longer wraps, and widens to a fixed 42px while a text hint (`Ctrl+N`) occupies it. Fixed rather than content-sized, so `Ctrl+1` doesn't nudge its row's PR badge off the others'. macOS `⌘N` hints are short and keep the 30px slot. - The hint chip in the regular (non-compact) layout also gets `whitespace_nowrap`. It didn't wrap in my testing, but it had the same latent risk.  ## Screenshot  Rendered with the `sidebar-fixture` example in compact mode with Ctrl held. Left is `main`, right is this branch.  ![Jump hints before and after](https://raw.githubusercontent.com/katulevskiy/zeron/4a6c51a50d7909170a2fd84fa7f100c602b42b32/jump-hint-before-after.png)  The image lives on a separate `pr-assets-jump-hint` branch of my fork, so it isn't part of this diff.  ## Testing  - `cargo test -p zeron-ui --lib jump` passes (9 tests). - Verified visually in the fixture, before and after. No automated test: the layout is only observable in a rendered window.  ## Notes  - Only Linux/Windows-style `Ctrl+N` labels are a

- **Issue #638** (2026-09-29): **Explorer: list running subagents first, longest-running on top**
  *Symptoms*: ## Problem  The Explorer's Subagents list is ordered by spawn time, newest first. A subagent that started a while ago sinks below everything spawned since, so the one that is still running is the hardest to find and manage.  ## Change  `subagent_rows` now orders the list as:  1. **Running** subagents, longest-running first. Oldest-first also keeps this group still when a new subagent starts, since new ones join at its foot. 2. **Done and failed** subagents, most recently updated first, exactly as before.  Nothing else changes: row rendering, the fingerprint (it already hashes row order and status) and the sections layout are untouched.  ## Screenshot  Rendered with GPUI from a fake transcript with three running, two done and one failed subagent. Left is `main`, right is this branch. The 3h-old `Audit chat sync` is buried at the bottom on the left and leads on the right.  ![Subagents list before and after](https://raw.githubusercontent.com/katulevskiy/zeron/4c613b5e74a9dc146546d3e31b093beee7bed9a0/subagents-running-first.png)  The image lives on a separate `pr-assets-subagent-order` branch of my fork, so it isn't part of this diff.  ## Tests  - New `running_subagents_lead_longest_running_first` mixes running, done and failed subagents across several turns. - `subagent_rows_list_only_stamped_spawn_chips_of_the_selected_chat` had to change: it had a running and a done subagent and expected the done one first. - `cargo test -p zeron-ui --lib files::` passes (121 tests).  ## Notes

- **Issue #637** (2026-09-29): **Engine: idle reaper no longer kills a parked session's live subagents**
  *Symptoms*: ## Problem  Background subagents die after a while and can't be resumed. The reaper for parked persistent sessions is the cause.  A background subagent can outlive the turn that spawned it. The parent's `Done` parks the session, and tagged subagent events are deliberately handled without un-parking it. Nothing reset the 30-minute idle reaper, so it counted from the park alone. It cancelled the agent process under a still-running subagent, and the run-end cleanup stamped the subagent chip `failed`. It can't be resumed because the task lived inside the killed process.  ## Fix  - The reaper is disarmed while any subagent sink is live. - Once they settle, the idle window is measured from the last subagent activity. - `ZERON_SESSION_IDLE_MS` overrides the window, following `ZERON_TURN_QUIESCE_MS`, so the behaviour is testable.  ## Tests  `crates/engine/tests/subagent_idle_reap.rs` parks a session after a parent spawns a subagent, keeps the subagent streaming for four idle windows, then finishes it. It fails on `main` (the chip ends `Failed`) and passes with this change. `turn_quiesce` and `codex_subagents` still pass.  ## Notes  - This covers subagents that outlive their parent turn. It doesn't affect a subagent dying while the parent is still mid-turn, since the reaper only runs while parked. - A subagent that hangs forever now keeps the agent process alive until the chat is interrupted or archived, where the reaper would previously have cleaned it up. - A subagent that hasn't em

- **Issue #636** (2026-09-29): **iOS: thinking renders as markdown in the tool-group accordion**
  *Symptoms*: Reasoning parts rendered as plain text on mobile, so thinking showed literal `**bold**`, list markers, and code fences while desktop styled them (#220, desktop-only). Port the desktop `thought_lines` flatten to `crates/mobile`: inline styling (bold/italic/mono, underlined non-clickable links), flattened blocks (lists, quotes, code, tables), faint detail-size prose. Heights stay analytic — the text engine wraps at the painted width instead of desktop's 96-char budget.  Parsing reuses the text-part incremental cache: mended display tree while streaming, canonical tree once settled.  Tests: no literal markers, link non-clickable, width sweep; streaming converges to a fresh parse. `cargo test -p zeron-mobile --lib` 16 passed. Shared core, so Android too; no Swift/UniFFI changes.  <!-- codesmith:footer --> --- <a href="https://app.blacksmith.sh/zeronsh/codesmith/zeron/pr/636?autoLogin=true&ref=codesmith_pr_footer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"><source media="(prefers-color-scheme: light)" srcset="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-light-v2.svg"><img alt="View with [code]smith" src="https://pr-comments-assets.blacksmith.sh/codesmith/view-with-codesmith-dark-v2.svg"></picture></a> <a href="https://backend.blacksmith.sh/track/enable-autofix?expires=1793262460&installation_model_id=425430&pr_number=636&ref=codesmith_pr_footer&repositor

- **Issue #635** (2026-09-29): **Engine: trim glibc malloc arenas on Linux**
  *Symptoms*: ## Summary  On Linux the headless engine can sit at several GB of RSS that it isn't using. On my machine (Fedora 44, 16 cores) it was at 7.2 GB after a day of normal use. `/proc/<pid>/smaps` put 6.6 GB of that in 129 anonymous ~64 MB mappings, which are glibc malloc arenas: the default cap is 8 × cores (128 here). Threads come and go (harness readers, the tokio blocking pool), each one gets an arena, and glibc only trims the top of each heap, so freed memory stays resident.  This keeps glibc as the allocator on Linux, as docs/memory-plan.md decided after mimalloc v3 retained churn. It just calls `mallopt` at the start of `main` on Linux/glibc: at most 2 arenas, and 128 KiB trim and mmap thresholds so freed memory goes back to the system. If `GLIBC_TUNABLES` or `MALLOC_*` already set a value, that value is left alone.  ## Numbers  Engine RSS after 60 s idle, 8 chats × 6 rounds of a 250 KB replay through the real claude-code driver (`scripts/replay-claude.py`):  | Allocator setup | RSS | |---|---| | glibc default | 226 MB | | glibc, `MALLOC_ARENA_MAX=2` | 186 MB | | mimalloc v2 (LD_PRELOAD) | 235 MB | | jemalloc (LD_PRELOAD, background purge) | 172 MB | | glibc, arena_max=2 + 128 KiB trim/mmap (this PR) | **159 MB** |  Re-run on this branch's own release builds: 278 MB before, 191 MB after, with anonymous ≥16 MB mappings going from 31 to 4. With the same settings applied through `GLIBC_TUNABLES`, my daily engine measured 373 MB five minutes after a restart, down from 7.2 GB aft
  **Post-Mortem & Fix Analysis**:
  > Thanks for this, and for the smaps breakdown. I benchmarked it on an 8-core Linux box (glibc 2.43) with 8 chats × 6 rounds of a 250KB reply through the claude-code replay driver. `M_ARENA_MAX=2` does lower idle RSS, but it costs a lot of CPU while chats stream:  | setup | RSS after 60s idle (MB) | engine CPU (s) | |---|---|---| | glibc default (main) | ~390 | ~18 | | this PR as submitted (arena_max=2 + 128KB thresholds) | ~316 | **~110** | | `MALLOC_ARENA_MAX=2` only | ~356 | ~104 | | `MALLOC_ARENA_MAX=4` / `8` | ~348 / ~330 | ~58 / ~35 | | 128KB thresholds only | ~354 | ~20 | | periodic `malloc_trim(0)` (pushed) | **~265** | **~18** |  With two arenas, threads queue on the arena locks: futex calls went from 166k to 1.6M under strace. A single `malloc_trim(0)` on the default engine took idle RSS from 385 to 263MB. Unlike the automatic trim, which only returns the top of each heap, it also releases the free pages inside every arena, and those are what the 129 arenas were holding.  So I 

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

### Incident Patch 1: `92be0f26` (2026-09-29)
**Commit Message**: Fix transcript selection leaking through popups (#556)

* test(ui): capture transcript selection leaking through modals

Add regression coverage for dragging within a modal input and copying with no input selection while transcript text is selected. Both tests currently fail on the existing behavior; no production fix is included.

* fix(ui): isolate transcript selection behind popups

* fix(ui): keep transcript copy in the wizard-borrowed message composer

The question wizard swaps the message input to the generic key context,
so gating the transcript Copy fallback on key_context dropped it while a
question was pending. Mark the message composer input explicitly instead.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Wing <contact@winglee.io>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `crates/ui/src/composer.rs` (modified, +40/-3)
```diff
@@ -1729,6 +1729,12 @@ pub struct ComposerInput {
     /// Key context for the binding map ("Composer", or "PaletteSearch" for
     /// palette filters whose navigation keys must bubble).
     key_context: &'static str,
+    /// Cmd+C with no input selection copies the transcript selection. Only
+    /// the message composer keeps focus while the user reads the transcript;
+    /// dialog and palette fields copy only their own selection. A flag rather
+    /// than `key_context`, which the question wizard swaps while it borrows
+    /// the message input.
+    copies_transcript_selection: bool,
     accessibility_role: Role,
     focus_handle: FocusHandle,
     content: String,
@@ -1836,6 +1842,7 @@ impl ComposerInput {
     ) -> Self {
         Self {
             key_context,
+            copies_transcript_selection: false,
             accessibility_role: Role::MultilineTextInput,
             focus_handle: cx.focus_handle(),
             content: String::new(),
@@ -2791,9 +2798,9 @@ impl ComposerInput {
                 text.clone(),
                 serde_json::json!({ "zeronComposerV1": raw, "text": text }),
             ));
-        } else if let Some(text) = crate::markdown::selection::selected_text() {
-            // The composer keeps focus while the user reads the transcript —
-            // Cmd+C with no input selection copies the markdown selection.
+        } else if self.copies_transcript_selection
+            && let Some(text) = crate::markdown::selection::selected_text()
+        {
             cx.write_to_clipboard(ClipboardItem::new_string(text));
         }
     }
@@ -5453,6 +5460,7 @@ impl Composer {
             let mut input =
                 ComposerInput::with_context("Do anything…", MESSAGE_COMPOSER_CONTEXT, cx);
             input.enable_mentions();
+            input.copies_transcript_selection = true;
             input
         });
         let pickers = cx.new(|cx| Pickers::new(state.clone(), cx));
@@ -9715,6 +9723,9 @@ impl Render for Composer {
     }
 }
 
+#[cfg(test)]
+mod modal_selection_tests;
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -11310,6 +11321,32 @@ mod tests {
         });
     }
 
+    #[gpui::test]
+    fn message_composer_still_copies_transcript_selection(cx: &mut gpui::TestAppContext) {
+        let _selection = crate::markdown::selection::test_state_lock();
+        with_composer_input(cx, |input, window, cx| {
+            let key = "message-composer-copy-test";
+            let text = "Selected transcript text";
+            input.set_text("Unselected draft", cx);
+            assert_eq!(input.key_context, MESSAGE_COMPOSER_CONTEXT);
+            assert!(input.selected_range.is_empty());
+            crate::markdown::selection::begin_with_span(key, text, 0..text.len());
+            crate::markdown::selection::end_active_drag();
+            input.copy(&Copy, window, cx);
+            let copied = cx.read_from_clipboard().and_then(|item| item.text());
+            // The question wizard borrows this input under the generic
+            // context; it is still the message composer.
+            cx.write_to_clipboard(ClipboardItem::new_string(String::new()));
+            input.set_key_context(message_input_context(true), cx);
+            input.copy(&Copy, window, cx);
+            let copied_in_wizard = cx.read_from_clipboard().and_then(|item| item.text());
+            input.set_key_context(MESSAGE_COMPOSER_CONTEXT, cx);
+            crate::markdown::selection::clear_if_owner(key);
+            assert_eq!(copied.as_deref(), Some(text));
+            assert_eq!(copied_in_wizard.as_deref(), Some(text));
+        });
+    }
+
     #[gpui::test]
     fn clipboard_is_readable_outside_zeron_and_lossless_inside(cx: &mut gpui::TestAppContext) {
         with_composer_input(cx, |input, window, cx| {
```

**File**: `crates/ui/src/composer/modal_selection_tests.rs` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+use super::*;
+use crate::markdown::{render, selection};
+use crate::popover;
+use gpui::{StyledText, TestAppContext, VisualTestContext, canvas};
+
+const BACKGROUND_KEY: &str = "modal-selection-background";
+const BACKGROUND_TEXT: &str = "Transcript text behind the modal must never be selected.";
+const INPUT_TEXT: &str = "Editable session title";
+
+struct ModalSelectionHarness {
+    input: Entity<ComposerInput>,
+    modal_open: bool,
+}
+
+impl Render for ModalSelectionHarness {
+    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
+        let theme = Theme::of(cx).clone();
+        let text: SharedString = BACKGROUND_TEXT.into();
+        let styled = StyledText::new(text.clone());
+        let layout = styled.layout().clone();
+        let underlay = canvas(
+            |bounds, window, _| window.insert_hitbox(bounds, gpui::HitboxBehavior::Normal),
+            move |_, hitbox, window, _| {
+                render::paint_text_selection(
+                    window,
+                    hitbox,
+                    &BACKGROUND_KEY.into(),
+                    &text,
+                    &layout,
+                    &theme,
+                );
+            },
+        )
+        .absolute()
+        .size_full();
+        let theme = Theme::of(cx);
+        div()
+            .size_full()
+            .relative()
+            .text_size(px(14.0))
+            .line_height(px(22.0))
+            .child(render::selection_frame_reset())
+            .child(
+                div()
+                    .absolute()
+                    .inset_0()
+                    .flex()
+                    .items_center()
+                    .justify_center()
+                    .child(
+                        render::selectable_text_wrap()
+                            .w(px(560.0))
+                            .child(underlay)
+                            .child(styled),
+                    ),
+            )
+            .when(self.modal_open, |root| {
+                root.child(popover::modal(
+                    "selection-regression-modal",
+                    window.viewport_size(),
+                    popover::dialog_card(theme)
+                        .child(popover::dialog_field(self.input.clone().into_any_element()))
+                        .into_any_element(),
+                ))
+            })
+    }
+}
+
+// Clean up even when a regression assertion panics: selection is process-global.
+struct SelectionCleanup;
+
+impl Drop for SelectionCleanup {
+    fn drop(&mut self) {
+        render::clear_selection_surface(BACKGROUND_KEY);
+    }
+}
+
+fn fixture(
+    cx: &mut TestAppContext,
+    modal_open: bool,
+) -> (Entity<ModalSelectionHarness>, &mut VisualTestContext) {
+    cx.update(|cx| {
+        cx.set_global(Theme::dark());
+        motion::set_reduced_motion(cx, true);
+    });
+    let (view, cx) = cx.add_window_view(|_, cx| ModalSelectionHarness {
+        input: cx.new(|cx| {
+            let mut input = ComposerInput::new("Session title", cx);
+            input.set_text(INPUT_TEXT, cx);
+            input
+        }),
+        modal_open,
+    });
+    cx.simulate_resize(size(px(640.0), px(240.0)));
+    draw(cx);
+    (view, cx)
+}
+
+fn draw(cx: &mut VisualTestContext) {
+    cx.update(|window, cx| {
+        window.refresh();
+        window.draw(cx).clear();
+    });
+}
+
+fn drag(cx: &mut VisualTestContext, start: Point<Pixels>, end: Point<Pixels>) -> bool {
+    cx.simulate_event(MouseDownEvent {
+        button: MouseButton::Left,
+        position: start,
+        click_count: 1,
+        ..Default::default()
+    });
+    let background_started_dragging = selection::is_dragging();
+    cx.simulate_event(MouseMoveEvent {
+        position: end,
+        pressed_button: Some(MouseButton::Left),
+        ..Default::default()
+    });
+    cx.simulate_event(MouseUpEvent {
+        button: MouseButton::Left,
+        position: end,
+        .
```

**File**: `crates/ui/src/markdown/render.rs` (modified, +80/-12)
```diff
@@ -1211,8 +1211,8 @@ pub(super) fn flat_text_presented_element(
     let wash = inline_code_wash(theme);
     let sel_wash = selection_wash(theme);
     let underlay = canvas(
-        |_, _, _| (),
-        move |_, _, window, _| {
+        |bounds, window, _| window.insert_hitbox(bounds, gpui::HitboxBehavior::Normal),
+        move |_, hitbox, window, _| {
             for range in &code_ranges {
                 for rect in range_rects(&layout, range, INLINE_CODE_PAD_X, INLINE_CODE_INSET_Y) {
                     window.paint_quad(quad(
@@ -1251,7 +1251,14 @@ pub(super) fn flat_text_presented_element(
                     offsets: offsets.clone(),
                 })
             });
-            register_selection_listeners(window, &sel_key, &flat_text, &layout, offsets.clone());
+            register_selection_listeners(
+                window,
+                hitbox,
+                &sel_key,
+                &flat_text,
+                &layout,
+                offsets.clone(),
+            );
         },
     )
     .absolute()
@@ -1326,19 +1333,22 @@ fn selection_wash(theme: &Theme) -> Hsla {
 /// bubble. Paints the selection wash under the glyphs, registers the element
 /// into the frame's document-ordered registry (so drags span into adjacent
 /// markdown rows and Cmd+C joins in order), and re-registers the mouse
-/// listeners. Call from a paint-phase canvas that sits UNDER the text.
+/// listeners. Call from a paint-phase canvas that sits UNDER the text, passing
+/// the hitbox inserted in that canvas's prepaint phase.
 pub(crate) fn paint_text_selection(
     window: &mut Window,
+    hitbox: gpui::Hitbox,
     key: &std::sync::Arc<str>,
     text: &SharedString,
     layout: &gpui::TextLayout,
     theme: &Theme,
 ) {
-    paint_text_selection_with_wash(window, key, text, layout, selection_wash(theme));
+    paint_text_selection_with_wash(window, hitbox, key, text, layout, selection_wash(theme));
 }
 
 fn paint_text_selection_with_wash(
     window: &mut Window,
+    hitbox: gpui::Hitbox,
     key: &std::sync::Arc<str>,
     text: &SharedString,
     layout: &gpui::TextLayout,
@@ -1364,7 +1374,7 @@ fn paint_text_selection_with_wash(
             offsets: None,
         })
     });
-    register_selection_listeners(window, key, text, layout, None);
+    register_selection_listeners(window, hitbox, key, text, layout, None);
 }
 
 /// The wrapping div shared by every selectable text region: markdown
@@ -1387,9 +1397,9 @@ fn selectable_text_element(
     let styled = StyledText::new(text.clone()).with_runs(runs);
     let layout = styled.layout().clone();
     let underlay = canvas(
-        |_, _, _| (),
-        move |_, _, window, _| {
-            paint_text_selection_with_wash(window, &key, &text, &layout, wash);
+        |bounds, window, _| window.insert_hitbox(bounds, gpui::HitboxBehavior::Normal),
+        move |_, hitbox, window, _| {
+            paint_text_selection_with_wash(window, hitbox, &key, &text, &layout, wash);
         },
     )
     .absolute()
@@ -1577,6 +1587,7 @@ pub(crate) fn update_drag_at(position: gpui::Point<gpui::Pixels>) -> bool {
 /// outside the element's bounds; frame-scoped, so paint re-registers).
 fn register_selection_listeners(
     window: &mut Window,
+    hitbox: gpui::Hitbox,
     key: &std::sync::Arc<str>,
     text: &SharedString,
     layout: &gpui::TextLayout,
@@ -1589,7 +1600,10 @@ fn register_selection_listeners(
             if phase != DispatchPhase::Bubble || e.button != MouseButton::Left {
                 return;
             }
-            if layout.bounds().contains(&e.position) {
+            // Geometry alone includes text hidden behind popups or clipping.
+            // Only start a selection when this surface receives the press;
+            // subsequent drag events stay window-wide to span text blocks.
+            if hitbox.is_hovered(window) && layout.bounds().contains(&e.position) {
                 let ix = match layout.index_for_position(e.p
```

**File**: `crates/ui/src/transcript.rs` (modified, +3/-3)
```diff
@@ -7769,8 +7769,8 @@ fn user_bubble_text(
     let sel_key: std::sync::Arc<str> = format!("{row_id}:u").into();
     let sel_theme = theme.clone();
     let underlay = canvas(
-        |_, _, _| (),
-        move |_, _, window, cx| {
+        |bounds, window, _| window.insert_hitbox(bounds, gpui::HitboxBehavior::Normal),
+        move |_, hitbox, window, cx| {
             for span in mentions.iter() {
                 for rect in render::range_rects(&layout, &span.range, 0.0, 2.0) {
                     window.paint_quad(quad(
@@ -7783,7 +7783,7 @@ fn user_bubble_text(
                     ));
                 }
             }
-            render::paint_text_selection(window, &sel_key, &text, &layout, &sel_theme);
+            render::paint_text_selection(window, hitbox, &sel_key, &text, &layout, &sel_theme);
             // Passive geometry cache only: no entity update and no notify.
             // `bounds().height` can be the collapsed clip height, so derive
             // the full text height from the wrapped line layouts instead. The
```

---

### Incident Patch 2: `66226055` (2026-09-29)
**Commit Message**: Hide queue attachment filenames and fix hover overflow (#650)

* Hide attachment filenames in message queue

* Keep queue hover backgrounds inside rounded corners

* Name queued attachments in thumbnail tooltips

Row filenames are gone, so thumbnails and the +N chip carry the file or
Appshot name as a tooltip and accessibility label instead.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* Guard the queue row inset against the tray's rounded corners

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Wing <contact@winglee.io>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `crates/ui/src/queue.rs` (modified, +84/-52)
```diff
@@ -80,7 +80,8 @@ const ROW_SLOT: f32 = ROW_HEIGHT + ROW_GAP;
 const ROW_PAD_X: f32 = 8.0;
 const ROW_RADIUS: f32 = 8.0;
 const PANEL_RADIUS: f32 = 16.0;
-const PANEL_PAD_TOP: f32 = 0.0;
+const PANEL_PAD_X: f32 = 4.0;
+const PANEL_PAD_TOP: f32 = 4.0;
 /// The custom 24px queue glyphs have quieter geometry than the legacy set, so
 /// render them slightly larger to preserve the previous optical weight.
 const QUEUE_ICON_SIZE: f32 = 13.0;
@@ -218,6 +219,7 @@ fn queue_visible_text(text: &str, attachments: &[String]) -> String {
 }
 
 /// Presentation-only metadata. Never expose the observed accessibility payload.
+/// Rows show thumbnails only; these names surface as tooltips and labels.
 fn queue_attachment_labels(text: &str, paths: &[String]) -> Vec<String> {
     let presentations = crate::appshots::presentations(text);
     paths
@@ -233,6 +235,12 @@ fn queue_attachment_labels(text: &str, paths: &[String]) -> Vec<String> {
         .collect()
 }
 
+/// Names the attachments folded into the "+N" chip, so they stay discoverable.
+fn queue_hidden_attachments_label(labels: &[String], shown: usize) -> Option<String> {
+    let hidden = labels.get(shown..).filter(|hidden| !hidden.is_empty())?;
+    Some(format!("{} more: {}", hidden.len(), hidden.join(" · ")))
+}
+
 fn queue_panel_surface(theme: &Theme) -> gpui::Div {
     div()
         .occlude()
@@ -247,8 +255,10 @@ fn queue_panel_surface(theme: &Theme) -> gpui::Div {
         .border_1()
         .border_color(theme.border)
         .when(!theme.is_frost(), |el| el.shadow_lg())
-        // Keep visible rows flush with the tray; only the portion tucked behind
-        // the composer needs padding.
+        // GPUI clips children to rectangles, so inset the rows to keep their
+        // hover and editing backgrounds inside the tray's rounded corners.
+        .px(px(PANEL_PAD_X))
+        .pt(px(PANEL_PAD_TOP))
         .pb(px(QUEUE_COMPOSER_OVERLAP))
         .flex()
         .flex_col()
@@ -524,7 +534,7 @@ impl Composer {
             .id(SharedString::from(format!("{key}-row")))
             .h(px(ROW_HEIGHT))
             .flex_none()
-            .px(px(ROW_PAD_X))
+            .px(px(ROW_PAD_X - PANEL_PAD_X))
             .flex()
             .flex_row()
             .items_center()
@@ -560,51 +570,30 @@ impl Composer {
             // from the editing state.
             .when(being_edited, |el| el.child(div().w(px(14.0)).flex_none()))
             .when(!being_edited, |el| {
-                let labels = queue_attachment_labels(&item.text, &item.attachments);
-                let summary = if labels.len() > 1 {
-                    format!("{} attachments · {}", labels.len(), labels.join(" · "))
-                } else {
-                    labels.join(" · ")
-                };
-                let only_images = text.as_ref() == crate::attachments::ATTACHMENT_ONLY_TEXT;
-                let title = if only_images {
-                    summary.clone().into()
-                } else {
-                    text
-                };
-                let mut content = div()
+                let content = div()
                     .flex_1()
                     .min_w_0()
-                    .flex()
-                    .flex_col()
-                    .gap(px(1.0))
-                    .child(
-                        div()
-                            .truncate()
-                            .text_size(px(QUEUE_TEXT_SIZE))
-                            .line_height(px(16.0))
-                            .text_color(theme.text.opacity(0.9))
-                            .child(title),
-                    );
-                if !labels.is_empty() && !only_images {
-                    content = content.child(
-                        div()
-                            .truncate()
-                            .text_size(px(11.0))
-                            .line_height(px(13.0))
-                            .text_color(theme.text_muted)
-                            .child
```

---

### Incident Patch 3: `c74978ab` (2026-09-29)
**Commit Message**: fix: exclude child chats from the command palette (#651)

**File**: `crates/ui/src/shell/command_palette.rs` (modified, +128/-0)
```diff
@@ -142,9 +142,11 @@ impl Shell {
         let state = self.state.read(cx);
         // Global history deliberately ignores the sidebar's project filter and
         // collapsed groups. Archived conversations remain searchable too.
+        // Like the sidebar, only list top-level sessions, not side chats or MCP workers.
         let mut chats: Vec<_> = state
             .chats
             .iter()
+            .filter(|chat| chat.parent_chat_id.is_none())
             .filter(|chat| {
                 let project = state
                     .space_for_chat(chat)
@@ -565,6 +567,132 @@ pub(super) fn command_key_hint(theme: &Theme, keys: &str, label: &'static str) -
 mod tests {
     use super::*;
     use crate::appearance::AppearanceMode;
+    use gpui::{AppContext, TestAppContext};
+
+    fn palette_window(cx: &mut TestAppContext) -> (gpui::WindowHandle<Shell>, tempfile::TempDir) {
+        let dir = tempfile::tempdir().unwrap();
+        cx.update(|cx| {
+            gpui_base::init(cx);
+            cx.set_global(Theme::default());
+            crate::app_menus::init(cx);
+        });
+        let window = cx.add_window(|_, cx| {
+            let state = cx.new(|_| AppState::new());
+            Shell::new(
+                state,
+                EngineBootConfig {
+                    data_dir: dir.path().into(),
+                    ipc_port: 0,
+                    edge_url: "http://127.0.0.1:1".into(),
+                    edge_token: None,
+                    org_id: None,
+                    workos_client_id: None,
+                    default_harness: zeron_proto::HarnessId::Mock,
+                },
+                cx,
+            )
+        });
+        (window, dir)
+    }
+
+    fn chat(id: &str, parent: Option<&str>, archived: bool, age: i64) -> zeron_proto::Chat {
+        serde_json::from_value(serde_json::json!({
+            "id": id, "title": id, "deviceId": "local", "archived": archived,
+            "parentChatId": parent,
+            "createdAt": "2026-09-20T00:00:00Z".parse::<chrono::DateTime<Utc>>().unwrap()
+                - chrono::Duration::minutes(age),
+        }))
+        .unwrap()
+    }
+
+    fn search_chats(shell: &Shell, query: &str, cx: &mut Context<Shell>) -> Vec<String> {
+        shell
+            .command_palette
+            .as_ref()
+            .unwrap()
+            .search
+            .update(cx, |input, cx| {
+                input.set_text(query, cx);
+            });
+        shell
+            .command_entries(cx)
+            .into_iter()
+            .filter_map(|entry| match entry {
+                Entry::Chat(id) => Some(id),
+                _ => None,
+            })
+            .collect()
+    }
+
+    #[gpui::test]
+    fn history_excludes_child_chats_with_and_without_search(cx: &mut TestAppContext) {
+        let (window, _dir) = palette_window(cx);
+        window
+            .update(cx, |shell, window, cx| {
+                shell.state.update(cx, |state, _| {
+                    state.apply_chats(vec![
+                        chat("manual-sidechat", Some("main-session"), false, 0),
+                        chat("mcp-worker", Some("main-session"), false, 1),
+                        chat("archived-sidechat", Some("main-session"), true, 2),
+                        chat("orphan-sidechat", Some("deleted-parent"), false, 3),
+                        chat("main-session", None, false, 4),
+                        chat("archived-session", None, true, 5),
+                    ]);
+                });
+                shell.toggle_command_palette(window, cx);
+                assert_eq!(
+                    search_chats(shell, "", cx),
+                    ["main-session", "archived-session"]
+                );
+                for query in [
+                    "manual-sidechat",
+                    "mcp-worker",
+                    "archived-sidechat",
+                    "orphan-sidechat",
+                ] {
+                    assert!(
+      
```

---

### Incident Patch 4: `d1dc29f6` (2026-09-29)
**Commit Message**: fix: restore antigravity detection, updates and sign-in suppression (#617)

- resolve the managed acp server for update checks instead of path only
- read the release from the server build label, not the branch revision
- check the acp registry for new releases and install them from zeron:
  pinned sha-512 everywhere, google code signature on macos and windows,
  and the reported build label must match the registry version
- launch the newest trusted install and prune superseded versions that
  no running process uses
- stop background probes and chat turns when the server prompts for
  google sign-in on stdout or stderr, without retrying the probe
- suppress the sign-in browser on windows and fall back to zeron's
  noop-browser mode where no true binary exists
- import the crate's process stdio types so the harness builds on windows

**File**: `apps/zeron/src/main.rs` (modified, +3/-0)
```diff
@@ -118,6 +118,9 @@ fn workos_client_id_from_env(edge_token: &Option<String>) -> Option<String> {
 static ALLOC: mimalloc::MiMalloc = mimalloc::MiMalloc;
 
 fn main() -> anyhow::Result<()> {
+    if std::env::args_os().nth(1).as_deref() == Some(std::ffi::OsStr::new("--noop-browser")) {
+        return Ok(());
+    }
     #[cfg(windows)]
     attach_parent_console();
     let cli = Cli::parse();
```

**File**: `apps/zeron/tests/noop_browser.rs` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+#[test]
+fn browser_suppression_exits_without_starting_the_app() {
+    let output = std::process::Command::new(env!("CARGO_BIN_EXE_zeron"))
+        .args([
+            "--noop-browser",
+            "https://accounts.google.com/o/oauth2/auth?client_id=fake&state=test",
+        ])
+        .output()
+        .expect("suppression process");
+    assert!(output.status.success(), "{output:?}");
+    assert!(output.stdout.is_empty(), "{output:?}");
+    assert!(output.stderr.is_empty(), "{output:?}");
+}
```

**File**: `crates/engine/src/harness_updates.rs` (modified, +144/-16)
```diff
@@ -39,6 +39,7 @@ struct Preferences {
 
 #[derive(Clone, Copy)]
 enum LatestSource {
+    AntigravityAcp,
     Claude,
     Npm(&'static str),
     Opencode,
@@ -76,6 +77,7 @@ enum UpdatePlan {
         executable: PathBuf,
         args: &'static [&'static str],
     },
+    AntigravityArchive,
     CodexStandalone(CodexStandaloneInstall),
 }
 
@@ -237,11 +239,11 @@ fn provider(id: HarnessId) -> ProviderSpec {
         },
         HarnessId::Antigravity => ProviderSpec {
             version_args: &["--version"],
-            latest: LatestSource::Manual,
+            latest: LatestSource::AntigravityAcp,
             // Zeron installs a pinned ACP server archive. It has no registered
             // self-update command; custom binaries remain installer-managed.
             update_args: None,
-            manual_command: "Update Zeron or replace the configured Antigravity ACP server",
+            manual_command: "Update the configured Antigravity ACP server",
         },
         HarnessId::Mock => ProviderSpec {
             version_args: &["--version"],
@@ -267,13 +269,34 @@ fn update_plan(harness: HarnessId, executable: &Path) -> Result<UpdatePlan, Stri
     {
         return Ok(UpdatePlan::CodexStandalone(install));
     }
+    if harness == HarnessId::Antigravity
+        && zeron_harness::acp::is_managed_antigravity_server(executable)
+    {
+        return Ok(UpdatePlan::AntigravityArchive);
+    }
     Err("this provider requires a manual update".into())
 }
 
 fn can_apply_update(harness: HarnessId, executable: &Path) -> bool {
     update_plan(harness, executable).is_ok()
 }
 
+fn manual_update_command(harness: HarnessId, executable: &Path, can_apply: bool) -> Option<String> {
+    if can_apply {
+        return None;
+    }
+    if harness == HarnessId::Antigravity
+        && zeron_harness::acp::is_managed_antigravity_server(executable)
+    {
+        return Some("Update Zeron to install this release".into());
+    }
+    Some(
+        claude_package_manager_command_for(harness, executable)
+            .unwrap_or_else(|| provider(harness).manual_command.to_string()),
+    )
+    .filter(|command| !command.is_empty())
+}
+
 struct ActiveUpdate {
     cancel: CancellationToken,
     automatic: bool,
@@ -293,6 +316,9 @@ struct Inner {
     shutdown: CancellationToken,
     worker: Mutex<Option<tokio::task::JoinHandle<()>>>,
     client: reqwest::Client,
+    /// the registry release the last check reported, installed verbatim by
+    /// apply so a registry change in between cannot swap what gets installed.
+    antigravity_release: Mutex<Option<zeron_harness::acp::AntigravityRelease>>,
 }
 
 /// Cloneable engine service exposed to RPC and the periodic worker.
@@ -406,6 +432,7 @@ impl HarnessUpdateCoordinator {
                 check_slots: tokio::sync::Semaphore::new(2),
                 shutdown: CancellationToken::new(),
                 worker: Mutex::new(None),
+                antigravity_release: Mutex::new(None),
                 client: reqwest::Client::builder()
                     .user_agent(concat!("zeron/", env!("CARGO_PKG_VERSION")))
                     .timeout(COMMAND_TIMEOUT)
@@ -566,7 +593,7 @@ impl HarnessUpdateCoordinator {
         };
         let spec = provider(harness);
         let version_lease = self.inner.registry.execution_lease(harness).await;
-        let installed = run_version_command(&executable, spec.version_args).await;
+        let installed = run_version_command(harness, &executable, spec.version_args).await;
         drop(version_lease);
         let installed = match installed {
             Ok(version) => version,
@@ -579,16 +606,14 @@ impl HarnessUpdateCoordinator {
         };
         let source = classify_source(&executable);
         let can_apply = can_apply_update(harness, &executable);
-        let manual_command = (!can_apply)
-            .then(|| {
-                claude_package_manager_command_for(harness, &executable)
-                    .unwrap_or_else(
```

**File**: `crates/harness/Cargo.toml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ zip.workspace = true
 libc.workspace = true
 
 [target.'cfg(windows)'.dependencies]
-windows-sys = { version = "0.61", features = ["Win32_Foundation", "Win32_Globalization", "Win32_Security", "Win32_System_Console", "Win32_System_JobObjects", "Win32_System_Pipes", "Win32_System_SystemInformation", "Win32_System_Threading"] }
+windows-sys = { version = "0.61", features = ["Win32_Foundation", "Win32_Globalization", "Win32_Security", "Win32_Security_Cryptography", "Win32_Security_Cryptography_Catalog", "Win32_Security_Cryptography_Sip", "Win32_Security_WinTrust", "Win32_System_Console", "Win32_System_Diagnostics_ToolHelp", "Win32_System_JobObjects", "Win32_System_Pipes", "Win32_System_SystemInformation", "Win32_System_Threading"] }
 
 [dev-dependencies]
 tokio = { workspace = true, features = ["test-util"] }
```

**File**: `crates/harness/src/acp/mod.rs` (modified, +837/-37)
```diff
@@ -40,6 +40,7 @@ use std::collections::VecDeque;
 use std::path::{Path, PathBuf};
 use std::time::Duration;
 
+use crate::process::{ChildStdin, ChildStdout};
 use async_trait::async_trait;
 use futures::StreamExt;
 use futures::future::BoxFuture;
@@ -58,7 +59,9 @@ use crate::process::{Command, Stdio};
 use crate::scratch::ScratchDir;
 use child::Child;
 pub(crate) mod child;
-use crate::{Harness, HarnessError, RunControls, Signal, send_signal, shutdown_child};
+use crate::{
+    CancellationToken, Harness, HarnessError, RunControls, Signal, send_signal, shutdown_child,
+};
 use normalize::{map_update, parse_commands, preferred_allow_option};
 use subagent::SubagentTracker;
 use subagent_devin::DevinTracker;
@@ -501,6 +504,55 @@ fn pi_spec() -> AcpAgentSpec {
 /// google's builds as the acp registry lists them (`antigravity-acp`); `None`
 /// on platforms without one, where only an explicit override can launch.
 fn antigravity_archive() -> Option<crate::archive_install::ArchivePin> {
+    let (url, entry, sha512) = if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
+        (
+            "https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.2.1-darwin-arm64.zip",
+            "agy_acp_server.par",
+            "c0049b1f423ffdf0e6a79a6caa104a27b6368522b1eb2c67d9eeed1424af2a07898a66b475b0824a734a0bdd01264473a7d67d1550357a8607fb136507b0afae",
+        )
+    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
+        (
+            "https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.2.1-darwin-x86_64.zip",
+            "agy_acp_server.par",
+            "790541c7e7bbbac1cb15bb4a77b02c53f30c997090487fbf42df16846e2e5d8d4f1cec92038d88956fbec33331ebacefe8faf974aad0690aadc2332215712ff2",
+        )
+    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
+        (
+            "https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.2.1-linux-x86_64.zip",
+            "agy_acp_server.par",
+            "dd9b778479dbfc753661d63ff66a3235e7249e8451af12adc11d26509172de1ff50452c3af57684009bb944314bd587b2be200bab17df743a2706ce4067d6731",
+        )
+    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
+        (
+            "https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.2.1-linux-arm64.zip",
+            "agy_acp_server.par",
+            "d907f928609ff2232bfeeec9177fe925d3e02e1773295cfb30097e5c4e134758021bff916ba5ae2e2e2ff81d374564349f268f92a4577bc88370537011473e29",
+        )
+    } else if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
+        (
+            "https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.2.1-windows-x86_64.zip",
+            "agy_acp_server.exe",
+            "515c0af1d00164ca3a608f4ef04caa4ef8045ffa94a3ef2405c9b43c87c7a74c9f71a232c81917353dc3f2d49b69230f935d2ebfa28f7ee021b5aa088f3fa554",
+        )
+    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
+        (
+            "https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.2.1-windows-arm64.zip",
+            "agy_acp_server.exe",
+            "ae3f4c2d2255c03d4d9548e10a760a107c41c99e4c6c710bd82758791e4fd497b75bdef0cd2cfd7fdff1a5bb2fee7afd81f5d043da92ab52dce5505dd2aa58b3",
+        )
+    } else {
+        return None;
+    };
+    Some(crate::archive_install::ArchivePin {
+        name: "antigravity-acp",
+        version: "1.2.1",
+        url,
+        entry,
+        sha512,
+    })
+}
+
+fn antigravity_legacy_archive() -> Option<crate::archive_install::ArchivePin> {
     let (url, entry, sha512) = if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
         (
             "https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-agy_acp_server_1.1.1-darwin-arm64.zip",
@@ -543,6 +595,349 @@ fn antigravity_archive() -> Option<crate::archive_install::ArchivePin> {
     })
 }
 
+const ANTIGRAVITY_ARCHIVE_NAME: &str = "antigravity-acp";
+

```

---

### Incident Patch 5: `e2caf64a` (2026-09-29)
**Commit Message**: fix(ui): support file drag and drop in side chats (#612)

**File**: `crates/ui/src/shell.rs` (modified, +5/-60)
```diff
@@ -60,6 +60,9 @@ use crate::transcript::{self, Transcript, TranscriptEvent};
 use crate::workspace_links::resolve_workspace_file_link;
 
 mod actions_ui;
+mod chat_dropzone;
+#[cfg(test)]
+mod chat_dropzone_tests;
 mod command_palette;
 mod files_panel;
 mod harness_updates;
@@ -9872,17 +9875,7 @@ impl Shell {
             None
         };
         let status = self.render_status_strip(composer_width, cx);
-        // Attachment dropzone over the ENTIRE conversation column (transcript
-        // + composer, not just the pill). OS images keep using the upload
-        // pipeline; workspace files/directories and file tabs become the same
-        // projected file-mention chips the composer already understands.
-        // The veil itself uses typed `drag_over` styles below. Do not cache
-        // drag presence in shell state: the platform's `FileDrop::Exited`
-        // clears GPUI's external payload without sending one last mouse-move,
-        // so a cached bit can survive and reappear during an unrelated drag
-        // such as a pane resize.
-        div()
-            .id("chat-dropzone")
+        self.chat_dropzone("chat-dropzone", self.composer.clone(), cx)
             .track_focus(&self.navigation_focus.main)
             .capture_any_mouse_down(cx.listener(|this, _, window, cx| {
                 this.capture_navigation_focus(false, false, window, cx);
@@ -9894,28 +9887,6 @@ impl Shell {
             .h_full()
             .flex()
             .flex_col()
-            .on_drop(cx.listener(|this, paths: &gpui::ExternalPaths, _, cx| {
-                let paths = paths.paths().to_vec();
-                this.composer
-                    .update(cx, |composer, cx| composer.add_paths(paths, cx));
-                cx.notify();
-            }))
-            .on_drop::<WorkspacePathDrag>(cx.listener(
-                |this, payload: &WorkspacePathDrag, window, cx| {
-                    this.composer.update(cx, |composer, cx| {
-                        composer.add_workspace_path(&payload.path, payload.is_directory, window, cx)
-                    });
-                    cx.notify();
-                },
-            ))
-            .on_drop::<RightTabDrag>(cx.listener(|this, payload: &RightTabDrag, window, cx| {
-                if let Some(path) = &payload.workspace_path {
-                    this.composer.update(cx, |composer, cx| {
-                        composer.add_workspace_path(&path.path, path.is_directory, window, cx)
-                    });
-                }
-                cx.notify();
-            }))
             // The hero is deliberately outside the transcript EdgeFade below:
             // it must paint under the overlaid titlebar instead of becoming
             // fully transparent across the titlebar's inset band.
@@ -10038,33 +10009,7 @@ impl Shell {
                         }),
                 )
             })
-            .child(
-                div()
-                    .id("attachment-drop-overlay")
-                    .absolute()
-                    .inset_0()
-                    .opacity(0.0)
-                    .bg(theme.scrim().opacity(0.4 / 0.6))
-                    .flex()
-                    .items_center()
-                    .justify_center()
-                    .text_size(crate::typography::ui_rems(13.0))
-                    .text_color(theme.text)
-                    // GPUI matches these styles against the active payload's
-                    // concrete TypeId. Resize markers therefore cannot reveal
-                    // this overlay, even after an external drag exits without
-                    // another move event.
-                    .drag_over::<gpui::ExternalPaths>(|style, _, _, _| style.opacity(1.0))
-                    .drag_over::<WorkspacePathDrag>(|style, _, _, _| style.opacity(1.0))
-                    .drag_over::<RightTabDrag>(|style, tab, _, _| {
-                        if tab.workspace_path.is_some() {
-                            s
```

**File**: `crates/ui/src/shell/chat_dropzone.rs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+use super::*;
+
+impl Shell {
+    /// The entire conversation receives attachments in its own composer,
+    /// regardless of which pane had keyboard focus when the drag started.
+    pub(super) fn chat_dropzone(
+        &self,
+        id: impl Into<gpui::ElementId>,
+        composer: Entity<Composer>,
+        cx: &mut Context<Self>,
+    ) -> gpui::Stateful<gpui::Div> {
+        let images = composer.clone();
+        let workspace = composer.clone();
+        div()
+            .id(id)
+            .relative()
+            .on_drop(cx.listener(move |_, paths: &gpui::ExternalPaths, _, cx| {
+                images.update(cx, |composer, cx| {
+                    composer.add_paths(paths.paths().to_vec(), cx)
+                });
+                cx.notify();
+            }))
+            .on_drop::<WorkspacePathDrag>(cx.listener(
+                move |_, payload: &WorkspacePathDrag, window, cx| {
+                    workspace.update(cx, |composer, cx| {
+                        composer.add_workspace_path(&payload.path, payload.is_directory, window, cx)
+                    });
+                    cx.notify();
+                },
+            ))
+            .on_drop::<RightTabDrag>(cx.listener(move |_, payload: &RightTabDrag, window, cx| {
+                if let Some(path) = &payload.workspace_path {
+                    composer.update(cx, |composer, cx| {
+                        composer.add_workspace_path(&path.path, path.is_directory, window, cx)
+                    });
+                }
+                cx.notify();
+            }))
+    }
+
+    pub(super) fn attachment_drop_overlay(theme: &Theme) -> gpui::Stateful<gpui::Div> {
+        // Use typed drag styles rather than cached shell state: an external
+        // FileDrop::Exited clears the payload without a final mouse move.
+        // Resize markers and non-file tabs must never reveal the overlay.
+        div()
+            .id("attachment-drop-overlay")
+            .absolute()
+            .inset_0()
+            .opacity(0.0)
+            .bg(theme.scrim().opacity(0.4 / 0.6))
+            .flex()
+            .items_center()
+            .justify_center()
+            .text_size(crate::typography::ui_rems(13.0))
+            .text_color(theme.text)
+            .drag_over::<gpui::ExternalPaths>(|style, _, _, _| style.opacity(1.0))
+            .drag_over::<WorkspacePathDrag>(|style, _, _, _| style.opacity(1.0))
+            .drag_over::<RightTabDrag>(|style, tab, _, _| {
+                if tab.workspace_path.is_some() {
+                    style.opacity(1.0)
+                } else {
+                    style
+                }
+            })
+            .child("Drop to attach")
+    }
+}
```

**File**: `crates/ui/src/shell/chat_dropzone_tests.rs` (added, +285/-0)
```diff
@@ -0,0 +1,285 @@
+use super::*;
+use gpui::{AppContext, TestAppContext, VisualTestContext};
+
+struct DropHost {
+    shell: Entity<Shell>,
+    full_shell: bool,
+    _data_dir: tempfile::TempDir,
+}
+
+impl Render for DropHost {
+    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
+        if self.full_shell {
+            return div()
+                .size_full()
+                .child(self.shell.clone())
+                .into_any_element();
+        }
+        self.shell.update(cx, |shell, cx| {
+            let main = shell.render_main(window, 400., 400., cx);
+            let right = shell.render_right_pane(window, cx);
+            div()
+                .size_full()
+                .flex()
+                .flex_col()
+                .child(div().h(px(40.)).child(shell.render_right_tab_strip(cx)))
+                // Supply the tree/search payload without needing an engine
+                // to enumerate a checkout. Targets and file tabs are real UI.
+                .child(
+                    div().h(px(24.)).flex().children(
+                        [("file", "src/tree.rs", false), ("directory", "src", true)]
+                            .into_iter()
+                            .map(|(id, path, directory)| {
+                                div()
+                                    .id(id)
+                                    .debug_selector(move || id.into())
+                                    .w(px(100.))
+                                    .h_full()
+                                    .on_drag(
+                                        WorkspacePathDrag::new(path.into(), directory),
+                                        |payload, _, _, cx| {
+                                            crate::files::workspace_path_drag_ghost(payload, cx)
+                                        },
+                                    )
+                                    .child(id)
+                            }),
+                    ),
+                )
+                .child(
+                    div()
+                        .flex()
+                        .flex_1()
+                        .min_h_0()
+                        .child(div().w(px(400.)).h_full().child(main))
+                        .child(right),
+                )
+                .into_any_element()
+        })
+    }
+}
+
+fn setup(cx: &mut TestAppContext) -> (Entity<Shell>, &mut VisualTestContext) {
+    setup_with_shell(cx, false)
+}
+
+fn setup_with_shell(
+    cx: &mut TestAppContext,
+    full_shell: bool,
+) -> (Entity<Shell>, &mut VisualTestContext) {
+    let dir = tempfile::tempdir().unwrap();
+    cx.update(|cx| {
+        gpui_base::init(cx);
+        cx.set_global(Theme::default());
+        crate::app_menus::init(cx);
+        settings::init(UiSettings::default(), dir.path(), cx);
+        crate::history::init(
+            Default::default(),
+            Default::default(),
+            Default::default(),
+            Default::default(),
+            cx,
+        );
+    });
+    let (host, cx) = cx.add_window_view(|_, cx| {
+        let shell = cx.new(|cx| {
+            let state = cx.new(|_| AppState::new());
+            let mut shell = Shell::new(
+                state,
+                EngineBootConfig {
+                    data_dir: dir.path().into(),
+                    ipc_port: 0,
+                    edge_url: "http://127.0.0.1:1".into(),
+                    edge_token: None,
+                    org_id: None,
+                    workos_client_id: None,
+                    default_harness: zeron_proto::HarnessId::Mock,
+                },
+                cx,
+            );
+            // This fixture has no engine. Keep state notifications from
+            // invoking the shell's disconnect cleanup of all side chats.
+            shell._state_observation = cx.observe(&shell.state, |_, _, _| {});
+            shell.state.update(cx, |state, _| {
+                s
```

**File**: `crates/ui/src/shell/side_chats.rs` (modified, +2/-1)
```diff
@@ -337,7 +337,7 @@ impl Shell {
                     cx,
                 ))
         });
-        div()
+        self.chat_dropzone(("side-chat-dropzone", id), composer.clone(), cx)
             .size_full()
             .flex()
             .flex_col()
@@ -358,6 +358,7 @@ impl Shell {
                     .children(pill),
             )
             .child(div().flex_none().child(composer))
+            .child(Self::attachment_drop_overlay(Theme::of(cx)))
             .into_any_element()
     }
 }
```

---

### Incident Patch 6: `e5be4822` (2026-09-29)
**Commit Message**: fix(ui): preserve fractional terminal scroll movement (#615)

**File**: `crates/ui/src/terminal/panel.rs` (modified, +106/-1)
```diff
@@ -262,6 +262,8 @@ struct TerminalTab {
     terminal_id: Option<String>,
     target_device_id: Option<String>,
     emulator: Emulator,
+    /// Fractional wheel movement in rows, retained across trackpad events.
+    scroll_remainder: f32,
     exited: Option<i32>,
     last_seq: u64,
     coalescer: InputCoalescer,
@@ -490,6 +492,7 @@ impl TerminalPanel {
             terminal_id: None,
             target_device_id: None,
             emulator: Emulator::new(80, 24),
+            scroll_remainder: 0.0,
             exited: None,
             last_seq: 0,
             coalescer: InputCoalescer::default(),
@@ -1790,8 +1793,21 @@ impl Render for TerminalPanel {
                                 f32::from(delta.y) / line_h
                             }
                         };
-                        let step = lines.round() as i32;
+                        let chat = this.selected_chat(cx);
+                        let Some(tabs) = this.chats.get_mut(&chat) else {
+                            return;
+                        };
+                        let Some(tab) = tabs.tabs.get_mut(tabs.active) else {
+                            return;
+                        };
+                        if event.touch_phase == gpui::TouchPhase::Started {
+                            tab.scroll_remainder = 0.0;
+                        }
+                        tab.scroll_remainder += lines;
+                        let step = tab.scroll_remainder.trunc() as i32;
+                        tab.scroll_remainder -= step as f32;
                         this.scroll_active(step, cx);
+                        cx.stop_propagation();
                     }))
                     .child(TerminalElement::new(cx.entity(), focused))
                     .children(scrollbar),
@@ -1804,6 +1820,95 @@ impl Render for TerminalPanel {
 mod tests {
     use super::*;
 
+    #[gpui::test]
+    fn slow_trackpad_scroll_accumulates_per_terminal(cx: &mut gpui::TestAppContext) {
+        use gpui::{AppContext, Modifiers, ScrollWheelEvent, TouchPhase, point};
+
+        cx.update(|cx| {
+            gpui_base::init(cx);
+            cx.set_global(Theme::default());
+        });
+        let (panel, cx) = cx.add_window_view(|_, cx| {
+            let state = cx.new(|_| {
+                let mut state = AppState::new();
+                state.selected_chat = Some("chat".into());
+                state
+            });
+            let mut panel = TerminalPanel::new(state, cx);
+            for title in ["First", "Second"] {
+                let key = panel.reserve_tab_for_chat("chat".into(), title, cx);
+                let tab = panel.tab_mut("chat", key).unwrap();
+                for _ in 0..200 {
+                    tab.emulator.feed(b"scrollback\r\n");
+                }
+            }
+            panel
+        });
+        cx.update(|window, cx| window.draw(cx).clear());
+        let geometry = panel.read_with(cx, |panel, _| panel.geometry.unwrap());
+        let mut scroll = |delta, phase| {
+            cx.simulate_event(ScrollWheelEvent {
+                position: geometry.bounds.center(),
+                delta,
+                modifiers: Modifiers::default(),
+                touch_phase: phase,
+            })
+        };
+        // Every event is smaller than half a row: rounding each one loses all movement.
+        for _ in 0..40 {
+            scroll(
+                ScrollDelta::Pixels(point(px(0.0), px(geometry.line_h / 4.0))),
+                TouchPhase::Moved,
+            );
+        }
+        panel.read_with(cx, |panel, cx| {
+            assert_eq!(panel.active_tab(cx).unwrap().emulator.display_offset(), 10);
+        });
+        // Signed fractions work in reverse too; mouse-wheel rows stay exact.
+        let mut scroll = |delta, phase| {
+            cx.simulate_event(ScrollWheelEvent {
+                position: geometry.bounds.center(),
+                delta,
+                modifiers: Modifiers::default(),
+         
```

---

### Incident Patch 7: `9b756647` (2026-09-28)
**Commit Message**: Fix completion discovery in unsaved side chats (#588)

**File**: `crates/ui/src/composer.rs` (modified, +169/-53)
```diff
@@ -6306,62 +6306,57 @@ impl Composer {
         self.sync_mention_controls(cx);
     }
 
-    fn file_search_params(&self, query: &str, cx: &App) -> Option<serde_json::Value> {
-        let selected_worktree = match self.pickers.read(cx).checkout_plan() {
-            crate::pickers::CheckoutPlan::ReuseWorktree { path, .. } => Some(path),
-            _ => None,
-        };
-        let (params, target) = {
-            let state = self.state.read(cx);
-            let mut params = serde_json::Map::new();
-            params.insert("query".into(), query.into());
-            let target = if let Some(chat) = state.selected_chat_row() {
-                params.insert("chatId".into(), chat.id.clone().into());
-                params.insert("cwd".into(), chat.cwd.clone().into());
-                Some(chat.device_id.clone())
-            } else if let Some(space) = state.selected_space_row() {
-                params.insert("spaceId".into(), space.id.clone().into());
-                params.insert("cwd".into(), space.path.clone().into());
-                if let Some(path) = selected_worktree {
-                    params.insert("path".into(), path.into());
-                }
-                Some(space.device_id.clone())
-            } else {
-                None
-            };
-            if let Some(target) = &target {
-                params.insert("targetDeviceId".into(), target.clone().into());
+    /// File mentions and provider catalogs share a workspace target. A new
+    /// side chat inherits its parent's checkout but has no persisted row until
+    /// its first send, so discovery must address the parent in the meantime.
+    fn completion_workspace_params(&self, cx: &App) -> Option<serde_json::Value> {
+        let state = self.state.read(cx);
+        if let Some(chat) = state.selected_chat_row() {
+            let chat_id = chat
+                .parent_chat_id
+                .as_deref()
+                .filter(|_| state.side_chat_unsaved())
+                .unwrap_or(&chat.id);
+            Some(serde_json::json!({
+                "chatId": chat_id,
+                "targetDeviceId": chat.device_id,
+                // Include the inherited cwd in the cache identity, too.
+                "cwd": chat.cwd,
+            }))
+        } else if let Some(space) = state.selected_space_row() {
+            let mut params = serde_json::json!({
+                "spaceId": space.id,
+                "targetDeviceId": space.device_id,
+                "cwd": space.path,
+            });
+            if let crate::pickers::CheckoutPlan::ReuseWorktree { path, .. } =
+                self.pickers.read(cx).checkout_plan()
+            {
+                params["path"] = path.into();
             }
-            (serde_json::Value::Object(params), target)
-        };
-        target.map(|_| params)
+            Some(params)
+        } else {
+            None
+        }
+    }
+
+    fn file_search_params(&self, query: &str, cx: &App) -> Option<serde_json::Value> {
+        let mut params = self.completion_workspace_params(cx)?;
+        params["query"] = query.into();
+        Some(params)
     }
 
     fn catalog_params(&self, cx: &App) -> serde_json::Value {
-        let harness = self.pickers.read(cx).resolved(cx).harness;
-        let selected_worktree = match self.pickers.read(cx).checkout_plan() {
-            crate::pickers::CheckoutPlan::ReuseWorktree { path, .. } => Some(path),
-            _ => None,
-        };
-        let mut params = serde_json::json!({ "harness": harness });
-        {
-            let state = self.state.read(cx);
-            if let Some(chat) = state.selected_chat_row() {
-                params["chatId"] = chat.id.clone().into();
-                params["targetDeviceId"] = chat.device_id.clone().into();
-                // Include the resolved cwd in the cache identity, too.
-                params["cwd"] = chat.cwd.clone().into();
-            } else if let Some(space) = state.selected_
```

---

### Incident Patch 8: `cdec9726` (2026-09-26)
**Commit Message**: Fix side chat composer conversation width (#567)

**File**: `crates/ui/src/shell/side_chats.rs` (modified, +6/-4)
```diff
@@ -313,10 +313,12 @@ impl Shell {
         };
         let transcript = tab.transcript.clone();
         let composer = tab.composer.clone();
-        // The main composer is driven by the shell's dock (settled, docked)
-        // and fed the column width; give the side chat's the same inputs so
-        // both take the same height branch.
-        let width = self.right_visible_width(cx);
+        // Share the main chat's docked width cap and responsive padding.
+        let width = composer_target_width(
+            self.right_visible_width(cx),
+            settings::transcript_width(cx),
+            true,
+        );
         composer.update(cx, |composer, cx| {
             composer.set_dock_frame(crate::composer_dock::DockFrame::settled(true), cx);
             composer.set_available_width(width, cx);
```

---

### Incident Patch 9: `f8f9c97f` (2026-09-26)
**Commit Message**: PR badges: always show the PR icon, drop the # prefix

Sidebar/session-row badges now carry the pull-request icon like the
composer's, and every badge shows the bare number. The hover tooltip
keeps "PR #N". Applies to the desktop app and iOS.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `apps/ios/Zeron/Views/PullRequestBadge.swift` (modified, +3/-5)
```diff
@@ -35,11 +35,9 @@ struct PullRequestBadge: View {
             guard let url = URL(string: summary.url) else { return }
             openURL(url)
         } label: {
-            HStack(spacing: composer ? 6 : 0) {
-                if composer {
-                    LineIconView(.pullRequest, size: 14, color: summary.state.badgeColor.opacity(0.9))
-                }
-                Text("#\(summary.number)")
+            HStack(spacing: composer ? 6 : 3) {
+                LineIconView(.pullRequest, size: composer ? 14 : 10, color: summary.state.badgeColor.opacity(0.9))
+                Text("\(summary.number)")
                     .font(Theme.mono(composer ? 12 : 10, weight: .medium))
                     .lineLimit(1)
             }
```

**File**: `crates/ui/src/change_requests.rs` (modified, +10/-12)
```diff
@@ -46,7 +46,7 @@ impl ChangeRequestBadgeModel {
             ChangeRequestState::Closed => ("Closed", ChangeRequestBadgeTone::Closed),
         };
         Self {
-            number: format!("#{}", summary.number).into(),
+            number: summary.number.to_string().into(),
             state_label,
             title: summary.title.replace(['\r', '\n'], " ").into(),
             tone,
@@ -87,7 +87,7 @@ impl Render for ChangeRequestTooltip {
                     .font_weight(gpui::FontWeight::MEDIUM)
                     .text_color(self.model.tone.color(theme))
                     .child(SharedString::from(format!(
-                        "PR {} · {}",
+                        "PR #{} · {}",
                         self.model.number, self.model.state_label
                     ))),
             )
@@ -160,7 +160,7 @@ fn render_pull_request_badge(
         .flex()
         .flex_row()
         .items_center()
-        .gap(px(if composer { 5.0 } else { 0.0 }))
+        .gap(px(if composer { 5.0 } else { 3.0 }))
         .px(px(if composer { 7.0 } else { 4.0 }))
         .rounded(px(if composer { 6.0 } else { 4.0 }))
         .bg(color.opacity(0.08))
@@ -180,14 +180,12 @@ fn render_pull_request_badge(
                 })
                 .tooltip_show_delay(std::time::Duration::from_millis(350))
         })
-        .when(composer, |element| {
-            element.child(
-                crate::icons::icon(crate::icons::PULL_REQUEST)
-                    .size(px(11.0))
-                    .flex_none()
-                    .text_color(color.opacity(0.85)),
-            )
-        })
+        .child(
+            crate::icons::icon(crate::icons::PULL_REQUEST)
+                .size(px(if composer { 11.0 } else { 10.0 }))
+                .flex_none()
+                .text_color(color.opacity(0.85)),
+        )
         // Monospace digits give the badge a stable tabular width as PR numbers change.
         .child(
             div()
@@ -648,7 +646,7 @@ mod tests {
             summary.state = state;
             summary.title = "First line\nSecond line".into();
             let model = ChangeRequestBadgeModel::from_summary(&summary);
-            assert_eq!(model.number, "#90");
+            assert_eq!(model.number, "90");
             assert_eq!(model.state_label, label);
             assert_eq!(model.tone, tone);
             assert_eq!(model.title, "First line Second line");
```

---

### Incident Patch 10: `67524512` (2026-09-25)
**Commit Message**: fix(ui): keep project actions visible during initial load (#548)

Co-authored-by: wing-anara <wing_13@live.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `crates/ui/src/project_actions.rs` (modified, +96/-11)
```diff
@@ -128,8 +128,8 @@ impl ProjectActionsController {
             .and_then(ProjectActionsStatus::snapshot)
     }
 
-    /// Snapshot used to keep the control recoverable when the first request
-    /// fails before any host state has been cached.
+    /// Keep a surface for the active project while its first request is pending
+    /// or has failed, without borrowing another project's cached actions.
     pub fn visible_snapshot(&self) -> Option<ProjectActionsSnapshot> {
         let key = self.active.as_ref()?;
         match self.active_status()? {
@@ -139,28 +139,31 @@ impl ProjectActionsController {
                 snapshot: Some(snapshot),
                 ..
             } => Some(snapshot.clone()),
-            ProjectActionsStatus::Unavailable { snapshot: None, .. } => {
+            ProjectActionsStatus::Idle
+            | ProjectActionsStatus::Loading
+            | ProjectActionsStatus::Unavailable { snapshot: None, .. } => {
                 Some(ProjectActionsSnapshot {
                     space_id: key.space_id.clone(),
                     actions: Vec::new(),
                     importable_actions: Vec::new(),
                     project_file_issue: None,
                 })
             }
-            ProjectActionsStatus::Idle
-            | ProjectActionsStatus::Loading
-            | ProjectActionsStatus::Unsupported => None,
+            ProjectActionsStatus::Unsupported => None,
         }
     }
 
     pub fn begin_load(&mut self, key: &ProjectActionsKey) -> u64 {
         self.generation = self.generation.wrapping_add(1);
         let generation = self.generation;
-        if self
-            .cache
-            .get(key)
-            .and_then(ProjectActionsStatus::snapshot)
-            .is_none()
+        // Revalidation must not flash a loading control for a host already
+        // known not to support actions.
+        if !matches!(self.cache.get(key), Some(ProjectActionsStatus::Unsupported))
+            && self
+                .cache
+                .get(key)
+                .and_then(ProjectActionsStatus::snapshot)
+                .is_none()
         {
             self.cache
                 .insert(key.clone(), ProjectActionsStatus::Loading);
@@ -283,6 +286,85 @@ mod tests {
         assert!(show_action_label(420.0));
     }
 
+    #[test]
+    fn first_load_keeps_an_empty_disabled_surface_until_the_response() {
+        for actions in [vec![], vec![action("dev", false)]] {
+            let mut controller = ProjectActionsController::default();
+            let key = ProjectActionsKey {
+                device_id: "local".into(),
+                space_id: "project".into(),
+            };
+            controller.activate(Some(key.clone()));
+            controller
+                .cache
+                .insert(key.clone(), ProjectActionsStatus::Idle);
+            assert!(controller.visible_snapshot().unwrap().actions.is_empty());
+            assert!(!controller.active_status().unwrap().can_run());
+
+            let generation = controller.begin_load(&key);
+            // Rendering while the response is delayed must keep the surface
+            // without making any action available or restarting the request.
+            for _ in 0..3 {
+                assert!(!controller.activate(Some(key.clone())));
+                let visible = controller.visible_snapshot().unwrap();
+                assert_eq!(visible.space_id, key.space_id);
+                assert!(visible.actions.is_empty());
+                assert!(!controller.active_status().unwrap().can_run());
+                assert_eq!(controller.generation, generation);
+            }
+            assert!(controller.accept_load(
+                &key,
+                generation,
+                Ok(ProjectActionsSnapshot {
+                    space_id: key.space_id.clone(),
+                    actions: actions.clone(),
+                    importable_actions: Vec::new(),
+                    project_file_issue: None,
+  
```

**File**: `crates/ui/src/shell/actions_ui.rs` (modified, +70/-29)
```diff
@@ -414,14 +414,21 @@ impl Shell {
         cx.notify();
     }
 
-    fn run_project_action(&mut self, action: ProjectAction, cx: &mut Context<Self>) {
+    fn run_project_action(
+        &mut self,
+        key: &ProjectActionsKey,
+        action: ProjectAction,
+        cx: &mut Context<Self>,
+    ) {
         let Some(context) = self.project_action_context(cx) else {
             return;
         };
-        if !self
-            .project_actions
-            .active_status()
-            .is_some_and(ProjectActionsStatus::can_run)
+        if context.key != *key
+            || self.project_actions.active.as_ref() != Some(key)
+            || !self
+                .project_actions
+                .active_status()
+                .is_some_and(ProjectActionsStatus::can_run)
         {
             return;
         }
@@ -520,15 +527,12 @@ impl Shell {
     ) -> Option<AnyElement> {
         self.ensure_project_actions(cx);
         let status = self.project_actions.active_status()?.clone();
-        if matches!(
-            status,
-            ProjectActionsStatus::Idle
-                | ProjectActionsStatus::Loading
-                | ProjectActionsStatus::Unsupported
-        ) {
-            return None;
-        }
         let snapshot = self.project_actions.visible_snapshot()?;
+        let key = self.project_actions.active.clone()?;
+        let loading = matches!(
+            status,
+            ProjectActionsStatus::Idle | ProjectActionsStatus::Loading
+        );
         let can_run = status.can_run();
         let unavailable = matches!(status, ProjectActionsStatus::Unavailable { .. });
         let theme = Theme::of(cx).clone();
@@ -572,20 +576,47 @@ impl Shell {
                 )),
             );
 
-        if let Some(action) = preferred.clone() {
+        if loading {
+            control = control
+                .child(
+                    action_segment(&theme, "project-action-loading", false)
+                        .rounded_l(px(ACTION_CONTROL_RADIUS))
+                        .opacity(0.45)
+                        .child(
+                            div()
+                                .size(px(13.0))
+                                .flex_none()
+                                .flex()
+                                .items_center()
+                                .justify_center()
+                                .child(crate::loaders::mini_mono_spinner(
+                                    "project-actions-loading",
+                                    2.0,
+                                    theme.text_muted,
+                                    cx.entity_id(),
+                                    cx,
+                                )),
+                        )
+                        .when(show_label, |el| el.child("Loading…")),
+                )
+                .child(action_divider(&theme))
+                .child(action_chevron(&theme, false, |_, _, _| {}));
+        } else if let Some(action) = preferred.clone() {
             let run_action = action.clone();
-            let main = action_segment(&theme, "project-action-main")
+            let run_key = key.clone();
+            let main = action_segment(&theme, "project-action-main", can_run)
                 .rounded_l(px(ACTION_CONTROL_RADIUS))
                 .when(!can_run, |el| el.opacity(0.45))
                 .when(can_run, |el| {
                     el.cursor_pointer()
                         .on_click(cx.listener(move |this, _, _, cx| {
-                            this.run_project_action(run_action.clone(), cx)
+                            this.run_project_action(&run_key, run_action.clone(), cx)
                         }))
                 })
                 .child(
                     icon(action_icon(action.icon))
                         .size(px(13.0))
+                        .flex_none()
                         .text_color(theme.text_muted),
                 )
                 .when(show_la
```

#### Recent Merged Pull Requests:
- **PR #651** (2026-09-29): Fix side chats appearing in the command palette (@jsgrrchg)
- **PR #650** (2026-09-29): Hide queue attachment filenames and fix hover overflow (@jsgrrchg)
- **PR #642** (2026-09-29): Appearance: reduce motion, and pause animations in background (@dfrnoch)
- **PR #641** (2026-09-29): Sidebar: keep Ctrl+N jump hints on one line in compact rows (@katulevskiy)
- **PR #638** (2026-09-29): Explorer: list running subagents first, longest-running on top (@katulevskiy)
- **PR #637** (2026-09-29): Engine: idle reaper no longer kills a parked session's live subagents (@katulevskiy)
- **PR #636** (2026-09-29): iOS: thinking renders as markdown in the tool-group accordion (@AndPuQing)
- **PR #635** (2026-09-29): Engine: trim glibc malloc arenas on Linux (@zqkra)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
