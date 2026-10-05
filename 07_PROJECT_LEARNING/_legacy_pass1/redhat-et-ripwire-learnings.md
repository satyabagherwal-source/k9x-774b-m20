# Forensic Learning Record (Deep Inspection): redhat-et/ripwire

> **Canonical Artifact**: `07_PROJECT_LEARNING/redhat-et-ripwire-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/redhat-et/ripwire](https://github.com/redhat-et/ripwire))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:48:46.256Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `redhat-et/ripwire`
- **Description**: The ripgrep of AI context: a zero-dependency C++23 CLI + MCP server for coding agents. Find what you want without reading the repo, then check you built what you meant — blast radius, tests-to-run, quality deltas. Signatures at 74.7% fewer bytes than bodies; every guess labelled, every loss published. Paddle out with a map.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2375 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/agentloop/analyze.py`
```
#!/usr/bin/env python3
# analyze.py — paired per-task/seed analysis for Phase B4 agent-in-the-loop eval results.
#
# WHAT THIS DOES. Consumes the record schema written by run_agentloop.py (SCHEMA
# "ripwire-agentloop-results-v2") and computes paired arm deltas (baseline vs ripwire_cli) per
# (instance_id, seed), then a REPOSITORY-CLUSTERED bootstrap 95% lower bound on the resolved-rate
# delta — because multiple SWE-bench instances from one repo are not independent trials any more than
# multiple LocBench issues from one repo are.
#
# ATTRIBUTION: the clustered-bootstrap approach (resample REPOS with replacement, not individual rows,
# then pool every paired delta belonging to the sampled repos) is adapted from
# bench/locbench/compare_runs.py's `main()` (the repository-clustered paired bootstrap over LocBench
# instances). That file is not imported (its bootstrap is inlined in `main()`, not a reusable function,
# and it is single-purpose for the LocBench JSON shape) and is not modified by this script — this is an
# independent re-implementation of the same statistical method for the agentloop record schema.
#
# SELF-TEST (`--self-test`): builds a tiny synthetic in-memory fixture (a handful of fake repos/
# instances/seeds with a manufactured resolved-rate lift for ripwire_cli) and asserts the pipeline
# produces the expected sign and a positive bootstrap lower bound — proves the math runs correctly
# without needing any real (paid) run data.
#
# USAGE:
#   python3 bench/agentloop/analyze.py --self-test
#   python3 bench/agentloop/analyze.py --results results.json
import argparse, json, math, pathlib, random, statistics, sys

sys.path.insert( 0, str( pathlib.Path( __file__ ).resolve().parent ) )
import select_tasks   # train_contaminated_repos(): the ONE re-derivation of the split contract

SCHEMA = "ripwire-agentloop-results-v3"   # v3: three arms, resolved_model + harness_version fields
ARM_BASELINE, ARM_RIPWIRE = "baseline", "ripwire_cli"

def mean( xs ): return sum( xs ) / len( xs ) if xs else 0.0

def load_results( path ):
    data = json.loads( pathlib.Path( path ).read_text() )
    if data.get( "schema" ) != SCHEMA:
        raise SystemExit( f"{path}: unexpected schema {data.get('schema')!r} (expected {SCHEMA!r}); refusing" )
    # The mirror of run_agentloop.load_tasks_lock()'s contract check, on the OTHER side of the seam,
    # through the SAME imported re-derivation. A results file was necessarily produced against some
    # tasks.lock at run time, but a stale copy of that lock, a hand-edited results file, or records
    # merged in from an older run could still carry a repo that the CURRENT split contract sends to
    # LocBench train — the 2026-08-05 pilot scored pydata__xarray-3364 exactly that way. Every record
    # names its own repo, so this re-derives with no dependency on which lock produced it; fail closed
    # before any statistic is averaged. QUESTIONS-mode results (local scenario trees, whose "repo"
    # names are not SWE-bench repos at all) are the one source the split contract does not apply to —
    # refusing them would break the E1 bank for no hygiene gain.
    if not str( data.get( "tasks_lock_content_sha256", "" ) ).startswith( "questions:" ):
        train_repos = select_tasks.train_contaminated_repos( r["repo"] for r in data.get( "records", () ) )
        if train_repos:
            raise SystemExit(
                f"{path}: records from repo(s) that re-derive to LocBench TRAIN under the current "
                f"split rule, not heldout: {train_repos}. The repo-disjointness contract forbids "
                f"scoring them — refusing (fail-closed). These results were produced against a lock "
                f"that has since gone stale (or never honored the split contract); regenerate "
                f"tasks.lock with select_tasks.py and re-run." )
    return data

def pair_by_task_seed( records ):
    """Group records by (instance_id, seed, arm); return list of (instance_id, repo, seed, base_rec, ctx_rec)
    for pairs where BOTH arms have status=='ok' (a completed run with real metrics). Anything else — a
    stub/not_implemented/errored run, or a one-sided completion — is reported separately, never silently
    dropped into the paired set (that would bias the paired comparison toward whichever arm happened to
    finish more often). resolved=None (--evaluator none) still pairs: that stage's supported claims are
    localization/token/wall, and analyze() reports the resolved stats themselves as n/a."""
    by_key = {}
    for r in records:
        by_key.setdefault( ( r["instance_id"], r["seed"] ), {} )[ r["arm"] ] = r
    paired, incomplete = [], []
    for ( instance_id, seed ), arms in sorted( by_key.items() ):
        base, ctx = arms.get( ARM_BASELINE ), arms.get( ARM_RIPWIRE )
        if base and ctx and base["status"] == "ok" and ctx["status"] == "ok":
            paired.append( ( instance_id, base["repo"], seed, base, ctx ) )
        else:
            incomplete.append( ( instance_id, seed,
                                 base["status"] if base else "missing", ctx["status"] if ctx else "missing" ) )
    return paired, incomplete

def clustered_bootstrap_lower( pairs, value_fn, n_boot, seed_str, alpha=0.025 ):
    """Repository-clustered paired bootstrap (see module docstring / bench/locbench/compare_runs.py
    for the source method): resample REPOS with replacement len(repos) times per bootstrap draw, pool
    every paired value belonging to the sampled repos, take the mean; repeat n_boot times; return the
    alpha-quantile.

    THE DEFAULT IS 97.5%, NOT 95% — corrected 2026-08-10. The 2.5th percentile is the lower edge of a
    TWO-sided 95% interval, which as a one-sided bound is 97.5%. A genuine 95% one-sided bound is the
    5th percentile (alpha=0.05). The behaviour is unchanged and deliberately kept: erring conservative
    is the right direction for an acceptance gate. Only the label was wrong, and a bound that claims
    to be 95% while actually being 97.5% understates the effect this eval can detect by 1.5-4.6pp
    (measured — see power_sim.py). README.md's acceptance criterion is worded in terms of this bound,
    so read it as 97.5% one-sided.

    ALSO WORTH KNOWING BEFORE TRUSTING A NUMBER FROM THIS: with equal paired-row counts per repo — the
    case for every configuration this harness runs — pooling then averaging is algebraically identical
    to resampling the G repo-level MEAN deltas themselves. The entire bootstrap distribution is a
    resample of G numbers, and G is the locked repo count — 8 at the current tasks.lock (6 before the
    2026-08-20 partition fix; power_sim_results.json was computed at G=6, so its MDEs are slightly
    pessimistic now). Still the textbook few-clusters regime (reliable coverage wants G >~ 20-40),
    which is why adding instances inside the existing repos cannot buy power. See power_sim.py."""
    repos = sorted( { repo for _, repo, *_ in pairs } )
    if not repos: return 0.0, []
    by_repo = {}
    for instance_id, repo, seed, base, ctx in pairs:
        by_repo.setdefault( repo, [] ).append( value_fn( base, ctx ) )
    rng = random.Random( seed_str )
    boots = []
    for _ in range( n_boot ):
        sampled_repos = [ rng.choice( repos ) for _ in repos ]
        vals = [ v for r in sampled_repos for v in by_repo[r] ]
        boots.append( mean( vals ) )
    boots.sort()
    lower = boots[ max( 0, int( alpha * len( boots ) ) ) ]
    return lower, boots

def resolved_delta( base, ctx ): return float( bool( ctx["resolved"] ) ) - float( bool( base["resolved"] ) )
def loc_hit_delta( base, ctx ):
    if base["localization_hit"] is None or ctx["localization_hit"] is None: return 0.0
    return float( bool( ctx["localization_hit"] ) ) - float( bool( base["localization_hit"] ) )

def paired_ratio( pairs, field ):
    # (ctx - base) / base for a positive-valued cost/perf field, paired per (instance,seed); undefined
    # (skipped) pairs where base
```

### Core Architecture Module: `bench/agentloop/backfill_claude_transcripts.py`
```
#!/usr/bin/env python3
"""Repair a claude-code-p results bundle produced before 2026-08-22: attach the real session
transcripts and populate the accounting fields the old harness left null.

WHY THIS EXISTS. Before 2026-08-22, run_agentloop.py's claude harness retained only the `claude -p`
result trailer under events/ — a 20-key summary object with no tool calls in it — while the REAL
per-message transcript (every assistant turn with its tool_use blocks) sat unretained in the
ephemeral run home at claude-home/<arm>/<instance>-<seed>/projects/<cwd-slug>/<session_id>.jsonl,
i.e. in /tmp state that dies on the next cycle. Every such record also carried
command_calls=None / native_read_calls=None — fields that look like they were meant to hold
tool-call accounting and never did, for this harness. Both halves are fixed in run_agentloop.py for
new runs (_claude_metrics + parse_claude_session_metrics); this script applies the same repair
retroactively to an ALREADY-ARCHIVED bundle while its /tmp run homes still exist.

WHAT IT DOES, per claude-code-p record in the results file:
  1. reads the archived trailer events/<instance>-<arm>-<seed>.json for its session_id;
  2. locates exactly claude-home/<arm>/<instance>-<seed>/projects/*/<session_id>.jsonl — the exact
     session only, never a guess: run homes are reused across lanes, and attaching another run's
     transcript would be worse than attaching none;
  3. copies it to events/<instance>-<arm>-<seed>.transcript.jsonl beside the trailer;
  4. populates command_calls / native_read_calls from it (only where currently null — a non-null
     value that disagrees is reported and left alone);
  5. cross-checks the shim-derived ripwire_calls against the transcript-parsed count (reported,
     never overwritten — the shim is authoritative);
  6. rewrites events_path to the RELATIVE form events/<name>.json, which grade_answers.py resolves
     against the results file's own directory — the bundle stops depending on /tmp paths at all.

The results file is rewritten in place; the pristine original is kept once at
<results>.pre-backfill. Exit 4 if any claude record could not be backfilled (missing trailer or
transcript) — a partial repair must be visible, not silent.
"""
import argparse, glob, json, pathlib, sys

sys.path.insert( 0, str( pathlib.Path( __file__ ).resolve().parent ) )
import run_agentloop as R


def backfill( results_path, claude_home, events_dir, ripwire_bin, dry_run ):
    results_path = pathlib.Path( results_path )
    data = json.loads( results_path.read_text() )
    if data.get( "schema" ) != R.SCHEMA:
        raise SystemExit( f"{results_path}: schema {data.get('schema')!r} != {R.SCHEMA!r}; refusing" )
    events_dir = pathlib.Path( events_dir ) if events_dir else results_path.resolve().parent / "events"
    claude_home = pathlib.Path( claude_home )

    done, skipped, missing, mismatched = 0, 0, [], []
    for rec in data.get( "records", [] ):
        if rec.get( "harness" ) != "claude-code-p":
            skipped += 1
            continue
        stem = f"{rec['instance_id']}-{rec['arm']}-{rec['seed']}"
        trailer = events_dir / f"{stem}.json"
        if not trailer.exists():
            missing.append( f"{stem}: no archived trailer at {trailer}" )
            continue
        try:
            session_id = json.loads( trailer.read_text() ).get( "session_id" )
        except ValueError:
            session_id = None
        if not session_id:
            missing.append( f"{stem}: trailer carries no session_id" )
            continue
        hits = glob.glob( str( claude_home / rec[ "arm" ] / f"{rec['instance_id']}-{rec['seed']}"
                               / "projects" / "*" / f"{session_id}.jsonl" ) )
        if not hits:
            # layout tolerance: same exact session_id, anywhere under the given home
            hits = glob.glob( str( claude_home / "**" / f"{session_id}.jsonl" ), recursive=True )
        if len( hits ) != 1:
            missing.append( f"{stem}: {len(hits)} transcript(s) match session {session_id} under {claude_home}" )
            continue

        text = pathlib.Path( hits[ 0 ] ).read_text( errors="replace" )
        ( command_calls, ripwire_calls,
          ripwire_commands, native_read_calls ) = R.parse_claude_session_metrics( text, ripwire_bin )
        if not dry_run:
            ( events_dir / f"{stem}.transcript.jsonl" ).write_text( text )
        for field, value in ( ( "command_calls", command_calls ), ( "native_read_calls", native_read_calls ) ):
            if rec.get( field ) is None:
                rec[ field ] = value
            elif rec[ field ] != value:
                mismatched.append( f"{stem}: recorded {field}={rec[field]} vs transcript {value} — left alone" )
        if rec.get( "ripwire_calls" ) is not None and rec[ "ripwire_calls" ] != ripwire_calls:
            mismatched.append( f"{stem}: shim ripwire_calls={rec['ripwire_calls']} vs transcript "
                               f"{ripwire_calls} ({ripwire_commands[:2]!r}) — shim kept (authoritative)" )
        rec[ "events_path" ] = f"events/{stem}.json"
        done += 1

    if not dry_run and done:
        backup = results_path.with_name( results_path.name + ".pre-backfill" )
        if not backup.exists():
            backup.write_text( results_path.read_text() )
        results_path.write_text( json.dumps( data, indent=2 ) )

    tag = "DRY RUN — " if dry_run else ""
    print( f"# {tag}{done} record(s) backfilled, {skipped} non-claude record(s) untouched, "
           f"{len(missing)} unrecoverable, {len(mismatched)} cross-check disagreement(s)" )
    for line in missing:
        print( f"MISSING    {line}" )
    for line in mismatched:
        print( f"CROSSCHECK {line}" )
    return 4 if missing else 0


def main():
    ap = argparse.ArgumentParser( description=( "attach real claude session transcripts to a pre-2026-08-22 "
                                                "results bundle and populate its null accounting fields" ) )
    ap.add_argument( "--results", required=True, help="run_agentloop.py results JSON (e.g. stage1.json)" )
    ap.add_argument( "--claude-home", required=True,
                     help="the run's claude-home root (work_dir/claude-home), holding <arm>/<instance>-<seed>/projects/" )
    ap.add_argument( "--events-dir", default="",
                     help="archived events/ dir holding the trailers (default: <results dir>/events)" )
    ap.add_argument( "--ripwire-bin", default=R.RIPWIRE_BIN_DEFAULT,
                     help="ripwire path/name for the transcript's ripwire-vs-native-read classification" )
    ap.add_argument( "--dry-run", action="store_true", help="report only; write nothing" )
    a = ap.parse_args()
    return backfill( a.results, a.claude_home, a.events_dir, a.ripwire_bin, a.dry_run )


if __name__ == "__main__":
    raise SystemExit( main() )

```

