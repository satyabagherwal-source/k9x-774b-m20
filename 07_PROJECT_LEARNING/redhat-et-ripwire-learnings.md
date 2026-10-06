# Forensic Learning Record (Deep Inspection): redhat-et/ripwire

> **Canonical Artifact**: `07_PROJECT_LEARNING/redhat-et-ripwire-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/redhat-et/ripwire](https://github.com/redhat-et/ripwire))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:46.610Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `redhat-et/ripwire`
- **Description**: The ripgrep of AI context: a zero-dependency C++23 CLI + MCP server for coding agents. Find what you want without reading the repo, then check you built what you meant — blast radius, tests-to-run, quality deltas. Signatures at 74.7% fewer bytes than bodies; every guess labelled, every loss published. Paddle out with a map.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2401 stars

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
    # (skipped) pairs where base's value is falsy/zero/None rather than divide-by-zero.
    ratios = []
    for _, _, _, base, ctx in pairs:
        bv, cv = base.get( field ), ctx.get( field )
        if bv: ratios.append( cv / bv - 1 )
    if not ratios: return None, None
    ratios.sort()
    p50 = statistics.median( ratios )
    p95 = ratios[ max( 0, math.ceil( 0.95 * len( ratios ) ) - 1 ) ]
    return p50, p95

def substitution_rate( rec ):
    """ripwire_calls / (ripwire_calls + native_read_calls) for ONE run, or None if unmeasured.

    This is the metric every skill/hook/primer change is trying to move, and the one the harness could
    not previously express: `ripwire_calls` alone cannot tell a run that used the tool for everything
    apart from one that used it once and then read twenty files.

    None (never 0.0) when either count is missing — claude records before 2026-08-22 carried neither
    count (the session transcript was not parsed; backfill_claude_transcripts.py repairs an archived
    bundle), and a missing
    measurement rendered as 0.0 would read as "defaulted every time", inverting the conclusion. A run
    that genuinely did neither (no reads AND no ripwire calls) is also None: no denominator, no rate."""
    rw, native = rec.get( "ripwire_calls" ), rec.get( "native_read_calls" )
    if rw is None or native is None:
        return None
    total = rw + native
    return ( rw / total ) if total else None

def mean_substitution( recs ):
    vals = [ v for v in ( substitution_rate( r ) for r in recs ) if v is not None ]
    return ( mean( vals ), len( vals ) ) if vals else ( None, 0 )

def analyze( records, n_boot=10000, bootstrap_seed="ripwire-b4-agentloop-bootstrap-v1" ):
    paired, incomplete = pair_by_task_seed( records )
    repos = sorted( { repo for _, repo, *_ in paired } )
    # Contamination count (arm-isolation fix, 2026-08-20 outcome-harness-fixes lane): a baseline record
    # with status="contaminated" (run_agentloop.py's baseline_contamination_note()) is al
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

### Core Architecture Module: `bench/agentloop/editsuite/gen_expected.py`
```
#!/usr/bin/env python3
"""Derive expected/<task>/<file>.expected from fixture/ and tasks.json with PLAIN STRING OPS — never ripwire.

The `.expected` suffix says what these are: byte-images of post-edit files, not translation units. Without it
test/ripwirepubliccheck.sh's include-closure arm swept them as C++ (a `#include "geometry.h"` that resolves in
fixture/ does not resolve beside a header-less copy). oracle.sh strips the suffix when it compares.

The oracle must be independent of the tool under test, so the expected post-edit bytes are produced by
str.replace over the committed fixture: a replace op swaps old_text for new_text once; an insert op puts
new_text before/after its anchor with the file's own definition separator (two blank lines in Python, one
in C++). Run `python3 gen_expected.py --check` to verify the committed expected/ tree still equals what this
script derives (test/agentloopeditsuitecheck.sh does)."""
import json, pathlib, sys

HERE = pathlib.Path( __file__ ).resolve().parent
FIXTURE, EXPECTED, TASKS = HERE / "fixture", HERE / "expected", HERE / "tasks.json"

def separator( rel ):
    """The blank-line convention between top-level definitions in that file (PEP 8 vs the C++ fixture)."""
    return "\n\n\n" if rel.endswith( ".py" ) else "\n\n"

def apply_op( text, op, rel ):
    kind = op.get( "op", op.get( "kind" ) )
    if kind == "replace":
        assert text.count( op["old_text"] ) == 1, "old_text must occur exactly once in %s (%s)" % ( rel, op["symbol"] )
        return text.replace( op["old_text"], op["new_text"], 1 )
    anchor = op["anchor_text"]
    assert text.count( anchor ) == 1, "anchor_text must occur exactly once in %s (%s)" % ( rel, op["symbol"] )
    if kind == "insert_before":
        return text.replace( anchor, op["new_text"] + separator( rel ) + anchor, 1 )
    if kind == "insert_after":
        return text.replace( anchor, anchor + separator( rel ) + op["new_text"], 1 )
    raise SystemExit( "unknown op kind %r" % kind )

def task_ops( task ):
    return task["ops"] if task["kind"] == "plan" else [ dict( task, op=task["kind"] ) ]

def expected_files( task ):
    """{relpath: bytes} for every file the task touches, derived from the pristine fixture."""
    out = {}
    for op in task_ops( task ):
        rel  = op["file"]
        text = out.get( rel ) or ( FIXTURE / rel ).read_text()
        out[rel] = apply_op( text, op, rel )
    return out

def main():
    tasks = json.loads( TASKS.read_text() )["tasks"]
    check = "--check" in sys.argv
    bad = 0
    for task in tasks:
        for rel, text in expected_files( task ).items():
            dest = EXPECTED / task["id"] / ( rel + ".expected" )
            if check:
                have = dest.read_text() if dest.exists() else None
                if have != text:
                    print( "MISMATCH %s" % dest ); bad += 1
            else:
                dest.parent.mkdir( parents=True, exist_ok=True )
                dest.write_text( text )
    if check:
        print( "expected/ %s tasks.json+fixture/" % ( "DIFFERS FROM" if bad else "matches" ) )
        sys.exit( 1 if bad else 0 )

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bench/agentloop/followup_calls.py`
```
#!/usr/bin/env python3
# followup_calls.py -- the follow-up-call-count column owed in docs/EVALS.md ("Owed, registered
# 2026-09-03, not yet measured: a follow-up-call-count column").
#
# WHAT THIS COUNTS. arXiv:2608.16370 found completion can hold flat while retrieval calls rise
# (21.0->63.9 in one of six measured comparisons) -- a tighter --token-budget can defer tokens into
# MORE calls instead of eliminating them, and nothing in this harness's existing metrics
# (tokens_in/out, wall_seconds, resolved, localization_hit) can tell the two apart. This script adds
# that column from data run_agentloop.py ALREADY RECORDS per instance: `ripwire_calls`, the count of
# ripwire invocations the harness's own shim/transcript parser attributed to that run (see
# run_agentloop.py's parse_codex_jsonl_metrics / parse_opencode_ndjson_metrics /
# parse_claude_session_metrics). No new instrumentation, no re-run -- this reads the SAME field
# analyze.py's substitution_rate() reads, from a different angle.
#
# DEFINITIONS (registered in docs/EVALS.md alongside this script).
#   calls      = record["ripwire_calls"]: total ripwire invocations attributed to one
#                (instance_id, arm, seed) run.
#   follow-ups = max(calls - 1, 0): every call after the first. The first call is the initial
#                retrieval attempt; a follow-up is evidence the first answer needed a second (or
#                third, ...) call to complete the task -- the "retrieval calls rose" signal the
#                registration is chasing.
#   FLOOR      = a record whose status != "ok". An aborted/errored/timed-out run cannot guarantee
#                its shim log or transcript parse captured every invocation before it stopped, so its
#                calls/follow-ups number is a minimum, never reported as a total -- CLAUDE.md
#                non-negotiable 3.
#   ABSENT     = a record whose ripwire_calls is None (the harness/date combination never measured
#                it -- e.g. claude-harness runs before 2026-08-22). Excluded from mean/median,
#                counted and disclosed separately, NEVER coerced to 0 (mean_substitution() in
#                analyze.py sets the precedent for this exact posture on the same field).
#
# COLUMN FORMAT (one row per arm): n_records, n_measured, n_absent, n_floor, mean_calls,
# median_calls, mean_followups, median_followups -- printed as a markdown table by print_report();
# analyze_followups() returns the same data as a dict for callers that want it raw.
#
# USAGE
#   python3 bench/agentloop/followup_calls.py --self-test
#   python3 bench/agentloop/followup_calls.py --results bench/agentloop/results/pilot-6run.json
import argparse, json, pathlib, statistics, sys

def median_or_none( xs ):
    return statistics.median( xs ) if xs else None

def mean_or_none( xs ):
    return ( sum( xs ) / len( xs ) ) if xs else None

def followups_for_arm( records, arm ):
    """(n_records, n_absent, n_floor, calls, followups) for one arm's records. calls/followups carry
    only records whose ripwire_calls is not None -- an absent record is counted in n_absent and never
    contributes a fabricated 0 to the lists that feed mean/median."""
    arm_records = [ r for r in records if r.get( "arm" ) == arm ]
    n_absent = n_floor = 0
    calls, followups = [], []
    for r in arm_records:
        c = r.get( "ripwire_calls" )
        if c is None:
            n_absent += 1
            continue
        if r.get( "status" ) != "ok":
            n_floor += 1
        calls.append( c )
        followups.append( max( c - 1, 0 ) )
    return len( arm_records ), n_absent, n_floor, calls, followups

def analyze_followups( records ):
    arms = sorted( { r.get( "arm" ) for r in records if r.get( "arm" ) } )
    out = {}
    for arm in arms:
        n, n_absent, n_floor, calls, followups = followups_for_arm( records, arm )
        out[ arm ] = dict(
            n_records=n, n_absent=n_absent, n_floor=n_floor, n_measured=len( calls ),
            mean_calls=mean_or_none( calls ), median_calls=median_or_none( calls ),
            mean_followups=mean_or_none( followups ), median_followups=median_or_none( followups ),
        )
    return out

def print_report( out ):
    def num( x ):
        return ( "%.2f" % x ) if x is not None else "n/a"
    print( "| arm | n | measured | absent | floor | mean calls | median calls | mean follow-ups | median follow-ups |" )
    print( "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |" )
    for arm in sorted( out ):
        row = out[ arm ]
        floor_tag = f"{row['n_floor']}*" if row[ "n_floor" ] else "0"
        print( f"| {arm} | {row['n_records']} | {row['n_measured']} | {row['n_absent']} | {floor_tag} | "
               f"{num(row['mean_calls'])} | {num(row['median_calls'])} | "
               f"{num(row['mean_followups'])} | {num(row['median_followups'])} |" )
    if any( out[ arm ][ "n_floor" ] for arm in out ):
        print( "\n* floor: at least one record's status != \"ok\" -- its call count is a minimum, not a total." )
    if any( out[ arm ][ "n_absent" ] for arm in out ):
        print( "absent: ripwire_calls was never measured for these records (harness/date gap) -- excluded" )
        print( "from mean/median, never coerced to 0." )

SCHEMA_PREFIX = "ripwire-agentloop-results-"

def load_results( path ):
    data = json.loads( pathlib.Path( path ).read_text() )
    schema = str( data.get( "schema", "" ) )
    if not schema.startswith( SCHEMA_PREFIX ):
        raise SystemExit( f"{path}: unexpected schema {schema!r} -- refusing (not a run_agentloop.py "
                          f"results file)" )
    return data

# ── self-test: a synthetic fixture that mirrors pilot-6run.json's actual record shape (schema
# ripwire-agentloop-results-v2, codex harness, baseline calls=0 / ripwire_cli calls>0 with a matching
# ripwire_commands list), plus the two cases the real committed file does not happen to exercise: a
# non-"ok" status (FLOOR) and an unmeasured ripwire_calls=None (ABSENT) -- both must be proven correct
# before any real number from this script is trusted. ──────────────────────────────────────────────
def _fixture_record( instance_id, arm, status, ripwire_calls, commands ):
    return dict( instance_id=instance_id, repo="fake/repo", base_commit="deadbeef", arm=arm, seed=1,
                harness="fixture", model="fixture", status=status, resolved=None, localization_hit=None,
                tokens_in=1000, tokens_out=100, wall_seconds=10.0, cost_usd=None,
                command_calls=len( commands ) if commands else 0,
                ripwire_calls=ripwire_calls, ripwire_commands=commands, events_path=None, error=None,
                started_unix=0, finished_unix=0 )

def synthetic_fixture():
    return [
        # baseline: never calls ripwire, mirrors pilot-6run.json's baseline rows exactly (calls=0).
        _fixture_record( "F01", "baseline", "ok", 0, [] ),
        _fixture_record( "F02", "baseline", "ok", 0, [] ),
        # ripwire_cli: two clean completed runs, calls=5 and calls=2 -> follow-ups 4 and 1.
        _fixture_record( "F01", "ripwire_cli", "ok", 5, [ "ripwire . --for=a" ] * 5 ),
        _fixture_record( "F02", "ripwire_cli", "ok", 2, [ "ripwire . --for=b" ] * 2 ),
        # ripwire_cli: a run that TIMED OUT after 9 recorded calls -- its count is a FLOOR, the run
        # may have made more calls the parser never saw before the process was killed.
        _fixture_record( "F03", "ripwire_cli", "timeout", 9, [ "ripwire . --for=c" ] * 9 ),
        # ripwire_cli: an UNMEASURED run (pre-2026-08-22 claude harness shape) -- ripwire_calls is
        # None, never a fabricated 0; must land in n_absent, excluded from every mean/median.
        _fixture_record( "F04", "ripwire_cli", "ok", None, None ),
    ]

def self_test():
    records = synthetic_fixture()
    out = analyze_followups( records )
    print_report( out )
    failures = []
    b = out.get( "baseline", {} )
    if b.get( "n_records" ) != 2: failures.append( f"baseline n_records: expected 2, got {b.get('n_records')}" )
    if b.get( "mean_calls" ) != 0.0: failures.append( f"baseline mean_calls: expected 0.0, got {b.get('mean_calls')}" )
    if b.get( "mean_followups" ) != 0.0: failures.append( f"baseline mean_followups: expected 0.0, got {b.get('mean_followups')}" )
    c = out.get( "ripwire_cli", {} )
    if c.get( "n_records" ) != 4: failures.append( f"ripwire_cli n_records: expected 4, got {c.get('n_records')}" )
    if c.get( "n_absent" ) != 1: failures.append( f"ripwire_cli n_absent: expected 1 (F04), got {c.get('n_absent')}" )
    if c.get( "n_floor" ) != 1: failures.append( f"ripwire_cli n_floor: expected 1 (F03 timeout), got {c.get('n_floor')}" )
    if c.get( "n_measured" ) != 3: failures.append( f"ripwire_cli n_measured: expected 3 (F01,F02,F03), got {c.get('n_measured')}" )
    # calls: 5, 2, 9 -> mean 16/3, median 5; followups: 4, 1, 8 -> mean 13/3, median 4
    if c.get( "mean_calls" ) is None or abs( c[ "mean_calls" ] - 16 / 3 ) > 1e-9:
        failures.append( f"ripwire_cli mean_calls: expected {16/3}, got {c.get('mean_calls')}" )
    if c.get( "median_calls" ) != 5: failures.append( f"ripwire_cli median_calls: expected 5, got {c.get('median_calls')}" )
    if c.get( "mean_followups" ) is None or abs( c[ "mean_followups" ] - 13 / 3 ) > 1e-9:
        failures.append( f"ripwire_cli mean_followups: expected {13/3}, got {c.get('mean_followups')}" )
    if c.get( "median_followups" ) != 4: failures.append( f"ripwire_cli median_followups: expected 4, got {c.get('median_followups')}" )
    if failures:
        print( "\nSELF-TEST FAIL:" )
        for f in failures: print( f"  - {f}" )
        return 1
    print( "\nSELF-TEST PASS: calls/follow-ups math, floor marking, and absent exclusion all check out." )
    return 0

