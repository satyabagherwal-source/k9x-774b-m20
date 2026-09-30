# Forensic Learning Record (Deep Inspection): cobusgreyling/loop-engineering

> **Canonical Artifact**: `07_PROJECT_LEARNING/cobusgreyling-loop-engineering-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:41.928Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cobusgreyling/loop-engineering`
- **Description**: Practical patterns, starters & CLI tools for loop engineering with AI coding agents. Design systems that prompt and orchestrate agents (inspired by Addy Osmani and Boris Cherny). Includes loop-audit, loop-init, loop-cost.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11385 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/append-run-log.mjs`
```
#!/usr/bin/env node
/**
 * Append one JSON run entry to loop-run-log.md and prune entries older than 30 days.
 * Usage: node scripts/append-run-log.mjs '<json-object>' [path-to-log]
 */
import { readFile, writeFile } from 'node:fs/promises';

const MARKER = '<!-- Loop appends below this line -->';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Only strings shaped like an ISO date are treated as timestamps for pruning.
// `new Date(...)` is a lenient parser: a non-ISO run_id (a numeric GitHub run
// id, a custom slug like "run-1") doesn't reliably yield NaN, it can parse
// into a spurious in-range-looking date instead (e.g. "run-1" -> 2001-01-01),
// which would then read as "older than 30 days" and get silently pruned even
// though the entry was just written. Gate the parse on this pattern first so
// non-ISO run_ids are always kept, matching loop-metrics' handling of the
// same run_id shapes.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const entryJson = process.argv[2];
const logPath = process.argv[3] || 'loop-run-log.md';

if (!entryJson) {
  console.error('Usage: node scripts/append-run-log.mjs \'<json>\' [loop-run-log.md]');
  process.exit(1);
}

let entry;
try {
  entry = JSON.parse(entryJson);
} catch {
  console.error('Usage: second argument must be a valid JSON object');
  process.exit(1);
}
const content = await readFile(logPath, 'utf8');
const markerAt = content.indexOf(MARKER);
if (markerAt === -1) {
  console.error(`Marker not found in ${logPath}`);
  process.exit(1);
}

const before = content.slice(0, markerAt + MARKER.length);
const after = content.slice(markerAt + MARKER.length);
const now = Date.now();

const kept = [];
for (const line of after.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) continue;
  try {
    const obj = JSON.parse(trimmed);
    const t = ISO_DATE_RE.test(obj.run_id) ? new Date(obj.run_id).getTime() : NaN;
    if (Number.isNaN(t) || now - t <= MAX_AGE_MS) {
      kept.push(trimmed);
    }
  } catch {
    // skip malformed lines
  }
}

kept.push(JSON.stringify(entry));
await writeFile(logPath, `${before}\n\n${kept.join('\n')}\n`);
console.log(`Appended run ${entry.run_id} (${kept.length} entries within 30d window)`);
```

### Core Architecture Module: `scripts/check-loop-init-sync.mjs`
```
#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const registry = yaml.parse(await readFile(path.join(ROOT, 'patterns/registry.yaml'), 'utf8'));
const cli = await readFile(path.join(ROOT, 'tools/loop-init/src/cli.ts'), 'utf8');

for (const p of registry.patterns) {
  if (!cli.includes(`'${p.id}'`)) {
    fail(`loop-init cli.ts missing pattern id: ${p.id}`);
  }
}

console.log(`loop-init pattern sync OK (${registry.patterns.length} patterns) ✓`);
```

### Core Architecture Module: `scripts/generate-audit-demo-gif.py`
```
#!/usr/bin/env python3
"""Render loop-audit-demo.gif — score climbing 10 → 70 → 100."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "visuals" / "loop-audit-demo.gif"
AUDIT = ROOT / "tools" / "loop-audit" / "dist" / "cli.js"
FONT_CANDIDATES = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]

BG = (5, 8, 16)
FG = (220, 228, 240)
MUTED = (130, 145, 170)
ACCENT = (62, 232, 197)
WARN = (210, 153, 34)
BAR_FILL = (62, 232, 197)
BAR_EMPTY = (30, 40, 58)
TITLE = "#0d1117"
BORDER = (30, 45, 68)

STAGES = [
    ("Stage 0 — empty project", 10, "L0", "Not loop-ready — start with a starter."),
    ("Stage 1 — after loop-init", 70, "L2", "Good foundation — triage + state in place."),
    ("Stage 2 — verifier + AGENTS.md", 100, "L2", "Strong loop — paste your badge."),
]

WIDTH, HEIGHT = 900, 520
FPS = 2


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def score_bar(score: int, width: int = 24) -> str:
    filled = max(0, min(width, round(score / 100 * width)))
    return "█" * filled + "░" * (width - filled)


def render_frame(stage_title: str, score: int, level: str, assessment: str) -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    font_sm = load_font(16)
    font_md = load_font(20)
    font_lg = load_font(28)
    font_xl = load_font(40)

    draw.rounded_rectangle((24, 24, WIDTH - 24, HEIGHT - 24), radius=12, fill=TITLE, outline=BORDER, width=2)

    # window chrome
    for i, color in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse((44 + i * 22, 44, 56 + i * 22, 56), fill=color)
    draw.text((120, 42), "terminal — loop-audit", fill=MUTED, font=font_sm)

    y = 100
    draw.text((48, y), "Loop Readiness — before/after demo", fill=MUTED, font=font_sm)
    y += 36
    draw.text((48, y), stage_title, fill=FG, font=font_md)
    y += 48

    draw.text((48, y), f"Score: {score}/100  Level: {level}", fill=FG, font=font_lg)
    y += 44
    bar = score_bar(score)
    bar_color = ACCENT if score >= 40 else WARN
    draw.text((48, y), bar, fill=bar_color, font=font_md)
    draw.text((48 + len(bar) * 12 + 16, y), f"{score}/100", fill=bar_color, font=font_md)
    y += 52

    draw.text((48, y), assessment, fill=MUTED, font=font_sm)
    y += 56

    if score >= 70:
        draw.text((48, y), "✓ Triage skill present", fill=ACCENT, font=font_sm)
        y += 28
        draw.text((48, y), "✓ State file(s): STATE.md", fill=ACCENT, font=font_sm)
        y += 28
    if score >= 100:
        draw.text((48, y), "✓ Verifier skill present", fill=ACCENT, font=font_sm)
        y += 28

    draw.text((48, HEIGHT - 88), "npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok", fill=FG, font=font_sm)
    draw.text((48, HEIGHT - 56), "npx @cobusgreyling/loop-audit . --badge", fill=ACCENT, font=font_sm)

    # big score watermark
    draw.text((WIDTH - 200, 130), str(score), fill=(20, 32, 48), font=font_xl)

    return img


def build_gif() -> None:
    frames: list[Image.Image] = []

    intro = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(intro)
    font_lg = load_font(32)
    font_md = load_font(22)
    font_sm = load_font(18)
    draw.text((48, 180), "Stop prompting.", fill=FG, font=font_lg)
    draw.text((48, 230), "Design the loop.", fill=FG, font=font_lg)
    draw.text((48, 280), "Get a score.", fill=ACCENT, font=font_lg)
    draw.text((48, 360), "loop-init → loop-audit", fill=MUTED, font=font_md)
    draw.text((48, 400), "10  →  70  →  100", fill=ACCENT, font=font_sm)
    for _ in range(3):
        frames.append(intro)

    for title, score, level, assessment in STAGES:
        frame = render_frame(title, score, level, assessment)
        hold = 5 if score == 100 else 4
        frames.extend([frame] * hold)

    cta = render_frame("Done — paste your badge", 100, "L2", "Share your Loop Ready score in README.")
    frames.extend([cta] * 4)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    duration_ms = int(1000 / FPS)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {OUT} ({len(frames)} frames, {OUT.stat().st_size // 1024} KB)")


def ensure_audit_built() -> None:
    if AUDIT.exists():
        return
    subprocess.run(["npm", "ci"], cwd=ROOT / "tools" / "loop-audit", check=True)
    subprocess.run(["npm", "run", "build"], cwd=ROOT / "tools" / "loop-audit", check=True)


if __name__ == "__main__":
    ensure_audit_built()
    build_gif()
```

### Core Architecture Module: `scripts/generate-contributors.mjs`
```
#!/usr/bin/env node
/**
 * Regenerate CONTRIBUTORS.md from GitHub API + story attributions.
 * Requires: gh auth login (read access to public repo is enough)
 *
 *   node scripts/generate-contributors.mjs
 *   node scripts/generate-contributors.mjs --check   # exit 1 if file would change
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'CONTRIBUTORS.md');
const REPO = 'cobusgreyling/loop-engineering';
const MAINTAINER = 'cobusgreyling';
const BOTS = new Set(['github-actions[bot]', 'dependabot[bot]', 'dependabot']);

const CONTRIBUTOR_QUICKSTART =
  'https://github.com/cobusgreyling/loop-engineering/discussions/123';

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', cwd: ROOT }));
}

function ghApiPaginated(route) {
  const out = execFileSync('gh', ['api', route, '--paginate'], { encoding: 'utf8', cwd: ROOT });
  const items = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) items.push(...parsed);
    else items.push(parsed);
  }
  return items;
}

function storyAttributions() {
  const storiesDir = path.join(ROOT, 'stories');
  const attributions = new Map();
  let files;
  try {
    files = readdirSync(storiesDir).filter((f) => f.endsWith('.md'));
  } catch {
    return attributions;
  }
  const re = /Contributed by \[@([^\]]+)\]/g;
  for (const file of files) {
    const text = readFileSync(path.join(storiesDir, file), 'utf8');
    for (const m of text.matchAll(re)) {
      const login = m[1];
      if (!attributions.has(login)) attributions.set(login, []);
      attributions.get(login).push(`story: \`${file}\``);
    }
  }
  return attributions;
}

async function main() {
  const check = process.argv.includes('--check');

  const apiContributors = ghApiPaginated(`repos/${REPO}/contributors`);

  const mergedPrs = ghJson([
    'pr',
    'list',
    '--repo',
    REPO,
    '--state',
    'merged',
    '--limit',
    '200',
    '--json',
    'author,title,number',
  ]);

  const highlights = new Map();
  for (const pr of mergedPrs) {
    const login = pr.author?.login;
    if (!login || login === MAINTAINER || pr.author?.is_bot) continue;
    if (!highlights.has(login)) highlights.set(login, []);
    const list = highlights.get(login);
    if (list.length < 2) list.push(`#${pr.number} ${pr.title}`);
  }

  const storyAttrs = storyAttributions();

  const people = new Map();
  for (const c of apiContributors) {
    const login = c.login;
    if (login === MAINTAINER || BOTS.has(login) || login.endsWith('[bot]')) continue;
    people.set(login, {
      login,
      contributions: c.contributions ?? 0,
      highlights: highlights.get(login) ?? [],
      stories: storyAttrs.get(login) ?? [],
    });
  }

  for (const [login, stories] of storyAttrs) {
    if (people.has(login)) {
      people.get(login).stories = stories;
      continue;
    }
    people.set(login, {
      login,
      contributions: 0,
      highlights: highlights.get(login) ?? [],
      stories,
    });
  }

  const sorted = [...people.values()].sort((a, b) => {
    const score = (p) => p.contributions + p.stories.length * 2 + p.highlights.length;
    return score(b) - score(a) || a.login.localeCompare(b.login);
  });

  const generated = new Date().toISOString().slice(0, 10);
  const lines = [
    '# Contributors',
    '',
    'Thank you to everyone who shipped docs, stories, examples, and tool fixes.',
    '',
    `*Generated ${generated} via \`node scripts/generate-contributors.mjs\` — re-run after merges.*`,
    '',
    '| Contributor | Highlights |',
    '|-------------|------------|',
  ];

  for (const p of sorted) {
    const bits = [...p.highlights, ...p.stories];
    const cell =
      bits.length > 0
        ? bits.map((b) => b.replace(/\|/g, '\\|')).join('<br>')
        : `${p.contributions} commit${p.contributions === 1 ? '' : 's'}`;
    lines.push(`| [@${p.login}](https://github.com/${p.login}) | ${cell} |`);
  }

  lines.push(
    '',
    '## Your first PR',
    '',
    'Pick a scoped ~15 min task: [Contributor quickstart](' + CONTRIBUTOR_QUICKSTART + ').',
    '',
    'Same-day review on stories, adopters, and docs — see [CONTRIBUTING.md](./CONTRIBUTING.md).',
    '',
  );

  const content = lines.join('\n');

  if (check) {
    const existing = readFileSync(OUT, 'utf8');
    if (existing !== content) {
      console.error('CONTRIBUTORS.md is out of date. Run: node scripts/generate-contributors.mjs');
      process.exit(1);
    }
    console.log('CONTRIBUTORS.md is up to date.');
    return;
  }

  writeFileSync(OUT, content);
  console.log(`Wrote ${OUT} (${sorted.length} contributors)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

### Core Architecture Module: `scripts/generate-star-history.py`
```
#!/usr/bin/env python3
"""Generate a static star-history timeline SVG from GitHub stargazers data.

