# Forensic Learning Record (Deep Inspection): xerj-org/xerj

> **Canonical Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:28.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: XERJ is the new way for AI to search data. Its autoindex capability activates agents to know your data without the token waste of grep and sed. One command indexes code, docs, logs and PDFs for search, RAG, security audits and agent memory, using 40x fewer tokens than grep. Elasticsearch compatible, so existing clients just work.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2562 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/ask-plan/scripts/agent_arm.py`
```
#!/usr/bin/env python3
"""agent_arm.py — the #1056 agent-harness comparison, case-study method. DESIGN ONLY.

STATUS: DESIGN, NOTHING MEASURED — this script has never been run and ships no
results. The issue's third gate line reads: "agent harness (case-study method:
16 runs per arm, real `claude -p` token counts) shows output tokens per solved
structured-query task <= 50% of agent-written DSL at equal solve rate." The
prior case study that defines the method measured 9,982 vs 26,477 output tokens
(docs/case-studies/reference-coding/CASE_STUDY.md, 8 tasks x 2 trials = 16 runs
per arm, tokens read from `claude -p --output-format json` usage, never
estimated). Those numbers are context for the method, NOT results of this
harness, and are not about /_ask.

Two arms, same 8 tasks (seeded pick from pairs.jsonl, 2-3 per dataset), 2
trials each = 16 runs per arm:

  direct   the agent gets the index mapping and the task prompt, and writes
           Elasticsearch query DSL itself. The harness executes exactly the
           JSON the agent emitted.
  ask      the agent gets the same mapping and task, plus the knowledge that
           POST /_ask exists (curl in the shell), and must return the DSL the
           endpoint produced.

Solved := returned DSL executes (HTTP 200) AND result-set F1 >= 0.9 vs gold.
Metric := median real output tokens per SOLVED task (and totals), read from the
`usage` field of `claude -p --output-format json`. Gate := ask-arm tokens <=
50% of direct-arm at equal solve count.

Refuses to run unless:
  - the `claude` CLI is on PATH (no CLI -> no run; the script does not fall
    back to estimating tokens, because an estimate is exactly what the
    case-study method forbids), and
  - CONFIRM_AGENT_RUN=1 is set (32 real model runs cost real money).

Usage:
  XERJ_URL=http://127.0.0.1:9640 CONFIRM_AGENT_RUN=1 \
    python3 scripts/agent_arm.py --out results/<date>-agent
"""
import argparse
import datetime
import json
import os
import pathlib
import random
import shutil
import subprocess
import sys
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from ask_arm import U, pairs, search_ids, f1  # noqa: E402 — shared fixture code

SEED = 1056
TASKS_PER_ARM = 8
TRIALS = 2
SOLVE_F1 = 0.9

MAPPING_HINT = {
    "usgs-earthquakes": "fields: time (date), place (keyword), mag (double), depth (double), magType (keyword), net (keyword), nst (long), rms (double), type (keyword), status (keyword)",
    "nasa-exoplanets": "fields: hostname (keyword), sy_snum (long), sy_pnum (long), discoverymethod (keyword), disc_year (long), pl_orbper (double, days), pl_rade (double, Earth radii), pl_bmasse (double), st_teff (double, K), ra (double), dec (double)",
    "gapminder": "fields: country (keyword), continent (keyword), year (long), lifeExp (double), pop (long), gdpPercap (double)",
}

DIRECT_PROMPT = """You are working against an Elasticsearch-8-compatible search server at {url}.

Index "{index}" ({dataset}) — {mapping}.

Task: {prompt}

Reply with ONLY the JSON body of a _search request (an object with a "query"
key). The body will be executed verbatim; nothing else you write is executed.
"""

ASK_PROMPT = """You are working against an Elasticsearch-8-compatible search server at {url}.

Index "{index}" ({dataset}) — {mapping}.

The server implements POST {url}/_ask with body {{"index": "<index or pattern>",
"prompt": "<natural language>"}}; it returns {{"query": <validated query DSL>,
"plan": [...], "confidence": <number>, "indices": [...]}} — the DSL is already
validated server-side.

Task: {prompt}

Use POST /_ask (curl is available) and reply with ONLY the JSON _search body
you would send next (the "query" the endpoint returned). The body will be
executed verbatim; nothing else you write is executed.
"""


def pick_tasks():
    ps = pairs()
    rng = random.Random(SEED)
    by_ds = {}
    for p in ps:
        by_ds.setdefault(p["dataset"], []).append(p)
    tasks = []
    for ds in sorted(by_ds):
        tasks.extend(rng.sample(by_ds[ds], min(3, len(by_ds[ds]))))
    return tasks[:TASKS_PER_ARM]


def run_claude(prompt):
    """One `claude -p --output-format json` run; returns (text, usage dict)."""
    proc = subprocess.run(
        ["claude", "-p", "--output-format", "json", prompt],
        capture_output=True, text=True, timeout=900)
    if proc.returncode != 0:
        return None, {"error": f"exit {proc.returncode}: {proc.stderr[:300]}"}
    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None, {"error": f"unparseable output: {proc.stdout[:300]}"}
    return out.get("result", ""), out.get("usage", {})


def execute(text, index):
    """Extract a JSON object from the agent reply and execute it verbatim."""
    text = text.strip()
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b <= a:
        return None, {"error": "no JSON object in reply"}
    try:
        body = json.loads(text[a:b + 1])
    except json.JSONDecodeError as e:
        return None, {"error": f"bad JSON: {e}"}
    q = body.get("query") if isinstance(body, dict) else None
    if q is None:
        return None, {"error": "body has no query key"}
    r = urllib.request.Request(f"{U}/{index}/_search",
                               data=json.dumps({"query": q, "size": 10000}).encode(),
                               method="POST", headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            hits = json.loads(resp.read().decode())
        return {h["_id"] for h in hits["hits"]["hits"]}, {}
    except urllib.error.HTTPError as e:
        return None, {"error": f"engine {e.code}: {e.read().decode(errors='replace')[:200]}"}


def main():
    ap = argparse.ArgumentParser(description="agent-harness comparison (DESIGN, unrun)")
    ap.add_argument("--out", required=True, help="run directory, e.g. results/2026-xx-xx-agent")
    args = ap.parse_args()

    if not shutil.which("claude"):
        print("REFUSED: the `claude` CLI is not on PATH. The case-study method reads REAL")
        print("token counts from `claude -p --output-format json`; without the CLI there is")
        print("no honest run, and this script will not estimate tokens in its place.")
        return 2
    if os.environ.get("CONFIRM_AGENT_RUN") != "1":
        print("REFUSED: set CONFIRM_AGENT_RUN=1 — this spends real model budget")
        print(f"({TASKS_PER_ARM} tasks x {TRIALS} trials x 2 arms = "
              f"{TASKS_PER_ARM * TRIALS * 2} real claude runs)")
        return 2

    tasks = pick_tasks()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    runs = []
    for arm, template in [("direct", DIRECT_PROMPT), ("ask", ASK_PROMPT)]:
        for t in tasks:
            for trial in range(1, TRIALS + 1):
                prompt = template.format(url=U, index=t["gold"]["index"],
                                         dataset=t["dataset"],
                                         mapping=MAPPING_HINT[t["dataset"]],
                                         prompt=t["prompt"])
                text, usage = run_claude(prompt)
                ids, err = (None, usage.get("error")) if text is None else execute(text, t["gold"]["index"])
                solved = ids is not None and f1(ids, set(t["gold"]["doc_ids"])) >= SOLVE_F1
                rec = {"arm": arm, "trial": trial, "pair": t["id"],
                       "dataset": t["dataset"], "prompt": t["prompt"],
                       "reply": text, "usage": usage, "solved": solved,
                       "error": err}
                runs.append(rec)
                print(f"{arm:6s} trial {trial} {t['id']:24s} solved={solved} "
                      f"out_tokens={usage.get('output_tokens')}")

    (out / "agent-raw.jsonl").write_text("".join(json.dumps(r) + "\n" for r in runs))
    summary = {}
    for arm in ("direct", "ask"):
        rs = [r for r in runs if r["arm"] == arm]
  
```

### Core Architecture Module: `benchmarks/ask-plan/scripts/ask_arm.py`
```
#!/usr/bin/env python3
"""ask_arm.py — fixture loader + the /_ask arm of the ask-plan harness.

STATUS: DESIGN, NOTHING MEASURED YET. POST /_ask does not exist in the engine
today (issue #1056 is the work item); when run.sh finds it absent it stops
after the fixture self-check and writes a status file that says so, with
measured:false. Nothing in here fabricates a result.

Three subcommands (python3 stdlib only):

  load    create the three ax-* indices with explicit mappings and bulk-load
          the committed raw snapshots, assigning _id from each dataset's own
          key column — the SAME id space data/gold/pairs.jsonl derives gold
          doc_ids from, so gold and index contents are tied to the same bytes.
  selfcheck   execute every pair's query_equivalent and require the hit-id
          set to equal gold doc_ids. This validates the FIXTURE against a live
          engine: a failure here means the fixture is wrong (or the engine's
          query semantics differ from the DSL we wrote), and it is reported as
          a fixture error, never folded into /_ask scores.
  ask     the measurement: for each pair, POST /_ask {index, prompt}, then
          (a) the returned query must execute — a 400 means invalid DSL out,
          exactly what #1056's zero-invalid-DSL line forbids; (b) its hit-id
          set is compared to gold for precision/recall/F1. Raw per-pair
          responses go to the run directory untouched; the summary is written
          next to them. It exits 0 and records measured:false if /_ask is
          absent (404/405/501).

Usage (run.sh drives this):
  XERJ_URL=http://127.0.0.1:9610 python3 scripts/ask_arm.py load
  XERJ_URL=... python3 scripts/ask_arm.py selfcheck --out DIR
  XERJ_URL=... python3 scripts/ask_arm.py ask --out DIR [--determinism N]
"""
import argparse
import csv
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parent / "data"
U = os.environ.get("XERJ_URL", "http://127.0.0.1:9610").rstrip("/")

# _id is derived from the data's own key column — never file order — so gold
# doc_ids (derived from the same rows) match what the engine stores.
DATASETS = {
    "usgs-earthquakes": dict(
        file="usgs-earthquakes.csv", delimiter=",",
        id=lambda r: r["id"],
        mappings={
            "time": {"type": "date"}, "place": {"type": "keyword"},
            "mag": {"type": "double"}, "depth": {"type": "double"},
            "latitude": {"type": "double"}, "longitude": {"type": "double"},
            "magType": {"type": "keyword"}, "net": {"type": "keyword"},
            "nst": {"type": "long"}, "rms": {"type": "double"},
            "type": {"type": "keyword"}, "status": {"type": "keyword"},
        },
    ),
    "nasa-exoplanets": dict(
        file="nasa-exoplanets.csv", delimiter=",",
        id=lambda r: r["pl_name"],
        mappings={
            "hostname": {"type": "keyword"},
            "sy_snum": {"type": "long"}, "sy_pnum": {"type": "long"},
            "discoverymethod": {"type": "keyword"}, "disc_year": {"type": "long"},
            "pl_orbper": {"type": "double"}, "pl_rade": {"type": "double"},
            "pl_bmasse": {"type": "double"}, "pl_eqt": {"type": "double"},
            "st_teff": {"type": "double"}, "st_rad": {"type": "double"},
            "st_mass": {"type": "double"},
            "ra": {"type": "double"}, "dec": {"type": "double"},
        },
    ),
    "gapminder": dict(
        file="gapminder.tsv", delimiter="\t",
        id=lambda r: f"{r['country']}-{r['year']}",
        mappings={
            "country": {"type": "keyword"}, "continent": {"type": "keyword"},
            "year": {"type": "long"}, "lifeExp": {"type": "double"},
            "pop": {"type": "long"}, "gdpPercap": {"type": "double"},
        },
    ),
}


def req(method, path, body=None, ctype="application/json", timeout=120):
    data = body.encode() if isinstance(body, str) else body
    r = urllib.request.Request(U + path, data=data, method=method)
    if data is not None:
        r.add_header("content-type", ctype)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:800]
        try:
            detail = json.loads(detail)
        except json.JSONDecodeError:
            pass
        return e.code, detail
    except urllib.error.URLError as e:
        raise SystemExit(f"engine unreachable at {U}: {e}")


def typed(row, mappings):
    """Coerce CSV strings to the mapped JSON type; blank -> omit (missing)."""
    doc = {}
    for k, v in row.items():
        m = mappings.get(k)
        if v is None or v == "":
            continue
        if m and m["type"] in ("double", "long"):
            f = float(v)
            doc[k] = int(f) if m["type"] == "long" else f
        else:
            doc[k] = v
    return doc


