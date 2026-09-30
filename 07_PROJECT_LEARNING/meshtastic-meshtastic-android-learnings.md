# Forensic Learning Record (Deep Inspection): meshtastic/Meshtastic-Android

> **Canonical Artifact**: `07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/meshtastic/Meshtastic-Android](https://github.com/meshtastic/Meshtastic-Android))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:56:10.483Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meshtastic/Meshtastic-Android`
- **Description**: Android application for Meshtastic
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1857 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/run-meshtastic-android/driver.py`
```
#!/usr/bin/env python3
"""Drive the running Meshtastic desktop app through the compose-hot-reload MCP server.

Speaks MCP JSON-RPC over the stdio of `./gradlew :desktopApp:hotMcpServer` (the same
server android/.mcp.json registers), so it works with no MCP client attached at all.
The app itself must already be running — launch it with :desktopApp:hotRunAsync first
(see SKILL.md). Each invocation spawns the server, waits for it to attach to the app,
executes the given commands in order, and exits.

Usage:
  driver.py [--repo DIR] CMD [CMD ...]

Commands (executed left to right):
  tools                 list the server's tools and their input schemas
  status                print connection status
  wait                  poll status until "connected":true (120 s timeout)
  windows               list app windows
  tree                  print the semantic tree (all windows)
  tree=SUBSTR           print only tree lines whose text matches SUBSTR (case-insensitive)
  click=NODEID          click a node by id from the tree
  longclick=NODEID      long-click a node
  type=NODEID:TEXT      set the text content of an editable node
  scroll_to=NODEID:IDX  scroll item IDX of scrollable container NODEID into view
  ss=PATH.png           screenshot the app window to PATH (absolute path)
  reload                recompile + hot-swap current sources into the running app
  restart               relaunch the app process (needed for singleton/init state)
  reset_ui              reset the UI to its entry point
  raise                 bring the app window frontmost (required before ss —
                        the screenshot captures the on-screen region)
  err                   print the current UI error, if any
  logs                  print recent app logs
  sleep=SECONDS         pause between commands (animations, connection settling)

Example — poke the Connections screen and screenshot it:
  driver.py wait tree=Connections click=42 sleep=1 ss=/tmp/conn.png
"""

import base64
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time

NIX_POISON = ["DEVELOPER_DIR", "SDKROOT", "CC", "CXX", "LD", "AR", "NM", "RANLIB", "STRIP", "NIX_CC"]
JDK_GLOB = os.path.expanduser("~/.gradle/jdks/jetbrains_s_r_o_-25-*/*/Contents/Home")


def clean_env():
    """The Nix dev shell's Darwin stdenv breaks the MapLibre FFI and Skiko; strip it."""
    env = {k: v for k, v in os.environ.items() if k not in NIX_POISON}
    env["PATH"] = "/usr/bin:/bin:/usr/sbin:/sbin"
    import glob

    jdks = sorted(glob.glob(JDK_GLOB))
    if jdks:
        env["JAVA_HOME"] = jdks[-1]
    return env