Used while api.star-history.com live embeds are unavailable (GitHub restricted
stargazer API access for third-party services, Jul 2026). CI uses the
``STAR_HISTORY_TOKEN`` repo secret (fine-grained PAT with read access to this
repo). If the secret is unset, ``update-star-history.yml`` skips cleanly so
forks without a PAT do not fail daily. Locally, use ``gh auth`` / ``GH_TOKEN``.

Interactive browser UI (token in localStorage): docs/star-history.html
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = os.environ.get("STAR_HISTORY_REPO", "cobusgreyling/loop-engineering")
OUT_DIR = Path(os.environ.get("STAR_HISTORY_OUT_DIR", "assets/visuals"))


def _api_token() -> str:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    if shutil.which("gh"):
        proc = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    raise RuntimeError(
        "GH_TOKEN/GITHUB_TOKEN or gh auth required "
        "(CI: set STAR_HISTORY_TOKEN repo secret)"
    )


def fetch_star_timestamps() -> list[datetime]:
    """Paginate the stargazers REST API (gh CLI auth is unreliable in Actions)."""
    token = _api_token()
    timestamps: list[datetime] = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/{REPO}/stargazers?per_page=100&page={page}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/vnd.github.v3.star+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            raise RuntimeError(
                f"GitHub stargazers API failed (HTTP {exc.code}): {body}"
            ) from exc
        if not payload:
            break
        for item in payload:
            starred_at = item.get("starred_at")
            if starred_at:
                timestamps.append(
                    datetime.fromisoformat(starred_at.replace("Z", "+00:00"))
                )
        if len(payload) < 100:
            break
        page += 1
    timestamps.sort()
    return timestamps


def build_series(timestamps: list[datetime]) -> list[tuple[datetime, int]]:
    if not timestamps:
        created = datetime.now(timezone.utc)
        return [(created, 0)]

    series: list[tuple[datetime, int]] = []
    for i, ts in enumerate(timestamps, start=1):
        series.append((ts, i))
    return series


