# Forensic Learning Record (Deep Inspection): milanvarady/Applite

> **Canonical Artifact**: `07_PROJECT_LEARNING/milanvarady-applite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milanvarady/Applite](https://github.com/milanvarady/Applite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:27:16.913Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milanvarady/Applite`
- **Description**: A native macOS app store for software that isn't on the App Store, backed by Homebrew Cask
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7064 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Applite/Resources/askpass.js`
```
#!/usr/bin/env osascript -l JavaScript
//
// Applite askpass helper.
//
// Invoked by `sudo -A` (via the SUDO_ASKPASS env var set in Shell.swift) whenever a
// brew operation needs elevated privileges. It shows a password dialog and prints
// what the user types to stdout for sudo.
//
// The user types directly into this dialog, so the password never passes through
// Applite's own memory, arguments, or disk — it goes straight from here to sudo.
//
// The dialog shows Applite's icon so it's clear which app is asking. Applite writes
// its icon to its Application Support folder (see AskpassIcon.swift); we recompute
// that path here rather than reading an env var, because sudo sanitizes the askpass
// helper's environment. If the icon is missing for any reason we fall back to the
// system caution icon.

ObjC.import('stdlib')      // for $.exit
ObjC.import('Foundation')  // for the path + file-existence lookups below

const app = Application.currentApplication()
app.includeStandardAdditions = true

const appSupport = $.NSSearchPathForDirectoriesInDomains($.NSApplicationSupportDirectory, $.NSUserDomainMask, true).js[0].js
const iconPath = appSupport + '/Applite/prompt-icon.png'
const iconExists = $.NSFileManager.defaultManager.fileExistsAtPath(iconPath)

const options = {
  defaultAnswer: '',
  buttons: ['Cancel', 'OK'],
  defaultButton: 'OK',
  hiddenAnswer: true,
  withIcon: iconExists ? Path(iconPath) : 'caution',
}

try {
  const result = app.displayDialog(
    'Applite needs administrator privileges to continue.\n\nEnter your login password to allow it:',
    options
  )
  // Only reached when the user confirms — a button titled "Cancel" (and Esc) throws
  // instead of returning. The result is the script's stdout, which sudo reads.
  result.textReturned
} catch (e) {
  // User cancelled — exit non-zero so sudo aborts instead of retrying with a blank
  // password.
  $.exit(255)
}

```

### Core Architecture Module: `Scripts/Localization/apple_terms.py`
```
#!/usr/bin/env python3
"""How does macOS itself render a given English UI string?

Modern macOS keeps localizations in .loctable files — one plist per table, keyed by language, so a
single file holds every language's copy of the same keys. Find the keys whose "en" value matches,
then read those keys out of each target language. Falls back to .strings pairs for older bundles.
"""
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

LANGS = {"hu": ["hu"], "fr": ["fr"], "ja": ["ja"],
         "zh-Hans": ["zh_CN", "zh-Hans"], "zh-HK": ["zh_HK", "zh-HK", "zh_TW"], "tr": ["tr"]}

ROOTS = [
    "/System/Library/Frameworks",
    "/System/Library/PrivateFrameworks",
    "/System/Applications",
    "/System/Library/CoreServices",
]


def load(path: Path):
    cp = subprocess.run(["plutil", "-convert", "json", "-o", "-", str(path)],
                        capture_output=True, text=True)
    if cp.returncode != 0 or not cp.stdout.strip():
        return None
    try:
        return json.loads(cp.stdout)
    except json.JSONDecodeError:
        return None


def loctables():
    for root in ROOTS:
        yield from Path(root).rglob("*.loctable")


def main(targets):
    hits = {t: {lang: Counter() for lang in LANGS} for t in targets}
    scanned = 0
    for f in loctables():
        table = load(f)
        if not isinstance(table, dict) or "en" not in table:
            continue
        en = table["en"]
        if not isinstance(en, dict):
            continue
        scanned += 1
        for target in targets:
            keys = [k for k, v in en.items() if isinstance(v, str) and v == target]
            if not keys:
                continue
            for lang, codes in LANGS.items():
                for code in codes:
                    loc = table.get(code)
                    if not isinstance(loc, dict):
                        continue
                    for k in keys:
                        v = loc.get(k)
                        if isinstance(v, str) and v and v != target:
                            hits[target][lang][v] += 1
                    break
    print(f"(scanned {scanned} localization tables)\n")
    out = {}
    for target in targets:
        print(f"=== {target!r}")
        out[target] = {}
        for lang in LANGS:
            top = hits[target][lang].most_common(4)
            out[target][lang] = top
            print(f"  {lang:8}", ", ".join(f"{v}  ×{n}" for v, n in top) if top else "(not found)")
        print()
    Path("apple_terms.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("saved: apple_terms.json")


if __name__ == "__main__":
    main(sys.argv[1:])

```

### Core Architecture Module: `Scripts/Localization/apply_translations.py`
```
#!/usr/bin/env python3
"""Apply a batch of translations to Localizable.xcstrings.

Batch format (a module exposing TRANSLATIONS and optionally FIXES):

    TRANSLATIONS = { "<source key>": {"hu": "...", "fr": "...", ...}, ... }
    FIXES        = { "<source key>": {"hu": "...", ...}, ... }   # overwrites existing values

TRANSLATIONS refuses to overwrite an existing value (that's what FIXES is for), so re-running a
batch is safe and a typo'd key is reported rather than silently creating a dead entry.
"""
import importlib.util
import json
import sys
from pathlib import Path

CATALOG = Path("Localizable.xcstrings")
LANGS = ("hu", "fr", "ja", "zh-Hans", "zh-HK", "tr")


def localization(text):
    """A batch value is either a plain string, or a dict for a language that inflects by count:
    {"one": …, "other": …} for one counted argument, or {"_raw": {…}} to pass a localization
    object through verbatim (used for two-count strings, which need `substitutions`)."""
    if isinstance(text, str):
        return {"stringUnit": {"state": "translated", "value": text}}
    if "_raw" in text:
        return text["_raw"]
    return {"variations": {"plural": {
        cat: {"stringUnit": {"state": "translated", "value": v}}
        for cat, v in text.items()
    }}}


def reject_duplicate_keys(path: Path) -> None:
    """A dict literal with the same key twice keeps only the last one — silently. Grouping a batch
    by language makes that easy to do (one key touched from two sections) and impossible to see:
    the applied count still looks right because the duplicates are gone before it's taken. So parse
    the source and refuse to run rather than trust the dict."""
    import ast
    from collections import Counter

    tree = ast.parse(path.read_text())
    problems = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
                and node.targets[0].id in ("TRANSLATIONS", "FIXES")
                and isinstance(node.value, ast.Dict)):
            continue
        keys = [k.value for k in node.value.keys if isinstance(k, ast.Constant)]
        for key, n in Counter(keys).items():
            if n > 1:
                problems.append(f"{node.targets[0].id}: {key!r} appears {n}×")
    if problems:
        raise SystemExit("Duplicate keys — merge them into one entry:\n  "
                         + "\n  ".join(problems))


def load(path: Path):
    reject_duplicate_keys(path)
    spec = importlib.util.spec_from_file_location("batch", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "TRANSLATIONS", {}), getattr(mod, "FIXES", {})


def main() -> int:
    translations, fixes = load(Path(sys.argv[1]))
    cat = json.loads(CATALOG.read_text())
    S = cat["strings"]

    unknown, collisions, added, changed = [], [], 0, 0

    for key, values in translations.items():
        if key not in S:
            unknown.append(key)
            continue
        loc = S[key].setdefault("localizations", {})
        for lang, text in values.items():
            if lang not in LANGS:
                unknown.append(f"{key} -> bad language {lang!r}")
                continue
            if lang in loc:
                collisions.append(f"{key} [{lang}]")
                continue
            loc[lang] = localization(text)
            added += 1

    for key, values in fixes.items():
        if key not in S:
            unknown.append(key)
            continue
        loc = S[key].setdefault("localizations", {})
        for lang, text in values.items():
            new = localization(text)
            if loc.get(lang) == new:
                continue
            loc[lang] = new
            changed += 1

    print(f"translations added : {added}")
    print(f"existing fixed     : {changed}")
    if collisions:
        print(f"SKIPPED (already had a value; use FIXES): {len(collisions)}")
        for c in collisions[:10]:
            print("   ", c)
    if unknown:
        print(f"UNKNOWN KEYS ({len(unknown)}) — nothing written:")
        for k in unknown:
            print("   ", repr(k))
        return 1

    # Preserve key order; Xcode re-sorts on its next save.
    CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False, separators=(",", " : ")) + "\n")
    print("written:", CATALOG)
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `Scripts/Localization/glossary_audit.py`
```
#!/usr/bin/env python3
"""Cross-reference the catalog against the glossary in TRANSLATING.md.

Two checks:
  1. exact — a key that IS a glossary term must carry the glossary's value
  2. contains — a longer string containing the English term should contain the glossary term
     (advisory: inflection means a literal match often won't appear, so this only reports)
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(".")
LANGS = ("hu", "fr", "ja", "zh-Hans", "zh-HK", "tr")


def parse_glossary():
    """Every markdown row of the form | Term | hu | fr | ja | zh-Hans | zh-HK | tr |"""
    terms = {}
    for line in (REPO / "TRANSLATING.md").read_text().splitlines():
        if not line.startswith("|") or line.startswith("|---"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) != 7:
            continue
        term = re.sub(r"\s*[¹²³⁴⁵⁶⁷]+$", "", cells[0]).strip()
        if term in ("Term", "") or cells[1] in ("hu", "Register"):
            continue
        vals = {}
        for lang, cell in zip(LANGS, cells[1:]):
            v = re.sub(r"\s*[¹²³⁴⁵⁶⁷]+$", "", cell).strip()
            if v and v != "—":
                vals[lang] = v
        terms[term] = vals
    return terms


def main():
    glossary = parse_glossary()
    S = json.loads((REPO / "Localizable.xcstrings").read_text())["strings"]
    print(f"glossary terms parsed: {len(glossary)}\n")

    mismatches = []
    for term, vals in glossary.items():
        # "Dismiss / Close" covers two keys
        for key in [k.strip() for k in term.split("/")]:
            entry = S.get(key)
            if not entry:
                continue
            loc = entry.get("localizations") or {}
            for lang, want in vals.items():
                got = ((loc.get(lang) or {}).get("stringUnit") or {}).get("value")
                if got is not None and got != want:
                    mismatches.append((key, lang, got, want))

    print(f"keys that are glossary terms but don't match: {len(mismatches)}")
    for key, lang, got, want in mismatches:
        print(f"   {key:16} [{lang:8}] {got!r}  ->  {want!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `Scripts/Localization/sync_catalog.py`
```
#!/usr/bin/env python3
"""Sync Localizable.xcstrings from the compiler's extracted .stringsdata.

Xcode updates the String Catalog only when you build inside the IDE; `xcodebuild` still runs
extraction (SWIFT_EMIT_LOC_STRINGS=YES) but writes the result to .stringsdata and never back to the
catalog. This reads those files — the authoritative key + comment for every localized literal — and
merges them in.

Never touches `localizations`: translations are only ever added or removed by a translator.
"""
import json
import plistlib
import subprocess
import sys
from pathlib import Path

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OBJDIR = Path(sys.argv[2])
CATALOG = REPO / "Localizable.xcstrings"
APPLY = "--apply" in sys.argv


def extracted() -> dict[str, str | None]:
    """key -> comment, across every .stringsdata the Applite target produced.

    One key can be used at several call sites with different comments (e.g. "Error"); Xcode joins
    those with newlines into one comment, so we do the same rather than letting the last one win.
    """
    seen: dict[str, list[str]] = {}
    for f in sorted(OBJDIR.glob("*.stringsdata")):
        # The files vary between binary/XML plist and JSON; plutil normalizes all of them.
        cp = subprocess.run(["plutil", "-convert", "json", "-o", "-", str(f)],
                            capture_output=True, text=True)
        if cp.returncode != 0 or not cp.stdout.strip():
            continue
        data = json.loads(cp.stdout)
        for entries in (data.get("tables") or {}).values():
            for e in entries:
                key = e.get("key")
                if key is None:
                    continue
                bucket = seen.setdefault(key, [])
                c = e.get("comment")
                if c and c not in bucket:
                    bucket.append(c)
    return {k: ("\n".join(v) if v else None) for k, v in seen.items()}