def cmd_load():
    for name, spec in DATASETS.items():
        idx = f"ax-{name}"
        code, body = req("DELETE", f"/{idx}")
        code, body = req("PUT", f"/{idx}", json.dumps(
            {"mappings": {"properties": dict(spec["mappings"], **{
                # a text projection of the row for any semantic arm later; not
                # used by any current pair
                "row_text": {"type": "text"},
            })}}))
        if code not in (200, 201):
            print(f"PUT {idx} -> {code}: {json.dumps(body)[:300]}")
            return 1
        rows = list(csv.DictReader(open(DATA / "raw" / name / spec["file"]),
                                   delimiter=spec["delimiter"]))
        nd = ""
        for r in rows:
            _id = spec["id"](r)
            nd += json.dumps({"index": {"_index": idx, "_id": _id}}) + "\n"
            nd += json.dumps(typed(r, spec["mappings"])) + "\n"
        code, body = req("POST", "/_bulk?refresh=true", nd, "application/x-ndjson", timeout=600)
        if code != 200 or body.get("errors"):
            print(f"bulk {idx} -> {code} errors={body.get('errors')}: {json.dumps(body)[:400]}")
            return 1
        code, body = req("GET", f"/{idx}/_count")
        print(f"loaded {idx}: {body.get('count')} docs ({len(rows)} rows in raw)")
        if body.get("count") != len(rows):
            print(f"::error::count mismatch on {idx}")
            return 1
    return 0


def search_ids(index, query, size=10000):
    body = json.dumps({"query": query, "size": size, "_source": False})
    code, resp = req("POST", f"/{index}/_search", body)
    if code != 200:
        return None, code, resp
    hits = resp.get("hits", {})
    total = hits.get("total")
    total = total.get("value") if isinstance(total, dict) else total
    ids = {h["_id"] for h in hits.get("hits", [])}
    return ids, code, (total, len(ids))


def pairs():
    return [json.loads(l) for l in open(DATA / "gold" / "pairs.jsonl")]


def cmd_selfcheck(out):
    bad = 0
    for p in pairs():
        ids, code, detail = search_ids(p["gold"]["index"], p["gold"]["query_equivalent"])
        if ids is None:
            print(f"FIXTURE-ERROR {p['id']}: query returned HTTP {code}: {json.dumps(detail)[:200]}")
            bad += 1
        elif ids != set(p["gold"]["doc_ids"]):
            missing = sorted(set(p["gold"]["doc_ids"]) - ids)[:4]
            extra = sorted(ids - set(p["gold"]["doc_ids"]))[:4]
            print(f"FIXTURE-ERROR {p['id']}: engine {detail[0]} hits vs {len(p['gold']['doc_ids'])} gold"
                  f" (missing e.g. {missing}, extra e.g. {extra})")
            bad += 1
    if bad:
        print(f"::error::ask-plan selfcheck: {bad} pair(s) do not reproduce their gold set —"
              " the FIXTURE (or query semantics) is wrong; fix before measuring anything")
        return 1
    print("selfcheck: every query_equivalent reproduces its gold doc-id set")
    return 0


def 
```

### Core Architecture Module: `benchmarks/ask-plan/scripts/derive_pairs.py`
```
#!/usr/bin/env python3
"""derive_pairs.py — build data/gold/pairs.jsonl for benchmarks/ask-plan.

STATUS: DESIGN, NOTHING MEASURED. This script produces evaluation *inputs*
(prompts and gold result sets), never results. Gold is derived from the
committed raw snapshots in data/raw/ by filtering the raw rows in Python —
no engine is run, at derivation time or ever, to produce gold. The
`query_equivalent` in each pair is the predicate the prompt names, written as
Elasticsearch-style DSL that the harness later EXECUTES as a fixture
self-check (its result set must reproduce gold doc_ids on a correct engine);
it is not itself gold and not an engine output.

python3 stdlib only. Deterministic: fixed template order, fixed value lists,
seeded RNG (SEED) used only to choose between equally-valid prompt phrasings.
Re-running on the same raw bytes produces byte-identical pairs.jsonl;
`--check` verifies exactly that and exits non-zero on drift.

Output — one JSON object per line:

  {"id": "...", "dataset": "...", "index_hint": "ax-...",
   "prompt": "...",
   "gold": {"index": "ax-...", "doc_ids": [...], "query_equivalent": {...}}}

  doc_ids           sorted, unique _ids of every raw row matching the
                    predicate (the loader assigns _id from the dataset's own
                    key column, so ids are data-derived, not row-order-derived)
  query_equivalent  the query object that would sit under "query" in a
                    _search body; leaves are term/range/bool only — the
                    shapes engine/crates/xerj-query/src/parser.rs accepts

Keeps a pair only when 1 <= len(gold doc_ids) <= MAX_GOLD (a gold of 0 or of
"everything" scores nothing interesting). If the raw snapshot ever changes
under a refresh, keep-counts change and the >= 200 assertion fails loudly
instead of silently shipping a thin gate.
"""
import argparse
import csv
import json
import pathlib
import random
import sys
from datetime import datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parent / "data"
GOLD = DATA / "gold" / "pairs.jsonl"

SEED = 1056          # pinned; changing it changes prompt phrasings only
MIN_PAIRS = 200      # the #1056 gate: >= 200 (prompt, gold result set) pairs
MAX_GOLD = 1500      # bounded result sets: F1 is meaningful, size stays sane

rng = random.Random(SEED)


# ───────────────────────────── helpers ──────────────────────────────────────
def parse_iso(ts):
    """USGS/FDSN timestamps: 2026-09-01T01:29:11.420Z -> aware datetime."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def num(x):
    """Format a number for prompt text without pointless trailing zeros."""
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x)


def fnum(x):
    """Numeric bound as it should appear in the DSL (float/int)."""
    f = float(x)
    return int(f) if f.is_integer() else f


def pair(dataset, prompt, clauses, doc_ids):
    """Assemble one pair. clauses = list of DSL leaf clauses (ANDed)."""
    q = clauses[0] if len(clauses) == 1 else {"bool": {"filter": clauses}}
    return {
        "id": "",  # assigned sequentially per dataset once ordering is fixed
        "dataset": dataset,
        "index_hint": f"ax-{dataset}",
        "prompt": prompt,
        "gold": {
            "index": f"ax-{dataset}",
            "doc_ids": sorted(doc_ids),
            "query_equivalent": q,
        },
    }


def pick(*variants):
    """Deterministic phrasing choice among equally-correct prompt wordings."""
    return rng.choice(variants)


# ────────────────────────── dataset: usgs-earthquakes ───────────────────────
def usgs_pairs():
    rows = list(csv.DictReader(open(DATA / "raw" / "usgs-earthquakes" / "usgs-earthquakes.csv")))
    for r in rows:
        r["_id"] = r["id"]
        r["_mag"] = float(r["mag"])
        r["_depth"] = float(r["depth"])
        r["_t"] = parse_iso(r["time"])
    out = []

    def ids(pred):
        return [r["_id"] for r in rows if pred(r)]

    # magnitude thresholds
    for t in [2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 5.0, 5.5, 6.0]:
        out.append(pair("usgs-earthquakes",
                        pick(f"all events with magnitude {num(t)} or greater",
                             f"events of magnitude {num(t)} and above"),
                        [{"range": {"mag": {"gte": fnum(t)}}}],
                        ids(lambda r, t=t: r["_mag"] >= t)))
    for t in [3.5, 4.0, 5.0]:
        out.append(pair("usgs-earthquakes",
                        f"events strictly stronger than magnitude {num(t)}",
                        [{"range": {"mag": {"gt": fnum(t)}}}],
                        ids(lambda r, t=t: r["_mag"] > t)))
    for a, b in [(3.0, 4.0), (3.5, 4.5), (4.0, 5.0)]:
        out.append(pair("usgs-earthquakes",
                        pick(f"events between magnitude {num(a)} and {num(b)}",
                             f"events with magnitude from {num(a)} to {num(b)}"),
                        [{"range": {"mag": {"gte": fnum(a), "lte": fnum(b)}}}],
                        ids(lambda r, a=a, b=b: a <= r["_mag"] <= b)))
    for t in [4.0, 4.5, 5.0]:
        out.append(pair("usgs-earthquakes",
                        f"events with magnitude exactly {num(t)}",
                        [{"term": {"mag": fnum(t)}}],
                        ids(lambda r, t=t: r["_mag"] == t)))

    # depth
    for t in [35, 50, 100, 150, 200, 250, 350, 400, 500]:
        out.append(pair("usgs-earthquakes",
                        pick(f"events deeper than {t} km",
                             f"quakes at depths greater than {t} kilometers"),
                        [{"range": {"depth": {"gt": t}}}],
                        ids(lambda r, t=t: r["_depth"] > t)))
    for t in [5, 10, 20, 35, 50]:
        out.append(pair("usgs-earthquakes",
                        f"events shallower than {t} km",
                        [{"range": {"depth": {"lt": t}}}],
                        ids(lambda r, t=t: r["_depth"] < t)))

    # keyword equality: magType and net, swept over every distinct value with a
    # bounded count in the snapshot (data-driven, hence deterministic; a value
    # absent from the window simply never appears)
    from collections import Counter
    for field in ("magType", "net"):
        for v, c in sorted(Counter(r[field] for r in rows).items()):
            if not (2 <= c <= MAX_GOLD):
                continue
            if field == "magType":
                pr = pick(f"events whose magnitude type is {v}",
                          f"events with magnitude type {v}")
            else:
                pr = pick(f"events reported by the {v} network",
                          f"events from the {v} seismic network")
            out.append(pair("usgs-earthquakes", pr,
                            [{"term": {field: v}}],
                            ids(lambda r, f=field, v=v: r[f] == v)))

    # day windows and multi-day windows (UTC)
    for d in range(1, 8):
        day = f"2026-09-{d:02d}"
        lo = datetime.fromisoformat(f"{day}T00:00:00+00:00")
        hi = datetime.fromisoformat(f"2026-09-{d + 1:02d}T00:00:00+00:00")
        out.append(pair("usgs-earthquakes",
                        pick(f"events on {day} (UTC)",
                             f"all events that happened on {day} UTC"),
                        [{"range": {"time": {"gte": f"{day}T00:00:00Z",
                                             "lt": f"2026-09-{d + 1:02d}T00:00:00Z"}}}],
                        ids(lambda r, lo=lo, hi=hi: lo <= r["_t"] < hi)))
    for a, b in [(1, 3), (3, 5), (5, 7)]:
        lo = datetime.fromisoformat(f"2026-09-{a:02d}T00:00:00+00:00")
        hi = datetime.fromisoformat(f"2026-09-{b:02d}T00:00:00+00:00")
        out.append(pair("usgs-earthquakes",
                        f"events from 2026-09-{a:02d} through 2026-09-{b:02d} UTC",
                        [{"range": {"time": {"gte": f"2026-09-{a:02d}T00:00:00Z",
                                             "lt": 
```

### Core Architecture Module: `benchmarks/ask-plan/scripts/fetch_data.py`
```
#!/usr/bin/env python3
"""fetch_data.py — (re)acquire the raw public datasets for benchmarks/ask-plan.

STATUS: DESIGN, NOTHING MEASURED. Fetching data is not a measurement; this
script records provenance (URL, sha256, size, retrieval date) and nothing else.

python3 stdlib only. Three modes:

  python3 scripts/fetch_data.py --check     default: verify the committed
                                            snapshots against provenance.json
                                            (sha256). Reports drift loudly but
                                            exits 0 — drift is EXPECTED (the
                                            exoplanet composite table refreshes
                                            monthly; USGS revises historical
                                            windows) and the committed snapshot
                                            stays canonical for gold derivation.
  python3 scripts/fetch_data.py --refresh   re-download into data/raw/<name>/,
                                            update provenance.json, and print a
                                            reminder to re-run derive_pairs.py.
  python3 scripts/fetch_data.py --dry-run   print the pinned URLs and exit.

The committed snapshots are the canonical input to scripts/derive_pairs.py;
--refresh intentionally changes the bytes under gold derivation and must be
followed by regenerating and re-reviewing data/gold/pairs.jsonl.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE.parent / "data"

# Pinned sources. Licence evidence for each lives in data/raw/<name>/LICENCE.
SOURCES = {
    "usgs-earthquakes": (
        "https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv"
        "&starttime=2026-09-01&endtime=2026-09-08&minmagnitude=2.5&orderby=time-asc"
    ),
    "nasa-exoplanets": (
        "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=SELECT%20TOP%203000%20"
        "pl_name,hostname,sy_snum,sy_pnum,discoverymethod,disc_year,pl_orbper,pl_rade,"
        "pl_bmasse,pl_eqt,st_teff,st_rad,st_mass,ra,dec%20FROM%20pscomppars%20"
        "ORDER%20BY%20pl_name%20ASC&format=csv"
    ),
    "gapminder": (
        "https://raw.githubusercontent.com/jennybc/gapminder/master/inst/extdata/gapminder.tsv"
    ),
}

