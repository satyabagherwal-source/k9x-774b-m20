# Forensic Learning Record (Deep Inspection): MadsLorentzen/ai-job-search

> **Canonical Artifact**: `07_PROJECT_LEARNING/madslorentzen-ai-job-search-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:01:16.724Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MadsLorentzen/ai-job-search`
- **Description**: The job search that runs on your machine. AI job application framework built on Claude Code: evaluate postings, tailor CVs, write cover letters, prep interviews. Fork it and own it.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 45027 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tools/rank_state.py`
```
#!/usr/bin/env python3
"""State helper for /rank: select candidates and write results back.

/rank reads the whole of seen_jobs.json into the model's context to filter it
by eye (Step 1), then re-emits the whole file to record scores (Step 4). That
cost is paid on every run regardless of how many jobs are actually scored, and
it grows for the life of the workspace, since seen_jobs.json is append-only by
design and most stored entries are `skipped`.

This moves the state-file traffic into code. Three subcommands:

  candidates   select the eligible entries for this run and project only the
               fields a scoring agent needs
  sweep        rule 6's expiry pass over entries this run did not re-score -
               a stored-date comparison, no fetch, no agent
  apply        write scoring results back to seen_jobs.json and print the
               ranked/vetoed/expired rows Step 5's report is built from

Selection and projection follow Step 1's existing rules exactly (status
filter, tracker exclusion, focus filter, `--limit`/`--all`); the write-back
follows Step 4's existing rules exactly (the `location` -> `location_verdict`
legacy migration, the deadline null-is-not-a-correction rule, verbatim
strengths/gaps persistence, idempotent skip of already-ranked entries); the
sweep follows rule 6 exactly (defensive date parsing, an absent deadline left
alone, `--all` making a retired entry revivable).

Nothing here fetches a posting or judges a fit. Scoring stays with the model;
this only removes the state file from the conversation.

Usage:
  python3 tools/rank_state.py candidates [--all] [--focus TEXT] [--limit N]
  python3 tools/rank_state.py sweep [--write] [--exclude KEY,KEY]
  python3 tools/rank_state.py apply --results results.json [--dry-run]

Both subcommands print JSON on stdout. Exit 0 on success, 1 on a usage or
state error, or on `apply` when any result could not be written.
"""

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "job_scraper" / "seen_jobs.json"
TRACKER = ROOT / "job_search_tracker.csv"

# 04-job-evaluation.md
WEIGHTS = {"technical": 0.30, "experience": 0.25, "behavioral": 0.15, "career": 0.30}
BANDS = ((75, "Strong Fit"), (60, "Good Fit"), (45, "Moderate Fit"), (30, "Weak Fit"), (0, "Poor Fit"))

DEFAULT_LIMIT = 10
URGENT_DAYS = 7
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_state(path: Path) -> tuple[dict, dict]:
    """Return (document, seen-map). The map is mutated in place by callers."""
    if not path.is_file():
        sys.exit(f"{path} not found - run /scrape first")
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"{path} is not valid JSON: {exc}")
    seen = doc.get("seen") if isinstance(doc, dict) and "seen" in doc else doc
    if not isinstance(seen, dict):
        sys.exit(f"{path}: expected an object of job entries")
    return doc, seen


def save_state(path: Path, doc: dict) -> None:
    """Atomic replace: a half-written seen_jobs.json loses the scrape history."""
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".seen_jobs.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def parse_iso(value) -> date | None:
    """Rule 6's defensive-parse rule: anything that is not YYYY-MM-DD is treated
    exactly like an absent value - never compared, never guessed at."""
    if not isinstance(value, str) or not ISO.match(value.strip()):
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def norm(text) -> str:
    """Ignore case and separators without discarding non-Latin identity."""
    text = unicodedata.normalize("NFC", str(text or "").casefold())
    # Combining marks can distinguish names even after NFC (e.g. Indic vowels).
    return "".join(
        char for char in text
        if char.isalnum() or unicodedata.category(char).startswith("M")
    )


def tracker_pairs(path: Path) -> set[tuple[str, str]]:
    """company+role pairs already in the tracker - out of scope for ranking."""
    if not path.is_file():
        return set()
    import csv

    pairs = set()
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            company, role = norm(row.get("company")), norm(row.get("role"))
            if company:
                pairs.add((company, role))
    return pairs


def entry_location_verdict(entry: dict) -> str | None:
    """location_verdict, falling back to a legacy verdict stored under `location`
    (Step 4: "an entry ranked before this rename may carry a legacy PASS/FAIL/
    FLAG string in `location`")."""
    verdict = entry.get("location_verdict")
    if verdict:
        return verdict
    legacy = entry.get("location")
    return legacy if legacy in ("PASS", "FAIL", "FLAG") else None


def cmd_candidates(args) -> int:
    _, seen = load_state(args.state)
    excluded = tracker_pairs(args.tracker)

    selected, skipped_tracker = [], 0
    for key, entry in seen.items():
        status = entry.get("status")
        if args.all:
            if status == "skipped":
                continue
        elif status != "new":
            continue
        if (norm(entry.get("company")), norm(entry.get("title"))) in excluded:
            skipped_tracker += 1
            continue
        if args.focus:
            haystack = " ".join(
                [str(entry.get("title") or ""), str(entry.get("company") or "")]
                + [str(b) for b in entry.get("strengths") or []]
                + [str(b) for b in entry.get("gaps") or []]
            ).lower()
            if args.focus.lower() not in haystack:
                continue
        selected.append(
            {
                "key": key,
                "title": entry.get("title"),
                "company": entry.get("company"),
                "url": entry.get("url"),
                "portal": entry.get("portal"),
                "deadline": entry.get("deadline"),
                "posted_date": entry.get("posted_date"),
            }
        )

    eligible = len(selected)
    if args.limit > 0:
        selected = selected[: args.limit]
    print(
        json.dumps(
            {
                "eligible": eligible,
                "selected": selected,
                "deferred": max(0, eligible - len(selected)),
                "excluded_by_tracker": skipped_tracker,
                "total_entries": len(seen),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def cmd_sweep(args) -> int:
    doc, seen = load_state(args.state)
    today = args.today
    exclude = {k for k in (args.exclude or "").split(",") if k}

    expired, closing, unparseable, checked = [], [], [], 0
    for key, entry in seen.items():
        if entry.get("status") != "ranked" or key in exclude:
            continue
        checked += 1
        raw = entry.get("deadline")
        if raw in (None, ""):
            continue
        parsed = parse_iso(raw)
        if parsed is None:
            unparseable.append({"key": key, "portal": entry.get("portal"), "deadline": raw})
            continue
        row = {
            "key": key,
            "title": entry.get("title"),
            "company": entry.get("company"),
            "url": entry.get("url"),
            "deadline": raw,
        }
        if parsed < today:
            expired.append(row)
        elif (parsed - today).days <= URGENT_DAYS:
            closing.append(row)

    if args.write and expired:
        for row in expired:
            seen[row["key"]]["status"] = "expired"
        save_state(args.state, doc)

    print(
        json.dumps(
            {
                "swept": checked,
                "newly_expired": expired,
                "closing_soon": sorted(closing, key=lambda r: r["deadline"]),
                "unparseable_deadlines": unparseable,
                "written": bool(args.write and expired),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def overall_score(scores: dict) -> int:
    total = 0.0
    for dim, weight in WEIGHTS.items():
        value = scores.get(dim)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"missing or non-numeric score '{dim}'")
        if not 0 <= value <= 100:
            raise ValueError(f"score '{dim}' must be finite and between 0 and 100")
        total += float(value) * weight
    return int(total + 0.5)


def band(score: int) -> str:
    for floor, name in BANDS:
        if score >= floor:
            return name
    return "Poor Fit"


def cmd_apply(args) -> int:
    doc, seen = load_state(args.state)
    today = args.today
    try:
        results = json.loads(Path(args.results).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"cannot read results file {args.results}: {exc}")
    if isinstance(results, dict):
        results = results.get("results", [])
    if not isinstance(results, list):
        sys.exit("results file must be a JSON array of scoring objects")

    rows, expired, errors = [], [], []
    for result in results:
        key = result.get("key")
        entry = seen.get(key)
        if entry is None:
            errors.append({"key": key, "error": "no such key in seen_jobs.json"})
            continue

        if result.get("status") == "expired":
            entry["status"] = "expired"
            expired.append(
                {"key": key, "title": entry.get("title"), "company": entry.g
```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/cli.ts`
```
#!/usr/bin/env bun
// Self-contained CLI for searching the freehire.me aggregator's public JSON API.
// No external CLI framework and zero runtime dependencies, so it runs anywhere
// `bun` is available with nothing installed beyond the repo clone.
//
// Hosted-service dependency: reads are public (no API key), but they hit
// freehire.me — a personal project maintained best-effort (no formal SLA). Point
// FREEHIRE_API_URL at a self-hosted freehire backend to swap the source.

import { runSearch, DESCRIPTION_FORMATS, type DescriptionFormat, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { baseUrl } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

// Short-flag aliases.
const ALIAS: Record<string, string> = { q: "query", n: "limit" }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-")) {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = ALIAS[name] ?? name
    const next = argv[i + 1]
    // A flag with no following value (or another flag next) is a boolean.
    let value: string | boolean = true
    if (next !== undefined && !next.startsWith("-")) {
      value = next
      i++
    }
    // --facet repeats; collect into an array. Everything else is last-wins.
    if (key === "facet") {
      const acc = Array.isArray(flags.facet) ? flags.facet : []
      if (typeof value === "string") acc.push(value)
      flags.facet = acc
    } else {
      flags[key] = value
    }
  }
  return flags
}

type FlagValue = string | boolean | string[] | undefined

/**
 * A flag's string value. A bare flag (set without a value, i.e. `true`) yields
 * `whenBare` — e.g. `--remote` alone means work_mode "remote".
 */
function stringFlag(raw: FlagValue, whenBare?: string): string | undefined {
  if (typeof raw === "string") return raw
  if (raw === true) return whenBare
  return undefined
}

/** Split a comma-separated facet value ("eu,us") into a trimmed value list. */
function commaList(raw: FlagValue): string[] {
  if (typeof raw !== "string") return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const HELP = `freehire-cli — search the freehire.me job aggregator (many markets, tech-focused)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [facet flags] [--format json|table|plain]
  bun run src/cli.ts detail <slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, skill, role). Full-text; optional.
  --jobage <days>         Posted within N days (maps to posted_within_days).
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page (API limit). Default 25.
  --format <fmt>          json (default) | table | plain.
  --no-description        Skip description hydration for a cheap discovery pass
                          (results keep every other field; detail fetches the body).
  --description-format    markdown (default) | text | html — how each result's
                          full description is rendered (json output only).

FACET FILTERS (values from freehire.me's controlled vocabularies; comma = OR)
  --region <codes>        Macro-region: global, eu, us, apac, latam, cis, ...  e.g. --region eu,us
  --country <codes>       ISO-3166 alpha-2, e.g. --country DE,GB
  --city <names>          City name(s), e.g. --city Berlin
  --seniority <levels>    junior, middle, senior, staff, principal, lead, ...
  --category <cats>       backend, frontend, fullstack, devops, ml_ai, qa, ...
  --skill <names>         Canonical skill(s), e.g. --skill go,kubernetes
  --company <slug>        Company slug (from a result's company_slug).
  --remote <mode>         remote | hybrid | onsite (work_mode facet).
  --facet <key=value>     Any other facet param (repeatable), e.g. --facet salary_min=100000

DETAIL
  <slug|url>              A freehire public slug (from a search result's id/slug)
                          or a full https://freehire.me/jobs/<slug> URL.

EXAMPLES
  bun run src/cli.ts search -q "backend engineer" --seniority senior --limit 10 --format table
  bun run src/cli.ts search -q "react" --remote remote --region eu --format table
  bun run src/cli.ts search --category devops --country DE --jobage 14 --format table
  bun run src/cli.ts detail golang-zensar-2bxu6dxm --format plain

Reads are public (no API key). Source: ${baseUrl()} — a personal project,
best-effort, no SLA. Override with FREEHIRE_API_URL to use a self-hosted backend.
`

function parseIntFlag(name: string, raw: string | boolean | string[]): number | null {
  // Number(), not parseInt(): parseInt truncates, so "--jobage 0.5" became 0,
  // which fails search.ts's `jobage > 0` guard and silently drops
  // posted_within_days from the outbound request while exiting 0 (#373).
  // Whole numbers >= 1 only — the Danish CLIs' z.coerce.number().int().min(1)
  // contract; 0 is rejected rather than kept as a "no filter" alias.
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < 1) {
    process.stderr.write(
      JSON.stringify({ error: `--${name} must be a whole number of at least 1, got "${raw}"`, code: "BAD_ARG" }) + "\n",
    )
    return null
  }
  return val
}

// Long-form flag names each command accepts (parseFlags resolves the short
// aliases q/n to these before validation). "help"/"h" pass so `search --help`
// still prints usage.
const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query", "category", "city", "company", "country", "facet", "format", "jobage", "limit",
    "page", "region", "remote", "seniority", "skill", "description-format", "no-description", "help", "h",
  ]),
  detail: new Set(["format", "description-format", "help", "h"]),
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them: a discarded
  // filter changes what the search returns with no error (a wrong flag name
  // once returned an entire portal's database as if it matched the query).
  // add-portal.md's contract requires a bogus flag to exit 1 with a JSON
  // error on stderr.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    // Validated here rather than server-side: the API answers an unrecognized
    // format with raw HTML instead of an error, so a typo would silently change
    // the output rather than fail.
    const descFmt = stringFlag(flags["description-format"]) ?? "markdown"
    if (!DESCRIPTION_FORMATS.includes(descFmt as DescriptionFormat)) {
      const supported = DESCRIPTION_FORMATS.join("|")
      process.stderr.write(
        JSON.stringify({ error: `--description-format must be one of ${supported}, got "${descFmt}"`, code: "BAD_ARG" }) + "\n",
      )
      return 1
    }

    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    // Generic --facet key=value list -> param -> values.
    const facets: Record<string, string[]> = {}
    const rawFacets = Array.isArray(flags.facet) ? flags.facet : []
    for (const kv of rawFacets) {
      const eq = kv.indexOf("=")
      if (eq <= 0) {
        process.stderr.write(JSON.stringify({ error: `invalid --facet "${kv}", want key=value`, code: "BAD_ARG" }) + "\n")
        return 1
      }
      const key = kv.slice(0, eq)
      const vals = commaList(kv.slice(eq + 1))
      facets[key] = (facets[key] ?? []).concat(vals)
    }

    const opts: SearchOpts = {
      query: stringFlag(flags.query),
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? Math.max(1, parseInt(flags.limit as string, 10)) : 25,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
      descriptionFormat: descFmt as DescriptionFormat,
      includeDescription: flags["no-description"] === undefined,
      regions: commaList(flags.region),
      countries: commaList(flags.country),
      cities: commaList(flags.city),
      seniority: commaList(flags.seniority),
      category: commaList(flags.category),
      skills: commaList(flags.skill),
      company: stringFlag(flags.company),
      // --remote <mode> takes the given work_mode; a bare --remote means "remote".
      workMode: stringFlag(flags.remote, "remote"),
      facets,
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires a <slug|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: fmt === "plain" ? "plain" : "json" }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))

```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/commands/detail.ts`
```
import { apiGet, normalizeSlug, toDetail, writeError, type FreehireJob, type JobDetailResult } from "../helpers.js"

export interface DetailOpts {
  id: string // a freehire public slug or a /jobs/<slug> URL
  format: "json" | "plain"
}

/** A human-readable rendering of one job: header, present fields, description. */
function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]

  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date && job.date.slice(0, 10))
  field("Seniority", job.seniority)
  field("Category", job.category)
  field("Employment", job.employment_type)
  field("Salary", job.salary)
  field("Skills", job.skills.length ? job.skills.join(", ") : null)

  lines.push("", job.description ?? "(no description)", "", `URL: ${job.url}`, `slug: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = normalizeSlug(opts.id)
  if (!slug) {
    writeError(`could not parse a freehire slug from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const env = await apiGet<FreehireJob>(`/api/v1/jobs/${encodeURIComponent(slug)}`)
    if (!env) {
      writeError("job not found", "NOT_FOUND")
      return 1
    }
    const job = toDetail(env.data)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        job.date ? `Posted: ${job.date.slice(0, 10)}` : "",
        job.seniority ? `Seniority: ${job.seniority}` : "",
        job.category ? `Category: ${job.category}` : "",
        job.employment_type ? `Employment: ${job.employment_type}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        `slug: ${job.id}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/commands/search.ts`
```
import { apiGet, toResult, writeError, type FreehireJob, type JobResult } from "../helpers.js"

// The agent variant of the job search: the same query, ranking, and facets as the
// web's /jobs/search, but each hit carries the posting's full description instead
// of the search index's truncated preview — so a run reads every result without a
// follow-up `detail` per hit.
const SEARCH_PATH = "/api/v1/agent/jobs/search"

/** How the API renders each result's full description. */
export type DescriptionFormat = "markdown" | "text" | "html"

export const DESCRIPTION_FORMATS: DescriptionFormat[] = ["markdown", "text", "html"]

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit: number
  format: "json" | "table" | "plain"
  descriptionFormat: DescriptionFormat
  // Hydrate full description bodies (the documented default). False keeps a
  // discovery pass cheap: bodies are ~73% of a default search payload, and
  // /scrape pre-filters by title before reading bodies anyway.
  includeDescription?: boolean
  // Facet filters (already parsed into value lists; empty means unset).
  regions: string[]
  countries: string[]
  cities: string[]
  seniority: string[]
  category: string[]
  skills: string[]
  company?: string
  workMode?: string // work_mode facet: remote | hybrid | onsite
  // Arbitrary facet escape hatch: param -> values, for the long tail of the vocabulary.
  facets: Record<string, string[]>
}

function buildQuery(opts: SearchOpts): URLSearchParams {
  const p = new URLSearchParams()
  if (opts.query) p.set("q", opts.query)
  p.set("limit", String(opts.limit))
  p.set("offset", String((opts.page - 1) * opts.limit))
  p.set("semantic_ratio", "0") // keyword search; the semantic index is opt-in
  // The agent endpoint serves the index's truncated preview unless asked to
  // rehydrate each hit from the database, so both params travel together -
  // unless the caller opted out of hydration entirely (--no-description).
  const hydrate = opts.includeDescription !== false
  p.set("include_description", hydrate ? "true" : "false")
  if (hydrate) p.set("description_format", opts.descriptionFormat)
  if (opts.jobage > 0 && opts.jobage < 9999) p.set("posted_within_days", String(opts.jobage))
  if (opts.workMode) p.set("work_mode", opts.workMode)
  if (opts.company) p.set("company_slug", opts.company)

  // Named facets and the generic --facet escape hatch append the same way; values
  // are already split into lists, so each becomes one repeated query param.
  const facets: Array<[string, string[]]> = [
    ["regions", opts.regions],
    ["countries", opts.countries],
    ["cities", opts.cities],
    ["seniority", opts.seniority],
    ["category", opts.category],
    ["skills", opts.skills],
    ...Object.entries(opts.facets),
  ]
  for (const [param, values] of facets) {
    for (const value of values) p.append(param, value)
  }
  return p
}

/** The date portion (YYYY-MM-DD) of an ISO timestamp, or "—" when absent. */
function shortDate(date: string | null): string {
  return date ? date.slice(0, 10) : "—"
}

// Table columns: header, width, and the cell value. The SLUG column is sized to
// the longest slug so it is never truncated — a cut slug can't be looked up in
// `detail`; the fixed-width columns truncate for scanning.
interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "SLUG", width: Math.max(4, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 38, cell: (r) => r.title },
    { header: "COMPANY", width: 22, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 20, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
  ]
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")

  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}`,
      `  slug: ${r.id}`,
      `  ${r.url}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const env = await apiGet<FreehireJob[]>(`${SEARCH_PATH}?${buildQuery(opts).toString()}`)
    // A 404 here is a missing endpoint, not a missing job: a freehire instance
    // older than the agent search surface answers that way, and reporting it as
    // an empty result set would hide the misconfiguration behind plausible output.
    if (!env) {
      writeError(
        `${SEARCH_PATH} not found — this freehire instance predates the agent search endpoint; upgrade it or unset FREEHIRE_API_URL to use the hosted API`,
        "SEARCH_FAILED",
      )
      return 1
    }
    let rows = (env.data ?? []).map(toResult)
    // The API currently returns description bodies regardless of
    // include_description=false (verified live 2026-08-19), and the cost this
    // flag exists to avoid is the ~73% of CLI output the bodies occupy in
    // agent context - so the lean mode strips them client-side either way.
    if (opts.includeDescription === false) {
      rows = rows.map((r) => ({ ...r, description: null }))
    }
    const total = env.meta?.total ?? rows.length

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: rows.length, page: opts.page, total }, results: rows },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}

```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/helpers.ts`
```
// Data source: the freehire.me public REST API (JSON, `{data, meta}` envelope).
// Reads are unauthenticated — no API key, the same bar as linkedin-search — and
// unlike the HTML-scraping portals there is no markup to parse: we fetch JSON and
// reshape it into the portal-skill contract's result fields. The base URL is
// swappable via FREEHIRE_API_URL for self-hosting.

export const DEFAULT_BASE_URL = "https://freehire.me"

/** API base URL: FREEHIRE_API_URL (for a self-hosted instance) or the default. */
export function baseUrl(): string {
  const raw = (process.env.FREEHIRE_API_URL ?? "").trim()
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "freehire-search-skill/1.0 (+https://freehire.me)"

/** The shared API response envelope: {data, meta, error}. */
export interface Envelope<T> {
  data: T
  meta?: { total?: number; limit?: number; offset?: number }
  error?: string
}

/**
 * GET a JSON envelope from the freehire API. Retries 429/5xx (transient server
 * states) with backoff; returns `null` on a 404. A connection failure fails fast
 * with a clear message — no retry, so an outage degrades this source quickly
 * rather than hanging the caller (the graceful-degradation contract).
 */
export async function apiGet<T>(path: string): Promise<Envelope<T> | null> {
  const url = `${baseUrl()}${path}`
  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      // Connection refused / DNS failure / timeout: the API is unreachable.
      throw new Error(
        `could not reach the freehire API at ${baseUrl()} (${e instanceof Error ? e.message : String(e)})`,
      )
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`freehire API request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null

    // Read the body once, tolerantly: an error response's JSON gives us its
    // `error` message; a 2xx must parse (a malformed one is surfaced, not swallowed).
    const body = (await response.json().catch(() => null)) as Envelope<T> | null
    if (!response.ok) {
      throw new Error(body?.error || `freehire API request failed: ${response.status} ${response.statusText}`)
    }
    if (!body) throw new Error("freehire API returned an unparseable response body")
    return body
  }
  // Unreachable in practice; the loop returns or throws on the last attempt.
  throw new Error("freehire API request failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A freehire job — the fields this skill reads (the wire shape carries more).
 */
export interface FreehireJob {
  public_slug: string
  source: string
  external_id: string
  url: string
  title: string
  company: string
  company_slug: string
  location: string
  description: string
  skills: string[]
  work_mode?: string
  regions: string[]
  countries: string[]
  cities: string[]
  posted_at: string | null
  created_at: string | null
  // Always present in the wire shape (an unenriched job serializes it as `{}`);
  // the individual fields are what may be absent.
  enrichment: {
    seniority?: string
    category?: string
    employment_type?: string
    salary_min?: number
    salary_max?: number
    salary_currency?: string
    salary_period?: string // e.g. "year", "month"
  }
}

/**
 * A search result in the portal-skill contract shape. `id` is the public_slug
 * (what `detail <slug>` consumes) and `date` is the posting date; missing values
 * are `null`, never omitted. The extra facet fields are a permitted superset.
 *
 * `description` is the posting's full text in the format the search asked the API
 * for — the agent search endpoint hydrates it server-side, so it arrives already
 * rendered and is passed through verbatim rather than run through `cleanHtml`.
 */
export interface JobResult {
  id: string
  title: string
  company: string | null
  company_slug: string | null
  location: string | null
  date: string | null
  url: string
  work_mode: string | null
  regions: string[]
  countries: string[]
  skills: string[]
  description: string | null
}

/** A job detail: the search result plus the cleaned description and enrichment. */
export interface JobDetailResult extends JobResult {
  cities: string[]
  seniority: string | null
  category: string | null
  employment_type: string | null
  salary: string | null
  description: string | null
}

/**
 * Reshape a freehire job into the contract search-result fields. The title comes
 * from the source ATS as indexed, which can carry HTML entities and stray
 * whitespace ("Intern - Fullstack &amp; AI Innovation "), so it is decoded and trimmed.
 */
export function toResult(j: FreehireJob): JobResult {
  return {
    id: j.public_slug,
    title: decodeHtmlEntities(j.title || "").trim() || "(untitled)",
    company: j.company || null,
    company_slug: j.company_slug || null,
    location: j.location || null,
    date: j.posted_at,
    url: j.url,
    work_mode: j.work_mode || null,
    regions: j.regions,
    countries: j.countries,
    skills: j.skills,
    description: j.description || null,
  }
}

/** Reshape a freehire job into the detail result (adds cleaned description + enrichment). */
export function toDetail(j: FreehireJob): JobDetailResult {
  const e = j.enrichment
  return {
    ...toResult(j),
    cities: j.cities,
    seniority: e.seniority || null,
    category: e.category || null,
    employment_type: e.employment_type || null,
    salary: formatSalary(e),
    description: cleanHtml(j.description),
  }
}

/**
 * Human-readable salary line from the enrichment fields, or null when absent.
 * The period is kept when freehire records one ("INR 300000–300000/year"):
 * without it a yearly figure is indistinguishable from a monthly one.
 */
function formatSalary(e: FreehireJob["enrichment"]): string | null {
  if (e.salary_min == null && e.salary_max == null) return null
  const cur = e.salary_currency ? `${e.salary_currency} ` : ""
  const per = e.salary_period ? `/${e.salary_period}` : ""
  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}${per}`
  return `${cur}${e.salary_min ?? e.salary_max}${per}`
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Strip a freehire description's HTML into readable prose: block/line-break tags
 * become newlines, entities are decoded, tags removed. Null for empty input.
 */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** Extract a freehire public slug from a bare slug or a /jobs/<slug> URL. */
export function normalizeSlug(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const m = trimmed.match(/\/jobs\/([^/?#]+)/)
  if (m) return m[1]
  // A bare slug: lowercase alphanumerics and hyphens (no path/scheme).
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed
  return null
}

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/cli.ts`
```
import { createCLI } from "@bunli/core"
import { writeError } from "./helpers.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "jobbank-cli",
  version: "1.0.0",
  description: "CLI for Akademikernes Jobbank (jobbank.dk) — job search for highly educated candidates",
})

const commands = [search, detail]
for (const command of commands) {
  cli.command(command)
}

// Reject unknown flags before dispatch. bunli silently discards them, and a
// silently discarded filter changes what the search returns without any error
// (a wrong flag name once returned an entire portal's database as if it
// matched the query). add-portal.md's contract requires a bogus flag to exit 1
// with a JSON error on stderr; this enforces it for the reference CLIs too.
//
// Both dash forms are checked. This loop inspected only `--long` tokens until
// #426, so an undefined short flag was discarded in silence: `-q "..."` on a
// portal whose keyword flag is `--search-string` returned the whole database
// as a successful, unfiltered search. Declared shorts and bunli's built-in
// -h/-v stay valid; every other single-dash token is rejected, including a
// negative number. bunli does not consume a `-`-prefixed token as the previous
// flag's value - it discards it - so `--radius -5` silently fell back to the
// default radius rather than failing its own `min(1)` schema. Erroring on it
// is the same trade linkedin-search already makes. A value that must begin
// with a dash uses the `--flag=value` form, which is checked as a long flag.
const argv = process.argv.slice(2)
const invoked = commands.find((c) => (c as { name?: string }).name === argv[0])
if (invoked) {
  const options =
    (invoked as { options?: Record<string, { short?: string } | undefined> }).options ?? {}
  const known = new Set([...Object.keys(options), "help", "version"])
  const knownShorts = new Set(
    Object.values(options)
      .map((o) => o?.short)
      .filter((s): s is string => typeof s === "string")
      .concat("h", "v"),
  )
  const rejectFlag = (rendered: string): never => {
    writeError(
      `unknown flag ${rendered} for '${argv[0]}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
      "UNKNOWN_FLAG",
    )
    process.exit(1)
  }
  for (const token of argv.slice(1)) {
    if (token === "--") break
    if (token.startsWith("--")) {
      const flag = token.slice(2).split("=")[0]
      if (!known.has(flag)) rejectFlag(`--${flag}`)
    } else if (token.startsWith("-") && token !== "-") {
      const flag = token.slice(1).split("=")[0]
      if (!knownShorts.has(flag)) rejectFlag(`-${flag}`)
    }
  }
}

