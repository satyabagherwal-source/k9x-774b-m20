# Forensic Learning Record (Deep Inspection): darrylmorley/whatcable

> **Canonical Artifact**: `07_PROJECT_LEARNING/darrylmorley-whatcable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/darrylmorley/whatcable](https://github.com/darrylmorley/whatcable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:03:02.166Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `darrylmorley/whatcable`
- **Description**: macOS menu bar app that tells you, in plain English, what each USB-C cable plugged into your Mac can actually do
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8818 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eleventy.config.js`
```
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // Keep explorer markup, styles, code and data in sync across browser caches.
  eleventyConfig.addTransform("versionCableExplorer", function (content) {
    if (!this.page.outputPath?.endsWith("/inside-a-cable.html")) return content;
    const hash = createHash("sha256");
    for (const file of ["src/assets/cable-explorer/explorer.css", "src/assets/cable-explorer/explorer.js", "src/_data/explorer.json"]) {
      hash.update(readFileSync(file));
    }
    const version = hash.digest("hex").slice(0, 16);
    return content.replace(/(\/assets\/cable-explorer\/explorer\.(?:css|js))(?=["'])/g, `$1?v=${version}`);
  });


  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/blog/feed.xml",
    collection: { name: "posts", limit: 20 },
    metadata: {
      language: "en",
      title: "WhatCable Blog",
      subtitle:
        "USB-C cables, Thunderbolt, and the deep weeds of port diagnostics.",
      base: "https://www.whatcable.uk/blog/",
      author: {
        name: "Darryl",
      },
    },
  });

  eleventyConfig.addFilter("stripDatePrefix", (slug) =>
    String(slug).replace(/^\d{4}-\d{2}-\d{2}-/, "")
  );

  eleventyConfig.addFilter("cleanUrl", (url) => {
    const u = String(url);
    if (u === "/") return "/";
    // Strip .html extension (posts now output as filename.html) then trailing slash.
    return u.replace(/\.html$/, "").replace(/\/$/, "");
  });

  // Treat "now", null, and undefined as today so templates can render
  // a build-time stamp without juggling Date objects in frontmatter.
  const resolveDate = (date) => {
    if (date == null || date === "now") return new Date();
    return new Date(date);
  };

  eleventyConfig.addFilter("isoDate", (date) => resolveDate(date).toISOString());

  eleventyConfig.addFilter("readableDate", (date) =>
    resolveDate(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  // Capture Eleventy's bundled markdown-it instance so we can render arbitrary
  // markdown strings (e.g. FAQ answers from a post's frontmatter) using the
  // same config as the post body.
  let mdLib = null;
  eleventyConfig.amendLibrary("md", (md) => {
    mdLib = md;
  });
  eleventyConfig.addFilter("markdownify", (str) => {
    if (!str) return "";
    return mdLib ? mdLib.render(String(str)) : String(str);
  });

  // Escape any </script> sequence inside a string that's about to be inlined
  // into a <script type="application/ld+json"> block. JSON itself doesn't
  // require this, but the browser's HTML parser will close the script tag
  // early if it sees the literal sequence anywhere in the content.
  eleventyConfig.addFilter("jsonLdSafe", (str) =>
    String(str || "").replace(/<\/(script)/gi, "<\\/$1")
  );

  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("./src/blog/posts/**/*.md")
      .sort((a, b) => b.date - a.date)
  );

  // Wrap every <table> in a scrollable div so wide tables don't blow out the
  // layout on narrow screens. The markdown renderer can't add wrapper markup
  // directly, so this transform does it as a post-processing step on HTML.
  eleventyConfig.addTransform("wrapTables", function (content) {
    if (!this.page.outputPath?.endsWith(".html")) return content;
    return content
      .replace(/<table/g, '<div class="table-wrap"><table')
      .replace(/<\/table>/g, "</table></div>");
  });

  eleventyConfig.addTransform("stripFeedTrailingSlashes", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith("feed.xml")) {
      return content;
    }
    return content
      .replace(/(https?:\/\/[^\s"<>]+?)\.html(?=["<\s])/g, "$1")
      .replace(/(https?:\/\/[^\s"<>]+?)\/(?=["<\s])/g, "$1");
  });

  eleventyConfig.addPassthroughCopy("src/assets/cable-explorer");
  eleventyConfig.addPassthroughCopy("src/assets/cable-database");
  eleventyConfig.addPassthroughCopy("src/icon.png");
  eleventyConfig.addPassthroughCopy("src/whatbattery-icon.png");
  eleventyConfig.addPassthroughCopy("src/whatport-icon.png");
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/screenshot*.webp");
  eleventyConfig.addPassthroughCopy("src/press");

  // Decap CMS lives at /admin. Copy it verbatim (no Nunjucks pass), so the
  // HTML/JS isn't accidentally parsed if it ever contains brace-heavy code.
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.addPassthroughCopy("src/admin");

  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}

```

### Core Architecture Module: `scripts/cable-db-diff.py`
```
#!/usr/bin/env python3
"""Diff the customer-probe corpus's cable fingerprints against
data/known-cables.md, to find cables people are actually plugging in that
aren't catalogued yet.

Intended to be re-run after every ingest batch (see the whatcable-process-
probe skill's end-of-batch step): it surfaces which uncatalogued cables are
showing up on more than one machine, which is the signal worth chasing for a
new known-cables.md row. New rows still go through the normal hand-edit
discipline (the "Brand / model context" column is never auto-imported; see
CLAUDE.md), this script only tells you where to look.

Two things worth knowing before reading the output:

- PID = 0x0000 rows can never resolve at runtime. CableDB.curatedCables(vid:
  pid:) requires both VID and PID to be nonzero (see
  Sources/WhatCableCore/Database/CableDB.swift); a zero PID means the app can
  never match that cable to a brand no matter how well it's catalogued. This
  is the DAR-39 structural finding: cheap/generic cable silicon overwhelmingly
  ships with PID=0, so a big chunk of "uncatalogued" fingerprints are
  unfixable under the current (VID,PID) identity schema, not a coverage gap.
  Still counted here for visibility, but don't spend curation effort on them.
- A zeroed VID (0x0000) is a trust signal (an e-marker that didn't report an
  identity at all), not an identifiable cable model. It says something about
  the cable's trustworthiness, not its brand. Don't try to name it.

Usage:
    scripts/cable-db-diff.py                 # headline numbers + ranked missing list, to stdout
    scripts/cable-db-diff.py --json           # full data as JSON, to stdout
    scripts/cable-db-diff.py --out DIR        # also write fingerprint-frequency.tsv,
                                               # missing-from-db.md, never-seen-in-corpus.md into DIR
    scripts/cable-db-diff.py --top N          # how many ranked absentees to print (default 15)
"""
import json
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KNOWN_CABLES = os.path.join(REPO, "data", "known-cables.md")
WHATCABLE_DB = os.path.join(REPO, "Sources", "WhatCableCore", "Resources", "whatcable.db")
CORPUS = os.path.join(REPO, "research", "customer-probes", "corpus.jsonl")
INSPECTIONS_DIR = os.path.join(REPO, "research", "customer-probes")


def hx(s):
    """Parse "0xABCD" (optionally backtick/whitespace-wrapped) into an int.
    Returns None for anything that isn't valid hex, mirroring
    build-cable-db.swift's parseHex(_:) -> Int? (nil on a bad prefix or bad
    digits, never a crash). Never raises."""
    if s is None:
        return None
    s = s.strip().strip("`")
    if not (s.lower().startswith("0x")):
        return None
    try:
        return int(s, 16)
    except ValueError:
        return None


def hx16(v):
    return "0x{:04X}".format(v) if v is not None else "0x0000"


def hx32(v):
    return "0x{:08X}".format(v) if v is not None else None


# md-row field name for each cables-table column the unique index can name.
# Anything outside this map means the schema grew a column this script has
# never seen, which is a stop-and-look, not something to guess through.
_COL_TO_MD_FIELD = {
    "vid": "vid",
    "pid": "pid",
    "cable_vdo": "vdo",
    "brand": "brand_ctx",
}


def quote_ident(name):
    """SQLite identifier quoting for a PRAGMA argument."""
    return '"' + name.replace('"', '""') + '"'


def dedup_columns(con):
    """Read the cables table's UNIQUE INDEX out of the database and return the
    key columns it covers, so this script dedups on whatever identity the
    builder actually enforces.

    Deliberately NOT restated from build-cable-db.swift. It used to be, as a
    docstring describing a partial index ON cables(vid, pid) WHERE vid != 0
    AND pid != 0, and that stopped being the builder's index in d808786e
    (2026-06-02, "Identify cables by VID+PID, never the Cable VDO"). The
    restatement rotted silently and made this script under-count by 4 rows:
    four (vid, pid) pairs legitimately carry two rows each, differing in
    cable_vdo or brand, and the stale key folded them together.

    Read through PRAGMA index_list / index_xinfo rather than by pattern-matching
    sqlite_master.sql. The DDL text is prose: an ordinary index named "unique"
    or carrying a /* UNIQUE */ comment would pass a \bUNIQUE\b test, and a full
    unique index whose name happened to contain "where" would fail a partial-index
    test. The PRAGMAs report uniqueness, partialness and the key columns as
    structured fields, which is what we actually need to know.

    Raises on anything this script cannot model, rather than falling back to a
    guess: no unique index, more than one, a partial index, an expression key,
    a non-BINARY collation (which would change what counts as a duplicate), or
    a column outside _COL_TO_MD_FIELD.
    """
    indexes = con.execute("PRAGMA index_list('cables')").fetchall()
    # (seq, name, unique, origin, partial); older SQLite builds return 3 columns.
    unique = []
    for row in indexes:
        name, is_unique = row[1], row[2]
        partial = row[4] if len(row) > 4 else 0
        if is_unique:
            unique.append((name, partial))
    if len(unique) != 1:
        raise SystemExit(
            "cable-db-diff: expected exactly one UNIQUE INDEX on cables, found "
            f"{len(unique)}: {[n for n, _ in unique]}. Schema changed; update "
            "dedup_columns() rather than guessing."
        )
    name, partial = unique[0]
    if partial:
        raise SystemExit(
            f"cable-db-diff: {name} is a partial index. This script only models "
            "a full unique index; update dedup_columns()."
        )

    cols = []
    for row in con.execute(f"PRAGMA index_xinfo({quote_ident(name)})").fetchall():
        # (seqno, cid, name, desc, coll, key); key == 0 rows are the trailing
        # rowid/covering columns, not part of the enforced identity.
        _seqno, cid, col, _desc, coll, key = row[:6]
        if not key:
            continue
        if col is None or cid is not None and cid < 0:
            raise SystemExit(
                f"cable-db-diff: {name} has an expression key column this script "
                "cannot map to a known-cables.md field. Update dedup_columns()."
            )
        if coll and coll.upper() != "BINARY":
            raise SystemExit(
                f"cable-db-diff: {name} column {col} uses collation {coll}. "
                "Non-BINARY collation changes what counts as a duplicate; "
                "update dedup_columns()."
            )
        cols.append(col)
    if not cols:
        raise SystemExit(f"cable-db-diff: {name} reported no key columns.")
    unknown = [c for c in cols if c not in _COL_TO_MD_FIELD]
    if unknown:
        raise SystemExit(
            f"cable-db-diff: {name} covers column(s) this script cannot map to "
            f"a known-cables.md field: {unknown}. Update _COL_TO_MD_FIELD."
        )
    return cols


def expected_db_row_count(md_rows, dedup_cols):
    """Reproduce scripts/build-cable-db.swift's insert logic to predict how many
    rows whatcable.db's `cables` table SHOULD have from the current
    known-cables.md, so a raw row-count mismatch can be told apart from
    expected deduplication.

    The build script:
    1. Skips rows with brand "(needs review)" (no usable identity yet).
    2. Skips all-zero rows (vid==0 and pid==0 and cable_vdo==0): unmatchable,
       not worth storing.
    3. Inserts everything else via INSERT OR IGNORE against the table's UNIQUE
       INDEX, so the first row per identity in file order wins and later
       duplicates of that identity are skipped. `dedup_cols` comes from
       dedup_columns(), i.e. from the database itself.

    Note there is no carve-out for rows with a zero vid or pid. The index is
    full, not partial, so every 
```

### Core Architecture Module: `scripts/check-duplicate-readers.py`
```
#!/usr/bin/env python3
"""Fail when an IOKit class name is read from more than one file without a reason.

WHY NOT A BLANKET RULE. The obvious invariant, "one file per IOKit class name",
is the wrong one. It has two ways to be satisfied and only one of them is
progress: either you merge two lists that differ on purpose (deciding a
behaviour question by fiat to shut a script up), or you carve out an exception
and the rule stops meaning anything. `AppleHPMInterfaceWatcher` matching the
`IOPort` superclass while the telemetry reader does not is exactly that case:
a real, deliberate, undecided difference.

So this gates the SPECIFIC duplicates that exist today, each with a written
reason, and refuses to let the set grow. It is a ratchet, not a rule.

Two ways to fail, both loud:

  NEW      a class name appears in more than one file and is not in ALLOWED.
           Someone added a second reader for something already read elsewhere.

  STALE    an ALLOWED entry no longer matches what is on disk. The duplicate
           was resolved (good) but the exemption was left behind (not good),
           so the next one to appear would be waved through by a stale entry.
           The script names the exact line to delete. Same mechanic
           `check-localisation.py` already uses for its known-missing list.

Scope note: the class-name check looks for IOKit-class-SHAPED string literals
(`IO...` / `Apple...`) anywhere in Sources, not just inside
`IOServiceMatching(...)`. That is on purpose and was measured: several watchers
hold their class names in an array and pass them to `IOServiceMatching` in a
loop, so a scan anchored on the call site finds 7 classes and 0 duplicates,
while the literal scan finds 58 and 17. The narrow version looked clean and was
simply not looking.

A literal scan has its own blind spot, and it was demonstrated rather than
imagined: a reviewer added a file containing

    let cls = "Apple" + "SmartBattery"
    return IOServiceMatching(cls)

which is a genuine second reader of a class this very script was written to
keep singular, and the first version of the script did not notice the file
existed. Neither fragment matches the pattern on its own. That is not a
contrived example either: this codebase already numbers its classes
(`AppleHPMInterfaceType10/11/12/18`), so `"AppleHPMInterfaceType" + String(n)`
is a plausible way to write the next one.

So there is a second check. Every argument passed to `IOServiceMatching` /
`IOServiceNameMatching` that is NOT a bare string literal is a computed
matcher, and the (file, expression) pairs are ratcheted the same way. A new
file that matches services dynamically fails until someone writes down why.

What neither check covers, stated so a green run is not read as more than it
is:

  - Two readers of the same class inside ONE file. A per-file ratchet cannot
    see that by construction.
  - A matcher argument written as a Swift multi-line string literal (three
    consecutive quote characters). The scanner toggles its in-string state per
    quote character and treats those three as three separate delimiters, so an
    odd number of embedded quotes desyncs it and the captured text is wrong. It
    still FAILS LOUDLY in that case, because the argument is not a bare literal
    and the file gets flagged either way, which is the safe direction; it just
    reports the wrong text in the message. No IOKit class name would ever be
    written that way, and Sources contains no such call today.