def main() -> int:
    live = extracted()
    cat = json.loads(CATALOG.read_text())
    S = cat["strings"]

    added, recomment, revived, staled = [], [], [], []

    for key, comment in sorted(live.items()):
        if key not in S:
            added.append(key)
        entry = S.setdefault(key, {})
        if entry.get("extractionState") == "stale":
            del entry["extractionState"]
            revived.append(key)
        existing = entry.get("comment")
        # Same set of lines in a different order isn't a change worth churning the file for.
        same = existing and set(existing.split("\n")) == set(comment.split("\n")) if comment else False
        if comment and not same and existing != comment:
            recomment.append((key, existing, comment))
            entry["comment"] = comment

    for key, entry in S.items():
        if key in live:
            continue
        # 'manual' entries are author-added and legitimately absent from source; leave them.
        if entry.get("extractionState") in (None,):
            entry["extractionState"] = "stale"
            staled.append(key)

    print(f"extracted from source : {len(live)}")
    print(f"catalog keys          : {len(S)}")
    print(f"  + added             : {len(added)}")
    print(f"  ~ comment set/changed: {len(recomment)}")
    print(f"  ^ revived from stale : {len(revived)}")
    print(f"  - newly marked stale : {len(staled)}")
    for k in added:
        print("   ADD  ", repr(k[:80]))
    for k in staled:
        print("   STALE", repr(k[:80]))

    if APPLY:
        # Preserve the file's existing key order: Xcode sorts with a locale-aware collation
        # (punctuation first), not codepoint order, so re-sorting here would churn the whole
        # file. New keys land at the end; Xcode normalizes the order on its next save.
        CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False, separators=(",", " : ")) + "\n")
        print("\nwritten:", CATALOG)
    else:
        print("\n(dry run — pass --apply to write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `Scripts/Release/appcast_insert.py`
```
#!/usr/bin/env python3
"""Insert one <item> at the top of appcast.xml, or validate the feed.

    appcast_insert.py appcast.xml --check-only
    appcast_insert.py appcast.xml --max-version
    appcast_insert.py appcast.xml --in-place --short 1.4.0 --build 19 ...

The insert is a text splice, not an XML re-serialisation: `ElementTree` would
rewrite the whole file (attribute order, self-closing tags, indentation) and turn
every release into an unreviewable diff. We parse only to *validate* — before and
after — and let the bytes of the existing items through untouched.

Stdlib only, like the rest of Scripts/.
"""

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle"
NS = {"sparkle": SPARKLE_NS}

# Matches the existing 1.2.5 item: an empty element, not self-closing.
CRITICAL_LINE = "            <sparkle:criticalUpdate></sparkle:criticalUpdate>\n"

TEMPLATE = """\
        <item>
            <title>{short}</title>
            <pubDate>{pubdate}</pubDate>
            <sparkle:version>{build}</sparkle:version>
            <sparkle:shortVersionString>{short}</sparkle:shortVersionString>
            <sparkle:minimumSystemVersion>{minos}</sparkle:minimumSystemVersion>
            <sparkle:releaseNotesLink>
                {notes_url}
            </sparkle:releaseNotesLink>
{critical}\
            <enclosure url="{url}" length="{length}" type="application/octet-stream"\
 sparkle:edSignature="{sig}"/>
        </item>
"""

# Sparkle Ed25519 signatures are 64 raw bytes -> 86 base64 chars plus "==".
SIG_RE = re.compile(r"[A-Za-z0-9+/]{86}==")
# RFC 822, as emitted by `LC_ALL=C date "+%a, %d %b %Y %H:%M:%S %z"`.
PUBDATE_RE = re.compile(
    r"[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} [+-]\d{4}"
)


def fail(msg):
    sys.exit(f"appcast: {msg}")


def channel(text):
    """Parse and return the single <channel>, rejecting anything unexpected."""
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        fail(f"not well-formed XML: {exc}")

    channels = root.findall("channel")
    if len(channels) != 1:
        fail(f"expected exactly 1 <channel>, found {len(channels)}")

    titles = channels[0].findall("title")
    if len(titles) != 1:
        fail(
            f"<channel> has {len(titles)} <title> elements, expected 1 — "
            "delete the duplicate <title>Applite</title> in appcast.xml"
        )
    return channels[0]


def item_versions(text):
    """Validate item ordering/uniqueness and return build numbers, newest first."""
    items = channel(text).findall("item")
    if not items:
        fail("feed has no <item> elements")

    versions = []
    for item in items:
        raw = item.findtext("sparkle:version", namespaces=NS)
        short = item.findtext("sparkle:shortVersionString", namespaces=NS) or "?"
        if raw is None:
            fail(f"item {short} has no <sparkle:version>")
        try:
            versions.append(int(raw.strip()))
        except ValueError:
            fail(f"item {short} has a non-numeric <sparkle:version>: {raw!r}")

    if len(set(versions)) != len(versions):
        fail(f"duplicate sparkle:version values in the feed: {versions}")
    if versions != sorted(versions, reverse=True):
        fail(f"items are not ordered newest-first: {versions}")
    return versions


def short_versions(text):
    return [
        (i.findtext("sparkle:shortVersionString", namespaces=NS) or "").strip()
        for i in channel(text).findall("item")
    ]


ITEM_RE = re.compile(r"^[ \t]*<item>.*?^[ \t]*</item>[ \t]*\r?\n", re.S | re.M)


def drop_item(text, short):
    """Remove the <item> for `short`, returning (new_text, was_present).

    A text splice again, so the surrounding items keep their exact bytes.
    """
    for match in ITEM_RE.finditer(text):
        if f"<sparkle:shortVersionString>{short}</sparkle:shortVersionString>" in match.group(0):
            return text[: match.start()] + text[match.end():], True
    return text, False


def validate_new_item(args, text, published, replacing):
    build = int(args.build)
    # When replacing, the item being replaced is not competition for itself.
    others = [v for v in published if v != build] if replacing else published
    if others and build <= max(others):
        fail(f"build {build} must be greater than the published maximum {max(others)}")
    if not replacing and args.short in short_versions(text):
        fail(f"version {args.short} is already in the feed "
             "(pass --replace-existing to rewrite it)")
    if not SIG_RE.fullmatch(args.sig or ""):
        fail(f"edSignature is not a Sparkle Ed25519 signature: {args.sig!r}")
    if not (args.length or "").isdigit():
        fail(f"length is not a number: {args.length!r}")
    if int(args.length) < 1_000_000:
        fail(f"implausible enclosure length ({args.length} bytes) — wrong file?")
    if not PUBDATE_RE.fullmatch(args.pubdate or ""):
        fail(
            f"pubDate is not RFC 822: {args.pubdate!r}\n"
            "        generate it with: LC_ALL=C date '+%a, %d %b %Y %H:%M:%S %z'"
        )
    if not re.fullmatch(r"\d+\.\d+(\.\d+)?", args.minos or ""):
        fail(f"minimumSystemVersion looks wrong: {args.minos!r}")
    if not (args.notes_url or "").startswith("https://"):
        fail(f"release notes URL must be https: {args.notes_url!r}")
    if not (args.url or "").startswith("https://"):
        fail(f"enclosure URL must be https: {args.url!r}")
    return build


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("appcast", type=Path)
    parser.add_argument("--check-only", action="store_true",
                        help="validate the feed and exit")
    parser.add_argument("--max-version", action="store_true",
                        help="print the highest published sparkle:version")
    parser.add_argument("--signature-of", metavar="SHORTVERSION",
                        help="print '<edSignature> <length>' for a published version")
    parser.add_argument("--list-versions", action="store_true",
                        help="print published shortVersionStrings, newest first")
    parser.add_argument("--in-place", action="store_true",
                        help="rewrite the file (default: print to stdout)")
    parser.add_argument("--critical", action="store_true",
                        help="mark the update critical")
    parser.add_argument("--replace-existing", action="store_true",
                        help="rewrite the item for this version if it is already present")
    for flag in ("short", "build", "minos", "notes-url", "url", "length", "sig", "pubdate"):
        parser.add_argument("--" + flag)
    args = parser.parse_args()

    text = args.appcast.read_text(encoding="utf-8")
    published = item_versions(text)  # the feed must be valid before we touch it

    if args.check_only:
        return
    if args.max_version:
        print(max(published))
        return
    if args.list_versions:
        print("\n".join(short_versions(text)))
        return
    if args.signature_of:
        for item in channel(text).findall("item"):
            short = (item.findtext("sparkle:shortVersionString", namespaces=NS) or "").strip()
            if short != args.signature_of:
                continue
            enc = item.find("enclosure")
            if enc is None:
                fail(f"item {short} has no <enclosure>")
            print(enc.get(f"{{{SPARKLE_NS}}}edSignature"), enc.get("length"))
            return
        fail(f"version {args.signature_of} is not in the feed")

    missing = [f for f in ("short", "build", "minos", "notes_url", "url", "length", "sig",
                           "pubdate") if not getattr(args, f)]
    if missing:
        fail("missing required options: " + ", ".join("--" + m.replace("_", "-")
                                                      for m in mi
```

### Core Architecture Module: `Scripts/Release/notes_to_markdown.py`
```
#!/usr/bin/env python3
"""Write website-notes.md into applite-site as a release-notes page.

    notes_to_markdown.py website-notes.md --version 1.4.3 --date 2026-10-01 \
        --out ~/GitHub/applite-site/src/content/releases

Replaces notes_to_swift.py, which emitted a Swift dictionary entry to paste into
the Vapor app that used to serve aerolite.dev. That app is gone; applite.app is a
static site whose release notes are markdown files in a content collection.

The conversion is mostly nothing, which is the point: website-notes.md already
uses the four headings and the bullet style the site renders. This adds
frontmatter, drops the instructional comments, and orders the sections. It does
not touch the prose.

The filename is the published URL. src/pages/releases/[version].astro fails the
build if a filename disagrees with its `version` frontmatter, so the two are
written from the same value here.
"""

import argparse
import re
import sys
from pathlib import Path

# Rendered in this order regardless of the order they were written in, so the
# archive reads consistently across versions.
SECTIONS = ["New Features", "Improvements", "Fixes", "Known Issues"]

DRAFT_SENTINEL = "APPLITE-RELEASE-NOTES-DRAFT"


def parse(md):
    """Split the notes into {heading: [bullets]}, keyed case-insensitively."""
    if DRAFT_SENTINEL in md:
        sys.exit(
            f"notes: {DRAFT_SENTINEL} is still present — the notes have not been "
            "written yet."
        )

    known = {h.lower(): h for h in SECTIONS}
    found = {}
    current = None

    for line in md.splitlines():
        heading = re.match(r"\s*#{1,6}\s+(.+?)\s*$", line)
        if heading:
            current = known.get(heading.group(1).lower())
            if current and current not in found:
                found[current] = []
            continue
        bullet = re.match(r"\s*[-*+]\s+(.+?)\s*$", line)
        if bullet and current:
            found[current].append(bullet.group(1))

    if not any(found.values()):
        sys.exit(
            "notes: no bullets found under any of "
            f"{', '.join(SECTIONS)} — nothing to publish."
        )
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("notes", type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--date", required=True, help="ISO, e.g. 2026-10-01")
    parser.add_argument("--critical", action="store_true")
    parser.add_argument("--out", required=True, type=Path, help="content/releases dir")
    args = parser.parse_args()

    if not re.fullmatch(r"\d+(\.\d+)*", args.version):
        sys.exit(f"notes: version {args.version!r} must look like 1.4.3 or 1.2")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.date):
        sys.exit(f"notes: date {args.date!r} must be ISO, e.g. 2026-10-01")
    if not args.out.is_dir():
        sys.exit(f"notes: {args.out} is not a directory — is applite-site checked out?")

    sections = parse(args.notes.read_text(encoding="utf-8"))

    body = []
    for heading in SECTIONS:
        bullets = sections.get(heading)
        if not bullets:
            continue
        body.append(f"### {heading}\n")
        body.extend(f"- {b}" for b in bullets)
        body.append("")

    front = [
        "---",
        f'version: "{args.version}"',
        f"date: {args.date}",
    ]
    if args.critical:
        front.append("critical: true")
    front += ["---", ""]

    target = args.out / f"{args.version}.md"
    target.write_text("\n".join(front) + "\n".join(body).rstrip() + "\n", encoding="utf-8")
    print(target)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #164** (2026-09-12): **Trim README badges and add a light/dark screenshot**
  *Symptoms*: ## Badges  Down from five to three, all linked, `flat-square` instead of the default bevel, and moved below the title so the project name is the first thing on the page rather than a badge row.  Dropped: - **Contributors** — already visible in the repo sidebar. - **Commits since latest release** — unlinked, and nobody reads "47 commits since v1.4.2". Its alt text (`GitHub commits since latest release (by SemVer including pre-releases)`) was what screen readers announced.  ## Screenshot  The single Discover capture becomes a `<picture>` element that serves a dark screenshot to readers on GitHub's dark theme. Both PNGs are committed under `docs/screenshots/` (~1 MB total) rather than hot-linked from an issue attachment, so they version with the repo instead of dangling off a `user-attachments` URL.  The `srcset` URLs are pinned to `raw.githubusercontent.com/.../main/...`, so **the images render broken in this PR preview** until it merges. Absolute raw URLs rather than relative paths on purpose: GitHub reliably rewrites and camo-proxies `src` on `<img>`, but its handling of relative paths in `<source srcset>` is less certain, and a silently-broken dark variant is the kind of thing that goes unnoticed for months.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01LtkqHQdHSbQDiRdydqmZvd

- **Issue #163** (2026-09-10): **Update the release docs and notes template for applite.app**
  *Symptoms*: Follow-up to the pipeline change, which moved the code but left the paperwork describing the old process.  `Scripts/Release/README.md` still told you to paste `AppliteReleaseModel.swift.txt` into aerolite's Swift, push it, then ssh to the VPS and run `docker compose`. That is the document you read *while cutting a release*, so it was worse than a stale link: instructions for a workflow that no longer exists, referencing a file the pipeline no longer produces.  `release.sh` also seeded `website-notes.md` with a template referring to "the aerolite snippet", so every future release would have started from a draft mentioning something gone.  The template now states that the file **ships verbatim**, which is the part worth knowing: 1.4.2's published page carried bold lead-ins that were not in its `website-notes.md`, meaning the generated output was edited afterwards. That is no longer possible, by design.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01WZEJ3XisHGixmdPA8myED2

- **Issue #162** (2026-09-10): **Point the in-app links at applite.app**
  *Symptoms*: The Help menu still sent people to `aerolite.dev`, now only a redirector, so every click took an extra hop to a domain being retired.  | Menu item | Was | Now | |---|---|---| | Website | `aerolite.dev/applite` | `applite.app` | | Troubleshooting | `aerolite.dev/applite/troubleshooting.html` | `applite.app/troubleshooting` | | Sponsor | PayPal donate link | `applite.app/#support` |  Also updates the troubleshooting link in `ComponentsInstallView`, which is what a user sees when the Homebrew bootstrap fails — the one that matters most, since it appears exactly when something has gone wrong.  **Sponsor points at the site, not at Ko-fi directly.** A menu item is compiled into the binary and cannot be changed once shipped, while that page can be edited any time. It also lets the reader choose between Ko-fi and GitHub Sponsors rather than choosing for them.  **Not changed:** the bundle identifier fallback in `UninstallSelf.swift` keeps `dev.aerolite.Applite`. Renaming the identifier would reset every user's settings, so it stays deliberately.  The two other hits were `static let dummy` SwiftUI preview fixtures. Updated so the retired domain does not linger in the source, but no user ever saw them.  Only future builds get these URLs; everything already installed keeps the old ones, which is what the `aerolite.dev` redirects are for. All five destinations verified live, including the `#support` anchor target.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://c

- **Issue #161** (2026-09-10): **Swap PayPal for Ko-fi in the Sponsor button**
  *Symptoms*: PayPal took roughly 10% of a €5 donation. Ko-fi settles through Stripe at about half that, and GitHub Sponsors takes nothing at all from personal sponsorships because GitHub covers the processing, so it stays first.  Also drops the nine commented placeholder lines the template ships with, which never described anything real about this project.  **The PayPal account should stay open.** Older builds of Applite open that link from the Help menu and cannot be changed retroactively, so it will keep receiving the occasional donation whatever this file says.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01WZEJ3XisHGixmdPA8myED2

- **Issue #159** (2026-09-05): **升级1.4后无法检测需要更新的应用（After upgrading to version 1.4, apps that need to be updated cannot be detected）**
  *Symptoms*: 先打开applite更新频道无法检测到需要更新的应用，先打开wailbrew检测到更新信息后applite刷新状态就可以看到了 If you open the Applite update channel and it doesn't detect any apps that need updating, open Wailbrew first to check for updates; once it detects them, refresh the Applite status and you'll see them.
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to fix this one. I traced the code and it looks like a 1.4 regression in how Applite refreshes Homebrew's metadata.  Root cause: `getOutdatedCasks()` (InstalledCaskService.swift) only runs `brew outdated --cask -q`, and `brew outdated` reports what's in Homebrew's *local* formula metadata. Nothing in the current tree refreshes that metadata: there is no `brew update` call anywhere, and the annex refresh (`refreshAnnexBrew` in AnnexBrewManager.swift) explicitly no-ops unless the annex is the selected brew (`guard BrewPaths.selectedBrewOption == .annex`). So for users on their own Homebrew (e.g. Wailbrew's), the outdated list is only as fresh as the last metadata update that happened outside Applite, which matches the report: open Wailbrew first (it runs `brew update`), then refresh Applite and the updates show up.  This wasn't always the case. The 1.4 annex commit (6626f52, "Replace first-run onboarding with a CLT-free annex Homebrew") removed `updateHomebrew()`, which ran 
  > Let me check this first. I'm not a at my computer right now, I'll get back to this in a few days. 
  > > Hi, I'd like to fix this one. I traced the code and it looks like a 1.4 regression in how Applite refreshes Homebrew's metadata. >  > Root cause: `getOutdatedCasks()` (InstalledCaskService.swift) only runs `brew outdated --cask -q`, and `brew outdated` reports what's in Homebrew's _local_ formula metadata. Nothing in the current tree refreshes that metadata: there is no `brew update` call anywhere, and the annex refresh (`refreshAnnexBrew` in AnnexBrewManager.swift) explicitly no-ops unless the annex is the selected brew (`guard BrewPaths.selectedBrewOption == .annex`). So for users on their own Homebrew (e.g. Wailbrew's), the outdated list is only as fresh as the last metadata update that happened outside Applite, which matches the report: open Wailbrew first (it runs `brew update`), then refresh Applite and the updates show up. >  > This wasn't always the case. The 1.4 annex commit ([6626f52](https://github.com/milanvarady/Applite/commit/6626f52d182e6b52d14a31443829cb39235e5595), "

- **Issue #158** (2026-08-16): **Take over the `brew services` function**
  *Symptoms*: Take over the `brew services` function
  **Post-Mortem & Fix Analysis**:
  > Thanks for the suggestion @axb-c!  `brew services` only works with formulae — it manages the launchd daemons that formulae install, and it has no cask support at all (Homebrew's implementation is formula-only). Applite is deliberately cask-only: it's meant to be an app store for regular Mac apps aimed at non-technical users, not a full Homebrew frontend. Adding service management would mean turning Applite into a formula manager as well, which is a much bigger change than it sounds, and background daemons are quite far from what most Applite users need.  So this isn't something I'm planning to add. But if you have a specific use case in mind, or if I've misunderstood what you meant, let me know and I'll take another look. 

- **Issue #156** (2026-08-04): **i18n: complete all six languages, add a glossary and the catalog tooling**
  *Symptoms*: Brings Hungarian, French, Japanese, Simplified Chinese, Traditional Chinese (HK) and Turkish to **100% of translatable strings** — 263 of 268 live keys; the other 5 are `shouldTranslate: false` (the empty fallback, the colon separator, and the product names Brew/Discord/GitHub). Every live key now carries a translator comment.  The 69 stale entries are **kept deliberately** as reference and are untouched throughout.  Translations were written by Claude rather than sent to the translators, then put through a full quality review (last commit) — see below.  ## Source changes that came out of it  - Every `LocalizedError.errorDescription` now uses `String(localized:comment:)` — **14 strings that were permanently English in all six languages** regardless of locale. - `AppAlert.message` stays `String` (it usually carries brew's own output) but now documents that it takes *resolved* text, so literals must be wrapped at the call site. - `"Are you sure you want to %@install Homebrew?"` split into two whole sentences. A spliced `"re"` fragment is untranslatable, and the Hungarian translation had dropped the placeholder entirely — so a **reinstall** prompt read as *install*. The confirm button branches to match. - `BrewPaths.brokenPathOrInstallMessage` deleted (unreferenced since the alert audit). - Plural variations added for 5 counted keys. Only French inflects after a numeral; Hungarian and Turkish take the bare singular after a number and Japanese/Chinese have no plural, so those get

- **Issue #155** (2026-08-04): **Testing: cover PR #154 in the harness, add an upgrade round**
  *Symptoms*: The manual E2E harness (`Testing/applite_test.py`) was current as of #153 but had never been updated for #154, whose 7-item device checklist was entirely unverified. Every item now has a phase.  Test-only — no app code changes.  ## New Round A phases  - **15 failed install** — red row on the card + Active Tasks entry + **no** dialog, since the alert audit moved brew-op failures off alerts. Forced deterministically by cancelling the sudo prompt on `FAIL_CASK=blackhole-2ch`: a small pkg cask that always needs admin, so the failure needs no network and no timing. - **16 taps + token collision** — that tap casks reach the catalog at all (the stream-truncation bug swallowed exactly these), and that a tap `rectangle` does not inherit core `rectangle`'s installed state (P2-29). - **17 sparkle** — toggles survive a Settings close/reopen (P3-19 snapshot drift), and "Check for Updates" disables during a check (P3-18). - **18 quit mid-install** — auto-verified via `brew_processes()` (P3-10).  ## New `upgrade` round (U0/U1)  `v1.3.1` → this build: the path every existing user takes, and the one nobody had tested.  It probes whether `$HOME`'s volume is case-sensitive, because the annex moved `Applite/homebrew` → `Applite/Homebrew` — the same directory on default APFS, a **different** one (old brew orphaned) on a case-sensitive volume. `PathOption` raw values did not shift between versions, so prefs carry over.  ## Tap fixture  Written by hand into `<prefix>/Library/Taps` — no git, no netw

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

### Incident Patch 1: `cea6b732` (2026-09-05)
**Commit Message**: Fix updates never being detected on a stale metadata cache

HOMEBREW_NO_AUTO_UPDATE, which Shell sets on every brew command, disables two
things rather than one: the git-based self-update that the CLT-free annex can't
run (intended) and Homebrew's lightweight JSON API metadata refresh (not
intended). In `api.rb`, `fetch_api_files!` resolves `stale_seconds` to nil when
`no_auto_update? && !force_api_auto_update?`, and `skip_download?` returns true
whenever that is nil — so `packages.<tag>.jws.json` is never re-downloaded.
`brew outdated --cask` then compares installed versions against a permanently
frozen catalog and reports nothing outdated, forever.

That is issue #159, and it explains the reporter's workaround exactly: opening
another Homebrew GUI refreshes the shared cache that Applite was forbidden from
touching, after which Applite's own refresh finally sees the updates.

HOMEBREW_FORCE_API_AUTO_UPDATE re-enables only the API refresh and leaves the
git self-update disabled, which is what the annex needs — it has no real git.
Brew throttles the check to one per HOMEBREW_API_AUTO_UPDATE_SECS (450s) since
`outdated` is in AUTO_UPDATE_COMMANDS, so it is safe on every call and need

**File**: `Applite/Core/Brew/Shell.swift` (modified, +8/-0)
```diff
@@ -445,6 +445,14 @@ enum Shell {
             // would pop the macOS CLT install dialog. Applite keeps the annex fresh by
             // re-fetching the tarball instead (see AnnexBrewManager.refreshAnnexBrew).
             "HOMEBREW_NO_AUTO_UPDATE": "1",
+            // …but HOMEBREW_NO_AUTO_UPDATE disables two things, not one: the git self-update above
+            // *and* the lightweight JSON API metadata refresh. Without the API refresh brew never
+            // re-downloads the cask catalog, so `brew outdated --cask` compares installed versions
+            // against a permanently frozen cache and reports nothing outdated, forever (issue #159).
+            // This re-enables only the API refresh, leaving the git self-update disabled. Brew
+            // throttles it to one check per HOMEBREW_API_AUTO_UPDATE_SECS (450s), so it is safe to
+            // set on every command.
+            "HOMEBREW_FORCE_API_AUTO_UPDATE": "1",
             // Pin brew to the system curl (always present on macOS, works without CLT) so it
             // never probes for a Homebrew-installed curl. Cask downloads and the portable-ruby
             // fetch both go through this. Combined with API mode (HOMEBREW_NO_INSTALL_FROM_API
```

---

### Incident Patch 2: `d25897c3` (2026-08-04)
**Commit Message**: Remove fixed sidebar width

Instead of a fixed sidbar width set a min and ideal size

**File**: `Applite/Navigation/ContentView.swift` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ struct ContentView: View {
         NavigationSplitView {
             SidebarView(selection: $selection)
                 .disabled(modifyingBrew)
-                .navigationSplitViewColumnWidth(216)
+                .navigationSplitViewColumnWidth(min: 200, ideal: 216)
         } detail: {
             if !searchInput.isEmpty {
                 SearchView(query: $searchInput)
```

---

### Incident Patch 3: `fa14d745` (2026-08-04)
**Commit Message**: Add TRANSLATING.md glossary; recover 15 fixes a duplicate-key bug dropped

GLOSSARY. TRANSLATING.md records the register rules and the agreed rendering of
the ~50 terms that recur across the UI, so the same button can't end up called
three things. The Apple column was read out of the .loctable files macOS itself
ships — matching English keys and reading the same key back per language — not
written from memory, and the method is documented so it can be re-run.

Frequency is evidence, not a verdict: the same English word is often several UI
concepts. "Note" resolves to Jegyzet/メモ/筆記 because that's the Notes *app*;
Applite means "remark", so it keeps Megjegyzés/備考/備註. "Utilities" resolves
most often to Launchpad's "Other" grouping rather than the folder. Every
deviation from Apple's top hit is listed with its reason.

BUG FOUND BY THE AUDIT. Cross-referencing the catalog against the glossary
showed terms I had already reported as fixed still holding their old values.
batch5 of the previous commit was grouped by language, so 11 keys appeared in
two sections each — and a Python dict literal keeps only the last occurrence,
silently. The applied count still looked right because the duplic

**File**: `Localizable.xcstrings` (modified, +15/-15)
```diff
@@ -677,7 +677,7 @@
         "fr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "%@ déinstaller avec succès!"
+            "value" : "%@ désinstallé avec succès !"
           }
         },
         "hu" : {
@@ -707,7 +707,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "%@ 已成功卸載"
+            "value" : "%@ 已成功解除安裝"
           }
         }
       }
@@ -2117,7 +2117,7 @@
         "hu" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "App Költöztetés"
+            "value" : "Appok költöztetése"
           }
         },
         "ja" : {
@@ -3042,13 +3042,13 @@
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "您确定要永久卸载 Applite 吗？"
+            "value" : "确定要永久卸载 Applite 吗？"
           }
         },
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "您確定要永久卸載Applite嗎？"
+            "value" : "確定要永久解除安裝 Applite 嗎？"
           }
         }
       }