await cli.run()

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/commands/detail.ts`
```
import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { fetchWithUA, normalizeJobId, parseJobPostingJsonLd, writeError, BASE_URL } from "../helpers.js"

export const detail = defineCommand({
  name: "detail",
  description: "Full detail for a single job posting",
  options: {
    format: option(z.enum(["json", "plain"]).default("json"), {
      description: "Output format: json, plain",
    }),
  },
  handler: async ({ positional, flags, signal }) => {
    if (signal.aborted) return

    const rawId = positional[0]
    if (!rawId) {
      writeError("Job ID is required", "MISSING_REQUIRED")
      process.exit(1)
    }

    const id = normalizeJobId(rawId)
    if (!id) {
      writeError(`Could not extract job ID from "${rawId}"`, "BAD_ID")
      process.exit(1)
    }

    const url = `${BASE_URL}/job/${id}/`

    try {
      const response = await fetchWithUA(url)

      if (response.status === 404) {
        writeError("Job not found", "NOT_FOUND")
        process.exit(1)
      }

      if (!response.ok) {
        writeError(`Failed to fetch job page: ${response.status} ${response.statusText}`, "API_ERROR")
        process.exit(1)
      }

      const html = await response.text()

      if (signal.aborted) return

      const jobPosting = parseJobPostingJsonLd(html)

      if (!jobPosting) {
        writeError("No JSON-LD found on job page", "PARSE_ERROR")
        process.exit(1)
      }

      // Extract fields
      const identifier = jobPosting["identifier"] as Record<string, unknown> | undefined
      const jobId = identifier?.["value"] ? String(identifier["value"]) : id

      // Check if the returned job ID doesn't match what was requested — indicates not found / redirect to different job
      // We skip this check since short URL redirects to the actual job and returns 200

      const hiringOrg = jobPosting["hiringOrganization"] as Record<string, unknown> | undefined
      const jobLocation = jobPosting["jobLocation"] as Record<string, unknown> | undefined
      const address = (jobLocation?.["address"] as Record<string, unknown>) ?? {}

      const employmentType = jobPosting["employmentType"]
      const empTypeArr: string[] = Array.isArray(employmentType)
        ? employmentType.map(String)
        : employmentType
        ? [String(employmentType)]
        : []

      const validThrough = jobPosting["validThrough"]
      let deadline: string | null = null
      if (validThrough && String(validThrough).length > 0) {
        // Normalize to YYYY-MM-DD if it's an ISO datetime
        const dtStr = String(validThrough)
        deadline = dtStr.substring(0, 10) // take first 10 chars = YYYY-MM-DD
        if (deadline === "0001-01-01") deadline = null // invalid date
      }

      const output = {
        id: jobId,
        url: String(jobPosting["url"] ?? url),
        title: String(jobPosting["title"] ?? ""),
        description: String(jobPosting["description"] ?? ""),
        datePosted: String(jobPosting["datePosted"] ?? ""),
        deadline,
        employmentType: empTypeArr,
        company: {
          name: String(hiringOrg?.["name"] ?? ""),
          logo: hiringOrg?.["logo"] ? String(hiringOrg["logo"]) : null,
        },
        location: {
          streetAddress: String(address["streetAddress"] ?? ""),
          city: String(address["addressLocality"] ?? ""),
          postalCode: String(address["postalCode"] ?? ""),
          country: String(address["addressCountry"] ?? ""),
        },
      }

      // Verify the job ID matches if possible — if the page 404'd or redirected to a different job
      // For invalid IDs that redirect to a generic page, the JSON-LD may be absent
      // We already handle the "No JSON-LD" case above

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else {
        outputPlain(output)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("NOT_FOUND")) {
        writeError("Job not found", "NOT_FOUND")
      } else {
        writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      }
      process.exit(1)
    }
  },
})

function outputPlain(data: {
  id: string
  url: string
  title: string
  description: string
  datePosted: string
  deadline: string | null
  employmentType: string[]
  company: { name: string; logo: string | null }
  location: { streetAddress: string; city: string; postalCode: string; country: string }
}): void {
  console.log(`id: ${data.id}`)
  console.log(`title: ${data.title}`)
  console.log(`company: ${data.company.name}`)
  if (data.company.logo) console.log(`logo: ${data.company.logo}`)
  console.log(`location: ${[data.location.streetAddress, data.location.city, data.location.country].filter(Boolean).join(", ")}`)
  console.log(`datePosted: ${data.datePosted}`)
  console.log(`deadline: ${data.deadline ?? "none"}`)
  console.log(`employmentType: ${data.employmentType.join(", ")}`)
  console.log(`url: ${data.url}`)
  console.log("")
  // Strip HTML tags for plain description
  const plainDescription = data.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  console.log(plainDescription)
}

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/commands/search.ts`
```
import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { rssFetch, fetchWithUA, writeError, parseRssDescription, extractJobIdFromUrl, BASE_URL, type RssItem } from "../helpers.js"

export function normalizeSearchItem(item: RssItem): Record<string, unknown> {
  const parsed = parseRssDescription(item.description)
  const id = extractJobIdFromUrl(item.link)
  // Guard the parse: new Date(<unparseable>) is an Invalid Date whose
  // toISOString() throws RangeError, and this runs inside an unguarded
  // items.map() - one bad feed item would kill the whole search as
  // API_ERROR (#416). An unparseable pubDate degrades to the same shape
  // as an absent one: posted "", date null.
  const parsedDate = item.pubDate ? new Date(item.pubDate) : null
  const posted = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : ""
  return {
    id,
    title: item.title,
    company: parsed.company,
    location: parsed.location,
    jobType: parsed.jobType,
    description: item.description,
    url: item.link,
    posted,
    date: posted ? posted.slice(0, 10) : null,
    deadline: parsed.deadline,
  }
}