"""

import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, "Sources")

# An IOKit class name as a string literal. Three or more trailing characters so
# short unrelated strings like "IO" or "Apple" do not qualify.
LITERAL = re.compile(r'"((?:IO|Apple)[A-Za-z0-9_]{3,})"')

# Where a service-matcher call starts. The argument itself is read by
# `matcher_argument` below rather than by this pattern, because a regex cannot
# balance parentheses and the first attempt here stopped at the first comma or
# close paren. That was not merely imprecise: an argument CONTAINING a comma,
# such as any two-parameter class-name builder, failed to match the call at all,
# so the whole file went unseen rather than being flagged as unrecognised. A
# reviewer proved it with `IOServiceMatching(buildClassName("Apple", "SmartBattery"))`,
# which is a real second reader and produced a completely clean run.
MATCHER_CALL_START = re.compile(r'IOService(?:Name)?Matching\(')
BARE_LITERAL_ARG = re.compile(r'^"(?:IO|Apple)[A-Za-z0-9_]{3,}"$')

# Files that pass something other than a bare string literal to a service
# matcher, with the expression they pass and why it is fine.
#
# Every one of these is a loop over a named class list, which is the shape this
# consolidation was aiming for. A NEW entry means someone is computing a class
# name, and that needs a human to look at it.
DYNAMIC_MATCHERS = {
    "WhatCableDarwinBackend/Reading/AppleSmartBatteryReader.swift": (
        {"serviceClassName"},
        "The one owner of the AppleSmartBattery class name, held as a private constant.",
    ),
    "WhatCableDarwinBackend/Watchers/AppleHPMInterfaceWatcher.swift": (
        {"cls"},
        "Loops over candidateClasses (the shared named list plus the IOPort catch-all).",
    ),
    "WhatCableDarwinBackend/Services/PowerService.swift": (
        {"cls"},
        "Loops over HPMPortControllerClasses.named. Was "
        "Watchers/PowerTelemetryWatcher.swift until it was renamed to what it "
        "always was; the ratchet fired on both halves of that move, which is "
        "the intended cost of keying exemptions to a path.",
    ),
    "WhatCableDarwinBackend/Watchers/AppleTypeCPhyWatcher.swift": (
        {"cls"},
        "Loops over its own candidate class list.",
    ),
    "WhatCableDarwinBackend/Reading/DisplayTimingReader.swift": (
        {"className"},
        "Loops over nodeClassNames: AppleCLCD2 and IOMobileFramebufferShim, the two "
        "display-node classes (split by chip). No other reader in Sources matches "
        "either class (checked 2026-09-17).",
    ),
    "WhatCableDarwinBackend/Watchers/TRMTransportWatcher.swift": (
        {"cls"},
        "Loops over the four transport-state classes. Splitting this watcher is step 4 of the layering refactor.",
    ),
    "WhatCableDarwinBackend/Watchers/USBPDSOPWatcher.swift": (
        {"className", "Self.stateCCClassName"},
        "Loops over the SOP class list (className). Merging with VDMIdentityWatcher "
        "is step 5. `Self.stateCCClassName` (issue #573 part 2) is IOPortTransportStateCC, "
        "the class carrying a MagSafe cable's chip VID/PID -- a held constant, not a "
        "loop, and no other reader in Sources matches this class (checked 2026-08-31).",
    ),
    "WhatCableDarwinBackend/Watchers/VDMIdentityWatcher.swift": (
        {"className"},
        "Loops over the SOP class list. Merging with USBPDSOPWatcher is step 5.",
    ),
    "WhatCableDarwinBackend/Watchers/IOThunderboltSwitchWatcher.swift": (
        {"className", "matchClassName"},
        "Walks the IOThunderboltSwitch class hierarchy, whose concrete name varies by silicon generation.",
    ),
    "WhatCableDarwinBackend/Debug/ThunderboltProbe.swift": (
        {"matchClassName"},
        "The --tb-debug contributor dump, deliberately independent of the watcher.",
    ),
    "WhatCableDarwinBackend/Watchers/AppleUVDMWatcher.swift": (
        {"Self.watchedClass"},
        "A single held constant rather than a loop, IOPortTransportProtocolAppleUVDM, "
        "the node carrying an Apple accessory's own name. No other reader in Sources "
        "matches this class (checked 2026-09-10).",
    ),
}

# Every duplicate that exists today, with the reason it is allowed to.
#
# Each value is (reason, {files}). The file set is part of the key, not
# decoration: if a duplicate moves to a different pa
```

### Core Architecture Module: `scripts/check-localisation.py`
```
#!/usr/bin/env python3
"""Localisation coverage gate.

Two blind spots let three user-facing strings ship untranslated in v1.3.0-beta.3
(reported by @jimmyorz on discussion #489):

  1. The parity check I had been running compared `.strings` files only.
     `.stringsdict` holds the plural forms and was never in the comparison, so
     `Show %lld hubs` and `via %lld hubs` sat in English alone.

  2. Parity compares every language against English. A key missing from English
     TOO is not a discrepancy, so the check passes. `String(localized:)` falls
     back to the literal, so it renders correctly in English and silently ships
     untranslated everywhere else. That is how `Hide hubs` reached users without
     existing in any `.strings` file at all.

So this script checks two different things:

  A. EXTRACTION. Every `String(localized: "...")` literal in the Swift sources
     resolves in the catalogue its `bundle:` argument points at. Catches a
     string nobody ever added, which parity cannot.

  B. PARITY. Every language has exactly the keys English has, in BOTH file
     types, per catalogue, with values that are actually translated (not
     just present).

A second review pass (before this file shipped) found six more ways the
first version of this gate could go green while something was genuinely
broken. Each is noted at the point in the code that closes it:

  1. Only two source directories were scanned, but WhatCablePlugins and
     WhatCableWidget also call String(localized:) against the same two
     catalogues. Fixed by scanning every .swift file under Sources/ and
     classifying each call by its `bundle:` argument rather than by which
     directory the file happens to live in.
  2. A literal the scanner could not read (raw strings, triple-quoted
     strings) was silently dropped instead of failing. Fixed by supporting
     both forms and failing loudly on anything still unparseable.
  3. Parity only checked keys that existed in both catalogues; deleting an
     entire language directory left the rest agreeing and nothing failed.
     Fixed by asserting the expected locale set explicitly.
  4. Parity compared keys only, never values, so a translation could be
     wrong, untranslated, or a malformed stringsdict entry and still pass.
     Fixed with structural stringsdict validation plus a byte-identical-
     to-English value check.
  5. `%@` and `%lld` were treated as interchangeable when matching an
     interpolated literal against the catalogue, so a String argument could
     be silently satisfied by an Int-only catalogue entry. Fixed with a
     narrow, explicitly-scoped specifier inference plus an ambiguity check.
  6. The baseline ratchet was keyed on (target, key) alone, so a second,
     unrelated occurrence of an already-baselined string was silently
     covered too. Fixed by keying on (target, path, key) with an expected
     occurrence count.

A third review pass found two more:

  7. SPECIFIER_RE, used to validate a stringsdict category's format text
     against its declared NSStringFormatValueTypeKey, had no `%@`
     alternative. Changing a plural category's text from an integer
     specifier to `%@` while the declared value type stayed numeric passed
     clean, which is a real runtime mismatch (the format text and the
     declared type disagree). Fixed by recognising `%@` as a found
     specifier too.
  8. The identical-to-English amnesty (ALLOWED_IDENTICAL) was keyed on
     (target, value) only, so a legitimate loanword in one language (say,
     French keeping "Diagnostics") silently exempted every other language
     from the same check, including one that regressed to the English text.
     Fixed by keying on (target, language, value), reseeded per language
     from the current catalogues.

A fourth finding from the same pass (a nested local function can shadow its
parent's name during bundle resolution) is dormant with no code path that
triggers it today, and is tracked separately rather than fixed here.

Run directly, or via scripts/ci.sh.
"""

import os
import plistlib
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASE_LANG = "en"

# The two catalogues that exist in this repo, and the global bundle constant
# that every literal's `bundle:` argument ultimately resolves to. This is not
# "which source directory is the file in": WhatCablePlugins and WhatCableWidget
# have no catalogue of their own, they call into Core's via _coreLocalizedBundle
# (see finding 1 above), and two Core functions take a `bundle: Bundle`
# parameter and get called with EITHER global depending on caller (see
# resolve_bundle below), so a literal can legitimately need to exist in both.
CATALOGUES = {
    "_coreLocalizedBundle": ("WhatCableCore", "Sources/WhatCableCore/Resources"),
    "_appLocalizedBundle": ("WhatCable (app)", "Sources/WhatCable/Resources"),
    "_notificationsLocalizedBundle": ("WhatCableNotifications", "Sources/WhatCableNotifications/Resources"),
}

# The locale directories every catalogue is expected to carry, asserted
# explicitly rather than derived from whatever .lproj directories happen to
# exist on disk (finding 3: derived-only meant deleting a whole language
# still passed parity, because the remaining languages still agreed with
# each other).
EXPECTED_LANGUAGES = [
    "de", "en", "es", "fr", "hi", "hy", "it", "ja", "ko", "lv", "nb", "nl",
    "pl", "pt-BR", "ru", "tr", "uk", "zh-Hans", "zh-Hant",
]

# CLDR cardinal-plural categories each language requires at minimum. A
# language may carry MORE categories than this (harmless: NSStringDictionary
# just never selects the unused one, e.g. several of our files keep a "one"
# entry for languages like zh/tr/ja/ko whose grammar doesn't need it) but
# must not carry FEWER, because a missing required category is a runtime
# crash-or-fallback for that count. This table is a static fact about each
# language's grammar, not something this repo's data can drift out of sync
# with, so unlike the ratchets below it's not expected to change.
REQUIRED_PLURAL_CATEGORIES = {
    "en": {"one", "other"},
    "de": {"one", "other"},
    "es": {"one", "other"},
    "fr": {"one", "other"},
    "hi": {"one", "other"},
    "hy": {"one", "other"},
    "it": {"one", "other"},
    "ja": {"other"},
    "ko": {"other"},
    "lv": {"zero", "one", "other"},
    "nb": {"one", "other"},
    "nl": {"one", "other"},
    "pl": {"few", "many", "one", "other"},
    "pt-BR": {"one", "other"},
    "ru": {"few", "many", "one", "other"},
    "tr": {"other"},
    "uk": {"few", "many", "one", "other"},
    "zh-Hans": {"other"},
    "zh-Hant": {"other"},
}

# Placeholder standing in for one `\(...)` interpolation while we compare.
HOLE = "\x00"

CALL_RE = re.compile(r"String\(\s*localized:\s*")


# --- Known-missing baseline (a ratchet, not an amnesty) -----------------------
#
# These strings were already missing from a catalogue when this check learned
# to see them, so failing on them would block every push. They are listed here
# so the gate can go green on the backlog while blocking anything NEW, exactly
# like the pro-boundary ratchet.
#
# Keyed on (repo-relative source path, catalogue key), not key alone (finding
# 6): a bare-key baseline silently covers a SECOND, unrelated occurrence of the
# same string anywhere else in the target, and still passes if the original
# occurrence moves. The value is the number of times that exact occurrence is
# expected at that exact call site (almost always 1). If the actual count at
# that (path, key) differs, in either direction, the check fails: fewer means
# it was fixed and the line must be deleted; more means a new or moved
# occurrence needs its own line, not a free ride on this one.
#
# The list may only SHRINK. Fixing one and leaving it here is also an error:
# the check fails if a baseline entry has been resolved, which forces the line
# to be deleted and stops the list quietly becoming permanent.

```

### Core Architecture Module: `scripts/edid-timings/check-edid-timings.py`
```
#!/usr/bin/env python3
"""Three-way cross-check for data/edid-timings/{vesa-dmt,cta-861-vic}.csv.

Every row in both CSVs (produced by extract-dmt.py and extract-cta-vic.py,
which read the VESA DMT and CTA-861-H spec PDFs) must agree on width,
height, hTotal, vTotal, pixelClockKHz and interlacing with BOTH:

  1. edid-decode's own tables (MIT, commit see edid-decode-src/COMMIT):
     dmt_timings[] in parse-base-block.cpp, edid_cta_modes1[] /
     edid_cta_modes2[] in parse-cta-block.cpp.
  2. The Linux kernel's drm_edid.c (GPL-2.0, numeric cross-check only,
     nothing copied): drm_dmt_modes[], edid_cea_modes_1[], edid_cea_modes_193[].

Any row present in the CSV and absent from a reference, or vice versa, is a
failure, as is any row where a compared field disagrees. Exits non-zero and
prints every disagreement found (never stops at the first one), so a CSV
regenerate only has to be run once to see the whole list.

Known, deliberate exclusion: edid-decode's established_timings12[] (base
block "Established Timings I & II", IBM/Apple legacy signals with
dmt_id 0x00) is not a DMT table and is out of scope for this script; it is
Task 4's concern.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys

# --- generic C struct-array-literal parsing -------------------------------


def extract_array_body(text: str, var_name: str) -> str:
    """Return the text strictly between the '{' that opens `var_name[] = {`
    and the matching top-level '}' that closes the array, via brace-depth
    counting (comments and quoted strings are not brace-aware, but neither
    contains a literal '{' or '}' anywhere in these two files)."""
    m = re.search(re.escape(var_name) + r"\s*\[\s*\]\s*=\s*{", text)
    if not m:
        raise ValueError(f"array {var_name}[] not found")
    start = m.end()  # just after the opening '{'
    depth = 1
    i = start
    while depth > 0:
        if i >= len(text):
            raise ValueError(f"array {var_name}[] never closes")
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        i += 1
    return text[start:i - 1]


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
    text = re.sub(r"//[^\n]*", " ", text)
    return text


def split_top_level_entries(body: str) -> list[str]:
    """Split an array body into its top-level '{ ... }' entries. Each
    returned string is the entry's content with the outer braces stripped."""
    entries = []
    depth = 0
    start = None
    for i, c in enumerate(body):
        if c == "{":
            if depth == 0:
                start = i + 1
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                entries.append(body[start:i])
    return entries


def split_top_level_args(s: str) -> list[str]:
    """Split a comma-separated argument list on top-level commas only,
    respecting nested {}/() and double-quoted strings."""
    args = []
    depth = 0
    in_quotes = False
    current = []
    for c in s:
        if in_quotes:
            current.append(c)
            if c == '"':
                in_quotes = False
            continue
        if c == '"':
            in_quotes = True
            current.append(c)
        elif c in "{(":
            depth += 1
            current.append(c)
        elif c in ")}":
            depth -= 1
            current.append(c)
        elif c == "," and depth == 0:
            args.append("".join(current).strip())
            current = []
        else:
            current.append(c)
    if "".join(current).strip():
        args.append("".join(current).strip())
    return args


def to_bool_or_int(tok: str):
    tok = tok.strip()
    if tok == "true":
        return True
    if tok == "false":
        return False
    return int(tok, 0)  # handles 0x-prefixed hex and plain decimal


# --- edid-decode `struct timings` parsing ----------------------------------

# Field order per edid-decode.h `struct timings` (positional aggregate init;
# trailing fields default to 0/false when the literal is shorter).
TIMINGS_FIELDS = [
    "hact", "vact", "hratio", "vratio", "pixclk_khz", "rb", "interlaced",
    "hfp", "hsync", "hbp", "pos_pol_hsync", "vfp", "vsync", "vbp",
    "pos_pol_vsync", "hborder", "vborder", "even_vtotal", "no_pol_vsync",
    "hsize_mm", "vsize_mm", "ycbcr420",
]
TIMINGS_DEFAULTS = {
    "hborder": 0, "vborder": 0, "even_vtotal": False, "no_pol_vsync": False,
    "hsize_mm": 0, "vsize_mm": 0, "ycbcr420": False,
}


def parse_timings_struct(fields_str: str) -> dict:
    tokens = split_top_level_args(fields_str)
    t = dict(TIMINGS_DEFAULTS)
    for name, tok in zip(TIMINGS_FIELDS, tokens):
        t[name] = to_bool_or_int(tok)
    return t


def timings_to_row(t: dict) -> dict:
    """Derive (width, height, hTotal, vTotal, pixelClockKHz, interlaced) the
    same way DMTTiming/VICTiming will: hTotal always sums the horizontal
    fields; vTotal for a progressive timing sums the vertical fields; for an
    interlaced timing (see edid-decode.h: vact is the FULL FRAME height, so
    the per-field height is vact/2) the frame vTotal is
    2 * (vact/2 + vfp + vsync + vbp) + (0 if even_vtotal else 1) -- verified
    against DMT 0x0F (817 lines) and CTA VIC 5 (1125 lines), both stated
    directly in the spec PDFs."""
    h_total = t["hact"] + t["hfp"] + t["hsync"] + t["hbp"] + 2 * t["hborder"]
    if t["interlaced"]:
        field_vact = t["vact"] // 2
        v_total = 2 * (field_vact + t["vfp"] + t["vsync"] + t["vbp"]) + (0 if t["even_vtotal"] else 1)
    else:
        v_total = t["vact"] + t["vfp"] + t["vsync"] + t["vbp"] + 2 * t["vborder"]
    return {
        "width": t["hact"],
        "height": t["vact"],
        "h_total": h_total,
        "v_total": v_total,
        "pixel_clock_khz": t["pixclk_khz"],
        "interlaced": t["interlaced"],
    }


def parse_edid_decode_dmt(edid_decode_dir: str) -> dict:
    path = f"{edid_decode_dir}/parse-base-block.cpp"
    with open(path) as f:
        text = strip_comments(f.read())
    body = extract_array_body(text, "dmt_timings")
    result = {}
    for entry in split_top_level_entries(body):
        args = split_top_level_args(entry)
        if len(args) != 4:
            raise ValueError(f"dmt_timings entry has {len(args)} top-level fields, expected 4: {entry!r}")
        dmt_id = to_bool_or_int(args[0])
        inner = args[3].strip()
        if inner.startswith("{") and inner.endswith("}"):
            inner = inner[1:-1]
        t = parse_timings_struct(inner)
        result[dmt_id] = timings_to_row(t)
    return result