@@ -5999,7 +5999,7 @@
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "更新の更新に失敗しました"
+            "value" : "アップデートの再取得に失敗しました"
           }
         },
         "tr" : {
@@ -6157,7 +6157,7 @@
         "hu" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "%@ letöltése sikertelen"
+            "value" : "%@ frissítése sikertelen"
           }
         },
         "ja" : {
@@ -7849,7 +7849,7 @@
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "インストール"
+            "value" : "インストール中"
           }
         },
         "tr" : {
@@ -12183,7 +12183,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "卸載"
+            "value" : "解除安裝"
           }
         }
       }
@@ -12265,7 +12265,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "卸載Applite"
+            "value" : "解除安裝 Applite"
           }
         }
       }
@@ -12348,7 +12348,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "卸載Applite…"
+            "value" : "解除安裝 Applite…"
           }
         }
       }
@@ -12413,7 +12413,7 @@
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "アンインストール"
+            "value" : "アンインストール中"
           }
         },
         "tr" : {
@@ -12431,7 +12431,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "正在卸載"
+            "value" : "正在解除安裝"
           }
         }
       }
@@ -12970,13 +12970,13 @@
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "公用设施"
+            "value" : "实用工具"
           }
         },
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "公用事業"
+            "value" : "公用程式"
           }
         }
       }
