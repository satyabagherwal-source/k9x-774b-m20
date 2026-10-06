# Forensic Learning Record (Deep Inspection): StarTrail-org/PixelRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/startrail-org-pixelrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarTrail-org/PixelRAG](https://github.com/StarTrail-org/PixelRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:41:29.452Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarTrail-org/PixelRAG`
- **Description**: https://arxiv.org/abs/2606.28344. The end of web parsing. The beginning of scalable pixel-native search. link: https://pixelrag.ai/
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 10194 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demos/render/run.py`
```
#!/usr/bin/env python3
"""Ingest demo: capture heterogeneous documents as tiled screenshots.

Demonstrates pixelshot rendering a mix of:
- Wikipedia article URLs (via CDP lean capture)
- Local HTML files (auto-detected, rendered via file:// URL)
- Could also handle PDFs (requires pdf2image)

Run:
    cd pixelrag
    uv run python demos/render/run.py
"""

import shutil
import time
from pathlib import Path

OUTPUT = Path("demos/render/output")

# --- Sample data ---

WIKI_URLS = [
    "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
    "https://en.wikipedia.org/wiki/Screenshot",
    "https://en.wikipedia.org/wiki/FAISS",
]

SAMPLE_HTML = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>
body {{ font-family: Georgia, serif; max-width: 800px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }}
h1 {{ color: #1a1a2e; border-bottom: 2px solid #e2e2e2; padding-bottom: .3em; }}
table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
th {{ background: #f5f5f5; }}
.highlight {{ background: #fff3cd; padding: .2em .4em; border-radius: 3px; }}
</style></head>
<body>
<h1>{title}</h1>
<p>{body}</p>
{extra}
</body></html>"""


def create_sample_html(output_dir: Path) -> list[Path]:
    """Create sample HTML files to demonstrate local file ingestion."""
    html_dir = output_dir / "sample_html"
    html_dir.mkdir(parents=True, exist_ok=True)

    files = []

    # A simple article-style page
    p1 = html_dir / "visual_retrieval.html"
    p1.write_text(
        SAMPLE_HTML.format(
            title="Visual Document Retrieval",
            body=(
                "Visual document retrieval captures documents as images and uses "
                "vision-language models to embed them into a shared vector space. "
                "Unlike text-based retrieval which requires parsing, visual retrieval "
                "preserves <span class='highlight'>layout, tables, figures, and formatting</span> "
                "that text extraction often loses."
            ),
            extra="""
<h2>Comparison</h2>
<table>
<tr><th>Method</th><th>Preserves Layout</th><th>Handles Tables</th><th>Needs Parser</th></tr>
<tr><td>Text extraction</td><td>No</td><td>Partial</td><td>Yes</td></tr>
<tr><td>HTML rendering</td><td>Partial</td><td>Yes</td><td>Yes</td></tr>
<tr><td><b>Visual (screenshot)</b></td><td><b>Yes</b></td><td><b>Yes</b></td><td><b>No</b></td></tr>
</table>
""",
        )
    )
    files.append(p1)

    # A data-heavy page with tables
    p2 = html_dir / "benchmark_results.html"
    rows = "".join(
        f"<tr><td>Config {i}</td><td>{70 + i * 1.3:.1f}</td><td>{0.5 + i * 0.02:.2f}s</td><td>{'LoRA' if i % 2 else 'Base'}</td></tr>"
        for i in range(15)
    )
    p2.write_text(
        SAMPLE_HTML.format(
            title="PixelRAG Benchmark Results",
            body="Evaluation results across different configurations and model variants.",
            extra=f"""
<h2>SimpleQA Retrieval Scores</h2>
<table>
<tr><th>Configuration</th><th>Recall@1</th><th>Latency</th><th>Model</th></tr>
{rows}
</table>
""",
        )
    )
    files.append(p2)

    return files


def main() -> None:
    from pixelrag_render.render import render_file

    # Clean previous output
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    print("=" * 60)
    print("  PixelRAG Ingest Demo: Heterogeneous Documents")
    print("=" * 60)
    print()

    # --- Step 1: Create sample local HTML ---
    print("[1] Creating sample HTML files...")
    html_files = create_sample_html(OUTPUT)
    for f in html_files:
        print(f"    {f.name} ({f.stat().st_size / 1024:.1f} KB)")
    print()

    tiles_dir = OUTPUT / "tiles"
    tiles_dir.mkdir()
    all_results: list[tuple[str, int, float]] = []

    # --- Step 2: Render Wikipedia URLs ---
    print(f"[2] Rendering {len(WIKI_URLS)} Wikipedia articles (CDP backend)...")
    t0 = time.time()
    from pixelrag_render.render import render_urls

    url_tiles = render_urls(WIKI_URLS, str(tiles_dir), backend="cdp", workers=3)
    elapsed = time.time() - t0
    for td in url_tiles:
        n = len(list(td.glob("tile_*")))
        name = td.name.replace(".png.tiles", "")
        all_results.append((f"URL: {name}", n, elapsed / len(WIKI_URLS)))
    print(f"    {len(url_tiles)} pages rendered in {elapsed:.1f}s")
    print()

    # --- Step 3: Render local HTML files ---
    print(f"[3] Rendering {len(html_files)} local HTML files...")
    for html_file in html_files:
        t0 = time.time()
        result = render_file(str(html_file), str(tiles_dir), backend="cdp")
        elapsed = time.time() - t0
        for td in result:
            n = len(list(Path(td).glob("tile_*")))
            all_results.append((f"HTML: {html_file.name}", n, elapsed))
    print(f"    {len(html_files)} files rendered")
    print()

    # --- Summary ---
    print("=" * 60)
    print("  Results")
    print("=" * 60)
    total_tiles = 0
    for name, n_tiles, elapsed in all_results:
        total_tiles += n_tiles
        print(f"  {name:<45} {n_tiles:>3} tiles  {elapsed:.1f}s")
    print(f"  {'─' * 55}")
    print(f"  {'TOTAL':<45} {total_tiles:>3} tiles")
    print()

    # Show output structure
    print("Output structure:")
    for td in sorted(tiles_dir.iterdir()):
        if td.is_dir():
            tiles = list(td.glob("tile_*"))
            size = sum(t.stat().st_size for t in tiles) / 1024
            print(f"  {td.name}/")
            print(f"    {len(tiles)} tiles, {size:.0f} KB total")
    print()
    print(f"All output in: {tiles_dir}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `render/src/pixelrag_render/__init__.py`
```
"""pixelshot: Document to image tiles.

Renders web pages, PDFs, and local files as tiled screenshots.
"""

from .render import render_file, render_pdf, render_url

__all__ = ["render_file", "render_pdf", "render_url"]

```

### Core Architecture Module: `render/src/pixelrag_render/backends/__init__.py`
```
"""pixelrag_render backends: cdp, playwright, pdf."""

```

### Core Architecture Module: `render/src/pixelrag_render/backends/cdp.py`
```
"""The CDP backend for pixelshot — the single rendering backend.

No Playwright dependency — launches Chrome via subprocess and talks CDP over a
raw websocket. Two capture paths, selected by the Chrome binary:

- STANDARD (default, portable): standard ``Page.captureScreenshot`` (JPEG over CDP).
  Works on any stock Chrome, any OS. Used unless a turbo-capable Chrome is present.
- TURBO: delegates to ``fast_cdp`` (rawFilePath + /dev/shm + parallel JPEG), ~2x at
  batch scale. Used automatically when the pixelrag-installed patched ``headless_shell``
  is selected (``chrome.is_turbo_capable``) and the request matches its capabilities.

Selection is deterministic (by Chrome provenance), with no runtime probe — so a stock
Chrome is never sent the patched-only CDP params (which would hang).

Requirements: websockets, pillow (no playwright needed)

Usage:
    from pixelrag_render.backends.cdp import render_urls
    tile_dirs = render_urls(["https://example.com"], "./tiles", workers=4)
"""

import asyncio
import base64
import io
import json
import logging
import os
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from PIL import Image

from .page_metrics import CONTENT_BOTTOM_JS, truncation_reason

logger = logging.getLogger("pixelrag_render.backends.cdp")

VIEWPORT_W = 875
VIEWPORT_H = 1080

# GPU rasterization: default OFF. Headless Chrome can't actually GPU-rasterize — it falls
# back to the software renderer and ignores these flags (no-op), so they never sped anything
# up (verified: enable == disable timing; the bottleneck is capture IPC, not rasterization).
# Worse, on a box that HAS a GPU device but no access to it (e.g. /dev/dri without the render
# group), Chrome tries the GPU, the GPU process crashes on init, and capture hangs. The
# `--enable-gpu-rasterization` pair was inherited from the initial release on the assumption
# it would help; it doesn't. Default to `--disable-gpu`; opt in with PIXELSHOT_ENABLE_GPU=1
# only on a real graphics-GPU box with device access.
_GPU_ARGS = (
    ["--enable-gpu-rasterization", "--force-gpu-rasterization"]
    if os.environ.get("PIXELSHOT_ENABLE_GPU")
    else ["--disable-gpu"]
)
BROWSER_ARGS = [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-background-networking",
    "--disable-features=Translate,MediaRouter,OptimizationHints",
    *_GPU_ARGS,
]


def _find_chrome() -> str:
    from ..chrome import find_chrome

    return find_chrome()


async def _connect_cdp(port: int, retries: int = 5, delay: float = 1.0):
    """Connect to Chrome's CDP websocket endpoint."""
    import websockets

    for attempt in range(retries):
        try:
            data = urllib.request.urlopen(
                f"http://localhost:{port}/json", timeout=3
            ).read()
            targets = json.loads(data)
            # Pick a real page target — Chrome's built-in component extensions
            # (Cast/Media Router) expose background_page targets that show up
            # first in /json but never render navigations, hanging CDP capture.
            pages = [t for t in targets if t.get("type") == "page"] or targets
            ws = await websockets.connect(
                pages[0]["webSocketDebuggerUrl"],
                open_timeout=10,
                max_size=50 * 1024 * 1024,
            )
            return ws
        except Exception:
            if attempt < retries - 1:
                await asyncio.sleep(delay)
    raise ConnectionError(f"Failed to connect to Chrome on port {port}")


def _http_base_from_cdp_url(cdp_url: str) -> str:
    """Normalize a ``--cdp-url`` value to an http DevTools base ``http://host:port``.

    Accepts ``http://host:port`` (any path is ignored), ``ws://host:port/...``
    (scheme swapped to http, path dropped), or a bare ``host:port``.
    """
    from urllib.parse import urlparse

    p = urlparse(cdp_url if "//" in cdp_url else f"//{cdp_url}")
    netloc = p.netloc or p.path
    if not netloc:
        raise ValueError(f"Invalid --cdp-url: {cdp_url!r}")
    return f"http://{netloc}"


async def _connect_ws(ws_url: str):
    """Open a CDP websocket to an explicit ws URL (browser- or page-level)."""
    import websockets

    return await websockets.connect(ws_url, open_timeout=10, max_size=50 * 1024 * 1024)


def _fetch_json(url: str, cdp_url: str, timeout: float = 5):
    """GET ``url`` and parse JSON, mapping connection failures to a clear error.

    ``cdp_url`` is the user-facing endpoint, used only for the message so a bad
    or unreachable ``--cdp-url`` surfaces an actionable error instead of a raw
    URLError traceback.
    """
    try:
        data = urllib.request.urlopen(url, timeout=timeout).read()
        return json.loads(data)
    except Exception as e:
        raise RuntimeError(f"Could not reach CDP endpoint at {cdp_url}: {e}") from e


def _browser_ws_url(http_base: str, cdp_url: str) -> str:
    """Fetch the browser-level CDP websocket URL from ``/json/version``."""
    info = _fetch_json(f"{http_base}/json/version", cdp_url)
    try:
        return info["webSocketDebuggerUrl"]
    except (KeyError, TypeError) as e:
        raise RuntimeError(
            f"Could not reach CDP endpoint at {cdp_url}: "
            f"unexpected /json/version response (no webSocketDebuggerUrl)"
        ) from e


async def _page_ws_url_for_target(
    http_base: str, target_id: str, cdp_url: str, retries: int = 5, delay: float = 0.5
) -> str:
    """Resolve the page-level websocket URL for a freshly created ``targetId``.

    A freshly created target can momentarily be absent from ``/json``, so poll a
    few times (mirroring ``_connect_cdp``'s retry) before giving up. The blocking
    HTTP fetch runs in a thread so it doesn't block the event loop.
    """
    for attempt in range(retries):
        targets = await asyncio.to_thread(_fetch_json, f"{http_base}/json", cdp_url)
        for t in targets:
            if t.get("id") == target_id:
                return t["webSocketDebuggerUrl"]
        if attempt < retries - 1:
            await asyncio.sleep(delay)
    raise RuntimeError(f"Created target {target_id} not found in /json list")


async def _cdp_send(ws, msg_id_ref: list, method: str, params: dict | None = None):
    """Send a CDP command and wait for its response."""
    msg_id_ref[0] += 1
    mid = msg_id_ref[0]
    msg = {"id": mid, "method": method}
    if params:
        msg["params"] = params
    await ws.send(json.dumps(msg))
    while True:
        r = json.loads(await asyncio.wait_for(ws.recv(), timeout=180))
        if r.get("id") == mid:
            if "error" in r:
                raise RuntimeError(f"CDP error: {r['error']}")
            return r.get("result", {})


# Max time to wait for the `load` event (and for the optional network-idle wait)
# before giving up and capturing whatever is there. Keeps a hanging page from
# stalling a worker.
LOAD_TIMEOUT_MS = 12_000
# Web-font loads are allowed a short grace period, but must not stall a render:
# a server can leave a font response open indefinitely.
FONT_TIMEOUT_MS = 2_000
# The network is considered idle once at most NET_IDLE_MAX_INFLIGHT requests
# have been in flight for NET_QUIET_MS (Puppeteer's "networkidle2" semantics).
# Tolerating 2 in-flight requests is what makes this usable on arbitrary web
# pages: analytics beacons / long-polling keep 1-2 connections busy forever,
# and a strict zero-in-flight wait would sit at the hard cap on every such
# page. Content loads (SPA hydration, image sets) burst well past 2.
NET_QUIET_MS = 500
NET_IDLE_MAX_INFLIGHT = 2


class _NetIdleState:
    """networkidle2 bookkeeping over raw CDP frames.

    Feed every incoming CDP frame to :meth:`on_frame`; the state tracks the
    set of in-flight HTTP requests (``Network.requestWillBeSent`` opens one,
    ``Network.loadingFinished`` / ``Network.loadingFailed`` closes it) and
    whether the page has loaded (``Page.loadEventFired``). WebSocket traffic
    uses different CDP methods and is deliberately not counted, so persistent
    sockets never block readiness.

    The quiet clock runs whenever <= ``max_inflight`` requests are pending —
    including before load — so a page that is already quiet when `load` fires
    becomes ready immediately, with no mandatory post-load wait. Pure and
    clock-injected for testability; the async I/O lives in
    :func:`_wait_load_and_network_idle`.
    """

    _OPEN = "Network.requestWillBeSent"
    _CLOSE = ("Network.loadingFinished", "Network.loadingFailed")

    def __init__(
        self,
        now: float,
        *,
        max_inflight: int = NET_IDLE_MAX_INFLIGHT,
        quiet_ms: int = NET_QUIET_MS,
    ):
        self.max_inflight = max_inflight
        self.quiet_s = quiet_ms / 1000
        self.loaded = False
        self.inflight: set[str] = set()
        self.quiet_since: float | None = now  # nothing in flight at start

    def on_frame(self, msg: dict, now: float) -> None:
        method = msg.get("method")
        if method == "Page.loadEventFired":
            self.loaded = True
        elif method == self._OPEN:
            self.inflight.add(msg["params"]["requestId"])
        elif method in self._CLOSE:
            self.inflight.discard(msg["params"]["requestId"])
        else:
            return
        if len(self.inflight) <= self.max_inflight:
            if self.quiet_since is None:
                self.quiet_since = now
        else:
            self.quiet_since = None

    def ready(self, now: float) -> bool:
        return (
            self.loaded
            and self.quiet_since is not None
            and now - self.quiet_since >= self.quiet_s
        )

    def next_deadline(self, now: float) -> float | None:
        """Earliest future moment ready() could flip true, or None (event-bound)."""
        if self.loaded and self.quiet_since is no
```

### Core Architecture Module: `render/src/pixelrag_render/backends/fast_cdp.py`
```
"""Fast CDP backend: raw BGRA capture → async JPEG compression.

Architecture:
  Chrome workers (n_workers)     Compression pool (n_compressors procs)
      ↓ rawFilePath                   ↓ read /dev/shm
    /dev/shm/pixelrag_render/raw/   → JPEG compress
    (28MB × n_workers slots)      → output/tiles/

Capture and compression are fully decoupled.  Chrome writes raw BGRA to
/dev/shm via Page.captureScreenshot rawFilePath.  A background asyncio task
drains the compression queue and submits work to a ProcessPoolExecutor.
Capture never waits for compression.

Requirements: pillow, websockets (no playwright needed)

Usage:
    from pixelrag_render.backends.fast_cdp import render_articles
    result = render_articles(articles, "./tiles")
    # result: {"total_tiles": N, "wall_s": T, "tiles_per_s": tps}
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import signal
import struct
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from .page_metrics import CONTENT_BOTTOM_JS, truncation_reason

logger = logging.getLogger("pixelrag_render.backends.fast_cdp")

VIEWPORT_WIDTH = 875
TILE_HEIGHT = 8192

# GPU rasterization default OFF — headless Chrome falls back to software and ignores these
# flags (no-op, never sped anything up), but on a GPU box without device access it crashes the
# GPU process and hangs capture. Inherited-from-initial-release assumption that didn't hold.
# Opt in with PIXELSHOT_ENABLE_GPU=1 only on a real graphics-GPU box with device access.
_GPU_ARGS = (
    ["--enable-gpu-rasterization", "--force-gpu-rasterization"]
    if os.environ.get("PIXELSHOT_ENABLE_GPU")
    else ["--disable-gpu"]
)
CHROME_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    *_GPU_ARGS,
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-background-networking",
    "--disable-features=Translate,MediaRouter,OptimizationHints",
]

# JS: wait for fonts + eager images, then return the page height to tile
_WAIT_FONTS_IMGS = (
    """new Promise(resolve => {
    """
    + CONTENT_BOTTOM_JS
    + """
    const waitEagerImgs = Promise.all(
        Array.from(document.images)
            .filter(i => !i.complete && i.loading !== 'lazy')
            .map(i => new Promise(r => {
                i.addEventListener('load', r, {once: true});
                i.addEventListener('error', r, {once: true});
            }))
    );
    const timeout = new Promise(r => setTimeout(r, 2000));
    Promise.race([
        Promise.all([document.fonts.ready, waitEagerImgs]),
        timeout
    ]).then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.style.scrollBehavior = 'auto';
                const sh = document.documentElement.scrollHeight;
                const body = document.body;
                resolve(body
                    ? Math.min(sh, Math.max(contentBottom(body), 1))
                    : sh);
            });
        });
    });
})"""
)


# ---------------------------------------------------------------------------
# Subprocess: JPEG compression (runs in ProcessPoolExecutor worker)
# ---------------------------------------------------------------------------


def _pin_to_cores(cores) -> None:
    """Pool initializer: keep compression workers off the capture cores.

    Module level, not a closure, because the pool is started with "spawn" — the
    initializer has to survive pickling, which a nested function does not.
    """
    try:
        os.sched_setaffinity(0, cores)
    except (OSError, AttributeError):
        pass  # not Linux, or the affinity call is unavailable — harmless


def _raw_scratch_dir() -> Path:
    """Per-user scratch directory on /dev/shm for Chrome's raw BGRA dumps.

    `/dev/shm` is shared by every user on the box, so a fixed path belongs to
    whoever ran first: the directory lands at 0775 owned by them, and for every
    later user `mkdir(exist_ok=True)` still succeeds while Chrome's write into it
    is denied. That combination is silent — capture reports success, the manifest
    claims N tiles, and not one image is written. Scoping the path to the current
    uid keeps users out of each other's way.

    The writability check is here rather than at first write because the failure
    it catches surfaces inside Chrome, whose stderr this backend discards.
    """
    d = Path(f"/dev/shm/pixelrag_render-{os.getuid()}/raw")
    d.mkdir(parents=True, exist_ok=True)
    if not os.access(d, os.W_OK):
        raise RuntimeError(
            f"{d} is not writable by uid {os.getuid()}. Chrome writes raw tiles "
            "there; without write access every capture is silently lost. Remove "
            "the directory and re-run, or set the turbo path aside with turbo=False."
        )
    return d


def compress_tile(raw_path: str, out_path: str, quality: int = 85) -> None:
    """Read raw BGRA file, compress to JPEG, delete raw file.

    Raw file layout (written by Chrome rawFilePath):
        bytes 0-3:  width  (uint32 LE)
        bytes 4-7:  height (uint32 LE)
        bytes 8-11: rowBytes (uint32 LE)
        bytes 12+:  BGRA pixels
    """
    from PIL import Image

    data = open(raw_path, "rb").read()
    w, h, rb = struct.unpack_from("<III", data, 0)
    img = Image.frombuffer("RGBA", (w, h), data[12:], "raw", "BGRA", rb, 1)
    img = img.convert("RGB")
    img.save(out_path, "JPEG", quality=quality)
    os.unlink(raw_path)


# ---------------------------------------------------------------------------
# Chrome connection helpers (inlined to avoid circular deps)
# ---------------------------------------------------------------------------

_port_counter = 0


def _next_base_port() -> int:
    global _port_counter
    _port_counter += 1
    return 12000 + (_port_counter - 1) * 500


async def _launch_chrome(chrome_path: str, port: int) -> tuple:
    """Launch a headless Chrome and return (websocket, proc, user_data_dir)."""
    import websockets

    # Isolated profile per worker. Without --user-data-dir, a launch on a machine that
    # already has Chrome open forwards to the running instance (default profile) instead
    # of starting this headless renderer — navigation/screenshot then hang forever. A
    # unique dir also stops parallel workers from colliding on one profile. See issue #54.
    user_data_dir = tempfile.mkdtemp(prefix=f"pixelshot_chrome_{port}_")
    args = (
        # `--headless=new`: bare `--headless` is deprecated and hangs on modern Chrome.
        [
            chrome_path,
            f"--remote-debugging-port={port}",
            "--headless=new",
            f"--user-data-dir={user_data_dir}",
        ]
        + CHROME_ARGS
        + ["about:blank"]
    )
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for attempt in range(10):
        await asyncio.sleep(1)
        try:
            data = urllib.request.urlopen(
                f"http://localhost:{port}/json", timeout=3
            ).read()
            targets = json.loads(data)
            # Pick a real page target — Chrome's built-in component extensions
            # (Cast/Media Router) expose background_page targets that show up
            # first in /json but never render navigations, hanging CDP capture.
            pages = [t for t in targets if t.get("type") == "page"] or targets
            ws = await websockets.connect(
                pages[0]["webSocketDebuggerUrl"],
                open_timeout=10,
                max_size=50 * 1024 * 1024,
            )
            return ws, proc, user_data_dir
        except Exception:
            if attempt == 9:
                proc.kill()
                shutil.rmtree(user_data_dir, ignore_errors=True)
                raise ConnectionError(f"Failed to connect to Chrome on port {port}")


class _Conn:
    """Minimal CDP connection with a receive loop."""

    def __init__(self, ws, proc, user_data_dir=None):
        self._ws = ws
        self._proc = proc
        self._user_data_dir = user_data_dir
        self._msg_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._event_listeners: dict[str, list] = {}
        self._recv_task: asyncio.Task | None = None

    def _ensure_recv(self):
        if self._recv_task is None or self._recv_task.done():
            self._recv_task = asyncio.get_event_loop().create_task(self._recv_loop())

    async def _recv_loop(self):
        try:
            async for raw in self._ws:
                msg = json.loads(raw)
                mid = msg.get("id")
                if mid is not None:
                    fut = self._pending.pop(mid, None)
                    if fut and not fut.done():
                        fut.set_result(msg)
                else:
                    method = msg.get("method", "")
                    listeners = self._event_listeners.get(method, [])
                    remaining = []
                    for fut, filter_fn in listeners:
                        if fut.done():
                            continue
                        params = msg.get("params", {})
                        matched = filter_fn(params) if filter_fn else True
                        if matched:
                            fut.set_result(params)
                        else:
                            remaining.append((fut, filter_fn))
                    self._event_listeners[method] = remaining
        except Exception:
            exc = ConnectionError("WebSocket receive loop ended")
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(exc)
            for listeners in self._event_listeners.values():
                for fut, _ in listeners:
                    if not fut.done():
                        fut.set_exception(exc)

    async def cdp(self, method: str, para
```

### Core Architecture Module: `render/src/pixelrag_render/backends/page_metrics.py`
```
"""Shared page measurement for the capture backends: the in-page JS, and the
judgement about whether what it measured can be trusted.