### Core Architecture Module: `bench/agentloop/editsuite/fixture/geometry.cpp`
```
#include "geometry.h"

#include <cmath>

double area_of_triangle( double base, double height )
{
    return 0.5 * base * height;
}

double distance( Point a, Point b )
{
    const double dx = a.x - b.x;
    const double dy = a.y - b.y;
    return std::sqrt( dx * dx + dy * dy );
}

double perimeter( const Point* pts, int n )
{
    double total = 0.0;
    for( int i = 0; i < n; ++i )
    {
        total += distance( pts[i], pts[( i + 1 ) % n] );
    }
    return total;
}

Point scale_point( Point p, double k )
{
    return Point{ p.x * k, p.y * k };
}

```

### Core Architecture Module: `bench/agentloop/editsuite/fixture/geometry.h`
```
#pragma once

struct Point
{
    double x;
    double y;
};

double area_of_triangle( double base, double height );
double perimeter( const Point* pts, int n );
Point  scale_point( Point p, double k );
double distance( Point a, Point b );

```

### Core Architecture Module: `bench/agentloop/editsuite/fixture/matrix.cpp`
```
#include <vector>

using Matrix = std::vector<std::vector<double>>;

Matrix transpose( const Matrix& m )
{
    if( m.empty() )
    {
        return {};
    }
    Matrix out( m[0].size(), std::vector<double>( m.size(), 0.0 ) );
    for( std::size_t r = 0; r < m.size(); ++r )
    {
        for( std::size_t c = 0; c < m[r].size(); ++c )
        {
            out[c][r] = m[r][c];
        }
    }
    return out;
}

double trace( const Matrix& m )
{
    double sum = 0.0;
    for( std::size_t i = 0; i < m.size() && i < m[i].size(); ++i )
    {
        sum += m[i][i];
    }
    return sum;
}

double frobenius( const Matrix& m )
{
    double sum = 0.0;
    for( const auto& row : m )
    {
        for( double v : row )
        {
            sum += v * v;
        }
    }
    return sum;
}

```

### Core Architecture Module: `bench/agentloop/editsuite/fixture/report.py`
```
"""Builds a one-line report from the helpers."""

from stats import describe
from text import slugify, word_count


def build_report(title, values, body):
    d = describe(values)
    return "%s: mean=%.2f median=%.2f words=%d" % (slugify(title), d["mean"], d["median"], word_count(body))

```

### Core Architecture Module: `bench/agentloop/editsuite/fixture/stats.py`
```
"""Small statistics helpers used by the report module."""


def mean(values):
    return sum(values) / len(values)


def variance(values):
    m = mean(values)
    return sum((v - m) ** 2 for v in values) / len(values)


def median(values):
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def describe(values):
    return {
        "mean": mean(values),
        "variance": variance(values),
        "median": median(values),
    }

```

### Core Architecture Module: `bench/agentloop/editsuite/fixture/text.py`
```
"""Text helpers used by the report module."""

import re


def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def word_count(text):
    return len(text.split())


def title_case(text):
    return " ".join(w.capitalize() for w in text.split())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #216** (2026-09-14): **fix(graph): an internal-linkage definition no longer stands for another file's declaration (parser version 96)**
  *Symptoms*: CodeRabbit's post-merge finding on #139 (`src/graph.h`, outside the diff): the decl-to-def widening behind every `file:name` selector retains a definition on FILE evidence alone, so a translation unit that `#include`s `api.h` for its own reasons and defines an unrelated `helper` in an anonymous namespace is served as the header's implementation. Confirmed by reading and by a fixture. One correction to the finding's framing: a same-signature anonymous `helper` in an including TU makes every unqualified call ambiguous, so the shape that compiles is an overload — `helper(double)` in the anonymous namespace, or a namespace-scope `static helper(long)`, beside the declared `helper(int)`. Both were gathered by name and both were wrong.  ## The rule  Internal linkage makes a definition visible to its own translation unit alone, so no other file's declaration can stand for it. Symbol carried no linkage information at all, so the fix needs an extraction bit.  ## Change  - **Ingest.** Every C and C++ definition carries a syntactic `internalLinkage` bit (`ingest_names.h::cppInternalLinkage`): inside an anonymous `namespace { }` at any depth, or carrying a namespace-scope `static`. A class-scope `static` member has external linkage and is not marked. Rides `RawDef` and the per-file cache record as one u8 after `recovered` (`kMinDefRecordBytesLean` 78 → 79); `Symbol` takes it as a bit-field sharing `testScope`'s byte, so `sizeof( Symbol )` and its static_assert are unchanged. - **Graph.** 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `b1cdbc73-3679-4fac-8a27-fbf79d8686f2`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between a2f90ba68a2d1f8044ca1ce9b3493d451c70e233 and 65b8244b2b77a3dd841d7f84b93dc2ddc0af5adf.  </details>  <details> <summary>📒 Files selected for processing (11)</summary>  * `CHANGELOG.md` * `src/graph.h` * `src/ingest_cache.h` * `src/ingest_model.h` * `src/ingest_names.h` * `src/ingest_sidecap.h` * `src/model.h` * `src/quality.h` * `test/decltodefcheck.sh` * `test/qschemetrip.hash` * `test/qschemetripcheck.sh`  </details>  **Included review availability:** Your plan provid
  > Full battery, as promised. `python3 test/pargates.py . ./build/ripwire -j 3` on `0986edfd`:      gates=626 pass=621 skip=3 fail=2 wall=2854.7s jobs=3 tree_writes=0  Both reds are the runner's, not the change's, and each is green rerun alone on the same head:  - `versioncheck` — I committed while the suite was running, so the binary's stamp read `1cf3086e8+dirty` against a HEAD of `0986edfd`. Rebuilt at `0986edfd` (no source change): `ALL PASS`. - `strkerncheck` — TIMEOUT at its declared 300 s budget under the three-job load (it compiles and runs the SIMD mirrors under sanitizers). Alone: `strkerncheck: PASS` in 141 s.  So 626 of 626 on this head. Everything in the description stands: `decltodefcheck` 226/226 plain and under ASan, determinism ×2, xmllint, the frozen-HEAD default map byte-identical. 
  > Thank you, @andriytyurnikov — this is exemplary work, and the part I most want to call out is the correction you made to the finding itself. The automated review described a same-signature anonymous `helper`; you noticed that shape makes every unqualified call ambiguous and wouldn't compile, and rebuilt the repro as an overload — `helper(double)` in an anonymous namespace and a namespace-scope `static helper(long)` beside the declared `helper(int)`. That's the version that actually ships in real code, and it's the difference between a gate that proves something and a gate that proves a shape nobody writes.  The red-first discipline is exactly right: arm (B2) lands in its own commit, and I reproduced it — on main's binary it is the only failure of 226 arms, with your exact message, and 227/227 pass on yours. I also like that you let the existing (E2) residue arms decide *where* the linkage test goes. Putting it in the gather would have silenced the disclosure; putting it in the proof lo

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

