# Forensic Learning Record (Deep Inspection): edenfunf/reelmimic

> **Canonical Artifact**: `07_PROJECT_LEARNING/edenfunf-reelmimic-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/edenfunf/reelmimic](https://github.com/edenfunf/reelmimic))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:23:19.568Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `edenfunf/reelmimic`
- **Description**: Show it a video you love. Get a new video in the same style. An AI crew (Claude Code or Codex) plans, builds and reviews it with you.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1438 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/anime-cel/template/render.mjs`
```
// render.mjs: renders studio.html in headless Chrome. Length and fps come from the page (PROJECT in src/config.js).
//
//   Look at it (open the images with your image viewer / Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
//         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//   Make the video:
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
//                                                                                              only frames of shots whose files changed are redrawn)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
//   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
//   at once on this machine; the rest wait their turn.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
// Chromium builds Playwright downloaded (~/.cache/ms-playwright/chromium-NNNN), newest first
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map(n => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
// comma-separated fields, keeping commas inside parentheses ('PLK.MX(1.38),PLK.WL,500,300'); numbers stay numbers
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };

// JPEG frames decode as full-range (yuvj420p); without this the MP4 is flagged full-range and some players/platforms
// show it washed out or with crushed shadows. Convert to standard (tv) range and say so.
const TV_RANGE = ['-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv'];

if (args.encode) {
  // no page here, so read PROJECT.audio from the config file (encoding used to drop the music when --audio was left out)
  const cfg = existsSync('src/config.js') ? readFileSync('src/config.js', 'utf8') : '';
  const audio = args.audio || cfg.match(/\baudio\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const out = args.out || 'out/video.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  if (audio && !existsSync(audio)) { console.error(`audio file not found: ${audio}`); process.exit(1); }
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ' — WARNING: no audio track (pass --audio or set PROJECT.audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', ...TV_RANGE, '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// --soft-gl: no GPU on this machine; render WebGL in software (SwiftShader), which Chrome only allows when asked.
// --gpu-angle=vulkan|gl-egl: headless Linux on an NVIDIA GPU (e.g. a cloud or cluster node); plain --use-gl=angle gets
// no WebGL context there. Check which GPU Chrome actually lands on with gpu_probe.mjs.
const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
// Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
// A slot whose owner died (its turn was cut off) is taken back.
// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
const BULK = !!(args.frames || args.clip || args.png);
const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function takeSlot() {
  mkdirSync(SLOT_DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const f = `${SLOT_DIR}/slot${i}`;
      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
    }
    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
}
// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
try {
  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
    const p = `${tmpdir()}/${d}`;
    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
  }
} catch {}
const slot = await takeSlot();
process.on('exit', () => { try { unlinkSync(slot); } catch {} });
let browser;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });

browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
// Frame key = hash(every shared file) + hash(the scene file that draws the frame's shot). Shared: 
```

### Core Architecture Module: `.claude/skills/blender-product-film/scripts/render_shots.py`
```
#!/usr/bin/env python3
"""render_shots.py — render every shot spec in <build>/shots/*.json with Blender, then make a review sheet per shot.

    python render_shots.py <build_dir> --quality preview|final|cycles [--only S1,S4] [--stills auto|0.5,1.5] [--sheet-every 0.5] [--cut]
    --cut: cut the rendered frames with build/edit.json into out/<quality>_cut.mp4 and run compare.py against the reference

Frames go to <build>/renders/<quality>/<id>/f####.png; review sheets to <build>/../out/check/<id>_<quality>.jpg
(one tile every --sheet-every seconds, timestamped). --stills renders just those times per shot (fast look-dev).
"""
import argparse, glob, json, os, subprocess, sys, time, shutil
from PIL import Image, ImageDraw

BLENDER = os.environ.get("BLENDER") or shutil.which("blender") or "blender"
HERE = os.path.dirname(os.path.abspath(__file__))


def sheet(frames, fps, every, out, label):
    picks = frames[::max(1, round(every * fps))][:12]
    if not picks: return
    ims = [Image.open(f).convert("RGB") for f in picks]; w = 480; h = round(ims[0].height * w / ims[0].width)
    cols = min(6, len(ims)); rows = -(-len(ims) // cols)
    S = Image.new("RGB", (cols * w, rows * h + 30), (20, 20, 20)); d = ImageDraw.Draw(S)
    d.text((8, 6), label, fill=(230, 230, 230))
    for i, (im, f) in enumerate(zip(ims, picks)):
        x, y = (i % cols) * w, 30 + (i // cols) * h; S.paste(im.resize((w, h)), (x, y))
        idx = frames.index(f); d.rectangle([x, y, x + 64, y + 18], fill=(0, 0, 0)); d.text((x + 4, y + 3), f"{idx / fps:.2f}s", fill=(255, 255, 255))
    S.save(out, quality=90)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("build"); ap.add_argument("--quality", default="preview")
    ap.add_argument("--only"); ap.add_argument("--stills"); ap.add_argument("--sheet-every", type=float, default=0.5)
    ap.add_argument("--cut", action="store_true", help="after rendering, cut these frames with build/edit.json and run video-clone compare.py")
    a = ap.parse_args()
    shots = sorted(glob.glob(os.path.join(a.build, "shots", "*.json")))
    if a.only: shots = [s for s in shots if os.path.splitext(os.path.basename(s))[0] in a.only.split(",")]
    check = os.path.join(a.build, "..", "out", "check"); os.makedirs(check, exist_ok=True)
    for sp in shots:
        sid = os.path.splitext(os.path.basename(sp))[0]; spec = json.load(open(sp, encoding="utf-8")); fps = spec.get("fps", 30)
        out = os.path.join(a.build, "renders", "stills" if a.stills else a.quality, sid)
        if not a.stills and os.path.isdir(out): shutil.rmtree(out)
        cmd = [BLENDER, "-b", "--factory-startup", "-P", os.path.join(HERE, "pfilm.py"), "--", "--shot", sp, "--out", out, "--quality", a.quality]
        if a.stills:   # "auto" = start / middle / end of THIS shot (shots have different lengths)
            d = spec.get("duration", 3.0)
            st = f"{min(0.15, d * 0.1):.2f},{d / 2:.2f},{max(0, d - 0.15):.2f}" if a.stills == "auto" else a.stills
            cmd += ["--stills", st]
        t0 = time.time(); r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if "PFILM_DONE" not in r.stdout:
            print(f"{sid}: FAILED\n" + "\n".join(l for l in (r.stdout + r.stderr).splitlines() if "Error" in l or "Traceback" in l or "line " in l)[-2000:]); continue
        for l in r.stdout.splitlines():
            if l.startswith("PFILM_WARN"): print("  ⚠", l[11:])
        frames = sorted(glob.glob(os.path.join(out, "*.png")))
        el = time.time() - t0
        if a.stills:
            sheet(frames, 1, 1, os.path.join(check, f"{sid}_stills.jpg"), f"{sid} stills {a.stills}")
        else:
            sheet(frames, fps, a.sheet_every, os.path.join(check, f"{sid}_{a.quality}.jpg"), f"{sid} · {a.quality} · {len(frames)} frames")
        print(f"{sid}: {len(frames)} images in {el:.0f}s ({el / max(1, len(frames)):.2f}s each)")
    if a.cut and not a.stills:
        ed_path = os.path.join(a.build, "edit.json")
        if not os.path.exists(ed_path): print("--cut: no build/edit.json yet"); return
        ed = json.load(open(ed_path, encoding="utf-8"))
        for sh in ed["shots"]:
            if sh.get("frames"): sh["frames"] = f"renders/{a.quality}/{sh['id']}"
        ed["out"] = f"../out/{a.quality}_cut.mp4"
        if a.quality == "preview": ed["size"] = [960, 540]
        tmp = os.path.join(a.build, f"edit_{a.quality}.json"); json.dump(ed, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        subprocess.run([sys.executable, os.path.join(HERE, "finish.py"), tmp], check=True)
        cmp = os.path.join(HERE, "..", "..", "video-clone", "scripts", "compare.py")
        proj = os.path.abspath(os.path.join(a.build, ".."))
        subprocess.run([sys.executable, cmp, proj, "--video", f"out/{a.quality}_cut.mp4"])


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/skills/crayon-storybook/template/render.mjs`
```
// render.mjs: renders studio.html in headless Chrome. Length and fps come from the page (PROJECT in src/config.js).
//
//   Look at it (open the images with your image viewer / Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
//         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//   Make the video:
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
//                                                                                              only frames of shots whose files changed are redrawn)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
//   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
//   at once on this machine; the rest wait their turn.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
// Chromium builds Playwright downloaded (~/.cache/ms-playwright/chromium-NNNN), newest first
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map(n => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
// comma-separated fields, keeping commas inside parentheses ('PLK.MX(1.38),PLK.WL,500,300'); numbers stay numbers
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };

// JPEG frames decode as full-range (yuvj420p); without this the MP4 is flagged full-range and some players/platforms
// show it washed out or with crushed shadows. Convert to standard (tv) range and say so.
const TV_RANGE = ['-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv'];

if (args.encode) {
  // no page here, so read PROJECT.audio from the config file (encoding used to drop the music when --audio was left out)
  const cfg = existsSync('src/config.js') ? readFileSync('src/config.js', 'utf8') : '';
  const audio = args.audio || cfg.match(/\baudio\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const out = args.out || 'out/video.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  if (audio && !existsSync(audio)) { console.error(`audio file not found: ${audio}`); process.exit(1); }
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ' — WARNING: no audio track (pass --audio or set PROJECT.audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', ...TV_RANGE, '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// --soft-gl: no GPU on this machine; render WebGL in software (SwiftShader), which Chrome only allows when asked.
// --gpu-angle=vulkan|gl-egl: headless Linux on an NVIDIA GPU (e.g. a cloud or cluster node); plain --use-gl=angle gets
// no WebGL context there. Check which GPU Chrome actually lands on with gpu_probe.mjs.
const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
// Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
// A slot whose owner died (its turn was cut off) is taken back.
// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
const BULK = !!(args.frames || args.clip || args.png);
const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function takeSlot() {
  mkdirSync(SLOT_DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const f = `${SLOT_DIR}/slot${i}`;
      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
    }
    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
}
// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
try {
  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
    const p = `${tmpdir()}/${d}`;
    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
  }
} catch {}
const slot = await takeSlot();
process.on('exit', () => { try { unlinkSync(slot); } catch {} });
let browser;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });

browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  // Web fonts come over the network: give the page time, and retry a slow load instead of dying mid-render.
  for (let k = 1; ; k++) {
    try { await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0', timeout: 90000 }); break; }
    catch (e) { if (k >= 3) throw e; console.log(`[page${tag}] slow load (${e.message}); retrying`); }
  }
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, 
```

### Core Architecture Module: `.claude/skills/crayon-storybook/template/src/core.js`
```
// core.js: the runtime. Constants, timing and motion helpers, camera, paint wrapper, compositing and the render hooks.
// Derived from painted-animation's core.js (ClaudeAnimationBase, MIT © John Heibel; see LICENSE). The render contract
// (window.ready / renderAt / renderSheet) is unchanged, so the same render.mjs drives it. The LOOK (brushes, paper,
// tooth, fills, finishing) lives in crayon.js; the characters in cast.js.
// Length and rhythm come from PROJECT in config.js.
const W = 1920, H = 1080;
const BPM = PROJECT.bpm, BEAT = 60 / BPM, OFF = PROJECT.offset || 0, DUR = PROJECT.duration;
// Linework boils at BOIL drawings a second. 8 reads as "re-drawn by hand": slow, calm, storybook.
const BOIL = PROJECT.boil || 8;
const TAU = Math.PI * 2;
// The storybook palette: soft crayon colours on cream paper. No pure black or white: PAL.ink is a cocoa pencil,
// PAL.cream the lightest light. Dk/Lt variants are for shading scribbles and highlights.
const PAL = {
  paper: '#F7EFDD', cream: '#FFF9EC', ink: '#4A3631', inkSoft: '#7A5C52',
  butter: '#F7D774', butterDk: '#E8B64A', sky: '#9ECBEA', skyDk: '#6FA6D6', skyLt: '#CFE6F5',
  rose: '#F09AAB', roseDk: '#D9687F', sage: '#AECB98', sageDk: '#7FA56E', leaf: '#8DBB78',
  lilac: '#C3AEE0', lilacDk: '#9A82C4', peach: '#F9CFA8', peachDk: '#EBA57E', coral: '#EE8A6E',
  cocoa: '#8C5E48', bark: '#A77657', night: '#5C6BA8', dusk: '#8E86C7',
  // aliases kept so older helpers (karaoke.js, brushWipe) still work
  clay: '#EE8A6E', clayDk: '#C8694F', clayLt: '#F6B59C', ochre: '#EDB84F', sap: '#8DBB78', teal: '#7FB9B1',
  violet: '#9A82C4', indigo: '#5C6BA8'
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// seeded stream for one element, the same every frame: const r = rnd('tree' + i); r() → 0..1
function rnd(key) { let h = 2166136261; for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let s = h >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0, s = (s ^ (s >>> 13)) >>> 0, (s % 1000003) / 1000003); }
const bpOf = t => (t - OFF) / BEAT;
// Seeded by the boil frame, so linework "boils" at BOIL fps like hand-drawn animation.
const jit = a => (random() * 2 - 1) * a;
// Each boil drawing holds for several frames, so whatever isn't moving must draw the same until the next one. But a moving
// thing uses a different amount of randomness each frame, which shifts the stream for everything drawn after it and makes
// that re-boil every frame (jitter). boilSeed(key) restarts the stream from the boil frame and a key (any string or
// number) that's the same every frame: call it before each separate element. The cast does this for itself and its parts.
let BOILN = 0, CAST_N = 0;
const boilSeed = key => { let h = 2166136261; for (const c of key + '|' + BOILN) h = Math.imul(h ^ c.charCodeAt(0), 16777619); randomSeed(h >>> 0); };

// ---------- timing helpers (everything is a pure function of t; no state survives between frames) ----------
const seg = (t, a, b) => clamp((t - a) / (b - a));                 // 0..1 progress of t through [a, b]
const frac = x => x - Math.floor(x);
const beatN = t => Math.floor(bpOf(t));                            // integer beat index
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);          // 1 exactly on each beat, decays after
const pulse2 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);     // same on eighth notes
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
const easeIn = x => Math.pow(clamp(x), 3);
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn). Values may be numbers or arrays of numbers.
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
// hex color mix
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
// small deterministic camera shake, changes at 24 fps
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- motion principles, as pure functions of t ----------
// Damped spring kicked at t0: 0 before, then a wobble that dies away (settles, jiggles, hair after a landing).
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
const ring = (t, evs, k = 6, w = 18) => evs.reduce((s, e) => s + spring(t, e, k, w), 0);    // one kick per event time
// Hold each drawing for two frames (12 drawings a second), like hand-drawn animation "on twos". Wrap a shot's t in it.
const onTwos = t => Math.floor(t * 12 + 1e-6) / 12;
const onStep = (t, n) => Math.floor(t * n + 1e-6) / n;
// Point on a thrown or jumping arc from p0 to p1, peaking h px above the straight line; k = 0..1 along the flight.
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
// A hop that takes off at t0 and lands at t1, h body units high: crouch (anticipation), stretch on takeoff,
// round at the top, squash on landing and spring back. Returns { dy, sq } to add into a character's pose.
function jump(t, t0, t1, h = 3) {
  if (t < t0 - .16) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .2 * ease(seg(t, t0 - .16, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .24 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
// A surprise "take" peaking at t0: a quick squash, then a big stretch up that springs back. amt scales it.
function take(t, t0, amt = 1) {
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0; return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
// Walk from x0 to x1 (px) between t0 and t1 for a character of unit u, taking steps of `stride` u: eases in and out,
// faces the way it's going, and faces front when it stops. Returns { x, walk, view, flip, dy } for the cast.
function stroll(t, t0, t1, x0, x1, u, stride = 3, view = 'side') {
  const x = lerp(x0, x1, ease(seg(t, t0, t1))), d = Math.abs(x - x0) / (stride * u), moving = t > t0 && t < t1;
  return { x, walk: moving ? d : null, view: moving ? view : 'front', flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * .35 : 0 };
}

// ---------- camera ----------
// camBegin(cx, cy, zoom, rot): world point (cx, cy) lands at screen centre. Letters queued while a camera is
// active are placed through it automatically (pass {screen:true} to opt out). One level only: always pair with camEnd().
// LAST_CAM stays set after camEnd(), until the next frame: renderSheet's crops that follow a world point use it.
let CAM = null, LAST_CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = LAST_CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y, cam = CAM) {
  if (!cam) return [x, y];
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot), dx = (x - cam.cx) * cam.zoom, dy = (y - cam.cy) * cam.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- full-frame effects (call outside a camera, in screen space) ----------
function flash(k, col = PAL.cream) { if (k > .01) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, washOp: 255 * clamp(k), ink: null }); }
// Light: glow(x, y, r, col, a) ADDS a soft halo of light (sun, lamp, fireflies, magic). p5.brush mixes colour like
// pigment, so light can't be painted; this is the one non-crayon mark in the kit. It lands on what's drawn so far,
// under anything drawn after it, and follows the camera. On cream paper it shows only as a gentle warm bloom.
function glow(x, y, r, col = '#FFD98A', a = 1) {
  if (a <= 0 || r < 1) return;
  flushBrush();
  const c = color(col), rr = r * (1 + jit(.03));
  push(); blendMode(ADD); tint(red(c), green(c), blue(c), 150 * clamp(a)); image(glowTex, x - rr, y - rr, 2 * rr, 2 * rr); noTint(); blendMode(BLEND); pop();
}
function makeGlowTex() {
  const g = createGraphics(256, 256); g.pixelDensity(1); const c = g.drawingContext, gr = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  [[0, 1], [.18, .8], [.45, .32], [.75, .08], [1, 0]].forEach(([s, a]) => gr.addColorStop(s, `rgba(255,255,255,${a})`));
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  return g;
}
// Paint everything OUTSIDE a star-shaped hole (irises, keyholes, heart-shaped reveals).
function irisShape(pts, col = PAL.ink, far = 4000) {
  const n = pts.length; let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  const out = p => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = (b[0] - a[0]) * .06, ey = (b[1] - a[1]) * .06;
    const a2 = [a[0] - ex
```