Kept in one place because both backends measure page height the same way and
must agree: the standard (``cdp``) and turbo (``fast_cdp``) paths each embed
this snippet, and a divergence between them silently changes how much of a page
gets captured depending on which Chrome binary is installed. The same goes for
what they then report in ``tiles.json``.

No imports — a plain string constant and a pure function, so either backend can
use them without a dependency edge between them.
"""

# How tall is the document's *content*?
#
# `documentElement.scrollHeight` alone over-reports: padding on the root element
# or a trailing margin inflates it, buying a run of blank tiles at the bottom of
# every such page. So it is clamped to where the content actually ends.
#
# That bound has to be measured from the content, not from the body box. A body
# is only as tall as the document when the page lets it size to its content;
# sites that pin it to the viewport (`html, body { height: 100% }` — Wikipedia's
# Vector 2022 skin among them) leave the content overflowing a one-viewport box,
# and clamping to that box truncates a 20,000px article to a single tile
# (issue #124). Taking the lowest edge among the body and its element children
# reads the same on a self-sizing body and survives a pinned one.
#
# Coordinates are viewport-relative, so scroll offset is added back: a page
# navigated to a `#fragment` lands scrolled down, where a raw rect bottom would
# under-report by exactly the scrolled distance.
CONTENT_BOTTOM_JS = """
    function contentBottom(body) {
        const offset = window.scrollY || window.pageYOffset || 0;
        let bottom = body.getBoundingClientRect().bottom;
        for (let el = body.firstElementChild; el; el = el.nextElementSibling) {
            const r = el.getBoundingClientRect();
            // Skip elements with no box at all (display:none, empty <script>);
            // theirs is a zero rect at the origin and would not move `bottom`,
            // but skipping keeps the intent explicit.
            if (r.width > 0 || r.height > 0) {
                bottom = Math.max(bottom, r.bottom);
            }
        }
        return Math.ceil(bottom + offset);
    }
"""


def truncation_reason(
    page_height: int, tile_height: int, *, measured: bool
) -> str | None:
    """Why this capture must not be reported as complete — or ``None`` if it may.

    ``tile_height`` is also the emulated viewport height (both backends pass it
    to ``Emulation.setDeviceMetricsOverride``), which is what makes the two
    checks below meaningful:

    - The probe returned nothing usable, so the height fell back to the tile
      height. Whatever the page actually was, one viewport of it was captured.
    - The probe returned exactly the viewport height. Then it measured the
      viewport rather than the content, and everything below the fold is
      missing — the shape every truncation so far has taken (issues #124, #131,
      #133), independent of which of them caused it.

    The second check costs a false alarm on a page that happens to be exactly
    ``tile_height`` tall. That is the right trade against the alternative,
    which is reporting 5% of an article as the whole of it: a capture wrongly
    flagged is re-run, a truncation never flagged is read and summarised.
    """
    if not measured:
        return (
            f"the page-height probe returned nothing, so the height fell back "
            f"to the {tile_height}px tile height"
        )
    if page_height == tile_height:
        return (
            f"the measured page height ({page_height}px) is exactly the tile "
            f"height, so the probe tracked the emulated viewport, not the content"
        )
    return None

```

### Core Architecture Module: `render/src/pixelrag_render/backends/pdf.py`
```
"""PDF backend for pixelshot.

Renders PDF pages to JPEG tiles using pdf2image (poppler).

Requires: pdf2image>=1.16.0 (install pixelrag-render[pdf])
"""

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("pixelrag_render.backends.pdf")


def render_pdf(
    path: str | Path,
    output_dir: str | Path,
    *,
    dpi: int = 200,
    pages: Optional[list[int]] = None,
    quality: int = 85,
    stem: str | None = None,
) -> list[Path]:
    """Render a PDF to JPEG tiles.

    Each page is written as ``{stem}.png.tiles/tile_NNNN.jpg`` with a
    ``tiles.json`` manifest alongside.

    Args:
        path: Path to the source PDF file.
        output_dir: Directory to write the tile subdirectory into.
        dpi: Resolution for rendering (default 200 gives ~1650×2200px for A4).
        pages: 1-based list of page numbers to render. ``None`` renders all pages.
        quality: JPEG quality 1-100 (default 85).
        stem: Override for the tile directory name. Defaults to the PDF filename
            stem. The pipeline passes the article_id here so directory names
            are always numeric and consistent with articles.json.

    Returns:
        List containing the single tile directory Path on success.

    Raises:
        ImportError: If pdf2image is not installed.
        FileNotFoundError: If the PDF file does not exist.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError as e:
        raise ImportError(
            "pdf2image is required for PDF rendering. "
            "Install with: pip install 'pixelrag-render[pdf]'"
        ) from e

    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if stem is None:
        stem = path.stem
    tile_dir = output_dir / f"{stem}.png.tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Rendering PDF: %s (dpi=%d)", path, dpi)

    convert_kwargs: dict = {
        "pdf_path": str(path),
        "dpi": dpi,
        "fmt": "jpeg",
        "jpegopt": {"quality": quality, "progressive": True},
        "thread_count": 4,
    }
    if pages is not None:
        # pdf2image uses 1-based page numbers
        convert_kwargs["first_page"] = min(pages)
        convert_kwargs["last_page"] = max(pages)

    images = convert_from_path(**convert_kwargs)

    saved_tiles: list[str] = []
    chunks_info: list[dict] = []
    for idx, img in enumerate(images):
        # If caller provided a sparse page list, skip pages not in the list
        if pages is not None:
            page_num = min(pages) + idx
            if page_num not in pages:
                continue

        tile_name = f"tile_{idx:04d}.jpg"
        tile_path = tile_dir / tile_name
        img.save(str(tile_path), "JPEG", quality=quality)
        saved_tiles.append(tile_name)
        w, h = img.size
        # Each PDF page = one chunk (no further splitting)
        chunks_info.append(
            {
                "tile": tile_name,
                "tile_index": idx,
                "chunk_index": 0,
                "file": tile_name,
                "y_offset": 0,
                "height": h,
                "width": w,
            }
        )
        logger.debug("  Page %d → %s (%dx%d)", idx, tile_name, w, h)

    manifest = {
        "source": str(path),
        "dpi": dpi,
        "total_pages": len(saved_tiles),
        "tiles": saved_tiles,
        # The selection the render ran with, recorded for the same reason the
        # URL manifests record their tile height: so a consumer reading
        # tiles.json can see what was asked for rather than be told out of band.
        "requested_pages": sorted(pages) if pages is not None else None,
        # A page selection means these tiles are some of the document rather
        # than all of it, and nothing here has checked the selection against
        # the document's length. Only a whole-document render may claim to be
        # complete — see #139 on what an unconditional flag costs downstream.
        "complete": pages is None,
    }
    with open(tile_dir / "tiles.json", "w") as f:
        json.dump(manifest, f)

    # Write chunks.json so the chunker skips this directory —
    # each PDF page is already a natural semantic unit.
    chunks_manifest = {
        "page_height": 0,
        "viewport_width": images[0].size[0] if images else 0,
        "tile_height": images[0].size[1] if images else 0,
        "chunk_height": images[0].size[1] if images else 0,
        "num_tiles": len(saved_tiles),
        "num_chunks": len(chunks_info),
        "chunks": chunks_info,
    }
    with open(tile_dir / "chunks.json", "w") as f:
        json.dump(chunks_manifest, f)

    logger.info("PDF rendered: %d pages → %s", len(saved_tiles), tile_dir)
    return [tile_dir]

```

### Core Architecture Module: `render/src/pixelrag_render/bench/__init__.py`
```
"""pixelshot benchmark harness.

Usage:
    from pixelrag_render.strategies import CDPSequentialStrategy
    from pixelrag_render.bench import Bench

    bench = Bench(zim_path="...", chrome_path="...", output_dir="./results")
    result = await bench.run(CDPSequentialStrategy(chrome_path=..., n_workers=32, fmt="raw"))
"""

from .bench_throughput import (
    Bench as Bench,
)
from .bench_throughput import (
    generate_ground_truth as generate_ground_truth,
)
from .bench_throughput import (
    prepare_articles as prepare_articles,
)
from .bench_throughput import (
    run_and_verify as run_and_verify,
)

