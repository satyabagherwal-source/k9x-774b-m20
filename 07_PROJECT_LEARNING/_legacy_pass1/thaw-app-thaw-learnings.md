# Forensic Learning Record (Deep Inspection): thaw-app/Thaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:59:55.450Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thaw-app/Thaw`
- **Description**: The open source menu bar manager
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11666 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/coverage-report.py`
```
#!/usr/bin/env python3
"""Report local code coverage using the same denominator SonarCloud uses.

Usage:
    scripts/coverage-report.py [xcresult-path] [--top N] [--json]

Reads an .xcresult bundle with `xcrun xccov`, then applies `sonar.sources` and
`sonar.coverage.exclusions` from sonar-project.properties so the number printed
here is comparable to the one on SonarCloud.

Without the exclusions the raw xccov figure is far lower (it counts every
SwiftUI view and WindowServer wrapper in the app), which makes it useless as a
progress gauge against a Sonar target. Coverage measured on the excluded set is
what the quality gate reports.

xcresult-path defaults to the newest bundle under Build/Logs/Test.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROPERTIES = REPO_ROOT / "sonar-project.properties"


def read_property(name: str) -> list[str]:
    """Return the comma-separated values of a (possibly line-continued) key."""
    text = PROPERTIES.read_text(encoding="utf-8")
    # Join backslash continuations so multi-line lists parse as one value.
    text = text.replace("\\\n", " ")
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        if key.strip() == name:
            return [v.strip() for v in value.split(",") if v.strip()]
    return []


def is_excluded(path: str, patterns: list[str]) -> bool:
    """Match a repo-relative path against Sonar's glob syntax."""
    for pattern in patterns:
        # Sonar treats a bare `dir/*.swift` as non-recursive and `**` as
        # recursive; fnmatch's `*` crosses `/`, so match those patterns by
        # hand and only accept files directly beneath the directory.
        if pattern.endswith("/*.swift") and "**" not in pattern:
            prefix = pattern[: -len("*.swift")]
            if (path.startswith(prefix)
                    and path.endswith(".swift")
                    and "/" not in path[len(prefix):]):
                return True
        elif fnmatch.fnmatch(path, pattern):
            return True
    return False