### Incident Patch 1: `eb94b794` (2026-09-29)
**Commit Message**: docs(#350): CR2 — memory_parsed's path order is the all-cache-hit case, not a repeat ingest

prewarm.ready is toCompile.empty() (ingest_prewarm.h), and toCompile is built only
from grammars that cache-MISS files need; it never consults compiledQueryCache().
So the parse's work order falls back to path (fileId) order exactly when no
grammar-bearing file needed a fresh parse — every one an ingest-cache hit — in any
process, fresh or not. The previous round's "when this process had already compiled
every grammar query" / "a repeat ingest in one process" was false. Corrected in the
compact legend, --help (COMMANDS.md regenerated), CHANGELOG and the memguard.h,
serialize.h and ingest_parsepool.h comments; the repeatability claim drops "the
process's earlier ingests" (a function of the tree, the cache and K again).

dictv 0ee982e27b1d8ad7 (hand-corrected in the showcase capture), printf parity
re-pinned for help_all only. memguardcheck B20 pins the three orders under parse:1:
cold keeps z/big.c (largest miss), a warm cache keeps a/f00.c (path order), one
changed file keeps a/f01.c (the miss leads again).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -34,7 +34,8 @@ with one line naming the limit and the override. The MCP server refuses a tool c
 up; every answer from an index the guard cut carries `_memory_stop` in its envelope. A stop inside a verb's own
 secondary ingest that the verb does not read turns a CLI exit into 5 with one line, so it cannot pass as whole.
 A parse stop keeps every file it parsed — the first K slots of its work order it claimed (uncached files, then cached,
-then grammarless, each largest first; path order when the process had already compiled every grammar query; a slot
+then grammarless, each largest first; path order when no grammar-bearing file needed a fresh parse, every one an
+ingest-cache hit; a slot
 may reuse cached facts or fail to read) — so a partial map repeats for a given tree, cache and `memory_parsed=K`, and
 its JSON header adds `counts_floor:true`. `--expand` and `--outline`, and `--in` after a crawl stop, refuse a partial
 index like the other verbs (a selector in an unparsed or uncrawled file would read as "no match"), as do `--batch` (its
```

**File**: `docs/COMMANDS.md` (modified, +2/-2)
```diff
@@ -4389,7 +4389,7 @@ _The session legend dictionary the MCP server serves as ripwire://legend-dict/fu
 
 ```
 $ ./build/ripwire . --legend-dict
-ripwire legend dictionary ripwire.dict/v1 dictv=d5ae5ab63e5e0010 entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=0ee982e27b1d8ad7 entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
@@ -4684,7 +4684,7 @@ $ ./build/ripwire . --max-file-size=8K --top-k=3
 
 **Answers:** the memory guard's limit (default 65% of this machine's memory, env RIPWIRE_MAX_MEMORY) the memory guard is on for every run and silent on normal ones: it measures this process's footprint at most once per 5 s, from 5 s into an ingest.
 
-Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K slots it claimed of its work order — uncached files first, largest first within a tier, or path order on a repeat ingest in one process — so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every other verb (--html, --mermaid, --expand, --outline and, after a crawl stop, --in included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
+Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K slots it claimed of its work order — uncached files first, largest first within a tier, or path order when every grammar-bearing file was an ingest-cache hit — so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every other verb (--html, --mermaid, --expand, --outline and, after a crawl stop, --in included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
 
 **Shaped by:** `--mcp`
 
```

**File**: `docs/captures/COMMANDS_showcase_2026-09-14.md` (modified, +1/-1)
```diff
@@ -5351,7 +5351,7 @@ ripwire: --run-timeout=SECONDS modifies --run-trace — pass it too (e.g. ripwir
 *The session legend dictionary the MCP server serves as ripwire://legend-dict/full — one definition per line, headed by its dictv= version; no corpus needed. =roster lists the completeness attributes it defines.*
 
 `````
-ripwire legend dictionary ripwire.dict/v1 dictv=d5ae5ab63e5e0010 entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=0ee982e27b1d8ad7 entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
```

**File**: `src/cli.h` (modified, +4/-4)
```diff
@@ -2636,10 +2636,10 @@ inline constexpr char kHelpTail[] =
         "                               the crawl (growth of limit/8) or the parse (half the limit) stops, and the default\n"
         "                               map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=,\n"
         "                               memory_limit=; a parse stop keeps the first K slots it claimed of its work order —\n"
-        "                               uncached files first, largest first within a tier, or path order on a repeat ingest in\n"
-        "                               one process — so a partial map repeats for a given memory_parsed=K); critical OS pressure\n"
-        "                               stops them too. Every other verb (--html, --mermaid, --expand, --outline and, after a\n"
-        "                               crawl stop, --in included) refuses a partial index, and so does any\n"
+        "                               uncached files first, largest first within a tier, or path order when every grammar-bearing\n"
+        "                               file was an ingest-cache hit — so a partial map repeats for a given memory_parsed=K);\n"
+        "                               critical OS pressure stops them too. Every other verb (--html, --mermaid, --expand,\n"
+        "                               --outline and, after a crawl stop, --in included) refuses a partial index, and so does any\n"
         "                               verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one\n"
         "                               line naming it. Nothing derived from a partial ingest is cached. The\n"
         "                               default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag,\n"
```

**File**: `src/compactlegend.h` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ inline constexpr CompactCompletenessTerm kCompactCompletenessTerms[] =
     // #350 layer 3: the memory guard's stop (serialize.h buildMemoryStopAttr). Present only on a run the guard cut, so each
     // is a present-only header term; the readings avoid the flag's spelling because a legend is an XML comment.
     { "memory_stop",       "memory_stop=crawl|parse: the memory guard stopped that phase; files= and every count are floors of the tree", false, {}, MapHeaderRead::Only },
-    { "memory_parsed",     "memory_parsed=K: the parse claimed the first K slots of its work order (uncached files, then cached, then grammarless, each largest first; path order when this process had already compiled every grammar query); a slot may reuse cached facts or fail to read; later files carry no symbols", false, {}, MapHeaderRead::Only },
+    { "memory_parsed",     "memory_parsed=K: the parse claimed the first K slots of its work order (uncached files, then cached, then grammarless, each largest first; path order when no grammar-bearing file needed a fresh parse, every one an ingest-cache hit); a slot may reuse cached facts or fail to read; later files carry no symbols", false, {}, MapHeaderRead::Only },
     { "memory_limit",      "memory_limit=NM: the guard's limit, spelled as the max-memory value that raises it", false, {}, MapHeaderRead::Only },
     { "memory_pressure",   "memory_pressure=1: OS memory pressure stopped it, not the limit", false, {}, MapHeaderRead::Only },
     { "unindexed",         "unindexed=ext:N: N text files of that extension no grammar reads (6 extensions at most)", false, {}, MapHeaderRead::Only },
```

---

### Incident Patch 2: `7f610b31` (2026-09-29)
**Commit Message**: refactor(#350): the map-path refusal flags leave memoryStopExit (mapFlagRefusingPartial)

The ternary chain the review rounds grew (--html, --mermaid, --expand, --outline,
--in, --pin-census) moves into one table-driven helper, so memoryStopExit keeps
its pre-round shape (quality-delta: complexity 27->34 and nesting 6->7 gated on
the previous commit). No behaviour change; memguardcheck green.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `src/main.cpp` (modified, +31/-10)
```diff
@@ -4030,6 +4030,36 @@ int main( int argc, char** argv )
     return rc;
 }
 
+// #350: the flags on the map's own path (no report verb won) that cannot answer from a memory-guard partial index, in
+// the order they are named: the renderings with no header to carry memory_stop= (--html, --mermaid); the modifiers that
+// resolve a SELECTOR against the index — --expand/--outline a symbol name (one in a file the guard never parsed would
+// read as "matched no symbol", a false none-found), --in=DIR a directory against the crawl's files (only a crawl stop
+// cuts those: a directory it never reached would read as "no indexed file"); and --pin-census, which writes the
+// resolver's census to a file with no header to carry the cut. nullptr: the map answers, disclosed in its header.
+static const char* mapFlagRefusingPartial( const rw::Config& cfg, const rw::MemoryStop& stop )
+{
+    const struct
+    {
+        bool        active;
+        const char* flag;
+    } rows[] = {
+        { cfg.html, "--html" },
+        { cfg.mermaid, "--mermaid" },
+        { !cfg.expand.empty(), "--expand" },
+        { !cfg.outline.empty(), "--outline" },
+        { !cfg.inDir.empty() && stop.phase == rw::MemoryStop::Phase::Crawl, "--in" },
+        { !cfg.pinCensus.empty(), "--pin-census" },
+    };
+    for( const auto& row : rows )
+    {
+        if( row.active )
+        {
+            return row.flag;
+        }
+    }
+    return nullptr;
+}
+
 // Everything main() did after parseArgs — the verb dispatch — behind one seam so --legend=compact can wrap the
 // run's stdout once (runWithCompactLegend above) instead of teaching ~60 emitters a second dialect.
 // #350 layer 3: a memory-guard stop leaves a PARTIAL ingest. Only the default map carries the disclosure in its own
@@ -4051,16 +4081,7 @@ static int memoryStopExit( const rw::IngestResult& ing, const rw::Config& cfg, c
         rw::emitTo( stderr, "ripwire: {}\n", rw::memguard::nothingBuiltLine( stop ) );
         return 5;
     }
-    // the map's own renderings with no header to carry memory_stop= (--html, --mermaid) refuse like any other verb
-    // …and so do the map modifiers that resolve a SELECTOR against the index: --expand/--outline a symbol name (one in a
-    // file the guard never parsed would read as "matched no symbol", a false none-found), --in=DIR a directory against
-    // the crawl's files (only a crawl stop cuts those: a directory it never reached would read as "no indexed file");
-    // --pin-census writes the resolver's census to a file that has no header to carry the cut
-    const bool        inDirCut     = !cfg.inDir.empty() && stop.phase == rw::MemoryStop::Phase::Crawl;
-    const char* const refusingVerb = winnerVerb != nullptr ? winnerVerb
-                                   : cfg.html ? "--html" : cfg.mermaid ? "--mermaid"
-                                   : !cfg.expand.empty() ? "--expand" : !cfg.outline.empty() ? "--outline"
-                                   : inDirCut ? "--in" : !cfg.pinCensus.empty() ? "--pin-census" : nullptr;
+    const char* const refusingVerb = winnerVerb != nullptr ? winnerVerb : mapFlagRefusingPartial( cfg, stop );
     if( refusingVerb != nullptr )
     {
         DISCLOSE( Diagnostics::answerRefused, "main: a verb other than the map refuses a memory-guard partial ingest — exit 5, one stderr line" );
```

---

### Incident Patch 3: `05f80ae6` (2026-09-29)
**Commit Message**: fix(#350): CR1 extended — --batch, --pin-census and every edit refuse a partial index

The same class as --expand/--outline: a surface that answered a memory-guard
partial index with the cut only on stderr.
- --batch: its sub-answers carry no memory disclosure, so a sub-query for a
  symbol in an unparsed file answered "symbol not found" (exit 5 only via the
  backstop). The batch now refuses whole before writing stdout: exit 5, one line.
- Edits: runEditVerb (CLI --replace-symbol-body/--insert-*, MCP edit tools) and
  --edit-plan resolved their target against the cut index and WROTE — a
  same-named definition in an unparsed file would make an ambiguous target read
  as unique. They now refuse before anything is written; the CLI exits 5 with the
  one refusal line (editRefusalExit answers the stop).
- --pin-census wrote the resolver census from a partial graph to a file with no
  header to carry the cut; memoryStopExit now refuses it with the other modifiers.
--query --format=candidates already refused (--query is a report verb, so
winnerVerb names it); B16 pins that. The earlier report's deferral was wrong.

memguardcheck B17, B18, B18b, B18c, B19 red on c40c3326, green here; B16

**File**: `CHANGELOG.md` (modified, +4/-1)
```diff
@@ -37,7 +37,10 @@ A parse stop keeps every file it parsed — the first K slots of its work order
 then grammarless, each largest first; path order when the process had already compiled every grammar query; a slot
 may reuse cached facts or fail to read) — so a partial map repeats for a given tree, cache and `memory_parsed=K`, and
 its JSON header adds `counts_floor:true`. `--expand` and `--outline`, and `--in` after a crawl stop, refuse a partial
-index like the other verbs (a selector in an unparsed or uncrawled file would read as "no match"), and a multi-root
+index like the other verbs (a selector in an unparsed or uncrawled file would read as "no match"), as do `--batch` (its
+sub-answers carry no disclosure), `--pin-census` (a file with no header) and every edit — the CLI edit verbs,
+`--edit-plan` and the MCP edit tools write nothing when the index was cut, since a same-named definition in an unparsed
+file would make an ambiguous target read as unique — and a multi-root
 workspace checks the hard limit after each root before ingesting the next; stop messages name the line that was crossed (the
 crawl line, an eighth of the limit; the parse line, half of it; or OS pressure), never the limit a soft stop did not
 reach. Nothing derived from a
```

**File**: `src/editplan.h` (modified, +2/-0)
```diff
@@ -304,6 +304,8 @@ inline Outcome prepare( const std::string& root, const std::string& planPath, st
     if( objects.empty() || objects.size() > 64 || !objectOnlyArray( editArray, objects ) ) { out.message = "edit plan needs 1..64 edit objects and no other array values"; return out; }
 
     const McpIndex& ix = getIndex( root );
+    // #350: every target resolves against the index — a memory-guard partial one refuses the whole plan, nothing staged
+    if( ix.ing.memoryStop.isSet() ) { out.message = memguard::verbRefusalLine( ix.ing.memoryStop, "--edit-plan" ); return out; }
     edits.reserve( objects.size() );
     for( const std::string& object : objects )
     {
```

**File**: `src/main.cpp` (modified, +27/-4)
```diff
@@ -3417,6 +3417,18 @@ int runHelpTask( const rw::Config& cfg, const rw::IngestResult& ing, const std::
     return 0;
 }
 
+// #350: an edit over an index the memory guard cut refuses first (runEditVerb / editplan::run), and that refusal line
+// already names the guard — so it answers for the stop and exits 5, rather than 1 plus the backstop's second line
+int editRefusalExit() noexcept
+{
+    if( !rw::memguard::hasUnansweredStop() )
+    {
+        return 1;
+    }
+    rw::memguard::answerStops();
+    return 5;
+}
+
 std::optional<int> runCliEditPlan( const rw::Config& cfg )
 {
     const bool hasMode = cfg.editPlanDryRun || cfg.editPlanApply;
@@ -3445,7 +3457,7 @@ std::optional<int> runCliEditPlan( const rw::Config& cfg )
     if( !outcome.ok )
     {
         rw::emitTo( stderr, "ripwire edit-plan: {}\n", outcome.message.c_str() );
-        return 1;
+        return editRefusalExit();
     }
     std::puts( outcome.receipt.c_str() );
     return 0;
@@ -3526,7 +3538,7 @@ std::optional<int> runCliEdit( const rw::Config& cfg )
         const char* const editFlag = !cfg.replaceSymbolBody.empty() ? "--replace-symbol-body"
                                        : !cfg.insertBeforeSymbol.empty() ? "--insert-before-symbol" : "--insert-after-symbol";
         rw::emitTo( stderr, "ripwire: {}: {}\n", editFlag, outcome.message.c_str() );
-        return 1;
+        return editRefusalExit();
     }
 
     std::fputs( outcome.resultJson.c_str(), stdout );
@@ -4042,12 +4054,13 @@ static int memoryStopExit( const rw::IngestResult& ing, const rw::Config& cfg, c
     // the map's own renderings with no header to carry memory_stop= (--html, --mermaid) refuse like any other verb
     // …and so do the map modifiers that resolve a SELECTOR against the index: --expand/--outline a symbol name (one in a
     // file the guard never parsed would read as "matched no symbol", a false none-found), --in=DIR a directory against
-    // the crawl's files (only a crawl stop cuts those: a directory it never reached would read as "no indexed file")
+    // the crawl's files (only a crawl stop cuts those: a directory it never reached would read as "no indexed file");
+    // --pin-census writes the resolver's census to a file that has no header to carry the cut
     const bool        inDirCut     = !cfg.inDir.empty() && stop.phase == rw::MemoryStop::Phase::Crawl;
     const char* const refusingVerb = winnerVerb != nullptr ? winnerVerb
                                    : cfg.html ? "--html" : cfg.mermaid ? "--mermaid"
                                    : !cfg.expand.empty() ? "--expand" : !cfg.outline.empty() ? "--outline"
-                                   : inDirCut ? "--in" : nullptr;
+                                   : inDirCut ? "--in" : !cfg.pinCensus.empty() ? "--pin-census" : nullptr;
     if( refusingVerb != nullptr )
     {
         DISCLOSE( Diagnostics::answerRefused, "main: a verb other than the map refuses a memory-guard partial ingest — exit 5, one stderr line" );
@@ -4681,6 +4694,16 @@ static int dispatchMain( const rw::Config& cfg, char** argv )
         // (measured on the fixture, uses+slice: 8,840 B full, 8,645 B outer-only, 4,478 B with the subs). The
         // whole-stdout layer cannot do it — it must not rewrite inside CDATA — so the batch assembler does,
         // through the SAME helper the MCP twin calls. Gate: batchcheck (a)/(h) and compactlegendcheck.
+        // #350: the sub-answers carry no memory disclosure of their own, so a batch whose index the guard cut
+        // refuses whole (a sub-answer's "not found" could be a file the guard never parsed) — nothing on stdout
+        if( rw::memguard::hasUnansweredStop() )
+        {
+            rw::memguard::answerStops();
+            DISCLOSE( Diagnostics::answerRefused, "main: --batch over a memory-guard partial ingest refuses — exit 5, one stderr line" );
+            rw::emitTo( stderr, "ripwire: the memory guard stopped the ingest --batch reads; --batch canno
```

**File**: `src/mcpedit.h` (modified, +9/-0)
```diff
@@ -21,6 +21,7 @@
 #include "nextverb.h"         // E2: ONE next= on the receipt (nextFlag / nextFieldJson)
 #include "redact.h"           // R1 (V3): kRedactRules — the marker table the write gate's predicate is derived FROM
 #include "pathguard.h"        // A4-F14: rw::pathguard::isSymlink — THE symlink predicate, shared with the sidecar writers
+#include "memguard.h"         // #350: an edit refuses an index the memory guard cut (verbRefusalLine)
 
 #include <climits>            // PATH_MAX — the AbsHintFrame realpath/getcwd buffers (A2)
 
@@ -1202,6 +1203,14 @@ inline mcpedit::Outcome runEditVerb( const std::string& root, mcpedit::Op op, co
 
     const McpIndex&     ix  = getIndex( root );
     const IngestResult& ing = ix.ing;
+    // #350: a target resolved against a memory-guard partial index can be a false "not found", or a false "unique"
+    // when a same-named definition sits in a file the guard never parsed — refuse before anything is written
+    if( ing.memoryStop.isSet() )
+    {
+        oc.ok = false; oc.errCode = -32602;
+        oc.message = memguard::verbRefusalLine( ing.memoryStop, "an edit" );
+        return oc;
+    }
 
     // 1. resolve either a plain name or a grep-issued, freshness-pinned handle to exactly one definition.
     const mcpedit::EditTarget target = mcpedit::resolveTarget( ix, symbol, pathHint );
```

**File**: `test/memguardcheck.sh` (modified, +49/-0)
```diff
@@ -491,6 +491,55 @@ if [ "$rc" = 0 ] && grep -q 'memory_stop=parse' "$TMP/b13c.out" && ! grep -q 'ca
 else
     no "(B13c) rc=$rc stderr: $( grep '^ripwire:' "$TMP/b13c.err" | head -c 250 )"
 fi
+# (B16) --query --format=candidates is a report verb, so it refuses a partial index like the rest (pinned: its
+#       <candidates> root has no header to carry the cut)
+run_trip parse:10 "$FX" --no-cache --query=d_17 --format=candidates >"$TMP/b16.out" 2>"$TMP/b16.err"; rc=$?
+if [ "$rc" = 5 ] && [ ! -s "$TMP/b16.out" ] && grep -q '^ripwire: .*--query cannot answer from a partial index' "$TMP/b16.err"; then
+    ok "(B16) --query --format=candidates over a partial parse refuses (exit 5, names --query)"
+else
+    no "(B16) rc=$rc stdout=$( wc -c <"$TMP/b16.out" | tr -d ' ' )B stderr: $( grep '^ripwire:' "$TMP/b16.err" | head -c 250 )"
+fi
+# (B17) --batch sub-answers carry no memory disclosure, so a batch over a cut index refuses whole (callers:d_17 would
+#       otherwise answer "symbol not found" for a symbol in a file the guard never parsed)
+printf 'callers:d_17\ngrep:d_17\n' >"$TMP/b17.batch"
+run_trip parse:10 "$FX" --no-cache --batch="$TMP/b17.batch" >"$TMP/b17.out" 2>"$TMP/b17.err"; rc=$?
+if [ "$rc" = 5 ] && [ ! -s "$TMP/b17.out" ] && grep -q '^ripwire: .*--batch cannot answer from a partial index' "$TMP/b17.err"; then
+    ok "(B17) --batch over a partial parse refuses whole (exit 5, empty stdout), never a false 'not found'"
+else
+    no "(B17) rc=$rc stdout=$( wc -c <"$TMP/b17.out" | tr -d ' ' )B stderr: $( grep '^ripwire:' "$TMP/b17.err" | head -c 250 )"
+fi
+# (B18) an edit resolves its target against the index: over a cut index it refuses and writes nothing (a same-named
+#       definition in an unparsed file would make an ambiguous target read as unique). CLI verb, --edit-plan, MCP tool.
+FXE="$TMP/fxe"; cp -R "$FX" "$FXE"; cp "$FXE/a/f00.c" "$TMP/b18.orig"
+printf 'int a_00( int x ) { return x + 1; }\n' >"$TMP/b18.body"
+run_trip parse:10 "$FXE" --no-cache --replace-symbol-body=a_00 --edit-payload="$TMP/b18.body" >"$TMP/b18.out" 2>"$TMP/b18.err"; rc=$?
+if [ "$rc" = 5 ] && [ ! -s "$TMP/b18.out" ] && cmp -s "$FXE/a/f00.c" "$TMP/b18.orig" \
+   && grep -q '^ripwire: --replace-symbol-body: .*cannot answer from a partial index' "$TMP/b18.err" && [ "$( grep -c '^ripwire' "$TMP/b18.err" )" = 1 ]; then
+    ok "(B18) --replace-symbol-body over a partial parse refuses (exit 5, one line), file byte-unchanged"
+else
+    no "(B18) rc=$rc stdout=$( wc -c <"$TMP/b18.out" | tr -d ' ' )B unchanged=$( cmp -s "$FXE/a/f00.c" "$TMP/b18.orig" && echo 1 || echo 0 ) stderr: $( grep '^ripwire' "$TMP/b18.err" | head -c 250 )"
+fi
+mkdir -p "$TMP/b18plan"; cp "$TMP/b18.body" "$TMP/b18plan/body.c"
+printf '{"version":1,"edits":[{"op":"replace_symbol_body","target":"a_00","payload":"body.c"}]}\n' >"$TMP/b18plan/plan.json"
+run_trip parse:10 "$FXE" --no-cache --edit-plan="$TMP/b18plan/plan.json" --apply >"$TMP/b18b.out" 2>"$TMP/b18b.err"; rc=$?
+if [ "$rc" = 5 ] && [ ! -s "$TMP/b18b.out" ] && cmp -s "$FXE/a/f00.c" "$TMP/b18.orig" && grep -q -- '--edit-plan cannot answer from a partial index' "$TMP/b18b.err"; then
+    ok "(B18b) --edit-plan --apply over a partial parse refuses (exit 5), nothing written"
+else
+    no "(B18b) rc=$rc unchanged=$( cmp -s "$FXE/a/f00.c" "$TMP/b18.orig" && echo 1 || echo 0 ) stderr: $( grep '^ripwire' "$TMP/b18b.err" | head -c 250 )"
+fi
+printf '%s\n' "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"replace_symbol_body\",\"arguments\":{\"path\":\"$FXE\",\"symbol\":\"a_00\",\"new_body\":\"int a_00( int x ) { return x + 1; }\"}}}" \
+    | RIPWIRE_TEST_MEMGUARD=parse:10 mcp_call "$TMP" >"$TMP/b18c.out"
+case "$( mcp_field "$TMP/b18c.out" 2 error )" in *"cannot answer from a partial index"*)
+        if cmp -s "$FXE/a/f00.c" "$TMP/b18.orig"; then ok "(B18c) MCP replace_symbol_body over a cut index refuses, file byte-unchanged"
+        else no "(B18c) refused but the file changed"; 
```

---

### Incident Patch 4: `c40c3326` (2026-09-29)
**Commit Message**: fix(#350): review round 4 — selector modifiers refuse a partial index, per-root hard line, JSON floor, memory_parsed wording

CodeRabbit on #363:
- --expand and --outline (not report verbs, so winnerVerb was null) answered a
  partial parse with "matched no symbol" — a false none-found. memoryStopExit now
  refuses them (exit 5, the guard's line), and --in=DIR after a crawl stop (a
  directory the crawl never reached read as "no indexed file"). A parse stop
  leaves the crawl whole, so --in still answers there.
- A multi-root workspace checks the hard limit after each root and stops before
  ingesting the next one (the post-merge check stays).
- The JSON map header of a cut ingest carries "counts_floor":true, the JSON twin
  of counts_floor, beside memory_stop.
- memory_parsed= counts claimed work-order slots: uncached files, then cached,
  then grammarless, each largest first — or path order when this process had
  already compiled every grammar query; a slot may reuse cached facts or fail to
  read. Legend, --help, comments and CHANGELOG say so; dictv moves to
  d5ae5ab63e5e0010 (showcase capture hand-corrected, COMMANDS.md regenerated),
  printf parity re-pinned (help_all only).

**File**: `CHANGELOG.md` (modified, +6/-2)
```diff
@@ -33,8 +33,12 @@ refuses a partial index, and past the limit itself — or when nothing was built
 with one line naming the limit and the override. The MCP server refuses a tool call over the limit by name and stays
 up; every answer from an index the guard cut carries `_memory_stop` in its envelope. A stop inside a verb's own
 secondary ingest that the verb does not read turns a CLI exit into 5 with one line, so it cannot pass as whole.
-A parse stop keeps every file it parsed — the first K of its parse order (cache misses first, then largest first) — so a
-partial map repeats for a given tree, cache and `memory_parsed=K`; stop messages name the line that was crossed (the
+A parse stop keeps every file it parsed — the first K slots of its work order it claimed (uncached files, then cached,
+then grammarless, each largest first; path order when the process had already compiled every grammar query; a slot
+may reuse cached facts or fail to read) — so a partial map repeats for a given tree, cache and `memory_parsed=K`, and
+its JSON header adds `counts_floor:true`. `--expand` and `--outline`, and `--in` after a crawl stop, refuse a partial
+index like the other verbs (a selector in an unparsed or uncrawled file would read as "no match"), and a multi-root
+workspace checks the hard limit after each root before ingesting the next; stop messages name the line that was crossed (the
 crawl line, an eighth of the limit; the parse line, half of it; or OS pressure), never the limit a soft stop did not
 reach. Nothing derived from a
 cut ingest is persisted: not the ingest cache, not the `--quality-delta` HEAD snapshot or churn-window body hashes,
```

**File**: `docs/COMMANDS.md` (modified, +5/-5)
```diff
@@ -1569,7 +1569,7 @@ $ ./build/ripwire . --outline=rankGraphTeleport --top-k=0
 ... [3 more line(s); run it to see the whole thing]
 ```
 
-**Shaped by:** `--top-k`, `--expand`, `--compress`, `--no-redact`, `--limit`
+**Shaped by:** `--top-k`, `--expand`, `--compress`, `--no-redact`, `--limit`, `--max-memory`
 
 ### `--expand=A,B,...`
 
@@ -4302,7 +4302,7 @@ $ ./build/ripwire . --rank-by=churn-decay --since=HEAD~7 --exclude=test --exclud
 ... [16 more line(s); run it to see the whole thing]
 ```
 
-**Shaped by:** `--external-surface`, `--doctor`, `--legend`
+**Shaped by:** `--external-surface`, `--doctor`, `--legend`, `--max-memory`
 
 **Caveats (stated by the binary):**
 
@@ -4389,7 +4389,7 @@ _The session legend dictionary the MCP server serves as ripwire://legend-dict/fu
 
 ```
 $ ./build/ripwire . --legend-dict
-ripwire legend dictionary ripwire.dict/v1 dictv=092cb7b055441d03 entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=d5ae5ab63e5e0010 entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
@@ -4684,15 +4684,15 @@ $ ./build/ripwire . --max-file-size=8K --top-k=3
 
 **Answers:** the memory guard's limit (default 65% of this machine's memory, env RIPWIRE_MAX_MEMORY) the memory guard is on for every run and silent on normal ones: it measures this process's footprint at most once per 5 s, from 5 s into an ingest.
 
-Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K files of its parse order, largest first, so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every other verb (--html and --mermaid included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
+Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K slots it claimed of its work order — uncached files first, largest first within a tier, or path order on a repeat ingest in one process — so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every other verb (--html, --mermaid, --expand, --outline and, after a crawl stop, --in included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
 
 **Shaped by:** `--mcp`
 
 **Caveats (stated by the binary):**
 
 - the memory guard's limit (default 65% of this machine's memory, env RIPWIRE_MAX_MEMORY) the memory guard is on for every run and silent on normal ones: it measures this process's footprint at most once per 5 s, from 5 s into an ingest.
 - Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was 
```

**File**: `docs/captures/COMMANDS_showcase_2026-09-14.md` (modified, +1/-1)
```diff
@@ -5351,7 +5351,7 @@ ripwire: --run-timeout=SECONDS modifies --run-trace — pass it too (e.g. ripwir
 *The session legend dictionary the MCP server serves as ripwire://legend-dict/full — one definition per line, headed by its dictv= version; no corpus needed. =roster lists the completeness attributes it defines.*
 
 `````
-ripwire legend dictionary ripwire.dict/v1 dictv=092cb7b055441d03 entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=d5ae5ab63e5e0010 entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
```

**File**: `src/cli.h` (modified, +5/-3)
```diff
@@ -2635,9 +2635,11 @@ inline constexpr char kHelpTail[] =
         "                               process's footprint at most once per 5 s, from 5 s into an ingest. Past its lines\n"
         "                               the crawl (growth of limit/8) or the parse (half the limit) stops, and the default\n"
         "                               map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=,\n"
-        "                               memory_limit=; a parse stop keeps the first K files of its parse order, largest first,\n"
-        "                               so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every\n"
-        "                               other verb (--html and --mermaid included) refuses a partial index, and so does any\n"
+        "                               memory_limit=; a parse stop keeps the first K slots it claimed of its work order —\n"
+        "                               uncached files first, largest first within a tier, or path order on a repeat ingest in\n"
+        "                               one process — so a partial map repeats for a given memory_parsed=K); critical OS pressure\n"
+        "                               stops them too. Every other verb (--html, --mermaid, --expand, --outline and, after a\n"
+        "                               crawl stop, --in included) refuses a partial index, and so does any\n"
         "                               verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one\n"
         "                               line naming it. Nothing derived from a partial ingest is cached. The\n"
         "                               default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag,\n"
```

**File**: `src/compactlegend.h` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ inline constexpr CompactCompletenessTerm kCompactCompletenessTerms[] =
     // #350 layer 3: the memory guard's stop (serialize.h buildMemoryStopAttr). Present only on a run the guard cut, so each
     // is a present-only header term; the readings avoid the flag's spelling because a legend is an XML comment.
     { "memory_stop",       "memory_stop=crawl|parse: the memory guard stopped that phase; files= and every count are floors of the tree", false, {}, MapHeaderRead::Only },
-    { "memory_parsed",     "memory_parsed=K: only the first K files of the parse order (largest first) parsed; the rest carry no symbols", false, {}, MapHeaderRead::Only },
+    { "memory_parsed",     "memory_parsed=K: the parse claimed the first K slots of its work order (uncached files, then cached, then grammarless, each largest first; path order when this process had already compiled every grammar query); a slot may reuse cached facts or fail to read; later files carry no symbols", false, {}, MapHeaderRead::Only },
     { "memory_limit",      "memory_limit=NM: the guard's limit, spelled as the max-memory value that raises it", false, {}, MapHeaderRead::Only },
     { "memory_pressure",   "memory_pressure=1: OS memory pressure stopped it, not the limit", false, {}, MapHeaderRead::Only },
     { "unindexed",         "unindexed=ext:N: N text files of that extension no grammar reads (6 extensions at most)", false, {}, MapHeaderRead::Only },
```

---

### Incident Patch 5: `01ecbe5e` (2026-09-28)
**Commit Message**: fix(#350): a real parse stop keeps every file it parsed; stop messages name the line crossed

Delta review D1: the sorted-prefix rule (6d4c4d8c) threw away nearly all parsed work on a REAL parse stop, because a cold
parse runs largest first and the unclaimed small files are spread through the sorted order (a 13,632-file tree at 900M
kept memory_parsed=1 instead of 2196). Reverted to the claimed-prefix rule: every claimed file completed, the parsed set
is the first K of the parse order (cache misses, then largest first, then fileId), and a partial map repeats for a
given K. Only the seam is exact: under parse:N a claim at work-order slot N or later is abandoned unparsed, so exactly N
are parsed. Legend: "memory_parsed=K: only the first K files of the parse order (largest first) parsed".

Messages name the cause: "at the crawl line (footprint growth of an eighth of the X limit)", "at the parse line (half
of the X limit)", or "under critical system memory pressure" — a soft stop with nothing built no longer says "memory
limit reached" for a limit it never reached. New additive seam eager:1 drops only the five-second time gate (real
readings, real lines, real cut rule), and gate arm (B

**File**: `CHANGELOG.md` (modified, +7/-4)
```diff
@@ -33,15 +33,18 @@ refuses a partial index, and past the limit itself — or when nothing was built
 with one line naming the limit and the override. The MCP server refuses a tool call over the limit by name and stays
 up; every answer from an index the guard cut carries `_memory_stop` in its envelope. A stop inside a verb's own
 secondary ingest that the verb does not read turns a CLI exit into 5 with one line, so it cannot pass as whole.
-A parse stop keeps the first K files of the SORTED list whose parse was claimed and drops the facts of any later file
-the pool reached first, so a partial map is a function of the tree and `memory_parsed=K` alone. Nothing derived from a
+A parse stop keeps every file it parsed — the first K of its parse order (cache misses first, then largest first) — so a
+partial map repeats for a given tree, cache and `memory_parsed=K`; stop messages name the line that was crossed (the
+crawl line, an eighth of the limit; the parse line, half of it; or OS pressure), never the limit a soft stop did not
+reach. Nothing derived from a
 cut ingest is persisted: not the ingest cache, not the `--quality-delta` HEAD snapshot or churn-window body hashes,
 and MCP `quality_baseline` refuses rather than pin a partial floor. Any verb whose own internal ingest was cut (a
 quality snapshot, `--index-out`) exits 5 with the line whatever code it chose, since a verdict or a refusal computed
 from a partial read is not one; `--html` and `--mermaid` refuse a partial index like every verb but the map; over MCP
 an internal cut adds `_memory_stop` to the answer or the guard's sentence to the error. A tool call over the limit
 first releases the resident index and re-reads the footprint, and only then refuses, saying the server must be
-restarted. The trip seam `RIPWIRE_TEST_MEMGUARD=crawl:N|pressure:N|parse:N|request:N` is additive — it only adds a
+restarted (a floor: on macOS the allocator may keep freed pages, so the re-read can stay over and a restart be needed;
+trimming the allocator is deferred). The trip seam `RIPWIRE_TEST_MEMGUARD=crawl:N|pressure:N|parse:N|request:N` is additive — it only adds a
 trip and never replaces a real reading, so it can make a run stricter, never unguarded — and it and
 `RIPWIRE_MAX_MEMORY` are cleared by `test/lib/clean-env.sh`. Gate: `test/memguardcheck.sh` (B)–(D), including a
 real-footprint arm (this repo's `src/` under `--max-memory=64M`), a warm-cache arm and a two-run snapshot arm.
@@ -66,7 +69,7 @@ MCP missing-path refusal; the server stays up. An MCP request's `path=` (or any
 way — an agent fills it from its session's directory, and the #350 incident was exactly `grep path=$HOME` — except the
 root the server was started on (`ripwire ~ --mcp` was typed by a human and is answered). The three hooks that pass the
 session directory to ripwire (`ripwire-claude-route.sh`, `ripwire-codex-route.sh`, `ripwire-claude-toolroute.sh`)
-exit silently, before any git or ripwire call, when that directory is `$HOME` (a dotfiles git repository included),
+exit silently, before any crawl (after one `git rev-parse` and one bare `ripwire` probe), when that directory is `$HOME` (a dotfiles git repository included),
 `/` or a system tree — they ask the binary (a bare `ripwire` run from that directory names it "no project root"),
 so there is one rule, not a second list. The LSP server's `initialize.rootUri` follows the same rule, except the root
 typed as `ripwire <root> --lsp`. Home is `$HOME` when it is an absolute path, else `USERPROFILE` (native Windows); a
```

**File**: `docs/COMMANDS.md` (modified, +2/-2)
```diff
@@ -4389,7 +4389,7 @@ _The session legend dictionary the MCP server serves as ripwire://legend-dict/fu
 
 ```
 $ ./build/ripwire . --legend-dict
-ripwire legend dictionary ripwire.dict/v1 dictv=c36ebba3a250c79d entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=092cb7b055441d03 entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
@@ -4684,7 +4684,7 @@ $ ./build/ripwire . --max-file-size=8K --top-k=3
 
 **Answers:** the memory guard's limit (default 65% of this machine's memory, env RIPWIRE_MAX_MEMORY) the memory guard is on for every run and silent on normal ones: it measures this process's footprint at most once per 5 s, from 5 s into an ingest.
 
-Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K files in sorted order, so a partial map repeats for a given memory_parsed=K); critical OS memory pressure stops them too. Every other verb (--html and --mermaid included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
+Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K files of its parse order, largest first, so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every other verb (--html and --mermaid included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
 
 **Shaped by:** `--mcp`
 
```

**File**: `docs/captures/COMMANDS_showcase_2026-09-14.md` (modified, +1/-1)
```diff
@@ -5351,7 +5351,7 @@ ripwire: --run-timeout=SECONDS modifies --run-trace — pass it too (e.g. ripwir
 *The session legend dictionary the MCP server serves as ripwire://legend-dict/full — one definition per line, headed by its dictv= version; no corpus needed. =roster lists the completeness attributes it defines.*
 
 `````
-ripwire legend dictionary ripwire.dict/v1 dictv=c36ebba3a250c79d entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=092cb7b055441d03 entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
```

**File**: `src/cli.h` (modified, +2/-2)
```diff
@@ -2635,8 +2635,8 @@ inline constexpr char kHelpTail[] =
         "                               process's footprint at most once per 5 s, from 5 s into an ingest. Past its lines\n"
         "                               the crawl (growth of limit/8) or the parse (half the limit) stops, and the default\n"
         "                               map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=,\n"
-        "                               memory_limit=; a parse stop keeps the first K files in sorted order, so a partial map\n"
-        "                               repeats for a given memory_parsed=K); critical OS memory pressure stops them too. Every\n"
+        "                               memory_limit=; a parse stop keeps the first K files of its parse order, largest first,\n"
+        "                               so a partial map repeats for a given memory_parsed=K); critical OS pressure stops them too. Every\n"
         "                               other verb (--html and --mermaid included) refuses a partial index, and so does any\n"
         "                               verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one\n"
         "                               line naming it. Nothing derived from a partial ingest is cached. The\n"
```

**File**: `src/compactlegend.h` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ inline constexpr CompactCompletenessTerm kCompactCompletenessTerms[] =
     // #350 layer 3: the memory guard's stop (serialize.h buildMemoryStopAttr). Present only on a run the guard cut, so each
     // is a present-only header term; the readings avoid the flag's spelling because a legend is an XML comment.
     { "memory_stop",       "memory_stop=crawl|parse: the memory guard stopped that phase; files= and every count are floors of the tree", false, {}, MapHeaderRead::Only },
-    { "memory_parsed",     "memory_parsed=K: only the first K of files= (sorted) parsed; the rest carry no symbols", false, {}, MapHeaderRead::Only },
+    { "memory_parsed",     "memory_parsed=K: only the first K files of the parse order (largest first) parsed; the rest carry no symbols", false, {}, MapHeaderRead::Only },
     { "memory_limit",      "memory_limit=NM: the guard's limit, spelled as the max-memory value that raises it", false, {}, MapHeaderRead::Only },
     { "memory_pressure",   "memory_pressure=1: OS memory pressure stopped it, not the limit", false, {}, MapHeaderRead::Only },
     { "unindexed",         "unindexed=ext:N: N text files of that extension no grammar reads (6 extensions at most)", false, {}, MapHeaderRead::Only },
```

---

### Incident Patch 6: `6d4c4d8c` (2026-09-28)
**Commit Message**: refactor(#350): the parse-cut decision leaves runParsePool (applyMemoryParseCut)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `src/ingest_parsepool.h` (modified, +37/-30)
```diff
@@ -743,6 +743,42 @@ inline void dropFactsFrom( RawFacts& raw, IngestFileScan& scan, std::size_t firs
     std::fill( scan.extractPartialBytes.begin() + std::ptrdiff_t( std::min( firstDropped, scan.extractPartialBytes.size() ) ), scan.extractPartialBytes.end(), 0u );
 }
 
+// #350: after the pool join, a memory-guard stop while files remained. The answer keeps the longest prefix of the SORTED
+// file list whose files were all claimed (every claimed file completed: workers look before claiming) and drops the facts
+// of any later file the work order reached first — so a partial answer depends on the tree and that prefix length alone,
+// never on which order the pool drew files in (memory_parsed= is the prefix length). The parse seam fixes the prefix at
+// N. A stop that came after the last claim cut nothing and is not a partial parse. Returns whether the parse was cut.
+inline bool applyMemoryParseCut( IngestResult& result, RawFacts& raw, IngestFileScan& scan, memguard::Watch* memWatch,
+                                 const std::vector<std::uint8_t>& claimedFlags )
+{
+    if( memWatch == nullptr || !memWatch->tripped() )
+    {
+        return false;
+    }
+    std::size_t keptPrefix = 0;
+    while( keptPrefix < claimedFlags.size() && claimedFlags[ keptPrefix ] != 0 )
+    {
+        ++keptPrefix;
+    }
+    keptPrefix = std::min( keptPrefix, memWatch->seamParseCutoff() );
+    if( keptPrefix >= claimedFlags.size() )
+    {
+        return false;
+    }
+    dropFactsFrom( raw, scan, keptPrefix );
+    result.memoryStop.limitBytes  = memWatch->hardBytes();
+    result.memoryStop.parsedFiles = static_cast<std::uint32_t>( keptPrefix );
+    if( memWatch->trippedByPressure() )
+    {
+        DISCLOSE( result.memoryStop, MemoryStop::DisclosureWhy::ParseUnderPressure, "ingest: the memory guard stopped the parse pool — the files after the kept sorted prefix carry no facts" );
+    }
+    else
+    {
+        DISCLOSE( result.memoryStop, MemoryStop::DisclosureWhy::ParseOverLimit, "ingest: the memory guard stopped the parse pool — the files after the kept sorted prefix carry no facts" );
+    }
+    return true;
+}
+
 inline RawFacts runParsePool( IngestResult& result, const char* rootDir, std::string_view cacheFile, bool captureValueUses,
                               HashMap<std::string, FileFacts>& cache, const CacheLoadStats& cacheStats,
                               IngestFileScan& scan, QueryPrewarm& prewarm, memguard::Watch* memWatch = nullptr )
@@ -900,36 +936,7 @@ inline RawFacts runParsePool( IngestResult& result, const char* rootDir, std::st
 
         raw = mergeThreadFacts( tFacts );
 
-        // #350: a stop while files remained. The answer keeps the longest prefix of the SORTED file list whose files
-        // were all claimed (every claimed file completed: workers look before claiming), and drops the facts of any
-        // later file the work order reached first — so a partial answer depends on the tree and that prefix length
-        // alone, never on which order the pool drew files in (memory_parsed= is the prefix length). The parse seam
-        // fixes the prefix at N. A stop that came after the last claim cut nothing and is not a partial parse.
-        std::size_t keptPrefix = nfiles;
-        if( memWatch != nullptr && memWatch->tripped() )
-        {
-            keptPrefix = 0;
-            while( keptPrefix < nfiles && claimedFlags[ keptPrefix ] != 0 )
-            {
-                ++keptPrefix;
-            }
-            keptPrefix = std::min( keptPrefix, memWatch->seamParseCutoff() );
-        }
-        const bool parseCut = keptPrefix < nfiles;
-        if( parseCut )
-        {
-            dropFactsFrom( raw, scan, keptPrefix );
-            result.memoryStop.limitBytes  = memWatch->hardBytes();
-            result.memoryStop.parsedFiles = static_cast<std::uint32_t>( keptPrefix );
-            if( memWatch->trippedByPressure() )
-            {
-                DISCLOSE( result.memor
```

---

### Incident Patch 7: `708e95fb` (2026-09-28)
**Commit Message**: fix(#350): the route hooks' root probe runs only inside a work tree; gitenvhermeticcheck pins the two guard variables

routehookcheck O11 holds that a route hook never calls ripwire outside a git work tree; the bare `ripwire` rule probe
now follows the work-tree test (a home directory that is a dotfiles repository is still caught — it is a work tree).
gitenvhermeticcheck (C) pins test/lib/clean-env.sh's list, which gained RIPWIRE_MAX_MEMORY and RIPWIRE_TEST_MEMGUARD.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `hooks/ripwire-claude-route.sh` (modified, +8/-7)
```diff
@@ -338,13 +338,6 @@ command -v ripwire >/dev/null 2>&1 || exit 0
 prompt="$( printf '%s' "$input" | jq -r '.prompt // .user_prompt // .input // empty' 2>/dev/null )"
 cwd="$( printf '%s' "$input" | jq -r '.cwd // .workdir // empty' 2>/dev/null )"
 [ -n "$prompt" ] && [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
-# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
-# dotfiles repository makes $HOME a work tree), so a background hook never crawls one: exit silently. The rule is the
-# binary's own (src/rootguard.h), not a second list here — run from that directory with no root, ripwire answers
-# "no project root" for exactly those directories and prints its plain usage anywhere else. One exec, no crawl.
-if ( cd "$cwd" 2>/dev/null && ripwire 2>&1 >/dev/null ) | grep -q 'no project root'; then
-    exit 0
-fi
 # Route only inside a git work tree (issue #327). Outside one `--help-task` has no file list from git and
 # walks the whole tree under cwd: a session started in $HOME measured over 30 s for one prompt, past the
 # 8 s hook timeout the installer registers, on every prompt. The cost is routing in a small non-git
@@ -359,6 +352,14 @@ fi
 unset $( git rev-parse --local-env-vars 2>/dev/null ) GIT_DIR GIT_WORK_TREE
 insideWorkTree="$( git -C "$cwd" rev-parse --is-inside-work-tree 2>/dev/null )" || exit 0
 [ "$insideWorkTree" = true ] || exit 0
+# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
+# dotfiles repository makes $HOME a work tree), so a background hook never crawls one: exit silently. The rule is the
+# binary's own (src/rootguard.h), not a second list here — run from that directory with no root, ripwire answers
+# "no project root" for exactly those directories and prints its plain usage anywhere else. One exec, no crawl, and
+# only inside a work tree: it follows the test above, so a non-git cwd never reaches even this bare call.
+if ( cd "$cwd" 2>/dev/null && ripwire 2>&1 >/dev/null ) | grep -q 'no project root'; then
+    exit 0
+fi
 session="$( printf '%s' "$input" | jq -r '.session_id // .conversation_id // empty' 2>/dev/null )"
 
 # A very long prompt is a paste, not a task description, and `--help-task` is not built to read one.
```

**File**: `hooks/ripwire-codex-route.sh` (modified, +8/-7)
```diff
@@ -256,13 +256,6 @@ command -v ripwire >/dev/null 2>&1 || exit 0
 prompt="$( printf '%s' "$input" | jq -r '.prompt // .user_prompt // .input // empty' 2>/dev/null )"
 cwd="$( printf '%s' "$input" | jq -r '.cwd // .workdir // empty' 2>/dev/null )"
 [ -n "$prompt" ] && [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
-# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
-# dotfiles repository makes $HOME a work tree), so a background hook never crawls one: exit silently. The rule is the
-# binary's own (src/rootguard.h), not a second list here — run from that directory with no root, ripwire answers
-# "no project root" for exactly those directories and prints its plain usage anywhere else. One exec, no crawl.
-if ( cd "$cwd" 2>/dev/null && ripwire 2>&1 >/dev/null ) | grep -q 'no project root'; then
-    exit 0
-fi
 # Route only inside a git work tree (issue #327). Outside one `--help-task` has no file list from git and
 # walks the whole tree under cwd: a session started in $HOME measured over 30 s for one prompt, on every
 # prompt. The cost is routing in a small non-git project too; a missed recommendation is the direction
@@ -277,6 +270,14 @@ fi
 unset $( git rev-parse --local-env-vars 2>/dev/null ) GIT_DIR GIT_WORK_TREE
 insideWorkTree="$( git -C "$cwd" rev-parse --is-inside-work-tree 2>/dev/null )" || exit 0
 [ "$insideWorkTree" = true ] || exit 0
+# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
+# dotfiles repository makes $HOME a work tree), so a background hook never crawls one: exit silently. The rule is the
+# binary's own (src/rootguard.h), not a second list here — run from that directory with no root, ripwire answers
+# "no project root" for exactly those directories and prints its plain usage anywhere else. One exec, no crawl, and
+# only inside a work tree: it follows the test above, so a non-git cwd never reaches even this bare call.
+if ( cd "$cwd" 2>/dev/null && ripwire 2>&1 >/dev/null ) | grep -q 'no project root'; then
+    exit 0
+fi
 session="$( printf '%s' "$input" | jq -r '.session_id // .conversation_id // empty' 2>/dev/null )"
 
 promptBytes="$( printf '%s' "$prompt" | wc -c | tr -d ' ' )"
```

**File**: `test/gitenvhermeticcheck.sh` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ done
 echo
 echo "=== (C) THE LIST: the helper clears exactly the pinned names ==="
 # ═══════════════════════════════════════════════════════════════════════════
-PINNED="AGENTS_HOME CLAUDE_CONFIG_DIR CODEX_HOME GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_PREFIX GIT_WORK_TREE HERMES_HOME RIPWIRE_DATA_HOME"
+PINNED="AGENTS_HOME CLAUDE_CONFIG_DIR CODEX_HOME GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_PREFIX GIT_WORK_TREE HERMES_HOME RIPWIRE_DATA_HOME RIPWIRE_MAX_MEMORY RIPWIRE_TEST_MEMGUARD"
 DERIVED="$( grep -E '^unset ' "$HELPER" | sed 's/^unset //' | tr ' ' '\n' | grep -v '^$' | LC_ALL=C sort | tr '\n' ' ' | sed 's/ *$//' )"
 [ "$DERIVED" = "$PINNED" ] \
     && ok "(C) the helper's unset lines name exactly the pinned set ($( printf '%s' "$PINNED" | wc -w | tr -d ' ' ) variables, both families)" \
```

---

### Incident Patch 8: `dcf8df42` (2026-09-28)
**Commit Message**: fix(#350): review round — nothing derived from a cut ingest persists, additive seam, one root rule everywhere

B1: computeHeadSnapshot / computeWindowRefBodyHashes take the no-snapshot path on a cut ingest (never written as the
qsnap/qbody), and MCP quality_baseline refuses rather than pin a partial floor. B2: the CLI backstop turns ANY exit
into 5 with its line when a stop went unanswered (a verdict or refusal from a partial read is not one); over MCP a
stop recorded during a request adds _memory_stop to the answer or the guard's sentence to the error. B3: gate arms
that can fail — the real footprint (src/ under --max-memory=64M, no seam) and a warm-cache parse stop. B4: the
RIPWIRE_TEST_MEMGUARD seam is additive (base footprint, time gate and hard line always on; it only adds a trip), and
clean-env.sh clears it and RIPWIRE_MAX_MEMORY.

S1: a parse stop keeps the first K files of the SORTED list whose parse was claimed and drops later facts, so a partial
map repeats for a given memory_parsed=K (the seam fixes K=N; five-run byte-identity arm). S2: an MCP call over the
limit releases the resident index and re-reads once before refusing, then says restart the server. S3: --html and
-

**File**: `CHANGELOG.md` (modified, +25/-5)
```diff
@@ -33,9 +33,24 @@ refuses a partial index, and past the limit itself — or when nothing was built
 with one line naming the limit and the override. The MCP server refuses a tool call over the limit by name and stays
 up; every answer from an index the guard cut carries `_memory_stop` in its envelope. A stop inside a verb's own
 secondary ingest that the verb does not read turns a CLI exit into 5 with one line, so it cannot pass as whole.
-Gate: `test/memguardcheck.sh` (B)–(D), driven by the `RIPWIRE_TEST_MEMGUARD=crawl:N|parse:N|request:N` trip seam.
-Deferred: layer 2 (the non-git crawl budget and default heavy-directory pruning) and calibrating the lines against
-llvm-project's measured peak; the per-phase check inside the graph build (main.cpp checks between phases only).
+A parse stop keeps the first K files of the SORTED list whose parse was claimed and drops the facts of any later file
+the pool reached first, so a partial map is a function of the tree and `memory_parsed=K` alone. Nothing derived from a
+cut ingest is persisted: not the ingest cache, not the `--quality-delta` HEAD snapshot or churn-window body hashes,
+and MCP `quality_baseline` refuses rather than pin a partial floor. Any verb whose own internal ingest was cut (a
+quality snapshot, `--index-out`) exits 5 with the line whatever code it chose, since a verdict or a refusal computed
+from a partial read is not one; `--html` and `--mermaid` refuse a partial index like every verb but the map; over MCP
+an internal cut adds `_memory_stop` to the answer or the guard's sentence to the error. A tool call over the limit
+first releases the resident index and re-reads the footprint, and only then refuses, saying the server must be
+restarted. The trip seam `RIPWIRE_TEST_MEMGUARD=crawl:N|pressure:N|parse:N|request:N` is additive — it only adds a
+trip and never replaces a real reading, so it can make a run stricter, never unguarded — and it and
+`RIPWIRE_MAX_MEMORY` are cleared by `test/lib/clean-env.sh`. Gate: `test/memguardcheck.sh` (B)–(D), including a
+real-footprint arm (this repo's `src/` under `--max-memory=64M`), a warm-cache arm and a two-run snapshot arm.
+Known floors: the cgroup limit read is the v2 leaf `memory.max` only — a limit on an ancestor (a systemd slice's
+`MemoryMax`) and cgroup v1 fall back to physical RAM; `HOME` unset (no `USERPROFILE` either) means no home directory is
+recognised; `--legend=full` (the frozen 0.6.1 prose) does not define the `memory_*` attributes; the LSP server answers
+from a partial index without disclosure. Deferred: layer 2 (the non-git crawl budget and default heavy-directory
+pruning), calibrating the lines against llvm-project's measured peak (on an 8 GB machine the 5.2 GB limit is below
+llvm-project's 6.0 GB cold peak), and checks inside the ingest tail and the graph build (between phases only today).
 
 ### Fixed — a root nobody chose is not crawled when it is a home or system directory (#350, layer 1)
 
@@ -52,8 +67,13 @@ way — an agent fills it from its session's directory, and the #350 incident wa
 root the server was started on (`ripwire ~ --mcp` was typed by a human and is answered). The three hooks that pass the
 session directory to ripwire (`ripwire-claude-route.sh`, `ripwire-codex-route.sh`, `ripwire-claude-toolroute.sh`)
 exit silently, before any git or ripwire call, when that directory is `$HOME` (a dotfiles git repository included),
-`/` or a system tree. A root typed on the CLI (`ripwire ~`) is always answered, under the memory guard, and
-subdirectories are ordinary directories. Gate: `test/memguardcheck.sh` (A).
+`/` or a system tree — they ask the binary (a bare `ripwire` run from that directory names it "no project root"),
+so there is one rule, not a second list. The LSP server's `initialize.rootUri` follows the same rule, except the root
+typed as `ripwire <root> --lsp`. Home is `$HOME` when it is an absolute path, else `USERPROFILE` (native Windows); a
+relative `HOME` is ignored. Canonical 
```

**File**: `docs/COMMANDS.md` (modified, +6/-6)
```diff
@@ -620,7 +620,7 @@ $ ./build/ripwire . --html=<scratch>/aux/map2.html
 (empty)
 ```
 
-**Shaped by:** `--color-by`, `--legend`
+**Shaped by:** `--color-by`, `--legend`, `--max-memory`
 
 **Caveats (stated by the binary):**
 
@@ -2733,7 +2733,7 @@ flowchart LR
 ... [17 more line(s); run it to see the whole thing]
 ```
 
-**Shaped by:** `--zoom`, `--with-graph`, `--legend`, `--limit`
+**Shaped by:** `--zoom`, `--with-graph`, `--legend`, `--limit`, `--max-memory`
 
 ### `--owners[=SYM]`
 
@@ -4389,7 +4389,7 @@ _The session legend dictionary the MCP server serves as ripwire://legend-dict/fu
 
 ```
 $ ./build/ripwire . --legend-dict
-ripwire legend dictionary ripwire.dict/v1 dictv=272714e090680fb2 entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=c36ebba3a250c79d entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
@@ -4684,15 +4684,15 @@ $ ./build/ripwire . --max-file-size=8K --top-k=3
 
 **Answers:** the memory guard's limit (default 65% of this machine's memory, env RIPWIRE_MAX_MEMORY) the memory guard is on for every run and silent on normal ones: it measures this process's footprint at most once per 5 s, from 5 s into an ingest.
 
-Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=); critical OS memory pressure stops them too. Every other verb refuses a partial index, and at the limit itself ripwire exits 5 with one line naming it. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
+Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=; a parse stop keeps the first K files in sorted order, so a partial map repeats for a given memory_parsed=K); critical OS memory pressure stops them too. Every other verb (--html and --mermaid included) refuses a partial index, and so does any verb whose own internal ingest was cut; at the limit itself ripwire exits 5 with one line naming it. Nothing derived from a partial ingest is cached. The default is 65% of physical RAM (or of the cgroup's memory.max when lower); this flag, or RIPWIRE_MAX_MEMORY when the flag is absent, replaces it; below 64M is refused.
 
 **Shaped by:** `--mcp`
 
 **Caveats (stated by the binary):**
 
 - the memory guard's limit (default 65% of this machine's memory, env RIPWIRE_MAX_MEMORY) the memory guard is on for every run and silent on normal ones: it measures this process's footprint at most once per 5 s, from 5 s into an ingest.
-- Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=);
-- Every other verb refuses a partial index, and at the limit itself ripwire exits 5 with one line naming it.
+- Past its lines the crawl (growth of limit/8) or the parse (half the limit) stops, and the default map answers from what was built, disclosed in its header (memory_stop=, memory_parsed=, memory_limit=;
+- Every other verb (--html and --mermaid included) refuses a partial index, and so does any verb whose own internal ingest was cut;
 
 ### `--refetch`
 
```

**File**: `docs/captures/COMMANDS_showcase_2026-09-14.md` (modified, +1/-1)
```diff
@@ -5351,7 +5351,7 @@ ripwire: --run-timeout=SECONDS modifies --run-trace — pass it too (e.g. ripwir
 *The session legend dictionary the MCP server serves as ripwire://legend-dict/full — one definition per line, headed by its dictv= version; no corpus needed. =roster lists the completeness attributes it defines.*
 
 `````
-ripwire legend dictionary ripwire.dict/v1 dictv=272714e090680fb2 entries=730
+ripwire legend dictionary ripwire.dict/v1 dictv=c36ebba3a250c79d entries=730
 <about legend="ref" dict= dictv=>: the answer's rows come first; its root keeps only task= changed= from= to=, and this LAST child carries every other root attribute unchanged (schema= included); legend="ref": a definition is sent once per session (this dictionary's core, or the first answer that ne … [line truncated: 83 more bytes on this line]
 schema=ripwire.KEY/v1: the line ripwire.KEY/v1 below reads the answer's rows
 window: shown= total= capped= has_more= next_offset= offset= limit= page a list (capped=1 cut; next_offset= pastes as offset=)
```

**File**: `hooks/ripwire-claude-route.sh` (modified, +6/-9)
```diff
@@ -339,15 +339,12 @@ prompt="$( printf '%s' "$input" | jq -r '.prompt // .user_prompt // .input // em
 cwd="$( printf '%s' "$input" | jq -r '.cwd // .workdir // empty' 2>/dev/null )"
 [ -n "$prompt" ] && [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
 # #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
-# dotfiles repository makes $HOME a work tree). A background hook never crawls one: exit silently, before any git or
-# ripwire call. Only the directory itself — a project below it is routed as usual. The list is src/infra/os.h's
-# path_is_system_dir, trimmed to the names a cwd can plausibly be.
-cwdReal="$( cd "$cwd" 2>/dev/null && pwd -P )" || exit 0
-homeReal="$( cd "${HOME:-/nonexistent-home}" 2>/dev/null && pwd -P )"
-[ -n "$homeReal" ] && [ "$cwdReal" = "$homeReal" ] && exit 0
-case "$cwdReal" in
-    /|/System|/Library|/Applications|/Users|/Volumes|/usr|/usr/local|/usr/lib|/usr/share|/bin|/sbin|/opt|/etc|/tmp|/var|/dev|/private|/private/etc|/private/tmp|/private/var|/home|/root|/proc|/sys|/srv|/mnt|/media|/run|/snap|/nix|/nix/store|/boot|/lib|/lib64) exit 0 ;;
-esac
+# dotfiles repository makes $HOME a work tree), so a background hook never crawls one: exit silently. The rule is the
+# binary's own (src/rootguard.h), not a second list here — run from that directory with no root, ripwire answers
+# "no project root" for exactly those directories and prints its plain usage anywhere else. One exec, no crawl.
+if ( cd "$cwd" 2>/dev/null && ripwire 2>&1 >/dev/null ) | grep -q 'no project root'; then
+    exit 0
+fi
 # Route only inside a git work tree (issue #327). Outside one `--help-task` has no file list from git and
 # walks the whole tree under cwd: a session started in $HOME measured over 30 s for one prompt, past the
 # 8 s hook timeout the installer registers, on every prompt. The cost is routing in a small non-git
```

**File**: `hooks/ripwire-claude-toolroute.sh` (modified, +6/-9)
```diff
@@ -100,15 +100,12 @@ cwd="$( printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null )"
 session="$( printf '%s' "$input" | jq -r '.session_id // .conversation_id // empty' 2>/dev/null )"
 [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
 # #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
-# dotfiles repository makes $HOME a work tree). A background hook never crawls one: exit silently, before any git or
-# ripwire call. Only the directory itself — a project below it is routed as usual. The list is src/infra/os.h's
-# path_is_system_dir, trimmed to the names a cwd can plausibly be.
-cwdReal="$( cd "$cwd" 2>/dev/null && pwd -P )" || exit 0
-homeReal="$( cd "${HOME:-/nonexistent-home}" 2>/dev/null && pwd -P )"
-[ -n "$homeReal" ] && [ "$cwdReal" = "$homeReal" ] && exit 0
-case "$cwdReal" in
-    /|/System|/Library|/Applications|/Users|/Volumes|/usr|/usr/local|/usr/lib|/usr/share|/bin|/sbin|/opt|/etc|/tmp|/var|/dev|/private|/private/etc|/private/tmp|/private/var|/home|/root|/proc|/sys|/srv|/mnt|/media|/run|/snap|/nix|/nix/store|/boot|/lib|/lib64) exit 0 ;;
-esac
+# dotfiles repository makes $HOME a work tree), so a background hook never crawls one: exit silently. The rule is the
+# binary's own (src/rootguard.h), not a second list here — run from that directory with no root, ripwire answers
+# "no project root" for exactly those directories and prints its plain usage anywhere else. One exec, no crawl.
+if ( cd "$cwd" 2>/dev/null && ripwire 2>&1 >/dev/null ) | grep -q 'no project root'; then
+    exit 0
+fi
 # The hook answers for the JSON cwd, so git's repository-selection variables inherited from the caller are
 # cleared first, as the two route hooks do (git's own list, plus GIT_DIR/GIT_WORK_TREE if git cannot print
 # it). With GIT_DIR exported, `git -C "$cwd" rev-parse --show-toplevel` prints a non-git cwd as its own top
```

---

### Incident Patch 9: `24d72f9f` (2026-09-28)
**Commit Message**: fix(#350 layer 1): refuse an MCP path= that is $HOME or a system dir; background hooks skip them

The #350 incident was an agent calling grep with path=$HOME: an agent fills path= from its session's cwd, so over MCP
that path is no more a human's choice than the launch directory. A request whose path= (or any root of a `paths`
workspace) canonicalizes to $HOME itself, a filesystem/drive root or a system tree is now refused with the implicit
case's sentence ("no project root: <dir> is a home/system directory; pass a project path"), and the server stays up.
The exception is the root the server was started on (`ripwire <root> --mcp`, or the --listen workspace): a human
typed it, and it is answered. The three hooks that pass the session cwd to ripwire (ripwire-claude-route.sh,
ripwire-codex-route.sh, ripwire-claude-toolroute.sh) exit 0 silently, before any git or ripwire call, when that cwd
is $HOME (a dotfiles git repository included), / or a system tree. A root typed on the CLI (`ripwire ~`) is
unchanged: answered, under the memory guard.

memguardcheck gains (A8) MCP path=$HOME / "/" / /dev / a paths workspace holding $HOME / a git-repo $HOME refused,
(A9) path=$HOME and a path-less

**File**: `CHANGELOG.md` (modified, +7/-2)
```diff
@@ -47,8 +47,13 @@ positional root — is refused when it is `$HOME` itself (a dotfiles git reposit
 root, the parent of the home directories, or an operating-system tree (`/System`, `/usr`, `/etc`, `/proc`,
 `%WINDIR%`, Program Files …; `os::path_is_system_dir`). The refusal is one line — `no project root: <dir> is a
 home/system directory; pass a project path` — on the CLI (exit 1, in place of the usage text) and appended to the
-MCP missing-path refusal; the server stays up. An explicit root is always honoured (`ripwire ~`, `ripwire <root>
---mcp`, a request's `path=`), and subdirectories are ordinary directories. Gate: `test/memguardcheck.sh` (A).
+MCP missing-path refusal; the server stays up. An MCP request's `path=` (or any root of `paths`) is judged the same
+way — an agent fills it from its session's directory, and the #350 incident was exactly `grep path=$HOME` — except the
+root the server was started on (`ripwire ~ --mcp` was typed by a human and is answered). The three hooks that pass the
+session directory to ripwire (`ripwire-claude-route.sh`, `ripwire-codex-route.sh`, `ripwire-claude-toolroute.sh`)
+exit silently, before any git or ripwire call, when that directory is `$HOME` (a dotfiles git repository included),
+`/` or a system tree. A root typed on the CLI (`ripwire ~`) is always answered, under the memory guard, and
+subdirectories are ordinary directories. Gate: `test/memguardcheck.sh` (A).
 
 ### Fixed — the Linux G1 sanitizer ritual completes: five string_view comparator lambdas stop wrapping, and the GCC ASan path builds (#342)
 
```

**File**: `docs/COMMANDS.md` (modified, +2/-2)
```diff
@@ -4756,7 +4756,7 @@ $ ./build/ripwire . --pin-census=<scratch>/aux/pin_census.tsv --top-k=3
 
 **Answers:** persistent index server (parse once, many warm queries) over stdio persistent index server over stdio.
 
-Roots: `ripwire <root> --mcp` and a request's path= are EXPLICIT and always answered. With neither, a request answers about the directory the server was launched in — unless that directory is $HOME itself (a git repository or not), a filesystem or drive root, or a system tree (/usr, /etc, /System, %WINDIR% ...): then the request is refused with "no project root: <dir> is a home/system directory; pass a project path" and the server stays up. The CLI has no implicit root (a run without <dir> prints usage, or that same line from such a directory). Each tool call over the --max-memory limit is refused by name; an answer from an index the memory guard cut carries _memory_stop in its envelope.
+Roots: a request's path= (or `paths`), else the startup root of `ripwire <root> --mcp`, else the directory the server was launched in. A root that is $HOME itself (a git repository or not), a filesystem or drive root, or a system tree (/usr, /etc, /System, %WINDIR% ...) is refused with "no project root: <dir> is a home/system directory; pass a project path" and the server stays up — an agent fills path= from its session's cwd, so it is judged like the launch directory. The one exception is the startup root itself: `ripwire ~ --mcp` was typed by a human and is answered. On the CLI a typed root (`ripwire ~`) is always answered, and a run without <dir> prints usage, or that same line from such a directory. Each tool call over the --max-memory limit is refused by name; an answer from an index the memory guard cut carries _memory_stop in its envelope.
 
 **Try it**
 
@@ -4775,7 +4775,7 @@ $ ./build/ripwire '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize"}' '{"jso
 
 **Caveats (stated by the binary):**
 
-- With neither, a request answers about the directory the server was launched in — unless that directory is $HOME itself (a git repository or not), a filesystem or drive root, or a system tree (/usr, /etc, /System, %WINDIR% ...): then the request is refused with "no project root: <dir> is a home/system directory;
+- A root that is $HOME itself (a git repository or not), a filesystem or drive root, or a system tree (/usr, /etc, /System, %WINDIR% ...) is refused with "no project root: <dir> is a home/system directory;
 - Each tool call over the --max-memory limit is refused by name;
 
 ### `--lsp`
```

**File**: `hooks/ripwire-claude-route.sh` (modified, +10/-0)
```diff
@@ -338,6 +338,16 @@ command -v ripwire >/dev/null 2>&1 || exit 0
 prompt="$( printf '%s' "$input" | jq -r '.prompt // .user_prompt // .input // empty' 2>/dev/null )"
 cwd="$( printf '%s' "$input" | jq -r '.cwd // .workdir // empty' 2>/dev/null )"
 [ -n "$prompt" ] && [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
+# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
+# dotfiles repository makes $HOME a work tree). A background hook never crawls one: exit silently, before any git or
+# ripwire call. Only the directory itself — a project below it is routed as usual. The list is src/infra/os.h's
+# path_is_system_dir, trimmed to the names a cwd can plausibly be.
+cwdReal="$( cd "$cwd" 2>/dev/null && pwd -P )" || exit 0
+homeReal="$( cd "${HOME:-/nonexistent-home}" 2>/dev/null && pwd -P )"
+[ -n "$homeReal" ] && [ "$cwdReal" = "$homeReal" ] && exit 0
+case "$cwdReal" in
+    /|/System|/Library|/Applications|/Users|/Volumes|/usr|/usr/local|/usr/lib|/usr/share|/bin|/sbin|/opt|/etc|/tmp|/var|/dev|/private|/private/etc|/private/tmp|/private/var|/home|/root|/proc|/sys|/srv|/mnt|/media|/run|/snap|/nix|/nix/store|/boot|/lib|/lib64) exit 0 ;;
+esac
 # Route only inside a git work tree (issue #327). Outside one `--help-task` has no file list from git and
 # walks the whole tree under cwd: a session started in $HOME measured over 30 s for one prompt, past the
 # 8 s hook timeout the installer registers, on every prompt. The cost is routing in a small non-git
```

**File**: `hooks/ripwire-claude-toolroute.sh` (modified, +10/-0)
```diff
@@ -99,6 +99,16 @@ esac
 cwd="$( printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null )"
 session="$( printf '%s' "$input" | jq -r '.session_id // .conversation_id // empty' 2>/dev/null )"
 [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
+# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
+# dotfiles repository makes $HOME a work tree). A background hook never crawls one: exit silently, before any git or
+# ripwire call. Only the directory itself — a project below it is routed as usual. The list is src/infra/os.h's
+# path_is_system_dir, trimmed to the names a cwd can plausibly be.
+cwdReal="$( cd "$cwd" 2>/dev/null && pwd -P )" || exit 0
+homeReal="$( cd "${HOME:-/nonexistent-home}" 2>/dev/null && pwd -P )"
+[ -n "$homeReal" ] && [ "$cwdReal" = "$homeReal" ] && exit 0
+case "$cwdReal" in
+    /|/System|/Library|/Applications|/Users|/Volumes|/usr|/usr/local|/usr/lib|/usr/share|/bin|/sbin|/opt|/etc|/tmp|/var|/dev|/private|/private/etc|/private/tmp|/private/var|/home|/root|/proc|/sys|/srv|/mnt|/media|/run|/snap|/nix|/nix/store|/boot|/lib|/lib64) exit 0 ;;
+esac
 # The hook answers for the JSON cwd, so git's repository-selection variables inherited from the caller are
 # cleared first, as the two route hooks do (git's own list, plus GIT_DIR/GIT_WORK_TREE if git cannot print
 # it). With GIT_DIR exported, `git -C "$cwd" rev-parse --show-toplevel` prints a non-git cwd as its own top
```

**File**: `hooks/ripwire-codex-route.sh` (modified, +10/-0)
```diff
@@ -256,6 +256,16 @@ command -v ripwire >/dev/null 2>&1 || exit 0
 prompt="$( printf '%s' "$input" | jq -r '.prompt // .user_prompt // .input // empty' 2>/dev/null )"
 cwd="$( printf '%s' "$input" | jq -r '.cwd // .workdir // empty' 2>/dev/null )"
 [ -n "$prompt" ] && [ -n "$cwd" ] && [ -d "$cwd" ] || exit 0
+# #350: a home directory, a filesystem root or a system tree is nobody's project, whatever git says about it (a
+# dotfiles repository makes $HOME a work tree). A background hook never crawls one: exit silently, before any git or
+# ripwire call. Only the directory itself — a project below it is routed as usual. The list is src/infra/os.h's
+# path_is_system_dir, trimmed to the names a cwd can plausibly be.
+cwdReal="$( cd "$cwd" 2>/dev/null && pwd -P )" || exit 0
+homeReal="$( cd "${HOME:-/nonexistent-home}" 2>/dev/null && pwd -P )"
+[ -n "$homeReal" ] && [ "$cwdReal" = "$homeReal" ] && exit 0
+case "$cwdReal" in
+    /|/System|/Library|/Applications|/Users|/Volumes|/usr|/usr/local|/usr/lib|/usr/share|/bin|/sbin|/opt|/etc|/tmp|/var|/dev|/private|/private/etc|/private/tmp|/private/var|/home|/root|/proc|/sys|/srv|/mnt|/media|/run|/snap|/nix|/nix/store|/boot|/lib|/lib64) exit 0 ;;
+esac
 # Route only inside a git work tree (issue #327). Outside one `--help-task` has no file list from git and
 # walks the whole tree under cwd: a session started in $HOME measured over 30 s for one prompt, on every
 # prompt. The cost is routing in a small non-git project too; a missed recommendation is the direction
```

---

### Incident Patch 10: `cc21d94e` (2026-09-28)
**Commit Message**: fix(#350): full-suite follow-ups — skill home, capture coverage, printf pin, clean-env, public-name sweep

skills/ripwire-mcp names the three new signals ("no project root", "memory limit reached", _memory_stop) and the
override; the showcase capture's Not-run sentence lists --max-memory (hand-corrected, not re-recorded); the printf
parity manifest re-pinned for --help / --help=all only (the new flag's rows and the --mcp roots paragraph);
memguardcheck sources test/lib/clean-env.sh; the Windows system-directory list drops ProgramW6432 (ProgramFiles
names the same directory on a native 64-bit process).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `docs/captures/COMMANDS_showcase_2026-09-14.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 
 **How to read the blocks:** ripwire's real XML output is minified — often ONE long line. For scanability, long minified lines are displayed re-wrapped with a line break at every tag seam (`><`). Header COMMENT lines (the legends) always appear in full — they are exempt from the per-line cut; any OTHER display line over 300 bytes is cut with a `… [line truncated: N more bytes]` marker, which can hit a long root element or row. `--plan-lanes` emits JSON and is re-wrapped at object seams the same way. Long outputs are cut to their first ~30 display lines with a `… [N more display lines; full output is M bytes]` marker giving the true size. Exit codes are recorded when non-zero; wall time when >1s.
 
-**Not run (and why):** `ripwire <git-url>` (network clone), `--listen` / `--mcp-token` / `--allow-remote-edits` (the HTTP-server posture; `--mcp` itself IS captured in its own section as a one-shot stdio JSON-RPC exchange, and `wrap claude` shows the wiring), `--arch --baseline[-update]` (state writer against the read-only repo — `--note-add` / `--quality-baseline` / `--quality-ack` / the three edit verbs / `--edit-plan` ARE shown, inside the throwaway sandbox clone; `--index-out` / `--pin-census` write to scratch), `--eval-mined` (needs a `minedpair.jsonl` artifact from `bench/mine_traces.py`; none present in the tree), `--refetch` (git-url only), `--lsp` (the editor transport — its one-shot dialogues are gated by `test/lspcheck.sh`, not by showcase blocks), `--sections` (added after this capture was recorded — its stub and restore shapes are gated by `test/forsectioncollapsecheck.sh` until the next capture), `--force` (wrap-only modifier), `--scan-skills` bare form (would sweep `~/.claude/skills`; the explicit-DIR form is shown instead), `--help` (198 lines — read it from the binary).
+**Not run (and why):** `ripwire <git-url>` (network clone), `--listen` / `--mcp-token` / `--allow-remote-edits` (the HTTP-server posture; `--mcp` itself IS captured in its own section as a one-shot stdio JSON-RPC exchange, and `wrap claude` shows the wiring), `--arch --baseline[-update]` (state writer against the read-only repo — `--note-add` / `--quality-baseline` / `--quality-ack` / the three edit verbs / `--edit-plan` ARE shown, inside the throwaway sandbox clone; `--index-out` / `--pin-census` write to scratch), `--eval-mined` (needs a `minedpair.jsonl` artifact from `bench/mine_traces.py`; none present in the tree), `--refetch` (git-url only), `--lsp` (the editor transport — its one-shot dialogues are gated by `test/lspcheck.sh`, not by showcase blocks), `--sections` (added after this capture was recorded — its stub and restore shapes are gated by `test/forsectioncollapsecheck.sh` until the next capture), `--force` (wrap-only modifier), `--scan-skills` bare form (would sweep `~/.claude/skills`; the explicit-DIR form is shown instead), `--max-memory` (added after this capture was recorded; the memory guard is silent on this repo by construction, and its stops are gated by `test/memguardcheck.sh`), `--help` (198 lines — read it from the binary).
 
 
 ---
```

**File**: `skills/ripwire-mcp/SKILL.md` (modified, +8/-0)
```diff
@@ -66,6 +66,14 @@ Codex hook roles, and the configured `mcp_servers.ripwire` command plus `--mcp`
 the exact installer/wrap repair command. The report deliberately emits no config contents or full shell
 commands, so it is safe to paste for diagnosis; `--agent=codex` alone refuses because it modifies doctor.
 
+### "no project root" / "memory limit reached" / `_memory_stop`
+
+A server started in `$HOME`, `/` or a system directory assumes no root: pass `path=` (or start it as
+`ripwire <repo> --mcp`). A tool call refused with "memory limit reached", or an answer carrying `_memory_stop`
+in its envelope, means the memory guard cut or refused the work on a tree too large for the machine: point
+`path=` at a smaller root, or raise the limit with `--max-memory=<N>[K|M|G]` (or `RIPWIRE_MAX_MEMORY`) on the
+server's command line. The default (65% of RAM) is silent on real projects.
+
 ## The read verbs + fetch_body (and when each beats the CLI form)
 
 Every verb takes `path` (the repo root; `memory_recall` takes the docs/memory dir). For a split
```

**File**: `src/infra/os.h` (modified, +1/-1)
```diff
@@ -1102,7 +1102,7 @@ inline bool path_is_system_dir( std::string_view path )
             }
             return true;
         };
-        for( const char* name : { "WINDIR", "SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "ProgramData" } )
+        for( const char* name : { "WINDIR", "SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramData" } )
         {
             const char* value = std::getenv( name );
             if( value != nullptr && *value != '\0' && sameDir( path, value ) )
```

**File**: `test/memguardcheck.sh` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
 
 set -u
 ROOT="$( cd "$( dirname "$0" )/.." && pwd )"
+. "$ROOT/test/lib/clean-env.sh"   # no inherited agent homes or GIT_* repository selection (the gate builds a repo)
 BIN="${1:-${RIPWIRE_BIN:-$ROOT/build/ripwire}}"
 [ "${BIN#/}" = "$BIN" ] && BIN="$ROOT/$BIN"
 TMP="$( mktemp -d )"; trap 'rm -rf "$TMP"' EXIT
```

**File**: `test/printf_parity.manifest` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@ pattern 0 b7a2467faab2b69e4fe8e3d8204f158329f6b349d644e5681af860ce6f8ba6ca e3b0c
 callers 0 31971e419a6df4d59c4464fcdd1afa56c6125e4fc76d096f0203c80cedd9a4a8 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 impact 0 c48ba09589d13cad6011bd6fadbb2898d68e2f5bd97a10bf44324901cfa08d49 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 clones 0 a082f92ce84cd952ced8341e3faff33a23685729bfa4ab6f0eda0f7867e41d7c e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
-help 0 eb0f61510399c6dd157334713e9a1b9bd572a607c95dabfdd5b66aea2a7027d7 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
+help 0 212b2706b1eb0672d9a8b25e2933dda2f99d21eb29a72cc4ed0eafae05d1e6ba e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 expand 0 4ac45b31a8ed0fe3c2520e9e24aaa4dc8e73e0479ee326499f4b760bc4ab10cc e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 callees 0 cbd133fa53917bad05926d46615d4d8b4457ba9285513dc4b193fa57a1ef8b85 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 around 0 77cd3047066cce2bc45aeea739008ebd5a0045aa64cd9fed59ed4a277c62ad88 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
@@ -38,5 +38,5 @@ safe_delete 0 8b99d83566b89332ac4b2967abbb39284db775bbed601628b97b8c7909f04ac2 e
 verify_layer 1 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 5288c345d7d6e335f88b9c1daa8935db22e1dcf89c0c8bc1f6140d4cb5af0b48
 graph_query 1 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 bfa4319feb9dee09cfbd3991cf6fbd752297e99d14de9e75768820d2a9c8832f
 callers_limit 0 e40ee1ddba0fbf548c58c98b91fe052af8c34f8913edb3edd85245b12a6967b9 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
-help_all 0 d38a765cd54446356c3b314d99232fe4695fd7b1a65588709cc0674e241d33a0 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
+help_all 0 d7d60ef967900b2a576a4baaf8e15dd571a3a9adef8ade3d909c022fcff3297b e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 help_one 0 938ff4f8802a8f5d9cb10f9a1f3804ac755be44c8ab00e24e45bfe8255224a21 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

#### Recent Merged Pull Requests:
- **PR #363** (2026-09-29): fix(#350): refuse roots nobody chose, and a zero-config memory guard (@joyful-ii-V-I)
- **PR #361** (2026-09-28): docs(readme): a field report from a two-day, 20-agent coding engagement (@joyful-ii-V-I)
- **PR #351** (2026-09-28): fix(g1): five string_view comparator lambdas take svLess; portablebuildcheck #6c resolves lambda comparators; GCC ASan builds; two gates chmod +x (@llvm-x86)
- **PR #341** (2026-09-27): Release 0.6.5 (@joyful-ii-V-I)
- **PR #340** (2026-09-27): ripwire 0.6.5: integration train 21 (eight reviewed changes) (@joyful-ii-V-I)
- **PR #337** (2026-09-26): Release 0.6.4: version bump, changelog, README release notes, deck (@joyful-ii-V-I)
- **PR #336** (2026-09-26): Train 20 (0.6.4): Astro frontmatter (#320), `node --test` for node:test files (#60), honest `--deps` over unresolved TS/JS imports (#220 part 1), the Windows preview testers' findings (#334), `next=` never dropped silently (@joyful-ii-V-I)
- **PR #333** (2026-09-25): Release 0.6.3: version bump, changelog, README release notes and contributor thanks (@joyful-ii-V-I)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