```

**File**: `TRANSLATING.md` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+# Translating Applite
+
+Applite ships in English plus Hungarian, French, Japanese, Simplified Chinese, Traditional Chinese
+(Hong Kong) and Turkish. Everything lives in `Localizable.xcstrings`; English is the source language
+and the key.
+
+This file is the **glossary**: the agreed rendering of the words that recur across the UI. Look a
+term up here before translating a string that contains it — a small app feels wrong much faster from
+calling the same button three different things than from any single awkward sentence.
+
+## Register
+
+Not a matter of taste — this is what the existing translations already established, and new strings
+must match:
+
+| | Register | Buttons |
+|---|---|---|
+| **hu** | formal (magázás) — *"Biztos véglegesen törli?"* | nominal: *Telepítés*, not *Telepítsd* |
+| **fr** | vouvoiement | infinitive: *Installer*. Narrow no-break space before `!` `?` `:` |
+| **ja** | です／ます | noun form; progress labels take *…中* |
+| **zh-Hans / zh-HK** | 你, not 您 (Apple's current style) | space between CJK and Latin/digits |
+| **tr** | formal *-iniz* | sentence case |
+
+## Glossary
+
+Values marked **Apple** were read out of the localization tables macOS itself ships — see
+[Method](#method). Where Applite deviates, the reason is given below the table; a deviation needs a
+reason, and "I'd have said it differently" isn't one.
+
+### Actions
+
+| Term | hu | fr | ja | zh-Hans | zh-HK | tr |
+|---|---|---|---|---|---|---|
+| Install | Telepítés | Installer | インストール | 安装 | 安裝 | Yükle |
+| Reinstall ¹ | Újratelepítés | Réinstaller | 再インストール | 重新安装 | 重新安裝 | Yeniden Yükle |
+| Uninstall | Eltávolítás | Désinstaller | アンインストール | 卸载 | 解除安裝 | Yüklemeyi Kaldır |
+| Update | Frissítés | Mettre à jour | アップデート | 更新 | 更新 | Güncelle |
+| Refresh | Frissítés | Actualiser | 更新 | 刷新 | 重新整理 | Yenile |
+| Download | Letöltés | Télécharger | ダウンロード | 下载 | 下載 | İndir |
+| Import | Importálás | Importer | 読み込む | 导入 | 輸入 | İçe Aktar |
+| Export | Exportálás | Exporter | 書き出す | 导出 | 輸出 | Dışa Aktar |
+| Open | Megnyitás | Ouvrir | 開く | 打开 | 開啟 | Aç |
+| Copy | Másolás | Copier | コピー | 拷贝 | 複製 | Kopyala |
+| Delete | Törlés | Supprimer | 削除 | 删除 | 刪除 | Sil |
+| Remove | Eltávolítás | Supprimer | 削除 | 移除 | 移除 | Kaldır |
+| Stop | Leállítás | Arrêter | 停止 | 停止 | 停止 | Durdur |
+| Cancel | Mégsem | Annuler | キャンセル | 取消 | 取消 | Vazgeç |
+| Retry | Újra ² | Réessayer | 再試行 | 重试 | 再試 | Yeniden Dene |
+| Try Again | Újrapróbálkozás | Réessayer | やり直す | 重试 | 再試 | Yeniden Dene |
+| Continue | Folytatás | Continuer | 続ける | 继续 | 繼續 | Sürdür |
+| Select All | Összes kijelölése | Tout sélectionner | すべてを選択 | 全选 | 全選 | Tümünü Seç |
+| Deselect All | Kijelölés megszüntetése ³ | Tout désélectionner | すべてを選択解除 | 取消全选 | 取消全選 | Seçimi Kaldır |
+| Dismiss / Close | Bezárás | Fermer | 閉じる | 关闭 | 關閉 | Kapat |
+| Search | Keresés | Rechercher | 検索 | 搜索 | 搜尋 | Ara |
+| Done | Kész | Terminé | 完了 | 完成 | 完成 | Bitti |
+
+### States
+
+| Term | hu | fr | ja | zh-Hans | zh-HK | tr |
+|---|---|---|---|---|---|---|
+| Installed | Telepítve | Installée | インストール済み | 已安装 | 已安裝 | Yüklü |
+| Not installed | Nincs telepítve | Non installée | 未インストール | 未安装 | 未安裝 | Yüklü değil |
+| Enabled | Bekapcsolva | Activée | 有効 | 已启用 | 已啟用 | Etkin |
+| Disabled | Letiltva | Désactivée | 無効 | 已停用 | 已停用 | Etkin değil |
+| Outdated | Elavult | Obsolète | アップデートあり | 有可用更新 | 有可用更新 | Güncel değil |
+| Deprecated | Elavult | Obsolète | 非推奨 | 已弃用 | 已棄用 | Artık önerilmiyor |
+| Failed | Sikertelen | Échec | 失敗 | 失败 | 失敗 | Başarısız |
+
+Adjectives in French agree with **l'application** (feminine): *Installée*, *Activée*, *Désactivée*.
+
+### Sections and nouns
+
+| Term | hu | fr | ja | zh-Hans | zh-HK | tr |
+|---|---|---|---|---|---|---|
+| Settings | Beállítások | Réglages | 設定 | 设置 | 設定 | Ayarlar |
+| General | Általános | Général | 一般 | 通用 | 一般 | Genel |
+| Advanced | Haladó | Avancé | 詳細 | 高级 | 進階 | İleri Düzey |
+| Options | Beállítások | Options | オプション | 选项 | 選項 | S
```

---

### Incident Patch 4: `1bf4ef63` (2026-08-04)
**Commit Message**: i18n: complete all six languages, fix errors in the existing ones

Takes hu, fr, ja, zh-Hans, zh-HK and tr from 56% to 100% of translatable
strings (262 of 267 live keys; the other 5 are shouldTranslate:false — the
empty fallback, the colon separator, and the product names Brew/Discord/GitHub).
The 68 stale entries are untouched, as reference.

Method: translated per string across all six languages rather than per language,
because the expensive part is establishing what a string is — which control, how
much room, what the surrounding copy says. Grouped by UI surface so that context
is paid for once per screen.

REGISTER, taken from the existing 144 translations rather than chosen fresh:
hu magázás; fr vouvoiement; ja です/ます with "…中" on progress labels; zh Apple's
你; tr formal -iniz. Buttons follow each language's macOS convention — nominal in
Hungarian ("Telepítés"), infinitive in French ("Installer").