```

### Core Architecture Module: `render/src/pixelrag_render/bench/bench_throughput.py`
```
#!/usr/bin/env python3
"""
Screenshot benchmark with correctness verification.

Bench is a clean measurement harness. It takes a strategy object, runs it,
verifies results against cached GT, and dumps config + results.

Strategies live in pixelrag_render.strategies — bench does NOT know about
specific strategy implementations or naming conventions.

Usage (programmatic):
    from pixelrag_render.strategies import CDPSequentialStrategy
    from pixelrag_render.bench.bench_throughput import Bench

    bench = Bench(zim_path="...", chrome_path="...", output_dir="./results")
    strategy = CDPSequentialStrategy(chrome_path=..., n_workers=32, fmt="raw")
    result = await bench.run(strategy)
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import random
import struct
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image

from pixelrag_render.strategies.base import TileCapture
from pixelrag_render.strategies.cdp_sequential import (
    VIEWPORT_WIDTH,
    CDPSequentialStrategy,
)

CORRECT_THRESHOLD = 99.0
JPEG_MAX_MEAN_DIFF = 5.0
LOSSLESS_MAX_MEAN_DIFF = 3.0


# ---------------------------------------------------------------------------
# Article preparation
# ---------------------------------------------------------------------------


def prepare_articles(
    zim_path: str, n: int, seed: int = 42, kiwix_url: str | None = None
) -> list[dict]:
    """Sample articles from ZIM.

    kiwix_url can be:
    - None: write HTML to temp files (file:// mode)
    - "http://host:port": single kiwix-serve instance
    - "http://host:9461,http://host:9462,...": multiple instances (round-robin)
    """
    from urllib.parse import quote

    from libzim.reader import Archive

    archive = Archive(zim_path)

    # Support multiple kiwix URLs (comma-separated)
    kiwix_urls = kiwix_url.split(",") if kiwix_url else []
    # Detect book_name from first URL or ZIM filename
    if kiwix_urls:
        # Extract book_name from URL: http://host:port/content/{book_name}/...
        # For symlinks like wiki_1.zim, book_name = wiki_1
        # We need to figure out the right book_name for each URL
        pass
    book_name = Path(zim_path).stem
    rng = random.Random(seed)
    articles = []
    tried = 0
    while len(articles) < n and tried < n * 20:
        idx = rng.randint(0, archive.all_entry_count - 1)
        tried += 1
        try:
            e = archive._get_entry_by_id(idx)
            if e.is_redirect or e.path.startswith("-/") or len(e.path) <= 2:
                continue
            entry = archive.get_entry_by_path(e.path)
            item = entry.get_item()
            if "html" not in item.mimetype:
                continue
            html = bytes(item.content).decode("utf-8")
            if 'http-equiv="refresh"' in html.lower() or len(html) < 300:
                continue

            if kiwix_urls:
                safe = "/:@!$&'()*+,;="
                # Round-robin across kiwix instances
                base = kiwix_urls[len(articles) % len(kiwix_urls)]
                # Detect book_name from the symlink/ZIM each instance serves
                parts = base.rstrip("/").rsplit(":", 1)
                port = int(parts[1]) if len(parts) > 1 else 9454
                # Each instance may have different book_name (wiki_1, wiki_2, etc.)
                bname = f"wiki_{port - 9460}" if port > 9460 else book_name
                url = f"{base}/content/{bname}/{quote(e.path, safe=safe)}"
                articles.append({"path": e.path, "file": url})
            else:
                tmp = tempfile.NamedTemporaryFile(
                    suffix=".html", delete=False, dir="/tmp", prefix="bench_"
                )
                tmp.write(html.encode())
                tmp.close()
                articles.append({"path": e.path, "file": tmp.name})
        except Exception:
            continue
    return articles


def cleanup_articles(articles: list[dict]):
    for a in articles:
        if a["file"].startswith("http"):
            continue
        try:
            os.unlink(a["file"])
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Ground truth (cached)
# ---------------------------------------------------------------------------


def gt_cache_key(articles: list[dict], seed: int) -> str:
    paths = sorted(a["path"] for a in articles)
    content = f"seed={seed}\n" + "\n".join(paths)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


async def generate_ground_truth(
    articles: list[dict],
    chrome_path: str,
    cache_dir: Path,
    seed: int,
    timeout_ms: int = 5000,
) -> dict[str, list[Path]]:
    cache_key = gt_cache_key(articles, seed)
    manifest_path = cache_dir / f"gt_{cache_key}.json"

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        all_exist = all(Path(p).exists() for paths in manifest.values() for p in paths)
        if all_exist:
            result = {k: [Path(p) for p in v] for k, v in manifest.items()}
            total = sum(len(v) for v in result.values())
            print(
                f"Ground truth cache hit: {len(result)} articles, {total} tiles",
                flush=True,
            )
            return result

    cache_dir.mkdir(parents=True, exist_ok=True)
    strategy = _make_gt_strategy(chrome_path, timeout_ms)
    await strategy.setup()
    try:
        results = await strategy.capture_articles(articles)
    finally:
        await strategy.teardown()

    ground_truth = {}
    for ac in results:
        tile_paths = []
        for tc in ac.tiles:
            tile_path = (
                cache_dir
                / f"gt_{cache_key}_{ac.article_path.replace('/', '_')}_{tc.tile_index:02d}.png"
            )
            if tc.image_bytes:
                tile_path.write_bytes(tc.image_bytes)
            tile_paths.append(tile_path)
        ground_truth[ac.article_path] = tile_paths

    manifest = {k: [str(p) for p in v] for k, v in ground_truth.items()}
    manifest_path.write_text(json.dumps(manifest))

    total = sum(len(v) for v in ground_truth.values())
    print(
        f"Ground truth generated: {len(ground_truth)} articles, {total} tiles",
        flush=True,
    )
    return ground_truth


def _make_gt_strategy(chrome_path: str, timeout_ms: int):
    """GT uses the most conservative strategy: 1 worker, PNG, long timeout.

    Uses port 9222 to avoid TIME_WAIT conflicts with test strategies (9300+).
    """
    s = CDPSequentialStrategy(
        chrome_path=chrome_path, n_workers=1, fmt="png", from_surface=True
    )
    s._base_port = 9222
    return s


def validate_gt(ground_truth: dict[str, list[Path]]) -> tuple[int, int, list[str]]:
    """Validate GT tiles are non-degenerate (not blank, not tiny, readable).

    Returns (ok, bad, bad_examples).
    """
    ok = 0
    bad = 0
    examples = []
    for article_path, tile_paths in ground_truth.items():
        for tp in tile_paths:
            try:
                img = Image.open(tp)
                arr = np.array(img)
                if arr.std() < 1.0:
                    bad += 1
                    if len(examples) < 10:
                        examples.append(
                            f"{article_path} {tp.name}: blank (std={arr.std():.1f})"
                        )
                    continue
                ok += 1
            except Exception as e:
                bad += 1
                if len(examples) < 10:
                    examples.append(f"{article_path} {tp.name}: {e}")
    return ok, bad, examples


# ---------------------------------------------------------------------------
# Decode + verify (NOT timed)
# ---------------------------------------------------------------------------


def decode_tile(tc: TileCapture) -> Image.Image | None:
    try:
        if tc.raw_file_path and os.path.exists(tc.raw_file_path):
            data = open(tc.raw_file_path, "rb").read()
            w, h, rb = struct.unpack_from("<III", data, 0)
            img = Image.frombuffer(
                "RGBA", (w, h), data[12:], "raw", "BGRA", rb, 1
            ).convert("RGB")
            return img
        elif tc.image_bytes:
            return Image.open(io.BytesIO(tc.image_bytes)).convert("RGB")
    except Exception:
        return None
    return None


def verify_tile(
    captured: Image.Image, gt_path: Path, is_lossy: bool
) -> tuple[bool, float]:
    gt = Image.open(gt_path).convert("RGB")
    cap_arr = np.array(captured, dtype=np.float32)
    gt_arr = np.array(gt, dtype=np.float32)
    if cap_arr.shape != gt_arr.shape:
        return False, 999.0
    diff = np.abs(cap_arr - gt_arr)
    mean_diff = float(diff.mean())
    threshold = JPEG_MAX_MEAN_DIFF if is_lossy else LOSSLESS_MAX_MEAN_DIFF
    return mean_diff <= threshold, mean_diff


# ---------------------------------------------------------------------------
# Run one strategy: time capture, then verify separately
# ---------------------------------------------------------------------------


async def run_and_verify(strategy, articles, ground_truth) -> dict:
    await strategy.setup()
    t0 = time.monotonic()
    try:
        article_captures = await strategy.capture_articles(articles)
    finally:
        wall_s = time.monotonic() - t0
        await strategy.teardown()

    # --- UNTIMED: decode + verify ---
    tiles_ok = 0
    tiles_bad = 0
    tiles_total = 0
    total_shot_ms = 0.0
    total_nav_ms = 0.0
    total_pixels = 0
    total_height_px = 0
    per_tile_shot_ms = []
    per_tile_nav_ms = []
    bad_examples = []
    is_lossy = strategy.fmt in ("jpeg",)

    for ac in article_captures:
        gt_tiles = ground_truth.get(ac.article_path, [])
        total_height_px += ac.page_height
        total_shot_ms += ac.total_shot_ms
        total_nav_ms += ac.total_nav_ms

        for tc in ac.tiles:
            tiles_total += 1
            tot
```

### Core Architecture Module: `render/src/pixelrag_render/chrome.py`
```
"""Chrome binary management for pixelshot.

Downloads and manages a patched headless Chrome binary with rawFilePath
support. Similar to `playwright install chromium`.

Usage:
    pixelshot install-chrome     # download patched headless_shell
    pixelshot which-chrome       # print path to active binary

Programmatic:
    from pixelrag_render.chrome import find_chrome, install_chrome
    path = find_chrome()             # auto-detect best available
    path = install_chrome()          # download if needed
"""

import json
import os
import platform
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

INSTALL_DIR = Path.home() / ".cache" / "pixelrag" / "chrome"
VERSION_FILE = "version.json"

# Update these when releasing a new build
CHROME_VERSION = "150.0.7844.0"
RELEASE_URL_TEMPLATE = (
    "https://github.com/StarTrail-org/PixelRAG/releases/download/"
    "chrome-{version}/headless_shell-linux-x64.tar.zst"
)


def _playwright_revision(path: str) -> int:
    """Integer Playwright Chromium revision embedded in ``path``.

    Playwright caches browsers under ``chromium-<revision>`` with a plain
    monotonically-increasing integer revision. Paths without a recognizable
    revision sort last (``-1``) rather than raising.
    """
    m = re.search(r"chromium-(\d+)", path)
    return int(m.group(1)) if m else -1


def _candidate_chrome_paths(system: str | None = None) -> list[str]:
    """Ordered Chrome binary candidates for the given OS (default: this OS).

    Order: CHROME_PATH env → pixelrag-installed patched headless_shell →
    Playwright's Chromium (newest version first) → system Chrome/Chromium.
    Playwright and system locations are OS-specific so the skill works on
    macOS and Windows, not only Linux.
    """
    import glob

    system = system or platform.system()
    home = Path.home()
    paths: list[str] = []

    env = os.environ.get("CHROME_PATH", "")
    if env:
        paths.append(env)
    # Bundled patched headless_shell (only installed on linux-x64, harmless elsewhere).
    paths.append(str(INSTALL_DIR / "headless_shell"))

    def add_playwright(cache_dir: Path, rel_glob: str) -> None:
        # Newest chromium-NNNN first. Sort by integer revision, not lexically:
        # a string sort ranks "chromium-999" above "chromium-1187" once the
        # revision crosses the 3→4 digit boundary, picking an older browser.
        matches = glob.glob(str(cache_dir / rel_glob))
        paths.extend(sorted(matches, key=_playwright_revision, reverse=True))

    if system == "Darwin":
        add_playwright(
            home / "Library" / "Caches" / "ms-playwright",
            "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        )
        paths += [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
    elif system == "Windows":
        localappdata = os.environ.get("LOCALAPPDATA", "")
        if localappdata:
            add_playwright(
                Path(localappdata) / "ms-playwright",
                "chromium-*/chrome-win*/chrome.exe",
            )
        for base in (
            os.environ.get("PROGRAMFILES", r"C:\Program Files"),
            os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"),
            localappdata,
        ):
            if base:
                paths.append(str(Path(base) / "Google/Chrome/Application/chrome.exe"))
    else:  # Linux / other
        add_playwright(
            home / ".cache" / "ms-playwright", "chromium-*/chrome-linux*/chrome"
        )
        paths += [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
        ]
    return paths


def find_chrome(auto_install: bool = True) -> str:
    """Find the best available Chrome binary. Auto-installs on linux-x64 if none found.

    Search order (per OS): CHROME_PATH → pixelrag-installed headless_shell →
    Playwright's Chromium → system Chrome/Chromium → (linux-x64) auto-install.

    Returns:
        Path to Chrome binary.

    Raises:
        FileNotFoundError: No Chrome binary found (and auto-install unavailable).
    """
    for path in _candidate_chrome_paths():
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    # The prebuilt (turbo) headless_shell is published only for linux-x64.
    if auto_install and platform.system() == "Linux" and platform.machine() == "x86_64":
        print("No Chrome found. Installing headless_shell...", flush=True)
        return str(install_chrome())

    raise FileNotFoundError(
        "No Chrome binary found. Install Google Chrome or Chromium, or set CHROME_PATH "
        "to its executable. (The bundled headless_shell auto-installs on linux-x64 only.)"
    )


def get_installed_version() -> str | None:
    """Return version string of installed headless_shell, or None."""
    version_path = INSTALL_DIR / VERSION_FILE
    if version_path.exists():
        try:
            data = json.loads(version_path.read_text())
            return data.get("version")
        except Exception:
            pass
    return None


def is_turbo_capable(chrome_path: str) -> bool:
    """Whether ``chrome_path`` is the pixelrag-installed patched headless_shell,
    which supports the turbo capture extensions (rawFilePath/directClip/skipRedraw).

    Deterministic by provenance — the patched binary lives only at the install path
    (with its version.json marker). No runtime probe, so a stock Chrome is never
    mistaken for a turbo-capable one (and a turbo run is never tried on a binary
    that would hang on the unknown CDP params).
    """
    try:
        installed = (INSTALL_DIR / "headless_shell").resolve()
        return (
            Path(chrome_path).resolve() == installed
            and (INSTALL_DIR / VERSION_FILE).exists()
        )
    except Exception:
        return False


def install_chrome(version: str | None = None, force: bool = False) -> Path:
    """Download and install the patched headless_shell binary.

    Args:
        version: Chrome version to install. Defaults to CHROME_VERSION.
        force: Re-download even if already installed.

    Returns:
        Path to the installed headless_shell binary.
    """
    version = version or CHROME_VERSION
    binary_path = INSTALL_DIR / "headless_shell"

    if binary_path.exists() and not force:
        installed = get_installed_version()
        if installed == version:
            print(f"Already installed: headless_shell {version}")
            return binary_path

    if platform.system() != "Linux" or platform.machine() != "x86_64":
        raise RuntimeError(
            f"Pre-built headless_shell only available for linux-x64, "
            f"got {platform.system()}-{platform.machine()}"
        )

    url = RELEASE_URL_TEMPLATE.format(version=version)
    print(f"Downloading headless_shell {version}...")
    print(f"  URL: {url}")

    INSTALL_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(suffix=".tar.zst", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        urllib.request.urlretrieve(url, tmp_path, _progress_hook)
        print()

        # Decompress: zstd → tar → extract
        print("Extracting...")
        # Try zstd decompression
        decomp_path = tmp_path + ".tar"
        try:
            subprocess.run(
                ["zstd", "-d", tmp_path, "-o", decomp_path],
                check=True,
                capture_output=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError):
            # Fallback: try python zstandard
            try:
                import zstandard

                with open(tmp_path, "rb") as f_in, open(decomp_path, "wb") as f_out:
                    dctx = zstandard.ZstdDecompressor()
                    dctx.copy_stream(f_in, f_out)
            except ImportError:
                raise RuntimeError(
                    "zstd not found. Install with: apt install zstd (or pip install zstandard)"
                )

        with tarfile.open(decomp_path) as tar:
            tar.extractall(INSTALL_DIR)
        os.unlink(decomp_path)

        # Set executable permission
        binary_path.chmod(0o755)

        # Write version file
        version_data = {"version": version, "binary": str(binary_path)}
        (INSTALL_DIR / VERSION_FILE).write_text(json.dumps(version_data))

        print(
            f"Installed: {binary_path} ({binary_path.stat().st_size / 1024 / 1024:.0f}MB)"
        )
        return binary_path

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _progress_hook(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(100, downloaded * 100 // total_size)
        mb = downloaded / 1024 / 1024
        total_mb = total_size / 1024 / 1024
        print(f"\r  {mb:.0f}/{total_mb:.0f} MB ({pct}%)", end="", flush=True)


def main():
    """CLI entry point for chrome management."""
    import argparse

    parser = argparse.ArgumentParser(description="Manage Chrome for pixelshot")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("install", help="Download patched headless_shell")
    sub.add_parser("which", help="Print path to active Chrome binary")
    sub.add_parser("version", help="Print installed version")

    args = parser.parse_args()

    if args.command == "install":
        install_chrome()
    elif args.command == "which":
        try:
            print(find_chrome())
        except FileNotFoundError as e:
            print(str(e), file=sys.stderr)
            sys.exit(1)
    elif args.command == "version":
        v = get_installed_version()
        if v:
            print(v)
        else:
            print("Not installed", file=sys.
```

### Core Architecture Module: `render/src/pixelrag_render/render.py`
```
"""Public API for pixelshot.

Renders documents (URLs, PDFs, local HTML/image files) to image tiles.

Entry point:
    pixelshot <inputs> --output ./tiles --backend cdp --workers 4
"""

import argparse
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger("pixelrag_render.render")


def render_url(
    url: str,
    output_dir: str | Path,
    backend: str = "cdp",
    *,
    tile_height: int = 8192,
    quality: int = 85,
    viewport_width: int = 875,
    workers: int = 1,
    **kwargs,
) -> list[Path]:
    """Render a URL to tiled JPEG images.

    Args:
        url: URL to capture (http:// or https:// or file://).
        output_dir: Directory to write tile subdirectories into.
        backend: Rendering backend. Only ``"cdp"`` is implemented.
        tile_height: Maximum tile height in pixels (default 8192).
        quality: JPEG quality 1-100 (default 85).
        viewport_width: Browser viewport width in pixels (default 875).
        workers: Number of parallel browser processes (default 1).
        **kwargs: Additional keyword arguments forwarded to the backend.

    Returns:
        List of Path objects pointing to created tile directories.
    """
    return render_urls(
        [url],
        output_dir,
        backend=backend,
        tile_height=tile_height,
        quality=quality,
        viewport_width=viewport_width,
        workers=workers,
        **kwargs,
    )


def render_urls(
    urls: list[str],
    output_dir: str | Path,
    backend: str = "cdp",
    *,
    stems: list[str] | None = None,
    tile_height: int = 8192,
    quality: int = 85,
    viewport_width: int = 875,
    workers: int = 4,
    **kwargs,
) -> list[Path]:
    """Render a list of URLs to tiled JPEG images.

    Args:
        urls: URLs to capture.
        output_dir: Directory to write tile subdirectories into.
        backend: Rendering backend. Only ``"cdp"`` is implemented.
        stems: Optional list of output directory stems (one per URL).
               If provided, tiles are written to ``{output_dir}/{stem}.png.tiles/``
               instead of deriving names from URLs. Useful for assigning
               sequential IDs (e.g. ``["0", "1", "2"]``).
        tile_height: Maximum tile height in pixels (default 8192).
        quality: JPEG quality 1-100 (default 85).
        viewport_width: Browser viewport width in pixels (default 875).
        workers: Number of parallel browser processes (default 4).
        **kwargs: Additional keyword arguments forwarded to the backend.

    Returns:
        List of Path objects pointing to created tile directories.
    """
    if backend in ("cdp", "websocket"):  # "websocket" kept as a back-compat alias
        from .backends.cdp import render_urls as _render_urls
    else:
        raise ValueError(
            f"Unknown backend: {backend!r}. Choose 'cdp'."
            " The cdp backend auto-selects a turbo capture path when a turbo-capable"
            " Chrome is present."
        )

    return _render_urls(
        urls,
        output_dir,
        stems=stems,
        tile_height=tile_height,
        quality=quality,
        viewport_width=viewport_width,
        workers=workers,
        **kwargs,
    )


def render_pdf(
    path: str | Path,
    output_dir: str | Path,
    *,
    dpi: int = 200,
    pages: Optional[list[int]] = None,
    quality: int = 85,
    stem: str | None = None,
) -> list[Path]:
    """Render a PDF file to tiled JPEG images.

    Args:
        path: Path to the PDF file.
        output_dir: Directory to write the tile subdirectory into.
        dpi: Rendering resolution (default 200 ≈ 1650×2200 for A4).
        pages: 1-based list of page numbers to render. ``None`` renders all.
        quality: JPEG quality 1-100 (default 85).
        stem: Override for the tile directory name (default: PDF filename stem).

    Returns:
        List containing the tile directory Path on success.
    """
    from .backends.pdf import render_pdf as _render_pdf

    return _render_pdf(
        path, output_dir, dpi=dpi, pages=pages, quality=quality, stem=stem
    )


def render_file(
    path: str | Path,
    output_dir: str | Path,
    backend: str = "cdp",
    **kwargs,
) -> list[Path]:
    """Auto-detect file type and render to tiled JPEG images.

    Dispatch rules:
    - ``.pdf`` → ``render_pdf()``
    - ``.html`` / ``.htm`` → ``render_url(file://...)``
    - ``.png`` / ``.jpg`` / ``.jpeg`` / ``.webp`` → copy into output_dir as-is
    - ``http://`` or ``https://`` prefix → ``render_url()``

    Args:
        path: Path to a local file, or a URL string.
        output_dir: Directory to write tile subdirectories into.
        backend: Browser backend for HTML/URL rendering (default ``"cdp"``).
        **kwargs: Forwarded to the underlying render function.

    Returns:
        List of Path objects pointing to created tile directories or copied files.
    """
    path_str = str(path)
    output_dir = Path(output_dir)

    # URL strings
    if path_str.startswith("http://") or path_str.startswith("https://"):
        return render_url(path_str, output_dir, backend=backend, **kwargs)

    p = Path(path)
    suffix = p.suffix.lower()

    if suffix == ".pdf":
        return render_pdf(p, output_dir, **kwargs)

    if suffix in {".html", ".htm"}:
        file_url = p.resolve().as_uri()
        return render_url(file_url, output_dir, backend=backend, **kwargs)

    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        output_dir.mkdir(parents=True, exist_ok=True)
        dest = output_dir / p.name
        shutil.copy2(str(p), str(dest))
        logger.info("Copied image: %s → %s", p, dest)
        return [dest]

    raise ValueError(
        f"Cannot auto-detect render method for {path!r}. "
        "Supported: .pdf, .html, .htm, .png, .jpg, .jpeg, .webp, http://, https://"
    )


def main() -> None:
    """CLI entry point: pixelshot.

    Usage examples::

        # Single URL, default CDP backend
        pixelshot https://example.com --output ./tiles

        # Multiple inputs
        pixelshot https://a.com https://b.com --output ./tiles

        # PDF
        pixelshot report.pdf --output ./tiles

        # Local HTML
        pixelshot index.html --output ./tiles

        # URL file
        pixelshot urls.txt --output ./tiles

        # Chrome management (folded from the former `pixelrag-chrome`)
        pixelshot install-chrome   # download the patched headless Chrome
        pixelshot which-chrome     # print the active Chrome binary path
    """
    # Chrome management subcommands — dispatch before building the render parser.
    if len(sys.argv) > 1 and sys.argv[1] in ("install-chrome", "which-chrome"):
        from pixelrag_render import chrome

        if sys.argv[1] == "install-chrome":
            chrome.install_chrome()
        else:
            try:
                print(chrome.find_chrome(auto_install=False))
            except FileNotFoundError as e:
                print(str(e), file=sys.stderr)
                sys.exit(1)
        return

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        prog="pixelshot",
        description="Render documents (URLs, PDFs, HTML files) to tiled JPEG images.",
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        metavar="INPUT",
        help="URLs or file paths to render.",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="./tiles",
        metavar="DIR",
        help="Output directory for tile subdirectories (default: ./tiles).",
    )
    parser.add_argument(
        "--backend",
        choices=["cdp"],
        default="cdp",
        help="Browser backend for URL/HTML rendering (default: cdp).",
    )
    parser.add_argument(
        "--workers",
        "-w",
        type=int,
        default=4,
        help="Number of parallel browser processes (default: 4).",
    )
    parser.add_argument(
        "--tile-height",
        type=int,
        default=8192,
        help="Maximum tile height in pixels (default: 8192).",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=85,
        help="JPEG quality 1-100 (default: 85).",
    )
    parser.add_argument(
        "--viewport-width",
        type=int,
        default=875,
        help="Browser viewport width in pixels (default: 875).",
    )
    parser.add_argument(
        "--wait-network-idle",
        action="store_true",
        help="After the page's load event, also wait until at most 2 network "
        "requests have been in flight for ~500ms (networkidle2) before "
        "capturing, capped at 12s. Helps JS/SPA pages that fetch content "
        "after load; tolerates persistent analytics/long-poll connections. "
        "Off by default; the index pipeline's `web` source and the "
        "pixelbrowse skill enable it.",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=200,
        help="DPI for PDF rendering (default: 200).",
    )
    parser.add_argument(
        "--cdp-url",
        default=os.environ.get("PIXELSHOT_CDP_URL"),
        metavar="URL",
        help="Attach to an already-running Chrome/Brave DevTools endpoint "
        "(e.g. http://127.0.0.1:9222) instead of launching a throwaway headless "
        "browser. Renders each input in a fresh tab using that browser's existing "
        "session (cookies/logins) — so authenticated pages work — then closes only "
        "that tab. Needs no local Chrome binary. Env: PIXELSHOT_CDP_URL.",
    )
    parser.add_argument(
        "--extract-text",
        action="store_true",
        help="Extract page text alongside tiles (hybrid output). Saves a text.md "
        "file in each tile directory with the page's innerText. Useful for "
        "reducing LLM token usage on text-heavy pages.
```

### Core Architecture Module: `render/src/pixelrag_render/strategies/__init__.py`
```
"""Screenshot capture strategies — core render capability, independent of benchmarking."""

from .base import ArticleCapture, CaptureStrategy, TileCapture, article_url
from .cdp_directclip import CDPDirectClipStrategy
from .cdp_oneshot import CDPOneShotStrategy
from .cdp_pertile_imgwait import CDPPerTileImgWaitStrategy
from .cdp_sequential import CDPSequentialStrategy
from .connection import (
    PlaywrightConnection,
    WebsocketConnection,
    launch_playwright,
    launch_websocket,
)

__all__ = [
    "ArticleCapture",
    "CDPDirectClipStrategy",
    "CDPOneShotStrategy",
    "CDPPerTileImgWaitStrategy",
    "CDPSequentialStrategy",
    "CaptureStrategy",
    "PlaywrightConnection",
    "TileCapture",
    "WebsocketConnection",
    "article_url",
    "launch_playwright",
    "launch_websocket",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #165** (2026-10-01): **eval: export the LoRA cells as a frozen-retrieval benchmark**
  *Symptoms*: Adds a retrieval-only mode to the eval harness and uses it to export the LoRA cells of Table 1 as a benchmark with frozen retrieval (questions plus their top-5 tiles), so a reader model can be scored without running a search serve.  - `run_bench.py --dump-retrieval DIR` loads examples and builds the retriever exactly as a normal run, then writes `records.jsonl`, the retrieved tiles and any query images instead of calling a reader. It is resumable by example id and logs one start and one end line per example. - `dump_bench.sh <bench> <out_root>` runs it with the example sets, query images, instruction and nprobe of the LoRA cells in `reproduce.sh`. - `pack_bench.py` packs the dumps into one Parquet config per bench with the images embedded. The `original_data` column is what `lib.grader` reads, so a model's answers can be graded after adding `final_response`. - A hit whose tile is missing on the serve's disk is recorded in `missing_tiles.jsonl` instead of failing the example. `pack_bench.py` refuses to pack while any such tile is unfilled, unless it is listed with `--allow-missing`. - NQ-Tables repeats one example id, and the retriever cache concatenated both copies' hits. The dump keeps the first top-k.  Checked on the full export: 4,117 questions across nq, nq_tables, simpleqa, mmsearch and encyclopedic_vqa (landmarks). Grading gold answers as predictions through `lib.grader nq` scores 1000/1000. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #0FfSNIN3LuBgvep8LQR8DJMtBrPeImXT2CLcbgFI9eM=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ3ZWIiLCJwcm9qZWN0SWQiOiJwcmpfbGI2cHVrT3BOYjliU0tKaG1DNlhMOENSTWw3UyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9hbmR5bGl6ZnMtcHJvamVjdHMvd2ViL0VEZU1ubzQzUWVzVUZQNDRXWXl5alpaZG1IejIiLCJwcmV2aWV3VXJsIjoid2ViLWdpdC1ldmFsLWR1bXAtcmV0cmlldmFsLWJlbmNoLWFuZHlsaXpmcy1wcm9qZWN0cy52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IndlYi1naXQtZXZhbC1kdW1wLXJldHJpZXZhbC1iZW5jaC1hbmR5bGl6ZnMtcHJvamVjdHMudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5Ijoid2ViIn1dfQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/andylizfs-projects/web"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_lb6pukOpNb9bSKJhmC6X

- **Issue #164** (2026-10-01): **fix(serve): cap on-demand renders per /search request**
  *Symptoms*: ## Problem  With render-on-demand enabled (`--kiwix-url`), `/search` has no bound on how much *work* one request can queue. In the hit loop:  ```python elif req.include_images and _state.get("ondemand") is not None:     img_b64 = await asyncio.to_thread(_ondemand_chunk_b64, aid, ti, ci, th) ```  For every hit whose tile isn't on disk that reaches `OnDemandTiles.chunk_path` → `_render_and_chunk`, which launches a **Chrome page render**, serialized on a **process-global** `_render_lock` and bounded only by `PIXELRAG_RENDER_TIMEOUT` (120s by default).  Nothing capped how many of those a single request may ask for. At this endpoint's own limits — 32 queries (#154) and `n_docs` up to 1000 (#122) — one `{"include_images": true}` request can queue **tens of thousands** of serialized renders. The handler `await`s them one at a time, so the request occupies a task for as long as that takes, and because the lock is process-wide, every *other* caller's renders stall behind it. The endpoint is public and unauthenticated.  This is the same family as the `n_docs` and query-image bounds, but a bound on time rather than memory — the amplification those two didn't close.  ## Fix  A per-request render budget (16). Past it the hit is still returned, just without `image_base64` — already what a failed render or a missing tile yields, so no new client contract — and the client can fetch it from `/tile/{article_id}/{tile_index}/{chunk_index}`. A real caller asks for `n_docs=10`, so a legitimate re
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22b5ece1993671b57035b74e774e2cb38b5789ffab%22%7D%2C%22id%22%3A%22QmWwF6HDGpiaDKEaqeFwBnVFPXMrtzw3ZMhgqtasc8deqV%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A164%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #163** (2026-10-01): **feat(eval): add optional Cheaper Inference reader**
  *Symptoms*: This PR adds an optional `--cheaperinference` reader to `eval/run_bench.py`. It uses the same pattern as #159.  Cheaper Inference is an OpenAI-compatible LLM gateway. `gpt-5.4` and `gpt-5.4-mini` accept image input.  Cheaper Inference is one of the fastest-growing AI routers. Each model costs 15–60% less than the list price of its lab.  <details><summary>Details</summary>  Behavior:  - Uses the existing OpenAI-compatible client. - Reads the key only from `--api-key` or `CHEAPER_INFERENCE_API_KEY`. - Sends model IDs unchanged. - Stops with an error when combined with another provider flag, `--litellm` or `--api-base`.  Files:  - `eval/lib/model_config.py` - `eval/run_bench.py` - `eval/README.md` - `tests/test_cheaperinference_client.py` (new)  Tests:  - `ruff check .` and `ruff format --check .`: passed. - New tests and model config tests: passed.  </details>
  **Post-Mortem & Fix Analysis**:
  > @aiapienthusiast is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22a9f04d01909483a9b98d542c95b424165f4eae7c%22%7D%2C%22id%22%3A%22QmT4B4Gqd3eFqvLhYAbwfDK9oT9B1Hu7vXJfkvV5cEj1Rh%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A163%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #162** (2026-09-27): **test(serve): repair department-filter tests left stale by the backend refactor**
  *Symptoms*: ## Problem  `tests/test_department_filter.py` has been failing for anyone with the `serve` extra installed since mid-July:  ``` E   AttributeError: module 'pixelrag_serve.api' has no attribute '_department_search_params' E   AttributeError: module 'pixelrag_serve.api' has no attribute '_department_positions' ```  Five tests, both names removed in 1a9ba75 ("feat: Vector search with Qdrant", #111) when department filtering moved into the `VectorBackend` abstraction: `_department_positions` became `_department_article_ids` (the backend now maps article ids to rows), and `_department_search_params` was folded into `FaissBackend.raw_search`. That commit added `tests/test_serve_backends.py` for the new contract but left this file pointing at the old one.  **Why CI stayed green.** A module-level `pytest.importorskip("faiss")` sits halfway down the file, so a core-only install skips the entire module:  ``` $ uv run --isolated --extra dev pytest tests/test_department_filter.py SKIPPED [1] could not import 'faiss': No module named 'faiss' 1 skipped ```  CI installs `--extra dev` only, so it has never run a single case in this file — including the five build-side cases defined *above* the gate, which need nothing heavier than `pixelrag_index.pipelines`.  **What was actually uncovered.** Three of the five weren't duplicated elsewhere:  | Stale test | Covered by test_serve_backends.py? | |---|---| | flat-index filter restricts hits | yes | | positions map articles to rows | yes, via the a
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22e9b78e5ef618c49ad8cd75710f0592333ca5c299%22%7D%2C%22id%22%3A%22QmNby7cyRZLvswjxmgVYc353VMDTw8u9Sq8Mg68XoDWN14%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A162%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #161** (2026-09-27): **fix(serve): bound /reconstruct and stop unknown ids becoming 500s**
  *Symptoms*: ## Problem  `/reconstruct` is public and unguarded — the last endpoint on the API without input bounds, after #122 (`n_docs`) and #154 (query images, batch size).  ```python class ReconstructRequest(BaseModel):     vector_ids: list[int | str]  @app.post("/reconstruct") async def reconstruct(req: ReconstructRequest):     return {"embeddings": _state["backend"].reconstruct(req.vector_ids)} ```  **1. Unbounded response.** Every id returns a full `dimension`-length float list, which serializes to roughly 40 KB of JSON at dim 2048. A request with 100 k ids asks the service to build a multi-GB response. The first call also runs `make_direct_map()` over the whole index — an allocation any anonymous caller can trigger.  **2. Uncaught errors become 500s.** `FaissBackend.reconstruct` does `self.index.reconstruct(int(v))` with no validation:  - a non-numeric id (the model explicitly allows `str`) raises   `ValueError: invalid literal for int()`; - an out-of-range id raises `RuntimeError: Error ... 'key < ntotal' failed`.  Both reach the client as an uncaught 500. `QdrantBackend.reconstruct` already returns `None` for an id it doesn't hold, and the `VectorBackend` protocol declares `list[list[float] | None]` — so FAISS was the odd one out, and the documented contract was the one it didn't honor.  ## Fix  `vector_ids: list[int | str] = Field(max_length=256)` — out of range returns 422. Real callers debug a handful of vectors at a time.  In `FaissBackend.reconstruct`, validate before recon
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224cb2c90556c06d46903cb9de4861867046e56e0c%22%7D%2C%22id%22%3A%22QmdXkXPmy8QXkoPEfgmLdedepDFVUPtLSpnHqBNXut3vwj%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A161%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #160** (2026-09-27): **fix: cross-platform compatibility, config deep merge, and pipeline ro…**
  *Symptoms*: …bustness  - pipelines: use url2pathname for Windows file:// paths in _department_of - pipelines: use atomic replace for image tiles.json and safely close mmap handles - sources/local: standardize to RFC 8089 as_uri() format for file URLs - config: deep merge nested sections in load_config, enforce utf-8, and support backslashes - sources/web: specify utf-8 encoding for urls_file reading - render: forward extract_text for local HTML files in pixelshot CLI - sources/kiwix: cross-platform process termination fallback for Windows in _kill_proc - chunk: fix Windows shard_dir trailing slash parsing, ensure PNG format in fast path, and use atomic write - index: clamp nlist to vector count in build_faiss to prevent crash on small datasets - web: safely handle malformed URI components in agent-server and chat route - tests: unblock department build tests in core test suite and add regression tests
  **Post-Mortem & Fix Analysis**:
  > @smartworldarafath is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2224df1f8624012de57557f44f00b72fb4abd43114%22%7D%2C%22id%22%3A%22QmPqWyie2niFk6CfK57omyoVotnKXhrxqyJpQZsfFqxD6g%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A160%2C%22repo%22%3A%22PixelRAG%22%7D).  
  > Hi maintainers, I've resolved cross-platform issues and edge-case bugs across config, sources, and pipelines, verified all tests and Ruff formatting locally. Ready for review when you have a moment!

- **Issue #159** (2026-09-27): **feat(eval): add optional Atlas Cloud reader**
  *Symptoms*: ## Summary  - Add an opt-in `--atlascloud` evaluation reader using the existing OpenAI-compatible client, an isolated `ATLASCLOUD_API_KEY`, and unchanged catalog model IDs. - Avoid native Gemini routing when Atlas is explicitly selected; reject conflicting provider/endpoint options. - Disable automatic retries for this reader without changing other readers' retry behavior. - Document the optional reader in `eval/README.md` and add offline regression coverage. No default reader or main README changes.  ## Validation  - 35 focused tests passed (`test_eval_model_config.py`, `test_litellm_client.py`, `test_atlascloud_client.py`), including credentials, model routing, timeout/connection/429 handling, and existing-reader retries. - Full-repository `ruff check .` and `ruff format --check .` passed. - Real CLI help and all five Atlas/provider-or-endpoint conflict cases passed. - `uv build --no-sources` and `git diff --check` passed. - One real request through `run_bench.main()` with a single local text fixture and `openai/gpt-4.1-mini`: HTTP 200, expected answer `4`, result JSONL validated, one POST counted. Dataset loading alone was replaced by the fixture; routing, message construction, HTTP client and output writing were real.  The benchmark's unrelated retrieval-status probes returned 502 during the naive-mode smoke; generation still completed. Full browser/GPU/retrieval suites were not run. Locked core/eval installation was interrupted during the large browser dependency downloa
  **Post-Mortem & Fix Analysis**:
  > @binyangzhu000-sudo is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%221b42622e8efd1ab89247dc07622b614757c3ab46%22%7D%2C%22id%22%3A%22QmPMjd1qyAfc8XqjjoEtdQNExBF4Xt5sDon9occtUQvYjP%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A159%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #158** (2026-09-14): **docs: link community LangChain integration**
  *Symptoms*: ## Summary  - link the community-maintained `pixelrag-langchain` integration from the existing "Connect your own agent" section - point readers to both the PyPI package and its GitHub source  ## Validation  - `npm run typecheck` - `npm test` (10 tests passed) - `git diff --check`  Related to #128.
  **Post-Mortem & Fix Analysis**:
  > @navneet-singh2907 is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2296467fe65675abc3a97e9de7cf493b5713b73294%22%7D%2C%22id%22%3A%22QmcGS6eKbac7G7dBgKxdtwdoSXiSdG44anscA1oPEf3XyJ%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A158%2C%22repo%22%3A%22PixelRAG%22%7D).  

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

### Incident Patch 1: `c6abea31` (2026-10-01)
**Commit Message**: fix(serve): cap on-demand renders per /search request (#164)

With render-on-demand enabled (--kiwix-url), every hit whose tile is not
on disk triggers a Chrome page render inside OnDemandTiles.chunk_path —
serialized on a process-global lock and bounded only by
PIXELRAG_RENDER_TIMEOUT (120s by default). Nothing capped how many one
request could ask for. At this endpoint's own limits (32 queries from
#154, n_docs <= 1000 from #122) a single include_images request could
queue tens of thousands of renders, and because the lock is process-wide
it stalls every other caller's renders too. No auth stands in front of it.

Budget the renders per request (16). Past it a hit is returned without
its image, which is already what a failed render or a missing tile
yields, and the client can still fetch it from /tile.

Cache hits must not spend the budget — in a warm deployment most calls
are hits and cost only a stat. OnDemandTiles grows `cached_chunk_path`,
which reports an already-rendered chunk without rendering, so the handler
can tell the two apart before committing; `chunk_path` now routes through
it, with the filename built in one place (`_chunk_file`).

Not addressed: the global lock sti

**File**: `serve/src/pixelrag_serve/api.py` (modified, +27/-5)
```diff
@@ -279,6 +279,10 @@ class StatusResponse(BaseModel):
 _MAX_IMAGE_B64_LEN = 10 * 1024 * 1024
 _MAX_IMAGE_PIXELS = 25_000_000
 
+# Most on-demand renders one /search request may trigger (see the search handler).
+# A real caller asks for n_docs=10 with include_images, so this is generous.
+_MAX_ONDEMAND_RENDERS = 16
+
 
 def _parse_queries(
     queries: list[Query], instruction: str | None = None
@@ -540,6 +544,18 @@ async def search(req: SearchRequest, request: Request):
     # Build results
     tiles_dir = _state.get("tiles_dir", "")
 
+    # Budget for on-demand renders across the whole request. A render is a
+    # Chrome page load under a process-global lock, bounded only by
+    # PIXELRAG_RENDER_TIMEOUT (120s by default), and nothing else caps how many
+    # one request can ask for: at this endpoint's own limits (32 queries,
+    # n_docs <= 1000) a single include_images request could queue tens of
+    # thousands of them, stalling every other caller's renders behind the same
+    # lock. Past the budget a hit is returned without its image — what a failed
+    # render or a missing tile already yields — and the client can still fetch
+    # it from /tile. Cache hits are cheap and don't spend the budget.
+    ondemand = _state.get("ondemand")
+    renders_left = _MAX_ONDEMAND_RENDERS
+
     results = []
     for qi in range(len(req.queries)):
         hits = []
@@ -559,11 +575,17 @@ async def search(req: SearchRequest, request: Request):
             if req.include_images and tile_path and os.path.exists(tile_path):
                 with open(tile_path, "rb") as fp:
                     img_b64 = base64.b64encode(fp.read()).decode()
-            elif req.include_images and _state.get("ondemand") is not None:
-                # Render off the event loop: _ondemand_chunk_b64 -> render_url uses
-                # asyncio.run(), which raises "cannot be called from a running event
-                # loop" if invoked directly here. Offload to a worker thread.
-                img_b64 = await asyncio.to_thread(_ondemand_chunk_b64, aid, ti, ci, th)
+            elif req.include_images and ondemand is not None:
+                cached = ondemand.cached_chunk_path(aid, ti, ci) is not None
+                if cached or renders_left > 0:
+                    if not cached:
+                        renders_left -= 1
+                    # Render off the event loop: _ondemand_chunk_b64 -> render_url uses
+                    # asyncio.run(), which raises "cannot be called from a running event
+                    # loop" if invoked directly here. Offload to a worker thread.
+                    img_b64 = await asyncio.to_thread(
+                        _ondemand_chunk_b64, aid, ti, ci, th
+                    )
             # Expose a relative tile path, not the absolute server filesystem
             # path (avoids leaking the host's directory layout; clients fetch
             # tiles via /tile/{article_id}/{tile_index}/{chunk_index}).
```

**File**: `serve/src/pixelrag_serve/render_ondemand.py` (modified, +17/-4)
```diff
@@ -112,14 +112,27 @@ def _ensure_chrome(self) -> str:
     def _article_dir(self, article_id: int) -> str:
         return os.path.join(self.cache_dir, f"{article_id}.png.tiles")
 
+    def _chunk_file(self, article_id: int, tile_index: int, chunk_index: int) -> str:
+        chunk_name = f"chunk_{tile_index:04d}_{chunk_index:02d}.png"
+        return os.path.join(self._article_dir(article_id), chunk_name)
+
+    def cached_chunk_path(self, article_id: int, tile_index: int, chunk_index: int):
+        """Path to an already-rendered chunk, or None. Never renders.
+
+        Lets a caller tell a cheap cache hit from a page render before
+        committing to one.
+        """
+        cpath = self._chunk_file(article_id, tile_index, chunk_index)
+        return cpath if os.path.exists(cpath) else None
+
     def chunk_path(
         self, article_id: int, title: str, tile_index: int, chunk_index: int
     ):
         """Path to chunk_{ti}_{ci}.png, rendering+chunking the page on a cache miss."""
-        chunk_name = f"chunk_{tile_index:04d}_{chunk_index:02d}.png"
-        cpath = os.path.join(self._article_dir(article_id), chunk_name)
-        if os.path.exists(cpath):
-            return cpath
+        cached = self.cached_chunk_path(article_id, tile_index, chunk_index)
+        if cached:
+            return cached
+        cpath = self._chunk_file(article_id, tile_index, chunk_index)
         if not title:
             return None
         with _render_lock:
```

**File**: `tests/test_serve_ondemand_budget.py` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+"""Cap on on-demand renders per /search request (DoS hardening).
+
+An on-demand render is a Chrome page load under a process-global lock with a
+120s timeout. Without a per-request budget, one `include_images` request could
+queue one per hit — at the endpoint's own limits, tens of thousands — and every
+other caller's renders stall behind the same lock.
+
+Driven through the real handler with pre-computed embeddings, so no model or
+index is needed.
+"""
+
+import numpy as np
+import pytest
+
+pytest.importorskip("fastapi", reason="serve extra not installed")
+from fastapi.testclient import TestClient
+from pixelrag_serve import api
+
+DIM = 4
+N_HITS = 40  # more hits than the budget allows renders
+
+
+class _CountingOnDemand:
+    """Stands in for OnDemandTiles: counts renders, never touches Chrome."""
+
+    def __init__(self, cached: set[int] | None = None):
+        self.cached = cached or set()
+        self.renders = 0
+
+    def cached_chunk_path(self, article_id, tile_index, chunk_index):
+        return f"/cached/{article_id}.png" if article_id in self.cached else None
+
+    def chunk_path(self, article_id, title, tile_index, chunk_index):
+        if article_id not in self.cached:
+            self.renders += 1
+
+
+class _StubBackend:
+    dimension = DIM
+
+    def set_nprobe(self, n):
+        pass
+
+    def reset_nprobe(self):
+        pass
+
+    def raw_search(self, query_vectors, k, **kw):
+        return [
+            [
+                {
+                    "score": 1.0,
+                    "vector_id": i,
+                    "article_id": i,
+                    "tile_index": 0,
+                    "chunk_index": 0,
+                    "y_offset": 0,
+                    "tile_height": 100,
+                }
+                for i in range(min(k, N_HITS))
+            ]
+            for _ in query_vectors
+        ]
+
+
+@pytest.fixture
+def client(tmp_path):
+    def _make(ondemand):
+        api._state.clear()
+        api._state.update(
+            {
+                "backend": _StubBackend(),
+                "articles": [f"Article_{i}" for i in range(N_HITS)],
+                "dimension": DIM,
+                "tiles_dir": str(tmp_path),  # empty: nothing is on disk
+                "ondemand": ondemand,
+            }
+        )
+        api._article_pages.cache_clear()
+        return TestClient(api.app)
+
+    yield _make
+    api._state.clear()
+
+
+def _search(client, n_docs):
+    body = {
+        "queries": [{"embedding": np.ones(DIM).tolist()}],
+        "n_docs": n_docs,
+        "include_images": True,
+    }
+    resp = client.post("/search", json=body)
+    assert resp.status_code == 200, resp.text
+    return resp.json()
+
+
+def test_renders_are_capped_per_request(client):
+    od = _CountingOnDemand()
+    body = _search(client(od), N_HITS)
+    # Every hit still comes back — only the images past the budget are dropped.
+    assert len(body["results"][0]["hits"]) == N_HITS
+    assert od.renders == api._MAX_ONDEMAND_RENDERS
+
+
+def test_budget_spans_all_queries_in_one_request(client):
+    od = _CountingOnDemand()
+    c = client(od)
+    resp = c.post(
+        "/search",
+        json={
+            "queries": [{"embedding": np.ones(DIM).tolist()} for _ in range(4)],
+            "n_docs": N_HITS,
+            "include_images": True,
+        },
+    )
+    assert resp.status_code == 200, resp.text
+    # One budget for the request, not one per query.
+    assert od.renders == api._MAX_ONDEMAND_RENDERS
+
+
+def test_cache_hits_do_not_spend_the_budget(client):
+    # Every article already rendered: serving them must cost no renders at all.
+    od = _CountingOnDemand(cached=set(range(N_HITS)))
+    _search(client(od), N_HITS)
+    assert od.renders == 0
```

---

### Incident Patch 2: `6e087f8d` (2026-09-27)
**Commit Message**: fix: cross-platform compatibility, config deep merge, and pipeline ro… (#160)

* fix: cross-platform compatibility, config deep merge, and pipeline robustness

- pipelines: use url2pathname for Windows file:// paths in _department_of
- pipelines: use atomic replace for image tiles.json and safely close mmap handles
- sources/local: standardize to RFC 8089 as_uri() format for file URLs
- config: deep merge nested sections in load_config, enforce utf-8, and support backslashes
- sources/web: specify utf-8 encoding for urls_file reading
- render: forward extract_text for local HTML files in pixelshot CLI
- sources/kiwix: cross-platform process termination fallback for Windows in _kill_proc
- chunk: fix Windows shard_dir trailing slash parsing, ensure PNG format in fast path, and use atomic write
- index: clamp nlist to vector count in build_faiss to prevent crash on small datasets
- web: safely handle malformed URI components in agent-server and chat route
- tests: unblock department build tests in core test suite and add regression tests

* style: format code with ruff and clean up unused imports

* fix(test): stop test_kiwix_kill_proc sending a real SIGTERM

The test passed a bare M

**File**: `embed/src/pixelrag_embed/chunk.py` (modified, +9/-3)
```diff
@@ -162,8 +162,12 @@ def chunk_article(article_dir: str, dry_run: bool = False, force: bool = False)
             chunk_name = f"chunk_{tile_idx:04d}_00.png"
             chunk_path = os.path.join(article_dir, chunk_name)
             if not dry_run:
-                shutil.copy2(tile_path, chunk_path)
+                if tile_path.endswith(".png"):
+                    shutil.copy2(tile_path, chunk_path)
+                else:
+                    img.save(chunk_path, format="PNG")
                 files_written += 1
+            img.close()
             chunks_info.append(
                 {
                     "tile": tile_name,
@@ -241,8 +245,10 @@ def chunk_article(article_dir: str, dry_run: bool = False, force: bool = False)
         manifest["article_id"] = article_id
 
     if not dry_run:
-        with open(chunks_json, "w") as f:
+        tmp_chunks = chunks_json + ".tmp"
+        with open(tmp_chunks, "w") as f:
             json.dump(manifest, f)
+        os.replace(tmp_chunks, chunks_json)
 
     return {
         "article_dir": article_dir,
@@ -344,7 +350,7 @@ def process_shard(
         tiles_deleted = _delete_tiles_in_shard(shard_dir)
 
     elapsed = time.time() - t0
-    shard_name = os.path.basename(shard_dir.rstrip("/"))
+    shard_name = os.path.basename(shard_dir.rstrip("/\\"))
     return {
         "shard": shard_name,
         "articles": total_articles,
```

**File**: `embed/src/pixelrag_embed/index.py` (modified, +4/-0)
```diff
@@ -195,6 +195,10 @@ def build_ivf(
     # Build IVF index
     metric_type = faiss.METRIC_INNER_PRODUCT if metric == "ip" else faiss.METRIC_L2
 
+    # Auto-adjust nlist when dataset is smaller than configured nlist
+    if n < nlist:
+        nlist = max(1, n)
+
     # Train on a sample
     actual_train = min(train_sample, n)
     train_indices = np.random.choice(n, actual_train, replace=False)
```

**File**: `index/src/pixelrag_index/config.py` (modified, +11/-3)
```diff
@@ -21,18 +21,26 @@ def load_config(path=None):
                 path = str(c)
                 break
     if path and os.path.exists(path):
-        with open(path) as f:
+        with open(path, encoding="utf-8") as f:
             config = yaml.safe_load(f) or {}
     else:
         config = {}
-    return {**DEFAULT_CONFIG, **config}
+    merged = {**DEFAULT_CONFIG, **config}
+    for section in ("ingest", "embed"):
+        if (
+            section in DEFAULT_CONFIG
+            and section in config
+            and isinstance(config[section], dict)
+        ):
+            merged[section] = {**DEFAULT_CONFIG[section], **config[section]}
+    return merged
 
 
 def make_source(config):
     source_config = dict(config.get("source", {}))
     source_type = source_config.pop("type", "local")
     # Expand ~ in any string values that look like paths
     for k, v in source_config.items():
-        if isinstance(v, str) and ("/" in v or "~" in v):
+        if isinstance(v, str) and ("/" in v or "\\" in v or "~" in v):
             source_config[k] = str(Path(v).expanduser())
     return SOURCES[source_type](**source_config)
```

**File**: `index/src/pixelrag_index/pipelines.py` (modified, +10/-7)
```diff
@@ -63,9 +63,10 @@ def _department_of(article: dict, source_root: str) -> str:
     if not raw:
         url = article.get("url") or ""
         if url.startswith("file://"):
-            from urllib.parse import unquote, urlparse
+            from urllib.parse import urlparse
+            from urllib.request import url2pathname
 
-            raw = unquote(urlparse(url).path)
+            raw = url2pathname(urlparse(url).path)
     if not raw or not source_root:
         return ""
     try:
@@ -291,8 +292,9 @@ def _repl(m: re.Match) -> str:
                     "tiles": ["tile_0000.jpg"],
                     "complete": True,
                 }
-                with open(tile_dir / "tiles.json", "w") as f:
-                    json.dump(manifest, f)
+                tmp_tiles = tile_dir / "tiles.json.tmp"
+                tmp_tiles.write_text(json.dumps(manifest))
+                os.replace(tmp_tiles, tile_dir / "tiles.json")
             except Exception as e:
                 logger.warning("  FAILED image %s: %s", doc.id, e)
         logger.info("  Rendered %d local images", len(image_docs))
@@ -441,9 +443,10 @@ def _repl(m: re.Match) -> str:
         import numpy as np
 
         npz_files = sorted(embeddings_dir.glob("shard_*.npz"))
-        total_vectors = sum(
-            np.load(f, mmap_mode="r")["embeddings"].shape[0] for f in npz_files
-        )
+        total_vectors = 0
+        for f in npz_files:
+            with np.load(f, mmap_mode="r") as data:
+                total_vectors += data["embeddings"].shape[0]
         nlist = min(4096, max(1, total_vectors // 40))
         logger.info(
             "Stage 4/4: Building FAISS index (%d vectors, nlist=%d)...",
```

**File**: `index/src/pixelrag_index/sources/kiwix.py` (modified, +16/-2)
```diff
@@ -233,19 +233,33 @@ def ensure_running(self) -> None:
             self._start_instance(idx)
 
     def _kill_proc(self, proc: subprocess.Popen) -> None:
+        if proc.poll() is not None:
+            return
         try:
-            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
+            if hasattr(os, "killpg") and hasattr(os, "getpgid"):
+                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
+            else:
+                proc.terminate()
         except (OSError, ProcessLookupError):
             pass
         try:
             proc.wait(timeout=5)
         except subprocess.TimeoutExpired:
             try:
-                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
+                if (
+                    hasattr(os, "killpg")
+                    and hasattr(os, "getpgid")
+                    and hasattr(signal, "SIGKILL")
+                ):
+                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
+                else:
+                    proc.kill()
             except (OSError, ProcessLookupError):
                 pass
 
     def stop(self) -> None:
+        if not hasattr(self, "_procs"):
+            return
         for idx, proc in enumerate(self._procs):
             if proc is not None:
                 self._kill_proc(proc)
```

**File**: `index/src/pixelrag_index/sources/local.py` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ def __iter__(self) -> Iterator[Document]:
             if ftype == "web":
                 yield Document(
                     id=f.stem,
-                    url=f"file://{f.resolve()}",
+                    url=f.resolve().as_uri(),
                     metadata={"type": ftype},
                 )
             elif ftype == "text":
```

**File**: `index/src/pixelrag_index/sources/web.py` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ def __init__(
         if urls_file:
             p = Path(urls_file)
             if p.exists():
-                with open(p) as f:
+                with open(p, encoding="utf-8") as f:
                     self._urls = [
                         line.strip()
                         for line in f
```

**File**: `render/src/pixelrag_render/render.py` (modified, +1/-0)
```diff
@@ -376,6 +376,7 @@ def main() -> None:
                     viewport_width=args.viewport_width,
                     workers=1,
                     wait_network_idle=args.wait_network_idle,
+                    extract_text=args.extract_text,
                     cdp_url=args.cdp_url,
                 )
             elif suffix in {".png", ".jpg", ".jpeg", ".webp"}:
```

---

### Incident Patch 3: `7a484cbc` (2026-09-27)
**Commit Message**: fix(serve): bound /reconstruct and stop unknown ids becoming 500s (#161)

`ReconstructRequest.vector_ids` had no cap. Each id returns a full
`dimension`-length float list (~40 KB of JSON at dim 2048) and the first
call builds a direct map over the whole index, so a single request could
force a multi-GB response on the public endpoint — the same class as the
/search bounds in #122 and #154. Cap at 256 ids (out of range -> 422).

`FaissBackend.reconstruct` also did `self.index.reconstruct(int(v))` with
no validation: a non-numeric id raised ValueError and an out-of-range id
raised RuntimeError, both surfacing as uncaught 500s. Vectors are added
sequentially (`index.add`, no IDMap), so valid ids are 0..ntotal-1 —
anything else now yields None, which is the VectorBackend protocol's
documented `list[float] | None` and what QdrantBackend already returned.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `serve/src/pixelrag_serve/api.py` (modified, +8/-1)
```diff
@@ -639,8 +639,15 @@ async def departments():
     }
 
 
+# Bound for the public /reconstruct endpoint: every id returns a full
+# `dimension`-length float list, which serializes to ~40 KB of JSON at dim 2048,
+# and the first call builds a direct map over the whole index. Real callers
+# debug a handful of vectors at a time.
+_MAX_RECONSTRUCT_IDS = 256
+
+
 class ReconstructRequest(BaseModel):
-    vector_ids: list[int | str]
+    vector_ids: list[int | str] = Field(max_length=_MAX_RECONSTRUCT_IDS)
 
 
 @app.post("/reconstruct")
```

**File**: `serve/src/pixelrag_serve/backends.py` (modified, +17/-1)
```diff
@@ -163,7 +163,23 @@ def reconstruct(self, vids):
         if not self._direct_map_built and hasattr(self.index, "make_direct_map"):
             self.index.make_direct_map()
             self._direct_map_built = True
-        return [self.index.reconstruct(int(v)).tolist() for v in vids]
+        out = []
+        for v in vids:
+            # Vectors are added sequentially (index.add, no IDMap), so valid ids
+            # are 0..ntotal-1. An unknown or non-integer id yields None — the
+            # protocol's documented `list[float] | None`, and what QdrantBackend
+            # already does — instead of an uncaught ValueError/RuntimeError
+            # surfacing as a 500 on the public endpoint.
+            try:
+                i = int(v)
+            except (TypeError, ValueError):
+                out.append(None)
+                continue
+            if not 0 <= i < self.index.ntotal:
+                out.append(None)
+                continue
+            out.append(self.index.reconstruct(i).tolist())
+        return out
 
 
 class QdrantBackend:
```

**File**: `tests/test_serve_backends.py` (modified, +11/-0)
```diff
@@ -185,5 +185,16 @@ def test_reconstruct_round_trips(backend):
     np.testing.assert_allclose(np.asarray(vecs[1]), VECTORS[5], atol=1e-6)
 
 
+def test_reconstruct_unknown_id_is_none(backend):
+    # Both backends report an id they don't hold as None rather than raising —
+    # /reconstruct is public, so an unknown id must not become a 500.
+    assert backend.reconstruct([1, 10**6])[1:] == [None]
+
+
+def test_reconstruct_non_integer_id_is_none(faiss_backend):
+    # FAISS ids are integers; a non-numeric id is a client mistake, not a crash.
+    assert faiss_backend.reconstruct(["not-an-id"]) == [None]
+
+
 def test_k_zero_returns_empty(backend):
     assert backend.raw_search(VECTORS[0:1], 0) == [[]]
```

**File**: `tests/test_serve_reconstruct.py` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+"""Input bound on the public /reconstruct endpoint (OOM/DoS hardening).
+
+Every id returns a full `dimension`-length float list (~40 KB of JSON at dim
+2048) and the first call builds a direct map over the index, so an unbounded
+`vector_ids` list is the same class of trivial OOM as the /search bounds.
+"""
+
+import pytest
+
+pytest.importorskip("fastapi", reason="serve extra not installed")
+from pixelrag_serve.api import _MAX_RECONSTRUCT_IDS, ReconstructRequest
+from pydantic import ValidationError
+
+
+def test_vector_ids_are_capped():
+    ReconstructRequest(vector_ids=list(range(_MAX_RECONSTRUCT_IDS)))
+    with pytest.raises(ValidationError):
+        ReconstructRequest(vector_ids=list(range(_MAX_RECONSTRUCT_IDS + 1)))
```

---

### Incident Patch 4: `aba824b3` (2026-09-24)
**Commit Message**: feat(index): add IVF+PQ compression flag for the FAISS build (#155)

* feat(index): add IVF+PQ compression flag for the FAISS build (closes #153)

* test(index): drop unused noqa flagged by RUF100

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `embed/src/pixelrag_embed/index.py` (modified, +36/-2)
```diff
@@ -148,15 +148,21 @@ def build_ivf(
     train_sample: int = 500_000,
     metric: str = "ip",
     gpu_id: int = -1,
+    pq_m: int = 0,
+    pq_nbits: int = 8,
 ):
-    """Build FAISS IVFFlat index.
+    """Build a FAISS IVF index — IVFFlat by default, IVFPQ when pq_m > 0.
 
     Args:
         nlist: number of IVF clusters (default 4096, good for ~30M vectors)
         nprobe: default search nprobe stored in the index
         train_sample: number of vectors to sample for K-means training
         metric: 'ip' (inner product / cosine for L2-normalized vectors) or 'l2'
         gpu_id: GPU to use for training (-1 = CPU only)
+        pq_m: PQ sub-quantizers. 0 keeps the uncompressed IVFFlat index; >0 builds
+            an IVFPQ index that stores pq_m bytes/vector (at nbits=8) instead of
+            dim*4 — ~128x smaller for dim=2048, pq_m=64. Must divide dim evenly.
+        pq_nbits: bits per PQ sub-quantizer (4 or 8), only used when pq_m > 0.
     """
     import faiss
 
@@ -195,7 +201,16 @@ def build_ivf(
     train_data = embeddings[train_indices]
 
     quantizer = faiss.IndexFlatIP(dim) if metric == "ip" else faiss.IndexFlatL2(dim)
-    index = faiss.IndexIVFFlat(quantizer, dim, nlist, metric_type)
+    if pq_m > 0:
+        if dim % pq_m != 0:
+            raise ValueError(
+                f"--pq-m ({pq_m}) must divide the embedding dim ({dim}) evenly"
+            )
+        # Pass metric_type explicitly: faiss.IndexIVFPQ defaults to METRIC_L2,
+        # which is wrong for the IP-normalized embeddings this index uses.
+        index = faiss.IndexIVFPQ(quantizer, dim, nlist, pq_m, pq_nbits, metric_type)
+    else:
+        index = faiss.IndexIVFFlat(quantizer, dim, nlist, metric_type)
 
     if gpu_id >= 0:
         # GPU-accelerated training: move CPU index to GPU, train, move back
@@ -250,6 +265,9 @@ def build_ivf(
         "nlist": nlist,
         "nprobe": nprobe,
         "metric": metric,
+        "index_type": "ivfpq" if pq_m > 0 else "ivfflat",
+        "pq_m": pq_m,
+        "pq_nbits": pq_nbits if pq_m > 0 else None,
         "index_file": index_path,
         "metadata_file": metadata_path,
     }
@@ -419,6 +437,20 @@ def main():
     p_build.add_argument(
         "--nlist", type=int, default=4096, help="Number of IVF clusters (default: 4096)"
     )
+    p_build.add_argument(
+        "--pq-m",
+        type=int,
+        default=0,
+        help="PQ sub-quantizers for IVFPQ compression (0 = uncompressed IVFFlat). "
+        "Must divide the embedding dim evenly; e.g. 64 for dim 2048 → 64 B/vector.",
+    )
+    p_build.add_argument(
+        "--pq-nbits",
+        type=int,
+        default=8,
+        choices=[4, 8],
+        help="Bits per PQ sub-quantizer (default: 8). Only used when --pq-m > 0.",
+    )
     p_build.add_argument(
         "--nprobe",
         type=int,
@@ -515,6 +547,8 @@ def main():
                 train_sample=args.train_sample,
                 metric=args.metric,
                 gpu_id=args.gpu_id,
+                pq_m=args.pq_m,
+                pq_nbits=args.pq_nbits,
             )
     elif args.command == "test":
         test_search(args.index_dir, nprobe=args.nprobe, k=args.k)
```

**File**: `index/src/pixelrag_index/pipelines.py` (modified, +4/-0)
```diff
@@ -451,6 +451,10 @@ def _repl(m: re.Match) -> str:
             nlist,
         )
         cmd += ["--nlist", str(nlist)]
+        if index_cfg.get("pq_m"):
+            cmd += ["--pq-m", str(index_cfg["pq_m"])]
+            if index_cfg.get("pq_nbits"):
+                cmd += ["--pq-nbits", str(index_cfg["pq_nbits"])]
     subprocess.run(cmd, check=True)
 
     logger.info("Index built at %s", output)
```

**File**: `tests/test_ivfpq_index.py` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+"""IVFPQ compression path for the FAISS index build (issue #153).
+
+`build_ivf(pq_m>0)` must produce a trained, searchable IndexIVFPQ that keeps the
+inner-product metric — `faiss.IndexIVFPQ` defaults to L2, which would silently
+wreck ranking on these L2-normalized embeddings.
+"""
+
+import json
+import sys
+
+import numpy as np
+import pytest
+
+faiss = pytest.importorskip("faiss")
+sys.path.insert(0, "embed/src")
+from pixelrag_embed.index import build_ivf
+
+
+def _write_shard(emb_dir, n=1024, dim=32):
+    rng = np.random.default_rng(0)
+    emb = rng.standard_normal((n, dim)).astype(np.float32)
+    emb /= np.linalg.norm(emb, axis=1, keepdims=True)  # L2-normalized (cosine/IP)
+    np.savez(
+        emb_dir / "shard_000.npz",
+        embeddings=emb,
+        article_ids=np.arange(n, dtype=np.int64),
+        tile_indices=np.zeros(n, dtype=np.int32),
+        chunk_indices=np.arange(n, dtype=np.int32),
+        y_offsets=np.zeros(n, dtype=np.int32),
+        tile_heights=np.full(n, 100, dtype=np.int32),
+    )
+    return emb
+
+
+def test_ivfpq_index_is_built_trained_and_searchable(tmp_path):
+    emb_dir = tmp_path / "emb"
+    emb_dir.mkdir()
+    emb = _write_shard(emb_dir, dim=32)
+    out = tmp_path / "out"
+
+    build_ivf(str(emb_dir), str(out), nlist=8, nprobe=8, pq_m=8, pq_nbits=4)
+
+    index = faiss.read_index(str(out / "index.faiss"))
+    assert isinstance(index, faiss.IndexIVFPQ)
+    # The bug in the issue's own sketch: without the metric arg this would be L2.
+    assert index.metric_type == faiss.METRIC_INNER_PRODUCT
+    assert index.ntotal == emb.shape[0]
+    _, ids = index.search(emb[:1], 5)
+    assert ids.shape == (1, 5) and (ids[0] >= 0).all()
+
+    summary = json.loads((out / "summary.json").read_text())
+    assert summary["index_type"] == "ivfpq"
+    assert summary["pq_m"] == 8 and summary["pq_nbits"] == 4
+
+
+def test_pq_m_must_divide_dim(tmp_path):
+    emb_dir = tmp_path / "emb"
+    emb_dir.mkdir()
+    _write_shard(emb_dir, dim=32)
+    with pytest.raises(ValueError, match="divide"):
+        build_ivf(str(emb_dir), str(tmp_path / "out"), nlist=8, pq_m=7)
+
+
+def test_default_stays_ivfflat(tmp_path):
+    emb_dir = tmp_path / "emb"
+    emb_dir.mkdir()
+    _write_shard(emb_dir, dim=32)
+    out = tmp_path / "out"
+    build_ivf(str(emb_dir), str(out), nlist=8)
+    index = faiss.read_index(str(out / "index.faiss"))
+    assert isinstance(index, faiss.IndexIVFFlat)
```

---

### Incident Patch 5: `c0cfe7f7` (2026-09-24)
**Commit Message**: fix(serve): bound query image decode and batch size to prevent OOM/DoS (#154)

* fix(serve): bound query image decode and batch size to prevent OOM/DoS

* test(serve): skip image-input tests without serve extra, sort imports

CI's Tests job runs `uv sync --extra dev` only, so fastapi isn't
installed; skip like test_serve_backends does for faiss.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `serve/src/pixelrag_serve/api.py` (modified, +30/-3)
```diff
@@ -171,7 +171,9 @@ class Query(BaseModel):
 
 
 class SearchRequest(BaseModel):
-    queries: list[Query]
+    # Bounded: an unbounded batch multiplies every per-query cost (embedding,
+    # image decode) on the public endpoint. Real callers send 1; 32 is generous.
+    queries: list[Query] = Field(max_length=32)
     # Bounded: fetch_k = n_docs * 10 feeds FAISS search k, so an unbounded value
     # is a trivial OOM/DoS on the public endpoint. Largest real caller uses 10.
     n_docs: int = Field(default=10, ge=1, le=1000)
@@ -271,6 +273,12 @@ class StatusResponse(BaseModel):
 
 DEFAULT_INSTRUCTION = "Retrieve images or text relevant to the user's query."
 
+# Bounds for attacker-controlled query images on the public /search endpoint.
+# ~10 MB of base64 caps the payload/decode; 25 MP caps the decoded RGB canvas
+# (query images are downscaled far below this for the VL model anyway).
+_MAX_IMAGE_B64_LEN = 10 * 1024 * 1024
+_MAX_IMAGE_PIXELS = 25_000_000
+
 
 def _parse_queries(
     queries: list[Query], instruction: str | None = None
@@ -291,8 +299,27 @@ def _parse_queries(
             img_data = q.image
             if img_data.startswith("data:"):
                 img_data = img_data.split(",", 1)[-1]
-            img_bytes = base64.b64decode(img_data)
-            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
+            # Public endpoint: q.image is attacker-controlled. Bound the payload
+            # and the decoded canvas so an oversized blob or a tiny
+            # "decompression bomb" can't OOM the service, and turn any decode
+            # failure into a clean 400 instead of an uncaught 500.
+            if len(img_data) > _MAX_IMAGE_B64_LEN:
+                raise HTTPException(
+                    status_code=400,
+                    detail=f"image too large (max {_MAX_IMAGE_B64_LEN} base64 chars)",
+                )
+            try:
+                img = Image.open(io.BytesIO(base64.b64decode(img_data)))
+                if img.width * img.height > _MAX_IMAGE_PIXELS:
+                    raise HTTPException(
+                        status_code=400,
+                        detail=f"image too large (max {_MAX_IMAGE_PIXELS} pixels)",
+                    )
+                img = img.convert("RGB")
+            except HTTPException:
+                raise
+            except Exception:
+                raise HTTPException(status_code=400, detail="invalid image data")
             user_content.append({"type": "image", "image": img})
         if q.text:
             user_content.append({"type": "text", "text": q.text})
```

**File**: `tests/test_serve_image_input.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""Input bounds on the public /search endpoint (OOM/DoS hardening).
+
+`_parse_queries` decodes attacker-controlled base64 images and `SearchRequest`
+caps the batch size. A crafted request must not exhaust memory or turn an
+uncaught decode error into a 500 — the same public-endpoint hardening as the
+n_docs bound.
+"""
+
+import base64
+import io
+
+import pytest
+
+pytest.importorskip("fastapi", reason="serve extra not installed")
+from fastapi import HTTPException
+from PIL import Image
+from pixelrag_serve.api import Query, SearchRequest, _parse_queries
+from pydantic import ValidationError
+
+
+def _png_b64(w: int, h: int) -> str:
+    buf = io.BytesIO()
+    Image.new("RGB", (w, h)).save(buf, format="PNG")
+    return base64.b64encode(buf.getvalue()).decode()
+
+
+def test_queries_batch_is_capped():
+    SearchRequest(queries=[Query(text="ok")])  # small batch fine
+    with pytest.raises(ValidationError):
+        SearchRequest(queries=[Query(text="x")] * 33)
+
+
+def test_valid_image_decodes():
+    _, images = _parse_queries([Query(image=_png_b64(4, 4))])
+    assert images[0] is not None and images[0].mode == "RGB"
+
+
+def test_corrupt_image_is_400_not_500():
+    not_an_image = base64.b64encode(b"hello world, definitely not a png").decode()
+    with pytest.raises(HTTPException) as e:
+        _parse_queries([Query(image=not_an_image)])
+    assert e.value.status_code == 400
+
+
+def test_oversized_payload_is_400(monkeypatch):
+    monkeypatch.setattr("pixelrag_serve.api._MAX_IMAGE_B64_LEN", 16)
+    with pytest.raises(HTTPException) as e:
+        _parse_queries([Query(image=_png_b64(4, 4))])  # base64 longer than 16
+    assert e.value.status_code == 400
+
+
+def test_decompression_bomb_is_400(monkeypatch):
+    # A small image over a lowered pixel cap stands in for a bomb whose header
+    # claims a huge canvas — the guard must reject before .convert() allocates.
+    monkeypatch.setattr("pixelrag_serve.api._MAX_IMAGE_PIXELS", 100)
+    with pytest.raises(HTTPException) as e:
+        _parse_queries([Query(image=_png_b64(50, 50))])  # 2500 px > 100
+    assert e.value.status_code == 400
```

---

### Incident Patch 6: `0e22177a` (2026-09-09)
**Commit Message**: fix(opencode-plugin): default the tile directory inside the project (#157)

The screenshot tool defaulted output to /tmp/pixelbrowse, outside the
project root, so reading the tiles hits opencode's external_directory
permission. Under `opencode run` that is auto-rejected and the agent is
left holding tile paths it cannot open; the TUI prompts on every
screenshot instead.

execute now takes the ToolContext it is already passed and defaults to
<worktree>/.opencode/pixelbrowse. Measured on opencode 1.18.29 with
pixelshot from pixelrag 0.4.0: the same page and the same plugin read
the tiles first try when output is project-local, and are rejected when
it is /tmp/pixelbrowse.

**File**: `plugin/opencode/README.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ opencode run "screenshot https://news.ycombinator.com and summarize the top stor
 
 The agent calls the `screenshot` tool with a URL (or a local HTML file, PDF, or image),
 gets back the tile image paths, and reads them visually. Optional tool args: `output`
-(tile directory, default `/tmp/pixelbrowse`) and `viewportWidth` (default 875; use 1280
+(tile directory, default `.opencode/pixelbrowse` inside the project) and `viewportWidth` (default 875; use 1280
 for desktop layouts).
 
 No MCP server, no backend — the plugin just calls `pixelshot` on your machine.
```

**File**: `plugin/opencode/index.js` (modified, +10/-4)
```diff
@@ -13,7 +13,7 @@ further down. Tiles are rendered at 1568px height for optimal vision-model reada
 
 If text or details are too small to read, crop the region of interest from a tile and
 re-read at full resolution. Pillow is always available (it's a pixelshot dependency):
-  python3 -c "from PIL import Image; Image.open('<tile>').crop((x1, y1, x2, y2)).save('/tmp/pixelbrowse/crop.png')"
+  python3 -c "from PIL import Image; Image.open('<tile>').crop((x1, y1, x2, y2)).save('<tile>.crop.png')"
 Crop to roughly 800x800 or smaller for maximum clarity.`
 
 const INSTALL_HINT =
@@ -55,16 +55,22 @@ export const PixelbrowsePlugin = async ({ $ }) => {
           output: tool.schema
             .string()
             .optional()
-            .describe("Output directory for tiles (default /tmp/pixelbrowse)"),
+            .describe(
+              "Output directory for tiles (default .opencode/pixelbrowse inside the project)"
+            ),
           viewportWidth: tool.schema
             .number()
             .optional()
             .describe(
               "Viewport width in px (default 875, mobile/article width). Use 1280 for desktop layouts."
             ),
         },
-        async execute(args) {
-          const output = args.output ?? "/tmp/pixelbrowse"
+        async execute(args, context) {
+          // Default inside the project: tiles written outside it trip opencode's
+          // external_directory permission, which auto-rejects under `opencode run`,
+          // so the agent gets tile paths it is not allowed to read.
+          const output =
+            args.output ?? join(context.worktree ?? context.directory, ".opencode", "pixelbrowse")
 
           try {
             await $`which pixelshot`.quiet()
```

---

### Incident Patch 7: `a9b9bc39` (2026-08-30)
**Commit Message**: fix(render): the PDF manifest's `complete` flag must mean something too (#152)

* fix(render): the PDF manifest's `complete` flag must mean something too

#141 made `complete` derived in both URL backends. The PDF backend writes the
same key into the same filename and still hardcodes it, so the claim #139
makes about the manifest contract still holds on this path: a consumer cannot
tell a whole document from a fragment of one.

render_pdf takes a `pages` selection. When it is given, only those pages are
written — and the manifest still said `complete: true`, with `total_pages`
reporting the size of the subset, so nothing in the directory distinguished
"this three-page document" from "three pages of some longer document".

- `complete` is now `pages is None`: only a whole-document render may claim it.
  An explicit range counts as a selection even when it happens to cover every
  page, because the backend has not checked it against the document's length.
- `requested_pages` records the selection, so a consumer can see what was asked
  for instead of being told out of band — the same move as recording
  `tile_height` in the URL manifests.

No in-repo caller passes `pages` today; it i

**File**: `render/src/pixelrag_render/backends/pdf.py` (modified, +9/-1)
```diff
@@ -113,7 +113,15 @@ def render_pdf(
         "dpi": dpi,
         "total_pages": len(saved_tiles),
         "tiles": saved_tiles,
-        "complete": True,
+        # The selection the render ran with, recorded for the same reason the
+        # URL manifests record their tile height: so a consumer reading
+        # tiles.json can see what was asked for rather than be told out of band.
+        "requested_pages": sorted(pages) if pages is not None else None,
+        # A page selection means these tiles are some of the document rather
+        # than all of it, and nothing here has checked the selection against
+        # the document's length. Only a whole-document render may claim to be
+        # complete — see #139 on what an unconditional flag costs downstream.
+        "complete": pages is None,
     }
     with open(tile_dir / "tiles.json", "w") as f:
         json.dump(manifest, f)
```

**File**: `tests/test_pdf_manifest.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+"""The PDF manifest's `complete` flag must mean what the URL manifests' does.
+
+#139 made the case that a manifest which always claims completeness is worse
+than no flag at all: a consumer cannot tell a whole capture from a fragment,
+so it reads the fragment as the whole. #141 fixed that for the two URL
+backends. The PDF backend writes the same key and still hardcodes it, so a
+caller that asked for a subset of pages gets a directory that claims to be the
+entire document.
+"""
+
+import json
+import shutil
+from pathlib import Path
+
+import pytest
+from PIL import Image
+from pixelrag_render import render_pdf
+
+# pdf2image ships in the optional `pdf` extra and needs poppler's rasteriser on
+# PATH; CI syncs only `--extra dev`. Skip rather than fail, matching how the
+# suite treats the other extras (see test_serve_backends.py).
+pytest.importorskip("pdf2image", reason="pdf extra not installed")
+
+pytestmark = pytest.mark.skipif(
+    shutil.which("pdftoppm") is None,
+    reason="poppler (pdftoppm) not on PATH; pdf2image cannot rasterise",
+)
+
+
+@pytest.fixture
+def three_page_pdf(tmp_path):
+    pdf = tmp_path / "doc.pdf"
+    pages = [Image.new("RGB", (612, 792), "white") for _ in range(3)]
+    pages[0].save(pdf, save_all=True, append_images=pages[1:])
+    return pdf
+
+
+def _manifest(tile_dirs):
+    return json.loads((Path(tile_dirs[0]) / "tiles.json").read_text())
+
+
+def test_pdf_manifest_reports_a_full_render_as_complete(three_page_pdf, tmp_path):
+    dirs = render_pdf(three_page_pdf, tmp_path / "out", dpi=50)
+    manifest = _manifest(dirs)
+
+    assert len(manifest["tiles"]) == 3
+    assert manifest["complete"] is True
+    assert manifest["requested_pages"] is None
+
+
+def test_pdf_manifest_reports_a_page_subset_as_incomplete(three_page_pdf, tmp_path):
+    """The whole point of the flag: two of three pages is not the document."""
+    dirs = render_pdf(three_page_pdf, tmp_path / "out", dpi=50, pages=[1, 3])
+    manifest = _manifest(dirs)
+
+    assert len(manifest["tiles"]) == 2, f"test setup rendered wrong: {manifest}"
+    assert manifest["complete"] is False
+    assert manifest["requested_pages"] == [1, 3]
+
+
+def test_pdf_manifest_records_a_full_page_range_as_incomplete(three_page_pdf, tmp_path):
+    """An explicit range that happens to cover everything is still a request.
+
+    The caller asked for specific pages; the backend has not checked them
+    against the document's length, so it must not claim to have captured the
+    document.
+    """
+    dirs = render_pdf(three_page_pdf, tmp_path / "out", dpi=50, pages=[1, 2, 3])
+    manifest = _manifest(dirs)
+
+    assert len(manifest["tiles"]) == 3
+    assert manifest["complete"] is False
+    assert manifest["requested_pages"] == [1, 2, 3]
```

---

### Incident Patch 8: `86102d01` (2026-08-29)
**Commit Message**: feat(render): --extract-text flag for hybrid output (tiles + text.md) (#106)

* feat(render): --extract-text flag for hybrid output (tiles + text.md)

Adds an opt-in text extraction mode to pixelshot that saves a text.md
file alongside the screenshot tiles. Uses CDP Runtime.evaluate to grab
document.body.innerText after the page is rendered — zero-cost since
the DOM is already open.

Usage:
  pixelshot https://example.com -o ./tiles --extract-text

Output:
  tiles/example.com.png.tiles/
  ├── tile_0000.jpg   # visual tile (existing)
  ├── text.md         # page text as markdown (new)
  └── tiles.json      # manifest

This enables hybrid workflows where LLMs receive text for text-heavy
paragraphs (cheap tokens) and images only for charts/tables/diagrams
(expensive vision tokens).

Addresses #93.

* test: add extract-text hybrid output tests

Verifies text.md is created with page content when extract_text=True,
and not created when the flag is off (default).

* review: route --extract-text down the standard path, and log probe failures

render_urls picks the turbo backend whenever the installed Chrome is
turbo-capable, which is what `pixelshot install-chrome` produces. fast_cdp
has n

**File**: `render/src/pixelrag_render/backends/cdp.py` (modified, +40/-0)
```diff
@@ -414,6 +414,7 @@ async def capture_url(
     image_format: str = "jpeg",
     from_surface: bool = True,
     wait_network_idle: bool = False,
+    extract_text: bool = False,
 ) -> int:
     """Capture a URL as tiled images via direct CDP websocket.
 
@@ -534,6 +535,24 @@ async def capture_url(
     with open(tile_dir / "tiles.json", "w") as f:
         json.dump(manifest, f)
 
+    # Extract page text alongside tiles (hybrid output mode)
+    if extract_text:
+        try:
+            text_result = await _cdp_send(
+                ws,
+                msg_id_ref,
+                "Runtime.evaluate",
+                {"expression": "document.body.innerText", "returnByValue": True},
+            )
+            page_text = text_result.get("result", {}).get("value", "")
+            if page_text:
+                with open(tile_dir / "text.md", "w") as f:
+                    f.write(f"# {url}\n\n{page_text}\n")
+        except Exception:
+            # Best-effort: the tiles are the primary output and are already
+            # written, so a failed text probe must not fail the capture.
+            logger.warning("%s: page text extraction failed", url, exc_info=True)
+
     return len(tiles)
 
 
@@ -571,6 +590,7 @@ async def _drain_queue(
     image_format: str,
     from_surface: bool,
     wait_network_idle: bool,
+    extract_text: bool,
     worker_id: int,
     stats: dict,
     results: list,
@@ -603,6 +623,7 @@ async def _drain_queue(
                 image_format=image_format,
                 from_surface=from_surface,
                 wait_network_idle=wait_network_idle,
+                extract_text=extract_text,
             )
             stats["done"] += 1
             elapsed = time.monotonic() - t0
@@ -624,6 +645,7 @@ async def _worker(
     image_format: str,
     from_surface: bool,
     wait_network_idle: bool,
+    extract_text: bool,
     worker_id: int,
     stats: dict,
     results: list,
@@ -667,6 +689,7 @@ async def _worker(
             image_format,
             from_surface,
             wait_network_idle,
+            extract_text,
             worker_id,
             stats,
             results,
@@ -719,6 +742,7 @@ async def _run_batch(
     image_format: str,
     from_surface: bool,
     wait_network_idle: bool,
+    extract_text: bool,
     stems: list[str] | None,
     chrome_path: str,
 ) -> list[Path]:
@@ -744,6 +768,7 @@ async def _run_batch(
             image_format,
             from_surface,
             wait_network_idle,
+            extract_text,
             wid,
             stats,
             results,
@@ -768,6 +793,7 @@ async def _attached_worker(
     image_format: str,
     from_surface: bool,
     wait_network_idle: bool,
+    extract_text: bool,
     worker_id: int,
     stats: dict,
     results: list,
@@ -805,6 +831,7 @@ async def _attached_worker(
             image_format,
             from_surface,
             wait_network_idle,
+            extract_text,
             worker_id,
             stats,
             results,
@@ -832,6 +859,7 @@ async def _run_batch_attached(
     image_format: str,
     from_surface: bool,
     wait_network_idle: bool,
+    extract_text: bool,
     stems: list[str] | None,
     cdp_url: str,
 ) -> list[Path]:
@@ -862,6 +890,7 @@ async def _run_batch_attached(
             image_format,
             from_surface,
             wait_network_idle,
+            extract_text,
             wid,
             stats,
             results,
@@ -888,6 +917,7 @@ def render_urls(
     image_format: str = "jpeg",
     from_surface: bool = True,
     wait_network_idle: bool = False,
+    extract_text: bool = False,
     turbo: bool | None = None,
     chrome_path: str | None = None,
     cdp_url: str | None = None,
@@ -949,6 +979,7 @@ def render_urls(
                 image_format,
                 from_surface,
                 wait_network_idle,
+                extract_text,
                 stems,
                 cdp_url,
             )
@@ -964,8 +995,16 @@ def render_urls(
         image_format != "jpeg"
         or viewport_width != VIEWPORT_W
         or wait_network_idle
+        or extract_text
         or not from_surface
     ):
+        if extract_text:
+            # Same trade as wait_network_idle below: say so rather than
+            # letting --extract-text silently produce no text.md.
+            logger.info(
+                "extract_text is set: using the standard capture path "
+                "(the turbo path does not implement text extraction yet)"
+            )
         if wait_network_idle:
             # Be loud about the trade: users with a turbo-capable Chrome would
             # otherwise silently lose ~half their capture throughput.
@@ -1016,6 +1055,7 @@ def _navtarget(u: str) -> str:
             image_format,
             from_surface,
             wait_network_idle,
+            extract_text,
             stems,
             chrome,
         )
```

**File**: `render/src/pixelrag_render/render.py` (modified, +8/-0)
```diff
@@ -306,6 +306,13 @@ def main() -> None:
         "session (cookies/logins) — so authenticated pages work — then closes only "
         "that tab. Needs no local Chrome binary. Env: PIXELSHOT_CDP_URL.",
     )
+    parser.add_argument(
+        "--extract-text",
+        action="store_true",
+        help="Extract page text alongside tiles (hybrid output). Saves a text.md "
+        "file in each tile directory with the page's innerText. Useful for "
+        "reducing LLM token usage on text-heavy pages.",
+    )
 
     args = parser.parse_args()
     output_dir = Path(args.output)
@@ -345,6 +352,7 @@ def main() -> None:
             viewport_width=args.viewport_width,
             workers=args.workers,
             wait_network_idle=args.wait_network_idle,
+            extract_text=args.extract_text,
             cdp_url=args.cdp_url,
         )
         results.extend(tile_dirs)
```

**File**: `tests/test_extract_text.py` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+"""Tests for --extract-text hybrid output (issue #93)."""
+
+from pathlib import Path
+
+from pixelrag_render import render_file
+
+
+def test_extract_text_produces_text_md(tmp_path):
+    """With extract_text=True, a text.md file should be created alongside tiles."""
+    html = tmp_path / "page.html"
+    html.write_text(
+        "<html><body>"
+        "<h1>Hello World</h1>"
+        "<p>This is a test paragraph with important content.</p>"
+        "<ul><li>Item one</li><li>Item two</li></ul>"
+        "</body></html>"
+    )
+    out = tmp_path / "tiles"
+
+    dirs = render_file(html, out, extract_text=True)
+
+    assert dirs, "render_file returned no tile directories"
+    tile_dir = Path(dirs[0])
+    text_file = tile_dir / "text.md"
+    assert text_file.exists(), f"text.md not created in {tile_dir}"
+
+    content = text_file.read_text()
+    assert "Hello World" in content
+    assert "test paragraph" in content
+    assert "Item one" in content
+
+
+def test_no_extract_text_by_default(tmp_path):
+    """Without extract_text, no text.md should be created."""
+    html = tmp_path / "page.html"
+    html.write_text("<html><body><p>Some text</p></body></html>")
+    out = tmp_path / "tiles"
+
+    dirs = render_file(html, out)
+
+    tile_dir = Path(dirs[0])
+    assert not (tile_dir / "text.md").exists()
+
+
+def test_extract_text_wins_over_the_turbo_path(tmp_path):
+    """A turbo-capable Chrome must not silently swallow --extract-text.
+
+    The turbo backend (fast_cdp) has no text extraction, so requesting it has
+    to send the capture down the standard path — the same trade already made
+    for wait_network_idle. Without that, anyone whose Chrome is turbo-capable
+    (which is what `pixelshot install-chrome` produces) gets tiles and no
+    text.md, with nothing said about it.
+    """
+    html = tmp_path / "page.html"
+    html.write_text("<html><body><p>Turbo should not eat this</p></body></html>")
+
+    dirs = render_file(html, tmp_path / "tiles", extract_text=True, turbo=True)
+
+    text_file = Path(dirs[0]) / "text.md"
+    assert text_file.exists(), "turbo path silently dropped the text extraction"
+    assert "Turbo should not eat this" in text_file.read_text()
```

---

### Incident Patch 9: `bba0e362` (2026-08-29)
**Commit Message**: fix: correct torch_dtype kwarg, help text default, and CLI backend choices (#123)

* fix: correct torch_dtype kwarg, help text default, and CLI backend choices

* review: keep dtype=dtype, finish the playwright removal

transformers is pinned at 4.57.1, where `torch_dtype` is the deprecated
spelling (modeling_utils warns "`torch_dtype` is deprecated! Use `dtype`
instead!"). serve/api.py's existing `dtype=dtype` is the current form, so
that hunk is reverted.

The --backend change was right — render_url() only dispatches "cdp" and
raises on anything else — but three docstrings and a CLI example still
advertised playwright. Removed those too.

---------

Co-authored-by: yichuan520030910320 <[REDACTED_EMAIL]>

**File**: `index/src/pixelrag_index/monitor.py` (modified, +1/-1)
```diff
@@ -737,7 +737,7 @@ def main():
         "--validate-max-fail-pct",
         type=float,
         default=5.0,
-        help="Exit(1) if Gemini fail percentage exceeds this (default: 10.0)",
+        help="Exit(1) if Gemini fail percentage exceeds this (default: 5.0)",
     )
     parser.add_argument(
         "--validate-interval",
```

**File**: `render/src/pixelrag_render/render.py` (modified, +4/-5)
```diff
@@ -33,8 +33,7 @@ def render_url(
     Args:
         url: URL to capture (http:// or https:// or file://).
         output_dir: Directory to write tile subdirectories into.
-        backend: Rendering backend: ``"cdp"`` (default, fastest) or
-                 ``"playwright"`` (full-featured).
+        backend: Rendering backend. Only ``"cdp"`` is implemented.
         tile_height: Maximum tile height in pixels (default 8192).
         quality: JPEG quality 1-100 (default 85).
         viewport_width: Browser viewport width in pixels (default 875).
@@ -73,7 +72,7 @@ def render_urls(
     Args:
         urls: URLs to capture.
         output_dir: Directory to write tile subdirectories into.
-        backend: ``"cdp"`` (default) or ``"playwright"``.
+        backend: Rendering backend. Only ``"cdp"`` is implemented.
         stems: Optional list of output directory stems (one per URL).
                If provided, tiles are written to ``{output_dir}/{stem}.png.tiles/``
                instead of deriving names from URLs. Useful for assigning
@@ -205,7 +204,7 @@ def main() -> None:
         pixelshot report.pdf --output ./tiles
 
         # Local HTML
-        pixelshot index.html --output ./tiles --backend playwright
+        pixelshot index.html --output ./tiles
 
         # URL file
         pixelshot urls.txt --output ./tiles
@@ -252,7 +251,7 @@ def main() -> None:
     )
     parser.add_argument(
         "--backend",
-        choices=["cdp", "playwright"],
+        choices=["cdp"],
         default="cdp",
         help="Browser backend for URL/HTML rendering (default: cdp).",
     )
```

---

### Incident Patch 10: `3688a5ea` (2026-08-29)
**Commit Message**: fix(serve): bound n_docs to prevent unbounded-search OOM/DoS (#122)

n_docs had no limit and fetch_k = n_docs * 10 feeds FAISS's search k, so a request with a huge n_docs triggers a massive allocation on the public endpoint. Constrain to 1..1000 via pydantic Field (largest real caller uses 10).

Co-authored-by: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `serve/src/pixelrag_serve/api.py` (modified, +4/-2)
```diff
@@ -52,7 +52,7 @@
 from fastapi.middleware.cors import CORSMiddleware
 from fastapi.responses import FileResponse, Response
 from PIL import Image
-from pydantic import BaseModel
+from pydantic import BaseModel, Field
 
 _request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
     "request_id",
@@ -172,7 +172,9 @@ class Query(BaseModel):
 
 class SearchRequest(BaseModel):
     queries: list[Query]
-    n_docs: int = 10
+    # Bounded: fetch_k = n_docs * 10 feeds FAISS search k, so an unbounded value
+    # is a trivial OOM/DoS on the public endpoint. Largest real caller uses 10.
+    n_docs: int = Field(default=10, ge=1, le=1000)
     nprobe: int | None = None  # override default nprobe
     min_tile_height: int | None = None  # filter out small/blank chunks
     instruction: str | None = None  # override query embedding instruction
```

---

### Incident Patch 11: `7b47d34d` (2026-08-29)
**Commit Message**: fix(index): accept a single file as a source path (#130)

`LocalSource` walked the path with `rglob("*")` and `PDFSource` with
`glob("**/*.pdf")`. Both return nothing when the path points at a file
rather than a directory, so a single-document source silently yielded
zero documents and the run failed four stages later in `build-index`
with "No shard files found!".

This is the form the README documents:

    source:
      type: local
      path: ./paper.pdf

Branch on `is_file()` in both adapters so a path pointing straight at a
document is a single-item source. Directory traversal is unchanged, and
the single-file path keeps the same extension filtering as the directory
one.

Also note the `pdf` extra and poppler in the PDF quickstart — the
documented `pixelrag[index]` alone cannot render a PDF.

Verified on macOS (Apple Silicon, MPS): `pixelrag index build` against
assets/pixelrag-paper.pdf now builds a 35-vector index from either a file
or a directory path; before, the file form produced zero documents.

**File**: `README.md` (modified, +4/-1)
```diff
@@ -174,8 +174,11 @@ pixelrag serve --index-dir ./my_index --port 30001
 
 No GPU required — runs on macOS (Apple Silicon) or any machine with Python 3.10+.
 
+PDF rendering needs the `pdf` extra and poppler (`brew install poppler`, or
+`apt-get install poppler-utils` on Debian/Ubuntu).
+
 ```bash
-pip install 'pixelrag[index]'
+pip install 'pixelrag[index,pdf]'
 
 # 1. Grab a sample PDF (or use your own)
 curl -L -o paper.pdf https://raw.githubusercontent.com/StarTrail-org/PixelRAG/main/assets/pixelrag-paper.pdf
```

**File**: `index/src/pixelrag_index/sources/local.py` (modified, +7/-4)
```diff
@@ -1,4 +1,4 @@
-"""Local directory source — auto-detect file types."""
+"""Local source — a single file or a directory tree; auto-detect file types."""
 
 from pathlib import Path
 from typing import Iterator
@@ -20,10 +20,13 @@
 class LocalSource(Source):
     def __init__(self, path: str, **kwargs):
         self.path = Path(path)
+        # A path pointing straight at a document is a single-item source; rglob
+        # on a file yields nothing, so branch before walking.
+        candidates = (
+            [self.path] if self.path.is_file() else sorted(self.path.rglob("*"))
+        )
         self._files = [
-            f
-            for f in sorted(self.path.rglob("*"))
-            if f.is_file() and f.suffix.lower() in EXTENSIONS
+            f for f in candidates if f.is_file() and f.suffix.lower() in EXTENSIONS
         ]
 
     def __iter__(self) -> Iterator[Document]:
```

**File**: `index/src/pixelrag_index/sources/pdf.py` (modified, +8/-2)
```diff
@@ -1,4 +1,4 @@
-"""PDF directory source."""
+"""PDF source — a single .pdf file or a directory tree of them."""
 
 from pathlib import Path
 from typing import Iterator
@@ -9,7 +9,13 @@
 class PDFSource(Source):
     def __init__(self, path: str, **kwargs):
         self.path = Path(path)
-        self._files = sorted(self.path.glob("**/*.pdf"))
+        # A path pointing straight at a .pdf is a single-item source; the glob
+        # below only ever matches inside a directory.
+        self._files = (
+            [self.path]
+            if self.path.is_file() and self.path.suffix.lower() == ".pdf"
+            else sorted(self.path.glob("**/*.pdf"))
+        )
 
     def __iter__(self) -> Iterator[Document]:
         for pdf in self._files:
```

**File**: `tests/test_source_single_file.py` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+"""A source path may point straight at a document, not just a directory.
+
+`pixelrag index build --source ./paper.pdf` is the form the README documents,
+but both adapters used to walk the path as a directory — which silently
+yielded zero documents and failed several stages later at index build.
+"""
+
+import sys
+from pathlib import Path
+
+import pytest
+
+sys.path.insert(0, str(Path(__file__).parents[1] / "index" / "src"))
+from pixelrag_index.sources.local import LocalSource
+from pixelrag_index.sources.pdf import PDFSource
+
+
+@pytest.fixture
+def docs_dir(tmp_path):
+    (tmp_path / "paper.pdf").write_bytes(b"%PDF-1.4\n")
+    (tmp_path / "notes.md").write_text("# Notes")
+    (tmp_path / "ignored.csv").write_text("a,b,c")
+    nested = tmp_path / "sub"
+    nested.mkdir()
+    (nested / "deep.pdf").write_bytes(b"%PDF-1.4\n")
+    return tmp_path
+
+
+def test_pdf_source_accepts_a_single_file(docs_dir):
+    source = PDFSource(str(docs_dir / "paper.pdf"))
+    assert [d.id for d in source] == ["paper"]
+    assert len(source) == 1
+
+
+def test_local_source_accepts_a_single_file(docs_dir):
+    source = LocalSource(str(docs_dir / "notes.md"))
+    docs = list(source)
+    assert [d.id for d in docs] == ["notes"]
+    assert docs[0].metadata["type"] == "text"
+
+
+def test_local_source_single_file_still_filters_by_extension(docs_dir):
+    """An unsupported suffix yields nothing, matching directory behaviour."""
+    assert len(LocalSource(str(docs_dir / "ignored.csv"))) == 0
+
+
+def test_directory_traversal_is_unchanged(docs_dir):
+    """The directory path must keep recursing into sub-directories."""
+    assert {d.id for d in PDFSource(str(docs_dir))} == {"paper", "deep"}
+    assert {d.id for d in LocalSource(str(docs_dir))} == {"paper", "notes", "deep"}
```

---

### Incident Patch 12: `c4b11254` (2026-08-29)
**Commit Message**: fix(render): make the manifest's `complete` flag mean something (#141)

`complete` was written as a literal `True` on every capture, so nothing in
tiles.json could ever distinguish a full page from one viewport of it. The
signal that would have revealed the difference — a measured page height equal
to the emulated viewport (i.e. the tile height) — was neither warned about at
render time nor recorded in a form a later consumer could check, since the
tile height itself never made it into URL manifests.

This is independent of any particular truncation bug: the same silence held
for the height formula #131 fixed and will hold for whatever causes the next
one.

- `page_metrics.truncation_reason()` states the rule once, next to the shared
  measurement JS, so the standard and turbo backends agree on what a manifest
  means whichever Chrome the capture ran on.
- Both backends log a warning and write `complete: false` when the probe fell
  back or the height came back at exactly one viewport. The tiles are still
  captured and written — only the claim about them changes.
- URL manifests now record `tile_height` and `viewport_width`, so a consumer
  can redo the comparison instead of being

**File**: `plugin/commands/screenshot.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ allowed-tools: "Bash, Read"
 ---
 
 1. Run: `pixelshot $ARGUMENTS --output /tmp/pixelbrowse --tile-height 1568`
-2. The output tile is at `/tmp/pixelbrowse/<domain>.png.tiles/tile_0000.jpg` — read it directly with the Read tool. Do not ls.
+2. Read `/tmp/pixelbrowse/<domain>.png.tiles/tiles.json`, then read every tile it lists with the Read tool (they are `tile_NNNN.jpg` in that same directory, top of the page first). If the manifest says `"complete": false`, the page was only partly captured — report that alongside what you saw.
 3. If text is too small to read, crop with Pillow (always available — it's a pixelshot dependency):
    `python3 -c "from PIL import Image; Image.open('<tile>').crop((x1,y1,x2,y2)).save('/tmp/pixelbrowse/crop.png')"`
 4. Report what you see.
```

**File**: `plugin/skills/pixelbrowse/SKILL.md` (modified, +18/-3)
```diff
@@ -36,6 +36,8 @@ pixelshot document.pdf --output /tmp/pixelbrowse
 IMPORTANT: Always use `--tile-height 1568` for screenshots you will read visually.
 Claude's vision model downscales images with long edge > 1568px (Sonnet/Haiku) or 2576px (Opus).
 The default 8192px tile height will be downscaled and text becomes unreadable.
+Note that the tile height is also the emulated viewport height, so at 1568 an ordinary article
+is a dozen-plus tiles rather than one or two — the manifest tells you how many (see Workflow).
 
 IMPORTANT: Always use `--wait-network-idle` for URLs. Without it, JavaScript-heavy
 pages (most modern sites / single-page apps) are captured before they finish rendering
@@ -47,14 +49,27 @@ After rendering, read the tile images from the output directory to visually unde
 ## Workflow
 
 1. Run `pixelshot <url> --output /tmp/pixelbrowse --tile-height 1568 --wait-network-idle`
-2. Read `/tmp/pixelbrowse/<domain>.png.tiles/tile_0000.jpg` directly (no need to ls — the naming is deterministic)
-3. If the page is long, also read tile_0001.jpg, tile_0002.jpg, etc.
+2. Read `/tmp/pixelbrowse/<domain>.png.tiles/tiles.json` — the manifest of what was captured
+3. Read every tile it lists, in order, not just `tile_0000.jpg`
 
 Output path pattern: `/tmp/pixelbrowse/<sanitized-url>.png.tiles/tile_NNNN.jpg`
 - For `https://news.ycombinator.com` → `/tmp/pixelbrowse/news.ycombinator.com.png.tiles/tile_0000.jpg`
 - For `https://example.com/page` → `/tmp/pixelbrowse/example.com_page.png.tiles/tile_0000.jpg`
 
-Do NOT run `ls` — just read tile_0000.jpg. If it doesn't exist, the page had no content.
+Read `tiles.json` rather than `ls` (or guessing at tile numbers) — it is one file read and it
+answers both questions the tile files can't:
+
+```json
+{"url": "...", "page_height": 29184, "tile_height": 1568, "tiles": ["tile_0000.jpg", "..."], "complete": true}
+```
+
+- **`tiles`** — the full list. A long page is many tiles; reading only `tile_0000.jpg` on a
+  30,000px article means reading 5% of it. Read them all before summarising.
+- **`complete: false`** — the capture is not trustworthy: pixelshot could not measure the page,
+  so what you have is roughly one viewport of an unknown-length page. Say so in your answer
+  rather than presenting it as the whole page. Re-running with `--wait-network-idle` (if it was
+  omitted) or a different `--viewport-width` often fixes it.
+- **No `tiles.json` at all** — the render failed. That is an error to report, not an empty page.
 
 ## Crop & Zoom
 
```

**File**: `render/src/pixelrag_render/backends/cdp.py` (modified, +22/-4)
```diff
@@ -35,7 +35,7 @@
 
 from PIL import Image
 
-from .page_metrics import CONTENT_BOTTOM_JS
+from .page_metrics import CONTENT_BOTTOM_JS, truncation_reason
 
 logger = logging.getLogger("pixelrag_render.backends.cdp")
 
@@ -444,8 +444,13 @@ async def capture_url(
         },
     )
     try:
-        page_height = result["result"]["value"]
-    except (KeyError, TypeError):
+        page_height = int(result["result"]["value"])
+    except (KeyError, TypeError, ValueError):
+        page_height = 0
+    # A zero/negative height is as much a probe failure as a missing one, and
+    # would otherwise tile nothing at all while still claiming success.
+    height_measured = page_height > 0
+    if not height_measured:
         page_height = tile_h
 
     tiles = []
@@ -507,11 +512,24 @@ async def capture_url(
         idx += 1
         y += tile_h
 
+    reason = truncation_reason(page_height, tile_h, measured=height_measured)
+    if reason:
+        logger.warning(
+            "%s: %s — capturing what is on screen and marking the manifest incomplete",
+            url,
+            reason,
+        )
+
     manifest = {
         "url": url,
         "page_height": page_height,
+        # The geometry the capture ran at. Recorded so a consumer reading
+        # tiles.json later can redo the page_height/tile_height comparison
+        # itself instead of being told the tile height out of band.
+        "tile_height": tile_h,
+        "viewport_width": viewport_w,
         "tiles": tiles,
-        "complete": True,
+        "complete": reason is None,
     }
     with open(tile_dir / "tiles.json", "w") as f:
         json.dump(manifest, f)
```

**File**: `render/src/pixelrag_render/backends/fast_cdp.py` (modified, +22/-4)
```diff
@@ -34,7 +34,7 @@
 import urllib.request
 from pathlib import Path
 
-from .page_metrics import CONTENT_BOTTOM_JS
+from .page_metrics import CONTENT_BOTTOM_JS, truncation_reason
 
 logger = logging.getLogger("pixelrag_render.backends.fast_cdp")
 
@@ -492,9 +492,11 @@ async def worker_task(wi: int):
                         },
                     )
                     page_h = r["result"]["result"]["value"]
-                    if not page_h or page_h <= 0:
+                    height_measured = bool(page_h) and page_h > 0
+                    if not height_measured:
                         page_h = tile_height
                 except Exception:
+                    height_measured = False
                     page_h = tile_height
 
                 n_tiles = max(1, (page_h + tile_height - 1) // tile_height)
@@ -586,13 +588,29 @@ async def worker_task(wi: int):
                     n_written += 1
                     tile_names.append(f"tile_{t:04d}.jpg")
 
-                # Write manifest
+                # Write manifest. `complete` has to mean something here too —
+                # see page_metrics.truncation_reason; the standard path applies
+                # the identical rule, so a manifest reads the same whichever
+                # Chrome the capture happened to run on.
+                reason = truncation_reason(
+                    page_h, tile_height, measured=height_measured
+                )
+                if reason:
+                    logger.warning(
+                        "[w%d] %s: %s — marking the manifest incomplete",
+                        wi,
+                        art_path,
+                        reason,
+                    )
+
                 manifest = {
                     "path": art_path,
                     "url": target_url,
                     "page_height": page_h,
+                    "tile_height": tile_height,
+                    "viewport_width": VIEWPORT_WIDTH,
                     "tiles": tile_names,
-                    "complete": True,
+                    "complete": reason is None,
                 }
                 with open(tile_dir / "tiles.json", "w") as f:
                     json.dump(manifest, f)
```

**File**: `render/src/pixelrag_render/backends/page_metrics.py` (modified, +40/-4)
```diff
@@ -1,12 +1,14 @@
-"""Shared in-page measurement JS for the capture backends.
+"""Shared page measurement for the capture backends: the in-page JS, and the
+judgement about whether what it measured can be trusted.
 
 Kept in one place because both backends measure page height the same way and
 must agree: the standard (``cdp``) and turbo (``fast_cdp``) paths each embed
 this snippet, and a divergence between them silently changes how much of a page
-gets captured depending on which Chrome binary is installed.
+gets captured depending on which Chrome binary is installed. The same goes for
+what they then report in ``tiles.json``.
 
-No imports — a plain string constant, so either backend can use it without a
-dependency edge between them.
+No imports — a plain string constant and a pure function, so either backend can
+use them without a dependency edge between them.
 """
 
 # How tall is the document's *content*?
@@ -42,3 +44,37 @@
         return Math.ceil(bottom + offset);
     }
 """
+
+
+def truncation_reason(
+    page_height: int, tile_height: int, *, measured: bool
+) -> str | None:
+    """Why this capture must not be reported as complete — or ``None`` if it may.
+
+    ``tile_height`` is also the emulated viewport height (both backends pass it
+    to ``Emulation.setDeviceMetricsOverride``), which is what makes the two
+    checks below meaningful:
+
+    - The probe returned nothing usable, so the height fell back to the tile
+      height. Whatever the page actually was, one viewport of it was captured.
+    - The probe returned exactly the viewport height. Then it measured the
+      viewport rather than the content, and everything below the fold is
+      missing — the shape every truncation so far has taken (issues #124, #131,
+      #133), independent of which of them caused it.
+
+    The second check costs a false alarm on a page that happens to be exactly
+    ``tile_height`` tall. That is the right trade against the alternative,
+    which is reporting 5% of an article as the whole of it: a capture wrongly
+    flagged is re-run, a truncation never flagged is read and summarised.
+    """
+    if not measured:
+        return (
+            f"the page-height probe returned nothing, so the height fell back "
+            f"to the {tile_height}px tile height"
+        )
+    if page_height == tile_height:
+        return (
+            f"the measured page height ({page_height}px) is exactly the tile "
+            f"height, so the probe tracked the emulated viewport, not the content"
+        )
+    return None
```

**File**: `tests/test_render.py` (modified, +60/-0)
```diff
@@ -17,6 +17,7 @@
 
 import pytest
 from pixelrag_render import render_file
+from pixelrag_render.backends.page_metrics import truncation_reason
 
 
 def test_render_local_html_to_tiles(tmp_path):
@@ -156,3 +157,62 @@ def log_message(self, _format, *_args):
     manifest = json.loads(manifests[0].read_text())
     assert manifest["page_height"] > 300
     assert len(manifest["tiles"]) > 1
+
+
+def test_manifest_records_the_geometry_the_capture_ran_at(tmp_path):
+    """A consumer of tiles.json must be able to check the capture itself.
+
+    ``page_height`` alone says nothing: it is only suspicious relative to the
+    tile height, which used to be absent from URL manifests entirely, leaving a
+    downstream reader guessing which ``--tile-height`` the capture used.
+    """
+    body = "".join(f"<p>line {i:03d}</p>" for i in range(400))
+    html = tmp_path / "long.html"
+    html.write_text(f"<!DOCTYPE html><html><body>{body}</body></html>")
+
+    dirs = render_file(html, tmp_path / "tiles", tile_height=1000, viewport_width=1280)
+    manifest = json.loads((Path(dirs[0]) / "tiles.json").read_text())
+
+    assert manifest["tile_height"] == 1000
+    assert manifest["viewport_width"] == 1280
+    assert manifest["complete"] is True, (
+        "a page measured well past its viewport is a healthy capture and must "
+        f"not be flagged: {manifest}"
+    )
+
+
+def test_capture_stuck_at_the_viewport_height_is_reported_incomplete(tmp_path):
+    """The one page height that cannot be trusted must not claim completeness.
+
+    A measured height exactly equal to the tile height (= the emulated viewport)
+    is the signature of every truncation so far: the probe tracked the viewport
+    instead of the content. The capture still runs — the tile written is real —
+    but the manifest has to say the page may not be all there, because nothing
+    else downstream can tell.
+    """
+    html = tmp_path / "one_viewport.html"
+    html.write_text(
+        '<!DOCTYPE html><html><body style="margin:0">'
+        '<div style="height:1000px">content</div></body></html>'
+    )
+
+    dirs = render_file(html, tmp_path / "tiles", tile_height=1000, viewport_width=1280)
+    tile_dir = Path(dirs[0])
+    manifest = json.loads((tile_dir / "tiles.json").read_text())
+
+    assert manifest["page_height"] == manifest["tile_height"] == 1000, (
+        f"test setup no longer produces a viewport-height page: {manifest}"
+    )
+    assert manifest["complete"] is False
+    assert sorted(tile_dir.glob("tile_*.jpg")), "the tile itself is still written"
+
+
+def test_truncation_reason_rules():
+    # Healthy: measured, and not pinned to the viewport.
+    assert truncation_reason(29184, 1568, measured=True) is None
+
+    # Probe failed — the height is the tile height by fallback, not by measurement.
+    assert "fell back" in truncation_reason(1568, 1568, measured=False)
+
+    # Measured, but exactly one viewport: the truncation signature.
+    assert "exactly the tile height" in truncation_reason(1568, 1568, measured=True)
```

---

### Incident Patch 13: `ef1bb43b` (2026-08-29)
**Commit Message**: fix(render): bound web-font readiness wait (#144)

**File**: `render/src/pixelrag_render/backends/cdp.py` (modified, +7/-1)
```diff
@@ -185,6 +185,9 @@ async def _cdp_send(ws, msg_id_ref: list, method: str, params: dict | None = Non
 # before giving up and capturing whatever is there. Keeps a hanging page from
 # stalling a worker.
 LOAD_TIMEOUT_MS = 12_000
+# Web-font loads are allowed a short grace period, but must not stall a render:
+# a server can leave a font response open indefinitely.
+FONT_TIMEOUT_MS = 2_000
 # The network is considered idle once at most NET_IDLE_MAX_INFLIGHT requests
 # have been in flight for NET_QUIET_MS (Puppeteer's "networkidle2" semantics).
 # Tolerating 2 in-flight requests is what makes this usable on arbitrary web
@@ -352,7 +355,10 @@ def _readiness_expr() -> str:
             const t = setTimeout(res, {LOAD_TIMEOUT_MS});
             window.addEventListener('load', () => {{ clearTimeout(t); res(); }}, {{ once: true }});
         }});
-        await document.fonts.ready;
+        await Promise.race([
+            document.fonts.ready,
+            new Promise(r => setTimeout(r, {FONT_TIMEOUT_MS})),
+        ]);
         // Let layout settle over two frames — but cap it: requestAnimationFrame
         // never ticks in some headless modes (e.g. google-chrome --headless=new
         // with no compositor frames scheduled), where awaiting rAF would hang.
```

**File**: `tests/test_render.py` (modified, +93/-0)
```diff
@@ -7,8 +7,15 @@
 """
 
 import json
+import os
+import signal
+import subprocess
+import sys
+import threading
+from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
 from pathlib import Path
 
+import pytest
 from pixelrag_render import render_file
 
 
@@ -63,3 +70,89 @@ def test_page_taller_than_a_viewport_bounded_body_is_fully_tiled(tmp_path):
         "content below the fold was never measured"
     )
     assert len(tiles) > 1, f"expected multiple tiles, got {[t.name for t in tiles]}"
+
+
+def test_hanging_web_font_does_not_stall_render(tmp_path):
+    """A font request that never finishes must not block the CDP renderer."""
+    release_font = threading.Event()
+
+    class Handler(BaseHTTPRequestHandler):
+        def do_GET(self):
+            if self.path == "/hanging.woff2":
+                self.send_response(200)
+                self.send_header("Content-Type", "font/woff2")
+                self.send_header("Content-Length", "1000000")
+                self.end_headers()
+                self.wfile.write(b"\0")
+                self.wfile.flush()
+                release_font.wait(timeout=60)
+                return
+
+            body = "".join(f"<p>line {i:03d}</p>" for i in range(200))
+            html = f"""<!doctype html>
+                <html><head><script>
+                window.addEventListener("load", () => {{
+                    const style = document.createElement("style");
+                    style.textContent = `@font-face {{
+                        font-family: HangingFont;
+                        src: url('/hanging.woff2') format('woff2');
+                    }} body {{ font-family: HangingFont; }}`;
+                    document.head.appendChild(style);
+                    document.fonts.load("16px HangingFont");
+                }});
+                </script></head><body>{body}</body></html>"""
+            payload = html.encode()
+            self.send_response(200)
+            self.send_header("Content-Type", "text/html; charset=utf-8")
+            self.send_header("Content-Length", str(len(payload)))
+            self.end_headers()
+            self.wfile.write(payload)
+
+        def log_message(self, _format, *_args):
+            pass
+
+    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+
+    output = tmp_path / "tiles"
+    url = f"http://127.0.0.1:{server.server_port}/"
+    script = (
+        "from pixelrag_render import render_url; import sys; "
+        "render_url(sys.argv[1], sys.argv[2], tile_height=300, "
+        "viewport_width=400, workers=1, turbo=False)"
+    )
+    proc = subprocess.Popen(
+        [sys.executable, "-c", script, url, str(output)],
+        stdout=subprocess.PIPE,
+        stderr=subprocess.PIPE,
+        text=True,
+        start_new_session=True,
+    )
+
+    try:
+        try:
+            stdout, stderr = proc.communicate(timeout=30)
+        except subprocess.TimeoutExpired:
+            os.killpg(proc.pid, signal.SIGTERM)
+            try:
+                stdout, stderr = proc.communicate(timeout=5)
+            except subprocess.TimeoutExpired:
+                os.killpg(proc.pid, signal.SIGKILL)
+                stdout, stderr = proc.communicate()
+            pytest.fail(
+                "render remained blocked by document.fonts.ready for 30 seconds\n"
+                f"stdout:\n{stdout[-2000:]}\nstderr:\n{stderr[-2000:]}"
+            )
+    finally:
+        release_font.set()
+        server.shutdown()
+        server.server_close()
+        thread.join(timeout=5)
+
+    assert proc.returncode == 0, f"stdout:\n{stdout}\nstderr:\n{stderr}"
+    manifests = list(output.rglob("tiles.json"))
+    assert len(manifests) == 1
+    manifest = json.loads(manifests[0].read_text())
+    assert manifest["page_height"] > 300
+    assert len(manifest["tiles"]) > 1
```

---

### Incident Patch 14: `227c96a1` (2026-08-29)
**Commit Message**: fix(serve): accept --device mps for Apple Silicon (#134)

The index build CLI already accepts mps (#73, #109), but the serve CLI
was left with choices=["cpu", "cuda"], so pixelrag serve --device mps
fails at argument parsing. The downstream dtype logic already handles
non-cpu devices (bfloat16), so widening the choices list is sufficient.

Verified on an M3 MacBook Air (8 GB): the model loads in bfloat16 on MPS
and search latency is 0.2-1.2 s per query after warmup.

**File**: `serve/src/pixelrag_serve/api.py` (modified, +2/-2)
```diff
@@ -849,9 +849,9 @@ def main():
     parser.add_argument("--model", default="Qwen/Qwen3-VL-Embedding-2B")
     parser.add_argument(
         "--device",
-        choices=["cpu", "cuda"],
+        choices=["cpu", "cuda", "mps"],
         default="cpu",
-        help="Device to run inference on: cpu (default) or cuda",
+        help="Device to run inference on: cpu (default), cuda, or mps",
     )
     parser.add_argument(
         "--peft-adapter",
```

---

### Incident Patch 15: `22cc8470` (2026-08-29)
**Commit Message**: fix(deploy): api-switch moves this host, not necessarily public traffic (#151)

The script claimed in three places to switch api.pixelrag.ai, which stopped being true once public ingress moved in front of the host. Running it alone moves the host nginx upstream and the agent, prints SWITCHED, and leaves public traffic on the old slot with a passing local health check. Delegate the ingress half to PIXELRAG_INGRESS_SWITCH_HOOK (called with the chosen port, non-zero exit fails the switch); with no hook, say plainly that public ingress was not touched.

**File**: `deploy/README.md` (modified, +11/-0)
```diff
@@ -36,6 +36,17 @@ index or model with zero downtime:
    with a graceful reload (no dropped connections), and repoints + restarts the agent.
 3. **Rollback** = `deploy/api-switch.sh <other-port>`.
 
+`api-switch.sh` moves **this host** — its nginx upstream and the agent. If public
+traffic reaches the host through something in front of it (a relay, reverse proxy
+or tunnel endpoint), that layer picks the slot for public requests and the script
+does not touch it: the switch then completes locally, reports success, and public
+traffic keeps hitting the old slot. Point `PIXELRAG_INGRESS_SWITCH_HOOK` at a
+script that moves that layer too — it receives the chosen port and must exit 0,
+and a non-zero exit fails the switch rather than leaving the two halves disagreeing.
+
+Whichever way you switch, verify the **public** endpoint afterwards. A local
+health check passes in exactly the case this warning is about.
+
 This is preferred over restarting a slot in place, which reloads the (large) FAISS index and would
 mean minutes of downtime.
 
```

**File**: `deploy/api-switch.sh` (modified, +28/-6)
```diff
@@ -1,9 +1,17 @@
 #!/usr/bin/env bash
-# Blue-green switch for the PixelRAG search API.
+# Blue-green switch for the PixelRAG search API, host side.
 #
-# Points BOTH api.pixelrag.ai (via nginx) and the agent backend (direct on
-# localhost) at the chosen slot, but only after the target passes a health
-# check and a smoke query. Rollback is just switching back to the other port.
+# Points this host's nginx upstream and the agent backend (direct on localhost)
+# at the chosen slot, after the target passes a health check and a smoke query.
+# Rollback is just switching back to the other port.
+#
+# SCOPE — read this before using it to resolve an outage. If public traffic
+# reaches this host through something in front of it (a relay, a reverse proxy,
+# a tunnel endpoint), then that layer selects the slot for public requests and
+# this script does not touch it. Running this alone then moves the host and the
+# agent while the public route stays where it was, which looks like a completed
+# switch and serves the old slot. Set PIXELRAG_INGRESS_SWITCH_HOOK to a script
+# that moves that layer too; it is called with the chosen port and must exit 0.
 #
 #   blue  = 30001  (base model,  pixelrag-api.service)
 #   green = 30002  (LoRA model,  pixelrag-api-green.service)
@@ -28,7 +36,7 @@ hits=$(curl -fsS -X POST "${base}/search" -H 'Content-Type: application/json' \
 [ "${hits:-0}" -ge 1 ] || { echo "ABORT: smoke query returned no hits"; exit 1; }
 echo "smoke ok (${hits} hits)"
 
-# 3. Flip nginx (api.pixelrag.ai) — graceful reload, zero dropped connections.
+# 3. Flip this host's nginx — graceful reload, zero dropped connections.
 echo "upstream pixelrag_api { server 127.0.0.1:${PORT}; }" | sudo tee "$UPSTREAM" >/dev/null
 sudo nginx -t && sudo nginx -s reload
 
@@ -38,4 +46,18 @@ printf '[Service]\nEnvironment=PIXELRAG_SEARCH_URL=http://localhost:%s\n' "$PORT
 sudo systemctl daemon-reload
 sudo systemctl restart pixelrag-agent.service
 
-echo "SWITCHED: api.pixelrag.ai + agent -> 127.0.0.1:${PORT}"
+# 5. Whatever fronts this host has its own idea of which slot is live, and it
+# is the one public traffic obeys. Moving it is deployment-specific, so it is
+# delegated rather than assumed absent.
+if [ -n "${PIXELRAG_INGRESS_SWITCH_HOOK:-}" ]; then
+  echo "running ingress hook: ${PIXELRAG_INGRESS_SWITCH_HOOK} ${PORT}"
+  "${PIXELRAG_INGRESS_SWITCH_HOOK}" "${PORT}" || {
+    echo "ABORT: ingress hook failed — the host moved but public traffic may still be on the old slot" >&2
+    exit 1
+  }
+  echo "SWITCHED: host nginx + agent + public ingress -> 127.0.0.1:${PORT}"
+else
+  echo "SWITCHED: host nginx + agent -> 127.0.0.1:${PORT}"
+  echo "NOTE: public ingress not touched. If anything fronts this host, move it too,"
+  echo "      then verify the public endpoint rather than the local one."
+fi
```

#### Recent Merged Pull Requests:
- **PR #165** (2026-10-01): eval: export the LoRA cells as a frozen-retrieval benchmark (@andylizf)
- **PR #164** (2026-10-01): fix(serve): cap on-demand renders per /search request (@dex0shubham)
- **PR #163** (2026-10-01): feat(eval): add optional Cheaper Inference reader (@aiapienthusiast)
- **PR #162** (2026-09-27): test(serve): repair department-filter tests left stale by the backend refactor (@dex0shubham)
- **PR #161** (2026-09-27): fix(serve): bound /reconstruct and stop unknown ids becoming 500s (@dex0shubham)
- **PR #160** (2026-09-27): fix: cross-platform compatibility, config deep merge, and pipeline ro… (@smartworldarafath)
- **PR #159** (2026-09-27): feat(eval): add optional Atlas Cloud reader (@binyangzhu000-sudo)
- **PR #158** (2026-09-14): docs: link community LangChain integration (@navneet-singh2907)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
