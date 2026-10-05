# Forensic Learning Record (Deep Inspection): momenbasel/PureMac

> **Canonical Artifact**: `07_PROJECT_LEARNING/momenbasel-puremac-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/momenbasel/PureMac](https://github.com/momenbasel/PureMac))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:27:30.403Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `momenbasel/PureMac`
- **Description**: Free, open-source macOS cleaner. CleanMyMac alternative with zero telemetry. Native SwiftUI, scheduled auto-cleaning, Xcode/Homebrew/system cache cleanup. MIT licensed.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6845 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/star-history.mjs`
```
#!/usr/bin/env node
// Renders assets/star-history.svg and assets/star-history-dark.svg from this
// repo's own stargazer timestamps.
//
// star-history.com started serving a "GitHub restricted access to star data"
// placeholder for everyone, so the chart is generated here instead: the
// stargazers API still returns starred_at when called with an authenticated
// token, which every Actions run already has.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN || process.env.TOKEN;
const MAX_POINTS = 220;

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

if (!REPO) {
  console.error('GITHUB_REPOSITORY is required (owner/name)');
  process.exit(1);
}
if (!TOKEN) {
  console.error('GITHUB_TOKEN (or TOKEN) is required');
  process.exit(1);
}

const THEMES = {
  light: {
    file: 'star-history.svg',
    bg: '#ffffff',
    border: '#d1d9e0',
    grid: '#e6eaef',
    text: '#1f2328',
    muted: '#59636e',
    accent: '#1f883d',
    fillTop: 0.22,
  },
  dark: {
    file: 'star-history-dark.svg',
    bg: '#0d1117',
    border: '#30363d',
    grid: '#21262d',
    text: '#e6edf3',
    muted: '#8b949e',
    accent: '#3fb950',
    fillTop: 0.3,
  },
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const stars = await fetchStargazers();
if (stars.length === 0) {
  console.error('no stargazers returned');
  process.exit(1);
}

// Cumulative count over time, then downsample to keep the SVG small.
const series = stars.map((iso, i) => ({ t: Date.parse(iso), v: i + 1 }));
const points = downsample(series, MAX_POINTS);

const W = 760;
const H = 420;
const PLOT = { x: 62, y: 58, w: W - 62 - 24, h: H - 58 - 52 };

const t0 = points[0].t;
const t1 = points[points.length - 1].t;
const span = Math.max(t1 - t0, 1);
const ceiling = niceCeiling(series[series.length - 1].v);

const px = (t) => PLOT.x + ((t - t0) / span) * PLOT.w;
const py = (v) => PLOT.y + PLOT.h - (v / ceiling) * PLOT.h;

const path = points
  .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(px(p.t))} ${round(py(p.v))}`)
  .join(' ');
const area = `${path} L${round(PLOT.x + PLOT.w)} ${PLOT.y + PLOT.h} L${PLOT.x} ${PLOT.y + PLOT.h} Z`;

mkdirSync(ASSETS, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  writeFileSync(resolve(ASSETS, theme.file), render(theme));
  console.log(`wrote assets/${theme.file} (${name})`);
}
console.log(`${series[series.length - 1].v} stars, ${points.length} plotted points`);

function render(c) {
  const yTicks = ticks(ceiling, 4)
    .map((v) => {
      const y = round(py(v));
      return `  <line x1="${PLOT.x}" y1="${y}" x2="${PLOT.x + PLOT.w}" y2="${y}" stroke="${c.grid}" stroke-width="1"/>
  <text x="${PLOT.x - 10}" y="${y + 4}" fill="${c.muted}" font-family="${FONT}" font-size="11" text-anchor="end">${compact(v)}</text>`;
    })
    .join('\n');

  const xTicks = monthTicks(t0, t1)
    .map(({ t, label }, i, arr) => {
      const anchor = i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle';
      return `  <text x="${round(px(t))}" y="${PLOT.y + PLOT.h + 22}" fill="${c.muted}" font-family="${FONT}" font-size="11" text-anchor="${anchor}">${label}</text>`;
    })
    .join('\n');

  const last = points[points.length - 1];
  const gid = `fill-${c.file.replace(/[^a-z]/g, '')}`;

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="${c.fillTop}"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="${c.bg}" stroke="${c.border}" stroke-width="1"/>

  <text x="24" y="32" fill="${c.text}" font-family="${FONT}" font-size="15" font-weight="600">${escapeXml(REPO)}</text>
  <text x="${W - 24}" y="32" fill="${c.muted}" font-family="${FONT}" font-size="12" text-anchor="end">${compact(last.v)} stars</text>

${yTicks}

  <path d="${area}" fill="url(#${gid})"/>
  <path d="${path}" stroke="${c.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
  <circle cx="${round(px(last.t))}" cy="${round(py(last.v))}" r="3.5" fill="${c.accent}"/>

${xTicks}

  <text x="24" y="${H - 14}" fill="${c.muted}" font-family="${FONT}" font-size="10">star history // generated ${new Date().toISOString().slice(0, 10)}</text>
</svg>
`;
}

async function fetchStargazers() {
  const all = [];
  for (let page = 1; page <= 400; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/stargazers?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github.star+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'star-history-generator',
        },
      },
    );
    if (!res.ok) {
      console.error(`stargazers page ${page} returned ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    const batch = await res.json();
    if (batch.length === 0) break;
    for (const s of batch) if (s.starred_at) all.push(s.starred_at);
    if (batch.length < 100) break;
  }
  return all.sort();
}