"Install" — the app's most important verb — had no translation in any language.
It now agrees with the established "Installed" in each (hu Telepítés/Telepítve).

PLURALS: of the six, only French inflects after a numeral. Hungarian and Turkish
take the bare singular ("3 alkalmazás",



---

### Incident Patch 5: `716d3a61` (2026-08-04)
**Commit Message**: Review fixes: exact installed-matching, crash window, silent refresh

Three findings from the review of this branch.

1. Re-keying identity to fullToken turned P2-29's data loss into a false
   "installed" state. CaskViewModel.matches(anyOf:) accepted EITHER token,
   which was harmless while a token collision collapsed both casks into
   one view model — but both now exist. `brew list --cask --full-name`
   prints bare names for core casks, so {"firefox"} matched core firefox
   AND mytap/firefox: the tap cask appeared in Installed and Updates, and
   Uninstall would run against a cask that isn't installed.

   Verified against the real catalog: all 7,679 homebrew/cask rows have
   fullToken == token, and tap rows are qualified — so brew's full_name
   output aligns exactly with the fullToken column. Installed state now
   matches on fullToken only.

   `brew outdated --cask -q` is different: it prints BARE tokens even for
   tap casks (checked against an installed tap cask). That's ambiguous
   across taps and can't be made exact, so outdated matching stays loose
   but is gated on isInstalled — only one of two same-token casks can be
   the installed one, and installed state is 

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +6/-2)
```diff
@@ -652,8 +652,12 @@ final class BrewService {
             case .failed:
                 ok = false
             default:
-                // No marker seen — decide from the single brew query.
-                let listed = vm.matches(anyOf: brewTokens)
+                // No marker seen — decide from the single brew query. `list --full-name` is an
+                // exact identity match; `outdated -q` prints bare tokens, so it stays loose but can
+                // only mean *this* cask when it's the installed one.
+                let listed = kind == .install
+                    ? vm.matchesFullName(in: brewTokens)
+                    : (vm.isInstalled && vm.matchesBareToken(in: brewTokens))
                 switch kind {
                 case .install:
                     ok = listed
```

**File**: `Applite/Core/Brew/Shell.swift` (modified, +8/-1)
```diff
@@ -270,9 +270,16 @@ enum Shell {
                                     // final empty read, so waiting for the handler to report EOF would
                                     // hang the read loop forever — a worse failure than the truncation
                                     // this whole watchdog exists to avoid.
+                                    //
+                                    // And deliberately do NOT close the descriptor here. An already
+                                    // dispatched `readabilityHandler` can be inside `availableData`
+                                    // at this exact moment, and that raises an ObjC
+                                    // `NSFileHandleOperationException` on a closed descriptor —
+                                    // uncatchable from Swift, i.e. a crash. Clearing the handler and
+                                    // finishing the stream is enough to release the read loop; the
+                                    // descriptor closes with the `Pipe` when it deallocs.
                                     fileHandle.readabilityHandler = nil
                                     reachedEOF.withLock { $0 = true }
-                                    try? fileHandle.close()
                                     chunkFeed.finish()
                                     return
                                 }
```

**File**: `Applite/Core/CaskCore/CaskManager.swift` (modified, +8/-3)
```diff
@@ -220,7 +220,11 @@ final class CaskManager {
     /// load-failure alert's retry. Reloads the catalog, then — if the selected brew is valid — the
     /// installed/outdated state; otherwise re-runs `bootstrap` to try to recover, leaving the
     /// resulting `bootstrap.phase` to surface a brew that's genuinely unusable.
-    func loadData(forceSync: Bool = false) async {
+    /// Returns whether the load actually completed — callers that show "this needs refreshing"
+    /// affordances must not clear them on a load that silently did nothing (the broken-brew branch
+    /// below deliberately drops its error, so the return value is the only signal).
+    @discardableResult
+    func loadData(forceSync: Bool = false) async -> Bool {
         Self.logger.info("Starting data load process (forceSync: \(forceSync))")
 
         if forceSync { isRefreshingCatalog = true }
@@ -236,7 +240,7 @@ final class CaskManager {
                 alert.show(error: catalogError, title: "Couldn't load app catalog", actions: loadFailureActions)
             }
             await loadInstalledState()
-            return
+            return true
         }
 
         // Selected brew is invalid — attempt recovery (detect existing / reinstall annex).
@@ -255,14 +259,15 @@ final class CaskManager {
                 brew --version output: \(versionOutput)
                 """
             )
-            return
+            return false
         }
 
         // Recovered — the catalog alert is now the only possible surface, so raise it.
         if let catalogError {
             alert.show(error: catalogError, title: "Couldn't load app catalog", actions: loadFailureActions)
         }
         await loadInstalledState()
+        return catalogError == nil
     }
 
     /// Stage 1: catalog (categories + taps) from the local DB — fast, no brew CLI dependency.
```

**File**: `Applite/Core/CaskCore/CaskViewModel.swift` (modified, +20/-2)
```diff
@@ -65,8 +65,26 @@ final class CaskViewModel {
 
     /// True if this cask's short *or* full token is in `tokens`. Brew reports either form
     /// depending on the command, so membership checks must accept both.
-    func matches(anyOf tokens: Set<CaskId>) -> Bool {
-        tokens.contains(token) || tokens.contains(fullToken)
+    /// Exact identity match against names brew printed as `full_name` — `brew list --cask
+    /// --full-name`, and the same query in `reconcileBatch`.
+    ///
+    /// `full_name` is the bare token for core casks and tap-qualified otherwise, which is exactly
+    /// what `fullToken` holds (every `homebrew/cask` row has `fullToken == token`). Matching these
+    /// against the *bare* token instead would let a tap's `firefox` inherit core firefox's installed
+    /// state — harmless while the two collapsed into one view model, wrong now that `fullToken` is
+    /// the identity and both exist.
+    func matchesFullName(in names: Set<CaskId>) -> Bool {
+        names.contains(fullToken)
+    }
+
+    /// Loose match for brew output that prints **bare** tokens even for tap casks — `brew outdated
+    /// --cask -q` does, unlike `list --full-name`.
+    ///
+    /// A bare token can't distinguish two taps' `firefox`, so this is inherently ambiguous and must
+    /// only be applied to casks already known to be installed (see `markOutdated`), which narrows it
+    /// to the one cask that can actually be outdated.
+    func matchesBareToken(in names: Set<CaskId>) -> Bool {
+        names.contains(fullToken) || names.contains(token)
     }
 
     // MARK: - App Launch
```

**File**: `Applite/Core/CaskCore/CaskViewModelRegistry.swift` (modified, +14/-7)
```diff
@@ -41,26 +41,33 @@ final class CaskViewModelRegistry {
 
     // MARK: - Bulk State Updates
 
-    /// Reconciles a boolean flag across every view model against `tokens` (short or full form).
+    /// Reconciles a boolean flag across every view model using `isMatch`.
     /// Only writes when the value actually changes — every assignment to an `@Observable`
     /// property fires `didSet`, so unconditional writes would re-render every dependent view.
-    private func updateFlag(_ keyPath: ReferenceWritableKeyPath<CaskViewModel, Bool>, tokens: Set<CaskId>) {
+    private func updateFlag(
+        _ keyPath: ReferenceWritableKeyPath<CaskViewModel, Bool>,
+        isMatch: (CaskViewModel) -> Bool
+    ) {
         for vm in viewModelsByFullToken.values {
-            let match = vm.matches(anyOf: tokens)
+            let match = isMatch(vm)
             if vm[keyPath: keyPath] != match {
                 vm[keyPath: keyPath] = match
             }
         }
     }
 
-    /// Marks casks as installed. Tokens can be short ("firefox") or full ("homebrew/cask/firefox").
+    /// Marks casks as installed from `brew list --cask --full-name`, which prints each cask's
+    /// `full_name` — so this is an exact `fullToken` match.
     func markInstalled(tokens: Set<CaskId>) {
-        updateFlag(\.isInstalled, tokens: tokens)
+        updateFlag(\.isInstalled) { $0.matchesFullName(in: tokens) }
     }
 
-    /// Marks casks as outdated. Tokens can be short or full.
+    /// Marks casks as outdated from `brew outdated --cask -q`, which prints **bare** tokens even for
+    /// tap casks. That's ambiguous across taps, so it's gated on `isInstalled`: only one of two
+    /// same-token casks can be the installed one, and installed state is reconciled first (see
+    /// `CaskManager.loadInstalledState`, which awaits `refreshInstalled` before `refreshOutdated`).
     func markOutdated(tokens: Set<CaskId>) {
-        updateFlag(\.isOutdated, tokens: tokens)
+        updateFlag(\.isOutdated) { $0.isInstalled && $0.matchesBareToken(in: tokens) }
     }
 
     // MARK: - Computed Filtered Lists
```

---

### Incident Patch 6: `debc33bd` (2026-08-04)
**Commit Message**: Fix stream truncation that silently swallowed tap casks

Shell.makeStream closed its read end from the process's termination
handler, which discards whatever the process had already written into the
pipe but the reader hadn't drained yet — up to the pipe's 64 KB buffer.

Measured on romankurnovskii/awesome-brew: the tap script emits 161,085
chars, the app received 102,184 (63%), losing 58,901 — just under the
buffer size. The JSON was cut mid-object, so decoding failed with
"Unexpected end of file", fetchTapDTOs returned nil, and taps silently
never appeared. Nothing about taps was broken: the tap, the script, the
DTO decoding and the includeCasksFromTaps default were all fine, and the
failure survived a forced ⌘R sync because it wasn't a staleness problem.

The close exists to guarantee EOF when a `script`-wrapped pty lingers
after brew exits, so it's now scoped to the pty path. A plain pipe reaches
EOF on its own once the child exits — the reader drains the backlog first.
The tap fetch is the only pty:false streaming caller, so installs and the
annex extract keep today's behaviour exactly.

Verified end to end: taps now populate (75 casks from that tap, plus 1
from another) where

**File**: `Applite/Core/Brew/Shell.swift` (modified, +11/-1)
```diff
@@ -219,9 +219,19 @@ enum Shell {
                     // finished (or AsyncBytes may not observe EOF promptly). A hung loop here would
                     // freeze the cask on its install/"success" state — so it's never marked installed.
                     // Closing our read end on termination guarantees EOF.
+                    //
+                    // **Only for a pty.** Closing discards whatever the process wrote just before
+                    // exiting and is still sitting in the pipe — up to its 64 KB buffer. A plain pipe
+                    // doesn't need the help: the child's write end closes when it exits, so the
+                    // reader drains the backlog and *then* sees EOF. Forcing it here truncated any
+                    // output the reader hadn't caught up with, which is why the 161 KB tap-cask JSON
+                    // arrived 63% complete and failed to parse ("Unexpected end of file") — taps
+                    // silently never appeared.
                     task.terminationHandler = { _ in
                         processExited.withLock { $0 = true }
-                        try? fileHandle.close()
+                        if pty {
+                            try? fileHandle.close()
+                        }
                     }
 
                     try task.run()
```

**File**: `Localizable.xcstrings` (modified, +13/-5)
```diff
@@ -2158,6 +2158,7 @@
     },
     "Brew path is invalid" : {
       "comment" : "Alert title",
+      "extractionState" : "stale",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -2755,7 +2756,7 @@
 
     },
     "Couldn't download app. No internet connection, or host is unreachable." : {
-      "comment" : "No internet alert message",
+      "comment" : "No internet failure message",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -3962,7 +3963,7 @@
       }
     },
     "Failed to install %@" : {
-      "comment" : "Install failure alert title",
+      "comment" : "Install failure notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -4044,7 +4045,7 @@
       }
     },
     "Failed to reinstall %@" : {
-      "comment" : "Failed reinstall alert title",
+      "comment" : "Failed reinstall notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -4126,7 +4127,7 @@
       }
     },
     "Failed to uninstall %@" : {
-      "comment" : "Failed app install alert title",
+      "comment" : "Failed app install notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -4167,7 +4168,7 @@
       }
     },
     "Failed to update %@" : {
-      "comment" : "Failed app update alert title",
+      "comment" : "Failed app update notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -5797,6 +5798,9 @@
         }
       }
     },
