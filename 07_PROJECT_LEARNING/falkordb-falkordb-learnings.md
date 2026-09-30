# Forensic Learning Record (Deep Inspection): FalkorDB/FalkorDB

> **Canonical Artifact**: `07_PROJECT_LEARNING/falkordb-falkordb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:56:34.958Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FalkorDB/FalkorDB`
- **Description**: A super fast Graph Database uses GraphBLAS under the hood for its sparse adjacency matrix graph representation. Our goal is to provide the best Knowledge Graph for LLM (GraphRAG).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6350 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/pmc_tool.c`
```
// PMU counter tool for Apple Silicon using private kperf/kperfdata frameworks.
// Requires root. Counts system-wide events (all CPUs) across a time window.
// Usage:
//   pmc_tool list [filter]
//   pmc_tool window
//
// `window` programs the counters, prints `READY`, and then blocks until it
// reads a line on stdin; the counter delta it prints covers everything that
// happened in between, on every CPU. The caller runs whatever it wants to
// measure during that gap:
//
//     p = Popen([pmc, "window"], stdin=PIPE, stdout=PIPE, text=True)
//     p.stdout.readline()          # "READY"
//     subprocess.run(cmd)          # measured, run by the caller
//     out, _ = p.communicate("\n") # counter deltas
//
// This deliberately does NOT run the command itself. The binary is deployed
// setuid-root so it can program the PMU, and a setuid binary that execs a
// caller-supplied command is a local privilege escalation waiting to happen —
// the previous version did exactly that and had to drop groups, gid and uid by
// hand before the exec to stay safe. Not exec'ing at all removes that whole
// class of bug: the privileged process now takes no caller-controlled input,
// and the measured command runs as the unprivileged caller because the caller
// is the one that spawns it. The counters are system-wide, so bracketing the
// command in time is all that was ever needed.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
// strcasestr is not declared by <string.h> under strict feature sets; it is
// declared in <strings.h> on macOS and needs _GNU_SOURCE on glibc.
#include <strings.h>
#include <stdint.h>
#include <stdbool.h>
#include <unistd.h>
#include <sys/sysctl.h>
#include <sys/time.h>

typedef uint64_t kpc_config_t;
typedef struct kpep_db kpep_db;
typedef struct kpep_config kpep_config;
typedef struct kpep_event {
    const char *name;
    const char *description;
    const char *errata;
    const char *alias;
    const char *fallback;
    uint32_t mask;
    uint8_t number;
    uint8_t umask;
    uint8_t reserved;
    uint8_t is_fixed;
} kpep_event;

// kperfdata.framework
extern int kpep_db_create(const char *name, kpep_db **db);
extern int kpep_db_events_count(kpep_db *db, size_t *count);
extern int kpep_db_events(kpep_db *db, kpep_event **buf, size_t buf_size);
extern int kpep_db_event(kpep_db *db, const char *name, kpep_event **ev);
extern int kpep_config_create(kpep_db *db, kpep_config **cfg);
extern int kpep_config_force_counters(kpep_config *cfg);
extern int kpep_config_add_event(kpep_config *cfg, kpep_event **ev, uint32_t flag, uint32_t *err);
extern int kpep_config_kpc(kpep_config *cfg, kpc_config_t *buf, size_t buf_size);
extern int kpep_config_kpc_count(kpep_config *cfg, size_t *count);
extern int kpep_config_kpc_classes(kpep_config *cfg, uint32_t *classes);
extern int kpep_config_kpc_map(kpep_config *cfg, size_t *buf, size_t buf_size);

// kperf.framework
extern int kpc_force_all_ctrs_set(int val);
extern int kpc_set_config(uint32_t classes, kpc_config_t *config);
extern int kpc_set_counting(uint32_t classes);
extern uint32_t kpc_get_counter_count(uint32_t classes);
extern int kpc_get_cpu_counters(bool all_cpus, uint32_t classes, int *curcpu, uint64_t *buf);

#define KPC_MAX_COUNTERS 32
#define MAX_EVENTS 8

static const char *event_names[] = {
    "FIXED_CYCLES",
    "FIXED_INSTRUCTIONS",
    "INST_BRANCH",
    "BRANCH_MISPRED_NONSPEC",
    "L1D_CACHE_MISS_LD",
    "L1D_CACHE_MISS_ST",
};
static const int n_events = sizeof(event_names) / sizeof(event_names[0]);

static int get_ncpu(void) {
    int ncpu = 0;
    size_t sz = sizeof(ncpu);
    sysctlbyname("hw.ncpu", &ncpu, &sz, NULL, 0);
    return ncpu;
}

// Upper bound on CPUs the counter buffer is sized for. kpc_get_cpu_counters
// fills one counter_count-wide row per CPU, so the buffer must cover every CPU
// the kernel reports or it writes past the end.
#define KPC_MAX_CPUS 256

