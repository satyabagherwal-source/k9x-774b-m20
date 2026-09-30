# Forensic Learning Record (Deep Inspection): open-ani/animeko

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-ani-animeko-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-ani/animeko](https://github.com/open-ani/animeko))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:04.974Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-ani/animeko`
- **Description**: 集找番、追番、看番的一站式弹幕追番平台，云收藏同步 (Bangumi)，离线缓存，BitTorrent，弹幕云过滤。100% Kotlin/Compose Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 20362 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/android-ui-verify/scripts/frame_diff.py`
```
#!/usr/bin/env python3
"""Analyze a UI screen recording for abrupt frame-to-frame changes (transient glitches).

Scans every frame's scene-change score (ffmpeg MAFD-based), groups consecutive
high-score frames into "events", and for each event exports:
  - a contact sheet (frames tiled left-to-right, top-to-bottom) for quick visual scanning
  - the individual full-resolution frames, named with their video timestamps

Both recordings produced by droid.sh/desk.sh are variable-frame-rate: a frame is
only written when the screen actually changed, so *any* frame in the output means
something changed at that moment.

Usage:
  frame_diff.py VIDEO                          # scan + auto-export around every event
  frame_diff.py VIDEO --crop W:H:X:Y           # analyze only a region (video pixels), e.g. a progress bar
  frame_diff.py VIDEO --threshold 0.003        # more sensitive event detection
  frame_diff.py VIDEO --around 3.2 --window 1  # export frames around a specific timestamp only
  frame_diff.py VIDEO --list                   # additionally print every frame's score

Requires ffmpeg/ffprobe on PATH.
"""

import argparse
import math
import os
import re
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def scan_scores(video, crop):
    """Return [(pts_time, scene_score)] for every frame (first frame has no score -> skipped)."""
    vf = []
    if crop:
        vf.append(f"crop={crop}")
    vf.append("select='gte(scene,0)'")
    vf.append("metadata=print")
    p = run(["ffmpeg", "-hide_banner", "-i", video, "-vf", ",".join(vf), "-an", "-f", "null", "-"])
    frames = []
    t = None
    for line in p.stderr.splitlines():
        m = re.search(r"pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
            continue
        m = re.search(r"lavfi\.scene_score=([0-9.eE+-]+)", line)
        if m and t is not None:
            frames.append((t, float(m.group(1))))
            t = None
    if not frames:
        sys.exit(f"no frames scanned — ffmpeg said:\n{p.stderr[-2000:]}")
    return frames


def group_events(frames, threshold, merge_gap=0.5):
    """Group frames with score >= threshold into events; merge events closer than merge_gap seconds."""
    events = []  # each: {"start", "end", "peak_t", "peak_score", "count"}
    for t, s in frames:
        if s < threshold:
            continue
        if events and t - events[-1]["end"] <= merge_gap:
            ev = events[-1]
            ev["end"] = t
            ev["count"] += 1
            if s > ev["peak_score"]:
                ev["peak_score"], ev["peak_t"] = s, t
        else:
            events.append({"start": t, "end": t, "peak_t": t, "peak_score": s, "count": 1})
    return events


def export_window(video, crop, frames, a, b, out_dir, tag):
    """Export a contact sheet + individual full-res frames for pts in [a, b]. Returns report lines."""
    sel = [t for t, _ in frames if a <= t <= b]
    # the scan skips the very first video frame (it has no score); include it if in range
    if not sel:
        return [f"  {tag}: no frames recorded in {a:.2f}s..{b:.2f}s (screen was static)"]

    os.makedirs(out_dir, exist_ok=True)
    base_vf = ([f"crop={crop}"] if crop else []) + [f"select='between(t,{a:.3f},{b:.3f})'"]

    # individual full-res frames
    frame_dir = os.path.join(out_dir, tag)
    os.makedirs(frame_dir, exist_ok=True)
    pattern = os.path.join(frame_dir, "raw_%04d.png")
    p = run(["ffmpeg", "-hide_banner", "-y", "-i", video, "-vf", ",".join(base_vf),
             "-fps_mode", "passthrough", pattern])
    produced = sorted(f for f in os.listdir(frame_dir) if f.startswith("raw_"))
    # rename by timestamp when extraction count matches the scan (off-by-one possible at range edges)
    if len(produced) == len(sel):
        for name, t in zip(produced, sel):
            os.rename(os.path.join(frame_dir, name), os.path.join(frame_dir, f"t{t:07.3f}s.png"))
    lines = [f"      frames: {frame_dir}/  ({len(produced)} files, {a:.2f}s..{b:.2f}s)"]

    # contact sheet: subsample to <= 40 tiles, 5 per row
    n = len(sel)
    step = max(1, math.ceil(n / 40))
    shown = math.ceil(n / step)
    cols = min(5, shown)
    rows = math.ceil(shown / cols)
    sheet = os.path.join(out_dir, f"{tag}_sheet.png")
    vf = base_vf + [f"select='not(mod(n,{step}))'", "scale=360:-1", f"tile={cols}x{rows}"]
    p = run(["ffmpeg", "-hide_banner", "-y", "-i", video, "-vf", ",".join(vf),
             "-frames:v", "1", "-fps_mode", "passthrough", sheet])
    if os.path.exists(sheet):
        lines.insert(0, f"      contact sheet: {sheet}  ({shown} tiles, read L->R T->B, every {step} frame(s))")
    return lines


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--crop", help="W:H:X:Y in video pixels — restrict analysis to a region")
    ap.add_argument("--threshold", type=float, default=0.01,
                    help="scene-score threshold for events (default 0.01; scores are frame-wide means, "
                         "so crop to the region of interest when hunting small-element glitches)")
    ap.add_argument("--around", type=float, help="just export frames around this timestamp (seconds)")
    ap.add_argument("--window", type=float, default=1.0, help="half-window for --around / event export pad")
    ap.add_argument("--out", help="output dir (default <video>-frames/)")
    ap.add_argument("--list", action="store_true", help="print every frame's score")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        sys.exit(f"no such file: {args.video}")
    out_dir = args.out or os.path.splitext(args.video)[0] + "-frames"

    frames = scan_scores(args.video, args.crop)
    scores = [s for _, s in frames]
    dur = frames[-1][0]
    print(f"{len(frames)} frames over {dur:.2f}s  "
          f"(mean score {sum(scores)/len(scores):.4f}, max {max(scores):.4f})"
          + (f"  [crop {args.crop}]" if args.crop else ""))
    print("VFR recording: frames exist only where the screen changed; gaps = static screen.")

    if args.list:
        for t, s in frames:
            bar = "#" * min(60, int(s * 400))
            print(f"  {t:8.3f}s  {s:.4f} {bar}")

    if args.around is not None:
        a, b = max(0.0, args.around - args.window), args.around + args.window
        print(f"\nExporting around t={args.around:.2f}s:")
        for line in export_window(args.video, args.crop, frames, a, b, out_dir, f"t{args.around:.1f}"):
            print(line)
        return

    events = group_events(frames, args.threshold)
    if not events:
        print(f"\nNo events with score >= {args.threshold}. Top frames:")
        for t, s in sorted(frames, key=lambda f: -f[1])[:10]:
            print(f"  {t:8.3f}s  {s:.4f}")
        print("Lower --threshold or --crop to the region of interest to look closer.")
        return

    print(f"\n{len(events)} event(s) with score >= {args.threshold}:")
    for i, ev in enumerate(events, 1):
        print(f"  #{i}  {ev['start']:.2f}s..{ev['end']:.2f}s  "
              f"peak {ev['peak_score']:.4f} @ {ev['peak_t']:.2f}s  ({ev['count']} frames)")
        pad = min(args.window, 0.5)
        for line in export_window(args.video, args.crop, frames,
                                  max(0.0, ev["start"] - pad), ev["end"] + pad, out_dir, f"ev{i}"):
            print(line)
    print("\nJudge events against *expected* changes (your own taps/scrolls/animations); "
          "an event where nothing should have changed — or a change-and-revert pair — is the glitch.")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/android-ui-verify/scripts/ui_tree.py`
```
#!/usr/bin/env python3
"""Render an uiautomator XML dump (the Compose semantics projection) for UI verification.

Default: pretty-print an indented tree of semantic nodes with dp sizes.
--find: print matching nodes (substring of text/content-desc/resource-id) with tap-ready centers.
"""
import argparse
import re
import sys
import xml.etree.ElementTree as ET


def parse_bounds(s):
    m = re.match(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", s or "")
    return tuple(map(int, m.groups())) if m else None


def flags(a):
    out = [k for k in ("clickable", "scrollable", "checked", "selected", "focused", "password") if a.get(k) == "true"]
    if a.get("enabled") == "false":
        out.append("disabled")
    return out


def describe(a, density):
    b = parse_bounds(a.get("bounds"))
    parts = []
    cls = (a.get("class") or "?").rsplit(".", 1)[-1]
    parts.append(cls)
    if a.get("text"):
        parts.append(f"text={a['text']!r}")
    if a.get("content-desc"):
        parts.append(f"desc={a['content-desc']!r}")
    if a.get("resource-id"):
        parts.append(f"id={a['resource-id']}")
    if b:
        x1, y1, x2, y2 = b
        w, h = x2 - x1, y2 - y1
        if density:
            dp = lambda px: round(px * 160 / density)
            parts.append(f"{dp(w)}x{dp(h)}dp@({dp(x1)},{dp(y1)})dp")
        parts.append(f"center=({(x1 + x2) // 2},{(y1 + y2) // 2})px")
    f = flags(a)
    if f:
        parts.append("[" + ",".join(f) + "]")
    return " ".join(parts)


def is_semantic(a):
    return bool(
        a.get("text")
        or a.get("content-desc")
        or a.get("resource-id")
        or a.get("clickable") == "true"
        or a.get("scrollable") == "true"
        or a.get("checked") == "true"
        or a.get("selected") == "true"
        or "EditText" in (a.get("class") or "")
    )


def print_tree(node, density, show_all, depth=0):
    a = node.attrib
    printed = show_all or is_semantic(a)
    if printed and a.get("class"):
        print("  " * depth + "- " + describe(a, density))
    for child in node:
        print_tree(child, density, show_all, depth + 1 if printed else depth)


def find_nodes(root, query, density):
    q = query.lower()
    hits = 0
    for n in root.iter():
        a = n.attrib
        hay = " ".join(a.get(k, "") for k in ("text", "content-desc", "resource-id")).lower()
        if q in hay and parse_bounds(a.get("bounds")):
            print(describe(a, density))
            hits += 1
    if hits == 0:
        print("no match")
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xml")
    ap.add_argument("--density", type=int, default=0, help="screen density for px->dp (px*160/density)")
    ap.add_argument("--find", help="substring of text/content-desc/resource-id")
    ap.add_argument("--all", action="store_true", help="print every node, not only semantic ones")
    args = ap.parse_args()

    root = ET.parse(args.xml).getroot()
    if args.find:
        find_nodes(root, args.find, args.density)
    else:
        for child in root:
            print_tree(child, args.density, args.all)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/desktop-ui-verify/scripts/frame_diff.py`
```
../../android-ui-verify/scripts/frame_diff.py
```

### Core Architecture Module: `tools/tv-remote/tv-remote.py`
```
#!/usr/bin/env python3
# Copyright (C) 2024-2026 OpenAni and contributors.
#
# 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
# Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
#
# https://github.com/open-ani/ani/blob/main/LICENSE
"""
终端 Android TV 遥控器.

没有实体遥控器时用它驱动 TV variant: 键盘按键或鼠标点击面板上的按钮, 通过 adb 发送
keyevent 到设备/模拟器. 长按、文本输入、截图预览都在面板上.

    python3 tools/tv-remote/tv-remote.py            # 自动选设备, 自动认出已装的 TV 包
    python3 tools/tv-remote/tv-remote.py -s <设备号> -p me.him188.ani.tv.debug2

键位见面板底部; q 退出.
"""

from __future__ import annotations

import argparse
import curses
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from dataclasses import dataclass, field


def disp_width(text: str) -> int:
    """终端显示列宽: 东亚全宽字符占 2 列, 其余占 1 列."""
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in text)

# TV 包候选: 本地 debug 构建优先, 其次参考版
DEFAULT_PACKAGES = [
    ("me.him188.ani.tv.debug2", "me.him188.ani.android.tv.MainActivity"),
    ("me.him188.ani.tv", "me.him188.ani.android.tv.MainActivity"),
]

ADB = shutil.which("adb") or f"{__import__('os').path.expanduser('~')}/Library/Android/sdk/platform-tools/adb"


@dataclass
class Button:
    """面板上的一个按钮; row/col 为左上角, 宽高含边框."""

    label: str
    keycode: int | None
    row: int
    col: int
    width: int = 9
    height: int = 3
    hotkey: str = ""
    action: str = ""  # 非 keyevent 的特殊动作
    long_press: bool = False
    flash_until: float = field(default=0.0, compare=False)

    def hit(self, y: int, x: int) -> bool:
        return self.row <= y < self.row + self.height and self.col <= x < self.col + self.width


def build_buttons() -> list[Button]:
    """遥控器布局: D-pad 十字 + 返回/主页 + 媒体键 + 工具键."""
    b: list[Button] = []
    # D-pad (十字, 居中于 col 20)
    b.append(Button("▲", 19, row=3, col=20, hotkey="↑"))
    b.append(Button("◀", 21, row=6, col=11, hotkey="←"))
    b.append(Button("OK", 23, row=6, col=20, hotkey="⏎"))
    b.append(Button("▶", 22, row=6, col=29, hotkey="→"))
    b.append(Button("▼", 20, row=9, col=20, hotkey="↓"))
    # 长按确认 (TV 上常用于收藏菜单)
    b.append(Button("长按OK", 23, row=6, col=39, width=10, hotkey="L", long_press=True))
    # 导航
    b.append(Button("返回", 4, row=13, col=11, hotkey="⌫"))
    b.append(Button("主页", 3, row=13, col=29, hotkey="h"))
    b.append(Button("菜单", 82, row=13, col=20, hotkey="m"))
    # 媒体
    b.append(Button("上一集", 88, row=17, col=11, width=11, hotkey="b"))
    b.append(Button("播/停", 85, row=17, col=23, width=11, hotkey="p"))
    b.append(Button("下一集", 87, row=17, col=35, width=11, hotkey="n"))
    b.append(Button("快退", 89, row=17, col=47, width=9, hotkey="["))
    b.append(Button("快进", 90, row=17, col=57, width=9, hotkey="]"))
    # 音量 / 电源
    b.append(Button("音量-", 25, row=3, col=39, width=10, hotkey="-"))
    b.append(Button("音量+", 24, row=3, col=50, width=10, hotkey="+"))
    b.append(Button("唤醒", 224, row=9, col=39, width=10, hotkey="w"))
    # 工具
    b.append(Button("截图", None, row=21, col=11, width=10, hotkey="s", action="screenshot"))
    b.append(Button("输入文本", None, row=21, col=22, width=12, hotkey="t", action="text"))
    b.append(Button("启动应用", None, row=21, col=35, width=12, hotkey="o", action="launch"))
    b.append(Button("重启应用", None, row=21, col=48, width=12, hotkey="r", action="relaunch"))
    return b


class Remote:
    def __init__(self, serial: str | None, package: str | None, activity: str | None):
        self.serial = serial
        self.package = package
        self.activity = activity
        self.status = "就绪"
        self.last_key = ""
        self.last_ms = 0
        self.buttons = build_buttons()
        self.lock = threading.Lock()

    # ---- adb ----
    def adb(self, *args: str, capture: bool = False, timeout: float = 15) -> str:
        cmd = [ADB]
        if self.serial:
            cmd += ["-s", self.serial]
        cmd += list(args)
        if capture:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return out.stdout.strip()
        subprocess.run(cmd, capture_output=True, timeout=timeout)
        return ""

    def detect_device(self) -> bool:
        out = self.adb("devices", capture=True)
        devices = [
            line.split()[0]
            for line in out.splitlines()[1:]
            if line.strip() and line.split()[-1] == "device"
        ]
        if not devices:
            return False
        if self.serial not in devices:
            self.serial = devices[0]
        return True

    def detect_package(self) -> None:
        if self.package:
            return
        installed = self.adb("shell", "pm", "list", "packages", capture=True)
        for pkg, act in DEFAULT_PACKAGES:
            if f"package:{pkg}" in installed:
                self.package, self.activity = pkg, act
                return
        self.package, self.activity = DEFAULT_PACKAGES[0]

    # ---- 动作 (后台线程, 不卡 UI) ----
    def send_key(self, keycode: int, long_press: bool = False, label: str = "") -> None:
        def run() -> None:
            start = time.time()
            args = ["shell", "input", "keyevent"]
            if long_press:
                args.append("--longpress")
            args.append(str(keycode))
            self.adb(*args)
            with self.lock:
                self.last_key = f"{label or keycode}{' (长按)' if long_press else ''}"
                self.last_ms = int((time.time() - start) * 1000)

        threading.Thread(target=run, daemon=True).start()

    def screenshot(self) -> None:
        def run() -> None:
            path = f"/tmp/tv-remote-{int(time.time())}.png"
            cmd = [ADB]
            if self.serial:
                cmd += ["-s", self.serial]
            cmd += ["exec-out", "screencap", "-p"]
            with open(path, "wb") as f:
                subprocess.run(cmd, stdout=f, timeout=30)
            subprocess.run(["open", path], capture_output=True)
            with self.lock:
                self.status = f"截图 → {path}"

        threading.Thread(target=run, daemon=True).start()

    def send_text(self, text: str) -> None:
        def run() -> None:
            # adb input text 不支持空格与中文: 空格转 %s, 非 ASCII 直接提示
            if any(ord(c) > 127 for c in text):
                with self.lock:
                    self.status = "adb 无法输入非 ASCII 字符 (中文请用设备输入法)"
                return
            self.adb("shell", "input", "text", text.replace(" ", "%s"))
            with self.lock:
                self.status = f"已输入: {text}"

        threading.Thread(target=run, daemon=True).start()

    def launch(self, force_stop: bool = False) -> None:
        def run() -> None:
            args = ["shell", "am", "start"]
            if force_stop:
                args.append("-S")
            args += ["-n", f"{self.package}/{self.activity}"]
            self.adb(*args)
            with self.lock:
                self.status = ("重启" if force_stop else "启动") + f" {self.package}"

        threading.Thread(target=run, daemon=True).start()

    def trigger(self, btn: Button) -> None:
        btn.flash_until = time.time() + 0.16
        if btn.action == "screenshot":
            self.screenshot()
        elif btn.action == "launch":
            self.launch(force_stop=False)
        elif btn.action == "relaunch":
            self.launch(force_stop=True)
        elif btn.action == "text":
            pass  # 由主循环处理 (需要弹输入行)
        elif btn.keycode is not None:
            self.send_key(btn.keycode, btn.long_press, btn.label)


HELP_LINES = [
    "方向键/⏎ = D-pad·确认   ⌫/Esc = 返回   L = 长按确认   h 主页   m 菜单",
    "p 播/停  n 下一集  b 上一集  [ ] 快退/快进   +/- 音量   w 唤醒屏幕",
    "s 截图并预览   t 输入文本(仅 ASCII)   o 启动应用   r 重启应用   q 退出",
]


def draw(stdscr, remote: Remote) -> None:
    stdscr.erase()
    h, w = stdscr.getmaxyx()
    now = time.time()

    title = " Animeko TV 遥控器 "
    stdscr.attron(curses.A_BOLD)
    stdscr.addstr(0, 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3507** (2026-09-30): **fix(player): Android 视频输出移除超时后在原位置重新打开媒体, 修复切换全屏或切到后台后黑屏**
  *Symptoms*: ## 问题  用户反馈 Android 上切换全屏后黑屏 (6.2.0 日志)。日志里有 3 次 `Player rejected the media data`, 根因相同:  ``` org.openani.mediamp.PlaybackException: ExoPlayer playback failed: ERROR_CODE_TIMEOUT (1003)   at ExoPlayerImpl.setVideoOutputInternal   at ExoPlayerImpl$ComponentListener.surfaceDestroyed   at SurfaceView...dispatchDetachedFromWindow   ... Caused by: androidx.media3.exoplayer.ExoTimeoutException: Detaching surface timed out. ```  视频输出 (SurfaceView 的 Surface) 被销毁时, ExoPlayer 在主线程等待播放线程释放旧输出, 超过 `detachSurfaceTimeoutMs` (默认 2 秒) 就以 `ERROR_CODE_TIMEOUT` 停止播放。之后新的 Surface 挂上也不会继续播放, 表现为黑屏。  触发 Surface 销毁的场景:  - **切换全屏**: 进出全屏时播放器的 `AndroidView` 会从组合中移除并重建 (`UiApplier.remove` → `AndroidComposeView.removeAndroidView` → `SurfaceView.onDetachedFromWindow`)。#3466 给 `MainActivity` 加了 `configChanges`, 旋转不再重建 Activity, 但在 main 上每次切换全屏仍会销毁 Surface (模拟器上已确认) - 退到后台、锁屏 (窗口 Surface 销毁) - 6.2.0 中旋转导致的 Activity 重建 (#3466 已解决)  该用户开启了视频增强 (Anime4K), 且「预先加载画质增强着色器」默认开启, 渲染经过 Media3 GL 效果管线, 释放输出更慢, 可能是超时的诱因 (未确证)。  ## 修改  - `LibassExoPlayerMediampPlayer`   - 打开期间视频输出超时: 在同一位置重试打开, 最多 3 次   - 播放中视频输出超时: 通过 `AnalyticsListener` 拿到出错时的播放位置 (它先于 MediaMP 的 listener 收到错误; MediaMP 处理错误时会清空 ExoPlayer 与进度), 在该位置按原 `playWhenReady` 重新打开同一个媒体   - 只处理 `UriMediaData` (WEB / HLS)。`SeekableInputMediaData` (BT、本地文件) 在会话结束时会被 MediaMP 关闭 (`TorrentMediaData.close` 会释放种子文件), 无法原样重新打开, 超时仍作为播放错误上报   - `detachSurfaceTimeoutMs` 放宽到 3 秒。等待期间主线程阻塞, 取值需明显小于 5 秒输入 ANR 阈值 - `RememberPlayProgressExtension`: 同一个 `MediaData` 被重新打开时保留播放

- **Issue #3506** (2026-09-30): **fix(danmaku): 弹弹 play 匹配接口失败时返回 matches=null, 修复弹幕获取抛出反序列化异常**
  *Symptoms*: ## 问题  用户日志 (Android, 6.2.0) 中弹弹 play 弹幕获取连续失败 8 次:  ``` ERROR a.d.d.DanmakuFetcher Failed to fetch danmaku from service 'DanmakuServiceId(value=Dandanplay)' ... at me.him188.ani.danmaku.dandanplay.DandanplayClient$matchVideo$2.invokeSuspend Caused by: kotlinx.serialization.json.JsonDecodingException: Unexpected JSON token at offset 29: Expected start of the array '[', but had 'n' instead at path: $.matches JSON input: {"isMatched":false,"matches":null,"errorCode":2,"success":false,"errorMessage":"一个或多个参数不符合规则"} ```  原因: 前面几种匹配方式都没匹配到时, `DandanplayDanmakuProvider` 最后会调用 `/api/v2/match` 按文件名匹配。接口拒绝请求时返回 `success=false` 且 `matches=null` (接口文档 `MatchResponseV2.matches` 也标注为 nullable), 但 `DandanplayMatchVideoResponse.matches` 声明为非空列表, 反序列化直接抛异常。异常被 `DanmakuFetcher` 捕获后会把整个弹弹 play 获取流程重试一次, 最终仍然只能返回 NoMatch, 并打出 ERROR 日志。  ## 修改  - `DandanplayMatchVideoResponse`: 按接口文档把 `matches`、`errorMessage` 声明为可空; `DandanplayEpisode` (即 `MatchResultV2`) 的 `animeTitle`、`episodeTitle`、`typeDescription` 同样改为可空 - `DandanplayDanmakuProvider`: 文件名匹配返回 `success=false` 时记录 `errorCode`/`errorMessage` 并返回 NoMatch, 不再抛异常; `matches` 为空时同样返回 NoMatch - 新增测试:   - 用日志中的原始 JSON 反序列化 `DandanplayMatchVideoResponse`   - Bangumi 映射与剧集搜索都失败、`/api/v2/match` 返回上述失败响应时, `fetchAutomatic` 返回 NoMatch   - 文件名匹配成功时仍按原逻辑返回 `Fuzzy` 结果  ## 验证  - `./gradlew :danmaku:dandanplay:desktopTest` 通过 (9 个测试, 0 失败) - 回退 `commonMain` 的修改后, 两个新增的失败响应测试均以日志中同样的 `JsonDecodingException ... at path: $.matches` 失败, 恢复修改后通过 - 改动只在 `danmaku/dan

- **Issue #3500** (2026-09-30): **修复sync时全部模块 androidDeviceTest 无法解析 kotlin-test**
  *Symptoms*: Kotlin 2.4 的 `kotlin-test` 改为按 framework capability 区分变体(`kotlin-test-junit5` 等成为 `kotlin-test` 组件的重定向别名),与 KGP 的 IDE 同步专用依赖注入叠加后产生冲突  总而言之 try to fix this: <img width="2560" height="688" alt="photo_2026-08-15_15-02-17" src="https://github.com/user-attachments/assets/ac4ebd3f-bd7b-4e00-b17d-1798ab71f27c" /> 
  **Post-Mortem & Fix Analysis**:
  > @openanibot resolve conflict
  > 已合并最新 main 并解决两处冲突，推送至 9dcfb148ba。main 已包含相同的依赖修复，本 PR 现仅保留相关说明注释，无额外功能或 UI 变更。验证：JDK 21 下 `./gradlew help --console=plain` 通过，相对 main 的 `git diff --check` 通过。

- **Issue #3497** (2026-09-28): **ci: 去掉自托管 Mac 上的 macOS 验证**
  *Symptoms*: `Verify (macOS 15 AArch64 (Self-Hosted))` 与 `Verify (macOS 15 AArch64 (GitHub))` 的系统、架构和检查项都相同, 验证的是同一个 DMG; GitHub 那边还会先删掉系统中的 libssl, 检查更严.  自托管 Mac 是所有 run 共用的瓶颈 (最近 48 小时排队等待中位数 13 分钟, p90 78 分钟). 这个 job 每次占用约 2.5 分钟 (每个 run 在 Mac 上约 18% 的时间), 其中约 2 分钟在下载本机刚上传的 DMG.  合并前已从 ruleset 的 required status checks 中去掉该检查.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #3496** (2026-09-28): **ci: 在自托管 Mac 上运行 arm64 instrumented test**
  *Symptoms*: Android instrumented test 目前只在 x86_64 模拟器上运行. GitHub 托管的 arm64 机器 (Linux 与 macOS) 不提供嵌套虚拟化 ([actions/runner-images#14062](https://github.com/actions/runner-images/issues/14062)), 不能运行有硬件加速的 arm64 模拟器, 因此在自托管的 Apple Silicon Mac (`macmini-m4-32g`) 上运行.  - 新 job `Android Instrumented Test (api=36, arch=arm64-v8a)`: 编译一次测试 APK, 依次在 arm64 手机镜像 (TV 以外的模块) 与 arm64 TV 镜像 (TV 模块) 上运行 API 36. - 只在本仓库 main 与 `release/**` 的 push 上运行. 这台 Mac 还承担所有 run 的 iOS 与 macOS 构建, 高峰时已有多个 job 排队, 不在 PR 上增加负担; 不加入 required checks. - 自托管机器的 SDK 由其他构建共用: 两次运行之间只删除测试结果, 不卸载模拟器与系统镜像; 测试结束后只结束模拟器自己的 `crashpad_handler`. - GitHub 托管的 x86_64 job 不变.  实测 (run 36400489016, 限制触发条件前): job 14.2 分钟 (编译命中缓存 2.5 分钟, 手机镜像 3.5 分钟, TV 镜像 7 分钟), 首次通过. 模拟器为 arm64 (`ro.product.cpu.abilist=arm64-v8a`), 测试数与 x86_64 相同: 手机 2440 个、TV 207 个.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #3492** (2026-09-28): **ci: instrumented test 与构建并行, 去掉重复的 push 构建, 修复不稳定的测试**
  *Symptoms*: Ubuntu 构建 job 此前要 78–113 分钟, 其中三种模拟器 (API 30、API 36、Android TV) 的 instrumented test 串行约 54 分钟, 打包测试 APK 约 10 分钟. 另外有 PR 的分支每次推送都同时触发 push 与 pull_request, 同一个提交构建两遍.  ## 提速  - instrumented test 移出构建 job, 与之并行:   - 手机镜像一个 job: 跳过 TV 模块, 编译一次后依次在 API 30 与 API 36 上运行. 一种模拟器上的失败不跳过另一种, job 最后统一判定.   - TV 镜像一个 job: 只跑 TV 模块. TV 模块不再在手机镜像上运行. - push 只对 main 与 `release/**` 触发, 其他分支由 PR 构建; 没有 PR 的分支可以手动运行 (`workflow_dispatch`). - 签名、release APK、Firebase 等依赖 secrets 的步骤改为 "能读取 secrets" 时运行: 本仓库的 push 与手动运行, 以及来自本仓库分支的 PR. 来自 fork 的 PR 照旧跳过. PR 构建因此也产出签名的 release APK, 应用内按 PR 或提交查找开发版照常可用.  实测:  | job | push (run 36392795946) | PR (run 36394565194) | |---|---|---| | Build (Ubuntu) | 35.4 分钟 | 39.3 分钟 (现在包含 release APK) | | Android Instrumented Test (api=30 & 36) | 31.9 分钟 | 32.5 分钟 | | Android Instrumented Test (android-tv) | 34.1 分钟 | 31.3 分钟 |  Ubuntu 一线约 36–40 分钟. runner 时间与原来的单个 Ubuntu job 相当 (约 100 分钟), 而每个 PR 提交只构建一次, 总占用约减半.  ## 稳定性  统计了近 60 次 instrumented test 失败:  - **launcher ANR 对话框**: API 36 手机镜像开机后, runner 发送的解锁键在 launcher 获得焦点窗口前到达, 触发 ANR. 对话框盖在测试窗口上, 之后注入的输入全被丢弃, 同一次运行里依赖焦点的 UI 测试成批失败 (6 次). 运行测试前设置 `hide_error_dialogs`, 已弹出的对话框随进程一起关闭. 验证中遇到一次开机 ANR, 脚本结束 launcher 后测试全部通过. - **窗口焦点竞态**: TV 焦点作用域在窗口获得焦点后才分配初始焦点, `waitForIdle` 不等待窗口焦点. `runAniComposeUiTest` 在 Android 上先等测试窗口获得焦点再运行测试体. - **模拟器开机失败**: 开机后 adb 短暂 offline、sdkmanager 下载失败时重试一次; 测试开始后的失败不重试. 模拟器步骤超时 60 分钟. - **`KtorHttpDownloaderTest` pauseAll/cancelAll** (Windows 偶发): 第二个任务准备期间第一个任务已下载完. 改用分片请求一直挂起的 playlist

- **Issue #3491** (2026-09-28): **Fix Android log-copy crashes and enhancement graph rebuilds**
  *Symptoms*: Closes #3488  Copying a multi-megabyte Android log can terminate the app with `TransactionTooLargeException`. The attached issue log contains clipboard parcels over 16 MB; a 9.45 MB synthetic log also reproduced the crash on the Android 15 emulator.  - Read at most 128 Ki UTF-16 characters plus one overflow character on `Dispatchers.IO`. Copy complete small logs; for oversized logs, leave the clipboard intact and direct the user to share the complete file. - Handle file/clipboard failures with localized feedback, while preserving coroutine cancellation. - Keep Android video enhancement effects independent of video metadata availability. The scaler receives actual frame dimensions through Media3's `configure()`, so unknown/recovered metadata does not remove and reinstall the scaler and recompile the quality shaders. Viewport and mode changes still update the effects.  Verification:  - `:app:shared:ui-settings:testAndroidHostTest` — 28 tests passed, including six log-copy regression cases (Unicode, exact limit, overflow/8 MB input, missing file, clipboard rejection, cancellation). - `:app:shared:video-player:testAndroidHostTest` — 36 tests passed. The added controller test covers unknown/known video dimensions, a seek, metadata loss/recovery, viewport resize, and disabling enhancement. It fails with the original scaler condition. - `:app:android:assembleDefaultDebug -Pani.android.abis=arm64-v8a` — passed. - Used `.agents/skills/android-ui-verify` on Pixel 8 Pro API 35, 1344 × 2

- **Issue #3489** (2026-09-27): **fix(episode): 剧集列表按类型分组, 上一集/下一集只在同类型内切换**
  *Symptoms*: ## 问题  同一条目内 SP、OP、ED 的序号各自从 1 开始, 与正片无关. 剧集查询按 `sortNumber` 混排, 结果是 "正片 1、SP 1、正片 2……", 播完正片第 1 集还会自动播 SP 1.  例: 2026 夏《レッツゴー怪奇組》(595106) 有 12 集正片和 1 集 sort = 1 的 SP「特别怪」(9/20 播出), 播放页列表里它排在正片第 1 集后面.  ## 改动  - **列表排序**: `EpisodeCollectionDao` 按条目查询剧集时先按类型分组, 正片在前, 其他类型按 `EpisodeType` 声明顺序 (与 `EpisodeSort.compareTo` 一致), 组内按序号. 影响播放页剧集列表/网格、TV 选集条等直接使用该顺序的地方; 详情页原本就把正片和其他剧集分开显示. - **上一集/下一集**: 新增 `findNeighborEpisode` (`EpisodeCollections`), 只在同类型剧集之间切换: 正片接下一集正片, SP01 接 SP02. 用于手机端自动下一集、TV 上一集/下一集和 "下一集" 按钮 (`TvStripEpisode` 为此带上剧集类型). - **进度**: `SubjectProgressInfo` 本来就只统计正片, 未改. - `docs/contributing/code/subjects.md` 补充上述规则.  没有改 UI, 播放页和 TV 的列表里正片和 SP 之间没有分隔线或标题.  ## 行为变化  - 被 Bangumi 标为 SP 的小数序号剧集 (如《うちの弟どもがすみません》12.5 的第一季度回顾特番) 从两集正片之间移到正片之后. - 正片中的小数序号剧集 (如 12.5) 仍在正片组内, 位置不变. - 正片最后一集播完不再自动播 SP.  ## 测试  - app-data desktopTest: 新增 `EpisodeCollectionDaoTest` (内存数据库验证分组顺序, 以及与 `EpisodeSort` 比较结果一致) 3 个、`EpisodeNeighborsTest` 7 个; `SubjectCollectionRepositoryInvalidateTest` 22 个通过. - `:app:shared` desktop 编译通过; `:app:shared:ui-episode-tv` 编译通过, host 测试 47 个通过. - 未在真机或模拟器上看过界面.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

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

### Incident Patch 1: `b3c522f7` (2026-09-30)
**Commit Message**: fix(player): Android 视频输出移除超时后在原位置重新打开媒体, 修复切换全屏或切到后台后黑屏 (#3507)

切换全屏时播放器的 AndroidView 会被重建, 退到后台或锁屏时窗口 Surface 会被销毁. 视频输出 (SurfaceView)
被移除时, ExoPlayer 在主线程等待播放线程释放旧输出, 超过 detachSurfaceTimeoutMs 就以 ERROR_CODE_TIMEOUT
停止播放, 画面黑屏且不会自动恢复.

- LibassExoPlayerMediampPlayer: 打开期间超时时重试; 播放中超时时用 AnalyticsListener 记录的位置
  重新打开同一个 UriMediaData. detachSurfaceTimeoutMs 放宽到 3 秒
- RememberPlayProgressExtension: 同一个 MediaData 被重新打开时保留播放器给出的位置, 不跳回记忆进度
- PlayerSession: 记录媒体加载成功后播放中的播放器错误
- 全屏切换日志改用应用 logger, 进入应用日志文件

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/episode/PlayerSession.kt` (modified, +14/-0)
```diff
@@ -17,6 +17,7 @@ import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.StateFlow
 import kotlinx.coroutines.flow.asStateFlow
+import kotlinx.coroutines.launch
 import kotlinx.coroutines.withContext
 import me.him188.ani.app.domain.media.hls.HlsPlaybackOptions
 import me.him188.ani.app.domain.media.hls.HlsPlaybackPreparer
@@ -43,6 +44,7 @@ import me.him188.ani.utils.logging.warn
 import org.koin.core.Koin
 import org.openani.mediamp.MediampPlayer
 import org.openani.mediamp.PlaybackException
+import org.openani.mediamp.errorOrNull
 import org.openani.mediamp.source.MediaData
 import org.openani.mediamp.source.UriMediaData
 import kotlin.coroutines.CoroutineContext
@@ -92,6 +94,18 @@ class PlayerSession(
      */
     val videoLoadingState: StateFlow<VideoLoadingState> get() = _videoLoadingStateFlow.asStateFlow()
 
+    init {
+        backgroundScope.launch {
+            // 打开失败由 loadMedia 记录, 这里记录媒体加载成功后播放过程中的错误
+            player.state.collect { state ->
+                val error = state.errorOrNull ?: return@collect
+                if (_videoLoadingStateFlow.value is VideoLoadingState.Succeed) {
+                    logger.warn(error) { "Player error during playback" }
+                }
+            }
+        }
+    }
+
     /**
      * 解析 media 并开始播放这个 media.
      */
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/player/extension/RememberPlayProgressExtension.kt` (modified, +12/-0)
```diff
@@ -31,6 +31,7 @@ import me.him188.ani.utils.logging.info
 import me.him188.ani.utils.logging.logger
 import org.koin.core.Koin
 import org.openani.mediamp.MediaStatus
+import org.openani.mediamp.source.MediaData
 import kotlin.time.Duration
 import kotlin.time.Duration.Companion.minutes
 import kotlin.time.Duration.Companion.seconds
@@ -91,6 +92,9 @@ class RememberPlayProgressExtension(
         backgroundTaskScope.launch("PlaybackStateListener") {
             val player = context.player
             var haveResumedOnce = false
+            // 已经恢复过记忆进度的媒体. 播放器在原位置重新打开同一个 MediaData 时 (Android 上视频输出超时后恢复播放),
+            // 保留播放器打开时的位置, 不跳回记忆的进度.
+            var resumedMediaData: MediaData? = null
             player.state.collectLatest { state ->
                 when {
                     state.mediaStatus == MediaStatus.Opening -> {
@@ -99,17 +103,23 @@ class RememberPlayProgressExtension(
                     }
 
                     state.isPlaying -> {
+                        val mediaData = player.mediaData.value
+                        if (mediaData != null && mediaData === resumedMediaData) {
+                            haveResumedOnce = true
+                        }
                         // Some backends (notably desktop mpv) report playing before the loaded file accepts seeks.
                         // Restore once metadata is ready, but only report after playback remains active for 5 seconds.
                         if (!haveResumedOnce) {
                             if (automationGate.suppressed.value) {
                                 haveResumedOnce = true
+                                resumedMediaData = mediaData
                             } else {
                                 val positionMillis =
                                     playProgressRepository.getResumePositionMillisByEpisodeId(episodeSession.episodeId)
                                 if (positionMillis == null) {
                                     logger.info { "Did not find saved position" }
                                     haveResumedOnce = true
+                                    resumedMediaData = mediaData
                                 } else {
                                     logger.info {
                                         "Loaded saved position: $positionMillis, waiting for video properties"
@@ -120,7 +130,9 @@ class RememberPlayProgressExtension(
                                             "Video properties ready, seeking to saved position: $positionMillis"
                                         }
                                         player.seekTo(positionMillis)
+                                        // seek 引起的状态变化会取消本次收集, 标记必须在 NonCancellable 内完成
                                         haveResumedOnce = true
+                                        resumedMediaData = mediaData
                                     }
                                 }
                             }
```

**File**: `app/shared/app-data/src/commonTest/kotlin/domain/player/extension/RememberPlayProgressExtensionTest.kt` (modified, +30/-0)
```diff
@@ -13,6 +13,7 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.flow.filterNotNull
 import kotlinx.coroutines.flow.first
+import kotlinx.coroutines.launch
 import kotlinx.coroutines.test.StandardTestDispatcher
 import kotlinx.coroutines.test.TestScope
 import kotlinx.coroutines.test.advanceTimeBy
@@ -39,12 +40,14 @@ import me.him188.ani.utils.coroutines.childScope
 import org.openani.mediamp.PlaybackErrorCode
 import org.openani.mediamp.PlaybackException
 import org.openani.mediamp.metadata.MediaProperties
+import org.openani.mediamp.test.TestMediampPlayer
 import kotlin.time.Duration
 import kotlin.time.Duration.Companion.minutes
 import kotlin.test.Ignore
 import kotlin.test.Test
 import kotlin.test.assertEquals
 import kotlin.test.assertNotEquals
+import kotlin.test.assertNotNull
 import kotlin.test.assertNull
 import kotlin.test.assertTrue
 
@@ -670,6 +673,33 @@ class RememberPlayProgressExtensionTest : AbstractPlayerExtensionTest() {
         testScope.cancel()
     }
 
+    @Test
+    fun `keeps position when player reopens the same media data`() = runTest {
+        val (testScope, suite, _) = createCase()
+        advanceUntilIdle()
+        repository.saveOrUpdate(episodeId = initialEpisodeId, 500)
+
+        suite.player.loadMedia(durationMs = 100_000L, playWhenReady = true, uri = "file://test")
+        advanceUntilIdle()
+        assertEquals(500, suite.player.currentPositionMillis.value)
+        val mediaData = assertNotNull(suite.player.mediaData.value)
+
+        // Android 上视频输出超时: 播放器出错, 随后在出错位置重新打开同一个 MediaData
+        suite.player.injectError(PlaybackException(PlaybackErrorCode.INTERNAL, "Detaching surface timed out"))
+        runCurrent()
+        val open = TestMediampPlayer.OpenBehavior.Hold()
+        suite.player.openBehavior = open
+        testScope.launch {
+            suite.player.setMediaData(mediaData, playWhenReady = true, startPositionMillis = 30_000L)
+        }
+        runCurrent()
+        open.release()
+        advanceUntilIdle()
+
+        assertEquals(30_000, suite.player.currentPositionMillis.value)
+        testScope.cancel()
+    }
+
     @Test
     fun `loads saved history on switch episode`() = runTest {
         val (testScope, suite, state) = createCase()
```

**File**: `app/shared/ui-foundation/src/androidMain/kotlin/ui/foundation/layout/Fullscreen.android.kt` (modified, +4/-1)
```diff
@@ -15,11 +15,14 @@ import androidx.core.view.WindowCompat
 import androidx.core.view.WindowInsetsCompat
 import androidx.core.view.WindowInsetsControllerCompat
 import me.him188.ani.app.platform.Context
+import me.him188.ani.utils.logging.info
+import me.him188.ani.utils.logging.logger
 
+private val logger = logger("Fullscreen")
 
 @Suppress("USELESS_CAST") // compiler bug
 actual suspend fun Context.setRequestFullScreen(window: PlatformWindowMP, fullscreen: Boolean) {
-    android.util.Log.i("setRequestFullScreen", "Requesting fullscreen: $fullscreen, context=$this")
+    logger.info { "Requesting fullscreen: $fullscreen, context=$this" }
     if (this is Activity) {
         if (fullscreen) {
             // go landscape
```

**File**: `app/shared/video-player/src/androidHostTest/kotlin/media/VideoOutputDetachTimeoutTest.kt` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.videoplayer.media
+
+import androidx.annotation.OptIn
+import androidx.media3.common.util.UnstableApi
+import androidx.media3.exoplayer.ExoTimeoutException
+import org.openani.mediamp.PlaybackErrorCode
+import org.openani.mediamp.PlaybackException
+import kotlin.test.Test
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+
+@OptIn(UnstableApi::class)
+class VideoOutputDetachTimeoutTest {
+    @Test
+    fun detectsDetachTimeoutWrappedByMediamp() {
+        // MediaMP -> ExoPlaybackException -> ExoTimeoutException, as reported in user logs
+        val error = PlaybackException(
+            PlaybackErrorCode.INTERNAL,
+            "ExoPlayer playback failed: ERROR_CODE_TIMEOUT (1003): Unexpected runtime error",
+            RuntimeException(
+                "Unexpected runtime error",
+                ExoTimeoutException(ExoTimeoutException.TIMEOUT_OPERATION_DETACH_SURFACE),
+            ),
+        )
+        assertTrue(error.isVideoOutputDetachTimeout())
+    }
+
+    @Test
+    fun ignoresOtherTimeoutsAndErrors() {
+        assertFalse(
+            RuntimeException(ExoTimeoutException(ExoTimeoutException.TIMEOUT_OPERATION_RELEASE))
+                .isVideoOutputDetachTimeout(),
+        )
+        assertFalse(PlaybackException(PlaybackErrorCode.IO, "Source error").isVideoOutputDetachTimeout())
+    }
+}
```

---

### Incident Patch 2: `7c8f5278` (2026-09-30)
**Commit Message**: fix(danmaku): 弹弹 play 匹配接口失败时返回 matches=null, 修复弹幕获取抛出反序列化异常 (#3506)

弹弹 play 的 /api/v2/match 拒绝请求时返回 success=false 且 matches=null.
DandanplayMatchVideoResponse 把 matches 声明为非空, 反序列化抛出
JsonDecodingException, 整次弹弹 play 弹幕获取失败并被 DanmakuFetcher 重试.

- 按接口文档把 matches, errorMessage 以及匹配结果中的 animeTitle,
  episodeTitle, typeDescription 声明为可空
- 文件名匹配返回 success=false 时记录 errorCode/errorMessage 并返回 NoMatch
- 补充失败响应反序列化、匹配被拒绝时返回 NoMatch、文件名匹配成功的测试

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `danmaku/dandanplay/src/commonMain/kotlin/DandanplayDanmakuProvider.kt` (modified, +14/-6)
```diff
@@ -155,27 +155,35 @@ class DandanplayDanmakuProvider(
                 fileSize = request.fileSize,
                 videoDuration = request.videoDuration,
             )
+            if (!resp.success) {
+                logger.warn {
+                    "Dandanplay file match failed for '$filename', " +
+                            "errorCode=${resp.errorCode}, errorMessage=${resp.errorMessage}"
+                }
+                return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
+            }
+            val matches = resp.matches.orEmpty()
             val match = if (resp.isMatched) {
-                resp.matches.firstOrNull() ?: return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
+                matches.firstOrNull() ?: return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
             } else {
                 matcher.match(
-                    resp.matches.map {
+                    matches.map {
                         DanmakuEpisodeWithSubject(
                             it.episodeId.toString(),
-                            it.animeTitle,
-                            it.episodeTitle,
+                            it.animeTitle.orEmpty(),
+                            it.episodeTitle.orEmpty(),
                             null,
                         )
                     },
                 )?.let { match ->
-                    resp.matches.first { it.episodeId.toString() == match.id }
+                    matches.first { it.episodeId.toString() == match.id }
                 } ?: return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
             }
             logger.info { "Best match by file match: ${match.animeTitle} - ${match.episodeTitle}" }
             val episodeId = match.episodeId
             return createResult(
                 episodeId,
-                DanmakuMatchMethod.Fuzzy(match.animeTitle, match.episodeTitle),
+                DanmakuMatchMethod.Fuzzy(match.animeTitle.orEmpty(), match.episodeTitle.orEmpty()),
             )
         }
         return DanmakuFetchResult.noMatch(providerId, DanmakuServiceId.Dandanplay)
```

**File**: `danmaku/dandanplay/src/commonMain/kotlin/data/MatchVideo.kt` (modified, +5/-5)
```diff
@@ -68,19 +68,19 @@ class DandanplayDanmakuListResponse(
 @Serializable
 data class DandanplayEpisode(
     val animeId: Long,
-    val animeTitle: String,
+    val animeTitle: String? = null,
     val episodeId: Long,
-    val episodeTitle: String,
+    val episodeTitle: String? = null,
     val shift: Double,// 弹幕偏移时间（弹幕应延迟多少秒出现）。此数字为负数时表示弹幕应提前多少秒出现。
     val type: String,
-    val typeDescription: String
+    val typeDescription: String? = null,
 )
 
 @Serializable
 class DandanplayMatchVideoResponse(
     val isMatched: Boolean,
-    val matches: List<DandanplayEpisode>, // Actually it's null when success is false
+    val matches: List<DandanplayEpisode>? = null, // success 为 false 时为 null
     val errorCode: Int,
     val success: Boolean,
-    val errorMessage: String,
+    val errorMessage: String? = null,
 )
```

**File**: `danmaku/dandanplay/src/commonTest/kotlin/DandanplayDanmakuProviderTest.kt` (modified, +111/-1)
```diff
@@ -24,12 +24,15 @@ import kotlinx.coroutines.test.runTest
 import kotlinx.serialization.json.Json
 import me.him188.ani.danmaku.api.provider.DanmakuFetchRequest
 import me.him188.ani.danmaku.api.provider.DanmakuMatchMethod
+import me.him188.ani.danmaku.dandanplay.data.DandanplayMatchVideoResponse
 import me.him188.ani.datasources.api.EpisodeSort
 import me.him188.ani.datasources.api.PackedDate
 import me.him188.ani.utils.ktor.asScopedHttpClient
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.test.assertIs
+import kotlin.test.assertNull
 import kotlin.time.Duration.Companion.minutes
 
 class DandanplayDanmakuProviderTest {
@@ -288,6 +291,99 @@ class DandanplayDanmakuProviderTest {
         assertEquals("第7话 コンビニを出ると, そこは不思議の世界でした", method.episodeTitle)
     }
 
+    @Test
+    fun `DandanplayMatchVideoResponse accepts null matches when match request is rejected`() {
+        val response = json.decodeFromString<DandanplayMatchVideoResponse>(REJECTED_MATCH_RESPONSE)
+
+        assertFalse(response.success)
+        assertFalse(response.isMatched)
+        assertEquals(2, response.errorCode)
+        assertEquals("一个或多个参数不符合规则", response.errorMessage)
+        assertNull(response.matches)
+    }
+
+    @Test
+    fun `fetchAutomatic returns no match when file match request is rejected`() = runTest {
+        val seenPaths = mutableListOf<String>()
+        val provider = createProvider { path ->
+            seenPaths += path
+            when (path) {
+                "/api/v2/bangumi/bgmtv/999999999" -> respondJson(
+                    """{"success": false, "errorCode": 7, "errorMessage": "无法找到指定的资源", "bangumi": null}""",
+                )
+
+                "/api/v2/search/episodes" -> respondJson(EMPTY_EPISODE_SEARCH_RESPONSE)
+                "/api/v2/match" -> respondJson(REJECTED_MATCH_RESPONSE)
+                else -> error("Unexpected request: $path")
+            }
+        }
+
+        val result = provider.fetchAutomatic(
+            request(
+                subjectId = 999999999,
+                subjectName = "unknown subject",
+                episodeSort = EpisodeSort(1),
+                episodeName = "unknown episode",
+                filename = "[Group] unknown subject - 01 [1080P]",
+            ),
+        ).single()
+
+        assertEquals(DanmakuMatchMethod.NoMatch, result.matchInfo.method)
+        assertEquals(
+            listOf(
+                "/api/v2/bangumi/bgmtv/999999999",
+                "/api/v2/search/episodes",
+                "/api/v2/match",
+            ),
+            seenPaths,
+        )
+    }
+
+    @Test
+    fun `fetchAutomatic uses file match when other matching fails`() = runTest {
+        val provider = createProvider { path ->
+            when (path) {
+                "/api/v2/bangumi/bgmtv/999999999" -> respondJson(
+                    """{"success": false, "errorCode": 7, "errorMessage": "无法找到指定的资源", "bangumi": null}""",
+                )
+
+                "/api/v2/search/episodes" -> respondJson(EMPTY_EPISODE_SEARCH_RESPONSE)
+                "/api/v2/match" -> respondJson(
+                    """
+                    {
+                      "isMatched": false,
+                      "matches": [
+                        {
+                          "episodeId": 176170001, "animeId": 17617, "animeTitle": "葬送的芙莉莲",
+                          "episodeTitle": "第1话 冒险的结束", "type": "tvseries", "typeDescription": "TV动画",
+                          "shift": 0, "imageUrl": "https://example.com/17617.jpg"
+                        }
+                      ],
+                      "errorCode": 0, "success": true, "errorMessage": ""
+                    }
+                    """.trimIndent(),
+                )
+
+                "/api/v2/comment/176170001" -> respondJson("""{"count":0,"comments":[]}""")
+                else -> error("Unexpected request: $path")
+            }
+        }
+
+        val result =
```

---

### Incident Patch 3: `58640970` (2026-09-28)
**Commit Message**: fix(danmaku): 弹弹 play 匹配剧集时先按标题精确匹配, 修复分段放送合并条目匹配错集 (#3476)

* test: 修复桌面端 CI 测试失败并让失败日志带上断言消息

- 弹幕匀速回归: 换字号后的位置偏差容差按推进帧数累加, 与逐帧检查一致, 不再用 0.05 的总容差卡浮点累积误差.
- Gradle 测试日志改为完整异常格式, CI 失败时能直接看到 expected/actual.
- 图片加载器配置测试的断言消息附上 Sketch 描述, 便于定位平台差异.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

* fix(danmaku): 弹弹 play 匹配剧集时先按标题精确匹配, 修复分段放送合并条目匹配错集

弹弹 play 会把 Bangumi 拆成多个条目的分段放送 (如 Re:Zero 第四季的丧失篇与夺还篇)
合并为一个番剧并连续编号, 且只映射到第一个 Bangumi 条目. 后半条目走剧集搜索时,
接口不返回集数, 请求又只带中文集名, 与弹弹的日文标题对不上, 最后编辑距离兜底
选中了错误的剧集.

- DanmakuFetchRequest 新增 episodeNames, 携带剧集原名与译名
- 匹配顺序改为: 标题精确匹配 -> sort -> ep -> 模糊; 标题比较前去掉 "第x话" 前缀,
  全角转半角, 去空白并忽略大小写
- 补充分段放送、标题优先于集数、无标题回退集数、归一化函数的测试

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

---------

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/models/episode/EpisodeInfo.kt` (modified, +7/-0)
```diff
@@ -66,6 +66,13 @@ val EpisodeInfo.displayName get() = nameCn.ifBlank { name }
 @Stable
 val EpisodeInfo.nameOrNameCn get() = name.ifBlank { nameCn }
 
+/**
+ * 所有非空的名称, 原名优先. 用于需要跨语言匹配剧集的场景.
+ */
+@Stable
+val EpisodeInfo.allNames: List<String>
+    get() = listOf(name, nameCn).filter { it.isNotBlank() }.distinct()
+
 /**
  * 根据用户偏好选择的显示名称, 与 [subjectPreferredDisplayName] 同一约定.
  * @param useOriginalTitle 为 `true` 时优先显示原名 ([name]), 为 `false` 时行为与 [displayName] 一致.
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/danmaku/DanmakuLoader.kt` (modified, +2/-0)
```diff
@@ -27,6 +27,7 @@ import kotlinx.coroutines.flow.shareIn
 import kotlinx.coroutines.flow.transformLatest
 import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
+import me.him188.ani.app.data.models.episode.allNames
 import me.him188.ani.app.data.models.episode.displayName
 import me.him188.ani.app.data.repository.danmaku.SearchDanmakuRequest
 import me.him188.ani.danmaku.api.DanmakuCollection
@@ -227,6 +228,7 @@ class DanmakuLoaderImpl internal constructor(
             episodeSort = episodeInfo.sort,
             episodeEp = episodeInfo.ep,
             episodeName = episodeInfo.displayName,
+            episodeNames = episodeInfo.allNames,
             filename = filename,
             fileHash = fileHash,
             fileSize = fileLength,
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/media/download/AddDownloadUseCase.kt` (modified, +2/-0)
```diff
@@ -14,6 +14,7 @@ import kotlinx.coroutines.CancellationException
 import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.launch
 import me.him188.ani.app.data.models.episode.EpisodeInfo
+import me.him188.ani.app.data.models.episode.allNames
 import me.him188.ani.app.data.models.subject.SubjectInfo
 import me.him188.ani.app.domain.media.cache.MediaCache
 import me.him188.ani.app.domain.media.resolver.toEpisodeMetadata
@@ -73,6 +74,7 @@ class AddDownloadUseCaseImpl(
                         episodeSort = episode.sort,
                         episodeEp = episode.ep,
                         episodeName = episode.name,
+                        episodeNames = episode.allNames,
                         filename = media.originalTitle,
                         fileSize = cache.fileStats.first().totalSize.takeUnless { it.isUnspecified }?.inBytes,
                         fileHash = null,
```

**File**: `danmaku/api/src/commonMain/kotlin/provider/DanmakuProvider.kt` (modified, +8/-0)
```diff
@@ -60,7 +60,15 @@ class DanmakuFetchRequest(
     val episodeId: Int,
     val episodeSort: EpisodeSort,
     val episodeEp: EpisodeSort?,
+    /**
+     * 用于展示和模糊匹配的剧集名称, 通常是中文名.
+     */
     val episodeName: String,
+    /**
+     * 剧集的所有已知名称 (原名, 译名等), 用于按标题精确匹配. 弹幕源的剧集标题语言不固定,
+     * 例如弹弹 play 对同一部番可能只有日文原名, 只用 [episodeName] 会匹配不到.
+     */
+    val episodeNames: List<String> = listOf(episodeName),
 
     val filename: String?,
     val fileHash: String?,
```

**File**: `danmaku/dandanplay/src/commonMain/kotlin/DandanplayDanmakuProvider.kt` (modified, +45/-17)
```diff
@@ -130,7 +130,7 @@ class DandanplayDanmakuProvider(
                 if (it is CancellationException) throw it
                 logger.warn(it) { "Failed to fetch episodes by Bangumi subject id: ${request.subjectId}" }
             }.getOrNull()
-        tryMatchEpisodes(request, bgmtvEpisodes, prefixedExpectedEpisodeName, matcher)?.let { return it }
+        tryMatchEpisodes(request, bgmtvEpisodes, matcher)?.let { return it }
 
         val episodes: List<DanmakuEpisodeWithSubject>? =
             runCatching { getEpisodesByExactSubjectMatch(request) }
@@ -144,7 +144,7 @@ class DandanplayDanmakuProvider(
                     if (it is CancellationException) throw it
                     logger.error(it) { "Failed to fetch episodes by fuzzy search" }
                 }.getOrNull()
-        tryMatchEpisodes(request, episodes, prefixedExpectedEpisodeName, matcher)?.let { return it }
+        tryMatchEpisodes(request, episodes, matcher)?.let { return it }
 
         // 都不行, 那就用最不准的方法
 
@@ -184,11 +184,17 @@ class DandanplayDanmakuProvider(
     private suspend fun tryMatchEpisodes(
         request: DanmakuFetchRequest,
         episodes: List<DanmakuEpisodeWithSubject>?,
-        prefixedExpectedEpisodeName: String,
         matcher: DanmakuMatcher,
     ): DanmakuFetchResult? {
         if (episodes == null) return null
 
+        // 先用标题精确匹配. 弹弹 play 会把 Bangumi 拆成多个条目的分段放送合并为一个番剧并连续编号,
+        // 此时 Bangumi 的 ep 与弹弹的集数对不上, 只有标题是可靠的.
+        matchEpisodeByTitle(request, episodes)?.let {
+            logger.info { "Matched episode by exact title: ${it.subjectName} - ${it.episodeName}" }
+            return createResult(it.id.toLong(), DanmakuMatchMethod.Exact(it.subjectName, it.episodeName))
+        }
+
         // 用剧集编号匹配. 先用系列的, 因为系列的更大.
         episodes.firstOrNull { it.epOrSort != null && it.epOrSort == request.episodeSort }?.let {
             logger.info { "Matched episode by exact episodeSort: ${it.subjectName} - ${it.episodeName}" }
@@ -199,20 +205,6 @@ class DandanplayDanmakuProvider(
             return createResult(it.id.toLong(), DanmakuMatchMethod.Exact(it.subjectName, it.episodeName))
         }
 
-        // 用名称精确匹配, 标记为 Exact.
-        if (request.episodeName.isNotBlank()) {
-            val match =
-                episodes.firstOrNull { it.episodeName == request.episodeName }
-                    ?: episodes.firstOrNull { it.episodeName == prefixedExpectedEpisodeName }
-            match?.let { episode ->
-                logger.info { "Matched episode by exact episodeName: ${episode.subjectName} - ${episode.episodeName}" }
-                return createResult(
-                    episode.id.toLong(),
-                    DanmakuMatchMethod.Exact(episode.subjectName, episode.episodeName),
-                )
-            }
-        }
-
         // 用名字不精确匹配.
         if (episodes.isNotEmpty()) {
             matcher.match(episodes)?.let {
@@ -227,6 +219,25 @@ class DandanplayDanmakuProvider(
         return null
     }
 
+    /**
+     * 按标题精确匹配. 标题去掉 "第x话" 前缀并归一化后比较, 同时接受 [DanmakuFetchRequest.episodeNames] 中的任一名称.
+     * 多个候选标题相同时, 用集数消歧; 仍无法确定则返回 `null`, 交给后续的集数匹配.
+     */
+    private fun matchEpisodeByTitle(
+        request: DanmakuFetchRequest,
+        episodes: List<DanmakuEpisodeWithSubject>,
+    ): DanmakuEpisodeWithSubject? {
+        val expectedTitles = (request.episodeNames + request.episodeName)
+            .map { normalizeEpisodeTitle(it) }
+            .filterTo(HashSet()) { it.isNotEmpty() }
+        if (expectedTitles.isEmpty()) return null
+
+        val candidates = episodes.filter { normalizeEpisodeTitle(it.episodeName) in expectedTitles }
+        return candidates.singleOrNull()
+            ?: candidates.firstOrNull { it.epOrSort != null && it.epOrSort == request.episodeSort }
+            ?: candidates.firstOrNull { it.epOrSort != null && it.epOrSort == request.episodeEp }
+    }
+
     private suspend fun getEpisodesByBgmtvSubjectId(
         request: DanmakuFetchRequest
     
```

---

### Incident Patch 4: `0c1bd103` (2026-09-28)
**Commit Message**: Fix Android log-copy crashes and enhancement graph rebuilds (#3491)

Fix Android log copying and stabilize video enhancement effects

Co-authored-by: openanibot <openanibot@users.noreply.github.com>
Co-authored-by: Him188 <Him188@mamoe.net>

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rCN/strings.xml` (modified, +2/-0)
```diff
@@ -1408,6 +1408,8 @@
     <string name="settings_log_share_today_log_file">分享当日日志文件</string>
     <string name="settings_log_share_file">分享日志文件</string>
     <string name="settings_log_copy_today_log_content">复制当日日志内容（很大）</string>
+    <string name="settings_log_copy_too_large">日志太大，无法复制。请使用“分享当日日志文件”导出完整日志。</string>
+    <string name="settings_log_copy_failed">无法复制日志，请尝试“分享当日日志文件”。</string>
     <string name="settings_log_file_not_found">未找到日志文件</string>
     <string name="rating_requires_collection">请先收藏再评分</string>
     <string name="rating_discard_edit_title">舍弃编辑</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rHK/strings.xml` (modified, +2/-0)
```diff
@@ -1378,6 +1378,8 @@
     <string name="settings_log_share_today_log_file">分享當日日誌檔案</string>
     <string name="settings_log_share_file">分享日誌檔案</string>
     <string name="settings_log_copy_today_log_content">複製當日日誌內容（很大）</string>
+    <string name="settings_log_copy_too_large">日誌太大，無法複製。請使用「分享當日日誌檔案」匯出完整日誌。</string>
+    <string name="settings_log_copy_failed">無法複製日誌，請嘗試「分享當日日誌檔案」。</string>
     <string name="settings_log_file_not_found">未找到日誌檔案</string>
     <string name="rating_requires_collection">請先收藏再評分</string>
     <string name="rating_discard_edit_title">捨棄編輯</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values-zh-rTW/strings.xml` (modified, +2/-0)
```diff
@@ -1368,6 +1368,8 @@
     <string name="settings_log_share_today_log_file">分享當日日誌檔案</string>
     <string name="settings_log_share_file">分享日誌檔案</string>
     <string name="settings_log_copy_today_log_content">複製當日日誌內容（很大）</string>
+    <string name="settings_log_copy_too_large">日誌太大，無法複製。請使用「分享當日日誌檔案」匯出完整日誌。</string>
+    <string name="settings_log_copy_failed">無法複製日誌，請嘗試「分享當日日誌檔案」。</string>
     <string name="settings_log_file_not_found">未找到日誌檔案</string>
     <string name="rating_requires_collection">請先收藏再評分</string>
     <string name="rating_discard_edit_title">捨棄編輯</string>
```

**File**: `app/shared/app-lang/src/androidMain/res/values/strings.xml` (modified, +2/-0)
```diff
@@ -1368,6 +1368,8 @@
     <string name="settings_log_share_today_log_file">Share today\'s log file</string>
     <string name="settings_log_share_file">Share log file</string>
     <string name="settings_log_copy_today_log_content">Copy today\'s log content (large)</string>
+    <string name="settings_log_copy_too_large">Log too large to copy. Use “Share today’s log file”.</string>
+    <string name="settings_log_copy_failed">Copy failed. Use “Share today’s log file”.</string>
     <string name="settings_log_file_not_found">Log file not found</string>
     <string name="rating_requires_collection">Follow this anime before rating</string>
     <string name="rating_discard_edit_title">Discard changes</string>
```

**File**: `app/shared/ui-settings/src/androidHostTest/kotlin/ui/settings/tabs/log/LogClipboardTest.kt` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.settings.tabs.log
+
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.test.runTest
+import java.io.File
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFailsWith
+
+class LogClipboardTest {
+    @Test
+    fun copiesCompleteSmallLog() = runTest {
+        withLog("日志 😀\nsecond line") { file ->
+            var copied: String? = null
+            assertEquals(LogCopyResult.Copied, copyLogToClipboard(file) { copied = it })
+            assertEquals(file.readText(), copied)
+        }
+    }
+
+    @Test
+    fun copiesLogAtCharacterLimit() = runTest {
+        withLog("中".repeat(MAX_LOG_CLIPBOARD_CHARS)) { file ->
+            var copied: String? = null
+            assertEquals(LogCopyResult.Copied, copyLogToClipboard(file) { copied = it })
+            assertEquals(file.readText(), copied)
+        }
+    }
+
+    @Test
+    fun rejectsOversizedLogWithoutChangingClipboard() = runTest {
+        for (size in listOf(MAX_LOG_CLIPBOARD_CHARS + 1, 8 * 1024 * 1024)) {
+            withLog("x".repeat(size)) { file ->
+                var copied = "previous clipboard"
+                assertEquals(LogCopyResult.TooLarge, copyLogToClipboard(file) { copied = it })
+                assertEquals("previous clipboard", copied)
+            }
+        }
+    }
+
+    @Test
+    fun handlesClipboardServiceFailure() = runTest {
+        withLog("small log") { file ->
+            assertEquals(LogCopyResult.Failed, copyLogToClipboard(file) {
+                throw RuntimeException("Clipboard service rejected the transaction")
+            })
+        }
+    }
+
+    @Test
+    fun handlesMissingLog() = runTest {
+        withLog("") { file ->
+            file.delete()
+            var copied = false
+            assertEquals(LogCopyResult.Failed, copyLogToClipboard(file) { copied = true })
+            assertEquals(false, copied)
+        }
+    }
+
+    @Test
+    fun preservesCancellation() = runTest {
+        withLog("small log") { file ->
+            assertFailsWith<CancellationException> {
+                copyLogToClipboard(file) { throw CancellationException("Screen closed") }
+            }
+        }
+    }
+
+    private suspend fun withLog(text: String, block: suspend (File) -> Unit) {
+        val file = File.createTempFile("animeko-log-", ".log")
+        try {
+            file.writeText(text)
+            block(file)
+        } finally {
+            file.delete()
+        }
+    }
+}
```

---

### Incident Patch 5: `bccfed3b` (2026-09-28)
**Commit Message**: fix(ci): Codex agent 清理复用工作区中 fork PR 留下的 remote 配置

self-hosted runner 复用工作区, actions/checkout 不会移除额外的 remote 和 pushurl,
导致处理过一次 fork PR 后, 后续 fork PR 的 iterate 因 `remote fork already exists` 失败,
同仓库分支的 push 也会被残留的 no-push pushurl 拦截.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `.github/workflows/codex-agent.yml` (modified, +9/-0)
```diff
@@ -464,6 +464,9 @@ jobs:
           set -euo pipefail
           git config user.name  "$GIT_NAME"
           git config user.email "$GIT_EMAIL"
+          # The self-hosted workspace is reused and checkout keeps extra remote config; drop what fork-PR runs leave.
+          git config --unset-all remote.origin.pushurl || true
+          git remote remove fork 2>/dev/null || true
 
       - name: React 👀 to the issue
         run: |
@@ -589,6 +592,9 @@ jobs:
           set -euo pipefail
           git config user.name  "$GIT_NAME"
           git config user.email "$GIT_EMAIL"
+          # The self-hosted workspace is reused and checkout keeps extra remote config; drop what fork-PR runs leave.
+          git config --unset-all remote.origin.pushurl || true
+          git remote remove fork 2>/dev/null || true
 
       - name: Resolve & check out PR branch
         id: pr
@@ -862,6 +868,9 @@ jobs:
           set -euo pipefail
           git config user.name  "$GIT_NAME"
           git config user.email "$GIT_EMAIL"
+          # The self-hosted workspace is reused and checkout keeps extra remote config; drop what fork-PR runs leave.
+          git config --unset-all remote.origin.pushurl || true
+          git remote remove fork 2>/dev/null || true
 
       - name: React 👀 to the comment
         run: |
```

---

### Incident Patch 6: `c0bb0c44` (2026-09-27)
**Commit Message**: fix(episode): 剧集列表按类型分组, 上一集/下一集只在同类型内切换 (#3489)

* fix(episode): 剧集列表按类型分组, 上一集/下一集只在同类型内切换

同一条目内 SP、OP、ED 的序号各自从 1 开始, 与正片无关. 按序号混排会得到
"正片 1、SP 1、正片 2" 的顺序, 播完正片第 1 集还会自动播 SP 1.

- 条目剧集查询先按类型分组 (正片在前, 其他类型按 EpisodeType 声明顺序,
  与 EpisodeSort.compareTo 一致), 组内按序号.
- 手机端自动下一集、TV 上一集/下一集及 "下一集" 按钮只在同类型剧集间切换:
  正片接下一集正片, SP01 接 SP02.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* refactor(episode): 相邻剧集查找不再作为 List 的泛型扩展, 改为单次遍历

- 泛型版本移入 EpisodeCollections, 只保留 List<EpisodeCollectionInfo> 的扩展.
- 从当前剧集向目标方向逐个查找同类型剧集, 不再过滤出新列表.
  TV 的 hasNextEpisode 在每次 UI 状态更新时都会读取.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/dao/EpisodeCollectionDao.kt` (modified, +16/-5)
```diff
@@ -28,6 +28,17 @@ import me.him188.ani.datasources.api.PackedDate
 import me.him188.ani.datasources.api.topic.UnifiedCollectionType
 
 
+/**
+ * 一个条目内剧集列表的顺序: 先按类型分组, 正片在前, 其他类型按 [EpisodeType] 的声明顺序, 与 [EpisodeSort.compareTo] 一致;
+ * 组内按序号. 类型不同的剧集序号互不相关, 例如 SP 的序号从 1 开始, 按序号混排会把 SP01 排到正片第 1 集后面.
+ */
+private const val EPISODE_LIST_ORDER = """
+    CASE episodeType
+        WHEN 'MainStory' THEN 0 WHEN 'SP' THEN 1 WHEN 'OP' THEN 2 WHEN 'ED' THEN 3
+        WHEN 'PV' THEN 4 WHEN 'MAD' THEN 5 WHEN 'OVA' THEN 6 WHEN 'OAD' THEN 7
+        ELSE 8
+    END, sortNumber ASC, sort ASC"""
+
 @Entity(
     tableName = "episode_collection",
     foreignKeys = [
@@ -101,7 +112,7 @@ interface EpisodeCollectionDao {
         SELECT * FROM episode_collection
         WHERE subjectId = :subjectId
         AND (episodeType = :episodeType)
-        ORDER BY sortNumber ASC, sort ASC
+        ORDER BY $EPISODE_LIST_ORDER
         """,
     )
     fun filterBySubjectId(
@@ -114,7 +125,7 @@ interface EpisodeCollectionDao {
         SELECT * FROM episode_collection
         WHERE subjectId = :subjectId
         AND (episodeType IN (:episodeTypes))
-        ORDER BY sortNumber ASC, sort ASC
+        ORDER BY $EPISODE_LIST_ORDER
         """,
     )
     fun filterBySubjectId(
@@ -126,7 +137,7 @@ interface EpisodeCollectionDao {
         """
         SELECT * FROM episode_collection
         WHERE subjectId = :subjectId
-        ORDER BY sortNumber ASC, sort ASC
+        ORDER BY $EPISODE_LIST_ORDER
         """,
     )
     fun filterBySubjectId(
@@ -137,7 +148,7 @@ interface EpisodeCollectionDao {
         """
         SELECT episodeId FROM episode_collection
         WHERE subjectId = :subjectId
-        ORDER BY sortNumber ASC, sort ASC
+        ORDER BY $EPISODE_LIST_ORDER
         """,
     )
     fun listIdBySubjectId(
@@ -148,7 +159,7 @@ interface EpisodeCollectionDao {
         """
         SELECT * FROM episode_collection
         WHERE subjectId = :subjectId 
-        ORDER BY sortNumber ASC, sort ASC""",
+        ORDER BY $EPISODE_LIST_ORDER""",
     )
     fun filterBySubjectIdPaging(subjectId: Int): PagingSource<Int, EpisodeCollectionEntity>
 
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/episode/EpisodeCollections.kt` (modified, +41/-2)
```diff
@@ -1,5 +1,5 @@
 /*
- * Copyright (C) 2024 OpenAni and contributors.
+ * Copyright (C) 2024-2026 OpenAni and contributors.
  *
  * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
  * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
@@ -10,11 +10,15 @@
 package me.him188.ani.app.domain.episode
 
 import androidx.compose.ui.util.fastAll
+import me.him188.ani.app.data.models.episode.EpisodeCollectionInfo
 import me.him188.ani.app.data.models.episode.EpisodeInfo
 import me.him188.ani.app.data.models.subject.SubjectRecurrence
 import me.him188.ani.app.domain.episode.EpisodeCompletionContext.isKnownCompleted
+import me.him188.ani.datasources.api.EpisodeType
 import me.him188.ani.datasources.api.PackedDate
 import me.him188.ani.datasources.api.minus
+import kotlin.math.absoluteValue
+import kotlin.math.sign
 import kotlin.time.Duration.Companion.days
 
 object EpisodeCollections {
@@ -35,4 +39,39 @@ object EpisodeCollections {
 
         return maxAirDate != null && now - maxAirDate >= 365.days
     }
-}
\ No newline at end of file
+
+    /**
+     * 切换上一集/下一集时 [currentEpisodeId] 的相邻剧集. 只在同类型的剧集之间切换: 正片的下一集是下一集正片, SP01 的下一集是 SP02.
+     *
+     * @param episodes 一个条目的剧集, 同类型的剧集按序号排列
+     * @param offset `1` 为下一集, `-1` 为上一集; 绝对值更大时跳过相应数量的同类型剧集
+     * @return 找不到当前剧集, 或已经是同类型的第一集/最后一集时为 `null`
+     */
+    inline fun <T> findNeighborEpisode(
+        episodes: List<T>,
+        currentEpisodeId: Int,
+        offset: Int,
+        episodeId: (T) -> Int,
+        episodeType: (T) -> EpisodeType?,
+    ): T? {
+        val currentIndex = episodes.indexOfFirst { episodeId(it) == currentEpisodeId }
+        if (currentIndex == -1) return null
+        if (offset == 0) return episodes[currentIndex]
+
+        val type = episodeType(episodes[currentIndex])
+        val step = offset.sign
+        var remaining = offset.absoluteValue
+        var index = currentIndex + step
+        while (index in episodes.indices) {
+            if (episodeType(episodes[index]) == type && --remaining == 0) return episodes[index]
+            index += step
+        }
+        return null
+    }
+}
+
+/**
+ * @see EpisodeCollections.findNeighborEpisode
+ */
+fun List<EpisodeCollectionInfo>.findNeighborEpisode(currentEpisodeId: Int, offset: Int): EpisodeCollectionInfo? =
+    EpisodeCollections.findNeighborEpisode(this, currentEpisodeId, offset, { it.episodeId }, { it.episodeInfo.type })
```

**File**: `app/shared/app-data/src/commonTest/kotlin/domain/episode/EpisodeNeighborsTest.kt` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.domain.episode
+
+import me.him188.ani.datasources.api.EpisodeType
+import me.him188.ani.datasources.api.EpisodeType.MainStory
+import me.him188.ani.datasources.api.EpisodeType.SP
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNull
+
+class EpisodeNeighborsTest {
+    private data class Ep(val id: Int, val type: EpisodeType?)
+
+    private fun List<Ep>.neighbor(currentEpisodeId: Int, offset: Int): Int? =
+        EpisodeCollections.findNeighborEpisode(this, currentEpisodeId, offset, { it.id }, { it.type })?.id
+
+    // 正片 1, SP 1, 正片 2, SP 2, 正片 3: 类型之间按序号混排
+    private val interleaved = listOf(
+        Ep(1, MainStory), Ep(101, SP), Ep(2, MainStory), Ep(102, SP), Ep(3, MainStory),
+    )
+
+    @Test
+    fun `next of main episode skips SP`() {
+        assertEquals(2, interleaved.neighbor(1, 1))
+        assertEquals(3, interleaved.neighbor(2, 1))
+    }
+
+    @Test
+    fun `next of SP is the next SP`() {
+        assertEquals(102, interleaved.neighbor(101, 1))
+    }
+
+    @Test
+    fun `previous stays in the same type`() {
+        assertEquals(1, interleaved.neighbor(2, -1))
+        assertEquals(101, interleaved.neighbor(102, -1))
+    }
+
+    @Test
+    fun `no neighbor across types at the boundaries`() {
+        val grouped = listOf(Ep(1, MainStory), Ep(2, MainStory), Ep(101, SP), Ep(102, SP))
+        assertNull(grouped.neighbor(2, 1))
+        assertNull(grouped.neighbor(101, -1))
+        assertNull(grouped.neighbor(1, -1))
+        assertNull(grouped.neighbor(102, 1))
+    }
+
+    @Test
+    fun `larger offset counts only episodes of the same type`() {
+        assertEquals(3, interleaved.neighbor(1, 2))
+        assertEquals(1, interleaved.neighbor(3, -2))
+        assertNull(interleaved.neighbor(101, 2))
+        assertEquals(101, interleaved.neighbor(101, 0))
+    }
+
+    @Test
+    fun `unknown current episode has no neighbor`() {
+        assertNull(interleaved.neighbor(999, 1))
+    }
+
+    @Test
+    fun `episodes without type are neighbors of each other`() {
+        val list = listOf(Ep(1, MainStory), Ep(201, null), Ep(2, MainStory), Ep(202, null))
+        assertEquals(202, list.neighbor(201, 1))
+        assertEquals(2, list.neighbor(1, 1))
+    }
+}
```

**File**: `app/shared/app-data/src/desktopTest/kotlin/data/persistent/database/dao/EpisodeCollectionDaoTest.kt` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.data.persistent.database.dao
+
+import kotlinx.coroutines.flow.first
+import kotlinx.coroutines.runBlocking
+import me.him188.ani.app.data.models.subject.RatingInfo
+import me.him188.ani.app.data.models.subject.SelfRatingInfo
+import me.him188.ani.app.data.models.subject.SubjectCollectionStats
+import me.him188.ani.app.data.persistent.database.AniDatabase
+import me.him188.ani.app.data.persistent.database.createTestAniDatabase
+import me.him188.ani.datasources.api.EpisodeSort
+import me.him188.ani.datasources.api.EpisodeType
+import me.him188.ani.datasources.api.EpisodeType.ED
+import me.him188.ani.datasources.api.EpisodeType.MainStory
+import me.him188.ani.datasources.api.EpisodeType.OP
+import me.him188.ani.datasources.api.EpisodeType.SP
+import me.him188.ani.datasources.api.PackedDate
+import me.him188.ani.datasources.api.topic.UnifiedCollectionType
+import me.him188.ani.utils.serialization.BigNum
+import kotlin.test.Test
+import kotlin.test.assertEquals
+
+class EpisodeCollectionDaoTest {
+    private fun runDatabaseTest(block: suspend (AniDatabase) -> Unit) = runBlocking {
+        val database = createTestAniDatabase()
+        try {
+            database.subjectCollection().upsert(subjectCollection(SUBJECT_ID))
+            block(database)
+        } finally {
+            database.close()
+        }
+    }
+
+    private fun subjectCollection(subjectId: Int) = SubjectCollectionEntity(
+        subjectId = subjectId,
+        name = "test",
+        nameCn = "测试",
+        summary = "",
+        nsfw = false,
+        imageLarge = "",
+        totalEpisodes = 12,
+        airDate = PackedDate.Invalid,
+        aliases = emptyList(),
+        tags = emptyList(),
+        collectionStats = SubjectCollectionStats.Zero,
+        ratingInfo = RatingInfo.Empty,
+        completeDate = PackedDate.Invalid,
+        selfRatingInfo = SelfRatingInfo.Empty,
+        collectionType = UnifiedCollectionType.DOING,
+        recurrence = null,
+        lastUpdated = 0,
+        lastFetched = 0,
+        cachedStaffUpdated = 0,
+        cachedCharactersUpdated = 0,
+    )
+
+    @Suppress("DEPRECATION")
+    private fun episode(episodeId: Int, type: EpisodeType?, sort: String) = EpisodeCollectionEntity(
+        subjectId = SUBJECT_ID,
+        episodeId = episodeId,
+        episodeType = type,
+        name = "ep",
+        nameCn = "",
+        airDate = PackedDate.Invalid,
+        comment = 0,
+        desc = "",
+        sort = EpisodeSort(BigNum(sort), type),
+        sortNumber = sort.toFloat(),
+        selfCollectionType = UnifiedCollectionType.NOT_COLLECTED,
+        lastFetched = 0,
+    )
+
+    // 按 id 打乱插入顺序, 结果只取决于 ORDER BY
+    private val episodes = listOf(
+        episode(1, MainStory, "1"),
+        episode(2, SP, "1"),
+        episode(3, MainStory, "2"),
+        episode(4, ED, "1"),
+        episode(5, SP, "0"),
+        episode(6, MainStory, "1.5"),
+        episode(7, OP, "1"),
+        episode(8, null, "1"),
+        episode(9, SP, "2"),
+    )
+
+    @Test
+    fun `main episodes come first then other types in EpisodeType order`() = runDatabaseTest { database ->
+        val dao = database.episodeCollection()
+        dao.upsert(episodes.shuffled())
+
+        val expected = listOf(1, 6, 3, 5, 2, 9, 7, 4, 8)
+        assertEquals(expected, dao.filterBySubjectId(SUBJECT_ID).first().map { it.episodeId })
+        assertEquals(expected, dao.listIdBySubjectId(SUBJECT_ID).first())
+    }
+
+    @Test
+    fun `filtering by types keeps the grouped order`() = runDatabaseTest { database ->
+        val dao = database.episodeCollection()
+        dao.upsert(episode
```

**File**: `app/shared/src/commonMain/kotlin/ui/subject/episode/EpisodeViewModel.kt` (modified, +5/-13)
```diff
@@ -88,6 +88,7 @@ import me.him188.ani.app.domain.episode.SetEpisodeCollectionTypeUseCase
 import me.him188.ani.app.domain.episode.SubjectEpisodeInfoBundle
 import me.him188.ani.app.domain.episode.UnsafeEpisodeSessionApi
 import me.him188.ani.app.domain.episode.episodeIdFlow
+import me.him188.ani.app.domain.episode.findNeighborEpisode
 import me.him188.ani.app.domain.episode.getCurrentEpisodeId
 import me.him188.ani.app.domain.episode.infoBundleFlow
 import me.him188.ani.app.domain.episode.infoLoadErrorFlow
@@ -356,20 +357,11 @@ open class EpisodeViewModel(
             CacheOnBtPlayExtension,
             SwitchNextEpisodeExtension.Factory(
                 getNextEpisode = { currentEpisodeId ->
-                    val list = episodeCollectionsFlow.first()
                     val subject = subjectCollectionFlow.first()
-                    val currentIndex = list.indexOfFirst { it.episodeId == currentEpisodeId }
-                    if (currentIndex == -1) {
-                        null
-                    } else {
-                        val nextEpisode = list.getOrNull(currentIndex + 1) ?: return@Factory null
-
-                        if (!nextEpisode.episodeInfo.isKnownCompleted(subject.recurrence)) {
-                            null
-                        } else {
-                            nextEpisode.episodeId
-                        }
-                    }
+                    episodeCollectionsFlow.first()
+                        .findNeighborEpisode(currentEpisodeId, offset = 1)
+                        ?.takeIf { it.episodeInfo.isKnownCompleted(subject.recurrence) }
+                        ?.episodeId
                 },
             ),
             SwitchMediaOnPlayerErrorExtension,
```

---

### Incident Patch 7: `dc574a2b` (2026-09-27)
**Commit Message**: fix(tv): 聚焦卡片被 Paging 移除时恢复到相邻项

懒加载列表可能比页面早一帧应用 Paging 更新: 列表先移除聚焦的卡片, Compose 随即把焦点移到附近的卡片,
页面随后观察到新 key 时读到的已是这张卡片, 于是不再恢复到被移除卡片的相邻项.
详情页角色行与评论列表的相关设备测试因此偶发超时.

- 卡片获得焦点时, 若之前记住的卡片已不在最新的 Paging 数据中, 其间没有用户导航,
  且焦点不是焦点作用域发出的请求, 则保留之前记住的卡片, 由 key 更新恢复到其相邻项.
- TvFocusScope 新增 isLatestDestination, 区分作用域送达的焦点与 Compose 自行移动的焦点.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `app/shared/ui-foundation/src/androidTv/kotlin/ui/foundation/focus/TvFocusScope.kt` (modified, +9/-0)
```diff
@@ -62,6 +62,7 @@ class TvFocusScope internal constructor(private val boundary: TvFocusBoundarySta
 
     internal var pending: Request? by mutableStateOf(null)
         private set
+    private var latestDestination: TvFocusTarget? = null
 
     internal fun targetOf(key: TvFocusKey): TvFocusTarget = targets.getOrPut(key) { TvFocusTarget(boundary) }
     fun requesterOf(key: TvFocusKey): FocusRequester = targetOf(key).requester
@@ -71,6 +72,12 @@ class TvFocusScope internal constructor(private val boundary: TvFocusBoundarySta
         if (focused) focusedKeys.add(key) else focusedKeys.remove(key)
     }
 
+    /**
+     * Whether [key] is where this scope last sent focus. Compose also moves focus on its own, for example to a
+     * nearby item when a lazy layout removes the focused one; such focus is not a destination of this scope.
+     */
+    fun isLatestDestination(key: TvFocusKey): Boolean = latestDestination.let { it != null && it === targets[key] }
+
     private fun submit(request: Request) {
         if (isActive && request.relevant()) pending = request
     }
@@ -163,6 +170,8 @@ class TvFocusScope internal constructor(private val boundary: TvFocusBoundarySta
                     pending = null
                 } else {
                     val target = result.target ?: return@collect
+                    // Focus callbacks run within requestFocus and may already ask for the destination.
+                    latestDestination = target
                     if (runCatching { target.requester.requestFocus() }.getOrDefault(false)) {
                         if (result.fallback) result.request.usedFallback = true
                         else if (pending === result.request) {
```

**File**: `app/shared/ui-subject/src/androidTv/kotlin/ui/subject/TvSubjectDetailsScreen.kt` (modified, +13/-2)
```diff
@@ -34,6 +34,7 @@ import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.DisposableEffect
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableIntStateOf
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
@@ -181,12 +182,13 @@ private fun TvSubjectDetailsContent(
     val charactersState = rememberLazyListState()
     val staffState = rememberLazyListState()
     val relatedState = rememberLazyListState()
-    val rowKeys = mapOf(
-        "episode" to details.episodes.map { "episode:${it.episodeId}" },
+    // Outside composition this reads the snapshot the lazy rows lay out, which can be newer than [rowKeys].
+    fun pagingRowKeys() = mapOf(
         "character" to lists.characters.itemSnapshotList.items.map { "character:${it.character.id}" },
         "staff" to lists.staff.itemSnapshotList.items.map { "staff:${it.personInfo.id}:${it.position}" },
         "related" to lists.related.itemSnapshotList.items.map { "related:${it.subjectId}" },
     )
+    val rowKeys = mapOf("episode" to details.episodes.map { "episode:${it.episodeId}" }) + pagingRowKeys()
     val focus = rememberTvFocusScope()
     focus.Resolver()
     val focusState = rememberTvDetailsFocusState(focus, presentation, mapOf(
@@ -214,10 +216,19 @@ private fun TvSubjectDetailsContent(
         val operation = state.operation
         if (operation.completed && operation.error == null) presentation.complete(operation.requestId, operation.offerMarkAllWatched)
     }
+    var focusNavigation by remember { mutableIntStateOf(focus.userNavGeneration) }
     fun Modifier.anchor(id: String, level: Int): Modifier = this
         .tvFocusAnchor(focus, TvDetailsKey(id))
         .onFocusChanged {
             if (it.hasFocus) {
+                // A paging row can drop the focused card before this page recomposes with the new keys, and
+                // Compose then focuses a nearby card. Keep the removed card so the row restores its neighbour.
+                val previous = presentation.lastFocused
+                val previousRow = pagingRowKeys()[previous.substringBefore(':')]
+                if (id != previous && previousRow != null && previous !in previousRow &&
+                    focus.userNavGeneration == focusNavigation && !focus.isLatestDestination(TvDetailsKey(id))
+                ) return@onFocusChanged
+                focusNavigation = focus.userNavGeneration
                 if (id == "info" && presentation.lastFocused != id) informationReturnTarget = presentation.lastFocused
                 presentation.lastFocused = id
                 if (id.startsWith("episode:")) presentation.lastEpisode = id
```

**File**: `app/shared/ui-subject/src/androidTv/kotlin/ui/subject/details/TvSubjectReviews.kt` (modified, +10/-0)
```diff
@@ -34,6 +34,7 @@ import androidx.compose.runtime.Composable
 import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.mutableIntStateOf
 import androidx.compose.runtime.mutableStateOf
 import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
@@ -173,6 +174,7 @@ internal fun TvSubjectComments(
         }
         previousKeys = keys
     }
+    var focusNavigation by remember { mutableIntStateOf(focus.userNavGeneration) }
     fun anchor(key: String) = Modifier.tvFocusAnchor(focus, TvDetailsKey(key))
         .onFocusChanged {
             if (it.isFocused && isActive) {
@@ -181,6 +183,14 @@ internal fun TvSubjectComments(
                 if (entryFocusPending && focus.userNavGeneration == entryNavigation && key != entryTarget) {
                     return@onFocusChanged
                 }
+                // The list can drop the focused card before this panel recomposes with the new keys, and Compose
+                // then focuses a nearby card. Keep the removed review so the key update restores its neighbour.
+                val previous = panel.focusedItem
+                if (key != previous && previous != null && previous.startsWith("review:") &&
+                    comments.itemSnapshotList.items.none { review -> "review:${review.stableId}" == previous } &&
+                    focus.userNavGeneration == focusNavigation && !focus.isLatestDestination(TvDetailsKey(key))
+                ) return@onFocusChanged
+                focusNavigation = focus.userNavGeneration
                 entryFocusPending = false
                 if (key.startsWith("review:")) lastReview = key
                 onFocused(key)
```

---

### Incident Patch 8: `6f61e140` (2026-09-27)
**Commit Message**: fix(collection): 剧集看过状态改为本地 outbox, 离线标记联网后自动同步 (#3483)

* fix(collection): 剧集看过状态改为本地 outbox, 离线标记联网后自动同步

此前自动标记看过 (播放到 90%) 和手动标记都是直接调服务端接口, 离线时请求失败
就丢了, 联网后也没有东西会重放, 导致离线看完的几集播放记录同步上去了但没标记看过.

现在标记先写本地并入队 episode_collection_pending_op, 由 EpisodeCollectionSyncer
在登录有效、新登录和入队时推送, 同条目同状态合并为一次批量请求. 服务端明确拒绝
(4xx) 时丢弃, 网络或服务端故障时保留. 从服务端刷新剧集时按待同步操作把本地状态
盖回去, 避免离线标记被刷新冲掉.

同步状态页面把播放进度和看过状态两条队列按剧集合并, 一集一张卡, 删除时两边一起删.

数据库版本 26 -> 27.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

* test(collection): 测试名去掉逗号, dex 不支持

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

---------

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `app/shared/app-data/schemas/me.him188.ani.app.data.persistent.database.AniDatabase/27.json` (added, +1836/-0)
```diff
@@ -0,0 +1,1836 @@
+{
+  "formatVersion": 1,
+  "database": {
+    "version": 27,
+    "identityHash": "45b7d7d8be2c537dc6bb0d8e34c12c44",
+    "entities": [
+      {
+        "tableName": "search_history",
+        "createSql": "CREATE TABLE IF NOT EXISTS `${TABLE_NAME}` (`sequence` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `content` TEXT NOT NULL)",
+        "fields": [
+          {
+            "fieldPath": "sequence",
+            "columnName": "sequence",
+            "affinity": "INTEGER",
+            "notNull": true
+          },
+          {
+            "fieldPath": "content",
+            "columnName": "content",
+            "affinity": "TEXT",
+            "notNull": true
+          }
+        ],
+        "primaryKey": {
+          "autoGenerate": true,
+          "columnNames": [
+            "sequence"
+          ]
+        },
+        "indices": [
+          {
+            "name": "distinct_content",
+            "unique": true,
+            "columnNames": [
+              "content"
+            ],
+            "orders": [],
+            "createSql": "CREATE UNIQUE INDEX IF NOT EXISTS `distinct_content` ON `${TABLE_NAME}` (`content`)"
+          },
+          {
+            "name": "sequence_desc",
+            "unique": false,
+            "columnNames": [
+              "sequence"
+            ],
+            "orders": [
+              "DESC"
+            ],
+            "createSql": "CREATE INDEX IF NOT EXISTS `sequence_desc` ON `${TABLE_NAME}` (`sequence` DESC)"
+          }
+        ]
+      },
+      {
+        "tableName": "search_tag",
+        "createSql": "CREATE TABLE IF NOT EXISTS `${TABLE_NAME}` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `content` TEXT NOT NULL, `useCount` INTEGER NOT NULL)",
+        "fields": [
+          {
+            "fieldPath": "id",
+            "columnName": "id",
+            "affinity": "INTEGER",
+            "notNull": true
+          },
+          {
+            "fieldPath": "content",
+            "columnName": "content",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "useCount",
+            "columnName": "useCount",
+            "affinity": "INTEGER",
+            "notNull": true
+          }
+        ],
+        "primaryKey": {
+          "autoGenerate": true,
+          "columnNames": [
+            "id"
+          ]
+        }
+      },
+      {
+        "tableName": "subject_collection",
+        "createSql": "CREATE TABLE IF NOT EXISTS `${TABLE_NAME}` (`subjectId` INTEGER NOT NULL, `name` TEXT NOT NULL, `nameCn` TEXT NOT NULL, `summary` TEXT NOT NULL, `nsfw` INTEGER NOT NULL, `imageLarge` TEXT NOT NULL, `imageThumb` TEXT NOT NULL DEFAULT '', `totalEpisodes` INTEGER NOT NULL, `airDate` INTEGER NOT NULL, `aliases` BLOB NOT NULL, `tags` BLOB NOT NULL, `completeDate` INTEGER NOT NULL, `collectionType` TEXT NOT NULL, `tmdbArt` BLOB, `lastUpdated` INTEGER NOT NULL DEFAULT 0, `lastFetched` INTEGER NOT NULL DEFAULT 0, `cachedStaffUpdated` INTEGER NOT NULL DEFAULT 0, `cachedCharactersUpdated` INTEGER NOT NULL DEFAULT 0, `collection_stats_wish` INTEGER NOT NULL, `collection_stats_doing` INTEGER NOT NULL, `collection_stats_done` INTEGER NOT NULL, `collection_stats_onHold` INTEGER NOT NULL, `collection_stats_dropped` INTEGER NOT NULL, `rating_rank` INTEGER NOT NULL, `rating_total` INTEGER NOT NULL, `rating_score` TEXT NOT NULL, `rating_count_s1` INTEGER NOT NULL, `rating_count_s2` INTEGER NOT NULL, `rating_count_s3` INTEGER NOT NULL, `rating_count_s4` INTEGER NOT NULL, `rating_count_s5` INTEGER NOT NULL, `rating_count_s6` INTEGER NOT NULL, `rating_count_s7` INTEGER NOT NULL, `rating_count_s8` INTEGER NOT NULL, `rating_count_s9` INTEGER NOT NULL, `rating_count_s10` INTEGER NOT NULL, `self_rating_score` INTEGER NOT NULL, `self_rating_comment` TEXT, `self_rating_tags` BLOB NOT NULL, `self_rating_isPrivate` INTEGER NOT NULL, `recurrence_startTime` INTEGER, `recurrence_interval` TEXT, `relations_serie
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/AniDatabase.kt` (modified, +14/-1)
```diff
@@ -30,6 +30,8 @@ import me.him188.ani.app.data.persistent.database.dao.DanmakuDao
 import me.him188.ani.app.data.persistent.database.dao.DanmakuEntity
 import me.him188.ani.app.data.persistent.database.dao.EpisodeCollectionDao
 import me.him188.ani.app.data.persistent.database.dao.EpisodeCollectionEntity
+import me.him188.ani.app.data.persistent.database.dao.EpisodeCollectionPendingOpDao
+import me.him188.ani.app.data.persistent.database.dao.EpisodeCollectionPendingOpEntity
 import me.him188.ani.app.data.persistent.database.dao.EpisodeCommentDao
 import me.him188.ani.app.data.persistent.database.dao.HttpCacheDownloadStateDao
 import me.him188.ani.app.data.persistent.database.dao.PlaybackHistoryDao
@@ -86,8 +88,9 @@ import me.him188.ani.utils.httpdownloader.DownloadState
         PreferredWebMediaSource::class,
         PlaybackHistoryRecordEntity::class,
         PlaybackHistoryPendingOpEntity::class,
+        EpisodeCollectionPendingOpEntity::class,
     ],
-    version = 26,
+    version = 27,
     autoMigrations = [
         AutoMigration(from = 1, to = 2, spec = Migrations.Migration_1_2::class),
         AutoMigration(from = 2, to = 3, spec = Migrations.Migration_2_3::class),
@@ -113,6 +116,7 @@ import me.him188.ani.utils.httpdownloader.DownloadState
         AutoMigration(from = 23, to = 24, spec = Migrations.Migration_23_24::class),
         AutoMigration(from = 24, to = 25, spec = Migrations.Migration_24_25::class),
         AutoMigration(from = 25, to = 26, spec = Migrations.Migration_25_26::class),
+        AutoMigration(from = 26, to = 27, spec = Migrations.Migration_26_27::class),
     ],
     exportSchema = true,
 )
@@ -162,6 +166,7 @@ abstract class AniDatabase : RoomDatabase() {
     abstract fun danmakuDao(): DanmakuDao
     abstract fun preferredWebMediaSourceDao(): PreferredWebMediaSourceDao
     abstract fun playbackHistoryDao(): PlaybackHistoryDao
+    abstract fun episodeCollectionPendingOpDao(): EpisodeCollectionPendingOpDao
 }
 
 expect object AniDatabaseConstructor : RoomDatabaseConstructor<AniDatabase> {
@@ -435,4 +440,12 @@ internal object Migrations {
         override fun onPostMigrate(connection: SQLiteConnection) {
         }
     }
+
+    /**
+     * Added [EpisodeCollectionPendingOpEntity]: 剧集看过状态的本地待同步操作.
+     */
+    class Migration_26_27 : AutoMigrationSpec {
+        override fun onPostMigrate(connection: SQLiteConnection) {
+        }
+    }
 }
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/dao/EpisodeCollectionDao.kt` (modified, +32/-2)
```diff
@@ -153,12 +153,42 @@ interface EpisodeCollectionDao {
     fun filterBySubjectIdPaging(subjectId: Int): PagingSource<Int, EpisodeCollectionEntity>
 
 
+    @Query("SELECT * FROM episode_collection WHERE episodeId IN (:episodeIds)")
+    fun filterByEpisodeIds(episodeIds: Collection<Int>): Flow<List<EpisodeCollectionEntity>>
+
     @Upsert
-    suspend fun upsert(item: EpisodeCollectionEntity)
+    suspend fun upsertEntities(item: EpisodeCollectionEntity)
 
     @Upsert
+    suspend fun upsertEntities(items: List<EpisodeCollectionEntity>)
+
+    /**
+     * 把服务端返回的剧集写进本地. 用户本地改过但还没同步上去的看过状态 (见 [EpisodeCollectionPendingOpEntity])
+     * 会在写入后按待同步操作重新盖回去, 否则一次刷新就把离线时的标记冲掉了.
+     */
+    @Transaction
+    suspend fun upsert(item: EpisodeCollectionEntity) {
+        upsertEntities(item)
+        reapplyPendingCollectionTypes()
+    }
+
     @Transaction
-    suspend fun upsert(item: List<EpisodeCollectionEntity>)
+    suspend fun upsert(item: List<EpisodeCollectionEntity>) {
+        upsertEntities(item)
+        reapplyPendingCollectionTypes()
+    }
+
+    @Query(
+        """
+        UPDATE episode_collection SET selfCollectionType = (
+            SELECT p.collectionType FROM episode_collection_pending_op p
+            WHERE p.episodeId = episode_collection.episodeId
+            ORDER BY p.id DESC LIMIT 1
+        )
+        WHERE episodeId IN (SELECT episodeId FROM episode_collection_pending_op)
+        """,
+    )
+    suspend fun reapplyPendingCollectionTypes()
 
     @Query("""UPDATE episode_collection SET selfCollectionType = :type WHERE subjectId = :subjectId AND episodeId = :episodeId""")
     suspend fun updateSelfCollectionType(
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/dao/EpisodeCollectionPendingOpDao.kt` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.data.persistent.database.dao
+
+import androidx.room.Dao
+import androidx.room.Entity
+import androidx.room.Index
+import androidx.room.Insert
+import androidx.room.OnConflictStrategy
+import androidx.room.PrimaryKey
+import androidx.room.Query
+import androidx.room.Transaction
+import kotlinx.coroutines.flow.Flow
+import me.him188.ani.datasources.api.topic.UnifiedCollectionType
+
+/**
+ * 剧集收藏状态的本地待同步操作 (outbox). 用户改了剧集看过状态先写本地, 再由 syncer 推到服务端.
+ *
+ * 每集只保留最后一次操作, 旧操作被新操作顶掉.
+ */
+@Entity(
+    tableName = "episode_collection_pending_op",
+    indices = [
+        Index(value = ["episodeId"], unique = true),
+    ],
+)
+data class EpisodeCollectionPendingOpEntity(
+    @PrimaryKey(autoGenerate = true) val id: Long = 0,
+    val subjectId: Int,
+    val episodeId: Int,
+    val collectionType: UnifiedCollectionType,
+    val updatedAtMillis: Long,
+)
+
+@Dao
+interface EpisodeCollectionPendingOpDao {
+    @Query("SELECT * FROM episode_collection_pending_op ORDER BY id ASC")
+    fun pendingOpsFlow(): Flow<List<EpisodeCollectionPendingOpEntity>>
+
+    @Query("SELECT * FROM episode_collection_pending_op ORDER BY id ASC")
+    suspend fun getPendingOps(): List<EpisodeCollectionPendingOpEntity>
+
+    @Insert(onConflict = OnConflictStrategy.ABORT)
+    suspend fun insertPendingOp(op: EpisodeCollectionPendingOpEntity): Long
+
+    @Query("DELETE FROM episode_collection_pending_op WHERE episodeId IN (:episodeIds)")
+    suspend fun deletePendingOpsByEpisodeIds(episodeIds: Collection<Int>)
+
+    @Query("DELETE FROM episode_collection_pending_op WHERE id IN (:ids)")
+    suspend fun deletePendingOpsByIds(ids: Collection<Long>)
+
+    @Transaction
+    suspend fun replacePendingOps(ops: List<EpisodeCollectionPendingOpEntity>): List<Long> {
+        deletePendingOpsByEpisodeIds(ops.map { it.episodeId })
+        return ops.map { insertPendingOp(it) }
+    }
+}
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/repository/RepositoryModules.kt` (modified, +3/-0)
```diff
@@ -20,6 +20,7 @@ import me.him188.ani.app.data.persistent.database.AniDatabase
 import me.him188.ani.app.data.repository.episode.AnimeScheduleRepository
 import me.him188.ani.app.data.repository.episode.BangumiCommentRepository
 import me.him188.ani.app.data.repository.episode.EpisodeCollectionRepository
+import me.him188.ani.app.data.repository.episode.EpisodeCollectionSyncer
 import me.him188.ani.app.data.repository.episode.EpisodeCommentRepository
 import me.him188.ani.app.data.repository.episode.EpisodeProgressRepository
 import me.him188.ani.app.data.repository.media.EpisodePreferencesRepository
@@ -207,10 +208,12 @@ fun KoinApplication.repositoryModules(
         EpisodeCollectionRepository(
             subjectDao = database.subjectCollection(),
             episodeCollectionDao = database.episodeCollection(),
+            pendingOpDao = database.episodeCollectionPendingOpDao(),
             episodeService = get(),
             animeScheduleRepository = get(),
             subjectCollectionRepository = inject(),
             getEpisodeTypeFiltersUseCase = get(),
+            onDirtyChanged = { get<EpisodeCollectionSyncer>().requestSync() },
         )
     }
 
```

---

### Incident Patch 9: `ee3c91e4` (2026-09-26)
**Commit Message**: fix(playback): 同步状态页面给删除操作补上条目名和剧集名

删除操作只带剧集 id, 此前一律显示为"剧集 ID xxx · 未知剧集". 现在从本地记录
(含已删除的墓碑) 里按剧集 id 补名字, 只有本地完全没有记录时才回退到未知.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/persistent/database/dao/PlaybackHistoryDao.kt` (modified, +9/-0)
```diff
@@ -83,6 +83,10 @@ interface PlaybackHistoryDao {
     @Query("SELECT * FROM playback_history_record WHERE episodeId IN (:episodeIds) AND deletedAtMillis IS NULL")
     fun activeRecordsFlowByEpisodeIds(episodeIds: Collection<Int>): Flow<List<PlaybackHistoryRecordEntity>>
 
+    /** 给定剧集的记录, 包含已删除的墓碑; 同步页面用它给删除操作补条目名. */
+    @Query("SELECT * FROM playback_history_record WHERE episodeId IN (:episodeIds)")
+    fun recordsFlowByEpisodeIds(episodeIds: Collection<Int>): Flow<List<PlaybackHistoryRecordEntity>>
+
     @Query("SELECT * FROM playback_history_record WHERE deletedAtMillis IS NULL")
     suspend fun getActiveRecords(): List<PlaybackHistoryRecordEntity>
 
@@ -241,6 +245,11 @@ fun createMemoryPlaybackHistoryDao(): PlaybackHistoryDao {
             }
         }
 
+        override fun recordsFlowByEpisodeIds(episodeIds: Collection<Int>): Flow<List<PlaybackHistoryRecordEntity>> {
+            val ids = episodeIds.toSet()
+            return recordsStore.map { records -> records.filter { it.episodeId in ids } }
+        }
+
         override suspend fun getActiveRecords(): List<PlaybackHistoryRecordEntity> {
             return recordsStore.value.filter { it.deletedAtMillis == null }
         }
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/repository/player/EpisodePlayHistoryRepository.kt` (modified, +9/-0)
```diff
@@ -75,6 +75,9 @@ interface EpisodePlayHistoryRepository {
      * 与 [flow] 不同, 不会把全部记录读进内存.
      */
     fun flowByEpisodeIds(episodeIds: Collection<Int>): Flow<List<EpisodeHistory>>
+
+    /** 同 [flowByEpisodeIds], 但包含已删除的记录; 用于给待同步的删除操作显示条目名. */
+    fun allHistoriesFlowByEpisodeIds(episodeIds: Collection<Int>): Flow<List<EpisodeHistory>>
     val pendingOpsFlow: Flow<List<PlaybackHistoryPendingOp>>
     val lastSyncAtMillisFlow: Flow<Long>
 
@@ -130,6 +133,12 @@ class EpisodePlayHistoryRepositoryImpl(
             records.map { it.toEpisodeHistory() }
         }
     }
+    override fun allHistoriesFlowByEpisodeIds(episodeIds: Collection<Int>): Flow<List<EpisodeHistory>> {
+        if (episodeIds.isEmpty()) return flowOf(emptyList())
+        return playbackHistoryDao.recordsFlowByEpisodeIds(episodeIds).map { records ->
+            records.map { it.toEpisodeHistory() }
+        }
+    }
     override val pendingOpsFlow: Flow<List<PlaybackHistoryPendingOp>> = playbackHistoryDao.pendingOpsFlow().map { ops ->
         ops.map { it.toPendingOp() }
     }
```

**File**: `app/shared/app-data/src/commonTest/kotlin/data/repository/player/EpisodePlayHistoryRepositoryTest.kt` (modified, +14/-0)
```diff
@@ -86,6 +86,20 @@ class EpisodePlayHistoryRepositoryTest {
         assertEquals(emptyList(), repository.flowByEpisodeIds(emptyList()).first())
     }
 
+    @Test
+    fun `allHistoriesFlowByEpisodeIds includes deleted records`() = runTest {
+        val repository = createRepository()
+        repository.saveOrUpdate(episodeId = 1, positionMillis = 10, durationMillis = 100, subjectName = "A")
+        repository.saveOrUpdate(episodeId = 2, positionMillis = 20, durationMillis = 100, subjectName = "B")
+        repository.remove(2)
+
+        val histories = repository.allHistoriesFlowByEpisodeIds(listOf(1, 2, 99)).first().associateBy { it.episodeId }
+        assertEquals(setOf(1, 2), histories.keys)
+        assertEquals("B", histories.getValue(2).subjectName)
+        assertTrue(histories.getValue(2).isDeleted)
+        assertEquals(emptyList(), repository.allHistoriesFlowByEpisodeIds(emptyList()).first())
+    }
+
     @Test
     fun `successive saves keep only the latest pending op for each episode`() = runTest {
         val repository = createRepository()
```

**File**: `app/shared/src/commonMain/kotlin/ui/playback/PlaybackHistoryScreen.kt` (modified, +36/-6)
```diff
@@ -71,6 +71,10 @@ import androidx.compose.ui.text.style.TextOverflow
 import androidx.compose.ui.tooling.preview.Preview
 import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
+import kotlinx.coroutines.ExperimentalCoroutinesApi
+import kotlinx.coroutines.flow.distinctUntilChanged
+import kotlinx.coroutines.flow.flatMapLatest
+import kotlinx.coroutines.flow.map
 import kotlinx.coroutines.launch
 import me.him188.ani.app.data.models.player.EpisodeHistory
 import me.him188.ani.app.data.repository.player.EpisodePlayHistoryRepository
@@ -153,6 +157,17 @@ class PlaybackHistoryViewModel : AbstractViewModel(), KoinComponent {
     val pendingOpsFlow = repository.pendingOpsFlow
         .stateInBackground(emptyList())
 
+    /**
+     * 待同步操作涉及的本地记录, 含已删除的. 删除操作本身不带条目名, 显示时从这里补.
+     */
+    @OptIn(ExperimentalCoroutinesApi::class)
+    val pendingOpHistoriesFlow = repository.pendingOpsFlow
+        .map { ops -> ops.mapTo(mutableSetOf()) { it.episodeId } }
+        .distinctUntilChanged()
+        .flatMapLatest { repository.allHistoriesFlowByEpisodeIds(it) }
+        .map { histories -> histories.associateBy { it.episodeId } }
+        .stateInBackground(emptyMap())
+
     fun delete(episodeIds: Collection<Int>) {
         if (episodeIds.isEmpty()) return
         backgroundScope.launch {
@@ -425,8 +440,9 @@ fun PlaybackHistorySyncStatusScreen(
     windowInsets: WindowInsets = AniWindowInsets.forPageContent(),
 ) {
     val pendingOps by vm.pendingOpsFlow.collectAsStateWithLifecycle()
+    val pendingOpHistories by vm.pendingOpHistoriesFlow.collectAsStateWithLifecycle()
     PlaybackHistorySyncStatusScreen(
-        pendingOps = pendingOps.toSyncStatusUiItems(),
+        pendingOps = pendingOps.toSyncStatusUiItems(pendingOpHistories),
         onNavigateBack = onNavigateBack,
         onDeletePendingOps = vm::deletePendingOps,
         modifier = modifier,
@@ -768,26 +784,40 @@ private fun List<EpisodeHistory>.toUiItems(): List<PlaybackHistoryUiItem> {
 }
 
 @Composable
-private fun List<PlaybackHistoryPendingOp>.toSyncStatusUiItems(): List<PlaybackHistorySyncStatusUiItem> {
+private fun List<PlaybackHistoryPendingOp>.toSyncStatusUiItems(
+    histories: Map<Int, EpisodeHistory>,
+): List<PlaybackHistorySyncStatusUiItem> {
     val upsertName = stringResource(Lang.playback_history_sync_op_upsert)
     val deleteName = stringResource(Lang.playback_history_sync_op_delete)
+    return toSyncStatusUiItems(histories, upsertName = upsertName, deleteName = deleteName)
+}
+
+/**
+ * 删除操作只带剧集 id, 条目名和剧集名从本地记录 [histories] (含已删除的墓碑) 里补; 更新操作自带名字, 缺失时同样回退到记录.
+ */
+internal fun List<PlaybackHistoryPendingOp>.toSyncStatusUiItems(
+    histories: Map<Int, EpisodeHistory>,
+    upsertName: String,
+    deleteName: String,
+): List<PlaybackHistorySyncStatusUiItem> {
     return map { op ->
+        val history = histories[op.episodeId]
         when (op) {
             is PlaybackHistoryPendingOp.Upsert -> PlaybackHistorySyncStatusUiItem(
                 id = op.id,
                 episodeId = op.episodeId,
                 operationName = upsertName,
-                subjectName = op.subjectName,
-                episodeName = op.episodeName,
+                subjectName = op.subjectName ?: history?.subjectName,
+                episodeName = op.episodeName ?: history?.episodeName,
                 versionMillis = op.updatedAtMillis,
             )
 
             is PlaybackHistoryPendingOp.Delete -> PlaybackHistorySyncStatusUiItem(
                 id = op.id,
                 episodeId = op.episodeId,
                 operationName = deleteName,
-                subjectName = null,
-                episodeName = null,
+                subjectName = history?.subjectName,
+                episodeName = history?.episodeName,
                 versionMillis = op.deletedAtMillis,
             )
         }
```

**File**: `app/shared/src/desktopTest/kotlin/ui/playback/PlaybackHistorySyncStatusUiItemsTest.kt` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/*
+ * Copyright (C) 2024-2026 OpenAni and contributors.
+ *
+ * 此源代码的使用受 GNU AFFERO GENERAL PUBLIC LICENSE version 3 许可证的约束, 可以在以下链接找到该许可证.
+ * Use of this source code is governed by the GNU AGPLv3 license, which can be found at the following link.
+ *
+ * https://github.com/open-ani/ani/blob/main/LICENSE
+ */
+
+package me.him188.ani.app.ui.playback
+
+import me.him188.ani.app.data.models.player.EpisodeHistory
+import me.him188.ani.app.data.repository.player.PlaybackHistoryPendingOp
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNull
+
+class PlaybackHistorySyncStatusUiItemsTest {
+    private val histories = mapOf(
+        11 to EpisodeHistory(
+            episodeId = 11,
+            positionMillis = 0,
+            subjectName = "葬送的芙莉莲",
+            episodeName = "别离",
+            deletedAtMillis = 200,
+        ),
+    )
+
+    @Test
+    fun `delete op takes names from deleted local record`() {
+        val items = listOf(
+            PlaybackHistoryPendingOp.Delete(id = 1, episodeId = 11, deletedAtMillis = 200),
+        ).toSyncStatusUiItems(histories, upsertName = "更新", deleteName = "删除")
+
+        val item = items.single()
+        assertEquals("删除", item.operationName)
+        assertEquals("葬送的芙莉莲", item.subjectName)
+        assertEquals("别离", item.episodeName)
+        assertEquals(200, item.versionMillis)
+    }
+
+    @Test
+    fun `delete op without local record keeps names null`() {
+        val item = listOf(
+            PlaybackHistoryPendingOp.Delete(id = 1, episodeId = 99, deletedAtMillis = 200),
+        ).toSyncStatusUiItems(histories, upsertName = "更新", deleteName = "删除").single()
+
+        assertNull(item.subjectName)
+        assertNull(item.episodeName)
+    }
+
+    @Test
+    fun `upsert op prefers its own names and falls back to local record`() {
+        val items = listOf(
+            PlaybackHistoryPendingOp.Upsert(
+                id = 1, episodeId = 11, subjectId = 1,
+                subjectName = "自带名字", episodeName = null,
+                positionMillis = 10, durationMillis = 100, updatedAtMillis = 300,
+            ),
+        ).toSyncStatusUiItems(histories, upsertName = "更新", deleteName = "删除")
+
+        val item = items.single()
+        assertEquals("更新", item.operationName)
+        assertEquals("自带名字", item.subjectName)
+        assertEquals("别离", item.episodeName)
+    }
+}
```

---

### Incident Patch 10: `68d5b224` (2026-09-26)
**Commit Message**: fix(player): 看完一集后保留播放记录, 只是下次不再恢复到该位置

此前播放到距结尾 5 秒内会直接删除播放记录, 这是播放记录还只用于"记住上次看到哪"时的设计.
加入云同步和播放历史页面后, 看完的集数会从历史里消失, 断网时还会在同步页面留下一条
"删除记录 · 未知剧集".

现在看完时照常保存位置 (钳到时长以内), 由 EpisodeHistory.isFinished 判断是否已看完;
恢复进度时跳过已看完的记录, 从头播放, 避免立刻结束并触发自动连播.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `app/shared/app-data/src/commonMain/kotlin/data/models/player/EpisodeHistory.kt` (modified, +15/-0)
```diff
@@ -31,6 +31,21 @@ data class EpisodeHistory(
     val isDeleted: Boolean get() = deletedAtMillis != null
 
     val versionMillis: Long get() = maxOf(updatedAtMillis, deletedAtMillis ?: 0L)
+
+    /**
+     * 是否已看完: 位置距离结尾不足 [FINISHED_THRESHOLD_MILLIS]. 时长未知时无法判断, 视为未看完.
+     *
+     * 看完的记录仍然保留 (供历史列表和剧集进度显示), 但下次播放不再恢复到这个位置, 否则会立刻播放结束并触发自动连播.
+     */
+    val isFinished: Boolean
+        get() {
+            val duration = durationMillis ?: return false
+            return duration > 0L && duration - positionMillis < FINISHED_THRESHOLD_MILLIS
+        }
+
+    companion object {
+        const val FINISHED_THRESHOLD_MILLIS: Long = 5_000
+    }
 }
 
 /**
```

**File**: `app/shared/app-data/src/commonMain/kotlin/data/repository/player/EpisodePlayHistoryRepository.kt` (modified, +6/-3)
```diff
@@ -103,7 +103,10 @@ interface EpisodePlayHistoryRepository {
 
     suspend fun deletePendingOps(ids: Collection<Long>)
 
-    suspend fun getPositionMillisByEpisodeId(episodeId: Int): Long?
+    /**
+     * 下次播放应恢复到的位置. 没有记录、记录已删除或已看完 ([EpisodeHistory.isFinished]) 时为 `null`, 表示从头播放.
+     */
+    suspend fun getResumePositionMillisByEpisodeId(episodeId: Int): Long?
 }
 
 class EpisodePlayHistoryRepositoryImpl(
@@ -251,11 +254,11 @@ class EpisodePlayHistoryRepositoryImpl(
         playbackHistoryDao.deletePendingOpsByIds(ids)
     }
 
-    override suspend fun getPositionMillisByEpisodeId(episodeId: Int): Long? {
+    override suspend fun getResumePositionMillisByEpisodeId(episodeId: Int): Long? {
         ensureLegacyDataStoreMigrated()
         return playbackHistoryDao.getRecordByEpisodeId(episodeId)
             ?.toEpisodeHistory()
-            ?.takeUnless(EpisodeHistory::isDeleted)
+            ?.takeUnless { it.isDeleted || it.isFinished }
             ?.positionMillis
             ?.also {
                 logger.info { "load play progress for episode $episodeId: positionMillis=$it" }
```

**File**: `app/shared/app-data/src/commonMain/kotlin/domain/player/extension/RememberPlayProgressExtension.kt` (modified, +16/-16)
```diff
@@ -20,6 +20,7 @@ import kotlinx.coroutines.sync.Mutex
 import kotlinx.coroutines.sync.withLock
 import kotlinx.coroutines.withContext
 import me.him188.ani.app.data.models.episode.displayName
+import me.him188.ani.app.data.models.player.EpisodeHistory
 import me.him188.ani.app.data.repository.player.EpisodePlayHistoryRepository
 import me.him188.ani.app.domain.episode.EpisodeFetchSelectPlayState
 import me.him188.ani.app.domain.episode.EpisodeSession
@@ -43,6 +44,8 @@ import kotlin.time.Duration.Companion.seconds
  * - 切换数据源
  * - 暂停
  * - 播放完成
+ *
+ * 播放完成时位置照常保存 (钳到时长以内), 记录不会被删除; 恢复时由 [EpisodeHistory.isFinished] 判断是否从头播放.
  */
 class RememberPlayProgressExtension(
     private val context: PlayerExtensionContext,
@@ -103,7 +106,7 @@ class RememberPlayProgressExtension(
                                 haveResumedOnce = true
                             } else {
                                 val positionMillis =
-                                    playProgressRepository.getPositionMillisByEpisodeId(episodeSession.episodeId)
+                                    playProgressRepository.getResumePositionMillisByEpisodeId(episodeSession.episodeId)
                                 if (positionMillis == null) {
                                     logger.info { "Did not find saved position" }
                                     haveResumedOnce = true
@@ -198,21 +201,18 @@ class RememberPlayProgressExtension(
             return
         }
 
-        if (videoDurationMillis - currentPositionMillis < 5000 || currentPositionMillis > videoDurationMillis) {
-            playProgressRepository.remove(episodeId)
-        } else {
-            val info = latestInfoBundle(episodeId, episodeSession)
-            playProgressRepository.saveOrUpdate(
-                episodeId = episodeId,
-                positionMillis = currentPositionMillis,
-                subjectId = info?.subjectId,
-                episodeSort = info?.episodeInfo?.sort?.number,
-                subjectName = info?.subjectInfo?.displayName,
-                subjectImageUrl = info?.subjectInfo?.imageLarge,
-                episodeName = info?.episodeInfo?.displayName,
-                durationMillis = videoDurationMillis,
-            )
-        }
+        // 有些后端上报的位置会略微超过时长 (#1506), 钳到时长以内, 保证进度比例不超过 1 且能被识别为已看完.
+        val info = latestInfoBundle(episodeId, episodeSession)
+        playProgressRepository.saveOrUpdate(
+            episodeId = episodeId,
+            positionMillis = currentPositionMillis.coerceAtMost(videoDurationMillis),
+            subjectId = info?.subjectId,
+            episodeSort = info?.episodeInfo?.sort?.number,
+            subjectName = info?.subjectInfo?.displayName,
+            subjectImageUrl = info?.subjectInfo?.imageLarge,
+            episodeName = info?.episodeInfo?.displayName,
+            durationMillis = videoDurationMillis,
+        )
     }
 
     private suspend fun latestInfoBundle(
```

**File**: `app/shared/app-data/src/commonTest/kotlin/data/repository/player/EpisodePlayHistoryRepositoryTest.kt` (modified, +23/-2)
```diff
@@ -142,7 +142,7 @@ class EpisodePlayHistoryRepositoryTest {
             ),
         )
 
-        assertEquals(20_000, repository.getPositionMillisByEpisodeId(1))
+        assertEquals(20_000, repository.getResumePositionMillisByEpisodeId(1))
 
         val history = repository.flow.first().single()
         assertEquals(1, history.episodeId)
@@ -158,6 +158,27 @@ class EpisodePlayHistoryRepositoryTest {
         assertEquals(50, pendingOp.updatedAtMillis)
     }
 
+    @Test
+    fun `finished record is kept but not resumed`() = runTest {
+        val repository = createRepository()
+        repository.saveOrUpdate(
+            episodeId = 1,
+            positionMillis = 100_000 - EpisodeHistory.FINISHED_THRESHOLD_MILLIS + 1,
+            subjectId = 10,
+            durationMillis = 100_000,
+        )
+
+        val history = repository.flow.first().single()
+        assertTrue(history.isFinished)
+        assertEquals(100_000 - EpisodeHistory.FINISHED_THRESHOLD_MILLIS + 1, history.positionMillis)
+        assertNull(repository.getResumePositionMillisByEpisodeId(1))
+        assertTrue(repository.pendingOpsFlow.first().single() is PlaybackHistoryPendingOp.Upsert)
+
+        // 未看完则照常恢复
+        repository.saveOrUpdate(episodeId = 1, positionMillis = 100_000 - EpisodeHistory.FINISHED_THRESHOLD_MILLIS)
+        assertEquals(100_000 - EpisodeHistory.FINISHED_THRESHOLD_MILLIS, repository.getResumePositionMillisByEpisodeId(1))
+    }
+
     @Test
     fun `remove creates tombstone and enqueues pending delete op`() = runTest {
         val repository = createRepository()
@@ -176,7 +197,7 @@ class EpisodePlayHistoryRepositoryTest {
         assertEquals(1, tombstone.episodeId)
         assertEquals(200, tombstone.deletedAtMillis)
         assertFalse(tombstone.isDirty)
-        assertNull(repository.getPositionMillisByEpisodeId(1))
+        assertNull(repository.getResumePositionMillisByEpisodeId(1))
 
         val pendingOps = repository.pendingOpsFlow.first()
         assertEquals(1, pendingOps.size)
```

**File**: `app/shared/app-data/src/commonTest/kotlin/domain/episode/EpisodeFetchPlayStateSwitchEpisodeTest.kt` (modified, +4/-3)
```diff
@@ -110,7 +110,7 @@ class EpisodeFetchPlayStateSwitchEpisodeTest : AbstractPlayerExtensionTest() {
             advanceUntilIdle() // 不应自动切换到下一集数
 
             // 没有实际加载媒体源时，不会覆盖或删除旧进度
-            assertEquals(3000, playHistory.getPositionMillisByEpisodeId(initialEpisodeId))
+            assertEquals(3000, playHistory.getResumePositionMillisByEpisodeId(initialEpisodeId))
 
             assertEquals(initialEpisodeId, state.getCurrentEpisodeId())
         } finally {
@@ -145,8 +145,9 @@ class EpisodeFetchPlayStateSwitchEpisodeTest : AbstractPlayerExtensionTest() {
             suite.player.injectEnded()
             advanceUntilIdle() // 自动切换到下一集数
 
-            // 前一集播放完毕了
-            assertEquals(null, playHistory.getPositionMillisByEpisodeId(initialEpisodeId))
+            // 前一集播放完毕了: 记录保留, 但不再恢复
+            assertEquals(null, playHistory.getResumePositionMillisByEpisodeId(initialEpisodeId))
+            assertEquals(100_000, playHistory.flow.first().single { it.episodeId == initialEpisodeId }.positionMillis)
 
             assertEquals(newEpisodeId, state.getCurrentEpisodeId())
 
```

#### Recent Merged Pull Requests:
- **PR #3507** (2026-09-30): fix(player): Android 视频输出移除超时后在原位置重新打开媒体, 修复切换全屏或切到后台后黑屏 (@Him188)
- **PR #3506** (2026-09-30): fix(danmaku): 弹弹 play 匹配接口失败时返回 matches=null, 修复弹幕获取抛出反序列化异常 (@Him188)
- **PR #3500** (2026-09-30): 修复sync时全部模块 androidDeviceTest 无法解析 kotlin-test (@GeneralK1ng)
- **PR #3497** (2026-09-28): ci: 去掉自托管 Mac 上的 macOS 验证 (@Him188)
- **PR #3496** (2026-09-28): ci: 在自托管 Mac 上运行 arm64 instrumented test (@Him188)
- **PR #3492** (2026-09-28): ci: instrumented test 与构建并行, 去掉重复的 push 构建, 修复不稳定的测试 (@Him188)
- **PR #3491** (2026-09-28): Fix Android log-copy crashes and enhancement graph rebuilds (@openanibot)
- **PR #3489** (2026-09-27): fix(episode): 剧集列表按类型分组, 上一集/下一集只在同类型内切换 (@Him188)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