+    "Moved your Homebrew, or want Applite to use its own instead? Change it in Settings." : {
+      "comment" : "Components install sheet note when the user's selected brew is missing"
+    },
     "No" : {
       "comment" : "Cask info boolean value"
     },
@@ -6526,6 +6530,7 @@
     },
     "Quit" : {
       "comment" : "Quit Applite button",
+      "extractionState" : "stale",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -7901,6 +7906,9 @@
           }
         }
       }
+    },
+    "Try Again" : {
+
     },
     "Turn off few downloads filter" : {
       "comment" : "Filter disable button",
```

---

### Incident Patch 7: `ced3e131` (2026-08-04)
**Commit Message**: Merge pull request #153 from milanvarady/fix/tier1-shell-injection-dataloss

Pre-release hardening: fix shell injection, data-loss & state bugs, + cleanup

**File**: `Applite/AppViews/AppView.swift` (modified, +4/-0)
```diff
@@ -158,6 +158,7 @@ struct AppView: View {
         .menuStyle(.borderlessButton)
         .menuIndicator(.hidden)
         .fixedSize()
+        .accessibilityLabel("More options")
     }
 
     private func getInfo() async {
@@ -257,6 +258,7 @@ struct AppView: View {
             .buttonStyle(.plain)
             .frame(width: 30, height: 30)
             .help(caskManager.batchProgress != nil ? "Part of a bulk operation" : "Stop download")
+            .accessibilityLabel("Stop download")
 
         case .success:
             // Handled upstream by `showsSuccessIndicator` in `actionsView`; unreachable here.
@@ -278,6 +280,7 @@ struct AppView: View {
                 }
                 .buttonStyle(.bordered)
                 .help("View terminal output")
+                .accessibilityLabel("View terminal output")
 
                 Button {
                     caskManager.dismissFailure(cask)
@@ -286,6 +289,7 @@ struct AppView: View {
                 }
                 .buttonStyle(.bordered)
                 .help("Dismiss")
+                .accessibilityLabel("Dismiss error")
             }
 
         case .idle:
```

**File**: `Applite/AppViews/AppliteAppView.swift` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ struct AppliteAppView: View {
                     .foregroundStyle(.secondary)
             }
             .buttonStyle(.plain)
+            .accessibilityLabel("Uninstall Applite")
         }
         .frame(width: AppView.dimensions.width, height: AppView.dimensions.height)
     }
```

**File**: `Applite/Components/CardActionPill.swift` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 //
-//  View+CardActionPill.swift
+//  CardActionPill.swift
 //  Applite
 //
 //  Created by Milán Várady on 2026.08.01.
```

**File**: `Applite/Components/EnvironmentInput.swift` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+//
+//  EnvironmentInput.swift
+//  Applite
+//
+//  Created by Milán Várady on 2025.05.09.
+//
+
+import SwiftUI
+
+/// Labelled text field for a single environment variable (used by the Mirror settings).
+struct EnvironmentInput: View {
+    let title: String
+    @Binding var text: String
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 2) {
+            Text(title)
+                .font(.caption.monospaced())
+                .foregroundStyle(.secondary)
+            TextField(title, text: $text)
+                .labelsHidden()
+                .textFieldStyle(.roundedBorder)
+        }
+    }
+}
```

**File**: `Applite/Components/InfoPopup.swift` (modified, +23/-15)
```diff
@@ -32,21 +32,29 @@ struct InfoPopup: View {
     }
 
     var body: some View {
-        Image(systemName: sfSymbol)
-            .foregroundStyle(color)
-            .onHover { hover in
-                showPopover = hover
-            }
-            .buttonStyle(.plain)
-            .popover(isPresented: $showPopover) {
-                Text(text)
-                    .textSelection(.enabled)
-                    .frame(maxWidth: 400)
-                    .fixedSize(horizontal: true, vertical: true)
-                    .padding(16)
-                    .padding(.top, extraTopPadding)
-                    .padding(.bottom, extraBottomPadding)
-            }
+        // A real Button (not a bare hover-only Image) so keyboard and VoiceOver users can open the
+        // popover too; hover still opens it for mouse users. The info text is exposed as the
+        // accessibility label so assistive tech announces it without having to open the popover (F2).
+        Button {
+            showPopover.toggle()
+        } label: {
+            Image(systemName: sfSymbol)
+                .foregroundStyle(color)
+        }
+        .buttonStyle(.plain)
+        .onHover { hover in
+            showPopover = hover
+        }
+        .popover(isPresented: $showPopover) {
+            Text(text)
+                .textSelection(.enabled)
+                .frame(maxWidth: 400)
+                .fixedSize(horizontal: true, vertical: true)
+                .padding(16)
+                .padding(.top, extraTopPadding)
+                .padding(.bottom, extraBottomPadding)
+        }
+        .accessibilityLabel(Text(text))
     }
 }
 
```

---

### Incident Patch 8: `0ca3b56e` (2026-08-03)
**Commit Message**: Tier-2 correctness fixes (P2-11, P2-15, P3-3, P2-10, P2-12)

P2-11: SendNotification read raw UserDefaults.bool(forKey:), which returns false
for the unwritten `notificationFailure` key — so failure notifications were
silently suppressed until the user first toggled the setting on a fresh install.
Use the typed accessors, whose declared defaults are correct (failure = true).

P2-15: the Brewfile import regex `cask "([\w/-]+)"` excluded `@` and `.`, so
`temurin@17` / `firefox@esr` silently vanished on import — and it broke Applite's
own export→import round trip (export writes fullToken). Widen to `[\w/@.-]+`.

P3-3: if `brew outdated` failed, UpdateView still rendered "All your apps are up
to date" — false reassurance. Track `CaskManager.outdatedRefreshFailed` (set when
the outdated refresh throws or the installed refresh fails), and show a "Couldn't
Check for Updates" state with a Retry button instead. The manual refresh path now
also runs serialized and updates the flag.

P2-10: activeTasks rows were evicted by cask identity, so a finishing op could
delete a different still-queued op's row for the same cask (card vanishes, cancel
no-ops while brew runs). Tag each row with an opera

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +15/-6)
```diff
@@ -11,6 +11,11 @@ import OSLog
 
 struct ActiveBrewTask: Identifiable {
     let id = UUID()
+    /// Groups the rows belonging to the same brew operation (a batch shares one across its casks).
+    /// Eviction is scoped to this, so a finishing op only removes its *own* rows — never a
+    /// different, still-queued op's row for the same cask (which would make that card vanish and
+    /// its cancel silently no-op while brew still ran).
+    let operationID: UUID
     let viewModel: CaskViewModel
     let task: Task<Void, Never>
 }
@@ -326,14 +331,16 @@ final class BrewService {
         vm.progressState = .busy(withTask: waitingLabel)
 
         let previous = queueTail
+        let operationID = UUID()
         let task = Task {
             await previous?.value
 
             defer {
                 // Keep a failed cask in the task list (so its error stays reachable) until the user
-                // dismisses it; remove it once it succeeds or is otherwise done.
+                // dismisses it; remove it once it succeeds or is otherwise done. Scope to THIS
+                // operation's row so a separate queued op for the same cask isn't evicted (P2-10).
                 self.activeTasks.removeAll {
-                    $0.viewModel == vm && !$0.viewModel.progressState.isFailed
+                    $0.operationID == operationID && !$0.viewModel.progressState.isFailed
                 }
             }
 
@@ -355,7 +362,7 @@ final class BrewService {
         }
 
         queueTail = task
-        self.activeTasks.append(ActiveBrewTask(viewModel: vm, task: task))
+        self.activeTasks.append(ActiveBrewTask(operationID: operationID, viewModel: vm, task: task))
         return task
     }
 
@@ -405,15 +412,17 @@ final class BrewService {
 
         let previous = queueTail
         let handle = BatchHandle()
+        let operationID = UUID()
         let task = Task {
             await previous?.value
 
             // Now running — publish this batch so the Active Tasks "Stop" can cancel just it.
             self.runningBatch = handle
             defer {
-                // Keep failed casks in the task list until dismissed; remove the rest.
+                // Keep failed casks in the task list until dismissed; remove the rest. Scope to this
+                // batch's rows so it can't evict a separate op's row for a shared cask (P2-10).
                 self.activeTasks.removeAll {
-                    batchTokens.contains($0.viewModel.fullToken) && !$0.viewModel.progressState.isFailed
+                    $0.operationID == operationID && !$0.viewModel.progressState.isFailed
                 }
                 if self.runningBatch === handle { self.runningBatch = nil }
             }
@@ -433,7 +442,7 @@ final class BrewService {
 
         handle.task = task
         queueTail = task
-        for vm in vms { activeTasks.append(ActiveBrewTask(viewModel: vm, task: task)) }
+        for vm in vms { activeTasks.append(ActiveBrewTask(operationID: operationID, viewModel: vm, task: task)) }
     }
 
     /// Cancels the currently-running bulk operation (the whole `brew install/upgrade --cask <all>`
```

**File**: `Applite/Core/CaskCore/CaskManager.swift` (modified, +30/-3)
```diff
@@ -47,6 +47,11 @@ final class CaskManager {
     /// Views read this to swap in `BrokenInstallView` for the home tab.
     private(set) var hasBrokenInstall: Bool = false
 
+    /// True when the last `brew outdated` check failed (or couldn't run). `UpdateView` reads this so
+    /// an empty outdated list shows "couldn't check for updates" instead of a false "all up to date"
+    /// when the check never actually ran (P3-3).
+    private(set) var outdatedRefreshFailed: Bool = false
+
     /// Alert surface for catalog load/refresh failures. Mirrors the `BrewService.alert`
     /// pattern so views can bind directly without owning load-error state.
     var loadAlert = AlertManager()
@@ -282,18 +287,40 @@ final class CaskManager {
             // ordered as a second line of defense.
             try await brewService.runSerialized {
                 try await self.dataLoader.refreshInstalled()
-                try await self.dataLoader.refreshOutdated()
+                // Outdated is a nested best-effort step: if it fails, keep the (good) installed state
+                // and just flag the failure, so UpdateView shows "couldn't check" instead of a false
+                // "all up to date" (P3-3).
+                do {
+                    try await self.dataLoader.refreshOutdated()
+                    self.outdatedRefreshFailed = false
+                } catch {
+                    self.outdatedRefreshFailed = true
+                    Self.logger.error("Outdated refresh failed: \(error.localizedDescription)")
+                }
             }
             Self.logger.info("Installed/outdated state loaded successfully!")
         } catch {
+            // Installed refresh itself failed — outdated state is unknown too, so don't let
+            // UpdateView claim everything is up to date.
+            self.outdatedRefreshFailed = true
             loadAlert.show(error: error, title: "Couldn't load installed apps")
             Self.logger.error("Installed-state load failure. Reason: \(error.localizedDescription)")
         }
     }
 
-    /// Refreshes the list of outdated casks
+    /// Refreshes the list of outdated casks (the toolbar "Refresh" action and UpdateView's retry).
+    /// Serialized behind the brew queue (like `loadInstalledState`) so it can't race an install's
+    /// optimistic write, and updates `outdatedRefreshFailed` so the empty-state UI stays accurate.
     func refreshOutdated() async throws {
-        try await dataLoader.refreshOutdated()
+        do {
+            try await brewService.runSerialized {
+                try await self.dataLoader.refreshOutdated()
+            }
+            outdatedRefreshFailed = false
+        } catch {
+            outdatedRefreshFailed = true
+            throw error
+        }
     }
 
 }
```