def svg_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_svg(series: list[tuple[datetime, int]], *, dark: bool) -> str:
    width, height = 900, 360
    margin = {"top": 36, "right": 28, "bottom": 52, "left": 64}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]

    if dark:
        bg, fg, grid, line, accent = "#0d1117", "#e6edf3", "#30363d", "#3ee8c5", "#58d5c4"
    else:
        bg, fg, grid, line, accent = "#ffffff", "#24292f", "#d0d7de", "#0969da", "#0550ae"

    start = series[0][0]
    end = series[-1][0]
    max_stars = series[-1][1]
    span = max((end - start).total_seconds(), 1.0)

    def x_pos(ts: datetime) -> float:
        return margin["left"] + ((ts - start).total_seconds() / span) * plot_w

    def y_pos(count: int) -> float:
        return margin["top"] + plot_h - (count / max(max_stars, 1)) * plot_h

    points = " ".join(
        f"{x_pos(ts):.1f},{y_pos(count):.1f}" for ts, count in series
    )
    area_points = (
        f"{margin['left']},{margin['top'] + plot_h} "
        f"{points} "
        f"{margin['left'] + plot_w},{margin['top'] + plot_h}"
    )

    # x-axis month ticks
    ticks: list[str] = []
    cursor = datetime(start.year, start.month, 1, tzinfo=timezone.utc)
    if cursor < start:
        month = cursor.month + 1
        year = cursor.year
        if month > 12:
            month, year = 1, year + 1
        cursor = datetime(year, month, 1, tzinfo=timezone.utc)

    while cursor <= end:
        if cursor >= start:
            x = x_pos(cursor)
            label = cursor.strftime("%b '%y")
            ticks.append(
                f'<line x1="{x:.1f}" y1="{margin["top"] + plot_h}" '
                f'x2="{x:.1f}" y2="{margin["top"] + plot_h + 4}" stroke="{grid}" />'
            )
            ticks.append(
                f'<text x="{x:.1f}" y="{height - 18}" text-anchor="middle" '
                f'font-size="11" fill="{fg}" font-family="ui-sans-serif, system-ui, sans-serif">'
                f"{svg_escape(label)}</text>"
            )
        month = cursor.month + 1
        year = cursor.year
        if month > 12:
            month, year = 1, year + 1
        cursor = datetime(year, month, 1, tzinfo=timezone.utc)

    y_ticks: list[str] = []
    step = max(500, (max_stars // 4 // 500 + 1) * 500) if max_stars > 1000 else max(100, (max_stars // 4 // 100 + 1) * 100)
    value = 0
    while value <= max_stars:
        y = y_pos(value)
        y_ticks.append(
            f'<line x1="{margin["left"] - 4}" y1="{y:.1f}" '
            f'x2="{margin["left"]}" y2="{y:.1f}" stroke="{grid}" />'
        )
        y_ticks.append(
            f'<text x="{margin["left"] - 8}" y="{y + 4:.1f}" text-anchor="end" '
            f'font-size="11" fill="{fg}" font-family="ui-sans-serif, system-ui, sans-serif">'
            f"{value:,}</text>"
        )
        value += step

    legend = (
        f'<text x="{margin["left"]}" y="22" font-size="13" font-weight="600" '
        f'fill="{fg}" font-family="ui-sans-serif, system-ui, sans-serif">'
        f"{svg_escape(REPO)}</text>"
        f'<text x="{margin["left"]}" y="38" font-size="11" fill="{fg}" '
        f'font-family="ui-sans-serif, system-ui, sans-serif">'
        f"{max_stars:,} stars · updated {datetime.now(timezone.utc).strftime('%Y-%m-%d')}</text>"
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Star history for {svg_escape(REPO)}">
  <rect width="100%" height="100%" fill="{bg}" rx="8"/>
  {legend}
  <line x1="{margin['left']}" y1="{margin['top'] + plot_h}" x2="{margin['left'] + plot_w}" y2="{margin['top'] + plot_h}" stroke="{grid}"/>
  <line x1="{margin['left']}" y1="{margin['top']}" x2="{margin['left']}" y2="{margin['top'] + plot_h}" stroke="{grid}"/>
  {''.join(y_ticks)}
  {''.join(ticks)}
  <polygon points="{area_points}" fill="{accent}" fill-opacity="0.12"/>
  <polyline points="{points}" fill="none" stroke="{line}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="{x_pos(end):.1f}" cy="{y_pos(max_stars):.1f}" r="4" fill="{line}"/>
</svg>
"""


def main() -> int:
    try:
        _api_token()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Fetching stargazers for {REPO}...")
    timestamps = fetch_star_timestamps()
    series = build_series(timestamps)
    print(f"Built series: {len(series)} points, peak {series[-1][1]:,} stars")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    light_path = OUT_DIR / "star-history.svg"
    dark_path = OUT_DIR / "star-history-dark.svg"
    light_path.write_text(render_svg(series, dark=F
```

### Core Architecture Module: `scripts/github-triage.mjs`
```
#!/usr/bin/env node
/**
 * Inspect live GitHub (open PRs + issues) and write STATE.md High Priority
 * from that signal — not from the Loop Ready score.
 *
 *   node scripts/github-triage.mjs --score 100 --level L3 --out-md STATE.md
 *
 * Tests pass fixture JSON via --prs-json / --issues-json (no network).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const DAY = 24 * 60 * 60 * 1000;

export function parseArgs(argv) {
  const out = {
    score: '—',
    level: '—',
    failingWorkflows: 0,
    outMd: '',
    outJson: '',
    prsJson: '',
    issuesJson: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--score') out.score = next();
    else if (a === '--level') out.level = next();
    else if (a === '--failing-workflows') out.failingWorkflows = Number(next()) || 0;
    else if (a === '--out-md') out.outMd = next();
    else if (a === '--out-json') out.outJson = next();
    else if (a === '--prs-json') out.prsJson = next();
    else if (a === '--issues-json') out.issuesJson = next();
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function labelsOf(item) {
  return (item.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
}

function commentCount(issue) {
  if (typeof issue.comments === 'number') return issue.comments;
  if (Array.isArray(issue.comments)) return issue.comments.length;
  if (typeof issue.commentsCount === 'number') return issue.commentsCount;
  return 0;
}

function ageMs(iso, now) {
  if (!iso) return 0;
  return Math.max(0, now - new Date(iso).getTime());
}

function checksOf(pr) {
  const rollup = pr.statusCheckRollup || [];
  const fail = rollup.filter((c) => c.conclusion === 'FAILURE' || c.conclusion === 'ERROR');
  const pending = rollup.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'QUEUED' || (!c.conclusion && c.status !== 'COMPLETED'),
  );
  return { total: rollup.length, fail, pending };
}

/**
 * Classify one open PR. Returns { bucket: 'high'|'watch'|'noise', line }.
 */
export function classifyPr(pr, now = Date.now()) {
  const n = `#${pr.number}`;
  const title = (pr.title || '').replace(/\s+/g, ' ').trim();
  const url = pr.url || '';
  const link = url ? `[${n}](${url})` : n;
  const mss = pr.mergeStateStatus || '';
  const { total, fail } = checksOf(pr);
  const author = pr.author?.login || pr.author?.name || 'unknown';

  if (pr.isDraft) {
    const stale = ageMs(pr.updatedAt || pr.createdAt, now) > 30 * DAY;
    return {
      bucket: stale ? 'watch' : 'noise',
      line: `- Draft ${link} ${title} (@${author}${stale ? '; idle >30d' : ''})`,
    };
  }

  if (mss === 'DIRTY' || pr.mergeable === 'CONFLICTING') {
    return { bucket: 'high', line: `- ${link} **conflicts** — ${title}` };
  }
  if (fail.length > 0) {
    const names = fail.map((c) => c.name).filter(Boolean).slice(0, 3).join(', ');
    return { bucket: 'high', line: `- ${link} **CI red** (${names || fail.length} failing) — ${title}` };
  }
  if (total === 0) {
    return {
      bucket: 'high',
      line: `- ${link} **no CI** (fork workflow likely waiting for approval) — ${title}`,
    };
  }
  if (mss === 'BLOCKED') {
    return { bucket: 'high', line: `- ${link} **blocked** (missing required checks or review) — ${title}` };
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    return { bucket: 'high', line: `- ${link} **changes requested** — ${title}` };
  }
  if (mss === 'UNSTABLE') {
    return { bucket: 'watch', line: `- ${link} merge UNSTABLE — ${title}` };
  }
  if (mss === 'CLEAN' || mss === 'HAS_HOOKS' || mss === 'BEHIND') {
    return { bucket: 'watch', line: `- ${link} CI green, waiting on review/merge — ${title}` };
  }
  return { bucket: 'watch', line: `- ${link} ${mss || 'open'} — ${title}` };
}

/**
 * Classify one open issue.
 */
export function classifyIssue(issue, now = Date.now()) {
  const n = `#${issue.number}`;
  const title = (issue.title || '').replace(/\s+/g, ' ').trim();
  const url = issue.url || '';
  const link = url ? `[${n}](${url})` : n;
  const labels = labelsOf(issue);
  const comments = commentCount(issue);
  const age = ageMs(issue.createdAt, now);
  const idle = ageMs(issue.updatedAt || issue.createdAt, now);
  const author = issue.author?.login || 'unknown';
  const isBot = Boolean(issue.author?.is_bot) || /\[bot\]$/.test(author) || author === 'app/github-actions';

  if (labels.includes('good first issue') && age > 21 * DAY) {
    return {
      bucket: 'watch',
      line: `- ${link} stale **good first issue** (${Math.floor(age / DAY)}d) — ${title}`,
    };
  }
  if (labels.includes('loop-report') || labels.includes('release-prep')) {
    return {
      bucket: idle > 21 * DAY ? 'watch' : 'noise',
      line: `- ${link} ${labels.includes('release-prep') ? 'release-prep' : 'loop-report'} — ${title}`,
    };
  }
  if (!isBot && comments === 0 && age > 7 * DAY) {
    return {
      bucket: 'high',
      line: `- ${link} **unanswered** ${Math.floor(age / DAY)}d — ${title}`,
    };
  }
  if (!isBot && idle > 14 * DAY) {
    return {
      bucket: 'watch',
      line: `- ${link} idle ${Math.floor(idle / DAY)}d — ${title}`,
    };
  }
  return { bucket: 'noise', line: `- ${link} ${title}` };
}

export function buildSections({ prs = [], issues = [] }, now = Date.now()) {
  const high = [];
  const watch = [];
  const noise = [];
  const push = (item) => {
    if (item.bucket === 'high') high.push(item.line);
    else if (item.bucket === 'watch') watch.push(item.line);
    else noise.push(item.line);
  };
  for (const pr of prs) push(classifyPr(pr, now));
  for (const issue of issues) push(classifyIssue(issue, now));
  return { high, watch, noise };
}

export function renderState({ high, watch, noise, score, level, date, failingWorkflows = 0 }) {
  const extraHigh =
    failingWorkflows > 0
      ? [
          `- **${failingWorkflows}** dogfood workflow(s) failing — investigate \`validate-patterns\` / \`audit\`.`,
        ]
      : [];
  const highLines = [...extraHigh, ...high];
  const highBody =
    highLines.length > 0
      ? highLines.join('\n')
      : '- No blocked PRs, failing checks, or unanswered issues.';
  const watchBody =
    watch.length > 0
      ? watch.join('\n')
      : '- Expand contributor failure stories (dependency sweeper, multi-loop).\n- Collect a production story for Post-Merge Cleanup.';
  const noiseBody = noise.length > 0 ? noise.slice(0, 8).join('\n') : '—';
  const scoreNote =
    Number(score) < 58
      ? `- Loop Ready **${score}** (${level}) is below the 58 floor — investigate audit gaps.`
      : `- Loop Ready **${score}** (${level}) — informational, not a reason to act.`;

  return `# Loop State — loop-engineering reference

Last run: ${date} (automated daily-triage workflow)

## High Priority (loop is acting or waiting on human)

${highBody}
${Number(score) < 58 ? `${scoreNote}\n` : ''}
## Watch List

${watchBody}
${Number(score) >= 58 ? `\n${scoreNote}` : ''}

## Recent Noise (ignored this run)

${noiseBody}

---
Run log: Updated by \`.github/workflows/daily-triage.yml\` via \`scripts/github-triage.mjs\`. See \`LOOP.md\` for cadence and gates.
`;
}

async function ghJson(args) {
  const { stdout } = await exec('gh', args, { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function loadList(pathOrEmpty, fetcher) {
  if (pathOrEmpty) {
    return JSON.parse(await readFile(pathOrEmpty, 'utf8'));
  }
  return fetcher();
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: github-triage.mjs [--score N] [--level L] [--out-md FILE] [--out-json FILE] [--prs-json FILE] [--issues-json FILE]',
    );
    return 0;
  }

  const prs = await loadList(args.prsJson, () =
```

### Core Architecture Module: `scripts/update-last-run-badge.mjs`
```
#!/usr/bin/env node
/**
 * Read STATE.md "Last run:" and write docs/last-run.json for a Shields endpoint badge.
 * Daily triage commits this file next to STATE.md.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'STATE.md');
const OUT = path.join(ROOT, 'docs', 'last-run.json');
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function parseLastRun(text) {
  const m = text.match(/Last run:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[T ][0-9:.]+(?:Z|[+-][0-9:]+)?)?)/i);
  if (!m) return null;
  const raw = m[1].includes('T') || m[1].includes(' ') ? m[1].replace(' ', 'T') : `${m[1]}T00:00:00Z`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const text = await readFile(STATE, 'utf8');
const when = parseLastRun(text);
const now = Date.now();

let message = 'unknown';
let color = '6e7681';
if (when) {
  message = when.toISOString().slice(0, 10);
  const age = now - when.getTime();
  if (age <= MAX_AGE_MS) color = '3ee8c5';
  else if (age <= 30 * 24 * 60 * 60 * 1000) color = 'd29922';
  else color = 'e5534b';
}

await mkdir(path.dirname(OUT), { recursive: true });
const payload = {
  schemaVersion: 1,
  label: 'last triage',
  message,
  color,
};
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`last-run badge → ${message} (${color})`);

```

### Core Architecture Module: `scripts/validate-registry.mjs`
```
#!/usr/bin/env node
/**
 * Validates patterns/registry.yaml against registry.schema.json
 * and ensures file/registry/starter alignment.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import Ajv from 'ajv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CADENCE_RE = /^[0-9]+[mhd](-[0-9]+[mhd])?$/;
const ID_RE = /^[a-z][a-z0-9-]*$/;
const FILE_RE = /^[A-Za-z0-9-]+\.md$/;
const VALID_TOOLS = new Set(['grok', 'claude-code', 'codex', 'openclaw', 'opencode', 'github-actions', 'cursor', 'windsurf', 'aider']);
const VALID_RISK = new Set(['low', 'medium', 'high']);
const VALID_MODES = new Set(['L1', 'L2', 'L3']);
const VALID_COST = new Set(['low', 'medium', 'high', 'very-high']);

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function validatePattern(p, index) {
  const prefix = `patterns[${index}]`;
  const required = ['id', 'name', 'file', 'goal', 'cadence', 'risk', 'tools', 'skills', 'state', 'phases', 'human_gates'];
  for (const key of required) {
    if (!(key in p)) fail(`${prefix} missing required field: ${key}`);
  }
  if (!ID_RE.test(p.id)) fail(`${prefix}.id invalid: ${p.id}`);
  if (!FILE_RE.test(p.file)) fail(`${prefix}.file invalid: ${p.file}`);
  if (!CADENCE_RE.test(p.cadence)) fail(`${prefix}.cadence invalid: ${p.cadence}`);
  if (!VALID_RISK.has(p.risk)) fail(`${prefix}.risk invalid: ${p.risk}`);
  if (!Array.isArray(p.tools) || p.tools.length === 0) fail(`${prefix}.tools must be non-empty array`);
  for (const t of p.tools) {
    if (!VALID_TOOLS.has(t)) fail(`${prefix}.tools unknown tool: ${t}`);
  }
  if (!Array.isArray(p.skills) || p.skills.length === 0) fail(`${prefix}.skills must be non-empty array`);
  if (!FILE_RE.test(p.state)) fail(`${prefix}.state invalid: ${p.state}`);
  if (!Array.isArray(p.phases) || p.phases.length < 2) fail(`${prefix}.phases must have ≥2 entries`);
  if (!Array.isArray(p.human_gates) || p.human_gates.length === 0) fail(`${prefix}.human_gates must be non-empty`);
  if (p.week_one_mode && !VALID_MODES.has(p.week_one_mode)) fail(`${prefix}.week_one_mode invalid`);
  if (p.token_cost && !VALID_COST.has(p.token_cost)) fail(`${prefix}.token_cost invalid`);
  if (!p.cost) fail(`${prefix} missing required field: cost`);
  const costKeys = ['tokens_noop', 'tokens_report', 'tokens_action', 'suggested_daily_cap', 'early_exit_required'];
  for (const key of costKeys) {
    if (!(key in p.cost)) fail(`${prefix}.cost missing field: ${key}`);
  }
  for (const key of ['tokens_noop', 'tokens_report', 'tokens_action', 'suggested_daily_cap']) {
    if (typeof p.cost[key] !== 'number' || p.cost[key] < 1000) {
      fail(`${prefix}.cost.${key} must be a positive integer`);
    }
  }
  if (typeof p.cost.early_exit_required !== 'boolean') {
    fail(`${prefix}.cost.early_exit_required must be boolean`);
  }
}

async function main() {
  const registryPath = path.join(ROOT, 'patterns', 'registry.yaml');
  const schemaPath = path.join(ROOT, 'patterns', 'registry.schema.json');
  const raw = await readFile(registryPath, 'utf8');
  const doc = yaml.parse(raw);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  delete schema.$schema;

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(doc)) {
    fail(`registry schema: ${ajv.errorsText(validate.errors)}`);
  }
  console.log('JSON Schema validation passed ✓');

  if (!doc?.patterns?.length) fail('registry.yaml must have patterns array');

  doc.patterns.forEach(validatePattern);

  const ids = new Set();
  for (const p of doc.patterns) {
    if (ids.has(p.id)) fail(`duplicate pattern id: ${p.id}`);
    ids.add(p.id);
    const mdPath = path.join(ROOT, 'patterns', p.file);
    try {
      await readFile(mdPath, 'utf8');
    } catch {
      fail(`registry entry ${p.id} references missing file: patterns/${p.file}`);
    }
    if (p.starter) {
      try {
        await stat(path.join(ROOT, p.starter));
      } catch {
        fail(`registry entry ${p.id} references missing starter: ${p.starter}`);
      }
    } else {
      fail(`registry entry ${p.id} missing starter path`);
    }
  }

  const mdFiles = (await readdir(path.join(ROOT, 'patterns')))
    .filter((f) => f.endsWith('.md') && f !== 'README.md');
  const registeredFiles = new Set(doc.patterns.map((p) => p.file.replace(/\.md$/, '')));

  for (const f of mdFiles) {
    const base = f.replace(/\.md$/, '');
    if (!registeredFiles.has(base)) fail(`pattern file not in registry: ${f}`);
  }

  console.log(`Registry valid: ${doc.patterns.length} patterns ✓`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #504** (2026-08-13): **[bug] loop-audit fails to build after readiness-core extraction (43 TS errors)**
  *Symptoms*: ## Environment - Windows 11, Node v24.14.0 - Cloned from main (commit 8114597)  ## Steps to reproduce  git clone https://github.com/cobusgreyling/loop-engineering cd loop-engineering npm ci cd tools/loop-audit npm ci && npm test   ## Observed behavior TypeScript build fails with 43 errors across 4 files:  - `src/auditor.ts` — Cannot find module '@cobusgreyling/readiness-core' - `src/autofixer.ts` — Cannot find module + 10x `Property 'signals' does not exist on type 'AuditResult'` - `src/reporter.ts` — 30x missing properties (score, level, findings, signals, etc.) - `src/cli.ts` — `Property 'score' does not exist on type 'AuditResult'`  ## Root cause (suspected) `readiness-core` was extracted in `7e1ec65` and published to npm in `0792e03`. However `tools/loop-audit/src/` has not been updated to consume the new package's exported types — `AuditResult` interface in `readiness-core` appears to have a different shape than what `loop-audit` expects.  Last `loop-audit/src/` commit predates the refactor: `5bd6c18 fix(loop-audit,loop-sandbox): correct gate.yaml auto-fix schema`  ## Additional note This also causes a cascade failure in `tools/loop` tests: - `loop audit --help pass-through` fails with `ERR_MODULE_NOT_FOUND`   for `@cobusgreyling/readiness-core` - `loop doctor --json` returns `object` instead of `number` for score  These were observed while investigating PR #502.  ## Willing to help Happy to assist with the fix if you can confirm the expected `AuditResult` shape from `re
  **Post-Mortem & Fix Analysis**:
  > I’d like to work on this issue. I’ve reproduced the build failure and would like to investigate the readiness-core / AuditResult API mismatch and update loop-audit accordingly.
  > Thanks for jumping on this @AbarnaaSree — you're welcome to take it.  **Scope:** `tools/loop-audit` build fails after the readiness-core extraction (TS type / API drift). Goal is green `npm run build` (and package tests) under `tools/loop-audit`.  Please comment when you open a PR and link it here. If you get stuck on a specific error, paste the first ~20 `tsc` lines and we'll coach.  Maintainer note: aiming for first response on contributor PRs within 48h.
  > Root cause: `@cobusgreyling/readiness-core` is a `file:../readiness-core` sibling whose `dist/` is gitignored. `cd tools/loop-audit && npm run build` failed unless readiness-core was built first.  Fix in #513: `prebuild` installs+builds readiness-core automatically. After that merges, `npm install && npm run build` in `tools/loop-audit` should work end-to-end.  @AbarnaaSree — still welcome to help with follow-ups if anything else is rough in the monorepo contrib path.

- **Issue #286** (2026-07-16): **Windows Compatibility: Build scripts fail due to unix-specific chmod command**
  *Symptoms*: **Describe the bug**: When running the full test suite (`npm run test:tools`) or trying to build the tools on a Windows machine (Command Prompt or PowerShell), the build step fails for several tools. Specifically, the `package.json` files for `loop-cost`, `loop-context`, `mcp-server`, and `loop-worktree` include a Unix-specific `chmod +x` command in their build scripts, which causes the build to abort on Windows.  **Steps to reproduce**: 1. Clone the repository on a Windows machine. 2. Run `npm install` in the root and inside the `tools/*` directories. 3. Run `npm run test:tools` or `npm run build` inside `tools/loop-cost`, `tools/loop-context`, `tools/mcp-server`, or `tools/loop-worktree`.  **Expected behavior**: The TypeScript code should compile and the build should finish successfully across all platforms. NPM handles executable permissions automatically across platforms during installation based on the `"bin"` field in `package.json`, so manual `chmod` shouldn't be strictly necessary for cross-platform compatibility.  **Actual behavior** (include output of `loop-audit --json` or command if relevant): The build fails with the following output:  ```text 'chmod' is not recognized as an internal or external command, operable program or batch file. ```  **Environment**: - OS: Windows 10/11 - Node (for audit): Latest / Any - Tool used (Grok / Claude / Codex / GH Actions): N/A (Local Setup) - Target repo (if not this one):  **Additional context (links to patterns, commits, scre

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

### Incident Patch 1: `0948ac16` (2026-09-15)
**Commit Message**: fix(loop-metrics): preserve non-date run IDs in timeframe filters (#610)

**File**: `tools/loop-metrics/dist/metrics.js` (modified, +4/-0)
```diff
@@ -32,6 +32,10 @@ export function filterEntries(entries, pattern, days) {
         const cutoffDate = new Date();
         cutoffDate.setDate(cutoffDate.getDate() - days);
         filtered = filtered.filter(e => {
+            // Match the run-log pruner: Date also accepts IDs such as "run-1"
+            // as old dates, so only ISO-shaped IDs can establish a run's age.
+            if (!/^\d{4}-\d{2}-\d{2}/.test(e.run_id))
+                return true;
             const entryDate = new Date(e.run_id);
             // An unparseable run_id (e.g. a numeric GitHub run id or a custom
             // slug) yields Invalid Date; keep the entry rather than silently
```

**File**: `tools/loop-metrics/src/metrics.ts` (modified, +3/-0)
```diff
@@ -60,6 +60,9 @@ export function filterEntries(entries: RunEntry[], pattern?: string, days?: numb
     cutoffDate.setDate(cutoffDate.getDate() - days);
     
     filtered = filtered.filter(e => {
+      // Match the run-log pruner: Date also accepts IDs such as "run-1"
+      // as old dates, so only ISO-shaped IDs can establish a run's age.
+      if (!/^\d{4}-\d{2}-\d{2}/.test(e.run_id)) return true;
       const entryDate = new Date(e.run_id);
       // An unparseable run_id (e.g. a numeric GitHub run id or a custom
       // slug) yields Invalid Date; keep the entry rather than silently
```

**File**: `tools/loop-metrics/test/metrics.test.mjs` (modified, +17/-4)
```diff
@@ -37,13 +37,26 @@ test('successRatePct stays within [0, 100] when a single run logs more than one
   assert.ok(metrics.successRatePct >= 0 && metrics.successRatePct <= 100);
 });
 
-test('filterEntries keeps entries with unparseable run_id when a timeframe is set', () => {
+test('filterEntries keeps non-ISO run IDs and filters ISO dates within a timeframe', (t) => {
+  const RealDate = Date;
+  t.mock.method(globalThis, 'Date', class extends RealDate {
+    constructor(...args) {
+      super(...(args.length ? args : ['2026-08-01T12:00:00Z']));
+    }
+  });
+
   const entries = [
     { run_id: '2026-07-30T08:50:34Z', pattern: 'daily-triage', duration_s: 5, items_found: 1, actions_taken: 2, escalations: 1, tokens_estimate: 52000, outcome: 'report-only' },
-    // Numeric GitHub run id is not a parseable date and must not be dropped.
-    { run_id: '29231015995', pattern: 'daily-triage', duration_s: 8, items_found: 1, actions_taken: 1, escalations: 0, tokens_estimate: 52000, outcome: 'report-only' },
+    ...['29231015995', 'run-1', '123', '2026', 'custom-run', '2026-99-99'].map(run_id => ({
+      run_id, pattern: 'daily-triage', duration_s: 8, items_found: 1, actions_taken: 1, escalations: 0, tokens_estimate: 52000, outcome: 'report-only'
+    })),
+    { run_id: '2026-06-01T08:50:34Z', pattern: 'daily-triage', duration_s: 5, items_found: 0, actions_taken: 0, escalations: 0, tokens_estimate: 1000, outcome: 'no-op' },
+    { run_id: 'run-2', pattern: 'ci-sweeper', duration_s: 5, items_found: 0, actions_taken: 0, escalations: 0, tokens_estimate: 1000, outcome: 'no-op' },
   ];
 
   const filtered = filterEntries(entries, 'daily-triage', 30);
-  assert.strictEqual(filtered.length, 2, 'unparseable run_id entries are kept, not dropped');
+  assert.deepStrictEqual(filtered.map(e => e.run_id), [
+    '2026-07-30T08:50:34Z', '29231015995', 'run-1', '123', '2026', 'custom-run', '2026-99-99'
+  ]);
+  assert.strictEqual(filterEntries(entries), entries, 'no filters preserve every entry');
 });
```

---

### Incident Patch 2: `d56d1e6f` (2026-08-28)
**Commit Message**: fix(ci): drop NODE_AUTH_TOKEN so npm trusted publishing can run (#563)

NPM_TOKEN still 404s. If the packages now have a GitHub Actions
trusted publisher, NODE_AUTH_TOKEN would override OIDC and keep failing.

Co-authored-by: Cobus Greyling <cobusgreyling@Cobuss-MacBook-Pro-2.local>

**File**: `.github/workflows/release-loop-audit.yml` (modified, +1/-1)
```diff
@@ -56,5 +56,5 @@ jobs:
           "
           npm publish --access public --provenance
         env:
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+          # OIDC trusted publishing — do not set NODE_AUTH_TOKEN (it overrides OIDC)
           NPM_CONFIG_PROVENANCE: "true"
\ No newline at end of file
```

**File**: `.github/workflows/release-loop-init.yml` (modified, +1/-1)
```diff
@@ -53,5 +53,5 @@ jobs:
           # package.json keeps registry range (^1.x) for the published tarball
           npm publish --access public --provenance
         env:
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+          # OIDC trusted publishing — do not set NODE_AUTH_TOKEN (it overrides OIDC)
           NPM_CONFIG_PROVENANCE: "true"
\ No newline at end of file
```

**File**: `.github/workflows/release-loop.yml` (modified, +1/-2)
```diff
@@ -51,6 +51,5 @@ jobs:
         working-directory: tools/loop
         run: npm publish --access public --provenance
         env:
-          # Trusted publisher OIDC 404'd (npm GAT). Fall back to repo NPM_TOKEN.
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+          # OIDC trusted publishing — do not set NODE_AUTH_TOKEN (it overrides OIDC)
           NPM_CONFIG_PROVENANCE: "true"
```

---

### Incident Patch 3: `ffbf710d` (2026-08-28)
**Commit Message**: fix(ci): publish loop packages with NPM_TOKEN when OIDC 404s (#562)

Tag-triggered trusted publishing signed provenance then PUT 404.
Use the repo NPM_TOKEN so loop 0.2.0 / loop-init 1.7.0 / loop-audit 1.9.0 can ship.

Co-authored-by: Cobus Greyling <cobusgreyling@Cobuss-MacBook-Pro-2.local>

**File**: `.github/workflows/release-loop-audit.yml` (modified, +1/-1)
```diff
@@ -56,5 +56,5 @@ jobs:
           "
           npm publish --access public --provenance
         env:
-          # OIDC trusted publishing — do not set NODE_AUTH_TOKEN (it overrides OIDC)
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
           NPM_CONFIG_PROVENANCE: "true"
\ No newline at end of file
```

**File**: `.github/workflows/release-loop-init.yml` (modified, +1/-1)
```diff
@@ -53,5 +53,5 @@ jobs:
           # package.json keeps registry range (^1.x) for the published tarball
           npm publish --access public --provenance
         env:
-          # OIDC trusted publishing — do not set NODE_AUTH_TOKEN (it overrides OIDC)
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
           NPM_CONFIG_PROVENANCE: "true"
\ No newline at end of file
```

**File**: `.github/workflows/release-loop.yml` (modified, +2/-1)
```diff
@@ -51,5 +51,6 @@ jobs:
         working-directory: tools/loop
         run: npm publish --access public --provenance
         env:
-          # OIDC trusted publishing — do not set NODE_AUTH_TOKEN (it overrides OIDC)
+          # Trusted publisher OIDC 404'd (npm GAT). Fall back to repo NPM_TOKEN.
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
           NPM_CONFIG_PROVENANCE: "true"
```

---

### Incident Patch 4: `558708e8` (2026-08-28)
**Commit Message**: fix(loop-init): pin loop-audit to published ^1.7.0 so Dependabot can resolve (#559)

**File**: `tools/loop-init/package.json` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@
     "access": "public"
   },
   "dependencies": {
-    "@cobusgreyling/loop-audit": "^1.8.0"
+    "@cobusgreyling/loop-audit": "^1.7.0"
   },
   "devDependencies": {
     "@types/node": "^26.0.0",
```

---

### Incident Patch 5: `47bcbd4a` (2026-08-26)
**Commit Message**: fix: unblock fork PRs, triage GitHub, document the refactor path (#556)

Fork PRs from first-time contributors never ran validate/audit, so branch
protection left docs/skills PRs BLOCKED after review. Content-only PRs now
get those required statuses from fork-pr-gate.yml (base-repo
pull_request_target — no PR-head code). CODEOWNERS no longer auto-requests
area owners. Welcome workflow includes skills/.

Daily triage writes STATE.md from open PRs and issues
(scripts/github-triage.mjs) instead of a Loop Ready 100 all-clear.

Jobs table + refactor tutorial: this repo operates agents around a
codebase; a whole-repo rewrite is not a pattern — split into PRs, L1 then
L2, goal-engineering for a scoped done-definition.

Co-authored-by: Cobus Greyling <cobusgreyling@users.noreply.github.com>

**File**: `.github/workflows/daily-triage.yml` (modified, +19/-31)
```diff
@@ -60,36 +60,22 @@ jobs:
         env:
           GH_TOKEN: ${{ github.token }}
 
-      - name: Update STATE.md
+      - name: Inspect GitHub and write STATE.md
+        id: github
+        env:
+          GH_TOKEN: ${{ github.token }}
         run: |
-          DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
-          SCORE="${{ steps.audit.outputs.score }}"
-          LEVEL="${{ steps.audit.outputs.level }}"
-          FAILING="${{ steps.workflows.outputs.failing }}"
-          cat > STATE.md <<EOF
-          # Loop State — loop-engineering reference
-
-          Last run: ${DATE} (automated daily-triage workflow)
-
-          ## High Priority (loop is acting or waiting on human)
-
-          - Maintain loop readiness score ≥ 58 (current: **${SCORE}**, level **${LEVEL}**).
-          - Keep npm packages current after tool changes (tag \`loop-audit-v*\`, \`loop-init-v*\`, \`loop-cost-v*\` — see docs/RELEASE.md).
-          $([ "$FAILING" -gt 0 ] && echo "- **${FAILING}** dogfood workflow(s) failing — investigate CI.")
-
-          ## Watch List
-
-          - Expand contributor failure stories (dependency sweeper, multi-loop).
-          - Collect a production story for Post-Merge Cleanup.
-          - Validate \`loop-init\` scaffolds on fresh projects across all patterns.
-
-          ## Recent Noise (ignored this run)
-
-          —
-
-          ---
-          Run log: Updated by \`.github/workflows/daily-triage.yml\`. See \`LOOP.md\` for cadence and gates.
-          EOF
+          mkdir -p /tmp/triage
+          node scripts/github-triage.mjs \
+            --score "${{ steps.audit.outputs.score }}" \
+            --level "${{ steps.audit.outputs.level }}" \
+            --failing-workflows "${{ steps.workflows.outputs.failing }}" \
+            --out-md STATE.md \
+            --out-json /tmp/triage/summary.json
+          HIGH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/triage/summary.json','utf8')).high)")
+          ITEMS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/triage/summary.json','utf8')).items_found)")
+          echo "high=$HIGH" >> "$GITHUB_OUTPUT"
+          echo "items=$ITEMS" >> "$GITHUB_OUTPUT"
 
       - name: Append loop-run-log.md
         id: runlog
@@ -103,6 +89,8 @@ jobs:
           ")
           FAILING="${{ steps.workflows.outputs.failing }}"
           SCORE="${{ steps.audit.outputs.score }}"
+          ITEMS="${{ steps.github.outputs.items }}"
+          HIGH="${{ steps.github.outputs.high }}"
           if [ "$FAILING" -gt 0 ]; then
             OUTCOME="escalated"
           else
@@ -113,9 +101,9 @@ jobs:
               run_id: '${END}',
               pattern: 'daily-triage',
               duration_s: Number('${DURATION}'),
-              items_found: Number('${FAILING}') + 1,
+              items_found: Number('${ITEMS}' || 0) + Number('${FAILING}'),
               actions_taken: 1,
-              escalations: Number('${FAILING}'),
+              escalations: Number('${FAILING}') + Number('${HIGH}' || 0),
               tokens_estimate: 52000,
               readiness_score: Number('${SCORE}'),
               outcome: '${OUTCOME}',
```

**File**: `.github/workflows/fork-pr-gate.yml` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+name: Fork PR gate
+
+# Runs in the *base* repo, so first-time-contributor fork PRs still get a
+# required-check outcome without anyone clicking "Approve and run workflows".
+# NEVER checkout or execute PR-head code here — list files via the API only.
+on:
+  pull_request_target:
+    types: [opened, synchronize, reopened]
+  workflow_dispatch:
+    inputs:
+      pr_number:
+        description: Open PR number to re-evaluate (content-only stub vs comment)
+        required: true
+        type: string
+
+permissions:
+  contents: read
+  statuses: write
+  pull-requests: write
+
+jobs:
+  gate:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/github-script@v9
+        with:
+          script: |
+            const owner = context.repo.owner;
+            const repo = context.repo.repo;
+            const marker = '— loop-engineering fork-pr-gate';
+
+            const prNumber = context.eventName === 'workflow_dispatch'
+              ? Number(process.env.PR_NUMBER)
+              : context.payload.pull_request.number;
+
+            if (!Number.isFinite(prNumber) || prNumber < 1) {
+              core.setFailed('Missing PR number');
+              return;
+            }
+
+            const { data: pr } = await github.rest.pulls.get({
+              owner, repo, pull_number: prNumber,
+            });
+
+            const files = await github.paginate(github.rest.pulls.listFiles, {
+              owner, repo, pull_number: prNumber, per_page: 100,
+            });
+            const paths = files.map((f) => f.filename);
+
+            const isContentPath = (p) => {
+              if (
+                p.startsWith('docs/') ||
+                p.startsWith('examples/') ||
+                p.startsWith('stories/') ||
+                p.startsWith('skills/') ||
+                p.startsWith('assets/')
+              ) {
+                return true;
+              }
+              // Root markdown / license only — not CODEOWNERS, gate.yaml, patterns, tools.
+              if (!p.includes('/')) {
+                return (
+                  p.endsWith('.md') ||
+                  p === 'LICENSE' ||
+                  p === 'CODE_OF_CONDUCT.md'
+                );
+              }
+              return false;
+            };
+
+            const allContent = paths.length > 0 && paths.every(isContentPath);
+            const sha = pr.head.sha;
+            const targetUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
+
+            core.info(`PR #${prNumber} sha=${sha} files=${paths.length} content-only=${allContent}`);
+            core.info(paths.join('\n'));
+
+            if (allContent) {
+              for (const check of ['validate', 'audit']) {
+                await github.rest.repos.createCommitStatus({
+                  owner,
+                  repo,
+                  sha,
+                  state: 'success',
+                  context: check,
+                  description: 'Content-only PR — required checks via fork-pr-gate (base repo)',
+                  target_url: targetUrl,
+                });
+              }
+              core.info('Posted success statuses for validate + audit');
+              return;
+            }
+
+            // Code / patterns / tools / CI: do not fake required checks.
+            // Leave a one-shot comment so the maintainer knows to approve workflows.
+            const comments = await github.paginate(github.rest.issues.listComments, {
+              owner, repo, issue_number: prNumber, per_page: 100,
+            });
+            if (comments.some((c) => c.body?.includes(marker))) {
+              core.info('Fork-pr-gate comment already present; skipping.');
+              return;
+            }
+            await github.rest.issues.createComment({
+              owner,
+              repo,
+              issue_number: prNumber,
+              body: [
+                'This PR changes paths that must run the real `valida
```

**File**: `.github/workflows/welcome-contributors.yml` (modified, +4/-0)
```diff
@@ -10,6 +10,7 @@ on:
       - 'docs/adopters.md'
       - 'examples/**'
       - 'docs/**'
+      - 'skills/**'
 
 permissions:
   contents: read
@@ -53,13 +54,16 @@ jobs:
             const isAdopter = paths.some((p) => p === 'docs/adopters.md');
             const isExample = paths.some((p) => p.startsWith('examples/')) ||
               pr.title.toLowerCase().includes('example');
+            const isSkill = paths.some((p) => p.startsWith('skills/')) ||
+              pr.title.toLowerCase().includes('skill');
             const isDocs = paths.some((p) => p.startsWith('docs/')) ||
               pr.title.toLowerCase().includes('docs:');
 
             let kind = 'a contribution';
             if (isStory) kind = 'a production story';
             else if (isAdopter) kind = 'an adopter listing';
             else if (isExample) kind = 'a tool example';
+            else if (isSkill) kind = 'a skill improvement';
             else if (isDocs) kind = 'a docs improvement';
 
             const body = [
```

**File**: `CODEOWNERS` (modified, +8/-5)
```diff
@@ -7,8 +7,11 @@
 /.github/ @cobusgreyling
 /starters/ @cobusgreyling
 
-# Docs / examples / stories — co-triaged by community area owner
-# (AIMindCrafter: multi-PR docs/examples track; write access for CODEOWNERS reviews)
-/docs/ @cobusgreyling @AIMindCrafter
-/examples/ @cobusgreyling @AIMindCrafter
-/stories/ @cobusgreyling @AIMindCrafter
+# Docs / examples / stories / skills — maintainer owns merge.
+# Area owners (see docs/area-owners.md) triage and review by assignment;
+# they are not listed here because CODEOWNERS auto-requests block fork PRs
+# even when the branch ruleset does not require a code-owner review.
+/docs/ @cobusgreyling
+/examples/ @cobusgreyling
+/stories/ @cobusgreyling
+/skills/ @cobusgreyling
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ npm run check:loop-init
 
 ## Area owners
 
-See [docs/area-owners.md](./docs/area-owners.md). Docs/examples/stories PRs are co-reviewed by [@AIMindCrafter](https://github.com/AIMindCrafter) (CODEOWNERS).
+See [docs/area-owners.md](./docs/area-owners.md). Docs/examples/stories/skills PRs are triaged by [@AIMindCrafter](https://github.com/AIMindCrafter) **by assignment** (not CODEOWNERS — auto-requests were blocking fork PRs). Content-only fork PRs get required `validate`/`audit` statuses from `.github/workflows/fork-pr-gate.yml`.
 
 ## Pull Request Checklist
 
```

---

### Incident Patch 6: `b37ca9ea` (2026-08-26)
**Commit Message**: fix(loop-metrics): stop successRatePct from going negative on multi-escalation runs (#537)

successRatePct was computed as ((totalRuns - totalEscalations) /
totalRuns) * 100. totalEscalations is a sum of each run's escalation
*count* (a run can log more than one -- e.g. several items escalated
in a single triage pass; this repo's own loop-run-log.md has real
entries with escalations: 4 and escalations: 5), not a count of
runs-that-escalated. Subtracting an event count from a run count
conflates the two: any window where totalEscalations exceeds
totalRuns (trivially reachable with real data, e.g. two runs where
one logs escalations: 5) produces a negative percentage, which the
CLI dashboard prints and color-codes as-is with no clamping.

Success rate should mean "what fraction of runs didn't escalate at
all." Count runs with escalations === 0 instead of subtracting the
raw event sum, so the result stays correctly bounded to [0, 100]
regardless of how many escalations any single run logged.
totalEscalations itself is unchanged (still a raw sum) since roiScore
correctly treats each individual escalation event as a cost.

Test plan: added a regression test with one run logging
escalati

**File**: `tools/loop-metrics/dist/metrics.js` (modified, +12/-1)
```diff
@@ -48,14 +48,25 @@ export function aggregateMetrics(entries) {
     let totalDurationS = 0;
     let totalActionsTaken = 0;
     let totalEscalations = 0;
+    let runsWithoutEscalation = 0;
     for (const entry of entries) {
         totalTokens += entry.tokens_estimate || 0;
         totalDurationS += entry.duration_s || 0;
         totalActionsTaken += entry.actions_taken || 0;
         totalEscalations += entry.escalations || 0;
+        if (!entry.escalations)
+            runsWithoutEscalation++;
     }
     const totalRuns = entries.length;
-    const successRatePct = totalRuns > 0 ? ((totalRuns - totalEscalations) / totalRuns) * 100 : 0;
+    // totalEscalations is a sum of each run's escalation *count* (a run can
+    // log more than one, e.g. several items escalated in one triage pass) --
+    // subtracting it from totalRuns (a count of runs) conflates events with
+    // runs and can go negative for a real, ordinary run log (this repo's own
+    // loop-run-log.md has entries with escalations: 4 and escalations: 5).
+    // Success rate is "what fraction of runs didn't escalate at all", which
+    // stays correctly bounded to [0, 100] regardless of how many escalations
+    // any single run logged.
+    const successRatePct = totalRuns > 0 ? (runsWithoutEscalation / totalRuns) * 100 : 0;
     const avgDurationS = totalRuns > 0 ? totalDurationS / totalRuns : 0;
     // Simple heuristic: Each successful action is worth +10, each escalation is -5.
     const roiScore = (totalActionsTaken * 10) - (totalEscalations * 5);
```

**File**: `tools/loop-metrics/src/metrics.ts` (modified, +11/-1)
```diff
@@ -77,16 +77,26 @@ export function aggregateMetrics(entries: RunEntry[]): MetricsDashboard {
   let totalDurationS = 0;
   let totalActionsTaken = 0;
   let totalEscalations = 0;
+  let runsWithoutEscalation = 0;
 
   for (const entry of entries) {
     totalTokens += entry.tokens_estimate || 0;
     totalDurationS += entry.duration_s || 0;
     totalActionsTaken += entry.actions_taken || 0;
     totalEscalations += entry.escalations || 0;
+    if (!entry.escalations) runsWithoutEscalation++;
   }
 
   const totalRuns = entries.length;
-  const successRatePct = totalRuns > 0 ? ((totalRuns - totalEscalations) / totalRuns) * 100 : 0;
+  // totalEscalations is a sum of each run's escalation *count* (a run can
+  // log more than one, e.g. several items escalated in one triage pass) --
+  // subtracting it from totalRuns (a count of runs) conflates events with
+  // runs and can go negative for a real, ordinary run log (this repo's own
+  // loop-run-log.md has entries with escalations: 4 and escalations: 5).
+  // Success rate is "what fraction of runs didn't escalate at all", which
+  // stays correctly bounded to [0, 100] regardless of how many escalations
+  // any single run logged.
+  const successRatePct = totalRuns > 0 ? (runsWithoutEscalation / totalRuns) * 100 : 0;
   const avgDurationS = totalRuns > 0 ? totalDurationS / totalRuns : 0;
 
   // Simple heuristic: Each successful action is worth +10, each escalation is -5.
```

**File**: `tools/loop-metrics/test/metrics.test.mjs` (modified, +18/-0)
```diff
@@ -17,6 +17,24 @@ test('loop-metrics filters and aggregates', () => {
   assert.strictEqual(metrics.totalActionsTaken, 3);
   assert.strictEqual(metrics.totalEscalations, 1);
   assert.strictEqual(metrics.roiScore, (3 * 10) - (1 * 5)); // 25
+  assert.strictEqual(metrics.successRatePct, 50); // 1 of 2 runs had no escalation
+});
+
+test('successRatePct stays within [0, 100] when a single run logs more than one escalation', () => {
+  // A run can escalate several items in one pass (this repo's own
+  // loop-run-log.md has real entries with escalations: 4 and 5), so
+  // totalEscalations (a sum of per-run counts) can exceed totalRuns.
+  // successRatePct must still reflect "runs that didn't escalate", not go
+  // negative from subtracting an event count as if it were a run count.
+  const entries = [
+    { run_id: 'a', pattern: 'ci-sweeper', duration_s: 1, items_found: 5, actions_taken: 1, escalations: 5, tokens_estimate: 1000, outcome: 'escalated' },
+    { run_id: 'b', pattern: 'ci-sweeper', duration_s: 1, items_found: 0, actions_taken: 0, escalations: 0, tokens_estimate: 1000, outcome: 'report-only' },
+  ];
+
+  const metrics = aggregateMetrics(entries);
+  assert.strictEqual(metrics.totalEscalations, 5);
+  assert.strictEqual(metrics.successRatePct, 50); // 1 of 2 runs had no escalation
+  assert.ok(metrics.successRatePct >= 0 && metrics.successRatePct <= 100);
 });
 
 test('filterEntries keeps entries with unparseable run_id when a timeframe is set', () => {
```

---

### Incident Patch 7: `c693f3e2` (2026-08-26)
**Commit Message**: fix(safety): anchor gate.yaml denylist patterns so nested sensitive paths are actually caught (#536)

Every shipped denylist -- the repo's own gate.yaml, docs/safety.md's
prose (the source loop-gate is documented as mirroring), the
templates/gate.yaml.template a new project copies, and the gate.yaml
generated by both loop-audit --fix and loop-sync --auto-fix -- listed
bare, unanchored patterns for the plain-filename and directory-style
entries: ".env", ".env.*", ".terraform/**", "k8s/production/**",
"auth/**", "payments/**", "billing/**".

tools/loop-gate matches with plain `minimatch(path, glob, { dot: true
})`, no matchBase. A bare pattern like ".env" only matches a path
*exactly equal to* ".env" -- it does not match ".env" nested in any
subdirectory. Verified directly against minimatch:

  minimatch('services/api/.env', '.env', {dot:true})              -> false
  minimatch('services/auth/x.ts', 'auth/**', {dot:true})          -> false
  minimatch('apps/k8s/production/deploy.yaml', 'k8s/production/**', {dot:true}) -> false

Concrete failure: `loop-gate check --action commit --paths
services/api/.env` -- a completely ordinary monorepo layout -- comes
back "Within policy — cleared 

**File**: `docs/safety.md` (modified, +7/-7)
```diff
@@ -7,18 +7,18 @@ Loops amplify judgment — good and bad. These guardrails are minimum bar for pr
 The loop must **never** auto-edit these without human approval:
 
 ```
-.env
-.env.*
+**/.env
+**/.env.*
 **/secrets/**
 **/credentials/**
 **/*_key*
 **/*_secret*
-.terraform/**
-k8s/production/**
+**/.terraform/**
+**/k8s/production/**
 **/migrations/**          # unless explicit migration loop
-auth/**
-payments/**
-billing/**
+**/auth/**
+**/payments/**
+**/billing/**
 ```
 
 Encode in `minimal-fix` and implementer skills:
```

**File**: `gate.yaml` (modified, +7/-7)
```diff
@@ -4,18 +4,18 @@
 version: 1
 
 denylist:
-  - ".env"
-  - ".env.*"
+  - "**/.env"
+  - "**/.env.*"
   - "**/secrets/**"
   - "**/credentials/**"
   - "**/*_key*"
   - "**/*_secret*"
-  - ".terraform/**"
-  - "k8s/production/**"
+  - "**/.terraform/**"
+  - "**/k8s/production/**"
   - "**/migrations/**"
-  - "auth/**"
-  - "payments/**"
-  - "billing/**"
+  - "**/auth/**"
+  - "**/payments/**"
+  - "**/billing/**"
 
 maxFiles: 10
 
```

**File**: `templates/gate.yaml.template` (modified, +7/-7)
```diff
@@ -5,18 +5,18 @@
 version: 1
 
 denylist:
-  - ".env"
-  - ".env.*"
+  - "**/.env"
+  - "**/.env.*"
   - "**/secrets/**"
   - "**/credentials/**"
   - "**/*_key*"
   - "**/*_secret*"
-  - ".terraform/**"
-  - "k8s/production/**"
+  - "**/.terraform/**"
+  - "**/k8s/production/**"
   - "**/migrations/**"
-  - "auth/**"
-  - "payments/**"
-  - "billing/**"
+  - "**/auth/**"
+  - "**/payments/**"
+  - "**/billing/**"
 
 # Escalate instead of auto-merging when a change touches more than this many files.
 maxFiles: 10
```

**File**: `tools/loop-audit/dist/autofixer.js` (modified, +2/-2)
```diff
@@ -152,8 +152,8 @@ const GATE_YAML_TEMPLATE = `# Machine-readable twin of docs/safety.md, enforced
 version: 1
 
 denylist:
-  - ".env"
-  - ".env.*"
+  - "**/.env"
+  - "**/.env.*"
   - "**/secrets/**"
   - "**/credentials/**"
   - "**/*_key*"
```

**File**: `tools/loop-audit/src/autofixer.ts` (modified, +2/-2)
```diff
@@ -161,8 +161,8 @@ const GATE_YAML_TEMPLATE = `# Machine-readable twin of docs/safety.md, enforced
 version: 1
 
 denylist:
-  - ".env"
-  - ".env.*"
+  - "**/.env"
+  - "**/.env.*"
   - "**/secrets/**"
   - "**/credentials/**"
   - "**/*_key*"
```

---

### Incident Patch 8: `aec3e880` (2026-08-26)
**Commit Message**: fix(mcp-server): stop mislabeling every estimateCost failure as an invalid cadence (#533)

The loop_estimate_cost tool's catch-all around estimateCost() always
reported "Invalid cadence: <value>" regardless of what actually threw.
estimateCost() can fail for reasons that have nothing to do with
cadence -- e.g. a registry.yaml pattern entry with a missing or
malformed `cost` block throws a TypeError reading its fields. Anyone
debugging a broken registry entry got pointed at the wrong cause
entirely.

Surface the real thrown message instead of guessing.

Test plan: two new tests -- one confirms a genuinely bad cadence
override still reports loop-cost's own "Invalid cadence" message
(not a hardcoded guess), the other adds a pattern missing its `cost`
block and asserts the resulting error does not claim the cadence is
invalid. Confirmed the second one fails with the old catch-all
("Invalid cadence: 1d" for a perfectly valid cadence) and passes with
the fix. Full clean rebuild + npm test: 28/28 passing.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>

**File**: `tools/mcp-server/dist/index.js` (modified, +9/-2)
```diff
@@ -284,8 +284,15 @@ server.tool('loop_estimate_cost', 'Estimate daily token cost for a pattern at a
     try {
         result = estimateCost({ pattern, level, cadence });
     }
-    catch {
-        return { content: [{ type: 'text', text: `Invalid cadence: ${cadence ?? pattern.cadence}` }] };
+    catch (err) {
+        // estimateCost() can fail for reasons that have nothing to do with
+        // cadence -- e.g. a registry.yaml entry with a missing/malformed
+        // `cost` block throws a TypeError reading its fields. Hardcoding
+        // "Invalid cadence" here regardless of the actual failure misled
+        // whoever was debugging a broken registry entry. Surface the real
+        // message instead.
+        const message = err instanceof Error ? err.message : String(err);
+        return { content: [{ type: 'text', text: `Cost estimate failed: ${message}` }] };
     }
     const fmt = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);
     const { scenarios, suggestedDailyCap } = result;
```

**File**: `tools/mcp-server/src/index.ts` (modified, +9/-2)
```diff
@@ -402,8 +402,15 @@ server.tool(
     let result;
     try {
       result = estimateCost({ pattern, level, cadence });
-    } catch {
-      return { content: [{ type: 'text' as const, text: `Invalid cadence: ${cadence ?? pattern.cadence}` }] };
+    } catch (err) {
+      // estimateCost() can fail for reasons that have nothing to do with
+      // cadence -- e.g. a registry.yaml entry with a missing/malformed
+      // `cost` block throws a TypeError reading its fields. Hardcoding
+      // "Invalid cadence" here regardless of the actual failure misled
+      // whoever was debugging a broken registry entry. Surface the real
+      // message instead.
+      const message = err instanceof Error ? err.message : String(err);
+      return { content: [{ type: 'text' as const, text: `Cost estimate failed: ${message}` }] };
     }
 
     const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);
```

**File**: `tools/mcp-server/test/server.test.mjs` (modified, +53/-0)
```diff
@@ -460,6 +460,59 @@ test('loop_estimate_cost accounts for early_exit_required instead of a flat mix'
   }
 });
 
+test('loop_estimate_cost surfaces the real error for a bad cadence override', async () => {
+  const root = await setup();
+  try {
+    const res = await callServer(root, [{
+      id: 1, method: 'tools/call',
+      params: { name: 'loop_estimate_cost', arguments: { patternId: 'daily-triage', level: 'L2', cadence: 'not-a-cadence' } },
+    }]);
+    const text = res.get(1).result.content[0].text;
+    // Propagates loop-cost's own message (e.g. "Invalid cadence interval:
+    // not") instead of a hardcoded guess.
+    assert.match(text, /Invalid cadence/i);
+  } finally {
+    await cleanup();
+  }
+});
+
+test('loop_estimate_cost does not mislabel a broken registry entry as an invalid cadence', async () => {
+  // A pattern missing its `cost` block throws a TypeError inside
+  // estimateCost() that has nothing to do with cadence -- the catch-all
+  // used to always report "Invalid cadence" regardless of the real cause.
+  const brokenRoot = await mkdtemp(path.join(tmpdir(), 'mcp-test-broken-registry-'));
+  try {
+    await mkdir(path.join(brokenRoot, 'patterns'), { recursive: true });
+    await writeFile(
+      path.join(brokenRoot, 'patterns', 'registry.yaml'),
+      `patterns:
+  - id: no-cost-block
+    name: No Cost Block
+    file: no-cost-block.md
+    goal: Missing its cost block
+    cadence: 1d
+    risk: low
+    tools: [grok]
+    skills: []
+    state: STATE.md
+    phases: [report]
+    human_gates: []
+    starter: starters/minimal-loop
+    week_one_mode: L1
+    token_cost: low
+`,
+    );
+    const res = await callServer(brokenRoot, [{
+      id: 1, method: 'tools/call',
+      params: { name: 'loop_estimate_cost', arguments: { patternId: 'no-cost-block', level: 'L2' } },
+    }]);
+    const text = res.get(1).result.content[0].text;
+    assert.ok(!text.includes('Invalid cadence'), `should not blame cadence for a missing cost block: ${text}`);
+  } finally {
+    await rm(brokenRoot, { recursive: true, force: true });
+  }
+});
+
 test('pattern resource is readable over stdio', async () => {
   const root = await setup();
   try {
```

#### Recent Merged Pull Requests:
- **PR #650** (2026-09-30): chore(loop): daily triage STATE.md 2026-09-30 (@github-actions[bot])
- **PR #649** (2026-09-30): chore: update star-history chart 2026-09-30 (@github-actions[bot])
- **PR #646** (2026-09-29): chore(loop): daily triage STATE.md 2026-09-29 (@github-actions[bot])
- **PR #644** (2026-09-29): chore: update star-history chart 2026-09-29 (@github-actions[bot])
- **PR #640** (2026-09-28): chore(loop): daily triage STATE.md 2026-09-28 (@github-actions[bot])
- **PR #639** (2026-09-28): chore: update star-history chart 2026-09-28 (@github-actions[bot])
- **PR #638** (2026-09-27): chore: update star-history chart 2026-09-27 (@github-actions[bot])
- **PR #637** (2026-09-26): chore: update star-history chart 2026-09-26 (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