def main():
    ap = argparse.ArgumentParser( description=__doc__.split( "\n\n" )[ 0 ] if __doc__ else "" )
    ap.add_argument( "--results", default="", he
```

### Core Architecture Module: `bench/agentloop/grade_answers.py`
```
#!/usr/bin/env python3
# grade_answers.py — the ANSWER grader for the E1 scenario-efficiency bank.
#
# WHAT THIS IS, AND WHY IT IS NOT analyze.py. `analyze.py` scores a PATCH: it pairs (instance, seed)
# records and bootstraps a resolved-rate delta. The E1 bank does not produce patches — it poses 28
# self-contained QUESTIONS at pinned commits and grades the ANSWER an agent gave. That is a different
# instrument, and the E1 Phase-0 pricing memo names it as the binding constraint on the whole round:
# until it exists there is nothing to run into.
#
# THE PROTOCOL IS BINDING (e1-phase0/grading-protocol.md). Three of its rules are load-bearing here
# and are enforced mechanically rather than trusted:
#   §3  Ground truth is a COMMAND, not a list. This grader EXECUTES the row's `gt_command` at the
#       pinned sha and derives the key from its stdout. A frozen list is never read.
#   §3  NON-CIRCULARITY: no `gt_command` may invoke ripwire. A key produced by the instrument under
#       test is not a key. A row that invokes it is REFUSED, never scored. Note the precision this
#       requires: nine admitted rows legitimately name `ripwire/src` as a PATH argument to grep/ls.
#       Refusal keys on ripwire in COMMAND POSITION, which is what "invokes" means.
#   §3.2 A `gt_command` that needs judgement is only half a key. Where the judgement half must be
#       human-sealed, this grader takes a key FILE and REFUSES those rows without it. It never
#       improvises the judgement half — not from the answer, not from the notes, not from a heuristic.
#
# HONESTY POSTURE (CLAUDE.md non-negotiable 3). An `accept_rule` is prose written by a labeler. This
# grader parses a CLOSED grammar of clauses (see CLAUSE_RULES) and scores exactly those. Any clause it
# does not recognise is reported in `unparsed` and DEMOTES the verdict to PARTIAL. A row is never
# reported PASS on the strength of clauses that were silently skipped. `--audit` prints that coverage
# for a whole bank without needing a single transcript, so the gap is visible before anyone funds a run.
#
# INPUTS
#   --instances FILE   the graded TSV (instances_graded.tsv schema — 13 columns, header required)
#   --results FILE     a run's results JSON from run_agentloop.py (schema ripwire-agentloop-results-v3);
#                      each record's `events_path` is the retained transcript the answer is read from
#   --transcript FILE  a single raw transcript instead of --results (needs --instance-id)
#   --pin-root DIR     a directory holding one checkout per repo, each AT ITS PINNED SHA (verified)
#   --key FILE         the human-sealed judgement keys (JSON), required by V rows and by any row whose
#                      accept_rule carries a judgement half
#
# EXIT CODES  0 every row produced a verdict · 3 at least one row was REFUSED (owner action needed:
# a seal, or a non-circular gt_command) · 2 usage/precondition error.
#
# USAGE
#   python3 bench/agentloop/grade_answers.py --instances bank.tsv --audit
#   python3 bench/agentloop/grade_answers.py --instances bank.tsv --results run.json \
#       --pin-root /tmp/e1-pins --key sealed.json
import argparse, json, os, pathlib, re, subprocess, sys

SCHEMA_RESULTS = "ripwire-agentloop-results-v3"
COLUMNS = ( "id", "status", "repo", "pin_ref", "scenario_class", "tier", "cap_calls", "cap_wall_s",
            "grader", "question", "gt_command", "accept_rule", "notes" )
GRADERS = ( "F", "S", "E", "V", "O", "T" )
ANSWER_OPEN, ANSWER_CLOSE = "<<<ANSWER>>>", "<<<END ANSWER>>>"
# The unpinned escape hatch exists for GATE FIXTURES ONLY: a committed fixture cannot name a sha that
# the gate generates at run time. It is gated behind --allow-unpinned and disclosed in the header, so
# a real run cannot take this path by accident.
FIXTURE_PIN = "FIXTURE"

# A path is only a path if its extension is one this corpus actually uses. Without the whitelist,
# ordinary prose ("e.g.", "i.e.") parses as a filename and every answer scores as a hallucination.
SOURCE_EXT = frozenset( ( "c h cc cpp cxx hpp hh inc m mm py pyi ts tsx js jsx java rb sh go rs swift "
                          "cs cu cuh metal md txt json yaml yml toml xml lock cmake" ).split() )
PATH_RE   = re.compile( r"(?<![\w/.\-])((?:[\w.+\-]+/)*[\w.+\-]+\.([A-Za-z][\w+]{0,5}))(?![\w/])" )
SYMBOL_RE = re.compile( r"^\s*[-*\d.)\s]*(?P<file>[\w./+\-]+\.\w{1,6})\s*:\s*(?P<sym>[A-Za-z_][\w:~]*)" )
VERDICT_RE = re.compile( r"^\s*[-*]?\s*(?P<claim>[^\s:][^:]{0,60}?)\s*:\s*"
                         r"(?P<verdict>TRUE|FALSE|DRIFTED|NOT[- ]DRIFTED)\b[^\w/]*"
                         r"(?P<cite>[\w./+\-]+\.\w{1,6}:\d+)?", re.I )
# ripwire in COMMAND POSITION — start of the command, or after a pipe/;/&&/||/backtick/$( — which is
# what protocol §3's "no gt_command invokes ripwire" actually forbids. `grep -rn X ripwire/src` names
# a directory and is fine; nine admitted rows depend on that distinction.
# A bank whose commands run an older build of the instrument under another command name must refuse
# those rows too, and that name does not belong in a tracked file: AGENTLOOP_TOOL_ALIASES (comma- or
# space-separated) adds each name to the same command-position test. Unset, only `ripwire` counts.
# The name ends at `(?!\w)`, not `\b`. After a name ending in a word character the two are the same test, so
# ripwire's own refusal set does not move; but `\b` never matches after an alias ending in `-` or `.` (no
# boundary between two non-word characters), and it would take `tool.py` for the alias `tool.`.
TOOL_ALIASES = tuple( n for n in re.split( r"[\s,]+", os.environ.get( "AGENTLOOP_TOOL_ALIASES", "" ) ) if n )
CIRCULAR_RE = re.compile( r"(?:^|[|;&`]|\$\(|&&|\|\|)\s*(?:[\w./\-]*/)?(%s)(?!\w)"
                          % "|".join( re.escape( n ) for n in ( "ripwire", ) + TOOL_ALIASES ) )


# ── the bank ────────────────────────────────────────────────────────────────────────────────────────
def load_instances( path ):
    """Fail-closed TSV load: the header must be exactly the protocol's 13 columns, in order."""
    lines = pathlib.Path( path ).read_text().splitlines()
    if not lines:
        raise SystemExit( f"{path}: empty instances file" )
    header = tuple( lines[ 0 ].split( "\t" ) )
    if header != COLUMNS:
        raise SystemExit( f"{path}: unexpected header {header!r}; expected the graded-TSV schema "
                          f"{COLUMNS!r} — refusing (fail-closed, no silent column re-mapping)" )
    rows = []
    for line in lines[ 1: ]:
        if not line.strip():
            continue
        cells = line.split( "\t" )
        cells += [ "" ] * ( len( COLUMNS ) - len( cells ) )
        rows.append( dict( zip( COLUMNS, cells ) ) )
    return [ r for r in rows if r[ "status" ].strip().upper() == "GRADED" ]

def needs_seal( row ):
    """True when the row's accept_rule has a judgement half a command cannot supply (protocol §3.2).

    Deliberately CONSERVATIVE. A false positive costs the owner one sealed-key entry; a false negative
    would have the grader inventing the judgement half, which the protocol forbids outright. Every V
    row needs a seal by definition; the phrase list covers the E rows whose second half is a
    classification (I26's per-site operation classes, I19's switch/non-switch split, I18's indirect pins)."""
    if row[ "grader" ].strip().upper() == "V":
        return True
    text = row[ "accept_rule" ].lower()
    return any( phrase in text for phrase in
                ( "sealed", "scored separately", "split must be correct", "classification" ) )

def is_circular( gt_command ):
    return bool( CIRCULAR_RE.search( gt_command ) )

def instrument_note():
    """How the output DISCLOSES the command-position test: a count of aliases, never the names themselves."""
    return f"circular test: ripwire + {len( TOOL_ALIASES )} name(s) from AGENTLOOP_TOOL_ALIASES"


# ── the key: a COMMAND run at the pin (protocol §3) ─────────────────────────────────────────────────
def pin_pairs( row ):
    """[(repo_dir, sha)] for the row. `otherrepo@1234abc + ripwire@49f4d75` is the multi-root form."""
    pin = row[ "pin_ref" ].strip()
    if "@" not in pin:
        return [ ( row[ "repo" ].strip(), pin ) ]
    out = []
    for part in pin.split( "+" ):
        repo, _, sha = part.strip().partition( "@" )
        out.append( ( repo.strip(), sha.strip() ) )
    return out

def verify_pin( row, pin_root, allow_unpinned ):
    """None when the tree under pin_root is at the row's pinned sha; an error string otherwise."""
    if row[ "pin_ref" ].strip() == FIXTURE_PIN:
        return None if allow_unpinned else "pin_ref=FIXTURE requires --allow-unpinned (fixtures only)"
    for repo, sha in pin_pairs( row ):
        tree = pathlib.Path( pin_root ) / repo
        if not tree.is_dir():
            return f"no checkout at {tree}"
        head = subprocess.run( [ "git", "-C", str( tree ), "rev-parse", "HEAD" ],
                               capture_output=True, text=True )
        if head.returncode != 0:
            return f"{tree} is not a git checkout"
        if not head.stdout.strip().startswith( sha ):
            return f"{tree} is at {head.stdout.strip()[ :12 ]}, not the pinned {sha}"
    return None

_SHELL = []

def globstar_shell():
    """The first bash on this machine that actually supports `**`, or None.

    NOT a detail. Protocol §4 records two derivations that returned a false ZERO purely from glob
    expansion, and macOS still ships bash 3.2 as /bin/bash — which has no globstar, so
    `repo/**/x.{h,cpp}` silently matches nothing and the key comes back empty. An empty key that
    looks like a legitimate 'no results' is the worst failure this grader can have, so the shell is
    probed once and a row that NEEDS `**` is REFUSED when no capable shell exists, never guessed at."""
    if not _SHELL:
        _SHELL.append( None )
        for candidate in ( "bash", "/opt/homebrew/bin/bash", "/usr/local/bin/bash", "/bin/bash" ):
            try:
                probe = 
```

### Core Architecture Module: `bench/agentloop/power_sim.py`
```
#!/usr/bin/env python3
"""
power_sim.py — Monte Carlo power / MDE simulation for the ripwire agentloop A/B eval
(bench/agentloop/analyze.py's repository-clustered bootstrap on SWE-bench-Lite resolution rate).

STDLIB ONLY. No numpy (confirmed absent from this interpreter). Uses random.betavariate and
random.binomialvariate (both in Python's stdlib `random` module; binomialvariate requires Python
>= 3.12 — this environment reports 3.14.6, so it's available).

WHAT THIS REPRODUCES FROM analyze.py (bench/agentloop/analyze.py, read in full before writing this):
  - pair_by_task_seed (L38-56): pairs records by (instance_id, seed) across the two arms. We generate
    already-paired data directly (no need to re-derive the pairing logic; the object of interest is
    the *bootstrap*, not the join).
  - clustered_bootstrap_lower (L58-76): resamples REPOS with replacement len(repos) times per bootstrap
    draw, pools every paired per-(instance,seed) delta belonging to the sampled repos, takes the mean;
    repeats n_boot times; sorts; returns the alpha-quantile (default alpha=0.025, i.e. the 2.5th
    percentile => nominally a "95% one-sided lower bound", see NOTE-1 below) as the lower confidence
    bound. `resolved_delta` (L78) is bool(ctx.resolved) - bool(base.resolved) per pair, i.e. a paired
    binary outcome in {-1,0,+1}.

MATHEMATICAL SIMPLIFICATION (derived by hand, stated here so it can be checked against the source):
  Every config we simulate has EQUAL cluster size (every repo contributes the same number of
  instance*seed pairs — true of the real design, which caps 4 instances/repo, and true of every
  hypothetical config below). Under equal cluster sizes, clustered_bootstrap_lower's
      vals = [ v for r in sampled_repos for v in by_repo[r] ]; boots.append(mean(vals))
  is algebraically IDENTICAL to: draw G repo names with replacement from the G repo-level MEANS
  m_1..m_G, and average those G (possibly repeated) means. Proof: if every repo contributes exactly n
  values, mean(vals) = (1/(G*n)) * sum_{drawn r} sum(by_repo[r]) = (1/(G*n)) * sum_{drawn r} (n*m_r)
                       = (1/G) * sum_{drawn r} m_r.
  This is exactly what "effective N ~= number of clusters" means in the task brief, made precise: the
  entire bootstrap distribution is a resampling of only G numbers, regardless of how many instances or
  seeds sit inside each repo. We exploit this for speed (no need to materialize per-instance arrays
  inside the bootstrap loop) and for correctness (it is an exact identity, not an approximation).

  A second identity we use: for the repo-level MEAN delta m_g = mean(ctx_ijk - base_ijk) over the n
  instance*seed pairs in repo g, m_g = mean(ctx) - mean(base) regardless of any correlation between a
  specific pair's base and ctx outcome (linearity of the sum). So m_g's distribution needs only two
  independent Binomial draws per repo per trial — Binomial(n, p1_g) for ctx successes and
  Binomial(n, p0_g) for base successes — not n individual paired Bernoulli draws. This does NOT
  reproduce row-level pairing correlation (irrelevant to analyze.py's statistic, which is a repo-level
  MEAN) but is exact for the quantity the bootstrap actually consumes.

NOTE-1 (a mislabeling in analyze.py worth flagging, per task item 1): the docstring at L58-62 calls
  alpha=0.025's 2.5th-percentile cutoff a "95% one-sided lower bound". That is not quite right: the
  2.5th percentile is the lower edge of a *two-sided* 95% CI (equivalently, a *97.5%* one-sided lower
  bound). A true 95% one-sided lower bound uses the 5th percentile (alpha=0.05). The practical
  consequence is that analyze.py's shipped default is MORE conservative than a plain one-sided 5% test:
  it requires slightly stronger evidence to call `lower > 0`, which lowers realized power at any given
  N relative to what "alpha=0.05" nominally promises. We compute the MDE table using alpha=0.05 (the
  value the task asks for), and separately quantify the alpha=0.025-vs-0.05 gap (function
  `alpha_sensitivity_check`) so the reader can see the size of this effect on the number that matters.

REPO-LEVEL RANDOM EFFECTS MODEL (this is the part with no ground truth to calibrate against — the pilot
never scored resolution, see FINDINGS.md item 2). Single ICC parameter rho, applied twice, both
draws sharing the same variance scale (the standard beta-binomial ICC identity Var(p_g) = rho*p*(1-p)):
  1. Baseline-difficulty heterogeneity: p0_g ~ Beta(mean=baseline_rate, ICC=rho)   [rho=0 => p0_g fixed]
  2. Treatment-effect heterogeneity:    delta_g = delta + eps_g,  eps_g ~ Normal(0, sqrt(rho*p*(1-p)))
     p1_g = clip(p0_g + delta_g, 0, 1)
  Component (1) mostly CANCELS in the paired difference delta_g = p1_g - p0_g (that's the point of
  pairing on the same instance/repo in both arms). Component (2) is what actually stops power from
  reaching 100% as instances-per-repo -> infinity with G fixed: it is a true between-repo nuisance
  parameter on the ESTIMAND itself (some repos may benefit from ripwire more than others), and no
  amount of within-repo sampling can shrink Var(delta_g)/G below a floor of rho*p*(1-p)/G. This is the
  most important and most debatable modeling choice in this file — see FINDINGS.md for the sensitivity
  discussion. At rho=0 both components vanish and the model is a fully homogeneous paired design (no
  cluster nuisance at all), where more instances always buys more power regardless of G — also checked
  explicitly (function `homogeneous_sanity_check`).
"""
import random, math, sys, json, time

ALPHA_PRIMARY = 0.05      # what the task asks the MDE table to target (one-sided 95% lower bound)
ALPHA_SHIPPED = 0.025     # analyze.py's actual default (see NOTE-1)
N_BOOT = 2000              # bootstrap replicates per simulated trial (analyze.py's own default is 10000;
                            # reduced for wall-clock — see FINDINGS.md for the stability check)
TRIALS = 400                # Monte Carlo trials per power estimate (SE of a power estimate ~= 2.5pp)
BISECT_ITERS = 9             # range/2^9 ~= 0.12pp resolution, well under the MC noise floor
TARGET_POWER = 0.80

BASELINE_RATES = (0.20, 0.30, 0.40)
ICC_VALUES = (0.0, 0.05, 0.15, 0.30)

CONFIGS = [
    ("a", "24 inst / 6 clusters / K=1", 6, 4, 1),
    ("b", "24 inst / 6 clusters / K=3", 6, 4, 3),
    ("c", "48 inst / 6 clusters / K=3", 6, 8, 3),
    ("d", "96 inst / 6 clusters / K=3", 6, 16, 3),
    ("e", "96 inst / 12 clusters / K=3 (hypothetical: no disjointness rule)", 12, 8, 3),
]
# each tuple: (label, description, G=num_repos, instances_per_repo, K=seeds_per_instance)


def draw_p0( rng, baseline_rate, icc ):
    if icc <= 1e-9:
        return baseline_rate
    kappa = 1.0 / icc - 1.0
    a = max( baseline_rate * kappa, 1e-6 )
    b = max( ( 1.0 - baseline_rate ) * kappa, 1e-6 )
    return rng.betavariate( a, b )

def repo_effect_sd( baseline_rate, icc ):
    return math.sqrt( icc * baseline_rate * ( 1.0 - baseline_rate ) )

def simulate_repo_means( rng, G, n_per_repo, baseline_rate, delta, icc ):
    """One simulated trial's G repo-level mean deltas m_g. n_per_repo = instances_per_repo * K."""
    sd_eff = repo_effect_sd( baseline_rate, icc )
    m = []
    for _g in range( G ):
        p0 = draw_p0( rng, baseline_rate, icc )
        eps = rng.gauss( 0.0, sd_eff ) if icc > 1e-9 else 0.0
        p1 = min( 1.0, max( 0.0, p0 + delta + eps ) )
        base_hits = rng.binomialvariate( n_per_repo, p0 )
        ctx_hits  = rng.binomialvariate( n_per_repo, p1 )
        m.append( ( ctx_hits - base_hits ) / n_per_repo )
    return m

def bootstrap_lower( rng, m, n_boot, alpha ):
    """Exactly mirrors analyze.py's clustered_bootstrap_lower under the equal-cluster-size identity
    proven in the module docstring: resample G repo MEANS with replacement, G draws, average; repeat;
    sort; take boots[max(0,int(alpha*n_boot))]."""
    G = len( m )
    boots = [ sum( rng.choices( m, k=G ) ) / G for _ in range( n_boot ) ]
    boots.sort()
    idx = max( 0, int( alpha * len( boots ) ) )
    return boots[ idx ]

def power_at_delta( seed_key, G, n_per_repo, baseline_rate, delta, icc, trials=TRIALS, n_boot=N_BOOT, alpha=ALPHA_PRIMARY ):
    rng = random.Random( seed_key )
    hits = 0
    for _ in range( trials ):
        m = simulate_repo_means( rng, G, n_per_repo, baseline_rate, delta, icc )
        lb = bootstrap_lower( rng, m, n_boot, alpha )
        if lb > 0.0:
            hits += 1
    return hits / trials

def find_mde( G, n_per_repo, baseline_rate, icc, alpha=ALPHA_PRIMARY, target_power=TARGET_POWER,
              lo=0.0, hi=0.60, iters=BISECT_ITERS, tag="" ):
    """Bisection search for the smallest delta (resolution-rate lift, in probability units) at which
    power_at_delta reaches target_power. Assumes power is monotone non-decreasing in delta (true of
    this generative model up to Monte Carlo noise); hi=0.60 is well above any plausible MDE for the
    configs in scope, checked once below (assert_hi_saturates)."""
    key_base = f"mde|{tag}|G{G}|n{n_per_repo}|p{baseline_rate}|icc{icc}|a{alpha}"
    for i in range( iters ):
        mid = ( lo + hi ) / 2.0
        p = power_at_delta( key_base + f"|mid{i}", G, n_per_repo, baseline_rate, mid, icc, alpha=alpha )
        if p < target_power:
            lo = mid
        else:
            hi = mid
    return ( lo + hi ) / 2.0

def assert_hi_saturates( G, n_per_repo, baseline_rate, icc, alpha=ALPHA_PRIMARY, hi=0.60 ):
    p = power_at_delta( f"hicheck|G{G}|n{n_per_repo}|p{baseline_rate}|icc{icc}", G, n_per_repo, baseline_rate, hi, icc, alpha=alpha )
    return p

def find_required_n( G, K, baseline_rate, icc, target_delta, alpha=ALPHA_PRIMARY, target_power=TARGET_POWER,
                      n_grid=(4,8,12,16,24,32,48,64,96,128,192,256,384,512,768,1024,1536,2048,3072,4096,6144,8192) ):
    """Smallest instances_per_repo (from n_grid) such that power_at_delta(target_delta) >= target_power.
    Returns (instances_per_repo, total_instances,
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

### Incident Patch 1: `7ea8cbce` (2026-10-04)
**Commit Message**: review fixes: one timing helper for both MCP loops; named callee-row order

quality-delta on the previous commit gated three rows the fixes added:
runMcp's complexity (the vri= capture), a fourth copy of the counter-function
shape (mcpValueRefBuildCounter), and a sixth collectUseSites parameter.

- McpRequestTiming (mcpindex.h) captures and prints the RIPWIRE_MCP_TIMINGS
  line for runMcp and runMcpHttp alike; the value-ref build count is an
  McpIndex member, not another static counter. Same line, same bytes.
- vrCalleeRowLess names the --callees row order (same keys, same order).
- The --safe-delete shared ValueRefIndex is withdrawn: it needed a sixth
  collectUseSites parameter, which the params bar gates, for a time-only
  saving (output was identical either way).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/mcp.h` (modified, +4/-17)
```diff
@@ -2893,7 +2893,7 @@ inline int runMcp( const McpStdioConfig& config )
     // MEASURE-FIRST instrumentation (RIPWIRE_MCP_TIMINGS, off by default → byte-identical + silent server, same
     // discipline as ingest.cpp's RIPWIRE_CACHE_STATS). When set, emit ONE stderr TSV line per handled request:
     //   ripwire-timing verb=<v> wall_ms=<f> rebuilt=<0|1> vri=<0|1>
-    // (vri=1: this request built the value-reference index — mcpValueRefBuildCounter, mcpindex.h.)
+    // (McpRequestTiming, mcpindex.h, writes it; vri=1: this request built the value-reference index.)
     // stderr only, so the JSON-RPC stdout stream is untouched and every determinism/protocol gate is unaffected.
     // NOTE: the design specified a `--mcp-timings` CLI flag; cli.h/main.cpp are owned by a concurrent agent this
     // round, so we use the env var instead (recorded in bench/PROFILE.md's appendix) — same zero-cost-off contract.
@@ -2923,10 +2923,7 @@ inline int runMcp( const McpStdioConfig& config )
         }
 
         // per-request timing capture (only when the env observable is on — zero clock/atomic work otherwise).
-        const std::chrono::steady_clock::time_point t0 =
-            timingsOn ? std::chrono::steady_clock::now() : std::chrono::steady_clock::time_point{};
-        const std::uint64_t rebuildAtStart = timingsOn ? mcpRebuildCounter().load( std::memory_order_relaxed ) : 0;
-        const std::uint64_t vriAtStart     = timingsOn ? mcpValueRefBuildCounter().load( std::memory_order_relaxed ) : 0;
+        const McpRequestTiming timing( timingsOn );
 
         const McpDispatchResult r = dispatchMcpLine( line, config.topK, config.stable, config.noRedact, policy );
         if( r.isNotification )
@@ -2939,18 +2936,8 @@ inline int runMcp( const McpStdioConfig& config )
         std::fflush( stdout );
 
         // MEASURE-FIRST per-request timing line (stderr only, env-gated). Emitted AFTER the protocol response is
-        // flushed so it can never interleave into the JSON-RPC stdout stream. rebuilt=1 iff a full getIndex()
-        // rebuild fired somewhere in this request's handling (staleness / post-edit path).
-        if( timingsOn )
-        {
-            const double wallMs = std::chrono::duration< double, std::milli >(
-                                      std::chrono::steady_clock::now() - t0 ).count();
-            const unsigned rebuilt = ( mcpRebuildCounter().load( std::memory_order_relaxed ) != rebuildAtStart ) ? 1u : 0u;
-            const unsigned vri     = ( mcpValueRefBuildCounter().load( std::memory_order_relaxed ) != vriAtStart ) ? 1u : 0u;
-            rw::emitTo( stderr, "ripwire-timing verb={} wall_ms={:.3f} rebuilt={} vri={}\n",
-                          r.timingVerb.c_str(), wallMs, rebuilt, vri );
-            std::fflush( stderr );
-        }
+        // flushed so it can never interleave into the JSON-RPC stdout stream (McpRequestTiming, mcpindex.h).
+        timing.emit( r.timingVerb );
     }
     return 0;
 }
```

**File**: `src/mcpindex.h` (modified, +37/-7)
```diff
@@ -538,6 +538,7 @@ struct McpIndex
     // reference count, and the old index then read the freed bindings. Pure cache: it is a function of `ing`, so no
     // output byte depends on whether it was warm.
     mutable std::shared_ptr<const ValueRefIndex> valueRefs;
+    mutable std::uint64_t                        valueRefBuilds = 0;   // monotone: McpRequestTiming's vri= reads it
 
     // ── P1-15 incremental-pass disclosure (the `_reingest` envelope field; mcpReingestField below).
     //
@@ -839,13 +840,42 @@ inline std::atomic<std::uint64_t>& mcpRebuildCounter()
     return n;
 }
 
-// The same RIPWIRE_MCP_TIMINGS observable for the value-reference index (valueRefIndexOf): a monotone count of builds.
-// The timing line's vri=1 says this request built it — once after every getIndex() rebuild, never on a warm reuse.
-inline std::atomic<std::uint64_t>& mcpValueRefBuildCounter()
+// The RIPWIRE_MCP_TIMINGS line of one request, shared by the stdio loop (runMcp) and the HTTP server (runMcpHttp):
+//   ripwire-timing verb=<v> wall_ms=<f> rebuilt=<0|1> vri=<0|1>
+// rebuilt=1: a full getIndex() rebuild fired while the request was handled (mcpRebuildCounter). vri=1: the request built
+// the value-reference index (McpIndex::valueRefBuilds) — once after every rebuild, never on a warm reuse. Off (the env
+// unset): no clock read, no counter read, nothing printed. stderr only, after the response is out.
+struct McpRequestTiming
 {
-    static std::atomic<std::uint64_t> n{ 0 };
-    return n;
-}
+    explicit McpRequestTiming( bool timingsOn )
+        : m_on( timingsOn )
+    {
+        if( m_on )
+        {
+            m_t0          = std::chrono::steady_clock::now();
+            m_rebuildAt0  = mcpRebuildCounter().load( std::memory_order_relaxed );
+            m_vriAt0      = mcpIndexSlot().valueRefBuilds;
+        }
+    }
+    void emit( std::string_view verb ) const
+    {
+        if( !m_on )
+        {
+            return;
+        }
+        const double   wallMs  = std::chrono::duration<double, std::milli>( std::chrono::steady_clock::now() - m_t0 ).count();
+        const unsigned rebuilt = mcpRebuildCounter().load( std::memory_order_relaxed ) != m_rebuildAt0 ? 1u : 0u;
+        const unsigned vri     = mcpIndexSlot().valueRefBuilds != m_vriAt0 ? 1u : 0u;
+        rw::emitTo( stderr, "ripwire-timing verb={} wall_ms={:.3f} rebuilt={} vri={}\n", verb, wallMs, rebuilt, vri );
+        std::fflush( stderr );
+    }
+
+private:
+    bool                                  m_on = false;
+    std::chrono::steady_clock::time_point m_t0{};
+    std::uint64_t                         m_rebuildAt0 = 0;
+    std::uint64_t                         m_vriAt0     = 0;
+};
 
 // P1-15 — the `_reingest` envelope field for a response whose handling ran an INCREMENTAL pass, or "" when
 // it did not. `passesAtEntry` is McpIndex::incrementalPasses as read before the verb ran; a difference means
@@ -1126,7 +1156,7 @@ inline const ValueRefIndex& valueRefIndexOf( const McpIndex& ix )
     if( !ix.valueRefs )
     {
         ix.valueRefs = std::make_shared<const ValueRefIndex>( ix.ing );
-        mcpValueRefBuildCounter().fetch_add( 1, std::memory_order_relaxed );
+        ++ix.valueRefBuilds;
     }
     return *ix.valueRefs;
 }
```

**File**: `src/mcpserver.h` (modified, +2/-14)
```diff
@@ -31,7 +31,6 @@
 #include <cstring>
 #include <cctype>
 #include <cerrno>
-#include <chrono>
 
 #include "infra/os.h"      // rw::os — socket/bind/listen/accept/recv/send/setsockopt; struct timeval for SO_RCVTIMEO (slow-loris guard)
 
@@ -655,10 +654,7 @@ inline int runMcpHttp( const McpHttpConfig& cfg )
         {
             // authorized, well-formed POST /mcp → the SAME shared handler the stdio loop uses. A notification
             // (no id) gets a bodyless 202; everything else a 200 with the JSON-RPC response as the body.
-            const std::chrono::steady_clock::time_point t0 =
-                timingsOn ? std::chrono::steady_clock::now() : std::chrono::steady_clock::time_point{};
-            const std::uint64_t rebuildAtStart = timingsOn ? mcpRebuildCounter().load( std::memory_order_relaxed ) : 0;
-            const std::uint64_t vriAtStart     = timingsOn ? mcpValueRefBuildCounter().load( std::memory_order_relaxed ) : 0;
+            const McpRequestTiming timing( timingsOn );
 
             const McpDispatchResult r = dispatchMcpLine( req.body, cfg.topK, cfg.stable, cfg.noRedact, policy );
             if( r.isNotification )
@@ -670,15 +666,7 @@ inline int runMcpHttp( const McpHttpConfig& cfg )
                 respond( fd, "200 OK", "application/json", r.resp );
             }
 
-            if( timingsOn )
-            {
-                const double wallMs = std::chrono::duration< double, std::milli >(
-                                          std::chrono::steady_clock::now() - t0 ).count();
-                const unsigned rebuilt = ( mcpRebuildCounter().load( std::memory_order_relaxed ) != rebuildAtStart ) ? 1u : 0u;
-                const unsigned vri     = ( mcpValueRefBuildCounter().load( std::memory_order_relaxed ) != vriAtStart ) ? 1u : 0u;
-                rw::emitTo( stderr, "ripwire-timing verb={} wall_ms={:.3f} rebuilt={} vri={}\n", r.timingVerb.c_str(), wallMs, rebuilt, vri );
-                std::fflush( stderr );
-            }
+            timing.emit( r.timingVerb );   // stderr, after the response (McpRequestTiming, mcpindex.h)
         }
 
         os::close( fd );
```

**File**: `src/valuerefindex.h` (modified, +30/-27)
```diff
@@ -627,6 +627,35 @@ inline ValueRefRows valueRefCallerRows( const IngestResult& ing, const ValueRefI
     return out;
 }
 
+// The --callees row order, a total order on content: the binding site, then the target's name, then through=. Rows tied
+// on all three are two definitions of one name (`fp = helper;` with a `helper` in each of two files): std::sort leaves
+// equal rows in an order each standard library picks differently, and the 64-row window would then show a
+// toolchain-dependent subset — so the definition's path, then its line, decide.
+inline bool vrCalleeRowLess( const IngestResult& ing, const ValueRefRow& a, const ValueRefRow& b )
+{
+    const Reference& ra = ing.references[a.ref];
+    const Reference& rb = ing.references[b.ref];
+    if( ra.fileId != rb.fileId || ra.startByte != rb.startByte )
+    {
+        return vrBindLess( ing, ra, rb );
+    }
+    const Symbol& ta = ing.symbols[a.to];
+    const Symbol& tb = ing.symbols[b.to];
+    if( ta.name != tb.name )
+    {
+        return ta.name < tb.name;
+    }
+    if( a.through != b.through )
+    {
+        return a.through < b.through;
+    }
+    if( ta.fileId != tb.fileId )
+    {
+        return ing.files[ta.fileId] < ing.files[tb.fileId];
+    }
+    return ta.line < tb.line;
+}
+
 // --callees side: the functions `fns` store/pass as values (through= absent unless the same function also calls
 // through that very slot), and the functions they may call through a parameter or a container (through= the written
 // callee; one row per (to, through), bind= its first site, sites= the count).
@@ -686,33 +715,7 @@ inline ValueRefRows valueRefCalleeRows( const IngestResult& ing, const ValueRefI
     {
         out.rows.push_back( std::move( r ) );
     }
-    std::sort( out.rows.begin(), out.rows.end(), [ & ]( const ValueRefRow& a, const ValueRefRow& b )
-    {
-        const Reference& ra = ing.references[a.ref];
-        const Reference& rb = ing.references[b.ref];
-        if( ra.fileId != rb.fileId || ra.startByte != rb.startByte )
-        {
-            return vrBindLess( ing, ra, rb );
-        }
-        if( a.to != b.to && ing.symbols[a.to].name != ing.symbols[b.to].name )
-        {
-            return ing.symbols[a.to].name < ing.symbols[b.to].name;
-        }
-        if( a.through != b.through )
-        {
-            return a.through < b.through;
-        }
-        // same site, same name, same through: two definitions of one name (`fp = helper;` with a `helper` in each of
-        // two files). std::sort leaves equal rows in an order each standard library picks differently, and the 64-row
-        // window would then show a toolchain-dependent subset — so the definition's path, then its line, decide.
-        const Symbol& ta = ing.symbols[a.to];
-        const Symbol& tb = ing.symbols[b.to];
-        if( ta.fileId != tb.fileId )
-        {
-            return ing.files[ta.fileId] < ing.files[tb.fileId];
-        }
-        return ta.line < tb.line;
-    } );
+    std::sort( out.rows.begin(), out.rows.end(), [ & ]( const ValueRefRow& a, const ValueRefRow& b ) { return vrCalleeRowLess( ing, a, b ); } );
     return out;
 }
 
```

**File**: `src/verbs_navigate.h` (modified, +4/-7)
```diff
@@ -552,17 +552,15 @@ struct UseSite { std::uint32_t fileId; std::uint32_t line; rw::RefRole role; std
 // that never matched the row's own root-relative p=, the map's id=, or a git path — the M6/L1/M0-5 finding.
 inline std::pair<std::vector<UseSite>, std::size_t>
 collectUseSites( const rw::IngestResult& ing, const UsesSelector& sel, std::span<const char> isChosenCaller,
-                 std::string_view rootForId = {}, std::span<const rw::NodeId> valueDefs = {},
-                 const rw::ValueRefIndex* valueRefIndex = nullptr )
+                 std::string_view rootForId = {}, std::span<const rw::NodeId> valueDefs = {} )
 {
     using namespace rw;
     std::vector<UseSite> sites;
     std::size_t          callSitesOfName = 0;
     const ElixirResolver elixirResolver( ing );
     // Reference-as-value round: valuerefs.h UsesValueFilter — role="value" sites the resolver binds to the selector's
     // definitions (the same rows --callers shows), never a Through, never a duplicate read row at a value site.
-    // `valueRefIndex`: a caller that already built the index over `ing` (--safe-delete) lends it; null builds one.
-    const UsesValueFilter valueFilter( ing, sel.siteMatchName, valueDefs, valueRefIndex );
+    const UsesValueFilter valueFilter( ing, sel.siteMatchName, valueDefs );
     for( std::uint32_t refIndex = 0; refIndex < ing.references.size(); ++refIndex )
     {
         const Reference& r = ing.references[refIndex];
@@ -983,10 +981,8 @@ std::optional<int> runSafeDelete( const MainDispatch& d )
     // selector grammar, unchanged.
     const UsesSelector        sel            = resolveUsesSelector( ing, cfg.safeDeleteSym, defs );
     const std::vector<char>   isChosenCaller = ( sel.fileQualified || sel.scopeNarrowed ) ? usesChosenCallers( ing, g, defs ) : std::vector<char>{};
-    const rw::ValueRefIndex   sdVri( ing );   // built once: the use-site filter below and the value-ref rows share it
     const auto                sitesPair      = collectUseSites( ing, sel, isChosenCaller,
-                                                                 sdSingleRoot ? std::string_view( cfg.roots[0] ) : std::string_view{}, defs,
-                                                                 &sdVri );
+                                                                 sdSingleRoot ? std::string_view( cfg.roots[0] ) : std::string_view{}, defs );
                                                                                                // .second (the un-narrowed
                                                                                                // call-site total) is not read here;
                                                                                                // .in_id is unused on this verb too, root
@@ -1020,6 +1016,7 @@ std::optional<int> runSafeDelete( const MainDispatch& d )
     // guessing which definition it would apply to.
     // Reference-as-value round: a function a table, field or argument holds is not dead — its value sites are uses
     // (sites above) and they keep dead_code_candidate at 0, exactly as --dead-code's value-ref-excluded= does.
+    const rw::ValueRefIndex sdVri( ing );
     const rw::ValueRefRows  sdValueRefs = rw::valueRefCallerRows( ing, sdVri, defs );
     bool deadCodeCandidate = false;
     if( defs.size() == 1 && callerIds.empty() && sdValueRefs.rows.empty() )
```

---

### Incident Patch 2: `e4729616` (2026-10-04)
**Commit Message**: false edges: go.mod comments, the global object's names as locals, a valid Go fixture

- goModulePathOf cut the `//` comment AFTER trimming and unquoting, so
  `module x // c` gave "x " and `module "x" // c` kept its quotes; every
  in-module call then lost its edge and counted external=. The comment now
  goes first. goModuleTreePaths drops comments before reading a replace line
  too (a commented `// a => ./b` named a junk "//" module).
- jsNoteGlobalSpellings collected only global objects and functions, never
  the global object's own names (self, window, global, globalThis), so
  `var self = this; self.process()` was read as the global object's process
  and the in-repo method edge was dropped. Those names now join the shadow
  walk; an undeclared `self.process()` stays external. JS and TS share it.
- test/falseedgefix/go is now valid Go: the root go.mod requires and locally
  replaces example.com/sub and example.com/vendored, and vendored/ has its
  own go.mod (`go build ./algo` resolves both). The replace-only shape it had
  moves to a twin root, goreplace/, documented as not buildable.

falseedgecheck: new roots gomodcomment/ (comment, quoted path, cmx near
miss) and gorepla

**File**: `src/graph.h` (modified, +4/-2)
```diff
@@ -3352,10 +3352,11 @@ inline std::string goModulePathOf( std::string_view text )
         while( !line.empty() && ( line.front() == ' ' || line.front() == '\t' ) ) { line.remove_prefix( 1 ); }
         if( !line.starts_with( "module" ) || line.size() < 7 || ( line[ 6 ] != ' ' && line[ 6 ] != '\t' ) ) { continue; }
         line.remove_prefix( 7 );
+        line = line.substr( 0, line.find( "//" ) );   // the comment goes FIRST: `module x // c` and `module "x" // c` are x
         while( !line.empty() && ( line.front() == ' ' || line.front() == '\t' ) ) { line.remove_prefix( 1 ); }
         while( !line.empty() && ( line.back() == ' ' || line.back() == '\t' || line.back() == '\r' ) ) { line.remove_suffix( 1 ); }
         if( line.size() >= 2 && line.front() == '"' && line.back() == '"' ) { line = line.substr( 1, line.size() - 2 ); }
-        return std::string( line.substr( 0, line.find( "//" ) ) );
+        return std::string( line );
     }
     return {};
 }
@@ -3373,7 +3374,8 @@ inline std::vector<std::string> goModuleTreePaths( std::string_view text )
     {
         std::size_t end = text.find( '\n', at );
         end = end == std::string_view::npos ? text.size() : end;
-        std::string_view line = trimWs( text.substr( at, end - at ) );
+        std::string_view line = text.substr( at, end - at );
+        line = trimWs( line.substr( 0, line.find( "//" ) ) );   // a comment is no directive: `// a => ./b` names nothing
         at = end + 1;
         if( line.starts_with( "replace" ) )
         {
```

**File**: `src/ingest_jsimports.h` (modified, +5/-4)
```diff
@@ -257,9 +257,10 @@ inline void captureJsModuleAliases( TSNode stmt, std::string_view src, HashMap<s
     }
 }
 
-// FE-A: add to `names` every JS/TS global (externalnames.h kJsGlobalObjectNames / kJsGlobalFunctionNames) the file spells
-// as an identifier token — the set whose declarations the shadow walk records. One linear token scan; comments and
-// strings over-include (a harmless extra name the walk then finds no declaration of).
+// FE-A: add to `names` every JS/TS global (externalnames.h kJsGlobalObjectNames / kJsGlobalFunctionNames, and the names
+// of the global object itself, kJsGlobalAliasNames: `var self = this` hides `self` exactly as `const JSON = …` hides
+// JSON) the file spells as an identifier token — the set whose declarations the shadow walk records. One linear token
+// scan; comments and strings over-include (a harmless extra name the walk then finds no declaration of).
 inline void jsNoteGlobalSpellings( TSNode root, std::string_view src, HashMap<std::string, char>& names )
 {
     const std::uint32_t end = std::min<std::uint32_t>( ts_node_end_byte( root ), static_cast<std::uint32_t>( src.size() ) );
@@ -270,7 +271,7 @@ inline void jsNoteGlobalSpellings( TSNode root, std::string_view src, HashMap<st
         const std::uint32_t start = at;
         while( at < end && namesplit::isIdentChar( src[ at ] ) ) { ++at; }
         const std::string_view token = src.substr( start, at - start );
-        if( externalnames::isJsGlobalName( token ) ) { names.try_emplace( std::string( token ), 1 ); }
+        if( externalnames::jsGlobalKindOf( token ) != externalnames::JsGlobal::None ) { names.try_emplace( std::string( token ), 1 ); }
     }
 }
 
```

**File**: `test/falseedgecheck.sh` (modified, +28/-2)
```diff
@@ -34,13 +34,17 @@
 #            module's `lib.Helper()` (sub/go.mod); a module a LOCAL go.mod `replace` maps into the tree
 #            (`lib.Shape()` via example.com/vendored); a function passed as a value. Root gonomod/ has NO go.mod: its
 #            full-path import of an in-tree package keeps its edge (an unknown module path proves nothing outside).
+#            Root gomodcomment/: a `module x // c` line and a nested `module "y" // c` are x and y (near miss: cmx is
+#            not under cm); root goreplace/: a module only a local `replace` names (its directory has no go.mod).
 #   (B) JS:  JSON.stringify, `const { stringify } = JSON`, `new URL()`, Buffer.from, `globalThis.fetch`, console/Math/
 #            Object/Array/Promise members, require('destroy'), require('supertest'), a receiver from require('qs')
 #            and a name destructured from require('cookie') never reach an in-repo function, getter, method or object
 #            property. Near misses keep: a destructured relative require, a relative-module receiver, relative ES
 #            namespace and default imports (esm/), a file-local `const JSON` shadow, a same-file `function fetch`, a
 #            const arrow function, `ContentType.from` on the in-repo class, `this.set`/`this.get`, and an object's METHOD
-#            destructured from a relative require (`const { tidy } = require( './methods' ); tidy( s )`).
+#            destructured from a relative require (`const { tidy } = require( './methods' ); tidy( s )`), and a
+#            declaration named like the global object (`var self = this`, `const window`, a parameter `global`); the
+#            undeclared `self.process()` beside them is external (also in TS: src/selfalias.ts).
 #   (C) TS:  the global fetch never reaches a class FIELD named fetch, JSON.parse never reaches an exported `parse`,
 #            crypto.subtle.verify never reaches an exported `verify`, `import * as qs from 'qs'` never reaches an
 #            in-repo `stringify`; a file that imports nothing does not reach another file's exported `fetch` (root
@@ -187,7 +191,7 @@ reaches_fn(){
 }
 
 # ── census: one per root, written FIRST so no arm reads a missing file ─────────────────────────────────────────
-ROOTS="go gonomod js ts tsimport py c cpp rs"
+ROOTS="go gonomod gomodcomment goreplace js ts tsimport py c cpp rs"
 for r in $ROOTS; do
     if ! rw "$r" --pin-census="$TMP/$r.tsv" >"$TMP/$r.map.xml"; then no "($r) the census run exited non-zero"; fi
     if [ ! -s "$TMP/$r.tsv" ]; then no "($r) the census run wrote no census — every census arm for this root would be vacuous"; fi
@@ -237,6 +241,16 @@ exactly go callees algo/usesub.go:UseSub "fn Helper sub/lib/lib.go"
 exactly go callees algo/fnval.go:UseFnVal "fn apply algo/fnval.go"
 exactly gonomod callees app/app.go:Run "fn Pick own/own.go"
 exactly go callees algo/vendored.go:UseVendored "fn Shape vendored/lib/lib.go"
+echo "--- (A2) go.mod spellings: a trailing comment on the module line, a quoted path, a replace-only module"
+# A `module x // c` line is x (the comment goes before the trim and the unquote): the in-module call keeps its edge,
+# also for a nested `module "y" // c`. Near miss: a path that only STARTS with the module path (cmx, not cm/) is still
+# outside — a cut that over-trims the module path (at the first '/') would put it in the tree and fail this arm.
+exactly gomodcomment callees app/app.go:Run "fn Shape lib/lib.go"
+exactly gomodcomment callees quoted/app/app.go:Use "fn Mark quoted/lib/lib.go"
+lacks gomodcomment callees app/near.go:Near "Shape lib/lib.go"
+# goreplace/ keeps the replace-only shape the go/ root had before it became buildable Go: legacy/ has no go.mod, so
+# the replace line is the only source of example.com/legacy (twin of the old UseVendored arm)
+exactly goreplace callees app/app.go:UseLegacy "fn Shape legacy/lib/lib.go"
 
 echo "=== (B) JS: globals, required packages, accessors ==="
 lacks js callees lib/response.js:length "stringify lib/query.js"
@@ -250,6 +264,7 @@ lacks js callees lib/encode.js:toQuery "stringify lib/query.js"
 lacks js callees lib/encode.js:readCookies "parse lib/query.js"
 lacks js callees lib/aliases.js:a "stringify lib/query.js"
 lacks js callees lib/aliases.js:b "fetch lib/shadow.js"
+lacks js callees lib/selfalias.js:onMessage "process lib/selfalias.js"
 echo "--- (B) near misses: true edges kept"
 exactly js callees tests/context.test.js:makeCtx "fn request helpers/context.js"
 exactly js callees tests/context.test.js:encodeQuery "fn stringify lib/query.js"
@@ -262,13 +277,19 @@ has js callees lib/request.js:host "method get lib/request.js"
 exactly js callees esm/ns.mjs:nsUse "fn stringify lib/query.js"
 exactly js callees esm/ns.mjs:defUse "fn max lib/util.js"
 exactly js callees lib/usemethods.js:cleanAll "method tidy lib/methods.js"
+# a declaration named like the global object (`var self = this`, a `const window`, a parameter `global`) is a value:
+# the call reaches the in-re
```

**File**: `test/falseedgefix/README.md` (modified, +14/-5)
```diff
@@ -9,17 +9,26 @@ plus near-miss calls whose edges are real and must stay.
   outside the module beside in-repo `NewScreen`/`Split`. Kept: a same-package `min` that shadows the builtin, a
   same-package `copy` (and `min`/`score`/`hook` from another file of the package), `h.append()`, a package-level
   function variable called bare, `own.Pick()` inside the module, a dot-import's bare `Pick()`, a nested module's
-  `lib.Helper()` (`sub/go.mod`). `gonomod/` has no go.mod at all: its full-path import of an in-tree package keeps
-  its edge.
+  `lib.Helper()` (`sub/go.mod`), and `lib.Shape()` through `example.com/vendored`. The root `go.mod` requires and
+  locally replaces both in-tree modules and `vendored/` has its own `go.mod`, so `go build ./algo` resolves them (only
+  `tui/`'s outside package `github.com/example/cells` is unresolvable, by design). `gonomod/` has no go.mod at all:
+  its full-path import of an in-tree package keeps its edge.
+- `gomodcomment/` — a `module x // comment` line and a nested `module "y" // comment`: calls into either module keep
+  their edges; `example.com/cmx/lib` (a path that only starts with the module path) stays outside.
+- `goreplace/` — NOT buildable Go, on purpose: `replace example.com/legacy => ./legacy` with no `legacy/go.mod`, so
+  the replace line is the only source of that module path (in valid Go the replaced directory's own go.mod names
+  it too). It keeps the module census's replace reading under an arm.
 - `js/` — `JSON.stringify`, `new URL()`, `Buffer.from`, `console/Math/Object/Array/Promise` members,
   `const { stringify } = JSON`, `globalThis.fetch`, `require('destroy')`, `require('supertest')`, `require('qs').stringify`, `{ parse } = require('cookie')` beside an
   object property, a getter, a static method, a test double and helpers of those names. Kept: relative requires
   (destructured and as a receiver), relative ES namespace/default imports (`esm/`), a file-local `const JSON` shadow,
-  a same-file `function fetch`, a const arrow.
+  a same-file `function fetch`, a const arrow, and a `var self = this` / `const window` / parameter `global` (a value,
+  not the global object; `lib/selfalias.js` — the undeclared `self.process()` beside them is external).
 - `ts/`, `tsimport/` — the global `fetch` beside a class field and beside another file's exported `fetch`;
   `JSON.parse`, `crypto.subtle.verify`, `import * as qs from 'qs'` beside exported `parse`/`verify`/`stringify`.
   Kept: named and relative namespace imports of the in-repo `parse`/`stringify`/`verify`/`fetch`, `new App()` and
-  `app.dispatch()`, an ambient `declare function track` called from a file that imports nothing.
+  `app.dispatch()`, an ambient `declare function track` called from a file that imports nothing, and a declared
+  `self` / parameter `window` (`src/selfalias.ts`).
 - `py/` (src layout) — `from ui.css.match import match` and `import *` beside two methods named `match`; a bare
   `process()` that only a method defines. Kept: imported `append`/`format`, a same-module helper, a module-level
   callable variable, a bare `Worker()` construction, a class-body call.
@@ -28,4 +37,4 @@ plus near-miss calls whose edges are real and must stay.
 - `rs/` — `use termkit::render; render( n )` beside the method `History::render`. Kept: a same-module function,
   `h.render()`, `History::new()`, `History::render( &h )`, `Self::width()`.
 
-The names are paraphrases of graded false rows; the code is minimal and is never built.
+The names are paraphrases of graded false rows; the code is minimal and the gate never builds it.
```

**File**: `test/falseedgefix/go/go.mod` (modified, +7/-0)
```diff
@@ -2,4 +2,11 @@ module example.com/finder
 
 go 1.22
 
+require (
+	example.com/sub v0.0.0
+	example.com/vendored v0.0.0
+)
+
+replace example.com/sub => ./sub
+
 replace example.com/vendored => ./vendored
```

**File**: `test/falseedgefix/go/vendored/go.mod` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+module example.com/vendored
+
+go 1.22
```

**File**: `test/falseedgefix/gomodcomment/app/app.go` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+package app
+
+import "example.com/cm/lib"
+
+// Run calls into its own module: a true edge.
+func Run(n int) int { return lib.Shape(n) }
```

**File**: `test/falseedgefix/gomodcomment/app/near.go` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+package app
+
+import lib "example.com/cmx/lib"
+
+// Near calls a package OUTSIDE the module whose path only starts with the module path (cmx, not cm/): no edge to
+// the in-tree Shape.
+func Near(n int) int { return lib.Shape(n) }
```

---

### Incident Patch 3: `243622d6` (2026-10-04)
**Commit Message**: train 25 review: kParserVer 141 -> 143 for two extraction fixes

The review fixes in the next two commits change what ingest records: a
declaration named like the JS global object becomes a JsShadow binding, and
a value-reference slot text is cut on a UTF-8 boundary (and a JS string key
is capped). 143, not 142: 141's full-use file tag was 142 (parserVerFor adds
1), and a lean 142 would read those blobs as its own. quality.h's mirror
moves with it; qschemetrip re-pinned with a log entry; kQSnapCacheScheme
stays 17. CHANGELOG's version line says why.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-3)
```diff
@@ -513,10 +513,11 @@ per page instead. Gate: `test/impactdepthcheck.sh`.
 
 ### Changed — the versions this release moves, stated once
 
-`kParserVer` 124 → 141 (the function-literal fix takes 128; #338 and #325 take 129; the body-less C/C++ type-specifier
+`kParserVer` 124 → 143 (the function-literal fix takes 128; #338 and #325 take 129; the body-less C/C++ type-specifier
 span fix and the TypeScript `await f<T>(x)` / `!f<T>(x)` calls each took a number of their own on their branches, as did
-the false-edge resolution (134, 135) and the value-reference rows (140), and 141 then sits above every number a branch
-build of unreleased work has used, so no cache such a build wrote is read as this release's), `kCacheVersion` 25 → 28
+the false-edge resolution (134, 135) and the value-reference rows (140); 141 sat above every number a branch build of
+unreleased work had used, and the review fixes to the global-object shadow and the value-reference slot text take 143,
+above 141's full-use file tag 142, so no cache such a build wrote is read as this release's), `kCacheVersion` 25 → 28
 (the function-literal fix's record changes, then the false-edge fix's member-call fields) and `kQSnapCacheScheme` 15 → 17
 (the `--quality-delta` error-masking and placeholder changes, then the dead kind agreeing with `--dead-code` on functions
 held as values). Every ingest cache written by an earlier build is refused and re-indexed once, and every
```

**File**: `src/ingest_cache.h` (modified, +8/-1)
```diff
@@ -302,7 +302,14 @@ constexpr std::uint32_t kCacheVersion = 28;           // 28: FE-A (test/falseedg
                                                       //    (Py `pkg.mod`, TS `./x`, Rust `crate::a::b`/`mod:x`) —
                                                       //    a target FORMAT change → old caches must be rejected.
                                                       // 4: Include gained a `bool isAngle` (quote/angle) field
-constexpr std::uint32_t kParserVer    = 141;          // bump on any grammar/.scm/extraction change
+constexpr std::uint32_t kParserVer    = 143;          // bump on any grammar/.scm/extraction change
+                                                      // 143 = 2026-10-04 (train 25 review fixes): two extraction changes —
+                                                      //   a declaration named like the global object (`var self = this`, a
+                                                      //   parameter `window`) is now a JsShadow binding, and a value-reference
+                                                      //   slot text (into=/through=) is cut on a UTF-8 boundary, gets "…" only
+                                                      //   when really cut, and a JS string key is capped too. 143, not 142:
+                                                      //   141's RICH file tag was 142 (parserVerFor below adds 1), and a lean
+                                                      //   142 would have read those blobs as its own.
                                                       // 141 = 2026-10-04 (train 25): cache-key hygiene above every branch build's number.
                                                       //   Two merged lanes changed extraction under their own numbers: FE-A 134/135
                                                       //   (member-call shape, ModuleAlias bindings, Rust path calls; kCacheVersion 28)
```

**File**: `src/quality.h` (modified, +1/-1)
```diff
@@ -2180,7 +2180,7 @@ inline std::string cacheRootKeyHex( const std::string& root )
 // not include this header; it relies on ingest.cpp including quality.h (line 13) before ingest_cache.h, and a reorder
 // that broke that fails the build on the undeclared name rather than passing.
 constexpr std::uint32_t kIngestCacheVersionMirror   = 28;   // MUST equal ingest.cpp's kCacheVersion (gated); 28 = FE-A ref memberCall/memberRoot, 27 = corrected fnScope values, 26 = function-local def scope span (25 = #157 + #150)
-constexpr std::uint32_t kIngestParserVerMirror    = 141;  // MUST equal ingest.cpp's kParserVer   (gated)
+constexpr std::uint32_t kIngestParserVerMirror    = 143;  // MUST equal ingest.cpp's kParserVer   (gated)
                                                           // 141 = 2026-10-04 (train 25: above FE-A's 134/135 and refval-edges' 140, see kParserVer
                                                           //   note; kIngestCacheVersionMirror 28 from FE-A, kQSnapCacheScheme 17 from refval-edges)
                                                           // 140 = lane refval-edges (reference-as-value rows; see kParserVer note)
```

**File**: `test/qschemetrip.hash` (modified, +1/-1)
```diff
@@ -1 +1 @@
-d1a2878ce09f5e2ed41e4e0b223abb5e3bac34d560210a513f05da12bf44e6c8
+32240f4552ee695a54f885409b67c60585d6fc7c1f3cffc362313f6c772dafcc
```

**File**: `test/qschemetripcheck.sh` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ SRC="$ROOT/src/quality.h"
 ING="$ROOT/src/ingest_cache.h"   # extraction-identity constants moved here (2026-08-29 ingest.cpp section split); the hashed CONCAT label keeps its historical spelling so the pin holds
 PIN="$ROOT/test/qschemetrip.hash"
 # RE-PIN LOG (the pin is a bare hash, so its justification has to live here).
+# 2026-10-04, train 25 review fixes: RE-DERIVED with UPDATE_GOLDEN=1 (hash 32240f4552…2dafcc). kParserVer 141 -> 143 (two
+#   extraction changes: a declaration named like the JS global object is a JsShadow binding; value-reference slot text
+#   is cut on a UTF-8 boundary and JS string keys are capped) with quality.h's mirror; 143 because 141's full-use file
+#   tag was 142. kQSnapCacheScheme stays 17: what a Snapshot means is unchanged, and every key carries the parser mirror.
 # 2026-10-04, train 25, extractor fix: RE-DERIVED with UPDATE_GOLDEN=1 (hash d1a2878ce0…44e6c8). No source or scheme
 #   change: extract_fn now reads a candidate's whole signature before deciding it is a prototype, so computeSnapshot's
 #   two-line forward declaration is skipped and its REAL definition is hashed for the first time since the import
```

---

### Incident Patch 4: `877aa5ee` (2026-10-04)
**Commit Message**: test: fillordercheck re-pins test/fixture est_tokens 863 -> 905

Found by the train's full suite (shard 1): the v1 header legend's
unresolved=/external= clauses grew by 106 B, so the fixture map's
est_tokens moved with them. test/golden.xml (re-recorded in the same
train) differs from its previous self by exactly those two clauses and
est_tokens=; the order is unchanged (important-first). RE-PIN note in
the gate beside the earlier ones.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `test/fillordercheck.sh` (modified, +4/-1)
```diff
@@ -129,7 +129,10 @@ OFIX="$( order_of test/fixture )"
 # of that spelling as a directory inside the tree: all six <f> rows carried layer="test" (cd test/fixture && ripwire .
 # printed none). The tag now comes from the root-relative path, so the six attributes are gone; the byte model also
 # charges each file path as p= prints it (root-relative) instead of with the typed root prepended.
-{ [ "$EFIX" = "863" ] && [ "$OFIX" = "important-first" ]; } \
+# RE-PIN 2026-10-04 (train 25): 863 -> 905, the document GREW by its legend and nothing else. The v1 header legend's
+# unresolved=/external= clauses now state the false-edge rule (+106 B); test/golden.xml was re-recorded beside it and differs
+# from its previous self by exactly those two clauses and est_tokens=. Order is unchanged (important-first).
+{ [ "$EFIX" = "905" ] && [ "$OFIX" = "important-first" ]; } \
     && ok "test/fixture (est_tokens=$EFIX) does NOT auto-flip — order=$OFIX (golden neutral)" \
     || no "test/fixture unexpectedly changed order or est_tokens (est=$EFIX order=$OFIX)"
 
```

---

### Incident Patch 5: `0944f8fa` (2026-10-04)
**Commit Message**: train 25: kParserVer 141 above every lane build; cache 28, qsnap 17

kParserVer 140 -> 141: the merged lanes built under 134/135 (FE-A) and
140 (refval-edges), main under 133, so 141 is strictly above every
number a branch binary used and no cache such a build wrote is read as
this build's. kCacheVersion stays 28 (FE-A's ref-record change, the
max); kQSnapCacheScheme stays 17 (refval-edges' dead-kind change, the
max). Every ingest key carries kParserVer too, so FE-A's own c28 blobs
(p134/p135) never meet this build's c28p141. quality.h mirrors move with
them; CHANGELOG's versions paragraph names the new numbers; the
qschemetrip pin is re-derived once (RE-PIN LOG entry).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +7/-6)
```diff
@@ -533,12 +533,13 @@ per page instead. Gate: `test/impactdepthcheck.sh`.
 
 ### Changed — the versions this release moves, stated once
 
-`kParserVer` 124 → 133 (the function-literal fix takes 128; #338 and #325 take 129; the body-less C/C++ type-specifier
-span fix and the TypeScript `await f<T>(x)` / `!f<T>(x)` calls each took a number of their own on their branches, and 133
-then sits above every number a branch build of unreleased work has used, so no cache such a build wrote is read as this
-release's), `kCacheVersion` 25 → 27
-(the function-literal fix's record changes) and `kQSnapCacheScheme` 15 → 16 (the `--quality-delta` error-masking and
-placeholder changes). Every ingest cache written by an earlier build is refused and re-indexed once, and every
+`kParserVer` 124 → 141 (the function-literal fix takes 128; #338 and #325 take 129; the body-less C/C++ type-specifier
+span fix and the TypeScript `await f<T>(x)` / `!f<T>(x)` calls each took a number of their own on their branches, as did
+the false-edge resolution (134, 135) and the value-reference rows (140), and 141 then sits above every number a branch
+build of unreleased work has used, so no cache such a build wrote is read as this release's), `kCacheVersion` 25 → 28
+(the function-literal fix's record changes, then the false-edge fix's member-call fields) and `kQSnapCacheScheme` 15 → 17
+(the `--quality-delta` error-masking and placeholder changes, then the dead kind agreeing with `--dead-code` on functions
+held as values). Every ingest cache written by an earlier build is refused and re-indexed once, and every
 cached quality snapshot is recomputed. The session legend dictionary is `dictv=66409821069cf5cb entries=775`.
 
 ### Fixed — test infrastructure: a gate killed mid-run no longer leaves its harness spinning (expandrangecheck, diagnoticecheck)
```

**File**: `src/ingest_cache.h` (modified, +9/-1)
```diff
@@ -302,7 +302,15 @@ constexpr std::uint32_t kCacheVersion = 28;           // 28: FE-A (test/falseedg
                                                       //    (Py `pkg.mod`, TS `./x`, Rust `crate::a::b`/`mod:x`) —
                                                       //    a target FORMAT change → old caches must be rejected.
                                                       // 4: Include gained a `bool isAngle` (quote/angle) field
-constexpr std::uint32_t kParserVer    = 140;          // bump on any grammar/.scm/extraction change
+constexpr std::uint32_t kParserVer    = 141;          // bump on any grammar/.scm/extraction change
+                                                      // 141 = 2026-10-04 (train 25): cache-key hygiene above every branch build's number.
+                                                      //   Two merged lanes changed extraction under their own numbers: FE-A 134/135
+                                                      //   (member-call shape, ModuleAlias bindings, Rust path calls; kCacheVersion 28)
+                                                      //   and refval-edges 140 (reference-as-value rows; kQSnapCacheScheme 17); main
+                                                      //   was 133. 141 is above all of them, so no cache a branch build wrote is ever
+                                                      //   read as this build's. kCacheVersion stays FE-A's 28: every ingest key also
+                                                      //   carries kParserVer (lean 141 / rich 142 file tags, and a refval-edges rich
+                                                      //   blob was c27p141 — a different format number, so never this build's c28p141).
                                                       // 140 = lane refval-edges (reference-as-value round): RefRole::Value /
                                                       //    RefRole::Through rows from ingest_valuerefs.h, in BOTH families.
                                                       //    A lane-local number above train 24's 133 — the train renumbers.
```

**File**: `src/quality.h` (modified, +3/-1)
```diff
@@ -2180,7 +2180,9 @@ inline std::string cacheRootKeyHex( const std::string& root )
 // not include this header; it relies on ingest.cpp including quality.h (line 13) before ingest_cache.h, and a reorder
 // that broke that fails the build on the undeclared name rather than passing.
 constexpr std::uint32_t kIngestCacheVersionMirror   = 28;   // MUST equal ingest.cpp's kCacheVersion (gated); 28 = FE-A ref memberCall/memberRoot, 27 = corrected fnScope values, 26 = function-local def scope span (25 = #157 + #150)
-constexpr std::uint32_t kIngestParserVerMirror    = 140;  // MUST equal ingest.cpp's kParserVer   (gated)
+constexpr std::uint32_t kIngestParserVerMirror    = 141;  // MUST equal ingest.cpp's kParserVer   (gated)
+                                                          // 141 = 2026-10-04 (train 25: above FE-A's 134/135 and refval-edges' 140, see kParserVer
+                                                          //   note; kIngestCacheVersionMirror 28 from FE-A, kQSnapCacheScheme 17 from refval-edges)
                                                           // 140 = lane refval-edges (reference-as-value rows; see kParserVer note)
                                                           // 135 = 2026-10-03 (lane FE-A fix round, see kParserVer note)
                                                           // 134 = 2026-10-03 (lane FE-A, see kParserVer note; 133 is train 24's)
```

**File**: `test/qschemetrip.hash` (modified, +1/-1)
```diff
@@ -1 +1 @@
-a7f2ec25d4432882c7d7f41c95091316329d11df25a45d70ed4be3581c9388db
+723c71a3ded42c08c59f0c76d38f482cf995c7bae72cf625d52303787736d288
```

**File**: `test/qschemetripcheck.sh` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ SRC="$ROOT/src/quality.h"
 ING="$ROOT/src/ingest_cache.h"   # extraction-identity constants moved here (2026-08-29 ingest.cpp section split); the hashed CONCAT label keeps its historical spelling so the pin holds
 PIN="$ROOT/test/qschemetrip.hash"
 # RE-PIN LOG (the pin is a bare hash, so its justification has to live here).
+# 2026-10-04, train 25 (lane/fe-a-false-edges, lane/refval-edges, lane/train24-cr2-followup merged): RE-DERIVED ONCE on
+#   the merged tree with UPDATE_GOLDEN=1 (hash 723c71a3de…36d288). kParserVer 140 -> 141: above FE-A's 134/135 and
+#   refval-edges' 140 (both extraction changes) and train 24's 133; kCacheVersion 28 (FE-A's ref-record change, the max);
+#   kQSnapCacheScheme 17 (refval-edges' dead-kind change, the max); quality.h's mirrors move with them.
 # 2026-10-02, train 24 (recall, answer-honesty, #368, contrib-checklist, hygiene-orphans, readme-terminality merged):
 #   RE-DERIVED ONCE on the merged tree with UPDATE_GOLDEN=1 (hash a7f2ec25d4…9388db). kParserVer 132 -> 133: above the two
 #   merged lanes' extraction changes (130 body-less C/C++ type specifier span; 131 TS/TSX await/unary type-argument
```

---

### Incident Patch 6: `d1094a00` (2026-10-04)
**Commit Message**: fix(valuerefs): complete-class context for C++ members; wrapper decorators don't keep a def out of the dead kind

- C++: a class body is a complete-class context. The class scope now
  pre-reads its field declarations, so a data member declared BELOW a
  member function still shadows a free function of that name. Found by
  the fresh-cache short-name precision read
  (`int was = total; … int total = 0;`). Arm RX4, red on a3ef443a.
- The dead-set exclusion (`--dead-code`, and `--quality-delta`'s dead
  kind since R2) no longer counts a Python wrapper decorator as a value
  use: @classmethod/@staticmethod/@property/@cached_property, the abc
  markers, .setter/.getter/.deleter, @overload/@override and
  @functools.wraps. Each hands the function back to its own name.
  qualitycheck's inherited-hook arm caught it: 30 `@classmethod`
  overrides left the dead kind. A registering decorator still counts.
  The rows are still served (ruling 5); the row-level wrapper floor
  stays a follow-up. Arm Q2, red on a3ef443a.
- The quality-delta legend names the registering decorator and the
  wrapper exception.
- qschemetripcheck RE-PIN LOG: entries for the a3ef443a pin and the
  scheme 17 bump. The

**File**: `CHANGELOG.md` (modified, +8/-3)
```diff
@@ -40,7 +40,10 @@ call-shaped references, so on such a function `--callers`, `--callees`, `--impac
   - A value use counts in `--safe-delete`'s `uses=` and keeps it off `dead_code_candidate`/`risk="none-found"`.
   - `--dead-code` excludes such functions, counted in `value-ref-excluded=`. `--quality-delta`'s dead-code kind
     applies the same rule, with the same counter on its root (and the cached quality snapshot's scheme moves), so the
-    two verbs answer one question one way.
+    two verbs answer one question one way. A Python wrapper decorator does not count as a use: `@classmethod`,
+    `@staticmethod`, `@property`, `@cached_property`, `@abstractmethod`, an accessor's `.setter`/`.getter`/`.deleter`,
+    `@overload` and `@functools.wraps` hand the function back to its own name. Its row is still shown. A registering
+    decorator (`@app.route`, `@register`) does count.
   - `--verify 'unused(X)'` now answers `refuted` for a function a table or argument holds: its `role="value"`
     sites are the evidence (it was `not-established` before, for C and JS).
   - `--uses` shows the site as `role="value"` (a decorator row is a fact about the definition and stays on
@@ -52,7 +55,9 @@ call-shaped references, so on such a function `--callers`, `--callees`, `--impac
   - same file first;
   - a class member is never matched by a bare name outside its class: only a Python class body, or a C++ class
     body or a member function of the same class, sees its members bare. JS/TS and Go members are never bare (the
-    JS call graph binds a bare call to a method by name; these rows deliberately do not);
+    JS call graph binds a bare call to a method by name; these rows deliberately do not). One shape is still
+    indexed as a plain function: a JS/TS object-literal property (`{ run: () => … }`). A bare `run` in the same
+    file can match it ahead of an imported `run`. It did not occur in the django, webpack or ripwire short-name reads;
   - a C/C++ `static` stays in its file;
   - a JS/TS/Python name needs a named import, resolved by the import graph's own module resolver;
   - Go stays in its package.
@@ -81,7 +86,7 @@ call-shaped references, so on such a function `--callers`, `--callees`, `--impac
 - **Manifest.** The `tools/list` manifest grows 46,581 → 46,722 B: the two find descriptions name `valueRefs` as
   not a proven call.
 
-Gate: `test/recallshapecheck.sh`. It has 162 arms across C, C++, JS, JSX, TS, TSX, Python and Go:
+Gate: `test/recallshapecheck.sh`. It has 177 arms across C, C++, JS, JSX, TS, TSX, Python and Go:
 - positives;
 - near-miss negatives for every guard, each proven able to fail by a mutation (`sim/refval_mutate.sh`);
 - named floors;
```

**File**: `src/ingest_valuerefs.h` (modified, +24/-0)
```diff
@@ -676,6 +676,30 @@ class ValueRefWalk
             {
                 functionSignature( n, a.kind, s );
             }
+            else if( s.isClass && m_fam == VrFam::C )
+            {
+                // A C++ class body is a complete-class context: a data member declared BELOW a member function is
+                // still in scope inside it (`int get() { return total; } int total = 0;`), so the class scope
+                // pre-reads its member declarations instead of waiting to encounter them.
+                ChildCursor c( n );
+                forEachNamedChild( n, c.cur, [ & ]( TSNode body )
+                {
+                    if( kindIs( ts_node_type( body ), "field_declaration_list" ) )
+                    {
+                        ChildCursor m( body );
+                        forEachNamedChild( body, m.cur, [ & ]( TSNode k )
+                        {
+                            const char* kt = ts_node_type( k );
+                            if( kindIs( kt, "field_declaration" ) )
+                            {
+                                harvest( k, kt, s.decls );
+                            }
+                            return true;
+                        } );
+                    }
+                    return true;
+                } );
+            }
             else if( sk == ScopeKind::Block )
             {
                 ChildCursor c( n );
```

**File**: `src/valuerefindex.h` (modified, +35/-2)
```diff
@@ -40,6 +40,27 @@ inline bool vrKeyMatches( std::string_view throughKey, std::string_view valueKey
     return throughKey == valueKey;
 }
 
+// A decorator row (`into=@NAME`) whose decorator only wraps the function and binds it back to its own name: the
+// builtin descriptors, abc/typing markers, property accessors and functools.wraps. Keyed on the last dotted segment,
+// so `@abc.abstractmethod`, `@functools.cached_property` and `@x.setter` all match.
+inline bool vrIsWrapperDecorator( std::string_view into ) noexcept
+{
+    if( !into.starts_with( '@' ) )
+    {
+        return false;
+    }
+    std::string_view last = into.substr( 1 );
+    if( const std::size_t dot = last.rfind( '.' ); dot != std::string_view::npos )
+    {
+        last = last.substr( dot + 1 );
+    }
+    static constexpr std::string_view kWrappers[] = {
+        "classmethod", "staticmethod", "property", "cached_property", "abstractmethod", "abstractproperty",
+        "abstractclassmethod", "abstractstaticmethod", "setter", "getter", "deleter", "overload", "override", "wraps",
+    };
+    return std::ranges::find( kWrappers, last ) != std::end( kWrappers );
+}
+
 // The index every verb queries. Built from one IngestResult in O(refs + symbols); no graph needed.
 class ValueRefIndex
 {
@@ -116,10 +137,22 @@ class ValueRefIndex
         return out;
     }
 
-    // True when at least one value reference resolves to `def`.
+    // True when at least one value reference resolves to `def` and can make it reachable: the dead-set question
+    // (--dead-code, --quality-delta). A Python descriptor/typing WRAPPER decorator row does not count. `@classmethod`,
+    // `@property` or `@functools.wraps` hands the function back to the same name, so it is still reached only by a
+    // call. A registering decorator (`@app.route`, `@register`) is the value use this exclusion exists for. The row
+    // itself is still served (ruling 5); the wrapper FLOOR for rows is a follow-up.
     bool isValueReferenced( NodeId def ) const
     {
-        return m_valuesByTarget.find( def ) != m_valuesByTarget.end();
+        const auto it = m_valuesByTarget.find( def );
+        if( it == m_valuesByTarget.end() )
+        {
+            return false;
+        }
+        return std::ranges::any_of( it->second, [ & ]( std::uint32_t k )
+        {
+            return !vrIsWrapperDecorator( m_ing.references[ m_values[k] ].fieldName );
+        } );
     }
 
     // The resolved targets of value reference `refIdx` (an index into ing.references).
```

**File**: `src/verbs_quality.h` (modified, +2/-1)
```diff
@@ -867,7 +867,8 @@ inline void emitQualityDeltaLegend( const QualityDeltaLegendParts& p )
     if( p.anyValueRefExcluded )
     {
         rw::emitRaw( stdout, "value-ref-excluded= is a FLOOR, not a finding: symbols this run kept out of the dead-code kind only because a table, "
-                             "field or argument holds them as a VALUE (matched by name; it is not a proven call; the callers verb lists the sites), "
+                             "field, argument or registering decorator holds them as a VALUE (matched by name; it is not a proven call; the callers "
+                             "verb lists the sites; @classmethod-style wrappers do not count), "
                              "the --dead-code verb's own rule. Never gates; absent at zero. " );
     }
 
```

**File**: `test/qschemetripcheck.sh` (modified, +12/-0)
```diff
@@ -34,6 +34,18 @@ SRC="$ROOT/src/quality.h"
 ING="$ROOT/src/ingest_cache.h"   # extraction-identity constants moved here (2026-08-29 ingest.cpp section split); the hashed CONCAT label keeps its historical spelling so the pin holds
 PIN="$ROOT/test/qschemetrip.hash"
 # RE-PIN LOG (the pin is a bare hash, so its justification has to live here).
+# 2026-10-03, lane/refval-edges fix round (R2 of its final review): kQSnapCacheScheme 16 -> 17. A function a value
+#   holds (a struct/dict/object table entry, a callback argument; valuerefindex.h isValueReferenced) leaves the
+#   Snapshot's dead set, so a v16 blob would carry the old, wider set. The pinned hash does NOT move, and that is a
+#   gap in this gate, not a refactor: extract_fn's forward-declaration skip tests only the FIRST signature line.
+#   computeSnapshot's two-line forward declaration therefore starts the capture, which then runs on into
+#   computeHeadSnapshot, so the hashed "computeSnapshot" text is computeHeadSnapshot's body and the real
+#   dead-set builder is not watched. The scheme moved anyway. The extractor fix is left to its own change,
+#   since it re-pins for every lane.
+# 2026-10-02, lane/refval-edges (a3ef443a): RE-DERIVED with UPDATE_GOLDEN=1 (hash 6ffa0ec399…ee4815). kParserVer
+#   132 -> 140 (lane-local; a train renumbers it): RefRole::Value / RefRole::Through references are extracted for
+#   C/C++, JS/TS, Python and Go. quality.h's kIngestParserVerMirror moves with it (qextractionkeycheck).
+#   kCacheVersion stays 27; no hashed quality.h function changed in that commit.
 # 2026-10-02, train 23 (map data sections + edit-check pairing merged): RE-DERIVED ONCE on the merged tree with
 #   UPDATE_GOLDEN=1 (hash e355d7b821…1518a2). kParserVer 129 -> 132 for cache-key hygiene only (branch builds already ran
 #   at 129, 130 and 131; no extraction change); kCacheVersion stays 27, kQSnapCacheScheme stays 16; quality.h's
```

**File**: `test/recallshapecheck.sh` (modified, +47/-2)
```diff
@@ -762,6 +762,12 @@ struct Sorter {
     void sortAll(std::vector<int>& v) { std::sort(v.begin(), v.end(), lessThan); } // @XM_SAME a member of the SAME class is in scope
 };
 int useCount() { return count(1); }
+static int total(int x) { return x; }
+struct Late {
+    int get() const { return keepX(total); }                                       // @XM_LATE a member declared BELOW is in scope
+    int total = 0;
+};
+int useTotal() { return total(2); }
 EOF
 cat >"$FX/jsmem/m.js" <<'EOF'
 class Runner {
@@ -1199,6 +1205,8 @@ arm "RX1 negatives: memcpy( data, … ) in FixedStr is its member array — neve
     cppmem --callers=data attr:defs=1 noattr:value_refs nvr:0 'novr:bind=@XM_DATA'
 arm "RX2 negatives: a C++ data member named count shadows the free function count inside its class" \
     cppmem --callers=count attr:count=1 noattr:value_refs nvr:0 'novr:bind=@XM_FIELD'
+arm "RX4 negatives: a C++ class body is a complete-class context — a data member declared below the method still shadows" \
+    cppmem --callers=total attr:count=1 noattr:value_refs nvr:0 'novr:bind=@XM_LATE'
 arm "RX3 a static member of the SAME class is in scope: std::sort(…, lessThan)" \
     cppmem --callers=lessThan attr:value_refs=1 nvr:1 'vr:bind=@XM_SAME;into=std::sort#arg2'
 arm "RJ1 negatives: { load: require } is the global require — never the class method Runner#require" \
@@ -1209,9 +1217,9 @@ arm "RJ2 negatives: [source] is the file-scope let — never the class method Ru
 # ── --verify and --quality-delta read the same value uses (final review R4, R2) ──────────────────────────
 echo "-- verify / quality-delta"
 arm "V1 verify unused(my_open): a value use REFUTES 'unused' (the role=value sites are the evidence)" \
-    c --verify=unused(my_open) attr:verdict=refuted 'u:role=value;p=@C_TABLE'
+    c '--verify=unused(my_open)' attr:verdict=refuted 'u:role=value;p=@C_TABLE'
 arm "V2 verify unused(truly_dead): nothing holds it — the verdict is unchanged" \
-    c --verify=unused(truly_dead) attr:verdict=not-established nu:0
+    c '--verify=unused(truly_dead)' attr:verdict=not-established nu:0
 
 # R2: --quality-delta's dead kind applies the --dead-code verb's rule — a static a struct table holds is not dead there
 # either (one fact, two verbs, one answer). A two-commit repo: the second commit adds the table-held static and a truly
@@ -1252,6 +1260,43 @@ EOF
     verdict "Q1 quality-delta dead kind: the table-held static is value-ref-excluded=1, the truly dead one is still a row" "$res"
 fi
 
+# Q2: a registering decorator holds the function; a WRAPPER decorator (@staticmethod, @functools.wraps…) only hands it
+# back to its own name, so it does not exclude the function from the dead kind (qualitycheck's inherited-hook arm).
+QP="$FX/qdpy"; mkdir -p "$QP"
+(
+    cd "$QP" && git init -q && git config user.email t@t && git config user.name t \
+    && printf 'def base():\n    return 1\n' > m.py && git add -A && git commit -qm base \
+    && printf '%s\n' 'import functools' 'REG = []' 'def register(f):' '    REG.append(f)' '    return f' \
+                     '@register' 'def held_by_registry(x):' '    return x' \
+                     '@functools.wraps(print)' 'def only_wrapped(x):' '    return x' \
+                     'class Box:' '    @staticmethod' '    def never_called(x):' '        return x' >> m.py \
+    && git add -A && git commit -qm add
+) >/dev/null 2>&1 || no "Q0 the Python quality-delta fixture repository could not be built"
+( cd "$QP" && "$BIN" . --quality-delta=HEAD~1..HEAD --no-cache --legend=compact >"$TMP/qdpy.xml" 2>"$TMP/qdpy.err" )
+qdrc=$?
+if [ "$qdrc" -gt 2 ]; then
+    no "Q2 --quality-delta exited $qdrc ($(head -c 200 "$TMP/qdpy.err"))"
+else
+    res="$( python3 - "$TMP/qdpy.xml" <<'EOF'
+import re, sys
+t = open( sys.argv[1] ).read()
+root = re.search( r"<quality-delta[^>]*>", t )
+rows = re.findall( r'<r kind="dead-code" sym="([^"]*)"', t )
+fails = []
+m = re.search( r'value-ref-excluded="(\d+)"', root.group( 0 ) ) if root else None
+if m is None or m.group( 1 ) != "1":
+    fails.append( "value-ref-excluded=%r (want '1')" % ( m.group( 1 ) if m else None ) )
+for want in ( "never_called", "only_wrapped" ):
+    if not any( s.endswith( want ) for s in rows ):
+        fails.append( "no dead-code row for %s (a wrapper decorator is not a value use): %r" % ( want, rows ) )
+if any( s.endswith( "held_by_registry" ) for s in rows ):
+    fails.append( "a dead-code row for held_by_registry, which @register holds: %r" % rows )
+print( "FAIL " + " | ".join( fails ) if fails else "OK" )
+EOF
+)"
+    verdict "Q2 quality-delta: @register holds held_by_registry (excluded); @staticmethod/@functools.wraps defs stay dead rows" "$res"
+fi
+
 # ── Runaway guard (review fix 8): one function stored 300 times ─────────────────────────────────────────
 echo "-- runaway guard"
 arm "Z1 callers hot: value_refs=300 stays whole; the <vrs> window shows 64, capped=1, next= names the paging verb" \
```

---

### Incident Patch 7: `f0bb69e5` (2026-10-04)
**Commit Message**: test: closure.py fixture body no longer clones another fixture (quality-delta)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `test/falseedgefix/py/src/ui/closure.py` (modified, +4/-1)
```diff
@@ -12,7 +12,10 @@ def line_width(x):
             # label_width is the enclosing method's local (the bound method): a true edge
             return label_width(x)
 
-        return [line_width(x) for x in xs]
+        widest = 0
+        for x in xs:
+            widest = max(widest, line_width(x))
+        return widest
 
 
 def wrap(reparse):
```

---

### Incident Patch 8: `93f86f4f` (2026-10-03)
**Commit Message**: fix(valuerefs): a Python def is a class member only when its class is its innermost definition

Python's tags.scm has no @definition.method. Every def is a Function
whose scope is the nearest enclosing class at any depth. So the R1
filter, which keyed on SymKind::Method, never fired for Python, and
RM1–RM3 would have stayed red.

The index now marks a Python def as a member only when its innermost
enclosing def span is the class its scope names. A helper nested in a
method is that method's local, which new positive arm RM5 checks.

A Python nested class's body no longer sees the outer class's names.
A C++ nested class's body still does.

Not built yet; the table remeasure holds the machine.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/valuerefindex.h` (modified, +74/-2)
```diff
@@ -54,6 +54,7 @@ class ValueRefIndex
                 m_fnByName[ s.name ].push_back( id );
             }
         }
+        markPythonMembers();
         for( std::uint32_t i = 0; i < ing.references.size(); ++i )
         {
             const Reference& r = ing.references[i];
@@ -316,6 +317,73 @@ class ValueRefIndex
         return resolvePythonModuleSuffix( b.typeName, m_fileIndex, m_ing.fileRoot.empty() ? nullptr : &m_ing.fileRoot, b.fileId );
     }
 
+    // Python's tags.scm has no @definition.method: every `def` is a Function, and its `scope` is the nearest
+    // enclosing class at ANY depth (a helper nested inside a method carries the class too). A Function is a class
+    // MEMBER only when its innermost enclosing definition is that class itself, which this sweep decides from the
+    // def spans: per file, defs sorted by start (widest first), a stack of the open ones.
+    void markPythonMembers()
+    {
+        std::vector<NodeId> py;
+        for( NodeId id = 0; id < m_ing.symbols.size(); ++id )
+        {
+            const Symbol& s = m_ing.symbols[id];
+            if( s.lang == Lang::Python
+                && ( s.kind == SymKind::Function || s.kind == SymKind::Method || s.kind == SymKind::Class ) )
+            {
+                py.push_back( id );
+            }
+        }
+        if( py.empty() )
+        {
+            return;
+        }
+        m_pyMember.assign( m_ing.symbols.size(), 0 );
+        std::ranges::sort( py, [ & ]( NodeId a, NodeId b )
+        {
+            const Symbol& x = m_ing.symbols[a];
+            const Symbol& y = m_ing.symbols[b];
+            if( x.fileId != y.fileId )
+            {
+                return x.fileId < y.fileId;
+            }
+            if( x.sigStartByte != y.sigStartByte )
+            {
+                return x.sigStartByte < y.sigStartByte;
+            }
+            return x.endByte != y.endByte ? x.endByte > y.endByte : a < b;
+        } );
+        std::vector<NodeId> open;
+        for( const NodeId id : py )
+        {
+            const Symbol& s = m_ing.symbols[id];
+            while( !open.empty() )
+            {
+                const Symbol& o = m_ing.symbols[ open.back() ];
+                if( o.fileId == s.fileId && o.sigStartByte <= s.sigStartByte && s.endByte <= o.endByte )
+                {
+                    break;
+                }
+                open.pop_back();
+            }
+            if( s.kind != SymKind::Class && !s.scope.empty() && !open.empty() )
+            {
+                const Symbol& owner = m_ing.symbols[ open.back() ];
+                m_pyMember[id] = owner.kind == SymKind::Class && owner.name == s.scope ? 1 : 0;
+            }
+            open.push_back( id );
+        }
+    }
+
+    // A class member, in every armed language: a Method, or a Python def whose innermost enclosing def is its class.
+    bool isClassMember( const Symbol& s ) const noexcept
+    {
+        if( s.kind == SymKind::Method )
+        {
+            return true;
+        }
+        return s.lang == Lang::Python && s.id < m_pyMember.size() && m_pyMember[ s.id ] != 0;
+    }
+
     // Is the class member `m` in bare-name scope at reference `r`? The call graph's own visibility, per language:
     //   * a decorator row names the definition it decorates — the decorated def itself, in this file;
     //   * Python: only the class BODY sees its members bare (`__str__ = render`, `property( _get )`); a method body
@@ -339,7 +407,10 @@ class ValueRefIndex
         const Symbol& f      = m_ing.symbols[ r.fromSymbol ];
         const bool    fIsFn  = f.kind == SymKind::Function || f.kind == SymKind::Method;
         const bool    fClass = ( f.kind == SymKind::Class || f.kind == SymKind::Struct ) && f.name == m.scope;
-        const bool    inBody = !fIsFn && f.fileId == m.fileId && ( fClass || f.scope == m.scope );
+        // a statement of the class body (owned by the class, or by an annotated attribute of it); a Python NESTED class's
+        // body does not see the outer class's names, a C++ one does
+        const bool    inBody = !fIsFn && f.fileId == m.fileId
+                            && ( fClass || ( f.scope == m.scope && ( fam == VrLangFamily::C || f.kind != SymKind::Class ) ) );
         if( inBody )
         {
             return true;   // the class body itself
@@ -366,7 +437,7 @@ class ValueRefIndex
             {
                 continue;
             }
-            if( s.kind == SymKind::Method && !memberVisibleFrom( r, s, fam ) )
+            if( isClassMember( s ) && !memberVisibleFrom( r, s, fam ) )
             {
                 continue;   // a class member is never in BARE-name scope outside its class (R1 of the final review)
             }
@@ -456,6 +527,7 @@ class ValueRefIndex
 
     const IngestResult&                                  m_ing;
     HashMap<std::string, std::vector<NodeId>>            m_fnByName;
+    std::vector<std::uint8_t>                            m_pyMember;   /
```

**File**: `test/recallshapecheck.sh` (modified, +9/-0)
```diff
@@ -734,6 +734,13 @@ class Sorter:
         return 1
 
     __str__ = render  # @PM_CLASSBODY the class body DOES see its members
+
+
+class Pipeline:
+    def run(self, xs):
+        def step(x):
+            return x
+        return sorted(map(step, xs))  # @PM_NESTED a def nested in a method is that method's local, not a member
 EOF
 cat >"$FX/cppmem/m.cpp" <<'EOF'
 #include <algorithm>
@@ -1186,6 +1193,8 @@ arm "RM3 negatives: sorted(xs, key=keyfn) inside a method never reaches the sibl
     pymem --callers=keyfn attr:defs=1 noattr:value_refs nvr:0 'novr:bind=@PM_SIBLING'
 arm "RM4 the class BODY sees its members: __str__ = render" \
     pymem --callers=render attr:value_refs=1 nvr:1 'vr:bind=@PM_CLASSBODY;into=__str__'
+arm "RM5 a def NESTED in a method (its scope names the class too) is the method's local and stays in scope" \
+    pymem --callers=step attr:value_refs=1 nvr:1 'vr:bind=@PM_NESTED;into=map#arg0'
 arm "RX1 negatives: memcpy( data, … ) in FixedStr is its member array — never Vec::data()" \
     cppmem --callers=data attr:defs=1 noattr:value_refs nvr:0 'novr:bind=@XM_DATA'
 arm "RX2 negatives: a C++ data member named count shadows the free function count inside its class" \
```

---

### Incident Patch 9: `78ac1056` (2026-10-03)
**Commit Message**: fix(valuerefs): class members are never bare names; --quality-delta's dead kind agrees with --dead-code

Final review fix round, R1 to R4. This commit was written while the
table remeasure held the machine, so it is not built or gated yet; the
next commit records that run.

R1 (blocking). The value-reference resolver indexed methods as if they
were free functions. That bound django's `isinstance(x, (list, tuple))`
to methods named list/tuple, a C++ data member `data` to
svector::data(), and webpack's `{ load: require }` to a class method.
resolveName now admits a method only from inside its class, matching
the call graph's visibility:
- a Python class body;
- a C++ class body or a member function of the same class;
- never from JS/TS or Go.
The JS call graph's own bare-name-to-method binding is deliberately not
copied. The walk also treats C++ data members as declarations in the
class scope that member functions see. New arms built from the real
near misses: RM1–RM3 and RX1–RX2, RJ1–RJ2 (red on a3ef443a), plus the
positive twins RM4 (class body) and RX3 (same-class static member).

R2 (ruling 3). --quality-delta's dead kind now applies the --dead-code
rule. A value-held function is

**File**: `CHANGELOG.md` (modified, +12/-3)
```diff
@@ -38,14 +38,21 @@ call-shaped references, so on such a function `--callers`, `--callees`, `--impac
 - **Other verbs.**
   - `--impact` and `--safe-delete` disclose the rows.
   - A value use counts in `--safe-delete`'s `uses=` and keeps it off `dead_code_candidate`/`risk="none-found"`.
-  - `--dead-code` excludes such functions, counted in `value-ref-excluded=`.
+  - `--dead-code` excludes such functions, counted in `value-ref-excluded=`. `--quality-delta`'s dead-code kind
+    applies the same rule, with the same counter on its root (and the cached quality snapshot's scheme moves), so the
+    two verbs answer one question one way.
+  - `--verify 'unused(X)'` now answers `refuted` for a function a table or argument holds: its `role="value"`
+    sites are the evidence (it was `not-established` before, for C and JS).
   - `--uses` shows the site as `role="value"` (a decorator row is a fact about the definition and stays on
     `--callers` only).
   - `--path` adds `to_value_refs=` when no call path exists.
   - The rows also appear in CLI `--json`, in MCP `find_referencing_symbols`/`find_symbol` (`valueRefs`,
     `valueCallees`), and in MCP `impact`, `uses` and `path_between`.
-- **Matching.** Rows are matched by name with the call graph's own visibility:
+- **Matching.** Rows are matched by name with the call graph's visibility rules:
   - same file first;
+  - a class member is never matched by a bare name outside its class: only a Python class body, or a C++ class
+    body or a member function of the same class, sees its members bare. JS/TS and Go members are never bare (the
+    JS call graph binds a bare call to a method by name; these rows deliberately do not);
   - a C/C++ `static` stays in its file;
   - a JS/TS/Python name needs a named import, resolved by the import graph's own module resolver;
   - Go stays in its package.
@@ -59,7 +66,9 @@ call-shaped references, so on such a function `--callers`, `--callees`, `--impac
   - an import alias;
   - a function used as the object of a member access (`f.bind`);
   - a macro body;
-  - a class used as a value.
+  - a class used as a value;
+  - a C++ member function defined OUT of its class (`int T::f() { … }`) does not see T's data members, so a data
+    member named like a free function can still read as that function there.
   Every decorated def is a row: the capture is syntactic and cannot tell a registering decorator from
   `@property`.
 - **Byte identity.** An answer with no value reference is byte-identical. On 33 sampled commands over this
```

**File**: `docs/LIMITS.md` (modified, +1/-1)
```diff
@@ -935,7 +935,7 @@ Discloses: `name_ladder_capped`
 | `kTestHopBasenameRowCap` | `3` | OUTPUT | — |
 | `kTestHopCalleeRowCap` | `5` | OUTPUT | — |
 
-### `src/valuerefs.h`
+### `src/valuerefindex.h`
 
 Discloses: **none**
 
```

**File**: `src/ingest_valuerefs.h` (modified, +3/-2)
```diff
@@ -396,6 +396,7 @@ class ValueRefWalk
                     } );
                 }
                 else if( kindIs( t, "declaration" ) || kindIs( t, "parameter_declaration" ) || kindIs( t, "for_range_loop" )
+                         || kindIs( t, "field_declaration" )
                          || kindIs( t, "optional_parameter_declaration" ) || kindIs( t, "condition_clause" ) )
                 {
                     ChildCursor c( n );
@@ -732,9 +733,9 @@ class ValueRefWalk
         for( std::size_t k = m_scopes.size(); k > 1; --k )
         {
             const VrScope& sc = m_scopes[k - 1];
-            if( sc.isClass && k != m_scopes.size() )
+            if( sc.isClass && k != m_scopes.size() && m_lang != Lang::Cpp )
             {
-                continue;   // a class attribute is not visible inside the class's methods
+                continue;   // a Python/JS class attribute is not visible inside the class's methods; a C++ data member IS
             }
             if( std::ranges::find( sc.decls, name ) != sc.decls.end() )
             {
```

**File**: `src/mcpverbs.h` (modified, +3/-1)
```diff
@@ -3764,6 +3764,7 @@ struct QualityDeltaOutcome
     std::size_t                       ackedByContent   = 0;
     std::size_t                       registerMacroExcluded = 0;   // P2.2: the CLI's disclosed dead-code exemption count — see quality.h
     std::size_t                       declinedCallExcluded  = 0;   // the CLI's declined-call-excluded= (absent at zero, as there)
+    std::size_t                       valueRefExcluded      = 0;   // the CLI's value-ref-excluded= (absent at zero, as there)
     std::size_t                       apiNewSurface         = 0;   // Q-DIAL-4: the CLI's api-new-surface= count — see quality.h
     // #228: the CLI root's head_basis= twin — see quality::HeadBasis for the value vocabulary. Present-only in
     // the JSON, under the same absent-means-the-ordinary-archived-tree rule as the CLI, so mcpclidiffcheck's
@@ -3893,7 +3894,7 @@ inline QualityDeltaOutcome computeQualityDelta( const std::string& root )
     const auto heal = rw::quality::healIdentity( baseSel.snapshot, acks, ing, g, root, root, /*wantContentIds=*/false );
 
     oc.regs       = rw::quality::computeDelta( ing, g, baseSel.snapshot, root, {}, rw::kDefaultMaxFileBytes, &oc.registerMacroExcluded, &oc.apiNewSurface,
-                                               nullptr, &oc.declinedCallExcluded );
+                                               nullptr, &oc.declinedCallExcluded, &oc.valueRefExcluded );
 
     // signal-to-noise round: honor the per-finding ack ratchet exactly like the CLI — the acks sidecar is
     // root-qualified (same SIDECAR LOCATION discipline as the baseline), suppression is reported via `acked`.
@@ -3972,6 +3973,7 @@ inline std::pair<std::string, std::string> qualityDeltaJson( const std::string&
                     // Q-DIAL-4 — same always-present rule, same mcpclidiffcheck key-set lens.
                     + ",\"api-new-surface\":" + std::to_string( oc.apiNewSurface )
                     + ( oc.declinedCallExcluded == 0 ? std::string() : ",\"declined-call-excluded\":" + std::to_string( oc.declinedCallExcluded ) )
+                    + countFieldOrEmpty( "value-ref-excluded", oc.valueRefExcluded, /*json=*/true )
                     // R1 IDENTITY — the CLI root's identity disclosure, spelled in JSON. Present only when
                     // git could be read at all, exactly like the CLI arm (absent ≠ zero — see the legend).
                     + oc.identityJson
```

**File**: `src/quality.h` (modified, +24/-3)
```diff
@@ -22,6 +22,7 @@
 #include "model.h"
 #include "ingest.h"             // ingest() — the HEAD-tree snapshot re-ingests the archived commit (computeHeadSnapshot)
 #include "graph.h"
+#include "valuerefindex.h"       // reference-as-value round: a function a table/field/argument holds is not dead (dead kind)
 #include "clones.h"
 #include "cloneidiom.h"         // idiom-class demotion — the closed 3-idiom shape classifier that turns an idiom-COLLISION clone group into a minor row instead of a gating one
 #include "lintrules.h"          // findQualityConstructs — the built-in error-masking rule table (GitClear +47% kind) + the placeholder shapes
@@ -3366,7 +3367,11 @@ inline void evictOldHeadSnapCaches( const std::string& dir, const std::string& r
 // (log-only, rethrow-only): a BLOB SHAPE change and a change to what a cached Snapshot's mask counts mean.
 // A v15 blob is short two maps and its mask counts are low, so served here it would read every widened shape
 // as newly added. Bumped by the v4/v5 rule.
-constexpr std::uint32_t kQSnapCacheScheme = 16;
+// v17 (lane/refval-edges, reference-as-value round) — the dead set no longer holds a function a table, field or
+// argument holds as a VALUE (valuerefindex.h ValueRefIndex::isValueReferenced, checked after every other exemption,
+// counted as value-ref-excluded= like --dead-code): the dead SET moved, as in v9/v12/v15. kParserVer moved with
+// the extraction (the Value/Through rows) and its mirror moved with it. Bumped 16 -> 17.
+constexpr std::uint32_t kQSnapCacheScheme = 17;
 constexpr char          kQSnapMagic[4]    = { 'Q', 'S', 'N', 'P' };
 
 // The qsnap EXCLUDES-config key folds the qsnap SCHEME (independent of the ingest cache's kHeadSnapCacheScheme)
@@ -4535,6 +4540,7 @@ inline Snapshot computeSnapshot( const IngestResult& ing, const Graph& g, std::s
     const std::vector<std::string>   macroNames      = registeredMacroNames( root );             // P2.2: built-ins + .ripwire_config
     const std::vector<NodeId>        macroIds        = registeredMacroSymbolIds( ing, macroNames );
     const std::vector<NodeId>        pythonDispatch  = pythonDispatchedMethodIds( ing, g );
+    const ValueRefIndex              valueRefs( ing );                                           // a value-held function is not dead
     for( NodeId i = 0; i < ing.symbols.size(); ++i )
     {
         if( i >= g.canonId.size() || g.canonId[i].empty() )
@@ -4561,7 +4567,8 @@ inline Snapshot computeSnapshot( const IngestResult& ing, const Graph& g, std::s
         // (editcheck.h). A COUNT is overload-collision-proof for the opposite reason a MAX is: it is the one
         // number a collision cannot hide. (maskBySym is the other non-MAX kind; it sums for its own reason.)
         { std::uint32_t& slot = snap.defsBySym[ key ];    slot += 1; }
-        if( isDeadCandidate( ing, g, i, topLevelCallees, macroIds, pythonDispatch ) && !declinedCallMayReach( g, i ) )
+        if( isDeadCandidate( ing, g, i, topLevelCallees, macroIds, pythonDispatch ) && !declinedCallMayReach( g, i )
+            && !valueRefs.isValueReferenced( i ) )
         {
             snap.dead.push_back( key );
         }
@@ -7957,12 +7964,17 @@ inline std::vector<Regression> computeDelta( const IngestResult& ing, const Grap
                                              std::size_t* registerMacroExcludedOut = nullptr,   // P2.2: honest disclosure count, additive+optional — see isDeadCandidate
                                              std::size_t* apiNewSurfaceOut = nullptr,          // Q-DIAL-4: the api-surface new-symbol COUNT that replaced N never-gating rows
                                              std::vector<CloneIdiomFact>* cloneIdiomsOut = nullptr,   // every CURRENT-tree clone group's (hash, idiom), for the legacy-ack backfill
-                                             std::size_t* declinedCallExcludedOut = nullptr )         // symbols kept out of dead-code ONLY by a declined call (declinedCallMayReach)
+                                             std::size_t* declinedCallExcludedOut = nullptr,          // symbols kept out of dead-code ONLY by a declined call (declinedCallMayReach)
+                                             std::size_t* valueRefExcludedOut = nullptr )             // ... ONLY because a table/field/argument holds them as a VALUE
 {
     if( declinedCallExcludedOut )
     {
         *declinedCallExcludedOut = 0;
     }
+    if( valueRefExcludedOut )
+    {
+        *valueRefExcludedOut = 0;
+    }
     ASSUME( registerMacroExcludedOut == nullptr || registerMacroExcludedOut != apiNewSurfaceOut,
                  "computeDelta: registerMacroExcludedOut and apiNewSurfaceOut must be distinct" );   // both default to nullptr, so the object form would dereference null
     std::vector<Regression> regs;
@@ -8391,6 +8403,7 @@ inline std::vector<Regression> computeDelta( const IngestResult& ing, const Grap
     const std::vector<std::string>   macroNames      = registeredMacroNa
```

**File**: `src/valuerefindex.h` (added, +659/-0)
```diff
@@ -0,0 +1,659 @@
+#pragma once
+// valuerefindex.h — the resolution core of the reference-as-value rows (src/valuerefs.h says what a row means):
+// ValueRefIndex, the rows every surface serves, the --uses filter and the --path count. No rendering and no
+// serialize.h, so quality.h (the --quality-delta dead kind) can include it without an include cycle.
+
+#include "graph.h"             // jsImportKey — the "fileId#name" key, reused for containers
+#include "mention.h"           // pathStem — a module path's file stem
+#include "resolve.h"           // includerDir, resolvePreciseInclude — a module path's file
+#include "infra/Diagnostics.h"   // EXPECTS/ENSURES — the window and index invariants
+#include "model.h"
+
+#include <algorithm>
+#include <cstddef>
+#include <cstdint>
+#include <iterator>
+#include <optional>
+#include <span>
+#include <string>
+#include <string_view>
+#include <utility>
+#include <vector>
+
+namespace rw
+{
+
+// The default display window of the <vrs> rows (the runaway guard): value_refs= and total= stay whole, the rows
+// beyond it are counted (capped="1") and the next= verb (--uses=SYM) pages every site.
+inline constexpr std::size_t kValueRefRowCap = 64;
+
+using VrLangFamily = ValueRefFamily;   // model.h: the armed-language table the capture indexes too
+
+// A Through key matches a Value key: "*" (a computed subscript) reaches every keyed or indexed slot, "" (a bare
+// call through the variable) only the variable itself, anything else only its own key.
+inline bool vrKeyMatches( std::string_view throughKey, std::string_view valueKey ) noexcept
+{
+    if( throughKey == "*" )
+    {
+        return !valueKey.empty() && ( valueKey.front() == '.' || valueKey.front() == '[' );
+    }
+    return throughKey == valueKey;
+}
+
+// The index every verb queries. Built from one IngestResult in O(refs + symbols); no graph needed.
+class ValueRefIndex
+{
+public:
+    explicit ValueRefIndex( const IngestResult& ing ) : m_ing( ing )
+    {
+        for( NodeId id = 0; id < ing.symbols.size(); ++id )
+        {
+            const Symbol& s = ing.symbols[id];
+            if( ( s.kind == SymKind::Function || s.kind == SymKind::Method ) && valueRefFamily( s.lang ) != VrLangFamily::None )
+            {
+                m_fnByName[ s.name ].push_back( id );
+            }
+        }
+        for( std::uint32_t i = 0; i < ing.references.size(); ++i )
+        {
+            const Reference& r = ing.references[i];
+            if( r.role == RefRole::Value )
+            {
+                m_values.push_back( i );
+                if( !r.recvVar.empty() )
+                {
+                    m_valueByContainer[ jsImportKey( r.fileId, r.recvVar ) ].push_back( i );
+                }
+            }
+            else if( r.role == RefRole::Through )
+            {
+                if( scopeOf( r ) == 'p' )
+                {
+                    m_throughParamBySym[ r.fromSymbol ].push_back( i );
+                }
+                else
+                {
+                    m_throughByContainer[ jsImportKey( r.fileId, r.calleeName ) ].push_back( i );
+                }
+            }
+        }
+        for( const Binding& b : ing.bindings )
+        {
+            if( b.kind == LocalBindKind::JsImport || b.kind == LocalBindKind::Import )
+            {
+                m_importsByFile[ b.fileId ].push_back( &b );
+            }
+        }
+        ENSURES( std::is_sorted( m_values.begin(), m_values.end() ), "m_values is built in reference order — targetsOf binary-searches it" );
+        m_targets.resize( m_values.size() );
+        for( std::size_t k = 0; k < m_values.size(); ++k )
+        {
+            m_targets[k] = resolveName( ing.references[ m_values[k] ], ing.references[ m_values[k] ].calleeName );
+            for( const NodeId t : m_targets[k] )
+            {
+                m_valuesByTarget[ t ].push_back( static_cast<std::uint32_t>( k ) );
+            }
+        }
+    }
+
+    // Value references (indices into ing.references) whose resolved target is any of `defs`, in served order.
+    std::vector<std::uint32_t> valueRefsTo( std::span<const NodeId> defs ) const
+    {
+        std::vector<std::uint32_t> out;
+        for( const NodeId d : defs )
+        {
+            if( const auto it = m_valuesByTarget.find( d ); it != m_valuesByTarget.end() )
+            {
+                for( const std::uint32_t k : it->second )
+                {
+                    out.push_back( m_values[k] );
+                }
+            }
+        }
+        std::ranges::sort( out );
+        out.erase( std::ranges::unique( out ).begin(), out.end() );
+        return out;
+    }
+
+    // True when at least one value reference resolves to `def`.
+    bool isValueReferenced( NodeId def ) const
+    {
+        return m_valuesByTarget.find( def ) != m_valuesByTarget.end();
+    }
+
+    // The resolved targets of value reference `refIdx` (an index into ing.references).
+    std::vector<No
```

**File**: `src/valuerefs.h` (modified, +2/-602)
```diff
@@ -15,11 +15,8 @@
 // non-function declaration of the same name in the reference's file hides every definition elsewhere. Only
 // functions and methods are targets (a class used as a value is out of scope).
 
-#include "graph.h"             // jsImportKey — the "fileId#name" key, reused for containers
+#include "valuerefindex.h"      // ValueRefIndex, the rows, the --uses filter (the resolution core)
 #include "graphlegend.h"       // countFieldOrEmpty — the absent-at-zero count spelling
-#include "mention.h"           // pathStem — a module path's file stem
-#include "resolve.h"           // includerDir — a path's directory
-#include "infra/Diagnostics.h"   // EXPECTS/ENSURES — the window and index invariants
 #include "model.h"
 #include "sarif.h"
 #include "serialize.h"   // escapeXml / jsonStr
@@ -38,540 +35,6 @@
 namespace rw
 {
 
-// The default display window of the <vrs> rows (the runaway guard): value_refs= and total= stay whole, the rows
-// beyond it are counted (capped="1") and the next= verb (--uses=SYM) pages every site.
-inline constexpr std::size_t kValueRefRowCap = 64;
-
-using VrLangFamily = ValueRefFamily;   // model.h: the armed-language table the capture indexes too
-
-// A Through key matches a Value key: "*" (a computed subscript) reaches every keyed or indexed slot, "" (a bare
-// call through the variable) only the variable itself, anything else only its own key.
-inline bool vrKeyMatches( std::string_view throughKey, std::string_view valueKey ) noexcept
-{
-    if( throughKey == "*" )
-    {
-        return !valueKey.empty() && ( valueKey.front() == '.' || valueKey.front() == '[' );
-    }
-    return throughKey == valueKey;
-}
-
-// The index every verb queries. Built from one IngestResult in O(refs + symbols); no graph needed.
-class ValueRefIndex
-{
-public:
-    explicit ValueRefIndex( const IngestResult& ing ) : m_ing( ing )
-    {
-        for( NodeId id = 0; id < ing.symbols.size(); ++id )
-        {
-            const Symbol& s = ing.symbols[id];
-            if( ( s.kind == SymKind::Function || s.kind == SymKind::Method ) && valueRefFamily( s.lang ) != VrLangFamily::None )
-            {
-                m_fnByName[ s.name ].push_back( id );
-            }
-        }
-        for( std::uint32_t i = 0; i < ing.references.size(); ++i )
-        {
-            const Reference& r = ing.references[i];
-            if( r.role == RefRole::Value )
-            {
-                m_values.push_back( i );
-                if( !r.recvVar.empty() )
-                {
-                    m_valueByContainer[ jsImportKey( r.fileId, r.recvVar ) ].push_back( i );
-                }
-            }
-            else if( r.role == RefRole::Through )
-            {
-                if( scopeOf( r ) == 'p' )
-                {
-                    m_throughParamBySym[ r.fromSymbol ].push_back( i );
-                }
-                else
-                {
-                    m_throughByContainer[ jsImportKey( r.fileId, r.calleeName ) ].push_back( i );
-                }
-            }
-        }
-        for( const Binding& b : ing.bindings )
-        {
-            if( b.kind == LocalBindKind::JsImport || b.kind == LocalBindKind::Import )
-            {
-                m_importsByFile[ b.fileId ].push_back( &b );
-            }
-        }
-        ENSURES( std::is_sorted( m_values.begin(), m_values.end() ), "m_values is built in reference order — targetsOf binary-searches it" );
-        m_targets.resize( m_values.size() );
-        for( std::size_t k = 0; k < m_values.size(); ++k )
-        {
-            m_targets[k] = resolveName( ing.references[ m_values[k] ], ing.references[ m_values[k] ].calleeName );
-            for( const NodeId t : m_targets[k] )
-            {
-                m_valuesByTarget[ t ].push_back( static_cast<std::uint32_t>( k ) );
-            }
-        }
-    }
-
-    // Value references (indices into ing.references) whose resolved target is any of `defs`, in served order.
-    std::vector<std::uint32_t> valueRefsTo( std::span<const NodeId> defs ) const
-    {
-        std::vector<std::uint32_t> out;
-        for( const NodeId d : defs )
-        {
-            if( const auto it = m_valuesByTarget.find( d ); it != m_valuesByTarget.end() )
-            {
-                for( const std::uint32_t k : it->second )
-                {
-                    out.push_back( m_values[k] );
-                }
-            }
-        }
-        std::ranges::sort( out );
-        out.erase( std::ranges::unique( out ).begin(), out.end() );
-        return out;
-    }
-
-    // True when at least one value reference resolves to `def`.
-    bool isValueReferenced( NodeId def ) const
-    {
-        return m_valuesByTarget.find( def ) != m_valuesByTarget.end();
-    }
-
-    // The resolved targets of value reference `refIdx` (an index into ing.references).
-    std::vector<NodeId> targetsOf( std::uint32_t refIdx ) const
-    {
-        const auto it = std::lower_bound( m_value
```

**File**: `src/verbs_quality.h` (modified, +14/-4)
```diff
@@ -180,6 +180,7 @@ struct DeltaBasis
     rw::quality::IdentityHealing                        healing;
     std::size_t                                         registerMacroExcluded = 0;   // P2.2: disclosed dead-code exemption count
     std::size_t                                         declinedCallExcluded  = 0;   // dead-code exemption by a declined call (quality.h isDeadCandidate)
+    std::size_t                                         valueRefExcluded      = 0;   // dead-code exemption: held as a VALUE (valuerefindex.h)
     std::size_t                                         apiNewSurface         = 0;   // Q-DIAL-4: new PUBLIC symbols this change added — the count that replaced one never-gating row each
     std::size_t acksBadLines = 0;   // 2026-09-06: .ripwire_quality_acks lines skipped as unparseable (disclosed on the root)
     // #228: WHICH basis produced baseSel.snapshot when the marker is one of the git-HEAD family, and WHY when
@@ -227,7 +228,7 @@ std::optional<int> resolveDeltaBasis( const MainDispatch& d, const std::string&
                                              out.deltaRoot, root, cfg.qualityAck, refs.rangeSpan );
         out.regs    = quality::computeDelta( refs.target().ing, refs.target().g, out.baseSel.snapshot,
                                              out.deltaRoot, cfg.excludes, cfg.maxFileBytes, &out.registerMacroExcluded, &out.apiNewSurface,
-                                             &out.cloneIdioms, &out.declinedCallExcluded );
+                                             &out.cloneIdioms, &out.declinedCallExcluded, &out.valueRefExcluded );
         return std::nullopt;
     }
 
@@ -308,7 +309,7 @@ std::optional<int> resolveDeltaBasis( const MainDispatch& d, const std::string&
     out.healing = quality::healIdentity( out.baseSel.snapshot, out.acks, d.ing, d.g,
                                          std::string( cfg.rootPath ), root, cfg.qualityAck );
     out.regs = quality::computeDelta( d.ing, d.g, out.baseSel.snapshot, cfg.rootPath, cfg.excludes, cfg.maxFileBytes, &out.registerMacroExcluded, &out.apiNewSurface,
-                                      &out.cloneIdioms, &out.declinedCallExcluded );
+                                      &out.cloneIdioms, &out.declinedCallExcluded, &out.valueRefExcluded );
     return std::nullopt;
 }
 
@@ -797,6 +798,7 @@ struct QualityDeltaLegendParts
     std::size_t                                   baselineAbsorbed; // H11: baseline_absorbed= on the root (0 = attribute absent)
     const char*                                   headBasis;     // #228: head_basis= value on the root (nullptr = attribute absent)
     bool                                          anyDeclinedCallExcluded = false;   // declined-call-excluded= is on the root
+    bool                                          anyValueRefExcluded     = false;   // value-ref-excluded= is on the root
 };
 
 // A DEFINITION IS EMITTED WHEN THE THING IT DEFINES IS IN THE DOCUMENT. Nothing is dropped and no limit is
@@ -862,6 +864,12 @@ inline void emitQualityDeltaLegend( const QualityDeltaLegendParts& p )
         std::fputs( "declined-call-excluded= is a FLOOR, not a finding: symbols this run kept out of the dead-code kind only because a call "
                     "the resolver declined to bind (the map's declined=) could have meant them. Never gates; absent at zero. ", stdout );
     }
+    if( p.anyValueRefExcluded )
+    {
+        rw::emitRaw( stdout, "value-ref-excluded= is a FLOOR, not a finding: symbols this run kept out of the dead-code kind only because a table, "
+                             "field or argument holds them as a VALUE (matched by name; it is not a proven call; the callers verb lists the sites), "
+                             "the --dead-code verb's own rule. Never gates; absent at zero. " );
+    }
 
     // (3) the two identity re-filings, each keyed to the attribute family it defines. The second is
     // git-INDEPENDENT, so it is a separate condition rather than a clause of the first.
@@ -1518,7 +1526,8 @@ std::optional<int> runQualityDelta( const MainDispatch& d )
             const std::string headBasisJson = ( basis.headBasis == nullptr ? std::string()
                                               : std::string( ",\"head_basis\":\"" ) + basis.headBasis + "\"" )
                                             + ( basis.declinedCallExcluded == 0 ? std::string()   // the XML twin's declined-call-excluded=, absent at zero
-                                              : ",\"declined-call-excluded\":" + std::to_string( basis.declinedCallExcluded ) );
+                                              : ",\"declined-call-excluded\":" + std::to_string( basis.declinedCallExcluded ) )
+                                            + rw::countFieldOrEmpty( "value-ref-excluded", basis.valueRefExcluded, /*json=*/true );
             rw::emitTo( stdout, "{{\"baseline\":\"{}\",\"regressions\":{},\"minor\":{},\"acked\":{},\"stale\":{},"
               
```

---

### Incident Patch 10: `0fc8e9ab` (2026-10-03)
**Commit Message**: ingest: kParserVer 134 -> 135 for the fix round's Rust path-call extraction

This lane's earlier binaries ran 134 with the previous extraction; a shared cache
(MCP's under TMPDIR) served one of them a stale Rust record (floormarkcheck (11):
unresolved off by one between the MCP and CLI derivations). Mirror and qschemetrip
re-pin move with it; the train renumbers.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/ingest_cache.h` (modified, +4/-1)
```diff
@@ -302,7 +302,10 @@ constexpr std::uint32_t kCacheVersion = 28;           // 28: FE-A (test/falseedg
                                                       //    (Py `pkg.mod`, TS `./x`, Rust `crate::a::b`/`mod:x`) —
                                                       //    a target FORMAT change → old caches must be rejected.
                                                       // 4: Include gained a `bool isAngle` (quote/angle) field
-constexpr std::uint32_t kParserVer    = 134;          // bump on any grammar/.scm/extraction change
+constexpr std::uint32_t kParserVer    = 135;          // bump on any grammar/.scm/extraction change
+                                                      // 135 = 2026-10-03 (lane FE-A fix round): Rust path calls (`<T as Trait>::f()`) are member
+                                                      //   calls — an extraction change; this lane's own earlier binaries ran 134 with the old
+                                                      //   extraction, so their caches must never be read as this build's.
                                                       // 134 = 2026-10-03 (lane FE-A, test/falseedgecheck.sh): Go/JS/TS/Rust member calls
                                                       //   record memberCall/memberRoot; JS/TS `require`, namespace-import and
                                                       //   global-destructure aliases and Go import specs are ModuleAlias bindings; JsShadow
```

**File**: `src/quality.h` (modified, +2/-1)
```diff
@@ -2179,7 +2179,8 @@ inline std::string cacheRootKeyHex( const std::string& root )
 // not include this header; it relies on ingest.cpp including quality.h (line 13) before ingest_cache.h, and a reorder
 // that broke that fails the build on the undeclared name rather than passing.
 constexpr std::uint32_t kIngestCacheVersionMirror   = 28;   // MUST equal ingest.cpp's kCacheVersion (gated); 28 = FE-A ref memberCall/memberRoot, 27 = corrected fnScope values, 26 = function-local def scope span (25 = #157 + #150)
-constexpr std::uint32_t kIngestParserVerMirror    = 134;  // MUST equal ingest.cpp's kParserVer   (gated)
+constexpr std::uint32_t kIngestParserVerMirror    = 135;  // MUST equal ingest.cpp's kParserVer   (gated)
+                                                          // 135 = 2026-10-03 (lane FE-A fix round, see kParserVer note)
                                                           // 134 = 2026-10-03 (lane FE-A, see kParserVer note; 133 is train 24's)
                                                           // 132 = 2026-10-02 (train 23: cache-key hygiene above every branch
                                                           //   build's number, see kParserVer note; kIngestCacheVersionMirror stays 27)
```

**File**: `test/qschemetrip.hash` (modified, +1/-1)
```diff
@@ -1 +1 @@
-30b29982afa1ac93a1a47fe42f4cd3f98a77370da4589212c107d4347d87fa82
+41dd4678dd4ece0d7a501230c32b9e7e10a7893ccc9d671ef22cb0fcf83e069f
```

**File**: `test/qschemetripcheck.sh` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ SRC="$ROOT/src/quality.h"
 ING="$ROOT/src/ingest_cache.h"   # extraction-identity constants moved here (2026-08-29 ingest.cpp section split); the hashed CONCAT label keeps its historical spelling so the pin holds
 PIN="$ROOT/test/qschemetrip.hash"
 # RE-PIN LOG (the pin is a bare hash, so its justification has to live here).
+# 2026-10-03, lane/fe-a-false-edges fix round: RE-DERIVED with UPDATE_GOLDEN=1 (hash 41dd4678dd…3e069f). kParserVer 134 -> 135 (the
+#   lane's Rust path-call extraction change; its earlier binaries ran 134 with the old extraction). kCacheVersion stays 28.
 # 2026-10-03, lane/fe-a-false-edges: RE-DERIVED with UPDATE_GOLDEN=1 (hash 30b29982af…87fa82). kParserVer 132 -> 134 (FE-A
 #   extraction: member-call shape, ModuleAlias bindings, global-name shadows; 133 is train 24's), kCacheVersion 27 -> 28
 #   (the ref record gains memberCall/memberRoot); quality.h's mirrors move with them; kQSnapCacheScheme stays 16. The
```

---

### Incident Patch 11: `a3ef443a` (2026-10-03)
**Commit Message**: fix(suite round): decorator rows stay off --uses, the probe lists calls only, and re-pins

Fixes for what the full suite at 4a4cbd67 found:

- callformcheck: `@staticmethod def two_level` made `--uses=two_level`
  count 2. A decorator row is a fact about the definition, not a use
  site elsewhere, so UsesValueFilter never accepts it and only --callers
  lists it. --safe-delete still counts it as evidence (risk stays off
  none-found), and its legend and the --uses legend say so.
- callformcheck: ripwire_probe's per-symbol dump listed Value/Through
  references next to the calls. The dump is the pre-resolution CALL
  list, so it now skips both roles.
- hazardpatterncheck E: the walk's cursor now has a RAII owner
  (ChildCursor).
- optremarkshotcheck: ingest_valuerefs.h, a per-node ingest section, is
  added to HOT_FILES.
- readmedriftcheck: the README cap count is now 236.
- showcasecapturecheck (H, I): the published seed moves to
  src/graph.h:4646 (one line inserted above it), and the --legend-dict
  figure is now dictv=b6b84659df8b5a90 entries=780. Both were corrected
  by hand from the binary.
- Re-pinned, each per its gate's own procedure:
  - qschemetrip.hash (kParserVer moved

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -39,7 +39,8 @@ call-shaped references, so on such a function `--callers`, `--callees`, `--impac
   - `--impact` and `--safe-delete` disclose the rows.
   - A value use counts in `--safe-delete`'s `uses=` and keeps it off `dead_code_candidate`/`risk="none-found"`.
   - `--dead-code` excludes such functions, counted in `value-ref-excluded=`.
-  - `--uses` shows the site as `role="value"`.
+  - `--uses` shows the site as `role="value"` (a decorator row is a fact about the definition and stays on
+    `--callers` only).
   - `--path` adds `to_value_refs=` when no call path exists.
   - The rows also appear in CLI `--json`, in MCP `find_referencing_symbols`/`find_symbol` (`valueRefs`,
     `valueCallees`), and in MCP `impact`, `uses` and `path_between`.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -2817,7 +2817,7 @@ python3 test/pargates.py . ./build/ripwire -j 6
 A new gate script must be added to `test/regression.sh` in the same change. The gate
 `test/manifestcheck.sh` enforces this rule.
 
-Another gate derives the cap inventory. The tool has 233 compile-time caps and 7 ranking parameters.
+Another gate derives the cap inventory. The tool has 236 compile-time caps and 7 ranking parameters.
 `docs/LIMITS.md` lists each cap, its value, and whether the file discloses a truncation when the cap
 fires, and `python3 docs/limits_build.py --check` proves that list against `src/`. `docs/TUNING.md`
 lists the measured cost of each cap.
```

**File**: `docs/TUNING.md` (modified, +8/-8)
```diff
@@ -14,26 +14,26 @@ to production at defaults; that control is what makes these numbers mean anythin
 
 | cap declarations | distinct names | tunable | must stay `constexpr` | move >= 1 invocation | move nothing measurable |
 | --- | --- | --- | --- | --- | --- |
-| 145 | 144 | 112 | 12 | **37** | 75 |
+| 148 | 147 | 112 | 12 | **37** | 75 |
 
-The first two columns are not the same number, and the gap is not a rounding: `src/` holds **145 cap
-declarations** under **144 distinct names** (`kRowCap` declared in more than one file). The sweep
+The first two columns are not the same number, and the gap is not a rounding: `src/` holds **148 cap
+declarations** under **147 distinct names** (`kRowCap` declared in more than one file). The sweep
 patches by NAME, so its own population is NAMES and not declarations — and the two columns beside
 those are frozen at the commit named under Provenance while this census is re-read from `src/` on
-every run, which makes them a third population again. Enumerated over the 144 names `src/` declares
-today: **111 tunable**, **12 must stay `constexpr`**, and **21 declared since the sweep was
+every run, which makes them a third population again. Enumerated over the 147 names `src/` declares
+today: **111 tunable**, **12 must stay `constexpr`**, and **24 declared since the sweep was
 prepared, which no measurement has touched** (`kChurnMergeBombMaxFiles`,
 `kExtendedLengthThresholdUnits`, `kFieldIdCapacity`, `kForPageRowsDefault`,
-`kForPageUnionSymbolCap`, `kMaxAstQueryNesting`, +15 more). 111 + 12 + 21 = 144, and `emit` refuses
+`kForPageUnionSymbolCap`, `kMaxAstQueryNesting`, +18 more). 111 + 12 + 24 = 147, and `emit` refuses
 to render a partition that does not add up. The `tunable` column above reads 112 rather than 111
 because one name the sweep classified is no longer declared in `src/` at all: `kSituTestRowsShown`.
-Quoting "113 of 145" would be wrong in both halves at once, which is the shape of error a generated
+Quoting "113 of 148" would be wrong in both halves at once, which is the shape of error a generated
 table exists to prevent.
 
 ## Read this ratio before the tables
 
 **37 of 112 tunable caps move any invocation at all. 75 move nothing measurable.** That is the
-finding, and it says what NOT to do: this is not a 145-cap audit. Most of these constants are
+finding, and it says what NOT to do: this is not a 148-cap audit. Most of these constants are
 inert on real invocations and should be left alone. The work worth doing is the small set below,
 plus the caps that fire SILENTLY — a cap that bites without disclosing is a defect independent of
 whether its value is right, and that fix is both cheaper and larger than any retuning.
```

**File**: `docs/captures/COMMANDS_showcase_2026-09-14.md` (modified, +6/-6)
```diff
@@ -3921,26 +3921,26 @@ ripwire 0.6.1 (dev, AppleClang 21.0.0.21000101, emit=std::print, built_from=f8d4
 
 # navigate — seeds, claims, slices, shapes
 
-## `./build/ripwire . --at=src/graph.h:4645`
+## `./build/ripwire . --at=src/graph.h:4646`
 
 *Hold a LOCATION, not a name: the enclosing-definition chain at FILE:LINE (a compiler error, a diff hunk, a stack frame), outermost -> innermost.*
 
 `````
 <!-- ripwire at: the ENCLOSING-DEFINITION CHAIN at one FILE:LINE seed. p= the resolved file, l= the 1-based seed line, sym= the innermost enclosing definition's name (what the same seed resolves to in a selector position), chain= the row count. Rows are INDEXED definitions only, outermost first, innermost last: n= the definition's name, t= its kind tag, l= its own start line, el= its end line (1-based, inclusive). A namespace or any construct the index does not carry is NOT a row, so an outer scope can be absent rather than misnamed; a seed line inside no indexed definition is refused, never served as an empty chain. The same seed composes into any SYM selector as @FILE:LINE (callers, callees, impact, around, expand, uses, edit-check, slice, safe-delete, path, connect) and resolves to the innermost row. -->
 <!-- root= on this element is the crawl root every p= below is RELATIVE to (single-root runs only; absent => p= is the path ingest itself used, unchanged). -->
-<at p="src/graph.h" l="4645" sym="rankGraphTeleport" chain="1" root=".">
-<s n="rankGraphTeleport" t="fn" l="4645" el="4673"/>
+<at p="src/graph.h" l="4646" sym="rankGraphTeleport" chain="1" root=".">
+<s n="rankGraphTeleport" t="fn" l="4646" el="4674"/>
 </at>
 `````
 
-## `./build/ripwire . --callers=@src/graph.h:4645`
+## `./build/ripwire . --callers=@src/graph.h:4646`
 
 *The same seed in a SELECTOR position: @FILE:LINE resolves to the innermost enclosing definition, then --callers runs on it.*
 
 `````
 <!-- ripwire callers/callees: the 1-hop call hierarchy read off the call graph — the callers form lists symbols that CALL of=; the callees form lists symbols of= itself calls. of= is the selector you passed, defs= how many DEFINITIONS it resolved to (rows UNION every def's neighbours), count= the DISTINCT neighbour symbols (a floor, per counts_floor=), windowed by limit= and offset=. A neighbour that is an indexed function-like #define is a macro row (t="macro", role="macro" on the XML row): the edge crosses a macro expansion, not a plain call — rows carry no role= otherwise. Rows are ordered SOURCE first, then test/bench, then docs, by path within a tier. hop_tested=/hop_untested= partition count= by the tested= lens below (1-hop, never transitive). tested="1" on a row means an indexed test transitively reaches it (never 0, omitted when it does not). BLIND SPOT the test-gate legend also names: only a CALL EDGE from an INDEXED test symbol counts here, so a shell or CLI-level test running a built binary as a SUBPROCESS is invisible to it and a repo tested that way reads all-untested. Read untested= as no in-process test reaches it, not as no test covers it. next= is the one pasteable follow-up (the uses verb on this selector: the call sites). counts_floor="1" means every count here is a FLOOR, never a total: edges are extracted from source TEXT by NAME. Missing: dynamic dispatch (virtual/interface/duck-typed), a most-vexing-parse declaration with no call expression, a function-pointer/callback bound to more than one function in scope (reassigned, table-indexed, lambda-bound, or address-taken/reference-bound), and a plain-name binding (fp=handler) whose variable type is not PROVABLY a function pointer (a same-file typedef/declarator; a HEADER typedef is missed; auto/template types are read as unpinned, so KEPT). A macro-generated call site is role="macro" only when its name uniquely names an indexed function-like #define (C-family, t="macro"); a shared name stays a plain call, an unindexed macro is no edge. Read a zero as "none found", never as "none exists". graph_ambiguous=/graph_unresolved= are the whole graph's resolver gauge (calls split over several defs / calls whose in-repo defs were all language-filtered), the map header's ambiguous=/unresolved=. graph_unindexed=N is a third gauge: files no grammar could read (the map header's unindexed=), whose calls raise neither gauge above; absent when zero, and so is this sentence. COUNTING UNIT differs by verb: callers, callees, edit-check, graph-query and pr-context counts are DISTINCT SYMBOLS (repeated calls from one caller, and calls to two overloads, collapse into ONE row; multiplicity survives only in the call graph's edge weight). The reach counts (impact's reaches=, pr-context's dependents=) are the size of a transitive reach SET, each symbol counted once. The uses verb counts call SITES, one row per occurrence — a larger count there for the same symbol is these units agreeing, not disagreeing. The map header's edges= is a unit again different — distinct (caller,callee) PAIRS — and that docu
```

**File**: `scripts/optremarks.py` (modified, +1/-0)
```diff
@@ -81,6 +81,7 @@
     "src/ingest_relations.h",     # captureIncludes and the relation captures — the densest LoadClobbered cluster in the family (1,120 in one function)
     "src/ingest_metrics.h",       # cc_walk / complexityOf — a per-symbol AST walk for the quality metrics
     "src/ingest_cache.h",         # loadCache / saveCache / readFileRecord, per file record — ~10% of a WARM run, which is the run an agent actually pays for
+    "src/ingest_valuerefs.h",     # the reference-as-value walk, per node over every C/JS/TS/Python/Go file — +3.6..6.3% of a cold run
     "src/ingest_model.h",         # build-model: dedup, symbol-id assignment, the def-span index, the ref radix sort — per symbol and per reference, ~18% warm
 
     "src/resolve.h",              # reference resolution into the call graph
```

**File**: `src/graphlegend.h` (modified, +2/-2)
```diff
@@ -618,11 +618,11 @@ inline constexpr const char* kValueRefsCalleesLegend =
 inline constexpr const char* kValueRefsReachLegend =
     "value_refs=N (absent when 0) counts <vr> rows: SYM is USED AS A VALUE at bind= (stored into into= or passed), matched by name. It is not a proven call: reaches= and impact_reaches= exclude them, and a caller that runs it through that slot is not in the radius. <vrs total= shown= capped= next=> is their window; <vr in_id= bind= into= called_by=>: the enclosing symbol, the binding site, where it lands, functions that may call through it. ";
 inline constexpr const char* kValueRefsSafeDeleteLegend =
-    "value_refs=N (absent when 0): SYM is USED AS A VALUE N times (a table, field or argument holds it; matched by name, not a proven call). Each such site is in uses=, keeps dead_code_candidate at 0 and risk off none-found: deleting SYM breaks the table even though no call reaches it. <vrs>/<vr in_id= bind= into= called_by=> list them. ";
+    "value_refs=N (absent when 0): SYM is USED AS A VALUE N times (a table, field or argument holds it; matched by name, not a proven call). Each such site (a decorator row aside: a fact about the definition) is in uses=; any row keeps dead_code_candidate at 0 and risk off none-found: deleting SYM breaks the table even though no call reaches it. <vrs>/<vr in_id= bind= into= called_by=> list them. ";
 inline constexpr const char* kToValueRefsLegend =
     "to_value_refs=N (absent when 0): to= is USED AS A VALUE N times (stored or passed, matched by name); a run through such a slot is not a proven call and is no hop here: the callers verb on to= lists the binding sites and called_by=. ";
 inline constexpr const char* kUsesValueRoleLegend =
-    "role=\"value\" (reference-as-value round): the function is USED AS A VALUE there, stored into a table, field or variable or passed as an argument, matched by name with the callers verb's own visibility rules. It is not a proven call; the callers verb shows where the value lands and who may call through it. ";
+    "role=\"value\" (reference-as-value round): the function is USED AS A VALUE there, stored into a table, field or variable or passed as an argument, matched by name with the callers verb's own visibility rules. It is not a proven call; the callers verb shows where the value lands and who may call through it. A decorator row is a fact about the definition, not a site: the callers verb lists it, this verb does not. ";
 inline const char* usesValueRoleLegend( bool on ) noexcept { return on ? kUsesValueRoleLegend : ""; }
 inline const char* valueRefsLegend( bool on, bool callersSide ) noexcept
 {
```

**File**: `src/ingest_valuerefs.h` (modified, +2/-2)
```diff
@@ -181,7 +181,8 @@ class ValueRefWalk
         file.node = root;
         m_scopes.push_back( std::move( file ) );
 
-        TSTreeCursor cur = ts_tree_cursor_new( root );
+        ChildCursor  walker( root );   // RAII: the walk's one cursor, released on every exit (hazardpatterncheck E)
+        TSTreeCursor& cur = walker.cur;
         enter( root, 0 );
         for( ;; )
         {
@@ -211,7 +212,6 @@ class ValueRefWalk
                 break;
             }
         }
-        ts_tree_cursor_delete( &cur );
 
         // File-scope calls through a container survive only when this file fed that container a function value.
         for( RawRef& t : m_filePending )
```

**File**: `src/tsprobe.cpp` (modified, +3/-1)
```diff
@@ -148,7 +148,9 @@ int main( int argc, char** argv )
     rw::HashMap<rw::NodeId, std::vector<const rw::Reference*>> bySym;
     for( const rw::Reference& r : ir.references )
     {
-        if( r.fromSymbol != rw::kNoNode )
+        // A value use (a function stored or passed) and a call THROUGH a value are not call references: this dump is
+        // the pre-resolution CALL list test/callformcheck.sh reads, so they stay out of it (src/valuerefs.h serves them).
+        if( r.fromSymbol != rw::kNoNode && r.role != rw::RefRole::Value && r.role != rw::RefRole::Through )
         {
             bySym[ r.fromSymbol ].push_back( &r );
         }
```

---

### Incident Patch 12: `301e6e87` (2026-10-03)
**Commit Message**: test(recallshape): JM6/JM7/PI3, the import rule's near misses (red on the stem-matching build)

- JM6 (JS): the imported module's same-named export is a const, while
  another directory's same-stem module defines that function.
- JM7 (JS): a bare package specifier whose name an in-tree file happens
  to define.
- PI3 (Python): an imported module variable, while another package has a
  same-named module function.

All three are red on 1d1fab26 (file-stem matching) and green at head.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `test/recallshapecheck.sh` (modified, +33/-0)
```diff
@@ -451,6 +451,23 @@ cat >"$FX/jsm/c.js" <<'EOF'
 function reqFn(x) { return x; }
 module.exports = { reqFn };        // @JM_CJS
 EOF
+# The import rule's near misses: the imported module exports a NON-function of that name while another directory's
+# same-STEM module defines a function of it; and a bare package specifier whose name an in-tree file happens to define.
+mkdir -p "$FX/jsm/other" "$FX/jsm/pkgs"
+cat >"$FX/jsm/d.js" <<'EOF'
+export const notFn = 1;
+EOF
+cat >"$FX/jsm/other/d.js" <<'EOF'
+export function notFn(x) { return x; }
+EOF
+cat >"$FX/jsm/pkgs/lodashish.js" <<'EOF'
+export function pkgFn(x) { return x; }
+EOF
+cat >"$FX/jsm/e.js" <<'EOF'
+import { notFn } from './d.js';     // d.js's notFn is a const
+import { pkgFn } from 'lodashish';  // a bare package specifier: outside the tree, whatever an in-tree file defines
+export const USES = [notFn, pkgFn]; // @JM_NEAR
+EOF
 
 cat >"$FX/jsx/App.jsx" <<'EOF'
 function handleClick(e) { return e; }
@@ -592,9 +609,19 @@ def alias_fn(req):
 EOF
 cat >"$FX/pyi/uses_import.py" <<'EOF'
 from handlers_mod import imp_fn, alias_fn as af  # @PI_IMPORT not a row
+from consts_mod import pv
 
 IMPORTED = [imp_fn]  # @PI_TABLE
 ALIASED = [af]  # @PI_ALIAS F3
+NEAR = [pv]  # @PI_NEAR consts_mod.pv is a module variable
+EOF
+cat >"$FX/pyi/consts_mod.py" <<'EOF'
+pv = 1
+EOF
+mkdir -p "$FX/pyi/elsewhere"
+cat >"$FX/pyi/elsewhere/consts_mod.py" <<'EOF'
+def pv():
+    return 2
 EOF
 
 # Cross-file, linkage and cross-language collisions (review fix 3).
@@ -965,6 +992,10 @@ arm "F3 floor (JS): aliasFn spelled af — no row" jsm --callers=aliasFn attr:de
 arm "JM3 callers reqFn: the CommonJS export row only — a destructured require binding is F3" \
     jsm --callers=reqFn attr:count=0 attr:value_refs=1 nvr:1 'vr:bind=@JM_CJS;into=module.exports.reqFn' 'novr:bind=@JM_TABLE' 'novr:bind=@JM_REQUIRE'
 arm "JM4 negatives: an ES export clause is no row" jsm --callers=esOnly attr:defs=1 noattr:value_refs nvr:0
+arm "JM6 negatives: an import of a module whose same-named export is a CONST never reaches another directory's same-stem function" \
+    jsm --callers=other/d.js:notFn attr:defs=1 noattr:value_refs nvr:0 'novr:bind=@JM_NEAR'
+arm "JM7 negatives: a bare package specifier resolves to no in-tree file, whatever a tree file defines" \
+    jsm --callers=pkgFn attr:defs=1 noattr:value_refs nvr:0
 arm "JM5 negatives: export default is no row" jsm --callers=esDefault attr:defs=1 noattr:value_refs nvr:0
 
 echo "-- JSX / TSX"
@@ -1048,6 +1079,8 @@ echo "-- Python imports"
 arm "PI1 callers imp_fn: an imported name used as a value (IMPORTED[0]); the import statement is no row" \
     pyi --callers=imp_fn attr:count=0 attr:value_refs=1 nvr:1 'vr:bind=@PI_TABLE;into=IMPORTED[0]' 'novr:bind=@PI_IMPORT'
 arm "F3 floor (Py): alias_fn imported as af — no row" pyi --callers=alias_fn attr:defs=1 noattr:value_refs nvr:0
+arm "PI3 negatives: an imported module VARIABLE never reaches another package's same-named module function" \
+    pyi --callers=elsewhere/consts_mod.py:pv attr:defs=1 noattr:value_refs nvr:0 'novr:bind=@PI_NEAR'
 
 # ── Go: map and struct literals, a slice of funcs, an http handler, a callback ────────────────────────────
 echo "-- Go"
```

---

### Incident Patch 13: `1c6bbeea` (2026-10-03)
**Commit Message**: fix(valuerefs): an imported name resolves through the call graph's own module resolver

The first resolver matched an imported value by the module's FILE STEM.
On webpack's test tree, `import { test } from "./a"` (a.js exports
`test = 123`) became a value row on functions named `test` in unrelated
a.js files, and a bare package specifier (`from "foo"`) matched any
foo.js. A JS/TS or Python import now resolves its module with
resolvePreciseInclude, the same Step-A the import and dependency graph
uses:
- a relative specifier against the importer;
- a Python module relative to the file, then to the root, then by the
  whole-component suffix for an absolute spec.
The function must be defined in that file. A bare package specifier
resolves to no file, so it produces no row.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/valuerefs.h` (modified, +29/-9)
```diff
@@ -309,6 +309,28 @@ class ValueRefIndex
         return through.calleeName == tail;
     }
 
+    std::uint32_t importedModuleFile( const Binding& b ) const
+    {
+        if( b.typeName.empty() || b.fileId >= m_ing.files.size() )
+        {
+            return kNoFile;
+        }
+        if( m_fileIndex.empty() )
+        {
+            m_fileIndex.reserve( m_ing.files.size() );
+            for( std::uint32_t f = 0; f < m_ing.files.size(); ++f )
+            {
+                m_fileIndex.emplace( lexicalNormalize( rootRelPath( m_ing, f ) ), f );
+            }
+        }
+        const std::uint32_t precise = resolvePreciseInclude( rootRelPath( m_ing, b.fileId ), b.typeName, /*isAngle=*/false, m_fileIndex );
+        if( precise != kNoFile || b.kind != LocalBindKind::Import )
+        {
+            return precise;
+        }
+        return resolvePythonModuleSuffix( b.typeName, m_fileIndex, m_ing.fileRoot.empty() ? nullptr : &m_ing.fileRoot, b.fileId );
+    }
+
     // `name` as seen from reference `r`'s file, under the visibility rules in the header comment.
     std::vector<NodeId> resolveName( const Reference& r, std::string_view name ) const
     {
@@ -390,17 +412,14 @@ class ValueRefIndex
                     {
                         continue;
                     }
-                    const std::string_view mod  = b->typeName;
-                    const std::size_t      cut  = mod.find_last_of( "/." );
-                    std::string_view       stem = cut == std::string_view::npos ? mod : mod.substr( cut + 1 );
-                    if( b->kind == LocalBindKind::JsImport )
-                    {
-                        stem = mention_detail::pathStem( mod );
-                    }
+                    // The import's module, resolved by the call graph's own Step-A (resolve.h resolvePreciseInclude: a
+                    // relative JS/TS specifier against the importer, a Python module relative-to-file then root, then the
+                    // whole-component suffix for an absolute Python spec). A bare package specifier resolves to no file:
+                    // no row — a stem match across directories bound `import { test } from "./a"` to every a.js.
+                    const std::uint32_t moduleFile = importedModuleFile( *b );
                     for( const NodeId id : other )
                     {
-                        const std::string_view defStem = mention_detail::pathStem( m_ing.files[ m_ing.symbols[id].fileId ] );
-                        if( defStem == stem || ( defStem == "__init__" && mention_detail::pathStem( includerDir( m_ing.files[ m_ing.symbols[id].fileId ] ) ) == stem ) )
+                        if( m_ing.symbols[id].fileId == moduleFile )
                         {
                             out.push_back( id );
                         }
@@ -424,6 +443,7 @@ class ValueRefIndex
     HashMap<std::string, std::vector<std::uint32_t>>     m_throughByContainer;
     HashMap<NodeId, std::vector<std::uint32_t>>          m_throughParamBySym;
     HashMap<std::uint32_t, std::vector<const Binding*>>  m_importsByFile;
+    mutable HashMap<std::string, std::uint32_t>          m_fileIndex;   // root-relative normalised path → fileId, built on first import
 };
 
 // ── the rows every surface serves ─────────────────────────────────────────────────────────────────────────────
```

---

### Incident Patch 14: `6c5637bf` (2026-10-03)
**Commit Message**: perf(mcp): build the value-reference index once per index content, not per call

ValueRefIndex is O(references) to build. The MCP twins built it on every
call, which took a warm django find_referencing_symbols call from about
15-23 ms to 33-58 ms. McpIndex now caches it, keyed on the S1 content
stamp and the reference count it was built from; valueRefIndexOf hands
the cached copy to find_*, impact, uses and path_between. The CLI builds
it once per run, as before. It is a pure cache with no output byte
change. Warm per-call is back to 17-22 ms.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/callhierarchy.h` (modified, +5/-2)
```diff
@@ -25,6 +25,7 @@
 #include "model.h"
 #include "valuerefs.h" // the reference-as-value rows both surfaces serve beside the call rows
 
+#include <optional>
 #include <string>
 #include <string_view>
 #include <utility>
@@ -109,7 +110,8 @@ inline std::pair<std::string_view, bool> callHierarchyNextSelector( const Ingest
     return { name, true };
 }
 
-inline CallHierarchyRows callHierarchyRows( const IngestResult& ing, const Graph& g, std::string_view selector, bool wantCallers )
+inline CallHierarchyRows callHierarchyRows( const IngestResult& ing, const Graph& g, std::string_view selector, bool wantCallers,
+                                            const ValueRefIndex* valueIndex = nullptr )   // the MCP server passes its cached one
 {
     CallHierarchyRows out;
     // X9(b): "file:name" disambiguates here (the same rule --around/--lego/--edit-check use through
@@ -181,7 +183,8 @@ inline CallHierarchyRows callHierarchyRows( const IngestResult& ing, const Graph
     // Reference-as-value round: the <vr> rows beside the call rows — the binding sites of `matches` (callers), or what
     // `matches` stores/passes and may call through (callees). Never merged into `rows`: they are not calls.
     {
-        const ValueRefIndex vri( ing );
+        const std::optional<ValueRefIndex> local = valueIndex == nullptr ? std::optional<ValueRefIndex>( std::in_place, ing ) : std::nullopt;
+        const ValueRefIndex&               vri   = valueIndex != nullptr ? *valueIndex : *local;
         out.valueRefs = wantCallers ? valueRefCallerRows( ing, vri, out.matches ) : valueRefCalleeRows( ing, vri, out.matches );
     }
     if( wantCallers )
```

**File**: `src/mcpindex.h` (modified, +21/-0)
```diff
@@ -21,6 +21,7 @@
 #include "gitmine.h"
 #include "lexical.h"
 #include "recall.h"
+#include "valuerefs.h"          // reference-as-value round: the per-index ValueRefIndex cache (valueRefIndexOf)
 #include "situ.h"
 #include "workspace.h"          // multi-root `paths` array (A11): root hygiene + labels + merge
 #include "infra/statclock.h"    // rw::saturatingNanoseconds — the staleness stat reads without signed overflow past 2262
@@ -529,6 +530,14 @@ struct McpIndex
     // toward, as of the LAST rebuild — kept so mcpStale() can detect "same tree, different diff" (see below).
     std::uint64_t                     workingSetHash = 0;   // FNV-1a of the changed-file id list used to build `rank`
 
+    // Reference-as-value round: the value-reference index (src/valuerefs.h) is O(references) to build, which on a large
+    // tree is most of a warm 1-hop call's cost — so it is built once per index CONTENT and reused. Keyed on the S1
+    // content stamp and the reference count it was built from; a rebuilt index (any content change moves contentHash)
+    // never reuses it. Pure cache: it is a function of `ing`, so no output byte depends on whether it was warm.
+    mutable std::shared_ptr<const ValueRefIndex> valueRefs;
+    mutable std::uint64_t                        valueRefsStamp = 0;
+    mutable std::size_t                          valueRefsRefCount = 0;
+
     // ── P1-15 incremental-pass disclosure (the `_reingest` envelope field; mcpReingestField below).
     //
     // incrementalPasses counts ONLY rebuilds that refreshed an index this process ALREADY held for this
@@ -1100,6 +1109,18 @@ inline void maybePrefetchHeadSnapshot( const std::string& root, std::size_t file
     } ).detach();
 }
 
+// The value-reference index of `ix`, built on first use and reused while the index content is unchanged.
+inline const ValueRefIndex& valueRefIndexOf( const McpIndex& ix )
+{
+    if( !ix.valueRefs || ix.valueRefsStamp != ix.contentHash || ix.valueRefsRefCount != ix.ing.references.size() )
+    {
+        ix.valueRefs         = std::make_shared<const ValueRefIndex>( ix.ing );
+        ix.valueRefsStamp    = ix.contentHash;
+        ix.valueRefsRefCount = ix.ing.references.size();
+    }
+    return *ix.valueRefs;
+}
+
 // the cached index for `root`, rebuilt only when stale (otherwise returned as-is, no parse, no graph rebuild).
 inline const McpIndex& getIndex( const std::string& root )
 {
```

**File**: `src/mcpverbs.h` (modified, +5/-6)
```diff
@@ -693,7 +693,7 @@ inline std::string symbolQueryJson( const std::string& root, const std::string&
     const IngestResult& ing = ix.ing;
     const Graph&        g   = ix.g;
 
-    const CallHierarchyRows chRows = rw::callHierarchyRows( ing, g, name, /*wantCallers=*/referencingOnly );
+    const CallHierarchyRows chRows = rw::callHierarchyRows( ing, g, name, /*wantCallers=*/referencingOnly, &valueRefIndexOf( ix ) );
     if( chRows.matches.empty() )
     {
         return {};
@@ -702,7 +702,7 @@ inline std::string symbolQueryJson( const std::string& root, const std::string&
     // collected with a second pass in the callee direction — one computation each, never a hand-rolled walk.
     const CallHierarchyRows chCallers = referencingOnly
                                             ? CallHierarchyRows{}
-                                            : rw::callHierarchyRows( ing, g, name, /*wantCallers=*/true );
+                                            : rw::callHierarchyRows( ing, g, name, /*wantCallers=*/true, &valueRefIndexOf( ix ) );
     const std::vector<NodeId>& calledBy = referencingOnly ? chRows.rows : chCallers.rows;
     const std::vector<NodeId>& calls    = chRows.rows;
 
@@ -2701,8 +2701,7 @@ inline std::optional<std::string> impactText( const std::string& root, const std
     ImportTier imports = impactImportTier( ing, seeds );
     sizeImportTier( imports, page.limit, symbol );   // cut-fix C: limit sizes the tier, as on the CLI
     // Reference-as-value round: SYM's binding sites, the CLI --impact's value_refs=/<vrs> by the same call.
-    const ValueRefIndex imVri( ing );
-    const ValueRefRows  imValueRefs = valueRefCallerRows( ing, imVri, seeds );
+    const ValueRefRows  imValueRefs = valueRefCallerRows( ing, valueRefIndexOf( ix ), seeds );
     rw::emitTo( mem, "{}{}. {}{}{}{}{}{}{}{}{}{}{}-->", kImpactLegendOpen, kPageRaiseCapClause,
                   reach.empty() ? "" : kImpactDepthLegend,           // 0.6.5: exactly when d=/by_depth= ride, as on the CLI
                   kImpactImportTierLegend,
@@ -2979,7 +2978,7 @@ inline std::optional<std::string> usesText( const std::string& root, const std::
     // here while the CLI still reports it through the name filter — a surface divergence, not a narrowing.
     std::vector<NodeId> elixirDefs = resolveAllByNameQualified( ing, symbol );
     std::erase_if( elixirDefs, [ & ]( NodeId node ) { return ing.symbols[ node ].lang != Lang::Elixir; } );
-    const UsesValueFilter valueFilter( ing, sym, defs );   // the CLI --uses' value-site filter, shared (valuerefs.h)
+    const UsesValueFilter valueFilter( ing, sym, defs, &valueRefIndexOf( ix ) );   // the CLI --uses' value-site filter, shared (valuerefs.h)
     for( std::uint32_t refIndex = 0; refIndex < ing.references.size(); ++refIndex )
     {
         const Reference& r = ing.references[refIndex];
@@ -3164,7 +3163,7 @@ inline std::optional<std::string> pathText( const std::string& root, const std::
     // verb has no legend of its own either, and the two dialects must not differ on what they explain.
     // H5: the same brief floor legend + marker the CLI --path prints (verbs_navigate.h) — one wording, two transports.
     // Reference-as-value round: the CLI --path's to_value_refs=, by the same call.
-    const std::size_t ptToValueRefs = toValueRefsCount( ing, pth.empty(), dstDefs );
+    const std::size_t ptToValueRefs = toValueRefsCount( ing, pth.empty(), dstDefs, &valueRefIndexOf( ix ) );
     rw::emitTo( mem, "<!-- ripwire path: one DIRECTED call path from= to to= (each <s> a hop); reachable= is 0 and hops= 0 when the "
                        "graph holds none. {}{}{}-->{}", unprovenDefsVerbLegend( UnprovenDefsVerb::Path, unprovenDefs > 0 ).c_str(),
                   toValueRefsLegend( ptToValueRefs > 0 ),
```

**File**: `src/valuerefs.h` (modified, +10/-4)
```diff
@@ -28,6 +28,7 @@
 #include <cstddef>
 #include <cstdint>
 #include <iterator>
+#include <optional>
 #include <span>
 #include <string>
 #include <string_view>
@@ -688,9 +689,10 @@ inline std::string valueRefsJson( const IngestResult& ing, const ValueRefRows& r
 class UsesValueFilter
 {
 public:
-    UsesValueFilter( const IngestResult& ing, std::string_view name, std::span<const NodeId> valueDefs )
+    UsesValueFilter( const IngestResult& ing, std::string_view name, std::span<const NodeId> valueDefs, const ValueRefIndex* cached = nullptr )
     {
-        const ValueRefIndex vri( ing );
+        const std::optional<ValueRefIndex> local = cached == nullptr ? std::optional<ValueRefIndex>( std::in_place, ing ) : std::nullopt;
+        const ValueRefIndex&               vri   = cached != nullptr ? *cached : *local;
         for( std::uint32_t i = 0; i < ing.references.size(); ++i )
         {
             const Reference& r = ing.references[i];
@@ -736,9 +738,13 @@ class UsesValueFilter
 
 // --path / path_between: with NO directed call path (`unreachable`), how often `dstDefs` are used as values; 0 when a
 // path exists, so the attribute is absent and the answer byte-identical.
-inline std::size_t toValueRefsCount( const IngestResult& ing, bool unreachable, std::span<const NodeId> dstDefs )
+inline std::size_t toValueRefsCount( const IngestResult& ing, bool unreachable, std::span<const NodeId> dstDefs, const ValueRefIndex* cached = nullptr )
 {
-    return unreachable ? valueRefCallerRows( ing, ValueRefIndex( ing ), dstDefs ).rows.size() : 0;
+    if( !unreachable )
+    {
+        return 0;
+    }
+    return cached != nullptr ? valueRefCallerRows( ing, *cached, dstDefs ).rows.size() : valueRefCallerRows( ing, ValueRefIndex( ing ), dstDefs ).rows.size();
 }
 
 inline std::string valueRefsCountAttrXml( std::size_t n ) { return countFieldOrEmpty( "value_refs", n, /*json=*/false ); }
```

---

### Incident Patch 15: `3222a0f2` (2026-10-03)
**Commit Message**: test: locality fixtures move to Kotlin; FE-A sibling arm; fingerprint and pin upkeep

The S6-C locality tie-break fixtures (test/lpinfix, test/pincensusfix)
reached the tie-break through a Python bare call to a method, which FE-A
now resolves as Python does: no method is in scope. The same shapes in
Kotlin, where a bare call is an implicit-this call, reach the tie-break as
the real resolution question; every assertion of lpincheck, pincensuscheck,
externalvetocheck, declinecheck and compactlegendcheck is unchanged apart
from the file names, and all pass on the pre-change binary too. The old
Python shape is now a falseedgecheck arm (siblings.py: no edge, external).

A method's bare call no longer keeps its own class's methods (only a class
BODY reaches the functions defined in it). fnliteralcheck's warm/cold
fingerprint also reads graph_unresolved=, the shadow shape's witness now
that its parameter call is unresolved rather than declined. qschemetrip
re-pinned for kParserVer 134 / kCacheVersion 28.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/graph.h` (modified, +5/-8)
```diff
@@ -2778,8 +2778,8 @@ struct DispositionTally
 //       with no go.mod above the caller proves nothing and keeps the ladder.
 // Never retargets a decided edge and never declines: a removed candidate is one the call cannot reach, an emptied set is
 // external= (one `C external` census row), and every other call keeps the unchanged ladder.
-// CONSERVATIVE KEEPS. A method of the caller's own class (or of the class whose body is the caller) survives rule (1):
-// Python evaluates a decorator in class scope, and the ladder's answer there is kept rather than guessed at.
+// CLASS-BODY KEEP. A function of the class whose BODY is the caller survives rule (1): Python evaluates a class body as a
+// scope, so `DEFAULTS = _default()` there reaches the `_default` defined above it.
 // STATED FLOORS (named in test/falseedgecheck.sh's header): implicit-receiver languages (Java, C#, C++, Kotlin, Swift,
 // Ruby, ObjC) are untouched — a bare call there reaches the enclosing class's methods; PHP, Lua and Zig have no arm; a
 // Go package whose name differs from its path's last element is not recognised as an import (its calls keep the
@@ -2856,15 +2856,12 @@ struct FalseEdgeRules
         return s.kind == SymKind::Method || s.kind == SymKind::Field
             || ( s.lang == Lang::Python && s.kind == SymKind::Function && !s.scope.empty() && classNames.find( s.scope ) != classNames.end() );
     }
-    // CONSERVATIVE KEEP: the candidate belongs to the caller's own class, or to the class whose body is the caller.
+    // CLASS-BODY KEEP: a call in a class BODY (the caller is the class itself — Python's `DEFAULTS = _default()`) reaches
+    // the functions defined earlier in that body. A METHOD's bare call does not reach its siblings (that needs `self.`).
     bool callerOwnClass( const Symbol& caller, const Symbol& cand ) const
     {
-        if( cand.scope.empty() )
-        {
-            return false;
-        }
         const bool callerIsClass = caller.kind == SymKind::Class || caller.kind == SymKind::Struct || caller.kind == SymKind::Interface;
-        return cand.scope == ( callerIsClass ? caller.name : caller.scope );
+        return callerIsClass && !cand.scope.empty() && cand.scope == caller.name;
     }
     bool cannotReach( const Reference& r, const Symbol& caller, const Symbol& cand, std::string_view callerDir ) const
     {
```

**File**: `test/falseedgecheck.sh` (modified, +5/-1)
```diff
@@ -47,7 +47,9 @@
 #            `verify`/`fetch`, `new App()` + `app.dispatch()`, an ambient `declare function track` (globals.d.ts)
 #            called from a file that imports nothing; ESM default/named imports of outside packages stay unbound (pin).
 #   (D) Python (src/ layout): an imported or STAR-imported module function `match` is the edge — not the two
-#            same-named methods; a bare `process()` that only a METHOD defines has no edge. Near misses keep: imported
+#            same-named methods; a bare `process()` that only a METHOD defines has no edge, and neither has a method's
+#            bare `helper()` beside its own class's and a sibling class's `helper` (siblings.py — the shape the S6-C
+#            locality fixtures used before FE-A; they moved to Kotlin, where a bare call IS a `this` call). Near misses keep: imported
 #            in-repo `append` and `format`, a same-module helper, a module-level callable VARIABLE, a bare class
 #            construction `Worker()`, a class-body call. Pins: bare builtins `open`/`format` reach neither the method
 #            nor the unimported module function.
@@ -274,6 +276,7 @@ echo "=== (D) Python: an imported function beats same-named methods; a bare call
 exactly py callees src/ui/widget.py:prune_children "fn match src/ui/css/match.py"
 exactly py callees src/ui/star.py:use_star "fn match src/ui/css/match.py"
 lacks py callees src/ui/widget.py:run_all "process src/ui/worker.py"
+lacks py callees src/ui/siblings.py:run "helper src/ui/siblings.py"
 echo "--- (D) near misses: true edges kept, and the builtin pins"
 exactly py callees src/ui/use_lists.py:grow "fn append src/ui/lists.py"
 exactly py callees src/ui/use_lists.py:twice "fn helper src/ui/use_lists.py"
@@ -331,6 +334,7 @@ externals ts src/utils/sig.ts checkSig verify
 externals ts src/client.ts encode stringify
 externals tsimport src/remote.ts pull fetch
 externals py src/ui/widget.py run_all process
+externals py src/ui/siblings.py run helper
 externals c copy.c classify find_type
 externals rs src/lib.rs draw render
 for r in $ROOTS; do
```

**File**: `test/falseedgefix/py/src/ui/siblings.py` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+"""A method's bare call never reaches a sibling class's method, nor its own class's (that needs self.)."""
+
+
+class Alpha:
+    def helper(self):
+        return 1
+
+    def run(self):
+        # helper is no name in scope here: Python looks up locals, the module and the builtins, never the class
+        return helper()
+
+
+class Beta:
+    def helper(self):
+        return 2
```

**File**: `test/fnliteralcheck.sh` (modified, +5/-3)
```diff
@@ -140,13 +140,15 @@ edge lua init.lua:run    lua_helper init.lua:4 "a non-local Lua nested function
 edge c a/x.cpp:use_helper helper a/x.cpp:3 "a same-file top-level C++ function, as on main"
 # (g) the scope span rides the ingest cache: a WARM run (cache on, second pass) answers these arms exactly as --no-cache.
 #     A blob from an older format (kCacheVersion 26 held wrong spans for the shapes above) is never read: the format is in
-#     the blob's name and header, and cachefuzzcheck's version_decrement arm proves an N-1 blob is refused.
+#     the blob's name and header, and cachefuzzcheck's version_decrement arm proves an N-1 blob is refused. The fingerprint
+#     carries graph_unresolved= too: since FE-A the shadow shape's parameter call is unresolved (a call through the
+#     parameter), no longer declined between two unrelated methods, so declined_calls= alone would leave it no witness.
 CACHEHOME="$TMP/cachehome"; mkdir -p "$CACHEHOME/xdg" "$CACHEHOME/tmp"
 for q in "c a/x.cpp:use_helper" "php a.php:use_helper" "lua init.lua:run" "import cmd/use.ts:declCaller" "shadow tests/a.test.ts:captureStdout"; do
     set -- $q
-    cold="$( ( cd "$EDGE/$1" && "$BIN" . --callees="$2" --no-cache --legend=compact 2>/dev/null ) | grep -oE '<s t="[^>]*>|declined_calls="[0-9]+"' )"
+    cold="$( ( cd "$EDGE/$1" && "$BIN" . --callees="$2" --no-cache --legend=compact 2>/dev/null ) | grep -oE '<s t="[^>]*>|declined_calls="[0-9]+"|graph_unresolved="[0-9]+"' )"
     for pass in 1 2; do
-        warm="$( ( cd "$EDGE/$1" && XDG_CACHE_HOME="$CACHEHOME/xdg" TMPDIR="$CACHEHOME/tmp" "$BIN" . --callees="$2" --legend=compact 2>/dev/null ) | grep -oE '<s t="[^>]*>|declined_calls="[0-9]+"' )"
+        warm="$( ( cd "$EDGE/$1" && XDG_CACHE_HOME="$CACHEHOME/xdg" TMPDIR="$CACHEHOME/tmp" "$BIN" . --callees="$2" --legend=compact 2>/dev/null ) | grep -oE '<s t="[^>]*>|declined_calls="[0-9]+"|graph_unresolved="[0-9]+"' )"
     done
     if [ -n "$cold" ] && [ "$cold" = "$warm" ]; then ok "$2: warm cache answers as --no-cache"; else no "$2: warm cache differs from --no-cache — cold: $cold / warm: $warm"; fi
 done
```

**File**: `test/lpincheck.sh` (modified, +19/-19)
```diff
@@ -13,10 +13,10 @@
 # re-applies the `Graph::localityKey` tie-break (an unscoped def is compared as `path::name`, not its bare
 # name) so a module-level function is no longer auto-lost to a same-file class method.
 #
-# THE FIXTURE (test/lpinfix/, 3 files):
-#   pinned.py   — `Alpha.run` -> `helper()`; `Alpha.helper` beats `Beta.helper` by scope: ONE edge, `lpin="1"`, no `amb=`.
-#   tied.py     — `Eps.go` -> `other()`; sibling classes tie: split, `amb="1"`, no `lpin=`.
-#   modlevel.py — `Caller.go` -> `compute()`; `Helper.compute` vs module-level `compute`: a full tie under
+# THE FIXTURE (test/lpinfix/, 3 Kotlin files — Python until FE-A, whose bare call reaches no method: test/falseedgecheck.sh):
+#   pinned.kt   — `Alpha.run` -> `helper()`; `Alpha.helper` beats `Beta.helper` by scope: ONE edge, `lpin="1"`, no `amb=`.
+#   tied.kt     — `Eps.go` -> `other()`; sibling classes tie: split, `amb="1"`, no `lpin=`.
+#   modlevel.kt — `Caller.go` -> `compute()`; `Helper.compute` vs top-level `compute`: a full tie under
 #                 localityKey ⇒ split, `amb="1"`, no `lpin=` (was a silent pin on Helper::compute).
 #
 # Exits non-zero on any failure.
@@ -45,30 +45,30 @@ MAP="$( cat "$TMP/map.xml" )"
 row(){ _n="${1##*::}"; _r="${1#*::}"; _s="${_r%::*}"; printf '%s' "$MAP" | tr '<' '\n' | grep "n=\"$_n\" sc=\"$_s\"" | head -1; }
 
 # ── (A) the pin is DISCLOSED on its row, and it is still not an amb ──────────────────────────────
-RUN_ROW="$( row 'pinned.py::Alpha::run' )"
-printf '%s' "$RUN_ROW" | grep -q 'lpin="1"' && ok "(A) pinned.py::Alpha::run carries lpin=\"1\" — the locality pin is disclosed" \
-    || no "(A) pinned.py::Alpha::run has no lpin=\"1\": $RUN_ROW"
-printf '%s' "$RUN_ROW" | grep -q 'amb=' && no "(A) pinned.py::Alpha::run carries amb= — the marker inflated amb=: $RUN_ROW" \
+RUN_ROW="$( row 'pinned.kt::Alpha::run' )"
+printf '%s' "$RUN_ROW" | grep -q 'lpin="1"' && ok "(A) pinned.kt::Alpha::run carries lpin=\"1\" — the locality pin is disclosed" \
+    || no "(A) pinned.kt::Alpha::run has no lpin=\"1\": $RUN_ROW"
+printf '%s' "$RUN_ROW" | grep -q 'amb=' && no "(A) pinned.kt::Alpha::run carries amb= — the marker inflated amb=: $RUN_ROW" \
     || ok "(A) the pin still contributes nothing to amb="
 N_HELPER="$( printf '%s' "$MAP" | tr '>' '\n' | awk '/n="run" sc="Alpha"/{f=1} f{print} /\/s/{if(f)exit}' | grep -c 'n="helper"' )"
 if [ "$N_HELPER" = 1 ]; then ok "(A) the pin still emits ONE confident edge"; else no "(A) $N_HELPER helper edges on Alpha::run, want 1"; fi
 
 # ── (B) the tied control — a split is not a pin ───────────────────────────────────────────────────
-GO_ROW="$( row 'tied.py::Eps::go' )"
-printf '%s' "$GO_ROW" | grep -q 'amb="1"' && ok "(B) tied.py::Eps::go carries amb=\"1\" (the honest split)" \
-    || no "(B) tied.py::Eps::go lacks amb=\"1\": $GO_ROW"
-printf '%s' "$GO_ROW" | grep -q 'lpin=' && no "(B) tied.py::Eps::go carries lpin= — a split labelled as a pin: $GO_ROW" \
+GO_ROW="$( row 'tied.kt::Eps::go' )"
+printf '%s' "$GO_ROW" | grep -q 'amb="1"' && ok "(B) tied.kt::Eps::go carries amb=\"1\" (the honest split)" \
+    || no "(B) tied.kt::Eps::go lacks amb=\"1\": $GO_ROW"
+printf '%s' "$GO_ROW" | grep -q 'lpin=' && no "(B) tied.kt::Eps::go carries lpin= — a split labelled as a pin: $GO_ROW" \
     || ok "(B) no lpin= on the split"
 
 # ── (C) the module-level shape — a full tie under localityKey, not a silent pin ──────────────────
-CALLER_ROW="$( row 'modlevel.py::Caller::go' )"
-printf '%s' "$CALLER_ROW" | grep -q 'amb="1"' && ok "(C) modlevel.py::Caller::go is an honest split (amb=\"1\") — the module-level def is no longer auto-lost" \
-    || no "(C) modlevel.py::Caller::go is not amb=\"1\" — Helper::compute still silently wins: $CALLER_ROW"
-printf '%s' "$CALLER_ROW" | grep -q 'lpin=' && no "(C) modlevel.py::Caller::go carries lpin= — still pinned: $CALLER_ROW" \
+CALLER_ROW="$( row 'modlevel.kt::Caller::go' )"
+printf '%s' "$CALLER_ROW" | grep -q 'amb="1"' && ok "(C) modlevel.kt::Caller::go is an honest split (amb=\"1\") — the module-level def is no longer auto-lost" \
+    || no "(C) modlevel.kt::Caller::go is not amb=\"1\" — Helper::compute still silently wins: $CALLER_ROW"
+printf '%s' "$CALLER_ROW" | grep -q 'lpin=' && no "(C) modlevel.kt::Caller::go carries lpin= — still pinned: $CALLER_ROW" \
     || ok "(C) no lpin= on the module-level site"
-grep -E '^C	locality	' "$TMP/c.tsv" | grep -q 'modlevel.py::Caller::go' \
-    && no "(C) the census still labels modlevel.py::Caller::go locality-pinned" \
-    || ok "(C) the census agrees: no locality row for modlevel.py::Caller::go"
+grep -E '^C	locality	' "$TMP/c.tsv" | grep -q 'modlevel.kt::Caller::go' \
+    && no "(C) the census still labels modlevel.kt::Caller::go locality-pinned" \
+    || ok "(C) the census agrees: no locality row for modlevel.kt::Caller::go"
 
 # ── (D) the header counter, and its equality with the census ──────────────────────────────────────
 HDR="$( printf '%s' "$MAP" | grep -o '<!
```

**File**: `test/lpinfix/modlevel.kt` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+// The phase-3b repro: a TOP-LEVEL function against a same-file class method.
+//
+// `Caller.go` bare-calls `compute()`. Two defs answer: `Helper.compute` (canonical id
+// `modlevel.kt::Helper::compute`) and the top-level `compute` — whose canonical id degrades to the BARE
+// NAME `compute`, sharing ZERO segments with any caller. Before phase 4 S6-C pinned `Helper::compute`
+// silently on that asymmetry. With `Graph::localityKey` (`modlevel.kt::compute` for the unscoped def) both
+// candidates share exactly `modlevel.kt::` — a full tie — so the call is an honest split: `amb="1"` on
+// `Caller::go`, no `lpin=`, and `ambiguous=` counts it. (Kotlin: Python, the vehicle until FE-A, now binds the module def.)
+class Caller {
+    fun go(): Int {
+        return compute()
+    }
+}
+class Helper {
+    fun compute(): Int {
+        return 5
+    }
+}
+fun compute(): Int {
+    return 6
+}
```

**File**: `test/lpinfix/modlevel.py` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-# The phase-3b repro: a MODULE-LEVEL function against a same-file class method.
-#
-# `Caller.go` bare-calls `compute()`. Two defs answer: `Helper.compute` (canonical id
-# `modlevel.py::Helper::compute`) and the module-level `compute` — whose canonical id degrades to the BARE
-# NAME `compute`, sharing ZERO segments with any caller. Before phase 4 S6-C pinned `Helper::compute`
-# silently on that asymmetry. With `Graph::localityKey` (`modlevel.py::compute` for the unscoped def) both
-# candidates share exactly `modlevel.py::` — a full tie — so the call is an honest split: `amb="1"` on
-# `Caller::go`, no `lpin=`, and `ambiguous=` counts it.
-class Caller:
-    def go( self ):
-        return compute()
-
-
-class Helper:
-    def compute( self ):
-        return 5
-
-
-def compute():
-    return 6
```

**File**: `test/lpinfix/pinned.kt` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+// The S6-C locality tie-break's PINNING shape (same as test/pincensusfix/pinned.kt).
+//
+// `Alpha.run` makes a BARE (implicit-`this`) `helper()` call. `Alpha.helper` and `Beta.helper` both live in THIS file,
+// so the same-file rung keeps both and S6-C decides: `pinned.kt::Alpha::` beats `pinned.kt::`. ONE confident edge, NO
+// `amb=` — and, since phase 4 (docs/EVALS.md "Phase 4"), `lpin="1"` on the caller row: the pin is a prior's guess and
+// the map now says so instead of dressing it as an evidence-backed resolution. (Python until FE-A, see pincensusfix.)
+class Alpha {
+    fun helper(): Int {
+        return 1
+    }
+    fun run(): Int {
+        return helper()
+    }
+}
+class Beta {
+    fun helper(): Int {
+        return 2
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #372** (2026-10-04): train 25: false call edges stop, reference-as-value rows, qschemetrip hashes computeSnapshot (@joyful-ii-V-I)
- **PR #371** (2026-10-04): train 24: 0.6.7 wave 2 — run-first tests, cross-kind and declined-interface disclosure, shallow-clone qualification, comment-token gate, layout G1 fix (@joyful-ii-V-I)
- **PR #369** (2026-10-02): train 23: 0.6.7 wave 1 — edit-check pairing, map data sections, fresh whereis/not-found answers (@joyful-ii-V-I)
- **PR #368** (2026-10-04): refactor(#358): C-family import edges from one @import.path capture, not two extractors (@lennix1337)
- **PR #367** (2026-10-01): Follow-up to train 22: scanner quoting, logger recall, multi-root diagnostics, docs (@joyful-ii-V-I)
- **PR #366** (2026-10-01): Deck: 0.6.2–0.6.6 changes, since-0.6.1 slide, field-report outcomes (@joyful-ii-V-I)
- **PR #365** (2026-10-01): Train 22: quality-delta masking + placeholder, per-definition metrics, --mcp-tools, impact depth, honesty fixes, fn-literal bodies, Ruby #338/#325 (@joyful-ii-V-I)
- **PR #363** (2026-09-29): fix(#350): refuse roots nobody chose, and a zero-config memory guard (@joyful-ii-V-I)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