**File**: `Applite/Core/Infrastructure/SendNotification.swift` (modified, +8/-3)
```diff
@@ -43,9 +43,14 @@ func sendNotification(title: String, body: String = "", reason: NotificationReas
         return
     }
         
-    /// Return if notifications are desabled for selected reason
-    if (!UserDefaults.standard.bool(forKey: "notificationSuccess") && reason == .success)
-        || (!UserDefaults.standard.bool(forKey: "notificationFailure") && reason == .failure) {
+    /// Return if notifications are disabled for the selected reason.
+    /// Use the typed accessors so an unwritten key falls back to its declared default
+    /// (`notificationFailure` defaults to `true`) instead of raw `bool(forKey:)` returning
+    /// `false` — which silently suppressed all failure notifications until the user first
+    /// toggled the setting on a fresh install.
+    let successEnabled = UserDefaults.standard.value(for: Preferences.notificationSuccess)
+    let failureEnabled = UserDefaults.standard.value(for: Preferences.notificationFailure)
+    if (!successEnabled && reason == .success) || (!failureEnabled && reason == .failure) {
         return
     }
 
```

**File**: `Applite/Core/Infrastructure/UninstallSelf.swift` (modified, +16/-13)
```diff
@@ -39,6 +39,22 @@ func uninstallSelf(deleteBrewCache: Bool, uninstallHomebrew: Bool = false) async
         "$HOME/Library/HTTPStorages/\(bundleID)"
     ]
 
+    // Do the step that can fail on permissions (Homebrew uninstall) BEFORE any irreversible wipe of
+    // Applite's own data. Otherwise a no-admin failure throws *after* the data is already gone,
+    // leaving the user with wiped settings, a failed uninstall, and a still-installed app (P2-12).
+    if uninstallHomebrew {
+        logger.notice("Uninstalling Homebrew")
+        try await uninstallHomebrewCompletely()
+
+        logger.notice("Deleting Homebrew cache")
+        try await Shell.runShellScript("rm -rf $HOME/Library/Caches/Homebrew")
+    } else if deleteBrewCache {
+        // Only delete cache if not uninstalling Homebrew (since it would be redundant)
+        logger.notice("Deleting Homebrew cache")
+        try await Shell.runShellScript("rm -rf $HOME/Library/Caches/Homebrew")
+    }
+
+    // Everything below is irreversible — only reached once the throwing Homebrew uninstall succeeded.
     // -rf so missing files are ignored; each path on its own line runs independently
     let deleteCommand = paths
         .map { "rm -rf \($0)" }
@@ -49,19 +65,6 @@ func uninstallSelf(deleteBrewCache: Bool, uninstallHomebrew: Bool = false) async
     let output = try await Shell.runShellScript(deleteCommand)
     logger.notice("Uninstall result: \(output)")
 
-    // If uninstalling Homebrew, delete cache first and then uninstall Homebrew
-    if uninstallHomebrew {
-        logger.notice("Deleting Homebrew cache before uninstalling Homebrew")
-        try await Shell.runShellScript("rm -rf $HOME/Library/Caches/Homebrew")
-
-        logger.notice("Uninstalling Homebrew")
-        try await uninstallHomebrewCompletely()
-    } else if deleteBrewCache {
-        // Only delete cache if not uninstalling Homebrew (since it would be redundant)
-        logger.notice("Deleting Homebrew cache")
-        try await Shell.runShellScript("rm -rf $HOME/Library/Caches/Homebrew")
-    }
-
     logger.notice("Self destructing. Goodbye world! o7")
 
     // Quit the app and remove the bundle.
```

**File**: `Applite/Features/AppMigration/AppMigration.swift` (modified, +4/-2)
```diff
@@ -36,9 +36,11 @@ enum AppMigration {
     static func readCaskFile(url: URL) throws -> Set<CaskId> {
         let content = try String(contentsOf: url)
         var casks: Set<CaskId> = []
-        // `[\w/-]+` (not `[\w-]+`) so tap-qualified tokens like `user/repo/token` also match.
+        // `[\w/@.-]+` matches tap-qualified tokens (`user/repo/token`) AND versioned ones
+        // (`temurin@17`, `firefox@esr`) — dropping `@`/`.` silently lost those on import and broke
+        // Applite's own export→import round trip (export writes fullToken).
         // Extended delimiters `#/.../#` let the `/` appear unescaped without ending the literal.
-        let brewfileRegex = #/cask "([\w/-]+)"/#
+        let brewfileRegex = #/cask "([\w/@.-]+)"/#
 
         // Check if the file being imported is a Brewfile
         // Brewfiles store casks as cask "caskName"
```

---

### Incident Patch 9: `420b46c8` (2026-08-03)
**Commit Message**: Fix Tier-1 state-ownership races (P2-3 dual-writer, P2-4 bootstrap)

P2-3 / F2 — dual-writer stomp on isInstalled/isOutdated:
BrewService writes these flags optimistically when an op succeeds, while stage-2
CaskDataLoader.refreshInstalled/refreshOutdated reconcile the same flags across
every VM from a `brew list`/`outdated` snapshot. With no ordering, a refresh
whose snapshot predates a just-finished install lands last and reverts the cask
to "not installed" (button flips back, stays wrong until the next reload).
Add BrewService.runSerialized(_:) and route loadInstalledState through it, so the
refresh runs on the same serial queue as install/uninstall/update — its snapshot
is always taken after every completed op and can never revert one.

P2-4 — bootstrap re-entrancy:
bootstrap.run() had no single-flight guard and loadData(forceSync:) (⌘R /
Settings refresh) is a second entry point into it. Two concurrent run() ->
installAnnex() passes both call prepareAnnexDirectory(clean:), one wiping the
tree the other extracts into. Make run() single-flight and generation-aware:
a same-attempt re-entrant caller awaits the in-flight pass; a newer attempt
(Retry / escape hatch) cancels the old p

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +17/-0)
```diff
@@ -359,6 +359,23 @@ final class BrewService {
         return task
     }
 
