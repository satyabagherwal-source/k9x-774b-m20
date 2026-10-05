# Forensic Learning Record (Deep Inspection): DeusData/codebase-memory-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/deusdata-codebase-memory-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:51:47.783Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DeusData/codebase-memory-mcp`
- **Description**: High-performance code intelligence MCP server. Indexes codebases into a persistent knowledge graph — average repo in milliseconds. 158 languages, sub-ms queries, 99% fewer tokens. Single static binary, zero dependencies.
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 45828 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `graph-ui/src/hooks/useGraphData.ts`
```
import { useCallback, useState } from "react";
import type { GraphData } from "../lib/types";

export interface LoadProgress {
  receivedBytes: number;
  totalBytes: number | null;
}

interface UseGraphDataResult {
  data: GraphData | null;
  loading: boolean;
  error: string | null;
  progress: LoadProgress;
  fetchOverview: (
    project: string,
    maxNodes?: number,
    graph?: "code" | "missed",
  ) => void;
  fetchDetail: (project: string, centerNode: string) => void;
}

/* Node budget: how many nodes the layout endpoint is asked for. The default
 * keeps first paint fast; the user can raise it in 5k steps up to the hard
 * ceiling (mirrors HARD_MAX_NODES in src/ui/layout3d.c). Edges always follow
 * the budget — the server returns every edge between the loaded nodes. */
export const GRAPH_RENDER_NODE_LIMIT = 5000;
export const GRAPH_NODE_BUDGET_STEP = 5000;
export const GRAPH_NODE_BUDGET_MAX = 10_000_000;

export function clampNodeBudget(value: number): number {
  if (!Number.isFinite(value)) return GRAPH_RENDER_NODE_LIMIT;
  const stepped =
    Math.round(value / GRAPH_NODE_BUDGET_STEP) * GRAPH_NODE_BUDGET_STEP;
  if (stepped < GRAPH_NODE_BUDGET_STEP) return GRAPH_NODE_BUDGET_STEP;
  if (stepped > GRAPH_NODE_BUDGET_MAX) return GRAPH_NODE_BUDGET_MAX;
  return stepped;
}

/** Which graph to lay out: the code graph (default) or the missed graph —
 *  only files the indexer could not fully cover, as their file structure. */
export type GraphVariant = "code" | "missed";

export async function fetchLayout(
  project: string,
  maxNodes = GRAPH_RENDER_NODE_LIMIT,
  onProgress?: (progress: LoadProgress) => void,
  graph: GraphVariant = "code",
): Promise<GraphData> {
  const params = new URLSearchParams({ project, max_nodes: String(maxNodes) });
  if (graph === "missed") params.set("graph", "missed");
  const res = await fetch(`/api/layout?${params}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  /* Stream the body when possible so large budgets show live download
   * progress instead of a silent stall. */
  if (!res.body || !onProgress) {
    return res.json();
  }

  const lengthHeader = res.headers.get("content-length");
  const totalBytes = lengthHeader ? parseInt(lengthHeader, 10) || null : null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.length;
    onProgress({ receivedBytes, totalBytes });
  }

  const merged = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(merged));
}

const NO_PROGRESS: LoadProgress = { receivedBytes: 0, totalBytes: null };