class HotMcp:
    def __init__(self, repo):
        self.proc = subprocess.Popen(
            ["./gradlew", "--no-daemon", "--quiet", "--console=plain", ":desktopApp:hotMcpServer"],
            cwd=repo,
            env=clean_env(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        stdin, stdout = self.proc.stdin, self.proc.stdout
        assert stdin is not None and stdout is not None
        self.stdin, self.stdout = stdin, stdout
        # readline() would block past any deadline if the server keeps stdout open without
        # writing; a pump thread + queue makes the RPC timeout real.
        self._lines: "queue.Queue[str | None]" = queue.Queue()

        def _pump(out, q):
            for line in out:
                q.put(line)
            q.put(None)

        threading.Thread(target=_pump, args=(self.stdout, self._lines), daemon=True).start()
        self.next_id = 1
        self._rpc("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "run-meshtastic-android-driver", "version": "1"},
        })
        self._notify("notifications/initialized")

    def _send(self, obj):
        self.stdin.write(json.dumps(obj) + "\n")
        self.stdin.flush()

    def _notify(self, method):
        self._send({"jsonrpc": "2.0", "method": method})

    def _rpc(self, method, params, timeout=180):
        rid = self.next_id
        self.next_id += 1
        self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        deadline = time.time() + timeout
        while True:
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            try:
                line = self._lines.get(timeout=remaining)
            except queue.Empty:
                break
            if line is None:
                raise RuntimeError("hotMcpServer closed its stdout (is another instance running?)")
            line = line.strip()
            if not line.startswith("{"):
                continue  # gradle noise
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == rid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result")
        raise TimeoutError(f"{method}: no response in {timeout}s")

    def call(self, tool, args=None):
        return self._rpc("tools/call", {"name": tool, "arguments": args or {}})

    def ensure_connected(self, timeout=90):
        """The server attaches to the app asynchronously after initialize; poll before UI calls."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            s = "".join(c.get("text", "") for c in (self.call("status") or {}).get("content", []))
            if '"connected":true' in s.replace(" ", ""):
                return s
            time.sleep(2)
        raise TimeoutError(f"app not connected after {timeout}s — is :desktopApp:hotRunAsync running? status: {s[:300]}")

    def close(self):
        try:
            self.stdin.close()
        except OSError:
            pass
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()


RAISE_SCRIPT = """
tell application "System Events"
  repeat with p in (every process whose name is "java")
    repeat with w in (every window of p)
      if name of w is "Meshtastic Desktop" then
        set frontmost of p to true
        perform action "AXRaise" of w
        return "raised"
      end if
    end repeat
  end repeat
end tell
return "not found"
"""


def raise_app():
    r = subprocess.run(["osascript", "-e", RAISE_SCRIPT], capture_output=True, text=True, timeout=30)
    print((r.stdout or r.stderr).strip())


def text_of(result):
    out = []
    for c in (result or {}).get("content", []):
        if c.get("type") == "text":
            out.append(c["text"])
    return "\n".join(out)


def save_image(result, path):
    for c in (result or {}).get("content", []):
        if c.get("type") == "image":
            with open(path, "wb") as f:
                f.write(base64.b64decode(c["data"]))
            return True
    # some tools return the base64 inline in text
    t = text_of(result)
    m = re.search(r"[A-Za-z0-9+/=]{200,}", t or "")
    if m:
        with open(path, "wb") as f:
            f.write(base64.b64decode(m.group(0)))
        return True
    return False


def main():
    argv = sys.argv[1:]
    repo = os.getcwd()
    if argv and argv[0] == "--repo":
        repo = argv[1]
        argv = argv[2:]
    if not argv:
        print(__doc__)
        return 2
    mcp = HotMcp(repo)
    UI_CMDS = {"windows", "tree", "click", "longclick", "type", "scroll_to", "ss", "reload", "restart", "reset_ui", "err", "logs"}  # "raise" is local, no app connection needed
    try:
        for cmd in argv:
            name, _, val = cmd.partition("=")
            if name in UI_CMDS:
                mcp.ensure_connected()
            if name == "tools":
                r = mcp._rpc("tools/list", {})
                for t in r.get("tools", []):
                    print(f"{
```

### Core Architecture Module: `.claude/skills/run-meshtastic-android/driver_emulator.py`
```
#!/usr/bin/env python3
"""Drive the Meshtastic Android app on an emulator/device over adb.

Scripted bring-up (never hand-walk onboarding): launches the debug build's
shell-only AutomationLauncher alias with the skip_onboarding extra and a
/connections deeplink that auto-connects to a TCP radio — pair it with a
replay-sim radio (an AVD reaches the host at
10.0.2.2). Handles the trust dialog newer builds pop on first connect.

Usage:
  driver_emulator.py [-s SERIAL] [-p PACKAGE] CMD [CMD ...]

Commands (executed left to right):
  connect[=ADDR]        force-stop, then deeplink-launch and auto-connect.
                        ADDR defaults to t10.0.2.2:4403 (t=TCP, x=BLE, s=serial,
                        n=disconnect). Waits for and accepts the trust dialog.
  launch                plain launch (skip_onboarding, no deeplink)
  stop                  force-stop the app
  dump                  print the uiautomator XML of the current screen
  find=TEXT             print nodes whose text/desc contains TEXT (with bounds)
  tap_text=TEXT         tap the center of the first clickable node matching TEXT
  tap=X,Y               tap raw coordinates
  text=STRING           type text into the focused field
  key=KEYCODE           send a keycode (e.g. 4 = BACK — careful, closes dialogs)
  swipe=X1,Y1,X2,Y2     swipe (use x≈30 in lists; mid-screen swipes get eaten by maps)
  ss=PATH.png           screenshot to a local file
  wait_text=TEXT        poll up to 60 s until TEXT appears on screen
  sleep=SECONDS         pause

Example — bring the app up against a replay sim on host port 4404:
  driver_emulator.py connect=t10.0.2.2:4404 wait_text=RPLY ss=/tmp/emu.png
"""

import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

SERIAL = None
PKG = "com.geeksville.mesh.fdroid.debug"
ACTIVITY = "org.meshtastic.app.AutomationLauncher"
# Builds without the alias; they ignore the launch switches.
FALLBACK_ACTIVITY = "org.meshtastic.app.MainActivity"


def adb(*args):
    cmd = ["adb"] + (["-s", SERIAL] if SERIAL else []) + list(args)
    r = subprocess.run(cmd, capture_output=True, timeout=120)
    if r.returncode != 0:
        # am start reports a missing component on stdout
        err = ((r.stderr or b"") + (r.stdout or b"")).decode(errors="replace").strip()
        raise RuntimeError(f"adb {' '.join(args)} failed ({r.returncode}): {err[:300]}")
    return (r.stdout or b"").decode(errors="replace")


def start_app(*extras):
    try:
        return adb("shell", "am", "start", "-n", f"{PKG}/{ACTIVITY}", *extras)
    except RuntimeError as e:
        if "does not exist" not in str(e):
            raise
    return adb("shell", "am", "start", "-n", f"{PKG}/{FALLBACK_ACTIVITY}", *extras)


def ui_dump():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    return adb("shell", "cat", "/sdcard/ui.xml")


def nodes(xml):
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    out = []
    for n in root.iter("node"):
        out.append(n.attrib)
    return out


def center(bounds):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not m:
        return None
    x1, y1, x2, y2 = map(int, m.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def find(text, clickable_only=False, exact=False):
    for n in nodes(ui_dump()):
        t, d = n.get("text", ""), n.get("content-desc", "")
        if exact:
            hit = text.lower() in (t.lower(), d.lower())
        else:
            hit = text.lower() in (t + " " + d).lower()
        if hit and (not clickable_only or n.get("clickable") == "true"):
            yield n


def tap_text(text):
    # exact text match first — substring matching taps "Stop Connecting" when you want "Connect"
    for n in find(text, exact=True):
        c = center(n.get("bounds", ""))
        if c:
            adb("shell", "input", "tap", str(c[0]), str(c[1]))
            return f"tapped exact {text!r} at {c}"
    for n in find(text, clickable_only=True):
        c = center(n.get("bounds", ""))
        if c:
            adb("shell", "input", "tap", str(c[0]), str(c[1]))
            return f"tapped {text!r} at {c}"
    # fall back to any match (some rows are labels inside a clickable parent)
    for n in find(text):
        c = center(n.get("bounds", ""))
        if c:
            adb("shell", "input", "tap", str(c[0]), str(c[1]))
            return f"tapped (non-clickable match) {text!r} at {c}"
    return f"NOT FOUND: {text!r}"


def wait_text(text, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if any(True for _ in find(text)):
            return f"found {text!r}"
        time.sleep(3)
    return f"TIMEOUT waiting for {text!r}"


def connect(addr):
    adb("shell", "am", "force-stop", PKG)
    time.sleep(1)
    start_app(
        "--ez", "skip_onboarding", "true",
        "--ez", "skip_connect_confirm", "true",
        "-a", "android.intent.action.VIEW",
        "-d", f"https://meshtastic.org/connections?address={addr}",
    )
    # Debug builds with the AutomationLauncher alias apply the address with no dialog;
    # older ones pop the trust dialog, sometimes late on a slow emulator.
    # Watch for either for 30 s. Match the dialog's title, not bare "Connect", which
    # also matches "Stop Connecting".
    deadline = time.time() + 30
    while time.time() < deadline:
        if any(True for _ in find("Disconnect")):
            break
        if any(True for _ in find("Connect to this device")):
            print(tap_text("Connect"))
            break
        time.sleep(3)
    else:
        print("neither the trust dialog nor a connection appeared in 30 s")
    # A missing dialog does not prove success (the launch or deeplink may have failed):
    # require the Connection screen's Disconnect button before claiming victory.
    v = wait_text("Disconnect", timeout=60)
    if not v.startswith("found"):
        return f"FAILED: launched with {addr}, but no connected state appeared ({v})"
    return f"connected via {addr}"


def main():
    global SERIAL, PKG
    argv = sys.argv[1:]
    while argv and argv[0] in ("-s", "-p"):
        if len(argv) < 2:
            print(__doc__)
            return 2
        if argv[0] == "-s":
            SERIAL = argv[1]
        else:
            PKG = argv[1]
        argv = argv[2:]
    if not argv:
        print(__doc__)
        return 2
    for cmd in argv:
        name, _, val = cmd.partition("=")
        if name == "connect":
            res = connect(val or "t10.0.2.2:4403")
            print(res)
            if res.startswith("FAILED"):
                return 1
        elif name == "launch":
            start_app("--ez", "skip_onboarding", "true")
            print("launched")
        elif name == "stop":
            adb("shell", "am", "force-stop", PKG)
            print("stopped")
        elif name == "dump":
            print(ui_dump())
        elif name == "find":
            for n in find(val):
                print(f"{n.get('text') or n.get('content-desc')!r} clickable={n.get('clickable')} bounds={n.get('bounds')}")
        elif name == "tap_text":
            res = tap_text(val)
            print(res)
            if res.startswith("NOT FOUND"):
                return 1
        elif name == "tap":
            x, y = val.split(",")
            adb("shell", "input", "tap", x, y)
            print(f"tapped {x},{y}")
        elif name == "text":
            adb("shell", "input", "text", val)
            print("typed (beware: 'input text' can append a trailing space)")
        elif name == "key":
            adb("shell", "input", "keyevent", val)
            print(f"key {val}")
        elif name == "swipe":
            adb("shell", "input", "swipe", *val.split(","))
            print(f"swipe {val}")
        elif name == "ss":
            with open(val, "wb") as f:
                subprocess.run(
                    ["adb"] + (["-s", SERIAL] if SERIAL else []) + ["exec-out", "screencap",
```

### Core Architecture Module: `obtainium/generate-links.py`
```
#!/usr/bin/env python3
"""Generate the Obtainium artifacts from one source of truth.

This script owns:

  1. the one-tap deep-link tables in the project README and the developer guide,
  2. the per-flavor Obtainium import files in this directory, and
  3. with --refresh, the "currently published" channel table in the guide.

Two kinds of staleness, two modes:

    python3 obtainium/generate-links.py            # write offline targets
    python3 obtainium/generate-links.py --check    # verify offline targets, exit 1 on drift
    python3 obtainium/generate-links.py --refresh  # + hit the releases API (network)

--check is deterministic and offline: the links and import files derive purely
from CHANNELS x FLAVORS, so they can only drift when a commit changes them. That
is a pull-request concern.

--refresh is the part that goes stale on its own. It resolves each channel
against the live GitHub releases and asserts every `apkFilterRegEx` still matches
the assets our release workflows actually publish — so renaming a release asset
fails loudly here instead of silently breaking every user's update check. It also
records which channels are currently published, which changes as builds are
promoted. That is a scheduled concern; see scheduled-updates.yml.

`com.geeksville.mesh.json` is deliberately NOT generated here: it is a
byte-identical mirror of what we submitted to apps.obtainium.imranr.dev and is
maintained by hand alongside that PR.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

REPO_URL = "https://github.com/meshtastic/Meshtastic-Android"
REDIRECT = "https://apps.obtainium.imranr.dev/redirect.html?r="

REPO_ROOT = Path(__file__).resolve().parent.parent
DOC = REPO_ROOT / "docs/en/developer/test-builds.md"
README = REPO_ROOT / "README.md"
OBTAINIUM_DIR = REPO_ROOT / "obtainium"

BEGIN = "<!-- BEGIN GENERATED LINKS: obtainium/generate-links.py -->"
END = "<!-- END GENERATED LINKS -->"

STATUS_BEGIN = "<!-- BEGIN GENERATED STATUS: obtainium/generate-links.py --refresh -->"
STATUS_END = "<!-- END GENERATED STATUS -->"

RELEASES_API = "https://api.github.com/repos/meshtastic/Meshtastic-Android/releases?per_page=100"

# The developer guide documents every channel; the project README only carries
# the two channels a normal user should be choosing between.
README_CHANNELS = ("stable", "open")

# Release assets are androidApp-<flavor>[-<abi>]-release.apk; snapshot builds
# attach androidApp-<flavor>-<abi>-debug-<versionCode>.apk instead. The google
# flavor ships a single universal release APK, so it needs no arch filter; the
# fdroid flavor is split per ABI and lets Obtainium's arch filter choose.
FLAVORS = {
    "google": {
        "label": "google",
        "release_apk": {"apkFilterRegEx": r"google-release\.apk$"},
        "debug_apk": {
            "apkFilterRegEx": r"google-.*-debug-\d+\.apk$",
            "autoApkFilterByArch": True,
        },
        "debug_id": "com.geeksville.mesh.google.debug",
    },
    "fdroid": {
        "label": "fdroid",
        "release_apk": {
            "apkFilterRegEx": r"fdroid-.*-release\.apk$",
            "autoApkFilterByArch": True,
        },
        "debug_apk": {
            "apkFilterRegEx": r"fdroid-.*-debug-\d+\.apk$",
            "autoApkFilterByArch": True,
        },
        "debug_id": "com.geeksville.mesh.fdroid.debug",
    },
}

RELEASE_ID = "com.geeksville.mesh"

# Every non-debug channel is RELEASE_ID, so only one of them can be tracked at a
# time. `debug` marks the snapshot channel, which gets its own application ID.
CHANNELS = [
    {"key": "stable", "label": "Stable", "name": "Meshtastic", "settings": {}},
    {
        "key": "open",
        "label": "Open beta",
        "name": "Meshtastic Beta",
        "settings": {"includePrereleases": True, "filterReleaseTitlesByRegEx": "-open"},
    },
    {
        "key": "closed",
        "label": "Closed beta",
        "name": "Meshtastic Alpha",
        "settings": {"includePrereleases": True, "filterReleaseTitlesByRegEx": "-closed"},
    },
    {
        "key": "bleeding",
        "label": "Bleeding edge (newest promoted test build)",
        "name": "Meshtastic Beta",
        "settings": {
            "includePrereleases": True,
            "filterReleaseTitlesByRegEx": "-(closed|open)",
        },
    },
    {
        "key": "snapshot",
        "label": "Snapshot (latest commit on `main`)",
        "name": "Meshtastic Snapshot",
        "debug": True,
        "settings": {
            "includePrereleases": True,
            "filterReleaseTitlesByRegEx": "^Snapshot",
            "useLatestAssetDateAsReleaseDate": True,
            # The tag never moves off "snapshot", so the release date is the only
            # thing that changes between builds.
            "versionDetection": False,
            "releaseDateAsVersion": True,
        },
    },
]

# What each per-flavor import file carries.
#
# Release builds of both flavors are RELEASE_ID, so an import file can only ever
# carry ONE of them — Obtainium's import calls saveApps() keyed by id, and a
# second entry with the same id silently overwrites the first. That is why the
# flavor choice is expressed as two separate files, and why the beta channels
# (also RELEASE_ID) are left to the deep links rather than bundled here.
#
# Debug builds are the exception: they carry a per-flavor `.debug` suffix, so
# both snapshots are genuinely distinct apps and every file ships both.
EXPORT_RELEASE_CHANNEL = "stable"
EXPORT_DEBUG_CHANNELS = ("snapshot",)


def config_for(channel, flavor_key):
    """Build one Obtainium app config for a channel/flavor pair."""
    flavor = FLAVORS[flavor_key]
    is_debug = channel.get("debug", False)
    settings = dict(channel["settings"])
    settings.update(flavor["debug_apk"] if is_debug else flavor["release_apk"])
    # Flavor-suffix only the snapshots. Both debug flavors can coexist, so their
    # labels have to disambiguate; a release entry is always singular, so
    # "Meshtastic" beats branding it with a build-flavor suffix forever.
    name = f"{channel['name']} ({flavor['label']})" if is_debug else channel["name"]
    # appName is the only reliable label: App.finalName is
    # `additionalSettings['appName'] ?? name`, and Obtainium otherwise falls back
    # to the installed app's own label (a debug build shows up as "Google Debug").
    settings["appName"] = name
    return {
        "id": flavor["debug_id"] if is_debug else RELEASE_ID,
        "url": REPO_URL,
        "author": "meshtastic",
        "name": name,
        "additionalSettings": json.dumps(settings, separators=(",", ":")),
    }


def deep_link(channel, flavor_key):
    blob = json.dumps(config_for(channel, flavor_key), separators=(",", ":"))
    # Only the JSON payload is percent-encoded; the scheme prefix stays literal.
    return f"{REDIRECT}obtainium://app/{quote(blob, safe='')}"


def render_table(channels=None, label_of=None):
    """Render the marker-delimited link table for `channels` (default: all)."""
    channels = channels or CHANNELS
    lines = [
        BEGIN,
        "",
        "| Channel | `google` flavor | `fdroid` flavor |",
        "|---|---|---|",
    ]
    for channel in channels:
        cells = " | ".join(
            f"[Add]({deep_link(channel, flavor_key)})" for flavor_key in FLAVORS
        )
        label = label_of(channel) if label_of else channel["label"]
        lines.append(f"| {label} | {cells} |")
    lines += ["", END]
    return "\n".join(lines)


def replace_block(text, body, begin=BEGIN, end=END):
    """Replace the marker-delimited block in `text` with `body`."""
    start, stop = text.index(begin), text.index(end) + len(end)
    return text[:start] + body + text[stop:]


# --- live release data (--refresh only) -------------------------------------


def fetch_releases():
    request = urllib.request.Request(
        RELEASES_API, headers={"Acc
```

### Core Architecture Module: `scripts/bump-version-name.py`
```
#!/usr/bin/env python3
"""Open the next version line: VERSION_NAME_BASE plus everything pull-request.yml requires with it.

That is the AppStream <release> entry in metainfo.xml, its five <image> URLs moved to the
new version's release assets, and the Play what's-new rendered from the entry by
sync-play-changelog.py. The entry's paragraph is a placeholder; rewrite it and re-run
sync-play-changelog.py before the internal cut, or it ships as the store text.

Running it twice for the same version changes nothing the second time.

    python3 scripts/bump-version-name.py <X.Y.Z>
"""
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG = REPO_ROOT / "config.properties"
METAINFO = REPO_ROOT / "desktopApp/packaging/linux/org.meshtastic.MeshtasticDesktop.metainfo.xml"
SYNC = REPO_ROOT / "scripts/sync-play-changelog.py"
PLACEHOLDER = "Stability and reliability fixes."


def bump_config(v: str) -> None:
    text, n = re.subn(r"^VERSION_NAME_BASE=.*$", f"VERSION_NAME_BASE={v}", CONFIG.read_text(), flags=re.M)
    if n != 1:
        sys.exit(f"expected one VERSION_NAME_BASE line in {CONFIG.name}, found {n}")
    CONFIG.write_text(text)


def bump_metainfo(v: str) -> None:
    text = METAINFO.read_text()
    if f'<release version="{v}"' not in text:
        first = re.search(r"^([ \t]*)<release ", text, re.M)
        if not first:
            sys.exit(f"no <release> entry in {METAINFO.name} to insert above")
        ind = first.group(1)
        date = datetime.now(timezone.utc).date().isoformat()
        entry = (
            f'{ind}<release version="{v}" date="{date}">\n'
            f"{ind}  <description>\n"
            f"{ind}    <p>{PLACEHOLDER}</p>\n"
            f"{ind}  </description>\n"
            f"{ind}</release>\n"
        )
        text = text[: first.start()] + entry + text[first.start() :]
    text = re.sub(r"(<image>[^<]*/releases/download/)v[^/<]+/", rf"\g<1>v{v}/", text)
    METAINFO.write_text(text)


def main() -> int:
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
        sys.exit("usage: bump-version-name.py <X.Y.Z>")
    v = sys.argv[1]
    bump_config(v)
    bump_metainfo(v)
    subprocess.run([sys.executable, str(SYNC)], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `scripts/check-changes-filter.py`
```
#!/usr/bin/env python3
"""Check that every module root has an entry in pull-request.yml's android filter.

Each top-level directory holding a module in settings.gradle.kts needs a '<root>/**'
line in the android filter, or a PR that touches only that module skips CI. Entries
in the other filters do not count. Exits non-zero on drift.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Filter roots that are intentionally not Gradle module roots
# (CI/workflow implementation + shared build infrastructure).
ALLOWED_INFRA_ROOTS = {'.github', 'build-logic', 'config', 'gradle'}
ALLOWED_EXTRA_ROOTS = {'baselineprofile'}


def android_filter(workflow: str) -> str:
    """Return the entries of the android filter, which is what gates validate-and-build."""
    lines = workflow.split('\n')
    try:
        filters = next(i for i, line in enumerate(lines) if line.strip() == 'filters: |')
        start = next(i for i in range(filters + 1, len(lines)) if lines[i].strip() == 'android:')
    except StopIteration:
        raise SystemExit('check-changes filter drift detected: no android filter in pull-request.yml')
    indent = len(lines[start]) - len(lines[start].lstrip())
    end = start + 1
    while end < len(lines):
        line = lines[end]
        if line.strip() and len(line) - len(line.lstrip()) <= indent:
            break
        end += 1
    return '\n'.join(lines[start + 1:end])


def main() -> None:
    settings = (REPO_ROOT / 'settings.gradle.kts').read_text()
    workflow = (REPO_ROOT / '.github/workflows/pull-request.yml').read_text()

    module_roots = {
        module.split(':')[0]
        for module in re.findall(r'":([^"]+)"', settings)
    }
    expected_roots = module_roots | ALLOWED_EXTRA_ROOTS

    # Only a whole-root entry covers a root: 'core/ble/**' leaves the rest of core/ unfiltered.
    filter_paths = set(re.findall(r"-\s*'([^'/]+)/\*\*'", android_filter(workflow)))

    missing = sorted(expected_roots - filter_paths)
    unexpected = sorted(filter_paths - expected_roots - ALLOWED_INFRA_ROOTS)

    if missing or unexpected:
        print('check-changes filter drift detected:')
        if missing:
            print('  Missing roots:', ', '.join(missing))
        if unexpected:
            print('  Unexpected roots:', ', '.join(unexpected))
        raise SystemExit(1)

    print('check-changes filter is aligned with settings.gradle module roots.')


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `scripts/check-doc-aliases.js`
```
#!/usr/bin/env node
// scripts/check-doc-aliases.js
// Checks that every alias a page declares in frontmatter is also carried by that page's
// entry in DocBundleLoader.kt, the in-app docs index.
// Exit 0 = every authored alias is registered, Exit 1 = drift found.
//
// Contract: the loader MUST be a superset of the frontmatter, not identical to it.
// Only the loader's list reaches the running app — DefaultDocBundleLoader.stripFrontmatter()
// discards the frontmatter before the markdown is rendered, and KeywordSearchEngine scores
// against DocPage.aliases, which comes from the loader. sync-android-docs.js strips aliases
// for Docusaurus too, so an alias that exists only in frontmatter is a search term the author
// wrote and no consumer ever sees — the drift this check exists to catch. The reverse is
// harmless: an extra loader alias is extra search vocabulary for a page that already owns it,
// and several are deliberate (signal-meter keeps "signal-quality"/"signal-strength", translate
// keeps "language"/"i18n"/"contribute"). Demanding equality would make those permanently red.
//
// Usage: node scripts/check-doc-aliases.js [repo-root]

"use strict";

const fs = require("fs");
const path = require("path");
const { parseFrontmatter, parseListField, forEachDocPage } = require("./lib/frontmatter");

const REPO_ROOT = path.resolve(process.argv[2] || ".");
const DOCS_DIR = path.join(REPO_ROOT, "docs", "en");
const LOADER_REL = path.join(
    "feature", "docs", "src", "commonMain", "kotlin", "org", "meshtastic", "feature", "docs", "data",
    "DocBundleLoader.kt",
);
const LOADER_PATH = path.join(REPO_ROOT, LOADER_REL);

// A page entry in the loader is anchored on its resourcePath literal. User entries
// (UserPageDef) carry one list — the aliases; their keywords come from a string resource.
// Developer entries (KeywordIndexEntry) carry two — keywords first, then aliases.
const ALIAS_LIST_INDEX = { user: 0, developer: 1 };
const EXPECTED_LISTS = { user: 1, developer: 2 };

/** Extract the string literals of each listOf(...)/emptyList() group in a slice of Kotlin. */
function parseListGroups(source) {
    const groups = [];
    const openRe = /\b(listOf|emptyList)\s*\(/g;
    let match;

    while ((match = openRe.exec(source)) !== null) {
        if (match[1] === "emptyList") {
            groups.push([]);
            continue;
        }

        // Walk forward from the opening paren, string-aware, to find its partner.
        let depth = 1;
        let i = openRe.lastIndex;
        let inString = false;
        while (i < source.length && depth > 0) {
            const ch = source[i];
            if (inString) {
                if (ch === "\\") i++;
                else if (ch === '"') inString = false;
            } else if (ch === '"') {
                inString = true;
            } else if (ch === "(") {
                depth++;
            } else if (ch === ")") {
                depth--;
            }
            i++;
        }

        const inner = source.slice(openRe.lastIndex, i - 1);
        groups.push([...inner.matchAll(/"([^"\\]*)"/g)].map(m => m[1]));
        openRe.lastIndex = i;
    }

    return groups;
}

/** Slice out the constructor call that encloses `index`, parens balanced. */
function enclosingEntry(source, index) {
    const ctorRe = /\b(UserPageDef|KeywordIndexEntry)\s*\(/g;
    let open = -1;
    let match;
    while ((match = ctorRe.exec(source)) !== null && match.index < index) {
        open = ctorRe.lastIndex;
    }
    if (open < 0) return null;

    let depth = 1;
    let i = open;
    let inString = false;
    while (i < source.length && depth > 0) {
        const ch = source[i];
        if (inString) {
            if (ch === "\\") i++;
            else if (ch === '"') inString = false;
        } else if (ch === '"') {
            inString = true;
        } else if (ch === "(") {
            depth++;
        } else if (ch === ")") {
            depth--;
        }
        i++;
    }
    return i > index ? source.slice(open, i - 1) : null;
}

/** Map "user/nodes" -> { section, slug, lists } for every page registered in DocBundleLoader.kt. */
function parseLoaderEntries(source) {
    const anchorRe = /"en\/(user|developer)\/([a-z0-9-]+)\.html"/g;
    const entries = new Map();

    for (const anchor of source.matchAll(anchorRe)) {
        const [, section, slug] = anchor;
        const body = enclosingEntry(source, anchor.index);
        entries.set(`${section}/${slug}`, { section, slug, lists: body ? parseListGroups(body) : [] });
    }

    return entries;
}

if (!fs.existsSync(LOADER_PATH)) {
    console.log(`ERROR: ${LOADER_REL} not found under ${REPO_ROOT}.`);
    process.exit(1);
}

const loaderEntries = parseLoaderEntries(fs.readFileSync(LOADER_PATH, "utf-8"));

console.log(`Checking frontmatter aliases against ${loaderEntries.size} DocBundleLoader entries...`);
console.log("");

let errors = 0;
let extras = 0;
let checked = 0;

forEachDocPage(DOCS_DIR, (filePath, slug, section) => {
    const relPath = path.relative(REPO_ROOT, filePath);
    const { raw } = parseFrontmatter(fs.readFileSync(filePath, "utf-8"));
    const declared = parseListField(raw, "aliases");

    const entry = loaderEntries.get(`${section}/${slug}`);
    if (!entry) {
        console.log(
            `::error file=${relPath}::no DocBundleLoader.kt entry for '${section}/${slug}', ` +
            `so its ${declared.length} frontmatter alias(es) are not searchable in the app.`,
        );
        errors++;
        return;
    }

    // Guard the shape rather than silently comparing the wrong list: a UserPageDef that grew a
    // keyword list, or a KeywordIndexEntry that lost one, would otherwise pass while checking
    // keywords against aliases.
    if (entry.lists.length !== EXPECTED_LISTS[section]) {
        console.log(
            `::error file=${LOADER_REL}::entry '${section}/${slug}' has ${entry.lists.length} ` +
            `list(s); expected ${EXPECTED_LISTS[section]}. Update check-doc-aliases.js if the ` +
            `loader's entry shape changed.`,
        );
        errors++;
        return;
    }

    checked++;
    const registered = new Set(entry.lists[ALIAS_LIST_INDEX[section]].map(a => a.toLowerCase()));
    const missing = declared.filter(a => !registered.has(a.toLowerCase()));

    if (missing.length > 0) {
        console.log(
            `::error file=${relPath}::aliases ${missing.map(a => `'${a}'`).join(", ")} are declared ` +
            `in frontmatter but missing from the DocBundleLoader.kt entry for '${section}/${slug}', ` +
            `so in-app search will not match them.`,
        );
        errors++;
    }

    const declaredSet = new Set(declared.map(a => a.toLowerCase()));
    const loaderOnly = [...registered].filter(a => !declaredSet.has(a));
    if (loaderOnly.length > 0) {
        console.log(`  note: ${section}/${slug} — loader-only alias(es): ${loaderOnly.join(", ")}`);
        extras++;
    }
});

console.log("");
console.log(`Compared ${checked} page(s); ${extras} carry loader-only aliases (allowed).`);

if (errors > 0) {
    console.log(`\nFAILED: ${errors} page(s) whose frontmatter aliases are not registered in DocBundleLoader.kt.`);
    process.exit(1);
} else {
    console.log("PASSED: every frontmatter alias is registered in DocBundleLoader.kt.");
    process.exit(0);
}

```

### Core Architecture Module: `scripts/check-doc-coverage.js`
```
#!/usr/bin/env node
// scripts/check-doc-coverage.js
// Checks that each user-facing feature module has corresponding documentation.
// Exit 0 = full coverage, Exit 1 = gaps found.
//
// Usage: node scripts/check-doc-coverage.js [repo-root]

"use strict";

const fs = require("fs");
const path = require("path");
const { forEachDocPage } = require("./lib/frontmatter");

const REPO_ROOT = path.resolve(process.argv[2] || ".");
const DOCS_DIR = path.join(REPO_ROOT, "docs", "en");

// Map of feature module directory names to expected doc page slugs.
// Modules not listed here are considered internal (no user-facing docs required).
const MODULE_TO_DOCS = {
    "feature/connections":    { pages: ["connections"], section: "user" },
    "feature/discovery":      { pages: ["discovery"], section: "user" },
    "feature/docs":           { pages: [], section: "user", internal: true },
    "feature/firmware":       { pages: ["firmware"], section: "user" },
    "feature/intro":          { pages: ["onboarding"], section: "user" },
    "feature/map":            { pages: ["map-and-waypoints"], section: "user" },
    "feature/messaging":      { pages: ["messages-and-channels"], section: "user" },
    "feature/node":           { pages: ["nodes", "node-metrics"], section: "user" },
    "feature/settings":       { pages: ["settings-radio-user", "settings-module-admin"], section: "user" },
    "feature/telemetry":      { pages: ["telemetry-and-sensors"], section: "user" },
    // Wi-Fi Provisioning for mPWRD-OS is a Settings entry point, documented in the
    // "Wi-Fi provisioning" note of the TCP/IP section of connections.md.
    "feature/wifi-provision": { pages: ["connections"], section: "user" },
};

// Collect existing doc pages
const existingPages = new Set();
forEachDocPage(DOCS_DIR, (_filePath, slug, section) => {
    existingPages.add(`${section}/${slug}`);
});

console.log(`Checking doc coverage for ${Object.keys(MODULE_TO_DOCS).length} feature modules...`);
console.log(`Found ${existingPages.size} doc pages.`);
console.log("");

let gaps = 0;

for (const [module, config] of Object.entries(MODULE_TO_DOCS)) {
    if (config.internal) continue;

    const moduleDir = path.join(REPO_ROOT, module);
    if (!fs.existsSync(moduleDir)) continue;

    for (const page of config.pages) {
        const key = `${config.section}/${page}`;
        if (!existingPages.has(key)) {
            console.log(`  ✗ ${module} → missing ${key}.md`);
            gaps++;
        }
    }
}

// Also check for doc pages that reference non-existent modules (orphans)
const documentedModules = new Set();
for (const config of Object.values(MODULE_TO_DOCS)) {
    for (const page of config.pages) {
        documentedModules.add(`${config.section}/${page}`);
    }
}

// Report coverage summary
const coveredModules = Object.entries(MODULE_TO_DOCS)
    .filter(([, c]) => !c.internal)
    .filter(([m]) => fs.existsSync(path.join(REPO_ROOT, m)));
const totalExpected = coveredModules.reduce((sum, [, c]) => sum + c.pages.length, 0);
const covered = totalExpected - gaps;
const pct = totalExpected > 0 ? Math.round((covered / totalExpected) * 100) : 100;

console.log("");
console.log(`Coverage: ${covered}/${totalExpected} required pages present (${pct}%)`);

if (gaps > 0) {
    console.log(`\n${gaps} documentation gap(s) found.`);
    process.exit(1);
} else {
    console.log("All feature modules have documentation coverage.");
    process.exit(0);
}

```

### Core Architecture Module: `scripts/check-doc-freshness.js`
```
#!/usr/bin/env node
// scripts/check-doc-freshness.js
// Reports doc pages whose last_updated frontmatter is older than a threshold.
// Exit 0 = all fresh, Exit 1 = stale pages found (advisory).
//
// Usage: node scripts/check-doc-freshness.js [docs-dir] [--max-age-days=180]

"use strict";

const fs = require("fs");
const path = require("path");
const { parseFrontmatter, forEachDocPage } = require("./lib/frontmatter");

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith("--"));
const DOCS_DIR = path.resolve(positional[0] || path.join("docs", "en"));

const maxAgeArg = args.find(a => a.startsWith("--max-age-days="));
const MAX_AGE_DAYS = maxAgeArg ? parseInt(maxAgeArg.split("=")[1], 10) : 180;

const now = new Date();
let staleCount = 0;
let totalCount = 0;

console.log(`Checking doc freshness (max age: ${MAX_AGE_DAYS} days)...`);
console.log("");

forEachDocPage(DOCS_DIR, (filePath, slug, section) => {
    totalCount++;
    const content = fs.readFileSync(filePath, "utf-8");
    const { fields } = parseFrontmatter(content);

    if (!fields.last_updated) {
        console.log(`  ⚠  ${section}/${slug}.md — missing last_updated field`);
        staleCount++;
        return;
    }

    const lastUpdated = new Date(fields.last_updated);
    const ageDays = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));

    if (ageDays > MAX_AGE_DAYS) {
        console.log(`  ⚠  ${section}/${slug}.md — ${ageDays} days old (last: ${fields.last_updated})`);
        staleCount++;
    }
});

console.log("");
if (staleCount > 0) {
    console.log(`${staleCount}/${totalCount} page(s) need review (older than ${MAX_AGE_DAYS} days or missing date).`);
    process.exit(1);
} else {
    console.log(`All ${totalCount} pages are fresh (updated within ${MAX_AGE_DAYS} days).`);
    process.exit(0);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7488** (2026-09-30): **[Bug]: After pining a channel there is no way of un-pining it**
  *Symptoms*: ### Contact Details  ronv42@outlook.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2 (29322440)  ### Affected Android version  Android 17  ### Affected phone model  Google Pixel 9 Pro  ### Affected node model  Seed Tracker L1  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  1. Goto Conversation screen and the list of channels 2. Highlight a channel and select the "Pin" icon 3. Channel will now show at the top of the list with the Pin icon in the lower right corner 4. No option to un-pin, selecting channel again and selecting the Pin icon doesn't  clear the pin   <img width="567" height="483" alt="Image" src="https://github.com/user-attachments/assets/7d49c12b-78ed-497c-ae05-5bdce01e57c4" />  ### Actual behavior  Pinning works, un-pinning doesn't    ### Expected 

- **Issue #7414** (2026-09-28): **Waypoint Notifications do respect app settings**
  *Symptoms*: ### Contact Details somenice  ### Affected app version 2.8.2  ### Affected Android version 17  ### Affected phone model Google Pixel 11  ### Affected node model Seeed T-1000E  ### Affected node firmware version 2.8.1  ### Steps to reproduce the bug Settings > Notifications > App notifications > Mestastic  Under Notification Categories > Other Toggle Waypoint notifications OFF  ### Actual behavior Notifications arrive on phone when another Node creates a waypoint.  ### Expected behavior Waypoint notification should not appear on phone after turning off specific app notification.  ### Relevant log output User 'LiQuiD' indicated a waypoint notification is using a Direct Message notification, rather than a seperate Waypoint notification.  ### Additional information The notification itself is not clickable. (Perhaps a separate issue to be created?) As a user I'd expect clicking the notification, if connected to the Node that created said notification, would open the app to the map, centred on created waypoint.   --- Submitted via Discord by: somenice (462694143861456896)
  **Post-Mortem & Fix Analysis**:
  > Additionally, long pressing the Waypoint Notification, then click Settings gear, takes you right to Application Notifications in Meshtastic and **HIGHLIGHTS** the Direct Message setting instead of Waypoint notifications.
  > Fixed in #7415 - waypoints now post on the Waypoint notifications channel and open the map at the waypoint.

- **Issue #7407** (2026-09-28): **[Bug]: F-Droid can't build**
  *Symptoms*: ### Contact Details  _No response_  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2  ### Affected Android version  -  ### Affected phone model  -  ### Affected node model  -  ### Affected node firmware version  -  ### Steps to reproduce the bug  https://gitlab.com/fdroid/fdroiddata/-/jobs/16777277512/viewer#L1515  was the APK built from the tagged commit after cleaning cache and gradle cache?  ### Actual behavior  _No response_  ### Expected behavior  _No response_  ### Screenshots/Screen recordings  _No response_  ### Relevant log output  ```shell  ```  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > The MR compares against the wrong APK - `binary:` in fdroiddata!50257 still points at `v2.8.1`. Swapped to `v2.8.2`, `apksigcopier compare` against the unsigned APK from that job's artifacts passes. 
  > @licaon-kter - compare the build against it's actual version?
  > my bad, this is why we've asked you to help this be "auto" matic... I'll retry 🤦 

- **Issue #7365** (2026-09-26): **[Bug]: Android App stuck if try to load own GPS Positions**
  *Symptoms*: ### Contact Details  Dtrieb  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  Version 2.8.2 (29322435)  ### Affected Android version  Android 17  ### Affected phone model  Pixel 7 pro  ### Affected node model  T 1000-3  ### Affected node firmware version  2.8.1  ### Steps to reproduce the bug  If I try to load my own GPS Positions the App hang nothing happens.  Then this message comes:  <img width="1440" height="2848" alt="Image" src="https://github.com/user-attachments/assets/b206700c-37b7-4f49-b575-11f23d2493d3" />  ### Actual behavior  _No response_  ### Expected behavior  _No response_  ### Screenshots/Screen recordings  <img width="1440" height="2848" alt="Image" src="https://github.com/user-attachments/assets/b6c6ab1a-25f7-436e-aa04-184fac16ea51" />  ### Relevant log output  ```shell  ```  ### 
  **Post-Mortem & Fix Analysis**:
  > Its because every minute a new position point gets logged to your local node's database and causes a large number of packets. Systematically clearing it or purging the debug log fixes it. If its not too big, it just takes a while to load and doesnt crash.  Position log points should only be added at the smart position rate/distance.

- **Issue #7358** (2026-09-25): **[Bug]: [Pre-release] The app stores/reads LOC_UNSET location entries into/from the database and displays them as actual location entries**
  *Symptoms*: ### Contact Details  I'll reply in this issue.  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  snapshot 29322435, possibly started in 29322394 but have not confirmed  ### Affected Android version  Windows build  ### Affected phone model  Irrelevant  ### Affected node model  PRIVATE_HW/PORTDUINO  ### Affected node firmware version  develop  ### Steps to reproduce the bug  1. Receive position packet from target node 2. Disconnect our app from our node 3. Reconnect 4. Position entries for packets with LOC_UNSET are displayed as actual location entries in the front end  ### Actual behavior  As far as I can tell, the entries with LOC_UNSET are loaded from the database and are displayed in the front end when they shouldn't. Of course this might also mean that they are not stored correctly in the first pl

- **Issue #7309** (2026-09-23): **[Bug]: Filtering on the node list page cuts off number of online nodes, show less info**
  *Symptoms*:   ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  2.8.2 (29322389) google  ### Affected Android version  17  ### Affected phone model  Pixel 9a  ### Steps to reproduce the bug  1. go to node list page 2. start filtering for a key word like "base" 3. notice the search takes over the whole page and you lose relevant online/filtered node info  New (current filter):  <img width="336" height="157" alt="Image" src="https://github.com/user-attachments/assets/388be45b-125e-4d1f-8154-ff5e4ef0feca" />    Old (better?) filter:  <img width="342" height="205" alt="Image" src="https://github.com/user-attachments/assets/07151e83-826c-43ab-b161-69c3203f8b5e" />

- **Issue #7301** (2026-09-22): **[Bug]: Android 2.8.2 - Can switch ON or OFF of [range test]**
  *Symptoms*: ### Contact Details  nicolas.kerspern@gmail.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  v2.8.2-open.3 (29322358)  ### Affected Android version  Android 16  ### Affected phone model  Xiaomi 14 and U15  ### Affected node model  T-Desk, T-Beam, RAK4631 and Heltec V3  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  I cannot switch ON or OFF (grey statut) on smartphone a range test but I can under [client.meshtastic](https://client.meshtastic.org/messages/broadcast/0) an reboot normally.  ### Actual behavior  no affect  ### Expected behavior  _No response_  ### Screenshots/Screen recordings  _No response_  ### Relevant log output  ```shell  ```  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Public range test has been deprecated. It is no longer in the 2.8 firmware and the 2.8 apps reflect that.

- **Issue #7300** (2026-09-22): **[Bug]: Android v2.8.2 - cannot change slot of LoRa**
  *Symptoms*: ### Contact Details  nicolas.kerspern@gmail.com  ### Checklist  - [x] I am able to reproduce the bug with the latest version.  - [x] I have updated to the latest *Alpha* firmware, and am able to reproduce the bug. Many issues are fixed quickly in alpha before the general beta release.  - [x] I made sure that there are no existing **OPEN or CLOSED issues** which I could contribute my information to.  - [x] I have taken the time to fill in all the required details. I understand that the bug report will be dismissed otherwise.  - [x] This issue contains only one bug.  - [x] I have read and understood the **Contribution Guidelines**.  - [x] I agree to follow this project's Code of Conduct  - [x] I actually read this list, and should be taken seriously.   ### Affected app version  v2.8.2-open.3 (29322358)  ### Affected Android version  Android 16  ### Affected phone model  Xiaomi 14 and U15  ### Affected node model  T-Desk, T-Beam, RAK4631 and Heltec V3  ### Affected node firmware version  2.7.26  ### Steps to reproduce the bug  I cannot change on smartphone a slot number but I can under [client.meshtastic](https://client.meshtastic.org/messages/broadcast/0) an reboot normally.  ### Actual behavior  I cannot change on smartphone a slot number but I can under [client.meshtastic](https://client.meshtastic.org/messages/broadcast/0) an reboot normally.  ### Expected behavior  no affect  ### Screenshots/Screen recordings  _No response_  ### Relevant log output  ```shell  ```  ### Addit
  **Post-Mortem & Fix Analysis**:
  > You indicated above that you tried the latest alpha firmware but listed 2.7.26. Can you confirm this is still an issue in the latest alpha firmware?  Show what slots you are trying to change to.  EU868 only has a single slot. Newer 2.8 alpha firmware adds new slots that were previously unavailable. https://meshtastic.org/docs/overview/radio-settings/#frequency-slot-calculator  <img width="1127" height="347" alt="Image" src="https://github.com/user-attachments/assets/7132623e-1efc-40a8-b9bc-50bf61ae2c8a" />
  > okay, I note : EU868 only has a single slot. Newer 2.8 alpha firmware adds new slots that were previously unavailable. Thanks
  > Regarding the slot issue I discovered: the setting had been changed inadvertently set to 2 instead of 1 or 0 (for EU868). This change stemmed from a "Local Mesh Discovery" test; out of curiosity, I had tried various "LoRa Presets," and the test was interrupted while the slot was set to 2. Consequently, I couldn't change the slot back to 1 via the smartphone, a paradoxical situation where message transmission still worked, but telemetry and traceroute did not.

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

### Incident Patch 1: `274f6f43` (2026-09-30)
**Commit Message**: fix(metrics): break power chart lines across gaps in readings (#7505)

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/ChartGaps.kt` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+/*
+ * Copyright (c) 2026 Meshtastic LLC
+ *
+ * This program is free software: you can redistribute it and/or modify
+ * it under the terms of the GNU General Public License as published by
+ * the Free Software Foundation, either version 3 of the License, or
+ * (at your option) any later version.
+ *
+ * This program is distributed in the hope that it will be useful,
+ * but WITHOUT ANY WARRANTY; without even the implied warranty of
+ * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
+ * GNU General Public License for more details.
+ *
+ * You should have received a copy of the GNU General Public License
+ * along with this program.  If not, see <https://www.gnu.org/licenses/>.
+ */
+package org.meshtastic.feature.node.metrics
+
+import kotlin.time.Duration.Companion.minutes
+
+private const val GAP_MEDIAN_MULTIPLIER = 3
+private val MIN_GAP_SECONDS = 5.minutes.inWholeSeconds
+
+/**
+ * Splits [items] into runs that a chart should draw as separate lines, cutting wherever consecutive readings are more
+ * than the gap threshold apart. [items] must be sorted ascending by [timeSeconds].
+ *
+ * The threshold is [GAP_MEDIAN_MULTIPLIER] times the median spacing, never below [MIN_GAP_SECONDS], so it follows the
+ * node's own reporting interval.
+ */
+internal fun <T> splitAtGaps(items: List<T>, timeSeconds: (T) -> Int): List<List<T>> {
+    if (items.size < 2) return listOf(items).filter { it.isNotEmpty() }
+    val deltas = items.zipWithNext { a, b -> (timeSeconds(b) - timeSeconds(a)).toLong() }
+    val sorted = deltas.sorted()
+    val mid = sorted.size / 2
+    val median = if (sorted.size % 2 == 0) (sorted[mid - 1] + sorted[mid]) / 2 else sorted[mid]
+    val threshold = maxOf(median * GAP_MEDIAN_MULTIPLIER, MIN_GAP_SECONDS)
+    val runs = mutableListOf(mutableListOf(items.first()))
+    items.zipWithNext().forEachIndexed { index, (_, next) ->
+        if (deltas[index] > threshold) runs.add(mutableListOf(next)) else runs.last().add(next)
+    }
+    return runs
+}
```

**File**: `feature/node/src/commonMain/kotlin/org/meshtastic/feature/node/metrics/PowerMetrics.kt` (modified, +8/-8)
```diff
@@ -274,18 +274,18 @@ private fun PowerMetricsChart(
             modelProducer.runTransaction {
                 if (currentData.isNotEmpty()) {
                     lineModel {
-                        series(
-                            x = currentData.map { it.time },
-                            y = currentData.map { retrieveCurrent(selectedChannel, it) },
-                        )
+                        splitAtGaps(currentData) { it.time }
+                            .forEach { run ->
+                                series(x = run.map { it.time }, y = run.map { retrieveCurrent(selectedChannel, it) })
+                            }
                     }
                 }
                 if (voltageData.isNotEmpty()) {
                     lineModel {
-                        series(
-                            x = voltageData.map { it.time },
-                            y = voltageData.map { retrieveVoltage(selectedChannel, it) },
-                        )
+                        splitAtGaps(voltageData) { it.time }
+                            .forEach { run ->
+                                series(x = run.map { it.time }, y = run.map { retrieveVoltage(selectedChannel, it) })
+                            }
                     }
                 }
             }
```

**File**: `feature/node/src/commonTest/kotlin/org/meshtastic/feature/node/metrics/ChartGapsTest.kt` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+/*
+ * Copyright (c) 2026 Meshtastic LLC
+ *
+ * This program is free software: you can redistribute it and/or modify
+ * it under the terms of the GNU General Public License as published by
+ * the Free Software Foundation, either version 3 of the License, or
+ * (at your option) any later version.
+ *
+ * This program is distributed in the hope that it will be useful,
+ * but WITHOUT ANY WARRANTY; without even the implied warranty of
+ * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
+ * GNU General Public License for more details.
+ *
+ * You should have received a copy of the GNU General Public License
+ * along with this program.  If not, see <https://www.gnu.org/licenses/>.
+ */
+package org.meshtastic.feature.node.metrics
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class ChartGapsTest {
+    private fun split(vararg times: Int) = splitAtGaps(times.toList()) { it }
+
+    @Test
+    fun emptyAndSingleInputsYieldNoGapSplit() {
+        assertEquals(emptyList(), split())
+        assertEquals(listOf(listOf(100)), split(100))
+    }
+
+    @Test
+    fun evenlySpacedReadingsStayOneRun() {
+        assertEquals(listOf(listOf(0, 900, 1800, 2700)), split(0, 900, 1800, 2700))
+    }
+
+    @Test
+    fun longSilenceBreaksTheRun() {
+        assertEquals(
+            listOf(listOf(0, 900, 1800), listOf(30_000, 30_900)),
+            split(0, 900, 1800, 30_000, 30_900),
+        )
+    }
+
+    @Test
+    fun thresholdScalesWithMedianSpacing() {
+        assertEquals(listOf(listOf(0, 1800, 3600, 9000)), split(0, 1800, 3600, 9000))
+        assertEquals(listOf(listOf(0, 1800, 3600), listOf(9100)), split(0, 1800, 3600, 9100))
+    }
+
+    @Test
+    fun evenSpacingCountUsesTheTrueMedian() {
+        assertEquals(listOf(listOf(0, 60, 120, 720), listOf(2220)), split(0, 60, 120, 720, 2220))
+    }
+
+    @Test
+    fun denseReadingsUseTheFiveMinuteFloor() {
+        assertEquals(listOf(listOf(0, 30, 60, 360)), split(0, 30, 60, 360))
+        assertEquals(listOf(listOf(0, 30, 60), listOf(361)), split(0, 30, 60, 361))
+    }
+
+    @Test
+    fun isolatedReadingBetweenGapsIsItsOwnRun() {
+        assertEquals(
+            listOf(listOf(0, 60, 120), listOf(10_000), listOf(20_000, 20_060)),
+            split(0, 60, 120, 10_000, 20_000, 20_060),
+        )
+    }
+}
```

---

### Incident Patch 2: `0c9d007d` (2026-09-30)
**Commit Message**: perf(store-screenshots): wait for the map to draw instead of a fixed 45 seconds (#7501)

**File**: `androidApp/src/google/kotlin/org/meshtastic/app/map/MapView.kt` (modified, +5/-1)
```diff
@@ -706,7 +706,11 @@ fun MapView(
                 mapType = effectiveGoogleMapType,
                 isMyLocationEnabled = isLocationTrackingEnabled && locationPermission.isGranted,
             ),
-            onMapLoaded = { isMapLoaded = true },
+            onMapLoaded = {
+                isMapLoaded = true
+                // The store-screenshot capture waits for this tag instead of a fixed delay.
+                Logger.withTag("MapDrawn").d { "tiles drawn" }
+            },
             onMapClick = { latLng ->
                 if (isMainMode && boxAuthoringDraft != null) {
                     val first = boxAuthoringFirstCorner
```

**File**: `feature/map-maplibre/src/commonMain/kotlin/org/meshtastic/feature/map/maplibre/MeshMap.kt` (modified, +11/-0)
```diff
@@ -31,8 +31,11 @@ import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.platform.LocalLayoutDirection
 import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
+import co.touchlab.kermit.Logger
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.delay
+import kotlinx.coroutines.flow.dropWhile
+import kotlinx.coroutines.flow.filterIsInstance
 import kotlinx.coroutines.flow.filterNotNull
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.launch
@@ -51,6 +54,7 @@ import org.maplibre.compose.location.updateCamera
 import org.maplibre.compose.map.CameraConstraints
 import org.maplibre.compose.map.LocalMapState
 import org.maplibre.compose.map.LocalViewport
+import org.maplibre.compose.map.MapEvent
 import org.maplibre.compose.map.MapState
 import org.maplibre.compose.map.MaplibreMap
 import org.maplibre.compose.map.rememberMapState
@@ -228,6 +232,13 @@ fun MeshMap(
     // thrown by the time this is reached.
     if (!LocalMapLibreRuntimeProbe.current()) return MapEngineUnavailable(modifier)
 
+    // The store-screenshot capture waits for this tag instead of a fixed delay.
+    LaunchedEffect(mapState) {
+        // Idle can arrive before the first render session; only an idle after a drawn frame means tiles are on screen.
+        mapState.events.dropWhile { it !is MapEvent.FrameRendered }.filterIsInstance<MapEvent.Idle>().first()
+        Logger.withTag("MapDrawn").d { "tiles drawn" }
+    }
+
     val zoomRange = basemap.zoomRange()
     MaplibreMap(
         modifier = modifier,
```

**File**: `store-screenshots/src/main/kotlin/org/meshtastic/storescreenshots/StoreScreenshots.kt` (modified, +26/-3)
```diff
@@ -132,7 +132,7 @@ class StoreScreenshots {
             open(Shot.Nodes.path)
             SystemClock.sleep(READ_WARM_UP_MS)
         }
-        open(shot.path)
+        if (shot.waitsForMapDrawn) openAndAwaitMapDrawn(shot) else open(shot.path)
         SystemClock.sleep(shot.minimumWaitMs)
         val stable =
             waitForStableInActiveWindow(
@@ -150,6 +150,22 @@ class StoreScreenshots {
         save(bitmap, name)
     }
 
+    /**
+     * Waits for the map to log that its tiles are drawn: Google Maps' onMapLoaded, MapLibre's first idle. The stability
+     * check after it still covers the camera settling on the mesh.
+     */
+    private fun UiAutomatorTestScope.openAndAwaitMapDrawn(shot: Shot) {
+        // A time boundary, not a line count: logcat is a ring buffer and older matches rotate out.
+        val since = System.currentTimeMillis().let { "%d.%03d".format(it / MILLIS_PER_SECOND, it % MILLIS_PER_SECOND) }
+        open(shot.path)
+        val deadline = SystemClock.uptimeMillis() + MAP_DRAWN_TIMEOUT_MS
+        while (SystemClock.uptimeMillis() < deadline) {
+            if (MAP_DRAWN_MESSAGE in shell("logcat -d -T $since -s $MAP_DRAWN_TAG")) return
+            SystemClock.sleep(POLL_MS)
+        }
+        Log.w(TAG, "${shot.fileName} never logged $MAP_DRAWN_TAG; capturing after the timeout")
+    }
+
     /** Launches through the debug build's shell-only alias, the one launch the app honours the switches on. */
     private fun UiAutomatorTestScope.open(path: String, clearTask: Boolean = false) {
         val flags = if (clearTask) "--activity-clear-task " else ""
@@ -189,19 +205,20 @@ class StoreScreenshots {
         TenInch("tenInchScreenshots", 2560, 1440, 320),
     }
 
-    /** The five listing shots, named as fastlane lays them out. The map loads tiles for a while before it settles. */
+    /** The five listing shots, named as fastlane lays them out. The map waits for its tiles before it settles. */
     private enum class Shot(
         val fileName: String,
         val path: String,
         val minimumWaitMs: Long = 2_000,
         val stableTimeoutMs: Long = 30_000,
         val stableIntervalMs: Long = 2_000,
         val readFirst: Boolean = false,
+        val waitsForMapDrawn: Boolean = false,
     ) {
         // The primary channel's contact key, raw: `am start` takes it literally and Uri.parse accepts the caret.
         Messages("1_messages", "messages/0^all", readFirst = true),
         Nodes("2_nodes", "nodes"),
-        Map("3_map", "map", minimumWaitMs = 45_000, stableTimeoutMs = 120_000, stableIntervalMs = 8_000),
+        Map("3_map", "map", stableTimeoutMs = 120_000, stableIntervalMs = 8_000, waitsForMapDrawn = true),
         NodeDetail("4_node_detail", "nodes/$RIDGE_TOP_NUM"),
         Channels("5_channels", "channels"),
     }
@@ -230,6 +247,12 @@ class StoreScreenshots {
 
         const val READ_WARM_UP_MS = 3_000L
 
+        /** Logged by both flavors' maps (MapView.kt, MeshMap.kt) once the tiles are drawn. */
+        const val MAP_DRAWN_TAG = "MapDrawn"
+        const val MAP_DRAWN_MESSAGE = "tiles drawn"
+        const val MAP_DRAWN_TIMEOUT_MS = 45_000L
+        const val MILLIS_PER_SECOND = 1_000L
+
         const val CONNECT_ATTEMPTS = 3
         const val CONNECT_TIMEOUT_MS = 60_000L
         const val POLL_MS = 500L
```

---

### Incident Patch 3: `7d16a65e` (2026-09-30)
**Commit Message**: fix(app): restore the Apache HTTP legacy library for Google Maps (#7499)

**File**: `androidApp/src/google/AndroidManifest.xml` (modified, +9/-0)
```diff
@@ -39,6 +39,15 @@
         <meta-data
             android:name="com.google.android.geo.API_KEY"
             android:value="${MAPS_API_KEY}" />
+
+        <!--
+          Google Maps' Play services module loads into this app's classloader and, on older Play services, resolves
+          org.apache.http from it. Nothing here references it, but without this the map screen crashes.
+        -->
+        <uses-library
+            android:name="org.apache.http.legacy"
+            android:required="false" />
+
         <property
             android:name="android.app.appfunctions.app_metadata"
             android:resource="@xml/app_metadata" />
```

**File**: `androidApp/src/testGoogle/kotlin/org/meshtastic/app/GoogleMapsManifestTest.kt` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/*
+ * Copyright (c) 2026 Meshtastic LLC
+ *
+ * This program is free software: you can redistribute it and/or modify
+ * it under the terms of the GNU General Public License as published by
+ * the Free Software Foundation, either version 3 of the License, or
+ * (at your option) any later version.
+ *
+ * This program is distributed in the hope that it will be useful,
+ * but WITHOUT ANY WARRANTY; without even the implied warranty of
+ * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
+ * GNU General Public License for more details.
+ *
+ * You should have received a copy of the GNU General Public License
+ * along with this program.  If not, see <https://www.gnu.org/licenses/>.
+ */
+package org.meshtastic.app
+
+import org.w3c.dom.Element
+import java.io.File
+import java.util.Properties
+import javax.xml.parsers.DocumentBuilderFactory
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * Google Maps' Play services module loads into the app's classloader and, on older Play services, resolves
+ * org.apache.http from it, so the map screen crashes unless the merged manifest keeps the legacy library.
+ */
+class GoogleMapsManifestTest {
+
+    @Test
+    fun `the merged manifest keeps the Apache HTTP legacy library as optional`() {
+        val config = Properties()
+        requireNotNull(javaClass.classLoader?.getResourceAsStream(TEST_CONFIG)) { "$TEST_CONFIG missing" }
+            .use(config::load)
+        val manifest = File(requireNotNull(config.getProperty(MERGED_MANIFEST)) { "$MERGED_MANIFEST missing" })
+
+        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
+        val libraries = factory.newDocumentBuilder().parse(manifest).getElementsByTagName("uses-library")
+        val required =
+            (0 until libraries.length)
+                .map { libraries.item(it) as Element }
+                .associate { it.getAttributeNS(ANDROID_NS, "name") to it.getAttributeNS(ANDROID_NS, "required") }
+
+        assertEquals("false", required[APACHE_HTTP_LEGACY], "$APACHE_HTTP_LEGACY must be declared, not required")
+    }
+
+    private companion object {
+        const val TEST_CONFIG = "com/android/tools/test_config.properties"
+        const val MERGED_MANIFEST = "android_merged_manifest"
+        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
+        const val APACHE_HTTP_LEGACY = "org.apache.http.legacy"
+    }
+}
```

---

### Incident Patch 4: `700ff601` (2026-09-30)
**Commit Message**: fix(messaging): let a pinned conversation be unpinned (#7492)

**File**: `feature/messaging/src/commonMain/kotlin/org/meshtastic/feature/messaging/ui/contact/Contacts.kt` (modified, +3/-3)
```diff
@@ -184,9 +184,9 @@ fun ContactsScreen(
         }
     }
 
-    // Derived state for selected contacts and count
-    val selectedContacts =
-        remember(contacts, selectedContactKeys) { contacts.filter { it.contactKey in selectedContactKeys } }
+    // selectedContactKeys is mutated in place, so as a remember key it never changes; read it as state instead.
+    val selectedContacts by
+        remember(contacts) { derivedStateOf { contacts.filter { it.contactKey in selectedContactKeys } } }
     // Get message count directly from repository for selected contacts
     var selectedCount by remember { mutableIntStateOf(0) }
     LaunchedEffect(selectedContactKeys.size, selectedContactKeys.joinToString(",")) {
```

**File**: `feature/messaging/src/commonTest/kotlin/org/meshtastic/feature/messaging/ui/contact/ContactsSelectionToolbarTest.kt` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+/*
+ * Copyright (c) 2026 Meshtastic LLC
+ *
+ * This program is free software: you can redistribute it and/or modify
+ * it under the terms of the GNU General Public License as published by
+ * the Free Software Foundation, either version 3 of the License, or
+ * (at your option) any later version.
+ *
+ * This program is distributed in the hope that it will be useful,
+ * but WITHOUT ANY WARRANTY; without even the implied warranty of
+ * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
+ * GNU General Public License for more details.
+ *
+ * You should have received a copy of the GNU General Public License
+ * along with this program.  If not, see <https://www.gnu.org/licenses/>.
+ */
+package org.meshtastic.feature.messaging.ui.contact
+
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.ui.test.ComposeUiTest
+import androidx.compose.ui.test.ExperimentalTestApi
+import androidx.compose.ui.test.longClick
+import androidx.compose.ui.test.onNodeWithContentDescription
+import androidx.compose.ui.test.onNodeWithText
+import androidx.compose.ui.test.performClick
+import androidx.compose.ui.test.performTouchInput
+import androidx.compose.ui.test.v2.runComposeUiTest
+import androidx.lifecycle.SavedStateHandle
+import dev.mokkery.MockMode
+import dev.mokkery.answering.calls
+import dev.mokkery.answering.returns
+import dev.mokkery.every
+import dev.mokkery.everySuspend
+import dev.mokkery.matcher.any
+import dev.mokkery.mock
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.update
+import kotlinx.coroutines.test.UnconfinedTestDispatcher
+import kotlinx.coroutines.test.resetMain
+import kotlinx.coroutines.test.setMain
+import org.meshtastic.core.model.ConnectionState
+import org.meshtastic.core.model.ContactKey
+import org.meshtastic.core.model.ContactSettings
+import org.meshtastic.core.repository.ConnectionStateProvider
+import org.meshtastic.core.repository.PacketRepository
+import org.meshtastic.core.repository.RadioConfigRepository
+import org.meshtastic.core.testing.FakeNodeRepository
+import org.meshtastic.core.testing.TestDataFactory
+import org.meshtastic.core.ui.util.SnackbarManager
+import org.meshtastic.proto.ChannelSet
+import org.meshtastic.proto.ChannelSettings
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+/**
+ * The toolbar derives pin and mute state from the conversations currently selected, so it has to follow the selection
+ * as rows are long-pressed rather than the list as it stood when the selection was last empty.
+ */
+@OptIn(ExperimentalTestApi::class, ExperimentalCoroutinesApi::class)
+class ContactsSelectionToolbarTest {
+
+    private val channelKey = ContactKey.broadcast(0).value
+    private val nodeRepository = FakeNodeRepository()
+    private val packetRepository: PacketRepository = mock(MockMode.autofill)
+    private val radioConfigRepository: RadioConfigRepository = mock(MockMode.autofill)
+    private val connectionStateProvider: ConnectionStateProvider = mock(MockMode.autofill)
+    private val pinWrites = MutableStateFlow(emptyList<Boolean>())
+
+    @BeforeTest
+    fun setUp() {
+        Dispatchers.setMain(UnconfinedTestDispatcher())
+        nodeRepository.setMyNodeInfo(TestDataFactory.createMyNodeInfo())
+        every { connectionStateProvider.connectionState } returns MutableStateFlow(ConnectionState.Disconnected)
+        every { packetRepository.getUnreadCountTotal() } returns MutableStateFlow(0)
+        every { packetRepository.getContacts() } returns MutableStateFlow(emptyMap())
+        every { radioConfigRepository.channelSetFlow } returns
+            MutableStateFlow(
+                ChannelSet.Builder().settings(listOf(ChannelSettings.Builder().name(CHANNEL_NAME).build())).build(),
+            )
+        everySuspend { packetR
```

---

### Incident Patch 5: `25d923bd` (2026-09-30)
**Commit Message**: fix(firmware): show the percent while a maintenance UF2 downloads (#7485)

**File**: `feature/firmware/src/commonMain/kotlin/org/meshtastic/feature/firmware/UsbUpdateSupport.kt` (modified, +1/-0)
```diff
@@ -302,6 +302,7 @@ internal class UsbPassWriter(
                                     ProgressState(
                                         message = UiText.DynamicString(downloadingMsg),
                                         progress = progress,
+                                        details = formatTransferPercent(progress),
                                     ),
                                 ),
                             )
```

**File**: `feature/firmware/src/commonTest/kotlin/org/meshtastic/feature/firmware/CommonUsbPassWriterTest.kt` (modified, +18/-1)
```diff
@@ -23,6 +23,9 @@ import org.meshtastic.core.model.DeviceHardware
 import org.meshtastic.core.model.MaintenanceUf2Manifest
 import org.meshtastic.core.model.SoftDeviceVariant
 import org.meshtastic.core.repository.MaintenanceUf2Repository
+import org.meshtastic.core.resources.Res
+import org.meshtastic.core.resources.UiText
+import org.meshtastic.core.resources.firmware_update_transfer_percent
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertTrue
@@ -109,7 +112,8 @@ abstract class CommonUsbPassWriterTest {
             UsbPassWriter(
                 fileHandler = WritableVolume(info),
                 maintenanceUf2Repository = FixedManifest(manifest),
-                retrieveMaintenanceUf2 = { asset, _ ->
+                retrieveMaintenanceUf2 = { asset, onProgress ->
+                    onProgress(0.5f)
                     written += asset.fileName
                     FirmwareArtifact(uri = CommonUri.parse("file:///tmp/${asset.fileName}"), fileName = asset.fileName)
                 },
@@ -136,6 +140,19 @@ abstract class CommonUsbPassWriterTest {
         assertEquals(1, h.unblockCalls.size, "The sketch blocks on while(!Serial) until DTR is asserted")
     }
 
+    @Test
+    fun `the maintenance image download shows its percent`() = runTest {
+        val h = harness(sketchInfo)
+        val states = mutableListOf<FirmwareUpdateState>()
+
+        h.writer.write(erasePass, treeUri, rak) { states += it }
+
+        assertEquals(
+            listOf<UiText?>(UiText.Resource(Res.string.firmware_update_transfer_percent, 50)),
+            states.filterIsInstance<FirmwareUpdateState.Downloading>().map { it.progressState.details },
+        )
+    }
+
     @Test
     fun `the bootloader erase image never has its cdc port opened`() = runTest {
         // After the bootloader consumes the block the only CDC port present is the bootloader's own; opening it would
```

---

### Incident Patch 6: `c925ef87` (2026-09-30)
**Commit Message**: fix(ble): export the bond wait receiver so bond broadcasts reach it (#7484)

**File**: `core/ble/src/androidHostTest/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepositoryBondTest.kt` (modified, +25/-0)
```diff
@@ -17,6 +17,7 @@
 package org.meshtastic.core.ble
 
 import android.bluetooth.BluetoothDevice
+import android.content.Context
 import androidx.lifecycle.Lifecycle
 import androidx.lifecycle.LifecycleOwner
 import androidx.lifecycle.LifecycleRegistry
@@ -408,6 +409,30 @@ class AndroidBluetoothRepositoryBondTest {
         assertFalse(repo.isBonded(otherMac))
     }
 
+    @Test
+    fun `every bond receiver is exported so the Bluetooth app can reach it`() = runTest(UnconfinedTestDispatcher()) {
+        val mac = "AA:BB:CC:DD:EE:12"
+        RobolectricBleBonding.grantBluetoothConnectPermission()
+        RobolectricBleBonding.primeBond(mac, bondState = BluetoothDevice.BOND_NONE, createBondReturns = true)
+        val repo = newRepository(UnconfinedTestDispatcher(testScheduler))
+
+        val failure = launchBond(repo, mac)
+        // The parked bond's wait receiver and the bond event log both listen while bond() waits.
+        val bondReceivers =
+            shadowOf(RuntimeEnvironment.getApplication()).registeredReceivers.filter {
+                it.intentFilter.hasAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
+            }
+        assertEquals(2, bondReceivers.size)
+        assertTrue(bondReceivers.all { (it.flags and Context.RECEIVER_EXPORTED) == Context.RECEIVER_EXPORTED })
+
+        RobolectricBleBonding.sendBondStateChanged(
+            mac,
+            newState = BluetoothDevice.BOND_BONDED,
+            previousState = BluetoothDevice.BOND_BONDING,
+        )
+        assertNull(failure.await())
+    }
+
     @Test
     fun `isValid accepts a well-formed MAC and rejects garbage`() = runTest(UnconfinedTestDispatcher()) {
         val repo = newRepository(UnconfinedTestDispatcher(testScheduler))
```

**File**: `core/ble/src/androidMain/kotlin/org/meshtastic/core/ble/AndroidBluetoothRepository.kt` (modified, +3/-1)
```diff
@@ -115,7 +115,9 @@ class AndroidBluetoothRepository(
 
                     val filter =
                         android.content.IntentFilter(android.bluetooth.BluetoothDevice.ACTION_BOND_STATE_CHANGED)
-                    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
+                    // The Bluetooth app sends this under its own uid, which a NOT_EXPORTED receiver refuses. It is a
+                    // protected broadcast, so exporting admits no other sender.
+                    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
 
                     try {
                         val start = startOrObserveBond(remoteDevice, result)
```

---

### Incident Patch 7: `4763623b` (2026-09-30)
**Commit Message**: chore: say kmpSmokeCompile builds device-test APKs, fix cleanup log tag (#7482)

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ Meshtastic-Android uses unit tests, Robolectric JVM tests, and instrumented UI t
 - Ensure all tests pass by running:
   - `./gradlew test` for unit and Robolectric tests (pure-Android modules)
   - `./gradlew allTests` for KMP module tests (`core:*`, `feature:*`) — neither `test` nor `allTests` alone is sufficient; both must pass.
-  - `./gradlew kmpSmokeCompile` when touching any KMP module — compiles the non-Android targets the unit tests don't cover
+  - `./gradlew kmpSmokeCompile` when touching any KMP module, to compile the non-Android targets the unit tests don't cover and assemble the device-test APKs
   - `./gradlew connectedAndroidTest` for instrumented tests
 - For UI components, write Robolectric Compose tests where possible for faster execution.
 - If your change is difficult to test, explain why in your pull request.
```

**File**: `build-logic/convention/src/main/kotlin/RootConventionPlugin.kt` (modified, +2/-2)
```diff
@@ -53,15 +53,15 @@ class RootConventionPlugin : Plugin<Project> {
 
 /**
  * Registers a `kmpSmokeCompile` lifecycle task that depends on `compileKotlinJvm` and `compileKotlinIosSimulatorArm64`
- * tasks from all KMP modules using task path strings.
+ * tasks from all KMP modules, plus `assembleAndroidDeviceTest` for [DEVICE_TEST_MODULES], using task path strings.
  *
  * Non-KMP modules simply won't have these tasks, so the path-based dependencies will be silently ignored.
  */
 private fun Project.registerKmpSmokeCompileTask() {
     val kmp = kmpModules()
     tasks.register("kmpSmokeCompile") {
         group = "verification"
-        description = "Compile all KMP modules for JVM and iOS Simulator ARM64 targets."
+        description = "Compile all KMP modules for JVM and iOS Simulator ARM64, and assemble the device-test APKs."
 
         kmp.forEach { path ->
             dependsOn("$path:compileKotlinJvm")
```

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KableBleConnection.kt` (modified, +3/-3)
```diff
@@ -154,7 +154,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         // _deviceFlow.emit() is intentionally outside this block — making it
         // non-cancellable could hang teardown on a slow collector.
         withContext(NonCancellable) {
-            cleanUpPeripheral(device)
+            cleanUpPeripheral()
             peripheral = p
             ActiveBleConnection.active = ActiveConnection(p, device.address)
         }
@@ -312,8 +312,8 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
     override fun invalidateServiceCache(): Boolean = peripheral?.refreshGattCache() == true
 
     /** Ensures the previous peripheral's GATT resources are fully released. */
-    private suspend fun cleanUpPeripheral(device: BleDevice) {
-        withContext(NonCancellable) { safeClosePeripheral(device.address.anonymize()) }
+    private suspend fun cleanUpPeripheral() {
+        withContext(NonCancellable) { safeClosePeripheral("replace") }
     }
 
     /**
```

**File**: `docs/en/developer/codebase.md` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ block rather than assuming a plugin does or does not exist.
 ### Key Gradle Tasks
 
 ```shell
-# Compile check of every KMP module for JVM and iosSimulatorArm64 (excludes :desktopApp)
+# Compile check of every KMP module for JVM and iosSimulatorArm64 (excludes :desktopApp), plus the device-test APKs
 ./gradlew kmpSmokeCompile
 
 # Run all tests: allTests covers KMP modules, test covers Android/JVM-only modules; run both
```

---

### Incident Patch 8: `364fd9d9` (2026-09-30)
**Commit Message**: fix: audit leftovers (neighbor-info interval unit, shared constants) (#7481)

**File**: `.skills/testing-ci/SKILL.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ The tiers are named here and the workflows carry the label versions.
 - `org.gradle.isolated-projects=true` for better parallelism
 
 ### CI Conventions
-- **KMP Smoke Compile:** `./gradlew kmpSmokeCompile` is a lifecycle task (registered in `RootConventionPlugin`) that depends on `compileKotlinJvm` + `compileKotlinIosSimulatorArm64` for every KMP module in the hand-maintained `ALL_MODULES_FULL` list, plus `compileAndroidDeviceTest` for `:core:database` and `:core:model`. `scripts/check-module-list.py` fails the PR when that list drifts from `settings.gradle.kts`. CI runs it in `shard-core`.
+- **KMP Smoke Compile:** `./gradlew kmpSmokeCompile` is a lifecycle task (registered in `RootConventionPlugin`) that depends on `compileKotlinJvm` + `compileKotlinIosSimulatorArm64` for every KMP module in the hand-maintained `ALL_MODULES_FULL` list, plus `assembleAndroidDeviceTest` for `:core:database` and `:core:model`, so a device-test APK that fails to dex or package fails here. `scripts/check-module-list.py` fails the PR when that list drifts from `settings.gradle.kts`. CI runs it in `shard-core`.
 - **Kotlin warnings fail the test shards:** they pass `-PwarningsAsErrors=true`, which sets `allWarningsAsErrors` on every Kotlin compilation (`KotlinAndroid.kt`, plus `desktopApp` and `schema-strings`). The shards don't run the `compile*MainKotlinMetadata` tasks, so a warning only those report doesn't fail CI (today they warn about duplicate KLIB names). Reproduce locally with the same flag on the compile or test tasks you touched.
 - **`maxParallelForks` CI logic:** `ProjectExtensions.kt` reads the `ci` Gradle property (`providers.gradleProperty("ci")`) and uses full available processors in CI (4 forks on std runners) vs. half locally. All CI invocations pass `-Pci=true`.
 - **Detekt report formats:** Detekt.kt checks `project.findProperty("ci") == "true"` and disables html, txt, md reports in CI; only xml + sarif are retained for GitHub annotations.
```

**File**: `androidApp/src/google/kotlin/org/meshtastic/app/map/offline/pmtiles/OfflineRegionExtractor.kt` (modified, +2/-2)
```diff
@@ -28,6 +28,7 @@ import kotlinx.coroutines.flow.flowOn
 import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
 import org.meshtastic.core.common.util.ioDispatcher
+import org.meshtastic.core.common.util.nowSeconds
 import java.io.IOException
 import java.util.zip.GZIPInputStream
 import kotlin.uuid.Uuid
@@ -121,7 +122,7 @@ internal class OfflineRegionExtractor(private val store: OfflineRegionStore) {
                         maxZoom = zoomRange.last,
                         tileCount = tiles.size.toLong(),
                         byteSize = archiveFile.length(),
-                        createdAtEpochSeconds = System.currentTimeMillis() / MILLIS_PER_SECOND,
+                        createdAtEpochSeconds = nowSeconds,
                     )
                         .also { store.add(it) }
                 } catch (e: IOException) {
@@ -171,7 +172,6 @@ internal class OfflineRegionExtractor(private val store: OfflineRegionStore) {
         const val MAX_REGIONS = 10
         const val MAX_TOTAL_BYTES = 300L * 1024 * 1024
         private const val PROGRESS_STRIDE = 10
-        private const val MILLIS_PER_SECOND = 1_000L
 
         /** Both the Protomaps build and the MVT layers it packages (OpenStreetMap) require attribution. */
         const val ATTRIBUTION = "© OpenStreetMap contributors, © Protomaps"
```

**File**: `build-logic/convention/src/main/kotlin/RootConventionPlugin.kt` (modified, +4/-4)
```diff
@@ -68,13 +68,13 @@ private fun Project.registerKmpSmokeCompileTask() {
             dependsOn("$path:compileKotlinIosSimulatorArm64")
         }
 
-        // Compile androidDeviceTest sources so instrumented test breakages are caught early.
-        // These tests require a device/emulator to *run*, but compilation alone is cheap.
-        DEVICE_TEST_MODULES.forEach { path -> dependsOn("$path:compileAndroidDeviceTest") }
+        // Assemble, not just compile, the androidDeviceTest APKs: dexing and packaging failures only show up there.
+        // Running them still needs a device.
+        DEVICE_TEST_MODULES.forEach { path -> dependsOn("$path:assembleAndroidDeviceTest") }
     }
 }
 
-/** KMP modules that declare `withDeviceTest {}` and therefore have `compileAndroidDeviceTest` tasks. */
+/** KMP modules that declare `withDeviceTest {}` and therefore have `assembleAndroidDeviceTest` tasks. */
 private val DEVICE_TEST_MODULES = listOf(":core:database", ":core:model")
 
 /**
```

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KableBleConnection.kt` (modified, +3/-3)
```diff
@@ -154,7 +154,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         // _deviceFlow.emit() is intentionally outside this block — making it
         // non-cancellable could hang teardown on a slow collector.
         withContext(NonCancellable) {
-            cleanUpPeripheral(tag = device.address.anonymize())
+            cleanUpPeripheral(device)
             peripheral = p
             ActiveBleConnection.active = ActiveConnection(p, device.address)
         }
@@ -312,8 +312,8 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
     override fun invalidateServiceCache(): Boolean = peripheral?.refreshGattCache() == true
 
     /** Ensures the previous peripheral's GATT resources are fully released. */
-    private suspend fun cleanUpPeripheral(tag: String) {
-        withContext(NonCancellable) { safeClosePeripheral(tag) }
+    private suspend fun cleanUpPeripheral(device: BleDevice) {
+        withContext(NonCancellable) { safeClosePeripheral(device.address.anonymize()) }
     }
 
     /**
```

**File**: `core/data/src/commonMain/kotlin/org/meshtastic/core/data/manager/CommandSenderImpl.kt` (modified, +1/-2)
```diff
@@ -66,7 +66,6 @@ import org.meshtastic.proto.Telemetry
 import org.meshtastic.proto.ToRadio
 import kotlin.math.absoluteValue
 import kotlin.random.Random
-import kotlin.time.Duration.Companion.hours
 import org.meshtastic.proto.Position as ProtoPosition
 
 @Suppress("TooManyFunctions", "CyclomaticComplexMethod", "LongParameterList")
@@ -435,7 +434,7 @@ class CommandSenderImpl(
                 val neighborInfoToSend =
                     neighborInfoHandler.lastNeighborInfo
                         ?: run {
-                            val oneHour = 1.hours.inWholeMinutes.toInt()
+                            val oneHour = TimeConstants.SECONDS_PER_HOUR
                             Logger.d { "No stored neighbor info from connected radio, sending dummy data" }
                             NeighborInfo.Builder()
                                 .also { wb ->
```

---

### Incident Patch 9: `3bb9c7f2` (2026-09-30)
**Commit Message**: fix(ble): keep device addresses out of logs (#7478)

**File**: `core/ble/src/commonMain/kotlin/org/meshtastic/core/ble/KableBleConnection.kt` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ class KableBleConnection(private val scope: CoroutineScope, private val loggingC
         // _deviceFlow.emit() is intentionally outside this block — making it
         // non-cancellable could hang teardown on a slow collector.
         withContext(NonCancellable) {
-            cleanUpPeripheral(device.address)
+            cleanUpPeripheral(tag = device.address.anonymize())
             peripheral = p
             ActiveBleConnection.active = ActiveConnection(p, device.address)
         }
```

**File**: `core/konsist/src/jvmTest/kotlin/org/meshtastic/core/konsist/BleAddressLoggingTest.kt` (modified, +90/-34)
```diff
@@ -17,6 +17,7 @@
 package org.meshtastic.core.konsist
 
 import com.lemonappdev.konsist.api.Konsist
+import com.lemonappdev.konsist.api.declaration.KoFileDeclaration
 import kotlin.test.Test
 import kotlin.test.assertTrue
 
@@ -25,9 +26,9 @@ import kotlin.test.assertTrue
  * Datadog and Crashlytics on analytics the user is opted into by default. So an address must never be interpolated into
  * log or exception text raw — it goes through `Any?.anonymize()`, which keeps only a short suffix.
  *
- * This is enforced as an architecture rule rather than by review because the failure mode is missing a site: a previous
- * attempt anonymised the hand-written log statements in `core/ble` and missed the Kable `identifier`, which stamps the
- * address onto *every* line the BLE library emits, plus further sites in the DFU transports and WiFi provisioning.
+ * This is an architecture rule rather than a review item because the failure mode is a missed site, and the easiest
+ * sites to miss reach the log indirectly: a Kable logging `identifier`, which stamps the address onto every line the
+ * BLE library emits, or a `tag` that a helper such as `retryBleOperation` prefixes to its own lines.
  *
  * Scoped to the BLE-adjacent modules so matching on the `address` suffix stays low-noise. That scope includes the
  * transport modules, so TCP hosts go through `anonymizePublicHost()`, which keeps a host on the user's own network
@@ -43,6 +44,7 @@ class BleAddressLoggingTest {
             "/feature/firmware/",
             "/feature/wifi-provision/",
             "/feature/connections/",
+            "/feature/discovery/",
             "/androidApp/",
             "/desktopApp/",
         )
@@ -55,12 +57,29 @@ class BleAddressLoggingTest {
 
     /**
      * Files whose `address` names hardware, not a person. The Android serial transport's address is the USB
-     * vendor-product pair (`usbSerialStableKey()`), which identifies the chip model.
+     * vendor-product pair (`usbSerialStableKey()`), which identifies the chip model, and the firmware retriever's are
+     * UF2 flash offsets.
      */
-    private val notPersonalAddressFiles = listOf("SerialRadioTransport.kt")
+    private val notPersonalAddressFiles = listOf("SerialRadioTransport.kt", "FirmwareRetriever.kt")
 
-    /** Interpolation of anything ending in `address`, e.g. `${device.address}` or `$address`. */
-    private val interpolatedAddress = Regex("""\$\{?[A-Za-z0-9_.]*[aA]ddress}?""")
+    /**
+     * Start of a call whose text reaches a log or a crash report. A `Logger.withTag(...)` prefix is part of the start.
+     */
+    private val diagnosticCallStart =
+        Regex(
+            """Logger(\.withTag\([^)]*\))?\.\w+|\bthrow\s+\w+\s*\(|""" +
+                """\b(error|check|require|checkNotNull|requireNotNull|println)\s*\(""",
+        )
+
+    /** A string template entry, `${...}` or `$name`. */
+    private val interpolation = Regex("""\$\{[^}]*}|\$[A-Za-z_]\w*""")
+
+    private val addressReference = Regex("""[aA]ddress\b""")
+
+    /** A named log-tag argument such as `tag = address` or Kable's `identifier = ...`, or a `withTag(...)` argument. */
+    private val logTagArgument = Regex("""\b(tag|logTag|identifier)\s*=(?!=)\s*([^,)\n]*)|withTag\(([^)\n]*)\)""")
+
+    private val stringLiteral = Regex("\"(?:\\\\.|[^\"\\\\])*\"")
 
     /**
      * Files this rule covers.
@@ -80,7 +99,14 @@ class BleAddressLoggingTest {
         val paths = scannedFiles().map { it.scanPath }
 
         assertTrue(paths.isNotEmpty(), emptyScanMessage("BLE-scoped scan"))
-        for (file in listOf("KableBleConnection.kt", "BleRadioTransport.kt", "SharedRadioInterfaceService.kt")) {
+        val expected =
+            listOf(
+                "KableBleConnection.kt",
+                "BleRadioTransport.kt",
+                "SharedRadioInterfaceService.kt",
+                "DiscoveryScanEngine.kt",
+            )
+        for (file in expected) {
             assertTrue(
        
```

**File**: `core/network/src/commonMain/kotlin/org/meshtastic/core/network/radio/BleRadioTransport.kt` (modified, +2/-2)
```diff
@@ -554,7 +554,7 @@ class BleRadioTransport(
     private suspend fun onConnected() {
         try {
             bleConnection.deviceFlow.first()?.let { device ->
-                val rssi = retryBleOperation(tag = address) { device.readRssi() }
+                val rssi = retryBleOperation(tag = address.anonymize()) { device.readRssi() }
                 Logger.d {
                     "[${address.anonymize()}] Connection confirmed. " +
                         "Initial RSSI: ${rssi?.let { "$it dBm" } ?: "unknown"}"
@@ -805,7 +805,7 @@ class BleRadioTransport(
 
     private suspend fun writePacket(session: BleSession, packet: ByteArray) {
         try {
-            retryBleOperation(tag = address, retryWhile = { activeSession.value === session }) {
+            retryBleOperation(tag = address.anonymize(), retryWhile = { activeSession.value === session }) {
                 session.profile.sendToRadio(packet)
             }
             val sent = packetsSent.incrementAndGet()
```

**File**: `core/network/src/commonTest/kotlin/org/meshtastic/core/network/radio/BleRadioTransportTest.kt` (modified, +24/-0)
```diff
@@ -44,6 +44,7 @@ import org.meshtastic.core.ble.MeshtasticBleConstants.FROMRADIO_CHARACTERISTIC
 import org.meshtastic.core.ble.MeshtasticBleConstants.SERVICE_UUID
 import org.meshtastic.core.model.RadioNotConnectedException
 import org.meshtastic.core.repository.RadioInterfaceService
+import org.meshtastic.core.testing.CapturingLogWriter
 import org.meshtastic.core.testing.FakeBleConnection
 import org.meshtastic.core.testing.FakeBleConnectionFactory
 import org.meshtastic.core.testing.FakeBleDevice
@@ -195,6 +196,29 @@ class BleRadioTransportTest {
         }
     }
 
+    @Test
+    fun `a retried BLE write failure logs the device address only in anonymized form`() = runTest {
+        val device = FakeBleDevice(address = address, name = "Test Device")
+        bluetoothRepository.bond(device)
+        scanner.emitDevice(device)
+        val logs = CapturingLogWriter.install()
+        val bleTransport = bleTransportOn(this, FakeRadioInterfaceService())
+        bleTransport.start()
+
+        try {
+            advanceTimeBy(4_000L)
+            connection.service.writeException = RuntimeException("write rejected")
+            assertTrue(bleTransport.handleSendToRadio(byteArrayOf(1, 2, 3)))
+            advanceTimeBy(1_000L)
+
+            assertTrue(logs.messages().any { "BLE operation failed" in it }, "the write retry path must have logged")
+            logs.assertNotLogged(address)
+        } finally {
+            bleTransport.close()
+            CapturingLogWriter.uninstall()
+        }
+    }
+
     @Test
     fun `close drains every write admitted by the active BLE profile generation`() = runTest {
         val device = FakeBleDevice(address = address, name = "Test Device")
```

**File**: `feature/discovery/src/commonMain/kotlin/org/meshtastic/feature/discovery/DiscoveryScanEngine.kt` (modified, +3/-2)
```diff
@@ -52,6 +52,7 @@ import org.meshtastic.core.model.ChannelOption
 import org.meshtastic.core.model.ConnectionState
 import org.meshtastic.core.model.DataPacket
 import org.meshtastic.core.model.numChannels
+import org.meshtastic.core.model.util.anonymize
 import org.meshtastic.core.model.util.decodeOrNull
 import org.meshtastic.core.model.util.snrOrNull
 import org.meshtastic.core.repository.DiscoveryPacketCollector
@@ -773,8 +774,8 @@ class DiscoveryScanEngine(
             // A null return means this device's session row is not in the active database and the dwell is unwritable.
             if (discoveryDao.insertDwellIfSessionExists(result, discoveredNodeEntities(), deviceAddress) == null) {
                 Logger.w {
-                    "DiscoveryScanEngine: session $sessionId for $deviceAddress is not in the active database; " +
-                        "skipping dwell persistence"
+                    "DiscoveryScanEngine: session $sessionId for ${deviceAddress.anonymize()} is not in the active " +
+                        "database; skipping dwell persistence"
                 }
                 return@withLock
             }
```

---

### Incident Patch 10: `1bd94127` (2026-09-30)
**Commit Message**: fix(ui): show transfer rates and file limits in decimal units (#7476)

**File**: `.skills/compose-ui/strings-index.txt` (modified, +2/-0)
```diff
@@ -716,6 +716,8 @@ firmware_update_success_wiped
 firmware_update_taking_a_while
 firmware_update_target
 firmware_update_title
+firmware_update_transfer_percent
+firmware_update_transfer_progress
 firmware_update_unknown_error
 firmware_update_unknown_hardware
 firmware_update_unknown_release
```

**File**: `androidApp/src/main/kotlin/org/meshtastic/app/SharedMapFile.kt` (modified, +5/-3)
```diff
@@ -56,9 +56,11 @@ internal enum class SharedMapFileRejection {
     UNREADABLE,
 }
 
-/** No bigger than the most the KMZ reader will inflate, so a larger file could never be read whole anyway. */
-internal const val MAX_SHARED_MAP_FILE_BYTES: Long = MAX_KMZ_INFLATED_BYTES
-internal const val MAX_SHARED_MAP_FILE_MB = (MAX_SHARED_MAP_FILE_BYTES / (1024L * 1024L)).toInt()
+/** The limit the refusal names, in decimal megabytes: the cap is exactly this many million bytes. */
+internal const val MAX_SHARED_MAP_FILE_MB = 50
+
+/** At most [MAX_KMZ_INFLATED_BYTES], the most the KMZ reader will inflate: a larger file could never be read whole. */
+internal const val MAX_SHARED_MAP_FILE_BYTES: Long = MAX_SHARED_MAP_FILE_MB * 1_000_000L
 
 private val SHAREABLE_LAYER_TYPES = setOf(LayerType.KML, LayerType.GEOJSON)
 
```

**File**: `androidApp/src/test/kotlin/org/meshtastic/app/SharedMapFileTest.kt` (modified, +16/-0)
```diff
@@ -29,6 +29,7 @@ import androidx.test.core.app.ApplicationProvider
 import org.junit.Rule
 import org.junit.rules.TemporaryFolder
 import org.junit.runner.RunWith
+import org.meshtastic.feature.map.layers.MAX_KMZ_INFLATED_BYTES
 import org.robolectric.Robolectric
 import org.robolectric.RobolectricTestRunner
 import java.io.ByteArrayInputStream
@@ -39,6 +40,7 @@ import kotlin.test.assertEquals
 import kotlin.test.assertIs
 import kotlin.test.assertNotNull
 import kotlin.test.assertNull
+import kotlin.test.assertTrue
 
 @RunWith(RobolectricTestRunner::class)
 class SharedMapFileTest {
@@ -114,6 +116,20 @@ class SharedMapFileTest {
         assertNull(shared("route.kml", size = 0).rejection(maxBytes = 100))
     }
 
+    @Test
+    fun `the default cap is the named limit in decimal megabytes`() {
+        assertNull(shared("route.kml", size = MAX_SHARED_MAP_FILE_MB * 1_000_000L).rejection())
+        assertEquals(
+            SharedMapFileRejection.TOO_LARGE,
+            shared("route.kml", size = MAX_SHARED_MAP_FILE_MB * 1_000_000L + 1).rejection(),
+        )
+    }
+
+    @Test
+    fun `the default cap never exceeds what the KMZ reader will inflate`() {
+        assertTrue(MAX_SHARED_MAP_FILE_BYTES <= MAX_KMZ_INFLATED_BYTES)
+    }
+
     @Test
     fun `a file of unknown size is left to the capped read`() {
         assertNull(shared("route.kml", size = null).rejection(maxBytes = 100))
```

**File**: `core/resources/src/commonMain/composeResources/values/strings.xml` (modified, +2/-0)
```diff
@@ -752,6 +752,8 @@
     <string name="firmware_update_taking_a_while">This might take a minute...</string>
     <string name="firmware_update_target">Target: %1$s</string>
     <string name="firmware_update_title">Firmware Update</string>
+    <string name="firmware_update_transfer_percent">%1$d%</string>
+    <string name="firmware_update_transfer_progress">%1$d% (%2$s/s, ETA: %3$ds)</string>
     <string name="firmware_update_unknown_error">Unknown error</string>
     <string name="firmware_update_unknown_hardware">Unknown hardware model: %1$d</string>
     <string name="firmware_update_unknown_release">Unknown remote release</string>
```

**File**: `feature/firmware/src/commonMain/kotlin/org/meshtastic/feature/firmware/FirmwareUpdateScreen.kt` (modified, +1/-1)
```diff
@@ -1128,7 +1128,7 @@ private fun ProgressContent(
         if (details != null) {
             Spacer(Modifier.height(4.dp))
             Text(
-                text = details,
+                text = details.asString(),
                 style = MaterialTheme.typography.bodySmall,
                 color = MaterialTheme.colorScheme.onSurfaceVariant,
                 textAlign = TextAlign.Center,
```

#### Recent Merged Pull Requests:
- **PR #7510** (2026-09-30): chore(deps): update org.meshtastic:protobufs to v2.8.0.134-gd26808c-snapshot (@renovate[bot])
- **PR #7509** (2026-09-30): docs: update CHANGELOG.md (@jamesarich)
- **PR #7508** (2026-09-30): test(data): cover stalled session normalization racing a newer session (@jamesarich)
- **PR #7507** (2026-09-30): feat(notifications): post reactions on their own channel (@jamesarich)
- **PR #7506** (2026-09-30): feat(desktop): add draggable scrollbars to node and message lists (@jamesarich)
- **PR #7505** (2026-09-30): fix(metrics): break power chart lines across gaps in readings (@jamesarich)
- **PR #7504** (2026-09-30): feat(admin): add Reboot into DFU mode admin action for nRF52 nodes (@jamesarich)
- **PR #7503** (2026-09-30): chore: Scheduled updates (Firmware, Hardware, Translations) (@jamesarich)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