export const search = defineCommand({
  name: "search",
  description: "Search job listings via RSS feed",
  options: {
    key: option(z.string().optional(), {
      description: "Keyword search (title, company, keyword)",
    }),
    exclude: option(z.string().optional(), {
      description: "Exclude keywords (antikey)",
    }),
    type: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Job type code (cvtype). Repeatable: --type 3 --type 6",
    }),
    education: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Education field code (udd). Repeatable.",
    }),
    location: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Region code (amt). Repeatable.",
    }),
    "work-area": option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Work area / function code (erf). Repeatable.",
    }),
    industry: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Industry code (branche). Repeatable.",
    }),
    "suitable-for": option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Suitable-for code (andet). Repeatable.",
    }),
    company: option(z.coerce.number().int().min(1).optional(), {
      description: "Company ID (virk)",
    }),
    remote: option(z.string().optional(), {
      description: "Remote work: helt or delvist (fjernarbejde)",
    }),
    since: option(z.string().optional(), {
      description: "Posted on or after date, format YYYY-MM-DD (oprettet)",
    }),
    limit: option(z.coerce.number().int().min(1).optional(), {
      description: "Cap total results returned by CLI (client-side)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    // Require at least one filter
    const hasFilter =
      flags.key ||
      flags.exclude ||
      flags.type ||
      flags.education ||
      flags.location ||
      flags["work-area"] ||
      flags.industry ||
      flags["suitable-for"] ||
      flags.company !== undefined ||
      flags.remote ||
      flags.since

    if (!hasFilter) {
      writeError("--key or at least one filter is required", "MISSING_REQUIRED")
      process.exit(1)
    }

    const params: Record<string, string | string[]> = {}

    if (flags.key) params["key"] = flags.key
    if (flags.exclude) params["antikey"] = flags.exclude
    if (flags.type) {
      const vals = Array.isArray(flags.type) ? flags.type : [flags.type]
      params["cvtype"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.education) {
      const vals = Array.isArray(flags.education) ? flags.education : [flags.education]
      params["udd"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.location) {
      const vals = Array.isArray(flags.location) ? flags.location : [flags.location]
      params["amt"] = vals.flatMap((v) => v.split(","))
    }
    if (flags["work-area"]) {
      const vals = Array.isArray(flags["work-area"]) ? flags["work-area"] : [flags["work-area"]]
      params["erf"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.industry) {
      const vals = Array.isArray(flags.industry) ? flags.industry : [flags.industry]
      params["branche"] = vals.flatMap((v) => v.split(","))
    }
    if (flags["suitable-for"]) {
      const vals = Array.isArray(flags["suitable-for"]) ? flags["suitable-for"] : [flags["suitable-for"]]
      params["andet"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.company !== undefined) params["virk"] = String(flags.company)
    if (flags.remote) params["fjernarbejde"] = flags.remote
    if (flags.since) params["oprettet"] = flags.since

    try {
      // Fetch RSS feed
      const items = await rssFetch(params)

      if (signal.aborted) return

      // Also fetch total count from HTML page (secondary request)
      let total: number | null = null
      try {
        // Small delay to be polite
        await new Promise((resolve) => setTimeout(resolve, 300))
        const searchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
          if (Array.isArray(value)) {
            for (const v of value) searchParams.append(key, v)
          } else {
            searchParams.append(key, value)
          }
        }
        const htmlUrl = `${BASE_URL}/job/?${searchParams.toString()}`
        const htmlResp = await fetchWithUA(htmlUrl)
        if (htmlResp.ok) {
          const html = await htmlResp.text()
          // Extract from <title> tag: "457 relevante job og karriereopslag i Akademikernes Jobbank"
          const titleMatch = html.match(/<title[^>]*>\s*(\d[\d.,]*)\s+relevante job/i)
          if (titleMatch) {
            total = parseInt(titleMatch[1].replace(/[.,]/g, ""), 10)
          }
        }
      } catch {
        // Secondary request failed — total stays null
      }

      // Normalize items
      let results = items.map(normalizeSearchItem)

      // Apply limit
      if (flags.limit !== undefined) {
        results = results.slice(0, flags.limit)
      }

      const output = { meta: { total }, results }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        outputTable(results)
      } else {
        outputPlain(results)
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

function outputTable(results: Array<Record<string, unknown>>): void {
  console.log("id        title                                company                location           deadline")
  for (const r of results) {
    const id = String(r.id ?? "-").padEnd(9)
    const title = String(r.title ?? "-").substring(0, 36).padEnd(36)
    const company = String(r.company ?? "-").substring(0, 22).padEnd(22)
    const location = String(r.location ?? "-").substring(0, 18).padEnd(18)
    const deadline = String(r.deadline ?? "-")
    console.log(`${id} ${title} ${company} ${location} ${deadline}`)
  }
}

function outputPlain(results: Array<Record<string, unknown>>): void {
  for (const r of results) {
    console.log(`id: ${r.id}`)
    console.log(`title: ${r.title}`)
    console.log(`company: ${r.company}`)
    console.log(`location: ${r.location}`)
    console.log(`jobType: ${r.jobType}`)
    console.log(`posted: ${r.posted}`)
    console.log(`deadline: ${r.deadline ?? "none"}`)
    console.log(`url: ${r.url}`)
    console.log("")
  }
}

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/helpers.ts`
```
import { parse as parseHtml } from "node-html-parser"

export const BASE_URL = "https://jobbank.dk"

export const USER_AGENT = "Mozilla/5.0 (compatible; jobbank-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export async function fetchWithUA(url: string): Promise<Response> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      delay = Math.min(delay * 2, 5000)
      continue
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

export interface RssItem {
  title: string
  description: string
  link: string
  pubDate: string
}

function extractCdata(xml: string, tag: string): string {
  // Try CDATA first
  const cdataRe = new RegExp(`<${tag}><\\!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, "s")
  const cdataMatch = xml.match(cdataRe)
  if (cdataMatch) return cdataMatch[1].trim()
  // Plain content
  const plainRe = new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "s")
  const plainMatch = xml.match(plainRe)
  return plainMatch ? plainMatch[1].trim() : ""
}

function extractLink(xml: string): string {
  // <link> in RSS can conflict with atom namespace — extract text node after <link>
  // Try CDATA variant first
  const cdataMatch = xml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/s)
  if (cdataMatch) return cdataMatch[1].trim()
  // Plain link
  const plainMatch = xml.match(/<link>(.*?)<\/link>/s)
  if (plainMatch) return plainMatch[1].trim()
  // Some RSS feeds put the URL as text after <link> without a closing tag (self-closing style)
  // Try matching href in atom:link
  return ""
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  // Split on <item> boundaries
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const match of itemMatches) {
    const itemXml = match[1]
    const title = extractCdata(itemXml, "title")
    const description = extractCdata(itemXml, "description")
    const link = extractLink(itemXml)
    const pubDate = extractCdata(itemXml, "pubDate") || itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ""
    items.push({ title, description, link, pubDate })
  }
  return items
}

export async function rssFetch(params: Record<string, string | string[]>): Promise<RssItem[]> {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        searchParams.append(key, v)
      }
    } else {
      searchParams.append(key, value)
    }
  }
  const url = `${BASE_URL}/job/rss?${searchParams.toString()}`
  const response = await fetchWithUA(url)
  if (!response.ok) {
    const body = await response.clone().text()
    if (response.status === 403 && /just a moment|cloudflare|cf-chl/i.test(body)) {
      throw new Error(
        "Jobbank is blocking automated requests with Cloudflare bot protection. Skip this portal or use the WebSearch fallback."
      )
    }
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`)
  }
  const xml = await response.text()
  return parseRssItems(xml)
}

export interface ParsedDescription {
  jobType: string
  company: string
  location: string
  deadline: string | null
}

export function parseRssDescription(desc: string): ParsedDescription {
  // Format: "JobType hos Company, Location (Ansøgningsfrist: DD.MM.YYYY)"
  // or: "JobType hos Company, Location (Ansøgningsfrist: løbende)"
  // or multiple types: "Fuldtidsjob, Graduate/trainee hos Company, Location (Ansøgningsfrist: ...)"

  let jobType = ""
  let company = ""
  let location = ""
  let deadline: string | null = null

  const hosIdx = desc.indexOf(" hos ")
  if (hosIdx === -1) {
    // Can't parse — return desc as company
    return { jobType: "", company: desc, location: "", deadline: null }
  }

  jobType = desc.substring(0, hosIdx).trim()
  let rest = desc.substring(hosIdx + 5) // skip " hos "

  // Extract deadline from parenthetical at the end
  const deadlineMatch = rest.match(/\(Ans[øo]gningsfrist:\s*(.*?)\)\s*$/)
  if (deadlineMatch) {
    const deadlineStr = deadlineMatch[1].trim()
    if (deadlineStr.toLowerCase() === "løbende" || deadlineStr.toLowerCase() === "lobende") {
      deadline = null
    } else {
      // The feed writes DD.MM.YYYY; the /scrape contract (and this CLI's own
      // detail command) use YYYY-MM-DD. Convert the known shape; anything else
      // passes through so an unexpected value stays visible downstream.
      const dmy = deadlineStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      deadline = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : deadlineStr
    }
    // Remove the deadline portion from rest
    rest = rest.substring(0, deadlineMatch.index).trim()
  }

  // rest is now "Company, Location"
  // Split on first ", " to get company and location
  const firstComma = rest.indexOf(", ")
  if (firstComma !== -1) {
    company = rest.substring(0, firstComma).trim()
    location = rest.substring(firstComma + 2).trim()
  } else {
    company = rest.trim()
    location = ""
  }

  return { jobType, company, location, deadline }
}

export function normalizeJobId(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  const match = trimmed.match(/\/job\/(\d+)(?:\/|$|\?|#)/)
  return match ? match[1] : null
}

export function extractJobIdFromUrl(url: string): string {
  // URL format: https://jobbank.dk/job/{id}/{company-slug}/{title-slug}
  return normalizeJobId(url) ?? ""
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const jobPosting = findJobPosting(item)
      if (jobPosting) return jobPosting
    }
    return null
  }

  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  if (record["@type"] === "JobPosting") return record

  return findJobPosting(record["@graph"])
}

export function parseJobPostingJsonLd(html: string): Record<string, unknown> | null {
  const root = parseHtml(html)
  const scripts = root.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    try {
      const jobPosting = findJobPosting(JSON.parse(script.text) as unknown)
      if (jobPosting) return jobPosting
    } catch {
      // Invalid JSON-LD should not prevent later scripts from being checked.
    }
  }

  return null
}

```

### Core Architecture Module: `.agents/skills/jobdanmark-search/cli/src/cli.ts`
```
import { createCLI } from "@bunli/core"
import { writeError } from "./helpers.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"
import { categories } from "./commands/categories.js"
import { autocomplete } from "./commands/autocomplete.js"
import { locations } from "./commands/locations.js"

const cli = await createCLI({
  name: "jobdanmark-cli",
  version: "1.0.0",
  description: "CLI for the Jobdanmark.dk public job search API",
})

const commands = [search, detail, categories, autocomplete, locations]
for (const command of commands) {
  cli.command(command)
}

// Reject unknown flags before dispatch. bunli silently discards them, and a
// silently discarded filter changes what the search returns without any error
// (a wrong flag name once returned an entire portal's database as if it
// matched the query). add-portal.md's contract requires a bogus flag to exit 1
// with a JSON error on stderr; this enforces it for the reference CLIs too.
//
// Both dash forms are checked. This loop inspected only `--long` tokens until
// #426, so an undefined short flag was discarded in silence: `-q "..."` on a
// portal whose keyword flag is `--search-string` returned the whole database
// as a successful, unfiltered search. Declared shorts and bunli's built-in
// -h/-v stay valid; every other single-dash token is rejected, including a
// negative number. bunli does not consume a `-`-prefixed token as the previous
// flag's value - it discards it - so `--radius -5` silently fell back to the
// default radius rather than failing its own `min(1)` schema. Erroring on it
// is the same trade linkedin-search already makes. A value that must begin
// with a dash uses the `--flag=value` form, which is checked as a long flag.
const argv = process.argv.slice(2)
const invoked = commands.find((c) => (c as { name?: string }).name === argv[0])
if (invoked) {
  const options =
    (invoked as { options?: Record<string, { short?: string } | undefined> }).options ?? {}
  const known = new Set([...Object.keys(options), "help", "version"])
  const knownShorts = new Set(
    Object.values(options)
      .map((o) => o?.short)
      .filter((s): s is string => typeof s === "string")
      .concat("h", "v"),
  )
  const rejectFlag = (rendered: string): never => {
    writeError(
      `unknown flag ${rendered} for '${argv[0]}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
      "UNKNOWN_FLAG",
    )
    process.exit(1)
  }
  for (const token of argv.slice(1)) {
    if (token === "--") break
    if (token.startsWith("--")) {
      const flag = token.slice(2).split("=")[0]
      if (!known.has(flag)) rejectFlag(`--${flag}`)
    } else if (token.startsWith("-") && token !== "-") {
      const flag = token.slice(1).split("=")[0]
      if (!knownShorts.has(flag)) rejectFlag(`-${flag}`)
    }
  }
}

await cli.run()

```

### Core Architecture Module: `.agents/skills/jobdanmark-search/cli/src/commands/autocomplete.ts`
```
import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { apiFetch, writeError } from "../helpers.js"

interface AutocompleteItem {
  id: string
  // Nullable because apiFetch casts the JSON body with no runtime validation:
  // an item missing its text arrives typed as if it had one, and the filter
  // below is the only place the command derefs it (#421). A null text can
  // never match the required non-empty query, so such an item is filtered
  // out here and downstream output never sees it.
  text: string | null
  value: number
  category: string
  slug: string
}

interface AutocompleteGroup {
  title: string
  items: AutocompleteItem[]
}

/**
 * Filter the API's autocomplete groups to items whose text matches the query
 * (the API always returns all categories, so a nonsense query must yield []).
 * Exported for tests.
 */
export function filterAutocompleteGroups(raw: AutocompleteGroup[], query: string): AutocompleteGroup[] {
  const queryLower = query.toLowerCase()
  return raw
    .map((g) => ({
      title: g.title,
      items: (g.items ?? []).filter(
        (item) => typeof item.text === "string" && item.text.toLowerCase().includes(queryLower),
      ),
    }))
    .filter((g) => g.items.length > 0)
}

export const autocomplete = defineCommand({
  name: "autocomplete",
  description: "Suggest job titles and categories for a query",
  options: {
    query: option(z.string().optional(), {
      description: "Search text to autocomplete (required)",
    }),
    limit: option(z.coerce.number().int().min(1).optional(), {
      description: "Cap total suggestions returned",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    if (!flags.query) {
      writeError("--query is required", "MISSING_REQUIRED")
      process.exit(1)
    }

    try {
      const raw = await apiFetch<AutocompleteGroup[]>("/api/search/autocomplete", {
        q: flags.query,
      })

      if (signal.aborted) return

      const filtered = filterAutocompleteGroups(raw, flags.query)

      let result = filtered

      if (flags.limit !== undefined) {
        // Apply limit across all groups, distributing across groups
        let remaining = flags.limit
        result = []
        for (const group of filtered) {
          if (remaining <= 0) break
          const items = group.items.slice(0, remaining)
          remaining -= items.length
          if (items.length > 0) {
            result.push({ title: group.title, items })
          }
        }
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(result, null, 2))
      } else if (flags.format === "table") {
        outputTable(result)
      } else {
        outputPlain(result)
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

function outputTable(data: AutocompleteGroup[]): void {
  console.log("category   id                    text                              value  slug")
  for (const group of data) {
    for (const item of group.items) {
      const cat = item.category.padEnd(10)
      const id = item.id.substring(0, 20).padEnd(20)
      const text = (item.text ?? "").substring(0, 32).padEnd(32)
      const value = String(item.value).padEnd(6)
      const slug = item.slug
      console.log(`${cat} ${id} ${text} ${value} ${slug}`)
    }
  }
}

function outputPlain(data: AutocompleteGroup[]): void {
  for (const group of data) {
    console.log(`=== ${group.title} ===`)
    for (const item of group.items) {
      console.log(`  ${item.text ?? ""} (${item.category}, id=${item.value}, slug=${item.slug})`)
    }
  }
}

```

### Core Architecture Module: `.agents/skills/jobdanmark-search/cli/src/commands/categories.ts`
```
import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { apiFetch, writeError } from "../helpers.js"

interface Category {
  id: number
  title: string
  helpText: string
  count: number
}

export const categories = defineCommand({
  name: "categories",
  description: "List all job categories with live counts",
  options: {
    limit: option(z.coerce.number().int().min(1).optional(), {
      description: "Cap number of categories returned",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    try {
      let data = await apiFetch<Category[]>("/api/categorycount/getcounts")

      if (signal.aborted) return

      if (flags.limit !== undefined) {
        data = data.slice(0, flags.limit)
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(data, null, 2))
      } else if (flags.format === "table") {
        outputTable(data)
      } else {
        outputPlain(data)
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

function outputTable(data: Category[]): void {
  console.log("id        title                                            count")
  for (const cat of data) {
    const id = String(cat.id).padEnd(9)
    const title = cat.title.substring(0, 48).padEnd(48)
    const count = String(cat.count)
    console.log(`${id} ${title} ${count}`)
  }
}

function outputPlain(data: Category[]): void {
  for (const cat of data) {
    console.log(`id: ${cat.id}`)
    console.log(`title: ${cat.title}`)
    console.log(`helpText: ${cat.helpText}`)
    console.log(`count: ${cat.count}`)
    console.log("")
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #518** (2026-10-05): **fix(portal-clis): emit the contract's id field from jobnet and jobdanmark search results**
  *Symptoms*: ## What was wrong  `/add-portal`'s contract ([add-portal.md:80](https://github.com/MadsLorentzen/ai-job-search/blob/52f84e0/.claude/commands/add-portal.md#L80)) says every search result has at least `id`, `title`, `company`, `location`, `date`, `url`. jobbank, jobindex, linkedin and freehire emit `id`. When #340 added the `company`/`location`/`date`/`url` aliases to jobnet and jobdanmark, `id` was left out, so their results exposed the value only under the native name (`jobAdId`, `slug`):  ``` $ bun run .agents/skills/jobnet-search/cli/src/cli.ts search --search-string x | jq '.results[0] | keys' [ "applicationDeadline", ..., "jobAdId", ..., "url" ]        # no "id" $ bun run .agents/skills/jobdanmark-search/cli/src/cli.ts search --text x | jq '.results[0] | keys' [ "applicationDeadline", ..., "slug", ..., "url" ]           # no "id" ```  A consumer reading every portal's JSON through one shape, which is what `/scrape` does, has to special-case these two to find the value to pass to `detail`.  ## What changes  - `id: job.jobAdId` in jobnet's `createSearchOutput`, `id: slug` in jobdanmark's `normalizeItem`, placed with the other contract aliases and commented as such. Purely additive: native keys stay, nothing is renamed, table and plain renderers are untouched. - Each `SKILL.md` notes that `jobAdId` / `slug` is also emitted as `id`. - The additive-contract test in each CLI's `search-normalization.test.ts` now asserts `id` and its equality with the native key. **Both fail on m
  **Post-Mortem & Fix Analysis**:
  > Merged. Live `search` on both portals now carries `id` equal to `jobAdId` / `slug`, and feeding it to `detail` resolves on both. Table and plain renderers are byte-identical to master on the same queries, the two contract tests fail on master, and both suites pass with the network blocked (47 and 59). All four other shipped CLIs do emit `id` (freehire's lives in `helpers.ts`).  One framing note: `/scrape` itself never reads `id`; it keys on url, company and title and follows each SKILL.md for `detail`, so this closes a contract gap rather than a scrape failure. Still right to fix, since the contract and the Step-3 smoke test in `/add-portal` are what a new portal author copies. 

- **Issue #517** (2026-10-03): **sync fork**
  *Symptoms*: <!-- Heads-up before you publish: if you built this in a personalized fork      (your profile data, your market's job portals, another AI runtime),      note that GitHub points new PRs at the UPSTREAM repo by default.      Those adaptations live in forks - see CONTRIBUTING.md - and get      discovered via the pinned "Community forks & adaptations" discussion (#78).      Check the "base repository" dropdown above before you continue. -->  ## What changed and why  ## Failing case / reproduction (for fixes)  ## Verification <!-- What you ran, per CONTRIBUTING: python3 tools/lint_skills.py,      python3 tools/check_framework_version.py, bun test / bun run typecheck      in touched CLIs, python3 -m unittest discover -s tests --> 

- **Issue #516** (2026-10-05): **fix(jobdanmark-search): render a JSON-LD description as text instead of passing the markup through (#515)**
  *Symptoms*: Fixes #515.  ## What was wrong  `detail` emitted two description shapes from one command. The rendered-HTML branch joins `<p>`/`<li>` nodes into one clean line each; the JSON-LD branch ([master, detail.ts:118](https://github.com/MadsLorentzen/ai-job-search/blob/52f84e0/.agents/skills/jobdanmark-search/cli/src/commands/detail.ts#L118)) passed `jobPosting.description` through verbatim. Real handler, `fetch` stubbed with a JSON-LD page, `--format plain`:  | | `description:` line | |---|---| | master | `<p>Vi søger en udvikler til R&D.</p><ul><li>Python & Go</li><li>SQL</li></ul>` | | this branch | `Vi søger en udvikler til R&D.` ⏎ `Python & Go` ⏎ `SQL` |  `/add-portal` Step 4 requires "readable text (entities decoded, tags stripped, paragraph breaks preserved)", and `/scrape` stores the snippet while `/rank` reads the body, so the markup went into the state file and agent context as-is. The existing JSON-LD test pinned the raw `<p>…</p>`, which is why CI was green on it.  ## What changes  - **`detail.ts`**: `descriptionToText()` renders the JSON-LD HTML through `node-html-parser`'s `structuredText` (already a dependency: one line per block element, entities decoded, tags gone) and normalises each line with the branch's existing `cleanText`, so both branches emit the same shape. Plain-text descriptions are unchanged; an absent one stays `""`. - **`tests/detail-jsonld.test.ts`**: the first case now expects `"Build reliable pipelines."`; a new case covers `<p>`, `<br>`, `<ul><li>` 
  **Post-Mortem & Fix Analysis**:
  > Merged. The problem is real on live pages: all three `udvikler` postings I pulled hit the JSON-LD branch (jobdanmark writes the script type as `application/ld&#x2B;json`, which the parser decodes), and their descriptions carry `<p>`, `<ul>/<li>`, `<br>`, `<strong>` and `&amp;`. Master printed them as one 5-7 KB line of markup; this branch prints the fallback shape, 36-38 clean lines, no tag or entity left. In a wider `ingeniør` sample 5 of 8 pages were JSON-LD with HTML and 3 fell back to rendered HTML, so both branches are live today. 61 tests pass with the network blocked, the two predicted cases fail on master.  Two observations, neither blocking. A plain-text description containing `<` directly followed by letters (`a<b`) is now eaten by the parser; every live description sampled is HTML, where that would be `&lt;`, so I rate it negligible. And on the fallback branch, `konsulent-til-renoveringsprogram` emits `employmentType: ["Fuldtid </ li >"]`: `overviewValue` leaks a mangled c

- **Issue #515** (2026-10-05): **jobdanmark-search detail returns raw HTML in the description on the JSON-LD path while the rendered-HTML path returns text**
  *Symptoms*: Line references against `master` @ `52f84e0`.  ## Summary  `jobdanmark-search detail` emits two different description shapes depending on which page layout it hits. The rendered-HTML branch (`fromRenderedHtml`, `detail.ts:180-184`) joins `<p>`/`<li>` nodes into one clean line each. The JSON-LD branch (`fromJsonLd`, `detail.ts:118`) does `description: jobPosting.description ?? ""`, passing schema.org's HTML through verbatim, and `outputPlain` prints it as-is. `helpers.ts:110` exports a `stripHtml` that nothing imports.  ## Reproduction (network-free, real handler)  Stub `fetch` to return a page whose JSON-LD `description` is `<p>Vi s&oslash;ger en udvikler til R&amp;D.</p><ul><li>Python &amp; Go</li><li>SQL</li></ul>` and run the exported `detail.handler` with `--format plain`:  ``` description: <p>Vi søger en udvikler til R&D.</p><ul><li>Python & Go</li><li>SQL</li></ul> ```  Same posting through the rendered-HTML fallback (the `detail-parsing.test.ts` fixture shape):  ``` description: Vi søger en udvikler til R&D. Python & Go SQL ```  The existing `detail-jsonld.test.ts` pins the raw `<p>Build reliable pipelines.</p>` as the expected value, so CI is green on the markup.  ## Why it matters  `/add-portal` Step 4 (`add-portal.md:114`) requires a detail description to be "readable text (entities decoded, tags stripped, paragraph breaks preserved)". `/scrape` Step 2 stores the description snippet and `/rank` reads the body, so the markup inflates agent context and lands in the st

- **Issue #514** (2026-10-05): **fix(job_key): hash mixed-script names instead of keying on their Latin fragment (#513)**
  *Symptoms*: Fixes #513.  ## What was wrong  The hash fallbacks from #487 and #502 fire only when the slug is completely empty. A mixed-script name keeps its Latin or digit fragment and skips them, so different postings collapse to one key (documented command, distinct URLs each time):  | company | title | key on master | |---|---|---| | `Яндекс` | `Программист 1С` | `company-6d769a_1` | | `Яндекс` | `Аналитик 1С` | `company-6d769a_1` | | `ООО Чен` | `Python-разработчик` | `company-3dc110_python` | | `ООО Чен` | `Python-аналитик` | `company-3dc110_python` | | `Сбер AI` | `ML Engineer` | `ai_ml-engineer` | | `Яндекс AI` | `ML Engineer` | `ai_ml-engineer` |  `/scrape` Step 4 drops the second posting as already seen, and because the dict key is overwritten, `--audit` cannot report it under `duplicate_urls` afterwards. "1С" titles and "N категории" grade suffixes are everyday Russian listings on freehire, the shipped multi-market portal whose Cyrillic titles the existing tests already use.  ## What changes  - **`_lost_letters(text)`**: true when the NFKD/ASCII fold drops a letter whose Unicode name is not `LATIN ...`. Both fallbacks now also run when this is true, not only on an empty slug. - **Title half**: portal numeric id when the URL has one, else the URL hash (title hash with no URL), with the surviving fragment kept as a readable prefix: `acme_1-4461771225`, `company-6d769a_1-bb31e9` vs `..._1-cd17c4`, `..._python-<hash>`. - **Company half**: the NFC-casefold name hash with the fragmen
  **Post-Mortem & Fix Analysis**:
  > Merged. Reproduced all three collisions on master through the documented CLI, the four collision tests fail on master's `job_key.py` and pass here, and a 30-company Danish/English probe (150 company+title+URL combinations, Ørsted/Mærsk/Rambøll/Søstrene Grene included) keys byte-identically on both versions, so no live Danish `seen_jobs.json` re-keys. A full-codepoint sweep confirms the Latin carve-out: every real Latin letter without a decomposition carries a `LATIN` name, and the only two counted as lossy are the obsolete `ŉ` and `ẚ`. Windows suite 542 OK.  One thing outside the stated rule, for a follow-up if you agree: line 149 now appends the digest to `basis` too, so an empty title with a URL that has no six-digit run re-keys (`acme_https-example-com-jobs-abc-xyz` -> `..._5ca8c6`). `/scrape` always passes a title, so it is unreachable on the real path, but `title_slug = f"{fragment}-{digest}" if fragment else (basis or f"untitled-{digest}")` would keep master's output there. Als

- **Issue #513** (2026-10-05): **job_key.py gives two postings one key when a title or company is partly non-Latin (hash fallback only fires on an empty slug)**
  *Symptoms*: Line references against `master` @ `52f84e0`.  ## Summary  `tools/job_key.py` gives two different postings the same key when a title or company is only partly non-Latin. The hash fallbacks added in #487 and #502 fire only when the slug is completely empty (`make_key`, `job_key.py:87` for the company half, `:93-94` for the title half). A mixed-script name keeps just its Latin or digit fragment, so different names collapse to one fragment and one key.  ## Reproduction (the documented command from `job-scraper/SKILL.md:147`, distinct URLs each time)  ``` $ python3 tools/job_key.py --company "Яндекс" --title "Программист 1С" --url "https://freehire.me/jobs/programmist-1s-aaa" company-6d769a_1 $ python3 tools/job_key.py --company "Яндекс" --title "Аналитик 1С"    --url "https://freehire.me/jobs/analitik-1s-bbb" company-6d769a_1 $ python3 tools/job_key.py --company "ООО Чен" --title "Python-разработчик" --url ".../python-razrabotchik-x1" company-3dc110_python $ python3 tools/job_key.py --company "ООО Чен" --title "Python-аналитик"    --url ".../python-analitik-x2" company-3dc110_python $ python3 tools/job_key.py --company "Сбер AI"   --title "ML Engineer" --url "https://x/1" ai_ml-engineer $ python3 tools/job_key.py --company "Яндекс AI" --title "ML Engineer" --url "https://x/2" ai_ml-engineer ```  Observed: one key per pair. Expected: distinct keys. `test_distinct_urls_still_get_distinct_keys` asserts exactly this, but only for a fully non-Latin title, where the slug is `""` and t

- **Issue #512** (2026-10-03): **fix(verify_pdf): --ascii-dates needs digit boundaries around the year (follow-up to #498)**
  *Symptoms*: Follow-up to #498, found while re-checking the flag against realistic CV bullets.  ## What was wrong  `_YEAR` in `tools/verify_pdf.py` was `(?:19|20)\d{2}` with no digit boundaries, so a year-like run inside a longer number counted as a year. A quantified bullet typed with `--` therefore failed `/apply` Step 5d as an en-dashed date range:  ``` $ python3 -c "from tools.verify_pdf import find_non_ascii_date_ranges as f; print(f('Grew budget DKK 120000–200000'))" [('Grew budget DKK 120000–200000', '–')]        # `–2000` inside `200000` $ ... f('Scaled ingestion from 12000–15000 events/s') [('Scaled ingestion from 12000–15000 events/s', '–')]   # `2000–` inside `12000` ```  Expected `[]` on both: the tool's docstring and the guide both promise a numeric range with no year is left alone, and the agent was otherwise told to fix a "date argument" that does not exist.  ## What changes  - `_YEAR` becomes `(?<!\d)(?:19|20)\d{2}(?!\d)`. - Two new `FindNonAsciiDateRangesTests` cases: the two numeric ranges above return `[]` (fails on the unbounded pattern), and `2016–2024 (120000 users)` is still caught. - CHANGELOG `[Unreleased]` / Fixed line.  Every other case, including the newline fixtures from #498's review, still passes. Suite, lint, framework-version check green. 
  **Post-Mortem & Fix Analysis**:
  > Merged, thank you. Reproduced on master: both quantified ranges came back as en-dashed dates (`–2000` inside `200000`, `2000–` inside `12000`), and `apply.md` Step 5d would have sent the agent to fix a date argument that does not exist. On the branch both return `[]`, `2016–2024 (120000 users)` is still caught, and the #498 newline fixtures still pass. Your numeric test fails against master's `verify_pdf.py` in both subtests and passes here; full suite OK on Windows, lint and guards green, the CHANGELOG entry sits at the top of `[Unreleased]` / Fixed on current master, CI 18/18. A lookbehind and lookahead is the whole fix, and the comment says why it is there. 

- **Issue #511** (2026-10-02): **fix(check_framework_version): decode git diff output as UTF-8**
  *Symptoms*: ## What was changed  run_git() decoded git diff output using the host locale's codec instead of UTF-8, so any non-ASCII byte in a modified file (e.g. an em dash) crashed the check with UnicodeDecodeError instead of evaluating it - reproduced on a real Windows checkout. Fix: pin encoding="utf-8" on the subprocess.run() call; added a test asserting that kwarg is always set, verified it fails pre-fix and passes post-fix.
  **Post-Mortem & Fix Analysis**:
  > Merged, thank you. Re-verified `6935f2f` on Windows before the rebase: a framework file with `Ё` and no bump now reports the missing bump instead of dying, the docstring and CHANGELOG tell the cp1252-undefined-bytes story, `errors="replace"` is in, full suite OK. I rebased the CHANGELOG onto the three entries that landed ahead of it and pushed to your branch; CI 18/18 on the rebased head.  One thing I noticed while probing, out of scope here and not a defect of this fix: a framework file containing a byte that is not valid UTF-8 at all (a raw `0xFF`) still crashes the gate, in `parse_frontmatter`'s `read_text`, on every platform. That is a broken file rather than a locale problem, and a loud `UnicodeDecodeError` naming it is arguably the right outcome, so I am leaving it as is. 

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

### Incident Patch 1: `895c0219` (2026-10-05)
**Commit Message**: fix(portal-clis): emit the contract's `id` field from jobnet and jobdanmark search results (#518)

/add-portal's contract says every search result carries at least id,
title, company, location, date, url, and the four other shipped CLIs
emit id. When #340 added the company/location/date/url aliases to these
two, id was left out: jobnet exposed the value only as jobAdId,
jobdanmark only as slug, so a consumer reading every portal's JSON
through one shape had to special-case both to call detail.

Purely additive: id equals jobAdId on jobnet and slug on jobdanmark, the
native keys stay, nothing is renamed. Each SKILL.md notes the alias. The
additive-contract test in each CLI now asserts id and its equality with
the native key; both fail on master.

**File**: `.agents/skills/jobdanmark-search/SKILL.md` (modified, +1/-1)
```diff
@@ -224,6 +224,6 @@ All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and
 - All data is from the public Jobdanmark.dk API — no credentials required.
 - Pagination is 1-indexed (`--page 1` is the first page). 30 items per page, server-enforced.
 - The `detail` command fetches the HTML job page and parses embedded JSON-LD when available, with a rendered-HTML fallback for pages that omit structured data. It does not use a separate JSON API.
-- `slug` in search results is extracted from the API's relative `url` field (the path after `/job/`).
+- `slug` in search results is extracted from the API's relative `url` field (the path after `/job/`); it is also emitted as `id`, the portal-contract name every search CLI shares.
 - `applicationDeadline` in search results can be `null` (no deadline set).
 - Job type values for filters: `fuldtid`, `deltid`, `fleksjob`, `elev`, `studiejob`, `praktik`.
```

**File**: `.agents/skills/jobdanmark-search/cli/src/commands/search.ts` (modified, +4/-0)
```diff
@@ -74,6 +74,10 @@ export function normalizeItem(item: ApiSearchItem): Record<string, unknown> {
     applicationDeadline: item.applicationDeadline ?? null,
     url: fullUrl,
     slug,
+    // /scrape contract aliases (add-portal.md: every result carries at least
+    // id, title, company, location, date, url). `id` is the slug - the value
+    // `detail` takes - under the name every other portal CLI uses.
+    id: slug,
     company: item.companyName,
     location: extractCity(item.companyAddress),
     date: toContractDate(item.publishedDate),
```

**File**: `.agents/skills/jobdanmark-search/cli/tests/search-normalization.test.ts` (modified, +4/-1)
```diff
@@ -20,16 +20,19 @@ function item(): ApiSearchItem {
 }
 
 describe("Jobdanmark search normalization", () => {
-  test("additively emits the /scrape contract fields (company, location, date, deadline)", () => {
+  test("additively emits the /scrape contract fields (id, company, location, date, deadline, url)", () => {
     const result = normalizeItem(item());
 
     expect(result).toMatchObject({
+      id: "softwareudvikler-til-statens-it",
       company: "Statens It",
       location: "Ballerup",
       date: "2026-07-27",
       deadline: "2026-08-17",
       url: "https://jobdanmark.dk/job/softwareudvikler-til-statens-it",
     });
+    // `id` is the contract name for the value `detail <slug>` consumes.
+    expect(result.id).toBe(result.slug);
   });
 
   test("maps a missing address zip and a null deadline to null", () => {
```

**File**: `.agents/skills/jobnet-search/SKILL.md` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Key flags:
 bun run .agents/skills/jobnet-search/cli/src/cli.ts detail <jobAdId> [--format json|plain]
 ```
 
-`jobAdId` is the UUID from `search` results (the `jobAdId` field). Returns the complete job
+`jobAdId` is the UUID from `search` results (the `jobAdId` field, also emitted as `id`, the portal-contract name every search CLI shares). Returns the complete job
 description, contact persons, application deadline, employer details, and direct application URL.
 
 ### Search occupation types
```

**File**: `.agents/skills/jobnet-search/cli/src/commands/search.ts` (modified, +4/-0)
```diff
@@ -104,6 +104,10 @@ export function createSearchOutput(data: SearchApiResponse, flags: SearchFlags)
     workPlaceAddress: job.workPlaceAddress ?? "",
     isSeen: job.isSeen,
     isFavorite: job.isFavorite,
+    // /scrape contract aliases (add-portal.md: every result carries at least
+    // id, title, company, location, date, url). `id` is the jobAdId - the
+    // value `detail` takes - under the name every other portal CLI uses.
+    id: job.jobAdId,
     company: job.hiringOrgName,
     location: job.postalDistrictName ?? job.municipality ?? null,
     date: job.publicationDate ? job.publicationDate.slice(0, 10) : null,
```

**File**: `.agents/skills/jobnet-search/cli/tests/search-normalization.test.ts` (modified, +5/-1)
```diff
@@ -128,18 +128,20 @@ describe("Jobnet search normalization", () => {
     expect("description" in output.results[0]).toBe(false);
   });
 
-  test("additively emits the /scrape contract fields (company, location, date, deadline, url)", () => {
+  test("additively emits the /scrape contract fields (id, company, location, date, deadline, url)", () => {
     const output = createSearchOutput(apiResponse(), { ...flags, limit: undefined });
 
     expect(output.results).toHaveLength(2);
     expect(output.results[0]).toMatchObject({
+      id: "job-1",
       company: "Acme",
       location: null,
       date: "2026-07-01",
       deadline: null,
       url: "https://jobnet.dk/find-job/job-1",
     });
     expect(output.results[1]).toMatchObject({
+      id: "job-2",
       company: "Example Co",
       location: "København Ø",
       date: "2026-07-02",
@@ -148,6 +150,8 @@ describe("Jobnet search normalization", () => {
     });
     expect(output.results[0].hiringOrgName).toBe("Acme");
     expect(output.results[1].applicationDeadline).toBe("2026-08-01T23:59:00+02:00");
+    // `id` is the contract name for the value `detail <jobAdId>` consumes.
+    expect(output.results[0].id).toBe(output.results[0].jobAdId);
   });
 
   test("maps Jobnet's undisclosed-deadline sentinel (1900-01-01) to null", () => {
```

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -15,6 +15,17 @@ per-file diff commands.
 
 ### Fixed
 
+- **`jobnet-search` and `jobdanmark-search` search results now carry the contract's `id`
+  field** (`search.ts` and `search-normalization.test.ts` in both CLIs, both `SKILL.md`s) -
+  `/add-portal`'s contract says every search result has at least `id`, `title`, `company`,
+  `location`, `date`, `url`, and the four other shipped CLIs emit `id`. When #340 added the
+  `company`/`location`/`date`/`url` aliases to these two, `id` was left out: jobnet exposed the
+  value only as `jobAdId`, jobdanmark only as `slug`, so a consumer reading every portal's
+  JSON through one shape had to special-case both to call `detail`. Purely additive: `id`
+  equals `jobAdId` on jobnet and `slug` on jobdanmark, the native keys stay, nothing is
+  renamed. The additive-contract test in each CLI now asserts `id` and its equality with the
+  native key; both fail on master.
+
 - **`jobdanmark-search detail` renders a JSON-LD description as text instead of passing
   the markup through** (`.agents/skills/jobdanmark-search/cli/src/commands/detail.ts`,
   `tests/detail-jsonld.test.ts`) - the JSON-LD branch emitted `jobPosting.description`
```

---

### Incident Patch 2: `e9115b02` (2026-10-05)
**Commit Message**: fix(jobdanmark-search): render a JSON-LD description as text instead of passing the markup through (#516)

The JSON-LD branch of detail emitted jobPosting.description verbatim, so
`detail --format plain` printed
`description: <p>Vi søger en udvikler til R&D.</p><ul><li>Python & Go</li>...`
while the rendered-HTML branch of the same command printed one clean
line per paragraph and bullet. Two description shapes from one command
depending on which page layout it hit, and the markup landed in
/scrape's stored snippet and /rank's agent context as-is. The portal
contract (/add-portal Step 4) asks for readable text: entities decoded,
tags stripped, paragraph breaks preserved.

Render the HTML through node-html-parser's structuredText - one line per
block element, entities decoded, tags gone - which is the shape the
fallback already produces. A plain-text description is unchanged, an
absent one stays "".

The JSON-LD test that pinned the raw <p>...</p> now expects the text,
plus two new cases; the HTML case fails on master.

**File**: `.agents/skills/jobdanmark-search/cli/src/commands/detail.ts` (modified, +16/-1)
```diff
@@ -56,6 +56,21 @@ function cleanText(text: string): string {
   return text.replace(/\s+/g, " ").trim()
 }
 
+/**
+ * JSON-LD descriptions arrive as HTML (schema.org allows it, jobdanmark uses
+ * it). Render them to the same newline-separated plain text the rendered-HTML
+ * branch produces, so `detail` emits one description shape whichever page
+ * layout it hit: tags gone, entities decoded, one line per block element.
+ */
+function descriptionToText(html: string | undefined): string {
+  if (!html) return ""
+  return parse(html)
+    .structuredText.split("\n")
+    .map(cleanText)
+    .filter(Boolean)
+    .join("\n")
+}
+
 function normalizeUrl(value: string | null | undefined): string | null {
   if (!value) return null
   const decoded = value.replace(/&amp;/g, "&")
@@ -115,7 +130,7 @@ function fromJsonLd(jobPosting: JsonLdJobPosting, slug: string, url: string): De
       postalCode: address?.postalCode ?? null,
       addressCountry: address?.addressCountry ?? null,
     },
-    description: jobPosting.description ?? "",
+    description: descriptionToText(jobPosting.description),
     applyUrl: null,
   }
 }
```

**File**: `.agents/skills/jobdanmark-search/cli/tests/detail-jsonld.test.ts` (modified, +33/-1)
```diff
@@ -50,11 +50,43 @@ describe("parseJobPostingFromHtml JSON-LD", () => {
         postalCode: "5000",
         addressCountry: "DK",
       },
-      description: "<p>Build reliable pipelines.</p>",
+      description: "Build reliable pipelines.",
       applyUrl: null,
     });
   });
 
+  test("renders an HTML description to the rendered-branch text shape", () => {
+    // add-portal.md Step 4: a detail description is "readable text (entities
+    // decoded, tags stripped, paragraph breaks preserved)". The rendered-HTML
+    // fallback already emits one line per <p>/<li>; the JSON-LD branch passed
+    // the markup through verbatim, so the same command produced two shapes.
+    const posting = {
+      "@type": "JobPosting",
+      title: "Udvikler",
+      description:
+        "<p>Vi s&oslash;ger en udvikler til R&amp;D.</p><p>Second   para<br>line two</p><ul><li>Python &amp; Go</li><li>SQL</li></ul>",
+    };
+
+    const parsed = parseJobPostingFromHtml(
+      pageWithScripts(JSON.stringify(posting)),
+      "udvikler",
+      "https://jobdanmark.dk/job/udvikler",
+    );
+
+    expect(parsed.description).toBe("Vi søger en udvikler til R&D.\nSecond para\nline two\nPython & Go\nSQL");
+    expect(parsed.description).not.toMatch(/<[^>]+>/);
+  });
+
+  test("leaves a plain-text description unchanged and an absent one empty", () => {
+    const withText = { "@type": "JobPosting", title: "A", description: "Plain prose, no markup." };
+    const without = { "@type": "JobPosting", title: "B" };
+
+    expect(parseJobPostingFromHtml(pageWithScripts(JSON.stringify(withText)), "a", "https://jobdanmark.dk/job/a").description).toBe(
+      "Plain prose, no markup.",
+    );
+    expect(parseJobPostingFromHtml(pageWithScripts(JSON.stringify(without)), "b", "https://jobdanmark.dk/job/b").description).toBe("");
+  });
+
   test("skips malformed scripts and finds a JobPosting in an array", () => {
     const scripts = [
       "{not-json",
```

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -15,6 +15,21 @@ per-file diff commands.
 
 ### Fixed
 
+- **`jobdanmark-search detail` renders a JSON-LD description as text instead of passing
+  the markup through** (`.agents/skills/jobdanmark-search/cli/src/commands/detail.ts`,
+  `tests/detail-jsonld.test.ts`) - the JSON-LD branch emitted `jobPosting.description`
+  verbatim, so `detail --format plain` printed
+  `description: <p>Vi søger en udvikler til R&D.</p><ul><li>Python & Go</li>...` while the
+  rendered-HTML branch of the same command printed one clean line per paragraph and bullet:
+  two description shapes from one command depending on which page layout it hit, and the
+  markup landed in `/scrape`'s stored snippet and `/rank`'s agent context as-is. The
+  portal contract (`/add-portal` Step 4) asks for "readable text (entities decoded, tags
+  stripped, paragraph breaks preserved)". The JSON-LD branch now renders the HTML through
+  `node-html-parser`'s `structuredText` - one line per block element, entities decoded, tags
+  gone - which is the shape the fallback already produces. A plain-text description is
+  unchanged, an absent one stays `""`. The JSON-LD test that pinned the raw `<p>...</p>` now
+  expects the text, plus two new cases; the HTML case fails on master.
+
 - **`job_key.py` no longer gives two postings one key when a title or company is partly
   non-Latin** (`tools/job_key.py`, `tests/test_job_key.py`) - the hash fallbacks from #487
   and #502 fired only when the slug was completely empty, so a mixed-script name kept its
```

---

### Incident Patch 3: `0c9bb3cb` (2026-10-05)
**Commit Message**: fix(job_key): hash mixed-script names instead of keying on their Latin fragment (#514)

The hash fallbacks from #487 and #502 fired only when the slug was
completely empty. A mixed-script name kept its Latin or digit fragment
and skipped them: "Программист 1С" and "Аналитик 1С" at one company both
keyed as company-6d769a_1, "Python-разработчик" and "Python-аналитик" as
..._python, "Сбер AI" and "Яндекс AI" as ai_... /scrape Step 4 then
dropped the second posting as already seen, and because the dict key is
overwritten, --audit could not report the collision as a duplicate URL.

Treat the fold as lossy whenever it drops a letter outside the Latin
script, and let the existing fallbacks take over: the title half uses
the portal's numeric id or the URL hash with the fragment kept as a
readable prefix, the company half uses the NFC-casefold name hash with
the fragment as prefix. Latin letters that also lack a decomposition
(ø, æ, ß, ł) are deliberately not counted, so "Ørsted" still keys as
"rsted" and a live Danish seen_jobs.json does not re-key.

Seven new cases; the four collision cases fail on master.

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -15,6 +15,25 @@ per-file diff commands.
 
 ### Fixed
 
+- **`job_key.py` no longer gives two postings one key when a title or company is partly
+  non-Latin** (`tools/job_key.py`, `tests/test_job_key.py`) - the hash fallbacks from #487
+  and #502 fired only when the slug was completely empty, so a mixed-script name kept its
+  Latin or digit fragment and skipped them: `Программист 1С` and `Аналитик 1С` at one company
+  both keyed as `company-6d769a_1`, `Python-разработчик` and `Python-аналитик` as `..._python`,
+  `Сбер AI` and `Яндекс AI` as `ai_...`. `/scrape` Step 4 then dropped the second posting as
+  already seen, and because the dict key is overwritten, `--audit` could not report the
+  collision as a duplicate URL either. "1С" titles and "N категории" grade suffixes are
+  everyday Russian listings on freehire, the shipped multi-market portal. The fold is now
+  treated as lossy whenever it drops a letter outside the Latin script, and the existing
+  fallbacks take over: the title half uses the portal's numeric id or the URL hash with the
+  fragment kept as a readable prefix (`1-4461771225`, `python-bb31e9`), the company half uses
+  the NFC-casefold name hash with the fragment as prefix (`ai-d35210`). Latin letters that
+  also lack a decomposition (`ø`, `æ`, `ß`, `ł`) are deliberately not counted, so `Ørsted`
+  still keys as `rsted` and a live Danish `seen_jobs.json` does not re-key; an existing
+  mixed-script entry re-keys once on the next scrape and `--audit` lists it under
+  `keys_not_matching_current_rule`, the same one-time drift #502 accepted. Seven new cases;
+  the four collision cases fail on master.
+
 - **`verify_pdf.py --ascii-dates` no longer reads a year-like run inside a longer number as a
   date** - the year pattern had no digit boundaries, so `2000` inside `120000` or `12000` made
   `Grew budget DKK 120000–200000` and `12000–15000 events/s` fail `/apply` Step 5d as
```

**File**: `tests/test_job_key.py` (modified, +54/-0)
```diff
@@ -100,6 +100,60 @@ def test_distinct_urls_still_get_distinct_keys(self):
         self.assertNotEqual(a, b)
 
 
+class MixedScriptNamesKeepTheirIdentity(unittest.TestCase):
+    """A name that folds to a fragment is as lossy as one that folds to nothing.
+
+    #487 and #502 added the hash fallbacks for titles and companies that
+    slugify to '', but a mixed-script name keeps its Latin or digit fragment and
+    skipped them: "Программист 1С" and "Аналитик 1С" both became "1", "Сбер AI"
+    and "Яндекс AI" both became "ai", so two postings shared one key and
+    `/scrape` Step 4 dropped the second as already seen. "1С" titles and
+    "N категории" grade suffixes are everyday Russian listings on freehire.
+    """
+
+    def test_titles_sharing_a_digit_fragment_get_distinct_keys(self):
+        company = "Яндекс"
+        a = make_key(company, "Программист 1С", url="https://freehire.me/jobs/programmist-1s-aaa")
+        b = make_key(company, "Аналитик 1С", url="https://freehire.me/jobs/analitik-1s-bbb")
+        self.assertNotEqual(a, b)
+        self.assertTrue(is_canonical(a) and is_canonical(b))
+
+    def test_titles_sharing_a_latin_word_get_distinct_keys(self):
+        company = "ООО Чен"
+        a = make_key(company, "Python-разработчик", url="https://freehire.me/jobs/python-razrabotchik-x1")
+        b = make_key(company, "Python-аналитик", url="https://freehire.me/jobs/python-analitik-x2")
+        self.assertNotEqual(a, b)
+        # The fragment survives as a readable prefix; the URL carries the identity.
+        self.assertTrue(a.split("_", 1)[1].startswith("python-"))
+
+    def test_lossy_title_prefers_the_portal_numeric_id(self):
+        key = make_key("Acme", "Инженер 1 категории", url="https://kr.linkedin.com/jobs/view/x-4461771225")
+        self.assertEqual(key, "acme_1-4461771225")
+
+    def test_companies_sharing_a_latin_word_get_distinct_keys(self):
+        a = make_key("Сбер AI", "ML Engineer", url="https://example.com/1")
+        b = make_key("Яндекс AI", "ML Engineer", url="https://example.com/2")
+        self.assertNotEqual(a, b)
+        self.assertTrue(a.startswith("ai-") and b.startswith("ai-"))
+        self.assertTrue(is_canonical(a) and is_canonical(b))
+
+    def test_lossy_company_is_stable_across_case_and_urls(self):
+        a = make_key("Сбер AI", "ML Engineer", url="https://example.com/1")
+        b = make_key("сбер ai", "ML Engineer", url="https://example.com/2")
+        self.assertEqual(a.split("_", 1)[0], b.split("_", 1)[0])
+
+    def test_latin_names_with_accents_and_ligatures_are_not_lossy(self):
+        # NFKD folds these without dropping a letter, so existing keys stay put.
+        self.assertEqual(make_key("Zürich Versicherung", "Ingénieur ﬁnance"), "zurich-versicherung_ingenieur-finance")
+
+    def test_latin_letters_without_a_decomposition_do_not_re_key(self):
+        # "ø" and "æ" have no NFKD decomposition and are dropped by the fold,
+        # but they are Latin letters: "Ørsted" has keyed as "rsted" since the
+        # rule existed, and a live Danish seen_jobs.json must not re-key.
+        self.assertEqual(make_key("Ørsted A/S", "Senior Engineer"), "rsted-a-s_senior-engineer")
+        self.assertEqual(make_key("Mærsk", "Søfarende"), "mrsk_sfarende")
+
+
 class CompanyFallbackCLI(unittest.TestCase):
     def key_for(self, company, url="https://example.com/jobs/123456"):
         proc = subprocess.run(
```

**File**: `tools/job_key.py` (modified, +43/-8)
```diff
@@ -27,7 +27,11 @@
 A title that slugifies to nothing (a posting written in a non-Latin script) has
 no usable key half at all - "securion_" was a real entry, and it would have
 collided with every future non-Latin posting from that company. Those fall back
-to the portal's numeric id from the URL.
+to the portal's numeric id from the URL. A title or company that slugifies to
+*less* than it says is the same problem one step on: "Программист 1С" and
+"Аналитик 1С" both fold to "1", "Сбер AI" and "Яндекс AI" both fold to "ai",
+so whenever the ASCII fold drops letters the surviving fragment is only a
+readable prefix and the identity comes from the same fallback.
 
 Usage:
   python3 tools/job_key.py --company "Acme Corp" --title "SOC Analyst (L2)"
@@ -68,6 +72,29 @@ def slugify(text: str) -> str:
     return _NON_SLUG.sub("-", ascii_only.lower()).strip("-")
 
 
+def _lost_letters(text: str) -> bool:
+    """True when the ASCII fold dropped non-Latin letters, so the slug under-identifies.
+
+    NFKD turns "ü" into "u" plus a combining mark and "ﬁ" into "fi", so most
+    Latin text keeps every letter. A Cyrillic, Greek, CJK or Arabic letter has
+    no ASCII decomposition and vanishes; a mixed-script name then keeps only
+    its Latin or digit fragment, and two different names can share it.
+
+    Latin letters that also lack a decomposition ("ø", "æ", "ß", "ł") are
+    deliberately NOT counted: "Ørsted" has keyed as "rsted" since the rule
+    existed, and treating it as lossy would re-key every Danish company in a
+    live seen_jobs.json for a collision that does not happen in practice.
+    """
+    if not text:
+        return False
+    for ch in unicodedata.normalize("NFKD", str(text)):
+        if ord(ch) < 128 or not ch.isalpha():
+            continue
+        if not unicodedata.name(ch, "LATIN").startswith("LATIN"):
+            return True
+    return False
+
+
 def _cap(slug: str, limit: int) -> str:
     """Cap length without making truncation lossy across runs.
 
@@ -85,18 +112,26 @@ def _cap(slug: str, limit: int) -> str:
 def make_key(company: str, title: str, url: str = "") -> str:
     """The canonical seen_jobs.json key for one posting."""
     company_slug = _cap(slugify(company), COMPANY_MAX)
-    if not company_slug:
+    if not company_slug or _lost_letters(company):
         name = unicodedata.normalize("NFC", str(company or "").strip().casefold())
         # An absent name stays unknown; a non-Latin name still has an identity.
+        # A mixed-script name keeps its Latin fragment as a readable prefix, but
+        # the identity is the hash: "Сбер AI" and "Яндекс AI" both fold to "ai".
         digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:HASH_LEN]
-        company_slug = f"company-{digest}" if name else "unknown-company"
+        if not name:
+            company_slug = "unknown-company"
+        else:
+            company_slug = f"{company_slug}-{digest}" if company_slug else f"company-{digest}"
     title_slug = _cap(slugify(title), TITLE_MAX)
-    if not title_slug:
-        # No Latin characters in the title. The portal's own numeric id is the
-        # only stable handle left; never emit a bare "company_" prefix.
+    if not title_slug or _lost_letters(title):
+        # No Latin characters in the title, or not enough of them to identify
+        # it: "Программист 1С" and "Аналитик 1С" both fold to "1". The portal's
+        # own numeric id is the stable handle; a surviving fragment stays as a
+        # readable prefix only. Never emit a bare "company_" prefix.
+        fragment = title_slug
         match = _JOB_ID.search(url or "")
         if match:
-            title_slug = match.group(1)
+            title_slug = f"{fragment}-{match.group(1)}" if fragment else match.group(1)
         else:
             basis = slugify(unicodedata.normalize("NFKD", str(title or url or "")))
             # Hash the URL alone when there is one. The URL is the posting's
@@ -111,7 +146,7 @@ def make_key(company: str, title: str, url: str = "") -> str:
             # is left to key on.
             digest_basis = str(url) if url else str(title)
             digest = hashlib.sha1(digest_basis.encode("utf-8")).hexdigest()[:HASH_LEN]
-            title_slug = basis or f"untitled-{digest}"
+            title_slug = f"{fragment or basis or 'untitled'}-{digest}"
     return f"{company_slug}_{title_slug}"
 
 
```

---

### Incident Patch 4: `52f84e0f` (2026-10-03)
**Commit Message**: fix(verify_pdf): --ascii-dates needs digit boundaries around the year (#512)

_YEAR matched (19|20)\d{2} anywhere, so `2000` inside `120000` or `12000`
made a budget or throughput range typed with `--` read as an en-dashed
date range: "Grew budget DKK 120000-200000" and "12000-15000 events/s"
both failed /apply Step 5d, and the agent was sent to fix a date argument
that does not exist. The guide promises a numeric range with no year is
left alone.

Bound the year with (?<!\d) and (?!\d). "2016-2024" next to a longer
number is still caught. Two new cases; the numeric one fails on the
unbounded pattern.

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -15,6 +15,14 @@ per-file diff commands.
 
 ### Fixed
 
+- **`verify_pdf.py --ascii-dates` no longer reads a year-like run inside a longer number as a
+  date** - the year pattern had no digit boundaries, so `2000` inside `120000` or `12000` made
+  `Grew budget DKK 120000–200000` and `12000–15000 events/s` fail `/apply` Step 5d as
+  en-dashed date ranges, and the agent was sent to fix a "date argument" that does not exist.
+  The guide promises a numeric range with no year is left alone; now it is. `2016–2024` next to
+  a longer number is still caught. Two new `test_verify_pdf.py` cases; the numeric one fails
+  on the unbounded pattern.
+
 - **`check_framework_version.py`'s git diff read no longer crashes on non-ASCII framework-file
   content** (`tools/check_framework_version.py`) - `run_git()` called
   `subprocess.run(text=True)` without an explicit `encoding`, so output decoded via the host
```

**File**: `tests/test_verify_pdf.py` (modified, +10/-0)
```diff
@@ -99,6 +99,16 @@ def test_numeric_range_without_a_year_is_not_a_date(self):
         # 05-cv-templates.md keeps `--` in prose ranges like EUR 600k--1M.
         self.assertEqual(find_non_ascii_date_ranges("EUR 600k\u20131M, 12\u201315 people"), [])
 
+    def test_year_like_digits_inside_a_longer_number_are_not_a_year(self):
+        # `2000` sits inside `120000`, `200000`, `12000`, `15000`: a budget or
+        # throughput range typed with `--` is not a date and must not fail 5d.
+        for text in ("Grew budget DKK 120000\u2013200000", "Scaled ingestion from 12000\u201315000 events/s"):
+            with self.subTest(text=text):
+                self.assertEqual(find_non_ascii_date_ranges(text), [])
+
+    def test_a_standalone_year_next_to_a_longer_number_is_still_caught(self):
+        self.assertEqual(find_non_ascii_date_ranges("2016\u20132024 (120000 users)")[0][1], "\u2013")
+
     def test_year_ending_a_line_is_not_joined_to_the_next_lines_dash(self):
         text = "Heading 1988-1994\n\u2013 note\n"
         self.assertEqual(find_non_ascii_date_ranges(text), [])
```

**File**: `tools/verify_pdf.py` (modified, +3/-1)
```diff
@@ -94,7 +94,9 @@ def normalize_text(text):
 # rest are the other Unicode dashes and the minus sign, which a parser that splits
 # a range only on U+002D treats the same way.
 NON_ASCII_DASHES = "\u2010\u2011\u2012\u2013\u2014\u2015\u2212"
-_YEAR = r"(?:19|20)\d{2}"
+# A year is four digits standing alone: without the digit boundaries, `2000`
+# inside `120000` or `12000` made a budget or throughput range read as a date.
+_YEAR = r"(?<!\d)(?:19|20)\d{2}(?!\d)"
 # Horizontal whitespace only between the year and the dash: `\s*` also matched
 # a newline, so a year ending one line joined a dash opening the next (a bullet,
 # a wrapped prose line) and an ASCII date was reported as U+2013.
```

---

### Incident Patch 5: `27a9b4a9` (2026-10-02)
**Commit Message**: fix(check_framework_version): decode git diff output as UTF-8 (#511)

* fix(check_framework_version): decode git diff output as UTF-8

run_git() passed subprocess.run(text=True) with no explicit encoding,
so it fell back to the host locale's default codec - cp1252 on
Windows - instead of UTF-8. Any non-ASCII byte in a modified
framework file's diff (e.g. an em dash in a profile edit) then raised
UnicodeDecodeError before the gate could evaluate the change, instead
of a pass/fail verdict. Reproduced on a real Windows checkout.

Pin encoding="utf-8" on the subprocess.run() call. Added a regression
test that patches subprocess.run and asserts run_git() always passes
encoding="utf-8" - confirmed it fails against the pre-fix code and
passes against the fix.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* fix(check_framework_version): address review on UTF-8 decode fix

Per MadsLorentzen's review on PR #511:
- Add errors="replace" alongside encoding="utf-8" on the subprocess.run()
  call, matching the convention used elsewhere in this repo (robots_check.py).
- Correct the docstring: an em dash does not crash the un-pinned decode
  (cp1252 maps it fine); the actual trigger is a byt

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -15,6 +15,17 @@ per-file diff commands.
 
 ### Fixed
 
+- **`check_framework_version.py`'s git diff read no longer crashes on non-ASCII framework-file
+  content** (`tools/check_framework_version.py`) - `run_git()` called
+  `subprocess.run(text=True)` without an explicit `encoding`, so output decoded via the host
+  locale's default codec instead of UTF-8. On a real Windows checkout (cp1252 default) this
+  raised `UnicodeDecodeError` on any byte cp1252 leaves undefined - Cyrillic Ё/ё, much CJK,
+  Á-class Latin - appearing in a framework file's diff, crashing the version gate before it
+  ever evaluated the change. `run_git()` now passes `encoding="utf-8"` and `errors="replace"`
+  (matching the convention already used elsewhere in this repo, e.g. `robots_check.py`),
+  decoding deterministically regardless of host locale. Pinned by `RunGitEncodingTests` in
+  `tests/test_check_framework_version.py`, which fails against the original un-pinned call.
+
 - **`/rank` still sweeps deadlines when there is nothing new to score** (`.claude/commands/rank.md`
   Step 1, `tests/test_rank_command.py`) - when `rank_state.py candidates` reported no eligible
   jobs, Step 1 said "Nothing new to rank" and stopped before Step 3's rule 6 expiry sweep ever
```

**File**: `tests/test_check_framework_version.py` (modified, +39/-0)
```diff
@@ -17,6 +17,7 @@
 import sys
 import tempfile
 import unittest
+import unittest.mock
 from pathlib import Path
 
 REPO_ROOT = Path(__file__).resolve().parent.parent
@@ -105,6 +106,44 @@ def test_file_without_version_marker_fails(self):
         self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
         self.assertIn("missing 'framework_version'", result.stdout)
 
+class RunGitEncodingTests(unittest.TestCase):
+    """run_git() must decode `git diff` output as UTF-8 explicitly, not via
+    whatever `subprocess.run(text=True)` falls back to on the host locale.
+
+    On a real Windows checkout, the un-pinned call decodes as cp1252 (the
+    locale default there) and a byte cp1252 leaves undefined - e.g.
+    Cyrillic Ё/ё, much CJK, or Á-class Latin - in a framework file's diff
+    raises UnicodeDecodeError before the gate ever evaluates the change
+    (reported 2026-10-01, reproduced on Windows with Cyrillic Ё). An em
+    dash does not trigger this - cp1252 maps it fine. `LC_ALL`/`LANG` don't
+    influence this on Windows, so the regression is pinned directly against
+    the subprocess.run() call rather than by trying to simulate the OS
+    locale."""
+
+    def test_run_git_pins_utf8_encoding(self):
+        import importlib.util
+
+        spec = importlib.util.spec_from_file_location(
+            "check_framework_version", SCRIPT
+        )
+        module = importlib.util.module_from_spec(spec)
+        spec.loader.exec_module(module)
+
+        with unittest.mock.patch.object(module.subprocess, "run") as mock_run:
+            mock_run.return_value = subprocess.CompletedProcess(
+                args=["git"], returncode=0, stdout="", stderr=""
+            )
+            module.run_git(["diff", "-U0", "HEAD"])
+
+        _, kwargs = mock_run.call_args
+        self.assertEqual(
+            kwargs.get("encoding"),
+            "utf-8",
+            "run_git() must pass encoding=\"utf-8\" to subprocess.run() - "
+            "omitting it falls back to the host locale's default codec "
+            "(cp1252 on Windows), which crashes on non-ASCII diff content.",
+        )
+
 
 if __name__ == "__main__":
     unittest.main()
```

**File**: `tools/check_framework_version.py` (modified, +8/-1)
```diff
@@ -23,7 +23,14 @@
     FRAMEWORK_FILES.append(root_agents)
 
 def run_git(args: list[str]) -> tuple[int, str, str]:
-    res = subprocess.run(["git"] + args, cwd=str(ROOT), capture_output=True, text=True)
+    res = subprocess.run(
+        ["git"] + args,
+        cwd=str(ROOT),
+        capture_output=True,
+        text=True,
+        encoding="utf-8",
+        errors="replace",
+    )
     return res.returncode, res.stdout, res.stderr
 
 def get_base_commit() -> str | None:
```

---

### Incident Patch 6: `f9ef82f1` (2026-10-02)
**Commit Message**: fix(rank): sweep deadlines when no candidates need scoring (#494)

* fix(rank): sweep deadlines when no candidates need scoring

* changelog: record the /rank empty-candidate sweep under [Unreleased] / Fixed

**File**: `.claude/commands/rank.md` (modified, +9/-1)
```diff
@@ -32,7 +32,15 @@ python3 tools/rank_state.py candidates --limit 10          # add --all / --focus
 
 It applies the status filter (`new`, or any status with `--all`), the tracker exclusion (any company+role already in `job_search_tracker.csv` is out of scope regardless of flags - it has been applied to or consciously tracked), the focus filter, and `--limit`, then prints one compact object per candidate (`key`, `title`, `company`, `url`, `portal`, `deadline`, `posted_date`) plus the counts: `eligible`, `deferred` (eligible beyond the limit, kept at their current status so a later run continues the backlog), `excluded_by_tracker`.
 
-If it reports no candidates, say so ("Nothing new to rank - run /scrape to find fresh postings") and stop. If it exits with "not found", tell the user to run `/scrape` first and stop.
+If it exits with "not found", tell the user to run `/scrape` first and stop.
+
+If it reports no candidates, there is nothing to score, but already-ranked jobs still need Step 3's rule 6 expiry sweep. Run:
+
+```bash
+python3 tools/rank_state.py sweep --write
+```
+
+Skip profile loading and Steps 2-4 on this path: no jobs need fetching or scoring. Present a sweep-only Step 5 summary: say "Nothing new to rank", report `swept` and `newly_expired`, list `closing_soon` with deadlines and posting URLs, and report any `unparseable_deadlines` with their portals. Apply rule 6's same reporting and defensive-date rules. Then suggest `/scrape` for fresh postings and stop. An empty candidate batch, including one caused by a focus filter or tracker exclusion, never skips this sweep.
 
 Then read the scoring framework and profile **once**:
 - `.claude/skills/job-application-assistant/04-job-evaluation.md`
```

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -15,6 +15,22 @@ per-file diff commands.
 
 ### Fixed
 
+- **`/rank` still sweeps deadlines when there is nothing new to score** (`.claude/commands/rank.md`
+  Step 1, `tests/test_rank_command.py`) - when `rank_state.py candidates` reported no eligible
+  jobs, Step 1 said "Nothing new to rank" and stopped before Step 3's rule 6 expiry sweep ever
+  ran. Once a backlog has been ranked, that is the path every later `/rank` takes, so
+  past-deadline jobs stayed `ranked` and approaching-deadline reminders were never shown.
+  Reproduced on the real CLI with four `ranked` entries (deadlines 2026-09-22, 2026-09-28,
+  null, `ASAP`): `candidates --today 2026-09-25` returns `eligible: 0` and master stops there,
+  while `sweep --write` on the same state expires the 09-22 entry, lists 09-28 under
+  `closing_soon` and `ASAP` under `unparseable_deadlines`, and leaves the null one alone. The
+  empty-candidate branch of Step 1 now runs `python3 tools/rank_state.py sweep --write`, skips
+  profile loading and Steps 2-4 (nothing to fetch or score; the tracker is untouched), and
+  presents a sweep-only Step 5 summary - `swept`, `newly_expired`, `closing_soon` with deadlines
+  and URLs, `unparseable_deadlines` with portals - before suggesting `/scrape`. An empty batch
+  caused by a focus filter or tracker exclusion takes the same path. Pinned by
+  `test_step1_empty_candidates_still_sweeps_and_reports`, which fails against master's `rank.md`.
+
 - **`robots_check` no longer reads a leading BOM or an undecodable rule as permission**
   (`tools/robots_check.py`, `tests/test_robots_check.py`) - two decoding edge cases failed
   open, both flagged as follow-ups in #506. A robots.txt saved with a UTF-8 byte-order mark
```

**File**: `tests/test_rank_command.py` (modified, +15/-0)
```diff
@@ -43,6 +43,21 @@ def _sections(text: str) -> dict[str, str]:
 
 
 class RankCommandSpec(unittest.TestCase):
+    def test_step1_empty_candidates_still_sweeps_and_reports(self):
+        """No new jobs must not bypass expiry maintenance of ranked jobs."""
+        step1 = _sections(COMMAND.read_text(encoding="utf-8"))["Step 1: Load State"]
+        empty_branch = step1.partition("If it reports no candidates")[2].partition("Then read")[0]
+        self.assertIn(
+            "python3 tools/rank_state.py sweep --write",
+            empty_branch,
+            "an empty candidate batch must still persist rule 6's expiry sweep",
+        )
+        self.assertNotIn("--exclude", empty_branch, "no jobs were re-scored on this path")
+        for field in ("swept", "newly_expired", "closing_soon", "unparseable_deadlines"):
+            self.assertIn(field, empty_branch, f"the empty-run report must consume {field}")
+        self.assertIn("Skip", empty_branch)
+        self.assertIn("Steps 2-4", empty_branch, "an empty run must not fetch or score jobs")
+
     def test_command_file_exists_with_lint_compliant_header(self):
         self.assertTrue(COMMAND.is_file(), "command spec missing")
         first_line = COMMAND.read_text(encoding="utf-8").splitlines()[0]
```

---

### Incident Patch 7: `1cecaec4` (2026-10-01)
**Commit Message**: fix(robots-check): stop a leading BOM or an undecodable rule from reading as allowed (#509)

* fix(robots-check): stop a leading BOM or an undecodable rule from reading as allowed

Two decoding edge cases left the robots gate failing open. Both were
flagged as follow-ups in #506.

A robots.txt saved with a UTF-8 byte-order mark decodes to a body that
starts with U+FEFF, so its first field read as U+FEFF + "user-agent". A
leading "User-agent: *" went unseen, every rule in that group was
dropped for want of an agent, and "Disallow: /" read as allow-all.
_groups() and is_robots_body() now skip one leading U+FEFF, as Google's
reference parser does, which covers every caller of allowed(). This
predates #506: the old code-page decode hid the line the same way.

Since #506 pinned curl's output to UTF-8 with errors='replace', a
non-conformant robots.txt saved in a legacy code page (cp1254,
ISO-8859-9) with raw non-ASCII bytes in a rule decodes them to U+FFFD.
That rule can never match and was silently skipped. The new
has_undecodable_rule() treats such a body as unreadable, so the gate
returns UNCONFIRMED (exit 1). The field is named with U+FFFD removed, so
a stray byte before "Disallow" c

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -15,6 +15,25 @@ per-file diff commands.
 
 ### Fixed
 
+- **`robots_check` no longer reads a leading BOM or an undecodable rule as permission**
+  (`tools/robots_check.py`, `tests/test_robots_check.py`) - two decoding edge cases failed
+  open, both flagged as follow-ups in #506. A robots.txt saved with a UTF-8 byte-order mark
+  decodes to a body that starts with U+FEFF, so its first field was not `user-agent`: a
+  leading `User-agent: *` went unseen, every rule in that group was dropped for want of an
+  agent, and the gate read the file as allow-all. Reproduced through the CLI on real hosts:
+  cnnturk.com and sakarya.edu.tr serve `EF BB BF` + `User-agent: *`, and master printed
+  `ALLOWED` for their disallowed `/hesap/` and `/bin/`. `_groups()` and `is_robots_body()`
+  now skip one leading U+FEFF, as Google's reference parser does, so every caller of
+  `allowed()` is covered (a BOM-only body is now the empty file it is, allow-all, rather than
+  a soft 200). Separately, #506's `errors='replace'` turns raw non-ASCII bytes in a
+  non-conformant robots.txt saved in a legacy code page (cp1254, ISO-8859-9) into U+FFFD, so
+  a rule such as `Disallow: /şirket/` could never match and was silently skipped. A
+  User-agent, Allow or Disallow line holding U+FFFD now makes the body unreadable, and the
+  gate prints `UNCONFIRMED`. The field is named with U+FFFD removed, so a stray byte before
+  `Disallow` cannot hide the line either; U+FFFD in a comment or another field stays
+  harmless, and valid UTF-8 rules decide as before. Nine new tests; the seven that pin the
+  fail-opens fail on master.
+
 - **`verify_layout.py` finds an orphaned entry header by where the text starts**
   (`tools/verify_layout.py`, `tests/test_verify_layout.py`) - the orphan rule compared line
   left edges against the document margin, and a list marker moves a line's left edge without
```

**File**: `tests/test_robots_check.py` (modified, +129/-1)
```diff
@@ -17,7 +17,7 @@
 REPO_ROOT = Path(__file__).resolve().parents[1]
 sys.path.insert(0, str(REPO_ROOT / "tools"))
 
-from robots_check import allowed, is_robots_body  # noqa: E402
+from robots_check import allowed, has_undecodable_rule, is_robots_body  # noqa: E402
 
 
 # Real body served by privatebank.barclays.com: blank lines sit between the
@@ -211,6 +211,134 @@ def test_plain_rules_are_unaffected(self):
         self.assertTrue(allowed(JOBUP, "*", "/en/jobs/x"))
 
 
+class TestByteOrderMark(unittest.TestCase):
+    """One leading UTF-8 byte-order mark is skipped before parsing.
+
+    FAIL-OPEN REGRESSION: a robots.txt saved with a BOM decodes to a body that
+    starts with U+FEFF, so its first field was U+FEFF + "user-agent", which is
+    not "user-agent". A leading "User-agent: *" went unseen, every rule in its
+    group was dropped for want of an agent, and "Disallow: /" read as
+    allow-all. Google's reference parser skips the BOM; Python's robotparser
+    does not.
+    """
+
+    BODY = "\ufeffUser-agent: *\nDisallow: /\n"
+
+    def test_bom_does_not_hide_the_first_group(self):
+        self.assertFalse(allowed(self.BODY, "*", "/x"))
+        self.assertFalse(allowed(self.BODY, "Claude-User", "/x"))
+
+    def test_gate_obeys_a_policy_saved_with_a_bom(self):
+        import robots_check
+
+        original = robots_check._fetch
+        robots_check._fetch = lambda url, ua: (self.BODY, 200)
+        try:
+            rc, msg = robots_check.gate("https://bom.example/jobs")
+        finally:
+            robots_check._fetch = original
+        self.assertEqual(rc, 1)
+        self.assertIn("DISALLOWED", msg)
+
+    def test_is_robots_body_skips_the_bom_too(self):
+        """A lone directive behind a BOM read as a soft 200 (fail-closed, but
+        wrong). A BOM-only file is an empty file: allow-all, as RFC 9309 says."""
+        self.assertTrue(is_robots_body("\ufeffSitemap: https://x.example/sitemap.xml\n"))
+        self.assertTrue(is_robots_body("\ufeff"))
+
+
+class TestUndecodableRules(unittest.TestCase):
+    """A User-agent, Allow or Disallow line holding U+FFFD is unreadable.
+
+    FAIL-OPEN REGRESSION: read as the UTF-8 that RFC 9309 requires, with bad
+    bytes replaced, a non-conformant robots.txt saved in cp1254 turns
+    "Disallow: /şirket/" into a pattern holding U+FFFD. It can never match, so
+    the rule was silently skipped and the path read as allowed. The gate now
+    leaves permission unconfirmed instead. U+FFFD in a comment or an unrelated
+    line decides nothing and must stay harmless.
+    """
+
+    @staticmethod
+    def _legacy(text):
+        """`text` saved in cp1254, then read as UTF-8 with bad bytes replaced."""
+        return text.encode("cp1254").decode("utf-8", "replace")
+
+    def _gate(self, body, url):
+        import robots_check
+
+        original = robots_check._fetch
+        robots_check._fetch = lambda url, ua: (body, 200)
+        try:
+            return robots_check.gate(url)
+        finally:
+            robots_check._fetch = original
+
+    def test_undecodable_disallow_is_unconfirmed_not_allowed(self):
+        body = self._legacy("User-agent: *\nDisallow: /şirket/\n")
+        self.assertIn("\ufffd", body)
+        rc, msg = self._gate(body, "https://legacy.example/şirket/x")
+        self.assertEqual(rc, 1, msg)
+        self.assertIn("UNCONFIRMED", msg)
+        self.assertIn("not valid UTF-8", msg)
+
+    def test_undecodable_star_agent_is_unconfirmed(self):
+        """A trailing 0xA0 is a no-break space in cp1254, which strip() removes,
+        but U+FFFD in UTF-8, which it does not: "*" became another agent and
+        the group's Disallow stopped applying."""
+        body = self._legacy("User-agent: *\xa0\nDisallow: /\n")
+        rc, msg = self._gate(body, "https://legacy.example/jobs")
+        self.assertEqual(rc, 1, msg)
+        self.assertIn("UNCONFIRMED", msg)
+
+    def test_undecodable_byte_before_the_field_is_unconfirmed(self):
+        """A 0xA0 indent garbled the field name, so the Disallow went unseen."""
+        body = self._legacy("User-agent: *\n\xa0Disallow: /jobs\n")
+        rc, msg = self._gate(body, "https://legacy.example/jobs")
+        self.assertEqual(rc, 1, msg)
+        self.assertIn("UNCONFIRMED", msg)
+
+    def test_every_rule_line_is_checked(self):
+        """User-agent, Allow and Disallow alike, and a first line behind a BOM:
+        _groups skips the BOM, so the check must too or it misses that line."""
+        for body in (
+            self._legacy("User-agent: Bot\xa0\n"),
+            self._legacy("Allow: /ş/\n"),
+            self._legacy("Disallow: /ş/\n"),
+            "\ufeff" + self._legacy("User-agent: *\xa0\nDisallow: /\n"),
+        ):
+            with self.subTest(body=body):
+                self.assertTrue(has_undecodable_rule(body))
+
+    def test_fffd_in_a_comment_or_an_unrelated_line_is_harmless(self):
+        body = self._legacy(
+            "# Şirket politikası\
```

**File**: `tools/robots_check.py` (modified, +36/-3)
```diff
@@ -13,9 +13,12 @@
   * a Disallow for either "*" or "Claude-User" blocks the retry
   * blank lines inside a record do not end it (Python's robotparser drops
     rules in that case, which fails open - see tests)
+  * one leading UTF-8 byte-order mark is skipped (left in, it hides a first
+    "User-agent" line and drops that whole group, which fails open)
   * 404 means no published policy, which is permission
   * any other failure to read robots.txt leaves permission unconfirmed,
-    and the retry does not happen
+    and the retry does not happen - including a User-agent, Allow or
+    Disallow line holding U+FFFD, i.e. a byte that is not valid UTF-8
 
 Usage:  python3 tools/robots_check.py <url>
 Exit 0 = the retry may proceed. Exit 1 = do not retry; go to escalation step 3.
@@ -56,6 +59,7 @@ def is_robots_body(text):
     body IS a valid allow-all under RFC 9309 and stays allowed; a non-empty body
     with no recognised directive is treated as unreadable.
     """
+    text = text.removeprefix('\ufeff')          # byte-order mark, see _groups
     if not text.strip():
         return True
     for raw in text.splitlines():
@@ -66,10 +70,36 @@ def is_robots_body(text):
             return True
     return False
 
+def has_undecodable_rule(text):
+    """Does a User-agent, Allow or Disallow line hold U+FFFD?
+
+    U+FFFD stands in for a byte that did not decode as UTF-8. A non-conformant
+    robots.txt saved in a legacy code page (cp1254, ISO-8859-9) with raw
+    non-ASCII bytes in a rule yields a pattern that can never match: the rule
+    was silently skipped and the path read as allowed. Such a body is
+    unreadable, not permissive. The field is named with U+FFFD removed, so a
+    stray byte before "Disallow" cannot hide the line. U+FFFD in a comment or
+    in any other field (Sitemap, Crawl-delay, ...) decides nothing and is
+    ignored.
+    """
+    for raw in text.removeprefix('\ufeff').splitlines():
+        line = raw.split('#', 1)[0]
+        if '\ufffd' in line and ':' in line:
+            field = line.split(':', 1)[0].replace('\ufffd', '').strip().lower()
+            if field in ('user-agent', 'allow', 'disallow'):
+                return True
+    return False
+
 def _groups(text):
-    """user-agent -> [(is_allow, pattern)], tolerating blank lines inside a record."""
+    """user-agent -> [(is_allow, pattern)], tolerating blank lines inside a record.
+
+    One leading U+FEFF is skipped, as Google's reference parser does. A file
+    saved with a UTF-8 byte-order mark otherwise hid its first field: a leading
+    "User-agent: *" went unseen, every rule in its group was dropped for want
+    of an agent, and "Disallow: /" read as allow-all.
+    """
     out, agents, expect = {}, [], True
-    for raw in text.splitlines():
+    for raw in text.removeprefix('\ufeff').splitlines():
         line = raw.split('#', 1)[0].strip()
         if not line or ':' not in line:
             continue
@@ -127,6 +157,9 @@ def gate(url):
             if not is_robots_body(text):
                 last = 'HTTP 200 but the body is not a robots.txt'
                 continue
+            if has_undecodable_rule(text):
+                last = 'HTTP 200 but a User-agent/Allow/Disallow line is not valid UTF-8'
+                continue
             body = text; break
         last = 'HTTP %d' % code
     if body is None:
```

---

### Incident Patch 8: `e355eafe` (2026-10-01)
**Commit Message**: fix(verify-layout): find an orphaned entry header by where the text starts (#508)

find_orphans() compared each line's left edge with the document margin:
an un-indented last line followed by an indented first line was an entry
header orphaned from its bullets. A list marker moves a line's left edge
without moving its text, so the rule misread two templates:

  * one that merges each bullet's marker into its first line (#481): a
    bullet wrapping across the break was reported as an orphaned header,
    and a real orphaned header followed by such bullets was not reported;
  * the stock CV, when its outer marker extracts as a line of its own: a
    [Job Title] header left at the foot of a page, bullets overleaf, was
    not reported (its text at x70.4 counts as indented), and a one-line
    list item whose outer marker is set 1.3pt below it - so the marker
    sorts last on the page - was reported as a split bullet although the
    whole item is on that page.

Following discussion #481, the rule now reads text x:

  * parse_pdf records where a line's text starts after leading
    LIST_MARKERS words (Line.text_left, defaulted). The set is the agreed
    Unicode bullets without the d

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -15,6 +15,25 @@ per-file diff commands.
 
 ### Fixed
 
+- **`verify_layout.py` finds an orphaned entry header by where the text starts**
+  (`tools/verify_layout.py`, `tests/test_verify_layout.py`) - the orphan rule compared line
+  left edges against the document margin, and a list marker moves a line's left edge without
+  moving its text. A template that merges each bullet's marker into its first line (#481) got
+  a bullet wrapping across the page break reported as an orphaned header, and a real orphaned
+  header followed by such bullets not reported at all. On the stock CV, when the outer marker
+  extracts as a line of its own, a `[Job Title]` header left at the foot of a page with its
+  bullets overleaf was not reported (its text at x70.4 counted as indented), and a list item
+  whose outer marker is set 1.3pt below its line was reported as a split bullet. The rule now
+  compares where the text of the page's last printed line starts - after any leading bullet
+  glyph from `• ‣ ▪ ● ·` (ASCII, dashes and other glyphs are text) - with where the text of
+  the next page's first printed line starts, and reports an orphaned header when the latter
+  is set further in. Bbox lines whose tops are within 3pt count as one printed line, and a
+  line whose text starts more than 60pt past the margin (a running header, a right-set date)
+  is not where the next page resumes. A lone marker with no text beside it keeps the
+  split-bullet report. On 304 builds of the stock CV (`\vspace*` 0-600pt before four
+  entries) this adds 15 reports, each a `[Job Title]` header at the foot of a page with its
+  bullets overleaf, and the other 289 builds give the same output as before.
+
 - **One posting on a portal without a numeric id no longer gets a second key when its
   title is re-listed with different casing** (#501, `tools/job_key.py`,
   `tests/test_job_key.py`) - the key hashed a slugified title alongside the URL whenever
```

**File**: `tests/test_verify_layout.py` (modified, +156/-1)
```diff
@@ -17,7 +17,7 @@
 from unittest.mock import patch
 
 from tools import verify_layout
-from tools.verify_layout import Line, Page, find_orphans, main, parse_pdf, report
+from tools.verify_layout import Line, Page, find_orphans, main, parse_pdf, report, text_start
 
 A4_HEIGHT = 842.0
 
@@ -111,6 +111,161 @@ def test_indent_is_judged_against_the_document_margin(self):
         s2 = Page(A4_HEIGHT, [line(60, left=70.0, text="- first bullet")])
         self.assertTrue(any("orphaned from its bullets" in m for m in find_orphans([s1, s2])))
 
+
+def at(top, left, text, text_left=None, bottom=None):
+    """A bbox line; text_left is where its text starts after a merged list marker."""
+    bottom = top + 14.0 if bottom is None else bottom
+    return Line(top=top, bottom=bottom, left=left, height=bottom - top, text=text,
+                text_left=text_left)
+
+
+class TestOrphansReadTextX(unittest.TestCase):
+    """The orphan rule compares where the TEXT starts, not where the line starts.
+
+    Geometry from the #481 repro: entry headers at x59.5; a bullet's marker merged into
+    its first line at x58.9, its text at x71.6-72.1, continuations at x72.1. From the
+    stock CV: header text at x70.4, an inner bullet's marker in its own line at x71.5
+    with the text at x81.3, and an outer marker at x59.0 that extracts either as a line
+    of its own or merged into the header line, depending on the font setup.
+    """
+
+    def test_bullet_wrapping_across_the_break_is_not_an_orphaned_header(self):
+        p1 = Page(A4_HEIGHT, [
+            at(50, 59.5, "Plant Grower Example Garden 1981-1990"),
+            at(700, 58.9, "\u2022 Replanted the long border with plants raised", 72.1),
+        ])
+        p2 = Page(A4_HEIGHT, [at(60, 72.1, "from seed, lifting the old clumps")])
+        self.assertEqual(find_orphans([p1, p2]), [])
+
+    def test_bullet_whose_text_opens_with_a_symbol_is_still_a_wrapped_bullet(self):
+        p1 = Page(A4_HEIGHT, [
+            at(50, 59.5, "Plant Grower Example Garden 1981-1990"),
+            at(700, 58.9, "\u2022 (in winter) relaid the gravel paths along", 72.1),
+        ])
+        p2 = Page(A4_HEIGHT, [at(60, 72.1, "the old orchard wall and round the pond")])
+        self.assertEqual(find_orphans([p1, p2]), [])
+
+    def test_continuation_opening_with_a_dash_is_still_a_wrapped_bullet(self):
+        """Dashes are not markers: an em dash can open a bullet's second line."""
+        p1 = Page(A4_HEIGHT, [at(700, 58.9, "\u2022 Laid a new cobbled path, so", 72.1)])
+        p2 = Page(A4_HEIGHT, [at(60, 72.1, "\u2014 that rain ran off into the borders")])
+        self.assertEqual(find_orphans([p1, p2]), [])
+
+    def test_header_level_with_merged_bullets_is_an_orphan(self):
+        """The bullet line starts at x58.9, left of the header; its text is further in."""
+        p1 = Page(A4_HEIGHT, [at(700, 59.5, "Kitchen Gardener 1975-1980")])
+        p2 = Page(A4_HEIGHT, [at(60, 58.9, "\u2022 Worked in the kitchen garden", 71.6)])
+        self.assertTrue(any("orphaned from its bullets" in m for m in find_orphans([p1, p2])))
+
+    def test_stock_header_whose_outer_marker_is_its_own_line(self):
+        """The header's text at x70.4 counts as indented, so the left-edge rule missed it."""
+        p1 = Page(A4_HEIGHT, [
+            at(323, 59.5, "Professional Experience"),
+            at(695.9, 59.0, "\u25cb", bottom=707.6),
+            at(700.5, 70.4, "[Job Title] [YYYY-YYYY]"),
+        ])
+        p2 = Page(A4_HEIGHT, [
+            at(62.4, 71.5, "-", bottom=79.5),
+            at(64.4, 81.3, "[Achievement or responsibility 1]"),
+        ])
+        self.assertTrue(any("orphaned from its bullets" in m for m in find_orphans([p1, p2])))
+
+    def test_stock_header_with_its_outer_marker_merged_in(self):
+        """`○` is not a LIST_MARKERS glyph, so the header keeps x59.0, as the left-edge rule read it."""
+        p1 = Page(A4_HEIGHT, [at(700, 59.0, "\u25cb [Job Title] [YYYY-YYYY]")])
+        p2 = Page(A4_HEIGHT, [at(62.4, 71.5, "-", bottom=79.5), at(64.4, 81.3, "[Achievement 1]")])
+        self.assertTrue(any("orphaned from its bullets" in m for m in find_orphans([p1, p2])))
+
+    def test_stock_degree_and_description_stay_reported_with_the_marker_merged(self):
+        """Both texts at x70.4, but the merged `○` keeps the header at x59.0."""
+        p1 = Page(A4_HEIGHT, [at(700, 59.0, "\u25cb [Degree] in [Field] [YYYY-YYYY]")])
+        p2 = Page(A4_HEIGHT, [at(60, 70.4, "[Brief description or key topics.]")])
+        self.assertTrue(any("orphaned from its bullets" in m for m in find_orphans([p1, p2])))
+
+    def test_outer_marker_set_below_a_whole_item_is_not_a_split_bullet(self):
+        """Stock CV: the outer marker sits 1.3pt below its one-line item and sorts last.
+
+        The left-edge rule read it as a lone marker whose item was split, although the
+        whole item is on p1 and p2 opens with the next item.
+        """
+        p1 = Page(A4_HEIGHT,
```

**File**: `tools/verify_layout.py` (modified, +92/-13)
```diff
@@ -34,8 +34,9 @@
 every field it does not set, so any `lualatex`/`pdflatex` document built with `hyperref`
 and no `\\hypersetup{pdftitle=...}` triggers a real Poppler crashing on a legal PDF (#451).
 Line height serves
-as a font-size proxy to spot section headings; left edge (xMin) separates bullet lines
-from entry headers.
+as a font-size proxy to spot section headings. An orphaned entry header is found by where
+each line's TEXT starts, after any list marker merged into it, not by its left edge (see
+`find_orphans`).
 
 The thresholds below are calibrated for the stock moderncv (`cv/`) and cover.cls
 (`cover_letters/`) geometry. A template registered via `/add-template` may need them
@@ -84,13 +85,32 @@
 # continuation, not an entry header or a section heading.
 INDENT_PT = 8.0
 
+# Glyphs that label a list item when a template merges them into the item's first line.
+# Unicode only: ASCII `-` and `*`, and the dashes, also open real text (the continuation
+# of a bullet may start with an em dash), so a line opening with one is read as text.
+LIST_MARKERS = frozenset("\u2022\u2023\u25aa\u25cf\u00b7")
+
+# Lines whose tops are this close are parts of one printed line. pdftotext -bbox output
+# is grouped by rounded yMin, which splits a printed line wherever words in another
+# font sit a fraction of a point off and a .5 boundary falls between them (a bold word
+# 0.2pt off; a list marker set 1.3pt below its item's first line on the stock CV).
+# Consecutive printed lines are ~12pt apart.
+SAME_PRINTED_LINE_PT = 3.0
+
+# A list sets its text in by a label's width: 11-25pt past the margin on the stock CV
+# and cover letter. A line whose text starts further in than this is set right or
+# centred (a running header, a date on a line of its own), not where a page's body
+# resumes.
+SET_IN_LIMIT_PT = 60.0
+
 # A line this much taller than the body median is a section heading.
 HEADING_HEIGHT_RATIO = 1.25
 
 PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)
 WORD_RE = re.compile(
     r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">([^<]*)</word>'
 )
+TEXT_RE = re.compile(r"\w")
 
 
 @dataclass
@@ -100,6 +120,13 @@ class Line:
     left: float
     height: float
     text: str
+    # Where the text starts once leading LIST_MARKERS words are set aside; None when the
+    # line has no such marker, so a Line built from `left` alone behaves as before.
+    text_left: float | None = None
+
+    @property
+    def text_x(self) -> float:
+        return self.left if self.text_left is None else self.text_left
 
 
 class Page:
@@ -201,20 +228,52 @@ def parse_pdf(path: Path) -> list[Page]:
                 left=min(w[0] for w in words),
                 height=max(w[2] - w[1] for w in words),
                 text=" ".join(w[3] for w in sorted(words)),
+                text_left=text_start(sorted(words)),
             )
             for words in buckets.values()
         ]
         pages.append(Page(float(h), lines))
     return pages
 
 
+def text_start(words: list[tuple[float, float, float, str]]) -> float | None:
+    """xMin of the first word after leading LIST_MARKERS words, if there were any."""
+    lead = 0
+    while lead < len(words) and words[lead][3] and set(words[lead][3]) <= LIST_MARKERS:
+        lead += 1
+    return words[lead][0] if 0 < lead < len(words) else None
+
+
+def printed_text_x(lines: list[Line]) -> float | None:
+    """Where the text of one printed line starts, from the bbox lines that make it up."""
+    xs = [l.text_x for l in lines if TEXT_RE.search(l.text)]
+    return min(xs) if xs else None
+
+
 def find_orphans(pages: list[Page]) -> list[str]:
     """A page ending on an entry header or section heading whose content resumes overleaf.
 
     Two shapes, both documented failures:
       * the last body line of a page is a section heading (stranded heading)
-      * the last body lines are un-indented (an entry header) while the next page opens
-        with indented bullet lines, i.e. the entry was split across the break
+      * the next page's text starts further in than the text of the page's last printed
+        line (an entry header), i.e. the entry was split across the break
+
+    The second compares where the TEXT starts, not where the line starts. A template may
+    merge a list marker into the line it labels, which moves the line's left edge but not
+    its text: in the #481 repro a bullet's first line starts at x58.9 (the marker), level
+    with the entry headers at x59.5, while its text and its continuation start at x72.1.
+    Read by left edge, a bullet wrapping across the break looked like a header followed by
+    indented text, and a real header followed by such a bullet looked level. On the stock
+    CV the outer marker may extract as a line of its own; then the header's text (x70.4)
+    counted as indented and a header orphaned from its bullets (x81.3) went unreported.
+
+    Only LIST_MARKERS glyphs a
```

---

### Incident Patch 9: `a56b8d04` (2026-10-01)
**Commit Message**: fix(job_key): hash the URL alone so a re-listed non-Latin title keeps one key (#502)

* fix(job_key): hash the URL alone so a re-listed non-Latin title keeps one key

* docs(changelog): record the job_key URL-identity fix

Adds the [Unreleased] / Fixed entry for #501, naming tools/job_key.py and
tests/test_job_key_url_identity.py.

The entry states the migration consequence in bold: an entry written before
this fix, for a non-Latin title on a portal without a numeric id, re-keys once
on the next scrape. It also names where those entries surface,
keys_not_matching_current_rule, and that --audit never rewrites them.

Verified that claim rather than asserting it. A seen_jobs.json holding one
entry under its pre-fix key for a Cyrillic-titled freehire URL reports
keys_not_matching_current_rule: 1 under the fixed audit. The same audit over a
real 884-entry seen_jobs.json reports 0, because those keys are the
company_title form that is_canonical() excludes from the drift check.

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -13,6 +13,21 @@ per-file diff commands.
 
 ## [Unreleased]
 
+### Fixed
+
+- **One posting on a portal without a numeric id no longer gets a second key when its
+  title is re-listed with different casing** (#501, `tools/job_key.py`,
+  `tests/test_job_key.py`) - the key hashed a slugified title alongside the URL whenever
+  `normalizeId` found no six-digit run in the path, which is every freehire posting. The
+  live API returns both `Инженер` and `инженер` across rows, and the slugifier maps those
+  to different slugs, so one URL could be stored under several keys. `/rank` builds its
+  exclusion set from `seen_jobs.json`, so a posting already seen could be presented again.
+  The key is now a hash of the URL alone: the URL is the identity `/scrape` stores, and
+  the title was never a stable half of it. **Entries written before this fix for a
+  non-Latin title on a portal without a numeric id will re-key once on the next scrape.**
+  `python3 tools/job_key.py --audit` reports those entries under
+  `keys_not_matching_current_rule`; it never rewrites them.
+
 ## [1.7.2] - 2026-09-29
 
 ### Added
```

**File**: `tests/test_job_key.py` (modified, +29/-0)
```diff
@@ -70,6 +70,35 @@ def test_non_latin_company_falls_back_without_producing_a_bare_prefix(self):
         self.assertTrue(is_canonical(key))
         self.assertFalse(key.startswith("_"))
 
+    def test_one_url_keeps_one_key_when_a_non_latin_title_is_re_listed(self):
+        # freehire is the shipped multi-market portal, and its public API
+        # returns Cyrillic and Greek titles. Its real slugs carry no run of six
+        # digits, so the numeric-id branch above never fires for them and the
+        # hash is the only key half left. Hashing the title alongside the URL
+        # made that hash move whenever a portal re-listed the same posting with
+        # the title altered - including a mere case change, which this portal
+        # really does emit ("Инженер" and "инженер" both appear).
+        #
+        # URL and slug are real values from freehire's public API, not
+        # constructed: https://freehire.me/api/v1/agent/jobs/search?q=инженер
+        url = "https://freehire.me/jobs/inzhener-ooo-chen-hlk3qjfg"
+        company = "ООО Чен"
+        first = make_key(company, "Инженер", url=url)
+        recased = make_key(company, "инженер", url=url)
+        retitled = make_key(company, "Инженер-механик", url=url)
+        self.assertTrue(is_canonical(first))
+        self.assertEqual(first, recased)
+        self.assertEqual(first, retitled)
+
+    def test_distinct_urls_still_get_distinct_keys(self):
+        # The counterpart to the above: collapsing title variants must not
+        # collapse two genuinely different postings from one company. Both
+        # slugs are real freehire values.
+        company = "ООО Чен"
+        a = make_key(company, "Инженер", url="https://freehire.me/jobs/inzhener-ooo-chen-hlk3qjfg")
+        b = make_key(company, "Инженер", url="https://freehire.me/jobs/inzhener-mup-g-khabarovska-tep")
+        self.assertNotEqual(a, b)
+
 
 class CompanyFallbackCLI(unittest.TestCase):
     def key_for(self, company, url="https://example.com/jobs/123456"):
```

**File**: `tools/job_key.py` (modified, +12/-1)
```diff
@@ -99,7 +99,18 @@ def make_key(company: str, title: str, url: str = "") -> str:
             title_slug = match.group(1)
         else:
             basis = slugify(unicodedata.normalize("NFKD", str(title or url or "")))
-            digest = hashlib.sha1((str(title) + str(url)).encode("utf-8")).hexdigest()[:HASH_LEN]
+            # Hash the URL alone when there is one. The URL is the posting's
+            # identity; the title is not. Including the title made the key
+            # change whenever a portal re-listed the same posting with the
+            # title altered, which stores one job twice - the failure this
+            # whole helper exists to prevent. Portals whose ids carry no run
+            # of six digits never reach the branch above, so for them this
+            # hash is the only key half there is: freehire's real slugs look
+            # like "inzhener-ooo-chen-hlk3qjfg", and its Cyrillic and Greek
+            # titles slugify to nothing. With no URL, the title is all that
+            # is left to key on.
+            digest_basis = str(url) if url else str(title)
+            digest = hashlib.sha1(digest_basis.encode("utf-8")).hexdigest()[:HASH_LEN]
             title_slug = basis or f"untitled-{digest}"
     return f"{company_slug}_{title_slug}"
 
```

---

### Incident Patch 10: `4f552084` (2026-09-29)
**Commit Message**: fix(freehire-search): decode HTML entities and trim whitespace in titles (#505)

Titles are indexed as the source ATS wrote them and toResult passed them
through untouched, so `detail intern-fullstack-amp-ai-innovation-noise-edaawqq2`
printed `Intern - Fullstack &amp; AI Innovation ` and the same title reached
`search` output. In a 93-result /scrape batch, 1 title carried `&amp;` and
3 ended in whitespace; /scrape Step 4.75 reads an undecoded entity in a
title as a half-working parser.

Run the title through the existing decodeHtmlEntities (already used for
detail descriptions) and trim it; an empty or whitespace-only title still
falls back to "(untitled)". Three new parsing.test.ts cases pin it; all
three fail on the old pass-through.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.agents/skills/freehire-search/cli/src/helpers.ts` (modified, +6/-2)
```diff
@@ -145,11 +145,15 @@ export interface JobDetailResult extends JobResult {
   description: string | null
 }
 
-/** Reshape a freehire job into the contract search-result fields. */
+/**
+ * Reshape a freehire job into the contract search-result fields. The title comes
+ * from the source ATS as indexed, which can carry HTML entities and stray
+ * whitespace ("Intern - Fullstack &amp; AI Innovation "), so it is decoded and trimmed.
+ */
 export function toResult(j: FreehireJob): JobResult {
   return {
     id: j.public_slug,
-    title: j.title || "(untitled)",
+    title: decodeHtmlEntities(j.title || "").trim() || "(untitled)",
     company: j.company || null,
     company_slug: j.company_slug || null,
     location: j.location || null,
```

**File**: `.agents/skills/freehire-search/cli/tests/parsing.test.ts` (modified, +18/-0)
```diff
@@ -49,6 +49,24 @@ describe("toResult — reshape into the portal-skill contract", () => {
     expect(r.date).toBeNull();
     expect(r.work_mode).toBeNull();
   });
+
+  test("decodes HTML entities and trims whitespace in the title", () => {
+    // Real title from the index (freehire slug intern-fullstack-amp-ai-innovation-noise-edaawqq2).
+    expect(toResult(job({ title: "Intern - Fullstack &amp; AI Innovation " })).title).toBe(
+      "Intern - Fullstack & AI Innovation",
+    );
+    expect(toResult(job({ title: "R&#38;D Engineer" })).title).toBe("R&D Engineer");
+    expect(toResult(job({ title: "SDE Intern - Frontend   " })).title).toBe("SDE Intern - Frontend");
+  });
+
+  test("a whitespace-only title still falls back to (untitled)", () => {
+    expect(toResult(job({ title: "   " })).title).toBe("(untitled)");
+    expect(toResult(job({ title: "" })).title).toBe("(untitled)");
+  });
+
+  test("detail inherits the cleaned title", () => {
+    expect(toDetail(job({ title: "Data &amp; Analytics Intern" })).title).toBe("Data & Analytics Intern");
+  });
 });
 
 describe("toDetail — adds cleaned description + enrichment", () => {
```

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -105,6 +105,19 @@ per-file diff commands.
 
 ### Fixed
 
+- **`freehire-search` titles no longer carry HTML entities or stray whitespace**
+  (`.agents/skills/freehire-search/cli/src/helpers.ts`) - titles are indexed as the source ATS
+  wrote them and `toResult` passed them through untouched, so `detail
+  intern-fullstack-amp-ai-innovation-noise-edaawqq2` printed `Intern - Fullstack &amp; AI
+  Innovation ` (trailing space included), and the same title reached `search` output. In a
+  93-result `/scrape` batch (`--country IN --seniority intern`), 1 title carried `&amp;` and 3
+  ended in whitespace. `/scrape` Step 4.75 reads undecoded entities in titles as a
+  half-working parser, so by that rule a single such posting marks a healthy portal
+  degraded. The title now goes through the CLI's existing `decodeHtmlEntities` (already used
+  for `detail` descriptions) and is trimmed; an empty or whitespace-only title still falls
+  back to `(untitled)`. Pinned by three new `parsing.test.ts` cases, which fail on the old
+  pass-through.
+
 - **`freehire-search detail` keeps the salary period, so a yearly figure no longer reads as
   monthly** (`.agents/skills/freehire-search/cli/src/helpers.ts`, `SKILL.md`) - `formatSalary`
   printed only the currency and amounts, although freehire's enrichment records the period:
```

---

### Incident Patch 11: `9187f894` (2026-09-29)
**Commit Message**: fix(freehire-search): keep the salary period so a yearly figure isn't read as monthly (#504)

formatSalary printed only the currency and amounts, although freehire's
enrichment records the pay period. `detail software-developer-trainee-codifi-fra635ux`
printed `INR 300000–300000` while the API returns `salary_period: "year"`
for that posting, so a yearly salary screened against a monthly figure
read as twelve times its real monthly value.

Append the period when freehire records one (`INR 300000–300000/year`,
`INR 12000/month`); a record without a period prints exactly as before.
Two new parsing.test.ts cases pin it; both fail on the old formatter.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.agents/skills/freehire-search/SKILL.md` (modified, +2/-1)
```diff
@@ -126,7 +126,8 @@ bun run .agents/skills/freehire-search/cli/src/cli.ts detail <slug|url> [--forma
 `slug` is the `id` from a `search` result (e.g. `golang-zensar-2bxu6dxm`). You may
 also pass a full `https://freehire.me/jobs/<slug>` URL. Returns the full (HTML-stripped)
 description, skills, region/country, and — when the posting is enriched — seniority,
-category, employment type, and salary.
+category, employment type, and salary. `salary` keeps its period when freehire records
+one (`INR 300000–300000/year`, `INR 12000/month`); compare pay only in one period.
 
 Use it for a posting you already have a slug for — a tracked application, a shared
 link, or a closed posting search no longer lists. Re-fetching a hit that `search`
```

**File**: `.agents/skills/freehire-search/cli/src/helpers.ts` (modified, +9/-3)
```diff
@@ -107,6 +107,7 @@ export interface FreehireJob {
     salary_min?: number
     salary_max?: number
     salary_currency?: string
+    salary_period?: string // e.g. "year", "month"
   }
 }
 
@@ -176,12 +177,17 @@ export function toDetail(j: FreehireJob): JobDetailResult {
   }
 }
 
-/** Human-readable salary line from the enrichment fields, or null when absent. */
+/**
+ * Human-readable salary line from the enrichment fields, or null when absent.
+ * The period is kept when freehire records one ("INR 300000–300000/year"):
+ * without it a yearly figure is indistinguishable from a monthly one.
+ */
 function formatSalary(e: FreehireJob["enrichment"]): string | null {
   if (e.salary_min == null && e.salary_max == null) return null
   const cur = e.salary_currency ? `${e.salary_currency} ` : ""
-  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}`
-  return `${cur}${e.salary_min ?? e.salary_max}`
+  const per = e.salary_period ? `/${e.salary_period}` : ""
+  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}${per}`
+  return `${cur}${e.salary_min ?? e.salary_max}${per}`
 }
 
 function numericEntity(cp: number): string {
```

**File**: `.agents/skills/freehire-search/cli/tests/parsing.test.ts` (modified, +12/-0)
```diff
@@ -68,6 +68,18 @@ describe("toDetail — adds cleaned description + enrichment", () => {
     expect(d.salary).toBe("EUR 90000–120000");
   });
 
+  test("keeps the salary period, so a yearly figure is not read as monthly", () => {
+    const d = toDetail(
+      job({ enrichment: { salary_min: 300000, salary_max: 300000, salary_currency: "INR", salary_period: "year" } }),
+    );
+    expect(d.salary).toBe("INR 300000–300000/year");
+  });
+
+  test("a single-bound salary keeps its period too", () => {
+    const d = toDetail(job({ enrichment: { salary_min: 12000, salary_currency: "INR", salary_period: "month" } }));
+    expect(d.salary).toBe("INR 12000/month");
+  });
+
   test("null enrichment fields when the enrichment object is empty", () => {
     const d = toDetail(job({ enrichment: {} }));
     expect(d.seniority).toBeNull();
```

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -105,6 +105,16 @@ per-file diff commands.
 
 ### Fixed
 
+- **`freehire-search detail` keeps the salary period, so a yearly figure no longer reads as
+  monthly** (`.agents/skills/freehire-search/cli/src/helpers.ts`, `SKILL.md`) - `formatSalary`
+  printed only the currency and amounts, although freehire's enrichment records the period:
+  `detail software-developer-trainee-codifi-fra635ux` printed `INR 300000–300000` while the
+  API returns `salary_period: "year"` for that posting, so anyone screening pay against a
+  monthly figure read a yearly salary as a monthly one, twelve times its real monthly value.
+  The period is now appended when freehire records one (`INR 300000–300000/year`,
+  `INR 12000/month`); a record without a period prints exactly as before. Pinned by two new
+  `parsing.test.ts` cases, both failing on the old formatter.
+
 - **`robots_check` decodes curl output as UTF-8, so a non-ASCII response no longer reads as
   UNCONFIRMED on Windows** (`tools/robots_check.py`, `tests/test_robots_check.py`) -
   `_fetch()` ran curl with `text=True` and no encoding, so Python decoded the response with
```

---

### Incident Patch 12: `9bc71de5` (2026-09-29)
**Commit Message**: fix(robots-check): decode curl output as UTF-8 so non-ASCII responses stop reading as UNCONFIRMED on Windows (#506)

_fetch() ran curl with text=True and no encoding, so Python decoded the
response with the Windows ANSI code page. On a byte that code page leaves
undefined (0x81 in cp1252 and cp1254, 0x9e in cp1254) subprocess's pipe
reader thread died, stdout came back None, rpartition() raised
AttributeError, and the gate printed "UNCONFIRMED (AttributeError)". That
fails closed, but it blocked the browser-header retry 09-web-research.md
permits on hosts such as tr.indeed.com (a UTF-8 CJK Disallow rule) and
kap.org.tr (a UTF-8 Turkish 404 page).

Pin encoding='utf-8', errors='replace' on the call (RFC 9309: robots.txt
is UTF-8), as verify_pdf.py and verify_layout.py already do. Decision
rules and the fail-closed handling of real read failures are unchanged.

The regression tests swap curl for a child process that prints the real
bytes, so the actual subprocess decode path runs with _fetch's own
kwargs, and pin cp1254 when no encoding is passed so a UTF-8 host cannot
pass the bug by luck. Both fail on master.

Co-authored-by: Can Mugan <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -105,6 +105,23 @@ per-file diff commands.
 
 ### Fixed
 
+- **`robots_check` decodes curl output as UTF-8, so a non-ASCII response no longer reads as
+  UNCONFIRMED on Windows** (`tools/robots_check.py`, `tests/test_robots_check.py`) -
+  `_fetch()` ran curl with `text=True` and no encoding, so Python decoded the response with
+  the ANSI code page. On a byte that code page leaves undefined (0x81 in cp1252 and cp1254,
+  0x9e in cp1254) subprocess's pipe reader thread died, `stdout` came back `None`, and the
+  gate printed `UNCONFIRMED (AttributeError)` - failing closed, but blocking the
+  browser-header retry `09-web-research.md` permits. Reproduced through the CLI on real
+  hosts: tr.indeed.com's robots.txt carries `Disallow: /職涯貼士/` (職 is `e8 81 b7`), and
+  kap.org.tr answers `/robots.txt` with a UTF-8 HTML 404 whose "A.Ş." carries `c5 9e`. The
+  call now pins `encoding='utf-8', errors='replace'` (RFC 9309: robots.txt is UTF-8), as
+  `verify_pdf.py` and `verify_layout.py` already do. That also closes a silent fail-open: a
+  UTF-8 rule whose bytes the code page does define (`Disallow: /şirket/` under cp1254)
+  decoded as `/ÅŸirket/`, never matched, and read as allowed. Decision rules are unchanged.
+  Two new tests swap curl for a child process that prints those bytes and pin cp1254 when no
+  encoding is passed, so the failure does not depend on the host's locale; both fail without
+  the fix.
+
 - **The compile-warning check covers `tests/*.py` too** (`tests/test_verify_pdf.py`,
   `tests/test_verify_layout.py`) - `FindNonAsciiDateRangesTests`' docstring quotes the regex
   `\s*` unescaped, so Python 3.12+ prints a `SyntaxWarning` for the invalid escape `\s` when
```

**File**: `tests/test_robots_check.py` (modified, +54/-0)
```diff
@@ -259,6 +259,60 @@ def spy(url, ua):
         self.assertEqual(seen[0], "https://x.example/robots.txt")
 
 
+class TestNonAsciiCurlOutput(unittest.TestCase):
+    """curl's output is decoded as UTF-8, never the locale's code page.
+
+    With text=True and no encoding, Windows decoded with the locale's code page.
+    Under cp1254 (Turkish) the bytes 0x81 and 0x9e are undefined, so the pipe
+    reader thread died, stdout came back None, and the gate printed
+    "UNCONFIRMED (AttributeError)" for policies it never read - blocking a
+    retry those policies allow (reproduced 2026-09-29).
+    """
+
+    def _gate_with_curl_output(self, url, body, status):
+        """gate(url) with curl swapped for a process that prints `body` and the
+        status the way curl's -w does, decoded however _fetch asks."""
+        import robots_check
+
+        # A fixture cp1254 can decode would pass without the fix.
+        self.assertRaises(UnicodeDecodeError, body.decode, "cp1254")
+        raw = body + b"\n" + str(status).encode()
+        real_run = subprocess.run
+
+        def fake_curl(argv, **kwargs):
+            # Unpinned text mode takes the host locale's code page. Pin the
+            # reporter's, so a UTF-8 host (CI) cannot pass the bug by luck.
+            if kwargs.get("text") and not kwargs.get("encoding"):
+                kwargs["encoding"] = "cp1254"
+            write = "import sys; sys.stdout.buffer.write(bytes.fromhex(sys.argv[1]))"
+            return real_run([sys.executable, "-c", write, raw.hex()], **kwargs)
+
+        robots_check.subprocess.run = fake_curl
+        try:
+            return robots_check.gate(url)
+        finally:
+            robots_check.subprocess.run = real_run
+
+    def test_rule_holding_a_cp1254_undefined_byte_is_read_and_obeyed(self):
+        """The rule is verbatim from tr.indeed.com/robots.txt: 職 is e8 81 b7.
+        DISALLOWED on its path proves it was decoded, not merely survived."""
+        body = "User-agent: *\nDisallow: /職涯貼士/\n".encode("utf-8")
+        rc, msg = self._gate_with_curl_output("https://tr.indeed.example/cmp/x/reviews", body, 200)
+        self.assertEqual(rc, 0, msg)
+        self.assertIn("robots.txt permits this path", msg)
+        rc, msg = self._gate_with_curl_output("https://tr.indeed.example/職涯貼士/x", body, 200)
+        self.assertEqual(rc, 1, msg)
+        self.assertIn("DISALLOWED", msg)
+
+    def test_404_page_holding_a_cp1254_undefined_byte_still_means_no_policy(self):
+        """kap.org.tr answers /robots.txt with a UTF-8 HTML 404 that names
+        "Merkezi Kayıt Kuruluşu A.Ş." - Ş is c5 9e."""
+        body = '<html lang="tr"><body>Merkezi Kayıt Kuruluşu A.Ş.</body></html>'.encode("utf-8")
+        rc, msg = self._gate_with_curl_output("https://kap.example/tr/sirket-bilgileri", body, 404)
+        self.assertEqual(rc, 0, msg)
+        self.assertIn("no robots.txt published", msg)
+
+
 
 if __name__ == "__main__":
     unittest.main()
```

**File**: `tools/robots_check.py` (modified, +4/-1)
```diff
@@ -37,7 +37,10 @@ def _fetch(url, ua):
     r = subprocess.run(
         ['curl', '-sS', '-L', '--max-redirs', '5', '--max-time', '12', '-A', ua,
          '-H', 'Accept: text/plain,*/*', '-w', '\n%{http_code}', '--', url],
-        capture_output=True, text=True, timeout=20)
+        # robots.txt is UTF-8 (RFC 9309). Unpinned, Turkish Windows decoded it as
+        # cp1254, where bytes like 0x81 are undefined: the pipe reader thread died,
+        # stdout came back None, and tr.indeed.com read as UNCONFIRMED.
+        capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20)
     if r.returncode != 0:
         raise RuntimeError('curl exit %d' % r.returncode)
     body, _, code = r.stdout.rpartition('\n')
```

---

### Incident Patch 13: `97e25757` (2026-09-29)
**Commit Message**: fix(tests): escape the regex in test_verify_pdf's docstring and compile-check tests/*.py (#503)

FindNonAsciiDateRangesTests' docstring (from #498) quotes the regex `\s*`
in a non-raw string. `\s` is an invalid escape sequence, so Python 3.12+
prints a SyntaxWarning for it (CPython gh-98401) when
tests/test_verify_pdf.py is compiled. It is in this repo's own CI log
for a45bbd1 on 3.12, 3.13 and 3.14, at tests/test_verify_pdf.py:75, while
the run stays green. Under `-W error::SyntaxWarning` the module fails to
import and the whole test_verify_pdf suite drops out of the run.

Escaped in the docstring. ToolsCompileWithoutWarnings (#480) only compiled
tools/*.py, which is why this got through; it now compiles tests/*.py too.
With the unescaped docstring it fails naming tests/test_verify_pdf.py, and
it passes with the fix.

Verification on Python 3.10, 3.11, 3.12, 3.13 and 3.14, from a clean
bytecode cache: `python -W error::SyntaxWarning -m unittest discover -s
tests -t .` OK (501 tests, the same count as master),
`tools/lint_skills.py`, `tools/check_framework_version.py`,
`tools/security_guards.py`.

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -105,6 +105,14 @@ per-file diff commands.
 
 ### Fixed
 
+- **The compile-warning check covers `tests/*.py` too** (`tests/test_verify_pdf.py`,
+  `tests/test_verify_layout.py`) - `FindNonAsciiDateRangesTests`' docstring quotes the regex
+  `\s*` unescaped, so Python 3.12+ prints a `SyntaxWarning` for the invalid escape `\s` when
+  the test module is compiled. It shows up in this repo's own CI log on 3.12, 3.13 and 3.14 while
+  the run stays green, and under `-W error::SyntaxWarning` the module fails to import. Escaped
+  in the docstring; `ToolsCompileWithoutWarnings` now compiles `tests/*.py` as well as
+  `tools/*.py` and fails on the unescaped version.
+
 - **`linkedin-search detail` no longer fetches an unrelated posting for a URL on another
   host** - `normalizeId` took the first 6+-digit path segment from *any* URL, so a
   Greenhouse or Lever apply link (the kind a posting's own page hands out, and what a user
```

**File**: `tests/test_verify_layout.py` (modified, +8/-4)
```diff
@@ -177,15 +177,19 @@ class ToolsCompileWithoutWarnings(unittest.TestCase):
     the warning lands in the middle of a verification report. Compiling is a
     pure `compile()` over the source text - no cache file, no temp file - so the
     check costs nothing and covers every `tools/*.py`, guarding the next
-    docstring that quotes a macro too.
+    docstring that quotes a macro too. It covers `tests/*.py` as well: a test
+    docstring that quotes a regex (`\\s*` in `test_verify_pdf.py`) warned in CI
+    on every matrix Python while the run stayed green.
     """
 
     def test_sources_have_no_invalid_escape_sequences(self):
         import warnings
 
         tools_dir = Path(verify_layout.__file__).resolve().parent
-        sources = sorted(tools_dir.glob("*.py"))
+        tests_dir = Path(__file__).resolve().parent
+        sources = sorted(tools_dir.glob("*.py")) + sorted(tests_dir.glob("*.py"))
         self.assertIn(Path(verify_layout.__file__).resolve(), sources)
+        self.assertIn(Path(__file__).resolve(), sources)
         offenders: dict[str, list[str]] = {}
         for source in sources:
             with warnings.catch_warnings(record=True) as caught:
@@ -197,8 +201,8 @@ def test_sources_have_no_invalid_escape_sequences(self):
                 if issubclass(w.category, (SyntaxWarning, DeprecationWarning))
             ]
             if syntax:
-                offenders[source.name] = syntax
-        self.assertEqual({}, offenders, "tools/*.py warn about invalid escapes when compiled")
+                offenders[f"{source.parent.name}/{source.name}"] = syntax
+        self.assertEqual({}, offenders, "tools/*.py or tests/*.py warn about invalid escapes when compiled")
 
 
 if __name__ == "__main__":
```

**File**: `tests/test_verify_pdf.py` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ class FindNonAsciiDateRangesTests(unittest.TestCase):
     The fold that makes `--contains "2016-2024"` pass on that layer (#458) is
     what makes `--contains` unable to detect it - so this check never folds.
 
-    The newline cases are yang2632's finding on the PR: `\s*` between year and
+    The newline cases are yang2632's finding on the PR: `\\s*` between year and
     dash also matched a line break, so a heading ending in an ASCII date joined
     a dash that merely opened the next line.
     """
```

---

### Incident Patch 14: `8cbab682` (2026-09-27)
**Commit Message**: fix(linkedin-search): reject detail URLs on other hosts instead of fetching the posting with that number (#500)

normalizeId took the first 6+-digit path segment from ANY URL, so a
Greenhouse or Lever apply link - the kind a posting's own page hands out
and a user pastes back into detail - was reduced to that number and the
handler fetched jobPosting/<number> from LinkedIn: whatever job carried
that id came back with exit 0, or NOT_FOUND if none did, never an error
about the input. Driving the real handler with a stubbed fetch,
https://boards.greenhouse.io/acme/jobs/4567890 requested
.../jobPosting/4567890. Every other portal CLI rejects an off-host detail
URL with BAD_ID (the #447 shape); linkedin was the one still trusting the
digits.

Parse URLs for real: a linkedin.com host (apex or any subdomain, scheme
optional) plus a /jobs/view/<slug->id path yields the id; other hosts,
look-alike and userinfo hosts, and linkedin.com profile or search URLs
exit 1 with the stderr-JSON BAD_ID contract before any request. Bare
ids, URNs, and slash-free title slugs are unchanged.

Four new normalizeId cases and a new detail-input.test.ts that drives
runDetail and the CLI with fetch stubbed; fiv

**File**: `.agents/skills/linkedin-search/cli/src/commands/detail.ts` (modified, +34/-7)
```diff
@@ -5,15 +5,42 @@ export interface DetailOpts {
   format: "json" | "plain"
 }
 
-/** Accept a raw job ID, a job-view URL, or a job URN. */
+const LINKEDIN_HOST = /(^|\.)linkedin\.com$/i
+
+/**
+ * Accept a raw job ID, a job URN, a LinkedIn job-view URL (any linkedin.com
+ * host, with or without scheme), or a bare title slug ending in the ID.
+ *
+ * A URL on any other host is rejected. The previous pattern took the first
+ * 6+-digit path segment from ANY URL, so a Greenhouse or Lever apply link -
+ * the kind a posting's own page hands out - fetched whatever LinkedIn
+ * posting happened to carry that number and printed it with exit 0. Host and
+ * path are read through real URL parsing, so look-alike hosts
+ * (linkedin.com.evil.io) and userinfo tricks (linkedin.com@evil.io) fall on
+ * the reject side too.
+ */
 export function normalizeId(input: string): string | null {
-  const urn = input.match(/urn:li:jobPosting:(\d+)/)
+  const trimmed = input.trim()
+  const urn = trimmed.match(/urn:li:jobPosting:(\d+)/)
   if (urn) return urn[1]
-  const url = input.match(/-(\d{6,})(?:[\/?]|$)/) || input.match(/\/(\d{6,})(?:[\/?]|$)/)
-  if (url) return url[1]
-  const bare = input.match(/^\d{6,}$/)
-  if (bare) return input
-  return null
+  if (/^\d{6,}$/.test(trimmed)) return trimmed
+
+  const hasScheme = /^https?:\/\//i.test(trimmed)
+  if (hasScheme || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
+    let parsed: URL
+    try {
+      parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
+    } catch {
+      return null
+    }
+    if (!LINKEDIN_HOST.test(parsed.hostname)) return null
+    const path = parsed.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/)
+    return path ? path[1] : null
+  }
+
+  // A scheme- and slash-free slug such as "software-engineer-1234567890".
+  const slug = trimmed.match(/^[a-z0-9-]*-(\d{6,})$/i)
+  return slug ? slug[1] : null
 }
 
 export async function runDetail(opts: DetailOpts): Promise<number> {
```

**File**: `.agents/skills/linkedin-search/cli/tests/detail-input.test.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import { afterEach, describe, expect, test } from "bun:test";
+import { runDetail } from "../src/commands/detail";
+import { DETAIL_URL } from "../src/helpers";
+import { runCLI } from "./helpers";
+
+// The real command path, not the parser in isolation: `detail` must never
+// send a request for a URL that is not a LinkedIn job view. Before the host
+// check, a Greenhouse apply link pasted from a posting was reduced to its
+// 7-digit path segment and the handler fetched LinkedIn posting 4567890 -
+// an unrelated job, printed with exit 0. fetch is stubbed throughout; no
+// test here touches the network.
+
+const originalFetch = globalThis.fetch;
+const originalStderrWrite = process.stderr.write;
+
+afterEach(() => {
+  globalThis.fetch = originalFetch;
+  process.stderr.write = originalStderrWrite;
+});
+
+function recordingFetch(): string[] {
+  const requested: string[] = [];
+  globalThis.fetch = (async (input: string | URL | Request) => {
+    requested.push(String(input));
+    return new Response("", { status: 404 });
+  }) as unknown as typeof fetch;
+  return requested;
+}
+
+function captureStderr(): string[] {
+  const out: string[] = [];
+  process.stderr.write = ((chunk: string | Uint8Array) => {
+    out.push(String(chunk));
+    return true;
+  }) as typeof process.stderr.write;
+  return out;
+}
+
+describe("detail input on the real handler path", () => {
+  test("a foreign job-board URL is rejected with BAD_ID before any request", async () => {
+    const requested = recordingFetch();
+    const stderr = captureStderr();
+
+    const rc = await runDetail({ id: "https://boards.greenhouse.io/acme/jobs/4567890", format: "json" });
+
+    expect(rc).toBe(1);
+    expect(requested).toEqual([]);
+    expect(JSON.parse(stderr.join("").trim())).toMatchObject({ code: "BAD_ID" });
+  });
+
+  test("a LinkedIn job URL builds the fetch URL from the extracted id", async () => {
+    const requested = recordingFetch();
+    captureStderr();
+
+    const rc = await runDetail({
+      id: "https://dk.linkedin.com/jobs/view/data-scientist-9876543210/?trackingId=x",
+      format: "json",
+    });
+
+    expect(rc).toBe(1); // the stub answers 404 -> NOT_FOUND, after the request was made
+    expect(requested).toEqual([`${DETAIL_URL}/9876543210`]);
+  });
+});
+
+describe("detail input through the CLI", () => {
+  test("exits 1 with the stderr-JSON BAD_ID contract for a foreign URL", async () => {
+    const result = await runCLI(["detail", "https://jobs.lever.co/acme/1234567"]);
+
+    expect(result.exitCode).toBe(1);
+    expect(JSON.parse(result.stderr)).toMatchObject({ code: "BAD_ID" });
+  });
+});
```

**File**: `.agents/skills/linkedin-search/cli/tests/parsing.test.ts` (modified, +24/-0)
```diff
@@ -267,6 +267,30 @@ describe("normalizeId", () => {
     expect(normalizeId("https://dk.linkedin.com/jobs/view/data-scientist-9876543210/")).toBe("9876543210");
   });
 
+  test("accepts a scheme-less linkedin.com job URL and a bare title slug", () => {
+    expect(normalizeId("www.linkedin.com/jobs/view/1234567890")).toBe("1234567890");
+    expect(normalizeId("software-engineer-1234567890")).toBe("1234567890");
+  });
+
+  test("rejects a job URL on any other host instead of extracting its digits", () => {
+    // The old pattern took the first 6+-digit path segment from any URL, so an
+    // ATS apply link fetched an unrelated LinkedIn posting with that number.
+    expect(normalizeId("https://boards.greenhouse.io/acme/jobs/4567890")).toBeNull();
+    expect(normalizeId("https://jobs.lever.co/acme/1234567")).toBeNull();
+    expect(normalizeId("https://example.com/jobs/view/1234567890")).toBeNull();
+  });
+
+  test("rejects look-alike and userinfo hosts", () => {
+    expect(normalizeId("https://linkedin.com.evil.io/jobs/view/1234567890")).toBeNull();
+    expect(normalizeId("https://notlinkedin.com/jobs/view/1234567890")).toBeNull();
+    expect(normalizeId("https://www.linkedin.com@evil.io/jobs/view/1234567890")).toBeNull();
+  });
+
+  test("rejects a linkedin.com URL that is not a job view", () => {
+    expect(normalizeId("https://www.linkedin.com/in/someone-1234567890/")).toBeNull();
+    expect(normalizeId("https://www.linkedin.com/jobs/search/?currentJobId=1234567890")).toBeNull();
+  });
+
   test("returns null for non-job URLs and invalid strings", () => {
     expect(normalizeId("https://www.linkedin.com/feed/")).toBeNull();
     expect(normalizeId("not-a-url")).toBeNull();
```

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -84,6 +84,23 @@ per-file diff commands.
 
 ### Fixed
 
+- **`linkedin-search detail` no longer fetches an unrelated posting for a URL on another
+  host** - `normalizeId` took the first 6+-digit path segment from *any* URL, so a
+  Greenhouse or Lever apply link (the kind a posting's own page hands out, and what a user
+  pastes back into `detail`) was reduced to that number and the handler fetched
+  `jobPosting/<number>` from LinkedIn: whatever job carried that id came back, printed with
+  exit 0, or `NOT_FOUND` if none did - never an error about the input. Demonstrated by driving
+  the real handler with a stubbed fetch: `https://boards.greenhouse.io/acme/jobs/4567890`
+  requested `.../jobPosting/4567890`. Every other portal CLI rejects an off-host detail URL
+  with `BAD_ID` (the #447 shape); linkedin was the one still trusting the digits. URLs are
+  now parsed for real: a `linkedin.com` host (apex or any subdomain, scheme optional) plus a
+  `/jobs/view/<slug-><id>` path yields the id, and anything else - other hosts, look-alike and
+  userinfo hosts, a linkedin.com profile or search URL - exits 1 with the stderr-JSON
+  `BAD_ID` contract before any request. Bare ids, URNs, and slash-free title slugs are
+  unchanged. Pinned by four new `normalizeId` cases and a new `detail-input.test.ts` that
+  drives `runDetail` and the CLI with fetch stubbed; the off-host cases fail on the old
+  pattern.
+
 - **`/rank` tracker matching preserves Unicode company and role names**
   (`tools/rank_state.py`, `tests/test_rank_state.py`) - ASCII-only normalization
   collapsed distinct non-Latin roles to the same empty value and dropped
```

---

### Incident Patch 15: `a62af6a0` (2026-09-27)
**Commit Message**: fix(verify-layout): escape the docstring's LaTeX macro so the tool stops emitting SyntaxWarning (#480)

`tools/verify_layout.py`'s module docstring explains which documents trigger
the Poppler `-bbox` crash, and names the macro whose absence causes it:
`\hypersetup{pdftitle=...}`. In a non-raw docstring `\h` is an invalid escape
sequence, so compiling the module prints

    SyntaxWarning: "\h" is an invalid escape sequence.
    Such sequences will not work in the future. Did you mean "\\h"?

on Python 3.12+ (CPython gh-98401 promoted the long-standing
DeprecationWarning to a SyntaxWarning). The 3.15 language reference still
documents the sequence as a SyntaxWarning, with a SyntaxError only "in a
future Python version".

This is on the real path, not a constructed one: /apply Step 5b runs
`python3 tools/verify_layout.py <pdf>` once per document, so the first
invocation after any source change prints the warning into the middle of the
layout report a user is reading to judge their CV. It is also visible in this
repo's own CI log, where `python -m unittest discover -s tests -t . -v` prints
it above the test results.

Reproduce on master:

    python3 -W error::SyntaxWarning -c "compil

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -132,6 +132,17 @@ per-file diff commands.
   The standard `date`-first header already worked; regression coverage checks
   all three column orders with and without a BOM.
 
+- **`verify_layout.py` no longer emits a `SyntaxWarning` on every run** (`tools/verify_layout.py`,
+  `tests/test_verify_layout.py`) - the module docstring names the macro whose absence triggers the
+  Poppler `-bbox` crash, `\hypersetup{pdftitle=...}`, and a bare `\h` in a non-raw docstring is an
+  invalid escape sequence. Python 3.12+ prints `SyntaxWarning: "\h" is an invalid escape sequence`
+  the first time the module is compiled (CPython gh-98401) - it shows up in this repo's own CI log,
+  and in the middle of `/apply` Step 5b's layout report. The 3.15 language reference still
+  documents the sequence as a `SyntaxWarning`, with a `SyntaxError` only in a future Python
+  version. Escaped in the docstring; the new `ToolsCompileWithoutWarnings` case compiles the
+  source of every `tools/*.py` with warnings captured and fails on the unescaped version, so the
+  next docstring that quotes a LaTeX macro is caught too.
+
 - **`/apply` Step 5b now actually runs the page-count check it claimed Step 5d ran**
   (`.claude/commands/apply.md`, `tests/test_apply_page_count.py`) - the 5b prose said
   "Page count is not checked here - that is `verify_pdf.py --pages`'s job, and Step 5d already
```

**File**: `tests/test_verify_layout.py` (modified, +37/-0)
```diff
@@ -16,6 +16,7 @@
 from pathlib import Path
 from unittest.mock import patch
 
+from tools import verify_layout
 from tools.verify_layout import Line, Page, find_orphans, main, parse_pdf, report
 
 A4_HEIGHT = 842.0
@@ -164,5 +165,41 @@ def test_extractor_failure_exits_2_not_1(self):
             self.assertIn("skipped:", err.getvalue())
 
 
+class ToolsCompileWithoutWarnings(unittest.TestCase):
+    """Every tool's source must compile clean.
+
+    `verify_layout.py`'s docstring documents LaTeX macros, and a bare `\\h` in a
+    non-raw docstring is an invalid escape sequence: Python 3.12+ emits a
+    SyntaxWarning when the module is compiled (CPython gh-98401), 3.10 and 3.11
+    a DeprecationWarning, so the test records both; the language
+    reference still documents it as a warning in 3.15, with a SyntaxError only
+    in a future Python version. The tool is run per-document from `/apply`, so
+    the warning lands in the middle of a verification report. Compiling is a
+    pure `compile()` over the source text - no cache file, no temp file - so the
+    check costs nothing and covers every `tools/*.py`, guarding the next
+    docstring that quotes a macro too.
+    """
+
+    def test_sources_have_no_invalid_escape_sequences(self):
+        import warnings
+
+        tools_dir = Path(verify_layout.__file__).resolve().parent
+        sources = sorted(tools_dir.glob("*.py"))
+        self.assertIn(Path(verify_layout.__file__).resolve(), sources)
+        offenders: dict[str, list[str]] = {}
+        for source in sources:
+            with warnings.catch_warnings(record=True) as caught:
+                warnings.simplefilter("always")
+                compile(source.read_text(encoding="utf-8"), str(source), "exec")
+            syntax = [
+                str(w.message)
+                for w in caught
+                if issubclass(w.category, (SyntaxWarning, DeprecationWarning))
+            ]
+            if syntax:
+                offenders[source.name] = syntax
+        self.assertEqual({}, offenders, "tools/*.py warn about invalid escapes when compiled")
+
+
 if __name__ == "__main__":
     unittest.main()
```

**File**: `tools/verify_layout.py` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@
 all, and Poppler 26.0x before 26.05 aborts `-bbox`/`-bbox-layout`/`-htmlmeta` on a PDF
 whose Info dictionary carries an empty string in any field - which `hyperref` writes for
 every field it does not set, so any `lualatex`/`pdflatex` document built with `hyperref`
-and no `\hypersetup{pdftitle=...}` triggers a real Poppler crashing on a legal PDF (#451).
+and no `\\hypersetup{pdftitle=...}` triggers a real Poppler crashing on a legal PDF (#451).
 Line height serves
 as a font-size proxy to spot section headings; left edge (xMin) separates bullet lines
 from entry headers.
```

#### Recent Merged Pull Requests:
- **PR #518** (2026-10-05): fix(portal-clis): emit the contract's id field from jobnet and jobdanmark search results (@ayobamiseun)
- **PR #517** (closed): sync fork (@spunch-bop-88)
- **PR #516** (2026-10-05): fix(jobdanmark-search): render a JSON-LD description as text instead of passing the markup through (#515) (@ayobamiseun)
- **PR #514** (2026-10-05): fix(job_key): hash mixed-script names instead of keying on their Latin fragment (#513) (@ayobamiseun)
- **PR #512** (2026-10-03): fix(verify_pdf): --ascii-dates needs digit boundaries around the year (follow-up to #498) (@ayobamiseun)
- **PR #511** (2026-10-02): fix(check_framework_version): decode git diff output as UTF-8 (@timaero)
- **PR #509** (2026-10-01): fix(robots-check): stop a leading BOM or an undecodable rule from reading as allowed (@canmugan)
- **PR #508** (2026-10-01): fix(verify-layout): find an orphaned entry header by where the text starts (@yang2632)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