static void read_counters(uint32_t classes, int ncpu, uint32_t counter_count, uint64_t *sums) {
    static uint64_t buf[KPC_MAX_CPUS * KPC_MAX_COUNTERS];
    if (ncpu > KPC_MAX_CPUS || counter_count > KPC_MAX_COUNTERS) {
        // Refuse rather than truncate: a short read would silently under-count
        // and the numbers would still look plausible.
        fprintf(stderr,
                "pmc_tool: ncpu=%d counter_count=%u exceeds buffer (%d x %d)\n",
                ncpu, counter_count, KPC_MAX_CPUS, KPC_MAX_COUNTERS);
        exit(1);
    }
    int ret = kpc_get_cpu_counters(true, classes, NULL, buf);
    if (ret != 0) {
        fprintf(stderr, "kpc_get_cpu_counters failed: %d\n", ret);
        exit(1);
    }
    memset(sums, 0, KPC_MAX_COUNTERS * sizeof(uint64_t));
    for (int c = 0; c < ncpu; c++)
        for (uint32_t i = 0; i < counter_count; i++)
            sums[i] += buf[c * counter_count + i];
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s list [filter] | window\n", argv[0]);
        return 1;
    }

    kpep_db *db = NULL;
    int ret = kpep_db_create(NULL, &db);
    if (ret != 0) {
        fprintf(stderr, "kpep_db_create failed: %d\n", ret);
        return 1;
    }

    if (strcmp(argv[1], "list") == 0) {
        size_t count = 0;
        kpep_db_events_count(db, &count);
        kpep_event **evs = malloc(count * sizeof(void *));
        kpep_db_events(db, evs, count * sizeof(void *));
        const char *filter = argc > 2 ? argv[2] : NULL;
        for (size_t i = 0; i < count; i++) {
            if (filter && !strcasestr(evs[i]->name, filter)) continue;
            printf("%-40s %s\n", evs[i]->name, evs[i]->description ? evs[i]->description : "");
        }
        return 0;
    }

    if (strcmp(argv[1], "window") != 0) {
        fprintf(stderr, "usage: %s list [filter] | window\n", argv[0]);
        return 1;
    }

    kpep_config *cfg = NULL;
    if (kpep_config_create(db, &cfg) != 0) { fprintf(stderr, "config_create failed\n"); return 1; }
    if (kpep_config_force_counters(cfg) != 0) { fprintf(stderr, "force_counters failed\n"); return 1; }

    for (int i = 0; i < n_events; i++) {
        kpep_event *ev = NULL;
        if (kpep_db_event(db, event_names[i], &ev) != 0) {
            fprintf(stderr, "event not found: %s (use 'list' to see names)\n", event_names[i]);
            return 1;
        }
        if (kpep_config_add_event(cfg, &ev, 0, NULL) != 0) {
            fprintf(stderr, "add_event failed: %s\n", event_names[i]);
            return 1;
        }
    }

    uint32_t classes = 0;
    size_t reg_count = 0;
    size_t counter_map[KPC_MAX_COUNTERS] = {0};
    kpc_config_t regs[KPC_MAX_COUNTERS] = {0};
    kpep_config_kpc_classes(cfg, &classes);
    kpep_config_kpc_count(cfg, &reg_count);
    kpep_config_kpc_map(cfg, counter_map, sizeof(counter_map));
    kpep_config_kpc(cfg, regs, sizeof(regs));

    if (kpc_force_all_ctrs_set(1) != 0) {
        fprintf(stderr, "kpc_force_all_ctrs_set failed (need root)\n");
        return 1;
    }
    if ((classes & 2 /*configurable*/) && reg_count) {
        if (kpc_set_config(classes, regs) != 0) {
            fprintf(stderr, "kpc_set_config failed\n");
            return 1;
        }
    }
    if (kpc_set_counting(classes) != 0) {
        fprintf(stderr, "kpc_set_counting failed\n");
        return 1;
    }

    int ncpu = get_ncpu();
    uint32_t counter_count = kpc_get_counter_count(classes);
    uint64_t before[KPC_MAX_COUNTERS], after[KPC_MAX_COUNTERS];

    struct timeval t0, t1;
    read_counters(classes, ncpu, counter_count, before);
    gettimeofday(&t0, NULL);

    /* Hand the window to the caller: announce readiness, then block until it
     * tells us the measured command has finished. stdout is a pipe in normal
     * use, so it must be flushed explicitly or READY sits in the buffer and
     * the caller deadlocks waiting for it. */
    printf("READY\n");
    fflush(stdout);

    int wait_failed = 0;
    {
        char line[64];
        if (fgets(line, sizeof(line), stdin) == NU
```

### Core Architecture Module: `bench/src/falkorbench/__init__.py`
```
"""Per-query performance harness for FalkorDB.

Layered so that each piece can be tested without a running server:

  model      value types (Query, Metric) — no I/O
  queries    the canonical query set and graph setup — data only
  metrics    CSV parsing, ratios, thresholds, normalisation — pure functions
  client     the falkordb-py control plane: server lifecycle, setup, probes
  counters   per-process instruction/cycle backends (rusage / perf / none)
  measure    the full-set measurement loop
  callgrind  deterministic instruction counts by differencing two runs
  compare    local regression gate      } both on `metrics`, so a local verdict
  report     the CI markdown comment    } and the CI comment cannot disagree
  profile    samply profile of one query
  flow       per-flow-test-file measurement

The measurement boundary is deliberate and load-bearing: anything *inside* a
counter window is a C binary (`redis-benchmark`, or `redis-cli -r N` under
callgrind), because the counters either window on a subprocess lifetime or are
system-wide and would otherwise absorb this process's own work. `client` is
only ever used *outside* a measurement window.
"""

```

### Core Architecture Module: `bench/src/falkorbench/callgrind.py`
```
"""Deterministic per-query instruction counts via callgrind.

Why this exists: no hosted CI runner exposes a PMU. Measured, not assumed — GCE
rejects `--performance-monitoring-unit` on the v1 and beta APIs alike, `perf`
there reports `<not supported>`, macOS runners return 0 for `proc_pid_rusage`'s
ri_instructions, and kperf inside a macOS runner fails with
`kpep_db_create failed: 7`. Hardware counters are simply unavailable.

Callgrind counts instructions in *software*, so it needs no PMU and no
privileges, and its counts are near-deterministic.

## How a query is isolated: differencing, not windowing

Callgrind reports one total when the process exits. The obvious approach is to
window with `callgrind_control --instr=on/off --dump` around each query, and
that is what the first version did. **It does not work in a container.**
`callgrind_control` reaches the process through vgdb FIFOs in /tmp, and
reproduced locally in `debian:trixie-slim` (valgrind 3.24.0, the CI version):

    ==236== open fifo /tmp/vgdb-pipe-from-vgdb-to-236-by-???-on-???
    ==236== valgrind: fatal error: vgdb FIFO cannot be opened.

The server dies on the first control command, so every dump silently never
arrives and every query reports nothing. Setting USER/LOGNAME does not help;
`--vgdb-prefix` makes `callgrind_control` hang instead.

So each query is measured by **differencing two complete runs** of the same
query at different repeat counts:

    T(n2) = startup + setup + compile + n2 * exec
    T(n1) = startup + setup + compile + n1 * exec
    exec  = (T(n2) - T(n1)) / (n2 - n1)

Startup, graph setup and one-time plan compilation appear identically in both
runs and cancel *exactly* — not approximately — because the counts are
deterministic. The price is two valgrind runs per query, each paying setup,
which is why CG_SETUP is deliberately small.

## Precision, and why the span is chosen per query

With the module loaded, CI measured per-run drift of ~300-600k instructions on a
~236M baseline. At a fixed span of 100 that is 3-6k instr/exec of error —
nothing for a 7M-instruction query, but **6.7% for `RETURN 1`**, which is how
the control row once read 1.0673x on two builds whose Rust was byte-identical.
The error is *absolute*, so "treat sub-1% as noise" is wrong in both directions.

The span is therefore chosen per query as `drift / (TARGET_REL * cost)`, holding
the *differenced work* constant instead of the span. Cheap queries get a wide
span (still cheap: `RETURN 1` at span ~3300 is ~300M instructions), expensive
ones keep the default.

## Not comparable to the full measurement set

CG_SETUP builds a 1,000-node graph, not the 10,000-node one, and skips the
vector/fulltext indexes, constraints, UDFs and DEBUG RELOAD. Absolute numbers
here are *not* comparable to `measure` rows — only PR-vs-base ratios are, where
both sides run this identical setup.
"""

from __future__ import annotations

import glob
import math
import shutil
import subprocess
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from falkorbench.model import Query

# Per-run drift in the whole-process total, measured in CI with the module
# loaded. Divided by the span this becomes the per-execution error, so it is an
# *absolute* budget, not a relative one.
DRIFT_INSTR = 600_000

# Per-execution precision to aim for. span = drift / (TARGET_REL * cost), so the
# differenced work is drift/TARGET_REL = 300M instructions regardless of how
# cheap the query is — a few seconds under valgrind.
TARGET_REL = 0.002
MAX_SPAN = 4000

# Widest per-execution error bar still worth reporting. A row that cannot be
# resolved better than this on the host it ran on is dropped rather than
# printed: a number nobody can reproduce is worse than a gap, because it still
# lands in the table looking like a measurement.
MAX_REL_ERR = 0.02

# A small graph that supports the cg-flagged subset. Deliberately not the full
# SETUP: that builds 10k nodes, 10k edges, vector and fulltext indexes,
# constraints, UDFs and a DEBUG RELOAD, and every one of those instructions
# would be paid twice per measured query under instrumentation.
#
# The Person index is created before the ring so the ring build is index-driven
# rather than a 1000x1000 nested scan.
CG_SETUP: tuple[str, ...] = (
    (
        "UNWIND range(0, 999) AS i "
        "CREATE (:Person {id: i, name: 'p' + toString(i), age: i % 80, score: i * 1.5})"
    ),
    "CREATE INDEX FOR (p:Person) ON (p.id)",
    (
        "UNWIND range(0, 999) AS i "
        "MATCH (a:Person {id: i}) MATCH (b:Person {id: (i + 1) % 1000}) "
        "CREATE (a)-[:KNOWS]->(b)"
    ),
    # `delete node` deletes one :Tmp per execution, so there must be more of them
    # than the highest repeat count — MAX_SPAN plus n1, since a cheap delete
    # query gets its span widened. Running dry would not fail loudly: the
    # remaining executions would measure a no-op delete and quietly halve the
    # reported cost.
    "UNWIND range(0, 4999) AS i CREATE (:Tmp {x: i})",
)


@dataclass
class Measurement:
    query: str
    instr: float
    span: int
    rel_err: float
    drift: float
    seconds: float
    widened_from: int | None = None


class Skipped(Exception):
    """This query produced no usable number, with the reason as the message."""


def parse_total(path: str) -> int | None:
    """Instruction count from a callgrind output file.

    Callgrind writes `totals:` (and `summary:`) with the first field being
    instruction reads. None when neither is present, which happens for a file
    still being written.
    """
    try:
        with open(path, errors="replace") as f:
            for line in f:
                if line.startswith(("totals:", "summary:")):
                    parts = line.split(":", 1)[1].split()
                    if parts:
                        return int(parts[0])
    except OSError:
        return None
    return None


@dataclass
class Runner:
    """Runs one instrumented server lifecycle and reads its instruction total.

    `bare` runs a plain redis-server with no module and no graph setup. That is
    not a toy mode: valgrind on arm64 cannot execute this module at all
    (`unhandled instruction 0xB8BFC108` — an ARMv8.1 LSE atomic in RediSearch's
    slots_tracker, valgrind's limitation rather than a module bug), so the
    differencing arithmetic above can only be validated against bare redis on
    that architecture. It used to require editing two module-level constants;
    making it a flag is what lets the arm64 validation run in CI or locally
    without a patched checkout.
    """

    module: Path | None
    port: int
    outdir: Path
    module_args: Sequence[str] = ()
    bare: bool = False

    @property
    def setup(self) -> tuple[str, ...]:
        return () if self.bare else CG_SETUP

    def total(self, cypher: str, reps: int, also_run: Sequence[str] = ()) -> int:
        """One instrumented lifecycle; returns its whole-process instruction total."""
        shutil.rmtree(self.outdir, ignore_errors=True)
        self.outdir.mkdir(parents=True, exist_ok=True)

        argv = [
            "valgrind",
            "--tool=callgrind",
            f"--callgrind-out-file={self.outdir}/callgrind.out.%p",
            "redis-server",
            "--port",
            str(self.port),
            "--save",
            "",
            # serverCron does work proportional to how long the process lives, and
            # the two runs being differenced live for different durations — so
            # cron lands in the subtraction as drift. Measured at the default
            # hz=10 it is ~240k instr per second of life, which swamped a PING
            # (~20k) and made two (n1,n2) pairs disagree by 44%. hz=1 is the
            # lowest redis accepts and cuts it 10x.
            "--hz",
            "1",
        ]
        if self.module is not None and not self.bare:
            argv += ["--loadmodule", str(self.module), 
```

### Core Architecture Module: `bench/src/falkorbench/cli.py`
```
"""The `bench` command.

One entry point with subcommands, rather than four scripts that each re-declared
--module/--port/--out and one shell script that needed a different one of them to
have been run first. The shared options are defined once, in `common_options`.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import click

from falkorbench import callgrind as cg
from falkorbench import client as client_mod
from falkorbench import compare as compare_mod
from falkorbench import coverage as coverage_mod
from falkorbench import flow as flow_mod
from falkorbench import measure as measure_mod
from falkorbench import metrics
from falkorbench import profile as profile_mod
from falkorbench import queries as query_set
from falkorbench import report as report_mod
from falkorbench.counters import select_backend

# bench/ is the project root; the repo is its parent.
BENCH_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BENCH_DIR.parent
RESULTS = BENCH_DIR / "results"


def _select(names: tuple[str, ...], *, cg_only: bool = False):
    """Resolve query names to Query objects, erroring on an unknown name."""
    pool = [q for q in query_set.QUERIES if q.cg] if cg_only else list(query_set.QUERIES)
    if not names:
        return pool
    wanted = set(names)
    chosen = [q for q in pool if q.name in wanted]
    missing = wanted - {q.name for q in chosen}
    if missing:
        raise click.ClickException(f"unknown queries: {sorted(missing)}")
    # Pull in whatever the chosen rows depend on, transitively. A row that
    # measures against a graph an earlier row builds is meaningless without it,
    # and silently so -- it reports a plausible number for the wrong graph.
    by_name = {q.name: q for q in pool}
    while True:
        need = {n for q in chosen for n in q.needs} - {q.name for q in chosen}
        if not need:
            break
        unknown = need - by_name.keys()
        if unknown:
            raise click.ClickException(f"unknown prerequisite queries: {sorted(unknown)}")
        chosen += [by_name[n] for n in need]
    # Back into suite order: a prerequisite has to run before its dependent.
    order = {q.name: i for i, q in enumerate(pool)}
    return sorted(chosen, key=lambda q: order[q.name])


def common_options(fn):
    """--module/--port, shared by every subcommand that starts a server."""
    fn = click.option(
        "--module",
        default=None,
        help="module to load (default: this repo's target/release build)",
    )(fn)
    fn = click.option("--port", default=6399, show_default=True, type=int)(fn)
    return fn


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def cli() -> None:
    """Per-query performance harness for FalkorDB."""


# --- measure -----------------------------------------------------------------


@cli.command()
@common_options
@click.option("--out", default=None, type=click.Path(), help="CSV output path")
@click.option("--n", "reps", default=1000, show_default=True, help="requests per query")
@click.option("--once", is_flag=True, help="run each query once, unmeasured (coverage)")
@click.option("--keep-server", is_flag=True, help="leave the server running afterwards")
@click.option("--reuse", is_flag=True, help="attach to a server already on --port")
@click.option("--setup/--no-setup", default=None, help="build the graph (implied unless --reuse)")
@click.option("--c-compat", is_flag=True, help="measuring the C engine: skip what it cannot do")
@click.argument("names", nargs=-1)
def measure(module, port, out, reps, once, keep_server, reuse, setup, c_compat, names):
    """Measure queries and write a CSV.

    Named queries are merged into an existing CSV, so a subset re-run patches
    only those rows.
    """
    queries = _select(names)
    out_path = Path(out) if out else RESULTS / "current.csv"
    module_path = client_mod.find_module(module, REPO_ROOT)
    # --reuse means "do not start a server". It must NOT silently also mean "do
    # not build the graph", or the harness measures an empty database and reports
    # numbers that look real. CI reuses a server from a published image and so
    # needs setup; default to building unless explicitly told not to.
    do_setup = (not reuse) if setup is None else setup

    server = client_mod.Server(port=port)
    if reuse:
        if not client_mod.is_server_up(port):
            raise click.ClickException(f"--reuse given but nothing answers on :{port}")
    else:
        if client_mod.is_server_up(port):
            raise click.ClickException(f"port {port} already in use; use --reuse or another --port")
        if not module_path.exists():
            raise click.ClickException(f"module not found: {module_path}")
        client_mod.write_csv_fixtures(Path(query_set.IMPORT_DIR), query_set.CSV_FILES)
        server = client_mod.start_server(
            module_path,
            port,
            RESULTS / "server_dir",
            Path(query_set.IMPORT_DIR),
            appendonly=once,
        )

    exit_code = 0
    try:
        bench = client_mod.connect(server)
        if do_setup:
            click.echo(f"server up on :{port}, building graph...")
            client_mod.build_graph(
                bench,
                query_set.SETUP,
                query_set.SETUP_COMMANDS,
                c_compat=c_compat,
            )

        if once:
            fails = measure_mod.run_once(
                bench,
                queries,
                query_set.ERROR_QUERIES,
                include_errors=not names,
                echo=click.echo,
            )
            if server.proc is not None and not keep_server:
                bench.shutdown()  # graceful: flushes .profraw
            raise SystemExit(1 if fails else 0)

        backend = counter_backend()
        rows, failures = measure_mod.measure_queries(
            bench,
            backend,
            queries,
            default_reps=reps,
            c_compat=c_compat,
            echo=click.echo,
        )
        measure_mod.merge_into_csv(out_path, rows)
        click.echo(f"wrote {out_path}")
        if failures:
            # A query in the set that does not answer is a real problem, and the
            # CSV is now missing that row rather than carrying a wrong one.
            click.echo(f"\n{len(failures)} query(ies) failed and were not measured:")
            for name, why in failures:
                click.echo(f"  {name}: {why}")
            exit_code = 1
    except client_mod.SetupFailed as e:
        raise click.ClickException(str(e)) from e
    finally:
        if server.proc is not None and not keep_server:
            server.stop()
        elif server.proc is not None:
            click.echo(f"server left running on :{port} (pid {server.proc.pid})")

    if exit_code:
        raise SystemExit(exit_code)


def counter_backend():
    """The counter backend, with pmc_tool picked up if it has been built.

    Without pmc_tool the branch/L1D columns stay empty, which is fine — the
    regression-gating columns are instructions and allocated bytes.
    """
    pmc = BENCH_DIR / "pmc_tool"
    backend = select_backend(str(pmc) if pmc.exists() else None)
    if pmc.exists() and getattr(backend, "pmc", None) is None:
        click.echo("pmc_tool present but not usable — branches/L1D columns stay empty")
    return backend


# --- callgrind ---------------------------------------------------------------


@cli.command()
@common_options
@click.option("--out", default=None, type=click.Path())
@click.option("--n1", default=20, show_default=True, help="low repeat count")
@click.option("--n2", default=120, show_default=True, help="high repeat count")
@click.option("--shard", default=None, help="measure only shard I/N (1-based, round-robin)")
@click.option("--job-total", default=None, type=int, help="cross-check N against the CI matrix")
@click.option("--module-args", multiple=True, help="extra --loadmodule a
```

### Core Architecture Module: `bench/src/falkorbench/client.py`
```
"""Server lifecycle and the control plane, over falkordb-py.

Replaces two hand-rolled `redis-cli` subprocess wrappers that had drifted apart
— one carried a timeout, the other carried server-log diagnostics, and both
detected success by looking for the substring `"execution time"` in stdout,
because `redis-cli` exits 0 even when the reply is an error. `Graph.query`
raises `ResponseError` instead, so failure is an exception rather than a string
that happens not to match.

Everything here runs *outside* measurement windows. The measured workload stays
`redis-benchmark` (and `redis-cli -r N` under callgrind) for the reasons in
`counters`.
"""

from __future__ import annotations

import contextlib
import os
import re
import shutil
import signal
import subprocess
import time
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

from falkordb import FalkorDB
from falkordb import Graph
from redis.exceptions import RedisError
from redis.exceptions import ResponseError

from falkorbench.model import Metric

GRAPH_NAME = "bench"

# Panic/crash markers worth surfacing from a server log. When the module panics,
# redis prints the panic and backtrace to its log and dies, and every later
# command fails with the useless "Server closed the connection" — which was all
# CI ever reported before the log was kept.
_DEATH_MARKERS = (
    "panicked at",
    "FalkorDB panic",
    "Redis crashed",
    "signal:",
    "=== REDIS BUG REPORT",
)


def _jemalloc_table_columns(header: str) -> dict[str, tuple[int, int]]:
    """Map each column label in a jemalloc `bins:`/`large:` header to the
    `(start, end)` character range of its field.

    **jemalloc's stats tables cannot be split on whitespace.** Every value is
    right-aligned in a fixed-width field, and the `(#/sec)` rate fields are only
    8 characters wide, so a rate of 10,000,000/sec or more fills its field
    exactly and no space is left between it and the `nmalloc` before it:

    ```text
    nmalloc (#/sec)      ndalloc (#/sec)     <- header
        1379247  689623      1355704  677852 <- fine, rates are 6 digits
    21949879 10974939 21947904 10973952      <- fused: 8-digit rates
    ```

    `line.split()` turns that second row into `['21949879109749392194790410973952']`
    -- a 16-digit garbage `nmalloc` -- and shifts every later column left by
    one, so `ndalloc` reads the fused ndalloc+rate too. The parsed cumulative
    total jumps by ~7e16 bytes the moment a hot size class crosses 10M
    allocations/sec, and drops back when it cools. Because `measure` reports
    *deltas* between two snapshots, that surfaced as per-query allocation
    figures in the petabytes and, when the fusion cleared between snapshots,
    as negative ones. It read as a 30,000x memory regression in whichever
    queries happened to straddle the transition.

    Slicing by the header's own column ranges is immune: overflow in a
    right-aligned field spills *left*, so a field read up to its own end column
    is still correct, and only its left neighbour (a rate we do not use) is
    damaged.

    A field therefore runs from the *previous* column's end to its own, not from
    its own label's start -- values are commonly wider than their label
    (`size` labels a 5-digit 49152), and anchoring on the label's start would
    shear the leading digits off.
    """
    cols: dict[str, tuple[int, int]] = {}
    prev_end = 0
    for m in re.finditer(r"\S+", header):
        label = m.group()
        # `(#/sec)` repeats after every counter, and the leading `bins:`/`large:`
        # is a row label rather than a column; both still advance the boundary.
        # First occurrence wins, which is all we need for named counters.
        if label not in ("bins:", "large:") and label not in cols:
            cols[label] = (prev_end, m.end())
        prev_end = m.end()
    return cols


def _jemalloc_row(
    line: str,
    cols: dict[str, tuple[int, int]],
    wanted: Sequence[str],
) -> dict[str, int] | None:
    """Read `wanted` integer fields out of one jemalloc table row, or None if
    this is not a data row (a `total:`/`---` separator, or a short line).

    Fields are located by the header's column ranges rather than by whitespace
    position; see [`_jemalloc_table_columns`].
    """
    out: dict[str, int] = {}
    for name in wanted:
        span = cols.get(name)
        if span is None:
            return None
        text = line[span[0] : span[1]].strip()
        if not text.isdigit():
            return None
        out[name] = int(text)
    return out


class SetupFailed(RuntimeError):
    """Graph setup did not complete, so nothing measured afterwards is valid."""


@dataclass
class Server:
    """A redis-server this harness started, or one it attached to.

    `proc` and `log_path` are None when attached (`--reuse`): the process is
    someone else's and its log is not ours to read.
    """

    port: int
    proc: subprocess.Popen | None = None
    log_path: Path | None = None
    work_dir: Path | None = None

    def death_details(self) -> str:
        """Panic/crash lines from the log, for when a command failed because the
        server is gone. Empty string when there is nothing to add."""
        if self.log_path is None or not self.log_path.exists():
            return ""
        try:
            lines = self.log_path.read_text(errors="replace").splitlines()
        except OSError:
            return ""
        marked = [ln.rstrip() for ln in lines if any(m in ln for m in _DEATH_MARKERS)]
        tail = marked[:6] or [ln.rstrip() for ln in lines[-6:]]
        return "\n  server log: " + "\n              ".join(tail)

    def stop(self) -> None:
        if self.proc is None:
            return
        self.proc.send_signal(signal.SIGTERM)
        self.proc.wait()
        self.proc = None


@dataclass
class BenchClient:
    """The control plane for one server: setup, probes, allocation snapshots."""

    db: FalkorDB
    server: Server
    graph_name: str = GRAPH_NAME
    _graph: Graph | None = field(default=None, repr=False)

    @property
    def graph(self) -> Graph:
        if self._graph is None:
            self._graph = self.db.select_graph(self.graph_name)
        return self._graph

    # --- queries -------------------------------------------------------------

    def run(self, cypher: str, write: bool = True) -> None:
        """Execute one statement, raising ResponseError on an error reply."""
        if write:
            self.graph.query(cypher)
        else:
            self.graph.ro_query(cypher)

    def command(self, *args: object) -> object:
        """A raw redis command, for what the graph API does not cover:
        DEBUG RELOAD, GRAPH.CONSTRAINT, GRAPH.UDF, MEMORY MALLOC-STATS."""
        return self.db.execute_command(*args)

    # --- probes --------------------------------------------------------------

    @property
    def pid(self) -> int:
        """The server's own pid, from a parsed INFO map.

        Was recovered by string surgery on redis-cli output
        (`out.split("process_id:")[1].split()[0]`) in two different files.
        """
        return int(self.db.connection.info("server")["process_id"])

    def jemalloc_totals(self) -> tuple[Metric, Metric]:
        """Cumulative (allocated, deallocated) bytes from jemalloc's merged-arena
        stats, or (None, None) if the server is not jemalloc-built.

        Sums size*nmalloc / size*ndalloc over the `bins:` and `large:`
        size-class tables, reading each field by the character columns of its
        own table header — see [`_jemalloc_table_columns`] for why splitting
        those rows on whitespace does not work.
        """
        try:
            out = str(self.command("MEMORY", "MALLOC-STATS"))
        except RedisError:
            return None, None
        if "Merged arenas stats:" not in out:
            return None, None

        alloc = deall
```

### Core Architecture Module: `bench/src/falkorbench/compare.py`
```
"""Local regression gate: one measurement CSV against a baseline CSV.

Shares `metrics` with `report`, which is the point. This gate used to have its
own parsing, its own ratio function and its own thresholds, and consequently its
own answer: it compared raw wall-clock at 1.25x, which across two hosts is a
noise detector — the very thing the rest of the harness refuses to do. It now
inherits the control-row normalisation and the non-positive-baseline guard that
only the CI reporter had.

Baselines are not committed (bench/.gitignore ignores baseline/): a checked-in
baseline goes stale the moment anything lands and then reports phantom
regressions for everyone. Produce your own from a base build.

Caveat worth knowing before trusting a verdict: the baseline is a single file,
so after switching branches this compares against numbers measured somewhere
else, silently. And a baseline from another machine is not comparable at all —
per-host speed differences alone measured 1.46x.
"""

from __future__ import annotations

from dataclasses import dataclass

from falkorbench.metrics import GATED_BY_DEFAULT
from falkorbench.metrics import MS_THRESHOLD
from falkorbench.metrics import THRESHOLDS
from falkorbench.metrics import Row
from falkorbench.metrics import has_data
from falkorbench.metrics import normalise_ms
from falkorbench.metrics import ratio


@dataclass
class Regression:
    query: str
    metric: str
    ratio: float
    base: float
    current: float
    threshold: float


@dataclass
class Comparison:
    metrics: list[str]
    skipped: list[str]
    regressions: list[Regression]
    missing: list[str]
    added: list[str]
    ratios: dict[str, dict[str, float | None]]
    ms_offset: float | None


def compare(
    current: dict[str, Row],
    baseline: dict[str, Row],
    *,
    metrics: list[str] | None = None,
    threshold: float | None = None,
) -> Comparison:
    """Compare two measurement sets. Pure — no printing, so it is testable.

    `metrics=None` gates the deterministic columns only. Naming `ms` explicitly
    opts into gating on wall-clock, which is not something to do casually.
    """
    wanted = list(metrics) if metrics else list(GATED_BY_DEFAULT)
    # Displayed regardless of whether it gates, so a reader can see the column.
    shown = list(dict.fromkeys([*wanted, "ms"]))
    limits = {m: (threshold if threshold is not None else THRESHOLDS[m]) for m in shown}
    gated = set(wanted)

    # A metric absent from either side is skipped rather than gated. Gating a
    # metric that no row carries silently gates on nothing.
    present = [m for m in shown if has_data(baseline.values(), m) and has_data(current.values(), m)]
    skipped = [m for m in shown if m not in present]

    # Wall-clock only means something once the per-host offset is cancelled.
    ms_offset = normalise_ms(current, baseline)

    ratios: dict[str, dict[str, float | None]] = {}
    regressions: list[Regression] = []
    for name, base_row in baseline.items():
        cur_row = current.get(name)
        if cur_row is None:
            continue
        per_metric: dict[str, float | None] = {}
        for m in present:
            r = ratio(base_row, cur_row, m)
            if r is not None and m == "ms":
                if ms_offset is None:
                    # No control row: report nothing rather than an uncorrected
                    # cross-host ratio.
                    r = None
                else:
                    r /= ms_offset
            per_metric[m] = r
            if r is None or m not in gated:
                continue
            limit = MS_THRESHOLD + 1.0 if m == "ms" else limits[m]
            if r > limit:
                regressions.append(
                    Regression(
                        query=name,
                        metric=m,
                        ratio=r,
                        base=base_row[m],  # type: ignore[arg-type]
                        current=cur_row[m],  # type: ignore[arg-type]
                        threshold=limit,
                    )
                )
        ratios[name] = per_metric

    return Comparison(
        metrics=present,
        skipped=skipped,
        regressions=regressions,
        missing=[n for n in baseline if n not in current],
        added=[n for n in current if n not in baseline],
        ratios=ratios,
        ms_offset=ms_offset,
    )


def render(cmp: Comparison) -> list[str]:
    """The comparison as printable lines."""
    widths = {m: max(8, len(m) + 2) for m in cmp.metrics}
    header = f"{'query':<24} " + "".join(f"{m:>{widths[m]}}" for m in cmp.metrics)
    out = [header, "-" * len(header)]

    flagged = {(r.query, r.metric) for r in cmp.regressions}
    for name, per_metric in cmp.ratios.items():
        cells = "".join(
            f"{per_metric[m]:>{widths[m]}.2f}"
            if per_metric.get(m) is not None
            else f"{'-':>{widths[m]}}"
            for m in cmp.metrics
        )
        hits = [m for m in cmp.metrics if (name, m) in flagged]
        suffix = "  <-- REGRESSION: " + ",".join(hits) if hits else ""
        out.append(f"{name:<24} {cells}{suffix}")

    for name in cmp.missing:
        out.append(f"{name:<24} MISSING from current")
    for name in cmp.added:
        out.append(f"{name:<24} NEW (not in baseline)")

    out.append("")
    gated = [m for m in cmp.metrics if m != "ms"]
    out.append("gated: " + ", ".join(f"{m} {THRESHOLDS[m]:.0%}" for m in gated))
    if "ms" in cmp.metrics:
        out.append(
            "ms is shown but NOT gated: wall-clock is never the gate here. Most "
            "queries cost 0.02-0.3 ms, so a ratio's denominator is process "
            "scheduling. Pass --metrics ms to gate on it anyway."
        )
    if cmp.ms_offset is not None and "ms" in cmp.metrics:
        out.append(
            f"ms ratios are normalised by the control row ({cmp.ms_offset:.2f}x); "
            f"raw wall-clock across two hosts is not comparable."
        )
    if cmp.skipped:
        out.append("no data in both CSVs (skipped): " + ", ".join(cmp.skipped))

    if cmp.regressions:
        out.append("")
        out.append(f"{len(cmp.regressions)} regression(s):")
        for r in sorted(cmp.regressions, key=lambda x: -x.ratio):
            out.append(
                f"  {r.query} [{r.metric}]: {r.ratio:.2f}x  "
                f"({r.base:,.0f} -> {r.current:,.0f}, threshold {r.threshold:.2f}x)"
            )
    else:
        out.append("")
        out.append("no regressions")
    return out

```

### Core Architecture Module: `bench/src/falkorbench/counters.py`
```
"""Per-process instruction/cycle counters, by platform.

Three backends, chosen by what the host actually provides:

  rusage  macOS. `proc_pid_rusage` gives a running total for any pid with no
          privileges, so a window is read-before / read-after.
  perf    Linux. There is no rusage equivalent; the PMU is reached through
          `perf stat -p <pid> -- <cmd>`, which measures the process for exactly
          as long as `cmd` runs. That is a window measurement rather than a
          running total, which is why the two cannot share one code path.
  null    Neither available. instr/cycles are then reported as *absent*, never
          substituted with wall-clock: a time-based stand-in would turn the
          regression gate into a noise detector while still looking like a
          measurement.

`cmd` is always an external process. That is not incidental — the perf backend
defines its counting window by that process's lifetime, and `pmc_tool`'s
counters are system-wide, so a Python-side loop would put this interpreter's own
work into the numbers. Whatever drives the measured queries stays a C binary.
"""

from __future__ import annotations

import ctypes
import shutil
import subprocess
import sys
import time
from collections.abc import Sequence
from typing import NamedTuple

from falkorbench.model import Metric


class Reading(NamedTuple):
    """One measurement window."""

    instr: Metric
    cycles: Metric
    elapsed: float
    events: dict[str, float]


class Rusage(NamedTuple):
    """The three `proc_pid_rusage` fields this harness uses."""

    instructions: int
    cycles: int
    peak_footprint: int


# --- macOS: proc_pid_rusage ---------------------------------------------------

_RUSAGE_INFO_V4 = 4


def read_rusage(pid: int) -> Rusage | None:
    """Running instruction/cycle/peak-footprint totals for `pid`, or None.

    Shared by the measure loop and the flow-test harness; it used to be copied
    into both. None (rather than raising) when the pid is gone, because the flow
    harness polls pids that come and go.
    """
    if sys.platform != "darwin":
        raise RuntimeError("proc_pid_rusage is macOS-only")
    libproc = ctypes.CDLL("/usr/lib/libproc.dylib")
    buf = ctypes.create_string_buffer(1024)
    if libproc.proc_pid_rusage(ctypes.c_int(pid), ctypes.c_int(_RUSAGE_INFO_V4), buf) != 0:
        return None
    u64 = (ctypes.c_uint64 * 40).from_buffer_copy(buf.raw[16:336])
    # ri_instructions, ri_cycles, ri_lifetime_max_phys_footprint
    return Rusage(u64[29], u64[30], u64[28])


class PmcTool:
    """Optional Apple-silicon PMU counters (branches / branch-misses / L1D).

    `pmc_tool` deliberately does not run the measured command itself: it is
    installed setuid-root, and a setuid binary that execs a caller-supplied
    command is a local privilege escalation (put your own `redis-benchmark`
    earlier in `$PATH` and you have root). It opens a counter window, prints
    READY and waits on stdin; the caller runs the command unprivileged in that
    gap and then closes the window. The counters are system-wide, so bracketing
    in time was always sufficient.
    """

    def __init__(self, path: str) -> None:
        self.path = path

    def works(self) -> bool:
        return self.window(["true"])[0] is not None

    def window(self, cmd: Sequence[str]) -> tuple[dict[str, float] | None, float]:
        """Run `cmd` inside a counter window; return (events, elapsed)."""
        proc = subprocess.Popen(
            [self.path, "window"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            if (proc.stdout.readline() or "").strip() != "READY":  # type: ignore[union-attr]
                proc.kill()
                return None, 0.0
            subprocess.run(cmd, capture_output=True)
            out, _ = proc.communicate("\n", timeout=60)
        except (OSError, subprocess.SubprocessError):
            proc.kill()
            return None, 0.0
        if "EVENT" not in out:
            return None, 0.0
        events: dict[str, float] = {}
        elapsed = 0.0
        for line in out.splitlines():
            parts = line.split()
            if not parts:
                continue
            if parts[0] == "ELAPSED":
                elapsed = float(parts[1])
            elif parts[0] == "EVENT":
                events[parts[1]] = float(parts[2])
        return events, elapsed


class RusageBackend:
    name = "rusage"

    def __init__(self, pmc: PmcTool | None = None) -> None:
        self.pmc = pmc

    def run_and_count(self, pid: int, cmd: Sequence[str]) -> Reading:
        before = read_rusage(pid)
        if self.pmc is not None:
            events, elapsed = self.pmc.window(cmd)
            events = events or {}
        else:
            events = {}
            t0 = time.time()
            subprocess.run(cmd, capture_output=True)
            elapsed = time.time() - t0
        after = read_rusage(pid)
        if before is None or after is None:
            raise OSError(f"proc_pid_rusage failed for pid {pid} (process gone?)")
        return Reading(
            after.instructions - before.instructions,
            after.cycles - before.cycles,
            elapsed,
            events,
        )


# --- Linux: perf -------------------------------------------------------------


class PerfBackend:
    name = "perf"

    def __init__(self, perf: str) -> None:
        self.perf = perf

    def run_and_count(self, pid: int, cmd: Sequence[str]) -> Reading:
        """instructions/cycles for `pid` while `cmd` runs, plus elapsed seconds.

        `perf stat -p PID -- CMD` attaches to PID, runs CMD, and stops counting
        when CMD exits, so the counters cover exactly the benchmark window.
        `-x,` gives machine-readable `value,unit,event,...` lines on stderr.
        """
        t0 = time.time()
        out = subprocess.run(
            [self.perf, "stat", "-x,", "-e", "instructions,cycles", "-p", str(pid), "--", *cmd],
            capture_output=True,
            text=True,
        )
        elapsed = time.time() - t0
        vals = _parse_perf(out.stderr)
        if "instructions" not in vals or "cycles" not in vals:
            raise OSError(
                "perf stat returned no instructions/cycles. Needs PMU access: "
                "kernel.perf_event_paranoid <= 0 (or CAP_PERFMON), and a host that "
                "exposes the PMU (bare metal or a VM with vPMU enabled). "
                f"stderr: {out.stderr.strip()[:300]}"
            )
        return Reading(vals["instructions"], vals["cycles"], elapsed, {})


def _parse_perf(stderr: str) -> dict[str, float]:
    """`value,unit,event,...` lines -> {event: value}, skipping unavailable ones.

    "<not supported>" / "<not counted>" arrive in the value column and are
    dropped, which is what lets `perf_counters_work` below tell a real PMU from
    a perf binary that runs fine and measures nothing.
    """
    vals: dict[str, float] = {}
    for line in stderr.splitlines():
        parts = line.split(",")
        if len(parts) >= 3:
            try:
                vals[parts[2].strip()] = float(parts[0].strip())
            except ValueError:
                continue
    return vals


def perf_counters_work(perf: str | None) -> bool:
    """True only if perf actually returns counter values.

    The binary being on PATH is not enough: without PMU access (a VM without
    vPMU, or a strict `kernel.perf_event_paranoid`) perf runs fine and reports
    `<not supported>` for every event. Selecting the backend on `which perf`
    alone made the availability check lie, so the graceful-degradation path
    never engaged and a run died on its first measurement instead of reporting
    instr/cycles as absent.
    """
    if not perf:
        return False
    try:
        out = subprocess.run(
            [perf, "stat", "-x,", "-e", "instructions,c
```

### Core Architecture Module: `bench/src/falkorbench/coverage.py`
```
"""How much of the graph crate the query set actually reaches.

Builds an instrumented debug module, runs every query once, and reports line
coverage of `graph/src` (excluding the generated GraphBLAS FFI).

This is a **validator of the query set**, not a coverage gate: it reports a
percentage and enforces no floor. What it does enforce is that every query still
runs — the once-pass exits non-zero if any of them stops working, which is the
part worth failing CI over.

Was `bench/coverage.sh`. The report parsing in particular was two `awk`
one-liners indexing `$8`/`$9` out of llvm-cov's table with nothing explaining
where those numbers came from; here the column layout is named once and covered
by tests.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# `llvm-cov report` emits a fixed, whitespace-separated table:
#
#   Filename Regions Missed_Regions Cover Functions Missed_Functions Executed \
#   Lines Missed_Lines Cover Branches ...
#
# so index 7 is total lines and index 8 is missed lines. The shell version
# hardcoded these as awk's $8/$9 with no note of what they were.
_LINES = 7
_MISSED_LINES = 8

# The FFI bindings are generated, and vendored/toolchain sources are not ours.
IGNORE_RE = r"(GraphBLAS\.rs|graphblas/mod\.rs|\.cargo|rustc)"


@dataclass
class FileCoverage:
    path: str
    lines: int
    missed: int

    @property
    def covered(self) -> int:
        return self.lines - self.missed

    @property
    def percent(self) -> float:
        return 100.0 * self.covered / self.lines if self.lines else 0.0


@dataclass
class Coverage:
    files: list[FileCoverage]

    @property
    def lines(self) -> int:
        return sum(f.lines for f in self.files)

    @property
    def missed(self) -> int:
        return sum(f.missed for f in self.files)

    @property
    def covered(self) -> int:
        return self.lines - self.missed

    @property
    def percent(self) -> float:
        return 100.0 * self.covered / self.lines if self.lines else 0.0

    def least_covered(self, min_lines: int = 200, limit: int = 15) -> list[FileCoverage]:
        big = [f for f in self.files if f.lines > min_lines]
        return sorted(big, key=lambda f: f.percent)[:limit]


def parse_report(text: str, prefix: str = "graph/src") -> Coverage:
    """Pull per-file line counts for `prefix` out of an `llvm-cov report` table.

    Rows whose filename does not contain `prefix` are skipped, as are the TOTAL
    row and any row too short to carry line columns — llvm-cov wraps long paths
    onto their own line, which would otherwise be read as a data row.
    """
    files: list[FileCoverage] = []
    for line in text.splitlines():
        if prefix not in line:
            continue
        parts = line.split()
        if len(parts) <= _MISSED_LINES:
            continue
        try:
            lines, missed = int(parts[_LINES]), int(parts[_MISSED_LINES])
        except ValueError:
            continue
        files.append(FileCoverage(path=parts[0], lines=lines, missed=missed))
    return Coverage(files=files)


def _llvm_tool(name: str) -> Path:
    """Locate an llvm-tools binary belonging to the *rust toolchain*.

    The toolchain's copy is required, not merely preferred: LLVM's instrumentation
    profile format is versioned and coupled to the rustc that emitted the
    `.profraw`. A system LLVM (Homebrew's, say) is usually a different major
    version and fails with "unsupported instrumentation profile format version".
    So `~/.rustup/toolchains` is searched first and `PATH` is only a fallback —
    getting this backwards is easy, because on a dev machine `shutil.which` finds
    a perfectly real llvm-profdata that cannot read these profiles.

    These binaries are not on PATH by default: they ship in the
    `llvm-tools-preview` component, which is not installed by default. The shell
    version globbed `~/.rustup` and, when it found nothing, silently built the
    path `./llvm-profdata` and failed with a confusing "No such file or
    directory" — hence the explicit error below.
    """
    roots = [Path.home() / ".rustup/toolchains"]
    rustc = shutil.which("rustc")
    if rustc:
        # rustup shims resolve to ~/.rustup/toolchains/<tc>/bin/rustc, so the
        # sibling lib/ tree is where a non-default RUSTUP_HOME keeps them.
        roots.append(Path(rustc).resolve().parent.parent / "lib")
    for root in roots:
        if not root.exists():
            continue
        for found in sorted(root.rglob(name)):
            if found.is_file() and os.access(found, os.X_OK):
                return found

    on_path = shutil.which(name)
    if on_path:
        return Path(on_path)
    raise RuntimeError(
        f"{name} not found. Install it with: rustup component add llvm-tools-preview"
    )


def module_extension() -> str:
    return "dylib" if sys.platform == "darwin" else "so"


def build_flags() -> tuple[str, dict[str, str]]:
    """RUSTFLAGS and extra env for an instrumented build."""
    flags = "-C instrument-coverage"
    env: dict[str, str] = {}
    if sys.platform != "darwin":
        # Required on Linux (and so in CI): the embedded RediSearch static libs
        # otherwise fail to link with duplicate-symbol errors. macOS's linker
        # neither takes the flag nor needs it.
        flags += " -C link-arg=-Wl,--allow-multiple-definition"
        # graph/build.rs compiles C++ shims; the toolchain image has no default.
        env["CXX"] = os.environ.get("CXX", "clang++")
    return flags, env


def run(root: Path, bench_dir: Path, *, port: int, echo=print) -> Coverage:
    """The whole loop: instrumented build, one pass over the query set, report."""
    covdir = bench_dir / "results/cov"
    shutil.rmtree(covdir, ignore_errors=True)
    covdir.mkdir(parents=True)

    flags, extra_env = build_flags()
    env = {**os.environ, "RUSTFLAGS": flags, **extra_env}

    echo("== instrumented debug build ==")
    subprocess.run(["cargo", "build"], cwd=root, env=env, check=True)

    module = root / f"target/debug/libfalkordb.{module_extension()}"
    if not module.exists():
        raise RuntimeError(f"instrumented module not found at {module}")

    echo("== running the query set once each ==")
    # A subprocess, deliberately: the instrumented server inherits
    # LLVM_PROFILE_FILE from it, and keeping the measured run in its own process
    # means this command's own imports never land in the profile.
    once_env = {**os.environ, "LLVM_PROFILE_FILE": str(covdir / "cov-%p.profraw")}
    once = subprocess.run(
        [
            sys.executable,
            "-m",
            "falkorbench.cli",
            "measure",
            "--once",
            "--port",
            str(port),
            "--module",
            str(module),
        ],
        cwd=root,
        env=once_env,
    )

    profraws = sorted(covdir.glob("*.profraw"))
    if not profraws:
        raise RuntimeError(
            "no .profraw written — the instrumented server never flushed. It must "
            "be shut down gracefully (SHUTDOWN NOSAVE), not killed."
        )

    profdata = covdir / "cov.profdata"
    subprocess.run(
        [
            str(_llvm_tool("llvm-profdata")),
            "merge",
            "--sparse",
            *map(str, profraws),
            "-o",
            str(profdata),
        ],
        check=True,
    )
    report = subprocess.run(
        [
            str(_llvm_tool("llvm-cov")),
            "report",
            "--instr-profile",
            str(profdata),
            str(module),
            f"--ignore-filename-regex={IGNORE_RE}",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    (covdir / "report.txt").write_text(report)

    cov = parse_report(report)
    echo("")
    echo("== graph crate coverage (excluding the generated GraphBLAS FFI) ==")
    echo(f"lines: {cov.covered}/{c
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2842** (2026-09-17): **effects v3: IdList builder reorders ids when a segment joins a run running the other way**
  *Symptoms*: The v3 `IdList` builder emits ids in a different order than they were pushed, whenever a segment that reads one way is folded into a run that reads the other. Every id is present and `len` is correct, so nothing downstream objects — but an `IdList` is positional, row *k* belongs to the *k*-th id as written, so **two entities exchange values on the replica with no error, no log entry and no resync.**  This affects Rust → Rust replication on `main` today. It is independent of the C v3 work, which is how it was found.  ## Reproduction  Both cases produced by running `graph/src/effects/v3/id_list.rs` from `origin/main` directly — the file copied verbatim into a standalone crate along with `narrow_int.rs`, `effects/error.rs`, `reader.rs`, `writer.rs` and the trait definitions, same dependency pins (`roaring =0.11.5`), with only the file's own `#[cfg(test)]` modules dropped. Untouched engine source, not a reimplementation.  **Ascending run, descending pair folded in:**  ``` pushed  [1, 2, 5, 4, 7, 9, ...] emitted [1, 2, 4, 5, 7, 9, ...] IdList { len: 101, segments: [Ascending { bitmap: ..101 values.., min: 1, max: 199 }] } ```  **The mirror — descending run, ascending pair folded in:**  ``` pushed  [154, 152, 150, 151, 148, 146, ...] emitted [154, 152, 151, 150, 148, 146, ...] IdList { len: 41, segments: [Descending { bitmap: ..41 values.., min: 100, max: 178 }] } ```  ## Mechanism  `graph/src/effects/v3/id_list.rs:896-909`. A lone `Range { base, len: 1 }` followed by a step down i
  **Post-Mortem & Fix Analysis**:
  > Triage verification (2026-09-16):  - **Recreated at the source level** using the issue's minimal IdList reproducer against the current Rust v3 implementation: when a descending two-id segment is folded into an already ascending run (and the mirrored descending case), iteration emits the pair in reverse order. That changes positional row-to-id mapping without changing length or set membership. - **Not fixed on `main`**: `graph/src/effects/v3/id_list.rs` still rewrites the singleton to `RangeDescending` and returns without ending an opposite-direction run (the same logic is present in `origin/main`). The public edge-rs query path does not naturally generate descending endpoint lists, so this is a codec/source-level reproduction rather than a normal Cypher query reproduction. - **Duplicate check**: no existing issue found for this IdList ordering defect.  Classified as **Bug**. No `fixed-rust` label added because the Rust implementation still contains the defect.

- **Issue #2821** (2026-09-14): **ci: the fuzz job cannot install cargo-fuzz 0.13.1 on current nightly**
  *Symptoms*: The `fuzz` job fails before it fuzzes anything. The fuzz step itself is skipped; what fails is installing the tool:  ``` error: attributes starting with `rustc` are reserved for use by the `rustc` compiler 28 | #[cfg_attr(rustc_attrs, rustc_layout_scalar_valid_range_start(0xf001))] error: cannot find attribute `rustc_layout_scalar_valid_range_start` in this scope error: could not compile `rustix` (lib) due to 4 previous errors error: failed to compile `cargo-fuzz v0.13.1` ```  ## Cause  The workflow takes an unpinned nightly and a pinned old tool:  ```yaml - run: rustup default nightly - run: cargo install --root ... --version ${{ env.CARGO_FUZZ_VERSION }} cargo-fuzz   # 0.13.1 ```  `cargo-fuzz 0.13.1` resolves **`rustix v0.36.5`**, which declares internal compiler attributes behind `cfg(rustc_attrs)`. Current nightly refuses them outright, so the dependency cannot build — nothing to do with the fuzz targets or any PR's code.  It is not visible on every run because the job caches the built binary under `cargo-fuzz-bin-<version>`. While that cache entry stays warm the install is skipped; once it is evicted, the rebuild hits current nightly and fails. That is why this surfaced repo-wide rather than on one branch — it is failing on `perf/limit-aware-scan-batching` and `feat/effects-v3-tests` alike, and no run in the last 60 has a green `fuzz` job.  ## Fix  Bump to `cargo-fuzz 0.13.2`, which resolves **`rustix v1.1.4`** — no internal attributes, builds clean.  Verified locally ag
  **Post-Mortem & Fix Analysis**:
  > ## Triage findings  - **Type:** Bug; set the native issue type to `Bug` and added `bug` and `component: ci`. - **Reproduction:** The report identifies a CI tool-install failure rather than a query/runtime reproduction. Its cited `cargo-fuzz 0.13.1` / current-nightly failure is consistent with the recorded error. - **Rust mainline:** Verified fixed. Merged PR [#2823](https://github.com/FalkorDB/FalkorDB/pull/2823), which explicitly fixes this issue, is present on `main` as commit `447ad403`; both Rust CI workflows now set `CARGO_FUZZ_VERSION: 0.13.2`. Added `fixed-rust`. - **Duplicates:** No duplicate issue found. #2823 is the merged implementation PR that closes this report, not a duplicate. - **Status:** No further reproduction is needed because the correction is already in the Rust mainline.

- **Issue #2811** (2026-09-17): **Index population can silently skip rows / hang, when the label or relation matrix has unsynced delta-plus entries**
  *Symptoms*: ## Summary \`_Index_PopulateNodeIndex\` / \`_Index_PopulateEdgeIndex\` (src/index/index_construct.c) resume batched population by re-attaching the matrix iterator at \`[last_row(+1), MAX)\`. This assumes ids/rows stream out in one globally ascending order, which only holds if the label/relation matrix has no pending delta-plus entries. It doesn't always hold, so a batch boundary can land such that delta-plus rows below the resume point are permanently skipped.  ## Impact - **Nodes:** a freshly created or reloaded index can silently miss rows that were pending in delta-plus at population time. Affects live \`CREATE INDEX\`, not just \`DEBUG RELOAD\`/replica full sync (the old forced decoder flush masked it on reload only, up through v4.20.3). - **Edges:** currently masked by a separate tautology in \`_Index_PopulateEdgeIndex\`'s batching condition that prevents it from ever stopping at \`batch_size\` — so edge population never actually resumes a partial range, at the cost of holding the read lock for the entire population (long write stalls on large relation types). Fixing that tautology alone reintroduces the row-skip bug for edges, and can also make population hang indefinitely under specific alignments.  ## Fix See linked PR — adds a strictly-increasing merge iteration mode for \`Delta_MatrixTupleIter\`/\`TensorIterator\` and switches both population functions to it, and removes the edge batching tautology. Root cause, reproduction, and verification are documented in the PR
  **Post-Mortem & Fix Analysis**:
  > ## Triage findings  - **Type:** Bug; labeled `bug`. - **C reproduction:** Verified on `docker.io/falkordb/falkordb:v4.20.4` using 100,000 nodes. After creating the high-id labeled range, flushing it, adding ids 1..1000 as pending delta-plus entries, and creating a range index, the index reported **99,000** rows instead of 100,000; the query restricted to `p >= 1 AND p <= 1000` returned **0** instead of 1,000. This confirms the low delta-plus rows are skipped at a batch resume boundary. - **Rust mainline:** Re-ran the same unsynced-delta setup on `docker.io/falkordb/falkordb-server:edge-rs`; the index returned **20,000/20,000** total rows and **1,000/1,000** low-range rows. The Rust implementation does not exhibit this C index-population defect, so `fixed-rust` is not applicable. - **Duplicates:** No duplicate found. #2294 concerns `GRAPH.BULK` rows missing from an existing index, a different population path. - **Fix linkage:** The proposed fix is tracked in #2812, which switches C popu

- **Issue #2796** (2026-09-16): **Id allocator can hand out a live id after a cancelled reservation, fusing two entities**
  *Symptoms*: ### Summary  After a `CREATE` in the same query is cancelled by a `DELETE`, the id allocator can hand out an id that is already live. Two nodes — or two relationships — end up sharing one id, so the query silently creates fewer entities than it was asked for. No error is raised and the `Nodes created` statistic under-reports to match.  ### Reproduction  ``` GRAPH.QUERY g "CREATE (a), (b), (c) DELETE b CREATE (d), (e)" GRAPH.QUERY g "MATCH (n) RETURN id(n) ORDER BY id(n)" ```  Four nodes should survive — `a`, `c`, `d`, `e`; `b` was created and deleted inside the one query.  | | `Nodes created` | surviving ids | |---|---|---| | observed | 3 | `0, 2, 3` | | expected | 4 | four distinct ids |  `c` and `d` are the same node: the second `CREATE` was handed id 2, which the first clause had already given to `c`, and wrote over it.  The relationship allocator has the same defect. Cascading a delete through a pending node returns an edge id, and the two surviving edges then come back under one id:  ``` GRAPH.QUERY g "CREATE (a)-[:R]->(b), (c)-[:R]->(d) DELETE a CREATE (x)-[:R]->(y)" GRAPH.QUERY g "MATCH ()-[r]->() RETURN id(r) ORDER BY id(r)" ```  observed `1, 1` — the same relationship returned twice — against an expected two distinct ids. Note that deleting a relationship *directly* does not reproduce this; only a node delete cascading through `remove_pending_relationships_for_node` returns a relationship id.  ### How often  Not a corner case. Seeded sequences of ordinary creates, pe
  **Post-Mortem & Fix Analysis**:
  > Triage findings:  - **Type:** Bug; labeled `bug` and `rust`. - **Reproduced:** Yes, on `falkordb/falkordb:edge-rs` (Rust mainline). `CREATE (a),(b),(c) DELETE b CREATE (d),(e)` reports `Nodes created: 3` and surviving IDs `0, 2, 3` instead of four distinct nodes. The relationship variant returns `1, 1`, confirming the same allocator collision for relationships. - **Rust status:** Not fixed on the current Rust mainline image; the defect is still present. - **Duplicates:** No matching existing issue found in the repository search.  The report is valid and should remain open for an allocator fix. 

- **Issue #2790** (2026-09-14): **perf: a leaf scan packs a full 1024-row batch regardless of a downstream LIMIT**
  *Symptoms*: `... LIMIT 10` over a label scan does roughly 100x the work it needs and throws the rest away: the scan packs a full `BATCH_SIZE` (1024) batch before anything downstream can stop it.  The tell is a step function at the batch boundary rather than a curve in the limit. 10k `:Person` plus a 10k `:KNOWS` ring, instructions per query:  | query | instructions | |---|---:| | `scan LIMIT 10` | 702,890 | | `scan LIMIT 1000` | 1,178,868 | | `scan LIMIT 1024` | 1,188,376 | | `scan LIMIT 2048` | 2,245,072 |  1.7x more work for 100x the rows, then exactly 2x the moment the limit crosses 1024. That is the batch size showing through, not the query getting harder.  ## Most of the machinery already exists  - `BatchedResultEmitter::set_pack_ceiling` / `apply_record_cap` are already there, and the doc comment already describes this exact case — "an operator fed by a downstream `Skip`/`Limit` lowers it ... so a capped query produces a small first batch". Only `UNWIND` ever called it. - `Runtime::record_cap` already walks `Project` / `Skip` / `CondTraverse` / `ExpandInto` to find the budget, and already stops at row-reducing barriers such as `Filter`.  The scan simply never asked.  ## The budget is a hint, not a bound  At a leaf scan the budget cannot be treated as a bound on the operator's own output, because something between the scan and the `Limit` may discard rows — `effective_limit` deliberately walks *through* `CondTraverse`, which passes rows 1:0 as readily as 1:N. A ceiling pinned at the
  **Post-Mortem & Fix Analysis**:
  > **Triage:** Verified and reproducible on `docker.io/falkordb/falkordb-server:edge` (Rust engine), with 10,000 `:Person` nodes. `GRAPH.PROFILE` shows the downstream `Limit` returns the requested rows, but the leaf scan still produces a full 1,024-row batch for limits below the batch size:  ```text LIMIT 10 Limit: 10; Project: 1024; Node By Label Scan: 1024 LIMIT 1000 Limit: 1000; Project: 1024; Node By Label Scan: 1024 LIMIT 1024 Limit: 1024; Project: 1024; Node By Label Scan: 1024 LIMIT 2048 Limit: 2048; Project: 2048; Node By Label Scan: 2048 ```  This confirms the reported batch-boundary behavior. It is **not fixed in current `main`**: `NodeByLabelScanOp` is constructed without applying `Runtime::record_cap`, while the existing cap is only wired into other operators. I found no existing issue describing this same leaf-scan batching defect; #141 concerns a different selective traversal performance problem, so this is not a duplicate.  Classified as **Bug** (performance correctness) an

- **Issue #2780** (2026-09-09): **[Rust] DISTINCT deduplicates on 64-bit hashes without an equality check, silently dropping rows**
  *Symptoms*: ## Summary  `DISTINCT` deduplication stores only a 64-bit hash of each row/value, never the values themselves, and treats any hash collision as equality. Colliding-but-different rows are silently dropped from the result set. This is not a theoretical concern: `Hash for Value` deliberately hashes an integer and a whole-valued float to the same bytes, so `1` and `1.0` — which `DISTINCT` must keep as two rows, since they are not equal under Cypher's `=` for `DISTINCT` purposes in FalkorDB's own comparison rules — is a guaranteed, non-probabilistic collision.  ## Affected code  `graph/src/runtime/value.rs:1735-1760`  ```rust pub struct ValuesDeduper {     seen: FxHashSet<u64>,     // hashes only — the values are discarded }  impl ValuesDeduper {     pub fn is_seen(&mut self, values: &[Value]) -> bool {         let mut hasher = FxHasher::default();         values.hash(&mut hasher);         !self.seen.insert(hasher.finish())     } } ```  `graph/src/runtime/value.rs:822-848` — `Hash for Value` normalises numerics:  ```rust Value::Int(i) => { /* hashes the integer bytes */ } Value::Float(f) => {     if f.fract() == 0.0 && /* representable as i64 */ {         // hashed identically to Value::Int     } } ```  Consumers: `graph/src/runtime/ops/distinct.rs` (the `DISTINCT` operator) and `graph/src/runtime/eval.rs:827-834` (`count(DISTINCT …)` / `collect(DISTINCT …)`).  ## Trigger  ```cypher UNWIND [1, 1.0] AS x RETURN DISTINCT x; UNWIND [1, 1.0] AS x RETURN count(DISTINCT x); UNWIND [1, 1
  **Post-Mortem & Fix Analysis**:
  > Closing this — I was wrong, and I'd rather withdraw it than leave a misleading report open.  I verified against a live server at `393302586` and the headline example is **correct behaviour, not a bug**:  ``` 127.0.0.1:6399> GRAPH.QUERY g "UNWIND [1, 1.0] AS x RETURN DISTINCT x" x 1 ```  `DISTINCT` is defined on equality and `1 = 1.0` is `true` in openCypher, so collapsing them to one row is right. `Hash for Value` tagging `Int` and whole-valued `Float` identically (`value.rs:834-845`) is therefore a *requirement*, not a defect.  I also probed for cross-type collisions, and they don't exist either — every variant carries a type discriminant (`Null` 0, `Bool` 1, `Int`/`Float` 2, `String` 3, `List` 4, `Map` 5, …), and all of these correctly return two rows:  ``` UNWIND [1, [1]] AS x RETURN DISTINCT x         -> 1, [1] UNWIND ['a', ['a']] AS x RETURN DISTINCT x     -> a, [a] UNWIND [[1,2],[1,2,3]] AS x RETURN DISTINCT x  -> [1, 2], [1, 2, 3] UNWIND [true, 1] AS x RETURN DISTINCT x        -

- **Issue #2778** (2026-09-10): **[Rust] Composite UNIQUE constraint falsely rejects entities that are missing a constrained property**
  *Symptoms*: ## Summary  For a **composite** UNIQUE constraint, enforcement is skipped only when *every* constrained property is NULL/missing. If some are present and some are missing, the entity is still enforced, with missing properties encoded as a shared `\0` marker. Two entities that are both missing the same property therefore collide on that marker and the second one is rejected as a duplicate — a false constraint violation. Both the C reference engine and openCypher/Neo4j treat a missing property as vacuously satisfying the constraint.  ## Affected code  `graph/src/graph/graph.rs:3800-3819`  ```rust pub fn build_composite_key(...) -> Vec<u8> {     let mut all_null = true;     let mut key = Vec::new();     for prop in properties {         match get(prop) {             Some(v) if !matches!(v, Value::Null) => {                 all_null = false;                 key.extend_from_slice(format!("{v:?}").as_bytes());             }             _ => key.push(0), // NULL marker         }         key.push(b'|');     }     if all_null { Vec::new() } else { key }   // <-- should be `any_null` } ```  The `is_empty()` result is the "skip enforcement" signal at every call site: `graph.rs:3770`, `graph.rs:3788` (`validate_unique_constraint`, run when a constraint is created), and `graph/src/runtime/pending.rs:1197`, `:1209`, `:1267`, `:1279` (runtime enforcement on write).  ## Reference behaviour  `src/constraint/unique_constraint.c` on `master`:  ```c if (!AttributeSet_Get (attributes, attr_id, att
  **Post-Mortem & Fix Analysis**:
  > **Verified by execution** on `393302586`:  ``` 127.0.0.1:6399> GRAPH.QUERY cu "CREATE (:Q {a:1})" 127.0.0.1:6399> GRAPH.QUERY cu "CREATE INDEX FOR (n:Q) ON (n.a, n.b)" 127.0.0.1:6399> GRAPH.CONSTRAINT CREATE cu UNIQUE NODE Q PROPERTIES 2 a b PENDING 127.0.0.1:6399> GRAPH.QUERY cu "CALL db.constraints()" type    label  properties  entitytype  status UNIQUE  Q      [a, b]      NODE        OPERATIONAL  127.0.0.1:6399> GRAPH.QUERY cu "CREATE (:Q {a:1})" unique constraint violation on node of type Q ```  Neither node has a `b` property, so neither is subject to the composite constraint, and both `CREATE`s should succeed. Instead the second is rejected, because both entities encode `b` as the same `\0` NULL marker and therefore collide on the composite key.  This is a false rejection of a legitimate write, and it diverges from the C engine, which bails out on the first missing attribute (`src/constraint/unique_constraint.c`: *"entity satisfies constraint in a vacuous truth manner"*), and fro

- **Issue #2777** (2026-09-14): **[Rust] REMOVE n:L followed by SET n:L in the same query drops the label (staged removal always wins)**
  *Symptoms*: ## Summary  `Pending`'s label bookkeeping is asymmetric. `remove_node_labels` removes the label from the staged *adds* before recording a removal, but `set_node_labels` / `set_nodes_labels` do **not** remove it from the staged *removes*. Both the read path (`update_node_labels`) and `commit` apply adds first and removals second, so the removal wins. Re-adding a label that was removed earlier in the same query is silently a no-op, and the label is dropped from the graph.  ## Affected code  `graph/src/runtime/pending.rs`  ```rust // :436-451  — removal cancels a staged add (correct) pub fn remove_node_labels(&mut self, id: NodeId, labels: &[LabelId]) {     for label in labels {         if let Some(set) = self.set_labels.get_mut(&raw_id) {             set.retain(|&l| l != label_id);      // cancels the add         }         self.remove_labels.entry(raw_id).or_default().push(label_id);     } }  // :414-424 — add does NOT cancel a staged removal (the bug) pub fn set_node_labels(&mut self, id: NodeId, labels: &OrderSet<LabelId>) {     let entry = self.set_labels.entry(id.into()).or_default();     for label in labels.iter() { entry.push(usize::from(*label) as u64); } } ```  Removal-wins is then baked into both consumers:  - `:484-500` `update_node_labels` — inserts adds, then removes removals. - `:936-947` `commit` — `set_nodes_labels_bulk(...)` then `remove_nodes_labels(...)`. - `:461-481` `node_has_label` documents the precedence explicitly (*"a removal wins"*), and `:1137-1150` `
  **Post-Mortem & Fix Analysis**:
  > **Verified by execution** on `393302586`:  ``` 127.0.0.1:6399> GRAPH.QUERY g2 "CREATE (:L {v:1})" Labels added: 1 Nodes created: 1  127.0.0.1:6399> GRAPH.QUERY g2 "MATCH (n:L) REMOVE n:L SET n:L RETURN labels(n)" labels(n) []                       <-- expected ["L"] Labels removed: 1        <-- and no "Labels added" reported  127.0.0.1:6399> GRAPH.QUERY g2 "MATCH (n:L) RETURN count(n)" 0                        <-- label permanently gone ```  The label is not merely absent from the returned row — it is removed from the graph, so the node is no longer reachable by `:L` in any later query.  This confirms the asymmetry: `remove_node_labels` (`pending.rs:436-451`) cancels a staged add, but `set_node_labels` (`pending.rs:414-424`) does not cancel a staged removal, and both `update_node_labels` (`:484-500`) and `commit` (`:936-947`) apply adds before removals. 
  > Severity update while preparing the fix (#2788): this is not only label loss, it is also a **unique-constraint bypass**.  `constraint_node_has_label` consulted both the add and remove sets and relied on their overlap. A node under a unique constraint that ran `REMOVE n:P SET n:P` was therefore treated as no longer carrying `:P`, so a duplicate create in the same query was **accepted**. Verified live against a running server; the fix rejects it correctly.  Also worth recording why existing coverage missed the original bug: `remove.rs` filters staged removals down to labels the node actually has, and the existing `test_30_mix_add_and_remove_same_labels` runs `REMOVE n:L SET n:L` against an **unlabelled** node. Nothing ever reaches `remove_labels`, so the test passes without exercising the conflict. The regression test added in #2788 uses a node that genuinely carries the label.

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

### Incident Patch 1: `55204c94` (2026-09-24)
**Commit Message**: fix(info): stop INFO reporting RediSearch's version as graph_version; Redis 8.10.2 (#2921)

RediSearch_Init registers RediSearch's INFO callback on the graph module,
and Redis keeps one callback per module. redis-module's macro registers
ours before init runs, so RediSearch's won and `INFO modules` showed
`graph_version:8.6.1` plus RediSearch's settings under the graph_ prefix.
Register ours again after RediSearch_Init, the order C uses. It adds
nothing to a normal INFO; a crash report keeps the default trace info and
lists the executing queries, as C's InfoFunc does. The registry is read
with try_lock so a crash inside a thread holding a shard lock cannot hang
the report.

Also bump Redis from 8.10.1 to 8.10.2 in the toolchain and runtime images.

Closes #2915

**File**: `build/Dockerfile` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
 #
 # Keep REDIS_VERSION in sync with build/runtime/Dockerfile so all images
 # carry the same redis revision.
-ARG REDIS_VERSION=8.10.1
+ARG REDIS_VERSION=8.10.2
 
 FROM debian:trixie-slim AS redis-builder
 ARG REDIS_VERSION
```

**File**: `build/runtime/Dockerfile` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ ARG BROWSER_TAG=latest
 ARG TARGETPLATFORM=linux/amd64
 # Redis base image version. Override via `--build-arg REDIS_VERSION=X.Y.Z`
 # to ship against a different redis release without editing the Dockerfile.
-ARG REDIS_VERSION=8.10.1
+ARG REDIS_VERSION=8.10.2
 
 FROM $BUILD_IMAGE AS chef
 RUN cargo install cargo-chef --locked
```

**File**: `build/runtime/Dockerfile.asan` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ ARG BUILD_IMAGE=ghcr.io/falkordb/falkordb-build:latest
 # Keep in sync with REDIS_VERSION in build/Dockerfile and build/runtime/Dockerfile
 # so all four images (toolchain, release, coverage, asan) build from the same
 # upstream redis tag.
-ARG REDIS_ASAN_VER=8.10.1
+ARG REDIS_ASAN_VER=8.10.2
 
 # Stage 1: ASAN-instrumented redis-server built from source.
 # Redis's Makefile honors SANITIZER=address (sets MALLOC=libc, adds
```

**File**: `build/runtime/Dockerfile.coverage` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ARG BUILD_IMAGE=ghcr.io/falkordb/falkordb-build:latest
 ARG TARGETPLATFORM=linux/amd64
-ARG REDIS_VERSION=8.10.1
+ARG REDIS_VERSION=8.10.2
 
 # Stage 1: chef/planner — same cache split as the regular Dockerfile so a
 # source-only change skips the dep cook.
```

**File**: `src/module_init.rs` (modified, +28/-3)
```diff
@@ -45,9 +45,9 @@ use graph::{
     udf,
 };
 use redis_module::{
-    Context, ContextFlags, REDISMODULE_OK, RedisModule_Alloc, RedisModule_Calloc, RedisModule_Free,
-    RedisModule_Realloc, RedisModule_SubscribeToServerEvent, RedisModuleCtx, RedisModuleEvent,
-    Status, logging::log_warning,
+    Context, ContextFlags, InfoContext, REDISMODULE_OK, RedisModule_Alloc, RedisModule_Calloc,
+    RedisModule_Free, RedisModule_Realloc, RedisModule_SubscribeToServerEvent, RedisModuleCtx,
+    RedisModuleEvent, Status, basic_info_command_handler, logging::log_warning, raw,
 };
 use std::{os::raw::c_int, os::raw::c_void, panic, sync::Arc, sync::atomic::AtomicI64};
 
@@ -247,6 +247,13 @@ pub fn graph_init(
             return Status::Err;
         }
 
+        // RediSearch_Init registers its own INFO callback on our module, and
+        // Redis keeps one per module, so without this `INFO modules` reports
+        // RediSearch's version and settings as `graph_version` etc. Register
+        // ours after it, the same order C uses (module.c: RediSearch_Init, then
+        // setupCrashHandlers).
+        raw::register_info_function(ctx.ctx, Some(info_func));
+
         // RediSearch 8.6 changed the default scorer from TFIDF to BM25STD.
         // FalkorDB compares absolute fulltext scores against the legacy TFIDF
         // magnitudes, so opt back in (non-fatal). Mirrors FalkorDB/FalkorDB#2021.
@@ -483,6 +490,24 @@ pub fn graph_init(
     Status::Ok
 }
 
+/// The module's INFO callback. Adds nothing to a normal `INFO`, matching C's
+/// `InfoFunc` (debug.c). For a crash report it keeps redis-module's default
+/// trace info and, like C, lists every query that was executing.
+extern "C" fn info_func(
+    ctx: *mut raw::RedisModuleInfoCtx,
+    for_crash_report: c_int,
+) {
+    if for_crash_report == 0 {
+        return;
+    }
+    basic_info_command_handler(&InfoContext::new(ctx), true);
+
+    raw::add_info_section(ctx, Some("executing commands"));
+    for q in telemetry::try_snapshot_running() {
+        raw::add_info_field_str(ctx, "command", &format!("{} {}", q.graph_name, q.query));
+    }
+}
+
 const unsafe extern "C" fn on_flush(
     _ctx: *mut RedisModuleCtx,
     _eid: RedisModuleEvent,
```

---

### Incident Patch 2: `e7daadac` (2026-09-24)
**Commit Message**: Bound expression tree height in the parser so deep nesting is rejected instead of crashing the server (#2533)

* Initial plan

* Bound expression tree height in the parser so deep nesting cannot overflow the stack

Co-authored-by: gkorland <753206+gkorland@users.noreply.github.com>

* Add e2e regression test for deep expression nesting

Co-authored-by: gkorland <753206+gkorland@users.noreply.github.com>

* refactor(parser): bound expression depth by tree height alone

Drop the descent-time `open` stack and the postfix `steps` counter. The
per-frame height tracked by `check_depth` already rejects every shape they
covered (`[[..]]`, `-(-(..))`, `x[0][0]..`) as the tree grows, so the
parser now has one rule for expression depth instead of two overlapping
ones. `MAX_NESTING` still bounds real call recursion.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

---------

Co-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>
Co-authored-by: gkorland <753206+gkorland@users.noreply.github.com>
Co-authored-by: Avi Avni <avi.avni@gmail.com>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `graph/src/parser/cypher.rs` (modified, +216/-92)
```diff
@@ -206,6 +206,13 @@ pub struct Parser<'a> {
     anon_counter: u32,
     /// Nesting level of the two recursive descents, see [`Parser::MAX_NESTING`].
     depth: u32,
+    /// Height of the tree the last [`Parser::parse_expr_inner`] returned, see
+    /// [`Parser::MAX_TREE_DEPTH`].
+    expr_height: usize,
+    /// Tallest expression [`Parser::parse_expr`] has returned since
+    /// [`Parser::with_child_height`] last cleared it, so a helper that embeds
+    /// those expressions in a tree of its own can account for their height.
+    max_child_height: usize,
     /// Set while parsing where a pattern comprehension cannot be planned as
     /// a sub-plan, to the rejection to raise if one is found there.
     forbidden_pattern_comprehension: Option<ForbiddenPatternComprehension>,
@@ -228,10 +235,10 @@ impl<'a> Parser<'a> {
     /// How deep an expression tree may get.
     ///
     /// Constructs that build on [`Parser::parse_expr_inner`]'s own stack
-    /// (`[[..]]`, `-(-(..))`, `x[0][0]`) cost no call frames here, but the
-    /// binder, planner and evaluator all walk the result recursively, so the
-    /// tree still has to be bounded - just by what those stages can walk
-    /// rather than by what this one can.
+    /// (`[[..]]`, `-(-(..))`, `x[0][0]`, `(1+(1+(1+..)))`) cost no call frames
+    /// here, but the binder, planner and evaluator all walk the result
+    /// recursively, so the tree still has to be bounded - just by what those
+    /// stages can walk rather than by what this one can.
     ///
     /// Looser than [`Self::MAX_NESTING`] for that reason, and deliberately so:
     /// `(((1)))` collapses to `1` and test_parentheses pins 10000 of them,
@@ -242,13 +249,23 @@ impl<'a> Parser<'a> {
     /// for `-(-(..))`), leaving room for builds with fatter frames.
     const MAX_TREE_DEPTH: usize = 256;
 
+    /// Levels [`Parser::parse_primary_expr`] may add above the expressions it
+    /// parses, e.g. the `FuncInvocation` and `Distinct` of `count(DISTINCT x)`.
+    ///
+    /// Heights are tracked to keep a tree from outgrowing what later stages can
+    /// walk, so an estimate a level or two out either way is harmless - what
+    /// matters is that each nesting level is charged for.
+    const PRIMARY_LEVELS: usize = 2;
+
     /// Creates a new parser for the given query string.
     #[must_use]
     pub fn new(str: &'a str) -> Self {
         Self {
             lexer: Lexer::new(str),
             anon_counter: 0,
             depth: 0,
+            expr_height: 0,
+            max_child_height: 0,
             forbidden_pattern_comprehension: None,
         }
     }
@@ -261,6 +278,49 @@ impl<'a> Parser<'a> {
         self.lexer.format_error(&format!("{TOO_DEEP} {limit}"))
     }
 
+    /// Fails once a tree being built has passed [`Self::MAX_TREE_DEPTH`].
+    ///
+    /// Called wherever a height grows rather than on the finished tree,
+    /// because every wrap copies the tree it wraps: a query that nests a
+    /// million levels would spend that copying quadratically long before a
+    /// check on the result could reject it.
+    fn check_depth(
+        &self,
+        height: usize,
+    ) -> Result<(), String> {
+        if height > Self::MAX_TREE_DEPTH {
+            return Err(self.too_deep(Self::MAX_TREE_DEPTH));
+        }
+        Ok(())
+    }
+
+    /// Runs `parse`, reporting the tallest expression it parsed alongside its
+    /// result, so a helper's caller can charge itself for what it nested.
+    ///
+    /// The surrounding tally is restored afterwards, leaving each helper
+    /// measuring only its own expressions.
+    fn with_child_height<T>(
+        &mut self,
+        parse: impl FnOnce(&mut Self) -> Result<T, String>,
+    ) -> Result<(T, usize), String> {
+        let outer = std::mem::take(&mut self.max_child_height);
+        let res = parse(self);
+        let height = std::mem::replace(&mut self.max_child_height, outer);
+        res.map(|res| (res, height))
+  
```

**File**: `graph/src/parser/macro.rs` (modified, +36/-34)
```diff
@@ -39,6 +39,15 @@
 //!
 //! This stack-based approach avoids deep call-stack recursion for
 //! heavily nested or chained binary expressions (e.g., `a+b+c+...`).
+//!
+//! ## Tree height
+//!
+//! Every stack frame carries the height of the tree it has built so far, and
+//! both macros keep it up to date: wrapping an operand adds a level, folding
+//! a sub-expression into its parent lifts the parent to at least one above
+//! it. `Parser::check_depth` then rejects a tree that outgrows
+//! `Parser::MAX_TREE_DEPTH` at the moment it does, rather than after the
+//! whole (unboundedly deep) tree has been built.
 
 macro_rules! match_token {
     ($lexer:expr, $token:ident) => {
@@ -103,64 +112,57 @@ macro_rules! optional_match_token {
 
 #[macro_export]
 macro_rules! parse_expr_return {
-    ($stack:ident, $res:ident) => {
+    ($self:ident, $stack:ident, $res:ident, $height:expr) => {
         match &mut $stack.last_mut() {
-            Some((_, Some(expr))) => {
+            Some((_, Some(expr), h)) => {
                 expr.root_mut().push_child_tree($res);
+                *h = (*h).max($height + 1);
+                $self.check_depth(*h)?;
             }
-            Some((_, expr)) => {
+            Some((_, expr, h)) => {
                 *expr = Some($res);
+                *h = $height;
+            }
+            _ => {
+                $self.expr_height = $height;
+                return Ok($res);
             }
-            _ => return Ok($res),
         }
     };
 }
 
 #[macro_export]
 macro_rules! parse_operators {
-    ($self:ident, $stack:ident, $res:ident, $current:ident, $token:pat => $expr:ident) => {
+    ($self:ident, $stack:ident, $res:ident, $height:expr, $current:ident, $token:pat => $expr:ident) => {
         if let $token = $self.lexer.current()? {
             $self.lexer.next();
-            let res = if matches!($res.root().data(), ExprIR::$expr) {
-                $res
+            let (res, height) = if matches!($res.root().data(), ExprIR::$expr) {
+                ($res, $height)
             } else {
-                tree!(ExprIR::$expr, $res)
+                (tree!(ExprIR::$expr, $res), $height + 1)
             };
-            $stack.push(($current, Some(res)));
-            $stack.push(($current + 1, None));
+            $self.check_depth(height)?;
+            $stack.push(($current, Some(res), height));
+            $stack.push(($current + 1, None, 0));
         } else {
-            match &mut $stack.last_mut() {
-                Some((_, Some(expr))) => {
-                    expr.root_mut().push_child_tree($res);
-                }
-                Some((_, expr)) => {
-                    *expr = Some($res);
-                }
-                _ => return Ok($res),
-            }
+            parse_expr_return!($self, $stack, $res, $height);
         }
     };
-    ($self:ident, $stack:ident, $res:ident, $current:ident, $($token:pat => $expr:ident),*) => {
+    ($self:ident, $stack:ident, $res:ident, $height:expr, $current:ident, $($token:pat => $expr:ident),*) => {
         let mut res = $res;
+        let mut height = $height;
         $(if let $token = $self.lexer.current()? {
             $self.lexer.next();
-            if matches!(res.root().data(), ExprIR::$expr) {
-            } else {
+            if !matches!(res.root().data(), ExprIR::$expr) {
                 res = tree!(ExprIR::$expr, res);
-            };
-            $stack.push(($current, Some(res)));
-            $stack.push(($current + 1, None));
+                height += 1;
+                $self.check_depth(height)?;
+            }
+            $stack.push(($current, Some(res), height));
+            $stack.push(($current + 1, None, 0));
             continue;
         })*
 
-        match &mut $stack.last_mut() {
-            Some((_, Some(expr))) => {
-                expr.root_mut().push_child_tree(res);
-            }
-            Some((_, expr)) => {
-                *expr = Some(res);
-            }
-       
```

**File**: `tests/test_e2e.py` (modified, +11/-0)
```diff
@@ -1711,6 +1711,17 @@ def test_nested_list():
     assert res.result_set == [expected]
 
 
+def test_deep_expression_nesting_is_rejected():
+    # Parentheses that cannot collapse - each one wraps an operator - used to
+    # build a tree deep enough to overflow the stack of the stages that walk
+    # it, taking the server down for every connected client with a raw SIGSEGV
+    # no panic handler could report. It has to come back as an error instead,
+    # and the server has to survive it.
+    n = 1000
+    query_exception(f"RETURN {'(' * n}1{'+1)' * n}", "Query nesting exceeds")
+    assert query("RETURN 1").result_set == [[1]]
+
+
 def test_index():
     res = query(
         "UNWIND range(1, 100000) AS x CREATE (n:Node {vi: x, vs: tostring(x)})",
```

---

### Incident Patch 3: `5e4bfdcd` (2026-09-24)
**Commit Message**: fix: pattern comprehensions everywhere — no crashes, nested plans for loop variables (#2308) (#2874)

* fix(parser): reject pattern expressions in inlined properties (#2308)

A pattern comprehension or pattern predicate inside a pattern's inline
property map is never lowered by the planner, so it reached the
evaluator's unreachable!() arm and panicked the module as soon as the
outer pattern had a candidate row:

  CREATE (a {k:1})-[:R {k:1}]->(b {k:1})
  MATCH ()-[{k:size([(a)-[{k:1}]-()|a.k])}]-() RETURN 1
    -> Server closed the connection

The same held for node properties, variable-length relationships, a
pattern predicate's properties, and CREATE / MERGE, which crashed even
on an empty graph.

Reject such maps in parse_inline_properties, the one place node and
relationship property maps are parsed, with the error FalkorDB C
already returns: "Encountered unhandled type in inlined properties."

Closes #2308

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(planner): lower pattern comprehensions in every clause expression (#2308)

Pattern comprehensions were planned as sub-plans only in WHERE,
projections, UNWIND and FOREACH. Anywhere else they reached

**File**: `graph/src/graph/graph.rs` (modified, +1/-0)
```diff
@@ -1231,6 +1231,7 @@ impl Graph {
         let mut planner = Planner::new(scope_vars);
         let start = Instant::now();
         let plan = planner.plan(ir);
+        let plan = planner.finish(plan);
         let optimize_plan = optimize(&plan, self, &param_values);
         plan_duration = start.elapsed();
 
```

**File**: `graph/src/parser/ast.rs` (modified, +33/-0)
```diff
@@ -264,6 +264,17 @@ pub enum ExprIR<TVar> {
     /// Pattern predicate should be rewritten in planner (boxed; see
     /// `PatternComprehension`).
     Pattern(Box<QueryGraph<Arc<String>, Arc<String>, TVar>>),
+    /// A pattern comprehension that reads a variable bound inside the
+    /// enclosing expression (a list comprehension, quantifier or `reduce`
+    /// variable), so it cannot be hoisted into an Apply below the operator.
+    /// The planner turns it into a nested plan that the evaluator runs each
+    /// time the expression is evaluated, with the current row (loop bindings
+    /// included) as the plan's argument row.
+    /// Children: the variables it reads, so passes that ask which variables
+    /// an expression uses still see them.
+    ///
+    /// Boxed: rare, and an inline `TVar` would widen the enum.
+    NestedPlan(Box<NestedPlanRef<TVar>>),
     /// shortestPath((a)-[*]->(b))
     /// Children: [source_var_expr, dest_var_expr]
     ///
@@ -377,6 +388,7 @@ impl<TVar: Display + std::fmt::Debug> Display for ExprIR<TVar> {
             }
             Self::Paren => write!(f, "()"),
             Self::Pattern(_) => write!(f, "<pattern>"),
+            Self::NestedPlan(nested) => write!(f, "nested plan #{}", nested.id),
             Self::ShortestPath(_) => write!(f, "shortestPath()"),
             Self::MapProjection => write!(f, "map_projection"),
             Self::CompiledRegex(rf) => match rf.kind {
@@ -389,6 +401,16 @@ impl<TVar: Display + std::fmt::Debug> Display for ExprIR<TVar> {
     }
 }
 
+/// Where a [`ExprIR::NestedPlan`] finds its plan and its result.
+#[derive(Clone, Debug)]
+pub struct NestedPlanRef<TVar> {
+    /// Index of the plan among the query's nested plans (the children after
+    /// the first of the plan's `NestedPlans` root).
+    pub id: u32,
+    /// The variable the plan collects the comprehension's list into.
+    pub result: TVar,
+}
+
 /// Quantifier types for list predicates (all, any, none, single).
 #[derive(Clone, Debug)]
 pub enum QuantifierType {
@@ -1170,6 +1192,17 @@ impl<TVar: Eq + Hash + Display> QueryIR<TVar> {
                         }
                     }
                 }
+                // The planner turns this call into a DropIndex on a label
+                // known at plan time, so it has to be a string literal.
+                if proc.name == "db.idx.fulltext.drop"
+                    && !args.first().is_some_and(|label| {
+                        matches!(label.root().data(), ExprIR::Constant(Value::String(_)))
+                    })
+                {
+                    return Err(String::from(
+                        "The first argument of db.idx.fulltext.drop must be a string literal",
+                    ));
+                }
                 Ok(())
             }
             Self::Match { pattern, .. } => {
```

**File**: `graph/src/parser/cypher.rs` (modified, +64/-9)
```diff
@@ -120,10 +120,27 @@ use orx_tree::{DynTree, NodeRef};
 use std::collections::{HashMap, HashSet};
 use std::sync::Arc;
 use thin_vec::ThinVec;
+use thiserror::Error;
 /// Opening of every rejection [`Parser::too_deep`] produces, and what
 /// [`is_too_deep`] recognises.
 const TOO_DEEP: &str = "Query nesting exceeds the maximum depth of";
 
+/// A place where a pattern comprehension cannot be planned as a sub-plan, so
+/// the parser rejects one found there (#2308).
+#[derive(Debug, Clone, Copy, Error)]
+enum ForbiddenPatternComprehension {
+    /// A pattern's inline property map; worded as FalkorDB C words it, and
+    /// also the rejection for any other map the parser cannot accept there.
+    #[error("Encountered unhandled type in inlined properties.")]
+    InlineProperties,
+    /// MERGE's ON CREATE / ON MATCH SET, which MERGE applies itself.
+    #[error("Pattern comprehensions are not supported in MERGE ON CREATE / ON MATCH SET.")]
+    MergeSet,
+    /// Index OPTIONS, evaluated once with no input row.
+    #[error("Pattern comprehensions are not supported in index OPTIONS.")]
+    IndexOptions,
+}
+
 /// Rejections [`evaluate_param`] produces for a value that is not a literal.
 ///
 /// Each already names the parameter problem exactly, so like
@@ -189,6 +206,9 @@ pub struct Parser<'a> {
     anon_counter: u32,
     /// Nesting level of the two recursive descents, see [`Parser::MAX_NESTING`].
     depth: u32,
+    /// Set while parsing where a pattern comprehension cannot be planned as
+    /// a sub-plan, to the rejection to raise if one is found there.
+    forbidden_pattern_comprehension: Option<ForbiddenPatternComprehension>,
 }
 
 impl<'a> Parser<'a> {
@@ -229,6 +249,7 @@ impl<'a> Parser<'a> {
             lexer: Lexer::new(str),
             anon_counter: 0,
             depth: 0,
+            forbidden_pattern_comprehension: None,
         }
     }
 
@@ -551,7 +572,11 @@ impl<'a> Parser<'a> {
                 IndexType::Range
             };
             let options = if (vector || fulltext) && optional_match_token!(self.lexer => Options) {
-                Some(Arc::new(self.parse_map()?))
+                // Evaluated once, with no input row for a sub-plan to run on.
+                Some(Arc::new(self.without_pattern_comprehensions(
+                    ForbiddenPatternComprehension::IndexOptions,
+                    Self::parse_map,
+                )?))
             } else {
                 None
             };
@@ -1051,15 +1076,20 @@ impl<'a> Parser<'a> {
         let mut on_match_set_items = vec![];
         let mut on_create_set_items = vec![];
         while optional_match_token!(self.lexer => On) {
-            if optional_match_token!(self.lexer => Match) {
-                match_token!(self.lexer => Set);
-                self.parse_set_items(&mut on_match_set_items)?;
+            // MERGE applies these items itself, once it has matched or
+            // created the pattern, so no sub-plan can run in between to
+            // bind a pattern comprehension; rejected as in FalkorDB C.
+            let items = if optional_match_token!(self.lexer => Match) {
+                &mut on_match_set_items
             } else if optional_match_token!(self.lexer => Create) {
-                match_token!(self.lexer => Set);
-                self.parse_set_items(&mut on_create_set_items)?;
+                &mut on_create_set_items
             } else {
                 return Err(self.lexer.format_error("Expected MATCH or CREATE after ON"));
-            }
+            };
+            match_token!(self.lexer => Set);
+            self.without_pattern_comprehensions(ForbiddenPatternComprehension::MergeSet, |s| {
+                s.parse_set_items(items)
+            })?;
         }
         Ok(QueryIR::Merge {
             pattern,
@@ -2636,6 +2666,23 @@ impl<'a> Parser<'a> {
         Ok(exprs)
     }
 
+    /// Run `parse` with pattern comprehensions rejected as `place`.
+    fn without_pattern_comprehensi
```

**File**: `graph/src/planner/binder.rs` (modified, +79/-14)
```diff
@@ -61,6 +61,13 @@ pub struct Binder {
     /// property access like `r.prop` is allowed (per-edge predicate)
     /// whereas it is rejected on named-path Path variables.
     varlen_rel_var_ids: std::collections::HashSet<(u32, u32)>,
+    /// Scope tables no longer on `env_stack`: the scopes of a CALL body,
+    /// popped when the body closes, and those of UNION branches, each bound
+    /// by its own binder. The planner mints fresh variables at
+    /// `scope_vars[scope].len()`, so `bind` must report, for every scope, the
+    /// largest table any of them used, or those ids collide with real
+    /// variables (or index past the table).
+    retired_scope_vars: Vec<Vec<Variable>>,
 }
 
 impl Default for Binder {
@@ -72,6 +79,7 @@ impl Default for Binder {
             copy_from_parent: HashMap::new(),
             node_labels: HashMap::new(),
             varlen_rel_var_ids: std::collections::HashSet::new(),
+            retired_scope_vars: vec![],
         }
     }
 }
@@ -94,18 +102,19 @@ impl Binder {
     ) -> Result<(BoundQueryIR, Vec<Vec<Variable>>), String> {
         let mut bound = self.bind_ir(ir)?;
         self.update_all_node_labels(&mut bound);
-        let scope_vars = self
-            .env_stack
-            .iter()
-            .map(|env| {
-                let mut vars = env.values().cloned().collect::<Vec<_>>();
-                vars.sort_by_key(|v| v.id);
-                vars
-            })
-            .collect();
+        let mut scope_vars = self.scope_vars();
+        merge_scope_vars(
+            &mut scope_vars,
+            std::mem::take(&mut self.retired_scope_vars),
+        );
         Ok((bound, scope_vars))
     }
 
+    /// The live scopes' variables, indexed by scope id.
+    fn scope_vars(&self) -> Vec<Vec<Variable>> {
+        self.env_stack.iter().map(sorted_scope_vars).collect()
+    }
+
     /// Post-process the bound IR: update every QueryNode's labels to the
     /// full accumulated set from `self.node_labels`.  This ensures that
     /// the first MATCH occurrence of a node has labels from all later
@@ -262,7 +271,8 @@ impl Binder {
                 let mut first_columns: Option<Vec<String>> = None;
                 for branch in branches {
                     let binder = Self::default();
-                    let (bound, _) = binder.bind(branch)?;
+                    let (bound, branch_scope_vars) = binder.bind(branch)?;
+                    merge_scope_vars(&mut self.retired_scope_vars, branch_scope_vars);
                     let columns = bound.return_column_names();
                     if let Some(ref expected) = first_columns {
                         if columns != *expected {
@@ -730,9 +740,13 @@ impl Binder {
 
         // 3. Capture subquery output, restore outer scope
         let subquery_env = self.current_env().clone();
-        while self.env_stack.len() > saved_env_stack_len {
-            self.env_stack.pop();
-        }
+        let mut inner_scopes = vec![vec![]; saved_env_stack_len];
+        inner_scopes.extend(
+            self.env_stack
+                .drain(saved_env_stack_len..)
+                .map(|env| sorted_scope_vars(&env)),
+        );
+        merge_scope_vars(&mut self.retired_scope_vars, inner_scopes);
         *self.current_env_mut() = saved_env;
 
         // 4. If returning, check for variable shadowing, allocate outer IDs,
@@ -858,6 +872,7 @@ impl Binder {
                         copy_from_parent: HashMap::new(),
                         node_labels: HashMap::new(),
                         varlen_rel_var_ids: std::collections::HashSet::new(),
+                        retired_scope_vars: vec![],
                     };
 
                     // Build bound clauses: explicit import WITH + remaining
@@ -903,6 +918,9 @@ impl Binder {
                     } else {
                         first_columns = Some(columns);
                     }
+                    let mut branch_scope_vars = binder.scope_vars();
+                    
```

**File**: `graph/src/planner/mod.rs` (modified, +462/-196)
```diff
@@ -50,8 +50,8 @@ use crate::{
     entity_type::EntityType,
     index::indexer::{IndexQuery, IndexType},
     parser::ast::{
-        AllShortestPaths, BoundQueryIR, ExprIR, QueryExpr, QueryGraph, QueryIR, QueryNode,
-        QueryPath, QueryRelationship, SetItem, SupportAggregation, Variable,
+        AllShortestPaths, BoundQueryIR, ExprIR, NestedPlanRef, QueryExpr, QueryGraph, QueryIR,
+        QueryNode, QueryPath, QueryRelationship, SetItem, SupportAggregation, Variable,
     },
     runtime::functions::GraphFn,
     runtime::orderset::OrderSet,
@@ -294,6 +294,11 @@ pub enum IR {
     },
     /// Remove duplicate rows
     Distinct,
+    /// Root of a plan whose expressions hold nested plans
+    /// (`ExprIR::NestedPlan`). Child 0 is the query's plan and runs as if it
+    /// were the root; child `1 + id` is nested plan `id`, which the evaluator
+    /// runs on demand.
+    NestedPlans,
     /// UNION of multiple sub-query branches.
     /// Each child is a fully-planned branch.
     Union,
@@ -519,6 +524,7 @@ impl Display for IR {
             Self::Commit => write!(f, "Commit"),
             Self::ForEach { var, .. } => write!(f, "ForEach | {var}"),
             Self::Union => write!(f, "Union"),
+            Self::NestedPlans => write!(f, "Nested Plans"),
             Self::Distinct => write!(f, "Distinct"),
             Self::CreateIndex { label, attrs, .. } => {
                 write!(f, "Create Index | :{label}({attrs:?})")
@@ -603,6 +609,18 @@ pub struct Planner {
     /// clause-local labels from an OPTIONAL MATCH on a bound alias) must be
     /// re-verified with a hasLabels filter.
     verified_labels: HashMap<(u32, u32), OrderSet<Arc<String>>>,
+    /// Plans for the `ExprIR::NestedPlan`s minted so far, by id; `finish`
+    /// hangs them under the plan's root.
+    nested_plans: Vec<DynTree<IR>>,
+    /// Variables bound by the list comprehensions, quantifiers and `reduce`s
+    /// enclosing the expression `extract_pattern_comprehensions` is visiting,
+    /// innermost last. A pattern comprehension reading one of them cannot be
+    /// hoisted out of the loop and becomes a nested plan instead.
+    loop_vars: Vec<Variable>,
+    /// Pattern variables of the pattern comprehensions enclosing that
+    /// expression. A nested plan inside one runs on the enclosing
+    /// comprehension's rows, where they are bound.
+    pattern_vars: Vec<Variable>,
 }
 
 /// A pattern comprehension (or inline pattern) hoisted out of a projection
@@ -676,9 +694,29 @@ impl Planner {
             visited: HashSet::new(),
             scope_vars,
             verified_labels: HashMap::new(),
+            nested_plans: vec![],
+            loop_vars: vec![],
+            pattern_vars: vec![],
         }
     }
 
+    /// Complete a plan built by `plan`: when its expressions hold nested
+    /// plans, root it at `IR::NestedPlans` with the query's plan first and
+    /// each nested plan after it, in id order.
+    pub fn finish(
+        &mut self,
+        plan: DynTree<IR>,
+    ) -> DynTree<IR> {
+        if self.nested_plans.is_empty() {
+            return plan;
+        }
+        let mut root = tree!(IR::NestedPlans, plan);
+        for nested in std::mem::take(&mut self.nested_plans) {
+            root.root_mut().push_child_tree(nested);
+        }
+        root
+    }
+
     /// Mint a fresh variable with an ID unique within the given scope.
     fn fresh_var(
         &mut self,
@@ -802,20 +840,47 @@ impl Planner {
         matches!(tree.node(idx).data(), IR::Apply) && tree.node(idx).num_children() > 1
     }
 
-    /// Walk past the Apply chain a `ForEach` or `Unwind` carries for pattern
-    /// comprehensions in its list expression, so the preceding clause is
-    /// stitched below the sub-plans rather than as an extra child.
+    /// Walk past the Apply chain a clause operator (`ForEach`, `Unwind`,
+    /// `Set`, `Remove`, `Delete`, `LoadCsv`, a procedure call or index query) carries
+    /// for pattern co
```

---

### Incident Patch 4: `fdcb1984` (2026-09-23)
**Commit Message**: fix: element-wise Vectorf32 equality in compare_value (#2606)

* fix: element-wise Vectorf32 equality in compare_value

compare_value had no (VecF32, VecF32) arm, so vector comparisons fell
through to the disjoint-type branch, which compares only the type
order: '=' and '<>' both evaluated to false for any two vectors —
including a vector compared with itself — and MERGE on a vector
property created a duplicate node on every execution (#2604).

Compare vectors element-wise (NaN components equal only to another
NaN, order below everything else), with dimension decided first, and
report DisjointOrNull::None so the pair is a comparable, not disjoint,
combination.

Fixes #2604

* test: assert both ordering directions for vecf32 comparisons

Per review: assert Ordering::Less and Ordering::Greater for ordinary,
dimension-mismatched and NaN-containing vectors, not just inequality.

---------

Co-authored-by: Avi Avni <avi.avni@gmail.com>
Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `graph/src/runtime/value.rs` (modified, +188/-22)
```diff
@@ -1234,6 +1234,12 @@ impl CompareValue for Value {
                 Self::compare_list(a, b)
             }
             (Self::Map(a), Self::Map(b)) => Self::compare_map(a, b),
+            // Vector equality is element-wise: vecf32([1.0,2.0]) equals
+            // vecf32([1.0,2.0]). Without this arm the fallthrough compared
+            // only the type order, so `=` and `<>` were both always false
+            // for vectors and MERGE on a vector property duplicated on
+            // every execution (#2604).
+            (Self::VecF32(a), Self::VecF32(b)) => (compare_vecf32(a, b), DisjointOrNull::None),
             (Self::Node(a), Self::Node(b)) => (a.cmp(b), DisjointOrNull::None),
             (Self::Relationship(rel_a), Self::Relationship(rel_b)) => {
                 (rel_a.cmp(rel_b), DisjointOrNull::None)
@@ -1448,9 +1454,9 @@ impl Value {
         // a member compared inconclusively and no other member decided the
         // order, so the list comparison is inconclusive too. Reachable only
         // when a member pair shares a variant that `compare_value` has no arm
-        // for — `VecF32` today — since every other inconclusive comparison
-        // reports an ordering. Lists of unequal length keep their old answer:
-        // length alone still decides them.
+        // for — none today, but a guard for any future variant — since every
+        // other inconclusive comparison reports an ordering. Lists of unequal
+        // length keep their old answer: length alone still decides them.
         if inconclusive_counter > 0 && first_not_equal == Ordering::Equal && len_a == len_b {
             return (Ordering::Equal, DisjointOrNull::Disjoint);
         }
@@ -1557,13 +1563,15 @@ impl Value {
             | Self::Date(_)
             | Self::Time(_)
             | Self::Duration(_) => false,
-            // NaN never compares equal, not even to itself.
+            // NaN never compares equal, not even to itself -- also as a
+            // vector element (`compare_vecf32`).
             Self::Float(f) => f.is_nan(),
+            Self::VecF32(v) => v.iter().any(|f| f.is_nan()),
             // A container is unmatchable exactly when one of its members is.
             Self::List(items) | Self::Path(items) => items.iter().any(Self::may_fail_self_match),
             Self::Map(entries) => entries.values().any(Self::may_fail_self_match),
-            // Null (`ComparedNull`), Point (NaN coordinates), VecF32 (no typed
-            // arm in `compare_value`, so `Disjoint`) -- and any future variant.
+            // Null (`ComparedNull`), Point (NaN coordinates) -- and any future
+            // variant.
             _ => true,
         }
     }
@@ -1801,6 +1809,46 @@ fn compare_floats(
         None => (Ordering::Less, DisjointOrNull::NaN),
     }
 }
+
+/// Orders two vectors the way C's `SIVector_Compare` does: dimension first,
+/// then the first element where `x != y` decides by `x > y`. So a NaN element
+/// never compares equal (not even to NaN) and orders `Less` in both
+/// directions.
+fn compare_vecf32(
+    a: &[f32],
+    b: &[f32],
+) -> Ordering {
+    fn first_difference(
+        a: &[f32],
+        b: &[f32],
+    ) -> Ordering {
+        a.iter()
+            .zip(b)
+            .find(|(x, y)| x != y)
+            .map_or(Ordering::Equal, |(x, y)| {
+                if x > y {
+                    Ordering::Greater
+                } else {
+                    Ordering::Less
+                }
+            })
+    }
+
+    a.len().cmp(&b.len()).then_with(|| {
+        // An early-exit loop does not vectorise, so scan fixed-size blocks
+        // with a branch-free `!=` reduction (NEON / SSE / AVX) and rescan
+        // element by element only the block that holds the difference.
+        let (blocks_a, rest_a) = a.as_chunks::<16>();
+        let (blocks_b, rest_b) = b.as_chunks::<16>();
+        for (x, y) in blocks_a.iter().zip(blocks_b) {
+            if x.iter().zip(y).fold(false, |diff
```

**File**: `tests/flow/test_null_handling.py` (modified, +12/-11)
```diff
@@ -177,17 +177,18 @@ def test08_null_value_hash_join(self):
             self.env.assertContains("Value Hash Join", str(graph.explain(query)))
             self.env.assertEqual(graph.query(query).result_set, expected_result)
 
-        # A value Cypher cannot compare at all must not report equality just
-        # because it sits inside a list. Two vectors are never equal to each
-        # other, whatever their contents, and a null beside one still wins.
-        incomparable = [("vecf32([1.0,2.0]) = vecf32([1.0,2.0])", False),
-                        ("[vecf32([1.0,2.0])] = [vecf32([1.0,2.0])]", False),
-                        ("[vecf32([1.0,2.0])] = [vecf32([9.0,9.0])]", False),
-                        ("[vecf32([1.0]), null] = [vecf32([1.0]), null]", None),
-                        # length still decides lists of unequal length
-                        ("[vecf32([1.0])] = [vecf32([1.0]), 1]", False)]
-
-        for expression, expected in incomparable:
+        # Vectors compare element-wise, as in C, also inside a list; a null
+        # beside one still wins, and a NaN element is never equal.
+        vectors = [("vecf32([1.0,2.0]) = vecf32([1.0,2.0])", True),
+                   ("vecf32([1.0,2.0]) = vecf32([9.0,9.0])", False),
+                   ("[vecf32([1.0,2.0])] = [vecf32([1.0,2.0])]", True),
+                   ("[vecf32([1.0,2.0])] = [vecf32([9.0,9.0])]", False),
+                   ("[vecf32([1.0]), null] = [vecf32([1.0]), null]", None),
+                   ("vecf32([0.0/0.0]) = vecf32([0.0/0.0])", False),
+                   # length still decides lists of unequal length
+                   ("[vecf32([1.0])] = [vecf32([1.0]), 1]", False)]
+
+        for expression, expected in vectors:
             actual = graph.query(f"RETURN {expression}").result_set[0][0]
             self.env.assertEqual(actual, expected)
 
```

---

### Incident Patch 5: `6912769c` (2026-09-22)
**Commit Message**: fix(eval): stop a simple CASE matching null against null (#2396)

* fix(eval): stop a simple CASE matching null against null

`CASE null WHEN null THEN 'match' ELSE 'no match' END` answered 'match'.
The value form compared with `==`, and `PartialEq for Value` keeps only
the ordering half of `compare_value`, discarding the flag that says a null
took part. Two nulls order equal, so the arm was selected.

`=` reads that flag and answers null, so the same pair compared two
different ways depending on how it was written. Compare on the same terms
as `=` instead: a null on either side now selects nothing, in both the
scalar case and nested inside a list or map.

Two expectations in test68_Case asserted the old behaviour and now expect
the ELSE branch.

Closes #2208

* test(null): pin what `=` answers, not just whether it is true

The loop asserted the branch is taken exactly when `=` is true, which
`None` and `False` both satisfy. A regression turning `[1,null] =
[1,null]` from null into false would have passed. Assert the exact answer
per pair instead.

Caught in review on #2396.

---------

Co-authored-by: Avi Avni <avi.avni@gmail.com>
Co-authored-by: Guy Korland <gkorland@gmail.com>
C

**File**: `graph/src/runtime/eval.rs` (modified, +9/-2)
```diff
@@ -479,7 +479,9 @@ impl<'a> ExprEval<'a> {
     ///   branch unless it is `false` or `null`, so a non-boolean condition is
     ///   truthy rather than an error;
     /// - value form (`CASE subject WHEN v THEN …`): a branch is selected when
-    ///   its condition compares equal to the subject.
+    ///   its condition compares equal to the subject, on the same terms as `=`,
+    ///   so a `null` on either side selects nothing rather than matching
+    ///   another `null`.
     fn eval_case<R: RowView + ?Sized>(
         &self,
         has_subject: bool,
@@ -498,7 +500,12 @@ impl<'a> ExprEval<'a> {
         while i + 1 < num_arms {
             let when = self.eval_node(&arms.child(i), env, agg_group_key)?;
             let matched = match &subject {
-                Some(subject) => when == *subject,
+                // `PartialEq` reports two nulls as equal because it keeps only
+                // the ordering half of `compare_value`. `=` reads the other
+                // half, and the value form has to agree with it.
+                Some(subject) => {
+                    when.compare_value(subject) == (Ordering::Equal, DisjointOrNull::None)
+                }
                 None => !matches!(when, Value::Bool(false) | Value::Null),
             };
             if matched {
```

**File**: `graph/src/runtime/vector_expr.rs` (modified, +11/-7)
```diff
@@ -501,13 +501,17 @@ impl<'a> VectorEval<'a> {
             let mut still_unclaimed = Vec::with_capacity(unclaimed.len());
             for (offset, &pos) in unclaimed.iter().enumerate() {
                 let matched = match &subject {
-                    // Value form: the arm matches when it equals the subject.
-                    // `Value`'s equality, deliberately — this engine matches a
-                    // null subject against a `WHEN null` arm (pinned by
-                    // test_function_calls.py's `test68_Case`), where openCypher
-                    // would fall through to `ELSE`. The per-row `eval_case`
-                    // does the same, and the two must not diverge.
-                    Some(subject) => when.get(offset) == subject.get(pos),
+                    // Value form: the arm matches when it compares equal to the
+                    // subject on the same terms as `=`, so a `null` on either
+                    // side selects nothing rather than matching another `null`.
+                    // `PartialEq` would say those two nulls are equal, because
+                    // it keeps only the ordering half of `compare_value`. The
+                    // per-row `eval_case` reads the other half too, and the two
+                    // must not diverge.
+                    Some(subject) => {
+                        compare_values(&when.get(offset), &subject.get(pos), CmpOp::Eq)
+                            == Some(true)
+                    }
                     // Searched form: anything but `false` / `null` matches, so
                     // a non-boolean condition is truthy rather than an error.
                     None => !matches!(when.get(offset), Value::Bool(false) | Value::Null),
```

**File**: `tests/flow/test_filters.py` (modified, +6/-6)
```diff
@@ -236,10 +236,10 @@ def test08_columnar_and_or_short_circuit(self):
             self.env.assertContains("Division by zero", str(e))
 
     def test09_case_value_form_null_subject(self):
-        # `CASE x WHEN y` matching is `Value` equality, which in this engine
-        # calls two nulls equal, so a null subject selects a `WHEN null` arm
-        # rather than falling through to ELSE (openCypher would fall through;
-        # test_function_calls.py's `test68_Case` pins this engine's answer).
+        # `CASE x WHEN y` matching is `=`, and `null = null` is null, so a
+        # null subject never selects a `WHEN null` arm and falls through to
+        # ELSE (test_null_handling.py's `test09_null_simple_case` pins each
+        # arm against the answer `=` itself gives it).
         #
         # What must never differ is *which path* computed it: the columnar
         # `CASE` and the per-row one have to agree on the null subject, which
@@ -248,7 +248,7 @@ def test09_case_value_form_null_subject(self):
         g.query("UNWIND range(1, 5) AS i CREATE (:K {i: i})")
 
         for query, expected in [
-            ("RETURN CASE null WHEN null THEN 'matched' ELSE 'else' END", 'matched'),
+            ("RETURN CASE null WHEN null THEN 'matched' ELSE 'else' END", 'else'),
             ("RETURN CASE 1 WHEN null THEN 'matched' ELSE 'else' END", 'else'),
             ("RETURN CASE null WHEN 1 THEN 'matched' ELSE 'else' END", 'else'),
             ("RETURN CASE 1 WHEN 1 THEN 'matched' ELSE 'else' END", 'matched'),
@@ -261,4 +261,4 @@ def test09_case_value_form_null_subject(self):
         per_row = g.query(
             "MATCH (n:K) RETURN head([CASE n.missing WHEN null THEN 'matched' ELSE 'else' END]) AS v")
         self.env.assertEqual(columnar.result_set, per_row.result_set)
-        self.env.assertEqual(columnar.result_set, [['matched']] * 5)
+        self.env.assertEqual(columnar.result_set, [['else']] * 5)
```

**File**: `tests/flow/test_function_calls.py` (modified, +4/-2)
```diff
@@ -1885,8 +1885,10 @@ def test68_Case(self):
             "RETURN CASE WHEN NULL THEN 1+0 WHEN true THEN 2-0 END": [[2]],
             "RETURN CASE WHEN NULL THEN 1+0 WHEN NULL THEN 2-0 ELSE 3*1 END": [[3]],
             "RETURN CASE WHEN NULL THEN 1+0 WHEN NULL THEN 2-0 END": [[None]],
-            "RETURN CASE NULL WHEN NULL THEN NULL ELSE 'else' END AS result": [[None]],
-            "RETURN CASE NULL WHEN 'value' THEN 'value' WHEN NULL THEN NULL ELSE 'else' END AS result": [[None]],
+            # a simple CASE compares with `=`, and `null = null` is null, so a
+            # null WHEN never selects its branch and ELSE is taken instead
+            "RETURN CASE NULL WHEN NULL THEN NULL ELSE 'else' END AS result": [['else']],
+            "RETURN CASE NULL WHEN 'value' THEN 'value' WHEN NULL THEN NULL ELSE 'else' END AS result": [['else']],
             "RETURN CASE NULL WHEN 'when' THEN 'then' ELSE NULL END AS result": [[None]],
             "RETURN CASE 'value' WHEN NULL THEN NULL ELSE true END AS result": [[True]],
             "RETURN CASE 'value' WHEN NULL THEN NULL WHEN 'value' THEN true ELSE false END AS result": [[True]]
```

**File**: `tests/flow/test_null_handling.py` (modified, +38/-0)
```diff
@@ -192,3 +192,41 @@ def test08_null_value_hash_join(self):
             self.env.assertEqual(actual, expected)
 
         graph.delete()
+
+    # A simple CASE compares its subject with `=`, so a null on either side
+    # selects no branch. Every pair below is checked against `=` itself, since
+    # the two must not disagree.
+    def test09_null_simple_case(self):
+        # `eq` is what `=` answers for the pair; None means null, which must
+        # stay distinct from False
+        for subject, when, eq in [("null",       "null",       None),
+                                  ("null",       "1",          None),
+                                  ("1",          "null",       None),
+                                  ("1",          "1",          True),
+                                  ("1.0",        "1",          True),
+                                  ("'a'",        "'a'",        True),
+                                  ("'a'",        "'b'",        False),
+                                  ("[1,2]",      "[1,2]",      True),
+                                  # a null anywhere inside makes `=` null
+                                  ("[1,null]",   "[1,null]",   None),
+                                  ("{a:null}",   "{a:null}",   None)]:
+            q = f"RETURN CASE {subject} WHEN {when} THEN 'm' ELSE 'no' END AS v, {subject} = {when} AS eq"
+            branch, actual_eq = self.graph.query(q).result_set[0]
+
+            self.env.assertEqual(actual_eq, eq)
+            # the branch is taken exactly when `=` is true, never when it is null
+            self.env.assertEqual(branch, 'm' if eq is True else 'no')
+
+        # with no ELSE, an unmatched subject yields null rather than a branch
+        res = self.graph.query("RETURN CASE null WHEN null THEN 'm' END AS v")
+        self.env.assertEqual(res.result_set, [[None]])
+
+        # the searched form is unaffected: it tests truthiness, not equality
+        res = self.graph.query("RETURN CASE WHEN null THEN 'm' ELSE 'no' END AS v")
+        self.env.assertEqual(res.result_set, [['no']])
+
+        # a null subject falls through to a later arm that does match
+        res = self.graph.query(
+            "UNWIND [1, null, 2] AS x "
+            "RETURN CASE x WHEN null THEN 'isnull' WHEN 1 THEN 'one' ELSE 'other' END AS v")
+        self.env.assertEqual(res.result_set, [['one'], ['other'], ['other']])
```

---

### Incident Patch 6: `629107e3` (2026-09-17)
**Commit Message**: fix(effects/v3): end a run when a segment reads against it (#2847)

* fix(effects/v3): end a run when a segment reads against it

Closes #2842.

A run is collapsed into one bitmap and read back in a single direction, so
every segment inside it has to read that way too. Two paths put a segment
into a run going the other way, and both return early, before the
`continues_run` check that would have ended it:

* the lone-`Range` step-down rewrite claimed the run's direction only
  `if self.run.desc.is_none()`, so a run already committed to ascending
  kept a `RangeDescending`;
* the ordinary `Range` extension in the hot path grows a singleton into an
  ascending pair without consulting the run at all, which is the mirror —
  an ascending pair inside a descending run.

Every id survives the collapse and `len` stays right, so the decoder's
cardinality check passes and the buffer applies. An `IdList` is positional,
row k belongs to the k-th id as written, so two entities exchange values on
the replica with no error, no log and no resync.

Measured end to end on a primary/replica pair, same harness both ways, the
replica taking three `GRAPH.EFFECT` and no verbatim command either time:

    

**File**: `graph/src/effects/v3/id_list.rs` (modified, +248/-3)
```diff
@@ -835,6 +835,49 @@ impl IdList {
         }
     }
 
+    /// Settle the run's direction against a segment that is about to acquire
+    /// one, ending the run where the two disagree.
+    ///
+    /// A segment has no direction while it holds one id; the second id gives it
+    /// one. It may only take that direction inside a run that reads the same
+    /// way, because `maybe_collapse_run` folds a run's ranges into a single
+    /// bitmap and reads that bitmap back in *its* order, not in each segment's.
+    ///
+    /// Without this a descending pair inside an ascending run — or the mirror —
+    /// survives the collapse with every id present and `len` correct, so the
+    /// decoder's cardinality check passes and the buffer applies. An `IdList` is
+    /// positional: row *k* belongs to the *k*-th id as written. Two entities
+    /// then exchange values on the replica with no error, no log and no resync,
+    /// and a state comparison calls it green. #2842.
+    ///
+    /// Ending the run rather than rewriting the segment is what the
+    /// `continues_run == false` branch of `push` already does for a reversal it
+    /// can see; this is the same rule for the reversals that reach a segment
+    /// through an extension instead.
+    fn claim_direction(
+        &mut self,
+        desc: bool,
+    ) {
+        match self.run.desc {
+            None => self.run.desc = Some(desc),
+            Some(d) if d == desc => {}
+            // The run ends AT this segment, which becomes the first of the
+            // next one — it is a range, so it is a legal thing for a run to
+            // start with, unlike the `Repeat` case just below.
+            //
+            // The direction is set here and not left for the next push to
+            // decide. `restart` clears it to `None`, and a `None` run takes its
+            // direction from whichever way the *following* id falls — which can
+            // be the opposite of the one this segment already reads, putting an
+            // ascending pair at the head of a descending run and reversing it in
+            // the collapse. That is the same bug one segment further along.
+            Some(_) => {
+                self.run.restart(self.segments.len() - 1);
+                self.run.desc = Some(desc);
+            }
+        }
+    }
+
     /// Add an id, extending the current segment or opening a new one.
     ///
     /// The collapse decision is made here, in flight, and without speculation:
@@ -846,6 +889,24 @@ impl IdList {
     ) {
         self.len += 1;
 
+        // Before the extensions below, not after: once a segment has grown,
+        // nothing in it says which push gave it its direction. A one-id segment
+        // about to become a two-id one is exactly where a run's direction is
+        // decided or contradicted. #2842.
+        match self.segments.last() {
+            Some(&Segment::Range { base, len: 1 }) if base.checked_add(1) == Some(id) => {
+                self.claim_direction(false);
+            }
+            Some(&Segment::RangeDescending { base, len: 1 }) if id.checked_add(1) == Some(base) => {
+                // The rewrite below always produces `len: 2`, so a descending
+                // range of one does not occur today. The arm is here so that
+                // this stays a property of the shape rather than of the order
+                // the shapes happen to be built in.
+                self.claim_direction(true);
+            }
+            _ => {}
+        }
+
         // The hot paths, in the order they are taken. All of them extend the
         // segment already there, and none touches the run tally, because a
         // segment's cost is only folded in once it stops growing.
@@ -903,9 +964,11 @@ impl IdList {
                 self.segments.pop();
                 self.segments
                     .push(Segment::RangeDescending { base, len: 2 });
-                if self.run.desc.is_none() {
-              
```

---

### Incident Patch 7: `580d9d84` (2026-09-16)
**Commit Message**: fix(graph): allocate ids against the set the caller holds, not a count of it (#2797)

* fix(graph): allocate ids against the set the caller holds, not a count of it

The allocator kept a count of outstanding reservations and used it as a
position in the recycle bin. A count cannot tell a reserved id that came
from the bin from one allocated fresh, and after a cancelled reservation
it describes neither.

`CREATE (a),(b),(c) DELETE b CREATE (d),(e)` reaches exactly that. b's id
goes back to the bin, the count drops to 2, and the next fresh id is
placed at `node_count + 2` — which is c's. The query asks for four nodes
and leaves three, c and d fused onto one id, with `Nodes created`
under-reporting to match and no error raised. The relationship allocator
has the same shape and the same bug: cascading a delete through a pending
node hands an edge id back, and the two surviving edges then come back
under one id, so the query returns the same relationship twice. That one
also reaches a replica — it emits a buffer whose relationship boundary is
3 where the ids put it at 2, and the replica refuses it and full-resyncs.

Replace the count with the set the caller already maintains. The rank i

**File**: `.gitignore` (modified, +11/-1)
```diff
@@ -16,7 +16,13 @@ myenv
 codecov.txt*
 temp-*
 /coverage
-dump.rdb
+# Redis writes its dump under whatever `dbfilename` the server was started
+# with, in the server's working directory. RLTest and any hand-started
+# `redis-server --dbfilename db<port>.rdb` therefore drop dumps at the repo
+# root — and a replica writes one during a full resync even when the server is
+# shut down with `nosave`. `dump.rdb` alone did not match those, and five of
+# them reached a PR.
+*.rdb
 .antlr
 cov.profdata
 *.profraw
@@ -68,3 +74,7 @@ bin/
 #   git worktree add tests/fixtures/effects_v3 origin/effects-v3-corpus
 # so it must not read as untracked noise.
 tests/fixtures/effects_v3/
+
+# Scratch CSVs a bulk-insert flow test writes at the repo root.
+/node_*.csv
+/edge_*.csv
```

**File**: `graph/src/effects/v3/apply.rs` (modified, +3/-3)
```diff
@@ -284,7 +284,7 @@ fn apply_record(
                 src.iter().collect(),
                 dst.iter().collect(),
             );
-            g.create_relationships_bulk(&type_name, &src, &dst, &ids, Some(&mut ops.edges))
+            g.create_relationships_bulk(&type_name, &src, &dst, &ids, &mut ops.edges)
                 .map_err(|e| node_op("relationship", e))?;
 
             // As in `CreateNode` above: `attr_map` shape-checks internally, so
@@ -383,14 +383,14 @@ fn apply_record(
             // bin. The other — at or above the boundary this buffer started from
             // and never created by it, so nothing has ever held it — needs the
             // batch, which is why it is handed over here.
-            g.delete_nodes(&nodes, &mut ops.docs.node_removes, Some(&ops.nodes))
+            g.delete_nodes(&nodes, &mut ops.docs.node_removes, &ops.nodes)
                 .map_err(|e| node_op("node", e))?;
             Ok(())
         }
 
         Record::DeleteEdge { ids, .. } => {
             let edges = ids.to_roaring();
-            g.delete_relationships(&edges, &mut ops.docs.edge_removes, Some(&ops.edges))
+            g.delete_relationships(&edges, &mut ops.docs.edge_removes, &ops.edges)
                 .map_err(|e| node_op("relationship", e))?;
             Ok(())
         }
```

**File**: `graph/src/effects/v3/emit.rs` (modified, +3/-5)
```diff
@@ -419,11 +419,9 @@ fn digest_cancelled(
     // Order is load-bearing: an edge's endpoints may themselves be cancelled
     // nodes, so the nodes are created before the edges and deleted after them,
     // exactly as `digest_deleted_edges` runs before `digest_deleted_nodes`.
-    let node_ids: IdList = {
-        let mut ids: Vec<u64> = p.cancelled_nodes.clone();
-        ids.sort_unstable();
-        ids.into_iter().collect()
-    };
+    // Already ascending: `cancelled_nodes` is a set, so the sort this used to
+    // do is the set's own ordering.
+    let node_ids: IdList = p.cancelled_nodes.iter().collect();
     if !p.cancelled_nodes.is_empty() {
         out(Record::CreateNode {
             ids: node_ids.clone(),
```

**File**: `graph/src/effects/v3/test_aux.rs` (modified, +11/-5)
```diff
@@ -25,6 +25,7 @@ use crate::effects::DecodeError;
 use crate::effects::v3::{self as v3, EffectEncode, Record, emit::for_each_record, open_payload};
 use crate::graph::graph::Graph;
 use crate::graph::graphblas::test_init::ensure_init;
+use crate::graph::id_space::IdSpace;
 use crate::runtime::pending::Pending;
 
 // ── graphs ──
@@ -63,7 +64,13 @@ pub(crate) fn with_edge(
 ) {
     let mut graph = g.borrow_mut();
     graph
-        .create_relationships_bulk(&Arc::new(type_name.to_owned()), &[0], &[1], &[id], None)
+        .create_relationships_bulk(
+            &Arc::new(type_name.to_owned()),
+            &[0],
+            &[1],
+            &[id],
+            &mut IdSpace::at(0),
+        )
         .expect("no batch, nothing to refuse");
 }
 
@@ -75,10 +82,9 @@ pub(crate) fn live_node(
 ) {
     let mut graph = g.borrow_mut();
     let ids: RoaringTreemap = std::iter::once(id).collect();
-    // `create_nodes` consumes a reservation, exactly as the apply path does
-    // before it — without this the counter underflows.
-    graph.inc_reserved_node_count();
-    graph.create_allocated_nodes(&ids);
+    graph
+        .create_nodes(&ids, &mut IdSpace::at(0))
+        .expect("fixture ids are fresh");
     let mut rows = Vec::new();
     let mut cols = Vec::new();
     for name in labels {
```

**File**: `graph/src/graph/graph.rs` (modified, +345/-379)
```diff
@@ -312,10 +312,6 @@ pub struct Graph {
     node_cap: u64,
     /// Maximum relationship capacity (for matrix sizing)
     relationship_cap: u64,
-    /// Number of node IDs reserved (including deleted)
-    reserved_node_count: u64,
-    /// Number of relationship IDs reserved (including deleted)
-    reserved_relationship_count: u64,
     /// Current count of active nodes
     node_count: u64,
     /// Current count of active relationships
@@ -741,39 +737,6 @@ fn grow_cap(
     cap
 }
 
-/// Append the next `count` reclaimable ids from `pool` to `out`.
-///
-/// `base` is how many of the pool's ids are already reserved, so this yields
-/// exactly what `pool.iter().skip(base).take(count)` would.
-///
-/// It gets there by rank rather than by walking. `select(base)` finds the
-/// base-th id by summing container cardinalities — a container holds 65,536
-/// ids, so that is on the order of sixteen steps for a million-id pool — and
-/// `Iter::advance_to` then seeks to that value. Expressed as `skip(base)` it
-/// walked `base` elements instead, and `CREATE` reserves once per BATCH_SIZE
-/// rows with `base` only reset at commit, so a create of N ids walked the pool
-/// N/BATCH_SIZE times: O(N^2 / BATCH_SIZE). A 1M-node create over a 1M-id pool
-/// spent about 2s of its 2.5s there.
-///
-/// (`select` is only cheap per *batch*. Per id — the shape this replaced
-/// earlier — N calls of O(containers) is its own quadratic.)
-fn reclaim_ids<T: From<u64>>(
-    pool: &RoaringTreemap,
-    base: u64,
-    count: u64,
-    out: &mut Vec<T>,
-) {
-    if count == 0 {
-        return;
-    }
-    let Some(start) = pool.select(base) else {
-        return;
-    };
-    let mut iter = pool.iter();
-    iter.advance_to(start);
-    out.extend(iter.take(count as usize).map(T::from));
-}
-
 impl Graph {
     #[must_use]
     pub fn new(
@@ -787,8 +750,6 @@ impl Graph {
             name: name.to_string(),
             node_cap: n,
             relationship_cap: e,
-            reserved_node_count: 0,
-            reserved_relationship_count: 0,
             node_count: 0,
             relationship_count: 0,
             deleted_nodes: RoaringTreemap::new(),
@@ -896,8 +857,6 @@ impl Graph {
             name: name.to_string(),
             node_cap: node_cap.next_multiple_of(chunk).max(64),
             relationship_cap: relationship_cap.next_multiple_of(chunk).max(64),
-            reserved_node_count: 0,
-            reserved_relationship_count: 0,
             node_count,
             relationship_count,
             deleted_nodes,
@@ -965,8 +924,6 @@ impl Graph {
 
     #[must_use]
     pub fn new_version(&self) -> Self {
-        debug_assert_eq!(self.reserved_node_count, 0);
-        debug_assert_eq!(self.reserved_relationship_count, 0);
         // One dictionary clone per version instead of the two the split tables cost.
         let attrs_name = self.attrs_name.clone();
         let node_attrs = self.node_attrs.new_version();
@@ -982,8 +939,6 @@ impl Graph {
             name: self.name.clone(),
             node_cap: self.node_cap,
             relationship_cap: self.relationship_cap,
-            reserved_node_count: 0,
-            reserved_relationship_count: 0,
             node_count: self.node_count,
             relationship_count: self.relationship_count,
             deleted_nodes: self.deleted_nodes.clone(),
@@ -1396,142 +1351,40 @@ impl Graph {
         self.attrs_name.get_index_of(attr)
     }
 
-    /// Give back `n` of a reservation counter, without wrapping.
+    /// Hand a reserved id back, unused.
     ///
-    /// The counter says how many ids are outstanding, so consuming more than
-    /// were reserved is a bookkeeping bug — and an unchecked `-=` would wrap it
-    /// to something near `u64::MAX` in release, at which point `reserve_nodes`
-    /// believes the whole recycle bin is spoken for and hands out only fresh
-    /// ids forever. Loud in tests, harmless in release.
-    fn dec_reserved(
-        &se
```

---

### Incident Patch 8: `69cb59aa` (2026-09-15)
**Commit Message**: fix(graph): clear adjacency when an edge dies with both endpoints (#2785)

* fix(graph): clear adjacency when an edge dies with both endpoints

`delete_implicit_edges` skipped the adjacency-matrix update for pairs
whose endpoints were both deleted, on the theory that such an entry is
unreachable. Node ids are recycled out of `deleted_nodes`, so it is not:
the next two nodes created inherit the bit, and `MATCH (x)-->(y)` --
which reads the adjacency matrix directly, with no tensor lookup to
disagree with -- reports an edge that was never created. Binding the
relationship forces that lookup, so the two forms disagreed on the same
data.

Both endpoints being deleted does mean every edge between them is going
away in the same commit, so the pair still needs no per-tensor probe; it
just has to be cleared. `delete_relationships`, the explicit path, has
always cleared unconditionally -- this brings the implicit path in line.

Fixes #2771

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* review: pin recycled ids in the regression test, dedup dead pairs

- The flow test only asserted that no traversal row exists. The stale
  adjacency bit sits on the *deleted* nod

**File**: `graph/src/graph/graph.rs` (modified, +192/-10)
```diff
@@ -2860,9 +2860,10 @@ impl Graph {
     /// the edges. Edges already in `explicit_rels` are skipped (they're handled
     /// by `delete_relationships`).
     ///
-    /// The adjacency matrix is NOT updated for node pairs where both endpoints
-    /// are deleted — those entries are unreachable since the nodes themselves
-    /// are gone.
+    /// Every pair that loses its last edge is cleared from the adjacency
+    /// matrix, including pairs whose endpoints are both deleted: node ids are
+    /// recycled from `deleted_nodes`, so a bit left behind is not unreachable,
+    /// it describes an edge between whichever nodes take the ids next (#2771).
     /// Returns the list of implicitly deleted edges as `(edge_id, src, dst)`
     /// so the caller can record them for effects/replication.
     pub fn delete_implicit_edges(
@@ -2876,9 +2877,15 @@ impl Graph {
         }
 
         let mut all_implicit: Vec<DeletedEdge> = Vec::new();
-        // Pairs where only one endpoint is deleted — need adjacency check
+        // Pairs where an endpoint survives — the survivor may still hold an
+        // edge of another type, so these need a per-tensor check.
         let mut check_adj_pairs: std::collections::HashSet<(u64, u64)> =
             std::collections::HashSet::default();
+        // Pairs where both endpoints are deleted — known non-adjacent, no
+        // check needed. `Tensor::remove_all` yields each pair at most once, so
+        // a duplicate here means two relationship types connected the same
+        // pair; the bulk `build` below collapses those, so they are left in.
+        let mut dead_adj_pairs: Vec<(u64, u64)> = Vec::new();
 
         for type_idx in 0..self.relationship_matrices.len() {
             let mut rels: Vec<(u64, u64, u64)> = Vec::new();
@@ -2963,27 +2970,55 @@ impl Graph {
             // Batch-remove from tensor — remove_all uses bulk mask operations
             let emptied = self.relationship_matrices[type_idx].remove_all(&rels);
             for (src, dst) in emptied {
-                // Only check adjacency if the other endpoint is NOT deleted
-                if !deleted_nodes.contains(src) || !deleted_nodes.contains(dst) {
+                // Both endpoints are being deleted, so no edge between them
+                // can survive the commit: every edge incident to a deleted
+                // node is either collected above or sits in `explicit_rels`,
+                // which `delete_relationships` removes later in this same
+                // commit. Clearing the pair is therefore unconditionally
+                // right, and skipping the tensor probe below is not merely an
+                // optimisation — running ahead of `delete_relationships`, that
+                // probe would still find an explicitly-deleted edge of another
+                // type between this pair and conclude it is adjacent, leaving
+                // the clear to be redone by that later pass.
+                if deleted_nodes.contains(src) && deleted_nodes.contains(dst) {
+                    dead_adj_pairs.push((src, dst));
+                } else {
                     check_adj_pairs.insert((src, dst));
                 }
             }
         }
 
         self.relationship_count -= all_implicit.len() as u64;
 
-        // Update adjacency_matrix only for pairs where one endpoint survives
-        let mut adj_mask = Matrix::<bool>::new(self.node_cap, self.node_cap);
+        // Clear adjacency for every pair that lost its last edge, in one bulk
+        // `build` rather than a `setElement` per pair — matching what
+        // `delete_relationships` does. Both halves feed the same coordinate
+        // lists so a mass `DETACH DELETE` crosses the FFI boundary once, and
+        // `GxB_Matrix_build_Scalar` yields an iso mask (one shared value, not
+        // a byte per entry) that repeated `set` calls would not. It also
+        // collapses duplicate coordinates itself, so the cross-type repeat
```

**File**: `tests/flow/test_graph_deletion.py` (modified, +102/-0)
```diff
@@ -850,6 +850,108 @@ def test37_implicit_edge_cascade_over_many_nodes(self):
         res = self.graph.query("MATCH ()-[r]->() RETURN count(r)")
         self.env.assertEqual(res.result_set[0][0], 0)
 
+    def test38_no_phantom_edge_after_endpoint_ids_are_reused(self):
+        # #2771. Deleting an edge together with both of its endpoints used to
+        # leave the pair's bit set in the adjacency matrix, on the theory that a
+        # pair of deleted nodes is unreachable. Node ids are recycled, so the
+        # next two nodes created inherit the bit and an anonymous traversal --
+        # which reads the adjacency matrix directly, with no tensor lookup to
+        # disagree with -- reports an edge that was never created. Binding the
+        # relationship forces that lookup, so the two forms disagreed.
+        def create(query, ids, msg):
+            # The stale bit sits on the ids of the *deleted* nodes, so the bug
+            # is only reachable while allocation keeps recycling them. Pinning
+            # the ids at both ends -- on the original nodes and again on their
+            # replacements -- makes a change in that behaviour fail here,
+            # rather than quietly turning the traversal checks below into
+            # assertions about a graph that never had the stale bit.
+            res = self.graph.query(query)
+            self.env.assertEqual(res.result_set, [ids], depth=1, message=msg)
+
+        def assert_no_edges(msg):
+            anon = self.graph.query("MATCH (x)-->(y) RETURN x.n, y.n").result_set
+            bound = self.graph.query("MATCH (x)-[r]->(y) RETURN x.n, y.n").result_set
+            self.env.assertEqual(anon, [], depth=1, message=msg)
+            self.env.assertEqual(bound, [], depth=1, message=msg)
+
+        # both endpoints deleted, ids 0 and 1 then reused
+        msg = "both endpoints deleted"
+        self.graph.delete()
+        create("CREATE (a:A {n: 'a'})-[:R]->(b:B {n: 'b'}) RETURN ID(a), ID(b)",
+               [0, 1], msg)
+        res = self.graph.query("MATCH (a:A)-[r:R]->(b:B) DELETE a, b")
+        self.env.assertEqual(res.nodes_deleted, 2)
+        self.env.assertEqual(res.relationships_deleted, 1)
+        create("CREATE (c:C {n: 'c'}), (d:D {n: 'd'}) RETURN ID(c), ID(d)",
+               [0, 1], msg)
+        assert_no_edges(msg)
+
+        # self-loop: src and dst are the same recycled id
+        msg = "self-loop"
+        self.graph.delete()
+        create("CREATE (a:A {n: 'a'})-[:R]->(a) RETURN ID(a)", [0], msg)
+        self.graph.query("MATCH (a:A) DELETE a")
+        create("CREATE (c:C {n: 'c'}) RETURN ID(c)", [0], msg)
+        assert_no_edges(msg)
+
+        # parallel edges of several types, deleted across two transactions
+        msg = "parallel edges"
+        self.graph.delete()
+        create("""CREATE (a:A {n: 'a'}), (b:B {n: 'b'}),
+                         (a)-[:R]->(b), (a)-[:R]->(b), (a)-[:S]->(b)
+                  RETURN ID(a), ID(b)""", [0, 1], msg)
+        self.graph.query("MATCH (a:A) DETACH DELETE a")
+        self.graph.query("MATCH (b:B) DELETE b")
+        create("CREATE (c:C {n: 'c'}), (d:D {n: 'd'}) RETURN ID(c), ID(d)",
+               [0, 1], msg)
+        assert_no_edges(msg)
+
+        # the edge deleted explicitly alongside its endpoints
+        msg = "explicit edge and both endpoints"
+        self.graph.delete()
+        create("CREATE (a:A {n: 'a'})-[:R]->(b:B {n: 'b'}) RETURN ID(a), ID(b)",
+               [0, 1], msg)
+        self.graph.query("MATCH (a:A)-[r:R]->(b:B) DELETE r, a, b")
+        create("CREATE (c:C {n: 'c'}), (d:D {n: 'd'}) RETURN ID(c), ID(d)",
+               [0, 1], msg)
+        assert_no_edges(msg)
+
+    def test39_surviving_edges_outlive_a_neighbour_deletion(self):
+        # The converse of test38: clearing the adjacency entry must not
+        # overreach. An edge between two surviving nodes stays visible to both
+        # traversal forms after a neighbour is deleted and its id is re
```

---

### Incident Patch 9: `9fb7be47` (2026-09-15)
**Commit Message**: fix: identify virtual keys the way the C engine does (#2833)

The pre-save sweep scanned the keyspace for `graphdata` keys and then had
to decide, key by key, which results were real graphs and which were the
module's own bookkeeping. It decided by the graph's *name*, matching a
`__placeholder` / `__vkey_placeholder` prefix — and that name is whatever
key the client chose, so `GRAPH.QUERY __placeholder_x ...` produced a
graph that the very next synchronous SAVE deleted, silently and with all
of its data (#2773). SHUTDOWN saves too, so a restart lost it as well.

C never asks the question. `_CreateKeySpaceMetaKeys` walks
`Globals_ScanGraphs`, the module's own registry, so bookkeeping keys are
not among the candidates; the meta keys it creates are recorded by name
in `GraphEncodeContext` and deleted by name; and the ones an RDB *load*
brings in are recorded the same way in `GraphDecodeContext`, identified
at decode time by "the virtual key name is not equal the graph name".

Do the same here:

* `create_virtual_keys` enumerates `GRAPH_REGISTRY` instead of scanning.
  Virtual keys are never registered, so no test is needed to exclude
  them. `scan_and_clean_graphdata_keys` and its pre

**File**: `src/redis_type.rs` (modified, +137/-189)
```diff
@@ -39,8 +39,9 @@
 //! ```
 
 use crate::config::CONFIGURATION_VKEY_MAX_ENTITY_COUNT;
-use crate::graph_core::{ThreadedGraph, graph_free};
+use crate::graph_core::{GRAPH_REGISTRY, ThreadedGraph, graph_free, register_graph};
 use crate::serializers;
+use crate::serializers::decoder::LoadedKey;
 use crate::serializers::encoder::build_multi_key_payloads;
 use crate::serializers::{DECODE_STATE, VKEY_STATE};
 use graph::graph::mvcc_graph::MvccGraph;
@@ -66,36 +67,44 @@ const DEFAULT_CACHE_SIZE: usize = 25;
 // graphdata rdb_load / rdb_save
 // ---------------------------------------------------------------------------
 
+/// The Redis key name an RDB callback was invoked for.
+///
+/// Lossy, like every other producer of a key string in this module
+/// (`register_graph`, the virtual-key builder): a Redis key name is arbitrary
+/// bytes and the module indexes graphs by `String`.
+unsafe fn io_key_name(rdb: *mut RedisModuleIO) -> String {
+    unsafe {
+        let rm_key_name = raw::RedisModule_GetKeyNameFromIO.unwrap()(rdb);
+        if rm_key_name.is_null() {
+            return String::new();
+        }
+        let mut len: usize = 0;
+        let ptr = raw::RedisModule_StringPtrLen.unwrap()(rm_key_name, &raw mut len);
+        String::from_utf8_lossy(std::slice::from_raw_parts(ptr.cast(), len)).to_string()
+    }
+}
+
 #[unsafe(no_mangle)]
 unsafe extern "C" fn graph_rdb_load(
     rdb: *mut RedisModuleIO,
     _encver: i32,
 ) -> *mut c_void {
     // Get the key name for looking up finalized graphs.
-    let key_name = unsafe {
-        let rm_key_name = raw::RedisModule_GetKeyNameFromIO.unwrap()(rdb);
-        if rm_key_name.is_null() {
-            "<unknown>".to_string()
-        } else {
-            let mut len: usize = 0;
-            let ptr = raw::RedisModule_StringPtrLen.unwrap()(rm_key_name, &raw mut len);
-            String::from_utf8_lossy(std::slice::from_raw_parts(ptr.cast(), len)).to_string()
-        }
-    };
+    let key_name = unsafe { io_key_name(rdb) };
 
-    match serializers::decoder::rdb_load_graph(rdb, DEFAULT_CACHE_SIZE) {
-        Ok(Some(graph)) => {
+    match serializers::decoder::rdb_load_graph(rdb, &key_name, DEFAULT_CACHE_SIZE) {
+        Ok(LoadedKey::Graph(graph)) => {
             // Single-key load (key_count == 1) -- graph is fully loaded.
-            let mvcc = MvccGraph::from_graph(graph);
+            let mvcc = MvccGraph::from_graph(*graph);
             let graph_arc = mvcc.read();
             graph_arc.borrow().set_indexer_graph(graph_arc.clone());
             let tg = ThreadedGraph::from_mvcc(mvcc);
             let arc = Arc::new(RwLock::new(tg));
-            crate::graph_core::register_graph(key_name, arc.clone());
+            register_graph(key_name, arc.clone());
             let boxed: Box<Arc<RwLock<ThreadedGraph>>> = Box::new(arc);
             Box::into_raw(boxed).cast()
         }
-        Ok(None) => {
+        Ok(LoadedKey::Partial { is_virtual }) => {
             // Multi-key load (key_count > 1) -- data stored in DECODE_STATE.
             // Check if all keys have already been loaded (inline finalization),
             // in which case we can return the real graph directly.
@@ -117,7 +126,7 @@ unsafe extern "C" fn graph_rdb_load(
                     } else {
                         let tg = ThreadedGraph::from_mvcc(mvcc);
                         let arc = Arc::new(RwLock::new(tg));
-                        crate::graph_core::register_graph(key_name.clone(), arc.clone());
+                        register_graph(key_name.clone(), arc.clone());
                         arc
                     };
                     let boxed: Box<Arc<RwLock<ThreadedGraph>>> = Box::new(arc);
@@ -138,7 +147,15 @@ unsafe extern "C" fn graph_rdb_load(
                     .insert(key_name.clone(), arc.clone());
             }
 
-            crate::graph_core::register_graph(key_name, arc.clone());
+            // Only the graph's own key names a graph. A virtual key holds a
+ 
```

**File**: `src/serializers/decoder/mod.rs` (modified, +37/-5)
```diff
@@ -16,16 +16,36 @@ use super::Schema;
 use super::buffered_io::BufferedReader;
 use super::{DECODE_STATE, PendingGraph};
 
+/// What one RDB key turned out to hold.
+pub enum LoadedKey {
+    /// The whole graph: the key stood alone (`key_count == 1`).
+    Graph(Box<Graph>),
+    /// A slice of a multi-key graph, accumulated into `DECODE_STATE`.
+    Partial {
+        /// True when this key is one of the graph's virtual keys rather than
+        /// the key the graph itself lives at. Such a key is bookkeeping: it
+        /// must not be registered as a graph, and it leaves the keyspace once
+        /// the load ends.
+        is_virtual: bool,
+    },
+}
+
 /// Decode a graph key from the RDB stream (v19 format).
 ///
-/// Returns `Ok(Some(graph))` for single-key graphs (key_count == 1),
-/// or `Ok(None)` when the key data has been accumulated into
+/// `key_name` is the Redis key this payload arrived under. A multi-key graph
+/// spans several keys but names itself only once, in every payload's header,
+/// so the key whose name matches is the graph's own and the rest are its
+/// virtual keys — see [`DecodeState::meta_keys`](super::DecodeState::meta_keys).
+///
+/// Returns [`LoadedKey::Graph`] for single-key graphs (key_count == 1), or
+/// [`LoadedKey::Partial`] when the key data has been accumulated into
 /// `DECODE_STATE` for multi-key graphs (key_count > 1).
 #[allow(clippy::too_many_lines)]
 pub fn rdb_load_graph(
     rdb: *mut RedisModuleIO,
+    key_name: &str,
     cache_size: usize,
-) -> Result<Option<Graph>, String> {
+) -> Result<LoadedKey, String> {
     let mut r = BufferedReader::new(rdb);
 
     // --- Header ---
@@ -48,6 +68,16 @@ pub fn rdb_load_graph(
     // For multi-key graphs, check if we already have a pending graph in DECODE_STATE.
     if hdr.key_count > 1 {
         let mut decode_state = DECODE_STATE.lock();
+
+        // C's `decode_graph.c`: "the virtual key name is not equal the graph
+        // name". Everything this key contributes lands in the state keyed by
+        // `hdr.graph_name`, and the finished graph is installed under that
+        // name, so any other key holding a slice of it is a virtual key and
+        // has to be deleted once the load ends.
+        if key_name != hdr.graph_name {
+            decode_state.meta_keys.push(key_name.to_string());
+        }
+
         let is_first_key = !decode_state.pending.contains_key(&hdr.graph_name);
 
         if is_first_key {
@@ -138,7 +168,9 @@ pub fn rdb_load_graph(
             decode_state.finalized.insert(graph_name, graph);
         }
 
-        return Ok(None);
+        return Ok(LoadedKey::Partial {
+            is_virtual: key_name != hdr.graph_name,
+        });
     }
 
     // Single-key path (key_count == 1): decode everything in one go.
@@ -221,7 +253,7 @@ pub fn rdb_load_graph(
     }
     graph.populate_indexes_sync();
 
-    Ok(Some(graph))
+    Ok(LoadedKey::Graph(Box::new(graph)))
 }
 
 /// Decode payload data from the RDB stream into a pending multi-key graph.
```

**File**: `src/serializers/encoder/mod.rs` (modified, +15/-5)
```diff
@@ -11,21 +11,30 @@ use super::{Header, Schema};
 pub fn rdb_save_graph(
     rdb: *mut RedisModuleIO,
     graph: &Graph,
+    graph_name: &str,
 ) {
     let payloads = build_payloads(graph);
-    rdb_save_graph_key(rdb, graph, &payloads, 1);
+    rdb_save_graph_key(rdb, graph, graph_name, &payloads, 1);
 }
 
 /// Encode a single key's portion of the graph (used for both primary and virtual keys).
 pub fn rdb_save_graph_key(
     rdb: *mut RedisModuleIO,
     graph: &Graph,
+    graph_name: &str,
     payloads: &[PayloadEntry],
     key_count: u64,
 ) {
     let mut w = BufferedWriter::new(rdb);
     let global_attrs = graph.build_global_attrs();
-    encode_graph(&mut w, graph, payloads, key_count, &global_attrs);
+    encode_graph(
+        &mut w,
+        graph,
+        graph_name,
+        payloads,
+        key_count,
+        &global_attrs,
+    );
     w.finish();
 }
 
@@ -39,7 +48,7 @@ pub fn pipe_save_graph(
     let payloads = build_payloads(graph);
     let mut w = super::buffered_io::PipeWriter::new(fd);
     let global_attrs = graph.build_global_attrs();
-    encode_graph(&mut w, graph, &payloads, 1, &global_attrs);
+    encode_graph(&mut w, graph, graph.name(), &payloads, 1, &global_attrs);
     w.finish();
 }
 
@@ -51,19 +60,20 @@ pub fn vec_save_graph(graph: &Graph) -> Vec<u8> {
     let payloads = build_payloads(graph);
     let mut w = super::buffered_io::VecWriter::new();
     let global_attrs = graph.build_global_attrs();
-    encode_graph(&mut w, graph, &payloads, 1, &global_attrs);
+    encode_graph(&mut w, graph, graph.name(), &payloads, 1, &global_attrs);
     w.into_vec()
 }
 
 /// Shared encoding logic: header, schema, payload directory, payload data.
 fn encode_graph(
     w: &mut dyn Writer,
     graph: &Graph,
+    graph_name: &str,
     payloads: &[PayloadEntry],
     key_count: u64,
     global_attrs: &[std::sync::Arc<String>],
 ) {
-    Header::from_graph(graph, key_count).encode(w);
+    Header::from_graph(graph, graph_name, key_count).encode(w);
     Schema::from_graph(graph, global_attrs.to_vec()).encode(w);
 
     w.write_unsigned(payloads.len() as u64);
```

**File**: `src/serializers/mod.rs` (modified, +28/-1)
```diff
@@ -62,6 +62,20 @@ pub struct DecodeState {
     /// Finalized graphs ready to be picked up by graph_rdb_load or
     /// the finalize_pending_graphs callback.
     pub finalized: HashMap<String, Graph>,
+    /// Redis keys this load has identified as virtual keys: every key of a
+    /// multi-key graph other than the one the graph itself is stored under.
+    /// They carry a slice of the graph rather than a graph of their own, so
+    /// once the load finishes they are bookkeeping and must leave the
+    /// keyspace.
+    ///
+    /// This is C's `GraphDecodeContext` meta-key list: `decode_graph.c`
+    /// records every key it decodes whose name differs from the graph's, and
+    /// `_ClearKeySpaceMetaKeys(ctx, /*decode=*/true)` deletes exactly those.
+    /// Recording the names is what lets the cleanup name its own keys instead
+    /// of guessing which keys in the keyspace look like its own — the guess
+    /// (a `__placeholder` name prefix) deleted user graphs that chose such a
+    /// name, since the name is the client's to pick (#2773).
+    pub meta_keys: Vec<String>,
 }
 
 pub struct PendingGraph {
@@ -88,6 +102,7 @@ impl DecodeState {
             pending: HashMap::new(),
             placeholders: HashMap::new(),
             finalized: HashMap::new(),
+            meta_keys: Vec::new(),
         }
     }
 
@@ -96,6 +111,7 @@ impl DecodeState {
         self.pending.clear();
         self.placeholders.clear();
         self.finalized.clear();
+        self.meta_keys.clear();
     }
 }
 
@@ -183,12 +199,23 @@ impl Decode<19> for Header {
 }
 
 impl Header {
+    /// `graph_name` is the *Redis key* the graph is being written under, not
+    /// `Graph::name()`.
+    ///
+    /// The two agree at creation and diverge on RENAME: C's
+    /// `GraphContext_Rename` re-points `gc->graph_name` at the new key, while
+    /// here nothing updates the name inside the versioned `Graph`. The name in
+    /// this header is what the decoder keys its per-graph state by and what it
+    /// compares each key against to tell the graph's own key from its virtual
+    /// keys, so a stale one made a renamed multi-key graph load into state
+    /// nobody looked up — it came back empty and its key was gone.
     pub fn from_graph(
         graph: &Graph,
+        graph_name: &str,
         key_count: u64,
     ) -> Self {
         Self {
-            graph_name: graph.name().to_string(),
+            graph_name: graph_name.to_string(),
             node_count: graph.node_count(),
             edge_count: graph.relationship_count(),
             deleted_node_count: graph.deleted_nodes().len(),
```

**File**: `tests/flow/test_encode_decode.py` (modified, +103/-0)
```diff
@@ -432,3 +432,106 @@ def test_17_large_string_properties(self):
             "MATCH (n:Str) RETURN n.id, size(n.val) ORDER BY n.id"
         )
         self.env.assertEqual(expected.result_set, actual.result_set)
+
+    def test_18_user_graph_named_like_internal_placeholder(self):
+        # Nothing about a graph's *name* makes it the module's own bookkeeping.
+        # The pre-save sweep used to scan the keyspace and decide which
+        # graphdata keys were its own virtual keys by matching a prefix on the
+        # graph's name, so `SAVE` deleted any user graph that had picked such a
+        # name -- silently, and with its data (issue #2773). The save now takes
+        # its list of graphs from the module's own registry, which virtual keys
+        # were never in, so these names are ordinary.
+        names = ["__placeholder_mydata", "__vkey_placeholder_mydata",
+                 "__placeholder", "__vkey_placeholder"]
+
+        # VKEY_MAX_ENTITY_COUNT is 10 for this suite, so 200 nodes spans many
+        # virtual keys -- this exercises the multi-key save/load path too.
+        for name in names:
+            self.db.select_graph(name).query(
+                "UNWIND range(1, 200) AS i CREATE (:Keep {v:i})")
+
+        query    = "MATCH (n:Keep) RETURN count(n), sum(n.v)"
+        expected = [[200, 20100]]
+
+        # `telemetry{...}` keys are excluded -- the module's telemetry flusher
+        # writes them on its own schedule, so they would race this snapshot.
+        def keyspace():
+            return sorted(k for k in self.redis_con.keys("*")
+                          if not k.startswith("telemetry"))
+
+        def assert_intact():
+            for name in names:
+                self.env.assertTrue(self.redis_con.exists(name))
+                self.env.assertEqual(
+                    self.db.select_graph(name).query(query).result_set, expected)
+
+        before = keyspace()
+        assert_intact()
+
+        # a synchronous SAVE must not destroy them, and must leave the keyspace
+        # exactly as it found it -- proving every virtual key it made is gone
+        self.redis_con.execute_command("SAVE")
+        assert_intact()
+        self.env.assertEqual(keyspace(), before)
+
+        # and they must survive a full RDB round-trip, including the second
+        # save, which encodes graphs that came back through the load's
+        # placeholder path
+        self.redis_con.execute_command("DEBUG", "RELOAD")
+        assert_intact()
+        self.env.assertEqual(keyspace(), before)
+
+        self.redis_con.execute_command("SAVE")
+        assert_intact()
+        self.env.assertEqual(keyspace(), before)
+
+        for name in names:
+            self.db.select_graph(name).delete()
+
+
+class test_encode_decode_rename(FlowTestsBase):
+    # Its own env: the test restarts the server to read its RDB back, and it
+    # has to be the only graph in that RDB -- with other graphs alongside it
+    # the bug below hides, since whether the renamed graph is recovered depends
+    # on where its keys land in the key stream.
+    def __init__(self):
+        self.env, self.db = Env(moduleArgs="VKEY_MAX_ENTITY_COUNT 10")
+        self.redis_con = self.env.getConnection()
+
+    def test_01_renamed_multi_key_graph_round_trips(self):
+        # A RENAME moves the graph to a new key but leaves the name inside the
+        # `Graph` itself untouched. The RDB header now carries the key rather
+        # than that name, because the header's name is what the decoder keys
+        # its per-graph state by and what tells the graph's own key apart from
+        # its virtual keys. With the stale name in there, every key of a
+        # renamed multi-key graph looked like a virtual key of a graph stored
+        # under a key nobody was loading: the graph came back empty and its key
+        # was gone.
+        src, dst = "rename_src", "rename_dst"
+
+        # VKEY_MAX_ENTITY_COUNT is 10 for this env, so 200 nodes spa
```

---

### Incident Patch 10: `caf52f0c` (2026-09-14)
**Commit Message**: fix: keep a label that is re-added in the same query that removes it (#2788)

* fix: keep a label that is re-added in the same query that removes it

`Pending` stages label adds in `set_labels` and label removals in
`remove_labels`, and both appliers — `update_node_labels` and `commit` —
apply the adds first and the removals second. The two mutators were
asymmetric: `remove_node_labels` cancelled a previously staged add, but
`set_node_labels` did not cancel a previously staged removal. So after
`REMOVE n:L SET n:L` the label sat in both sets, the removal ran last and
won, and the node silently lost `L` — unreachable by any label scan even
though the last clause of the query asked for the label to be there.

Make `set_node_labels`/`set_nodes_labels` strip the label from
`remove_labels`, mirroring what `remove_node_labels` already does for
`set_labels`. The two sets are now disjoint per node, which makes
last-writer-wins work in both directions rather than flipping which
direction is broken. Entries emptied by a cancellation are dropped so no
zero-label effect record is replicated.

This also corrects `constraint_node_has_label`, which consulted both sets
with the same "removal wins"

**File**: `graph/src/effects/v3/emit.rs` (modified, +8/-3)
```diff
@@ -860,9 +860,14 @@ fn digest_labels(
         }
         // A label record's whole payload is its label set, so with no labels it
         // states nothing about the nodes it names — it is an instruction to do
-        // nothing. `MATCH (n) SET n:Foo REMOVE n:Foo` reaches here with an empty
-        // vec, because `remove_node_labels` retains over the staged set and
-        // leaves the key behind when it empties.
+        // nothing. `MATCH (n) SET n:Foo REMOVE n:Foo` is the query that reaches
+        // for one: the removal cancels the staged add and empties that node's
+        // label vec.
+        //
+        // `Pending` no longer hands one over — its label mutators drop an entry
+        // that a cancellation has emptied, so the two staging maps stay disjoint
+        // per node — and this stays as the emitter's own guard rather than an
+        // assumption about its caller.
         //
         // Suppressed rather than tolerated, for the same reason
         // `set_node_attributes` refuses to stage an empty attribute map: the
```

**File**: `graph/src/runtime/pending.rs` (modified, +197/-12)
```diff
@@ -510,15 +510,34 @@ impl Pending {
         }
     }
 
-    pub fn set_node_labels(
+    /// Stage label adds for `id`, cancelling any removal of those same labels
+    /// staged earlier in this query. Mirrors [`Self::remove_node_labels`], which
+    /// cancels earlier adds; together they keep `set_labels` and `remove_labels`
+    /// disjoint per node, so the last clause to touch a label wins in either
+    /// direction (`REMOVE n:L SET n:L` keeps `L`, `SET n:L REMOVE n:L` drops it).
+    fn stage_node_labels(
         &mut self,
-        id: NodeId,
+        raw_id: u64,
         labels: &OrderSet<LabelId>,
     ) {
-        let entry = self.set_labels.entry(id.into()).or_default();
+        let entry = self.set_labels.entry(raw_id).or_default();
         for label in labels.iter() {
             entry.push(usize::from(*label) as u64);
         }
+        if let Some(removed) = self.remove_labels.get_mut(&raw_id) {
+            removed.retain(|&l| !labels.contains(&LabelId(l as usize)));
+            if removed.is_empty() {
+                self.remove_labels.remove(&raw_id);
+            }
+        }
+    }
+
+    pub fn set_node_labels(
+        &mut self,
+        id: NodeId,
+        labels: &OrderSet<LabelId>,
+    ) {
+        self.stage_node_labels(id.into(), labels);
     }
 
     pub fn set_nodes_labels(
@@ -527,13 +546,13 @@ impl Pending {
         labels: &OrderSet<LabelId>,
     ) {
         for id in ids {
-            let entry = self.set_labels.entry((*id).into()).or_default();
-            for label in labels.iter() {
-                entry.push(usize::from(*label) as u64);
-            }
+            self.stage_node_labels((*id).into(), labels);
         }
     }
 
+    /// Stage label removals for `id`, cancelling any add of those same labels
+    /// staged earlier in this query — the mirror image of
+    /// [`Self::stage_node_labels`], keeping the two sets disjoint per node.
     pub fn remove_node_labels(
         &mut self,
         id: NodeId,
@@ -545,6 +564,9 @@ impl Pending {
             // Remove from pending set labels
             if let Some(set) = self.set_labels.get_mut(&raw_id) {
                 set.retain(|&l| l != label_id);
+                if set.is_empty() {
+                    self.set_labels.remove(&raw_id);
+                }
             }
             self.remove_labels.entry(raw_id).or_default().push(label_id);
         }
@@ -554,9 +576,9 @@ impl Pending {
     /// added, `Some(false)` if it was removed, `None` if this query says nothing
     /// about it and the committed label matrix is the answer.
     ///
-    /// The precedence is [`Self::update_node_labels`]'s, which applies the adds
-    /// and then the removals, so a removal wins — the two must agree, since they
-    /// answer the same question for the same node.
+    /// `set_labels` and `remove_labels` are disjoint per node (see
+    /// [`Self::stage_node_labels`]), so at most one of the two branches below can
+    /// match and the order they are consulted in carries no meaning.
     pub fn node_has_label(
         &self,
         id: NodeId,
@@ -581,6 +603,11 @@ impl Pending {
         None
     }
 
+    /// Overlay this query's staged label changes onto `labels`.
+    ///
+    /// Adds are applied before removals, but the two sets are disjoint per node
+    /// (see [`Self::stage_node_labels`]), so no label is touched by both passes
+    /// and the order is immaterial.
     pub fn update_node_labels(
         &self,
         id: NodeId,
@@ -1266,8 +1293,9 @@ impl Pending {
     /// would force a pending-tuple materialization of its delta on every
     /// commit (`O(|delta|)` per write query, quadratic between folds) —
     /// measured as the dominant cost of small repeated creates. Mirrors
-    /// [`Self::update_node_labels`] semantics: a removed label wins over a
-    /// pending set.
+    /// [`Self::update_node_labels`] semantics; `set_labels` and `remove_labels`
+    /// are disjoint per node (see [`
```

**File**: `tests/flow/test_constraint.py` (modified, +62/-0)
```diff
@@ -584,6 +584,68 @@ def test08_remove_supporting_index(self):
         drop_node_range_index(self.g, "Author", "nickname")
         drop_node_range_index(self.g, "Author", "birthdate")
 
+    def test09_constraint_enforced_on_removed_and_readded_label(self):
+        # A label that is removed and re-added in the same query is still
+        # carried by the node at commit time, so constraints on it must be
+        # enforced. Before the fix for #2777 the pending add and the pending
+        # remove both sat in the transaction's bookkeeping and the remove won,
+        # so the node looked unlabelled to the constraint check and violations
+        # were silently let through.
+
+        #-----------------------------------------------------------------------
+        # unique constraint
+        #-----------------------------------------------------------------------
+        create_unique_node_constraint(self.g, "Rejoin", "v", sync=True)
+        self.g.query("CREATE (:Rejoin {v: 1})")
+
+        # duplicate created in the SAME query that removes and re-adds the
+        # constrained label must still be rejected
+        try:
+            self.g.query("MATCH (n:Rejoin {v: 1}) REMOVE n:Rejoin SET n:Rejoin CREATE (:Rejoin {v: 1})")
+            self.env.assertTrue(False)
+        except ResponseError as e:
+            self.env.assertContains("unique constraint violation on node of type Rejoin", str(e))
+
+        # the rejected query must not have left anything behind
+        self.env.assertEqual(self.g.query("MATCH (n:Rejoin) RETURN count(n)").result_set[0][0], 1)
+
+        # a node that re-acquires the label must also collide with an existing
+        # value it is updated into
+        self.g.query("CREATE (:Rejoin {v: 2})")
+        try:
+            self.g.query("MATCH (n:Rejoin {v: 2}) REMOVE n:Rejoin SET n:Rejoin SET n.v = 1")
+            self.env.assertTrue(False)
+        except ResponseError as e:
+            self.env.assertContains("unique constraint violation on node of type Rejoin", str(e))
+        self.env.assertEqual(self.g.query("MATCH (n:Rejoin {v: 2}) RETURN count(n)").result_set[0][0], 1)
+
+        # genuinely dropping the label frees the value — the constraint must
+        # not be over-enforced
+        result = self.g.query("MATCH (n:Rejoin {v: 1}) REMOVE n:Rejoin CREATE (:Rejoin {v: 1})")
+        self.env.assertEqual(result.labels_removed, 1)
+        self.env.assertEqual(result.nodes_created, 1)
+        self.env.assertEqual(self.g.query("MATCH (n:Rejoin) RETURN count(n)").result_set[0][0], 2)
+
+        #-----------------------------------------------------------------------
+        # mandatory constraint
+        #-----------------------------------------------------------------------
+        create_mandatory_node_constraint(self.g, "Mandate", "p", sync=True)
+        self.g.query("CREATE (:Mandate {p: 1})")
+
+        # dropping the mandatory property while the label is removed and
+        # re-added must be rejected — the node still ends up labelled
+        try:
+            self.g.query("MATCH (n:Mandate) REMOVE n:Mandate SET n:Mandate SET n.p = NULL")
+            self.env.assertTrue(False)
+        except ResponseError as e:
+            self.env.assertContains("mandatory constraint violation", str(e))
+        self.env.assertEqual(self.g.query("MATCH (n:Mandate) RETURN n.p").result_set[0][0], 1)
+
+        # dropping the label for real releases the node from the constraint
+        result = self.g.query("MATCH (n:Mandate) REMOVE n:Mandate SET n.p = NULL")
+        self.env.assertEqual(result.labels_removed, 1)
+        self.env.assertEqual(self.g.query("MATCH (n:Mandate) RETURN count(n)").result_set[0][0], 0)
+
 class testConstraintEdges():
     def __init__(self):
         self.env, self.db = Env()
```

**File**: `tests/flow/test_entity_update.py` (modified, +42/-0)
```diff
@@ -495,6 +495,48 @@ def test_30_mix_add_and_remove_same_labels(self):
         self.env.assertEqual(result.labels_removed, 0)
         self.validate_node_labels(self.graph, labels, 1)
 
+    def test_31_mix_add_and_remove_same_label_on_labeled_node(self):
+        # https://github.com/FalkorDB/FalkorDB/issues/2777
+        # a label re-added in the same query that removes it must survive;
+        # the last clause to touch a label wins, in both directions
+        self.graph.delete()
+        self.graph.query("CREATE (:L {v: 1})")
+        self.validate_node_labels(self.graph, ["L"], 1)
+
+        # remove prior to set: the label is kept
+        result = self.graph.query("MATCH (n:L) REMOVE n:L SET n:L RETURN labels(n)")
+        self.env.assertEqual(result.result_set[0][0], ["L"])
+        self.env.assertEqual(result.labels_removed, 0)
+        # still reachable by a label scan, and still a single node
+        self.validate_node_labels(self.graph, ["L"], 1)
+        self.env.assertEqual(self.graph.query("MATCH (n) RETURN count(n)").result_set[0][0], 1)
+
+        # set prior to remove: the label is dropped
+        result = self.graph.query("MATCH (n:L) SET n:L REMOVE n:L RETURN labels(n)")
+        self.env.assertEqual(result.result_set[0][0], [])
+        self.env.assertEqual(result.labels_removed, 1)
+        self.validate_node_labels(self.graph, ["L"], 0)
+        # the node itself survives, it only lost the label
+        self.env.assertEqual(self.graph.query("MATCH (n) RETURN count(n)").result_set[0][0], 1)
+
+        # a different label added while the original one is removed
+        for query in ["MATCH (n:A) REMOVE n:A SET n:B RETURN labels(n)",
+                      "MATCH (n:A) SET n:B REMOVE n:A RETURN labels(n)"]:
+            self.graph.delete()
+            self.graph.query("CREATE (:A)")
+            result = self.graph.query(query)
+            self.env.assertEqual(result.result_set[0][0], ["B"])
+            self.validate_node_labels(self.graph, ["A"], 0)
+            self.validate_node_labels(self.graph, ["B"], 1)
+
+        # multiple nodes updated by a single query
+        self.graph.delete()
+        self.graph.query("UNWIND range(1, 5) AS i CREATE (:L {v: i})")
+        result = self.graph.query("MATCH (n:L) REMOVE n:L SET n:L RETURN count(n)")
+        self.env.assertEqual(result.result_set[0][0], 5)
+        self.env.assertEqual(result.labels_removed, 0)
+        self.validate_node_labels(self.graph, ["L"], 5)
+
     def test_32_mix_merge_and_remove_node_labels(self):
         self.graph.delete()
         labels_to_remove = ["Foo"]
```

**File**: `tests/flow/test_label_update.py` (modified, +44/-0)
```diff
@@ -91,6 +91,50 @@ def test_same_label_multiple_set_remove(self):
 
         self.env.assertTrue(graph_eq(self.master_graph, self.replica_graph))
 
+    def test_remove_then_set_same_label(self):
+        # Regression for #2777: a label removed and re-added in the same query
+        # must survive. What this pins is the replicated end state — master and
+        # replica agreeing that the node still carries L, which a stale
+        # RemoveLabels record would break on the replica alone.
+        #
+        # It does not pin the record set on the wire: a zero-label SetLabels
+        # applies as a no-op, so both sides agree whether or not one was sent.
+        # That is pinned on the emitter and the staging maps, by
+        # graph::runtime::pending::label_effect_tests.
+        self.query_master_and_wait("CREATE (:A {v: 1})")
+        self.query_master_and_wait("MATCH (n:A) SET n:L")
+
+        # --- REMOVE then SET: the label is kept ---
+        # no WITH between the clauses: both land in the same segment, so the
+        # add has to cancel the staged removal rather than commit after it
+        res = self.query_master_and_wait("MATCH (n:A:L) REMOVE n:L SET n:L RETURN n")
+        self.env.assertEqual(res.labels_removed, 0)
+
+        res = self.query_master_and_wait("MATCH (n:A:L) RETURN count(n) AS c")
+        self.env.assertEqual(res.result_set[0][0], 1)
+
+        # the replica must still see the label, both in labels() and via a
+        # label scan — a stale RemoveLabels record would strip it there only
+        res = Graph(self.replica, GRAPH_ID).ro_query("MATCH (n:A:L) RETURN labels(n)")
+        self.env.assertEqual(len(res.result_set), 1)
+        self.env.assertContains("L", res.result_set[0][0])
+
+        self.env.assertTrue(graph_eq(self.master_graph, self.replica_graph))
+
+        # --- SET then REMOVE: the label is dropped ---
+        res = self.query_master_and_wait("MATCH (n:A:L) SET n:L REMOVE n:L RETURN n")
+        self.env.assertEqual(res.labels_removed, 1)
+
+        res = self.query_master_and_wait("MATCH (n:A:L) RETURN count(n) AS c")
+        self.env.assertEqual(res.result_set[0][0], 0)
+
+        # the node itself survives on the replica, it only lost the label
+        res = Graph(self.replica, GRAPH_ID).ro_query("MATCH (n:A) RETURN labels(n)")
+        self.env.assertEqual(len(res.result_set), 1)
+        self.env.assertNotContains("L", res.result_set[0][0])
+
+        self.env.assertTrue(graph_eq(self.master_graph, self.replica_graph))
+
     def test_redundant_label_set_remove(self):
         # A single query that touches the same label in multiple SET / REMOVE
         self.query_master_and_wait("CREATE (:A {v: 1})")
```

#### Recent Merged Pull Requests:
- **PR #3139** (2026-09-28): Fix crash when a clause errors mid plan-build (#250) (@swilly22)
- **PR #3116** (2026-09-26): Fix crash on MERGE following a wrong-arity function call (#239) (@swilly22)
- **PR #3115** (closed): Merge arity validation (@swilly22)
- **PR #2944** (2026-09-27): test(slowlog): populate the slowlog serially (@DvirDukhan)
- **PR #2943** (2026-09-25): [6.0] Backport #2869 and #2921 from main (@DvirDukhan)
- **PR #2921** (2026-09-24): fix(info): stop INFO reporting RediSearch's version as graph_version; Redis 8.10.2 (@DvirDukhan)
- **PR #2889** (2026-09-24): 4.20.7 (@swilly22)
- **PR #2888** (2026-09-24): [6.0] ci(release): move Docker Hub :latest to the Rust image on release (#2882) (@DvirDukhan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