def newest_xcresult() -> Path:
    candidates = sorted(
        (REPO_ROOT / "Build" / "Logs" / "Test").glob("*.xcresult"),
        key=lambda p: p.stat().st_mtime,
    )
    if not candidates:
        sys.exit(
            "error: no .xcresult under Build/Logs/Test -- run the test suite first:\n"
            "  xcodebuild test -project Thaw.xcodeproj -scheme Thaw "
            "-destination 'platform=macOS' -derivedDataPath Build/ -enableCodeCoverage YES"
        )
    return candidates[-1]


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "xcresult_path",
        nargs="?",
        type=Path,
        default=None,
        help="path to the .xcresult bundle (default: newest under Build/Logs/Test)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=30,
        help="number of files to list in the text report (default: 30)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="emit JSON instead of the text report",
    )
    return parser.parse_args(argv[1:])


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    top = args.top
    as_json = args.as_json

    bundle = args.xcresult_path if args.xcresult_path else newest_xcresult()

    raw = subprocess.run(
        ["xcrun", "xccov", "view", "--report", "--json", str(bundle)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    report = json.loads(raw)

    sources = tuple(s.rstrip("/") + "/" for s in read_property("sonar.sources"))
    exclusions = read_property("sonar.coverage.exclusions")
    if not sources:
        sys.exit("error: sonar.sources missing from sonar-project.properties")

    # Files under Shared/ are compiled into both the app and the XPC service, so
    # xccov reports them once per target. Sonar counts each source file once, so
    # keep the best result per path -- a line covered by either target is covered.
    best: dict[str, dict] = {}
    excluded_files = 0
    for target in report.get("targets", []):
        for entry in target.get("files", []):
            path = entry["path"]
            # xccov reports absolute paths; make them repo-relative.
            marker = str(REPO_ROOT) + "/"
            path = path[len(marker):] if path.startswith(marker) else path
            if not path.startswith(sources):
                continue
            if is_excluded(path, exclusions):
                excluded_files += 1
                continue
            lines = entry["executableLines"]
            covered = entry["coveredLines"]
            previous = best.get(path)
            if previous is None or covered > previous["covered"]:
                best[path] = {
                    "path": path,
                    "lines": lines,
                    "covered": covered,
                    "uncovered": lines - covered,
                    "coverage": round(100 * covered / lines, 1) if lines else 100.0,
                }

    rows = list(best.values())
    total_lines = sum(r["lines"] for r in rows)
    total_covered = sum(r["covered"] for r in rows)

    if not total_lines:
        sys.exit("error: no measurable lines found -- check sonar.sources vs xccov paths")

    coverage = 100 * total_covered / total_lines
    rows.sort(key=lambda r: r["uncovered"], reverse=True)

    if as_json:
        print(json.dumps({"coverage": coverage, "files": rows}, indent=2))
        return 0

    # 90% is the project target; report the gap in lines, which is the unit
    # the work is actually done in.
    to_ninety = max(0, (total_lines - total_covered) - int(0.10 * total_lines))
    print(f"bundle:   {bundle.name}")
    print(f"files:    {len(rows)} measured, {excluded_files} excluded by sonar")
    print(f"lines:    {total_lines} measurable, {total_covered} covered, "
          f"{total_lines - total_covered} uncovered")
    print(f"COVERAGE: {coverage:.2f}%")
    print(f"to 90%:   cover {to_ninety} more lines")
    print()
    print(f"{'uncov':>6} {'cov%':>7} {'lines':>6}  path")
    for row in rows[:top]:
        print(f"{row['uncovered']:>6} {row['coverage']:>7} {row['lines']:>6}  {row['path']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

```

### Core Architecture Module: `scripts/generate-credits.py`
```
#!/usr/bin/env python3
"""Generate CREDITS.md from a Crowdin top-members CSV export.

Usage:
    scripts/generate-credits.py path/to/Thaw.top_members.report.csv

Export the CSV from Crowdin: Project -> Reports -> Top Members -> Export.

Members with zero translated words are skipped. The overrides below carry
corrections that the export cannot express; keep them up to date, because a
fresh export will otherwise silently drop them.
"""

import collections
import csv
import io
import sys
from pathlib import Path

# Overrides

# Restrict a member to specific source languages (Crowdin names).
ONLY = {
    "René (diazdesandi)": {"Spanish"},
}

# Replace a member's display name.
RENAME = {
    "REMOVED_USER": "Anonymous (account deleted)",
}

# Collapse pathological display names to their handle.
def normalize_name(name: str) -> str:
    if name.count("᥮") > 5:
        return "wlo2"
    return RENAME.get(name, name)

# People who contribute but do not appear in the members export, e.g. project
# owners and managers, whose activity Crowdin records separately.
EXTRA = {
    "Deutsch": ["Toni Forster (stonerl)"],
}

# Language mapping

LANGUAGES = {
    "Indonesian": ("🇮🇩", "Bahasa Indonesia"),
    "Czech": ("🇨🇿", "Čeština"),
    "German": ("🇩🇪 🇦🇹", "Deutsch"),
    "Spanish": ("🇪🇸 🇲🇽", "Español"),
    "French": ("🇫🇷", "Français"),
    "Italian": ("🇮🇹", "Italiano"),
    "Hungarian": ("🇭🇺", "Magyar"),
    "Dutch": ("🇳🇱 🇧🇪", "Nederlands"),
    "Polish": ("🇵🇱", "Polski"),
    "Brazilian": ("🇧🇷", "Português (Brasil)"),
    "Portuguese": ("🇧🇷", "Português (Brasil)"),
    "Turkish": ("🇹🇷", "Türkçe"),
    "Russian": ("🇷🇺", "Русский"),
    "Ukrainian": ("🇺🇦", "Українська"),
    "Thai": ("🇹🇭", "ภาษาไทย"),
    "Vietnamese": ("🇻🇳", "Tiếng Việt"),
    "Japanese": ("🇯🇵", "日本語"),
    "Korean": ("🇰🇷", "한국어"),
    "Chinese Simplified": ("🇨🇳", "简体中文"),
    "Chinese Traditional": ("🇹🇼", "正體中文"),
}

# Display order, matching the README's Languages table.
ORDER = [
    "Bahasa Indonesia", "Čeština", "Deutsch", "Español", "Français",
    "Italiano", "Magyar", "Nederlands", "Polski", "Português (Brasil)",
    "Türkçe", "Русский", "Українська", "ภาษาไทย", "Tiếng Việt",
    "日本語", "한국어", "简体中文", "正體中文",
]

FLAGS = {native: flag for flag, native in LANGUAGES.values()}


def words(row, key):
    try:
        return int((row.get(key) or "0").replace(",", "") or 0)
    except ValueError:
        return 0


def collect(csv_path):
    rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
    by_language = collections.defaultdict(set)

    for row in rows:
        if words(row, "Translated (Words)") <= 0:
            continue
        raw = row["Name"].strip()
        langs = [
            part.strip()
            for chunk in row["Languages"].split(";")
            for part in chunk.split(",")
            if part.strip()
        ]
        if raw in ONLY:
            langs = [lang for lang in langs if lang in ONLY[raw]]
        for lang in langs:
            if lang in LANGUAGES:
                by_language[LANGUAGES[lang][1]].add(normalize_name(raw))

    for native, people in EXTRA.items():
        by_language[native].update(people)

    return by_language


def render(by_language):
    out = io.StringIO()
    out.write("# Credits\n\n")
    out.write("Thaw is translated by volunteers on "
              "[Crowdin](https://crowdin.com/project/thaw).\n")
    out.write("Everyone below has contributed translated strings to the app.\n\n")
    out.write("Want to join them, or spotted a translation that could be better?\n")
    out.write("[Translate Thaw on Crowdin](https://crowdin.com/project/thaw) — "
              "you can request\nnew languages there too.\n\n")
    out.write("## Translators\n\n")
    out.write("Listed alphabetically within each language, not by volume.\n\n")

    for native in ORDER:
        people = sorted(by_language.get(native, ()), key=str.casefold)
        if not people:
            continue
        out.write(f"### {FLAGS[native]} {native}\n\n")
        for person in people:
            out.write(f"- {person}\n")
        out.write("\n")

    out.write("---\n\n")
    out.write("Names are Crowdin display names, taken from the project's "
              "top-members\nreport. To have yours changed or removed, open an "
              "issue or say so on\n[Discord](https://discord.gg/5cnKkKbMFd).\n")
    return out.getvalue()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    by_language = collect(sys.argv[1])
    target = Path(__file__).resolve().parent.parent / "CREDITS.md"
    target.write_text(render(by_language), encoding="utf-8")
    people = {person for group in by_language.values() for person in group}
    print(f"wrote {target.name}: {len(people)} people, "
          f"{sum(1 for l in ORDER if by_language.get(l))} languages")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/normalize-coverage.py`
```
#!/usr/bin/env python3
"""Rewrite xcresultparser coverage paths so SonarQube can resolve them.

Usage:
    scripts/normalize-coverage.py coverage.xml [workspace-root]

xcresultparser emits absolute paths from the macOS runner
(/Users/runner/work/Thaw/Thaw/...), but the Sonar scan runs on a Linux runner
with a different workspace root. Sonar matches coverage entries against source
files by path, so every entry silently fails to resolve and the project lands
at 0% coverage -- both overall and on new code.

This rewrites every <file path="..."> to a repo-relative path and drops entries
that live outside the repo (DerivedData, SPM checkouts), which Sonar has no
sources for. The file is edited in place.

workspace-root defaults to $GITHUB_WORKSPACE, then to the repo root inferred
from this script's location.
"""

from __future__ import annotations

import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Path segments that mark a build artifact rather than a repo source file.
# xcresultparser reports coverage for SPM dependencies compiled into the test
# host; those are not in sonar.sources and only add noise.
ARTIFACT_MARKERS = ("/Build/", "/DerivedData/", "/.build/", "/SourcePackages/")


def repo_relative(path: str, roots: list[str]) -> str | None:
    """Return `path` relative to the first matching root, or None to drop it."""
    if any(marker in path for marker in ARTIFACT_MARKERS):
        return None
    if not path.startswith("/"):
        return path  # already relative
    for root in roots:
        prefix = root.rstrip("/") + "/"
        if path.startswith(prefix):
            return path[len(prefix) :]
    return None


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    report = Path(argv[1])
    if len(argv) > 2:
        workspace = argv[2]
    else:
        workspace = os.environ.get("GITHUB_WORKSPACE") or str(
            Path(__file__).resolve().parent.parent
        )

    tree = ET.parse(report)
    root = tree.getroot()

    # The macOS runner checks out to /Users/runner/work/<repo>/<repo> while the
    # Linux runner uses /home/runner/work/<repo>/<repo>, so accept either.
    tail = "/".join(Path(workspace).parts[-2:])
    roots = [workspace, f"/Users/runner/work/{tail}", f"/home/runner/work/{tail}"]

    kept = 0
    dropped = 0
    for element in list(root.findall("file")):
        path = element.get("path", "")
        relative = repo_relative(path, roots)
        if relative is None:
            root.remove(element)
            dropped += 1
        else:
            element.set("path", relative)
            kept += 1

    if kept == 0:
        print(
            f"error: no coverage entries resolved under {workspace}; "
            "refusing to write an empty report",
            file=sys.stderr,
        )
        return 1

    tree.write(report, encoding="utf-8", xml_declaration=True)
    print(f"normalized {report}: kept {kept} files, dropped {dropped}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1116** (2026-09-14): **[Bug] Sort A->Z does nothing for hidden and always-hidden sections**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read the tracking issue first  ### Problem / Use Case  The "Sort A to Z" button in Settings, Menu Bar Layout writes the sorted order to the active profile, but for the **hidden** and **always-hidden** sections the menu bar never reorders. The sort persists to disk and nothing moves on the bar. The **visible** section sorts correctly.  ### Steps to reproduce  1. Put several items in the hidden section in a non-alphabetical order. 2. Open Settings, Menu Bar Layout. 3. Click "Sort A to Z" on the hidden section heading.  ### Expected behavior  The hidden section's items reorder alphabetically on the bar.  ### Actual behavior  Nothing moves. The on-disk profile carries the sorted order, but the bar keeps its previous order.  ### Thaw version  2.1.0-beta.2  ### macOS version  26  ### Display setup  Single display  ### Anything else?  The sort calls `applyProfileLayout`, which by default relaxes concealed-section order (`enforceConcealedSectionOrder` defaults to false, no user toggle). `relaxConcealedSectionOrder` rewrites the desired order back to the current order, so the LCS plans zero moves. Visible is not relaxed, so it sorts fine. The relaxation is intentional for background work (it avoids hijacking the cursor to reorder items parked off-screen), but an explicit user sort needs to opt out of it for that one pass. 
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi @diazdesandi! Thanks for opening this issue.  To help us investigate, could you please add one piece of evidence for the bug, such as a diagnostic log, screenshot, or short screen recording showing the hidden or always-hidden section staying in its previous order after using Sort A to Z?  Once we have that, we can take a closer look. Thanks!  > Generated by [Issue Triage](https://github.com/thaw-app/Thaw/actions/runs/34862964877) for #1116 · copilot · gpt54 · 13 AIC · ⌖ 5.95 AIC · ⊞ 20.3K · [◷](https://github.com/search?q=repo%3Athaw-app%2FThaw+%22gh-aw-workflow-call-id%3A+thaw-app%2FThaw%2Fissue-triage%22&type=issues)  <!-- gh-aw-agentic-workflow: Issue Triage, engine: copilot, model: gpt-5.4, id: 34862964877, workflow_id: issue-triage, run: https://github.com/thaw-app/Thaw/actions/runs/34862964877 --> <!-- gh-aw-workflow-call-id: thaw-app/Thaw/issue-triage -->

- **Issue #899** (2026-08-15): **[Bug] RC2.1 destroys my cursor moves**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  After switching from rc 2.0 und rc 2.1 the space between the icons is set to Standard and I have no chance to reduce this back. But on my macOS 26.6 I can´t use the new release because the cursor is moving unmotivated, went big and smal sometimes I see 3 ones - activating the log was a challenge:-)  I´m back on rc 2.0 :-(  ### Steps to Reproduce  brew upgrade Start thaw and see the problem  ### Expected Behavior  should be good  ### App Version  rc 2.1  ### macOS Version  26.6  ### Display Setup  Single monitor  ### Logs / Console Output  [thaw_2026-08-06_14-03-56.log](https://github.com/user-attachments/files/30792643/thaw_2026-08-06_14-03-56.log)  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, I am looking into it, it's likely a duplicate of #895 , closing it until it's clear
  > Thank you very much - I'm not sure about the duplicate - for me the description of 895 is very complicated - I can't follow that - but if you think and maybe my log will help, then I'll try again when 895 is fixed :-)  Thank you for the great work!
  > Can you try https://github.com/thaw-app/Thaw/actions/runs/31127665694/artifacts/8974810339 ?

- **Issue #898** (2026-08-30): **[Bug]  自动移动问题**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  https://github.com/user-attachments/assets/c91b25a8-44b7-4e17-89f8-db449810434a 这样正常吗。   BTW：  我自己开发的qbmiller/xxmac  menu icon死活显示不出来[忽然这样的]，别人电脑ok。 各种debug 都没能解决。 issue那 https://github.com/qbmiller/xxMac/blob/main/docs/menu-bar-status-item-troubleshooting.md  求教macos大佬   ### Steps to Reproduce  1. 就是眼镜  vs 竖杠  。 它俩问题  ### Expected Behavior  1  ### App Version  latest  ### macOS Version  26.6  ### Display Setup  Single monitor  ### Logs / Console Output  [config.json](https://github.com/user-attachments/files/30770484/config.json)  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 👋 方便我们排查的话,还需要补充:  - 期望结果(你希望自动移动后是什么表现) - 实际结果(现在实际发生了什么) - 更精确的复现步骤 - 具体 Thaw 版本号(`latest` 不够)  你这里已经提供了 macOS 26.6;如果问题涉及某个第三方菜单栏图标,也请说明是哪一个 app。    > Generated by [Issue Triage](https://github.com/thaw-app/Thaw/actions/runs/31068428183) for #898 · gpt50mini · 7.25 AIC · ⌖ 1.85 AIC · ⊞ 16.9K · [◷](https://github.com/search?q=repo%3Athaw-app%2FThaw+%22gh-aw-workflow-call-id%3A+thaw-app%2FThaw%2Fissue-triage%22&type=issues)  <!-- gh-aw-agentic-workflow: Issue Triage, engine: copilot, version: 1.0.71, model: gpt-5-mini, id: 31068428183, workflow_id: issue-triage, run: https://github.com/thaw-app/Thaw/actions/runs/31068428183 --> <!-- gh-aw-workflow-call-id: thaw-app/Thaw/issue-triage -->

- **Issue #893** (2026-08-05): **[Bug] The icons are grayed out**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  The icons are grayed out.   ### Steps to Reproduce  Open the **Layout** menu.   ### Expected Behavior  The icons are white (I think?).   ### App Version  Version 2.0.0-rc.2 (47)  ### macOS Version  26  ### Display Setup  Multiple monitors  ### Logs / Console Output  [thaw_2026-08-05_21-35-14.log](https://github.com/user-attachments/files/30759233/thaw_2026-08-05_21-35-14.log)  ### Additional Context  <img width="955" height="372" alt="Image" src="https://github.com/user-attachments/assets/151449da-1807-4263-afe2-93860d8cfb43" />
  **Post-Mortem & Fix Analysis**:
  > Fixed on rc2.1 that was released 9 hours ago.
  > > Fixed on rc2.1 that was released 9 hours ago.  I'm on it. Sorry, I missed the version in the description: **Version 2.0.0-rc.2 (47)**. 
  > Version 2.0.0-rc.2.1(49), this issue was the reason of the hotfix.

- **Issue #890** (2026-08-15): **[Bug] Section divider preferred positions can never be written: ControlItemDefaults setter discards preflightSetup and resetChevronPositions**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read #687 and this report is a specific new bug not already covered there (or this is not about macOS 27) - [x] I'm using the latest app version  ### What happened?  `ControlItemDefaults`'s subscript setter refuses to write a preferred position for either section divider. `preflightSetup(for:)` and `resetChevronPositions()` both try to do exactly that, so all of their writes are discarded. The hidden divider never gets the position the code intends to give it.  In `ControlItem.swift` at `54345d40`:  ```swift static subscript<Value>(key: Key<Value>, autosaveName: String) -> Value? {     set {         // Prevent saving preferred position for section divider chevrons         if key.isPreferredPosition, isSectionDivider(autosaveName: autosaveName) {             return         }         ...     } }  static func isSectionDivider(autosaveName: String) -> Bool {     autosaveName == ControlItem.Identifier.hidden.rawValue ||         autosaveName == ControlItem.Identifier.alwaysHidden.rawValue } ```  Three write sites route through that setter and are silently dropped:  ```swift // preflightSetup(for:) — dropped case .hidden:     ControlItemDefaults[.preferredPosition, autosaveName] = 1  // preflightSetup(for:), under "Always reset section divider positions to defaults" — dropped if isSectionDivider(autosaveName: autosaveName) {    
  **Post-Mortem & Fix Analysis**:
  > sup @lathe-agent-oa, try this one https://github.com/thaw-app/Thaw/actions/runs/31034915661/artifacts/8942372634
  > Tested the artifact from run 31034915661 (commit `9c82211`, DMG sha256 `8ec600ad…`) on the machine this issue was filed from. Same display setup as the issue body; the bar was healthy when the test started: dividers seeded at Visible=198 / Hidden=1051 / AlwaysHidden=6105, saved layout 64 visible / 46 hidden / 12 always-hidden, on-screen `visible=14, hidden=10, alwaysHidden=0`.  **Result: this build rewrites the divider geometry destructively on this bar. Deterministic, 2 of 2 clean launches.**  Within ~35 seconds of each launch:  1. The Hidden divider's preferred position went from 1051 to **193**, with the Visible divider at 160 — 33 pt of visible span on a bar whose saved layout has 64 visible items. Nearly everything reclassified as hidden: on-screen went to `visible=4, hidden=20`. 2. A save then persisted the drain: 64/46/12 → **42/52/12**. The zero-width gates never fired — 160/193 is not zero width, so from the gate's point of view the geometry is legitimate. 3. No log line recor

- **Issue #885** (2026-08-15): **[Bug] Hidden section order is permuted by a bulk apply while its membership stays correct**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read #687 and this report is a specific new bug not already covered there (or this is not about macOS 27) - [x] I'm using the latest app version  ### What happened?  The saved order of the hidden section was scrambled while its membership stayed correct. Every count-based check passes, so nothing surfaces it: the section holds the right items, and only their sequence is wrong.  Measured against a known-good `MenuBarItemManager.savedSectionOrder` captured before the incident:  ``` visible       good=64  cur=64  order identical hidden        good=46  cur=47  order identical = NO alwaysHidden  good=12  cur=12  order identical ```  Over the 46 items common to both, **all 46 sit at a different index. None retains its original position.** It is close to an inversion without being one: mean deviation from a perfect reversal is 9.3 positions (14 of 46 within ±3), against 22.3 from the original order (0 of 46 within ±3).  This is not the #868 collapse and not an identity-resolution failure. On this run the #876 gate had nothing to refuse — zero `hidden section has zero width` refusals — and identity resolution was clean, `25 valid, 0 invalid (filtered), 0 couldn't find section`. The divider geometry was healthy throughout.  The trigger was an app creating a **second** status item. Fluid already had `com.FluidApp.app:Item-0` in alw
  **Post-Mortem & Fix Analysis**:
  > Update to get 2.0.0-rc.2.1 @lathe-agent-oa 
  > Follow-up from repairing the layout described above. The repair worked, and it surfaced something about #876 that matters more than the ordering bug: the gate has no recovery path.  ## What I did  Quit the app, restored the known-good `MenuBarItemManager.savedSectionOrder` with `defaults import`, relaunched. The saved order came back correct — all three sections byte-identical to the pre-incident copy.  ## What happened on relaunch  Both clean launches came up with the dividers collapsed, and every gate did exactly what it was built to do:  ``` 06:54:42.835 [WARNING] Skipping saveSectionOrder; hidden section has zero width between the dividers              (hidden.minX=-3870.0, alwaysHidden.maxX=-3870.0) 06:54:51.761 [WARNING] applySavedLayout: skipping (windowID change); hidden section has zero width 06:55:34.102 [WARNING] applySavedLayout: skipping (windowID change); hidden section has zero width ```  On-screen state while that held:  ``` Updated menu bar item cache: visible=14, hidd

- **Issue #884** (2026-08-05): **[Bug] Intentionally left blank as the github action workflow is broken**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  Intentionally left blank as the github action workflow is broken   ### Steps to Reproduce  Intentionally left blank as the github action workflow is broken   ### Expected Behavior  Intentionally left blank as the github action workflow is broken   ### App Version  Intentionally left blank as the github action workflow is broken   ### macOS Version  Intentionally left blank as the github action workflow is broken   ### Display Setup  Single monitor  ### Logs / Console Output  [openai.png](https://github.com/user-attachments/assets/5fb70b13-6953-42f9-b78e-953f3ec0e376)  ### Additional Context  _No response_

- **Issue #882** (2026-08-08): **[Bug] Issue triage workflow closes issues for P0 regressions in RC2 (as duplicates of old closed issues)**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  The automated issue-triage workflow is closing new bug reports against the current rc2 as duplicates of older issues, that have already been closed as completed.  ### Steps to Reproduce  1. See a bug in rc2 2. Report the issue 3. Get github action bot closing the issue, pointing to a closed issue  ### Expected Behavior  The new issue should not be closed. For that matter, the old issue shouldn't be closed prematurely before proper testing anyways  If the bot finds a possible related CLOSED issue, it should just leave a comment. Someone filing a bug on a closed issue is a sign that something has gone wrong! If the *closed* issue is "reactor failure at chernobyl", and someone files a new issue "reactor failure in xxxxx", you want to leave the new issue open since the previous one is closed! Matching to closed issues in the prompt of the workflow is insane.   ### App Version  irrelevant, go fix your .github/workflows  ### macOS Version  irrelevant  ### Display Setup  Single monitor  ### Logs / Console Output  [openai.png](https://github.com/user-attachments/assets/1cf0547a-86d4-4b1a-8c7f-53653b5b10b3)  ### Additional Context  For example:  #881 reports the mouse cursor disappearing and jumping to the top-right while running 2.0.0-rc.2. The workflow closed it as
  **Post-Mortem & Fix Analysis**:
  > It's an agent, lmao. Going to update it; it was set up to close issues before we required log files for them.
  > > irrelevant, go fix your .github/workflows  Fix would be in https://github.com/thaw-app/Thaw/blob/development/.github/workflows/issue-triage.md

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

### Incident Patch 1: `3baafa5b` (2026-09-27)
**Commit Message**: feat(menubar): move circuit breaker, #1190 drop fix, beta updates on macOS 27, and codebase cleanup (#1192)

* feat(menubar): let opened items stay a set time after their menu closes

A hidden item opened from search or the Thaw Bar went back to its section as soon as its menu closed. A single mis-click outside the menu therefore sent the item straight back, and using the same item a few times in a row meant searching for it again every time.

The new "Hide opened items again after" setting under General, After revealing, keeps the item in the menu bar for up to 30 seconds. The delay counts from the moment the menu closes, and reopening the menu restarts it. It defaults to 0 so the current behaviour is unchanged. The value is saved in profiles, reset with the other settings, reachable through settings search and settings URLs, and profiles written before it existed still load.

Closes #342

Signed-off-by: René Jiménez <diazdesandi@proton.me>

* docs(changelog): add the hide-again delay to 2.1.0-beta.6

Starts the 2.1.0-beta.6 section with the new setting for how long an opened item stays in the menu bar after its menu closes.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

* 

**File**: `.swiftformat` (modified, +4/-2)
```diff
@@ -14,8 +14,10 @@
 # --trailing-commas always: Matches 'trailing_comma: mandatory_comma: true'.
 --trailing-commas always
 
-# --header: Matches 'file_header' rule.
---header "//\n//  {file}\n//  Project: Thaw\n//\n//  Copyright (Ice) © 2023–2025 Jordan Baird\n//  Copyright (Thaw) © 2026 Toni Förster\n//  Licensed under the GNU GPLv3"
+# --header ignore: SwiftLint's 'file_header' rule checks the header. The Ice
+# line belongs only on files that still contain Jordan Baird's code, so a single
+# literal template here would stamp it back onto every file.
+--header ignore
 
 # --enable isEmpty: Opt-in rule to match SwiftLint's 'empty_count'.
 --enable isEmpty
```

**File**: `.swiftlint.yml` (modified, +2/-2)
```diff
@@ -61,8 +61,8 @@ file_header:
     //  SWIFTLINT_CURRENT_FILENAME
     //  Project: Thaw
     //
-    //  Copyright \(Ice\) © 2023–2025 Jordan Baird
-    //  Copyright \(Thaw\) © 2026 Toni Förster
+    (//  Copyright \(Ice\) © 2023–2025 Jordan Baird
+    )?//  Copyright \(Thaw\) © 2026 Toni Förster
     //  Licensed under the GNU GPLv3
 
 modifier_order:
```

**File**: `CHANGELOG.md` (modified, +21/-0)
```diff
@@ -7,6 +7,27 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
+## [2.1.0-beta.6] - 2026-09-26
+
+**macOS 26 only**
+
+Thaw stops rearranging your menu bar in a loop, drops into Always Hidden stay put, and macOS 27 users are pointed at the right update channel.
+
+### New
+
+- **Opened items can stay a while after their menu closes.** A hidden item you open from search or the Thaw Bar went back as soon as its menu closed, so one click in the wrong place sent it away and you had to find it again. "Hide opened items again after" (Settings > General > After revealing) keeps it in the menu bar for up to 30 seconds after the menu closes. It starts at 0 seconds, which works as before. [#342](https://github.com/thaw-app/Thaw/issues/342)
+- **Thaw pauses its own moves when they go wrong.** When the menu bar kept putting an item back, Thaw could drag it again and again, so your icons shuffled around. Failed moves also kept hiding the pointer while Thaw retried. Thaw now notices both and pauses its automatic moves for a minute, and longer if it happens again. Your own drags always go through, and a drag that lands ends the pause.
+
+### Fixes
+
+1. **Items dropped into Always Hidden stay there.** When Always Hidden held only a Control Center item whose app Thaw couldn't identify, a dragged item landed off-screen and jumped back to the visible section. Layout now places the drop at the edge of the section, and no longer lets you drag that Control Center item while it's parked out of sight. [#1190](https://github.com/thaw-app/Thaw/issues/1190)
+2. **The Thaw icon stays put after reconnecting a display on a notched Mac.** While macOS briefly reported Control Center in the wrong place, Thaw could restore your saved layout against that position and move the Thaw icon far to the left. It now waits for the menu bar to settle first.
+
+### Updates
+
+- **The macOS 27 notice sends you to beta updates.** If you run this version on macOS 27, the notice now says support comes through the alpha and beta channels, and its button switches you to beta updates. Until the first 3.0 beta is out, the beta channel on macOS 27 also offers the 3.0 alphas, so there's always a build that runs. Nothing changes on macOS 26.
+- **Under the hood.** A large cleanup: shorter code comments, less unused code, and the biggest source files split up. None of it should change how Thaw behaves. If something does, please report it.
+
 ## [3.0.0-alpha.7] - 2026-09-25
 
 **macOS 27 only · Build 108 · Beta candidate**
```

**File**: `MenuBarCaptureService/Listener.swift` (modified, +4/-12)
```diff
@@ -2,7 +2,6 @@
 //  Listener.swift
 //  Project: Thaw
 //
-//  Copyright (Ice) © 2023–2025 Jordan Baird
 //  Copyright (Thaw) © 2026 Toni Förster
 //  Licensed under the GNU GPLv3
 
@@ -25,9 +24,7 @@ final nonisolated class Listener: @unchecked Sendable {
     private var captureCount = 0
 
     private init() {
-        // Intentionally empty: the Connection is a singleton whose state
-        // initializes at its property declarations, so there is nothing to
-        // do here. The private visibility keeps external callers on `shared`.
+        // Intentionally empty: singleton state initializes at its declarations.
     }
 
     deinit {
@@ -42,9 +39,7 @@ final nonisolated class Listener: @unchecked Sendable {
                 return .start
             case let .configureLogging(filePath, rotationPolicy):
                 if let rotationPolicy {
-                    // The app owns the shared log directory's retention, so
-                    // pruning here follows its policy instead of this
-                    // target's defaults.
+                    // Prune by the app's retention policy, not this target's defaults.
                     DiagnosticLogger.shared.setRotationPolicy(rotationPolicy)
                 }
                 guard let filePath else {
@@ -64,11 +59,8 @@ final nonisolated class Listener: @unchecked Sendable {
                     return nil
                 }
                 guard DiagnosticLogger.shared.attachToFile(at: requested) else {
-                    // Answering success here would leave the app believing
-                    // both processes share a file while this one keeps
-                    // writing to the previous segment — which retention
-                    // eventually deletes out from under it. Failing the
-                    // request makes the app retry.
+                    // Replying success would leave this process writing to the old
+                    // segment, which retention later deletes. Failing makes the app retry.
                     diagLog.error(
                         "Capture listener failed to attach diagnostic logging to \(requested.path)"
                     )
```

**File**: `MenuBarCaptureService/main.swift` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@
 //  main.swift
 //  Project: Thaw
 //
-//  Copyright (Ice) © 2023–2025 Jordan Baird
 //  Copyright (Thaw) © 2026 Toni Förster
 //  Licensed under the GNU GPLv3
 
```

---

### Incident Patch 2: `2f581878` (2026-09-25)
**Commit Message**: ci(release): pin org-ci to the duplicate-build fix

The 2.1.0-beta.5 release failed at the appcast step: Sparkle 2.10's
generate_appcast refuses two archives with one bundle version, and the
beta.2 and beta.3 archives it fetched for deltas are both build 58.
org-ci d90bbc8 skips a prior archive whose build is already in the set.
Every org-ci action in this workflow moves to that commit, which
changes only the sparkle-release action.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

**File**: `.github/workflows/release.yml` (modified, +5/-5)
```diff
@@ -258,7 +258,7 @@ jobs:
           xcodebuild -version
 
       - name: Configure signing
-        uses: thaw-app/org-ci/actions/configure-signing@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/configure-signing@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           apple-application-cert: ${{ secrets.APPLE_APPLICATION_CERT }}
           apple-application-cert-password: ${{ secrets.APPLE_APPLICATION_CERT_PASSWORD }}
@@ -267,7 +267,7 @@ jobs:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
 
       - name: Build
-        uses: thaw-app/org-ci/actions/build@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/build@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
           project-name: ${{ steps.source.outputs.project-name }}
@@ -276,14 +276,14 @@ jobs:
           deployment-target: ${{ steps.source.outputs.deployment-target }}
 
       - name: Export Archive
-        uses: thaw-app/org-ci/actions/export-and-package@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/export-and-package@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
           app-name: ${{ env.APP_NAME }}
           dmg-name: ${{ env.DMG_NAME }}
 
       - name: Notarize
-        uses: thaw-app/org-ci/actions/notarize-and-validate@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/notarize-and-validate@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           dmg-name: ${{ env.DMG_NAME }}
           app-name: ${{ env.APP_NAME }}
@@ -352,7 +352,7 @@ jobs:
 
       - name: Sparkle ZIP and appcast
         id: sparkle
-        uses: thaw-app/org-ci/actions/sparkle-release@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/sparkle-release@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           tag: ${{ steps.meta.outputs.tag }}
           channel: ${{ steps.meta.outputs.channel }}
```

---

### Incident Patch 3: `8be744b4` (2026-09-21)
**Commit Message**: docs(changelog): add the alpha.6 fixes shipped after the first cut

The 3.0.0-alpha.6 section predates the right-click, Time Machine, parked
Thaw icon, blank-capture, and reveal-mask fixes, so What's New and the
release notes did not mention them. Adds those bullets, updates the
control-item investigation note, and dates the section 2026-09-21.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

**File**: `CHANGELOG.md` (modified, +8/-2)
```diff
@@ -28,7 +28,7 @@ A bug-fix pass on the menu bar layout engine and its settings, plus one new opti
 7. **App-icon mode stops sampling the menu bar.** "Always use app icon for menu bar items" only changed what Thaw drew; it still captured the menu bar for previews, which is what raises the screen-recording indicator. With the setting on, Thaw no longer captures. [#1051](https://github.com/thaw-app/Thaw/issues/1051)
 8. **The Thaw Bar uses the right icon tint on every display.** Opening the bar on a second display briefly showed the other display's light or dark icon tint. Thaw now keeps a per-display icon snapshot and restores it before the bar appears. [#1065](https://github.com/thaw-app/Thaw/issues/1065)
 
-## [3.0.0-alpha.6] - 2026-09-20
+## [3.0.0-alpha.6] - 2026-09-21
 
 **macOS 27 only · Build 106**
 
@@ -72,6 +72,10 @@ A bug-fix pass on the menu bar layout engine and its settings, plus one new opti
 - **A Core Foundation result that is not an array or a dictionary no longer crashes the app.** Five bridging sites are checked before use.
 - **A Manual-arrangement reorder is refused with a warning** instead of silently overwriting the order you saved.
 - **A missing capture no longer leaves a blank slot.** An item with no app icon and no capture, such as a concealed Apple module, now falls back to a substitute glyph instead of an empty cell.
+- **Right-clicking an item in the Thaw Bar opens its menu again.** Alpha 6 sent the right click through the move path, so an item macOS would not let Thaw move never got a context menu.
+- **A failed menu bar capture falls back to the app icon** instead of leaving the slot blank or black.
+- **A reveal whose menu bar capture fails no longer pegs a CPU core.** The join loop spun the main thread, which is the system-wide lag some of you saw during a reveal.
+- **Time Machine is recognized by name.** macOS 27 stopped reporting a title for it, so Thaw filed it as an unnamed item and could not place it.
 
 ### Menu bar reliability
 
@@ -92,10 +96,12 @@ A bug-fix pass on the menu bar layout engine and its settings, plus one new opti
 - **A move the position store cannot express still completes** through the Command-drag fallback. Drops can land next to parked-band items, and two icons of one app sitting on one weight are separated.
 - **The Thaw icon honours a held Option**, and Always Hidden presents the Thaw Bar when it is on.
 - **The capture helper no longer aborts while ScreenCaptureKit builds its window filter**, and Layout opens right after the Thaw Bar without the multi-second wait.
+- **The Thaw Bar stays beside the Thaw icon when macOS parks it.** It used to anchor to the parked position and land at the left edge of the screen.
+- **The Thaw icon comes back after a display change.** Recovery used to give up for the rest of the session.
 
 ### Still under investigation
 
-- **Thaw's own menu bar item can still go missing on macOS 27.** A stranded control item is now reseated instead of staying invisible until relaunch. This needs a live test on macOS 27 before it is called fixed. [#1135](https://github.com/thaw-app/Thaw/issues/1135)
+- **Thaw's own menu bar item can still go missing on macOS 27.** Thaw now treats a parked Thaw icon as parked, so the bar and the layout engine stop planning on that position, and recovery retries after a display change. macOS can still park the item, so this needs a live test before it is called fixed. [#1135](https://github.com/thaw-app/Thaw/issues/1135)
 - **Hidden section items still look wrong in some cases.** Always-hidden icons are captured after the section settles, and edge-ring knock-out helps full-frame icons, but the reports stay open. [#1119](https://github.com/thaw-app/Thaw/issues/1119)
 - **The five clicking bugs reported against alpha.5 have fixes in this build.** The reports stay open until someone confirms them on a live macOS 27 setup: empty-spot clicks, the Notification Center shortcut, the right-click menu, hidden-section collapse, 
```

---

### Incident Patch 4: `ffdb1a1a` (2026-09-21)
**Commit Message**: docs(changelog): add the Dock-icon option and Thaw Bar tint fix to 2.1.0-beta.4 (#1168)

#1065 and #1127 merged after the section was written. Add the new
General setting and the per-display tint fix, and update the count.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -11,7 +11,11 @@ and the Sparkle appcast, unless overridden with the `release_notes` input.
 
 **macOS 26 only · Build 60**
 
-A bug-fix pass on the menu bar layout engine and its settings. Seven field reports are fixed here, from parked reorders that reverted to the screen-recording indicator.
+A bug-fix pass on the menu bar layout engine and its settings, plus one new option. Eight field reports are fixed here, from parked reorders that reverted to the screen-recording indicator.
+
+### New
+
+- **Keep Thaw out of the Dock while you toggle the bar.** "Hide Dock icon when toggling the menu bar" (General) stops Thaw switching to a regular activation policy when it shows or hides hidden items, so the Dock icon no longer flashes on every toggle. Overflow that would have hidden the frontmost app's menus opens in the Thaw Bar instead. Settings and other explicit windows still appear normally. [#1128](https://github.com/thaw-app/Thaw/issues/1128)
 
 ### Fixes
 
@@ -22,6 +26,7 @@ A bug-fix pass on the menu bar layout engine and its settings. Seven field repor
 5. **The Smart rehide interval is visible where it is used.** Smart falls back to the same interval Timed uses, but the slider only appeared under Timed, so the value that governed Smart could not be seen or changed. The slider now appears under both. Focus rehides on activation and ignores the interval. [#1049](https://github.com/thaw-app/Thaw/issues/1049)
 6. **A renamed anchor still places new items.** A "New items" anchor saved under a helper's name stopped matching after the namespace was canonicalized, so new items fell back to the section default. Anchor lookup now canonicalizes, and the placement names the live item. [#1069](https://github.com/thaw-app/Thaw/issues/1069)
 7. **App-icon mode stops sampling the menu bar.** "Always use app icon for menu bar items" only changed what Thaw drew; it still captured the menu bar for previews, which is what raises the screen-recording indicator. With the setting on, Thaw no longer captures. [#1051](https://github.com/thaw-app/Thaw/issues/1051)
+8. **The Thaw Bar uses the right icon tint on every display.** Opening the bar on a second display briefly showed the other display's light or dark icon tint. Thaw now keeps a per-display icon snapshot and restores it before the bar appears. [#1065](https://github.com/thaw-app/Thaw/issues/1065)
 
 ## [3.0.0-alpha.6] - 2026-09-20
 
```

---

### Incident Patch 5: `0d61a337` (2026-09-20)
**Commit Message**: fix(icebar): restore correct icon tint when opening on another display (#1065)

* fix(icebar): restore correct icon tint when opening on another display

Drop the main-display-only color sample guards, keep a warm per-display
icon snapshot, and recapture through the existing SkyLight cadence so a
secondary-screen Thaw Bar open no longer flashes the previous screen's
baked light/dark glyphs. Settle delay stays at 500 ms.

Signed-off-by: jiayuqi7813 <1783671926@qq.com>
Co-authored-by: Cursor <cursoragent@cursor.com>

* fix(icebar): snapshot only the tags a capture produced per display

storeImages copied the whole standing image cache under one display, so a
one-section recapture on display B recorded display A's bitmaps for the
other sections as B's snapshot. Track the tags a capture actually produced
and merge only those, dropping entries no longer in the standing cache.

recaptureSection also did not check Task.isCancelled after the capture, so
a cancelled recapture could still store the new display's bitmaps under the
old display. Bail out before storing when cancelled.

Addresses the CodeRabbit findings on #1065.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

---------

S

**File**: `Thaw/MenuBar/IceBar/IceBar.swift` (modified, +37/-13)
```diff
@@ -34,6 +34,10 @@ final class IceBarPanel: NSPanel {
     /// change posts that notification, racing with the show).
     private var lastShowTimestamp: Date?
 
+    /// Display the Thaw Bar was last shown on. Cross-screen opens must drop
+    /// the previous screen's icon captures (light/dark tint is baked in).
+    private var lastShownDisplayID: CGDirectDisplayID?
+
     /// Storage for internal observers.
     private var cancellables = Set<AnyCancellable>()
 
@@ -228,9 +232,26 @@ final class IceBarPanel: NSPanel {
         currentSection = section
         lastShowTimestamp = Date()
 
-        // Show the panel immediately with whatever cached data we have.
-        // The SwiftUI view observes itemManager and imageCache, so it
-        // will re-render automatically as the background updates land.
+        // Menu bar icon light/dark tint is baked into the captured bitmaps.
+        // Restore this display's warm snapshot when we have one; otherwise clear
+        // wrong-display icons so the panel can still appear instantly (Loading)
+        // while a background SkyLight recapture fills the correct tint.
+        let switchedDisplay = lastShownDisplayID.map { $0 != screen.displayID } ?? false
+        let needsBackgroundRecapture = appState.imageCache.prepareImagesForThawBar(
+            displayID: screen.displayID,
+            section: section
+        )
+        if switchedDisplay {
+            colorManager.invalidateColorInfo()
+            diagLog.notice(
+                "show: display \(self.lastShownDisplayID.map(String.init) ?? "nil") → \(screen.displayID); warmCache=\(!needsBackgroundRecapture)"
+            )
+        }
+        lastShownDisplayID = screen.displayID
+
+        // Show the panel immediately. Never defer orderFront: setting
+        // currentSection without a visible panel makes isHidden flip to false,
+        // so a second click would call hide() instead of show().
         contentView = IceBarHostingView(
             appState: appState,
             colorManager: colorManager,
@@ -242,23 +263,23 @@ final class IceBarPanel: NSPanel {
 
         // Color manager must be updated after updating the panel's origin,
         // but before it is shown.
-        //
-        // Color manager handles frame changes automatically, but does so on
-        // the main queue, so we need to update manually once before showing
-        // the panel to prevent the color from flashing.
         colorManager.updateAllProperties(with: frame, screen: screen)
 
         orderFrontRegardless()
 
-        // Rehide temporarily shown items and refresh caches in the
-        // background. Ordering is preserved: rehide moves items back
-        // to their correct sections before the cache is rebuilt.
-        // The task is cancelled in close() to avoid holding appState.
+        // Refresh color + icons in the background. Keep the settle delay so
+        // control-item positioning does not leave the hidden section empty.
+        let panelFrame = frame
+        let targetDisplayID = screen.displayID
         cacheTask?.cancel()
-        cacheTask = Task { [weak appState] in
+        cacheTask = Task { [weak appState, weak colorManager] in
             guard let appState else { return }
+
+            await colorManager?.refresh(with: panelFrame, screen: screen)
+
             await appState.itemManager.rehideTemporarilyShownItems(force: true)
             guard !Task.isCancelled else { return }
+
             // Settle delay: when the IceBar just opened on a screen that
             // was previously inactive, the menu bar has moved screens and
             // NSStatusItem windows (control item chevrons) are still
@@ -270,7 +291,10 @@ final class IceBarPanel: NSPanel {
             guard !Task.isCancelled else { return }
             await appState.itemManager.cacheItemsIfNeeded()
             guard !Task.isCancelled else { return }
-            await appState.imageCache.updateCache()
+            await
```

**File**: `Thaw/MenuBar/IceBar/IceBarColorManager.swift` (modified, +60/-35)
```diff
@@ -10,6 +10,10 @@ import Combine
 import Observation
 import SwiftUI
 
+/// Samples the menu bar / wallpaper strip under the Thaw Bar for icon contrast.
+///
+/// Sampling runs on whatever screen the panel is on — not only the main
+/// display — so a secondary-screen open does not keep the previous brightness.
 @MainActor
 @Observable
 final class IceBarColorManager {
@@ -47,17 +51,17 @@ final class IceBarColorManager {
         if let iceBarPanel {
             iceBarPanel.publisher(for: \.screen)
                 .receive(on: DispatchQueue.main)
-                .sink { [weak self] screen in
-                    guard
-                        let self,
-                        let screen,
-                        screen == .main
-                    else {
+                .sink { [weak self, weak iceBarPanel] screen in
+                    guard let self, let screen, let iceBarPanel, iceBarPanel.isVisible else {
                         return
                     }
+                    // Drop the previous display's sample before the new capture
+                    // lands so icon contrast cannot briefly reuse the old screen.
+                    self.invalidateColorInfo()
+                    let frame = iceBarPanel.frame
                     Task { [weak self] in
                         guard let self else { return }
-                        await self.updateWindowImage(for: screen)
+                        await self.refresh(with: frame, screen: screen)
                     }
                 }
                 .store(in: &c)
@@ -69,8 +73,7 @@ final class IceBarColorManager {
                         let self,
                         let iceBarPanel,
                         let screen = iceBarPanel.screen,
-                        iceBarPanel.isVisible,
-                        screen == .main
+                        iceBarPanel.isVisible
                     else {
                         return
                     }
@@ -103,15 +106,14 @@ final class IceBarColorManager {
                 guard
                     let iceBarPanel,
                     iceBarPanel.isVisible,
-                    let screen = iceBarPanel.screen,
-                    screen == .main
+                    let screen = iceBarPanel.screen
                 else {
                     return
                 }
                 let frame = iceBarPanel.frame
                 Task { [weak self] in
                     guard let self else { return }
-                    await self.updateWindowImage(for: screen)
+                    guard await self.updateWindowImage(for: screen) else { return }
                     withAnimation {
                         self.updateColorInfo(with: frame, screen: screen)
                     }
@@ -120,22 +122,17 @@ final class IceBarColorManager {
             .store(in: &c)
 
             // Manage visibility: update colors immediately + start/stop periodic timer.
-            // Single subscription replaces the previous two \.isVisible observers.
             iceBarPanel.publisher(for: \.isVisible)
                 .removeDuplicates()
                 .receive(on: DispatchQueue.main)
                 .sink { [weak self, weak iceBarPanel] isVisible in
                     guard let self else { return }
                     if isVisible {
-                        // Refresh windowImage immediately so the first color
-                        // update isn't stale. Awaiting inside a Task so
-                        // updateColorInfo reads the fresh capture, not the
-                        // previous cycle's leftover.
-                        if let iceBarPanel, let screen = iceBarPanel.screen, screen == .main {
+                        if let iceBarPanel, let screen = iceBarPanel.screen {
                             let frame = iceBarPanel.frame
                             Task { [weak self] in
                                 guard let self else { return }
-                                await self.u
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemImageCache.swift` (modified, +309/-19)
```diff
@@ -161,6 +161,18 @@ final class MenuBarItemImageCache: @unchecked Sendable {
     /// The cached item images, keyed by their corresponding tags.
     private(set) var images = [MenuBarItemTag: CapturedImage]()
 
+    /// Display ID of the screen the current ``images`` were last captured for.
+    ///
+    /// Used by the Thaw Bar to drop stale bitmaps when opening on a different
+    /// screen: menu bar icon light/dark tint is baked into the capture, so
+    /// reusing another display's cache briefly shows the wrong icon colors.
+    private(set) var lastCaptureDisplayID: CGDirectDisplayID?
+
+    /// Per-display icon snapshots so switching screens can restore the correct
+    /// light/dark tint immediately instead of flashing the previous screen.
+    @ObservationIgnored
+    private var imagesByDisplay = [CGDirectDisplayID: [MenuBarItemTag: CapturedImage]]()
+
     /// Tracks which items are blinking for attention.
     ///
     /// Deliberately not observable: it is fed on every capture, and the
@@ -866,7 +878,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
 
             let nav = appState.navigationState
 
-            let preferredDisplayID = appState.itemManager.itemCache.displayID
+            let preferredDisplayID = preferredCaptureDisplayID(appState: appState)
             guard let resolvedScreen = Self.resolveScreen(preferredDisplayID: preferredDisplayID) else {
                 MenuBarItemImageCache.diagLog.warning("liveRefresh: no connected screens available, skipping")
                 try? await Task.sleep(for: .seconds(max(interval, Self.minIconRefreshInterval)))
@@ -938,6 +950,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
 
             var hiddenItems = [MenuBarItem]()
             var alwaysHiddenItems = [MenuBarItem]()
+            var capturedTags = [MenuBarItemTag]()
 
             for section in sections {
                 let availableItems = appState.itemManager.itemCache.managedItems(for: section)
@@ -971,6 +984,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                         await withCapturePermit {
                             await refreshImages(of: items, scale: scale, viaSCK: true)
                         }
+                        capturedTags.append(contentsOf: items.map(\.tag))
                     }
                     nextWake = min(
                         nextWake,
@@ -1016,6 +1030,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 await withCapturePermit {
                     await refreshImages(of: hiddenItems, scale: scale)
                 }
+                capturedTags.append(contentsOf: hiddenItems.map(\.tag))
             case .alwaysHidden:
                 lastAlwaysHiddenRefreshAt = now
                 MenuBarItemImageCache.diagLog.debug(
@@ -1024,10 +1039,15 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 await withCapturePermit {
                     await refreshImages(of: alwaysHiddenItems, scale: scale)
                 }
+                capturedTags.append(contentsOf: alwaysHiddenItems.map(\.tag))
             case .visible, nil:
                 break
             }
 
+            await MainActor.run {
+                storeImages(for: screen.displayID, capturedTags: capturedTags)
+            }
+
             if let hiddenInterval, !hiddenItems.isEmpty {
                 nextWake = min(
                     nextWake,
@@ -1817,6 +1837,24 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 "Memory pressure: Cleared \(tagsToRemove.count) items from cache"
             )
         }
+
+        // Per-display warm snapshots are independent of the standing LRU; drop
+        // non-standing displays first, then trim the standing copy to match.
+        let standing = lastCaptureDisplayID
+        for displayID in imagesByDisplay.keys where displayID != standing {
+            imagesByDisplay.removeValue(forKey: displayID)
+        }

```

---

### Incident Patch 6: `a691df93` (2026-09-20)
**Commit Message**: fix(menubar): land parked moves and fix rehide, scroll, placement, and capture regressions (#1162)

* fix(menubar): keep planned release point for parked teleports

While a parked item is held, WindowServer reports it at the display
origin and the parked lane reads as reflowed by roughly a thousand
points. Rebuilding the release point from that mid-hold snapshot landed
past the end of the lane, so every parked reorder reverted and the user
saw 'could not be kept in its new position'.

A parked teleport now releases at the point planned just before the
press. A source-anchored retry does the same only when its destination
is parked; against a visible destination the reflow is real and the
fresh point is correct.

Refs #1074, #1102, #1104, #1133

Signed-off-by: René Jiménez <diazdesandi@proton.me>

* fix(menubar): drop rehide context when the source process terminated

A temporarily shown item whose owning process quit was re-queued for up
to ten not-found attempts, leaving a dead icon in the Thaw Bar until the
retries exhausted. rehideTemporarilyShownItems now probes the source PID
and drops the context immediately when it is gone, clearing the pending
relocation so the item is not 

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -7,6 +7,22 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
+## [2.1.0-beta.4] - 2026-09-20
+
+**macOS 26 only · Build 60**
+
+A bug-fix pass on the menu bar layout engine and its settings. Seven field reports are fixed here, from parked reorders that reverted to the screen-recording indicator.
+
+### Fixes
+
+1. **Parked reorders land again.** While a parked item is held, WindowServer reports it at the display origin and the parked lane reads as reflowed by roughly a thousand points. Rebuilding the release point from that mid-hold snapshot landed the item past the end of the lane, so every hidden-section reorder was refused and the user saw "could not be kept in its new position". A parked teleport now releases at the point planned just before the press. A source-anchored retry keeps its planned point only when the destination is parked; against a visible destination the reflow is real and the fresh point is correct. [#1074](https://github.com/thaw-app/Thaw/issues/1074), [#1102](https://github.com/thaw-app/Thaw/issues/1102), [#1104](https://github.com/thaw-app/Thaw/issues/1104), [#1133](https://github.com/thaw-app/Thaw/issues/1133)
+2. **A quit app no longer leaves a dead icon in the Thaw Bar.** A temporarily shown item whose owning process had terminated was re-queued for up to ten not-found attempts before being dropped. Thaw now probes the source PID and drops the item immediately when it is gone, clearing the pending relocation so it is not resurrected later. [#1149](https://github.com/thaw-app/Thaw/issues/1149)
+3. **Scrolling on the Thaw icon reveals the hidden section again.** The reveal gesture only accepted empty menu bar space, which deliberately excludes the Thaw icon, so scrolling directly on the icon did nothing. The icon region is now accepted as well. [#1073](https://github.com/thaw-app/Thaw/issues/1073)
+4. **New items land where the "New items" placeholder sits.** Default (no-anchor) placement inserted a new item at the section end, while the Layout editor badge defaults to the section start, so a new app appeared next to the Thaw icon instead of at the placeholder. Default placement now uses the same slot the badge defaults to. [#1069](https://github.com/thaw-app/Thaw/issues/1069)
+5. **The Smart rehide interval is visible where it is used.** Smart falls back to the same interval Timed uses, but the slider only appeared under Timed, so the value that governed Smart could not be seen or changed. The slider now appears under both. Focus rehides on activation and ignores the interval. [#1049](https://github.com/thaw-app/Thaw/issues/1049)
+6. **A renamed anchor still places new items.** A "New items" anchor saved under a helper's name stopped matching after the namespace was canonicalized, so new items fell back to the section default. Anchor lookup now canonicalizes, and the placement names the live item. [#1069](https://github.com/thaw-app/Thaw/issues/1069)
+7. **App-icon mode stops sampling the menu bar.** "Always use app icon for menu bar items" only changed what Thaw drew; it still captured the menu bar for previews, which is what raises the screen-recording indicator. With the setting on, Thaw no longer captures. [#1051](https://github.com/thaw-app/Thaw/issues/1051)
+
 ## [3.0.0-alpha.6] - 2026-09-20
 
 **macOS 27 only · Build 106**
```

**File**: `Thaw.xcodeproj/project.pbxproj` (modified, +8/-8)
```diff
@@ -700,7 +700,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = A7CKWF99ML;
@@ -719,7 +719,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_APPROACHABLE_CONCURRENCY = YES;
@@ -741,7 +741,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = A7CKWF99ML;
@@ -760,7 +760,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_APPROACHABLE_CONCURRENCY = YES;
@@ -777,7 +777,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEVELOPMENT_TEAM = A7CKWF99ML;
 				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -788,7 +788,7 @@
 				INFOPLIST_KEY_NSHumanReadableCopyright = "Copyright © 2026 Toni Förster et al.\nCopyright © 2023–2025 Jordan Baird (Ice)";
 				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw.MenuBarItemService;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
@@ -810,7 +810,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEVELOPMENT_TEAM = A7CKWF99ML;
 				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -821,7 +821,7 @@
 				INFOPLIST_KEY_NSHumanReadableCopyright = "Copyright © 2026 Toni Förster et al.\nCopyright © 2023–2025 Jordan Baird (Ice)";
 				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw.MenuBarItemService;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
```

**File**: `Thaw/Events/HIDEventManager.swift` (modified, +8/-1)
```diff
@@ -1581,9 +1581,16 @@ extension HIDEventManager {
         appState: AppState,
         screen: NSScreen
     ) {
+        // `isMouseInsideEmptyMenuBarSpace` excludes the Thaw icon, but
+        // scrolling on the icon must reveal too. (#1073)
+        let overEmptyMenuBarSpace = isMouseInsideEmptyMenuBarSpace(
+            appState: appState,
+            screen: screen
+        )
+        let overThawIcon = isMouseInsideIceIcon(appState: appState)
         guard
             appState.settings.general.showOnScroll,
-            isMouseInsideEmptyMenuBarSpace(appState: appState, screen: screen),
+            overEmptyMenuBarSpace || overThawIcon,
             !isCursorOverForeignWidgetUIElement(),
             let hiddenSection = appState.menuBarManager.section(
                 withName: .hidden
```

**File**: `Thaw/MenuBar/MenuBarItems/LayoutReconciler.swift` (modified, +43/-4)
```diff
@@ -295,6 +295,38 @@ nonisolated enum LayoutReconciler {
                 return desiredFiltered.endIndex
             }
         }
+        /// Default insertion index for a section when no NewItemsPlacement
+        /// anchor applies. Mirrors `defaultNewItemsBadgeIndex` so the badge
+        /// and a new item's slot cannot disagree. (#1069)
+        func sectionDefaultIndex(for section: MenuBarSection.Name) -> Int {
+            switch section {
+            case .visible:
+                // Visible is the first block, so its leftmost slot is 0.
+                // Skip a leading chevron only; the icon can sit mid-section.
+                if let chevron = controlUIDs.visible, desiredFiltered.first == chevron {
+                    return 1
+                }
+                return 0
+            case .hidden:
+                return controlUIDs.alwaysHidden != nil
+                    ? sectionStartIndex(for: .hidden)
+                    : sectionEndIndex(for: .hidden)
+            case .alwaysHidden:
+                return sectionEndIndex(for: .alwaysHidden)
+            }
+        }
+        /// Whether a section's default slot is at its start, where successive
+        /// defaults need an offset to keep their order.
+        func sectionDefaultIsAtStart(_ section: MenuBarSection.Name) -> Bool {
+            switch section {
+            case .visible:
+                return true
+            case .hidden:
+                return controlUIDs.alwaysHidden != nil
+            case .alwaysHidden:
+                return false
+            }
+        }
         func sectionKeyString(for section: MenuBarSection.Name) -> String {
             switch section {
             case .visible: return "visible"
@@ -446,16 +478,23 @@ nonisolated enum LayoutReconciler {
             }
         }
 
-        // Pass 3: .newItemDefault placements. Insert at the section
-        // end in unmanagedUIDs order so their relative ordering
-        // matches the current menu bar.
+        // Pass 3: .newItemDefault placements, at the badge's default slot so
+        // a new item lands where the placeholder sits. (#1069)
+        var defaultInsertedCount = [MenuBarSection.Name: Int]()
         for uid in unmanagedUIDs {
             if case let .newItemDefault(section) = placements[uid] {
                 // Guards the caller invariant: see pass 1.
                 if desiredFiltered.contains(uid) {
                     continue
                 }
-                desiredFiltered.insert(uid, at: sectionEndIndex(for: section))
+                // A start slot is stable, so offset each insert; an end slot
+                // advances on its own.
+                let base = sectionDefaultIndex(for: section)
+                let offset = sectionDefaultIsAtStart(section)
+                    ? defaultInsertedCount[section, default: 0]
+                    : 0
+                desiredFiltered.insert(uid, at: base + offset)
+                defaultInsertedCount[section, default: 0] += 1
                 sectionMap[uid] = sectionKeyString(for: section)
             }
         }
```

**File**: `Thaw/MenuBar/MenuBarItems/LayoutSolver.swift` (modified, +15/-4)
```diff
@@ -1320,15 +1320,17 @@ nonisolated enum LayoutSolver {
                 continue
             }
 
-            // 2. NewItemsPlacement anchor (if configured and present in
-            //    the current menu bar).
+            // 2. NewItemsPlacement anchor (if configured and present in the
+            //    current bar), resolved to the live UID. (#1069)
             if newItemsPlacement.relation != .sectionDefault,
                let anchor = newItemsPlacement.anchorIdentifier,
-               currentUIDs.contains(anchor)
+               let liveAnchor = currentUIDs.first(where: {
+                   newItemsAnchorMatches($0, anchor)
+               })
             {
                 result[uid] = .newItemAnchored(
                     section: newItemsSection,
-                    anchorUID: anchor,
+                    anchorUID: liveAnchor,
                     relation: newItemsPlacement.relation
                 )
                 continue
@@ -1634,6 +1636,15 @@ nonisolated enum LayoutSolver {
         return "\(canonical):\(titlePortion(forIdentifier: identifier))"
     }
 
+    /// Whether `identifier` names the same NewItemsPlacement anchor as
+    /// `anchor`, allowing for persisted-identifier canonicalization. (#1069)
+    static nonisolated func newItemsAnchorMatches(_ identifier: String, _ anchor: String) -> Bool {
+        if identifier == anchor {
+            return true
+        }
+        return canonicalIdentifier(identifier) == canonicalIdentifier(anchor)
+    }
+
     /// Applies ``canonicalIdentifier(_:)`` across a saved section order.
     ///
     /// Runs before pruning at load, so an entry that only looks unmatchable
```

---

### Incident Patch 7: `5233713f` (2026-09-15)
**Commit Message**: docs: fix formatting in CHANGELOG for macOS 27 section

Signed-off-by: René <diazdesandi@proton.me>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ and the Sparkle appcast, unless overridden with the `release_notes` input.
 
 ## [3.0.0-alpha.4] - 2026-09-14
 
-### ### macOS 27 only
+### macOS 27 only
 
 This is one of the last alphas. We are targeting the beta release by the end of this week. Once beta lands and the core functions are stable and reliable, the codebase opens for contributions.
 
```

---

### Incident Patch 8: `df71ccac` (2026-09-14)
**Commit Message**: docs(changelog): update changelog for 3.0.0-alpha.4 release with new features and fixes

Signed-off-by: René Jiménez <diazdesandi@proton.me>

**File**: `CHANGELOG.md` (modified, +78/-0)
```diff
@@ -7,6 +7,84 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
+## [3.0.0-alpha.4] - 2026-09-14
+
+This is one of the last alphas. We are targeting the beta release by the end of this week. Once beta lands and the core functions are stable and reliable, the codebase opens for contributions.
+
+Settings is rebuilt. The fifteen-pane sidebar is gone. What replaces it is a grouped sidebar with no nested tabs, a dedicated Thaw Bar page with a live preview, a customizable sidebar, and a separate appearance for the Thaw Bar itself.
+
+Something broke? [Open an issue](https://github.com/thaw-app/Thaw/issues/new/choose). Something missing? [Tell us here](https://github.com/thaw-app/Thaw/discussions).
+
+---
+
+### Upgrade from 3.0.0-alpha.3
+
+1. Nothing to do. Profiles, saved layouts, hotkeys, appearance, and permissions all carry over.
+2. Your last settings pane reopens. If it moved, it remaps to its new home.
+3. You can now hide sidebar destinations you don't use. Open the overflow menu and pick "Customize Sidebar."
+
+---
+
+### Settings
+
+- **Fifteen panes down to a grouped sidebar.** General, Layout, Visibility, Appearance, Thaw Bar, Profiles, Shortcuts, Automation, Displays, Spaces, Privacy, Experiments, and Troubleshooting. Grouped with the system's inter-section spacing, no text headings. About lives in the status-item menu. Scripts and Custom Status Icon are reachable through search and Experiments.
+- **Layout and Visibility are direct peers, not a nested tab.** Menu Bar used to be one destination with an Arrange / Behavior segmented control inside it. Now Layout and Visibility each have their own sidebar row. Layout holds the bar editor and every layout control. Visibility holds the reveal and rehide lifecycle, search configuration, and tooltips.
+- **Advanced is gone.** Its three controls moved to where they belong. App-menu hiding and the secondary context menu are in General. Auto-zen-while-presenting is in Automation. The reorder timeout is parked behind the Advanced layout controls disclosure; its write path is bypassed on macOS 27, so the UI is hidden until it has a visible effect.
+- **Customize the sidebar.** Hide destinations you don’t use from the overflow menu’s “Customize Sidebar” sheet. Hidden panes stay reachable through search. The current pane and the last visible pane can’t be hidden.
+
+### Thaw Bar
+
+- **Dedicated page with a live preview.** The Thaw Bar configuration that was buried inside Displays now has its own sidebar entry. The preview shows the hidden section's items in the chosen arrangement (horizontal, vertical, grid), on the real menu-bar surface, with the actual Thaw Bar shape and border from the appearance config. An "Open Thaw Bar" button opens the real panel. When it's off, the button says "Enable & Open."
+- **Separate Thaw Bar appearance.** Ported from the 2.1.0 beta versions. The Thaw Bar can now draw with its own shape, tint, and border, independent of the menu bar's. The override is off by default and seeded from the values on screen, so turning it on changes nothing until you edit something. Rounded corners, tint (solid or gradient), tint opacity, border color, and border width. The border shape omits the top edge on square corners so it is not clipped by the display's rounded screen corners.
+
+### Menu Bar editor
+
+- **One short instruction instead of four.** The heading, drag instructions, the Command-drag tip, and the macOS limitation note collapsed into a single line beside the editor. The OS limitation is a footnote. The refusal notice still appears when a move fails.
+- **Empty groups state is a compact row.** The 110pt centered empty state is gone. A one-line footnote says what to do instead.
+- **Command-drag toggle moved.** "Show all sections when Command-dragging" moved from Visibility to Layout
```

---

### Incident Patch 9: `867fe290` (2026-09-14)
**Commit Message**: fix(layout): let Sort A->Z reorder hidden and always-hidden sections (#1117)

* build(deps): bump github.com/thaw-app/axswift6 in the swift group

Signed-off-by: René Jiménez <diazdesandi@proton.me>

* fix(layout): let Sort A->Z enforce concealed-section order for its apply

Sort A->Z wrote the sorted order to the active profile but the apply
relaxed concealed-section order by default, so hidden and always-hidden
sorts planned zero moves and the bar never reordered. Visible already
sorted fine. The sort now passes enforceConcealedSectionOrder: true so
its apply honours the sorted order; background and profile-switch
applies keep the relaxation.

Closes: #1116
Signed-off-by: René Jiménez <diazdesandi@proton.me>

* fix(layout): enforce concealed order on the no-profile sort path

sortSection's no-active-profile branch reordered through the
saved-layout apply, which relaxes concealed-section order by default,
so a hidden/always-hidden sort persisted to disk but never reached the
bar (same bug as the profile path, different apply path). Arm a one-shot
flag the saved-layout apply consumes so the sorted order is honoured
for that pass; background and other saved applies keep the relaxati

**File**: `Thaw.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -1014,7 +1014,7 @@
 			repositoryURL = "https://github.com/thaw-app/AXSwift6";
 			requirement = {
 				kind = upToNextMinorVersion;
-				minimumVersion = 0.5.0;
+				minimumVersion = 0.5.1;
 			};
 		};
 		17F71BB32B880B4500905CBA /* XCRemoteSwiftPackageReference "CompactSlider" */ = {
```

**File**: `Thaw.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -6,8 +6,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/thaw-app/AXSwift6",
       "state" : {
-        "revision" : "2fd7ecaedc4ded69c0129b416ce19b5509d79d61",
-        "version" : "0.5.0"
+        "revision" : "4678fd96f9e0ede805348f9d8a91935b2650bf0c",
+        "version" : "0.5.1"
       }
     },
     {
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemManager/MenuBarItemManager+LayoutApply.swift` (modified, +13/-2)
```diff
@@ -889,6 +889,7 @@ extension MenuBarItemManager {
         source: ApplySource = .profile,
         automatic: Bool = false,
         duringSettling: Bool = false,
+        enforceConcealedSectionOrder: Bool = false,
         shouldBegin: (@MainActor () -> Bool)? = nil
     ) async {
         let pinnedHidden = spec.pinnedHidden
@@ -2627,8 +2628,13 @@ extension MenuBarItemManager {
         // planned moves so the LCS itself sees those items as already in
         // place: filtering moves out afterwards would leave the surviving
         // moves anchored against items the plan assumed had shifted.
-        let enforceConcealedOrder = (Defaults.object(forKey: .enforceConcealedSectionOrder) as? Bool)
-            ?? Defaults.DefaultValue.enforceConcealedSectionOrder
+        //
+        // An explicit Sort A→Z passes `enforceConcealedSectionOrder: true`
+        // so the sorted intra-section order survives to the move pass
+        // instead of being rewritten back to the current order.
+        let enforceConcealedOrder = enforceConcealedSectionOrder
+            || ((Defaults.object(forKey: .enforceConcealedSectionOrder) as? Bool)
+                ?? Defaults.DefaultValue.enforceConcealedSectionOrder)
         if !enforceConcealedOrder {
             desiredNoControls = LayoutSolver.relaxConcealedSectionOrder(
                 desiredNoControls: desiredNoControls,
@@ -3976,6 +3982,10 @@ extension MenuBarItemManager {
 
         let completionGenerationBeforeApply = bulkApplyCompletionGeneration
         let restorationIdentifiersAtDispatch = triggerLayoutRestorationItemIdentifiers
+        // One-shot from sortSection's no-active-profile branch: honour the
+        // sorted concealed-section order this apply instead of relaxing it.
+        let enforceConcealed = enforceConcealedSectionOrderOnNextSavedApply
+        enforceConcealedSectionOrderOnNextSavedApply = false
         await applyProfileLayout(
             ProfileLayoutSpec(
                 pinnedHidden: pinnedHiddenBundleIDs,
@@ -3987,6 +3997,7 @@ extension MenuBarItemManager {
             source: .savedOrder,
             automatic: true,
             duringSettling: resolvedIdentitiesOnly,
+            enforceConcealedSectionOrder: enforceConcealed,
             shouldBegin: {
                 self.layoutBatchIsCurrent(batchLease) && (shouldBegin?() ?? true)
             }
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemManager/MenuBarItemManager.swift` (modified, +13/-1)
```diff
@@ -294,6 +294,12 @@ final class MenuBarItemManager {
     /// Suppresses the next automatic relocation of newly seen leftmost items.
     var suppressNextNewLeftmostItemRelocation = false
 
+    /// One-shot: the next saved-layout apply honours concealed-section order
+    /// instead of relaxing it. Armed by ``sortSection`` when there is no
+    /// active profile, since that path reorders through the saved-layout
+    /// apply rather than a profile reapply. Cleared after one use.
+    var enforceConcealedSectionOrderOnNextSavedApply = false
+
     @MainActor
     deinit {
         rehideTimer?.invalidate()
@@ -1513,8 +1519,14 @@ final class MenuBarItemManager {
                 MenuBarItemManager.diagLog.error("sortSection: profile update failed; rolled back savedSectionOrder")
                 return nil
             }
-            profileManager.reapplyActiveProfile()
+            profileManager.reapplyActiveProfile(enforceConcealedSectionOrder: true)
         } else {
+            // The saved-layout apply (run by the cache cycle below) relaxes
+            // concealed-section order by default, so without the flag a
+            // hidden/always-hidden sort would persist to disk but never
+            // reach the bar. The flag is one-shot: the cache cycle clears
+            // it after the apply it triggers.
+            enforceConcealedSectionOrderOnNextSavedApply = true
             Task { [weak self] in
                 await self?.cacheItemsRegardless()
             }
```

**File**: `Thaw/Settings/Models/ProfileManager+Live.swift` (modified, +10/-3)
```diff
@@ -125,7 +125,8 @@ extension ProfileManager {
     func applyProfile(
         _ profile: Profile,
         to appState: AppState,
-        previousProfileID: UUID? = nil
+        previousProfileID: UUID? = nil,
+        enforceConcealedSectionOrder: Bool = false
     ) {
         diagLog.debug(
             "applyProfile entered: name=\(profile.name)"
@@ -269,6 +270,7 @@ extension ProfileManager {
                     itemSectionMap: itemSectionMap,
                     itemOrder: itemOrder
                 ),
+                enforceConcealedSectionOrder: enforceConcealedSectionOrder,
                 shouldBegin: {
                     appState.itemManager.layoutBatchIsCurrent(batchLease)
                 }
@@ -566,15 +568,20 @@ extension ProfileManager {
     /// them. The applyOffset inside layoutTask no-ops (the on-disk values
     /// were just written), and the subsequent applyProfileLayout awaits
     /// the in-flight expected-set settling before running.
-    func reapplyActiveProfile() {
+    func reapplyActiveProfile(enforceConcealedSectionOrder: Bool = false) {
         guard let appState else { return }
         guard let activeID = activeProfileID else { return }
         do {
             let profile = try loadProfile(id: activeID)
             // No previous-vs-new transition here; pass the active id as
             // both previous and current so a hook can see the apply was a
             // refresh of the same profile rather than a switch.
-            applyProfile(profile, to: appState, previousProfileID: activeID)
+            applyProfile(
+                profile,
+                to: appState,
+                previousProfileID: activeID,
+                enforceConcealedSectionOrder: enforceConcealedSectionOrder
+            )
         } catch {
             diagLog.error("reapplyActiveProfile failed: \(error)")
         }
```

---

### Incident Patch 10: `26f7f3ec` (2026-09-14)
**Commit Message**: fix(menubar): stop layout and spacing work from fighting the user (#1075)

* perf(menubar): refresh item images off the main actor

`refreshImages` was only `nonisolated`, which under Approachable
Concurrency keeps the caller's actor. The bounds queries, the crop, and
the detached copies all ran on the main thread next to UI work.
`@concurrent` moves them onto the background pool; publication still hops
back through `applyRefreshedImages`.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

* perf(triggers): capture only the items a blink trigger watches

Attention detection was a single Boolean demand, so one enabled trigger
made the live loop capture every item in the concealed sections. The
image cache now takes the identifiers the enabled triggers name and
captures those windows alone. The global "surface items seeking
attention" setting is unaffected and still samples everything.

Signed-off-by: René Jiménez <diazdesandi@proton.me>

* perf(triggers): batch trigger image captures into one request

Each watched item was captured on its own round trip through the capture
helper. One request now covers every watched window, and the helper
keeps owning the leaking SkyLight call.


**File**: `CHANGELOG.md` (modified, +36/-23)
```diff
@@ -226,61 +226,74 @@ Three things from the 2.1 preview line are still on their way to macOS 27. Anoth
 - On a notched display, when the frontmost app's menu is long enough to wrap past the notch, Thaw can repeatedly try to move items and briefly take the cursor. A fix is coming in alpha 2.
 - iStats menu bar items may be hidden when another item gets hidden. We are working with the iStats developers to resolve this issue.
 
-## [2.1.0-beta.3]
+## [2.1.0-beta.3] - 2026-09-14
 
 Hey, we have a Discord! Come say hi: [discord.gg/KDfWjWDnR4](https://discord.gg/KDfWjWDnR4).
 
 Please report issues at [github.com/thaw-app/Thaw/issues](https://github.com/thaw-app/Thaw/issues).
 
 <a href="https://www.producthunt.com/products/thaw-2?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-thaw-3" target="_blank" rel="noopener noreferrer"><img alt="Thaw - The only app that owns your whole menu bar, in and out | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1239794&amp;theme=light&amp;t=1788423441056"></a>
 
-Thanks to @wiper2 for the spacing report and the crash logs behind it, @lucifercraig12345-create for finding both the search freeze and the spacer crash, @Chamiu for the `dropReverted` report, and @ppocass for tracing a menu bar that never rendered down to the window number itself.
+Thanks to @wiper2 for the spacing report and crash logs, @lucifercraig12345-create for the search freeze, the spacer crash, and the external-drive trigger request, @Chamiu for the `dropReverted` report, @ppocass for tracing a menu bar that never rendered, @leos for the spacing-restart report, and @balaji-dutt for the stuck-rehide and localized-ghost diagnoses.
 
-Five reported bugs, four more found while fixing them, and three changes to how item images are captured. The one worth reading about is the first. The #720 fix in beta.2 taught the spacing relaunch wave to restart system LaunchAgents through `launchctl` instead of killing them, which rescued Spotlight. It did not stop the wave from terminating system binaries that no LaunchAgent claims, and those are just as unrestartable.
+Spacing changes no longer kill system services that cannot be brought back, and you can now turn the restart wave off entirely. You can also sort a section alphabetically, remove stale displays from the list, type in the search panel the moment it opens, and reveal a hidden item while an external drive is mounted. Five reported bugs and four more found while fixing them are in here, plus three image-capture performance changes, and three ways automatic layout work used to fight whoever was using the mouse.
 
 ---
 
 ### Upgrade from 2.1.0-beta.2
 
 1. Update in place through Sparkle on the beta channel. Stable stays on 2.0.1 until 2.1.0 leaves beta.
 2. No schema or `defaults` changes. Profiles, saved layouts, and hotkeys carry over untouched.
-3. Spacing changes now leave some items alone. A menu bar item whose owner Thaw declines to restart keeps its previous spacing until that app next starts on its own, so the bar can look uneven for a while after a spacing change. `FREQUENT_ISSUES.md` has a new section listing what Thaw will and will not quit.
-4. An app that refuses a quit request is no longer force-terminated. If an app is holding an unsaved document, it stays running and keeps its old spacing rather than losing the document.
+3. Spacing changes leave some items alone, and you can turn the wave off. An item whose owner Thaw declines to restart keeps its previous spacing until that app next starts, so the bar can look uneven for a while. "When applying spacing" under Settings, Displays has a "Wait until next restart (no apps restarted)" option that stops Thaw restarting apps for a spacing change at all. `FREQUENT_ISSUES.md` lists what Thaw will and will not quit.
+4. An app that refuses a quit request is no longer force-terminated. If it is holding an unsaved document, it 
```

**File**: `FREQUENT_ISSUES.md` (modified, +15/-1)
```diff
@@ -143,6 +143,8 @@ Corrupted Control Center state from 0.29.x can also cause **Little Snitch**, **T
 
 Connecting, disconnecting, or switching displays can cause brief visual glitches (resolution flicker, extra spacing), often transient. Thaw may relaunch apps with menu bar items when a display transition requires applying different spacing, which can produce duplicate icons if the host app also relaunches its agent. The duplicate usually belongs to the app, not Thaw.
 
+Thaw may relaunch apps with menu bar items when a display transition requires applying different menu bar spacing. That can produce duplicate icons if the host app also relaunches its agent. The duplicate usually belongs to the app, not Thaw. Thaw does not quit macOS system services during this; see [What Thaw will and won't quit](#what-thaw-will-and-wont-quit).
+
 Fix:
 
 1. Enable **Confirm before relaunching apps** in **Settings → Displays**.
@@ -159,10 +161,22 @@ Fix:
 
 1. Return spacing to the default and confirm all items are reachable.
 2. Re-apply spacing in small steps.
-3. If a system app crashes when spacing changes (for example Spotlight), treat it as an upstream macOS issue ([#720](https://github.com/thaw-app/Thaw/issues/720)).
+3. If a system app is missing after a spacing change (for example Spotlight), restart it with `launchctl kickstart -k gui/$(id -u)/com.apple.Spotlight`, or log out and back in.
 
 Related: [#664](https://github.com/thaw-app/Thaw/issues/664).
 
+## What Thaw will and won't quit
+
+Menu bar spacing lives in a single system-wide preference, and a status item only picks up a new value when its owning process starts. To apply spacing right away, Thaw restarts the apps that own menu bar items. It sorts them into three groups first:
+
+- **Apps macOS launches for you** (Spotlight, the input menu, Dock, Time Machine) are restarted through `launchctl kickstart`, so launchd stays their launching parent. Quitting one and relaunching it directly is rejected by macOS at exec, and the item would stay gone until you rebooted ([#720](https://github.com/thaw-app/Thaw/issues/720)).
+- **System binaries no LaunchAgent claims** are left alone entirely. Thaw has no way to bring them back, so it never takes them down ([#1070](https://github.com/thaw-app/Thaw/issues/1070)).
+- **Your own apps** are asked to quit and launched again. Thaw asks; it never force-quits. An app that declines (a save sheet, a long operation) keeps running and keeps the previous spacing.
+
+The trade-off is that anything Thaw skips keeps its old spacing until it next starts on its own. Spacing changes are rare; a permanently dead Spotlight is not worth an evenly spaced menu bar.
+
+If you would rather Thaw never restart apps, set **When applying spacing** to **Wait until next restart** in **Settings → Displays**. Thaw still writes the new spacing to the system preference, but leaves every app running; the new spacing appears the next time each app starts on its own (after a restart, or when you reopen it). This avoids the restart disruption when plugging in or unplugging monitors, at the cost of spacing not taking effect immediately.
+
 ## Screen Recording and permission prompts
 
 Thaw uses **Screen Recording** for live previews and wallpaper-derived tints. Hiding, revealing, and rearranging items don't need it. Without the permission, Thaw draws each item as its owning app's icon in the Thaw Bar, the layout bars, and the search panel (older builds showed an error on those surfaces instead; see [#628](https://github.com/thaw-app/Thaw/issues/628)).
```

**File**: `Thaw/MenuBar/Appearance/MenuBarOverlayPanel.swift` (modified, +66/-64)
```diff
@@ -12,7 +12,7 @@ import ScreenCaptureKit
 
 // MARK: - Overlay Panel
 
-/// A subclass of `NSPanel` that sits atop the menu bar to alter its appearance.
+/// A subclass of NSPanel that sits atop the menu bar to alter its appearance.
 final class MenuBarOverlayPanel: NSPanel, @unchecked Sendable {
     private let diagLog = DiagLog(category: "MenuBarOverlayPanel")
     /// Flags representing the updatable components of a panel.
@@ -87,9 +87,9 @@ final class MenuBarOverlayPanel: NSPanel, @unchecked Sendable {
         }
     }
 
-    /// The last-observed value of `menuBarManager.isMenuBarHiddenBySystem`
-    /// (wave 3: `menuBarManager` is now `@Observable`, so this is tracked via
-    /// `menuBarManagerObservationTask` rather than a `CombineLatest` operand).
+    /// The last-observed value of menuBarManager.isMenuBarHiddenBySystem
+    /// (wave 3: menuBarManager is now @Observable, so this is tracked via
+    /// menuBarManagerObservationTask rather than a CombineLatest operand).
     private var cachedIsMenuBarHiddenBySystem = false
 
     /// Flags representing the components of the panel currently in need of an update.
@@ -101,12 +101,12 @@ final class MenuBarOverlayPanel: NSPanel, @unchecked Sendable {
     /// Storage for internal observers.
     private var cancellables = Set<AnyCancellable>()
 
-    /// Task observing `menuBarManager.isMenuBarHiddenBySystem` (wave 3),
-    /// replacing the `CombineLatest` operand of the same name.
+    /// Task observing menuBarManager.isMenuBarHiddenBySystem (wave 3),
+    /// replacing the CombineLatest operand of the same name.
     private var menuBarManagerObservationTask: Task<Void, Never>?
 
-    /// Task observing `appearanceManager.configuration` (wave 3), replacing
-    /// the old `$configuration.sink { updateWindowLevel() }` subscription.
+    /// Task observing appearanceManager.configuration (wave 3), replacing
+    /// the old $configuration.sink { updateWindowLevel() } subscription.
     private var appearanceConfigurationObservationTask: Task<Void, Never>?
 
     /// The context that manages panel update tasks.
@@ -125,9 +125,9 @@ final class MenuBarOverlayPanel: NSPanel, @unchecked Sendable {
     /// The screen that owns the panel.
     let owningScreen: NSScreen
 
-    /// Task observing the shared `MissionControlDetector.isActive`, which
+    /// Task observing the shared MissionControlDetector.isActive, which
     /// replaces this panel's own Mission Control probe timer/window (moved
-    /// to `MissionControlDetector`, owned by `MenuBarAppearanceManager`, so
+    /// to MissionControlDetector, owned by MenuBarAppearanceManager, so
     /// the whole app polls the window server once instead of once per
     /// panel).
     private var missionControlObservationTask: Task<Void, Never>?
@@ -162,8 +162,8 @@ final class MenuBarOverlayPanel: NSPanel, @unchecked Sendable {
         configureCancellables()
     }
 
-    /// Updates `alphaValue` based on the combination of
-    /// `cachedIsMenuBarHiddenBySystem` and `isMissionControlActive` — the two
+    /// Updates alphaValue based on the combination of
+    /// cachedIsMenuBarHiddenBySystem and isMissionControlActive — the two
     /// operands of the old `CombineLatest(menuBarManager.$isMenuBarHiddenBySystem,
     /// $isMissionControlActive)` pipeline (wave 3).
     private func updateAlphaForMenuBarVisibility() {
@@ -326,12 +326,12 @@ final class MenuBarOverlayPanel: NSPanel, @unchecked Sendable {
             .store(in: &c)
 
         if let appState {
-            // `menuBarManager` is now `@Observable` (wave 3), so it no longer
-            // has an `$isMenuBarHiddenBySystem` publisher to feed a
-            // `CombineLatest`. `isMissionControlActive`'s side of the old
-            // pairing is now handled by its own `didSet` calling
-            // `updateAlphaForMenuBarVisibility()`, which combines it with
-            // `cachedIsMenuBarHiddenBySystem`, kept in sync below.
+            // menuBarMa
```

**File**: `Thaw/MenuBar/Appearance/MissionControlDetector.swift` (modified, +30/-26)
```diff
@@ -16,9 +16,9 @@ import Observation
 /// probe window against the position it was created at ("at rest"). When
 /// Mission Control activates, the window server displaces every window on
 /// screen — including ours — to arrange it in the Mission Control grid.
-/// AppKit's own `frame` does not reflect that displacement (the window
+/// AppKit's own frame does not reflect that displacement (the window
 /// server moves the window without telling AppKit), so the actual bounds
-/// have to be queried directly through `Bridging.getWindowBounds(for:)`.
+/// have to be queried directly through Bridging.getWindowBounds(for:).
 ///
 /// One probe window is enough for the whole app: Mission Control displaces
 /// every on-screen window together, so a single representative window is
@@ -30,62 +30,62 @@ import Observation
 ///
 /// ## Known limitation: display changes while Mission Control is open
 ///
-/// `didChangeScreenParametersNotification` clears `probeAtRestOrigin` so the
+/// didChangeScreenParametersNotification clears probeAtRestOrigin so the
 /// baseline gets re-latched, but re-latching just adopts whatever origin the
-/// next `tick()` observes. If a display reconfiguration happens *while*
-/// Mission Control is open, that tick latches the **displaced** position as
+/// next tick() observes. If a display reconfiguration happens while
+/// Mission Control is open, that tick latches the displaced position as
 /// "at rest". Mission Control then exits, the probe returns to its true
 /// resting position, and the detector reads that as displacement — a
-/// false-positive `isActive` that persists until the next display change.
+/// false-positive isActive that persists until the next display change.
 /// This is much narrower than the Step 1 bug (which never re-latched at
 /// all, so it stayed wedged forever), but it's real and worth knowing about.
 /// The likely root fix is to stop sampling a baseline entirely and instead
 /// compare the probe window's actual bounds against its own AppKit
-/// `frame.origin`, which per this type's own premise never moves under
+/// frame.origin, which per this type's own premise never moves under
 /// Mission Control. That requires a coordinate-space conversion —
-/// `Bridging.getWindowBounds` is top-left origin (window server/Core
-/// Graphics), `NSWindow.frame` is bottom-left origin (AppKit) — and can't be
+/// Bridging.getWindowBounds is top-left origin (window server/Core
+/// Graphics), NSWindow.frame is bottom-left origin (AppKit) — and can't be
 /// validated without running the app, so it's out of scope here.
 @MainActor
 @Observable
 final class MissionControlDetector {
     /// The polling interval used while nothing suggests Mission Control
     /// might be starting or ending.
     ///
-    /// This is the term that bounds how long it takes to *notice*
+    /// This is the term that bounds how long it takes to notice
     /// displacement has started at all — no step-up signal can help here,
     /// since Mission Control does not change the active space and so does
-    /// not fire `activeSpaceDidChangeNotification`. Combined with the 0.1s
-    /// confirmation debounce in `tick()`, the worst-case time to flip
-    /// `isActive` to `true` from a cold idle state is roughly
-    /// `idleInterval + 0.1`. Kept close to the old fixed 10 Hz rate's
+    /// not fire activeSpaceDidChangeNotification. Combined with the 0.1s
+    /// confirmation debounce in tick(), the worst-case time to flip
+    /// isActive to true from a cold idle state is roughly
+    /// idleInterval + 0.1. Kept close to the old fixed 10 Hz rate's
     /// ~0.2s detection latency rather than trading detection speed for
     /// idle-cost savings; the bulk of the win in this type is already
     /// banked by going from one probe per panel to one for the whole app.
     static let idleInterval: TimeInterval = 0.2
 
-    /// The polling interval used while `isActive` is `true`, or for
-    /// `activeSignalW
```

**File**: `Thaw/MenuBar/ControlItem/ControlItem.swift` (modified, +74/-56)
```diff
@@ -60,12 +60,16 @@ final class ControlItem {
         static let expanded: CGFloat = 10000
     }
 
+    /// Nonzero seed length used to make AppKit materialize a WindowServer
+    /// window before the intended control-item length is applied.
+    static nonisolated let statusItemMaterializationLength: CGFloat = 1
+
     /// Storage for a control item's underlying status item.
     private final class StatusItemStorage {
         let statusItem: NSStatusItem
         let constraint: NSLayoutConstraint?
 
-        /// Set once `dispose()` has run, so `deinit` doesn't remove the
+        /// Set once dispose() has run, so deinit doesn't remove the
         /// status item a second time.
         private var isDisposed = false
 
@@ -74,7 +78,13 @@ final class ControlItem {
         init(controlItem: ControlItem) {
             ControlItemDefaults.preflightSetup(for: controlItem.identifier)
 
-            self.statusItem = NSStatusBar.system.statusItem(withLength: 0)
+            // A zero-length status item can remain a synthetic AppKit window
+            // whose windowNumber has no representable CGWindowID. Give AppKit
+            // one point to materialize a real WindowServer window; the first
+            // updateStatusItem pass immediately applies the intended length.
+            self.statusItem = NSStatusBar.system.statusItem(
+                withLength: ControlItem.statusItemMaterializationLength
+            )
             self.statusItem.autosaveName = controlItem.identifier.rawValue
 
             if let button = statusItem.button {
@@ -111,11 +121,11 @@ final class ControlItem {
         }
 
         /// Explicitly tears down the status item, ahead of (and instead of)
-        /// relying on `deinit`. Used by `ControlItem.recreateStatusItem()`
+        /// relying on deinit. Used by ControlItem.recreateStatusItem()
         /// so the old status item is fully removed — and its position
-        /// cached to the shared `autosaveName` slot — before a new
-        /// `StatusItemStorage` is constructed at that same autosave name.
-        /// Without this, the new `NSStatusItem` would briefly exist
+        /// cached to the shared autosaveName slot — before a new
+        /// StatusItemStorage is constructed at that same autosave name.
+        /// Without this, the new NSStatusItem would briefly exist
         /// alongside the old one under the same autosaveName, and the old
         /// one's later, deinit-driven removal would overwrite the autosave
         /// slot with its own (possibly stale/garbage, in the #754 failure
@@ -150,27 +160,27 @@ final class ControlItem {
         }
     }
 
-    /// The control item's hiding state (`@Published`).
+    /// The control item's hiding state (@Published).
     @Published var state = HidingState.hideSection
 
-    /// The control item's window (`@Published`).
+    /// The control item's window (@Published).
     @Published private(set) var window: NSWindow?
 
-    /// The control item's frame (`@Published`).
+    /// The control item's frame (@Published).
     @Published private(set) var frame: CGRect?
 
-    /// The control item's screen (`@Published`).
+    /// The control item's screen (@Published).
     @Published private(set) var screen: NSScreen?
 
-    /// The control item's frame, if it is onscreen (`@Published`).
+    /// The control item's frame, if it is onscreen (@Published).
     @Published private(set) var onScreenFrame: CGRect?
 
     /// Whether the menu bar accepted this control item but is not rendering
     /// it — most often because macOS parked it in the notch dead zone
-    /// (`@Published`).
+    /// (@Published).
     ///
-    /// Derived from `NSWindow.occlusionState`, so unlike the image cache it
-    /// needs no Screen Recording grant. See ``ControlItemOcclusion`` for why
+    /// Derived from NSWindow.occlusionState, so unlike the image cache it
+    /// needs no Screen Recording grant. See ControlItemOcclusion for why
     /// the un
```

#### Recent Merged Pull Requests:
- **PR #1208** (2026-09-28): docs(readme): add Star History rank and Vercel OSS Program badges (@diazdesandi)
- **PR #1206** (closed): build(deps): bump the swift group with 2 updates (@dependabot[bot])
- **PR #1198** (2026-09-27): New Crowdin updates (@stonerl)
- **PR #1192** (2026-09-27): feat(menubar): move circuit breaker, #1190 drop fix, beta updates on macOS 27, and codebase cleanup (@diazdesandi)
- **PR #1185** (2026-09-24): New Crowdin updates (@stonerl)
- **PR #1184** (2026-09-24): ci: run on macOS 26 and 27, and bring workflows up to date (@diazdesandi)
- **PR #1183** (2026-09-24): chore(release): 2.1.0-beta.5 (@diazdesandi)
- **PR #1177** (2026-09-22): New Crowdin updates (@stonerl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