FILENAMES = {
    "usgs-earthquakes": "usgs-earthquakes.csv",
    "nasa-exoplanets": "nasa-exoplanets.csv",
    "gapminder": "gapminder.tsv",
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "xerj-ask-plan-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = resp.read()
    dest.write_bytes(body)
    return len(body)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true", help="verify committed sha256 (default)")
    g.add_argument("--refresh", action="store_true", help="re-download and update provenance")
    g.add_argument("--dry-run", action="store_true", help="print pinned URLs")
    args = ap.parse_args()

    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    for name, url in SOURCES.items():
        d = DATA / "raw" / name
        f = d / FILENAMES[name]
        meta = d / "provenance.json"
        if args.dry_run:
            print(f"{name}: {url}")
            continue
        if args.refresh:
            d.mkdir(parents=True, exist_ok=True)
            try:
                size = download(url, f)
            except Exception as e:  # noqa: BLE001 — report and keep going
                print(f"REFRESH FAILED {name}: {e}")
                continue
            record = {
                "dataset": name,
                "url": url,
                "file": f.name,
                "sha256": sha256(f),
                "bytes": size,
                "fetched_utc": now,
                "licence": f"LICENCE (in this directory)",
            }
            meta.write_text(json.dumps(record, indent=1) + "\n")
            print(f"refreshed {name}: {size} bytes sha256={record['sha256'][:16]}…")
            print(f"  REMINDER: re-run scripts/derive_pairs.py and re-review data/gold/")
            continue
        # --check (default)
        if not f.exists() or not meta.exists():
            print(f"MISSING {name}: {f} or {meta} absent")
            sys.exit(2)
        rec = json.loads(meta.read_text())
        actual, recorded = sha256(f), rec["sha256"]
        if actual == recorded:
            print(f"ok       {name} sha256={actual[:16]}… (as fetched {rec['fetched_utc']})")
        else:
            print(f"DRIFT    {name}: committed={actual[:16]}… provenance={recorded[:16]}…")
            print("  upstream moved since the snapshot was taken; the COMMITTED bytes")
            print("  remain canonical for gold derivation. --refresh to adopt the new copy.")
    if not args.dry_run and not args.refresh:
        print("(drift, if any, is informational; nothing was measured)")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/ask-plan/scripts/latency_arm.py`
```
#!/usr/bin/env python3
"""latency_arm.py — the /_ask latency arm of the ask-plan harness.

Measures the release-time latency gate of #1056: "p50 <= 300 ms CPU budget"
per POST /_ask. run.sh's ask arm times every call but scores F1 only — this
arm records the milliseconds.

Honest scope, stated up front:

- The gate line says CPU budget; what is measurable from outside the process
  is WALL-CLOCK over loopback HTTP on an otherwise idle node. On a loopback
  connection against a single-node server the transport overhead is well
  under a millisecond, so wall-clock p50 is a faithful upper bound on CPU
  time per request — but it is wall-clock, and the summary says so.
- Prompts are sent with their gold `index` (exactly like the ask arm), so
  catalog routing is NOT in the measured path. Routing has its own acceptance
  line in #1056 and is not this arm's claim.
- One warmup pass runs before the measured passes and its distribution is
  reported separately. First-touch requests pay page-cache and allocator
  setup that a serving node has long since paid; the gate is about the
  steady state, and hiding warmup would flatter the number — reporting both
  keeps the choice visible instead.
- Deterministic: pairs.jsonl order, no shuffling, no sampling. Every prompt
  in every pass is recorded raw.

Usage (boot + load first, as run.sh does):
  XERJ_URL=http://127.0.0.1:9610 python3 scripts/ask_arm.py load
  XERJ_URL=... python3 scripts/latency_arm.py --out DIR [--passes 3]
"""
import argparse
import json
import os
import pathlib
import platform
import time
import urllib.request

from ask_arm import pairs, req  # noqa: E402 — same-process helpers, same env

U = os.environ.get("XERJ_URL", "http://127.0.0.1:9610").rstrip("/")

GATE_MS = 300.0  # #1056's release-time line: "p50 <= 300 ms CPU budget"


def ask_ms(prompt, index):
    body = json.dumps({"index": index, "prompt": prompt})
    t0 = time.perf_counter()
    code, _ = req("POST", "/_ask", body, timeout=300)
    return code, (time.perf_counter() - t0) * 1000.0


def one_pass(records, tag):
    """Every pair once, in file order; per-request ms appended raw."""
    codes = {}
    for p in pairs():
        code, ms = ask_ms(p["prompt"], p["gold"]["index"])
        codes[code] = codes.get(code, 0) + 1
        records.append({"pass": tag, "id": p["id"], "http": code, "ms": ms})
    return codes


def stats(values):
    """Count/mean/p50/p90/p95/p99/max — the quantile is the nearest-rank
    interpolation-free form (sorted[floor(q*(n-1))]), so the same raw list
    reproduces the same number anywhere."""
    if not values:
        return {"n": 0}
    s = sorted(values)

    def at(q):
        return s[int(q * (len(s) - 1))]

    return {
        "n": len(s),
        "mean_ms": round(sum(s) / len(s), 3),
        "p50_ms": round(at(0.50), 3),
        "p90_ms": round(at(0.90), 3),
        "p95_ms": round(at(0.95), 3),
        "p99_ms": round(at(0.99), 3),
        "max_ms": round(s[-1], 3),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True, help="run directory for raw + summary")
    ap.add_argument("--passes", type=int, default=3, help="measured passes (default 3)")
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # Endpoint presence — the same honest stopping point the ask arm has.
    code, _ = req("POST", "/_ask", json.dumps({"index": "ax-usgs-earthquakes",
                                               "prompt": "probe: every event"}), timeout=300)
    if code in (404, 405, 501):
        (out / "status.json").write_text(json.dumps(
            {"endpoint": "POST /_ask", "http": code, "measured": False,
             "note": "POST /_ask is not implemented; nothing measured"}, indent=1) + "\n")
        print(f"POST /_ask -> {code}: not implemented; nothing measured")
        return 0

    all_pairs = pairs()
    records = []
    warm_codes = one_pass(records, "warmup")
    measured_codes = {}
    for i in range(max(1, args.passes)):
        for k, v in one_pass(records, f"measured-{i + 1}").items():
            measured_codes[k] = measured_codes.get(k, 0) + v

    with open(out / "latency-raw.jsonl", "w") as fh:
        for r in records:
            fh.write(json.dumps(r) + "\n")

    warm_ms = [r["ms"] for r in records if r["pass"] == "warmup" and r["http"] == 200]
    measured_ms = [r["ms"] for r in records if r["pass"].startswith("measured")
                   and r["http"] == 200]
    p50 = stats(measured_ms)["p50_ms"] if measured_ms else None
    summary = {
        "endpoint": "POST /_ask",
        "measured": True,
        "pairs_per_pass": len(all_pairs),
        "measured_passes": max(1, args.passes),
        "http_counts": {"warmup": warm_codes, "measured": measured_codes},
        "warmup": stats(warm_ms),
        "measured_pooled": stats(measured_ms),
        "gate": {"line": "#1056 release gate: p50 <= 300 ms", "threshold_ms": GATE_MS,
                 "p50_ms": p50,
                 "pass": (p50 is not None and p50 <= GATE_MS)},
        "method_notes": [
            "wall-clock over loopback HTTP on an idle node, not in-process CPU "
            "time — an upper bound on the CPU budget, stated as wall-clock",
            "gold `index` sent with every prompt: catalog routing is not in "
            "the measured path (own acceptance line in #1056)",
            "one warmup pass reported separately from the measured passes",
            "quantiles are nearest-rank over the pooled measured passes; "
            "latency-raw.jsonl carries every request",
        ],
        "host": {"system": platform.system(), "release": platform.release(),
                 "machine": platform.machine(),
                 "python": platform.python_version()},
    }
    (out / "latency-summary.json").write_text(json.dumps(summary, indent=1) + "\n")
    print(json.dumps(summary["measured_pooled"]))
    print(f"gate p50 <= {GATE_MS} ms: {'PASS' if summary['gate']['pass'] else 'FAIL'}"
          f" (p50 = {p50} ms)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `benchmarks/ask-plan/scripts/verify_pairs.py`
```
#!/usr/bin/env python3
"""verify_pairs.py — static checks on data/gold/pairs.jsonl. Exit 1 on any.

STATUS: DESIGN, NOTHING MEASURED. This verifies evaluation *inputs*: schema,
count, derivability from the raw data, and DSL shapes. It runs no engine and
scores nothing. Use it in CI next to derive_pairs.py --check.

Checks:
  1. JSONL parses; every line has exactly the keys
     {id, dataset, index_hint, prompt, gold:{index, doc_ids, query_equivalent}}.
  2. Pair count >= MIN_PAIRS (the #1056 gate needs >= 200).
  3. ids unique; index_hint == gold.index == "ax-<dataset>"; datasets known.
  4. doc_ids sorted, unique, non-empty, and EVERY id exists in the raw
     snapshot's id space (usgs `id`, exoplanet `pl_name`, gapminder
     "<country>-<year>") — gold that references rows not in the raw data is
     the classic silent fixture rot.
  5. query_equivalent uses only leaves xerj-query parses (term / range /
     bool.filter), with ranges carrying at least one bound.
  6. derive_pairs.py --check passes (file is byte-identical to what the
     committed raw snapshots produce — no hand-edits, no stale gold).
"""
import csv
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
GOLD = HERE.parent / "data" / "gold" / "pairs.jsonl"
RAW = HERE.parent / "data" / "raw"
MIN_PAIRS = 200

ALLOWED_LEAVES = {"term", "range", "bool"}


def raw_ids(dataset):
    if dataset == "usgs-earthquakes":
        return {r["id"] for r in csv.DictReader(open(RAW / dataset / "usgs-earthquakes.csv"))}
    if dataset == "nasa-exoplanets":
        return {r["pl_name"] for r in csv.DictReader(open(RAW / dataset / "nasa-exoplanets.csv"))}
    if dataset == "gapminder":
        return {f"{r['country']}-{r['year']}"
                for r in csv.DictReader(open(RAW / dataset / "gapminder.tsv"), delimiter="\t")}
    raise SystemExit(f"unknown dataset {dataset}")


def check_query(q, where):
    if not isinstance(q, dict) or len(q) != 1:
        raise AssertionError(f"{where}: query_equivalent must be a single-key object, got {q!r}")
    leaf = next(iter(q))
    if leaf not in ALLOWED_LEAVES:
        raise AssertionError(f"{where}: unsupported leaf {leaf!r} (allowed: {sorted(ALLOWED_LEAVES)})")
    body = q[leaf]
    if leaf == "bool":
        if set(body) - {"filter"}:
            raise AssertionError(f"{where}: only bool.filter is used by this fixture, got {sorted(body)}")
        for sub in body["filter"]:
            check_query(sub, where)
    elif leaf == "range":
        for field, bounds in body.items():
            if not set(bounds) & {"gt", "gte", "lt", "lte"}:
                raise AssertionError(f"{where}: range on {field} has no bound")
    else:  # term
        for field, value in body.items():
            if not isinstance(value, (str, int, float, bool)):
                raise AssertionError(f"{where}: term on {field} has non-scalar value {value!r}")


def main():
    id_spaces = {d: raw_ids(d) for d in ("usgs-earthquakes", "nasa-exoplanets", "gapminder")}
    seen_ids = set()
    n = 0
    for line in GOLD.read_text().splitlines():
        n += 1
        where = f"line {n}"
        p = json.loads(line)
        assert set(p) == {"id", "dataset", "index_hint", "prompt", "gold"}, f"{where}: keys {sorted(p)}"
        g = p["gold"]
        assert set(g) == {"index", "doc_ids", "query_equivalent"}, f"{where}: gold keys {sorted(g)}"
        assert p["id"] not in seen_ids, f"{where}: duplicate id {p['id']}"
        seen_ids.add(p["id"])
        assert p["dataset"] in id_spaces, f"{where}: unknown dataset"
        assert p["index_hint"] == g["index"] == f"ax-{p['dataset']}", f"{where}: index mismatch"
        assert isinstance(p["prompt"], str) and p["prompt"].strip(), f"{where}: empty prompt"
        docs = g["doc_ids"]
        assert docs and docs == sorted(docs) and len(docs) == len(set(docs)), \
            f"{where}: doc_ids must be non-empty, sorted, unique"
        unknown = set(docs) - id_spaces[p["dataset"]]
        assert not unknown, f"{where}: {len(unknown)} doc_ids not in raw data, e.g. {sorted(unknown)[:3]}"
        check_query(g["query_equivalent"], where)

    print(f"ok: {n} pairs pass schema + raw-data + DSL checks")
    if n < MIN_PAIRS:
        print(f"::error::ask-plan: {n} pairs < the {MIN_PAIRS}-pair gate")
        return 1

    r = subprocess.run([sys.executable, str(HERE / "derive_pairs.py"), "--check"],
                       capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip())
        return 1
    print("verified inputs only — no engine was run, nothing was measured")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `benchmarks/autoindex-resilience/summarize.py`
```
#!/usr/bin/env python3
"""Summarize an `xerj autoindex --progress plain` stderr capture.

Every number in this folder's README — and in the docs pages that cite it — is
produced by this script from a raw capture committed beside it, so none of them
is hand-copied:

    python3 summarize.py > results.json   # the four complete captures in CAPTURES
    python3 summarize.py --check          # results.json is what the captures produce

A capture is summarized as: the ordered list of phases with how many
`xerj-progress` lines each emitted, the time spent in each, how the last line of
each phase read (pct / eta_quality / since_progress_s), and the terminal
`xerj-done` line parsed into fields. Standard library only.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Complete, untrimmed captures only: a trimmed one would under-count its phases.
CAPTURES = [
    "before-rc74.stderr.txt",
    "slice-rc74.stderr.txt",
    "slice-after.stderr.txt",
    "after-955.full-corpus-resume.stderr.txt",
]


def fields(line):
    out = {}
    for pair in line.split()[1:]:
        key, sep, value = pair.partition("=")
        if sep:
            out[key] = value
    return out


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def summarize(path):
    phases = []
    done = None
    refused = []
    error = None
    with open(path, encoding="utf-8", errors="replace") as handle:
        for raw in handle:
            line = raw.rstrip("\n")
            if line.startswith("xerj-progress "):
                f = fields(line)
                if not phases or phases[-1]["phase"] != f.get("phase"):
                    phases.append({"phase": f.get("phase"), "lines": 0, "first": f, "last": f})
                phases[-1]["lines"] += 1
                phases[-1]["last"] = f
            elif line.startswith("xerj-done "):
                done = fields(line)
            elif "REFUSED by the server" in line:
                refused.append(line.strip())
            elif line.startswith("error:"):
                error = line
    out_phases = []
    for p in phases:
        last = p["last"]
        out_phases.append({
            "phase": p["phase"],
            "progress_lines": p["lines"],
            "items": last.get("items"),
            "bytes": last.get("bytes"),
            "basis": last.get("basis"),
            "last_pct": last.get("pct"),
            "last_eta_quality": last.get("eta_quality"),
            "last_since_progress_s": number(last.get("since_progress_s")),
            "phase_elapsed_s": number(last.get("phase_elapsed_s")),
        })
    # The symptom of #931, measured rather than asserted: progress lines that
    # claim a finished scan (pct=100.0) while calling the run stalled.
    stalled_scan = 0
    longest_scan_silence = 0.0
    with open(path, encoding="utf-8", errors="replace") as handle:
        for raw in handle:
            if not raw.startswith("xerj-progress "):
                continue
            f = fields(raw)
            if f.get("phase") == "scan" and f.get("pct") == "100.0" and f.get("eta_quality") == "stalled":
                stalled_scan += 1
                longest_scan_silence = max(longest_scan_silence, number(f.get("since_progress_s")) or 0.0)
    return {
        "capture": os.path.basename(path),
        "phases_in_order": [p["phase"] for p in out_phases],
        "phases": out_phases,
        "scan_lines_at_100pct_reading_stalled": stalled_scan,
        "longest_since_progress_s_while_scan_read_100pct": longest_scan_silence,
        "refusals_announced": len(refused),
        "done": done,
        "error_line_head": (error[:240] if error else None),
    }


def build(paths):
    return {"captures": [summarize(p) for p in paths]}


def main(argv):
    if argv[1:] == ["--check"]:
        expected = build([os.path.join(HERE, name) for name in CAPTURES])
        with open(os.path.join(HERE, "results.json"), encoding="utf-8") as handle:
            committed = json.load(handle)
        if committed != expected:
            print("results.json is stale: re-run summarize.py", file=sys.stderr)
            return 1
        print("results.json matches the committed captures")
        return 0
    paths = argv[1:] or [os.path.join(HERE, name) for name in CAPTURES]
    json.dump(build(paths), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

```

### Core Architecture Module: `benchmarks/beir-hybrid/eval.py`
```
"""nDCG@10 on BEIR SciFact (test split) for retrieval arms on a live XERJ node.
Every number printed comes from a query against the node; nothing is assumed."""
import json, math, sys, time, urllib.request, collections
import os
U=os.environ.get("XERJ_URL","http://localhost:9410"); IDX=sys.argv[2] if len(sys.argv)>2 else "scifact"; WINDOW=int(sys.argv[1]) if len(sys.argv)>1 else 30
def post(p,b):
    r=urllib.request.Request(U+p,data=json.dumps(b).encode(),method="POST",headers={"content-type":"application/json"})
    try: return json.loads(urllib.request.urlopen(r,timeout=120).read())
    except urllib.error.HTTPError as e: return {"_err":e.code,"body":e.read().decode()[:300]}
queries={}
for l in open(IDX+"/queries.jsonl"):
    d=json.loads(l); queries[d["_id"]]=d["text"]
qrels=collections.defaultdict(dict)
for i,l in enumerate(open(IDX+"/qrels/test.tsv")):
    if i==0: continue
    q,d,s=l.split("\t"); qrels[q][d]=int(s)
def ndcg10(ranked,rel):
    dcg=sum(rel.get(d,0)/math.log2(i+2) for i,d in enumerate(ranked[:10]))
    ideal=sorted(rel.values(),reverse=True)[:10]
    idcg=sum(g/math.log2(i+2) for i,g in enumerate(ideal))
    return dcg/idcg if idcg else 0.0
def ids(res): return [h["_id"] for h in res.get("hits",{}).get("hits",[])]
BM=lambda q:{"multi_match":{"query":q,"fields":["title","text"]}}
SEM=lambda q:{"semantic":{"field":"body","query":q}}
def bm25(q,n=100): return ids(post(f"/{IDX}/_search",{"size":n,"_source":False,"query":BM(q)}))
def sem(q,n=100):  return ids(post(f"/{IDX}/_search",{"size":n,"_source":False,"query":SEM(q)}))
def hybrid(q,n=100):
    return ids(post(f"/{IDX}/_search",{"size":n,"_source":False,"query":{"hybrid":{"queries":[{"query":BM(q)},{"query":SEM(q)}],"fusion":"rrf"}}}))
def rerank_window(q,w):
    """BM25 top-w, reordered by the embedding score; the tail keeps BM25 order."""
    base=bm25(q,100); win=base[:w]
    r=post(f"/{IDX}/_search",{"size":w,"_source":False,"query":{"bool":{"must":[SEM(q)],"filter":[{"ids":{"values":win}}]}}})
    order=ids(r)
    if "_err" in r: raise SystemExit(f"filtered semantic failed: {r}")
    seen=set(order); return order+[d for d in win if d not in seen]+base[w:]
arms={"bm25":bm25,"minilm (vector only)":sem,"hybrid rrf (server)":hybrid,f"bm25 top-{WINDOW} -> minilm rerank":lambda q:rerank_window(q,WINDOW)}
probe=post(f"/{IDX}/_search",{"size":1,"query":SEM("test")})
if "_err" in probe: raise SystemExit(f"semantic arm unavailable: {probe}")
print(f"queries={len(qrels)}  docs={post(f'/{IDX}/_count',{}).get('count')}")
for name,fn in arms.items():
    t=time.time(); scores=[]; empty=0; lat=[]
    for qid,rel in qrels.items():
        t0=time.time(); ranked=fn(queries[qid]); lat.append(time.time()-t0)
        if not ranked: empty+=1
        scores.append(ndcg10(ranked,rel))
    lat.sort()
    print(f"{name:34s} nDCG@10={sum(scores)/len(scores):.4f}  empty={empty:3d}  p50={lat[len(lat)//2]*1000:6.1f}ms  p95={lat[int(len(lat)*.95)]*1000:6.1f}ms")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1031** (2026-09-30): **autoindex: a source file that grows mid-run (append-only log) kills the run, is misclassified as a bulk/backend failure, and the retry advice points at the wrong fix**
  *Symptoms*: User report (maxwhy, 2026-09-26), verbatim:  ``` error: autoindex stopped with bulk/backend failures: /Users/maxwhy/dev/true-inventory/audit.jsonl changed size during autoindex (expected 143882, now 148201); retry the run. Failed source files were not journaled complete; fix the reported server or embedding configuration and rerun the same command to resume safely ```  `audit.jsonl` is an append-only audit log. Growing while something reads it is its **normal behavior**, not an error condition — and this failure mode will hit anyone pointing autoindex at any live log, outbox, or export-on-a-timer directory. Three things are wrong with how we handle it:  1. **The whole run aborts.** The size guard (`engine/crates/xerj-autoindex/src/content.rs:195`) is correct to exist, but a mutated source currently costs the run: already-completed files' progress is not journaled complete for this class (`engine/crates/xerj-autoindex/src/lib.rs:7536`), so the rerun redoes work. Cheap at 148 KB; brutal at #948 mailbox scale. 2. **Misclassified and mis-advised.** The failure is bucketed under "bulk/backend failures" and the user is told to "fix the reported server or embedding configuration" — nothing is wrong with either. That advice sends the user debugging the wrong layer. (The sync path has the sibling message: `sync_executor.rs:1590`.) 3. **No resumable cut.** Nothing journals *which prefix* was consistent, so a rerun has no delta to resume from.  ## Fix shape (proposal — discussion welcom
  **Post-Mortem & Fix Analysis**:
  > Closing as **deferred, not fixed**. The defect stands exactly as reported: a source file that grows during an autoindex run (the normal behaviour of an append-only log) aborts the run, is misclassified as a bulk/backend failure, and the retry advice points at the wrong fix.  Deferred by maintainer decision 2026-09-29 rather than scheduled; the status is recorded in ROADMAP.md's defect record. The original repro (maxwhy's `audit.jsonl`, 2026-09-26) is in the issue body — reopen or re-file with it if this bites again.

- **Issue #1028** (2026-09-26): **llms.txt: "Not implemented" lists rerank, share links and mbox as not on main; #948 still presented as open after #1002**
  *Symptoms*: > Drafted by an AI coding agent (Claude Code, Claude Opus 5.5) on behalf of @Vinz2168, who reviewed it before filing.  ## What is wrong  `https://xerj.org/llms.txt` — the file agents read first — says three shipped features are not on `main`, and still describes #948 as open although #1002 fixed it. Agents told "do not plan around these" will skip features that work.  The live file is byte-identical to `landing/llms.txt` at `main` `fa27e936` (2026-09-24). Line numbers below refer to that file. Lines 50 and 53 are hand-written (they sit outside the `BEGIN/END GENERATED ARTICLE TREE` markers at lines 86 and 236), so `build_articles.py` will not correct them.  ### 1. The "Not implemented" bullet contradicts the rest of the file and `main`  [Line 50](https://github.com/xerj-org/xerj/blob/fa27e936/landing/llms.txt#L50) (last touched in #942, 2026-09-19):  > A rerank stage, share links, `mbox`/Takeout ingest: in flight on branches, not on `main`.  All three merged on 2026-09-20 and have shipped in a release since rc.75:  | Feature | Merged | On `main` | Documented as usable in the same file | |---|---|---|---| | rerank stage | #946 (`aaeae25c`) | `engine/crates/xerj-api/src/rerank_stage.rs`, `docs/RERANK.md` | L45 (caveat), L73, L74, L161–162 | | share links | #947 (`01d0044d`) | `xerj share` dispatch at `engine/crates/xerj-server/src/main.rs:1995`, `docs/SHARING.md` | L79, L203–205, L243 | | mbox / Takeout | #949 (`51d4b66a`, in `v1.0.0-rc.75`) | `engine/crates/xerj-autoindex/src/

- **Issue #1013** (2026-09-21): **delete_by_query (any long search) 500s under sustained ingest: seqlock reader starvation — "search could not complete within one stable collection generation"**
  *Symptoms*: ## What happened  While measuring #950 (heap-profile of corpus ingest), the first run aborted mid-index-phase and the cleanup `POST /<index>/_delete_by_query` failed:  ``` error: delete_by_query: HTTP 500 Internal Server Error: internal_server_error_exception: internal error: search could not complete within one stable collection generation before its deadline ```  (`/root/950-run.log:1319`, run of 2026-09-20; node under full bulk ingest — `xerj autoindex` on a ~1 GB / 85k-file corpus, 32 index workers, `--bulk-mb 8`.)  ## Mechanism  `CollectionPublication` is a seqlock: a reader is only **admitted** when no writer is in flight, and its capture is only **valid** if no writer began at any point during the read (`engine/crates/xerj-engine/src/collection_publication.rs:98-126` — `try_admit_reader` requires `in_flight == 0`; `validate_reader` requires `in_flight == 0 && generation == token.generation`; every `begin()` and every guard `Drop` bumps the generation).  The writer guard is held across the **entire flush finalize** — memtable drain, segment write, FTS sidecar build, publish — inside the blocking worker (`engine/crates/xerj-engine/src/index.rs:29986`, commit/drop at `:30389`), and concurrent flushes are explicitly allowed (`index.rs:29989-29992`).  `search()` retries admission+validation until the request deadline, then errors (`engine/crates/xerj-engine/src/index.rs:17521-17561`; `delete_by_query` rides the same loop via `index.rs:17500-17507`).  Under sustained ingest:
  **Post-Mortem & Fix Analysis**:
  > Fix posted in #1014 (fail-before churn test included: old code dies at its deadline with this issue's exact 500 message, new code converges in 0.37 s with exact totals; ES-YAML 1376/0). The latency follow-up — shrinking the flush guard to a ms-scale bracket around the install — is now #1015.

- **Issue #940** (2026-09-21): **hybrid RRF orders tied fused scores by HashMap iteration: top-10 differs for 21 of 40 queries after a restart on unchanged data**
  *Symptoms*: ## Summary  `hybrid` with `fusion: "rrf"` orders documents with an equal fused score by `HashMap` iteration order. The same request against the same data returns a different ranking after the node is restarted: on BEIR SciFact, **32 of 40 queries changed order and 21 of 40 changed their top 10**, with identical hit sets. Rank 1 itself can flip.  Ties are not an edge case under RRF — they are structural. A document found only by the BM25 leg at rank *r* and a document found only by the vector leg at rank *r* both score exactly `1/(k+r)`; two documents found by both legs at swapped ranks (1,2)/(2,1) both score `1/61 + 1/62`. Every rank position is a potential tie.  It is also why the project's own quality number moves between runs: the SciFact hybrid nDCG@10 measured 0.6993 in one run and 0.7023 in another on the same index (NFCorpus: 0.3448 / 0.3446), while the BM25-only and vector-only arms reproduced to four decimals (0.6572 / 0.6764).  Reproduced on the `v1.0.0-rc.74` release binary, `--embed-mode neural`; `fuse_rrf` is unchanged on `main` @ 4d8dadbf.  ## Repro  ```sh cd benchmarks/neural-path-triage python3 rrf_stability.py save    http://localhost:9560 scifact /path/to/beir/scifact 40 before.json # stop the node, start it again on the SAME data directory — no writes in between python3 rrf_stability.py save    http://localhost:9560 scifact /path/to/beir/scifact 40 after.json python3 rrf_stability.py compare before.json after.json ```  Literal output ([`rrf-stability-scifac

- **Issue #939** (2026-09-21): **semantic/hybrid over multi-passage documents is an exact scan that deep-clones every _source per query: ~410 ms p50 on 5,183 docs, of which the BERT forward pass is ~14 ms**
  *Symptoms*: ## Summary  On a 5,183-document index, a `semantic` query costs **~430 ms p50** and `hybrid` (BM25 + semantic, RRF) **~540 ms p50**, against **11 ms** for BM25 on the same index. The BERT forward pass for the query is **12–19 ms** of that. The rest is the exact vector scan, and almost none of the scan is arithmetic:  | phase (p50, ms) | semantic, unfiltered | semantic + `ids` filter (30 docs) | hybrid rrf | |---|---|---|---| | embed the query (MiniLM forward pass) | 14 | 12 | 19 | | **collect** — load every stored document | **216** | **197** | **331** | | **score** | **107** | **105** (30 docs scored) | **106** | | top-k + hits | 67 | 0 | 75 | | request total | 410 | 317 | 542 | | documents scored | 5,183 | 30 | 5,183 |  The same query shape on a 10,003-document index of one-sentence documents is **16 ms p50**: 12 ms embed, 2–3 ms for the HNSW search and hydrate, 0 of 37 requests on the exact scan.  So this is not "BERT is slow on CPU" and it is not "hybrid runs its legs serially" (it does — see below — but the BM25 leg is ~10 ms). It is that **any `semantic_text` index containing a multi-chunk document is pinned to an exact scan, and the exact scan deep-clones every stored `_source`, vectors included, on every query — before the filter is applied.**  Measured on the `v1.0.0-rc.74` release binary, `--embed-mode neural` (all-MiniLM-L6-v2, CPU), BEIR SciFact, on a shared 32-thread box with load average 16–23 from other jobs, so treat absolute milliseconds as conservative; the 

- **Issue #938** (2026-09-21): **Neural ingest keeps ~3.4 of 32 threads busy: 6.1 docs/s from one _bulk stream, 29.5 docs/s from 8 clients for the same CPU-seconds (forward passes run single-file)**
  *Symptoms*: ## Summary  With `--embed-mode neural` (all-MiniLM-L6-v2, Candle, CPU), one `_bulk` stream into a `semantic_text` field runs at **6.1 documents/s** on SciFact abstracts (mean 1,470 characters ≈ 3.9 passages each) while the server keeps **3.4 of 32 hardware threads busy**. Short one-sentence documents (the same corpus's titles only: mean 96 characters, one passage) run at 88 documents/s through the same path with 2.7 threads busy. The gap between the two is just passages × tokens; the defect is the 3.4 and the 2.7.  The engine is not the bottleneck and neither is the model's raw cost. The encoder alone, fed the same passages, does 31.1 passages/s with 3.5 cores busy — the end-to-end rate (6.1 docs/s × 3.86 passages = 23.5 passages/s) is within 25% of it. And the same node does **29.5 documents/s — 4.8× — when eight clients send `_bulk` concurrently, for the same total CPU** (226 → 213 CPU-seconds). The work is fixed; one stream simply never occupies the machine.  Measured on the `v1.0.0-rc.74` release binary and on `xerj-ai` built from `main` @ 4d8dadbf (`git diff v1.0.0-rc.74..main` does not touch `xerj-ai` or the bulk embedding path). AMD Ryzen AI Max+ 395, 16 cores / 32 threads, **shared with other jobs at load average 18–31 for every run below** — absolute rates are therefore conservative and noisy; CPU-seconds and cores-busy are the robust columns.  ## Measurements  End-to-end, `_bulk` of 50 documents into `{"body": {"type": "semantic_text"}}`, 400 SciFact documents per p
  **Post-Mortem & Fix Analysis**:
  > Slice 1 landed on main (PR #995, merge 4985f931): neural_window_concurrency config key + bounded window scheduler — measured 2.8x from one _bulk stream at the same CPU-seconds (14.1 -> 39.1 docs/s in-sandbox, harness in benchmarks/neural-path-triage/window_concurrency_bench.py). Remaining: slice 2 (Candle intra-op pinning) and slice 3 (cross-request pool sharing + non-serial default). Issue stays open for those.

- **Issue #937** (2026-09-21): **A declared analyzer stops applying at _flush: analysis.analyzer.default is memtable-only, a per-field analyzer is accepted and ignored, an unknown analyzer name is accepted**
  *Symptoms*: ## Summary  An index can declare an analyzer three ways. On `main` none of them survives to a segment:  | declaration | memtable (before flush) | segment (after flush) | |---|---|---| | `settings.analysis.analyzer.default` (custom or built-in `english`) | **honoured** | **dropped** — segment is written and queried with `standard` | | `"analyzer": "<name>"` on a `text` field in the mapping | ignored | ignored | | `"analyzer": "no_such_analyzer"` on a field | accepted, `200 acknowledged` | — |  So the same `match` query returns a different hit set before and after `_flush`, with no error and no log, and a per-field analyzer is accepted, echoed back by `GET _mapping`, and applied to nothing. That is the accepted-and-ignored class from #204, on the surface the #204 sweep itself worked on: the sweep fixed the create-time gate and the memtable binding; the segment writer still hard-codes `standard`.  `_analyze` cannot be used to see any of this, because it is a separate inline tokenizer: it ignores `field`, and `analyzer: "english"` falls through to the unstemmed default.  Reproduced on the `v1.0.0-rc.74` release binary. `git diff v1.0.0-rc.74..main` touches nothing under `xerj-engine/src`, `xerj-fts/` or the `_analyze` handler, and every code pointer below is from `main` @ 4d8dadbf.  ## Repro  Private port, throwaway data dir, `--insecure`. The script creates and deletes four `an_*` indices.  ```sh U=http://localhost:9560; H='content-type: application/json' hits(){ curl -s -XPOST 

- **Issue #933** (2026-09-21): **autoindex --no-graph: index phase applies one file at a time — about 6 files/s, ~3.5 h for a 48,533-file corpus**
  *Symptoms*: ### What happens  On the durable `--no-graph` path, the `index` phase applies one file at a time, and on a large code corpus that is slow enough to decide whether the path is usable: **about 6 files/s, with an honest ETA of about 3.5 hours for the index phase alone** on a 48,533-file / 521 MB reference corpus.  This was invisible before #931 — the stream said `phase=scan pct=100.0 eta_quality=stalled` for this whole period, so nobody could see how long indexing took or that it was progressing at all. With the phase reported properly, the number is simply there to read.  ### Measurement (2026-09-18, branch `fix/autoindex-resilience`, throwaway node, lexical embedder, 32 cores, machine shared with other builds)  ```sh xerj autoindex ~/.xerj-code/corpora/xerj-search \   --url http://localhost:9540 --prefix xc-xerj-search --no-graph \   --state-dir ./state-fix-1 --progress plain --yes ```  ```text xerj-progress phase=index basis=bytes pct=5.7 items=3120/47444 bytes=62161636/1099789983 rate=82701.2 eta_s=12546.7 eta_quality=rough since_progress_s=0.0 phase_elapsed_s=513.9 elapsed_s=825.0 ```  3,120 files in 513.9 s = 6.1 files/s, roughly 165 ms per file. For comparison, the phases before it on the same run: `prepare` (1,526 datasets) about 17 s, `snapshot` (sealing 521 MB) about 5 minutes.  ### Where the time goes (measured, not inferred)  `replay_pending_operations` (`engine/crates/xerj-autoindex/src/sync_executor.rs`) is a serial loop: `Started` journal record, `apply`, `Committ

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

### Incident Patch 1: `8d327982` (2026-09-30)
**Commit Message**: rebase fixup: stem_default_tests FieldSpec initializer gains num_min/num_max

Both #1070 (stemming, main) and #1074 (xerj_map, this branch) add code that
constructs or extends infer::FieldSpec; the textual merge left #1070's test
initializer without the two fields #1074 added, which cargo check catches
(E0063) but git cannot. Compile-verified with cargo check -p xerj-autoindex
--all-targets.

**File**: `engine/crates/xerj-autoindex/src/lib.rs` (modified, +2/-0)
```diff
@@ -10012,6 +10012,8 @@ mod stem_default_tests {
             date_min: None,
             date_max: None,
             date_evidence: vec![],
+            num_min: None,
+            num_max: None,
         };
         PlanDataset {
             slug: slug.into(),
```

---

### Incident Patch 2: `d3ff514f` (2026-09-30)
**Commit Message**: rebase fixup: union with #1076's xerj_plan — thirteen tools

#1074 (xerj_map) and #1076 (xerj_plan, merged) both extended xerj-mcp: the
tool table, the dispatch match, HELP_BODY's list, mcp-tools.json and the
count test. The textual rebase merged the JSON and the list cleanly but
left #1076's count assertions and prose at twelve. Resolution is the union:

- tools_list_has_all_twelve -> tools_list_has_all_thirteen (13 specs: the
  12 from main incl. xerj_plan, plus xerj_map; list already had both names)
- module doc, HELP_BODY and tool_specs doc now say thirteen
- xerj-mcp tests: 70 passed / 0 failed (incl. published_schema_drift on
  the union mcp-tools.json, which carries both xerj_map and xerj_plan)

Verified locally with cargo test -p xerj-mcp; cargo fmt applied.

**File**: `engine/crates/xerj-autoindex/src/catalog.rs` (modified, +2/-0)
```diff
@@ -822,6 +822,8 @@ mod sample_query_tests {
             date_min: None,
             date_max: None,
             date_evidence: vec![],
+            num_min: None,
+            num_max: None,
         }
     }
 
```

**File**: `engine/crates/xerj-autoindex/src/infer/mod.rs` (modified, +119/-0)
```diff
@@ -330,6 +330,19 @@ pub struct FieldSpec {
     pub date_max: Option<String>,
     #[serde(default, skip_serializing_if = "Vec::is_empty")]
     pub date_evidence: Vec<String>,
+    /// Sampled integer range of a `long` field (#1055). `FieldAcc` has held
+    /// `int_min`/`int_max` since the beginning; the spec never exposed them.
+    /// `#[serde(default)]` because every catalog and state file written before
+    /// this field lacks it, and those must keep deserializing.
+    ///
+    /// Deliberately `None` on `double` fields: the accumulator only tracks the
+    /// i64-parseable subset, so on a fractional column these would be the
+    /// range of the integers *within* it — a wrong range stated as fact. An
+    /// absent range is honest; a partial one is not.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub num_min: Option<i64>,
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub num_max: Option<i64>,
 }
 
 fn p95(samples: &[u32]) -> u32 {
@@ -450,6 +463,8 @@ pub fn infer_fields_with_policy(
             date_min: acc.date_min.map(|d| dates::to_rfc3339_millis(&d)),
             date_max: acc.date_max.map(|d| dates::to_rfc3339_millis(&d)),
             date_evidence: Vec::new(),
+            num_min: None,
+            num_max: None,
         };
         let n = acc.n;
         let th95 = |x: u64| x * 100 >= n * 95;
@@ -481,6 +496,13 @@ pub fn infer_fields_with_policy(
         // numeric
         if th95(acc.long_ok) && acc.long_ok > 0 {
             spec.es_type = "long".into();
+            // #1055: the sampled integer range rides the spec wherever the
+            // elected type is `long` — including the epoch-candidate that
+            // stays `long` pending corroboration and the one a sibling date
+            // range later flips to `date` (where it lands beside the
+            // RFC3339 `date_min`/`date_max` the flip fills in).
+            spec.num_min = Some(acc.int_min);
+            spec.num_max = Some(acc.int_max);
             // epoch candidate?
             let (lo, hi) = (acc.int_min, acc.int_max);
             let in_ms = lo >= dates::EPOCH_MS_MIN && hi <= dates::EPOCH_MS_MAX;
@@ -1012,4 +1034,101 @@ mod tests {
         assert_eq!(specs[0].es_type, "keyword", "{specs:#?}");
         assert_eq!(elected_default_analyzer(&specs, &fields), None);
     }
+
+    // ── #1055: the sampled numeric range rides the spec ───────────────────
+
+    fn one_field_spec(acc: FieldAcc, records: u64) -> Vec<FieldSpec> {
+        let mut fields = HashMap::new();
+        fields.insert("f".to_string(), acc);
+        infer_fields(&fields, records, true)
+    }
+
+    /// A `long` field carries the integer range its sample actually showed —
+    /// `FieldAcc::int_min`/`int_max` existed from the start; the spec just
+    /// never exposed them. Negative bounds are part of the pin.
+    #[test]
+    fn a_long_field_carries_its_sampled_integer_range() {
+        let mut acc = FieldAcc::default();
+        for v in [3i64, 17, -2, 9] {
+            acc.add(&Value::Number(v.into()));
+        }
+        let specs = one_field_spec(acc, 4);
+        assert_eq!(specs[0].es_type, "long");
+        assert_eq!(specs[0].num_min, Some(-2));
+        assert_eq!(specs[0].num_max, Some(17));
+    }
+
+    /// The range must survive the catalog round trip: `dataset_doc` stores the
+    /// specs as `fields_json`, and every reader (the CLI map, the MCP tool)
+    /// parses that string back. Serialisation is therefore pinned literally.
+    #[test]
+    fn the_numeric_range_serialises_into_fields_json_and_back() {
+        let mut acc = FieldAcc::default();
+        for v in [3i64, 17, -2] {
+            acc.add(&Value::Number(v.into()));
+        }
+        let specs = one_field_spec(acc, 3);
+        let raw = serde_json::to_string(&specs[0]).unwrap();
+        assert!(raw.contains(r#""num_min":-2"#), "{raw}");
+        assert!(raw.contains(r#""num_max":17"#), "{raw}");
+        let bac
```

**File**: `engine/crates/xerj-autoindex/src/lib.rs` (modified, +2/-0)
```diff
@@ -3089,6 +3089,8 @@ fn pipeline_keyword_spec(name: &str) -> infer::FieldSpec {
         date_min: None,
         date_max: None,
         date_evidence: Vec::new(),
+        num_min: None,
+        num_max: None,
     }
 }
 
```

**File**: `engine/crates/xerj-autoindex/src/reconcile_plan.rs` (modified, +2/-0)
```diff
@@ -671,6 +671,8 @@ mod tests {
             date_min: None,
             date_max: None,
             date_evidence: vec![],
+            num_min: None,
+            num_max: None,
         }
     }
 
```

**File**: `engine/crates/xerj-mcp/Cargo.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ version.workspace = true
 edition.workspace = true
 license.workspace = true
 authors.workspace = true
-description = "Model Context Protocol (MCP) stdio server exposing the 11 canonical XERJ agent operations (search, memory, second-brain graph, reference-code) as thin proxies to an ES-compatible XERJ endpoint"
+description = "Model Context Protocol (MCP) stdio server exposing the 12 canonical XERJ agent operations (search, memory, second-brain graph, field map, reference-code) as thin proxies to an ES-compatible XERJ endpoint"
 
 # Library first: the `xerj mcp` subcommand on the main binary calls
 # `xerj_mcp::run`, so a user with the installed `xerj` binary already has the
```

---

### Incident Patch 3: `4bf27a3d` (2026-09-29)
**Commit Message**: docs: [Unreleased] entry for the release-notes compare-base fix (#1069)

One tight entry under Fixed for the release.yml change: GitHub anchors
auto-generated notes on the latest published release, which since the
daily pack-rust-vulns-* releases is a corpus pack — rc.78 shipped
comparing pack-rust-vulns-2026-09-29...v1.0.0-rc.78 and was hand-patched
via REST. The release job now pins previous_tag_name itself.

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -36,6 +36,19 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   published schema `landing/docs/agents/schemas/mcp-tools.json` was
   regenerated from the binary; `published_schema_drift` stays green. (PR
   [#1067](https://github.com/xerj-org/xerj/pull/1067).)
+### Fixed
+
+- **Release notes now compare against the previous engine release instead of
+  the latest corpus pack.** GitHub anchors auto-generated notes ("Full
+  Changelog") on the most recently published release, so since the daily
+  `pack-rust-vulns-*` scheduled releases started, every cut's compare base
+  drifted: `v1.0.0-rc.78` shipped comparing
+  `pack-rust-vulns-2026-09-29...v1.0.0-rc.78` and had to be hand-patched via
+  REST. The release job now computes the base itself (highest `v[0-9]*` tag by
+  version sort that is not the tag being cut) and pre-renders the notes with an
+  explicit `previous_tag_name`, falling back to auto-generation only when no
+  previous v-tag exists (PR
+  [#1069](https://github.com/xerj-org/xerj/pull/1069)).
 
 ### Documentation
 
```

---

### Incident Patch 4: `044e6c60` (2026-09-28)
**Commit Message**: Merge pull request #1051 from xerj-org/fix/pack-zip-loose-sig

fix(autoindex): corpus add --verify-sig finds the loose release sig beside a pack zip

**File**: `engine/crates/xerj-autoindex/src/harvest/sign.rs` (modified, +10/-2)
```diff
@@ -79,9 +79,17 @@ pub fn sign_pack(pack_dir: &Path, seed_hex: &str) -> Result<()> {
 /// `verify_pack` is called BEFORE the pack is materialized, so a failure
 /// means nothing was indexed.
 pub fn verify_pack(pack_dir: &Path, public_hex: &str) -> Result<()> {
+    verify_sig_at(pack_dir, &pack_dir.join(SIG_NAME), public_hex)
+}
+
+/// Same verification with an explicit signature path — `corpus add --from
+/// <pack.zip>` uses this with the LOOSE signature a release ships beside the
+/// zip: the sig is never packed inside the zip (it is deliberately absent
+/// from the SUMS it signs, and the signing step runs after the zip is
+/// built), so a zip consumer's signature lives in a sibling file.
+pub fn verify_sig_at(pack_dir: &Path, sig_path: &Path, public_hex: &str) -> Result<()> {
     let at = |what: &str| format!("{}: {what}", pack_dir.display());
-    let sig_path = pack_dir.join(SIG_NAME);
-    let sig = std::fs::read(&sig_path).with_context(|| at("no SHA256SUMS.sig to verify"))?;
+    let sig = std::fs::read(sig_path).with_context(|| at("no SHA256SUMS.sig to verify"))?;
     if sig.len() != 64 {
         bail!(at(&format!(
             "{SIG_NAME} is {} bytes, expected a 64-byte ed25519 signature",
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +101/-10)
```diff
@@ -236,7 +236,9 @@ clone the repos, detect licences, write corpora/<name>/corpus.json;
 pack's 'pack' field) unless <name> or --as overrides it; a harvested pack
 also checksum-verifies and materializes records per source; --verify-sig
 checks the pack's SHA256SUMS.sig against a public key file first and
-refuses the pack on failure; build harvests recipe sources into a
+refuses the pack on failure (for a pack.zip, the sig cannot travel inside
+— releases ship it loose beside the zip as <pack>-SHA256SUMS.sig, which
+is where the lookup falls back to); build harvests recipe sources into a
 deterministic pack under builds/<name>/ (see tools/xerj-code/); sign/keygen
 are the publish step (ed25519 over SHA256SUMS);
 index builds/verifies/switches the corpus (exit 3 skips junk — normal);
@@ -730,7 +732,16 @@ fn run_corpus_add_pack(
     // Origin check first, before a byte of the pack is trusted: checksums
     // prove integrity, the signature proves who built it. A pack that
     // fails here is refused whole — nothing is materialized, nothing is
-    // indexed.
+    // indexed. The manifest is read only to resolve the pack's name for the
+    // signature lookup — its content is still gated by the signature chain
+    // (sig → SHA256SUMS → manifest.json) before anything below trusts it.
+    let meta = match crate::harvest::pack::read_manifest(pack_dir) {
+        Ok(m) => m,
+        Err(e) => {
+            eprintln!("xerj corpus add: {e:#}");
+            return 2;
+        }
+    };
     if let Some(pubfile) = verify_sig {
         let public = match std::fs::read_to_string(pubfile) {
             Ok(p) => p,
@@ -739,7 +750,32 @@ fn run_corpus_add_pack(
                 return 2;
             }
         };
-        if let Err(e) = crate::harvest::sign::verify_pack(pack_dir, &public) {
+        // A directory pack carries its own SHA256SUMS.sig (what `corpus
+        // sign` writes). A ZIP cannot: the sig is deliberately absent from
+        // the SUMS it signs, so releases ship it as a LOOSE sibling asset,
+        // named <pack-name>-SHA256SUMS.sig (the rust-vulns release asset
+        // name) or plain SHA256SUMS.sig, next to the zip.
+        let sig = if pack_dir.join(crate::harvest::sign::SIG_NAME).is_file() {
+            Some(pack_dir.join(crate::harvest::sign::SIG_NAME))
+        } else {
+            let beside = Path::new(share_path).parent().unwrap_or(Path::new("."));
+            [
+                beside.join(format!("{}-SHA256SUMS.sig", meta.name)),
+                beside.join("SHA256SUMS.sig"),
+            ]
+            .into_iter()
+            .find(|p| p.is_file())
+        };
+        let verdict = match sig {
+            Some(path) => crate::harvest::sign::verify_sig_at(pack_dir, &path, &public),
+            None => Err(anyhow::anyhow!(
+                "no SHA256SUMS.sig to verify — not in the pack, and no \
+                 {}-SHA256SUMS.sig beside {}",
+                meta.name,
+                share_path
+            )),
+        };
+        if let Err(e) = verdict {
             eprintln!("xerj corpus add: {e:#}");
             return 2;
         }
@@ -752,13 +788,6 @@ fn run_corpus_add_pack(
              its origin before indexing"
         );
     }
-    let meta = match crate::harvest::pack::read_manifest(pack_dir) {
-        Ok(m) => m,
-        Err(e) => {
-            eprintln!("xerj corpus add: {e:#}");
-            return 2;
-        }
-    };
     let name = match resolve_corpus_name(explicit_name, &meta.name, &pack_dir.display().to_string())
     {
         Ok(n) => n,
@@ -2407,6 +2436,68 @@ precedence = ["a", "b"]
         );
     }
 
+    #[test]
+    fn a_pack_zip_picks_up_the_loose_release_signature() {
+        let home = tempfile::tempdir().unwrap();
+        let _h = code_home(home.path());
+        let pack = build_demo_pack(home.path());
+
+        // Sign, then ship the signature the way a release does: LOOSE,
+        // beside the zip, named <pack>-SHA256SUMS.si
```

---

### Incident Patch 5: `e759429a` (2026-09-28)
**Commit Message**: fix(autoindex): corpus add --verify-sig finds the loose release sig beside a pack zip

The first published pack release (pack-rust-vulns-2026-09-28, run
36361904374) exposed a gap the whole pipeline had papered over: the
consumer flow every surface prints — 'corpus add --from <pack.zip>
--verify-sig <pub>' (pack README, docs/CORPUS_PACKS.md Quick start, the
release body) — FAILED with 'no SHA256SUMS.sig to verify'. The zip
cannot contain the signature (it is deliberately absent from the SUMS it
signs, and signing runs after the zip is built), and verify_pack only
ever looked inside the pack dir. The publish workflow never noticed
because its consumer-path step verifies the pack DIRECTORY, where
corpus sign left SHA256SUMS.sig beside the SUMS; the zip path was never
exercised end-to-end until the release was actually consumed from its
public URLs.

Fix: signature lookup gains the loose-asset fallback —
  1. <pack>/SHA256SUMS.sig              (directory pack, corpus sign)
  2. <zip-dir>/<pack-name>-SHA256SUMS.sig (the release asset name)
  3. <zip-dir>/SHA256SUMS.sig
read_manifest is hoisted above the check for the pack name only; its
content stays gated by the signature chain (sig →

**File**: `engine/crates/xerj-autoindex/src/harvest/sign.rs` (modified, +10/-2)
```diff
@@ -79,9 +79,17 @@ pub fn sign_pack(pack_dir: &Path, seed_hex: &str) -> Result<()> {
 /// `verify_pack` is called BEFORE the pack is materialized, so a failure
 /// means nothing was indexed.
 pub fn verify_pack(pack_dir: &Path, public_hex: &str) -> Result<()> {
+    verify_sig_at(pack_dir, &pack_dir.join(SIG_NAME), public_hex)
+}
+
+/// Same verification with an explicit signature path — `corpus add --from
+/// <pack.zip>` uses this with the LOOSE signature a release ships beside the
+/// zip: the sig is never packed inside the zip (it is deliberately absent
+/// from the SUMS it signs, and the signing step runs after the zip is
+/// built), so a zip consumer's signature lives in a sibling file.
+pub fn verify_sig_at(pack_dir: &Path, sig_path: &Path, public_hex: &str) -> Result<()> {
     let at = |what: &str| format!("{}: {what}", pack_dir.display());
-    let sig_path = pack_dir.join(SIG_NAME);
-    let sig = std::fs::read(&sig_path).with_context(|| at("no SHA256SUMS.sig to verify"))?;
+    let sig = std::fs::read(sig_path).with_context(|| at("no SHA256SUMS.sig to verify"))?;
     if sig.len() != 64 {
         bail!(at(&format!(
             "{SIG_NAME} is {} bytes, expected a 64-byte ed25519 signature",
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +101/-10)
```diff
@@ -236,7 +236,9 @@ clone the repos, detect licences, write corpora/<name>/corpus.json;
 pack's 'pack' field) unless <name> or --as overrides it; a harvested pack
 also checksum-verifies and materializes records per source; --verify-sig
 checks the pack's SHA256SUMS.sig against a public key file first and
-refuses the pack on failure; build harvests recipe sources into a
+refuses the pack on failure (for a pack.zip, the sig cannot travel inside
+— releases ship it loose beside the zip as <pack>-SHA256SUMS.sig, which
+is where the lookup falls back to); build harvests recipe sources into a
 deterministic pack under builds/<name>/ (see tools/xerj-code/); sign/keygen
 are the publish step (ed25519 over SHA256SUMS);
 index builds/verifies/switches the corpus (exit 3 skips junk — normal);
@@ -730,7 +732,16 @@ fn run_corpus_add_pack(
     // Origin check first, before a byte of the pack is trusted: checksums
     // prove integrity, the signature proves who built it. A pack that
     // fails here is refused whole — nothing is materialized, nothing is
-    // indexed.
+    // indexed. The manifest is read only to resolve the pack's name for the
+    // signature lookup — its content is still gated by the signature chain
+    // (sig → SHA256SUMS → manifest.json) before anything below trusts it.
+    let meta = match crate::harvest::pack::read_manifest(pack_dir) {
+        Ok(m) => m,
+        Err(e) => {
+            eprintln!("xerj corpus add: {e:#}");
+            return 2;
+        }
+    };
     if let Some(pubfile) = verify_sig {
         let public = match std::fs::read_to_string(pubfile) {
             Ok(p) => p,
@@ -739,7 +750,32 @@ fn run_corpus_add_pack(
                 return 2;
             }
         };
-        if let Err(e) = crate::harvest::sign::verify_pack(pack_dir, &public) {
+        // A directory pack carries its own SHA256SUMS.sig (what `corpus
+        // sign` writes). A ZIP cannot: the sig is deliberately absent from
+        // the SUMS it signs, so releases ship it as a LOOSE sibling asset,
+        // named <pack-name>-SHA256SUMS.sig (the rust-vulns release asset
+        // name) or plain SHA256SUMS.sig, next to the zip.
+        let sig = if pack_dir.join(crate::harvest::sign::SIG_NAME).is_file() {
+            Some(pack_dir.join(crate::harvest::sign::SIG_NAME))
+        } else {
+            let beside = Path::new(share_path).parent().unwrap_or(Path::new("."));
+            [
+                beside.join(format!("{}-SHA256SUMS.sig", meta.name)),
+                beside.join("SHA256SUMS.sig"),
+            ]
+            .into_iter()
+            .find(|p| p.is_file())
+        };
+        let verdict = match sig {
+            Some(path) => crate::harvest::sign::verify_sig_at(pack_dir, &path, &public),
+            None => Err(anyhow::anyhow!(
+                "no SHA256SUMS.sig to verify — not in the pack, and no \
+                 {}-SHA256SUMS.sig beside {}",
+                meta.name,
+                share_path
+            )),
+        };
+        if let Err(e) = verdict {
             eprintln!("xerj corpus add: {e:#}");
             return 2;
         }
@@ -752,13 +788,6 @@ fn run_corpus_add_pack(
              its origin before indexing"
         );
     }
-    let meta = match crate::harvest::pack::read_manifest(pack_dir) {
-        Ok(m) => m,
-        Err(e) => {
-            eprintln!("xerj corpus add: {e:#}");
-            return 2;
-        }
-    };
     let name = match resolve_corpus_name(explicit_name, &meta.name, &pack_dir.display().to_string())
     {
         Ok(n) => n,
@@ -2407,6 +2436,68 @@ precedence = ["a", "b"]
         );
     }
 
+    #[test]
+    fn a_pack_zip_picks_up_the_loose_release_signature() {
+        let home = tempfile::tempdir().unwrap();
+        let _h = code_home(home.path());
+        let pack = build_demo_pack(home.path());
+
+        // Sign, then ship the signature the way a release does: LOOSE,
+        // beside the zip, named <pack>-SHA256SUMS.si
```

---

### Incident Patch 6: `b204220a` (2026-09-28)
**Commit Message**: Merge pull request #1050 from xerj-org/fix/pack-release-dated-tags

ci(pack-publish): dated daily releases — immutable-release tags are single-use

**File**: `.github/workflows/pack-publish.yml` (modified, +46/-23)
```diff
@@ -122,42 +122,46 @@ jobs:
           cp SHA256SUMS "$RUNNER_TEMP/rust-vulns-SHA256SUMS"
           cp SHA256SUMS.sig "$RUNNER_TEMP/rust-vulns-SHA256SUMS.sig"
 
-      # This repository has immutable releases: assets may only be uploaded
-      # BEFORE a release is published. Run 36355121167 died uploading the
-      # signature — "Cannot upload asset … to an immutable release" — because
-      # the action created the release already published. Deleting a release
-      # (and its tag) is still allowed — verified by hand against the
-      # half-published first attempt. So a rolling release under one URL is
-      # three moves:
-      #   1. drop the previous release and tag (first-ever run: nothing to
-      #      delete, `|| true`),
-      #   2. recreate it as a DRAFT and upload the assets to the draft,
+      # This repository has immutable releases, which make release tags
+      # SINGLE-USE: assets may only be uploaded before a release is published,
+      # and a tag that has named an immutable release can never name another —
+      # run 36358399114 got "Cannot create ref … / tag_name was used by an
+      # immutable release" trying to reuse the deleted first attempt's tag,
+      # and 36355121167 got "Cannot upload asset … to an immutable release"
+      # trying to upload after publish. So each build is its own dated
+      # release, published the way GitHub's error message prescribes:
+      #   1. compute pack-rust-vulns-YYYY-MM-DD (a tag never used before;
+      #      a same-day re-run deletes and recreates today's release first),
+      #   2. create it as a DRAFT and upload the assets to the draft,
       #   3. publish the draft (`release.published` fires).
-      # Consumers keep the one stable set of URLs already printed in the pack
-      # README, docs/CORPUS_PACKS.md and the blog post; the seconds between
-      # (1) and (3) are the only window they 404. Yesterday's build stays
-      # exactly what was downloaded from it — the signature pins the bytes.
-      - name: Drop the previous rolling release
+      # Yesterday's release is never touched: under immutable releases it is
+      # exactly the bytes that shipped, and the signature over SHA256SUMS
+      # pins them. A best-effort retention step keeps only the newest 7.
+      - name: Compute the daily tag
+        run: echo "PACK_TAG=pack-rust-vulns-$(date -u +%F)" >> "$GITHUB_ENV"
+
+      - name: Drop today's release if this is a same-day re-run
         env:
           GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: >
-          gh release delete pack-rust-vulns --repo "$GITHUB_REPOSITORY"
+          gh release delete "$PACK_TAG" --repo "$GITHUB_REPOSITORY"
           --cleanup-tag --yes || true
 
       - name: Upload the assets to a draft release
         uses: softprops/action-gh-release@v2
         with:
-          tag_name: pack-rust-vulns
-          name: "rust-vulns corpus pack (rolling)"
+          tag_name: ${{ env.PACK_TAG }}
+          name: "rust-vulns corpus pack (${{ env.PACK_TAG }})"
           draft: true
           prerelease: true
           body: |
             The `rust-vulns` corpus pack, built and signed by the scheduled
             `pack publish` workflow from `tools/packs/rust-vulns/recipe.toml`.
 
-            Each scheduled run deletes and recreates this release, so these
-            URLs always carry the newest signed build; build history lives in
-            the workflow runs.
+            One release per build day; the newest is always at
+            https://github.com/xerj-org/xerj/releases?q=pack-rust-vulns
+            Build history lives in the releases themselves and in the
+            workflow runs.
 
             Install (public key: `tools/packs/keys/rust-vulns.pub` in the repo):
 
@@ -166,7 +170,8 @@ jobs:
                 xerj corpus index rust-vulns
 
             `rust-vulns-freshness.json` carries the build date and record
-            count; the badge in `tools/packs/rust-vulns/READM
```

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -80,7 +80,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   over SHA256SUMS (the public key travels beside the recipe, never inside the
   pack), `corpus add --verify-sig <pubkey>` checks origin *before* anything is
   materialized, and a scheduled workflow rebuilds, signs, and publishes the
-  pack to a rolling GitHub Release — verifying its own output against the
+  pack to a dated GitHub Release per build day (immutable releases make
+  release tags single-use, so there is no one rolling URL) — verifying its
+  own output against the
   committed `.pub` first, so a half-rotated key fails the build. The attack
   the signature exists for is pinned by a test: a self-consistent rebuild
   (tampered records, honestly rewritten checksums) passes every checksum and
```

**File**: `ROADMAP.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ The 1.0 bar: **every public claim verified against the release binary, and every
 - **A real object-storage backend.** *Done in rc.77:* [#965](https://github.com/xerj-org/xerj/issues/965) wired the segment path to object storage — `storage.backend = "s3"` packs each segment family into one immutable ZBM1 bundle object with `snapshot.json` as the publication point, merges publish before retiring inputs, and a fresh node adopts the bucket (see *Shipping today* for the full statement). The client (`s3.rs`, real S3-compatible: Cloudflare R2, MinIO, AWS S3), the read-through segment cache, per-request cost accounting by billing class and the stop-don't-warn budget had landed in rc.75. Separately, `xerj autoindex s3://bucket/prefix` reads documents OUT of a bucket, which is a source, not a home.
 - **A block index mode for logs.** An index mode for log-shaped data that stores rows in time-partitioned columnar blocks and skips whole blocks by their min/max metadata, instead of building a per-term inverted index over every field. *Today:* the `xerj-logs` crate implements that design (columnar encoding, log-template extraction, time-range queries with block skipping, retention), is compiled into `xerj-engine` and `xerj-server` as a dependency, and is **called from no non-test code**. Log-shaped analytics run through the general columnar segment format and the aggregation suite. Wire it behind an explicit index setting and measure it against the general path on the same data, or remove it — the *Log-analytics data path* theme below is this same item.
 - **User-code ingest plugins.** *Today:* the ingest pipeline's transforms are built-in native Rust plugins — rename, drop, add, JSON parse, timestamp parse, PII redaction, grok, route — and they do run on `_bulk`. The crate is named `xerj-wasm`, but **the wasmtime backend is not in the tree**: there is no `wasmtime` dependency and no `wasm` feature, only a note that one could be added behind the same trait. Planned: a sandboxed runtime for user-supplied transforms with fuel and memory limits and no ambient filesystem or network access. Until then the refusal rule holds: a pipeline naming a processor this build does not implement is stored as unrunnable and every ingest through it is refused, never quietly run as a shorter pipeline.
-- **A corpus hub of signed, pre-indexed packs.** Download a reference corpus — a standard library, a specification set — already indexed, and mount it, instead of every user spending the same CPU-hours indexing the same public text. *Today:* the **records half is built and signed** — `xerj corpus build` (PR [#1046](https://github.com/xerj-org/xerj/pull/1046)) turns a declarative recipe (sources with licences, identity edges, merge precedence, derived fields) into a checksummed portable pack of *records* with a `format_version` readers refuse when unknown, per-file checksums verified on `corpus add --from <pack>`, and licence + provenance on every record; the first real pack is `rust-vulns` (`tools/packs/rust-vulns/`, identity-resolved across osv.dev and RustSec, with a test pinning its README numbers to a measured build), published by a scheduled workflow as a rolling GitHub Release with a **detached ed25519 signature** over SHA256SUMS (`xerj corpus keygen`/`sign`; `corpus add --verify-sig <pubkey>` checks origin before anything is indexed — the public key travels beside the recipe, never inside the pack; nobody in the prior-art survey signs their database). Still unbuilt: the **hub itself** (a directory of packs beyond this first one) and the **pre-indexed** half — [#1030](https://github.com/xerj-org/xerj/issues/1030) remains the tracker for the indexed-segment bundle that is the format this item would distribute, since indexing a records pack still costs each consumer the same CPU-hours. Three risks decide whether the rest ships: **redistribution licence** (an index is a derived copy of its source text — a pack may carry only what its lice
```

**File**: `docs/CORPUS_PACKS.md` (modified, +7/-2)
```diff
@@ -153,8 +153,13 @@ procedure is in
 
 The [pack publish workflow](../.github/workflows/pack-publish.yml) rebuilds
 and signs `rust-vulns` daily and attaches the zip, the loose checksums, the
-signature, and a freshness badge file to a rolling GitHub Release
-([pack-rust-vulns](https://github.com/xerj-org/xerj/releases/tag/pack-rust-vulns)).
+signature, and a freshness file to a GitHub Release per build day — dated
+tags `pack-rust-vulns-YYYY-MM-DD`, newest first at
+[releases?q=pack-rust-vulns](https://github.com/xerj-org/xerj/releases?q=pack-rust-vulns).
+This repository has immutable releases (release tags are single-use), which
+is why the pack ships one release per day instead of one rolling URL —
+each day's release is exactly the bytes that shipped, pinned by its
+signature, and the workflow keeps only the newest 7.
 Freshness is an operational promise the schedule keeps, not a README claim:
 the pack's own 30-day staleness refusal applies to our published corpus
 exactly as it does to a user's reference corpora.
```

**File**: `landing/blog/index.html` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ <h1>MEASURED,<br><span class="accent">WRITTEN DOWN.</span></h1>
               <span class="blp-num">ed25519 over SHA256SUMS <span class="blp-chip">prior art: 0 of 4</span></span><span class="blp-bar a" style="width:100%"></span>
             </div>
           </div>
-          <p class="blp-foot">daily rebuild · rolling release pack-rust-vulns · cold build ~34 s</p>
+          <p class="blp-foot">daily rebuild · signed releases pack-rust-vulns-* · cold build ~34 s</p>
         </div>
         <div class="bl-meta">
           <p class="bl-date"><time datetime="2026-09-27">2026-09-27</time> · CORPUS PACKS · SECURITY DATA</p>
```

---

### Incident Patch 7: `2adad539` (2026-09-27)
**Commit Message**: Merge pull request #1049 from xerj-org/fix/pack-release-immutability

ci(pack-publish): publish under immutable releases — drop, draft, publish

**File**: `.github/workflows/pack-publish.yml` (modified, +37/-4)
```diff
@@ -122,19 +122,43 @@ jobs:
           cp SHA256SUMS "$RUNNER_TEMP/rust-vulns-SHA256SUMS"
           cp SHA256SUMS.sig "$RUNNER_TEMP/rust-vulns-SHA256SUMS.sig"
 
-      # Rolling prerelease tag: consumers pin one URL that always carries the
-      # latest build. Versioned history lives in the workflow runs and the
-      # release's previous-assets behavior (clobber replaces same-named files).
-      - name: Publish to the rolling release
+      # This repository has immutable releases: assets may only be uploaded
+      # BEFORE a release is published. Run 36355121167 died uploading the
+      # signature — "Cannot upload asset … to an immutable release" — because
+      # the action created the release already published. Deleting a release
+      # (and its tag) is still allowed — verified by hand against the
+      # half-published first attempt. So a rolling release under one URL is
+      # three moves:
+      #   1. drop the previous release and tag (first-ever run: nothing to
+      #      delete, `|| true`),
+      #   2. recreate it as a DRAFT and upload the assets to the draft,
+      #   3. publish the draft (`release.published` fires).
+      # Consumers keep the one stable set of URLs already printed in the pack
+      # README, docs/CORPUS_PACKS.md and the blog post; the seconds between
+      # (1) and (3) are the only window they 404. Yesterday's build stays
+      # exactly what was downloaded from it — the signature pins the bytes.
+      - name: Drop the previous rolling release
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: >
+          gh release delete pack-rust-vulns --repo "$GITHUB_REPOSITORY"
+          --cleanup-tag --yes || true
+
+      - name: Upload the assets to a draft release
         uses: softprops/action-gh-release@v2
         with:
           tag_name: pack-rust-vulns
           name: "rust-vulns corpus pack (rolling)"
+          draft: true
           prerelease: true
           body: |
             The `rust-vulns` corpus pack, built and signed by the scheduled
             `pack publish` workflow from `tools/packs/rust-vulns/recipe.toml`.
 
+            Each scheduled run deletes and recreates this release, so these
+            URLs always carry the newest signed build; build history lives in
+            the workflow runs.
+
             Install (public key: `tools/packs/keys/rust-vulns.pub` in the repo):
 
                 xerj corpus add rust-vulns --from rust-vulns-pack.zip \
@@ -148,3 +172,12 @@ jobs:
             ${{ runner.temp }}/rust-vulns-SHA256SUMS
             ${{ runner.temp }}/rust-vulns-SHA256SUMS.sig
             ${{ runner.temp }}/rust-vulns-freshness.json
+
+      # Draft first, publish last: this is the step GitHub's own error
+      # message prescribes for immutable-release repositories.
+      - name: Publish the draft
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: >
+          gh release edit pack-rust-vulns --repo "$GITHUB_REPOSITORY"
+          --draft=false
```

---

### Incident Patch 8: `26e8205f` (2026-09-27)
**Commit Message**: ci(pack-publish): fix unresolvable actions/checkout pin; pin rust-cache to repo SHA

The first dispatched pack-publish run (36354523697) died in 'Prepare all
required actions' before any step executed: 'Unable to resolve action
actions/checkout@11d5960a326750d5838078e36cf38b2c4a3267bf, unable to find
version'. Root cause: the pin's tail was transcribed wrong when the
workflow was written — 2c4a3267bf where the repo-standard SHA (18 other
workflows) ends 85af677262. No CI job validates action refs, so the typo
survived the PR's all-green run.

While here: Swatinem/rust-cache was the only floating tag in the file;
pin it to the SHA the other 9 uses share (6323deb1 v2.9.2) — a scheduled
workflow should not follow a moving tag.

Trivial CI-config fix on a just-merged file; direct to main rather than
a 50-minute PR round for a one-line pin correction.

**File**: `.github/workflows/pack-publish.yml` (modified, +2/-2)
```diff
@@ -40,11 +40,11 @@ jobs:
     runs-on: ubuntu-latest
     timeout-minutes: 45
     steps:
-      - uses: actions/checkout@11d5960a326750d5838078e36cf38b2c4a3267bf # v4.4.0
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
 
       - uses: dtolnay/rust-toolchain@stable
 
-      - uses: Swatinem/rust-cache@v2
+      - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
         with:
           workspaces: engine
 
```

---

### Incident Patch 9: `7497930a` (2026-09-27)
**Commit Message**: fix(rerank,docs): classify the corpus builder's fetcher on the egress inventory

PR #1046's Build + Test failed on
every_outbound_client_in_the_engine_is_on_the_published_list: M2 added
xerj-autoindex/src/harvest/httpget.rs, a reqwest::blocking client that
fetches http-zip sources — a new outbound client under engine/crates the
published list did not account for. The inventory test did exactly what
it exists for.

Classification: Role::Client("`xerj corpus build`"), with a new row in
docs/RERANK.md "Every way data leaves a XERJ node". The fetch is
read-only — HTTPS GETs to the URLs the operator's recipe names (plus
the git clone/fetch a git source shells out to, which the marker list
does not track; the doc row names it anyway so the operator sees the
whole picture). Records travel INTO the machine; nothing is sent
upstream, so xerj_rerank::DATA_EGRESS ("what a node SENDS") and the
air-gapped recipe rows are deliberately unchanged — same treatment as
`xerj autoindex s3://`, the closest precedent.

egress_inventory 4/4. No production code changed.

**File**: `docs/RERANK.md` (modified, +1/-0)
```diff
@@ -360,6 +360,7 @@ client appears in a source file this list does not account for:
 | **Object storage backend** — `[storage]`, `S3Backend` | S3 requests to the configured endpoint: bucket and key names, ranged reads, and the credentials from the environment. The index bundles it writes when it is the active home DO carry stored document text — no query text ever leaves | Since v1.0.0-rc.77 ([#1008](https://github.com/xerj-org/xerj/pull/1008) closing [#965](https://github.com/xerj-org/xerj/issues/965)): one immutable ZBM1 bundle per segment family plus `snapshot.json`, when `storage.backend = "s3"` and `storage.s3_bucket` names an existing bucket | Off: the default backend is `local` |
 | **`xerj autoindex s3://`** (client, not the node) — `--endpoint-url`, `AWS_*` | S3 requests to the configured endpoint: bucket and key names and the credentials; the objects travel INTO the machine, and their text then goes to the node URL you gave the client | While that command runs | Off: only when you pass an `s3://` root |
 | **`xerj autoindex s3:// --watch`** (client, not the node) — `--interval`, `--endpoint-url`, `AWS_*` | The same S3 requests as above, repeated every interval: a `ListObjectsV2` page per cycle plus a GET per changed object. Billed to the operator's object-store account, so the run keeps a spend ledger and stops at its budget | Every `--interval` while the watch runs | Off: only with `--watch` on an `s3://` root |
+| **`xerj corpus build`** (client, not the node) — recipe `[[sources]]` `url` | HTTPS GETs to the source URLs your recipe names (one per `http-zip` source per build, plus the `git clone`/`fetch` a `git` source runs). Records travel INTO the machine; no document text and no credentials are sent upstream — it is a read-only fetch | While `xerj corpus build` runs | Off: only when a recipe declares an `http-zip` or `git` source |
 
 A node started with the defaults opens none of these connections, and makes no
 telemetry, update-check or licence call. Two things outside the node complete
```

**File**: `engine/crates/xerj-rerank/tests/egress_inventory.rs` (modified, +8/-0)
```diff
@@ -107,6 +107,14 @@ const KNOWN: &[(&str, Role)] = &[
         "xerj-autoindex/src/objwatch/s3.rs",
         Role::Client("`xerj autoindex s3:// --watch`"),
     ),
+    // The corpus builder's http-zip fetcher (#1046). Read-only: sources come
+    // IN (a GET per http-zip source per build); no document text is ever
+    // sent upstream, so DATA_EGRESS and the air-gapped rows do not change.
+    // Git sources shell out to `git`, which the marker list does not track.
+    (
+        "xerj-autoindex/src/harvest/httpget.rs",
+        Role::Client("`xerj corpus build`"),
+    ),
     (
         "xerj-autoindex/src/objsource_minio_tests.rs",
         Role::TestOnly,
```

---

### Incident Patch 10: `1a0b8da3` (2026-09-27)
**Commit Message**: fix(autoindex): satisfy clippy --tests on the corpus-builder arc (PR #1046)

The arc commits were verified with `clippy --lib` only; CI's Format +
Clippy job runs with --tests, which caught two lints in test code:

- xc.rs CodeHomeGuard: the tuple field holds the ENV_LOCK guard purely
  for its Drop side effect (release on scope exit) and is never read —
  dead_code fires. #[expect(dead_code)] documents exactly that and
  will un-lint itself if the field ever gains a reader.
- recipe.rs minimal-recipe test used assert_eq!(bool, true) — clippy's
  bool_assert_comparison wants assert!(..).

No production code changed; behavior identical. xerj-autoindex
clippy --lib --tests -D warnings clean, harvest suite 42/0.

**File**: `engine/crates/xerj-autoindex/src/harvest/recipe.rs` (modified, +1/-1)
```diff
@@ -667,7 +667,7 @@ edges = [{ field = "id" }]
         let r = load(&write(tmp.path(), MINIMAL)).unwrap();
         assert_eq!(r.name, "demo");
         assert_eq!(r.envelope.id_from, vec!["id".to_string()]);
-        assert_eq!(r.envelope.passthrough, true);
+        assert!(r.envelope.passthrough);
         assert_eq!(r.emit.shards, 16);
         assert_eq!(r.sources[0].glob, "**/*.json");
     }
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +1/-1)
```diff
@@ -2138,7 +2138,7 @@ mod tests {
     /// env held across both, not scoped per call. Under ENV_LOCK for the
     /// same reason the env tests above are (do NOT re-enter: the lock is not
     /// reentrant, so nothing inside may take it again).
-    struct CodeHomeGuard(std::sync::MutexGuard<'static, ()>);
+    struct CodeHomeGuard(#[expect(dead_code)] std::sync::MutexGuard<'static, ()>);
     impl Drop for CodeHomeGuard {
         fn drop(&mut self) {
             std::env::remove_var("XERJ_CODE_HOME");
```

#### Recent Merged Pull Requests:
- **PR #1079** (2026-09-30): bench(ask-plan): latency arm — #1056's p50 gate measured, 1.129 ms (PASS) (@xerj-org)
- **PR #1078** (2026-09-30): docs(llms): tool inventory = the released thirteen-tool MCP registry (@xerj-org)
- **PR #1077** (2026-09-30): search: opt-in local judge stage on _search — _p_relevant per hit (#1060) (@xerj-org)
- **PR #1076** (2026-09-30): feat(api): POST /_ask + xerj_plan MCP tool — prompt in, validated DSL out (#1056) (@xerj-org)
- **PR #1075** (2026-09-30): systemone: decision cache flywheel — write-back, source, human corrections (#1061) (@xerj-org)
- **PR #1074** (2026-09-30): mcp: xerj_map — per-index FieldSpec field map from the autoindex catalog (#1055) (@xerj-org)
- **PR #1073** (2026-09-30): xerj-server: --decide-mode/--decide-model-dir — arm the tier-2 decide head from the CLI (@xerj-org)
- **PR #1072** (2026-09-30): systemone: local zero-shot decision head (tier 2) via candle (#1057) (@xerj-org)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