export function useGraphData(): UseGraphDataResult {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress>(NO_PROGRESS);

  const fetchOverview = useCallback(
    async (project: string, maxNodes?: number, graph: GraphVariant = "code") => {
      setLoading(true);
      setError(null);
      setProgress(NO_PROGRESS);
      try {
        const result = await fetchLayout(project, maxNodes, setProgress, graph);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch layout");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchDetail = useCallback(
    async (project: string, _centerNode: string) => {
      setLoading(true);
      setError(null);
      setProgress(NO_PROGRESS);
      try {
        /* TODO: detail level with center_node filtering */
        const result = await fetchLayout(project, undefined, setProgress);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch layout");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { data, loading, error, progress, fetchOverview, fetchDetail };
}

```

### Core Architecture Module: `graph-ui/src/hooks/useProjects.ts`
```
import { useCallback, useEffect, useState } from "react";
import { callTool } from "../api/rpc";
import type { Project, SchemaInfo } from "../lib/types";

interface ProjectInfo {
  project: Project;
  schema: SchemaInfo | null;
}

interface ProjectPage {
  projects?: Project[];
  has_more?: boolean;
  next_offset?: number;
}

interface SchemaPage extends SchemaInfo {
  has_more?: boolean;
  next_offset?: number;
}

const PAGE_LIMIT = 500;

function nextPageOffset(page: { has_more?: boolean; next_offset?: number }, offset: number) {
  if (typeof page.has_more !== "boolean") {
    throw new Error("Invalid pagination response");
  }
  if (!page.has_more) return null;
  if (!Number.isInteger(page.next_offset) || page.next_offset! <= offset) {
    throw new Error("Invalid pagination response");
  }
  return page.next_offset!;
}

async function fetchAllProjects(): Promise<Project[]> {
  const projects: Project[] = [];
  let offset = 0;
  for (;;) {
    const page = await callTool<ProjectPage>("list_projects", {
      format: "json",
      detail: "stats",
      limit: PAGE_LIMIT,
      offset,
    });
    projects.push(...(page.projects ?? []));
    const next = nextPageOffset(page, offset);
    if (next === null) return projects;
    offset = next;
  }
}

async function fetchFullSchema(project: string): Promise<SchemaInfo> {
  const nodeLabels: SchemaInfo["node_labels"] = [];
  const edgeTypes: SchemaInfo["edge_types"] = [];
  let firstPage: SchemaPage | null = null;
  let offset = 0;
  for (;;) {
    const page = await callTool<SchemaPage>("get_graph_schema", {
      project,
      format: "json",
      limit: PAGE_LIMIT,
      offset,
    });
    firstPage ??= page;
    nodeLabels.push(...(page.node_labels ?? []));
    edgeTypes.push(...(page.edge_types ?? []));
    const next = nextPageOffset(page, offset);
    if (next === null) {
      return { ...firstPage, node_labels: nodeLabels, edge_types: edgeTypes };
    }
    offset = next;
  }
}

interface UseProjectsResult {
  projects: ProjectInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAllProjects();

      /* Fetch schema for each project */
      const infos: ProjectInfo[] = await Promise.all(
        list.map(async (p) => {
          try {
            const schema = await fetchFullSchema(p.name);
            return { project: p, schema };
          } catch {
            return { project: p, schema: null };
          }
        }),
      );

      setProjects(infos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refresh: fetchProjects };
}

```

### Core Architecture Module: `graph-ui/src/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `scripts/lint-memory-core.py`
```
#!/usr/bin/env python3
"""
lint-memory-core.py — the memory-core linter.

Memory in this project is allocated through ONE core (src/foundation/mem_core.h),
not through scattered raw malloc/calloc/realloc/free/strdup. This linter is the
gate that keeps that true.

WHY A RATCHET, NOT A BAN. An audit on 2026-09-13 found ~800 raw allocation
sites in src/ and none of them can be migrated in one change. So the gate works
like every other honest debt gate: a checked-in baseline records how many raw
sites each file has TODAY, and the build goes red the moment any file has MORE
than its baseline, or a file not in the baseline grows one. Files can only ever
go down. When a file is migrated, its baseline line is lowered (or removed) in
the same change -- and --strict turns "below baseline" into a failure too, so
the baseline cannot silently rot behind the code.

WHAT COUNTS AS RAW. A call to malloc/calloc/realloc/free/strdup/strndup that is
not part of a longer identifier. cbm_alloc, cbm_free, cbm_calloc, mi_malloc,
cbm_arena_alloc and heap_strdup are all NOT matches: the character before the
name is an identifier character. Comments and string literals are stripped
first, so prose that mentions malloc( does not trip the gate -- the security
audit already bit us once on exactly that with fork(.

EXEMPT. The core itself and the allocator plumbing it sits on:
    src/foundation/mem_core.c        the route
    (arena.c allocates its blocks THROUGH the core -- class arena -- and is scanned)
    src/foundation/slab_alloc.c      same
    src/foundation/mem.c             policy/measurement, probes with malloc
    src/foundation/mem_override_*.c  the --wrap / override shims
    src/foundation/compat*.c         libc replacement surface
    internal/**/vendored/**          not ours
    vendored/**                      not ours

SCOPE. Everything under src/ and internal/ -- cli, mcp, daemon, store,
pipeline, the extraction engine -- so the count is for the whole project, not
one subsystem, and a leak shows up wherever it is.

Usage:
    lint-memory-core.py                  check against the baseline (CI)
    lint-memory-core.py --strict         also fail when a file is BELOW baseline
    lint-memory-core.py --write-baseline regenerate scripts/memory-core-baseline.txt
    lint-memory-core.py --list           print every raw site (file:line: call)

Exit 0 = clean. Exit 1 = a file grew. Exit 2 = usage/IO error.
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASELINE = ROOT / "scripts" / "memory-core-baseline.txt"
SCAN_ROOTS = ("src", "internal")
RAW = re.compile(r"(?<![A-Za-z0-9_])(malloc|calloc|realloc|free|strdup|strndup)\s*\(")

EXEMPT_EXACT = {
    "src/foundation/mem_core.c",
            "src/foundation/mem.c",
}
EXEMPT_PREFIX = (
    "src/foundation/mem_override_",
    "src/foundation/compat",
    "vendored/",
)


def is_vendored(rel: str) -> bool:
    """Any vendored/ segment anywhere under internal/ is not ours."""
    return "/vendored/" in rel or rel.startswith("vendored/")


def is_exempt(rel: str) -> bool:
    return rel in EXEMPT_EXACT or rel.startswith(EXEMPT_PREFIX) or is_vendored(rel)


def strip_comments_and_strings(text: str) -> str:
    """Blank out comments and string literals, preserving line structure so
    reported line numbers stay right. Character-class aware enough for C:
    handles escapes inside strings and does not treat // inside a string as a
    comment."""
    out = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if c == "/" and nxt == "*":
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("".join(ch if ch == "\n" else " " for ch in text[i:j]))
            i = j
        elif c == "/" and nxt == "/":
            j = text.find("\n", i)
            j = n if j < 0 else j
            out.append(" " * (j - i))
            i = j
        elif c == '"' or c == "'":
            q = c
            j = i + 1
            while j < n and text[j] != q:
                if text[j] == "\\":
                    j += 1
                if j < n and text[j] == "\n":
                    break
                j += 1
            j = min(j + 1, n)
            out.append(q + " " * max(0, j - i - 2) + (q if j - i >= 2 else ""))
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def scan() -> dict[str, list[tuple[int, str]]]:
    hits: dict[str, list[tuple[int, str]]] = {}
    for root in SCAN_ROOTS:
        base = ROOT / root
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if path.suffix not in (".c", ".h") or not path.is_file():
                continue
            rel = path.relative_to(ROOT).as_posix()
            if is_exempt(rel):
                continue
            text = strip_comments_and_strings(path.read_text(encoding="utf-8", errors="replace"))
            for lineno, line in enumerate(text.splitlines(), 1):
                for m in RAW.finditer(line):
                    hits.setdefault(rel, []).append((lineno, m.group(1)))
    return hits


def read_baseline() -> dict[str, int]:
    if not BASELINE.exists():
        return {}
    out: dict[str, int] = {}
    for raw in BASELINE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        rel, _, count = line.rpartition("\t")
        if not rel:
            continue
        try:
            out[rel] = int(count)
        except ValueError:
            continue
    return out


def write_baseline(hits: dict[str, list]) -> None:
    lines = [
        "# memory-core-baseline.txt -- raw allocator call sites per file.",
        "# Generated by scripts/lint-memory-core.py --write-baseline.",
        "# A file may only ever go DOWN. Lower a line in the same change that",
        "# migrates the file to src/foundation/mem_core.h; never raise one.",
        "",
    ]
    for rel in sorted(hits):
        lines.append(f"{rel}\t{len(hits[rel])}")
    BASELINE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write-baseline", action="store_true")
    ap.add_argument("--strict", action="store_true", help="fail when a file is BELOW its baseline")
    ap.add_argument("--list", action="store_true", help="print every raw site")
    args = ap.parse_args()

    hits = scan()
    total = sum(len(v) for v in hits.values())

    if args.write_baseline:
        write_baseline(hits)
        print(f"memory-core baseline written: {len(hits)} files, {total} raw sites")
        return 0

    if args.list:
        for rel in sorted(hits):
            for lineno, call in hits[rel]:
                print(f"{rel}:{lineno}: {call}(")
        print(f"-- {total} raw sites in {len(hits)} files")
        return 0

    baseline = read_baseline()
    if not baseline:
        print(f"ERROR: no baseline at {BASELINE.relative_to(ROOT)}; run --write-baseline", file=sys.stderr)
        return 2

    grew: list[str] = []
    shrank: list[str] = []
    for rel, sites in sorted(hits.items()):
        now = len(sites)
        allowed = baseline.get(rel, 0)
        if now > allowed:
            # Show the LAST sites: new code is usually appended, so these are the
            # likeliest culprits. The linter cannot know which sites are new
            # without a diff; --list prints them all.
            delta = now - allowed
            tail = ", ".join(f"{ln}:{c}" for ln, c in sites[-max(delta, 1):][-6:])
            grew.append(f"  {rel}: grew by {delta} ({allowed} -> {now}); latest sites: {tail}"
                        f"  [run --list for all]")
        elif now < allowed:
            shrank.append(f"  {rel}: {now} (baseline {allowed}) -- lower the baseline")
    for rel, allowed in sorted(baseline.items()):
        if rel not in hits and allowed > 0:
            shrank.append(f"  {rel}: 0 (baseline {allowed}) -- remove the line")

    if grew:
        print("memory-core linter FAILED: raw allocator use grew. Allocate through")
        print("src/foundation/mem_core.h (cbm_alloc/cbm_calloc/cbm_realloc/cbm_free/")
        print("cbm_mem_strdup) instead of malloc/calloc/realloc/free/strdup.")
        print("\n".join(grew))
    if shrank:
        print("memory-core ratchet: these files improved; tighten scripts/memory-core-baseline.txt:")
        print("\n".join(shrank))
    if grew or (args.strict and shrank):
        return 1
    print(f"memory-core linter passed: {total} raw sites across {len(hits)} files, none grew")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `src/cli/hook_augment.c`
```
/*
 * hook_augment.c — `codebase-memory-mcp hook-augment`
 *
 * A non-blocking lifecycle, search, and post-read context augmenter. Reads a
 * documented vendor hook payload from stdin and emits event-specific context:
 * graph symbols for supported searches, tier routing at lifecycle boundaries,
 * and targeted index-coverage warnings after supported file reads.
 *
 * Cardinal rule: this NEVER blocks a tool call. Every error, timeout, missing
 * project, or short/odd pattern path results in `exit 0` with NO stdout
 * output (a clean pass-through). This is what makes issue #362 structurally
 * impossible to recur — the hook cannot deny a tool.
 *
 * The underlying query is `search_graph` (pure SQLite, shell-free) — chosen
 * over `search_code` (which shells out to grep|xargs) so the hook stays cheap
 * enough to run before every Grep/Glob/Bash call.
 */

#include "cli/cli.h"
#include "foundation/compat_fs.h"
#include "foundation/constants.h"
#include "foundation/mem.h"
#include "foundation/platform.h"
#include "mcp/mcp.h"
#include "pipeline/pipeline.h"
#include "yyjson/yyjson.h"

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef _WIN32
#include <fcntl.h>
#include <signal.h>
#include <sys/time.h>
#include <unistd.h>
#else
#include <direct.h>
#include <windows.h>
#endif

#define HA_STDIN_CAP (256 * 1024) /* hook payloads are tiny; cap defensively */
#define HA_MIN_TOKEN 4            /* skip short/noisy patterns before any work */
#define HA_MAX_TOKEN 96
#define HA_RESULT_LIMIT 5
#define HA_LIST_PAGE_LIMIT 500
#define HA_METADATA_CAP 192
#define HA_MAX_WALKUP 8    /* cwd may be a subdir of the indexed root  */
#define HA_DEADLINE_MS 300 /* hard in-process budget (see also: the    */
                           /* settings.json "timeout" backstop)        */

/* ── Hard deadline ────────────────────────────────────────────────
 * A slow SQLite open or query must never stall the agent. When the timer
 * fires we _exit(0) immediately. Output is written exactly once at the very
 * end, so firing mid-work simply yields a clean no-op (no partial JSON).
 *
 * Observability (#858): a fired deadline is otherwise indistinguishable from
 * "no matches", so the handler first write()s a pre-formatted breadcrumb to
 * <cache_dir>/logs/hook-augment-timeouts.log (by default
 * ~/.cache/codebase-memory-mcp/logs; fd and message prepared at arm time —
 * only async-signal-safe write/_exit in the handler). */
#ifndef _WIN32
#define HA_DEADLINE_DEFAULT_MS 2000 /* in-process budget; see ha_deadline_ms()  */
#define HA_DEADLINE_MIN_MS 50
#define HA_DEADLINE_MAX_MS 10000

/* #858: the original 300ms budget silently self-terminated on real cold
 * starts (SQLite/mmap open under load), so augmentation never appeared in
 * real sessions (0/24 observed) while manual warm invocations worked. The
 * budget is now generous by default and env-configurable; the settings.json
 * hook "timeout" remains the outer backstop (and alone governs Windows,
 * where this whole in-process deadline block is compiled out). */
static int ha_deadline_ms(void) {
    /* A value this reader cannot read gets the DEFAULT, never the floor. atoi
     * used to answer 0 for a typo, 0 is below the minimum, and the clamp then
     * handed back the shortest deadline the setting allows — the opposite of
     * what somebody raising CBM_HOOK_DEADLINE_MS is asking for. */
    long v = 0;
    if (!cbm_env_long("CBM_HOOK_DEADLINE_MS", &v)) {
        return HA_DEADLINE_DEFAULT_MS;
    }
    if (v < HA_DEADLINE_MIN_MS) {
        return HA_DEADLINE_MIN_MS;
    }
    if (v > HA_DEADLINE_MAX_MS) {
        return HA_DEADLINE_MAX_MS;
    }
    return (int)v;
}

static int g_ha_crumb_fd = -1;
static char g_ha_crumb_msg[160];
static size_t g_ha_crumb_len = 0;

static void ha_deadline_exit(int sig) {
    (void)sig;
    if (g_ha_crumb_fd >= 0 && g_ha_crumb_len > 0) {
        ssize_t w = write(g_ha_crumb_fd, g_ha_crumb_msg, g_ha_crumb_len);
        (void)w;
    }
    _exit(0);
}

/* Whether snprintf wrote the whole string into a buffer of `cap` bytes. */
static bool ha_fits(int written, size_t cap) {
    return written > 0 && (size_t)written < cap;
}

static void ha_open_crumb_log(int deadline_ms) {
    const char *override = getenv("CBM_HOOK_TIMEOUT_LOG"); /* tests + power users */
    char path[CBM_SZ_1K];
    /* A path cut off at the buffer names some other file, and O_CREAT would
     * create it. Such a path means no breadcrumb; the hook itself runs on. */
    if (override && override[0]) {
        if (!ha_fits(snprintf(path, sizeof(path), "%s", override), sizeof(path))) {
            return;
        }
    } else {
        /* <cache_dir>/logs, where every cbm component logs: the cache dir is
         * CBM_CACHE_DIR, else HOME (then USERPROFILE) + the default. */
        const char *cache = cbm_resolve_cache_dir();
        char dir[CBM_SZ_1K];
        if (!cache || !ha_fits(snprintf(dir, sizeof(dir), "%s/logs", cache), sizeof(dir)) ||
            !ha_fits(snprintf(path, sizeof(path), "%s/hook-augment-timeouts.log", dir),
                     sizeof(path))) {
            return;
        }
        cbm_mkdir_p_ex(dir, 0755, CBM_MKDIR_FOLLOW_OWNED);
    }
    g_ha_crumb_fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (g_ha_crumb_fd < 0) {
        return;
    }
    int n = snprintf(g_ha_crumb_msg, sizeof(g_ha_crumb_msg),
                     "hook-augment: deadline_exceeded ms=%d pid=%ld (raise via "
                     "CBM_HOOK_DEADLINE_MS)\n",
                     deadline_ms, (long)getpid());
    g_ha_crumb_len = (n > 0 && n < (int)sizeof(g_ha_crumb_msg)) ? (size_t)n : 0;
}

int cbm_hook_augment_deadline_ms_for_testing(void) {
    return ha_deadline_ms();
}

void cbm_hook_augment_arm_deadline(void) {
    int ms = ha_deadline_ms();
    ha_open_crumb_log(ms);

    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = ha_deadline_exit;
    sigaction(SIGALRM, &sa, NULL);

    struct itimerval it;
    memset(&it, 0, sizeof(it));
    it.it_value.tv_sec = ms / 1000;
    it.it_value.tv_usec = (ms % 1000) * 1000;
    setitimer(ITIMER_REAL, &it, NULL);
}
#else
static VOID CALLBACK ha_deadline_exit_windows(PVOID context, BOOLEAN fired) {
    (void)context;
    (void)fired;
    ExitProcess(0U);
}

void cbm_hook_augment_arm_deadline(void) {
    HANDLE timer = NULL;
    (void)CreateTimerQueueTimer(&timer, NULL, ha_deadline_exit_windows, NULL, HA_DEADLINE_MS, 0U,
                                WT_EXECUTEONLYONCE);
}
#endif

/* ── stdin ────────────────────────────────────────────────────────── */

/* main() reads stdin EARLY on the hook-client path so the no-op gate can run
 * before executable-identity hashing; the consumed bytes are handed back here
 * so every downstream reader sees them exactly once. */
static char *g_ha_prefetched_stdin = NULL;

void cbm_hook_augment_prefetch_stdin(char *owned) {
    free(g_ha_prefetched_stdin);
    g_ha_prefetched_stdin = owned;
}

char *cbm_hook_augment_read_stdin(void) {
    if (g_ha_prefetched_stdin) {
        char *out = g_ha_prefetched_stdin;
        g_ha_prefetched_stdin = NULL;
        return out;
    }
    char *buf = malloc(HA_STDIN_CAP + 1);
    if (!buf) {
        return NULL;
    }
    size_t total = 0;
    size_t n;
    while (total < HA_STDIN_CAP && (n = fread(buf + total, 1, HA_STDIN_CAP - total, stdin)) > 0) {
        total += n;
    }
    buf[total] = '\0';
    return buf;
}

/* ── pattern → token ──────────────────────────────────────────────
 * Extract the longest identifier-like run ([A-Za-z_][A-Za-z0-9_]*) of at
 * least HA_MIN_TOKEN chars. Pure-identifier output means it is always safe
 * to embed in a regex (name_pattern) with no escaping. Returns false when
 * the pattern has no usable token (path globs, short/regex-only patterns) —
 * the caller then no-ops, which keeps the common cheap case cheap. */
static bool ha_extract_token(const char *pattern, char *out, size_t out_sz) {
    if (!pattern) {
        return false;
    }
    size_t best_start = 0;
    size_t best_len = 0;
    size_t i = 0;
    while (pattern[i]) {
        if (isalpha((unsigned char)pattern[i]) || pattern[i] == '_') {
            size_t start = i;
            while (pattern[i] && (isalnum((unsigned char)pattern[i]) || pattern[i] == '_')) {
                i++;
            }
            size_t len = i - start;
            if (len > best_len) {
                best_len = len;
                best_start = start;
            }
        } else {
            i++;
        }
    }
    if (best_len < HA_MIN_TOKEN) {
        return false;
    }
    if (best_len > HA_MAX_TOKEN) {
        best_len = HA_MAX_TOKEN;
    }
    if (best_len + 1 > out_sz) {
        best_len = out_sz - 1;
    }
    memcpy(out, pattern + best_start, best_len);
    out[best_len] = '\0';
    return true;
}

/* ── JSON helpers ─────────────────────────────────────────────────── */

static const char *ha_obj_str(yyjson_val *obj, const char *key) {
    yyjson_val *v = obj ? yyjson_obj_get(obj, key) : NULL;
    return (v && yyjson_is_str(v)) ? yyjson_get_str(v) : NULL;
}

static bool ha_is_utf8_continuation(unsigned char ch) {
    return (ch & 0xc0U) == 0x80U;
}

static size_t ha_utf8_sequence_length(const unsigned char *input, size_t remaining) {
    if (!input || remaining == 0U) {
        return 0U;
    }
    unsigned char first = input[0];
    if (first < 0x80U) {
        return 1U;
    }
    if (first >= 0xc2U && first <= 0xdfU) {
        return remaining >= 2U && ha_is_utf8_continuation(input[1]) ? 2U : 0U;
    }
    if (first >= 0xe0U && first <= 0xefU) {
        if (remaining < 3U || !ha_is_utf8_continuation(input[2])) {
            return 0U;
        }
        unsigned char second = input[1];
        if (first == 0xe0U) {
            return second >= 0xa0U && second <= 0xbfU ? 3U : 0U;
        }
        if (first == 0xedU) {
            return second >= 0x80U && second <= 0x9fU ? 3U : 0U;
  
```

### Core Architecture Module: `src/foundation/mem_core.c`
```
/*
 * mem_core.c — the allocation route. See mem_core.h for why it exists.
 */
#include "foundation/mem_core.h"
#include "foundation/mem.h"
#include "foundation/mem_events.h"

/* Ownership check for blocks handed back to the core (defined with cbm_free). */
static void check_owned(const void *block, const char *op);

#include "foundation/constants.h"
#include "foundation/log.h"

#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Usable-size query, per platform.
 *
 * Deliberately NOT mi_usable_size: the mimalloc global override is off on
 * macOS (permanently — the two-level namespace aborts on cross-boundary
 * frees), so a pointer from plain malloc there is not a mimalloc block and
 * mi_usable_size would be undefined behaviour on it. Each platform's own query
 * is correct under whichever allocator is actually installed, including when
 * that allocator IS mimalloc via the Linux/MinGW override. */
#if defined(CBM_BIND_TS_ALLOCATOR) && CBM_BIND_TS_ALLOCATOR
#include <mimalloc.h>
#define CBM_BACKING_MALLOC(n) mi_malloc(n)
#define CBM_BACKING_CALLOC(n) mi_calloc(CBM_ALLOC_ONE, n)
#define CBM_BACKING_REALLOC(p, n) mi_realloc(p, n)
#define CBM_BACKING_FREE(p) mi_free(p)
#define CBM_USABLE_SIZE(p) mi_usable_size((void *)(p))
#elif defined(__APPLE__)
#include <malloc/malloc.h> /* malloc_size */
#define CBM_USABLE_SIZE(p) malloc_size(p)
#elif defined(_WIN32)
#include <malloc.h> /* _msize */
#define CBM_USABLE_SIZE(p) _msize((void *)(p))
#elif defined(__GLIBC__) || defined(__linux__)
#include <malloc.h> /* malloc_usable_size */
#define CBM_USABLE_SIZE(p) malloc_usable_size((void *)(p))
#else
/* BSD and anything unknown: no portable query. Accounting then tracks the
 * REQUESTED size, which understates by the rounding. Understating is the safe
 * direction for a diagnostic (it never invents memory), and the alternative --
 * a per-block header -- costs 1.6 GB at kernel scale. */
#define CBM_USABLE_SIZE_UNAVAILABLE 1
#endif

#ifndef CBM_BACKING_MALLOC
#define CBM_BACKING_MALLOC(n) malloc(n)
#define CBM_BACKING_CALLOC(n) calloc(CBM_ALLOC_ONE, n)
#define CBM_BACKING_REALLOC(p, n) realloc(p, n)
#define CBM_BACKING_FREE(p) free(p)
#endif

enum { MEM_CORE_REPORT_MIN = 64 };

typedef struct {
    atomic_size_t live_bytes;
    atomic_size_t live_blocks;
    atomic_size_t peak_bytes;
} mem_class_stats_t;

static mem_class_stats_t g_classes[CBM_MEM_CLASS_COUNT];

static const char *const g_class_names[CBM_MEM_CLASS_COUNT] = {
    "other",   "gbuf_node", "gbuf_edge", "gbuf_string", "gbuf_index", "extract",   "arena",
    "ts_tree", "semantic",  "dump",      "store",       "hash_table", "dyn_array",
};

const char *cbm_mem_class_name(cbm_mem_class_t cls) {
    if ((int)cls < 0 || (int)cls >= CBM_MEM_CLASS_COUNT) {
        return "invalid";
    }
    return g_class_names[cls];
}

/* Out-of-range classes are folded into OTHER rather than rejected: a
 * mis-tagged allocation must still be freed correctly. Accounting accuracy is
 * worth less than not corrupting the heap. */
static mem_class_stats_t *class_slot(cbm_mem_class_t cls) {
    if ((int)cls < 0 || (int)cls >= CBM_MEM_CLASS_COUNT) {
        return &g_classes[CBM_MEM_CLASS_OTHER];
    }
    return &g_classes[cls];
}

/* ── Accounting: thread-local deltas, shared atomics on flush ──────────
 * The hot path (every allocation and free on every worker) touches only
 * thread-local memory. The shared per-class counters see one flush per
 * MEM_FLUSH_BYTES / MEM_FLUSH_BLOCKS of change per thread, or an explicit
 * cbm_mem_class_flush_thread() -- which every parallel-for worker calls when
 * its work item ends and every reader calls for its own thread first. With
 * one atomic per allocation, 18 workers on 18 cores bounced the same three
 * cache lines on every block: Kotlin CPU 38 -> 121 s for a smaller graph,
 * Go 177 -> 312 s (bench vs v0.10.8, 2026-09-14). A class's live figure can
 * lag a running worker by at most MEM_FLUSH_BYTES; the phase marks read
 * after the workers joined, so they are exact. Peaks are recorded at flush
 * and are low by at most threads x MEM_FLUSH_BYTES -- a diagnostic. */
enum { MEM_FLUSH_BYTES = 256 * 1024, MEM_FLUSH_BLOCKS = 512 };

typedef struct {
    long bytes; /* signed: allocations add, frees subtract */
    long blocks;
} mem_delta_t;

static _Thread_local mem_delta_t tl_delta[CBM_MEM_CLASS_COUNT];

/* live += delta, never wrapping below zero: a mismatched class on free (the
 * one way a caller can get this wrong) must not turn a small drift into a
 * colossal bogus number that looks like a leak. Returns the new value. */
static size_t apply_signed(atomic_size_t *counter, long delta) {
    if (delta >= 0) {
        return atomic_fetch_add_explicit(counter, (size_t)delta, memory_order_relaxed) +
               (size_t)delta;
    }
    size_t sub = (size_t)(-delta);
    size_t seen = atomic_load_explicit(counter, memory_order_relaxed);
    while (true) {
        size_t want = sub > seen ? 0 : seen - sub;
        if (atomic_compare_exchange_weak_explicit(counter, &seen, want, memory_order_relaxed,
                                                  memory_order_relaxed)) {
            return want;
        }
    }
}

static void class_flush_one(cbm_mem_class_t cls) {
    mem_delta_t *d = &tl_delta[cls];
    if (d->bytes == 0 && d->blocks == 0) {
        return;
    }
    long bytes = d->bytes;
    long blocks = d->blocks;
    d->bytes = 0;
    d->blocks = 0;
    mem_class_stats_t *st = &g_classes[cls];
    size_t now = apply_signed(&st->live_bytes, bytes);
    (void)apply_signed(&st->live_blocks, blocks);
    if (bytes > 0) {
        /* Peak is best-effort under concurrency: racing writers can leave it
         * one flush low; that never changes a decision. */
        size_t seen = atomic_load_explicit(&st->peak_bytes, memory_order_relaxed);
        while (now > seen) {
            if (atomic_compare_exchange_weak_explicit(&st->peak_bytes, &seen, now,
                                                      memory_order_relaxed, memory_order_relaxed)) {
                break;
            }
        }
    }
}

void cbm_mem_class_flush_thread(void) {
    cbm_memev_flush_thread(); /* same seam: work-item end, thread end, every reader */
    for (int i = 0; i < CBM_MEM_CLASS_COUNT; i++) {
        class_flush_one((cbm_mem_class_t)i);
    }
}

static cbm_mem_class_t class_index(cbm_mem_class_t cls) {
    return ((int)cls < 0 || (int)cls >= CBM_MEM_CLASS_COUNT) ? CBM_MEM_CLASS_OTHER : cls;
}

static void class_add(cbm_mem_class_t cls, size_t bytes, size_t blocks) {
    cls = class_index(cls);
    mem_delta_t *d = &tl_delta[cls];
    d->bytes += (long)bytes;
    d->blocks += (long)blocks;
    if (d->bytes >= MEM_FLUSH_BYTES || d->blocks >= MEM_FLUSH_BLOCKS) {
        class_flush_one(cls);
    }
}

static void class_sub(cbm_mem_class_t cls, size_t bytes, size_t blocks) {
    cls = class_index(cls);
    mem_delta_t *d = &tl_delta[cls];
    d->bytes -= (long)bytes;
    d->blocks -= (long)blocks;
    if (d->bytes <= -MEM_FLUSH_BYTES || d->blocks <= -MEM_FLUSH_BLOCKS) {
        class_flush_one(cls);
    }
}

#ifdef CBM_USABLE_SIZE_UNAVAILABLE
static size_t charge_size(const void *block, size_t requested) {
    (void)block;
    return requested;
}

size_t cbm_mem_usable_size(const void *block) {
    (void)block;
    return 0;
}
#else
static size_t charge_size(const void *block, size_t requested) {
    size_t usable = CBM_USABLE_SIZE(block);
    return usable ? usable : requested;
}

size_t cbm_mem_usable_size(const void *block) {
    if (!block) {
        return 0;
    }
    return CBM_USABLE_SIZE(block);
}
#endif

/* -- Waste-sanitizer hooks (mem_events.h) ---------------------------------
 * Compiled to nothing outside the `memwaste` flavour. The core names the
 * caller's site and the class; who REPORTS the event depends on whether an
 * observer sees the backing allocator:
 *   - backing is mimalloc called directly (CBM_BIND_TS_ALLOCATOR): no observer
 *     ever sees it, the core reports everything itself;
 *   - backing is plain malloc and an observer is installed: the observer
 *     reports, the hint hands it the site and the class;
 *   - backing is plain malloc, no observer: the core reports.
 * Frees are reported BEFORE the block goes back (see mem_events.h). */
#if defined(CBM_MEMWASTE) && CBM_MEMWASTE
static bool core_reports_frees(void) {
#if defined(CBM_BIND_TS_ALLOCATOR) && CBM_BIND_TS_ALLOCATOR
    return true;
#else
    return !cbm_memev_observer_installed();
#endif
}
#define MEMEV_HINT(cls)                                              \
    do {                                                             \
        if (cbm_memev_enabled() && !cbm_memev_hint_pending()) {      \
            cbm_memev_hint(__builtin_return_address(0), (int)(cls)); \
        }                                                            \
    } while (0)
#define MEMEV_ALLOCATED(block, bytes, flags)                                                  \
    do {                                                                                      \
        if (cbm_memev_hint_pending()) {                                                       \
            cbm_memev_alloc_ex((block), (bytes), (block) ? charge_size((block), (bytes)) : 0, \
                               NULL, (flags));                                                \
        }                                                                                     \
    } while (0)
#define MEMEV_REALLOCATED(old_block, grown, bytes)                                \
    do {                                                                          \
        if (cbm_memev_hint_pending()) {                                           \
            cbm_memev_realloc((old_block), (grown), (bytes),                      \
                              (grown) ? charge_size((grown), (bytes)) : 0, NULL); \
        }                                                                         \
    
```

### Core Architecture Module: `src/foundation/mem_core.h`
```
/*
 * mem_core.h — THE allocation route.
 *
 * Memory in this project is allocated through one core, not through ~800
 * scattered malloc/calloc/strdup sites. This header is that core;
 * foundation/mem.h remains policy and measurement (budget, RSS, pressure,
 * phase marks) and deliberately owns no allocation.
 *
 * WHY THIS EXISTS (audited 2026-09-13)
 *
 * The budget could only ever be OBSERVED, never enforced. cbm_mem_over_budget()
 * reads process RSS *after* the allocation that crossed the line already
 * succeeded, and the only available response was to nap. A thermostat wired to
 * a thermometer with no cooler attached.
 *
 * Worse, we could not even say WHERE the memory was. Two independent reasons:
 *
 *   1. cbm_mem_map_collect()'s live_bytes walks mi_theap_get_default() — THIS
 *      thread's mimalloc heap only. Walking the process-wide mi_heap_main() is
 *      a data race that TSan caught on macOS, so it is deliberately not done.
 *      An 18-worker index therefore attributes almost nothing; the rest lands
 *      in `residual`.
 *   2. The mimalloc global override is ON for Linux/MinGW and permanently OFF
 *      for macOS (the two-level namespace turns this binary's free into mi_free
 *      while system libraries keep allocating from the system zone, and a
 *      pointer crossing that boundary aborts). On macOS ordinary malloc is
 *      served by the SYSTEM allocator: the startup audit reports
 *      owned_classes=0/6. Any accounting that assumes mimalloc owns the pointer
 *      is blind on an entire platform.
 *
 * So the core keeps its OWN counters. Atomic, per class, incremented at
 * allocation and decremented at free. Thread-safe by construction, identical on
 * every platform, and independent of which allocator actually serves malloc.
 *
 * NO PER-ALLOCATION HEADER. The obvious design — a {class,size} prefix — costs
 * 16 bytes on every block, and the graph buffer makes ~100M of them at kernel
 * scale: ~1.6 GB of pure overhead to measure a memory problem. Sizes come from
 * the platform's usable-size query instead, which is exact-to-the-bucket, free,
 * and correct under either allocator.
 */
#ifndef CBM_MEM_CORE_H
#define CBM_MEM_CORE_H

#include <stdbool.h>
#include <stddef.h>

/* Allocation classes.
 *
 * A class is a BUDGETING bucket, not a type taxonomy: split only where the
 * split would change a decision. These follow the measured phase profile of a
 * kernel index (2026-09-13), where the peak was 35.20 GB and the two consumers
 * behaved differently — extraction transients scale with worker count, the
 * semantic plateau does not. Attribution that cannot separate those two cannot
 * choose between "park workers" and "stream the vectors". */
typedef enum {
    CBM_MEM_CLASS_OTHER = 0,   /* unclassified; the residual to drive down */
    CBM_MEM_CLASS_GBUF_NODE,   /* node records (~64 B each) */
    CBM_MEM_CLASS_GBUF_EDGE,   /* edge records (~48 B each) */
    CBM_MEM_CLASS_GBUF_STRING, /* name / qualified_name / properties_json */
    CBM_MEM_CLASS_GBUF_INDEX,  /* the 8 lookup indexes (383 MB peak on the Go corpus) */
    CBM_MEM_CLASS_EXTRACT,     /* per-file working set: source text, extraction scratch */
    CBM_MEM_CLASS_ARENA,       /* CBMArena blocks -- every arena, whoever owns it */
    CBM_MEM_CLASS_TS_TREE,     /* tree-sitter: parse trees + parser state (bound allocator) */
    CBM_MEM_CLASS_SEMANTIC,    /* semantic pass: vectors, token pools, LSH (87 MB on Go) */
    CBM_MEM_CLASS_DUMP,        /* dump-time transients */
    CBM_MEM_CLASS_STORE,       /* SQLite (bound mem methods) + store batches and row buffers */
    CBM_MEM_CLASS_HASH_TABLE,  /* CBMHashTable buckets/entries not claimed by an owner class */
    CBM_MEM_CLASS_DYN_ARRAY,   /* CBM_DYN_ARRAY item storage (every cbm_da_* user) */
    CBM_MEM_CLASS_COUNT
} cbm_mem_class_t;

/* Stable lowercase name, for logs and JSON. Never NULL, even out of range. */
const char *cbm_mem_class_name(cbm_mem_class_t cls);

/* ── The allocation route ──────────────────────────────────────────────
 *
 * Semantics match the C library exactly, so adoption is a mechanical rename and
 * never a behaviour change:
 *   - cbm_alloc(cls, 0) returns a non-NULL pointer that is valid to free
 *   - cbm_free(cls, NULL) is a no-op
 *   - cbm_realloc(cls, NULL, n) behaves as cbm_alloc
 *   - a failed realloc leaves the original block intact and returns NULL
 *
 * The class passed to free/realloc MUST be the class the block was allocated
 * with, or the counters drift. Pass the class through alongside the pointer,
 * the same way a custom deleter would. */
void *cbm_alloc(cbm_mem_class_t cls, size_t bytes);
void *cbm_calloc(cbm_mem_class_t cls, size_t bytes);
void *cbm_realloc(cbm_mem_class_t cls, void *block, size_t bytes);
char *cbm_mem_strdup(cbm_mem_class_t cls, const char *s);
void cbm_free(cbm_mem_class_t cls, void *block);

/* ── Accounting ────────────────────────────────────────────────────────
 *
 * live_bytes is what the ALLOCATOR handed us (usable size), so it exceeds the
 * bytes requested by the per-block rounding and is the honest number for a
 * memory budget: rounding is memory the process cannot use for anything else.
 *
 * These counters see only memory that went through this core. Everything still
 * on raw malloc is invisible here — which is the point of
 * cbm_mem_tracked_live_bytes() versus the process RSS in mem.h: the gap between
 * them IS the unmigrated surface, and it should shrink as adoption spreads. An
 * unmeasured allocation must never read as an absent one. */
/* Push this thread's pending accounting deltas to the shared counters. Every
 * reader does it for its own thread; a parallel-for worker does it when its
 * work item ends, so the phase marks (read after the join) are exact. */
void cbm_mem_class_flush_thread(void);

size_t cbm_mem_class_live_bytes(cbm_mem_class_t cls);
size_t cbm_mem_class_live_blocks(cbm_mem_class_t cls);
size_t cbm_mem_tracked_live_bytes(void);

/* Peak live bytes for a class since process start (or the last reset). The
 * budget question is always about the PEAK, never the value at the moment
 * someone happened to look. */
size_t cbm_mem_class_peak_bytes(cbm_mem_class_t cls);

/* Drop all peaks to the current live values. For a measurement run that wants
 * one phase, not the whole process history. Never resets live counters --
 * those track real outstanding blocks. */
void cbm_mem_class_reset_peaks(void);

/* JSON array of {class, live_bytes, live_blocks, peak_bytes}, biggest live
 * first, classes with no activity omitted. Returns bytes written, 0 if none. */
int cbm_mem_class_report_json(char *out, size_t size);

/* Log the class table at info level under `tag`. For phase boundaries in the
 * index pipeline, where the interesting question is which class grew. */
void cbm_mem_class_log(const char *tag);

/* Usable size of a block obtained from this core, or 0 when the platform
 * cannot answer. Exposed because the same query is what makes header-free
 * accounting possible, and callers doing their own bulk accounting (arenas)
 * need the identical definition to stay consistent with these counters. */
size_t cbm_mem_usable_size(const void *block);

/* ── Bulk accounting, for allocators that are not this one ─────────────
 *
 * The extraction engine already allocates through arenas (1301 call sites) and
 * must NOT be rewritten to per-object cbm_alloc — that would undo the very
 * batching that keeps its allocation count low. Instead an arena reports its
 * block acquisitions here, so arena-backed memory appears in the same table as
 * heap memory and the totals stay comparable.
 *
 * Symmetric: every add must be matched by a remove of the same size. */
void cbm_mem_class_add_external(cbm_mem_class_t cls, size_t bytes);
void cbm_mem_class_remove_external(cbm_mem_class_t cls, size_t bytes);

#endif /* CBM_MEM_CORE_H */

```

### Core Architecture Module: `src/foundation/str_util.c`
```
/*
 * str_util.c — Safe string operations (arena-allocated).
 */
#include "str_util.h"
#include "arena.h" // CBMArena, cbm_arena_alloc/strdup/strndup
#include "foundation/constants.h"
#include <string.h>
#include <ctype.h>
#include <stdio.h>

enum {
    JSON_ESC_LEN = 2,       /* escaped char takes 2 bytes (backslash + char) */
    JSON_NUL_RESERVE = 1,   /* reserve 1 byte for NUL terminator */
    JSON_CTRL_LIMIT = 0x20, /* ASCII control character upper bound */
};

char *cbm_path_join(CBMArena *a, const char *base, const char *name) {
    if (!base || !name) {
        return NULL;
    }
    size_t blen = strlen(base);
    size_t nlen = strlen(name);

    /* Handle empty components */
    if (blen == 0) {
        return cbm_arena_strdup(a, name);
    }
    if (nlen == 0) {
        return cbm_arena_strdup(a, base);
    }

    /* Strip trailing slash from base */
    while (blen > 0 && base[blen - SKIP_ONE] == '/') {
        blen--;
    }
    /* Strip leading slash from name */
    while (nlen > 0 && *name == '/') {
        name++;
        nlen--;
    }

    if (blen == 0) {
        return cbm_arena_strndup(a, name, nlen);
    }
    if (nlen == 0) {
        return cbm_arena_strndup(a, base, blen);
    }

    char *result = (char *)cbm_arena_alloc(a, blen + SKIP_ONE + nlen + SKIP_ONE);
    if (!result) {
        return NULL;
    }
    memcpy(result, base, blen);
    result[blen] = '/';
    memcpy(result + blen + SKIP_ONE, name, nlen);
    result[blen + SKIP_ONE + nlen] = '\0';
    return result;
}

char *cbm_path_join_n(CBMArena *a, const char **parts, int n) {
    if (n <= 0 || !parts) {
        return cbm_arena_strdup(a, "");
    }
    if (n == SKIP_ONE) {
        return cbm_arena_strdup(a, parts[0]);
    }

    char *result = cbm_arena_strdup(a, parts[0]);
    for (int i = SKIP_ONE; i < n; i++) {
        result = cbm_path_join(a, result, parts[i]);
    }
    return result;
}

const char *cbm_path_ext(const char *path) {
    if (!path) {
        return "";
    }
    const char *dot = NULL;
    const char *slash = NULL;
    for (const char *p = path; *p; p++) {
        if (*p == '.') {
            dot = p;
        }
        if (*p == '/') {
            slash = p;
        }
    }
    /* dot must be after last slash and not at start of basename */
    if (!dot) {
        return "";
    }
    if (slash && dot < slash) {
        return "";
    }
    return dot + SKIP_ONE;
}

const char *cbm_path_base(const char *path) {
    if (!path) {
        return "";
    }
    const char *last_slash = NULL;
    for (const char *p = path; *p; p++) {
        if (*p == '/') {
            last_slash = p;
        }
    }
    return last_slash ? last_slash + SKIP_ONE : path;
}

char *cbm_path_dir(CBMArena *a, const char *path) {
    if (!path) {
        return cbm_arena_strdup(a, ".");
    }
    const char *last_slash = NULL;
    for (const char *p = path; *p; p++) {
        if (*p == '/') {
            last_slash = p;
        }
    }
    if (!last_slash) {
        return cbm_arena_strdup(a, ".");
    }
    return cbm_arena_strndup(a, path, (size_t)(last_slash - path));
}

bool cbm_str_starts_with(const char *s, const char *prefix) {
    if (!s || !prefix) {
        return false;
    }
    size_t plen = strlen(prefix);
    return strncmp(s, prefix, plen) == 0;
}

bool cbm_str_ends_with(const char *s, const char *suffix) {
    if (!s || !suffix) {
        return false;
    }
    size_t slen = strlen(s);
    size_t xlen = strlen(suffix);
    if (xlen > slen) {
        return false;
    }
    return strcmp(s + slen - xlen, suffix) == 0;
}

bool cbm_str_contains(const char *s, const char *sub) {
    if (!s || !sub) {
        return false;
    }
    if (sub[0] == '\0') {
        return true;
    }
    return strstr(s, sub) != NULL;
}

char *cbm_str_tolower(CBMArena *a, const char *s) {
    if (!s) {
        return NULL;
    }
    size_t len = strlen(s);
    char *result = (char *)cbm_arena_alloc(a, len + SKIP_ONE);
    if (!result) {
        return NULL;
    }
    for (size_t i = 0; i < len; i++) {
        result[i] = (char)tolower((unsigned char)s[i]);
    }
    result[len] = '\0';
    return result;
}

char *cbm_str_replace_char(CBMArena *a, const char *s, char from, char to) {
    if (!s) {
        return NULL;
    }
    size_t len = strlen(s);
    char *result = (char *)cbm_arena_alloc(a, len + SKIP_ONE);
    if (!result) {
        return NULL;
    }
    for (size_t i = 0; i < len; i++) {
        result[i] = (s[i] == from) ? to : s[i];
    }
    result[len] = '\0';
    return result;
}

char *cbm_str_strip_ext(CBMArena *a, const char *path) {
    if (!path) {
        return NULL;
    }
    const char *dot = NULL;
    const char *slash = NULL;
    for (const char *p = path; *p; p++) {
        if (*p == '.') {
            dot = p;
        }
        if (*p == '/') {
            slash = p;
        }
    }
    if (!dot || (slash && dot < slash)) {
        return cbm_arena_strdup(a, path);
    }
    return cbm_arena_strndup(a, path, (size_t)(dot - path));
}

char **cbm_str_split(CBMArena *a, const char *s, char delim, int *out_count) {
    if (!s || !out_count) {
        return NULL;
    }

    /* Count parts */
    int count = SKIP_ONE;
    for (const char *p = s; *p; p++) {
        if (*p == delim) {
            count++;
        }
    }

    char **result = (char **)cbm_arena_alloc(a, (size_t)(count + SKIP_ONE) * sizeof(char *));
    if (!result) {
        return NULL;
    }

    int idx = 0;
    const char *start = s;
    for (const char *p = s;; p++) {
        if (*p == delim || *p == '\0') {
            size_t part_len = (size_t)(p - start);
            result[idx++] = cbm_arena_strndup(a, start, part_len);
            if (*p == '\0') {
                break;
            }
            start = p + SKIP_ONE;
        }
    }

    result[idx] = NULL;
    *out_count = count;
    return result;
}

bool cbm_validate_shell_arg(const char *s) {
    if (!s) {
        return false;
    }
    for (const char *p = s; *p; p++) {
        switch (*p) {
        case '\'':
        case '"':
        case ';':
        case '|':
        case '&':
        case '$':
        case '`':
        case '<':
        case '>':
        case '\n':
        case '\r':
#ifndef _WIN32
        case '\\':
#endif
            return false;
        default:
            break;
        }
    }
    return true;
}

bool cbm_validate_shell_path_arg(const char *path) {
    if (!cbm_validate_shell_arg(path)) {
        return false;
    }
#ifdef _WIN32
    /* cmd.exe expands %VAR% and, with delayed expansion, !VAR! inside the
     * double quotes these commands use; ^ is its escape character. None of the
     * three can be neutralised by quoting, so reject them outright. */
    for (const char *p = path; *p; p++) {
        if (*p == '%' || *p == '!' || *p == '^') {
            return false;
        }
    }
#endif
    return true;
}

bool cbm_validate_project_name(const char *name) {
    if (!name || !*name)
        return false;
    /* Reject directory traversal */
    if (strcmp(name, "..") == 0 || strstr(name, "..") != NULL)
        return false;
    /* Reject path separators */
    if (strchr(name, '/') || strchr(name, '\\'))
        return false;
    /* Reject leading dot (hidden files / relative refs) */
    if (name[0] == '.')
        return false;
    /* Allow only alphanumeric, dash, underscore, dot */
    for (const char *p = name; *p; p++) {
        if (!(((*p >= 'a') && (*p <= 'z')) || ((*p >= 'A') && (*p <= 'Z')) ||
              ((*p >= '0') && (*p <= '9')) || *p == '-' || *p == '_' || *p == '.')) {
            return false;
        }
    }
    return true;
}

bool cbm_is_internal_cache_db(const char *filename) {
    return filename && (strcmp(filename, CBM_CONFIG_DB_FILENAME) == 0 ||
                        strcmp(filename, CBM_CROSS_REPO_DB_FILENAME) == 0);
}

bool cbm_is_project_index_db(const char *filename) {
    static const char db_ext[] = ".db";
    const size_t ext_len = sizeof(db_ext) - 1;
    if (!filename) {
        return false;
    }
    size_t len = strlen(filename);
    if (len <= ext_len || strcmp(filename + len - ext_len, db_ext) != 0) {
        return false;
    }
    return !cbm_is_internal_cache_db(filename);
}

int cbm_utf8_trim_partial(char *buf) {
    if (!buf) {
        return 0;
    }
    int pos = (int)strlen(buf);
    if (pos == 0) {
        return 0;
    }
    /* Walk back over continuation bytes to the lead byte; drop the sequence
     * when fewer continuation bytes follow it than its lead byte announces. */
    int back = pos - 1;
    int cont = 0;
    while (back >= 0 && ((unsigned char)buf[back] & 0xC0) == 0x80) {
        back--;
        cont++;
    }
    if (back >= 0) {
        unsigned char lead = (unsigned char)buf[back];
        int need = lead >= 0xF0 ? 3 : lead >= 0xE0 ? 2 : lead >= 0xC0 ? 1 : 0;
        if (need > cont) {
            pos = back;
            buf[pos] = '\0';
        }
    }
    return pos;
}

int cbm_json_escape(char *buf, int bufsize, const char *src) {
    if (!buf || bufsize <= 0) {
        return 0;
    }
    if (!src) {
        buf[0] = '\0';
        return 0;
    }
    int pos = 0;
    int i = 0;
    for (; src[i] && pos < bufsize - JSON_NUL_RESERVE; i++) {
        unsigned char c = (unsigned char)src[i];
        if (c == '"' || c == '\\') {
            if (pos + JSON_ESC_LEN > bufsize - JSON_NUL_RESERVE) {
                break;
            }
            buf[pos++] = '\\';
            buf[pos++] = (char)c;
        } else if (c == '\n') {
            if (pos + JSON_ESC_LEN > bufsize - JSON_NUL_RESERVE) {
                break;
            }
            buf[pos++] = '\\';
            buf[pos++] = 'n';
        } else if (c == '\r') {
            if (pos + JSON_ESC_LEN > bufsize - JSON_NUL_RESERVE) {
                break;
            }
            buf[pos++] = '\\';
            buf[pos++] = 'r';
        } else if (c == '\t') {
            if (pos + JSON_ESC_LEN > bufsize - JSON_NUL_RESERVE) {
               
```

### Core Architecture Module: `src/foundation/str_util.h`
```
/*
 * str_util.h — Safe string operations.
 *
 * All functions that return char* allocate via the provided arena
 * (no malloc, no free needed).
 */
#ifndef CBM_STR_UTIL_H
#define CBM_STR_UTIL_H

#include "arena.h"
#include <stdbool.h>
#include <stddef.h>

/* Join two path components with '/'. Handles trailing/leading slashes. */
char *cbm_path_join(CBMArena *a, const char *base, const char *name);

/* Join N path components. parts is an array of N strings. */
char *cbm_path_join_n(CBMArena *a, const char **parts, int n);

/* Get the file extension (without dot). Returns "" if none. */
const char *cbm_path_ext(const char *path);

/* Get the base name (after last '/'). Returns path if no '/'. */
const char *cbm_path_base(const char *path);

/* Get the directory part (before last '/'). Returns "." if no '/'. */
char *cbm_path_dir(CBMArena *a, const char *path);

/* Check if string starts with prefix. */
bool cbm_str_starts_with(const char *s, const char *prefix);

/* Check if string ends with suffix. */
bool cbm_str_ends_with(const char *s, const char *suffix);

/* Check if string contains substring. */
bool cbm_str_contains(const char *s, const char *sub);

/* Convert to lowercase (arena-allocated copy). */
char *cbm_str_tolower(CBMArena *a, const char *s);

/* Replace all occurrences of 'from' char with 'to' char (arena copy). */
char *cbm_str_replace_char(CBMArena *a, const char *s, char from, char to);

/* Strip file extension: "foo.go" → "foo" (arena copy). */
char *cbm_str_strip_ext(CBMArena *a, const char *path);

/* Split string by delimiter. Returns arena-allocated array + count.
 * The array itself and all substrings are arena-allocated. */
char **cbm_str_split(CBMArena *a, const char *s, char delim, int *out_count);

/* Validate a string is safe for shell interpolation inside single quotes.
 * Rejects: ' " ; | & $ ` < > \n \r \0 (embedded NULs via len check).
 * The Windows search path wraps shell args in cmd.exe-level "powershell -Command
 * \"...'%s'...\"", so " can close the cmd.exe outer quote even if PowerShell's
 * single quotes hold; < > would then become cmd.exe redirection (file-write
 * primitive). Blocking these unconditionally hardens both POSIX and Windows.
 * Returns true if safe, false if the string contains shell metacharacters. */
bool cbm_validate_shell_arg(const char *s);

/* Validate a filesystem path that will be interpolated into a shell command.
 * Everything cbm_validate_shell_arg rejects, plus the cmd.exe expansion
 * metacharacters % ! ^ on Windows: a path reaching `git -C "%s"` through
 * cmd.exe would otherwise get %VAR% / delayed-!VAR! expansion applied to it.
 *
 * Use this — not cbm_validate_shell_arg — for every path that crosses into a
 * shell command, so the three git shell-out sites cannot drift apart again.
 * Returns true if safe. */
bool cbm_validate_shell_path_arg(const char *path);

/* Validate a project name is safe for file path construction.
 * Allows: alphanumeric, dash, underscore, dot (but not leading dot or dot-dot).
 * Rejects: path separators (/ \), directory traversal (..), and control chars.
 * Returns true if safe, false if the name could escape the cache directory. */
bool cbm_validate_project_name(const char *name);

/* Internal stores that live next to the project indexes in the cache
 * directory. They are exact filenames: a project name may itself begin with
 * "_" or contain "config", so prefix/substring filters would hide real
 * projects. */
#define CBM_CONFIG_DB_FILENAME "_config.db"
#define CBM_CROSS_REPO_DB_FILENAME "_cross_repo.db"

/* True when a cache-directory entry is one of the internal stores above. */
bool cbm_is_internal_cache_db(const char *filename);

/* True when a cache-directory entry is a project index: "<name>.db" with a
 * non-empty stem and not an internal store. The one predicate every
 * enumeration of the cache directory's .db files uses (list, count,
 * remove, cross-repo). */
bool cbm_is_project_index_db(const char *filename);

/* Safe snprintf append: clamps offset to prevent buffer overflow on truncation.
 * When snprintf truncates, it returns what it WOULD have written, which can make
 * offset > bufsize. Next call: bufsize - offset wraps unsigned → huge → overflow.
 * This macro guards against that by checking bounds before writing and clamping after.
 *
 * Usage: CBM_SNPRINTF_APPEND(buf, sizeof(buf), off, "fmt %s", arg);
 * Requires: <stdio.h> included by caller. */
#define CBM_SNPRINTF_APPEND(buf, sz, off, ...)                                       \
    do {                                                                             \
        if ((off) >= 0 && (off) < (int)(sz)) {                                       \
            int _cbm_r = snprintf((buf) + (off), (sz) - (size_t)(off), __VA_ARGS__); \
            if (_cbm_r > 0)                                                          \
                (off) += _cbm_r;                                                     \
            if ((off) >= (int)(sz))                                                  \
                (off) = (int)(sz) - 1;                                               \
        }                                                                            \
    } while (0)

/* Drop a trailing INCOMPLETE UTF-8 sequence from a NUL-terminated buffer in
 * place (a lead byte whose continuation bytes were cut off). Returns the new
 * length. Complete sequences and ASCII are left untouched. Use after any
 * byte-count truncation of text that will be stored or serialised. */
int cbm_utf8_trim_partial(char *buf);

/* Escape a string for safe embedding in JSON: escapes " \ and control chars.
 * Writes into buf (including NUL). Returns number of chars written (excl NUL).
 * If buf is too small, output is truncated but always NUL-terminated, and it
 * never ends inside a multibyte UTF-8 sequence. */
int cbm_json_escape(char *buf, int bufsize, const char *src);

#endif /* CBM_STR_UTIL_H */

```

### Core Architecture Module: `src/pipeline/worker_pool.c`
```
/*
 * worker_pool.c — Parallel-for dispatch with pthreads.
 *
 * Uses pthreads with 8MB stacks and atomic work-stealing index.
 * GCD is avoided because its worker threads have 512KB stacks,
 * which overflows on deeply nested ASTs (tree-sitter + walk_defs).
 *
 * Each worker pulls indices from a shared atomic counter — zero
 * contention, natural load balancing across heterogeneous cores.
 */
#include "foundation/mem_events.h"
#include "pipeline/worker_pool.h"
#include "foundation/constants.h"

enum { WP_TRUE = 1, WP_MIN = 1, WP_STEP = 1 };
#include "foundation/platform.h"
#include "foundation/compat_thread.h"
#include "foundation/mem_core.h"

#include <stdatomic.h>
#include <stdlib.h>

/* 8 MB stack per worker — matches main thread default.
 * Required for deep AST recursion (tree-sitter + walk_defs). */
#define CBM_WORKER_STACK_SIZE ((size_t)8 * CBM_SZ_1K * CBM_SZ_1K)

/* ── Serial fallback ─────────────────────────────────────────────── */

static void run_serial(int count, cbm_parallel_fn fn, void *ctx) {
    for (int i = 0; i < count; i++) {
        fn(i, ctx);
    }
}

/* ── pthreads backend ────────────────────────────────────────────── */

typedef struct {
    cbm_parallel_fn fn;
    void *ctx;
    _Atomic int *next_idx;
    int count;
} pthread_worker_arg_t;

#if defined(CBM_MEMWASTE) && CBM_MEMWASTE
/* Per-thread item counts, so the waste sanitizer can see an unbalanced pool:
 * workers that sat idle while one thread did the work. */
typedef struct {
    pthread_worker_arg_t *wa;
    int done;
    uint64_t ops; /* events this worker produced: the work it actually did */
} wp_counted_arg_t;

static void *pthread_worker_counted(void *arg) {
    wp_counted_arg_t *ca = arg;
    pthread_worker_arg_t *wa = ca->wa;
    uint64_t ops_before = cbm_memev_thread_ops();
    while (WP_TRUE) {
        int idx = atomic_fetch_add_explicit(wa->next_idx, WP_STEP, memory_order_relaxed);
        if (idx >= wa->count) {
            break;
        }
        wa->fn(idx, wa->ctx);
        ca->done++;
    }
    ca->ops = cbm_memev_thread_ops() - ops_before;
    cbm_mem_class_flush_thread();
    return NULL;
}
#endif

static void *pthread_worker(void *arg) {
    pthread_worker_arg_t *wa = arg;
    while (WP_TRUE) {
        int idx = atomic_fetch_add_explicit(wa->next_idx, WP_STEP, memory_order_relaxed);
        if (idx >= wa->count) {
            break;
        }
        wa->fn(idx, wa->ctx);
    }
    /* This thread ends here: hand its pending memory-class deltas to the
     * shared counters, so the phase mark that follows the join is exact. */
    cbm_mem_class_flush_thread();
    return NULL;
}

#if defined(CBM_MEMWASTE) && CBM_MEMWASTE
static void run_pthreads_counted(int count, cbm_parallel_fn fn, void *ctx, int nworkers,
                                 void *site) {
    _Atomic int next_idx = 0;
    pthread_worker_arg_t wa = {.fn = fn, .ctx = ctx, .next_idx = &next_idx, .count = count};
    cbm_thread_t *threads = cbm_alloc(CBM_MEM_CLASS_OTHER, (size_t)nworkers * sizeof(cbm_thread_t));
    wp_counted_arg_t *args = cbm_calloc(CBM_MEM_CLASS_OTHER, (size_t)nworkers * sizeof(*args));
    if (!threads || !args) {
        cbm_free(CBM_MEM_CLASS_OTHER, threads);
        cbm_free(CBM_MEM_CLASS_OTHER, args);
        run_serial(count, fn, ctx);
        return;
    }
    int started = 0;
    for (int i = 0; i < nworkers; i++) {
        args[i].wa = &wa;
        if (cbm_thread_create(&threads[i], CBM_WORKER_STACK_SIZE, pthread_worker_counted,
                              &args[i]) != 0) {
            break;
        }
        started++;
    }
    int main_done = 0;
    uint64_t main_ops_before = cbm_memev_thread_ops();
    while (WP_TRUE) {
        int idx = atomic_fetch_add_explicit(&next_idx, WP_STEP, memory_order_relaxed);
        if (idx >= count) {
            break;
        }
        fn(idx, ctx);
        main_done++;
    }
    uint64_t main_ops = cbm_memev_thread_ops() - main_ops_before;
    for (int i = 0; i < started; i++) {
        cbm_thread_join(&threads[i]);
    }
    int max_done = main_done;
    uint64_t max_ops = main_ops;
    uint64_t sum_ops = main_ops;
    for (int i = 0; i < started; i++) {
        if (args[i].done > max_done) {
            max_done = args[i].done;
        }
        if (args[i].ops > max_ops) {
            max_ops = args[i].ops;
        }
        sum_ops += args[i].ops;
    }
    int participants = started + 1;
    uint64_t balanced_max = (uint64_t)participants * (uint64_t)max_done;
    uint64_t imbalance = balanced_max > (uint64_t)count ? balanced_max - (uint64_t)count : 0;
    cbm_work_note(CBM_WORK_PARALLEL_FOR, site, (uint64_t)count, imbalance, (uint64_t)participants);
    cbm_work_note(CBM_WORK_POOL_OPS, site, sum_ops, (uint64_t)participants * max_ops - sum_ops,
                  (uint64_t)participants);
    cbm_free(CBM_MEM_CLASS_OTHER, threads);
    cbm_free(CBM_MEM_CLASS_OTHER, args);
}
#endif

static void run_pthreads(int count, cbm_parallel_fn fn, void *ctx, int nworkers) {
    _Atomic int next_idx = 0;

    pthread_worker_arg_t wa = {
        .fn = fn,
        .ctx = ctx,
        .next_idx = &next_idx,
        .count = count,
    };

    cbm_thread_t *threads = (cbm_thread_t *)malloc((size_t)nworkers * sizeof(cbm_thread_t));
    if (!threads) {
        run_serial(count, fn, ctx);
        return;
    }

    for (int i = 0; i < nworkers; i++) {
        if (cbm_thread_create(&threads[i], CBM_WORKER_STACK_SIZE, pthread_worker, &wa) != 0) {
            /* Failed to create thread — let remaining work run in main thread */
            nworkers = i;
            break;
        }
    }

    /* Main thread also participates */
    while (WP_TRUE) {
        int idx = atomic_fetch_add_explicit(&next_idx, WP_STEP, memory_order_relaxed);
        if (idx >= count) {
            break;
        }
        fn(idx, ctx);
    }

    for (int i = 0; i < nworkers; i++) {
        cbm_thread_join(&threads[i]);
    }

    free(threads);
}

/* ── Public API ──────────────────────────────────────────────────── */

void cbm_parallel_for(int count, cbm_parallel_fn fn, void *ctx, cbm_parallel_for_opts_t opts) {
    if (count <= 0 || !fn) {
        return;
    }

    /* Determine worker count */
    int nworkers = opts.max_workers;
    if (nworkers <= 0) {
        nworkers = cbm_default_worker_count(true);
    }
    if (nworkers < WP_MIN) {
        nworkers = SKIP_ONE;
    }

    /* Serial fallback: single worker or trivially small workload */
    if (nworkers <= WP_MIN || count <= WP_MIN) {
        run_serial(count, fn, ctx);
        return;
    }

#if defined(CBM_MEMWASTE) && CBM_MEMWASTE
    if (cbm_memev_enabled()) {
        run_pthreads_counted(count, fn, ctx, nworkers, __builtin_return_address(0));
        return;
    }
#endif
    run_pthreads(count, fn, ctx, nworkers);
}

```

### Core Architecture Module: `src/pipeline/worker_pool.h`
```
/*
 * worker_pool.h — Generic parallel-for dispatch.
 *
 * Backend: pthreads with 8MB stacks and atomic work-stealing index.
 * Each worker pulls from a shared counter — zero contention, natural
 * load balancing across heterogeneous cores (P/E on Apple Silicon).
 *
 * Serial fallback when count <= 1 or max_workers <= 1.
 */
#ifndef CBM_WORKER_POOL_H
#define CBM_WORKER_POOL_H

#include <stdbool.h>

/* Worker callback: called once per iteration with index [0..count-1]. */
typedef void (*cbm_parallel_fn)(int idx, void *ctx);

/* Options for parallel dispatch. */
typedef struct {
    int max_workers;     /* 0 = auto-detect from cbm_default_worker_count */
    bool force_pthreads; /* unused, kept for API compat */
} cbm_parallel_for_opts_t;

/* Dispatch `count` iterations of `fn(idx, ctx)` across worker threads.
 * Each index [0..count-1] is visited exactly once.
 * Blocks until all iterations complete.
 *
 * If count <= 0, this is a no-op.
 * If count <= 1 or workers <= 1, runs single-threaded. */
void cbm_parallel_for(int count, cbm_parallel_fn fn, void *ctx, cbm_parallel_for_opts_t opts);

#endif /* CBM_WORKER_POOL_H */

```

### Core Architecture Module: `graph-ui/@/components/ui/badge.tsx`
```
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2449** (2026-10-01): **fix(build): make prod objects follow TEST_SEAMS; stop cx tmp leak**
  *Symptoms*: Two build/test-hygiene defects.  1. Prod vendored objects ignored TEST_SEAMS (and MEMWASTE flips)  Why: CFLAGS_PROD carries $(TEST_SEAM_DEFINE), but the objects compiled once and linked into the product binary -- prod_lsp_all.o, the grammars, ts_runtime -- used GRAMMAR_CFLAGS without it. A TEST_SEAMS=1 binary therefore silently lacked the seam code inside lsp_all (ts_lsp.c budget probes), and as soon as cbm.c references a seam symbol defined in lsp_all -- the pending #1527 change adds cbm_lsp_work_steps in lsp/scope.c -- `make cbm TEST_SEAMS=1` fails to link, which breaks scripts/test.sh and the smoke/_test CI builds. Adding only the define is unsafe: none of these objects depended on $(BUILD_DIR)/.build-config, so flipping back to TEST_SEAMS=0 would link the stale seam-built lsp_all into a release binary. MEMWASTE had the same gap: its flags reach every vendored prod object through MEMWASTE_VENDOR_CFLAGS.  Fix: GRAMMAR_CFLAGS carries $(TEST_SEAM_DEFINE) (as GRAMMAR_CFLAGS_TEST already carries the define), and every prod object whose flags take a BUILD_CONFIG_SIG variable depends on the .build-config stamp: prod_%.o, prod_ts_runtime.o, prod_lsp_all.o, prod_preprocessor.o, prod_lz4.o, prod_lz4hc.o, prod_zstd.o, prod_sqlite3.o, prod_tre.o. prod_mimalloc.o and the unixcoder blob take no config variable and stay off the stamp.  Proof (macOS arm64, GNU Make 3.81): - #1527 tree, `make cbm TEST_SEAMS=1`: undefined _cbm_lsp_work_steps   (3/3). With this Makefile it links and prod_lsp

- **Issue #2448** (2026-10-04): **fix(hook-augment): log under the cache dir, never at a cut-off path**
  *Symptoms*: Why: arming the hook-augment deadline opens its breadcrumb log with O_CREAT. The path came from raw getenv("HOME") as "%s/.cache/codebase-memory-mcp/logs" in 1 KiB buffers with no length check. A HOME near 1 KiB therefore created a file at the cut-off name (".../logs/hook-augme") on every hook call, and a longer one created a cut-off directory. The hook also ignored CBM_CACHE_DIR, which every other cbm component honours for its cache and logs. The index skip log had the same defect in its CBM_INDEX_LOG override: an override longer than 1 KiB was copied in unchecked and opened "wb", which created or truncated the file at its cut-off prefix and reported that name as the run's logfile.  Fix: the breadcrumb log now resolves through cbm_resolve_cache_dir() (CBM_CACHE_DIR, else HOME, else USERPROFILE, plus the default) to <cache_dir>/logs/hook-augment-timeouts.log. Every snprintf into the 1 KiB buffers is checked, including the one for the CBM_HOOK_TIMEOUT_LOG override. A path that does not fit means no breadcrumb, and the logs directory is created only for a path that fits. The hook still exits 0 (it never fails the agent's hook call) and allocates nothing new. The CBM_INDEX_LOG override gets the same check: an override that does not fit writes no logfile and warns index.logfile_path_too_long, and the index still completes. With a normal HOME the log stays where it was.  Proof (dev binary, synthetic roots, isolated CBM_RUNTIME_DIR, no-op Bash payload on stdin; "created" = find ove
  **Post-Mortem & Fix Analysis**:
  > **Checkpoint and handover (2026-10-03 UTC)**  Published head: `8292e3e8075ee710b40a8a4fb24276424fc25068`. The remote head was verified.  The reviewed hook correction is published. Resume with the exact-head PR checks and the existing review notes before considering merge.  Hosted snapshot at 2026-10-03 21:54:00 UTC: 3 skipped, 37 success. Confirm the required checks on this exact head before treating it as ready.  No additional local build, test, lint, sanitizer, benchmark or CI runs were performed at this checkpoint, as requested. Earlier executed evidence remains historical; prepared tests and the newer source-reviewed changes must still be validated by the hosted gate.  The campaign is paused at the maintainer’s request. Local monitoring has stopped; hosted jobs remain running. No merge was performed. Thanks for reviewing this change. 

- **Issue #2447** (2026-10-04): **fix(routes): compose the Laravel 11+ withRouting api prefix into Route paths (#1146)**
  *Symptoms*: Laravel 11+ registers its route files in bootstrap/app.php through Application::configure()->withRouting(web: ..., api: ..., apiPrefix: ...) and mounts every file passed as `api:` under `apiPrefix` (default 'api'). That prefix lives in a different file than the routes, so per-file extraction -- which already composes the in-file Route::prefix()->group() chain (#952) -- minted `GET /users/me` for a route Laravel serves at `GET /api/users/me`. The Route qualified_name is the join key for cross-repo HTTP matching, so real callers of /api/... never linked, and an api route could silently merge with a same-path web route.  Fix: a small Laravel mount resolver, src/pipeline/laravel_routing.c. For each PHP file that registers a path-shaped route, both route passes (the sequential calls pass and the parallel resolver) look up the nearest ancestor bootstrap/app.php once, parse it with the PHP grammar, and, when its withRouting(api: ...) names that file, prepend the apiPrefix to every Route minted from it. Only source facts are used: an `api:` entry must be a __DIR__ / dirname(__DIR__) concatenation or a base_path() call over a string literal (single path or array), and a given apiPrefix must be a string literal. A non-literal apiPrefix, positional arguments or a `using:` callback leave the paths untouched, the `web:` file is never prefixed, and nothing is inferred from file names. The lookup keys only on the repo path and the file path, so full, incremental and delta runs compose the s

- **Issue #2446** (2026-10-04): **fix(mcp): resolve a directory project arg to its owning project (#1690)**
  *Symptoms*: An agent in a checkout whose directory name differs from the repository name (git clone .../repo_name.git some_name) could not find the indexed project. The installed skill only said "list_projects - check if project is indexed", so Codex and Copilot guessed the project from the repo name, got "project not found" and stopped using the graph. Passing the working directory did not help whenever it was not exactly the indexed root: a path was only ever turned into the path-DERIVED name, which misses a checkout indexed under an explicit name (the stored identity, see #1660) and every directory below an indexed root.  Fix: - mcp: a path-shaped project keeps the derived name when an index exists   under it (unchanged fast path); otherwise it resolves to the indexed   project whose stored root_path owns the directory. The deepest owning   root wins; two projects owning that root stay unresolved, so the   not-found error lists every project instead of guessing. Reuses the   list_projects identity reader and the canonical-path containment helpers. - mcp: the project-not-found hint says how to pick the project (the name   whose root_path contains the working directory, or that absolute   directory; never a repo or folder name), so an agent that guessed can   recover. - cli: the SKILL.md every skill client installs (Codex, Copilot and the   rest), the shared agent instructions and the Aider CLI instructions say   the same thing.  Proof (dev binary, synthetic HOME; repo_name cloned as so

- **Issue #2445** (2026-10-01): **fix(cypher): grow the OPTIONAL fallback buffer in the rel cross-join**
  *Symptoms*: An OPTIONAL MATCH with a relationship, whose start and terminal variables are not bound by an earlier MATCH and whose start node pattern matches no node, is joined in cross_join_with_rels() with an empty candidate list. That path sized its output for a single binding, but the OPTIONAL fallback then kept one row per existing binding with a plain indexed store, so every row after the first was written past the end of the allocation.  Route the fallback through binding_out_append(), the growing writer that the expansion branch of the same function and the other OPTIONAL fallbacks already use. The node-only join (cross_join_nodes) was fixed earlier by sizing its buffer for the fallback rows; the relationship variant kept the unchecked store.  Add a cypher regression test that runs such a query over four bound functions and asserts one row per function with the optional variables unbound. Before this change the test runner reported a heap-buffer-overflow in cross_join_with_rels under ASan.   

- **Issue #2277** (2026-09-28): **CBM could not start because a conflicting CBM process is active**
  *Symptoms*: ### Version  0.11.0  ### Platform  macOS (Apple Silicon)  ### Install channel  GitHub release archive / install.sh / install.ps1  ### Binary variant  standard  ### What happened, and what did you expect?  ``` codebase-memory-mcp  codebase-memory-mcp: CBM could not start because a conflicting CBM process is active (version; active version 0.10.3, build 33acca478e0bf33b6b18a54f933283231c3b5d6e997bc4a09dc69e766b988b7a; requested version 0.11.0, build 86026ffc02a6bf11dfd801d49537e83f6dd00fdd27ad01f847d5c0f983c01ef8). Close all CBM sessions and commands, then retry. ```  ### Reproduction  Codex was working on a task so I'm not sure if I have to close it first though still would be nice to kill it manually   ### Logs  ```text  ```  ### Diagnostics trajectory (memory / performance / leak issues)  ```text  ```  ### Project scale (if relevant)  _No response_  ### Confirmations  - [x] I searched existing issues and this is not a duplicate. - [x] My reproduction uses shareable code (a dummy snippet or a public OSS repository), not proprietary code.
  **Post-Mortem & Fix Analysis**:
  > The fix is up for review in #2392. Thanks again, @zakblacki!
  > Fixed on main in cb536768 (merged via #2392). The build-conflict message now names the conflicting daemon and the way out. Thank you again, @zakblacki! It'll ship in the next release.

- **Issue #2264** (2026-09-28): **Install or Upgrade throwing errors on Mac**
  *Symptoms*: ### Version  codebase-memory-mcp 0.11.0  ### Platform  macOS (Apple Silicon)  ### Install channel  GitHub release archive / install.sh / install.ps1  ### Binary variant  standard  ### What happened, and what did you expect?  ``` curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash codebase-memory-mcp installer   os:      darwin   arch:    arm64   target:  /Users/g-besoin/.local/bin/codebase-memory-mcp  Downloading codebase-memory-mcp-darwin-arm64.tar.gz... ######################################################################## 100.0% Checksum verified. Extracting... Fixing macOS code signing... Verified candidate: codebase-memory-mcp 0.11.0 codebase-memory-mcp install 0.11.0  Found 18 existing index(es). Keeping them. After install, re-index to pick up this version's improvements:   /Users/g-besoin/.cache/codebase-memory-mcp/Users-g-besoin-Documents-ChatGPT-erafik.db   /Users/g-besoin/.cache/codebase-memory-mcp/Users-g-besoin-Downloads-miza.db   /Users/g-besoin/.cache/codebase-memory-mcp/Users-g-besoin-Desktop-refratech.db   /Users/g-besoin/.cache/codebase-memory-mcp/_config.db   /Users/g-besoin/.cache/codebase-memory-mcp/Users-g-besoin-Documents-Codex-2026-09-14-files-pasted-by-the-user-these.db   /Users/g-besoin/.cache/codebase-memory-mcp/Users-g-besoin-Downloads-Errafik_x5f_Demo_x5f_Code_x5f_Dev.db   /Users/g-besoin/.cache/codebase-memory-mcp/Users-g-besoin-Documents-Codex-2026-09-14-gu.db   /Users/g-besoin/.cache/codebase-memor
  **Post-Mortem & Fix Analysis**:
  > The profile-migration fix is up for review in #2393. Thanks again, @zakblacki!
  > Fixed on main in 22784983 (merged via #2393). v0.10.8 OpenCode agent profiles are now migrated in place on upgrade, and profiles you edited yourself are still left alone. Thank you again, @zakblacki! It'll ship in the next release.

- **Issue #2256** (2026-10-04): **fix(mcp): an integer argument outside int range takes the default**
  *Symptoms*: Distilled from #1245 by @ahundt (d030c8f4), carried with `Co-authored-by`. **#1245 stays open until its distills land.**  ## The bug  `cbm_mcp_get_int_arg` read integers with `yyjson_get_int`, whose `int` cast truncates. `{"limit": 4294967297}` — 2³² + 1 — returned **1**: the low word of the value, silently, as a bound. The same reader serves `limit` and `offset` on the query tools, so an oversized page request became a page of one.  ## The fix  Read as a 64-bit signed or unsigned integer; accept only if it fits in `int`; anything outside takes the caller's default, exactly as a non-integer does. In-range values and non-integer JSON are unchanged. ~12 lines.  ## RED → GREEN  ``` mcp_get_int_arg  FAIL tests/test_mcp.c:1777: val == 1, expected 17 == 17 ``` The test now covers 2³²+1, its negative, INT_MAX+1 and INT64_MIN each returning a distinct default, and INT_MAX / INT_MIN / −7 passing through unchanged.  After: `mcp` **318 passed, 4 skipped**; `mcp cli daemon_application` **692 passed, 0 failed**.

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

### Incident Patch 1: `100ea8f3` (2026-10-04)
**Commit Message**: Merge pull request #2489 from DeusData/fix/path-alias-skip-links

fix(workspace): skip links during path-alias discovery

**File**: `src/pipeline/path_alias.c` (modified, +9/-0)
```diff
@@ -433,6 +433,15 @@ static void find_alias_files(const char *abs_dir, const char *rel_dir, alias_con
         if (cbm_pipeline_relpath_is_excluded(child_rel, excluded_dirs, excluded_count)) {
             continue;
         }
+        /* A link is not followed, as discovery does not follow one. is_dir is
+         * also true for a junction or a directory symbolic link on Windows,
+         * and either can lead out of the repository. A child whose metadata
+         * cannot be read is skipped the same way. */
+        cbm_path_info_t child_info;
+        if (cbm_path_info_utf8(child_abs, &child_info) != CBM_PATH_INFO_OK ||
+            child_info.is_symlink) {
+            continue;
+        }
         find_alias_files(child_abs, child_rel, out, count, max_count, depth + 1, excluded_dirs,
                          excluded_count);
     }
```

**File**: `tests/test_path_alias.c` (modified, +147/-0)
```diff
@@ -9,6 +9,7 @@
 #include "test_framework.h"
 #include "../src/pipeline/path_alias.h"
 #include "../src/foundation/compat.h"
+#include "../src/foundation/compat_fs.h"
 
 #include <stdarg.h>
 #include <stdio.h>
@@ -407,6 +408,148 @@ TEST(path_alias_loader_no_configs) {
     PASS();
 }
 
+/* ── Loader does not follow a linked directory ─────────────────── */
+
+/* The walk must not leave the repository through a link, as discovery does
+ * not. A config in a real subdirectory is collected; one reachable only
+ * through a link to a directory outside the tree is not. */
+TEST(path_alias_loader_skips_linked_directory) {
+#ifdef _WIN32
+    /* symlink() does not exist on Windows, and creating a symbolic link there
+     * needs a privilege an ordinary account (and the CI runner) does not hold.
+     * The Windows shape of this case is a directory junction (cmd.exe mklink
+     * /J), which this file has no cmd.exe fixture for; the junction case is
+     * not covered here. */
+    SKIP_PLATFORM("Windows: symlink() unavailable; links need a privilege");
+#else
+    char tmpl[256];
+    snprintf(tmpl, sizeof(tmpl), "/tmp/cbm_palias_link_XXXXXX");
+    char *root = cbm_mkdtemp(tmpl);
+    ASSERT_NOT_NULL(root);
+    char outside_tmpl[256];
+    snprintf(outside_tmpl, sizeof(outside_tmpl), "/tmp/cbm_palias_outside_XXXXXX");
+    char *outside = cbm_mkdtemp(outside_tmpl);
+    ASSERT_NOT_NULL(outside);
+
+    char sub[512];
+    snprintf(sub, sizeof(sub), "%s/pkg", root);
+    cbm_mkdir(sub);
+
+    char path[512];
+    snprintf(path, sizeof(path), "%s/pkg/tsconfig.json", root);
+    ASSERT_EQ(write_file(path,
+                         "{\n  \"compilerOptions\": {\n    \"paths\": {\n"
+                         "      \"@pkg/*\": [\"./src/*\"]\n    }\n  }\n}\n"),
+              0);
+    snprintf(path, sizeof(path), "%s/tsconfig.json", outside);
+    ASSERT_EQ(write_file(path,
+                         "{\n  \"compilerOptions\": {\n    \"paths\": {\n"
+                         "      \"@out/*\": [\"./src/*\"]\n    }\n  }\n}\n"),
+              0);
+
+    char link[512];
+    snprintf(link, sizeof(link), "%s/linked", root);
+    ASSERT_EQ(symlink(outside, link), 0);
+
+    cbm_path_alias_collection_t *coll = cbm_load_path_aliases(root);
+    ASSERT_NOT_NULL(coll);
+    /* Only the real subdirectory contributes a scope. */
+    ASSERT_EQ(coll->count, 1);
+    ASSERT_STR_EQ(coll->scopes[0].dir_prefix, "pkg");
+    ASSERT_NULL(cbm_path_alias_find_for_file(coll, "linked/src/x.ts"));
+    cbm_path_alias_collection_free(coll);
+
+    unlink(link);
+    snprintf(path, sizeof(path), "%s/pkg/tsconfig.json", root);
+    unlink(path);
+    snprintf(path, sizeof(path), "%s/pkg", root);
+    rmdir(path);
+    rmdir(root);
+    snprintf(path, sizeof(path), "%s/tsconfig.json", outside);
+    unlink(path);
+    rmdir(outside);
+    PASS();
+#endif
+}
+
+#ifdef _WIN32
+/* ── Loader does not follow a directory junction (Windows) ─────── */
+
+/* The Windows shape of the linked-directory case. A junction needs no
+ * privilege (a symbolic link does), and the directory listing reports it
+ * with the directory attribute, so is_dir alone would descend through it.
+ * Compiled out elsewhere: cmd.exe and junctions exist only on Windows, so
+ * this case runs on the Windows leg and nowhere else. */
+TEST(path_alias_loader_skips_junction) {
+    char root_tmpl[512];
+    char outside_tmpl[512];
+    snprintf(root_tmpl, sizeof(root_tmpl), "%s/cbm_palias_junction_XXXXXX", cbm_tmpdir());
+    snprintf(outside_tmpl, sizeof(outside_tmpl), "%s/cbm_palias_outside_XXXXXX", cbm_tmpdir());
+    char *root = cbm_mkdtemp(root_tmpl);
+    ASSERT_NOT_NULL(root);
+    char *outside = cbm_mkdtemp(outside_tmpl);
+    ASSERT_NOT_NULL(outside);
+
+    char sub[600];
+    snprintf(sub, sizeof(sub), "%s/pkg", root);
+    cbm_mkdir(sub);
+
+    char path[700];
+    snprintf(path, sizeof(path), "%s/pkg/tsconfig.json", root);
+    ASSERT_EQ(write_file(path,
+                         "{\n  \"compilerOptions\": {\n    \"paths\": {\n"
+                         "      \"@pkg/*\": [\"./src/*\"]\n    }\n  }\n}\n"),
+              0);
+    snprintf(path, sizeof(path), "%s/tsconfig.json", outside);
+    ASSERT_EQ(write_file(path,
+                         "{\n  \"compilerOptions\": {\n    \"paths\": {\n"
+                         "      \"@out/*\": [\"./src/*\"]\n    }\n  }\n}\n"),
+              0);
+
+    /* cbm_tmpdir() can expose the MSYS spelling C:/msys64/...; cmd's mklink
+     * builtin treats the slash before "msys64" as another option delimiter.
+     * Native backslashes are required only at this cmd.exe fixture boundary. */
+    char junction[600];
+    snprintf(junction, sizeof(junction), "%s/linked", root);
+    char junction_native[sizeof(junction)];
+    char outside_native[sizeof(outside_tmpl)];
+    snprintf(junction_native, sizeof(junction_native), "%s", junction);
+    snprintf(outside_native, sizeof(outside_native), "%s", outside);
+    for (char *cursor 
```

---

### Incident Patch 2: `8a7519df` (2026-10-04)
**Commit Message**: Merge pull request #2480 from DeusData/fix/setup-one-install-path

fix(setup): install through install.sh / install.ps1, one install path

**File**: `scripts/setup-windows.ps1` (modified, +90/-26)
```diff
@@ -1,5 +1,5 @@
 # codebase-memory-mcp setup script (Windows)
-# Default: download pre-built native Windows binary
+# Default: install the pre-built native Windows binary through install.ps1
 # -FromSource: build from source inside WSL (requires Go + gcc in WSL)
 
 param(
@@ -123,7 +123,7 @@ if ($Help) {
     Write-Host ""
     Write-Host "Usage: .\setup-windows.ps1 [-FromSource] [-Help]"
     Write-Host ""
-    Write-Host "  Default:      Download pre-built Windows binary"
+    Write-Host "  Default:      Download the pre-built Windows binary through install.ps1"
     Write-Host "  -FromSource:  Build from source inside WSL (requires Go 1.23+ and gcc in WSL)"
     Write-Host ""
     exit 0
@@ -225,7 +225,7 @@ if ($FromSource) {
         exit 1
     }
 
-    # Configure — WSL binary needs wsl.exe wrapper
+    # Configure -- WSL binary needs wsl.exe wrapper
     $mcpConfig = [ordered]@{
         type    = "stdio"
         command = "wsl.exe"
@@ -243,41 +243,105 @@ if ($FromSource) {
     Write-Host "    wsl.exe -- rm -rf ~/.cache/codebase-memory-mcp/"
 
 } else {
-    # --- Download pre-built native Windows binary ---
-    Write-Host "Fetching latest release..." -ForegroundColor White
-
-    $releaseUrl = "https://api.github.com/repos/$Repo/releases/latest"
-    $release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ "User-Agent" = "codebase-memory-mcp-setup" }
-    $tag = $release.tag_name
+    # --- Download + install through install.ps1 ---
+    #
+    # install.ps1 is the one implementation of "fetch a release and install
+    # it": it downloads checksums.txt next to the archive, verifies the
+    # archive's SHA-256 against it, validates the zip layout and only then
+    # runs the binary's own `install`. This script used to carry a second
+    # copy of that download, which did not keep up with the installer. It
+    # now fetches install.ps1 from the same origin and branch it is itself
+    # served from and hands over to it, so there is exactly one install path.
+    #
+    # CBM_DOWNLOAD_URL (the installers' download-base override, for local
+    # testing) also moves the installer fetch: install.ps1 is then taken from
+    # "$env:CBM_DOWNLOAD_URL/install.ps1".
+    $installerUrl = "https://raw.githubusercontent.com/$Repo/main/install.ps1"
+    if ($env:CBM_DOWNLOAD_URL) {
+        $installerUrl = $env:CBM_DOWNLOAD_URL.TrimEnd('/') + "/install.ps1"
+    }
 
-    if (-not $tag) {
-        Write-Fail "Could not determine latest release."
-        Write-Host "  Check: https://github.com/$Repo/releases"
+    # Same transport rule as install.ps1: HTTPS, or plain HTTP for a loopback
+    # authority only (the local test fixture). No redirects are followed: both
+    # origins serve the installer directly.
+    try { $installerUri = [Uri]$installerUrl } catch { $installerUri = $null }
+    $loopbackHttp = (
+        $installerUri -and $installerUri.IsAbsoluteUri -and
+        $installerUri.Scheme -eq "http" -and $installerUri.IsLoopback -and
+        [string]::IsNullOrEmpty($installerUri.UserInfo)
+    )
+    if (-not $installerUri -or -not $installerUri.IsAbsoluteUri -or
+        ($installerUri.Scheme -ne "https" -and -not $loopbackHttp) -or
+        -not [string]::IsNullOrEmpty($installerUri.UserInfo)) {
+        Write-Fail "Refusing non-HTTPS installer URL: $installerUrl"
         exit 1
     }
-    Write-Ok "Latest release: $tag"
 
-    $asset = "codebase-memory-mcp-windows-amd64.zip"
-    $downloadUrl = "https://github.com/$Repo/releases/download/$tag/$asset"
-
-    Write-Host "Downloading $asset..." -ForegroundColor White
+    # TLS 1.2+ for the fetch (older Windows PowerShell defaults to TLS 1.0,
+    # which GitHub rejects). TLS 1.3 only where schannel can negotiate it; see
+    # the note in install.ps1.
+    $protocols = [Net.SecurityProtocolType]::Tls12
+    if ([Environment]::OSVersion.Version.Build -ge 20348 -and
+        ([enum]::GetNames([Net.SecurityProtocolType]) -contains 'Tls13')) {
+        $protocols = $protocols -bor [Net.SecurityProtocolType]::Tls13
+    }
+    [Net.ServicePointManager]::SecurityProtocol = $protocols
 
-    # Create install directory
-    if (-not (Test-Path $InstallDir)) {
-        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
+    # A fresh staging directory of its own with an owner-only DACL, the
+    # way install.ps1 stages its own download. The ACL is best effort: a
+    # filesystem that cannot carry one must not fail the install.
+    $stageDir = Join-Path ([System.IO.Path]::GetTempPath()) "cbm-setup-$(Get-Random)"
+    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
+    try {
+        $stageAcl = New-Object System.Security.AccessControl.DirectorySecurity
+        $stageAcl.SetAccessRuleProtection($true, $false)
+        $stageOwner = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).User
+        $stageAcl.SetOwner($stageOwner)
+        $stageAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSyst
```

**File**: `scripts/setup.sh` (modified, +61/-65)
```diff
@@ -2,14 +2,14 @@
 set -euo pipefail
 
 # codebase-memory-mcp setup script (macOS + Linux)
-# Default: download pre-built binary from GitHub Release
+# Default: install the latest pre-built binary through install.sh
 # --from-source: build from source (requires Go + C compiler)
 
 REPO="DeusData/codebase-memory-mcp"
 INSTALL_DIR="$HOME/.local/bin"
 BINARY_NAME="codebase-memory-mcp"
 SOURCE_DIR="$HOME/.local/share/codebase-memory-mcp"
-CLEANUP_DIR=""  # set by download_binary for EXIT trap
+CLEANUP_DIR=""  # set by install_release for EXIT trap
 
 # --- Colors ---
 
@@ -43,44 +43,14 @@ for arg in "$@"; do
         --help|-h)
             echo "Usage: $0 [--from-source]"
             echo ""
-            echo "  Default:        Download pre-built binary from GitHub Release"
+            echo "  Default:        Download the pre-built binary through install.sh"
             echo "  --from-source:  Clone and build from source (requires Go 1.23+ and a C compiler)"
             exit 0
             ;;
         *) die "Unknown argument: $arg" ;;
     esac
 done
 
-# --- Platform detection ---
-
-detect_platform() {
-    local os arch
-    os=$(uname -s)
-    arch=$(uname -m)
-
-    case "$os" in
-        Darwin) os="darwin" ;;
-        Linux)  os="linux" ;;
-        *)      die "Unsupported OS: $os. Use WSL2 on Windows." ;;
-    esac
-
-    case "$arch" in
-        arm64|aarch64) arch="arm64" ;;
-        x86_64|amd64)
-            # On macOS, uname -m returns x86_64 under Rosetta even on Apple Silicon.
-            # Check the actual hardware to pick the right binary.
-            if [ "$os" = "darwin" ] && sysctl -n hw.optional.arm64 2>/dev/null | grep -q '1'; then
-                arch="arm64"
-            else
-                arch="amd64"
-            fi
-            ;;
-        *)             die "Unsupported architecture: $arch" ;;
-    esac
-
-    echo "${os}-${arch}"
-}
-
 # --- Prerequisite checks ---
 
 check_download_tool() {
@@ -133,46 +103,74 @@ check_git() {
     ok "Git found"
 }
 
-# --- Download binary ---
+# --- Download + install through install.sh ---
+#
+# install.sh is the one implementation of "fetch a release and install it": it
+# downloads checksums.txt next to the archive, verifies the archive's SHA-256
+# against it, checks the archive layout, and only then runs the binary's own
+# `install`. This script used to carry a second copy of that download,
+# which did not keep up with the installer. It now fetches install.sh from the
+# same origin and branch it is itself served from and hands over to it, so
+# there is exactly one install path.
+#
+# CBM_DOWNLOAD_URL (the installers' download-base override, for local testing)
+# also moves the installer fetch: install.sh is then taken from
+# "$CBM_DOWNLOAD_URL/install.sh".
+
+INSTALLER_URL="https://raw.githubusercontent.com/${REPO}/main/install.sh"
+if [ -n "${CBM_DOWNLOAD_URL:-}" ]; then
+    INSTALLER_URL="${CBM_DOWNLOAD_URL%/}/install.sh"
+fi
+
+# Same transport rule as install.sh: HTTPS everywhere; plain HTTP only for an
+# exact loopback authority (the local test fixture), with redirects disabled
+# there so a fixture cannot bounce the fetch to the network.
+is_loopback_http_url() {
+    [[ "$1" =~ ^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?([/?\#].*)?$ ]]
+}
 
-fetch() {
-    local url="$1" tool="$2"
-    if [ "$tool" = "curl" ]; then
-        curl -fsSL "$url"
+fetch_installer() {
+    local url="$1" destination="$2" tool="$3"
+    if is_loopback_http_url "$url"; then
+        if [ "$tool" = "curl" ]; then
+            curl -fsS --noproxy '*' --proto '=http' -o "$destination" "$url"
+        else
+            wget -q --no-proxy --max-redirect=0 -O "$destination" "$url"
+        fi
+    elif [[ "$url" == https://* ]]; then
+        if [ "$tool" = "curl" ]; then
+            curl -fsSL --max-redirs 5 --proto '=https' --proto-redir '=https' \
+                -o "$destination" "$url"
+        else
+            wget -q --https-only --max-redirect=5 -O "$destination" "$url"
+        fi
     else
-        wget -qO- "$url"
+        die "Refusing non-HTTPS installer URL: $url"
     fi
 }
 
-download_binary() {
-    local platform="$1" tool="$2"
+install_release() {
+    local tool="$1"
 
     echo ""
-    echo "${BOLD}Fetching latest release...${RESET}"
-    local tag
-    tag=$(fetch "https://api.github.com/repos/${REPO}/releases/latest" "$tool" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')
-
-    if [ -z "$tag" ]; then
-        die "Could not determine latest release. Check https://github.com/${REPO}/releases"
-    fi
-    ok "Latest release: $tag"
-
-    local asset="codebase-memory-mcp-${platform}.tar.gz"
-    local url="https://github.com/${REPO}/releases/download/${tag}/${asset}"
-
-    echo "${BOLD}Downloading ${asset}...${RESET}"
+    echo "${BOLD}Fetching install.sh...${RESET}"
     CLEANUP_DIR=$(mktemp -d)
     trap 'rm -rf "$CLEANUP_DIR"' EXIT
-    local tmpdir="$CLEANUP_DIR"
+    local installer="$CLEAN
```

**File**: `scripts/test.sh` (modified, +3/-0)
```diff
@@ -338,6 +338,9 @@ bash "$ROOT/tests/test_version_metadata_contract.sh"
 echo "=== Step 0y: VM leg verdict contract ==="
 bash "$ROOT/tests/test_vm_verdict_contract.sh"
 
+echo "=== Step 0z: setup scripts install through the installers' verified path ==="
+bash "$ROOT/tests/test_setup_scripts_contract.sh"
+
 # Verify compiler supports target arch
 verify_compiler "$CC"
 
```

**File**: `tests/test_setup_scripts_contract.sh` (added, +329/-0)
```diff
@@ -0,0 +1,329 @@
+#!/usr/bin/env bash
+# Contract: the setup scripts install through the installers' verified path.
+#
+# scripts/setup.sh and scripts/setup-windows.ps1 are the README's "Automated
+# download + install" one-liners. They used to resolve the latest release,
+# download the archive and unpack it on their own -- with none of the checks
+# install.sh and install.ps1 make before anything is installed or run:
+# checksums.txt must download, must list the archive, a hash tool must exist,
+# and the digest must match. Both setup scripts now hand the download to the
+# installer, so there is exactly ONE implementation of download + verify.
+#
+# Functional leg (macOS/Linux host): setup.sh runs against a loopback fixture
+# release built from a harmless stub "binary", in four variants. A correct
+# checksums.txt installs (file mode and `curl | bash` pipe mode); a wrong
+# digest, a missing checksums.txt and a PATH without any hash tool each stop
+# the script with a non-zero exit, nothing installed and the stub never run.
+# Everything lives in a scratch HOME under a private work directory; no real
+# release is ever downloaded or executed, and the network is unreachable for
+# the whole run (every proxy variable points at a closed loopback port; the
+# fixture is reached with --noproxy).
+#
+# Static leg (every host): setup-windows.ps1 must delegate to install.ps1,
+# must not resolve, download or unpack the release itself, must stage in a
+# fresh directory of its own (not directly under %TEMP%), must honour CBM_DOWNLOAD_URL, and must stay
+# pure ASCII (Windows PowerShell 5.1 reads a BOM-less file as ANSI). The
+# functional equivalent is the Windows VM leg, which serves the same kind of
+# fixture to install.ps1 (test-infrastructure/vm/vm-smoke.sh).
+
+set -euo pipefail
+
+ROOT="$(cd "$(dirname "$0")/.." && pwd)"
+SETUP_SH="$ROOT/scripts/setup.sh"
+SETUP_PS1="$ROOT/scripts/setup-windows.ps1"
+
+fail() {
+    echo "FAIL: $*" >&2
+    exit 1
+}
+
+# ── Static contract: scripts/setup.sh ──────────────────────────────────────
+#
+# These gate the functional leg on purpose: a setup.sh that ignores
+# CBM_DOWNLOAD_URL cannot be pointed at the fixture and would reach for the
+# real release. The contract refuses to run that script at all.
+grep -q 'CBM_DOWNLOAD_URL' "$SETUP_SH" ||
+    fail "scripts/setup.sh must honour CBM_DOWNLOAD_URL (the installers' download-base override)"
+grep -q 'install\.sh' "$SETUP_SH" ||
+    fail "scripts/setup.sh must install through install.sh"
+if grep -Eq 'tar +-[a-zA-Z]*x' "$SETUP_SH"; then
+    fail "scripts/setup.sh must not unpack the release archive itself"
+fi
+if grep -Eq 'api\.github\.com|releases/download' "$SETUP_SH"; then
+    fail "scripts/setup.sh must not resolve or download the release itself (install.sh owns that)"
+fi
+
+# ── Static contract: scripts/setup-windows.ps1 ─────────────────────────────
+if LC_ALL=C grep -n $'[^ -~\t]' "$SETUP_PS1"; then
+    fail "scripts/setup-windows.ps1 must be pure ASCII (PS 5.1 reads BOM-less files as ANSI)"
+fi
+if grep -q $'\r' "$SETUP_PS1"; then
+    fail "scripts/setup-windows.ps1 must use LF line endings in the repository"
+fi
+grep -q 'install\.ps1' "$SETUP_PS1" ||
+    fail "scripts/setup-windows.ps1 must install through install.ps1"
+grep -q 'CBM_DOWNLOAD_URL' "$SETUP_PS1" ||
+    fail "scripts/setup-windows.ps1 must honour CBM_DOWNLOAD_URL (the installers' download-base override)"
+if grep -q 'Expand-Archive' "$SETUP_PS1"; then
+    fail "scripts/setup-windows.ps1 must not unpack the release archive itself"
+fi
+if grep -Eq 'api\.github\.com|releases/download' "$SETUP_PS1"; then
+    fail "scripts/setup-windows.ps1 must not resolve or download the release itself (install.ps1 owns that)"
+fi
+if grep -q 'env:TEMP' "$SETUP_PS1"; then
+    fail "scripts/setup-windows.ps1 must stage in a fresh directory of its own, not directly under %TEMP%"
+fi
+grep -q 'GetTempPath' "$SETUP_PS1" && grep -q 'Get-Random' "$SETUP_PS1" ||
+    fail "scripts/setup-windows.ps1 must stage in a freshly created private directory (as install.ps1 does)"
+
+# No PowerShell parser is available on every host; a bracket balance over the
+# file with comments and quoted strings removed still catches a truncated or
+# mis-pasted script before the Windows leg does.
+python3 - "$SETUP_PS1" <<'PY' || fail "scripts/setup-windows.ps1 has unbalanced brackets"
+import re
+import sys
+
+text = open(sys.argv[1], encoding="ascii").read()
+text = re.sub(r"<#.*?#>", "", text, flags=re.S)
+text = re.sub(r"#[^\n]*", "", text)
+text = re.sub(r"'(?:[^']|'')*'", "''", text)
+text = re.sub(r'"(?:[^"\\`]|`.|\\.)*"', '""', text)
+for open_ch, close_ch in (("{", "}"), ("(", ")"), ("[", "]")):
+    if text.count(open_ch) != text.count(close_ch):
+        print(f"unbalanced {open_ch}{close_ch}: {text.count(open_ch)} vs {text.count(close_ch)}")
+        sys.exit(1)
+PY
+
+echo "OK: static contract (setup.sh delegates to install.sh, setup-windows.ps1 to install.ps1)"
+
+#
```

---

### Incident Patch 3: `7bb1de0e` (2026-10-04)
**Commit Message**: Merge pull request #2479 from DeusData/fix/workspace-resolved-home

fix(workspace): compare the home directory in its canonical form

**File**: `src/foundation/workspace.c` (modified, +44/-7)
```diff
@@ -6,6 +6,7 @@
 
 #include "foundation/compat.h"
 #include "foundation/compat_fs.h"
+#include "foundation/constants.h"
 #include "foundation/platform.h"
 #include "foundation/sha256.h"
 
@@ -239,6 +240,22 @@ static bool ws_is_windows_user_programs_tree(const char *path) {
     return true;
 }
 
+/* strncmp that treats "/" and "\" as the same character. On Windows a
+ * canonical path arrives with backslashes from the resolver and with forward
+ * slashes from callers that normalize, and both spell one directory. Stops at
+ * the end of either string like strncmp does. */
+static bool ws_prefix_equal(const char *a, const char *b, size_t len) {
+    for (size_t i = 0; i < len; i++) {
+        if (a[i] != b[i] && !(ws_is_sep(a[i]) && ws_is_sep(b[i]))) {
+            return false;
+        }
+        if (a[i] == '\0') {
+            break;
+        }
+    }
+    return true;
+}
+
 /* True when b is a or lives under a. Compares on a separator boundary so
  * "/a/bc" is not treated as living under "/a/b". */
 static bool ws_is_ancestor_or_equal(const char *a, const char *b) {
@@ -249,7 +266,7 @@ static bool ws_is_ancestor_or_equal(const char *a, const char *b) {
     while (la > 1 && ws_is_sep(a[la - 1])) {
         la--;
     }
-    if (strncmp(a, b, la) != 0) {
+    if (!ws_prefix_equal(a, b, la)) {
         return false;
     }
     return b[la] == '\0' || ws_is_sep(b[la]);
@@ -600,14 +617,34 @@ bool cbm_workspace_root_allowed(const char *canonical_path, const char *home_dir
 /* ── Environment helpers ──────────────────────────────────────────────────── */
 
 /* Callers should not each re-derive these; a caller that resolved the home
- * directory differently would classify the same path differently. */
+ * directory differently would classify the same path differently.
+ *
+ * The value is the CANONICAL form of $HOME (then %USERPROFILE%), through the
+ * same resolver callers apply to the path they classify. The policy compares
+ * the two byte for byte, and a home reached through a link — "/home" kept on
+ * another volume, a macOS firmlink, a HOME that is itself a link — differs
+ * from its resolved form, so the raw value would never match and the home
+ * rule would not fire. A home that cannot be resolved (it does not exist)
+ * falls back to the raw value, which is all the comparison could use anyway.
+ *
+ * Storage is per thread and recomputed on every call, as cbm_resolve_cache_dir
+ * does: no lock, a changed environment is seen at once, and the pointer stays
+ * valid until the next call on the same thread. */
 const char *cbm_workspace_home_dir(void) {
-    const char *home = getenv("HOME");
-    if (home && home[0]) {
-        return home;
+    static CBM_TLS char resolved[CBM_SZ_4K];
+    char raw[CBM_SZ_4K];
+    const char *home = cbm_safe_getenv("HOME", raw, sizeof(raw), NULL);
+    if (!home || !home[0]) {
+        home = cbm_safe_getenv("USERPROFILE", raw, sizeof(raw), NULL);
+    }
+    if (!home || !home[0]) {
+        return NULL;
+    }
+    if (!cbm_canonical_path(home, resolved, sizeof(resolved))) {
+        memcpy(resolved, raw, strlen(raw) + 1);
     }
-    home = getenv("USERPROFILE");
-    return (home && home[0]) ? home : NULL;
+    cbm_normalize_path_sep(resolved);
+    return resolved;
 }
 
 const char *cbm_workspace_cache_dir(void) {
```

**File**: `tests/test_mcp.c` (modified, +8/-2)
```diff
@@ -1963,8 +1963,14 @@ TEST(mcp_issue403_sensitive_root_stops_before_discovery_count) {
 }
 
 TEST(mcp_issue403_explicit_approval_preserves_auto_index) {
-    char *sensitive_home = th_mktempdir("cbm_mcp_403_home");
-    ASSERT_NOT_NULL(sensitive_home);
+    char *created = th_mktempdir("cbm_mcp_403_home");
+    ASSERT_NOT_NULL(created);
+    /* The session root is presented in its resolved form, as the daemon does,
+     * because the home helper hands out the resolved home: with the raw
+     * spelling the two differ on macOS (/tmp is a firmlink) and the root
+     * would pass as an ordinary one, never reaching the approval path. */
+    char sensitive_home[4096];
+    ASSERT_TRUE(cbm_canonical_path(created, sensitive_home, sizeof(sensitive_home)));
     const char *saved_home = getenv("HOME");
     char *saved_home_copy = saved_home ? strdup(saved_home) : NULL;
     cbm_setenv("HOME", sensitive_home, 1);
```

**File**: `tests/test_workspace.c` (modified, +90/-0)
```diff
@@ -9,8 +9,13 @@
 #include "test_helpers.h"
 #include "foundation/workspace.h"
 #include "foundation/compat_fs.h"
+#include "foundation/platform.h"
 #include <stdio.h>
+#include <stdlib.h>
 #include <string.h>
+#ifndef _WIN32
+#include <unistd.h>
+#endif
 
 static const char *HOME = "/Users/dev";
 static const char *CACHE = "/Users/dev/.cache/codebase-memory-mcp";
@@ -375,6 +380,89 @@ TEST(ws_manifest_approval_refuses_overbroad_requests) {
     PASS();
 }
 
+/* ── Environment helpers ────────────────────────────────────────────────── */
+
+static char *ws_env_save(const char *name) {
+    const char *value = getenv(name);
+    return value ? strdup(value) : NULL;
+}
+
+static void ws_env_restore(const char *name, char *saved) {
+    if (saved) {
+        (void)cbm_setenv(name, saved, 1);
+        free(saved);
+    } else {
+        (void)cbm_unsetenv(name);
+    }
+}
+
+/* The policy compares the home directory against canonical paths, so the
+ * helper must hand out the canonical form. A plain temp directory already
+ * shows the difference: on macOS /tmp is a firmlink to /private/tmp, and on
+ * Windows the temp path may carry a short (8.3) component. */
+TEST(ws_home_dir_is_resolved) {
+    char *created = th_mktempdir("cbm_ws_home");
+    ASSERT_NOT_NULL(created);
+    char real[256];
+    snprintf(real, sizeof(real), "%s", created);
+    char expected[4096];
+    ASSERT_TRUE(cbm_canonical_path(real, expected, sizeof(expected)));
+    cbm_normalize_path_sep(expected);
+
+    char *saved_home = ws_env_save("HOME");
+    ASSERT_EQ(cbm_setenv("HOME", real, 1), 0);
+    const char *home = cbm_workspace_home_dir();
+    bool resolved = home && strcmp(home, expected) == 0;
+    ws_env_restore("HOME", saved_home);
+    th_cleanup(real);
+
+    ASSERT_TRUE(resolved);
+    PASS();
+}
+
+/* A home directory reached through a link — "/home" kept on another volume,
+ * an account whose HOME is itself a link — is still the home directory when
+ * a caller presents its resolved path, and must be refused as such. */
+TEST(ws_linked_home_classified_as_home) {
+#ifdef _WIN32
+    /* symlink() does not exist on Windows, and creating a symbolic link there
+     * needs a privilege an ordinary account (and the CI runner) does not hold.
+     * A directory junction (cmd.exe mklink /J) is the Windows shape of the
+     * same case and would need a cmd.exe fixture; the resolution the case
+     * depends on is covered on Windows by ws_home_dir_is_resolved, and the
+     * link itself is exercised on POSIX. */
+    SKIP_PLATFORM("Windows: symlink() unavailable; links need a privilege");
+#else
+    char *created = th_mktempdir("cbm_ws_linked_home");
+    ASSERT_NOT_NULL(created);
+    char base[256];
+    snprintf(base, sizeof(base), "%s", created);
+    char real[512];
+    char link[512];
+    snprintf(real, sizeof(real), "%s/real", base);
+    snprintf(link, sizeof(link), "%s/link", base);
+    ASSERT_EQ(cbm_mkdir(real), 0);
+    ASSERT_EQ(symlink(real, link), 0);
+
+    char canonical_real[4096];
+    ASSERT_TRUE(cbm_canonical_path(real, canonical_real, sizeof(canonical_real)));
+    /* The fixture proves something only when the two spellings differ. */
+    ASSERT_TRUE(strcmp(link, canonical_real) != 0);
+
+    char *saved_home = ws_env_save("HOME");
+    ASSERT_EQ(cbm_setenv("HOME", link, 1), 0);
+    const char *home = cbm_workspace_home_dir();
+    bool resolved = home && strcmp(home, canonical_real) == 0;
+    cbm_ws_verdict_t verdict = cbm_workspace_classify_root(canonical_real, home, NULL);
+    ws_env_restore("HOME", saved_home);
+    th_cleanup(base);
+
+    ASSERT_TRUE(resolved);
+    ASSERT_EQ(verdict, CBM_WS_DENY_SENSITIVE);
+    PASS();
+#endif
+}
+
 SUITE(workspace) {
     RUN_TEST(ws_manifest_absent_is_not_an_error);
     RUN_TEST(ws_manifest_parses_entries_and_skips_comments);
@@ -396,4 +484,6 @@ SUITE(workspace) {
     RUN_TEST(ws_posix_matching_is_case_sensitive);
     RUN_TEST(ws_null_context_disables_dependent_checks);
     RUN_TEST(ws_every_verdict_has_a_reason);
+    RUN_TEST(ws_home_dir_is_resolved);
+    RUN_TEST(ws_linked_home_classified_as_home);
 }
```

---

### Incident Patch 4: `f40b1a56` (2026-10-04)
**Commit Message**: Merge pull request #2475 from DeusData/fix/regex-compile-size-budget

fix(regex): size a pattern before compiling and refuse oversized ones

**File**: `src/cypher/cypher.c` (modified, +28/-3)
```diff
@@ -2596,6 +2596,12 @@ static const char *resolve_condition_value(const cbm_condition_t *c, binding_t *
     return n->name ? n->name : "";
 }
 
+/* Set when an `=~` or inline-property pattern was refused by the regex
+ * wrapper's compile-size guard during the CURRENT execution; cbm_cypher_execute
+ * turns it into result->warning so an empty result can be told from "no such
+ * name". Reset at the start of every execution. */
+static _Thread_local bool g_cypher_regex_refused = false;
+
 /* Evaluate a comparison operator between actual and expected strings. */
 static bool eval_comparison_op(const char *op, const char *actual, const char *expected) {
     if (strcmp(op, "=") == 0) {
@@ -2606,7 +2612,11 @@ static bool eval_comparison_op(const char *op, const char *actual, const char *e
     }
     if (strcmp(op, "=~") == 0) {
         cbm_regex_t re;
-        if (cbm_regcomp(&re, expected, CBM_REG_EXTENDED | CBM_REG_NOSUB) != 0) {
+        int comp_rc = cbm_regcomp(&re, expected, CBM_REG_EXTENDED | CBM_REG_NOSUB);
+        if (comp_rc != 0) {
+            if (comp_rc == CBM_REG_ETOOBIG) {
+                g_cypher_regex_refused = true;
+            }
             return false;
         }
         int rc = cbm_regexec(&re, actual, 0, NULL, 0);
@@ -2786,13 +2796,17 @@ static bool check_inline_props(const cbm_node_t *n, const cbm_prop_filter_t *pro
         const char *actual = node_prop(n, props[i].key, store);
         if (looks_like_regex(props[i].value)) {
             cbm_regex_t re;
-            if (cbm_regcomp(&re, props[i].value, CBM_REG_EXTENDED | CBM_REG_NOSUB) == 0) {
+            int comp_rc = cbm_regcomp(&re, props[i].value, CBM_REG_EXTENDED | CBM_REG_NOSUB);
+            if (comp_rc == 0) {
                 bool matched = cbm_regexec(&re, actual, 0, NULL, 0) == 0;
                 cbm_regfree(&re);
                 if (!matched) {
                     return false;
                 }
             } else if (strcmp(actual, props[i].value) != 0) {
+                if (comp_rc == CBM_REG_ETOOBIG) {
+                    g_cypher_regex_refused = true;
+                }
                 return false;
             }
         } else if (strcmp(actual, props[i].value) != 0) {
@@ -5565,6 +5579,7 @@ int cbm_cypher_execute(cbm_store_t *store, const char *query, const char *projec
     g_cypher_depth_clamped = 0;
     g_cypher_trail_truncated = 0;
     g_cypher_truncated = false;
+    g_cypher_regex_refused = false;
     cypher_deadline_arm(); /* #601: start the wall-clock budget for this query */
     /* max_rows sizes the initial binding array: non-positive means the
      * ceiling, and nothing above the ceiling is ever materialized anyway. */
@@ -5654,8 +5669,8 @@ int cbm_cypher_execute(cbm_store_t *store, const char *query, const char *projec
     /* Any internal ceiling that prevented exhaustive evaluation: a candidate or
      * traversal budget, or a variable-length range clamped to the engine cap. */
     out->truncated = g_cypher_truncated || g_cypher_trail_truncated != 0;
+    char wbuf[CBM_SZ_512] = "";
     if (g_cypher_depth_clamped > 0 || g_cypher_trail_truncated) {
-        char wbuf[CBM_SZ_256];
         if (g_cypher_depth_clamped > 0 && g_cypher_trail_truncated) {
             snprintf(wbuf, sizeof(wbuf),
                      "variable-length hop range clamped to the engine ceiling (%d) and "
@@ -5670,6 +5685,16 @@ int cbm_cypher_execute(cbm_store_t *store, const char *query, const char *projec
             snprintf(wbuf, sizeof(wbuf),
                      "variable-length traversal budget was exhausted — results may be partial");
         }
+    }
+    /* A refused `=~` or property pattern matched nothing: say so, once per
+     * query, next to any traversal warning. */
+    if (g_cypher_regex_refused) {
+        size_t used = strlen(wbuf);
+        snprintf(wbuf + used, sizeof(wbuf) - used,
+                 "%sa =~ or property " CBM_REG_ETOOBIG_REASON " — the comparison matched nothing",
+                 used ? "; " : "");
+    }
+    if (wbuf[0]) {
         out->warning = heap_strdup(wbuf);
     }
 
```

**File**: `src/foundation/compat_regex.c` (modified, +250/-0)
```diff
@@ -3,12 +3,254 @@
  *
  * POSIX: direct wrappers around <regex.h>.
  * Windows: vendored TRE regex library (BSD-licensed).
+ *
+ * Both backends expand bounded repetition at compile time, so cbm_regcomp
+ * sizes a pattern first (the compile-size guard below) and refuses one whose
+ * compiled form would be too large, before the platform compiler allocates
+ * anything.
  */
 #include "foundation/constants.h"
 #include "foundation/compat_regex.h"
 
+#include <stdbool.h>
+#include <stdint.h>
 #include <string.h>
 
+/* ── Compile-size guard (shared by both backends) ─────────────────
+ *
+ * The platform compilers expand `X{m,n}` into n copies of X, so nested
+ * intervals multiply: `((((a){20}){20}){20}){20}` is 160,000 expanded atoms
+ * from 25 bytes of pattern. A K-way alternation additionally costs about K^2
+ * position-set entries on the TRE-derived backends (macOS libc and the vendored
+ * TRE), because every union node copies its branches' sets.
+ *
+ * Measured on macOS libc with REG_EXTENDED|REG_NOSUB: the nested shape costs
+ * about 0.6 KB of heap per expanded atom, 1.1 KB with submatch tracking on,
+ * 1.7 KB with REG_ICASE and 2.3 KB with both; a K-way alternation adds about
+ * 70 B x K^2 on top of its branches (twice that under REG_ICASE), and an
+ * alternation under an interval pays that for every copy, about 1 KB per unit
+ * with REG_NOSUB and 2.8 KB with REG_ICASE plus submatches. glibc costs about
+ * 0.45 KB per atom and expands intervals the same way.
+ *
+ * cbm_regcomp_estimate_units() counts expanded atoms in one linear pass with
+ * saturating arithmetic and charges a K-way alternation K^2/8 units, the
+ * measured ratio between the two costs. With CBM_REGEX_COMPILE_BUDGET_UNITS =
+ * 32768 the heaviest accepted compile is a repeated alternation at about 30 MB
+ * with REG_NOSUB and about 90 MB under the ICASE-plus-submatch flag set no
+ * call site uses; the nested shape tops out at 13^4 = 28,561 units, about
+ * 16 MB. `(\w{1,100}){1,20}` (2,000 units) and an alternation of 500 short
+ * names (31,250 units plus its letters) remain accepted. */
+
+enum { REGEX_GROUP_DEPTH_MAX = 64 };
+
+typedef struct {
+    uint64_t total;    /* units of this group so far; includes `last` */
+    uint64_t last;     /* units of the element a following quantifier applies to */
+    uint64_t branches; /* alternatives in this group: 1 + the number of '|' */
+} regex_frame_t;
+
+static uint64_t regex_sat_add(uint64_t a, uint64_t b) {
+    return a > UINT64_MAX - b ? UINT64_MAX : a + b;
+}
+
+static uint64_t regex_sat_mul(uint64_t a, uint64_t b) {
+    if (a == 0 || b == 0) {
+        return 0;
+    }
+    return a > UINT64_MAX / b ? UINT64_MAX : a * b;
+}
+
+static void regex_frame_atom(regex_frame_t *f, uint64_t units) {
+    f->total = regex_sat_add(f->total, units);
+    f->last = units;
+}
+
+/* An interval applies to the last element: n copies of it replace the one. */
+static void regex_frame_repeat_last(regex_frame_t *f, uint64_t copies) {
+    uint64_t grown = regex_sat_mul(f->last, copies);
+    f->total = regex_sat_add(f->total - f->last, grown);
+    f->last = grown;
+}
+
+/* Units a closed group contributes to its parent: its content plus the K^2/8
+ * alternation share, never less than one atom. */
+static uint64_t regex_frame_units(const regex_frame_t *f) {
+    uint64_t alternation = regex_sat_mul(f->branches, f->branches) / 8;
+    uint64_t units = regex_sat_add(f->total, alternation);
+    return units ? units : 1;
+}
+
+/* Skip the bracket expression opening at p[i] == '['. Returns the index just
+ * past its closing ']', or the end of the string when it is unterminated.
+ * Nothing inside is an operator: `[]a]`, `[^]a]` and `[[:alpha:]]` are each
+ * one atom, and a brace inside brackets never opens an interval. */
+static size_t regex_skip_bracket(const char *p, size_t i) {
+    size_t j = i + 1;
+    if (p[j] == '^') {
+        j++;
+    }
+    if (p[j] == ']') {
+        j++;
+    }
+    while (p[j] && p[j] != ']') {
+        if (p[j] == '[' && (p[j + 1] == ':' || p[j + 1] == '=' || p[j + 1] == '.')) {
+            char close = p[j + 1];
+            size_t k = j + 2;
+            while (p[k] && !(p[k] == close && p[k + 1] == ']')) {
+                k++;
+            }
+            j = p[k] ? k + 2 : k;
+        } else {
+            j++;
+        }
+    }
+    return p[j] ? j + 1 : j;
+}
+
+static bool regex_parse_digits(const char *p, size_t *i, uint64_t *value) {
+    bool any = false;
+    *value = 0;
+    while (p[*i] >= '0' && p[*i] <= '9') {
+        *value = regex_sat_add(regex_sat_mul(*value, 10), (uint64_t)(p[*i] - '0'));
+        (*i)++;
+        any = true;
+    }
+    return any;
+}
+
+/* Parse the interval body that starts at p[i], just past the opening brace
+ * (`{` in extended syntax, `\{` in basic). On success stores the number of
+ * copies the compiler will make (the upper bound, or the lower bound for
+ * `{m,}`, at least 1) and the index just past the cl
```

**File**: `src/foundation/compat_regex.h` (modified, +37/-1)
```diff
@@ -11,6 +11,7 @@
 
 #include "foundation/constants.h"
 #include <stddef.h>
+#include <stdint.h>
 
 /* ── Flags ────────────────────────────────────────────────────── */
 
@@ -23,6 +24,29 @@
 
 #define CBM_REG_OK 0
 #define CBM_REG_NOMATCH (-1)
+/* cbm_regcomp refused the pattern before compiling it: longer than
+ * CBM_REGEX_PATTERN_MAX_BYTES, or its compiled form would exceed
+ * CBM_REGEX_COMPILE_BUDGET_UNITS (see cbm_regcomp_estimate_units). Well above
+ * every platform compile error code, which are small positive integers. */
+#define CBM_REG_ETOOBIG 100
+/* Reason text for a CBM_REG_ETOOBIG refusal, for user-facing error messages. */
+#define CBM_REG_ETOOBIG_REASON \
+    "regex pattern too large to compile: reduce nested {m,n} repetition or alternation"
+
+/* ── Compile-size guard ───────────────────────────────────────── */
+
+enum {
+    /* Longest pattern cbm_regcomp hands to the platform compiler. Bounds only
+     * the sizing pass: a pattern without repetition costs one unit per atom,
+     * so the unit budget below already bounds its compiled size. Equal to the
+     * budget, so a realistic pattern is only ever refused for its cost. */
+    CBM_REGEX_PATTERN_MAX_BYTES = CBM_SZ_32K,
+    /* Largest estimated compiled size, in units of one expanded atom, that
+     * cbm_regcomp accepts. Bounds what bounded repetition and alternation can
+     * expand a pattern into. compat_regex.c documents the measured bytes per
+     * unit and what the budget admits. */
+    CBM_REGEX_COMPILE_BUDGET_UNITS = CBM_SZ_32K
+};
 
 /* ── Types ────────────────────────────────────────────────────── */
 
@@ -40,9 +64,21 @@ typedef struct {
 
 /* ── Functions ────────────────────────────────────────────────── */
 
-/* Compile a regular expression. Returns CBM_REG_OK on success, non-zero on error. */
+/* Compile a regular expression. Returns CBM_REG_OK on success, non-zero on error:
+ * CBM_REG_ETOOBIG when the pattern is refused before compilation (nothing to
+ * free), otherwise the platform compiler's error code. */
 int cbm_regcomp(cbm_regex_t *r, const char *pattern, int flags);
 
+/* Estimated size of the compiled form of pattern, in units of one expanded
+ * atom: an atom costs 1, concatenation and alternation add, a group costs its
+ * content, and an interval `{m}`, `{m,}`, `{m,n}` multiplies the element it
+ * applies to by the number of copies the compiler makes (the upper bound; m for
+ * `{m,}`; at least 1), so nested intervals multiply. `*`, `+` and `?` do not
+ * multiply. A K-way alternation adds K*K/8 for its position sets. Arithmetic
+ * saturates at UINT64_MAX; a group nesting deeper than the pass tracks returns
+ * UINT64_MAX. Honors CBM_REG_EXTENDED (basic syntax otherwise). */
+uint64_t cbm_regcomp_estimate_units(const char *pattern, int flags);
+
 /* Execute compiled regex against str. nmatch/matches may be 0/NULL.
  * eflags: 0 or combination of platform-specific exec flags.
  * Returns CBM_REG_OK on match, CBM_REG_NOMATCH on no match. */
```

**File**: `src/mcp/mcp.c` (modified, +44/-20)
```diff
@@ -5339,8 +5339,11 @@ static char *handle_search_graph(cbm_mcp_server_t *srv, const char *args) {
                        max_degree != CBM_NOT_FOUND;
     bool semantic_only = sq_present && !has_filters;
     cbm_search_output_t out = {0};
-    if (!semantic_only) {
-        (void)cbm_store_search(store, &params, &out);
+    char search_error[CBM_SZ_512] = "";
+    if (!semantic_only && cbm_store_search(store, &params, &out) != CBM_STORE_OK) {
+        /* A refused or invalid regex aborts the row scan inside SQLite; the
+         * store's reason is the caller's only hint about the pattern. */
+        snprintf(search_error, sizeof(search_error), "search_graph: %s", cbm_store_error(store));
     }
 
     const char *diagnostic_hint = NULL;
@@ -5420,7 +5423,9 @@ static char *handle_search_graph(cbm_mcp_server_t *srv, const char *args) {
     free(file_pattern);
     free(relationship);
 
-    char *result = cbm_mcp_text_result(payload ? payload : "out of memory", payload == NULL);
+    char *result = search_error[0]
+                       ? cbm_mcp_text_result(search_error, true)
+                       : cbm_mcp_text_result(payload ? payload : "out of memory", payload == NULL);
     free(payload);
     return result;
 }
@@ -14965,12 +14970,16 @@ static bool search_scratch_open(search_scratch_t *scratch, const char *parent,
     return true;
 }
 
-/* Compile a path filter regex. Returns true if compiled successfully. */
-static bool compile_path_filter(const char *filter, cbm_regex_t *re) {
+/* Compile a path filter regex. Returns true when *re holds the compiled filter.
+ * An absent or empty filter compiles nothing and reports CBM_REG_OK in *rc; a
+ * filter the regex wrapper refuses or cannot compile reports its error there. */
+static bool compile_path_filter(const char *filter, cbm_regex_t *re, int *rc) {
+    *rc = CBM_REG_OK;
     if (!filter || !filter[0]) {
         return false;
     }
-    return cbm_regcomp(re, filter, CBM_REG_EXTENDED | CBM_REG_NOSUB) == CBM_REG_OK;
+    *rc = cbm_regcomp(re, filter, CBM_REG_EXTENDED | CBM_REG_NOSUB);
+    return *rc == CBM_REG_OK;
 }
 
 static mcp_scan_cause_t mcp_run_shell_command_cancellable_bounded(
@@ -15128,7 +15137,8 @@ static char *handle_search_code(cbm_mcp_server_t *srv, const char *args) {
     size_t byte_budget = (size_t)max_output_tokens * (size_t)MCP_OUTPUT_BYTES_PER_TOKEN_ESTIMATE;
 
     cbm_regex_t path_regex;
-    bool has_path_filter = compile_path_filter(path_filter, &path_regex);
+    int path_filter_rc = CBM_REG_OK; /* reported with the regex probe below */
+    bool has_path_filter = compile_path_filter(path_filter, &path_regex, &path_filter_rc);
     free(path_filter);
     path_filter = NULL;
 
@@ -15183,21 +15193,35 @@ static char *handle_search_code(cbm_mcp_server_t *srv, const char *args) {
      * unclosed group) makes the underlying grep fail, which the handler would
      * otherwise report as an empty result set — indistinguishable from a
      * legitimate no-match. Validate the user's regex up front and return an
-     * explicit error so callers can tell "broken pattern" from "no matches". */
-    if (use_regex) {
+     * explicit error so callers can tell "broken pattern" from "no matches".
+     * A path_filter the regex wrapper refused or could not compile is reported
+     * the same way instead of silently searching unfiltered. */
+    const char *regex_error = NULL;
+    if (path_filter_rc != CBM_REG_OK) {
+        regex_error = path_filter_rc == CBM_REG_ETOOBIG
+                          ? "path_filter: " CBM_REG_ETOOBIG_REASON
+                          : "invalid path_filter regex: check for unbalanced (), [], or {}";
+    } else if (use_regex) {
         cbm_regex_t probe;
-        if (cbm_regcomp(&probe, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB) != CBM_REG_OK) {
-            if (has_path_filter) {
-                cbm_regfree(&path_regex);
-            }
-            free(root_path);
-            free(pattern);
-            free(project);
-            free(file_pattern);
-            return cbm_mcp_text_result(
-                "invalid regex pattern (regex=true): check for unbalanced (), [], or {}", true);
+        int probe_rc = cbm_regcomp(&probe, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB);
+        if (probe_rc != CBM_REG_OK) {
+            regex_error =
+                probe_rc == CBM_REG_ETOOBIG
+                    ? CBM_REG_ETOOBIG_REASON " (regex=true)"
+                    : "invalid regex pattern (regex=true): check for unbalanced (), [], or {}";
+        } else {
+            cbm_regfree(&probe);
+        }
+    }
+    if (regex_error) {
+        if (has_path_filter) {
+            cbm_regfree(&path_regex);
         }
-        cbm_regfree(&probe);
+        free(root_path);
+        free(pattern);
+        free(project);
+        free(file_pattern);
+        return cbm_mcp_text_result(regex_error, true);
     }
 
     /* ── Phase 0.5: Multi-word → regex conversion ───────────── */
```

**File**: `src/store/store.c` (modified, +10/-4)
```diff
@@ -736,9 +736,12 @@ static void sqlite_regexp(sqlite3_context *ctx, int argc, sqlite3_value **argv)
             sqlite3_result_error_nomem(ctx);
             return;
         }
-        if (cbm_regcomp(re, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB) != 0) {
+        int rc = cbm_regcomp(re, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB);
+        if (rc != 0) {
             free(re);
-            sqlite3_result_error(ctx, "invalid regex", CBM_NOT_FOUND);
+            sqlite3_result_error(ctx,
+                                 rc == CBM_REG_ETOOBIG ? CBM_REG_ETOOBIG_REASON : "invalid regex",
+                                 CBM_NOT_FOUND);
             return;
         }
         sqlite3_set_auxdata(ctx, 0, re, regex_free_cb);
@@ -764,9 +767,12 @@ static void sqlite_iregexp(sqlite3_context *ctx, int argc, sqlite3_value **argv)
             sqlite3_result_error_nomem(ctx);
             return;
         }
-        if (cbm_regcomp(re, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB | CBM_REG_ICASE) != 0) {
+        int rc = cbm_regcomp(re, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB | CBM_REG_ICASE);
+        if (rc != 0) {
             free(re);
-            sqlite3_result_error(ctx, "invalid regex", CBM_NOT_FOUND);
+            sqlite3_result_error(ctx,
+                                 rc == CBM_REG_ETOOBIG ? CBM_REG_ETOOBIG_REASON : "invalid regex",
+                                 CBM_NOT_FOUND);
             return;
         }
         sqlite3_set_auxdata(ctx, 0, re, regex_free_cb);
```

**File**: `tests/test_cypher.c` (modified, +38/-0)
```diff
@@ -1536,6 +1536,43 @@ TEST(cypher_exec_where_regex) {
     PASS();
 }
 
+/* An `=~` pattern over the regex wrapper's compile-size budget is refused
+ * before the platform compiler expands it; the comparison then matches nothing,
+ * as for any pattern that cannot be compiled, the result carries a warning
+ * naming the reason, and the engine keeps answering. The pattern is a 509-way
+ * alternation whose first branch is `.`: once compiled it matches every name,
+ * and it costs 509 + 509*509/8 = 32,894 units, just over the budget. */
+TEST(cypher_exec_where_regex_oversized_pattern_matches_nothing) {
+    cbm_store_t *s = setup_cypher_store();
+    cbm_cypher_result_t r = {0};
+
+    char query[1200];
+    char *w = query;
+    w += snprintf(w, sizeof(query), "MATCH (f:Function) WHERE f.name =~ \"(.");
+    for (int i = 0; i < 508; i++) {
+        *w++ = '|';
+        *w++ = (char)('a' + i % 26);
+    }
+    snprintf(w, (size_t)(query + sizeof(query) - w), ")\"");
+
+    int rc = cbm_cypher_execute(s, query, "test", 0, &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 0);
+    ASSERT_NOT_NULL(r.warning);
+    ASSERT_NOT_NULL(strstr(r.warning, "too large to compile"));
+    cbm_cypher_result_free(&r);
+
+    cbm_cypher_result_t r2 = {0};
+    rc = cbm_cypher_execute(s, "MATCH (f:Function) WHERE f.name =~ \".*Order.*\"", "test", 0, &r2);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r2.row_count, 3);
+    ASSERT_NULL(r2.warning);
+    cbm_cypher_result_free(&r2);
+
+    cbm_store_close(s);
+    PASS();
+}
+
 TEST(cypher_exec_where_contains) {
     cbm_store_t *s = setup_cypher_store();
     cbm_cypher_result_t r = {0};
@@ -5045,6 +5082,7 @@ SUITE(cypher) {
     RUN_TEST(cypher_exec_varlength_path_semantics_issue797);
     RUN_TEST(cypher_exec_where_coalesce_issue874);
     RUN_TEST(cypher_exec_where_regex);
+    RUN_TEST(cypher_exec_where_regex_oversized_pattern_matches_nothing);
     RUN_TEST(cypher_exec_where_contains);
     RUN_TEST(cypher_exec_where_starts_with);
     RUN_TEST(cypher_exec_return_properties);
```

**File**: `tests/test_mcp.c` (modified, +83/-0)
```diff
@@ -11402,6 +11402,87 @@ TEST(search_code_path_filter_matches_nothing) {
     PASS();
 }
 
+/* An over-budget regex is refused by the wrapper before the platform compiler
+ * expands it. search_code reports that as a tool error naming the argument and
+ * the reason, for path_filter and for a regex=true pattern alike, and keeps
+ * answering afterwards. The pattern is 14^4 = 38,416 expanded atoms: over the
+ * 32,768-unit budget, and tens of MB to hold even when unguarded. */
+TEST(search_code_oversized_path_filter_is_tool_error) {
+    char tmp[512], src_path[768], vendor_path[768];
+    cbm_mcp_server_t *srv = setup_prefilter_server(tmp, sizeof(tmp), src_path, sizeof(src_path),
+                                                   vendor_path, sizeof(vendor_path));
+    ASSERT_NOT_NULL(srv);
+
+    char *resp = cbm_mcp_server_handle(
+        srv, "{\"jsonrpc\":\"2.0\",\"id\":97,\"method\":\"tools/call\","
+             "\"params\":{\"name\":\"search_code\","
+             "\"arguments\":{\"pattern\":\"HandleRequest\",\"project\":\"prefilter-search\","
+             "\"path_filter\":\"((((a){14}){14}){14}){14}\"}}}");
+    ASSERT_NOT_NULL(resp);
+    ASSERT_NOT_NULL(strstr(resp, "\"isError\":true"));
+    ASSERT_NOT_NULL(strstr(resp, "path_filter"));
+    ASSERT_NOT_NULL(strstr(resp, "too large to compile"));
+    free(resp);
+
+    resp = cbm_mcp_server_handle(
+        srv, "{\"jsonrpc\":\"2.0\",\"id\":98,\"method\":\"tools/call\","
+             "\"params\":{\"name\":\"search_code\","
+             "\"arguments\":{\"pattern\":\"((((a){14}){14}){14}){14}\",\"regex\":true,"
+             "\"project\":\"prefilter-search\"}}}");
+    ASSERT_NOT_NULL(resp);
+    ASSERT_NOT_NULL(strstr(resp, "\"isError\":true"));
+    ASSERT_NOT_NULL(strstr(resp, "too large to compile"));
+    ASSERT_NOT_NULL(strstr(resp, "regex=true"));
+    free(resp);
+
+    /* The server still answers an ordinary filtered call. */
+    resp = cbm_mcp_server_handle(
+        srv, "{\"jsonrpc\":\"2.0\",\"id\":99,\"method\":\"tools/call\","
+             "\"params\":{\"name\":\"search_code\","
+             "\"arguments\":{\"pattern\":\"HandleRequest\",\"project\":\"prefilter-search\","
+             "\"path_filter\":\"^src/\"}}}");
+    ASSERT_NOT_NULL(resp);
+    ASSERT_TRUE(strstr(resp, "\"isError\":true") == NULL);
+    char *inner = extract_text_content(resp);
+    ASSERT_NOT_NULL(inner);
+    ASSERT_NOT_NULL(strstr(inner, "src/handler.go"));
+    free(inner);
+    free(resp);
+    cbm_mcp_server_free(srv);
+    cleanup_prefilter_dir(tmp, src_path, vendor_path);
+    PASS();
+}
+
+/* search_graph compiles name_pattern inside SQLite's REGEXP function. An
+ * over-budget pattern is refused there, the row scan aborts, and the tool
+ * reports the reason as a tool error instead of an empty result. The next call
+ * answers normally. */
+TEST(search_graph_oversized_name_pattern_is_tool_error) {
+    char tmp[512], src_path[768], vendor_path[768];
+    cbm_mcp_server_t *srv = setup_prefilter_server(tmp, sizeof(tmp), src_path, sizeof(src_path),
+                                                   vendor_path, sizeof(vendor_path));
+    ASSERT_NOT_NULL(srv);
+
+    char *resp = cbm_mcp_handle_tool(
+        srv, "search_graph",
+        "{\"project\":\"prefilter-search\",\"name_pattern\":\"((((a){14}){14}){14}){14}\"}");
+    ASSERT_NOT_NULL(resp);
+    ASSERT_NOT_NULL(strstr(resp, "\"isError\":true"));
+    ASSERT_NOT_NULL(strstr(resp, "too large to compile"));
+    free(resp);
+
+    resp = cbm_mcp_handle_tool(
+        srv, "search_graph",
+        "{\"project\":\"prefilter-search\",\"name_pattern\":\"^HandleRequest$\"}");
+    ASSERT_NOT_NULL(resp);
+    ASSERT_TRUE(strstr(resp, "\"isError\":true") == NULL);
+    ASSERT_NOT_NULL(strstr(resp, "HandleRequest"));
+    free(resp);
+    cbm_mcp_server_free(srv);
+    cleanup_prefilter_dir(tmp, src_path, vendor_path);
+    PASS();
+}
+
 TEST(search_code_file_pattern_prefilter_boundaries) {
     ASSERT_TRUE(cbm_search_code_file_pattern_can_prefilter("*.pas"));
     ASSERT_TRUE(cbm_search_code_file_pattern_can_prefilter("*.PAS"));
@@ -22393,6 +22474,8 @@ SUITE(mcp) {
     RUN_TEST(search_code_path_filter_prefilter_keeps_matches);
     RUN_TEST(search_code_long_line_does_not_invent_matches);
     RUN_TEST(search_code_path_filter_matches_nothing);
+    RUN_TEST(search_code_oversized_path_filter_is_tool_error);
+    RUN_TEST(search_graph_oversized_name_pattern_is_tool_error);
     RUN_TEST(search_code_file_pattern_prefilter_boundaries);
     RUN_TEST(search_code_windows_scope_prefilter_removes_pipeline_filter);
     RUN_TEST(search_code_cancel_cleans_supervised_scan);
```

**File**: `tests/test_platform.c` (modified, +234/-0)
```diff
@@ -4,6 +4,7 @@
 #include "test_framework.h"
 #include "../src/foundation/compat.h" /* cbm_setenv / cbm_unsetenv (Windows-portable) */
 #include "../src/foundation/compat_fs.h"
+#include "../src/foundation/compat_regex.h"
 #include "../src/foundation/constants.h"
 #include "../src/foundation/compat_thread.h"
 #include "../src/foundation/platform.h"
@@ -1158,6 +1159,234 @@ TEST(cgroup_no_mem_files) {
 
 #endif /* __linux__ */
 
+/* ── compat_regex: compile-size guard ──────────────────────────── */
+
+static uint64_t regex_units_ere(const char *pattern) {
+    return cbm_regcomp_estimate_units(pattern, CBM_REG_EXTENDED);
+}
+
+static uint64_t regex_units_bre(const char *pattern) {
+    return cbm_regcomp_estimate_units(pattern, 0);
+}
+
+/* Writes "(a|b|c|...)" with `branches` one-letter alternatives into buf, which
+ * must hold 2 * branches + 2 bytes. */
+static void regex_one_letter_alternation(char *buf, int branches) {
+    char *w = buf;
+    *w++ = '(';
+    for (int i = 0; i < branches; i++) {
+        if (i) {
+            *w++ = '|';
+        }
+        *w++ = (char)('a' + i % 26);
+    }
+    *w++ = ')';
+    *w = '\0';
+}
+
+/* Both regex backends expand `X{m,n}` into n copies of X at compile time, so
+ * nested intervals multiply and a 25-byte pattern can ask for millions of
+ * atoms. The wrapper sizes the pattern first and refuses one over the budget
+ * with CBM_REG_ETOOBIG before the platform compiler allocates anything, so
+ * there is nothing to free on refusal. The over-budget shapes here are small
+ * enough that an unguarded compile would still only cost tens of MB. */
+TEST(regex_compile_refuses_oversized_expansion) {
+    cbm_regex_t re;
+    /* 14^4 = 38,416 expanded atoms from 25 bytes: over the 32,768-unit budget. */
+    const char *nested = "((((a){14}){14}){14}){14}";
+    ASSERT_EQ(cbm_regcomp(&re, nested, CBM_REG_EXTENDED | CBM_REG_NOSUB), CBM_REG_ETOOBIG);
+    /* Every flag set the call sites use is refused the same way. */
+    ASSERT_EQ(cbm_regcomp(&re, nested, CBM_REG_EXTENDED), CBM_REG_ETOOBIG);
+    ASSERT_EQ(cbm_regcomp(&re, nested, CBM_REG_EXTENDED | CBM_REG_NOSUB | CBM_REG_ICASE),
+              CBM_REG_ETOOBIG);
+    /* A repeated alternation multiplies too: (16 + 16*16/8) x 255 x 3 = 36,720. */
+    ASSERT_EQ(cbm_regcomp(&re, "((a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p){255}){3}",
+                          CBM_REG_EXTENDED | CBM_REG_NOSUB),
+              CBM_REG_ETOOBIG);
+    /* A plain alternation just over the budget: 509 one-letter branches cost
+     * 509 + 509*509/8 = 32,894 units; 508 cost 32,766 and stay accepted. */
+    char alts[2 * 509 + 2];
+    regex_one_letter_alternation(alts, 509);
+    ASSERT_EQ(regex_units_ere(alts), 32894);
+    ASSERT_EQ(cbm_regcomp(&re, alts, CBM_REG_EXTENDED | CBM_REG_NOSUB), CBM_REG_ETOOBIG);
+    regex_one_letter_alternation(alts, 508);
+    ASSERT_EQ(regex_units_ere(alts), 32766);
+    ASSERT_LTE(regex_units_ere(alts), (uint64_t)CBM_REGEX_COMPILE_BUDGET_UNITS);
+    /* Bounds too large to represent saturate instead of wrapping around. */
+    ASSERT_EQ(cbm_regcomp(&re, "(a{99999999999999999999}){99999999999999999999}",
+                          CBM_REG_EXTENDED | CBM_REG_NOSUB),
+              CBM_REG_ETOOBIG);
+    /* Nesting deeper than the sizing pass tracks is refused, not recursed into. */
+    char deep[2 * 70 + 2];
+    memset(deep, '(', 70);
+    deep[70] = 'a';
+    memset(deep + 71, ')', 70);
+    deep[141] = '\0';
+    ASSERT_EQ(cbm_regcomp(&re, deep, CBM_REG_EXTENDED | CBM_REG_NOSUB), CBM_REG_ETOOBIG);
+    PASS();
+}
+
+/* The same nested shape one step under the budget (13^4 = 28,561 units)
+ * compiles and matches, so the refusal starts only past the budget. */
+TEST(regex_compile_accepts_expansion_under_budget) {
+    cbm_regex_t re;
+    ASSERT_EQ(regex_units_ere("((((a){13}){13}){13}){13}"), 28561);
+    ASSERT_EQ(cbm_regcomp(&re, "((((a){13}){13}){13}){13}", CBM_REG_EXTENDED | CBM_REG_NOSUB),
+              CBM_REG_OK);
+    char *subject = malloc(28561 + 1);
+    ASSERT_NOT_NULL(subject);
+    memset(subject, 'a', 28561);
+    subject[28561] = '\0';
+    ASSERT_EQ(cbm_regexec(&re, subject, 0, NULL, 0), CBM_REG_OK);
+    subject[28560] = '\0'; /* 28,560 a's: one short of 13^4 */
+    ASSERT_EQ(cbm_regexec(&re, subject, 0, NULL, 0), CBM_REG_NOMATCH);
+    free(subject);
+    cbm_regfree(&re);
+    PASS();
+}
+
+/* A pattern longer than CBM_REGEX_PATTERN_MAX_BYTES is refused outright; one
+ * exactly at the cap still compiles (a literal at the cap is exactly the unit
+ * budget, which is accepted). */
+TEST(regex_compile_refuses_overlong_pattern) {
+    cbm_regex_t re;
+    char *pattern = malloc(CBM_REGEX_PATTERN_MAX_BYTES + 2);
+    ASSERT_NOT_NULL(pattern);
+    memset(pattern, 'a', CBM_REGEX_PATTERN_MAX_BYTES + 1);
+    pattern[CBM_REGEX_PATTERN_MAX_BYTES + 1] = '\0';
+    ASSERT_EQ(cbm_regcomp(&re, pattern, CBM_REG_EXTENDED | CBM_REG_NOSUB), CBM_REG_ETOOBIG);
+    pattern[CBM_REGEX_PATTERN_MAX_BYTES] = '\0
```

---

### Incident Patch 5: `5c774862` (2026-10-04)
**Commit Message**: Merge pull request #2474 from DeusData/fix/search-arg-bounds

fix(mcp): clamp search_code context on both sides, add sink ceilings

**File**: `src/cypher/cypher.c` (modified, +8/-2)
```diff
@@ -5252,7 +5252,11 @@ static int execute_single(cbm_store_t *store, cbm_query_t *q, const char *projec
 
     /* Build initial bindings with early WHERE */
     int bind_cap = scan_count > max_rows ? scan_count : (max_rows > 0 ? max_rows : SKIP_ONE);
-    binding_t *bindings = malloc((bind_cap + SKIP_ONE) * sizeof(binding_t));
+    binding_t *bindings = malloc(((size_t)bind_cap + SKIP_ONE) * sizeof(binding_t));
+    if (!bindings) {
+        cbm_store_free_nodes(scanned, scan_count);
+        return CBM_NOT_FOUND; /* initial binding array refused */
+    }
     int bind_count = 0;
     const char *var_name = pat0->nodes[0].variable ? pat0->nodes[0].variable : CYP_ANON_HEAD_VAR;
 
@@ -5562,7 +5566,9 @@ int cbm_cypher_execute(cbm_store_t *store, const char *query, const char *projec
     g_cypher_trail_truncated = 0;
     g_cypher_truncated = false;
     cypher_deadline_arm(); /* #601: start the wall-clock budget for this query */
-    if (max_rows <= 0) {
+    /* max_rows sizes the initial binding array: non-positive means the
+     * ceiling, and nothing above the ceiling is ever materialized anyway. */
+    if (max_rows <= 0 || max_rows > CYPHER_RESULT_CEILING) {
         max_rows = CYPHER_RESULT_CEILING;
     }
 
```

**File**: `src/cypher/cypher.h` (modified, +2/-1)
```diff
@@ -334,7 +334,8 @@ typedef struct {
 } cbm_cypher_result_t;
 
 /* Execute a Cypher query against a store.
- * max_rows: limit on output rows (0 = use virtual ceiling of 100k).
+ * max_rows: limit on output rows; 0 or any value above the 100k ceiling uses
+ *   the ceiling.
  * project: project name filter (NULL = all projects).
  * Returns -1 on error (check out->error for message). */
 int cbm_cypher_execute(cbm_store_t *store, const char *query, const char *project, int max_rows,
```

**File**: `src/mcp/mcp.c` (modified, +19/-6)
```diff
@@ -41,6 +41,10 @@ enum {
     MCP_COMPARE_MAX_SCAN_LIMIT = 10000000,
     MCP_COMPARE_SET_BYTE_BUDGET = 512 * 1024,
     MCP_QUERY_MAX_VISIBLE_ROWS = 99998,
+    /* search_code `context`: lines of surrounding source per hit, the same
+     * ceiling as `source_max_lines`. Clamped at the handler and again where
+     * the window is computed, so the arithmetic never overflows. */
+    MCP_SEARCH_CONTEXT_MAX_LINES = 200,
     /* max_output_tokens is model-neutral sizing guidance, not a tokenizer
      * promise. The actual cross-platform contract is this deterministic UTF-8
      * byte ceiling, applied only at whole semantic-unit boundaries. */
@@ -701,7 +705,7 @@ static const tool_def_t TOOLS[] = {
      "\"string\"},\"file_pattern\":{\"type\":\"string\"},\"path_filter\":{\"type\":\"string\"},"
      "\"mode\":{\"type\":\"string\","
      "\"enum\":[\"compact\",\"full\",\"files\"],\"default\":\"compact\"},"
-     "\"context\":{\"type\":\"integer\"},"
+     "\"context\":{\"type\":\"integer\",\"default\":0,\"minimum\":0,\"maximum\":200},"
      "\"regex\":{\"type\":\"boolean\",\"default\":false},"
      "\"debug\":{\"type\":\"boolean\",\"default\":false,"
      "\"description\":\"Add scope_ms/scan_ms/enrich_ms phase timings.\"},"
@@ -13464,11 +13468,15 @@ static void attach_result_source(yyjson_mut_doc *doc, yyjson_mut_val *item, sear
             }
         }
     } else if (context_lines > 0 && r->match_count > 0) {
-        int ctx_start = r->match_lines[0] - context_lines;
-        int ctx_end = r->match_lines[r->match_count - SKIP_ONE] + context_lines;
-        if (ctx_start < SKIP_ONE) {
-            ctx_start = SKIP_ONE;
-        }
+        /* Bounded here as well as at the handler: the window must stay
+         * match ± MCP_SEARCH_CONTEXT_MAX_LINES for any caller, and the
+         * arithmetic must not overflow for any value. */
+        int ctx_lines = context_lines > MCP_SEARCH_CONTEXT_MAX_LINES ? MCP_SEARCH_CONTEXT_MAX_LINES
+                                                                     : context_lines;
+        int first_match = r->match_lines[0];
+        int last_match = r->match_lines[r->match_count - SKIP_ONE];
+        int ctx_start = first_match > ctx_lines ? first_match - ctx_lines : SKIP_ONE;
+        int ctx_end = last_match > INT_MAX - ctx_lines ? INT_MAX : last_match + ctx_lines;
         char *ctx = read_file_lines(abs_path, ctx_start, ctx_end);
         if (ctx) {
             char *safe_context = sanitize_utf8_lossy(ctx);
@@ -15038,6 +15046,11 @@ static char *handle_search_code(cbm_mcp_server_t *srv, const char *args) {
     int result_limit = cbm_mcp_get_int_arg(args, "result_limit", legacy_limit);
     int result_offset = cbm_mcp_get_int_arg(args, "result_offset", 0);
     int context_lines = cbm_mcp_get_int_arg(args, "context", 0);
+    if (context_lines < 0) {
+        context_lines = 0;
+    } else if (context_lines > MCP_SEARCH_CONTEXT_MAX_LINES) {
+        context_lines = MCP_SEARCH_CONTEXT_MAX_LINES;
+    }
     bool use_regex = cbm_mcp_get_bool_arg(args, "regex");
     uint64_t search_t0 = cbm_now_ms();
     search_metrics_t metrics = {0};
```

**File**: `tests/test_cypher.c` (modified, +24/-0)
```diff
@@ -9,6 +9,7 @@
 #include "../src/foundation/compat_thread.h"
 #include <cypher/cypher.h>
 #include <store/store.h>
+#include <limits.h>
 #include <stdatomic.h>
 #include <stdio.h>
 #include <string.h>
@@ -4955,6 +4956,28 @@ TEST(cypher_exec_deadline_allows_normal_query_issue601) {
     PASS();
 }
 
+/* The caller-supplied output-row limit sizes the initial binding array; a
+ * value above the engine ceiling is clamped to it before that happens, and a
+ * value inside the ceiling still bounds the row count. */
+TEST(cypher_exec_max_rows_above_ceiling_is_clamped) {
+    cbm_store_t *s = setup_cypher_store();
+    cbm_cypher_result_t r = {0};
+
+    int rc = cbm_cypher_execute(s, "MATCH (f:Function)", "test", INT_MAX, &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 4);
+    cbm_cypher_result_free(&r);
+
+    memset(&r, 0, sizeof(r));
+    rc = cbm_cypher_execute(s, "MATCH (f:Function)", "test", 2, &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 2);
+    cbm_cypher_result_free(&r);
+
+    cbm_store_close(s);
+    PASS();
+}
+
 /* ══════════════════════════════════════════════════════════════════ */
 
 SUITE(cypher) {
@@ -5183,4 +5206,5 @@ SUITE(cypher) {
     RUN_TEST(cypher_exec_prop_array_with_internal_commas);
     RUN_TEST(cypher_exec_prop_string_with_escaped_quote);
     RUN_TEST(cypher_single_hop_seeds_from_selective_far_node);
+    RUN_TEST(cypher_exec_max_rows_above_ceiling_is_clamped);
 }
```

**File**: `tests/test_mcp.c` (modified, +346/-0)
```diff
@@ -21803,6 +21803,346 @@ TEST(tool_result_add_notice_keeps_payload_shape_issue2144) {
     PASS();
 }
 
+/* ── Integer argument bounds ────────────────────────────────────────
+ * Sizing arguments are clamped on both sides at the handler. The fixture
+ * file is much longer than the `context` bound so the window is observable. */
+
+enum { CTX_FIXTURE_LINES = 1000, CTX_FIXTURE_NEEDLE_LINE = 500, CTX_BOUND = 200 };
+
+static bool write_context_fixture(const char *tmp, char *path, size_t path_sz) {
+    snprintf(path, path_sz, "%s/project/long.md", tmp);
+    FILE *fp = cbm_fopen(path, "wb");
+    if (!fp) {
+        return false;
+    }
+    for (int line = 1; line <= CTX_FIXTURE_LINES; line++) {
+        if (line == CTX_FIXTURE_NEEDLE_LINE) {
+            fprintf(fp, "needle-context-window\n");
+        } else {
+            fprintf(fp, "line %04d\n", line);
+        }
+    }
+    return fclose(fp) == 0;
+}
+
+static bool upsert_context_fixture_node(cbm_mcp_server_t *srv) {
+    cbm_store_t *st = cbm_mcp_server_store(srv);
+    if (!st) {
+        return false;
+    }
+    cbm_node_t node = {.project = "test-project",
+                       .label = "Section",
+                       .name = "long",
+                       .qualified_name = "test-project.long",
+                       .file_path = "long.md",
+                       .start_line = 1,
+                       .end_line = CTX_FIXTURE_LINES};
+    return cbm_store_upsert_node(st, &node) > 0;
+}
+
+static char *search_code_with_context(cbm_mcp_server_t *srv, const char *context_value) {
+    char req[256];
+    snprintf(req, sizeof(req),
+             "{\"project\":\"test-project\",\"pattern\":\"needle-context-window\","
+             "\"format\":\"json\",\"context\":%s,\"limit\":5}",
+             context_value);
+    char *resp = cbm_mcp_handle_tool(srv, "search_code", req);
+    if (!resp) {
+        return NULL;
+    }
+    char *inner = extract_text_content(resp);
+    free(resp);
+    return inner;
+}
+
+/* Row-0 context object of a json-format search_code answer, or NULL when the
+ * answer carries no context column. *doc_out owns the memory either way. */
+static yyjson_val *search_code_context_object(const char *inner, yyjson_doc **doc_out) {
+    *doc_out = yyjson_read(inner, strlen(inner), 0);
+    if (!*doc_out) {
+        return NULL;
+    }
+    yyjson_val *root = yyjson_doc_get_root(*doc_out);
+    yyjson_val *cols = yyjson_obj_get(root, "cols");
+    yyjson_val *rows = yyjson_obj_get(root, "rows");
+    if (!cols || !rows || yyjson_arr_size(rows) == 0) {
+        return NULL;
+    }
+    size_t col_count = yyjson_arr_size(cols);
+    for (size_t i = 0; i < col_count; i++) {
+        const char *col = yyjson_get_str(yyjson_arr_get(cols, i));
+        if (col && strcmp(col, "context") == 0) {
+            return yyjson_arr_get(yyjson_arr_get(rows, 0), i);
+        }
+    }
+    return NULL;
+}
+
+static int count_newlines(const char *s) {
+    int n = 0;
+    for (; *s; s++) {
+        n += *s == '\n';
+    }
+    return n;
+}
+
+TEST(search_code_context_window_is_bounded) {
+    char tmp[256];
+    cbm_mcp_server_t *srv = setup_snippet_server(tmp, sizeof(tmp));
+    ASSERT_NOT_NULL(srv);
+    char fixture[512];
+    ASSERT_TRUE(write_context_fixture(tmp, fixture, sizeof(fixture)));
+    ASSERT_TRUE(upsert_context_fixture_node(srv));
+
+    /* Far above the bound: the window is match ± 200, not the whole file. */
+    char *inner = search_code_with_context(srv, "100000");
+    ASSERT_NOT_NULL(inner);
+    yyjson_doc *doc = NULL;
+    yyjson_val *ctx = search_code_context_object(inner, &doc);
+    ASSERT_NOT_NULL(ctx);
+    ASSERT_EQ(yyjson_get_int(yyjson_obj_get(ctx, "context_start")),
+              CTX_FIXTURE_NEEDLE_LINE - CTX_BOUND);
+    const char *text = yyjson_get_str(yyjson_obj_get(ctx, "context"));
+    ASSERT_NOT_NULL(text);
+    ASSERT_EQ(count_newlines(text), 2 * CTX_BOUND + 1);
+    ASSERT_EQ(strncmp(text, "line 0300\n", 10), 0);
+    ASSERT_NOT_NULL(strstr(text, "\nneedle-context-window\n"));
+    ASSERT_NOT_NULL(strstr(text, "\nline 0700\n"));
+    ASSERT_NULL(strstr(text, "line 0701"));
+    yyjson_doc_free(doc);
+    free(inner);
+
+    /* Inside the bound the window is unchanged. */
+    inner = search_code_with_context(srv, "3");
+    ASSERT_NOT_NULL(inner);
+    ctx = search_code_context_object(inner, &doc);
+    ASSERT_NOT_NULL(ctx);
+    ASSERT_EQ(yyjson_get_int(yyjson_obj_get(ctx, "context_start")), CTX_FIXTURE_NEEDLE_LINE - 3);
+    text = yyjson_get_str(yyjson_obj_get(ctx, "context"));
+    ASSERT_NOT_NULL(text);
+    ASSERT_EQ(count_newlines(text), 7);
+    ASSERT_EQ(strncmp(text, "line 0497\n", 10), 0);
+    yyjson_doc_free(doc);
+    free(inner);
+
+    unlink(fixture);
+    cbm_mcp_server_free(srv);
+    cleanup_snippet_dir(tmp);
+    PASS();
+}
+
+TEST(search_code_context_extreme_values_answer_normally) {
+    char tmp[256];
+    cbm_mcp_server_t *srv = setup_snippet_server(tmp, sizeof(tmp));
+    ASS
```

---

### Incident Patch 6: `94801254` (2026-10-04)
**Commit Message**: Merge pull request #2473 from DeusData/fix/pkg-wrapper-archive-limits

fix(pkg): apply the Go wrapper's archive size limits to npm and PyPI

**File**: `pkg/npm/install.js` (modified, +231/-29)
```diff
@@ -8,7 +8,7 @@ const crypto = require('crypto');
 const fs = require('fs');
 const path = require('path');
 const os = require('os');
-const { execFileSync } = require('child_process');
+const { execFileSync, spawn } = require('child_process');
 const { pipeline } = require('stream');
 
 const REPO = 'DeusData/codebase-memory-mcp';
@@ -18,6 +18,20 @@ const MAX_REDIRECTS = 5;
 const DOWNLOAD_HOP_TIMEOUT_MS = 120_000;
 const CANDIDATE_TIMEOUT_MS = 15_000;
 const MAX_CHECKSUM_MANIFEST_BYTES = 1024 * 1024;
+// Release archive resource limits. Keep in sync with the Go wrapper
+// (pkg/go/cmd/codebase-memory-mcp/main.go) and the PyPI wrapper (_cli.py).
+const MAX_RELEASE_ARCHIVE_BYTES = 256 * 1024 * 1024;
+const MAX_ARCHIVE_MEMBERS = 64;
+const MAX_ARCHIVE_MEMBER_BYTES = 256 * 1024 * 1024;
+const MAX_ARCHIVE_EXPANDED_BYTES = 512 * 1024 * 1024;
+const DEFAULT_ARCHIVE_LIMITS = Object.freeze({
+  compressedBytes: MAX_RELEASE_ARCHIVE_BYTES,
+  members: MAX_ARCHIVE_MEMBERS,
+  memberBytes: MAX_ARCHIVE_MEMBER_BYTES,
+  expandedBytes: MAX_ARCHIVE_EXPANDED_BYTES,
+});
+// Bytes of tar's own diagnostics kept for the failure message.
+const MAX_TAR_STDERR_CHARS = 4096;
 const WINDOWS_BINARY_NAME = 'codebase-memory-mcp.exe';
 const UNIX_ARCHIVE_NAMES = [
   'codebase-memory-mcp',
@@ -90,21 +104,131 @@ function validateExactTarMemberListing(listing, expectedNames) {
   }
 }
 
-function extractExactTarArchive(
-  archivePath, destPath, expectedNames, targetName, runFile = execFileSync,
+function validateArchiveLimits(limits) {
+  if (!limits || !(limits.compressedBytes > 0) || !(limits.members > 0) ||
+      !(limits.memberBytes > 0) || !(limits.expandedBytes > 0)) {
+    throw new Error('invalid archive resource safety limits');
+  }
+}
+
+function requireCompressedArchiveWithinLimit(archivePath, limits) {
+  const status = fs.statSync(archivePath);
+  if (!status.isFile()) {
+    throw new Error('release archive is not a regular file');
+  }
+  if (status.size > limits.compressedBytes) {
+    throw new Error(
+      `release archive exceeds the ${limits.compressedBytes}-byte compressed safety limit`,
+    );
+  }
+}
+
+// Streams one member through `tar -xzOf` into a file this call creates,
+// counting every byte against the per-member limit. The file is removed only
+// when this call created it: a pre-existing target fails untouched.
+function extractTarMemberWithLimit(
+  archivePath, target, memberName, limits, spawnFile = spawn,
 ) {
+  return new Promise((resolve, reject) => {
+    let fd;
+    try {
+      fd = fs.openSync(target, 'wx', 0o600);
+    } catch (err) {
+      reject(err);
+      return;
+    }
+    let written = 0;
+    let failure = null;
+    let settled = false;
+    let stderr = '';
+    const finish = (err) => {
+      if (settled) return;
+      settled = true;
+      try { fs.closeSync(fd); } catch (closeError) { err = err || closeError; }
+      if (err) {
+        try { fs.unlinkSync(target); } catch (_) { /* already gone */ }
+        reject(err);
+        return;
+      }
+      resolve(written);
+    };
+    const child = spawnFile('tar', ['-xzOf', archivePath, memberName], {
+      stdio: ['ignore', 'pipe', 'pipe'],
+      windowsHide: true,
+    });
+    const fail = (err) => {
+      if (failure) return;
+      failure = err;
+      child.kill();
+    };
+    child.stdout.on('data', (chunk) => {
+      if (failure) return;
+      written += chunk.length;
+      if (written > limits.memberBytes) {
+        fail(new Error(
+          `archive member ${JSON.stringify(memberName)} exceeds the ${limits.memberBytes}-byte expanded safety limit`,
+        ));
+        return;
+      }
+      try {
+        let offset = 0;
+        while (offset < chunk.length) {
+          offset += fs.writeSync(fd, chunk, offset, chunk.length - offset);
+        }
+      } catch (err) {
+        fail(err);
+      }
+    });
+    child.stderr.setEncoding('utf8');
+    child.stderr.on('data', (text) => {
+      if (stderr.length < MAX_TAR_STDERR_CHARS) stderr += text;
+    });
+    child.on('error', (err) => {
+      failure = failure || err;
+      // A process that never started (no tar on PATH) has no exit to wait for.
+      if (child.pid === undefined) finish(failure);
+    });
+    child.on('close', (code, signal) => {
+      const detail = stderr.trim();
+      let err = failure;
+      if (!err && signal) {
+        err = new Error(
+          `tar was terminated by ${signal} while extracting ${memberName}: ${detail}`,
+        );
+      } else if (!err && code !== 0) {
+        err = new Error(
+          `tar exited with status ${code} while extracting ${memberName}: ${detail}`,
+        );
+      } else if (!err && written === 0) {
+        err = new Error(`archive member ${memberName} is empty`);
+      }
+      finish(err);
+    });
+  });
+}
+
+async function extractExactTarArchive(
+  archivePath, destPath, expectedNames, targetName,
+  runFile = execFileSync, limits = DEFAULT_ARCHIVE_LIMITS, spawn
```

**File**: `pkg/npm/test/archive-fixtures.js` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+'use strict';
+// Small synthetic release archives for the wrapper tests.
+
+const { execFileSync } = require('node:child_process');
+const fs = require('node:fs');
+const path = require('node:path');
+
+// The npm wrapper takes the zip path whenever Node reports win32 (see
+// getPlatform and `ext` in install.js), so the tar path is unreachable on a
+// Windows host and the tar cases would test nothing a user can reach there.
+// They cannot even build their fixtures on the Windows runner: the first
+// `tar` on its PATH is Git for Windows' GNU tar, which reads a drive-letter
+// path such as C:\... as a remote host ("tar (child): Cannot connect to C:
+// resolve failed"; every tar case failed that way in the first Windows run),
+// while Windows' own bsdtar accepts it. Under WSL Node is a Linux binary,
+// takes the tar path with POSIX paths, and these cases run there.
+const TAR_PATH_SKIP = process.platform === 'win32'
+  ? 'the npm wrapper never takes the tar path on win32 (it installs the zip asset)'
+  : false;
+
+// Deterministic, poorly compressible bytes (xorshift32), so a fixture of a
+// few hundred KiB still spans several pipe chunks after gzip.
+function patternBytes(length, seed = 0x9e3779b9) {
+  const out = Buffer.alloc(length);
+  let state = seed >>> 0;
+  for (let index = 0; index < length; index += 1) {
+    state ^= state << 13;
+    state >>>= 0;
+    state ^= state >>> 17;
+    state ^= state << 5;
+    state >>>= 0;
+    out[index] = state & 0xff;
+  }
+  return out;
+}
+
+// Writes entries ({ name, data }) into a staging directory under `root` and
+// packs them with the system tar, the producer the release itself uses.
+function writeTarGz(root, archiveName, entries) {
+  const stage = fs.mkdtempSync(path.join(root, 'stage-'));
+  for (const entry of entries) {
+    fs.writeFileSync(path.join(stage, entry.name), entry.data);
+  }
+  const archive = path.join(root, archiveName);
+  execFileSync(
+    'tar',
+    ['-czf', archive, '-C', stage, ...entries.map((entry) => entry.name)],
+    {
+      env: { ...process.env, COPYFILE_DISABLE: '1' },
+      stdio: ['ignore', 'ignore', 'inherit'],
+      windowsHide: true,
+    },
+  );
+  return archive;
+}
+
+const CRC_TABLE = (() => {
+  const table = new Int32Array(256);
+  for (let n = 0; n < 256; n += 1) {
+    let c = n;
+    for (let k = 0; k < 8; k += 1) {
+      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
+    }
+    table[n] = c;
+  }
+  return table;
+})();
+
+function crc32(buffer) {
+  let crc = -1;
+  for (const byte of buffer) {
+    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
+  }
+  return (crc ^ -1) >>> 0;
+}
+
+// entries: [{ name, data, declaredSize = data.length }]; stored (no
+// compression). Hand-rolled so the directory can claim a size that differs
+// from the bytes the entry carries, which no zip writer would produce.
+function buildZip(entries) {
+  const locals = [];
+  const centrals = [];
+  let offset = 0;
+  for (const entry of entries) {
+    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
+    const name = Buffer.from(entry.name, 'utf8');
+    const declaredSize = entry.declaredSize === undefined
+      ? data.length
+      : entry.declaredSize;
+    const crc = crc32(data);
+
+    const local = Buffer.alloc(30 + name.length);
+    local.writeUInt32LE(0x04034b50, 0);
+    local.writeUInt16LE(20, 4);
+    local.writeUInt32LE(crc, 14);
+    local.writeUInt32LE(data.length, 18);
+    local.writeUInt32LE(declaredSize, 22);
+    local.writeUInt16LE(name.length, 26);
+    name.copy(local, 30);
+
+    const central = Buffer.alloc(46 + name.length);
+    central.writeUInt32LE(0x02014b50, 0);
+    central.writeUInt16LE(20, 4);
+    central.writeUInt16LE(20, 6);
+    central.writeUInt32LE(crc, 16);
+    central.writeUInt32LE(data.length, 20);
+    central.writeUInt32LE(declaredSize, 24);
+    central.writeUInt16LE(name.length, 28);
+    central.writeUInt32LE(offset, 42);
+    name.copy(central, 46);
+
+    locals.push(local, data);
+    centrals.push(central);
+    offset += local.length + data.length;
+  }
+  const directory = Buffer.concat(centrals);
+  const end = Buffer.alloc(22);
+  end.writeUInt32LE(0x06054b50, 0);
+  end.writeUInt16LE(entries.length, 8);
+  end.writeUInt16LE(entries.length, 10);
+  end.writeUInt32LE(directory.length, 12);
+  end.writeUInt32LE(offset, 16);
+  return Buffer.concat([...locals, directory, end]);
+}
+
+module.exports = { TAR_PATH_SKIP, buildZip, patternBytes, writeTarGz };
```

**File**: `pkg/npm/test/archive-limits.test.js` (added, +350/-0)
```diff
@@ -0,0 +1,350 @@
+'use strict';
+
+const assert = require('node:assert/strict');
+const { EventEmitter } = require('node:events');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const { Readable } = require('node:stream');
+const test = require('node:test');
+const vm = require('node:vm');
+
+const {
+  DEFAULT_ARCHIVE_LIMITS,
+  UNIX_ARCHIVE_NAMES,
+  WINDOWS_ARCHIVE_NAMES,
+  WINDOWS_BINARY_NAME,
+  extractExactTarArchive,
+  extractZipOnWindows,
+} = require('../install.js');
+const {
+  TAR_PATH_SKIP, buildZip, patternBytes, writeTarGz,
+} = require('./archive-fixtures.js');
+
+const EXECUTABLE = 'codebase-memory-mcp';
+// Spans several pipe chunks, so an over-limit member is cut off mid-stream.
+const LARGE_EXECUTABLE = patternBytes(300 * 1024);
+
+function withScratch(callback) {
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cbm-npm-archive-test-'));
+  return Promise.resolve()
+    .then(() => callback(root))
+    .finally(() => fs.rmSync(root, { recursive: true, force: true }));
+}
+
+function limitsWith(overrides) {
+  return { ...DEFAULT_ARCHIVE_LIMITS, ...overrides };
+}
+
+function releaseEntries(names, executableData) {
+  return names.map((name) => ({
+    name,
+    data: executableData !== undefined && (name === EXECUTABLE || name === WINDOWS_BINARY_NAME)
+      ? executableData
+      : `payload of ${name}`,
+  }));
+}
+
+function makeDestination(root) {
+  const destination = path.join(root, 'extract');
+  fs.mkdirSync(destination);
+  return destination;
+}
+
+// Stands in for the system tar listing where the archive itself is damaged
+// on purpose and the real listing would fail before the writer runs.
+function fakeTarListing(names) {
+  return (command, args) => {
+    assert.equal(command, 'tar');
+    assert.equal(args[0], '-tzf');
+    return `${names.join('\n')}\n`;
+  };
+}
+
+function neverLists() {
+  throw new Error('the listing must not run');
+}
+
+test('tar extraction refuses an archive larger than the compressed limit', { skip: TAR_PATH_SKIP }, () =>
+  withScratch(async (root) => {
+    const archive = writeTarGz(root, 'release.tar.gz', releaseEntries(UNIX_ARCHIVE_NAMES));
+    const destination = makeDestination(root);
+
+    await assert.rejects(
+      extractExactTarArchive(
+        archive, destination, UNIX_ARCHIVE_NAMES, EXECUTABLE,
+        neverLists, limitsWith({ compressedBytes: 16 }),
+      ),
+      /16-byte compressed safety limit/,
+    );
+    assert.deepEqual(fs.readdirSync(destination), []);
+  }));
+
+test('tar extraction refuses an exact namespace wider than the member limit', { skip: TAR_PATH_SKIP }, () =>
+  withScratch(async (root) => {
+    const archive = writeTarGz(root, 'release.tar.gz', releaseEntries(UNIX_ARCHIVE_NAMES));
+    const destination = makeDestination(root);
+
+    await assert.rejects(
+      extractExactTarArchive(
+        archive, destination, UNIX_ARCHIVE_NAMES, EXECUTABLE,
+        neverLists, limitsWith({ members: 2 }),
+      ),
+      /2-member safety limit/,
+    );
+    assert.deepEqual(fs.readdirSync(destination), []);
+  }));
+
+test('tar extraction stops an over-limit member in the counted writer and leaves no file', { skip: TAR_PATH_SKIP }, () =>
+  withScratch(async (root) => {
+    const archive = writeTarGz(
+      root, 'release.tar.gz', releaseEntries(UNIX_ARCHIVE_NAMES, LARGE_EXECUTABLE),
+    );
+    const destination = makeDestination(root);
+
+    // The real listing passes (names only); the limit trips while tar is
+    // still streaming the executable into the writer.
+    await assert.rejects(
+      extractExactTarArchive(
+        archive, destination, UNIX_ARCHIVE_NAMES, EXECUTABLE,
+        undefined, limitsWith({ memberBytes: 64 * 1024 }),
+      ),
+      /"codebase-memory-mcp" exceeds the 65536-byte expanded safety limit/,
+    );
+    assert.deepEqual(fs.readdirSync(destination), []);
+  }));
+
+test('tar extraction leaves a pre-existing target untouched', { skip: TAR_PATH_SKIP }, () =>
+  withScratch(async (root) => {
+    const archive = writeTarGz(root, 'release.tar.gz', releaseEntries(UNIX_ARCHIVE_NAMES));
+    const destination = makeDestination(root);
+    const target = path.join(destination, EXECUTABLE);
+    fs.writeFileSync(target, 'keep');
+
+    await assert.rejects(
+      extractExactTarArchive(archive, destination, UNIX_ARCHIVE_NAMES, EXECUTABLE),
+      /EEXIST/,
+    );
+    assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
+  }));
+
+test('tar extraction leaves no file when tar fails mid-stream', { skip: TAR_PATH_SKIP }, () =>
+  withScratch(async (root) => {
+    const complete = writeTarGz(
+      root, 'complete.tar.gz', releaseEntries(UNIX_ARCHIVE_NAMES, LARGE_EXECUTABLE),
+    );
+    const bytes = fs.readFileSync(complete);
+    const archive = path.join(root, 'truncated.tar.gz');
+    fs.writeFileSync(archive, bytes.subarray(0, Math.floor(bytes.length * 0.6)));
+    const destination = makeDestination(r
```

**File**: `pkg/npm/test/package-publication.test.js` (modified, +32/-17)
```diff
@@ -13,6 +13,7 @@ const {
   installWindowsBinaryAtomically,
   validateExactTarMemberListing,
 } = require('../install.js');
+const { TAR_PATH_SKIP, writeTarGz } = require('./archive-fixtures.js');
 
 function exactUnixListing(extra = []) {
   return [...UNIX_ARCHIVE_NAMES, ...extra].join('\n') + '\n';
@@ -33,23 +34,37 @@ test('Unix archive validation rejects traversal and unexpected members', () => {
   );
 });
 
-test('Unix extraction requests only the validated root executable', () => {
-  const calls = [];
-  const runner = (command, args) => {
-    calls.push({ command, args: [...args] });
-    return calls.length === 1 ? exactUnixListing() : Buffer.alloc(0);
-  };
-
-  extractExactTarArchive(
-    '/tmp/release.tar.gz', '/tmp/extract', UNIX_ARCHIVE_NAMES,
-    'codebase-memory-mcp', runner,
-  );
-
-  assert.deepEqual(calls[0].args, ['-tzf', '/tmp/release.tar.gz']);
-  assert.deepEqual(
-    calls[1].args,
-    ['-xzf', '/tmp/release.tar.gz', '-C', '/tmp/extract', 'codebase-memory-mcp'],
-  );
+test('Unix extraction lists through the system tar and writes only the root executable', { skip: TAR_PATH_SKIP }, async () => {
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cbm-npm-extract-test-'));
+  try {
+    const archive = writeTarGz(
+      root, 'release.tar.gz',
+      UNIX_ARCHIVE_NAMES.map((name) => ({ name, data: `member:${name}` })),
+    );
+    const destination = path.join(root, 'extract');
+    fs.mkdirSync(destination);
+    const calls = [];
+    const runner = (command, args) => {
+      calls.push({ command, args: [...args] });
+      return exactUnixListing();
+    };
+
+    await extractExactTarArchive(
+      archive, destination, UNIX_ARCHIVE_NAMES, 'codebase-memory-mcp', runner,
+    );
+
+    // The listing runner sees the namespace query only; the executable is
+    // written by the counted `tar -xzOf` writer, never by `tar -x` into the
+    // tree, so the companions never touch the disk.
+    assert.deepEqual(calls.map((call) => call.args), [['-tzf', archive]]);
+    assert.equal(
+      fs.readFileSync(path.join(destination, 'codebase-memory-mcp'), 'utf8'),
+      'member:codebase-memory-mcp',
+    );
+    assert.deepEqual(fs.readdirSync(destination), ['codebase-memory-mcp']);
+  } finally {
+    fs.rmSync(root, { recursive: true, force: true });
+  }
 });
 
 function writeBinary(directory, tag) {
```

**File**: `pkg/pypi/src/codebase_memory_mcp/_cli.py` (modified, +205/-23)
```diff
@@ -1,5 +1,6 @@
 """Downloads codebase-memory-mcp on first run, then runs its native entry point."""
 
+import collections
 import errno
 import hashlib
 import json
@@ -42,6 +43,22 @@
 _NETWORK_TIMEOUT_SECONDS = 120
 _CANDIDATE_TIMEOUT_SECONDS = 15
 _MAX_CHECKSUM_MANIFEST_BYTES = 1024 * 1024
+# Release archive resource limits. Keep in sync with the Go wrapper
+# (pkg/go/cmd/codebase-memory-mcp/main.go) and the npm wrapper (install.js).
+_MAX_RELEASE_ARCHIVE_BYTES = 256 * 1024 * 1024
+_MAX_ARCHIVE_MEMBERS = 64
+_MAX_ARCHIVE_MEMBER_BYTES = 256 * 1024 * 1024
+_MAX_ARCHIVE_EXPANDED_BYTES = 512 * 1024 * 1024
+_ARCHIVE_COPY_CHUNK_BYTES = 64 * 1024
+_ArchiveLimits = collections.namedtuple(
+    "_ArchiveLimits", "compressed_bytes members member_bytes expanded_bytes"
+)
+_DEFAULT_ARCHIVE_LIMITS = _ArchiveLimits(
+    compressed_bytes=_MAX_RELEASE_ARCHIVE_BYTES,
+    members=_MAX_ARCHIVE_MEMBERS,
+    member_bytes=_MAX_ARCHIVE_MEMBER_BYTES,
+    expanded_bytes=_MAX_ARCHIVE_EXPANDED_BYTES,
+)
 _REDIRECT_CODES = frozenset({301, 302, 303, 307, 308})
 _RUNTIME_LOCK_NAME = ".codebase-memory-mcp-runtime.lock"
 _RUNTIME_LOCK_WAIT_SECONDS = 45
@@ -113,27 +130,50 @@ def _download_https(url: str, dest: str, max_bytes: int = 0) -> None:
 
         with response:
             _validate_url_scheme(response.geturl())
+            declared = (response.headers.get("Content-Length") or "").strip()
+            # Only plain ASCII digits are a length (str.isdigit also accepts
+            # characters that int() rejects); anything else is left to the
+            # byte counter below.
+            if max_bytes and re.fullmatch(r"[0-9]+", declared):
+                if int(declared) > max_bytes:
+                    raise RuntimeError(
+                        f"download exceeds the {max_bytes}-byte safety limit"
+                    )
             deadline = time.monotonic() + _NETWORK_TIMEOUT_SECONDS
             total = 0
-            with open(dest, "wb") as out:
-                while True:
-                    if time.monotonic() >= deadline:
-                        raise TimeoutError(
-                            f"download hop timed out: {current_url}"
-                        )
-                    chunk = response.read(65536)
-                    if not chunk:
-                        return
-                    total += len(chunk)
-                    if max_bytes and total > max_bytes:
-                        raise RuntimeError(
-                            f"download exceeds the {max_bytes}-byte safety limit"
-                        )
-                    out.write(chunk)
+            try:
+                with open(dest, "wb") as out:
+                    while True:
+                        if time.monotonic() >= deadline:
+                            raise TimeoutError(
+                                f"download hop timed out: {current_url}"
+                            )
+                        chunk = response.read(65536)
+                        if not chunk:
+                            return
+                        total += len(chunk)
+                        if max_bytes and total > max_bytes:
+                            raise RuntimeError(
+                                f"download exceeds the {max_bytes}-byte "
+                                f"safety limit"
+                            )
+                        out.write(chunk)
+            except BaseException:
+                # Never leave a partial download behind for a later step to
+                # mistake for the complete asset.
+                _remove_quietly(dest)
+                raise
 
     raise RuntimeError("too many redirects")
 
 
+def _remove_quietly(path) -> None:
+    try:
+        os.unlink(path)
+    except OSError:
+        pass
+
+
 def _verify_candidate(path: Path) -> None:
     """Require a staged native candidate to execute successfully."""
     try:
@@ -196,43 +236,174 @@ def _validate_archive_names(names, archive_names, casefold: bool = False):
         )
 
 
+def _validate_archive_limits(limits) -> None:
+    if (
+        limits.compressed_bytes <= 0
+        or limits.members <= 0
+        or limits.member_bytes <= 0
+        or limits.expanded_bytes <= 0
+    ):
+        sys.exit("codebase-memory-mcp: invalid archive resource safety limits")
+
+
+def _require_compressed_archive_within_limit(archive_path: str, limits) -> None:
+    status = os.stat(archive_path)
+    if not stat.S_ISREG(status.st_mode):
+        sys.exit("codebase-memory-mcp: release archive is not a regular file")
+    if status.st_size > limits.compressed_bytes:
+        sys.exit(
+            f"codebase-memory-mcp: release archive exceeds the "
+            f"{limits.compressed_bytes}-byte compressed safety limit"
+        )
+
+
+def _require_member_count_within_limit(count: int, limits) -> None:
+    if count > limits.members:
+        sys.exit(
+            f"codebase-memory-mcp: archive exceeds the {limits.members}-member "
+            f"safe
```

**File**: `pkg/pypi/tests/test_cli.py` (modified, +294/-0)
```diff
@@ -1,5 +1,6 @@
 import errno
 import hashlib
+import io
 import json
 import os
 import stat
@@ -835,3 +836,296 @@ def test_windows_zip_rejects_symlink_metadata(self):
                     False,
                 )
 
+
+class _FakeHttpsResponse:
+    """Minimal stand-in for the opener's response: headers, geturl, read."""
+
+    def __init__(self, body: bytes, headers=None):
+        self._body = body
+        self._offset = 0
+        self.headers = dict(headers or {})
+
+    def __enter__(self):
+        return self
+
+    def __exit__(self, *exc_info):
+        return False
+
+    def geturl(self):
+        return "https://example.invalid/release.tar.gz"
+
+    def read(self, size=-1):
+        if size is None or size < 0:
+            size = len(self._body) - self._offset
+        chunk = self._body[self._offset : self._offset + size]
+        self._offset += len(chunk)
+        return chunk
+
+
+def _limits_with(**overrides):
+    return _cli._DEFAULT_ARCHIVE_LIMITS._replace(**overrides)
+
+
+def _write_tar_gz(archive, entries):
+    with tarfile.open(archive, "w:gz") as tf:
+        for name, data in entries:
+            info = tarfile.TarInfo(name)
+            info.size = len(data)
+            tf.addfile(info, io.BytesIO(data))
+
+
+def _write_zip(archive, entries):
+    with zipfile.ZipFile(archive, "w") as zf:
+        for name, data in entries:
+            zf.writestr(name, data)
+
+
+def _release_entries(names):
+    return [(name, f"payload of {name}".encode()) for name in names]
+
+
+class ArchiveLimitTests(unittest.TestCase):
+    URL = "https://example.invalid/release.tar.gz"
+
+    def _download(self, response, destination, max_bytes):
+        with mock.patch.object(_cli._HTTPS_OPENER, "open", return_value=response):
+            _cli._download_https(self.URL, destination, max_bytes)
+
+    def test_download_rejects_a_declared_length_over_the_limit(self):
+        with tempfile.TemporaryDirectory() as root:
+            destination = os.path.join(root, "release.tar.gz")
+            response = _FakeHttpsResponse(b"", {"Content-Length": "9"})
+            with self.assertRaises(RuntimeError) as raised:
+                self._download(response, destination, 8)
+            self.assertIn("8-byte safety limit", str(raised.exception))
+            self.assertFalse(os.path.exists(destination))
+
+    def test_download_rejects_a_body_over_the_limit_and_removes_the_partial_file(
+        self,
+    ):
+        with tempfile.TemporaryDirectory() as root:
+            destination = os.path.join(root, "release.tar.gz")
+            response = _FakeHttpsResponse(b"x" * 1024)
+            with self.assertRaises(RuntimeError) as raised:
+                self._download(response, destination, 8)
+            self.assertIn("8-byte safety limit", str(raised.exception))
+            self.assertFalse(os.path.exists(destination))
+
+    def test_download_within_the_limit_stores_the_body(self):
+        with tempfile.TemporaryDirectory() as root:
+            destination = os.path.join(root, "release.tar.gz")
+            response = _FakeHttpsResponse(b"payload", {"Content-Length": "7"})
+            self._download(response, destination, 1024)
+            with open(destination, "rb") as stored:
+                self.assertEqual(stored.read(), b"payload")
+
+    def test_download_counts_bytes_when_the_declared_length_is_not_a_number(self):
+        # A superscript two passes str.isdigit but not int(); such values and
+        # plain junk must fall through to the byte counter, never crash.
+        for declared in ("²", "abc", "", "1e3", "-1"):
+            with self.subTest(declared=declared), tempfile.TemporaryDirectory() as root:
+                destination = os.path.join(root, "release.tar.gz")
+                response = _FakeHttpsResponse(b"x" * 1024, {"Content-Length": declared})
+                with self.assertRaises(RuntimeError) as raised:
+                    self._download(response, destination, 8)
+                self.assertIn("8-byte safety limit", str(raised.exception))
+                self.assertFalse(os.path.exists(destination))
+        with tempfile.TemporaryDirectory() as root:
+            destination = os.path.join(root, "release.tar.gz")
+            response = _FakeHttpsResponse(b"payload", {"Content-Length": "²"})
+            self._download(response, destination, 1024)
+            with open(destination, "rb") as stored:
+                self.assertEqual(stored.read(), b"payload")
+
+    def test_unix_tar_rejects_more_members_than_the_limit(self):
+        with tempfile.TemporaryDirectory() as root:
+            archive = Path(root) / "members.tar.gz"
+            _write_tar_gz(archive, [("one", b"a"), ("two", b"b"), ("three", b"c")])
+            destination = Path(root) / "extract"
+            destination.mkdir()
+            with tarfile.open(archive) as tf, self.assertRaises(SystemExit) as raised:
+                _cli._safe_extract_tar(
+                    tf,
+         
```

---

### Incident Patch 7: `d8ece6ca` (2026-10-04)
**Commit Message**: fix(build): reconcile three call sites after concurrent merges

Two pairs of pull requests merged cleanly but left main unbuildable:

- #2447 added a route_mount parameter to emit_route_registration and
  handle_route_registration, while #2464 added a new call to each with
  the old argument list. The cross-language refused-route helper from
  #2464 now takes route_mount and passes it on, and the pass_calls.c
  call passes it too, as every other call site does. A route minted for
  a refused binding therefore gets the same Laravel api mount as any
  other route from that file.
- #2446 added a caller of is_project_db_file, which #2526 replaced with
  cbm_is_project_index_db. The new caller uses the replacement, so the
  owning-project lookup accepts the same file names as every other
  project scan.

Verified: build/c/test-runner and the server binary build again; suites
edge_types_probe, mcp, cli and pipeline: 1081 passed, 4 platform skips.

Signed-off-by: Martin Vogel <[REDACTED_EMAIL]>

**File**: `src/mcp/mcp.c` (modified, +1/-1)
```diff
@@ -12093,7 +12093,7 @@ static char *resolve_path_owner(const char *path, char *derived) {
     cbm_dirent_t *entry;
     while ((entry = cbm_readdir(d)) != NULL) {
         mcp_project_record_t record = {0};
-        if (!is_project_db_file(entry->name, strlen(entry->name)) ||
+        if (!cbm_is_project_index_db(entry->name) ||
             read_project_record_identity(dir_path, entry->name, 0, &record) != PROJECT_RECORD_OK) {
             continue;
         }
```

**File**: `src/pipeline/pass_calls.c` (modified, +1/-1)
```diff
@@ -903,7 +903,7 @@ static int resolve_single_call(cbm_pipeline_ctx_t *ctx, CBMCall *call, const CBM
         if (cbm_service_pattern_route_method(call->callee_name) != NULL && call->first_string_arg &&
             call->first_string_arg[0] == '/') {
             handle_route_registration(ctx, call, source_node, module_qn, imp_keys, imp_vals,
-                                      imp_count);
+                                      imp_count, route_mount);
             return SKIP_ONE;
         }
         return 0;
```

**File**: `src/pipeline/pass_parallel.c` (modified, +4/-3)
```diff
@@ -2668,7 +2668,8 @@ static void emit_service_edge(cbm_gbuf_t *gbuf, const cbm_gbuf_node_t *source,
 static void emit_xlang_refused_route(cbm_gbuf_t *gbuf, const cbm_gbuf_node_t *source,
                                      const CBMCall *call, const char *module_qn,
                                      const cbm_registry_t *registry, const cbm_gbuf_t *main_gbuf,
-                                     const char **imp_keys, const char **imp_vals, int imp_count) {
+                                     const char **imp_keys, const char **imp_vals, int imp_count,
+                                     const char *route_mount) {
     if (cbm_service_pattern_route_method(call->callee_name) == NULL) {
         return;
     }
@@ -2680,7 +2681,7 @@ static void emit_xlang_refused_route(cbm_gbuf_t *gbuf, const cbm_gbuf_node_t *so
     const char *route_path = find_route_path_in_args(call, &handler_ref);
     if (route_path) {
         emit_route_registration(gbuf, source, call, route_path, handler_ref, module_qn, registry,
-                                main_gbuf, imp_keys, imp_vals, imp_count);
+                                main_gbuf, imp_keys, imp_vals, imp_count, route_mount);
     }
 }
 
@@ -3259,7 +3260,7 @@ static void resolve_file_calls(resolve_ctx_t *rc, resolve_worker_state_t *ws, CB
              * CALLS edge across a language boundary. A route registration
              * behind the refused binding still gets its Route. */
             emit_xlang_refused_route(ws->local_edge_buf, source_node, call, module_qn, rc->registry,
-                                     rc->main_gbuf, imp_keys, imp_vals, imp_count);
+                                     rc->main_gbuf, imp_keys, imp_vals, imp_count, route_mount);
             continue;
         }
         if (!target_node || source_node->id == target_node->id) {
```

---

### Incident Patch 8: `982621dd` (2026-10-04)
**Commit Message**: Merge pull request #2459 from DeusData/fix/doc-comment-capture

fix(extract): capture complete doc comments across languages

**File**: `internal/cbm/cbm.h` (modified, +10/-0)
```diff
@@ -642,6 +642,11 @@ typedef struct CBMFileResult {
     // by cbm_free_result(); ordinary single-file results leave these zeroed.
     struct CBMFileResult **owned_results;
     int owned_result_count;
+
+    /* The file's own doc, set on its File node: the Go package comment or
+     * the Rust inner docs (//!). NULL for other languages and undocumented
+     * files. */
+    const char *module_doc;
 } CBMFileResult;
 
 // --- Enclosing function cache ---
@@ -728,6 +733,11 @@ typedef struct {
     /* How many nodes the unified walk actually visited (whether or not it ran
      * out of budget) — the measurement the budget has to be expressed in. */
     uint32_t walk_nodes_visited;
+    /* Doc-comment lookup state (extract_defs.c), NULL until first used and
+     * allocated in `scratch`: the memo of parents' child arrays and the Perl
+     * POD section index. */
+    void *doc_memo;
+    void *doc_pod_index;
 } CBMExtractCtx;
 
 // --- Public API ---
```

**File**: `internal/cbm/extract_defs.c` (modified, +1418/-49)
```diff
@@ -1265,36 +1265,6 @@ static bool is_comment_node(const char *kind) {
             strcmp(kind, "line_comment") == 0 || strcmp(kind, "multiline_comment") == 0);
 }
 
-// Extract comment text, truncating to MAX_COMMENT_LEN.
-// #1017: snap the cut point back to a complete UTF-8 codepoint boundary.
-static char *extract_comment_text(CBMArena *a, TSNode node, const char *source) {
-    char *text = cbm_node_text(a, node, source);
-    if (text && strlen(text) > MAX_COMMENT_LEN) {
-        size_t cut = MAX_COMMENT_LEN;
-        while (cut > 0 && ((unsigned char)text[cut] & 0xC0) == 0x80)
-            cut--;
-        text[cut] = '\0';
-    }
-    return text;
-}
-
-// Go-specific: type_spec/type_alias comment is before the parent type_declaration.
-static const char *extract_go_type_docstring(CBMArena *a, TSNode node, const char *source) {
-    const char *kind = ts_node_type(node);
-    if (strcmp(kind, "type_spec") != 0 && strcmp(kind, "type_alias") != 0) {
-        return NULL;
-    }
-    TSNode parent = ts_node_parent(node);
-    if (ts_node_is_null(parent) || strcmp(ts_node_type(parent), "type_declaration") != 0) {
-        return NULL;
-    }
-    TSNode pprev = ts_node_prev_sibling(parent);
-    if (!ts_node_is_null(pprev) && is_comment_node(ts_node_type(pprev))) {
-        return extract_comment_text(a, pprev, source);
-    }
-    return NULL;
-}
-
 // Python-specific: docstring as first expression_statement -> string in function body.
 static const char *extract_python_docstring(CBMArena *a, TSNode node, const char *source) {
     TSNode body = ts_node_child_by_field_name(node, TS_FIELD("body"));
@@ -1314,30 +1284,1423 @@ static const char *extract_python_docstring(CBMArena *a, TSNode node, const char
     }
     const char *sk = ts_node_type(str);
     if (strcmp(sk, "string") == 0 || strcmp(sk, "concatenated_string") == 0) {
-        return extract_comment_text(a, str, source);
+        return cbm_node_text(a, str, source);
     }
     return NULL;
 }
 
-// Extract docstring from the node's leading comment.
-static const char *extract_docstring(CBMArena *a, TSNode node, const char *source,
-                                     CBMLanguage lang) {
-    if (lang == CBM_LANG_GO) {
-        const char *doc = extract_go_type_docstring(a, node, source);
-        if (doc) {
-            return doc;
+/* ── Doc comments ─────────────────────────────────────────────────────────
+ * A definition's doc is the comment RUN directly above it, not only the one
+ * comment node before it:
+ *   - a run is contiguous (no blank line) and of one marker style; a Go comment
+ *     group may mix styles and drops go/ast directives (//go:generate, //line);
+ *   - it sits above the item's attributes (Rust), its declaration or export
+ *     wrapper (JS/TS, C#, Go var/const) or its typedef (C);
+ *   - a comment on the previous code's last line is that code's trailing
+ *     comment, and a Rust inner doc documents the module, never the item;
+ *   - a nearer plain comment does not hide a doc-style comment directly above;
+ *   - a run a blank line away is detached (Go: always; elsewhere: unless it is
+ *     doc-style), and a run with no letter or digit (a banner) is no doc;
+ *   - the whole run is kept: the node's properties buffer grows with the doc.
+ * Fields, variables, enum members and macros of code languages get the same
+ * doc, a Perl sub the POD section that names it, and a Go or Rust file its
+ * package comment or inner docs (on the File node).
+ *
+ * Leading trivia is read from the parent's child array, kept in a small
+ * per-file memo: tree-sitter has no parent pointers, so ts_node_parent and
+ * ts_node_prev_sibling are O(position), and one lookup per member of an
+ * N-member class body cost O(N^2) (65,536 fields in one dotnet test class). */
+
+enum {
+    DOC_SPAN_COMMENT = 1,
+    DOC_SPAN_ATTR = 2,
+    DOC_SPAN_INIT_CAP = 8,
+    DOC_SPAN_GROW = 2,
+    DOC_MEMO_SLOTS = 8, /* parents whose child arrays stay cached */
+    DOC_MEMO_WIDE = 32, /* a level wider than this is cached while descending */
+    DOC_BISECT = 2,
+};
+
+/* Comment marker families (the slash forms are spelled out in words so this
+ * comment does not nest). */
+typedef enum {
+    DOC_CS_OTHER = 0,  /* another family (--, ;, %) */
+    DOC_CS_LINE,       /* slash-slash, or four and more slashes */
+    DOC_CS_LINE_DOC,   /* slash-slash-slash */
+    DOC_CS_LINE_BANG,  /* slash-slash-bang */
+    DOC_CS_BLOCK,      /* plain block, empty block, star-banner block */
+    DOC_CS_BLOCK_DOC,  /* slash-star-star */
+    DOC_CS_BLOCK_BANG, /* slash-star-bang */
+    DOC_CS_HASH,       /* hash */
+} doc_style_t;
+
+/* One trivia element as a byte span. erow is the EFFECTIVE end row: a node
+ * that ends at column 0 (a Rust line_comment includes its newline) ends on the
+ * row before. */
+typedef struct {
+    uint32_t sb;
+    uint32_t eb;
+    uint32_t srow;
+    uint32_t erow;
+    uint8_t kind;
+    uint8_t style;
+} doc_span_t;
+
+
```

**File**: `internal/cbm/result_compact.c` (modified, +1/-0)
```diff
@@ -392,6 +392,7 @@ static void cr_walk(cr_ctx_t *c, CBMFileResult *r) {
     cr_list(c, &r->macros);
     cr_str(c, &r->error_msg);
     cr_str(c, &r->error_ranges);
+    cr_str(c, &r->module_doc);
     cr_blob(c, (const void **)&r->source, r->source ? (size_t)r->source_len + SKIP_ONE : 0);
 }
 
```

**File**: `src/pipeline/pass_definitions.c` (modified, +67/-5)
```diff
@@ -22,6 +22,7 @@ enum { PD_JSON_FIELD_OVERHEAD = 6 };
 #include "pipeline/pipeline_internal.h"
 #include "graph_buffer/graph_buffer.h"
 #include "foundation/log.h"
+#include "foundation/mem_core.h" /* cbm_alloc/cbm_free: the grown properties buffer */
 #include "foundation/compat.h"
 #include "foundation/compat_fs.h"
 #include "foundation/limits.h"
@@ -321,16 +322,74 @@ static void build_def_props(char *buf, size_t bufsize, const CBMDefinition *def)
     }
 }
 
-/* Process one definition: create node, register, DEFINES + DEFINES_METHOD edges. */
-static void process_def(cbm_pipeline_ctx_t *ctx, const CBMDefinition *def, const char *rel) {
+/* A def's properties buffer: CBM_SZ_2K for every other field plus the whole
+ * serialized docstring field, which has no length cap (a field that does not
+ * fit is dropped whole). Returns `stack` for a def without a docstring, or
+ * when the larger buffer cannot be allocated. Twin of pass_parallel.c -- keep
+ * both in sync. */
+static char *pd_props_buf(const CBMDefinition *def, char *stack, size_t *size) {
+    if (!def->docstring || !def->docstring[0]) {
+        return stack;
+    }
+    size_t need =
+        *size + strlen("docstring") + def_json_escaped_len(def->docstring) + PD_JSON_FIELD_OVERHEAD;
+    char *buf = cbm_alloc(CBM_MEM_CLASS_GBUF_STRING, need);
+    if (!buf) {
+        return stack;
+    }
+    *size = need;
+    return buf;
+}
+
+/* Add a file's own doc (Go package comment, Rust inner docs) to its File
+ * node as "docstring". Twin of pass_parallel.c -- keep both in sync. */
+static void pd_add_file_doc(const cbm_gbuf_node_t *file_node, const char *doc) {
+    if (!file_node || !doc || !doc[0]) {
+        return;
+    }
+    const char *old = file_node->properties_json ? file_node->properties_json : "{}";
+    size_t olen = strlen(old);
+    if (olen < PAIR_LEN || old[olen - SKIP_ONE] != '}') {
+        return; /* not a JSON object -- leave it untouched */
+    }
+    size_t cap = olen + strlen("docstring") + def_json_escaped_len(doc) + PD_JSON_FIELD_OVERHEAD +
+                 PD_ESC_SPACE + SKIP_ONE;
+    char *neu = cbm_alloc(CBM_MEM_CLASS_GBUF_STRING, cap);
+    if (!neu) {
+        return;
+    }
+    size_t pos = olen - SKIP_ONE; /* without the closing brace */
+    memcpy(neu, old, pos);
+    neu[pos] = '\0';
+    append_json_string(neu, cap, &pos, "docstring", doc);
+    if (olen == PAIR_LEN && pos > PAIR_LEN) { /* "{}": drop the leading comma */
+        memmove(neu + SKIP_ONE, neu + PAIR_LEN, pos - SKIP_ONE);
+        pos--;
+    }
+    neu[pos++] = '}';
+    neu[pos] = '\0';
+    (void)cbm_gbuf_node_set_properties_json((cbm_gbuf_node_t *)file_node, neu);
+    cbm_free(CBM_MEM_CLASS_GBUF_STRING, neu);
+}
+
+/* Process one definition: create node, register, DEFINES + DEFINES_METHOD edges.
+ * `file_doc`, the file's own doc (passed with its first def only), goes on the
+ * File node. */
+static void process_def(cbm_pipeline_ctx_t *ctx, const CBMDefinition *def, const char *rel,
+                        const char *file_doc) {
     if (!def->qualified_name || !def->name) {
         return;
     }
-    char props[CBM_SZ_2K];
-    build_def_props(props, sizeof(props), def);
+    char stack[CBM_SZ_2K];
+    size_t props_size = sizeof(stack);
+    char *props = pd_props_buf(def, stack, &props_size);
+    build_def_props(props, props_size, def);
     int64_t node_id = cbm_gbuf_upsert_node(
         ctx->gbuf, def->label ? def->label : "Function", def->name, def->qualified_name,
         def->file_path ? def->file_path : rel, (int)def->start_line, (int)def->end_line, props);
+    if (props != stack) {
+        cbm_free(CBM_MEM_CLASS_GBUF_STRING, props);
+    }
     /* Registry membership is defined ONCE by cbm_label_is_registry_symbol
      * (helpers.c): callables + type-like containers (INHERITS/IMPLEMENTS/method/
      * field resolution), Variable/Field (READS/WRITES resolution), and Table/View
@@ -341,6 +400,7 @@ static void process_def(cbm_pipeline_ctx_t *ctx, const CBMDefinition *def, const
     }
     char *file_qn = cbm_pipeline_fqn_compute(ctx->project_name, rel, "__file__");
     const cbm_gbuf_node_t *file_node = cbm_gbuf_find_by_qn(ctx->gbuf, file_qn);
+    pd_add_file_doc(file_node, file_doc);
     if (file_node && node_id > 0) {
         cbm_gbuf_insert_edge(ctx->gbuf, file_node->id, node_id, "DEFINES", "{}");
     }
@@ -860,8 +920,10 @@ int cbm_pipeline_pass_definitions(cbm_pipeline_ctx_t *ctx, const cbm_file_info_t
         }
 
         /* Create nodes for each definition */
+        const char *file_doc = result->module_doc; /* goes with the first def */
         for (int d = 0; d < result->defs.count; d++) {
-            process_def(ctx, &result->defs.items[d], rel);
+            process_def(ctx, &result->defs.items[d], rel, file_doc);
+            file_doc = NULL;
             total_defs++;
         }
 
```

**File**: `src/pipeline/pass_parallel.c` (modified, +58/-2)
```diff
@@ -698,15 +698,39 @@ typedef struct {
  * to the response/logfile — this only throttles the stderr noise). */
 enum { PP_OVERSIZED_WARN_MAX = 32 };
 
+/* A def's properties buffer: CBM_SZ_2K for every other field plus the whole
+ * serialized docstring field, which has no length cap (a field that does not
+ * fit is dropped whole). Returns `stack` for a def without a docstring, or
+ * when the larger buffer cannot be allocated. Twin of pass_definitions.c --
+ * keep both in sync. */
+static char *pp_props_buf(const CBMDefinition *def, char *stack, size_t *size) {
+    if (!def->docstring || !def->docstring[0]) {
+        return stack;
+    }
+    size_t need =
+        *size + strlen("docstring") + pp_json_escaped_len(def->docstring) + PP_JSON_FIELD_OVERHEAD;
+    char *buf = cbm_alloc(CBM_MEM_CLASS_GBUF_STRING, need);
+    if (!buf) {
+        return stack;
+    }
+    *size = need;
+    return buf;
+}
+
 /* Insert one definition node (and its route if present) into the local gbuf. */
 static void insert_def_into_gbuf(extract_worker_state_t *ws, const cbm_file_info_t *fi,
                                  CBMDefinition *def) {
-    char props[CBM_SZ_2K];
-    build_def_props(props, sizeof(props), def);
+    char stack[CBM_SZ_2K];
+    size_t props_size = sizeof(stack);
+    char *props = pp_props_buf(def, stack, &props_size);
+    build_def_props(props, props_size, def);
     int64_t func_id =
         cbm_gbuf_upsert_node(ws->local_gbuf, def->label ? def->label : "Function", def->name,
                              def->qualified_name, def->file_path ? def->file_path : fi->rel_path,
                              (int)def->start_line, (int)def->end_line, props);
+    if (props != stack) {
+        cbm_free(CBM_MEM_CLASS_GBUF_STRING, props);
+    }
     ws->nodes_created++;
     if (def->route_path && def->route_path[0] != '\0') {
         const char *rm = def->route_method ? def->route_method : "ANY";
@@ -1693,6 +1717,37 @@ static int register_and_link_def(cbm_pipeline_ctx_t *ctx, const CBMDefinition *d
     return edges;
 }
 
+/* Add a file's own doc (Go package comment, Rust inner docs) to its File
+ * node as "docstring". Twin of pass_definitions.c -- keep both in sync. */
+static void pp_add_file_doc(const cbm_gbuf_node_t *file_node, const char *doc) {
+    if (!file_node || !doc || !doc[0]) {
+        return;
+    }
+    const char *old = file_node->properties_json ? file_node->properties_json : "{}";
+    size_t olen = strlen(old);
+    if (olen < PAIR_LEN || old[olen - SKIP_ONE] != '}') {
+        return; /* not a JSON object -- leave it untouched */
+    }
+    size_t cap = olen + strlen("docstring") + pp_json_escaped_len(doc) + PP_JSON_FIELD_OVERHEAD +
+                 PP_ESC_SPACE + SKIP_ONE;
+    char *neu = cbm_alloc(CBM_MEM_CLASS_GBUF_STRING, cap);
+    if (!neu) {
+        return;
+    }
+    size_t pos = olen - SKIP_ONE; /* without the closing brace */
+    memcpy(neu, old, pos);
+    neu[pos] = '\0';
+    append_json_string(neu, cap, &pos, "docstring", doc);
+    if (olen == PAIR_LEN && pos > PAIR_LEN) { /* "{}": drop the leading comma */
+        memmove(neu + SKIP_ONE, neu + PAIR_LEN, pos - SKIP_ONE);
+        pos--;
+    }
+    neu[pos++] = '}';
+    neu[pos] = '\0';
+    (void)cbm_gbuf_node_set_properties_json((cbm_gbuf_node_t *)file_node, neu);
+    cbm_free(CBM_MEM_CLASS_GBUF_STRING, neu);
+}
+
 /* Create IMPORTS edges for one file's imports (parallel path). */
 static int create_imports_edges(cbm_pipeline_ctx_t *ctx, const CBMFileResult *result,
                                 const char *rel, CBMHashTable *namespace_map) {
@@ -1827,6 +1882,7 @@ int cbm_build_registry_from_cache(cbm_pipeline_ctx_t *ctx, const cbm_file_info_t
             const cbm_gbuf_node_t *file_node = cbm_gbuf_find_by_qn(ctx->gbuf, file_qn);
             int64_t file_node_id = file_node ? file_node->id : 0;
             free(file_qn);
+            pp_add_file_doc(file_node, result->module_doc);
             for (int d = 0; d < result->defs.count; d++) {
                 defines_edges +=
                     register_and_link_def(ctx, &result->defs.items[d], file_node_id, &reg_entries);
```

**File**: `tests/test_extraction.c` (modified, +312/-7)
```diff
@@ -7120,12 +7120,12 @@ TEST(extract_python_method_test_dir_marks_is_test_issue1294) {
     PASS();
 }
 
-/* #1017: docstring truncation at MAX_COMMENT_LEN (500 bytes) can split a
+/* #1017: docstring truncation at MAX_COMMENT_LEN (500 bytes) could split a
  * multi-byte UTF-8 character, leaving an incomplete byte sequence.
  * Craft a Go comment whose 498th-500th bytes are a 3-byte CJK character
- * (U+6210 = 成 = e6 88 90).  The raw byte truncation at offset 500 lands
- * one byte past the character start, splitting it.  After the fix the
- * truncated string must end on a complete codepoint boundary. */
+ * (U+6210 = 成 = e6 88 90), where a raw byte cut at offset 500 lands one
+ * byte past the character start. Docstrings are no longer cut at all, so
+ * the whole comment is kept and still ends on a complete codepoint. */
 TEST(docstring_utf8_truncation_boundary_issue1017) {
     /* Build a comment: "// " (3 bytes) + 495 ASCII 'A' + "成成成" (9 bytes)
      * Total comment text = 3 + 495 + 9 = 507 bytes.
@@ -7166,10 +7166,10 @@ TEST(docstring_utf8_truncation_boundary_issue1017) {
     }
     ASSERT_NOT_NULL(doc);
 
-    /* Verify every byte in the truncated docstring is valid UTF-8:
-     * no trailing incomplete multi-byte sequence. */
+    /* The whole comment, and every byte of it valid UTF-8: no trailing
+     * incomplete multi-byte sequence. */
+    ASSERT_STR_EQ(doc, comment);
     size_t len = strlen(doc);
-    ASSERT_TRUE(len <= 500);
     const unsigned char *u = (const unsigned char *)doc;
     size_t i = 0;
     while (i < len) {
@@ -7195,6 +7195,298 @@ TEST(docstring_utf8_truncation_boundary_issue1017) {
     PASS();
 }
 
+/* ═══════════════════════════════════════════════════════════════════
+ * Doc comments: the whole comment run above a definition, above its
+ * attributes / export / declaration wrapper, never a detached or
+ * banner-only run, and never cut at 500 bytes.
+ * ═══════════════════════════════════════════════════════════════════ */
+
+/* The def with this label and name, or NULL. */
+static const CBMDefinition *doc_def(CBMFileResult *r, const char *label, const char *name) {
+    for (int i = 0; i < r->defs.count; i++) {
+        const CBMDefinition *d = &r->defs.items[i];
+        if (d->label && d->name && strcmp(d->label, label) == 0 && strcmp(d->name, name) == 0) {
+            return d;
+        }
+    }
+    return NULL;
+}
+
+TEST(doc_go_comment_group_without_directives) {
+    CBMFileResult *r = extract("package knob\n\n"
+                               "// Turn rotates the knob by one step.\n"
+                               "// It is safe for concurrent use.\n"
+                               "//go:noinline\n"
+                               "func Turn() {}\n",
+                               CBM_LANG_GO, "t", "knob.go");
+    ASSERT_NOT_NULL(r);
+    const CBMDefinition *d = doc_def(r, "Function", "Turn");
+    ASSERT_NOT_NULL(d);
+    /* go/ast CommentGroup.Text: the whole group, the //go: directive dropped. */
+    ASSERT_STR_EQ(d->docstring, "// Turn rotates the knob by one step.\n"
+                                "// It is safe for concurrent use.");
+    cbm_free_result(r);
+    PASS();
+}
+
+TEST(doc_go_struct_field) {
+    CBMFileResult *r = extract("package knob\n\n"
+                               "// Knob is a rotary control.\n"
+                               "type Knob struct {\n"
+                               "\t// Steps counts the turns so far.\n"
+                               "\tSteps int\n"
+                               "}\n",
+                               CBM_LANG_GO, "t", "knob.go");
+    ASSERT_NOT_NULL(r);
+    const CBMDefinition *knob = doc_def(r, "Struct", "Knob");
+    ASSERT_NOT_NULL(knob);
+    ASSERT_STR_EQ(knob->docstring, "// Knob is a rotary control.");
+    const CBMDefinition *steps = doc_def(r, "Field", "Steps");
+    ASSERT_NOT_NULL(steps);
+    ASSERT_STR_EQ(steps->docstring, "// Steps counts the turns so far.");
+    cbm_free_result(r);
+    PASS();
+}
+
+TEST(doc_go_detached_comment_is_not_doc) {
+    /* go/doc: a comment group separated by a blank line documents nothing. */
+    CBMFileResult *r = extract("package knob\n\n"
+                               "// Section: helpers.\n"
+                               "\n"
+                               "func Reset() {}\n",
+                               CBM_LANG_GO, "t", "knob.go");
+    ASSERT_NOT_NULL(r);
+    const CBMDefinition *d = doc_def(r, "Function", "Reset");
+    ASSERT_NOT_NULL(d);
+    ASSERT_NULL(d->docstring);
+    cbm_free_result(r);
+    PASS();
+}
+
+TEST(doc_python_comment_run_and_detached) {
+    CBMFileResult *r = extract("# Turns the knob.\n"
+                               "# One step per call.\n"
+                               "def turn():\n"
+                               "    pass\n"
+                               "\n"
+                               "# Section: helpers.\n"
+                               "\n"
+                               "def r
```

**File**: `tests/test_pipeline.c` (modified, +80/-0)
```diff
@@ -10317,6 +10317,83 @@ TEST(pipeline_docstring_go_class) {
     PASS();
 }
 
+/* Index one file; true when the node with this label and name stores `want` in
+ * its properties JSON. */
+static bool doc_props_contain(const char *file, const char *content, const char *label,
+                              const char *name, const char *want) {
+    const char *files[] = {file};
+    const char *contents[] = {content};
+    if (setup_lang_repo(files, contents, 1) != 0) {
+        return false;
+    }
+    char db[512];
+    snprintf(db, sizeof(db), "%s/test.db", g_lang_tmpdir);
+    cbm_pipeline_t *p = cbm_pipeline_new(g_lang_tmpdir, db, CBM_MODE_FULL);
+    bool found = false;
+    if (p && cbm_pipeline_run(p) == 0) {
+        cbm_store_t *s = cbm_store_open_path(db);
+        cbm_node_t *nodes = NULL;
+        int nc = 0;
+        if (s && cbm_store_find_nodes_by_label(s, cbm_pipeline_project_name(p), label, &nodes,
+                                               &nc) == 0) {
+            for (int i = 0; i < nc; i++) {
+                if (nodes[i].name && strcmp(nodes[i].name, name) == 0 && nodes[i].properties_json &&
+                    strstr(nodes[i].properties_json, want)) {
+                    found = true;
+                }
+            }
+            cbm_store_free_nodes(nodes, nc);
+        }
+        if (s) {
+            cbm_store_close(s);
+        }
+    }
+    if (p) {
+        cbm_pipeline_free(p);
+    }
+    teardown_lang_repo();
+    return found;
+}
+
+TEST(pipeline_doc_go_package_comment_on_file_node) {
+    /* go/doc: the comment group touching `package` documents the package; it is
+     * stored on the File node. */
+    ASSERT_TRUE(doc_props_contain("knob.go",
+                                  "// Package knob turns knobs.\n"
+                                  "package knob\n\n"
+                                  "func Turn() {}\n",
+                                  "File", "knob.go",
+                                  "\"docstring\":\"// Package knob turns knobs.\""));
+    PASS();
+}
+
+TEST(pipeline_doc_rust_inner_doc_on_file_node) {
+    ASSERT_TRUE(doc_props_contain("lib.rs",
+                                  "//! Knob crate.\n"
+                                  "//! Turns knobs.\n"
+                                  "\n"
+                                  "pub fn turn() {}\n",
+                                  "File", "lib.rs",
+                                  "\"docstring\":\"//! Knob crate.\\n//! Turns knobs.\""));
+    PASS();
+}
+
+TEST(pipeline_doc_long_docstring_stored_whole) {
+    /* A 30-line doc (longer than the old fixed 2 KB properties buffer on its
+     * own) is stored whole, and the fields after it are not dropped. */
+    char src[4096];
+    int s = snprintf(src, sizeof(src), "package knob\n\n");
+    for (int i = 0; i < 30; i++) {
+        s += snprintf(src + s, sizeof(src) - (size_t)s,
+                      "// Line %02d of a long doc comment that keeps on going.\n", i);
+    }
+    snprintf(src + s, sizeof(src) - (size_t)s, "func Long(steps int) int { return steps }\n");
+    ASSERT_TRUE(doc_props_contain("knob.go", src, "Function", "Long",
+                                  "that keeps on going.\\n// Line 29 of a long doc"));
+    ASSERT_TRUE(doc_props_contain("knob.go", src, "Function", "Long", "\"signature\":"));
+    PASS();
+}
+
 TEST(project_name_from_path) {
     /* Port of TestProjectNameFromPath — more cases than integ_pipeline_project_name */
     struct {
@@ -17547,6 +17624,9 @@ SUITE(pipeline) {
     RUN_TEST(pipeline_docstring_java_method);
     RUN_TEST(pipeline_docstring_kotlin_function);
     RUN_TEST(pipeline_docstring_go_class);
+    RUN_TEST(pipeline_doc_go_package_comment_on_file_node);
+    RUN_TEST(pipeline_doc_rust_inner_doc_on_file_node);
+    RUN_TEST(pipeline_doc_long_docstring_stored_whole);
     /* Project name */
     RUN_TEST(project_name_from_path);
     RUN_TEST(project_name_drive_letter_case_insensitive_issue394);
```

---

### Incident Patch 9: `b7f67c29` (2026-10-04)
**Commit Message**: Merge pull request #2526 from DeusData/fix/underscore-project-discovery-v2

fix(mcp): discover projects with underscore-prefixed names

**File**: `src/mcp/mcp.c` (modified, +9/-35)
```diff
@@ -19,9 +19,8 @@ enum {
     MCP_COL_7 = 7,
     MCP_COL_10 = 10,
     MCP_COL_16 = 16,
-    MCP_DB_EXT = 3,      /* strlen(".db") */
-    MCP_MIN_DB_NAME = 4, /* min length for "x.db" */
-    MCP_SEPARATOR = 2,   /* space for separator chars */
+    MCP_DB_EXT = 3,    /* strlen(".db") */
+    MCP_SEPARATOR = 2, /* space for separator chars */
     MCP_DEFAULT_DEPTH = 3,
     MCP_DEFAULT_BFS_DEPTH = 2,
     MCP_DEFAULT_LIMIT = 10,
@@ -1600,7 +1599,6 @@ static char *normalize_project_arg(char *project) {
 
 /* Forward decls — defined below alongside store resolution. */
 static const char *cache_dir(char *buf, size_t bufsz);
-static bool is_project_db_file(const char *name, size_t len);
 
 /* #1025: agents naturally pass the repo FOLDER name ("codebase-memory-mcp"),
  * but indexed project names derive from the full path
@@ -1632,7 +1630,7 @@ static char *resolve_project_tail(char *project) {
     while ((entry = cbm_readdir(d)) != NULL) {
         const char *n = entry->name;
         size_t len = strlen(n);
-        if (!is_project_db_file(n, len)) {
+        if (!cbm_is_project_index_db(n)) {
             continue;
         }
         size_t stem_len = len - MCP_DB_EXT; /* strip ".db" */
@@ -2171,14 +2169,14 @@ static const char *project_db_path(const char *project, char *buf, size_t bufsz)
  * /corrupt dbs (0-byte file, missing `projects` table, or >1 row). On success
  * the internal name is copied into name_out; if out_store is non-NULL the open
  * handle is transferred to the caller (who must cbm_store_close it). On failure
- * the store is always closed. Defined after is_project_db_file below. */
+ * the store is always closed. Defined below. */
 static bool db_internal_project_name(const char *full_path, char *name_out, size_t name_sz,
                                      cbm_store_t **out_store);
 
 /* #704 fallback: scan the cache dir for the db whose sole internal project name
  * equals `project`, returning an open store handle (caller owns it) or NULL.
  * Used only when <project>.db is absent or its internal name differs from the
- * passed name (drifted filename). Defined after is_project_db_file below. */
+ * passed name (drifted filename). Defined below. */
 static cbm_store_t *resolve_store_fallback_scan(const char *project);
 
 static bool reserve_unique_corrupt_pending(const char *path, char *pending, size_t pending_size,
@@ -2557,9 +2555,6 @@ static cbm_store_t *resolve_store(cbm_mcp_server_t *srv, const char *project) {
     return resolve_store_internal(srv, project, false, false, NULL, false);
 }
 
-/* Forward decl — definition lives below alongside list_projects. */
-static bool is_project_db_file(const char *name, size_t len);
-
 /* Forward decl — definition lives below in handle_trace_call_path's helpers. */
 static void free_node_contents(cbm_node_t *n);
 
@@ -2575,8 +2570,7 @@ static int collect_db_project_names(const char *dir_path, char *out, size_t out_
     cbm_dirent_t *entry;
     while ((entry = cbm_readdir(d)) != NULL) {
         const char *n = entry->name;
-        size_t len = strlen(n);
-        if (!is_project_db_file(n, len)) {
+        if (!cbm_is_project_index_db(n)) {
             continue;
         }
         /* #704: advertise the db's INTERNAL project name, not its filename, and
@@ -2734,23 +2728,6 @@ static bool project_has_adr(cbm_store_t *store, const char *project, const char
 
 /* ── Tool handler implementations ─────────────────────────────── */
 
-/* Return true if filename is a valid project .db file (not temp/internal).
- *
- * Project names derived from /tmp/... source roots legitimately begin with
- * "tmp-" (cbm_project_name_from_path: "/tmp/bench/..." → "tmp-bench-...";
- * see tests/test_pipeline.c fixtures), so the prefix must NOT be excluded.
- * The "_" prefix is reserved for internal/hidden DBs, and ":memory:" is the
- * SQLite in-memory marker (defensive — never appears as a real file). */
-static bool is_project_db_file(const char *name, size_t len) {
-    if (len < MCP_MIN_DB_NAME || strcmp(name + len - MCP_DB_EXT, ".db") != 0) {
-        return false;
-    }
-    if (strncmp(name, "_", SLEN("_")) == 0 || strncmp(name, ":memory:", SLEN(":memory:")) == 0) {
-        return false;
-    }
-    return true;
-}
-
 /* db_internal_project_name — see forward declaration above resolve_store. */
 static bool db_internal_project_name(const char *full_path, char *name_out, size_t name_sz,
                                      cbm_store_t **out_store) {
@@ -2803,8 +2780,7 @@ static cbm_store_t *resolve_store_fallback_scan(const char *project) {
     cbm_dirent_t *entry;
     while ((entry = cbm_readdir(d)) != NULL) {
         const char *n = entry->name;
-        size_t len = strlen(n);
-        if (!is_project_db_file(n, len)) {
+        if (!cbm_is_project_index_db(n)) {
             continue;
         }
         char full_path[CBM_SZ_2K];
@@ -3018,8 +2994,7 @@ static char *handle_list_projects(cbm_mcp_server_t *srv, const char *args) {
     cbm_
```

**File**: `tests/test_mcp.c` (modified, +183/-0)
```diff
@@ -10,6 +10,7 @@
 #include "../src/foundation/log.h"
 #include "../src/foundation/platform.h" /* cbm_file_size */
 #include "../src/foundation/mem.h"      /* cbm_mem_set_budget_for_tests — over-budget seam */
+#include "../src/foundation/str_util.h"
 #include "../src/foundation/subprocess.h"
 #include "../src/foundation/workspace.h"
 #include "../src/mcp/compact_out.h"
@@ -18334,6 +18335,186 @@ static bool issue704_make_db(const char *dir, const char *filename, const char *
     return ok;
 }
 
+/* Cache entry classification must use exact internal names. CI workspace
+ * paths can produce real project names beginning with one or more underscores. */
+TEST(tool_underscore_projects_visible_in_cache_scans) {
+    char cache[CBM_SZ_512];
+    int path_len = snprintf(cache, sizeof(cache), "%s/cbm-uscore-cache-XXXXXX", cbm_tmpdir());
+    ASSERT_TRUE(path_len > 0 && (size_t)path_len < sizeof(cache));
+    ASSERT_NOT_NULL(cbm_mkdtemp(cache));
+    const char *saved = getenv("CBM_CACHE_DIR");
+    char *saved_copy = saved ? cbm_strdup(saved) : NULL;
+    bool setup = (!saved || saved_copy) && cbm_setenv("CBM_CACHE_DIR", cache, 1) == 0;
+    bool seeded = setup &&
+                  issue704_make_db(cache, "__w-org-uscorerepo.db", "__w-org-uscorerepo",
+                                   "uscore_target_fn") &&
+                  issue704_make_db(cache, "_renamed.db", "uscore-drift", "uscore_drift_fn") &&
+                  issue704_make_db(cache, "_config-extra.db", "_config-extra", "uscore_extra_fn") &&
+                  issue704_make_db(cache, CBM_CONFIG_DB_FILENAME, "hidden-config", "hidden_fn") &&
+                  issue704_make_db(cache, CBM_CROSS_REPO_DB_FILENAME, "hidden-cross", "hidden_fn");
+    cbm_mcp_server_t *srv = seeded ? cbm_mcp_server_new(NULL) : NULL;
+    bool server_created = srv != NULL;
+    bool listed = false;
+    bool queried[3] = {false};
+    bool hinted = false;
+    bool hidden = false;
+    if (srv) {
+        char *response = cbm_mcp_handle_tool(srv, "list_projects", "{\"format\":\"json\"}");
+        char *inner = response ? extract_text_content(response) : NULL;
+        yyjson_doc *doc = inner ? yyjson_read(inner, strlen(inner), 0) : NULL;
+        if (doc) {
+            yyjson_val *root = yyjson_doc_get_root(doc);
+            yyjson_val *projects = yyjson_obj_get(root, "projects");
+            bool found[3] = {false};
+            const char *expected[] = {"__w-org-uscorerepo", "uscore-drift", "_config-extra"};
+            for (size_t i = 0; i < yyjson_arr_size(projects); i++) {
+                const char *name =
+                    yyjson_get_str(yyjson_obj_get(yyjson_arr_get(projects, i), "name"));
+                for (size_t j = 0; j < 3; j++) {
+                    found[j] = found[j] || (name && strcmp(name, expected[j]) == 0);
+                }
+            }
+            listed = yyjson_arr_size(projects) == 3 &&
+                     yyjson_get_int(yyjson_obj_get(root, "total")) == 3 && found[0] && found[1] &&
+                     found[2];
+            yyjson_doc_free(doc);
+        }
+        free(inner);
+        free(response);
+        const char *args[] = {
+            "{\"project\":\"__w-org-uscorerepo\",\"name_pattern\":\"uscore_target_fn\"}",
+            "{\"project\":\"uscorerepo\",\"name_pattern\":\"uscore_target_fn\"}",
+            "{\"project\":\"uscore-drift\",\"name_pattern\":\"uscore_drift_fn\"}"};
+        const char *targets[] = {"uscore_target_fn", "uscore_target_fn", "uscore_drift_fn"};
+        for (size_t i = 0; i < 3; i++) {
+            response = cbm_mcp_handle_tool(srv, "search_graph", args[i]);
+            queried[i] = response && !strstr(response, "\"isError\":true") &&
+                         !strstr(response, "project not found") && strstr(response, targets[i]);
+            free(response);
+        }
+        response =
+            cbm_mcp_handle_tool(srv, "search_graph",
+                                "{\"project\":\"unknown-uscore-project\",\"name_pattern\":\".*\"}");
+        hinted = response && strstr(response, "project not found") &&
+                 strstr(response, "__w-org-uscorerepo") && strstr(response, "uscore-drift") &&
+                 strstr(response, "_config-extra") && !strstr(response, "hidden-config") &&
+                 !strstr(response, "hidden-cross");
+        free(response);
+        response = cbm_mcp_handle_tool(
+            srv, "search_graph", "{\"project\":\"hidden-config\",\"name_pattern\":\"hidden_fn\"}");
+        hidden = response && strstr(response, "project not found");
+        free(response);
+    }
+    cbm_mcp_server_free(srv);
+    bool restored = !setup || (saved_copy ? cbm_setenv("CBM_CACHE_DIR", saved_copy, 1)
+                                          : cbm_unsetenv("CBM_CACHE_DIR")) == 0;
+    free(saved_copy);
+    bool removed = th_rmtree(cache) == 0;
+    ASSERT_TRUE(setup && seeded && server_created);
+    ASSERT_TRUE(restored && removed);
+    ASSERT_TRUE(listed);
+  
```

---

### Incident Patch 10: `86f49a0f` (2026-10-04)
**Commit Message**: Merge pull request #2524 from DeusData/fix/issue-1366-search-hint-v2

fix(mcp): avoid misleading empty-search filter hints

**File**: `src/mcp/mcp.c` (modified, +3/-6)
```diff
@@ -5368,12 +5368,9 @@ static char *handle_search_graph(cbm_mcp_server_t *srv, const char *args) {
     if (semantic_only && vcount == 0) {
         diagnostic_hint = "No semantic matches; use a moderate/full index or broader keywords.";
     } else if (!semantic_only && out.total == 0) {
-        if (name_pattern && label) {
-            diagnostic_hint = "No results; remove label or broaden name_pattern.";
-        } else if (name_pattern) {
-            diagnostic_hint = "No nodes match; check spelling or broaden the regex.";
-        } else if (label) {
-            diagnostic_hint = "No nodes have this label; inspect get_graph_schema.";
+        if (has_filters) {
+            diagnostic_hint =
+                "No results match the current filters; broaden or remove filters and retry.";
         }
     } else if (core_fields_requested) {
         diagnostic_hint = "Core qn/name/label/file/lines fields are already present.";
```

**File**: `tests/test_mcp.c` (modified, +182/-0)
```diff
@@ -2562,6 +2562,187 @@ TEST(tool_search_graph_basic) {
 static cbm_mcp_server_t *setup_snippet_server(char *tmp_dir, size_t tmp_sz);
 static void cleanup_snippet_dir(const char *tmp_dir);
 
+/* A real Function/name match can disappear under any additional structural
+ * filter. The diagnostic must not turn that absence into a claim about the
+ * label or spelling. Exercise the same graph through both response encodings. */
+TEST(tool_search_graph_empty_hint_describes_combined_filters_issue1366) {
+    static const char filtered_hint[] =
+        "No results match the current filters; broaden or remove filters and retry.";
+    static const char core_hint[] = "Core qn/name/label/file/lines fields are already present.";
+    static const char semantic_hint[] =
+        "No semantic matches; use a moderate/full index or broader keywords.";
+    static const struct {
+        const char *filters;
+        int total;
+        const char *hint;
+        bool semantic_only;
+    } cases[] = {
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\"", 1, NULL, false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\","
+         "\"file_pattern\":\"src/*.c\",\"qn_pattern\":\"^hint1366[.]src[.]entry$\","
+         "\"relationship\":\"CALLS\",\"min_degree\":1,\"max_degree\":1",
+         1, NULL, false},
+        {"\"label\":\"Function\",\"file_pattern\":\"missing-file-sentinel/*\"", 0, filtered_hint,
+         false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\","
+         "\"qn_pattern\":\"missing-qn-sentinel\"",
+         0, filtered_hint, false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\","
+         "\"relationship\":\"IMPORTS\"",
+         0, filtered_hint, false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\",\"min_degree\":2", 0, filtered_hint,
+         false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\",\"max_degree\":0", 0, filtered_hint,
+         false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\","
+         "\"exclude_entry_points\":true",
+         0, filtered_hint, false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\","
+         "\"file_pattern\":\"missing-file-sentinel/*\","
+         "\"qn_pattern\":\"missing-qn-sentinel\"",
+         0, filtered_hint, false},
+        {"\"file_pattern\":\"missing-file-sentinel/*\"", 0, filtered_hint, false},
+        {"\"label\":\"Function\",\"name_pattern\":\"^entry$\",\"fields\":[\"name\",\"file\"]", 1,
+         core_hint, false},
+        {"\"semantic_query\":[\"hint1366-no-vectors\"]", 0, semantic_hint, true},
+    };
+    enum { CASE_COUNT = sizeof(cases) / sizeof(cases[0]), FORMAT_COUNT = 2 };
+    char *responses[FORMAT_COUNT][CASE_COUNT] = {{0}};
+    mcp_search_cache_t cache;
+    ASSERT_TRUE(mcp_search_cache_open(&cache, "cbm-search-hint1366"));
+    cbm_mcp_server_t *srv = cbm_mcp_server_new(NULL);
+    cbm_store_t *store = srv ? cbm_mcp_server_store(srv) : NULL;
+    bool seeded = store && cbm_store_upsert_project(store, "hint1366", cache.path) == CBM_STORE_OK;
+    if (seeded) {
+        cbm_mcp_server_set_project(srv, "hint1366");
+        cbm_node_t entry = {.project = "hint1366",
+                            .label = "Function",
+                            .name = "entry",
+                            .qualified_name = "hint1366.src.entry",
+                            .file_path = "src/entry.c",
+                            .start_line = 1,
+                            .end_line = 3};
+        cbm_node_t target = {.project = "hint1366",
+                             .label = "Method",
+                             .name = "target",
+                             .qualified_name = "hint1366.src.target",
+                             .file_path = "src/target.c",
+                             .start_line = 1,
+                             .end_line = 2};
+        int64_t entry_id = cbm_store_upsert_node(store, &entry);
+        int64_t target_id = cbm_store_upsert_node(store, &target);
+        cbm_edge_t call = {
+            .project = "hint1366", .source_id = entry_id, .target_id = target_id, .type = "CALLS"};
+        /* One outgoing CALLS edge and no incoming CALLS makes entry a real
+         * entry point for the search filter, independently of properties. */
+        seeded = entry_id > 0 && target_id > 0 && cbm_store_insert_edge(store, &call) > 0;
+    }
+    bool requests_fit = true;
+    if (seeded) {
+        for (int format = 0; format < FORMAT_COUNT; format++) {
+            for (int c = 0; c < CASE_COUNT; c++) {
+                char args[1024];
+                int written =
+                    snprintf(args, sizeof(args), "{\"project\":\"hint1366\",\"format\":\"%s\",%s}",
+                             format == 0 ? "tree" : "json", cases[c].filters);
+                bool fits = written > 0 && (size_t)written < sizeof(args);
+                requests_fit = requests_fit && fits;
+                if (fit
```

---

### Incident Patch 11: `369cf768` (2026-10-04)
**Commit Message**: Merge pull request #2523 from DeusData/fix/issue-514-constructor-fields-v2

fix(typescript): resolve constructor properties and new-initialized fields

**File**: `internal/cbm/lsp/ts_lsp.c` (modified, +97/-17)
```diff
@@ -1998,6 +1998,22 @@ static const CBMType *ts_new_bare_class_type(TSLSPContext *ctx, const char *cnam
     return cbm_type_named(ctx->arena, local_qn);
 }
 
+/* Type of a `new_expression`: a bare constructor name follows TS scoping
+ * (ts_new_bare_class_type), a dotted one is taken as spelled. NULL when the
+ * node carries no constructor. Shared by expression evaluation and by the
+ * field-initializer inference in ast_sweep_shapes, so `const t = new C()`
+ * and `private t = new C()` type the instance identically. */
+static const CBMType *ts_new_expression_type(TSLSPContext *ctx, TSNode node) {
+    TSNode ctor = ts_node_child_by_field_name(node, "constructor", TS_LSP_FIELD_LEN("constructor"));
+    if (ts_node_is_null(ctor))
+        return NULL;
+    char *cname = node_text(ctx, ctor);
+    if (!cname)
+        return NULL;
+    return strchr(cname, '.') == NULL ? ts_new_bare_class_type(ctx, cname)
+                                      : cbm_type_named(ctx->arena, cname);
+}
+
 static const CBMRegisteredFunc *ts_lookup_namespace_call(TSLSPContext *ctx, const char *object_name,
                                                          const char *method_name, TSNode args,
                                                          bool *out_is_import) {
@@ -2223,15 +2239,9 @@ const CBMType *ts_eval_expr_type(TSLSPContext *ctx, TSNode node) {
                 result = lookup_member_type(ctx, recv, pname);
         }
     } else if (strcmp(kind, "new_expression") == 0) {
-        TSNode ctor =
-            ts_node_child_by_field_name(node, "constructor", TS_LSP_FIELD_LEN("constructor"));
-        if (!ts_node_is_null(ctor)) {
-            char *cname = node_text(ctx, ctor);
-            if (cname) {
-                result = strchr(cname, '.') == NULL ? ts_new_bare_class_type(ctx, cname)
-                                                    : cbm_type_named(ctx->arena, cname);
-            }
-        }
+        const CBMType *nt = ts_new_expression_type(ctx, node);
+        if (nt)
+            result = nt;
     } else if (strcmp(kind, "call_expression") == 0) {
         TSNode fn = ts_node_child_by_field_name(node, "function", TS_LSP_FIELD_LEN("function"));
         if (!ts_node_is_null(fn)) {
@@ -5357,6 +5367,76 @@ static const CBMType *interface_method_signature_from_ast(TSLSPContext *ctx, TSN
     return cbm_type_func(ctx->arena, NULL, param_count ? param_types : NULL, return_types);
 }
 
+/* Parsed type of a `type_annotation` field (`: T`), or unknown. */
+static const CBMType *ts_annotation_field_type(TSLSPContext *ctx, TSNode owner) {
+    TSNode tann = ts_node_child_by_field_name(owner, "type", TS_LSP_FIELD_LEN("type"));
+    if (ts_node_is_null(tann))
+        return cbm_type_unknown();
+    TSNode tn =
+        strcmp(ts_node_type(tann), "type_annotation") == 0 ? ts_node_named_child(tann, 0) : tann;
+    return ts_node_is_null(tn) ? cbm_type_unknown() : ts_parse_type_node(ctx, tn);
+}
+
+/* Declared type of a class field (`public_field_definition`) or interface
+ * property: the annotation when present, else, for an unannotated field
+ * initialised with `new C()`, the type of that instance (#514). No other
+ * initializer is inferred: `new` names its type exactly, arbitrary
+ * expressions do not. */
+static const CBMType *ts_field_decl_type(TSLSPContext *ctx, TSNode m) {
+    if (!ts_node_is_null(ts_node_child_by_field_name(m, "type", TS_LSP_FIELD_LEN("type"))))
+        return ts_annotation_field_type(ctx, m);
+    TSNode val = ts_node_child_by_field_name(m, "value", TS_LSP_FIELD_LEN("value"));
+    if (ts_node_is_null(val) || strcmp(ts_node_type(val), "new_expression") != 0)
+        return cbm_type_unknown();
+    const CBMType *nt = ts_new_expression_type(ctx, val);
+    return nt ? nt : cbm_type_unknown();
+}
+
+/* A constructor parameter is a TS parameter property, i.e. also declares a
+ * class field, iff it carries an accessibility modifier, `readonly` or
+ * `override`. */
+static bool ts_param_is_property(TSNode p) {
+    uint32_t pc = ts_node_child_count(p);
+    for (uint32_t ci = 0; ci < pc; ci++) {
+        const char *ck = ts_node_type(ts_node_child(p, ci));
+        if (strcmp(ck, "accessibility_modifier") == 0 || strcmp(ck, "readonly") == 0 ||
+            strcmp(ck, "override_modifier") == 0)
+            return true;
+    }
+    return false;
+}
+
+/* Append the parameter properties of a `constructor` method_definition to
+ * the field arrays (#514): `constructor(private readonly svc: Svc)` declares
+ * field `svc: Svc`, the dominant NestJS injection shape. Any other member is
+ * ignored. Returns the new field count. */
+static int ts_collect_param_properties(TSLSPContext *ctx, TSNode m, const char **names,
+                                       const CBMType **types, int count, int cap) {
+    TSNode mname = ts_node_child_by_field_name(m, "name", TS_LSP_FIELD_LEN("name"));
+    char *mnm = ts_node_is_null(mname) ? NULL : node_text(ctx, mname);
+    if (!mnm || strcmp(mnm
```

**File**: `tests/test_pipeline.c` (modified, +249/-0)
```diff
@@ -6343,6 +6343,254 @@ TEST(pipeline_ts_crossfile_new_instance_method_call_issue1354) {
     PASS();
 }
 
+/* A query failure is distinct from a valid zero-edge result. */
+static int ts514_pipeline_count(cbm_store_t *store, const char *sql, const char **values,
+                                int value_count) {
+    sqlite3_stmt *stmt = NULL;
+    sqlite3 *db = cbm_store_get_db(store);
+    if (!db || sqlite3_prepare_v2(db, sql, -1, &stmt, NULL) != SQLITE_OK) {
+        sqlite3_finalize(stmt);
+        return -1;
+    }
+    bool bound = sqlite3_bind_parameter_count(stmt) == value_count;
+    for (int i = 0; bound && i < value_count; i++)
+        bound = values[i] &&
+                sqlite3_bind_text(stmt, i + 1, values[i], -1, SQLITE_TRANSIENT) == SQLITE_OK;
+    int count = -1;
+    if (bound && sqlite3_step(stmt) == SQLITE_ROW) {
+        count = sqlite3_column_int(stmt, 0);
+        if (sqlite3_step(stmt) != SQLITE_DONE)
+            count = -1;
+    }
+    if (sqlite3_finalize(stmt) != SQLITE_OK)
+        count = -1;
+    return count;
+}
+
+/* #514: constructor injection and new-initialized fields resolve through both
+ * drivers. Same-named methods make wrong-owner and self-loop claims meaningful.
+ * Every negative has a real extracted call, source and target, plus successful
+ * queries and typed positive controls in the same run. */
+TEST(pipeline_ts_param_property_injection_issue514) {
+    static const char *paths[] = {"cats/service.ts", "cats/controller.ts", "cats/reporter.ts"};
+    static const char *sources[] = {
+        "export class BaseService { findAll(): string[] { return []; } }\n"
+        "export class CatService extends BaseService { findAll(): string[] { return ['cat']; } }\n",
+        "import { CatService } from './service';\n"
+        "export class CatController {\n"
+        "  constructor(private readonly catService: CatService, plain: CatService) {}\n"
+        "  findAll() { return this.catService.findAll(); }\n"
+        "  direct(control: CatService) { return control.findAll(); }\n"
+        "  viaPlain() { return this.plain.findAll(); }\n"
+        "}\n",
+        "import { CatService, BaseService } from './service';\n"
+        "function makeService(): CatService { return new CatService(); }\n"
+        "export class CatReporter {\n"
+        "  private fresh = new CatService();\n"
+        "  private annotated: BaseService = new CatService();\n"
+        "  private factory = makeService();\n"
+        "  constructor(protected cats: CatService) {}\n"
+        "  reportInjected() { return this.cats.findAll(); }\n"
+        "  reportLocal() { return this.fresh.findAll(); }\n"
+        "  reportAnnotated() { return this.annotated.findAll(); }\n"
+        "  reportFactory() { return this.factory.findAll(); }\n"
+        "}\n",
+    };
+    static const struct {
+        int file;
+        const char *symbol;
+        const char *expression;
+        const char *callee;
+        const char *target;
+        int want;
+    } cases[] = {
+        {1, "CatController.direct", "control.findAll()", "control.findAll", "CatService.findAll",
+         1},
+        {1, "CatController.findAll", "this.catService.findAll()", "this.catService.findAll",
+         "CatService.findAll", 1},
+        {2, "CatReporter.reportInjected", "this.cats.findAll()", "this.cats.findAll",
+         "CatService.findAll", 1},
+        {2, "CatReporter.reportLocal", "this.fresh.findAll()", "this.fresh.findAll",
+         "CatService.findAll", 1},
+        {2, "CatReporter.reportAnnotated", "this.annotated.findAll()", "this.annotated.findAll",
+         "BaseService.findAll", 1},
+        {1, "CatController.viaPlain", "this.plain.findAll()", "this.plain.findAll",
+         "CatService.findAll", 0},
+        {2, "CatReporter.reportFactory", "this.factory.findAll()", "this.factory.findAll",
+         "CatService.findAll", 0},
+    };
+    enum { NCASES = (int)(sizeof(cases) / sizeof(cases[0])) };
+    static const char node_sql[] = "SELECT count(*) FROM nodes WHERE project=?1 AND "
+                                   "qualified_name=?2 AND file_path=?3 AND label='Method'";
+    static const char edge_sql[] =
+        "SELECT count(*) FROM edges e JOIN nodes s ON s.id=e.source_id JOIN nodes t ON "
+        "t.id=e.target_id "
+        "WHERE e.project=?1 AND e.type='CALLS' AND s.qualified_name=?2 AND s.file_path=?3 "
+        "AND t.qualified_name=?4 AND t.file_path=?5 "
+        "AND (?6='' OR json_extract(e.properties,'$.strategy')=?6)";
+
+    CBMFileResult *fr[3] = {0};
+    bool extraction_ok = true;
+    for (int i = 0; i < 3; i++) {
+        fr[i] = cbm_extract_file(sources[i], (int)strlen(sources[i]), CBM_LANG_TYPESCRIPT,
+                                 "ts514_probe", paths[i], 0, NULL, NULL);
+        extraction_ok = extraction_ok && fr[i] && !fr[i]->has_error;
+    }
+    int occurrences[NCASES] = {0};
+    if (extraction_ok) {
+        for (int i = 0; i < NCASES; i++) {
+            int file 
```

**File**: `tests/test_ts_lsp.c` (modified, +318/-7)
```diff
@@ -1929,16 +1929,77 @@ TEST(tslsp_class_multi_inheritance_chain) {
     PASS();
 }
 
+/* #514 probes bind both positive and negative claims to one parser-backed
+ * occurrence. Same-named methods on other classes cannot satisfy them. */
+static const CBMCall *ts514_call_site(const CBMFileResult *r, const char *source,
+                                      const char *expression, const char *caller,
+                                      const char *callee) {
+    const char *site = strstr(source, expression);
+    if (!r || r->has_error || !site || strstr(site + 1, expression))
+        return NULL;
+    uint32_t start = (uint32_t)(site - source);
+    uint32_t end = start + (uint32_t)strlen(expression);
+    const CBMCall *found = NULL;
+    for (int i = 0; i < r->calls.count; i++) {
+        const CBMCall *call = &r->calls.items[i];
+        if (call->enclosing_func_qn && strcmp(call->enclosing_func_qn, caller) == 0 &&
+            call->callee_name && strcmp(call->callee_name, callee) == 0 &&
+            call->site_start_byte == start && call->site_end_byte == end && call->start_line > 0) {
+            if (found)
+                return NULL;
+            found = call;
+        }
+    }
+    return found;
+}
+
+static int ts514_resolved_count(const CBMResolvedCallArray *resolved, const CBMCall *call,
+                                const char *target, const char *strategy) {
+    if (!call)
+        return -1;
+    int count = 0;
+    for (int i = 0; i < resolved->count; i++) {
+        const CBMResolvedCall *rc = &resolved->items[i];
+        if (rc->kind == CBM_RESOLVED_INVOCATION && rc->confidence > 0 && rc->caller_qn &&
+            strcmp(rc->caller_qn, call->enclosing_func_qn) == 0 && rc->callee_qn &&
+            (!target || strcmp(rc->callee_qn, target) == 0) &&
+            rc->site_start_byte == call->site_start_byte &&
+            rc->site_end_byte == call->site_end_byte &&
+            (!strategy || (rc->strategy && strcmp(rc->strategy, strategy) == 0)))
+            count++;
+    }
+    return count;
+}
+
+static int ts514_definition_count(const CBMFileResult *r, const char *qn) {
+    int count = 0;
+    for (int i = 0; r && i < r->defs.count; i++) {
+        if (r->defs.items[i].qualified_name && strcmp(r->defs.items[i].qualified_name, qn) == 0)
+            count++;
+    }
+    return count;
+}
+
 TEST(tslsp_class_constructor_param_property) {
-    /* TS shorthand: constructor params with access modifiers become fields. */
-    CBMFileResult *r = extract_ts("class Tool { fire(): void {} }\n"
-                                  "class Box {\n"
-                                  "    constructor(public tool: Tool) {}\n"
-                                  "}\n"
-                                  "function go(b: Box) { b.tool.fire(); }\n");
+    const char *source = "class Tool { fire(): void {} }\n"
+                         "class Box { constructor(public tool: Tool) {} }\n"
+                         "function direct(directTool: Tool) { directTool.fire(); }\n"
+                         "function throughBox(b: Box) { b.tool.fire(); }\n";
+    CBMFileResult *r = extract_ts(source);
     ASSERT_NOT_NULL(r);
-    /* Constructor parameter property — accept smoke pass for v1 */
+    const CBMCall *direct =
+        ts514_call_site(r, source, "directTool.fire()", "test.main.direct", "directTool.fire");
+    const CBMCall *field =
+        ts514_call_site(r, source, "b.tool.fire()", "test.main.throughBox", "b.tool.fire");
+    int target = ts514_definition_count(r, "test.main.Tool.fire");
+    int positive =
+        ts514_resolved_count(&r->resolved_calls, direct, "test.main.Tool.fire", "lsp_ts_method");
+    int property =
+        ts514_resolved_count(&r->resolved_calls, field, "test.main.Tool.fire", "lsp_ts_method");
     cbm_free_result(r);
+    ASSERT_EQ(target, 1);
+    ASSERT_EQ(positive, 1);
+    ASSERT_EQ(property, 1);
     PASS();
 }
 
@@ -2246,6 +2307,253 @@ TEST(tslsp_crossfile_same_name_file_receiver_issue1354) {
     PASS();
 }
 
+/* #514: parameter properties participate in this-dispatch for each modifier
+ * form, while an unmarked constructor parameter remains a local parameter. */
+TEST(tslsp_param_property_this_dispatch_issue514) {
+    const char *source =
+        "class ServiceBase { findAll(): string[] { return []; } }\n"
+        "class CatService extends ServiceBase { findAll(): string[] { return []; } }\n"
+        "class Parent { inherited: ServiceBase; }\n"
+        "class CatController extends Parent {\n"
+        "  constructor(private readonly catService: CatService, private a: CatService,\n"
+        "    protected b: CatService, public c: CatService, readonly d: CatService,\n"
+        "    public override inherited: CatService, plain: CatService,\n"
+        "    private optional?: CatService) { super(); }\n"
+        "  findAll() { return this.catService.findAll(); }\n"
+        "  viaPrivate() { this.a.findAll(); }\n"
+        "  viaProtected() { this.b.fin
```

---

### Incident Patch 12: `266e2814` (2026-10-04)
**Commit Message**: Merge pull request #2518 from DeusData/fix/search-code-scratch-isolation-v2

test(mcp): isolate search scratch cleanup fixtures

**File**: `src/mcp/mcp.c` (modified, +25/-4)
```diff
@@ -1782,6 +1782,7 @@ struct cbm_mcp_server {
 #endif
     size_t search_output_limit_override;
     const char *search_scan_command_override;
+    const char *search_scratch_dir_override; /* NULL = cbm_tmpdir() */
     uint64_t search_scan_timeout_override_ms;
     bool search_scan_timeout_override_set;
     cbm_thread_t autoindex_tid;
@@ -2120,6 +2121,12 @@ void cbm_mcp_server_set_search_scan_timeout_for_test(cbm_mcp_server_t *srv, uint
         srv->search_scan_timeout_override_set = override_set;
     }
 }
+
+void cbm_mcp_server_set_search_scratch_dir_for_test(cbm_mcp_server_t *srv, const char *dir) {
+    if (srv) {
+        srv->search_scratch_dir_override = dir;
+    }
+}
 #ifdef CBM_ENABLE_TEST_SEAMS
 void cbm_mcp_server_set_snapshot_read_test_hook(cbm_mcp_server_t *srv,
                                                 cbm_mcp_snapshot_read_test_hook_fn hook,
@@ -14944,14 +14951,14 @@ static void search_scratch_close(search_scratch_t *scratch) {
 /* Open the scratch directory, write `pattern` to the grep -f file, and leave the
  * file list open for write_scoped_filelist. Returns true on success; on failure
  * everything already created is removed before returning. */
-static bool search_scratch_open(search_scratch_t *scratch, const char *pattern) {
+static bool search_scratch_open(search_scratch_t *scratch, const char *parent,
+                                const char *pattern) {
     scratch->dir[0] = '\0';
     scratch->pattern_path[0] = '\0';
     scratch->filelist_path[0] = '\0';
     scratch->filelist = NULL;
 
-    int written =
-        snprintf(scratch->dir, sizeof(scratch->dir), "%s/cbm-search-XXXXXX", cbm_tmpdir());
+    int written = snprintf(scratch->dir, sizeof(scratch->dir), "%s/cbm-search-XXXXXX", parent);
     if (written <= 0 || (size_t)written >= sizeof(scratch->dir) || !cbm_mkdtemp(scratch->dir)) {
         scratch->dir[0] = '\0';
         return false;
@@ -15142,13 +15149,19 @@ static char *handle_search_code(cbm_mcp_server_t *srv, const char *args) {
     path_filter = NULL;
 
     if (!pattern) {
+        if (has_path_filter) {
+            cbm_regfree(&path_regex);
+        }
         free(project);
         free(file_pattern);
         return cbm_mcp_text_result("pattern is required", true);
     }
 
     /* Project is required */
     if (!project) {
+        if (has_path_filter) {
+            cbm_regfree(&path_regex);
+        }
         free(pattern);
         free(file_pattern);
         char *_err = build_project_list_error("project is required");
@@ -15159,6 +15172,9 @@ static char *handle_search_code(cbm_mcp_server_t *srv, const char *args) {
 
     char *root_path = get_project_root(srv, project);
     if (!root_path) {
+        if (has_path_filter) {
+            cbm_regfree(&path_regex);
+        }
         free(pattern);
         free(project);
         free(file_pattern);
@@ -15246,12 +15262,17 @@ static char *handle_search_code(cbm_mcp_server_t *srv, const char *args) {
                                     : scan_started_ms + scan_budget_ms;
     bool scan_deadline_latched = false;
     search_scratch_t scratch;
-    if (!search_scratch_open(&scratch, pattern)) {
+    const char *scratch_parent =
+        srv->search_scratch_dir_override ? srv->search_scratch_dir_override : cbm_tmpdir();
+    if (!search_scratch_open(&scratch, scratch_parent, pattern)) {
         bool scan_cancelled = mcp_request_cancelled(srv);
         bool scan_timed_out = cbm_now_ms() >= scan_deadline_ms;
         char errmsg[CBM_SZ_256];
         snprintf(errmsg, sizeof(errmsg), "search failed: cannot create temp file (%s)",
                  strerror(errno));
+        if (has_path_filter) {
+            cbm_regfree(&path_regex);
+        }
         free(root_path);
         free(pattern);
         free(project);
```

**File**: `src/mcp/mcp_internal.h` (modified, +5/-0)
```diff
@@ -29,6 +29,11 @@ void cbm_mcp_server_set_auto_index_count_test_hook(cbm_mcp_server_t *srv,
 void cbm_mcp_server_set_search_scan_command_for_test(cbm_mcp_server_t *srv, const char *command);
 void cbm_mcp_server_set_search_scan_timeout_for_test(cbm_mcp_server_t *srv, uint64_t timeout_ms,
                                                      bool override_set);
+/* Parent directory for search_code's private cbm-search-XXXXXX scratch
+ * (NULL restores cbm_tmpdir()). Tests point it at a private directory so a
+ * scratch count cannot see other processes' entries in the shared temp dir.
+ * The server borrows dir until it is reset or the server is freed. */
+void cbm_mcp_server_set_search_scratch_dir_for_test(cbm_mcp_server_t *srv, const char *dir);
 
 /* Release only the constructor-created pristine in-memory store. Public
  * cbm_mcp_server_new(NULL) semantics remain unchanged; daemon sessions use
```

**File**: `tests/test_mcp.c` (modified, +100/-11)
```diff
@@ -174,8 +174,14 @@ typedef struct {
     bool output_filled;
     int calls;
     char command[CBM_SZ_4K];
+    /* When set, the hook counts cbm-search-* entries here at spawn time, which
+     * proves the scan's scratch really lives in this private directory. */
+    const char *scratch_directory;
+    int scratch_seen;
 } mcp_search_command_probe_t;
 
+static int mcp_count_directory_entries_with_prefix(const char *directory, const char *prefix);
+
 typedef struct {
     char path[512];
     char *saved_cache;
@@ -213,6 +219,10 @@ static bool mcp_search_command_hook_probe(void *context, const char *command) {
     }
     probe->calls++;
     snprintf(probe->command, sizeof(probe->command), "%s", command);
+    if (probe->scratch_directory) {
+        probe->scratch_seen =
+            mcp_count_directory_entries_with_prefix(probe->scratch_directory, "cbm-search-");
+    }
     if (probe->delay_ms > 0) {
         cbm_usleep(probe->delay_ms * 1000U);
     }
@@ -9228,6 +9238,41 @@ TEST(tool_search_code_no_project) {
     PASS();
 }
 
+/* search_code compiles path_filter into a regex before it checks pattern,
+ * project and the project root. Every one of those early error returns must
+ * release the compiled regex. The leak itself is only visible to a leak
+ * detector such as LeakSanitizer, so this test drives each return with a valid
+ * path_filter and asserts the error taken. */
+TEST(search_code_early_errors_release_path_filter_regex) {
+    cbm_mcp_server_t *srv = cbm_mcp_server_new(NULL);
+    ASSERT_NOT_NULL(srv);
+
+    /* No pattern. */
+    char *resp = cbm_mcp_handle_tool(
+        srv, "search_code", "{\"project\":\"nonexistent\",\"path_filter\":\"^cbm_leak_probe/\"}");
+    bool pattern_error = resp && strstr(resp, "pattern is required") != NULL;
+    free(resp);
+
+    /* No project. */
+    resp = cbm_mcp_handle_tool(srv, "search_code",
+                               "{\"pattern\":\"main\",\"path_filter\":\"^cbm_leak_probe/\"}");
+    bool project_error = resp && strstr(resp, "project is required") != NULL;
+    free(resp);
+
+    /* Unknown project, with a file_pattern alongside the path filter. */
+    resp = cbm_mcp_handle_tool(srv, "search_code",
+                               "{\"pattern\":\"main\",\"project\":\"nonexistent\","
+                               "\"file_pattern\":\"*.c\",\"path_filter\":\"^cbm_leak_probe/\"}");
+    bool root_error = resp && strstr(resp, "project not found or not indexed") != NULL;
+    free(resp);
+
+    cbm_mcp_server_free(srv);
+    ASSERT_TRUE(pattern_error);
+    ASSERT_TRUE(project_error);
+    ASSERT_TRUE(root_error);
+    PASS();
+}
+
 TEST(search_code_multi_word) {
     char tmp[512];
     cbm_mcp_server_t *srv = setup_snippet_server(tmp, sizeof(tmp));
@@ -11293,13 +11338,14 @@ TEST(search_code_output_limit_fails_closed_and_cleans_scan) {
 TEST(search_code_scan_deadline_fails_closed_and_resets) {
     mcp_search_cache_t cache;
     ASSERT_TRUE(mcp_search_cache_open(&cache, "cbm-search-deadline"));
-    int scratch_before = mcp_count_directory_entries_with_prefix(cbm_tmpdir(), "cbm-search-");
-    ASSERT_TRUE(scratch_before >= 0);
 
     char tmp[512], src_path[768], vendor_path[768];
     cbm_mcp_server_t *srv = setup_prefilter_server(tmp, sizeof(tmp), src_path, sizeof(src_path),
                                                    vendor_path, sizeof(vendor_path));
     ASSERT_NOT_NULL(srv);
+    /* Scratch goes to the private cache dir: the shared temp dir is visible to
+     * every other process on the machine, so a count there is not exact. */
+    cbm_mcp_server_set_search_scratch_dir_for_test(srv, cache.path);
     cbm_mcp_server_set_search_scan_timeout_for_test(srv, 0, true);
 
     char *response =
@@ -11323,7 +11369,7 @@ TEST(search_code_scan_deadline_fails_closed_and_resets) {
     /* An immediate deadline can return before the log directory is created;
      * both a missing directory (-1) and an empty one (0) prove no artifact. */
     ASSERT_TRUE(mcp_count_directory_entries_with_prefix(logs, ".mcp-command-") <= 0);
-    ASSERT_EQ(mcp_count_directory_entries_with_prefix(cbm_tmpdir(), "cbm-search-"), scratch_before);
+    ASSERT_EQ(mcp_count_directory_entries_with_prefix(cache.path, "cbm-search-"), 0);
     free(response);
 
     cbm_mcp_server_set_search_scan_timeout_for_test(srv, 0, false);
@@ -11424,13 +11470,14 @@ TEST(search_code_scan_setup_failures_respect_cause_precedence) {
 TEST(search_code_scan_live_child_deadline_is_bounded_and_fails_closed) {
     mcp_search_cache_t cache;
     ASSERT_TRUE(mcp_search_cache_open(&cache, "cbm-search-live-deadline"));
-    int scratch_before = mcp_count_directory_entries_with_prefix(cbm_tmpdir(), "cbm-search-");
-    ASSERT_TRUE(scratch_before >= 0);
 
     char tmp[512], src_path[768], vendor_path[768];
     cbm_mcp_server_t *srv = setup_prefilter_server(tmp, sizeof(tmp), src_path, sizeof(src_path),
                                                    vendor_path, sizeof(vendor_path));
    
```

---

### Incident Patch 13: `5e6fa657` (2026-10-04)
**Commit Message**: Merge pull request #2517 from DeusData/fix/uninstall-keeps-indexes-v2

fix(cli): keep project indexes by default during uninstall

**File**: `README.md` (modified, +8/-1)
```diff
@@ -185,7 +185,14 @@ Installed through **npm or pip**? Update with your package manager on every plat
 codebase-memory-mcp uninstall
 ```
 
-Removes owned agent config entries, skills, hooks, instructions, and the installed binary. Existing graph indexes are listed and deleted only after confirmation.
+Removes owned agent config entries, skills, hooks, instructions, and the installed binary. Existing graph indexes are listed and **kept by default**. `-y`/`--yes`, `-n`/`--no`, and noninteractive input keep them unless `--delete-indexes` is explicitly given. An interactive terminal without that flag is asked separately; the default answer is to keep them.
+
+```bash
+codebase-memory-mcp uninstall -y --delete-indexes   # also delete every project index
+codebase-memory-mcp uninstall --dry-run --delete-indexes   # preview; change nothing
+```
+
+`--delete-indexes` is explicit consent and takes precedence over `--no`; `--dry-run` always preserves the files. When indexes are kept, uninstall prints their cache directory (`${CBM_CACHE_DIR:-~/.cache/codebase-memory-mcp}`) and how to remove them.
 
 The install script placed beside the binary is **reported, not deleted** — uninstall prints its path and the `rm` command for it. It is left alone on purpose: it may be your own copy, a symlink into a checkout, or managed by a package manager, and an uninstaller should not delete a file it cannot prove it owns.
 
```

**File**: `pkg/npm/README.md` (modified, +3/-1)
```diff
@@ -55,9 +55,11 @@ codebase-memory-mcp install          # configure all detected coding agents
 codebase-memory-mcp --version
 codebase-memory-mcp --help
 codebase-memory-mcp update           # update to latest release
-codebase-memory-mcp uninstall        # remove agent configs
+codebase-memory-mcp uninstall        # remove agent configs; keep indexes by default
 ```
 
+Uninstall keeps project indexes with `--yes`, `--no`, or noninteractive input unless you explicitly add `--delete-indexes`. An interactive terminal without the flag asks separately and defaults to keeping them. `--delete-indexes` overrides `--no`; add `--dry-run` to preview without changing files. Kept indexes remain in the cache directory printed by uninstall.
+
 ### CLI Mode
 
 Every MCP tool is also available directly from the command line:
```

**File**: `src/cli/cli.c` (modified, +54/-26)
```diff
@@ -12943,6 +12943,41 @@ static int cli_uninstall_activate(void *opaque) {
     return CLI_OK;
 }
 
+/* A generic auto-answer is not consent to erase project indexes. An explicit
+ * --delete-indexes takes precedence even over --no; otherwise only a separate
+ * interactive answer can select deletion. This helper decides and reports,
+ * but all deletion remains in the final guarded uninstall activation. */
+static bool uninstall_decide_index_deletion(const char *home, bool requested, bool dry_run) {
+    int index_count = count_db_indexes(home);
+    if (index_count <= 0) {
+        return false;
+    }
+    printf("\nFound %d index(es):\n", index_count);
+    cbm_list_indexes(home);
+    bool delete_indexes = requested;
+    if (!requested) {
+        bool can_ask = g_auto_answer == 0;
+#ifdef _WIN32
+        can_ask = can_ask && _isatty(_fileno(stdin));
+#else
+        can_ask = can_ask && isatty(fileno(stdin));
+#endif
+        delete_indexes = can_ask && prompt_yn("Delete these indexes? (default: no)");
+    }
+    if (!delete_indexes) {
+        const char *cache_dir = get_cache_dir(home);
+        printf("Indexes kept in %s. To remove them, uninstall with --delete-indexes "
+               "or delete the project .db files there.\n",
+               cache_dir ? cache_dir : "the cache directory");
+        return false;
+    }
+    if (dry_run) {
+        printf("(dry-run — indexes would be deleted)\n");
+        return false;
+    }
+    return true;
+}
+
 int cbm_cmd_uninstall(int argc, char **argv) {
     /* `uninstall --help` used to UNINSTALL.
      *
@@ -12956,20 +12991,25 @@ int cbm_cmd_uninstall(int argc, char **argv) {
      * cannot auto-confirm the destruction we are trying to prevent. */
     for (int i = 0; i < argc; i++) {
         if (argv && argv[i] && (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0)) {
-            printf("Usage: codebase-memory-mcp uninstall [options]\n\n"
-                   "Removes the codebase-memory-mcp binary, its agent configurations and,\n"
-                   "with confirmation, its indexes. THIS IS DESTRUCTIVE.\n\n"
-                   "Options:\n"
-                   "  --dry-run        Show what would be removed, change nothing\n"
-                   "  --dir=PATH       Uninstall from a custom install directory\n"
-                   "  -y, --yes        Do not prompt for confirmation\n"
-                   "  -h, --help       Show this help and exit\n\n"
-                   "Run with --dry-run first if you are unsure.\n");
+            printf(
+                "Usage: codebase-memory-mcp uninstall [options]\n\n"
+                "Removes the codebase-memory-mcp binary and its agent configurations.\n"
+                "THIS IS DESTRUCTIVE. Project indexes are kept by default. An interactive\n"
+                "terminal is asked separately; the default answer is to keep them.\n\n"
+                "Options:\n"
+                "  --dry-run          Show what would be removed, change nothing\n"
+                "  --dir=PATH         Uninstall from a custom install directory\n"
+                "  --delete-indexes   Also delete every project index (overrides --no)\n"
+                "  -y, --yes          Do not prompt; indexes are kept unless explicitly deleted\n"
+                "  -n, --no           Decline prompts; --delete-indexes still takes precedence\n"
+                "  -h, --help         Show this help and exit\n\n"
+                "Run with --dry-run first if you are unsure.\n");
             return CLI_OK;
         }
     }
     parse_auto_answer(argc, argv);
     bool dry_run = false;
+    bool delete_indexes_requested = false;
     /* An install into a custom --dir must be removable from that same dir:
      * without this, anyone who installed outside ~/.local/bin has no supported
      * uninstall path at all. Mirrors cbm_cmd_install's parsing. */
@@ -12982,6 +13022,8 @@ int cbm_cmd_uninstall(int argc, char **argv) {
         }
         if (strcmp(argv[i], "--dry-run") == 0) {
             dry_run = true;
+        } else if (strcmp(argv[i], "--delete-indexes") == 0) {
+            delete_indexes_requested = true;
         } else if (strncmp(argv[i], "--dir=", SLEN("--dir=")) == 0) {
             requested_bin_dir = argv[i] + SLEN("--dir=");
             if (!requested_bin_dir[0]) {
@@ -13013,23 +13055,9 @@ int cbm_cmd_uninstall(int argc, char **argv) {
     agent_uninstall_failures_reset();
     cbm_detected_agents_t agents = cbm_detect_agents(home);
 
-    /* Confirm index removal outside the startup lock, but defer the mutation
-     * until the final guarded activation. Dry-run never removes indexes. */
-    bool delete_indexes = false;
-    int index_count = count_db_indexes(home);
-    if (index_count > 0) {
-        printf("\nFound %d index(es):\n", index_count);
-        cbm_list_indexes(home);
-        if (prompt_yn("Delete these indexes?")) {
-            if (dry_run) {
-                printf("(dry-run — indexes wou
```

**File**: `src/main.c` (modified, +1/-1)
```diff
@@ -1107,7 +1107,7 @@ static void print_help(void) {
            "[--dir=<path>] [--skip-config]\n");
     printf("                                      [--clients=<tokens>]  Run "
            "'install --clients' to list tokens\n");
-    printf("  codebase-memory-mcp uninstall [-y|-n] [--dry-run]\n");
+    printf("  codebase-memory-mcp uninstall [-y|-n] [--dry-run] [--delete-indexes]\n");
     printf("  codebase-memory-mcp update [-y|-n]\n");
     printf("  codebase-memory-mcp config <list|get|set|reset>\n");
     printf("  codebase-memory-mcp --version    Print version\n");
```

**File**: `tests/test_cli.c` (modified, +339/-8)
```diff
@@ -39,6 +39,9 @@
 #include <stdio.h>
 #include <sys/stat.h>
 #include <unistd.h>
+#ifdef _WIN32
+#include <io.h>
+#endif
 #ifndef _WIN32
 #include <sys/socket.h>
 #include <sys/un.h>
@@ -3011,8 +3014,8 @@ TEST(cli_uninstall_quiesces_active_cohort_before_removing_binary_and_index) {
     };
     cbm_cli_activation_ops_t ops = cli_activation_fake_ops(&fake);
     cbm_cli_set_activation_ops_for_test(&ops);
-    char *argv[] = {"--yes"};
-    int rc = cli_test_cmd_uninstall(1, argv);
+    char *argv[] = {"--yes", "--delete-indexes"};
+    int rc = cli_test_cmd_uninstall(2, argv);
     cbm_cli_set_activation_ops_for_test(NULL);
     cbm_set_auto_answer_for_test(0);
 
@@ -3072,8 +3075,8 @@ TEST(cli_uninstall_preserves_binary_and_index_when_cohort_does_not_drain) {
     };
     cbm_cli_activation_ops_t ops = cli_activation_fake_ops(&fake);
     cbm_cli_set_activation_ops_for_test(&ops);
-    char *argv[] = {"--yes"};
-    int rc = cli_test_cmd_uninstall(1, argv);
+    char *argv[] = {"--yes", "--delete-indexes"};
+    int rc = cli_test_cmd_uninstall(2, argv);
     cbm_cli_set_activation_ops_for_test(NULL);
     cbm_set_auto_answer_for_test(0);
 
@@ -3094,6 +3097,329 @@ TEST(cli_uninstall_preserves_binary_and_index_when_cohort_does_not_drain) {
     PASS();
 }
 
+/* Uninstall requires a separate choice before deleting project data. Keep
+ * fixture state and activation coordination independent of the developer's
+ * installation, and validate setup before absence can count as deletion. */
+enum { UNINSTALL_INDEX_COUNT = 3, UNINSTALL_FILES_PER_INDEX = 6 };
+
+typedef struct {
+    char tmpdir[256];
+    char cache_dir[512];
+    char bin_target[640];
+    char internal_store[640];
+    char index_paths[UNINSTALL_INDEX_COUNT * UNINSTALL_FILES_PER_INDEX][640];
+    char index_bodies[UNINSTALL_INDEX_COUNT * UNINSTALL_FILES_PER_INDEX][64];
+    char *old_home;
+    char *old_cache;
+    char *old_path;
+    bool created;
+} cli_uninstall_index_fixture_t;
+
+static bool cli_uninstall_index_fixture_intact(const cli_uninstall_index_fixture_t *fx) {
+    for (int i = 0; i < UNINSTALL_INDEX_COUNT * UNINSTALL_FILES_PER_INDEX; i++) {
+        const char *body = read_test_file(fx->index_paths[i]);
+        if (!body || strcmp(body, fx->index_bodies[i]) != 0) {
+            return false;
+        }
+    }
+    return true;
+}
+
+static bool cli_uninstall_test_file_is(const char *path, const char *expected) {
+    const char *body = read_test_file(path);
+    return body && strcmp(body, expected) == 0;
+}
+
+static bool cli_uninstall_test_absent(const char *path) {
+    struct stat st;
+    errno = 0;
+    return stat(path, &st) != 0 && errno == ENOENT;
+}
+
+static bool cli_uninstall_index_fixture_setup(cli_uninstall_index_fixture_t *fx, const char *tag) {
+    memset(fx, 0, sizeof(*fx));
+    snprintf(fx->tmpdir, sizeof(fx->tmpdir), "/tmp/cli-uninstall-%s-XXXXXX", tag);
+    if (!cbm_mkdtemp(fx->tmpdir)) {
+        return false;
+    }
+    fx->created = true;
+    cli_activation_save_env(&fx->old_home, &fx->old_cache);
+    fx->old_path = save_test_env("PATH");
+    cbm_setenv("HOME", fx->tmpdir, 1);
+    cbm_setenv("PATH", fx->tmpdir, 1);
+    snprintf(fx->cache_dir, sizeof(fx->cache_dir), "%s/cache", fx->tmpdir);
+    cbm_setenv("CBM_CACHE_DIR", fx->cache_dir, 1);
+    const char *home = getenv("HOME");
+    const char *path = getenv("PATH");
+    const char *cache = getenv("CBM_CACHE_DIR");
+    if (!home || !path || !cache || strcmp(home, fx->tmpdir) != 0 ||
+        strcmp(path, fx->tmpdir) != 0 || strcmp(cache, fx->cache_dir) != 0) {
+        return false;
+    }
+    test_mkdirp(fx->cache_dir);
+    static const char *const suffixes[UNINSTALL_FILES_PER_INDEX] = {
+        ".db", ".db-wal", ".db-shm", ".db-journal", ".db.tmp", ".db.tmp-wal"};
+    for (int i = 0; i < UNINSTALL_INDEX_COUNT; i++) {
+        for (int j = 0; j < UNINSTALL_FILES_PER_INDEX; j++) {
+            int k = i * UNINSTALL_FILES_PER_INDEX + j;
+            snprintf(fx->index_paths[k], sizeof(fx->index_paths[k]), "%s/project-%d%s",
+                     fx->cache_dir, i, suffixes[j]);
+            snprintf(fx->index_bodies[k], sizeof(fx->index_bodies[k]), "index %d file %d %s", i, j,
+                     tag);
+            write_test_file(fx->index_paths[k], fx->index_bodies[k]);
+        }
+    }
+    snprintf(fx->internal_store, sizeof(fx->internal_store), "%s/_config.db", fx->cache_dir);
+    write_test_file(fx->internal_store, "internal store sentinel");
+    char bin_dir[512];
+    snprintf(bin_dir, sizeof(bin_dir), "%s/.local/bin", fx->tmpdir);
+    test_mkdirp(bin_dir);
+#ifdef _WIN32
+    snprintf(fx->bin_target, sizeof(fx->bin_target), "%s/codebase-memory-mcp.exe", bin_dir);
+#else
+    snprintf(fx->bin_target, sizeof(fx->bin_target), "%s/codebase-memory-mcp", bin_dir);
+#endif
+    write_test_file(fx->bin_target, "uninstall fixture binary");
+    return cli_uninstall_index_fixture_intact(fx) &&
+           cli_uninstall_test_file_is(fx->int
```

---

### Incident Patch 14: `20fd3aad` (2026-10-04)
**Commit Message**: Merge pull request #2511 from DeusData/fix/issue-1364-distinct-before-cap

fix(cypher): count DISTINCT rows against the row cap

**File**: `src/cypher/cypher.c` (modified, +132/-18)
```diff
@@ -12,6 +12,8 @@
 #include "foundation/platform.h"
 #include "foundation/limits.h"
 #include "foundation/log.h"
+#include "foundation/hash_table.h"
+#include "foundation/mem_core.h"
 
 enum {
     CYP_BUF_16 = 16,
@@ -2837,6 +2839,104 @@ static void rb_add_row(result_builder_t *rb, const char **values) {
     rb->rows[rb->row_count++] = row;
 }
 
+/* ── DISTINCT while projecting (#1364) ─────────────────────────────
+ *
+ * RETURN DISTINCT used to project up to the engine row cap and only then drop
+ * duplicates, so a value first seen past the cap never reached the result: on
+ * a 150k-edge index `RETURN DISTINCT type(r)` lost its one HAS_BRANCH edge.
+ * The projection loops now de-duplicate as they go, so the cap counts DISTINCT
+ * rows. Memory stays bounded by the cap: only admitted rows are remembered;
+ * rows past the cap are probed (no insert) solely to decide `truncated`. */
+typedef struct {
+    CBMHashTable *seen; /* row key -> the same heap key; NULL = not DISTINCT */
+} rb_distinct_t;
+
+static void rb_distinct_init(rb_distinct_t *d, bool distinct) {
+    d->seen = distinct ? cbm_ht_create(CBM_SZ_64) : NULL;
+}
+
+static void rb_distinct_free_key(const char *key, void *value, void *userdata) {
+    (void)key;
+    (void)userdata;
+    cbm_free(CBM_MEM_CLASS_OTHER, value);
+}
+
+static void rb_distinct_free(rb_distinct_t *d) {
+    if (d->seen) {
+        cbm_ht_foreach(d->seen, rb_distinct_free_key, NULL);
+        cbm_ht_free(d->seen);
+        d->seen = NULL;
+    }
+}
+
+/* Length-prefixed row key ("<len>:<value>" per column), so no value content
+ * can make two different rows collide. NULL projects as "" (as rb_add_row). */
+static char *rb_distinct_row_key(const char **vals, int n) {
+    size_t total = SKIP_ONE;
+    for (int i = 0; i < n; i++) {
+        total += (vals[i] ? strlen(vals[i]) : 0) + CBM_SZ_32;
+    }
+    char *key = cbm_alloc(CBM_MEM_CLASS_OTHER, total);
+    if (!key) {
+        return NULL;
+    }
+    size_t pos = 0;
+    key[0] = '\0';
+    for (int i = 0; i < n; i++) {
+        const char *v = vals[i] ? vals[i] : "";
+        int w = snprintf(key + pos, total - pos, "%zu:%s", strlen(v), v);
+        if (w > 0) {
+            pos += (size_t)w;
+        }
+    }
+    return key;
+}
+
+/* Admission for one projected row. Returns false for a row DISTINCT already
+ * holds. On true, *key_out is the key to hand to rb_distinct_keep (NULL when
+ * not DISTINCT, or when the key allocation failed — the row is then admitted
+ * without de-duplication rather than dropped). */
+static bool rb_distinct_is_new(const rb_distinct_t *d, const char **vals, int n, char **key_out) {
+    *key_out = NULL;
+    if (!d->seen) {
+        return true;
+    }
+    char *key = rb_distinct_row_key(vals, n);
+    if (!key) {
+        return true;
+    }
+    if (cbm_ht_has(d->seen, key)) {
+        cbm_free(CBM_MEM_CLASS_OTHER, key);
+        return false;
+    }
+    *key_out = key;
+    return true;
+}
+
+static void rb_distinct_keep(rb_distinct_t *d, char *key) {
+    if (key) {
+        cbm_ht_set(d->seen, key, key);
+    }
+}
+
+/* Add one projected row under a row cap, de-duplicating when DISTINCT.
+ * Returns false once a NEW row arrives with the cap already full: the caller
+ * stops there, and flags truncation when the cap is the engine budget. A
+ * duplicate past the cap is neither kept nor evidence of truncation. */
+static bool rb_add_row_capped(result_builder_t *rb, rb_distinct_t *d, const char **vals, int cap) {
+    char *key = NULL;
+    if (!rb_distinct_is_new(d, vals, rb->col_count, &key)) {
+        return true;
+    }
+    if (rb->row_count >= cap) {
+        cbm_free(CBM_MEM_CLASS_OTHER, key);
+        return false;
+    }
+    rb_distinct_keep(d, key);
+    rb_add_row(rb, vals);
+    return true;
+}
+
 /* ── Main execution ─────────────────────────────────────────────── */
 
 /* Hard ceiling: queries returning more than this trigger an error instead of data.
@@ -4359,14 +4459,20 @@ static void execute_return_star_after_with(cbm_query_t *q, binding_t *bindings,
         cols[i] = resolve_item_alias(&wc->items[i], name_bufs[i], sizeof(name_bufs[i]));
     }
     rb_set_columns(rb, cols, col_n);
-    for (int bi = 0; bi < bind_count && rb->row_count < max_rows; bi++) {
+    rb_distinct_t seen;
+    rb_distinct_init(&seen, q->ret && q->ret->distinct);
+    for (int bi = 0; bi < bind_count; bi++) {
         const char *vals[CYP_MAX_VARS];
         for (int i = 0; i < col_n; i++) {
             cbm_node_t *vn = binding_get(&bindings[bi], cols[i]);
             vals[i] = vn && vn->name ? vn->name : "";
         }
-        rb_add_row(rb, vals);
+        if (!rb_add_row_capped(rb, &seen, vals, max_rows)) {
+            g_cypher_truncated = true;
+            break;
+        }
     }
+    rb_distinct_free(&seen);
 }
 
 static void execute_return_star(cbm_query_t *q, binding_t *bindings, int bind_count, int max_rows,
@@ -4381,19 +4487,22 @@ static void execute_return_star(cbm_quer
```

**File**: `tests/test_cypher.c` (modified, +94/-0)
```diff
@@ -1269,6 +1269,99 @@ TEST(cypher_exec_aggregate_sees_all_edges_beyond_expansion_cap_issue1196) {
     PASS();
 }
 
+/* #1364: RETURN DISTINCT de-duplicated only AFTER the engine row cap, so a
+ * value that first appears past the cap was never seen: on a 150k-edge index
+ * `RETURN DISTINCT type(r)` returned 21 of 22 types (HAS_BRANCH, one edge,
+ * missing). The cap must count DISTINCT rows. Fixture: 20 CALLS edges, then
+ * one HAS_BRANCH edge from the last-inserted node; max_rows=5 puts the rare
+ * type far past the raw-row cap. */
+TEST(cypher_return_distinct_counts_distinct_rows_against_cap_issue1364) {
+    cbm_store_t *s = cbm_store_open_memory();
+    ASSERT_NOT_NULL(s);
+    ASSERT_EQ(cbm_store_upsert_project(s, "test", "/tmp/test"), CBM_STORE_OK);
+
+    int64_t ids[22];
+    for (int i = 0; i < 22; i++) {
+        char name[32];
+        char qn[64];
+        snprintf(name, sizeof(name), "fn_%02d", i);
+        snprintf(qn, sizeof(qn), "test.%s", name);
+        cbm_node_t n = {.project = "test",
+                        .label = "Function",
+                        .name = name,
+                        .qualified_name = qn,
+                        .file_path = "a.py"};
+        ids[i] = cbm_store_upsert_node(s, &n);
+        ASSERT_GT(ids[i], 0);
+    }
+    for (int i = 0; i < 20; i++) {
+        cbm_edge_t e = {
+            .project = "test", .source_id = ids[i], .target_id = ids[i + 1], .type = "CALLS"};
+        cbm_store_insert_edge(s, &e);
+    }
+    cbm_edge_t rare = {
+        .project = "test", .source_id = ids[21], .target_id = ids[0], .type = "HAS_BRANCH"};
+    cbm_store_insert_edge(s, &rare);
+
+    /* Plain DISTINCT: both types, complete (2 distinct rows << cap of 5). */
+    cbm_cypher_result_t r = {0};
+    int rc = cbm_cypher_execute(s, "MATCH ()-[r]->() RETURN DISTINCT type(r) AS t", "test", 5, &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 2);
+    bool saw_calls = false;
+    bool saw_branch = false;
+    for (int i = 0; i < r.row_count; i++) {
+        saw_calls = saw_calls || strcmp(r.rows[i][0], "CALLS") == 0;
+        saw_branch = saw_branch || strcmp(r.rows[i][0], "HAS_BRANCH") == 0;
+    }
+    ASSERT_TRUE(saw_calls);
+    ASSERT_TRUE(saw_branch);
+    ASSERT_FALSE(r.truncated);
+    cbm_cypher_result_free(&r);
+
+    /* DISTINCT + ORDER BY shares the cap. */
+    memset(&r, 0, sizeof(r));
+    rc = cbm_cypher_execute(s, "MATCH ()-[r]->() RETURN DISTINCT type(r) AS t ORDER BY t DESC",
+                            "test", 5, &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 2);
+    ASSERT_STR_EQ(r.rows[0][0], "HAS_BRANCH");
+    ASSERT_STR_EQ(r.rows[1][0], "CALLS");
+    ASSERT_FALSE(r.truncated);
+    cbm_cypher_result_free(&r);
+
+    /* DISTINCT + ORDER BY + SKIP/LIMIT: SKIP counts distinct rows. */
+    memset(&r, 0, sizeof(r));
+    rc = cbm_cypher_execute(
+        s, "MATCH ()-[r]->() RETURN DISTINCT type(r) AS t ORDER BY t SKIP 1 LIMIT 1", "test", 5,
+        &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 1);
+    ASSERT_STR_EQ(r.rows[0][0], "HAS_BRANCH");
+    ASSERT_FALSE(r.truncated);
+    cbm_cypher_result_free(&r);
+
+    /* An explicit LIMIT on DISTINCT counts distinct rows too. */
+    memset(&r, 0, sizeof(r));
+    rc = cbm_cypher_execute(s, "MATCH ()-[r]->() RETURN DISTINCT type(r) AS t LIMIT 2", "test", 5,
+                            &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 2);
+    ASSERT_FALSE(r.truncated);
+    cbm_cypher_result_free(&r);
+
+    /* More distinct rows than the cap: still bounded and reported truncated. */
+    memset(&r, 0, sizeof(r));
+    rc = cbm_cypher_execute(s, "MATCH (a)-[r]->(b) RETURN DISTINCT b.name", "test", 5, &r);
+    ASSERT_EQ(rc, 0);
+    ASSERT_EQ(r.row_count, 5);
+    ASSERT_TRUE(r.truncated);
+    cbm_cypher_result_free(&r);
+
+    cbm_store_close(s);
+    PASS();
+}
+
 /* #874: coalesce(var.prop, literal) in WHERE — null-safe numeric filters
  * for audit queries over OPTIONAL graph properties. The parser rejected the
  * call outright ("unexpected operator"); RETURN-side coalesce already
@@ -4925,6 +5018,7 @@ SUITE(cypher) {
     RUN_TEST(cypher_exec_where_eq);
     RUN_TEST(cypher_exec_unlabeled_where_beyond_result_limit_issue1196);
     RUN_TEST(cypher_exec_aggregate_sees_all_edges_beyond_expansion_cap_issue1196);
+    RUN_TEST(cypher_return_distinct_counts_distinct_rows_against_cap_issue1364);
     RUN_TEST(cypher_exec_varlength_path_semantics_issue797);
     RUN_TEST(cypher_exec_where_coalesce_issue874);
     RUN_TEST(cypher_exec_where_regex);
```

---

### Incident Patch 15: `873a9665` (2026-10-04)
**Commit Message**: Merge pull request #2510 from DeusData/fix/issue-1484-close-range-v2

fix(subprocess): close inherited descriptors with kernel range operation

**File**: `src/foundation/subprocess.c` (modified, +62/-3)
```diff
@@ -30,6 +30,9 @@
 #include <spawn.h>
 #endif
 extern char **environ;
+#ifdef __linux__
+#include <sys/syscall.h> /* SYS_close_range: raw syscall, see cbm_posix_close_fds_from */
+#endif
 #include <sys/stat.h>
 #include <sys/wait.h>
 #include <unistd.h>
@@ -1069,6 +1072,64 @@ static void cbm_posix_reset_child_signals(void) {
     (void)sigprocmask(SIG_SETMASK, &empty, NULL);
 }
 
+/* Close every descriptor >= lowfd in the fork+exec child (#1484).
+ *
+ * The portable answer is a close() per possible descriptor, which costs
+ * O(RLIMIT_NOFILE) syscalls: at nofile=524288 that is ~0.8 s between fork and
+ * exec for EVERY spawn, independent of how many descriptors are actually open.
+ * The kernel can do the same in one call:
+ *   - Linux >= 5.9: close_range(lowfd, ~0U, 0). Issued as a raw syscall, not
+ *     through the libc wrapper: the static musl release build has no wrapper
+ *     and the glibc wrapper only exists from 2.34, while the syscall number is
+ *     436 on the supported x86-64 and AArch64 targets. Other architectures
+ *     use their header's number, or the loop if no number is available.
+ *     An older kernel answers
+ *     ENOSYS (or EPERM under a seccomp filter that predates it) and we fall back.
+ *   - FreeBSD/OpenBSD/NetBSD/DragonFly: closefrom(lowfd).
+ *   - otherwise (and on fallback): the bounded close() loop.
+ * macOS never reaches this on its primary path: posix_spawn's
+ * CLOEXEC_DEFAULT does the closing (see cbm_posix_spawn_apple).
+ *
+ * Runs between fork and exec, so it is async-signal-safe: raw syscalls and
+ * close() only, no allocation, no stdio. Returns the strategy that did the
+ * work so the test seam can assert which one ran. */
+#if defined(__linux__) && !defined(SYS_close_range) && (defined(__x86_64__) || defined(__aarch64__))
+#define SYS_close_range 436
+#endif
+
+#ifdef CBM_ENABLE_TEST_SEAMS
+static bool g_force_close_range_enosys = false;
+#endif
+
+static cbm_fd_close_strategy_t cbm_posix_close_fds_from(int lowfd, long max_fd) {
+#if defined(__linux__) && defined(SYS_close_range)
+    bool range_unavailable = false;
+#ifdef CBM_ENABLE_TEST_SEAMS
+    range_unavailable = g_force_close_range_enosys;
+#endif
+    if (!range_unavailable && syscall(SYS_close_range, (unsigned int)lowfd, ~0U, 0U) == 0) {
+        return CBM_FD_CLOSE_RANGE;
+    }
+#elif defined(__FreeBSD__) || defined(__OpenBSD__) || defined(__NetBSD__) || defined(__DragonFly__)
+    (void)max_fd;
+    closefrom(lowfd);
+    return CBM_FD_CLOSEFROM;
+#endif
+    for (int fd = lowfd; fd < max_fd; fd++) {
+        (void)close(fd);
+    }
+    return CBM_FD_CLOSE_LOOP;
+}
+
+#ifdef CBM_ENABLE_TEST_SEAMS
+void cbm_subprocess_force_close_range_enosys_for_testing(bool force) {
+    g_force_close_range_enosys = force;
+}
+cbm_fd_close_strategy_t cbm_subprocess_close_fds_from_for_testing(int lowfd, long max_fd) {
+    return cbm_posix_close_fds_from(lowfd, max_fd);
+}
+#endif
+
 /* fork+exec child setup. On Apple this runs ONLY for the exec-failure
  * fallback (see cbm_posix_spawn_apple), which preserves the documented
  * "bogus binary => child exits 127" contract across platforms. */
@@ -1090,9 +1151,7 @@ static void cbm_posix_child_exec(cbm_subprocess_t *process, int input, int outpu
     if (output > STDERR_FILENO) {
         (void)close(output);
     }
-    for (int fd = STDERR_FILENO + 1; fd < max_fd; fd++) {
-        (void)close(fd);
-    }
+    (void)cbm_posix_close_fds_from(STDERR_FILENO + 1, max_fd);
     if (process->envp) {
         environ = process->envp; /* execvp passes environ to the new image */
     }
```

**File**: `src/foundation/subprocess.h` (modified, +17/-0)
```diff
@@ -193,4 +193,21 @@ void cbm_subprocess_force_spawn_eagain_for_testing(int attempts);
 int cbm_subprocess_pending_spawn_eagain_for_testing(void);
 #endif
 
+/* How the POSIX fork+exec child closed its inherited descriptors (#1484). */
+typedef enum {
+    CBM_FD_CLOSE_RANGE = 1, /* Linux close_range(2): one syscall */
+    CBM_FD_CLOSEFROM,       /* BSD closefrom(3): one call */
+    CBM_FD_CLOSE_LOOP       /* close() per descriptor up to _SC_OPEN_MAX: O(RLIMIT_NOFILE) */
+} cbm_fd_close_strategy_t;
+
+#if defined(CBM_ENABLE_TEST_SEAMS) && !defined(_WIN32)
+/* Run the child's close-inherited-descriptors step in the CALLING process for
+ * descriptors >= lowfd (callers pick a lowfd above everything they need) and
+ * report which strategy did the work. Test builds only. */
+cbm_fd_close_strategy_t cbm_subprocess_close_fds_from_for_testing(int lowfd, long max_fd);
+/* Make the close_range fast path behave as if the kernel lacked it (ENOSYS),
+ * so the fallback loop is exercised deterministically. Test builds only. */
+void cbm_subprocess_force_close_range_enosys_for_testing(bool force);
+#endif
+
 #endif /* CBM_SUBPROCESS_H */
```

**File**: `tests/test_subprocess.c` (modified, +95/-0)
```diff
@@ -27,6 +27,12 @@
 #include <sys/time.h>
 #include <sys/wait.h>
 #include <unistd.h>
+#ifdef __linux__
+#include <sys/syscall.h>
+#if !defined(SYS_close_range) && (defined(__x86_64__) || defined(__aarch64__))
+#define SYS_close_range 436
+#endif
+#endif
 #else
 #include <windows.h>
 #include "../src/foundation/win_utf8.h"
@@ -1012,6 +1018,94 @@ TEST(subprocess_posix_child_closes_unrelated_descriptors) {
 #endif
 }
 
+/* #1484: the child's close-inherited-descriptors step must not cost
+ * O(RLIMIT_NOFILE) syscalls. The seam runs the exact child routine in this
+ * process against two descriptors parked at the TOP of the descriptor table
+ * (nothing else lives there), and reports which strategy did the work. On
+ * Linux that must be close_range(2) whenever the kernel has it -- the per-fd
+ * loop is the bug. The ENOSYS-injected leg proves the fallback still closes. */
+#ifndef _WIN32
+static bool subprocess_fd_is_closed(int fd) {
+    return fcntl(fd, F_GETFD) == -1 && errno == EBADF;
+}
+
+static cbm_fd_close_strategy_t subprocess_expected_close_strategy(void) {
+#if defined(__linux__) && defined(SYS_close_range)
+    /* Probe the kernel on an empty range: an old kernel (< 5.9) or a seccomp
+     * filter without it answers ENOSYS/EPERM, and then the loop is correct. */
+    long probe = syscall(SYS_close_range, ~0U, ~0U, 0U);
+    return (probe == 0 || errno == EINVAL) ? CBM_FD_CLOSE_RANGE : CBM_FD_CLOSE_LOOP;
+#elif defined(__FreeBSD__) || defined(__OpenBSD__) || defined(__NetBSD__) || defined(__DragonFly__)
+    return CBM_FD_CLOSEFROM;
+#else
+    return CBM_FD_CLOSE_LOOP;
+#endif
+}
+
+/* Park two non-CLOEXEC descriptors near the top of the table; returns the lower
+ * of the two and hands back the original (low) descriptor in *keep_low. The
+ * kernel may cap the table below _SC_OPEN_MAX (macOS: kern.maxfilesperproc),
+ * so the start point halves until F_DUPFD accepts it. */
+static int subprocess_park_high_fds(int *keep_low) {
+    char path[] = "/tmp/cbm-subprocess-highfd-XXXXXX";
+    int low = cbm_mkstemp(path);
+    if (low < 0) {
+        return -1;
+    }
+    (void)unlink(path);
+    long top = sysconf(_SC_OPEN_MAX);
+    if (top <= 0 || top > 1048576L) {
+        top = 1048576L;
+    }
+    int high = -1;
+    for (long base = top - 4; high < 0 && base > 64; base /= 2) {
+        high = fcntl(low, F_DUPFD, (int)base);
+    }
+    int higher = high >= 0 ? fcntl(low, F_DUPFD, high + 1) : -1;
+    if (higher != high + 1) {
+        (void)close(low);
+        if (high >= 0) {
+            (void)close(high);
+        }
+        if (higher >= 0) {
+            (void)close(higher);
+        }
+        return -1;
+    }
+    *keep_low = low;
+    return high;
+}
+#endif
+
+TEST(subprocess_child_close_fds_uses_one_syscall_not_rlimit_loop) {
+#ifdef _WIN32
+    SKIP_PLATFORM("POSIX fork+exec descriptor closing; Windows uses a handle allow-list");
+#else
+    for (int inject_enosys = 0; inject_enosys <= 1; inject_enosys++) {
+        int keep_low = -1;
+        int high = subprocess_park_high_fds(&keep_low);
+        ASSERT_TRUE(high > STDERR_FILENO);
+        cbm_subprocess_force_close_range_enosys_for_testing(inject_enosys != 0);
+        /* The loop bound covers exactly the parked pair; close_range has none. */
+        cbm_fd_close_strategy_t used =
+            cbm_subprocess_close_fds_from_for_testing(high, (long)high + 2);
+        cbm_subprocess_force_close_range_enosys_for_testing(false);
+        bool closed = subprocess_fd_is_closed(high) && subprocess_fd_is_closed(high + 1);
+        bool low_survived = fcntl(keep_low, F_GETFD) >= 0;
+        (void)close(keep_low);
+
+        ASSERT_TRUE(closed);
+        ASSERT_TRUE(low_survived); /* only descriptors >= lowfd are touched */
+        cbm_fd_close_strategy_t expected = subprocess_expected_close_strategy();
+        if (inject_enosys && expected == CBM_FD_CLOSE_RANGE) {
+            expected = CBM_FD_CLOSE_LOOP; /* kernel "lacks" it: the fallback must run */
+        }
+        ASSERT_EQ((int)used, (int)expected);
+    }
+    PASS();
+#endif
+}
+
 TEST(subprocess_root_exit_drains_surviving_descendant) {
 #ifdef _WIN32
     SKIP_PLATFORM("POSIX process-group descendant probe; native Windows coverage pending");
@@ -1396,6 +1490,7 @@ SUITE(subprocess) {
     RUN_TEST(subprocess_poll_log_delivery_is_bounded_and_terminal_is_lossless);
     RUN_TEST(subprocess_final_log_drain_error_is_terminal_and_preserves_classification);
     RUN_TEST(subprocess_posix_child_closes_unrelated_descriptors);
+    RUN_TEST(subprocess_child_close_fds_uses_one_syscall_not_rlimit_loop);
     RUN_TEST(subprocess_root_exit_drains_surviving_descendant);
     RUN_TEST(subprocess_strip_git_repo_env_is_per_child);
     RUN_TEST(popen_git_strips_repo_env_and_reports_exit_status);
```

#### Recent Merged Pull Requests:
- **PR #2546** (closed): Rfc 001 (@ronaldpschutte)
- **PR #2544** (2026-10-04): fix(build): reconcile three call sites after concurrent merges (@DeusData)
- **PR #2526** (2026-10-04): fix(mcp): discover projects with underscore-prefixed names (@DeusData)
- **PR #2524** (2026-10-04): fix(mcp): avoid misleading empty-search filter hints (@DeusData)
- **PR #2523** (2026-10-04): fix(typescript): resolve constructor properties and new-initialized fields (@DeusData)
- **PR #2518** (2026-10-04): test(mcp): isolate search scratch cleanup fixtures (@DeusData)
- **PR #2517** (2026-10-04): fix(cli): keep project indexes by default during uninstall (@DeusData)
- **PR #2516** (2026-10-04): fix(mcp): release path filters on search setup errors (@DeusData)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