function downsample(arr, max) {
  if (arr.length <= max) return arr;
  const step = (arr.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
  out[out.length - 1] = arr[arr.length - 1];
  return out;
}

function niceCeiling(n) {
  // Leave a little headroom above the latest count without stranding the
  // series in the bottom half of the plot.
  const target = n * 1.06;
  if (target <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const c = m * mag;
    if (c >= target) return c;
  }
  return 10 * mag;
}

function ticks(ceiling, count) {
  return Array.from({ length: count + 1 }, (_, i) => Math.round((ceiling * i) / count));
}

function pretty(n) {
  return n;
}

function monthTicks(from, to) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const out = [];
  const d = new Date(from);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getTime() <= to) {
    if (d.getTime() >= from) {
      out.push({ t: d.getTime(), label: `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
    }
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  // Keep the axis readable on long histories.
  const maxLabels = 7;
  if (out.length > maxLabels) {
    const step = Math.ceil(out.length / maxLabels);
    return out.filter((_, i) => i % step === 0 || i === out.length - 1);
  }
  if (out.length === 0) out.push({ t: from, label: fmt(from) });
  // The first whole month may fall before the first star; label the actual
  // series start so the left edge is not blank.
  if (out[0].t - from > (to - from) * 0.04) out.unshift({ t: from, label: fmt(from) });
  return out;

  function fmt(t) {
    const x = new Date(t);
    return `${months[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
  }
}

function compact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #144** (2026-08-10): **[Bug] PureMac corrupts applications on default settings, reinstalls needed**
  *Symptoms*: After a cleanup, several apps stop working and require to be reinstalled.  In my case and single run: - Cursor - GitKraken - Jetbrains Toolbox - Figma - Keka - Ableton Live 12 - Stats  Steps to reproduce the behavior: 1. Do a Cleanup. 2. Test every app, you'll find one that uses cache completely broken.  Keka shows permission prompts during the cleanup. Clearly touching stuff that shouldn't.  <img width="302" height="410" alt="Image" src="https://github.com/user-attachments/assets/6ceaff45-b464-41a5-a7ca-d1b559d98877" />  Screenshot on opening all apps mentioned.  - macOS version: macOS Tahoe Version 26.5.2 (25F84) - PureMac version: 2.9.4 (24) - Install method: (Homebrew / DMG / App Store / Source): DMG
  **Post-Mortem & Fix Analysis**:
  > After researching I think that the issue is caused by PureMac modifying app bundles in a way that strips or invalidates their code signature (`codesign`). It seems to hit Electron-based apps particularly hard (had the issue with Deezer, Thaw, Canva, VsCode..)  By manually re-sign the corrupted applications it resolve the issue but it's tedious. The command line is:  ```bash sudo codesign --force --deep --sign - /Applications/<AppName>.app ```
  > Confirmed, and you were right that it happens on default settings. Fixed in 2.9.5.  What was happening: Universal Binaries and Language Files both modify the application bundle and then ad-hoc re-sign it. The code claimed both categories start unselected and are skipped by automatic cleanups — that part was true — but the protection was only wired into the scheduler. `selectAllInCategory` had no such guard, so selecting everything in a category and cleaning fed those items straight through.  Removing a single `.lproj` was worse than it looks: it cloned the whole bundle and ran `codesign --force --deep --sign -` over the entire app. Since `--deep` skips `Contents/Resources`, that leaves vendor-signed code beside an ad-hoc outer bundle, and macOS refuses to launch the result.  Nicolo456 was right about the mechanism. The re-sign command does resolve it, though reinstalling is safer since ad-hoc signing does not restore notarization. Electron apps are hit hardest simply because they carry

- **Issue #142** (2026-08-21): **[Bug] Cleanup appears to corrupt iCloud Drive File Provider metadata and causes severe Finder copy delays**
  *Symptoms*: **Describe the bug**  Immediately after running a cleanup with PureMac, Finder operations involving iCloud Drive became extremely slow. Copying a fully downloaded folder containing 36 files (19.9 MB total) from iCloud Drive to the local Downloads folder, which was effectively instant before the cleanup, started taking approximately 9–23 seconds.  The timing strongly suggests that the PureMac cleanup triggered the problem, because:  - the slowdown started immediately after using PureMac; - there had been no recent macOS update before the symptom appeared; - PureMac was not running afterward and no persistent PureMac background job was found; - the SSD, memory, network, and ordinary local file I/O tested normally; - Safe Mode did not change the behavior; - Apple's File Provider consistency checker now reports hundreds of broken invariants.  I cannot conclusively identify which PureMac cleaning category caused the damage because PureMac does not expose a persistent, user-readable log of the exact paths removed. Please treat the PureMac causal link as a strong timeline-based suspicion, not as a proven identification of a specific source-code path. The application should retain a detailed cleanup transaction log so destructive side effects can be audited.  **To reproduce**  1. Enable iCloud Drive and keep a folder containing multiple small, fully downloaded files. 2. Confirm that copying the folder from iCloud Drive to a local folder such as Downloads is fast. 3. Run a PureMac cle
  **Post-Mortem & Fix Analysis**:
  > Confirmed, and your instinct about the cause was right. Partially fixed in 2.9.5.  There was no iCloud or File Provider denylist anywhere in the cleaning path. The user cache scan (`ScanEngine.swift:143-151`) was a depth-1 sweep of `~/Library/Caches` where every child over 1 KB became a pre-ticked deletion target — the only exclusions in the entire scan were Homebrew and two ollama directories. On any Mac with iCloud Drive enabled, that enumerated live CloudDocs, CloudKit and bird state and offered it as junk. Deletion then used `removeItem`, never `trashItem`, and never anything provider-aware, while `bird` and `fileproviderd` held those files open.  That is exactly what produces `is_on_disk_but_not_in_FS_Snapshot`: files removed from underneath the provider without telling it, so its snapshot and the filesystem diverge. It also explains why repair worked and then regressed about ten seconds later — the live service was rebuilding state against a database that no longer matched disk. 
  > The reported File Provider corruption path was fixed in commit be2ec797 and shipped in PureMac 2.9.5. The fix blocks iCloud/File Provider roots during both scanning and deletion and checks symlink-resolved paths. Persistent cleanup history and rollback/quarantine did not ship; this closure covers the original provider-state deletion bug, not those follow-up features.  Fix: https://github.com/momenbasel/PureMac/commit/be2ec797156bc2d8345e4be7a39c6f5df49333b4 Release: https://github.com/momenbasel/PureMac/releases/tag/v2.9.5

- **Issue #141** (2026-08-21): **[Bug]  Menu items show icons only, text missing in v2.9.2**
  *Symptoms*: <img width="2242" height="1304" alt="Image" src="https://github.com/user-attachments/assets/d6690d57-508f-48d5-a3a0-75c6458a26d3" />  Describe the bug After upgrading to version 2.9.2, the menu bar and context menu items only display icons without any text labels. This happens regardless of the language setting (tested both Chinese and English). I have already tried the following troubleshooting steps with no success:  1. Switched the app's built-in language between Chinese and English. 2. Ran the terminal command: defaults write -g AppleLanguages -array "zh-Hans" "en" 3. Reset the app's preferences via: defaults delete com.puremac.PureMac 4. Disabled "Increase Contrast" and "Reduce Transparency" in System Settings > Accessibility > Display.  None of these resolved the issue.  To Reproduce Steps to reproduce the behavior:  1. Install/upgrade to PureMac version 2.9.2. 2. Launch the app. 3. Click on any menu item from the app's menu bar or right-click the app icon.  Expected behavior Menu items should display both icon and text labels, not just icons.  Screenshots [Attach a screenshot showing the blank menu here]  Environment (please complete the following information):  - macOS Version: 14.7.7 Sonoma - PureMac Version: 2.9.2 - Mac Model: MacBook Pro 15-inch, 2018 (Intel Core i7 2.2 GHz, Radeon Pro 555X)  Additional context This issue might be related to the app's font rendering engine or the UI framework used in this version, as the problem persists across language changes and
  **Post-Mortem & Fix Analysis**:
  > I'm on the latest version with same problems still  <img width="1168" height="766" alt="Image" src="https://github.com/user-attachments/assets/38868622-6f45-4618-8131-443ba8fe31a9" />
  > Confirmed as a real, ongoing bug. Still open — here is where the investigation stands.  First, the version story does not hold up: 2.9.2 contained no Swift changes at all. `git diff v2.9.1..v2.9.2 -- "*.swift"` is empty; that release was only the app icon. So this is not a regression introduced between those two versions, which fits @frerrr still seeing it on the latest build. It is environment-dependent rather than version-dependent, which is also why a downgrade appearing to fix it can be misleading.  I had both screenshots measured pixel by pixel, and they show two different things:  - **@frerrr's** (1168x766): the sidebar rows really are being laid out narrow. The selected-row background stops at x=104 while the sidebar/detail divider is at x=234, and the badge sits at x≈110 instead of trailing-aligned near x≈200. - **@wanxiyu's** (2242x1304, the original report): the opposite. The selected row's background spans x=20..229 in a ~278px column — full width minus the 12pt row insets. 
  > Hi momenbasel,   Thank you for the detailed analysis and for taking the time to compare the screenshots. I really appreciate the effort you've put into narrowing this down.   To answer your questions:   1. **Font management tools:** No, I do not have any font management software installed (like FontExplorer, Suitcase, or RightFont). I also have not disabled or replaced any system fonts in Font Book. SF Pro and Helvetica Neue should be intact. 2. **Duplicate/corrupt fonts:** I ran Font Book and checked "Edit &gt; Look for Enabled Duplicates" — it shows no duplicates or corrupt fonts. 3. **Other SwiftUI apps:** Yes, text renders normally in other SwiftUI apps. I have tested a few and they all display correctly. This issue only appears to happen with PureMac.   Since you mentioned both of us are on Intel Macs, I can confirm my machine is an Intel MacBook Pro (15-inch, 2018) running macOS Sonoma 14.7.7.   I hope this information helps. Please let me know if you need me to 

- **Issue #127** (2026-07-18): **[Bug] Switch dark/light theme button background display is incorrect**
  *Symptoms*: **Describe the bug** Sometimes the switch dark/light theme button background is not in right area, it will appear in the upper-left corner.  **To reproduce** Steps to reproduce the behavior: 1. Go to 'Installed Apps' 2. select any app  3. after app file details loaded, the button background  will move to the upper-left corner   **Screenshots**  <img width="1120" height="708" alt="Image" src="https://github.com/user-attachments/assets/1f98fea4-cd64-4a1f-9fff-6a3ec2ec59a2" />  **Environment** - macOS version: macos 15 intel version - PureMac version: 2.8.3 - Install method: Homebrew 
  **Post-Mortem & Fix Analysis**:
  > Confirmed and fixed in 7100ce1, shipping in v2.8.4 today.  Root cause: the theme toggle's sliding highlight used `matchedGeometryEffect`, and the pill lives inside the window toolbar. When the file scan for a selected app finishes, the Uninstall button in that same toolbar animates in, forcing a toolbar re-layout - and during that re-layout the matched-geometry frame resolves against a hosting view with no geometry yet, so the highlight draws at the window origin. That's the stray rounded rectangle in your upper-left corner, and why it only appears right after the details load.  The highlight is now a single view anchored to the pill's own bounds and positioned by segment index, so the toolbar re-layout can't move it anywhere else. `brew upgrade --cask puremac` once v2.8.4 is up - I'll close this when the release is published.
  > v2.8.4 is out with the fix - https://github.com/momenbasel/PureMac/releases/tag/v2.8.4. Update with `brew upgrade --cask puremac`. The highlight now stays pinned behind the selected segment no matter what else the toolbar animates. Reopen if you can still trigger it.

- **Issue #126** (2026-07-18): **[Bug] The installed Application file size showing is wrong**
  *Symptoms*: **Describe the bug** The installed Application file size show is wrong, for example. Microsoft Word size should be 2.59GB, but in file details total size only show 459KB, main issue is '/Applications/Microsoft Word.app' only 96 bytes instead of 2.59GB.   **Screenshots**  <img width="1063" height="680" alt="Image" src="https://github.com/user-attachments/assets/945b9aa5-c8f8-4ecd-bd77-2c7d7e1981b2" />  **Environment** - macOS version: MacOS15.3.2, Intel version  - PureMac version: 2.8.3 - Install method: Homebrew 
  **Post-Mortem & Fix Analysis**:
  > Confirmed and root-caused. Thanks for the exact numbers - the 96 bytes gave it away.  In v2.8.3 the file-details pane sized each path with a non-recursive fallback chain that ends at the directory entry's own size on disk. On APFS a directory's inode size is 32 bytes per entry; `Microsoft Word.app` contains a single `Contents` folder, so (1 entry + `.` + `..`) x 32 = exactly the 96 bytes you saw. The Installed Apps list column already sized recursively, which is why only the details pane was wrong.  The fix (#124 plus a hardening commit) routes every displayed size through one shared recursive calculator, so the list and detail pane can no longer disagree. It ships in v2.8.4, going out today - `brew upgrade --cask puremac` once it lands. I'll close this when the release is up.
  > v2.8.4 is out with the fix - https://github.com/momenbasel/PureMac/releases/tag/v2.8.4. Update with `brew upgrade --cask puremac` (or `brew update && brew upgrade --cask puremac` if you installed from the tap). Word should now report its real ~2.6 GB in the details pane. Reopen if anything still looks off.

- **Issue #120** (2026-06-28): **[Bug] The new UI is lagging**
  *Symptoms*: **Describe the bug** The new UI from the new update is just lagging whenever I move the window around or just hover over the buttons. Maybe make an option to bring back the old UI  **To reproduce** Steps to reproduce the behavior: 1. Open pure mac 2. Make a smart scan 3. Try to move the window around  **Expected behavior** The windows and the buttons to lag a little bit  **Screenshots** If applicable, add screenshots.  **Environment** - macOS version: 26.5.1 - PureMac version: 2.8.1 - Install method: Homebrew 
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v2.8.2**.  Root cause: the live "currently scanning…" file-path ticker on the dashboard republished the **entire** view tree ~10×/second during a scan. On a busy scan that meant window drags and button hovers were constantly fighting the scan for the main thread, which showed up as the lag you described.  It's now isolated in its own small observable, so only the one ticker label updates at that rate and the rest of the UI stays still. Should be smooth on macOS 26 now.  Please update to 2.8.2 and reopen if you still see lag. 

- **Issue #119** (2026-06-28): **[Bug] App does not complete the full scan**
  *Symptoms*: When I start a smart scan, it just stops, and then I need to switch between menus in order for the scan to complete; otherwise, it is just completely frozen.  **To reproduce** 1. Open the app 2. Click on the smart scan icon 3. and then it just crashes  **Expected behavior** I expect for the scan to just stop and crash  **Screenshots** If applicable, add screenshots.  **Environment** - macOS version: 26.5.1 - PureMac version: 2.8.1 - Install method: Homebrew  https://github.com/user-attachments/assets/72a041da-088f-40ab-b0a9-12fa1ee8e2fe 
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v2.8.2** — same root cause as #120.  The scan itself wasn't actually crashing or stopping; it runs off the main thread. The problem was the dashboard's live path ticker invalidating the whole view tree ~10×/second, which starved the UI of redraws — so the scan *looked* frozen until you switched sidebar sections and forced a fresh render. That high-frequency update is now isolated to its own tiny view, so progress keeps animating while the scan runs.  Please update to 2.8.2. If a scan still stalls for you, reopen with the screen recording and we'll dig in. 

- **Issue #118** (2026-06-28): **Deprecation warning in puremac.rb: depends_on macos: string comparison is deprecated**
  *Symptoms*: **Describe the bug** When running `brew outdated` or managing packages via Homebrew, a deprecation warning is triggered by the `puremac.rb` formula due to an outdated `depends_on macos:` syntax.   **To reproduce** Steps to reproduce the behavior: 1. Open Terminal. 2. Run `brew update` followed by `brew outdated` (or any brew command that parses the tap). 3. See the following warning: ```text Warning: Calling string comparison format for `depends_on macos:` is deprecated! Use `depends_on macos: :ventura` instead. Please report this issue to the momenbasel/homebrew-tap tap (not Homebrew/* repositories), or even better, submit a PR to fix it:   /opt/homebrew/Library/Taps/momenbasel/homebrew-tap/Casks/puremac.rb:10  ```  **Expected behavior** The Homebrew command should run cleanly without any deprecation warnings. Line 10 in `puremac.rb` should be updated to use the modern syntax: `depends_on macos: :ventura`.  **Screenshots** *(If applicable, you can drag and drop a screenshot of your terminal here)*  **Environment**  * macOS version: 15.7.5 * PureMac version: Latest Cask version * Install method: Homebrew
  **Post-Mortem & Fix Analysis**:
  > Fixed.  The warning came from the cask using the old string-comparison form `depends_on macos: ">= :ventura"`, which Homebrew deprecated. It now uses the modern symbol form `depends_on macos: :ventura` — which is Homebrew's *exact* recommended replacement and still means "Ventura or newer", so nothing changes for users on macOS 13+.  - Custom tap (`momenbasel/homebrew-tap`): updated. - In-repo cask: PR #122 applies the same change (merged).  No more deprecation notice on `brew install`/`upgrade`. Thanks for the clean report. 

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

### Incident Patch 1: `b399a4f0` (2026-09-14)
**Commit Message**: Fix ignored path normalization on macOS 15

**File**: `cli/Sources/puremac/Core/Stores.swift` (modified, +18/-4)
```diff
@@ -123,11 +123,9 @@ struct IgnoreStore {
             guard allowRelative else {
                 throw StoreError.invalidIgnorePath
             }
-            absolute = URL(fileURLWithPath: currentDirectoryPath, isDirectory: true)
-                .appendingPathComponent(expanded)
-                .path
+            absolute = currentDirectoryPath + "/" + expanded
         }
-        let standardized = URL(fileURLWithPath: absolute).standardizedFileURL.path
+        let standardized = try lexicalStandardizedAbsolutePath(absolute)
         guard standardized.hasPrefix("/"), standardized != "/",
               !standardized.unicodeScalars.contains(where: {
                   $0.value == 0 || CharacterSet.newlines.contains($0)
@@ -138,6 +136,22 @@ struct IgnoreStore {
         return standardized
     }
 
+    private static func lexicalStandardizedAbsolutePath(_ path: String) throws -> String {
+        guard path.hasPrefix("/") else {
+            throw StoreError.invalidIgnorePath
+        }
+        var components: [Substring] = []
+        for component in path.split(separator: "/") {
+            if component == "." { continue }
+            if component == ".." {
+                if !components.isEmpty { components.removeLast() }
+                continue
+            }
+            components.append(component)
+        }
+        return "/" + components.joined(separator: "/")
+    }
+
     private static func load(from fileURL: URL) throws -> [String] {
         guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }
         let contents = try String(contentsOf: fileURL, encoding: .utf8)
```

**File**: `cli/Sources/puremac/PureMac.swift` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import ArgumentParser
 import Foundation
 
-let puremacVersion = "1.1.0"
+let puremacVersion = "1.1.1"
 
 @main
 struct PureMac: ParsableCommand {
```

**File**: `cli/Tests/puremacTests/OptimizeConfigTests.swift` (modified, +13/-4)
```diff
@@ -126,10 +126,19 @@ final class OptimizeConfigTests: XCTestCase {
         }
         XCTAssertTrue(store.roots.isEmpty)
         var rootStore = try IgnoreStore(fileURL: file, currentDirectoryPath: "/")
-        XCTAssertThrowsError(try rootStore.add("."))
-
-        try Data("relative/path\n".utf8).write(to: file)
-        XCTAssertThrowsError(try IgnoreStore(fileURL: file))
+        for path in [".", "/.", "/tmp/.."] {
+            XCTAssertThrowsError(try rootStore.add(path))
+            XCTAssertThrowsError(try rootStore.remove(path))
+        }
+        XCTAssertTrue(rootStore.roots.isEmpty)
+        XCTAssertTrue(try rootStore.add("/tmp/./puremac-ignore-fixture"))
+        XCTAssertEqual(rootStore.roots, ["/tmp/puremac-ignore-fixture"])
+        XCTAssertTrue(try rootStore.remove("/tmp/puremac-ignore-fixture"))
+
+        for contents in ["relative/path\n", "/.\n", "/tmp/..\n"] {
+            try Data(contents.utf8).write(to: file)
+            XCTAssertThrowsError(try IgnoreStore(fileURL: file))
+        }
     }
 
     private func temporaryDirectory() throws -> URL {
```

---

### Incident Patch 2: `87c1a9cc` (2026-08-21)
**Commit Message**: Fix/appearance system reset (#152)

* fix: Dark -> System appearance switch left window content dark

Problem:
Selecting Dark in the appearance picker and then switching back to
System updated only the title bar; the sidebar and detail content stayed
dark while the window was focused. The content only snapped to the
correct scheme once the PureMac window lost focus.

Reproduction (system appearance set to Light):
1. Launch PureMac (Appearance: System)
2. Choose Appearance -> Dark
3. Choose Appearance -> System
   -> title bar turns light, all window content remains dark
4. Click any other window: the content now turns light

Root cause:
The theme was applied with .preferredColorScheme(appearance.colorScheme),
where System maps to nil. On macOS, resetting preferredColorScheme from
an explicit scheme back to nil inside a WindowGroup that hosts a
NavigationSplitView (unified toolbar) resets the NSWindow appearance --
the title bar follows the system again -- but SwiftUI does not
re-evaluate the content's colorScheme environment until the window
resigns key. Confirmed on macOS 26.5 with a minimal instrumented repro:
after the reset, window.appearance=nil / effectiveAppearance=Aqua whil

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -43,6 +43,7 @@
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
 		ABDDD4F35102A39CC1A2C325 /* ConfettiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F0599AA604B0D6BA4F957537 /* ConfettiView.swift */; };
+		ABE3B80279483DB90B8EC1BC /* ThemeManagerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 55CE234DB2DB54ED53A4EFD6 /* ThemeManagerTests.swift */; };
 		B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8CE522B406791BCE905BC55B /* FileSize.swift */; };
 		B52938BBD11842631314543D /* CategoryDetailView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 10B0AF194677EAC1D5568785 /* CategoryDetailView.swift */; };
 		B928E4369A3FC4369F014A29 /* SmartCareCoreArtwork.swift in Sources */ = {isa = PBXBuildFile; fileRef = DAA389C4F50505795FB31A51 /* SmartCareCoreArtwork.swift */; };
@@ -109,6 +110,7 @@
 		46660271CFF167AB0FE7371D /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist; path = Info.plist; sourceTree = "<group>"; };
 		491771F923C93FD61A263893 /* AppLanguagePreferencesTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguagePreferencesTests.swift; sourceTree = "<group>"; };
 		4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OrphanSafetyPolicy.swift; sourceTree = "<group>"; };
+		55CE234DB2DB54ED53A4EFD6 /* ThemeManagerTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ThemeManagerTests.swift; sourceTree = "<group>"; };
 		5664D2BDAEAA9AE3A53DB364 /* PureMac.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = PureMac.entitlements; sourceTree = "<group>"; };
 		5785762276FB5E3209C6DE4D /* Logger.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Logger.swift; sourceTree = "<group>"; };
 		5A5C80929EE4A430272674BC /* ja */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ja; path = ja.lproj/Localizable.strings; sourceTree = "<group>"; };
@@ -185,6 +187,7 @@
 				752603285F7DBBA12BB3AA91 /* AppStateTests.swift */,
 				155CE1B8CDCCCA6F9FD028C1 /* LocalizationFilesTests.swift */,
 				C7D81BE7EA5DB17F4A0300AD /* SimulatorRuntimeSupportTests.swift */,
+				55CE234DB2DB54ED53A4EFD6 /* ThemeManagerTests.swift */,
 			);
 			path = PureMacTests;
 			sourceTree = "<group>";
@@ -536,6 +539,7 @@
 				E2403D82F00D749C9AD4A6D4 /* AppStateTests.swift in Sources */,
 				CFA64F54CDBF8A4765E0068D /* LocalizationFilesTests.swift in Sources */,
 				F4F02F966001A1504C2B4D33 /* SimulatorRuntimeSupportTests.swift in Sources */,
+				ABE3B80279483DB90B8EC1BC /* ThemeManagerTests.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `PureMac/PureMacApp.swift` (modified, +0/-1)
```diff
@@ -107,7 +107,6 @@ struct PureMacApp: App {
                 }
             }
             .environmentObject(theme)
-            .preferredColorScheme(theme.appearance.colorScheme)
             // Record the openWindow action so the menu-bar popover can reopen
             // this window after it's been closed (the popover lives outside the
             // scene graph and can't use openWindow itself).
```

**File**: `PureMac/Views/Components/AppTheme.swift` (modified, +19/-4)
```diff
@@ -1,3 +1,4 @@
+import AppKit
 import SwiftUI
 
 /// User-overridable appearance setting that lives independently of the system
@@ -22,11 +23,11 @@ enum AppearanceMode: String, CaseIterable, Identifiable {
         }
     }
 
-    var colorScheme: ColorScheme? {
+    var nsAppearance: NSAppearance? {
         switch self {
         case .system: return nil
-        case .light: return .light
-        case .dark: return .dark
+        case .light: return NSAppearance(named: .aqua)
+        case .dark: return NSAppearance(named: .darkAqua)
         }
     }
 }
@@ -37,9 +38,23 @@ final class ThemeManager: ObservableObject {
 
     @AppStorage("PureMac.Appearance") private var rawValue: String = AppearanceMode.system.rawValue
 
+    private init() { applyToApp() }
+
     var appearance: AppearanceMode {
         get { AppearanceMode(rawValue: rawValue) ?? .system }
-        set { rawValue = newValue.rawValue; objectWillChange.send() }
+        set { rawValue = newValue.rawValue; objectWillChange.send(); applyToApp() }
+    }
+
+    /// The theme is driven through NSApp.appearance, not SwiftUI's
+    /// .preferredColorScheme: resetting preferredColorScheme back to nil
+    /// (System) inside a WindowGroup hosting a NavigationSplitView only
+    /// re-appearances the titlebar — the content's colorScheme environment
+    /// isn't re-evaluated until the window resigns key, so the body stays
+    /// stuck in the previous scheme while focused. The AppKit route applies
+    /// immediately and also themes windows outside the main scene
+    /// (Settings, menus, popovers).
+    func applyToApp() {
+        NSApplication.shared.appearance = appearance.nsAppearance
     }
 }
 
```

**File**: `PureMacTests/ThemeManagerTests.swift` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import AppKit
+import XCTest
+@testable import PureMac
+
+@MainActor
+final class ThemeManagerTests: XCTestCase {
+    private var originalRawValue: String?
+    private var originalMode: AppearanceMode = .system
+    private var originalApplicationAppearance: NSAppearance?
+
+    override func setUp() {
+        super.setUp()
+        originalRawValue = UserDefaults.standard.string(forKey: "PureMac.Appearance")
+        originalMode = ThemeManager.shared.appearance
+        originalApplicationAppearance = NSApp.appearance
+    }
+
+    override func tearDown() {
+        // Reset the singleton first: @AppStorage caches writes made through the
+        // wrapper, so changing UserDefaults directly is not enough to restore
+        // the value ThemeManager reads when applying the process-wide theme.
+        ThemeManager.shared.appearance = originalMode
+
+        // Preserve the exact defaults representation as well (including an
+        // absent or previously invalid value) and restore the AppKit override
+        // independently so this suite cannot leak appearance state.
+        if let originalRawValue {
+            UserDefaults.standard.set(originalRawValue, forKey: "PureMac.Appearance")
+        } else {
+            UserDefaults.standard.removeObject(forKey: "PureMac.Appearance")
+        }
+        NSApp.appearance = originalApplicationAppearance
+        super.tearDown()
+    }
+
+    func testDarkSelectionAppliesAppKitAppearance() {
+        ThemeManager.shared.appearance = .dark
+        XCTAssertEqual(NSApp.appearance?.name, .darkAqua)
+    }
+
+    func testLightSelectionAppliesAppKitAppearance() {
+        ThemeManager.shared.appearance = .light
+        XCTAssertEqual(NSApp.appearance?.name, .aqua)
+    }
+
+    /// Dark -> System must clear the app-level override entirely. The previous
+    /// .preferredColorScheme(nil) pipeline left the NavigationSplitView content
+    /// stuck in the old scheme until the window resigned key.
+    func testSystemSelectionClearsAppKitAppearance() {
+        ThemeManager.shared.appearance = .dark
+        ThemeManager.shared.appearance = .system
+        XCTAssertNil(NSApp.appearance)
+    }
+
+    func testSelectionPersistsAcrossManagerReads() {
+        ThemeManager.shared.appearance = .dark
+        XCTAssertEqual(UserDefaults.standard.string(forKey: "PureMac.Appearance"), "dark")
+        XCTAssertEqual(ThemeManager.shared.appearance, .dark)
+    }
+}
```

---

### Incident Patch 3: `b5cb1670` (2026-08-21)
**Commit Message**: Fix Smart Care progress shimmer clipping (#153)

**File**: `PureMac/Views/DashboardView.swift` (modified, +49/-28)
```diff
@@ -1499,42 +1499,63 @@ private struct ShimmerProgressBar: View {
 
     private var clamped: Double { max(0, min(1, progress)) }
 
+    var body: some View {
+        ZStack(alignment: .leading) {
+            Capsule()
+                .fill(Color.primary.opacity(0.08))
+
+            if reduceMotion {
+                ShimmerProgressFill(progress: CGFloat(clamped), cycle: nil, tint: tint)
+            } else {
+                TimelineView(.animation) { timeline in
+                    let t = timeline.date.timeIntervalSinceReferenceDate
+                    let cycle = CGFloat((t.truncatingRemainder(dividingBy: 1.8)) / 1.8)
+                    ShimmerProgressFill(progress: CGFloat(clamped), cycle: cycle, tint: tint)
+                        .animation(.easeOut(duration: 0.35), value: clamped)
+                }
+            }
+        }
+        .clipShape(Capsule())
+        .frame(height: 9)
+    }
+}
+
+/// Keeps the fill, its clipping boundary, and the shimmer path on the same
+/// interpolated progress value while `TimelineView` independently drives the
+/// shimmer phase.
+private struct ShimmerProgressFill: View, Animatable {
+    var progress: CGFloat
+    let cycle: CGFloat?
+    let tint: Color
+
+    var animatableData: CGFloat {
+        get { progress }
+        set { progress = newValue }
+    }
+
     var body: some View {
         GeometryReader { geo in
-            let fillWidth = geo.size.width * CGFloat(clamped)
+            let fillWidth = geo.size.width * max(0, min(1, progress))
+            let visibleFillWidth = min(geo.size.width, max(8, fillWidth))
+
             ZStack(alignment: .leading) {
-                Capsule()
-                    .fill(Color.primary.opacity(0.08))
+                LinearGradient(colors: [tint, tint.opacity(0.7)],
+                               startPoint: .leading, endPoint: .trailing)
 
-                Capsule()
-                    .fill(
-                        LinearGradient(colors: [tint, tint.opacity(0.7)],
-                                       startPoint: .leading, endPoint: .trailing)
-                    )
-                    .frame(width: max(8, fillWidth))
-                    .animation(reduceMotion ? nil : .easeOut(duration: 0.35), value: clamped)
-
-                if !reduceMotion {
-                    TimelineView(.animation) { timeline in
-                        let t = timeline.date.timeIntervalSinceReferenceDate
-                        let cycle = (t.truncatingRemainder(dividingBy: 1.8)) / 1.8
-                        let bandWidth: CGFloat = 56
-                        LinearGradient(
-                            colors: [.clear, .white.opacity(0.35), .clear],
-                            startPoint: .leading, endPoint: .trailing
-                        )
-                        .frame(width: bandWidth)
-                        .offset(x: CGFloat(cycle) * (geo.size.width + bandWidth) - bandWidth)
-                    }
-                    .mask(
-                        Capsule()
-                            .frame(width: max(8, fillWidth))
-                            .frame(maxWidth: .infinity, alignment: .leading)
+                if let cycle {
+                    let bandWidth = min(56, max(3, visibleFillWidth * 0.6))
+                    LinearGradient(
+                        colors: [.clear, .white.opacity(0.35), .clear],
+                        startPoint: .leading, endPoint: .trailing
                     )
+                    .frame(width: bandWidth)
+                    .offset(x: cycle * (visibleFillWidth + bandWidth) - bandWidth)
+                    .frame(maxWidth: .infinity, alignment: .leading)
                 }
             }
+            .frame(width: visibleFillWidth)
+            .clipShape(Capsule())
         }
-        .frame(height: 9)
     }
 }
 
```

---

### Incident Patch 4: `7e0a6fea` (2026-08-10)
**Commit Message**: Merge pull request #146 from boombertz/fix/appearance-name-localization

fix(l10n): apply appearance name localization in MainWindow

**File**: `PureMac/Views/MainWindow.swift` (modified, +3/-3)
```diff
@@ -350,7 +350,7 @@ struct MainWindow: View {
                 Button {
                     theme.appearance = appearance
                 } label: {
-                    Label(appearance.label, systemImage: appearance.icon)
+                    Label(LocalizedStringKey(appearance.label), systemImage: appearance.icon)
                 }
             }
         } label: {
@@ -366,7 +366,7 @@ struct MainWindow: View {
 
                 Spacer(minLength: 6)
 
-                Text(theme.appearance.label)
+                Text(LocalizedStringKey(theme.appearance.label))
                     .font(.system(size: 10.5, weight: .medium))
                     .foregroundStyle(.secondary)
 
@@ -382,7 +382,7 @@ struct MainWindow: View {
         .menuStyle(.borderlessButton)
         .help("Change appearance")
         .accessibilityLabel("Appearance")
-        .accessibilityValue(theme.appearance.label)
+        .accessibilityValue(Text(LocalizedStringKey(theme.appearance.label)))
     }
 
     private var sidebarLabelColor: Color {
```

---

### Incident Patch 5: `e49162f9` (2026-07-30)
**Commit Message**: fix(l10n): apply appearance name localization in MainWindow

The appearance name (System/Light/Dark) was rendered via Text(String)
and Label(String, systemImage:), which use the non-localizing
initializers. As a result the existing "System"/"Light"/"Dark"
translations were never applied and the labels always showed English.

Wrap the values in LocalizedStringKey (matching AppearancePill) at the
menu item, the sidebar value, and the accessibility value so they
localize correctly.

**File**: `PureMac/Views/MainWindow.swift` (modified, +3/-3)
```diff
@@ -350,7 +350,7 @@ struct MainWindow: View {
                 Button {
                     theme.appearance = appearance
                 } label: {
-                    Label(appearance.label, systemImage: appearance.icon)
+                    Label(LocalizedStringKey(appearance.label), systemImage: appearance.icon)
                 }
             }
         } label: {
@@ -366,7 +366,7 @@ struct MainWindow: View {
 
                 Spacer(minLength: 6)
 
-                Text(theme.appearance.label)
+                Text(LocalizedStringKey(theme.appearance.label))
                     .font(.system(size: 10.5, weight: .medium))
                     .foregroundStyle(.secondary)
 
@@ -382,7 +382,7 @@ struct MainWindow: View {
         .menuStyle(.borderlessButton)
         .help("Change appearance")
         .accessibilityLabel("Appearance")
-        .accessibilityValue(theme.appearance.label)
+        .accessibilityValue(Text(LocalizedStringKey(theme.appearance.label)))
     }
 
     private var sidebarLabelColor: Color {
```

---

### Incident Patch 6: `695eb259` (2026-07-19)
**Commit Message**: cleanup depth: universal binaries, language files, deeper caches; fix wifi.log and Docker cleaning; bump 2.9.0

Two new categories close the gap against CleanMyMac:

- Universal Binaries: parses FAT Mach-O headers (main executable plus
  frameworks) and strips the non-native slice via a staged clone: APFS
  clone of the bundle, lipo on the clone, ad-hoc re-sign, codesign
  --verify --deep --strict, atomic swap. Any failure discards the clone
  and leaves the original untouched. Apps with restricted entitlements
  and App Store apps are refused or unselected.
- Language Files: removes unused .lproj folders through the same staged
  re-sign flow so the signature seal stays valid. Keeps preferred
  languages, CFBundleDevelopmentRegion, per-app AppleLanguages, en, Base.
Both are unselected by default and excluded from scheduled auto-clean.

Scanner depth fixes:
- directorySize dropped its 10,000-entry cap, which truncated DerivedData
  to a fraction of its real size. Now uses totalFileAllocatedSize with an
  error-tolerant enumerator and honors task cancellation.
- Xcode junk adds DeviceSupport (iOS/watchOS/tvOS), XCTestDevices,
  Previews, and SwiftPM caches.
- User cache now covers s

**File**: `PureMac/Logic/Scanning/LanguageFilesScanner.swift` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+import Foundation
+
+/// One app bundle with localization folders the user's system does not need.
+struct LanguageFileFinding: Sendable {
+    /// A single removable localization folder inside Contents/Resources.
+    struct Lproj: Sendable {
+        /// Full path to the .lproj folder.
+        let path: String
+        /// Recursive size of the folder in bytes.
+        let size: Int64
+    }
+
+    /// Bundle name without the .app suffix.
+    let appName: String
+    /// Full path to the .app bundle.
+    let appPath: String
+    /// Removable .lproj folders found in the bundle.
+    let lprojs: [Lproj]
+    /// True when Contents/_MASReceipt is present. An App Store update or
+    /// re-download restores stripped localizations anyway, so callers should
+    /// leave these findings unselected by default.
+    let appStore: Bool
+
+    /// Combined size of all removable folders in the bundle.
+    var totalBytes: Int64 { lprojs.reduce(0) { $0 + $1.size } }
+}
+
+/// Finds unused .lproj localization folders inside installed app bundles
+/// (the CleanMyMac "Language Files" feature). Pure logic - nothing is deleted
+/// here. The integrator surfaces each removable .lproj as its own
+/// CleanableItem (see `flatten`), and deletion runs through the existing
+/// CleaningEngine.removeItem flow.
+struct LanguageFilesScanner: Sendable {
+
+    /// Normalized language keys that must never be flagged as removable.
+    /// Built from Locale.preferredLanguages - "en-US" keeps "en" plus the
+    /// "en-US"/"en_US" variants - and always includes en, English (the legacy
+    /// folder name) and Base, which apps rely on as fallbacks.
+    var keepLanguages: Set<String> {
+        var keep: Set<String> = ["en", "english", "base"]
+        for language in Locale.preferredLanguages {
+            // "en-us" also keeps plain "en" so regional variants of a
+            // preferred language survive.
+            Self.insertWithBase(Self.normalize(language), into: &keep)
+        }
+        return keep
+    }
+
+    /// Scans the given application directories (top level plus one nested
+    /// level, e.g. /Applications/Utilities) and returns one finding per app
+    /// bundle that has removable localizations. Apps under /System and the
+    /// PureMac bundle itself are never reported.
+    func scan(applicationDirs: [String]) -> [LanguageFileFinding] {
+        let fileManager = FileManager.default
+        let keep = keepLanguages
+        let ownPath = (Bundle.main.bundlePath as NSString).standardizingPath
+
+        var findings: [LanguageFileFinding] = []
+        for dir in applicationDirs {
+            for appPath in appBundles(in: dir, fileManager: fileManager) {
+                if let finding = inspect(appPath: appPath, keep: keep, ownPath: ownPath, fileManager: fileManager) {
+                    findings.append(finding)
+                }
+            }
+        }
+
+        return findings.sorted { $0.totalBytes > $1.totalBytes }
+    }
+
+    /// Expands per-app findings into one entry per removable .lproj so the
+    /// integrator can surface each folder as its own CleanableItem. Entries
+    /// are named "<App> - <language display name>".
+    func flatten(_ findings: [LanguageFileFinding]) -> [(name: String, path: String, size: Int64, appStore: Bool)] {
+        findings.flatMap { finding in
+            finding.lprojs.map { lproj in
+                let code = ((lproj.path as NSString).lastPathComponent as NSString).deletingPathExtension
+                let identifier = code.replacingOccurrences(of: "_", with: "-")
+                let display = Locale.current.localizedString(forIdentifier: identifier) ?? code
+                return (name: "\(finding.appName) - \(display)", path: lproj.path, size: lproj.size, appStore: finding.appStore)
+            }
+        }
+    }
+
+    // MARK: - Private
+
+    /// Lowercases and unifies separators so "pt_BR", "pt-BR" and "pt-br" all
+    /// compare equa
```

**File**: `PureMac/Logic/Scanning/UniversalBinaryScanner.swift` (added, +343/-0)
```diff
@@ -0,0 +1,343 @@
+import Foundation
+
+/// One fat Mach-O file inside an app bundle, together with the slices that
+/// can be stripped on this machine and the bytes doing so would reclaim.
+/// `removableArchs` uses lipo's arch spelling ("x86_64", "arm64", ...) so it
+/// can be passed straight to `lipo -remove` by BinaryThinner.
+struct FatBinary: Sendable {
+    let path: String
+    let removableArchs: [String]
+    let reclaimableBytes: Int64
+}
+
+/// A universal-binary discovery for one app bundle: the app's main
+/// executable plus every fat framework/dylib found under Contents/Frameworks
+/// (where most of the savings live for Electron apps). `appStore` marks apps
+/// carrying a _MASReceipt — thinning those can break receipt validation, so
+/// the caller should surface them unselected by default.
+struct UniversalBinaryFinding: Identifiable, Sendable {
+    let id = UUID()
+    let appPath: String
+    let appName: String
+    let executablePath: String
+    let nativeArch: String
+    /// Union of removable arch names across all fat binaries in the bundle.
+    let removableArchs: [String]
+    /// Total bytes freed by stripping every foreign slice in the bundle.
+    let reclaimableBytes: Int64
+    let appStore: Bool
+    /// Every fat Mach-O in the bundle with per-file removable archs — the
+    /// exact work list BinaryThinner executes.
+    let fatBinaries: [FatBinary]
+}
+
+/// Finds universal (fat) app binaries carrying a slice for the architecture
+/// this Mac does not run natively, and computes how many bytes stripping the
+/// foreign slice would reclaim. Pure logic — no mutation, no privileged
+/// operations — so it stays a plain Sendable struct rather than an actor.
+///
+/// The FAT header is parsed by hand from the first 4 KB of each candidate
+/// file instead of shelling out to `lipo -info` per file: an /Applications
+/// walk touches thousands of framework binaries and process spawns would
+/// dominate the scan time.
+struct UniversalBinaryScanner: Sendable {
+
+    // MARK: - Mach-O constants (values as they appear byte-swapped from disk)
+
+    private static let fatMagic: UInt32 = 0xcafe_babe
+    private static let fatMagic64: UInt32 = 0xcafe_babf
+    private static let cpuTypeX86_64: UInt32 = 0x0100_0007
+    private static let cpuTypeARM64: UInt32 = 0x0100_000c
+
+    /// lipo arch spelling per (cputype, masked cpusubtype). arm64e and x86_64h
+    /// are distinct lipo names, so the subtype matters for `-remove` to hit
+    /// the right slice.
+    private static func archName(cpuType: UInt32, cpuSubtype: UInt32) -> String? {
+        // High byte of cpusubtype carries capability flags (e.g. LIB64,
+        // PTRAUTH versioning) — mask them off before matching.
+        let subtype = cpuSubtype & 0x00ff_ffff
+        switch (cpuType, subtype) {
+        case (0x0000_0007, _): return "i386"
+        case (Self.cpuTypeX86_64, 8): return "x86_64h"
+        case (Self.cpuTypeX86_64, _): return "x86_64"
+        case (0x0000_000c, _): return "arm"
+        case (Self.cpuTypeARM64, 2): return "arm64e"
+        case (Self.cpuTypeARM64, _): return "arm64"
+        default: return nil
+        }
+    }
+
+    /// The machine's native architecture, asked of the kernel at runtime.
+    /// A compile-time #if arch check would follow whichever slice PureMac
+    /// itself runs as — under Rosetta the x86_64 slice would classify every
+    /// app's native arm64/arm64e slices as removable, and thinning would
+    /// strip them. hw.optional.arm64 is absent on Intel hardware.
+    private static let hostIsARM64: Bool = {
+        var value: Int32 = 0
+        var size = MemoryLayout<Int32>.size
+        guard sysctlbyname("hw.optional.arm64", &value, &size, nil, 0) == 0 else {
+            return false
+        }
+        return value == 1
+    }()
+    private static var hostCPUType: UInt32 { hostIsARM64 ? cpuTypeARM64 : cpuTypeX86_64 }
+    private static var hostArchName: String { hostIsARM64 ?
```

**File**: `PureMac/Logic/Utilities/FileProtection.swift` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import Foundation
+
+/// Shared SIP/immutability check used by both ScanEngine (so protected
+/// entries never surface as cleanable items) and CleaningEngine (so a
+/// protected survivor is reported as "skipped, protected by macOS" instead
+/// of a scary removal error).
+enum FileProtection {
+
+    /// True when the entry is SIP-protected or immutable: BSD flags carry
+    /// SF_RESTRICTED/SF_IMMUTABLE/UF_IMMUTABLE, or the path has the
+    /// com.apple.rootless xattr. Deleting these fails even with admin
+    /// privileges.
+    static func isProtectedFromDeletion(path: String) -> Bool {
+        var sb = stat()
+        if lstat(path, &sb) == 0 {
+            // SF_RESTRICTED (0x00080000) isn't exported by Darwin's Swift
+            // overlay, so spell out the literal; the immutable flags are.
+            let protectedFlags: UInt32 = 0x0008_0000 | UInt32(SF_IMMUTABLE) | UInt32(UF_IMMUTABLE)
+            if sb.st_flags & protectedFlags != 0 {
+                return true
+            }
+        }
+
+        // SIP also marks paths with the com.apple.rootless xattr, which
+        // can be present even when st_flags reads 0.
+        let bufSize = listxattr(path, nil, 0, XATTR_NOFOLLOW)
+        if bufSize > 0 {
+            var buffer = [CChar](repeating: 0, count: bufSize)
+            let read = listxattr(path, &buffer, bufSize, XATTR_NOFOLLOW)
+            if read > 0 {
+                let names = Data(bytes: &buffer, count: read)
+                    .split(separator: 0)
+                    .compactMap { String(data: $0, encoding: .utf8) }
+                if names.contains("com.apple.rootless") {
+                    return true
+                }
+            }
+        }
+
+        return false
+    }
+}
```

**File**: `PureMac/Models/Models.swift` (modified, +17/-0)
```diff
@@ -15,6 +15,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
     case brewCache = "Brew Cache"
     case nodeCache = "Node Cache"
     case dockerCache = "Docker Cache"
+    case universalBinaries = "Universal Binaries"
+    case languageFiles = "Language Files"
 
     var id: String { rawValue }
 
@@ -32,6 +34,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
         case .brewCache: return "mug.fill"
         case .nodeCache: return "leaf.fill"
         case .dockerCache: return "shippingbox.fill"
+        case .universalBinaries: return "cpu"
+        case .languageFiles: return "globe"
         }
     }
 
@@ -49,6 +53,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
         case .brewCache: return "Homebrew download cache"
         case .nodeCache: return "npm, yarn, and pnpm download caches"
         case .dockerCache: return "Docker images, containers, and build cache"
+        case .universalBinaries: return "Unused CPU architecture slices in app binaries"
+        case .languageFiles: return "Unused app localizations"
         }
     }
 
@@ -66,6 +72,8 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
         case .brewCache: return .mint
         case .nodeCache: return .pink
         case .dockerCache: return .indigo
+        case .universalBinaries: return .brown
+        case .languageFiles: return .gray
         }
     }
 
@@ -80,6 +88,15 @@ enum CleaningCategory: String, CaseIterable, Identifiable, Codable {
     static var scannable: [CleaningCategory] {
         allCases.filter { $0 != .smartScan && $0 != .purgeableSpace }
     }
+
+    // Categories that rewrite app bundles in place (binary thinning,
+    // localization stripping) instead of deleting junk. Their items always
+    // start unselected, and the scheduled autoClean path skips them
+    // entirely — re-signing every installed app is never an unattended
+    // action.
+    static var appModifying: Set<CleaningCategory> {
+        [.universalBinaries, .languageFiles]
+    }
 }
 
 // MARK: - Scan State
```

**File**: `PureMac/Services/BinaryThinner.swift` (added, +323/-0)
```diff
@@ -0,0 +1,323 @@
+import Foundation
+
+/// Strips foreign-architecture slices from the fat binaries of one app
+/// bundle (a UniversalBinaryFinding from UniversalBinaryScanner) and ad-hoc
+/// re-signs the bundle so Gatekeeper still accepts it. Also removes .lproj
+/// localization folders through the same flow, because deleting sealed
+/// resources with a plain unlink breaks the bundle's signature.
+///
+/// Safety model — the original bundle is never modified in place:
+///   1. Entitlement gate: apps claiming provisioning-backed entitlements
+///      (com.apple.developer.*, com.apple.application-identifier) are
+///      refused outright. Those entitlements are only honored under an
+///      Apple-issued certificate; an ad-hoc signature carrying them is
+///      killed by AMFI at spawn.
+///   2. Preflight: the bundle and its parent directory must be writable by
+///      the current user (the swap below is two renames in the parent).
+///      Otherwise fail with `needsAdmin` before touching anything; there
+///      is no admin escalation here.
+///   3. Stage: clone the whole bundle to a hidden sibling directory (APFS
+///      makes the copy cheap) and apply every modification — lipo or lproj
+///      removal — to the copy only.
+///   4. Sign the staged copy ad-hoc, then verify it with
+///      `codesign --verify --deep --strict`. Any failure discards the copy
+///      and leaves the original untouched; nothing to roll back, so a
+///      failed sign can never leave a mixed Developer ID / ad-hoc bundle.
+///   5. Strip com.apple.quarantine from the verified copy. The re-sign
+///      changes the cdhash, so a still-quarantined app would otherwise be
+///      re-assessed by Gatekeeper and refused as not notarized.
+///   6. Swap: rename the original aside, rename the staged copy into place,
+///      delete the original. If the delete fails (root-owned contents) the
+///      swap is undone and `needsAdmin` is returned, so "success" always
+///      means the space was actually freed.
+actor BinaryThinner {
+
+    enum ThinningError: LocalizedError {
+        /// Bundle, its parent directory, or its contents not writable by
+        /// this user. Caller decides what to do; this actor never escalates
+        /// privileges.
+        case needsAdmin(String)
+        /// App claims provisioning-backed entitlements that only work under
+        /// its original developer signature; re-signing would stop it
+        /// launching, so it is refused before anything is staged.
+        case restrictedEntitlements(String)
+        case lipoFailed(String, String)
+        case swapFailed(String, String)
+        case codesignFailed(String, String)
+        case verificationFailed(String, String)
+        case nothingToThin(String)
+
+        var errorDescription: String? {
+            switch self {
+            case .needsAdmin(let path):
+                return "Not writable by current user: \(path)"
+            case .restrictedEntitlements(let app):
+                return "Cannot modify \(app): its entitlements require the original developer signature"
+            case .lipoFailed(let path, let detail):
+                return "lipo failed for \(path): \(detail)"
+            case .swapFailed(let path, let detail):
+                return "Could not swap modified bundle into place at \(path): \(detail)"
+            case .codesignFailed(let app, let detail):
+                return "Re-signing failed for \(app): \(detail)"
+            case .verificationFailed(let app, let detail):
+                return "Signature verification failed for \(app): \(detail)"
+            case .nothingToThin(let app):
+                return "No removable slices in \(app)"
+            }
+        }
+    }
+
+    private let fileManager = FileManager.default
+
+    // MARK: - Public API
+
+    /// Thins every fat binary in the finding and re-signs the bundle.
+    /// Success value is the number of bytes actually freed (sum of
+ 
```

---

### Incident Patch 7: `7100ce1c` (2026-07-18)
**Commit Message**: fix #127 theme-toggle stray highlight; localize Polish name; bump 2.8.4

The appearance pill's selected-segment highlight could render at the
window origin: matchedGeometryEffect inside the NSToolbar-hosted item
resolved a zero frame during the animated toolbar re-layout that fires
when an app-file scan completes (selectedFiles flips non-empty and the
Uninstall button animates in the same toolbar). Replace it with a single
indicator anchored to the pill's own bounds, positioned by segment index
and mirrored under right-to-left layout.

Follow-ups to #125: translate the "Polish" language name in the six
non-English locales, and align pl terminology with Apple's macOS
glossary (Desktop "Pulpit" -> "Biurko" to stop colliding with Dashboard,
Storage "Pamięć" -> "Pamięć masowa" to disambiguate from Memory).

project.yml: 2.8.3(18) -> 2.8.4(19).

Claude-Session: https://claude.ai/code/session_01DE9Zo9AfnDhMDNaaUy8o4o

**File**: `PureMac/Views/Components/AppearancePill.swift` (modified, +23/-12)
```diff
@@ -5,11 +5,19 @@ import SwiftUI
 /// looked like a generic dropdown affordance.
 struct AppearancePill: View {
     @Binding var selection: AppearanceMode
-    @Namespace private var indicator
     @Environment(\.accessibilityReduceMotion) private var reduceMotion
+    @Environment(\.layoutDirection) private var layoutDirection
+
+    private static let segmentWidth: CGFloat = 28
+    private static let segmentHeight: CGFloat = 22
+    private static let segmentSpacing: CGFloat = 2
+
+    private var selectedIndex: CGFloat {
+        CGFloat(AppearanceMode.allCases.firstIndex(of: selection) ?? 0)
+    }
 
     var body: some View {
-        HStack(spacing: 2) {
+        HStack(spacing: Self.segmentSpacing) {
             ForEach(AppearanceMode.allCases) { mode in
                 Button {
                     withAnimation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.78)) {
@@ -18,22 +26,25 @@ struct AppearancePill: View {
                 } label: {
                     Image(systemName: mode.icon)
                         .font(.system(size: 12, weight: .semibold))
-                        .frame(width: 28, height: 22)
+                        .frame(width: Self.segmentWidth, height: Self.segmentHeight)
                         .foregroundStyle(selection == mode ? Color.primary : .secondary)
-                        .background(
-                            ZStack {
-                                if selection == mode {
-                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
-                                        .fill(Color.primary.opacity(0.10))
-                                        .matchedGeometryEffect(id: "indicator", in: indicator)
-                                }
-                            }
-                        )
                         .contentShape(Rectangle())
                 }
                 .buttonStyle(.plain)
                 .help(LocalizedStringKey(mode.label))
             }
         }
+        // Indicator is anchored to the pill's own bounds and positioned by
+        // segment index, so toolbar re-layout can't misplace it. The previous
+        // matchedGeometryEffect resolved a zero frame inside the NSToolbar
+        // hosting view and drew the highlight at the window origin (#127).
+        // .offset(x:) is not layout-direction aware, so mirror it for RTL.
+        .background(alignment: .leading) {
+            let x = selectedIndex * (Self.segmentWidth + Self.segmentSpacing)
+            RoundedRectangle(cornerRadius: 6, style: .continuous)
+                .fill(Color.primary.opacity(0.10))
+                .frame(width: Self.segmentWidth, height: Self.segmentHeight)
+                .offset(x: layoutDirection == .rightToLeft ? -x : x)
+        }
     }
 }
```

**File**: `PureMac/ar.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "الإسبانية";
 "Japanese" = "اليابانية";
 "Arabic" = "العربية";
-"Polish" = "Polish";
+"Polish" = "البولندية";
 "Portuguese (Brazil)" = "البرتغالية (البرازيل)";
 "Chinese (Simplified)" = "الصينية (المبسطة)";
 "Chinese (Traditional)" = "الصينية (التقليدية)";
```

**File**: `PureMac/es.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "Español";
 "Japanese" = "Japonés";
 "Arabic" = "Árabe";
-"Polish" = "Polish";
+"Polish" = "Polaco";
 "Portuguese (Brazil)" = "Portugués (Brasil)";
 "Chinese (Simplified)" = "Chino (simplificado)";
 "Chinese (Traditional)" = "Chino (tradicional)";
```

**File**: `PureMac/ja.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
 "Spanish" = "スペイン語";
 "Japanese" = "日本語";
 "Arabic" = "アラビア語";
-"Polish" = "Polish";
+"Polish" = "ポーランド語";
 "Portuguese (Brazil)" = "ポルトガル語(ブラジル)";
 "Chinese (Simplified)" = "中国語(簡体字)";
 "Chinese (Traditional)" = "中国語(繁体字)";
```

**File**: `PureMac/pl.lproj/Localizable.strings` (modified, +3/-3)
```diff
@@ -60,7 +60,7 @@
 "Dismiss" = "Zamknij";
 
 /* Dashboard */
-"Storage" = "Pamięć";
+"Storage" = "Pamięć masowa";
 "Smart Scan" = "Inteligentne skanowanie";
 "free of %@" = "wolne z %@";
 "%lld%% used" = "%lld%% użyte";
@@ -194,7 +194,7 @@
 "Trash" = "Kosz";
 "Mail Data" = "Dane poczty";
 "Safari Data" = "Dane Safari";
-"Desktop" = "Pulpit";
+"Desktop" = "Biurko";
 "Documents" = "Dokumenty";
 "TCC Database" = "Baza TCC";
 "Blocked" = "Zablokowane";
@@ -354,7 +354,7 @@
 
 /* v2.8.2: large-file folder exclusions (#121) */
 "Excluded Folders" = "Wykluczone foldery";
-"Files inside these folders are skipped from the Large & Old Files scan (Downloads, Documents, Desktop)." = "Pliki w tych folderach są pomijane podczas skanowania Dużych i starych plików (Pobrane, Dokumenty, Pulpit).";
+"Files inside these folders are skipped from the Large & Old Files scan (Downloads, Documents, Desktop)." = "Pliki w tych folderach są pomijane podczas skanowania Dużych i starych plików (Pobrane, Dokumenty, Biurko).";
 "Remove from exclusions" = "Usuń z wykluczeń";
 "Add Folder…" = "Dodaj folder…";
 
```

---

### Incident Patch 8: `1a1e9e31` (2026-06-28)
**Commit Message**: Merge pull request #124 from albertonoys/fix/recursive-app-sizes

Fix app/file sizes showing as bytes instead of recursive total

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -37,6 +37,7 @@
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
 		ABDDD4F35102A39CC1A2C325 /* ConfettiView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F0599AA604B0D6BA4F957537 /* ConfettiView.swift */; };
+		B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8CE522B406791BCE905BC55B /* FileSize.swift */; };
 		B52938BBD11842631314543D /* CategoryDetailView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 10B0AF194677EAC1D5568785 /* CategoryDetailView.swift */; };
 		BC6C800216343438413349A3 /* OnboardingView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3D4FD34378988D430A582ED0 /* OnboardingView.swift */; };
 		CDCDFEBA39A3290101F86AC6 /* MainWindow.swift in Sources */ = {isa = PBXBuildFile; fileRef = 9F510F232341EE18F11DC934 /* MainWindow.swift */; };
@@ -102,6 +103,7 @@
 		77D3D9A9BC52839E6D0A22BC /* Locations.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Locations.swift; sourceTree = "<group>"; };
 		798B80977D14647A5691B0A0 /* AppFilesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppFilesView.swift; sourceTree = "<group>"; };
 		82BB0904726B38DEB141BECA /* AppLanguage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguage.swift; sourceTree = "<group>"; };
+		8CE522B406791BCE905BC55B /* FileSize.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FileSize.swift; sourceTree = "<group>"; };
 		8D5E63D733D1A3BDEDF4DCA5 /* pt-BR */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "pt-BR"; path = "pt-BR.lproj/Localizable.strings"; sourceTree = "<group>"; };
 		913E3064AA9BD7BE94A315CF /* MenuBarController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MenuBarController.swift; sourceTree = "<group>"; };
 		92259B3E9F4468865F15DEEC /* AppearancePill.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppearancePill.swift; sourceTree = "<group>"; };
@@ -275,6 +277,7 @@
 			isa = PBXGroup;
 			children = (
 				01B2C5F66B6D812572BD4F05 /* CLI.swift */,
+				8CE522B406791BCE905BC55B /* FileSize.swift */,
 				5785762276FB5E3209C6DE4D /* Logger.swift */,
 				4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */,
 			);
@@ -446,6 +449,7 @@
 				A2AE68CC75CB72D6B10CBDF5 /* DashboardView.swift in Sources */,
 				76B132F9C499225D33E0D075 /* EmptyStateView.swift in Sources */,
 				52F11962555C639F0EECADD6 /* FDADemoView.swift in Sources */,
+				B51E5A95BB49A6C0F5273E21 /* FileSize.swift in Sources */,
 				2253F11BDF561B617439C96B /* FullDiskAccessManager.swift in Sources */,
 				A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */,
 				E60B0A2C5D0A6CAE35BF4DFB /* Locations.swift in Sources */,
```

**File**: `PureMac/Logic/Scanning/AppInfoFetcher.swift` (modified, +1/-26)
```diff
@@ -133,31 +133,6 @@ final class AppInfoFetcher {
     }
 
     private func appSize(at url: URL) -> Int64 {
-        // totalFileAllocatedSizeKey on a directory URL returns only the
-        // directory inode (~4 KB on APFS), not the recursive sum - the
-        // previous fast-path returned that and exited, causing app sizes
-        // to display as ~4 KB regardless of bundle contents. Always
-        // enumerate the bundle contents and sum.
-        guard let enumerator = fileManager.enumerator(
-            at: url,
-            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
-            options: [.skipsHiddenFiles]
-        ) else { return 0 }
-
-        var total: Int64 = 0
-        for case let fileURL as URL in enumerator {
-            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
-            // Skip symlinks so we don't double-count or follow links out of
-            // the bundle. Skip directories so we only count regular file
-            // payload.
-            if values.isSymbolicLink == true { continue }
-            guard values.isRegularFile == true else { continue }
-            if let allocated = values.totalFileAllocatedSize {
-                total += Int64(allocated)
-            } else if let allocated = values.fileAllocatedSize {
-                total += Int64(allocated)
-            }
-        }
-        return total
+        FileSizeCalculator.size(of: url) ?? 0
     }
 }
```

**File**: `PureMac/Logic/Utilities/FileSize.swift` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import Foundation
+
+/// Allocated-size calculation that works for both files and directories.
+///
+/// `URLResourceValues.totalFileAllocatedSize` does **not** recurse: on a
+/// directory URL it returns only the directory inode's own allocation
+/// (~96 bytes to a few KB on APFS), not the sum of the bundle's contents.
+/// Reading it directly on an `.app` bundle or a support folder is what made
+/// items display as a handful of bytes. For directories we enumerate and sum
+/// the regular files instead.
+enum FileSizeCalculator {
+    private static let fileManager = FileManager.default
+
+    /// On-disk allocated size of `url`. Recurses into directories.
+    /// Returns `nil` if the item can't be read at all.
+    static func size(of url: URL) -> Int64? {
+        let values = try? url.resourceValues(forKeys: [.isDirectoryKey])
+        if values?.isDirectory == true {
+            return directorySize(of: url)
+        }
+        return fileSize(of: url)
+    }
+
+    private static func fileSize(of url: URL) -> Int64? {
+        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
+           let size = values.totalFileAllocatedSize {
+            return Int64(size)
+        }
+        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
+           let size = values.fileAllocatedSize {
+            return Int64(size)
+        }
+        guard let attrs = try? fileManager.attributesOfItem(atPath: url.path),
+              let size = attrs[.size] as? Int64 else { return nil }
+        return size
+    }
+
+    private static func directorySize(of url: URL) -> Int64 {
+        guard let enumerator = fileManager.enumerator(
+            at: url,
+            includingPropertiesForKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey],
+            options: [.skipsHiddenFiles]
+        ) else { return 0 }
+
+        var total: Int64 = 0
+        for case let fileURL as URL in enumerator {
+            guard let values = try? fileURL.resourceValues(forKeys: [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
+            // Skip symlinks so we don't double-count or follow links that
+            // escape the directory. Only sum regular-file payload.
+            if values.isSymbolicLink == true { continue }
+            guard values.isRegularFile == true else { continue }
+            if let allocated = values.totalFileAllocatedSize {
+                total += Int64(allocated)
+            } else if let allocated = values.fileAllocatedSize {
+                total += Int64(allocated)
+            }
+        }
+        return total
+    }
+}
```

**File**: `PureMac/Views/Apps/AppFilesView.swift` (modified, +1/-14)
```diff
@@ -372,20 +372,7 @@ struct AppFilesView: View {
     }
 
     private func fileSize(_ url: URL) -> Int64? {
-        // totalFileAllocatedSize recurses into directories; attributesOfItem
-        // returns the directory's own metadata size (≈0), which is why
-        // bundles and support folders previously displayed as 0 B.
-        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
-           let size = values.totalFileAllocatedSize, size > 0 {
-            return Int64(size)
-        }
-        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
-           let size = values.fileAllocatedSize {
-            return Int64(size)
-        }
-        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
-              let size = attrs[.size] as? Int64 else { return nil }
-        return size
+        FileSizeCalculator.size(of: url)
     }
 
     private func removeSingleFile(_ url: URL) {
```

**File**: `PureMac/Views/Orphans/OrphanListView.swift` (modified, +1/-11)
```diff
@@ -125,17 +125,7 @@ struct OrphanListView: View {
     }
 
     private func fileSize(_ url: URL) -> Int64? {
-        if let values = try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]),
-           let size = values.totalFileAllocatedSize, size > 0 {
-            return Int64(size)
-        }
-        if let values = try? url.resourceValues(forKeys: [.fileAllocatedSizeKey]),
-           let size = values.fileAllocatedSize {
-            return Int64(size)
-        }
-        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
-              let size = attrs[.size] as? Int64 else { return nil }
-        return size
+        FileSizeCalculator.size(of: url)
     }
 
     private func removeSelectedOrphans() async {
```

---

### Incident Patch 9: `cf404c95` (2026-06-28)
**Commit Message**: fix: dashboard hero + stats overflow at narrow window widths

At small window sizes the idle-dashboard hero (fixed 180pt ring beside the
storage column) overflowed the card and the storage figure clipped, and
the 4-up stat grid crushed its values. Make both adapt to the dashboard
width: below 660pt the hero stacks vertically with a smaller ring via a
new AdaptiveStack, and the stat grid drops from 4 columns to 2.

Claude-Session: https://claude.ai/code/session_01B6BCRcv3uVh5Tizs9hMv88

**File**: `PureMac/Views/DashboardView.swift` (modified, +27/-3)
```diff
@@ -152,15 +152,19 @@ struct DashboardView: View {
         let free = appState.diskInfo.freeSpace
         let percentUsed = total > 0 ? Double(used) / Double(total) : 0
         let stress = percentUsed > 0.85
+        // Below this width the side-by-side ring + storage column overflows the
+        // card, so the hero stacks vertically and the ring shrinks.
+        let compact = dashboardSize.width > 0 && dashboardSize.width < 660
+        let ringSize: CGFloat = compact ? 132 : 180
 
         return CardSurface(padding: 24, accent: stress ? Tint.orange : Tint.blue, elevation: .raised) {
-            HStack(alignment: .center, spacing: 28) {
+            AdaptiveStack(compact: compact, spacing: compact ? 18 : 28) {
                 ZStack {
                     // Slow atmospheric drift behind the ring — barely-there
                     // ambient depth, frozen under Reduce Motion.
                     HeroDrift(tint: stress ? Tint.orange : Tint.blue)
                     HealthRing(percent: percentUsed)
-                        .frame(width: 180, height: 180)
+                        .frame(width: ringSize, height: ringSize)
                 }
 
                 VStack(alignment: .leading, spacing: 14) {
@@ -264,7 +268,10 @@ struct DashboardView: View {
         let total = appState.diskInfo.totalSpace
         let percentUsed = total > 0 ? Double(total - free) / Double(total) : 0
 
-        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
+        // Four across when there's room, two when the dashboard is narrow so the
+        // cards don't crush their values.
+        let columnCount = dashboardSize.width > 0 && dashboardSize.width < 660 ? 2 : 4
+        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: columnCount), spacing: 12) {
             StatCard(
                 icon: "internaldrive.fill",
                 tint: Tint.blue,
@@ -950,3 +957,20 @@ private struct CategoryToggleRow: View {
         String(format: String(localized: "%lld items"), Int64(result.itemCount))
     }
 }
+
+/// Lays its content out horizontally at full width and vertically when the
+/// container is too narrow for the row to fit, so wide hero rows reflow into a
+/// stacked layout instead of overflowing.
+struct AdaptiveStack<Content: View>: View {
+    let compact: Bool
+    var spacing: CGFloat = 28
+    @ViewBuilder var content: Content
+
+    var body: some View {
+        if compact {
+            VStack(alignment: .leading, spacing: spacing) { content }
+        } else {
+            HStack(alignment: .center, spacing: spacing) { content }
+        }
+    }
+}
```

---

### Incident Patch 10: `373d3dd6` (2026-06-28)
**Commit Message**: feat: menu-bar system monitor (opt-in CPU/memory/disk meters)

Adds an optional menu-bar status item showing live CPU / memory / disk
usage, toggled from Settings > General > System Monitor. Clicking it
opens a popover with labeled meters plus Open/Quit actions; the menu-bar
button shows live CPU%.

Implementation notes:
- AppKit NSStatusItem + NSPopover (hosting the SwiftUI MenuBarMonitorView)
  rather than a SwiftUI MenuBarExtra: a conditional .window-style
  MenuBarExtra fails to type-check in @SceneBuilder, and an unconditional
  one stalls the XCTest host run loop. The AppKit controller is created
  only when enabled and never under XCTest.
- SystemMonitor samples CPU (host_statistics), memory (host_statistics64),
  and disk (volume capacity) on a 2s timer, refcounted so it idles when
  unobserved.
- statusItem.isVisible is set explicitly (it restores hidden from autosave
  state otherwise) with an autosaveName to persist the user's placement.
- App stays resident while enabled so the meters keep updating after the
  window closes; WindowOpener captures openWindow so the popover can
  reopen it.
- +8 localized UI strings across all 7 locales (321-key parity preserved).
- proje

**File**: `PureMac.xcodeproj/project.pbxproj` (modified, +16/-4)
```diff
@@ -27,10 +27,12 @@
 		826A750D2D7EC14C2AE306A3 /* Models.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3667D46D8E2004EB4D73835A /* Models.swift */; };
 		8947F0CE448791BD50EECF46 /* Conditions.swift in Sources */ = {isa = PBXBuildFile; fileRef = CB94E06E145558123BB5BFB3 /* Conditions.swift */; };
 		8B541441926847072DC5B75B /* DashboardCharts.swift in Sources */ = {isa = PBXBuildFile; fileRef = 08C60E04A0CA3F227816DB63 /* DashboardCharts.swift */; };
+		91751CF033E1541BFD39B12C /* MenuBarMonitorView.swift in Sources */ = {isa = PBXBuildFile; fileRef = A27DB5A70FA829B6C3ED0AC3 /* MenuBarMonitorView.swift */; };
 		93743B036059418560D876E6 /* SettingsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 3A8D39C3C250F26302EC45AB /* SettingsView.swift */; };
 		95278ABDCF5F4D6AC60503B1 /* AppearancePill.swift in Sources */ = {isa = PBXBuildFile; fileRef = 92259B3E9F4468865F15DEEC /* AppearancePill.swift */; };
 		9AA80E035DF7B33F6EE118DF /* AppState.swift in Sources */ = {isa = PBXBuildFile; fileRef = CED1B71D5F9510582E869CFD /* AppState.swift */; };
 		9BB5AAA574AFED6C27A3F8E2 /* AppPathFinder.swift in Sources */ = {isa = PBXBuildFile; fileRef = AC0FEE7141871ED5F9E36121 /* AppPathFinder.swift */; };
+		9E3639F9EFCB2A22F6747894 /* MenuBarController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 913E3064AA9BD7BE94A315CF /* MenuBarController.swift */; };
 		A2AE68CC75CB72D6B10CBDF5 /* DashboardView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F661A0F64CF93E482CB1728F /* DashboardView.swift */; };
 		A549D8A39A9E5E70D91B90A6 /* Haptics.swift in Sources */ = {isa = PBXBuildFile; fileRef = 40A3F22FCEF534DE4A2CAD0E /* Haptics.swift */; };
 		A9C3A1F643C26930F442E729 /* OrphanSafetyPolicy.swift in Sources */ = {isa = PBXBuildFile; fileRef = 4AE790496C936424EF98320A /* OrphanSafetyPolicy.swift */; };
@@ -41,6 +43,7 @@
 		CFA64F54CDBF8A4765E0068D /* LocalizationFilesTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = 155CE1B8CDCCCA6F9FD028C1 /* LocalizationFilesTests.swift */; };
 		D50EB059E741011EB2523731 /* ScanError.swift in Sources */ = {isa = PBXBuildFile; fileRef = EEF15CB1B8EFCA78EF491824 /* ScanError.swift */; };
 		D9445C2641A8637B65DA5ACE /* ScanEngine.swift in Sources */ = {isa = PBXBuildFile; fileRef = A711CDF5285F68775D9B5513 /* ScanEngine.swift */; };
+		DBFD73E3D9BDA74EC1CA56AB /* SystemMonitor.swift in Sources */ = {isa = PBXBuildFile; fileRef = DB798781B99987F55D77E2E3 /* SystemMonitor.swift */; };
 		DC32253D26D0E29762006DA0 /* AppBundleDragHandle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2D3F9FEDC493A8E49E910F67 /* AppBundleDragHandle.swift */; };
 		DDD6BA35DBF32E7A6B5F6F8B /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = B2EA41E1096FA8E3B916AD13 /* Assets.xcassets */; };
 		DDDA5879006CB97D5D7BDD87 /* Logger.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5785762276FB5E3209C6DE4D /* Logger.swift */; };
@@ -100,9 +103,11 @@
 		798B80977D14647A5691B0A0 /* AppFilesView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppFilesView.swift; sourceTree = "<group>"; };
 		82BB0904726B38DEB141BECA /* AppLanguage.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppLanguage.swift; sourceTree = "<group>"; };
 		8D5E63D733D1A3BDEDF4DCA5 /* pt-BR */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "pt-BR"; path = "pt-BR.lproj/Localizable.strings"; sourceTree = "<group>"; };
+		913E3064AA9BD7BE94A315CF /* MenuBarController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MenuBarController.swift; sourceTree = "<group>"; };
 		92259B3E9F4468865F15DEEC /* AppearancePill.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppearancePill.swift; sourceTree = "<group>"; };
 		9F04B811BB0012F6D2F07F91 /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = en.lproj/Localizable.strings; sour
```

**File**: `PureMac/PureMacApp.swift` (modified, +51/-2)
```diff
@@ -1,11 +1,30 @@
 import AppKit
 import SwiftUI
 
+@MainActor
 class AppDelegate: NSObject, NSApplicationDelegate {
-    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
+    /// Owns the optional menu-bar status item. Nil until the monitor is enabled.
+    private var menuBarController: MenuBarController?
+
+    /// Normally PureMac quits when its window closes. When the menu-bar system
+    /// monitor is enabled the app stays resident so the meters keep updating in
+    /// the menu bar; "Open PureMac" in that menu reopens the window.
+    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
+        !UserDefaults.standard.bool(forKey: "settings.general.menuBarMonitor")
+    }
 
     func applicationDidFinishLaunching(_ notification: Notification) {
         NSWindow.allowsAutomaticWindowTabbing = false
+
+        // Install the menu-bar monitor if the user has it enabled. Never under
+        // XCTest — the status-item machinery would stall the test-host run loop.
+        if NSClassFromString("XCTestCase") == nil {
+            syncMenuBarMonitor()
+            NotificationCenter.default.addObserver(
+                self, selector: #selector(syncMenuBarMonitor),
+                name: .pureMacMenuBarMonitorChanged, object: nil
+            )
+        }
         // Touch TCC-protected paths so macOS registers PureMac in the
         // Full Disk Access pane on first launch (fixes issue #75).
         FullDiskAccessManager.shared.triggerRegistration()
@@ -38,6 +57,25 @@ class AppDelegate: NSObject, NSApplicationDelegate {
             userInfo: ["path": appURL.path]
         )
     }
+
+    /// Create or tear down the menu-bar status item to match the current
+    /// Settings toggle. Posted to whenever the toggle flips so it takes effect
+    /// without a relaunch.
+    @objc func syncMenuBarMonitor() {
+        let enabled = UserDefaults.standard.bool(forKey: "settings.general.menuBarMonitor")
+        if enabled, menuBarController == nil {
+            menuBarController = MenuBarController()
+        } else if !enabled, let controller = menuBarController {
+            controller.teardown()
+            menuBarController = nil
+        }
+    }
+}
+
+extension Notification.Name {
+    /// Posted when the "Show system monitor in menu bar" Settings toggle flips,
+    /// so AppDelegate can add/remove the status item live.
+    static let pureMacMenuBarMonitorChanged = Notification.Name("PureMac.MenuBarMonitorChanged")
 }
 
 @main
@@ -58,7 +96,7 @@ struct PureMacApp: App {
     }
 
     var body: some Scene {
-        WindowGroup {
+        WindowGroup(id: "main") {
             Group {
                 if onboardingComplete {
                     MainWindow()
@@ -70,6 +108,10 @@ struct PureMacApp: App {
             }
             .environmentObject(theme)
             .preferredColorScheme(theme.appearance.colorScheme)
+            // Record the openWindow action so the menu-bar popover can reopen
+            // this window after it's been closed (the popover lives outside the
+            // scene graph and can't use openWindow itself).
+            .background(WindowOpenerCapture())
         }
         .windowStyle(.automatic)
         .windowToolbarStyle(.unified)
@@ -89,5 +131,12 @@ struct PureMacApp: App {
             SettingsView()
                 .environmentObject(appState)
         }
+
+        // The opt-in menu-bar system monitor is an AppKit NSStatusItem managed
+        // by AppDelegate/MenuBarController rather than a SwiftUI MenuBarExtra:
+        // a conditional `.window`-style MenuBarExtra fails to type-check, and an
+        // unconditional one sets up status-item machinery that hangs the XCTest
+        // host. The AppKit controller is only created when enabled and never
+        // under tests, sidestepping both problems.
     }
 }
```

**File**: `PureMac/Services/MenuBarController.swift` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import AppKit
+import SwiftUI
+import Combine
+
+/// Captures SwiftUI's `openWindow` action so AppKit surfaces (the menu-bar
+/// popover, which lives outside the scene graph and has no working `openWindow`
+/// environment) can reopen the main window after it has been closed. The main
+/// window records the action on appear; the closure stays valid for the app's
+/// lifetime even once the window is gone.
+@MainActor
+final class WindowOpener {
+    static let shared = WindowOpener()
+    var open: ((String) -> Void)?
+    private init() {}
+}
+
+/// AppKit-backed menu-bar system monitor. A SwiftUI `MenuBarExtra` was avoided
+/// here: a conditional `.window`-style `MenuBarExtra` fails to type-check, and
+/// an unconditional one stalls the XCTest host's run loop. An `NSStatusItem`
+/// driving an `NSPopover` (which hosts the existing SwiftUI `MenuBarMonitorView`)
+/// gives the same UI with full create/destroy control and no test-host impact.
+@MainActor
+final class MenuBarController: NSObject, NSPopoverDelegate {
+    private let statusItem: NSStatusItem
+    private let popover = NSPopover()
+    private let monitor = SystemMonitor.shared
+    private var cancellable: AnyCancellable?
+
+    override init() {
+        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
+        super.init()
+
+        // Persist the user's show/hide choice and ensure the item is requested
+        // visible (it defaults hidden when restored from a prior autosave state).
+        statusItem.autosaveName = "PureMacSystemMonitor"
+        statusItem.isVisible = true
+
+        monitor.start()
+
+        if let button = statusItem.button {
+            button.image = NSImage(
+                systemSymbolName: "gauge.with.dots.needle.67percent",
+                accessibilityDescription: "System Monitor"
+            )
+            button.imagePosition = .imageLeading
+            button.target = self
+            button.action = #selector(togglePopover)
+            updateTitle()
+        }
+
+        popover.behavior = .transient
+        popover.contentSize = NSSize(width: 248, height: 230)
+        popover.contentViewController = NSHostingController(rootView: MenuBarMonitorView())
+        popover.delegate = self
+
+        // Refresh the menu-bar CPU readout each time the monitor samples.
+        cancellable = monitor.$cpuUsage
+            .receive(on: RunLoop.main)
+            .sink { [weak self] _ in self?.updateTitle() }
+    }
+
+    /// Remove the status item and release the monitor observer. Called by
+    /// AppDelegate before dropping the controller so teardown runs on the main
+    /// actor (a `@MainActor` deinit cannot touch isolated state safely).
+    func teardown() {
+        cancellable?.cancel()
+        cancellable = nil
+        if popover.isShown { popover.performClose(nil) }
+        NSStatusBar.system.removeStatusItem(statusItem)
+        monitor.stop()
+    }
+
+    private func updateTitle() {
+        guard let button = statusItem.button else { return }
+        button.title = " \(Int((monitor.cpuUsage * 100).rounded()))%"
+    }
+
+    @objc private func togglePopover() {
+        guard let button = statusItem.button else { return }
+        if popover.isShown {
+            popover.performClose(nil)
+        } else {
+            NSApp.activate(ignoringOtherApps: true)
+            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
+            popover.contentViewController?.view.window?.makeKey()
+        }
+    }
+}
```

**File**: `PureMac/Services/SystemMonitor.swift` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+import Foundation
+import Darwin
+
+/// Lightweight live system telemetry for the menu-bar monitor (CPU / memory /
+/// disk). Polls on a timer only while a SwiftUI view is observing it; the menu
+/// bar's `MenuBarExtra` keeps a single shared instance alive, and `start()` /
+/// `stop()` gate the timer so the app does no background sampling when the
+/// monitor is disabled in Settings.
+///
+/// All readings use public Mach / Foundation APIs (no sandbox-incompatible
+/// shelling out), so this stays valid under the app's hardened-runtime,
+/// notarized build.
+@MainActor
+final class SystemMonitor: ObservableObject {
+    static let shared = SystemMonitor()
+
+    /// 0.0 - 1.0 fraction of total CPU time spent non-idle since the last sample.
+    @Published private(set) var cpuUsage: Double = 0
+    @Published private(set) var memoryUsed: Int64 = 0
+    @Published private(set) var memoryTotal: Int64 = 0
+    @Published private(set) var diskUsed: Int64 = 0
+    @Published private(set) var diskTotal: Int64 = 0
+
+    var memoryFraction: Double {
+        guard memoryTotal > 0 else { return 0 }
+        return Double(memoryUsed) / Double(memoryTotal)
+    }
+
+    var diskFraction: Double {
+        guard diskTotal > 0 else { return 0 }
+        return Double(diskUsed) / Double(diskTotal)
+    }
+
+    private var timer: Timer?
+    /// Previous CPU tick counters, kept to turn the kernel's monotonically
+    /// increasing totals into a per-interval delta.
+    private var previousBusy: UInt64 = 0
+    private var previousTotal: UInt64 = 0
+    /// Number of live observers; the timer runs only while > 0 so two views
+    /// (menu-bar label + dropdown) share one timer and the app idles cleanly.
+    private var observerCount = 0
+
+    private init() {}
+
+    /// Begin (or keep) sampling. Refcounted so multiple observers share a timer.
+    func start(interval: TimeInterval = 2.0) {
+        observerCount += 1
+        guard timer == nil else { return }
+        memoryTotal = Int64(ProcessInfo.processInfo.physicalMemory)
+        sample()
+        let t = Timer(timeInterval: interval, repeats: true) { [weak self] _ in
+            Task { @MainActor in self?.sample() }
+        }
+        // .common so sampling continues while a menu/popover tracks the run loop.
+        RunLoop.main.add(t, forMode: .common)
+        timer = t
+    }
+
+    /// Release one observer; the timer stops once the last one goes away.
+    func stop() {
+        observerCount = max(0, observerCount - 1)
+        guard observerCount == 0 else { return }
+        timer?.invalidate()
+        timer = nil
+    }
+
+    private func sample() {
+        sampleCPU()
+        sampleMemory()
+        sampleDisk()
+    }
+
+    // MARK: - CPU
+
+    private func sampleCPU() {
+        var info = host_cpu_load_info()
+        var count = mach_msg_type_number_t(
+            MemoryLayout<host_cpu_load_info_data_t>.stride / MemoryLayout<integer_t>.stride
+        )
+        let result = withUnsafeMutablePointer(to: &info) {
+            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
+                host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, $0, &count)
+            }
+        }
+        guard result == KERN_SUCCESS else { return }
+
+        let user = UInt64(info.cpu_ticks.0)
+        let system = UInt64(info.cpu_ticks.1)
+        let idle = UInt64(info.cpu_ticks.2)
+        let nice = UInt64(info.cpu_ticks.3)
+        let busy = user &+ system &+ nice
+        let total = busy &+ idle
+
+        defer { previousBusy = busy; previousTotal = total }
+        // First sample has no prior baseline to diff against.
+        guard previousTotal != 0, total > previousTotal else { return }
+
+        let busyDelta = Double(busy &- previousBusy)
+        let totalDelta = Double(total &- previousTotal)
+        guard totalDelta > 0 else { return }
+        cpuUsage = min(1, max(0, busyDelta / totalDelta))
+    }
+
+    // M
```

**File**: `PureMac/Views/Components/MenuBarMonitorView.swift` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+import SwiftUI
+import AppKit
+
+/// Zero-size helper that captures SwiftUI's `openWindow` action into
+/// `WindowOpener.shared` when the main window appears, so the AppKit menu-bar
+/// popover can reopen the window after it's been closed.
+struct WindowOpenerCapture: View {
+    @Environment(\.openWindow) private var openWindow
+
+    var body: some View {
+        Color.clear
+            .frame(width: 0, height: 0)
+            .onAppear { WindowOpener.shared.open = { id in openWindow(id: id) } }
+    }
+}
+
+/// Drop-down panel hosted in the menu-bar `NSPopover` (via `NSHostingController`)
+/// with live CPU / memory / disk meters and quick actions. Kept self-contained
+/// so the menu bar surface stays decoupled from the main window's `AppState`.
+struct MenuBarMonitorView: View {
+    @ObservedObject private var monitor = SystemMonitor.shared
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 12) {
+            Text("System Monitor")
+                .font(.system(size: 13, weight: .semibold))
+                .foregroundStyle(.primary)
+
+            VStack(spacing: 10) {
+                MeterRow(title: "CPU", tint: Tint.blue,
+                         fraction: monitor.cpuUsage,
+                         detail: "\(Int((monitor.cpuUsage * 100).rounded()))%")
+                MeterRow(title: "Memory", tint: Tint.purple,
+                         fraction: monitor.memoryFraction,
+                         detail: byteDetail(monitor.memoryUsed, monitor.memoryTotal))
+                MeterRow(title: "Disk", tint: Tint.green,
+                         fraction: monitor.diskFraction,
+                         detail: byteDetail(monitor.diskUsed, monitor.diskTotal))
+            }
+
+            Divider()
+
+            HStack {
+                Button {
+                    openMainWindow()
+                } label: {
+                    Text("Open PureMac")
+                }
+                .buttonStyle(.borderedProminent)
+                .controlSize(.small)
+
+                Spacer()
+
+                Button {
+                    NSApp.terminate(nil)
+                } label: {
+                    Text("Quit PureMac")
+                }
+                .buttonStyle(.bordered)
+                .controlSize(.small)
+            }
+        }
+        .padding(14)
+        .frame(width: 248)
+        .onAppear { monitor.start() }
+        .onDisappear { monitor.stop() }
+    }
+
+    private func byteDetail(_ used: Int64, _ total: Int64) -> String {
+        let u = ByteCountFormatter.string(fromByteCount: used, countStyle: .memory)
+        let t = ByteCountFormatter.string(fromByteCount: total, countStyle: .memory)
+        return "\(u) / \(t)"
+    }
+
+    /// Bring the app forward and surface the main window. The app stays alive
+    /// after its window closes only while the monitor is enabled (see
+    /// `AppDelegate.applicationShouldTerminateAfterLastWindowClosed`), so this
+    /// reopens a fresh window when none is left, otherwise just focuses it.
+    private func openMainWindow() {
+        NSApp.activate(ignoringOtherApps: true)
+        // Exclude the menu-bar popover's own panel; a real content window is
+        // titled and can become main.
+        if let existing = NSApp.windows.first(where: {
+            $0.canBecomeMain && $0.styleMask.contains(.titled)
+        }) {
+            existing.makeKeyAndOrderFront(nil)
+        } else {
+            // No content window left — reopen via the captured openWindow action
+            // (the popover has no working openWindow environment of its own).
+            WindowOpener.shared.open?("main")
+        }
+    }
+}
+
+/// One labeled meter: title on the left, a thin tinted progress bar, and a
+/// trailing numeric detail. Mirrors the restrained chrome used elsewhere.
+private struct MeterRow: View {
+    let title: LocalizedStringKey
+    let tint: Color
+    let fraction: Double
+    let detail: String
```

#### Recent Merged Pull Requests:
- **PR #178** (closed): V3.0.0 zh.4 (@qg-hs)
- **PR #160** (closed): Add file and folder scan exclusions (@omartio)
- **PR #159** (closed): Add advanced storage intelligence, diagnostics, and filesystem performance optimizations (@a7med2o6)
- **PR #157** (2026-08-17): feat(cli): add puremac terminal cleaner (@momenbasel)
- **PR #156** (closed): Add a shared sort control to every file list (@wicolian)
- **PR #155** (closed): xcode: clean XcodeBuildMCP DerivedData (@omartio)
- **PR #154** (2026-08-21): Docs/readme pt br (@boombertz)
- **PR #153** (2026-08-21): Fix Smart Care progress shimmer clipping (@omartio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
