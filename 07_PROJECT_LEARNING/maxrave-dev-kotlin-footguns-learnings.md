> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/maxrave-dev-kotlin-footguns-learnings.md`  
> **Source**: github ([https://github.com/maxrave-dev/kotlin-footguns](https://github.com/maxrave-dev/kotlin-footguns))  
> **Source Version**: `f5f0b495`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-09T05:58:22.085Z  
> **Learning ID**: `learn-github-maxrave-dev-kotlin-footguns-mv0k10g5`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): maxrave-dev/kotlin-footguns

> **Canonical Artifact**: `07_PROJECT_LEARNING/maxrave-dev-kotlin-footguns-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maxrave-dev/kotlin-footguns](https://github.com/maxrave-dev/kotlin-footguns))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-09T05:58:21.890Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maxrave-dev/kotlin-footguns`
- **Description**: Battle-tested agent skills mapping the footguns of Kotlin, Compose Multiplatform and the desktop JVM — mined from a production music app, not from documentation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1082 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/footgun-scan/scripts/scan.py`
```
#!/usr/bin/env python3
"""Scan Kotlin and Compose Multiplatform changes for the shapes the kotlin-footguns traps describe.

Every detector is a pattern over source lines that points at one trap file. A hit is a shape worth a
look, not a verdict: open the trap it names and decide. Two levels:

  likely  the shape is wrong unless a specific condition holds (the trap says which)
  look    a place the trap says to inspect before trusting it

    python3 scan.py                     lines added in the working tree and index since HEAD
    python3 scan.py --base origin/main  lines added since this branch left origin/main
    python3 scan.py --all [paths...]    every line of the tracked files (a full audit, noisier)
    python3 scan.py --list              print the detectors
    python3 scan.py --self-test         run every detector against its own examples

Add --fail to exit 1 when any `likely` hit is found (for a pre-commit hook or CI).
Standard library only; needs git on PATH for everything except --self-test and --list.
"""
import argparse
import fnmatch
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILLS_ROOT = os.path.dirname(os.path.dirname(HERE))

KOTLIN = ["*.kt", "*.kts", "*.java"]
SQL_HOSTS = ["*.kt", "*.kts", "*.java", "*.sq", "*.sql"]
BUILD = ["*.kts", "*.gradle", "*.toml"]
TEST_PATH = re.compile(r"(^|/)(test|androidTest|androidUnitTest|commonTest|jvmTest|iosTest|desktopTest)/|Test\.kt$")
SKIP_PATH = re.compile(r"(^|/)(build|\.gradle|\.idea|node_modules|generated)/")


def D(id, level, trap, pattern, message, hits, misses, files=KOTLIN, span=0, unless=None,
      requires=None, before=0, unless_before=None, skip_tests=False, check=None):
    return dict(id=id, level=level, trap=trap, pattern=re.compile(pattern) if pattern else None,
                message=message, hits=hits, misses=misses, files=files, span=span,
                unless=re.compile(unless) if unless else None,
                requires=re.compile(requires) if requires else None, before=before,
                unless_before=unless_before, skip_tests=skip_tests, check=check)


# --- custom checks -------------------------------------------------------------------------------

def call_args(text, open_paren):
    """The argument text of a call whose "(" is at text[open_paren], or None if it does not close."""
    depth = 0
    for j in range(open_paren, len(text)):
        depth += text[j] == "("
        depth -= text[j] == ")"
        if depth == 0:
            return text[open_paren + 1:j]
    return None


def gradient_to_transparent(lines, i):
    """A gradient whose own colour stops include Color.Transparent."""
    text = "\n".join(lines[i:i + 6])
    for m in re.finditer(r"Gradient\s*\(", text):
        if m.start() > len(lines[i]):
            break
        args = call_args(text, m.end() - 1)
        if not args or not re.search(r"\bColor\.Transparent\b", args):
            continue
        # Color.Transparent is black at alpha 0, so a fade whose other stops are all black is right.
        stops = colour_stops(args)
        if stops and all(c.startswith(("Color.Transparent", "Color.Black")) for c in stops):
            continue
        return True
    return False


def split_top_level(args):
    parts, depth, cur = [], 0, ""
    for ch in args:
        depth += ch in "([{"
        depth -= ch in ")]}"
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def colour_stops(args):
    """The colour expressions of a gradient call: a colors list, or the right side of `x to colour` pairs."""
    lst = re.search(r"\b(?:listOf|arrayOf)\s*\(", args)
    if lst:
        inner = call_args(args, lst.end() - 1) or ""
        return [p for p in split_top_level(inner) if p]
    pairs = [p.split(" to ", 1)[1].strip() for p in split_top_level(args) if " to " in p]
    return pairs


def clickable_before_clip(lines, i):
    """.clickable followed by .clip in the same modifier chain, on this line or chained below it."""
    m = re.search(r"\.(?:combinedClickable|clickable)\b", lines[i])
    if not m:
        return False
    if re.search(r"\.clip\s*\(", lines[i][m.end():]):
        return True
    for line in lines[i + 1:i + 3]:
        stripped = line.strip()
        if stripped.startswith(".clip(") or stripped.startswith(".clip ("):
            return True
        if not stripped.startswith("."):
            return False
    return False

def slide_default_offset(lines, i):
    """slideInVertically()/slideOutVertically() with no offset lambda uses half the height."""
    text = "\n".join(lines[i:i + 4])
    for m in re.finditer(r"\bslide(?:In|Out)Vertically\b\s*", text):
        if m.start() >= len(lines[i]):
            break
        rest = text[m.end():]
        if rest.startswith("{"):
            continue  # trailing lambda is the offset
        if not rest.startswith("("):
            continue  # a reference, not a call
        depth, j = 0, 0
        for j, ch in enumerate(rest):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0:
                break
        args, after = rest[1:j], rest[j + 1:]
        if "OffsetY" in args or "{" in args or after.lstrip().startswith("{"):
            continue
        return True
    return False


def callback_writes_twice(lines, i):
    """A listener callback that writes one state holder unconditionally and again elsewhere.

    Writes confined to separate branches (if/else, when) are one write per event and pass.
    """
    if not re.search(r"\boverride\s+fun\s+on[A-Z]\w*\s*\(", lines[i]):
        return False
    depth, started = 0, False
    top, anywhere = {}, {}
    for line in lines[i:i + 60]:
        code = re.sub(r'"(?:\\.|[^"\\])*"', '""', line.split("//")[0])
        if started:
            for name in re.findall(r"\b(_?\w+)\.value\s*=(?!=)|\b(_?\w+)\.update\s*\{", code):
                name = name[0] or name[1]
                anywhere[name] = anywhere.get(name, 0) + 1
                if depth == 1:
                    top[name] = top.get(name, 0) + 1
        for ch in code:
            if ch == "{":
                depth += 1
                started = True
            elif ch == "}":
                depth -= 1
        if started and depth <= 0:
            break
    return any(anywhere.get(name, 0) >= 2 for name in top)


# --- detectors -------------------------------------------------------------------------------------

DETECTORS = [
    # data layer
    D("not-in-subquery-unguarded", "look", "data-layer-footguns/sql-not-in-nullable-trap",
      r"(?i)\bNOT\s+IN\s*\(\s*SELECT\b",
      "NOT IN over a subquery: if that column is nullable, one NULL makes it match nothing; guard with IS NOT NULL or note that it is NOT NULL",
      hits=['@Query("DELETE FROM playlist WHERE id NOT IN (SELECT remotePlaylistId FROM local_playlist)")'],
      misses=['@Query("DELETE FROM p WHERE id NOT IN (SELECT rid FROM l WHERE rid IS NOT NULL)")'],
      files=SQL_HOSTS, span=3, unless=r"(?i)\bNOT\s+NULL\b"),
    D("like-pattern-concatenated", "likely", "data-layer-footguns/like-wildcard-escaping-ids",
      r"(?i)\bLIKE\s+'%'\s*\|\|",
      "LIKE built from a value: `_` and `%` inside the value are wildcards unless escaped with an ESCAPE clause",
      hits=["WHERE json LIKE '%' || :id || '%'"],
      misses=["WHERE json LIKE '%' || :id || '%' ESCAPE '\\\\'", "WHERE name LIKE 'abc%'"],
      files=SQL_HOSTS, span=2, unless=r"(?i)\bESCAPE\b"),
    D("like-pattern-interpolated", "look", "data-layer-footguns/like-wildcard-escaping-ids",
      r'"%\$\{?[\w.]+\}?%"',
      "a LIKE pattern built from a value: escape `_` and `%` in it and pass an ESCAPE clause",
      hits=['dao.search("%$query%")', 'dao.find("%${item.id}%")'],
      misses=['println("100%")']),
    D("vacuum-through-raw-query", "likely", "data-layer-footguns/room-rawquery-readonly-vacuum",
      r'(?i)\b(RoomRawQuery|SimpleSQLiteQuery)\s*\(\s*"\s*VACUUM',
      "a raw-query DAO method runs on a read-only connection, so VACUUM fails there; run it on a writer connection from the database class",
      hits=['dao.raw(RoomRawQuery("VACUUM"))'],
      misses=['dao.raw(RoomRawQuery("PRAGMA wal_checkpoint(FULL)"))']),
    D("sql-localtime", "likely", "data-layer-footguns/bucket-local-time-in-code-not-in-sql",
      r"(?i)'localtime'",
      "SQLite's 'localtime' uses the process time zone; bucket local hours and days in code from one raw scan",
      hits=["SELECT strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS hour"],
      misses=["SELECT strftime('%s', 'now')"], files=SQL_HOSTS),
    D("sql-strftime-bucket", "look", "data-layer-footguns/bucket-local-time-in-code-not-in-sql",
      r"(?i)\bstrftime\s*\(\s*'%[HdjmwWY]",
      "bucketing by hour or day in SQL answers in UTC or the process zone, not the user's; bucket in code",
      hits=["GROUP BY strftime('%H', playedAt / 1000, 'unixepoch')"],
      misses=["SELECT strftime('%s', 'now')"], files=SQL_HOSTS),
    D("migration-sql-interpolated", "likely", "data-layer-footguns/room-migrations-at-scale",
      r'\bexecSQL\s*\(\s*"[^"\n]*(\$\{?\w|"\s*\+\s*[A-Za-z_])',
      "values spliced into execSQL are concatenated, not bound: a quote in user data ends the statement mid-migration",
      hits=['db.execSQL("INSERT INTO t (a) VALUES (\'${row.songId}\')")',
            'db.execSQL("UPDATE t SET name = \'" + name + "\'")'],
      misses=['db.execSQL("DROP TABLE IF EXISTS `format`")',
              'db.execSQL("CREATE TRIGGER x " +\n    "AFTER DELETE ON t BEGIN END;")'],
      span=1),
    D("migration-graph-changed", "look", "data-layer-footguns/room-migrations-at-scale",
      r"\bAutoMigration\s*\(|\bMigration\s*\(\s*\d+\s*,\s*\d+\s*\)",
      "a migration edge changed: run the trap's reachability check so every shipped version still reaches the head",
      hits
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2** (2026-09-25): **v2.0.0: nine area skills, footgun-scan and a with/without eval suite**
  *Symptoms*: ## Summary  - **Nine area skills instead of 224 single skills.** Each area skill (desktop/build, KMP architecture, media playback, data layer, Compose visuals, Compose screens, state/background, remote APIs, engineering method) is an index of its traps, one line per trap carrying that trap's own description. The 224 trap files moved unchanged into `skills/<area>/references/`: 224 pure renames, no content change. - **`footgun-scan`, a tenth skill.** `scripts/scan.py` matches 32 patterns, each tied to one trap, against the lines a change adds (`--base`, `--all`, `--fail` for CI). The agent then opens the trap to confirm or dismiss each hit. Standard library only, and `--self-test` runs every detector against its own examples. - **`evals/`.** 13 `claude plugin eval` cases, each run with and without the plugin. - **`scripts/build_index.py`.** Refreshes the indexes from the trap files and regenerates `CATALOG.md`. It fails on unlisted, duplicate or missing traps, on dangling cross-references, and on descriptions that strict YAML parsers would reject. - **Clean-up.**   - Removed the internal working notes (`HANDOFF.md`, `raw-*.md`, `pipeline-handoffs/`) and the old catalog's evidence and cut-list sections, which named third-party services.   - Synced the counts: the manifests still said 216.   - Bumped the version to 2.0.0.  ## Why  Claude Code lists every installed skill's name and description on every turn, inside a budget of 1% of the context window (8,000 characters at 200K). T

- **Issue #1** (2026-09-16): **Notification error in Android 10**
  *Symptoms*: **Notification Song Display Bug**  SimpMusic is great overall, but there’s an annoying notification issue. The notification often shows the wrong song, and the displayed song keeps changing repeatedly as if it’s glitching. It rarely shows the song that is actually playing.  This makes the playback notification confusing and unreliable. Please fix the notification song/metadata updating issue in a future update.
  **Post-Mortem & Fix Analysis**:
  > I will check for it, but please make issue in https://github.com/maxrave-dev/SimpMusic/ repo

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

### Incident Patch 1: `e88fb5b4` (2026-09-24)
**Commit Message**: feat: add footgun-scan and a with/without eval suite

footgun-scan is a tenth skill: scripts/scan.py matches 32 patterns, each
tied to one trap, against the lines a change adds (or a whole tree with
--all), and the skill has the agent open that trap to confirm or dismiss
every hit. Standard library only; --self-test runs each detector against
its own hit and miss examples and checks its trap file exists.

Tuned against SimpMusic and its core module: comments are skipped, fades
between Color.Transparent and black, WorkManager's Result.retry(), branch-
separated state writes and test files no longer match, NOT IN became a
`look` (the scanner cannot see nullability), and a volume-ramp detector
was dropped because the recommended fix has the same shape. All 26
remaining `likely` hits there match their trap.

evals/ holds 13 `claude plugin eval` cases: 12 written from trap files and
one unrelated Python task. With the plugin, all 12 pass in 3 of 3 runs and
the right trap is opened 36/36; without it they average 0.56. The four
+1.00 cases are ones where the unaided model names a mechanism that does
not exist. evals/README.md has the table and its caveats.

Also: kmp-architecture-footguns

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     {
       "name": "kotlin-footguns",
       "source": "./",
-      "description": "224 battle-tested traps mapping the footguns of Kotlin, Compose Multiplatform and desktop JVM development, in nine area skills — mined from a production codebase, every claim verified against the real tree.",
+      "description": "224 battle-tested traps mapping the footguns of Kotlin, Compose Multiplatform and desktop JVM development, in nine area skills plus a scanner — mined from a production codebase, every claim verified against the real tree.",
       "category": "engineering",
       "keywords": [
         "kotlin",
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "kotlin-footguns",
   "version": "2.0.0",
-  "description": "224 battle-tested traps mapping the footguns of Kotlin, Compose Multiplatform and desktop JVM development, in nine area skills. Mined from SimpMusic, a production cross-platform app shipping since 2023; traps-first, with verification commands that were executed against the real codebase.",
+  "description": "224 battle-tested traps mapping the footguns of Kotlin, Compose Multiplatform and desktop JVM development, in nine area skills plus a scanner that checks a change against them. Mined from SimpMusic, a production cross-platform app shipping since 2023; traps-first, with verification commands that were executed against the real codebase.",
   "author": {
     "name": "maxrave-dev",
     "url": "https://github.com/maxrave-dev"
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 .omc/
 .DS_Store
 __pycache__/
+evals/results/
```

**File**: `CATALOG.md` (modified, +5/-1)
```diff
@@ -12,11 +12,15 @@ Generated by `scripts/build_index.py` from the area skills: edit those, then re-
 | [`data-layer-footguns`](skills/data-layer-footguns/SKILL.md) | 26 | migrations, NOT IN with NULLs, LIKE escaping, delete order, local-time bucketing, imports, caching, paging |
 | [`desktop-and-build-footguns`](skills/desktop-and-build-footguns/SKILL.md) | 24 | JNA natives, bundling, memory, packaging, code signing, R8, deep links, Gradle and CI releases |
 | [`engineering-method-footguns`](skills/engineering-method-footguns/SKILL.md) | 9 | run the discriminating experiment first, read build logs bottom-up, treat an empty actual as unwritten, audit shared handles before removing a feature, read commit history critically |
-| [`kmp-architecture-footguns`](skills/kmp-architecture-footguns/SKILL.md) | 25 | module splits, expect/actual, Koin and ViewModel scoping, layers, version catalogs, erased overloads, Char limits |
+| [`kmp-architecture-footguns`](skills/kmp-architecture-footguns/SKILL.md) | 25 | module splits, expect/actual, Koin and ViewModel scoping, layers, version catalogs, erased overloads, Char and string-resource formatting limits |
 | [`media-playback-footguns`](skills/media-playback-footguns/SKILL.md) | 33 | crossfade, audio focus, fades, loudness, DSP, queues and shuffle, position restore, service lifecycle, group listening |
 | [`remote-api-footguns`](skills/remote-api-footguns/SKILL.md) | 17 | Ktor clients, defensive parsing, Resource envelopes, OK responses that dropped your data, auth callbacks, retry backoff, downloads, websockets, clock sync |
 | [`state-and-background-footguns`](skills/state-and-background-footguns/SKILL.md) | 23 | StateFlow conflation, flatMapLatest, job lifecycles, ViewModel bases, WorkManager, backups, crash reporting, logging, Glance widgets |
 
+Tool skills, which work across the areas:
+
+- [`footgun-scan`](skills/footgun-scan/SKILL.md) — Scan a Kotlin or Compose Multiplatform diff for known footgun shapes and open the matching trap to confirm each hit. Use before committing, when reviewing a Kotlin change, or to audit a codebase.
+
 ## Compose screens footguns: layout, navigation and interaction
 
 [`compose-screens-footguns`](skills/compose-screens-footguns/SKILL.md) · 32 traps
```

**File**: `README.md` (modified, +35/-8)
```diff
@@ -13,8 +13,8 @@ every lesson in this repository was mined from.
 [![License](https://img.shields.io/badge/License-GPL--3.0-blue)](LICENSE)
 
 224 battle-tested traps mapping the footguns of Kotlin, Compose Multiplatform and desktop JVM
-development, packaged as nine agent skills. Mined from a production codebase, not written from
-documentation.
+development, packaged as nine agent skills plus a scanner that checks a change against them. Mined
+from a production codebase, not written from documentation.
 
 The traps are grouped into nine area skills in the open agent-skills format, readable by Claude
 Code and any coding agent that understands the format — and just as readable by a human. Each
@@ -71,7 +71,8 @@ generic core that applies to whichever API you are consuming.
 | [`engineering-method-footguns`](skills/engineering-method-footguns/SKILL.md) | 9 | Experiments, build logs, commit history, changelogs, removing a feature |
 
 Each area skill lists its traps under headings, each with the description that tells an agent
-when to open it. The whole index on one page is [CATALOG.md](CATALOG.md).
+when to open it. The whole index on one page is [CATALOG.md](CATALOG.md). A tenth skill,
+[`footgun-scan`](skills/footgun-scan/SKILL.md), checks code against the traps (below).
 
 ## Why nine skills and not 224
 
@@ -82,10 +83,36 @@ and lists whatever does not fit by name alone, least-used first. The 224 descrip
 about 124,000 characters and the names alone to 7,500, so at that budget every trap reached the
 agent as a bare name, and so did every other skill the user had installed, their own included.
 
-As nine area skills the listing is about 2,400 characters. The agent loads an area's index when
+As nine area skills plus the scanner the listing is about 2,700 characters. The agent loads an area's index when
 the work touches that area, sees every trap in it at once with the symptom that should send it to
 each one, and opens only the files that apply.
 
+## Scanning a change
+
+`footgun-scan` turns the traps into a check. It matches 32 patterns against the lines a change
+adds; each pattern is tied to one trap, and the agent opens that trap to confirm or dismiss every
+hit. Ask for it in plain words ("check my uncommitted Kotlin changes for footguns"), or run the
+script yourself, for example as a CI step:
+
+```bash
+python3 .claude/skills/footgun-scan/scripts/scan.py --base origin/main --fail
+```
+
+A hit is `likely` when the shape is wrong unless the exception its trap names holds, and `look`
+when it marks a place the trap says to inspect. Over the whole of SimpMusic and its core module the
+scanner raised 26 `likely` hits, and all 26 matched their trap on inspection: 22 vertical slides
+left at their half-height default, two fades from `Color.Transparent` into a colour, and two values
+spliced into migration SQL. The `look` hits are places to read, not verdicts.
+
+## Does it help?
+
+[`evals/`](evals/README.md) holds thirteen `claude plugin eval` cases, each run with the plugin and
+without it. With it, all twelve trap questions passed in every run and the agent opened the right
+trap file every time. Without it they averaged 0.56. On five of them the model already knew the
+lesson. On four it was confidently wrong: it described a Room connection-routing rule and a
+resource formatter that do not exist. The full table and its caveats are in
+[evals/README.md](evals/README.md).
+
 ## Anatomy of a trap
 
 Every trap file follows the same discipline:
@@ -105,7 +132,7 @@ agent will not load in context.
 The area indexes and CATALOG.md are generated: after adding or editing a trap, run
 `python3 scripts/build_index.py`. It refreshes every index line from the trap's own description,
 fails if a file is unlisted, listed twice or missing, or if a cross-reference names a trap that
-does not exist, and reports how much of the listing budget the nine skills take. Add `--check`
+does not exist, and reports how much of the listing budget the skills take. Add `--check`
 to verify without writing.
 
 ## How the corpus was verified
@@ -159,12 +186,12 @@ Updates arrive with `/plugin marketplace update maxrave`.
 npx skills@latest add maxrave-dev/kotlin-footguns
 ```
 
-The installer lets you pick which of the nine area skills to take and which agents to install
-them for — Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini and others. The files land in
+The installer lets you pick which of the ten skills (nine areas and the scanner) to take and which
+agents to install them for — Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini and others. The files land in
 your repository as ordinary markdown you own and can edit; nothing updates behind your back.
 Pull newer versions when you want them with `npx skills update`.
 
-Either way, only the nine area descriptions sit in the agent's context on every turn. An area's
+Either way, only ten short descriptions sit in the agent's context on every turn. An area's
 index 
```

**File**: `evals/README.md` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+# Evals
+
+Thirteen cases for `claude plugin eval`: twelve questions a Kotlin developer might ask, each written
+from one trap file, plus one unrelated Python task that checks the plugin stays out of work that is
+not its own. Every case runs twice, with the plugin and without it, and the difference is the
+measure of what the corpus adds.
+
+```bash
+claude plugin eval . --runs 3 -j 6 --judge-model claude-sonnet-5
+claude plugin eval . --case vacuum-readonly --runs 1     # one case, one run per arm
+```
+
+Each trap case carries one scored grader and two indicators:
+
+- `names-the-mechanism-and-fix` (scored, both arms): an LLM judge checks that the answer names the
+  mechanism the trap describes and prescribes its fix. The criteria come from the trap file.
+- `plugin-fired` and `opened-the-trap` (plugin arm only, not scored): did the agent load the area
+  skill, and did it open the right trap file?
+
+Use a Sonnet judge. In the first trial the default judge failed a baseline answer that was
+substantially correct, which would have inflated the difference.
+
+## Results
+
+Run on 2026-09-24 with Claude Code 2.1.281, three runs per arm and a `claude-sonnet-5` judge. The
+agent under test was the session's default model. Cost: about $11 for the whole suite.
+
+| Case | Trap | With | Without | Δ |
+|---|---|---|---|---|
+| `joiner-starts-behind` | `joiner-catches-up-by-asking` | 1.00 | 0.00 | +1.00 |
+| `spinner-over-playing-audio` | `stateflow-conflation-inverts-state` | 1.00 | 0.00 | +1.00 |
+| `vacuum-readonly` | `room-rawquery-readonly-vacuum` | 1.00 | 0.00 | +1.00 |
+| `format-specifier-verbatim` | `string-resource-format-limits` | 1.00 | 0.00 | +1.00 |
+| `service-stops-between-tracks` | `fgs-state-ended-trap` | 1.00 | 0.33 | +0.67 |
+| `finder-path-lost` | `macos-lsenvironment-path-pin` | 1.00 | 0.67 | +0.33 |
+| `slide-in-pops` | `slide-transition-defaults-to-half-a-height` | 1.00 | 0.67 | +0.33 |
+| `double-inset-band` | `stacked-bars-double-consume-window-insets` | 1.00 | 1.00 | 0 |
+| `first-period-delta` | `delta-absent-not-infinite` | 1.00 | 1.00 | 0 |
+| `not-in-null-control` | `sql-not-in-nullable-trap` | 1.00 | 1.00 | 0 |
+| `ok-but-discarded` | `api-ok-but-ignored` | 1.00 | 1.00 | 0 |
+| `slider-thumb-pinned` | `control-range-must-cover-stored-values` | 1.00 | 1.00 | 0 |
+| `unrelated-python-task` | none | 1.00 | 1.00 | 0 |
+
+With the plugin, every trap case passed all three runs, the agent opened the right trap file in 36
+of 36 runs, and the plugin stayed out of the Python task in 3 of 3. Without it, the mean score on the
+twelve trap cases was 0.56.
+
+What the table says, and what it does not:
+
+- Five traps are ones the model already knows: its answers there are as good without the plugin.
+  `not-in-null-control` was chosen as such a control.
+- The four +1.00 cases are where the model, unaided, is confidently wrong. Its answers name a
+  plausible but false mechanism: Room routing raw queries by return type, for example, or a
+  compose-resources formatter that handles `%02d` and `%%`. The library's own source says
+  otherwise. Its `StringResourcesUtils.kt` replaces only `Regex("""%(\d+)\$[ds]""")`.
+- The cases were written from the traps, so they measure whether the corpus delivers its own
+  lessons. They are not a sample of everyday Kotlin questions. Three runs per arm and an LLM judge
+  make each score a signal, not a benchmark.
+- `format-specifier-verbatim` and `slide-in-pops` were rerun after fixes: the area description had
+  lost the words that route string-resource questions to it, and a criterion demanded the exact
+  default lambda. The table shows the rerun.
```

**File**: `evals/double-inset-band/case.yaml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# One eval case per trap it names; see evals/README.md.
+schema_version: "1.1"
+name: double-inset-band
+description: Should lead to stacked-bars-double-consume-window-insets in compose-screens-footguns.
+tags: [compose, trap]
+execution:
+  prompt: |
+    Our Compose screen has a Column with our main TopAppBar and, only in selection mode, a second
+    Material 3 TopAppBar below it for selection actions. Both use their default windowInsets. In
+    selection mode a band of empty space exactly as tall as the status bar appears between the two
+    bars. Why, and what is the right fix?
+  max_turns: 8
+  timeout_seconds: 300
+  allowed_tools: [Skill, Read, Glob, Grep]
+runs: 3
+graders:
+  - type: llm
+    name: names-the-mechanism-and-fix
+    criteria: |
+      Pass only if the response does BOTH:
+      1. Explains that each bar applies the status-bar (window) insets independently: inset consumption
+         only propagates to a composable's descendants, not to its siblings, so the lower bar reserves the
+         status bar a second time.
+      2. Fixes it by deciding a single consumer, for example passing windowInsets = WindowInsets(0) to the
+         lower bar or having the container consume the insets once, and does NOT recommend cancelling the
+         gap with a negative offset or hardcoded padding.
+  - type: tool_used
+    name: plugin-fired
+    tool: Skill
+    input_match: compose-screens-footguns
+    arm: with-only
+  - type: tool_used
+    name: opened-the-trap
+    tool: Read
+    input_match: stacked-bars-double-consume-window-insets
+    arm: with-only
```

**File**: `evals/finder-path-lost/case.yaml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# One eval case per trap it names; see evals/README.md.
+schema_version: "1.1"
+name: finder-path-lost
+description: Should lead to macos-lsenvironment-path-pin in desktop-and-build-footguns.
+tags: [desktop, trap]
+execution:
+  prompt: |
+    Our packaged macOS Compose Desktop app shells out to ffmpeg that users install with Homebrew. It
+    works when the app is started from a terminal, but when opened from Finder or the Dock the call
+    fails with "command not found". Last release we added an environment variable to the app bundle's
+    Info.plist. Why is this happening, and how should we fix it?
+  max_turns: 8
+  timeout_seconds: 300
+  allowed_tools: [Skill, Read, Glob, Grep]
+runs: 3
+graders:
+  - type: llm
+    name: names-the-mechanism-and-fix
+    criteria: |
+      Pass only if the response does BOTH:
+      1. Identifies that declaring an LSEnvironment dictionary in Info.plist pins the launched process's
+         PATH to the bare system directories (/usr/bin:/bin:/usr/sbin:/sbin), so Homebrew locations such
+         as /opt/homebrew/bin and /usr/local/bin are missing for every spawned process.
+      2. Recommends resolving the tool by absolute path (or setting PATH explicitly in the spawned
+         process's environment), and auditing every external process the app spawns before adding
+         LSEnvironment.
+  - type: tool_used
+    name: plugin-fired
+    tool: Skill
+    input_match: desktop-and-build-footguns
+    arm: with-only
+  - type: tool_used
+    name: opened-the-trap
+    tool: Read
+    input_match: macos-lsenvironment-path-pin
+    arm: with-only
```

#### Recent Merged Pull Requests:
- **PR #2** (2026-09-25): v2.0.0: nine area skills, footgun-scan and a with/without eval suite (@maxrave-dev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