def parse_edid_decode_cta(edid_decode_dir: str) -> dict:
    path = f"{edid_decode_dir}/parse-cta-block.cpp"
    with open(path) as f:
        text = strip_comments(f.read())
    result = {}
    for var_name, start_vic in [("edid_cta_modes1", 1), ("edid_cta_modes2", 193)]:
        body = extract_array_body(text, var_name)
        entries = split_top_level_entries(body)
        for i, entry in enumerate(entries):
            t = parse_timings_struct(entry)
            result[start_vic + i] = timings_to_row(t)
    return result


# --- Linux kernel drm_edid.c DRM_MODE(...) parsing -------------------------

# DRM_MODE(name, type, clock_khz, hdisplay, hsync_start, hsync_end, htotal,
#          hskew, vdisplay, vsync_start, vsync_end, vtotal, vscan, flags)
DRM_MODE_FIELDS = [
    "name", "type", "clock", "hdisplay", "hsync_start", "hsync_end", "htotal",
    "hskew", "vdisplay", "vsync_start", "vsync_end", "vtotal", "vscan", "flags",
]


def parse_drm_mode_call(text: str, start: int) -> tuple[dict, int]:
    """Parse one `DRM_MODE(...)` call starting at the index of its '(' in
    `text`. Returns the parsed field dict and the index just past the
    matching ')'."""
    depth = 1
    i = start + 1
    while depth > 0:
        c = text[i]
        if c == "(":
            depth += 1
        elif c == 
```

### Core Architecture Module: `scripts/edid-timings/extract-cta-vic.py`
```
#!/usr/bin/env python3
"""Extract CTA-861-H Table 1 (Video Format Timings) into a CSV of VIC timings.

Source of record: ANSI/CTA-861-H, Table 1 "Video Format Timings, Detailed
Timing Information", pages 41 to 43 in the published PDF
(https://archive.org/download/ansi-cta-861-h-final/ANSI-CTA-861-H-Final.pdf).
Table 1 is split across several vertical-frequency sections (Low, 50Hz,
60Hz, 100Hz, 120Hz, 200Hz, 240Hz); each section header is followed by rows of
the shape:

    VIC[, VIC]  Hactive Vactive I/P  Htotal Hblank Vtotal Vblank  HFreq VFreq PixelFreq

Two footnote quirks in the extracted text, both handled here without ever
hand-editing the output:

1. Hactive and Htotal occasionally carry a glued-on footnote "2" (no space),
   e.g. "14402" for Hactive 1440 (CTA-861-H footnote 2: some SD formats are
   double-clocked, so Hactive is shown doubled). Detected and stripped using
   the one column NOT subject to a footnote in this table, Hblank: it always
   equals Htotal - Hactive exactly, so whichever reading (raw or footnote-
   stripped) satisfies that arithmetic is the real value.
2. V Freq occasionally carries a glued-on footnote "3" (CTA-861-H footnote 3:
   a vertical frequency that is an integer multiple of 6.00 Hz is considered
   the same Video Timing as its 1000/1001-scaled NTSC-compatible sibling).
   Every V Freq value in this table is printed to either 2 or 3 decimal
   places; a footnoted value has one extra trailing digit, so any value with
   more than 2 decimal places has its last character (the footnote) dropped.

VICs 0 and 128 to 192 are reserved (CTA-861-H defines no Video Format Timing
for them, and SVD values 128-192 are explicitly Forbidden); the output CSV
has no rows for them.

A handful of VICs (8, 9, 12, 13, 23, 24, 27, 28) list two or three row
variants that differ only in Vtotal/V Freq by a scan line or two: CTA-861-H's
own footnote on this ("these frame formats differ only by one or two scan
lines... treated as the same Video Format") says they are the same timing.
edid-decode's own tables (cross-checked by check-edid-timings.py) resolve
each of these to its first-listed variant, so this script does the same:
first occurrence wins, and a later variant is accepted silently only when it
agrees on everything except Vtotal/V Freq.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys

ROW_RE = re.compile(
    r"(?P<vics>\d+(?:,\s*\d+)?)\s+"
    r"(?P<hact>\d+)\s+"
    r"(?P<vact>\d+)\s+"
    r"(?P<ip>Int|Prog)\s+"
    r"(?P<htot>\d+)\s+"
    r"(?P<hblank>\d+)\s+"
    r"(?P<vtot>\d+)\s+"
    r"(?P<vblank>[\d.]+)\s+"
    r"(?P<hfreq>[\d.]+)\s+"
    r"(?P<vfreq>[\d.]+)\s+"
    r"(?P<pclk>[\d.]+)\s*$"
)

EXPECTED_VICS = sorted(set(range(1, 128)) | set(range(193, 220)))


def strip_h_footnote(hact_raw: str, htot_raw: str, hblank: int) -> tuple[int, int]:
    """Hblank = Htotal - Hactive always holds in this table (it is never
    itself footnoted). Try the raw reading first; if it does not balance,
    strip a trailing '2' footnote from both Hactive and Htotal and retry."""
    hact, htot = int(hact_raw), int(htot_raw)
    if htot - hact == hblank:
        return hact, htot
    if hact_raw.endswith("2") and htot_raw.endswith("2"):
        hact2, htot2 = int(hact_raw[:-1]), int(htot_raw[:-1])
        if htot2 - hact2 == hblank:
            return hact2, htot2
    raise ValueError(
        f"Hblank invariant failed: Htotal({htot_raw}) - Hactive({hact_raw}) != Hblank({hblank}), "
        "and stripping a trailing footnote '2' from both did not fix it either"
    )


def strip_v_footnote(token: str) -> float:
    """V Freq values print to 2 or 3 decimal places. A footnoted value (CTA
    footnote 3) has one extra trailing digit glued on with no separator."""
    if "." in token:
        decimals = len(token.split(".", 1)[1])
        if decimals > 2:
            token = token[:-1]
    return float(token)


def parse_table1(text: str, page_num: int, rows: dict) -> None:
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        m = ROW_RE.search(line)
        if not m:
            continue
        vics = [int(v.strip()) for v in m.group("vics").split(",")]
        interlaced = m.group("ip") == "Int"
        vact = int(m.group("vact"))
        vtot = int(m.group("vtot"))
        hblank = int(m.group("hblank"))
        try:
            hact, htot = strip_h_footnote(m.group("hact"), m.group("htot"), hblank)
        except ValueError as e:
            raise ValueError(f"page {page_num}, line {line!r}: {e}") from e
        vfreq = strip_v_footnote(m.group("vfreq"))
        pclk_mhz = float(m.group("pclk"))
        pixel_clock_khz = round(pclk_mhz * 1000)
        for vic in vics:
            row = {
                "vic": vic,
                "width": hact,
                "height": vact,
                "interlaced": interlaced,
                "h_total": htot,
                "v_total": vtot,
                "pixel_clock_khz": pixel_clock_khz,
                "v_freq_hz": vfreq,
                "source_page": page_num,
            }
            if vic in rows:
                prior = rows[vic]
                differs_only_in_vtotal = (
                    prior["width"] == row["width"]
                    and prior["height"] == row["height"]
                    and prior["interlaced"] == row["interlaced"]
                    and prior["h_total"] == row["h_total"]
                    and prior["pixel_clock_khz"] == row["pixel_clock_khz"]
                )
                if not differs_only_in_vtotal:
                    raise ValueError(
                        f"VIC {vic} defined twice with different values: {prior} vs {row}"
                    )
                continue  # first-listed variant wins; see module docstring
            rows[vic] = row


def main() -> int:
    p = argparse.ArgumentParser(
        description="Extract CTA-861-H Table 1 (Video Format Timings) into a VIC timing CSV.",
        epilog=(
            "The source PDF is ANSI/CTA-861-H, downloadable from "
            "https://archive.org/download/ansi-cta-861-h-final/ANSI-CTA-861-H-Final.pdf . "
            "This script never downloads it: pass a local copy with --pdf."
        ),
    )
    p.add_argument("--pdf", required=True, help="Path to a local CTA-861-H PDF (never downloaded by this script)")
    p.add_argument("--out", required=True, help="Path to write the output CSV")
    args = p.parse_args()

    from pypdf import PdfReader

    reader = PdfReader(args.pdf)
    rows: dict = {}
    errors = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if "Table 1" not in text and i > 0:
            # Table 1 spans a contiguous run of pages; skip everything else,
            # but always look at the first page too in case of an off-by-one.
            continue
        try:
            parse_table1(text, i + 1, rows)
        except ValueError as e:
            errors.append(str(e))

    if errors:
        print("FAILED to parse CTA-861-H Table 1:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 1

    found = sorted(rows.keys())
    missing = sorted(set(EXPECTED_VICS) - set(found))
    extra = sorted(set(found) - set(EXPECTED_VICS))
    if missing or extra:
        print("FAILED: VIC set does not match CTA-861-H Table 1 (VIC 1-127, 193-219; 128-192 reserved):", file=sys.stderr)
        if missing:
            print(f"  missing: {missing}", file=sys.stderr)
        if extra:
            print(f"  unexpected: {extra}", file=sys.stderr)
        return 1

    with open(args.out, "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["vic", "width", "height", "interlaced", "h_total", "v_total", "pixel_clock_khz", "v_freq_hz", "source_page"])
        for vic in found:
            r = rows[vic]
            w.writerow([
                r["vic"]
```

### Core Architecture Module: `scripts/edid-timings/extract-dmt.py`
```
#!/usr/bin/env python3
"""Extract VESA DMT 1.13's DMT timing table into a CSV.