### Core Architecture Module: `.claude/skills/faceless-explainer/scripts/lib/frame-packets-core.mjs`
```
// Frame packets inline the storyboard frame, blueprint and cited recipes.
// Workflow wrappers supply resource paths and workflow-specific sections.
// The role combines the shared worker contract with the workflow delta.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function field(block, name) {
  const match = block.match(new RegExp(`^-\\s+${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

export function splitFrames(storyboard) {
  const matches = [...storyboard.matchAll(/^## Frame\s+([^\n]+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? storyboard.length;
    return {
      heading: match[1].trim(),
      block: storyboard.slice(start, end).trim(),
    };
  });
}

export function frameId(frame) {
  const src = field(frame.block, "src");
  if (!src) throw new Error(`${frame.heading}: missing src`);
  return basename(src).replace(/\.html?$/i, "");
}

export function selectedFile(path, heading) {
  if (!path || !existsSync(path)) return "";
  return `\n## ${heading}\n\n${readFileSync(path, "utf8").trim()}\n`;
}

function escapeRegExp(id) {
  return id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function knownRuleIds(animationDir) {
  const rulesDir = join(animationDir, "rules");
  if (!existsSync(rulesDir)) {
    console.warn(
      `frame-packets: no rules dir at ${rulesDir} — packets will inline no motion recipes`,
    );
    return [];
  }
  return readdirSync(rulesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}

export function citedRules(block, ruleIds) {
  const explicit = (field(block, "rules") ?? "")
    .split(/[,\s]+/)
    .map((rule) => rule.trim())
    .filter(Boolean);
  const mentioned = ruleIds.filter((id) =>
    new RegExp(`(?<![\\w-])${escapeRegExp(id)}(?![\\w-])`, "i").test(block),
  );
  return [...new Set([...explicit, ...mentioned])].filter((id) => ruleIds.includes(id));
}

// visual-design.md tells the author to write the blueprint as `<id> (Reproduce)`
// or `<id> (Adapt)` — the qualifier is direction for the frame worker, not part of
// the filename. Parse the field into the id it names (or null for `compose`), so
// no caller ever resolves a raw field value against the blueprints directory.
export function blueprintId(block) {
  const raw = field(block, "blueprint");
  if (!raw) return null;
  const id = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return id && id.toLowerCase() !== "compose" ? id : null;
}

export function resourceSections(block, { animationDir, ruleIds, frameId }) {
  let sections = "";
  const blueprint = blueprintId(block);
  if (blueprint) {
    const blueprintsDir = join(animationDir, "blueprints");
    const path = join(blueprintsDir, `${blueprint}.md`);
    // An installed library must contain the named blueprint.
    // An absent on-demand library warns, like missing motion rules.
    if (!existsSync(blueprintsDir)) {
      console.warn(
        `frame-packets: no blueprints dir at ${blueprintsDir} — packets will inline no blueprint`,
      );
    } else if (!existsSync(path)) {
      throw new Error(`${frameId ?? "frame"}: blueprint "${blueprint}" has no file at ${path}`);
    } else {
      sections += selectedFile(path, `Selected blueprint: ${blueprint}`);
    }
  }
  for (const rule of citedRules(block, ruleIds)) {
    sections += selectedFile(
      join(animationDir, "rules", `${rule}.md`),
      `Selected motion rule: ${rule}`,
    );
  }
  return sections;
}

export function buildRolePayload({ corePath, deltaPath, outDir }) {
  const core = readFileSync(corePath, "utf8").trim();
  const delta = readFileSync(deltaPath, "utf8").trim();
  const role = `${core}\n\n---\n\n${delta}\n`;
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "_role.md");
  writeFileSync(path, role);
  return { path, bytes: Buffer.byteLength(role) };
}

export function buildFramePackets({
  projectDir,
  storyboardPath = join(projectDir, "STORYBOARD.md"),
  outDir = join(projectDir, ".hyperframes", "frame-packets"),
  maxPacketBytes = 48_000,
  animationDir,
  corePath,
  deltaPath,
  // Per-workflow hooks (all optional):
  // designTruthLine(projectDir) -> the packet's design-truth input line
  // validateFrame(frame, id)   -> throw to reject a frame before packing
  // extraSections(block)       -> extra packet sections appended after the rule recipes
  designTruthLine = (dir) => `- Design tokens: ${join(resolve(dir), "frame.md")}`,
  validateFrame,
  extraSections,
}) {
  const storyboard = readFileSync(storyboardPath, "utf8");
  const frames = splitFrames(storyboard);
  if (frames.length === 0) throw new Error("STORYBOARD.md has no frame blocks");
  const ruleIds = knownRuleIds(animationDir);

  const packets = frames.map((frame) => {
    const id = frameId(frame);
    if (validateFrame) validateFrame(frame, id);
    const packet = `# Frame packet: ${id}\n\n## Project inputs\n\n- Project: ${resolve(projectDir)}\n${designTruthLine(projectDir)}\n- RULES_DIR: ${join(animationDir, "rules")}\n\n## Assigned storyboard block\n\n${frame.block}\n${resourceSections(frame.block, { animationDir, ruleIds, frameId: id })}${extraSections ? extraSections(frame.block) : ""}`;
    const bytes = Buffer.byteLength(packet);
    if (bytes > maxPacketBytes) {
      throw new Error(`${id}: frame packet is ${bytes} bytes (limit ${maxPacketBytes})`);
    }
    return { frameId: id, path: join(outDir, `${id}.md`), bytes, packet };
  });

  mkdirSync(outDir, { recursive: true });
  for (const { path, packet } of packets) writeFileSync(path, packet);
  buildRolePayload({ corePath, deltaPath, outDir });
  return packets.map(({ packet: _packet, ...result }) => result);
}

export function flag(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

// realpath both sides: on macOS /tmp → /private/tmp, and node resolves the main
// module's symlinks in import.meta.url while argv[1] keeps the invoked spelling —
// a raw compare silently skips main() when invoked through any symlinked path.
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === importMetaUrl;
  } catch {
    return false;
  }
}

export function runCli({ buildFramePackets: build, buildRolePayload: buildRole }) {
  const argv = process.argv.slice(2);
  const projectDir = resolve(flag(argv, "project", "."));
  const outDir = resolve(flag(argv, "out-dir", join(projectDir, ".hyperframes", "frame-packets")));
  try {
    const packets = build({
      projectDir,
      storyboardPath: resolve(flag(argv, "storyboard", join(projectDir, "STORYBOARD.md"))),
      outDir,
    });
    const role = buildRole({ outDir });
    console.log(`✓ frame packets: ${packets.length} bounded packet(s)`);
    for (const packet of packets)
      console.log(`  ${packet.frameId}: ${packet.bytes} bytes → ${packet.path}`);
    console.log(`  worker role: ${role.bytes} bytes → ${role.path}`);
  } catch (error) {
    console.error(`✗ frame packets: ${error.message}`);
    process.exit(1);
  }
}

```

### Core Architecture Module: `.claude/skills/general-video/scripts/lib/frame-packets-core.mjs`
```
// Frame packets inline the storyboard frame, blueprint and cited recipes.
// Workflow wrappers supply resource paths and workflow-specific sections.
// The role combines the shared worker contract with the workflow delta.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function field(block, name) {
  const match = block.match(new RegExp(`^-\\s+${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

export function splitFrames(storyboard) {
  const matches = [...storyboard.matchAll(/^## Frame\s+([^\n]+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? storyboard.length;
    return {
      heading: match[1].trim(),
      block: storyboard.slice(start, end).trim(),
    };
  });
}

export function frameId(frame) {
  const src = field(frame.block, "src");
  if (!src) throw new Error(`${frame.heading}: missing src`);
  return basename(src).replace(/\.html?$/i, "");
}

export function selectedFile(path, heading) {
  if (!path || !existsSync(path)) return "";
  return `\n## ${heading}\n\n${readFileSync(path, "utf8").trim()}\n`;
}

function escapeRegExp(id) {
  return id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function knownRuleIds(animationDir) {
  const rulesDir = join(animationDir, "rules");
  if (!existsSync(rulesDir)) {
    console.warn(
      `frame-packets: no rules dir at ${rulesDir} — packets will inline no motion recipes`,
    );
    return [];
  }
  return readdirSync(rulesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}

export function citedRules(block, ruleIds) {
  const explicit = (field(block, "rules") ?? "")
    .split(/[,\s]+/)
    .map((rule) => rule.trim())
    .filter(Boolean);
  const mentioned = ruleIds.filter((id) =>
    new RegExp(`(?<![\\w-])${escapeRegExp(id)}(?![\\w-])`, "i").test(block),
  );
  return [...new Set([...explicit, ...mentioned])].filter((id) => ruleIds.includes(id));
}

// visual-design.md tells the author to write the blueprint as `<id> (Reproduce)`
// or `<id> (Adapt)` — the qualifier is direction for the frame worker, not part of
// the filename. Parse the field into the id it names (or null for `compose`), so
// no caller ever resolves a raw field value against the blueprints directory.
export function blueprintId(block) {
  const raw = field(block, "blueprint");
  if (!raw) return null;
  const id = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return id && id.toLowerCase() !== "compose" ? id : null;
}

export function resourceSections(block, { animationDir, ruleIds, frameId }) {
  let sections = "";
  const blueprint = blueprintId(block);
  if (blueprint) {
    const blueprintsDir = join(animationDir, "blueprints");
    const path = join(blueprintsDir, `${blueprint}.md`);
    // An installed library must contain the named blueprint.
    // An absent on-demand library warns, like missing motion rules.
    if (!existsSync(blueprintsDir)) {
      console.warn(
        `frame-packets: no blueprints dir at ${blueprintsDir} — packets will inline no blueprint`,
      );
    } else if (!existsSync(path)) {
      throw new Error(`${frameId ?? "frame"}: blueprint "${blueprint}" has no file at ${path}`);
    } else {
      sections += selectedFile(path, `Selected blueprint: ${blueprint}`);
    }
  }
  for (const rule of citedRules(block, ruleIds)) {
    sections += selectedFile(
      join(animationDir, "rules", `${rule}.md`),
      `Selected motion rule: ${rule}`,
    );
  }
  return sections;
}

export function buildRolePayload({ corePath, deltaPath, outDir }) {
  const core = readFileSync(corePath, "utf8").trim();
  const delta = readFileSync(deltaPath, "utf8").trim();
  const role = `${core}\n\n---\n\n${delta}\n`;
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "_role.md");
  writeFileSync(path, role);
  return { path, bytes: Buffer.byteLength(role) };
}

export function buildFramePackets({
  projectDir,
  storyboardPath = join(projectDir, "STORYBOARD.md"),
  outDir = join(projectDir, ".hyperframes", "frame-packets"),
  maxPacketBytes = 48_000,
  animationDir,
  corePath,
  deltaPath,
  // Per-workflow hooks (all optional):
  // designTruthLine(projectDir) -> the packet's design-truth input line
  // validateFrame(frame, id)   -> throw to reject a frame before packing
  // extraSections(block)       -> extra packet sections appended after the rule recipes
  designTruthLine = (dir) => `- Design tokens: ${join(resolve(dir), "frame.md")}`,
  validateFrame,
  extraSections,
}) {
  const storyboard = readFileSync(storyboardPath, "utf8");
  const frames = splitFrames(storyboard);
  if (frames.length === 0) throw new Error("STORYBOARD.md has no frame blocks");
  const ruleIds = knownRuleIds(animationDir);

  const packets = frames.map((frame) => {
    const id = frameId(frame);
    if (validateFrame) validateFrame(frame, id);
    const packet = `# Frame packet: ${id}\n\n## Project inputs\n\n- Project: ${resolve(projectDir)}\n${designTruthLine(projectDir)}\n- RULES_DIR: ${join(animationDir, "rules")}\n\n## Assigned storyboard block\n\n${frame.block}\n${resourceSections(frame.block, { animationDir, ruleIds, frameId: id })}${extraSections ? extraSections(frame.block) : ""}`;
    const bytes = Buffer.byteLength(packet);
    if (bytes > maxPacketBytes) {
      throw new Error(`${id}: frame packet is ${bytes} bytes (limit ${maxPacketBytes})`);
    }
    return { frameId: id, path: join(outDir, `${id}.md`), bytes, packet };
  });

  mkdirSync(outDir, { recursive: true });
  for (const { path, packet } of packets) writeFileSync(path, packet);
  buildRolePayload({ corePath, deltaPath, outDir });
  return packets.map(({ packet: _packet, ...result }) => result);
}

export function flag(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

// realpath both sides: on macOS /tmp → /private/tmp, and node resolves the main
// module's symlinks in import.meta.url while argv[1] keeps the invoked spelling —
// a raw compare silently skips main() when invoked through any symlinked path.
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === importMetaUrl;
  } catch {
    return false;
  }
}

export function runCli({ buildFramePackets: build, buildRolePayload: buildRole }) {
  const argv = process.argv.slice(2);
  const projectDir = resolve(flag(argv, "project", "."));
  const outDir = resolve(flag(argv, "out-dir", join(projectDir, ".hyperframes", "frame-packets")));
  try {
    const packets = build({
      projectDir,
      storyboardPath: resolve(flag(argv, "storyboard", join(projectDir, "STORYBOARD.md"))),
      outDir,
    });
    const role = buildRole({ outDir });
    console.log(`✓ frame packets: ${packets.length} bounded packet(s)`);
    for (const packet of packets)
      console.log(`  ${packet.frameId}: ${packet.bytes} bytes → ${packet.path}`);
    console.log(`  worker role: ${role.bytes} bytes → ${role.path}`);
  } catch (error) {
    console.error(`✗ frame packets: ${error.message}`);
    process.exit(1);
  }
}

```

### Core Architecture Module: `.claude/skills/hyperframes/scripts/lib/frame-packets-core.mjs`
```
// Frame packets inline the storyboard frame, blueprint and cited recipes.
// Workflow wrappers supply resource paths and workflow-specific sections.
// The role combines the shared worker contract with the workflow delta.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function field(block, name) {
  const match = block.match(new RegExp(`^-\\s+${name}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

export function splitFrames(storyboard) {
  const matches = [...storyboard.matchAll(/^## Frame\s+([^\n]+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? storyboard.length;
    return {
      heading: match[1].trim(),
      block: storyboard.slice(start, end).trim(),
    };
  });
}

export function frameId(frame) {
  const src = field(frame.block, "src");
  if (!src) throw new Error(`${frame.heading}: missing src`);
  return basename(src).replace(/\.html?$/i, "");
}

export function selectedFile(path, heading) {
  if (!path || !existsSync(path)) return "";
  return `\n## ${heading}\n\n${readFileSync(path, "utf8").trim()}\n`;
}

function escapeRegExp(id) {
  return id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function knownRuleIds(animationDir) {
  const rulesDir = join(animationDir, "rules");
  if (!existsSync(rulesDir)) {
    console.warn(
      `frame-packets: no rules dir at ${rulesDir} — packets will inline no motion recipes`,
    );
    return [];
  }
  return readdirSync(rulesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}

export function citedRules(block, ruleIds) {
  const explicit = (field(block, "rules") ?? "")
    .split(/[,\s]+/)
    .map((rule) => rule.trim())
    .filter(Boolean);
  const mentioned = ruleIds.filter((id) =>
    new RegExp(`(?<![\\w-])${escapeRegExp(id)}(?![\\w-])`, "i").test(block),
  );
  return [...new Set([...explicit, ...mentioned])].filter((id) => ruleIds.includes(id));
}

// visual-design.md tells the author to write the blueprint as `<id> (Reproduce)`
// or `<id> (Adapt)` — the qualifier is direction for the frame worker, not part of
// the filename. Parse the field into the id it names (or null for `compose`), so
// no caller ever resolves a raw field value against the blueprints directory.
export function blueprintId(block) {
  const raw = field(block, "blueprint");
  if (!raw) return null;
  const id = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return id && id.toLowerCase() !== "compose" ? id : null;
}

export function resourceSections(block, { animationDir, ruleIds, frameId }) {
  let sections = "";
  const blueprint = blueprintId(block);
  if (blueprint) {
    const blueprintsDir = join(animationDir, "blueprints");
    const path = join(blueprintsDir, `${blueprint}.md`);
    // An installed library must contain the named blueprint.
    // An absent on-demand library warns, like missing motion rules.
    if (!existsSync(blueprintsDir)) {
      console.warn(
        `frame-packets: no blueprints dir at ${blueprintsDir} — packets will inline no blueprint`,
      );
    } else if (!existsSync(path)) {
      throw new Error(`${frameId ?? "frame"}: blueprint "${blueprint}" has no file at ${path}`);
    } else {
      sections += selectedFile(path, `Selected blueprint: ${blueprint}`);
    }
  }
  for (const rule of citedRules(block, ruleIds)) {
    sections += selectedFile(
      join(animationDir, "rules", `${rule}.md`),
      `Selected motion rule: ${rule}`,
    );
  }
  return sections;
}

export function buildRolePayload({ corePath, deltaPath, outDir }) {
  const core = readFileSync(corePath, "utf8").trim();
  const delta = readFileSync(deltaPath, "utf8").trim();
  const role = `${core}\n\n---\n\n${delta}\n`;
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "_role.md");
  writeFileSync(path, role);
  return { path, bytes: Buffer.byteLength(role) };
}

export function buildFramePackets({
  projectDir,
  storyboardPath = join(projectDir, "STORYBOARD.md"),
  outDir = join(projectDir, ".hyperframes", "frame-packets"),
  maxPacketBytes = 48_000,
  animationDir,
  corePath,
  deltaPath,
  // Per-workflow hooks (all optional):
  // designTruthLine(projectDir) -> the packet's design-truth input line
  // validateFrame(frame, id)   -> throw to reject a frame before packing
  // extraSections(block)       -> extra packet sections appended after the rule recipes
  designTruthLine = (dir) => `- Design tokens: ${join(resolve(dir), "frame.md")}`,
  validateFrame,
  extraSections,
}) {
  const storyboard = readFileSync(storyboardPath, "utf8");
  const frames = splitFrames(storyboard);
  if (frames.length === 0) throw new Error("STORYBOARD.md has no frame blocks");
  const ruleIds = knownRuleIds(animationDir);

  const packets = frames.map((frame) => {
    const id = frameId(frame);
    if (validateFrame) validateFrame(frame, id);
    const packet = `# Frame packet: ${id}\n\n## Project inputs\n\n- Project: ${resolve(projectDir)}\n${designTruthLine(projectDir)}\n- RULES_DIR: ${join(animationDir, "rules")}\n\n## Assigned storyboard block\n\n${frame.block}\n${resourceSections(frame.block, { animationDir, ruleIds, frameId: id })}${extraSections ? extraSections(frame.block) : ""}`;
    const bytes = Buffer.byteLength(packet);
    if (bytes > maxPacketBytes) {
      throw new Error(`${id}: frame packet is ${bytes} bytes (limit ${maxPacketBytes})`);
    }
    return { frameId: id, path: join(outDir, `${id}.md`), bytes, packet };
  });

  mkdirSync(outDir, { recursive: true });
  for (const { path, packet } of packets) writeFileSync(path, packet);
  buildRolePayload({ corePath, deltaPath, outDir });
  return packets.map(({ packet: _packet, ...result }) => result);
}

export function flag(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

// realpath both sides: on macOS /tmp → /private/tmp, and node resolves the main
// module's symlinks in import.meta.url while argv[1] keeps the invoked spelling —
// a raw compare silently skips main() when invoked through any symlinked path.
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === importMetaUrl;
  } catch {
    return false;
  }
}

export function runCli({ buildFramePackets: build, buildRolePayload: buildRole }) {
  const argv = process.argv.slice(2);
  const projectDir = resolve(flag(argv, "project", "."));
  const outDir = resolve(flag(argv, "out-dir", join(projectDir, ".hyperframes", "frame-packets")));
  try {
    const packets = build({
      projectDir,
      storyboardPath: resolve(flag(argv, "storyboard", join(projectDir, "STORYBOARD.md"))),
      outDir,
    });
    const role = buildRole({ outDir });
    console.log(`✓ frame packets: ${packets.length} bounded packet(s)`);
    for (const packet of packets)
      console.log(`  ${packet.frameId}: ${packet.bytes} bytes → ${packet.path}`);
    console.log(`  worker role: ${role.bytes} bytes → ${role.path}`);
  } catch (error) {
    console.error(`✗ frame packets: ${error.message}`);
    process.exit(1);
  }
}

```

### Core Architecture Module: `.claude/skills/media-use/audio/scripts/lib/concurrency.mjs`
```
// mapWithConcurrency — run `fn` over `items` with at most `limit` in flight at
// once. Preserves input order in the result array regardless of completion order.
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

```

### Core Architecture Module: `.claude/skills/painted-animation/template/render.mjs`
```
// render.mjs: renders studio.html in headless Chrome. Length and fps come from the page (PROJECT in src/config.js).
//
//   Look at it (open the images with your image viewer / Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
//         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//   Make the video:
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
//                                                                                              only frames of shots whose files changed are redrawn)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
//   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
//   at once on this machine; the rest wait their turn.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
// Chromium builds Playwright downloaded (~/.cache/ms-playwright/chromium-NNNN), newest first
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map(n => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
// comma-separated fields, keeping commas inside parentheses ('PLK.MX(1.38),PLK.WL,500,300'); numbers stay numbers
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };

// JPEG frames decode as full-range (yuvj420p); without this the MP4 is flagged full-range and some players/platforms
// show it washed out or with crushed shadows. Convert to standard (tv) range and say so.
const TV_RANGE = ['-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv'];

if (args.encode) {
  // no page here, so read PROJECT.audio from the config file (encoding used to drop the music when --audio was left out)
  const cfg = existsSync('src/config.js') ? readFileSync('src/config.js', 'utf8') : '';
  const audio = args.audio || cfg.match(/\baudio\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const out = args.out || 'out/video.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  if (audio && !existsSync(audio)) { console.error(`audio file not found: ${audio}`); process.exit(1); }
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ' — WARNING: no audio track (pass --audio or set PROJECT.audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', ...TV_RANGE, '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// --soft-gl: no GPU on this machine; render WebGL in software (SwiftShader), which Chrome only allows when asked.
// --gpu-angle=vulkan|gl-egl: headless Linux on an NVIDIA GPU (e.g. a cloud or cluster node); plain --use-gl=angle gets
// no WebGL context there. Check which GPU Chrome actually lands on with gpu_probe.mjs.
const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
// Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
// A slot whose owner died (its turn was cut off) is taken back.
// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
const BULK = !!(args.frames || args.clip || args.png);
const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function takeSlot() {
  mkdirSync(SLOT_DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const f = `${SLOT_DIR}/slot${i}`;
      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
    }
    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
}
// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
try {
  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
    const p = `${tmpdir()}/${d}`;
    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
  }
} catch {}
const slot = await takeSlot();
process.on('exit', () => { try { unlinkSync(slot); } catch {} });
let browser;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });

browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
// Frame key = hash(every shared file) + hash(the scene file that draws the frame's shot). Shared: 
```

### Core Architecture Module: `.claude/skills/painted-animation/template/src/core.js`
```
// core.js: constants, helpers, paper, paint wrapper, compositing and render hooks.
// Length and rhythm come from PROJECT in config.js.
const W = 1920, H = 1080;
const BPM = PROJECT.bpm, BEAT = 60 / BPM, OFF = PROJECT.offset || 0, BOIL = 12, DUR = PROJECT.duration;
const TAU = Math.PI * 2;
const PAL = {
  paper: '#F3EBDC', ink: '#2B2233', clay: '#D97757', clayDk: '#A84D33', clayLt: '#F2A283',
  night: '#1F2550', indigo: '#2F3C7A', rose: '#E27A92', ochre: '#E8AA38', sap: '#6E9F58',
  teal: '#3A9C98', violet: '#7B5CA8', cream: '#FFF5E2', sky: '#8EC3E6'
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bpOf = t => (t - OFF) / BEAT;
// Seeded by the boil frame, so linework "boils" at BOIL fps like hand-drawn animation.
const jit = a => (random() * 2 - 1) * a;
// Each boil drawing holds for several frames, so whatever isn't moving must draw the same until the next one. But a moving
// thing uses a different amount of randomness each frame, which shifts the stream for everything drawn after it and makes
// that re-boil every frame (jitter). boilSeed(key) restarts the stream from the boil frame and a key (any string or
// number) that's the same every frame: call it before each separate element. clawd() does this for itself and its parts.
let BOILN = 0, CLAWD_N = 0;
const boilSeed = key => { let h = 2166136261; for (const c of key + '|' + BOILN) h = Math.imul(h ^ c.charCodeAt(0), 16777619); randomSeed(h >>> 0); };

// ---------- timing helpers (everything is a pure function of t; no state survives between frames) ----------
const seg = (t, a, b) => clamp((t - a) / (b - a));                 // 0..1 progress of t through [a, b]
const frac = x => x - Math.floor(x);
const beatN = t => Math.floor(bpOf(t));                            // integer beat index
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);          // 1 exactly on each beat, decays after
const pulse2 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);     // same on eighth notes
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
const easeIn = x => Math.pow(clamp(x), 3);
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn). Values may be numbers or arrays of numbers.
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
// hex color mix
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
// small deterministic camera shake, changes at 24 fps
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- motion principles, as pure functions of t ----------
// Damped spring kicked at t0: 0 before, then a wobble that dies away. Use it for secondary motion and settles: a body
// after landing, a hat that jiggles, a stack that sways, a tail that drags. k = damping, w = wobble speed (rad/s).
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
const ring = (t, evs, k = 6, w = 18) => evs.reduce((s, e) => s + spring(t, e, k, w), 0);    // one kick per event time
// Hold each drawing for two frames (12 drawings a second), like hand-drawn animation "on twos". Wrap a shot's t in it.
const onTwos = t => Math.floor(t * 12 + 1e-6) / 12;
// Point on a thrown or jumping arc from p0 to p1, peaking h px above the straight line; k = 0..1 along the flight.
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
// A hop that takes off at t0 and lands at t1, h body units high: crouch (anticipation), stretch on takeoff,
// round at the top, squash on landing and spring back. Returns { dy, sq } to spread into clawd().
function jump(t, t0, t1, h = 3) {
  if (t < t0 - .12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .18 * ease(seg(t, t0 - .12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
// A surprise "take" peaking at t0: a quick squash, then a big stretch up that springs back. amt scales it.
function take(t, t0, amt = 1) {
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0; return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
// Walk from x0 to x1 (px) between t0 and t1, for a character of unit u: eases in and out, faces the way it's
// going in 3/4 view, and faces front when it stops. Returns { x, walk, view, flip, dy } for clawd().
function stroll(t, t0, t1, x0, x1, u) {
  const x = lerp(x0, x1, ease(seg(t, t0, t1))), d = Math.abs(x - x0) / (4 * u), moving = t > t0 && t < t1;
  return { x, walk: d, view: moving ? 'q' : 'front', flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * .5 : 0 };
}

// ---------- camera ----------
// camBegin(cx, cy, zoom, rot): world point (cx, cy) lands at screen centre. Letters queued while a camera is
// active are placed through it automatically (pass {screen:true} to opt out). One level only: always pair with camEnd().
// LAST_CAM stays set after camEnd(), until the next frame: renderSheet's crops that follow a world point use it.
let CAM = null, LAST_CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = LAST_CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y, cam = CAM) {
  if (!cam) return [x, y];
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot), dx = (x - cam.cx) * cam.zoom, dy = (y - cam.cy) * cam.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// ---------- full-frame effects (call outside a camera, in screen space) ----------
function flash(k, col = '#FFFDF6') { if (k > .01) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, washOp: 255 * clamp(k), ink: null }); }
// Light: glow(x, y, r, col, a) ADDS a soft halo of light for anything that shines (stars, lamps, fireflies, magic).
// p5.brush mixes every colour like pigment, so yellow painted over blue turns green and light can't be painted; this
// is the one non-paint mark in the kit. It lands on what's painted so far, under anything painted after it, follows
// the camera, and boils a little. Keep a = 1 on dark grounds; on light grounds it barely shows (as light would).
function glow(x, y, r, col = '#FFC766', a = 1) {
  if (a <= 0 || r < 1) return;
  flushBrush();
  const c = color(col), rr = r * (1 + jit(.03));
  push(); blendMode(ADD); tint(red(c), green(c), blue(c), 150 * clamp(a)); image(glowTex, x - rr, y - rr, 2 * rr, 2 * rr); noTint(); blendMode(BLEND); pop();
}
function makeGlowTex() {
  const g = createGraphics(256, 256); g.pixelDensity(1); const c = g.drawingContext, gr = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  [[0, 1], [.18, .8], [.45, .32], [.75, .08], [1, 0]].forEach(([s, a]) => gr.addColorStop(s, `rgba(255,255,255,${a})`));
  c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  return g;
}
// Paint everything OUTSIDE a star-shaped hole (irises, mouth-shaped reveals, keyholes).
function irisShape(pts, col = PAL.ink, far = 4000) {
  const n = pts.length; let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  const out = p => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = (b[0] - a[0]) * .06, ey = (b[1] - a[1]) * .06;
    const a2 = [a[0] - ex, a[1] - ey], b2 = [b[0] + ex, b[1] + ey];
    paint([a2, b2, out(b2), out(a2)], { wash: col, washOp: 255, ink: null });
  }
}
function iris(cx, cy, r, col = PAL.ink) { if (r < 4) paint(rectPts(-60, -60, W + 120, H + 120), { wash: col, ink: null }); else irisShape(ellPts(cx, cy, r, r, 40), col); }

let T = 0, paperG = null, grainC = null, letG = null, glowTex = null, outC = null, outX = null;
let LETTERS = [];

// ---------- geometry ----------
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)],
          [x + w + jit(j) * .5, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5],
          [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function ellPts(cx, cy, rx, ry, n = 28, j = 0, rot = 0) {
  const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p;
}
function rrPts(x, y, w, h, r, j = 0) {
  const p = [], seg = 5, corner = (cx, cy, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner
```

### Core Architecture Module: `.claude/skills/paper-cutout/template/render.mjs`
```
// render.mjs: renders studio.html in headless Chrome. Length and fps come from the page (PROJECT in src/config.js).
//
//   Look at it (open the images with your image viewer / Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
//         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//   Make the video:
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
//                                                                                              only frames of shots whose files changed are redrawn)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
//   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
//   at once on this machine; the rest wait their turn.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
// Chromium builds Playwright downloaded (~/.cache/ms-playwright/chromium-NNNN), newest first
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map(n => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
// comma-separated fields, keeping commas inside parentheses ('PLK.MX(1.38),PLK.WL,500,300'); numbers stay numbers
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };

// JPEG frames decode as full-range (yuvj420p); without this the MP4 is flagged full-range and some players/platforms
// show it washed out or with crushed shadows. Convert to standard (tv) range and say so.
const TV_RANGE = ['-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv'];

if (args.encode) {
  // no page here, so read PROJECT.audio from the config file (encoding used to drop the music when --audio was left out)
  const cfg = existsSync('src/config.js') ? readFileSync('src/config.js', 'utf8') : '';
  const audio = args.audio || cfg.match(/\baudio\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const out = args.out || 'out/video.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  if (audio && !existsSync(audio)) { console.error(`audio file not found: ${audio}`); process.exit(1); }
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ' — WARNING: no audio track (pass --audio or set PROJECT.audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', ...TV_RANGE, '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// --soft-gl: no GPU on this machine; render WebGL in software (SwiftShader), which Chrome only allows when asked.
// --gpu-angle=vulkan|gl-egl: headless Linux on an NVIDIA GPU (e.g. a cloud or cluster node); plain --use-gl=angle gets
// no WebGL context there. Check which GPU Chrome actually lands on with gpu_probe.mjs.
const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
// Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
// A slot whose owner died (its turn was cut off) is taken back.
// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
const BULK = !!(args.frames || args.clip || args.png);
const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function takeSlot() {
  mkdirSync(SLOT_DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const f = `${SLOT_DIR}/slot${i}`;
      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
    }
    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
}
// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
try {
  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
    const p = `${tmpdir()}/${d}`;
    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
  }
} catch {}
const slot = await takeSlot();
process.on('exit', () => { try { unlinkSync(slot); } catch {} });
let browser;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });

browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
// Frame key = hash(every shared file) + hash(the scene file that draws the frame's shot). Shared: 
```

### Core Architecture Module: `.claude/skills/pixel-art/template/render.mjs`
```
// render.mjs: renders studio.html in headless Chrome. Length and fps come from the page (PROJECT in src/config.js).
//
//   Look at it (open the images with your image viewer / Read tool):
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
//     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
//     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
//         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
//   Make the video:
//     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
//                                                                                              only frames of shots whose files changed are redrawn)
//     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
//   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
//     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
//   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
//   at once on this machine; the rest wait their turn.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...playwrightChromes()];
// Chromium builds Playwright downloaded (~/.cache/ms-playwright/chromium-NNNN), newest first
function playwrightChromes() {
  const dir = `${homedir()}/.cache/ms-playwright`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    .map(n => `${dir}/${n}/chrome-linux64/chrome`);
}
const CHROME = CHROMES.find(p => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });
const times = s => String(s).split(',').map(Number);
const span = s => String(s).split(':').map(Number);
// comma-separated fields, keeping commas inside parentheses ('PLK.MX(1.38),PLK.WL,500,300'); numbers stay numbers
const fields = s => { const out = []; let d = 0, cur = ''; for (const ch of String(s)) { if (ch === ',' && !d) { out.push(cur); cur = ''; continue; } d += ch === '(' ? 1 : ch === ')' ? -1 : 0; cur += ch; } out.push(cur); return out.map(v => isNaN(+v) ? v : +v); };

// JPEG frames decode as full-range (yuvj420p); without this the MP4 is flagged full-range and some players/platforms
// show it washed out or with crushed shadows. Convert to standard (tv) range and say so.
const TV_RANGE = ['-vf', 'scale=out_range=tv', '-pix_fmt', 'yuv420p', '-color_range', 'tv'];

if (args.encode) {
  // no page here, so read PROJECT.audio from the config file (encoding used to drop the music when --audio was left out)
  const cfg = existsSync('src/config.js') ? readFileSync('src/config.js', 'utf8') : '';
  const audio = args.audio || cfg.match(/\baudio\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  const out = args.out || 'out/video.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  if (audio && !existsSync(audio)) { console.error(`audio file not found: ${audio}`); process.exit(1); }
  console.log(`encoding ${n} frames → ${out}${audio ? ' with ' + audio : ' — WARNING: no audio track (pass --audio or set PROJECT.audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`,
    ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', ...TV_RANGE, '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// --soft-gl: no GPU on this machine; render WebGL in software (SwiftShader), which Chrome only allows when asked.
// --gpu-angle=vulkan|gl-egl: headless Linux on an NVIDIA GPU (e.g. a cloud or cluster node); plain --use-gl=angle gets
// no WebGL context there. Check which GPU Chrome actually lands on with gpu_probe.mjs.
const ANGLE = { vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan'], 'gl-egl': ['--use-angle=gl-egl'] };
if (args['gpu-angle'] && !ANGLE[args['gpu-angle']]) { console.error(`--gpu-angle must be one of ${Object.keys(ANGLE)}`); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : args['gpu-angle'] ? ANGLE[args['gpu-angle']]
  : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
// Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
// A slot whose owner died (its turn was cut off) is taken back.
// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
const BULK = !!(args.frames || args.clip || args.png);
const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function takeSlot() {
  mkdirSync(SLOT_DIR, { recursive: true });
  for (let waited = 0; ; waited++) {
    for (let i = 0; i < SLOTS; i++) {
      const f = `${SLOT_DIR}/slot${i}`;
      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
    }
    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
    await new Promise(r => setTimeout(r, 1000));
  }
}
// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
try {
  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
    const p = `${tmpdir()}/${d}`;
    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
  }
} catch {}
const slot = await takeSlot();
process.on('exit', () => { try { unlinkSync(slot); } catch {} });
let browser;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });

browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  if (args.loop) {
    const ok = await page.evaluate(name => { if (!LOOPS[name]) return false; window.LOOP = LOOPS[name]; return true; }, args.loop);
    if (!ok) { console.error(`no loop named "${args.loop}"`); process.exit(1); }
  }
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
// Frame key = hash(every shared file) + hash(the scene file that draws the frame's shot). Shared: 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #60** (2026-10-05): **fix: pick the untitled fallback from the project language**
  *Symptoms*: One expression, one behaviour change: the fallback now follows the project language — `Untitled` when `lang` is `en`, `未命名` otherwise — and the 40-character slice is untouched. An English project with a blank brief line now shows `Untitled` instead of `未命名`.
  **Post-Mortem & Fix Analysis**:
  > Looks great, @BrianSasaki . Thanks for the contribution!

- **Issue #57** (2026-10-05): **README: add star history chart**
  *Symptoms*: Adds a Star History section above License in the English, zh-TW and zh-CN READMEs.  The chart is the live star-history.com embed, so it stays current without anyone regenerating an image.

- **Issue #55** (2026-10-04): **fix: reload the project when the event stream reconnects**
  *Symptoms*: Refs #49  The fix suggested in #49 (event ids plus `Last-Event-ID` replay) wouldn't change what the page shows. The UI never reads the event payloads: `Project.tsx` treats every event only as a cue to refetch `GET /api/projects/:id` and rebuilds everything from that snapshot. Replayed events would just trigger the same refetch.  The thing that actually goes missing is the refetch. While the stream is down, nothing triggers it, and after the browser reconnects nothing triggers it either until the next event arrives. A server restart shows this clearly. `recoverOrphans()` marks the running job as interrupted and saves it before any browser has reconnected, so no client hears that save. The open page keeps showing the old stage, with no "Continue from here", until someone reloads it.  ## Change  - `api.events` takes an optional `onOpen`, and `Project` refetches (with the same 350 ms debounce) every time the EventSource opens. That covers the first connect and every automatic reconnect. - The SSE handler calls `res.flushHeaders()` after `writeHead`. Without it, Node holds the headers back until the first body write. The browser's `open` event then only fired with the first real event or the 20 s ping, so a refetch on open would come up to 20 s late.  The 600-entry cap on `job.json`'s `log` is separate and left as is. The chat log already links to `logs/events.jsonl` for the full record.  ## Testing  - `npm run check`: typecheck, lint and 43 tests all pass. `npm run build` passes.
  **Post-Mortem & Fix Analysis**:
  > Looks great, @HEOJUNFO . Thanks for the contribution!

- **Issue #53** (2026-10-04): **Aim for goosebumps: design and judge the climax; much less render time**
  *Symptoms*: ## Why  An audit of 11 finished videos found every one passed the final critic at a flat 4/5 while being roughly 2.5–3.5 against its reference. The pipeline optimised for "no defects": nobody designed the climax, rigs that couldn't perform hid gaps behind white flashes, and reviewers only looked at stills. Runs also took 3–5 hours after approval, mostly spent waiting on screenshots.  This PR makes the climax the thing that is designed and judged, and cuts most of the waiting. It was tested over three full runs of the same 30 s music video:  | | before | after | |---|---|---| | Approval → done | 307 min | ~2 h 40 min | | Shot line | 165 min | 49 min | | Assembly | 38 min | 4 min | | Main character vs. the user's design | drifted shot to shot | stays on model | | One set + camera share of runtime | 65% | ≤ 15% |  ## What changed  **Design and judge the climax** - `analyze.py` finds peak candidates (the music builds, then hits) and flash frames, and caches each reference so it is only analysed once. - The style step writes `analysis/peaks.json`. The plan designs `plan.peaks` and hero shots. Before approval, the hit frame of each peak is rendered at final quality next to the reference's (`key_<n>_vs_ref.jpg`). - New `clip_strip.py` stacks our frames under the reference's, frame by frame. It switches to the cropped `proxy.mp4` when the source is a screen recording, and refuses black reference rows. - New `motion_check.py` flags black frames, hard cuts to black and long freezes. - 
  **Post-Mortem & Fix Analysis**:
  > @claude cc
  > **Claude finished @edenfunf's task in 31s** —— [View job](https://github.com/edenfunf/reelmimic/actions/runs/37189747157)  --- ## 🤖 Claude Review  **Verdict: ⚠️ Merge after fixes** One real race in the background-render timeout path. The rest of the diff looks sound.  | Check | Result | |---|---| | Correctness | 🔴 1 issue | | Security | ✅ No issues | | Performance | 🟡 1 issue | | Compatibility | ✅ No breaking changes | | Tests | ✅ Covered |  ### Must fix 1. 🔴 **`app/server/jobs.ts` `waitPrerenders` (~line 640)**: When the 10-minute wait times out, it kills only the process that is running now and deletes `prerenderQ`. Every later `prerender()` already chained on that promise still runs, so a new `render.mjs --frames` can start while assembly is rendering. Both write the same `out/frames/manifest.json` and frame files.    → Add a per-project "aborted" flag (or a generation counter) that `run()` checks before it spawns, and set it in `waitPrerenders` and `cancel`. For example:    ```

- **Issue #41** (2026-10-04): **fix: show a clear message when the port is already in use**
  *Symptoms*: Fixes #37.  When you double-click `start.bat` a second time, the second process crashed with `Error: listen EADDRINUSE`. It looked like ReelMimic broke, but the first copy was fine.  Now the server catches that one error. It prints that the port is taken, says a copy may already be open at the URL, and says `PORT` changes it. Then it exits with code 1. Other listen errors are still thrown like before.  How I checked it (before and after):  - Before: start the server on port 4399, then start a second one. The second one printed the Node stack trace and `Emitted 'error' event`. - After: same steps. The second one prints `Port 4399 is already in use. ReelMimic may already be open at http://localhost:4399. Set PORT to use another port.`, exit code is `1`, and the first server still answers `200` on `/api/projects`. - In `app/`: `npm run typecheck`, `npx eslint .` and `npm test` (35 pass) are all clean.  Only `app/server/index.ts` changed. 

- **Issue #40** (2026-10-04): **Optional: post a finished video with npm run publish**
  *Symptoms*: Closes #39  Adds an optional `npm run publish` that posts a finished video to social platforms through [Upload-Post](https://upload-post.com). Disclosure: I work on Upload-Post.  ```bash cd app npm run publish -- <project id> --platforms tiktok,instagram,youtube            # dry run, prints what it would post npm run publish -- <project id> --platforms tiktok --at 2026-10-05T18:00 --tz Europe/Madrid --send ```  **What changes** - `app/scripts/publish.mjs`: one plain JS script (`@ts-check`, like `doctor.mjs`), no new dependencies. It loads `server/env.ts`, so it reads the same `~/.reelmimic/secrets.json`. - `app/package.json`: the `publish` script. - `secrets.example.json` and `README.md`: the two optional keys and a short "Posting the finished video" section.  The server, pipeline, prompts and UI are untouched.  **Guard rails** - Nothing calls it automatically. A new `out/video.mp4` never triggers a post. - It refuses any project whose stage isn't `done`, so a video that's still being revised can't go out. - Dry run unless you pass `--send`. - It sends an `Idempotency-Key` built from the project, the video file and the target, so rerunning it doesn't post twice. - The title defaults to the plan's title (YouTube requires one); `--title` overrides it.  **Testing** - `npm run check` and `npm run build` pass (Node 24). - On a sample project: dry run, wrong stage, missing keys and missing `--platforms` all behave as expected. - End to end against the real API: scheduled a sample v
  **Post-Mortem & Fix Analysis**:
  > @mutonby Thanks for the contribution! I pushed a small follow-up commit (02a5cfb):  - Only post when the final review actually **passed**: a project can be `done` after the review stops at its round limit with must-fix items left. `--force` posts it anyway, with a warning. - The idempotency key now includes `--tz` and the profile, so correcting the time zone creates a new schedule instead of returning the old one. - Renamed to `npm run post-video` (easy to mix up with `npm publish`), and documented `UPLOAD_POST_API`. 
  > @claude review
  > **Claude finished @edenfunf's task in 18s** —— [View job](https://github.com/edenfunf/reelmimic/actions/runs/37190138438)  --- ## 🤖 Claude Review  **Verdict: ✅ Ready to merge**　 The script is opt-in and dry-run by default. It checks the stage and the final-review result before posting, and `lastCritique` matches the fields in `jobs.ts` and `shared/types.ts`.  | Check | Result | |---|---| | Correctness | ✅ No issues | | Security | ✅ No issues | | Performance | ✅ No issues | | Compatibility | ✅ No breaking changes | | Tests | ➖ No new tests |  ### Must fix None  ### Nice to have - 🟡 `app/scripts/post-video.mjs:48`: the idempotency key leaves out `--title` and `--description`. If you rerun with a corrected title, Upload-Post returns the earlier request and the new title is silently ignored. Add them to the hash input. - 🟡 `app/scripts/post-video.mjs:60`: a missing `UPLOAD_POST_KEY` is only reported with `--send`, so a dry run doesn't warn about it. Optionally print a warning during the

- **Issue #39** (2026-10-04): **Optional: post the finished video to TikTok / Reels / Shorts**
  *Symptoms*: Once a video is finished there's no way to get it onto TikTok, Reels or Shorts from ReelMimic. You take `out/video.mp4` and upload it by hand on every platform.  **Proposal:** an optional, manual command that lives outside the pipeline:  ```bash cd app npm run publish -- <project id> --platforms tiktok,instagram,youtube            # dry run npm run publish -- <project id> --platforms tiktok --at 2026-10-05T18:00 --tz Europe/Madrid --send ```  Since agents keep writing files the whole time, I'd keep it strict:  - Nothing in the pipeline calls it. A new `out/video.mp4` never triggers a post; you run it yourself. - It only accepts projects whose stage is `done` (final review finished), so a video that's still being revised can't go out. - Dry run by default. Without `--send` nothing leaves your computer. - Rerunning it for the same video sends the same `Idempotency-Key`, so nothing gets posted twice. - Keys go in `~/.reelmimic/secrets.json` like the others (`UPLOAD_POST_KEY`, `UPLOAD_POST_USER`). No new dependencies, no server or UI changes.  It posts through [Upload-Post](https://upload-post.com), one API for TikTok, Instagram, YouTube, LinkedIn, X, Threads, Pinterest and a few more. Disclosure: I work on Upload-Post. Happy to keep it as one self-contained script that's easy to remove, or to give it a more generic name so another service could plug in later, whichever you prefer.  I've opened a PR so you can see how small it is. If it doesn't fit the project, feel free to close

- **Issue #37** (2026-10-04): **A second instance prints EADDRINUSE and dies**
  *Symptoms*: The first thing many people do on Windows is double-click `start.bat` a second time. The second process dies with      Error: listen EADDRINUSE: address already in use 127.0.0.1:4318  which reads like ReelMimic crashed rather than "it is already running". `app.listen` has no `error` handler (`app/server/index.ts:130`).  ## Suggested fix Catch the listener error. For `EADDRINUSE`, say the port is taken, that an instance may already be open at http://localhost:4318, and that `PORT` changes it — then exit 1.

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

### Incident Patch 1: `ef92e059` (2026-10-05)
**Commit Message**: Merge pull request #60 from BrianSasaki/fix/untitled-language

fix: pick the untitled fallback from the project language

**File**: `app/server/index.ts` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ app.post('/api/projects', upload.fields([{ name: 'reference', maxCount: 1 }, { n
   try { settings = Object.fromEntries(Object.entries(J.cleanRounds(req.body)).filter(([, v]) => v != null)); }
   catch (e) { for (const f of Object.values(files || {}).flat()) try { unlinkSync(f.path); } catch {} return res.status(400).json({ error: (e as Error).message }); }
   const id = slug();
-  const job = J.createJob({ id, title: (title || brief.split('\n')[0] || '未命名').slice(0, 40), agent, brief, lang, settings,
+  const job = J.createJob({ id, title: (title || brief.split('\n')[0] || (lang === 'en' ? 'Untitled' : '未命名')).slice(0, 40), agent, brief, lang, settings,
     reference: ref ? { type: 'file', src: 'inputs/reference' + (extname(ref.originalname) || '.mp4') } : { type: 'url', src: url.trim() } });
   if (ref) renameSync(ref.path, join(J.dirOf(id), job.reference.src));
   for (const f of files?.inputs || []) renameSync(f.path, join(J.dirOf(id), 'inputs', fileName(f)));
```

---

### Incident Patch 2: `d62fa160` (2026-10-05)
**Commit Message**: fix: pick the untitled fallback from the project language

**File**: `app/server/index.ts` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ app.post('/api/projects', upload.fields([{ name: 'reference', maxCount: 1 }, { n
   try { settings = Object.fromEntries(Object.entries(J.cleanRounds(req.body)).filter(([, v]) => v != null)); }
   catch (e) { for (const f of Object.values(files || {}).flat()) try { unlinkSync(f.path); } catch {} return res.status(400).json({ error: (e as Error).message }); }
   const id = slug();
-  const job = J.createJob({ id, title: (title || brief.split('\n')[0] || '未命名').slice(0, 40), agent, brief, lang, settings,
+  const job = J.createJob({ id, title: (title || brief.split('\n')[0] || (lang === 'en' ? 'Untitled' : '未命名')).slice(0, 40), agent, brief, lang, settings,
     reference: ref ? { type: 'file', src: 'inputs/reference' + (extname(ref.originalname) || '.mp4') } : { type: 'url', src: url.trim() } });
   if (ref) renameSync(ref.path, join(J.dirOf(id), job.reference.src));
   for (const f of files?.inputs || []) renameSync(f.path, join(J.dirOf(id), 'inputs', fileName(f)));
```

---

### Incident Patch 3: `eeb8cce6` (2026-10-04)
**Commit Message**: Merge pull request #55 from HEOJUNFO/fix/reload-on-sse-reconnect

fix: reload the project when the event stream reconnects

**File**: `app/server/index.ts` (modified, +1/-0)
```diff
@@ -108,6 +108,7 @@ app.post('/api/projects/:id/cancel', (req, res) => { if (guard(res, req.params.i
 app.get('/api/projects/:id/events', (req, res) => {
   const { id } = req.params; if (!guard(res, id)) return;
   res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
+  res.flushHeaders();   // send them now, not with the first event or ping: the browser's 'open' (the UI reloads on it) waits for them
   const send = (jid: string, ev: J.BusEvent) => { if (jid === id) res.write(`data: ${JSON.stringify(ev.type === 'job' ? { type: 'job', stage: ev.job.stage } : ev)}\n\n`); };
   J.bus.on('job', send);
   const ping = setInterval(() => res.write(': ping\n\n'), 20000);
```

**File**: `app/web/src/Project.tsx` (modified, +3/-1)
```diff
@@ -34,7 +34,9 @@ export function Project({ id }: { id: string }) {
     let t: ReturnType<typeof setTimeout> | undefined, alive = true;
     const load = () => api.project(id).then((d) => { if (alive) { setS(d as SnapshotView); setV((x) => x + 1); } }).catch(() => {});
     load();
-    const off = api.events(id, () => { clearTimeout(t); t = setTimeout(load, 350); });
+    // also reload when the stream (re)opens: whatever changed while it was down (a restart marking the job interrupted) arrives no other way
+    const soon = () => { clearTimeout(t); t = setTimeout(load, 350); };
+    const off = api.events(id, soon, soon);
     return () => { alive = false; off(); clearTimeout(t); };
   }, [id]);
   useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
```

**File**: `app/web/src/api.ts` (modified, +2/-1)
```diff
@@ -20,7 +20,8 @@ export const api = {
   accept: (id: string) => fetch(`/api/projects/${id}/accept`, { method: 'POST' }).then(j<Ok>),
   resume: (id: string) => fetch(`/api/projects/${id}/resume`, { method: 'POST' }).then(j<Ok>),
   cancel: (id: string) => fetch(`/api/projects/${id}/cancel`, { method: 'POST' }).then(j<Ok>),
-  events: (id: string, fn: (ev: ServerEvent) => void) => { const es = new EventSource(`/api/projects/${id}/events`); es.onmessage = (m: MessageEvent<string>) => fn(JSON.parse(m.data) as ServerEvent); return () => es.close(); },
+  // onOpen also runs when the browser reconnects on its own (server restart, laptop sleep): events from the gap are not resent
+  events: (id: string, fn: (ev: ServerEvent) => void, onOpen?: () => void) => { const es = new EventSource(`/api/projects/${id}/events`); es.onmessage = (m: MessageEvent<string>) => fn(JSON.parse(m.data) as ServerEvent); if (onOpen) es.onopen = onOpen; return () => es.close(); },
   // encode each path segment ('#' would start the fragment, '%' makes a malformed URI); agents on Windows may write '\' as separator
   file: (id: string, p: string, bust?: number) => `/files/${id}/${p.split(/[\\/]/).map(encodeURIComponent).join('/')}${bust ? `?v=${bust}` : ''}`,
 };
```

---

### Incident Patch 4: `30d0723a` (2026-10-04)
**Commit Message**: Merge pull request #41 from bluzername/fix/port-in-use-message

fix: show a clear message when the port is already in use

**File**: `app/server/index.ts` (modified, +12/-3)
```diff
@@ -126,6 +126,15 @@ app.get<'/files/:id/*', { id: string; 0: string }>('/files/:id/*', (req, res) =>
 const dist = join(import.meta.dirname, '..', 'dist');
 if (existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api|files).*/, (req, res) => res.sendFile(join(dist, 'index.html'))); }
 
-const cut = J.recoverOrphans();
-if (cut.length && process.env.AUTO_RESUME !== '0') { console.log(`Resuming ${cut.length} interrupted job(s): ${cut.join(', ')}`); J.autoResume(cut); }
-app.listen(PORT, '127.0.0.1', () => console.log(`ReelMimic → http://localhost:${PORT}`));
+// Recover only once the port is ours: a second copy (start.bat double-clicked again) used to mark the first copy's
+// running jobs as interrupted before it found the port taken. Now it just says so and exits.
+const server = app.listen(PORT, '127.0.0.1', () => {
+  console.log(`ReelMimic → http://localhost:${PORT}`);
+  const cut = J.recoverOrphans();
+  if (cut.length && process.env.AUTO_RESUME !== '0') { console.log(`Resuming ${cut.length} interrupted job(s): ${cut.join(', ')}`); J.autoResume(cut); }
+});
+server.on('error', (err: NodeJS.ErrnoException) => {
+  if (err.code !== 'EADDRINUSE') throw err;
+  console.error(`Port ${PORT} is already in use. ReelMimic may already be open at http://localhost:${PORT}. Set PORT to use another port.`);
+  process.exit(1);
+});
```

---

### Incident Patch 5: `4949211b` (2026-10-04)
**Commit Message**: Merge remote-tracking branch 'origin/main' into pr36-fix

# Conflicts:
#	README.md

**File**: `.claude/skills/video-clone/scripts/align_lyrics.py` (modified, +16/-1)
```diff
@@ -48,6 +48,21 @@ def transcribe(wav, model_name, lang):
     return chars
 
 
+# Plain text (one line each) or LRC: "[00:12.34]line", "<00:12.34>" word times (enhanced LRC), "[ti:..]" / "[Chorus]" tags
+# (dropped). A line with several timestamps is sung that many times (a repeated chorus): it's listed once per time, in time order.
+LRC_TIME = re.compile(r"^(\[\d+:\d+(?:[.:]\d+)?\])+"); LRC_WORD = re.compile(r"<\d+:\d+(?:[.:]\d+)?>")
+def lyric_lines(text):
+    out, repeated = [], False   # (time or None, line)
+    for l in text.splitlines():
+        l = l.strip(); m = LRC_TIME.match(l); t = LRC_WORD.sub("", l[m.end():] if m else l).strip()
+        if not t or t.startswith("["): continue
+        stamps = re.findall(r"\[(\d+):(\d+)(?:[.:](\d+))?\]", m.group(0)) if m else []
+        repeated |= len(stamps) > 1
+        out += [(int(mm) * 60 + int(ss) + float("0." + (ff or "0")), t) for mm, ss, ff in stamps] or [(None, t)]
+    if repeated and all(s is not None for s, _ in out): out.sort(key=lambda x: x[0])
+    return [t for _, t in out]
+
+
 def fmt(t):
     t = max(0.0, t); return f"[{int(t // 60):02d}:{t % 60:05.2f}]"
 
@@ -57,7 +72,7 @@ def main():
     ap.add_argument("--start", type=float, default=0.0); ap.add_argument("--end", type=float)
     ap.add_argument("--model", default="medium"); ap.add_argument("--lang", default="zh")
     a = ap.parse_args()
-    lines = [l.strip() for l in open(a.lyrics, encoding="utf-8").read().splitlines() if l.strip() and not l.strip().startswith("[")]
+    lines = lyric_lines(open(a.lyrics, encoding="utf-8").read())
     if not lines: sys.exit("no lyric lines in " + a.lyrics)
     tmp = os.path.join(tempfile.mkdtemp(), "clip.wav")
     cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(a.start)]
```

**File**: `README.md` (modified, +15/-0)
```diff
@@ -132,6 +132,21 @@ committed. See [`secrets.example.json`](secrets.example.json) for the format.
 | `BUILDERS`, `MAX_AGENTS` | How many agents work on one video at once (default 6), and the limit across all projects (default 12) |
 | `PORT` | Web port (default 4318) |
 | `REELMIMIC_SECRETS` | Path to a different secrets file (legacy: `CLONE_STUDIO_SECRETS`) |
+| `UPLOAD_POST_KEY`, `UPLOAD_POST_USER` | Optional. Post a finished video to TikTok, Instagram, YouTube and others with `npm run post-video` (see below); `UPLOAD_POST_API` overrides the API address |
+
+### Posting the finished video (optional)
+
+ReelMimic never posts anything by itself. Once a project's final review is done and you're happy with the video, you can
+send it to your social accounts through [Upload-Post](https://upload-post.com) from the `app/` folder:
+
+```bash
+npm run post-video -- <project id> --platforms tiktok,instagram,youtube              # dry run: shows what it would post
+npm run post-video -- <project id> --platforms tiktok --at 2026-10-05T18:00 --tz Europe/Madrid --send
+```
+
+Without `--send` nothing leaves your computer. It only takes projects whose final review passed (`--force` to post one
+that stopped with must-fix items left), uses the plan's title
+unless you pass `--title`, and a rerun of the same video won't post it twice.
 
 ## Docs
 
```

**File**: `app/package.json` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
     "test": "node --test --experimental-test-module-mocks \"server/**/*.test.ts\"",
     "check": "npm run typecheck && npm run lint && npm test",
     "doctor": "node scripts/doctor.mjs",
+    "post-video": "node scripts/post-video.mjs",
     "setup": "npm install && node scripts/doctor.mjs"
   },
   "dependencies": {
```

**File**: `app/scripts/post-video.mjs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+// Optional: post a finished video to social platforms through Upload-Post (https://upload-post.com).   npm run post-video -- <project>
+// Never runs on its own: nothing in the pipeline calls it, and it only takes a project whose final review passed.
+// Without --send it is a dry run: it prints what it would post and sends nothing.
+//   npm run post-video -- 20261003-ab12c --platforms tiktok,instagram,youtube
+//   npm run post-video -- 20261003-ab12c --platforms tiktok --title "Bath Time" --at 2026-10-05T18:00 --tz Europe/Madrid --send
+// Needs UPLOAD_POST_KEY (an API key) and UPLOAD_POST_USER (the profile the accounts are connected to) in ~/.reelmimic/secrets.json.
+// UPLOAD_POST_API overrides the API address (the key is sent there), e.g. for a staging server.
+// @ts-check
+import { createHash } from 'node:crypto';
+import { existsSync, openAsBlob, readFileSync, statSync } from 'node:fs';
+import { basename, join, resolve } from 'node:path';
+import { parseArgs } from 'node:util';
+
+await import('../server/env.ts');   // same secrets as the server
+const API = process.env.UPLOAD_POST_API || 'https://api.upload-post.com';
+const PROJECTS = process.env.REELMIMIC_PROJECTS ? resolve(process.env.REELMIMIC_PROJECTS) : join(import.meta.dirname, '..', '..', 'projects');
+
+/** @param {string} m */
+const fail = (m) => { console.error(`  \x1b[31m✗\x1b[0m ${m}`); process.exit(1); };
+/** @param {string} p */
+const readJSON = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
+
+const { values: o, positionals } = parseArgs({ allowPositionals: true, options: {
+  platforms: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
+  at: { type: 'string' }, tz: { type: 'string' }, send: { type: 'boolean', default: false }, force: { type: 'boolean', default: false },
+} });
+const id = positionals[0];
+if (!id || !o.platforms) fail('usage: npm run post-video -- <project id> --platforms tiktok,instagram [--title …] [--description …] [--at 2026-10-05T18:00 --tz Europe/Madrid] [--send] [--force]');
+if (!/^[\w-]+$/.test(id)) fail(`not a project id: ${id}`);
+const dir = join(PROJECTS, id), job = readJSON(join(dir, 'job.json')), video = join(dir, 'out', 'video.mp4');
+if (!job) fail(`no such project: ${dir}`);
+// Only after the final review: a video still being produced or revised is not the one you approved.
+if (job.stage !== 'done') fail(`project is "${job.stage}", not "done". Publish only once the final review is finished`);
+// "done" also means the final review stopped at its round limit with must-fix items left: require a pass, or --force.
+if (!job.lastCritique?.pass) {
+  const why = job.lastCritique ? `the final review did not pass (${job.lastCritique.must} must-fix item(s) left)` : 'no final review result on record';
+  if (!o.force) fail(`${why}. Fix them first, or pass --force to post it anyway`);
+  console.log(`  [33m![0m ${why}; posting anyway (--force)`);
+}
+if (!existsSync(video)) fail(`no final video at ${video}`);
+const platforms = String(o.platforms).split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
+const title = (o.title || readJSON(join(dir, 'plan.json'))?.title || job.title || '').trim();
+if (!title && platforms.includes('youtube')) fail('YouTube needs a title: pass --title');
+if (o.tz && !o.at) fail('--tz only applies with --at');
+
+// Same project + video file + target (profile, platforms, time and time zone) → same key, so a retried run never posts the
+// video twice, while correcting --tz (or --at) is a new request instead of silently returning the earlier schedule.
+const st = statSync(video), idem = createHash('sha256').update(`${id}:${st.size}:${st.mtimeMs}:${process.env.UPLOAD_POST_USER || ''}:${platforms.join(',')}:${o.at || ''}:${o.tz || ''}`).digest('hex').slice(0, 32);
+const form = new FormData();
+form.append('user', process.env.UPLOAD_POST_USER || '');
+for (const p of platforms) form.append('platform[]', p);
+if (title) form.append('title', title);
+if (o.description) form.append('description', o.description);
+if (o.at) form.append('scheduled_date', o.at);
+if (o.tz) form.append('timezone', o.tz);
+form.append('async_upload', 'true');
+
+console.log(`\n  ${basename(dir)} · ${(st.size / 1024 ** 2).toFixed(1)} MB · ${platforms.join(', ')}${o.at ? ` · scheduled ${o.at}${o.tz ? ` ${o.tz}` : ' UTC'}` : ' · now'}\n  title: ${title || '(none)'}`);
+if (!o.send) { console.log('\n  Dry run, nothing sent. Add --send to post it.\n'); process.exit(0); }
+if (!process.env.UPLOAD_POST_KEY || !process.env.UPLOAD_POST_USER) fail('set UPLOAD_POST_KEY and UPLOAD_POST_USER in ~/.reelmimic/secrets.json');
+
+form.append('video', await openAsBlob(video, { type: 'video/mp4' }), `${id}.mp4`);
+const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form, headers: { Authorization: `Apikey ${process.env.UPLOAD_POST_KEY}`, 'Idempotency-Key': idem } });
+const body = /** @type {Record<strin
```

**File**: `app/server/jobs.ts` (modified, +7/-3)
```diff
@@ -375,7 +375,8 @@ export async function message(id: string, text: string, meta: MessageMeta = {})
 async function productionNote(id: string, msg: string) {
   const j = load(id), d = dirOf(id), ph = j.pipeline?.phase;
   update(id, (x) => { x.needs = []; x.error = null; x.failed = null; });
-  if (ph === 'cast' || (j.pipeline?.cast && !j.pipeline.cast.pass)) {
+  const cast = (readJSON<Production>(join(d, 'build', 'production.json'))?.characters || []).length > 0;
+  if (cast && (ph === 'cast' || (j.pipeline?.cast && !j.pipeline.cast.pass))) {
     const rv = readJSON<Review>(join(d, 'out', 'check', 'cast', 'review.json')) || {};
     pipe(id, (p) => { p.cast = { round: 0, pass: false, ...p.cast, state: 'fixing' }; });
     if (!(await step(id, 'producing', 'cast_fix', { issues: rv.issues || [], round: 'user', message: msg }, ['out/check/cast/sheet.jpg', 'out/check/cast/fixes.json']))) return;
@@ -411,11 +412,13 @@ export async function approve(id: string) {
 // ---------- production: gates where defects are born ----------
 async function production(id: string, { fresh = false } = {}): Promise<boolean> {
   const d = dirOf(id), prev: Pipeline = fresh ? {} : load(id).pipeline || {};
-  const hasSetup = !fresh && existsSync(join(d, 'build', 'production.json')) && existsSync(join(d, 'out', 'check', 'cast', 'sheet.jpg'));
+  // a piece with no characters (typography, motion graphics) has no cast sheet to make
+  const sheet = (readJSON<Plan>(join(d, 'plan.json'))?.characters || []).length ? ['out/check/cast/sheet.jpg'] : [];
+  const hasSetup = !fresh && [join('build', 'production.json'), ...sheet].every((f) => existsSync(join(d, f)));
   // 1) director: scaffold, shared assets, cast sheets, chunk plan (skipped when resuming)
   if (!hasSetup) {
     pipe(id, (p) => { p.phase = 'setup'; });
-    if (!(await step(id, 'producing', 'setup', {}, ['build/production.json', 'out/check/cast/sheet.jpg']))) return false;
+    if (!(await step(id, 'producing', 'setup', {}, ['build/production.json', ...sheet]))) return false;
   } else setStage(id, 'producing', { error: null, failed: null });
   // 2) cast gate and 3) shot building run at the same time: shots only call the shared character definitions, so cast fixes
   //    flow into them automatically. Shot REVIEWS wait until the cast has passed, and re-grab fresh frames first.
@@ -522,6 +525,7 @@ async function castGate(id: string, prev: Pipeline): Promise<boolean> {
   const files = new Set(chars.map((c) => c.file));
   const parallel = chars.length > 1 && files.size === chars.length && chars.every((c) => existsSync(join(d, c.sheet)));
   if (prev.cast?.pass) return true;
+  if (!(prod.characters || []).length) { pipe(id, (p) => { p.cast = { round: 0, pass: true, state: 'passed' }; }); return true; }   // no cast: nothing to review
   if (!parallel) return castSerial(id, prev);
   const setC = (cid: string, v: Partial<CastCharProgress>) => pipe(id, (p) => { const cast = p.cast!; cast.chars = cast.chars || {}; cast.chars[cid] = { ...(cast.chars[cid] ?? { state: 'queued', round: 0 }), ...v }; });
   const keep: Record<string, CastCharProgress> = prev.cast?.mode === 'parallel' ? prev.cast.chars || {} : {};   // resuming: characters that already passed stay passed
```

**File**: `app/server/pipeline.test.ts` (modified, +38/-1)
```diff
@@ -38,7 +38,7 @@ function outputs(prompt: string, dir: string): [string, Record<string, unknown>]
   if (m(/## 步驟：依使用者意見修改企劃/)) return ['replan', { 'plan.json': { title: 'T', version: 3 } }];
   if (m(/## 步驟：製作準備/)) return ['setup', {
     'build/production.json': { chunks: S.chunks, characters: S.chars.map((id) => ({ id, name: id, file: `build/${id}.js`, sheet: `out/check/cast/sheet_${id}.jpg` })) },
-    'out/check/cast/sheet.jpg': 'jpg', ...Object.fromEntries(S.chars.map((id) => [`out/check/cast/sheet_${id}.jpg`, 'jpg'])) }];
+    ...(S.chars.length ? { 'out/check/cast/sheet.jpg': 'jpg' } : {}), ...Object.fromEntries(S.chars.map((id) => [`out/check/cast/sheet_${id}.jpg`, 'jpg'])) }];   // no cast → no sheet
   if (m(/## 步驟：角色關/)) {
     const round = +(m(/第 (\d+) 輪/)?.[1] || 1), ch = m(/結果寫到 out\/check\/cast\/review_(\S+?)\.json/)?.[1];
     const who = ch || (m(/只看並排圖/) ? 'lineup' : 'serial'), ok = S.castPass(who, round);
@@ -259,3 +259,40 @@ describe('pauses', () => {
     assert.equal(JSON.parse(readFileSync(join(J.dirOf(id), 'plan.json'), 'utf8')).version, 3);
   });
 });
+
+describe('no characters', () => {
+  test('a piece with no cast (typography, motion graphics) skips the cast sheet and the cast gate', async () => {
+    S = base({ chars: [] });
+    const id = newProject('plan_review');
+    writeFileSync(join(J.dirOf(id), 'plan.json'), JSON.stringify({ title: 'T', version: 1, characters: [] }));
+    await J.approve(id);
+    const j = J.load(id);
+    assert.equal(j.stage, 'done', j.error || '');
+    assert.equal(j.pipeline.cast?.pass, true);
+    assert.ok(!calls.some((c) => c.startsWith('cast_')), calls.join(', '));
+  });
+
+  test('a project already stuck at setup (missing cast sheet) finishes on retry', async () => {
+    S = base({ chars: [] });
+    const id = newProject('error', { failed: 'producing', error: '缺少輸出：out/check/cast/sheet.jpg', pipeline: { phase: 'setup' } });
+    writeFileSync(join(J.dirOf(id), 'plan.json'), JSON.stringify({ title: 'T', version: 1, characters: [] }));
+    mkdirSync(join(J.dirOf(id), 'build'), { recursive: true });   // the setup turn itself had succeeded
+    writeFileSync(join(J.dirOf(id), 'build', 'production.json'), JSON.stringify({ chunks: S.chunks, characters: [] }));
+    await J.retry(id);
+    assert.equal(J.load(id).stage, 'done', J.load(id).error || '');
+    assert.ok(!calls.includes('setup') && !calls.some((c) => c.startsWith('cast_')), calls.join(', '));
+  });
+
+  test('a note while paused in the shot line goes to the shots, not to a cast fix', async () => {
+    let s2 = 0;   // S2 fails its first three reviews (the round limit), then passes after the note
+    S = base({ chars: [], shotPass: (shot) => shot !== 'S2' || ++s2 > 3 });
+    const id = newProject('plan_review');
+    writeFileSync(join(J.dirOf(id), 'plan.json'), JSON.stringify({ title: 'T', version: 1, characters: [] }));
+    await J.approve(id);
+    assert.equal(J.load(id).stage, 'needs_input');
+    calls = [];
+    await J.message(id, 'make the title bigger');
+    assert.ok(!calls.some((c) => c.startsWith('cast_')), calls.join(', '));
+    assert.equal(J.load(id).stage, 'done', J.load(id).error || '');
+  });
+});
```

**File**: `app/server/prompts.ts` (modified, +1/-0)
```diff
@@ -149,6 +149,7 @@ ${ENGINE(p)}
 3. **角色設定圖**：每個角色一張 out/check/cast/sheet_<角色id>.jpg（全解析度）：正面、3/4、側面、5 個以上表情、
    6 個以上本片會用到的動作姿勢（舉手、揮手、拿東西、坐、跑、驚嚇…）。再加一張所有角色並排的 out/check/cast/sheet.jpg（比例、互動姿勢）。
    每張都要有可以重新輸出的指令（寫進 production.json 的 characters[].render）。自己先打開看過。
+   plan.characters 是空的（純字卡、動態圖像這類沒有角色的片）就跳過 2、3：不做設定圖，production.json 的 "characters" 寫 []，不要自己加角色。
 4. 寫 build/production.json：
    { "cast_sheet": "out/check/cast/sheet.jpg",
      "characters": [ { "id": "dou", "name": "豆豆", "file": "build/assets/cast/dou.js", "sheet": "out/check/cast/sheet_dou.jpg", "render": "重新輸出這張設定圖的指令" } ],
```

**File**: `secrets.example.json` (modified, +3/-1)
```diff
@@ -6,5 +6,7 @@
   "FFMPEG_DIR": "folder containing ffmpeg/ffprobe if they are not on PATH",
   "CODEX_BIN": "path to a specific codex CLI if an old one shadows it on PATH",
   "BUILDERS": "parallel shot builders per video (default 5)",
-  "MAX_AGENTS": "agents running at once across all projects (default 10)"
+  "MAX_AGENTS": "agents running at once across all projects (default 10)",
+  "UPLOAD_POST_KEY": "optional: post finished videos with npm run post-video (upload-post.com API key)",
+  "UPLOAD_POST_USER": "optional: the Upload-Post profile your social accounts are connected to"
 }
```

---

### Incident Patch 6: `accda29c` (2026-10-04)
**Commit Message**: Address review: stopped background renders stay stopped; tighter render and review slots

- when assembly stops waiting (or the job is cancelled), renders already queued behind the stopped one no longer start
  and write out/frames alongside assembly (test fails without the fix); production clears the flag on (re)start
- reviewSlot hands a freed slot straight to a waiter, so a newcomer can't push the count past MAX_REVIEWS
- render.mjs: a dead owner's slot is renamed away before deletion, so only one waiter reclaims it; Chrome is closed
  on SIGINT/SIGTERM as well
- production.json prerender accepts an args array (arguments with spaces); PRERENDER_WAIT_MS overrides the 10 min wait

**File**: `.claude/skills/anime-cel/template/render.mjs` (modified, +4/-3)
```diff
@@ -87,7 +87,7 @@ async function takeSlot() {
     for (let i = 0; i < SLOTS; i++) {
       const f = `${SLOT_DIR}/slot${i}`;
       try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
-      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
     }
     if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
     await new Promise(r => setTimeout(r, 1000));
@@ -103,9 +103,10 @@ try {
 } catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
-for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+let browser;
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });
 
-const browser = await puppeteer.launch({
+browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
 });
```

**File**: `.claude/skills/crayon-storybook/template/render.mjs` (modified, +4/-3)
```diff
@@ -87,7 +87,7 @@ async function takeSlot() {
     for (let i = 0; i < SLOTS; i++) {
       const f = `${SLOT_DIR}/slot${i}`;
       try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
-      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
     }
     if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
     await new Promise(r => setTimeout(r, 1000));
@@ -103,9 +103,10 @@ try {
 } catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
-for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+let browser;
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });
 
-const browser = await puppeteer.launch({
+browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
 });
```

**File**: `.claude/skills/painted-animation/template/render.mjs` (modified, +4/-3)
```diff
@@ -87,7 +87,7 @@ async function takeSlot() {
     for (let i = 0; i < SLOTS; i++) {
       const f = `${SLOT_DIR}/slot${i}`;
       try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
-      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
     }
     if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
     await new Promise(r => setTimeout(r, 1000));
@@ -103,9 +103,10 @@ try {
 } catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
-for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+let browser;
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });
 
-const browser = await puppeteer.launch({
+browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
 });
```

**File**: `.claude/skills/paper-cutout/template/render.mjs` (modified, +4/-3)
```diff
@@ -87,7 +87,7 @@ async function takeSlot() {
     for (let i = 0; i < SLOTS; i++) {
       const f = `${SLOT_DIR}/slot${i}`;
       try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
-      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
     }
     if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
     await new Promise(r => setTimeout(r, 1000));
@@ -103,9 +103,10 @@ try {
 } catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
-for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+let browser;
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });
 
-const browser = await puppeteer.launch({
+browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
 });
```

**File**: `.claude/skills/pixel-art/template/render.mjs` (modified, +4/-3)
```diff
@@ -87,7 +87,7 @@ async function takeSlot() {
     for (let i = 0; i < SLOTS; i++) {
       const f = `${SLOT_DIR}/slot${i}`;
       try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
-      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
     }
     if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
     await new Promise(r => setTimeout(r, 1000));
@@ -103,9 +103,10 @@ try {
 } catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
-for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+let browser;
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });
 
-const browser = await puppeteer.launch({
+browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
 });
```

**File**: `.claude/skills/whiteboard/template/render.mjs` (modified, +4/-3)
```diff
@@ -87,7 +87,7 @@ async function takeSlot() {
     for (let i = 0; i < SLOTS; i++) {
       const f = `${SLOT_DIR}/slot${i}`;
       try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
-      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) { const t = `${f}.stale${process.pid}`; renameSync(f, t); unlinkSync(t); } } catch {}
     }
     if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
     await new Promise(r => setTimeout(r, 1000));
@@ -103,9 +103,10 @@ try {
 } catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
-for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+let browser;
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { browser?.process()?.kill(); } catch {} process.exit(1); });
 
-const browser = await puppeteer.launch({
+browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
 });
```

**File**: `app/server/jobs.ts` (modified, +17/-10)
```diff
@@ -451,6 +451,7 @@ async function production(id: string, { fresh = false } = {}): Promise<boolean>
   } else setStage(id, 'producing', { error: null, failed: null });
   // 2) cast gate and 3) shot building run at the same time: shots only call the shared character definitions, so cast fixes
   //    flow into them automatically. Shot REVIEWS wait until the cast has passed, and re-grab fresh frames first.
+  prerenderStopped.delete(id);   // a fresh or resumed production may render in the background again
   const castP = castGate(id, prev);
   if (!CONFIG.overlapCast && !(await castP)) return false;   // characters are final before any shot is built
   const prod = readJSON<Production>(join(d, 'build', 'production.json')) || {};
@@ -636,24 +637,30 @@ async function castSerial(id: string, prev: Pipeline, firstReview?: Review | nul
 // re-rendering all 732 frames at assembly.
 const prerenderQ = new Map<string, Promise<void>>(), prerenderProcs = new Map<string, Set<ChildProcess>>();
 const PRERENDER_MAX_MS = (seconds: number) => Math.max(10 * 60e3, seconds * 24 * 6e3);   // ~6 s a frame at worst, never under 10 min
-const ASSEMBLY_WAIT_MS = 10 * 60e3;   // assembly waits this long for background renders, then stops them and renders what's missing itself
+const ASSEMBLY_WAIT_MS = +(process.env.PRERENDER_WAIT_MS || 10 * 60e3);   // assembly waits this long for background renders, then stops them and renders what's missing itself
+// Projects whose background renders were stopped: renders already queued behind the stopped one must not start later
+// and write out/frames while assembly renders there too. Cleared when production (re)starts.
+const prerenderStopped = new Set<string>();
+function stopPrerenders(id: string) { prerenderStopped.add(id); for (const p of prerenderProcs.get(id) || []) p.kill(); prerenderQ.delete(id); }
 export async function waitPrerenders(id: string, maxMs = ASSEMBLY_WAIT_MS) {
   const q = prerenderQ.get(id); if (!q) return;
   let timer: NodeJS.Timeout | undefined;
   const late = await Promise.race([q.then(() => false), new Promise<boolean>((r) => { timer = setTimeout(() => r(true), maxMs); })]);
   clearTimeout(timer);
-  if (late) { log(id, { type: 'error', text: `背景渲染超過 ${Math.round(maxMs / 60e3)} 分鐘，先停掉，組裝時補渲` }); for (const p of prerenderProcs.get(id) || []) p.kill(); prerenderQ.delete(id); }
+  if (late) { log(id, { type: 'error', text: `背景渲染超過 ${Math.round(maxMs / 60e3)} 分鐘，先停掉，組裝時補渲` }); stopPrerenders(id); }
 }
 function prerender(id: string, c: Chunk) {
-  const d = dirOf(id), pr = (readJSON<Production>(join(d, 'build', 'production.json')) || {}).prerender as { cwd?: string; cmd?: string } | undefined;
-  if (!pr?.cmd) return;
+  const d = dirOf(id), pr = (readJSON<Production>(join(d, 'build', 'production.json')) || {}).prerender as { cwd?: string; cmd?: string; args?: string[] } | undefined;
+  if (!pr?.cmd && !pr?.args?.length) return;
   type S = { id?: string; start_s?: number; end_s?: number };
   const mine = ((readJSON<Plan>(join(d, 'plan.json'))?.shots || []) as S[]).filter((s) => s.id && c.shots.includes(s.id) && s.start_s != null && s.end_s != null);
   if (!mine.length) return;
   const a = Math.min(...mine.map((s) => s.start_s!)), b = Math.max(...mine.map((s) => s.end_s!));
-  const [bin, ...args] = pr.cmd.replace('{start}', a.toFixed(3)).replace('{end}', b.toFixed(3)).split(/\s+/);
+  // "args": ["node", "render.mjs", …] keeps arguments with spaces intact; "cmd" is split on whitespace
+  const fill = (x: string) => x.replace('{start}', a.toFixed(3)).replace('{end}', b.toFixed(3));
+  const [bin, ...args] = pr.args?.length ? pr.args.map(fill) : fill(pr.cmd!).split(/\s+/);
   const run = () => new Promise<void>((resolve) => {
-    if (load(id).stage === 'error') return resolve();   // cancelled or failed meanwhile
+    if (prerenderStopped.has(id) || load(id).stage === 'error') return resolve();   // stopped, cancelled or failed meanwhile
     log(id, { type: 'tool', name: 'prerender', detail: `${c.id} ${a.toFixed(2)}–${b.toFixed(2)} s: ${bin} ${args.join(' ')}` });
     const t0 = Date.now(), p = spawn(bin, args, { cwd: join(d, pr.cwd || 'build'), env: process.env, stdio: 'ignore' });
     const set = prerenderProcs.get(id) || new Set(); set.add(p); prerenderProcs.set(id, set);
@@ -670,9 +677,9 @@ function prerender(id: string, c: Chunk) {
 const reviewQ = new Map<string, { n: number; wait: (() => void)[] }>();
 async function reviewSlot<T>(id: string, fn: () => Promise<T>): Promise<T> {
   const q = reviewQ.get(id) || { n: 0, wait: [] }; reviewQ.set(id, q);
-  if (q.n >= CONFIG.maxReviews) await new Promise<void>((r) => q.wait.push(r));
-  q.n++;
-  try { return await fn(); } finally { q.n--; q.wait.shift()?.(); }
+  if (q.n >= CONFIG.maxReviews) await new Promise<void>((r) => q.wait.push(r));   // woken with the slot already counted
+  else q.n++;
+  try { return await fn(); } finally { const next = q.wait.shift(); if (next) next(); else q.n--; }
 }
 
 const
```

**File**: `app/server/pipeline.test.ts` (modified, +13/-0)
```diff
@@ -9,6 +9,7 @@ import type { AgentRun } from './agents/index.ts';
 
 const TMP = mkdtempSync(join(tmpdir(), 'reelmimic-pipe-'));
 process.env.REELMIMIC_PROJECTS = TMP;
+process.env.PRERENDER_WAIT_MS = '2000';   // assembly gives up on a stuck background render after 2 s here
 after(() => rmSync(TMP, { recursive: true, force: true }));
 
 // ---------- the fake agent ----------
@@ -211,6 +212,18 @@ describe('production', () => {
     assert.ok(ev.indexOf(doneAt[1]) < assemble, 'assembly started before the background render finished');
   });
 
+  test('when assembly stops waiting for a stuck background render, renders queued behind it never start', async () => {
+    S = base({ prerender: 'node -e setTimeout(()=>{},20000)' });   // every background render hangs
+    const id = newProject('plan_review');
+    writeFileSync(join(J.dirOf(id), 'plan.json'), JSON.stringify({ title: 'T', version: 1, shots: [{ id: 'S1', start_s: 0, end_s: 2 }, { id: 'S2', start_s: 2, end_s: 4 }] }));
+    await J.approve(id);
+    assert.equal(J.load(id).stage, 'done', J.load(id).error || '');
+    await new Promise((r) => setTimeout(r, 500));   // give a wrongly queued render time to show up
+    const ev = readFileSync(join(J.dirOf(id), 'logs', 'events.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
+    assert.equal(ev.filter((e) => e.name === 'prerender').length, 1, 'a queued background render started after assembly gave up');
+    assert.ok(ev.some((e) => /背景渲染超過/.test(e.text || '')));
+  });
+
   test('shot reviews start while the builder is still working (per-shot watcher)', async () => {
     S = base({ chunks: [{ id: 'C1', shots: ['S1', 'S2'] }], buildDelayMs: 4600 });
     const id = newProject('plan_review');
```

---

### Incident Patch 7: `c2111b06` (2026-10-04)
**Commit Message**: Merge pull request #19 from revaldianggara/fix/lrc-lyrics

align_lyrics.py: read .lrc files

**File**: `.claude/skills/video-clone/scripts/align_lyrics.py` (modified, +16/-1)
```diff
@@ -48,6 +48,21 @@ def transcribe(wav, model_name, lang):
     return chars
 
 
+# Plain text (one line each) or LRC: "[00:12.34]line", "<00:12.34>" word times (enhanced LRC), "[ti:..]" / "[Chorus]" tags
+# (dropped). A line with several timestamps is sung that many times (a repeated chorus): it's listed once per time, in time order.
+LRC_TIME = re.compile(r"^(\[\d+:\d+(?:[.:]\d+)?\])+"); LRC_WORD = re.compile(r"<\d+:\d+(?:[.:]\d+)?>")
+def lyric_lines(text):
+    out, repeated = [], False   # (time or None, line)
+    for l in text.splitlines():
+        l = l.strip(); m = LRC_TIME.match(l); t = LRC_WORD.sub("", l[m.end():] if m else l).strip()
+        if not t or t.startswith("["): continue
+        stamps = re.findall(r"\[(\d+):(\d+)(?:[.:](\d+))?\]", m.group(0)) if m else []
+        repeated |= len(stamps) > 1
+        out += [(int(mm) * 60 + int(ss) + float("0." + (ff or "0")), t) for mm, ss, ff in stamps] or [(None, t)]
+    if repeated and all(s is not None for s, _ in out): out.sort(key=lambda x: x[0])
+    return [t for _, t in out]
+
+
 def fmt(t):
     t = max(0.0, t); return f"[{int(t // 60):02d}:{t % 60:05.2f}]"
 
@@ -57,7 +72,7 @@ def main():
     ap.add_argument("--start", type=float, default=0.0); ap.add_argument("--end", type=float)
     ap.add_argument("--model", default="medium"); ap.add_argument("--lang", default="zh")
     a = ap.parse_args()
-    lines = [l.strip() for l in open(a.lyrics, encoding="utf-8").read().splitlines() if l.strip() and not l.strip().startswith("[")]
+    lines = lyric_lines(open(a.lyrics, encoding="utf-8").read())
     if not lines: sys.exit("no lyric lines in " + a.lyrics)
     tmp = os.path.join(tempfile.mkdtemp(), "clip.wav")
     cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(a.start)]
```

---

### Incident Patch 8: `02a5cfb9` (2026-10-04)
**Commit Message**: post-video: require a passed final review, fix the idempotency key, rename the script

- "done" also covers a final review that stopped at its round limit with must-fix items left, so the stage alone
  let a rejected video through; now the last critique must have passed, or --force (with a warning)
- the idempotency key now includes the time zone and the profile: correcting --tz for the same --at used to return
  the earlier schedule instead of making a new one
- npm run publish -> npm run post-video (easy to confuse with npm publish); document UPLOAD_POST_API

**File**: `README.md` (modified, +5/-4)
```diff
@@ -131,19 +131,20 @@ committed. See [`secrets.example.json`](secrets.example.json) for the format.
 | `CODEX_SANDBOX` | Codex sandbox mode (default `danger-full-access`, like Claude Code with Bash allowed; `workspace-write` blocks the Chrome renderer) |
 | `BUILDERS`, `MAX_AGENTS` | How many agents work on one video at once (default 6), and the limit across all projects (default 12) |
 | `PORT` | Web port (default 4318) |
-| `UPLOAD_POST_KEY`, `UPLOAD_POST_USER` | Optional. Post a finished video to TikTok, Instagram, YouTube and others with `npm run publish` (see below) |
+| `UPLOAD_POST_KEY`, `UPLOAD_POST_USER` | Optional. Post a finished video to TikTok, Instagram, YouTube and others with `npm run post-video` (see below); `UPLOAD_POST_API` overrides the API address |
 
 ### Posting the finished video (optional)
 
 ReelMimic never posts anything by itself. Once a project's final review is done and you're happy with the video, you can
 send it to your social accounts through [Upload-Post](https://upload-post.com) from the `app/` folder:
 
 ```bash
-npm run publish -- <project id> --platforms tiktok,instagram,youtube                 # dry run: shows what it would post
-npm run publish -- <project id> --platforms tiktok --at 2026-10-05T18:00 --tz Europe/Madrid --send
+npm run post-video -- <project id> --platforms tiktok,instagram,youtube              # dry run: shows what it would post
+npm run post-video -- <project id> --platforms tiktok --at 2026-10-05T18:00 --tz Europe/Madrid --send
 ```
 
-Without `--send` nothing leaves your computer. It only takes projects whose stage is `done`, uses the plan's title
+Without `--send` nothing leaves your computer. It only takes projects whose final review passed (`--force` to post one
+that stopped with must-fix items left), uses the plan's title
 unless you pass `--title`, and a rerun of the same video won't post it twice.
 
 ## Docs
```

**File**: `app/package.json` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     "test": "node --test --experimental-test-module-mocks \"server/**/*.test.ts\"",
     "check": "npm run typecheck && npm run lint && npm test",
     "doctor": "node scripts/doctor.mjs",
-    "publish": "node scripts/publish.mjs",
+    "post-video": "node scripts/post-video.mjs",
     "setup": "npm install && node scripts/doctor.mjs"
   },
   "dependencies": {
```

**File**: `app/scripts/post-video.mjs` (renamed, +16/-8)
```diff
@@ -1,9 +1,10 @@
-// Optional: post a finished video to social platforms through Upload-Post (https://upload-post.com).   npm run publish -- <project>
-// Never runs on its own: nothing in the pipeline calls it, and it only takes a project whose final review is done.
+// Optional: post a finished video to social platforms through Upload-Post (https://upload-post.com).   npm run post-video -- <project>
+// Never runs on its own: nothing in the pipeline calls it, and it only takes a project whose final review passed.
 // Without --send it is a dry run: it prints what it would post and sends nothing.
-//   npm run publish -- 20261003-ab12c --platforms tiktok,instagram,youtube
-//   npm run publish -- 20261003-ab12c --platforms tiktok --title "Bath Time" --at 2026-10-05T18:00 --tz Europe/Madrid --send
+//   npm run post-video -- 20261003-ab12c --platforms tiktok,instagram,youtube
+//   npm run post-video -- 20261003-ab12c --platforms tiktok --title "Bath Time" --at 2026-10-05T18:00 --tz Europe/Madrid --send
 // Needs UPLOAD_POST_KEY (an API key) and UPLOAD_POST_USER (the profile the accounts are connected to) in ~/.reelmimic/secrets.json.
+// UPLOAD_POST_API overrides the API address (the key is sent there), e.g. for a staging server.
 // @ts-check
 import { createHash } from 'node:crypto';
 import { existsSync, openAsBlob, readFileSync, statSync } from 'node:fs';
@@ -21,23 +22,30 @@ const readJSON = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } ca
 
 const { values: o, positionals } = parseArgs({ allowPositionals: true, options: {
   platforms: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
-  at: { type: 'string' }, tz: { type: 'string' }, send: { type: 'boolean', default: false },
+  at: { type: 'string' }, tz: { type: 'string' }, send: { type: 'boolean', default: false }, force: { type: 'boolean', default: false },
 } });
 const id = positionals[0];
-if (!id || !o.platforms) fail('usage: npm run publish -- <project id> --platforms tiktok,instagram [--title …] [--description …] [--at 2026-10-05T18:00 --tz Europe/Madrid] [--send]');
+if (!id || !o.platforms) fail('usage: npm run post-video -- <project id> --platforms tiktok,instagram [--title …] [--description …] [--at 2026-10-05T18:00 --tz Europe/Madrid] [--send] [--force]');
 if (!/^[\w-]+$/.test(id)) fail(`not a project id: ${id}`);
 const dir = join(PROJECTS, id), job = readJSON(join(dir, 'job.json')), video = join(dir, 'out', 'video.mp4');
 if (!job) fail(`no such project: ${dir}`);
 // Only after the final review: a video still being produced or revised is not the one you approved.
 if (job.stage !== 'done') fail(`project is "${job.stage}", not "done". Publish only once the final review is finished`);
+// "done" also means the final review stopped at its round limit with must-fix items left: require a pass, or --force.
+if (!job.lastCritique?.pass) {
+  const why = job.lastCritique ? `the final review did not pass (${job.lastCritique.must} must-fix item(s) left)` : 'no final review result on record';
+  if (!o.force) fail(`${why}. Fix them first, or pass --force to post it anyway`);
+  console.log(`  [33m![0m ${why}; posting anyway (--force)`);
+}
 if (!existsSync(video)) fail(`no final video at ${video}`);
 const platforms = String(o.platforms).split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
 const title = (o.title || readJSON(join(dir, 'plan.json'))?.title || job.title || '').trim();
 if (!title && platforms.includes('youtube')) fail('YouTube needs a title: pass --title');
 if (o.tz && !o.at) fail('--tz only applies with --at');
 
-// Same project + same video file → same key, so a retried run never posts the video twice.
-const st = statSync(video), idem = createHash('sha256').update(`${id}:${st.size}:${st.mtimeMs}:${platforms.join(',')}:${o.at || ''}`).digest('hex').slice(0, 32);
+// Same project + video file + target (profile, platforms, time and time zone) → same key, so a retried run never posts the
+// video twice, while correcting --tz (or --at) is a new request instead of silently returning the earlier schedule.
+const st = statSync(video), idem = createHash('sha256').update(`${id}:${st.size}:${st.mtimeMs}:${process.env.UPLOAD_POST_USER || ''}:${platforms.join(',')}:${o.at || ''}:${o.tz || ''}`).digest('hex').slice(0, 32);
 const form = new FormData();
 form.append('user', process.env.UPLOAD_POST_USER || '');
 for (const p of platforms) form.append('platform[]', p);
```

**File**: `secrets.example.json` (modified, +1/-1)
```diff
@@ -7,6 +7,6 @@
   "CODEX_BIN": "path to a specific codex CLI if an old one shadows it on PATH",
   "BUILDERS": "parallel shot builders per video (default 5)",
   "MAX_AGENTS": "agents running at once across all projects (default 10)",
-  "UPLOAD_POST_KEY": "optional: post finished videos with npm run publish (upload-post.com API key)",
+  "UPLOAD_POST_KEY": "optional: post finished videos with npm run post-video (upload-post.com API key)",
   "UPLOAD_POST_USER": "optional: the Upload-Post profile your social accounts are connected to"
 }
```

---

### Incident Patch 9: `31bd88f0` (2026-10-02)
**Commit Message**: Final review keeps revising while a short must-fix list keeps shrinking (up to 3 extra rounds)

**File**: `app/server/jobs.ts` (modified, +6/-2)
```diff
@@ -683,6 +683,7 @@ function pause(id: string) { setStage(id, 'needs_input'); return false; }
 // ---------- final panel: seams, continuity, pacing; verifies every earlier fix ----------
 async function finalPanel(id: string) {
   const d = dirOf(id);
+  let prevMust = Infinity;
   for (let round = 1; ; round++) {
     pipe(id, (p) => { p.phase = 'final'; p.final = { round }; });
     if (!(await step(id, 'critiquing', 'critique', { round }, ['out/check/critique.json'], null, { session: 'fresh', who: 'critic' }))) return;
@@ -695,8 +696,11 @@ async function finalPanel(id: string) {
     update(id, (j) => { j.critiqueRounds = total; j.lastCritique = { pass: !must.length, must: must.length, at: now() }; });
     const needs = collectNeeds(id, c.needs_user, 'critic');
     if (!must.length) { chat(id, 'system', needs ? L(id, '評審：導演能修的都過了，剩下需要你提供的項目', 'Final review: everything the director can fix is done. What is left needs your input') : L(id, `評審通過（第 ${total} 輪）`, `Final review passed (round ${total})`)); setStage(id, needs ? 'needs_input' : 'done'); return; }
-    // ≤ 2 items left at the limit: one more revise instead of stopping with them unfixed
-    if (round > rounds(id).finalRounds + (must.length <= 2 ? 1 : 0)) { chat(id, 'system', L(id, `評審仍有 ${must.length} 項必修，已達自動修改上限，請你決定`, `The final review still has ${must.length} must-fix item${must.length > 1 ? 's' : ''} and the automatic fix limit is reached. Please decide`)); setStage(id, 'done'); return; }
+    // Past the limit, keep going while the list is short (≤ 2) and still shrinking, up to 3 extra rounds: a real run went
+    // 8 → 3 → 2 → 1 and stopped with its last, most visible defect unfixed. A list that stops shrinking stops the loop.
+    const converging = must.length <= 2 && must.length < prevMust && round <= rounds(id).finalRounds + 3;
+    prevMust = must.length;
+    if (round > rounds(id).finalRounds && !converging) { chat(id, 'system', L(id, `評審仍有 ${must.length} 項必修，已達自動修改上限，請你決定`, `The final review still has ${must.length} must-fix item${must.length > 1 ? 's' : ''} and the automatic fix limit is reached. Please decide`)); setStage(id, 'done'); return; }
     const msg = must.map((m, i) => `${i + 1}. [${m.shot || '全片'}${m.time != null ? ' ' + m.time + 's' : ''}] ${m.issue}${m.fix ? ' → 建議：' + m.fix : ''}`).join('\n');
     chat(id, 'system', L(id, `評審第 ${total} 輪：${must.length} 項必修，交回導演（每項要附修改前後對照）`, `Final review round ${total}: ${must.length} must-fix item${must.length > 1 ? 's' : ''}, sent back to the director (each fix needs before/after proof)`));
     if (!(await step(id, 'revising', 'revise', { message: msg, round }, ['out/video.mp4', 'out/check/fixes.json']))) return;
```

**File**: `app/server/pipeline.test.ts` (modified, +11/-3)
```diff
@@ -181,14 +181,22 @@ describe('production', () => {
     assert.ok(calls.includes('shot_qa:S1:4'));
   });
 
-  test('two must-fix items left at the final limit get one more revise', async () => {
-    S = base({ critique: (r) => ({ must: r <= 3 ? 2 : 0 }) });
+  test('past the final limit, revising continues while a short must-fix list keeps shrinking', async () => {
+    S = base({ critique: (r) => ({ must: [4, 3, 2, 1, 0][r - 1] }) });
     const id = newProject('plan_review');
     await J.approve(id);
-    assert.equal(calls.filter((c) => c === 'revise').length, 3);
+    assert.equal(calls.filter((c) => c === 'revise').length, 4);
     assert.equal(J.load(id).lastCritique?.pass, true);
   });
 
+  test('a must-fix list that stops shrinking stops at the limit', async () => {
+    S = base({ critique: () => ({ must: 2 }) });
+    const id = newProject('plan_review');
+    await J.approve(id);
+    assert.equal(calls.filter((c) => c === 'revise').length, 2);
+    assert.equal(J.load(id).lastCritique?.pass, false);
+  });
+
   test('a passed segment is rendered in the background and assembly waits for it', async () => {
     S = base({ prerender: 'node -e setTimeout(()=>{},300)' });
     const id = newProject('plan_review');
```

---

### Incident Patch 10: `606cf48b` (2026-10-02)
**Commit Message**: Critic: visible silhouette breaks and outline-less fragments are must-fix, never nice-to-have

**File**: `app/server/prompts.ts` (modified, +3/-0)
```diff
@@ -60,6 +60,7 @@ const EYE = `用人眼逐處檢查（一定要看全解析度的放大截圖，
 - 角色：每個身體部位都接在一起（頭—脖子—身體、肩—上臂—前臂—手、臀—腿—腳），沒有浮空的手、沒有硬黏在邊緣的手臂、沒有少脖子；
   關節處沒有接縫線或兩層描邊；比例、配色、髮型、服裝和角色設定圖一致；描線粗細全身一致；表情讀得懂；手拿的東西真的接觸到手。
 - 設計圖：使用者有給角色設計圖（plan.characters[].design）就把它和畫面裡的角色並排比：比例、眼睛、手腳、配色、配件位置，走樣是 blocker。
+  舉手、轉身、指人時輪廓不能出現凹口、缺角或斜切（特寫最明顯）。
 - 穿插與遮擋：角色之間、角色和道具不互相穿透；前後關係正確。
 - 畫面：主體夠大（有情緒、對話、表情戲的鏡頭，主角至少佔畫面高度 35%，看得清臉；只有刻意的遠景建立鏡頭例外）、沒有無用途的大片空白；
   字不壓主體；字幕要把整張圖縮到手機寬度（約 390px 寬）也讀得出來：字高至少畫面高度 4.5%、有描邊或半透明底；沒有色帶、髒污、破圖、閃格、跳格；轉場每個接縫都有。
@@ -341,6 +342,8 @@ ${WOW}
    第 2 輪以後：先讀 out/check/fixes.json，**逐項核對上一輪的必修是否真的修好**（看它附的 before/after，再自己在成片同一秒抽格確認；動作類的修正一定要看 12fps 連續影格，不是單張）；
    說修好但沒修好的，原樣列回 must_fix 並註明「上一輪已列，仍未修好」。**被修改過的鏡頭整鏡用 12fps 重看一次**，修改引進的新問題列 must_fix。
    第 2 輪以後新的 must_fix 只能是：沒修好的、修改造成的新問題、或真正的 blocker（觀眾一眼看得出來）；其他放 nice_to_have，不要每輪加碼。
+   **nice_to_have 只能放觀眾用正常速度看不出來的東西。** 角色輪廓破損（凹口、缺角、斜切、手腳和身體接不起來）、沒有描邊的碎片、
+   配件讀錯——只要在一般大小的成片裡看得到，就是 must_fix，不論是哪一輪發現的。
 ${EYE}
 6. 寫 out/check/critique.json：
    { "pass": false,
```

---

### Incident Patch 11: `06c7ef4b` (2026-10-02)
**Commit Message**: Previews no longer queue behind bulk renders; the climax's weaknesses are must-fix

- render.mjs: --frames/--clip/--png use a separate pool (BULK_RENDER_SLOTS, default 1): previews averaged 93 s in
  production against 3.5 s idle, mostly waiting behind multi-minute renders
- wow rules: protagonist >= 30% of frame height at the hit and the hold after; held breath close to the reference's
  length and near-blank frames <= 1.2 s; accessories must not change the silhouette (a black headband read as hair)
- critic: weaknesses it writes about a climax are must-fix even when the verdict is ours_better; single-frame pose
  swaps in hero shots are must-fix

**File**: `.claude/skills/anime-cel/template/render.mjs` (modified, +6/-2)
```diff
@@ -16,7 +16,8 @@
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
 //   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
-//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
+//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
+//   at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
 import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
@@ -75,7 +76,10 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
 // One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
 // A slot whose owner died (its turn was cut off) is taken back.
-const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
+// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
+const BULK = !!(args.frames || args.clip || args.png);
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
 const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
 async function takeSlot() {
   mkdirSync(SLOT_DIR, { recursive: true });
```

**File**: `.claude/skills/crayon-storybook/template/render.mjs` (modified, +6/-2)
```diff
@@ -16,7 +16,8 @@
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
 //   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
-//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
+//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
+//   at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
 import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
@@ -75,7 +76,10 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
 // One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
 // A slot whose owner died (its turn was cut off) is taken back.
-const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
+// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
+const BULK = !!(args.frames || args.clip || args.png);
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
 const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
 async function takeSlot() {
   mkdirSync(SLOT_DIR, { recursive: true });
```

**File**: `.claude/skills/painted-animation/template/render.mjs` (modified, +6/-2)
```diff
@@ -16,7 +16,8 @@
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
 //   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
-//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
+//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
+//   at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
 import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
@@ -75,7 +76,10 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
 // One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
 // A slot whose owner died (its turn was cut off) is taken back.
-const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
+// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
+const BULK = !!(args.frames || args.clip || args.png);
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
 const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
 async function takeSlot() {
   mkdirSync(SLOT_DIR, { recursive: true });
```

**File**: `.claude/skills/paper-cutout/template/render.mjs` (modified, +6/-2)
```diff
@@ -16,7 +16,8 @@
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
 //   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
-//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
+//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
+//   at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
 import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
@@ -75,7 +76,10 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
 // One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
 // A slot whose owner died (its turn was cut off) is taken back.
-const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
+// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
+const BULK = !!(args.frames || args.clip || args.png);
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
 const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
 async function takeSlot() {
   mkdirSync(SLOT_DIR, { recursive: true });
```

**File**: `.claude/skills/pixel-art/template/render.mjs` (modified, +6/-2)
```diff
@@ -16,7 +16,8 @@
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
 //   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
-//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
+//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
+//   at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
 import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
@@ -75,7 +76,10 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
 // One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
 // A slot whose owner died (its turn was cut off) is taken back.
-const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
+// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
+const BULK = !!(args.frames || args.clip || args.png);
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
 const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
 async function takeSlot() {
   mkdirSync(SLOT_DIR, { recursive: true });
```

**File**: `.claude/skills/whiteboard/template/render.mjs` (modified, +6/-2)
```diff
@@ -16,7 +16,8 @@
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
 //   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
-//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
+//   At most RENDER_SLOTS (default 4) previews and BULK_RENDER_SLOTS (default 1) --frames/--clip/--png renders hold a Chrome
+//   at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
 import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
@@ -75,7 +76,10 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
 // One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
 // A slot whose owner died (its turn was cut off) is taken back.
-const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+// Bulk renders (--frames/--clip/--png: minutes long) get their own small pool so quick previews never queue behind them
+// (a real run: previews averaged 93 s each against 3.5 s on an idle machine, mostly waiting).
+const BULK = !!(args.frames || args.clip || args.png);
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots${BULK ? '_bulk' : ''}`, SLOTS = +(BULK ? process.env.BULK_RENDER_SLOTS || 1 : process.env.RENDER_SLOTS || 4);
 const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
 async function takeSlot() {
   mkdirSync(SLOT_DIR, { recursive: true });
```

**File**: `app/server/prompts.ts` (modified, +6/-3)
```diff
@@ -20,11 +20,12 @@ const REF = 'analysis/proxy.mp4（沒有 proxy.mp4 才用 analysis/source.mp4；
 // gate compared against the drawing: proportions drifted shot to shot, accessories sat on top of the head, arms vanished.
 const DESIGN = `**使用者給的角色設計圖（inputs/ 裡的圖）就是規格**：輪廓比例（寬:高）、眼睛位置與大小、手腳的數量／位置／粗細、配色都照圖。
   不要拿引擎內建的同名角色或自己的印象去改；配件（帽子、耳機、墨鏡、髮型）要戴在對的部位（墨鏡在眼睛上、耳機在頭兩側），跟著身體一起轉，不能疊在頭頂蓋掉身體；
-  倒過來、拉長、壓扁、特寫等特殊姿勢也一樣要認得出是同一隻。`;
+  倒過來、拉長、壓扁、特寫等特殊姿勢也一樣要認得出是同一隻。
+  配件不能改變輪廓的判讀：大面積深色的頭帶、帽子會被看成頭髮或另一個部位，要細、要有高光或和身體對比明顯的顏色；特寫時再確認一次。`;
 // The point of every video: a moment that gives goosebumps. Shared by the planner, builders, reviewers and the critic.
 const WOW = `**這支片的目標是驚艷，讓人起雞皮疙瘩**，不是「沒有錯」。驚艷來自高潮設計，不是平均用力：
-- 高潮 = 鋪陳（張力往上堆）→ 屏息（安靜、停住、收窄）→ 爆發（落在重拍：構圖、色彩、動作、聲音同時翻轉）→ 停住（讓情緒落地 ≥ 1 秒，不要馬上切走）。
-- 爆發那一下要「看得到」：主體大、清楚、畫面密度和參考片的爆點一樣滿；閃白、光圈、轉場只能當引信，**不准用閃白或轉場蓋掉該被看到的那一刻**（擁抱、揭露、表情）。
+- 高潮 = 鋪陳（張力往上堆）→ 屏息（安靜、停住、收窄；長度和參考片的屏息接近（±30%），近乎空白的畫面不超過 1.2 秒）→ 爆發（落在重拍：構圖、色彩、動作、聲音同時翻轉）→ 停住（讓情緒落地 ≥ 1 秒，不要馬上切走）。
+- 爆發那一下要「看得到」：主體大、清楚（爆點那一格和之後的停住段，主角至少佔畫面高 30%；要拉寬景秀規模就讓主角在前景或在畫面中心被放大，不要變成遠方的小點）、畫面密度和參考片的爆點一樣滿；閃白、光圈、轉場只能當引信，**不准用閃白或轉場蓋掉該被看到的那一刻**（擁抱、揭露、表情）。
 - 力氣集中在 plan.peaks 的 hero 鏡頭：特製姿勢、誇張變形臉、衝擊格、smear、光芒/粒子、鏡頭震動、色彩翻轉、音效（蓄力、撞擊、爆點前的安靜）——參考片爆點用了什麼，我們至少一樣多。
 - 判斷爆點一律用連續影格，不看單張：python ${SKILL}/scripts/clip_strip.py <我們的影片> --range a:b --vs ${REF} --vs-range c:d --out …（參考在上、我們在下，逐格對齊）。
 - 驚艷也需要變化：同一個場景＋同一個機位不能超過全片的 40%；兩個高潮之間要換場景、換視角或換色彩世界；鋪陳段每 1–1.5 秒畫面要有新的東西（運鏡、構圖、新元素），不能一個構圖停 3 秒等爆點。`;
@@ -328,6 +329,8 @@ ${WOW}
    （我們：build_from_s 到 hit_s+hold_after_s；參考：peaks.json 的 from–to），打開逐格比：鋪陳、屏息、爆點那一格、停住、畫面密度、主體大小、聲音落點
    （用 ffmpeg 的 astats/ebur128 量我們爆點前後的音量變化，對照參考）。判定 ours_better / equal / ref_better 並寫具體理由。
    **ref_better 就不能通過**：在 must_fix 寫出要加什麼才會贏（具體到手法、格數、大小）。
+   **就算判 ours_better，你在 why 裡寫到的弱點（主角太小、屏息太長、爆點後沒東西看、配件讀錯）也要各列一條 must_fix**——高潮是這支片的全部價值，不放在 nice_to_have。
+   hero 鏡頭裡一格就換姿勢（沒有中間格）、主角在爆點或停住段小於畫面高 30%，都是 must_fix。
 3. 成片：ffmpeg 每 0.5 秒抽一格做總覽到 out/check/critic/，全部打開；每個接縫抽前後 0.5 秒的 strip；
    每個動作用 clip_strip.py 抽 12fps 連續影格看（跳格、瞬移、該動不動、僵硬）；可疑處抽全解析度放大。
    跑 python ${SKILL}/scripts/motion_check.py out/video.mp4 --out out/check/critic/motion，打開它產生的每張 strip。
```

---

### Incident Patch 12: `eb88a12a` (2026-10-02)
**Commit Message**: Background renders can't stall a job: render.mjs always exits; prerender timeout; assembly waits at most 10 min

A finished --frames run hung 7 hours in browser.close(); every later segment's prerender queued behind it and assembly
waited on the queue forever. render.mjs now gives Chrome 10 s to close then exits; the server kills a background render
after ~6 s a frame (min 10 min) and assembly stops waiting after 10 minutes and renders what is missing itself.

**File**: `.claude/skills/anime-cel/template/render.mjs` (modified, +4/-1)
```diff
@@ -221,4 +221,7 @@ if (args.sheet || args.strip) {
 } else {
   console.log('nothing to do: see the usage notes at the top of render.mjs');
 }
-await browser.close();
+// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
+// it waited). Give it 10 s, then exit anyway: the work is already on disk.
+await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
+process.exit(0);
```

**File**: `.claude/skills/crayon-storybook/template/render.mjs` (modified, +4/-1)
```diff
@@ -225,4 +225,7 @@ if (args.sheet || args.strip) {
 } else {
   console.log('nothing to do: see the usage notes at the top of render.mjs');
 }
-await browser.close();
+// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
+// it waited). Give it 10 s, then exit anyway: the work is already on disk.
+await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
+process.exit(0);
```

**File**: `.claude/skills/painted-animation/template/render.mjs` (modified, +4/-1)
```diff
@@ -221,4 +221,7 @@ if (args.sheet || args.strip) {
 } else {
   console.log('nothing to do: see the usage notes at the top of render.mjs');
 }
-await browser.close();
+// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
+// it waited). Give it 10 s, then exit anyway: the work is already on disk.
+await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
+process.exit(0);
```

**File**: `.claude/skills/paper-cutout/template/render.mjs` (modified, +4/-1)
```diff
@@ -221,4 +221,7 @@ if (args.sheet || args.strip) {
 } else {
   console.log('nothing to do: see the usage notes at the top of render.mjs');
 }
-await browser.close();
+// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
+// it waited). Give it 10 s, then exit anyway: the work is already on disk.
+await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
+process.exit(0);
```

**File**: `.claude/skills/pixel-art/template/render.mjs` (modified, +4/-1)
```diff
@@ -221,4 +221,7 @@ if (args.sheet || args.strip) {
 } else {
   console.log('nothing to do: see the usage notes at the top of render.mjs');
 }
-await browser.close();
+// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
+// it waited). Give it 10 s, then exit anyway: the work is already on disk.
+await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
+process.exit(0);
```

**File**: `.claude/skills/whiteboard/template/render.mjs` (modified, +4/-1)
```diff
@@ -221,4 +221,7 @@ if (args.sheet || args.strip) {
 } else {
   console.log('nothing to do: see the usage notes at the top of render.mjs');
 }
-await browser.close();
+// Chrome's shutdown can hang (seen: a finished --frames run sat 7 hours in browser.close(), and everything queued behind
+// it waited). Give it 10 s, then exit anyway: the work is already on disk.
+await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10000))]);
+process.exit(0);
```

**File**: `app/server/jobs.ts` (modified, +14/-2)
```diff
@@ -545,7 +545,7 @@ async function production(id: string, { fresh = false } = {}): Promise<boolean>
   if (failed.length) { chat(id, 'system', L(id, `有 ${failed.length} 段沒通過鏡頭審查：${failed.map(([k, v]) => `${k}(${v.state})`).join('、')}，請你看這幾段決定`, `${failed.length} part${failed.length > 1 ? 's' : ''} didn't pass shot review: ${failed.map(([k, v]) => `${k} (${v.state})`).join(', ')}. Please take a look and decide`)); setStage(id, 'needs_input'); return false; }
   // 4) assemble (after the background renders of passed segments, so their frames are reused, not redrawn)
   pipe(id, (p) => { p.phase = 'assemble'; });
-  await (prerenderQ.get(id) || Promise.resolve());
+  await waitPrerenders(id);
   return step(id, 'producing', 'assemble', {}, ['out/video.mp4'], 'done');
 }
 // ---------- cast gate ----------
@@ -635,6 +635,15 @@ async function castSerial(id: string, prev: Pipeline, firstReview?: Review | nul
 // share out/frames/manifest.json), so assembly only redraws what changed afterwards. A real run spent 29 minutes
 // re-rendering all 732 frames at assembly.
 const prerenderQ = new Map<string, Promise<void>>(), prerenderProcs = new Map<string, Set<ChildProcess>>();
+const PRERENDER_MAX_MS = (seconds: number) => Math.max(10 * 60e3, seconds * 24 * 6e3);   // ~6 s a frame at worst, never under 10 min
+const ASSEMBLY_WAIT_MS = 10 * 60e3;   // assembly waits this long for background renders, then stops them and renders what's missing itself
+export async function waitPrerenders(id: string, maxMs = ASSEMBLY_WAIT_MS) {
+  const q = prerenderQ.get(id); if (!q) return;
+  let timer: NodeJS.Timeout | undefined;
+  const late = await Promise.race([q.then(() => false), new Promise<boolean>((r) => { timer = setTimeout(() => r(true), maxMs); })]);
+  clearTimeout(timer);
+  if (late) { log(id, { type: 'error', text: `背景渲染超過 ${Math.round(maxMs / 60e3)} 分鐘，先停掉，組裝時補渲` }); for (const p of prerenderProcs.get(id) || []) p.kill(); prerenderQ.delete(id); }
+}
 function prerender(id: string, c: Chunk) {
   const d = dirOf(id), pr = (readJSON<Production>(join(d, 'build', 'production.json')) || {}).prerender as { cwd?: string; cmd?: string } | undefined;
   if (!pr?.cmd) return;
@@ -648,7 +657,10 @@ function prerender(id: string, c: Chunk) {
     log(id, { type: 'tool', name: 'prerender', detail: `${c.id} ${a.toFixed(2)}–${b.toFixed(2)} s: ${bin} ${args.join(' ')}` });
     const t0 = Date.now(), p = spawn(bin, args, { cwd: join(d, pr.cwd || 'build'), env: process.env, stdio: 'ignore' });
     const set = prerenderProcs.get(id) || new Set(); set.add(p); prerenderProcs.set(id, set);
-    const done = (ok: boolean) => { set.delete(p); log(id, { type: ok ? 'text' : 'error', text: `背景渲染 ${c.id}：${ok ? `完成（${Math.round((Date.now() - t0) / 1000)} s）` : '失敗（組裝時會重渲）'}` }); resolve(); };
+    // a render that never exits must not hold the queue (seen: one sat 7 hours after finishing its frames)
+    const timer = setTimeout(() => p.kill(), PRERENDER_MAX_MS(b - a)); timer.unref();
+    let ended = false;
+    const done = (ok: boolean) => { if (ended) return; ended = true; clearTimeout(timer); set.delete(p); log(id, { type: ok ? 'text' : 'error', text: `背景渲染 ${c.id}：${ok ? `完成（${Math.round((Date.now() - t0) / 1000)} s）` : '失敗（組裝時會重渲）'}` }); resolve(); };
     p.on('error', () => done(false)); p.on('close', (code) => done(code === 0));
   });
   prerenderQ.set(id, (prerenderQ.get(id) || Promise.resolve()).then(run));
```

---

### Incident Patch 13: `2f5b891f` (2026-10-01)
**Commit Message**: render.mjs: sweep Chrome temp profiles left by killed renders (15 GB had piled up)

**File**: `.claude/skills/anime-cel/template/render.mjs` (modified, +9/-1)
```diff
@@ -19,7 +19,7 @@
 //   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
@@ -89,6 +89,14 @@ async function takeSlot() {
     await new Promise(r => setTimeout(r, 1000));
   }
 }
+// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
+// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
+try {
+  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
+    const p = `${tmpdir()}/${d}`;
+    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
+  }
+} catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
 for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
```

**File**: `.claude/skills/crayon-storybook/template/render.mjs` (modified, +9/-1)
```diff
@@ -19,7 +19,7 @@
 //   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
@@ -89,6 +89,14 @@ async function takeSlot() {
     await new Promise(r => setTimeout(r, 1000));
   }
 }
+// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
+// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
+try {
+  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
+    const p = `${tmpdir()}/${d}`;
+    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
+  }
+} catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
 for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
```

**File**: `.claude/skills/painted-animation/template/render.mjs` (modified, +9/-1)
```diff
@@ -19,7 +19,7 @@
 //   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
@@ -89,6 +89,14 @@ async function takeSlot() {
     await new Promise(r => setTimeout(r, 1000));
   }
 }
+// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
+// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
+try {
+  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
+    const p = `${tmpdir()}/${d}`;
+    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
+  }
+} catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
 for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
```

**File**: `.claude/skills/paper-cutout/template/render.mjs` (modified, +9/-1)
```diff
@@ -19,7 +19,7 @@
 //   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
@@ -89,6 +89,14 @@ async function takeSlot() {
     await new Promise(r => setTimeout(r, 1000));
   }
 }
+// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
+// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
+try {
+  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
+    const p = `${tmpdir()}/${d}`;
+    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
+  }
+} catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
 for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
```

**File**: `.claude/skills/pixel-art/template/render.mjs` (modified, +9/-1)
```diff
@@ -19,7 +19,7 @@
 //   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
@@ -89,6 +89,14 @@ async function takeSlot() {
     await new Promise(r => setTimeout(r, 1000));
   }
 }
+// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
+// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
+try {
+  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
+    const p = `${tmpdir()}/${d}`;
+    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
+  }
+} catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
 for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
```

**File**: `.claude/skills/whiteboard/template/render.mjs` (modified, +9/-1)
```diff
@@ -19,7 +19,7 @@
 //   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
@@ -89,6 +89,14 @@ async function takeSlot() {
     await new Promise(r => setTimeout(r, 1000));
   }
 }
+// Chrome's temp profile is removed on browser.close(), but a render killed mid-way (an agent's turn ending) leaves it
+// behind: 266 of them (15 GB) had piled up on one machine. Sweep profiles untouched for 6 hours (none of those is live).
+try {
+  for (const d of readdirSync(tmpdir()).filter(n => n.startsWith('puppeteer_dev_chrome_profile-'))) {
+    const p = `${tmpdir()}/${d}`;
+    if (Date.now() - statSync(p).mtimeMs > 6 * 3600e3) rmSync(p, { recursive: true, force: true });
+  }
+} catch {}
 const slot = await takeSlot();
 process.on('exit', () => { try { unlinkSync(slot); } catch {} });
 for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
```

---

### Incident Patch 14: `2dc44f39` (2026-10-01)
**Commit Message**: Faithful characters, more variety, much less render time

Quality (from auditing the first wow-peaks run, 20261001-ouqgt):
- the user's character drawing is the spec: measured proportions, accessories on face anchors, design-vs-frame checks
  at the cast gate, shot review and final critic (Clawd drifted shot to shot and no gate compared to the drawing)
- variety rule: one set+camera <= 40% of the runtime, builds must move, a small emotional arc
- the reference is analysis/proxy.mp4 when the source is a screen recording; clip_strip.py switches automatically
  and refuses black reference rows (the peak duel had compared against black frames)
- critic lists everything in round 1, re-checks changed shots at 12 fps for new bugs, no escalation in later rounds

Speed (approval -> done was 307 min; screenshots 41% of agent time):
- render.mjs: frame cache (per-frame key = shared files + the shot's scene file), only changed shots redraw;
  machine-wide render slots (RENDER_SLOTS, default 4); --strip defaults to 12 fps
- passed segments render in the background (production.json prerender); assembly waits and reuses them
- shot reviewers reuse the builder's frames instead of re-rendering ever

**File**: `.claude/skills/anime-cel/template/render.mjs` (modified, +59/-8)
```diff
@@ -2,25 +2,28 @@
 //
 //   Look at it (open the images with your image viewer / Read tool):
 //     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
-//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        EVERY frame in a stretch (motion)
+//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
 //     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
 //     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
 //         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
 //     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
 //   Make the video:
 //     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
-//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable)
+//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
+//                                                                                              only frames of shots whose files changed are redrawn)
 //     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
 //   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
-//   --chrome=<path to Chrome/Chromium>.
+//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
+//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
-import { homedir } from 'node:os';
+import { homedir, tmpdir } from 'node:os';
 
 const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
 const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
@@ -70,6 +73,26 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
   : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
 // Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
+// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
+// A slot whose owner died (its turn was cut off) is taken back.
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
+async function takeSlot() {
+  mkdirSync(SLOT_DIR, { recursive: true });
+  for (let waited = 0; ; waited++) {
+    for (let i = 0; i < SLOTS; i++) {
+      const f = `${SLOT_DIR}/slot${i}`;
+      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+    }
+    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
+    await new Promise(r => setTimeout(r, 1000));
+  }
+}
+const slot = await takeSlot();
+process.on('exit', () => { try { unlinkSync(slot); } catch {} });
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+
 const browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
@@ -90,13 +113,30 @@
```

**File**: `.claude/skills/crayon-storybook/template/render.mjs` (modified, +59/-8)
```diff
@@ -2,25 +2,28 @@
 //
 //   Look at it (open the images with your image viewer / Read tool):
 //     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
-//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        EVERY frame in a stretch (motion)
+//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
 //     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
 //     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
 //         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
 //     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
 //   Make the video:
 //     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
-//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable)
+//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
+//                                                                                              only frames of shots whose files changed are redrawn)
 //     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
 //   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
-//   --chrome=<path to Chrome/Chromium>.
+//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
+//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
-import { homedir } from 'node:os';
+import { homedir, tmpdir } from 'node:os';
 
 const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
 const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
@@ -70,6 +73,26 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
   : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
 // Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
+// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
+// A slot whose owner died (its turn was cut off) is taken back.
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
+async function takeSlot() {
+  mkdirSync(SLOT_DIR, { recursive: true });
+  for (let waited = 0; ; waited++) {
+    for (let i = 0; i < SLOTS; i++) {
+      const f = `${SLOT_DIR}/slot${i}`;
+      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+    }
+    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
+    await new Promise(r => setTimeout(r, 1000));
+  }
+}
+const slot = await takeSlot();
+process.on('exit', () => { try { unlinkSync(slot); } catch {} });
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+
 const browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
@@ -94,13 +117,30 @@
```

**File**: `.claude/skills/painted-animation/template/render.mjs` (modified, +59/-8)
```diff
@@ -2,25 +2,28 @@
 //
 //   Look at it (open the images with your image viewer / Read tool):
 //     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
-//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        EVERY frame in a stretch (motion)
+//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
 //     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
 //     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
 //         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
 //     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
 //   Make the video:
 //     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
-//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable)
+//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
+//                                                                                              only frames of shots whose files changed are redrawn)
 //     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
 //   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
-//   --chrome=<path to Chrome/Chromium>.
+//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
+//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
-import { homedir } from 'node:os';
+import { homedir, tmpdir } from 'node:os';
 
 const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
 const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
@@ -70,6 +73,26 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
   : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
 // Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
+// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
+// A slot whose owner died (its turn was cut off) is taken back.
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
+async function takeSlot() {
+  mkdirSync(SLOT_DIR, { recursive: true });
+  for (let waited = 0; ; waited++) {
+    for (let i = 0; i < SLOTS; i++) {
+      const f = `${SLOT_DIR}/slot${i}`;
+      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+    }
+    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
+    await new Promise(r => setTimeout(r, 1000));
+  }
+}
+const slot = await takeSlot();
+process.on('exit', () => { try { unlinkSync(slot); } catch {} });
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+
 const browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
@@ -90,13 +113,30 @@
```

**File**: `.claude/skills/paper-cutout/template/render.mjs` (modified, +59/-8)
```diff
@@ -2,25 +2,28 @@
 //
 //   Look at it (open the images with your image viewer / Read tool):
 //     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
-//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        EVERY frame in a stretch (motion)
+//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
 //     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
 //     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
 //         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
 //     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
 //   Make the video:
 //     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
-//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable)
+//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
+//                                                                                              only frames of shots whose files changed are redrawn)
 //     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
 //   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
-//   --chrome=<path to Chrome/Chromium>.
+//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
+//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
-import { homedir } from 'node:os';
+import { homedir, tmpdir } from 'node:os';
 
 const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
 const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
@@ -70,6 +73,26 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
   : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
 // Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
+// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
+// A slot whose owner died (its turn was cut off) is taken back.
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
+async function takeSlot() {
+  mkdirSync(SLOT_DIR, { recursive: true });
+  for (let waited = 0; ; waited++) {
+    for (let i = 0; i < SLOTS; i++) {
+      const f = `${SLOT_DIR}/slot${i}`;
+      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+    }
+    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
+    await new Promise(r => setTimeout(r, 1000));
+  }
+}
+const slot = await takeSlot();
+process.on('exit', () => { try { unlinkSync(slot); } catch {} });
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+
 const browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
@@ -90,13 +113,30 @@
```

**File**: `.claude/skills/pixel-art/template/render.mjs` (modified, +59/-8)
```diff
@@ -2,25 +2,28 @@
 //
 //   Look at it (open the images with your image viewer / Read tool):
 //     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg        contact sheet of chosen times
-//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        EVERY frame in a stretch (motion)
+//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg        a stretch at 12 fps (motion; --every=1 for every frame)
 //     node render.mjs --sheet=2.1,2.2 --crop=760,300,400,400 --w=600 --out=out/check/face.jpg full-res crops (details)
 //     node render.mjs --strip=2.0:2.5 --crop-at=960,780,500,400 --out=out/check/feet.jpg       crops that follow a WORLD point
 //         (x,y in world px, may be page expressions like PLK.MX(1.38); w,h in screen px) through each frame's camera
 //     node render.mjs --stills=1.2,3.4 --out=out/stills                                     full-res PNGs
 //   Make the video:
 //     node render.mjs --clip [--range=0:4] --out=out/video.mp4                               straight to MP4 (one worker)
-//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable)
+//     node render.mjs --frames [--range=0:8] --workers=4                                     JPEG frames → out/frames (parallel, resumable, cached:
+//                                                                                              only frames of shots whose files changed are redrawn)
 //     node render.mjs --encode --out=out/video.mp4                                           out/frames → MP4
 //   Standalone loops (LOOPS in the page): add --loop=<name> to any of the above (times are then loop times), or
 //     node render.mjs --loop=emotions --png --out=out/loop_emotions                          one cycle as PNGs (for GIFs)
 //   Music: --audio=assets/song.mp3 (or PROJECT.audio) is muxed into --clip and --encode. Other flags: --fps=24,
-//   --chrome=<path to Chrome/Chromium>.
+//   --chrome=<path to Chrome/Chromium>, --no-cache (redraw every frame in --frames).
+//   At most RENDER_SLOTS (default 4) renders hold a Chrome at once on this machine; the rest wait their turn.
 import puppeteer from 'puppeteer-core';
 import { spawn } from 'node:child_process';
-import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
+import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
+import { createHash } from 'node:crypto';
 import { dirname, resolve } from 'node:path';
 import { pathToFileURL } from 'node:url';
-import { homedir } from 'node:os';
+import { homedir, tmpdir } from 'node:os';
 
 const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
 const CHROMES = [args.chrome, process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
@@ -70,6 +73,26 @@ const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swift
   : process.platform === 'win32' ? ['--use-angle=d3d11'] : process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-gl=angle'];
 // Ubuntu 23.10+ blocks Chrome's user-namespace sandbox; headless rendering of local files doesn't need it.
 const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
+// One machine-wide slot per render (lock files): many agents rendering at once made page loads time out and retry.
+// A slot whose owner died (its turn was cut off) is taken back.
+const SLOT_DIR = `${tmpdir()}/reelmimic_render_slots`, SLOTS = +(process.env.RENDER_SLOTS || 4);
+const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
+async function takeSlot() {
+  mkdirSync(SLOT_DIR, { recursive: true });
+  for (let waited = 0; ; waited++) {
+    for (let i = 0; i < SLOTS; i++) {
+      const f = `${SLOT_DIR}/slot${i}`;
+      try { writeFileSync(f, String(process.pid), { flag: 'wx' }); return f; } catch {}
+      try { if (!alive(+readFileSync(f, 'utf8'))) unlinkSync(f); } catch {}
+    }
+    if (waited && waited % 30 === 0) console.log(`waiting for a render slot (${SLOTS} in use machine-wide)…`);
+    await new Promise(r => setTimeout(r, 1000));
+  }
+}
+const slot = await takeSlot();
+process.on('exit', () => { try { unlinkSync(slot); } catch {} });
+for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1));
+
 const browser = await puppeteer.launch({
   executablePath: CHROME, headless: true, protocolTimeout: 0,
   args: [...sandbox, '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu, '--enable-gpu-rasterization', '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']
@@ -90,13 +113,30 @@
```

**File**: `.claude/skills/video-clone/CONTRACT.md` (modified, +2/-1)
```diff
@@ -105,7 +105,8 @@ projects/<id>/
 ## 生產線檔案（核准後）
 
 ```
-build/production.json            導演：{ cast_sheet, characters, chunks: [{id, shots}], shot_files, how_to_preview, how_to_render, shared_readonly }
+build/production.json            導演：{ cast_sheet, characters, chunks: [{id, shots}], shot_files, how_to_preview, how_to_render, shared_readonly,
+                                 prerender: { cwd, cmd 含 {start} {end} } ← 有影格快取的引擎才寫；每段通過審查後系統自動在背景渲染那段的正式影格 }
 out/check/cast/sheet_<角色>.jpg   每個角色一張設定圖（正面/3/4/側面/表情/姿勢）；sheet.jpg = 全角色並排
 build/assets/cast/<角色>.js      每個角色一個定義檔（多角色時各自由一組審查＋修正同時進行，不能共用一個檔）
 out/check/cast/review_<角色>.json / fixes_<角色>.json  個別角色的審查與修正（要改共用骨架的項目 status: shared，由導演統一改）
```

**File**: `.claude/skills/video-clone/SKILL.md` (modified, +4/-0)
```diff
@@ -87,6 +87,9 @@ plan.json 每個 shot 填 `ref_shot`（參考片鏡頭編號）、`ref_what`（
 peaks 裡的鏡頭標 `hero: true`。核准前先把每個爆點那一格做到成片品質，和參考片同一格並排成 `out/check/key_<n>_vs_ref.jpg`，
 放在 style_frames 最前面給使用者看；比參考片弱就繼續改，不要交出去。
 
+**變化**：同一場景＋同一機位不超過片長 40%，高潮之間換場景或視角；鋪陳段每 1–1.5 秒畫面要有新東西，不要一個構圖停著等爆點。
+要有情緒弧線（想要什麼 → 等待或阻礙 → 高潮時得到），不只是能量往上。
+
 給使用者看分鏡並簡短說明；使用者說過「你自己決定」就直接開做。
 
 ## 5. 製作：一關一關過，不要堆到最後才審
@@ -127,6 +130,7 @@ peaks 裡的鏡頭標 `hero: true`。核准前先把每個爆點那一格做到
 
 - **角色**：
   - **使用者自己擁有的角色可以直接用**：使用者提供自家角色／吉祥物的設計圖（放在 inputs/），就照它製作並保持造型一致，不必換成原創。
+    **設計圖就是規格**：比例、眼睛、手腳、配色照圖量（不要拿引擎內建的同名角色改），配件綁在臉的錨點上；角色關、鏡頭審查、評審都要把設計圖和畫面並排比。
   - **使用者點名要用的角色可以直接用**：自己上網找它的造型（衣服、髮型、配件、配色）照著做，不要拒絕或換成「神似原創」。
   - 使用者沒指定角色時用原創角色。
 - **歌詞**：只使用使用者提供的 LRC / 歌詞文字，不自行寫出歌詞；分鏡與回報中也不要引用歌詞內容。
```

**File**: `.claude/skills/video-clone/scripts/clip_strip.py` (modified, +13/-2)
```diff
@@ -4,7 +4,11 @@
 Stills can't show motion or a climax: a hit is the frames around it. Use this whenever you judge a moment.
 
     python clip_strip.py out/video.mp4 --range 24.0:26.0 --out out/check/peak_1.jpg
-    python clip_strip.py out/video.mp4 --range 24.0:26.0 --vs analysis/source.mp4 --vs-range 25.0:27.0 --out out/check/peak_1_vs_ref.jpg
+    python clip_strip.py out/video.mp4 --range 24.0:26.0 --vs analysis/proxy.mp4 --vs-range 25.0:27.0 --out out/check/peak_1_vs_ref.jpg
+
+The reference is the file analyze.py actually analysed (report.json "analysed": proxy.mp4 when the picture had to be
+cropped out of a screen recording). Passing analysis/source.mp4 is switched to proxy.mp4 automatically when one exists,
+and a reference row that comes out (almost) black stops with an error instead of producing a fake comparison.
 
 --fps (default 12) frames per second of the stretch; --w (default 240) width of each frame; --cols (default 12).
 With --vs, the reference range is sampled into the same number of frames and each reference row sits directly above
@@ -49,8 +53,15 @@ def main():
     ours = grab(a.video, s, e, n, a.w)
     ref = None
     if a.vs:
+        vs = a.vs
+        proxy = os.path.join(os.path.dirname(vs), "proxy.mp4")
+        if os.path.basename(vs).startswith("source.") and os.path.isfile(proxy):
+            print(f"reference: using {proxy} (the cropped picture) instead of {vs}"); vs = proxy
         rs, re_ = map(float, (a.vs_range or a.range).split(":"))
-        ref = grab(a.vs, rs, re_, len(ours), a.w)
+        ref = grab(vs, rs, re_, len(ours), a.w)
+        dark = sum(1 for _, im in ref if max(im.convert("L").getextrema()) < 30) / max(1, len(ref))
+        if dark > 0.8:
+            raise SystemExit(f"reference rows are black ({dark:.0%} of frames) — wrong file or time range? Use the file in report.json 'analysed' (usually analysis/proxy.mp4)")
     fh = ours[0][1].height; lab = 18; f = font(13)
     rows = [ours[i:i + a.cols] for i in range(0, len(ours), a.cols)]
     refrows = [ref[i:i + a.cols] for i in range(0, len(ref), a.cols)] if ref else []
```

---

### Incident Patch 15: `ed3dab5d` (2026-10-03)
**Commit Message**: fix: show a clear message when the port is already in use

When a second copy of the server starts, listen() failed with an
unhandled EADDRINUSE error and the stack trace looked like a crash.
Catch that error, say the port is taken and that PORT changes it, then
exit 1. Other listen errors are still thrown as before.

Closes #37

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `app/server/index.ts` (modified, +6/-1)
```diff
@@ -127,4 +127,9 @@ const dist = join(import.meta.dirname, '..', 'dist');
 if (existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api|files).*/, (req, res) => res.sendFile(join(dist, 'index.html'))); }
 
 J.recoverOrphans();
-app.listen(PORT, '127.0.0.1', () => console.log(`ReelMimic → http://localhost:${PORT}`));
+const server = app.listen(PORT, '127.0.0.1', () => console.log(`ReelMimic → http://localhost:${PORT}`));
+server.on('error', (err: NodeJS.ErrnoException) => {
+  if (err.code !== 'EADDRINUSE') throw err;
+  console.error(`Port ${PORT} is already in use. ReelMimic may already be open at http://localhost:${PORT}. Set PORT to use another port.`);
+  process.exit(1);
+});
```

#### Recent Merged Pull Requests:
- **PR #60** (2026-10-05): fix: pick the untitled fallback from the project language (@BrianSasaki)
- **PR #57** (2026-10-05): README: add star history chart (@edenfunf)
- **PR #55** (2026-10-04): fix: reload the project when the event stream reconnects (@HEOJUNFO)
- **PR #53** (2026-10-04): Aim for goosebumps: design and judge the climax; much less render time (@edenfunf)
- **PR #41** (2026-10-04): fix: show a clear message when the port is already in use (@bluzername)
- **PR #40** (2026-10-04): Optional: post a finished video with npm run publish (@mutonby)
- **PR #36** (2026-10-04): docs: document the secrets-file override variables (@Jerry0746)
- **PR #34** (2026-10-02): No cast sheet or cast gate for pieces with no characters (@edenfunf)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