+    /// Runs `operation` on the serial brew queue (after any in-flight/queued op) and returns its
+    /// result. Used to sequence the read-side installed/outdated refresh with install/uninstall/
+    /// update *writes*: without this, a stage-2 `brew list`/`outdated` snapshot taken before an
+    /// install finishes can land afterwards and reconcile the just-installed cask back to "not
+    /// installed" (the F2 / P2-3 dual-writer stomp). On the queue, the refresh's snapshot is always
+    /// taken after every completed op, so it can never revert one.
+    func runSerialized<T: Sendable>(_ operation: @escaping @MainActor () async throws -> T) async throws -> T {
+        let previous = queueTail
+        let opTask = Task { @MainActor () async throws -> T in
+            await previous?.value
+            return try await operation()
+        }
+        // Chain the queue tail so later ops wait for this one; the op's own error is the caller's.
+        queueTail = Task { _ = try? await opTask.value }
+        return try await opTask.value
+    }
+
     // MARK: - Bulk (batch) operations
 
     private enum BatchKind {
```

**File**: `Applite/Core/Brew/Installation/HomebrewBootstrap.swift` (modified, +47/-0)
```diff
@@ -74,8 +74,44 @@ final class HomebrewBootstrap {
     private static let selectedBrewRevalidationRetries = 2
     private static let selectedBrewRevalidationDelay: Duration = .milliseconds(400)
 
+    /// The in-flight bootstrap pass and the `attempt` generation it was started for. Used to make
+    /// `run()` single-flight so a second entry point (`loadData(forceSync:)` from ⌘R / Settings)
+    /// can't kick off a bootstrap concurrently with the launch one — two `installAnnex()` passes
+    /// would both `prepareAnnexDirectory(clean:)`, one wiping the tree the other extracts into.
+    @ObservationIgnored private var runTask: Task<Void, Never>?
+    @ObservationIgnored private var runningAttempt = -1
+
     /// Resolves brew, installing the annex only as a last resort. Safe to call again (Retry).
+    ///
+    /// Single-flight, generation-aware:
+    /// - A concurrent call for the *same* `attempt` (e.g. `loadData` overlapping the launch pass)
+    ///   awaits the in-flight pass instead of starting a second, concurrent one.
+    /// - A call after `attempt` was bumped (Retry / the "use my own brew" escape hatch) supersedes
+    ///   the old pass: it cancels it, waits for it to finish unwinding (so the annex directory is
+    ///   never touched by two passes at once), then starts fresh.
     func run() async {
+        if let runTask, runningAttempt == attempt {
+            await runTask.value
+            return
+        }
+
+        // A newer generation supersedes any still-running older pass.
+        runTask?.cancel()
+        await runTask?.value
+
+        let started = attempt
+        let task = Task { await self.runBootstrap() }
+        runningAttempt = started
+        runTask = task
+        await task.value
+
+        // Only clear if we're still the current pass (a newer generation may have replaced us).
+        if runningAttempt == started { runTask = nil }
+    }
+
+    /// The actual bootstrap sequence. Runs inside the `run()`-owned `Task`, so `Task.isCancelled`
+    /// here reflects `run()` cancelling it when a newer generation supersedes this pass.
+    private func runBootstrap() async {
         phase = .checking
 
         // 1. Honor a working selection first — covers existing users, custom paths, and a prior
@@ -145,6 +181,17 @@ final class HomebrewBootstrap {
             try Task.checkCancellation()
 
             try await AnnexBrewManager.verifyAnnexInstall()
+
+            // Don't clobber a choice the user made *while* the annex was downloading. The Settings
+            // "switch to my own brew" path doesn't bump `attempt` (so it doesn't cancel us via the
+            // check above); if they've since pointed Applite at their own, now-valid brew, honor it
+            // instead of silently switching them to the annex and orphaning their apps.
+            if BrewPaths.selectedBrewOption != .annex, await BrewPaths.isSelectedBrewPathValid() {
+                Self.logger.info("User selected their own valid brew during annex install — honoring it")
+                phase = .ready
+                return
+            }
+
             BrewPaths.selectedBrewOption = .annex
             AnnexBrewManager.stampAnnexRefreshed()
 
```

**File**: `Applite/Core/CaskCore/CaskManager.swift` (modified, +12/-5)
```diff
@@ -272,11 +272,18 @@ final class CaskManager {
         defer { self.isResolvingInstalledState = false }
 
         do {
-            // Serial, not concurrent: on a fresh annex the first brew command triggers a one-time
-            // `brew vendor-install ruby`, and two brews racing that lock fail with "already locked".
-            // Bootstrap primes Ruby up front, but keep these ordered as a second line of defense.
-            try await dataLoader.refreshInstalled()
-            try await dataLoader.refreshOutdated()
+            // Run the refresh on the serial brew queue so its `brew list`/`outdated` snapshot can't
+            // interleave with — and then revert — a concurrent install/update's optimistic state
+            // write (F2 / P2-3 dual-writer stomp).
+            //
+            // Within the queue slot the two calls stay serial, not concurrent: on a fresh annex the
+            // first brew command triggers a one-time `brew vendor-install ruby`, and two brews racing
+            // that lock fail with "already locked". Bootstrap primes Ruby up front, but keep these
+            // ordered as a second line of defense.
+            try await brewService.runSerialized {
+                try await self.dataLoader.refreshInstalled()
+                try await self.dataLoader.refreshOutdated()
+            }
             Self.logger.info("Installed/outdated state loaded successfully!")
         } catch {
             loadAlert.show(error: error, title: "Couldn't load installed apps")
```

---

### Incident Patch 10: `5b779a84` (2026-08-03)
**Commit Message**: Fix Tier-1 release blockers: shell injection, data loss

Pre-release review (Testing/TRIAGE.md) flagged these as ship blockers.

Security — shell injection (P2-1):
Shell ran every command as `/bin/sh -c "<interpolated string>"`, splicing
untrusted third-party tap tokens and user-editable brew/appdir paths into the
shell unescaped — arbitrary code execution on install/update/uninstall. Rework
Shell to argv-based execution (run/stream/runBrewCommand/streamBrewCommand): the
executable is launched directly with an argument array, never a shell. The pty
path funnels argv through `script … /bin/sh -c 'stty …; exec "$0" "$@"' <exe>
<args>`, so the (possibly untrusted) executable/args are positional parameters,
never part of the script text. A `runShellScript`/`streamShellScript` escape
hatch (documented trusted-literals-only) covers the few genuine shell scripts
(annex curl|tar, `zsh -lc`, uninstall globs).

Also in the Shell family:
- P2-2: install() used bare `vm.token`; now `vm.fullToken` like every sibling,
  so a tapped token colliding with a core cask installs the intended cask.
- P2-7: runProcessAsync had no cancellation; add withTaskCancellationHandler +
  Task.checkCancellation s

**File**: `Applite/Core/Brew/BrewPaths.swift` (modified, +5/-3)
```diff
@@ -81,8 +81,10 @@ struct BrewPaths {
     ///
     /// - Returns: Whether the path is valid or not
     static func isBrewPathValid(at url: URL) async -> Bool {
-        // Check if Homebrew is returned when checking version
-        guard let output = try? await Shell.runAsync("\(url.quotedPath()) --version") else {
+        // Check if Homebrew is returned when checking version. Argv-based (the path is never
+        // spliced into a shell) and time-boxed so a hung/locked/network-mounted brew can't stall
+        // app launch — the whole bootstrap awaits this before it can leave `.checking`.
+        guard let output = try? await Shell.run(url, ["--version"], timeout: .seconds(10)) else {
             return false
         }
 
@@ -161,7 +163,7 @@ struct BrewPaths {
 
         // A login shell (`-l`) sources the user's profile, so `command -v brew` sees the PATH they
         // actually use — this is what finds brew at a non-standard prefix.
-        guard let output = try? await Shell.runAsync("zsh -lc 'command -v brew'", timeout: .seconds(5)) else {
+        guard let output = try? await Shell.run(URL(fileURLWithPath: "/bin/zsh"), ["-lc", "command -v brew"], timeout: .seconds(5)) else {
             return nil
         }
 
```

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +20/-24)
```diff
@@ -72,25 +72,20 @@ final class BrewService {
         return runTask(for: vm) {
             Self.logger.info("Cask \"\(vm.token)\" installation started")
 
-            // Appdir argument
-            let appdirOn = UserDefaults.standard.value(for: Preferences.appdirOn)
-            let appdirPath = UserDefaults.standard.value(for: Preferences.appdirPath)
-            let appdirArgument = "--appdir=\"\(appdirPath)\""
-
             // Always --force: the Install button only shows when the cask isn't tracked as
             // installed, so force just overwrites/adopts any untracked copy already on disk instead
             // of erroring — and it's identical to a plain install when nothing is there.
-            var arguments = [vm.token, "--force"]
-            if appdirOn { arguments.append(appdirArgument) }
-
-            let command = "\(BrewPaths.currentBrewExecutable.quotedPath()) install --cask \(arguments.joined(separator: " "))"
+            // Use `fullToken` (like every sibling op) so a tapped token that collides with a core
+            // cask installs the intended cask, not the core one.
+            var arguments = ["install", "--cask", vm.fullToken, "--force"]
+            arguments.append(contentsOf: Self.appdirArguments())
 
             // Setup progress
             vm.progressState = .busy(withTask: "")
 
             // Run install command and stream output
             let result = await self.streamBrewCommand(
-                command,
+                arguments,
                 vm: vm,
                 busyLabel: String(localized: "Installing", comment: "Install progress text")
             )
@@ -187,9 +182,7 @@ final class BrewService {
             let updateLabel = String(localized: "Updating", comment: "Update progress text")
             vm.progressState = .busy(withTask: updateLabel)
 
-            let command = "\(BrewPaths.currentBrewExecutable.quotedPath()) upgrade --cask \(vm.fullToken)"
-
-            let result = await self.streamBrewCommand(command, vm: vm, busyLabel: updateLabel)
+            let result = await self.streamBrewCommand(["upgrade", "--cask", vm.fullToken], vm: vm, busyLabel: updateLabel)
 
             // Stopped by the user — no success/failure surface.
             if Task.isCancelled {
@@ -225,9 +218,7 @@ final class BrewService {
             let reinstallLabel = String(localized: "Reinstalling", comment: "Reinstall progress text")
             vm.progressState = .busy(withTask: reinstallLabel)
 
-            let command = "\(BrewPaths.currentBrewExecutable.quotedPath()) reinstall --cask \(vm.fullToken)"
-
-            let result = await self.streamBrewCommand(command, vm: vm, busyLabel: reinstallLabel)
+            let result = await self.streamBrewCommand(["reinstall", "--cask", vm.fullToken], vm: vm, busyLabel: reinstallLabel)
 
             // Stopped by the user — no success/failure surface.
             if Task.isCancelled {
@@ -452,19 +443,16 @@ final class BrewService {
         }
         for key in ambiguousKeys { lookup[key] = nil }
 
-        var arguments = vms.map(\.fullToken)
+        var arguments = [kind.subcommand, "--cask"] + vms.map(\.fullToken)
         if kind == .install {
             // --force: bulk install is only used by app-list import, which commonly re-lists casks
             // that are already installed (or orphaned — e.g. a font whose files remain after brew
             // lost track). Without --force any one of those raises a hard error that can abort the
             // whole `brew install` batch and fail the rest. Reinstalling is low-risk and makes
             // import resilient.
             arguments.append("--force")
-            let appdirOn = UserDefaults.standard.value(for: Preferences.appdirOn)
-            let appdirPath = UserDefaults.standard.value(for: Preferences.appdirPath)
-            if appdirOn { arguments.append("--appdir=\"\(appdirPath)\"") }
+            arguments.append(contentsOf: Self.appdirArguments())
 
```

**File**: `Applite/Core/Brew/Installation/AnnexBrewManager.swift` (modified, +2/-2)
```diff
@@ -89,7 +89,7 @@ struct AnnexBrewManager {
         Self.logger.info("Clean annex Homebrew install started")
 
         try prepareAnnexDirectory(clean: true)
-        try await Shell.runAsync(annexExtractCommand())
+        try await Shell.runShellScript(annexExtractCommand())
         try await verifyAnnexInstall()
 
         BrewPaths.selectedBrewOption = .annex
@@ -108,7 +108,7 @@ struct AnnexBrewManager {
 
         Self.logger.info("Refreshing annex Homebrew (non-destructive overlay)")
         try prepareAnnexDirectory(clean: false)
-        try await Shell.runAsync(annexExtractCommand())
+        try await Shell.runShellScript(annexExtractCommand())
         try await verifyAnnexInstall()
         stampAnnexRefreshed()
         Self.logger.info("Annex Homebrew refresh done")
```

**File**: `Applite/Core/Brew/Installation/HomebrewBootstrap.swift` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ final class HomebrewBootstrap {
         do {
             try AnnexBrewManager.prepareAnnexDirectory(clean: true)
 
-            for try await line in Shell.stream(AnnexBrewManager.annexExtractCommand(), pty: true) {
+            for try await line in Shell.streamShellScript(AnnexBrewManager.annexExtractCommand(), pty: true) {
                 statusLine = line
             }
 
```

**File**: `Applite/Core/Brew/Shell.swift` (modified, +131/-88)
```diff
@@ -9,34 +9,81 @@ import Foundation
 import OSLog
 import os
 
-/// Namespace for shell command execution utilities
+/// Namespace for shell command execution utilities.
+///
+/// Commands run in one of two ways:
+/// - **argv execution** (``run(_:_:pty:timeout:)`` / ``stream(_:_:pty:)`` and the brew helpers):
+///   the executable is launched directly with an argument array — there is **no `/bin/sh -c`**, so
+///   nothing in `arguments` is ever parsed by a shell. This is the *only* safe path for commands
+///   whose arguments include untrusted values (third-party cask tokens, user-entered brew/appdir
+///   paths). Even the pty variant funnels the argv through `exec "$0" "$@"`, never string-splicing.
+/// - **shell-script execution** (``runShellScript(_:pty:timeout:)`` / ``streamShellScript(_:pty:)``):
+///   runs `/bin/sh -c <script>`. Reserved for fixed, trusted script *literals* that genuinely need
+///   shell features (globs, pipes, `$HOME`, `set -o pipefail`). Never interpolate untrusted input
+///   into such a script — that reopens the injection hole the argv path exists to prevent.
 enum Shell {
     private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Shell")
 
-    /// Executes a shell command asynchronously
+    // MARK: - Argv execution (no shell — injection-proof)
+
+    /// Runs an executable directly with an argv array and returns its combined output.
     ///
     /// - Parameters:
-    ///   - command: The shell command to run
-    ///   - pty: Wether to use pseudo-TTY behavior or not
-    ///   - timeout: If set, the process is killed after this duration and ``ShellError/timedOut``
-    ///     is thrown. Use for commands that could hang (e.g. a login shell sourcing a broken config).
-    ///
-    /// - Returns: The output of the shell command
-    ///
-    /// Using the `pty` option can leave unwanted characters in the output, use only when necessary
+    ///   - executableURL: The program to run.
+    ///   - arguments: Argument vector, passed verbatim — no shell parsing, quoting, or word-splitting.
+    ///   - pty: Run inside a pseudo-TTY (needed for brew's live progress output).
+    ///   - timeout: If set, the process is killed after this duration and ``ShellError/timedOut`` is
+    ///     thrown. Use for commands that could hang (e.g. a `brew --version` probe against a broken path).
+    @discardableResult
+    static func run(_ executableURL: URL, _ arguments: [String], pty: Bool = false, timeout: Duration? = nil) async throws -> String {
+        try await runProcessAsync(executableURL: executableURL, arguments: arguments, pty: pty, timeout: timeout)
+    }
+
+    /// Streams an executable's output line-by-line. Argv-based; see ``run(_:_:pty:timeout:)``.
+    static func stream(_ executableURL: URL, _ arguments: [String], pty: Bool = false) -> AsyncThrowingStream<String, Error> {
+        makeStream(executableURL: executableURL, arguments: arguments, pty: pty)
+    }
+
+    // MARK: - Brew convenience
+
+    /// Runs the currently-selected `brew` with `arguments`. Argv-based, so tokens/paths are safe.
+    @discardableResult
+    static func runBrewCommand(_ arguments: [String], pty: Bool = false, timeout: Duration? = nil) async throws -> String {
+        try await run(BrewPaths.currentBrewExecutable, arguments, pty: pty, timeout: timeout)
+    }
+
+    /// Streams the currently-selected `brew` with `arguments`. Argv-based, so tokens/paths are safe.
+    static func streamBrewCommand(_ arguments: [String], pty: Bool = false) -> AsyncThrowingStream<String, Error> {
+        stream(BrewPaths.currentBrewExecutable, arguments, pty: pty)
+    }
+
+    // MARK: - Shell-script escape hatch (trusted literals only)
+
+    /// Runs `/bin/sh -c <script>`. See the type doc: **fixed, trusted literals only** — never
+    /// interpolate untrusted input (cask tokens, user paths) into `script`.
     @discardableResult
-    static func runAsync(_ command: String, pty: Bool = 
```

#### Recent Merged Pull Requests:
- **PR #164** (2026-09-12): Trim README badges and add a light/dark screenshot (@milanvarady)
- **PR #163** (2026-09-10): Update the release docs and notes template for applite.app (@milanvarady)
- **PR #162** (2026-09-10): Point the in-app links at applite.app (@milanvarady)
- **PR #161** (2026-09-10): Swap PayPal for Ko-fi in the Sponsor button (@milanvarady)
- **PR #156** (2026-08-04): i18n: complete all six languages, add a glossary and the catalog tooling (@milanvarady)
- **PR #155** (2026-08-04): Testing: cover PR #154 in the harness, add an upgrade round (@milanvarady)
- **PR #154** (2026-08-04): Deferred review backlog: brew state, alerts, schema identity, stream truncation (@milanvarady)
- **PR #153** (2026-08-04): Pre-release hardening: fix shell injection, data-loss & state bugs, + cleanup (@milanvarady)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