Source of record: VESA Display Monitor Timing Standard, Version 1.0, Rev. 13
(https://glenwing.github.io/docs/VESA-DMT-1.13.pdf).

Two things inside the PDF feed this script:

  - Table 2-1 "Summary of DMT ID, Std. 2 Byte & CVT 3 Byte Codes" (pages 10
    to 12) gives the DMT ID plus its EDID standard-timing 2-byte code and
    CVT 3-byte code, where they exist.
  - Section 4 "DMT Timing Specifications" (pages 18 onward), one physical
    page per DMT, gives the actual timing numbers ("EDID ID: DMT ID: XXh;
    Std. 2 Byte Code: ...; CVT 3 Byte Code: ...", "Resolution: W x H at
    R Hz (interlaced|non-interlaced)[ REDUCED BLANKING[ v2]]", "Pixel Clock
    =M;", "Hor Total Time =...= NPixels", "Ver Total Time =...= Nlines").

Both sources name the DMT ID and its Std./CVT codes; this script asserts
they agree rather than trusting either one alone.

Reduced blanking has two independent tells, one on each source, and this
script requires both to agree: the detail page's "Resolution:" line says
"REDUCED BLANKING" (with or without a trailing "v2"); Table 2-1's Refresh
Rate column says "(RB)" for the same DMT ID. The detail page's own "Method:"
line was tried first and rejected: it reads "*** NOT CVT COMPLIANT ***" for
some genuinely reduced-blanking, non-CVT modes (e.g. DMT 56h, 1366x768@60
RB) and "CVT Compliant" with no mention of blanking style at all for at
least one CVT reduced-blanking mode (DMT 4Ch, 2560x1600@60 RB) - it is not a
reliable second signal.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys

TABLE21_ROW_RE = re.compile(
    r"(?P<rb>\(RB\)\s+)?"
    r"(?P<id>[0-9A-Fa-f]{2})h\s+"
    r"(?P<std>\([0-9A-Fa-f]{2},\s*[0-9A-Fa-f]{2}\)h|n/a)\s+"
    r"(?P<cvt>\([0-9A-Fa-f]{2},\s*[0-9A-Fa-f]{2},\s*[0-9A-Fa-f]{2}\)h|n/a)"
)

RESOLUTION_RE = re.compile(
    r"Resolution:\s*(?P<w>\d+)\s*x\s*(?P<h>\d+)\s*at\s*(?P<refresh>[\d.]+)\s*Hz\s*"
    r"\((?P<scan>interlaced|non-interlaced)\)(?P<rb>\s*REDUCED BLANKING(?:\s*v2)?)?",
    re.IGNORECASE,
)
# Std. 2 Byte Code is printed as "(XX, YY)h" almost everywhere, but three
# detail pages (DMT 53h, 54h, 55h) print it as "XXh, YYh" instead. Both are
# accepted here; parse_code_bytes handles either shape.
STD_CODE_ALT = r"(?:\([0-9A-Fa-f]{2},\s*[0-9A-Fa-f]{2}\)h|[0-9A-Fa-f]{2}h,\s*[0-9A-Fa-f]{2}h|n/a)"
CVT_CODE_ALT = r"(?:\([0-9A-Fa-f]{2},\s*[0-9A-Fa-f]{2},\s*[0-9A-Fa-f]{2}\)h|n/a)"
EDID_ID_RE = re.compile(
    rf"DMT ID:\s*(?P<id>[0-9A-Fa-f]{{2}})h;\s*Std\.\s*2 Byte Code:\s*(?P<std>{STD_CODE_ALT})\s*;\s*"
    rf"CVT 3 Byte Code:\s*(?P<cvt>{CVT_CODE_ALT})"
)
PIXEL_CLOCK_RE = re.compile(r"Pixel Clock\s*=\s*([\d.]+)\s*;")
HOR_TOTAL_RE = re.compile(r"Hor Total Time.*?(\d+)\s*Pixels")
VER_TOTAL_RE = re.compile(r"Ver Total Time.*?(\d+)\s*lines")
SCAN_TYPE_RE = re.compile(r"Scan Type\s*=\s*(NONINTERLACED|INTERLACED)")

EXPECTED_IDS = list(range(0x01, 0x59))  # 0x01..0x58 inclusive, no gaps


def parse_code_bytes(text: str) -> int | None:
    if text.strip().lower() == "n/a":
        return None
    hexbytes = re.findall(r"[0-9A-Fa-f]{2}", text)
    value = 0
    for b in hexbytes:
        value = (value << 8) | int(b, 16)
    return value


def parse_table21(text: str, page_num: int, codes: dict) -> None:
    for m in TABLE21_ROW_RE.finditer(text):
        dmt_id = int(m.group("id"), 16)
        std = parse_code_bytes(m.group("std"))
        cvt = parse_code_bytes(m.group("cvt"))
        rb = m.group("rb") is not None
        if dmt_id in codes:
            prior = codes[dmt_id]
            if prior[:3] != (std, cvt, rb):
                raise ValueError(
                    f"Table 2-1: DMT ID {dmt_id:#04x} listed twice with different codes: {prior[:3]} vs {(std, cvt, rb)}"
                )
            continue
        codes[dmt_id] = (std, cvt, rb, page_num)


def parse_detail_page(text: str, page_num: int) -> dict | None:
    edid_m = EDID_ID_RE.search(text)
    if not edid_m:
        return None
    dmt_id = int(edid_m.group("id"), 16)
    std = parse_code_bytes(edid_m.group("std"))
    cvt = parse_code_bytes(edid_m.group("cvt"))

    res_m = RESOLUTION_RE.search(text)
    if not res_m:
        raise ValueError(f"page {page_num}: found EDID ID for DMT {dmt_id:#04x} but no Resolution: line")
    width = int(res_m.group("w"))
    height = int(res_m.group("h"))
    resolution_rb = res_m.group("rb") is not None
    interlaced_from_resolution = res_m.group("scan").lower() == "interlaced"

    scan_m = SCAN_TYPE_RE.search(text)
    if not scan_m:
        raise ValueError(f"page {page_num}: DMT {dmt_id:#04x} has no Scan Type line")
    interlaced_from_scan_type = scan_m.group(1) == "INTERLACED"
    if interlaced_from_resolution != interlaced_from_scan_type:
        raise ValueError(
            f"page {page_num}: DMT {dmt_id:#04x} Resolution: line and Scan Type: line disagree on interlacing"
        )
    interlaced = interlaced_from_resolution

    reduced_blanking = resolution_rb

    pclk_m = PIXEL_CLOCK_RE.search(text)
    if not pclk_m:
        raise ValueError(f"page {page_num}: DMT {dmt_id:#04x} has no Pixel Clock line")
    pixel_clock_khz = round(float(pclk_m.group(1)) * 1000)

    htot_m = HOR_TOTAL_RE.search(text)
    if not htot_m:
        raise ValueError(f"page {page_num}: DMT {dmt_id:#04x} has no parseable Hor Total Time line")
    h_total = int(htot_m.group(1))

    vtot_m = VER_TOTAL_RE.search(text)
    if not vtot_m:
        raise ValueError(f"page {page_num}: DMT {dmt_id:#04x} has no parseable Ver Total Time line")
    v_total = int(vtot_m.group(1))

    return {
        "dmt_id": dmt_id,
        "width": width,
        "height": height,
        "refresh_hz": res_m.group("refresh"),
        "interlaced": interlaced,
        "reduced_blanking": reduced_blanking,
        "h_total": h_total,
        "v_total": v_total,
        "pixel_clock_khz": pixel_clock_khz,
        "std_code": std,
        "cvt_code": cvt,
        "source_page": page_num,
    }


def main() -> int:
    p = argparse.ArgumentParser(
        description="Extract the VESA DMT 1.13 timing table (Table 2-1 + Section 4 detail pages) into a CSV.",
        epilog=(
            "The source PDF is the VESA Display Monitor Timing Standard v1.0 Rev 13, downloadable from "
            "https://glenwing.github.io/docs/VESA-DMT-1.13.pdf . "
            "This script never downloads it: pass a local copy with --pdf."
        ),
    )
    p.add_argument("--pdf", required=True, help="Path to a local VESA DMT 1.13 PDF (never downloaded by this script)")
    p.add_argument("--out", required=True, help="Path to write the output CSV")
    args = p.parse_args()

    from pypdf import PdfReader

    reader = PdfReader(args.pdf)
    codes: dict = {}
    details: dict = {}
    errors = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        page_num = i + 1
        if "Table 2-1" in text or (10 <= page_num <= 12):
            try:
                parse_table21(text, page_num, codes)
            except ValueError as e:
                errors.append(str(e))
        try:
            row = parse_detail_page(text, page_num)
        except ValueError as e:
            errors.append(str(e))
            row = None
        if row is not None:
            if row["dmt_id"] in details:
                raise ValueError(f"DMT ID {row['dmt_id']:#04x} has a detail page on both "
                                  f"{details[row['dmt_id']]['source_page']} and {page_num}")
            details[row["dmt_id"]] = row

    if errors:
        print("FAILED to parse VESA DMT 1.13:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        return 1

    found_detail = sorted(details.keys())
    missing = sorted(set(EXPECTED_IDS) - set(found_detail))
    extra = sorted(set(found_detail) - set(EXPECTED_IDS))
    if missing or extra:
        print("FAILED: DMT ID set from detail pages does 
```

### Core Architecture Module: `scripts/probe-vdm.c`
```
/*
 * probe-vdm.c - Test whether we can read VDM payload data from AppleHPMLib.
 *
 * Probes the IOAccessoryManagerUserClient on each USB-C port to check:
 *   1. Can we open the user client without special entitlements?
 *   2. Does selector 4 (receiveVDM) return any data?
 *   3. Does selector 1 (iecsRead) let us read VDM-related registers?
 *
 * Build:  clang -o probe-vdm scripts/probe-vdm.c -framework IOKit -framework CoreFoundation
 * Run:    ./probe-vdm          (try without root first)
 *         sudo ./probe-vdm    (try with root if the above fails)
 *
 * This is a throwaway research tool, not production code.
 */

#include <stdio.h>
#include <string.h>
#include <IOKit/IOKitLib.h>
#include <CoreFoundation/CoreFoundation.h>

static const char *ioreturn_name(kern_return_t kr) {
    switch (kr) {
        case KERN_SUCCESS:           return "SUCCESS";
        case 0xe00002c2:             return "kIOReturnNotPermitted";
        case 0xe00002bc:             return "kIOReturnNotPrivileged";
        case 0xe00002c7:             return "kIOReturnExclusiveAccess";
        case 0xe00002be:             return "kIOReturnBadArgument";
        case 0xe00002ed:             return "kIOReturnUnsupported";
        case 0xe00002f0:             return "kIOReturnNotFound";
        case 0xe00002eb:             return "kIOReturnNoDevice";
        default:                     return "unknown";
    }
}

static void print_hex(const uint8_t *buf, size_t len) {
    for (size_t i = 0; i < len; i++) {
        printf("%02x", buf[i]);
        if ((i + 1) % 16 == 0) printf("\n    ");
        else if ((i + 1) % 4 == 0) printf(" ");
    }
    printf("\n");
}

static void probe_port(io_service_t service, const char *name) {
    printf("\n=== %s ===\n", name);

    io_connect_t connect = 0;
    kern_return_t kr;

    /* Try opening the user client */
    kr = IOServiceOpen(service, mach_task_self(), 0, &connect);
    printf("  IOServiceOpen(type=0): 0x%x (%s)\n", kr, ioreturn_name(kr));

    if (kr != KERN_SUCCESS) {
        /* Try type 1 in case that's the read-only client */
        kr = IOServiceOpen(service, mach_task_self(), 1, &connect);
        printf("  IOServiceOpen(type=1): 0x%x (%s)\n", kr, ioreturn_name(kr));
    }

    if (kr != KERN_SUCCESS) {
        printf("  Cannot open user client. Try with sudo.\n");
        return;
    }

    printf("  User client opened successfully (connect=%u)\n", connect);

    /*
     * Selector 4: receiveVDM
     * Signature: receiveVDM(void*, uint64_t, uint64_t, uint64_t, uint32_t,
     *                       AppleHPMSOPType*, uint8_t*, uint64_t*)
     * Try with various input scalar counts since we're guessing the ABI.
     */
    printf("\n  --- Selector 4 (receiveVDM) ---\n");
    {
        uint64_t input[4] = {0, 0, 0, 0};
        uint64_t output[8] = {0};
        uint32_t outputCount = 8;

        kr = IOConnectCallScalarMethod(connect, 4, input, 4, output, &outputCount);
        printf("  CallScalar(sel=4, in=4): 0x%x (%s), outCount=%u\n",
               kr, ioreturn_name(kr), outputCount);
        if (kr == KERN_SUCCESS && outputCount > 0) {
            printf("  Output scalars:");
            for (uint32_t i = 0; i < outputCount; i++)
                printf(" [%u]=0x%llx", i, output[i]);
            printf("\n");
        }

        /* Also try with struct output (the payload might come as struct data) */
        uint8_t structOut[256] = {0};
        size_t structOutSize = sizeof(structOut);
        uint64_t input2[4] = {0, 0, 0, 0};

        kr = IOConnectCallMethod(connect, 4,
                                 input2, 4,    /* scalar in */
                                 NULL, 0,      /* struct in */
                                 output, &outputCount, /* scalar out */
                                 structOut, &structOutSize); /* struct out */
        printf("  CallMethod(sel=4, structOut): 0x%x (%s), structSize=%zu\n",
               kr, ioreturn_name(kr), structOutSize);
        if (kr == KERN_SUCCESS && structOutSize > 0) {
            printf("  Struct output (%zu bytes):\n    ", structOutSize);
            print_hex(structOut, structOutSize > 64 ? 64 : structOutSize);
        }
    }

    /*
     * Selector 5: receiveVDMAttention
     * Same signature as receiveVDM but for attention VDMs.
     */
    printf("\n  --- Selector 5 (receiveVDMAttention) ---\n");
    {
        uint64_t input[4] = {0, 0, 0, 0};
        uint64_t output[8] = {0};
        uint32_t outputCount = 8;

        kr = IOConnectCallScalarMethod(connect, 5, input, 4, output, &outputCount);
        printf("  CallScalar(sel=5, in=4): 0x%x (%s), outCount=%u\n",
               kr, ioreturn_name(kr), outputCount);
        if (kr == KERN_SUCCESS && outputCount > 0) {
            printf("  Output scalars:");
            for (uint32_t i = 0; i < outputCount; i++)
                printf(" [%u]=0x%llx", i, output[i]);
            printf("\n");
        }
    }

    /*
     * Selector 1: iecsRead - try reading VDM-related registers.
     * TPS6598x register map (may not match Apple's custom chip):
     *   0x4d = macvdmtool response register
     *   0x60 = Rx User SVID Attention VDM
     *   0x61 = Rx User SVID Non-attention VDM
     *   0x1a = Status register
     *   0x5f = Data Status register
     */
    printf("\n  --- Selector 1 (iecsRead) ---\n");
    uint8_t regs[] = {0x1a, 0x3f, 0x4d, 0x5f, 0x60, 0x61};
    const char *regNames[] = {"Status", "PowerStatus", "VDM Response (macvdm)",
                               "DataStatus", "RxAttentionVDM", "RxNonAttnVDM"};

    for (int i = 0; i < 6; i++) {
        uint64_t input[5] = {regs[i], 0, 0, 0, 0};
        uint64_t output[8] = {0};
        uint32_t outputCount = 8;

        kr = IOConnectCallScalarMethod(connect, 1, input, 5, output, &outputCount);
        printf("  Reg 0x%02x (%s): 0x%x (%s)",
               regs[i], regNames[i], kr, ioreturn_name(kr));
        if (kr == KERN_SUCCESS && outputCount > 0) {
            printf(" =");
            for (uint32_t j = 0; j < outputCount; j++)
                printf(" 0x%llx", output[j]);
        }
        printf("\n");

        /* Also try with struct output for larger register reads */
        uint8_t structOut[128] = {0};
        size_t structOutSize = sizeof(structOut);

        kr = IOConnectCallMethod(connect, 1,
                                 input, 5, NULL, 0,
                                 output, &outputCount,
                                 structOut, &structOutSize);
        if (kr == KERN_SUCCESS && structOutSize > 0) {
            printf("    Struct data (%zu bytes): ", structOutSize);
            print_hex(structOut, structOutSize > 32 ? 32 : structOutSize);
        }
    }

    /*
     * Bonus: try selectors 0 through 13 with no inputs to map the interface.
     * Only report the return code, don't try to write/send anything.
     */
    printf("\n  --- Selector survey (read-only probe) ---\n");
    for (int sel = 0; sel <= 13; sel++) {
        if (sel == 0) continue;  /* skip sendVDM */
        if (sel == 3) continue;  /* skip iecsWrite */
        if (sel == 7) continue;  /* skip forceMode */
        if (sel == 8) continue;  /* skip forceUpdateMode */

        uint64_t output[4] = {0};
        uint32_t outputCount = 4;

        kr = IOConnectCallScalarMethod(connect, sel, NULL, 0, output, &outputCount);
        printf("  Selector %2d: 0x%x (%s), outCount=%u\n",
               sel, kr, ioreturn_name(kr), outputCount);
    }

    IOServiceClose(connect);
}

int main(void) {
    printf("probe-vdm: Testing VDM payload access via IOAccessoryManagerUserClient\n");
    printf("Running as uid=%d\n\n", getuid());

    io_iterator_t iter;
    kern_return_t kr;

    /* Match AppleHPMInterfaceType10 (USB-C ports) */
    CFMutableDictionaryRef match = IOServiceMatching("AppleHPMInterfaceType10");
    kr = IOServiceGetMatchingServices(kIOMainPortDefault, match, &iter);
    if (kr != KERN_SUCCESS) {
        printf("No AppleHPMInterfaceType10 services found (0
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #611** (2026-09-14): **[Bug] new brew Warnings!**
  *Symptoms*: ### What's wrong  FYI: new brew v7.0 says this warnings:  Warning: Calling the `verified` parameter in the `url` stanza is deprecated! Use the default URL verification behaviour instead. Please report this issue to the darrylmorley/homebrew-whatcable tap (not Homebrew/* repositories), or even better, submit a PR to fix it:   /opt/homebrew/Library/Taps/darrylmorley/homebrew-whatcable/Casks/whatcable.rb:5 . . .  ### Mac model  M4 MacBook  ### macOS version  15.7.9  ### WhatCable version  1.4  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell - ```  ### System Information cross-check (optional)  _No response_  ### How often does this happen?  Every time  ### Anything else  _No response_
  **Post-Mortem & Fix Analysis**:
  > I hope this gets fixed soon. Every time I run `brew update && brew upgrade` this error spams the terminal. (the message appears 3 times or so)  Sorry for the confusion; I reported this issue on the wrong repo. But since there are already multiple PRs open for this issue, it would be an easy fix.
  > Thanks for the report. This one lives in the Homebrew tap rather than the app, and it is now fixed there (darrylmorley/homebrew-whatcable#6). Run `brew update` and the warning should be gone. Closing here, and thanks to Zettt for pointing at the open PRs.

- **Issue #602** (2026-09-14): **[Bug] Calling the `verified` parameter in the `url` stanza is deprecated**
  *Symptoms*: ### What's wrong  Just sharing what I see on my Macbook  ``` > brew outdated Warning: Calling the `verified` parameter in the `url` stanza is deprecated! Use the default URL verification behaviour instead. Please report this issue to the darrylmorley/homebrew-whatcable tap (not Homebrew/* repositories), or even better, submit a PR to fix it:   /opt/homebrew/Library/Taps/darrylmorley/homebrew-whatcable/Casks/whatcable.rb:5 ```  ### Mac model  MacBook Air M4  ### macOS version  26.6.2  ### WhatCable version  1.4.0  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell whatcable --json --raw {   "adapter" : {     "currentMA" : 5000,     "description" : "pd charger",     "isWireless" : false,     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 100   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : false,       "bullets" : [         "USB 3.2 Gen 1 (5 Gbps)",         "Connected device: USB Peripheral, VIA Labs, Inc. (0x2109) (PD 3.0)",         "No e-marker detected. This cable doesn't advertise its capabilities.",         "Charger advertises up to 100W",         "Currently negotiated: 20V @ 5.00A (100W)"       ],       "charging" : {         "bottleneck" : "fine",         "detail" : "Charger and cable are fine. The Mac will draw up to 100W when it needs to.",         "isWarning" : false,         "summary" : "Battery full, not charging"       },     
  **Post-Mortem & Fix Analysis**:
  > Thanks for the update! `-zsh 8:56 brew update               ==> Updating Homebrew... Updated 1 tap (darrylmorley/whatcable).`
  > Fixed. The `verified:` line is gone from the cask on the tap (darrylmorley/homebrew-whatcable#6), so `brew update` should be quiet again. Thanks for the report, and for the patience while it sat.

- **Issue #551** (2026-08-21): **[Bug] Inconsistency with notifications about connected or disconnected devices**
  *Symptoms*: ### What's wrong  When having the "Notify on cable changes" setting enabled, WhatCable notifies the user about newly connected or disconnected devices. During testing however, I have discovered that what WhatCable notifies the user of, varies with seamingly no reason.  ### Mac model  M1 Pro MacBook Pro 14-inch 2021  ### macOS version  Sequoia 15.7.1 (24G231)  ### WhatCable version  1.5.0-beta.3  ### Cable  OEM cable of the dock below  ### What's plugged into the other end?  DIGITUS USB Type-C™ Multiport Travel Dock, 8-Port DA-70866  ### `whatcable --json --raw` output  ```shell {   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : true,       "bulletGroups" : [         {           "header" : "What the cable's e-marker reports",           "lines" : [             "Cable speed: USB 3.2 Gen 2 (10 Gbps)",             "Cable rated for 5 A at up to 20V (~100W)",             "Passive (no signal-conditioning electronics)"           ],           "source" : "emarker"         },         {           "header" : "What your Mac measured",           "lines" : [             "USB 3.2 Gen 1 (5 Gbps)",             "Connected device: Alternate Mode Adapter, VIA Labs, Inc. (0x2109) (PD 3.0)"           ],           "source" : "measured"         },         {           "header" : "What WhatCable knows",           "lines" : [             "Made by CE LINK LIMITED (0x2095), per our bundled vendor list"           ],           "source" : "database"         }       ],       "bulle
  **Post-Mortem & Fix Analysis**:
  > Thanks for this. Root cause: macOS doesn't report a hub and the devices behind it leaving as one event, it dribbles them out, and WhatCable was notifying on whatever slice happened to arrive together. Which names you saw depended on timing, hence the inconsistency.  Fixed: changes now settle for a moment, then get grouped under the hub they belong to. Unplugging the DIGITUS dock posts one notification titled with the hub and naming what left with it. Same for plugging in, which costs about 1.5 seconds of notification delay, the price of waiting for the full picture.  The test data for this fix is built from your capture. In the next beta. 
  > The grouping fix shipped in v1.5.0-beta.4 and the split-fire inconsistency it targeted is gone. The remaining connect-side gap you found is tracked in #556, so closing this one.

- **Issue #505** (2026-08-05): **[Bug] Incorrect cable identification: Ugreen cable reported as Anker Prime Thunderbolt 5 cable**
  *Symptoms*: ### What's wrong  The vendor and model of my Ugreen Thunderbolt 5 USB-C Cable displayed as Anker Prime Thunderbolt 5 Cable  ### Mac model  MacBook Pro M3 Series (14-inch 2023)  ### macOS version  27.0  ### WhatCable version  1.3.0  ### Cable  UGREEN Thunderbolt 5 USB-C Cable, 80Gbps & 240W  ### What's plugged into the other end?  UGREEN 40Gbps M.2 NVMe SSD Enclosure with Cooling Fan  ### `whatcable --json --raw` output  ```shell {   "adapter" : {     "currentMA" : 4690,     "description" : "pd charger",     "isWireless" : false,     "manufacturer" : "Apple Inc.",     "model" : "0x7002",     "name" : "96W USB-C Power Adapter",     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 94   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : false,       "bullets" : [         "Charger: Apple Inc. 96W USB-C Power Adapter",         "Charger advertises up to 94W",         "Currently negotiated: 20V @ 4.69A (94W)"       ],       "charging" : {         "bottleneck" : "fine",         "detail" : "Charger and cable are well-matched. The Mac draws what it needs moment to moment, up to this limit.",         "isWarning" : false,         "summary" : "Charging well · up to 94W"       },       "className" : "AppleHPMInterfaceType11",       "connectionActive" : true,       "headline" : "Charging · 94W charger",       "name" : "Port-MagSafe 3@1",       "pdCapable" : false,       "powerSources" : [         {           "maxPowerW" : 94,        
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, and you're right that the label is wrong. What's happening under the hood: your UGREEN cable and Anker's Prime TB5 cable are the same physical cable inside, made by ACON (Advanced-Connectek), who sell it to both brands. The chip in the cable reports ACON's identity, and it's byte-identical in both products, right down to the same USB-IF certificate (that CBAUB-H46-100A model in your output is ACON's own model number). So WhatCable matched it against the first brand we'd seen it in, which happened to be Anker.  There's no way to tell the two apart from the cable data itself, the sleeve brand isn't in there. But the confident "identified as Anker" wording is our bug. The next release will list both: something like "this e-marker is used in: Anker Prime TB5 cable, UGREEN TB5 cable (same maker, ACON)". Your report is what surfaced this, so thanks, I'll add your UGREEN cable to the database alongside the Anker entry. 

- **Issue #503** (2026-08-03): **[Bug] Whatcable is missing from Menu Bar**
  *Symptoms*: ### What's wrong  I ticked the box to have it appear only in the menu bar, and after updating to MacOS 26.6 it disappeared from the menu bar. A restart didn't help. If I run `whatcable --desktop` gets it back in the dock, but when I re-tick "Show in menu bar" it doesn't show in the menu bar. I think have to force quit, and re run `whatcable --desktop` to get the dock icon and window back.  ### Mac model  M4 Max MBP  ### macOS version  26.6  ### WhatCable version  1.3.0  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell {   "adapter" : {     "currentMA" : 5000,     "description" : "pd charger",     "isWireless" : false,     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 28000,     "watts" : 140   },   "isDesktopMac" : false,   "otherUSBDevices" : {     "behindPort" : "Port-USB-C@3",     "devices" : [       {         "locationID" : "0x20100000",         "name" : "TS5 Plus USB 3 Hub - C",         "productID" : 8309,         "serialNumber" : "11112222333320CC",         "speed" : "Super Speed+ (10 Gbps)",         "usbVersion" : "3.2",         "vendorID" : 8584,         "vendorName" : "CalDigit, Inc."       },       {         "locationID" : "0x20200000",         "name" : "TS5 Plus USB 3 Hub - B",         "productID" : 8308,         "serialNumber" : "11112222333320CE",         "speed" : "Super Speed+ (10 Gbps)",         "usbVersion" : "3.2",         "vendorID" : 8584,         "vendorName" : "CalDig
  **Post-Mortem & Fix Analysis**:
  > Hi robotprom,  Two things cause this and they look identical from the outside. One is macOS remembering the icon as hidden: it stores that itself, and WhatCable's own toggle can't override it, which would explain why re-ticking "Show in menu bar" does nothing. The other is the notch: past a certain number of menu bar items macOS silently drops the ones that don't fit, and an OS update is a common trigger for that.  Two commands will tell me which. Switch back to menu bar mode first so there's something to log, then run:  ``` defaults read uk.whatcable.whatcable | grep -i NSStatusItem ```  ``` log show --predicate 'subsystem == "uk.whatcable.whatcable"' --last 1h | grep menuBar ```  If the first prints `NSStatusItem Visible Item-0 = 0`, or the log says `isVisible=false`, it's the remembered-hidden case and I can fix that in the app. If the log says `isVisible=true` and the menu bar still shows nothing, it's space, and removing a few other menu bar items should bring it back. 
  > `defaults read uk.whatcable.whatcable | grep -i NSStatusItem` results in:   `"NSStatusItem Preferred Position Item-0" = 316;`  `log show --predicate 'subsystem == "uk.whatcable.whatcable"' --last 1h | grep menuBar` results in  ``` 2026-08-03 09:02:16.284942-0400 0xfef467   Default     0x2211755c           46300  0    WhatCable: [uk.whatcable.whatcable:lifecycle] menuBar: popover created 2026-08-03 09:02:16.290408-0400 0xfef467   Default     0x2211755c           46300  0    WhatCable: [uk.whatcable.whatcable:lifecycle] menuBar: statusItem button configured, hasImage=true, frame=(0.0, 0.0, 30.0, 22.0) 2026-08-03 09:02:16.290409-0400 0xfef467   Default     0x2211755c           46300  0    WhatCable: [uk.whatcable.whatcable:lifecycle] menuBar: statusItem created, isVisible=true ```  I currently have my MBP connected to an external monitor, so the notch shouldn't be the issue.
  > Hi robotprom,  That rules out both of my guesses. WhatCable creates the item, macOS reports it as visible, and it has a real 30x22 frame with the icon in it. Nothing wrong on the app's side, so something is stopping macOS drawing it.  Tahoe added a per-app switch for exactly this. System Settings > Menu Bar, scroll down to "Allow in the Menu Bar". Apple's own wording for it is "Turning off a menu bar item will prevent it from ever appearing in the menu bar", which matches what you're seeing. Check WhatCable is switched on in that list.  If it's already on, switch it off and back on anyway. That makes macOS re-register the item, which is worth a try on the off chance it's just stuck.  Still nothing after that, send me a screenshot of your full menu bar. 

- **Issue #491** (2026-07-31): **[Bug] Power monitor stuck on "waiting for power telemetry from macOS" on port connected to charger**
  *Symptoms*: ### What's wrong  Expected: WhatCable to either show actual data or an informational banner on why power telemetry is not available  Actual: WhatCable waits infinitely for power telemetry  <img width="732" height="574" alt="Image" src="https://github.com/user-attachments/assets/10c27658-0a55-4122-a0a0-f0a00fe64f24" />  ### Mac model  M1 Pro MacBook Pro 14-inch 2021  ### macOS version  Sequoia 15.7.1 (24G231)  ### WhatCable version  1.2.1  ### Cable  UGREEN branded cable  ### What's plugged into the other end?  UGREEN GaN Fast Charger - Model: CD226  ### `whatcable --json --raw` output  ```shell {   "adapter" : {     "currentMA" : 5000,     "description" : "pd charger",     "isWireless" : false,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 100   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : false,       "bullets" : [         "No e-marker detected. The cable may have one, but macOS only reads it above 3A or with Thunderbolt.",         "System reports charger at 100W"       ],       "className" : "AppleTCControllerType10",       "connectionActive" : true,       "device" : {         "pdRevision" : "PD 3.0",         "productID" : 0,         "vendorID" : 0,         "vendorName" : "No vendor reported"       },       "headline" : "Charging · 100W charger",       "name" : "Port-USB-C@2",       "pdCapable" : true,       "powerSources" : [        ],       "rawProperties" : {         "AccessoryMode" : "0",         "ActiveCable" : "0",   
  **Post-Mortem & Fix Analysis**:
  > Hi @official-Cromatin  Confirmed bug, and it is specific to the M1 Pro and M1 Max. On that silicon macOS never reports what the charger and the port agreed, so the card has nothing to show and sits there waiting.  The chart at the bottom is right, by the way. That is your real charger draw.  The numbers do exist, just in the Mac's power controller rather than where the app was looking. So the card can show what your charger and Mac agreed on that port, 100W at 20V and 5A, which is what it already shows on other Macs. The live figure stays in the chart below. Fix in progress.  If you get a chance, run Contribute Diagnostic Data from Settings on the current release. It picks up something 1.2.1 didn't, and it would let me confirm the fix lands on the right port on your hardware. 
  > Hi @official-Cromatin  There is a beta build with a fix for this, if you would like to try it: https://github.com/darrylmorley/whatcable/releases/tag/v1.3.0-beta.4  The contract your charger negotiated was in the SMC all along, so the card now reads it from there when macOS does not publish it. Your 100 W at 20 V / 5 A should appear on the port instead of the spinner.  If it looks right, say so and it goes into the next release. If it looks wrong, that is more useful still. It is the reading I could not test myself, since no machine I have reproduces your setup. 
  > Thanks @darrylmorley for replying so fast. Sorry for not getting back to you earlier, I had a lot to do today.  With version `v1.3.0-beta.4` its now correctly reported. I have also contributed my diagnostics data with this same version, while having the same charger and cable attached.  <img width="632" height="594" alt="Image" src="https://github.com/user-attachments/assets/adfdc44b-6426-4c99-a3e4-80888e25434a" />   One more question, the overview only shows the negotiated USB-PD profile. Is this linked to the limitation with the M1 Pro and M1 Max you mentioned earlier or the missing data connection between my machine and the charger? It's nothing that bothers me, just something I noticed.  <img width="632" height="741" alt="Image" src="https://github.com/user-attachments/assets/7c419bf7-b817-44f7-9ca7-0ec7a0cc630b" />  If you need any more info on this or anything else in the future, just let me know.

- **Issue #471** (2026-07-23): **[Bug] WhatCable incorrectly identifies MagSafe port as USB-C port when "Hide empty ports" is enabled**
  *Symptoms*: ### What's wrong  Expected: When "hide empty ports" is enabled, WhatCable will report that 3 USB-C ports and 1 MagSafe port is detected. Actual: WhatCable identifies all 4 ports as USB-C, which I imagine to just be incorrect wording rather than a bug  Please see photos  ### Mac model  M3 Pro Macbook Pro (14 inch, Nov 2023)  ### macOS version  27.0 (Developer Beta 3)  ### WhatCable version  v1.2.1  ### Cable  _No response_  ### What's plugged into the other end?  _No response_  ### `whatcable --json --raw` output  ```shell Last login: Tue Jul 21 20:16:17 on console /Applications/WhatCable.app/Contents/Helpers/whatcable ; exit; REDACTED@Mac ~ % /Applications/WhatCable.app/Contents/Helpers/whatcable ; exit; === Port-MagSafe 3@1 (MagSafe 3) === Nothing connected Plug a cable into Port-MagSafe 3@1 to see what it can do.  === Port-USB-C@1 (USB-C) === Nothing connected Plug a cable into Port-USB-C@1 to see what it can do.  === Port-USB-C@2 (USB-C) === Nothing connected Plug a cable into Port-USB-C@2 to see what it can do.  === Port-USB-C@3 (USB-C) === Nothing connected Plug a cable into Port-USB-C@3 to see what it can do.  Saving session... ...copying shared history... ...saving history...truncating history files... ...completed. Deleting expired sessions...none found.  [Process completed] ```  ### System Information cross-check (optional)  <img width="278" height="101" alt="Image" src="https://github.com/user-attachments/assets/13dddc90-d322-448f-8c26-5fb9725dc52e" />  ### How ofte
  **Post-Mortem & Fix Analysis**:
  > Hi @cannotcollide!  Thanks for the report.  You're right, it's wording. The count is correct, the label isn't. Fixed for the next release.

- **Issue #462** (2026-07-22): **[Bug] Running WhatCable prevents Kensignton's KensigntonWorks driver from functioning**
  *Symptoms*: ### What's wrong  Expected: Running WhatCable v1.2.1 doesn't prevent my Kensington Expert Mouse/KensingtonWorks from working. What happens: As soon as I launch WhatCable and it does its port scan, my trackball stops working--meaning the trackball can no longer control the pointer at all. My Apple MagicTrackpad continues to work (also connected via USB). Unplugging and replugging the trackball doesn't resolve the issue while WhatCable is running. Once I quit WhatCable, the trackball continues not to work UNTIL I unplug and plug it back in. Then it functions normally again.  ### Mac model  M1Max MacBook Pro  ### macOS version  26.5.2  ### WhatCable version  1.2.1  ### Cable  USB-A to Kensington Expert Mouse (trackball)  ### What's plugged into the other end?  Kensington Expert Mouse (trackball)  ### `whatcable --json --raw` output  whatcable --json --raw output {   "adapter" : {     "currentMA" : 4900,     "description" : "pd charger",     "isWireless" : false,     "powerTier" : 2,     "source" : "AC",     "voltageMV" : 20000,     "watts" : 98   },   "isDesktopMac" : false,   "ports" : [     {       "billboardDevicePresent" : true,       "bullets" : [         "Linked at up to 20 Gb\/s × 2",         "Connected via 2 hops: CalDigit, Inc. TS4 → CalDigit, Inc. Element 5 Hub",         "Connected device: USB Peripheral, CalDigit, Inc. (0x2188) (PD 3.0)",         "Cable has an e-marker chip (advertises its capabilities)",         "Cable speed: USB4 Gen 3 (40 Gbps, Thunderbolt 4 class)
  **Post-Mortem & Fix Analysis**:
  > Hi @trusswalker,  I think I know what this is. WhatCable asks every USB device a standard "what are you capable of?" question when it scans. It's a read-only request and it doesn't open the device, but some devices react badly to being asked at all. A 2.4 GHz mouse receiver had the same reaction in #370.  There's a switch for it. Open Settings (the gear at the top of the panel) and turn on Skip deep USB probing. That stops WhatCable asking USB devices anything, so if this is the cause, your trackball should be fine with WhatCable running.
  > Thanks @darrylmorley !  That did indeed resolve the issue! I appreciate the response and the product! As you can tell, I have a lot of devices hanging on my USB ports.  Thanks again! -Steve

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

### Incident Patch 1: `3b7f671f` (2026-09-23)
**Commit Message**: Mirror from private (7896f2dc)

**File**: `data/known-cables.md` (modified, +25/-9)
```diff
@@ -43,9 +43,10 @@ hand-maintained markdown table; format may change once the consumer exists.
 | Monoprice Essentials USB-C 10 Gbps 0.5 m | `0x2095` | `0x004F` |  | CE LINK LIMITED | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#48](https://github.com/darrylmorley/whatcable/issues/48) |
 | Amazon Basics USB-C TB4 cable 1 m (240 W), USB-IF certified | `0x2095` | `0x03CF` | `0x110A2E43` | CE LINK LIMITED | `0x34F2` | USB4 Gen 3 (40 Gbps, Thunderbolt 4 class) | 5 A / 50 V (240 W) | passive | [#231](https://github.com/darrylmorley/whatcable/issues/231) |
 | delock TB3-branded cable | `0x20C2` | `0x0005` |  | Sumitomo Electric Ind., Ltd., Optical Comm. R&D Lab | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#44](https://github.com/darrylmorley/whatcable/issues/44) |
-| OWC Thunderbolt 3 cable, bundled with Mercury Elite Pro Dock | `0x20C2` | `0x0007` | `0x31082052` | Sumitomo Electric Ind., Ltd., Optical Comm. R&D Lab | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#143](https://github.com/darrylmorley/whatcable/issues/143) |
+| OWC Thunderbolt 3 cable, bundled with Mercury Elite Pro Dock; also shipped with the CalDigit TS3 Plus | `0x20C2` | `0x0007` | `0x31082052` | Sumitomo Electric Ind., Ltd., Optical Comm. R&D Lab | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#143](https://github.com/darrylmorley/whatcable/issues/143), [#557](https://github.com/darrylmorley/whatcable/issues/557) |
 | SanDisk Extreme SSD bundled cable | `0x2109` | `0x0000` | `0x00082022` | VIA Labs, Inc. | none | USB 3.2 Gen 2 (10 Gbps) | 3 A / 20 V (60 W) | passive | [#202](https://github.com/darrylmorley/whatcable/issues/202) |
 | Generic USB-C cable used with Dell P2422HE monitor (unbranded) | `0x228A` | `0x0000` | `0x00084041` | Hotron Precision Electronic Ind. Corp. | `0x294` | USB 3.2 Gen 1 (5 Gbps) | 5 A / 20 V (100 W) | passive | [#177](https://github.com/darrylmorley/whatcable/issues/177) |
+| Corsair XENEON 34WQHD240-C monitor bundled cable (Hotron ODM, cert HT-C22) | `0x228A` | `0x0000` | `0x00084041` | Hotron Precision Electronic Ind. Corp. | `0x298` | USB 3.2 Gen 1 (5 Gbps) | 5 A / 20 V (100 W) | passive | [#609](https://github.com/darrylmorley/whatcable/issues/609) |
 | Monitor bundled cable (Hotron ODM) | `0x228A` | `0x0000` | `0x00082042` | Hotron Precision Electronic Ind. Corp. | `0x293` | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#207](https://github.com/darrylmorley/whatcable/issues/207) |
 | OnePlus SuperVOOC 10A cable (Type-C to Type-C) | `0x22D9` | `0x1428` | `0x60082A40` | GuangDong OPPO Mobile Telecommunications Corp., Ltd. | none | USB 2.0 (480 Mbps) | 5 A / 30 V (150 W) | passive | [#148](https://github.com/darrylmorley/whatcable/issues/148) |
 | Anker Nano 240 W USB-C cable 1.8 m | `0x291A` | `0x82E2` | `0x000A4E40` | Anker Innovations Limited | none | USB 2.0 (480 Mbps) | 5 A / 50 V (240 W) | passive | [#233](https://github.com/darrylmorley/whatcable/issues/233) |
@@ -72,10 +73,10 @@ hand-maintained markdown table; format may change once the consumer exists.
 | Kramer C-U32/MFF-6, 6 ft AV cable | `0x7857` | `0x1004` | `0x00084842` | Unregistered | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#260](https://github.com/darrylmorley/whatcable/issues/260) |
 | CUKTECH No.6 140 W (e-marker present but VID/PID/speed all zeroed) | `0x0000` | `0x0000` |  | (zeroed) | none | (none advertised) | (not advertised) | passive | [#61](https://github.com/darrylmorley/whatcable/issues/61) |
 | vorodcip generic USB-C cable, Amazon Japan (VID/PID zeroed) | `0x0000` | `0x0000` | `0x000A6642` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 50 V (240 W) | passive | [#91](https://github.com/darrylmorley/whatcable/issues/91) |
-| Dockcase 100 W 10 Gbps 0.5 m (VID/PID zeroed) | `0x0000` | `0x0000` | `0x00082042` | (zeroed) | none | USB 3.2 Gen 2 (10 Gbps) | 5 A / 20 V (100 W) | passive | [#92](https://github.com/darrylmorley/whatcable/issues/
```

**File**: `docs/cables.html` (modified, +100/-15)
```diff
@@ -467,7 +467,7 @@
   "name": "WhatCable cable fingerprint database",
   "description": "Crowd-sourced USB-C cable e-marker fingerprints reported via WhatCable. Entries record the reported manufacturer and product identifiers, encoded cable capabilities, declared speed and charging rating, with links to the original reports. These are identity reports, not physical performance tests.",
   "url": "https://www.whatcable.uk/cables",
-  "dateModified": "2026-09-10T18:06:20.000Z",
+  "dateModified": "2026-09-22T22:35:17.000Z",
   "keywords": [
     "USB-C", "USB4", "Thunderbolt", "Thunderbolt 5", "e-marker",
     "USB Power Delivery", "USB-C cable database", "cable VDO", "USB-IF VID"
@@ -490,12 +490,12 @@
 </script>
 
 <main class="cables-page" data-catalog>
-  <header class="catalog-heading"><div><span class="catalog-eyebrow">The community cable library</span><h1>Get to know your cable.</h1><p>Find a cable by name or by the identity code shown in WhatCable. Compare its reported data speed and charging rating, then open the details when you need them.</p><p class="catalog-meta">125 entries · Updated 10 September 2026</p></div><a class="catalog-help-link" href="/inside-a-cable"><strong>Same plug. Different insides. →</strong><span>Explore the 3D diagram to see what the wires and identity chip actually do.</span></a></header>
+  <header class="catalog-heading"><div><span class="catalog-eyebrow">The community cable library</span><h1>Get to know your cable.</h1><p>Find a cable by name or by the identity code shown in WhatCable. Compare its reported data speed and charging rating, then open the details when you need them.</p><p class="catalog-meta">142 entries · Updated 22 September 2026</p></div><a class="catalog-help-link" href="/inside-a-cable"><strong>Same plug. Different insides. →</strong><span>Explore the 3D diagram to see what the wires and identity chip actually do.</span></a></header>
   <section aria-label="Search and filter cables" class="catalog-controls" id="catalog-controls" hidden>
     <div class="catalog-search-row"><label for="catalog-search">Find a cable<input id="catalog-search" type="search" placeholder="Try Apple, CalDigit, 0x05AC or a report number" autocomplete="off"></label><button type="button" id="catalog-clear" disabled>Reset filters</button></div>
     <div class="catalog-filters"><label for="catalog-speed">Reported data speed<select id="catalog-speed"><option value="">All speeds</option><option value="480 Mbps">480 Mbps</option><option value="10 Gbps">10 Gbps</option><option value="5 Gbps">5 Gbps</option><option value="40 Gbps">40 Gbps</option><option value="80 Gbps">80 Gbps</option><option value="20 / 40 Gbps">20 / 40 Gbps</option></select></label><label for="catalog-power">Reported charging rating<select id="catalog-power"><option value="">All ratings</option><option value="~60 W">~60 W</option><option value="60 W">60 W</option><option value="100 W">100 W</option><option value="~100 W">~100 W</option><option value="144 W">144 W</option><option value="150 W">150 W</option><option value="240 W">240 W</option></select></label><label for="catalog-sort">Sort results<select id="catalog-sort"><option value="name">Cable name · A–Z</option><option value="speed">Highest reported speed</option><option value="power">Highest reported power</option></select></label></div>
   </section>
-  <div class="catalog-results-bar"><p id="catalog-count" role="status" aria-live="polite">125 entries</p><a href="#reading-reports">Reported ratings, not performance tests ↓</a></div>
+  <div class="catalog-results-bar"><p id="catalog-count" role="status" aria-live="polite">142 entries</p><a href="#reading-reports">Reported ratings, not performance tests ↓</a></div>
   <noscript><p>All entries are shown below. Use your browser’s Find command to search; each entry’s details still open without JavaScript.</p></noscript>
   <div class="catalog-column-head" aria-hidden="true"><span>Cable / report description</span><span>Reported speed</sp
```

**File**: `docs/cables.json` (modified, +244/-6)
```diff
@@ -168,7 +168,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "UGreen Revodok 9-in-1 USB-C hub cable, Amazon France",
+    "brand" : "UGreen USB-C hub bundled cable: Revodok 9-in-1 (Amazon France) and CM818-45363 (JD.com)",
     "cableVDO" : "0x00084841",
     "issueNum" : "#126",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/126",
@@ -238,7 +238,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "UGREEN L705 USB4 \/ TB4-class cable, Amazon (VID\/PID zeroed)",
+    "brand" : "UGREEN L705 USB4 \/ TB4-class cable (part 65175), Amazon (VID\/PID zeroed)",
     "cableVDO" : "0x000A2643",
     "issueNum" : "#359",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/359",
@@ -308,7 +308,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "Maxonar TH33 TB4 cable, Amazon",
+    "brand" : "Maxonar TH33 TB4 cable, Amazon; also MOVE SPEED (移速), Pinduoduo",
     "cableVDO" : "0x000A4643",
     "issueNum" : "#219",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/219",
@@ -322,7 +322,7 @@
     "xid" : "none"
   },
   {
-    "brand" : "Unbranded TB5-class 80 Gbps, zeroed e-marker",
+    "brand" : "Unbranded TB5-class 80 Gbps, zeroed e-marker (one reported as a Kickstarter cable)",
     "cableVDO" : "0x000A4644",
     "issueNum" : "#309",
     "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/309",
@@ -335,6 +335,20 @@
     "vid" : "0x0000",
     "xid" : "none"
   },
+  {
+    "brand" : "Unbranded Amazon cable marked 20 Gbps (claims EPR, 20 V max VBUS)",
+    "cableVDO" : "0x000A6042",
+    "issueNum" : "#601",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/601",
+    "pid" : "0x0000",
+    "power" : "5 A \/ 20 V (100 W)",
+    "registered" : false,
+    "speed" : "USB 3.2 Gen 2 (10 Gbps)",
+    "type" : "passive",
+    "vendor" : "(zeroed)",
+    "vid" : "0x0000",
+    "xid" : "none"
+  },
   {
     "brand" : "vorodcip generic USB-C cable, Amazon Japan (VID\/PID zeroed)",
     "cableVDO" : "0x000A6642",
@@ -363,6 +377,34 @@
     "vid" : "0x0000",
     "xid" : "none"
   },
+  {
+    "brand" : "Eudobel TB4-branded USB4 cable 1 m, Amazon (VID\/PID zeroed)",
+    "cableVDO" : "0x000A6643",
+    "issueNum" : "#589",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/589",
+    "pid" : "0x0000",
+    "power" : "5 A \/ 50 V (240 W)",
+    "registered" : false,
+    "speed" : "USB4 Gen 3 (40 Gbps, Thunderbolt 4 class)",
+    "type" : "passive",
+    "vendor" : "(zeroed)",
+    "vid" : "0x0000",
+    "xid" : "none"
+  },
+  {
+    "brand" : "LTT TrueSpec USB-C cable, marked 20 Gbps (e-marker has no 20 Gbps code, reads Gen 2)",
+    "cableVDO" : "0x110A6E42",
+    "issueNum" : "#470",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/470",
+    "pid" : "0x0000",
+    "power" : "5 A \/ 50 V (240 W)",
+    "registered" : false,
+    "speed" : "USB 3.2 Gen 2 (10 Gbps)",
+    "type" : "passive",
+    "vendor" : "(zeroed)",
+    "vid" : "0x0000",
+    "xid" : "none"
+  },
   {
     "brand" : "MediaStorm (YingShi JuFeng) TB5 cable, Taobao",
     "cableVDO" : "0x000A4644",
@@ -755,6 +797,20 @@
     "vid" : "0x05AC",
     "xid" : "0x2600"
   },
+  {
+    "brand" : "Apple Thunderbolt 4 Pro cable 1.8 m, reporter-identified (second PID alongside `0x7205`)",
+    "cableVDO" : "0x4368F8DB",
+    "issueNum" : "#534",
+    "issueURL" : "https:\/\/github.com\/darrylmorley\/whatcable\/issues\/534",
+    "pid" : "0x7209",
+    "power" : "5 A \/ 20 V (100 W)",
+    "registered" : true,
+    "speed" : "USB4 Gen 3 (40 Gbps, Thunderbolt 4 class)",
+    "type" : "active",
+    "vendor" : "Apple",
+    "vid" : "0x05AC",
+    "xid" : "none"
+  },
   {
     "brand" : "Apple Thunderbolt 5 cable 1 m (model A3189)",
     "cableVDO" : "0x110A2644",
@@ -895,6 +951,20 @@
     "vid" : "0x201C",
     "xid" : "0xBBB"
   },
+  {
+    "brand" : "OM System camera bundled USB-C cable",
+    "cableVDO" : "0x00082052",
+   
```

**File**: `docs/index.html` (modified, +1/-1)
```diff
@@ -1214,7 +1214,7 @@ <h2>Claims are useful. Observed behaviour is better.</h2>
         <p>Contributed observations build a public record of how real cables identify themselves across real hardware.</p>
       </div>
       <div class="corpus-card">
-        <span class="corpus-number">125</span>
+        <span class="corpus-number">142</span>
         <span class="corpus-label">cable observations in the public database</span>
         <div class="corpus-facts">
           <span>Reported through WhatCable</span>
```

**File**: `src/_data/cablesmeta.json` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 {
-  "updated" : "2026-09-10T18:06:20Z"
+  "updated" : "2026-09-22T23:35:17+01:00"
 }
```

---

### Incident Patch 2: `b5b28199` (2026-09-23)
**Commit Message**: Mirror from private (b4dfb15a)

**File**: `Tests/WhatCableCoreTests/CableCertLookupTests.swift` (modified, +33/-3)
```diff
@@ -41,9 +41,39 @@ struct CableCertLookupTests {
 
     @Test("The database loaded a substantial cert set")
     func certSetLoaded() {
-        // ~1,090 XIDs at build time. A large floor catches a DB that shipped
-        // without the cable_certs table (which fails soft to zero).
-        #expect(CableDB.certXIDCount >= 800)
+        // 1,124 distinct XIDs in the db committed on this branch; a fresh
+        // rebuild on 2026-09-23 produced 1,129. The floor was 800, which was useless: on
+        // 2026-09-22 the USB-IF bulk feed stopped listing StarTech and ON
+        // Semiconductor, a clean rebuild dropped 87 XIDs, and the 1,042 left
+        // is still comfortably over 800, so this test stayed green through
+        // the whole incident. 1,100 fails on that loss while leaving room for
+        // ordinary registry churn before it cries wolf. Same idea as
+        // corpusCoverageIsMeaningful below: put the floor above the broken
+        // state, not just above zero.
+        #expect(CableDB.certXIDCount >= 1100)
+    }
+
+    // Two of the 87 XIDs recovered by data/cert-xids.tsv, one per affected
+    // vendor. The count floor above catches a mass loss; these catch a
+    // narrower one, e.g. the seed file being dropped, renamed, or read as
+    // empty because a single byte in it stopped being valid UTF-8. Both are
+    // absent from the USB-IF bulk catalogue and resolve only because the
+    // build seeds them, so either one going empty means the seed path broke.
+    private static let starTechSeededXID: UInt32 = 0x0000_1C46
+    private static let onSemiSeededXID: UInt32 = 0x0000_17AE
+
+    @Test("A seeded StarTech XID the bulk catalogue no longer lists still resolves")
+    func seededStarTechXIDResolves() {
+        let certs = CableDB.certifications(forXID: Self.starTechSeededXID)
+        #expect(!certs.isEmpty)
+        #expect(certs.contains { $0.company == "StarTech.com Ltd." })
+    }
+
+    @Test("A seeded ON Semiconductor XID the bulk catalogue no longer lists still resolves")
+    func seededOnSemiXIDResolves() {
+        let certs = CableDB.certifications(forXID: Self.onSemiSeededXID)
+        #expect(!certs.isEmpty)
+        #expect(certs.contains { $0.company == "ON Semiconductor" })
     }
 
     @Test("A certified cable resolves, with its listings and vendor id")
```

**File**: `data/cert-xids.tsv` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+# Certification IDs to always resolve.
+#
+# The build works out which USB-IF certification IDs to look up from three
+# places: the USB-IF bulk catalogue, the cert IDs on our own cable rows, and
+# the probe corpus. None of those is complete. The bulk feed in particular
+# carries whole vendors one month and not the next, and the per-XID endpoint
+# still answers for IDs the feed has stopped listing.
+#
+# Without this file those listings vanish from whatcable.db on the next clean
+# rebuild, silently, because the build simply never asks about them. That
+# happened on 2026-09-22: 87 IDs, 92 listings, every one still live at USB-IF.
+#
+# Format, three tab-separated fields, all three required:
+#   1. certification ID (hex, 0x prefix optional)
+#   2. certification date, as "2019-01-25T00:00:00", or empty
+#   3. a note for humans; not used by the build
+#
+# The date is here because the per-XID endpoint does not return one. The date
+# only ever came from a bulk-catalogue row, and these IDs are exactly the ones
+# the bulk feed has stopped listing, so without it the recovered listings come
+# back dateless. The build uses it only when the bulk feed offers nothing for
+# that ID: a date the catalogue does supply always wins.
+#
+# An empty date field is valid and means USB-IF publishes no date for that ID.
+# Five of the entries below are like that. Leave them empty; never invent one.
+#
+# A line with any other number of fields is skipped with a warning.
+#
+# Same idea as data/manual-vendors.tsv: a tracked input for what the
+# automated sources miss, so a clean rebuild stays reproducible.
+0x17AE	2019-01-25T00:00:00	ON Semiconductor: FUSB380
+0x17BC	2019-08-26T00:00:00	ON Semiconductor: FUSB380C
+0x17BD	2022-09-01T00:00:00	ON Semiconductor: FUSB15201DV
+0x17C0	2023-06-01T00:00:00	ON Semiconductor: FUSB15101
+0x17D0	2024-02-08T00:00:00	ON Semiconductor: FUSB15200
+0x1C46	2017-11-28T00:00:00	StarTech.com Ltd.: USB31CC1M
+0x1C47	2017-11-28T00:00:00	StarTech.com Ltd.: USB31C5C1M
+0x1C48	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C2M
+0x1C49	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C50CM
+0x1C4A	2018-03-09T00:00:00	StarTech.com Ltd.: PN:USB2C5C1M
+0x1C4B	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C3M
+0x1C4C	2018-03-09T00:00:00	StarTech.com Ltd.: USB2C5C2MW
+0x1C4D	2018-03-15T00:00:00	StarTech.com Ltd.: USB315C5C6
+0x1C4E	2018-06-13T00:00:00	StarTech.com Ltd.: USB2C5C4MW
+0x1C4F	2019-12-09T00:00:00	StarTech.com Ltd.: DCH1C3A
+0x1C50	2019-12-10T00:00:00	StarTech.com Ltd.: WCH1C602
+0x1C51	2022-06-27T00:00:00	StarTech.com Ltd.: CC1M-40G-USB-CABLE
+0x1C52	2024-02-08T00:00:00	StarTech.com Ltd.: 1M-40G-USB4-CABLE
+0x1C53		StarTech.com Ltd.: 50C-40G-USB4-CABLE, USB2EPR1M
+0x1C54	2023-10-17T00:00:00	StarTech.com Ltd.: USB2EPR2M
+0x1C55	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR3M
+0x1C56	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR4M
+0x1C57	2023-12-15T00:00:00	StarTech.com Ltd.: USB2EPR3F
+0x1C58	2023-12-15T00:00:00	StarTech.com Ltd.: USB2EPR6F
+0x2A89		ON Semiconductor: 35468851, FUSB15201
+0x33F1	2025-11-11T00:00:00	StarTech.com Ltd.: CC3M20GUSB4CX
+0x33F2	2025-12-16T00:00:00	StarTech.com Ltd.: CC3M20GUSB4CXW
+0x33F3	2025-12-15T00:00:00	StarTech.com Ltd.: CC10FT20GUSB4CX
+0x33F4	2026-01-20T00:00:00	StarTech.com Ltd.: CC10FT20GUSB4CXW
+0x33F5	2025-11-11T00:00:00	StarTech.com Ltd.: S2CEPR3FW-USB-CABLE
+0x33F6	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR10F
+0x33F7	2023-12-21T00:00:00	StarTech.com Ltd.: USB2EPR13F
+0x33F8	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR3FW
+0x33F9	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR1MW
+0x33FA	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR6FW
+0x33FB	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR2MW
+0x33FC	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR10FW
+0x33FD	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR3MW
+0x33FE	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR13FW
+0x33FF	2024-03-25T00:00:00	StarTech.com Ltd.: USB2EPR4MW
+0x3400		StarTech.com Ltd.: 1
```

**File**: `scripts/build-cable-db.swift` (modified, +557/-44)
```diff
@@ -17,10 +17,24 @@
 //   --refresh-certs   refetch every USB-IF per-XID record instead of reusing
 //                     the .cert-cache (picks up cables that changed, e.g.
 //                     Pass -> Obsolete, or gained listings).
-//   --test-parser     run the manual-vendors parser self-tests and exit.
+//   --test-parser     run the parser self-tests (manual vendors, contact-email
+//                     stripping, known cables, cert-xids.tsv, the seeded
+//                     cert-date fallback and per-XID response validation)
+//                     and exit.
 // Env:
 //   ALLOW_EMPTY_CERTS=1   permit a build with zero certifications (otherwise a
 //                         collapsed cert table fails the build; see below).
+//                         Also overrides a failed per-XID certification fetch
+//                         (exit 6): with this set, a failed fetch is a
+//                         warning, not a build failure.
+//   WC_FAIL_CERT_FETCH    test hook: comma-separated XIDs, decimal or hex
+//                         with a 0x prefix (e.g. 7238 or 0x1C46). Forces
+//                         fetchPerXIDListings to fail (return nil) for those
+//                         XIDs, before it checks the cache, no network
+//                         involved. Lets the exit(6) failed-build path be
+//                         exercised in a real build. Does nothing when unset
+//                         or empty. A token it cannot parse is reported on
+//                         stderr and ignored; empty tokens are ignored.
 //
 // Requires: macOS (uses system SQLite3 via libsqlite3).
 
@@ -32,6 +46,7 @@ import SQLite3
 let repoRoot = FileManager.default.currentDirectoryPath
 let vendorTSV = "\(repoRoot)/Sources/WhatCableCore/Resources/usbif-vendors.tsv"
 let manualVendorTSV = "\(repoRoot)/data/manual-vendors.tsv"
+let certXIDsTSV = "\(repoRoot)/data/cert-xids.tsv"
 let dbOutput = "\(repoRoot)/Sources/WhatCableCore/Resources/whatcable.db"
 let dbWebCopy = "\(repoRoot)/docs/whatcable.db"
 let cablesJSON = "\(repoRoot)/docs/cables.json"
@@ -55,6 +70,35 @@ let certCacheDir = "\(repoRoot)/.cert-cache"
 // reused indefinitely. A successful refetch overwrites its cache entry.
 let refreshCerts = CommandLine.arguments.contains("--refresh-certs")
 
+// Test hook (see WC_FAIL_CERT_FETCH in the header comment): forces
+// fetchPerXIDListings to fail for these XIDs, so the exit(6) failed-build
+// path can be watched firing in a real build without a network fetch and
+// without waiting for a cold per-XID crawl. Empty when unset, which does
+// nothing.
+// Tokens may be decimal or 0x-prefixed hex, because XIDs are written in hex
+// everywhere else and a silently dropped `0x1C46` would make the guard look
+// broken. A token that parses as neither gets a stderr warning.
+let forcedCertFetchFailures: Set<Int> = {
+    var out: Set<Int> = []
+    let raw = ProcessInfo.processInfo.environment["WC_FAIL_CERT_FETCH"] ?? ""
+    for piece in raw.split(separator: ",") {
+        let token = piece.trimmingCharacters(in: .whitespaces)
+        if token.isEmpty { continue }
+        let value: Int?
+        if token.hasPrefix("0x") || token.hasPrefix("0X") {
+            value = Int(token.dropFirst(2), radix: 16)
+        } else {
+            value = Int(token)
+        }
+        if let value {
+            out.insert(value)
+        } else {
+            fputs("warn: WC_FAIL_CERT_FETCH: cannot parse XID token '\(token)', ignoring it\n", stderr)
+        }
+    }
+    return out
+}()
+
 // MARK: - SQLite helpers
 
 var db: OpaquePointer?
@@ -418,6 +462,108 @@ func importManualVendors() -> (inserted: Int, skipped: Int) {
     return (inserted, skipped)
 }
 
+// MARK: - Manual certification-ID seed (data/cert-xids.tsv)
+
+struct ManualCertXID: Equatable {
+    let xid: Int
+    /// Certification date for this XID, in the same format the cable_certs
+    /// column holds ("2019-01-25T00:00:00"), or "" when USB-IF never
+    /// pub
```

---

### Incident Patch 3: `2348b90a` (2026-09-22)
**Commit Message**: Mirror from private (c4d0ae1c)

**File**: `Sources/WhatCableCore/Output/PortSummary.swift` (modified, +15/-3)
```diff
@@ -916,12 +916,24 @@ extension PortSummary {
                 : String(localized: "Carrying both data and DisplayPort video.", bundle: _coreLocalizedBundle)
         } else if hasDP {
             self.status = .displayCable
+            // A port can carry a working display while macOS withholds its data
+            // transports. Before this branch consulted `dataWithheld` the card
+            // said only "Display connected", so the one fact the user cannot see
+            // for themselves, that their accessory is waiting for approval, was
+            // never stated (#681, m4pro_macos26.6.2_m port 1). The branch above
+            // already handles the same pair; this mirrors it.
             if let w = chargerW {
-                self.headline = String(localized: "Display connected · \(w)W charger", bundle: _coreLocalizedBundle) + cableLimitSuffix
+                self.headline = (dataWithheld
+                    ? String(localized: "Display connected, data blocked · \(w)W charger", bundle: _coreLocalizedBundle)
+                    : String(localized: "Display connected · \(w)W charger", bundle: _coreLocalizedBundle)) + cableLimitSuffix
             } else {
-                self.headline = String(localized: "Display connected", bundle: _coreLocalizedBundle) + cableLimitSuffix
+                self.headline = (dataWithheld
+                    ? String(localized: "Display connected, data blocked", bundle: _coreLocalizedBundle)
+                    : String(localized: "Display connected", bundle: _coreLocalizedBundle)) + cableLimitSuffix
             }
-            self.subtitle = String(localized: "DisplayPort video over USB-C Alt Mode.", bundle: _coreLocalizedBundle)
+            self.subtitle = dataWithheld
+                ? String(localized: "Video is working. macOS is holding data back until you approve the accessory.", bundle: _coreLocalizedBundle)
+                : String(localized: "DisplayPort video over USB-C Alt Mode.", bundle: _coreLocalizedBundle)
         } else if hasCorroboratedUSB3 {
             self.status = .dataDevice
             if let w = chargerW {
```

**File**: `Sources/WhatCableCore/Resources/de.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Aktuelle Aushandlung: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Display verbunden";
 "Display connected · %lldW charger" = "Display verbunden · %lld-W-Ladegerät";
+"Display connected, data blocked" = "Display verbunden, Daten blockiert";
+"Display connected, data blocked · %lldW charger" = "Display verbunden, Daten blockiert · %lld-W-Ladegerät";
 "DisplayPort video over USB-C Alt Mode." = "DisplayPort-Video über USB-C-Alt-Mode.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "e-Marker meldet EPR-Unterstützung, aber nur max. 20 V VBUS";
 "E-marker reports no vendor identity" = "e-Marker meldet keine Herstelleridentität";
```

**File**: `Sources/WhatCableCore/Resources/en.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Currently negotiated: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Display connected";
 "Display connected · %lldW charger" = "Display connected · %lldW charger";
+"Display connected, data blocked" = "Display connected, data blocked";
+"Display connected, data blocked · %lldW charger" = "Display connected, data blocked · %lldW charger";
 "DisplayPort video over USB-C Alt Mode." = "DisplayPort video over USB-C Alt Mode.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "E-marker claims EPR support but reports only 20V max VBUS";
 "E-marker reports no vendor identity" = "E-marker reports no vendor identity";
```

**File**: `Sources/WhatCableCore/Resources/es.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Negociación actual: %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Pantalla conectada";
 "Display connected · %lldW charger" = "Pantalla conectada · cargador de %lld W";
+"Display connected, data blocked" = "Pantalla conectada, datos bloqueados";
+"Display connected, data blocked · %lldW charger" = "Pantalla conectada, datos bloqueados · cargador de %lld W";
 "DisplayPort video over USB-C Alt Mode." = "Vídeo DisplayPort a través de modo alternativo USB-C.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "El e-marker anuncia soporte EPR pero reporta solo 20 V máx. VBUS";
 "E-marker reports no vendor identity" = "El e-marker no reporta identidad de fabricante";
```

**File**: `Sources/WhatCableCore/Resources/fr.lproj/Localizable.strings` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@
 "Currently negotiated: %@ @ %@ (%@)" = "Négociation actuelle : %1$@ @ %2$@ (%3$@)";
 "Display connected" = "Écran connecté";
 "Display connected · %lldW charger" = "Écran connecté · chargeur %lld W";
+"Display connected, data blocked" = "Écran connecté, données bloquées";
+"Display connected, data blocked · %lldW charger" = "Écran connecté, données bloquées · chargeur %lld W";
 "DisplayPort video over USB-C Alt Mode." = "Vidéo DisplayPort en mode alternatif USB-C.";
 "E-marker claims EPR support but reports only 20V max VBUS" = "L'e-marker annonce le support EPR mais ne signale que 20 V max VBUS";
 "E-marker reports no vendor identity" = "L'e-marker ne signale aucune identité fabricant";
```

---

### Incident Patch 4: `85871067` (2026-09-22)
**Commit Message**: Mirror from private (5fe6613f)

**File**: `README.md` (modified, +4/-0)
```diff
@@ -310,6 +310,10 @@ More device data means better hardware coverage, fewer edge-case bugs, and more
 
 Cable reports are also very welcome. If you have an e-marked cable, use the "Report this cable" button in the app (or `whatcable --report` from the CLI) to submit its fingerprint. These reports build the bundled cable database so WhatCable can show brand and model info for known cables. Every report you submit helps other users identify their cables at a glance.
 
+### Research references
+
+Some comments and docs cite files under `research/` (for example `research/displays/display-node-keys.md`). That folder is my private research library, built from raw diagnostic dumps off real machines, and it is not part of this repo. The references stay so each decision names its evidence, even where you cannot open it.
+
 ## Credits
 
 Built by [Darryl Morley](https://github.com/darrylmorley).
```

---

### Incident Patch 5: `ba1728ff` (2026-09-22)
**Commit Message**: Mirror from private (bcf336a7)

**File**: `Sources/WhatCableCore/Resources/lv.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -407,7 +407,7 @@
 "No problems seen while watching this cable." = "Vērojot šo kabeli, problēmas netika konstatētas.";
 "Saw a brief drop or a single high reading. Not conclusive; still watching." = "Konstatēts īslaicīgs kritums vai atsevišķs augsts rādījums. Secinājums nav viennozīmīgs; novērošana turpinās.";
 "Not performing as expected" = "Nedarbojas, kā paredzēts";
-"Isn't performing as expected" = "nedarbojas, kā paredzēts";
+"Isn't performing as expected" = "Nedarbojas, kā paredzēts";
 
 /* Power Monitor system power source indicator. */
 "Battery" = "Akumulators";
```

**File**: `scripts/check-localisation.py` (modified, +4/-10)
```diff
@@ -414,15 +414,10 @@
             "USB4 Gen 4 (80 Gbps)", "Variable, %@ to %@ @ %@", "WhatCable Pro",
         },
         "lv": {
-            "%lld displays connected", "%lld × %lld", "1-5 mW", "3 A", "5 A", "5-10 mW",
-            "50-200 µW", "< 50 µW", "> 10 mW", "Battery full, not drawing power",
-            "Built-in %1$@ port %2$lld",
-            "High-resolution displays often use compression (DSC) to fit their top mode through a link like this, so selecting the higher mode in Display settings may reach it normally.",
-            "CC Advertisement", "Isn't performing as expected", "Licence…", "MagSafe 3",
+            "%lld × %lld", "1-5 mW", "3 A", "5 A", "5-10 mW",
+            "50-200 µW", "< 50 µW", "> 10 mW",
+            "CC Advertisement", "Licence…", "MagSafe 3",
             "Raw VDOs", "Raw cable VDOs", "Re-driver", "Re-timer",
-            "No problems seen while watching this cable.", "Not performing as expected",
-            "Performing as expected",
-            "Saw a brief drop or a single high reading. Not conclusive; still watching.",
             "Thunderbolt", "Thunderbolt / USB4", "USB 2.0 (480 Mbps)",
             "USB 3.2 Gen 1 (5 Gbps)", "USB 3.2 Gen 2 (10 Gbps)", "USB4 Gen 3 (20 / 40 Gbps)",
             "USB4 Gen 4 (80 Gbps)", "Video", "WhatCable Pro", "video",
@@ -603,8 +598,7 @@
             "Gen 1", "Pro", "SuperSpeed", "USB",
         },
         "lv": {
-            "%lld displays connected", "Built-in %1$@ port %2$lld", "Display connected", "Pro",
-            "SuperSpeed", "USB",
+            "Pro", "SuperSpeed", "USB",
         },
         "nb": {
             "%lld displays connected", "Built-in %1$@ port %2$lld", "Display connected",
```

---

### Incident Patch 6: `5da540f0` (2026-09-22)
**Commit Message**: Update Latvian (lv) translation (#614)

* Update Latvian (lv) translation

- Translate the remaining untranslated strings (session monitor
  verdicts, display diagnostics, built-in display port card)
- Terminology and grammar fixes: power consistently "jauda" (not
  "strāva"), "konstatēti" for detected, lanes unified to "joslas",
  correct plural and verb forms, formal "jūs" register throughout
- Keep spec-searchable terms in English per TRANSLATIONS.md:
  e-marker, CC Advertisement, Raw VDOs
- Keys and format specifiers unchanged vs en.lproj

Co-Authored-By: Claude Code <noreply@anthropic.com>

* Address CodeRabbit review comments on Latvian translation

- Keep the technical label e-marker literal in cable-history identity
  strings (TRANSLATIONS.md requires it to stay in English)
- Unify the System Power Input label as „Sistēmas jaudas ievade“ across
  all five references (title, chart note, two port-card notes, PD note)
- Complete the session-monitor sentence (Secinājums nav viennozīmīgs)
- Fix the no-negotiated-rate message: „par“ construction and meaning
  "while connected" rather than "during the act of connecting"
- Describe 5 A as current, not power (ar 5 A nominālo strāvu)

**File**: `Sources/WhatCable/Resources/lv.lproj/Localizable.strings` (modified, +35/-35)
```diff
@@ -1,6 +1,6 @@
 "%@ profiles" = "%@ profili";
-"%lld USB-C ports and 1 MagSafe port detected, but nothing is currently plugged in. Turn off \"Hide empty ports\" in Settings to see them." = "%lld USB-C porti un 1 MagSafe ports atklāti, bet nekas nav pievienots. Izslēdziet \"Slēpt tukšos portus\" iestatījumos, lai tos redzētu.";
-"%lld USB-C ports detected, but nothing is currently plugged in. Turn off \"Hide empty ports\" in Settings to see them." = "%lld USB-C porti atklāti, bet nekas nav pievienots. Izslēdziet \"Slēpt tukšos portus\" iestatījumos, lai tos redzētu.";
+"%lld USB-C ports and 1 MagSafe port detected, but nothing is currently plugged in. Turn off \"Hide empty ports\" in Settings to see them." = "%lld USB-C porti un 1 MagSafe ports konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.";
+"%lld USB-C ports detected, but nothing is currently plugged in. Turn off \"Hide empty ports\" in Settings to see them." = "%lld USB-C porti konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.";
 "About %@" = "Par %@";
 "Active" = "Aktīvs";
 "Active cable electronics" = "Aktīva kabeļa elektronika";
@@ -13,43 +13,43 @@
 "Connected devices" = "Pievienotās ierīces";
 "Connection" = "Savienojums";
 "Display" = "Displejs";
-"Desktop Mac: charger identity (FedDetails) is not available." = "Galda Mac: lādētāja identitāte (FedDetails) nav pieejama.";
+"Desktop Mac: charger identity (FedDetails) is not available." = "Stacionārais Mac: lādētāja identitāte (FedDetails) nav pieejama.";
 "Done" = "Gatavs";
-"Downloading…" = "Lejupielādē…";
+"Downloading…" = "Notiek lejupielāde…";
 "Newer version found, installing it…" = "Atrasta jaunāka versija, notiek instalēšana…";
-"Checking for the latest version…" = "Meklē jaunāko versiju…";
-"File a GitHub issue with this cable's e-marker fingerprint" = "Izveidot GitHub problēmu ar šī kabeļa e-marķiera pirksta nospiedumu";
+"Checking for the latest version…" = "Pārbauda, vai pieejama jaunākā versija…";
+"File a GitHub issue with this cable's e-marker fingerprint" = "Iesniegt GitHub ziņojumu ar šī kabeļa e-marker pirksta nospiedumu";
 "Font size" = "Fonta izmērs";
-"Opacity" = "Necaurspīdīgums";
-"Helps the maintainer reproduce charger / cable behavior tied to specific hardware." = "Palīdz uzturētājam reproducēt lādētāja / kabeļa uzvedību, kas saistīta ar konkrētu aparatūru.";
+"Opacity" = "Necaurredzamība";
+"Helps the maintainer reproduce charger / cable behavior tied to specific hardware." = "Palīdz uzturētājam reproducēt lādētāja / kabeļa darbību, kas saistīta ar konkrētu aparatūru.";
 "Hide empty ports" = "Slēpt tukšos portus";
 "Host (%@)" = "Resursdators (%@)";
 "Include Mac model and macOS version" = "Iekļaut Mac modeli un macOS versiju";
 "Install failed: %@" = "Instalācija neizdevās: %@";
 "This account can't update apps in this location. Download the new version from whatcable.uk, or update with Homebrew." = "Šis konts nevar atjaunināt lietotnes šajā vietā. Lejupielādējiet jauno versiju no whatcable.uk vai atjauniniet ar Homebrew.";
 "WhatCable can't update itself from its current folder. Move WhatCable into your Applications folder, relaunch it, and try again, or download the latest version from whatcable.uk." = "WhatCable nevar atjaunināties no tā pašreizējās mapes. Pārvietojiet WhatCable uz mapi Programmas, palaidiet to no jauna un mēģiniet vēlreiz, vai lejupielādējiet jaunāko versiju no whatcable.uk.";
 "Install update" = "Instalēt atjauninājumu";
-"Installing, WhatCable will relaunch" = "Instalē, WhatCable tiks palaists no jauna";
+"Installing, WhatCable will relaunch" = "Notiek instalēšana, WhatCable tiks palaists no jauna";
 "Keep window open" = "Turēt logu atvērtu";
 "Language" = "Valoda";
-"Launch at login" = "Palaist piesakoties";
-"Lives in the menu bar with no Dock icon." = "Atrodas izvēlņu joslā bez Dock ikonas.";
-"Menu bar icon" = "Izvēlņu joslas ikona";
-"Show charging watts in the 
```

**File**: `Sources/WhatCable/Resources/lv.lproj/Localizable.stringsdict` (modified, +54/-0)
```diff
@@ -38,5 +38,59 @@
 			<string>Rādīt %lld centrmezglu</string>
 		</dict>
 	</dict>
+	<key>%lld displays connected</key>
+	<dict>
+		<key>NSStringLocalizedFormatKey</key>
+		<string>%#@count@</string>
+		<key>count</key>
+		<dict>
+			<key>NSStringFormatSpecTypeKey</key>
+			<string>NSStringPluralRuleType</string>
+			<key>NSStringFormatValueTypeKey</key>
+			<string>lld</string>
+			<key>one</key>
+			<string>%lld displejs pievienots</string>
+			<key>other</key>
+			<string>%lld displeji pievienoti</string>
+			<key>zero</key>
+			<string>%lld displeju pievienoti</string>
+		</dict>
+	</dict>
+	<key>%lld USB-C ports and 1 MagSafe port detected, but nothing is currently plugged in. Turn off &quot;Hide empty ports&quot; in Settings to see them.</key>
+	<dict>
+		<key>NSStringLocalizedFormatKey</key>
+		<string>%#@count@</string>
+		<key>count</key>
+		<dict>
+			<key>NSStringFormatSpecTypeKey</key>
+			<string>NSStringPluralRuleType</string>
+			<key>NSStringFormatValueTypeKey</key>
+			<string>lld</string>
+			<key>one</key>
+			<string>%lld USB-C ports un 1 MagSafe ports konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.</string>
+			<key>other</key>
+			<string>%lld USB-C porti un 1 MagSafe ports konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.</string>
+			<key>zero</key>
+			<string>%lld USB-C portu un 1 MagSafe ports konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.</string>
+		</dict>
+	</dict>
+	<key>%lld USB-C ports detected, but nothing is currently plugged in. Turn off &quot;Hide empty ports&quot; in Settings to see them.</key>
+	<dict>
+		<key>NSStringLocalizedFormatKey</key>
+		<string>%#@count@</string>
+		<key>count</key>
+		<dict>
+			<key>NSStringFormatSpecTypeKey</key>
+			<string>NSStringPluralRuleType</string>
+			<key>NSStringFormatValueTypeKey</key>
+			<string>lld</string>
+			<key>one</key>
+			<string>%lld USB-C ports konstatēts, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.</string>
+			<key>other</key>
+			<string>%lld USB-C porti konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.</string>
+			<key>zero</key>
+			<string>%lld USB-C portu konstatēti, bet nekas nav pievienots. Izslēdziet „Slēpt tukšos portus“ iestatījumos, lai tos redzētu.</string>
+		</dict>
+	</dict>
 </dict>
 </plist>
```

**File**: `Sources/WhatCableCore/Resources/lv.lproj/Localizable.strings` (modified, +79/-79)
```diff
@@ -13,12 +13,12 @@
 "Active cable (VDO 2):" = "Aktīvs kabelis (VDO 2):";
 "Alternate Mode Adapter" = "Alternatīvā režīma adapteris";
 "Both the charger and cable can do more, but the Mac is currently asking for less. This is normal once the battery is mostly full, or when the system is idle." = "Gan lādētājs, gan kabelis spēj vairāk, bet Mac pašlaik pieprasa mazāk. Tas ir normāli, kad akumulators ir gandrīz pilns vai sistēma ir dīkstāvē.";
-"Cable does not advertise an e-marker (basic cable)" = "Kabelim nav e-marķiera (vienkāršs kabelis)";
+"Cable does not advertise an e-marker (basic cable)" = "Kabelim nav e-marker (vienkāršs kabelis)";
 "Cable is limiting charging speed" = "Kabelis ierobežo uzlādes ātrumu";
 "Cable identified as %@" = "Kabelis identificēts kā %@";
 "This e-marker is used in: %@" = "Šis e-marker tiek izmantots: %@";
 "Cable rated for %@ at up to %lldV (~%lldW)" = "Kabelis novērtēts %1$@ pie sprieguma līdz %2$lld V (~%3$lld W)";
-"Cable rated to %lldV / %@, delivers up to %lldW (USB-PD caps at 48V)" = "Kabelis novērtēts līdz %1$lldV / %2$@, nodrošina līdz %3$lldW (USB-PD ierobežo līdz 48V)";
+"Cable rated to %lldV / %@, delivers up to %lldW (USB-PD caps at 48V)" = "Kabelis novērtēts līdz %1$lld V / %2$@, nodrošina līdz %3$lld W (USB-PD ierobežo līdz 48 V)";
 "Cable speed: %@" = "Kabeļa ātrums: %@";
 "Cable trust signals:" = "Kabeļa uzticamības signāli:";
 "Carrying DisplayPort video" = "Pārraida DisplayPort video";
@@ -48,15 +48,15 @@
 "Display connected" = "Displejs pievienots";
 "Display connected · %lldW charger" = "Displejs pievienots · %lld W lādētājs";
 "DisplayPort video over USB-C Alt Mode." = "DisplayPort video caur USB-C alt režīmu.";
-"E-marker claims EPR support but reports only 20V max VBUS" = "E-marķieris norāda EPR atbalstu, bet ziņo tikai 20 V maks. VBUS";
-"E-marker reports no vendor identity" = "E-marķieris neziņo ražotāja identitāti";
-"E-marker uses a reserved cable-latency value" = "E-marķieris izmanto rezervētu kabeļa latentuma vērtību";
-"E-marker uses a reserved current-rating value" = "E-marķieris izmanto rezervētu strāvas novērtējuma vērtību";
-"E-marker uses a reserved data-speed value" = "E-marķieris izmanto rezervētu datu ātruma vērtību";
-"E-marker uses an invalid VDO version" = "E-marķieris izmanto nederīgu VDO versiju";
-"E-marker uses an invalid cable-termination value" = "E-marķieris izmanto nederīgu kabeļa terminācijas vērtību";
+"E-marker claims EPR support but reports only 20V max VBUS" = "E-marker norāda EPR atbalstu, bet ziņo tikai 20 V maks. VBUS";
+"E-marker reports no vendor identity" = "E-marker neziņo ražotāja identitāti";
+"E-marker uses a reserved cable-latency value" = "E-marker izmanto rezervētu kabeļa latentuma vērtību";
+"E-marker uses a reserved current-rating value" = "E-marker izmanto rezervētu strāvas novērtējuma vērtību";
+"E-marker uses a reserved data-speed value" = "E-marker izmanto rezervētu datu ātruma vērtību";
+"E-marker uses an invalid VDO version" = "E-marker izmanto nederīgu VDO versiju";
+"E-marker uses an invalid cable-termination value" = "E-marker izmanto nederīgu kabeļa terminācijas vērtību";
 "Last leg drops from %@ to %@" = "Pēdējais posms samazinās no %1$@ uz %2$@";
-"This cable's e-marker doesn't report a vendor ID, which is common on genuine cables. It's only worth a closer look if the cable's other capability data is also inconsistent." = "Šī kabeļa e-marker neuzrāda ražotāja ID, kas oriģināliem kabeļiem ir izplatīta parādība. Tuvāk ieskatīties ir vērts tikai tad, ja arī pārējie kabeļa iespēju dati ir pretrunīgi.";
+"This cable's e-marker doesn't report a vendor ID, which is common on genuine cables. It's only worth a closer look if the cable's other capability data is also inconsistent." = "Šī kabeļa e-marker neuzrāda ražotāja ID, kas īstiem kabeļiem ir izplatīta parādība. Tuvāk ieskatīties ir vērts tikai tad, ja arī pārējie kabeļa iespēju dati ir pretrunīgi.";
 "Linked at %@" = "Savienots ar %@";
 "Negotiation hasn't completed yet."
```

**File**: `Sources/WhatCableCore/Resources/lv.lproj/Localizable.stringsdict` (modified, +18/-0)
```diff
@@ -20,5 +20,23 @@
 			<string>caur %lld centrmezglu</string>
 		</dict>
 	</dict>
+	<key>%lld displays connected</key>
+	<dict>
+		<key>NSStringLocalizedFormatKey</key>
+		<string>%#@count@</string>
+		<key>count</key>
+		<dict>
+			<key>NSStringFormatSpecTypeKey</key>
+			<string>NSStringPluralRuleType</string>
+			<key>NSStringFormatValueTypeKey</key>
+			<string>lld</string>
+			<key>one</key>
+			<string>%lld displejs pievienots</string>
+			<key>other</key>
+			<string>%lld displeji pievienoti</string>
+			<key>zero</key>
+			<string>%lld displeju pievienoti</string>
+		</dict>
+	</dict>
 </dict>
 </plist>
```

**File**: `scripts/check-localisation.py` (modified, +8/-1)
```diff
@@ -230,6 +230,12 @@
 # Same idea for a language carrying a key English does not.
 KNOWN_EXTRA = {
     ("WhatCable (app)", "uk", ".stringsdict"): {"%lld displays connected"},
+    ("WhatCable (app)", "lv", ".stringsdict"): {
+        "%lld displays connected",
+        "%lld USB-C ports and 1 MagSafe port detected, but nothing is currently plugged in. Turn off \"Hide empty ports\" in Settings to see them.",
+        "%lld USB-C ports detected, but nothing is currently plugged in. Turn off \"Hide empty ports\" in Settings to see them.",
+    },
+    ("WhatCableCore", "lv", ".stringsdict"): {"%lld displays connected"},
 }
 
 # Values that are byte-identical to English on purpose: loanwords, unit
@@ -412,7 +418,8 @@
             "50-200 µW", "< 50 µW", "> 10 mW", "Battery full, not drawing power",
             "Built-in %1$@ port %2$lld",
             "High-resolution displays often use compression (DSC) to fit their top mode through a link like this, so selecting the higher mode in Display settings may reach it normally.",
-            "Isn't performing as expected", "Licence…", "MagSafe 3",
+            "CC Advertisement", "Isn't performing as expected", "Licence…", "MagSafe 3",
+            "Raw VDOs", "Raw cable VDOs", "Re-driver", "Re-timer",
             "No problems seen while watching this cable.", "Not performing as expected",
             "Performing as expected",
             "Saw a brief drop or a single high reading. Not conclusive; still watching.",
```

#### Recent Merged Pull Requests:
- **PR #620** (2026-09-22): Update Localizable.strings (@bovirus)
- **PR #617** (closed): Update Localizable.strings (@bovirus)
- **PR #614** (2026-09-22): Update Latvian (lv) translation (@shpokas)
- **PR #613** (closed): Update Localizable.strings (@bovirus)
- **PR #612** (2026-09-22): Traditional Chinese language update (@jimmyorz)
- **PR #608** (2026-09-11): Update Localizable.strings (@bovirus)
- **PR #606** (closed): Update Italian language (@bovirus)
- **PR #605** (2026-09-11): Traditional Chinese language update (@jimmyorz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
